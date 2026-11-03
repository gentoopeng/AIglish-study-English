// Notices for one player in the お知らせボックス: points that came in because of something that
// happened elsewhere (a share of another player's line in すごろくビンゴ, a day's study time that
// has been counted). They are kept on this device, newest first, at most MAX of them, and
// are unread until the box is opened. Adding a notice with an id that is already there replaces
// it (the same day's study time counted again with more minutes is one notice, not two).
(function (root) {
  "use strict";
  const MAX = 50;
  const create = (store, now = () => Date.now()) => {
    const itemsKey = (id) => "aiglish_personal_notices_" + id,
      seenKey = (id) => "aiglish_personal_notices_seen_" + id;
    const read = (key) => {
      try {
        return JSON.parse(store.get(key) || "null");
      } catch {
        return null;
      }
    };
    const list = (id) => (Array.isArray(read(itemsKey(id))) ? read(itemsKey(id)).filter((n) => n && typeof n.id === "string" && Number.isFinite(n.at)) : []);
    const seen = (id) => Number(store.get(seenKey(id))) || 0;
    // entry: { id, title, body, amount }. Returns the stored notice.
    function add(id, entry) {
      if (!id || !entry || typeof entry.id !== "string" || !entry.id) throw Error("お知らせの内容を確認してください。");
      const item = {
        id: entry.id.slice(0, 80),
        title: String(entry.title || "").slice(0, 60),
        body: String(entry.body || "").slice(0, 300),
        amount: Math.max(0, Math.floor(Number(entry.amount) || 0)),
        at: Math.max(now(), 1),
      };
      const next = [item, ...list(id).filter((n) => n.id !== item.id)].sort((a, b) => b.at - a.at).slice(0, MAX);
      store.set(itemsKey(id), JSON.stringify(next));
      return item;
    }
    const unread = (id) => list(id).filter((n) => n.at > seen(id)).length;
    // Opening the box: everything up to the newest is read. Returns the time it was read up to.
    function markSeen(id) {
      const newest = list(id).reduce((a, n) => Math.max(a, n.at), 0);
      if (newest > seen(id)) store.set(seenKey(id), String(newest));
      return newest;
    }
    return { add, list, unread, markSeen, seen, MAX };
  };
  const fmt = (n) => Number(n || 0).toLocaleString("ja-JP");
  const api = { create, fmt };
  if (typeof window !== "undefined" && root === window) {
    const store = {
      get: (key) => {
        try {
          return localStorage.getItem(key);
        } catch {
          return null;
        }
      },
      set: (key, value) => {
        try {
          localStorage.setItem(key, value);
        } catch {}
      },
    };
    const real = create(store);
    // The box redraws its badge when something is added.
    const add = (id, entry) => {
      const item = real.add(id, entry);
      try {
        window.dispatchEvent(new Event("personal-notices-changed"));
      } catch {}
      return item;
    };
    window.PersonalNotices = Object.freeze({ ...real, add, fmt });
  }
  if (typeof module !== "undefined") module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
