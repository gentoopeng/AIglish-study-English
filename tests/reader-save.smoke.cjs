// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/reader-save.smoke.cjs
// Bookshelf texts saved after the last full backup survive a restart, and a bookshelf change
// starts a backup by itself.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => localStorage.setItem("b3_tutorial_done", "1"));
    await page.goto("http://127.0.0.1:8000");
    // A backup from before the text was saved, and the device copy with the text in it.
    const restart = async (owner) => {
      await page.evaluate((owner) => {
        localStorage.setItem("core_v4_userId", "shelf-user");
        localStorage.setItem(
          "save_studio_shelf-user_main",
          JSON.stringify({ slot: "main", savedAt: "2026-01-01T00:00:00.000Z", data: { localStorage: {}, memory: { myBookshelf: [], myFolders: ["未分類"], textHistory: [] } } }),
        );
        localStorage.setItem("myBookshelf", JSON.stringify([{ id: 1767225600000, folder: "模試", title: "第1問", text: "Hello world.", aiAnalysisData: null }]));
        localStorage.setItem("myFolders", JSON.stringify(["未分類", "模試"]));
        localStorage.setItem("textHistory", JSON.stringify([{ id: 1767225600000, title: "第1問", text: "Hello world." }]));
        localStorage.setItem("aiglish_reader_local", JSON.stringify({ owner, at: Date.now() }));
      }, owner);
      await page.reload();
      await page.waitForFunction(() => window.__gameSaveLoadedFor === "shelf-user" && !window.__pendingGameSaveMemory, null, { timeout: 30000 });
      return page.evaluate(() => ({ shelf: myBookshelf.map((i) => i.title), folders: myFolders, history: textHistory.length }));
    };
    // This account changed them after the backup: the device copy is kept.
    assert.deepEqual(await restart("shelf-user"), { shelf: ["第1問"], folders: ["未分類", "模試"], history: 1 });
    // Another account wrote the device keys: the backup is used.
    assert.deepEqual(await restart("someone-else"), { shelf: [], folders: ["未分類"], history: 0 });

    // Broken entries saved by older versions are skipped instead of stopping the start.
    await page.evaluate(() => {
      localStorage.setItem("myBookshelf", JSON.stringify([null, 3, { id: 2, folder: "模試", title: "第2問", text: "Hi." }]));
      localStorage.setItem("myFolders", JSON.stringify(["未分類", null, "模試"]));
      localStorage.setItem("textHistory", JSON.stringify({}));
      localStorage.setItem("aiglish_reader_local", JSON.stringify({ owner: "shelf-user", at: Date.now() }));
    });
    await page.reload();
    await page.waitForFunction(() => window.__gameSaveLoadedFor === "shelf-user" && !window.__pendingGameSaveMemory, null, { timeout: 30000 });
    await page.waitForTimeout(1000);
    assert.deepEqual(errors, []);
    assert.deepEqual(await page.evaluate(() => ({ shelf: myBookshelf.map((i) => i.title), folders: myFolders, history: textHistory })), { shelf: ["第2問"], folders: ["未分類", "模試"], history: [] });
    assert.equal(await page.locator("#b3ErrToast.show").count(), 0);

    // A bookshelf change starts a backup after a short pause.
    const saves = await page.evaluate(async () => {
      myId = "shelf-user";
      let count = 0;
      window.saveAfterStudy = async (reason) => {
        count += reason === "reader-shelf" ? 1 : 0;
        return { cloudSaved: true };
      };
      window.markReaderDataChanged();
      window.markReaderDataChanged();
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return { count, mark: JSON.parse(localStorage.getItem("aiglish_reader_local")).owner };
    });
    assert.deepEqual(saves, { count: 1, mark: "shelf-user" });
    assert.deepEqual(errors, []);
    console.log("PASS: bookshelf saved after the last backup survives a restart, other accounts' device copy is not used, a change starts a backup");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
