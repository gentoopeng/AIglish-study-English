// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/casino-duel.smoke.cjs
// Dice poker against a friend: a 4-digit table, both bets taken once, hidden dice until both
// stand, the pot to the better hand (each wallet moved only by its owner), a rematch, and a
// refund when the other player leaves mid-round. Poker refuses the dice table's number.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const base = process.env.APP_URL || "http://127.0.0.1:8000";
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const docs = new Map(),
      versions = new Map(),
      listeners = new Map(),
      errors = [];
    for (const id of ["duel-a", "duel-b"]) {
      docs.set("users/" + id, { playerName: id, studyPoints: 500 });
      docs.set("users/" + id + "/learningPoints/main", { balance: 500, revision: 1, history: {} });
    }
    async function notify(path) {
      for (const { page, key } of listeners.values())
        if (key === path)
          await page.evaluate(({ path, value }) => window.__dlListeners[path]?.({ exists: () => !!value, data: () => structuredClone(value) }), { path, value: docs.get(path) || null });
    }
    async function pageFor(id) {
      const page = await browser.newPage({ viewport: { width: 375, height: 740 } });
      page.on("pageerror", (error) => errors.push(id + ": " + error.message));
      await page.route("https://**/*", (r) => r.abort());
      await page.addInitScript(() => {
        localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
        localStorage.setItem("b3_tutorial_done", "1");
        localStorage.setItem("aiglish_poker_tutorial_seen", "1");
      });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.exposeFunction("__dlRead", (path) => ({ value: docs.get(path) || null, version: versions.get(path) || 0 }));
      await page.exposeFunction("__dlCommit", async ({ reads, writes }) => {
        for (const [path, version] of Object.entries(reads)) if ((versions.get(path) || 0) !== version) return false;
        for (const w of writes) {
          docs.set(w.path, w.merge ? { ...docs.get(w.path), ...w.value } : w.value);
          versions.set(w.path, (versions.get(w.path) || 0) + 1);
        }
        for (const w of writes) await notify(w.path);
        return true;
      });
      await page.exposeFunction("__dlSubscribe", async (path) => {
        listeners.set(id, { page, key: path });
        return docs.get(path) || null;
      });
      await page.exposeFunction("__dlUnsubscribe", () => listeners.delete(id));
      await page.goto(base);
      await page.getByRole("button", { name: "ゲストで試す" }).click();
      await page.waitForFunction(() => window.__learningBootReady === true);
      await page.evaluate((id) => {
        myId = id;
        myName = id;
        localStorage.setItem("core_v4_study_points_" + id, JSON.stringify({ balance: 500, revision: 1, publishedRevision: 1 }));
        window.db = {};
        const pathOf = (ref) => (typeof ref === "string" ? ref : ref.path);
        window.fbDoc = (_, ...parts) => ({ path: parts.join("/") });
        window.fbRunTransaction = async (_, fn) => {
          for (let attempt = 0; attempt < 20; attempt++) {
            const reads = {},
              writes = [];
            const result = await fn({
              get: async (ref) => {
                const path = pathOf(ref),
                  { value, version } = await __dlRead(path);
                reads[path] = version;
                return { exists: () => !!value, data: () => structuredClone(value) };
              },
              set: (ref, value, options) => writes.push({ path: pathOf(ref), value: JSON.parse(JSON.stringify(value)), merge: options?.merge === true }),
            });
            if (await __dlCommit({ reads, writes })) return result;
          }
          throw Error("transaction conflict");
        };
        window.__dlListeners = {};
        window.fbOnSnapshot = (ref, callback) => {
          const path = pathOf(ref);
          __dlListeners[path] = callback;
          __dlSubscribe(path).then((value) => callback({ exists: () => !!value, data: () => value }));
          return () => {
            delete __dlListeners[path];
            __dlUnsubscribe();
          };
        };
      }, id);
      await page.locator("#nav-casino").click();
      await page.locator(".mode-dice").click();
      await page.locator("dialog.casino-screen.is-dice[open]").waitFor();
      await page.locator("[data-mode=duel]").click();
      return page;
    }
    const a = await pageFor("duel-a"),
      b = await pageFor("duel-b");
    const room = () => [...docs.entries()].find(([path]) => path.startsWith("pokerRooms/"))?.[1];
    const wallet = (id) => docs.get("users/" + id + "/learningPoints/main").balance;

    // Everything in the lobby stays inside the phone's width, the bet amount included.
    const edges = await a.locator(".cs-duel-lobby").evaluate((panel) => [panel.getBoundingClientRect().right, Math.max(...[...panel.querySelectorAll("button, input, output")].map((el) => el.getBoundingClientRect().right))]);
    assert.ok(edges[0] <= 375 && edges[1] <= edges[0], JSON.stringify(edges));
    assert.equal(await a.locator("[data-mode=duel]").innerText(), "タイマン");
    assert.deepEqual(await a.locator(".cs-mode button").allInnerTexts(), ["ひとりで", "一緒に", "タイマン"]);
    // A makes a table for 50pt and gets a number to share.
    await a.locator(".cs-duel-lobby").getByRole("button", { name: "+50" }).click();
    await a.locator(".cs-duel-lobby .cs-bet").filter({ hasText: "60pt" }).waitFor();
    await a.getByRole("button", { name: "テーブルを作る" }).click();
    const code = await a.locator(".cs-duel-code").innerText();
    assert.match(code, /^\d{4}$/);
    assert.equal(room().kind, "dice");
    assert.equal(room().bet, 60);
    // B enters the number; both bets are taken once.
    await b.locator("[data-duel-code]").fill(code);
    await b.getByRole("button", { name: "入る", exact: true }).click();
    await a.getByRole("button", { name: "これで勝負" }).waitFor();
    await b.getByRole("button", { name: "これで勝負" }).waitFor();
    await a.waitForFunction(() => window.StudyPoints.balance() === 440);
    await b.waitForFunction(() => window.StudyPoints.balance() === 440);
    assert.equal(wallet("duel-a"), 440);
    assert.equal(wallet("duel-b"), 440);
    // A holds a die and re-rolls, then stands; B still sees no dice from A.
    await a.locator(".cs-die-btn").first().click();
    await a.getByRole("button", { name: /振り直す（あと2回）/ }).click();
    await a.getByRole("button", { name: /あと1回/ }).waitFor();
    await a.getByRole("button", { name: "これで勝負" }).click();
    await a.getByText("相手が決めるのを待っています…").waitFor();
    await b.locator(".cs-duel-thinking", { hasText: "決めました" }).waitFor();
    assert.equal(await b.locator(".is-dealer .cs-die:not(.is-empty)").count(), 0);
    await b.getByRole("button", { name: "これで勝負" }).click();
    // Both see the result and each other's dice; the pot goes to the better hand.
    await a.locator(".cs-result").waitFor();
    await b.locator(".cs-result").waitFor();
    assert.equal(await a.locator(".is-dealer .cs-die:not(.is-empty)").count(), 5);
    const hands = room().hands;
    const order = await a.evaluate(([x, y]) => window.CasinoModel.compare(window.CasinoModel.diceScore(x), window.CasinoModel.diceScore(y)), [hands["duel-a"].dice, hands["duel-b"].dice]);
    const expected = order > 0 ? [560, 440] : order < 0 ? [440, 560] : [500, 500];
    await a.waitForFunction((n) => window.StudyPoints.balance() === n, expected[0]);
    await b.waitForFunction((n) => window.StudyPoints.balance() === n, expected[1]);
    assert.equal(wallet("duel-a"), expected[0]);
    assert.equal(wallet("duel-b"), expected[1]);
    assert.match(await a.locator(".cs-result").innerText(), order > 0 ? /あなたの勝ち\s*\+60pt/ : order < 0 ? /duel-bの勝ち\s*−60pt/ : /引き分け/);
    // Redraws never move points twice.
    await a.evaluate(() => window.dispatchEvent(new Event("study-points-changed")));
    assert.equal(wallet("duel-a"), expected[0]);
    await a.screenshot({ path: "/tmp/casino-duel.png" });

    // A rematch starts once both agree; then B leaves mid-round and A gets the bet back.
    await a.getByRole("button", { name: "もう一勝負" }).click();
    await a.getByRole("button", { name: "相手を待っています…" }).waitFor();
    await b.getByRole("button", { name: "もう一勝負" }).click();
    await a.getByRole("button", { name: "これで勝負" }).waitFor();
    assert.equal(room().round, 2);
    await a.waitForFunction((n) => window.StudyPoints.balance() === n, expected[0] - 60);
    await b.waitForFunction((n) => window.StudyPoints.balance() === n, expected[1] - 60);
    await b.getByRole("button", { name: "抜ける" }).click();
    await a.getByText(/相手がテーブルを抜けました。賭けは戻ります。/).waitFor();
    await a.waitForFunction((n) => window.StudyPoints.balance() === n, expected[0]);
    assert.equal(wallet("duel-a"), expected[0]);
    assert.equal(wallet("duel-b"), expected[1] - 60);
    assert.equal(room().status, "closed");

    // Blackjack one against one: A deals; A 10+9 stands, B 10+6 hits a king and busts.
    await a.locator("dialog.casino-screen").getByRole("button", { name: "ダイスポーカーを閉じる" }).click().catch(() => {});
    await b.locator("dialog.casino-screen").getByRole("button", { name: "ダイスポーカーを閉じる" }).click().catch(() => {});
    const before = { a: wallet("duel-a"), b: wallet("duel-b") };
    for (const page of [a, b]) {
      await page.locator(".mode-blackjack").click();
      await page.locator("dialog.casino-screen.is-blackjack [data-mode=duel]").click();
    }
    await a.evaluate(() => {
      const cards = ["Th", "Tc", "9h", "6c", "Kd"];
      const deck = window.PokerModel.deck().filter((c) => !cards.includes(c)).concat(cards.slice().reverse());
      window.PokerModel.shuffle = () => deck.slice();
    });
    await a.getByRole("button", { name: "テーブルを作る" }).click();
    const bjCode = await a.locator(".cs-duel-code").innerText();
    await b.locator("[data-duel-code]").fill(bjCode);
    await b.getByRole("button", { name: "入る", exact: true }).click();
    await a.getByRole("button", { name: "これで勝負" }).waitFor();
    await b.getByRole("button", { name: "もう1枚" }).waitFor();
    // B sees only A's first card until both are done.
    assert.equal(await b.locator(".is-dealer .pk-card.is-back").count(), 1);
    await a.getByRole("button", { name: "これで勝負" }).click();
    await b.getByRole("button", { name: "もう1枚" }).click();
    await a.locator(".cs-result").waitFor();
    await b.locator(".cs-result").waitFor();
    // The bet is the one used last time (60pt).
    assert.match(await a.locator(".cs-result").innerText(), /あなたの勝ち\s*\+60pt/);
    assert.match(await b.locator(".cs-result").innerText(), /duel-aの勝ち\s*−60pt/);
    await a.waitForFunction((n) => window.StudyPoints.balance() === n, before.a + 60);
    await b.waitForFunction((n) => window.StudyPoints.balance() === n, before.b - 60);
    await a.screenshot({ path: "/tmp/casino-bj-duel.png" });
    await a.getByRole("button", { name: "抜ける" }).click();
    await a.locator("dialog.casino-screen").getByRole("button", { name: "ブラックジャックを閉じる" }).click();
    await b.locator("dialog.casino-screen").getByRole("button", { name: "ブラックジャックを閉じる" }).click();

    // Poker does not open a dice table's number.
    const fresh = await pageFor("duel-a");
    await fresh.getByRole("button", { name: "ダイスポーカーを閉じる" }).click();
    await fresh.evaluate((code) => {
      const room = { kind: "dice", status: "waiting", players: {}, code };
      return window.fbRunTransaction(window.db, async (tx) => tx.set(window.fbDoc(window.db, "pokerRooms", code), room));
    }, code);
    await fresh.locator(".casino-game.mode-poker").click();
    await fresh.locator('[data-pk-tab="tables"]').click();
    await fresh.locator("[data-pk-code]").fill(code);
    await fresh.locator("[data-pk-join]").click();
    await fresh.getByText("この番号はポーカーのテーブルではありません。").waitFor();
    assert.deepEqual(errors, []);
    console.log("PASS: friend dice duel by number, both bets once, hidden dice until both stand, pot to the better hand, no double moves, rematch, refund when the other leaves, poker refuses the dice number");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
