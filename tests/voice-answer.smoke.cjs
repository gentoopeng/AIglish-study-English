// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/voice-answer.smoke.cjs
// 声で答える: speech recognition is replaced by a script that "hears" the next queued answer.
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
      localStorage.setItem("aiglish_pronounce_settings", JSON.stringify({ enabled: true, auto: false, rate: 0.9 }));
      localStorage.setItem("aiglish_handsfree_settings", JSON.stringify({ answerDelay: 1 }));
      localStorage.setItem("aiglish_voice_answer", "1");
      window.__said = [];
      window.__heard = [];
      window.__listens = [];
      let current = null;
      const synth = {
        speaking: false,
        pending: false,
        getVoices: () => [],
        addEventListener() {},
        cancel() {
          if (!current) return;
          const u = current;
          current = null;
          synth.speaking = false;
          setTimeout(() => u.onerror?.({ error: "interrupted" }), 0);
        },
        speak(u) {
          window.__said.push(u.text);
          current = u;
          synth.speaking = true;
          setTimeout(() => {
            if (current !== u) return;
            current = null;
            synth.speaking = false;
            u.onend?.({});
          }, 200);
        },
      };
      Object.defineProperty(window, "speechSynthesis", { value: synth });
      HTMLMediaElement.prototype.play = () => Promise.resolve();
      window.SpeechRecognition = window.webkitSpeechRecognition = function () {
        const r = this;
        r.start = () => {
          window.__listens.push(r.lang);
          let next = window.__heard.shift();
          // "RIGHT": the meaning of the card on screen, said without the 〜 placeholder.
          if (next === "RIGHT") next = flashcardOriginQueue[flashcardCurrentIndex].ja.replace(/^〜/, "");
          setTimeout(() => {
            if (next === undefined) return r.onend?.();
            const alts = [].concat(next).map((transcript) => ({ transcript }));
            r.onresult?.({ results: [alts] });
            r.onend?.();
          }, 100);
        };
        r.stop = () => r.onend?.();
        r.abort = () => r.onend?.();
      };
    });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-vocab").click();
    await page.getByRole("button", { name: "＋ 単語帳を作る", exact: true }).click();
    await page.locator("#libraryBookName").fill("声");
    await page.locator("#libraryBookWords").fill("1:follow:①〜に従う②〜に続く:\n2:desk:机:\n3:run:走る:");
    await page.getByRole("button", { name: "単語帳を作る", exact: true }).click();
    const book = await page.evaluate(() => textbooksPool.find((b) => b.name === "声").id);
    await page.getByRole("button", { name: "声の学習方法を選ぶ" }).click();
    await page.getByRole("button", { name: "単語カード", exact: true }).click();
    await page.getByRole("button", { name: "カードを開始する" }).click();
    await page.waitForSelector("#activeFlashcard");
    await page.evaluate(() => (window.__heard = ["RIGHT", "りんご"]));
    const card = () => page.evaluate(() => ({ ...flashcardOriginQueue[flashcardCurrentIndex] }));
    const first = await card();
    // The mic toggle is in the hands-free bar; it is remembered (turned on before this page loaded).
    await page.locator("#flashcardHandsFreeButton").click();
    const voice = page.locator("#handsFreeVoice");
    assert.equal(await voice.isVisible(), true);
    assert.equal(await voice.getAttribute("aria-pressed"), "true");
    const rated = (card) =>
      page.evaluate(([b, n, m]) => LearningData.read(b)[String(n)]?.meanings?.[m]?.status || "", [book, card.num, String(card.meaningId)]);
    await page.waitForFunction(() => flashcardCurrentIndex >= 1, null, { timeout: 8000 });
    assert.equal(await rated(first), "ok");
    assert.match(await page.locator("#handsFreeHeard").textContent(), /」 ○$/);
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
    const second = await card();
    await page.waitForFunction(() => flashcardCurrentIndex >= 2, null, { timeout: 8000 });
    assert.equal(await rated(second), "bad");
    // A wrong answer reads the right one before moving on.
    assert.ok((await page.evaluate(() => window.__said)).includes(second.ja));
    // Nothing heard: the answer is read and the card waits for a button.
    await page.waitForTimeout(3000);
    assert.equal(await page.evaluate(() => flashcardCurrentIndex), 2);
    assert.equal(await page.locator("#activeFlashcard.flipped").count(), 1);
    assert.deepEqual(await page.evaluate(() => window.__listens), ["ja-JP", "ja-JP", "ja-JP"]);
    assert.deepEqual(errors, []);
    console.log("PASS: 声で答える — a right spoken answer rates ○, a wrong one reads the answer and rates ×, silence falls back to the button");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
