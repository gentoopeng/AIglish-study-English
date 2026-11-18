const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  R = require("../word-relations.js");

test("links: this book's by number, another book's with its id and word; not itself, not twice, at most 20", () => {
  assert.deepEqual(R.cleanLinks([{ num: 2, kind: "syn" }, { num: 2, kind: "ant" }, { num: 1, kind: "syn" }, { num: 1, kind: "rel", book: "other", word: " follow " }, { num: 5, kind: "odd" }], 1, "mine"), [
    { num: "2", kind: "syn" },
    { num: "1", kind: "rel", book: "other", word: "follow" },
    { num: "5", kind: "rel" },
  ]);
  // A link "to another book" that is this book is a link inside it.
  assert.deepEqual(R.cleanLinks([{ num: 3, kind: "syn", book: "mine", word: "x" }], 1, "mine"), [{ num: "3", kind: "syn" }]);
  assert.equal(R.cleanLinks(Array.from({ length: 30 }, (_, i) => ({ num: i + 2, kind: "syn" })), 1).length, 20);
  // A link meant for another book whose id is not readable is dropped (never this book's word with that number).
  assert.deepEqual(R.cleanLinks([{ num: 4, kind: "syn", book: 12 }, { num: 5, kind: "syn", book: "x".repeat(200) }], 1), []);
});

test("related words: a text and a kind, not the word itself, not twice (letter case aside)", () => {
  assert.deepEqual(R.cleanRelated([{ text: " comply ", kind: "syn" }, "Comply", { text: "FOLLOW", kind: "ant" }, { text: "", kind: "syn" }, "guide"], "follow"), [
    { text: "comply", kind: "syn" },
    { text: "guide", kind: "rel" },
  ]);
});

test("an import line's relations: names by kind, a book word a link both ways, any other a related word", () => {
  assert.equal(R.isRelationField("同=obey"), true);
  assert.equal(R.isRelationField("例文・follow me"), false);
  assert.deepEqual(R.parseRelationField("同=follow,obey 反=lead 関＝leader、guide"), [
    { name: "follow", kind: "syn" },
    { name: "obey", kind: "syn" },
    { name: "lead", kind: "ant" },
    { name: "leader", kind: "rel" },
    { name: "guide", kind: "rel" },
  ]);
  assert.deepEqual(R.parseRelationField("同義語=a 反意語=b 関連=c"), [{ name: "a", kind: "syn" }, { name: "b", kind: "ant" }, { name: "c", kind: "rel" }]);
  const words = [{ num: 1, word: "follow" }, { num: 2, word: "obey" }, { num: 3, word: "lead", links: [{ num: "9", kind: "rel", book: "other", word: "x" }] }];
  assert.deepEqual(R.applyNames(words, 1, [{ name: "Obey", kind: "syn" }, { name: "comply", kind: "syn" }, { name: "lead", kind: "ant" }]), { links: 2, related: 1 });
  assert.deepEqual(words[0].links, [{ num: "2", kind: "syn" }, { num: "3", kind: "ant" }]);
  assert.deepEqual(words[0].related, [{ text: "comply", kind: "syn" }]);
  assert.deepEqual(words[1].links, [{ num: "1", kind: "syn" }]);
  // Another book's link on the other word stays.
  assert.deepEqual(words[2].links, [{ num: "9", kind: "rel", book: "other", word: "x" }, { num: "1", kind: "ant" }]);
});

test("where a word is used: in words, meanings or notes of every book, an English word as a word, not the entry itself", () => {
  const books = [
    { id: "a", name: "A", words: [{ num: 1, word: "go" }, { num: 2, word: "good", meaning: "よい" }, { num: 3, word: "leave", meanings: [{ text: "去る" }], sub: "例文・go away と比べる" }] },
    { id: "b", name: "B", words: [{ num: 7, word: "go on", meaning: "続ける" }, { num: 8, word: "x", meaning: "to go out" }] },
  ];
  const found = R.findUses("go", books, { book: "a", num: 1 });
  assert.deepEqual(found.map((f) => [f.book, f.num, f.where]), [["a", 3, "補足"], ["b", 7, "単語"], ["b", 8, "意味"]]);
  assert.match(found[0].snippet, /go away/);
  // Japanese is matched as a part of the text.
  assert.deepEqual(R.findUses("続け", books).map((f) => f.num), [7]);
  assert.deepEqual(R.findUses("", books), []);
});
