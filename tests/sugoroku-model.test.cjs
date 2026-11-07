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
// A ball draws random(99) + 1, so drawing number n takes the value n − 1.
const draw = (n) => n - 1;
const closedOn = (card) => card.cells.find((n, i) => !card.owners[i]);
// The same card with cell `i` already opened by ben (a ball on its number pays missPay).
const withOpen = (card, i = 0) => ({ ...card, owners: card.owners.map((o, k) => (k === i ? "ben" : o)) });

test("the board, card and wheels have the agreed shape", () => {
  assert.equal(S.SIZE, 100);
  assert.equal(S.kindAt(0), "start");
  const card = S.newCard(rng(1));
  assert.ok(S.validCard(card));
  // Two 7×7 cards (98 numbers), no free cell; the 99th number is the special one, on neither card.
  assert.equal(card.cells.length, 98);
  assert.equal(card.owners.length, 98);
  assert.equal(new Set(card.cells).size, 98);
  assert.ok(card.cells.every((n) => n >= 1 && n <= 99));
  assert.ok(card.special >= 1 && card.special <= 99 && !card.cells.includes(card.special));
  assert.equal(S.LINES.length, 32);
  assert.ok(S.LINES.every((line) => line.length === 7));
  // A card from before the second card is not valid.
  assert.equal(S.validCard({ cells: Array.from({ length: 49 }, (_, i) => i + 1), owners: Array(49).fill("") }), false);
  for (const cost of S.RULES.costs) {
    const values = new Set(S.RULES.normal[cost].map((x) => x.x));
    // High risk, high return: from −5 times the bet to +7; the 確変 wheel holds the biggest multiples and the ball runs.
    for (const x of [7, 5, 3, 2, 1, 0.5, 0, -1, -2, -5]) assert.ok(values.has(x), cost + " has ×" + x);
    assert.equal(S.RULES.normal[cost].filter((slot) => slot.item).length, 2, "two item slots");
    // Some of what is on the wheel really pays the bet back or more (not only the hidden bonus slot).
    assert.ok(S.RULES.normal[cost].filter((slot) => !slot.kakuhen && slot.x >= 1).length >= 3, "a few slots pay ×1 or more");
    assert.equal(S.RULES.normal[cost].filter((slot) => slot.kakuhen).length, 1);
    for (const x of [4, 10, 15]) assert.ok(S.RULES.kakuhen.some((slot) => slot.x === x), "確変 has ×" + x);
    assert.ok(S.RULES.kakuhen.some((slot) => slot.balls === 5), "確変 has a ball run");
    assert.deepEqual(S.RULES.normal[cost].filter((x) => x.event).map((x) => x.event).sort(), ["blackjack", "blackjack", "chinchiro", "chinchiro", "dice", "dice"]);
    const w = S.RULES.normal[cost];
    assert.ok(w.every((slot, i) => JSON.stringify(slot) !== JSON.stringify(w[(i + 1) % w.length])), cost + " is spread");
  }
  // One bet: 100.
  assert.deepEqual(S.RULES.costs, [100]);
  // The bingo wheel (for a bet of 100): ×12 / ×20 / ×32 / ×50, four mini games (each twice), the jackpot and the super chance twice.
  const bingo = S.RULES.wheels.bingo;
  assert.equal(bingo.length, 20);
  assert.deepEqual(bingo.filter((x) => x.x).map((x) => x.x).sort((a, b) => a - b), [12, 12, 20, 20, 32, 32, 50, 50]);
  assert.deepEqual(bingo.filter((x) => x.game).map((x) => x.game).sort(), ["dice", "dice", "math", "math", "tap", "tap", "timer", "timer"]);
  assert.equal(bingo.filter((x) => x.miss).length, 0);
  assert.equal(bingo.filter((x) => x.jackpot === "jp").length, 2);
  assert.equal(bingo.filter((x) => x.next === "sjp").length, 2);
  // The super chance: the super jackpot twice, the jackpot, the bigger tapping game, back.
  const sjp = S.RULES.wheels.sjp;
  assert.equal(sjp.length, 5);
  assert.equal(sjp.filter((x) => x.jackpot === "sjp").length, 2);
  assert.equal(sjp.filter((x) => x.jackpot === "jp").length, 1);
  assert.equal(sjp.filter((x) => x.game === "tapex").length, 1);
  assert.equal(sjp.filter((x) => x.back).length, 1);
  // The special number has its own wheel: multiples of the bet, or three more balls; no jackpot.
  const special = S.RULES.wheels.special;
  assert.ok(special.length >= 8 && special.every((x) => x.x > 0 || x.balls === 3));
  assert.ok(!special.some((x) => x.jackpot));
  // The whole prize goes to the balls on the line; half of the wheel's multiple does.
  assert.deepEqual([S.RULES.bingoPrize, S.RULES.prizeShare, S.RULES.wheelShare], [7, 1, 0.5], "the prize is 7 × the bet, 100 for each of the 7 balls");
  // An old save (with its own card) keeps its place and counts.
  const old = { v: 2, pos: 7, card: [], marks: [], lines: [], stake: 30, laps: 1, rolls: 5, bet: 50, won: 20, balls: 1, cards: 0, bingos: 0, pending: null };
  assert.ok(S.valid(old));
  assert.deepEqual(S.upgrade(old), { ...S.newState(), pos: 7, stake: 30, laps: 1, rolls: 5, bet: 50, won: 20, balls: 1, rev: 5 });
});

test("a ball on the shared card opens it in the player's name; an open number pays 1.5 times the bet", () => {
  const card = S.newCard(seq([0])),
    s = { ...S.newState(), pos: at("normal") - 1 };
  const ballAt = S.RULES.normal[100].findIndex((x) => x.ball),
    hitNo = closedOn(card);
  const hit = S.roll(s, card, 100, seq([0, ballAt, draw(hitNo)]), "amy");
  assert.deepEqual(hit.events.find((e) => e.t === "ball"), { t: "ball", number: hitNo, cell: card.cells.indexOf(hitNo), owner: "amy" });
  assert.equal(hit.card.owners[card.cells.indexOf(hitNo)], "amy");
  assert.equal(hit.gain, 0);
  // The card passed in is left as it was.
  assert.equal(card.owners[card.cells.indexOf(hitNo)], "");
  // Every number but the special one is on a card: each of 98 balls finds its cell.
  for (let n = 1; n <= 99; n++) if (n !== card.special) assert.ok(card.cells.includes(n), "number " + n);
  // Someone else's ball already there: the number pays 1.5 times the bet.
  const taken = S.roll(s, hit.card, 100, seq([0, ballAt, draw(hitNo)]), "ben");
  assert.equal(taken.events.find((e) => e.t === "ball").miss, true);
  assert.equal(taken.gain, 150);
  assert.deepEqual(taken.card, hit.card);
  assert.throws(() => S.roll(s, card, 75, seq([0])));
});

test("the special number spins the special wheel: a multiple of the bet, or three more balls", () => {
  const card = S.newCard(seq([0])),
    s = { ...S.newState(), pos: at("normal") - 1 },
    ballAt = S.RULES.normal[100].findIndex((x) => x.ball),
    wheel = S.RULES.wheels.special;
  const ten = wheel.findIndex((x) => x.x === 10);
  const out = S.roll(s, card, 100, seq([0, ballAt, draw(card.special), ten]), "amy");
  assert.deepEqual(out.events.find((e) => e.t === "ball"), { t: "ball", number: card.special, cell: -1, special: true });
  const spin = out.events.find((e) => e.t === "wheel" && e.wheel === "special");
  assert.equal(spin.amount, 1000);
  assert.equal(out.gain, 1000);
  assert.deepEqual(out.card, card, "the special number opens no cell");
  // Three more balls: each is an ordinary ball (here three numbers on the card, each opens its cell).
  const run = wheel.findIndex((x) => x.balls === 3),
    nums = card.cells.slice(0, 3);
  const three = S.roll(s, card, 100, seq([0, ballAt, draw(card.special), run, ...nums.map(draw)]), "amy");
  assert.equal(three.events.filter((e) => e.t === "ball").length, 4);
  assert.deepEqual(three.card.owners.slice(0, 3), ["amy", "amy", "amy"]);
  assert.equal(three.state.balls, 4);
});

test("a line pays on the player's own stake, then its balls are cleared (the numbers stay)", () => {
  const base = S.newCard(seq([0])),
    last = S.LINES[0][6],
    // ben's balls on the top row and the last column, all but their shared corner.
    lineCells = new Set([...S.LINES[0], ...S.LINES[13]]),
    card = { ...base, owners: base.owners.map((o, i) => (lineCells.has(i) && i !== last ? "ben" : "")) },
    s = { ...S.newState(), pos: at("normal") - 1, stake: 400 };
  const ballAt = S.RULES.normal[100].findIndex((x) => x.ball),
    eight = S.RULES.wheels.bingo.findIndex((x) => x.x === 12);
  const out = S.roll(s, card, 100, seq([0, ballAt, draw(card.cells[last]), eight, 0]), "amy");
  const line = out.events.find((e) => e.t === "line");
  assert.deepEqual(line.lines, [0, 13]);
  assert.equal(line.count, 2);
  assert.equal(line.solo, false);
  // n lines at once: (n + 1)× the bingo prize (7× the bet) and the wheel's bet × 12.
  assert.equal(line.mult, line.count + 1);
  // All of the prize (2,100 here) is shared by the 13 balls on the two lines: ben's 12 parts wait on
  // the card for him, amy keeps the rest. Of the wheel's × 12 (3,600), 50% goes the same way.
  const prize = out.events.find((e) => e.t === "prize"),
    prizeBen = Math.floor((2100 * S.RULES.prizeShare * 12) / 13),
    wheelBen = Math.floor((3600 * S.RULES.wheelShare * 12) / 13);
  assert.equal(prize.total, 700 * line.mult);
  assert.deepEqual(prize.shares, { ben: prizeBen });
  assert.equal(prize.amount, 2100 - prizeBen);
  const spin = out.events.find((e) => e.t === "wheel" && e.wheel === "bingo");
  assert.equal(spin.total, 1200 * line.mult);
  assert.deepEqual(spin.shares, { ben: wheelBen });
  assert.equal(spin.amount, 3600 - wheelBen);
  assert.deepEqual(out.card.owed, { ben: prizeBen + wheelBen });
  assert.equal(out.gain, 2100 - prizeBen + 3600 - wheelBen);
  // ben takes his part when he next plays, once.
  const got = S.collect(out.card, "ben");
  assert.equal(got.amount, prizeBen + wheelBen);
  assert.deepEqual(got.card.owed, {});
  assert.equal(S.collect(got.card, "ben").amount, 0);
  assert.equal(out.state.stake, 0);
  assert.equal(out.state.bingos, line.count);
  // Every cell of the finished lines is closed again, with the same number.
  const reset = out.events.find((e) => e.t === "reset");
  assert.deepEqual(reset.cells.slice().sort((a, b) => a - b), line.cells.slice().sort((a, b) => a - b));
  for (const c of line.cells) {
    assert.equal(out.card.owners[c], "");
    assert.equal(out.card.cells[c], card.cells[c]);
  }
  assert.ok(S.validCard(out.card));
  // The same double line landing on a mini game: the game is not multiplied by the lines, only
  // by bingoGameBoost (2).
  const timerAt = S.RULES.wheels.bingo.findIndex((x) => x.game === "timer");
  const mini = S.roll(s, card, 100, seq([0, ballAt, draw(card.cells[last]), timerAt, 0]), "amy");
  assert.deepEqual(mini.state.bonus, [{ game: "timer", mult: 2, bet: 100 }]);
  // Two lines at once also opened nothing else.
  assert.ok(out.card.owners.every((o) => o === ""));
});

test("a line of only the player's own balls pays the solo bonus", () => {
  const base = S.newCard(seq([0])),
    row = S.LINES[4],
    card = { ...base, owners: base.owners.map((o, i) => (row.slice(0, 6).includes(i) ? "amy" : o)) },
    s = { ...S.newState(), pos: at("normal") - 1, stake: 900 };
  const ballAt = S.RULES.normal[100].findIndex((x) => x.ball),
    fifteen = S.RULES.wheels.bingo.findIndex((x) => x.x === 20);
  const out = S.roll(s, card, 100, seq([0, ballAt, draw(card.cells[row[6]]), fifteen, 0]), "amy");
  const line = out.events.find((e) => e.t === "line");
  assert.equal(line.count, 1);
  assert.equal(line.solo, true);
  assert.equal(line.mult, S.RULES.soloBonus);
  assert.equal(out.events.find((e) => e.t === "wheel" && e.wheel === "bingo").amount, Math.round(2000 * S.RULES.soloBonus));
});

test("passing START gives a ball and nothing else", () => {
  const card = S.newCard(seq([0])),
    s = { ...S.newState(), pos: S.SIZE - 2 };
  const zero = S.RULES.normal[100].findIndex((x) => x.x === 0 && !x.ball && !x.game && !x.event);
  const out = S.roll(s, card, 100, seq([2, draw(closedOn(card)), zero]));
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
  assert.equal(S.settle(out.state, withOpen(card), 1, seq([draw(card.cells[0])])).gain, 200 + 150);
  assert.equal(S.settle(out.state, card, 1.5, seq([0])).events[0].amount, 250);
  assert.equal(S.settle(out.state, card, 0, seq([0])).gain, 100);
  const lose = S.settle(out.state, card, -2, seq([0]));
  assert.equal(lose.gain, 0, "a lost event game gives nothing back (the games are even now)");
  assert.ok(!lose.events.some((e) => e.t === "ball"));
  const sure = S.roll(s, card, 100, seq([0, 3, draw(closedOn(card))]));
  assert.equal(sure.state.pending, null);
  assert.equal(sure.events.find((e) => e.t === "sure").amount, 100);
  assert.ok(sure.events.some((e) => e.t === "ball"));
});

test("an accident takes up to twice the bet, or sends the piece back three squares or to START", () => {
  const card = S.newCard(seq([0])),
    square = at("accident"),
    s = { ...S.newState(), pos: square - 1 };
  const take = S.RULES.accident.findIndex((x) => x.take === 2),
    back = S.RULES.accident.findIndex((x) => x.start);
  assert.equal(S.roll(s, card, 100, seq([0, take])).gain, -200);
  const home = S.roll(s, card, 100, seq([0, back]));
  assert.equal(home.state.pos, 0);
  const three = S.roll(s, card, 100, seq([0, S.RULES.accident.findIndex((x) => x.back === 3)]));
  assert.equal(three.state.pos, square - 3);
});

// A card one ball short of a line of ben's, and the draws for a roll that completes it.
function lineReady(after) {
  const base = S.newCard(seq([0])),
    row = S.LINES[0],
    card = { ...base, owners: base.owners.map((o, i) => (row.slice(0, 6).includes(i) ? "ben" : o)) },
    s = { ...S.newState(), pos: at("normal") - 1 };
  return S.roll(s, card, 100, seq([0, S.RULES.normal[100].findIndex((x) => x.ball), draw(card.cells[row[6]]), ...after]), "amy");
}
const slot = (wheel, test) => S.RULES.wheels[wheel].findIndex(test);

test("the jackpot is a slot of the bingo wheel, the super chance leads to its own wheel and back", () => {
  const jp = lineReady([slot("bingo", (x) => x.jackpot === "jp")]);
  assert.deepEqual(jp.events.find((e) => e.t === "jackpot"), { t: "jackpot", kind: "jp" });
  // amy's part of the prize (700): all of it is shared by the 7 balls (100 each), ben's 6 parts wait on the card.
  const ben = Math.floor((700 * S.RULES.prizeShare * 6) / 7);
  assert.equal(jp.gain, 700 - ben);
  // The jackpot waits in the state until the screen pays it.
  assert.deepEqual(jp.state.jpWait, ["jp"]);
  assert.equal(jp.state.jps, 1);
  const sjp = lineReady([slot("bingo", (x) => x.next), slot("sjp", (x) => x.jackpot === "sjp")]);
  assert.deepEqual(sjp.events.filter((e) => e.t === "wheel").map((e) => e.wheel), ["normal", "bingo", "sjp"]);
  assert.deepEqual(sjp.events.find((e) => e.t === "jackpot"), { t: "jackpot", kind: "sjp" });
  // Back: the bingo wheel again, here landing on × 12.
  const back = lineReady([slot("bingo", (x) => x.next), slot("sjp", (x) => x.back), slot("bingo", (x) => x.x === 12)]);
  assert.deepEqual(back.events.filter((e) => e.t === "wheel").map((e) => e.wheel), ["normal", "bingo", "sjp", "bingo"]);
  // × 12 = 1,200, of which ben's 6 balls of 7 take 50%.
  assert.equal(back.gain, 700 - ben + 1200 - Math.floor((1200 * S.RULES.wheelShare * 6) / 7));
  assert.deepEqual(sjp.state.jpWait, ["sjp"]);
});

test("a mini game waits in state.bonus, blocks rolling and pays its score, 0 when left", () => {
  const out = lineReady([slot("bingo", (x) => x.game === "timer")]);
  // A bingo wheel's mini game scores bingoGameBoost (2) times its points.
  assert.deepEqual(out.state.bonus, [{ game: "timer", mult: 2, bet: 100 }]);
  assert.throws(() => S.roll(out.state, out.card, 100, seq([0])));
  assert.equal(S.settleBonus(out.state, 10).gain, 2000);
  assert.equal(S.settleBonus(out.state, 10.03).gain, 1970);
  assert.equal(S.settleBonus(out.state, 12.5).gain, 0);
  assert.equal(S.settleBonus(out.state, null).gain, 0);
  assert.deepEqual(S.settleBonus(out.state, 10).state.bonus, []);
  assert.equal(S.gameScore("tap", 70), 700);
  assert.equal(S.gameScore("tapex", 70), 1750);
  assert.equal(S.gameScore("dice", 14), 700);
  assert.equal(S.gameScore("math", true), 500, "a game saved before the levels");
  assert.deepEqual(["easy", "normal", "hard"].map((l) => S.gameScore("math", l)), [300, 600, 1200]);
  assert.equal(S.gameScore("math", false), 0);
  assert.equal(S.gameScore("math", false), 0);
  // Super chance → the bigger tapping game.
  const ex = lineReady([slot("bingo", (x) => x.next), slot("sjp", (x) => x.game === "tapex")]);
  assert.deepEqual(ex.state.bonus, [{ game: "tapex", mult: 2, bet: 100 }]);
  // The sums come out whole.
  const random = rng(5);
  for (let i = 0; i < 200; i++) {
    const q = S.sum(random);
    const value = Function("return " + q.text.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-"))();
    assert.equal(value, q.answer, q.text);
    assert.ok(Number.isInteger(q.answer));
  }
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
        // A player's part of the others' lines comes in as they play.
        const part = S.collect(card, "p" + p);
        let out = S.roll(s, part.card, cost, random, "p" + p);
        card = out.card;
        let gain = out.gain + part.amount;
        if (out.state.pending) {
          const end = S.settle(out.state, card, play(out.state.pending.game), random, "p" + p);
          card = end.card;
          gain += end.gain;
          out = end;
        }
        // Mini games played fairly well: 0.05 s off, 70 taps, a 3, the sum right, the light in the
        // silver, the card guessed.
        let state = out.state;
        while (state.bonus.length) {
          const game = state.bonus[0].game;
          const end = S.settleBonus(state, { timer: 10.05, tap: 70, tapex: 70, dice: 3, math: true, stop: "good", hilo: "win" }[game]);
          state = end.state;
          gain += end.gain;
        }
        players[p] = state;
        bet += cost;
        won += gain;
      });
    assert.ok(S.validCard(card));
    const rate = won / bet;
    // Without the jackpots, which are paid from the casino's shared pots on top.
    assert.ok(rate > 0.8 && rate < 1, cost + ": " + rate);
  }
});

test("tapping counts up to the cap, and odd mini-game results score nothing", () => {
  assert.equal(S.gameScore("tap", 80), 800);
  assert.equal(S.gameScore("tap", 5000), S.RULES.games.tap.max * 10);
  assert.equal(S.gameScore("tapex", 1e9), S.RULES.games.tapex.max * 25);
  assert.equal(S.gameScore("dice", 99), 900);
  assert.equal(S.gameScore("timer", "x"), 0);
  assert.equal(S.gameScore("timer", Infinity), 0);
});

test("a shared card read back is checked before it is used", () => {
  const card = S.newCard(seq([0]));
  assert.equal(S.validCard(card), true);
  assert.equal(S.validCard({ ...card, owed: { ben: 30 } }), true);
  const bad = [
    { ...card, cells: card.cells.map((n, i) => (i === 3 ? 100 : n)) },
    { ...card, cells: card.cells.map((n, i) => (i === 3 ? 2.5 : n)) },
    { ...card, cells: card.cells.map((n, i) => (i === 3 ? card.cells[4] : n)) },
    { ...card, cells: card.cells.slice(0, 49), owners: card.owners.slice(0, 49) },
    { ...card, v: undefined },
    { ...card, special: card.cells[0] },
    { ...card, special: 100 },
    { ...card, owners: card.owners.map((o, i) => (i === 3 ? "x".repeat(65) : o)) },
    { ...card, owners: card.owners.slice(1) },
    { ...card, owed: { ben: -5 } },
    { ...card, owed: { ben: 1.5 } },
    { ...card, owed: [] },
  ];
  for (const c of bad) assert.equal(S.validCard(c), false);
});

test("an older save gets the new counters, and a roll records its best payout", () => {
  const old = { v: 3, pos: 4, stake: 0, laps: 0, rolls: 9, bet: 900, won: 700, balls: 2, pending: null, bonus: [] };
  const up = S.upgrade(old);
  assert.deepEqual([up.rolls, up.best, up.jps, up.sjps, up.shared, up.jpWait], [9, 0, 0, 0, 0, []]);
  assert.deepEqual(S.upgrade({ ...old, jpWait: ["jp", "nope"] }).jpWait, ["jp"]);
  const kakuhen = S.RULES.normal[100].findIndex((x) => x.kakuhen),
    ten = S.RULES.kakuhen.findIndex((x) => x.x === 10);
  const out = S.roll({ ...S.newState(), pos: at("normal") - 1 }, S.newCard(seq([0])), 100, seq([0, kakuhen, ten]));
  assert.equal(out.state.best, 1000);
});

test("a 確変 slot spins the 確変 wheel, which pays a multiple or draws a run of balls", () => {
  const kakuhen = S.RULES.normal[100].findIndex((x) => x.kakuhen),
    from = { ...S.newState(), pos: at("normal") - 1 };
  const wheels = (out) => out.events.filter((e) => e.t === "wheel").map((e) => e.wheel);
  // A multiple: ×10 pays 1,000 and draws nothing.
  const ten = S.RULES.kakuhen.findIndex((x) => x.x === 10);
  let out = S.roll(from, S.newCard(seq([0])), 100, seq([0, kakuhen, ten]));
  assert.deepEqual(wheels(out), ["normal", "kakuhen"]);
  assert.equal(out.events.find((e) => e.wheel === "kakuhen").amount, 1000);
  assert.equal(out.gain, 1000);
  assert.equal(out.events.filter((e) => e.t === "ball").length, 0);
  // A run of five balls: five balls are drawn one after another (open numbers pay missPay).
  const run = S.RULES.kakuhen.findIndex((x) => x.balls === 5),
    card = [0, 1, 2, 3, 4].reduce((c, i) => withOpen(c, i), S.newCard(seq([0])));
  out = S.roll(from, card, 100, seq([0, kakuhen, run, ...card.cells.slice(0, 5).map(draw)]));
  assert.deepEqual(wheels(out), ["normal", "kakuhen"]);
  assert.equal(out.events.filter((e) => e.t === "ball").length, 5);
  assert.equal(out.state.balls, 5);
  assert.equal(out.gain, 5 * 100 * S.RULES.missPay);
});

test("the 確変 wheel keeps the normal wheel's pay: the top slots moved into it", () => {
  // Before the 確変 slots the top of the normal wheel paid ×10, ×5, ×1.5 and ×1 once in 40 each.
  const pay = S.RULES.kakuhen.reduce((n, slot) => n + (slot.x || 0), 0) / S.RULES.kakuhen.length;
  assert.ok(pay > 6 && pay < 14, "multiples on the 確変 wheel average " + pay);
  assert.equal(S.RULES.kakuhen.length, 12);
  assert.ok(S.RULES.kakuhen.every((slot, i, w) => JSON.stringify(slot) !== JSON.stringify(w[(i + 1) % w.length])), "確変 is spread");
});

test("parts of others' lines are stamped, dropped after owedDays and kept to owedMax", () => {
  const day = 864e5,
    card = { ...S.newCard(seq([0])), owed: { old: 50, kept: 20 }, owedAt: { old: 0, kept: 0 } };
  // At day 10: ann's part grows (stamped now), old and kept stay.
  const now = S.tidyOwed({ ...card, owed: { ...card.owed, ann: 30 } }, card, 10 * day);
  assert.deepEqual(now.owedAt, { ann: 10 * day, old: 0, kept: 0 });
  // At day 31 the untouched parts are past 30 days and go; ann's stays.
  const later = S.tidyOwed(structuredClone(now), now, 31 * day);
  assert.deepEqual(later.owed, { ann: 30 });
  // A part without a stamp (an older card) starts counting now.
  assert.deepEqual(S.tidyOwed({ ...card, owedAt: undefined }, card, 5).owedAt, { old: 5, kept: 5 });
  // Only the newest owedMax stay.
  const many = { ...card, owed: {}, owedAt: {} };
  for (let i = 0; i < S.RULES.owedMax + 5; i++) (many.owed["p" + i] = 1), (many.owedAt["p" + i] = i);
  const capped = S.tidyOwed(structuredClone(many), many, 1000);
  assert.equal(Object.keys(capped.owed).length, S.RULES.owedMax);
  assert.equal("p0" in capped.owed, false);
  // Collecting takes the stamp too.
  assert.deepEqual(S.collect(now, "ann").card.owedAt, { old: 0, kept: 0 });
  assert.equal(S.validCard(now), true);
  assert.equal(S.validCard({ ...now, owedAt: { ann: "x" } }), false);
});

test("the normal wheel has two quick games each twice, paid in multiples of the bet", () => {
  const w = S.RULES.normal[100];
  assert.deepEqual(w.filter((x) => x.game).map((x) => x.game).sort(), ["hilo", "hilo", "stop", "stop"]);
  const at = (game) => w.findIndex((x) => x.game === game);
  const out = S.roll({ ...S.newState(), pos: 0 }, S.newCard(seq([0])), 100, seq([0, at("stop")]));
  assert.equal(out.gain, 0);
  assert.deepEqual(out.state.bonus, [{ game: "stop", mult: 1, bet: 100 }]);
  assert.deepEqual(out.events.filter((e) => e.t === "bonus"), [{ t: "bonus", game: "stop", mult: 1 }]);
  assert.deepEqual(["perfect", "good", "miss", "auto", "x"].map((d) => S.gameScore("stop", d)), [200, 75, 0, 50, 0]);
  assert.deepEqual(["win", "tie", "lose", "auto"].map((d) => S.gameScore("hilo", d)), [125, 100, 0, 50]);
  assert.equal(S.settleBonus(out.state, "perfect").gain, 200);
});

test("a normal square can take more than the bet, or start an event game", () => {
  const w = S.RULES.normal[100],
    pos = { ...S.newState(), pos: at("normal") - 1 },
    card = S.newCard(seq([0]));
  const minus = S.roll(pos, card, 100, seq([0, w.findIndex((x) => x.x === -1)]));
  assert.equal(minus.gain, -100);
  const bj = S.roll(pos, card, 100, seq([0, w.findIndex((x) => x.event === "blackjack")]));
  assert.deepEqual(bj.state.pending, { game: "blackjack", bet: 100, plain: true });
  assert.equal(bj.gain, 0);
  // A plain bet: a win pays the bet back and the win, with no ball; a loss pays nothing.
  const won = S.settle(bj.state, card, 1, seq([99]));
  assert.equal(won.events.find((e) => e.t === "result").amount, 200);
  assert.ok(!won.events.some((e) => e.t === "ball"));
  assert.equal(won.state.pending, null);
  assert.equal(S.settle(bj.state, card, -1, seq([0])).gain, 0);
});

test("a save whose returns went below 0 is still a good save", () => {
  assert.equal(S.valid({ ...S.newState(), rolls: 2, bet: 200, won: -150 }), true);
  assert.equal(S.valid({ ...S.newState(), won: NaN }), false);
});

test("items: the item wheel gives an item (kept ×n) and 100 more; ダブルダイス, ぴったり, ガード, 倍がけ", () => {
  const w = S.RULES.normal[100],
    itemAt = w.findIndex((x) => x.item),
    zeroAt = w.findIndex((x) => x.x === 0 && !x.ball && !x.game && !x.event && !x.kakuhen && !x.item),
    card = S.newCard(seq([0])),
    from = { ...S.newState(), pos: at("normal") - 1 };
  const pickItem = (id) => S.RULES.itemWheel.findIndex((x) => x.item === id);
  assert.deepEqual(Object.keys(S.RULES.items).sort(), ["dice2", "dice3", "exact", "guard", "x2"]);
  assert.deepEqual(S.RULES.itemWheel.map((x) => x.item).sort(), ["dice2", "dice2", "dice2", "dice3", "exact", "exact", "guard", "guard", "x2", "x2"]);
  assert.equal(S.RULES.itemWheel.length, 10);
  // A normal slot with an item: the item wheel spins and the bag gets the item.
  const got = S.roll(from, card, 100, seq([0, itemAt, pickItem("guard")]));
  assert.deepEqual(got.state.items, ["guard"]);
  assert.deepEqual(got.events.filter((e) => e.t === "wheel").map((e) => e.wheel), ["normal", "item"]);
  assert.deepEqual(got.events.find((e) => e.t === "itemGet"), { t: "itemGet", id: "guard", amount: 100 });
  assert.equal(got.gain, 100, "the item and 100 besides");
  // Items are kept as a count: a fourth one still goes in.
  const many = S.roll({ ...from, items: ["dice2", "dice2", "exact"] }, card, 100, seq([0, itemAt, pickItem("dice3")]));
  assert.deepEqual(many.state.items, ["dice2", "dice2", "exact", "dice3"]);
  assert.equal(many.gain, 100);
  // Only the very top of the count (itemMax) is refused, and the 100 is still paid.
  const top = S.roll({ ...from, items: Array(S.RULES.itemMax).fill("guard") }, card, 100, seq([0, itemAt, pickItem("dice3")]));
  assert.equal(top.state.items.length, S.RULES.itemMax);
  assert.equal(top.gain, 100);
  assert.equal(top.events.find((e) => e.t === "itemGet").full, true);
  // ダブルダイス: two dice, the sum moves the piece.
  const two = S.roll({ ...from, pos: 0, items: ["dice2"] }, card, 100, seq([3, 4, zeroAt]), "amy", { items: ["dice2"] });
  assert.equal(two.state.pos, 9);
  assert.deepEqual(two.events.find((e) => e.t === "die"), { t: "die", value: 9, values: [4, 5] });
  assert.deepEqual(two.state.items, []);
  // トリプルダイス: three dice.
  const three = S.roll({ ...from, pos: 0, items: ["dice3"] }, card, 100, seq([0, 1, 2, zeroAt]), "amy", { items: ["dice3"] });
  assert.equal(three.state.pos, 6);
  assert.deepEqual(three.events.find((e) => e.t === "die"), { t: "die", value: 6, values: [1, 2, 3] });
  assert.throws(() => S.roll({ ...from, items: ["dice2", "dice3"] }, card, 100, seq([0]), "amy", { items: ["dice2", "dice3"] }), /two kinds/);
  // ぴったり: the face is chosen.
  const exact = S.roll({ ...from, pos: 0, items: ["exact"] }, card, 100, seq([0, zeroAt]), "amy", { items: ["exact"], face: 5 });
  assert.equal(exact.state.pos, 5);
  assert.throws(() => S.roll({ ...from, items: ["exact"] }, card, 100, seq([0]), "amy", { items: ["exact"], face: 7 }));
  assert.throws(() => S.roll({ ...from, items: ["exact", "dice2"] }, card, 100, seq([0]), "amy", { items: ["exact", "dice2"], face: 2 }), /two kinds/);
  // An item that is not in the bag cannot be used; neither can one twice.
  assert.throws(() => S.roll(from, card, 100, seq([0]), "amy", { items: ["guard"] }));
  assert.throws(() => S.roll({ ...from, items: ["guard", "guard"] }, card, 100, seq([0]), "amy", { items: ["guard", "guard"] }));
  // ガード: for this roll and the next four the bad slots of an accident square do nothing (the good ones still pay).
  const accident = at("accident"),
    safe = S.roll({ ...from, pos: accident - 1, items: ["guard"] }, card, 100, seq([0, 0]), "amy", { items: ["guard"] });
  assert.deepEqual(safe.events.filter((e) => e.t === "guarded").length, 1);
  assert.equal(safe.gain, 0);
  assert.equal(safe.state.guard, S.RULES.guardRolls - 1);
  assert.ok(safe.events.some((e) => e.t === "wheel" && e.wheel === "accident"), "the wheel still spins");
  const goodAt = S.RULES.accident.findIndex((x) => x.give === 6);
  const pays = S.roll({ ...from, pos: accident - 1, items: ["guard"] }, card, 100, seq([0, goodAt]), "amy", { items: ["guard"] });
  assert.equal(pays.gain, 600);
  assert.equal(pays.events.filter((e) => e.t === "guarded").length, 0);
  const later = S.roll({ ...safe.state, pos: accident - 1 }, card, 100, seq([0, 0]), "amy");
  assert.equal(later.events.filter((e) => e.t === "guarded").length, 1);
  assert.equal(later.state.guard, S.RULES.guardRolls - 2);
  // 倍がけ: what the roll pays or takes counts twice (on any square), by at most x2Cap times the bet; it is used up.
  const plus = w.findIndex((x) => x.x === 5);
  const doubled = S.roll({ ...from, items: ["x2"] }, card, 100, seq([0, plus]), "amy", { items: ["x2"] });
  assert.equal(doubled.gain, 1000);
  assert.deepEqual(doubled.state.items, []);
  assert.deepEqual(doubled.events.find((e) => e.t === "x2"), { t: "x2", amount: 500 });
  const minus = w.findIndex((x) => x.x === -5);
  assert.equal(S.roll({ ...from, items: ["x2"] }, card, 100, seq([0, minus]), "amy", { items: ["x2"] }).gain, -1000);
  const onEvent = S.roll({ ...from, pos: at("event") - 1, items: ["x2"] }, card, 100, seq([0, 0]), "amy", { items: ["x2"] });
  assert.deepEqual(onEvent.state.items, [], "used up even when nothing was paid yet");
  // The extra is capped: a roll that pays 1,500 gains at most 10 × the bet more.
  const big = w.findIndex((x) => x.x === 7);
  assert.equal(S.roll({ ...from, items: ["x2"] }, card, 100, seq([0, big]), "amy", { items: ["x2"] }).gain, 1400);
  // Buying: the price is returned; only the very top count refuses; an unknown item too.
  const bought = S.buy({ ...S.newState(), items: ["guard"] }, "dice3");
  assert.deepEqual([bought.state.items, bought.price], [["guard", "dice3"], 30]);
  assert.throws(() => S.buy(S.newState(), "ball"), /no such item/);
  assert.deepEqual(S.buy({ ...S.newState(), items: ["guard", "guard", "guard"] }, "x2").state.items, ["guard", "guard", "guard", "x2"], "more than three is fine");
  assert.throws(() => S.buy({ ...S.newState(), items: Array(S.RULES.itemMax).fill("guard") }, "x2"), /full/);
  assert.throws(() => S.buy(S.newState(), "nope"));
  // Names every object has are not items; a purchase and a roll both count for which copy is further on.
  assert.throws(() => S.buy(S.newState(), "constructor"));
  assert.deepEqual(S.itemsOf({ items: ["constructor", "__proto__", "toString", "guard"] }), ["guard"]);
  assert.equal(S.revOf({ rolls: 7 }), 7);
  assert.equal(S.buy({ ...S.newState(), rolls: 7, rev: undefined }, "guard").state.rev, 8);
  assert.equal(S.roll({ ...S.newState(), rolls: 7, rev: undefined, pos: at("normal") - 1 }, card, 100, seq([0, zeroAt])).state.rev, 8);
  // An old save has no items; a bad one is cleaned.
  assert.deepEqual(S.upgrade({ v: 3, pos: 0, stake: 0, laps: 0, rolls: 0, bet: 0, won: 0, balls: 0 }).items, []);
  assert.deepEqual(S.upgrade({ v: 3, pos: 0, stake: 0, laps: 0, rolls: 0, bet: 0, won: 0, balls: 0, items: ["guard", "nope", "dice2", "x2", "x2"], guard: 9 }).items, ["guard", "dice2", "x2", "x2"]);
});

test("a line of balls laid at 100 pays the bingo prize on 100; a game saved with no bet scores for 100", () => {
  const w = S.RULES.normal[100],
    base = S.newCard(seq([0])),
    row = S.LINES[0],
    card = { ...base, owners: base.owners.map((o, i) => (row.slice(0, 6).includes(i) ? "amy" : o)) },
    ballAt = w.findIndex((x) => x.ball);
  const line = S.roll({ ...S.newState(), pos: at("normal") - 1 }, card, 100, seq([0, ballAt, draw(card.cells[row[6]]), 0]), "amy");
  assert.equal(line.events.find((e) => e.t === "prize").total, Math.round(100 * S.RULES.bingoPrize * S.RULES.soloBonus));
  assert.equal(S.settleBonus({ ...S.newState(), bonus: [{ game: "timer", mult: 1 }] }, 10).gain, 1000);
  assert.equal(S.gameScore("stop", "perfect", 100), 200);
});

test("the table shown before an event game: what each result gives back, from the bet", () => {
  const rows = (game, bet, plain) => S.payTable(game, bet, plain).map((r) => [r.key, r.back, r.net]);
  assert.deepEqual(rows("blackjack", 100, false), [["blackjack", 250, 150], ["win", 200, 100], ["push", 100, 0], ["lose", 0, -100]]);
  assert.deepEqual(rows("dice", 50, true), [["win", 100, 50], ["push", 50, 0], ["lose", 0, -50]]);
  assert.deepEqual(rows("chinchiro", 100, true).map((r) => r[1]), [600, 400, 300, 200, 100, 0]);
  // Only a win on the event square gives a ball.
  assert.deepEqual(S.payTable("blackjack", 100, false).map((r) => r.ball), [true, true, false, false]);
  assert.ok(S.payTable("blackjack", 100, true).every((r) => !r.ball));
  assert.deepEqual(S.payTable("nope", 100, false), []);
  // The table agrees with what settle() really pays for the same results.
  const card = S.newCard(seq([0])), s = { ...S.newState(), pos: at("event") - 1 };
  const out = S.roll(s, card, 100, seq([0, 0]));
  for (const row of S.payTable("blackjack", 100, false)) {
    const done = S.settle(out.state, card, row.m, seq([draw(card.cells[0])]));
    assert.equal(done.events.find((e) => e.t === "result").amount, row.back);
  }
});
