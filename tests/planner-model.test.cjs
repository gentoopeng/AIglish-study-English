const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../planner-model.js");
const NOW = new Date(2026, 10, 19, 12).getTime();

test("dates: written forms, month/day only, and impossible days", () => {
  assert.equal(P.day("2026-11-19"), "2026-11-19");
  assert.equal(P.day("2026/1/5"), "2026-01-05");
  assert.equal(P.day("2026年12月3日"), "2026-12-03");
  assert.equal(P.day("12/3", NOW), "2026-12-03");
  assert.equal(P.day("1/10", NOW), "2027-01-10", "a month/day long past is next year");
  assert.equal(P.day("2026-02-30"), "");
  assert.equal(P.day("あした"), "");
});

test("a plan is spread over every day, the first days taking one more", () => {
  const parts = P.split({ from: 1, to: 10, start: "2026-11-19", end: "2026-11-22" });
  assert.deepEqual(parts, [
    { date: "2026-11-19", from: 1, to: 3 },
    { date: "2026-11-20", from: 4, to: 6 },
    { date: "2026-11-21", from: 7, to: 8 },
    { date: "2026-11-22", from: 9, to: 10 },
  ]);
  // Fewer items than days: one a day from the start.
  assert.deepEqual(P.split({ from: 5, to: 6, start: "2026-11-19", end: "2026-11-25" }).map((p) => [p.date, p.from, p.to]), [["2026-11-19", 5, 5], ["2026-11-20", 6, 6]]);
  // Across a month end.
  assert.equal(P.split({ from: 1, to: 120, start: "2026-11-25", end: "2026-12-04" }).at(-1).date, "2026-12-04");
});

test("clean keeps valid items only and caps them", () => {
  const d = P.clean({
    events: [{ id: "a", date: "2026-11-30", kind: "test", title: "  英語  テスト ", at: 5 }, { id: "b", date: "nope", title: "x" }, { id: "c", date: "2026-11-30", title: "" }],
    plans: [{ id: "p", source: { type: "vocab", id: "book1", name: "システム英単語" }, from: 1, to: 100, start: "2026-11-20", end: "2026-11-29", at: 5 }, { id: "q", from: 10, to: 5, start: "2026-11-20", end: "2026-11-29" }, { id: "r", from: 1, to: 5, start: "2026-11-20", end: "2028-11-29" }],
    checks: { "p|2026-11-20": { done: true, at: 7 }, "bad": { done: true } },
  }, NOW);
  assert.deepEqual(d.events.map((e) => [e.id, e.kind, e.title]), [["a", "test", "英語 テスト"]]);
  assert.deepEqual(d.plans.map((p) => [p.id, p.title, p.source.type]), [["p", "システム英単語", "vocab"]]);
  assert.deepEqual(Object.keys(d.checks), ["p|2026-11-20"]);
  const many = P.clean({ events: Array.from({ length: 600 }, (_, i) => ({ id: "e" + i, date: "2026-11-30", title: "t", at: i + 1 })) }, NOW);
  assert.equal(many.events.length, P.MAX_EVENTS);
});

test("two devices merge item by item; a removal reaches the other device and later expires", () => {
  let a = P.addEvent({}, { id: "x", date: "2026-11-30", kind: "test", title: "英語" }, NOW);
  let b = P.clean(a, NOW);
  a = P.addEvent(a, { id: "y", date: "2026-12-01", title: "部活" }, NOW + 1000); // only on A
  b = P.addEvent(b, { id: "x", date: "2026-11-30", kind: "test", title: "英語（範囲変更）" }, NOW + 2000); // B changes x later
  const both = P.merge(a, b, NOW + 3000);
  assert.deepEqual(P.live(both.events).map((e) => [e.id, e.title]).sort(), [["x", "英語（範囲変更）"], ["y", "部活"]]);
  // A removes y; B still has it: the removal wins.
  const removed = P.remove(both, "events", "y", NOW + 4000);
  assert.deepEqual(P.live(P.merge(both, removed, NOW + 5000).events).map((e) => e.id), ["x"]);
  // After 90 days the removal mark is dropped.
  assert.equal(P.clean(removed, NOW + 91 * P.DAY).events.some((e) => e.id === "y"), false);
  // Checks: the newer one wins.
  const base = P.addPlan({}, { id: "p", source: { type: "free", name: "x" }, from: 1, to: 2, start: "2026-11-20", end: "2026-11-21" }, NOW);
  const c1 = P.check(base, "p|2026-11-20", true, NOW), c2 = P.check(base, "p|2026-11-20", false, NOW + 1);
  assert.equal(P.merge(c1, c2, NOW + 2).checks["p|2026-11-20"].done, false);
});

test("what is on a day, and the dots for a range", () => {
  let d = P.addEvent({}, { id: "t", date: "2026-11-22", kind: "test", title: "単語テスト" }, NOW);
  d = P.addEvent(d, { id: "n", date: "2026-11-22", kind: "note", title: "早く寝る" }, NOW);
  d = P.addPlan(d, { id: "p", source: { type: "vocab", id: "b", name: "本" }, from: 1, to: 9, start: "2026-11-20", end: "2026-11-22" }, NOW);
  d = P.check(d, "p|2026-11-21", true, NOW);
  const day = P.on(d, "2026-11-21");
  assert.deepEqual(day.tasks.map((t) => [t.from, t.to, t.checked]), [[4, 6, true]]);
  assert.deepEqual(P.on(d, "2026-11-22").events.map((e) => e.kind), ["test", "note"]);
  assert.deepEqual(P.marks(d, "2026-11-20", "2026-11-22"), { "2026-11-20": { events: 0, tests: 0, tasks: 1 }, "2026-11-21": { events: 0, tests: 0, tasks: 1 }, "2026-11-22": { events: 1, tests: 1, tasks: 1 } });
  assert.deepEqual(P.details(d, "2026-11-21", "2026-11-22"), { "2026-11-21": [{ kind: "task", title: "本" }], "2026-11-22": [{ kind: "test", title: "単語テスト" }, { kind: "note", title: "早く寝る" }, { kind: "task", title: "本" }] });
});

test("an AI's plan is imported: books matched by name, others kept as free plans, bad lines skipped", () => {
  const books = [{ type: "vocab", id: "sys", name: "システム英単語" }, { type: "work", id: "w1", name: "数学ワーク" }];
  const answer = "はい！\n```json\n" + JSON.stringify({
    events: [{ date: "12/1", kind: "test", title: "期末テスト（英語）" }, { date: "いつか", title: "x" }],
    plans: [
      { title: "英単語 1〜300", book: "システム 英単語", from: 1, to: 300, start: "2026-11-20", end: "2026-11-30" },
      { book: "数学ワーク", from: 1, to: 40, start: "11/20", end: "11/30" },
      { title: "教科書を読む", book: "教科書", from: 1, to: 50, start: "11/20", end: "11/25" },
      { book: "システム英単語", from: 50, to: 1, start: "11/20", end: "11/25" },
    ],
  }) + "\n```";
  const r = P.importAi(answer, {}, books, NOW);
  assert.deepEqual([r.events, r.plans], [1, 3]);
  assert.deepEqual(r.free, ["教科書"]);
  assert.equal(r.skipped.length, 2);
  const plans = P.live(r.data.plans);
  assert.deepEqual(plans.map((p) => [p.source.type, p.source.id, p.from, p.to]).sort(), [["free", "", 1, 50], ["vocab", "sys", 1, 300], ["work", "w1", 1, 40]].sort());
  assert.equal(P.live(r.data.events)[0].date, "2026-12-01");
  assert.throws(() => P.importAi("ごめんなさい", {}, books, NOW), /貼り付け/);
});

test("a memo keeps its lines; overdue days that are not done come back on today", () => {
  const d0 = P.addEvent({}, { id: "m", date: "2026-11-20", title: "メモ", memo: "1行目\n\n  2行目 \r\n3行目" }, NOW);
  assert.equal(P.live(d0.events)[0].memo, "1行目\n2行目\n3行目");
  let d = P.addPlan({}, { id: "p", source: { type: "free", name: "教科書" }, from: 1, to: 4, start: "2026-11-16", end: "2026-11-19" }, NOW);
  d = P.check(d, "p|2026-11-16", true, NOW);
  assert.deepEqual(P.overdue(d, "2026-11-19").map((t) => [t.date, t.from]), [["2026-11-17", 2], ["2026-11-18", 3]]);
  assert.deepEqual(P.overdue(d, "2026-11-19", (t) => t.checked || t.from === 2).map((t) => t.date), ["2026-11-18"]);
});

test("an item given without an id (a new one from a form) gets one", () => {
  const d = P.addEvent({}, { id: undefined, date: "2026-11-30", title: "新しい" }, NOW);
  assert.equal(P.live(d.events).length, 1);
  assert.ok(P.live(d.events)[0].id);
});

test("removed items never push a live one out; the same AI answer twice adds nothing again; checks of gone plans go", () => {
  let d = P.addEvent({}, { id: "keep", date: "2026-12-01", kind: "test", title: "大事なテスト" }, NOW);
  for (let i = 0; i < 520; i++) d = P.remove(P.addEvent(d, { id: "n" + i, date: "2026-12-02", title: "x" }, NOW + i * 2 + 1), "events", "n" + i, NOW + i * 2 + 2);
  assert.deepEqual(P.live(d.events).map((e) => e.id), ["keep"]);
  assert.equal(P.room(d, "events"), true);
  const answer = JSON.stringify({ events: [{ date: "2026-12-05", title: "模試" }], plans: [{ book: "本", from: 1, to: 10, start: "2026-11-20", end: "2026-11-25" }] });
  const once = P.importAi(answer, {}, [], NOW), twice = P.importAi(answer, once.data, [], NOW);
  assert.deepEqual([twice.events, twice.plans, P.live(twice.data.events).length, P.live(twice.data.plans).length], [0, 0, 1, 1]);
  let c = P.addPlan({}, { id: "gone", source: { type: "free", name: "x" }, from: 1, to: 2, start: "2026-11-20", end: "2026-11-21" }, NOW);
  c = P.check(c, "gone|2026-11-20", true, NOW);
  assert.equal(Object.keys(P.clean(c).checks).length, 1);
  c = P.remove(c, "plans", "gone", NOW + 1);
  assert.equal(Object.keys(P.clean(c).checks).length, 1, "kept while the removal mark is");
  assert.equal(Object.keys(P.clean({ ...c, plans: [] }).checks).length, 0);
  // A share unticked by hand is marked as a hand decision.
  const u = P.check(P.addPlan({}, { id: "p", source: { type: "free", name: "x" }, from: 1, to: 2, start: "2026-11-20", end: "2026-11-21" }, NOW), "p|2026-11-20", false, NOW);
  assert.deepEqual(P.on(u, "2026-11-20").tasks.map((t) => [t.checked, t.manual]), [[false, true]]);
  assert.deepEqual(P.on(u, "2026-11-21").tasks.map((t) => [t.checked, t.manual]), [[false, false]]);
});
