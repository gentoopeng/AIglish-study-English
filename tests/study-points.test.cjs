const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs"),
  { webcrypto } = require("node:crypto");
// Most tests check settlement with distinct tiers (the pre-10.21.61.00 rates, still valid for
// old records); `even` uses the shipped rates, where every way of answering pays the same.
// A day well in the past and before the study-time rate changed (1pt a minute, until 2026-11-01):
// the tests do not depend on today's date.
const OLD_DAY = Date.parse("2026-10-20T03:00:00Z");
const TIERS = { card: 1, work: 1, quiz: 3, review: 10 };
function setup(remote = new Map(), even = false) {
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
          set: (ref, value, options) =>
            writes.push([ref, JSON.parse(JSON.stringify(value)), options]),
        });
        for (const [k, v, options] of writes)
          remote.set(k, options?.merge ? { ...remote.get(k), ...v } : v);
        return result;
      },
    };
  c.window = c;
  for (const file of [
    "weak-review-model.js",
    "study-point-policy.js",
    "personal-notices.js",
    "study-points.js",
  ])
    vm.runInNewContext(fs.readFileSync(file, "utf8"), c);
  if (!even)
    c.StudyPointPolicy = {
      ...c.StudyPointPolicy,
      rates: TIERS,
      allowed: (source, amount) => Object.hasOwn(TIERS, source) && amount === TIERS[source],
    };
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
test("history survives settlement and a second device can explicitly load it with confirmed points only", async () => {
  const a = setup(),
    date = a.c.WeakReviewModel.day();
  a.remote.set("users/a", { playerName: "keep name" });
  a.points.award("book", "1", date, "a", {
    bookName: "日本史",
    word: "鎌倉幕府",
  });
  assert.equal(Object.values(a.points.read().history)[0].word, "鎌倉幕府");
  await a.points.flush();
  assert.equal(a.remote.get("users/a").studyPoints, 10);
  assert.equal(a.remote.get("users/a").playerName, "keep name");
  const b = setup(a.remote);
  b.c.fbGetDoc = async (ref) => ({
    exists: () => a.remote.has(ref),
    data: () => a.remote.get(ref),
  });
  b.c.fbSetDoc = async (ref, value) =>
    a.remote.set(ref, { ...a.remote.get(ref), ...value });
  await b.points.refresh();
  assert.equal(b.points.balance(), 10);
  assert.equal(Object.values(b.points.read().history)[0].bookName, "日本史");
  b.points.award("book", "2", date);
  assert.equal(b.points.balance(), 20);
  assert.equal(
    a.remote.get("users/a").studyPoints,
    10,
    "pending awards never appear in the public total",
  );
});
test("legacy claims gain dated history without guessing timestamps and merges do not reset earned totals", () => {
  const a = setup(),
    token = JSON.stringify(["2026-10-17", "book", "7"]);
  const restored = a.points.restore({
    balance: 50,
    revision: 5,
    claims: { [token]: true },
  });
  assert.equal(restored.balance, 50);
  assert.equal(restored.history[token].at, 0);
  assert.equal(restored.history[token].day, "2026-10-17");
  a.points.restore({ balance: 10, revision: 1, history: {} });
  assert.equal(a.points.balance(), 50);
  assert.equal(Object.keys(a.points.read().history).length, 1);
});
test("refresh cannot publish an older public total when another device settles points concurrently", async () => {
  const a = setup();
  a.remote.set("users/a/learningPoints/main", { balance: 10, revision: 1 });
  a.c.fbGetDoc = async (ref) => {
    const stale = a.remote.get(ref);
    a.remote.set(ref, { balance: 20, revision: 2 });
    a.remote.set("users/a", { studyPoints: 20 });
    return { exists: () => true, data: () => stale };
  };
  await a.points.refresh();
  assert.equal(a.remote.get("users/a").studyPoints, 20);
  assert.equal(a.points.balance(), 20);
});
test("publishing old confirmed totals never uploads pending answers and settles only once per revision", async () => {
  const a = setup(),
    date = a.c.WeakReviewModel.day();
  a.remote.set("users/a/learningPoints/main", { balance: 50, revision: 5 });
  a.points.restore({ balance: 50, revision: 5 });
  a.points.award("book", "1", date);
  await a.points.publish();
  assert.equal(a.remote.get("users/a").studyPoints, 50);
  assert.equal(a.points.balance(), 60);
  assert.equal(Object.keys(a.points.read().pending).length, 1);
  const run = a.c.fbRunTransaction;
  a.c.fbRunTransaction = async () => {
    throw Error("should not read again");
  };
  assert.equal(await a.points.publish(), true);
  a.c.fbRunTransaction = run;
});
test("a bounded history never drops pending awards or resets the accumulated balance", async () => {
  const a = setup(),
    day = a.c.WeakReviewModel.day();
  for (let num = 1; num <= 105; num++) a.points.award("book", String(num), day);
  assert.equal(Object.keys(a.points.read().history).length, 100);
  assert.equal(Object.keys(a.points.read().pending).length, 105);
  await a.points.flush();
  assert.equal(a.points.balance(), 1050);
  assert.equal(a.remote.get("users/a").studyPoints, 1050);
  assert.equal(Object.keys(a.points.read().pending).length, 0);
});
test("daily content tiers replace each other rather than stack; resets, meanings and sessions do not multiply rewards", async () => {
  const a = setup();
  assert.equal(a.points.reward("card", "book", "1"), 1);
  // A flashcard answer earns every time (a repeat has a token of its own); the others once a day.
  assert.equal(a.points.reward("card", "book", "1"), 1);
  assert.equal(a.points.reward("quiz", "book", "1"), 2);
  assert.equal(a.points.balance(), 4);
  await a.points.flush();
  assert.equal(a.points.reward("review", "book", "1"), 7);
  assert.equal(a.points.reward("quiz", "book", "1"), 0);
  assert.equal(a.points.balance(), 11);
  await a.points.flush();
  assert.equal(a.points.balance(), 11);
  assert.equal(Object.values(a.points.read().history)[0].amount, 10);
  assert.equal(a.points.reward("work", "workbook", "2(1)"), 1);
  assert.equal(a.points.reward("work", "workbook", "2(2)"), 1);
  await a.points.flush();
  assert.equal(a.points.balance(), 13);
});
test("mixed-source offline awards, backup restore and remote higher tiers settle only their differences", async () => {
  const a = setup();
  a.points.reward("card", "book", "1");
  await a.points.flush();
  const before = a.points.read();
  a.points.reward("quiz", "book", "1");
  const backup = a.points.read();
  assert.equal(a.points.pendingAmount(backup), 2);
  const b = setup(a.remote);
  b.points.reward("review", "book", "1");
  await b.points.flush();
  a.points.restore(before);
  a.points.restore(backup);
  await a.points.flush();
  assert.equal(a.points.balance(), 10);
  assert.equal(a.remote.get("users/a/learningPoints/main").balance, 10);
  assert.equal(Object.values(a.points.read().history)[0].source, "review");
});
test("legacy boolean claims and numeric receipt values stay worth ten when lower tiers arrive", async () => {
  const a = setup(),
    day = a.c.WeakReviewModel.day();
  a.points.award("book", "1", day);
  await a.points.flush();
  const shard = [...a.remote.keys()].find((k) =>
    k.includes("reviewPointDays/"),
  );
  a.remote.get(shard).claims["1"] = 10;
  const b = setup(a.remote);
  b.points.reward("card", "book", "1");
  await b.points.flush();
  assert.equal(b.points.balance(), 10);
  assert.equal(Object.values(b.points.read().history)[0].amount, 10);
  assert.equal(Object.values(b.points.read().history)[0].source, "review");
});
test("an upgrade earned while a lower-tier transaction is in flight remains pending and is settled", async () => {
  const a = setup(),
    run = a.c.fbRunTransaction;
  a.points.reward("card", "book", "1");
  let once = false;
  a.c.fbRunTransaction = async (...args) => {
    const result = await run(...args);
    if (!once) {
      once = true;
      a.points.reward("quiz", "book", "1");
    }
    return result;
  };
  await a.points.flush();
  assert.equal(a.points.balance(), 3);
  assert.equal(a.remote.get("users/a/learningPoints/main").balance, 3);
  assert.equal(Object.keys(a.points.read().pending).length, 0);
});
test("measured time waits until after midnight rollback, ignores old/manual totals, and merges simultaneous devices conservatively", async () => {
  const a = setup(),
    p = a.c.StudyPointPolicy,
    day = p.day(OLD_DAY),
    start = p.dayStart(day),
    days = {};
  for (let i = 0; i < 600; i++)
    p.accrueTime(days, "phone", start + i * 1000, start + (i + 1) * 1000);
  // Sleep removes the last five measured minutes, even if a manual edit says ten hours.
  for (let i = 300; i < 600; i++)
    p.accrueTime(days, "phone", start + i * 1000, start + (i + 1) * 1000, true);
  days[day].edit = { ms: 36000000, at: Date.now() };
  a.c.StudyTime = {
    snapshot: () => ({
      days: {
        ...days,
        "2001-01-01": { sources: { legacy: 999999 }, edit: { ms: 999999 } },
      },
    }),
  };
  await a.points.collectTime();
  assert.equal(a.points.balance(), 5);
  await a.points.flush();
  assert.equal(a.points.balance(), 5);
  const b = setup(a.remote),
    other = {};
  for (let i = 0; i < 300; i++)
    b.c.StudyPointPolicy.accrueTime(
      other,
      "tablet",
      start + i * 1000,
      start + (i + 1) * 1000,
    );
  b.c.StudyTime = { snapshot: () => ({ days: other }) };
  await b.points.flush();
  assert.equal(
    b.points.balance(),
    5,
    "parallel time in the same slot is not added twice",
  );
  for (let i = 600; i < 720; i++)
    b.c.StudyPointPolicy.accrueTime(
      other,
      "tablet",
      start + i * 1000,
      start + (i + 1) * 1000,
    );
  await b.points.flush();
  assert.equal(
    b.points.balance(),
    7,
    "later non-overlapping slots still earn points",
  );
  assert.equal(
    Object.values(b.remote.get("users/a/learningPoints/main").history).some(
      (entry) => Object.hasOwn(entry, "time"),
    ),
    false,
    "wallet history does not duplicate raw device measurements",
  );
  const today = p.day(),
    live = {};
  for (let i = 0; i < 120; i++)
    p.accrueTime(
      live,
      "phone",
      p.dayStart(today) + i * 1000,
      p.dayStart(today) + (i + 1) * 1000,
    );
  a.c.StudyTime = { snapshot: () => ({ days: live }) };
  await a.points.collectTime();
  assert.equal(
    a.points.balance(),
    5,
    "today is never paid before sleep corrections",
  );
});
test("a missing confirmed wallet never resets an existing balance during a new activity settlement", async () => {
  const a = setup();
  a.points.restore({ balance: 100, revision: 3, publishedRevision: 3 });
  a.points.reward("quiz", "book", "1");
  assert.equal(await a.points.flush(), false);
  assert.equal(a.points.balance(), 103);
  assert.equal(Object.keys(a.points.read().pending).length, 1);
  assert.equal(a.remote.has("users/a/learningPoints/main"), false);
});
test("a lost response during a tier upgrade can be retried without duplicate credit", async () => {
  const a = setup(),
    run = a.c.fbRunTransaction;
  a.points.reward("card", "book", "1");
  await a.points.flush();
  a.points.reward("review", "book", "1");
  a.c.fbRunTransaction = async (...args) => {
    await run(...args);
    throw Error("lost ack");
  };
  assert.equal(await a.points.flush(), false);
  assert.equal(a.points.balance(), 10);
  a.c.fbRunTransaction = run;
  await a.points.flush();
  assert.equal(a.points.balance(), 10);
  assert.equal(a.remote.get("users/a/learningPoints/main").balance, 10);
});
test("time data is retained through a failed save and backup restoration, without reissuing settled points", async () => {
  const a = setup(),
    p = a.c.StudyPointPolicy,
    day = p.day(OLD_DAY),
    days = {},
    start = p.dayStart(day);
  for (let i = 0; i < 125; i++)
    p.accrueTime(days, "phone", start + i * 1000, start + (i + 1) * 1000);
  a.c.StudyTime = { snapshot: () => ({ days }) };
  await a.points.collectTime();
  const backup = a.points.read(),
    run = a.c.fbRunTransaction;
  a.c.fbRunTransaction = async () => {
    throw Error("quota");
  };
  assert.equal(await a.points.flush(), false);
  assert.equal(a.points.balance(), 2);
  a.c.fbRunTransaction = run;
  await a.points.flush();
  a.points.restore(backup);
  await a.points.flush();
  assert.equal(a.points.balance(), 2);
  assert.equal(Object.keys(a.points.read().pending).length, 0);
});
test("a smaller local time total still contributes new slots after a larger remote total was acknowledged", async () => {
  const a = setup(),
    p = a.c.StudyPointPolicy,
    day = p.day(OLD_DAY),
    days = {},
    start = p.dayStart(day);
  for (let i = 0; i < 600; i++)
    p.accrueTime(days, "phone", start + i * 1000, start + (i + 1) * 1000);
  a.c.StudyTime = { snapshot: () => ({ days }) };
  await a.points.flush();
  const b = setup(a.remote),
    other = {};
  b.c.fbGetDoc = async (ref) => ({
    exists: () => a.remote.has(ref),
    data: () => a.remote.get(ref),
  });
  await b.points.refresh();
  assert.equal(b.points.balance(), 10);
  for (let i = 600; i < 720; i++)
    p.accrueTime(other, "tablet", start + i * 1000, start + (i + 1) * 1000);
  b.c.StudyTime = { snapshot: () => ({ days: other }) };
  await b.points.collectTime();
  assert.equal(
    Object.keys(b.points.read().pending).length,
    1,
    "time must be compared by measurements, not suppressed by its smaller displayed amount",
  );
  await b.points.flush();
  assert.equal(b.points.balance(), 12);
});
test("a stale lower cloud wallet cannot erase confirmed local earnings or acknowledge a new unpaid reward", async () => {
  const a = setup();
  a.points.restore({ balance: 100, revision: 3, publishedRevision: 3 });
  a.remote.set("users/a/learningPoints/main", { balance: 20, revision: 1 });
  a.points.reward("card", "book", "1");
  assert.equal(await a.points.flush(), false);
  assert.equal(a.points.balance(), 101);
  assert.equal(Object.keys(a.points.read().pending).length, 1);
  assert.equal(a.remote.get("users/a/learningPoints/main").balance, 20);
});
test("loading or deleted material cannot earn activity rewards before learning data is ready", () => {
  const a = setup();
  a.c.__learningBootReady = false;
  assert.throws(() => a.points.reward("card", "book", "1"));
  a.c.__learningBootReady = true;
  a.c.LearningData = { canSave: () => false };
  assert.throws(() => a.points.reward("quiz", "book", "1"));
  a.c.LearningData.canSave = () => true;
  a.c.LibraryState = { isDeleted: () => true };
  assert.throws(() => a.points.reward("review", "book", "1"));
  assert.throws(() => a.points.reward("work", "workbook", "1"));
  assert.equal(a.points.balance(), 0);
});
test("simultaneous devices retry conflicting tier settlements without losing or multiplying credit", async () => {
  const remote = new Map(),
    a = setup(remote),
    b = setup(remote);
  let conflicts = 0,
    arrivals = 0,
    release;
  const bothReading = new Promise((resolve) => {
    release = resolve;
  });
  const transaction = async (_, fn) => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const reads = new Map(),
        writes = [];
      const result = await fn({
        get: async (ref) => {
          const value = remote.get(ref);
          reads.set(ref, JSON.stringify(value));
          if (attempt === 0 && ref.endsWith("/learningPoints/main")) {
            if (++arrivals === 2) release();
            await bothReading;
          }
          await Promise.resolve();
          return { exists: () => value !== undefined, data: () => value };
        },
        set: (ref, value, options) =>
          writes.push({
            ref,
            value: JSON.parse(JSON.stringify(value)),
            options,
          }),
      });
      if (
        [...reads].some(
          ([ref, value]) => JSON.stringify(remote.get(ref)) !== value,
        )
      ) {
        conflicts++;
        continue;
      }
      for (const { ref, value, options } of writes)
        remote.set(
          ref,
          options?.merge ? { ...remote.get(ref), ...value } : value,
        );
      return result;
    }
    throw Error("retry limit");
  };
  a.c.fbRunTransaction = transaction;
  b.c.fbRunTransaction = transaction;
  a.points.reward("card", "book", "1");
  b.points.reward("review", "book", "1");
  await Promise.all([a.points.flush(), b.points.flush()]);
  assert.equal(remote.get("users/a/learningPoints/main").balance, 10);
  assert.ok(
    conflicts > 0,
    "the test must actually exercise a conflicting transaction",
  );
  for (const client of [a, b]) {
    client.c.fbGetDoc = async (ref) => ({
      exists: () => remote.has(ref),
      data: () => remote.get(ref),
    });
    await client.points.refresh();
    assert.equal(client.points.balance(), 10);
  }
});

test("every way of answering a word pays the same 2 points once a day; records at the old rates still settle", async () => {
  const a = setup(new Map(), true);
  for (const source of ["card", "quiz", "review"]) assert.equal(a.points.reward(source, "book", "1"), source === "card" ? 2 : 0);
  assert.equal(a.points.reward("review", "book", "2"), 2);
  assert.equal(a.points.reward("work", "workbook", "3"), 2);
  assert.equal(a.points.balance(), 6);
  await a.points.flush();
  assert.equal(a.points.balance(), 6);
  // A review answered before the update, still waiting to sync at its old amount.
  const day = a.c.WeakReviewModel.day(),
    value = a.points.read(),
    token = JSON.stringify([day, "book", "9"]);
  value.pending[token] = { source: "review", book: "book", num: "9", day, amount: 10, at: Date.now() };
  a.values.set("core_v4_study_points_a", JSON.stringify(value));
  await a.points.flush();
  assert.equal(a.points.balance(), 16);
  assert.equal(Object.keys(a.points.read().pending).length, 0);
  // Amounts no rate ever paid are refused.
  assert.equal(a.c.StudyPointPolicy.allowed("review", 7), false);
});
test("total earned: past awards added up once from the day records, then grown with each award; poker keys kept", async () => {
  const remote = new Map([
    ["users/a/learningPoints/main", { balance: 50, revision: 3, poker: { "casino:x:pay": 1 }, casinoStats: { blackjack: { b: 60, n: -60, p: 1 } } }],
    ["users/a/reviewPointDays/d1", { claims: { 1: { amount: 10, source: "review" }, 2: 3 } }],
    ["users/a/reviewPointDays/d2", { claims: { 7: 10 } }],
  ]);
  const a = setup(remote),
    date = a.c.WeakReviewModel.day();
  let reads = 0;
  a.c.fbCollection = (_, ...parts) => parts.join("/");
  a.c.fbGetDocs = async (path) => {
    reads++;
    return { docs: [...remote].filter(([k]) => k.startsWith(path + "/")).map(([, v]) => ({ data: () => v })) };
  };
  assert.equal(a.points.earned(), null);
  a.points.award("book", "1", date);
  await a.points.flush();
  // 23 before (10 + 3 + 10), then this award's 10. Spending never lowers it.
  assert.equal(remote.get("users/a/learningPoints/main").earned, 33);
  assert.equal(remote.get("users/a").earnedPoints, 33);
  assert.equal(a.points.earned(), 33);
  assert.deepEqual(remote.get("users/a/learningPoints/main").poker, { "casino:x:pay": 1 });
  // The casino's lifetime totals are kept by the same full write.
  assert.deepEqual(remote.get("users/a/learningPoints/main").casinoStats, { blackjack: { b: 60, n: -60, p: 1 } });
  // Counted once: a later award adds only itself, with no second read of the records.
  a.points.award("book", "2", date);
  await a.points.flush();
  assert.equal(remote.get("users/a/learningPoints/main").earned, 43);
  assert.equal(reads, 1);
  // Another device that has not counted yet takes the cloud's total instead of counting again.
  const b = setup(remote);
  b.c.fbCollection = a.c.fbCollection;
  b.c.fbGetDocs = a.c.fbGetDocs;
  b.c.fbGetDoc = async (ref) => ({ exists: () => remote.has(ref), data: () => remote.get(ref) });
  await b.points.flush();
  assert.equal(b.points.earned(), 43);
  assert.equal(reads, 1);
});

test("points history per day: every credited award is kept by day and kind, once, past days filled once from the day records", async () => {
  const remote = new Map([
    ["users/a/learningPoints/main", { balance: 0, revision: 1 }],
    // Two past days in the award records (one of them study time, 30 minutes at 5pt).
    ["users/a/reviewPointDays/r1", { day: "2026-10-01", book: "book", claims: { 1: { amount: 2, source: "card" }, 2: { amount: 2, source: "card" } } }],
    ["users/a/reviewPointDays/r2", { day: "2026-10-02", book: "@study-time", claims: { minutes: { amount: 150, source: "time" } } }],
  ]);
  const a = setup(remote, true),
    date = a.c.WeakReviewModel.day();
  let reads = 0;
  a.c.fbCollection = (_, ...parts) => parts.join("/");
  a.c.fbGetDocs = async (path) => {
    reads++;
    return { docs: [...remote].filter(([k]) => k.startsWith(path + "/")).map(([, v]) => ({ data: () => v })) };
  };
  a.points.reward("card", "book", "1", "a", { bookName: "本", word: "one" });
  a.points.reward("card", "book", "2", "a", { bookName: "本", word: "two" });
  a.points.reward("card", "book", "2", "a", { bookName: "本", word: "two" });
  await a.points.flush();
  const wallet = remote.get("users/a/learningPoints/main");
  // Today: three answers (word 2 twice: a flashcard answer earns each time), 6pt, each credited once.
  assert.deepEqual(wallet.daily[date], { card: { n: 3, p: 6 } });
  // The past days, added up from the records in the same sync (one read for both fills).
  assert.deepEqual(wallet.daily["2026-10-01"], { card: { n: 2, p: 4 } });
  assert.deepEqual(wallet.daily["2026-10-02"].time.p, 150);
  assert.equal(wallet.dailyFilled, true);
  assert.equal(reads, 1);
  assert.equal(JSON.stringify(a.points.daily()[0]), JSON.stringify([date, { card: { n: 3, p: 6 } }]));
  // A second sync adds nothing twice and reads nothing again.
  await a.points.flush();
  assert.deepEqual(remote.get("users/a/learningPoints/main").daily[date], { card: { n: 3, p: 6 } });
  assert.equal(reads, 1);
  // Another device takes the filled record from the cloud.
  const b = setup(remote, true);
  b.c.fbCollection = a.c.fbCollection;
  b.c.fbGetDocs = a.c.fbGetDocs;
  b.c.fbGetDoc = async (ref) => ({ exists: () => remote.has(ref), data: () => remote.get(ref) });
  await b.points.flush();
  assert.equal(reads, 1);
  assert.equal(JSON.stringify(b.points.daily().map(([day]) => day).slice(-2)), JSON.stringify(["2026-10-02", "2026-10-01"]));
  // The record keeps up to 400 days, the newest.
  let many = {};
  for (let i = 0; i < 420; i++) many = a.c.StudyPointPolicy.addDaily(many, new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10), "card", 2);
  assert.equal(Object.keys(many).length, 400);
});

test("a day's study time that is counted puts one notice in the お知らせボックス, with the new total if it is counted again", async () => {
  const a = setup(),
    p = a.c.StudyPointPolicy,
    day = p.day(OLD_DAY),
    start = p.dayStart(day),
    days = {};
  a.c.StudyTime = { snapshot: () => ({ days }) };
  for (let i = 0; i < 600; i++) p.accrueTime(days, "phone", start + i * 1000, start + (i + 1) * 1000);
  await a.points.collectTime();
  let notices = a.c.PersonalNotices.list("a");
  assert.equal(notices.length, 1);
  assert.equal(notices[0].id, "time:" + day);
  assert.equal(notices[0].amount, 10);
  const [, month, date] = day.split("-").map(Number);
  assert.equal(notices[0].title, month + "月" + date + "日の勉強時間 合計 10pt");
  assert.match(notices[0].body, /10分（1分1pt）。所持ポイントに加わりました。/);
  assert.equal(a.c.PersonalNotices.unread("a"), 1);
  // Counted again with nothing new: no second notice. With more minutes: the same notice, new total.
  await a.points.collectTime();
  assert.equal(a.c.PersonalNotices.list("a").length, 1);
  for (let i = 600; i < 900; i++) p.accrueTime(days, "phone", start + i * 1000, start + (i + 1) * 1000);
  await a.points.collectTime();
  notices = a.c.PersonalNotices.list("a");
  assert.equal(notices.length, 1);
  assert.equal(notices[0].amount, 15);
  // The title is still the day's total; the body says what this time added.
  assert.equal(notices[0].title, month + "月" + date + "日の勉強時間 合計 15pt");
  assert.match(notices[0].body, /15分（1分1pt）。あとから \+5pt 加わりました。/);
  // "Counted again" follows the credit, not the notices kept on this device: with the first notice
  // gone (cleared, or another device counted it) the notice still says what was added.
  a.c.localStorage.setItem("aiglish_personal_notices_a", "[]");
  for (let i = 900; i < 1200; i++) p.accrueTime(days, "phone", start + i * 1000, start + (i + 1) * 1000);
  await a.points.collectTime();
  notices = a.c.PersonalNotices.list("a");
  assert.equal(notices.length, 1);
  assert.equal(notices[0].amount, 20);
  assert.match(notices[0].body, /20分（1分1pt）。あとから \+5pt 加わりました。/);
  // Another account's notices are its own.
  assert.equal(a.c.PersonalNotices.list("b").length, 0);
});
test("a flashcard answer earns every time, up to 10 for one word a day; two devices claim separate tokens; past repeats are dropped", async () => {
  const remote = new Map(),
    a = setup(remote, true),
    b = setup(remote, true);
  a.values.set("aiglish_study_device", "aaaaaa-1");
  b.values.set("aiglish_study_device", "bbbbbb-2");
  const date = a.c.WeakReviewModel.day();
  // Ten paid answers of one word, then nothing more that day.
  const paid = [];
  for (let i = 0; i < 12; i++) paid.push(a.points.reward("card", "book", "7", "a", { word: "seven" }));
  assert.deepEqual(paid, [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0]);
  assert.equal(a.points.balance(), 20);
  // The first answer keeps the plain token; repeats carry the device and a count.
  const tokens = Object.keys(a.points.read().claims).map((t) => JSON.parse(t)[2]).sort();
  assert.equal(tokens.length, 10);
  assert.ok(tokens.includes("7") && tokens.includes("7#aaaaaa-2") && tokens.includes("7#aaaaaa-10"));
  // A word the battle already paid today still earns on a card (as a repeat, with a token of its own),
  // and a card answered first still blocks a battle that day.
  assert.equal(a.points.reward("quiz", "book", "8"), 2);
  assert.equal(a.points.reward("card", "book", "8"), 2);
  assert.equal(a.points.reward("card", "book", "8"), 2);
  assert.equal(a.points.reward("card", "book", "11"), 2);
  assert.equal(a.points.reward("quiz", "book", "11"), 0);
  // Two devices that both answered word 9 offline: both are credited, neither twice.
  a.points.reward("card", "book", "9");
  a.points.reward("card", "book", "9");
  b.points.reward("card", "book", "9");
  b.points.reward("card", "book", "9");
  await a.points.flush();
  await b.points.flush();
  const shards = [...remote].filter(([k]) => k.startsWith("users/a/reviewPointDays/"));
  const nine = shards.flatMap(([, v]) => Object.keys(v.claims || {})).filter((k) => k.startsWith("9"));
  assert.deepEqual(nine.sort(), ["9", "9#aaaaaa-2", "9#bbbbbb-2"]);
  // A repeat of a past day is dropped locally at the next award (the cloud keeps it).
  const yesterday = a.c.WeakReviewModel.day(Date.now() - 86400000),
    repeat = JSON.stringify([yesterday, "book", "7#aaaaaa-2"]),
    plain = JSON.stringify([yesterday, "book", "7"]),
    state = a.points.read();
  state.claims[repeat] = 2;
  state.settled[repeat] = 2;
  state.claims[plain] = 2;
  state.settled[plain] = 2;
  a.values.set(a.points.key("a"), JSON.stringify(state));
  a.points.reward("card", "book", "10");
  const after = a.points.read();
  assert.equal(after.claims[repeat], undefined);
  assert.equal(after.settled[repeat], undefined);
  assert.equal(after.claims[plain], 2, "a plain token stays for its 8 days");
  assert.ok(date);
});
