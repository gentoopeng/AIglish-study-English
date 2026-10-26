const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../casino-model.js");

// A random(n) that walks a fixed list, so a round can be played the same way every time.
const seq = (values) => {
  let i = 0;
  return (n) => values[i++ % values.length] % n;
};
// mulberry32: small and evenly spread, unlike a plain LCG's low bits.
const rng = (seed) => (n) => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
};

test("blackjack totals count aces as 1 or 11", () => {
  assert.deepEqual(C.bjTotal(["As", "6h"]), { total: 17, soft: true });
  assert.deepEqual(C.bjTotal(["As", "6h", "9d"]), { total: 16, soft: false });
  assert.deepEqual(C.bjTotal(["As", "Ad", "9c"]), { total: 21, soft: true });
  assert.equal(C.isBlackjack(["Ah", "Kd"]), true);
  assert.equal(C.isBlackjack(["7h", "7d", "7c"]), false);
});

// A deck that deals the given cards first (in that order), then anything.
const fromDeck = (cards) => {
  const P = require("../poker-model.js");
  const deck = P.deck().filter((c) => !cards.includes(c)).concat(cards.slice().reverse());
  const original = P.shuffle;
  P.shuffle = () => deck.slice();
  return () => (P.shuffle = original);
};

test("the dealer starts with one card and draws the rest after everyone, one at a time to 17", () => {
  // Deal order: p1, p2, dealer, p1, p2; then hits, then the dealer's cards.
  const restore = fromDeck(["Th", "9d", "6c", "8h", "7c", "Kd", "5s", "4h"]);
  let t = C.tableDeal(["p1", "p2"], { p1: 10, p2: 20 }, () => 0);
  restore();
  assert.deepEqual(t.dealer, ["6c"]);
  assert.deepEqual(t.seats.p1.hands[0].cards, ["Th", "8h"]);
  assert.deepEqual(t.seats.p2.hands[0].cards, ["9d", "7c"]);
  assert.equal(t.turn, "p1");
  assert.equal(C.tableAct(t, "p2", "hit"), t, "only the player whose turn it is can act");
  t = C.tableAct(t, "p1", "stand");
  assert.equal(t.turn, "p2");
  t = C.tableAct(t, "p2", "hit"); // 16 + K = bust
  assert.equal(t.done, true);
  // The dealer turns 5 (11), then 4 (15)... and keeps drawing to 17.
  assert.equal(t.dealer[0], "6c");
  assert.ok(C.bjTotal(t.dealer).total >= 17);
  assert.equal(C.tableOutcome(t, "p2").results[0].outcome, "bust");
});

test("a natural pays 3 to 2 unless the dealer's second card makes one too", () => {
  let restore = fromDeck(["Ah", "9c", "Kd", "5s"]);
  let t = C.tableDeal(["me"], { me: 10 }, () => 0);
  restore();
  assert.equal(t.done, true, "nobody left to act");
  assert.deepEqual(t.dealer, ["9c", "5s"], "with no live hand the dealer only turns one more");
  assert.deepEqual(C.tableOutcome(t, "me"), { results: [{ outcome: "blackjack", net: 15, stake: 10 }], net: 15, stake: 10 });
  restore = fromDeck(["Ah", "Tc", "Kd", "As"]);
  t = C.tableDeal(["me"], { me: 10 }, () => 0);
  restore();
  assert.equal(C.tableOutcome(t, "me").results[0].outcome, "push");
});

test("double down takes one card for twice the bet", () => {
  const restore = fromDeck(["5h", "Tc", "6d", "Ts", "7s"]);
  let t = C.tableDeal(["me"], { me: 10 }, () => 0);
  restore();
  assert.equal(C.tableCan(t, "me", "double"), true);
  assert.equal(C.tableCost(t, "me", "double"), 10);
  t = C.tableAct(t, "me", "double");
  assert.deepEqual(t.seats.me.hands[0].cards, ["5h", "6d", "Ts"]);
  assert.deepEqual(t.dealer, ["Tc", "7s"]);
  assert.deepEqual(C.tableOutcome(t, "me"), { results: [{ outcome: "win", net: 20, stake: 20 }], net: 20, stake: 20 });
  assert.equal(C.tableCan(t, "me", "double"), false);
});

test("split plays each half as its own hand; split aces take one card each", () => {
  let restore = fromDeck(["8h", "Tc", "8d", "3s", "Kc", "Ts", "7s"]);
  let t = C.tableDeal(["me"], { me: 10 }, () => 0);
  restore();
  assert.equal(C.tableCan(t, "me", "split"), true);
  assert.equal(C.tableCan(t, "me", "hit"), true);
  t = C.tableAct(t, "me", "split");
  assert.deepEqual(t.seats.me.hands.map((h) => h.cards), [["8h", "3s"], ["8d", "Kc"]]);
  assert.equal(t.seats.me.active, 0);
  t = C.tableAct(t, "me", "double"); // 11 + T = 21 on the first half, doubled
  assert.equal(t.seats.me.active, 1);
  t = C.tableAct(t, "me", "stand"); // 18 on the second
  assert.equal(t.done, true);
  assert.deepEqual(t.dealer, ["Tc", "7s"]);
  const out = C.tableOutcome(t, "me");
  assert.deepEqual(out.results.map((r) => r.outcome), ["win", "win"]);
  assert.equal(out.net, 30);
  assert.equal(out.stake, 30);
  // Aces: one card each and done; A+K after a split is 21, not a blackjack.
  restore = fromDeck(["Ah", "9c", "Ad", "Kh", "5c", "8s"]);
  t = C.tableDeal(["me"], { me: 10 }, () => 0);
  restore();
  t = C.tableAct(t, "me", "split");
  assert.equal(t.done, true);
  assert.deepEqual(C.tableOutcome(t, "me").results.map((r) => r.outcome), ["win", "lose"]);
  assert.equal(C.tableOutcome(t, "me").results[0].net, 10, "21 after a split pays even money");
});

test("a player who leaves mid-round is dropped and play moves on", () => {
  const restore = fromDeck(["Th", "9h", "6s", "8d", "9s", "Kd", "Ac"]);
  let u = C.tableDeal(["a", "b"], { a: 5, b: 5 }, () => 0);
  restore();
  u = C.tableDrop(u, "a");
  assert.deepEqual(u.order, ["b"]);
  assert.equal(u.turn, "b");
  u = C.tableAct(u, "b", "stand");
  assert.equal(u.done, true);
  assert.equal(C.tableOutcome(u, "b").results[0].outcome, "win");
});

test("blackjack head to head: both draw, nearer 21 wins, busts and naturals", () => {
  const keep = (n) => n - 1; // deck in order: Ac, Kc, Qc, Jc, Tc …
  let g = C.duelDeal(["a", "b"], keep);
  assert.deepEqual(g.hands.a.cards, ["Ac", "Qc"]);
  assert.deepEqual(g.hands.b.cards, ["Kc", "Jc"]);
  assert.equal(g.hands.a.done, true, "a two-card 21 needs no move");
  assert.equal(C.duelDone(g), false);
  g = C.duelAct(g, "b", "stand");
  assert.equal(C.duelDone(g), true);
  assert.equal(C.duelCompare(g.hands.a.cards, g.hands.b.cards), 1);
  assert.equal(C.duelCompare(["Th", "9d"], ["Tc", "9s"]), 0);
  assert.equal(C.duelCompare(["Th", "6d", "8c"], ["2c", "3s"]), -1, "over 21 loses to anything under");
  assert.equal(C.duelCompare(["Th", "6d", "8c"], ["Tc", "6s", "9h"]), 0, "two busts tie");
  assert.equal(C.duelCompare(["Ah", "Kd"], ["7c", "7s", "7h"]), 1, "a natural beats a drawn 21");
  // Hitting to 21 or over ends that hand only.
  const h = C.duelAct({ deck: ["5c"], hands: { a: { cards: ["Th", "6d"], done: false }, b: { cards: ["2c", "3d"], done: false } } }, "a", "hit");
  assert.equal(h.hands.a.done, true);
  assert.equal(h.hands.b.done, false);
});

test("the dice dealer plays the fixed way and hands compare", () => {
  const d = C.diceDealer(rng(5));
  assert.equal(d.dice.length, 5);
  assert.ok(d.rolls.length >= 1 && d.rolls.length <= 3);
  assert.ok(C.diceVs([5, 5, 5, 6, 6], [6, 6, 6, 1, 2]) > 0, "a full house beats three of a kind");
});

test("chinchiro hands, strongest first", () => {
  const name = (d) => C.chinHand(d)?.name ?? null;
  assert.equal(name([1, 1, 1]), "ピンゾロ");
  assert.equal(name([4, 4, 4]), "4のゾロ目");
  assert.equal(name([6, 4, 5]), "シゴロ");
  assert.equal(name([3, 1, 2]), "ヒフミ");
  assert.equal(name([2, 2, 5]), "5の目");
  assert.equal(name([6, 3, 3]), "6の目");
  assert.equal(name([1, 3, 5]), null);
  const rank = (d) => C.chinHand(d).rank;
  assert.ok(rank([1, 1, 1]) > rank([6, 6, 6]) && rank([6, 6, 6]) > rank([2, 2, 2]) && rank([2, 2, 2]) > rank([4, 5, 6]));
  assert.ok(rank([4, 5, 6]) > rank([5, 5, 6]) && rank([5, 5, 6]) > rank([5, 5, 1]) && rank([5, 5, 1]) > rank([1, 2, 3]));
});

test("chinchiro rolls up to three times, and settles against the parent", () => {
  // No hand twice, then a point.
  const throws = [1, 3, 5, 2, 4, 6, 2, 2, 5].map((n) => n - 1);
  let i = 0;
  const random = () => throws[i++];
  let t = C.chinStart();
  t = C.chinNext(t, random);
  assert.equal(t.done, false);
  t = C.chinNext(t, random);
  assert.equal(t.done, false);
  t = C.chinNext(t, random);
  assert.equal(t.done, true);
  assert.equal(t.hand.name, "5の目");
  assert.equal(C.chinNext(t, random), t);
  // Three throws without a hand is 目なし.
  i = 0;
  const none = C.chinNext(C.chinNext(C.chinNext(C.chinStart(), () => [0, 2, 4][i++ % 3]), () => [1, 3, 5][i++ % 3]), () => [0, 2, 4][i++ % 3]);
  assert.equal(none.hand.name, "目なし");
  const H = (d) => C.chinHand(d);
  // A decisive parent settles at once.
  assert.equal(C.chinParentDecides(H([1, 1, 1])), -5);
  assert.equal(C.chinParentDecides(H([4, 5, 6])), -2);
  assert.equal(C.chinParentDecides(H([1, 2, 3])), 2);
  assert.equal(C.chinParentDecides(none.hand), 1);
  assert.equal(C.chinParentDecides(H([3, 3, 4])), null);
  // Otherwise points compare, and the child's own big or bad hands count.
  assert.equal(C.chinSettle(H([3, 3, 4]), H([5, 5, 6])), 1);
  assert.equal(C.chinSettle(H([3, 3, 4]), H([5, 5, 2])), -1);
  assert.equal(C.chinSettle(H([3, 3, 4]), H([1, 1, 4])), 0);
  assert.equal(C.chinSettle(H([3, 3, 4]), H([2, 2, 2])), 3);
  assert.equal(C.chinSettle(H([3, 3, 4]), H([1, 2, 3])), -2);
  assert.equal(C.chinSettle(H([3, 3, 4]), none.hand), -1);
  assert.equal(C.chinVs(H([6, 6, 6]), H([4, 5, 6])), 1);
  assert.equal(C.chinVs(H([2, 2, 3]), H([1, 1, 3])), 0);
  assert.equal(C.chinTurn(rng(3)).done, true);
});

test("roulette pays by the spot and zero loses outside bets", () => {
  const bets = [
    { on: "red", amount: 10 },
    { on: "d1", amount: 5 },
    { on: "7", amount: 2 },
  ];
  assert.deepEqual(C.rouletteSettle(bets, 7).lines.map((l) => l.net), [10, 10, 70]);
  assert.equal(C.rouletteSettle(bets, 8).net, -2); // 8 is black: the red bet and the number lose, the dozen wins
  assert.equal(C.rouletteSettle(bets, 0).net, -17);
  assert.equal(C.rouletteSettle([{ on: "0", amount: 1 }], 0).net, 35);
  assert.equal(C.colourOf(32), "red");
  assert.equal(C.colourOf(0), "green");
  assert.equal(C.spot("37"), null);
  // A row bet: 3, 6 … 36 pays 2 to 1, and zero is in no row.
  assert.equal(C.rouletteSettle([{ on: "c3", amount: 4 }], 36).net, 8);
  assert.equal(C.rouletteSettle([{ on: "c1", amount: 4 }], 34).net, 8);
  assert.equal(C.rouletteSettle([{ on: "c2", amount: 4 }], 0).net, -4);
  assert.equal(new Set(C.WHEEL).size, 37);
});

test("roulette keeps the house edge of a single-zero wheel", () => {
  let total = 0;
  for (let n = 0; n <= 36; n++) total += C.rouletteSettle([{ on: "red", amount: 1 }, { on: "17", amount: 1 }, { on: "d3", amount: 1 }], n).net;
  assert.equal(total, -3); // -1/37 of every point staked
});

test("dice poker ranks hands", () => {
  const rank = (d) => C.diceScore(d)[0];
  assert.equal(rank([4, 4, 4, 4, 4]), 7);
  assert.equal(rank([4, 4, 4, 4, 1]), 6);
  assert.equal(rank([2, 2, 5, 5, 5]), 5);
  assert.equal(rank([2, 3, 4, 5, 6]), 4);
  assert.equal(rank([1, 3, 4, 5, 6]), 0);
  assert.equal(rank([3, 3, 3, 1, 6]), 3);
  assert.equal(rank([3, 3, 1, 1, 6]), 2);
  assert.equal(rank([6, 6, 1, 2, 4]), 1);
  assert.ok(C.compare(C.diceScore([6, 6, 1, 2, 3]), C.diceScore([5, 5, 4, 2, 6])) > 0);
  assert.ok(C.compare(C.diceScore([2, 3, 4, 5, 6]), C.diceScore([1, 2, 3, 4, 5])) > 0);
  assert.equal(C.compare(C.diceScore([1, 1, 2, 3, 4]), C.diceScore([4, 3, 1, 2, 1])), 0);
});

test("dice poker holds, re-rolls twice and settles against the dealer", () => {
  let round = C.diceStart(10, seq([0, 0, 0, 1, 2]));
  assert.deepEqual(round.dice, [1, 1, 1, 2, 3]);
  round = C.diceToggle(C.diceToggle(C.diceToggle(round, 0), 1), 2);
  round = C.diceReroll(round, seq([0, 0]));
  assert.deepEqual(round.dice, [1, 1, 1, 1, 1]);
  assert.equal(round.rolls, 2);
  round = C.diceStand(round, rng(3));
  assert.equal(round.done, true);
  assert.equal(round.outcome, "win");
  assert.equal(round.net, 10);
  assert.equal(C.diceReroll(round, rng(1)), round);
});

test("the dealer keeps what matters", () => {
  assert.deepEqual(C.dealerKeeps([2, 5, 5, 3, 1]), [false, true, true, false, false]);
  assert.deepEqual(C.dealerKeeps([2, 3, 4, 5, 6]), [true, true, true, true, true]);
  assert.deepEqual(C.dealerKeeps([1, 2, 3, 4, 6]), [false, false, false, false, true]);
});

test("over many rounds no game gives away points", () => {
  const random = rng(42);
  let bj = 0,
    dice = 0;
  for (let i = 0; i < 4000; i++) {
    let round = C.tableDeal(["me"], { me: 10 }, random);
    while (!round.done) round = C.tableAct(round, "me", C.bjTotal(round.seats.me.hands[round.seats.me.active].cards).total < 17 ? "hit" : "stand");
    bj += C.tableOutcome(round, "me").net;
    // Playing the dealer's own way comes out about even.
    let d = C.diceStart(10, random);
    for (let r = 0; r < 2; r++) {
      const keep = C.dealerKeeps(d.dice);
      d = { ...d, held: keep };
      d = C.diceReroll(d, random);
    }
    d = C.diceStand(d, random);
    dice += d.net;
  }
  assert.ok(bj < 0, "blackjack " + bj);
  assert.ok(Math.abs(dice) < 4000 * 10 * 0.2, "dice " + dice);
});
