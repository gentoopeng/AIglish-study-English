const test = require("node:test"),
  assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs");
function setup(extra = {}) {
  const saved = new Map(),
    ctx = {
      console,
      Date,
      setTimeout,
      clearTimeout,
      localStorage: {
        getItem: (k) => saved.get(k),
        setItem: (k, v) => saved.set(k, v),
      },
      addEventListener() {},
    };
  Object.assign(ctx, extra);
  ctx.window = ctx;
  vm.runInNewContext(fs.readFileSync("cloud-usage.js", "utf8"), ctx);
  return ctx;
}
function sums(ctx) {
  return Object.values(
    Object.values(ctx.CloudUsage.snapshot().days)[0] || {},
  ).reduce(
    (s, row) => ({
      reads: s.reads + row.reads,
      writes: s.writes + row.writes,
      errors: s.errors + row.errors,
    }),
    { reads: 0, writes: 0, errors: 0 },
  );
}
test("device estimates count documents, exclude cache hits, and never write Firestore to report usage", async () => {
  const c = setup();
  let writes = 0;
  c.fbGetDoc = async () => ({ metadata: { fromCache: false } });
  c.fbGetDocs = async () => ({ docs: [{}, {}] });
  c.fbSetDoc = async () => writes++;
  c.CloudUsage.install();
  await c.fbGetDoc({ path: "users/a" });
  await c.fbGetDocs({ path: "studyGroups/a/messages" });
  await c.fbSetDoc({ path: "users/a" });
  c.CloudUsage.flush();
  assert.deepEqual(sums(c), { reads: 3, writes: 1, errors: 0 });
  assert.equal(writes, 1);
  c.fbGetDoc = async () => ({ metadata: { fromCache: true } });
  c.CloudUsage.install();
  await c.fbGetDoc({ path: "users/a" });
  assert.equal(sums(c).reads, 3);
  c.CloudUsage.flush();
});
test("transaction retries count attempted reads but only committed writes", async () => {
  const c = setup();
  const tx = { get: async () => ({}), set() {}, delete() {} };
  c.fbRunTransaction = async (_, fn) => {
    await fn(tx);
    return fn(tx);
  };
  c.CloudUsage.install();
  await c.fbRunTransaction({}, async (tx) => {
    await tx.get({ path: "users/a" });
    tx.set({ path: "users/a" }, {});
  });
  assert.deepEqual(sums(c), { reads: 2, writes: 1, errors: 0 });
  c.CloudUsage.flush();
});
test("failed writes remain failures and instrumentation preserves rejection", async () => {
  const c = setup();
  c.fbSetDoc = async () => {
    throw Error("offline");
  };
  c.CloudUsage.install();
  await assert.rejects(c.fbSetDoc({ path: "users/a" }), /offline/);
  assert.deepEqual(sums(c), { reads: 0, writes: 0, errors: 1 });
  c.CloudUsage.flush();
});
test("listener unsubscribe and callback semantics are preserved", () => {
  const c = setup();
  let callback,
    closed = false,
    delivered = 0;
  c.fbOnSnapshot = (_, next) => {
    callback = next;
    return () => (closed = true);
  };
  c.CloudUsage.install();
  const close = c.fbOnSnapshot(
    { path: "studyGroups/g/messages" },
    () => delivered++,
  );
  callback({
    metadata: { fromCache: false },
    docChanges: () => [{ doc: { metadata: {} } }],
  });
  callback({
    metadata: { fromCache: true },
    docChanges: () => [{ doc: { metadata: {} } }],
  });
  close();
  assert.equal(delivered, 2);
  assert.equal(sums(c).reads, 1);
  assert.equal(closed, true);
  c.CloudUsage.flush();
});

test("REST estimates reuse consumed JSON without cloning a large response", async () => {
  const data = [{ document: { name: "a" } }, { document: { name: "b" } }],
    response = {
      ok: true,
      json: async () => data,
      clone() {
        throw Error("must not clone");
      },
    },
    ctx = setup({ fetch: async () => response });
  const result = await ctx.fetch(
    "https://firestore.googleapis.com/v1/projects/test/databases/(default)/documents:runQuery",
    {
      method: "POST",
      body: JSON.stringify({
        structuredQuery: { from: [{ collectionId: "users" }] },
      }),
    },
  );
  assert.equal(await result.json(), data);
  assert.equal(sums(ctx).reads, 2);
  ctx.CloudUsage.flush();
});
