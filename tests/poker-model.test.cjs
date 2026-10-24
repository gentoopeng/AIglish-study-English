const test = require("node:test"),
  assert = require("node:assert/strict"),
  P = require("../poker-model.js");

test("hands are ranked and named", () => {
  const name = (cards) => P.best(cards.split(" ")).name;
  assert.equal(name("As Ks Qs Js Ts 2d 3c"), "ロイヤルフラッシュ");
  assert.equal(name("9h 8h 7h 6h 5h Ad Ac"), "ストレートフラッシュ");
  assert.equal(name("9h 9d 9s 9c 5h Ad Ac"), "フォーカード");
  assert.equal(name("9h 9d 9s Kc Kh 2d 3c"), "フルハウス");
  assert.equal(name("2h 7h 9h Jh Kh Ad Ac"), "フラッシュ");
  assert.equal(name("Ah 2d 3s 4c 5h Kd Qc"), "ストレート");
  assert.equal(name("7h 7d 7s Kc 2h 4d 9c"), "スリーカード");
  assert.equal(name("7h 7d Ks Kc 2h 4d 9c"), "ツーペア");
  assert.equal(name("7h 7d As Kc 2h 4d 9c"), "ワンペア");
  assert.equal(name("7h 3d As Kc 2h Jd 9c"), "ハイカード");
  // A wheel loses to a six-high straight; kickers decide equal pairs.
  const s = (cards) => P.best(cards.split(" ")).score;
  assert.ok(P.compare(s("6h 2d 3s 4c 5h Kd Qc"), s("Ah 2d 3s 4c 5h Kd Qc")) > 0);
  assert.ok(P.compare(s("Ah Ad Ks 7c 2h 4d 9c"), s("Ah Ad Qs 7c 2h 4d 9c")) > 0);
  assert.equal(P.compare(s("Ah Ad Ks 7c 2h 4d 9c"), s("As Ac Kd 7h 2c 4s 9d")), 0);
});

test("heads-up: dealer posts the small blind, acts first preflop and last after", () => {
  let h = P.start({ no: 1, seats: ["a", "b"], stacks: { a: 100, b: 100 }, dealer: "a", smallBlind: 1, bigBlind: 2 });
  assert.deepEqual([h.bet.a, h.bet.b, h.toAct], [1, 2, "a"]);
  h = P.act(h, "a", "call");
  // The big blind keeps its option.
  assert.equal(h.toAct, "b");
  assert.equal(P.options(h, "b").check, true);
  h = P.act(h, "b", "check");
  assert.equal(h.needs, "flop");
  h = P.deal(h, ["2c", "7d", "9h"]);
  assert.equal(h.toAct, "b");
  h = P.act(h, "b", "raise", 10);
  assert.throws(() => P.act(h, "b", "check"));
  assert.deepEqual(P.options(h, "a").raise, { min: 20, max: 98 });
  h = P.act(h, "a", "fold");
  assert.equal(h.street, "done");
  assert.deepEqual(h.result.net, { a: -2, b: 2 });
  assert.deepEqual(h.stacks, { a: 98, b: 102 });
});

test("three players: action order, a raise reopens it, showdown pays the best hand", () => {
  let h = P.start({ no: 1, seats: ["a", "b", "c"], stacks: { a: 100, b: 100, c: 100 }, dealer: "a", smallBlind: 1, bigBlind: 2 });
  assert.deepEqual(h.blinds, { sb: "b", bb: "c" });
  assert.equal(h.toAct, "a");
  h = P.act(h, "a", "raise", 6);
  h = P.act(h, "b", "call");
  assert.equal(h.toAct, "c");
  h = P.act(h, "c", "call");
  assert.equal(h.needs, "flop");
  h = P.deal(h, ["Ah", "Kd", "2c"]);
  assert.equal(h.toAct, "b");
  for (const id of ["b", "c", "a"]) h = P.act(h, id, "check");
  h = P.deal(h, ["7s"]);
  for (const id of ["b", "c", "a"]) h = P.act(h, id, "check");
  h = P.deal(h, ["9d"]);
  for (const id of ["b", "c", "a"]) h = P.act(h, id, "check");
  assert.equal(h.needs, "showdown");
  h = P.showdown(h, { a: ["As", "Ad"], b: ["Kh", "Ks"], c: ["3c", "4c"] });
  assert.equal(h.result.hands.a.name, "スリーカード");
  assert.deepEqual(h.result.net, { a: 12, b: -6, c: -6 });
});

test("all-in for different amounts makes side pots", () => {
  let h = P.start({ no: 1, seats: ["a", "b", "c"], stacks: { a: 20, b: 50, c: 100 }, dealer: "a", smallBlind: 1, bigBlind: 2 });
  h = P.act(h, "a", "allin");
  h = P.act(h, "b", "allin");
  h = P.act(h, "c", "call");
  // No one can bet any more: the board runs out.
  assert.equal(h.needs, "flop");
  h = P.deal(h, ["2c", "7d", "9h"]);
  assert.equal(h.needs, "turn");
  h = P.deal(h, ["Js"]);
  h = P.deal(h, ["3d"]);
  assert.equal(h.needs, "showdown");
  assert.deepEqual(P.pots(h), [
    { amount: 60, eligible: ["a", "b", "c"] },
    { amount: 60, eligible: ["b", "c"] },
  ]);
  // a has the best hand, b the second: a wins the main pot, b the side pot.
  h = P.showdown(h, { a: ["Ah", "Ad"], b: ["Kh", "Kd"], c: ["4s", "5s"] });
  assert.deepEqual(h.result.won, { a: 60, b: 60 });
  assert.deepEqual(h.result.net, { a: 40, b: 10, c: -50 });
  assert.deepEqual(h.stacks, { a: 60, b: 60, c: 50 });
});

test("a split pot gives the odd chip to the first winner after the dealer", () => {
  let h = P.start({ no: 1, seats: ["a", "b", "c"], stacks: { a: 100, b: 100, c: 100 }, dealer: "a", smallBlind: 1, bigBlind: 2 });
  h = P.act(h, "a", "fold");
  h = P.act(h, "b", "call");
  h = P.act(h, "c", "check");
  h = P.deal(h, ["Ah", "Kh", "Qh"]);
  h = P.act(h, "b", "check");
  h = P.act(h, "c", "check");
  h = P.deal(h, ["Jh"]);
  h = P.act(h, "b", "check");
  h = P.act(h, "c", "check");
  h = P.deal(h, ["Th"]);
  h = P.act(h, "b", "check");
  h = P.act(h, "c", "check");
  h = P.showdown(h, { b: ["2c", "3d"], c: ["4c", "5d"] });
  assert.equal(h.result.hands.b.name, "ロイヤルフラッシュ");
  assert.deepEqual(h.result.won, { b: 2, c: 2 });
  assert.equal(P.potOf(h), 4);
});

test("leaving folds at once, out of turn too", () => {
  let h = P.start({ no: 1, seats: ["a", "b", "c"], stacks: { a: 100, b: 100, c: 100 }, dealer: "a", smallBlind: 1, bigBlind: 2 });
  h = P.leave(h, "c");
  assert.equal(h.folded.c, true);
  assert.equal(h.toAct, "a");
  h = P.leave(h, "a");
  assert.equal(h.street, "done");
  assert.deepEqual(h.result.net, { a: 0, b: 2, c: -2 });
});
