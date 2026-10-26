// Run: node tests/notices-model.test.cjs
const assert = require("node:assert/strict");
const M = require("../notices-model.js");

// 50 equal segments; the rarer the prize, the fewer its segments.
assert.equal(M.SEGMENTS.length, 50);
const counts = {};
for (const prize of M.SEGMENTS) counts[prize] = (counts[prize] || 0) + 1;
assert.deepEqual(counts, M.COUNTS);
assert.deepEqual(M.TIERS, [1000, 500, 200, 100, 50, 10]);
for (let i = 1; i < M.TIERS.length; i++) assert.ok(M.COUNTS[M.TIERS[i - 1]] < M.COUNTS[M.TIERS[i]]);
const mean = M.SEGMENTS.reduce((a, b) => a + b, 0) / 50;
assert.ok(mean > 85 && mean < 95, "average " + mean);
assert.equal(M.SEGMENTS[0], 1000);
// The rare ones are spread out: no two 500s or 200s side by side.
for (let i = 0; i < 50; i++) if (M.SEGMENTS[i] >= 200) assert.ok(M.SEGMENTS[(i + 1) % 50] < 200, "neighbours at " + i);
// Every r in [0, 1) maps to a segment, each equally often.
const hits = Array(50).fill(0);
for (let i = 0; i < 5000; i++) hits[M.drawSegment(() => (i + 0.5) / 5000)]++;
assert.ok(hits.every((h) => h === 100));
assert.equal(M.drawSegment(() => 0.999999), 49);
assert.equal(M.percent(1000), "2%");
assert.equal(M.percent(10), "40%");

// The day turns at midnight in Japan.
assert.equal(M.dayKey(Date.UTC(2026, 9, 26, 14, 59)), "2026-10-26");
assert.equal(M.dayKey(Date.UTC(2026, 9, 26, 15, 0)), "2026-10-27");

// The wheel stops with the drawn segment under the pointer at the top.
for (let segment = 0; segment < 50; segment++) {
  for (const jitter of [-0.35, 0, 0.35]) {
    const angle = M.stopAngle(segment, 6, jitter),
      size = 360 / 50,
      under = (((360 - (angle % 360)) % 360) + 360) % 360;
    assert.equal(Math.floor(under / size), segment);
    assert.ok(angle >= 6 * 360 - size);
  }
}
assert.throws(() => M.stopAngle(50));

// Notices: newest first, at most 30, a title is needed, one can be taken down.
let list = [];
assert.throws(() => M.addNotice(list, { id: "x", title: "  ", body: "", at: 1 }), /タイトル/);
for (let i = 1; i <= 35; i++) list = M.addNotice(list, { id: "n" + i, title: "お知らせ" + i, body: "本文", at: i * 10 });
assert.equal(list.length, M.MAX_NOTICES);
assert.equal(list[0].id, "n35");
assert.equal(list.at(-1).id, "n6");
assert.equal(M.addNotice([], { id: "a", title: "t".repeat(80), body: "b".repeat(1200), at: 1 })[0].title.length, 60);
list = M.removeNotice(list, "n35");
assert.equal(list[0].id, "n34");
assert.equal(M.unread(list, 330), 1);
assert.equal(M.unread(list, null), 29);
assert.equal(M.unread(undefined, 0), 0);
console.log("PASS: 50 segments, rarer prizes on fewer, even draw, Japan day, wheel stop angle, notice list");
