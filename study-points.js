// Local award intents survive offline use. A transaction settles each word/day once.
(function () {
  "use strict";
  const owner = () => (typeof myId === "string" && myId ? myId : "GUEST-000");
  const key = (id) => "core_v4_study_points_" + id;
  let running = null;
  function validate(value) {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      ["balance", "revision"].some(
        (field) =>
          value[field] !== undefined &&
          (!Number.isSafeInteger(value[field]) || value[field] < 0),
      ) ||
      ["claims", "pending", "settled", "history"].some(
        (field) =>
          value[field] !== undefined &&
          (!value[field] ||
            typeof value[field] !== "object" ||
            Array.isArray(value[field])),
      )
    )
      throw Error("ポイント記録が不正なため、上書きを停止しました。");
    return value;
  }
  function history(...sources) {
    const result = {};
    for (const source of sources)
      for (const [token, entry] of Object.entries(source || {})) {
        if (
          !entry ||
          typeof entry.book !== "string" ||
          typeof entry.num !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(entry.day || "") ||
          entry.amount !== 10
        )
          continue;
        result[token] = {
          ...entry,
          at: Number(entry.at) || 0,
          bookName: String(entry.bookName || entry.book).slice(0, 120),
          word: String(entry.word || "").slice(0, 120),
        };
      }
    return Object.fromEntries(
      Object.entries(result)
        .sort(
          (a, b) =>
            b[1].day.localeCompare(a[1].day) ||
            b[1].at - a[1].at ||
            a[0].localeCompare(b[0]),
        )
        .slice(0, 100),
    );
  }
  function merge(a = {}, b = {}) {
    validate(a);
    validate(b);
    const newest = (a.revision || 0) >= (b.revision || 0) ? a : b;
    const result = {
      balance: Number(newest.balance) || 0,
      revision: Number(newest.revision) || 0,
      pending: { ...b.pending, ...a.pending },
      claims: { ...b.claims, ...a.claims },
      settled: { ...b.settled, ...a.settled },
      history: history(b.history, a.history),
      publishedRevision: Number(newest.publishedRevision) || 0,
    };
    for (const token of Object.keys(result.settled))
      delete result.pending[token];
    const recovered = {};
    for (const token of Object.keys(result.claims)) {
      try {
        const [day, book, num] = JSON.parse(token);
        recovered[token] = { day, book, num, amount: 10, at: 0 };
      } catch {}
    }
    result.history = history(recovered, result.history);
    return result;
  }
  function read(id = owner()) {
    const value = JSON.parse(localStorage.getItem(key(id)) || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Error("ポイント記録を読み取れません。上書きを停止しました。");
    return merge(value);
  }
  function write(id, value) {
    localStorage.setItem(key(id), JSON.stringify(value));
    window.dispatchEvent?.(new Event("study-points-changed"));
  }
  function receipt(book, num, date) {
    return JSON.stringify([date, book, String(num)]);
  }
  function award(book, num, date, id = owner(), metadata = {}) {
    if (
      id !== owner() ||
      date !== window.WeakReviewModel.day() ||
      window.LibraryState?.isDeleted("book", book, id)
    )
      throw Error("復習の記録先を確認してください。");
    const value = read(id),
      token = receipt(book, num, date);
    if (value.claims[token]) return 0;
    value.claims[token] = true;
    const entry = {
      book,
      num: String(num),
      day: date,
      amount: 10,
      at: Date.now(),
      bookName: String(metadata.bookName || book).slice(0, 120),
      word: String(metadata.word || "").slice(0, 120),
    };
    value.history = history(value.history, { [token]: entry });
    if (id === "GUEST-000") value.balance += 10;
    else value.pending[token] = entry;
    // Keep recent deduplication markers; unpaid receipts are never pruned.
    const cutoff = window.WeakReviewModel.day(Date.now() - 8 * 86400000);
    for (const item of Object.keys(value.claims))
      if (JSON.parse(item)[0] < cutoff && !value.pending[item]) {
        delete value.claims[item];
        delete value.settled[item];
      }
    write(id, value);
    window.queueBackgroundSave?.();
    return 10;
  }
  function balance(id = owner()) {
    const value = read(id);
    return value.balance + Object.keys(value.pending).length * 10;
  }
  async function digest(value) {
    const bytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value),
    );
    return Array.from(new Uint8Array(bytes), (n) =>
      n.toString(16).padStart(2, "0"),
    ).join("");
  }
  async function flush(id = owner()) {
    if (id !== owner()) return false;
    if (id === "GUEST-000") return true;
    if (running) return running;
    if (
      !window.db ||
      !window.fbRunTransaction ||
      window.FirestoreReadGuard?.paused()
    )
      return false;
    const execute = async () => {
      // Small groups keep mobile transactions bounded, including after offline sessions.
      while (id === owner()) {
        const entries = Object.entries(read(id).pending).slice(0, 40);
        if (!entries.length) return publish(id);
        const groups = new Map();
        for (const [token, item] of entries) {
          // Numbered books normally share one bounded shard for each 512 words.
          const hash = await digest(item.book),
            bucket = /^\d+$/.test(item.num)
              ? Math.floor(Number(item.num) / 512)
              : "s" + (parseInt((await digest(item.num)).slice(0, 2), 16) % 16);
          const name = item.day + "_" + hash + "_" + bucket;
          if (!groups.has(name)) groups.set(name, []);
          groups.get(name).push([token, item]);
        }
        const result = await window.fbRunTransaction(window.db, async (tx) => {
          if (id !== owner()) throw Error("アカウントが変更されました。");
          const walletRef = window.fbDoc(
            window.db,
            "users",
            id,
            "learningPoints",
            "main",
          );
          const walletSnap = await tx.get(walletRef),
            wallet = validate(walletSnap.exists() ? walletSnap.data() : {});
          const shards = [];
          for (const [name, claims] of groups) {
            const ref = window.fbDoc(
                window.db,
                "users",
                id,
                "reviewPointDays",
                name,
              ),
              snap = await tx.get(ref);
            shards.push({
              ref,
              claims,
              data: snap.exists() ? snap.data() : {},
            });
          }
          if (id !== owner()) throw Error("アカウントが変更されました。");
          let delta = 0;
          const earned = {};
          for (const shard of shards) {
            validate(shard.data);
            const claims = { ...shard.data.claims };
            let changed = false;
            for (const [token, item] of shard.claims) {
              if (!Object.hasOwn(claims, item.num)) {
                claims[item.num] = {
                  amount: 10,
                  at: Number(item.at) || 0,
                  bookName: String(item.bookName || item.book).slice(0, 120),
                  word: String(item.word || "").slice(0, 120),
                };
                delta += 10;
                changed = true;
              }
              const stored = claims[item.num];
              earned[token] = {
                ...item,
                ...(typeof stored === "object" ? stored : { at: 0 }),
                amount: 10,
              };
            }
            if (changed)
              tx.set(shard.ref, {
                claims,
                day: shard.claims[0][1].day,
                book: shard.claims[0][1].book,
              });
          }
          const value = {
            balance: (Number(wallet.balance) || 0) + delta,
            revision: (Number(wallet.revision) || 0) + (delta ? 1 : 0),
            history: history(earned, wallet.history),
          };
          if (
            delta ||
            JSON.stringify(value.history) !==
              JSON.stringify(wallet.history || {})
          )
            tx.set(walletRef, value);
          tx.set(
            window.fbDoc(window.db, "users", id),
            { studyPoints: value.balance },
            { merge: true },
          );
          return value;
        });
        if (id !== owner()) return false;
        const latest = read(id);
        for (const [token] of entries) {
          delete latest.pending[token];
          latest.settled[token] = true;
        }
        latest.history = history(latest.history, result.history);
        if (result.revision >= latest.revision) {
          latest.balance = result.balance;
          latest.revision = result.revision;
          latest.publishedRevision = result.revision;
        }
        write(id, latest);
      }
      return false;
    };
    running = execute()
      .catch((error) => {
        console.warn(
          "復習ポイントは端末に保持し、次の保存時に同期します",
          error,
        );
        return false;
      })
      .finally(() => {
        running = null;
      });
    return running;
  }
  async function publish(id = owner()) {
    if (id !== owner()) return false;
    const local = read(id);
    if (
      !local.revision ||
      local.publishedRevision >= local.revision ||
      id === "GUEST-000"
    )
      return true;
    if (
      !window.db ||
      !window.fbRunTransaction ||
      window.FirestoreReadGuard?.paused()
    )
      return false;
    const remote = await window.fbRunTransaction(window.db, async (tx) => {
      const snap = await tx.get(
        window.fbDoc(window.db, "users", id, "learningPoints", "main"),
      );
      if (!snap.exists() || id !== owner()) return null;
      const data = validate(snap.data());
      tx.set(
        window.fbDoc(window.db, "users", id),
        { studyPoints: Number(data.balance) || 0 },
        { merge: true },
      );
      return data;
    });
    if (id !== owner() || !remote) return false;
    const next = merge(remote, read(id));
    next.publishedRevision = Number(remote.revision) || 0;
    write(id, next);
    return true;
  }
  async function refresh(id = owner(), knownPublicBalance) {
    if (
      id !== owner() ||
      id === "GUEST-000" ||
      !window.db ||
      !window.fbGetDoc ||
      window.FirestoreReadGuard?.paused()
    )
      return false;
    const snap = await window.fbGetDoc(
      window.fbDoc(window.db, "users", id, "learningPoints", "main"),
    );
    if (id !== owner()) return false;
    if (snap.exists()) {
      const remote = validate(snap.data()),
        local = read(id);
      if (
        !Object.keys(remote.history || {}).length &&
        !Object.keys(local.history || {}).length &&
        window.fbGetDocs &&
        window.fbQuery &&
        window.fbOrderBy &&
        window.fbLimit
      ) {
        const records = await window.fbGetDocs(
          window.fbQuery(
            window.fbCollection(window.db, "users", id, "reviewPointDays"),
            window.fbOrderBy("day", "desc"),
            window.fbLimit(5),
          ),
        );
        if (id !== owner()) return false;
        const recovered = {};
        for (const doc of records.docs || []) {
          const data = doc.data();
          for (const [num, claim] of Object.entries(data.claims || {}))
            recovered[receipt(data.book, num, data.day)] = {
              day: data.day,
              book: data.book,
              num,
              amount: 10,
              ...(typeof claim === "object" ? claim : { at: 0 }),
            };
        }
        remote.history = history(recovered);
      }
      const next = merge(remote, local);
      if ((remote.revision || 0) >= (local.revision || 0)) {
        next.balance = Number(remote.balance) || 0;
        next.revision = Number(remote.revision) || 0;
      }
      if (knownPublicBalance === next.balance)
        next.publishedRevision = next.revision;
      write(id, next);
      // Re-read inside the publication transaction so a concurrent award cannot regress the total.
      if (
        local.publishedRevision !== next.revision &&
        knownPublicBalance !== next.balance
      )
        await publish(id);
    }
    return true;
  }
  function observe(doc) {
    const id = owner();
    if (
      id === "GUEST-000" ||
      !Number.isSafeInteger(doc.studyPoints) ||
      doc.studyPoints <= read(id).balance
    )
      return;
    refresh(id, doc.studyPoints).catch((error) =>
      console.warn("ポイントは端末の記録を表示します", error),
    );
  }
  function restore(value, id = owner()) {
    if (id !== owner()) throw Error("アカウントが変更されました。");
    const next = merge(read(id), value);
    write(id, next);
    return next;
  }
  window.StudyPoints = {
    restore,
    award,
    balance,
    flush,
    merge,
    read,
    key,
    refresh,
    history,
    publish,
    observe,
  };
})();
