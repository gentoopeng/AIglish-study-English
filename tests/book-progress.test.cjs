// book-progress (10.174): only a per-book summary is public — name, size, learned
// count and percent. A word is learned when every meaning on it is ok.
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  B = require("../book-progress.js");

const entry = (statuses) => ({ meanings: Object.fromEntries(statuses.map((s, i) => ["m" + i, { status: s }])) });

test("wordLearned: every meaning ok, or the word itself ok", () => {
  assert.equal(B.wordLearned(entry(["ok", "ok"])), true);
  assert.equal(B.wordLearned(entry(["ok", "so"])), false);
  assert.equal(B.wordLearned(entry(["bad"])), false);
  assert.equal(B.wordLearned({ status: "ok" }), true);
  assert.equal(B.wordLearned({ status: "none" }), false);
  assert.equal(B.wordLearned(null), false);
});

test("summarizeAll: percent by book size, freshest first, junk dropped", () => {
  const rows = [
    { book: { id: "a", name: "本A" }, progress: { 1: entry(["ok"]), 2: entry(["so"]) }, total: 4, at: 100 },
    { book: { id: "b", name: "本B" }, progress: { 1: entry(["ok", "ok"]), 2: entry(["ok"]) }, total: 2, at: 200 },
    { book: { id: "c", name: "本C" }, progress: {}, total: 10, at: 300 },
    { book: { id: "d", name: "本D" }, progress: { 1: entry(["ok"]) }, total: 0, at: 400 },
  ];
  const list = B.summarizeAll(rows);
  assert.deepEqual(list.map((b) => b.id), ["b", "a"]);
  assert.deepEqual([list[0].done, list[0].total, list[0].pct], [2, 2, 100]);
  assert.deepEqual([list[1].done, list[1].pct], [1, 25]);
});

test("counts: the donut breakdown counts meanings, untouched are ー (10.176)", () => {
  const rows = [{ book: { id: "a", name: "本A" }, progress: { 1: entry(["ok", "so"]), 2: entry(["bad"]) }, total: 4, meaningsTotal: 6, at: 1 }];
  const [b] = B.summarizeAll(rows);
  assert.deepEqual(b.counts, { ok: 1, so: 1, bad: 1, none: 3, total: 6 });
  const parsed = B.parse({ bookProgressJson: JSON.stringify([b]) });
  assert.deepEqual(parsed[0].counts, b.counts);
  // Summaries published before counts existed parse with counts null.
  assert.equal(B.parse({ bookProgressJson: JSON.stringify([{ id: "x", name: "y", total: 3, done: 1, pct: 33 }]) })[0].counts, null);
});

test("parse: a user document round-trips, bad data becomes an empty list", () => {
  const list = B.summarizeAll([{ book: { id: "a", name: "本A" }, progress: { 1: entry(["ok"]) }, total: 2, at: 5 }]);
  const parsed = B.parse({ bookProgressJson: JSON.stringify(list) });
  assert.deepEqual(parsed, list);
  assert.deepEqual(B.parse({ bookProgressJson: "{broken" }), []);
  assert.deepEqual(B.parse({}), []);
  assert.deepEqual(B.parse({ bookProgressJson: JSON.stringify([{ id: "x", name: "y", total: 0 }]) }), []);
});
