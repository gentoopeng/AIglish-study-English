// Rules for the house games in the casino tab, without any screen: blackjack, roulette and dice
// poker. Every round is a plain object and every move returns a new one. `random(n)` gives
// 0..n-1; the app passes a crypto-backed one, the tests a fixed one.
//
// Money is counted as the change to the player's points: a lost bet is -bet, a won even-money
// bet +bet, a push 0.
(function (root) {
  "use strict";
  const P = root.PokerModel || (typeof require === "function" ? require("./poker-model.js") : null);
  const clone = (value) => JSON.parse(JSON.stringify(value));

  // ---- Blackjack -------------------------------------------------------------------------
  // One fresh deck each round. The dealer draws to 17 and stands on every 17. A blackjack
  // pays 3 to 2 (rounded down), doubling takes one card for twice the bet.
  const cardValue = (card) => (card[0] === "A" ? 11 : "TJQK".includes(card[0]) ? 10 : Number(card[0]));
  function bjTotal(cards) {
    let total = 0,
      aces = 0;
    for (const card of cards) {
      total += cardValue(card);
      if (card[0] === "A") aces++;
    }
    while (total > 21 && aces) {
      total -= 10;
      aces--;
    }
    return { total, soft: aces > 0 };
  }
  const isBlackjack = (cards) => cards.length === 2 && bjTotal(cards).total === 21;

  // A table: one dealer (the computer) and a seat for each player, also for one player alone.
  // The dealer starts with a single card and draws the rest after everyone has finished (the
  // European rule), one card at a time to 17. Each seat holds one hand, or more after a split.
  //   { deck, dealer, order, turn, done, seats: { id: { active, hands: [hand] } } }
  //   hand: { cards, bet, doubled, split, done }
  const hand = (cards, bet, split = false) => ({ cards, bet, doubled: false, split, done: false });
  const natural = (h) => !h.split && isBlackjack(h.cards);
  const seatDone = (seat) => seat.hands.every((h) => h.done);
  function tableDeal(order, bets, random) {
    const deck = P.shuffle(P.deck(), random),
      first = {};
    // Round the table as a dealer would: one card each, the dealer's one, then everyone's second.
    for (const id of order) first[id] = deck.pop();
    const dealer = [deck.pop()],
      seats = {};
    for (const id of order) {
      const h = hand([first[id], deck.pop()], bets[id]);
      h.done = isBlackjack(h.cards);
      seats[id] = { active: 0, hands: [h] };
    }
    return advance({ deck, dealer, order: order.slice(), turn: null, done: false, seats });
  }
  // The next player still to act, or the dealer's turn when nobody is left.
  function advance(table) {
    for (const seat of Object.values(table.seats)) while (seat.active < seat.hands.length && seat.hands[seat.active].done) seat.active++;
    table.turn = table.order.find((id) => !seatDone(table.seats[id])) || null;
    if (table.turn) return table;
    const live = table.order.some((id) => table.seats[id].hands.some((h) => bjTotal(h.cards).total <= 21 && !natural(h)));
    // The dealer always turns a second card; with live hands still in play it draws to 17.
    table.dealer.push(table.deck.pop());
    if (live && !isBlackjack(table.dealer)) while (bjTotal(table.dealer).total < 17) table.dealer.push(table.deck.pop());
    table.done = true;
    return table;
  }
  const activeHand = (table, id) => table.seats[id]?.hands[table.seats[id].active];
  // hit / stand always; double on a hand's first two cards; split a pair of the same value (up to four hands).
  function tableCan(table, id, move) {
    const seat = table.seats[id],
      h = activeHand(table, id);
    if (table.done || table.turn !== id || !h || h.done) return false;
    if (move === "hit" || move === "stand") return true;
    if (move === "double") return h.cards.length === 2 && !h.doubled;
    if (move === "split") return h.cards.length === 2 && cardValue(h.cards[0]) === cardValue(h.cards[1]) && seat.hands.length < 4;
    return false;
  }
  // The extra points a move puts in: a double or a split adds the hand's bet once more.
  const tableCost = (table, id, move) => (move === "double" || move === "split" ? activeHand(table, id)?.bet || 0 : 0);
  function tableAct(table, id, move) {
    if (!tableCan(table, id, move)) return table;
    const next = clone(table),
      seat = next.seats[id],
      h = seat.hands[seat.active];
    if (move === "hit") {
      h.cards.push(next.deck.pop());
      if (bjTotal(h.cards).total >= 21) h.done = true;
    } else if (move === "stand") h.done = true;
    else if (move === "double") {
      h.doubled = true;
      h.cards.push(next.deck.pop());
      h.done = true;
    } else if (move === "split") {
      const [a, b] = h.cards,
        aces = a[0] === "A",
        one = hand([a, next.deck.pop()], h.bet, true),
        two = hand([b, next.deck.pop()], h.bet, true);
      // Split aces take one card each and stop; any hand reaching 21 stops.
      for (const x of [one, two]) x.done = aces || bjTotal(x.cards).total >= 21;
      seat.hands.splice(seat.active, 1, one, two);
    }
    return advance(next);
  }
  // A player who left is out of the order; the round goes on without them.
  function tableDrop(table, id) {
    if (!table.seats[id] || table.done) return table;
    const next = clone(table);
    next.order = next.order.filter((x) => x !== id);
    delete next.seats[id];
    return advance(next);
  }
  function handResult(h, dealer) {
    const stake = h.bet * (h.doubled ? 2 : 1),
      me = bjTotal(h.cards).total,
      them = bjTotal(dealer).total,
      mine = natural(h),
      theirs = isBlackjack(dealer);
    let outcome;
    if (mine && theirs) outcome = "push";
    else if (mine) outcome = "blackjack";
    else if (me > 21) outcome = "bust";
    else if (theirs) outcome = "lose";
    else if (them > 21 || me > them) outcome = "win";
    else if (me === them) outcome = "push";
    else outcome = "lose";
    const net = { blackjack: Math.floor((h.bet * 3) / 2), win: stake, push: 0, lose: -stake, bust: -stake }[outcome];
    return { outcome, net, stake };
  }
  // Every hand of a seat against the dealer, and the seat's total.
  function tableOutcome(table, id) {
    const seat = table.seats[id];
    if (!seat || !table.done) return null;
    const results = seat.hands.map((h) => handResult(h, table.dealer));
    return { results, net: results.reduce((a, r) => a + r.net, 0), stake: results.reduce((a, r) => a + r.stake, 0) };
  }

  // ---- Blackjack head to head -------------------------------------------------------------
  // Two players, no dealer: each draws from one deck at the same time, and the hand nearer 21
  // wins. Over 21 loses to anything that is not; two busts, or the same total, is a tie, and a
  // two-card 21 beats any other 21.
  function duelDeal(ids, random) {
    const deck = P.shuffle(P.deck(), random),
      hands = {};
    for (const id of ids) hands[id] = { cards: [deck.pop()], done: false };
    for (const id of ids) {
      hands[id].cards.push(deck.pop());
      hands[id].done = isBlackjack(hands[id].cards);
    }
    return { deck, hands };
  }
  function duelAct(game, id, move) {
    const hand = game.hands[id];
    if (!hand || hand.done) return game;
    const next = clone(game),
      mine = next.hands[id];
    if (move === "hit") {
      mine.cards.push(next.deck.pop());
      if (bjTotal(mine.cards).total >= 21) mine.done = true;
    } else mine.done = true;
    return next;
  }
  const duelDone = (game) => Object.values(game.hands).every((h) => h.done);
  const duelScore = (cards) => (bjTotal(cards).total > 21 ? -1 : isBlackjack(cards) ? 22 : bjTotal(cards).total);
  const duelCompare = (a, b) => Math.sign(duelScore(a) - duelScore(b));

  // ---- Roulette --------------------------------------------------------------------------
  // A single-zero wheel. A bet is { on, amount } where `on` is a number "0".."36" or one of the
  // outside spots below. Zero loses every outside bet.
  const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const colourOf = (n) => (n === 0 ? "green" : REDS.has(n) ? "red" : "black");
  const SPOTS = {
    red: { label: "赤", pays: 1, hit: (n) => colourOf(n) === "red" },
    black: { label: "黒", pays: 1, hit: (n) => colourOf(n) === "black" },
    odd: { label: "奇数", pays: 1, hit: (n) => n > 0 && n % 2 === 1 },
    even: { label: "偶数", pays: 1, hit: (n) => n > 0 && n % 2 === 0 },
    low: { label: "1〜18", pays: 1, hit: (n) => n >= 1 && n <= 18 },
    high: { label: "19〜36", pays: 1, hit: (n) => n >= 19 },
    d1: { label: "1〜12", pays: 2, hit: (n) => n >= 1 && n <= 12 },
    d2: { label: "13〜24", pays: 2, hit: (n) => n >= 13 && n <= 24 },
    d3: { label: "25〜36", pays: 2, hit: (n) => n >= 25 },
    // The three long rows of the table ("2 to 1" on a real layout): 3, 6 … 36 on top.
    c3: { label: "上の列", pays: 2, hit: (n) => n > 0 && n % 3 === 0 },
    c2: { label: "中の列", pays: 2, hit: (n) => n > 0 && n % 3 === 2 },
    c1: { label: "下の列", pays: 2, hit: (n) => n > 0 && n % 3 === 1 },
  };
  function spot(on) {
    if (SPOTS[on]) return SPOTS[on];
    const n = Number(on);
    if (!/^\d{1,2}$/.test(String(on)) || n > 36) return null;
    return { label: String(n), pays: 35, hit: (m) => m === n };
  }
  const rouletteSpin = (random) => random(37);
  // Each bet comes back with what it won (its amount times the payout) or lost.
  function rouletteSettle(bets, number) {
    const lines = bets
      .filter((bet) => spot(bet.on) && bet.amount > 0)
      .map((bet) => {
        const s = spot(bet.on),
          won = s.hit(number);
        return { on: bet.on, label: s.label, amount: bet.amount, won, net: won ? bet.amount * s.pays : -bet.amount };
      });
    return { number, colour: colourOf(number), lines, net: lines.reduce((sum, line) => sum + line.net, 0) };
  }

  // ---- Dice poker ------------------------------------------------------------------------
  // Five dice, two re-rolls of any of them, then the dealer does the same and the better hand
  // wins even money. The same hand is a push.
  const DICE_NAMES = ["役なし", "ワンペア", "ツーペア", "スリーダイス", "ストレート", "フルハウス", "フォーダイス", "ファイブダイス"];
  const DICE_PLAIN = ["そろっていない", "同じ目が2つ", "同じ目が2つずつ2組", "同じ目が3つ", "1〜5か2〜6が続く", "3つ＋2つ", "同じ目が4つ", "全部同じ目"];
  // [category, ...tie-breakers]: the matched faces first (more of a kind first, then higher).
  function diceScore(dice) {
    const counts = {};
    for (const d of dice) counts[d] = (counts[d] || 0) + 1;
    const groups = Object.entries(counts)
      .map(([face, n]) => [Number(face), n])
      .sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    const shape = groups.map((g) => g[1]).join(""),
      faces = groups.map((g) => g[0]);
    const straight = groups.length === 5 && Math.max(...dice) - Math.min(...dice) === 4;
    const category = shape === "5" ? 7 : shape === "41" ? 6 : shape === "32" ? 5 : straight ? 4 : shape === "311" ? 3 : shape === "221" ? 2 : shape === "2111" ? 1 : 0;
    return [category, ...(straight ? [Math.max(...dice)] : faces)];
  }
  function compare(a, b) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0);
    return 0;
  }
  const roll = (random) => random(6) + 1;
  function diceStart(bet, random) {
    return { game: "dice", bet, dice: Array.from({ length: 5 }, () => roll(random)), rolls: 1, held: [false, false, false, false, false], dealer: null, done: false, outcome: "", net: 0 };
  }
  const diceCanRoll = (round) => !round.done && round.rolls < 3 && round.held.some((h) => !h);
  function diceToggle(round, i) {
    if (round.done || round.rolls >= 3) return round;
    const next = clone(round);
    next.held[i] = !next.held[i];
    return next;
  }
  function diceReroll(round, random) {
    if (!diceCanRoll(round)) return round;
    const next = clone(round);
    next.dice = next.dice.map((d, i) => (next.held[i] ? d : roll(random)));
    next.rolls++;
    return next;
  }
  // Which dice the dealer keeps: a made straight or full house, otherwise its most common faces
  // (the higher face on a tie), or the highest die when nothing matches.
  function dealerKeeps(dice) {
    const category = diceScore(dice)[0];
    if (category === 4 || category === 5 || category === 7) return dice.map(() => true);
    const counts = {};
    for (const d of dice) counts[d] = (counts[d] || 0) + 1;
    const best = Math.max(...Object.values(counts));
    if (best === 1) {
      const top = Math.max(...dice);
      return dice.map((d) => d === top);
    }
    const keep = new Set(Object.keys(counts).filter((face) => counts[face] >= 2).map(Number));
    return dice.map((d) => keep.has(d));
  }
  // The dealer's own five dice, played the fixed way (also for a table of friends).
  function diceDealer(random) {
    let dealer = Array.from({ length: 5 }, () => roll(random));
    const rolls = [dealer.slice()];
    for (let r = 0; r < 2; r++) {
      const keep = dealerKeeps(dealer);
      if (keep.every(Boolean)) break;
      dealer = dealer.map((d, i) => (keep[i] ? d : roll(random)));
      rolls.push(dealer.slice());
    }
    return { dice: dealer, rolls };
  }
  // > 0 when `a` wins, < 0 when `b` does, 0 for the same hand.
  const diceVs = (a, b) => compare(diceScore(a), diceScore(b));
  function diceStand(round, random) {
    if (round.done) return round;
    const next = clone(round);
    const { dice: dealer, rolls } = diceDealer(random);
    next.dealer = dealer;
    next.dealerRolls = rolls;
    const order = compare(diceScore(next.dice), diceScore(dealer));
    next.outcome = order > 0 ? "win" : order < 0 ? "lose" : "push";
    next.net = order > 0 ? next.bet : order < 0 ? -next.bet : 0;
    next.done = true;
    return next;
  }

  // ---- Chinchiro ----------------------------------------------------------------------
  // Three dice in a bowl, rolled up to three times until they make a hand. Strongest first:
  // ピンゾロ (1-1-1, 5×) > ゾロ目 (three the same, 3×) > シゴロ (4-5-6, 2×) > a point (two the
  // same: the third die is the point, 6 high) > 目なし (no hand in three rolls) > ヒフミ (1-2-3,
  // pays 2×). The parent (the dealer) rolls first; a decisive parent hand settles at once.
  // The house keeps an edge the way real tables do: the parent throws up to three times but a
  // child only twice, ties go to the parent, and a parent with no hand still has to be beaten.
  // A child wins about 4 times in 10.
  function chinHand(dice) {
    const d = dice.slice().sort((a, b) => a - b),
      key = d.join("");
    if (key === "111") return { rank: 100, name: "ピンゾロ", mult: 5 };
    if (d[0] === d[2]) return { rank: 90 + d[0], name: d[0] + "のゾロ目", mult: 3 };
    if (key === "456") return { rank: 80, name: "シゴロ", mult: 2 };
    if (key === "123") return { rank: -10, name: "ヒフミ", mult: 2 };
    if (d[0] === d[1]) return { rank: d[2], name: d[2] + "の目", mult: 1 };
    if (d[1] === d[2]) return { rank: d[0], name: d[0] + "の目", mult: 1 };
    return null;
  }
  const NO_HAND = { rank: 0, name: "目なし", mult: 1 };
  const chinThrow = (random) => [roll(random), roll(random), roll(random)];
  const PARENT_THROWS = 3,
    CHILD_THROWS = 2;
  // One more throw for a turn: { rolls: [[a, b, c] …], hand, done }, up to `most` throws.
  function chinNext(turn, random, most = PARENT_THROWS) {
    if (turn.done) return turn;
    const rolls = turn.rolls.concat([chinThrow(random)]),
      hand = chinHand(rolls[rolls.length - 1]);
    if (hand) return { rolls, hand, done: true };
    return rolls.length >= most ? { rolls, hand: NO_HAND, done: true } : { rolls, hand: null, done: false };
  }
  const chinStart = () => ({ rolls: [], hand: null, done: false });
  // A whole turn at once, for the computer parent.
  function chinTurn(random) {
    let turn = chinStart();
    while (!turn.done) turn = chinNext(turn, random);
    return turn;
  }
  // When the parent's hand alone decides: the child's multiple of the bet (+ wins, − loses), else null.
  function chinParentDecides(parent) {
    if (parent.rank >= 80) return -parent.mult;
    if (parent.rank === -10) return 2;
    return null;
  }
  // The child against the parent: multiples of the bet for the child.
  function chinSettle(parent, child) {
    const early = chinParentDecides(parent);
    if (early !== null) return early;
    if (child.rank >= 80) return child.mult;
    if (child.rank === -10) return -2;
    if (child.rank === 0) return -1;
    // The same point, or no hand against no hand, goes to the parent.
    return child.rank > parent.rank ? 1 : -1;
  }
  // One against one: simply the stronger hand, the same hand a tie.
  const chinVs = (a, b) => Math.sign(a.rank - b.rank);

  const api = {
    chinHand,
    chinNext,
    chinStart,
    chinTurn,
    chinParentDecides,
    CHILD_THROWS,
    chinSettle,
    chinVs,
    bjTotal,
    isBlackjack,
    tableDeal,
    tableCan,
    tableCost,
    duelDeal,
    duelAct,
    duelDone,
    duelCompare,
    diceDealer,
    diceVs,
    tableAct,
    tableDrop,
    tableOutcome,
    REDS,
    WHEEL,
    SPOTS,
    colourOf,
    spot,
    rouletteSpin,
    rouletteSettle,
    DICE_NAMES,
    DICE_PLAIN,
    diceScore,
    compare,
    diceStart,
    diceCanRoll,
    diceToggle,
    diceReroll,
    dealerKeeps,
    diceStand,
  };
  root.CasinoModel = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
