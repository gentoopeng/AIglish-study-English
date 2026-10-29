// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/sugoroku.smoke.cjs
// すごろくビンゴ on practice chips: the card, the track and the casino's jackpots; rolls pay
// and save; the game carries on after closing; an event game is played and settled; a line
// spins the bingo wheel.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const base = process.env.APP_URL || "http://127.0.0.1:8000";
const SAVE = "aiglish_sugoroku_GUEST-000_practice",
  CARD = "aiglish_sugoroku_card_GUEST-000";
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
    assert.equal(await tab.locator("[data-casino-jackpots] .is-jp b").innerText(), "5,000pt");
    assert.equal(await tab.locator("[data-casino-jackpots] .is-sjp b").innerText(), "50,000pt");
    await tab.locator(".casino-game.mode-sugoroku").click();
    const screen = page.locator("dialog.casino-screen.is-sugoroku[open]");
    await screen.locator(".sg-card").waitFor();
    assert.equal(await screen.locator(".sg-cell").count(), 49);
    assert.equal(await screen.locator(".sg-sq").count(), 80);
    // The whole game fits the screen: the roll button is in view without scrolling.
    const fits = await page.evaluate(() => {
      const go = document.querySelector(".sg-go").getBoundingClientRect(),
        card = document.querySelector(".sg-card").getBoundingClientRect();
      return go.bottom <= innerHeight && card.top >= 0 && card.width > 230;
    });
    assert.ok(fits, "fits one screen");
    assert.equal(await screen.locator('[data-pot="jp"] b').innerText(), "5,000pt");
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll(".sg-cell,.sg-cost,.sg-go")].some((el) => el.scrollWidth > el.clientWidth + 1));
    assert.equal(wide, false);
    await page.screenshot({ path: "/tmp/sugoroku.png", fullPage: true });

    const saved = () => page.evaluate((name) => JSON.parse(localStorage.getItem(name)), SAVE);
    const card = () => page.evaluate((name) => JSON.parse(localStorage.getItem(name)), CARD);
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
    const afterCard = await card();
    assert.equal(await screen.locator(".sg-cell.is-on").count(), afterCard.owners.filter((o) => o && o !== "*").length);
    assert.equal(await screen.locator(".sg-cell.is-mine").count(), afterCard.owners.filter((o) => o === "GUEST-000").length);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll(".sg-sq")].findIndex((s) => s.classList.contains("is-here"))), after.pos);

    // Closed and opened again: the same card and place.
    await page.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    await tab.locator(".casino-game.mode-sugoroku").click();
    await screen.locator(".sg-card").waitFor();
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".sg-cell")].map((c) => c.title || c.textContent)), afterCard.cells.map((n, i) => (afterCard.owners[i] === "GUEST-000" ? "ゲストのボール（" + n + "）" : n ? String(n) : "FREE")));

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

    // The draws are fixed from here: the next values crypto gives go to the die, then the ball.
    const fix = (values) =>
      page.evaluate((values) => {
        const real = window.__realRandom || (window.__realRandom = crypto.getRandomValues.bind(crypto));
        window.__queue = values.slice();
        crypto.getRandomValues = (array) => (window.__queue.length ? ((array[0] = window.__queue.shift()), array) : real(array));
      }, values);
    // A ball off the card: it rolls in, greys out and pays 1.5× the bet (50 → 75).
    await page.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    const missNo = await page.evaluate(([name, cardName]) => {
      const s = JSON.parse(localStorage.getItem(name));
      s.pos = 79;
      localStorage.setItem(name, JSON.stringify(s));
      const c = JSON.parse(localStorage.getItem(cardName));
      return Array.from({ length: 100 }, (_, i) => i + 1).find((n) => !c.cells.includes(n));
    }, [SAVE, CARD]);
    await tab.locator(".casino-game.mode-sugoroku").click();
    await screen.locator(".sg-card").waitFor();
    const before = await saved(),
      beforeCard = await card();
    // Die 1 onto START (a ball), START's wheel on its ×0 slot.
    const zeroAt = await page.evaluate(() => window.SugorokuModel.RULES.normal[50].findIndex((x) => x.x === 0));
    await fix([0, missNo - 1, zeroAt]);
    await screen.locator("[data-sg-roll]").click();
    await settled();
    const missed = await saved();
    assert.equal(missed.won - before.won, 75);
    assert.deepEqual((await card()).owners, beforeCard.owners);

    // Another player's ball shows their initial and name; the top row is the guest's own but its
    // last cell, so the next ball on that number makes a line of only the guest's balls.
    await page.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    const lastNo = await page.evaluate(([name, cardName]) => {
      const s = JSON.parse(localStorage.getItem(name));
      s.stake = 400;
      s.pos = 79;
      localStorage.setItem(name, JSON.stringify(s));
      const c = JSON.parse(localStorage.getItem(cardName));
      c.owners = c.owners.map((o, i) => (o === "*" ? o : i < 6 ? "GUEST-000" : i === 10 ? "amy" : ""));
      c.people = { amy: { n: "Amy", i: "" } };
      localStorage.setItem(cardName, JSON.stringify(c));
      return c.cells[6];
    }, [SAVE, CARD]);
    await tab.locator(".casino-game.mode-sugoroku").click();
    await screen.locator(".sg-card").waitFor();
    assert.equal(await screen.locator(".sg-cell").nth(10).getAttribute("data-initial"), "A");
    assert.match(await screen.locator(".sg-cell").nth(10).getAttribute("title"), /^Amyのボール/);
    assert.equal(await screen.locator(".sg-cell.is-mine").count(), 6);
    assert.ok((await screen.locator(".sg-cell.is-reach").count()) >= 1);
    await fix([0, lastNo - 1]);
    await screen.locator("[data-sg-roll]").click();
    await screen.locator(".sg-layer.is-bingo").waitFor({ state: "attached" });
    await settled();
    await playGame();
    const done = await saved(),
      doneCard = await card();
    assert.ok(done.bingos >= 1);
    assert.equal(done.stake, 0);
    // The finished row starts again: no balls, fresh numbers; amy's ball stays.
    assert.deepEqual(doneCard.owners.slice(0, 7), ["", "", "", "", "", "", ""]);
    assert.ok(!doneCard.cells.slice(0, 7).includes(lastNo));
    assert.equal(doneCard.owners[10], "amy");
    await page.screenshot({ path: "/tmp/sugoroku-after.png", fullPage: true });
    assert.deepEqual(errors, []);
    console.log("PASS: すごろくビンゴ card/track/jackpots, rolls pay and save, resume, an event game kept and settled, a ball off the card pays 1.5×, other players' balls by name, a line of own balls spins BINGO and starts the row again");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
