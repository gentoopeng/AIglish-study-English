// The reader bookshelf: a search box (title and English) over the whole shelf, a first line of the English on each text, marks for
// "analysed" and "has questions", and the count of texts.
const { chromium } = require("playwright"), assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }), errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => { localStorage.setItem("b3_tutorial_done", "1"); });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true && window.renderBookshelf && window.ReaderQuestions);
    await page.evaluate(() => {
      const analysed = { sentences: [{ text: "x", translation: "y", grammarHighlights: [] }], fullSummaryAbstract: "z" };
      myFolders = ["未分類", "英語長文"];
      myBookshelf.length = 0;
      myBookshelf.push(
        { id: 1700000000001, folder: "英語長文", title: "第1問 環境", text: "Plastic waste is a serious problem in the ocean. Many animals suffer.", aiAnalysisData: analysed },
        { id: 1700000000002, folder: "英語長文", title: "第2問 健康", text: "Sleep is important for your health.", aiAnalysisData: null },
        { id: 1700000000003, folder: "", title: "メモ", text: "Tom likes tea.", aiAnalysisData: null },
        { id: 1700000000004, folder: "英語長文", title: "第3問 歴史", text: "The castle was built in the twelfth century.", aiAnalysisData: null },
      );
      ReaderQuestions.get = (t) => (t.startsWith("Plastic") ? { result: { questions: [{}, {}] } } : null);
      window.renderBookshelf();
    });
    await page.locator("#nav-reader").click();
    await page.locator("#readerTabBtnBookshelf").click();
    const shelf = page.locator("#myBookshelfContainer");
    assert.match(await shelf.locator(".shelf-header").first().innerText(), /全4本の長文/);
    // Search the whole shelf by the English, then by the title; clearing brings the folders back.
    const box = shelf.locator(".shelf-search input");
    await box.fill("castle");
    await shelf.locator(".shelf-entry .textbook-list-name", { hasText: "第3問 歴史" }).waitFor();
    assert.equal(await shelf.locator(".shelf-entry").count(), 1);
    assert.match(await shelf.locator(".shelf-entry-sub").first().innerText(), /英語長文/);
    await box.fill("メモ");
    assert.equal(await shelf.locator(".shelf-entry").count(), 1);
    await box.fill("zzz");
    await shelf.getByText("に合う長文はありません").waitFor();
    await box.fill("");
    await shelf.locator(".shelf-entry .textbook-list-name", { hasText: "英語長文" }).waitFor();
    // Inside the folder: a first line of the English, and the marks.
    await shelf.locator(".shelf-entry", { hasText: "英語長文" }).locator(".textbook-list-item").click();
    const first = shelf.locator(".shelf-entry", { hasText: "第1問 環境" });
    await first.waitFor();
    assert.match(await first.locator(".shelf-entry-preview").innerText(), /^Plastic waste is a serious problem/);
    assert.deepEqual(await first.locator(".shelf-chip").allInnerTexts(), ["解析済み", "問題2問"]);
    assert.equal(await shelf.locator(".shelf-entry", { hasText: "第2問 健康" }).locator(".shelf-chip").count(), 0);
    // The row still opens the text and reads "2文 · 解析済み".
    assert.match(await first.locator(".shelf-entry-sub").innerText(), /2文 · 解析済み/);
    assert.deepEqual(errors, []);
    console.log("reader shelf ui smoke passed");
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
