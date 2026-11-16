// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/point-trend.smoke.cjs
// The points dialog's graph tab: one's own balance and three others' by day, the changes per day,
// the period, choosing who to compare (remembered), tapping a day, and an empty record.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const base = process.env.APP_URL || "http://127.0.0.1:8000";
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 740 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
      localStorage.setItem("b3_tutorial_done", "1");
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(base);
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    // The graph's narrow read does not go into the profile cache (it has no pictures); the list's does.
    await page.route("https://firestore.googleapis.com/**", (r) =>
      r.fulfill({ contentType: "application/json", body: JSON.stringify([{ document: { name: "projects/demo/databases/(default)/documents/users/pic", fields: { playerName: { stringValue: "pic" }, studyPoints: { integerValue: "5" } } } }]) }),
    );
    const remembered = await page.evaluate(async () => {
      const keep = window.db;
      window.db = { app: { options: { projectId: "demo" } } };
      const seen = [],
        cache = window.ProfileIdentityCache,
        orig = cache?.remember;
      if (cache) cache.remember = (id) => seen.push(id);
      try {
        const narrow = await window.UserDirectory.recent(0, [], { fields: ["playerName", "studyPoints"] });
        const before = seen.length;
        await window.UserDirectory.recent(0, []);
        return { rows: narrow.length, before, after: seen.length, hasCache: !!cache };
      } finally {
        if (cache) cache.remember = orig;
        window.db = keep;
      }
    });
    assert.equal(remembered.rows, 1);
    assert.equal(remembered.before, 0, "a narrow read leaves the profile cache alone");
    if (remembered.hasCache) assert.equal(remembered.after, 1, "the list's read still fills it");
    await page.evaluate(() => {
      myId = "tr-me";
      myName = "tr-me";
      const T = window.PointTrend,
        today = T.day(),
        ago = (n) => T.shift(today, -n);
      localStorage.setItem("core_v4_study_points_tr-me", JSON.stringify({ balance: 900, revision: 1, publishedRevision: 1 }));
      // Own days on this device and one more from another device (in the cloud).
      localStorage.setItem("aiglish_point_trend_tr-me", JSON.stringify({ [ago(3)]: 500, [ago(1)]: 700 }));
      const row = (id, name, points, trend) => ({ id, data: { playerName: name, studyPoints: points, pointTrend: trend } });
      window.__recentCalls = [];
      window.UserDirectory = {
        recent: async (since, ids, opts) => {
          window.__recentCalls.push(opts?.fields || null);
          return [
            row("tr-me", "tr-me", 900, { [ago(2)]: 600 }),
            row("u1", "あおい", 5000, { [ago(5)]: 4000, [ago(1)]: 4500 }),
            row("u2", "ゆうと", 3000, { [ago(4)]: 3200 }),
            row("u3", "さくら", 2000, {}),
            row("u4", "けん", 100, { [ago(2)]: 300 }),
            { id: "u5", data: { playerName: "消した人", deleted: true, studyPoints: 9999 } },
          ];
        },
      };
      window.PointTrend._reset();
    });
    await page.evaluate(() => window.openStudyPoints());
    const dialog = page.locator("dialog.study-points-dialog");
    await dialog.locator('[data-points-tab="trend"]').click();
    const panel = dialog.locator("[data-points-trend]");
    await panel.locator(".trend-svg").waitFor();
    // Only names, points and the graph are read.
    const fields = await page.evaluate(() => window.__recentCalls[0]);
    assert.ok(fields.includes("pointTrend") && fields.includes("studyPoints") && !fields.includes("userStats"), String(fields));
    // Own line and the three with the most points; the deleted player is not listed.
    assert.deepEqual(await panel.locator(".trend-legend li").allInnerTexts(), ["自分", "あおい", "ゆうと", "さくら"]);
    assert.equal(await panel.locator("[data-trend-pick]").count(), 4);
    assert.equal(await panel.locator("path[data-trend-line]").count(), 4);
    // さくら has only today's balance: a dot, no line.
    assert.equal(await panel.locator('path[data-trend-line="u3"]').getAttribute("d"), (await panel.locator('path[data-trend-line="u3"]').getAttribute("d")).replace(/L/g, ""));
    // The own days merge the device's and the cloud's.
    const own = await page.evaluate(() => JSON.parse(localStorage.getItem("aiglish_point_trend_tr-me")));
    assert.equal(Object.keys(own).length, 3);
    // Tapping the right edge reads today's balances.
    const box = await panel.locator(".trend-svg").boundingBox();
    await page.mouse.click(box.x + box.width - 3, box.y + box.height / 2);
    assert.match(await panel.locator(".trend-pick").innerText(), /自分 900pt　あおい 5,000pt　ゆうと 3,000pt　さくら 2,000pt/);
    // The changes per day: yesterday 700 → today 900 is +200.
    await panel.getByRole("button", { name: "1日の増減" }).click();
    assert.equal(await panel.locator(".trend-svg").getAttribute("aria-label"), "1日の増減のグラフ");
    const box2 = await panel.locator(".trend-svg").boundingBox();
    await page.mouse.click(box2.x + box2.width - 3, box2.y + box2.height / 2);
    assert.match(await panel.locator(".trend-pick").innerText(), /自分 \+200pt　あおい \+500pt　ゆうと −200pt　さくら —/);
    // Another period, and another person to compare: remembered next time.
    await panel.getByRole("button", { name: "7日" }).click();
    await panel.locator(".trend-people summary").click();
    await panel.locator('[data-trend-pick="u2"]').uncheck();
    await panel.locator('[data-trend-pick="u4"]').check();
    assert.deepEqual(await panel.locator(".trend-legend li").allInnerTexts(), ["自分", "あおい", "さくら", "けん"]);
    await page.evaluate(() => window.openStudyPoints());
    await dialog.locator('[data-points-tab="trend"]').click();
    await panel.locator(".trend-svg").waitFor();
    assert.deepEqual(await panel.locator(".trend-legend li").allInnerTexts(), ["自分", "あおい", "さくら", "けん"]);
    assert.equal(await panel.getByRole("button", { name: "7日" }).getAttribute("aria-pressed"), "true");
    assert.equal(await panel.getByRole("button", { name: "1日の増減" }).getAttribute("aria-pressed"), "true");
    // No horizontal scroll at phone width.
    assert.ok(await page.evaluate(() => document.querySelector("dialog.study-points-dialog").scrollWidth <= document.querySelector("dialog.study-points-dialog").clientWidth + 1));
    await page.screenshot({ path: "/tmp/claude-0/point-trend.png" });
    // When the others cannot be read, the own line still shows.
    await page.evaluate(() => {
      window.UserDirectory = { recent: async () => null };
      window.PointTrend._reset();
      window.openStudyPoints();
    });
    await dialog.locator('[data-points-tab="trend"]').click();
    await panel.getByText("ほかの人の記録を読み込めませんでした。").waitFor();
    assert.deepEqual(await panel.locator(".trend-legend li").allInnerTexts(), ["自分"]);
    assert.deepEqual(errors, []);
    console.log("point-trend smoke ok");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
