// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/casino-group.smoke.cjs
// Roulette and blackjack with friends at a 4-digit table: everyone bets their own way against
// the house; the table's maker spins or deals; each settles only their own bet, once; blackjack
// turns go in order with the dealer last; when the maker leaves, open bets come back.
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
    for (const id of ["group-a", "group-b"]) {
      docs.set("users/" + id, { playerName: id, studyPoints: 500 });
      docs.set("users/" + id + "/learningPoints/main", { balance: 500, revision: 1, history: {} });
    }
    async function notify(path) {
      for (const { page, key } of listeners.values())
        if (key === path)
          await page.evaluate(({ path, value }) => window.__gtListeners[path]?.({ exists: () => !!value, data: () => structuredClone(value) }), { path, value: docs.get(path) || null });
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
      await page.exposeFunction("__gtRead", (path) => ({ value: docs.get(path) || null, version: versions.get(path) || 0 }));
      await page.exposeFunction("__gtCommit", async ({ reads, writes }) => {
        for (const [path, version] of Object.entries(reads)) if ((versions.get(path) || 0) !== version) return false;
        for (const w of writes) {
          docs.set(w.path, w.merge ? { ...docs.get(w.path), ...w.value } : w.value);
          versions.set(w.path, (versions.get(w.path) || 0) + 1);
        }
        for (const w of writes) await notify(w.path);
        return true;
      });
      await page.exposeFunction("__gtSubscribe", async (path) => {
        listeners.set(id, { page, key: path });
        return docs.get(path) || null;
      });
      await page.exposeFunction("__gtUnsubscribe", () => listeners.delete(id));
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
                  { value, version } = await __gtRead(path);
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
            if (await __gtCommit({ reads, writes })) return result;
          }
          throw Error("transaction conflict");
        };
        window.__gtListeners = {};
        window.fbOnSnapshot = (ref, callback) => {
          const path = pathOf(ref);
          __gtListeners[path] = callback;
          __gtSubscribe(path).then((value) => callback({ exists: () => !!value, data: () => value }));
          return () => {
            delete __gtListeners[path];
            __gtUnsubscribe();
          };
        };
      }, id);
      await page.locator("#nav-casino").click();
      return page;
    }
    const a = await pageFor("group-a"),
      b = await pageFor("group-b");
    const room = () => [...docs.entries()].filter(([path]) => path.startsWith("pokerRooms/")).map(([, v]) => v).find((r) => r.status !== "closed");
    const wallet = (id) => docs.get("users/" + id + "/learningPoints/main").balance;
    const balanceIs = (page, n) => page.waitForFunction((n) => window.StudyPoints.balance() === n, n);
    const screenOf = (page, game) => page.locator("dialog.casino-screen.is-" + game + "[open]");
    async function open(page, game) {
      await page.locator(".mode-" + game).click();
      await screenOf(page, game).locator("[data-mode=group]").click();
    }

    // ---- Roulette together
    await open(a, "roulette");
    assert.equal(await screenOf(a, "roulette").locator("[data-mode=group]").innerText(), "一緒に");
    // Roulette has nobody to play against, so no タイマン.
    assert.deepEqual(await screenOf(a, "roulette").locator(".cs-mode button").allInnerTexts(), ["ひとりで", "一緒に"]);
    // A refused cloud write is said in plain words under the button, which comes back.
    await a.evaluate(() => {
      window.__tx = window.fbRunTransaction;
      window.fbRunTransaction = async () => {
        throw Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" });
      };
    });
    await screenOf(a, "roulette").locator("[data-group-create]").click();
    await screenOf(a, "roulette").locator(".cs-duel-status", { hasText: "許可されていません" }).waitFor();
    assert.equal(await screenOf(a, "roulette").locator("[data-group-create]").innerText(), "テーブルを作る");
    assert.equal(await screenOf(a, "roulette").locator("[data-group-create]").isDisabled(), false);
    await a.evaluate(() => (window.fbRunTransaction = window.__tx));
    await screenOf(a, "roulette").locator("[data-group-create]").click();
    await screenOf(a, "roulette").locator(".cs-group-code").waitFor();
    const code = room().code;
    await open(b, "roulette");
    await screenOf(b, "roulette").locator("[data-group-code]").fill(code);
    await screenOf(b, "roulette").getByRole("button", { name: "入る", exact: true }).click();
    await screenOf(b, "roulette").locator(".cs-board").waitFor();
    // A puts 10 on red, B 5 on 7; each bet leaves only its owner's wallet.
    await screenOf(a, "roulette").locator('.cs-spot[data-on="red"]').click();
    await screenOf(a, "roulette").getByRole("button", { name: "賭けを確定" }).click();
    await balanceIs(a, 490);
    await screenOf(b, "roulette").locator(".cs-chip-pick button", { hasText: /^5$/ }).click();
    await screenOf(b, "roulette").locator('.cs-spot[data-on="7"]').click();
    await screenOf(b, "roulette").getByRole("button", { name: "賭けを確定" }).click();
    await balanceIs(b, 495);
    await screenOf(a, "roulette").locator(".cs-group-bets", { hasText: "group-b：5pt" }).waitFor();
    // Only the table's maker spins; the wheel stops on 7 for both.
    assert.equal(await screenOf(b, "roulette").locator("[data-group-spin]").count(), 0);
    await a.evaluate(() => {
      const original = crypto.getRandomValues.bind(crypto);
      crypto.getRandomValues = (array) => (array.length === 1 && array instanceof Uint32Array ? ((array[0] = 7), array) : original(array));
    });
    await screenOf(a, "roulette").locator("[data-group-spin]").click();
    await screenOf(a, "roulette").locator(".cs-result").waitFor();
    await screenOf(b, "roulette").locator(".cs-result").waitFor();
    assert.match(await screenOf(a, "roulette").locator(".cs-result").innerText(), /7（赤） 当たり\s*\+10pt/);
    assert.match(await screenOf(b, "roulette").locator(".cs-result").innerText(), /7（赤） 当たり\s*\+175pt/);
    await balanceIs(a, 510);
    await balanceIs(b, 675);
    assert.equal(wallet("group-a"), 510);
    assert.equal(wallet("group-b"), 675);
    // The table stays on one screen.
    assert.ok(await screenOf(b, "roulette").evaluate((d) => d.scrollHeight <= d.clientHeight + 1), "roulette scrolls");
    await a.screenshot({ path: "/tmp/casino-group-roulette.png" });
    await screenOf(a, "roulette").getByRole("button", { name: "次へ" }).click();
    await screenOf(b, "roulette").getByRole("button", { name: "賭けを確定" }).waitFor();
    assert.equal(room().round, 2);
    await screenOf(a, "roulette").getByRole("button", { name: "抜ける" }).click();
    await screenOf(b, "roulette").getByText(/テーブルは終わりました/).waitFor();
    await screenOf(a, "roulette").getByRole("button", { name: "ルーレットを閉じる" }).click();
    await screenOf(b, "roulette").getByRole("button", { name: "ルーレットを閉じる" }).click();

    // ---- Blackjack together
    await open(a, "blackjack");
    await screenOf(a, "blackjack").locator("[data-group-create]").click();
    await screenOf(a, "blackjack").locator(".cs-group-code").waitFor();
    const code2 = room().code;
    await open(b, "blackjack");
    await screenOf(b, "blackjack").locator("[data-group-code]").fill(code2);
    await screenOf(b, "blackjack").getByRole("button", { name: "入る", exact: true }).click();
    await screenOf(b, "blackjack").getByRole("button", { name: "この額で参加" }).waitFor();
    await screenOf(a, "blackjack").getByRole("button", { name: "この額で参加" }).click();
    await screenOf(b, "blackjack").getByRole("button", { name: "この額で参加" }).click();
    await balanceIs(a, 500);
    await balanceIs(b, 665);
    // Dealt round the table: A, B, the dealer's one card, A, B; then B's hit (a 5); the dealer's
    // second card comes after everyone. A 10+9, B 9+7(+5), dealer 10+7.
    await a.evaluate(() => {
      const cards = ["Th", "9d", "Tc", "9h", "7c", "5c", "7s"];
      const deck = window.PokerModel.deck().filter((c) => !cards.includes(c)).concat(cards.slice().reverse());
      window.PokerModel.shuffle = () => deck.slice();
    });
    assert.equal(await screenOf(b, "blackjack").locator("[data-group-deal]").count(), 0);
    await screenOf(a, "blackjack").locator("[data-group-deal]").click();
    await screenOf(a, "blackjack").locator("[data-move=stand]").waitFor();
    await screenOf(b, "blackjack").getByText("group-aさんの番です").waitFor();
    // The dealer shows one card while players are still playing.
    assert.equal(await screenOf(b, "blackjack").locator(".is-dealer .pk-card:not(.is-back)").count(), 1);
    await screenOf(a, "blackjack").locator("[data-move=stand]").click();
    await screenOf(b, "blackjack").locator(".cs-advice", { hasText: "迷ったら「ヒット」" }).waitFor();
    await screenOf(b, "blackjack").locator("[data-move=hit]").click();
    // Everyone is done: the dealer stands on 17 and each sees their own result.
    await screenOf(a, "blackjack").locator(".cs-result").waitFor();
    await screenOf(b, "blackjack").locator(".cs-result").waitFor();
    assert.match(await screenOf(a, "blackjack").locator(".cs-result").innerText(), /あなたの勝ち\s*\+10pt/);
    assert.match(await screenOf(b, "blackjack").locator(".cs-result").innerText(), /あなたの勝ち\s*\+10pt/);
    await balanceIs(a, 520);
    await balanceIs(b, 685);
    assert.equal(wallet("group-a"), 520);
    assert.equal(wallet("group-b"), 685);
    await a.screenshot({ path: "/tmp/casino-group-blackjack.png" });
    // Next game: B bets, then the maker leaves before dealing; B's bet comes back.
    await screenOf(a, "blackjack").getByRole("button", { name: "次のゲーム" }).click();
    await screenOf(b, "blackjack").getByRole("button", { name: "この額で参加" }).click();
    await balanceIs(b, 675);
    await screenOf(a, "blackjack").getByRole("button", { name: "抜ける" }).click();
    await screenOf(b, "blackjack").getByText(/テーブルは終わりました/).waitFor();
    await balanceIs(b, 685);
    assert.equal(wallet("group-b"), 685);
    await screenOf(a, "blackjack").getByRole("button", { name: "ブラックジャックを閉じる" }).click();
    await screenOf(b, "blackjack").getByRole("button", { name: "ブラックジャックを閉じる" }).click();

    // ---- Dice poker together: both play the same dealer
    await open(a, "dice");
    await screenOf(a, "dice").locator("[data-group-create]").click();
    await screenOf(a, "dice").locator(".cs-group-code").waitFor();
    const code3 = room().code;
    assert.equal(room().kind, "dice-together");
    await open(b, "dice");
    await screenOf(b, "dice").locator("[data-group-code]").fill(code3);
    await screenOf(b, "dice").getByRole("button", { name: "入る", exact: true }).click();
    await screenOf(b, "dice").getByRole("button", { name: "この額で参加" }).waitFor();
    await screenOf(a, "dice").getByRole("button", { name: "この額で参加" }).click();
    await screenOf(b, "dice").getByRole("button", { name: "この額で参加" }).click();
    await balanceIs(a, 510);
    await balanceIs(b, 675);
    await screenOf(a, "dice").locator("[data-group-deal]").click();
    await screenOf(a, "dice").getByRole("button", { name: "これで勝負" }).click();
    await screenOf(b, "dice").locator(".cs-group-dice", { hasText: "group-a：決めました" }).waitFor();
    // The maker's phone goes quiet; the last to stand rolls for the dealer instead.
    const away = listeners.get("group-a");
    listeners.delete("group-a");
    await screenOf(b, "dice").getByRole("button", { name: "これで勝負" }).click();
    await screenOf(b, "dice").locator(".cs-result").waitFor();
    assert.ok(room().game.dealer);
    listeners.set("group-a", away);
    await notify("pokerRooms/" + code3);
    // Each settles alone.
    await screenOf(a, "dice").locator(".cs-result").waitFor();
    await screenOf(b, "dice").locator(".cs-result").waitFor();
    const dg = room().game;
    for (const [page, id, start] of [[a, "group-a", 510], [b, "group-b", 675]]) {
      const order = await page.evaluate(([x, y]) => window.CasinoModel.diceVs(x, y), [dg.hands[id], dg.dealer]);
      await balanceIs(page, start + (order > 0 ? 20 : order === 0 ? 10 : 0));
    }
    await a.screenshot({ path: "/tmp/casino-group-dice.png" });
    await screenOf(a, "dice").getByRole("button", { name: "ダイスポーカーを閉じる" }).click();
    await screenOf(b, "dice").getByRole("button", { name: "ダイスポーカーを閉じる" }).click();
    await a.evaluate(() => (crypto.getRandomValues = Object.getPrototypeOf(crypto).getRandomValues.bind(crypto)));

    // ---- Chinchiro together: the computer is the parent for everyone
    const w = { a: await a.evaluate(() => window.StudyPoints.balance()), b: await b.evaluate(() => window.StudyPoints.balance()) };
    await open(a, "chinchiro");
    await screenOf(a, "chinchiro").locator("[data-group-create]").click();
    await screenOf(a, "chinchiro").locator(".cs-group-code").waitFor();
    const code4 = room().code;
    assert.equal(room().kind, "chinchiro");
    await open(b, "chinchiro");
    await screenOf(b, "chinchiro").locator("[data-group-code]").fill(code4);
    await screenOf(b, "chinchiro").getByRole("button", { name: "入る", exact: true }).click();
    await screenOf(b, "chinchiro").getByRole("button", { name: "この額で参加" }).waitFor();
    await screenOf(a, "chinchiro").getByRole("button", { name: "この額で参加" }).click();
    await screenOf(b, "chinchiro").getByRole("button", { name: "この額で参加" }).click();
    await balanceIs(a, w.a - 10);
    await balanceIs(b, w.b - 10);
    await screenOf(a, "chinchiro").locator("[data-group-deal]").click();
    for (const page of [a, b]) {
      const sc = screenOf(page, "chinchiro");
      for (let k = 0; k < 3; k++) {
        const roll = sc.locator("[data-chin-roll]");
        if (!(await roll.count())) break;
        await roll.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(150);
      }
      await sc.locator(".cs-result").waitFor();
    }
    const cg = room().game;
    const expect = (id) => a.evaluate(([parent, hand]) => (window.CasinoModel.chinParentDecides(parent) ?? window.CasinoModel.chinSettle(parent, hand)), [cg.parent.hand, cg.hands[id]?.hand || null]);
    for (const [page, id, start] of [[a, "group-a", w.a], [b, "group-b", w.b]]) {
      const m = await expect(id);
      await balanceIs(page, m >= 0 ? start + m * 10 : start - Math.min(-m, 5) * 10);
    }
    assert.deepEqual(errors, []);
    console.log("PASS: roulette together (own bets, maker spins, each paid once, one screen, next round, closes when the maker leaves), blackjack together (own bets, turns in order, dealer last, each paid once, refund when the maker leaves), dice poker and chinchiro together against one dealer");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
