// The device's big-value store (IndexedDB) refuses the full backup (too big for what is left): the bookshelf must still be written.
// It used to wait behind the backup in one failing batch for the rest of the session, and a restart showed the old bookshelf.
// Also: a shelf that cannot be written at all is not marked as the newer copy.
const { chromium } = require("playwright"), assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    page.on("dialog", (d) => d.accept());
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      // The store takes no value over __limit characters.
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (value, key) {
        const limit = Number(sessionStorage.getItem("__limit")) || 200000;
        if (typeof value === "string" && value.length > limit) { try { this.transaction.abort(); } catch (e) {} throw new DOMException("full", "QuotaExceededError"); }
        return put.call(this, value, key);
      };
    });
    await page.goto("http://127.0.0.1:8000");
    await page.evaluate(() => {
      const pad = "x".repeat(35000), mk = (id, t) => ({ id, folder: "", title: t, text: t + " text here. ", aiAnalysisData: { sentences: [{ text: pad, translation: pad, grammarHighlights: [] }] } });
      const shelf = [mk(1767225600001, "A"), mk(1767225600002, "B")];
      localStorage.setItem("core_v4_userId", "shelf-user");
      localStorage.setItem("myBookshelf", JSON.stringify(shelf));
      localStorage.setItem("myFolders", '["未分類"]');
      localStorage.setItem("textHistory", "[]");
      localStorage.setItem("aiglish_reader_local", JSON.stringify({ owner: "shelf-user", at: Date.now() - 86400000 }));
      localStorage.setItem("save_studio_shelf-user_main", JSON.stringify({ slot: "main", savedAt: new Date(Date.now() - 80000000).toISOString(), data: { localStorage: { myFolders: '["未分類"]', textHistory: "[]" }, memory: { myBookshelf: shelf, myFolders: ["未分類"], textHistory: [] } } }));
    });
    await page.evaluate(() => window.AppStorage.flush());
    const start = async () => {
      await page.reload();
      await page.waitForFunction(() => window.__gameSaveLoadedFor === "shelf-user" && window.__learningBootReady === true, null, { timeout: 40000 });
      await page.waitForTimeout(1000);
      return page.evaluate(() => myBookshelf.map((i) => i.title));
    };
    const save = async (title) => {
      await page.evaluate((t) => window.showCustomSaveBookshelfPrompt(t + " text here. " + "y".repeat(100), t, null), title);
      await page.locator("#confirmSaveBookshelfBtn").click();
      await page.locator("dialog.app-alert button").first().click();
      await page.waitForTimeout(6000); // the backup follows 1.5 seconds later (the full save is about 280,000 characters: refused)
    };
    assert.deepEqual(await start(), ["A", "B"]);
    await save("C");
    await save("D");
    assert.equal(await page.evaluate(() => window.AppStorage.pending), 0, "nothing is left waiting behind the backup");
    assert.deepEqual(await start(), ["A", "B", "C", "D"], "both texts are still there after a restart");

    // The shelf itself does not fit any more: the texts alone are written (the analyses are let go, and it says so).
    await page.evaluate(() => { sessionStorage.setItem("__limit", "100000"); window.__toasts = []; const real = window.showToast; window.showToast = (text, kind) => { window.__toasts.push(String(text)); return real && real(text, kind); }; });
    await save("E");
    assert.ok((await page.evaluate(() => window.__toasts)).some((t) => /解析結果は端末に保存できませんでした/.test(t)), "it says the analyses were not kept");
    assert.deepEqual(await start(), ["A", "B", "C", "D", "E"]);

    // Nothing of the shelf can be written: the device copy is not marked as the newer one.
    // (the start above sends the merged shelf to the backup once, 4 seconds in, and that marks the device copy: let it pass first)
    await page.waitForTimeout(5000);
    await page.evaluate(() => {
      window.saveAfterStudy = async () => ({ cloudSaved: true });
      localStorage.setItem("aiglish_reader_local", JSON.stringify({ owner: "shelf-user", at: 5 }));
      const big = "z".repeat(70000);
      window.showCustomSaveBookshelfPrompt(big + " One sentence here.", "F", null);
      sessionStorage.setItem("__limit", "1000");
    });
    await page.locator("#confirmSaveBookshelfBtn").click();
    await page.locator("dialog.app-alert button").first().click();
    await page.waitForTimeout(2500);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("aiglish_reader_local")).at), 5);
    console.log("reader shelf device full smoke passed");
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
