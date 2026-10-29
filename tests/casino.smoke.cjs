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

    // Six tabs fit on a small phone, with the chip icon for the casino.
    const nav = await page.locator(".nav-bar .nav-item").evaluateAll((items) => items.map((b) => ({ id: b.id, right: b.getBoundingClientRect().right, wide: b.scrollWidth <= b.clientWidth + 1 })));
    assert.equal(nav.length, 6);
    assert.ok(nav.every((n) => n.right <= 375.5 && n.wide), JSON.stringify(nav));
    await page.locator("#nav-casino").click();
    const tab = page.locator("#view-casino.active");
    await tab.locator(".casino-game").nth(3).waitFor();
    assert.deepEqual(await tab.locator(".casino-game b").allInnerTexts(), ["ポーカー", "すごろくビンゴ", "ブラックジャック", "ルーレット", "ダイスポーカー", "チンチロ"]);
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
    // Deal order: player, dealer, player; then the player's draws; the dealer's second card last.
    await stacked(["Th", "Td", "9h", "7c"]);
    await tab.locator(".mode-blackjack").click();
    const bj = page.locator("dialog.casino-screen.is-blackjack[open]");
    await bj.waitFor();
    assert.equal(await bj.locator(".cs-bet").innerText(), "10枚");
    await bj.getByRole("button", { name: "+50" }).click();
    assert.equal(await bj.locator(".cs-bet").innerText(), "60枚");
    await bj.getByRole("button", { name: "配る" }).click();
    assert.match(await bj.locator(".cs-seat .cs-hand-label b").innerText(), /^19/);
    // The dealer has one card until the player is done.
    assert.match(await bj.locator(".is-dealer .cs-hand-label b").innerText(), /^10（2枚目はみんなのあと）/);
    assert.equal(await bj.locator(".is-dealer .pk-card:not(.is-back)").count(), 1);
    // A beginner sees what to do and why: 19 stands. No pair, so no split; 19 can still double.
    assert.deepEqual(await bj.locator(".cs-moves button b").allInnerTexts(), ["ヒット", "スタンド", "ダブル"]);
    assert.equal(await bj.locator(".cs-moves .is-suggested b").innerText(), "スタンド");
    assert.match(await bj.locator(".cs-advice").innerText(), /^迷ったら「スタンド」：17以上は/);
    assert.equal(await bj.locator("[data-cs-balance]").innerText(), "940枚");
    await bj.locator("[data-move=stand]").click();
    assert.match(await bj.locator(".cs-result").innerText(), /あなたの勝ち\s*\+60枚/);
    assert.deepEqual(await bj.locator(".is-dealer .pk-card b").allInnerTexts(), ["10", "7"]);
    assert.equal(await bj.locator("[data-cs-balance]").innerText(), "1,060枚");
    // A bust: 10+6 takes a king; the dealer then only turns one card.
    await stacked(["Ts", "9d", "6h", "Kc", "8c"]);
    await bj.getByRole("button", { name: "もう一度配る" }).click();
    await bj.locator("[data-move=hit]").click();
    assert.match(await bj.locator(".cs-result").innerText(), /21を超えました\s*−60枚/);
    assert.equal(await bj.locator("[data-cs-balance]").innerText(), "1,000枚");
    // Doubling on 11 takes one card for twice the bet.
    await stacked(["5h", "Tc", "6d", "Ts", "7s"]);
    await bj.getByRole("button", { name: "もう一度配る" }).click();
    await bj.locator("[data-move=double]").click();
    assert.match(await bj.locator(".cs-result").innerText(), /あなたの勝ち\s*\+120枚/);
    assert.equal(await bj.locator("[data-cs-balance]").innerText(), "1,120枚");
    // Splitting two 8s: two hands of 60 each, both beat the dealer's 17.
    await stacked(["8h", "Tc", "8d", "3s", "Kc", "Ts", "7s"]);
    await bj.getByRole("button", { name: "もう一度配る" }).click();
    assert.equal(await bj.locator(".cs-moves .is-suggested b").innerText(), "スプリット");
    await bj.locator("[data-move=split]").click();
    assert.equal(await bj.locator(".cs-seat-hand").count(), 2);
    assert.equal(await bj.locator("[data-cs-balance]").innerText(), "1,000枚");
    await bj.locator("[data-move=double]").click(); // 8+3 = 11, doubled with a 10
    await bj.locator("[data-move=stand]").click(); // 8+K = 18
    assert.match(await bj.locator(".cs-result").innerText(), /手1 勝ち・手2 勝ち\s*\+180枚/);
    assert.equal(await bj.locator("[data-cs-balance]").innerText(), "1,300枚");
    await page.screenshot({ path: "/tmp/casino-blackjack-split.png" });
    // Back to 1,000 for the checks below: five busts of 60.
    await stacked(["Ts", "9d", "6h", "Kc", "8c"]);
    for (let i = 0; i < 5; i++) {
      await bj.getByRole("button", { name: "もう一度配る" }).click();
      await bj.locator("[data-move=hit]").click();
    }
    assert.equal(await bj.locator("[data-cs-balance]").innerText(), "1,000枚");
    await page.evaluate(() => window.__restoreShuffle());
    await page.screenshot({ path: "/tmp/casino-blackjack.png" });
    await bj.getByRole("button", { name: "ブラックジャックを閉じる" }).click();

    // Roulette: chips on red and on 7, the wheel stops on 7.
    await tab.locator(".mode-roulette").click();
    const rl = page.locator("dialog.casino-screen.is-roulette[open]");
    await rl.waitFor();
    assert.equal(await rl.locator(".cs-board .is-num").count(), 36);
    // The whole game fits on the phone screen: no scrolling to reach the table or the spin.
    assert.ok(await rl.evaluate((d) => d.scrollHeight <= d.clientHeight + 1), "roulette scrolls");
    // Laid out like the felt: 3 on top of the first column, 1 at the bottom, the row bets on the right.
    const at = (on) => rl.locator('.cs-spot[data-on="' + on + '"]').evaluate((b) => [b.style.gridColumn, b.style.gridRow]);
    assert.deepEqual(await at("3"), ["2", "1"]);
    assert.deepEqual(await at("1"), ["2", "3"]);
    assert.deepEqual(await at("c3"), ["14", "1"]);
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
    await dp.getByRole("button", { name: /振り直す（あと2回）/ }).click();
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
    // The tab keeps today's running total of practice chips.
    assert.equal(await tab.locator("[data-casino-today]").innerText(), "今日 " + (chips - 1000 > 0 ? "+" : chips < 1000 ? "−" : "±") + Math.abs(chips - 1000).toLocaleString("ja-JP") + "枚");

    // Chinchiro alone: the parent rolls 3-3-4 (a point of 4), I roll 5-5-6 (6) and win.
    await page.evaluate(() => {
      const seq = [0, 2, 2, 3, 4, 4, 5];
      const original = crypto.getRandomValues.bind(crypto);
      crypto.getRandomValues = (array) => (array.length === 1 && array instanceof Uint32Array && seq.length ? ((array[0] = seq.shift()), array) : original(array));
      window.__restoreChin = () => (crypto.getRandomValues = original);
    });
    const before = await page.evaluate(() => window.Casino.balance());
    await tab.locator(".mode-chinchiro").click();
    const cc = page.locator("dialog.casino-screen.is-chinchiro[open]");
    await cc.waitFor();
    assert.deepEqual(await cc.locator(".cs-mode button").allInnerTexts(), ["ひとりで", "一緒に", "タイマン"]);
    await cc.getByRole("button", { name: "勝負する" }).click();
    assert.match(await cc.locator(".cs-chin-side").first().innerText(), /4の目/);
    await cc.locator("[data-chin-roll]").click();
    await page.evaluate(() => window.__restoreChin());
    assert.match(await cc.locator(".cs-chin-side").nth(1).innerText(), /6の目/);
    assert.match(await cc.locator(".cs-result").innerText(), /あなたの勝ち\s*\+10枚/);
    assert.equal(await page.evaluate(() => window.Casino.balance()), before + 10);
    await page.screenshot({ path: "/tmp/casino-chinchiro.png" });
    await cc.getByRole("button", { name: "チンチロを閉じる" }).click();

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
    await stacked(["Ts", "Td", "7h", "9c"]);
    await tab.locator(".mode-blackjack").click();
    await bj.waitFor();
    await bj.getByRole("button", { name: "配る" }).click();
    await bj.locator("[data-move=stand]").click();
    assert.match(await bj.locator(".cs-result").innerText(), /ディーラーの勝ち\s*−60pt/);
    await page.waitForFunction(() => window.__wallet["users/casino-a/learningPoints/main"].balance === 240 && window.StudyPoints.balance() === 240);
    await page.evaluate(() => window.__restoreShuffle());
    const keys = await page.evaluate(() => Object.keys(window.__wallet["users/casino-a/learningPoints/main"].poker));
    assert.equal(keys.length, 1);
    assert.match(keys[0], /^casino:blackjack:.+:bet$/);
    // Points bet in the casino feed the shared jackpots (3% and 2% of what was bet).
    await page.waitForFunction(() => window.__wallet["shared/casino_jackpot"]?.bet === 60);
    assert.deepEqual(await page.evaluate(() => window.CasinoJackpot.amounts()), { jp: 1001, sjp: 5001 });
    // A poker hand lost to another player (no house share) does not feed them.
    const pendingBefore = await page.evaluate(() => localStorage.getItem("aiglish_casino_jackpot_pending"));
    await page.evaluate(() => window.Poker.settle("ROOM1:0:1", -10));
    assert.equal(await page.evaluate(() => localStorage.getItem("aiglish_casino_jackpot_pending")), pendingBefore);
    assert.equal(await page.evaluate(() => window.__wallet["users/casino-a/learningPoints/main"].balance), 230);
    await page.evaluate(() => window.Poker.settle("ROOM1:0:2", 10));
    // Over the balance, the bet stops at what there is.
    await bj.getByRole("button", { name: "+100" }).click();
    await bj.getByRole("button", { name: "+100" }).click();
    assert.equal(await bj.locator(".cs-bet").innerText(), "240pt");
    assert.equal(await bj.getByRole("button", { name: "+100" }).isDisabled(), true);
    await bj.getByRole("button", { name: "ブラックジャックを閉じる" }).click();
    // すごろくビンゴ signed in stakes points: a roll is one wallet write (the bet less what came
    // back), and its bet feeds the jackpots. Die 1 onto a normal square, its wheel on ×0.
    await page.evaluate(() => {
      window.fbSetDoc = async (path, value) => (window.__wallet[path] = structuredClone(value));
      // The shared card is already there (a new one would take draws of its own).
      window.__wallet["shared/sugoroku_live"] = { ...window.SugorokuModel.newCard((n) => n - 1), people: {}, log: [] };
    });
    const keysBefore = await page.evaluate(() => Object.keys(window.__wallet["users/casino-a/learningPoints/main"].poker).length);
    await tab.locator(".mode-sugoroku").click();
    const sg = page.locator("dialog.casino-screen.is-sugoroku[open]");
    await sg.locator("[data-sg-roll]").waitFor();
    await page.evaluate(() => {
      const S = window.SugorokuModel,
        q = [0, S.RULES.normal[100].findIndex((x) => x.x === 0 && !x.ball)],
        real = crypto.getRandomValues.bind(crypto);
      crypto.getRandomValues = (a) => (q.length ? ((a[0] = q.shift()), a) : real(a));
      // Pressed in the same step, so nothing running in the background takes the fixed draws.
      document.querySelector("[data-sg-roll]").click();
    });
    assert.match(await sg.locator("[data-cs-balance]").innerText(), /pt$/);
    await page.waitForFunction(() => !document.querySelector(".cs-body.is-spinning"));
    await page.waitForFunction(() => window.__wallet["users/casino-a/learningPoints/main"].balance === 140);
    assert.equal(await page.evaluate(() => window.StudyPoints.balance()), 140);
    const sgKeys = await page.evaluate(() => Object.keys(window.__wallet["users/casino-a/learningPoints/main"].poker));
    assert.equal(sgKeys.length, keysBefore + 1);
    assert.ok(sgKeys.some((k) => /^casino:sugoroku:.+:net$/.test(k)));
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("aiglish_sugoroku_casino-a"))).rolls, 1);
    await page.waitForFunction(() => Number(localStorage.getItem("aiglish_casino_jackpot_pending")) + (window.__wallet["shared/casino_jackpot"]?.bet || 0) === 160);
    await sg.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    assert.equal(await tab.locator("[data-casino-balance]").innerText(), "140pt");
    // Signed in, the bingo card is the shared one: a ball goes on it under this player's name,
    // and another player opening the game sees it there.
    await page.evaluate(() => {
      window.fbGetDoc = async (path) => ({ exists: () => !!window.__wallet[path], data: () => structuredClone(window.__wallet[path]) });
      localStorage.setItem("aiglish_sugoroku_casino-a", JSON.stringify({ ...window.SugorokuModel.newState(), rolls: 5, pos: 0 }));
    });
    await tab.locator(".mode-sugoroku").click();
    await sg.locator("[data-sg-roll]").waitFor();
    const hitNo = await page.evaluate(() => {
      const c = JSON.parse(localStorage.getItem("aiglish_sugoroku_card_live")) || null;
      return c ? c.cells.find((n, i) => n && !c.owners[i]) : null;
    });
    const firstNo = hitNo || (await page.evaluate(() => [...document.querySelectorAll(".sg-cell span")].map((x) => Number(x.textContent)).find(Boolean)));
    await page.evaluate(([n]) => {
      const S = window.SugorokuModel,
        q = [0, S.RULES.normal[100].findIndex((x) => x.ball), n - 1],
        real = crypto.getRandomValues.bind(crypto);
      crypto.getRandomValues = (a) => (q.length ? ((a[0] = q.shift()), a) : real(a));
    }, [firstNo]);
    await sg.locator("[data-sg-roll]").click();
    await page.waitForFunction(() => !document.querySelector(".cs-body.is-spinning") && window.__wallet["shared/sugoroku_live"]);
    const sharedCard = await page.evaluate(() => window.__wallet["shared/sugoroku_live"]);
    const cellAt = sharedCard.owners.indexOf("casino-a");
    assert.ok(cellAt >= 0, "the ball is on the shared card");
    assert.ok(sharedCard.people["casino-a"]);
    await sg.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    await page.evaluate(() => {
      myId = "casino-b";
      localStorage.removeItem("aiglish_sugoroku_card_live");
    });
    await tab.locator(".mode-sugoroku").click();
    await sg.locator("[data-sg-roll]").waitFor();
    const other = sg.locator(".sg-cell").nth(cellAt);
    assert.match(await other.getAttribute("title"), /のボール/);
    assert.equal(await other.evaluate((c) => c.classList.contains("is-on") && !c.classList.contains("is-mine")), true);
    await sg.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    assert.deepEqual(errors, []);
    console.log("PASS: casino tab (6 tabs fit, chip balance), poker from the casino, blackjack win/bust, roulette red+7, dice hold/re-roll/stand, points bet out once per round, bet capped at the balance, すごろくビンゴ on points in one wallet write a roll, bets feed the shared jackpot, the すごろくビンゴ card shared between players");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
