// A personal copy of a word book follows its original (a distributed book, or a book another
// player made public) without losing the player's own changes. Pure: no screen, no network.
//
// The copy keeps a "base": a short fingerprint of each word of the original as it was when the copy
// last caught up (`fp`, by the original's word number) and, for a copy that numbers its words
// afresh, where each original word sits in the copy (`map`). A later change of the original is then
// told word by word:
//   - a word the original changed is replaced in the copy only if the player has not changed it;
//   - a word new in the original is added;
//   - a word the original dropped is dropped from the copy only if the player has not changed it.
// Whatever the player changed, added or deleted stays theirs. Ratings, notes and sticky notes are
// kept by word number elsewhere, and a replaced word keeps its number in the copy.
(function (root) {
  "use strict";
  // What identifies a word's content (not its number, its links, or any progress).
  function project(word, cleanUnit) {
    const meanings = Array.isArray(word?.meanings) && word.meanings.length ? word.meanings : [{ text: word?.meaning }];
    const unit = cleanUnit ? cleanUnit(word?.unit) : word?.unit;
    return [
      String(word?.word ?? ""),
      String(word?.meaning ?? ""),
      typeof word?.sub === "string" ? word.sub : "",
      String(unit || ""),
      meanings.map((m) => [String(m?.text ?? ""), String(m?.partOfSpeech || m?.pos || word?.partOfSpeech || word?.pos || ""), m?.minor === true ? 1 : 0, m?.blankOnly === true ? 1 : 0]),
    ];
  }
  // Two 32-bit hashes of the content, joined: a changed word almost surely gets another value.
  function fingerprint(word, cleanUnit) {
    const text = JSON.stringify(project(word, cleanUnit));
    let a = 0x811c9dc5,
      b = 0x01000193 ^ text.length;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      a = Math.imul(a ^ c, 0x01000193);
      b = Math.imul(b + c + i, 0x85ebca6b) ^ (b >>> 13);
    }
    return (a >>> 0).toString(36) + "." + (b >>> 0).toString(36);
  }
  // The base of a copy made now: `words` are the original's, `place(word, index)` the number each
  // has in the copy (omit it when the copy keeps the original's numbers).
  function baseOf(words, place, cleanUnit) {
    const base = { fp: {}, map: {} };
    (words || []).forEach((word, index) => {
      const n = String(word.num);
      base.fp[n] = fingerprint(word, cleanUnit);
      if (place) base.map[n] = String(place(word, index));
    });
    return base;
  }
  // theirs: the original now; mine: the copy now; base: as above (fp and map); identity: the copy
  // keeps the original's numbers; makeWord(theirWord, copyNum, mineWord): the word as the copy stores it
  // (mineWord: the copy's word it replaces, if any, whose own order and links it can keep);
  // cleanUnit: the same unit tidying as the copy's own.
  // Returns { words (the copy's new list), base, report: { replaced, added, removed, kept } }.
  function merge({ base, theirs, mine, identity = false, makeWord, cleanUnit }) {
    const fp = { ...(base?.fp || {}) },
      map = { ...(base?.map || {}) },
      report = { replaced: 0, added: 0, removed: 0, kept: 0 },
      out = new Map((mine || []).map((w) => [String(w.num), w])),
      theirBy = new Map((theirs || []).map((w) => [String(w.num), w]));
    let next = Math.max(0, ...(mine || []).map((w) => Number(w.num) || 0)) + 1;
    const place = (n) => (map[n] !== undefined ? map[n] : identity ? n : undefined);
    for (const [n, t] of theirBy) {
      const f = fingerprint(t, cleanUnit),
        at = place(n);
      if (fp[n] === undefined) {
        // New in the original. If the player already has a word on that number it is theirs: the
        // original's word goes to a number of its own (unless it is the same word), and later changes
        // of the original's reach it there.
        const taken = at !== undefined ? out.get(at) : null;
        if (taken && fingerprint(taken, cleanUnit) === f) {
          map[n] = at;
        } else {
          const num = at !== undefined && !taken ? at : String(next++);
          out.set(num, makeWord(t, num, null));
          map[n] = num;
          report.added++;
        }
        fp[n] = f;
        continue;
      }
      if (fp[n] === f) continue;
      const m = at !== undefined ? out.get(at) : null;
      if (m && fingerprint(m, cleanUnit) === fp[n]) {
        out.set(at, makeWord(t, at, m));
        report.replaced++;
      } else report.kept++;
      fp[n] = f;
    }
    for (const n of Object.keys(fp)) {
      if (theirBy.has(n)) continue;
      const at = place(n),
        m = at !== undefined ? out.get(at) : null;
      if (m && fingerprint(m, cleanUnit) === fp[n]) {
        out.delete(at);
        report.removed++;
      } else report.kept++;
      delete fp[n];
      delete map[n];
    }
    const words = [...out.values()].sort((a, b) => (Number(a.num) || 0) - (Number(b.num) || 0));
    return { words, base: { ...(base || {}), fp, map }, report, changed: report.replaced + report.added + report.removed > 0 };
  }
  const api = { fingerprint, baseOf, merge, project };
  root.CopyFollow = Object.freeze(api);
  if (typeof module !== "undefined") module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
