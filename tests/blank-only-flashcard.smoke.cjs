// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/blank-only-flashcard.smoke.cjs
// In an ordinary word book (not 用語・年号モード) a meaning set to 「」の問題だけ gives only its
// 「」 card — 「consideration」 asks "consideration", not the headword "consider" — and the card's
// rating goes to that meaning. Meanings without the setting stay ordinary cards.
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
      textbooksPool = [{ id: "plain", name: "ふつうの本", cover: "📗" }];
      textbooksCacheMap.plain = [
        {
          num: 1,
          word: "consider",
          meaning: "考える",
          meanings: [
            { id: "1-0", text: "考える" },
            { id: "1-1", text: "「consideration」\n考慮、思いやり", blankOnly: true, partOfSpeech: "名" },
            { id: "1-2", text: "「considerate」\n思いやりのある" },
            { id: "1-3", text: "+ A + 「as」 B\nAをBとみなす" },
            { id: "1-4", text: "「の」は大事" },
          ],
        },
      ];
      window.switchTab("vocab");
      window.showVocabLibrarySelection();
    });
    await page.getByRole("button", { name: "ふつうの本の学習方法を選ぶ" }).click();
    await page.getByRole("button", { name: "単語カード", exact: true }).click();
    await page.locator("dialog[open]").waitFor();
    await page.evaluate(() => window.startFlashcardFromSettings());
    await page.waitForFunction(() => typeof flashcardOriginQueue !== "undefined" && flashcardOriginQueue.length > 0);
    const deck = await page.evaluate(() => flashcardOriginQueue.map((c) => [c.meaningId, c.en, c.ja, !!c.termCard]).sort());
    assert.deepEqual(deck, [
      ["1-0", "consider", "考える", false],
      // 「」の問題だけ: the 「」 term is asked, not the headword.
      ["1-1", "consideration", "考慮、思いやり", true],
      // An English line over a Japanese line is its own card without any setting.
      ["1-2", "considerate", "思いやりのある", true],
      ["1-3", "consider A as B", "AをBとみなす", true],
      // A 「」 inside an ordinary explanation, without the setting, stays an ordinary card.
      ["1-4", "consider", "「の」は大事", false],
    ]);
    // Shown first, the 「」 card's front is the term; a right swipe rates that meaning ○.
    await page.evaluate(() => {
      const card = flashcardOriginQueue.find((c) => c.meaningId === "1-1");
      flashcardOriginQueue = [card].concat(flashcardOriginQueue.filter((c) => c !== card));
      flashcardCurrentIndex = 0;
      window.renderFlashcardDeck();
    });
    const front = await page.locator(".flashcard-face-front").first().innerText();
    assert.match(front, /consideration/);
    assert.doesNotMatch(front, /^#?\d*\s*consider$/m);
    await page.evaluate(() => window.swipeFlashcard("right"));
    await page.waitForFunction(() => vocabList.find((w) => w.num === 1)?.meanings[1].status === "ok");
    assert.equal(await page.evaluate(() => vocabList.find((w) => w.num === 1).meanings[0].status || "none"), "none");
    // 意味を先に: the + A + 「as」 B card hides "as" and asks for it.
    await page.evaluate(() => {
      flashcardDirectionMode = "ja2en";
      const card = flashcardOriginQueue.find((c) => c.meaningId === "1-3");
      flashcardOriginQueue = [card];
      flashcardCurrentIndex = 0;
      window.renderFlashcardDeck();
    });
    const asked = await page.locator(".flashcard-face-front").first().innerText(),
      answer = await page.locator(".flashcard-face-back").first().evaluate((el) => el.innerText || el.textContent);
    assert.match(asked, /consider A （＿＿） B/);
    assert.match(asked, /AをBとみなす/);
    assert.match(answer, /^as(\n|consider)/m);
    assert.deepEqual(errors, []);
    console.log("PASS: in an ordinary book an English-over-Japanese meaning and a 「」の問題だけ meaning give their 「」 card (意味を先に hides as), rated on the meaning; other meanings stay ordinary cards");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
