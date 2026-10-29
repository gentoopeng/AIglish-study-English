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
// A ball draws random(100) + 1, so drawing number n takes the value n − 1.
const draw = (n) => n - 1;
const closedOn = (card) => card.cells.find((n, i) => n && !card.owners[i]);
const offCard = (card) => Array.from({ length: 100 }, (_, i) => i + 1).find((n) => !card.cells.includes(n));

test("the board, card and wheels have the agreed shape", () => {
  assert.equal(S.SIZE, 80);
  assert.equal(S.kindAt(0), "start");
  const card = S.newCard(rng(1));
  assert.ok(S.validCard(card));
  assert.equal(card.cells.length, 49);
  assert.equal(card.cells[S.FREE], 0);
  assert.equal(card.owners[S.FREE], "*");
  const numbers = card.cells.filter(Boolean);
  assert.equal(new Set(numbers).size, 48);
  assert.ok(numbers.every((n) => n >= 1 && n <= 100));
  assert.equal(S.LINES.length, 16);
  for (const cost of S.RULES.costs) {
    const values = new Set(S.RULES.normal[cost].map((x) => x.x));
    for (const x of [3, 2, 1.5, 1.25, 0.75, 0.5, 0.25, 0.1, 0]) assert.ok(values.has(x), cost + " has ×" + x);
    const w = S.RULES.normal[cost];
    assert.ok(w.every((slot, i) => JSON.stringify(slot) !== JSON.stringify(w[(i + 1) % w.length])), cost + " is spread");
  }
  const balls = (cost) => S.RULES.normal[cost].filter((x) => x.ball).length;
  assert.ok(balls(10) < balls(50) && balls(50) < balls(100));
  assert.equal(S.RULES.wheels.bingo.filter((x) => x.next === "jp").length / S.RULES.wheels.bingo.length, 0.1);
  assert.equal(S.RULES.wheels.jp.filter((x) => x.jackpot === "jp").length / S.RULES.wheels.jp.length, 0.1);
  assert.equal(S.RULES.wheels.jp.filter((x) => x.next === "sjp").length / S.RULES.wheels.jp.length, 0.1);
  assert.equal(S.RULES.wheels.sjp.filter((x) => x.jackpot === "sjp").length / S.RULES.wheels.sjp.length, 0.1);
  // An old save (with its own card) keeps its place and counts.
  const old = { v: 2, pos: 7, card: [], marks: [], lines: [], stake: 30, laps: 1, rolls: 5, bet: 50, won: 20, balls: 1, cards: 0, bingos: 0, pending: null };
  assert.ok(S.valid(old));
  assert.deepEqual(S.upgrade(old), { ...S.newState(), pos: 7, stake: 30, laps: 1, rolls: 5, bet: 50, won: 20, balls: 1 });
});

test("a ball on the shared card opens it in the player's name; off the card or open pays 1.5×", () => {
  const card = S.newCard(seq([0])),
    s = { ...S.newState(), pos: at("normal") - 1 };
  const ballAt = S.RULES.normal[50].findIndex((x) => x.ball),
    hitNo = closedOn(card);
  const hit = S.roll(s, card, 50, seq([0, ballAt, draw(hitNo)]), "amy");
  assert.deepEqual(hit.events.find((e) => e.t === "ball"), { t: "ball", number: hitNo, cell: card.cells.indexOf(hitNo), owner: "amy" });
  assert.equal(hit.card.owners[card.cells.indexOf(hitNo)], "amy");
  assert.equal(hit.gain, 0);
  // The card passed in is left as it was.
  assert.equal(card.owners[card.cells.indexOf(hitNo)], "");
  const miss = S.roll(s, card, 50, seq([0, ballAt, draw(offCard(card))]), "amy");
  assert.equal(miss.gain, 75);
  assert.deepEqual(miss.card, card);
  // Someone else's ball already there is a miss too.
  const taken = S.roll(s, hit.card, 50, seq([0, ballAt, draw(hitNo)]), "ben");
  assert.equal(taken.events.find((e) => e.t === "ball").miss, true);
  assert.throws(() => S.roll(s, card, 7, seq([0])));
});

test("a line pays on the player's own stake, then its numbers are drawn afresh and its balls cleared", () => {
  const base = S.newCard(seq([0])),
    last = S.LINES[0][6],
    // ben's balls on the top row and the last column, all but their shared corner.
    lineCells = new Set([...S.LINES[0], ...S.LINES[13]]),
    card = { ...base, owners: base.owners.map((o, i) => (o === "*" ? o : lineCells.has(i) && i !== last ? "ben" : "")) },
    s = { ...S.newState(), pos: at("normal") - 1, stake: 400 };
  const ballAt = S.RULES.normal[100].findIndex((x) => x.ball),
    tenth = S.RULES.wheels.bingo.findIndex((x) => x.x === 0.1);
  const out = S.roll(s, card, 100, seq([0, ballAt, draw(card.cells[last]), tenth, 0]), "amy");
  const line = out.events.find((e) => e.t === "line");
  assert.deepEqual(line.lines, [0, 13]);
  assert.equal(line.count, 2);
  assert.equal(line.solo, false);
  // n lines at once: (n + 1)× the wheel's amount on 500 (400 before + this roll's 100).
  assert.equal(line.mult, line.count + 1);
  const spin = out.events.find((e) => e.t === "wheel" && e.wheel === "bingo");
  assert.equal(spin.base, 500);
  assert.equal(spin.amount, Math.round(500 * 0.1 * line.mult));
  assert.equal(out.state.stake, 0);
  assert.equal(out.state.bingos, line.count);
  // Every cell of the finished lines is closed again with a number new to the card.
  const reset = out.events.find((e) => e.t === "reset");
  for (const c of line.cells.filter((c) => c !== S.FREE)) {
    assert.equal(out.card.owners[c], "");
    assert.equal(out.card.cells[c], reset.numbers[c]);
  }
  assert.ok(S.validCard(out.card));
  assert.equal(out.card.owners[S.FREE], "*");
  // Two lines at once also opened nothing else.
  assert.ok(out.card.owners.every((o, i) => o === "" || i === S.FREE));
});

test("a line of only the player's own balls pays the solo bonus", () => {
  const base = S.newCard(seq([0])),
    row = S.LINES[4],
    card = { ...base, owners: base.owners.map((o, i) => (row.slice(0, 6).includes(i) ? "amy" : o)) },
    s = { ...S.newState(), pos: at("normal") - 1, stake: 900 };
  const ballAt = S.RULES.normal[100].findIndex((x) => x.ball),
    tenth = S.RULES.wheels.bingo.findIndex((x) => x.x === 0.1);
  const out = S.roll(s, card, 100, seq([0, ballAt, draw(card.cells[row[6]]), tenth, 0]), "amy");
  const line = out.events.find((e) => e.t === "line");
  assert.equal(line.count, 1);
  assert.equal(line.solo, true);
  assert.equal(line.mult, S.RULES.soloBonus);
  assert.equal(out.events.find((e) => e.t === "wheel" && e.wheel === "bingo").amount, Math.round(1000 * 0.1 * S.RULES.soloBonus));
});

test("passing START gives a ball and nothing else", () => {
  const card = S.newCard(seq([0])),
    s = { ...S.newState(), pos: S.SIZE - 2 };
  const zero = S.RULES.normal[10].findIndex((x) => x.x === 0);
  const out = S.roll(s, card, 10, seq([2, draw(closedOn(card)), zero]));
  const lap = out.events.findIndex((e) => e.t === "lap");
  assert.deepEqual(out.events[lap], { t: "lap" });
  assert.equal(out.events[lap + 1].t, "ball");
  assert.equal(out.gain, 0);
});

test("an event square waits for its game; win, push and loss pay as agreed", () => {
  const card = S.newCard(seq([0])),
    s = { ...S.newState(), pos: at("event") - 1 };
  const out = S.roll(s, card, 100, seq([0, 0]));
  assert.deepEqual(out.state.pending, { game: "blackjack", bet: 100 });
  assert.equal(out.gain, 0);
  assert.throws(() => S.roll(out.state, card, 100, seq([0])));
  const win = S.settle(out.state, card, 1, seq([draw(closedOn(card))]), "amy");
  assert.equal(win.gain, 200);
  assert.equal(win.state.pending, null);
  assert.equal(win.events.filter((e) => e.t === "ball").length, 1);
  assert.equal(S.settle(out.state, card, 1, seq([draw(offCard(card))])).gain, 350);
  assert.equal(S.settle(out.state, card, 1.5, seq([0])).events[0].amount, 250);
  assert.equal(S.settle(out.state, card, 0, seq([0])).gain, 100);
  const lose = S.settle(out.state, card, -2, seq([0]));
  assert.equal(lose.gain, 50);
  assert.ok(!lose.events.some((e) => e.t === "ball"));
  const sure = S.roll(s, card, 100, seq([0, 3, draw(closedOn(card))]));
  assert.equal(sure.state.pending, null);
  assert.equal(sure.events.find((e) => e.t === "sure").amount, 150);
  assert.ok(sure.events.some((e) => e.t === "ball"));
});

test("an accident takes up to twice the bet, or sends the piece back three squares or to START", () => {
  const card = S.newCard(seq([0])),
    square = at("accident"),
    s = { ...S.newState(), pos: square - 1 };
  const take = S.RULES.accident.findIndex((x) => x.take === 2),
    back = S.RULES.accident.findIndex((x) => x.start);
  assert.equal(S.roll(s, card, 50, seq([0, take])).gain, -100);
  const home = S.roll(s, card, 50, seq([0, back]));
  assert.equal(home.state.pos, 0);
  const three = S.roll(s, card, 50, seq([0, S.RULES.accident.findIndex((x) => x.back === 3)]));
  assert.equal(three.state.pos, square - 3);
});

test("the jackpot wheels lead on and report a jackpot without paying it here", () => {
  const base = S.newCard(seq([0])),
    row = S.LINES[0],
    card = { ...base, owners: base.owners.map((o, i) => (row.slice(0, 6).includes(i) ? "ben" : o)) },
    s = { ...S.newState(), pos: at("normal") - 1 };
  const ballAt = S.RULES.normal[10].findIndex((x) => x.ball),
    chance = S.RULES.wheels.bingo.findIndex((x) => x.next === "jp"),
    jp = S.RULES.wheels.jp.findIndex((x) => x.jackpot === "jp");
  const out = S.roll(s, card, 10, seq([0, ballAt, draw(card.cells[row[6]]), chance, jp]), "amy");
  assert.deepEqual(
    out.events.filter((e) => e.t === "wheel").map((e) => e.wheel),
    ["normal", "bingo", "jp"],
  );
  assert.deepEqual(out.events.find((e) => e.t === "jackpot"), { t: "jackpot", kind: "jp" });
});

test("played the plain way by several players on one card, every bet returns a little under what goes in", () => {
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
    const players = [S.newState(), S.newState(), S.newState()];
    let card = S.newCard(random),
      bet = 0,
      won = 0;
    for (let i = 0; i < 80000; i++)
      players.forEach((s, p) => {
        let out = S.roll(s, card, cost, random, "p" + p);
        card = out.card;
        let gain = out.gain;
        if (out.state.pending) {
          const end = S.settle(out.state, card, play(out.state.pending.game), random, "p" + p);
          card = end.card;
          gain += end.gain;
          out = end;
        }
        players[p] = out.state;
        bet += cost;
        won += gain;
      });
    assert.ok(S.validCard(card));
    const rate = won / bet;
    assert.ok(rate > 0.85 && rate < 1, cost + ": " + rate);
  }
});
