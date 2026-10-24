const test = require("node:test"),
  assert = require("node:assert/strict"),
  P = require("../poker-model.js"),
  B = require("../poker-bot.js");

test("equity: aces beat a random hand most of the time, a lost board never wins", () => {
  assert.ok(B.equity(["As", "Ah"], [], 1, 400, (n) => Math.floor(Math.random() * n)) > 0.75);
  // The board is a royal flush in spades: everyone splits, so the share is a half.
  assert.equal(B.equity(["2c", "3d"], ["As", "Ks", "Qs", "Js", "Ts"], 1, 50, (n) => Math.floor(Math.random() * n)), 0.5);
});

test("every level gives an allowed move in random hands", () => {
  const rnd = (n) => Math.floor(Math.random() * n);
  for (const level of Object.keys(B.LEVELS))
    for (let g = 0; g < 30; g++) {
      const deck = P.shuffle(P.deck(), rnd),
        holes = { a: [deck[0], deck[1]], b: [deck[2], deck[3]], c: [deck[4], deck[5]] },
        board = deck.slice(6, 11);
      const stacks = { a: 5 + rnd(100), b: 100, c: 100 };
      let h = P.start({ no: 1, seats: ["a", "b", "c"], stacks: { ...stacks }, dealer: "a", smallBlind: 1, bigBlind: 2 });
      for (let guard = 0; guard < 100 && h.street !== "done"; guard++) {
        if (h.needs === "showdown") h = P.showdown(h, holes);
        else if (h.needs) h = P.deal(h, board.slice(h.board.length, h.board.length + (h.needs === "flop" ? 3 : 1)));
        else {
          const m = B.decide(h, h.toAct, holes[h.toAct], level);
          assert.ok(m && ["fold", "check", "call", "raise", "allin"].includes(m.type));
          h = P.act(h, h.toAct, m.type, m.to);
        }
      }
      assert.equal(h.street, "done");
      assert.equal(h.stacks.a + h.stacks.b + h.stacks.c, stacks.a + 200);
    }
});

test("a strong hand bets, a hopeless one folds to a big bet", () => {
  const always = () => 0.99;
  let h = P.start({ no: 1, seats: ["a", "b"], stacks: { a: 100, b: 100 }, dealer: "a", smallBlind: 1, bigBlind: 2 });
  h = P.act(h, "a", "call");
  h = P.act(h, "b", "check");
  h = P.deal(h, ["Ah", "Ad", "Kc"]);
  assert.equal(B.decide(h, "b", ["As", "Ac"], "normal", undefined, always).type, "raise");
  h = P.act(h, "b", "raise", 60);
  assert.equal(B.decide(h, "a", ["2d", "7s"], "hard", undefined, always).type, "fold");
});
