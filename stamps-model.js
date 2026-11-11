// Stamps for the talk: a picture one player makes, prices and may sell; the player who buys it can use it in any
// talk. The rules that do not need the cloud (what a stamp is, what may be bought, what a bad value is) live here.
//  stamps/{id}        the stamp without its picture: { ownerId, ownerName, name, price, status, sales, createdAt, v }
//  stampImages/{id}   its picture: { image } (a small data URL, shown with <img> only)
//  users/{id}/stampBox/main   the ids the player may use: { ids: [...] }
// status: on (for sale), paused (the maker stopped selling), stopped (the 運営 stopped it), deleted (the 運営 removed it).
// Stopped and paused stamps can still be used by those who have them; a deleted one cannot (its picture is gone).
(function (root) {
  "use strict";
  const MAX_NAME = 20,
    MAX_PRICE = 10000,
    MAX_IMAGE = 36000,
    MAX_MADE = 20,
    SIZE = 192,
    COOLDOWN = 60e3,
    STATUSES = ["on", "paused", "stopped", "deleted"];
  const ID = /^[A-Za-z0-9_-]{8,40}$/,
    IMAGE = /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;
  const isId = (id) => typeof id === "string" && ID.test(id);
  // A picture that may be shown: one of the three image types, base64, small enough (an <img> source, never markup).
  const imageOk = (value) => typeof value === "string" && value.length <= MAX_IMAGE && IMAGE.test(value);
  const text = (value, max) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  // A price: a whole number of points from 0 (free) to MAX_PRICE.
  function priceOf(value) {
    const n = Number(value);
    if (value === "" || value === null || !Number.isFinite(n) || n < 0 || n > MAX_PRICE || Math.floor(n) !== n) throw Error("値段は0〜" + MAX_PRICE + "ptの整数で入れてください。");
    return n;
  }
  // A new stamp, ready to write.
  function make({ ownerId, ownerName, name, price, at }) {
    const label = text(name, MAX_NAME);
    if (!label) throw Error("スタンプの名前を入れてください。");
    if (!ownerId || typeof ownerId !== "string") throw Error("ログインしたアカウントで作れます。");
    return { ownerId, ownerName: text(ownerName, 30) || ownerId, name: label, price: priceOf(price), status: "on", sales: 0, createdAt: Number(at) || Date.now(), v: 1 };
  }
  // A stamp read back from the cloud: only known fields, in range; null when it is not a stamp.
  function clean(raw, id) {
    if (!raw || typeof raw !== "object" || typeof raw.ownerId !== "string" || !raw.ownerId) return null;
    const status = STATUSES.includes(raw.status) ? raw.status : "deleted";
    let price = Number(raw.price);
    price = Number.isFinite(price) && price >= 0 ? Math.min(MAX_PRICE, Math.floor(price)) : 0;
    return {
      id: isId(id) ? id : undefined,
      ownerId: raw.ownerId,
      ownerName: text(raw.ownerName, 30) || raw.ownerId,
      name: text(raw.name, MAX_NAME) || "スタンプ",
      price,
      status,
      sales: Math.max(0, Math.floor(Number(raw.sales) || 0)),
      createdAt: Number(raw.createdAt) || 0,
    };
  }
  const forSale = (stamp) => !!stamp && stamp.status === "on";
  const usable = (stamp) => !!stamp && stamp.status !== "deleted";
  // The ids a player may use, cleaned (known shape, no repeats, at most 2,000).
  const box = (ids) => [...new Set((Array.isArray(ids) ? ids : []).filter(isId))].slice(0, 2000);
  // May this stamp be bought now? Throws the reason. `seen`: the price the buyer was shown.
  function checkBuy({ stamp, id, me, owned, seen, balance, ownerGone }) {
    if (!isId(id)) throw Error("このスタンプは買えません。");
    if (!stamp) throw Error("このスタンプは見つかりません。");
    if (stamp.ownerId === me) throw Error("自分のスタンプは買えません（最初から使えます）。");
    if ((owned || []).includes(id)) throw Error("このスタンプはもう持っています。");
    if (stamp.status === "deleted") throw Error("このスタンプは削除されました。");
    if (stamp.status !== "on") throw Error("このスタンプは今は売られていません。");
    if (ownerGone) throw Error("このスタンプを作った人のアカウントがありません。");
    if (Number(seen) !== stamp.price) throw Error("値段が変わりました（今は " + stamp.price + "pt）。もう一度確かめてください。");
    if (stamp.price > 0 && (Number(balance) || 0) < stamp.price) throw Error("ポイントが足りません（所持 " + (Number(balance) || 0) + "pt）。");
    return stamp.price;
  }
  const api = { MAX_NAME, MAX_PRICE, MAX_IMAGE, MAX_MADE, SIZE, COOLDOWN, STATUSES, isId, imageOk, text, priceOf, make, clean, forSale, usable, box, checkBuy };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.StampsModel = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis);
