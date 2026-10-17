const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  p = require("../study-point-policy.js");
test("JST time rewards mature six minutes after midnight, never at UTC midnight", () => {
  const end = Date.parse("2026-10-18T15:00:00Z");
  assert.equal(p.mature("2026-10-18", end + 359999), false);
  assert.equal(p.mature("2026-10-18", end + 360000), true);
  assert.equal(p.mature("2026-02-30", end), false);
});
test("fractional minutes carry between five-minute slots within a day; midnight splits days", () => {
  const days = {},
    start = Date.parse("2026-10-18T14:59:30Z");
  p.accrueTime(days, "a", start, start + 59000);
  assert.equal(p.timeMinutes(days["2026-10-18"].pointTime), 0);
  assert.equal(p.timeMinutes(days["2026-10-19"].pointTime), 0);
  const beginning = p.dayStart("2026-10-18");
  p.accrueTime(days, "a", beginning, beginning + 30000);
  assert.equal(p.timeMinutes(days["2026-10-18"].pointTime), 1);
});
test("merging backups cannot resurrect idle minutes or multiply a repeated time slice", () => {
  const left = { 0: { a: { ms: 120000, removed: 0 } } },
    right = { 0: { a: { ms: 120000, removed: 60000 } } };
  const merged = p.mergeTime(left, right, left);
  assert.equal(p.timeMinutes(merged), 1);
  assert.equal(p.timeMinutes(p.mergeTime(merged, left)), 1);
  assert.equal(
    p.timeMinutes({
      0: { a: { ms: 999999999, removed: 0 }, b: { ms: 300000, removed: 0 } },
    }),
    5,
  );
});
