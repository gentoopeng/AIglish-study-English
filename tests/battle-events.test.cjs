const test = require("node:test"),
  assert = require("node:assert/strict"),
  m = require("../word-duel-model");
const words = m.pool(
  Array.from({ length: 20 }, (_, i) => ({ word: "w" + i, meaning: "m" + i })),
);
function room(type, a = [], b = [], opts = {}) {
  const seed = opts.seed ?? 1,
    log = (items) =>
      items.map((item, i) => {
        const [at, right = true, shownAt] = item,
          correct = m.question(words, seed, i).correct;
        return {
          at,
          choice: right ? correct : (correct + 1) % 10,
          ...(shownAt === undefined ? {} : { shownAt }),
        };
      });
  return {
    pool: words,
    seed,
    duration: 45000,
    missPenalty: 100,
    rules: {
      ...m.defaultRules,
      combo: 1,
      answerBonus: 0,
      events: true,
      eventTypes: [type],
      eventSeconds: 8,
      eventPoints: 40,
      ...opts.rules,
    },
    players: { a: { answers: log(a) }, b: { answers: log(b) } },
  };
}
const total = (r, t) =>
  Object.values(m.roomScores(r, false, t)).map((x) => x.total);
test("30 unique, explained events and a gentle recommended preset", () => {
  assert.equal(m.eventCatalog.length, 30);
  assert.equal(new Set(m.eventTypes).size, 30);
  assert.equal(new Set(m.eventCatalog.map((x) => x.group)).size, 5);
  assert.ok(m.recommendedEvents.length > 8);
  assert.ok(!m.recommendedEvents.includes("reset"));
  for (const event of m.eventCatalog) {
    assert.ok(event.name && event.description);
    assert.equal(
      m.validRules({ ...m.defaultRules, eventTypes: [event.id], events: true }),
      true,
    );
  }
  assert.equal(
    m.validRules({ ...m.defaultRules, eventTypes: ["missing"] }),
    false,
  );
});
for (const [type, a, b, expected] of [
  ["steal", [[16000], [17000]], [[1000]], [280, 20]],
  ["chase", [[16000], [17000]], [[1000]], [400, 100]],
  ["pressure", [], [[1000], [16000, false]], [0, -100]],
  ["comeback", [[16000]], [[1000]], [300, 100]],
  ["hunt", [[16000]], [[1000]], [100, 60]],
  ["lead", [], [[1000], [16000]], [0, 240]],
  ["streak", [[16000], [16400], [16800]], [], [340, 0]],
  ["perfect", [[16000], [16400], [16800]], [], [340, 0]],
  ["first", [[16000]], [[17000]], [140, 100]],
  ["last", [[16000], [21000]], [], [240, 0]],
  [
    "speed",
    [
      [16000, true, 15000],
      [20000, true, 16300],
    ],
    [],
    [240, 0],
  ],
  ["careful", [[16000], [17000, false]], [], [-160, 0]],
  ["safe", [[1000], [16000, false]], [], [100, 0]],
  ["risk", [[16000], [16400]], [], [400, 0]],
  [
    "shield",
    [
      [24000, false],
      [28000, false],
    ],
    [],
    [-100, 0],
  ],
  ["share", [[16000]], [], [100, 20]],
  [
    "cooperate",
    [[16000], [16400], [16800]],
    [[17000], [17400], [17800]],
    [340, 340],
  ],
  ["collective", [[16000, false]], [], [-140, -40]],
  ["bank", [[16000], [16400]], [], [200, 0]],
])
  test(type + " has its specified effect in deterministic replay", () => {
    const r = room(type, a, b);
    assert.deepEqual(total(r), expected);
    assert.deepEqual(
      m.roomScores(r),
      m.roomScores({ ...r, players: { b: r.players.b, a: r.players.a } }),
    );
  });
test("combo acceleration, protection, cashout and fixed points respect combo state", () => {
  let r = room("comboBoost", [[16000], [16400]], [], { rules: { combo: 1.1 } });
  assert.equal(m.roomScores(r).a.total, 220);
  assert.equal(m.roomScores(r).a.combo, 4);
  r = room("comboGuard", [[1000], [16000, false], [19500]], [], {
    rules: { combo: 1.1 },
  });
  assert.equal(m.roomScores(r).a.total, 110);
  assert.equal(m.roomScores(r).a.combo, 2);
  r = room("comboCashout", [[1000], [1400]], [], { rules: { combo: 1.1 } });
  assert.equal(m.roomScores(r, false, 16000).a.total, 290);
  assert.equal(m.roomScores(r).a.combo, 0);
  r = room("fixed", [[1000], [1400], [16000]], [], { rules: { combo: 1.1 } });
  assert.equal(m.roomScores(r).a.total, 310);
});
test("counter persists into a later attack and reflects once without a recursion loop", () => {
  let seed = 0;
  for (; seed < 10000; seed++) {
    const rules = {
      ...m.defaultRules,
      events: true,
      eventTypes: ["counter", "attack"],
    };
    if (
      m.eventAt(seed, 15000, rules).type === "counter" &&
      m.eventAt(seed, 30000, rules).type === "attack"
    )
      break;
  }
  assert.ok(seed < 10000);
  const r = room("counter", [[31000]], [], {
    seed,
    rules: { eventTypes: ["counter", "attack"] },
  });
  assert.deepEqual(total(r, 32000), [80, -40]);
});
test("challenge and bank awards wait for the window to end, including at match end", () => {
  for (const type of ["perfect", "bank"]) {
    const r = room(type, [[16000], [16400], [16800]]);
    assert.deepEqual(total(r, 22999), [type === "bank" ? 0 : 300, 0]);
    assert.deepEqual(total(r, 23000), [type === "bank" ? 300 : 340, 0]);
    r.duration = 20000;
    assert.deepEqual(total(r, 19999), [type === "bank" ? 0 : 300, 0]);
    assert.deepEqual(
      Object.values(m.roomScores(r, true)).map((x) => x.total),
      [type === "bank" ? 300 : 340, 0],
    );
  }
  const failed = room("perfect", [[16000], [16400, false], [20000]]);
  assert.equal(m.roomScores(failed).a.total, 100);
});
test("first, streak and cooperation bonuses award at most once per event window", () => {
  assert.deepEqual(
    total(room("first", [[16000], [16400]], [[17000]])),
    [240, 100],
  );
  assert.deepEqual(
    total(room("streak", [[16000], [16400], [16800], [17200], [17600]])),
    [540, 0],
  );
  assert.deepEqual(
    total(
      room(
        "cooperate",
        [[16000], [16400], [16800], [18000]],
        [[17000], [17400], [17800], [18400]],
      ),
    ),
    [440, 440],
  );
});
test("risk penalty, reset shield and rank ties have defined outcomes", () => {
  assert.deepEqual(total(room("risk", [[16000, false], [19500]])), [-200, 0]);
  assert.deepEqual(total(room("comeback", [[16000]], [[17000]])), [300, 300]);
  assert.deepEqual(total(room("chase", [[16000]], [[17000]])), [100, 100]);
});
test("event previews are deterministic and never announce an event after match end", () => {
  const rules = {
    ...m.defaultRules,
    events: true,
    eventTypes: m.recommendedEvents,
  };
  assert.equal(m.eventPreview(1, 11999, rules), null);
  assert.equal(m.eventPreview(1, 12000, rules).start, 15000);
  assert.equal(
    m.eventPreview(1, 12000, rules).type,
    m.eventAt(1, 15000, rules).type,
  );
  assert.equal(m.eventPreview(1, 12000, rules, 15000), null);
  assert.equal(m.eventAt(1, 14999, rules), null);
});
test("speed timestamps cannot precede the prior answer or exceed the answer time", () => {
  const r = room("speed", [[16000, true, 17000]]);
  assert.throws(() => m.roomScores(r));
  const s = room("speed", [
    [16000, true, 15000],
    [16400, true, 14000],
  ]);
  assert.throws(() => m.roomScores(s));
});
test("ending solo early cannot award future perfect, bank or combo-cashout windows", () => {
  for (const type of ["perfect", "bank", "comboCashout"]) {
    const r = room(type, [[1000], [1400], [1800]]);
    const early = m.finalScore(
      words,
      r.seed,
      r.players.a.answers,
      r.duration,
      r.missPenalty,
      r.rules,
      5000,
    );
    assert.equal(early.total, 300);
  }
});
test("early solo finish pays already-earned bank points without awarding an unfinished perfect challenge", () => {
  for (const type of ["bank", "perfect"]) {
    const r = room(type, [[16000], [16400], [16800]]);
    const early = m.finalScore(
      words,
      r.seed,
      r.players.a.answers,
      r.duration,
      r.missPenalty,
      r.rules,
      18000,
    );
    assert.equal(early.total, 300);
  }
});
