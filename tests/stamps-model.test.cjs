const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../stamps-model.js");
const L = require("../point-loans-model.js");

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("a stamp is made with a trimmed name and a whole price, and nothing else is let in", () => {
  const doc = M.make({ ownerId: "u1", ownerName: "  あや ", name: "  ぱんだ\u0000  スタンプ ", price: 50, at: 1000 });
  assert.deepEqual(doc, { ownerId: "u1", ownerName: "あや", name: "ぱんだ スタンプ", price: 50, status: "pending", sales: 0, createdAt: 1000, feePaid: 0, feeHeld: 0, imageV: 0, v: 2 });
  assert.equal(M.make({ ownerId: "u1", name: "x".repeat(50), price: 0 }).name.length, M.MAX_NAME);
  assert.throws(() => M.make({ ownerId: "u1", name: "   ", price: 1 }), /名前/);
  assert.throws(() => M.make({ ownerId: "", name: "a", price: 1 }), /ログイン/);
  for (const bad of [-1, 1.5, M.MAX_PRICE + 1, NaN, "", null, "abc"]) assert.throws(() => M.priceOf(bad), /値段/, String(bad));
  assert.equal(M.priceOf("0"), 0);
  assert.equal(M.priceOf(M.MAX_PRICE), M.MAX_PRICE);
});

test("a stamp read back is cleaned: known fields, a status that exists, a price in range", () => {
  const s = M.clean({ ownerId: "u1", ownerName: "あや", name: "ぱんだ", price: 99999999, status: "on", sales: -3, createdAt: 5, extra: "x", image: "data:" }, "abcdefgh12");
  assert.deepEqual(s, { id: "abcdefgh12", ownerId: "u1", ownerName: "あや", name: "ぱんだ", price: M.MAX_PRICE, status: "on", sales: 0, createdAt: 5, feePaid: M.MAX_PRICE, feeHeld: 0, imageV: 0, draft: false, review: "", reviewNote: "", rejectReason: "", approvedAt: 0, next: null });
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

test("approval: pending and rejected stamps are seen only by the maker and the admin", () => {
  const pending = M.clean({ ownerId: "u1", name: "a", price: 30, status: "pending", feeHeld: 30 }, "abcdefgh12");
  assert.equal(pending.status, "pending");
  assert.equal(pending.feePaid, 0, "nothing is paid until it is approved");
  assert.equal(pending.feeHeld, 30);
  assert.equal(M.usable(pending, "u1", false), true);
  assert.equal(M.usable(pending, "u2", false), false);
  assert.equal(M.usable(pending, "u2", true), true);
  assert.equal(M.usable({ ...pending, status: "deleted" }, "u1", true), false);
  assert.equal(M.usable({ ...pending, status: "on" }, "u2", false), true);
  assert.equal(M.forSale(pending), false);
  assert.equal(M.clean({ ownerId: "u1", status: "rejected", rejectReason: "x".repeat(300) }, "abcdefgh12").rejectReason.length, 100);
});

test("fee: only what is not paid yet; edits plan", () => {
  const live = M.clean({ ownerId: "u1", name: "a", price: 100, status: "on" }, "abcdefgh12");
  assert.equal(live.feePaid, 100, "a stamp from before approval counts as paid");
  assert.equal(M.feeFor(live, 40), 0);
  assert.equal(M.feeFor(live, 150), 50);
  assert.deepEqual(M.planEdit(live, { price: 40 }), { name: undefined, price: 40, review: false, next: null, hold: 0 });
  assert.equal(M.planEdit(live, { name: "  b " }).name, "b");
  const up = M.planEdit(live, { price: 150 });
  assert.equal(up.review, true); assert.equal(up.hold, 50); assert.deepEqual(up.next, { price: 150 }); assert.equal(up.price, undefined);
  const pic = M.planEdit(live, { picture: true });
  assert.equal(pic.review, true); assert.equal(pic.hold, 0);
  const pend = M.clean({ ownerId: "u1", name: "a", price: 100, status: "pending", feeHeld: 100 }, "abcdefgh12");
  const again = M.planEdit(pend, { price: 120 });
  assert.equal(again.review, true); assert.equal(again.hold, 20, "only the difference is held more");
  assert.equal(M.planEdit(pend, { price: 70 }).hold, -30, "a lower price gives some back");
  assert.throws(() => M.planEdit({ ...live, status: "stopped" }, { price: 1 }), /止めて/);
  assert.throws(() => M.planEdit({ ...live, review: "pending" }, { price: 1 }), /確認中/);
  assert.throws(() => M.planEdit(live, { name: " " }), /名前/);
});

test("text design: layers, fonts and colours are kept in range", () => {
  const d = M.cleanDesign({ bg: { color: "javascript:x" }, layers: [
    { text: "  こんにちは\u0000 ", font: "nope", color: "red", size: 999, stroke: { color: "#ABCDEF", width: -4 }, rot: 999, x: 5, y: -2 },
    { text: "" }, { text: "b" }, { text: "c" }, { text: "d" } ] });
  assert.equal(d.layers.length, 3, "at most 3 layers, empty ones dropped");
  assert.deepEqual(d.layers[0], { text: "こんにちは", font: "gothic", color: "#ffffff", size: 96, stroke: { color: "#abcdef", width: 0 }, rot: 180, x: 1, y: 0 });
  assert.equal(d.bg.color, "none");
  assert.deepEqual(M.cleanDesign(null), { v: 1, bg: { color: "none" }, layers: [] });
  assert.equal(M.cleanDesign({ bg: { color: "#00FF00" } }).bg.color, "#00ff00");
  assert.ok(M.FONTS.length >= 5);
});
