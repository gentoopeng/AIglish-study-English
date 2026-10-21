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
