const test = require("node:test");
const assert = require("node:assert/strict");
const D = require("../daifugo-model.js");

const seeded = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const ids4 = ["a", "b", "c", "d"];
// A state to play with: given hands, whose turn, and what is on the field.
function table({ hands, turn = "a", field = null, rev = false, ids = ids4, lock = null, top = null, opts = {} }) {
  const state = D.start({ ids, rand: seeded(1) });
  state.hands = Object.fromEntries(ids.map((id) => [id, hands[id] || ["S3", "S4"]]));
  state.turn = turn;
  state.rev = rev;
  state.lock = lock;
  state.top = top;
  state.opts = { miyakoochi: !!opts.miyakoochi };
  if (field) state.field = { by: field.by, play: D.resolve({ ...state, field: null, lock: null }, field.cards) };
  return state;
}

test("the deck and the deal: 3, 4 and 5 players", () => {
  for (const [n, size, blind, hand] of [[3, 40, 1, 13], [4, 54, 2, 13], [5, 54, 4, 10]]) {
    assert.equal(D.deck(n).length, size);
    const dealt = D.deal(n, seeded(n));
    assert.equal(dealt.blind.length, blind);
    assert.ok(dealt.blind.every((card) => !D.isJoker(card)), "no joker among the blind cards");
    assert.deepEqual(dealt.hands.map((h) => h.length), Array(n).fill(hand));
    const all = [...dealt.blind, ...dealt.hands.flat()];
    assert.equal(new Set(all).size, size);
  }
  assert.throws(() => D.deck(2), /3〜5人/);
  assert.throws(() => D.deck(6), /3〜5人/);
});

test("strength: 3 is weakest and 2 strongest; a revolution turns the numbers over; the joker is always the strongest", () => {
  assert.ok(D.strength(15, false) > D.strength(14, false) && D.strength(14, false) > D.strength(3, false));
  assert.ok(D.strength(3, true) > D.strength(15, true) && D.strength(4, true) > D.strength(5, true));
  assert.ok(D.strength(16, false) > D.strength(15, false) && D.strength(16, true) > D.strength(3, true));
});

test("singles, pairs and the same-strength rule", () => {
  let s = table({ hands: { a: ["S5", "H5", "S9"], b: ["D5", "C6", "D9", "H9"] }, field: { by: "a", cards: ["S5", "H5"] } });
  s.turn = "b";
  assert.throws(() => D.play(s, "b", ["C6"]), /同じ形/); // a single against a pair
  assert.throws(() => D.play(s, "b", ["D9", "C6"]), /同じ形|出せません/);
  const t = D.play(s, "b", ["D9", "H9"]);
  assert.equal(t.field.play.rank, 9);
  // The same strength does not beat.
  s = table({ hands: { b: ["D5", "C6"] }, field: { by: "a", cards: ["S5"] }, turn: "b" });
  assert.throws(() => D.play(s, "b", ["D5"]), /強い/);
  assert.ok(D.play(s, "b", ["C6"]));
  // Not your turn, a card you do not hold.
  assert.throws(() => D.play(s, "c", ["S3"]), /番/);
  assert.throws(() => D.play(s, "b", ["S9"]), /出せません/);
});

test("a joker stands in for a missing card; a single joker is the strongest single; JK pair is the strongest pair", () => {
  let s = table({ hands: { b: ["D7", "J1", "J2", "C14"] }, field: { by: "a", cards: ["S13", "H13"] }, turn: "b" });
  const pairA = D.play(s, "b", ["J1", "J2"]);
  assert.deepEqual([pairA.field, pairA.turn], [null, "b"], "a JK pair flows the field and the player leads");
  s = table({ hands: { b: ["D7", "J1", "C14"] }, field: { by: "a", cards: ["S15"] }, turn: "b" });
  assert.ok(D.play(s, "b", ["J1"]));
  s = table({ hands: { b: ["D14", "J1"] }, field: { by: "a", cards: ["S13", "H13"] }, turn: "b" });
  assert.ok(D.play(s, "b", ["D14", "J1"]), "A with a joker beats the pair of Ks");
});

test("8切り flows the field and the player leads again; a stair with an 8 does not", () => {
  let s = table({ hands: { b: ["D8", "C9", "H3"], c: ["S4", "S5"] }, field: { by: "a", cards: ["S6"] }, turn: "b" });
  s = D.play(s, "b", ["D8"]);
  assert.equal(s.field, null);
  assert.equal(s.turn, "b");
  assert.equal(s.log.at(-1).t, "flow");
  // 8 with a joker (a pair) is an 8切り too.
  s = table({ hands: { b: ["D8", "J1", "C9"] }, field: { by: "a", cards: ["S6", "H6"] }, turn: "b" });
  s = D.play(s, "b", ["D8", "J1"]);
  assert.equal(s.field, null);
  // A stair with an 8 stays.
  s = table({ hands: { b: ["D6", "D7", "D8", "C9"] }, turn: "b" });
  s = D.play(s, "b", ["D6", "D7", "D8"]);
  assert.ok(s.field);
});

test("スペ3返し: only the spade 3 beats a single joker, and the field flows", () => {
  let s = table({ hands: { b: ["S3", "H3", "C15"], c: ["D4"] }, field: { by: "a", cards: ["J1"] }, turn: "b" });
  assert.throws(() => D.play(s, "b", ["H3"]), /強い/);
  assert.throws(() => D.play(s, "b", ["C15"]), /強い/);
  s = D.play(s, "b", ["S3"]);
  assert.equal(s.field, null);
  assert.equal(s.turn, "b");
});

test("革命: four of a kind turns the order over until the game ends (and again turns it back)", () => {
  let s = table({ hands: { b: ["S5", "H5", "D5", "C5", "S14"], c: ["S3", "H9"] }, turn: "b" });
  s = D.play(s, "b", ["S5", "H5", "D5", "C5"]);
  assert.equal(s.rev, true);
  assert.equal(s.turn, "c");
  // In a revolution a 3 is the strongest card.
  s = table({ hands: { c: ["S3", "H9", "C12"] }, field: { by: "b", cards: ["S14"] }, turn: "c", rev: true });
  assert.throws(() => D.play(s, "c", ["C12"]) && D.play(s, "c", ["C13"]), /出せません|強い/);
  assert.ok(D.play(s, "c", ["S3"]));
  // A joker may make the four (and the 革命 turns back).
  s = table({ hands: { b: ["S7", "H7", "D7", "J1", "S9"] }, turn: "b", rev: true });
  s = D.play(s, "b", ["S7", "H7", "D7", "J1"]);
  assert.equal(s.rev, false);
  // Three of a kind is not enough with four players, but is with three.
  s = table({ hands: { b: ["S5", "H5", "D5", "S9"] }, turn: "b" });
  assert.equal(D.play(s, "b", ["S5", "H5", "D5"]).rev, false);
  const three = table({ ids: ["a", "b", "c"], hands: { b: ["S5", "H5", "D5", "S9"] }, turn: "b" });
  assert.equal(D.play(three, "b", ["S5", "H5", "D5"]).rev, true);
});

test("階段: three or more in a row of one suit; K-A-2 counts, A-2-3 does not; a joker fills a gap or the end", () => {
  const read = (cards, rev = false) => D.readings(cards, rev).filter((r) => r.kind === "stair");
  assert.equal(read(["S5", "S6", "S7"]).length, 1);
  assert.equal(read(["S5", "H6", "S7"]).length, 0, "one suit only");
  assert.equal(read(["S5", "S6"]).length, 0);
  assert.equal(read(["S13", "S14", "S15"])[0].a, 13);
  assert.equal(read(["S14", "S15", "S3"]).length, 0);
  assert.equal(read(["S5", "J1", "S7"])[0].a, 5, "a joker in the middle");
  // At the end the joker takes the strongest place: 4-5-JK is 4-5-6.
  assert.equal(read(["S4", "S5", "J1"])[0].a, 4);
  // A joker above the 2 is the 最強階段.
  assert.equal(read(["S14", "S15", "J1"])[0].top, true);
  assert.equal(read(["S12", "S13", "S14", "S15", "J1"])[0].a, 12);
  // In a revolution 3-4-JK runs, and 2-A-K does too.
  assert.equal(read(["S3", "S4", "J1"], true)[0].top, true);
  assert.equal(read(["S15", "S14", "S13"], true)[0].a, 3);
  // A stair is beaten by one of the same length with a higher lowest card.
  let s = table({ hands: { b: ["H6", "H7", "H8", "H4", "H5", "H9"] }, field: { by: "a", cards: ["S5", "S6", "S7"] }, turn: "b" });
  assert.throws(() => D.play(s, "b", ["H4", "H5", "H6"]), /強い/);
  assert.throws(() => D.play(s, "b", ["H6", "H7", "H8", "H9"]), /同じ形/);
  assert.ok(D.play(s, "b", ["H6", "H7", "H8"]));
});

test("最強階段 flows the field", () => {
  let s = table({ hands: { b: ["S14", "S15", "J1", "H3"] }, turn: "b" });
  s = D.play(s, "b", ["S14", "S15", "J1"]);
  assert.equal(s.field, null);
  assert.equal(s.turn, "b");
});

test("縛り: the same suits twice in a row lock the field until it flows; a joker helps but cannot start one", () => {
  let s = table({ hands: { a: ["S4", "H4"], b: ["S5", "H5", "D5", "D6", "S9", "H9", "S10"], c: ["S6", "S7", "D7"] }, turn: "b", field: { by: "a", cards: ["S3", "H3"] } });
  s = D.play(s, "b", ["S5", "H5"]);
  assert.deepEqual(s.lock, ["H", "S"]);
  // c must play the locked suits.
  assert.throws(() => D.play(s, "c", ["S7", "D7"]), /縛り/);
  s = table({ hands: { c: ["S4", "S7", "D7", "H9"] }, turn: "c", field: { by: "b", cards: ["S5"] }, lock: ["S"] });
  assert.throws(() => D.play(s, "c", ["D7"]), /縛り/);
  assert.ok(D.play(s, "c", ["S7"]));
  // A single joker keeps the lock.
  s = table({ hands: { c: ["J1", "S7"] }, turn: "c", field: { by: "b", cards: ["S5"] }, lock: ["S"] });
  s = D.play(s, "c", ["J1"]);
  assert.deepEqual(s.lock, ["S"]);
  // A joker in the play cannot start one.
  s = table({ hands: { c: ["S9", "J1"], d: ["S3"] }, turn: "c", field: { by: "b", cards: ["S5"] } });
  s = D.play(s, "c", ["S9"]);
  assert.deepEqual(s.lock, ["S"], "S then S single: locked");
  s = table({ hands: { c: ["H9", "J1"], d: ["S3"] }, turn: "c", field: { by: "b", cards: ["S5", "H5"] } });
  s = D.play(s, "c", ["J1", "H9"]);
  assert.equal(s.lock, null);
  // A passing round clears the lock.
  s = table({ hands: { a: ["S3"], b: ["S4"], c: ["S6"], d: ["S8"] }, turn: "b", field: { by: "a", cards: ["S3"] }, lock: ["S"] });
  s = D.pass(D.pass(D.pass(s, "b"), "c"), "d");
  assert.deepEqual([s.field, s.lock, s.turn], [null, null, "a"]);
});

test("パス: not on an empty field; once passed you stay out until the field flows; the last to play leads", () => {
  let s = table({ hands: { a: ["S3", "S4"], b: ["S5", "S9"], c: ["S6", "S10"], d: ["S7", "S11"] }, turn: "a" });
  assert.throws(() => D.pass(s, "a"), /最初/);
  s = D.play(s, "a", ["S3"]);
  s = D.play(s, "b", ["S5"]);
  s = D.pass(s, "c");
  s = D.play(s, "d", ["S7"]);
  assert.equal(s.turn, "a");
  s = D.pass(s, "a");
  assert.equal(s.turn, "b", "c passed and stays out");
  s = D.pass(s, "b");
  assert.equal(s.field, null);
  assert.equal(s.turn, "d");
});

test("反則上がり: a joker, a 2, an 8, the spade 3 (and a 3 in a revolution) cannot be the last play", () => {
  const finish = (cards, rev = false, field = null) => {
    const s = table({ hands: { a: cards, b: ["S4", "S5"], c: ["S6", "S7"], d: ["S9", "S10"] }, turn: "a", rev, field });
    return D.play(s, "a", cards);
  };
  assert.deepEqual([finish(["J1"]).illegal, finish(["S15"]).illegal, finish(["S8"]).illegal, finish(["S3"]).illegal], [["a"], ["a"], ["a"], ["a"]]);
  assert.deepEqual(finish(["S9"]).legal, ["a"]);
  assert.deepEqual(finish(["S15"], true).legal, ["a"], "a 2 is the weakest in a revolution");
  assert.deepEqual(finish(["H3"], true).illegal, ["a"]);
  assert.deepEqual(finish(["H3"]).legal, ["a"], "a plain 3 finishes (only the spade 3 does not)");
  assert.deepEqual(finish(["S15", "H15"]).illegal, ["a"], "a pair of 2s");
});

test("ranking: finishers in order, the last player after them; illegal finishers go to the bottom (the first illegal is last)", () => {
  let s = table({ hands: { a: ["S9"], b: ["S10"], c: ["S11"], d: ["S12", "S13"] }, turn: "a" });
  s = D.play(s, "a", ["S9"]);
  s = D.play(s, "b", ["S10"]);
  s = D.play(s, "c", ["S11"]);
  assert.equal(s.phase, "done");
  assert.deepEqual(s.ranking, ["a", "b", "c", "d"]);
  // b finishes with a 2 (illegal): b is last, however the others end.
  s = table({ hands: { a: ["S9"], b: ["S15"], c: ["S11", "S3"], d: ["S12", "S13"] }, turn: "a" });
  s = D.play(s, "a", ["S9"]);
  s = D.play(s, "b", ["S15"]);
  assert.deepEqual(s.illegal, ["b"]);
  while (s.phase === "play") {
    const cards = D.choose(s, s.turn);
    s = cards ? D.play(s, s.turn, cards) : D.pass(s, s.turn);
  }
  assert.equal(s.ranking[0], "a");
  assert.equal(s.ranking.at(-1), "b");
  // Two illegal finishers: the first is last, the second the one above.
  s = table({ hands: { a: ["S15"], b: ["J1"], c: ["S11", "S3"], d: ["S12", "S13"] }, turn: "a" });
  s = D.play(s, "a", ["S15"]);
  s = D.play(s, "b", ["J1"]);
  assert.deepEqual(s.illegal, ["a", "b"]);
  while (s.phase === "play") {
    const cards = D.choose(s, s.turn);
    s = cards ? D.play(s, s.turn, cards) : D.pass(s, s.turn);
  }
  assert.deepEqual(s.ranking.slice(-2), ["b", "a"]);
});

test("都落ち: the 大富豪 of the game before drops when somebody else finishes first", () => {
  let s = table({ hands: { a: ["S4", "S5"], b: ["S9"], c: ["S10", "S11"], d: ["S12", "S13"] }, turn: "b", top: "a", opts: { miyakoochi: true } });
  s = D.play(s, "b", ["S9"]);
  assert.equal(s.fallen, "a");
  assert.deepEqual(s.legal, ["b"]);
  while (s.phase === "play") {
    const mine = s.hands[s.turn];
    s = s.field ? D.pass(s, s.turn) : D.play(s, s.turn, [mine[0]]);
  }
  assert.equal(s.ranking[0], "b");
  assert.equal(s.ranking.at(-1), "a", "the fallen player is last (no illegal finish)");
  // If the 大富豪 finishes first they stay.
  s = table({ hands: { a: ["S4"], b: ["S9", "S8"], c: ["S10"], d: ["S12"] }, turn: "a", top: "a", opts: { miyakoochi: true } });
  s = D.play(s, "a", ["S4"]);
  assert.equal(s.fallen, null);
});

test("カード交換: the lowest gives the strongest cards (joker first), the highest gives what they choose", () => {
  const prev = { ranking: ["a", "b", "c", "d"] };
  const s = D.start({ ids: ids4, rand: seeded(7), prev });
  assert.equal(s.phase, "exchange");
  assert.deepEqual(D.exchangePairs(prev.ranking), [{ low: "d", high: "a", count: 2 }, { low: "c", high: "b", count: 1 }]);
  assert.equal(s.turn, "d", "the 大貧民 of the game before starts");
  s.hands.d = ["J1", "S15", "S14", "S4"];
  s.hands.a = ["S3", "H3", "S5", "S6"];
  s.hands.c = ["C15", "C4", "C5"];
  s.hands.b = ["D3", "D9", "D10"];
  const t = D.exchange(s, { a: ["S3", "H3"], b: ["D3"] });
  assert.deepEqual(t.exchange.given.d, ["J1", "S15"]);
  assert.ok(t.hands.a.includes("J1") && t.hands.a.includes("S15") && !t.hands.a.includes("S3"));
  assert.ok(t.hands.d.includes("S3") && t.hands.d.includes("H3"));
  assert.ok(t.hands.b.includes("C15") && t.hands.c.includes("D3"));
  assert.equal(t.phase, "play");
  assert.throws(() => D.exchange(s, { a: ["S3"], b: ["D3"] }), /2枚/);
  assert.throws(() => D.exchange(s, { a: ["S3", "H9"], b: ["D3"] }), /2枚/);
  // Three players: one card between the 富豪 and the 貧民. Five: the 平民 does not exchange.
  assert.deepEqual(D.exchangePairs(["a", "b", "c"]), [{ low: "c", high: "a", count: 1 }]);
  assert.deepEqual(D.exchangePairs(["a", "b", "c", "d", "e"]), [{ low: "e", high: "a", count: 2 }, { low: "d", high: "b", count: 1 }]);
});

test("points and the stakes: 6/4/2/0, +2 for the best of the last game; the best pays with the worst, the sum is 0", () => {
  assert.deepEqual([1, 2, 3, 4].map((r) => D.gamePoints(4, r)), [6, 4, 2, 0]);
  assert.equal(D.gamePoints(4, 1, true), 8);
  const games = [["a", "b", "c", "d"], ["b", "a", "c", "d"], ["b", "c", "a", "d"], ["a", "b", "c", "d"]];
  // a and b both have 20 points; a was better in the last game.
  assert.deepEqual(D.standing(ids4, games), ["a", "b", "c", "d"]);
  assert.deepEqual(D.standing(ids4, [["c", "a", "b", "d"]]), ["c", "a", "b", "d"]);
  assert.deepEqual(D.payouts(["a", "b", "c", "d"], 100), [{ from: "d", to: "a", amount: 100 }, { from: "c", to: "b", amount: 50 }]);
  assert.deepEqual(D.payouts(["a", "b", "c"], 100), [{ from: "c", to: "a", amount: 100 }]);
  assert.deepEqual(D.payouts(["a", "b", "c", "d", "e"], 101), [{ from: "e", to: "a", amount: 101 }, { from: "d", to: "b", amount: 50 }]);
  assert.deepEqual(D.payouts(["a", "b"], 1), [{ from: "b", to: "a", amount: 1 }]);
  for (const stake of [1, 7, 100, 12345]) for (const n of [3, 4, 5]) {
    const order = ids4.concat(["e"]).slice(0, n);
    const net = {};
    for (const p of D.payouts(order.length === 4 ? order : order.concat([]), stake)) { net[p.from] = (net[p.from] || 0) - p.amount; net[p.to] = (net[p.to] || 0) + p.amount; }
    assert.equal(Object.values(net).reduce((x, y) => x + y, 0), 0);
  }
});

test("whole games with the computer player: they end, every card is accounted for, and the ranking holds everybody", () => {
  for (let seed = 1; seed <= 400; seed++) {
    const n = 3 + (seed % 3),
      ids = ["a", "b", "c", "d", "e"].slice(0, n),
      rand = seeded(seed);
    let prev = null,
      s;
    for (let game = 0; game < 3; game++) {
      s = D.start({ ids, rand, prev, opts: { miyakoochi: seed % 2 === 0 } });
      if (s.phase === "exchange") {
        const picks = {};
        for (const pair of s.exchange.pairs) picks[pair.high] = s.hands[pair.high].slice().sort((x, y) => D.cardsByStrength(x, y, false)).slice(0, pair.count);
        s = D.exchange(s, picks);
      }
      const total = (state) => ids.reduce((sum, id) => sum + state.hands[id].length, 0);
      const start = total(s);
      let steps = 0;
      const played = [];
      while (s.phase === "play") {
        assert.ok(++steps < 2000, "the game ends (seed " + seed + ")");
        assert.ok(D.activeIds(s).includes(s.turn), "it is the turn of a player still in");
        const cards = D.choose(s, s.turn, rand);
        if (cards) {
          played.push(...cards);
          s = D.play(s, s.turn, cards);
        } else s = D.pass(s, s.turn);
      }
      assert.equal(s.phase, "done");
      assert.deepEqual(s.ranking.slice().sort(), ids.slice().sort());
      assert.equal(new Set(played).size, played.length, "no card is played twice");
      assert.equal(total(s) + played.length, start);
      prev = { ranking: s.ranking };
    }
  }
});

test("plays() lists exactly the plays the rules accept", () => {
  for (let seed = 1; seed <= 60; seed++) {
    const ids = ["a", "b", "c", "d"];
    let s = D.start({ ids, rand: seeded(seed) });
    for (let step = 0; step < 14 && s.phase === "play"; step++) {
      const options = D.plays(s, s.turn);
      for (const cards of options) assert.ok(D.resolve(s, cards), "listed plays are valid");
      const cards = options.length ? options[Math.floor(seeded(seed + step)() * options.length)] : null;
      s = cards ? D.play(s, s.turn, cards) : s.field ? D.pass(s, s.turn) : s;
      if (!cards && !s.field) break;
    }
  }
  // With nothing to beat the field, there is nothing to play.
  const s = table({ hands: { b: ["S4", "S5"] }, field: { by: "a", cards: ["S15"] }, turn: "b" });
  assert.deepEqual(D.plays(s, "b"), []);
});
