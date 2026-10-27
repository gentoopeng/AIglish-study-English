const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  o = require("../vocab-order.js");
const book = (nums) => nums.map((num) => ({ num, word: "w" + num }));
const shown = (words) => o.sort(words).map((w) => [w.word, o.no(w)]);

test("display numbers default to the identity number and sort by it", () => {
  const words = [{ num: 5, word: "e" }, { num: 2, word: "b" }, { num: 9, word: "i", no: 1 }];
  assert.deepEqual(shown(words), [["i", 1], ["b", 2], ["e", 5]]);
  assert.equal(o.maxNo(words), 5);
});

test("inserting after #2 gives the new word 3 and moves the old 3 and later one down", () => {
  const words = [...book([1, 2, 3, 4]), { num: 5, word: "new" }];
  const result = o.place(words, 5, 3);
  assert.deepEqual(shown(result), [["w1", 1], ["w2", 2], ["new", 3], ["w3", 4], ["w4", 5]]);
  // Identities never change; only display numbers do.
  assert.deepEqual(result.map((w) => w.num), [1, 2, 5, 3, 4]);
  // Words whose display number equals their identity keep no extra field.
  assert.equal("no" in result.find((w) => w.num === 1), false);
  assert.equal(result.find((w) => w.num === 3).no, 4);
  // The input is not modified.
  assert.equal("no" in words[2], false);
});

test("a free number absorbs the run, so books that follow printed numbers keep their gaps", () => {
  const words = [...book([1, 2, 10, 11, 20]), { num: 21, word: "new" }];
  // After #2: 3 is free, nothing moves.
  assert.deepEqual(shown(o.place(words, 21, 3)), [["w1", 1], ["w2", 2], ["new", 3], ["w10", 10], ["w11", 11], ["w20", 20]]);
  // After #9 (into 10): 10 and 11 move, 20 stays.
  assert.deepEqual(shown(o.place(words, 21, 10)), [["w1", 1], ["w2", 2], ["new", 10], ["w10", 11], ["w11", 12], ["w20", 20]]);
});

test("inserting at the top and moving an existing word", () => {
  const words = [...book([1, 2, 3]), { num: 4, word: "new" }];
  assert.deepEqual(shown(o.place(words, 4, 1)), [["new", 1], ["w1", 2], ["w2", 3], ["w3", 4]]);
  // Moving #3 to the top: its old number is freed, so the run stops there.
  const moved = o.place(book([1, 2, 3, 4]), 3, 1);
  assert.deepEqual(shown(moved), [["w3", 1], ["w1", 2], ["w2", 3], ["w4", 4]]);
  // Moving back restores the identity numbers and removes the extra fields.
  const back = o.place(o.place(moved, 1, 1), 2, 2);
  assert.deepEqual(shown(o.place(back, 3, 3)), [["w1", 1], ["w2", 2], ["w3", 3], ["w4", 4]]);
  assert.equal(o.place(back, 3, 3).some((w) => "no" in w), false);
  assert.throws(() => o.place(words, 4, 0), /1以上/);
  assert.throws(() => o.place(words, 99, 1), /見つかりません/);
});

test("units are listed in order of appearance with their ranges, and can be assigned by range", () => {
  let words = book([1, 2, 3, 4, 5]);
  words = o.assignUnit(words, 1, 2, " 鎌倉時代 ").words;
  const result = o.assignUnit(words, 3, 5, "室町時代");
  assert.equal(result.changed, 3);
  assert.deepEqual(
    o.units(result.words).map((u) => [u.name, u.count, u.from, u.to]),
    [["鎌倉時代", 2, 1, 2], ["室町時代", 3, 3, 5]],
  );
  // An empty name removes the unit.
  assert.deepEqual(o.units(o.assignUnit(result.words, 1, 5, "").words), []);
  assert.throws(() => o.assignUnit(words, 3, 1, "x"), /範囲/);
  assert.equal(o.cleanUnit("a".repeat(100)).length, o.UNIT_LIMIT);
});

test("the same unit name in two places makes two units, and a unit's name and range can be changed", () => {
  let words = book([1, 2, 3, 4, 5, 6, 7]);
  words = o.assignUnit(words, 1, 2, "第1章").words;
  words = o.assignUnit(words, 3, 3, "まとめ").words;
  words = o.assignUnit(words, 4, 5, "第2章").words;
  words = o.assignUnit(words, 6, 7, "まとめ").words;
  const list = o.units(words);
  assert.deepEqual(list.map((u) => [u.name, u.from, u.to, u.count]), [["第1章", 1, 2, 2], ["まとめ", 3, 3, 1], ["第2章", 4, 5, 2], ["まとめ", 6, 7, 2]]);
  assert.equal(new Set(list.map((u) => u.key)).size, 4);
  assert.deepEqual(o.findUnit(words, list[3].key).nums, ["6", "7"]);
  // A word without a unit also splits a run.
  const gap = o.assignUnit(o.assignUnit(book([1, 2, 3]), 1, 3, "A").words, 2, 2, "").words;
  assert.deepEqual(o.units(gap).map((u) => [u.from, u.to]), [[1, 1], [3, 3]]);
  // Rename the second まとめ and widen it to 5–7: word 5 leaves 第2章.
  const edited = o.editUnit(words, list[3].key, { name: "第2章まとめ", from: 5, to: 7 }).words;
  assert.deepEqual(o.units(edited).map((u) => [u.name, u.from, u.to]), [["第1章", 1, 2], ["まとめ", 3, 3], ["第2章", 4, 4], ["第2章まとめ", 5, 7]]);
  // Narrowing frees words; an empty name removes the unit.
  assert.deepEqual(o.units(o.editUnit(words, list[0].key, { name: "第1章", from: 1, to: 1 }).words).map((u) => [u.name, u.from, u.to])[0], ["第1章", 1, 1]);
  assert.deepEqual(o.units(o.editUnit(words, list[1].key, { name: "" }).words).map((u) => u.name), ["第1章", "第2章", "まとめ"]);
  assert.throws(() => o.editUnit(words, "none@9", { name: "x", from: 1, to: 1 }), /見つかりません/);
});
