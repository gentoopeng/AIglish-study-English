// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/casino-carryover.smoke.cjs
// What is left of a day's betting allowance (100pt for each minute studied that day) carries into
// the next day and ends there: the day before spent what had carried in first, and the day before
// that no longer counts.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 740 } }),
      errors = [];
    page.setDefaultTimeout(10000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
    });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true && window.Casino);
    await page.evaluate(() => {
      myId = "co-a";
      localStorage.setItem("core_v4_study_points_co-a", JSON.stringify({ balance: 5000, revision: 1, publishedRevision: 1 }));
      window.db = {};
      window.fbDoc = (_, ...parts) => parts.join("/");
      window.fbRunTransaction = async () => null;
    });
    const day = (offset) => page.evaluate((o) => window.StudyTimeModel.dateKey(Date.now() + o * 86400e3), offset);
    const studied = async (offset, minutes) => {
      const date = await day(offset);
      await page.evaluate(
        ([d, m]) => window.StudyTime.mergeCloud({ version: 1, epoch: "study-reset-2.62", days: { [d]: { sources: { "test-study": m * 60000 } } }, offset: 0, updatedAt: Date.now() }),
        [date, minutes],
      );
    };
    const staked = async (record) => page.evaluate((r) => localStorage.setItem("aiglish_casino_staked_co-a", JSON.stringify(r)), record);
    const show = () => page.evaluate(() => (window.switchTab("vocab"), window.switchTab("casino")));
    const allowance = () => page.evaluate(() => window.Casino.allowance());
    const text = async () => {
      await show();
      return page.locator("[data-casino-allow]").innerText();
    };

    // The day before yesterday studied 10 minutes, yesterday none, today 3: nothing carried into
    // today (what carried into yesterday ended with it).
    await studied(-2, 10);
    await studied(0, 3);
    assert.equal(await allowance(), 300);
    assert.equal(await text(), "今日あと 300pt 賭けられます（今日の勉強 3分）");
    // Yesterday 10 minutes and nothing bet: 1,000pt carry in.
    await studied(-1, 10);
    assert.equal(await allowance(), 1300);
    assert.equal(await text(), "今日あと 1,300pt 賭けられます（今日の勉強 3分・昨日の使い残し 1,000pt を含む）");
    // Yesterday 400 bet: it came out of what carried into yesterday first, so its own 1,000 stays.
    await staked({ days: { [await day(-1)]: 400 } });
    assert.equal(await allowance(), 1300);
    // Yesterday 1,500 bet: 1,000 from the day before, then 500 of its own: 500 carry.
    await staked({ days: { [await day(-1)]: 1500 } });
    assert.equal(await allowance(), 800);
    // Today the carried part is used first: 100 bet leaves 400 of it, 700 bet uses it up.
    await staked({ days: { [await day(-1)]: 1500, [await day(0)]: 100 } });
    assert.equal(await allowance(), 700);
    assert.equal(await text(), "今日あと 700pt 賭けられます（今日の勉強 3分・昨日の使い残し 400pt を含む）");
    await staked({ days: { [await day(-1)]: 1500, [await day(0)]: 700 } });
    assert.equal(await allowance(), 100);
    assert.equal(await text(), "今日あと 100pt 賭けられます（今日の勉強 3分）");
    // Over what there is, nothing can be bet, and the hint says what carries.
    await staked({ days: { [await day(-1)]: 1500, [await day(0)]: 5000 } });
    assert.equal(await allowance(), 0);
    assert.match(await page.evaluate(() => window.Casino.studyHint(100)), /昨日の使い残しは今日の終わりまで使えます/);
    // The older form of the record (one day, { day, amount }) still reads.
    await staked({ day: await day(0), amount: 50 });
    assert.equal(await allowance(), 1250);
    // Bets are counted by day and only the last four days are kept.
    await staked({ days: { "2020-01-01": 5, "2020-01-02": 5, "2020-01-03": 5, "2020-01-04": 5 } });
    await page.evaluate(() => window.Casino.addStaked(70));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("aiglish_casino_staked_co-a")));
    assert.deepEqual(Object.keys(saved.days).sort(), ["2020-01-02", "2020-01-03", "2020-01-04", await day(0)].sort());
    assert.equal(saved.days[await day(0)], 70);
    // Practice chips have no allowance to carry.
    assert.deepEqual(errors, []);
    console.log("PASS: the unused part of a day's betting allowance carries into the next day and ends there (carried part used first, the day before that ended, old record form, four days kept)");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
