// Editing an analysis: the translation of a sentence, its grammar points (change, add, remove; the phrase must be in the sentence)
// and the summary. The change is kept with the history and with the bookshelf text, and opening it again shows it without the AI.
const { chromium } = require("playwright"), assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }), errors = [];
    let ai = 0;
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.route("https://generativelanguage.googleapis.com/**", (r) => { ai++; r.abort(); });
    await page.addInitScript(() => { localStorage.setItem("b3_tutorial_done", "1"); localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false })); });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true && window.ReaderEdit && window.renderBookshelf);
    const TEXT = "Tom has lived in Kyoto for ten years. He likes tea.";
    await page.evaluate((text) => {
      const analysis = { fullSummaryAbstract: "トムの話。", sentences: [
        { text: "Tom has lived in Kyoto for ten years.", translation: "トムは京都に10年住んでいた。", grammarHighlights: [{ phrase: "has lived", label: "現在完了", meaning: "継続を表す。" }], vocab: [] },
        { text: "He likes tea.", translation: "彼は紅茶が好きだ。", grammarHighlights: [], vocab: [] } ] };
      myBookshelf.push({ id: 1767225600001, folder: "", title: "トム", text, aiAnalysisData: analysis });
      window.ReaderShelf.save();
      window.switchTab("reader");
      return window.analyzeText(text, "トム", JSON.parse(JSON.stringify(analysis)));
    }, TEXT);
    // Off until asked for.
    assert.equal(await page.locator(".re-pen").count(), 0);
    await page.getByRole("button", { name: "解析を編集" }).click();
    assert.equal(await page.locator(".sentence-container .re-pen").count(), 2);

    // The first sentence: a better translation, the point changed, one added; a phrase that is not in the sentence is refused.
    await page.getByRole("button", { name: "1文目を編集" }).click();
    await page.locator("#reJa").fill("トムは京都に10年間住んでいる。");
    await page.locator(".re-point .re-meaning").first().fill("過去から今まで続いていることを表す。");
    await page.getByRole("button", { name: "＋ ポイントを追加" }).click();
    await page.locator(".re-point").nth(1).locator(".re-phrase").fill("for a long time");
    await page.locator(".re-point").nth(1).locator(".re-meaning").fill("期間。");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    assert.match(await page.locator(".re-form .library-editor-error").innerText(), /見つかりません/);
    await page.locator(".re-point").nth(1).locator(".re-phrase").fill("for ten years");
    await page.locator(".re-point").nth(1).locator(".re-label").fill("期間の for");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.locator(".sentence-ja", { hasText: "トムは京都に10年間住んでいる。" }).waitFor();
    assert.equal(await page.locator(".grammar-span").count(), 2);
    // Still in edit mode; the second sentence: its translation; the summary; then a point removed from the first.
    await page.getByRole("button", { name: "2文目を編集" }).click();
    await page.locator("#reJa").fill("彼はお茶が好きだ。");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.locator(".sentence-ja", { hasText: "彼はお茶が好きだ。" }).waitFor();
    await page.getByRole("button", { name: "要約を編集" }).click();
    await page.locator("#reSummary").fill("京都に住むトムの話。");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.locator("#summaryAbstractContainer", { hasText: "京都に住むトムの話。" }).waitFor();
    await page.getByRole("button", { name: "1文目を編集" }).click();
    await page.locator(".re-point").first().getByRole("button", { name: "このポイントを削除" }).click();
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll(".grammar-span").length === 1);
    await page.getByRole("button", { name: "編集を終わる" }).click();
    assert.equal(await page.locator(".re-pen").count(), 0);

    // Kept with the history and the bookshelf text; opened again from the shelf without the AI.
    const kept = await page.evaluate(() => ({
      shelf: myBookshelf[0].aiAnalysisData.sentences.map((s) => [s.translation, s.grammarHighlights.map((h) => h.phrase)]),
      stored: JSON.parse(localStorage.getItem("myBookshelf"))[0].aiAnalysisData.fullSummaryAbstract,
      history: textHistory[0].aiAnalysisData.sentences[1].translation, edited: myBookshelf[0].aiAnalysisData.edited, updated: myBookshelf[0].updatedAt > 0 }));
    assert.deepEqual(kept, { shelf: [["トムは京都に10年間住んでいる。", ["for ten years"]], ["彼はお茶が好きだ。", []]], stored: "京都に住むトムの話。", history: "彼はお茶が好きだ。", edited: true, updated: true });
    await page.evaluate(() => window.closeReader());
    await page.locator("#readerTabBtnBookshelf").click();
    await page.locator("#myBookshelfContainer .shelf-entry", { hasText: "未分類" }).locator(".textbook-list-item").click();
    await page.locator("#myBookshelfContainer .shelf-entry", { hasText: "トム" }).locator(".textbook-list-item").click();
    await page.locator(".sentence-ja", { hasText: "トムは京都に10年間住んでいる。" }).waitFor();
    assert.equal(await page.locator(".re-pen").count(), 0, "the edit marks are off again");
    assert.equal(ai, 0);
    assert.deepEqual(errors, []);
    console.log("reader edit smoke passed");
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
