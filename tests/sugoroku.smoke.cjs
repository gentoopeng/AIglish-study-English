// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/sugoroku.smoke.cjs
// すごろくビンゴ on practice chips: the card, the track and the casino's jackpots; rolls pay
// and save; the game carries on after closing; an event game is played and settled; a line
// spins the bingo wheel.
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
    // The casino's jackpots are always on the tab.
    assert.equal(await tab.locator("[data-casino-jackpots] .is-jp b").innerText(), "1,000pt");
    assert.equal(await tab.locator("[data-casino-jackpots] .is-sjp b").innerText(), "10,000pt");
    await tab.locator(".casino-game.mode-sugoroku").click();
    const screen = page.locator("dialog.casino-screen.is-sugoroku[open]");
    await screen.locator(".sg-card").waitFor();
    assert.equal(await screen.locator(".sg-cell").count(), 49);
    assert.equal(await screen.locator(".sg-sq").count(), 50);
    assert.equal(await screen.locator('[data-pot="jp"] b').innerText(), "1,000pt");
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll(".sg-cell,.sg-cost,.sg-go")].some((el) => el.scrollWidth > el.clientWidth + 1));
    assert.equal(wide, false);
    await page.screenshot({ path: "/tmp/sugoroku.png", fullPage: true });

    const saved = () => page.evaluate((name) => JSON.parse(localStorage.getItem(name)), SAVE);
    const settled = () => page.waitForFunction(() => !document.querySelector(".cs-body.is-spinning") && (!document.querySelector(".sg-go").disabled || document.querySelector(".sg-layer.is-game:not([hidden])")));
    // Play an event game through to the end whatever it is.
    const playGame = async () => {
      const layer = screen.locator(".sg-layer.is-game:not([hidden])");
      for (let i = 0; i < 12 && (await layer.count()); i++) {
        for (const name of ["next", "stand", "roll"]) {
          const b = layer.locator('[data-sg-game="' + name + '"]');
          if ((await b.count()) && (await b.isEnabled())) {
            await b.click();
            break;
          }
        }
        await page.waitForTimeout(50);
      }
      await settled();
    };

    // Rolls at 50 chips each: chips always = 1000 − bets + what came back.
    await screen.getByRole("radio", { name: "50枚" }).click();
    for (let i = 0; i < 6; i++) {
      await screen.locator("[data-sg-roll]").click();
      await settled();
      await playGame();
    }
    const after = await saved();
    assert.equal(after.rolls, 6);
    assert.equal(after.bet, 300);
    assert.equal(after.pending, null);
    assert.equal(await page.evaluate(() => window.Casino.balance()), 1000 - 300 + after.won);
    assert.equal(await screen.locator(".sg-cell.is-on").count(), after.marks.filter(Boolean).length);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll(".sg-sq")].findIndex((s) => s.classList.contains("is-here"))), after.pos);

    // Closed and opened again: the same card and place.
    await page.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    await tab.locator(".casino-game.mode-sugoroku").click();
    await screen.locator(".sg-card").waitFor();
    assert.deepEqual(await screen.locator(".sg-cell").allInnerTexts(), after.card.map((n) => (n ? String(n) : "FREE")));

    // An event game left half way comes back where it was.
    await page.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    await page.evaluate((name) => {
      const s = JSON.parse(localStorage.getItem(name));
      s.pending = { game: "dice", bet: 50 };
      localStorage.setItem(name, JSON.stringify(s));
    }, SAVE);
    await tab.locator(".casino-game.mode-sugoroku").click();
    const game = screen.locator(".sg-layer.is-game:not([hidden])");
    await game.locator(".sg-die-btn").first().waitFor();
    assert.equal(await game.locator(".sg-die-btn").count(), 5);
    await game.locator(".sg-die-btn").first().click();
    assert.equal(await game.locator(".sg-die-btn").first().getAttribute("aria-pressed"), "true");
    const round = (await saved()).pending.round;
    assert.equal(round.held[0], true);
    const chips = await page.evaluate(() => window.Casino.balance());
    await game.locator('[data-sg-game="stand"]').click();
    const outcome = (await saved()).pending.round.outcome;
    await game.locator('[data-sg-game="next"]').click();
    await settled();
    const ended = await saved();
    assert.equal(ended.pending, null);
    const paid = { win: 100, push: 50, lose: 25 }[outcome];
    assert.ok((await page.evaluate(() => window.Casino.balance())) >= chips + paid, outcome);

    // A row one short with everything else open: the next ball makes a line and spins BINGO.
    await page.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    await page.evaluate((name) => {
      const s = JSON.parse(localStorage.getItem(name));
      s.marks = s.marks.map((_, i) => i !== 6);
      s.lines = [];
      s.stake = 400;
      s.pos = 48;
      localStorage.setItem(name, JSON.stringify(s));
    }, SAVE);
    await tab.locator(".casino-game.mode-sugoroku").click();
    await screen.locator(".sg-card").waitFor();
    assert.ok((await screen.locator(".sg-cell.is-reach").count()) >= 1);
    // From square 48 any die passes START, and the lap gives a ball.
    await screen.locator("[data-sg-roll]").click();
    await screen.locator(".sg-layer.is-bingo").waitFor({ state: "attached" });
    await settled();
    await playGame();
    const done = await saved();
    assert.ok(done.bingos >= 1);
    assert.ok(done.cards >= 1, "the full card started again");
    await page.screenshot({ path: "/tmp/sugoroku-after.png", fullPage: true });
    assert.deepEqual(errors, []);
    console.log("PASS: すごろくビンゴ card/track/jackpots, rolls pay and save, resume, an event game kept and settled, a line spins BINGO");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
