// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/word-links.smoke.cjs
// Links between words (同義語・反意語・関連) set in the editor by headword or number, shown on the
// card, opening the linked word's card, kept both ways and in the saved words; a meaning's part of
// speech shown before it, also settable in 用語・年号モード.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
    });
    await page.goto(process.env.APP_URL || "http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-vocab").click();
    await page.getByRole("button", { name: "＋ 単語帳を作る", exact: true }).click();
    await page.locator("#libraryBookName").fill("リンク");
    await page.locator("#libraryBookTermMode").check();
    await page.locator("#libraryBookWords").fill("1:consider:〜を考慮する:\n2:regard:〜とみなす:\n3:ignore:〜を無視する:");
    await page.getByRole("button", { name: "単語帳を作る", exact: true }).click();
    await page.locator("#vocabLibraryBooks .textbook-list-item").filter({ hasText: "リンク" }).click();
    await page.locator('.word-row-container[data-word-num="1"]').waitFor();
    const closeMessages = async () => {
      while (await page.locator("dialog.app-alert[open]").count()) await page.locator("dialog.app-alert[open] button").first().click();
    };
    // Edit consider: a part of speech for its meaning (also in 用語・年号モード) and two links.
    await page.locator('.word-row-container[data-word-num="1"] .card-edit-btn').click();
    await page.locator("#inlineEditMeaningsList-1 .inline-pos-input").selectOption("動");
    const links = page.locator("#inlineEditLinks-1");
    await links.locator(".inline-link-kind").selectOption("syn");
    await links.locator(".inline-link-input").fill("Regard");
    await links.getByRole("button", { name: "追加", exact: true }).click();
    await links.locator(".inline-link-kind").selectOption("ant");
    await links.locator(".inline-link-input").fill("#3");
    await links.getByRole("button", { name: "追加", exact: true }).click();
    // Unknown words and the word itself are refused in plain words.
    await links.locator(".inline-link-input").fill("nothing");
    await links.getByRole("button", { name: "追加", exact: true }).click();
    assert.match(await links.locator(".inline-links-message").innerText(), /見つかりません/);
    await links.locator(".inline-link-input").fill("consider");
    await links.getByRole("button", { name: "追加", exact: true }).click();
    assert.match(await links.locator(".inline-links-message").innerText(), /自分自身/);
    assert.deepEqual(await links.locator(".inline-link-chip").allTextContents(), ["同義語：regard×", "反意語：ignore×"]);
    await page.locator("#wordCardForm-1").getByRole("button", { name: "保存する", exact: true }).click();
    await closeMessages();
    const saved = await page.evaluate(() => vocabList.map((w) => ({ num: String(w.num), links: w.links || [], pos: w.meanings[0].partOfSpeech })));
    assert.deepEqual(saved[0].links, [{ num: "2", kind: "syn" }, { num: "3", kind: "ant" }]);
    assert.equal(saved[0].pos, "動");
    // The same both ways.
    assert.deepEqual(saved[1].links, [{ num: "1", kind: "syn" }]);
    assert.deepEqual(saved[2].links, [{ num: "1", kind: "ant" }]);
    // Kept in the saved words.
    assert.deepEqual(await page.evaluate(() => window.stripVocabProgressFromWords(vocabList)[0].links), [{ num: "2", kind: "syn" }, { num: "3", kind: "ant" }]);
    // On the card: the part of speech before the meaning, and the links; a link opens that word's card.
    const card = page.locator('#vocabListContainer .word-row-container[data-word-num="1"]');
    assert.equal(await card.locator(".vocab-meaning-pos").first().innerText(), "動");
    assert.deepEqual(await card.locator(".vocab-word-links").innerText().then((t) => t.replace(/\s+/g, " ").trim()), "同義語 regard 反意語 ignore");
    await card.getByRole("button", { name: "同義語「regard」のカードを開く" }).click();
    await page.locator("#flashcardWordDetails.is-open #flashcardDetailContent .word-row-container").waitFor();
    assert.match(await page.locator("#flashcardDetailContent .word-row-container").innerText(), /regard/);
    // From there, back to consider.
    await page.locator("#flashcardDetailContent").getByRole("button", { name: "同義語「consider」のカードを開く" }).click();
    await page.waitForFunction(() => /consider/.test(document.querySelector("#flashcardDetailContent .word-row-container")?.innerText || ""));
    await page.evaluate(() => window.closeFlashcardWordDetails());
    // Taking a link off removes it from the other word too.
    await page.locator('#vocabListContainer .word-row-container[data-word-num="1"] .card-edit-btn').click();
    await page.locator("#inlineEditLinks-1").getByRole("button", { name: "ignoreへのリンクを外す" }).click();
    await page.locator("#wordCardForm-1").getByRole("button", { name: "保存する", exact: true }).click();
    await closeMessages();
    assert.deepEqual(await page.evaluate(() => vocabList.map((w) => w.links || [])), [[{ num: "2", kind: "syn" }], [{ num: "1", kind: "syn" }], []]);
    assert.deepEqual(errors, []);
    console.log("PASS: links by headword or number (unknown and self refused), shown on the card, opening the linked card, kept both ways and in the saved words, removed both ways; part of speech per meaning in 用語・年号モード shown before the meaning");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
