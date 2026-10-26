// Lending points between two users, without any screen or network. Everything between a pair
// lives in one record: a list of entries, oldest first, that is the history both see.
//
//   money    { kind: "lend" | "repay", from, to, amount }     points that moved from → to
//   request  { kind: "ask-lend" | "ask-repay", from, to, amount, status }
//            ask-lend: `from` asks `to` to lend; ask-repay (請求): `from` asks `to` to pay back.
//            status: "open" → "done" | "declined" | "cancelled"
//
// What one owes the other is simply what moved each way: every point sent counts for the sender.
(function (root) {
  "use strict";
  const MAX_ENTRIES = 200,
    MAX_AMOUNT = 100000;
  const pairKey = (a, b) => [a, b].sort().join("__");
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const isMoney = (entry) => entry.kind === "lend" || entry.kind === "repay";
  // > 0: the other owes `me` that much. < 0: `me` owes the other.
  function net(entries, me) {
    let total = 0;
    for (const e of entries || []) if (isMoney(e)) total += e.from === me ? e.amount : e.to === me ? -e.amount : 0;
    return total;
  }
  const owedBy = (entries, me) => Math.max(0, -net(entries, me));
  function amountOf(value) {
    const n = Math.floor(Number(value));
    if (!(n >= 1)) throw Error("1pt以上で入れてください。");
    if (n > MAX_AMOUNT) throw Error("1回に動かせるのは" + MAX_AMOUNT.toLocaleString("ja-JP") + "ptまでです。");
    return n;
  }
  function add(record, entry) {
    const next = record ? clone(record) : { entries: [] };
    next.entries = (next.entries || []).concat(entry).slice(-MAX_ENTRIES);
    next.updatedAt = entry.at;
    return next;
  }
  const findOpen = (record, id) => (record?.entries || []).find((e) => e.id === id && e.status === "open");
  // Points leave `from` for `to`: a loan, or a repayment that may not go past what is owed.
  function send(record, { id, from, to, amount, kind, note, at, request }) {
    amount = amountOf(amount);
    if (from === to) throw Error("自分には送れません。");
    if (kind === "repay") {
      const owed = owedBy(record?.entries, from);
      if (!owed) throw Error("返すポイントはありません。");
      if (amount > owed) throw Error("返すのは借りている" + owed.toLocaleString("ja-JP") + "ptまでです。");
    } else if (kind !== "lend") throw Error("不明な操作です。");
    let next = add(record, { id, kind, from, to, amount, note: String(note || "").slice(0, 60), at, request: request || null });
    if (request) {
      const asked = findOpen(next, request);
      if (!asked) throw Error("この頼みはもう終わっています。");
      Object.assign(asked, { status: "done", resolvedAt: at });
    }
    return next;
  }
  function ask(record, { id, from, to, amount, kind, note, at }) {
    amount = amountOf(amount);
    if (from === to) throw Error("自分には頼めません。");
    if (kind === "ask-repay") {
      const owed = Math.max(0, net(record?.entries, from));
      if (!owed) throw Error("相手に貸しているポイントはありません。");
      if (amount > owed) throw Error("請求できるのは貸している" + owed.toLocaleString("ja-JP") + "ptまでです。");
    } else if (kind !== "ask-lend") throw Error("不明な操作です。");
    if ((record?.entries || []).some((e) => e.status === "open" && e.kind === kind && e.from === from)) throw Error("同じ頼みがまだ返事待ちです。");
    return add(record, { id, kind, from, to, amount, note: String(note || "").slice(0, 60), at, status: "open" });
  }
  // The one asked declines, or the one who asked takes it back.
  function close(record, { id, by, at }) {
    const next = clone(record);
    const asked = findOpen(next, id);
    if (!asked) throw Error("この頼みはもう終わっています。");
    if (by !== asked.from && by !== asked.to) throw Error("この頼みには答えられません。");
    Object.assign(asked, { status: by === asked.from ? "cancelled" : "declined", resolvedAt: at });
    next.updatedAt = at;
    return next;
  }
  // Money sent to `me` that has not been added to my wallet yet.
  const unclaimed = (record, me) => (record?.entries || []).filter((e) => isMoney(e) && e.to === me && !record.claimed?.[e.id]);
  const openFor = (record, me) => (record?.entries || []).filter((e) => e.status === "open" && e.to === me);
  const api = { MAX_ENTRIES, MAX_AMOUNT, pairKey, net, owedBy, amountOf, send, ask, close, unclaimed, openFor, isMoney };
  root.PointLoansModel = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
