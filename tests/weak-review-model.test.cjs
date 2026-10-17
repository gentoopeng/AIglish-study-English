const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  m = require("../weak-review-model.js");
const now = Date.parse("2026-10-18T06:00:00Z"),
  yesterday = now - 86400000;
const word = (status = "bad", at = yesterday) => ({
  sig: "same",
  editedAt: at,
  meanings: { a: { status, history: [status] } },
});
test("review days use JST and only dated weaknesses from before today are eligible", () => {
  assert.equal(m.day(Date.parse("2026-10-18T15:00:00Z")), "2026-10-19");
  assert.equal(m.eligible(word(), word().meanings.a, now), true);
  assert.equal(m.eligible(word("bad", now), word().meanings.a, now), false);
  assert.equal(m.eligible({}, { status: "bad" }, now), false);
  assert.equal(m.eligible(word("ok"), word("ok").meanings.a, now), false);
});
test("today freezes the prior weakness; memo changes preserve actual answer date and renderer cannot erase completion", () => {
  const prior = word(),
    incoming = word("ok", now),
    stamped = m.stampWord(prior, incoming, now);
  assert.equal(stamped.meanings.a.review.weak, true);
  assert.equal(m.eligible(stamped, stamped.meanings.a, now), true);
  stamped.meanings.a.review.passed = m.day(now);
  const rendered = word("ok", now),
    saved = m.stampWord(stamped, rendered, now + 1000);
  assert.equal(saved.meanings.a.review.passed, m.day(now));
  assert.equal(saved.meanings.a.review.at, now);
  assert.equal(m.eligible(saved, saved.meanings.a, now), false);
  assert.equal(prior.meanings.a.review, undefined);
});
test("new weaknesses today are not review rewards; reset and changed signatures clear old eligibility", () => {
  const fresh = m.stampWord(undefined, word("bad", now), now);
  assert.equal(m.eligible(fresh, fresh.meanings.a, now), false);
  const reset = m.stampWord(word(), word("none"), now);
  assert.equal(m.eligible(reset, reset.meanings.a, now), false);
  const old = word();
  old.meanings.a.review = { passed: m.day(now) };
  const replaced = m.stampWord(old, { ...word(), sig: "different" }, now);
  assert.equal(replaced.meanings.a.review.passed, undefined);
  assert.equal(m.eligible(replaced, replaced.meanings.a, now), false);
});
test("ten choices are unique and absent-answer position is balanced; small books keep a constant choice count", () => {
  const target = { prompt: "q", meaning: "a", ref: { num: "1" } },
    pool = Array.from({ length: 12 }, (_, i) => ({
      prompt: "q" + i,
      meaning: "a" + i,
    }));
  const positions = [];
  for (let i = 0; i < 20; i++) {
    const q = m.question(target, pool, 123, i);
    positions.push(q.correct);
    assert.equal(q.options.length, 10);
    assert.equal(new Set(q.options).size, 10);
    assert.equal(
      q.correct === 9,
      q.options.slice(0, -1).includes("a") === false,
    );
  }
  assert.deepEqual(positions.slice(0, 10), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (let i = 0; i < 4; i++)
    assert.equal(m.question(target, pool.slice(0, 1), 2, i).options.length, 2);
  assert.throws(() => m.question(target, [target], 1, 0));
});
test("canonical recovery preserves review completion when a renderer omits review fields", () => {
  const vm = require("node:vm"),
    fs = require("node:fs"),
    values = new Map(),
    ctx = {
      myId: "a",
      Date,
      Event: class {},
      localStorage: {
        getItem: (k) => values.get(k) || null,
        setItem: (k, v) => values.set(k, v),
      },
      dispatchEvent() {},
    };
  ctx.window = ctx;
  for (const file of [
    "weak-review-model.js",
    "learning-data.js",
    "word-duel-progress.js",
  ])
    vm.runInNewContext(fs.readFileSync(file, "utf8"), ctx);
  const key = "core_v4_user_vocab_progress_a_book",
    prior = word();
  prior.editedAt = Date.now() - 86400000;
  values.set(key, JSON.stringify({ 1: prior }));
  ctx.WordDuelProgress.apply(
    "book",
    { num: "1", mid: "a", sig: "same", count: 1 },
    true,
    "a",
    { reviewDay: ctx.WeakReviewModel.day() },
  );
  const saved = ctx.LearningData.read("book")["1"];
  assert.equal(saved.meanings.a.review.passed, ctx.WeakReviewModel.day());
  const rendered = JSON.parse(JSON.stringify(saved));
  delete rendered.meanings.a.review;
  rendered.note = "new memo";
  ctx.LearningData.commit("book", { 1: rendered }, "1");
  values.delete(key);
  const restored = ctx.LearningData.read("book")["1"];
  assert.equal(restored.meanings.a.status, "ok");
  assert.equal(restored.meanings.a.review.passed, ctx.WeakReviewModel.day());
  assert.equal(restored.note, "new memo");
});
