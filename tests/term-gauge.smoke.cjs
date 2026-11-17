// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/term-gauge.smoke.cjs
// 用語・年号モード: the book list's ○△×ー gauge counts questions (whole, year, each 「」), each by its own
// record or the rating it goes by; a word book still counts meanings.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => localStorage.setItem("b3_tutorial_done", "1"));
    await page.goto(process.env.APP_URL || "http://127.0.0.1:8000", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.openBookFlashcardSettings && window.__saveCoordinatorApplied);
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    const stats = await page.evaluate(() => {
      textbooksPool = [
        { id: "gterms", name: "用語の本", cover: "📘", termMode: true },
        { id: "gwords", name: "単語の本", cover: "📗" },
      ];
      // Word 1: whole + year + two 「」 = 4 questions; word 2: whole + one 「」 = 2; word 3: an empty line, counted as its meaning.
      const terms = [
        { num: 1, word: "長篠の戦い", meaning: "", meanings: [{ id: "1-0", text: "1575 「織田信長」が「武田勝頼」を破った", status: "so" }] },
        { num: 2, word: "楽市楽座", meaning: "", meanings: [{ id: "2-0", text: "「織田信長」が出した", status: "bad" }] },
        { num: 3, word: "空", meaning: "", meanings: [{ id: "3-0", text: "", status: "ok" }] },
      ];
      textbooksCacheMap.gterms = terms;
      textbooksCacheMap.gwords = [{ num: 1, word: "apple", meanings: [{ id: "1-0", text: "りんご", status: "ok" }, { id: "1-1", text: "林檎", status: "none" }] }];
      const keys = window.TermQuestions.questions(terms[0]).map((q) => q.key).concat(window.TermQuestions.questions(terms[1]).map((q) => q.key));
      // Word 1's year answered ○ and its first 「」 ×; the rest go by their lines (△ for word 1, × for word 2).
      window.TermProgress.save("gterms", 1, "y:1-0", "ok");
      window.TermProgress.save("gterms", 1, "t:1-0:0", "bad");
      window.switchTab("vocab");
      window.showVocabLibrarySelection();
      return { keys, term: window.getTextbookMasteryStats("gterms"), word: window.getTextbookMasteryStats("gwords") };
    });
    assert.deepEqual(stats.keys, ["w", "y:1-0", "t:1-0:0", "t:1-0:1", "w", "t:2-0:0"]);
    // 6 questions + the line of word 3: ○ y:1-0 and word 3, △ w and t:1-0:1, × t:1-0:0 and both of word 2.
    assert.deepEqual([stats.term.ok, stats.term.so, stats.term.bad, stats.term.none, stats.term.total], [2, 2, 3, 0, 7]);
    assert.equal(stats.term.percent, Math.round((2 / 7) * 100));
    // A word book: one per meaning, as before.
    assert.deepEqual([stats.word.ok, stats.word.none, stats.word.total], [1, 1, 2]);
    // The list shows the counts.
    const text = await page.locator(".textbook-list-progress-text").allInnerTexts();
    assert.ok(text.some((t) => /○2\s+△2\s+×3\s+ー0/.test(t)), JSON.stringify(text));
    assert.deepEqual(errors, []);
    console.log("term-gauge smoke ok");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
