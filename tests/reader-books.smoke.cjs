// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/reader-books.smoke.cjs
// Reader: the word books it looks words up in are chosen by the user (several at once), words are
// coloured by the meaning the sentence uses, and bookshelf texts can be renamed, edited and sorted.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const base = process.env.APP_URL || "http://127.0.0.1:8000";
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }),
      errors = [],
      prompts = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.route("https://generativelanguage.googleapis.com/**", (r) => {
      const prompt = JSON.parse(r.request().postData()).contents[0].parts[0].text;
      prompts.push(prompt);
      const sentences = /She runs/.test(prompt)
        ? [
            { text: "I like apples.", translation: "私はりんごが好きです。", grammarHighlights: [], vocab: [{ num: "B2", meaning: 1 }, { num: "[B1]", meaning: 1 }] },
            { text: "She runs a company.", translation: "彼女は会社を経営している。", grammarHighlights: [], vocab: [{ num: "A3", meaning: 2 }] },
          ]
        : [{ text: "Hello world.", translation: "こんにちは世界。", grammarHighlights: [], vocab: [] }];
      const text = JSON.stringify({ fullSummaryAbstract: "要約", sentences });
      r.fulfill({ status: 200, contentType: "text/event-stream", body: "data: " + JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }) + "\r\n\r\n" });
    });
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
      localStorage.setItem("core_v4_geminiKey", "test-key");
    });
    await page.goto(base);
    await page.getByRole("button", { name: "ゲストとしてテストプレイ" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-vocab").click();
    for (const [name, words] of [
      ["英単語B", "1:apple:①りんご②リンゴの木\n2:like:好む"],
      ["英単語A", "1:like:〜のような\n2:ready:用意ができた\n3:run:①走る②経営する"],
    ]) {
      await page.getByRole("button", { name: "＋ 単語帳を作る", exact: true }).click();
      await page.locator("#libraryBookName").fill(name);
      await page.locator("#libraryBookWords").fill(words);
      await page.getByRole("button", { name: "単語帳を作る", exact: true }).click();
      await page.locator("dialog[open]").waitFor({ state: "detached" });
    }
    const ids = await page.evaluate(() => Object.fromEntries(textbooksPool.map((b) => [b.name, b.id])));
    await page.locator("#vocabLibraryBooks .textbook-list-item", { hasText: "英単語A" }).click();
    await page.waitForFunction((id) => !window.__vocabSelectionRequest && currentTextbook === id && vocabList.length === 3, ids["英単語A"]);
    // run: ② (経営する) is rated ×, ① has no answer yet.
    await page.evaluate(() => window.updateMeaningStatus("3", vocabList.find((w) => w.num == 3).meanings[1].id, "bad"));

    // Choosing both books for the reader.
    await page.locator("#nav-reader").click();
    assert.equal(await page.locator("#readerBooksButton").innerText(), "英単語A ›");
    await page.locator("#readerBooksButton").click();
    await page.locator(".reader-book-choices label", { hasText: "英単語B" }).locator("input").check();
    await page.getByRole("button", { name: "保存", exact: true }).click();
    assert.match(await page.locator("#readerBooksButton").innerText(), /ほか1冊/);

    await page.locator("#englishTextarea").fill("I like apples. She runs a company.");
    await page.locator("#analysisSubmitBtn").click();
    await page.locator(".sentence-ja", { hasText: "経営している" }).waitFor();
    // Both books' words are listed for the AI, each under its own key.
    const prompt = prompts[0];
    assert.match(prompt, /\[A1\] like: ①〜のような/);
    assert.match(prompt, /\[A3\] run: ①走る ②経営する/);
    assert.match(prompt, /\[B1\] apple: ①りんご ②リンゴの木/);
    assert.match(prompt, /\[B2\] like: ①好む/);
    const word = (text) => page.locator("#englishContainer .word-span", { hasText: new RegExp("^" + text + "\\b") });
    const data = (text) => word(text).evaluate((el) => ({ book: el.dataset.vocabBook, num: el.dataset.vocabNum, sense: el.dataset.sense, cls: el.className }));
    // like is 好む here: book B's entry, not A's 〜のような.
    assert.deepEqual(await data("like").then((d) => [d.book, d.num]), [ids["英単語B"], "2"]);
    assert.deepEqual(await data("apples").then((d) => [d.book, d.num]), [ids["英単語B"], "1"]);
    // runs is ② 経営する, which is rated ×: red, though ① has no answer.
    const runs = await data("runs");
    assert.deepEqual([runs.book, runs.num, runs.sense], [ids["英単語A"], "3", "2"]);
    assert.match(runs.cls, /status-bad/);
    // A word of the open book: the full card with the meaning used here.
    await word("runs").click();
    const sheet = page.locator("#flashcardWordDetails.is-open");
    await sheet.waitFor();
    assert.equal(await sheet.locator(".flashcard-detail-note").innerText(), "この文での意味：②経営する");
    assert.equal(await sheet.locator("#flashcardDetailContent.is-readonly").count(), 0);
    await sheet.locator(".flashcard-detail-close").click();
    await page.waitForFunction(() => !document.querySelector("#flashcardWordDetails.is-open"));
    // A word of the other book: read-only, saying which book it is from.
    await word("like").click();
    await sheet.waitFor();
    assert.match(await sheet.locator(".flashcard-detail-note").innerText(), /この文での意味：①好む\n「英単語B」の単語です/);
    assert.equal(await sheet.locator("#flashcardDetailContent.is-readonly").count(), 1);
    await sheet.locator(".flashcard-detail-close").click();
    await page.waitForFunction(() => !document.querySelector("#flashcardWordDetails.is-open"));

    // Bookshelf: two texts in a folder, sorted, then one renamed and its text edited.
    await page.getByRole("button", { name: "本棚に保存" }).click();
    await page.locator("#selectBookshelfFolder").selectOption("new_folder");
    await page.locator("#newFolderNameInput").fill("模試");
    await page.locator("#confirmSaveBookshelfBtn").click();
    await page.locator("dialog.app-alert button").click();
    await page.evaluate(() => {
      myBookshelf.push({ id: Date.now() + 1, folder: "模試", title: "第2問", text: "Second text.", aiAnalysisData: null });
      window.closeReader();
      currentShelfView = "folder:模試";
      window.switchReaderSubTab("bookshelf", "none");
    });
    const shelf = page.locator("#myBookshelfContainer");
    const titles = () => shelf.locator(".shelf-entry .textbook-list-name").allInnerTexts();
    assert.deepEqual(await titles(), ["第2問", (await page.evaluate(() => myBookshelf[0].title))]);
    await shelf.getByRole("button", { name: "並べ替え" }).click();
    await shelf.getByRole("button", { name: "第2問を下へ" }).click();
    assert.equal((await titles())[1], "第2問");
    await shelf.getByRole("button", { name: "完了" }).click();
    await page.getByRole("button", { name: "第2問の管理" }).click();
    await page.getByRole("button", { name: "名前・本文を編集" }).click();
    await page.locator("#shelfTextTitle").fill("第2問（改）");
    await page.locator("#shelfTextBody").fill("Hello world.");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    const edited = shelf.locator(".shelf-entry", { hasText: "第2問（改）" });
    assert.match(await edited.innerText(), /1文 · 未解析/);
    // Opening it analyses the new text and keeps the analysis on the shelf.
    await edited.locator(".textbook-list-item").click();
    await page.locator(".sentence-ja", { hasText: "こんにちは世界。" }).waitFor();
    assert.equal(prompts.length, 2);
    assert.equal(await page.evaluate(() => !!myBookshelf.find((i) => i.title === "第2問（改）").aiAnalysisData), true);
    assert.deepEqual(errors, []);
    console.log("PASS: several word books for the reader, meaning-specific colours, read-only card for another book, shelf sort, rename and text edit with re-analysis");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
