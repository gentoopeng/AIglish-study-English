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
        viewport: { width: 320, height: 568 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem(
        "aiglish_sound_settings",
        JSON.stringify({ enabled: false }),
      );
    });
    await page.goto("http://127.0.0.1:8000");
    await page.waitForFunction(() => window.WeakReview && window.StudyPoints);
    await page
      .getByRole("button", { name: "ゲストとしてテストプレイ" })
      .click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.evaluate(() => {
      textbooksPool = [{ id: "review-book", name: "復習テスト" }];
      const raw = Array.from({ length: 30 }, (_, i) => ({
        num: i + 1,
        word: "word" + (i + 1),
        meanings: [
          { id: i + 1 + "-0", text: "意味" + (i + 1) },
          ...(i === 0 ? [{ id: "1-1", text: "もう一つの意味" }] : []),
        ],
      }));
      const words = migrateVocabData(raw);
      textbooksCacheMap["review-book"] = words;
      const progress = {};
      for (const word of words) {
        progress[word.num] = {
          sig: buildWordSignature(word),
          note: "大切なメモ",
          editedAt: Date.now() - (word.num === 3 ? 0 : 86400000),
          status: "bad",
          meanings: Object.fromEntries(
            word.meanings.map((m) => [
              m.id,
              { status: word.num <= 3 ? "bad" : "ok", history: ["bad"] },
            ]),
          ),
        };
      }
      localStorage.setItem(
        "core_v4_user_vocab_progress_GUEST-000_review-book",
        JSON.stringify(progress),
      );
      window.TextbookFiles.getWords = async () => words;
      window.__reviewSaves = 0;
      window.saveAfterStudy = async () => {
        __reviewSaves++;
        return { localSaved: true, cloudSaved: false };
      };
      switchTab("vocab");
      showVocabLibrarySelection();
    });
    await page
      .getByRole("button", { name: "復習テストの学習方法を選ぶ" })
      .click();
    assert.equal(
      (await page
        .locator(".book-study-menu")
        .evaluate((el) => el.getBoundingClientRect().width)) <= 280,
      true,
    );
    await page.getByRole("button", { name: "苦手復習", exact: true }).click();
    await page.locator(".review-choices").waitFor();
    assert.match(await page.locator(".review-progress").innerText(), /1 \/ 3/);
    assert.equal(await page.locator(".review-choices button").count(), 10);
    if (process.env.SCREENSHOT)
      await page.screenshot({ path: process.env.SCREENSHOT });
    // Every answer remains reachable without scrolling the page, including long text.
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 393, height: 852 },
    ]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => {
        for (const el of document.querySelectorAll(
          ".review-choices button,.review-prompt",
        )) {
          el.dataset.original = el.textContent;
          el.textContent = "長い単語や意味の折り返しも確認します。".repeat(18);
        }
      });
      const layout = await page.evaluate(() => {
        const screen = document.querySelector(".weak-review-screen"),
          buttons = [...screen.querySelectorAll(".review-choices button")],
          r = buttons.map((el) => el.getBoundingClientRect());
        return {
          overflow: screen.scrollHeight - screen.clientHeight,
          rows: [r[0].y, r[1].y, r[2].y, r[3].y],
          buttons: r.map((rect) => ({
            x: rect.x,
            right: rect.right,
            bottom: rect.bottom,
            height: rect.height,
          })),
        };
      });
      assert.ok(layout.overflow <= 1, "no full-screen page scrolling");
      assert.equal(layout.rows[0], layout.rows[1]);
      assert.equal(layout.rows[1], layout.rows[2]);
      assert.ok(layout.rows[3] > layout.rows[0], "3 by 3 answers");
      for (const rect of layout.buttons) {
        assert.ok(rect.height >= 44, "touch target height");
        assert.ok(
          rect.x >= 0 &&
            rect.right <= viewport.width &&
            rect.bottom <= viewport.height,
          "all ten choices fit",
        );
      }
      await page.evaluate(() => {
        for (const el of document.querySelectorAll(
          ".review-choices button,.review-prompt",
        ))
          el.textContent = el.dataset.original;
      });
    }
    await page.setViewportSize({ width: 320, height: 568 });
    const expected = await page.locator(".review-prompt").innerText();
    await page
      .getByRole("button", {
        name: expected === "word1" ? "意味1" : "意味2",
        exact: true,
      })
      .click();
    assert.match(
      await page.locator(".review-feedback").innerText(),
      /正解.*10pt/,
    );
    assert.equal(await page.evaluate(() => __reviewSaves), 0);
    assert.match(await page.locator(".review-progress").innerText(), /正解 1/);
    assert.equal(
      await page.locator(".review-content progress").evaluate((el) => el.value),
      1,
    );
    const next = page.getByRole("button", { name: "次へ", exact: true });
    assert.ok(
      (await next.boundingBox()).y + (await next.boundingBox()).height <= 568,
      "next button visible at 320x568",
    );
    if (process.env.SCREENSHOT)
      await page.screenshot({
        path: process.env.SCREENSHOT.replace(/\.png$/, "-answered.png"),
      });
    await next.click();
    // Another word separates the two meanings of word1.
    assert.equal(await page.locator(".review-prompt").innerText(), "word2");
    const labels = await page
      .locator(".review-choices button")
      .allTextContents();
    await page
      .getByRole("button", {
        name: labels.find((t) => t !== "意味2" && t !== "選択肢の中にはない"),
        exact: true,
      })
      .click();
    assert.match(
      await page.locator(".review-feedback").innerText(),
      /正解：意味2/,
    );
    await page.getByRole("button", { name: "次へ", exact: true }).click();
    assert.equal(await page.locator(".review-prompt").innerText(), "word1");
    await page
      .getByRole("button", { name: "もう一つの意味", exact: true })
      .click();
    assert.match(
      await page.locator(".review-feedback").innerText(),
      /本日支給済み/,
    );
    await page.getByRole("button", { name: "結果を見る" }).click();
    assert.match(await page.locator(".review-result").innerText(), /2 \/ 3/);
    await page.waitForFunction(() => __reviewSaves === 1);
    const resultLayout = await page
      .locator(".weak-review-screen")
      .evaluate((el) => ({ height: el.clientHeight, scroll: el.scrollHeight }));
    assert.ok(
      resultLayout.scroll <= resultLayout.height + 1,
      "results and return button fit the short viewport",
    );
    if (process.env.SCREENSHOT)
      await page.screenshot({
        path: process.env.SCREENSHOT.replace(/\.png$/, "-result.png"),
      });
    assert.equal(await page.evaluate(() => StudyPoints.balance()), 10);
    assert.equal(
      await page.evaluate(() => LearningData.read("review-book")["1"].note),
      "大切なメモ",
    );
    assert.equal(
      await page.evaluate(
        () => LearningData.read("review-book")["3"].meanings["3-0"].status,
      ),
      "bad",
    );
    assert.equal(await page.evaluate(() => LearningData.read("review-book")["1"].meanings["1-0"].status), "so");
    await page.getByRole("button", { name: "続けて復習" }).click();
    await page.locator(".review-choices").waitFor();
    assert.match(await page.locator(".review-progress").innerText(), /1 \/ 1/);
    assert.equal(await page.locator(".review-prompt").innerText(), "word2");
    await page.getByRole("button", { name: "終了", exact: true }).click();
    await page
      .getByRole("button", { name: "単語帳に戻る", exact: true })
      .click();
    assert.equal(await page.locator(".weak-review-screen").count(), 0);
    assert.equal(await page.locator("#headerDuelRating").count(), 0);
    assert.equal(await page.locator("#headerStudyPoints").innerText(), "10pt");
    await page.locator("#headerStudyPoints").click();
    await page.getByRole("dialog", { name: "ポイント", exact: true }).waitFor();
    assert.equal(await page.locator(".points-history li").count(), 1);
    assert.match(await page.locator(".points-history").innerText(), /word1/);
    assert.match(
      await page.locator(".points-history").innerText(),
      /復習テスト/,
    );
    if (process.env.SCREENSHOT)
      await page.screenshot({
        path: process.env.SCREENSHOT.replace(/\.png$/, "-points.png"),
      });
    await page.getByRole("button", { name: "獲得方法", exact: true }).click();
    assert.match(
      await page.locator(".points-methods").innerText(),
      /正解5pt.*後日復習5pt/,
    );
    await page.getByRole("button", { name: "ポイントを閉じる" }).click();
    await page.locator(".menu-trigger").click();
    await page.locator("#studyPointsMenuButton").click();
    assert.equal(await page.locator("[data-points-total]").innerText(), "10pt");
    await page.getByRole("button", { name: "ポイントを閉じる" }).click();
    assert.deepEqual(errors, []);
    console.log(
      "PASS " +
        type.name() +
        ": small menu, ten choices, prior-day eligibility, meaning-specific progress, word/day point dedup, end-only save, repeat round and mobile layout",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
