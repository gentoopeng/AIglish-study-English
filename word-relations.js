// Words related to a word (10.153): two kinds, kept apart.
//   links   — words in a word book that can be opened (jumped to): { num, kind } in the same book, or
//             { num, kind, book, word } in another book (word: its text, shown without reading that book).
//             A link inside the book goes both ways; one to another book does not (that book may not be the player's).
//   related — words that are not in any book here, just shown: { text, kind }.
// kind: syn 同義語, ant 反意語, rel 関連. At most 20 of each per word.
(function (root) {
  "use strict";
  const KINDS = { syn: "同義語", ant: "反意語", rel: "関連" };
  const MAX = 20;
  const kindOf = (k) => (Object.hasOwn(KINDS, k) ? k : "rel");
  const okBook = (b) => typeof b === "string" && b.length > 0 && b.length <= 120;
  const text = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  // Links as stored: a number, a kind, and for another book its id and the word's text. Not to itself, no twice.
  function cleanLinks(links, selfNum, selfBook) {
    const out = [],
      seen = new Set();
    for (const l of Array.isArray(links) ? links : []) {
      if (!l || l.num === undefined || l.num === null || String(l.num) === "") continue;
      // (A link meant for another book whose id is not readable is dropped, never taken for this book's word.)
      if (l.book !== undefined && l.book !== null && l.book !== "" && !okBook(l.book)) continue;
      const book = okBook(l.book) && l.book !== selfBook ? l.book : "";
      if (!book && String(l.num) === String(selfNum)) continue;
      const key = book + "\u0000" + String(l.num);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ num: String(l.num), kind: kindOf(l.kind), ...(book ? { book, word: text(l.word, 60) } : {}) });
      if (out.length >= MAX) break;
    }
    return out;
  }
  // Words just shown: a text and a kind, no twice (letter case aside).
  function cleanRelated(list, selfWord) {
    const out = [],
      seen = new Set([text(selfWord, 60).toLowerCase()]);
    for (const r of Array.isArray(list) ? list : []) {
      const t = text(typeof r === "string" ? r : r?.text, 60);
      if (!t || seen.has(t.toLowerCase())) continue;
      seen.add(t.toLowerCase());
      out.push({ text: t, kind: kindOf(typeof r === "string" ? "rel" : r.kind) });
      if (out.length >= MAX) break;
    }
    return out;
  }
  // The relations part of an import line: 「同=follow,obey 反=lead 関=leader」 (also ＝, 、 ， ／ ; and
  // 同義, 反意, 関連 as names). Returns [{ name, kind }].
  const NAMES = { 同: "syn", 同義: "syn", 同義語: "syn", 反: "ant", 反意: "ant", 反意語: "ant", 対: "ant", 関: "rel", 関連: "rel", 関連語: "rel" };
  const FIELD = /^\s*(同義語|同義|同|反意語|反意|反|対|関連語|関連|関)\s*[=＝]/;
  const isRelationField = (part) => FIELD.test(String(part || ""));
  function parseRelationField(field) {
    const out = [];
    const re = /(同義語|同義|同|反意語|反意|反|対|関連語|関連|関)\s*[=＝]\s*([^=＝]*?)(?=\s+(?:同義語|同義|同|反意語|反意|反|対|関連語|関連|関)\s*[=＝]|$)/g;
    for (const m of String(field || "").matchAll(re))
      for (const name of m[2].split(/[,，、／/;；]+/).map((s) => s.trim()).filter(Boolean)) out.push({ name: text(name, 60), kind: NAMES[m[1]] });
    return out;
  }
  // A name as an AI gives it, cut to the word itself (10.155): "obey（〜に従う）", "obey: 従う", "obey 〜に従う" and
  // "山名持豊（宗全）" give the word and, apart, what came with it (it goes to 補足, not to the word).
  function cleanName(v) {
    const s = text(v, 160);
    let name = s,
      extra = "";
    if (/^[A-Za-z]/.test(s)) {
      const at = s.search(/[(（[［【<〈:：=＝]|[^\x00-\x7F]|\s[-–—]\s/);
      if (at > 0) (name = s.slice(0, at)), (extra = s.slice(at));
    } else {
      const m = s.match(/^(.+?)\s*[（(](.+?)[）)]\s*$/);
      if (m) (name = m[1]), (extra = m[2]);
    }
    name = text(name.replace(/[\s,.'’\-–—]+$/, ""), 60);
    extra = extra.replace(/^[\s(（[［【<〈:：=＝\-–—]+/, "").replace(/[\s)）\]］】>〉]+$/, "").trim();
    return name ? { name, extra: text(extra, 80) } : { name: text(s, 60), extra: "" };
  }
  // Puts relations given by name on word `num` of `words` (an import): a name that is a word of this list becomes a
  // link (both ways), any other name a related word. What came with a name (a meaning, a note) is added to 補足.
  // Returns { links, related } counts.
  function applyNames(words, num, names) {
    const me = words.find((w) => String(w.num) === String(num));
    const counts = { links: 0, related: 0 };
    if (!me) return counts;
    const notes = [];
    for (const given of names) {
      const { name, extra } = cleanName(given.name),
        kind = kindOf(given.kind);
      if (!name) continue;
      if (extra) notes.push(KINDS[kind] + "・" + name + " " + extra);
      const lower = name.toLowerCase(),
        target = words.find((w) => String(w.num) !== String(num) && String(w.word || "").trim().toLowerCase() === lower);
      if (target) {
        me.links = cleanLinks([...(me.links || []), { num: target.num, kind }], me.num);
        const back = cleanLinks([...(target.links || []).filter((l) => l.book || String(l.num) !== String(me.num)), { num: me.num, kind }], target.num);
        target.links = back;
        counts.links++;
      } else {
        me.related = cleanRelated([...(me.related || []), { text: name, kind }], me.word);
        counts.related++;
      }
    }
    const sub = String(me.sub || "").trim(),
      add = notes.filter((n) => !sub.includes(n.slice(n.indexOf("・") + 1)));
    if (add.length) me.sub = [sub, ...add].filter(Boolean).join("／");
    if (!me.links?.length) delete me.links;
    if (!me.related?.length) delete me.related;
    return counts;
  }
  // Where a word is used, across books: entries whose word, meaning or 補足 contain it (not the word itself).
  // books: [{ id, name, words }]. Returns [{ book, name, num, no, word, where, snippet }], at most `limit`.
  function findUses(term, books, self = {}, limit = 200) {
    const t = text(term, 60).toLowerCase();
    const out = [];
    if (t.length < 1) return out;
    // An English word is matched as a word (so "go" does not find "good"); anything else as a part of the text.
    const latin = /^[a-z][a-z' -]*$/.test(t),
      re = latin ? new RegExp("(^|[^a-z])" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![a-z])", "i") : null;
    const has = (s) => {
      const v = String(s || "");
      return latin ? re.test(v) : v.toLowerCase().includes(t);
    };
    const snippet = (s) => {
      const v = String(s || "").replace(/\s+/g, " ");
      const at = v.toLowerCase().indexOf(t);
      return at < 0 ? v.slice(0, 60) : (at > 20 ? "…" : "") + v.slice(Math.max(0, at - 20), at + t.length + 30) + (at + t.length + 30 < v.length ? "…" : "");
    };
    for (const b of books || [])
      for (const w of Array.isArray(b.words) ? b.words : []) {
        if (String(b.id) === String(self.book) && String(w.num) === String(self.num)) continue;
        const meanings = Array.isArray(w.meanings) && w.meanings.length ? w.meanings.map((m) => m.text) : [w.meaning];
        let where = "",
          found = "";
        if (has(w.word)) (where = "単語"), (found = w.word);
        else {
          const m = meanings.find(has);
          if (m) (where = "意味"), (found = m);
          else if (has(w.sub)) (where = "補足"), (found = w.sub);
        }
        if (!where) continue;
        out.push({ book: b.id, name: b.name, num: w.num, no: w.no, word: w.word, where, snippet: snippet(found) });
        if (out.length >= limit) return out;
      }
    return out;
  }
  const api = { KINDS, MAX, kindOf, cleanLinks, cleanRelated, isRelationField, parseRelationField, cleanName, applyNames, findUses };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WordRelations = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis);
