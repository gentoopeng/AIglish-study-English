const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  m = require("../login-identity.js");
test("lower-case, auto-capitalised and full-width IDs resolve to the issued upper-case ID", () => {
  assert.deepEqual(m.idCandidates("abcdefg123"), ["abcdefg123", "ABCDEFG123"]);
  assert.deepEqual(m.idCandidates("Abcdefg123"), ["Abcdefg123", "ABCDEFG123"]);
  assert.deepEqual(m.idCandidates("ＡＢＣＤＥＦＧ１２３"), ["ABCDEFG123"]);
  assert.deepEqual(m.idCandidates(" ABC DEFG123 "), ["ABCDEFG123"]);
  assert.deepEqual(m.idCandidates(""), []);
  assert.deepEqual(m.idCandidates("A/B"), []);
});
test("PINs fold full-width digits and compare as strings; blank stored PINs never match", () => {
  const ids = m.idCandidates("abcdefg123");
  assert.equal(m.pin("１２３４"), "1234");
  assert.ok(m.matches({ id: "ABCDEFG123", pin: "1234" }, ids, "1234"));
  assert.ok(m.matches({ id: "ABCDEFG123", pin: 1234 }, ids, "1234"));
  assert.ok(!m.matches({ id: "ABCDEFG123", pin: "1234" }, ids, "1235"));
  assert.ok(!m.matches({ id: "ABCDEFG123", pin: "" }, ids, ""));
  assert.ok(!m.matches({ id: "ABCDEFG123" }, ids, "undefined"));
  assert.deepEqual(
    m.find([null, { id: "OTHER00001", pin: "1234" }, { id: "ABCDEFG123", pin: "1234" }], ids, "1234"),
    { id: "ABCDEFG123", pin: "1234" },
  );
});
test("unavailable reasons separate quota and timeouts from other connection failures", () => {
  assert.equal(m.unavailableReason({ code: "resource-exhausted" }), "quota");
  assert.equal(m.unavailableReason(Error("login timeout")), "timeout");
  assert.equal(m.unavailableReason({ code: "unavailable", message: "client is offline" }), "network");
});

test("PIN digests: never the digits, salted by account, verified for digests and legacy digits", async () => {
  const d = await m.digest("ABCDEFG123", "1234");
  assert.ok(m.isDigest(d));
  assert.ok(!d.includes("1234"));
  assert.notEqual(d, await m.digest("OTHER00001", "1234"));
  assert.equal(await m.protect("ABCDEFG123", "1234"), d);
  assert.equal(await m.protect("ABCDEFG123", d), d);
  assert.equal(await m.protect("ABCDEFG123", ""), "");
  const ids = ["ABCDEFG123"];
  assert.equal(await m.verify({ id: "ABCDEFG123", pin: d }, ids, "1234"), true);
  assert.equal(await m.verify({ id: "ABCDEFG123", pin: d }, ids, "1235"), false);
  assert.equal(await m.verify({ id: "ABCDEFG123", pin: "1234" }, ids, "1234"), true);
  assert.equal(await m.verify({ id: "ABCDEFG123", pin: "" }, ids, ""), false);
  assert.equal((await m.findVerified([{ id: "OTHER00001", pin: d }, { id: "ABCDEFG123", pin: d }], ids, "1234")).id, "ABCDEFG123");
  assert.deepEqual(m.publicEntry({ id: "A", pin: d, playerName: "n", realName: "山田", age: "15" }), { id: "A", pin: d, playerName: "n" });
});
