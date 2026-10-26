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
  for (let i = 0; i < L.MAX_ENTRIES + 5; i++) r = L.send(r, { id: "n" + i, from: "a", to: "b", amount: 1, kind: "lend", at });
  assert.equal(r.entries.length, L.MAX_ENTRIES);
});
