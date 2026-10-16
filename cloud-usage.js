// Device-local estimates. Never calls Firestore to report Firestore usage.
(function (root) {
  "use strict";
  const KEY = "aiglish_cloud_usage_v1",
    wrapped = new WeakSet();
  let timer;
  let state;
  try {
    state = JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {}
  if (
    !state ||
    state.version !== 1 ||
    !state.days ||
    typeof state.days !== "object" ||
    Array.isArray(state.days)
  )
    state = { version: 1, days: {} };
  const day = () =>
    new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  function category(path = "") {
    if (/studyGroups/.test(path))
      return /messages/.test(path) ? "グループチャット" : "グループ";
    if (/wordDuel|duelRooms/i.test(path)) return "単語バトル";
    if (/publicVocabNotes|vocab_note_presence/.test(path)) return "共有メモ";
    if (/vocabProgress|vocabBooks|\/saves|\/sync/.test(path))
      return "学習保存・教材";
    if (/users/.test(path)) return "ユーザー・ランキング";
    return "その他";
  }
  function record(kind, path, count = 1) {
    try {
      const date = day(),
        rows = state.days[date] || (state.days[date] = {}),
        label = category(path),
        row = rows[label] || (rows[label] = { reads: 0, writes: 0, errors: 0 });
      row[kind] =
        (Number.isFinite(row[kind]) ? row[kind] : 0) +
        Math.max(0, Number(count) || 0);
      for (const old of Object.keys(state.days).sort().slice(0, -14))
        delete state.days[old];
      if (!timer) timer = setTimeout(flush, 500);
    } catch {}
  }
  function flush() {
    clearTimeout(timer);
    timer = null;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }
  function mark(fn) {
    wrapped.add(fn);
    return fn;
  }
  function install() {
    for (const name of [
      "fbGetDoc",
      "fbGetDocFromServer",
      "fbGetDocs",
      "fbSetDoc",
      "fbDeleteDoc",
    ]) {
      const fn = root[name];
      if (typeof fn !== "function" || wrapped.has(fn)) continue;
      root[name] = mark(async function (ref, ...args) {
        try {
          const result = await fn.call(this, ref, ...args);
          if (name.startsWith("fbGet")) {
            if (!result?.metadata?.fromCache)
              record(
                "reads",
                ref?.path || ref?._query?.path?.canonicalString?.(),
                result?.docs ? Math.max(1, result.docs.length) : 1,
              );
          } else record("writes", ref?.path);
          return result;
        } catch (e) {
          record("errors", ref?.path);
          throw e;
        }
      });
    }
    const tx = root.fbRunTransaction;
    if (typeof tx === "function" && !wrapped.has(tx))
      root.fbRunTransaction = mark(async function (db, callback, ...args) {
        let writes;
        try {
          const result = await tx.call(
            this,
            db,
            async (transaction) => {
              writes = [];
              const proxy = {
                get: async (ref) => {
                  const snap = await transaction.get(ref);
                  record("reads", ref?.path);
                  return snap;
                },
                set: (ref, ...values) => {
                  writes.push(ref?.path);
                  transaction.set(ref, ...values);
                  return proxy;
                },
                update: (ref, ...values) => {
                  writes.push(ref?.path);
                  transaction.update(ref, ...values);
                  return proxy;
                },
                delete: (ref) => {
                  writes.push(ref?.path);
                  transaction.delete(ref);
                  return proxy;
                },
              };
              return callback(proxy);
            },
            ...args,
          );
          for (const path of writes || []) record("writes", path);
          return result;
        } catch (e) {
          record("errors", "transaction");
          throw e;
        }
      });
    const listen = root.fbOnSnapshot;
    if (typeof listen === "function" && !wrapped.has(listen))
      root.fbOnSnapshot = mark(function (ref, next, error) {
        return listen.call(
          this,
          ref,
          (snap) => {
            if (!snap?.metadata?.fromCache) {
              const changes =
                typeof snap.docChanges === "function"
                  ? snap.docChanges()
                  : null;
              record(
                "reads",
                ref?.path || ref?._query?.path?.canonicalString?.(),
                changes
                  ? changes.filter((c) => !c.doc.metadata?.hasPendingWrites)
                      .length
                  : snap.metadata?.hasPendingWrites
                    ? 0
                    : 1,
              );
            }
            next(snap);
          },
          (e) => {
            record("errors", ref?.path);
            error?.(e);
          },
        );
      });
  }
  const nativeFetch = root.fetch;
  if (nativeFetch)
    root.fetch = async function (input, options) {
      const url = typeof input === "string" ? input : input?.url;
      if (
        !/^https:\/\/firestore.googleapis.com\/v1\/projects\//.test(url || "")
      )
        return nativeFetch.call(this, input, options);
      let path = url;
      try {
        const request = JSON.parse(options?.body || "{}");
        path =
          request.structuredQuery?.from?.[0]?.collectionId ||
          request.documents?.[0] ||
          url;
        const response = await nativeFetch.call(this, input, options);
        if (!response.ok) {
          record("errors", path);
          return response;
        }
        if (options?.method !== "POST" && !/\/documents\//.test(url))
          return response;
        const json = response.json.bind(response);
        let counted = false;
        response.json = async function () {
          const data = await json();
          if (!counted) {
            counted = true;
            try {
              record(
                "reads",
                path,
                Array.isArray(data)
                  ? Math.max(
                      1,
                      data.filter(
                        (row) => row.document || row.found || row.missing,
                      ).length,
                    )
                  : 1,
              );
            } catch {}
          }
          return data;
        };
        return response;
      } catch (e) {
        record("errors", path);
        throw e;
      }
    };
  root.CloudUsage = {
    install,
    flush,
    snapshot: () => JSON.parse(JSON.stringify(state)),
    category,
  };
  root.addEventListener?.("pagehide", flush);
})(window);
