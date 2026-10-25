const { chromium, webkit } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const type = process.env.BROWSER === "webkit" ? webkit : chromium;
  const browser = await type.launch(
    type === chromium
      ? { executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] }
      : { executablePath: process.env.WEBKIT_EXECUTABLE_PATH },
  );
  try {
    const page = await browser.newPage({
        viewport: { width: 393, height: 852 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.install();
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem(
        "aiglish_sound_settings",
        JSON.stringify({ enabled: false }),
      );
    });
    await page.goto("http://127.0.0.1:8000");
    await page.waitForFunction(() => window.StudyPoints);
    await page
      .getByRole("button", { name: "ゲストで試す" })
      .click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.evaluate(() => {
      textbooksPool = [{ id: "point-book", name: "ポイント検証" }];
      const words = migrateVocabData(
        Array.from({ length: 20 }, (_, i) => ({
          num: i + 1,
          word: "point" + i,
          meanings: [{ id: "m" + i, text: "意味" + i }],
        })),
      );
      textbooksCacheMap["point-book"] = words;
      switchTab("vocab");
      showVocabLibrarySelection();
      window.__pointCloudCalls = 0;
      window.fbRunTransaction = async () => {
        window.__pointCloudCalls++;
        throw Error("unexpected cloud write during learning");
      };
    });
    await page
      .getByRole("button", { name: "ポイント検証の学習方法を選ぶ" })
      .click();
    await page.getByRole("button", { name: "単語カード", exact: true }).click();
    await page.getByRole("button", { name: "カードを開始する" }).click();
    await page.locator("#activeFlashcard").waitFor();
    await page.evaluate(() => swipeFlashcard("left", -100, 0));
    assert.equal(
      await page.evaluate(() => StudyPoints.balance()),
      2,
      "bad self-assessment earns the same card participation point as ok",
    );
    await page.evaluate(() => swipeFlashcard("up", 0, -100));
    assert.equal(await page.evaluate(() => StudyPoints.balance()), 4);
    assert.equal(
      await page.evaluate(() => window.__pointCloudCalls),
      0,
      "no cloud point writes while flipping",
    );
    // Normal timer ticks add point measurements only for newly observed active time.
    await page.clock.runFor(65000);
    const time = await page.evaluate(() => {
      const ledger = StudyTime.snapshot();
      return {
        minutes: Object.values(ledger.days).reduce(
          (s, d) => s + StudyPointPolicy.timeMinutes(d.pointTime),
          0,
        ),
        points: StudyPoints.balance(),
      };
    });
    assert.ok(
      time.minutes >= 1,
      "real elapsed ticks collect a minute without a new polling timer",
    );
    assert.equal(
      time.points,
      4,
      "today's time does not earn before sleep corrections",
    );
    const sleep = await page.evaluate(() => {
      const ledger = StudyTime.snapshot(),
        before = Object.values(ledger.days).reduce(
          (s, d) => s + StudyPointPolicy.timeMinutes(d.pointTime),
          0,
        );
      StudyTime.sleep(Date.now() - 300000);
      const after = Object.values(StudyTime.snapshot().days).reduce(
        (s, d) => s + StudyPointPolicy.timeMinutes(d.pointTime),
        0,
      );
      return { before, after };
    });
    assert.ok(sleep.before >= 1);
    assert.equal(
      sleep.after,
      0,
      "sleep removes idle measurements from time points",
    );
    await page.evaluate(() => {
      StudyTime.wake();
      finishFlashcardSession();
    });
    await page.clock.runFor(1000);
    await page
      .getByRole("button", { name: "＋ ワークを作る", exact: true })
      .click();
    await page.locator("#workbookName").fill("ポイントワーク");
    await page.locator("#workbookTo").fill("2");
    await page
      .getByRole("button", { name: "ワークを作る", exact: true })
      .click();
    await page
      .locator("#vocabLibraryWorks .textbook-list-item")
      .filter({ hasText: "ポイントワーク" })
      .click();
    const status = page.locator('[data-unit-id="1"] [data-status="bad"]');
    await status.click();
    assert.equal(await page.evaluate(() => StudyPoints.balance()), 6);
    await page.locator('[data-unit-id="1"] [data-status="none"]').click();
    await page.locator('[data-unit-id="1"] [data-status="ok"]').click();
    assert.equal(
      await page.evaluate(() => StudyPoints.balance()),
      6,
      "resetting and changing status cannot farm points",
    );
    await page
      .getByRole("button", { name: "まとめて記録・復習設定", exact: true })
      .click();
    await page.locator("#workbookBatchStatus").selectOption("ok");
    await page
      .getByRole("button", { name: "まとめて保存", exact: true })
      .click();
    assert.equal(
      await page.evaluate(() => StudyPoints.balance()),
      6,
      "bulk status changes do not earn points",
    );
    await page.locator("#headerStudyPoints").click();
    assert.match(
      await page.locator("[data-points-history]").innerText(),
      /単語カード/,
    );
    assert.match(
      await page.locator("[data-points-history]").innerText(),
      /ワークの学習記録/,
    );
    await page.getByRole("button", { name: "獲得方法", exact: true }).click();
    assert.match(await page.locator(".points-methods").innerText(), /どの方法で答えても1単語2pt/);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS " +
        type.name() +
        ": card participation without per-swipe cloud writes, live measured time, idle rollback, individual workbook rewards, reset/bulk dedup and point methods",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
