// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/term-prompt.smoke.cjs
// The 用語・年号モード prompt: copied from the word-book form, and its own example, pasted back,
// makes the questions it promises (a year or span at the start of a line, each 「」, blankOnly kept,
// no line giving its headword away).
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      window.__copied = [];
      Object.defineProperty(navigator, "clipboard", { value: { writeText: async (t) => window.__copied.push(t) }, configurable: true });
    });
    await page.goto(process.env.APP_URL || "http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-vocab").click();
    await page.getByRole("button", { name: "＋ 単語帳を作る", exact: true }).click();
    const button = page.locator("#libraryCopyTermPrompt");
    assert.match(await button.innerText(), /用語・年号モード/);
    await button.click();
    await page.waitForFunction(() => window.__copied.length === 1);
    const prompt = await page.evaluate(() => window.__copied[0]);
    for (const rule of ["行の先頭", "1467〜1477", "紀元前3世紀", "平安時代", "「」で囲む", "blankOnly", "見出しの言葉を書かない"]) assert.ok(prompt.includes(rule), rule);
    // The example in the prompt, pasted back as an AI would answer (in a code block).
    const example = prompt.slice(prompt.indexOf("{\"words\":[\n"), prompt.indexOf("\n]}") + 3);
    const result = await page.evaluate((json) => {
      const words = window.parseVocabImport("```json\n" + json + "\n```", []);
      return words.map((w) => ({ word: w.word, meanings: w.meanings, questions: window.TermQuestions.questions(w).map((q) => [q.kind, q.answer]) }));
    }, example);
    assert.equal(result.length, 3);
    const [nobunaga, onin, shoen] = result;
    assert.deepEqual(nobunaga.questions.filter((q) => q[0] === "year").map((q) => q[1]), ["1560", "1575", "1582"]);
    assert.deepEqual(nobunaga.questions.filter((q) => q[0] === "blank").map((q) => q[1]), ["桶狭間の戦い", "今川義元", "長篠の戦い", "武田勝頼", "明智光秀", "本能寺", "楽市・楽座"]);
    assert.deepEqual(onin.questions.filter((q) => q[0] === "year").map((q) => q[1]), ["1467〜1477"]);
    // blankOnly is kept: that line asks only its 「」 (two whole questions, not three).
    assert.equal(onin.meanings[2].blankOnly, true);
    assert.equal(onin.questions.filter((q) => q[0] === "whole").length, 2);
    assert.deepEqual(shoen.questions.map((q) => q[0]).filter((k) => k !== "whole" && k !== "blank"), ["year", "era"], "a century and an era");
    // No line gives its headword away.
    for (const w of result) for (const m of w.meanings) assert.ok(!m.text.includes(w.word), w.word + " in " + m.text);
    // English books: a phrase from the book (provide him with information) is not a question; its pattern is,
    // with the preposition to answer. Both prompts say so, and the English prompt's example does it.
    for (const text of [prompt]) assert.ok(text.includes("provide him with information") && text.includes("+ A 「with」 B"), "term prompt: English rules");
    await page.locator("#libraryCopyEnglishPrompt").click();
    await page.waitForFunction(() => window.__copied.length === 2);
    const english = await page.evaluate(() => window.__copied[1]);
    assert.ok(english.includes("meanings に入れない") && english.includes("+ A 「with」 B"), "English prompt: phrases go to sub");
    const englishExample = english.slice(english.indexOf('{"words":[\n'), english.indexOf("\n]}") + 3);
    const books = await page.evaluate((json) => window.parseVocabImport(json, []).map((w) => ({ word: w.word, sub: w.sub, meanings: w.meanings.map((m) => m.text), questions: window.TermQuestions.questions(w).filter((q) => q.kind === "blank").map((q) => q.answer) })), englishExample);
    const provide = books.find((w) => w.word === "provide");
    assert.deepEqual(provide.questions, ["with", "for", "provision"]);
    assert.ok(provide.sub.includes("provide him with information"));
    // No meaning in the example is a phrase with a concrete object (him, her, the problem …) to answer whole.
    for (const w of books) for (const m of w.meanings) assert.ok(!/\b(him|her|them|me|us|information|the problem)\b/.test(m.split("\n")[0]), w.word + ": " + m);
    assert.deepEqual(errors, []);
    console.log("term-prompt smoke ok");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
