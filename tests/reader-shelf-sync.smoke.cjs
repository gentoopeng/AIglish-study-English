// The reader's shelf is merged with the backup at start (not replaced by whichever copy looks newer): a text saved stays and a text
// deleted stays deleted, when the device copy is the old one (a device write that failed) and when an old copy was marked as newer.
// A delete leaves a tombstone; a device write that fails does not mark the device copy as the newer one.
const { chromium } = require("playwright"), assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }), errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => localStorage.setItem("b3_tutorial_done", "1"));
    await page.goto("http://127.0.0.1:8000");
    const T = (id, title, text) => ({ id, folder: "", title, text, aiAnalysisData: null });
    const A = T(1767225600001, "残す", "Keep me here."), Y = T(1767225600002, "消した", "Deleted one."), X = T(1767225600003, "保存した", "Saved one.");
    const ids = (list) => list.map((i) => String(i.id));
    const restart = async ({ device, deviceDeleted, markAt, backupShelf, backupStored, backupDeleted, savedAt }) => {
      await page.evaluate((a) => {
        const meta = (ids) => JSON.stringify({ v: 2, ids, owner: "shelf-user" });
        localStorage.setItem("core_v4_userId", "shelf-user");
        localStorage.setItem("save_studio_shelf-user_main", JSON.stringify({ slot: "main", savedAt: a.savedAt, data: {
          localStorage: { myBookshelf: JSON.stringify(a.backupStored), myFolders: '["未分類"]', textHistory: "[]", aiglish_shelf_meta: meta(a.backupStored.map((i) => String(i.id))), aiglish_shelf_deleted: JSON.stringify(a.backupDeleted) },
          memory: { myBookshelf: a.backupShelf, myFolders: ["未分類"], textHistory: [] } } }));
        localStorage.setItem("myBookshelf", JSON.stringify(a.device));
        localStorage.setItem("myFolders", '["未分類"]');
        localStorage.setItem("aiglish_shelf_meta", meta(a.device.map((i) => String(i.id))));
        localStorage.setItem("aiglish_shelf_deleted", JSON.stringify(a.deviceDeleted));
        localStorage.setItem("aiglish_reader_local", JSON.stringify({ owner: "shelf-user", at: a.markAt }));
      }, { device, deviceDeleted, markAt, backupShelf, backupStored, backupDeleted, savedAt });
      await page.reload();
      await page.waitForFunction(() => window.__gameSaveLoadedFor === "shelf-user" && !window.__pendingGameSaveMemory, null, { timeout: 30000 });
      return page.evaluate(() => ({ shelf: myBookshelf.map((i) => i.title), stored: JSON.parse(localStorage.getItem("myBookshelf")).map((i) => i.title), meta: JSON.parse(localStorage.getItem("aiglish_shelf_meta")).ids.length, dead: JSON.parse(localStorage.getItem("aiglish_shelf_deleted")).map((t) => String(t.id)) }));
    };
    const now = Date.now(), tomb = [{ id: Y.id, at: now - 60000 }];

    // 1. The device could not write (it is full): its copy is the old shelf, and it was not marked. The backup has the shelf as it was.
    let r = await restart({ device: [A, Y], deviceDeleted: tomb, markAt: now - 3600000, backupShelf: [A, X], backupStored: [A, Y], backupDeleted: tomb, savedAt: new Date(now - 30000).toISOString() });
    assert.deepEqual(r, { shelf: ["残す", "保存した"], stored: ["残す", "保存した"], meta: 2, dead: [String(Y.id)] });

    // 2. An old copy of the shelf was marked as the newer one (the old bug kept it whole): now the two are merged.
    r = await restart({ device: [A, Y], deviceDeleted: [], markAt: now, backupShelf: [A, X], backupStored: [A, X], backupDeleted: tomb, savedAt: new Date(now - 30000).toISOString() });
    assert.deepEqual(r, { shelf: ["残す", "保存した"], stored: ["残す", "保存した"], meta: 2, dead: [String(Y.id)] });

    // 3. This device saved a text after the backup (nothing deleted anywhere): both sides' texts are there, and the cloud gets the merged shelf.
    await page.evaluate(() => { window.__backups = 0; });
    r = await restart({ device: [A, X], deviceDeleted: [], markAt: now, backupShelf: [A, Y], backupStored: [A, Y], backupDeleted: [], savedAt: new Date(now - 30000).toISOString() });
    assert.deepEqual(r.shelf, ["残す", "保存した", "消した"]);
    // (the merged shelf goes to the cloud once, 4 seconds after the start: let that pass before the checks below)
    await page.waitForTimeout(4500);

    // 3b. A newer backup in the OLD form with an empty shelf (another device that never saved the shelf with this version) does not
    //     wipe this device's shelf; and a device copy that belongs to another account is not merged into this account's shelf.
    const oldForm = async (owner) => {
      await page.evaluate((a) => {
        localStorage.setItem("core_v4_userId", "shelf-user");
        localStorage.setItem("save_studio_shelf-user_main", JSON.stringify({ slot: "main", savedAt: new Date(Date.now() + 60000).toISOString(), data: { localStorage: { myBookshelf: "[]", myFolders: '["未分類"]', textHistory: "[]" }, memory: { myBookshelf: [], myFolders: ["未分類"], textHistory: [] } } }));
        localStorage.setItem("myBookshelf", JSON.stringify(a.device));
        localStorage.setItem("aiglish_shelf_meta", JSON.stringify({ v: 2, ids: a.device.map((i) => String(i.id)), owner: a.owner }));
        localStorage.setItem("aiglish_shelf_deleted", "[]");
        localStorage.removeItem("aiglish_shelf_lost");
        localStorage.setItem("aiglish_reader_local", JSON.stringify({ owner: "shelf-user", at: Date.now() - 3600000 }));
      }, { device: [A, X], owner });
      await page.reload();
      await page.waitForFunction(() => window.__gameSaveLoadedFor === "shelf-user" && !window.__pendingGameSaveMemory, null, { timeout: 30000 });
      return page.evaluate(() => ({ shelf: myBookshelf.map((i) => i.title), lost: (JSON.parse(localStorage.getItem("aiglish_shelf_lost") || "null") || { items: [] }).items.map((i) => i.title) }));
    };
    assert.deepEqual(await oldForm("shelf-user"), { shelf: ["残す", "保存した"], lost: [] });
    // Another account's copy on this device: the backup is used as before, and what was this account's by the mark is set aside, not lost.
    assert.deepEqual(await oldForm("someone-else"), { shelf: [], lost: ["残す", "保存した"] });
    // …and can be put back from the shelf.
    await page.evaluate(() => { myId = "shelf-user"; window.saveAfterStudy = async () => ({ cloudSaved: true }); });
    await page.locator("#nav-reader").click();
    await page.locator("#readerTabBtnBookshelf").click();
    await page.locator("#myBookshelfContainer .shelf-lost").getByRole("button", { name: "確認して戻す" }).click();
    await page.locator(".shelf-lost-row").first().waitFor();
    assert.equal(await page.locator(".shelf-lost-row").count(), 2);
    await page.getByRole("button", { name: "すべて戻す" }).click();
    await page.waitForFunction(() => myBookshelf.length === 2 && !localStorage.getItem("aiglish_shelf_lost"));
    assert.equal(await page.locator("#myBookshelfContainer .shelf-lost").count(), 0);
    r = await restart({ device: [A, X], deviceDeleted: [], markAt: now, backupShelf: [A, Y], backupStored: [A, Y], backupDeleted: [], savedAt: new Date(now - 30000).toISOString() });
    await page.waitForTimeout(4500);

    // 4. In the app: taking a text off the shelf leaves a tombstone and writes the id list.
    await page.evaluate(() => { myId = "shelf-user"; window.saveAfterStudy = async () => ({ cloudSaved: true }); });
    await page.locator("#nav-reader").click();
    await page.locator("#readerTabBtnBookshelf").click();
    const shelf = page.locator("#myBookshelfContainer");
    await shelf.locator(".shelf-entry", { hasText: "未分類" }).locator(".textbook-list-item").click();
    await shelf.locator(".shelf-entry", { hasText: "消した" }).locator(".vocab-library-manage-button").click();
    await page.getByRole("button", { name: "本棚から削除" }).click();
    await page.getByRole("button", { name: "削除する" }).click();
    await page.waitForFunction(() => !myBookshelf.some((i) => i.title === "消した"));
    const after = await page.evaluate(() => ({ dead: JSON.parse(localStorage.getItem("aiglish_shelf_deleted")).map((t) => String(t.id)), meta: JSON.parse(localStorage.getItem("aiglish_shelf_meta")).ids }));
    assert.ok(after.dead.includes(String(Y.id)));
    assert.deepEqual(after.meta.sort(), ids([A, X]).sort());

    // 5. A device write that fails does not mark the device copy as the newer one (the backup still goes out).
    const failed = await page.evaluate(async () => {
      let saves = 0;
      window.saveAfterStudy = async (reason) => { saves += reason === "reader-shelf" ? 1 : 0; return { cloudSaved: true }; };
      localStorage.setItem("aiglish_reader_local", JSON.stringify({ owner: "shelf-user", at: 5 }));
      const real = window.ReaderShelfMerge.meta;
      window.ReaderShelfMerge.meta = () => { throw new DOMException("full", "QuotaExceededError"); };
      myBookshelf.push({ id: Date.now(), folder: "", title: "書けない", text: "Cannot be written." });
      window.showCustomSaveBookshelfPrompt("Another text to save.", "もう1つ", null);
      document.getElementById("confirmSaveBookshelfBtn").click();
      await new Promise((resolve) => setTimeout(resolve, 2200));
      window.ReaderShelfMerge.meta = real;
      return { mark: JSON.parse(localStorage.getItem("aiglish_reader_local")).at, saves };
    });
    assert.deepEqual(failed, { mark: 5, saves: 1 });
    assert.deepEqual(errors, []);
    console.log("reader shelf sync smoke passed");
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
