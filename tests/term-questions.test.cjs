const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  t = require("../term-questions.js");
const nobunaga = {
  num: 7,
  word: "織田信長",
  meanings: [
    { id: "7-0", text: "1582 「本能寺の変」で死亡したとされる人物" },
    { id: "7-1", text: "1575「長篠の戦い」では「武田勝頼」を破った" },
  ],
};

test("one entry gives a whole question per line, then year and blank questions (one blank per 「」)", () => {
  const list = t.questions(nobunaga);
  assert.deepEqual(
    list.map((q) => [q.key, q.prompt, q.answer, q.input]),
    [
      ["w:7-0", "1582年 本能寺の変で死亡したとされる人物", "織田信長", false],
      ["y:7-0", "織田信長：本能寺の変で死亡したとされる人物（何年？）", "1582", true],
      ["t:7-0:0", "織田信長　1582年　（＿＿）で死亡したとされる人物", "本能寺の変", false],
      ["w:7-1", "1575年 長篠の戦いでは武田勝頼を破った", "織田信長", false],
      ["y:7-1", "織田信長：長篠の戦いでは武田勝頼を破った（何年？）", "1575", true],
      ["t:7-1:0", "織田信長　1575年　（＿＿）では武田勝頼を破った", "長篠の戦い", false],
      ["t:7-1:1", "織田信長　1575年　長篠の戦いでは（＿＿）を破った", "武田勝頼", false],
    ],
  );
  // Each question points at the line it came from.
  assert.deepEqual(list.map((q) => q.mid), ["7-0", "7-0", "7-0", "7-1", "7-1", "7-1", "7-1"]);
  // An entry with one line keeps the key "w" its record was saved under.
  assert.deepEqual(t.questions({ num: 8, word: "x", meanings: [{ id: "8-0", text: "「人物」の名" }] }).map((q) => q.key), ["w", "t:8-0:0"]);
});

test("lines without a year or 「」 still give the whole question; empty entries give none", () => {
  assert.deepEqual(
    t.questions({ num: 1, word: "源頼朝", meanings: [{ id: "1-0", text: "鎌倉幕府を開いた" }] }).map((q) => q.kind),
    ["whole"],
  );
  assert.deepEqual(t.questions({ num: 2, word: "", meanings: [{ id: "2-0", text: "1192" }] }), []);
  assert.deepEqual(t.parseLine("１８６８年　明治維新"), { year: "1868", body: "明治維新", terms: [] });
  assert.deepEqual(t.parseLine("57 「漢委奴国王」の金印").year, "57");
});

test("year answers are digits only: full width and 年 are accepted, other text never matches", () => {
  assert.equal(t.normalizeYear("１５８２年"), "1582");
  assert.equal(t.normalizeYear("abc"), "");
  assert.equal(t.correctYear("1582", "1582"), true);
  assert.equal(t.correctYear("１５８２", "1582"), true);
  assert.equal(t.correctYear("1583", "1582"), false);
  assert.equal(t.correctYear("", "1582"), false);
  assert.equal(t.correctYear("0057", "57"), true);
});

test("marker shades follow the card background scale, and results keep a bounded history", () => {
  assert.equal(t.shade([]), null);
  assert.deepEqual(t.shade(["ok"]), [16, 185, 129]);
  assert.deepEqual(t.shade(["bad"]), [239, 68, 68]);
  // ○ and × average to the middle of the scale (yellow); mostly ○ sits between green and yellow.
  assert.deepEqual(t.shade(["ok", "bad"]), [245, 158, 11]);
  const mostly = t.shade(["ok", "ok", "bad"]);
  assert.ok(mostly[0] > 16 && mostly[0] < 245, JSON.stringify(mostly));
  let store = {};
  for (let i = 0; i < 25; i++) store = t.record(store, "7", "y:7-0", i % 2 ? "bad" : "ok", 1000 + i);
  assert.equal(store["7"]["y:7-0"].history.length, 20);
  assert.equal(store["7"]["y:7-0"].status, "ok");
  assert.throws(() => t.record(store, "7", "w", "none"));
});

test("an empty 「」 keeps the numbering of the terms after it", () => {
  const list = t.questions({ num: 3, word: "x", meanings: [{ id: "3-0", text: "「 」と「本題」" }] });
  assert.deepEqual(list.filter((q) => q.kind === "blank").map((q) => [q.key, q.answer, q.prompt]), [["t:3-0:1", "本題", "x　 と（＿＿）"]]);
});
test("a phrase line (English with 「」, then Japanese) gives one card: the English → the Japanese, or the Japanese with the 「」 blanked → the 「」", () => {
  const one = (word, text) => t.questions({ num: 1, word, meanings: [{ id: "1-0", text }] });
  // The 「」 is a word inside a pattern: never asked alone.
  const as = one("consider", "+ A + 「as」 B\nAをBとみなす");
  assert.deepEqual(as.map((q) => q.key), ["t:1-0:0"]);
  // Written with "+", the pattern joins onto the headword on one line.
  assert.equal(as[0].front, "consider A as B");
  assert.equal(as[0].back, "AをBとみなす");
  assert.deepEqual(as[0].reverse, { front: "consider A （＿＿） B\nAをBとみなす", back: "as\nconsider A as B" });
  // A derived word is shown as it is, without the headword above it.
  const derived = one("increase", "「increasingly」\nますます")[0];
  assert.deepEqual([derived.front, derived.back, derived.reverse], ["increasingly", "ますます", { front: "increase\nますます", back: "increasingly" }]);
  const to = one("expect", "「+ to V」\nVするつもりだ")[0];
  assert.deepEqual([to.front, to.back, to.reverse], ["expect to V", "Vするつもりだ", { front: "expect （＿＿）\nVするつもりだ", back: "expect to V" }]);
  // The 「」 is the whole English, on its own line or straight before the Japanese.
  const followed = one("follow", "「A be followed by B」\nAの次にBが続く")[0];
  assert.deepEqual([followed.front, followed.back, followed.reverse], ["A be followed by B", "Aの次にBが続く", { front: "follow\nAの次にBが続く", back: "A be followed by B" }]);
  const following = one("follow", "「following」次の");
  assert.deepEqual(following.map((q) => [q.key, q.front, q.back]), [["t:1-0:0", "following", "次の"]]);
  // A history line (the 「」 is Japanese) keeps its whole, year and blank questions.
  assert.deepEqual(one("織田信長", "1582 「本能寺の変」で死亡").map((q) => q.key), ["w", "y:1-0", "t:1-0:0"]);
});
test("a line set to 「」の問題だけ gives no whole question, but still its 「」 (and year) questions", () => {
  const word = { num: 1, word: "follow", meanings: [{ id: "1-0", text: "〈指示〉に従う" }, { id: "1-1", text: "「following」\n次の", blankOnly: true }, { id: "1-2", text: "続く", blankOnly: true }] };
  assert.deepEqual(t.questions(word).map((q) => q.key), ["w:1-0", "t:1-1:0", "w:1-2"]);
});
