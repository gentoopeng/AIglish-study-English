// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/shared-book-auto-refresh.smoke.cjs
// The creator's changes reach people who keep the app open: the shared index is read again every
// few minutes / when the app comes back / when the connection returns, but never as a guest, in a
// game, while hidden or offline, or while the cloud quota is paused. Editing a distributed book
// through publishVocabEntryMaster stamps the index so the copies follow.
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
    await page.waitForFunction(() => window.__learningBootReady === true && window.__autoRefreshBooks);
    await page.evaluate(() => {
      window.__docs = new Map([["shared/textbooks_index", { textbooks: [{ id: "shared-1", name: "配信", updatedAt: "2026-10-27T03:00:00.000Z" }] }]]);
      window.__reads = [];
      window.db = {};
      window.fbDoc = (_, ...parts) => ({ path: parts.join("/") });
      window.fbGetDoc = async (ref) => (__reads.push(ref.path), { exists: () => __docs.has(ref.path), data: () => structuredClone(__docs.get(ref.path) || {}) });
      window.fbGetDocs = async () => ({ docs: [] }); window.fbCollection = () => ({});
      window.fbSetDoc = async (ref, data, o) => __docs.set(ref.path, o?.merge ? { ...(__docs.get(ref.path) || {}), ...data } : data);
      window.fbRunTransaction = async (_, fn) => {
        const writes = [];
        const r = await fn({ get: window.fbGetDoc, set: (ref, data, o) => writes.push([ref.path, JSON.parse(JSON.stringify(data)), o?.merge]) });
        for (const [path, data, merge] of writes) __docs.set(path, o_merge(path, data, merge));
        return r;
      };
      function o_merge(path, data, merge) { return merge ? { ...(__docs.get(path) || {}), ...data } : data; }
    });
    const indexReads = () => page.evaluate(() => __reads.filter((p) => p === "shared/textbooks_index").length);
    const tick = async (gap) => {
      // Make the last check old enough, then ask.
      await page.evaluate(() => { window.__reads = []; });
      return page.evaluate((g) => window.__autoRefreshBooks(g), gap);
    };

    // A guest reads nothing.
    assert.equal(await page.evaluate(() => window.__autoRefreshBooks(false)), false);
    await page.evaluate(() => { myId = "reader"; });
    // Just checked a moment ago: too early for the timer.
    assert.equal(await page.evaluate(() => window.__autoRefreshBooks(false)), false);
    // Pretend ten minutes passed by waiting on the clock.
    await page.evaluate(() => { const real = Date.now; Date.now = () => real() + 11 * 60e3; window.__restoreNow = () => { Date.now = real; }; });
    assert.equal(await tick(false), true);
    await page.waitForFunction(() => __reads.includes("shared/textbooks_index"));
    assert.equal(await indexReads(), 1);

    // Right after, the timer does not read again; coming back to the app after a minute does.
    assert.equal(await tick(false), false);
    await page.evaluate(() => { const now = Date.now; Date.now = () => now() + 2 * 60e3; });
    assert.equal(await tick(true), true);

    // Not while a game is running, offline, hidden or quota-paused.
    await page.evaluate(() => { const now = Date.now; Date.now = () => now() + 11 * 60e3; document.body.classList.add("in-game-active"); });
    assert.equal(await tick(false), false);
    await page.evaluate(() => document.body.classList.remove("in-game-active"));
    await page.evaluate(() => { window.__paused = window.FirestoreReadGuard.paused; window.FirestoreReadGuard.paused = () => true; });
    assert.equal(await tick(false), false);
    await page.evaluate(() => { window.FirestoreReadGuard.paused = window.__paused; });
    assert.equal(await tick(false), true);

    // The creator's edit of a distributed book stamps the index.
    await page.evaluate(() => { window.__restoreNow(); window.isAdmin = true; });
    const stamped = await page.evaluate(async () => {
      const before = __docs.get("shared/textbooks_index").textbooks[0].updatedAt;
      await window.publishVocabEntryMaster("shared-1", [{ num: 1, word: "a", meaning: "あ" }], "reader");
      return { before, after: __docs.get("shared/textbooks_index").textbooks[0].updatedAt, words: __docs.get("shared/vocab_shared-1").custom_words.length };
    });
    assert.notEqual(stamped.after, stamped.before);
    assert.equal(stamped.words, 1);
    assert.deepEqual(errors, []);
    console.log("shared book auto refresh smoke passed");
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
