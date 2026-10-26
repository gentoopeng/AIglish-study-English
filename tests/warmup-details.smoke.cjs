// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/warmup-details.smoke.cjs
// The first-ten warm-up's i opens the same word card as the regular flashcards, on top of the
// warm-up; and the sticky note (付箋) on that card responds at once, there and on flashcards.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 402, height: 874 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      if (localStorage.getItem("warmup-seeded")) return;
      localStorage.setItem("warmup-seeded", "1");
      localStorage.setItem("core_v4_userId", "warmup-user");
      localStorage.setItem("core_v4_userName", "検証");
      localStorage.setItem("core_v4_current_textbook_id", "warmup-book");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
      localStorage.setItem("core_v4_cache_warmup-book", JSON.stringify(Array.from({ length: 30 }, (_, i) => ({ num: i + 1, word: "word" + i, meaning: "意味" + i }))));
    });
    await page.goto("http://127.0.0.1:8000");
    await page.waitForFunction(() => window.__learningBootReady);
    const warm = page.locator(".flash-warmup-dialog[open]");
    await warm.locator(".warmup-card").waitFor({ timeout: 30000 });
    await page.waitForTimeout(600);
    const shown = await warm.locator(".warmup-card .flashcard-face-front > div").first().innerText();

    // i: the word book's card for this word, in a sheet on top of the warm-up.
    await warm.getByRole("button", { name: "この単語の詳細を見る" }).click();
    const sheet = page.locator("#flashcardWordDetails.is-open");
    await sheet.waitFor();
    assert.equal(await page.locator(".warmup-word-details").count(), 0);
    assert.equal(await sheet.evaluate((s) => !!s.closest(".flash-warmup-dialog")), true);
    const card = sheet.locator(".word-row-container").first();
    assert.match(await card.innerText(), new RegExp(shown));
    await page.waitForTimeout(400);
    const onTop = await sheet.locator(".flashcard-detail-panel").evaluate((p) => {
      const r = p.getBoundingClientRect();
      return p.contains(document.elementFromPoint(r.left + r.width / 2, r.top + 40));
    });
    assert.equal(onTop, true, "the sheet is above the warm-up");

    // The sticky note responds on the card itself, and the word keeps it.
    const pin = sheet.getByRole("button", { name: "付箋を付ける" });
    assert.equal(await pin.getAttribute("aria-pressed"), "false");
    await pin.click();
    assert.equal(await pin.getAttribute("aria-pressed"), "true");
    assert.equal(await card.evaluate((c) => c.classList.contains("has-sticky")), true);
    const word = shown.trim();
    assert.equal(await page.evaluate((w) => vocabList.find((x) => x.word === w).sticky, word), true);
    await pin.click();
    assert.equal(await pin.getAttribute("aria-pressed"), "false");
    assert.equal(await page.evaluate((w) => vocabList.find((x) => x.word === w).sticky, word), false);
    await page.screenshot({ path: "/tmp/warmup-details.png" });
    await sheet.getByRole("button", { name: "閉じる", exact: true }).click();
    await page.locator("#flashcardWordDetails.is-open").waitFor({ state: "detached" }).catch(() => {});
    assert.equal(await page.locator("#flashcardWordDetails.is-open").count(), 0);
    await warm.locator(".warmup-card").waitFor();

    // Leaving the warm-up: the regular flashcard sheet opens over the page and its sticky note
    // responds too.
    await warm.getByRole("button", { name: "あとで" }).first().click();
    await page.locator(".flash-warmup-dialog[open]").waitFor({ state: "detached" }).catch(() => {});
    await page.evaluate(() => window.openVocabDetailsSheet(vocabList[2]));
    const sheet2 = page.locator("#flashcardWordDetails.is-open");
    await sheet2.waitFor();
    assert.equal(await sheet2.evaluate((s) => s.parentElement === document.body), true);
    const pin2 = sheet2.getByRole("button", { name: "付箋を付ける" });
    await pin2.click();
    assert.equal(await pin2.getAttribute("aria-pressed"), "true");
    assert.equal(await page.evaluate(() => vocabList[2].sticky), true);
    assert.deepEqual(errors, []);
    console.log("PASS: warm-up i opens the word book's card over the warm-up, sticky note responds there and on the regular sheet");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
