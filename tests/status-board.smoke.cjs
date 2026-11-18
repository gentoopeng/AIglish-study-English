// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/status-board.smoke.cjs
// ステータス (10.156): the first tab and the screen the app opens on. It shows the player's icon, frame, rank,
// points (with the 14-day line), study time, streak, and word-book mastery, from what is on this device.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => localStorage.setItem("b3_tutorial_done", "1"));
    await page.goto(process.env.APP_URL || "http://127.0.0.1:8000");
    // Drawn at once with what the device has, so the first screen is never blank while the data loads.
    await page.locator("#statusBoard .sb-hero").waitFor({ state: "attached" });
    // Only local data: no cloud reads.
    await page.evaluate(() => {
      window.__cloudReads = 0;
      for (const name of ["fbGetDoc", "fbGetDocs"]) {
        const real = window[name];
        if (typeof real === "function") window[name] = (...a) => (window.__cloudReads++, real(...a));
      }
    });
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    // The first tab, open on start.
    assert.equal(await page.locator("#appMainBottomNavBar .nav-item").first().getAttribute("id"), "nav-status");
    assert.ok(await page.locator("#view-status").evaluate((v) => v.classList.contains("active")));
    await page.locator("#statusBoard .sb-hero").waitFor();
    assert.match(await page.locator("#statusBoard .sb-hero").innerText(), /GUEST PLAYER[\s\S]*RANK[\s\S]*NEXT 木　10分/);
    // With data: two hours today, a streak of three days, points with a trend, three books.
    await page.evaluate(() => {
      const key = (t) => {
        const d = new Date(t);
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      };
      const now = Date.now(),
        days = {};
      [120, 30, 45].forEach((min, i) => (days[key(now - i * 864e5)] = { sources: { a: min * 60000 } }));
      days[key(now - 5 * 864e5)] = { sources: { a: 10 * 60000 } };
      // Six hours in all: three of them before these days.
      window.StudyTime.mergeCloud({ version: 1, epoch: window.StudyTimeModel.resetLedger(null).epoch, days, offset: (6 * 60 - 205) * 60000, updatedAt: now });
      window.UserProfile.store({ ...window.UserProfile.read(), frame: "copper" });
      window.StudyPoints.balance = () => 1500;
      window.StudyPoints.earned = () => 4200;
      const trend = {};
      for (let i = 1; i < 10; i++) trend[window.PointTrend.shift(window.PointTrend.day(), -i)] = 1000 + i * 10;
      localStorage.setItem("aiglish_point_trend_" + myId, JSON.stringify(trend));
      textbooksPool.splice(0, textbooksPool.length, { id: "s-a", name: "テスト英単語<img src=x onerror=\"window.__xss=1\">", cover: "📗" }, { id: "s-b", name: "まだの本", cover: "📕" });
      selectedTitle = "<b>称号</b>";
      window.__opened = [];
      window.selectVocabLibraryBook = (id) => window.__opened.push(id);
      const counts = { "s-a": { ok: 30, so: 10, bad: 10, none: 50 }, "s-b": { ok: 0, so: 0, bad: 0, none: 40 } };
      window.getTextbookMasteryStats = (id) => counts[id];
      userStats.vocab_rated_count = 50;
      userStats.flash_count = 321;
      window.StatusBoard.render();
    });
    const d = await page.evaluate(() => window.StatusBoard.collect());
    assert.equal(d.study.today, 120 * 60000);
    assert.equal(d.study.streak, 3);
    assert.equal(d.study.days, 4);
    assert.equal(d.study.best, 120 * 60000);
    assert.deepEqual([d.rank.name, d.rank.next.name], ["銅", "銀"]);
    assert.equal(d.rank.left, (20 - 6) * 3600000);
    assert.deepEqual([d.points.balance, d.points.earned], [1500, 4200]);
    assert.equal(d.points.series.at(-1).value, 1500, "today is the balance read now");
    assert.deepEqual(d.mastery, { ok: 30, so: 10, bad: 10, none: 90, sum: 140 });
    const board = page.locator("#statusBoard");
    await page.waitForFunction(() => document.querySelector("#statusBoard .sb-points-value span")?.textContent === "1,500");
    assert.ok(await board.locator(".sb-hero.sb-rank-copper").count());
    assert.match(await board.locator(".sb-rank-note").innerText(), /NEXT 銀　14時間/);
    assert.equal(await board.locator(".sb-spark").count(), 1, "the points line");
    assert.match(await board.locator(".sb-points-foot").innerText(), /累計 4,200 pt/);
    assert.match(await board.locator(".sb-tone-cyan").innerText(), /2\s*時間/);
    assert.match(await board.locator(".sb-tone-flame").innerText(), /3\s*日/);
    assert.equal(await board.locator(".sb-bar").count(), 14);
    await page.waitForFunction(() => document.querySelector("#statusBoard .sb-donut-center strong span")?.textContent === "21");
    assert.match(await board.locator(".sb-mini").innerText(), /2\s*冊[\s\S]*140[\s\S]*50[\s\S]*321/);
    // Only books with progress are listed (まだの本 has none rated); names and titles are text, never markup.
    assert.equal(await board.locator(".sb-book").count(), 1);
    assert.match(await board.locator(".sb-book").first().innerText(), /テスト英単語<img src=x onerror="window.__xss=1">[\s\S]*30%/);
    assert.match(await board.locator(".sb-chip-title").innerText(), /<b>称号<\/b>/);
    assert.equal(await page.evaluate(() => window.__xss), undefined);
    // A row opens its book in 単語帳.
    await board.locator(".sb-book-head").first().click();
    assert.deepEqual(await page.evaluate(() => window.__opened), ["s-a"]);
    assert.ok(await page.locator("#view-vocab").evaluate((v) => v.classList.contains("active")));
    await page.locator("#nav-status").click();
    // On a phone, nothing sticks out sideways.
    assert.ok(await page.evaluate(() => document.getElementById("statusBoard").scrollWidth <= document.getElementById("statusBoard").clientWidth + 1));
    // Leaving and coming back draws it again; the 単語帳 tab still opens its book list.
    await page.locator("#nav-vocab").click();
    assert.ok(await page.locator("#vocabLibrarySelection").isVisible());
    await page.evaluate(() => (window.StudyPoints.balance = () => 1600));
    await page.locator("#nav-status").click();
    await page.waitForFunction(() => document.querySelector("#statusBoard .sb-points-value span")?.textContent === "1,600");
    // A rating coming in (the warm-up opens over this card) draws it again by itself.
    await page.evaluate(() => {
      window.getTextbookMasteryStats = () => ({ ok: 70, so: 0, bad: 0, none: 30 });
      userStats.vocab_rated_count = 51;
    });
    await page.waitForFunction(() => document.querySelector("#statusBoard .sb-donut-center strong span")?.textContent === "70");
    // iPhone stable rendering: the card is all there at rest, and nothing loops.
    await page.evaluate(() => document.documentElement.classList.add("ios-stable-rendering"));
    await page.locator("#nav-vocab").click();
    await page.locator("#nav-status").click();
    await page.waitForTimeout(1500);
    const rest = await page.evaluate(() => {
      const css = (s) => getComputedStyle(document.querySelector(s));
      return { hero: css("#statusBoard .sb-hero").opacity, card: css("#statusBoard .sb-mastery").opacity, orbit: css("#statusBoard .sb-avatar-orbit").animationName, bar: css("#statusBoard .sb-bar i").transform };
    });
    assert.deepEqual([rest.hero, rest.card, rest.orbit], ["1", "1", "none"]);
    assert.notEqual(rest.bar, "matrix(1, 0, 0, 0, 0, 0)", "bars are grown");
    assert.equal(await page.evaluate(() => window.__cloudReads), 0);
    assert.deepEqual(errors, []);
    console.log("status-board smoke ok");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
