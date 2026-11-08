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
  // One super accident square; ヘルモード turns normal / accident / event round (START and the super square stay).
  assert.equal(Array.from({ length: S.SIZE }, (_, i) => S.kindAt(i)).filter((k) => k === "super").length, 1);
  assert.equal(S.kindNow(S.SIZE - 1, 0), S.kindAt(S.SIZE - 1));
  const kinds = Array.from({ length: S.SIZE }, (_, i) => [S.kindAt(i), S.kindNow(i, 5)]);
  assert.ok(kinds.every(([a, b]) => ({ normal: "accident", accident: "normal", event: "normal", start: "start", super: "super" })[a] === b));
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
    assert.equal(S.RULES.accident.filter((x) => x.take === 0).length, 1, "one SAFE on the accident wheel");
    // High risk, high return: from −20 times the bet to +18; the 確変 wheel holds the biggest multiples and the ball runs.
    for (const x of [18, 14, 10, 8, 6, 4, 0, -5, -6, -8, -10, -12, -15, -20]) assert.ok(values.has(x), cost + " has ×" + x);
    assert.equal(S.RULES.normal[cost].filter((slot) => slot.item).length, 5, "five item slots (they pay ×1 and an item)");
    // Some of what is on the wheel really pays the bet back or more (not only the hidden bonus slot).
    assert.ok(S.RULES.normal[cost].filter((slot) => !slot.kakuhen && slot.x >= 1).length >= 3, "a few slots pay ×1 or more");
    assert.equal(S.RULES.normal[cost].filter((slot) => slot.kakuhen).length, 1);
    for (const x of [21, 45, 65]) assert.ok(S.RULES.kakuhen.some((slot) => slot.x === x), "確変 has ×" + x);
    assert.ok(S.RULES.kakuhen.some((slot) => slot.balls === 8), "確変 has a ball run");
    assert.deepEqual(S.RULES.normal[cost].filter((x) => x.event).map((x) => x.event).sort(), ["blackjack", "blackjack", "chinchiro", "chinchiro", "dice", "dice"]);
    const w = S.RULES.normal[cost];
    assert.ok(w.every((slot, i) => JSON.stringify(slot) !== JSON.stringify(w[(i + 1) % w.length])), cost + " is spread");
  }
  // One bet: 100.
  assert.deepEqual(S.RULES.costs, [100]);
  // The bingo wheel (for a bet of 100): ×12 / ×20 / ×32 / ×50, four mini games (each twice), the jackpot and the super chance three times each.
  const bingo = S.RULES.wheels.bingo;
  assert.equal(bingo.length, 22);
  assert.deepEqual(bingo.filter((x) => x.x).map((x) => x.x).sort((a, b) => a - b), [12, 12, 20, 20, 32, 32, 50, 50]);
  assert.deepEqual(bingo.filter((x) => x.game).map((x) => x.game).sort(), ["dice", "dice", "math", "math", "tap", "tap", "timer", "timer"]);
  assert.equal(bingo.filter((x) => x.miss).length, 0);
  assert.equal(bingo.filter((x) => x.jackpot === "jp").length, 3);
  assert.equal(bingo.filter((x) => x.next === "sjp").length, 3);
  // The super chance: the super jackpot twice, the jackpot, the bigger tapping game, back.
  const sjp = S.RULES.wheels.sjp;
  assert.equal(sjp.length, 5);
  assert.equal(sjp.filter((x) => x.jackpot === "sjp").length, 2);
  assert.equal(sjp.filter((x) => x.jackpot === "jp").length, 1);
  assert.equal(sjp.filter((x) => x.game === "tapex").length, 1);
  assert.equal(sjp.filter((x) => x.back).length, 1);
  // The special number has its own wheel: multiples of the bet, or three more balls; no jackpot.
  const special = S.RULES.wheels.special;
  assert.ok(special.length >= 8 && special.every((x) => x.x > 0 || x.balls === 6));
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
  // Six more balls: each is an ordinary ball (here six numbers on the card, each opens its cell).
  const run = wheel.findIndex((x) => x.balls === 6),
    nums = card.cells.slice(0, 6);
  const three = S.roll(s, card, 100, seq([0, ballAt, draw(card.special), run, ...nums.map(draw)]), "amy");
  assert.equal(three.events.filter((e) => e.t === "ball").length, 7);
  assert.deepEqual(three.card.owners.slice(0, 6), Array(6).fill("amy"));
  assert.equal(three.state.balls, 7);
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
  const zero = S.RULES.normal[100].findIndex((x) => x.x === 0 && !x.ball && !x.game && !x.event && !x.item && !x.kakuhen);
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
  // A loss costs what the game loses, as at the casino: ×1 takes the bet (nothing comes back), ×2 (a double, a
  // ヒフミ) takes the bet and as much again (−100 comes back), a parent's ゾロ目 ×3 takes three times the bet.
  const lose1 = S.settle(out.state, card, -1, seq([0])),
    lose = S.settle(out.state, card, -2, seq([0])),
    lose3 = S.settle(out.state, card, -3, seq([0]));
  assert.deepEqual([lose1.gain, lose.gain, lose3.gain], [0, -100, -200]);
  assert.deepEqual([lose1.events[0].net, lose.events[0].net, lose3.events[0].net], [-100, -200, -300], "the result says what was lost in all, the bet included");
  assert.equal(S.settle(out.state, card, 1, seq([draw(closedOn(card))]), "amy").events[0].net, 100);
  assert.ok(!lose.events.some((e) => e.t === "ball"));
  // A plain game (a normal square's) loses the same.
  assert.equal(S.settle({ ...out.state, pending: { ...out.state.pending, plain: true } }, card, -2, seq([0])).gain, -100);
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

test("played the plain way by several players on one card, every bet returns a little under what goes in (with the ガード spent on big minuses)", () => {
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
        // The way the screen plays it: a ガード in the bag is spent on a big minus (5 times the bet or more, or a
        // lost bag / lost balls / ヘルモード), asked after the wheel; the same draws are used again with the choice.
        const tape = [];
        let out = S.roll(s, part.card, cost, (n) => (tape.push(random(n)), tape[tape.length - 1]), "p" + p);
        const minus = S.itemsOf(s).includes("guard") && out.events.find((e) => e.t === "minus");
        if (minus && ((minus.amount || 0) >= 5 * cost || minus.balls || minus.items || minus.hell)) {
          let at = 0;
          out = S.roll(s, part.card, cost, (n) => tape[at++] % n, "p" + p, { guard: true });
        }
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
    ten = S.RULES.kakuhen.findIndex((x) => x.x === 41);
  const out = S.roll({ ...S.newState(), pos: at("normal") - 1 }, S.newCard(seq([0])), 100, seq([0, kakuhen, 0, ten]));
  assert.equal(out.state.best, 4100);
});

test("a 確変 slot spins the 確変 wheel, which pays a multiple or draws a run of balls", () => {
  const kakuhen = S.RULES.normal[100].findIndex((x) => x.kakuhen),
    from = { ...S.newState(), pos: at("normal") - 1 };
  const wheels = (out) => out.events.filter((e) => e.t === "wheel").map((e) => e.wheel);
  // A multiple: ×40 pays 4,000 and draws nothing (the hidden slot starts it on a draw of 0 out of 4).
  const ten = S.RULES.kakuhen.findIndex((x) => x.x === 41);
  let out = S.roll(from, S.newCard(seq([0])), 100, seq([0, kakuhen, 0, ten]));
  assert.deepEqual(wheels(out), ["normal", "kakuhen"]);
  assert.equal(out.events.find((e) => e.wheel === "kakuhen").amount, 4100);
  assert.equal(out.gain, 4100);
  assert.equal(out.events.filter((e) => e.t === "ball").length, 0);
  // A run of eight balls: eight balls are drawn one after another (open numbers pay missPay).
  const run = S.RULES.kakuhen.findIndex((x) => x.balls === 8),
    card = [0, 1, 2, 3, 4, 5, 6, 7].reduce((c, i) => withOpen(c, i), S.newCard(seq([0])));
  out = S.roll(from, card, 100, seq([0, kakuhen, 0, run, ...card.cells.slice(0, 8).map(draw)]));
  assert.deepEqual(wheels(out), ["normal", "kakuhen"]);
  assert.equal(out.events.filter((e) => e.t === "ball").length, 8);
  assert.equal(out.state.balls, 8);
  assert.equal(out.gain, 8 * 100 * S.RULES.missPay);
  // The hidden slot starts the bonus only when the second draw is 0 (1 in chanceOdds); otherwise it pays ×0 and nothing else.
  out = S.roll(from, S.newCard(seq([0])), 100, seq([0, kakuhen, 1]));
  assert.deepEqual(wheels(out), ["normal"]);
  assert.equal(out.events.find((e) => e.wheel === "normal").chance, false);
  assert.equal(out.gain, 0);
  assert.equal(S.RULES.chanceOdds, 4);
});

test("the 確変 wheel keeps the normal wheel's pay: the top slots moved into it", () => {
  // Before the 確変 slots the top of the normal wheel paid ×10, ×5, ×1.5 and ×1 once in 40 each.
  const pay = S.RULES.kakuhen.reduce((n, slot) => n + (slot.x || 0), 0) / S.RULES.kakuhen.length;
  assert.ok(pay > 24 && pay < 60, "multiples on the 確変 wheel average " + pay);
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
  assert.deepEqual(["win", "tie", "lose", "auto"].map((d) => S.gameScore("hilo", d)), [125, 1000, 0, 50]);
  assert.equal(S.settleBonus(out.state, "perfect").gain, 200);
});

test("a normal square can take more than the bet, or start an event game", () => {
  const w = S.RULES.normal[100],
    pos = { ...S.newState(), pos: at("normal") - 1 },
    card = S.newCard(seq([0]));
  const minus = S.roll(pos, card, 100, seq([0, w.findIndex((x) => x.x === -5)]));
  assert.equal(minus.gain, -500);
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
  assert.deepEqual(S.RULES.itemWheel.filter((x) => x.item).map((x) => x.item).sort(), ["dice2", "dice2", "dice2", "dice2", "dice3", "exact", "guard", "guard", "x2", "x2"]);
  assert.equal(S.RULES.itemWheel.filter((x) => x.twice).length, 1, "one slot gives two items");
  assert.equal(S.RULES.itemWheel.length, 11);
  assert.ok(S.RULES.accident.every((x) => !x.give), "the accident wheel pays nothing");
  // A normal slot with an item: the item wheel spins and the bag gets the item.
  const got = S.roll(from, card, 100, seq([0, itemAt, pickItem("guard")]));
  assert.deepEqual(got.state.items, ["guard"]);
  assert.deepEqual(got.events.filter((e) => e.t === "wheel").map((e) => e.wheel), ["normal", "item"]);
  assert.deepEqual(got.events.find((e) => e.t === "itemGet"), { t: "itemGet", id: "guard", amount: 100 });
  assert.equal(got.gain, 100, "the item and 100 besides");
  // The 「2個」 slot: the two items it shows (ガード and 倍がけ), and the 100 only once.
  const twiceAt = S.RULES.itemWheel.findIndex((x) => x.twice);
  const twin = S.roll(from, card, 100, seq([0, itemAt, twiceAt]));
  assert.deepEqual(twin.state.items, ["guard", "x2"], "the two items the slot shows");
  assert.deepEqual(twin.events.filter((e) => e.t === "itemGet").map((e) => [e.twice, e.amount]), [[true, 100], [true, 0]]);
  assert.equal(twin.gain, 100);
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
  // An item that is not in the bag cannot be used; neither can one twice. ガード is not used before a roll.
  assert.throws(() => S.roll(from, card, 100, seq([0]), "amy", { items: ["x2"] }));
  assert.throws(() => S.roll({ ...from, items: ["x2", "x2"] }, card, 100, seq([0]), "amy", { items: ["x2", "x2"] }));
  assert.throws(() => S.roll({ ...from, items: ["guard"] }, card, 100, seq([0]), "amy", { items: ["guard"] }), /no such item/);
  assert.throws(() => S.roll(from, card, 100, seq([0]), "amy", { guard: true }), /no such item/, "no ガード in the bag");
  // ガード: spent on the first minus of a roll, when the player says so (use.guard). Every minus is announced.
  const accident = at("accident"),
    normal = at("normal"),
    nw = S.RULES.normal[100],
    minusAt = nw.findIndex((x) => x.x === -5),
    plusAt = nw.findIndex((x) => x.x === 6),
    held = { ...from, items: ["guard", "x2"] };
  // 1. An accident square's −: asked (minus event), then spent: nothing happens and the ガード leaves the bag.
  const asked = S.roll({ ...held, pos: accident - 1 }, card, 100, seq([0, 0]));
  assert.deepEqual(asked.events.find((e) => e.t === "minus"), { t: "minus", kind: "accident", amount: 600 });
  assert.equal(asked.gain, -600, "not spent: the minus happens");
  assert.deepEqual(asked.state.items, ["guard", "x2"]);
  const spent = S.roll({ ...held, pos: accident - 1 }, card, 100, seq([0, 0]), "amy", { guard: true });
  assert.equal(spent.gain, 0);
  assert.deepEqual(spent.state.items, ["x2"], "one ガード used");
  assert.equal(spent.events.filter((e) => e.t === "guarded").length, 1);
  assert.ok(spent.events.some((e) => e.t === "wheel" && e.wheel === "accident"), "the wheel still spins");
  // The same draws give the same roll up to the minus (so the player can be asked after the wheel).
  assert.deepEqual(asked.events.slice(0, asked.events.findIndex((e) => e.t === "minus")), spent.events.slice(0, spent.events.findIndex((e) => e.t === "minus")));
  // 2. Going back and START are minuses too (ガード keeps the piece where it is).
  const backAt = S.RULES.accident.findIndex((x) => x.back),
    startAt = S.RULES.accident.findIndex((x) => x.start);
  assert.deepEqual(S.roll({ ...held, pos: accident - 1 }, card, 100, seq([0, backAt])).events.find((e) => e.t === "minus"), { t: "minus", kind: "accident", back: 3 });
  assert.equal(S.roll({ ...held, pos: accident - 1 }, card, 100, seq([0, startAt]), "amy", { guard: true }).state.pos, accident);
  // 3. SAFE is not a minus: nothing asked, the ガード is kept even when use.guard is set.
  const safeAt = S.RULES.accident.findIndex((x) => x.take === 0);
  const calm = S.roll({ ...held, pos: accident - 1 }, card, 100, seq([0, safeAt]), "amy", { guard: true });
  assert.equal(calm.events.filter((e) => e.t === "minus" || e.t === "guarded").length, 0);
  assert.deepEqual(calm.state.items, ["guard", "x2"], "kept: no minus");
  // 4. The normal wheel: a minus slot pays nothing when spent; a plus slot is never touched.
  const blockedMinus = S.roll({ ...held, pos: normal - 1 }, card, 100, seq([0, minusAt]), "amy", { guard: true });
  assert.equal(blockedMinus.gain, 0);
  assert.equal(blockedMinus.events.find((e) => e.t === "wheel" && e.wheel === "normal").amount, 0);
  assert.deepEqual(blockedMinus.state.items, ["x2"]);
  const openMinus = S.roll({ ...held, pos: normal - 1 }, card, 100, seq([0, minusAt]), "amy");
  assert.equal(openMinus.gain, -500);
  assert.deepEqual(openMinus.events.find((e) => e.t === "minus"), { t: "minus", kind: "roulette", amount: 500 });
  const keptPlus = S.roll({ ...held, pos: normal - 1 }, card, 100, seq([0, plusAt]), "amy", { guard: true });
  assert.equal(keptPlus.gain, 600);
  assert.deepEqual(keptPlus.state.items, ["guard", "x2"]);
  // 5. Only the first minus of a roll can be blocked, and one ガード is spent (the second one stays).
  const pair = S.roll({ ...S.newState(), pos: accident - 1, items: ["guard", "guard"] }, card, 100, seq([0, 0]), "amy", { guard: true });
  assert.deepEqual(pair.state.items, ["guard"]);
  // 倍がけ: what the roll pays or takes counts twice (on any square), by at most x2Cap times the bet; it is used up.
  const plus = w.findIndex((x) => x.x === 6);
  const doubled = S.roll({ ...from, items: ["x2"] }, card, 100, seq([0, plus]), "amy", { items: ["x2"] });
  assert.equal(doubled.gain, 1200);
  assert.deepEqual(doubled.state.items, []);
  assert.deepEqual(doubled.events.find((e) => e.t === "x2"), { t: "x2", amount: 600 });
  const minus = w.findIndex((x) => x.x === -5);
  assert.equal(S.roll({ ...from, items: ["x2"] }, card, 100, seq([0, minus]), "amy", { items: ["x2"] }).gain, -1000);
  const onEvent = S.roll({ ...from, pos: at("event") - 1, items: ["x2"] }, card, 100, seq([0, 0]), "amy", { items: ["x2"] });
  assert.deepEqual(onEvent.state.items, [], "used up even when nothing was paid yet");
  // The extra is capped at 10 × the bet: a kakuhen run that pays 6,100 gains 1,000 more, not 6,100.
  const run = S.RULES.normal[100].findIndex((x) => x.kakuhen),
    sixty = S.RULES.kakuhen.findIndex((x) => x.x === 61);
  assert.equal(S.roll({ ...from, items: ["x2"] }, card, 100, seq([0, run, 0, sixty]), "amy", { items: ["x2"] }).gain, 6100 + 1000);
  // 倍がけ also doubles the result of the game the roll starts: a mini game's pay (settleBonus) and an event game's net (settle).
  const gameAt = w.findIndex((x) => x.game === "stop"),
    eventAt = w.findIndex((x) => x.event === "dice");
  const withGame = S.roll({ ...from, items: ["x2"] }, card, 100, seq([0, gameAt]), "amy", { items: ["x2"] });
  assert.equal(withGame.state.bonus[0].x2, true);
  assert.equal(withGame.events.find((e) => e.t === "x2").later, true);
  assert.equal(S.settleBonus(withGame.state, "perfect").gain, 200 + 200, "stop perfect pays ×2 of the bet, doubled");
  assert.equal(S.settleBonus(S.roll(from, card, 100, seq([0, gameAt])).state, "perfect").gain, 200, "without 倍がけ");
  assert.equal(S.bonusGain({ mult: 1, bet: 100, x2: true }, 5000), 5000 + 1000, "the extra is capped at x2Cap × the bet");
  const withEvent = S.roll({ ...from, items: ["x2"] }, card, 100, seq([0, eventAt]), "amy", { items: ["x2"] });
  assert.equal(withEvent.state.pending.x2, true);
  const won2 = S.settle(withEvent.state, card, 1, seq([0]));
  assert.equal(won2.gain, 200 + 100, "a win pays 200 and the doubled net adds 100 more");
  assert.equal(won2.events.find((e) => e.t === "x2").amount, 100);
  const lost2 = S.settle(withEvent.state, card, -1, seq([0]));
  assert.equal(lost2.gain, -100, "a loss of ×1 pays 0 back (net −100), doubled: −100 more");
  // Names every object has are not items; a roll counts for which copy of a game is further on.
  assert.deepEqual(S.itemsOf({ items: ["constructor", "__proto__", "toString", "guard"] }), ["guard"]);
  assert.equal(S.revOf({ rolls: 7 }), 7);
  assert.equal(S.roll({ ...S.newState(), rolls: 7, rev: undefined, pos: at("normal") - 1 }, card, 100, seq([0, zeroAt])).state.rev, 8);
  // An old save has no items; a bad one is cleaned.
  assert.deepEqual(S.upgrade({ v: 3, pos: 0, stake: 0, laps: 0, rolls: 0, bet: 0, won: 0, balls: 0 }).items, []);
  assert.deepEqual(S.upgrade({ v: 3, pos: 0, stake: 0, laps: 0, rolls: 0, bet: 0, won: 0, balls: 0, items: ["nope", "dice2", "x2", "x2"], guard: 9 }).items, ["dice2", "x2", "x2", "guard"], "a running ガード of an old save becomes one in the bag");
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

test("the split after a bingo: the prize and the wheel by player, what only the finisher gets", () => {
  const out = lineReady([slot("bingo", (x) => x.x === 12)]);
  const split = S.bingoSplit(out.events, "amy");
  assert.equal(split.count, 1);
  assert.equal(split.prize, 700);
  assert.equal(split.wheel, 1200);
  // amy first, then the others; ben's 6 balls of 7: 600 of the prize and 514 of the wheel.
  assert.deepEqual(split.rows.map((r) => [r.id, r.prize, r.wheel, r.total]), [["amy", 100, 1200 - 514, 100 + 1200 - 514], ["ben", 600, 514, 1114]]);
  assert.equal(split.rows.reduce((n, r) => n + r.total, 0), split.prize + split.wheel, "everything on the wheel goes to someone");
  assert.deepEqual([split.games, split.jackpots], [[], []]);
  // A jackpot or a mini game is the finisher's alone, and listed.
  const jp = S.bingoSplit(lineReady([slot("bingo", (x) => x.jackpot === "jp")]).events, "amy");
  assert.deepEqual(jp.jackpots, ["jp"]);
  assert.equal(jp.wheel, 0);
  const game = S.bingoSplit(lineReady([slot("bingo", (x) => x.game === "timer")]).events, "amy");
  assert.deepEqual(game.games, ["timer"]);
  // No line, nothing to show.
  assert.equal(S.bingoSplit(S.roll({ ...S.newState(), pos: at("normal") - 1 }, S.newCard(seq([0])), 100, seq([0, 0])).events, "amy"), null);
});

test("two ways of moving at once are refused by the rules (the screen offers only one of ダブル, トリプル, ぴったり)", () => {
  const card = S.newCard(seq([0])), from = { ...S.newState(), items: ["dice2", "dice3", "exact"] },
    zero = S.RULES.normal[100].findIndex((x) => x.x === 0 && !x.ball && !x.game && !x.event && !x.item && !x.kakuhen);
  for (const items of [["dice2", "dice3"], ["dice2", "exact"], ["dice3", "exact"]])
    assert.throws(() => S.roll(from, card, 100, seq([0]), "amy", { items, face: 3 }), /two kinds/, items.join("+"));
  // Any one of them goes with 倍がけ (and a ガード in the bag stays).
  const ok = S.roll({ ...from, items: ["dice3", "guard", "x2"] }, card, 100, seq([0, 1, 2, zero]), "amy", { items: ["dice3", "x2"] });
  assert.deepEqual(ok.state.items, ["guard"]);
});

test("the super accident square: −10 to −30 times, balls off, bag emptied, safe, lucky, ヘルモード", () => {
  const wheel = S.RULES.superAccident,
    sq = at("super"),
    slotAt = (test) => wheel.findIndex(test);
  assert.equal(wheel.length, 10);
  assert.deepEqual(wheel.filter((x) => x.take).map((x) => x.take).sort((a, b) => a - b), [10, 15, 20, 25, 30]);
  const base = S.newCard(seq([0])),
    from = { ...S.newState(), pos: sq - 1 };
  const roll = (state, card, index, extra = [], me = "amy", use) => S.roll(state, card, 100, seq([0, index, ...extra]), me, use);
  // −×30: 3,000 taken.
  const big = roll(from, base, slotAt((x) => x.take === 30));
  assert.equal(big.gain, -3000);
  assert.equal(big.events.find((e) => e.t === "wheel").wheel, "super");
  // SAFE: nothing.
  assert.equal(roll(from, base, slotAt((x) => x.take === 0 && !x.lucky)).gain, 0);
  // Balls off the card: the player's own only (ben's stay), with their bets.
  const owned = { ...base, owners: base.owners.map((o, k) => (k === 0 ? "amy" : k === 1 ? "ben" : k === 2 ? "amy" : o)), bets: base.owners.map((_, k) => (k < 3 ? 100 : 0)) };
  const cleared = roll(from, owned, slotAt((x) => x.resetBalls));
  assert.deepEqual(cleared.card.owners.slice(0, 3), ["", "ben", ""]);
  assert.deepEqual(cleared.card.bets.slice(0, 3), [0, 100, 0]);
  assert.deepEqual(cleared.events.find((e) => e.t === "reset"), { t: "reset", cells: [0, 2], own: true });
  // Bag emptied (ガード is not in the bag and stays).
  const lost = roll({ ...from, items: ["dice2", "x2", "x2"] }, base, slotAt((x) => x.resetItems));
  assert.deepEqual(lost.state.items, []);
  assert.equal(lost.events.find((e) => e.t === "itemsLost").count, 3);
  // LUCKY: the 確変 wheel spins (here ×41).
  const ten = S.RULES.kakuhen.findIndex((x) => x.x === 41);
  const lucky = roll(from, base, slotAt((x) => x.lucky), [ten]);
  assert.deepEqual(lucky.events.filter((e) => e.t === "wheel").map((e) => e.wheel), ["super", "kakuhen"]);
  assert.equal(lucky.gain, 4100);
  // ヘルモード: three times round the board; normal squares act as accidents until it ends.
  const hell = roll(from, base, slotAt((x) => x.hell));
  assert.equal(hell.state.hell, 3 * S.SIZE);
  assert.ok(hell.events.some((e) => e.t === "hell"));
  const normal = at("normal"),
    inHell = S.roll({ ...S.newState(), pos: normal - 1, hell: 50 }, base, 100, seq([0, 0]), "amy");
  assert.equal(inHell.events.find((e) => e.t === "land").kind, "accident", "a normal square is an accident in ヘルモード");
  assert.equal(inHell.events.find((e) => e.t === "wheel").wheel, "accident");
  assert.equal(inHell.state.hell, 49, "one square moved");
  const accident = at("accident"),
    swapped = S.roll({ ...S.newState(), pos: accident - 1, hell: 50 }, base, 100, seq([0, 0]), "amy");
  assert.equal(swapped.events.find((e) => e.t === "wheel").wheel, "normal", "an accident square is a normal one");
  const end = S.roll({ ...S.newState(), pos: normal - 1, hell: 1 }, base, 100, seq([0, 0]), "amy");
  assert.ok(end.events.some((e) => e.t === "hellEnd"));
  assert.equal(end.state.hell, 0);
  assert.equal(end.events.find((e) => e.t === "land").kind, "normal", "the last square is already a normal one");
  // ガード (spent) stops every bad slot; the bad slots are announced as a minus (not SAFE or LUCKY).
  for (const test of [(x) => x.take === 20, (x) => x.resetBalls, (x) => x.resetItems, (x) => x.hell]) {
    const g = roll({ ...from, items: ["x2", "guard"] }, owned, slotAt(test), [], "amy", { guard: true });
    assert.equal(g.gain, 0);
    assert.equal(g.state.hell, 0);
    assert.deepEqual(g.state.items, ["x2"], "only the ガード left");
    assert.deepEqual(g.card.owners.slice(0, 3), ["amy", "ben", "amy"]);
    assert.equal(g.events.filter((e) => e.t === "guarded").length, 1);
    assert.equal(roll({ ...from, items: ["x2", "guard"] }, owned, slotAt(test)).events.filter((e) => e.t === "minus").length, 1);
  }
  assert.equal(roll({ ...from, items: ["guard"] }, owned, slotAt((x) => x.lucky), [0], "amy", { guard: true }).state.items.length, 1, "LUCKY is no minus");
  // The accident wheel has one slot of its own that leads to the super accident wheel (two wheels in a row).
  assert.equal(S.RULES.accident.filter((x) => x.super).length, 1);
  const viaWheel = S.roll({ ...S.newState(), pos: at("accident") - 1 }, base, 100, seq([0, S.RULES.accident.findIndex((x) => x.super), slotAt((x) => x.take === 10)]), "amy");
  assert.deepEqual(viaWheel.events.filter((e) => e.t === "wheel").map((e) => e.wheel), ["accident", "super"]);
  assert.equal(viaWheel.gain, -1000);
  const guardedVia = S.roll({ ...S.newState(), pos: at("accident") - 1, items: ["guard"] }, base, 100, seq([0, S.RULES.accident.findIndex((x) => x.super), slotAt((x) => x.take === 10)]), "amy", { guard: true });
  assert.equal(guardedVia.gain, 0, "ガード works on the super wheel reached from the accident wheel too");
  assert.deepEqual(guardedVia.state.items, []);
  // An old save has no hell.
  assert.equal(S.upgrade({ v: 3, pos: 0, stake: 0, laps: 0, rolls: 0, bet: 0, won: 0, balls: 0 }).hell, 0);
  assert.equal(S.upgrade({ v: 3, pos: 0, stake: 0, laps: 0, rolls: 0, bet: 0, won: 0, balls: 0, hell: 99999 }).hell, 3 * S.SIZE);
});
