// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/term-flashcard-filter.smoke.cjs
// 用語・年号モード cards filtered by understanding: a question with no record of its own goes by
// its meaning's rating (what the word list shows), so ratings made before the mode was turned on
// still count; a question's own record wins over its meaning.
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
    await page.evaluate(() => {
      textbooksPool = [{ id: "terms", name: "用語の本", cover: "📘", termMode: true }];
      const list = [];
      for (let i = 1; i <= 10; i++) list.push({ num: i, word: "用語" + i, meaning: "「人物" + i + "」が作った", meanings: [{ id: i + "-0", text: "「人物" + i + "」が作った" }] });
      textbooksCacheMap.terms = list;
      const words = window.migrateVocabData(list),
        progress = {};
      // Words 1–6 were rated × before the mode was on; 7–10 never.
      for (let i = 1; i <= 6; i++) progress[i] = { sig: window.buildWordSignature(words[i - 1]), status: "bad", history: ["bad"], meanings: { [i + "-0"]: { status: "bad", history: ["bad"] } } };
      localStorage.setItem("core_v4_user_vocab_progress_GUEST-000_terms", JSON.stringify(progress));
      // Word 1's whole question was since answered ○ in this mode.
      window.TermProgress.save("terms", 1, "w", "ok");
      window.switchTab("vocab");
      window.showVocabLibrarySelection();
    });
    await page.getByRole("button", { name: "用語の本の学習方法を選ぶ" }).click();
    await page.getByRole("button", { name: "単語カード", exact: true }).click();
    await page.locator("dialog[open]").waitFor();
    await page.evaluate(() => ["ok", "so", "none"].forEach((s) => window.toggleFlashcardStatusFilter(s)));
    await page.evaluate(() => window.startFlashcardFromSettings());
    await page.waitForFunction(() => typeof flashcardOriginQueue !== "undefined" && flashcardOriginQueue.length > 0);
    const deck = await page.evaluate(() => flashcardOriginQueue.map((c) => c.num + ":" + c.termKey).sort());
    // Words 2–6: the whole entry and the blank; word 1: only the blank (its whole question is ○).
    const expected = ["1:t:1-0:0"];
    for (let i = 2; i <= 6; i++) expected.push(i + ":w", i + ":t:" + i + "-0:0");
    assert.deepEqual(deck, expected.sort());
    assert.deepEqual(errors, []);
    console.log("PASS: term-mode cards filtered by ×: unanswered questions follow their meaning's rating, a question's own record wins");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
