// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/people-friends.smoke.cjs
// Friends (10.162): a profile shows whether the person added you too, and adds or removes them. The list is saved
// (with the user document); friends both ways then see each other's stamps in the store.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => localStorage.setItem("b3_tutorial_done", "1"));
    await page.goto(process.env.APP_URL || "http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true && window.People);
    // A guest sees no friend button.
    await page.evaluate(() => window.People.open("pf-b", { profile: true }));
    await page.locator(".people-detail-person").waitFor();
    assert.equal(await page.locator(".people-friend-box").count(), 0);
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    // Signed in as A; B has already added A.
    await page.evaluate(() => {
      myId = "pf-a";
      myName = "A";
      myFriendList = [];
      window.__saves = 0;
      window.saveUserStats = async () => window.__saves++;
      window.db = {};
      window.fbDoc = (_, ...parts) => parts.join("/");
      window.fbGetDoc = async (path) => ({ exists: () => path === "users/pf-b", data: () => ({ playerName: "ビー", friendList: [{ code: "pf-a" }] }) });
    });
    await page.evaluate(() => window.People.open("pf-b", { profile: true }));
    const box = page.locator(".people-friend-box");
    await page.locator(".people-friend-state", { hasText: "相手はあなたをフレンドに追加しています" }).waitFor();
    await box.getByRole("button", { name: "フレンドに追加" }).click();
    await page.locator(".people-friend-state", { hasText: "お互いにフレンドです" }).waitFor();
    const saved = await page.evaluate(() => ({ list: JSON.parse(localStorage.getItem("core_v4_friend_list")).map((f) => [f.code, f.name]), count: userStats.friends_count, saves: window.__saves }));
    assert.deepEqual(saved.list, [["pf-b", "ビー"]]);
    assert.equal(saved.count, 1);
    assert.ok(saved.saves >= 1, "saved with the user document");
    // Removing asks first, then takes them off.
    await box.getByRole("button", { name: "フレンドを外す" }).click();
    await box.getByRole("button", { name: "フレンドに追加" }).waitFor();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("core_v4_friend_list"))), []);
    // Not shown on your own profile.
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    await page.evaluate(() => window.People.open("pf-a", { profile: true }));
    await page.locator(".people-detail-person").waitFor();
    assert.equal(await page.locator(".people-friend-box").count(), 0);
    assert.deepEqual(errors, []);
    console.log("people-friends smoke ok");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
