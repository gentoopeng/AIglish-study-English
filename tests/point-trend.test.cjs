const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("../point-trend.js");

// 2026-11-16 12:00 in Japan.
const NOW = Date.parse("2026-11-16T03:00:00Z");

test("a day is a Japan day, and the entry writes today's balance and clears the days past KEEP", () => {
  assert.equal(T.day(Date.parse("2026-11-15T15:30:00Z")), "2026-11-16", "00:30 in Japan is already the 16th");
  const del = Symbol("delete");
  const e = T.entry(1234, NOW, () => del);
  assert.equal(e.pointTrend["2026-11-16"], 1234);
  const removed = Object.entries(e.pointTrend).filter(([, v]) => v === del).map(([k]) => k).sort();
  assert.equal(removed.length, 60);
  assert.equal(removed[removed.length - 1], T.shift("2026-11-16", -T.KEEP));
  assert.ok(!removed.includes(T.shift("2026-11-16", -(T.KEEP - 1))), "the oldest kept day stays");
  // Without deleteField (or a bad balance) nothing else is written.
  assert.deepEqual(T.entry(50, NOW, undefined), { pointTrend: { "2026-11-16": 50 }, pointHours: { "2026-11-16": { "1200": 50 } } });
  // The half hours: today's slot, and the days before yesterday cleared.
  const hours = T.entry(1234, NOW, () => del).pointHours;
  assert.equal(hours["2026-11-16"]["1200"], 1234);
  assert.ok(!("2026-11-15" in hours), "yesterday is kept");
  assert.equal(hours["2026-11-14"], del);
  assert.deepEqual(T.entry(-1, NOW), {});
  assert.deepEqual(T.entry(1.5, NOW), {});
});

test("a trend read back keeps only real days and whole balances", () => {
  assert.deepEqual(T.clean({ "2026-11-01": 5, "2026-13-01": 5, x: 3, "2026-11-02": -4, "2026-11-03": "7", "2026-11-04": 2.5 }), { "2026-11-01": 5, "2026-11-03": 7 });
  assert.deepEqual(T.clean(null), {});
  assert.deepEqual(T.clean([1]), {});
});

test("the series carries a day's balance on, starts where the record starts, and uses the balance now for today", () => {
  const trend = { "2026-11-10": 100, "2026-11-13": 400, "2026-11-15": 250 };
  const s = T.series(trend, 7, NOW, 300);
  assert.deepEqual(s.map((p) => p.day), ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16"]);
  assert.deepEqual(s.map((p) => p.value), [100, 100, 100, 400, 400, 250, 300]);
  // A day before the window is carried in; nothing recorded yet is null.
  assert.deepEqual(T.series(trend, 3, NOW).map((p) => p.value), [400, 250, 250]);
  assert.deepEqual(T.series({}, 3, NOW, 70).map((p) => p.value), [null, null, 70]);
  assert.deepEqual(T.series({ "2026-11-15": 10 }, 4, NOW).map((p) => p.value), [null, null, 10, 10]);
  // The change from the day before.
  assert.deepEqual(T.deltas(s).map((p) => p.value), [null, 0, 0, 300, 0, -150, 50]);
  assert.deepEqual(T.deltas(T.series({ "2026-11-15": 10 }, 4, NOW)).map((p) => p.value), [null, null, null, 0]);
});

test("the side of the chart has round steps covering the values", () => {
  const t = T.ticks(120, 9870);
  assert.ok(t[0] <= 120 && t[t.length - 1] >= 9870, String(t));
  const step = t[1] - t[0];
  assert.ok([1, 2, 5].some((m) => step / 10 ** Math.floor(Math.log10(step)) === m), String(step));
  assert.ok(t.every((v, i) => !i || v - t[i - 1] === step));
  assert.ok(T.ticks(500, 500).length >= 2, "a flat line still has a scale");
  const d = T.ticks(-300, 800);
  assert.ok(d.includes(0), "the zero line of the changes is a tick");
});

test("the series around midnight in Japan, and with one day only", () => {
  // 23:59 and 00:01 in Japan fall on two days.
  const before = Date.parse("2026-11-16T14:59:00Z"),
    after = Date.parse("2026-11-16T15:01:00Z");
  assert.equal(T.day(before), "2026-11-16");
  assert.equal(T.day(after), "2026-11-17");
  assert.deepEqual(T.series({ "2026-11-16": 40 }, 2, after, 55).map((p) => [p.day, p.value]), [["2026-11-16", 40], ["2026-11-17", 55]]);
  assert.deepEqual(T.series({ "2026-11-01": 8 }, 1, NOW).map((p) => p.value), [8]);
});

test("today in half hours or hours: each step carries the balance, starts from yesterday's end, stops at now", () => {
  // 12:40 in Japan.
  const now = Date.parse("2026-11-16T03:40:00Z");
  assert.equal(T.slot(now), "1230");
  assert.equal(T.slot(Date.parse("2026-11-16T03:29:00Z")), "1200");
  const hours = { "2026-11-16": { "0900": 120, "1200": 300 }, "2026-11-15": { "2330": 100 }, "bad": { "0900": 1 }, "2026-11-14": { "9999": 5 } };
  const half = T.hourSeries(hours, {}, 30, now, 350);
  assert.equal(half.length, 48);
  assert.deepEqual(half.slice(17, 27).map((p) => [p.day, p.value]), [["08:30", 100], ["09:00", 120], ["09:30", 120], ["10:00", 120], ["10:30", 120], ["11:00", 120], ["11:30", 120], ["12:00", 300], ["12:30", 350], ["13:00", null]]);
  assert.equal(half[0].value, 100, "midnight starts from yesterday's last half hour");
  const hourly = T.hourSeries(hours, {}, 60, now, 350);
  assert.equal(hourly.length, 24);
  assert.deepEqual(hourly.slice(8, 14).map((p) => [p.day, p.value]), [["08:00", 100], ["09:00", 120], ["10:00", 120], ["11:00", 120], ["12:00", 350], ["13:00", null]]);
  // Without yesterday's half hours, yesterday's end of day (or the last day before) is the start.
  assert.equal(T.hourSeries({}, { "2026-11-13": 70 }, 60, now)[0].value, 70);
  assert.equal(T.hourSeries({}, {}, 60, now)[0].value, null);
  // The change in each step.
  assert.deepEqual(T.deltas(hourly).slice(8, 13).map((p) => p.value), [0, 20, 0, 0, 230]);
  assert.deepEqual(T.cleanHours(hours), { "2026-11-16": { "0900": 120, "1200": 300 }, "2026-11-15": { "2330": 100 } });
});
