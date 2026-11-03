const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../point-loans-model.js");

const at = 1000;
test("a loan and its repayment settle the balance between two people", () => {
  let r = L.send(null, { id: "1", from: "a", to: "b", amount: 50, kind: "lend", at });
  assert.equal(L.net(r.entries, "a"), 50);
  assert.equal(L.net(r.entries, "b"), -50);
  assert.equal(L.owedBy(r.entries, "b"), 50);
  r = L.send(r, { id: "2", from: "b", to: "a", amount: 20, kind: "repay", at });
  assert.equal(L.owedBy(r.entries, "b"), 30);
  assert.throws(() => L.send(r, { id: "3", from: "b", to: "a", amount: 31, kind: "repay", at }), /30pt/);
  assert.throws(() => L.send(r, { id: "3", from: "a", to: "b", amount: 1, kind: "repay", at }), /返すポイントはありません/);
  r = L.send(r, { id: "3", from: "b", to: "a", amount: 30, kind: "repay", at });
  assert.equal(L.net(r.entries, "a"), 0);
  assert.equal(L.pairKey("b", "a"), "a__b");
});

test("amounts are whole points within the limit", () => {
  assert.throws(() => L.amountOf(0), /1pt以上/);
  assert.throws(() => L.amountOf("x"), /1pt以上/);
  assert.throws(() => L.amountOf(L.MAX_AMOUNT + 1), /まで/);
  assert.equal(L.amountOf("12.8"), 12);
  assert.throws(() => L.send(null, { id: "1", from: "a", to: "a", amount: 5, kind: "lend", at }), /自分/);
});

test("asking to borrow, then the lender lends against the request", () => {
  let r = L.ask(null, { id: "q", from: "b", to: "a", amount: 40, kind: "ask-lend", at, note: "ポーカー用" });
  assert.deepEqual(L.openFor(r, "a").map((e) => e.id), ["q"]);
  assert.throws(() => L.ask(r, { id: "q2", from: "b", to: "a", amount: 10, kind: "ask-lend", at }), /返事待ち/);
  r = L.send(r, { id: "m", from: "a", to: "b", amount: 40, kind: "lend", at: 2000, request: "q" });
  assert.equal(r.entries[0].status, "done");
  assert.equal(r.entries[0].resolvedAt, 2000);
  assert.equal(L.openFor(r, "a").length, 0);
  assert.throws(() => L.send(r, { id: "m2", from: "a", to: "b", amount: 40, kind: "lend", at, request: "q" }), /もう終わって/);
});

test("a repayment request (請求) only up to what is owed, and paying it closes it", () => {
  let r = L.send(null, { id: "1", from: "a", to: "b", amount: 50, kind: "lend", at });
  assert.throws(() => L.ask(r, { id: "x", from: "b", to: "a", amount: 10, kind: "ask-repay", at }), /貸しているポイントはありません/);
  assert.throws(() => L.ask(r, { id: "x", from: "a", to: "b", amount: 60, kind: "ask-repay", at }), /50pt/);
  r = L.ask(r, { id: "x", from: "a", to: "b", amount: 50, kind: "ask-repay", at });
  r = L.send(r, { id: "2", from: "b", to: "a", amount: 50, kind: "repay", at, request: "x" });
  assert.equal(r.entries.find((e) => e.id === "x").status, "done");
  assert.equal(L.net(r.entries, "a"), 0);
});

test("declining and cancelling keep the request in the history", () => {
  let r = L.ask(null, { id: "q", from: "b", to: "a", amount: 40, kind: "ask-lend", at });
  assert.throws(() => L.close(r, { id: "q", by: "c", at }), /答えられません/);
  const declined = L.close(r, { id: "q", by: "a", at: 5 });
  assert.equal(declined.entries[0].status, "declined");
  const cancelled = L.close(r, { id: "q", by: "b", at: 5 });
  assert.equal(cancelled.entries[0].status, "cancelled");
  assert.throws(() => L.close(declined, { id: "q", by: "a", at }), /もう終わって/);
  assert.equal(declined.entries.length, 1);
});

test("money to me is unclaimed until marked, and the history is capped", () => {
  let r = L.send(null, { id: "1", from: "a", to: "b", amount: 5, kind: "lend", at });
  assert.deepEqual(L.unclaimed(r, "b").map((e) => e.id), ["1"]);
  assert.deepEqual(L.unclaimed(r, "a"), []);
  r.claimed = { 1: true };
  assert.deepEqual(L.unclaimed(r, "b"), []);
  // Each is collected as it comes, so the oldest can go once the record is full.
  for (let i = 0; i < L.MAX_ENTRIES + 5; i++) {
    r = L.send(r, { id: "n" + i, from: "a", to: "b", amount: 1, kind: "lend", at });
    r.claimed = { ...r.claimed, ["n" + i]: true };
  }
  assert.equal(r.entries.length, L.MAX_ENTRIES);
});

test("a loan can carry interest: the debt is the amount and its interest, repaid like any debt", () => {
  let r = L.send(null, { id: "1", from: "a", to: "b", amount: 50, kind: "lend", at, rate: 0.1 });
  assert.deepEqual([r.entries[0].rate, r.entries[0].due], [0.1, 55]);
  assert.equal(L.owedBy(r.entries, "b"), 55);
  assert.equal(L.net(r.entries, "a"), 55);
  r = L.send(r, { id: "2", from: "b", to: "a", amount: 55, kind: "repay", at });
  assert.equal(L.net(r.entries, "a"), 0);
  // Rounded to whole points; only the offered rates; a repayment never carries interest.
  assert.equal(L.dueOf(33, 0.05), 35);
  assert.throws(() => L.send(null, { id: "1", from: "a", to: "b", amount: 50, kind: "lend", at, rate: 0.15 }), /利子/);
  const repaid = L.send(L.send(null, { id: "1", from: "a", to: "b", amount: 10, kind: "lend", at }), { id: "2", from: "b", to: "a", amount: 5, kind: "repay", at, rate: 0.3 });
  assert.equal(repaid.entries[1].due, undefined);
  // An older record without `due` counts the amount.
  assert.equal(L.net([{ kind: "lend", from: "a", to: "b", amount: 20 }], "a"), 20);
});

test("talk and gifts live in the same record; a gift is collected but owed by nobody", () => {
  let r = L.say(null, { id: "m1", from: "a", to: "b", text: "  こんにちは  ", at });
  assert.equal(r.entries[0].text, "こんにちは");
  assert.throws(() => L.say(r, { id: "m2", from: "a", to: "b", text: "   ", at }), /メッセージ/);
  assert.equal(L.say(null, { id: "m", from: "a", to: "b", text: "x".repeat(900), at }).entries[0].text.length, L.MAX_TEXT);
  r = L.gift(r, { id: "g1", from: "ADMIN", to: "b", amount: 500, note: "がんばったで賞", at });
  assert.equal(L.net(r.entries, "b"), 0);
  assert.deepEqual(L.unclaimed(r, "b").map((e) => [e.kind, e.amount]), [["gift", 500]]);
  assert.throws(() => L.gift(null, { id: "g", from: "ADMIN", to: "b", amount: 0, at }), /1pt以上/);
});

test("a long talk drops old messages first and never a debt", () => {
  let r = L.send(null, { id: "loan", from: "a", to: "b", amount: 50, kind: "lend", at });
  for (let i = 0; i < 600; i++) r = L.say(r, { id: "m" + i, from: i % 2 ? "a" : "b", to: i % 2 ? "b" : "a", text: "やあ" + i, at });
  assert.equal(r.entries.filter((e) => e.kind === "message").length, L.MAX_MESSAGES);
  assert.equal(r.entries[r.entries.length - 1].text, "やあ599");
  assert.equal(L.owedBy(r.entries, "b"), 50);
});

test("the 運営 can take points back: a charge is applied by the player's device, negative", () => {
  const r = L.gift(L.gift(null, { id: "g", from: "ADMIN", to: "b", amount: 300, at }), { id: "c", from: "ADMIN", to: "b", amount: 50, at, kind: "charge" });
  assert.deepEqual(L.unclaimed(r, "b").map((e) => L.change(e)), [300, -50]);
  assert.equal(L.net(r.entries, "b"), 0);
  assert.throws(() => L.gift(null, { id: "x", from: "ADMIN", to: "b", amount: 5, at, kind: "lend" }), /不明/);
});

test("giving (あげる) moves points owed by nobody, and is collected by the receiver once", () => {
  let r = L.send(null, { id: "g1", from: "a", to: "b", amount: 40, kind: "give", note: "お祝い", at });
  assert.equal(L.net(r.entries, "a"), 0);
  assert.equal(L.net(r.entries, "b"), 0);
  assert.equal(L.owedBy(r.entries, "b"), 0);
  assert.equal(r.entries[0].due, undefined);
  assert.deepEqual(L.unclaimed(r, "b").map((e) => e.id), ["g1"]);
  assert.equal(L.unclaimed(r, "a").length, 0);
  assert.equal(L.change(r.entries[0]), 40);
  r.claimed = { g1: 5 };
  assert.equal(L.unclaimed(r, "b").length, 0);
  // A give never counts as a repayment of a debt, and no interest is added to it.
  r = L.send(L.send(null, { id: "1", from: "a", to: "b", amount: 50, kind: "lend", at }), { id: "g", from: "b", to: "a", amount: 10, kind: "give", at, rate: 0.3 });
  assert.equal(L.owedBy(r.entries, "b"), 50);
  assert.equal(r.entries[1].due, undefined);
});

test("asking to be given (もらう) is answered by a give of exactly that amount, or declined", () => {
  let r = L.ask(null, { id: "q", from: "b", to: "a", amount: 30, kind: "ask-give", at });
  assert.deepEqual(L.openFor(r, "a").map((e) => e.id), ["q"]);
  assert.throws(() => L.ask(r, { id: "q2", from: "b", to: "a", amount: 5, kind: "ask-give", at }), /返事待ち/);
  // The request has to be answered by the right move, between the same two, for the same amount.
  assert.throws(() => L.send(r, { id: "x", from: "a", to: "b", amount: 1, kind: "give", at, request: "q" }), /応えられません/);
  assert.throws(() => L.send(r, { id: "x", from: "a", to: "b", amount: 30, kind: "lend", at, request: "q" }), /応えられません/);
  assert.throws(() => L.send(r, { id: "x", from: "b", to: "a", amount: 30, kind: "give", at, request: "q" }), /応えられません/);
  assert.throws(() => L.send(L.send(null, { id: "1", from: "b", to: "a", amount: 30, kind: "lend", at }), { id: "x", from: "a", to: "b", amount: 30, kind: "repay", at, request: "none" }), /もう終わって/);
  assert.equal(r.entries[0].status, "open");
  r = L.send(r, { id: "g", from: "a", to: "b", amount: 30, kind: "give", at: 9, request: "q" });
  assert.equal(r.entries[0].status, "done");
  assert.equal(L.openFor(r, "a").length, 0);
  assert.throws(() => L.send(r, { id: "g2", from: "a", to: "b", amount: 30, kind: "give", at, request: "q" }), /もう終わって/);
  const declined = L.close(L.ask(null, { id: "q", from: "b", to: "a", amount: 30, kind: "ask-give", at }), { id: "q", by: "a", at: 5 });
  assert.equal(declined.entries[0].status, "declined");
  // The older request kinds are still answered only by their own move.
  const lendAsk = L.ask(null, { id: "l", from: "b", to: "a", amount: 30, kind: "ask-lend", at });
  assert.throws(() => L.send(lendAsk, { id: "x", from: "a", to: "b", amount: 30, kind: "give", at, request: "l" }), /応えられません/);
});

test("a full record never drops a give that has not been collected, and keeps `claimed` short", () => {
  // 400 gives waiting to be collected: the next one is refused (nothing is paid), not the oldest dropped.
  let r = null;
  for (let i = 0; i < L.MAX_ENTRIES; i++) r = L.send(r, { id: "g" + i, from: "a", to: "b", amount: 1, kind: "give", at });
  assert.equal(r.entries.length, L.MAX_ENTRIES);
  assert.throws(() => L.send(r, { id: "extra", from: "a", to: "b", amount: 1, kind: "give", at }), /記録がいっぱい/);
  assert.throws(() => L.say(r, { id: "m", from: "a", to: "b", text: "hi", at }), /記録がいっぱい/);
  assert.equal(r.entries[0].id, "g0");
  // Once the oldest is collected there is room again, and that one goes.
  r.claimed = { g0: 1 };
  r = L.send(r, { id: "extra", from: "a", to: "b", amount: 1, kind: "give", at });
  assert.equal(r.entries.length, L.MAX_ENTRIES);
  assert.equal(r.entries[0].id, "g1");
  assert.deepEqual(r.claimed, {});
  r = L.send(L.send(null, { id: "lend", from: "a", to: "b", amount: 90, kind: "lend", at }), { id: "x", from: "a", to: "b", amount: 1, kind: "give", at });
  r.claimed = { lend: 1, x: 1, gone: 1 };
  r = L.say(r, { id: "m", from: "a", to: "b", text: "hi", at });
  assert.deepEqual(Object.keys(r.claimed).sort(), ["lend", "x"]);
  // Collected gives go before debts and uncollected gives when the record is over its limit.
  let full = L.send(null, { id: "debt", from: "a", to: "b", amount: 90, kind: "lend", at });
  full = L.send(full, { id: "old", from: "a", to: "b", amount: 5, kind: "give", at });
  full.claimed = { old: 1 };
  for (let i = 0; i < L.MAX_ENTRIES - 2; i++) full = L.send(full, { id: "n" + i, from: "a", to: "b", amount: 1, kind: "give", at });
  full = L.send(full, { id: "last", from: "a", to: "b", amount: 1, kind: "give", at });
  assert.equal(full.entries.length, L.MAX_ENTRIES);
  assert.ok(full.entries.some((e) => e.id === "debt"));
  assert.ok(!full.entries.some((e) => e.id === "old"));
  assert.ok(full.entries.some((e) => e.id === "last"));
});
