const test = require("node:test"),
  assert = require("node:assert/strict"),
  m = require("../word-duel-model"),
  v = require("../duel-event-visuals");
function target(type) {
  return {
    id: "me",
    rules: { ...m.defaultRules, eventPoints: 75 },
    room: { players: { me: { name: "自分" }, other: { name: "相手" } } },
    eventInfo: {
      active: {
        type,
        ranks: { me: 1, other: 0 },
        lastRank: 1,
        correct: { me: 2, other: 1 },
        streaks: { me: 2 },
        bank: { me: 220 },
        awarded: {},
        misses: {},
        used: {},
      },
      shields: { me: true },
      counters: {},
    },
  };
}
test("all 30 events have readable effects with the configured point value", () => {
  for (const event of m.eventCatalog) {
    const description = v.describe(target(event.id), { type: event.id });
    assert.equal(description.name, event.name);
    assert.ok(description.description.length > 0);
    assert.ok(!description.description.includes("イベント点"));
    assert.ok(description.detail);
  }
  assert.match(
    v.describe(target("attack"), { type: "attack" }).description,
    /75点/,
  );
  assert.match(
    v.describe(target("share"), { type: "share" }).description,
    /38点/,
  );
});
test("rank effects identify the affected players and avoid claiming that a lone leader can steal from self", () => {
  assert.match(v.describe(target("lead"), { type: "lead" }).detail, /相手/);
  assert.equal(v.describe(target("lead"), { type: "lead" }).eligible, false);
  assert.equal(
    v.describe(target("comeback"), { type: "comeback" }).eligible,
    true,
  );
  const t = target("steal");
  t.eventInfo.active.ranks = { me: 0, other: 1 };
  assert.equal(v.describe(t, { type: "steal" }).eligible, false);
  assert.match(v.describe(t, { type: "steal" }).detail, /なし/);
});
test("challenges, retained defenses and bank show the local state instead of only an event name", () => {
  assert.match(
    v.describe(target("streak"), { type: "streak" }).detail,
    /2 \/ 3/,
  );
  assert.match(
    v.describe(target("cooperate"), { type: "cooperate" }).detail,
    /3 \/ 6/,
  );
  assert.match(v.describe(target("bank"), { type: "bank" }).detail, /220点/);
  assert.match(
    v.describe(target("shield"), { type: "shield" }).detail,
    /保持中/,
  );
  assert.match(
    v.describe(target("counter"), { type: "counter" }).detail,
    /使用済み/,
  );
  const t = target("perfect");
  t.eventInfo.active.misses.me = true;
  assert.match(v.describe(t, { type: "perfect" }).detail, /未達/);
});
test("inspecting the existing scoring pass preserves scores and fixed event ranks", () => {
  const pool = m.pool(
      Array.from({ length: 12 }, (_, i) => ({
        word: "w" + i,
        meaning: "m" + i,
      })),
    ),
    seed = 1,
    room = {
      pool,
      seed,
      duration: 45000,
      missPenalty: 100,
      rules: { ...m.defaultRules, events: true, eventTypes: ["chase"] },
      players: {
        me: {
          answers: [{ at: 16000, choice: m.question(pool, seed, 0).correct }],
        },
        other: {
          answers: [{ at: 1000, choice: m.question(pool, seed, 0).correct }],
        },
      },
    };
  let state;
  const score = m.roomScores(room, false, 17000, (s) => (state = s));
  assert.deepEqual(score, m.roomScores(room, false, 17000));
  assert.deepEqual(state.active.ranks, { me: 1, other: 0 });
  assert.equal(score.me.total, 200);
  let ended;
  m.roomScores(room, false, 24000, (s) => (ended = s));
  assert.equal(ended.active, null);
});
