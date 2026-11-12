// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/casino-motion.smoke.cjs
// The casino's motion layer (casino-motion.css / casino-motion.js): the screens come up, the lobby cards reveal one after another,
// dice toss, a balance change floats up beside the balance without changing the balance text — and with reduced motion
// none of it runs.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    for (const reduced of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 390, height: 800 } }),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("https://**/*", (r) => r.abort());
      await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
      await page.addInitScript(() => {
        localStorage.setItem("b3_tutorial_done", "1");
        localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
      });
      await page.goto("http://127.0.0.1:8000");
      await page.getByRole("button", { name: "ゲストで試す" }).click();
      await page.waitForFunction(() => window.__learningBootReady === true);
      await page.evaluate(() => window.switchTab("casino"));
      const names = (selector) => page.evaluate((s) => [...document.querySelectorAll(s)].map((el) => getComputedStyle(el).animationName), selector);
      // Lobby cards: revealed one after another (delays grow), or not animated at all.
      const cards = await page.evaluate(() => [...document.querySelectorAll("#view-casino .casino-game")].map((el) => [getComputedStyle(el).animationName, getComputedStyle(el).animationDelay]));
      assert.ok(cards.length >= 6);
      if (reduced) assert.ok(cards.every(([n]) => n === "none"), "no lobby motion with reduced motion");
      else {
        assert.ok(cards.every(([n]) => n === "cm-reveal"));
        const delays = cards.map(([, d]) => parseFloat(d));
        assert.ok(delays[1] > delays[0] && delays[5] > delays[1], "staggered");
      }
      // A game screen comes up; the balance text stays plain while its change floats beside it.
      await page.locator('[data-game="dice"]').click();
      await page.locator("dialog.casino-screen[open] [data-cs-balance]").waitFor();
      const screen = await page.evaluate(() => getComputedStyle(document.querySelector("dialog.casino-screen")).animationName);
      assert.equal(screen, reduced ? "none" : "cm-screen-in");
      await page.locator(".cs-body .cs-primary").first().click();
      if (reduced) {
        await page.waitForTimeout(600);
        assert.equal(await page.locator(".cm-delta").count(), 0, "no floating change with reduced motion");
      } else {
        const chip = page.locator(".cs-balance .cm-delta");
        await chip.first().waitFor({ timeout: 5000 });
        assert.match(await chip.first().innerText(), /^[+−]\d/);
        assert.match(await page.locator("[data-cs-balance]").innerText(), /^[\d,]+/, "the balance text itself is just the number");
        // The dice toss (the dice had no motion before).
        const dice = await page.evaluate(() => [...document.querySelectorAll(".cs-die.is-rolling")].map((el) => getComputedStyle(el).animationName));
        // (all of them toss; a suggested one also glows afterwards)
        assert.ok(dice.length === 0 || dice.every((n) => n.startsWith("cm-die")), "dice: " + JSON.stringify(dice));
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log("casino motion smoke passed");
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
