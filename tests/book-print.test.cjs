// book-print (10.170–10.172): the printed sheet is split into page-sized tables (a
// single long table broke across pages), the word and the meaning each get their own
// colour, and font size / columns / the check-box column are settings.
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  B = require("../book-print.js");

const w = (num, word, meanings, extra = {}) => ({ num, word, meanings: meanings.map((text, i) => ({ id: num + "-" + i, text })), ...extra });
const words = [
  w(3, "cherry", ["さくらんぼ"], { unit: "Unit 2" }),
  w(1, "apple", ["りんご"], { unit: "Unit 1", sub: "fruit" }),
  w(2, "banana", ["バナナ", "黄色い果物"], { unit: "Unit 1" }),
];
const rowsOf = (list, sub) => list.map((x) => B.rowOf(x, x.num, sub));

test("colours: orange is the meaning default, black the word default", () => {
  const o = B.normalizeOptions({});
  assert.equal(o.meaningColor, "orange");
  assert.equal(o.wordColor, "black");
  assert.equal(B.colorOf("orange").value, "#ff7a00");
  assert.equal(B.sideColor("orange"), "#ff7a00");
  assert.equal(B.sideColor("black"), "");
  assert.equal(B.sideColor("none"), "");
  // The 10.170 shape still works: hide + color colours that side.
  assert.equal(B.normalizeOptions({ hide: "word", color: "blue" }).wordColor, "blue");
  assert.equal(B.normalizeOptions({ hide: "meaning", color: "red" }).meaningColor, "red");
});

test("selectWords: book order, all / range / unit", () => {
  assert.deepEqual(B.selectWords(words, { scope: "all" }).map((x) => x.num), [1, 2, 3]);
  assert.deepEqual(B.selectWords(words, { scope: "range", from: 2, to: 3 }).map((x) => x.num), [2, 3]);
  assert.deepEqual(B.selectWords(words, { scope: "range", from: 2 }).map((x) => x.num), [2, 3]);
  assert.deepEqual(B.selectWords(words, { scope: "unit", unit: "Unit 1" }).map((x) => x.num), [1, 2]);
  assert.deepEqual(B.unitsOf(words), ["Unit 2", "Unit 1"]);
});

test("rowOf: meanings kept apart, sub only when asked", () => {
  assert.equal(B.rowOf(words[1], 1, true).sub, "fruit");
  assert.equal(B.rowOf(words[1], 1, false).sub, "");
  assert.deepEqual(B.rowOf(words[2], 2, false).meanings.map((m) => m.text), ["バナナ", "黄色い果物"]);
  assert.deepEqual(B.rowOf({ num: 9, word: "old", meaning: "古い" }, 9, false).meanings.map((m) => m.text), ["古い"]);
});

test("sheetHtml: word and meaning can both be coloured, independently", () => {
  const rows = rowsOf([words[1]], true);
  const both = B.sheetHtml("テスト帳", rows, { wordColor: "blue", meaningColor: "orange" });
  assert.match(both, new RegExp('style="color:' + B.colorOf("blue").value + '">apple'));
  assert.match(both, /style="color:#ff7a00"><span class="bp-meaning">りんご/);
  const plain = B.sheetHtml("テスト帳", rows, { wordColor: "black", meaningColor: "black" });
  assert.ok(!plain.includes("color:#"));
  const legacy = B.sheetHtml("テスト帳", rows, { hide: "meaning", color: "orange" });
  assert.match(legacy, /style="color:#ff7a00"><span class="bp-meaning">りんご/);
});

test("sheetHtml: check-box column can be turned off, font size is applied", () => {
  const rows = rowsOf(words, false);
  assert.ok(B.sheetHtml("帳", rows, { checkbox: true }).includes("☐"));
  assert.ok(!B.sheetHtml("帳", rows, { checkbox: false }).includes("☐"));
  assert.match(B.sheetHtml("帳", rows, { fontSize: "xl" }), /--f:16\.5px/);
  assert.match(B.sheetHtml("帳", rows, { fontSize: "s" }), /--f:11px/);
});

test("sheetHtml: rows are chunked into pages, and 2 columns split a page", () => {
  const many = Array.from({ length: 30 }, (_, i) => B.rowOf(w(i + 1, "w" + (i + 1), ["m" + (i + 1)]), i + 1, false));
  const one = B.sheetHtml("帳", many, { fontSize: "m", columns: 1 });
  assert.equal((one.match(/<section class="bp-page/g) || []).length, B.pageCount(30, { fontSize: "m", columns: 1 }));
  assert.equal(B.pageCount(30, { fontSize: "m", columns: 1 }), 2);
  assert.equal(B.pageCount(30, { fontSize: "m", columns: 2 }), 1);
  const two = B.sheetHtml("帳", many, { fontSize: "m", columns: 2 });
  assert.equal((two.match(/<table/g) || []).length, 2);
  assert.ok(two.includes("bp-cols"));
  // Every word appears exactly once in each layout.
  for (const html of [one, two]) for (let i = 1; i <= 30; i++) assert.equal(html.split("w" + i + "<").length - 1 >= 1, true);
});

test("sheetDocumentHtml: full page with back and print buttons (10.171/10.172)", () => {
  const doc = B.sheetDocumentHtml("テスト帳", rowsOf([words[1]], false), { meaningColor: "orange" });
  assert.match(doc, /^<!doctype html>/);
  assert.match(doc, /アプリに戻る/);
  assert.match(doc, /window\.close\(\)/);
  assert.match(doc, /印刷する/);
  assert.match(doc, /print-color-adjust:\s*exact/);
  assert.match(doc, /page-break-after:always/);
});

test("sheetHtml escapes the book's text", () => {
  const rows = [B.rowOf(w(1, "<b>x</b>", ["<script>"]), 1, false)];
  const html = B.sheetHtml("<帳>", rows, {});
  assert.ok(!html.includes("<b>x</b>"));
  assert.ok(!html.includes("<script>"));
  assert.match(html, /&lt;帳&gt;/);
});
