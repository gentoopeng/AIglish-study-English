// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/casino-carryover.smoke.cjs
// What is left of a day's betting allowance (1pt for each second, 60pt for each minute studied that day) carries on,
// worth less each day: all of it the next day, then half, a quarter, an eighth, a sixteenth, and
// gone after five days. Bets take the oldest first. Days before 2026-11-04 (before this began) do not
// carry. The clock is fixed, so the days are the same on any day.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const errors = [];
    // A page, on a fixed day (noon in Japan), with a signed-in player and the helpers to set up the
    // study record and the bets.
    async function boot(now) {
      const page = await browser.newPage({ viewport: { width: 375, height: 740 } });
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
      await page.clock.setFixedTime(new Date(now));
      await page.evaluate(() => {
        myId = "co-a";
        localStorage.setItem("core_v4_study_points_co-a", JSON.stringify({ balance: 50000, revision: 1, publishedRevision: 1 }));
        window.db = {};
        window.fbDoc = (_, ...parts) => parts.join("/");
        window.fbRunTransaction = async () => null;
      });
      const day = (offset) => page.evaluate((o) => window.StudyTimeModel.dateKey(Date.now() + o * 86400e3), offset);
      const studied = async (offset, minutes) => {
        const date = await day(offset);
        await page.evaluate(([d, m]) => window.StudyTime.mergeCloud({ version: 1, epoch: "study-reset-2.62", days: { [d]: { sources: { "test-study": m * 60000 } } }, offset: 0, updatedAt: Date.now() }), [date, minutes]);
      };
      const staked = async (bets) => {
        const days = {};
        for (const [offset, amount] of Object.entries(bets)) days[await day(Number(offset))] = amount;
        await page.evaluate((d) => localStorage.setItem("aiglish_casino_staked_co-a", JSON.stringify({ days: d })), days);
      };
      const allowance = () => page.evaluate(() => window.Casino.allowance());
      const text = async () => {
        await page.evaluate(() => (window.switchTab("vocab"), window.switchTab("casino")));
        return page.locator("[data-casino-allow]").innerText();
      };
      return { page, day, studied, staked, allowance, text };
    }

    // The 20th of November. Today 3 minutes (180pt) of its own.
    const t = await boot("2026-11-20T03:00:00Z");
    assert.equal(await t.day(0), "2026-11-20");
    await t.studied(0, 3);
    assert.equal(await t.allowance(), 180);
    assert.equal(await t.text(), "今日あと 180pt 賭けられます（今日の勉強 3分）");
    // Yesterday 10 minutes, nothing bet: all 600pt carry into today.
    await t.studied(-1, 10);
    assert.equal(await t.allowance(), 780);
    assert.equal(await t.text(), "今日あと 780pt 賭けられます（今日の勉強 3分・持ち越し 600pt を含む）");
    // Two days ago 10 minutes: half of it (300) is worth carrying today.
    await t.studied(-2, 10);
    assert.equal(await t.allowance(), 1080);
    // Three days ago 8 minutes: a quarter (120).
    await t.studied(-3, 8);
    assert.equal(await t.allowance(), 1200);
    // Five days ago 16 minutes: a sixteenth (60). Six days ago: gone.
    await t.studied(-5, 16);
    await t.studied(-6, 10);
    assert.equal(await t.allowance(), 1260);
    assert.equal(await t.text(), "今日あと 1,260pt 賭けられます（今日の勉強 3分・持ち越し 1,080pt を含む）");
    // What is bet today uses the carried part first: 500 bet leaves 580 of it.
    await t.staked({ 0: 500 });
    assert.equal(await t.allowance(), 760);
    assert.equal(await t.text(), "今日あと 760pt 賭けられます（今日の勉強 3分・持ち越し 580pt を含む）");
    // Over everything: nothing more, and the hint says how it carries.
    await t.staked({ 0: 99999 });
    assert.equal(await t.allowance(), 0);
    assert.match(await t.page.evaluate(() => window.Casino.studyHint(100)), /次の日に持ち越せて、2日前の分からは半分ずつに減ります/);
    // Yesterday's bets also took the oldest first: 1,200 bet yesterday used up what was worth
    // 37.5 (the 10 minutes of six days ago, five days old then), 120 (five days ago: 16 minutes, four days
    // old then), 240 (three days ago, two days old) and 600 (two days ago, one day old), and 202.5 of
    // yesterday's own 600, so 397.5 of it is left: 397 carry, and today's own 180.
    await t.staked({ "-1": 1200 });
    assert.equal(await t.allowance(), 397 + 180);
    // Older forms of the record (one day, { day, amount }) still read.
    await t.page.evaluate(async () => localStorage.setItem("aiglish_casino_staked_co-a", JSON.stringify({ day: window.StudyTimeModel.dateKey(Date.now()), amount: 50 })));
    assert.equal(await t.allowance(), 1080 + 180 - 50);
    // Bets are kept by day, the last eleven days (the five that count and the five replayed before them).
    const old = {};
    for (let d = 1; d <= 12; d++) old["2020-01-" + String(d).padStart(2, "0")] = 5;
    await t.page.evaluate((days) => localStorage.setItem("aiglish_casino_staked_co-a", JSON.stringify({ days })), old);
    await t.page.evaluate(() => window.Casino.addStaked(70));
    const saved = await t.page.evaluate(() => JSON.parse(localStorage.getItem("aiglish_casino_staked_co-a")));
    assert.deepEqual(Object.keys(saved.days).sort(), [...Object.keys(old).slice(2), "2026-11-20"]);
    assert.equal(saved.days["2026-11-20"], 70);
    await t.page.close();

    // A run of days that each studied 1 minute and bet 60 (the oldest first): what was worth most
    // is kept, so 60 carries from yesterday and from the days before in halves.
    const run = await boot("2026-11-20T03:00:00Z");
    for (const offset of [-5, -4, -3, -2, -1, 0]) await run.studied(offset, 1);
    await run.staked({ "-5": 60, "-4": 60, "-3": 60, "-2": 60, "-1": 60 });
    // Each day spent its own 60 (nothing older was left): the last of them leaves nothing.
    assert.equal(await run.allowance(), 60);
    await run.staked({});
    // Nothing bet: today's own 60, and the carry: 60 (yesterday) + 30 + 15 + 7.5 + 3.75 = 116.25, whole: 116.
    assert.equal(await run.allowance(), 60 + 116);
    await run.page.close();

    // A bet five days ago is paid first from the allowance of six days ago (it was still worth
    // something then), so five days ago's own allowance is whole: 6,000 / 16 = 375 carry (not 187).
    const early = await boot("2026-11-20T03:00:00Z");
    await early.studied(-6, 100);
    await early.studied(-5, 100);
    await early.staked({ "-5": 5000 });
    assert.equal(await early.allowance(), 375);
    await early.page.close();

    // Counted by the second: 1pt for each (90 seconds of study = 90pt, shown as 1 minute); a second less than a minute counts too.
    const secs = await boot("2026-11-20T03:00:00Z");
    await secs.page.evaluate(() => window.StudyTime.mergeCloud({ version: 1, epoch: "study-reset-2.62", days: { [window.StudyTimeModel.dateKey(Date.now())]: { sources: { "test-study": 90000 } } }, offset: 0, updatedAt: Date.now() }));
    assert.equal(await secs.allowance(), 90);
    assert.equal(await secs.text(), "今日あと 90pt 賭けられます（今日の勉強 1分）");
    await secs.page.close();
    const under = await boot("2026-11-20T03:00:00Z");
    await under.page.evaluate(() => window.StudyTime.mergeCloud({ version: 1, epoch: "study-reset-2.62", days: { [window.StudyTimeModel.dateKey(Date.now())]: { sources: { "test-study": 59999 } } }, offset: 0, updatedAt: Date.now() }));
    assert.equal(await under.allowance(), 59);
    await under.page.close();

    // Before this began: the study of 2026-11-03 and earlier is not carried. On the 4th, yesterday
    // (the 3rd, with 140 minutes) gives nothing; on the 5th, the 4th carries and the 3rd does not.
    const fourth = await boot("2026-11-04T03:00:00Z");
    await fourth.studied(-1, 140);
    await fourth.studied(0, 9);
    assert.equal(await fourth.day(-1), "2026-11-03");
    assert.equal(await fourth.allowance(), 540);
    assert.equal(await fourth.text(), "今日あと 540pt 賭けられます（今日の勉強 9分）");
    await fourth.page.close();
    const fifth = await boot("2026-11-05T03:00:00Z");
    await fifth.studied(-2, 140);
    await fifth.studied(-1, 10);
    await fifth.studied(0, 2);
    assert.equal(await fifth.allowance(), 600 + 120);
    await fifth.page.close();
    assert.deepEqual(errors, []);
    console.log("PASS: the unused part of a day's betting allowance carries on at full value the next day, then halves each day and is gone after five; bets take the oldest first; days before 2026-11-04 do not carry");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
