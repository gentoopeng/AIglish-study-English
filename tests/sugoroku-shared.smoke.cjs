// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/sugoroku-shared.smoke.cjs
// すごろくビンゴ signed in, on points and the shared card (a fake cloud): what is read back from the card is
// checked (a bad icon is dropped, a junk log entry too); the numbers a reach waits on are shown;
// a failed write charges nothing and asks to roll again; a player's part of someone else's line
// is collected once; a line is shared by the balls on it and goes in everybody's log; the
// records sheet; no 早送り button; a script's taps do not count; and a jackpot win takes the
// pot in one transaction and starts it again.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const base = process.env.APP_URL || "http://127.0.0.1:8000";
const SAVE = "aiglish_sugoroku_sg-a",
  CARD = "shared/sugoroku_live2";
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
      // Ten hours studied today, so points can be bet (Casino.allowance).
      window.StudyTime?.mergeCloud?.({ version: 1, epoch: "study-reset-2.62", days: { [window.StudyTimeModel.dateKey(Date.now())]: { sources: { "test-study": 600 * 60000 } } }, offset: 0, updatedAt: Date.now() });
      myName = "A";
      const S = window.SugorokuModel,
        card = S.newCard((n) => n - 1);
      card.owners = card.owners.map((o, i) => (i < 6 ? "sg-b" : ""));
      localStorage.setItem("core_v4_study_points_sg-a", JSON.stringify({ balance: 2000, revision: 1, publishedRevision: 1 }));
      const store = {
        "users/sg-a/learningPoints/main": { balance: 2000, revision: 1 },
        "shared/sugoroku_live2": {
          ...card,
          owed: { "sg-a": 120 },
          people: { "sg-b": { n: "B", i: 'x");background:url(https://example.com/x' } },
          log: [{ t: "bingo", id: "sg-b", n: "B", c: 2, at: Date.now() - 60000 }, { t: "junk", id: "x", at: 1 }],
        },
      };
      window.__store = store;
      store["shared/sugoroku_status"] = { open: true }; // (the operator has opened the game)
      localStorage.setItem("aiglish_sugoroku_open", String(Date.now())); // (and this device has been told)
      window.__failCard = false;
      window.db = {};
      window.fbDoc = (_, ...parts) => parts.join("/");
      window.fbSetDoc = async (path, value, options) => (store[path] = options?.merge ? { ...(store[path] || {}), ...structuredClone(value) } : structuredClone(value));
      window.fbGetDoc = async (path) => ({ exists: () => !!store[path], data: () => structuredClone(store[path]) });
      window.fbRunTransaction = async (_, fn) => {
        const writes = [];
        const result = await fn({
          get: async (path) => {
            if (window.__failCard && path === "shared/sugoroku_live2") throw Error("offline");
            if (window.__failWallet && path.endsWith("/learningPoints/main")) throw Error("offline");
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
    const settled = () => page.waitForFunction(() => (document.querySelector('[data-sg-split="close"]')?.click(), !document.querySelector(".cs-body.is-spinning") && !document.querySelector(".sg-go").disabled));
    const rule = (src) => page.evaluate((src) => Function("S", "return " + src)(window.SugorokuModel), src);

    await page.locator("#nav-casino").click();
    const tab = page.locator("#view-casino.active");
    await tab.locator(".casino-game.mode-sugoroku").click();
    const screen = page.locator("dialog.casino-screen.is-sugoroku[open]");
    await screen.locator(".sg-card").first().waitFor();
    // The 120 waiting for A is taken on opening, in one wallet write, and said so.
    await page.evaluate(() => window.Casino.flush());
    await page.waitForFunction(() => window.__store["users/sg-a/learningPoints/main"].balance === 2120);
    assert.match(await screen.locator(".sg-say").innerText(), /分け前　\+120pt/);
    // ... and the お知らせボックス has a notice for it, once.
    const notes = await page.evaluate(() => PersonalNotices.list("sg-a").map((n) => [n.title, n.amount]));
    assert.deepEqual(notes.filter(([title]) => !/リーチ/.test(title)), [["ほかの人のビンゴの分け前 +120pt", 120]]);
    // ... and how many lines are one number from done, as one notice (replaced when it changes).
    assert.equal(notes.filter(([title]) => /^いま \d+ 本リーチ中$/.test(title)).length, 1);
    assert.deepEqual(await page.evaluate(() => window.__store["shared/sugoroku_live2"].owed), {});
    assert.equal((await saved()).shared, 120);
    await page.waitForFunction(() => !document.querySelector(".sg-go").disabled);
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

    // A roll that draws a ball needs the shared card. When the cloud cannot be written, nothing
    // is charged or saved, and the player is asked again.
    const ballAt = await rule("S.RULES.normal[100].findIndex((x) => x.ball)"),
      fiveAt = await rule("S.RULES.wheels.bingo.findIndex((x) => x.x === 12)");
    const start = await chips();
    await page.evaluate(() => (window.__failCard = true));
    await fix([0, ballAt, 99]);
    await screen.locator("[data-sg-roll]").click();
    await page.waitForFunction(() => /通信できませんでした/.test(document.querySelector(".sg-say").textContent));
    assert.equal(await chips(), start);
    assert.equal((await saved())?.rolls || 0, 0);
    assert.equal(await screen.locator("[data-sg-roll]").isDisabled(), false);

    // A roll without a ball leaves the card alone, so it does not wait for the cloud at all (it
    // goes through even now): die 1 onto a normal square, its wheel on ×0, one wallet write.
    const zeroAt = await rule("S.RULES.normal[100].findIndex((x) => x.x === 0 && !x.ball && !x.game && !x.event && !x.kakuhen && !x.item)");
    await fix([0, zeroAt]);
    await screen.locator("[data-sg-roll]").click();
    await settled();
    await page.evaluate(() => (window.__failCard = false));
    assert.equal(await chips(), start - 100);
    await page.evaluate(() => window.Casino.flush());
    await page.waitForFunction(() => window.__store["users/sg-a/learningPoints/main"].balance === 2020);
    // Each written batch is one wallet move.
    assert.deepEqual(Object.keys(await page.evaluate(() => window.__store["users/sg-a/learningPoints/main"].poker)).map((k) => k.replace(/:batch:[^:]+$/, "")), ["casino:sugoroku", "casino:sugoroku"]);
    assert.equal((await saved()).rolls, 1);
    // A batch the cloud refuses stays on this device and is written later, once.
    await fix([0, zeroAt]);
    await screen.locator("[data-sg-roll]").click();
    await settled();
    await page.evaluate(async () => {
      window.__failWallet = true;
      await window.Casino.flush();
      window.__failWallet = false;
    });
    assert.equal(await page.evaluate(() => window.__store["users/sg-a/learningPoints/main"].balance), 2020);
    assert.equal(await chips(), start - 200);
    await page.evaluate(() => window.Casino.flush());
    await page.waitForFunction(() => window.__store["users/sg-a/learningPoints/main"].balance === 1920);
    await page.evaluate(() => window.Casino.flush());
    assert.equal(await page.evaluate(() => window.__store["users/sg-a/learningPoints/main"].balance), 1920);
    assert.equal(await chips(), start - 200);

    // A ball on the row's last number finishes B's row: the prize of 700 is shared by the
    // 7 balls (B's 6 parts, 600, wait on the card for B); of the bingo wheel's × 12 (1,200), 50%
    // is shared the same way (B's 514), and the line goes in the log with A's name.
    const before = await chips();
    await fix([0, ballAt, row[6] - 1, fiveAt]);
    await screen.locator("[data-sg-roll]").click();
    // The pop-up after the bingo: A (the finisher) and B, with the balls and each part.
    const split = screen.locator(".sg-split");
    await split.waitFor({ timeout: 20000 });
    const rows = (await split.locator(".sg-split-row").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
    assert.match(rows[1], /^あなた 1個 100 \d+ [\d,]+/);
    assert.match(rows[2], /個 600 514 1,114/);
    assert.match(await split.innerText(), /ほかの人の分は、その人が次に遊んだときに届きます/);
    await settled();
    assert.equal(await chips(), before - 100 + (700 - 600) + (1200 - 514));
    const shared = await page.evaluate(() => window.__store["shared/sugoroku_live2"]);
    assert.deepEqual(shared.owed, { "sg-b": 600 + 514 });
    assert.deepEqual(Object.keys(shared.owedAt), ["sg-b"]);
    assert.deepEqual(shared.owners.slice(0, 7), ["", "", "", "", "", "", ""]);
    assert.deepEqual(shared.log.map((e) => [e.t, e.id, e.n, e.c]), [["bingo", "sg-b", "B", 2], ["bingo", "sg-a", "A", 1]]);
    assert.equal((await saved()).bingos, 1);
    await screen.getByRole("button", { name: "すごろくビンゴの記録" }).click();
    assert.deepEqual(await sheet.locator(".sg-log li span").allInnerTexts(), ["あなた　BINGO", "Bさん　DOUBLE BINGO"]);
    assert.match(await sheet.locator(".sg-stats").innerText(), /ビンゴ\s*1列/);
    await sheet.getByRole("button", { name: "閉じる" }).click();

    // There is no 早送り button any more.
    assert.equal(await screen.getByRole("button", { name: "早送り" }).count(), 0);
    await screen.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    await tab.locator(".casino-game.mode-sugoroku").click();
    await screen.locator(".sg-card").first().waitFor();

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
    // (The score shows only for a moment before the board goes on, so it is recorded as it appears.)
    await page.evaluate(() => {
      window.__scores = [];
      new MutationObserver(() => {
        const line = document.querySelector(".sg-mini.is-over .sg-game-line");
        if (line && !window.__scores.includes(line.textContent)) window.__scores.push(line.textContent);
      }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    });
    for (let i = 0; i < 3; i++) await pad.click();
    await page.waitForFunction(() => window.__scores.length > 0);
    assert.match(await page.evaluate(() => window.__scores[0]), /^3回　→　30点/);
    await page.waitForFunction(() => !document.querySelector(".sg-layer.is-mini:not([hidden])"));

    // B, opening the casino tab, sees the part waiting on the すごろくビンゴ tile.
    await screen.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    await page.evaluate(() => {
      myId = "sg-b";
      // Ten hours studied today, so points can be bet (Casino.allowance).
      window.StudyTime?.mergeCloud?.({ version: 1, epoch: "study-reset-2.62", days: { [window.StudyTimeModel.dateKey(Date.now())]: { sources: { "test-study": 600 * 60000 } } }, offset: 0, updatedAt: Date.now() });
      window.switchTab("vocab");
      window.switchTab("casino");
    });
    await tab.locator(".mode-sugoroku .casino-waiting").waitFor();
    assert.equal(await tab.locator(".mode-sugoroku .casino-waiting").innerText(), "分け前 1,114pt 届いています");
    await page.evaluate(() => (myId = "sg-a"));

    // Opening again with a slow cloud: the screen comes up at once from what this device kept,
    // without waiting for the cloud's reads.
    await page.evaluate(() => {
      const get = window.fbGetDoc;
      window.__slowGet = get;
      window.fbGetDoc = (path) => new Promise((resolve) => setTimeout(() => resolve(get(path)), 4000));
    });
    const opened = Date.now();
    await tab.locator(".casino-game.mode-sugoroku").click();
    await screen.locator("[data-sg-roll]").waitFor();
    assert.ok(Date.now() - opened < 2000, "opened in " + (Date.now() - opened) + "ms");
    await screen.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    await page.evaluate(() => (window.fbGetDoc = window.__slowGet));

    // Another player's ball that comes in while a roll is being shown is not lost: once the
    // screen is free the card is read again and the ball shows (before, it waited for the next
    // change to the card).
    await page.evaluate((name) => {
      const S = window.SugorokuModel;
      const s = JSON.parse(localStorage.getItem(name));
      let p = 1;
      while (S.kindAt(p + 1) !== "normal") p++;
      Object.assign(s, { pos: p, pending: null, bonus: [] });
      localStorage.setItem(name, JSON.stringify(s));
      window.fbOnSnapshot = (ref, cb) => {
        const snap = () => ({ exists: () => !!window.__store[ref], data: () => structuredClone(window.__store[ref]) });
        (window.__emits ||= {})[ref] = () => cb(snap());
        if (ref === "shared/sugoroku_live2") window.__emit = () => cb(snap());
        setTimeout(() => cb(snap()), 0);
        return () => delete window.__emits[ref];
      };
    }, SAVE);
    await tab.locator(".casino-game.mode-sugoroku").click();
    await settled();
    await fix([0, zeroAt]);
    const cOn = await page.evaluate(() => {
      const card = window.__store["shared/sugoroku_live2"],
        at = card.owners.findIndex((o) => o === "");
      document.querySelector(".sg-go").click();
      card.owners[at] = "sg-c";
      card.people = { ...card.people, "sg-c": { n: "C", i: "" } };
      window.__emit();
      return at;
    });
    await settled();
    await page.waitForFunction((at) => document.querySelectorAll(".sg-cell")[at]?.getAttribute("data-initial") === "C", cOn, { timeout: 5000 });

    // Another player's BINGO on the shared card goes into the お知らせボックス, once.
    await page.evaluate(() => {
      const card = window.__store["shared/sugoroku_live2"];
      card.log = [...(card.log || []), { t: "bingo", id: "sg-c", n: "C", c: 2, at: Date.now() }];
      window.__emit();
      window.__emit();
    });
    await page.waitForFunction(() => PersonalNotices.list("sg-a").some((n) => n.title === "Cさんが DOUBLE BINGO"), null, { timeout: 5000 });
    assert.equal(await page.evaluate(() => PersonalNotices.list("sg-a").filter((n) => n.title === "Cさんが DOUBLE BINGO").length), 1);

    // Who else is playing: opening the screen marked A as playing. Another player who rolled
    // just now shows above the card; one who stopped five minutes ago, and A, do not.
    const mark = await page.evaluate(() => window.__store["shared/sugoroku_here"]?.["sg-a"]);
    assert.ok(mark && Date.now() - mark.at < 60000, JSON.stringify(mark));
    assert.equal(await screen.locator(".sg-here").isVisible(), false);
    await page.evaluate(() => {
      const here = window.__store["shared/sugoroku_here"];
      here["sg-c"] = { n: "C", at: Date.now() };
      here["sg-d"] = { n: "D", at: Date.now() - 300000 };
      window.__emits["shared/sugoroku_here"]();
    });
    await screen.locator(".sg-here").waitFor();
    assert.equal(await screen.locator(".sg-here").innerText(), "いっしょにプレイ中　\nC\nCさん");
    await screen.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    await page.evaluate(() => delete window.fbOnSnapshot);

    // Today's allowance nearly used up (less than one roll left): the button asks for study.
    await page.evaluate(() => {
      const day = window.StudyTimeModel.dateKey(Date.now());
      localStorage.setItem("aiglish_casino_staked_sg-a", JSON.stringify({ day, amount: 600 * 100 - 50 }));
    });
    await tab.locator(".casino-game.mode-sugoroku").click();
    await screen.locator(".sg-card").first().waitFor();
    await page.waitForFunction(() => document.querySelector(".sg-go").textContent === "勉強すると振れます");
    assert.equal(await screen.locator(".sg-go").isDisabled(), true);
    assert.match(await screen.locator(".sg-study").innerText(), /あと1分勉強すると賭けられます/);
    await screen.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    await page.evaluate(() => localStorage.removeItem("aiglish_casino_staked_sg-a"));

    // An accident past the wallet: with 150pt left, a roll onto the accident square whose wheel
    // takes 2× the bet loses 300; the wallet stops at 0 and the other 150 is owed to the casino.
    await page.evaluate((name) => {
      const wallet = window.__store["users/sg-a/learningPoints/main"],
        revision = wallet.revision + 1;
      Object.assign(wallet, { balance: 150, revision });
      window.StudyPoints.restore({ balance: 150, revision, publishedRevision: revision });
      const s = JSON.parse(localStorage.getItem(name));
      s.pos = 6;
      localStorage.setItem(name, JSON.stringify(s));
    }, SAVE);
    await tab.locator(".casino-game.mode-sugoroku").click();
    await screen.locator(".sg-card").first().waitFor();
    const twice = await rule("S.RULES.accident.findIndex((x) => x.take === 2)");
    await fix([0, twice]);
    await screen.locator("[data-sg-roll]").click();
    await page.evaluate(() => window.Casino.flush());
    await page.waitForFunction(() => window.__store["users/sg-a/learningPoints/main"].balance === 0);
    await page.waitForFunction(() => window.__store["pointLoans/CASINO__sg-a"]);
    const debt = await page.evaluate(() => window.__store["pointLoans/CASINO__sg-a"].entries.map((e) => [e.kind, e.from, e.amount, e.status || ""]));
    assert.deepEqual(debt, [["lend", "CASINO", 150, ""], ["ask-repay", "CASINO", 150, "open"]]);
    // The game itself is kept in the cloud too, for carrying on from another device.
    const cloudSave = await page.evaluate(() => JSON.parse(window.__store["users/sg-a/sync/sugoroku"].state));
    assert.ok(cloudSave.rolls >= 1 && cloudSave.pending === null);

    // The game from before the second card (shared/sugoroku_live, 49 cells): opening the screen makes the
    // two-card document from it (the same cards on every device); what was owed on the old one is kept
    // (only the sane parts) and taken by its owner on the first roll with a ball. An old copy of the
    // game keeps writing to the old document and never touches the new one.
    await page.waitForFunction(() => !document.querySelector(".cs-body.is-spinning"));
    await screen.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();
    await page.evaluate((name) => {
      const wallet = window.__store["users/sg-a/learningPoints/main"],
        revision = wallet.revision + 1;
      Object.assign(wallet, { balance: 1000, revision });
      window.StudyPoints.restore({ balance: 1000, revision, publishedRevision: revision });
      const s = JSON.parse(localStorage.getItem(name));
      Object.assign(s, { pos: 1, pending: null, bonus: [] });
      localStorage.setItem(name, JSON.stringify(s));
      const cells = Array.from({ length: 49 }, (_, i) => (i === 24 ? 0 : i + 1));
      // The game from before lives in the old document; the two-card document is made from it.
      window.__store["shared/sugoroku_live"] = { cells, owners: cells.map((n) => (n ? "" : "*")), owed: { "sg-a": 77, "sg-bad": -5 }, owedAt: { "sg-a": Date.now() }, people: {}, log: [], updatedAt: Date.now() };
      delete window.__store["shared/sugoroku_live2"];
      localStorage.removeItem("aiglish_sugoroku_card_live");
    }, SAVE);
    const sharedBefore = (await saved()).shared;
    await tab.locator(".casino-game.mode-sugoroku").click();
    await screen.locator(".sg-card").first().waitFor();
    assert.equal(await screen.locator(".sg-cell").count(), 98);
    const made = await page.evaluate(() => window.__store["shared/sugoroku_live2"]);
    assert.equal(made.v, 2, "the new document exists as soon as the screen is open");
    // (A's 77 was taken on opening, as any part waiting for A is; the bad part (-5) did not come across.)
    assert.deepEqual(made.owed, {}, "only the sane part of what was owed came across, and A took it");
    await page.evaluate(() => (window.__store["shared/sugoroku_live"].cells = window.__store["shared/sugoroku_live"].cells.map(() => 0)));
    await fix([0, ballAt, 5]);
    await screen.locator("[data-sg-roll]").click();
    await settled();
    const renewed = await page.evaluate(() => window.__store["shared/sugoroku_live2"]);
    assert.equal(renewed.v, 2);
    assert.equal(renewed.cells.length, 98);
    assert.ok(Number.isInteger(renewed.special) && !renewed.cells.includes(renewed.special));
    assert.deepEqual(renewed.owed, {});
    assert.equal((await saved()).shared - sharedBefore, 77);
    await screen.getByRole("button", { name: "すごろくビンゴを閉じる" }).click();

    // A jackpot win: the pot is taken with this device's unsent bets in, and starts again from
    // its seed. 1,400,000 bet: the JACKPOT would be 24,000 but stops at 20,000, and the 4,000 past
    // the cap stays for the SUPER JACKPOT. A second JACKPOT right after gets the seed and what
    // came in since; the SUPER JACKPOT then takes its share, the spill and all.
    const wins = await page.evaluate(async () => {
      window.__store["shared/casino_jackpot"] = { bet: 1400000, jpFrom: 0, sjpFrom: 0 };
      localStorage.setItem("aiglish_casino_jackpot_pending", "0");
      const first = await window.CasinoJackpot.win("jp", { id: "sg-a", n: "A" });
      const spill = window.__store["shared/casino_jackpot"].spill;
      // 20,000 bet on this device and not sent yet.
      localStorage.setItem("aiglish_casino_jackpot_pending", "20000");
      const second = await window.CasinoJackpot.win("jp", { id: "sg-c", n: "C" });
      const before = window.CasinoJackpot.amounts();
      const sjp = await window.CasinoJackpot.win("sjp", { id: "sg-a", n: "A" });
      const pot = window.__store["shared/casino_jackpot"];
      return { first, spill, second, before, sjp, bet: pot.bet, from: [pot.jpFrom, pot.sjpFrom, pot.spill], who: pot.wins.map((w) => [w.kind, w.n, w.amount]), now: window.CasinoJackpot.amounts() };
    });
    assert.deepEqual(wins, {
      first: 20000,
      spill: 4000,
      second: 3300,
      before: { jp: 3000, sjp: 12000 + 14200 + 4000 },
      sjp: 30200,
      bet: 1420000,
      from: [1420000, 1420000, 0],
      who: [["jp", "A", 20000], ["jp", "C", 3300], ["sjp", "A", 30200]],
      now: { jp: 3000, sjp: 12000 },
    });
    assert.deepEqual(errors, []);
    console.log("PASS: shared すごろくビンゴ: untrusted card data checked, reach numbers, a failed write charges nothing, a player's part collected once, a line shared and logged, records, 早送り kept, script taps ignored, a ball that came in during a roll shows after it, who else is playing shown, rolls stop when today's study allowance is used, a jackpot win takes the pot and starts it again");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
