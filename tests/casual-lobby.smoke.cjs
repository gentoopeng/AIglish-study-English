const { chromium, webkit } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const type = process.env.BROWSER === "webkit" ? webkit : chromium,
    browser = await type.launch(
      type === chromium
        ? { executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] }
        : { executablePath: process.env.WEBKIT_EXECUTABLE_PATH },
    );
  try {
    const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.goto("http://127.0.0.1:8000");
    await page
      .getByRole("button", { name: "ゲストとしてテストプレイ" })
      .click();
    await page.waitForFunction(() => window.__learningBootReady);
    await page.evaluate(() => {
      window.__gcLoginShown = true;
      myId = "GUEST-000";
      currentTextbook = "casual-a";
      textbooksPool = [
        { id: "casual-a", name: "英語の単語帳" },
        { id: "casual-b", name: "日本史の単語帳" },
      ];
      window.__battleReads = [];
      window.__battleBooks = Object.fromEntries(
        textbooksPool.map((book, b) => [
          book.id,
          migrateVocabData(
            Array.from({ length: 40 }, (_, i) => ({
              num: i + 1,
              word: (b ? "日本史" : "英語") + (i + 1),
              meaning: "意味" + b + "-" + (i + 1),
            })),
          ),
        ]),
      );
      window.TextbookFiles.getWords = async (book) => {
        __battleReads.push(book);
        return __battleBooks[book];
      };
      for (const [book, words] of Object.entries(__battleBooks)) {
        const progress = {};
        words.forEach(
          (word, i) =>
            (progress[String(word.num)] = {
              sig: buildWordSignature(word),
              meanings: {
                [word.meanings[0].id]: {
                  status: i < 20 ? "bad" : "ok",
                  history: i < 20 ? ["bad", "bad"] : ["ok"],
                },
              },
            }),
        );
        LearningData.restore(book, progress);
      }
    });
    await page.locator("#nav-battle").click();
    assert.equal(await page.locator(".battle-mode-card").count(), 2);
    await page.screenshot({
      path: "/tmp/battle-modes-" + type.name() + ".png",
    });
    await page.locator(".mode-serious").click();
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    await page.locator(".mode-casual").click();
    const defaults = await page.evaluate(() =>
      BattleLobby.read(document.querySelector("#wordDuelScreen")),
    );
    assert.equal(defaults.missPenalty, 100);
    assert.equal(defaults.rules.points, 100);
    assert.equal(defaults.rules.combo, 1.1);
    await page.getByLabel("最初の単語番号").fill("5");
    await page.getByLabel("最後の単語番号").fill("20");
    let data = await page.evaluate(() =>
      BattleLobby.words(document.querySelector("#wordDuelScreen"), 123),
    );
    assert.equal(data.pool.length, 16);
    assert.ok(data.pool.every((w) => +w.ref.num >= 5 && +w.ref.num <= 20));
    await page.locator('.battle-book-picker input[value="casual-b"]').check();
    assert.equal(await page.locator(".battle-range").isVisible(), false);
    await page.getByLabel("出題内容").selectOption("status");
    await page.locator(".battle-status-picker input[value=ok]").uncheck();
    await page.locator(".battle-status-picker input[value=so]").uncheck();
    await page.locator(".battle-status-picker input[value=none]").uncheck();
    data = await page.evaluate(() =>
      BattleLobby.words(document.querySelector("#wordDuelScreen"), 123),
    );
    assert.equal(data.pool.length, 40);
    assert.deepEqual(
      new Set(data.pool.map((w) => w.ref.book)),
      new Set(["casual-a", "casual-b"]),
    );
    assert.ok(data.pool.every((w) => +w.ref.num <= 20));
    await page.getByLabel("出題内容").selectOption("weak");
    data = await page.evaluate(() =>
      BattleLobby.words(document.querySelector("#wordDuelScreen"), 123),
    );
    assert.equal(data.pool.length, 80);
    assert.ok(data.pool.some((w) => +w.ref.num > 20));
    for (const size of [
      { width: 390, height: 844 },
      { width: 320, height: 568 },
    ]) {
      await page.setViewportSize(size);
      for (const tab of ["books", "rules", "events"]) {
        await page.locator("[data-config-tab=" + tab + "]").click();
        const layout = await page.evaluate(() => {
          const s = document.querySelector("#wordDuelScreen"),
            p = s.querySelector("[data-config-panel]:not([hidden])"),
            footer = s.querySelector(".battle-config-footer");
          return {
            screenScroll: s.scrollHeight > s.clientHeight + 1,
            width: document.documentElement.scrollWidth > innerWidth,
            footer: footer.getBoundingClientRect().bottom <= innerHeight + 1,
            panelScroll: p.scrollHeight > p.clientHeight + 1,
          };
        });
        assert.equal(layout.screenScroll, false);
        assert.equal(layout.width, false);
        assert.equal(layout.footer, true);
        if (tab !== "books") {
          if (layout.panelScroll) {
            await page.screenshot({ path: "/tmp/battle-overflow.png" });
            console.log(
              await page
                .locator("[data-config-panel=" + tab + "]")
                .evaluate((p) => ({
                  h: p.clientHeight,
                  s: p.scrollHeight,
                  children: [...p.children].map((n) => ({
                    tag: n.className,
                    h: n.getBoundingClientRect().height,
                  })),
                })),
            );
          }
          assert.equal(
            layout.panelScroll,
            false,
            tab + " must fit without scrolling " + JSON.stringify(size),
          );
        }
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("[data-events]").check();
    await page.getByLabel("イベント継続秒数").fill("10");
    await page.screenshot({
      path: "/tmp/battle-events-" + type.name() + ".png",
    });
    await page.locator("[data-config-tab=rules]").click();
    const minuteWheel = page.getByRole("listbox", { name: "分を回して選ぶ" });
    await minuteWheel.press("ArrowDown");
    assert.equal(await page.getByLabel("制限時間の分").inputValue(), "2");
    await minuteWheel.press("ArrowUp");
    await minuteWheel.evaluate((wheel) => (wheel.scrollTop = 72));
    await page.waitForFunction(
      () => document.querySelector("[data-time-minutes]").value === "3",
    );
    await page.getByLabel("制限時間の分").selectOption("1");
    await page.getByLabel("正解の得点").fill("200");
    await page.getByLabel("コンボ倍率").fill("1.25");
    await page.getByLabel("問題数ボーナス").fill("5");
    await page.getByLabel("制限時間の分").selectOption("0");
    await page.getByLabel("制限時間の秒").selectOption("45");
    await page.screenshot({
      path: "/tmp/battle-rules-" + type.name() + ".png",
    });
    await page.getByRole("button", { name: "一人プレイ", exact: true }).click();
    await page.locator(".duel-options button").first().waitFor();
    assert.equal(await page.locator(".duel-clock").textContent(), "45");
    const prompt = await page.locator(".duel-prompt").textContent(),
      b = prompt.startsWith("日本史") ? 1 : 0,
      n = prompt.replace(/[^0-9]/g, ""),
      options = await page.locator(".duel-options button").allTextContents(),
      correct = options.indexOf("意味" + b + "-" + n);
    await page
      .locator(".duel-options button")
      .nth(correct < 0 ? 9 : correct)
      .click();
    assert.equal(await page.locator("[data-duel-score]").textContent(), "200");
    const saved = await page.evaluate(
      ({ b, n }) => LearningData.read(b ? "casual-b" : "casual-a")[n],
      { b, n },
    );
    assert.equal(saved.status, "ok");
    await page.getByRole("button", { name: "終了する", exact: true }).click();
    assert.equal(
      await page.locator(".duel-solo-result strong").textContent(),
      "205点",
    );
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    assert.deepEqual(errors, []);
    console.log(
      "PASS " +
        type.name() +
        ": pictures, mode entry, bounded settings at 320x568, multi-book/range/status/weak selection, custom scoring and correct source-book progress",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
