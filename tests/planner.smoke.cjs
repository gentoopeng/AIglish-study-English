// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/planner.smoke.cjs
// The planner on the ステータス tab (10.163): write on a day, week and month views, a plan from a word book spread over
// days and ticked off (by hand, or by itself once the day's words are rated), late days back on today, a work's
// test day shown, the AI prompt and its answer imported; the card keeps its state while the status board redraws;
// the save takes only this account's planner and a restore merges item by item.
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
      window.__copied = [];
      Object.defineProperty(navigator, "clipboard", { value: { writeText: async (t) => window.__copied.push(t) }, configurable: true });
    });
    await page.goto(process.env.APP_URL || "http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true && window.Planner);
    const today = await page.evaluate(() => PlannerModel.dateKey(Date.now()));
    const plus = (n) => page.evaluate((n) => PlannerModel.addDays(PlannerModel.dateKey(Date.now()), n), n);
    // A word book with 9 words on this device, and a work with a test day.
    await page.evaluate(() => {
      textbooksPool.splice(0, textbooksPool.length, { id: "pl-book", name: "テスト単語帳", cover: "📗" });
      localStorage.setItem("core_v4_user_vocab_book_" + myId + "_pl-book", JSON.stringify(Array.from({ length: 9 }, (_, i) => ({ num: i + 1, word: "w" + (i + 1), meaning: "m" }))));
      const work = { id: "work_pl", name: "数学ワーク", unitKind: "problem", from: 1, to: 20, units: [], visibility: "private", testDate: PlannerModel.addDays(PlannerModel.dateKey(Date.now()), 10), updatedAt: Date.now() };
      localStorage.setItem("vv4_works_" + myId, JSON.stringify([work]));
      window.StatusBoard.render();
    });
    const card = page.locator(".sb-planner");
    await card.waitFor();
    // The work's test day counts down (the nearest test).
    assert.match(await page.locator("#statusBoard .pl-countdown").innerText(), /あと10日[\s\S]*数学ワーク テスト/);
    // The countdowns sit near the top on their own card; the calendar card is the board's last card.
    assert.equal(await card.locator(".pl-countdown").count(), 0);
    assert.equal(await page.evaluate(() => document.getElementById("statusBoard").lastElementChild.classList.contains("sb-planner")), true);
    // Write a test on a day through the form.
    await card.getByRole("button", { name: "＋ 書く" }).click();
    const form = page.locator("dialog[open] form.pl-form");
    await form.locator("input[name=date]").fill(await plus(3));
    await form.locator("select[name=kind]").selectOption("test");
    await form.locator("input[name=title]").fill("英単語テスト<b>");
    await form.locator("textarea[name=memo]").fill("範囲 1-9\n持ち物 赤シート");
    await form.getByRole("button", { name: "保存" }).click();
    assert.match(await page.locator("#statusBoard .pl-countdown").first().innerText(), /あと3日[\s\S]*英単語テスト<b>/);
    assert.match(await page.locator("#statusBoard .pl-countdown").nth(1).innerText(), /あと10日[\s\S]*数学ワーク テスト/);
    // Picking with 📌: pin only the written test, and the countdown narrows to it.
    await card.locator(".pl-daybox .pl-pin").click();
    assert.equal(await page.locator("#statusBoard .pl-countdown").count(), 1);
    assert.match(await page.locator("#statusBoard .pl-countdown").innerText(), /あと3日[\s\S]*英単語テスト<b>/);
    // Pin the work's test too (its day is +10): both come back.
    await card.locator(`.pl-day[data-date="${inDays(10)}"]`).click();
    await card.locator(".pl-daybox .pl-pin").click();
    assert.equal(await page.locator("#statusBoard .pl-countdown").count(), 2);
    assert.match(await card.locator(".pl-daybox").innerText(), /テスト[\s\S]*英単語テスト<b>[\s\S]*範囲 1-9\n持ち物 赤シート/);
    // Week and month.
    assert.equal(await card.locator(".pl-grid .pl-day").count(), 7);
    await card.getByRole("button", { name: "月", exact: true }).click();
    assert.equal(await card.locator(".pl-grid .pl-day").count(), 42);
    assert.ok(await card.locator(`.pl-day[data-date="${await plus(3)}"].has-test`).count());
    assert.equal(await card.locator(`.pl-day[data-date="${await plus(3)}"] .pl-chip-test`).innerText(), "英単語テスト<b>");
    await card.getByRole("button", { name: "週", exact: true }).click();
    // A plan: words 1–9 over today and the next two days (3 a day).
    await card.getByRole("button", { name: "今日", exact: true }).click();
    await card.locator(`.pl-day[data-date="${today}"]`).click();
    await card.getByRole("button", { name: "＋ 計画" }).click();
    const plan = page.locator("dialog[open] form.pl-form");
    await plan.locator("select[name=source]").selectOption("vocab:pl-book");
    await plan.locator("input[name=from]").fill("1");
    await plan.locator("input[name=to]").fill("9");
    await plan.locator("input[name=start]").fill(today);
    await plan.locator("input[name=end]").fill(await plus(2));
    await plan.getByRole("button", { name: "作る" }).click();
    const task = card.locator(".pl-task", { hasText: "テスト単語帳 1–3" });
    await task.waitFor();
    assert.equal(await card.locator(`.pl-day[data-date="${today}"] .pl-chip`).count(), 0, "tasks are not shown in the cells");
    assert.match(await task.innerText(), /0\/3/);
    // Rating the day's words ticks it off by itself.
    await page.evaluate(() => {
      const key = getVocabProgressStorageKey("pl-book");
      localStorage.setItem(key, JSON.stringify({ 1: { status: "ok" }, 2: { status: "bad" }, 3: { meanings: { a: { status: "so" } } } }));
      window.Planner.draw();
    });
    assert.ok(await card.locator(".pl-task.is-done", { hasText: "テスト単語帳 1–3" }).count());
    // Unticked by hand, it stays not done (the hand decides over the ratings).
    await card.locator(".pl-task", { hasText: "テスト単語帳 1–3" }).locator("input[type=checkbox]").uncheck();
    assert.equal(await card.locator(".pl-task.is-done", { hasText: "テスト単語帳 1–3" }).count(), 0);
    assert.equal(await card.locator(".pl-task", { hasText: "テスト単語帳 1–3" }).locator("input[type=checkbox]").isChecked(), false);
    await card.locator(".pl-task", { hasText: "テスト単語帳 1–3" }).locator("input[type=checkbox]").check();
    // Tomorrow's share, ticked by hand.
    await card.locator(`.pl-day[data-date="${await plus(1)}"]`).click();
    const tomorrow = card.locator(".pl-task", { hasText: "テスト単語帳 4–6" });
    await tomorrow.locator("input[type=checkbox]").check();
    assert.ok(await card.locator(".pl-task.is-done", { hasText: "4–6" }).count());
    // The status board redraws (points changed) while the planner shows tomorrow: it keeps its place.
    await page.evaluate(() => localStorage.setItem("core_v4_study_points_" + myId, JSON.stringify({ balance: 77, revision: 9 })));
    await page.waitForTimeout(2000);
    assert.ok(await card.locator(`.pl-day[data-date="${await plus(1)}"].is-selected`).count(), "kept the day picked");
    // A day that has passed and is not done comes back on today.
    await page.evaluate(() => {
      const P = PlannerModel, t = P.dateKey(Date.now()), key = "aiglish_planner_" + myId;
      const d = P.addPlan(JSON.parse(localStorage.getItem(key)), { id: "late", source: { type: "free", name: "教科書" }, title: "教科書", from: 1, to: 2, start: P.addDays(t, -2), end: P.addDays(t, -1) });
      localStorage.setItem(key, JSON.stringify(d));
    });
    await card.getByRole("button", { name: "今日", exact: true }).click();
    assert.equal(await card.locator(".pl-task.is-late").count(), 2);
    // The AI prompt names the books and today; its answer is imported.
    await card.getByRole("button", { name: "AIで計画" }).click();
    const ai = page.locator("dialog[open] .pl-form");
    await ai.getByRole("button", { name: "プロンプトをコピー" }).click();
    await page.waitForFunction(() => window.__copied.length === 1);
    const prompt = await page.evaluate(() => window.__copied[0]);
    assert.ok(prompt.includes("テスト単語帳（単語帳）") && prompt.includes("数学ワーク（ワーク）") && prompt.includes("今日は " + today) && prompt.includes('"plans"'));
    const answer = "```json\n" + JSON.stringify({ events: [{ date: await plus(5), kind: "event", title: "模試" }], plans: [{ title: "ワーク", book: "数学ワーク", from: 1, to: 20, start: today, end: await plus(9) }, { book: "ない本", from: 5, to: 1, start: today, end: today }] }) + "\n```";
    await ai.locator("textarea.pl-paste").fill(answer);
    await ai.getByRole("button", { name: "取り込む" }).click();
    await card.locator(".pl-note", { hasText: "予定 1件・計画 1件を取り込みました" }).waitFor();
    assert.match(await card.locator(".pl-note").innerText(), /取り込めなかった: ない本/);
    assert.ok(await card.locator(".pl-task", { hasText: "ワーク 1–2" }).count(), "the work's share for today");
    // Saved for this account only; a restore merges with what this device has.
    const save = await page.evaluate(() => {
      localStorage.setItem("aiglish_planner_someone-else", JSON.stringify({ events: [{ id: "x", date: "2026-12-01", title: "他人", at: 1 }] }));
      const data = window.__collectGameSaveData().localStorage;
      return Object.keys(data).filter((k) => k.startsWith("aiglish_planner_"));
    });
    assert.deepEqual(save, ["aiglish_planner_" + (await page.evaluate(() => myId))]);
    const merged = await page.evaluate(() => {
      const P = PlannerModel, key = "aiglish_planner_" + myId;
      const backup = P.addEvent({}, { id: "other-device", date: P.dateKey(Date.now()), title: "別の端末で書いた", kind: "note" }, Date.now() - 1000);
      window.__restoreSaveStorage({ data: { localStorage: { [key]: JSON.stringify(backup), "aiglish_planner_someone-else": "{}" } } }, myId);
      const d = JSON.parse(localStorage.getItem(key));
      return { titles: P.live(d.events).map((e) => e.title).sort(), plans: P.live(d.plans).length, other: localStorage.getItem("aiglish_planner_someone-else") };
    });
    assert.deepEqual(merged.titles, ["別の端末で書いた", "模試", "英単語テスト<b>"].sort());
    assert.equal(merged.plans, 3);
    assert.notEqual(merged.other, "{}", "another account's planner is not written by this account's restore");
    // Open: a word book's share opens its cards set to that range.
    await page.evaluate(() => window.Planner.draw());
    await card.locator(".pl-task", { hasText: "テスト単語帳 1–3" }).getByRole("button", { name: "開く" }).click();
    await page.waitForFunction(() => document.querySelector("#flashcardRangeEnd")?.value === "3");
    assert.equal(await page.locator("#flashcardRangeStart").inputValue(), "1");
    await page.evaluate(() => { document.querySelectorAll("dialog[open]").forEach((d) => d.close()); window.switchTab("status"); });
    // Open: a work's share opens the work at that range.
    await page.evaluate(() => window.Planner.draw());
    await card.locator(".pl-task", { hasText: "ワーク 1–2" }).getByRole("button", { name: "開く" }).click();
    await page.waitForFunction(() => document.querySelector("#workbookRangeEnd")?.value === "2");
    assert.equal(await page.locator("#workbookRangeStart").inputValue(), "1");
    assert.deepEqual(errors, []);
    console.log("planner smoke ok");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
