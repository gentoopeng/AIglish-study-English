const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs");
function setup(values = new Map(), publicBook = false) {
  const original = [
      {
        num: 1,
        word: "既存",
        meaning: "意味",
        meanings: [{ id: "1-0", text: "意味" }],
      },
    ],
    progress = {
      1: {
        status: "ok",
        note: "メモ",
        sticky: true,
        meanings: {
          "1-0": {
            status: "ok",
            history: ["bad", "ok"],
            review: { passed: "2026-10-17" },
          },
        },
      },
    };
  const c = {
    document: { getElementById: () => null },
    myId: "user",
    currentTextbook: "book",
    textbooksPool: [
      {
        id: "book",
        name: "教材",
        personal: true,
        visibility: publicBook ? "public" : "private",
      },
    ],
    textbooksCacheMap: {},
    vocabList: structuredClone(original),
    currentUserVocabProgress: progress,
    userStats: {},
    Date,
    structuredClone,
    console: { warn() {} },
    setTimeout,
    clearTimeout,
    localStorage: {
      getItem: (k) => values.get(k) || null,
      setItem: (k, v) => values.set(k, v),
    },
    canEditCurrentTextbook: () => true,
    isPersonalTextbook: () => true,
    LearningData: { canSave: () => true, read: () => progress },
    LibraryState: { isDeleted: () => false },
    __manualVocabLocalKey: (book) => "draft_" + book,
    __manualVocabDrafts: {},
    __manualVocabDraftRevisions: {},
    __dirtyManualVocabDrafts: {},
    stripVocabProgressFromWords: (words) => structuredClone(words),
    migrateVocabData: (words) => words,
    applyUserProgressToVocabList() {},
    updateFlashcardSourceSelectOptions() {},
    renderVocabList() {},
    renderVocabLibrarySelection() {},
    addEventListener() {},
    queueBackgroundSave() {},
    publishVocabEntryMaster: async () => {},
  };
  c.window = c;
  c.VocabMaster = {
    resolve: (book) => {
      const raw = values.get("draft_" + book);
      return raw
        ? JSON.parse(raw)
        : { master: original, savedAt: "2026-10-01T00:00:00Z" };
    },
  };
  vm.createContext(c);
  // The app loads the display-number model before the entry form.
  vm.runInContext(fs.readFileSync("vocab-order.js", "utf8"), c);
  vm.runInContext(fs.readFileSync("vocab-entry.js", "utf8"), c);
  return {
    c,
    values,
    progress,
    save: (fields) => c.VocabWordEntry.save(fields, "book", "user"),
    flush: () => c.VocabWordEntry.flushPublications("user"),
  };
}
const fields = { word: "追加", meanings: [{ text: "答え" }], sub: "補足" };
test("successful addition stores a complete restart draft while preserving canonical learning bytes", () => {
  const a = setup(),
    before = JSON.stringify(a.progress);
  a.save(fields);
  const draft = JSON.parse(a.values.get("draft_book"));
  assert.equal(draft.master.length, 2);
  assert.equal(JSON.stringify(draft.progress), before);
  assert.equal(JSON.stringify(a.progress), before);
  assert.equal(a.c.__dirtyManualVocabDrafts.book, 1);
});
test("primary storage failure never updates the live word list; secondary cache failure retains the complete draft", () => {
  const a = setup(),
    set = a.c.localStorage.setItem;
  a.c.localStorage.setItem = (k, v) => {
    if (k === "draft_book") throw Error("quota");
    set(k, v);
  };
  assert.throws(() => a.save(fields), /quota/);
  assert.equal(a.c.vocabList.length, 1);
  assert.equal(a.values.has("draft_book"), false);
  a.c.localStorage.setItem = (k, v) => {
    if (k.startsWith("core_v4_custom_words_")) throw Error("cache quota");
    set(k, v);
  };
  a.save(fields);
  assert.equal(a.c.vocabList.length, 2);
  assert.equal(JSON.parse(a.values.get("draft_book")).master.length, 2);
});
test("loading, permission, deleted book, wrong book and wrong account cannot append", () => {
  const a = setup();
  a.c.LearningData.canSave = () => false;
  assert.throws(() => a.save(fields));
  a.c.LearningData.canSave = () => true;
  a.c.canEditCurrentTextbook = () => false;
  assert.throws(() => a.save(fields));
  a.c.canEditCurrentTextbook = () => true;
  a.c.LibraryState.isDeleted = () => true;
  assert.throws(() => a.save(fields));
  a.c.LibraryState.isDeleted = () => false;
  a.c.currentTextbook = "other";
  assert.throws(() => a.save(fields));
  a.c.currentTextbook = "book";
  a.c.myId = "other";
  assert.throws(() => a.save(fields));
  assert.equal(a.values.size, 0);
});
test("offline public changes remain local and queued across restart, then publish exactly once", async () => {
  const a = setup(new Map(), true);
  a.c.publishVocabEntryMaster = async () => {
    throw Error("offline");
  };
  a.save(fields);
  assert.equal(await a.flush(), false);
  assert.equal(JSON.parse(a.values.get("draft_book")).master.length, 2);
  const b = setup(a.values, true);
  let calls = 0;
  b.c.publishVocabEntryMaster = async (book, master, id) => {
    calls++;
    assert.equal(id, "user");
    assert.equal(master.length, 2);
    assert.equal(master[1].note, undefined);
  };
  assert.equal(await b.flush(), true);
  assert.equal(await b.flush(), true);
  assert.equal(calls, 1);
});
test("an addition during a publication cannot be acknowledged by the older response", async () => {
  const a = setup(new Map(), true);
  a.save(fields);
  let release;
  a.c.publishVocabEntryMaster = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const pending = a.flush();
  a.save({ ...fields, word: "次の追加" });
  release();
  await pending;
  assert.equal(
    Object.keys(
      JSON.parse(a.values.get("core_v4_vocab_entry_publications_user")),
    ).length,
    1,
  );
  a.c.publishVocabEntryMaster = async (book, master) =>
    assert.equal(master.length, 3);
  assert.equal(await a.flush(), true);
  assert.deepEqual(
    JSON.parse(a.values.get("core_v4_vocab_entry_publications_user")),
    {},
  );
});
test("quota backoff skips public writes, and a deleted book cannot be republished", async () => {
  const a = setup(new Map(), true);
  a.save(fields);
  let calls = 0;
  a.c.publishVocabEntryMaster = async () => {
    calls++;
  };
  a.c.FirestoreReadGuard = { paused: () => true };
  assert.equal(await a.flush(), false);
  assert.equal(calls, 0);
  a.c.FirestoreReadGuard.paused = () => false;
  a.c.LibraryState.isDeleted = () => true;
  assert.equal(await a.flush(), true);
  assert.equal(calls, 0);
});
test("a publication that never responds times out without dropping the saved word or queued retry", async () => {
  const a = setup(new Map(), true);
  a.save(fields);
  a.c.publishVocabEntryMaster = () => new Promise(() => {});
  a.c.setTimeout = (fn) => {
    queueMicrotask(fn);
    return 1;
  };
  a.c.clearTimeout = () => {};
  assert.equal(await a.flush(), false);
  assert.equal(JSON.parse(a.values.get("draft_book")).master.length, 2);
  assert.equal(
    Object.keys(
      JSON.parse(a.values.get("core_v4_vocab_entry_publications_user")),
    ).length,
    1,
  );
});
test("a presentation error after commit never reports the already stored word as an unsuccessful write", () => {
  const a = setup();
  a.c.renderVocabList = () => {
    throw Error("rendering error");
  };
  assert.equal(a.save(fields).word, "追加");
  assert.equal(JSON.parse(a.values.get("draft_book")).master.length, 2);
});
test("restoring an older backup cannot drop newer queued publications", () => {
  const a = setup(new Map(), true);
  a.save(fields);
  const queue = JSON.parse(
    a.values.get("core_v4_vocab_entry_publications_user"),
  );
  a.c.VocabWordEntry.restorePublications(
    { book: "2000-01-01T00:00:00Z", another: "2026-10-01T00:00:00Z" },
    "user",
  );
  const merged = JSON.parse(
    a.values.get("core_v4_vocab_entry_publications_user"),
  );
  assert.equal(merged.book, queue.book);
  assert.equal(merged.another, "2026-10-01T00:00:00Z");
  a.c.VocabWordEntry.restorePublications({}, "user");
  assert.equal(
    JSON.parse(a.values.get("core_v4_vocab_entry_publications_user")).book,
    queue.book,
  );
});
