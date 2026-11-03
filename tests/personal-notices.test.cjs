const test = require("node:test");
const assert = require("node:assert/strict");
const N = require("../personal-notices.js");

const memory = () => {
  const values = new Map();
  return { get: (k) => values.get(k) ?? null, set: (k, v) => values.set(k, v) };
};
test("notices are kept per account, newest first, unread until seen", () => {
  let t = 1000;
  const n = N.create(memory(), () => t);
  assert.equal(n.unread("a"), 0);
  n.add("a", { id: "x", title: "一つ目", body: "本文", amount: 10 });
  t = 2000;
  n.add("a", { id: "y", title: "二つ目", amount: 5.9 });
  assert.deepEqual(n.list("a").map((i) => [i.id, i.amount]), [["y", 5], ["x", 10]]);
  assert.equal(n.unread("a"), 2);
  assert.equal(n.unread("b"), 0);
  assert.equal(n.markSeen("a"), 2000);
  assert.equal(n.unread("a"), 0);
  t = 3000;
  n.add("a", { id: "z", title: "三つ目" });
  assert.equal(n.unread("a"), 1);
});

test("the same id replaces the notice and makes it new again; the list is capped", () => {
  let t = 1;
  const n = N.create(memory(), () => t);
  n.add("a", { id: "time:2026-11-01", title: "古い", amount: 10 });
  n.markSeen("a");
  t = 5;
  n.add("a", { id: "time:2026-11-01", title: "新しい", amount: 15 });
  assert.equal(n.list("a").length, 1);
  assert.equal(n.list("a")[0].title, "新しい");
  assert.equal(n.unread("a"), 1);
  for (let i = 0; i < N.create(memory()).MAX + 10; i++) {
    t++;
    n.add("a", { id: "n" + i, title: "t" });
  }
  assert.equal(n.list("a").length, n.MAX);
  assert.equal(n.list("a")[0].id, "n" + (n.MAX + 9));
});

test("bad input is refused, long text is cut, and damaged storage reads as empty", () => {
  const store = memory();
  const n = N.create(store, () => 7);
  assert.throws(() => n.add("a", { title: "no id" }), /確認/);
  assert.throws(() => n.add("", { id: "x" }), /確認/);
  const item = n.add("a", { id: "x".repeat(200), title: "あ".repeat(100), body: "い".repeat(500), amount: -5 });
  assert.equal(item.id.length, 80);
  assert.equal(item.title.length, 60);
  assert.equal(item.body.length, 300);
  assert.equal(item.amount, 0);
  store.set("aiglish_personal_notices_a", "{not json");
  assert.deepEqual(n.list("a"), []);
  store.set("aiglish_personal_notices_a", JSON.stringify([{ id: "ok", at: 1, title: "t" }, { id: 5, at: 2 }, null, { id: "no-time" }]));
  assert.deepEqual(n.list("a").map((i) => i.id), ["ok"]);
});
