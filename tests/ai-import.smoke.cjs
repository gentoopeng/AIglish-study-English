// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/ai-import.smoke.cjs
// The 英単語帳 prompt and its output: pasted into a book (even inside a code block), each meaning
// becomes a card with its part of speech, line breaks kept; a later paste updates only its numbers.
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
      // Keep what is copied, without asking for clipboard permission.
      Object.defineProperty(navigator, "clipboard", { value: { writeText: async (text) => { window.__copied = text; } } });
    });
    await page.goto(process.env.APP_URL || "http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-vocab").click();
    await page.getByRole("button", { name: "＋ 単語帳を作る", exact: true }).click();
    // The prompt is there to copy (or shown to copy by hand where the clipboard is not allowed).
    await page.getByRole("button", { name: /英単語帳.*プロンプトをコピー/ }).click();
    const prompt = await page.evaluate(() => window.__copied || "");
    assert.match(prompt, /"words"/);
    assert.match(prompt, /\+ A \+ 「as」 B/);
    await page.locator("#libraryBookName").fill("システム英単語");
    await page.locator("#libraryBookTermMode").check();
    const answer = {
      words: [
        { num: 1, word: "follow", meanings: [{ text: "〜（の後）に続く", pos: "動" }, { text: "as follows\n次のように", pos: "" }, { text: "A be followed 「by」 B\nAの次にBが続く", pos: "" }], sub: "フレーズ・follow her advice 彼女の助言に従う" },
        { num: 2, word: "consider", meanings: [{ text: "〜を考慮する", pos: "動" }, { text: "+ A + 「as」 B\nAをBとみなす", pos: "動" }, { text: "consideration\n考慮，思いやり", pos: "名", minor: true }] },
      ],
    };
    await page.locator("#libraryBookWords").fill("```json\n" + JSON.stringify(answer, null, 1) + "\n```");
    await page.getByRole("button", { name: "単語帳を作る", exact: true }).click();
    await page.locator("#vocabLibraryBooks .textbook-list-item").filter({ hasText: "システム英単語" }).click();
    await page.locator('.word-row-container[data-word-num="2"]').waitFor();
    const words = await page.evaluate(() => vocabList.map((w) => ({ num: w.num, word: w.word, sub: w.sub, meanings: w.meanings.map((m) => [m.id, m.text, m.partOfSpeech || "", !!m.minor]) })));
    assert.deepEqual(words[1].meanings, [
      ["2-0", "〜を考慮する", "動", false],
      ["2-1", "+ A + 「as」 B\nAをBとみなす", "動", false],
      ["2-2", "consideration\n考慮，思いやり", "名", true],
    ]);
    assert.equal(words[0].sub, "フレーズ・follow her advice 彼女の助言に従う");
    // The cards are the ones the prompt is written for.
    const cards = await page.evaluate(() => window.TermQuestions.questions(vocabList[1]).map((q) => q.front !== undefined ? [q.front, q.back] : [q.answer, q.prompt]));
    assert.deepEqual(cards, [["consider", "〜を考慮する"], ["consider A as B", "AをBとみなす"], ["consideration", "考慮，思いやり"]]);
    // A later answer updates only its numbers; the others stay.
    await page.evaluate(() => {
      vocabList[0].unit = "stage1";
    });
    const updated = await page.evaluate((text) => window.parseVocabImport(text, vocabList).map((w) => [w.num, w.word, w.unit || "", w.meanings.length]), JSON.stringify({ words: [{ num: 1, word: "follow", meanings: ["〜に続く", "〈指示・方針など〉に従う"] }, { num: 3, word: "increase", meanings: [{ text: "増加する", pos: "動" }] }] }));
    assert.deepEqual(updated, [[1, "follow", "stage1", 2], [2, "consider", "", 3], [3, "increase", "", 1]]);
    // A broken answer is refused in plain words.
    const refused = await page.evaluate(() => { try { window.parseVocabImport("{ not json", []); return ""; } catch (e) { return e.message; } });
    assert.match(refused, /読み取れませんでした/);
    assert.deepEqual(errors, []);
    console.log("PASS: 英単語帳 prompt copied; its JSON (in a code block) becomes one card per meaning with part of speech, line breaks and まれ; a later answer updates only its numbers and keeps units; broken JSON refused");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
