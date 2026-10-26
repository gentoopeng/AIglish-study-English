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
  function bjDeal(bet, random) {
    const deck = P.shuffle(P.deck(), random);
    const round = { game: "blackjack", bet, deck, player: [deck.pop(), deck.pop()], dealer: [deck.pop(), deck.pop()], doubled: false, done: false, outcome: "", net: 0 };
    if (isBlackjack(round.player) || isBlackjack(round.dealer)) return bjFinish(round);
    return round;
  }
  const bjCanDouble = (round) => !round.done && round.player.length === 2 && !round.doubled;
  function bjHit(round) {
    if (round.done) return round;
    const next = clone(round);
    next.player.push(next.deck.pop());
    return bjTotal(next.player).total >= 21 ? bjDealerPlays(next) : next;
  }
  const bjStand = (round) => (round.done ? round : bjDealerPlays(clone(round)));
  function bjDouble(round) {
    if (!bjCanDouble(round)) return round;
    const next = clone(round);
    next.doubled = true;
    next.player.push(next.deck.pop());
    return bjDealerPlays(next);
  }
  function bjDealerPlays(round) {
    // The dealer only draws when the player is still in.
    if (bjTotal(round.player).total <= 21) while (bjTotal(round.dealer).total < 17) round.dealer.push(round.deck.pop());
    return bjFinish(round);
  }
  function bjFinish(round) {
    const stake = round.bet * (round.doubled ? 2 : 1),
      me = bjTotal(round.player).total,
      them = bjTotal(round.dealer).total,
      mine = isBlackjack(round.player),
      theirs = isBlackjack(round.dealer);
    let outcome;
    if (mine && theirs) outcome = "push";
    else if (mine) outcome = "blackjack";
    else if (theirs) outcome = "lose";
    else if (me > 21) outcome = "bust";
    else if (them > 21 || me > them) outcome = "win";
    else if (me === them) outcome = "push";
    else outcome = "lose";
    const net = { blackjack: Math.floor((round.bet * 3) / 2), win: stake, push: 0, lose: -stake, bust: -stake }[outcome];
    return { ...round, done: true, outcome, net };
  }

  // ---- Blackjack at a shared table -------------------------------------------------------
  // Several players against one dealer, each with their own hand and bet, acting in turn.
  //   { deck, dealer, order, turn, done, hands: { id: { cards, bet, doubled, done } } }
  function tableDeal(order, bets, random) {
    const deck = P.shuffle(P.deck(), random),
      hands = {};
    for (const id of order) hands[id] = { cards: [deck.pop()], bet: bets[id], doubled: false, done: false };
    const dealer = [deck.pop()];
    for (const id of order) hands[id].cards.push(deck.pop());
    dealer.push(deck.pop());
    const table = { deck, dealer, order: order.slice(), turn: null, done: false, hands };
    // A dealer blackjack ends the round at once; a player's blackjack needs no move.
    if (isBlackjack(dealer)) for (const id of order) hands[id].done = true;
    else for (const id of order) if (isBlackjack(hands[id].cards)) hands[id].done = true;
    return advance(table);
  }
  // The next player still to act, or the dealer's turn when nobody is left.
  function advance(table) {
    table.turn = table.order.find((id) => !table.hands[id].done) || null;
    if (table.turn) return table;
    const live = table.order.some((id) => bjTotal(table.hands[id].cards).total <= 21 && !isBlackjack(table.hands[id].cards));
    if (live && !isBlackjack(table.dealer)) while (bjTotal(table.dealer).total < 17) table.dealer.push(table.deck.pop());
    table.done = true;
    return table;
  }
  const tableCanDouble = (table, id) => !table.done && table.turn === id && table.hands[id].cards.length === 2 && !table.hands[id].doubled;
  function tableAct(table, id, move) {
    if (table.done || table.turn !== id) return table;
    const next = clone(table),
      hand = next.hands[id];
    if (move === "hit") {
      hand.cards.push(next.deck.pop());
      if (bjTotal(hand.cards).total >= 21) hand.done = true;
    } else if (move === "double") {
      if (!tableCanDouble(table, id)) return table;
      hand.doubled = true;
      hand.cards.push(next.deck.pop());
      hand.done = true;
    } else hand.done = true; // stand, or skipped for someone who is away
    return advance(next);
  }
  // A player who left is out of the order; the round goes on without them.
  function tableDrop(table, id) {
    if (!table.hands[id] || table.done) return table;
    const next = clone(table);
    next.order = next.order.filter((x) => x !== id);
    delete next.hands[id];
    return advance(next);
  }
  function tableOutcome(table, id) {
    const hand = table.hands[id];
    if (!hand || !table.done) return null;
    const { outcome, net } = bjFinish({ bet: hand.bet, doubled: hand.doubled, player: hand.cards, dealer: table.dealer });
    return { outcome, net, stake: hand.bet * (hand.doubled ? 2 : 1) };
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

  const api = {
    bjTotal,
    isBlackjack,
    bjDeal,
    bjHit,
    bjStand,
    bjDouble,
    bjCanDouble,
    tableDeal,
    duelDeal,
    duelAct,
    duelDone,
    duelCompare,
    diceDealer,
    diceVs,
    tableAct,
    tableDrop,
    tableCanDouble,
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
