// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/vocab-units-order.smoke.cjs
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }),
      errors = [];
    page.setDefaultTimeout(10000);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
    });
    await page.goto("http://127.0.0.1:8000");
    await page.waitForFunction(() => window.VocabWordEntry && window.VocabOrder);
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-vocab").click();
    await page.getByRole("button", { name: "＋ 単語帳を作る", exact: true }).click();
    await page.locator("#libraryBookName").fill("単元テスト");
    await page.locator("#libraryBookWords").fill("1:one:一:\n2:two:二:\n3:three:三:\n4:four:四:");
    await page.getByRole("button", { name: "単語帳を作る", exact: true }).click();
    const openBook = async () => {
      await page.locator("#vocabLibraryBooks .textbook-list-item").filter({ hasText: "単元テスト" }).click();
      await page.locator("#vocabAddWord").waitFor({ state: "visible" });
    };
    await openBook();
    const book = await page.evaluate(() => currentTextbook);
    // "three" (#3) has a rating and a note that must stay with it.
    await page.evaluate(() => {
      const w = vocabList.find((x) => String(x.num) === "3");
      w.meanings[0].status = "ok";
      w.meanings[0].history = ["ok"];
      w.note = "三のメモ";
      saveVocabProgressLocally(3);
      __captureManualVocabDraft();
    });
    const shown = () =>
      page.evaluate(() =>
        [...document.querySelectorAll("#vocabListContainer .word-row-container")].map((row) => [
          row.querySelector(".word-main-line span:nth-child(2)").textContent,
          row.querySelector(".word-num-badge").textContent,
        ]),
      );
    // A used number is refused without consent; with 差し込む the word goes between #2 and #3.
    await page.locator("#vocabAddWord").click();
    await page.locator("#vocabEntryWord").fill("between");
    await page.getByRole("textbox", { name: "意味・答え 1", exact: true }).fill("間");
    await page.getByText("サブ情報・番号・単元を設定", { exact: true }).click();
    assert.equal(await page.locator("#vocabEntryNumber").inputValue(), "5");
    await page.locator("#vocabEntryNumber").fill("3");
    await page.getByRole("button", { name: "追加する", exact: true }).click();
    assert.match(await page.locator(".vocab-entry-dialog [role=alert]").innerText(), /差し込む/);
    await page.locator("#vocabEntryInsert").check();
    await page.locator("#vocabEntryUnit").fill("第2章");
    await page.getByRole("button", { name: "追加する", exact: true }).click();
    await page.locator(".vocab-entry-dialog").waitFor({ state: "detached" });
    await page.evaluate(() => {
      document.getElementById("vocabSearchInput").value = "";
      window.renderVocabList();
    });
    assert.deepEqual(await shown(), [["one", "#1"], ["two", "#2"], ["between", "#3"], ["three", "#4"], ["four", "#5"]]);
    const record = await page.evaluate((b) => LearningData.read(b)["3"], book);
    assert.equal(record.note, "三のメモ");
    assert.equal(record.meanings["3-0"].status, "ok");
    // Units by number range, shown as a table of contents that filters the list.
    await page.getByText("番号の範囲に単元を付ける", { exact: true }).click();
    await page.getByLabel("単元にする最初の番号").fill("1");
    await page.getByLabel("単元にする最後の番号").fill("2");
    await page.getByLabel("単元の名前").fill("第1章");
    await page.getByRole("button", { name: "付ける", exact: true }).click();
    const chips = await page.locator(".vocab-unit-chip").allInnerTexts();
    assert.equal(chips.length, 4);
    assert.match(chips[0], /目次[\s\S]*2単元/);
    assert.match(chips[2], /第1章[\s\S]*#1–2 · 2語/);
    assert.match(chips[3], /第2章[\s\S]*#3–3 · 1語/);
    await page.locator('.vocab-unit-chip[data-unit="第1章@1"]').click();
    assert.deepEqual(await shown(), [["one", "#1"], ["two", "#2"]]);
    await page.locator('.vocab-unit-chip[data-unit=""]').click();
    // Moving a word in its edit form: "four" (#5) to #1 moves the others down, records intact.
    await page.locator('.word-row-container[data-word-num="4"] .card-edit-btn').click();
    await page.locator("#inlineEditNoInput-4").fill("1");
    await page.locator('#wordCardForm-4').getByRole("button", { name: "保存する", exact: true }).click();
    assert.deepEqual(await shown(), [["four", "#1"], ["one", "#2"], ["two", "#3"], ["between", "#4"], ["three", "#5"]]);
    // Numbers and units survive a restart.
    await page.reload();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-vocab").click();
    await openBook();
    await page.waitForFunction(() => document.querySelectorAll("#vocabListContainer .word-row-container").length === 5);
    assert.deepEqual(await shown(), [["four", "#1"], ["one", "#2"], ["two", "#3"], ["between", "#4"], ["three", "#5"]]);
    assert.equal(await page.evaluate((b) => LearningData.read(b)["3"].note, book), "三のメモ");
    // Flashcards: a unit narrows the cards, and cards show the display number.
    await page.evaluate(() => window.switchTab("vocab"));
    await page.evaluate(() => window.showVocabLibrarySelection());
    await page.getByRole("button", { name: "単元テストの学習方法を選ぶ" }).click();
    await page.getByRole("button", { name: "単語カード", exact: true }).click();
    assert.equal(await page.locator("#flashcardUnitField").isVisible(), true);
    assert.equal(await page.locator("#flashcardRangeEnd").inputValue(), "5");
    await page.locator("#flashcardUnitSelect").selectOption({ label: "第1章（#2–3・2語）" });
    await page.getByRole("button", { name: "カードを開始する" }).click();
    await page.waitForFunction(() => flashcardOriginQueue.length > 0);
    const queue = await page.evaluate(() => flashcardOriginQueue.map((w) => [w.en, w.shownNo]).sort());
    assert.deepEqual(queue, [["one", 2], ["two", 3]]);
    const badge = await page.locator("#activeFlashcard .flashcard-number").textContent();
    assert.ok(["#2", "#3"].includes(badge), badge);
    await page.locator("#flashcard-play-screen").getByRole("button", { name: "中断", exact: true }).click();
    // Battle: one book with units offers a unit choice.
    await page.locator("#nav-community").click(); await page.locator("#communitySegments button", { hasText: "単語バトル" }).click();
    await page.locator(".mode-casual").click();
    await page.locator("[data-battle-route=solo]").click();
    await page.locator(`.battle-book-picker input[value="${book}"]`).check();
    const others = page.locator(`.battle-book-picker input:checked:not([value="${book}"])`);
    for (let i = await others.count(); i > 0; i--) await others.first().uncheck();
    assert.equal(await page.locator(".battle-unit").isVisible(), true);
    assert.deepEqual(await page.locator("[data-range-unit] option").allTextContents(), ["すべて", "第1章（#2–3・2語）", "第2章（#4–4・1語）"]);
    // The same name further on is its own unit; 目次 lists the units and edits a name and range.
    await page.reload();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-vocab").click();
    await openBook();
    await page.waitForFunction(() => document.querySelectorAll("#vocabListContainer .word-row-container").length === 5);
    await page.getByText("番号の範囲に単元を付ける", { exact: true }).click();
    await page.getByLabel("単元にする最初の番号").fill("5");
    await page.getByLabel("単元にする最後の番号").fill("5");
    await page.getByLabel("単元の名前").fill("第1章");
    await page.getByRole("button", { name: "付ける", exact: true }).click();
    assert.deepEqual(await page.locator(".vocab-unit-chip strong").allInnerTexts(), ["目次", "すべて", "第1章", "第2章", "第1章"]);
    await page.locator('.vocab-unit-chip[data-unit="第1章@5"]').click();
    assert.deepEqual(await shown(), [["three", "#5"]]);
    await page.getByRole("button", { name: /^目次/ }).click();
    const toc = page.locator("dialog.vocab-unit-toc-dialog[open]");
    assert.deepEqual(await toc.locator(".vocab-unit-toc-open small").allInnerTexts(), ["5語", "#2–3 · 2語 · ○0%", "#4–4 · 1語 · ○0%", "#5–5 · 1語 · ○100%"]);
    assert.equal(await toc.locator("li.is-current strong").innerText(), "第1章");
    await toc.getByRole("button", { name: "第1章を編集" }).nth(1).click();
    await toc.locator("[data-unit-edit-name]").fill("まとめ");
    await toc.locator("[data-unit-edit-from]").fill("4");
    await toc.getByRole("button", { name: "保存", exact: true }).click();
    await toc.locator(".vocab-unit-toc-open strong", { hasText: "まとめ" }).waitFor();
    assert.deepEqual(await toc.locator(".vocab-unit-toc-open strong").allInnerTexts(), ["すべて", "第1章", "まとめ"]);
    await toc.locator(".vocab-unit-toc-open", { hasText: "まとめ" }).click();
    assert.deepEqual(await shown(), [["between", "#4"], ["three", "#5"]]);
    assert.deepEqual(await page.evaluate(() => vocabList.map((w) => [w.word, w.unit || ""]).sort()), [["between", "まとめ"], ["four", ""], ["one", "第1章"], ["three", "まとめ"], ["two", "第1章"]]);
    await page.getByRole("button", { name: /^目次/ }).click();
    await toc.getByRole("button", { name: "まとめを編集" }).click();
    await toc.getByRole("button", { name: "単元を外す" }).click();
    await toc.locator(".vocab-unit-toc-open strong", { hasText: "まとめ" }).waitFor({ state: "detached" });
    assert.deepEqual(await toc.locator(".vocab-unit-toc-open strong").allInnerTexts(), ["すべて", "第1章"]);
    assert.deepEqual(errors, []);
    console.log("PASS: insert between #2 and #3 (consent for a used number), records stay with their word, units by range with a filtering contents list, the same name further on as its own unit, 目次 with name and range editing, move by number, restart, flashcard unit filter and display numbers, battle unit choice");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
