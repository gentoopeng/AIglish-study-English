const test = require("node:test"), assert = require("node:assert/strict");
const M = require("../reader-shelf-merge.js");
const item = (id, text, extra = {}) => ({ id, folder: "", title: "t" + id, text, aiAnalysisData: null, ...extra });
const side = (shelf, deleted = [], folders = ["未分類"], ops = {}) => ({ shelf, deleted, folders, ops, meta: M.meta(shelf) });
const now = 2e12;
const ids = (r) => r.shelf.map((i) => i.id);

test("the report: a text saved on one copy stays, a text deleted there stays deleted", () => {
  // The stale copy still has Y (2) and lacks X (3); the other saved X and deleted Y.
  const stale = side([item(1, "a"), item(2, "y")]);
  const fresh = side([item(1, "a"), item(3, "x")], [{ id: 2, at: now - 1000 }]);
  assert.deepEqual(ids(M.merge(stale, fresh, now)), [1, 3]);
  assert.deepEqual(ids(M.merge(fresh, stale, now)), [1, 3]);
});

test("a tombstone always wins for its id, whatever the clocks say", () => {
  const edited = side([item(2, "y", { updatedAt: now + 99999 })]);
  const deleted = side([], [{ id: 2, at: now - 10 * 86400000 }]);
  assert.deepEqual(ids(M.merge(edited, deleted, now + 1e5)), []);
});

test("the same id: the later edit wins, and an analysis is not lost", () => {
  const a = side([item(1, "a", { title: "old", aiAnalysisData: { sentences: [1] } })]);
  const b = side([item(1, "a", { title: "new", updatedAt: now })]);
  const r = M.merge(a, b, now);
  assert.equal(r.shelf[0].title, "new");
  assert.deepEqual(r.shelf[0].aiAnalysisData, { sentences: [1] });
  // An edited text does not take the other text's analysis.
  const c = side([item(1, "changed", { updatedAt: now })]);
  assert.equal(M.merge(a, c, now).shelf[0].aiAnalysisData, null);
});

test("the same text saved twice in the same place is one text (older id, analysis kept); the tombstone is applied first", () => {
  const a = side([item(5, "same")]);
  const b = side([item(9, "same", { aiAnalysisData: { sentences: [1] } })]);
  const r = M.merge(a, b, now);
  assert.deepEqual(ids(r), [5]);
  assert.ok(r.shelf[0].aiAnalysisData);
  // The older copy was deleted: the newer one stays.
  assert.deepEqual(ids(M.merge(side([item(5, "same")], [{ id: 5, at: now }]), b, now)), [9]);
  // Different folders are different saves.
  assert.deepEqual(ids(M.merge(a, side([item(9, "same", { folder: "模試" })]), now)), [5, 9]);
});

test("the same id for two different texts keeps both; entries without an id get a stable one", () => {
  const r = M.merge(side([item(7, "one")]), side([item(7, "two")]), now);
  assert.equal(r.shelf.length, 2);
  assert.notEqual(r.shelf[0].id, r.shelf[1].id);
  const noId = { folder: "", title: "x", text: "old entry" };
  const once = M.merge(side([noId]), side([noId]), now);
  assert.equal(once.shelf.length, 1);
  assert.equal(M.merge(once, side([noId]), now).shelf.length, 1);
});

test("merging again changes nothing, and the order alone is not a change", () => {
  const a = side([item(3, "c"), item(1, "a")], [{ id: 8, at: now - 5 }], ["未分類", "A"]);
  const b = side([item(1, "a"), item(2, "b")], [{ id: 9, at: now - 6 }], ["未分類", "B"]);
  const once = M.merge(a, b, now), twice = M.merge(once, b, now);
  assert.deepEqual(twice, once);
  assert.deepEqual(ids(once), [3, 1, 2], "the first side's order, then the rest by id");
  assert.equal(M.signature(M.merge(a, b, now)), M.signature(M.merge(b, a, now)));
});

test("folders: the last thing done to a name decides", () => {
  const a = side([], [], ["未分類", "模試", "過去問"], { 模試: { at: 10, deleted: false } });
  const b = side([], [], ["未分類"], { 模試: { at: 20, deleted: true } });
  assert.deepEqual(M.merge(a, b, now).folders, ["未分類", "過去問"]);
  const again = side([], [], ["未分類", "模試"], { 模試: { at: 30, deleted: false } });
  assert.deepEqual(M.merge(b, again, now).folders, ["未分類", "模試"]);
});

test("new format only when the meta lists exactly the shelf's ids (an older version changing the shelf breaks it)", () => {
  const s = side([item(1, "a"), item(2, "b")]);
  assert.equal(M.isNew(s), true);
  assert.equal(M.isNew({ ...s, shelf: [item(1, "a")] }), false, "an old version deleted one without a tombstone");
  assert.equal(M.isNew({ ...s, shelf: [...s.shelf, item(3, "c")] }), false);
  assert.equal(M.isNew({ shelf: [], deleted: [] }), false);
  assert.equal(M.isNew({ shelf: [], deleted: null, meta: M.meta([]) }), false);
});

test("old tombstones go, and at most 500 are kept (the newest)", () => {
  const many = Array.from({ length: 520 }, (_, i) => ({ id: i, at: now - i }));
  const r = M.tombstones(many, [{ id: "old", at: now - 181 * 86400000 }], now);
  assert.equal(r.length, 500);
  assert.equal(r.some((t) => t.id === "old"), false);
  assert.equal(r.some((t) => t.id === 519), false);
});

test("folder covers: the newest wins, and a cover for a deleted folder goes", () => {
  const a = { ...side([item(1, "a")], [], ["未分類", "英語"]), covers: { "英語": { image: "data:old", at: now - 5000 } } };
  const b = { ...side([item(1, "a")], [], ["未分類", "英語"]), covers: { "英語": { image: "data:new", at: now - 1000 } } };
  assert.deepEqual(M.merge(a, b, now).covers, { "英語": { image: "data:new", at: now - 1000 } });
  assert.deepEqual(M.merge(b, a, now).covers, { "英語": { image: "data:new", at: now - 1000 } });
  const gone = { ...side([item(1, "a")], [], ["未分類", "英語"]), covers: { "英語": { image: "data:x", at: now - 1000 } } };
  const deleted = { ...side([item(1, "a")], [], ["未分類"], { "英語": { at: now, deleted: true } }) };
  assert.deepEqual(M.merge(gone, deleted, now).covers, {});
  assert.notEqual(M.signature({ ...side([]), covers: {} }), M.signature({ ...side([]), covers: { "英語": { image: "data:x", at: 1 } } }));
});

test("a stamp tie: the filed copy wins over the unfiled one, whichever side is first", () => {
  const filedItem = item(9, "x", { folder: "共テ" });
  const unfiled = item(9, "x");
  const a = side([filedItem], [], ["未分類", "共テ"]);
  const b = side([unfiled], [], ["未分類"]);
  assert.equal(M.merge(a, b, now).shelf[0].folder, "共テ");
  assert.equal(M.merge(b, a, now).shelf[0].folder, "共テ");
  // A name a surviving text still uses stays in the folder list even when neither
  // side's folder list has it (its delete op was the newer one).
  const gone = { ...side([filedItem], [], ["未分類"]), ops: { "共テ": { at: now, deleted: true } } };
  assert.ok(M.merge(gone, b, now).folders.includes("共テ"));
});
