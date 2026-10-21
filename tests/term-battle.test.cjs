const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  m = require("../word-duel-model.js"),
  t = require("../term-questions.js");
// Twelve history entries, each with a year and two 「」 terms: whole, year and blank questions.
const entries = Array.from({ length: 12 }, (_, i) => ({
  num: i + 1,
  word: "人物" + i,
  meanings: [{ id: i + 1 + "-0", text: 1500 + (i % 4) + " 「出来事" + i + "」で「相手" + i + "」を破った" }],
}));
const candidates = entries.flatMap((word) =>
  t.questions(word).map((q) => ({
    word: q.prompt,
    meaning: q.answer,
    kind: q.kind,
    duelRef: { book: "日本史", num: String(word.num), mid: q.mid, sig: "sig" + word.num, count: 1, term: q.key },
  })),
);
const pool = m.pool(candidates, 3);
const find = (kind) => {
  for (let i = 0; i < 300; i++) if (m.question(pool, 3, i).kind === kind) return i;
  throw Error(kind);
};
test("term pools keep years that share a value, and need version 11 rooms", () => {
  assert.equal(pool.length, 12 * 4);
  // Twelve year questions but only four distinct years: all kept, told apart by prompt.
  assert.equal(pool.filter((w) => w.kind === "year").length, 12);
  assert.equal(m.versionFor(pool), 11);
  assert.equal(m.versionFor(pool.filter((w) => !w.kind)), 10);
  const room = {
    version: 11,
    matchType: "casual",
    missPenalty: 50,
    duration: 60000,
    capacity: 2,
    rules: { ...m.defaultRules },
    books: ["日本史"],
    book: "日本史",
    host: "a",
    status: "waiting",
    seed: 3,
    pool,
    players: { a: { answers: [] } },
  };
  assert.equal(m.validRoom(room), true);
  assert.equal(m.validRoom({ ...room, version: 10 }), false);
  assert.equal(m.validRoom({ ...room, pool: pool.map((w) => (w.kind === "year" ? { ...w, meaning: "一五八二" } : w)) }), false);
});
test("choices come from the same kind: headwords for the whole description, terms for blanks", () => {
  for (const kind of ["whole", "blank"]) {
    const q = m.question(pool, 3, find(kind)),
      same = new Set(pool.filter((w) => w.kind === kind).map((w) => w.meaning));
    assert.equal(q.options.length, 10);
    assert.ok(q.options.slice(0, 9).every((text) => same.has(text)), kind + JSON.stringify(q.options));
    assert.equal(new Set(q.options).size, 10);
  }
});
test("year questions are typed: digits right or wrong, 「わからない」 allowed, choices refused", () => {
  const i = find("year"),
    q = m.question(pool, 3, i),
    before = Array.from({ length: i }, (_, j) => {
      const earlier = m.question(pool, 3, j);
      return earlier.typed ? { typed: earlier.meaning, at: j * 10 } : { choice: earlier.correct, at: j * 10 };
    }),
    at = i * 10;
  assert.equal(q.typed, true);
  assert.deepEqual(q.options, []);
  assert.equal(m.isRight(pool, 3, i, { typed: q.meaning }), true);
  assert.equal(m.isRight(pool, 3, i, { typed: "０" + q.meaning }), true);
  assert.equal(m.isRight(pool, 3, i, { typed: "1" }), false);
  assert.equal(m.isRight(pool, 3, i, { choice: m.pass }), false);
  const play = (last) => m.roomScores({ version: 11, pool, seed: 3, duration: 60000, missPenalty: 50, players: { a: { answers: [...before, last] } } }).a;
  const base = play({ typed: q.meaning, at }).total;
  assert.ok(base > play({ typed: "1", at }).total);
  assert.doesNotThrow(() => play({ choice: m.pass, at }));
  assert.throws(() => play({ choice: 0, at }));
  assert.throws(() => play({ typed: "abc", at }));
  // A typed answer to a choice question is refused too.
  const c = find("whole");
  assert.throws(() => m.score(pool, 3, [...Array.from({ length: c }, (_, j) => (m.question(pool, 3, j).typed ? { typed: "1", at: j * 3000 } : { choice: m.question(pool, 3, j).correct, at: j * 3000 })), { typed: "1", at: c * 3000 }]));
  assert.equal(m.yearOf("１５８２年"), "1582");
});
