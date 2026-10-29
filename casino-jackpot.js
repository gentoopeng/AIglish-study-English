// The casino's shared jackpots. Every point bet anywhere in the casino (all of it goes through
// Poker.settle) adds to one running total in shared/casino_jackpot; the jackpots are a part of
// what was bet since each was last won:
//   JACKPOT       = 5,000  + 1% of the total since the last JACKPOT
//   SUPER JACKPOT = 50,000 + 0.5% of the total since the last SUPER JACKPOT
// The seeds and the shares are paid for by the house edge of すごろくビンゴ, where they are won:
// with them, a roll there gives back about 96–98% of the bet over time (docs/site-stability.md).
// To keep cloud writes few, this device adds its bets up and sends them about once a minute,
// and reads the total at most once a minute. Offline, the last total seen is shown.
// A win (win()) takes the amount and starts that jackpot again in one transaction, so two
// winners at the same moment each get what was there in turn, never the same pot twice.
(function () {
  "use strict";
  const RULE = { jp: { seed: 5000, rate: 0.01 }, sjp: { seed: 50000, rate: 0.005 } };
  const EVERY = 60e3,
    cacheKey = "aiglish_casino_jackpot",
    pendingKey = "aiglish_casino_jackpot_pending";
  const online = () => !!(window.db && window.fbDoc && window.fbRunTransaction) && !window.FirestoreReadGuard?.paused?.();
  const ref = () => window.fbDoc(window.db, "shared", "casino_jackpot");
  // The total is shared, so a value read back is a whole number in a sane range or 0.
  const num = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 1e12 ? Math.floor(Number(v)) : 0);
  const MAX_ADD = 1e6;
  const read = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  };
  const write = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };
  let total = read(cacheKey, { bet: 0, jpFrom: 0, sjpFrom: 0, at: 0 }),
    sending = null,
    fetching = null,
    lastSent = 0;
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => fn(amounts()));

  function amounts() {
    const bet = num(total.bet) + num(read(pendingKey, 0));
    return {
      jp: Math.floor(RULE.jp.seed + RULE.jp.rate * Math.max(0, bet - num(total.jpFrom))),
      sjp: Math.floor(RULE.sjp.seed + RULE.sjp.rate * Math.max(0, bet - num(total.sjpFrom))),
    };
  }
  function keep(data) {
    total = { bet: num(data?.bet), jpFrom: num(data?.jpFrom), sjpFrom: num(data?.sjpFrom), at: Date.now() };
    write(cacheKey, total);
    notify();
  }
  // A bet of `amount` points somewhere in the casino.
  function add(amount) {
    if (!(amount > 0)) return;
    write(pendingKey, num(read(pendingKey, 0)) + Math.min(MAX_ADD, Math.round(amount)));
    notify();
    if (Date.now() - lastSent > EVERY) send();
  }
  function send() {
    const amount = num(read(pendingKey, 0));
    if (!amount || sending || !online()) return sending;
    lastSent = Date.now();
    sending = window
      .fbRunTransaction(window.db, async (tx) => {
        const snap = await tx.get(ref()),
          data = snap.exists() ? snap.data() : {};
        const next = { bet: num(data.bet) + amount, jpFrom: num(data.jpFrom), sjpFrom: num(data.sjpFrom), updatedAt: Date.now() };
        tx.set(ref(), next, { merge: true });
        return next;
      })
      .then((next) => {
        write(pendingKey, Math.max(0, num(read(pendingKey, 0)) - amount));
        keep(next);
      })
      .catch((error) => console.warn("[jackpot] send", error))
      .finally(() => (sending = null));
    return sending;
  }
  // The latest total, read at most once a minute unless forced.
  function refresh(force = false) {
    if (!online() || !window.fbGetDoc || fetching || (!force && Date.now() - num(total.at) < EVERY)) return fetching || Promise.resolve(amounts());
    fetching = Promise.resolve(window.fbGetDoc(ref()))
      .then((snap) => {
        if (snap.exists()) keep(snap.data());
        else total.at = Date.now();
        return amounts();
      })
      .catch((error) => {
        console.warn("[jackpot] read", error);
        return amounts();
      })
      .finally(() => (fetching = null));
    return fetching;
  }
  // The jackpot `kind` won by `who` ({ id, n }): this device's unsent bets go in first, the
  // amount is taken and that jackpot starts from its seed again. Resolves with the amount.
  async function win(kind, who) {
    if (!RULE[kind]) throw Error("bad jackpot");
    if (!online()) throw Error("offline");
    const mine = num(read(pendingKey, 0)),
      at = Date.now();
    const result = await window.fbRunTransaction(window.db, async (tx) => {
      const snap = await tx.get(ref()),
        data = snap.exists() ? snap.data() : {},
        bet = num(data.bet) + mine,
        from = { jpFrom: num(data.jpFrom), sjpFrom: num(data.sjpFrom) },
        amount = Math.floor(RULE[kind].seed + RULE[kind].rate * Math.max(0, bet - from[kind + "From"]));
      const wins = (Array.isArray(data.wins) ? data.wins : []).slice(-19).concat([{ kind, id: String(who?.id || ""), n: String(who?.n || "").slice(0, 24), amount, at }]);
      const next = { bet, ...from, [kind + "From"]: bet, wins, updatedAt: at };
      tx.set(ref(), next, { merge: true });
      return { next, amount };
    });
    write(pendingKey, Math.max(0, num(read(pendingKey, 0)) - mine));
    keep(result.next);
    return result.amount;
  }
  const onChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));
  document.addEventListener("visibilitychange", () => document.hidden && send());

  window.CasinoJackpot = Object.freeze({ RULE, amounts, add, send, refresh, win, onChange });
})();
