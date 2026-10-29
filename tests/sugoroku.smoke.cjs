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
    assert.equal(await tab.locator("[data-casino-jackpots] .is-jp b").innerText(), "1,000pt");
    assert.equal(await tab.locator("[data-casino-jackpots] .is-sjp b").innerText(), "5,000pt");
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
    assert.equal(await screen.locator('[data-pot="jp"] b').innerText(), "1,000pt");
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

    // Rolls at the fixed 100 chips: chips always = 1000 − bets + what came back.
    assert.match(await screen.locator(".sg-costs").innerText(), /1回\s*100枚/);
    const start = await page.evaluate(() => window.Casino.balance());
    for (let i = 0; i < 4; i++) {
      await screen.locator("[data-sg-roll]").click();
      await settled();
      await playGame();
    }
    const after = await saved();
    assert.equal(after.rolls, 4);
    assert.equal(after.bet, 400);
    assert.equal(after.pending, null);
    assert.equal(await page.evaluate(() => window.Casino.balance()), start - 400 + after.won);
    const afterCard = await card();
    assert.equal(await screen.locator(".sg-cell.is-on").count(), afterCard.owners.filter((o) => o && o !== "*").length);
    assert.equal(await screen.locator(".sg-cell.is-mine").count(), afterCard.owners.filter((o) => o === "GUEST-000").length);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll(".sg-sq")].findIndex((s) => s.classList.contains("is-here"))), after.pos);

    // Out of practice chips, the button fills them up again.
    await page.evaluate(() => localStorage.setItem("aiglish_casino_chips_GUEST-000", "40"));
    await page.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    await tab.locator(".casino-game.mode-sugoroku").click();
    await screen.getByRole("button", { name: "練習チップを1,000枚に戻す" }).click();
    assert.equal(await page.evaluate(() => window.Casino.balance()), 1000);
    await screen.getByRole("button", { name: "サイコロを振る" }).waitFor();

    // Closed and opened again: the same card and place.
    await page.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    await tab.locator(".casino-game.mode-sugoroku").click();
    await screen.locator(".sg-card").waitFor();
    const guestName = await page.evaluate(() => myName);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".sg-cell")].map((c) => c.title || c.textContent)), afterCard.cells.map((n, i) => (afterCard.owners[i] === "GUEST-000" ? guestName + "のボール（" + n + "）" : n ? String(n) : "FREE")));

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

    // おまかせ plays a blackjack round by itself and goes on.
    await page.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    await page.evaluate((name) => {
      const s = JSON.parse(localStorage.getItem(name));
      s.pending = { game: "blackjack", bet: 100 };
      localStorage.setItem(name, JSON.stringify(s));
    }, SAVE);
    await tab.locator(".casino-game.mode-sugoroku").click();
    await game.locator('[data-sg-game="auto"]').click();
    await page.waitForFunction((name) => JSON.parse(localStorage.getItem(name)).pending === null, SAVE);
    await settled();
    const auto = await saved();
    assert.equal(auto.pending, null);

    // The draws are fixed from here: the next values crypto gives go to the die, then the ball.
    const fix = (values) =>
      page.evaluate((values) => {
        const real = window.__realRandom || (window.__realRandom = crypto.getRandomValues.bind(crypto));
        window.__queue = values.slice();
        crypto.getRandomValues = (array) => (window.__queue.length ? ((array[0] = window.__queue.shift()), array) : real(array));
      }, values);
    // A ball off the card: it rolls in, greys out and pays 1.5× the bet (100 → 150).
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
    const zeroAt = await page.evaluate(() => window.SugorokuModel.RULES.normal[100].findIndex((x) => x.x === 0 && !x.ball));
    await fix([0, missNo - 1, zeroAt]);
    await screen.locator("[data-sg-roll]").click();
    await settled();
    const missed = await saved();
    assert.equal(missed.won - before.won, 150);
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
    // Die 1 onto START: the lap ball completes the row; the bingo wheel stops on × 20.
    const wheelAt = (test) => page.evaluate((src) => window.SugorokuModel.RULES.wheels.bingo.findIndex(Function("x", "return " + src)), test);
    const before20 = await saved();
    await fix([0, lastNo - 1, await wheelAt("x.x === 20")]);
    // Every look the wheel layer takes is noted (with reduced motion the bingo wheel is gone again
    // within a few milliseconds, before START's own wheel).
    await page.evaluate(() => {
      window.__layers = [];
      const layer = document.querySelector(".sg-layer");
      new MutationObserver(() => window.__layers.push(layer.className)).observe(layer, { attributes: true, attributeFilter: ["class"] });
    });
    await screen.locator("[data-sg-roll]").click();
    await settled();
    assert.ok((await page.evaluate(() => window.__layers)).some((c) => c.includes("is-bingo")), "the bingo wheel spun");
    await playGame();
    const done = await saved(),
      doneCard = await card();
    assert.equal(done.bingos, before20.bingos + 1);
    // A line of only the guest's balls: (bingo prize 300 + × 20 = 2,000) × 1.5, plus START's wheel.
    assert.ok(done.won - before20.won >= 3450, String(done.won - before20.won));
    // The finished row starts again: no balls, fresh numbers; amy's ball stays.
    assert.deepEqual(doneCard.owners.slice(0, 7), ["", "", "", "", "", "", ""]);
    assert.ok(!doneCard.cells.slice(0, 7).includes(lastNo));
    assert.equal(doneCard.owners[10], "amy");
    await page.screenshot({ path: "/tmp/sugoroku-after.png", fullPage: true });

    // A mini game: the wheel stops on 10秒ぴったり, played start → stop → on, and paid.
    await page.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    const nextNo = await page.evaluate(([name, cardName]) => {
      const s = JSON.parse(localStorage.getItem(name));
      s.pos = 79;
      localStorage.setItem(name, JSON.stringify(s));
      const c = JSON.parse(localStorage.getItem(cardName));
      c.owners = c.owners.map((o, i) => (o === "*" ? o : i >= 7 && i < 13 ? "amy" : ""));
      localStorage.setItem(cardName, JSON.stringify(c));
      return c.cells[13];
    }, [SAVE, CARD]);
    await tab.locator(".casino-game.mode-sugoroku").click();
    await screen.locator(".sg-card").waitFor();
    await fix([0, nextNo - 1, await wheelAt('x.game === "timer"')]);
    const beforeMini = await saved();
    await screen.locator("[data-sg-roll]").click();
    const mini = screen.locator(".sg-layer.is-mini:not([hidden])");
    await mini.locator('[data-sg-game="start"]').waitFor();
    assert.match(await mini.locator(".sg-wheel-title").innerText(), /10秒ぴったり/);
    assert.deepEqual((await saved()).bonus.map((b) => b.game), ["timer"]);
    // A script's press does not start it; a real one does.
    await mini.locator('[data-sg-game="start"]').evaluate((b) => b.click());
    assert.equal((await saved()).bonus[0].started, undefined);
    await mini.locator('[data-sg-game="start"]').click();
    assert.equal((await saved()).bonus[0].started, true);
    await page.waitForTimeout(300);
    await mini.locator('[data-sg-game="stop"]').click();
    assert.match(await mini.locator(".sg-game-line").innerText(), /ずれ \d+\.\d\d秒　→　\d+点/);
    await mini.locator('[data-sg-game="next"]').click();
    await settled();
    const afterMini = await saved();
    assert.deepEqual(afterMini.bonus, []);
    // amy's row: no solo bonus, and the prize of 300 is shared by the balls on it: the guest's
    // one ball keeps 43, amy's six parts (257) wait on the card for her; plus whatever the timer
    // scored (0 this far off).
    assert.ok(afterMini.won - beforeMini.won >= 43);
    assert.deepEqual((await card()).owed, { amy: 257 });

    // A mini game left half way scores 0 when the game is opened again.
    await page.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    await page.evaluate((name) => {
      const s = JSON.parse(localStorage.getItem(name));
      s.bonus = [{ game: "tap", mult: 1, started: true }];
      localStorage.setItem(name, JSON.stringify(s));
    }, SAVE);
    await tab.locator(".casino-game.mode-sugoroku").click();
    await mini.locator('[data-sg-game="next"]').waitFor();
    assert.match(await mini.innerText(), /途中でやめたので0点/);
    await mini.locator('[data-sg-game="next"]').click();
    assert.deepEqual((await saved()).bonus, []);
    assert.deepEqual(errors, []);
    console.log("PASS: すごろくビンゴ card/track/jackpots, rolls pay and save, resume, an event game kept and settled, a ball off the card pays 1.5×, other players' balls by name, a line of own balls spins BINGO and starts the row again, a mini game played and paid, a left one scores 0");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
