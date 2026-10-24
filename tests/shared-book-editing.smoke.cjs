// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/shared-book-editing.smoke.cjs
// Shared word books: an administrator edits the original in an editing mode that stays on after
// the admin tools close; anyone can copy one into their own books (with understanding) to edit.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const base = process.env.APP_URL || "http://127.0.0.1:8000";
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
    await page.goto(base);
    await page.getByRole("button", { name: "ゲストとしてテストプレイ" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    // A shared (distributed) book, and a cloud that records writes.
    await page.evaluate(() => {
      window.__writes = [];
      window.db = {};
      window.fbDoc = (_, ...parts) => ({ path: parts.join("/") });
      window.fbSetDoc = async (ref, data) => { __writes.push({ path: ref.path, data: JSON.parse(JSON.stringify(data)) }); };
      window.fbGetDoc = async () => ({ exists: () => false, data: () => ({}) });
      localStorage.setItem("core_v4_cache_shared-1", JSON.stringify([{ num: 1, word: "study", meaning: "勉強する" }, { num: 2, word: "apple", meaning: "りんご" }]));
      textbooksPool.push({ id: "shared-1", name: "配信単語" });
      window.verifyAdminPassword = () => true;
    });
    await page.locator("#nav-vocab").click();
    await page.evaluate(() => window.renderVocabLibrarySelection());
    await page.locator("#vocabLibraryBooks .textbook-list-item", { hasText: "配信単語" }).click();
    await page.waitForFunction(() => currentTextbook === "shared-1" && vocabList.length === 2 && !window.__vocabSelectionRequest);
    // Not editable for a user.
    assert.equal(await page.locator("#vocabListContainer .card-edit-btn").count(), 0);
    await page.evaluate(() => window.updateMeaningStatus("1", vocabList[0].meanings[0].id, "ok"));

    // Administrator: the editing mode stays on after the admin tools close.
    await page.evaluate(() => window.AdminPlayers.open());
    await page.locator(".admin-players-dialog input[type=password]").fill("x");
    await page.locator(".admin-players-dialog [type=submit]").click();
    await page.getByRole("button", { name: "配信中の単語帳を編集する" }).click();
    await page.locator("#adminBookEditingBanner").waitFor();
    assert.equal(await page.evaluate(() => window.isAdmin), true);
    await page.locator("#nav-vocab").click();
    await page.locator("#vocabLibraryBooks .textbook-list-item", { hasText: "配信単語" }).click();
    await page.waitForFunction(() => currentTextbook === "shared-1" && !window.__vocabSelectionRequest);
    await page.locator("#vocabListContainer .card-edit-btn").first().waitFor();
    await page.locator('#vocabListContainer [data-word-num="2"] .card-edit-btn').click();
    await page.locator("#inlineEditWordInput-2").fill("apples");
    await page.locator("#wordCardForm-2").getByRole("button", { name: "保存する" }).click();
    await page.locator("dialog.app-alert button").click();
    await page.waitForFunction(() => __writes.some((w) => w.path === "shared/vocab_shared-1" && w.data.custom_words.some((x) => x.word === "apples")));
    await page.locator("#adminBookEditingBanner").getByRole("button", { name: "終了" }).click();
    assert.equal(await page.evaluate(() => window.isAdmin), false);
    assert.equal(await page.locator("#adminBookEditingBanner").count(), 0);
    assert.equal(await page.locator("#vocabListContainer .card-edit-btn").count(), 0);

    // A user: copy into their own books, with the understanding, the original leaving the list.
    await page.evaluate(() => window.showVocabLibrarySelection());
    await page.getByRole("button", { name: "配信単語の管理", exact: true }).click();
    await page.getByRole("button", { name: "自分用にコピーして編集" }).click();
    await page.getByRole("button", { name: "コピーする" }).click();
    await page.waitForFunction(() => /^personal_/.test(currentTextbook) && vocabList.length === 2 && !window.__vocabSelectionRequest);
    const copy = await page.evaluate(() => ({
      name: textbooksPool.find((b) => b.id === currentTextbook).name,
      own: window.isPersonalTextbook(currentTextbook),
      words: vocabList.map((w) => w.word),
      rated: vocabList[0].meanings[0].status,
      originalListed: textbooksPool.some((b) => b.id === "shared-1"),
    }));
    assert.deepEqual(copy, { name: "配信単語（自分用）", own: true, words: ["study", "apples"], rated: "ok", originalListed: false });
    await page.locator("#vocabListContainer .card-edit-btn").first().waitFor();
    assert.deepEqual(errors, []);
    console.log("PASS: admin editing mode keeps rights after the tools close and edits the original, ends on 終了; copy to own book keeps words and understanding and hides the original");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
