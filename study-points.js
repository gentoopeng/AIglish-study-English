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
      ["claims", "pending", "settled"].some(
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
    };
    for (const token of Object.keys(result.settled))
      delete result.pending[token];
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
  }
  function receipt(book, num, date) {
    return JSON.stringify([date, book, String(num)]);
  }
  function award(book, num, date, id = owner()) {
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
    if (id === "GUEST-000") value.balance += 10;
    else value.pending[token] = { book, num: String(num), day: date };
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
        if (!entries.length) return true;
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
          for (const shard of shards) {
            validate(shard.data);
            const claims = { ...shard.data.claims };
            let changed = false;
            for (const [, item] of shard.claims)
              if (!Object.hasOwn(claims, item.num)) {
                claims[item.num] = 10;
                delta += 10;
                changed = true;
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
          };
          if (delta) tx.set(walletRef, value);
          return value;
        });
        if (id !== owner()) return false;
        const latest = read(id);
        for (const [token] of entries) {
          delete latest.pending[token];
          latest.settled[token] = true;
        }
        if (result.revision >= latest.revision) Object.assign(latest, result);
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
  window.StudyPoints = { award, balance, flush, merge, read, key };
})();
