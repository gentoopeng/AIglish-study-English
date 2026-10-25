// Durable daily target rewards. Transactions credit only the difference, even across devices.
(function () {
  "use strict";
  const owner = () => (typeof myId === "string" && myId ? myId : "GUEST-000");
  const key = (id) => "core_v4_study_points_" + id;
  let running = null;
  const policy = () => window.StudyPointPolicy;
  const level = (v) =>
    v === true ? 10 : Number.isSafeInteger(v) && v >= 0 ? v : 0;
  const entryAmount = (e) =>
    Number.isSafeInteger(e?.amount) && e.amount >= 0 && e.amount <= 1440
      ? e.amount
      : 0;
  function maps(...sources) {
    const result = {};
    for (const source of sources)
      for (const [token, value] of Object.entries(source || {}))
        result[token] = Math.max(level(result[token]), level(value));
    return result;
  }
  function pendingMerge(...sources) {
    const result = {};
    for (const source of sources)
      for (const [token, entry] of Object.entries(source || {})) {
        const old = result[token];
        if (!old || entryAmount(entry) > entryAmount(old))
          result[token] = entry;
        if (entry?.source === "time" && old)
          result[token] = {
            ...result[token],
            time: policy().mergeTime(old.time, entry.time),
            fingerprint:
              JSON.stringify(old.time) === JSON.stringify(entry.time)
                ? result[token].fingerprint
                : undefined,
          };
      }
    return result;
  }
  function validEntry(entry) {
    const source = entry?.source || "review";
    return (
      !!entry &&
      typeof entry.book === "string" &&
      typeof entry.num === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(entry.day || "") &&
      (source === "time"
        ? entryAmount(entry) > 0 && policy()?.mature(entry.day)
        : !!policy()?.allowed(source, entry.amount))
    );
  }
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
        if (!validEntry(entry)) continue;
        if (result[token] && entryAmount(result[token]) > entryAmount(entry))
          continue;
        const { time, fingerprint, ...summary } = entry;
        result[token] = {
          ...summary,
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
      pending: pendingMerge(b.pending, a.pending),
      claims: maps(b.claims, a.claims),
      settled: maps(b.settled, a.settled),
      history: history(b.history, a.history),
      publishedRevision: Number(newest.publishedRevision) || 0,
      timeSent: { ...b.timeSent, ...a.timeSent },
      timeAck: { ...b.timeAck, ...a.timeAck },
    };
    // Confirmed recent receipts from another device also acknowledge an old local intent.
    for (const confirmed of [a, b])
      for (const [token, entry] of Object.entries(confirmed.history || {})) {
        if (!confirmed.pending?.[token] && validEntry(entry))
          result.settled[token] = Math.max(
            level(result.settled[token]),
            entry.amount,
          );
      }
    for (const [token, entry] of Object.entries(result.pending))
      if (
        entry.source === "time"
          ? entry.fingerprint && result.timeAck[token] === entry.fingerprint
          : level(result.settled[token]) >= entryAmount(entry)
      )
        delete result.pending[token];
    const recovered = {};
    for (const token of Object.keys(result.claims)) {
      try {
        const [day, book, num] = JSON.parse(token);
        const amount = level(result.claims[token]);
        if (book === "@study-time" || [1, 3, 10].includes(amount))
          recovered[token] = {
            day,
            book,
            num,
            amount,
            at: 0,
            source:
              book === "@study-time"
                ? "time"
                : amount === 10
                  ? "review"
                  : amount === 3
                    ? "quiz"
                    : book.startsWith("@work/")
                      ? "work"
                      : "card",
          };
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
  function awardTarget(entry, id = owner()) {
    if (id !== owner() || !validEntry(entry))
      throw Error("ポイントの記録先を確認してください。");
    const value = read(id),
      token = receipt(entry.book, entry.num, entry.day);
    const before = Math.max(
      level(value.claims[token]),
      level(value.settled[token]),
      entryAmount(value.pending[token]),
    );
    const target = entry.amount;
    // Time data may need merging on a second device even if its local target is unchanged.
    if (target <= before && entry.source !== "time") return 0;
    const previous = value.pending[token];
    if (entry.source === "time" && previous) {
      const combined = policy().mergeTime(previous.time, entry.time);
      if (JSON.stringify(combined) !== JSON.stringify(entry.time))
        entry.fingerprint = undefined;
      entry.time = combined;
      entry.amount = Math.max(target, policy().timeMinutes(entry.time));
    }
    value.claims[token] = Math.max(before, entry.amount);
    value.history = history(value.history, { [token]: entry });
    if (id === "GUEST-000") {
      value.balance += Math.max(0, entry.amount - before);
      value.settled[token] = Math.max(
        level(value.settled[token]),
        entry.amount,
      );
      value.revision++;
    } else {
      if (entry.amount > level(value.settled[token]) || entry.source === "time")
        value.pending[token] = entry;
    }
    const cutoff = (policy()?.day || window.WeakReviewModel.day)(
      Date.now() - 8 * 86400000,
    );
    for (const item of Object.keys(value.claims)) {
      try {
        if (JSON.parse(item)[0] < cutoff && !value.pending[item]) {
          delete value.claims[item];
          delete value.settled[item];
        }
      } catch {}
    }
    write(id, value);
    window.queueBackgroundSave?.();
    return Math.max(0, entry.amount - before);
  }
  function reward(source, book, num, id = owner(), metadata = {}) {
    const date = (policy()?.day || window.WeakReviewModel.day)();
    if (
      id !== owner() ||
      window.__learningBootReady === false ||
      typeof book !== "string" ||
      !book ||
      num === undefined ||
      num === null ||
      (source !== "work" &&
        window.LearningData &&
        !window.LearningData.canSave(book)) ||
      (source !== "work" && window.LibraryState?.isDeleted("book", book, id)) ||
      (source === "work" && window.LibraryState?.isDeleted("work", book, id))
    )
      throw Error("学習の記録先を確認してください。");
    const amount = (policy()?.rates || { review: 2 })[source];
    if (!amount) throw Error("ポイントの獲得方法を確認してください。");
    return awardTarget(
      {
        source,
        book: source === "work" ? "@work/" + book : book,
        num: String(num),
        day: date,
        amount,
        at: Date.now(),
        bookName: String(metadata.bookName || book).slice(0, 120),
        word: String(metadata.word || "").slice(0, 120),
      },
      id,
    );
  }
  function award(book, num, date, id = owner(), metadata = {}) {
    if (date !== (policy()?.day || window.WeakReviewModel.day)())
      throw Error("復習日を確認してください。");
    return reward("review", book, num, id, metadata);
  }
  function pendingAmount(value) {
    return Object.entries(value.pending || {}).reduce(
      (sum, [token, entry]) =>
        sum + Math.max(0, entryAmount(entry) - level(value.settled?.[token])),
      0,
    );
  }
  function balance(id = owner()) {
    const value = read(id);
    return value.balance + pendingAmount(value);
  }
  async function collectTime(id = owner()) {
    if (id !== owner() || !policy()) return;
    const ledger = window.StudyTime?.snapshot();
    if (!ledger) return;
    for (const [day, data] of Object.entries(ledger.days || {})) {
      if (!data.pointTime || !policy().mature(day)) continue;
      const time = policy().mergeTime(data.pointTime),
        amount = policy().timeMinutes(time);
      if (!amount) continue;
      const entry = {
        source: "time",
        day,
        book: "@study-time",
        num: "minutes",
        amount,
        time,
        at: Date.now(),
        bookName: "実測の勉強時間",
        word: day + "の勉強時間",
      };
      const token = receipt(entry.book, entry.num, day),
        value = read(id);
      // One upload per changed measurement, never per timer tick or per dialog open.
      const fingerprint = await digest(JSON.stringify(time));
      if (id !== owner()) return;
      if (value.timeSent?.[day] === fingerprint) continue;
      entry.fingerprint = fingerprint;
      awardTarget(entry, id);
      // Keep this marker in the backed-up wallet; receipt transactions still deduplicate after restore.
      const next = read(id);
      next.timeSent = { ...next.timeSent, [day]: fingerprint };
      write(id, next);
    }
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
    await collectTime(id);
    if (id !== owner()) return false;
    if (id === "GUEST-000") return true;
    if (running) return running;
    if (
      !window.db ||
      !window.fbRunTransaction ||
      window.FirestoreReadGuard?.paused?.()
    )
      return false;
    const execute = async () => {
      const bookHashes = new Map();
      // Small groups keep mobile transactions bounded, including after offline sessions.
      while (id === owner()) {
        const entries = Object.entries(read(id).pending).slice(0, 40);
        if (!entries.length) return publish(id);
        const groups = new Map();
        for (const [token, item] of entries) {
          if (
            !validEntry(item) ||
            token !== receipt(item.book, item.num, item.day)
          )
            throw Error("ポイントの未同期記録を確認してください。");
          // Numbered books normally share one bounded shard for each 512 words.
          const hash = bookHashes.get(item.book) || (await digest(item.book)),
            bucket = /^\d+$/.test(item.num)
              ? Math.floor(Number(item.num) / 512)
              : "s" + (parseInt((await digest(item.num)).slice(0, 2), 16) % 16);
          bookHashes.set(item.book, hash);
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
          const confirmed = read(id);
          if (
            (!walletSnap.exists() && confirmed.balance > 0) ||
            (wallet.revision || 0) < confirmed.revision ||
            (wallet.balance || 0) < confirmed.balance
          )
            throw Error(
              "確定済みポイントより古いクラウド記録のため、残高を保持して同期を停止しました。",
            );
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
              const old = claims[item.num],
                oldAmount =
                  typeof old === "object" ? entryAmount(old) : level(old);
              const time =
                item.source === "time"
                  ? policy().mergeTime(old?.time, item.time)
                  : null;
              const target = time ? policy().timeMinutes(time) : item.amount;
              const amount = Math.max(oldAmount, target);
              if (
                amount > oldAmount ||
                (time &&
                  JSON.stringify(time) !== JSON.stringify(old?.time || {}))
              ) {
                claims[item.num] = {
                  amount,
                  at: Number(item.at) || 0,
                  source: item.source || "review",
                  bookName: String(item.bookName || item.book).slice(0, 120),
                  word: String(item.word || "").slice(0, 120),
                  ...(time ? { time } : {}),
                };
                delta += amount - oldAmount;
                changed = true;
              }
              const stored = claims[item.num];
              earned[token] = {
                ...item,
                ...(typeof stored === "object"
                  ? stored
                  : {
                      at: 0,
                      source:
                        oldAmount === 10
                          ? "review"
                          : oldAmount === 3
                            ? "quiz"
                            : item.source,
                    }),
                amount,
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
            acknowledged: Object.fromEntries(
              Object.entries(earned).map(([token, item]) => [
                token,
                item.amount,
              ]),
            ),
          };
          if (
            delta ||
            JSON.stringify(value.history) !==
              JSON.stringify(wallet.history || {})
          )
            tx.set(walletRef, {
              balance: value.balance,
              revision: value.revision,
              history: value.history,
            });
          tx.set(
            window.fbDoc(window.db, "users", id),
            { studyPoints: value.balance },
            { merge: true },
          );
          return value;
        });
        if (id !== owner()) return false;
        const latest = read(id);
        for (const [token, sent] of entries) {
          if (sent.source === "time" && sent.fingerprint)
            latest.timeAck[token] = sent.fingerprint;
          const amount = result.acknowledged[token];
          latest.settled[token] = Math.max(
            level(latest.settled[token]),
            amount,
          );
          latest.claims[token] = Math.max(level(latest.claims[token]), amount);
          if (
            entryAmount(latest.pending[token]) <= amount &&
            (latest.pending[token]?.source !== "time" ||
              JSON.stringify(latest.pending[token].time) ===
                JSON.stringify(sent.time))
          )
            delete latest.pending[token];
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
          "学習ポイントは端末に保持し、次の保存時に同期します",
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
      window.FirestoreReadGuard?.paused?.()
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
      window.FirestoreReadGuard?.paused?.()
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
    reward,
    pendingAmount,
    collectTime,
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
