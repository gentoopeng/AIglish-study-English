// Display numbers and units for a word book.
//
// `num` is a word's permanent identity: understanding records, notes, battle references and
// study points are all keyed by it, so it never changes. The number people see and choose
// ranges by is `no`, which defaults to `num`. Inserting a word "after #N" gives it N+1 and moves
// only the unbroken run of numbers that would collide one step down, so books whose numbers
// follow a printed book (with gaps) keep their numbers.
(function (root) {
  "use strict";
  const UNIT_LIMIT = 60;
  function no(word) {
    const value = Number(word?.no);
    return Number.isSafeInteger(value) && value > 0 ? value : Number(word?.num);
  }
  function sort(words) {
    return [...(words || [])].sort(
      (a, b) => no(a) - no(b) || Number(a.num) - Number(b.num),
    );
  }
  function maxNo(words) {
    return (words || []).reduce(
      (n, w) => (Number.isSafeInteger(no(w)) ? Math.max(n, no(w)) : n),
      0,
    );
  }
  function setNo(word, value) {
    if (value === Number(word.num)) delete word.no;
    else word.no = value;
  }
  // Put the word with identity `num` at display number `position`; whoever holds that number
  // moves one down, and so on until a free number absorbs the run. Returns a new array of copies.
  function place(words, num, position) {
    position = Number(position);
    if (!Number.isSafeInteger(position) || position < 1)
      throw Error("番号は1以上の整数で入力してください。");
    const copies = (words || []).map((w) => ({ ...w })),
      target = copies.find((w) => Number(w.num) === Number(num));
    if (!target) throw Error("移動する単語が見つかりません。");
    const occupied = new Map();
    for (const w of copies) if (w !== target) occupied.set(no(w), w);
    let current = target,
      slot = position;
    for (;;) {
      const holder = occupied.get(slot);
      setNo(current, slot);
      if (!holder) break;
      occupied.set(slot, current);
      current = holder;
      slot++;
    }
    return sort(copies);
  }
  function cleanUnit(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, UNIT_LIMIT);
  }
  // Units in number order. A unit is an unbroken run of words with the same unit name, so the
  // same name used again further on (another chapter's "まとめ") is a separate unit rather than
  // one range spanning the words between. `key` names one run: its name and first number.
  function units(words) {
    const list = [];
    let last = null;
    for (const w of sort(words)) {
      const name = cleanUnit(w.unit);
      if (!name) {
        last = null;
        continue;
      }
      if (!last || last.name !== name) {
        last = { key: name + "@" + no(w), name, count: 0, from: no(w), to: no(w), nums: [] };
        list.push(last);
      }
      last.count++;
      last.to = no(w);
      last.nums.push(String(w.num));
    }
    return list;
  }
  const findUnit = (words, key) => (key ? units(words).find((u) => u.key === key) || null : null);
  // Change one unit: its name and its range. The words it had lose the unit, then the new range
  // gets it (taking those words from any other unit). An empty name removes the unit.
  function editUnit(words, key, { name, from, to }) {
    const unit = findUnit(words, key);
    if (!unit) throw Error("単元が見つかりません。");
    const had = new Set(unit.nums),
      cleared = (words || []).map((w) => {
        if (!had.has(String(w.num))) return w;
        const copy = { ...w };
        delete copy.unit;
        return copy;
      });
    if (!cleanUnit(name)) return { words: cleared, changed: had.size };
    return assignUnit(cleared, from, to, name);
  }
  // Assign a unit to every word whose display number lies in [from, to].
  function assignUnit(words, from, to, name) {
    from = Number(from);
    to = Number(to);
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from > to)
      throw Error("番号の範囲を確認してください。");
    const unit = cleanUnit(name);
    let changed = 0;
    const copies = (words || []).map((w) => {
      if (no(w) < from || no(w) > to) return w;
      changed++;
      const copy = { ...w };
      if (unit) copy.unit = unit;
      else delete copy.unit;
      return copy;
    });
    return { words: copies, changed };
  }
  const model = { no, sort, maxNo, place, units, findUnit, editUnit, assignUnit, cleanUnit, UNIT_LIMIT };
  root.VocabOrder = model;
  if (typeof module !== "undefined") module.exports = model;
})(typeof window === "undefined" ? globalThis : window);
