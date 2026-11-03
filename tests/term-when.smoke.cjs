// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/term-when.smoke.cjs
// 用語・年号モード with a century and an era at the start of a line (12世紀, 平安時代): the add form
// shows the cards, a century is asked as its number (typed), an era as a card, the word list marks
// them, and the edit box takes "平安" and says it back as 平安時代 (and refuses what is none of
// a year, a century or an era).
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }),
      errors = [],
      alerts = [];
    page.setDefaultTimeout(10000);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => {
      alerts.push(d.message());
      d.accept();
    });
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
    });
    await page.goto("http://127.0.0.1:8000");
    await page.waitForFunction(() => window.TermQuestions && window.TermProgress && window.VocabWordEntry);
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-vocab").click();
    await page.getByRole("button", { name: "＋ 単語帳を作る", exact: true }).click();
    await page.locator("#libraryBookName").fill("時代テスト");
    await page.locator("#libraryBookTermMode").check();
    await page.locator("#libraryBookWords").fill("1:源頼朝:①12世紀 「鎌倉幕府」を開いた②鎌倉時代 初代将軍:\n2:藤原道長:平安時代 摂関政治の最盛期:");
    await page.getByRole("button", { name: "単語帳を作る", exact: true }).click();
    await page.locator("#vocabLibraryBooks .textbook-list-item").filter({ hasText: "時代テスト" }).click();
    await page.locator("#vocabAddWord").waitFor({ state: "visible" });
    const book = await page.evaluate(() => currentTextbook);

    // The add form says so, and shows the cards a line makes before it is added.
    await page.locator("#vocabAddWord").click();
    assert.match(await page.locator(".vocab-entry-term-hint").innerText(), /年（1582）・世紀（12世紀）・時代（平安時代）/);
    await page.locator("#vocabEntryWord").fill("聖徳太子");
    await page.getByRole("textbox", { name: "説明 1", exact: true }).fill("飛鳥時代 摂政として政治を行った");
    const preview = await page.locator(".vocab-entry-preview").innerText();
    assert.match(preview, /聖徳太子 → 飛鳥時代 摂政として政治を行った/);
    await page.getByRole("button", { name: "追加する", exact: true }).click();
    await page.locator(".vocab-entry-dialog").waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => vocabList.find((w) => w.word === "聖徳太子").meanings[0].text), "飛鳥時代 摂政として政治を行った");

    // Flashcards: a century is typed as its number; an era is a card.
    await page.evaluate(() => {
      window.switchTab("vocab");
      window.showVocabLibrarySelection();
    });
    await page.getByRole("button", { name: "時代テストの学習方法を選ぶ" }).click();
    await page.getByRole("button", { name: "単語カード", exact: true }).click();
    await page.getByRole("button", { name: "カードを開始する" }).click();
    await page.waitForFunction(() => flashcardOriginQueue.length > 0 && document.getElementById("activeFlashcard"));
    const queue = await page.evaluate(() => flashcardOriginQueue.map((q) => [q.termKey.split(":")[0], q.en, q.ja, q.termInput, q.termUnit]));
    const by = (k) => queue.filter((q) => q[0] === k);
    assert.deepEqual(by("c").map((q) => [q[1], q[2], q[3], q[4]]), [["源頼朝：鎌倉幕府を開いた（何世紀？）", "12", true, "世紀"]]);
    assert.deepEqual(by("e").map((q) => [q[1], q[2], q[3]]).sort(), [
      ["源頼朝：初代将軍（何時代？）", "鎌倉時代", false],
      ["聖徳太子：摂政として政治を行った（何時代？）", "飛鳥時代", false],
      ["藤原道長：摂関政治の最盛期（何時代？）", "平安時代", false],
    ].sort());
    // The century card has its own box: 世紀, at most two digits; a wrong answer shows the right one.
    await page.evaluate(() => {
      flashcardCurrentIndex = flashcardOriginQueue.findIndex((q) => q.termKey.startsWith("c:"));
      window.renderFlashcardDeck();
    });
    const panel = page.locator(".term-answer-panel");
    await panel.waitFor({ state: "visible" });
    assert.equal(await panel.locator("label").innerText(), "世紀を入力");
    assert.equal(await page.locator("#termYearInput").getAttribute("maxlength"), "2");
    await page.locator("#termYearInput").fill("13");
    await panel.locator("button").click();
    assert.equal(await panel.locator("p").textContent(), "正解は 12 世紀");
    // An era card is not typed: the box is hidden.
    await page.evaluate(() => {
      clearTimeout(0);
      flashcardCurrentIndex = flashcardOriginQueue.findIndex((q) => q.termKey.startsWith("e:"));
      window.renderFlashcardDeck();
    });
    assert.equal(await panel.isVisible(), false);
    await page.evaluate(() => window.closeFlashcard?.() || window.showVocabLibrarySelection?.());

    // The word list marks the century and the era, each as its own question.
    const marks = await page.evaluate(() => {
      const w = vocabList.find((x) => x.word === "源頼朝");
      return [...window.createVocabCard(w).querySelectorAll("mark.term-mark")].map((m) => m.textContent);
    });
    assert.deepEqual(marks, ["12世紀", "鎌倉幕府", "鎌倉時代"]);

    // The edit box: "平安" is said back as 平安時代; something else is refused without changing anything.
    await page.evaluate(() => {
      window.switchTab("vocab");
    });
    await page.locator("#vocabLibraryBooks .textbook-list-item").filter({ hasText: "時代テスト" }).click();
    // (The list keeps the search and range of before: all words are shown here.)
    await page.locator("#vocabSearchInput").fill("");
    await page.locator("#vocabRangeStart").fill("");
    await page.locator("#vocabRangeEnd").fill("");
    await page.locator("#vocabListContainer .word-row-container").first().waitFor();
    const card = page.locator("#vocabListContainer .word-row-container").filter({ hasText: "藤原道長" });
    await card.locator(".card-edit-btn").click();
    const box = card.locator(".inline-year-input");
    assert.equal(await box.inputValue(), "平安時代");
    assert.equal(await card.locator("textarea[class*=inline-m-input]").first().inputValue(), "摂関政治の最盛期");
    await box.fill("abc");
    await box.blur();
    assert.equal(await box.evaluate((e) => e.classList.contains("is-invalid")), true);
    await card.getByRole("button", { name: "保存する" }).click();
    const note = page.locator("dialog.app-alert");
    await note.waitFor();
    assert.match(await note.locator("p").innerText(), /「1582」「12世紀」「平安時代」/);
    await note.getByRole("button", { name: "OK" }).click();
    assert.equal(await page.evaluate(() => vocabList.find((w) => w.word === "藤原道長").meanings[0].text), "平安時代 摂関政治の最盛期");
    await box.fill("12 世紀");
    await box.blur();
    assert.equal(await box.inputValue(), "12世紀");
    await box.fill("鎌倉");
    await box.blur();
    assert.equal(await box.inputValue(), "鎌倉時代");
    await card.getByRole("button", { name: "保存する" }).click();
    await note.waitFor();
    assert.match(await note.locator("p").innerText(), /更新しました/);
    await note.getByRole("button", { name: "OK" }).click();
    await page.waitForFunction(() => vocabList.find((w) => w.word === "藤原道長").meanings[0].text.startsWith("鎌倉時代"));
    assert.equal(await page.evaluate(() => vocabList.find((w) => w.word === "藤原道長").meanings[0].text), "鎌倉時代 摂関政治の最盛期");
    assert.deepEqual(errors, []);
    console.log("PASS: a century and an era at the start of a line: cards in the add form, century typed as its number, era as a card, marks in the word list, the edit box says 平安 as 平安時代 and refuses the rest");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
