// The casino's shared jackpots. Every point bet anywhere in the casino (all of it goes through
// Poker.settle) adds to one running total in shared/casino_jackpot; the jackpots are a part of
// what was bet since each was last won:
//   JACKPOT       = 5,000  + 5% of the total since the last JACKPOT
//   SUPER JACKPOT = 50,000 + 2% of the total since the last SUPER JACKPOT
// To keep cloud writes few, this device adds its bets up and sends them about once a minute,
// and reads the total at most once a minute. Offline, the last total seen is shown.
(function () {
  "use strict";
  const RULE = { jp: { seed: 5000, rate: 0.05 }, sjp: { seed: 50000, rate: 0.02 } };
  const EVERY = 60e3,
    cacheKey = "aiglish_casino_jackpot",
    pendingKey = "aiglish_casino_jackpot_pending";
  const online = () => !!(window.db && window.fbDoc && window.fbRunTransaction) && !window.FirestoreReadGuard?.paused?.();
  const ref = () => window.fbDoc(window.db, "shared", "casino_jackpot");
  const num = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : 0);
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
    write(pendingKey, num(read(pendingKey, 0)) + Math.round(amount));
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
  const onChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));
  document.addEventListener("visibilitychange", () => document.hidden && send());

  window.CasinoJackpot = Object.freeze({ RULE, amounts, add, send, refresh, onChange });
})();
