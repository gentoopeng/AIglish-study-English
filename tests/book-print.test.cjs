// book-print (10.170): the printed sheet hides one side in a colour the player picks
// (orange by default, the colour a red sheet / memorisation pen hides), and the words
// to print can be all of the book, a number range, or one unit.
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  B = require("../book-print.js");

const w = (num, word, meanings, extra = {}) => ({ num, word, meanings: meanings.map((text, i) => ({ id: num + "-" + i, text })), ...extra });
const words = [
  w(3, "cherry", ["さくらんぼ"], { unit: "Unit 2" }),
  w(1, "apple", ["りんご"], { unit: "Unit 1", sub: "fruit" }),
  w(2, "banana", ["バナナ", "黄色い果物"], { unit: "Unit 1" }),
];

test("colours: orange is the default and carries the red-sheet orange", () => {
  assert.equal(B.colorOf(undefined).id, "orange");
  assert.equal(B.colorOf("orange").value, "#ff7a00");
  assert.equal(B.colorOf("nope").id, "orange");
  assert.ok(B.COLORS.length >= 5);
});

test("selectWords: book order, all / range / unit", () => {
  assert.deepEqual(B.selectWords(words, { scope: "all" }).map((x) => x.num), [1, 2, 3]);
  assert.deepEqual(B.selectWords(words, { scope: "range", from: 2, to: 3 }).map((x) => x.num), [2, 3]);
  assert.deepEqual(B.selectWords(words, { scope: "range", from: 2 }).map((x) => x.num), [2, 3]);
  assert.deepEqual(B.selectWords(words, { scope: "unit", unit: "Unit 1" }).map((x) => x.num), [1, 2]);
  assert.deepEqual(B.unitsOf(words), ["Unit 2", "Unit 1"]);
});

test("rowOf: meanings kept apart, sub only when asked", () => {
  const withSub = B.rowOf(words[1], 1, true);
  assert.equal(withSub.sub, "fruit");
  assert.deepEqual(withSub.meanings.map((m) => m.text), ["りんご"]);
  assert.equal(B.rowOf(words[1], 1, false).sub, "");
  assert.deepEqual(B.rowOf(words[2], 2, false).meanings.map((m) => m.text), ["バナナ", "黄色い果物"]);
  // A legacy word with only a flat meaning still prints.
  assert.deepEqual(B.rowOf({ num: 9, word: "old", meaning: "古い" }, 9, false).meanings.map((m) => m.text), ["古い"]);
});

test("sheetHtml: the hidden side is coloured, the other side is not", () => {
  const rows = [B.rowOf(words[1], 1, true)];
  const byMeaning = B.sheetHtml("テスト帳", rows, { hide: "meaning", color: "orange" });
  assert.match(byMeaning, /テスト帳/);
  assert.match(byMeaning, /1語/);
  assert.match(byMeaning, /style="color:#ff7a00"><span class="bp-meaning">りんご/);
  assert.ok(!byMeaning.includes('style="color:#ff7a00">apple'));
  assert.equal((byMeaning.match(/bp-hidden-side/g) || []).length, 1);
  const byWord = B.sheetHtml("テスト帳", rows, { hide: "word", color: "blue" });
  assert.match(byWord, new RegExp('style="color:' + B.colorOf("blue").value + '">apple'));
  assert.ok(!byWord.includes('style="color:' + B.colorOf("blue").value + '"><span class="bp-meaning">りんご'));
  assert.equal((byWord.match(/bp-hidden-side/g) || []).length, 1);
});

test("sheetHtml escapes the book's text", () => {
  const rows = [B.rowOf(w(1, "<b>x</b>", ["<script>"]), 1, false)];
  const html = B.sheetHtml("<帳>", rows, {});
  assert.ok(!html.includes("<b>x</b>"));
  assert.ok(!html.includes("<script>"));
  assert.match(html, /&lt;帳&gt;/);
});
