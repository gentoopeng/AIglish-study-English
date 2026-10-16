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
    const page = await browser.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.clock.install();
    await page.goto("http://127.0.0.1:8000");
    await page
      .getByRole("button", { name: "ゲストとしてテストプレイ" })
      .click();
    await page.waitForFunction(() => window.__learningBootReady);
    await page.evaluate(() => {
      myId = "end-save";
      localStorage.setItem("core_v4_userId", myId);
      currentTextbook = "end-book";
      textbooksPool = [{ id: currentTextbook, name: "終了時保存" }];
      vocabList = migrateVocabData([
        { num: 1, word: "study", meaning: "学ぶ" },
      ]);
      LearningData.finish(LearningData.begin(currentTextbook));
      window.db = {};
      window.__endDocs = new Map();
      window.__endWrites = [];
      window.__endSaves = 0;
      window.fbDoc = (_, ...parts) => ({ path: parts.join("/") });
      window.fbSetDoc = async (ref, data, options) => {
        __endWrites.push(ref.path);
        __endDocs.set(
          ref.path,
          options?.merge ? { ...__endDocs.get(ref.path), ...data } : data,
        );
      };
      window.fbGetDoc = async (ref) => ({
        exists: () => __endDocs.has(ref.path),
        data: () => __endDocs.get(ref.path),
      });
      window.fbSetDocsProtected = undefined;
      window.fbRunTransaction = async (_, fn) =>
        fn({ get: window.fbGetDoc, set: window.fbSetDoc });
      const real = window.__backgroundSaveAll;
      window.__backgroundSaveAll = async () => {
        __endSaves++;
        return real();
      };
      document.body.classList.add("in-game-active");
      for (let i = 0; i < 100; i++) {
        updateMeaningStatus(
          1,
          vocabList[0].meanings[0].id,
          i % 2 ? "ok" : "bad",
        );
        noteFlashSwipe();
      }
      IdleSleep.activity();
    });
    await page.clock.runFor(180000);
    assert.equal(
      await page.evaluate(() => __endWrites.length),
      0,
      "no progress, ranking or profile cloud saves during play",
    );
    assert.equal(await page.evaluate(() => __endSaves), 0);
    assert.equal(
      await page.evaluate(() => LearningData.read("end-book")[1].status),
      "ok",
    );
    await page.evaluate(async () => {
      document.body.classList.remove("in-game-active");
      await Promise.all([flushFlashAutosave(), saveAfterStudy("flash-end")]);
      IdleSleep.activity();
    });
    assert.equal(await page.evaluate(() => __endSaves), 1);
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(
            __endDocs.get("users/end-save/vocabProgress/end-book").wordsJson,
          )[1].status,
      ),
      "ok",
    );
    await page.clock.runFor(180000);
    assert.equal(
      await page.evaluate(() => __endSaves),
      1,
      "no periodic backup after completion",
    );
    await page.evaluate(() => {
      document.body.classList.add("in-game-active");
      updateMeaningStatus(1, vocabList[0].meanings[0].id, "bad");
      IdleSleep.activity();
    });
    await page.clock.runFor(310000);
    await page.waitForFunction(() => __endSaves === 2);
    await page.waitForFunction(
      () =>
        document.querySelector("#idleSleepOverlay small")?.textContent ===
        "計測を停止しました。",
    );
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(
            __endDocs.get("users/end-save/vocabProgress/end-book").wordsJson,
          )[1].status,
      ),
      "bad",
    );
    await page.clock.runFor(60000);
    assert.equal(await page.evaluate(() => __endSaves), 2);
    assert.deepEqual(errors, []);
    console.log(
      "PASS",
      type.name(),
      "three minutes of flash updates have zero cloud writes; one completion save; no periodic follow-up; one sleep save with newest answer",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
