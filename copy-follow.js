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
  // The same by part: the headword, the first meaning, the sub line, the unit, and each meaning row.
  // A short hash for each, so a copy that both the player and the original changed can be told part by part.
  function hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
    return (h >>> 0).toString(36);
  }
  const rows = (word) => {
    const list = Array.isArray(word?.meanings) && word.meanings.length ? word.meanings : [{ text: word?.meaning }];
    return list.map((m) => [String(m?.text ?? ""), String(m?.partOfSpeech || m?.pos || word?.partOfSpeech || word?.pos || ""), m?.minor === true ? 1 : 0, m?.blankOnly === true ? 1 : 0]);
  };
  function parts(word, cleanUnit) {
    const [w, m, sub, unit] = project(word, cleanUnit);
    return { w: hash(w), m: hash(m), s: hash(sub), u: hash(unit), t: rows(word).map((row) => hash(JSON.stringify(row))) };
  }
  // The base of a copy made now: `words` are the original's, `place(word, index)` the number each
  // has in the copy (omit it when the copy keeps the original's numbers).
  function baseOf(words, place, cleanUnit) {
    const base = { fp: {}, pf: {}, map: {} };
    (words || []).forEach((word, index) => {
      const n = String(word.num);
      base.fp[n] = fingerprint(word, cleanUnit);
      base.pf[n] = parts(word, cleanUnit);
      if (place) base.map[n] = String(place(word, index));
    });
    return base;
  }
  // The player's word `mine` and the original's word `theirs`, both changed from what the base held (`was`, its
  // parts; missing in an older base: then the original's word, `whole`, is taken as it is). Part by part:
  // a part the original changed is the original's, any other part stays the player's.
  function mixWords(mine, theirs, was, whole, cleanUnit) {
    if (!was) return whole;
    const now = parts(theirs, cleanUnit),
      out = { ...mine };
    if (now.w !== was.w) out.word = theirs.word;
    if (now.m !== was.m) out.meaning = theirs.meaning;
    if (now.s !== was.s) out.sub = typeof theirs.sub === "string" ? theirs.sub : "";
    if (now.u !== was.u) {
      const unit = cleanUnit ? cleanUnit(theirs.unit) : theirs.unit;
      if (unit) out.unit = unit;
      else delete out.unit;
    }
    // The meaning rows, one by one by their place; a row the player left alone and the original left alone stays.
    const theirRows = Array.isArray(whole.meanings) ? whole.meanings : [],
      mineRows = Array.isArray(mine.meanings) ? mine.meanings : [],
      mineHash = rows(mine).map((row) => hash(JSON.stringify(row))),
      list = [];
    for (let i = 0; i < Math.max(theirRows.length, mineRows.length); i++) {
      const inBase = i < was.t.length;
      if (i < theirRows.length) {
        const changed = !inBase || now.t[i] !== was.t[i];
        // A row both sides added at this place (beyond the base): both stay, the original's first.
        const both = !inBase && !!mineRows[i] && mineHash[i] !== now.t[i];
        if (changed || !mineRows[i]) {
          // The original's row (the original changed it, or it is new). A row of the base that the player deleted and the
          // original did not touch stays deleted.
          if (changed) list.push({ ...theirRows[i], id: both ? undefined : mineRows[i]?.id ?? theirRows[i].id });
          if (both) list.push(mineRows[i]);
        } else list.push(mineRows[i]);
      } else if (mineRows[i]) {
        // The original no longer has this row: it goes unless the player changed it (or it is their own).
        if (!inBase || mineHash[i] !== was.t[i]) list.push(mineRows[i]);
      }
    }
    if (list.length) {
      // A row without an id (one taken from the original beside the player's own) gets a free one.
      const used = new Set(list.map((row) => row.id).filter((id) => id !== undefined));
      out.meanings = list.map((row, i) => {
        if (row.id !== undefined) return row;
        let k = i;
        while (used.has(String(out.num) + "-" + k)) k++;
        used.add(String(out.num) + "-" + k);
        return { ...row, id: String(out.num) + "-" + k };
      });
      // The word's own meaning is made of its rows (the editor does the same), so it follows the mix:
      // the one row's text, or the rows one after another, numbered.
      out.meaning = out.meanings.length === 1 ? String(out.meanings[0].text ?? "") : out.meanings.map((m, k) => (k < 20 ? String.fromCharCode(0x2460 + k) : "(" + (k + 1) + ")") + String(m.text ?? "").split("\n").join(" ")).join("");
    }
    return out;
  }
  // theirs: the original now; mine: the copy now; base: as above (fp and map); identity: the copy
  // keeps the original's numbers; makeWord(theirWord, copyNum, mineWord): the word as the copy stores it
  // (mineWord: the copy's word it replaces, if any, whose own order and links it can keep);
  // cleanUnit: the same unit tidying as the copy's own.
  // Returns { words (the copy's new list), base, report: { replaced, added, removed, kept } }.
  function merge({ base, theirs, mine, identity = false, makeWord, cleanUnit }) {
    const fp = { ...(base?.fp || {}) },
      pf = { ...(base?.pf || {}) },
      map = { ...(base?.map || {}) },
      report = { replaced: 0, added: 0, removed: 0, kept: 0, mixed: 0 },
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
        pf[n] = parts(t, cleanUnit);
        continue;
      }
      if (fp[n] === f) {
        // Unchanged in the original: what the base holds for it is these parts (an older base had none).
        if (!pf[n]) pf[n] = parts(t, cleanUnit);
        continue;
      }
      const m = at !== undefined ? out.get(at) : null;
      if (m && fingerprint(m, cleanUnit) === fp[n]) {
        out.set(at, makeWord(t, at, m));
        report.replaced++;
      } else if (m) {
        // Both changed this word. What the original changed (a part of it) comes in, what only the player
        // changed stays: the two are mixed, and where both changed the same part the original's wins.
        out.set(at, mixWords(m, t, pf[n], makeWord(t, at, m), cleanUnit));
        report.mixed++;
      } else report.kept++;
      fp[n] = f;
      pf[n] = parts(t, cleanUnit);
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
      delete pf[n];
      delete map[n];
    }
    const words = [...out.values()].sort((a, b) => (Number(a.num) || 0) - (Number(b.num) || 0));
    return { words, base: { ...(base || {}), fp, pf, map }, report, changed: report.replaced + report.added + report.removed + report.mixed > 0 };
  }
  const api = { fingerprint, baseOf, merge, project, parts };
  root.CopyFollow = Object.freeze(api);
  if (typeof module !== "undefined") module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
