// Stamps for the talk: a picture one player makes, prices and may sell; the player who buys it can use it in any
// talk. The rules that do not need the cloud (what a stamp is, what may be bought, what a bad value is) live here.
//  stamps/{id}        the stamp without its picture: { ownerId, ownerName, name, price, status, sales, createdAt, v }
//  stampImages/{id}   its picture: { image } (a small data URL, shown with <img> only)
//  users/{id}/stampBox/main   the ids the player may use: { ids: [...] }
// status: pending (new, waiting for the 運営), rejected (the 運営 said no), on (for sale), paused (the maker stopped
// selling), stopped (the 運営 stopped it), deleted (the 運営 removed it).
// Before anything is sold the 運営 has to approve it. The maker pays a cost equal to the price: it is taken (held) when the stamp
// is sent in for approval, kept if the 運営 approves (feePaid), and given back if the 運営 says no. A change of the picture, or a price
// above what has been paid for (feePaid), goes to the 運営 again (review: "pending") while the approved version stays on sale.
// The picture waiting for approval is in stampDrafts/{id}; stampImages/{id} (with imageV in the stamp) is always an approved one.
// Stopped and paused stamps can still be used by those who have them; a deleted one cannot (its picture is gone).
(function (root) {
  "use strict";
  const MAX_NAME = 20,
    MAX_PRICE = 10000,
    MAX_IMAGE = 36000,
    MAX_MADE = 20,
    SIZE = 192,
    COOLDOWN = 60e3,
    STATUSES = ["pending", "rejected", "on", "paused", "stopped", "deleted"],
    MAX_LAYERS = 3;
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
    return { ownerId, ownerName: text(ownerName, 30) || ownerId, name: label, price: priceOf(price), status: "pending", sales: 0, createdAt: Number(at) || Date.now(), feePaid: 0, feeHeld: 0, imageV: 0, v: 2 };
  }
  // A stamp read back from the cloud: only known fields, in range; null when it is not a stamp.
  function clean(raw, id) {
    if (!raw || typeof raw !== "object" || typeof raw.ownerId !== "string" || !raw.ownerId) return null;
    const status = STATUSES.includes(raw.status) ? raw.status : "deleted";
    let price = Number(raw.price);
    price = Number.isFinite(price) && price >= 0 ? Math.min(MAX_PRICE, Math.floor(price)) : 0;
    const whole = (v, max = MAX_PRICE) => Math.min(max, Math.max(0, Math.floor(Number(v) || 0)));
    const approved = status === "on" || status === "paused" || status === "stopped";
    // A stamp made before approval existed has no feePaid: it was on sale already, so its price counts as paid.
    const feePaid = raw.feePaid === undefined && approved ? price : whole(raw.feePaid);
    const next = raw.next && typeof raw.next === "object" && raw.next.price !== undefined ? { price: whole(raw.next.price) } : null;
    return {
      id: isId(id) ? id : undefined,
      feePaid,
      feeHeld: whole(raw.feeHeld),
      imageV: whole(raw.imageV, 1e6),
      draft: raw.draft === true,
      review: raw.review === "pending" ? "pending" : "",
      reviewNote: text(raw.reviewNote, 100),
      rejectReason: text(raw.rejectReason, 100),
      approvedAt: Number(raw.approvedAt) || 0,
      next,
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
  // Waiting for the 運営 (new) or turned down: only the maker and the 運営 see these.
  const unreviewed = (stamp) => !!stamp && (stamp.status === "pending" || stamp.status === "rejected");
  // May this player see (and use) the stamp? Everybody: what is approved; the maker and the 運営: also what is waiting.
  const usable = (stamp, me, admin) => !!stamp && stamp.status !== "deleted" && (!unreviewed(stamp) || admin === true || (!!me && stamp.ownerId === me));
  // What has to be paid to have the stamp at `price` approved: what is not paid yet.
  const feeFor = (stamp, price) => Math.max(0, priceOf(price) - (Number(stamp?.feePaid) || 0));
  // What an edit does. patch: { name, price, picture: true if the picture/text changed }. Throws the reason it may not be made.
  function planEdit(stamp, patch) {
    if (!stamp) throw Error("このスタンプは見つかりません。");
    if (stamp.status === "stopped" || stamp.status === "deleted") throw Error("このスタンプは運営が止めているため、変えられません。");
    if (stamp.review === "pending") throw Error("運営の確認中は変えられません。確認を取り消すか、結果を待ってください。");
    const plan = { name: undefined, price: undefined, review: false, next: null, hold: 0 };
    if (patch.name !== undefined) plan.name = text(patch.name, MAX_NAME) || (() => { throw Error("スタンプの名前を入れてください。"); })();
    const price = patch.price === undefined ? stamp.price : priceOf(patch.price);
    const fee = feeFor(stamp, price);
    if (stamp.status === "pending" || stamp.status === "rejected") {
      // Not approved yet: whatever is changed, it is sent in again with the whole cost held.
      plan.price = price;
      plan.review = true;
      plan.hold = fee - stamp.feeHeld;
      return plan;
    }
    if (patch.picture || fee > 0) {
      // A new picture, or a price above what has been paid for: the approved one stays on sale until this is approved.
      plan.review = true;
      plan.next = { price };
      plan.hold = fee;
      return plan;
    }
    // A lower (or the same) price, or only the name: at once. (A lower price never lowers what was paid.)
    plan.price = price;
    return plan;
  }
  // ---- Text on a stamp ------------------------------------------------------------------------------------
  // Fonts are chosen from this list only (system fonts, so they work offline); the picture is drawn with them on a canvas.
  const FONTS = [
    { id: "gothic", name: "ゴシック", css: '"Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans JP","Yu Gothic",Meiryo,sans-serif', weight: 700 },
    { id: "mincho", name: "明朝", css: '"Hiragino Mincho ProN","Noto Serif JP","Yu Mincho","MS PMincho",serif', weight: 700 },
    { id: "maru", name: "丸ゴシック", css: '"Hiragino Maru Gothic ProN","M PLUS Rounded 1c","Arial Rounded MT Bold","Yu Gothic",sans-serif', weight: 700 },
    { id: "pop", name: "ふとい", css: '"Arial Black","Impact","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif', weight: 900 },
    { id: "hand", name: "手書き風", css: '"Klee","Yuji Syuku","Hannotate SC","Segoe Print","Comic Sans MS",cursive', weight: 400 },
    { id: "mono", name: "等幅", css: '"Courier New","Osaka-Mono",monospace', weight: 700 },
  ];
  const fontOf = (id) => FONTS.find((f) => f.id === id) || FONTS[0];
  const COLOR = /^#[0-9a-fA-F]{6}$/;
  const num = (v, lo, hi, d) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  const colour = (v, d) => (typeof v === "string" && COLOR.test(v) ? v.toLowerCase() : d);
  // A design read back (or made by the editor): up to 3 text layers, every value in range, nothing else.
  function cleanDesign(raw) {
    const bg = raw && typeof raw.bg === "object" && raw.bg ? raw.bg : {};
    const layers = (Array.isArray(raw?.layers) ? raw.layers : []).filter((l) => text(l?.text, MAX_NAME)).slice(0, MAX_LAYERS).map((l) => ({
      text: text(l?.text, MAX_NAME),
      font: fontOf(l?.font).id,
      color: colour(l?.color, "#ffffff"),
      size: Math.round(num(l?.size, 10, 96, 40)),
      stroke: { color: colour(l?.stroke?.color, "#000000"), width: Math.round(num(l?.stroke?.width, 0, 12, 4)) },
      rot: Math.round(num(l?.rot, -180, 180, 0)),
      x: Math.round(num(l?.x, 0, 1, 0.5) * 1000) / 1000,
      y: Math.round(num(l?.y, 0, 1, 0.5) * 1000) / 1000,
    }));
    return { v: 1, bg: { color: bg.color === "none" || bg.color === undefined ? "none" : colour(bg.color, "none") }, layers: layers.filter((l) => l.text) };
  }
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
  const api = { MAX_NAME, MAX_PRICE, MAX_IMAGE, MAX_MADE, MAX_LAYERS, SIZE, COOLDOWN, STATUSES, FONTS, fontOf, isId, imageOk, text, priceOf, make, clean, forSale, unreviewed, usable, feeFor, planEdit, cleanDesign, box, checkBuy };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.StampsModel = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis);
