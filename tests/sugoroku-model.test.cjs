const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../sugoroku-model.js");
const C = require("../casino-model.js");

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
const at = (kind, from = 1) => {
  for (let i = from; i < S.SIZE; i++) if (S.kindAt(i) === kind) return i;
};

test("the board, card and wheels have the agreed shape", () => {
  assert.equal(S.SIZE, 50);
  assert.equal(S.kindAt(0), "start");
  const s = S.newState(rng(1));
  assert.equal(s.card.length, 49);
  assert.equal(s.card[S.FREE], 0);
  assert.deepEqual([...s.card].sort((a, b) => a - b), Array.from({ length: 49 }, (_, i) => i));
  assert.equal(S.LINES.length, 16);
  for (const cost of S.RULES.costs) {
    const values = new Set(S.RULES.normal[cost].map((x) => x.x));
    for (const x of [3, 2, 1.5, 1.25, 0.75, 0.5, 0.25, 0.1, 0]) assert.ok(values.has(x), cost + " has ×" + x);
  }
  // Bigger bets carry more ball slots on the same die.
  const balls = (cost) => S.RULES.normal[cost].filter((x) => x.ball).length;
  assert.ok(balls(10) < balls(50) && balls(50) < balls(100));
  // The chance and jackpot slots are one in ten.
  assert.equal(S.RULES.wheels.bingo.filter((x) => x.next === "jp").length / S.RULES.wheels.bingo.length, 0.1);
  assert.equal(S.RULES.wheels.jp.filter((x) => x.jackpot === "jp").length / S.RULES.wheels.jp.length, 0.1);
  assert.equal(S.RULES.wheels.jp.filter((x) => x.next === "sjp").length / S.RULES.wheels.jp.length, 0.1);
  assert.equal(S.RULES.wheels.sjp.filter((x) => x.jackpot === "sjp").length / S.RULES.wheels.sjp.length, 0.1);
});

test("a normal square spins its wheel on the bet; a ball slot opens a number", () => {
  const s = S.newState(seq([0]));
  const square = at("normal");
  s.pos = square - 1;
  const wheel = S.RULES.normal[50],
    ballAt = wheel.findIndex((x) => x.ball);
  const out = S.roll(s, 50, seq([0, ballAt, 0]));
  assert.equal(out.state.pos, square);
  const spin = out.events.find((e) => e.t === "wheel");
  assert.equal(spin.wheel, "normal");
  assert.equal(out.gain, 50);
  assert.equal(out.events.filter((e) => e.t === "ball").length, 1);
  assert.equal(out.state.marks.filter(Boolean).length, 2);
  assert.equal(out.state.stake, 50);
  assert.throws(() => S.roll(s, 7, seq([0])));
});

test("passing START gives a lap prize that does not depend on the bet, and a ball", () => {
  const s = { ...S.newState(seq([0])), pos: 48 };
  const small = S.roll(s, 10, seq([2, 0, 0])),
    big = S.roll(s, 100, seq([2, 0, 0]));
  const lap = (out) => out.events.find((e) => e.t === "lap");
  assert.deepEqual(lap(small), { t: "lap", laps: 1, amount: S.RULES.lap(1) });
  assert.equal(lap(big).amount, lap(small).amount);
  assert.ok(small.events.some((e) => e.t === "ball"));
  assert.ok(S.RULES.lap(10000) <= 20 && S.RULES.lap(100) > S.RULES.lap(1));
});

test("an event square waits for its game; win, push and loss pay as agreed", () => {
  const s = S.newState(seq([0]));
  const square = at("event");
  s.pos = square - 1;
  // Die 1 onto the event, then the event wheel's first choice (blackjack).
  const out = S.roll(s, 100, seq([0, 0]));
  assert.deepEqual(out.state.pending, { game: "blackjack", bet: 100 });
  assert.equal(out.gain, 0);
  assert.throws(() => S.roll(out.state, 100, seq([0])));
  const win = S.settle(out.state, 1, seq([0]));
  assert.equal(win.gain, 200);
  assert.equal(win.state.pending, null);
  assert.equal(win.events.filter((e) => e.t === "ball").length, 1);
  assert.equal(S.settle(out.state, 1.5, seq([0])).events[0].amount, 250);
  assert.equal(S.settle(out.state, 0, seq([0])).gain, 100);
  const lose = S.settle(out.state, -2, seq([0]));
  assert.equal(lose.gain, 50);
  assert.ok(!lose.events.some((e) => e.t === "ball"));
  // The sure ball: ×1.5 and a ball at once.
  const sure = S.roll(s, 100, seq([0, 3, 0]));
  assert.equal(sure.state.pending, null);
  assert.equal(sure.events.find((e) => e.t === "sure").amount, 150);
  assert.ok(sure.events.some((e) => e.t === "ball"));
});

test("an accident takes up to twice the bet or sends the piece to START", () => {
  const s = S.newState(seq([0]));
  const square = at("accident");
  s.pos = square - 1;
  const take = S.RULES.accident.findIndex((x) => x.take === 2),
    back = S.RULES.accident.findIndex((x) => x.start);
  assert.equal(S.roll(s, 50, seq([0, take])).gain, -100);
  const home = S.roll(s, 50, seq([0, back]));
  assert.equal(home.state.pos, 0);
  assert.equal(home.gain, 0);
});

test("a new line spins the bingo wheel on what was bet since the last line", () => {
  const s = S.newState(seq([0]));
  for (const c of S.LINES[0].slice(0, 6)) s.marks[c] = true;
  // Every other number open too, so the ball can only open the row's last cell.
  for (let i = 0; i < 49; i++) if (!S.LINES[0].includes(i)) s.marks[i] = true;
  s.stake = 900;
  s.pos = at("normal") - 1;
  const ballAt = S.RULES.normal[100].findIndex((x) => x.ball),
    third = S.RULES.wheels.bingo.findIndex((x) => x.x === 0.1);
  const out = S.roll(s, 100, seq([0, ballAt, 0, third]));
  const lines = out.events.filter((e) => e.t === "line");
  assert.ok(lines.length >= 1);
  const spin = out.events.find((e) => e.t === "wheel" && e.wheel === "bingo");
  assert.equal(spin.base, 1000 / lines.length);
  // The card was full, so a new one starts.
  assert.ok(out.events.some((e) => e.t === "complete"));
  assert.equal(out.state.marks.filter(Boolean).length, 1);
});

test("the jackpot wheels lead on and report a jackpot without paying it here", () => {
  const s = S.newState(seq([0]));
  for (const c of S.LINES[0].slice(0, 6)) s.marks[c] = true;
  s.pos = at("normal") - 1;
  const ballAt = S.RULES.normal[10].findIndex((x) => x.ball),
    chance = S.RULES.wheels.bingo.findIndex((x) => x.next === "jp"),
    jp = S.RULES.wheels.jp.findIndex((x) => x.jackpot === "jp");
  // Die, normal wheel (ball), the ball picks the open number at index 0 (the row's last cell).
  const out = S.roll(s, 10, seq([0, ballAt, 0, chance, jp]));
  assert.deepEqual(
    out.events.filter((e) => e.t === "wheel").map((e) => e.wheel),
    ["normal", "bingo", "jp"],
  );
  assert.deepEqual(out.events.find((e) => e.t === "jackpot"), { t: "jackpot", kind: "jp" });
  assert.equal(out.gain, 10);
});

test("played the plain way, every bet returns a little under what goes in", () => {
  const random = rng(11);
  const play = (game) => {
    if (game === "blackjack") {
      let t = C.tableDeal(["me"], { me: 1 }, random);
      while (!t.done) t = C.tableAct(t, "me", C.bjTotal(t.seats.me.hands[0].cards).total < 17 ? "hit" : "stand");
      return C.tableOutcome(t, "me").net;
    }
    if (game === "dice") return C.diceStand(C.diceStart(1, random), random).net;
    const parent = C.chinTurn(random);
    let child = C.chinStart();
    while (!child.done) child = C.chinNext(child, random, C.CHILD_THROWS);
    return C.chinSettle(parent.hand, child.hand);
  };
  for (const cost of S.RULES.costs) {
    let s = S.newState(random),
      bet = 0,
      won = 0;
    for (let i = 0; i < 150000; i++) {
      const out = S.roll(s, cost, random);
      s = out.state;
      bet += cost;
      won += out.gain;
      if (s.pending) {
        const end = S.settle(s, play(s.pending.game), random);
        s = end.state;
        won += end.gain;
      }
    }
    assert.ok(S.valid(s));
    const rate = won / bet;
    assert.ok(rate > 0.88 && rate < 1, cost + ": " + rate);
  }
});
