// Computer players for practice poker. A move comes from the chance of winning (estimated by
// dealing out the unknown cards many times), the price of calling, and a little randomness, so
// the computer plays sensibly but can be read and beaten. Levels change how exact and how bold
// it is; "normal" is tuned so that a typical player wins about 40% of games against it.
(function (root) {
  "use strict";
  const P = root.PokerModel || (typeof require === "function" ? require("./poker-model.js") : null);
  // noise: misjudging strength; read: how much a bet against it is taken as strength;
  // value: strength needed to bet or raise; bluff: betting with nothing; loose: calling too often;
  // mistake: the chance of a careless move (any allowed move).
  const LEVELS = {
    easy: { sims: 100, noise: 0.08, read: 0, margin: 0, value: 0.62, bluff: 0.08, loose: 0.04, mistake: 0.3 },
    normal: { sims: 160, noise: 0.06, read: 0.2, margin: 0, value: 0.58, bluff: 0.15, loose: 0.03, mistake: 0 },
    hard: { sims: 260, noise: 0.03, read: 0.45, margin: 0, value: 0.54, bluff: 0.28, loose: 0, mistake: 0 },
  };
  // Chance (0..1) that these two cards win against `opponents` random hands on this board.
  function equity(holes, board, opponents, sims, random) {
    const known = new Set(holes.concat(board)),
      rest = P.deck().filter((c) => !known.has(c));
    let score = 0;
    for (let s = 0; s < sims; s++) {
      const pool = rest.slice();
      const draw = () => pool.splice(random(pool.length), 1)[0];
      const others = Array.from({ length: opponents }, () => [draw(), draw()]),
        full = board.slice();
      while (full.length < 5) full.push(draw());
      const mine = P.best(holes.concat(full)).score;
      let best = true,
        ties = 0;
      for (const o of others) {
        const c = P.compare(P.best(o.concat(full)).score, mine);
        if (c > 0) {
          best = false;
          break;
        }
        if (c === 0) ties++;
      }
      if (best) score += 1 / (ties + 1);
    }
    return score / sims;
  }
  const clampTo = (o, value) => Math.max(o.raise.min, Math.min(o.raise.max, Math.round(value)));
  // A move for `id`: { type, to }. random(n) gives 0..n-1; chance() gives 0..1.
  function decide(hand, id, holes, level = "normal", random, chance) {
    const cfg = typeof level === "object" ? level : LEVELS[level] || LEVELS.normal,
      o = P.options(hand, id);
    if (!o) return null;
    if (cfg.mistake && (chance || Math.random)() < cfg.mistake) {
      const moves = [o.check ? { type: "check" } : { type: "call" }, o.check ? { type: "check" } : { type: "fold" }];
      if (o.raise) moves.push({ type: "raise", to: o.raise.min });
      return moves[Math.floor((chance || Math.random)() * moves.length)];
    }
    const rnd = random || ((n) => Math.floor(Math.random() * n)),
      roll = chance || Math.random,
      opponents = Math.max(1, P.live(hand).length - 1),
      raw = equity(holes, hand.board, opponents, cfg.sims, rnd),
      // Strength is judged against a fair share with this many players, plus some noise.
      fair = 1 / (opponents + 1),
      eq = Math.max(0, Math.min(1, raw + (roll() * 2 - 1) * cfg.noise)),
      edge = eq - fair,
      pot = o.pot,
      odds = o.call > 0 ? o.call / (pot + o.call) : 0,
      // Facing a bet, the other hand is likely better than a random one.
      read = o.call > 0 ? cfg.read * Math.min(1, o.call / Math.max(1, pot - o.call)) : 0,
      strong = eq >= cfg.value + (opponents - 1) * -0.08 || edge > 0.28;
    if (o.call === 0) {
      if (o.raise && (strong || roll() < cfg.bluff)) return { type: "raise", to: clampTo(o, hand.current + pot * (strong ? 0.6 + roll() * 0.3 : 0.5)) };
      return { type: "check" };
    }
    if (o.raise && strong && roll() < 0.7) return { type: "raise", to: clampTo(o, hand.current + Math.max(hand.minRaise, pot * 0.75)) };
    if (eq - read + cfg.loose >= odds + cfg.margin) return { type: "call" };
    if (roll() < cfg.bluff / 3 && o.call <= hand.bb * 2) return { type: "call" };
    return { type: "fold" };
  }
  const bot = { decide, equity, LEVELS };
  root.PokerBot = bot;
  if (typeof module !== "undefined") module.exports = bot;
})(typeof window === "undefined" ? globalThis : window);
