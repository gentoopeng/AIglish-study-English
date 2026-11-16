// 用語・年号モード and 「」 cards after 中断 → 続きから: the questions come back as they were (a year to type, a 「」 blank), not
// as plain word cards. An ordinary word card is still rebuilt from the word (nothing extra is kept for it).
const { chromium } = require("playwright"), assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }), errors = [];
    page.setDefaultTimeout(10000);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => { errors.push("dialog: " + d.message()); d.accept(); });
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => { localStorage.setItem("b3_tutorial_done", "1"); localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false })); });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true && window.TermQuestions && window.FlashCheckpoint);
    await page.locator("#nav-vocab").click();
    const make = async (name, words, term) => {
      await page.evaluate(() => { window.switchTab("vocab"); window.showVocabLibrarySelection(); });
      await page.getByRole("button", { name: "＋ 単語帳を作る", exact: true }).click();
      await page.locator("#libraryBookName").fill(name);
      if (term) await page.locator("#libraryBookTermMode").check();
      await page.locator("#libraryBookWords").fill(words);
      await page.getByRole("button", { name: "単語帳を作る", exact: true }).click();
      await page.locator("#vocabLibraryBooks .textbook-list-item").filter({ hasText: name }).click();
      await page.locator("#vocabAddWord").waitFor({ state: "visible" });
      return page.evaluate(() => currentTextbook);
    };
    const startCards = async (name) => {
      await page.evaluate(() => { flashcardOriginQueue = []; window.switchTab("vocab"); window.showVocabLibrarySelection(); });
      await page.getByRole("button", { name: name + "の学習方法を選ぶ" }).click();
      await page.getByRole("button", { name: "単語カード", exact: true }).click();
      await page.getByRole("button", { name: "カードを開始する" }).click();
      await page.waitForFunction(() => flashcardOriginQueue.length > 0 && document.getElementById("activeFlashcard"));
    };
    const shape = () => page.evaluate(() => flashcardOriginQueue.map((q) => [q.termKey || "", q.en, q.ja, !!q.termInput, !!q.questionFirst]));
    const suspendAndResume = async (book) => {
      await page.getByRole("button", { name: "中断", exact: true }).click();
      await page.waitForFunction(() => document.getElementById("nav-vocab").classList.contains("active"));
      await page.evaluate(() => { flashcardOriginQueue = []; });
      await page.evaluate((b) => window.FlashCheckpoint.resume(b), book);
      await page.waitForFunction(() => flashcardOriginQueue.length > 0 && document.getElementById("activeFlashcard"));
    };

    // A book in 用語・年号モード: whole, year (typed) and 「」 questions.
    const history = await make("日本史", "1:織田信長:①1582 「本能寺の変」で死亡したとされる人物②1575「長篠の戦い」では「武田勝頼」を破った:", true);
    await startCards("日本史");
    const before = await shape();
    assert.ok(before.some((q) => q[3]), "a year question to type");
    assert.ok(before.some((q) => /^t:/.test(q[0])), "a 「」 question");
    assert.ok(before.length >= 6);
    await suspendAndResume(history);
    assert.deepEqual(await shape(), before, "the same questions after 続きから");
    // The year question still has its box to type in.
    await page.evaluate(() => { flashcardCurrentIndex = flashcardOriginQueue.findIndex((q) => q.termInput); window.renderFlashcard ? window.renderFlashcard() : 0; });
    const saved = await page.evaluate((b) => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /flash_queue/.test(k) && k.includes(b))) || "{}"), history);
    assert.equal((saved.items || []).every((i) => i.card && i.card.termKey), true, "kept as they were made");
    await page.getByRole("button", { name: "中断", exact: true }).click();

    // An ordinary book: nothing extra is kept, and it resumes as before.
    const english = await make("英単語", "1:apple:りんご:\n2:book:本:", false);
    await startCards("英単語");
    const plain = await shape();
    await suspendAndResume(english);
    assert.deepEqual((await shape()).map((q) => [q[1], q[2]]), plain.map((q) => [q[1], q[2]]));
    const savedPlain = await page.evaluate((b) => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /flash_queue/.test(k) && k.includes(b))) || "{}"), english);
    assert.equal((savedPlain.items || []).some((i) => i.card), false);
    assert.deepEqual(errors, []);
    console.log("term resume smoke passed");
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
