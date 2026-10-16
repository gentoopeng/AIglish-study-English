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
    await page.goto("http://127.0.0.1:8000");
    await page
      .getByRole("button", { name: "ゲストとしてテストプレイ" })
      .click();
    await page.waitForFunction(() => window.__learningBootReady);
    const result = await page.evaluate(async () => {
      myId = "sync-budget";
      localStorage.setItem("core_v4_userId", myId);
      currentTextbook = "sync-book";
      window.db = {};
      const docs = new Map(),
        reads = [],
        writes = [];
      window.fbDoc = (_, ...parts) => ({ path: parts.join("/") });
      window.fbSetDoc = async (ref, data, opts) => {
        writes.push(ref.path);
        docs.set(
          ref.path,
          opts?.merge ? { ...docs.get(ref.path), ...data } : data,
        );
      };
      window.fbGetDoc = async (ref) => {
        reads.push(ref.path);
        return {
          exists: () => docs.has(ref.path),
          data: () => docs.get(ref.path),
        };
      };
      window.fbRunTransaction = async (_, fn) =>
        fn({
          get: window.fbGetDoc,
          set: (ref, data, opts) => {
            writes.push(ref.path);
            docs.set(
              ref.path,
              opts?.merge ? { ...docs.get(ref.path), ...data } : data,
            );
          },
        });
      window.fbSetDocsProtected = undefined;
      window.saveUserStats = () => {};
      window.syncRankingMetrics = () => {};
      window.recordRankedWord = () => {};
      textbooksPool = [{ id: currentTextbook, name: "同期テスト" }];
      vocabList = migrateVocabData([
        { num: 1, word: "study", meaning: "学ぶ" },
      ]);
      vocabList[0].note = "keep";
      vocabList[0].sticky = true;
      LearningData.finish(LearningData.begin(currentTextbook));
      for (let i = 0; i < 100; i++) {
        updateMeaningStatus(
          1,
          vocabList[0].meanings[0].id,
          i % 2 ? "ok" : "bad",
        );
        await saveUserVocabProgress();
      }
      for (let i = 0; i < 10; i++) await flushChangedVocabData();
      await AppStorage.flush();
      const before = {
        reads: reads.length,
        writes: writes.length,
        status: LearningData.read(currentTextbook)[1].status,
      };
      await __backgroundSaveAll();
      const progressPath = "users/sync-budget/vocabProgress/sync-book",
        count = () => reads.filter((path) => path === progressPath).length;
      const first = count();
      await __backgroundSaveAll();
      const unchanged = count() - first;
      updateMeaningStatus(1, vocabList[0].meanings[0].id, "bad");
      await saveUserVocabProgress();
      await __backgroundSaveAll();
      const edited = count() - first;
      window.__vocabProgressCloudChecks = {};
      const base = reads.length;
      await loadUserVocabProgress("sync-book");
      await loadUserVocabProgress("sync-book");
      await loadUserVocabProgress("sync-book");
      const repeatedLoads = reads.length - base;
      const latest = LearningData.read("sync-book")[1];
      return {
        before,
        first,
        unchanged,
        edited,
        repeatedLoads,
        note: latest.note,
        sticky: latest.sticky,
        status: latest.status,
        cloud: JSON.parse(docs.get(progressPath).wordsJson)[1].status,
        dirty: Object.keys(__dirtyVocabProgress),
      };
    });
    assert.deepEqual(result.before, { reads: 0, writes: 0, status: "ok" });
    assert.equal(result.first, 1);
    assert.equal(result.unchanged, 0);
    assert.equal(result.edited, 1);
    assert.equal(result.repeatedLoads, 1);
    assert.equal(result.status, "bad");
    assert.equal(result.note, "keep");
    assert.equal(result.sticky, true);
    assert.equal(result.cloud, "bad");
    assert.deepEqual(result.dirty, []);
    await page.reload();
    await page.waitForFunction(() => window.__learningBootReady);
    assert.equal(
      await page.evaluate(() => LearningData.read("sync-book")[1].status),
      "bad",
    );
    assert.deepEqual(errors, []);
    console.log("PASS", type.name(), JSON.stringify(result));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
