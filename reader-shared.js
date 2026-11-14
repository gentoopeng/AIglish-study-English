// Shared explanations (長文解析の「問題」): the explanation of a passage's questions, kept in the cloud so other people can see it
// (and so the same questions are not solved by the AI again). Under  readerExplanations/{passageKey}/sets/{setKey}.
//  - The passage itself is NOT uploaded; its key is a hash of the normalised text. A set holds the questions, answers and explanations
//    with the maker's id and name. Pictures and cut-out figures are never uploaded.
//  - Costs: nothing is read until it is asked for (the button "みんなの解説を見る", or typed questions at the moment of analysis: one query
//    that returns at most one document). Lists are kept on the device for 6 hours. A set is written once (create if absent).
//  - Rules are open, so every guard here is a courtesy, not protection: what comes back is checked and cut to size before it is shown.
(function () {
  "use strict";
  const ON_KEY = "aiglish_reader_share", MINE_KEY = "aiglish_reader_shared_mine", HIDDEN_KEY = "aiglish_reader_shared_hidden", CACHE_KEY = "aiglish_reader_shared_cache";
  const TTL = 6 * 3600 * 1000, CACHE_MAX = 15, LIST_LIMIT = 5, DOC_LIMIT = 200000;
  const jsonGet = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key) || "null"); return v == null ? fallback : v; } catch { return fallback; } };
  const jsonSet = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const me = () => (typeof myId === "string" ? myId : "");
  const signedIn = () => !!me() && me() !== "GUEST-000";
  const reachable = () => !!(window.db && window.fbDoc && window.fbGetDocs && window.fbCollection);
  const enabled = () => localStorage.getItem(ON_KEY) !== "0";
  const setEnabled = (on) => { try { on ? localStorage.removeItem(ON_KEY) : localStorage.setItem(ON_KEY, "0"); } catch {} };
  const usable = () => enabled() && signedIn() && reachable();

  // The key of a text: normalised (so a different line break, quote or dash does not matter), versioned (n1), SHA-256 cut to 24 hex.
  function normalise(text) {
    return String(text || "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, "");
  }
  async function digest(text) {
    try {
      if (window.crypto && crypto.subtle) {
        const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
        return [...bytes.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
      }
    } catch { /* fall through */ }
    let a = 2166136261, b = 5381;
    for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ text.charCodeAt(i); }
    return ((a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0")).padEnd(24, "0");
  }
  const keyOf = async (text) => "n1" + (await digest(normalise(text)));
  const questionsKey = (result) => keyOf((result.questions || []).map((q) => q.question).join("|"));

  // What comes back from the cloud: only plain text, cut to size, one correct choice per choice question. null when it does not fit.
  function clean(data) {
    if (!data || typeof data !== "object" || data.v !== 1 || !Array.isArray(data.questions) || !data.questions.length || data.questions.length > 30) return null;
    const bad = /^\s*(data:|javascript:|https?:)/i;
    const str = (v, n) => { const s = String(v == null ? "" : v).slice(0, n); return bad.test(s) ? "" : s; };
    const questions = data.questions.slice(0, 20).map((q, i) => {
      const choices = (Array.isArray(q && q.choices) ? q.choices : []).slice(0, 10).map((c) => ({ label: str(c && c.label, 12), correct: !!(c && c.correct), reason: str(c && c.reason, 500) }));
      if (choices.length && choices.filter((c) => c.correct).length !== 1) return null;
      return { number: str((q && q.number) || i + 1, 12), question: str(q && q.question, 1200), answer: str(q && q.answer, 300), explanation: str(q && q.explanation, 1500), evidence: str(q && q.evidence, 200), evidenceTranslation: str(q && q.evidenceTranslation, 300), figures: [], choices };
    });
    if (questions.some((q) => !q || !q.answer)) return null;
    return { by: str(data.by, 40), name: str(data.name, 30) || "だれか", at: Number(data.at) || 0, inputKey: str(data.inputKey, 40), questions };
  }
  // What goes up: no figures, the quoted line of the passage cut short.
  function payload(passageResult, inputKey) {
    const questions = passageResult.questions.map((q) => ({
      number: q.number, question: q.question.slice(0, 1200), answer: q.answer, explanation: q.explanation, evidence: (q.evidence || "").slice(0, 200), evidenceTranslation: (q.evidenceTranslation || "").slice(0, 300),
      choices: q.choices.map((c) => ({ label: c.label, correct: c.correct, reason: c.reason })),
    }));
    return { v: 1, by: me(), name: String(typeof myName === "string" ? myName : "").slice(0, 30), at: Date.now(), inputKey: inputKey || "", questions };
  }

  // ---- device records -----------------------------------------------------------------------
  const mine = () => jsonGet(MINE_KEY, []);
  const hidden = () => new Set(jsonGet(HIDDEN_KEY, []));
  const hide = (path) => { const set = hidden(); set.add(path); jsonSet(HIDDEN_KEY, [...set].slice(-200)); };
  function cacheRead(pk) { const all = jsonGet(CACHE_KEY, {}), hit = all[pk]; return hit && Date.now() - hit.at < TTL ? hit.sets : null; }
  function cacheWrite(pk, sets) {
    const all = jsonGet(CACHE_KEY, {});
    all[pk] = { at: Date.now(), sets };
    for (const k of Object.keys(all).sort((a, b) => all[b].at - all[a].at).slice(CACHE_MAX)) delete all[k];
    if (!jsonSet(CACHE_KEY, all)) { delete all[pk]; jsonSet(CACHE_KEY, all); }
  }
  const withPath = (pk, doc) => { const set = clean(doc.data()); return set ? { ...set, path: pk + "/" + doc.id } : null; };

  // ---- reading ------------------------------------------------------------------------------
  const deadline = (task, ms = 8000) => { let t; return Promise.race([task, new Promise((_, rej) => { t = setTimeout(() => rej(Error("timeout")), ms); })]).finally(() => clearTimeout(t)); };
  // The latest sets for a passage (at most 5, hidden ones left out). `force` skips the 6-hour copy. Rejects on a network or quota failure.
  async function list(passage, force) {
    if (!usable()) return [];
    const pk = await keyOf(passage);
    let sets = force ? null : cacheRead(pk);
    if (!sets) {
      const ref = window.fbCollection(window.db, "readerExplanations", pk, "sets");
      const query = window.fbQuery && window.fbOrderBy && window.fbLimit ? window.fbQuery(ref, window.fbOrderBy("at", "desc"), window.fbLimit(LIST_LIMIT)) : ref;
      const snap = await deadline(window.fbGetDocs(query));
      sets = snap.docs.map((d) => withPath(pk, d)).filter(Boolean);
      cacheWrite(pk, sets);
    }
    const gone = hidden();
    return sets.filter((s) => !gone.has(s.path));
  }
  // One document at most: the set whose typed questions are the same text (so the AI does not have to solve them again). null if none.
  async function find(passage, typed) {
    if (!usable() || !typed || !window.fbWhere || !window.fbQuery || !window.fbLimit) return null;
    const pk = await keyOf(passage), ik = await keyOf(typed);
    const cached = cacheRead(pk);
    if (cached) return cached.find((s) => s.inputKey === ik && !hidden().has(s.path)) || null;
    try {
      const ref = window.fbCollection(window.db, "readerExplanations", pk, "sets");
      const snap = await deadline(window.fbGetDocs(window.fbQuery(ref, window.fbWhere("inputKey", "==", ik), window.fbLimit(1))), 4000);
      const set = snap.docs.length ? withPath(pk, snap.docs[0]) : null;
      return set && !hidden().has(set.path) ? set : null;
    } catch { return null; }
  }

  // ---- writing ------------------------------------------------------------------------------
  // Once per set: not written again when this device did it before, nor over a set that exists (checked in the same transaction).
  async function publish(passage, result, typed) {
    try {
      if (!usable() || !window.fbRunTransaction || !result || !result.questions || !result.questions.length) return false;
      const pk = await keyOf(passage), sk = await questionsKey(result), path = pk + "/" + sk;
      if (mine().some((m) => m.path === path)) return false;
      const body = payload(result, typed ? await keyOf(typed) : "");
      if (JSON.stringify(body).length > DOC_LIMIT) return false;
      const ref = window.fbDoc(window.db, "readerExplanations", pk, "sets", sk);
      const wrote = await deadline(window.fbRunTransaction(window.db, async (tx) => { const snap = await tx.get(ref); if (snap.exists()) return false; tx.set(ref, body); return true; }), 10000);
      if (wrote) { jsonSet(MINE_KEY, [...mine(), { path, at: Date.now() }].slice(-100)); cacheWrite(pk, [{ ...clean(body), path }, ...(cacheRead(pk) || [])].slice(0, LIST_LIMIT)); }
      return !!wrote;
    } catch { return false; }
  }
  // Takes a set this device shared out of the cloud (others' copies on their devices stay).
  async function unshare(set) {
    const [pk, sk] = String(set.path).split("/");
    if (!mine().some((m) => m.path === set.path) || !window.fbDeleteDoc) throw Error("この端末で共有した解説ではありません。");
    await deadline(window.fbDeleteDoc(window.fbDoc(window.db, "readerExplanations", pk, "sets", sk)));
    jsonSet(MINE_KEY, mine().filter((m) => m.path !== set.path));
    const cached = cacheRead(pk);
    if (cached) cacheWrite(pk, cached.filter((s) => s.path !== set.path));
  }
  const isMine = (set) => mine().some((m) => m.path === set.path);


  // ---- Shared passages (みんなの長文): the passages people chose to publish from their shelf -------------------------------------
  //  sharedReaderTexts/{key}: { v, by, name, title, text, at }. The key is the same passage key (so the explanations of its questions
  //  are found by it). Nothing is read until the list is asked for; a page is 10 documents; written once per passage (create if absent).
  const TEXT_ON_KEY = "aiglish_reader_share_text", TEXTS_MINE_KEY = "aiglish_reader_texts_mine", TEXT_MAX = 20000, PAGE = 10;
  const textsEnabled = () => localStorage.getItem(TEXT_ON_KEY) !== "0";
  const setTextsEnabled = (on) => { try { on ? localStorage.removeItem(TEXT_ON_KEY) : localStorage.setItem(TEXT_ON_KEY, "0"); } catch {} };
  const textsMine = () => jsonGet(TEXTS_MINE_KEY, []);
  const isTextMine = (key) => textsMine().includes(key);
  function cleanText(data, key) {
    if (!data || typeof data !== "object" || data.v !== 1 || typeof data.text !== "string") return null;
    const text = data.text.slice(0, TEXT_MAX);
    if (text.trim().length < 20) return null;
    const title = String(data.title || "").slice(0, 80);
    return { key, hasAnalysis: data.hasAnalysis === true, by: String(data.by || "").slice(0, 40), name: String(data.name || "").slice(0, 30) || "だれか", title: /^\s*(data:|javascript:|https?:)/i.test(title) ? "無題" : title || "無題", text, at: Number(data.at) || 0 };
  }
  // "ok" (published), "exists" (already there, by someone), "off" (cannot: sharing off, guest, or no connection), "big", "fail".
  async function publishText(title, text) {
    try {
      if (!signedIn() || !reachable() || !window.fbRunTransaction) return "off";
      const body = String(text || "");
      if (body.trim().length < 20) return "fail";
      if (body.length > TEXT_MAX) return "big";
      const key = await keyOf(body);
      if (isTextMine(key)) return "exists";
      const ref = window.fbDoc(window.db, "sharedReaderTexts", key);
      const made = await deadline(window.fbRunTransaction(window.db, async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists()) return false;
        tx.set(ref, { v: 1, by: me(), name: String(typeof myName === "string" ? myName : "").slice(0, 30), title: String(title || "").slice(0, 80), text: body, at: Date.now() });
        return true;
      }), 10000);
      if (made) jsonSet(TEXTS_MINE_KEY, [...textsMine(), key].slice(-200));
      return made ? "ok" : "exists";
    } catch { return "fail"; }
  }
  let textPages = { items: [], cursor: null, done: false, at: 0 };
  // The next page of shared passages (newest first), hidden ones left out. { items, done }. Rejects on a network or quota failure.
  async function listTexts(more) {
    if (!signedIn() || !reachable() || !window.fbQuery || !window.fbOrderBy || !window.fbLimit) return { items: [], done: true };
    if (!more && textPages.at && Date.now() - textPages.at < 10 * 60 * 1000 && textPages.items.length) return { items: visibleTexts(), done: textPages.done };
    if (!more) textPages = { items: [], cursor: null, done: false, at: 0 };
    if (textPages.done) return { items: visibleTexts(), done: true };
    const clauses = [window.fbOrderBy("at", "desc")];
    if (textPages.cursor && window.fbStartAfter) clauses.push(window.fbStartAfter(textPages.cursor));
    clauses.push(window.fbLimit(PAGE));
    const snap = await deadline(window.fbGetDocs(window.fbQuery(window.fbCollection(window.db, "sharedReaderTexts"), ...clauses)));
    for (const d of snap.docs) { const item = cleanText(d.data(), d.id); if (item) textPages.items.push(item); }
    textPages.cursor = snap.docs.length ? snap.docs[snap.docs.length - 1] : textPages.cursor;
    textPages.done = snap.docs.length < PAGE;
    textPages.at = Date.now();
    return { items: visibleTexts(), done: textPages.done };
  }
  // What was already read (this session, within 10 minutes), so the screen can be redrawn without reading again.
  const cachedTexts = () => (textPages.items.length && Date.now() - textPages.at < 10 * 60 * 1000 ? { items: visibleTexts(), done: textPages.done } : null);
  const visibleTexts = () => { const gone = hidden(); return textPages.items.filter((t) => !gone.has("text/" + t.key)); };
  async function unshareText(key) {
    if (!isTextMine(key) || !window.fbDeleteDoc) throw Error("この端末で公開した長文ではありません。");
    await deadline(window.fbDeleteDoc(window.fbDoc(window.db, "sharedReaderTexts", key)));
    jsonSet(TEXTS_MINE_KEY, textsMine().filter((k) => k !== key));
    textPages.items = textPages.items.filter((t) => t.key !== key);
  }
  const hideText = (key) => hide("text/" + key);

  // ---- Shared analyses: the AI's analysis of a published passage, for people who cannot (or do not want to) run it themselves ----
  //  sharedReaderAnalyses/{key}: { v, by, name, at, json } (json = the analysis as text, at most 700KB). Read only when opened (1 read).
  //  The word-book parts of an analysis are personal and are left out; every string is cut to size and loses < and >.
  const ANALYSIS_DONE_KEY = "aiglish_reader_analysis_shared", ANALYSIS_MAX = 700000;
  function cleanAnalysis(value) {
    if (!value || typeof value !== "object" || !Array.isArray(value.sentences) || !value.sentences.length || value.sentences.length > 400 || value.analysisError) return null;
    const str = (v, n) => String(v == null ? "" : v).slice(0, n).replace(/[<>]/g, "");
    const sentences = [];
    for (const x of value.sentences) {
      if (!x || typeof x.text !== "string" || !x.text.trim()) return null;
      const highlights = (Array.isArray(x.grammarHighlights) ? x.grammarHighlights : []).slice(0, 6)
        .filter((h) => h && typeof h.phrase === "string" && h.phrase)
        .map((h) => ({ phrase: str(h.phrase, 300), label: str(h.label, 60), meaning: str(h.meaning, 600) }));
      sentences.push({ text: str(x.text, 2000), translation: str(x.translation || x.translations, 2000), grammarHighlights: highlights, vocab: [] });
    }
    return { fullSummaryAbstract: str(value.fullSummaryAbstract, 3000), sentences, vocabChecked: false, vocabBooks: [] };
  }
  async function shareAnalysis(passage, analysis) {
    try {
      if (!signedIn() || !reachable() || !textsEnabled() || !window.fbRunTransaction) return false;
      const cleaned = cleanAnalysis(analysis);
      if (!cleaned) return false;
      const key = await keyOf(passage);
      const done = jsonGet(ANALYSIS_DONE_KEY, []);
      if (done.includes(key)) return false;
      // Only for a passage this person published, or one they opened from みんなの長文.
      if (!isTextMine(key) && !textPages.items.some((t) => t.key === key)) return false;
      const json = JSON.stringify(cleaned);
      if (json.length > ANALYSIS_MAX) return false;
      const aRef = window.fbDoc(window.db, "sharedReaderAnalyses", key), tRef = window.fbDoc(window.db, "sharedReaderTexts", key);
      const made = await deadline(window.fbRunTransaction(window.db, async (tx) => {
        const [a, t] = [await tx.get(aRef), await tx.get(tRef)];
        if (a.exists()) return false;
        tx.set(aRef, { v: 1, by: me(), name: String(typeof myName === "string" ? myName : "").slice(0, 30), at: Date.now(), json });
        if (t.exists()) tx.set(tRef, { hasAnalysis: true }, { merge: true });
        return true;
      }), 12000);
      jsonSet(ANALYSIS_DONE_KEY, [...done, key].slice(-200));
      for (const t of textPages.items) if (t.key === key) t.hasAnalysis = true;
      return !!made;
    } catch { return false; }
  }
  // The shared analysis of a passage (one read), or null.
  async function fetchAnalysis(key) {
    if (!signedIn() || !reachable() || !window.fbGetDoc) return null;
    const snap = await deadline(window.fbGetDoc(window.fbDoc(window.db, "sharedReaderAnalyses", key)));
    if (!snap.exists()) return null;
    try { return cleanAnalysis(JSON.parse(String(snap.data().json || ""))); } catch { return null; }
  }
  const available = () => signedIn() && reachable();
  window.ReaderShared = { textsEnabled, setTextsEnabled, publishText, listTexts, cachedTexts, shareAnalysis, fetchAnalysis, unshareText, hideText, isTextMine, textKey: keyOf, enabled, setEnabled, usable, available, list, find, publish, unshare, hide, isMine, clean, keyOf };
})();
