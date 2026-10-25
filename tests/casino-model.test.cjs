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

test("blackjack settles each outcome with the right amount", () => {
  const base = { game: "blackjack", bet: 10, deck: [], doubled: false, done: false };
  assert.equal(C.bjStand({ ...base, player: ["Th", "9d"], dealer: ["Tc", "8s"] }).net, 10);
  assert.equal(C.bjStand({ ...base, player: ["Th", "8d"], dealer: ["Tc", "8s"] }).outcome, "push");
  assert.equal(C.bjStand({ ...base, player: ["Th", "7d"], dealer: ["Tc", "8s"] }).net, -10);
  // The dealer draws to 17: 16 takes the 8 and busts.
  const drew = C.bjStand({ ...base, deck: ["8c"], player: ["Th", "2d"], dealer: ["Tc", "6s"] });
  assert.equal(drew.dealer.length, 3);
  assert.equal(drew.outcome, "win");
  // A bust loses without the dealer drawing.
  const bust = C.bjHit({ ...base, deck: ["5s", "Kc"], player: ["Th", "6d"], dealer: ["Tc", "6s"] });
  assert.equal(bust.outcome, "bust");
  assert.equal(bust.dealer.length, 2);
  assert.equal(bust.net, -10);
  // Doubling takes one card for twice the bet.
  const doubled = C.bjDouble({ ...base, deck: ["Ts"], player: ["5h", "6d"], dealer: ["Tc", "7s"] });
  assert.equal(doubled.player.length, 3);
  assert.equal(doubled.net, 20);
});

test("a dealt blackjack pays 3 to 2 at once", () => {
  for (let seed = 1; seed < 400; seed++) {
    const round = C.bjDeal(10, rng(seed));
    assert.equal(round.player.length + round.dealer.length + round.deck.length, 52);
    if (C.isBlackjack(round.player) && !C.isBlackjack(round.dealer)) {
      assert.equal(round.done, true);
      assert.equal(round.net, 15);
      return;
    }
  }
  assert.fail("no blackjack dealt");
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
    let round = C.bjDeal(10, random);
    while (!round.done) round = C.bjTotal(round.player).total < 17 ? C.bjHit(round) : C.bjStand(round);
    bj += round.net;
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
