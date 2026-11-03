// Lending points between two users, without any screen or network. Everything between a pair
// lives in one record: a list of entries, oldest first, that is the history both see.
//
//   money    { kind: "lend" | "repay", from, to, amount }     points that moved from → to
//            a loan may carry interest (rate, one of RATES): `due` is what it adds to the debt,
//            the amount and its interest together, paid back like any other debt
//   request  { kind: "ask-lend" | "ask-repay", from, to, amount, status }
//            ask-lend: `from` asks `to` to lend; ask-repay (請求): `from` asks `to` to pay back.
//            status: "open" → "done" | "declined" | "cancelled"
//   give     { kind: "give", from, to, amount, note, request }   points one player gives the
//            other (あげる): owed by nobody. request: the ask-give it answers, if any
//   ask-give { kind: "ask-give", from, to, amount, status }  `from` asks `to` to give (もらう)
//   gift     { kind: "gift", from, to, amount, note }   points given, owed by nobody (the
//            運営 sends these)
//   charge   { kind: "charge", from, to, amount, note } points the 運営 takes back; taken from
//            `to`'s wallet (not below 0) when collected
//   message  { kind: "message", from, to, text }        a line of talk between the two
//
// The record keeps at most MAX_ENTRIES entries. When it is full the oldest messages go first,
// then finished requests, so what is owed is kept as long as possible.
//
// What one owes the other is what moved each way: every point sent counts for the sender, a loan
// with interest counts for what is due on it.
(function (root) {
  "use strict";
  const MAX_ENTRIES = 400,
    MAX_MESSAGES = 150,
    MAX_TEXT = 500,
    MAX_AMOUNT = 100000,
    // Interest a lender can ask, once, on the amount lent.
    RATES = [0, 0.05, 0.1, 0.2, 0.3];
  const pairKey = (a, b) => [a, b].sort().join("__");
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const isMoney = (entry) => entry.kind === "lend" || entry.kind === "repay";
  // Entries `to`'s device applies to its wallet when it collects: money and gifts add, a charge
  // takes away.
  const arrives = (entry) => isMoney(entry) || entry.kind === "give" || entry.kind === "gift" || entry.kind === "charge";
  const change = (entry) => (entry.kind === "charge" ? -entry.amount : entry.amount);
  // > 0: the other owes `me` that much. < 0: `me` owes the other.
  function net(entries, me) {
    let total = 0;
    for (const e of entries || []) {
      if (!isMoney(e)) continue;
      const value = e.kind === "lend" && Number.isInteger(e.due) && e.due >= e.amount ? e.due : e.amount;
      total += e.from === me ? value : e.to === me ? -value : 0;
    }
    return total;
  }
  const owedBy = (entries, me) => Math.max(0, -net(entries, me));
  function amountOf(value) {
    const n = Math.floor(Number(value));
    if (!(n >= 1)) throw Error("1pt以上で入れてください。");
    if (n > MAX_AMOUNT) throw Error("1回に動かせるのは" + MAX_AMOUNT.toLocaleString("ja-JP") + "ptまでです。");
    return n;
  }
  // Drops the oldest of what matters least, so a long talk never pushes a debt out.
  // `claimed`: ids the receiver has already taken in; a give or gift not yet taken in is never
  // dropped to make room, or the sender would be charged for points that never arrive.
  function trim(entries, claimed) {
    let list = entries;
    const drop = (test, keep) => {
      let extra = list.filter(test).length - keep;
      if (extra > 0) list = list.filter((e) => !(test(e) && extra-- > 0));
    };
    drop((e) => e.kind === "message", MAX_MESSAGES);
    if (list.length > MAX_ENTRIES) drop((e) => e.status && e.status !== "open", Math.max(0, MAX_ENTRIES - (list.length - list.filter((e) => e.status && e.status !== "open").length)));
    if (list.length > MAX_ENTRIES) {
      const over = list.length - MAX_ENTRIES,
        done = (e) => (e.kind === "give" || e.kind === "gift") && !!claimed?.[e.id];
      drop(done, Math.max(0, list.filter(done).length - over));
    }
    // What is left over the limit has to go, but never points the receiver has not collected yet:
    // the sender has already paid them, so the new line is refused instead.
    if (list.length > MAX_ENTRIES && list.slice(0, list.length - MAX_ENTRIES).some((e) => arrives(e) && !claimed?.[e.id])) throw Error("記録がいっぱいです。相手が受け取るまで、新しく送れません。");
    return list.slice(-MAX_ENTRIES);
  }
  function add(record, entry) {
    const next = record ? clone(record) : { entries: [] };
    next.entries = trim((next.entries || []).concat(entry), next.claimed);
    // `claimed` only needs the ids still in the record.
    if (next.claimed) {
      const ids = new Set(next.entries.map((e) => e.id));
      next.claimed = Object.fromEntries(Object.entries(next.claimed).filter(([id]) => ids.has(id)));
    }
    next.updatedAt = entry.at;
    return next;
  }
  // A line of talk.
  function say(record, { id, from, to, text, at }) {
    const line = String(text || "").trim().slice(0, MAX_TEXT);
    if (!line) throw Error("メッセージを入れてください。");
    if (from === to) throw Error("自分には送れません。");
    return add(record, { id, kind: "message", from, to, text: line, at });
  }
  // Points given (by the 運営): they reach `to` when collected and are owed by nobody. With
  // kind "charge" the 運営 takes points back instead.
  function gift(record, { id, from, to, amount, note, at, kind = "gift" }) {
    if (kind !== "gift" && kind !== "charge") throw Error("不明な操作です。");
    return add(record, { id, kind, from, to, amount: amountOf(amount), note: String(note || "").slice(0, 120), at });
  }
  const findOpen = (record, id) => (record?.entries || []).find((e) => e.id === id && e.status === "open");
  // Points leave `from` for `to`: a loan, or a repayment that may not go past what is owed.
  // What a loan of `amount` at `rate` adds to the debt.
  function dueOf(amount, rate) {
    if (!RATES.includes(rate)) throw Error("利子は" + RATES.map((r) => r * 100 + "%").join("・") + "から選んでください。");
    return amount + Math.round(amount * rate);
  }
  // What each kind of move may answer.
  const ANSWERS = { lend: "ask-lend", repay: "ask-repay", give: "ask-give" };
  function send(record, { id, from, to, amount, kind, note, at, request, rate = 0 }) {
    amount = amountOf(amount);
    if (from === to) throw Error("自分には送れません。");
    if (kind === "repay") {
      const owed = owedBy(record?.entries, from);
      if (!owed) throw Error("返すポイントはありません。");
      if (amount > owed) throw Error("返すのは借りている" + owed.toLocaleString("ja-JP") + "ptまでです。");
    } else if (kind !== "lend" && kind !== "give") throw Error("不明な操作です。");
    const interest = kind === "lend" && rate ? { rate, due: dueOf(amount, rate) } : {};
    let next = add(record, { id, kind, from, to, amount, ...interest, note: String(note || "").slice(0, 60), at, request: request || null });
    if (request) {
      const asked = findOpen(next, request);
      if (!asked) throw Error("この頼みはもう終わっています。");
      // The move has to be the answer to that request: right kind, between the same two, and a
      // give for exactly the asked amount.
      if (asked.kind !== ANSWERS[kind] || asked.from !== to || asked.to !== from || (kind === "give" && asked.amount !== amount)) throw Error("この頼みには応えられません。");
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
    } else if (kind !== "ask-lend" && kind !== "ask-give") throw Error("不明な操作です。");
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
  const unclaimed = (record, me) => (record?.entries || []).filter((e) => arrives(e) && e.to === me && !record.claimed?.[e.id]);
  const openFor = (record, me) => (record?.entries || []).filter((e) => e.status === "open" && e.to === me);
  const api = { change, arrives, MAX_ENTRIES, MAX_MESSAGES, MAX_TEXT, say, gift, trim, MAX_AMOUNT, RATES, pairKey, net, owedBy, amountOf, dueOf, send, ask, close, unclaimed, openFor, isMoney };
  root.PointLoansModel = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
