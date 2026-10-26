// The お知らせボックス without any screen or network: the daily login bonus (which prize, which
// day it is in Japan) and the list of notices from the team.
(function (root) {
  "use strict";
  // The wheel: 50 equal segments, clockwise from the top. The rarer the prize, the fewer its
  // segments (1000pt has one, 10pt has twenty), so what the wheel shows is the real chance.
  // On average a day's spin pays about 91pt.
  const COUNTS = { 1000: 1, 500: 2, 200: 4, 100: 8, 50: 15, 10: 20 };
  const TIERS = [1000, 500, 200, 100, 50, 10];
  // Each prize's segments are spread evenly round the wheel, the rarest placed first.
  const SEGMENTS = (() => {
    const total = Object.values(COUNTS).reduce((a, b) => a + b, 0),
      wheel = Array(total).fill(null);
    TIERS.forEach((prize, tier) => {
      const n = COUNTS[prize];
      for (let k = 0; k < n; k++) {
        let at = Math.round((k * total) / n + (tier * total) / (2 * TIERS.length)) % total;
        while (wheel[at] !== null) at = (at + 1) % total;
        wheel[at] = prize;
      }
    });
    return Object.freeze(wheel);
  })();
  const MAX_NOTICES = 30;
  // The day changes at midnight in Japan, wherever the device is.
  function dayKey(now = Date.now()) {
    const d = new Date(now + 9 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  }
  // Which segment the wheel stops on; every segment is as likely as any other.
  const drawSegment = (random = Math.random) => Math.min(SEGMENTS.length - 1, Math.floor(random() * SEGMENTS.length));
  // Where the wheel stops: whole turns plus the angle that puts the segment under the pointer at
  // the top, a little off its centre so it does not look mechanical.
  function stopAngle(segment, turns = 6, jitter = 0) {
    if (!(segment >= 0 && segment < SEGMENTS.length)) throw Error("unknown segment");
    const size = 360 / SEGMENTS.length;
    return turns * 360 + (360 - (segment * size + size / 2)) + Math.max(-0.35, Math.min(0.35, jitter)) * size;
  }
  const percent = (prize) => (COUNTS[prize] * 100) / SEGMENTS.length + "%";

  const clean = (text, max) => String(text || "").replace(/\s+$/g, "").slice(0, max);
  function addNotice(list, { id, title, body, at, by }) {
    title = clean(title, 60).trim();
    body = clean(body, 1000);
    if (!title) throw Error("タイトルを入れてください。");
    const next = (Array.isArray(list) ? list : []).filter((n) => n.id !== id);
    next.unshift({ id, title, body, at, by: clean(by, 24) });
    return next.sort((a, b) => b.at - a.at).slice(0, MAX_NOTICES);
  }
  const removeNotice = (list, id) => (Array.isArray(list) ? list : []).filter((n) => n.id !== id);
  // Notices newer than the last time this device opened the box.
  const unread = (list, seenAt) => (Array.isArray(list) ? list : []).filter((n) => n.at > (Number(seenAt) || 0)).length;

  const api = Object.freeze({ SEGMENTS, COUNTS, TIERS, MAX_NOTICES, dayKey, drawSegment, stopAngle, percent, addNotice, removeNotice, unread });
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NoticesModel = api;
})(typeof window === "object" ? window : globalThis);
