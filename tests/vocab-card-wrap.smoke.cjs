// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/vocab-card-wrap.smoke.cjs
// A word card's title on a narrow phone with the edit buttons: the word is never split inside
// (it moves to its own line under the number, with its speaker), phrases break between words,
// and nothing runs under the buttons.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    for (const width of [308, 375, 430]) {
      const page = await browser.newPage({ viewport: { width, height: 700 } }),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("https://**/*", (r) => r.abort());
      await page.addInitScript(() => localStorage.setItem("b3_tutorial_done", "1"));
      await page.goto("http://127.0.0.1:8000");
      await page.getByRole("button", { name: "ゲストで試す" }).click();
      await page.waitForFunction(() => window.__learningBootReady === true);
      const rows = await page.evaluate(() => {
        window.canEditCurrentTextbook = () => true;
        const words = window.migrateVocabData([{ num: 1434, word: "disregard", meaning: "～を無視する" }, { num: 12, word: "responsibility", meaning: "責任" }, { num: 13, word: "take into account", meaning: "考慮する" }]);
        return words.map((w) => {
          w.shownNo = w.num;
          window.openVocabDetailsSheet(w);
          const card = document.querySelector("#flashcardDetailContent .word-row-container"),
            span = card.querySelector(".word-title>span"),
            speaker = card.querySelector(".word-speak-button"),
            markers = card.querySelector(".vocab-word-markers").getBoundingClientRect(),
            range = document.createRange();
          range.selectNodeContents(span);
          const lines = [...range.getClientRects()].map((r) => Math.round(r.top));
          const box = span.getBoundingClientRect(),
            s = speaker.getBoundingClientRect();
          return {
            word: w.word,
            lines: new Set(lines).size,
            underButtons: box.right > markers.left && box.top < markers.bottom,
            speakerBeside: Math.abs(s.top + s.height / 2 - (box.top + box.height / 2)) < 20,
            inside: box.right <= card.getBoundingClientRect().right,
          };
        });
      });
      for (const r of rows) {
        if (r.word !== "take into account") assert.equal(r.lines, 1, width + "px: " + JSON.stringify(r));
        else assert.ok(r.lines <= 2, width + "px: " + JSON.stringify(r));
        assert.equal(r.underButtons, false, width + "px: " + JSON.stringify(r));
        assert.equal(r.speakerBeside, true, width + "px: " + JSON.stringify(r));
        assert.equal(r.inside, true, width + "px: " + JSON.stringify(r));
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log("PASS: word card titles stay whole on narrow phones with the edit buttons, speaker beside the word, nothing under the buttons");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
