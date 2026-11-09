// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/poker-computer-points.smoke.cjs
// Poker against the computer, signed in: no strength to choose, and the table is always played with
// practice chips: no point is bet, no hand's result reaches the wallet, leaving mid-hand costs nothing,
// and a game can be started with few points.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const base = process.env.APP_URL || "http://127.0.0.1:8000";
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const docs = new Map(),
      versions = new Map(),
      errors = [];
    docs.set("users/pc-a", { playerName: "pc-a", studyPoints: 500 });
    docs.set("users/pc-a/learningPoints/main", { balance: 500, revision: 1, history: {} });
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_poker_tutorial_seen", "1");
      localStorage.setItem("aiglish_poker_lobby_tab", "practice");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.exposeFunction("__pcRead", (path) => ({ value: docs.get(path) || null, version: versions.get(path) || 0 }));
    await page.exposeFunction("__pcCommit", ({ reads, writes }) => {
      for (const [path, version] of Object.entries(reads)) if ((versions.get(path) || 0) !== version) return false;
      for (const w of writes) {
        docs.set(w.path, w.merge ? { ...(docs.get(w.path) || {}), ...w.value } : w.value);
        versions.set(w.path, (versions.get(w.path) || 0) + 1);
      }
      return true;
    });
    await page.goto(base);
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.evaluate(() => {
      myId = "pc-a";
      // Ten hours studied today, so points can be bet (Casino.allowance).
      window.StudyTime?.mergeCloud?.({ version: 1, epoch: "study-reset-2.62", days: { [window.StudyTimeModel.dateKey(Date.now())]: { sources: { "test-study": 600 * 60000 } } }, offset: 0, updatedAt: Date.now() });
      myName = "pc-a";
      localStorage.setItem("core_v4_study_points_pc-a", JSON.stringify({ balance: 500, revision: 1, publishedRevision: 1 }));
      window.StudyPoints.restore({ balance: 500, revision: 1, publishedRevision: 1 });
      window.db = {};
      const pathOf = (ref) => (typeof ref === "string" ? ref : ref.path);
      window.fbDoc = (_, ...parts) => ({ path: parts.join("/") });
      window.fbGetDoc = async (ref) => {
        const { value } = await __pcRead(pathOf(ref));
        return { exists: () => !!value, data: () => structuredClone(value) };
      };
      window.fbRunTransaction = async (_, fn) => {
        for (let attempt = 0; attempt < 20; attempt++) {
          const reads = {},
            writes = [];
          const result = await fn({
            get: async (ref) => {
              const path = pathOf(ref),
                { value, version } = await __pcRead(path);
              reads[path] = version;
              return { exists: () => !!value, data: () => structuredClone(value) };
            },
            set: (ref, value, options) => writes.push({ path: pathOf(ref), value: JSON.parse(JSON.stringify(value)), merge: options?.merge === true }),
          });
          if (await __pcCommit({ reads, writes })) return result;
        }
        throw Error("transaction conflict");
      };
    });
    const wallet = () => docs.get("users/pc-a/learningPoints/main").balance;

    // The lobby: no strength to choose; the starting chips are practice chips, even signed in.
    await page.evaluate(() => window.Poker.open());
    const screen = page.locator("dialog.poker-screen[open]");
    await screen.getByRole("heading", { name: "コンピュータと対戦" }).waitFor();
    assert.equal(await screen.getByText("強さ", { exact: true }).count(), 0);
    assert.equal(await screen.locator("[data-pk-level]").count(), 0);
    assert.match(await screen.locator(".pk-panel .pk-sub").first().innerText(), /練習チップで遊びます（ポイントは賭けません）/);
    assert.equal(await screen.locator("[data-pk-chips] [aria-checked=true]").innerText(), "100枚");
    await screen.getByRole("button", { name: "練習を始める" }).click();
    await screen.locator(".pk-seat", { hasText: "ペンギン" }).waitFor();
    assert.match(await screen.locator("[data-pk-rules]").innerText(), /練習（ポイントは賭けません）/);
    assert.equal(await page.evaluate(() => window.Poker._session().room.players["cpu-0"].bot), "normal");
    assert.equal(await page.evaluate(() => window.Poker._session().room.staked), false);
    assert.equal(await page.evaluate(() => window.StudyPoints.balance()), 500, "the buy-in took no points");

    // Play hands by checking or calling: a hand's result does not touch the points.
    const me = "pc-a";
    let finished = 0;
    for (const end = Date.now() + 120000; Date.now() < end && finished < 2; ) {
      const h = await page.evaluate(() => window.Poker._session()?.room?.hand);
      if (h?.street === "done") finished = Math.max(finished, 1);
      const check = screen.getByRole("button", { name: "様子見" }),
        call = screen.getByRole("button", { name: /^同じだけ出す/ });
      if (await check.count()) await check.click({ timeout: 1000 }).catch(() => {});
      else if (await call.count()) await call.click({ timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(200);
      if (finished) finished++;
    }
    assert.ok(finished >= 1, "a hand finished");
    assert.equal(await page.evaluate(() => window.StudyPoints.balance()), 500);
    assert.equal(wallet(), 500);

    // Leaving in the middle of a hand costs no points either.
    await page.waitForFunction(() => {
      const h = window.Poker._session()?.room?.hand;
      return h && h.street !== "done" && (h.total?.["pc-a"] || 0) > 0;
    }, null, { timeout: 30000 });
    await screen.getByRole("button", { name: "やめる" }).click();
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.StudyPoints.balance()), 500);
    assert.equal(wallet(), 500);
    // With few points a game still starts (it needs none).
    await page.evaluate(() => window.StudyPoints.restore({ balance: 40, revision: 999, publishedRevision: 999 }));
    await page.evaluate(() => window.Poker.open());
    await screen.getByRole("button", { name: "練習を始める" }).click();
    await screen.locator(".pk-seat", { hasText: "ペンギン" }).waitFor();
    assert.deepEqual(errors, []);
    console.log("PASS: no strength choice, the computer table is always practice chips: no points bet, none move, leaving costs nothing, startable with few points");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
