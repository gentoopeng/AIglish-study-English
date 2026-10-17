const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  m = require("../group-chat-policy.js");
test("retain only the ten newest messages and exclude messages at least seven days old", () => {
  const now = Date.now(),
    rows = Array.from({ length: 25 }, (_, i) => ({
      id: String(i),
      sentAt: now - i * 1000,
    }));
  rows.push({ id: "expired", sentAt: now - m.lifetime });
  const kept = m.retained(rows, now);
  assert.equal(kept.length, 10);
  assert.deepEqual(
    kept.map((item) => item.id),
    Array.from({ length: 10 }, (_, i) => String(i)),
  );
  assert.equal(rows.length, 26);
});
test("server creation time controls expiry; expiry is exact and invalid timestamps never remain", () => {
  const now = Date.now(),
    item = {
      id: "a",
      sentAt: now,
      createdAt: { toMillis: () => now - m.lifetime },
    };
  assert.equal(m.retained([item], now).length, 0);
  assert.equal(
    m.retained([{ id: "b", sentAt: now - m.lifetime + 1 }], now).length,
    1,
  );
  assert.equal(m.retained([{ id: "bad", sentAt: NaN }], now).length, 0);
});
