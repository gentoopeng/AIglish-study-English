const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs");
function setup() {
  const events = {},
    values = new Map(),
    tabs = [],
    timers = [],
    calls = [];
  const ctx = {
    myId: "a",
    currentTextbook: "book",
    currentActiveTabId: "vocab",
    console: { warn: () => {} },
    setTimeout: () => timers.push("timeout"),
    setInterval: () => timers.push("interval"),
    document: {
      body: { classList: { contains: () => false } },
      addEventListener: (name, fn) => (events[name] = fn),
    },
    addEventListener: (name, fn) => (events[name] = fn),
    onTabChange: (fn) => tabs.push(fn),
    localStorage: {
      getItem: (k) => values.get(k) || null,
      setItem: (k, v) => values.set(k, v),
      removeItem: (k) => values.delete(k),
    },
    AppStorage: { flush: async () => calls.push("local") },
    __backgroundSaveAll: async () => {
      calls.push("cloud");
      return { cloudSaved: true };
    },
  };
  ctx.window = ctx;
  vm.runInNewContext(fs.readFileSync("autosave.js", "utf8"), ctx);
  return { ctx, values, events, tabs, timers, calls };
}
test("edits and 100 flash swipes create a durable pending marker but no save timers or cloud work", async () => {
  const { ctx, values, timers, calls } = setup();
  for (let i = 0; i < 100; i++) {
    ctx.noteFlashSwipe();
    ctx.queueBackgroundSave();
    ctx.resumeBackgroundSave();
  }
  await Promise.resolve();
  assert.deepEqual(timers, []);
  assert.deepEqual(calls, []);
  assert.equal(values.get("core_v4_autosave_pending_a"), "1");
});
test("search, passwords and administrator edits do not mark personal learning dirty", () => {
  const { values, events } = setup();
  for (const target of [
    { type: "password" },
    { type: "search" },
    { id: "vocabSearchInput" },
    { closest: () => true },
  ])
    events.input({ target });
  assert.equal(values.size, 0);
  events.change({ target: { id: "note", closest: () => false } });
  assert.equal(values.size, 1);
});
test("flash completion coalesces simultaneous end events and clears pending only on cloud success", async () => {
  const { ctx, values, calls } = setup();
  ctx.noteFlashSwipe();
  const one = ctx.flushFlashAutosave(),
    two = ctx.saveAfterStudy("end");
  assert.equal(one, two);
  await one;
  assert.deepEqual(calls, ["local", "cloud"]);
  assert.equal(values.size, 0);
});
test("a failed boundary leaves the journal until the next explicit completion", async () => {
  const { ctx, values, calls, timers } = setup();
  ctx.__backgroundSaveAll = async () => {
    calls.push("cloud");
    return { cloudSaved: false };
  };
  ctx.queueBackgroundSave();
  await ctx.saveAfterStudy();
  assert.equal(values.get("core_v4_autosave_pending_a"), "1");
  ctx.resumeBackgroundSave();
  assert.deepEqual(timers, []);
  ctx.__backgroundSaveAll = async () => ({ cloudSaved: true });
  await ctx.saveAfterStudy();
  assert.equal(values.size, 0);
});
test("new edits during a pending end save are retained for the next boundary", async () => {
  const { ctx, values } = setup();
  let release;
  ctx.__backgroundSaveAll = () => new Promise((resolve) => (release = resolve));
  ctx.queueBackgroundSave();
  const job = ctx.saveAfterStudy();
  await new Promise(setImmediate);
  ctx.queueBackgroundSave();
  release({ cloudSaved: true });
  await job;
  assert.equal(values.get("core_v4_autosave_pending_a"), "1");
});
test("quota and loading stop cloud saves without dropping the local pending record", async () => {
  const { ctx, values, calls } = setup();
  ctx.FirestoreReadGuard = { paused: () => true };
  await ctx.saveAfterStudy();
  assert.deepEqual(calls, ["local"]);
  assert.equal(values.size, 1);
  ctx.FirestoreReadGuard.paused = () => false;
  ctx.LearningData = { canSave: () => false };
  await ctx.saveAfterStudy();
  assert.equal(calls.includes("cloud"), false);
  ctx.LearningData.canSave = () => true;
  await ctx.saveAfterStudy();
  assert.equal(calls.includes("cloud"), true);
  assert.equal(values.size, 0);
});
test("a boundary cannot start a cloud save during active play; sleep may explicitly save", async () => {
  const { ctx, calls } = setup();
  ctx.document.body.classList.contains = () => true;
  assert.equal((await ctx.saveAfterStudy()).deferred, true);
  assert.deepEqual(calls, []);
  await ctx.saveAfterStudy("sleep");
  assert.deepEqual(calls, ["local", "cloud"]);
});
test("navigation completion saves once while ordinary input and focus do not", async () => {
  const { ctx, events, tabs, calls } = setup();
  ctx.queueBackgroundSave();
  tabs[0]("community");
  await new Promise(setImmediate);
  assert.equal(calls.filter((c) => c === "cloud").length, 1);
  assert.equal(events.focusout, undefined);
  assert.equal(events.online, undefined);
  assert.equal(events.visibilitychange, undefined);
});
test("guest and account switch never upload another account data", async () => {
  const { ctx, calls } = setup();
  ctx.queueBackgroundSave();
  const job = ctx.saveAfterStudy();
  ctx.myId = "b";
  await job;
  assert.equal(calls.includes("cloud"), false);
  ctx.myId = "GUEST-000";
  await ctx.saveAfterStudy();
  assert.equal(calls.includes("cloud"), false);
});
test("a previous pending marker waits through boot/online and is retried at the next completion", async () => {
  const { ctx, values, events, calls } = setup();
  values.set("core_v4_autosave_pending_a", "1");
  ctx.resumeBackgroundSave();
  assert.equal(events.online, undefined);
  assert.deepEqual(calls, []);
  await ctx.saveAfterStudy();
  assert.equal(values.size, 0);
  assert.equal(calls.filter((c) => c === "cloud").length, 1);
});
test("weak review defers cloud sync during play and retains pending work if point settlement fails", async () => {
  const { ctx, values, calls } = setup();
  ctx.WeakReview = { isPlaying: () => true };
  ctx.StudyPoints = { flush: async () => false };
  assert.equal((await ctx.saveAfterStudy()).deferred, true);
  assert.deepEqual(calls, []);
  ctx.WeakReview.isPlaying = () => false;
  assert.equal((await ctx.saveAfterStudy("review-end")).cloudSaved, false);
  assert.equal(values.get("core_v4_autosave_pending_a"), "1");
  ctx.StudyPoints.flush = async () => true;
  assert.equal((await ctx.saveAfterStudy("review-end")).cloudSaved, true);
  assert.equal(values.size, 0);
});
