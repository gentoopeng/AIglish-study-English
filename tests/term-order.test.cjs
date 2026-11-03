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

const mixed = [
  { num: 10, word: "A", meanings: [{ id: "10-0", text: "12世紀 一つ目" }, { id: "10-1", text: "15世紀 二つ目" }, { id: "10-2", text: "紀元前3世紀 三つ目" }, { id: "10-3", text: "平安時代 時代の一" }] },
  { num: 11, word: "B", meanings: [{ id: "11-0", text: "鎌倉時代 時代の二" }, { id: "11-1", text: "江戸時代 時代の三" }, { id: "11-2", text: "1582 年の一" }, { id: "11-3", text: "20世紀 四つ目" }] },
];
test("centuries and eras are events too, put in order by when they began, and a round uses one kind only", () => {
  const list = o.events(mixed, t.parseLine);
  assert.deepEqual(list.map((e) => [e.kind, e.label, e.year, e.key]), [
    ["century", "12世紀", 1101, "c:10-0"],
    ["century", "15世紀", 1401, "c:10-1"],
    ["century", "紀元前3世紀", -299, "c:10-2"],
    ["era", "平安時代", 794, "e:10-3"],
    ["era", "鎌倉時代", 1185, "e:11-0"],
    ["era", "江戸時代", 1603, "e:11-1"],
    ["year", "1582年", 1582, "y:11-2"],
    ["century", "20世紀", 1901, "c:11-3"],
  ]);
  // Centuries (4) and eras (3) can be played; the one year cannot.
  assert.deepEqual(o.playable(list).map((g) => g[0].kind).sort(), ["century", "era"]);
  const seen = new Set();
  for (let s = 1; s < 80; s++) {
    const r = o.round(list, seeded(s * 1000003));
    assert.ok(r.length >= 3);
    assert.equal(new Set(r.map((e) => e.kind)).size, 1);
    seen.add(r[0].kind);
    assert.equal(o.inOrder(r), false);
  }
  assert.deepEqual([...seen].sort(), ["century", "era"]);
  // Not enough of any one kind: nothing to play, even with five events in all.
  assert.deepEqual(o.round(list.filter((e) => e.kind !== "century" && e.year !== 794 && e.year !== 1185), seeded(1)), []);
  const sorted = o.check(o.round(list.filter((e) => e.kind === "century"), seeded(2))).sorted;
  assert.deepEqual(sorted.map((e) => e.label).slice(0, 2), ["紀元前3世紀", "12世紀"]);
});
