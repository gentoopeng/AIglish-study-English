// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/shared-book-refresh.smoke.cjs
// A device that already has a distributed book gets the admin's later changes: when the book's
// entry in the shared index is newer than the device's copy, opening the book (or the app, with
// the book open) reads its words once; ratings and notes stay; an unchanged book costs no read.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
    });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.evaluate(() => {
      // This device opened the book before: its copy and a rating with a note on word 1.
      const old = [{ num: 1, word: "follow", meaning: "従う", meanings: [{ id: "1-0", text: "従う" }] }, { num: 2, word: "apple", meaning: "りんご" }];
      localStorage.setItem("core_v4_cache_shared-1", JSON.stringify(old));
      window.__docs = new Map([
        ["shared/textbooks_index", { textbooks: [{ id: "shared-1", name: "配信単語", updatedAt: "2026-10-27T07:00:00.000Z" }] }],
        ["shared/vocab_shared-1", { custom_words: [{ num: 1, word: "follow", meaning: "〜に従う", meanings: [{ id: "1-0", text: "〜に従う" }, { id: "1-1", text: "〜の後に続く" }] }, { num: 2, word: "apple", meaning: "りんご", unit: "果物" }] }],
      ]);
      window.__reads = [];
      window.db = {};
      window.fbDoc = (_, ...parts) => ({ path: parts.join("/") });
      window.fbGetDoc = async (ref) => (__reads.push(ref.path), { exists: () => __docs.has(ref.path), data: () => structuredClone(__docs.get(ref.path) || {}) });
      window.fbSetDoc = async () => {};
      window.fbRunTransaction = async (_, fn) => {
        const writes = [];
        const r = await fn({ get: window.fbGetDoc, set: (ref, data, o) => writes.push([ref.path, JSON.parse(JSON.stringify(data)), o?.merge]) });
        for (const [path, data, merge] of writes) __docs.set(path, merge ? { ...(__docs.get(path) || {}), ...data } : data);
        return r;
      };
    });
    await page.evaluate(() => {
      const key = window.getVocabProgressStorageKey("shared-1");
      localStorage.setItem(key, JSON.stringify({ 1: { sig: window.buildWordSignature({ num: 1, word: "follow", meanings: [{ text: "従う" }] }), status: "ok", note: "メモ", sticky: true, meanings: { "1-0": { status: "ok", history: ["ok"] } } } }));
      window.__reads = [];
    });
    // The index read at start (which may open this book as the first one).
    await page.evaluate(() => window.syncTextbooksIndexFromFirestore());
    await page.locator("#nav-vocab").click();
    await page.evaluate(() => window.renderVocabLibrarySelection());
    await page.locator("#vocabLibraryBooks .textbook-list-item", { hasText: "配信単語" }).click();
    await page.waitForFunction(() => currentTextbook === "shared-1" && vocabList.length === 2 && !window.__vocabSelectionRequest);
    const opened = await page.evaluate(() => ({
      words: vocabList.map((w) => [w.word, w.meanings.map((m) => m.text).join("|"), w.unit || ""]),
      rating: vocabList[0].meanings[0].status,
      note: vocabList[0].note,
      reads: __reads.filter((p) => p.startsWith("shared/vocab_")),
    }));
    assert.deepEqual(opened.words, [["follow", "〜に従う|〜の後に続く", ""], ["apple", "りんご", "果物"]]);
    assert.equal(opened.rating, "ok");
    assert.equal(opened.note, "メモ");
    // Read once, whether at start or on opening.
    assert.deepEqual(opened.reads, ["shared/vocab_shared-1"]);
    // Opening again: nothing new, no read.
    await page.evaluate(async () => { __reads = []; await window.loadCurrentTextbookData(); });
    assert.deepEqual(await page.evaluate(() => __reads.filter((p) => p.startsWith("shared/vocab_"))), []);
    // The admin changes it again; the app start (index read) brings it to the open book.
    await page.evaluate(async () => {
      __docs.get("shared/vocab_shared-1").custom_words[1].word = "apples";
      __docs.get("shared/textbooks_index").textbooks[0].updatedAt = "2026-10-27T08:00:00.000Z";
      await window.syncTextbooksIndexFromFirestore();
    });
    await page.waitForFunction(() => vocabList[1]?.word === "apples");
    assert.equal(await page.evaluate(() => vocabList[0].meanings[0].status), "ok");
    // The admin's own save stamps this device too, so it does not read its own change back.
    await page.evaluate(async () => { __reads = []; await window.__touchSharedBook("shared-1"); await window.loadCurrentTextbookData(); });
    assert.deepEqual(await page.evaluate(() => __reads.filter((p) => p.startsWith("shared/vocab_"))), []);
    assert.deepEqual(errors, []);
    console.log("PASS: a device with an old copy of a distributed book reads the admin's changes once when the index says so, keeps ratings and notes, no read when unchanged, the open book catches up at start, the admin's own save needs no read");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
