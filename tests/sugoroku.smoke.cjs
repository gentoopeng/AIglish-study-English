// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/sugoroku.smoke.cjs
// すごろくビンゴ in the casino on practice chips: rolling moves the piece and marks the card,
// the chips change by what was paid out less the cost, the game carries on after closing, and a
// finished line spins the lamp roulette.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const base = process.env.APP_URL || "http://127.0.0.1:8000";
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
    await tab.locator(".casino-game.mode-sugoroku").click();
    const screen = page.locator("dialog.casino-screen.is-sugoroku[open]");
    await screen.locator(".sg-board").waitFor();
    // 24 squares round a 5×5 card, the middle free, and both jackpots shown.
    assert.equal(await screen.locator(".sg-sq").count(), 24);
    assert.equal(await screen.locator(".sg-cell").count(), 25);
    assert.equal(await screen.locator(".sg-cell.is-free").innerText(), "FREE");
    assert.equal(await screen.locator('[data-pot="jp"] b').innerText(), "100枚");
    assert.equal(await screen.locator('[data-pot="sjp"] b').innerText(), "1,000枚");
    // Nothing spills out sideways on a small phone.
    const wide = await page.evaluate(() => [...document.querySelectorAll(".sg-sq,.sg-cell")].filter((el) => el.scrollWidth > el.clientWidth + 1).length);
    assert.equal(wide, 0);
    await page.screenshot({ path: "/tmp/sugoroku.png", fullPage: true });

    // Rolls at 50 chips each: chips = 1000 − cost + paid out, every time.
    await screen.getByRole("radio", { name: "50枚" }).click();
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem("aiglish_sugoroku_GUEST-000_practice")));
    for (let i = 0; i < 3; i++) {
      await screen.locator("[data-sg-roll]").click();
      await page.waitForFunction(() => !document.querySelector(".sg-go").disabled && !document.querySelector(".cs-body.is-spinning"));
    }
    const after = await saved();
    assert.equal(after.rolls, 3);
    assert.equal(after.bet, 150);
    assert.equal(await page.evaluate(() => window.Casino.balance()), 1000 - 150 + after.won);
    assert.ok(after.marks.filter(Boolean).length >= 2, "the card is marked");
    assert.equal(await screen.locator(".sg-cell.is-on").count(), after.marks.filter(Boolean).length);
    assert.equal(await screen.locator(".sg-sq.is-here").count(), 1);

    // Closed and opened again: the same card and place.
    await page.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    await tab.locator(".casino-game.mode-sugoroku").click();
    await screen.locator(".sg-board").waitFor();
    assert.equal(await page.evaluate(() => [...document.querySelectorAll(".sg-sq")].findIndex((s) => s.classList.contains("is-here"))), after.pos);
    assert.deepEqual(await screen.locator(".sg-cell").allInnerTexts(), after.card.map((n) => (n ? String(n) : "FREE")));

    // A top row already filled is a line on the next roll: BINGO and the roulette spins.
    await page.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    await page.evaluate(() => {
      const name = "aiglish_sugoroku_GUEST-000_practice",
        s = JSON.parse(localStorage.getItem(name));
      for (const c of [0, 1, 2, 3, 4]) s.marks[c] = true;
      s.lines = [];
      s.stake = 400;
      localStorage.setItem(name, JSON.stringify(s));
    });
    await tab.locator(".casino-game.mode-sugoroku").click();
    await screen.locator(".sg-cell.is-reach, .sg-cell.is-on").first().waitFor();
    await screen.locator("[data-sg-roll]").click();
    await screen.locator(".sg-wheel:not([hidden]) .sg-slot").first().waitFor();
    assert.equal(await screen.locator(".sg-wheel .sg-slot").count(), 10);
    assert.match(await screen.locator(".sg-wheel-head").innerText(), /ルーレット|JACKPOT/);
    await page.waitForFunction(() => !document.querySelector(".cs-body.is-spinning"));
    const done = await saved();
    assert.ok(done.lines.includes(0) || done.cards > after.cards);
    assert.equal(done.stake, 0);
    assert.equal(await page.evaluate(() => window.Casino.balance()), 1000 - 200 + done.won);
    assert.ok((await screen.locator(".sg-cell.is-line").count()) >= 5);
    await page.screenshot({ path: "/tmp/sugoroku-line.png", fullPage: true });

    assert.deepEqual(errors, []);
    console.log("PASS: すごろくビンゴ board and card, rolls pay and save, resume after closing, a line spins the roulette");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
