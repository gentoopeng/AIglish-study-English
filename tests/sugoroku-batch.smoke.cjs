// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/sugoroku-batch.smoke.cjs
// まとめて振る: pick a number of rolls, they go by quickly and are paid and saved one by one, the event games that come up
// are kept (not played at once) and played one after another at the end; nothing can be rolled while one waits, and a
// queue left by closing the screen carries on when it is opened again.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const base = process.env.APP_URL || "http://127.0.0.1:8000";
const SAVE = "aiglish_sugoroku_GUEST-000_practice";
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
      localStorage.setItem("aiglish_casino_chips_GUEST-000", "50000");
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(base);
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-casino").click();
    const tab = page.locator("#view-casino.active"),
      screen = page.locator("dialog.casino-screen.is-sugoroku[open]");
    const saved = () => page.evaluate((name) => JSON.parse(localStorage.getItem(name)), SAVE);
    const chips = () => page.evaluate(() => window.Casino.balance());
    const open = async () => {
      await tab.locator(".casino-game.mode-sugoroku").click();
      await screen.locator(".sg-card").first().waitFor();
    };
    // The draws are fixed: the next values crypto gives to the game's rules (the die, then the wheels, one after the other) are
    // the scripted ones; the screen's own draws (the die's tumble, a wheel's last bit, ids) stay random.
    const fix = (values) =>
      page.evaluate((values) => {
        const real = window.__realRandom || (window.__realRandom = crypto.getRandomValues.bind(crypto));
        window.__queue = values.slice();
        crypto.getRandomValues = (array) => (window.__queue.length && new Error().stack.includes("sugoroku-model.js") ? ((array[0] = window.__queue.shift()), array) : real(array));
      }, values);
    await open();
    const rules = await page.evaluate(() => ({
      eventAt: window.SugorokuModel.RULES.board.indexOf("E"),
      zero: window.SugorokuModel.RULES.normal[100].findIndex((x) => x.x === 0 && !x.ball && !x.game && !x.event && !x.kakuhen && !x.item),
    }));
    // A start: just before the first ★ square, nothing waiting.
    const start = (extra = {}) =>
      page.evaluate(
        ([name, at, extra]) => {
          const s = JSON.parse(localStorage.getItem(name)) || window.SugorokuModel.newState();
          Object.assign(s, { pos: at - 1, pending: null, queue: [], bonus: [], items: [], hell: 0, jpWait: [] }, extra);
          localStorage.setItem(name, JSON.stringify(s));
        },
        [SAVE, rules.eventAt, extra],
      );
    const reopen = async () => {
      await page.locator("dialog.casino-screen.is-sugoroku .cs-close").evaluate((b) => b.click());
      await open();
    };
    await page.locator("dialog.casino-screen.is-sugoroku .cs-close").evaluate((b) => b.click());
    await start();
    await open();

    // ---- The button and the picker ----------------------------------------------------------
    const batch = screen.locator('[data-sg-batch="open"]');
    assert.equal(await batch.isEnabled(), true);
    await batch.click();
    const range = screen.locator(".sg-layer.is-batch input[type=range]");
    assert.equal(await range.getAttribute("max"), "20", "up to 20 rolls (50,000 chips can pay for it)");
    await screen.locator('[data-sg-batch="plus"]').click();
    assert.equal(await screen.locator(".sg-batch-num").innerText(), "6回");
    await screen.locator('[data-sg-batch="minus"]').click();
    await screen.locator('[data-sg-batch="minus"]').click();
    await screen.locator('[data-sg-batch="minus"]').click();
    await screen.locator('[data-sg-batch="minus"]').click();
    await screen.locator('[data-sg-batch="minus"]').click();
    await screen.locator('[data-sg-batch="minus"]').click();
    assert.equal(await screen.locator(".sg-batch-num").innerText(), "1回", "not below one");
    await range.evaluate((el) => {
      el.value = "3";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    assert.equal(await screen.locator(".sg-batch-num").innerText(), "3回");
    assert.match(await screen.locator(".sg-batch-total").innerText(), /賭け 合計 300枚（最大 20回）/);

    // ---- Three rolls: onto the ★ square (the dice game), then two quiet ×0 squares ------------------
    const before = await saved(),
      chips0 = await chips();
    await fix([0, 1, 0, rules.zero, 0, rules.zero]);
    await screen.locator('[data-sg-batch="go"]').click();
    await screen.locator('[data-sg-batch="next"]').waitFor({ timeout: 30000 });
    const after = await saved();
    assert.equal(after.rolls - before.rolls, 3, "three rolls, each saved");
    assert.equal(after.bet - before.bet, 300);
    assert.equal(after.pending, null, "no game on the screen yet");
    assert.deepEqual(after.queue.map((g) => g.game), ["dice"], "the dice game waits in the queue");
    assert.equal(chips0 - (await chips()), 300, "the bets are paid, the game's result comes later");
    assert.match(await screen.locator(".sg-batch-line", { hasText: "合計" }).innerText(), /−300枚/);
    assert.match(await screen.locator(".sg-batch-line", { hasText: "カードゲーム" }).innerText(), /1回 待っています/);
    // Nothing can be rolled while a game waits.
    assert.equal(await screen.locator(".sg-go").isDisabled(), true);
    assert.equal(await screen.locator('[data-sg-batch="open"]').isDisabled(), true);

    // ---- After the summary the waiting game is played, then the roll button is back -------------
    await screen.locator('[data-sg-batch="next"]').click();
    const game = screen.locator(".sg-layer.is-game");
    await game.locator('[data-sg-game="stand"]').waitFor({ timeout: 15000 });
    assert.equal((await saved()).queue.length, 0, "it is the pending game now");
    assert.equal((await saved()).pending.game, "dice");
    for (let i = 0; i < 4; i++) {
      if (!(await game.locator('[data-sg-game="stand"]').count())) break;
      await game.locator('[data-sg-game="stand"]').click().catch(() => {});
    }
    await page.waitForFunction((name) => JSON.parse(localStorage.getItem(name)).pending === null, SAVE, { timeout: 15000 });
    await page.waitForFunction(() => !document.querySelector(".sg-go").disabled, null, { timeout: 15000 });
    assert.equal((await saved()).queue.length, 0);

    // ---- Leaving with a game queued: it is there when the screen is opened again ----------------
    await start();
    await reopen();
    await batch.click();
    await range.evaluate((el) => {
      el.value = "2";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await fix([0, 1, 0, rules.zero]);
    await screen.locator('[data-sg-batch="go"]').click();
    await screen.locator('[data-sg-batch="next"]').waitFor({ timeout: 30000 });
    assert.equal((await saved()).queue.length, 1);
    await reopen();
    await screen.locator('[data-sg-game="stand"]').waitFor({ timeout: 15000 });
    assert.equal((await saved()).pending.game, "dice", "the queued game comes back on opening");
    assert.equal(await screen.locator(".sg-go").isDisabled(), true, "and it has to be played first");

    // ---- A batch stops when the chips run out ----------------------------------------------------
    await page.evaluate((name) => {
      const s = JSON.parse(localStorage.getItem(name));
      Object.assign(s, { pending: null, queue: [], bonus: [] });
      localStorage.setItem(name, JSON.stringify(s));
      localStorage.setItem("aiglish_casino_chips_GUEST-000", "250");
    }, SAVE);
    await reopen();
    await batch.click();
    assert.equal(await range.getAttribute("max"), "2", "250 chips pay for two rolls");
    assert.deepEqual(errors, []);
    console.log("PASS: まとめて振る — rolls go by quickly and are saved one by one, event games wait in a queue and are played in turn, a queue carries on after closing, the number is limited by the chips");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
