// Immutable textbook bodies. Learning records remain in the ordinary cloud save.
(function () {
  "use strict";
  const inflight = new Map();
  const workKey = (id) => "@workbook/" + id;
  const isWork = (book) => book.startsWith("@workbook/");
  let database;
  const ownerNow = () =>
    typeof myId === "string" && myId
      ? myId
      : localStorage.getItem("core_v4_userId") || "GUEST-000";
  const key = (owner, book) =>
    "core_v4_textbook_file_" +
    encodeURIComponent(owner) +
    "_" +
    encodeURIComponent(book);
  const deleted = (owner, book) =>
    window.LibraryState?.isDeleted(
      isWork(book) ? "work" : "book",
      isWork(book) ? book.slice(10) : book,
      owner,
    );
  function check(owner, book) {
    if (ownerNow() !== owner || deleted(owner, book))
      throw Error(
        "教材またはアカウントが変更されました。保存内容は変更していません。",
      );
  }
  function read(owner, book) {
    try {
      return JSON.parse(localStorage.getItem(key(owner, book)) || "null");
    } catch (_) {
      return null;
    }
  }
  function valid(ref) {
    return (
      ref &&
      ref.version === 1 &&
      /^[a-f0-9]{64}$/.test(ref.hash) &&
      Number.isInteger(ref.partCount) &&
      ref.partCount > 0 &&
      ref.partCount < 1000 &&
      Number.isInteger(ref.length) &&
      ref.length >= 2 &&
      ref.length <= 20000000
    );
  }
  async function digest(raw) {
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(raw),
    );
    return Array.from(new Uint8Array(hash), (n) =>
      n.toString(16).padStart(2, "0"),
    ).join("");
  }
  function open() {
    if (!database)
      database = new Promise((resolve, reject) => {
        const req = indexedDB.open("aiglish-textbook-files", 1);
        let settled = false;
        const timer = setTimeout(
          () => fail(Error("教材の端末保存が完了しませんでした。")),
          12000,
        );
        function fail(error) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          database = null;
          reject(error);
        }
        req.onupgradeneeded = () => req.result.createObjectStore("files");
        req.onsuccess = () => {
          if (settled) {
            req.result.close();
            return;
          }
          settled = true;
          clearTimeout(timer);
          req.result.onversionchange = () => {
            req.result.close();
            database = null;
          };
          resolve(req.result);
        };
        req.onerror = () => fail(req.error);
        req.onblocked = () => fail(Error("教材の端末保存を開けませんでした。"));
      });
    return database;
  }
  async function file(owner, book, hash, raw) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        "files",
        raw === undefined ? "readonly" : "readwrite",
      );
      const store = tx.objectStore("files"),
        id = JSON.stringify([owner, book, hash]);
      const req = raw === undefined ? store.get(id) : store.put(raw, id);
      tx.oncomplete = () => resolve(req.result);
      tx.onabort = () =>
        reject(tx.error || Error("教材を端末に保存できませんでした。"));
      tx.onerror = () => {};
    });
  }
  async function cache(book, draft, owner) {
    check(owner, book);
    if (
      !Array.isArray(draft.master) ||
      (!draft.master.length && draft.emptyConfirmed !== true)
    )
      throw Error("読み込み前の教材は保存できません。");
    const raw = JSON.stringify(
      !isWork(book) && window.stripVocabProgressFromWords
        ? window.stripVocabProgressFromWords(draft.master)
        : draft.master,
    );
    if (raw.length > 20000000)
      throw Error(
        "教材が大きすぎるため移行を保留しました。元の端末セーブは保持しています。",
      );
    const hash = await digest(raw),
      old = read(owner, book);
    // Only a matching, previously committed file can be reused.
    if (!old || old.hash !== hash || (await file(owner, book, hash)) !== raw)
      await file(owner, book, hash, raw);
    check(owner, book);
    const record = {
      hash,
      length: raw.length,
      savedAt: draft.savedAt || "",
      masterRef: old?.hash === hash ? old.masterRef || null : null,
    };
    localStorage.setItem(key(owner, book), JSON.stringify(record));
    return { raw, record };
  }
  async function packDraft(book, draft, owner) {
    check(owner, book);
    if (!Array.isArray(draft.master)) {
      if (!valid(draft.masterRef))
        throw Error("教材本文を確認できません。元のセーブを保持しています。");
      return { ...draft };
    }
    const { raw, record } = await cache(book, draft, owner);
    let ref = record.masterRef;
    if (!valid(ref) || ref.hash !== record.hash || ref.length !== raw.length) {
      const chunk = window.__manualVocabChunkSize || 180000;
      const parts = [];
      for (let i = 0; i < raw.length; i += chunk)
        parts.push(raw.slice(i, i + chunk));
      // Same account/book/version shares one upload, even across two save paths.
      const uploadKey = JSON.stringify([owner, book, record.hash]);
      if (!inflight.has(uploadKey))
        inflight.set(
          uploadKey,
          (async () => {
            for (let i = 0; i < parts.length; i += 4) {
              check(owner, book);
              await window.__writeSaveParts(
                parts
                  .slice(i, i + 4)
                  .map((d, n) => [
                    window.fbDoc(
                      window.db,
                      "users",
                      owner,
                      "vocabBooks",
                      encodeURIComponent(book),
                      "parts",
                      "m_" + record.hash + "_p" + (i + n),
                    ),
                    { d },
                    { merge: false },
                  ]),
              );
            }
            check(owner, book);
            return {
              version: 1,
              hash: record.hash,
              partCount: parts.length,
              length: raw.length,
            };
          })().finally(() => inflight.delete(uploadKey)),
        );
      ref = await inflight.get(uploadKey);
      check(owner, book);
      // Publish the local confirmation only after every cloud part committed.
      const latest = read(owner, book);
      if (latest?.hash === record.hash)
        localStorage.setItem(
          key(owner, book),
          JSON.stringify({ ...latest, masterRef: ref }),
        );
    }
    const result = { ...draft, masterRef: ref };
    delete result.master;
    return result;
  }
  async function hydrate(book, draft, owner, localOnly = false) {
    check(owner, book);
    if (Array.isArray(draft.master)) return draft;
    const ref = draft.masterRef;
    if (!valid(ref)) throw Error("教材ファイルの情報を確認できません。");
    let raw = await file(owner, book, ref.hash);
    // Validate local files as well. Never convert a missing/corrupt book to [].
    if (
      typeof raw !== "string" ||
      raw.length !== ref.length ||
      (await digest(raw)) !== ref.hash
    ) {
      if (localOnly)
        throw Error(
          "未ダウンロードの教材があります。一度教材を開いてから書き出してください。",
        );
      if (!window.fbGetDoc || !window.db || window.FirestoreReadGuard?.paused?.())
        throw Error("教材のダウンロード待ちです。接続後に開き直してください。");
      raw = "";
      for (let i = 0; i < ref.partCount; i++) {
        check(owner, book);
        const snap = await window.fbGetDoc(
          window.fbDoc(
            window.db,
            "users",
            owner,
            "vocabBooks",
            encodeURIComponent(book),
            "parts",
            "m_" + ref.hash + "_p" + i,
          ),
        );
        if (!snap?.exists() || typeof snap.data()?.d !== "string")
          throw Error("教材ファイルの一部を取得できませんでした。");
        raw += snap.data().d;
        if (raw.length > ref.length)
          throw Error("教材ファイルの長さが一致しません。");
      }
      if (raw.length !== ref.length || (await digest(raw)) !== ref.hash)
        throw Error(
          "教材ファイルの検証に失敗しました。元の記録は保持しています。",
        );
      await file(owner, book, ref.hash, raw);
    }
    check(owner, book);
    const master = JSON.parse(raw);
    if (
      !Array.isArray(master) ||
      (!master.length && draft.emptyConfirmed !== true)
    )
      throw Error("教材の内容を確認できません。");
    localStorage.setItem(
      key(owner, book),
      JSON.stringify({
        hash: ref.hash,
        length: ref.length,
        masterRef: ref,
        savedAt: draft.savedAt || "",
      }),
    );
    return { ...draft, master };
  }
  async function restoreBook(book, owner, localOnly = false) {
    check(owner, book);
    const record = read(owner, book);
    if (!record) return null;
    const draft = window.__manualVocabDrafts?.[book] || {};
    if (valid(draft.masterRef)) return hydrate(book, draft, owner, localOnly);
    if (valid(record.masterRef))
      return hydrate(
        book,
        {
          ...draft,
          masterRef: record.masterRef,
          savedAt: draft.savedAt || record.savedAt,
        },
        owner,
        localOnly,
      );
    const raw = await file(owner, book, record.hash);
    if (
      !raw ||
      raw.length !== record.length ||
      (await digest(raw)) !== record.hash
    )
      return null;
    return {
      ...draft,
      master: JSON.parse(raw),
      savedAt: draft.savedAt || record.savedAt,
    };
  }
  async function packSave(save, owner) {
    const source = save.data.memory || {},
      memory = { ...source, vocabBooks: {} };
    for (const [book, draft] of Object.entries(source.vocabBooks || {})) {
      if (deleted(owner, book)) continue;
      memory.vocabBooks[book] = await packDraft(book, draft, owner);
    }
    if (Array.isArray(source.vocabMaster) && source.vocabBookKey) {
      // Current master and its collected draft are the same snapshot in normal saves.
      const packed = await packDraft(
        source.vocabBookKey,
        {
          master: source.vocabMaster,
          emptyConfirmed: source.vocabEmptyConfirmed,
          progress: source.vocabProgress,
          savedAt: save.savedAt,
        },
        owner,
      );
      memory.vocabMasterRef = packed.masterRef;
      memory.vocabBooks[source.vocabBookKey] = {
        ...memory.vocabBooks[source.vocabBookKey],
        ...packed,
      };
      delete memory.vocabMaster;
    }
    const storage = { ...save.data.localStorage };
    for (const name of Object.keys(storage))
      if (name.startsWith("core_v4_textbook_file_")) delete storage[name];
    // Workbook content is immutable too; keep review policy and each unit's
    // understanding, personal note and schedule in the ordinary learning save.
    const worksKey = "vv4_works_" + owner;
    if (storage[worksKey]) {
      const works = JSON.parse(storage[worksKey]);
      if (!Array.isArray(works))
        throw Error("ワークの保存形式を確認できません。");
      const compact = [];
      for (const work of works) {
        if (deleted(owner, workKey(work.id))) continue;
        if (!Array.isArray(work.units) || work.unitsFileRef) {
          compact.push(work);
          continue;
        }
        const body = work.units.map((unit) =>
          Object.fromEntries(
            ["id", "num", "subNumber", "label", "q", "ans", "memo"]
              .filter((field) => Object.hasOwn(unit, field))
              .map((field) => [field, unit[field]]),
          ),
        );
        const packed = await packDraft(
          workKey(work.id),
          {
            master: body,
            emptyConfirmed: body.length === 0,
            savedAt: save.savedAt,
          },
          owner,
        );
        compact.push({
          ...work,
          unitsFileRef: packed.masterRef,
          units: work.units.map((unit) => {
            const learning = { ...unit };
            for (const field of [
              "num",
              "subNumber",
              "label",
              "q",
              "ans",
              "memo",
            ])
              delete learning[field];
            return learning;
          }),
        });
      }
      storage[worksKey] = JSON.stringify(compact);
    }
    return { ...save, data: { ...save.data, memory, localStorage: storage } };
  }
  async function prepareRestore(save, owner) {
    const memory = save.data?.memory;
    if (!memory) return;
    const worksKey = "vv4_works_" + owner,
      storage = save.data.localStorage || {};
    const localWorkMs = Number(localStorage.getItem(worksKey + "__ts")) || 0;
    const savedWorkMs =
      Number(storage[worksKey + "__ts"]) || Date.parse(save.savedAt || "") || 0;
    if (storage[worksKey] && localWorkMs <= savedWorkMs) {
      const works = JSON.parse(storage[worksKey]);
      for (const work of works) {
        if (!work.unitsFileRef || deleted(owner, workKey(work.id))) continue;
        const restored = await hydrate(
          workKey(work.id),
          {
            masterRef: work.unitsFileRef,
            emptyConfirmed: work.units.length === 0,
            savedAt: save.savedAt,
          },
          owner,
        );
        const byId = new Map(restored.master.map((unit) => [unit.id, unit]));
        work.units = work.units.map((unit) => {
          if (!byId.has(unit.id))
            throw Error("ワークの問題と学習記録が一致しません。");
          return { ...byId.get(unit.id), ...unit };
        });
        delete work.unitsFileRef;
      }
      storage[worksKey] = JSON.stringify(works);
    }
    const active = memory.vocabBookKey || memory.currentTextbook;
    for (const [book, draft] of Object.entries(memory.vocabBooks || {})) {
      if (deleted(owner, book) || !valid(draft.masterRef)) continue;
      check(owner, book);
      const previous = read(owner, book);
      if (
        !previous ||
        (Date.parse(previous.savedAt || "") || 0) <=
          (Date.parse(draft.savedAt || save.savedAt || "") || 0)
      ) {
        localStorage.setItem(
          key(owner, book),
          JSON.stringify({
            hash: draft.masterRef.hash,
            length: draft.masterRef.length,
            masterRef: draft.masterRef,
            savedAt: draft.savedAt || save.savedAt,
          }),
        );
      }
      // Other books keep only their references until the user opens them.
      if (book === active) {
        const restored = await hydrate(book, draft, owner);
        memory.vocabBooks[book] = restored;
        memory.vocabMaster = restored.master;
        memory.vocabEmptyConfirmed = restored.emptyConfirmed === true;
      }
    }
  }
  async function getWords(book) {
    const owner = ownerNow();
    check(owner, book);
    let draft = window.__manualVocabDrafts?.[book];
    if (draft?.masterRef && !Array.isArray(draft.master))
      draft = await hydrate(book, draft, owner);
    else
      draft =
        window.VocabMaster.resolve(book) || (await restoreBook(book, owner));
    if (!draft || !Array.isArray(draft.master)) return null;
    check(owner, book);
    if (typeof textbooksCacheMap !== "undefined")
      textbooksCacheMap[book] = draft.master;
    localStorage.setItem("core_v4_cache_" + book, JSON.stringify(draft.master));
    return draft.master;
  }
  // Flashcards can start from a different book without opening its word list.
  for (const name of ["__getBookMasterWords", "__fetchMasterWordsForBook"]) {
    const original = window[name];
    if (typeof original !== "function") continue;
    window[name] = async function (book) {
      const local = await getWords(book);
      return local || original.apply(this, arguments);
    };
  }
  async function remove(owner, book) {
    const db = await open();
    const prefix =
      JSON.stringify(book === undefined ? [owner] : [owner, book]).slice(
        0,
        -1,
      ) + ",";
    await new Promise((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").delete(
        IDBKeyRange.bound(prefix, prefix + "\uffff"),
      );
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
    });
    if (book !== undefined) localStorage.removeItem(key(owner, book));
    else
      for (const name of Object.keys(localStorage))
        if (
          name.startsWith(
            "core_v4_textbook_file_" + encodeURIComponent(owner) + "_",
          )
        )
          localStorage.removeItem(name);
  }
  window.TextbookFiles = {
    workKey,
    getWords,
    cache,
    packDraft,
    packSave,
    hydrate,
    restoreBook,
    prepareRestore,
    remove,
  };
})();
