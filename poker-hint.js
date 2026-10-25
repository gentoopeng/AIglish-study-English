// Hand help for the player: what the cards make now (and which cards make it), and what the
// next card could turn them into, counted exactly over the cards still unseen.
(function (root) {
  "use strict";
  const P = root.PokerModel || (typeof require === "function" ? require("./poker-model.js") : null);
  const RANKS = "23456789TJQKA",
    SUIT = { s: "♠", h: "♥", d: "♦", c: "♣" },
    show = (rank) => (rank === "T" ? "10" : rank),
    rankOf = (card) => RANKS.indexOf(card[0]) + 2;
  // In plain words, for people who do not know the names yet.
  const PLAIN = [
    "役なし（一番強いカードで勝負）",
    "同じ数字が2枚",
    "同じ数字が2枚ずつ2組",
    "同じ数字が3枚",
    "数字が5つ続く",
    "同じマークが5枚",
    "3枚＋2枚の組",
    "同じ数字が4枚",
    "同じマークで5つ続く",
    "同じマークの10・J・Q・K・A",
  ];
  // The cards that make the hand: the matched ranks for pairs and sets, all five otherwise.
  function made(holes, board) {
    const cards = holes.concat(board);
    if (cards.length < 5) {
      const pair = holes.length === 2 && holes[0][0] === holes[1][0];
      return { category: pair ? 1 : 0, name: P.NAMES[pair ? 1 : 0], plain: PLAIN[pair ? 1 : 0], cards: pair ? holes.slice() : [highest(holes)] };
    }
    const top = P.best(cards),
      category = top.score[0];
    let parts = top.cards;
    if ([1, 2, 3, 7].includes(category)) {
      const count = {};
      for (const c of top.cards) count[c[0]] = (count[c[0]] || 0) + 1;
      parts = top.cards.filter((c) => count[c[0]] >= 2);
    } else if (category === 0) parts = [highest(top.cards)];
    return { category, name: top.name, plain: PLAIN[category], cards: parts };
  }
  const highest = (cards) => cards.slice().sort((a, b) => rankOf(b) - rankOf(a))[0];
  // Better hands the next card could bring, best first, each with the cards that do it.
  function draws(holes, board) {
    if (holes.length !== 2 || board.length < 3 || board.length > 4) return [];
    const known = new Set(holes.concat(board)),
      rest = P.deck().filter((c) => !known.has(c)),
      now = made(holes, board).category,
      found = new Map();
    for (const card of rest) {
      const next = board.concat(card),
        category = P.best(holes.concat(next)).score[0];
      // Only what the player's own cards take part in: a pair landing on the board is for everyone.
      if (category <= now || alone(next) >= category) continue;
      if (!found.has(category)) found.set(category, []);
      found.get(category).push(card);
    }
    return [...found.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([category, outs]) => ({
        category,
        name: P.NAMES[category],
        outs,
        need: needed(outs),
        // The chance that the next card is one of them (and, on the flop, either of the next two).
        next: outs.length / rest.length,
        byRiver: board.length === 3 ? 1 - ((rest.length - outs.length) * (rest.length - 1 - outs.length)) / (rest.length * (rest.length - 1)) : outs.length / rest.length,
      }));
  }
  // What the board makes by itself (fewer than five cards can still pair).
  function alone(cards) {
    if (cards.length >= 5) return P.best(cards).score[0];
    const counts = Object.values(cards.reduce((m, c) => ((m[c[0]] = (m[c[0]] || 0) + 1), m), {})).sort((a, b) => b - a);
    return counts[0] === 4 ? 7 : counts[0] === 3 ? 3 : counts[0] === 2 ? (counts[1] === 2 ? 2 : 1) : 0;
  }
  // "♦" when the suit decides, "8・K" when ranks do, otherwise a short list.
  function needed(outs) {
    const suits = new Set(outs.map((c) => c[1])),
      ranks = [...new Set(outs.map((c) => c[0]))].sort((a, b) => RANKS.indexOf(a) - RANKS.indexOf(b));
    if (suits.size === 1 && outs.length >= 4) return SUIT[[...suits][0]] + "のカード";
    if (ranks.length <= 3) return ranks.map(show).join("・");
    return ranks.slice(0, 3).map(show).join("・") + " など";
  }
  // Before the board: what two cards are good for.
  function start(holes) {
    if (holes.length !== 2) return [];
    const [a, b] = holes.map(rankOf),
      tips = [];
    if (a === b) tips.push("はじめからペア。強い手です");
    if (holes[0][1] === holes[1][1]) tips.push("同じマーク：フラッシュを狙えます");
    if (a !== b && Math.abs(a - b) <= 2) tips.push("数字が近い：ストレートを狙えます");
    if (Math.max(a, b) >= 12 && a !== b) tips.push("大きな数字があります");
    if (!tips.length) tips.push("弱めの手。無理せず降りるのも手です");
    return tips;
  }
  const api = { made, draws, start, PLAIN };
  root.PokerHint = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
