// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/minor-meanings.smoke.cjs
// A meaning can be marked あまり使わない: it shows under the main meanings, smaller, keeps its
// own rating, gets its own flashcard (labelled), survives saving and a restart, and the mark
// can be set or cleared in the word's edit form; a pasted list marks one with 「［まれ］」.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
    });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-vocab").click();
    await page.getByRole("button", { name: "＋ 単語帳を作る", exact: true }).click();
    await page.locator("#libraryBookName").fill("まれな意味");
    await page.locator("#libraryBookWords").fill("1:study:勉強する:\n3:run:①走る②［まれ］〜を経営する:");
    await page.getByRole("button", { name: "単語帳を作る", exact: true }).click();
    await page.locator("#vocabLibraryBooks .textbook-list-item").filter({ hasText: "まれな意味" }).click();
    await page.locator("#vocabAddWord").waitFor({ state: "visible" });
    // A list marks one with 「［まれ］」.
    assert.deepEqual(await page.evaluate(() => vocabList.find((w) => String(w.num) === "3").meanings.map((m) => [m.text, m.minor === true])), [["走る", false], ["〜を経営する", true]]);

    // Add a word with a main meaning and a seldom-used one.
    await page.locator("#vocabAddWord").click();
    await page.locator("#vocabEntryWord").fill("follow");
    const rows = page.locator(".vocab-entry-meaning");
    await rows.nth(0).locator("textarea").fill("〜に従う");
    await page.getByRole("button", { name: "＋ 意味を追加" }).click();
    await rows.nth(1).locator("textarea").fill("〜を理解する");
    await rows.nth(1).getByLabel("あまり使わない意味").check();
    assert.equal(await rows.nth(0).getByLabel("あまり使わない意味").isChecked(), false);
    await page.getByRole("button", { name: "追加する", exact: true }).click();
    await page.locator(".vocab-entry-dialog").waitFor({ state: "detached" });
    const card = page.locator('#vocabListContainer .word-row-container[data-word-num="4"]');
    await card.waitFor();
    // Main first, then the heading and the seldom-used one, smaller.
    assert.deepEqual(await card.locator(".vocab-meaning-text").allInnerTexts(), ["〜に従う", "〜を理解する"]);
    assert.equal(await card.locator(".vocab-minor-heading").innerText(), "あまり使わない意味");
    const sizes = await card.locator(".vocab-meaning-text").evaluateAll((list) => list.map((e) => parseFloat(getComputedStyle(e).fontSize)));
    assert.ok(sizes[1] < sizes[0], JSON.stringify(sizes));
    // Its own rating.
    await card.locator(".vocab-meaning-minor button", { hasText: "✕" }).dispatchEvent("pointerdown");
    const state = await page.evaluate(() => vocabList.find((w) => String(w.num) === "4").meanings.map((m) => [m.text, m.status, m.minor === true]));
    assert.deepEqual(state, [["〜に従う", "none", false], ["〜を理解する", "bad", true]]);
    // Kept in the book's words (what is saved and shared).
    assert.deepEqual(await page.evaluate(() => window.stripVocabProgressFromWords(vocabList).find((w) => String(w.num) === "4").meanings.map((m) => m.minor === true)), [false, true]);

    // Flashcards: one card per meaning, the seldom-used one labelled.
    await page.evaluate(() => window.showVocabLibrarySelection());
    await page.getByRole("button", { name: "まれな意味の学習方法を選ぶ" }).click();
    await page.getByRole("button", { name: "単語カード", exact: true }).click();
    await page.getByRole("button", { name: "カードを開始する" }).click();
    await page.waitForFunction(() => flashcardOriginQueue.length > 0);
    const queue = await page.evaluate(() => flashcardOriginQueue.map((c) => [c.ja, c.minor === true]).sort());
    assert.deepEqual(queue, [["〜に従う", false], ["〜を理解する", true], ["〜を経営する", true], ["勉強する", false], ["走る", false]]);
    // Show the minor card and check its label.
    await page.evaluate(() => {
      const i = flashcardOriginQueue.findIndex((c) => c.minor);
      flashcardCurrentIndex = i;
      window.renderFlashcardDeck();
    });
    const label = page.locator("#flashcardPartOfSpeech");
    assert.match(await label.innerText(), /あまり使わない意味/);
    await page.locator("#flashcard-play-screen").getByRole("button", { name: "中断", exact: true }).click();

    // Restart: the mark and the rating stay.
    await page.reload();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-vocab").click();
    await page.locator("#vocabLibraryBooks .textbook-list-item").filter({ hasText: "まれな意味" }).click();
    await card.waitFor();
    assert.equal(await card.locator(".vocab-minor-heading").count(), 1);
    assert.deepEqual(await page.evaluate(() => vocabList.find((w) => String(w.num) === "4").meanings.map((m) => [m.status, m.minor === true])), [["none", false], ["bad", true]]);

    // The edit form clears the mark: the meaning joins the main ones, its rating kept.
    await card.locator(".card-edit-btn").click();
    const box = page.getByLabel("意味2はあまり使わない意味");
    assert.equal(await box.isChecked(), true);
    await box.uncheck();
    await page.locator("#wordCardForm-4").getByRole("button", { name: "保存する" }).click();
    await page.locator("dialog.app-alert button").click();
    assert.equal(await card.locator(".vocab-minor-heading").count(), 0);
    assert.deepEqual(await page.evaluate(() => vocabList.find((w) => String(w.num) === "4").meanings.map((m) => [m.status, m.minor === true])), [["none", false], ["bad", false]]);
    assert.deepEqual(errors, []);
    console.log("PASS: a seldom-used meaning added from the form shows under the main ones, smaller, with its own rating and flashcard, is kept when saved and after a restart, and can be cleared in the edit form");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
