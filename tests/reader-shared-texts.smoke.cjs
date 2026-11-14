// みんなの長文: a saved passage is published with the save (switch on), others read it from the list only after pressing the button
// (10 per page), read it without any analysis, put it on their own shelf or hide it, and the maker can take it back.
const { chromium } = require("playwright"), assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }), errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => { localStorage.setItem("b3_tutorial_done", "1"); localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false })); });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true && window.ReaderShared && window.renderBookshelf);
    await page.evaluate(() => {
      window.__docs = new Map(); window.__reads = 0;
      window.db = {};
      window.fbDoc = (_, ...p) => ({ path: p.join("/") });
      window.fbCollection = window.fbDoc;
      window.fbOrderBy = (field, dir) => ({ order: [field, dir] });
      window.fbLimit = (n) => ({ limit: n });
      window.fbStartAfter = (d) => ({ after: d });
      window.fbQuery = (ref, ...c) => ({ ref, c });
      const snapOf = (path) => ({ id: path.split("/").pop(), data: () => structuredClone(__docs.get(path)), exists: () => __docs.has(path) });
      window.fbGetDocs = async (q) => {
        const ref = q.ref || q, cs = q.c || [];
        if (/^sharedReaderTexts/.test(ref.path)) __reads++;
        let paths = [...__docs.keys()].filter((p) => p.startsWith(ref.path + "/") && p.split("/").length === ref.path.split("/").length + 1);
        for (const c of cs) {
          if (c.order) paths.sort((a, b) => __docs.get(b)[c.order[0]] - __docs.get(a)[c.order[0]]);
          if (c.after) paths = paths.slice(paths.indexOf(c.after.ref.path) + 1);
          if (c.limit) paths = paths.slice(0, c.limit);
        }
        return { docs: paths.map((p) => ({ ...snapOf(p), ref: { path: p } })) };
      };
      window.fbRunTransaction = async (_, cb) => cb({ get: async (ref) => snapOf(ref.path), set: (ref, value) => { __docs.set(ref.path, structuredClone(value)); } });
      window.fbDeleteDoc = async (ref) => { __docs.delete(ref.path); };
      window.__as = (id, name) => { myId = id; myName = name; ["aiglish_reader_shared_hidden", "aiglish_reader_texts_mine"].forEach((k) => localStorage.removeItem(k)); };
    });
    const shared = () => page.evaluate(() => [...__docs.entries()].filter(([k]) => /^sharedReaderTexts\//.test(k)));
    const TEXT = "Plastic waste is a serious problem in the ocean. Many animals suffer from it.\n\nGovernments and companies must act now to reduce it.";
    await page.locator("#nav-reader").click();
    await page.locator("#readerTabBtnBookshelf").click();
    const shelf = page.locator("#myBookshelfContainer");

    // A guest has no みんなの長文.
    await page.evaluate(() => window.renderBookshelf());
    assert.equal(await shelf.locator(".shelf-entry", { hasText: "みんなの長文" }).count(), 0);

    // U1 saves a passage with the switch on: it is published once, with the title and the name.
    await page.evaluate(() => __as("U1", "たろう"));
    await page.evaluate((text) => window.showCustomSaveBookshelfPrompt(text, "第1問 環境", null), TEXT);
    const box = page.locator("dialog .shelf-share input");
    await box.waitFor();
    assert.equal(await box.isChecked(), true);
    await page.locator("#confirmSaveBookshelfBtn").click();
    await page.locator("dialog.app-alert button").first().click();
    await page.waitForFunction(() => [...__docs.keys()].some((k) => /^sharedReaderTexts\//.test(k)));
    let docs = await shared();
    assert.equal(docs.length, 1);
    assert.deepEqual([docs[0][1].v, docs[0][1].by, docs[0][1].name, docs[0][1].title, docs[0][1].text], [1, "U1", "たろう", "第1問 環境", TEXT]);
    // Saving the same text again does not publish a second one.
    assert.equal(await page.evaluate((t) => ReaderShared.publishText("x", t), TEXT), "exists");

    // The shelf: 本文を読む (no analysis) and the publish toggle in the ⋯ menu.
    await page.evaluate(() => { window.renderBookshelf(); });
    await shelf.locator(".shelf-entry", { hasText: "未分類" }).locator(".textbook-list-item").click();
    await shelf.locator(".shelf-entry", { hasText: "第1問 環境" }).locator(".vocab-library-manage-button").click();
    await page.getByRole("button", { name: "本文を読む" }).click();
    await page.locator(".rt-body p").first().waitFor();
    assert.equal(await page.locator(".rt-body p").count(), 2);
    assert.match(await page.locator(".rt-body").innerText(), /Plastic waste[\s\S]*Governments/);
    await page.getByRole("button", { name: "閉じる" }).last().click();

    // Another person: 20 passages are there. Nothing is read until the button is pressed; 10 per page.
    await page.evaluate(() => {
      for (let i = 0; i < 12; i++) __docs.set("sharedReaderTexts/seed" + i, { v: 1, by: "S" + i, name: "ゲスト" + i, title: "共有" + i, text: "Seed passage number " + i + " is long enough to read. It has two sentences.", at: 1000 + i });
      __as("U2", "はなこ");
      window.renderBookshelf();
    });
    await shelf.locator(".shelf-header .shelf-back").click().catch(() => {});
    await page.evaluate(() => { currentShelfView = "list"; window.renderBookshelf(); });
    await shelf.locator(".shelf-entry", { hasText: "みんなの長文" }).locator(".textbook-list-item").click();
    await shelf.getByRole("button", { name: "みんなの長文を読み込む" }).waitFor();
    assert.equal(await page.evaluate(() => __reads), 0, "nothing read yet");
    await shelf.getByRole("button", { name: "みんなの長文を読み込む" }).click();
    await shelf.locator(".shelf-entry").first().waitFor();
    assert.equal(await shelf.locator(".shelf-entry").count(), 10);
    assert.equal(await page.evaluate(() => __reads), 1);
    assert.match(await shelf.locator(".shelf-entry").first().innerText(), /第1問 環境[\s\S]*たろうさん/, "newest first");
    await shelf.getByRole("button", { name: "もっと見る" }).click();
    await page.waitForFunction(() => document.querySelectorAll("#myBookshelfContainer .shelf-entry").length === 13);
    assert.equal(await page.evaluate(() => __reads), 2);

    // Read one, put it on the shelf.
    await shelf.locator(".shelf-entry", { hasText: "第1問 環境" }).locator(".textbook-list-item").click();
    await page.locator(".rt-body p").first().waitFor();
    assert.match(await page.locator(".rt-meta").innerText(), /たろうさんが公開/);
    // (already on this device's shelf: it says so and closes)
    await page.getByRole("button", { name: "自分の本棚に入れる" }).click();
    await page.waitForFunction(() => !document.querySelector("dialog.library-editor-dialog[open]"));
    await shelf.locator(".shelf-entry", { hasText: "共有5" }).locator(".textbook-list-item").click();
    await page.getByRole("button", { name: "自分の本棚に入れる" }).click();
    await page.waitForFunction(() => myBookshelf.some((i) => i.title === "共有5" && i.text.startsWith("Seed passage number 5")));
    // Hide another one for good.
    await shelf.locator(".shelf-entry", { hasText: "共有3" }).locator(".textbook-list-item").click();
    await page.getByRole("button", { name: "見えなくする" }).click();
    await page.evaluate(() => { currentShelfView = "shared"; window.renderBookshelf(); });
    // (redrawn from what was already read: no second reading)
    await page.waitForFunction(() => document.querySelectorAll("#myBookshelfContainer .shelf-entry").length >= 9);
    assert.equal(await page.evaluate(() => __reads), 2);
    assert.equal(await shelf.locator(".shelf-entry", { hasText: "共有3" }).count(), 0);

    // The maker takes it back.
    await page.evaluate(() => { __as("U1", "たろう"); ReaderShared.hideText && 0; localStorage.setItem("aiglish_reader_texts_mine", JSON.stringify([...__docs.keys()].filter((k) => !k.includes("seed")).map((k) => k.split("/")[1]))); currentShelfView = "shared"; window.renderBookshelf(); });
    await shelf.locator(".shelf-entry", { hasText: "第1問 環境" }).locator(".textbook-list-item").click();
    await page.getByRole("button", { name: "公開をやめる" }).click();
    await page.waitForFunction(() => ![...__docs.keys()].some((k) => !k.includes("seed") && /^sharedReaderTexts\//.test(k)));
    assert.deepEqual(errors, []);
    console.log("reader shared texts smoke passed");
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
