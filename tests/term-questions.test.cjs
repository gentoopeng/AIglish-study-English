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
  const line = t.parseLine("１８６８年　明治維新");
  assert.deepEqual([line.year, line.body, line.terms, line.when.kind, line.when.label, line.when.value], ["1868", "明治維新", [], "year", "1868年", 1868]);
  assert.equal(t.parseLine("明治維新").when, null);
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
  // English on the first line and Japanese below is a phrase line even without 「」: the whole
  // English line is asked, and there is no "which headword?" card.
  const bare = one("consider", "considering\nVしようかと思う");
  assert.deepEqual(bare.map((q) => [q.key, q.front, q.back, q.reverse]), [["t:1-0:0", "considering", "Vしようかと思う", { front: "consider\nVしようかと思う", back: "considering" }]]);
  // A Japanese-only line still gets its "which headword?" card.
  assert.deepEqual(one("consider", "〜を考慮する").map((q) => q.key), ["w"]);
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

test("a 「」 card asks the line with the term blanked; the term is the answer", () => {
  const word = {
    num: 40,
    word: "蘇我馬子",
    meanings: [{ id: "40-0", text: "「大臣」の官職につき「大連」の官職であった物部守屋を滅ぼした人物" }],
  };
  const cards = t.questions(word).filter((q) => q.kind === "blank");
  // No card faces of its own: shown as prompt (front) → answer (back), whatever the direction.
  assert.deepEqual(
    cards.map((q) => [q.front, q.prompt, q.answer]),
    [
      [undefined, "蘇我馬子　（＿＿）の官職につき大連の官職であった物部守屋を滅ぼした人物", "大臣"],
      [undefined, "蘇我馬子　大臣の官職につき（＿＿）の官職であった物部守屋を滅ぼした人物", "大連"],
    ],
  );
});

test("a line can start with a century or an era, and each gives its own question", () => {
  const c = t.parseLine("12世紀 「鎌倉幕府」が成立");
  assert.deepEqual([c.year, c.when.kind, c.when.label, c.when.answer, c.when.value, c.body], ["", "century", "12世紀", "12", 1101, "「鎌倉幕府」が成立"]);
  const bc = t.parseLine("紀元前３世紀 ローマの拡大");
  assert.deepEqual([bc.when.label, bc.when.answer, bc.when.value, bc.when.prefix], ["紀元前3世紀", "3", -299, "紀元前"]);
  assert.equal(t.parseLine("前3世紀 x").when.label, "紀元前3世紀");
  const e = t.parseLine("平安時代 摂関政治が行われた");
  assert.deepEqual([e.when.kind, e.when.label, e.when.value, e.body], ["era", "平安時代", 794, "摂関政治が行われた"]);
  // Only an era written with 時代 counts; a line that happens to start with an era's name does not.
  assert.equal(t.parseLine("明治維新で近代化が進んだ").when, null);
  assert.equal(t.parseLine("明治時代 文明開化").when.label, "明治時代");
  assert.equal(t.parseLine("0世紀 x").when, null);
  // A century is asked as its number (typed, like a year); an era is a card (not typed).
  const qs = t.questions({ num: 1, word: "源頼朝", meanings: [{ id: "1-0", text: "12世紀 「鎌倉幕府」を開いた" }, { id: "1-1", text: "鎌倉時代 初代将軍" }] });
  assert.deepEqual(qs.map((q) => [q.key, q.kind, q.input]), [["w:1-0", "whole", false], ["c:1-0", "year", true], ["t:1-0:0", "blank", false], ["w:1-1", "whole", false], ["e:1-1", "era", false]]);
  assert.equal(qs[0].prompt, "12世紀 鎌倉幕府を開いた");
  assert.equal(qs[1].prompt, "源頼朝：鎌倉幕府を開いた（何世紀？）");
  assert.deepEqual([qs[1].answer, qs[1].unit, qs[1].prefix], ["12", "世紀", ""]);
  assert.equal(qs[2].prompt, "源頼朝　12世紀　（＿＿）を開いた");
  assert.equal(qs[4].prompt, "源頼朝：初代将軍（何時代？）");
  assert.equal(qs[4].answer, "鎌倉時代");
  assert.equal(t.questions({ num: 2, word: "x", meanings: [{ id: "2-0", text: "紀元前3世紀 ローマ" }] })[1].prompt, "x：ローマ（紀元前何世紀？）");
  assert.equal(t.correctYear("１２", qs[1].answer), true);
  assert.equal(t.correctYear("13", qs[1].answer), false);
});

test("the box for a 'when' accepts a year, a century or an era and gives the text a line starts with", () => {
  const w = t.whenText;
  assert.deepEqual(["1582", "１５８２年", "12世紀", "１２ 世紀", "前3世紀", "紀元前3世紀", "平安", "平安時代", "安土桃山", ""].map(w), ["1582", "1582", "12世紀", "12世紀", "紀元前3世紀", "紀元前3世紀", "平安時代", "平安時代", "安土桃山時代", ""]);
  assert.deepEqual(["abc", "12世", "13世紀と", "0世紀", "時代", "平安時代の"].map(w), [null, null, null, null, null, null]);
});

test("a century or an era stays whole when the question is shown", () => {
  const keep = (text) => t.pieces(text).filter((p) => p.keep).map((p) => p.text);
  assert.deepEqual(keep("源頼朝：鎌倉幕府を開いた（何世紀？）"), ["源頼朝", "（何世紀？）"]);
  assert.deepEqual(keep("源頼朝　12世紀　（＿＿）を開いた"), ["源頼朝", "12世紀", "（＿＿）"]);
  assert.deepEqual(keep("x：ローマ（紀元前何世紀？）"), ["x", "（紀元前何世紀？）"]);
  assert.ok(keep("鎌倉時代 初代将軍").includes("鎌倉時代"));
});
