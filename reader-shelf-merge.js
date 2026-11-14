// The reader's bookshelf, merged instead of "the newer copy replaces the other" (which lost a saved text and brought a deleted one
// back when an older copy won). Pure functions; used at restore (save-system.js) and by reader-shelf.js. Also runs under node (tests).
//   side = { shelf: [items], folders: [names], deleted: [{ id, at }], ops: { name: { at, deleted } }, meta: { v, ids } }
//   - an item removed from the shelf leaves a tombstone ({ id, at }); a tombstone always wins for its id (saving the text again makes a
//     new id), so clocks that differ between devices cannot bring a deleted text back;
//   - items are joined by id; the same id on both sides: the later `updatedAt` (set on edit / move) wins;
//   - a side is "new format" only when its meta lists exactly its shelf's ids: an older version of the app that changed the shelf
//     does not write the meta (nor tombstones), and then the old rule (the newer copy as a whole) is the only safe one.
(function (root) {
  "use strict";
  const DAY = 86400000, KEEP_DAYS = 180, KEEP_MAX = 500;
  const hash = (text) => { let h = 2166136261; const s = String(text); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const usable = (item) => !!item && typeof item === "object" && typeof item.text === "string" && !!item.text;
  const place = (item) => (item.bookId ? "book:" + item.bookId : "folder:" + (item.folder && item.folder !== "未分類" ? item.folder : ""));
  const analysed = (item) => !!(item.aiAnalysisData && !item.aiAnalysisData.analysisError);
  const stamp = (item) => Number(item.updatedAt) || Number(item.id) || 0;
  // Old entries without an id get a stable one (from the text and the place), so merging twice does not double them.
  const withId = (item) => (item.id === undefined || item.id === null || item.id === "" ? { ...item, id: 1e9 + hash(item.text + "\n" + place(item)) } : item);
  const idsOf = (shelf) => (Array.isArray(shelf) ? shelf : []).filter(usable).map((i) => String(withId(i).id));
  const meta = (shelf) => ({ v: 2, ids: idsOf(shelf) });
  function isNew(side) {
    const m = side && side.meta;
    if (!m || m.v !== 2 || !Array.isArray(m.ids) || !Array.isArray(side.deleted)) return false;
    const ids = idsOf(side.shelf);
    if (ids.length !== m.ids.length) return false;
    const have = new Set(m.ids.map(String));
    return ids.every((id) => have.has(id));
  }
  function tombstones(a, b, now) {
    const map = new Map();
    for (const t of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
      if (!t || t.id === undefined || t.id === null) continue;
      const at = Number(t.at) || 0, key = String(t.id);
      if (now - at > KEEP_DAYS * DAY) continue;
      if (!map.has(key) || map.get(key).at < at) map.set(key, { id: t.id, at });
    }
    // The newest are kept when there are too many (the oldest go first); a stable order, so merging again changes nothing.
    return [...map.values()].sort((x, y) => y.at - x.at || String(x.id).localeCompare(String(y.id))).slice(0, KEEP_MAX);
  }
  // `first` is the side whose order is kept (the copy changed last); `second` adds what `first` does not have.
  function merge(first, second, now = Date.now()) {
    const deleted = tombstones(first.deleted, second.deleted, now), gone = new Set(deleted.map((t) => String(t.id)));
    const order = [], byId = new Map();
    const add = (raw, primary) => {
      if (!usable(raw)) return;
      let item = withId(raw);
      const key = String(item.id), held = byId.get(key);
      if (!held) { byId.set(key, item); order.push({ key, primary }); return; }
      if (held.text !== item.text && stamp(held) === stamp(item)) {
        // The same id for two different texts (saved in the same millisecond on two devices): both stay, the second under a near id.
        let next = Number(item.id) + 1 + (hash(item.text) % 997);
        while (byId.has(String(next))) next++;
        item = { ...item, id: next };
        byId.set(String(next), item); order.push({ key: String(next), primary });
        return;
      }
      const a = stamp(held), b = stamp(item);
      const win = b > a || (b === a && !analysed(held) && analysed(item)) ? item : held;
      // (an analysis is never lost to a copy that has none, when the text is the same)
      byId.set(key, win === held || analysed(win) || win.text !== (win === item ? held : item).text ? win : { ...win, aiAnalysisData: (win === item ? held : item).aiAnalysisData || win.aiAnalysisData });
    };
    for (const item of Array.isArray(first.shelf) ? first.shelf : []) add(item, true);
    for (const item of Array.isArray(second.shelf) ? second.shelf : []) add(item, false);
    // Tombstones first, then the same text saved twice in the same place (the older id stays, with an analysis if either has one).
    let entries = order.filter((e) => !gone.has(e.key));
    const seen = new Map();
    for (const e of entries.slice().sort((x, y) => Number(byId.get(x.key).id) - Number(byId.get(y.key).id) || x.key.localeCompare(y.key))) {
      const item = byId.get(e.key), key = place(item) + "\n" + item.text, kept = seen.get(key);
      if (!kept) { seen.set(key, e); continue; }
      const keptItem = byId.get(kept.key);
      if (!analysed(keptItem) && analysed(item)) byId.set(kept.key, { ...keptItem, aiAnalysisData: item.aiAnalysisData });
      e.drop = true;
    }
    entries = entries.filter((e) => !e.drop);
    const shelf = [...entries.filter((e) => e.primary), ...entries.filter((e) => !e.primary).sort((x, y) => Number(byId.get(x.key).id) - Number(byId.get(y.key).id) || x.key.localeCompare(y.key))].map((e) => byId.get(e.key));
    // Folders: the last thing done to a name (made or deleted) decides; names an item still uses come back by themselves in the app.
    const ops = {};
    for (const side of [first, second]) for (const [name, op] of Object.entries((side && side.ops) || {})) {
      if (!op || typeof name !== "string") continue;
      const at = Number(op.at) || 0;
      if (!ops[name] || ops[name].at < at) ops[name] = { at, deleted: !!op.deleted };
    }
    const folders = [];
    for (const name of [...(Array.isArray(first.folders) ? first.folders : []), ...(Array.isArray(second.folders) ? second.folders : [])]) {
      if (typeof name !== "string" || !name || folders.includes(name)) continue;
      if (ops[name] && ops[name].deleted && name !== "未分類") continue;
      folders.push(name);
    }
    if (!folders.includes("未分類")) folders.unshift("未分類");
    return { shelf, folders, deleted, ops, meta: meta(shelf) };
  }
  // What matters for "did the merge change anything" (not the order): ids with their text, title, place; the tombstones; the folders.
  function signature(side) {
    const items = (Array.isArray(side.shelf) ? side.shelf : []).filter(usable).map(withId).map((i) => [String(i.id), i.title || "", place(i), hash(i.text), analysed(i) ? 1 : 0].join("|")).sort();
    const dead = (Array.isArray(side.deleted) ? side.deleted : []).map((t) => String(t.id)).sort();
    const folders = (Array.isArray(side.folders) ? side.folders : []).filter((f) => typeof f === "string").slice().sort();
    return JSON.stringify([items, dead, folders]);
  }
  const api = { merge, meta, isNew, signature, tombstones };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.ReaderShelfMerge = api;
})(typeof window === "undefined" ? globalThis : window);
