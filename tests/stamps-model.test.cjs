const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../stamps-model.js");
const L = require("../point-loans-model.js");

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("a stamp is made with a trimmed name and a whole price, and nothing else is let in", () => {
  const doc = M.make({ ownerId: "u1", ownerName: "  あや ", name: "  ぱんだ\u0000  スタンプ ", price: 50, at: 1000 });
  assert.deepEqual(doc, { ownerId: "u1", ownerName: "あや", name: "ぱんだ スタンプ", price: 50, status: "on", sales: 0, createdAt: 1000, v: 1 });
  assert.equal(M.make({ ownerId: "u1", name: "x".repeat(50), price: 0 }).name.length, M.MAX_NAME);
  assert.throws(() => M.make({ ownerId: "u1", name: "   ", price: 1 }), /名前/);
  assert.throws(() => M.make({ ownerId: "", name: "a", price: 1 }), /ログイン/);
  for (const bad of [-1, 1.5, M.MAX_PRICE + 1, NaN, "", null, "abc"]) assert.throws(() => M.priceOf(bad), /値段/, String(bad));
  assert.equal(M.priceOf("0"), 0);
  assert.equal(M.priceOf(M.MAX_PRICE), M.MAX_PRICE);
});

test("a stamp read back is cleaned: known fields, a status that exists, a price in range", () => {
  const s = M.clean({ ownerId: "u1", ownerName: "あや", name: "ぱんだ", price: 99999999, status: "on", sales: -3, createdAt: 5, extra: "x", image: "data:" }, "abcdefgh12");
  assert.deepEqual(s, { id: "abcdefgh12", ownerId: "u1", ownerName: "あや", name: "ぱんだ", price: M.MAX_PRICE, status: "on", sales: 0, createdAt: 5 });
  assert.equal(M.clean({ ownerId: "u1", status: "weird" }, "abcdefgh12").status, "deleted", "an unknown status is treated as removed");
  assert.equal(M.clean(null, "abcdefgh12"), null);
  assert.equal(M.clean({ name: "no owner" }, "abcdefgh12"), null);
  assert.equal(M.clean({ ownerId: "u1" }, "bad id!").id, undefined);
});

test("ids and pictures: only safe values", () => {
  for (const ok of ["abcdefgh", "A_b-c_d-e1", "x".repeat(40)]) assert.equal(M.isId(ok), true, ok);
  for (const bad of ["short", "x".repeat(41), "has space1", "a/b/c/d/e/f", "", null, 5, "日本語のスタンプです"]) assert.equal(M.isId(bad), false, String(bad));
  assert.equal(M.imageOk(PNG), true);
  assert.equal(M.imageOk("data:image/webp;base64,AAAA"), true);
  assert.equal(M.imageOk("data:image/svg+xml;base64,AAAA"), false, "svg is not let in");
  assert.equal(M.imageOk("data:text/html;base64,AAAA"), false);
  assert.equal(M.imageOk("javascript:alert(1)"), false);
  assert.equal(M.imageOk("https://example.com/a.png"), false);
  assert.equal(M.imageOk(PNG + '"onerror="x'), false);
  assert.equal(M.imageOk("data:image/png;base64," + "A".repeat(M.MAX_IMAGE)), false, "too big");
  assert.deepEqual(M.box(["abcdefgh", "abcdefgh", "bad", 5, "zzzzzzzz"]), ["abcdefgh", "zzzzzzzz"]);
  assert.deepEqual(M.box("nope"), []);
});

test("what may be bought: the reason is given for each refusal, and the price asked is the price shown", () => {
  const stamp = { ownerId: "maker", name: "ぱんだ", price: 50, status: "on", sales: 0 };
  const ok = { stamp, id: "abcdefgh", me: "buyer", owned: [], seen: 50, balance: 500, ownerGone: false };
  assert.equal(M.checkBuy(ok), 50);
  assert.equal(M.checkBuy({ ...ok, stamp: { ...stamp, price: 0 }, seen: 0, balance: 0 }), 0, "free needs no points");
  assert.throws(() => M.checkBuy({ ...ok, id: "bad" }), /買えません/);
  assert.throws(() => M.checkBuy({ ...ok, stamp: null }), /見つかりません/);
  assert.throws(() => M.checkBuy({ ...ok, me: "maker" }), /自分のスタンプ/);
  assert.throws(() => M.checkBuy({ ...ok, owned: ["abcdefgh"] }), /もう持って/);
  assert.throws(() => M.checkBuy({ ...ok, stamp: { ...stamp, status: "deleted" } }), /削除/);
  for (const status of ["paused", "stopped"]) assert.throws(() => M.checkBuy({ ...ok, stamp: { ...stamp, status } }), /売られていません/, status);
  assert.throws(() => M.checkBuy({ ...ok, ownerGone: true }), /アカウントがありません/);
  assert.throws(() => M.checkBuy({ ...ok, seen: 10 }), /値段が変わりました（今は 50pt）/);
  assert.throws(() => M.checkBuy({ ...ok, balance: 49 }), /ポイントが足りません（所持 49pt）/);
  assert.equal(M.forSale(stamp), true);
  assert.equal(M.forSale({ ...stamp, status: "paused" }), false);
  assert.equal(M.usable({ ...stamp, status: "stopped" }), true, "stopped: those who have it still use it");
  assert.equal(M.usable({ ...stamp, status: "deleted" }), false);
});

test("a stamp is a line of talk: validated like one, counted with the messages, never in the way of points", () => {
  const at = (n) => 1000 + n;
  let record = null;
  record = L.stamp(record, { id: "e1", from: "a", to: "b", stamp: "abcdefgh12", at: at(1) });
  assert.deepEqual(record.entries[0], { id: "e1", kind: "stamp", from: "a", to: "b", stamp: "abcdefgh12", at: at(1) });
  assert.throws(() => L.stamp(record, { id: "e2", from: "a", to: "a", stamp: "abcdefgh12", at: at(2) }), /自分/);
  assert.throws(() => L.stamp(record, { id: "e2", from: "a", to: "CASINO", stamp: "abcdefgh12", at: at(2) }), /送れません/);
  assert.throws(() => L.stamp(record, { id: "e2", from: "a", to: "ADMIN", stamp: "abcdefgh12", at: at(2) }), /送れません/);
  for (const bad of ["", "short", "../x", "a b c d e f g h", null]) assert.throws(() => L.stamp(record, { id: "e2", from: "a", to: "b", stamp: bad, at: at(2) }), /送れません/, String(bad));
  // The points a stamp cost (a give) are kept until they are taken in, however many lines come after.
  record = L.send(record, { id: "g1", from: "a", to: "b", amount: 50, kind: "give", note: "スタンプ「ぱんだ」", at: at(3) });
  for (let i = 0; i < L.MAX_MESSAGES + 40; i++) record = i % 2 ? L.stamp(record, { id: "s" + i, from: "b", to: "a", stamp: "abcdefgh12", at: at(10 + i) }) : L.say(record, { id: "m" + i, from: "b", to: "a", text: "hi", at: at(10 + i) });
  const lines = record.entries.filter((e) => e.kind === "message" || e.kind === "stamp");
  assert.equal(lines.length, L.MAX_MESSAGES, "stamps and messages share the cap");
  assert.ok(record.entries.some((e) => e.id === "g1"), "the payment is kept");
});
