// The study planner (10.163): what the player writes on days (tests, events, notes) and plans that spread a range
// of a word book or a workbook over days ("problems 1–120 by the test"). Pure: no screen, no storage.
//
// data = { version: 1, events: [Event], plans: [Plan], checks: { "<planId>|<date>": { done, at } } }
//   Event { id, date, kind: "test"|"event"|"note", title, memo, at, deleted? }
//   Plan  { id, title, source: { type: "vocab"|"work"|"free", id, name }, from, to, start, end, at, deleted? }
// Every item carries `at` (when it was last changed); two devices merge item by item, the newer one winning, and a
// removed item stays as { deleted: true } for a while so the removal reaches the other device too.
(function (root) {
  "use strict";
  const DAY = 864e5,
    MAX_EVENTS = 500,
    MAX_PLANS = 100,
    MAX_SPAN = 5000,
    MAX_DAYS = 366,
    KEEP_DELETED = 90 * DAY,
    KINDS = { test: "テスト", event: "予定", note: "メモ" };
  const text = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  // A memo keeps its line breaks (at most 5 lines).
  const memo = (v, n) => String(v ?? "").replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/[ \t\u3000]+/g, " ").trim()).filter(Boolean).slice(0, 5).join("\n").slice(0, n);
  const pad = (n) => String(n).padStart(2, "0");
  const dateKey = (t) => {
    const d = new Date(t);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  };
  // "2026-11-19", also "2026/11/19" and "11/19" (this year, or next year if already past by more than a month).
  function day(v, now = Date.now()) {
    const s = String(v ?? "").trim();
    let m = s.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/);
    let y, mo, d;
    if (m) [y, mo, d] = [+m[1], +m[2], +m[3]];
    else if ((m = s.match(/^(\d{1,2})[-/.月](\d{1,2})日?$/))) {
      const today = new Date(now);
      [y, mo, d] = [today.getFullYear(), +m[1], +m[2]];
      if (new Date(y, mo - 1, d).getTime() < now - 31 * DAY) y++;
    } else return "";
    const t = new Date(y, mo - 1, d);
    return t.getFullYear() === y && t.getMonth() === mo - 1 && t.getDate() === d ? dateKey(t) : "";
  }
  const at = (key) => new Date(key + "T00:00:00").getTime();
  const addDays = (key, n) => {
    const d = new Date(at(key));
    d.setDate(d.getDate() + n);
    return dateKey(d);
  };
  const daysBetween = (a, b) => Math.round((at(b) - at(a)) / DAY);
  const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const whole = (v) => (Number.isSafeInteger(Number(v)) ? Number(v) : NaN);
  const stamp = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);

  function cleanEvent(e) {
    if (!e || typeof e !== "object") return null;
    const date = day(e.date);
    const out = { id: text(e.id, 40), at: stamp(e.at) };
    if (!out.id) return null;
    if (e.deleted) return { ...out, deleted: true };
    if (!date || !text(e.title, 60)) return null;
    return { ...out, date, kind: Object.hasOwn(KINDS, e.kind) ? e.kind : "event", title: text(e.title, 60), memo: memo(e.memo, 300) };
  }
  function cleanPlan(p) {
    if (!p || typeof p !== "object") return null;
    const out = { id: text(p.id, 40), at: stamp(p.at) };
    if (!out.id) return null;
    if (p.deleted) return { ...out, deleted: true };
    const from = whole(p.from),
      to = whole(p.to),
      start = day(p.start),
      end = day(p.end),
      type = ["vocab", "work", "free"].includes(p.source?.type) ? p.source.type : "free";
    if (!(from >= 0 && to >= from && to - from < MAX_SPAN) || !start || !end || end < start || daysBetween(start, end) >= MAX_DAYS) return null;
    const name = text(p.source?.name, 60);
    return { ...out, title: text(p.title, 60) || name || "計画", source: { type, id: type === "free" ? "" : text(p.source?.id, 120), name }, from, to, start, end };
  }
  // Keeps what is valid, newest first within a kind, capped; removed items older than KEEP_DELETED are dropped.
  function clean(data, now = Date.now()) {
    const keep = (list, fn, max) => {
      const seen = new Map();
      for (const raw of Array.isArray(list) ? list : []) {
        const item = fn(raw);
        if (!item || (item.deleted && now - item.at > KEEP_DELETED)) continue;
        const old = seen.get(item.id);
        if (!old || item.at >= old.at) seen.set(item.id, item);
      }
      return [...seen.values()].sort((a, b) => b.at - a.at).slice(0, max);
    };
    const checks = {};
    for (const [key, value] of Object.entries(data?.checks && typeof data.checks === "object" ? data.checks : {})) {
      const [plan, date] = key.split("|");
      if (!plan || !day(date) || !value || typeof value !== "object") continue;
      checks[plan + "|" + day(date)] = { done: value.done === true, at: stamp(value.at) };
    }
    return { version: 1, events: keep(data?.events, cleanEvent, MAX_EVENTS), plans: keep(data?.plans, cleanPlan, MAX_PLANS), checks };
  }
  // Two copies (two devices): item by item, the newer one wins; a removal wins over an older change.
  function merge(a, b, now = Date.now()) {
    const left = clean(a, now),
      right = clean(b, now);
    const checks = { ...left.checks };
    for (const [key, value] of Object.entries(right.checks)) if (!checks[key] || value.at >= checks[key].at) checks[key] = value;
    return clean({ events: [...left.events, ...right.events], plans: [...left.plans, ...right.plans], checks }, now);
  }
  const live = (list) => list.filter((item) => !item.deleted);
  // A plan spread over its days: every day from start to end gets about the same share, the first days one more.
  // With fewer items than days, the items go one a day from the start. Returns [{ date, from, to }].
  function split(plan) {
    const count = plan.to - plan.from + 1,
      days = daysBetween(plan.start, plan.end) + 1;
    const out = [];
    let next = plan.from;
    for (let i = 0; i < days && next <= plan.to; i++) {
      const share = Math.floor(count / days) + (i < count % days ? 1 : 0) || (i < count ? 1 : 0);
      if (!share) continue;
      out.push({ date: addDays(plan.start, i), from: next, to: Math.min(plan.to, next + share - 1) });
      next += share;
    }
    return out;
  }
  // What is on a day: its events, and each plan's share of that day.
  function on(data, date) {
    const d = clean(data);
    return {
      events: live(d.events).filter((e) => e.date === date).sort((a, b) => (a.kind === "test" ? -1 : 0) - (b.kind === "test" ? -1 : 0)),
      tasks: live(d.plans).flatMap((plan) => split(plan).filter((part) => part.date === date).map((part) => ({ plan, ...part, key: plan.id + "|" + date, checked: d.checks[plan.id + "|" + date]?.done === true }))),
    };
  }
  // Plan days before `date` (up to 14 days back) not ticked off; `isDone(task)` also counts the ones done by ratings.
  function overdue(data, date, isDone = (t) => t.checked) {
    const d = clean(data),
      from = addDays(date, -14),
      out = [];
    for (const plan of live(d.plans))
      for (const part of split(plan))
        if (part.date < date && part.date >= from) {
          const task = { plan, ...part, key: plan.id + "|" + part.date, checked: d.checks[plan.id + "|" + part.date]?.done === true };
          if (!isDone(task)) out.push(task);
        }
    return out.sort((a, b) => (a.date < b.date ? -1 : 1));
  }
  // Days from..to with something on them: { date: { events, tests, tasks } } (for the dots on the calendar).
  function marks(data, from, to) {
    const d = clean(data),
      out = {};
    const at = (date) => (out[date] ||= { events: 0, tests: 0, tasks: 0 });
    for (const e of live(d.events)) if (e.date >= from && e.date <= to) e.kind === "test" ? at(e.date).tests++ : at(e.date).events++;
    for (const plan of live(d.plans)) for (const part of split(plan)) if (part.date >= from && part.date <= to) at(part.date).tasks++;
    return out;
  }
  // Changes, returning new data (the item gets `at` now).
  const put = (data, list, item, now = Date.now()) => {
    const d = clean(data, now);
    d[list] = [{ ...item, at: now }, ...d[list].filter((x) => x.id !== item.id)];
    return clean(d, now);
  };
  const addEvent = (data, e, now) => put(data, "events", { ...e, id: e.id || id() }, now);
  const addPlan = (data, p, now) => put(data, "plans", { ...p, id: p.id || id() }, now);
  const remove = (data, list, itemId, now = Date.now()) => put(data, list, { id: itemId, deleted: true }, now);
  function check(data, key, done, now = Date.now()) {
    const d = clean(data, now);
    d.checks[key] = { done: !!done, at: now };
    return clean(d, now);
  }

  // An AI's answer to the planner prompt: { "events": [{ date, kind, title, memo }], "plans": [{ title, book, from, to,
  // start, end }] } (in a code block or not). `books`: [{ type: "vocab"|"work", id, name }] the player has; a plan's
  // book is matched by name (exactly, then ignoring case and spaces), else it is a free plan with that name.
  function importAi(raw, data, books = [], now = Date.now()) {
    const s = String(raw || "");
    const json = s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1);
    let given;
    try {
      given = JSON.parse(json);
    } catch {
      throw Error("AIの答えをそのまま貼り付けてください（{ から } まで）。");
    }
    const loose = (v) => String(v || "").replace(/[\s　]+/g, "").toLowerCase();
    let next = clean(data, now),
      events = 0,
      plans = 0;
    const skipped = [],
      free = [];
    for (const e of Array.isArray(given?.events) ? given.events : []) {
      const item = cleanEvent({ id: id(), at: now, date: day(e?.date, now), kind: e?.kind, title: e?.title, memo: e?.memo });
      if (item) (next = addEvent(next, item, now), events++);
      else skipped.push(text(e?.title, 30) || "予定");
    }
    for (const p of Array.isArray(given?.plans) ? given.plans : []) {
      const name = text(p?.book ?? p?.source ?? p?.name, 60);
      const book = books.find((b) => b.name === name) || books.find((b) => loose(b.name) === loose(name));
      const item = cleanPlan({ id: id(), at: now, title: p?.title || name, source: book ? { type: book.type, id: book.id, name: book.name } : { type: "free", name }, from: p?.from, to: p?.to, start: day(p?.start, now), end: day(p?.end, now) });
      if (!item) {
        skipped.push(text(p?.title || name, 30) || "計画");
        continue;
      }
      if (!book && name) free.push(name);
      next = addPlan(next, item, now);
      plans++;
    }
    return { data: next, events, plans, skipped, free: [...new Set(free)] };
  }

  const api = { overdue, DAY, KINDS, MAX_EVENTS, MAX_PLANS, dateKey, day, addDays, daysBetween, clean, merge, split, on, marks, addEvent, addPlan, remove, check, importAi, live };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PlannerModel = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis);
