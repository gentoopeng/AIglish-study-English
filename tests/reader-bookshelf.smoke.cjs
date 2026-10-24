// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/reader-bookshelf.smoke.cjs
// Reader: streamed AI analysis with progress (and model fallback), the loading quiz on the flashcard
// card, the bookshelf laid out like the word book list, history, and the no-key notice.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }),
      errors = [],
      calls = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let release;
    const answered = new Promise((resolve) => (release = resolve));
    await page.route("https://**/*", (r) => r.abort());
    // gemini-2.5-flash answers 404 here (as if retired), so the newest model must be tried next. The answer
    // streams in two parts, after the test has looked at the loading screen.
    await page.route("https://generativelanguage.googleapis.com/**", async (r) => {
      const url = r.request().url(),
        model = /models\/([^:]+):/.exec(url)[1];
      calls.push(model + (url.includes(":streamGenerateContent?alt=sse") ? ":stream" : ""));
      if (model === "gemini-2.5-flash") return r.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { message: "not found" } }) });
      await answered;
      const text = JSON.stringify({ fullSummaryAbstract: "要約です", sentences: [{ text: "I like apples.", translation: "私はりんごが好きです。", grammarHighlights: [{ phrase: "like", meaning: "好む" }] }, { text: "They are red.", translation: "それらは赤い。", grammarHighlights: [] }] }),
        half = Math.floor(text.length / 2),
        event = (part) => "data: " + JSON.stringify({ candidates: [{ content: { parts: [{ text: part }] } }] }) + "\r\n\r\n";
      r.fulfill({ status: 200, contentType: "text/event-stream", body: event(text.slice(0, half)) + event(text.slice(half)) });
    });
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
      if (!sessionStorage.getItem("nokey")) localStorage.setItem("core_v4_geminiKey", "test-key");
    });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストとしてテストプレイ" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    // A word book, so the loading screen has a quiz.
    await page.locator("#nav-vocab").click();
    await page.getByRole("button", { name: "＋ 単語帳を作る", exact: true }).click();
    await page.locator("#libraryBookName").fill("テスト単語");
    await page.locator("#libraryBookWords").fill("1:apple:りんご\n2:red:赤い\n3:sweet:甘い\n4:study:勉強する");
    await page.getByRole("button", { name: "単語帳を作る", exact: true }).click();
    await page.locator("dialog[open]").waitFor({ state: "detached" });
    await page.locator("#vocabLibraryBooks .textbook-list-item").first().click();
    await page.waitForFunction(() => !window.__vocabSelectionRequest && vocabList.length === 4);

    await page.locator("#nav-reader").click();
    assert.match(await page.locator(".reader-manual-ja summary").innerText(), /和訳を自分で入れる/);
    await page.locator("#customTextTitle").fill("テスト文");
    await page.locator("#englishTextarea").fill("I like apples. They are red.");
    assert.equal(await page.locator("#readerInputCount").innerText(), "2文・6語");
    await page.locator("#analysisSubmitBtn").click();
    // While the AI works: the percent, and the quiz on the same card as the flashcards.
    const overlay = page.locator("#penguinLoadingOverlay");
    await overlay.locator("#lqProgress").waitFor({ state: "visible" });
    assert.match(await overlay.locator("#lqProgressValue").innerText(), /^\d+%$/);
    assert.match(await overlay.locator("#lqProgressLabel").innerText(), /AIが英文を読んでいます|英文を送っています|別のAIモデルで試しています/);
    await overlay.locator(".lq-flashcard .flashcard-face-front").waitFor();
    assert.equal(await overlay.locator(".lq-side.is-ok").innerText(), "覚えた");
    await overlay.locator("#lqCardWrap").click();
    assert.equal(await overlay.locator(".lq-flashcard").evaluate((card) => card.classList.contains("flipped")), true);
    await overlay.getByRole("button", { name: "覚えた", exact: true }).click();
    await page.waitForFunction(() => /^回答 1/.test(document.getElementById("lqScore").textContent));
    release();
    await page.locator(".sentence-ja", { hasText: "私はりんごが好きです。" }).waitFor();
    assert.deepEqual(calls, ["gemini-2.5-flash:stream", "gemini-flash-latest:stream"]);
    assert.equal(await page.locator("#englishContainer .grammar-span").count(), 1);
    assert.equal(await page.locator(".reader-key-notice").count(), 0);
    assert.match(await page.locator(".reader-title-meta").innerText(), /^2文/);
    // The quiz answer is kept in the word book once the loading screen closes.
    await page.waitForFunction(() => vocabList.find((w) => w.status === "ok"));

    // Saved into a new folder, which then shows on the bookshelf with the text in it.
    await page.getByRole("button", { name: "本棚に保存" }).click();
    await page.locator("#selectBookshelfFolder").selectOption("new_folder");
    await page.locator("#newFolderNameInput").fill("英語長文");
    await page.locator("#confirmSaveBookshelfBtn").click();
    assert.equal(await page.locator("dialog.app-alert p").innerText(), "「英語長文」に保存しました。");
    await page.locator("dialog.app-alert button").click();
    await page.evaluate(() => window.closeReader());
    await page.locator("#readerTabBtnBookshelf").click();
    const shelf = page.locator("#myBookshelfContainer");
    assert.equal(await shelf.locator(".shelf-header h2").innerText(), "本棚");
    const folder = shelf.locator(".shelf-entry", { hasText: "英語長文" });
    assert.match(await folder.innerText(), /1本の長文 · テスト文/);
    assert.equal(await shelf.locator(".shelf-entry", { hasText: "未分類" }).count(), 0);
    await folder.locator(".textbook-list-item").click();
    assert.equal(await shelf.locator(".shelf-header h2").innerText(), "英語長文");
    const item = shelf.locator(".shelf-entry", { hasText: "テスト文" });
    assert.match(await item.innerText(), /2文 · 解析済み/);
    // Opening from the bookshelf and from the history uses the saved analysis: no new AI request.
    await item.locator(".textbook-list-item").click();
    await page.locator(".sentence-ja", { hasText: "私はりんごが好きです。" }).waitFor();
    await page.getByRole("button", { name: "本棚に保存" }).click();
    assert.ok((await page.locator("#selectBookshelfFolder option").allInnerTexts()).includes("📁 英語長文"));
    await page.locator("#cancelSaveBookshelfBtn").click();
    await page.evaluate(() => window.closeReader());
    await page.evaluate(() => window.switchReaderSubTab("analysis", "none"));
    await page.locator("#historyListContainer .textbook-list-item", { hasText: "テスト文" }).click();
    await page.locator(".sentence-ja", { hasText: "私はりんごが好きです。" }).waitFor();
    assert.equal(calls.length, 2);
    await page.evaluate(() => window.closeReader());
    // Deleting the text, then the empty folder. The bookshelf reopens inside the folder.
    await page.locator("#readerTabBtnBookshelf").click();
    assert.equal(await shelf.locator(".shelf-header h2").innerText(), "英語長文");
    await page.getByRole("button", { name: "テスト文の管理" }).click();
    await page.getByRole("button", { name: "本棚から削除" }).click();
    await page.getByRole("button", { name: "削除する" }).click();
    assert.match(await shelf.innerText(), /まだ長文がありません/);
    await page.getByRole("button", { name: "フォルダの管理", exact: true }).click();
    await page.getByRole("button", { name: "フォルダを削除" }).click();
    await page.getByRole("button", { name: "削除する" }).click();
    assert.equal(await shelf.locator(".shelf-entry", { hasText: "英語長文" }).count(), 0);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("myBookshelf")).length), 0);
    // A new folder from the toolbar opens empty.
    await page.getByRole("button", { name: "＋ フォルダを作る" }).click();
    await page.locator("#shelfFolderName").fill("模試");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    assert.equal(await shelf.locator(".shelf-header h2").innerText(), "模試");
    // Clear empties the input.
    await page.evaluate(() => window.switchReaderSubTab("analysis", "none"));
    await page.locator("#readerClearButton").click();
    assert.equal(await page.locator("#englishTextarea").inputValue(), "");
    assert.equal(await page.locator("#readerInputCount").innerText(), "0文・0語");
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
    console.log("PASS: streamed analysis with progress and model fallback, flashcard loading quiz, shelf like the word book list, folders, reopening without a new AI request, deleting, input count, no-key notice");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
