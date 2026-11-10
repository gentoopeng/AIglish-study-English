// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/sugoroku-card-size.smoke.cjs
// The bingo card keeps one size: it does not change when the 出目 picker, the item bag or the ヘルモード badge
// come and go (it used to be measured again with whatever was showing); only a new screen size changes it.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const base = process.env.APP_URL || "http://127.0.0.1:8000";
const SAVE = "aiglish_sugoroku_GUEST-000_practice";
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 740 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(base);
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-casino").click();
    const tab = page.locator("#view-casino.active");
    const screen = page.locator("dialog.casino-screen.is-sugoroku[open]");
    const width = () => page.evaluate(() => new Promise((r) => setTimeout(() => r(document.querySelector(".sg-card-wrap").offsetWidth), 600)));
    const open = async (patch) => {
      if (await screen.count()) await page.locator("dialog.casino-screen.is-sugoroku .cs-close").evaluate((b) => b.click());
      if (patch)
        await page.evaluate(([name, p]) => {
          const s = JSON.parse(localStorage.getItem(name) || "null") || window.SugorokuModel.newState();
          Object.assign(s, p);
          localStorage.setItem(name, JSON.stringify(s));
        }, [SAVE, patch]);
      await tab.locator(".casino-game.mode-sugoroku").click();
      await screen.locator(".sg-card").first().waitFor();
    };
    await open();
    const plain = await width();
    assert.ok(plain >= 150, "a card: " + plain);
    // The card is a square and so are its cells (rows never squashed): the height comes from the width alone.
    const shape = () => page.evaluate(() => {
      const r = (e) => e.getBoundingClientRect(),
        card = r(document.querySelector(".sg-card")),
        slider = r(document.querySelector(".sg-cards-slider")),
        cells = [...document.querySelectorAll(".sg-card:first-child .sg-cell")].map(r);
      return { card: [Math.round(card.width), Math.round(card.height)], slider: [Math.round(slider.width), Math.round(slider.height)], cell: [Math.round(cells[0].width), Math.round(cells[0].height)], lastBottom: Math.round(cells[cells.length - 1].bottom - card.bottom) };
    });
    const sq = await shape();
    assert.equal(sq.card[0], sq.card[1], "the card is square " + JSON.stringify(sq));
    assert.equal(sq.slider[1], sq.card[1], "the slider shows all of it " + JSON.stringify(sq));
    assert.ok(Math.abs(sq.cell[0] - sq.cell[1]) <= 1, "round cells " + JSON.stringify(sq));
    assert.ok(sq.lastBottom <= 0, "the last row is inside the card " + JSON.stringify(sq));

    // The same card with a bag of items (the item row shows), after taking ぴったり (the picker of faces shows).
    await open({ items: ["dice2", "dice3", "exact", "guard", "x2"], bonus: [], pending: null, hell: 0 });
    const withBag = await width();
    await screen.locator('.sg-item[data-item="exact"]').click();
    const withPicker = await width();
    await screen.locator('.sg-item[data-item="exact"]').click();
    const picked = await width();
    // ヘルモード (the badge shows).
    await open({ items: [], hell: 60, pending: null, bonus: [] });
    const hell = await width();
    await open({ items: [], hell: 0, pending: null, bonus: [] });
    const calm = await width();
    assert.deepEqual({ withBag, withPicker, picked, hell, calm }, { withBag: plain, withPicker: plain, picked: plain, hell: plain, calm: plain }, "one size whatever shows");

    // A new screen size does change it, and it fits without scrolling.
    await page.setViewportSize({ width: 375, height: 640 });
    const small = await width();
    assert.ok(small < plain, "a shorter screen: " + small + " < " + plain);
    const fits = await page.evaluate(() => { const d = document.querySelector("dialog.casino-screen.is-sugoroku"); return d.scrollHeight <= d.clientHeight + 1; });
    assert.ok(fits, "fits the shorter screen");
    assert.deepEqual(errors, []);
    console.log("PASS: the bingo card keeps one size while items, the 出目 picker and the ヘルモード badge come and go");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
