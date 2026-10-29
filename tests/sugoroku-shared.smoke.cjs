// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/sugoroku-shared.smoke.cjs
// すごろくビンゴ signed in, on the shared card (a fake cloud): what is read back from the card is
// checked (a bad icon is dropped, a junk log entry too); the numbers a reach waits on are shown;
// a failed write charges nothing and asks to roll again; a player's part of someone else's line
// is collected once; a line is shared by the balls on it and goes in everybody's log; the
// records sheet; 早送り is remembered; a script's taps do not count; and a jackpot win takes the
// pot in one transaction and starts it again.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const base = process.env.APP_URL || "http://127.0.0.1:8000";
const SAVE = "aiglish_sugoroku_sg-a_practice",
  CARD = "shared/sugoroku_card";
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
    // Signed in as sg-a, with a cloud kept in the page. B's six balls fill the top row but its
    // last cell; B's icon is not an image; the log has one good entry and one junk one; sg-a is
    // owed 120 from an earlier line.
    const row = await page.evaluate(() => {
      myId = "sg-a";
      myName = "A";
      const S = window.SugorokuModel,
        card = S.newCard((n) => n - 1);
      card.owners = card.owners.map((o, i) => (o === "*" ? o : i < 6 ? "sg-b" : ""));
      const store = {
        "shared/sugoroku_card": {
          ...card,
          owed: { "sg-a": 120 },
          people: { "sg-b": { n: "B", i: 'x");background:url(https://example.com/x' } },
          log: [{ t: "bingo", id: "sg-b", n: "B", c: 2, at: Date.now() - 60000 }, { t: "junk", id: "x", at: 1 }],
        },
      };
      window.__store = store;
      window.__failCard = false;
      window.db = {};
      window.fbDoc = (_, ...parts) => parts.join("/");
      window.fbGetDoc = async (path) => ({ exists: () => !!store[path], data: () => structuredClone(store[path]) });
      window.fbRunTransaction = async (_, fn) => {
        const writes = [];
        const result = await fn({
          get: async (path) => {
            if (window.__failCard && path === "shared/sugoroku_card") throw Error("offline");
            return { exists: () => !!store[path], data: () => structuredClone(store[path]) };
          },
          set: (path, value, options) => writes.push([path, structuredClone(value), options?.merge]),
        });
        for (const [path, value, merge] of writes) store[path] = merge ? { ...(store[path] || {}), ...value } : value;
        return result;
      };
      return card.cells.slice(0, 7);
    });
    const saved = () => page.evaluate((name) => JSON.parse(localStorage.getItem(name) || "null"), SAVE);
    const chips = () => page.evaluate(() => window.Casino.balance());
    const fix = (values) =>
      page.evaluate((values) => {
        const real = window.__realRandom || (window.__realRandom = crypto.getRandomValues.bind(crypto));
        window.__queue = values.slice();
        crypto.getRandomValues = (array) => (window.__queue.length ? ((array[0] = window.__queue.shift()), array) : real(array));
      }, values);
    const settled = () => page.waitForFunction(() => !document.querySelector(".cs-body.is-spinning") && !document.querySelector(".sg-go").disabled);
    const rule = (src) => page.evaluate((src) => Function("S", "return " + src)(window.SugorokuModel), src);

    await page.locator("#nav-casino").click();
    const tab = page.locator("#view-casino.active");
    await tab.locator(".casino-game.mode-sugoroku").click();
    const screen = page.locator("dialog.casino-screen.is-sugoroku[open]");
    await screen.locator(".sg-card").waitFor();
    // B's balls show B's initial, not the bad icon.
    const first = screen.locator(".sg-cell").first();
    assert.equal(await first.getAttribute("data-initial"), "B");
    assert.equal(await first.evaluate((c) => c.style.backgroundImage), "");
    // The row waits on its last number, shown beside the reach count; the card is warm.
    assert.match(await screen.locator(".sg-status").innerText(), new RegExp("リーチ 1（" + row[6] + "）"));
    assert.equal(await screen.locator(".sg-card-wrap").evaluate((w) => w.classList.contains("is-warm")), true);
    // 記録: the good log entry only.
    await screen.getByRole("button", { name: "すごろくビンゴの記録" }).click();
    const sheet = screen.locator(".sg-book");
    assert.deepEqual(await sheet.locator(".sg-log li span").allInnerTexts(), ["Bさん　DOUBLE BINGO"]);
    assert.match(await sheet.locator(".sg-stats").innerText(), /振った回数\s*0回/);
    await sheet.getByRole("button", { name: "閉じる" }).click();

    // The cloud cannot be written: nothing is charged or saved, and the player is asked again.
    const start = await chips();
    await page.evaluate(() => (window.__failCard = true));
    await screen.locator("[data-sg-roll]").click();
    await page.waitForFunction(() => /通信できませんでした/.test(document.querySelector(".sg-say").textContent));
    assert.equal(await chips(), start);
    assert.equal((await saved())?.rolls || 0, 0);
    assert.equal(await screen.locator("[data-sg-roll]").isDisabled(), false);
    await page.evaluate(() => (window.__failCard = false));

    // Next roll: die 1 onto a normal square, its wheel on ×0. The 120 owed comes in first, once.
    const zeroAt = await rule("S.RULES.normal[100].findIndex((x) => x.x === 0 && !x.ball)");
    await fix([0, zeroAt]);
    await screen.locator("[data-sg-roll]").click();
    await settled();
    assert.equal(await chips(), start - 100 + 120);
    assert.equal((await saved()).shared, 120);
    assert.deepEqual(await page.evaluate(() => window.__store["shared/sugoroku_card"].owed), {});

    // A ball on the row's last number finishes B's row: the prize of 300 is shared by the 7
    // balls (B's 6 parts, 257, wait on the card for B), the bingo wheel's × 5 is all A's, and the
    // line goes in the log with A's name.
    const ballAt = await rule("S.RULES.normal[100].findIndex((x) => x.ball)"),
      fiveAt = await rule("S.RULES.wheels.bingo.findIndex((x) => x.x === 5)");
    const before = await chips();
    await fix([0, ballAt, row[6] - 1, fiveAt]);
    await screen.locator("[data-sg-roll]").click();
    await settled();
    assert.equal(await chips(), before - 100 + (300 - 257) + 500);
    const shared = await page.evaluate(() => window.__store["shared/sugoroku_card"]);
    assert.deepEqual(shared.owed, { "sg-b": 257 });
    assert.deepEqual(Object.keys(shared.owedAt), ["sg-b"]);
    assert.deepEqual(shared.owners.slice(0, 7), ["", "", "", "", "", "", ""]);
    assert.deepEqual(shared.log.map((e) => [e.t, e.id, e.n, e.c]), [["bingo", "sg-b", "B", 2], ["bingo", "sg-a", "A", 1]]);
    assert.equal((await saved()).bingos, 1);
    await screen.getByRole("button", { name: "すごろくビンゴの記録" }).click();
    assert.deepEqual(await sheet.locator(".sg-log li span").allInnerTexts(), ["あなた　BINGO", "Bさん　DOUBLE BINGO"]);
    assert.match(await sheet.locator(".sg-stats").innerText(), /ビンゴ\s*1列/);
    await sheet.getByRole("button", { name: "閉じる" }).click();

    // 早送り is a toggle kept for next time.
    const quick = screen.getByRole("button", { name: "早送り" });
    assert.equal(await quick.getAttribute("aria-pressed"), "false");
    await quick.click();
    assert.equal(await quick.getAttribute("aria-pressed"), "true");
    await screen.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    await tab.locator(".casino-game.mode-sugoroku").click();
    await screen.locator(".sg-card").waitFor();
    assert.equal(await screen.getByRole("button", { name: "早送り" }).getAttribute("aria-pressed"), "true");

    // The tapping game: taps made by a script do not count, real ones do.
    await screen.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    await page.evaluate((name) => {
      window.SugorokuModel.RULES.games.tap.seconds = 1.5;
      const s = JSON.parse(localStorage.getItem(name));
      s.bonus = [{ game: "tap", mult: 1 }];
      localStorage.setItem(name, JSON.stringify(s));
    }, SAVE);
    await tab.locator(".casino-game.mode-sugoroku").click();
    const mini = screen.locator(".sg-layer.is-mini:not([hidden])");
    await mini.locator('[data-sg-game="start"]').click();
    const pad = mini.locator('[data-sg-game="tap"]');
    await pad.waitFor();
    await pad.evaluate((b) => {
      for (let i = 0; i < 50; i++) {
        b.click();
        b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      }
    });
    for (let i = 0; i < 3; i++) await pad.click();
    await mini.locator('[data-sg-game="next"]').waitFor();
    assert.match(await mini.locator(".sg-game-line").innerText(), /^3回　→　30点/);
    await mini.locator('[data-sg-game="next"]').click();

    // B, opening the casino tab, sees the part waiting on the すごろくビンゴ tile.
    await screen.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    await page.evaluate(() => {
      myId = "sg-b";
      window.switchTab("vocab");
      window.switchTab("casino");
    });
    await tab.locator(".mode-sugoroku .casino-waiting").waitFor();
    assert.equal(await tab.locator(".mode-sugoroku .casino-waiting").innerText(), "分け前 257枚 届いています");
    await page.evaluate(() => (myId = "sg-a"));

    // A jackpot win: the pot is taken with this device's unsent bets in, and starts again from
    // its seed; a second win right after gets the seed and what came in since.
    const wins = await page.evaluate(async () => {
      window.__store["shared/casino_jackpot"] = { bet: 100000, jpFrom: 0, sjpFrom: 0 };
      localStorage.setItem("aiglish_casino_jackpot_pending", "0");
      const first = await window.CasinoJackpot.win("jp", { id: "sg-a", n: "A" });
      // 20,000 bet on this device and not sent yet.
      localStorage.setItem("aiglish_casino_jackpot_pending", "20000");
      const second = await window.CasinoJackpot.win("jp", { id: "sg-c", n: "C" });
      const pot = window.__store["shared/casino_jackpot"];
      return { first, second, bet: pot.bet, jpFrom: pot.jpFrom, sjpFrom: pot.sjpFrom, who: pot.wins.map((w) => [w.kind, w.n, w.amount]), now: window.CasinoJackpot.amounts() };
    });
    assert.deepEqual(wins, { first: 6000, second: 5200, bet: 120000, jpFrom: 120000, sjpFrom: 0, who: [["jp", "A", 6000], ["jp", "C", 5200]], now: { jp: 5000, sjp: 50600 } });
    assert.deepEqual(errors, []);
    console.log("PASS: shared すごろくビンゴ: untrusted card data checked, reach numbers, a failed write charges nothing, a player's part collected once, a line shared and logged, records, 早送り kept, script taps ignored, a jackpot win takes the pot and starts it again");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
