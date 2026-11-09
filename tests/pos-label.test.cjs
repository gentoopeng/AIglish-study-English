// The flashcard's part-of-speech label (game_core.js getFlashcardPartOfSpeech): the usual ways a part of speech is stored.
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const source = fs.readFileSync(require("node:path").join(__dirname, "..", "game_core.js"), "utf8");
const start = source.indexOf("window.getFlashcardPartOfSpeech = function"),
  end = source.indexOf("return null;\n    };", start) + "return null;\n    };".length;
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source.slice(start, end), sandbox);
const label = (meaning, word = {}) => sandbox.window.getFlashcardPartOfSpeech(word, meaning)?.short ?? null;
test("short and full names, English abbreviations, lists", () => {
  assert.equal(label({ partOfSpeech: "動" }), "動");
  assert.equal(label({ partOfSpeech: "名詞" }), "名");
  assert.equal(label({ pos: "verb" }), "動");
  assert.equal(label({ partOfSpeech: "v." }), "動");
  assert.equal(label({ partOfSpeech: "adj" }), "形");
  assert.equal(label({ partOfSpeech: "名詞・動詞" }), "名・動");
  assert.equal(label({ partOfSpeech: "noun, verb" }), "名・動");
  assert.equal(label({}, { partOfSpeech: "副詞" }), "副", "the word's own value when the meaning has none");
  assert.equal(label({ text: "走る" }), null);
});
test("brackets, colons and dotted abbreviations around the label do not hide it", () => {
  for (const value of ["(動)", "（動詞）", "【名】", "[名詞]", "〔形〕", "〈副〉", "動詞:", "n.", "v.t.", "vt.", "<verb>"]) assert.notEqual(label({ partOfSpeech: value }), null, value);
  assert.equal(label({ partOfSpeech: "【名詞】" }), "名");
  assert.equal(label({ partOfSpeech: "v.t." }), "動");
});
