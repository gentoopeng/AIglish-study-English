// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/reader-bookshelf.smoke.cjs
// Reader: AI analysis (model fallback), history and bookshelf folders, and the no-key notice.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }),
      errors = [],
      calls = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    // The newest model name answers 404 here, so the older name must be tried next.
    await page.route("https://generativelanguage.googleapis.com/**", (r) => {
      const model = /models\/([^:]+):/.exec(r.request().url())[1];
      calls.push(model);
      if (model === "gemini-flash-latest") return r.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { message: "not found" } }) });
      const result = { fullSummaryAbstract: "要約です", sentences: [{ text: "I like apples.", translation: "私はりんごが好きです。", grammarHighlights: [{ phrase: "like", meaning: "好む" }] }, { text: "They are red.", translation: "それらは赤い。", grammarHighlights: [] }] };
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }] }) });
    });
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
      if (!sessionStorage.getItem("nokey")) localStorage.setItem("core_v4_geminiKey", "test-key");
    });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストとしてテストプレイ" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-reader").click();
    await page.locator("#customTextTitle").fill("テスト文");
    await page.locator("#englishTextarea").fill("I like apples. They are red.");
    await page.locator("#analysisSubmitBtn").click();
    await page.locator(".sentence-ja", { hasText: "私はりんごが好きです。" }).waitFor();
    assert.deepEqual(calls, ["gemini-flash-latest", "gemini-2.5-flash"]);
    assert.equal(await page.locator("#englishContainer .grammar-span").count(), 1);
    assert.equal(await page.locator(".reader-key-notice").count(), 0);
    // Saved into a new folder, which then shows on the bookshelf with the text in it.
    await page.getByRole("button", { name: "本棚に保存する" }).click();
    await page.locator("#selectBookshelfFolder").selectOption("new_folder");
    await page.locator("#newFolderNameInput").fill("英語長文");
    await page.locator("#confirmSaveBookshelfBtn").click();
    assert.equal(await page.locator("dialog.app-alert p").innerText(), "「英語長文」に保存しました。");
    await page.locator("dialog.app-alert button").click();
    await page.evaluate(() => window.closeReader());
    await page.locator("#readerTabBtnBookshelf").click();
    const folder = page.locator("#myBookshelfContainer .shelf-book-row", { hasText: "英語長文" });
    assert.match(await folder.innerText(), /1 本の長文/);
    assert.equal(await page.locator("#myBookshelfContainer .shelf-book-row", { hasText: "未分類" }).count(), 0);
    // A second save offers the folder.
    await folder.click();
    assert.match(await page.locator("#myBookshelfContainer").innerText(), /📁 英語長文[\s\S]*テスト文/);
    // Opening from the bookshelf and from the history uses the saved analysis: no new AI request.
    await page.locator("#myBookshelfContainer").getByRole("button", { name: "開く" }).click();
    await page.locator(".sentence-ja", { hasText: "私はりんごが好きです。" }).waitFor();
    await page.getByRole("button", { name: "本棚に保存する" }).click();
    assert.ok((await page.locator("#selectBookshelfFolder option").allInnerTexts()).includes("📁 英語長文"));
    await page.locator("#cancelSaveBookshelfBtn").click();
    await page.evaluate(() => window.closeReader());
    await page.evaluate(() => window.switchReaderSubTab("analysis", "none"));
    await page.locator("#historyListContainer").getByRole("button", { name: "開く" }).click();
    await page.locator(".sentence-ja", { hasText: "私はりんごが好きです。" }).waitFor();
    assert.equal(calls.length, 2);
    await page.evaluate(() => window.closeReader());
    // Deleting the text, then the empty folder.
    // The bookshelf reopens where it was left (inside the folder).
    await page.locator("#readerTabBtnBookshelf").click();
    assert.match(await page.locator("#myBookshelfContainer").innerText(), /📁 英語長文/);
    await page.locator("#myBookshelfContainer .word-delete-btn").click();
    await page.getByRole("button", { name: "このフォルダを削除" }).click();
    assert.equal(await page.locator("#myBookshelfContainer .shelf-book-row", { hasText: "英語長文" }).count(), 0);
    // Without a key: the text is shown and the reader says what is needed.
    await page.evaluate(() => {
      sessionStorage.setItem("nokey", "1");
      localStorage.removeItem("core_v4_geminiKey");
    });
    await page.reload();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-reader").click();
    await page.locator("#englishTextarea").fill("Hello world.");
    await page.locator("#analysisSubmitBtn").click();
    await page.locator(".reader-key-notice").waitFor();
    assert.match(await page.locator(".reader-key-notice").innerText(), /Gemini APIキーが必要/);
    assert.deepEqual(errors, []);
    console.log("PASS: model fallback on 404, grammar marks, saving into a new folder, folder view, reopening from shelf and history without a new AI request, deleting text and folder, no-key notice");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
