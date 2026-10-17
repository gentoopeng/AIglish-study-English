(function (root) {
  "use strict";
  const maxMessages = 10,
    lifetime = 7 * 86400000;
  function time(item) {
    const value =
      item.createdAt?.toMillis?.() ??
      (item.createdAt instanceof Date
        ? item.createdAt.getTime()
        : typeof item.createdAt === "number"
          ? item.createdAt
          : Number(item.sentAt));
    return Number.isFinite(value) ? value : 0;
  }
  function retained(rows, now = Date.now()) {
    return rows
      .filter(
        (item) => time(item) > now - lifetime && time(item) <= now + 60000,
      )
      .slice()
      .sort((a, b) => time(b) - time(a) || b.id.localeCompare(a.id))
      .slice(0, maxMessages);
  }
  const api = { maxMessages, lifetime, time, retained };
  root.GroupChatPolicy = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
