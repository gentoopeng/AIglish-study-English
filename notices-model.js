// The お知らせボックス without any screen or network: the daily login bonus (which prize, which
// day it is in Japan) and the list of notices from the team.
(function (root) {
  "use strict";
  // The wheel, clockwise from the top. Each prize has one segment; how often it comes up is its
  // weight out of 1000. On average a day's spin pays 66pt.
  const PRIZES = [1000, 10, 200, 50, 500, 100];
  const WEIGHTS = { 10: 450, 50: 300, 100: 150, 200: 70, 500: 25, 1000: 5 };
  const MAX_NOTICES = 30;
  // The day changes at midnight in Japan, wherever the device is.
  function dayKey(now = Date.now()) {
    const d = new Date(now + 9 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  }
  function drawPrize(random = Math.random) {
    let r = Math.floor(random() * 1000);
    for (const prize of [10, 50, 100, 200, 500, 1000]) {
      r -= WEIGHTS[prize];
      if (r < 0) return prize;
    }
    return 10;
  }
  // Where the wheel stops: whole turns plus the angle that puts the prize's segment under the
  // pointer at the top, a little off its centre so it does not look mechanical.
  function stopAngle(prize, turns = 6, jitter = 0) {
    const size = 360 / PRIZES.length,
      at = PRIZES.indexOf(prize);
    if (at < 0) throw Error("unknown prize");
    return turns * 360 + (360 - (at * size + size / 2)) + Math.max(-0.35, Math.min(0.35, jitter)) * size;
  }
  const percent = (prize) => WEIGHTS[prize] / 10 + "%";

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

  const api = Object.freeze({ PRIZES, WEIGHTS, MAX_NOTICES, dayKey, drawPrize, stopAngle, percent, addNotice, removeNotice, unread });
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NoticesModel = api;
})(typeof window === "object" ? window : globalThis);
