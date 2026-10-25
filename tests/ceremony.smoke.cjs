// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/ceremony.smoke.cjs
// The shared opening (ceremony.js): counting up, ring filled to the score, tap to skip, the top dialog
// as host; and the flashcard deck ending in it instead of an alert.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const base = process.env.APP_URL || "http://127.0.0.1:8000";
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }),
      errors = [],
      alerts = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => {
      alerts.push(d.message());
      d.dismiss();
    });
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => localStorage.setItem("b3_tutorial_done", "1"));
    await page.goto(base);
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
    // A result: the number runs up to the score, the ring stops at 70%, the note and sub show.
    await page.evaluate(() => {
      window.__cerDone = false;
      window.Ceremony.play({ style: "ring", result: true, count: 7, from: 0, suffix: "/10", score: 0.7, word: "CLEAR", sub: "正解", note: "+14pt", tone: "gold" }).then(() => (window.__cerDone = true));
    });
    const c = page.locator(".ceremony");
    await c.waitFor();
    assert.equal(await c.getAttribute("aria-label"), "7/10 正解 +14pt");
    assert.equal(await c.locator(".cer-suffix").innerText(), "/10");
    assert.equal(await c.locator(".cer-word span").count(), 5);
    assert.equal(Number(await c.evaluate((el) => el.style.getPropertyValue("--to"))).toFixed(1), (704 * 0.3).toFixed(1));
    await page.waitForFunction(() => document.querySelector(".ceremony.is-landed"));
    assert.equal(await c.locator(".cer-count").innerText(), "7");
    // A touch anywhere ends it (and still reaches the page); the promise settles once it has gone.
    await page.mouse.click(10, 10);
    await page.waitForFunction(() => window.__cerDone === true);
    assert.equal(await page.locator(".ceremony").count(), 0);
    // Inside an open modal dialog it goes on that dialog, not behind it.
    await page.evaluate(() => {
      const d = document.createElement("dialog");
      d.id = "cerHost";
      document.body.append(d);
      d.showModal();
      window.Ceremony.play({ count: 3, word: "GO" });
    });
    assert.equal(await page.locator("#cerHost > .ceremony").count(), 1);
    await page.evaluate(() => { window.Ceremony.skip(); document.getElementById("cerHost").remove(); });
    // The end of a flashcard deck: no alert, the learned words counted up out of the total.
    await page.evaluate(() => {
      flashcardOriginQueue = [{ num: 1, word: "a" }, { num: 2, word: "b" }, { num: 3, word: "c" }, { num: 4, word: "d" }];
      flashcardCurrentIndex = 4;
      flashcardLearnedCount = 3;
      window.renderFlashcardDeck();
    });
    await page.locator(".ceremony .cer-suffix", { hasText: "/4" }).waitFor();
    assert.match(await page.locator(".ceremony .cer-word").innerText(), /C\s*O\s*M\s*P\s*L\s*E\s*T\s*E/);
    await page.waitForFunction(() => document.querySelector(".ceremony.is-landed .cer-count")?.textContent === "3");
    assert.deepEqual(alerts, []);
    await page.evaluate(() => window.Ceremony.skip());
    // Each moment has its own picture: three stars at a perfect score, the days of a streak.
    await page.evaluate(() => { window.Ceremony.play({ style: "stars", count: 10, suffix: "/10", score: 1, word: "PERFECT" }); });
    assert.equal(await page.locator(".ceremony.is-stars:not(.is-leaving) .cer-stars i.is-lit").count(), 3);
    await page.evaluate(() => { window.Ceremony.play({ style: "stars", count: 4, suffix: "/10", score: 0.4, word: "CLEAR" }); });
    assert.equal(await page.locator(".ceremony.is-stars:not(.is-leaving) .cer-stars i.is-lit").count(), 1);
    await page.evaluate(() => { window.Ceremony.play({ style: "flame", count: 3, word: "DAYS", days: [false, false, false, false, true, true, true] }); });
    assert.equal(await page.locator(".ceremony.is-flame:not(.is-leaving) .cer-days i.is-on").count(), 3);
    for (const style of ["deck", "focus", "trophy", "chips", "fold"]) {
      await page.evaluate((style) => { window.Ceremony.play({ style, count: 5, word: "OK" }); }, style);
      assert.equal(await page.locator(".ceremony.is-" + style + ":not(.is-leaving)").count(), 1, style);
    }
    await page.evaluate(() => window.Ceremony.skip());
    // Reduced motion: the final number at once.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => { window.Ceremony.play({ count: 42, word: "DAYS" }); });
    assert.equal(await page.locator(".ceremony:not(.is-leaving) .cer-count").innerText(), "42");
    assert.deepEqual(errors, []);
    console.log("PASS: ceremony counts up to the score with the ring filled to it, skips on tap, sits in the top dialog, ends the flashcard deck without an alert, a picture per moment (stars, streak days and more), and reduced motion");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
