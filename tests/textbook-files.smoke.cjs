const { chromium, webkit } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const type = process.env.BROWSER === "webkit" ? webkit : chromium;
  const browser = await type.launch(
    type === chromium
      ? { executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] }
      : { executablePath: process.env.WEBKIT_EXECUTABLE_PATH },
  );
  try {
    const page = await browser.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.goto("http://127.0.0.1:8000");
    await page
      .getByRole("button", { name: "ゲストで試す" })
      .click();
    await page.waitForFunction(() => window.__learningBootReady);
    const result = await page.evaluate(async () => {
      myId = "download-user";
      localStorage.setItem("core_v4_userId", myId);
      window.db = {};
      currentTextbook = "book-a";
      window.LearningData.canSave = () => true;
      window.syncRankingMetrics = () => {};
      const docs = new Map(),
        writes = [],
        reads = [];
      let fail = false;
      window.fbDoc = (_, ...parts) => ({ path: parts.join("/") });
      window.fbSetDoc = async (ref, data) => {
        if (fail && ref.path.includes("/parts/m_"))
          throw Error("upload interrupted");
        writes.push(ref.path);
        docs.set(ref.path, structuredClone(data));
      };
      window.fbGetDoc = async (ref) => {
        reads.push(ref.path);
        return {
          exists: () => docs.has(ref.path),
          data: () => docs.get(ref.path),
        };
      };
      window.fbRunTransaction = undefined;
      window.fbSetDocsProtected = undefined;
      const master = Array.from({ length: 1500 }, (_, i) => ({
        num: i + 1,
        word: "term-" + i,
        meanings: [
          { text: "意味" + i + "説明".repeat(30), status: "none", history: [] },
        ],
      }));
      const progress = {
          1: { status: "ok", history: ["ok"], updatedAt: 1000 },
        },
        other = [{ num: 1, word: "other", meaning: "別の教材" }];
      const snapshot = () => ({
        localStorage: {
          [getVocabProgressStorageKey("book-a")]: JSON.stringify(progress),
          [getVocabProgressStorageKey("book-a") + "__ts"]: "1000",
          ["vv4_works_" + myId]: JSON.stringify([
            {
              id: "work-a",
              units: [
                {
                  id: "1:s2",
                  q: "x²=4",
                  ans: "±2",
                  note: "残す",
                  status: "ok",
                },
              ],
            },
          ]),
        },
        memory: {
          vocabBookKey: "book-a",
          vocabMaster: master,
          vocabProgress: progress,
          vocabBooks: {
            "book-a": { master, progress, savedAt: "2026-10-16T00:00:00Z" },
            "book-b": {
              master: other,
              progress: {},
              savedAt: "2026-10-16T00:00:00Z",
            },
          },
        },
      });
      window.__collectGameSaveData = snapshot;
      const first = await __backgroundSaveAll();
      // Read the backup the way the app does (itemized v6 or older formats), without counting
      // these test reads as the app's own.
      const getCloud = async () => {
        const record = window.fbGetDoc;
        window.fbGetDoc = async (ref) => ({
          exists: () => docs.has(ref.path),
          data: () => docs.get(ref.path),
        });
        try {
          const path = "users/download-user/saves/main",
            save = await window.__fetchCloudSave("download-user");
          return { path, meta: docs.get(path), save, bytes: JSON.stringify(save).length };
        } finally {
          window.fbGetDoc = record;
        }
      };
      const cloud1 = (await getCloud()),
        masterWrites = writes.filter((p) => p.includes("/parts/m_")).length;
      progress[1] = { status: "bad", history: ["ok", "bad"], updatedAt: 2000 };
      localStorage.setItem(
        getVocabProgressStorageKey("book-a"),
        JSON.stringify(progress),
      );
      localStorage.setItem(
        getVocabProgressStorageKey("book-a") + "__ts",
        "2000",
      );
      const second = await __backgroundSaveAll(),
        cloud2 = (await getCloud());
      const unchangedWrites =
        writes.filter((p) => p.includes("/parts/m_")).length - masterWrites;
      const local = JSON.parse(
        localStorage.getItem("save_studio_download-user_main"),
      );
      const oldRef = cloud2.save.data.memory.vocabBooks["book-a"].masterRef;
      const beforeReads = reads.length;
      await TextbookFiles.hydrate(
        "book-a",
        cloud2.save.data.memory.vocabBooks["book-a"],
        myId,
      );
      const cachedReads = reads.length - beforeReads;
      const ref = cloud2.save.data.memory.vocabBooks["book-b"].masterRef;
      // Keep valid immutable bytes in cloud but evict both files from the dedicated IDB store.
      await new Promise((resolve, reject) => {
        const req = indexedDB.open("aiglish-textbook-files", 1);
        req.onsuccess = () => {
          const db = req.result,
            tx = db.transaction("files", "readwrite");
          tx.objectStore("files").clear();
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => reject(tx.error);
        };
      });
      const beforeRestore = reads.length,
        restored = structuredClone(cloud2.save);
      await TextbookFiles.prepareRestore(restored, myId);
      const lazy = reads
        .slice(beforeRestore)
        .every((path) => !path.includes("book-b"));
      const activeRecovered =
        restored.data.memory.vocabMaster[0].word === "term-0";
      const openedOther = await TextbookFiles.hydrate(
        "book-b",
        cloud2.save.data.memory.vocabBooks["book-b"],
        myId,
      );
      const afterDownload = reads.length;
      await TextbookFiles.hydrate(
        "book-b",
        cloud2.save.data.memory.vocabBooks["book-b"],
        myId,
      );
      const noRepeatReads = reads.length === afterDownload;
      // Editing a body changes only its immutable version. Learning-only edits did not.
      master[0].word = "new-term";
      const third = await __backgroundSaveAll(),
        cloud3 = (await getCloud());
      const changedRef =
        cloud3.save.data.memory.vocabBooks["book-a"].masterRef.hash !==
        oldRef.hash;
      master[0].word = "interrupted-term";
      fail = true;
      const interrupted = await __backgroundSaveAll();
      const sameGeneration =
        (await getCloud()).meta.generation === cloud3.meta.generation;
      fail = false;
      // Missing cloud parts must reject, preserving canonical ratings and old files.
      const invalid = {
        masterRef: {
          version: 1,
          hash: "a".repeat(64),
          partCount: 1,
          length: 2,
        },
        progress: {},
      };
      const ratingBefore = JSON.stringify(LearningData.read("book-a"));
      let missingRejected = false;
      try {
        await TextbookFiles.hydrate("book-a", invalid, myId);
      } catch (_) {
        missingRejected = true;
      }
      const ratingPreserved =
        ratingBefore === JSON.stringify(LearningData.read("book-a"));
      let ownerRejected = false;
      try {
        await TextbookFiles.hydrate("book-b", { masterRef: ref }, "other-user");
      } catch (_) {
        ownerRejected = true;
      }
      await window.LibraryState.mark("book", "book-b", {}, myId);
      let deletedRejected = false;
      try {
        await TextbookFiles.hydrate("book-b", { masterRef: ref }, myId);
      } catch (_) {
        deletedRejected = true;
      }
      // Persist the expected version for a real page reload, then isolate this device's cache.
      localStorage.setItem(
        "download-test-ref",
        JSON.stringify(cloud3.save.data.memory.vocabBooks["book-a"]),
      );
      window.__testCloudRecords = [...docs];
      return {
        first,
        second,
        third,
        interrupted,
        masterWrites,
        unchangedWrites,
        cachedReads,
        lazy,
        activeRecovered,
        noRepeatReads,
        other: openedOther.master[0].word,
        changedRef,
        sameGeneration,
        missingRejected,
        ratingPreserved,
        ownerRejected,
        deletedRejected,
        cloudBytes: cloud2.bytes,
        fullBytes: JSON.stringify(local).length,
        bodyAbsent:
          !("vocabMaster" in cloud2.save.data.memory) &&
          !("master" in cloud2.save.data.memory.vocabBooks["book-a"]),
        workBodyAbsent: !JSON.parse(
          cloud2.save.data.localStorage["vv4_works_" + myId],
        )[0].units[0].q,
        workRecovered: JSON.parse(
          restored.data.localStorage["vv4_works_" + myId],
        )[0].units[0],
        newStatus: cloud2.save.data.memory.vocabProgress[1].status,
        localBody: local.data.memory.vocabMaster.length,
      };
    });
    for (const field of ["first", "second", "third"])
      assert.equal(result[field].cloudSaved, true, JSON.stringify(result));
    assert.equal(result.unchangedWrites, 0);
    assert.equal(result.cachedReads, 0);
    assert.equal(result.bodyAbsent, true);
    assert.equal(result.newStatus, "bad");
    assert.equal(result.localBody, 1500);
    assert.equal(result.workBodyAbsent, true);
    assert.deepEqual(result.workRecovered, {
      id: "1:s2",
      q: "x²=4",
      ans: "±2",
      note: "残す",
      status: "ok",
    });
    assert.ok(result.cloudBytes < result.fullBytes / 5, JSON.stringify(result));
    for (const field of [
      "lazy",
      "activeRecovered",
      "noRepeatReads",
      "changedRef",
      "sameGeneration",
      "missingRejected",
      "ratingPreserved",
      "ownerRejected",
      "deletedRejected",
    ])
      assert.equal(result[field], true, field);
    assert.equal(result.interrupted.localSaved, true);
    assert.equal(result.interrupted.cloudSaved, false);
    assert.equal(result.other, "other");
    const records = await page.evaluate(() => window.__testCloudRecords);
    const remote = await browser.newPage();
    remote.on("pageerror", (e) => errors.push(e.message));
    await remote.route("https://**/*", (r) => r.abort());
    await remote.goto("http://127.0.0.1:8000");
    await remote
      .getByRole("button", { name: "ゲストで試す" })
      .click();
    await remote.waitForFunction(() => window.__learningBootReady);
    const migrated = await remote.evaluate(async (records) => {
      myId = ""; // Before loadLocalState assigns the account on a cold start.
      localStorage.setItem("core_v4_userId", "download-user");
      currentTextbook = "book-a";
      window.db = {};
      const docs = new Map(records),
        reads = [];
      window.fbDoc = (_, ...parts) => ({ path: parts.join("/") });
      window.fbGetDoc = async (ref) => {
        reads.push(ref.path);
        return {
          exists: () => docs.has(ref.path),
          data: () => docs.get(ref.path),
        };
      };
      window.fbSetDoc = async () => {};
      window.fbCollection = () => ({});
      window.fbGetDocs = async () => ({ forEach: () => {} });
      window.__manualVocabDrafts = {};
      window.__gameSaveLoadedFor = null;
      await window.__beforeAppLoadHandlers.find(
        (fn) => fn.name === "autoLoadOnce",
      )();
      myId = "download-user";
      window.__afterAppLoadHandlers.find(
        (fn) => fn.name === "restorePendingSaveMemory",
      )();
      await window.loadCurrentTextbookData();
      const active = vocabList[0].word,
        status = LearningData.read("book-a")[1].status;
      const lazy = reads.every((path) => !path.includes("/vocabBooks/book-b/"));
      const flashSource = await window.__getBookMasterWords("book-b");
      if (flashSource[0]?.word !== "other")
        throw Error("flashcards missed downloaded book");
      currentTextbook = "book-b";
      await window.loadCurrentTextbookData();
      return { active, status, lazy, other: vocabList[0].word };
    }, records);
    assert.deepEqual(migrated, {
      active: "new-term",
      status: "bad",
      lazy: true,
      other: "other",
    });
    await remote.close();
    await page.reload();
    await page.waitForFunction(() => window.__learningBootReady);
    const persisted = await page.evaluate(async () => {
      let count = 0;
      window.db = {};
      window.fbGetDoc = async () => {
        count++;
        throw Error("must use IDB");
      };
      const saved = JSON.parse(localStorage.getItem("download-test-ref"));
      const restored = await TextbookFiles.hydrate(
        "book-a",
        saved,
        "download-user",
        true,
      );
      return { word: restored.master[0].word, count };
    });
    assert.deepEqual(persisted, { word: "new-term", count: 0 });
    assert.deepEqual(errors, []);
    console.log("PASS", type.name(), JSON.stringify(result));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
