const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  F = require("../copy-follow.js");

const w = (num, word, meaning, extra = {}) => ({ num, word, meaning, sub: "", meanings: [{ id: num + "-0", text: meaning }], ...extra });
const same = (t, num) => ({ ...t, num, meanings: (t.meanings || []).map((m, i) => ({ ...m, id: num + "-" + i })) });
const text = (words) => words.map((x) => x.num + ":" + x.word + "=" + x.meaning).join(" | ");

test("a fingerprint changes with the content of a word and not with its number or progress", () => {
  const a = w(1, "apple", "りんご");
  assert.equal(F.fingerprint(a), F.fingerprint({ ...a, num: 9, status: "ok", history: ["ok"], links: [{ num: "2", kind: "syn" }] }));
  assert.notEqual(F.fingerprint(a), F.fingerprint(w(1, "apple", "林檎")));
  assert.notEqual(F.fingerprint(a), F.fingerprint({ ...a, sub: "fruit" }));
  assert.notEqual(F.fingerprint(a), F.fingerprint({ ...a, meanings: [{ id: "1-0", text: "りんご", minor: true }] }));
  assert.notEqual(F.fingerprint(a), F.fingerprint({ ...a, unit: "Unit 1" }));
});

test("a changed word replaces the copy's, a new word is added, a dropped word is dropped (same numbers)", () => {
  const before = [w(1, "a", "あ"), w(2, "b", "び"), w(3, "c", "し")],
    base = F.baseOf(before),
    after = [w(1, "a", "あ！"), w(2, "b", "び"), w(4, "d", "で")];
  const out = F.merge({ base, theirs: after, mine: before, identity: true, makeWord: same });
  assert.equal(text(out.words), "1:a=あ！ | 2:b=び | 4:d=で");
  assert.deepEqual(out.report, { replaced: 1, added: 1, removed: 1, kept: 0, mixed: 0 });
  assert.equal(out.changed, true);
  // The base is now the new original: a second run changes nothing.
  const again = F.merge({ base: out.base, theirs: after, mine: out.words, identity: true, makeWord: same });
  assert.equal(again.changed, false);
  assert.equal(text(again.words), text(out.words));
});

test("what the player changed, added or deleted stays theirs, except a part the original changed too", () => {
  const before = [w(1, "a", "あ"), w(2, "b", "び"), w(3, "c", "し")],
    base = F.baseOf(before),
    // The player rewrote word 1, deleted word 2, and added word 9 of their own.
    mine = [w(1, "a", "わたしの意味"), w(3, "c", "し"), w(9, "mine", "自分の")],
    after = [w(1, "a", "原本の新しい意味"), w(2, "b", "びー"), w(3, "c", "しー")];
  const out = F.merge({ base, theirs: after, mine, identity: true, makeWord: same });
  // Word 1: both changed the meaning: the original's wins. Word 2: deleted by the player: not brought back.
  // Word 3: only the original changed: replaced. Word 9: untouched.
  assert.equal(text(out.words), "1:a=原本の新しい意味 | 3:c=しー | 9:mine=自分の");
  assert.deepEqual(out.report, { replaced: 1, added: 0, removed: 0, kept: 1, mixed: 1 });
  // A word the original drops but the player changed stays.
  const edited = out.words.map((x) => (x.num === 1 ? { ...x, meaning: "また自分で直した", meanings: [{ id: "1-0", text: "また自分で直した" }] } : x));
  const dropped = F.merge({ base: out.base, theirs: [w(3, "c", "しー")], mine: edited, identity: true, makeWord: same });
  assert.equal(text(dropped.words), "1:a=また自分で直した | 3:c=しー | 9:mine=自分の");
  assert.equal(dropped.report.removed, 0);
});

test("a new word of the original whose number the player already uses goes to a number of its own", () => {
  const base = F.baseOf([w(1, "a", "あ")]),
    mine = [w(1, "a", "あ"), w(2, "mine", "自分で足した")],
    out = F.merge({ base, theirs: [w(1, "a", "あ"), w(2, "new", "原本で足した")], mine, identity: true, makeWord: same });
  assert.equal(text(out.words), "1:a=あ | 2:mine=自分で足した | 3:new=原本で足した");
  assert.equal(out.report.added, 1);
  assert.equal(out.base.map[2], "3");
  // Later the original changes that word: it is replaced where it was put, the player's own word 2 is not touched.
  const next = F.merge({ base: out.base, theirs: [w(1, "a", "あ"), w(2, "new", "また変えた")], mine: out.words, identity: true, makeWord: same });
  assert.equal(text(next.words), "1:a=あ | 2:mine=自分で足した | 3:new=また変えた");
  // The same word already there (the player added it too) is not added twice.
  const dup = F.merge({ base: F.baseOf([w(1, "a", "あ")]), theirs: [w(1, "a", "あ"), w(2, "x", "同じ")], mine: [w(1, "a", "あ"), w(2, "x", "同じ")], identity: true, makeWord: same });
  assert.equal(text(dup.words), "1:a=あ | 2:x=同じ");
  assert.equal(dup.report.added, 0);
});

test("a replaced word is given the copy's word it replaces, to keep its own order and links", () => {
  const base = F.baseOf([w(1, "a", "あ")]),
    mine = [w(1, "a", "あ", { no: 5, links: [{ num: "2", kind: "syn" }] })],
    out = F.merge({ base, theirs: [w(1, "a", "あ２")], mine, identity: true, makeWord: (t, num, m) => ({ ...same(t, num), ...(m?.no !== undefined ? { no: m.no } : {}), ...(m?.links ? { links: m.links } : {}) }) });
  assert.equal(out.words[0].meaning, "あ２");
  assert.equal(out.words[0].no, 5);
  assert.deepEqual(out.words[0].links, [{ num: "2", kind: "syn" }]);
});

test("a copy that numbers its words afresh follows through the map", () => {
  // The original has gaps (10, 20, 30); the copy numbered them 1, 2, 3.
  const original = [w(10, "a", "あ"), w(20, "b", "び"), w(30, "c", "し")],
    place = (_, i) => i + 1,
    base = F.baseOf(original, place),
    mine = original.map((x, i) => same(x, i + 1));
  assert.deepEqual(base.map, { 10: "1", 20: "2", 30: "3" });
  // The player edits copy word 2; the original changes 10, 20 and adds 40, drops 30.
  mine[1] = { ...mine[1], meaning: "自分", meanings: [{ id: "2-0", text: "自分" }] };
  const after = [w(10, "a", "あ2"), w(20, "b", "び2"), w(40, "d", "で")];
  const out = F.merge({ base, theirs: after, mine, identity: false, makeWord: same });
  // Word 2 was changed by both (the same part): the original's.
  assert.equal(text(out.words), "1:a=あ2 | 2:b=び2 | 4:d=で");
  assert.deepEqual(out.report, { replaced: 1, added: 1, removed: 1, kept: 0, mixed: 1 });
  assert.equal(out.base.map[40], "4");
  // Ids of a replaced word follow the copy's number.
  assert.equal(out.words[0].meanings[0].id, "1-0");
});

test("with nothing changed in the original the copy is left exactly as it is", () => {
  const original = [w(1, "a", "あ"), w(2, "b", "び")],
    mine = [w(1, "a", "あ"), w(2, "edited", "直した"), w(5, "own", "自分")],
    out = F.merge({ base: F.baseOf(original), theirs: original, mine, identity: true, makeWord: same });
  assert.equal(out.changed, false);
  assert.equal(text(out.words), text(mine));
});

test("both changed one word: each part goes to whoever changed it, and the original's wins where both did", () => {
  const w3 = (num, word, meaning, sub, rowsText) => ({ num, word, meaning, sub, meanings: rowsText.map((x, i) => ({ id: num + "-" + i, text: x })) });
  const before = [w3(1, "apple", "りんご", "", ["りんご", "赤い果物"])],
    base = F.baseOf(before);
  // The player added a sub line and changed the second meaning row; the original changed the first meaning.
  const mine = [w3(1, "apple", "りんご", "fruit", ["りんご", "自分で書いた"])],
    theirs = [w3(1, "apple", "リンゴ", "", ["リンゴ", "赤い果物"])];
  const out = F.merge({ base, theirs, mine, identity: true, makeWord: same });
  assert.equal(out.report.mixed, 1);
  const word = out.words[0];
  // The word's own meaning is made of the mixed rows (as the editor makes it), so a search on it finds the player's text.
  assert.equal(word.meaning, "①リンゴ②自分で書いた");
  assert.equal(word.sub, "fruit");
  assert.deepEqual(word.meanings.map((m) => m.text), ["リンゴ", "自分で書いた"]);
  // Both changed the same row: the original's.
  const same2 = F.merge({ base, theirs: [w3(1, "apple", "りんご", "", ["りんご", "原本の新しい説明"])], mine, identity: true, makeWord: same });
  assert.deepEqual(same2.words[0].meanings.map((m) => m.text), ["りんご", "原本の新しい説明"]);
  assert.equal(same2.words[0].sub, "fruit");
  // The original adds a row; the player's own sub line stays.
  const added = F.merge({ base, theirs: [w3(1, "apple", "りんご", "", ["りんご", "赤い果物", "原本で足した行"])], mine: [w3(1, "apple", "りんご", "fruit", ["りんご", "赤い果物"])], identity: true, makeWord: same });
  assert.deepEqual(added.words[0].meanings.map((m) => m.text), ["りんご", "赤い果物", "原本で足した行"]);
  assert.equal(added.words[0].sub, "fruit");
});

test("an older base that holds no parts: both changed one word, the original's word is taken whole", () => {
  const before = [w(1, "a", "あ")],
    base = F.baseOf(before);
  delete base.pf;
  const out = F.merge({ base, theirs: [w(1, "a", "あ（原本）")], mine: [w(1, "a", "あ（自分）")], identity: true, makeWord: same });
  assert.equal(text(out.words), "1:a=あ（原本）");
  assert.equal(out.report.mixed, 1);
  // The base now holds the parts, so the next time it is told part by part.
  assert.ok(out.base.pf[1]);
});

test("both added a meaning row to the same word: both rows stay, with their own ids", () => {
  const w3 = (num, rowsText) => ({ num, word: "set", meaning: rowsText.join(""), sub: "", meanings: rowsText.map((x, i) => ({ id: num + "-" + i, text: x })) });
  const base = F.baseOf([w3(1, ["置く"])]),
    out = F.merge({ base, theirs: [w3(1, ["置く", "原本で足した"])], mine: [w3(1, ["置く", "自分で足した"])], identity: true, makeWord: same });
  const rowsOut = out.words[0].meanings;
  assert.deepEqual(rowsOut.map((m) => m.text), ["置く", "原本で足した", "自分で足した"]);
  assert.equal(new Set(rowsOut.map((m) => m.id)).size, 3, "ids are different");
  assert.equal(out.words[0].meaning, "①置く②原本で足した③自分で足した");
  // The same row added by both is not doubled.
  const same3 = F.merge({ base, theirs: [w3(1, ["置く", "同じ"])], mine: [w3(1, ["置く", "同じ"])], identity: true, makeWord: same });
  assert.deepEqual(same3.words[0].meanings.map((m) => m.text), ["置く", "同じ"]);
});
