// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/reader-vocab-grammar.smoke.cjs
// Reader: word-book words are marked only where the AI says they carry a registered meaning, a
// tapped word opens the flashcard's detail card, and grammar points are found and visible.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }),
      errors = [];
    let request = null;
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.route("https://generativelanguage.googleapis.com/**", (r) => {
      request = JSON.parse(r.request().postData());
      // "like" is in the book only as 〜のような, so the AI leaves it out of vocab here.
      const text = JSON.stringify({
        fullSummaryAbstract: "りんごの話",
        sentences: [
          { text: "I like apples.", translation: "私はりんごが好きです。", grammarHighlights: [{ phrase: "like ~", label: "動詞 like", meaning: "「好む」の意味。" }], vocab: [{ num: "A2", meaning: 1 }] },
          { text: "It must be ready now.", translation: "もう準備ができているはずだ。", grammarHighlights: [{ phrase: "must be ~", label: "助動詞 must（推量）", meaning: "「〜に違いない」と推量する。" }], vocab: [{ num: "A3", meaning: 1 }] },
        ],
      });
      r.fulfill({ status: 200, contentType: "text/event-stream", body: "data: " + JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }) + "\r\n\r\n" });
    });
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
      localStorage.setItem("core_v4_geminiKey", "test-key");
    });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストとしてテストプレイ" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-vocab").click();
    await page.getByRole("button", { name: "＋ 単語帳を作る", exact: true }).click();
    await page.locator("#libraryBookName").fill("テスト単語");
    await page.locator("#libraryBookWords").fill("1:like:〜のような\n2:apple:りんご\n3:ready:用意ができた");
    await page.getByRole("button", { name: "単語帳を作る", exact: true }).click();
    await page.locator("dialog[open]").waitFor({ state: "detached" });
    await page.locator("#vocabLibraryBooks .textbook-list-item").first().click();
    await page.waitForFunction(() => !window.__vocabSelectionRequest && vocabList.length === 3);

    await page.locator("#nav-reader").click();
    await page.locator("#englishTextarea").fill("I like apples. It must be ready now.");
    await page.locator("#analysisSubmitBtn").click();
    await page.locator(".sentence-ja", { hasText: "私はりんごが好きです。" }).waitFor();
    // The request lists the book's words in the text with their meanings, and fixes the shape.
    const prompt = request.contents[0].parts[0].text;
    assert.match(prompt, /\[A1\] like: ①〜のような/);
    assert.match(prompt, /\[A2\] apple: ①りんご/);
    assert.match(prompt, /\[A3\] ready: ①用意ができた/);
    assert.ok(request.generationConfig.responseSchema.properties.sentences.items.properties.vocab);
    // like is used as 好む: plain. apples and ready are marked.
    const word = (text) => page.locator("#englishContainer .word-span", { hasText: new RegExp("^" + text + "\\b") });
    assert.equal(await word("like").evaluate((el) => el.classList.contains("registered")), false);
    assert.equal(await word("apples").evaluate((el) => el.classList.contains("registered")), true);
    assert.equal(await word("ready").evaluate((el) => el.classList.contains("registered")), true);
    await page.evaluate(() => window.updateReaderWordColors());
    assert.equal(await word("like").evaluate((el) => el.classList.contains("registered")), false);
    // Grammar points with ~ are still found, cover their words, and show a purple underline.
    const grammar = page.locator("#englishContainer .grammar-span");
    assert.equal(await grammar.count(), 2);
    assert.equal(await grammar.nth(1).innerText(), "must be");
    assert.equal(await grammar.nth(1).evaluate((el) => getComputedStyle(el).borderBottomStyle), "solid");
    await word("must").click();
    assert.equal(await page.locator("#popWordNum").innerText(), "💡 助動詞 must（推量）");
    assert.match(await page.locator("#popMeaning").innerText(), /推量/);
    await page.evaluate(() => window.closeWordPopover());
    // A marked word opens the same card as the flashcard's ⓘ, with the meaning used here.
    await word("apples").click();
    const sheet = page.locator("#flashcardWordDetails.is-open");
    await sheet.waitFor();
    assert.equal(await sheet.locator(".flashcard-detail-note").innerText(), "この文での意味：①りんご");
    assert.equal(await sheet.locator(".word-row-container").count(), 1);
    await sheet.locator(".flashcard-detail-close").click();
    await page.waitForFunction(() => !document.querySelector("#flashcardWordDetails.is-open"));
    assert.deepEqual(errors, []);
    console.log("PASS: words marked only in a registered meaning, flashcard detail card with the meaning used, grammar phrases found and underlined");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
