// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/sugoroku-card-size.smoke.cjs
// The bingo card takes the room the screen leaves (the whole width on a tall phone) and is always a square whose
// cells are round; a shorter screen gives a smaller card, and it fits without scrolling.
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

    // A tall phone gives the card the whole width (it is not held back for rows that may come).
    const bodyW = await page.evaluate(() => document.querySelector(".sg-body").clientWidth);
    assert.equal(plain, bodyW, "the card is as wide as the screen allows");
    // The card keeps its shape (a square) with the rows below it showing: the bag, the 出目 picker, the ヘルモード badge.
    await open({ items: ["dice2", "dice3", "exact", "guard", "x2"], bonus: [], pending: null, hell: 0 });
    await width();
    await screen.locator('.sg-item[data-item="exact"]').click();
    await width();
    const withPicker = await shape();
    assert.equal(withPicker.card[0], withPicker.card[1], "square with the picker " + JSON.stringify(withPicker));
    assert.equal(withPicker.slider[1], withPicker.card[1]);
    await open({ items: [], hell: 60, pending: null, bonus: [] });
    await width();
    const hell = await shape();
    assert.equal(hell.card[0], hell.card[1], "square in ヘルモード " + JSON.stringify(hell));

    // A new screen size does change it, and it fits without scrolling.
    await page.setViewportSize({ width: 375, height: 640 });
    const small = await width();
    assert.ok(small < plain, "a shorter screen: " + small + " < " + plain);
    const fits = await page.evaluate(() => { const d = document.querySelector("dialog.casino-screen.is-sugoroku"); return d.scrollHeight <= d.clientHeight + 1; });
    assert.ok(fits, "fits the shorter screen");
    assert.deepEqual(errors, []);
    console.log("PASS: the bingo card is a full-width square on a tall phone, stays square with the picker and the badge, and shrinks to fit a short screen");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
