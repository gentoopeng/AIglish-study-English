const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../sugoroku-model.js");

const seq = (values) => {
  let i = 0;
  return (n) => values[i++ % values.length] % n;
};
// mulberry32: small and evenly spread.
const rng = (seed) => (n) => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
};

test("a card holds 1-24 once each with the middle free", () => {
  const s = S.newState(rng(1));
  assert.equal(s.card[S.FREE], 0);
  assert.deepEqual([...s.card].sort((a, b) => a - b), Array.from({ length: 25 }, (_, i) => i));
  assert.deepEqual(s.marks.map((m, i) => m === (i === S.FREE)), Array(25).fill(true));
  assert.ok(S.valid(s));
  assert.ok(!S.valid({ ...s, pos: 24 }));
});

test("a roll moves the piece, marks the square's number and pays the square", () => {
  // Card shuffle first (23 draws), then the die: 3 lands on square 3 (pt ×0.5).
  const s = S.newState(seq([0]));
  const out = S.roll(s, 50, seq([2]));
  assert.equal(out.state.pos, 3);
  assert.equal(out.state.marks[out.state.card.indexOf(4)], true);
  assert.equal(out.gain, 25);
  assert.equal(out.state.bet, 50);
  assert.equal(out.state.stake, 50);
  assert.deepEqual(out.events.filter((e) => e.t === "step").map((e) => e.to), [1, 2, 3]);
  assert.throws(() => S.roll(s, 7, seq([0])));
  // The state passed in is left as it was.
  assert.equal(s.pos, 0);
});

test("again rolls for free and go moves on, marking where it lands", () => {
  const s = S.newState(seq([0]));
  // 6 lands on again, then 5 lands on square 11 (go 3) and on to 14.
  const out = S.roll(s, 10, seq([5, 4]));
  assert.deepEqual(out.events.filter((e) => e.t === "die").map((e) => [e.value, e.free]), [[6, false], [5, true]]);
  assert.equal(out.state.pos, 14);
  for (const n of [7, 12, 15]) assert.equal(out.state.marks[out.state.card.indexOf(n)], true);
  assert.equal(out.state.bet, 10);
});

test("passing START pays a lap", () => {
  const s = { ...S.newState(seq([0])), pos: 22 };
  const out = S.roll(s, 100, seq([2]));
  assert.equal(out.state.pos, 1);
  assert.deepEqual(out.events.find((e) => e.t === "lap"), { t: "lap", amount: 30 });
  assert.equal(out.state.laps, 1);
});

// The top row marked but its last cell, which holds 3: square 2 (plain), one step from square 1.
function lineReady() {
  const s = S.newState(seq([0])),
    row = S.LINES[0],
    at = s.card.indexOf(3);
  [s.card[at], s.card[row[4]]] = [s.card[row[4]], 3];
  for (const c of row.slice(0, 4)) s.marks[c] = true;
  s.pos = 1;
  return s;
}

test("a new line spins on what was bet since the last line", () => {
  const s = lineReady();
  s.stake = 990;
  // Die 1 onto the plain square, then the roulette's slot 8 (×1).
  const out = S.roll(s, 10, seq([0, 8]));
  const line = out.events.find((e) => e.t === "line");
  assert.ok(line);
  const spin = out.events.find((e) => e.t === "spin");
  assert.equal(spin.base, 1000);
  assert.equal(out.state.stake, 0);
  assert.equal(spin.amount, 1000);
  assert.equal(out.gain, 1000);
  assert.ok(out.state.lines.includes(line.line));
});

test("the jackpot chance leads on, and a jackpot empties its pool to the seed", () => {
  const s = lineReady();
  s.jp = 5000;
  // Die 1, then wheel 1 slot 9 (chance), wheel 2 slot 8 (jackpot).
  const out = S.roll(s, 10, seq([0, 9, 8]));
  const jackpot = out.events.find((e) => e.t === "jackpot");
  assert.deepEqual(jackpot, { t: "jackpot", kind: "jp", amount: 5000 });
  assert.equal(out.state.jp, S.RULES.pool.jpSeed);
  assert.equal(out.state.jpWins, 1);
});

test("a full card starts a new one and the game returns a bit less than is bet", () => {
  const random = rng(7);
  let s = S.newState(random),
    bet = 0,
    won = 0;
  for (let i = 0; i < 200000; i++) {
    const out = S.roll(s, 10, random);
    for (const e of out.events) assert.ok(e.t !== "step" || (e.to >= 0 && e.to < S.SIZE));
    s = out.state;
    bet += 10;
    won += out.gain;
  }
  assert.ok(s.cards > 1000, "cards are finished and started again");
  assert.ok(S.valid(s));
  const rate = won / bet;
  assert.ok(rate > 0.85 && rate < 0.97, "return " + rate);
});
