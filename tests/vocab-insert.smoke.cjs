// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/vocab-insert.smoke.cjs
// In a word book the player can edit, a small ＋ sits after each word card; it opens the add
// form set to insert right after that word (number + 1, same unit), and the new word appears
// in its place with the following numbers moved down, their records kept.
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
    await page.waitForFunction(() => window.VocabWordEntry);
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-vocab").click();
    await page.getByRole("button", { name: "＋ 単語帳を作る", exact: true }).click();
    await page.locator("#libraryBookName").fill("差し込み");
    await page.locator("#libraryBookWords").fill("1:apple:りんご:\n2:banana:バナナ:\n3:cherry:さくらんぼ:");
    await page.getByRole("button", { name: "単語帳を作る", exact: true }).click();
    await page.locator("#vocabLibraryBooks .textbook-list-item").filter({ hasText: "差し込み" }).click();
    await page.locator("#vocabAddWord").waitFor({ state: "visible" });
    // banana keeps its record through the insert.
    await page.evaluate(() => {
      vocabList[1].meanings[0].status = "ok";
      saveVocabProgressLocally(2);
    });
    await page.evaluate(() => window.renderVocabList());
    const plus = page.locator("#vocabListContainer .vocab-insert");
    assert.equal(await plus.count(), 3);
    // Small: no taller than about 22px.
    assert.ok((await plus.first().boundingBox()).height <= 24);
    await page.getByRole("button", { name: "#1 apple の次に単語を追加" }).click();
    const dialog = page.locator("dialog.vocab-entry-dialog[open]");
    await dialog.waitFor();
    assert.equal(await dialog.locator("#vocabEntryTitle").innerText(), "単語を差し込む");
    assert.match(await dialog.locator(".vocab-entry-where").innerText(), /#1「apple」の次（#2）/);
    assert.equal(await dialog.locator("#vocabEntryNumber").inputValue(), "2");
    assert.equal(await dialog.locator("#vocabEntryInsert").isChecked(), true);
    await dialog.locator("#vocabEntryWord").fill("apricot");
    await dialog.locator(".vocab-entry-meaning textarea").first().fill("あんず");
    await dialog.getByRole("button", { name: "追加する" }).click();
    await dialog.waitFor({ state: "detached" });
    // The list shows the new word between apple and banana, numbered 2; banana and cherry moved.
    await page.waitForFunction(() => document.querySelectorAll("#vocabListContainer .vocab-insert").length === 4);
    const order = await page.evaluate(() => window.VocabOrder.sort(vocabList).map((w) => [window.VocabOrder.no(w), w.word]));
    assert.deepEqual(order, [
      [1, "apple"],
      [2, "apricot"],
      [3, "banana"],
      [4, "cherry"],
    ]);
    assert.equal(await page.evaluate(() => vocabList.find((w) => w.word === "banana").meanings[0].status), "ok");
    const shown = await page.locator("#vocabListContainer .vocab-card, #vocabListContainer [id^=wordCardBody-]").allInnerTexts();
    assert.ok(shown.join("\n").indexOf("apricot") < shown.join("\n").indexOf("banana"), "apricot is shown before banana");
    assert.deepEqual(errors, []);
    console.log("PASS: a small ＋ after each editable word card inserts a word right after it (number + 1, later numbers moved, records kept)");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
