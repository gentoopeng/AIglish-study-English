// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/vocab-card-wrap.smoke.cjs
// A word card's title on a narrow phone with the edit buttons: the word is never split inside
// and stays beside its number when it fits (the buttons get smaller instead; the speaker may
// move under the word), phrases break between words, and nothing runs under the buttons.
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
            s = speaker.getBoundingClientRect(),
            badge = card.querySelector(".word-num-badge").getBoundingClientRect();
          return {
            word: w.word,
            lines: new Set(lines).size,
            underButtons: box.right > markers.left && box.top < markers.bottom,
            besideNumber: box.left > badge.right && Math.abs(box.top - badge.top) < 12,
            inside: box.right <= card.getBoundingClientRect().right,
          };
        });
      });
      for (const r of rows) {
        if (r.word !== "take into account") assert.equal(r.lines, 1, width + "px: " + JSON.stringify(r));
        else assert.ok(r.lines <= 2, width + "px: " + JSON.stringify(r));
        assert.equal(r.underButtons, false, width + "px: " + JSON.stringify(r));
        // A word that fits beside the number stays there; one too long for the space moves down whole.
        if (r.word === "disregard" || width >= 375) assert.equal(r.besideNumber, true, width + "px: " + JSON.stringify(r));
        assert.equal(r.inside, true, width + "px: " + JSON.stringify(r));
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log("PASS: word card titles stay whole on narrow phones with the edit buttons, word beside its number, nothing under the buttons");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
