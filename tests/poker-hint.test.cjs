const test = require("node:test"),
  assert = require("node:assert/strict");
globalThis.PokerModel = require("../poker-model.js");
const H = require("../poker-hint.js");

test("the hand made now names the cards that make it", () => {
  assert.deepEqual(H.made(["Ah", "Kd"], ["Ac", "7s", "2d"]), { category: 1, name: "ワンペア", plain: "同じ数字が2枚", cards: ["Ah", "Ac"] });
  assert.equal(H.made(["9h", "9d"], []).name, "ワンペア");
  const flush = H.made(["Ah", "2h"], ["5h", "9h", "Jh", "Kc"]);
  assert.equal(flush.name, "フラッシュ");
  assert.equal(flush.cards.length, 5);
});

test("draws are counted exactly over the unseen cards, best first", () => {
  const [flush, pair] = H.draws(["Ah", "Kh"], ["2h", "7h", "Qc"]);
  assert.equal(flush.name, "フラッシュ");
  assert.equal(flush.outs.length, 9);
  assert.equal(flush.need, "♥のカード");
  assert.equal(flush.next.toFixed(3), (9 / 47).toFixed(3));
  assert.ok(flush.byRiver > 0.34 && flush.byRiver < 0.36);
  assert.equal(pair.name, "ワンペア");
  assert.equal(pair.need, "K・A");
  // An open-ended straight draw: a 5 or a 10.
  assert.equal(H.draws(["9s", "8d"], ["7c", "6h", "2s"])[0].need, "5・10");
});

test("a pair landing on the board alone is not counted as the player's draw", () => {
  const draws = H.draws(["2c", "3d"], ["Kh", "Ks", "9c", "7d"]);
  assert.ok(draws.every((d) => d.outs.some((c) => ["2", "3"].includes(c[0]) || d.category >= 4)));
  assert.deepEqual(H.draws(["Ah", "Kd"], ["2c", "7d", "9h", "Js", "4c"]), []);
});

test("starting tips describe two cards in plain words", () => {
  assert.match(H.start(["Qs", "Qd"])[0], /ペア/);
  assert.ok(H.start(["9s", "8s"]).some((t) => /フラッシュ/.test(t)));
  assert.match(H.start(["7c", "2d"])[0], /降りる/);
});
