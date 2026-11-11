// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/live-updates.smoke.cjs
// Changes from other players show as they happen (no waiting for the 5- and 10-minute looks):
//  - the people list follows the players who checked in lately while it is on screen, and stops when it is not;
//  - the player's list of loans / talks (one document) is followed while the app is in front: a change claims
//    what is new with no extra read, and nothing is followed in the background.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
    });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true && window.People && window.PointLoans);
    await page.evaluate(() => {
      window.__live = [];
      window.__stopped = [];
      window.__reads = [];
      window.__txs = 0;
      window.db = {};
      window.fbDoc = (_, ...parts) => parts.join("/");
      window.fbCollection = (_, ...parts) => "col:" + parts.join("/");
      window.fbWhere = (field, op, value) => ({ field, op, value });
      window.fbLimit = (n) => ({ limit: n });
      window.fbQuery = (ref, ...parts) => ({ ref, parts });
      window.fbOnSnapshot = (ref, callback) => {
        const entry = { ref, callback };
        window.__live.push(entry);
        return () => window.__stopped.push(ref);
      };
      window.fbGetDoc = async (ref) => (window.__reads.push(ref), { exists: () => false, data: () => ({}) });
      window.fbGetDocs = async () => ({ forEach() {}, docs: [] });
      window.fbSetDoc = async () => {};
      // The talk with live-a: one line from them, which the player has not seen.
      window.__line = (text) => ({ id: "m-" + text, kind: "message", from: "live-a", to: "live-me", text, at: Date.now() });
      window.__record = { entries: [], names: { "live-a": "エー", "live-me": "ぼく" }, claimed: {}, updatedAt: Date.now() };
      window.fbRunTransaction = async (_, fn) => {
        window.__txs++;
        return fn({
          get: async (ref) => (String(ref) === "pointLoans/live-a__live-me" ? { exists: () => true, data: () => structuredClone(window.__record) } : { exists: () => false, data: () => ({}) }),
          set() {},
        });
      };
      window.__toasts = [];
      window.showToast = (text, kind) => window.__toasts.push([text, kind]);
      myId = "live-me";
    });

    // ---- The player's list (loans and talks) -------------------------------------------------
    await page.waitForFunction(() => window.__live.some((l) => l.ref === "pointLoanInbox/live-me"), null, { timeout: 15000 });
    const reads0 = await page.evaluate(() => window.__reads.length);
    const txs0 = await page.evaluate(() => window.__txs);
    // The other side writes a line: the list changes, what is new is claimed at once from the change itself, and
    // the line is said on screen wherever the player is (a small notice with their name).
    await page.evaluate(() => {
      window.__record.entries = [window.__line("こんにちは")];
      window.__live.find((l) => l.ref === "pointLoanInbox/live-me").callback({ exists: () => true, data: () => ({ pairs: { "live-a__live-me": { at: Date.now() + 5000 } } }) });
    });
    await page.waitForFunction((n) => window.__txs > n, txs0, { timeout: 5000 });
    assert.equal((await page.evaluate(() => window.__reads.length)) - reads0, 0, "the change itself is the read: nothing else is fetched");
    await page.waitForFunction(() => window.__toasts.length > 0, null, { timeout: 5000 });
    assert.deepEqual(await page.evaluate(() => window.__toasts), [["エーさん：こんにちは", "info"]]);
    // The talk that is open on screen shows its lines itself: no notice for it.
    page.evaluate(() => window.PointLoans.person("live-a", "エー")).catch(() => {});
    await page.waitForFunction(() => window.__live.some((l) => l.ref === "pointLoans/live-a__live-me"), null, { timeout: 5000 });
    await page.evaluate(() => window.__live.find((l) => l.ref === "pointLoans/live-a__live-me").callback({ exists: () => true, data: () => structuredClone(window.__record) }));
    await page.waitForSelector("dialog.loans-dialog[open]");
    const toasts0 = await page.evaluate(() => window.__toasts.length);
    const txs1 = await page.evaluate(() => window.__txs);
    await page.evaluate(() => {
      window.__record.entries = [...window.__record.entries, window.__line("もう一つ")];
      window.__live.find((l) => l.ref === "pointLoanInbox/live-me").callback({ exists: () => true, data: () => ({ pairs: { "live-a__live-me": { at: Date.now() + 9000 } } }) });
    });
    await page.waitForFunction((n) => window.__txs > n, txs1, { timeout: 5000 });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__toasts.length), toasts0, "no notice for the talk that is open");
    await page.evaluate(() => window.PointLoans.close());
    // In the background nothing is followed; back in front, it is followed again (once).
    const count = () => page.evaluate(() => window.__live.filter((l) => l.ref === "pointLoanInbox/live-me").length);
    const before = await count();
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    assert.ok((await page.evaluate(() => window.__stopped.includes("pointLoanInbox/live-me"))), "stopped in the background");
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    assert.equal(await count(), before + 1, "followed again in front");

    // ---- The people list ------------------------------------------------------------------------
    assert.equal(await page.evaluate(() => window.People.live.active()), false, "not followed while the list is not on screen");
    await page.evaluate(() => window.switchTab("community"));
    await page.waitForFunction(() => window.People.live.active(), null, { timeout: 5000 });
    const people = await page.evaluate(() => window.__live.find((l) => String(l.ref.ref) === "col:users"));
    assert.ok(people, "the users who checked in lately are followed");
    assert.deepEqual(await page.evaluate(() => window.__live.find((l) => String(l.ref.ref) === "col:users").ref.parts[0].field), "lastActiveAt");
    // Somebody checks in: they appear under オンライン at once, with no list to load again.
    await page.evaluate(() =>
      window.__live.find((l) => String(l.ref.ref) === "col:users").callback({
        docChanges: () => [{ type: "added", doc: { id: "live-b", data: () => ({ playerName: "ライブさん", lastActiveAt: new Date().toISOString() }) } }],
      }),
    );
    await page.locator("#friendListContainer .people-name", { hasText: "ライブさん" }).waitFor({ timeout: 5000 });
    assert.match(await page.locator("#friendListContainer .people-section-heading").first().innerText(), /オンライン（1）/);
    assert.match(await page.locator("#friendListContainer .people-meta .is-online").first().innerText(), /オンライン/);
    // Leaving the list stops it.
    await page.evaluate(() => window.switchTab("vocab"));
    assert.equal(await page.evaluate(() => window.People.live.active()), false);
    assert.ok(await page.evaluate(() => window.__stopped.some((r) => String(r.ref) === "col:users")));
    assert.deepEqual(errors, []);
    console.log("PASS: the people list and the loans list follow other players live while on screen, and stop when not");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
