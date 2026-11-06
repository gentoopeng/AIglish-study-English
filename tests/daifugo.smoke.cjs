// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/daifugo.smoke.cjs
// 大富豪: a practice game against the computer, and a table of three players (the dealer's device
// holds every hand, each player reads only their own sealed cards), played through the screen to
// the end; the loser pays the winner once, and what is short comes from a casino loan.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const docs = new Map(),
      versions = new Map(),
      listeners = new Map(),
      errors = [];
    const players = ["df-a", "df-b", "df-c"];
    for (const id of players) {
      docs.set("users/" + id, { playerName: id, studyPoints: id === "df-c" ? 30 : 500 });
      docs.set("users/" + id + "/learningPoints/main", { balance: id === "df-c" ? 30 : 500, revision: 1, history: {} });
    }
    async function notify(path) {
      for (const { page, key } of listeners.values())
        if (key === path)
          await page.evaluate(({ path, value }) => window.__pkListeners[path]?.({ exists: () => !!value, data: () => structuredClone(value) }), { path, value: docs.get(path) || null }).catch(() => {});
    }
    async function pageFor(id) {
      const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
      page.on("pageerror", (error) => errors.push(id + ": " + error.message));
      await page.route("https://**/*", (r) => r.abort());
      await page.addInitScript(() => {
        localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
        localStorage.setItem("b3_tutorial_done", "1");
      });
      await page.exposeFunction("__pkRead", (path) => ({ value: docs.get(path) || null, version: versions.get(path) || 0 }));
      await page.exposeFunction("__pkCommit", async ({ reads, writes }) => {
        for (const [path, version] of Object.entries(reads)) if ((versions.get(path) || 0) !== version) return false;
        for (const w of writes) {
          docs.set(w.path, w.merge ? { ...docs.get(w.path), ...w.value } : w.value);
          versions.set(w.path, (versions.get(w.path) || 0) + 1);
        }
        for (const w of writes) await notify(w.path);
        return true;
      });
      await page.exposeFunction("__pkSubscribe", async (path) => {
        listeners.set(id, { page, key: path });
        return docs.get(path) || null;
      });
      await page.exposeFunction("__pkUnsubscribe", () => listeners.delete(id));
      await page.goto("http://127.0.0.1:8000");
      await page.getByRole("button", { name: "ゲストで試す" }).click();
      await page.waitForFunction(() => window.__learningBootReady === true);
      await page.evaluate((id) => {
        myId = id;
        myName = id;
        window.db = {};
        const pathOf = (ref) => (typeof ref === "string" ? ref : ref.path);
        window.fbDoc = (_, ...parts) => ({ path: parts.join("/") });
        window.fbServerTimestamp = () => Date.now();
        window.fbGetDoc = async (ref) => {
          const { value } = await __pkRead(pathOf(ref));
          return { exists: () => !!value, data: () => structuredClone(value) };
        };
        window.fbRunTransaction = async (_, fn) => {
          for (let attempt = 0; attempt < 20; attempt++) {
            const reads = {},
              writes = [];
            const result = await fn({
              get: async (ref) => {
                const path = pathOf(ref),
                  { value, version } = await __pkRead(path);
                reads[path] = version;
                return { exists: () => !!value, data: () => structuredClone(value) };
              },
              set: (ref, value, options) => {
                // Like Firestore: no list directly inside a list, and no undefined values.
                (function check(v, inList) {
                  if (v === undefined) throw Error("Unsupported field value: undefined");
                  if (Array.isArray(v)) {
                    if (inList) throw Error("Nested arrays are not supported");
                    v.forEach((x) => check(x, true));
                  } else if (v && typeof v === "object") Object.values(v).forEach((x) => check(x, false));
                })(value, false);
                writes.push({ path: pathOf(ref), value: JSON.parse(JSON.stringify(value)), merge: options?.merge === true });
              },
            });
            if (await __pkCommit({ reads, writes })) return result;
          }
          throw Error("transaction conflict");
        };
        window.fbSetDoc = (ref, value, options) => __pkCommit({ reads: {}, writes: [{ path: pathOf(ref), value, merge: options?.merge === true }] });
        window.__pkListeners = {};
        window.fbOnSnapshot = (ref, callback) => {
          const path = pathOf(ref);
          __pkListeners[path] = callback;
          __pkSubscribe(path).then((value) => callback({ exists: () => !!value, data: () => value }));
          return () => {
            delete __pkListeners[path];
            __pkUnsubscribe();
          };
        };
        localStorage.setItem("core_v4_study_points_" + id, JSON.stringify({ balance: id === "df-c" ? 30 : 500, revision: 1, publishedRevision: 1 }));
      }, id);
      return page;
    }
    // One move for this page if it is its turn: the suggestion if there is one, else pass.
    async function move(page) {
      const screen = page.locator("dialog.df-screen[open]");
      try {
        const t = { timeout: 2500 };
        // The exchange: the upper players choose what to give.
        const give = await page.evaluate(() => {
          const v = window.DaifugoTable.view();
          const g = v?.room?.g;
          return g && g.phase === "exchange" && g.ex.waiting.includes(v.me) ? g.ex.pairs.find((p) => p.high === v.me).count : 0;
        });
        if (give) {
          const cards = screen.locator(".df-hand .df-card");
          for (let i = 0; i < give; i++) await cards.nth(i).click(t);
          await screen.getByRole("button", { name: /渡す/ }).click(t);
          return true;
        }
        const ready = await page.evaluate(() => {
          const v = window.DaifugoTable.view();
          const g = v?.room?.g;
          return !!g && g.phase === "play" && g.turn === v.me && !g.legal.includes(v.me) && !g.illegal.includes(v.me);
        });
        if (!ready) return false;
        await screen.getByRole("button", { name: "おすすめ" }).click(t);
        const play = screen.locator(".df-actions .df-primary");
        if (await play.isEnabled(t)) await play.click(t);
        else {
          const pass = screen.getByRole("button", { name: "パス" });
          if (await pass.isEnabled(t)) await pass.click(t);
          else {
            // The first player cannot pass: pick the first playable card.
            await screen.locator(".df-hand .df-card:not(.is-dim)").first().click(t);
            await play.click(t);
          }
        }
        return true;
      } catch {
        return false;
      }
    }

    // ---- Practice against the computer -----------------------------------------------
    const a = await pageFor("df-a"),
      b = await pageFor("df-b"),
      c = await pageFor("df-c");
    await a.locator("#nav-casino").click();
    await a.locator(".casino-game", { hasText: "大富豪" }).click();
    const screenA = a.locator("dialog.df-screen[open]");
    await screenA.waitFor();
    assert.match(await screenA.innerText(), /ひとりで練習/);
    await screenA.getByRole("button", { name: "練習をはじめる" }).click();
    await screenA.locator(".df-hand .df-card").first().waitFor();
    assert.equal(await screenA.locator(".df-hand .df-card").count(), 13);
    assert.equal(await screenA.locator(".df-seat").count(), 3, "three computer players in a four-player game");
    for (let step = 0; step < 400; step++) {
      if (await screenA.locator(".df-end").count()) break;
      if (!(await move(a))) await a.waitForTimeout(120);
    }
    await screenA.locator(".df-end").waitFor({ timeout: 60000 });
    assert.match(await screenA.innerText(), /練習なので、ポイントは動きません/);
    assert.equal(docs.get("users/df-a/learningPoints/main").balance, 500, "a practice game moves no points");
    await screenA.getByRole("button", { name: "閉じる", exact: true }).click();
    await screenA.waitFor({ state: "detached" });

    // ---- A table of three ---------------------------------------------------------------
    await a.evaluate(() => window.Daifugo.open());
    await screenA.locator("[type=number]").fill("100");
    await screenA.getByRole("button", { name: "最大人数 3人" }).click();
    await screenA.getByRole("button", { name: "テーブルを作る" }).click();
    await screenA.locator(".df-code").waitFor();
    const code = (await screenA.locator(".df-code").innerText()).trim();
    assert.match(code, /^\d{4}$/);
    assert.equal(docs.get("pokerRooms/" + code).kind, "daifugo");
    for (const [page] of [[b], [c]]) {
      await page.evaluate(() => window.Daifugo.open());
      await page.locator("dialog.df-screen[open] .df-join input").fill(code);
      await page.locator("dialog.df-screen[open] .df-waiting").waitFor();
    }
    await screenA.getByRole("button", { name: /3人で始める/ }).click();
    const tables = [a, b, c];
    for (const page of tables) await page.locator("dialog.df-screen[open] .df-hand .df-card").first().waitFor({ timeout: 15000 });
    // Each player holds 13 cards; no hand is written in the open (only sealed boxes).
    for (const page of tables) assert.equal(await page.locator("dialog.df-screen[open] .df-hand .df-card").count(), 13);
    const roomDoc = () => docs.get("pokerRooms/" + code);
    const text = JSON.stringify(roomDoc().g);
    assert.ok(!/"hands"/.test(text));
    assert.deepEqual(Object.keys(roomDoc().enc).sort(), ["df-b", "df-c"], "the dealer's own hand is never written");
    // Play to the end through the screens.
    for (let step = 0; step < 600 && roomDoc().status !== "finished"; step++) {
      let moved = false;
      for (const page of tables) moved = (await move(page).catch(() => false)) || moved;
      if (!moved) await a.waitForTimeout(150);
    }
    assert.equal(roomDoc().status, "finished");
    const pay = await a.evaluate(() => window.DaifugoTable.payments(window.DaifugoTable.view().room).pays);
    assert.equal(pay.length, 1, "three players: the last pays the first");
    assert.equal(pay[0].amount, 100);
    for (const page of tables) await page.locator("dialog.df-screen[open] .df-end").waitFor({ timeout: 20000 });
    // The loser has paid, once, and the winner has it (the 30-point player borrows the rest).
    const payer = pay[0].from,
      payee = pay[0].to;
    await b.evaluate(() => window.PointLoans.collect());
    await a.evaluate(() => window.PointLoans.collect());
    await c.evaluate(() => window.PointLoans.collect());
    const start = { "df-a": 500, "df-b": 500, "df-c": 30 };
    const bal = (id) => docs.get("users/" + id + "/learningPoints/main").balance;
    await a.waitForTimeout(500);
    assert.equal(bal(payer), Math.max(0, start[payer] - 100));
    assert.equal(bal(payee), start[payee] + 100);
    const total = players.reduce((sum, id) => sum + bal(id), 0);
    assert.ok(total === 1030 || (payer === "df-c" && total === 1030 + 70), "points are only moved (or borrowed from the casino)");
    const pairKey = ["df-a", "df-b", "df-c"].filter((id) => id === payer || id === payee).sort().join("__");
    assert.equal(docs.get("pointLoans/" + pairKey).entries.filter((e) => e.kind === "give").length, 1);
    // Paying twice is not possible.
    const again = await (payer === "df-a" ? a : payer === "df-b" ? b : c).evaluate((p) => window.PointLoans.pay(p.to, "x", p.amount, "again", p.id), pay[0]);
    assert.equal(again.again, true);
    // A document rewritten after the game cannot make anyone pay more or twice: the stake is the one
    // agreed on the device, the ids are made there, and a table is paid once.
    const doc = roomDoc();
    docs.set("pokerRooms/" + code, { ...doc, settings: { ...doc.settings, stake: 100000 }, final: { ...doc.final, order: [...doc.final.order].reverse(), pay: [{ from: payer, to: payee, amount: 99999, id: "forged" }] } });
    versions.set("pokerRooms/" + code, 99);
    await notify("pokerRooms/" + code);
    await a.waitForTimeout(2500);
    for (const id of players) assert.equal(bal(id), id === payer ? Math.max(0, start[id] - 100) : id === payee ? start[id] + 100 : start[id], "nobody paid again: " + id);
    // ---- A set of four games: the exchange between games, points added up, one payment at the end
    for (const page of tables) await page.locator("dialog.df-screen[open] .df-end .df-ghost").click();
    for (const page of tables) await page.evaluate(() => (window.__dfBetween = 300));
    const before = Object.fromEntries(players.map((id) => [id, bal(id)]));
    await a.evaluate(() => window.Daifugo.open());
    await screenA.locator("[type=number]").fill("40");
    await screenA.getByRole("button", { name: "最大人数 3人" }).click();
    await screenA.getByRole("button", { name: "4ゲーム（1セット）" }).click();
    await screenA.getByRole("button", { name: "テーブルを作る" }).click();
    await screenA.locator(".df-code").waitFor();
    const code2 = (await screenA.locator(".df-code").innerText()).trim();
    assert.notEqual(code2, code);
    for (const page of [b, c]) {
      await page.evaluate(() => window.Daifugo.open());
      await page.locator("dialog.df-screen[open] .df-join input").fill(code2);
      await page.locator("dialog.df-screen[open] .df-waiting").waitFor();
    }
    await screenA.getByRole("button", { name: /3人で始める/ }).click();
    const roomTwo = () => docs.get("pokerRooms/" + code2);
    const sawExchange = { yes: false };
    for (let step = 0; step < 4000 && roomTwo().status !== "finished"; step++) {
      let moved = false;
      for (const page of tables) moved = (await move(page).catch(() => false)) || moved;
      if (roomTwo().g?.phase === "exchange") sawExchange.yes = true;
      if (!moved) await a.waitForTimeout(120);
    }
    assert.equal(roomTwo().status, "finished");
    assert.equal(roomTwo().games.length, 4);
    assert.ok(sawExchange.yes, "the cards were exchanged between games");
    assert.equal(roomTwo().final.order.length, 3);
    assert.equal(Object.values(roomTwo().totals).reduce((x, y) => x + y, 0), 4 * (4 + 2 + 0) + 2, "4 + 2 + 0 points a game, 2 more for the best of the last");
    await a.waitForTimeout(2500);
    for (const page of tables) await page.evaluate(() => window.PointLoans.collect());
    await a.waitForTimeout(500);
    const [first, , last] = roomTwo().final.order;
    assert.equal(bal(last), Math.max(0, before[last] - 40));
    assert.equal(bal(first), before[first] + 40);
    assert.deepEqual(errors, []);
    console.log("PASS: 大富豪 practice against the computer (13 cards, no points moved), a table of three (sealed hands, the dealer's turn timer, a full game through the screens), the last pays the first once with the rest borrowed from the casino");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
