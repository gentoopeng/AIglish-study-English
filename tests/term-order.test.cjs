const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  o = require("../term-order.js"),
  t = require("../term-questions.js");
const words = [
  { num: 1, word: "織田信長", meanings: [{ id: "1-0", text: "1582 「本能寺の変」で死亡" }, { id: "1-1", text: "1575「長篠の戦い」" }] },
  { num: 2, word: "源頼朝", meanings: [{ id: "2-0", text: "1192 「鎌倉幕府」を開いた" }, { id: "2-1", text: "年号のない説明" }] },
  { num: 3, word: "徳川家康", meanings: [{ id: "3-0", text: "1603 江戸幕府を開いた" }, { id: "3-1", text: "1600 関ヶ原の戦い" }] },
];
const seeded = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
test("every line with a year is an event; rounds use four different years, never already in order", () => {
  const list = o.events(words, t.parseLine);
  assert.deepEqual(list.map((e) => e.year), [1582, 1575, 1192, 1603, 1600]);
  assert.equal(list[0].text, "本能寺の変で死亡");
  for (let s = 1; s < 60; s++) {
    const r = o.round(list, seeded(s));
    assert.equal(r.length, 4);
    assert.equal(new Set(r.map((e) => e.year)).size, 4);
    assert.equal(o.inOrder(r), false);
  }
  assert.deepEqual(o.round(list.slice(0, 2), seeded(1)), []);
  assert.equal(o.round(list.slice(0, 3), seeded(1)).length, 3);
});
test("checking an order marks each position", () => {
  const [a, b, c] = o.events(words, t.parseLine);
  assert.deepEqual(o.check([c, b, a]).right, true);
  const wrong = o.check([a, b, c]);
  assert.equal(wrong.right, false);
  assert.deepEqual(wrong.marks, [false, true, false]);
  assert.deepEqual(wrong.sorted, [c, b, a]);
});
test("missed years come up more often", () => {
  const list = o.events(words, t.parseLine),
    weight = (e) => (e.year === 1192 ? 20 : 1);
  let count = 0;
  for (let s = 1; s < 200; s++) if (o.round(list, seeded(s), weight).some((e) => e.year === 1192)) count++;
  assert.ok(count > 190, String(count));
});
