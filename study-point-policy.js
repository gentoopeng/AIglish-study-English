// One daily content reward, upgraded by recall quality rather than added per action.
(function (root) {
  "use strict";
  const rates = Object.freeze({ card: 1, work: 1, quiz: 3, review: 10 });
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
  const api = {
    rates,
    day,
    dayStart,
    amount,
    mergeTime,
    timeMinutes,
    accrueTime,
    mature,
  };
  root.StudyPointPolicy = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
