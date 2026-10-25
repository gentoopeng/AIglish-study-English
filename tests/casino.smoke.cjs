// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/casino.smoke.cjs
// The casino tab: a chip for the balance, poker moved here, and blackjack, roulette and dice poker
// against the house, on practice chips for a guest and on points (bet out, winnings back once
// per round) for a signed-in player.
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
      localStorage.setItem("aiglish_poker_tutorial_seen", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(base);
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);

    // Seven tabs still fit on a small phone, with the chip icon for the casino.
    const nav = await page.locator(".nav-bar .nav-item").evaluateAll((items) => items.map((b) => ({ id: b.id, right: b.getBoundingClientRect().right, wide: b.scrollWidth <= b.clientWidth + 1 })));
    assert.equal(nav.length, 7);
    assert.ok(nav.every((n) => n.right <= 375.5 && n.wide), JSON.stringify(nav));
    await page.locator("#nav-casino").click();
    const tab = page.locator("#view-casino.active");
    await tab.locator(".casino-game").nth(3).waitFor();
    assert.deepEqual(await tab.locator(".casino-game b").allInnerTexts(), ["ポーカー", "ブラックジャック", "ルーレット", "ダイスポーカー"]);
    assert.equal(await tab.locator("[data-casino-unit]").innerText(), "練習チップ");
    assert.equal(await tab.locator("[data-casino-balance]").innerText(), "1,000枚");
    await page.screenshot({ path: "/tmp/casino-tab.png" });

    // Poker opens from here.
    await tab.locator(".mode-poker").click();
    await page.locator("dialog.poker-screen[open]").waitFor();
    await page.getByRole("button", { name: "ポーカーを閉じる" }).click();

    // Blackjack with a fixed deck: 10+9 against the dealer's 10+7 wins the bet.
    const stacked = (cards) =>
      page.evaluate((cards) => {
        // shuffle() runs Fisher–Yates from the end; feeding j = i keeps the deck in order, so the
        // cards come off in reverse order of the list (pop takes the last).
        const deck = window.PokerModel.deck().filter((c) => !cards.includes(c)).concat(cards.slice().reverse());
        const original = window.PokerModel.shuffle;
        window.__restoreShuffle = () => (window.PokerModel.shuffle = original);
        window.PokerModel.shuffle = () => deck.slice();
      }, cards);
    await stacked(["Th", "9h", "Td", "7c"]);
    await tab.locator(".mode-blackjack").click();
    const bj = page.locator("dialog.casino-screen.is-blackjack[open]");
    await bj.waitFor();
    assert.equal(await bj.locator(".cs-bet").innerText(), "10枚");
    await bj.getByRole("button", { name: "+50" }).click();
    assert.equal(await bj.locator(".cs-bet").innerText(), "60枚");
    await bj.getByRole("button", { name: "配る" }).click();
    assert.match(await bj.locator(".is-player .cs-hand-label b").innerText(), /^19/);
    assert.match(await bj.locator(".is-dealer .cs-hand-label b").innerText(), /10 ＋ \?/);
    assert.equal(await bj.locator(".is-dealer .pk-card.is-back").count(), 1);
    assert.equal(await bj.locator("[data-cs-balance]").innerText(), "940枚");
    await bj.getByRole("button", { name: "これで勝負" }).click();
    assert.match(await bj.locator(".cs-result").innerText(), /あなたの勝ち\s*\+60枚/);
    assert.equal(await bj.locator("[data-cs-balance]").innerText(), "1,060枚");
    // A bust: 10+6 takes a king.
    await stacked(["Ts", "6h", "9d", "8c", "Kc"]);
    await bj.getByRole("button", { name: "もう一度配る" }).click();
    await bj.getByRole("button", { name: "もう1枚" }).click();
    assert.match(await bj.locator(".cs-result").innerText(), /21を超えました\s*−60枚/);
    assert.equal(await bj.locator("[data-cs-balance]").innerText(), "1,000枚");
    // Doubling on 11 takes one card for twice the bet.
    await stacked(["5h", "6d", "Tc", "7s", "Ts"]);
    await bj.getByRole("button", { name: "もう一度配る" }).click();
    await bj.getByRole("button", { name: "倍にして1枚" }).click();
    assert.match(await bj.locator(".cs-result").innerText(), /あなたの勝ち\s*\+120枚/);
    assert.equal(await bj.locator("[data-cs-balance]").innerText(), "1,120枚");
    await stacked(["Ts", "6h", "9d", "8c", "Kc"]);
    await bj.getByRole("button", { name: "もう一度配る" }).click();
    await bj.getByRole("button", { name: "もう1枚" }).click();
    assert.equal(await bj.locator("[data-cs-balance]").innerText(), "1,060枚");
    await bj.getByRole("button", { name: "もう一度配る" }).click();
    await bj.getByRole("button", { name: "もう1枚" }).click();
    assert.equal(await bj.locator("[data-cs-balance]").innerText(), "1,000枚");
    await page.evaluate(() => window.__restoreShuffle());
    await page.screenshot({ path: "/tmp/casino-blackjack.png" });
    await bj.getByRole("button", { name: "ブラックジャックを閉じる" }).click();

    // Roulette: chips on red and on 7, the wheel stops on 7.
    await tab.locator(".mode-roulette").click();
    const rl = page.locator("dialog.casino-screen.is-roulette[open]");
    await rl.waitFor();
    assert.equal(await rl.locator(".cs-numbers .cs-spot").count(), 36);
    await rl.locator('.cs-spot[data-on="red"]').click();
    await rl.locator('.cs-chip-pick button', { hasText: /^5$/ }).click();
    await rl.locator('.cs-spot[data-on="7"]').click();
    assert.match(await rl.locator(".cs-hint").innerText(), /賭けた合計 15枚/);
    await page.evaluate(() => {
      const values = new Uint32Array(1);
      const original = crypto.getRandomValues.bind(crypto);
      crypto.getRandomValues = (array) => (array.length === 1 && array instanceof Uint32Array ? ((array[0] = 7), array) : original(array));
      window.__restoreRandom = () => (crypto.getRandomValues = original);
      void values;
    });
    await rl.getByRole("button", { name: "回す" }).click();
    await rl.locator(".cs-landed:not(:empty)").waitFor();
    await page.evaluate(() => window.__restoreRandom());
    assert.equal(await rl.locator(".cs-landed").innerText(), "7");
    // red +10, 7 pays 35 × 5.
    assert.match(await rl.locator(".cs-result").innerText(), /7（赤） 当たり\s*\+185枚/);
    assert.equal(await rl.locator('.cs-spot.is-hit[data-on="7"]').count(), 1);
    // A single number hit gets the chip moment, inside the game screen.
    await rl.locator(".ceremony.is-chips").waitFor({ state: "attached" });
    assert.equal(await rl.locator(".ceremony .cer-word").textContent(), "HIT");
    assert.equal(await rl.locator("[data-cs-balance]").innerText(), "1,185枚");
    await page.screenshot({ path: "/tmp/casino-roulette.png" });
    await rl.getByRole("button", { name: "ルーレットを閉じる" }).click();

    // Dice poker: hold, re-roll, stand; the dealer rolls and the round settles.
    await tab.locator(".mode-dice").click();
    const dp = page.locator("dialog.casino-screen.is-dice[open]");
    await dp.waitFor();
    await dp.getByRole("button", { name: "ダイスを振る" }).click();
    assert.equal(await dp.locator(".cs-die-btn").count(), 5);
    await dp.locator(".cs-die-btn").first().click();
    assert.equal(await dp.locator(".cs-die-btn").first().getAttribute("aria-pressed"), "true");
    await dp.getByRole("button", { name: /キープ以外を振る（あと2回）/ }).click();
    await dp.getByRole("button", { name: /あと1回/ }).waitFor();
    await dp.getByRole("button", { name: "これで勝負" }).click();
    let chips = 1185;
    const settle = async () => {
      const outcome = await dp.locator(".cs-result").innerText();
      assert.match(outcome, /(あなたの勝ち\s*\+10枚|ディーラーの勝ち\s*−10枚|引き分け（賭けは戻ります）\s*±0枚)/);
      chips += outcome.includes("+10") ? 10 : outcome.includes("−10") ? -10 : 0;
      assert.equal(await dp.locator("[data-cs-balance]").innerText(), chips.toLocaleString("ja-JP") + "枚");
      assert.equal(await dp.locator(".is-dealer .cs-die:not(.is-empty)").count(), 5);
      return !outcome.includes("−10");
    };
    // Rounds with a held die until one is won or drawn, so the payout after holding is exercised.
    let paid = await settle();
    for (let i = 0; i < 40 && !paid; i++) {
      await dp.getByRole("button", { name: "もう一度振る" }).click();
      await dp.locator(".cs-die-btn").nth(2).click();
      await dp.getByRole("button", { name: "これで勝負" }).click();
      paid = await settle();
    }
    assert.ok(paid, "no round was won or drawn");
    await page.screenshot({ path: "/tmp/casino-dice.png" });
    await dp.getByRole("button", { name: "ダイスポーカーを閉じる" }).click();

    // Signed in: bets move points once per round through the wallet transaction.
    await page.evaluate(() => {
      myId = "casino-a";
      localStorage.setItem("core_v4_study_points_casino-a", JSON.stringify({ balance: 300, revision: 1, publishedRevision: 1 }));
      const store = { "users/casino-a/learningPoints/main": { balance: 300, revision: 1 } };
      window.__wallet = store;
      window.db = {};
      window.fbDoc = (_, ...parts) => parts.join("/");
      window.fbRunTransaction = async (_, fn) =>
        fn({
          get: async (path) => ({ exists: () => !!store[path], data: () => structuredClone(store[path]) }),
          set: (path, value) => (store[path] = { ...(store[path] || {}), ...value }),
        });
      window.switchTab("vocab");
      window.switchTab("casino");
    });
    assert.equal(await tab.locator("[data-casino-unit]").innerText(), "所持ポイント");
    assert.equal(await tab.locator("[data-casino-balance]").innerText(), "300pt");
    await stacked(["Ts", "7h", "Td", "9c"]);
    await tab.locator(".mode-blackjack").click();
    await bj.waitFor();
    await bj.getByRole("button", { name: "配る" }).click();
    await bj.getByRole("button", { name: "これで勝負" }).click();
    assert.match(await bj.locator(".cs-result").innerText(), /ディーラーの勝ち\s*−60pt/);
    await page.waitForFunction(() => window.__wallet["users/casino-a/learningPoints/main"].balance === 240 && window.StudyPoints.balance() === 240);
    await page.evaluate(() => window.__restoreShuffle());
    const keys = await page.evaluate(() => Object.keys(window.__wallet["users/casino-a/learningPoints/main"].poker));
    assert.equal(keys.length, 1);
    assert.match(keys[0], /^casino:blackjack:.+:bet$/);
    // Over the balance, the bet stops at what there is.
    await bj.getByRole("button", { name: "+100" }).click();
    await bj.getByRole("button", { name: "+100" }).click();
    assert.equal(await bj.locator(".cs-bet").innerText(), "240pt");
    assert.equal(await bj.getByRole("button", { name: "+100" }).isDisabled(), true);
    await bj.getByRole("button", { name: "ブラックジャックを閉じる" }).click();
    assert.deepEqual(errors, []);
    console.log("PASS: casino tab (7 tabs fit, chip balance), poker from the casino, blackjack win/bust, roulette red+7, dice hold/re-roll/stand, points bet out once per round, bet capped at the balance");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
