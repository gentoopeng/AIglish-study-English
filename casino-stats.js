// Lifetime totals per casino game, for the カジノ ranking. Pure: no screen, no network.
//
// stats = { game: { b, n, p } }
//   b  total bet (points), n  total won less bet (may be negative), p  plays
// and, for すごろくビンゴ only, g bingos, j JP wins, s SJP wins, l balls drawn.
// The five other games are counted as each result is paid (once per key, inside the wallet
// transaction); すごろくビンゴ keeps its own lifetime totals in its save and replaces its entry
// with them (never with lower ones). Practice chips are never counted.
(function (root) {
  "use strict";
  const GAMES = ["poker", "blackjack", "roulette", "dice", "chinchiro"],
    ALL = [...GAMES, "sugoroku"],
    NAMES = { poker: "ポーカー", blackjack: "ブラックジャック", roulette: "ルーレット", dice: "ダイスポーカー", chinchiro: "チンチロ", sugoroku: "すごろくビンゴ" },
    COMMON = [["b", "累計賭け額"], ["n", "累計得額"], ["p", "プレイ回数"]],
    EXTRA = [["g", "ビンゴ回数"], ["j", "JP回数"], ["s", "SJP回数"], ["l", "ボール排出回数"]],
    CAP = 1e12;
  const metricsOf = (game) => (game === "sugoroku" ? [...COMMON, ...EXTRA] : COMMON);
  const whole = (v) => (Number.isSafeInteger(v) ? v : 0);
  const count = (v) => Math.min(CAP, Math.max(0, whole(v)));
  const signed = (v) => Math.min(CAP, Math.max(-CAP, whole(v)));
  // Which game a wallet key belongs to (null: not counted). Poker keys are table and hand; the
  // casino's are casino:<game>:…, and the group dice table is "dice-together".
  function gameOf(key) {
    key = String(key || "");
    if (!key.startsWith("casino:")) return "poker";
    const game = key.split(":")[1],
      name = game === "dice-together" ? "dice" : game;
    return GAMES.includes(name) ? name : null;
  }
  function cleanGame(game, value) {
    const v = value && typeof value === "object" ? value : {},
      out = { b: count(v.b), n: signed(v.n), p: count(v.p) };
    if (game === "sugoroku") for (const [k] of EXTRA) out[k] = count(v[k]);
    return out;
  }
  // Only known games, and whole numbers within bounds.
  function clean(stats) {
    const out = {};
    for (const game of ALL) {
      const value = stats && typeof stats === "object" ? stats[game] : null;
      if (value && typeof value === "object") out[game] = cleanGame(game, value);
    }
    return out;
  }
  // A game's totals as a ranking may trust them: what is bet cannot be lost twice over, and what is
  // won is bounded; anything else (the database rules are open) is not shown.
  function trusted(game, value) {
    if (!value || typeof value !== "object") return null;
    const v = cleanGame(game, value);
    if (v.p < 1 || v.n < -v.b || v.n > v.b * 100 + 1e6) return null;
    return v;
  }
  // One paid result: `delta` is what reached the wallet, `bet` what was staked in it and `play`
  // whether it starts a new play. `sugoroku`: its own lifetime totals, which replace the entry
  // unless they are lower than what is kept (an older save).
  function apply(stats, { game, delta = 0, bet = 0, play = false, sugoroku = null }) {
    const next = clean(stats);
    if (game && GAMES.includes(game)) {
      const g = next[game] || cleanGame(game, {});
      g.b = count(g.b + Math.max(0, whole(Math.floor(bet))));
      g.n = signed(g.n + whole(Math.round(delta)));
      g.p = count(g.p + (play ? 1 : 0));
      next[game] = g;
    }
    if (sugoroku) {
      const snap = cleanGame("sugoroku", sugoroku);
      if (snap.p >= (next.sugoroku?.p || 0)) next.sugoroku = snap;
    }
    return next;
  }
  // The flat entries a ranking row carries: "poker:b", "poker:n", …, from the trusted games only.
  function flat(stats) {
    const out = {};
    for (const game of ALL) {
      const v = trusted(game, stats && typeof stats === "object" ? stats[game] : null);
      if (v) for (const [k] of metricsOf(game)) out[game + ":" + k] = v[k];
    }
    return out;
  }
  const keys = () => ALL.flatMap((game) => metricsOf(game).map(([k]) => game + ":" + k));
  const label = (key) => {
    const [game, k] = String(key).split(":");
    return NAMES[game] ? NAMES[game] + " " + (metricsOf(game).find((m) => m[0] === k)?.[1] || "") : "";
  };
  const api = { GAMES, ALL, NAMES, gameOf, clean, trusted, apply, flat, keys, label, metricsOf };
  root.CasinoStats = Object.freeze(api);
  if (typeof module !== "undefined") module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
