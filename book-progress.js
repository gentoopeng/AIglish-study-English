// book-progress.js —— 単語帳の進行度を、フレンドが見られる形で公開する (10.174).
// Word-level ratings stay in the owner's private vocabProgress collection. What other
// players may see is only a summary per book — name, size, how many words are fully
// learned and the percent — written to the owner's user document as bookProgressJson,
// the same pattern as the other public stats (userStatsJson, learningRankingV2Json).
// A word counts as learned when every meaning on it is rated ok (or the word itself is,
// for books without per-meaning ratings). Pure helpers are exported for tests.
(function (root) {
  "use strict";

  function wordLearned(entry) {
    if (!entry || typeof entry !== "object") return false;
    const meanings = entry.meanings && typeof entry.meanings === "object" ? Object.values(entry.meanings) : [];
    if (meanings.length) return meanings.every((m) => m && m.status === "ok");
    return entry.status === "ok";
  }

  // progress: { [num]: entry } for one book; total: the book's word count.
  function summarizeBook(book, progress, total, at) {
    const entries = progress && typeof progress === "object" ? Object.values(progress).filter((e) => e && typeof e === "object" && ("meanings" in e || "status" in e)) : [];
    const size = Number(total) || 0;
    if (!book || !book.id || size <= 0 || !entries.length) return null;
    const done = entries.filter(wordLearned).length;
    return {
      id: String(book.id),
      name: String(book.name || book.id).slice(0, 60),
      total: size,
      done,
      pct: Math.max(0, Math.min(100, Math.round((done / size) * 100))),
      at: Number(at) || 0,
    };
  }

  // rows: [{ book, progress, total, at }] -> the public list, freshest first.
  function summarizeAll(rows, limit = 6) {
    return (Array.isArray(rows) ? rows : [])
      .map((r) => summarizeBook(r.book, r.progress, r.total, r.at))
      .filter(Boolean)
      .sort((a, b) => b.at - a.at || b.pct - a.pct)
      .slice(0, limit);
  }

  // A user document (or its parsed fields) -> the public progress list.
  function parse(doc) {
    let value = doc && typeof doc === "object" ? doc.bookProgressJson : null;
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        return [];
      }
    }
    if (!Array.isArray(value)) return [];
    return value
      .filter((b) => b && b.id && b.name && Number(b.total) > 0)
      .map((b) => ({
        id: String(b.id),
        name: String(b.name).slice(0, 60),
        total: Number(b.total) || 0,
        done: Math.max(0, Math.min(Number(b.total) || 0, Number(b.done) || 0)),
        pct: Math.max(0, Math.min(100, Number(b.pct) || 0)),
        at: Number(b.at) || 0,
      }))
      .slice(0, 6);
  }

  const api = { wordLearned, summarizeBook, summarizeAll, parse };
  root.BookProgress = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window === "undefined" || root !== window) return;

  // ---- publishing (this device, this player) -------------------------------------------
  const uid = () => (typeof myId === "string" && myId ? myId : "GUEST-000");
  let lastJson = "",
    lastAt = 0,
    timer = null;

  function collect() {
    const pool = typeof textbooksPool !== "undefined" && Array.isArray(textbooksPool) ? textbooksPool : [];
    const rows = [];
    for (const book of pool) {
      if (!book || !book.id) continue;
      let progress = null,
        total = 0,
        at = 0;
      try {
        const key = typeof window.getVocabProgressStorageKey === "function" ? window.getVocabProgressStorageKey(book.id) : null;
        if (key) {
          progress = JSON.parse(localStorage.getItem(key) || "null");
          at = Number(localStorage.getItem(key + "__ts")) || 0;
        }
        const master = JSON.parse(localStorage.getItem("core_v4_cache_" + book.id) || "null");
        if (Array.isArray(master)) total = master.length;
        if (!total && book.id === (typeof currentTextbook !== "undefined" ? currentTextbook : null) && typeof vocabList !== "undefined" && Array.isArray(vocabList)) total = vocabList.length;
      } catch {}
      if (progress) rows.push({ book, progress, total, at });
    }
    return summarizeAll(rows);
  }

  async function publish(force) {
    const me = uid();
    if (me === "GUEST-000" || !window.db || !window.fbDoc) return;
    const now = Date.now();
    if (!force && now - lastAt < 60000) return;
    const list = collect();
    const json = JSON.stringify(list);
    if (json === lastJson) {
      lastAt = now;
      return;
    }
    lastAt = now;
    try {
      const write = window.fbSetDocWithRetry || window.fbSetDoc;
      if (!write) return;
      await write(window.fbDoc(window.db, "users", me), { bookProgressJson: json }, { merge: true });
      lastJson = json;
    } catch {}
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      publish(false);
    }, 5000);
  }

  // Republish shortly after ratings change, and keep a slow heartbeat while studying.
  if (typeof window.saveVocabProgressLocally === "function") {
    const original = window.saveVocabProgressLocally;
    window.saveVocabProgressLocally = function () {
      const result = original.apply(this, arguments);
      schedule();
      return result;
    };
  }
  setInterval(() => {
    if (document.visibilityState === "visible") publish(false);
  }, 90000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") publish(true);
  });
  setTimeout(() => publish(true), 15000);
  root.BookProgress.publish = publish;
})(typeof window !== "undefined" ? window : globalThis);
