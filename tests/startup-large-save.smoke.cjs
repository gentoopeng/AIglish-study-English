const { chromium, webkit } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const useWebkit = process.env.BROWSER === "webkit";
  const browser = await (useWebkit ? webkit : chromium).launch(
    useWebkit
      ? { executablePath: process.env.WEBKIT_EXECUTABLE_PATH }
      : { executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] },
  );
  try {
    const page = await browser.newPage({
      viewport: { width: 393, height: 852 },
      deviceScaleFactor: 3,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1",
    });
    await page.route("https://**/*", (r) => r.abort());
    await page.route("**/seed", (r) =>
      r.fulfill({ contentType: "text/html", body: "seed" }),
    );
    await page.goto("http://127.0.0.1:8000/seed");
    console.log(
      await page.evaluate(async () => {
        localStorage.setItem("core_v4_userId", "stress");
        localStorage.setItem("core_v4_userName", "検証");
        localStorage.setItem("core_v4_current_textbook_id", "book0");
        const books = {},
          pool = [];
        for (let b = 0; b < 12; b++) {
          const master = Array.from({ length: 2000 }, (_, i) => ({
            num: i + 1,
            word: "word-" + b + "-" + i,
            meaning: "意味" + i,
            sub: "補足" + String(i).repeat(70),
          }));
          books["book" + b] = {
            master,
            progress: { 1: { status: "ok" } },
            savedAt: "2026-10-17T00:00:00Z",
          };
          pool.push({ id: "book" + b, name: "検証" + b });
        }
        const raw = JSON.stringify({
          savedAt: "2026-10-17T00:00:00Z",
          data: {
            localStorage: {},
            memory: {
              myName: "検証",
              currentTextbook: "book0",
              textbooksPool: pool,
              vocabBookKey: "book0",
              vocabMaster: books.book0.master,
              vocabProgress: books.book0.progress,
              vocabBooks: books,
            },
          },
        });
        await new Promise((resolve, reject) => {
          const r = indexedDB.open("aiglish-local-values", 1);
          r.onupgradeneeded = () => r.result.createObjectStore("values");
          r.onsuccess = () => {
            const tx = r.result.transaction("values", "readwrite");
            tx.objectStore("values").put(raw, "save_studio_stress_main");
            tx.oncomplete = resolve;
            tx.onabort = reject;
          };
        });
        return { rawBytes: raw.length };
      }),
    );
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("crash", () => errors.push("CRASH"));
    const start = Date.now();
    await page.goto("http://127.0.0.1:8000/");
    await page.waitForFunction(() => window.__learningBootReady, {
      timeout: 90000,
    });
    await page.waitForTimeout(1000);
    if (!useWebkit) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("HeapProfiler.collectGarbage");
    }
    console.log({
      startupMs: Date.now() - start,
      ...(await page.evaluate(() => ({
        cached: Object.keys(textbooksCacheMap),
        drafts: Object.keys(__manualVocabDrafts),
        words: vocabList.length,
        pending: !!__pendingGameSaveMemory,
        heap: performance.memory?.usedJSHeapSize,
        errors: AppErrors.snapshot(),
      }))),
      pageErrors: errors,
    });
    assert.deepEqual(
      await page.evaluate(() => Object.keys(textbooksCacheMap)),
      ["book0"],
    );
    assert.deepEqual(
      await page.evaluate(() => Object.keys(__manualVocabDrafts)),
      ["book0"],
    );
    assert.equal(await page.evaluate(() => __pendingGameSaveMemory), null);
    for (let b = 1; b < 12; b++)
      assert.deepEqual(
        await page.evaluate((b) => {
          const draft = JSON.parse(
            localStorage.getItem(__manualVocabLocalKey("book" + b)),
          );
          return {
            length: draft.master.length,
            word: draft.master[1999].word,
            status: LearningData.read("book" + b)[1].status,
            duplicate: localStorage.getItem(
              "core_v4_custom_words_stress_book" + b,
            ),
          };
        }, b),
        {
          length: 2000,
          word: "word-" + b + "-1999",
          status: "ok",
          duplicate: null,
        },
      );
    assert.equal(
      await page.evaluate(
        () => Object.keys(__collectGameSaveData().memory.vocabBooks).length,
      ),
      12,
    );
    await page.evaluate(async () => {
      currentTextbook = "book11";
      await loadCurrentTextbookData();
    });
    assert.equal(
      await page.evaluate(() => vocabList[1999].word),
      "word-11-1999",
    );
    assert.equal(
      await page.evaluate(() => currentUserVocabProgress[1].status),
      "ok",
    );
    await page.evaluate(() =>
      updateMeaningStatus(1, vocabList[0].meanings[0].id, "bad"),
    );
    assert.equal(
      await page.evaluate(() => LearningData.read("book11")[1].status),
      "bad",
    );
    await page.evaluate(() => AppStorage.flush());
    await page.reload();
    await page.waitForFunction(() => window.__learningBootReady, {
      timeout: 90000,
    });
    assert.equal(
      await page.evaluate(() => LearningData.read("book11")[1].status),
      "bad",
    );
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem(__manualVocabLocalKey("book11")))
            .master.length,
      ),
      2000,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: 24,000-word legacy save retains only active master; other masters/progress durable, offline open and newer learning survive reload",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
