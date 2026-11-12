// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/today-study.smoke.cjs
// 今日の学習: the card at the top of the home screen for the book the player is on: flashcards (start, or go on where they
// stopped) and 苦手復習 with how many meanings are waiting; it opens what already exists.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 800 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
    });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true && window.TodayStudy && window.WeakReview);
    await page.evaluate(() => {
      textbooksPool = [{ id: "today-book", name: "今日の本" }];
      const words = migrateVocabData(Array.from({ length: 8 }, (_, i) => ({ num: i + 1, word: "word" + (i + 1), meanings: [{ id: i + 1 + "-0", text: "意味" + (i + 1) }] })));
      textbooksCacheMap["today-book"] = words;
      const progress = {};
      for (const word of words)
        progress[word.num] = {
          sig: buildWordSignature(word),
          editedAt: Date.now() - 86400000 * 2,
          status: word.num <= 3 ? "bad" : "ok",
          meanings: Object.fromEntries(word.meanings.map((m) => [m.id, { status: word.num <= 3 ? "bad" : "ok", history: ["bad"] }])),
        };
      localStorage.setItem("core_v4_user_vocab_progress_GUEST-000_today-book", JSON.stringify(progress));
      localStorage.setItem("core_v4_current_textbook_id", "today-book");
      currentTextbook = "today-book";
      window.TextbookFiles.getWords = async () => words;
      switchTab("vocab");
      showVocabLibrarySelection();
    });
    const card = page.locator("#todayStudy");
    await card.waitFor();
    assert.match(await card.innerText(), /今日の本/);
    assert.equal(await card.locator(".today-study-main").innerText(), "単語カードを始める");
    // 3 words were marked × before today: 3 meanings are waiting.
    await page.waitForFunction(() => /苦手復習（3）/.test(document.querySelector("#todayStudy")?.innerText || ""));
    assert.equal(await card.locator(".today-study-sub").isDisabled(), false);
    if (process.env.SHOTS) await page.screenshot({ path: "/tmp/claude-0/today_card.png" });
    // 苦手復習 opens the review screen from the card.
    await card.locator(".today-study-sub").click();
    await page.locator("dialog.weak-review-screen[open]").waitFor();
    await page.evaluate(() => document.querySelector("dialog.weak-review-screen")?.close());
    // "ほかの勉強方法" opens the study menu.
    await card.locator(".today-study-more").click();
    await page.locator("dialog.book-study-menu[open]").waitFor();
    await page.evaluate(() => document.querySelector("dialog.book-study-menu")?.close());
    // With a flashcard session saved, the main button goes on from where it stopped.
    await page.evaluate(() => {
      const id = "s1";
      localStorage.setItem("core_v4_flash_queue_GUEST-000_today-book", JSON.stringify({ id, direction: "en-ja", items: [1, 2, 3, 4].map((n) => ({ num: n, mid: n + "-0", index: n - 1, sig: "x" })) }));
      localStorage.setItem("core_v4_flash_cursor_GUEST-000_today-book", JSON.stringify({ id, index: 2, learned: 2, at: Date.now() }));
      window.renderVocabLibrarySelection();
    });
    assert.match(await card.locator(".today-study-main").innerText(), /続きから（2 \/ 4）/);
    // No weak meanings today: the button is off and says so.
    await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem("core_v4_user_vocab_progress_GUEST-000_today-book"));
      for (const w of Object.values(p)) { w.status = "ok"; for (const m of Object.values(w.meanings)) m.status = "ok"; }
      const raw = JSON.stringify(p);
      localStorage.setItem("core_v4_user_vocab_progress_GUEST-000_today-book", raw);
      localStorage.setItem("aiglish_learning_recovery_GUEST-000_today-book", raw);
      window.renderVocabLibrarySelection();
    });
    assert.match(await card.locator(".today-study-sub").innerText(), /今日はありません/);
    assert.equal(await card.locator(".today-study-sub").isDisabled(), true);
    // No current book: no card.
    await page.evaluate(() => { currentTextbook = ""; localStorage.removeItem("core_v4_current_textbook_id"); window.renderVocabLibrarySelection(); });
    assert.equal(await page.locator("#todayStudy").count(), 0);
    assert.deepEqual(errors, []);
    console.log("today study smoke passed");
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
