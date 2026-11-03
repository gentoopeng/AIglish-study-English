const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../casino-stats.js");

test("keys belong to a game: poker hands, the casino's games, the group dice table; the rest are not counted", () => {
  assert.equal(C.gameOf("table7:1700000000:12"), "poker");
  assert.equal(C.gameOf("casino:blackjack:abc:bet"), "blackjack");
  assert.equal(C.gameOf("casino:roulette:abc:pay"), "roulette");
  assert.equal(C.gameOf("casino:dice:abc:bet"), "dice");
  assert.equal(C.gameOf("casino:dice-together:room:5:bet"), "dice");
  assert.equal(C.gameOf("casino:chinchiro:x:extra"), "chinchiro");
  assert.equal(C.gameOf("casino:duel:x:bet"), null);
  assert.equal(C.gameOf("casino:sugoroku:batch:1"), null);
  assert.equal(C.gameOf("casino:sugoroku-jackpot:1:pay"), null);
});

test("a round is a bet (and a play) then a payout: net is the sum, the bet is only the stake", () => {
  let s = C.apply(null, { game: "blackjack", delta: -100, bet: 100, play: true });
  s = C.apply(s, { game: "blackjack", delta: -100, bet: 100 }); // a double: more bet, not a new play
  s = C.apply(s, { game: "blackjack", delta: 420 }); // paid back 420
  assert.deepEqual(s.blackjack, { b: 200, n: 220, p: 1 });
  s = C.apply(s, { game: "blackjack", delta: -50, bet: 50, play: true }); // a lost round: nothing paid back
  assert.deepEqual(s.blackjack, { b: 250, n: 170, p: 2 });
  assert.equal(s.poker, undefined);
  // The input is not changed.
  const before = JSON.stringify(s);
  C.apply(s, { game: "poker", delta: 5, bet: 5, play: true });
  assert.equal(JSON.stringify(s), before);
});

test("sugoroku totals replace its entry, never with lower ones, and a stranger's numbers are made whole", () => {
  let s = C.apply({}, { sugoroku: { b: 1000, n: -300, p: 10, g: 2, j: 1, s: 0, l: 55 } });
  assert.deepEqual(s.sugoroku, { b: 1000, n: -300, p: 10, g: 2, j: 1, s: 0, l: 55, jw: 0 });
  // An older save (fewer rolls) does not take the totals back.
  s = C.apply(s, { sugoroku: { b: 500, n: 50, p: 5, g: 1, j: 0, s: 0, l: 20 } });
  assert.equal(s.sugoroku.p, 10);
  s = C.apply(s, { sugoroku: { b: 1100, n: -250, p: 11, g: 3, j: 1, s: 1, l: 60 } });
  assert.deepEqual(s.sugoroku, { b: 1100, n: -250, p: 11, g: 3, j: 1, s: 1, l: 60, jw: 0 });
  s = C.apply(s, { sugoroku: { b: "9", n: 1.5, p: NaN, g: -4, j: null } });
  assert.equal(s.sugoroku.p, 11);
  // The five games' totals are not touched by it, and it is not touched by them.
  s = C.apply(s, { game: "poker", delta: 40, bet: 10, play: true });
  assert.deepEqual([s.poker, s.sugoroku.p], [{ b: 10, n: 40, p: 1 }, 11]);
});

test("totals read back are only what can be true; unknown games and wrong numbers are dropped", () => {
  const stats = C.clean({ poker: { b: 10.5, n: "x", p: 3 }, hack: { b: 1 }, roulette: { b: 5, n: 1e30, p: 1 }, dice: null });
  assert.deepEqual(Object.keys(stats).sort(), ["poker", "roulette"]);
  assert.deepEqual(stats.poker, { b: 0, n: 0, p: 3 });
  assert.equal(stats.roulette.n, 0);
  const flat = C.flat({
    poker: { b: 1000, n: -400, p: 8 },
    blackjack: { b: 100, n: 9999999, p: 3 }, // more won than can be (100 × 100 + 1,000,000)
    roulette: { b: 100, n: -101, p: 3 }, // a loss past the bet (an extra loss, an accident) is true
    chinchiro: { b: 100, n: -2000000, p: 3 }, // but not without bound
    dice: { b: 0, n: 0, p: 0 }, // never played
    sugoroku: { b: 500, n: 300, p: 4, g: 2, j: 1, s: 0, l: 31 },
  });
  assert.deepEqual(Object.keys(flat).filter((k) => k.startsWith("roulette") || k.startsWith("chinchiro")), ["roulette:b", "roulette:n", "roulette:p"]);
  assert.equal(flat["roulette:n"], -101);
  assert.deepEqual(Object.keys(flat).filter((k) => !k.startsWith("roulette")), ["poker:b", "poker:n", "poker:p", "sugoroku:b", "sugoroku:n", "sugoroku:p", "sugoroku:g", "sugoroku:j", "sugoroku:s", "sugoroku:l"]);
  assert.equal(flat["poker:n"], -400);
  assert.equal(flat["sugoroku:l"], 31);
  assert.deepEqual(C.flat(null), {});
  assert.deepEqual(C.flat("x"), {});
});

test("the metrics and labels a ranking shows", () => {
  assert.equal(C.keys().length, 5 * 3 + 7);
  assert.deepEqual(C.metricsOf("poker").map((m) => m[1]), ["累計賭け額", "累計得額", "プレイ回数"]);
  assert.deepEqual(C.metricsOf("sugoroku").map((m) => m[1]), ["累計賭け額", "累計得額", "プレイ回数", "ビンゴ回数", "JP回数", "SJP回数", "ボール排出回数"]);
  assert.equal(C.label("chinchiro:n"), "チンチロ 累計得額");
  assert.equal(C.label("sugoroku:s"), "すごろくビンゴ SJP回数");
  assert.equal(C.label("nobody:b"), "");
});

test("what jackpots paid is kept apart from the rolls and added to the net a ranking shows, and a snapshot never takes it back", () => {
  assert.equal(C.isJackpotPay("casino:sugoroku-jackpot:ab12cd:pay"), true);
  assert.equal(C.isJackpotPay("casino:sugoroku:batch:ab12cd"), false);
  assert.equal(C.isJackpotPay("casino:sugoroku-jackpot:ab12cd:bet"), false);
  assert.equal(C.gameOf("casino:sugoroku-jackpot:ab12cd:pay"), null);
  let s = C.apply({}, { sugoroku: { b: 1000, n: -600, p: 10, g: 2, j: 1, s: 0, l: 55 } });
  s = C.apply(s, { jackpot: 3000 });
  assert.equal(s.sugoroku.jw, 3000);
  assert.equal(C.flat(s)["sugoroku:n"], 2400);
  // The save knows nothing of it: a newer snapshot keeps it, an older one changes nothing.
  s = C.apply(s, { sugoroku: { b: 1100, n: -700, p: 11, g: 2, j: 1, s: 0, l: 60 } });
  assert.deepEqual([s.sugoroku.jw, s.sugoroku.p, C.flat(s)["sugoroku:n"]], [3000, 11, 2300]);
  s = C.apply(s, { sugoroku: { b: 10, n: 0, p: 2 } });
  assert.equal(s.sugoroku.p, 11);
  // A jackpot paid before any roll is known still counts (it shows once there is a play).
  const first = C.apply({}, { jackpot: 12000 });
  assert.deepEqual([first.sugoroku.jw, first.sugoroku.p], [12000, 0]);
  assert.deepEqual(C.flat(first), {});
  // Made-up jackpot totals are bounded like the rest.
  assert.deepEqual(C.flat({ sugoroku: { b: 100, n: 0, p: 1, jw: 999999999 } }), {});
  assert.equal(C.apply(null, { jackpot: -5 }).sugoroku, undefined);
});
