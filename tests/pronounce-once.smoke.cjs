// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/pronounce-once.smoke.cjs
// Each card is read once, even though the card is drawn more than once and hands-free mode
// reads it too: a second request for the same text joins the reading instead of restarting it.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 760 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_pronounce_settings", JSON.stringify({ enabled: true, auto: true, rate: 0.9 }));
      localStorage.setItem("aiglish_handsfree_settings", JSON.stringify({ answerDelay: 1 }));
      window.__said = [];
      let current = null;
      const fake = {
        speaking: false,
        pending: false,
        getVoices: () => [],
        addEventListener() {},
        cancel() {
          if (!current) return;
          const u = current;
          current = null;
          fake.speaking = false;
          setTimeout(() => u.onerror?.({ error: "interrupted" }), 0);
        },
        speak(u) {
          window.__said.push(u.text);
          current = u;
          fake.speaking = true;
          setTimeout(() => {
            if (current !== u) return;
            current = null;
            fake.speaking = false;
            u.onend?.({});
          }, 500);
        },
      };
      Object.defineProperty(window, "speechSynthesis", { value: fake });
    });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-vocab").click();
    await page.getByRole("button", { name: "＋ 単語帳を作る", exact: true }).click();
    await page.locator("#libraryBookName").fill("読み上げ");
    await page.locator("#libraryBookWords").fill("1:apple:りんご:\n2:desk:机:\n3:run:走る:");
    await page.getByRole("button", { name: "単語帳を作る", exact: true }).click();
    await page.getByRole("button", { name: "読み上げの学習方法を選ぶ" }).click();
    await page.getByRole("button", { name: "単語カード", exact: true }).click();
    await page.getByRole("button", { name: "カードを開始する" }).click();
    await page.waitForSelector("#activeFlashcard");
    await page.waitForTimeout(1200);
    const first = await page.evaluate(() => window.__said.splice(0));
    assert.equal(first.length, 1, JSON.stringify(first));
    // Hands-free: the word once, then its meaning once.
    await page.locator("#flashcardHandsFreeButton").click();
    await page.waitForTimeout(3500);
    const word = await page.evaluate(() => flashcardOriginQueue[flashcardCurrentIndex]);
    assert.deepEqual(await page.evaluate(() => window.__said.splice(0)), [word.en, word.ja]);
    await page.evaluate(() => window.swipeFlashcard("right", 0, 0));
    await page.waitForTimeout(3500);
    const next = await page.evaluate(() => flashcardOriginQueue[flashcardCurrentIndex]);
    assert.deepEqual(await page.evaluate(() => window.__said.splice(0)), [next.en, next.ja]);
    assert.deepEqual(errors, []);
    console.log("PASS: each card read once with auto reading, and word then meaning once in hands-free mode");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
