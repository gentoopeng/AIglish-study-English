// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/poker.smoke.cjs
// Poker: two players at a 4-digit table; dealt cards only the player can read; betting, the dealer
// turning the board, a fold win and a showdown; points move once per hand; leaving closes it.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const docs = new Map(),
      versions = new Map(),
      listeners = new Map(),
      errors = [];
    for (const id of ["poker-a", "poker-b"]) {
      docs.set("users/" + id, { playerName: id, studyPoints: 500 });
      docs.set("users/" + id + "/learningPoints/main", { balance: 500, revision: 1, history: {} });
    }
    async function notify(path) {
      for (const { page, key } of listeners.values())
        if (key === path)
          await page.evaluate(({ path, value }) => window.__pkListeners[path]?.({ exists: () => !!value, data: () => structuredClone(value) }), { path, value: docs.get(path) || null });
    }
    async function pageFor(id) {
      const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
      page.on("pageerror", (error) => errors.push(id + ": " + error.message));
      await page.route("https://**/*", (r) => r.abort());
      await page.addInitScript(() => {
        localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
        localStorage.setItem("b3_tutorial_done", "1");
        localStorage.setItem("aiglish_poker_tutorial_seen", "1");
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
        localStorage.setItem("core_v4_study_points_" + id, JSON.stringify({ balance: 500, revision: 1, publishedRevision: 1 }));
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
              set: (ref, value, options) => writes.push({ path: pathOf(ref), value: JSON.parse(JSON.stringify(value)), merge: options?.merge === true }),
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
      }, id);
      return page;
    }
    const a = await pageFor("poker-a"),
      b = await pageFor("poker-b");
    const room = () => [...docs.entries()].find(([path]) => path.startsWith("pokerRooms/"))?.[1];
    const wallet = (id) => docs.get("users/" + id + "/learningPoints/main").balance;

    // The battle tab offers poker where ガチ was.
    await a.locator("#nav-casino").click();
    await a.locator(".casino-game.mode-poker", { hasText: "ポーカー" }).click();
    const screenA = a.locator("dialog.poker-screen[open]");
    await screenA.waitFor();
    assert.match(await screenA.locator(".pk-balance").innerText(), /500pt/);
    await screenA.locator('[data-pk-tab="tables"]').click();
    await screenA.locator("[data-pk-buyin]").fill("100");
    await screenA.getByRole("button", { name: "テーブルを作る" }).last().click();
    await screenA.locator("[data-pk-room]").waitFor();
    const code = await screenA.locator("[data-pk-room]").innerText();
    assert.match(code, /^\d{4}$/);
    // The second player joins with the number.
    await b.evaluate(() => window.Poker.open());
    const screenB = b.locator("dialog.poker-screen[open]");
    await screenB.locator('[data-pk-tab="tables"]').click();
    await screenB.locator("[data-pk-code]").fill(code);
    await screenB.getByRole("button", { name: "参加" }).click();
    await screenB.locator(".pk-seat", { hasText: "poker-a" }).waitFor();
    await screenA.locator(".pk-seat", { hasText: "poker-b" }).waitFor();
    await screenA.getByRole("button", { name: "ゲームを始める" }).click();

    // Hand 1: each sees two cards of their own and two backs for the other.
    await screenA.locator(".pk-hole .pk-card:not(.is-back)").nth(1).waitFor();
    await screenB.locator(".pk-hole .pk-card:not(.is-back)").nth(1).waitFor();
    assert.equal(await screenB.locator(".pk-seat:not(.is-me) .pk-card.is-back").count(), 2);
    // The cards are sealed in the table: only the dealer keeps the plain deal, on its device.
    assert.equal(await b.evaluate((code) => localStorage.getItem("aiglish_poker_deal_poker-b_" + code), code), null);
    const dealt = JSON.parse(await a.evaluate((code) => localStorage.getItem("aiglish_poker_deal_poker-a_" + code), code));
    assert.equal(JSON.stringify(room().hand).includes(JSON.stringify(dealt.holes["poker-b"])), false);
    assert.deepEqual(await b.evaluate(() => [...document.querySelectorAll(".pk-hole .pk-card")].map((c) => c.getAttribute("aria-label"))), dealt.holes["poker-b"].map((c) => c[0].replace("T", "10") + { s: "♠", h: "♥", d: "♦", c: "♣" }[c[1]]));
    // Heads-up: the dealer (poker-a) is the small blind and acts first.
    await screenA.getByRole("button", { name: /^同じだけ出す 1$/ }).click();
    await screenB.getByRole("button", { name: "様子見" }).click();
    // The dealer turns the flop; poker-b bets the minimum and poker-a folds.
    await screenB.locator(".pk-board .pk-card:not(.is-slot)").nth(2).waitFor({ timeout: 10000 });
    await screenB.getByRole("button", { name: "賭ける" }).click();
    await screenB.getByRole("button", { name: /^\d+ 出す$/ }).click();
    await screenA.getByRole("button", { name: "降りる" }).click();
    await a.waitForFunction(() => window.Poker._session()?.room?.hand?.street === "done");
    await a.waitForFunction(() => window.StudyPoints.balance() === 498, null, { timeout: 10000 });
    await b.waitForFunction(() => window.StudyPoints.balance() === 502, null, { timeout: 10000 });
    assert.deepEqual([wallet("poker-a"), wallet("poker-b")], [498, 502]);
    assert.equal(docs.get("users/poker-b").studyPoints, 502);

    // Hand 2 starts by itself, the dealer button moves; both check to a showdown.
    await a.waitForFunction(() => window.Poker._session()?.room?.hand?.no === 2, null, { timeout: 15000 });
    assert.equal(room().hand.dealer, "poker-b");
    await screenB.getByRole("button", { name: /^同じだけ出す 1$/ }).click();
    await screenA.getByRole("button", { name: "様子見" }).click();
    for (const street of [3, 4, 5]) {
      await screenA.locator(".pk-board .pk-card:not(.is-slot)").nth(street - 1).waitFor({ timeout: 10000 });
      await screenA.getByRole("button", { name: "様子見" }).click();
      await screenB.getByRole("button", { name: "様子見" }).click();
    }
    await a.waitForFunction(() => window.Poker._session()?.room?.hand?.street === "done", null, { timeout: 10000 });
    const result = room().hand.result;
    assert.deepEqual(Object.keys(result.shown).sort(), ["poker-a", "poker-b"]);
    await screenB.locator(".pk-seat:not(.is-me) .pk-card:not(.is-back)").nth(1).waitFor();
    const expected = { a: 498 + result.net["poker-a"], b: 502 + result.net["poker-b"] };
    await a.waitForFunction((n) => window.StudyPoints.balance() === n, expected.a, { timeout: 10000 });
    await b.waitForFunction((n) => window.StudyPoints.balance() === n, expected.b, { timeout: 10000 });
    assert.equal(wallet("poker-a") + wallet("poker-b"), 1000);
    // Seeing the result again does not pay twice.
    await a.evaluate(() => window.Poker._session() && window.Poker.settle("x", 0));
    assert.equal(wallet("poker-a"), expected.a);

    // Leaving: the second player stands up; the table closes when its maker leaves.
    await screenB.getByRole("button", { name: "席を立つ" }).click();
    await a.waitForFunction(() => !window.Poker._session()?.room?.players?.["poker-b"], null, { timeout: 10000 });
    await screenA.getByRole("button", { name: "席を立つ" }).click();
    await a.locator("dialog.poker-screen").waitFor({ state: "detached" });
    assert.equal(room().status, "closed");
    assert.deepEqual(errors, []);
    console.log("PASS: poker table by number, sealed hole cards, betting and dealer flow, fold win and showdown paid once into points, button moves, leaving and closing");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
