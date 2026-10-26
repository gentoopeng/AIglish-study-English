// Run: node tests/notices-model.test.cjs
const assert = require("node:assert/strict");
const M = require("../notices-model.js");

// The prizes the bonus can pay, and how often.
assert.deepEqual([...M.PRIZES].sort((a, b) => a - b), [10, 50, 100, 200, 500, 1000]);
assert.equal(Object.values(M.WEIGHTS).reduce((a, b) => a + b, 0), 1000);
const mean = Object.entries(M.WEIGHTS).reduce((a, [p, w]) => a + (p * w) / 1000, 0);
assert.ok(mean > 60 && mean < 70, "average " + mean);
// Every r in [0, 1) maps to a prize, with the counts the weights say.
const counts = {};
for (let i = 0; i < 1000; i++) {
  const prize = M.drawPrize(() => i / 1000);
  counts[prize] = (counts[prize] || 0) + 1;
}
assert.deepEqual(counts, { 10: 450, 50: 300, 100: 150, 200: 70, 500: 25, 1000: 5 });
assert.equal(M.drawPrize(() => 0.99999), 1000);
assert.equal(M.percent(1000), "0.5%");

// The day turns at midnight in Japan.
assert.equal(M.dayKey(Date.UTC(2026, 9, 26, 14, 59)), "2026-10-26");
assert.equal(M.dayKey(Date.UTC(2026, 9, 26, 15, 0)), "2026-10-27");

// The wheel stops with the prize's segment under the pointer at the top.
for (const prize of M.PRIZES) {
  for (const jitter of [-0.35, 0, 0.35]) {
    const angle = M.stopAngle(prize, 6, jitter),
      size = 360 / M.PRIZES.length,
      under = (((360 - (angle % 360)) % 360) + 360) % 360;
    assert.equal(M.PRIZES[Math.floor(under / size)], prize);
    assert.ok(angle >= 6 * 360 - size);
  }
}
assert.throws(() => M.stopAngle(7));

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
console.log("PASS: prize weights and draw, Japan day, wheel stop angle, notice list");
