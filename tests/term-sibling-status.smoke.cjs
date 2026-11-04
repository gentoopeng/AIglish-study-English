// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/term-sibling-status.smoke.cjs
// 用語・年号モード: answering one question of a line (the year, ○) must not hide that line's other
// questions that were not answered yet. They go by the meaning's rating from before the first answer.
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
      for (let i = 1; i <= 3; i++) list.push({ num: i, word: "事件" + i, meaning: "", meanings: [{ id: i + "-0", text: 1500 + i + "年 「人物" + i + "」が起こした" }] });
      textbooksCacheMap.terms = list;
      window.switchTab("vocab");
      window.showVocabLibrarySelection();
    });
    const open = async () => {
      await page.getByRole("button", { name: "用語の本の学習方法を選ぶ" }).click();
      await page.getByRole("button", { name: "単語カード", exact: true }).click();
      await page.locator("dialog[open]").waitFor();
      // Not ○ (a filter that leaves out what is known).
      await page.evaluate(() => window.toggleFlashcardStatusFilter("ok"));
      await page.evaluate(() => window.startFlashcardFromSettings());
      await page.waitForFunction(() => typeof flashcardOriginQueue !== "undefined" && flashcardOriginQueue.length >= 0 && document.getElementById("activeFlashcard") || document.body.classList.contains("in-game-active"));
      return page.evaluate(() => flashcardOriginQueue.map((c) => c.num + ":" + c.termKey).sort());
    };
    const all = ["w", "y:1-0", "t:1-0:0"];
    assert.deepEqual((await open()).filter((k) => k.startsWith("1:")), all.map((k) => "1:" + k).sort());
    // Word 1's year question answered ○.
    await page.evaluate(() => {
      const at = flashcardOriginQueue.findIndex((q) => q.termKey === "y:1-0");
      flashcardOriginQueue.unshift(flashcardOriginQueue.splice(at, 1)[0]);
      flashcardCurrentIndex = 0;
      window.renderFlashcardDeck();
      window.swipeFlashcard("right");
    });
    assert.deepEqual(await page.evaluate(() => window.TermProgress.read("terms")[1]["m:1-0"]), { base: "none" });
    await page.evaluate(() => window.quitFlashcardSession());
    // The year question is ○ and out; the whole question and the blank are still asked.
    assert.deepEqual((await open()).filter((k) => k.startsWith("1:")), ["1:t:1-0:0", "1:w"]);
    // A battle's wrong answer lowers a meaning rated ○ to ×: the rating from before it is kept first,
    // so the line's other questions still count as ○.
    const result = await page.evaluate(() => {
      const ref = { num: "2", mid: "2-0", count: 1, sig: window.buildWordSignature(vocabList.find((w) => String(w.num) === "2")), term: "y:2-0" };
      window.WordDuelProgress.apply("terms", ref, "ok", "GUEST-000");
      window.TermProgress.noteBaseFor("terms", ref);
      window.WordDuelProgress.apply("terms", ref, false, "GUEST-000", { onlyDowngrade: true });
      const now = window.LearningData.read("terms")["2"].meanings["2-0"].status;
      return { now, base: window.TermProgress.read("terms")[2]["m:2-0"], fallback: window.TermProgress.fallback(window.TermProgress.read("terms"), 2, "2-0", now) };
    });
    assert.deepEqual(result, { now: "bad", base: { base: "ok" }, fallback: "ok" });
    // The question itself had no record: it inherited ○, and the wrong answer makes it × (it must
    // not stay ○ and be hidden from a filter that leaves ○ out).
    const lowered = await page.evaluate(() => {
      const ref = { num: "3", mid: "3-0", count: 1, sig: window.buildWordSignature(vocabList.find((w) => String(w.num) === "3")), term: "y:3-0" };
      window.WordDuelProgress.apply("terms", ref, "ok", "GUEST-000");
      const inherited = window.TermProgress.noteBaseFor("terms", ref);
      window.WordDuelProgress.apply("terms", ref, false, "GUEST-000", { onlyDowngrade: true });
      window.TermProgress.battle("terms", 3, "y:3-0", false, false, inherited);
      return [inherited, window.TermProgress.read("terms")[3]["y:3-0"].status];
    });
    assert.deepEqual(lowered, ["ok", "bad"]);
    assert.deepEqual(errors, []);
    console.log("PASS: a ○ on a line's year question does not hide its other questions (they follow the rating from before the first answer)");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
