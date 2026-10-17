const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs");
function model(file, name) {
  const window = {
    onAppLoaded() {},
    onBeforeAppLoad() {},
    onTabChange() {},
    addEventListener() {},
  };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), {
    window,
    setInterval() {},
    setTimeout() {},
    clearTimeout() {},
    document: { addEventListener() {} },
  });
  return window[name];
}
const m = model("study-groups.js", "StudyGroupsModel");
const group = () => ({
  members: { a: {}, b: {} },
  baseline: { a: { words: 200, time: 50 }, b: { words: 100, time: 20 } },
  progress: { a: { words: 200, time: 50 }, b: { words: 100, time: 20 } },
  events: [],
});
test("milestones exclude pre-group learning, keep stale device data out and are retry idempotent", () => {
  const g = group();
  m.advance(g, "a", { words: 299, time: 79 }, 1);
  assert.equal(g.events.length, 0);
  m.advance(g, "a", { words: 300, time: 80, timeAt: 2 }, 2);
  assert.equal(g.events.length, 2);
  m.advance(g, "a", { words: 300, time: 80, timeAt: 2 }, 3);
  m.advance(g, "a", { words: 0, time: 0, timeAt: 1 }, 4);
  assert.equal(g.events.length, 2);
  assert.equal(g.progress.a.words, 300);
  assert.equal(g.progress.a.time, 80);
});
test("cooperation counts each participant increase after goal setup exactly once", () => {
  const g = group();
  g.goal = {
    id: "goal1",
    type: "words",
    target: 100,
    baseline: structuredClone(g.progress),
  };
  m.advance(g, "a", { words: 250, time: 50 }, 1);
  assert.equal(m.progress(g, "words"), 50);
  assert.equal(g.goal.done, undefined);
  m.advance(g, "b", { words: 150, time: 20 }, 2);
  assert.equal(g.goal.done, true);
  assert.equal(g.events.filter((e) => e.id === "goal:goal1").length, 1);
  m.advance(g, "b", { words: 151, time: 20 }, 3);
  assert.equal(g.events.filter((e) => e.id === "goal:goal1").length, 1);
});
test("large jumps make one latest milestone per metric and bounded timeline", () => {
  const g = group();
  for (let i = 1; i < 80; i++)
    m.advance(g, "a", { words: 200 + i * 100, time: 50 + i * 30 }, i);
  assert.equal(g.events.length, 40);
  assert.equal(new Set(g.events.map((e) => e.id)).size, 40);
});
const c = model("learning-sessions.js", "LearningSessionsModel");
test("understanding charts count meanings, including unknown statuses and legacy entries", () => {
  assert.equal(
    JSON.stringify(
      c.counts([
        {
          meanings: [
            { status: "ok" },
            { status: "so" },
            { status: "bad" },
            { status: "invalid" },
          ],
        },
        { status: "ok" },
        { meanings: [] },
      ]),
    ),
    JSON.stringify({ ok: 2, so: 1, bad: 1, none: 2 }),
  );
});
test("historical days merge independently so an older backup cannot replace a newer day", () => {
  const local = { "2026-10-14": { ok: 8, at: 20 } },
    saved = { "2026-10-14": { ok: 1, at: 10 }, "2026-10-13": { ok: 2, at: 5 } };
  const result = c.mergeHistory(local, saved);
  assert.equal(result["2026-10-14"].ok, 8);
  assert.equal(result["2026-10-13"].ok, 2);
  assert.equal(saved["2026-10-14"].ok, 1);
});
test("leaving prunes member data and reactions while preserving the collective goal contribution", () => {
  const g = group();
  g.owner = "a";
  g.goal = {
    id: "goal",
    type: "words",
    target: 100,
    baseline: structuredClone(g.progress),
  };
  m.advance(g, "a", { words: 250, time: 50 }, 1);
  g.events.push({ id: "test", reactions: { a: true, b: true } });
  m.leave(g, "a");
  assert.equal(g.owner, "b");
  assert.equal(g.members.a, undefined);
  assert.equal(g.progress.a, undefined);
  assert.equal(g.baseline.a, undefined);
  assert.equal(g.goal.baseline.a, undefined);
  assert.equal(g.events.at(-1).reactions.a, undefined);
  assert.equal(m.progress(g, "words"), 50);
});
test("rejoining has a distinct milestone identity and does not collide with earlier achievements", () => {
  const g = group();
  g.members.a.joinedAt = 1;
  m.advance(g, "a", { words: 300, time: 50 }, 2);
  m.leave(g, "a");
  g.members.a = { joinedAt: 3 };
  g.baseline.a = { words: 300, time: 50 };
  g.progress.a = { ...g.baseline.a };
  m.advance(g, "a", { words: 400, time: 50 }, 4);
  assert.equal(g.events.length, 2);
  assert.notEqual(g.events[0].id, g.events[1].id);
});
test("warm-up samples only ten valid distinct word references without altering a large source", () => {
  const source = Array.from({ length: 10000 }, (_, i) => ({
    word: "word" + i,
    meaning: "answer" + i,
  }));
  source.splice(1, 0, { word: "missing-answer" });
  const result = c.sample(source, 10, () => 0.25);
  assert.equal(result.length, 10);
  assert.equal(new Set(result.map((w) => w.word)).size, 10);
  assert.ok(result.every((w) => w.meaning && source.includes(w)));
  assert.equal(source.length, 10001);
  assert.equal(c.sample([{ word: "none" }]).length, 0);
});
test("a newer sleep/manual correction rolls back time milestones and reopens the time goal", () => {
  const g = group();
  g.goal = {
    id: "time-goal",
    type: "time",
    target: 30,
    baseline: structuredClone(g.progress),
  };
  m.advance(g, "a", { words: 200, time: 80, timeAt: 2 }, 2);
  assert.equal(g.goal.done, true);
  m.advance(g, "a", { words: 200, time: 75, timeAt: 3 }, 3);
  assert.equal(g.goal.done, false);
  assert.equal(m.progress(g, "time"), 25);
  assert.equal(g.events.length, 0);
  m.advance(g, "a", { words: 200, time: 80, timeAt: 2 }, 4);
  assert.equal(g.progress.a.time, 75);
});

test("individual goals cannot be completed by one member carrying the others", () => {
  const g = group();
  g.goal = {
    id: "individual",
    mode: "individual",
    type: "attempts",
    target: 10,
    baseline: { a: { attempts: 5 }, b: { attempts: 2 } },
  };
  m.advance(g, "a", { words: 200, time: 50, attempts: 105 }, 1);
  assert.equal(m.goalReached(g), false);
  m.advance(g, "b", { words: 100, time: 20, attempts: 12 }, 2);
  assert.equal(m.goalReached(g), true);
  assert.equal(g.goal.done, true);
  assert.equal(g.events.filter((e) => e.id === "goal:individual").length, 1);
});
test("sum mode and old goals retain combined progress", () => {
  const g = group();
  g.goal = {
    id: "sum",
    mode: "sum",
    type: "attempts",
    target: 10,
    baseline: { a: { attempts: 0 }, b: { attempts: 0 } },
  };
  m.advance(g, "a", { words: 200, time: 50, attempts: 10 }, 1);
  assert.equal(g.goal.done, true);
  assert.equal(m.goalReached(g), true);
});
test("individual time goals are reopened after a newer correction", () => {
  const g = group();
  g.goal = {
    id: "time",
    mode: "individual",
    type: "time",
    target: 10,
    baseline: structuredClone(g.progress),
  };
  m.advance(g, "a", { words: 200, time: 60, timeAt: 2 }, 2);
  m.advance(g, "b", { words: 100, time: 30, timeAt: 2 }, 2);
  assert.equal(g.goal.done, true);
  m.advance(g, "a", { words: 200, time: 55, timeAt: 3 }, 3);
  assert.equal(g.goal.done, false);
  assert.equal(
    g.events.some((e) => e.id === "goal:time"),
    false,
  );
});

test("individual completion is recalculated after leaving and an empty group cannot win", () => {
  const g = group();
  g.owner = "a";
  g.goal = {
    id: "leaving",
    mode: "individual",
    type: "time",
    target: 10,
    baseline: structuredClone(g.progress),
  };
  m.advance(g, "a", { words: 200, time: 60, timeAt: 1 }, 1);
  assert.equal(m.goalReached(g), false);
  m.leave(g, "b");
  assert.equal(g.goal.done, true);
  m.leave(g, "a");
  assert.equal(g.goal.done, false);
  assert.equal(m.goalReached(g), false);
});
test("group list summaries describe individual and combined goals without loading profiles", () => {
  const g = group();
  g.goal = {
    type: "time",
    mode: "individual",
    target: 30,
    baseline: { a: { time: 0 }, b: { time: 0 } },
  };
  g.progress = { a: { time: 30 }, b: { time: 5 } };
  assert.match(m.goalSummary(g), /1人 30分/);
  assert.match(m.goalSummary(g), /1\/2人達成/);
  g.goal.mode = "sum";
  assert.match(m.goalSummary(g), /35 \/ 30分/);
  g.goal = null;
  assert.equal(m.goalSummary(g), "協力目標は未設定");
});
