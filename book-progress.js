// book-progress.js —— 単語帳の進行度を、フレンドが見られる形で公開する (10.174).
// Word-level ratings stay in the owner's private vocabProgress collection. What other
// players may see is only a summary per book — name, size, how many words are fully
// learned, the percent, and the ○/△/✕/ー counts behind a donut chart — written to the
// owner's user document as bookProgressJson, the same pattern as the other public
// stats (userStatsJson, learningRankingV2Json). A word counts as learned when every
// meaning on it is rated ok. The book's 詳細 popup compares everyone's donuts
// (10.176). Pure helpers are exported for tests.
(function (root) {
  "use strict";

  function wordLearned(entry) {
    if (!entry || typeof entry !== "object") return false;
    const meanings = entry.meanings && typeof entry.meanings === "object" ? Object.values(entry.meanings) : [];
    if (meanings.length) return meanings.every((m) => m && m.status === "ok");
    return entry.status === "ok";
  }

  // progress: { [num]: entry } for one book; total: the book's word count;
  // meaningsTotal: how many meanings the whole book has (the donut's denominator —
  // the owner's own donut counts meanings, so friends' donuts do the same).
  function summarizeBook(book, progress, total, at, meaningsTotal) {
    const entries = progress && typeof progress === "object" ? Object.values(progress).filter((e) => e && typeof e === "object" && ("meanings" in e || "status" in e)) : [];
    const size = Number(total) || 0;
    if (!book || !book.id || size <= 0 || !entries.length) return null;
    const done = entries.filter(wordLearned).length;
    const counts = { ok: 0, so: 0, bad: 0, none: 0, total: Number(meaningsTotal) || size };
    for (const e of entries) {
      const ms = e.meanings && typeof e.meanings === "object" ? Object.values(e.meanings) : [];
      if (ms.length) for (const m of ms) { if (m && counts[m.status] !== undefined && m.status !== "none") counts[m.status]++; }
      else if (e.status && counts[e.status] !== undefined && e.status !== "none") counts[e.status]++;
    }
    counts.none = Math.max(0, counts.total - counts.ok - counts.so - counts.bad);
    return {
      id: String(book.id),
      name: String(book.name || book.id).slice(0, 60),
      total: size,
      done,
      pct: Math.max(0, Math.min(100, Math.round((done / size) * 100))),
      at: Number(at) || 0,
      counts,
    };
  }

  // rows: [{ book, progress, total, at, meaningsTotal }] -> the public list, freshest first.
  function summarizeAll(rows, limit = 6) {
    return (Array.isArray(rows) ? rows : [])
      .map((r) => summarizeBook(r.book, r.progress, r.total, r.at, r.meaningsTotal))
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
      .map((b) => {
        const c = b.counts && typeof b.counts === "object" ? b.counts : null;
        const counts = c
          ? { ok: Math.max(0, Number(c.ok) || 0), so: Math.max(0, Number(c.so) || 0), bad: Math.max(0, Number(c.bad) || 0), none: Math.max(0, Number(c.none) || 0), total: Math.max(0, Number(c.total) || 0) }
          : null;
        return {
          id: String(b.id),
          name: String(b.name).slice(0, 60),
          total: Number(b.total) || 0,
          done: Math.max(0, Math.min(Number(b.total) || 0, Number(b.done) || 0)),
          pct: Math.max(0, Math.min(100, Number(b.pct) || 0)),
          at: Number(b.at) || 0,
          counts,
        };
      })
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
        meaningsTotal = 0,
        at = 0;
      try {
        const key = typeof window.getVocabProgressStorageKey === "function" ? window.getVocabProgressStorageKey(book.id) : null;
        if (key) {
          progress = JSON.parse(localStorage.getItem(key) || "null");
          at = Number(localStorage.getItem(key + "__ts")) || 0;
        }
        const master = JSON.parse(localStorage.getItem("core_v4_cache_" + book.id) || "null");
        if (Array.isArray(master)) {
          total = master.length;
          meaningsTotal = master.reduce((n, w) => n + (Array.isArray(w?.meanings) && w.meanings.length ? w.meanings.length : 1), 0);
        }
        if (!total && book.id === (typeof currentTextbook !== "undefined" ? currentTextbook : null) && typeof vocabList !== "undefined" && Array.isArray(vocabList)) {
          total = vocabList.length;
          meaningsTotal = vocabList.reduce((n, w) => n + (Array.isArray(w?.meanings) && w.meanings.length ? w.meanings.length : 1), 0);
        }
      } catch {}
      if (progress) rows.push({ book, progress, total, at, meaningsTotal });
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
  document.addEventListener("learning-data-ready", schedule);
  setTimeout(() => publish(true), 15000);
  root.BookProgress.publish = publish;
  root.BookProgress.summary = collect;

  // ---- friends' summaries, for the book detail popup's comparison (10.176) -------------
  const PEER_FIELDS = ["playerName", "avatar", "profileCustomizationJson", "bookProgressJson", "deleted"];
  const peerCache = { at: 0, rows: [] };
  async function fetchPeers() {
    const now = Date.now();
    if (now - peerCache.at < 60000) return peerCache.rows;
    peerCache.at = now;
    const ids = (typeof myFriendList !== "undefined" && Array.isArray(myFriendList) ? myFriendList : []).map((f) => String(f?.code || "")).filter((id) => id && id !== uid());
    if (!ids.length || uid() === "GUEST-000") {
      peerCache.rows = [];
      return peerCache.rows;
    }
    let docs = null;
    try {
      docs = (await root.UserDirectory?.byIds?.(ids, { fields: PEER_FIELDS })) || null;
    } catch {
      docs = null;
    }
    if (!Array.isArray(docs)) {
      docs = [];
      for (const id of ids) {
        try {
          const snap = await root.fbGetDoc(root.fbDoc(root.db, "users", id));
          if (snap.exists()) docs.push({ id, data: snap.data() });
        } catch {}
      }
    }
    peerCache.rows = docs
      .filter((d) => !d.data?.deleted)
      .map((d) => ({ id: d.id, name: d.data.playerName || d.id, avatar: d.data.avatar || "", custom: d.data.profileCustomizationJson, books: parse(d.data) }));
    return peerCache.rows;
  }
  // Everyone (10.185): players active in the last 30 days, for the detail popup's
  // all-users scope. Same small field mask as the friends read; cached a minute.
  const everyoneCache = { at: 0, rows: [] };
  async function fetchEveryone() {
    const now = Date.now();
    if (now - everyoneCache.at < 60000) return everyoneCache.rows;
    everyoneCache.at = now;
    if (uid() === "GUEST-000") {
      everyoneCache.rows = [];
      return everyoneCache.rows;
    }
    let docs = null;
    try {
      docs = (await root.UserDirectory?.recent?.(now - 30 * 86400000, [], { fields: PEER_FIELDS })) || null;
    } catch {
      docs = null;
    }
    if (!Array.isArray(docs)) {
      docs = [];
      try {
        await root.UserDirectory?.scan?.((id, data) => {
          docs.push({ id, data });
        });
      } catch {
        // The scan is time-boxed; whoever was read still counts.
      }
    }
    const seen = new Set();
    everyoneCache.rows = docs
      .filter((d) => d && d.id && d.id !== uid() && !d.data?.deleted && !seen.has(d.id) && seen.add(d.id))
      .map((d) => ({ id: d.id, name: d.data.playerName || d.id, avatar: d.data.avatar || "", custom: d.data.profileCustomizationJson, books: parse(d.data) }));
    return everyoneCache.rows;
  }
  root.BookProgress.peers = fetchPeers;
  root.BookProgress.everyone = fetchEveryone;
})(typeof window !== "undefined" ? window : globalThis);
