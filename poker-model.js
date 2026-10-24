// Texas Hold'em rules without any screen or network: cards, hand strength, betting, side pots.
// A hand is a plain object, and every function returns a new one, so the same moves give the
// same table on every device.
(function (root) {
  "use strict";
  const RANKS = "23456789TJQKA",
    SUITS = "shdc",
    NAMES = ["ハイカード", "ワンペア", "ツーペア", "スリーカード", "ストレート", "フラッシュ", "フルハウス", "フォーカード", "ストレートフラッシュ", "ロイヤルフラッシュ"];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const rankOf = (card) => RANKS.indexOf(card[0]) + 2;

  function deck() {
    const cards = [];
    for (const s of SUITS) for (const r of RANKS) cards.push(r + s);
    return cards;
  }
  // random(n) gives 0..n-1; the app passes a crypto-backed one.
  function shuffle(cards, random) {
    const list = cards.slice();
    for (let i = list.length - 1; i > 0; i--) {
      const j = random(i + 1);
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  // ---- Hand strength ---------------------------------------------------------------------
  // A five-card score: [category, ...tie-breakers]; a larger array (compared in order) wins.
  function score5(cards) {
    const ranks = cards.map(rankOf).sort((a, b) => b - a),
      flush = cards.every((c) => c[1] === cards[0][1]),
      counts = new Map();
    for (const r of ranks) counts.set(r, (counts.get(r) || 0) + 1);
    const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]),
      unique = [...new Set(ranks)];
    let straight = 0;
    if (unique.length === 5) {
      if (unique[0] - unique[4] === 4) straight = unique[0];
      else if (unique.join() === "14,5,4,3,2") straight = 5;
    }
    if (straight && flush) return [straight === 14 ? 9 : 8, straight];
    if (groups[0][1] === 4) return [7, groups[0][0], groups[1][0]];
    if (groups[0][1] === 3 && groups[1][1] === 2) return [6, groups[0][0], groups[1][0]];
    if (flush) return [5, ...ranks];
    if (straight) return [4, straight];
    if (groups[0][1] === 3) return [3, groups[0][0], ...groups.slice(1).map((g) => g[0])];
    if (groups[0][1] === 2 && groups[1][1] === 2) return [2, groups[0][0], groups[1][0], groups[2][0]];
    if (groups[0][1] === 2) return [1, groups[0][0], ...groups.slice(1).map((g) => g[0])];
    return [0, ...ranks];
  }
  function compare(a, b) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const d = (a[i] || 0) - (b[i] || 0);
      if (d) return d;
    }
    return 0;
  }
  // The best five of up to seven cards: { score, cards, name }.
  function best(cards) {
    let top = null;
    const n = cards.length;
    const pick = (start, chosen) => {
      if (chosen.length === 5) {
        const score = score5(chosen);
        if (!top || compare(score, top.score) > 0) top = { score, cards: chosen.slice() };
        return;
      }
      for (let i = start; i <= n - (5 - chosen.length); i++) {
        chosen.push(cards[i]);
        pick(i + 1, chosen);
        chosen.pop();
      }
    };
    if (n >= 5) pick(0, []);
    else top = { score: [-1], cards: cards.slice() };
    return { ...top, name: NAMES[top.score[0]] || "" };
  }
  // What a player holds so far (two to seven cards), named for the screen.
  function describe(cards) {
    if (cards.length >= 5) return best(cards).name;
    const ranks = cards.map(rankOf);
    return new Set(ranks).size < ranks.length ? NAMES[1] : NAMES[0];
  }

  // ---- Betting ---------------------------------------------------------------------------
  const live = (h) => h.seats.filter((id) => !h.folded[id]);
  const canAct = (h) => live(h).filter((id) => !h.allin[id]);
  const potOf = (h) => Object.values(h.total).reduce((a, b) => a + b, 0);
  function nextFrom(h, id, test) {
    const i = h.seats.indexOf(id);
    for (let step = 1; step <= h.seats.length; step++) {
      const other = h.seats[(i + step) % h.seats.length];
      if (test(other)) return other;
    }
    return null;
  }
  function pay(h, id, amount) {
    const paid = Math.max(0, Math.min(amount, h.stacks[id]));
    h.stacks[id] -= paid;
    h.bet[id] = (h.bet[id] || 0) + paid;
    h.total[id] = (h.total[id] || 0) + paid;
    if (h.stacks[id] === 0) h.allin[id] = true;
    return paid;
  }
  // seats: players dealt in, in seat order (all with chips); dealer: one of them.
  function start({ no, seats, stacks, dealer, smallBlind, bigBlind }) {
    if (seats.length < 2) throw Error("2人以上必要です。");
    const h = {
      no,
      seats: seats.slice(),
      dealer,
      sb: smallBlind,
      bb: bigBlind,
      stacks: Object.fromEntries(seats.map((id) => [id, stacks[id]])),
      bet: {},
      total: {},
      folded: {},
      allin: {},
      acted: {},
      street: "preflop",
      board: [],
      current: 0,
      minRaise: bigBlind,
      toAct: null,
      needs: null,
      last: null,
      result: null,
    };
    // Heads-up: the dealer posts the small blind and acts first before the flop.
    const sbSeat = seats.length === 2 ? dealer : nextFrom(h, dealer, () => true),
      bbSeat = nextFrom(h, sbSeat, () => true);
    pay(h, sbSeat, smallBlind);
    pay(h, bbSeat, bigBlind);
    h.blinds = { sb: sbSeat, bb: bbSeat };
    h.current = Math.max(h.bet[sbSeat] || 0, h.bet[bbSeat] || 0);
    h.toAct = nextFrom(h, bbSeat, (id) => !h.allin[id]);
    return settle(h);
  }
  // What the player to act may do.
  function options(h, id) {
    if (h.toAct !== id || h.street === "done" || h.needs) return null;
    const bet = h.bet[id] || 0,
      stack = h.stacks[id],
      toCall = Math.min(h.current - bet, stack),
      minTo = Math.min(h.current + h.minRaise, bet + stack),
      maxTo = bet + stack;
    return {
      check: toCall === 0,
      call: toCall,
      raise: maxTo > h.current ? { min: minTo, max: maxTo } : null,
      pot: potOf(h),
    };
  }
  // type: fold | check | call | raise (to: the player's total bet for this street) | allin
  function act(hand, id, type, to) {
    const h = clone(hand),
      o = options(h, id);
    if (!o) throw Error("あなたの番ではありません。");
    const bet = h.bet[id] || 0;
    if (type === "allin") {
      to = bet + h.stacks[id];
      type = to > h.current ? "raise" : "call";
    }
    if (type === "fold") h.folded[id] = true;
    else if (type === "check") {
      if (!o.check) throw Error("チェックできません。");
    } else if (type === "call") pay(h, id, o.call);
    else if (type === "raise") {
      if (!o.raise) throw Error("レイズできません。");
      to = Math.floor(Number(to));
      if (!(to >= o.raise.min && to <= o.raise.max)) throw Error("レイズ額は" + o.raise.min + "〜" + o.raise.max + "です。");
      const raisedBy = to - h.current;
      pay(h, id, to - bet);
      if (raisedBy >= h.minRaise) h.minRaise = raisedBy;
      h.current = Math.max(h.current, h.bet[id]);
      // Everyone else answers the new amount.
      h.acted = {};
    } else throw Error("その操作はできません。");
    h.acted[id] = true;
    h.last = { id, type, amount: h.bet[id] || 0 };
    return settle(h, id);
  }
  // After a move: the hand ends, the street ends, or the next player is to act.
  // A street ends when nobody can act, when the one player who can has matched the bet, or when
  // everyone who can act has acted and matched it (so the big blind keeps its option).
  function settle(h, after) {
    const alive = live(h);
    if (alive.length === 1) return award(h, alive[0]);
    const active = canAct(h),
      matched = (id) => (h.bet[id] || 0) === h.current,
      done =
        active.length === 0 ||
        (active.length === 1 && (h.bet[active[0]] || 0) >= h.current && (alive.length > 1 && (h.acted[active[0]] || h.current > 0))) ||
        active.every((id) => h.acted[id] && matched(id));
    if (done) {
      h.toAct = null;
      h.needs = h.street === "river" ? "showdown" : { preflop: "flop", flop: "turn", turn: "river" }[h.street];
      return h;
    }
    const waiting = (id) => !h.folded[id] && !h.allin[id] && (!h.acted[id] || (h.bet[id] || 0) < h.current);
    if (after) h.toAct = nextFrom(h, after, waiting);
    else if (!h.toAct || !waiting(h.toAct)) h.toAct = nextFrom(h, h.toAct || h.dealer, waiting);
    return h;
  }
  // A player leaving the table folds at once, even out of turn (an all-in player gives up the pot).
  function leave(hand, id) {
    const h = clone(hand);
    if (h.street === "done" || !h.seats.includes(id) || h.folded[id]) return h;
    h.folded[id] = true;
    h.last = { id, type: "fold", amount: h.bet[id] || 0 };
    const alive = live(h);
    if (alive.length === 1) return award(h, alive[0]);
    if (h.needs) return h;
    return settle(h, h.toAct === id ? id : undefined);
  }
  // The next street's cards (three for the flop, one after).
  function deal(hand, cards) {
    const h = clone(hand),
      street = h.needs;
    if (!["flop", "turn", "river"].includes(street)) throw Error("配る場面ではありません。");
    if (cards.length !== (street === "flop" ? 3 : 1)) throw Error("カードの枚数が違います。");
    h.board = h.board.concat(cards);
    h.street = street;
    h.needs = null;
    h.bet = {};
    h.current = 0;
    h.minRaise = h.bb;
    h.acted = {};
    h.last = null;
    const active = canAct(h);
    if (active.length <= 1) {
      h.needs = street === "river" ? "showdown" : { flop: "turn", turn: "river" }[street];
      h.toAct = null;
      return h;
    }
    h.toAct = nextFrom(h, h.dealer, (id) => !h.folded[id] && !h.allin[id]);
    return h;
  }
  // Side pots from what everyone put in: [{ amount, eligible: [ids] }].
  function pots(h) {
    const levels = [...new Set(Object.values(h.total).filter((v) => v > 0))].sort((a, b) => a - b),
      list = [];
    let below = 0;
    for (const level of levels) {
      const amount = h.seats.reduce((sum, id) => sum + Math.max(0, Math.min(h.total[id] || 0, level) - below), 0),
        eligible = h.seats.filter((id) => !h.folded[id] && (h.total[id] || 0) >= level);
      if (amount > 0) {
        if (eligible.length) list.push({ amount, eligible });
        else if (list.length) list[list.length - 1].amount += amount;
      }
      below = level;
    }
    return list;
  }
  function finish(h, won, shown, hands) {
    for (const id of h.seats) h.stacks[id] += won[id] || 0;
    h.street = "done";
    h.needs = null;
    h.toAct = null;
    h.result = {
      won,
      shown,
      hands,
      net: Object.fromEntries(h.seats.map((id) => [id, (won[id] || 0) - (h.total[id] || 0)])),
    };
    return h;
  }
  function award(h, winner) {
    return finish(h, { [winner]: potOf(h) }, {}, {});
  }
  // holes: { id: [card, card] } for the players still in.
  function showdown(hand, holes) {
    const h = clone(hand);
    if (h.needs !== "showdown") throw Error("ショーダウンの場面ではありません。");
    const strength = {},
      shown = {},
      hands = {};
    for (const id of live(h)) {
      const b = best(holes[id].concat(h.board));
      strength[id] = b.score;
      shown[id] = holes[id];
      hands[id] = { name: b.name, cards: b.cards };
    }
    const won = {};
    for (const pot of pots(h)) {
      let top = [];
      for (const id of pot.eligible) {
        if (!top.length || compare(strength[id], strength[top[0]]) > 0) top = [id];
        else if (compare(strength[id], strength[top[0]]) === 0) top.push(id);
      }
      const share = Math.floor(pot.amount / top.length);
      let rest = pot.amount - share * top.length;
      // The odd chip goes to the first winner after the dealer.
      const ordered = h.seats.slice(h.seats.indexOf(h.dealer) + 1).concat(h.seats.slice(0, h.seats.indexOf(h.dealer) + 1)).filter((id) => top.includes(id));
      for (const id of ordered) {
        won[id] = (won[id] || 0) + share + (rest > 0 ? 1 : 0);
        if (rest > 0) rest--;
      }
    }
    return finish(h, won, shown, hands);
  }
  const pretty = (card) => card[0].replace("T", "10") + { s: "♠", h: "♥", d: "♦", c: "♣" }[card[1]];

  const model = { deck, shuffle, score5, best, compare, describe, start, options, act, leave, deal, pots, showdown, potOf, live, canAct, pretty, NAMES };
  root.PokerModel = model;
  if (typeof module !== "undefined") module.exports = model;
})(typeof window === "undefined" ? globalThis : window);
