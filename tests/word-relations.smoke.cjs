// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/word-relations.smoke.cjs
// Related words (10.153): a bulk line's 「同=… 反=…」 (a word of the book a link both ways, any other a related word);
// the card shows the ones that open (↗) apart from the ones just shown; the editor's two lists (related words take
// anything; a link to a word found in another book, chosen, opens that book); and where a word is used in every book.
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
    const make = async (name, lines) => {
      await page.getByRole("button", { name: "＋ 単語帳を作る", exact: true }).click();
      await page.locator("#libraryBookName").fill(name);
      await page.locator("#libraryBookWords").fill(lines);
      await page.getByRole("button", { name: "単語帳を作る", exact: true }).click();
      await page.locator("#vocabLibraryBooks .textbook-list-item").filter({ hasText: name }).waitFor();
    };
    const closeMessages = async () => {
      while (await page.locator("dialog.app-alert[open]").count()) await page.locator("dialog.app-alert[open] button").first().click();
    };
    await make("関連B", "1:comply:従う:\n2:obey:従う:");
    await make("関連A", "1:follow:従う::同=obey,comply 反=lead\n2:obey:従う:\n3:lead:導く:例文・comply with the rules\n4:guide:案内する:同=これはサブ情報");
    const bookId = (name) => page.evaluate((n) => textbooksPool.find((b) => b.name === n).id, name);
    const idA = await bookId("関連A"),
      idB = await bookId("関連B");
    await page.locator("#vocabLibraryBooks .textbook-list-item").filter({ hasText: "関連A" }).click();
    await page.locator('.word-row-container[data-word-num="1"]').waitFor();
    // The line's relations: obey and lead are words of this book (links, both ways); comply is not (a related word).
    const words = await page.evaluate(() => vocabList.map((w) => ({ links: w.links || [], related: w.related || [] })));
    assert.deepEqual(words[0].links, [{ num: "2", kind: "syn" }, { num: "3", kind: "ant" }]);
    assert.deepEqual(words[0].related, [{ text: "comply", kind: "syn" }]);
    assert.deepEqual(words[1].links, [{ num: "1", kind: "syn" }]);
    assert.deepEqual(words[2].links, [{ num: "1", kind: "ant" }]);
    // A サブ情報 that starts with 同= stays サブ情報 (relations only as a fifth part).
    assert.deepEqual(await page.evaluate(() => [vocabList[3].sub, vocabList[3].related || null]), ["同=これはサブ情報", null]);
    // On the card: the links as buttons that open, the related word as a plain mark.
    const card = page.locator('#vocabListContainer .word-row-container[data-word-num="1"]');
    assert.deepEqual(await card.locator(".vocab-link").allInnerTexts(), ["obey", "lead"]);
    assert.deepEqual(await card.locator(".vocab-related").allInnerTexts(), ["comply"]);
    assert.equal(await card.locator(".vocab-related").evaluate((el) => el.tagName), "SPAN", "a related word does not open anything");
    // The editor: a related word takes anything; a link to comply (not in this book) is found in 関連B and chosen.
    await card.locator(".card-edit-btn").click();
    const box = page.locator("#inlineEditLinks-1");
    await box.locator(".inline-related-input").fill("guide");
    await box.getByRole("button", { name: "関連語を追加" }).click();
    await box.locator(".inline-link-input").fill("comply");
    await box.getByRole("button", { name: "追加", exact: true }).click();
    await box.locator(".inline-link-choices button", { hasText: "関連B" }).click();
    // A word in no book is refused as a link (with a pointer to the related words).
    await box.locator(".inline-link-input").fill("nowhere");
    await box.getByRole("button", { name: "追加", exact: true }).click();
    await box.locator(".inline-links-message", { hasText: "単語帳にないです" }).waitFor();
    await page.locator("#wordCardForm-1").getByRole("button", { name: "保存する", exact: true }).click();
    await closeMessages();
    const follow = await page.evaluate(() => ({ links: vocabList[0].links, related: vocabList[0].related }));
    assert.deepEqual(follow.links, [{ num: "2", kind: "syn" }, { num: "3", kind: "ant" }, { num: "1", kind: "syn", book: idB, word: "comply" }]);
    assert.deepEqual(follow.related, [{ text: "comply", kind: "syn" }, { text: "guide", kind: "syn" }]);
    // Kept in the saved words (and comply in 関連B was not touched: a link to another book goes one way).
    assert.deepEqual(await page.evaluate(() => window.stripVocabProgressFromWords(vocabList)[0].related), follow.related);
    assert.deepEqual(await page.evaluate(() => window.stripVocabProgressFromWords(vocabList)[0].links[2]), { num: "1", kind: "syn", book: idB, word: "comply" });
    // The other book's link shows its book, and opens it.
    const card2 = page.locator('#vocabListContainer .word-row-container[data-word-num="1"]');
    const other = card2.locator(".vocab-link.is-other-book");
    assert.match(await other.innerText(), /comply\s*関連B/);
    await other.click();
    await page.waitForFunction((id) => currentTextbook === id, idB);
    await page.locator("#flashcardWordDetails.is-open #flashcardDetailContent .word-row-container").waitFor();
    assert.match(await page.locator("#flashcardDetailContent .word-row-container").innerText(), /comply/);
    // Where comply is used, in every book: lead in 関連A (its 補足); opening it goes back to 関連A.
    await page.locator("#flashcardDetailContent").getByRole("button", { name: "「comply」が使われている単語を全単語帳から探す" }).click();
    const uses = page.locator(".word-uses-list .word-use");
    await uses.first().waitFor();
    assert.deepEqual(await uses.locator("strong").allInnerTexts(), ["lead"]);
    assert.match(await uses.first().innerText(), /関連A #3・補足/);
    await uses.first().click();
    await page.waitForFunction((id) => currentTextbook === id, idA);
    await page.waitForFunction(() => /lead/.test(document.querySelector("#flashcardDetailContent .word-row-container")?.innerText || ""));
    assert.deepEqual(errors, []);
    console.log("word-relations smoke ok");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
