// One daily content reward per word (or workbook problem): the same for every way of answering.
(function (root) {
  "use strict";
  const rates = Object.freeze({ card: 2, work: 2, quiz: 2, review: 2 });
  // Amounts from before the rates were evened out (10.21.61.00), still valid for records made then.
  const earlier = Object.freeze({ card: [1], work: [1], quiz: [3], review: [10] });
  const allowed = (source, amount) =>
    Object.hasOwn(rates, source) && (amount === rates[source] || earlier[source].includes(amount));
  const day = (now = Date.now()) =>
    new Date(now + 9 * 3600000).toISOString().slice(0, 10);
  const dayStart = (date) => Date.parse(date + "T00:00:00+09:00");
  const amount = (value) =>
    value === true ? 10 : Number.isSafeInteger(value) && value >= 0 ? value : 0;
  function mergeTime(...sources) {
    const result = {};
    for (const source of sources)
      for (const [slot, devices] of Object.entries(source || {})) {
        if (
          !/^\d+$/.test(slot) ||
          String(Number(slot)) !== slot ||
          Number(slot) >= 288 ||
          !devices ||
          typeof devices !== "object"
        )
          continue;
        const target = (result[slot] ||= {});
        for (const [id, record] of Object.entries(devices)) {
          if (!id || id.length > 80 || !record || typeof record !== "object")
            continue;
          const old = target[id] || {},
            clamp = (n) => Math.min(300000, Math.max(0, Number(n) || 0));
          target[id] = {
            ms: Math.max(clamp(old.ms), clamp(record.ms)),
            removed: Math.max(clamp(old.removed), clamp(record.removed)),
          };
        }
      }
    return result;
  }
  function timeMinutes(records) {
    // At most one device counts within a wall-clock slot, so simultaneous devices cannot multiply time.
    return Math.floor(
      Object.values(mergeTime(records)).reduce(
        (total, devices) =>
          total +
          Math.max(0, ...Object.values(devices).map((r) => r.ms - r.removed)),
        0,
      ) / 60000,
    );
  }
  // Points for a day's measured study time: 1 a minute up to 2026-11-01, 5 a minute from
  // 2026-11-02 (Japan time). Days before keep what they gave, so nothing is paid twice.
  const TIME_RATE_FROM = "2026-11-02";
  const timeRate = (date) => (String(date) >= TIME_RATE_FROM ? 5 : 1);
  const timePoints = (records, date) => timeMinutes(records) * timeRate(date);
  function accrueTime(days, device, start, end, removing = false) {
    if (!device || !(end > start) || end - start >= 60000) return;
    let cursor = start;
    while (cursor < end) {
      const date = day(cursor),
        origin = dayStart(date),
        slot = Math.floor((cursor - origin) / 300000),
        boundary = Math.min(end, origin + (slot + 1) * 300000);
      const record = ((days[date] ||= { sources: {} }).pointTime ||= {});
      const r = ((record[slot] ||= {})[device] ||= { ms: 0, removed: 0 });
      const field = removing ? "removed" : "ms";
      r[field] = Math.min(300000, (r[field] || 0) + boundary - cursor);
      cursor = boundary;
    }
  }
  function mature(date, now = Date.now()) {
    const start = dayStart(date);
    // The previous day waits six minutes so the five-minute sleep rollback can finish across midnight.
    return (
      Number.isFinite(start) &&
      day(start) === date &&
      now >= start + 86400000 + 360000
    );
  }
  // The points history kept per day: { "YYYY-MM-DD": { source: { n, p } } }, n how many
  // (words, problems, minutes for time) and p the points (negative for lending out). Written in
  // the same transactions that move the points; the newest DAILY_DAYS days are kept.
  const DAILY_SOURCES = ["card", "quiz", "review", "work", "time", "bonus", "loan"],
    DAILY_DAYS = 400;
  function cleanDaily(daily) {
    const out = {};
    if (!daily || typeof daily !== "object" || Array.isArray(daily)) return out;
    for (const dayKey of Object.keys(daily).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().slice(-DAILY_DAYS)) {
      const row = daily[dayKey];
      if (!row || typeof row !== "object") continue;
      for (const source of DAILY_SOURCES) {
        const item = row[source];
        if (!item || !Number.isFinite(Number(item.p))) continue;
        (out[dayKey] = out[dayKey] || {})[source] = { n: Math.max(0, Math.floor(Number(item.n) || 0)), p: Math.round(Number(item.p)) };
      }
    }
    return out;
  }
  // Adds to one day's line (for a credit made in a transaction); `minutes` sets n for time.
  function addDaily(daily, dayKey, source, points, count = 1, minutes) {
    const out = cleanDaily(daily);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey) || !DAILY_SOURCES.includes(source)) return out;
    const row = (out[dayKey] = out[dayKey] || {}),
      item = (row[source] = row[source] || { n: 0, p: 0 });
    item.p += Math.round(points);
    item.n = minutes !== undefined ? Math.max(item.n, Math.floor(minutes)) : item.n + count;
    return cleanDaily(out);
  }
  // Two copies of the record (two devices, or the cloud and this device): for each day and
  // source the fuller one (more counted, then the larger amount) wins.
  function mergeDaily(...sources) {
    const out = {};
    for (const source of sources)
      for (const [dayKey, row] of Object.entries(cleanDaily(source)))
        for (const [name, item] of Object.entries(row)) {
          const old = out[dayKey]?.[name];
          if (!old || item.n > old.n || (item.n === old.n && Math.abs(item.p) > Math.abs(old.p))) (out[dayKey] = out[dayKey] || {})[name] = item;
        }
    return cleanDaily(out);
  }
  const api = {
    cleanDaily,
    addDaily,
    mergeDaily,
    DAILY_SOURCES,
    rates,
    allowed,
    day,
    dayStart,
    amount,
    mergeTime,
    timeMinutes,
    timeRate,
    timePoints,
    accrueTime,
    mature,
  };
  root.StudyPointPolicy = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
