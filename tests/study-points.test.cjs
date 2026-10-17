const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs"),
  { webcrypto } = require("node:crypto");
function setup(remote = new Map()) {
  const values = new Map(),
    c = {
      myId: "a",
      Date,
      TextEncoder,
      crypto: webcrypto,
      console: { warn() {} },
      localStorage: {
        getItem: (k) => values.get(k) || null,
        setItem: (k, v) => values.set(k, v),
      },
      db: {},
      fbDoc: (_, ...parts) => parts.join("/"),
      fbRunTransaction: async (_, fn) => {
        const writes = [];
        const result = await fn({
          get: async (ref) => ({
            exists: () => remote.has(ref),
            data: () => remote.get(ref),
          }),
          set: (ref, value) =>
            writes.push([ref, JSON.parse(JSON.stringify(value))]),
        });
        for (const [k, v] of writes) remote.set(k, v);
        return result;
      },
    };
  c.window = c;
  for (const file of ["weak-review-model.js", "study-points.js"])
    vm.runInNewContext(fs.readFileSync(file, "utf8"), c);
  return { c, values, points: c.StudyPoints, remote };
}
test("word/day claims deduplicate meanings, retries and two devices; next day has a separate receipt", async () => {
  const a = setup(),
    date = a.c.WeakReviewModel.day();
  assert.equal(a.points.award("book", "1", date), 10);
  assert.equal(a.points.award("book", "1", date), 0);
  assert.equal(a.points.balance(), 10);
  assert.equal(await a.points.flush(), true);
  assert.equal(a.points.balance(), 10);
  assert.equal(await a.points.flush(), true);
  const b = setup(a.remote);
  assert.equal(b.points.award("book", "1", date), 10);
  await b.points.flush();
  assert.equal(b.points.balance(), 10);
  b.points.award("book", "2", date);
  await b.points.flush();
  assert.equal(b.points.balance(), 20);
  assert.equal(a.remote.get("users/a/learningPoints/main").balance, 20);
});
test("quota and transaction failures keep pending claims; later retries settle once", async () => {
  const a = setup(),
    run = a.c.fbRunTransaction,
    date = a.c.WeakReviewModel.day();
  a.points.award("book", "1", date);
  a.c.fbRunTransaction = async () => {
    throw Error("quota");
  };
  assert.equal(await a.points.flush(), false);
  assert.equal(a.points.balance(), 10);
  assert.equal(Object.keys(a.points.read().pending).length, 1);
  a.c.fbRunTransaction = run;
  await a.points.flush();
  assert.equal(a.points.balance(), 10);
  assert.equal(Object.keys(a.points.read().pending).length, 0);
});
test("restore unions intents without adding balances and account changes cannot settle another account", async () => {
  const a = setup(),
    date = a.c.WeakReviewModel.day();
  a.points.award("book", "1", date);
  const old = a.points.read();
  await a.points.flush();
  const merged = a.points.merge(a.points.read(), old);
  assert.equal(merged.balance, 10);
  assert.equal(Object.keys(merged.pending).length, 0);
  a.values.set(a.points.key("a"), JSON.stringify(merged));
  await a.points.flush();
  assert.equal(a.points.balance(), 10);
  a.c.myId = "b";
  assert.throws(() => a.points.award("book", "1", date, "a"));
  assert.equal(await a.points.flush("a"), false);
});
test("guest awards stay local; corrupt records are never overwritten", async () => {
  const a = setup();
  a.c.myId = "GUEST-000";
  a.points.award("book", "1", a.c.WeakReviewModel.day());
  assert.equal(a.points.balance(), 10);
  await a.points.flush();
  assert.equal(a.remote.size, 0);
  a.values.set(a.points.key("GUEST-000"), "bad json");
  assert.throws(() => a.points.award("book", "2", a.c.WeakReviewModel.day()));
  assert.equal(a.values.get(a.points.key("GUEST-000")), "bad json");
});
test("a committed server award with a lost response is safely replayed and corrupt wallet data is protected", async () => {
  const a = setup(),
    run = a.c.fbRunTransaction,
    date = a.c.WeakReviewModel.day();
  a.points.award("book", "1", date);
  a.c.fbRunTransaction = async (...args) => {
    await run(...args);
    throw Error("connection lost after commit");
  };
  await a.points.flush();
  assert.equal(Object.keys(a.points.read().pending).length, 1);
  assert.equal(a.remote.get("users/a/learningPoints/main").balance, 10);
  a.c.fbRunTransaction = run;
  await a.points.flush();
  assert.equal(a.points.balance(), 10);
  a.remote.set("users/a/learningPoints/main", {
    balance: "corrupt",
    revision: 1,
  });
  a.points.award("book", "2", date);
  assert.equal(await a.points.flush(), false);
  assert.equal(a.remote.get("users/a/learningPoints/main").balance, "corrupt");
  assert.equal(Object.keys(a.points.read().pending).length, 1);
});
test("a normal twenty-word session reads only the wallet and one numbered-book receipt shard", async () => {
  const a = setup(),
    run = a.c.fbRunTransaction,
    date = a.c.WeakReviewModel.day();
  let reads = 0;
  a.c.fbRunTransaction = (_, fn) =>
    run(_, (tx) =>
      fn({
        ...tx,
        get: (ref) => {
          reads++;
          return tx.get(ref);
        },
      }),
    );
  for (let num = 1; num <= 20; num++) a.points.award("book", String(num), date);
  await a.points.flush();
  assert.equal(a.points.balance(), 200);
  assert.equal(reads, 2);
});
