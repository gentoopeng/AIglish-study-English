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
  assert.equal(S.SIZE, 100);
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
    // From ×0.25 down to a minus that takes another bet; the top of the wheel is the 確変 slots,
    // and the 確変 wheel holds ×10 / ×5 and the ball runs.
    for (const x of [0.25, 0, -0.5, -1]) assert.ok(values.has(x), cost + " has ×" + x);
    assert.equal(S.RULES.normal[cost].filter((slot) => slot.kakuhen).length, 1);
    for (const x of [10, 40]) assert.ok(S.RULES.kakuhen.some((slot) => slot.x === x), "確変 has ×" + x);
    assert.ok(S.RULES.kakuhen.some((slot) => slot.balls === 5), "確変 has a ball run");
    assert.deepEqual(S.RULES.normal[cost].filter((x) => x.event).map((x) => x.event).sort(), ["blackjack", "blackjack", "chinchiro", "chinchiro", "dice", "dice"]);
    const w = S.RULES.normal[cost];
    assert.ok(w.every((slot, i) => JSON.stringify(slot) !== JSON.stringify(w[(i + 1) % w.length])), cost + " is spread");
  }
  // One fixed bet for everybody.
  assert.deepEqual(S.RULES.costs, [100]);
  // The bingo wheel: ×10 / ×20 / ×50, four mini games, the jackpot twice and the super chance.
  const bingo = S.RULES.wheels.bingo;
  assert.equal(bingo.length, 10);
  assert.deepEqual(bingo.filter((x) => x.x).map((x) => x.x).sort((a, b) => a - b), [10, 20, 50]);
  assert.deepEqual(bingo.filter((x) => x.game).map((x) => x.game).sort(), ["dice", "math", "tap", "timer"]);
  assert.equal(bingo.filter((x) => x.miss).length, 0);
  assert.equal(bingo.filter((x) => x.jackpot === "jp").length, 2);
  assert.equal(bingo.filter((x) => x.next === "sjp").length, 1);
  // The super chance: the super jackpot twice, the jackpot, the bigger tapping game, back.
  const sjp = S.RULES.wheels.sjp;
  assert.equal(sjp.length, 5);
  assert.equal(sjp.filter((x) => x.jackpot === "sjp").length, 2);
  assert.equal(sjp.filter((x) => x.jackpot === "jp").length, 1);
  assert.equal(sjp.filter((x) => x.game === "tapex").length, 1);
  assert.equal(sjp.filter((x) => x.back).length, 1);
  // An old save (with its own card) keeps its place and counts.
  const old = { v: 2, pos: 7, card: [], marks: [], lines: [], stake: 30, laps: 1, rolls: 5, bet: 50, won: 20, balls: 1, cards: 0, bingos: 0, pending: null };
  assert.ok(S.valid(old));
  assert.deepEqual(S.upgrade(old), { ...S.newState(), pos: 7, stake: 30, laps: 1, rolls: 5, bet: 50, won: 20, balls: 1 });
});

test("a ball on the shared card opens it in the player's name; off the card or open pays twice the bet", () => {
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
  const miss = S.roll(s, card, 100, seq([0, ballAt, draw(offCard(card))]), "amy");
  assert.equal(miss.gain, 200);
  assert.deepEqual(miss.card, card);
  // Someone else's ball already there is a miss too.
  const taken = S.roll(s, hit.card, 100, seq([0, ballAt, draw(hitNo)]), "ben");
  assert.equal(taken.events.find((e) => e.t === "ball").miss, true);
  assert.throws(() => S.roll(s, card, 50, seq([0])));
});

test("a line pays on the player's own stake, then its numbers are drawn afresh and its balls cleared", () => {
  const base = S.newCard(seq([0])),
    last = S.LINES[0][6],
    // ben's balls on the top row and the last column, all but their shared corner.
    lineCells = new Set([...S.LINES[0], ...S.LINES[13]]),
    card = { ...base, owners: base.owners.map((o, i) => (o === "*" ? o : lineCells.has(i) && i !== last ? "ben" : "")) },
    s = { ...S.newState(), pos: at("normal") - 1, stake: 400 };
  const ballAt = S.RULES.normal[100].findIndex((x) => x.ball),
    five = S.RULES.wheels.bingo.findIndex((x) => x.x === 10);
  const out = S.roll(s, card, 100, seq([0, ballAt, draw(card.cells[last]), five, 0]), "amy");
  const line = out.events.find((e) => e.t === "line");
  assert.deepEqual(line.lines, [0, 13]);
  assert.equal(line.count, 2);
  assert.equal(line.solo, false);
  // n lines at once: (n + 1)× the bingo prize (10× the bet) and the wheel's bet × 10.
  assert.equal(line.mult, line.count + 1);
  // Half the prize (3,000 here) is shared by the 13 balls on the two lines: ben's 12 parts of
  // 1,500 (1,384) wait on the card for him, amy keeps the rest. Of the wheel's × 10 (3,000),
  // 30% goes the same way: ben's 12 parts of 900 make 830, amy keeps 2,170.
  const prize = out.events.find((e) => e.t === "prize");
  assert.equal(prize.total, 1000 * line.mult);
  assert.deepEqual(prize.shares, { ben: 1384 });
  assert.equal(prize.amount, 3000 - 1384);
  const spin = out.events.find((e) => e.t === "wheel" && e.wheel === "bingo");
  assert.equal(spin.total, 1000 * line.mult);
  assert.deepEqual(spin.shares, { ben: 830 });
  assert.equal(spin.amount, 3000 - 830);
  assert.deepEqual(out.card.owed, { ben: 1384 + 830 });
  assert.equal(out.gain, 1616 + 2170);
  // ben takes his part when he next plays, once.
  const got = S.collect(out.card, "ben");
  assert.equal(got.amount, 2214);
  assert.deepEqual(got.card.owed, {});
  assert.equal(S.collect(got.card, "ben").amount, 0);
  assert.equal(out.state.stake, 0);
  assert.equal(out.state.bingos, line.count);
  // Every cell of the finished lines is closed again with a number new to the card.
  const reset = out.events.find((e) => e.t === "reset");
  for (const c of line.cells.filter((c) => c !== S.FREE)) {
    assert.equal(out.card.owners[c], "");
    assert.equal(out.card.cells[c], reset.numbers[c]);
  }
  assert.ok(S.validCard(out.card));
  // The same double line landing on a mini game: the game is not multiplied by the lines, only
  // by bingoGameBoost (2).
  const timerAt = S.RULES.wheels.bingo.findIndex((x) => x.game === "timer");
  const mini = S.roll(s, card, 100, seq([0, ballAt, draw(card.cells[last]), timerAt, 0]), "amy");
  assert.deepEqual(mini.state.bonus, [{ game: "timer", mult: 2 }]);
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
    twenty = S.RULES.wheels.bingo.findIndex((x) => x.x === 20);
  const out = S.roll(s, card, 100, seq([0, ballAt, draw(card.cells[row[6]]), twenty, 0]), "amy");
  const line = out.events.find((e) => e.t === "line");
  assert.equal(line.count, 1);
  assert.equal(line.solo, true);
  assert.equal(line.mult, S.RULES.soloBonus);
  assert.equal(out.events.find((e) => e.t === "wheel" && e.wheel === "bingo").amount, 2000 * S.RULES.soloBonus);
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
  assert.equal(S.settle(out.state, card, 1, seq([draw(offCard(card))])).gain, 400);
  assert.equal(S.settle(out.state, card, 1.5, seq([0])).events[0].amount, 250);
  assert.equal(S.settle(out.state, card, 0, seq([0])).gain, 100);
  const lose = S.settle(out.state, card, -2, seq([0]));
  assert.equal(lose.gain, 25);
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
  // amy's part of the prize: half is shared by the 7 balls, ben's 6 parts (428) wait on the card.
  assert.equal(jp.gain, 1000 - 428);
  // The jackpot waits in the state until the screen pays it.
  assert.deepEqual(jp.state.jpWait, ["jp"]);
  assert.equal(jp.state.jps, 1);
  const sjp = lineReady([slot("bingo", (x) => x.next), slot("sjp", (x) => x.jackpot === "sjp")]);
  assert.deepEqual(sjp.events.filter((e) => e.t === "wheel").map((e) => e.wheel), ["normal", "bingo", "sjp"]);
  assert.deepEqual(sjp.events.find((e) => e.t === "jackpot"), { t: "jackpot", kind: "sjp" });
  // Back: the bingo wheel again, here landing on × 10.
  const back = lineReady([slot("bingo", (x) => x.next), slot("sjp", (x) => x.back), slot("bingo", (x) => x.x === 10)]);
  assert.deepEqual(back.events.filter((e) => e.t === "wheel").map((e) => e.wheel), ["normal", "bingo", "sjp", "bingo"]);
  // × 10 = 1,000, of which ben's 6 balls of 7 take 30%: 257.
  assert.equal(back.gain, 572 + 1000 - 257);
  assert.deepEqual(sjp.state.jpWait, ["sjp"]);
});

test("a mini game waits in state.bonus, blocks rolling and pays its score, 0 when left", () => {
  const out = lineReady([slot("bingo", (x) => x.game === "timer")]);
  // A bingo wheel's mini game scores bingoGameBoost (2) times its points.
  assert.deepEqual(out.state.bonus, [{ game: "timer", mult: 2 }]);
  assert.throws(() => S.roll(out.state, out.card, 100, seq([0])));
  assert.equal(S.settleBonus(out.state, 10).gain, 2000);
  assert.equal(S.settleBonus(out.state, 10.03).gain, 1970);
  assert.equal(S.settleBonus(out.state, 12.5).gain, 0);
  assert.equal(S.settleBonus(out.state, null).gain, 0);
  assert.deepEqual(S.settleBonus(out.state, 10).state.bonus, []);
  assert.equal(S.gameScore("tap", 70), 700);
  assert.equal(S.gameScore("tapex", 70), 1750);
  assert.equal(S.gameScore("dice", 4), 400);
  assert.equal(S.gameScore("math", true), 500);
  assert.equal(S.gameScore("math", false), 0);
  // Super chance → the bigger tapping game.
  const ex = lineReady([slot("bingo", (x) => x.next), slot("sjp", (x) => x.game === "tapex")]);
  assert.deepEqual(ex.state.bonus, [{ game: "tapex", mult: 2 }]);
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
  assert.equal(S.gameScore("dice", 99), 600);
  assert.equal(S.gameScore("timer", "x"), 0);
  assert.equal(S.gameScore("timer", Infinity), 0);
});

test("a shared card read back is checked before it is used", () => {
  const card = S.newCard(seq([0]));
  assert.equal(S.validCard(card), true);
  assert.equal(S.validCard({ ...card, owed: { ben: 30 } }), true);
  const bad = [
    { ...card, cells: card.cells.map((n, i) => (i === 3 ? 101 : n)) },
    { ...card, cells: card.cells.map((n, i) => (i === 3 ? 2.5 : n)) },
    { ...card, cells: card.cells.map((n, i) => (i === S.FREE ? 7 : n)) },
    { ...card, owners: card.owners.map((o, i) => (i === 3 ? "*" : o)) },
    { ...card, owners: card.owners.map((o, i) => (i === 3 ? "x".repeat(65) : o)) },
    { ...card, owners: card.owners.map((o, i) => (i === S.FREE ? "" : o)) },
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
  // A run of five balls: five balls are drawn one after another (numbers off the card pay missPay).
  const run = S.RULES.kakuhen.findIndex((x) => x.balls === 5),
    card = S.newCard(seq([0])),
    off = Array.from({ length: 100 }, (_, i) => i + 1).filter((n) => !card.cells.includes(n));
  out = S.roll(from, card, 100, seq([0, kakuhen, run, ...off.slice(0, 5).map(draw)]));
  assert.deepEqual(wheels(out), ["normal", "kakuhen"]);
  assert.equal(out.events.filter((e) => e.t === "ball").length, 5);
  assert.equal(out.state.balls, 5);
  assert.equal(out.gain, 5 * 100 * S.RULES.missPay);
});

test("the 確変 wheel keeps the normal wheel's pay: the top slots moved into it", () => {
  // Before the 確変 slots the top of the normal wheel paid ×10, ×5, ×1.5 and ×1 once in 40 each.
  const pay = S.RULES.kakuhen.reduce((n, slot) => n + (slot.x || 0), 0) / S.RULES.kakuhen.length;
  assert.ok(pay > 12 && pay < 25, "multiples on the 確変 wheel average " + pay);
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
  assert.deepEqual(out.state.bonus, [{ game: "stop", mult: 1 }]);
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
