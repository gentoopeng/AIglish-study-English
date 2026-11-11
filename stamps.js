// Stamps for the talk: make one from a picture, sell it, buy others', and use what you have in a 1:1 talk.
// The rules are in stamps-model.js; the purchase itself (one transaction that also moves the points) is
// PointLoans.buyStamp. Data: stamps/{id} (no picture), stampImages/{id} (the approved picture), stampDrafts/{id} (a picture
// waiting for the 運営), users/{id}/stampBox/main. New stamps and changed pictures go through approval (PointLoans.submitStamp).
(function () {
  "use strict";
  const M = window.StampsModel;
  const uid = () => (typeof myId === "string" && myId) || "GUEST-000";
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const fmt = (n) => Number(n).toLocaleString("ja-JP");
  const newId = () => (Date.now().toString(36) + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6)).slice(0, 30);
  const cloud = () => !!(window.db && window.fbDoc && window.fbGetDoc && window.fbSetDoc);
  const guard = () => {
    if (uid() === "GUEST-000") throw Error("スタンプはログインしたアカウントで使えます。");
    if (!cloud()) throw Error("クラウドにつながっていません。");
    if (window.FirestoreReadGuard?.paused?.()) throw Error("クラウドの利用上限に達しています。時間をおいてお試しください。");
  };
  const stampRef = (id) => window.fbDoc(window.db, "stamps", id);
  const imageRef = (id) => window.fbDoc(window.db, "stampImages", id);
  const draftRef = (id) => window.fbDoc(window.db, "stampDrafts", id);
  const boxRef = (id = uid()) => window.fbDoc(window.db, "users", id, "stampBox", "main");

  // ---- What was read (kept, so the talk shows at once) ----------------------------------------
  const metas = new Map(), // id -> { stamp, at }
    images = new Map(); // id -> data URL ('' once known to be gone)
  const IMG_KEY = (id) => "aiglish_stamp_image_" + id,
    IMG_VER = (id) => "aiglish_stamp_image_v_" + id,
    IMG_INDEX = "aiglish_stamp_images";
  const META_TTL = 10 * 60e3;
  function keepImage(id, image, v = 0) {
    try {
      const index = JSON.parse(localStorage.getItem(IMG_INDEX) || "[]").filter((k) => k !== id);
      index.push(id);
      // At most 40 pictures on the device, the oldest first out (a write that does not fit is simply not kept).
      for (const old of index.splice(0, Math.max(0, index.length - 40))) (localStorage.removeItem(IMG_KEY(old)), localStorage.removeItem(IMG_VER(old)));
      localStorage.setItem(IMG_KEY(id), image);
      localStorage.setItem(IMG_VER(id), String(v));
      localStorage.setItem(IMG_INDEX, JSON.stringify(index));
    } catch {}
  }
  function dropImage(id) {
    images.delete(id);
    try {
      localStorage.removeItem(IMG_KEY(id));
      localStorage.removeItem(IMG_VER(id));
      localStorage.setItem(IMG_INDEX, JSON.stringify(JSON.parse(localStorage.getItem(IMG_INDEX) || "[]").filter((k) => k !== id)));
    } catch {}
  }
  // A stamp's data without its picture (null: gone or never was).
  async function get(id, fresh = false) {
    if (!M.isId(id)) return null;
    const hit = metas.get(id);
    if (hit && !fresh && Date.now() - hit.at < META_TTL) return hit.stamp;
    guard();
    const snap = await window.fbGetDoc(stampRef(id));
    const stamp = snap.exists() ? M.clean(snap.data(), id) : null;
    metas.set(id, { stamp, at: Date.now() });
    if (!stamp || stamp.status === "deleted") dropImage(id);
    return stamp;
  }
  // The approved picture (a data URL checked to be one), '' when there is none. `v`: the picture's version (stamp.imageV): a
  // picture kept at another version is read again. Without `v`, whatever is kept is used.
  async function image(id, v) {
    if (!M.isId(id)) return "";
    const held = images.get(id);
    if (held && (v === undefined || held.v === v)) return held.data;
    if (!held || v !== undefined) {
      try {
        const kept = localStorage.getItem(IMG_KEY(id)),
          keptV = Number(localStorage.getItem(IMG_VER(id))) || 0;
        if (kept && M.imageOk(kept) && (v === undefined || keptV === v)) {
          images.set(id, { data: kept, v: keptV });
          return kept;
        }
      } catch {}
    }
    try {
      guard();
      const snap = await window.fbGetDoc(imageRef(id));
      const value = snap.exists() ? snap.data().image : "";
      const ok = M.imageOk(value) ? value : "";
      images.set(id, { data: ok, v: v ?? 0 });
      if (ok) keepImage(id, ok, v ?? 0);
      return ok;
    } catch (error) {
      console.warn("[stamps] image", error);
      return "";
    }
  }
  // The picture waiting for the 運営 and its design (the maker and the 運営 only; never kept on the device).
  async function draft(id) {
    if (!M.isId(id)) return null;
    try {
      guard();
      const snap = await window.fbGetDoc(draftRef(id));
      const data = snap.exists() ? snap.data() : null;
      return data && M.imageOk(data.image) ? { image: data.image, base: M.imageOk(data.base) ? data.base : "", design: data.design ? M.cleanDesign(data.design) : null } : null;
    } catch (error) {
      console.warn("[stamps] draft", error);
      return null;
    }
  }
  // What the editor opens: the waiting version (draft) or the approved one, with the picture it was made on and its text design.
  async function source(stamp) {
    if (stamp.draft) {
      const d = await draft(stamp.id);
      if (d) return d;
    }
    try {
      guard();
      const snap = await window.fbGetDoc(imageRef(stamp.id));
      const data = snap.exists() ? snap.data() : null;
      return data && M.imageOk(data.image) ? { image: data.image, base: M.imageOk(data.base) ? data.base : "", design: data.design ? M.cleanDesign(data.design) : null } : null;
    } catch {
      return null;
    }
  }
  // The picture to show a player: the waiting one to the maker and the 運営, the approved one to everybody.
  async function pictureOf(stamp) {
    if (!stamp) return "";
    const me = uid();
    if (stamp.draft && (stamp.ownerId === me || window.isAdmin === true)) {
      const waiting = (await draft(stamp.id))?.image;
      if (waiting) return waiting;
      // (the waiting copy is gone: it was answered since this was read, so the approved picture is the one)
      return image(stamp.id, stamp.imageV ? stamp.imageV : undefined);
    }
    return image(stamp.id, stamp.imageV);
  }
  // Forget what is kept about a stamp (after it was changed).
  function forget(id) {
    metas.delete(id);
  }
  // ---- What the player has -----------------------------------------------------------------------
  let boxCache = { owner: "", ids: [], at: 0 };
  async function mine(fresh = false) {
    const me = uid();
    if (me === "GUEST-000") return [];
    if (!fresh && boxCache.owner === me && Date.now() - boxCache.at < 5 * 60e3) return boxCache.ids;
    guard();
    const snap = await window.fbGetDoc(boxRef(me));
    boxCache = { owner: me, ids: snap.exists() ? M.box(snap.data().ids) : [], at: Date.now() };
    return boxCache.ids;
  }
  const remember = (ids) => (boxCache = { owner: uid(), ids: M.box(ids), at: Date.now() });

  // ---- Making ---------------------------------------------------------------------------------------
  // The picture, small enough for the cloud: WebP first (PNG if the browser cannot make WebP), then smaller / JPEG.
  async function prepare(file) {
    if (!window.ProfileImages?.imageFile) throw Error("画像を読み込めません。");
    const tries = [
      [M.SIZE, "image/webp", 0.8],
      [M.SIZE, "image/webp", 0.6],
      [160, "image/webp", 0.6],
      [160, "image/jpeg", 0.7],
      [128, "image/jpeg", 0.6],
    ];
    for (const [size, format, quality] of tries) {
      const data = await window.ProfileImages.imageFile(file, size, format, () => true, quality);
      if (M.imageOk(data)) return data;
    }
    throw Error("画像が大きすぎます。もっと小さい画像を選んでください。");
  }
  const lastMade = () => Number(localStorage.getItem("aiglish_stamp_made_at_" + uid())) || 0;
  // Send a new stamp in for approval. `image` (a picture made in the editor, with its `design`) or `file` (a plain picture).
  // The cost (the price) is held until the 運営 answers.
  async function create({ file, image: made, base, design, name, price, rights }) {
    guard();
    if (!rights) throw Error("「自分で作った画像（または使っていい画像）です」にチェックを入れてください。");
    const wait = M.COOLDOWN - (Date.now() - lastMade());
    if (wait > 0) throw Error("続けて作れません。あと " + Math.ceil(wait / 1000) + "秒 待ってください。");
    const me = uid(),
      at = Date.now(),
      id = newId();
    const doc = M.make({ ownerId: me, ownerName: window.myName || me, name, price, at });
    if (!made && !file) throw Error("画像を選ぶか、文字を入れてください。");
    const data = made || (await prepare(file));
    if (!M.imageOk(data)) throw Error("画像が大きすぎます。");
    // How many this player has made (a query of their own).
    if (window.fbGetDocs && window.fbQuery && window.fbWhere && window.fbCollection) {
      const list = await window.fbGetDocs(window.fbQuery(window.fbCollection(window.db, "stamps"), window.fbWhere("ownerId", "==", me)));
      let n = 0;
      list.forEach((d) => d.data()?.status !== "deleted" && n++);
      if (n >= M.MAX_MADE) throw Error("作れるスタンプは " + M.MAX_MADE + "個までです。");
    }
    await window.PointLoans.submitStamp(id, { isNew: true, doc, image: data, base: M.imageOk(base) ? base : null, design: design ? M.cleanDesign(design) : null });
    try {
      localStorage.setItem("aiglish_stamp_made_at_" + me, String(at));
    } catch {}
    metas.delete(id);
    boxCache = { owner: me, ids: [...(boxCache.owner === me ? boxCache.ids : []), id], at: Date.now() };
    return id;
  }
  // The maker changes a stamp. A new name, or a price that is not above what was paid, or stopping / resuming sales, happen at
  // once. A new picture (or text), or a price above what was paid, is sent in for approval (the difference is held); the approved
  // stamp stays on sale meanwhile. patch: { name, price, status, image, design }
  async function edit(id, patch) {
    guard();
    const me = uid();
    const stamp = await get(id, true);
    if (!stamp || stamp.ownerId !== me) throw Error("自分のスタンプだけ変えられます。");
    if (patch.status === undefined) {
      const plan = M.planEdit(stamp, { name: patch.name, price: patch.price, picture: !!patch.image });
      if (plan.review) {
        await window.PointLoans.submitStamp(id, { name: patch.name, price: patch.price, image: patch.image || null, base: M.imageOk(patch.base) ? patch.base : null, design: patch.design ? M.cleanDesign(patch.design) : null });
        forget(id);
        images.delete(id);
        return "review";
      }
    }
    await change(id, patch);
    return "done";
  }
  // The instant changes: name, a price that needs no approval, and on / paused for a stamp that has been approved.
  async function change(id, patch) {
    guard();
    const me = uid();
    await window.fbRunTransaction(window.db, async (tx) => {
      const snap = await tx.get(stampRef(id));
      const stamp = snap.exists() ? M.clean(snap.data(), id) : null;
      if (!stamp || stamp.ownerId !== me) throw Error("自分のスタンプだけ変えられます。");
      if (patch.status !== undefined && stamp.status !== "on" && stamp.status !== "paused") throw Error("運営の承認が終わってから切り替えられます。");
      const plan = M.planEdit(stamp, { name: patch.name, price: patch.price });
      if (plan.review) throw Error("この変更は運営の確認が必要です。「編集」から送ってください。");
      const next = {};
      if (plan.name !== undefined) next.name = plan.name;
      if (plan.price !== undefined && patch.price !== undefined) next.price = plan.price;
      if (patch.status !== undefined) {
        if (patch.status !== "on" && patch.status !== "paused") throw Error("不明な操作です。");
        if (stamp.status !== "on" && stamp.status !== "paused") throw Error("運営の承認が終わってから切り替えられます。");
        next.status = patch.status;
      }
      tx.set(stampRef(id), next, { merge: true });
    });
    metas.delete(id);
  }
  // The 運営 stops, resumes (only what was stopped) or removes. Removing deletes the picture (those who bought it keep nothing
  // to use; no refund); what is waiting for approval is turned down first, so the held cost goes back.
  async function moderate(id, status) {
    if (window.isAdmin !== true) throw Error("運営だけができます。");
    guard();
    if (status !== "on" && status !== "stopped" && status !== "deleted") throw Error("不明な操作です。");
    const stamp = await get(id, true);
    if (!stamp) throw Error("このスタンプは見つかりません。");
    if (status === "on" && stamp.status !== "stopped") throw Error("承認するには「承認」を使ってください。");
    if (status === "stopped" && stamp.status !== "on" && stamp.status !== "paused") throw Error("止められるのは売り出し中のスタンプです。");
    if (status === "deleted" && (stamp.status === "pending" || stamp.review === "pending")) await window.PointLoans.reviewStamp(id, "reject", "削除されました");
    await window.fbSetDoc(stampRef(id), { status, moderatedAt: Date.now() }, { merge: true });
    if (status === "deleted" && window.fbDeleteDoc) {
      await window.fbDeleteDoc(imageRef(id));
      await window.fbDeleteDoc(draftRef(id)).catch(() => {});
    }
    dropImage(id);
    metas.delete(id);
  }
  async function review(id, decision, reason) {
    await window.PointLoans.reviewStamp(id, decision, reason);
    metas.delete(id);
    images.delete(id);
  }
  async function report(id) {
    guard();
    await window.fbSetDoc(window.fbDoc(window.db, "stampReports", id), { reporters: { [uid()]: Date.now() }, stampId: id }, { merge: true });
  }
  async function reportCount(id) {
    try {
      const snap = await window.fbGetDoc(window.fbDoc(window.db, "stampReports", id));
      return snap.exists() ? Object.keys(snap.data().reporters || {}).length : 0;
    } catch {
      return 0;
    }
  }
  // For the 運営: what waits for approval (new stamps, and changes to ones on sale).
  async function queue() {
    guard();
    if (window.isAdmin !== true) return [];
    const found = new Map();
    for (const field of ["status", "review"]) {
      const snap = await window.fbGetDocs(window.fbQuery(window.fbCollection(window.db, "stamps"), window.fbWhere(field, "==", "pending"), window.fbLimit(50)));
      snap.forEach((d) => {
        const stamp = M.clean(d.data(), d.id);
        if (stamp && (stamp.status === "pending" || stamp.review === "pending")) {
          stamp.id = d.id;
          metas.set(d.id, { stamp, at: Date.now() });
          found.set(d.id, stamp);
        }
      });
    }
    return [...found.values()].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }
  // One page of the store, newest first (the page is the metadata only; pictures are read as they are shown).
  async function page(cursor) {
    guard();
    const parts = [window.fbCollection(window.db, "stamps"), window.fbOrderBy("createdAt", "desc")];
    if (cursor) parts.push(window.fbStartAfter(cursor));
    parts.push(window.fbLimit(20));
    const snap = await window.fbGetDocs(window.fbQuery(...parts));
    const list = [];
    snap.forEach((d) => {
      const stamp = M.clean(d.data(), d.id);
      if (stamp) {
        stamp.id = d.id;
        metas.set(d.id, { stamp, at: Date.now() });
        list.push(stamp);
      }
    });
    return { list, cursor: snap.docs?.length ? snap.docs[snap.docs.length - 1] : null, last: !snap.docs || snap.docs.length < 20 };
  }

  // ---- Showing ----------------------------------------------------------------------------------------
  // A stamp in a talk: the picture; a plain card while it loads, and for one that is gone.
  function bubble(id) {
    const box = node("div", "talk-stamp");
    const fill = (src) => {
      box.replaceChildren();
      if (src) {
        const img = node("img");
        img.alt = "スタンプ";
        img.src = src;
        img.decoding = "async";
        box.append(img);
      } else {
        box.classList.add("is-gone");
        box.append(node("span", "", "スタンプは使えません"));
      }
    };
    box.append(node("span", "talk-stamp-wait", "…"));
    // A removed stamp is not shown even if its picture is still on this device (its data is looked at, kept 10 minutes).
    get(id)
      .then(
        (stamp) => (M.usable(stamp, uid(), window.isAdmin === true) ? pictureOf(stamp) : ""),
        () => image(id),
      )
      .then(fill, () => fill(""));
    return box;
  }
  function img(id, cls) {
    const el = node("img", cls || "stamp-img");
    el.alt = "";
    el.dataset.stamp = id;
    el.loading = "lazy";
    return el;
  }
  // Pictures are read when they scroll into view. `load`: how to get the picture (default: the approved one).
  const loaders = new WeakMap();
  const fillImg = (el) => (loaders.get(el) || (() => image(el.dataset.stamp)))().then((src) => (src ? (el.src = src) : el.classList.add("is-gone")), () => el.classList.add("is-gone"));
  const seen =
    "IntersectionObserver" in window
      ? new IntersectionObserver((entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            seen.unobserve(e.target);
            fillImg(e.target);
          }
        })
      : null;
  const lazy = (el, load) => {
    if (load) loaders.set(el, load);
    if (seen) seen.observe(el);
    else fillImg(el);
  };

  // ---- Screens ------------------------------------------------------------------------------------------
  let shell = null;
  function close() {
    if (shell) {
      shell.close();
      shell.remove();
      shell = null;
    }
  }
  function frame(title) {
    close();
    const dialog = node("dialog", "stamps-dialog");
    dialog.setAttribute("aria-label", title);
    const head = node("header", "stamps-head");
    const back = node("button", "stamps-close", "×");
    back.type = "button";
    back.setAttribute("aria-label", "閉じる");
    back.onclick = close;
    head.append(node("h2", "", title), back);
    const body = node("div", "stamps-body");
    const status = node("p", "stamps-status");
    status.setAttribute("role", "status");
    dialog.append(head, status, body);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });
    document.body.append(dialog);
    dialog.showModal();
    shell = dialog;
    return { dialog, body, status };
  }
  const say = (status, text, bad) => {
    status.textContent = text || "";
    status.classList.toggle("is-bad", !!bad);
  };
  const priceText = (stamp) => (stamp.price > 0 ? fmt(stamp.price) + "pt" : "無料");
  // The store: others' stamps to buy, the player's own to manage, and the 運営's stop / remove.
  async function store(onChange, note) {
    const { body, status } = frame("スタンプストア");
    if (note) say(status, note);
    const admin = window.isAdmin === true,
      me = uid();
    const make = node("button", "stamps-make", "＋ スタンプを作る");
    make.type = "button";
    make.onclick = () => create_((note) => store(onChange, note));
    const grid = node("div", "stamps-grid");
    const more = node("button", "stamps-more", "もっと見る");
    more.type = "button";
    more.hidden = true;
    body.append(make, grid, more);
    let owned = [];
    try {
      owned = await mine();
    } catch (error) {
      say(status, error.message, true);
    }
    const card = (stamp) => {
      const li = node("div", "stamps-card" + (stamp.status !== "on" ? " is-off" : ""));
      const picture = img(stamp.id);
      li.append(picture, node("b", "stamps-name", stamp.name), node("small", "stamps-by", stamp.ownerName), node("span", "stamps-price", priceText(stamp)));
      lazy(picture, () => pictureOf(stamp));
      const mineNow = stamp.ownerId === me;
      const note =
        { pending: "運営の審査待ち", rejected: "審査に通りませんでした", paused: "販売をやめています", stopped: "運営が停止中", deleted: "削除されました" }[stamp.status] ||
        (stamp.review === "pending" ? "変更を審査中（今までの内容で販売中）" : "");
      if (note) li.append(node("em", "stamps-note", note));
      if (stamp.status === "rejected" && stamp.rejectReason && (mineNow || admin)) li.append(node("small", "stamps-reason", "理由: " + stamp.rejectReason));
      if (stamp.review !== "pending" && stamp.reviewNote && mineNow) li.append(node("small", "stamps-reason", "変更は通りませんでした: " + stamp.reviewNote));
      const actions = node("div", "stamps-actions");
      const button = (text, onClick, cls) => {
        const b = node("button", cls || "", text);
        b.type = "button";
        b.onclick = onClick;
        actions.append(b);
        return b;
      };
      const mineStamp = stamp.ownerId === me;
      if (owned.includes(stamp.id)) li.append(node("em", "stamps-have", mineStamp ? "あなたが作りました" : "持っています"));
      else if (M.forSale(stamp) && !mineStamp) {
        let armed = false;
        const buy = button("買う", async () => {
          if (!armed) {
            armed = true;
            buy.textContent = priceText(stamp) + "で買う（もう一度）";
            setTimeout(() => {
              armed = false;
              buy.textContent = "買う";
            }, 4000);
            return;
          }
          buy.disabled = true;
          say(status, "");
          try {
            await window.PointLoans.buyStamp(stamp.id, stamp.price);
            owned = await mine(true);
            say(status, "「" + stamp.name + "」を買いました。トークで使えます。");
            li.querySelector(".stamps-actions")?.remove();
            li.append(node("em", "stamps-have", "持っています"));
            onChange?.();
          } catch (error) {
            say(status, error?.message || "買えませんでした。", true);
            buy.disabled = false;
            armed = false;
            buy.textContent = "買う";
          }
        }, "stamps-buy");
      }
      if (mineStamp && stamp.status !== "stopped" && stamp.status !== "deleted") {
        if (stamp.review === "pending" || stamp.status === "pending") {
          button("取り下げる（費用は戻ります）", async () => {
            if (!window.confirm("審査を取り下げます。預けた費用は戻ります。")) return;
            try {
              await review(stamp.id, "withdraw");
              store(onChange);
            } catch (error) {
              say(status, error.message, true);
            }
          });
        } else button("編集", () => edit_(stamp, (note) => store(onChange, note)));
        if (stamp.status === "on" || stamp.status === "paused")
          button(stamp.status === "paused" ? "販売を再開" : "販売をやめる", async () => {
            try {
              await change(stamp.id, { status: stamp.status === "paused" ? "on" : "paused" });
              store(onChange);
            } catch (error) {
              say(status, error.message, true);
            }
          });
      }
      if (admin) {
        if (stamp.status !== "deleted") {
          if (stamp.status === "pending" || stamp.review === "pending") {
            button("承認（運営）", async () => {
              try {
                await review(stamp.id, "approve");
                store(onChange);
              } catch (error) {
                say(status, error.message, true);
              }
            }, "stamps-buy");
            button("却下（運営）", async () => {
              const reason = window.prompt("却下の理由（作った人に表示されます。費用は返します）", "");
              if (reason === null) return;
              try {
                await review(stamp.id, "reject", reason);
                store(onChange);
              } catch (error) {
                say(status, error.message, true);
              }
            }, "stamps-danger");
          } else if (stamp.status === "stopped" || stamp.status === "on" || stamp.status === "paused")
            button(stamp.status === "stopped" ? "販売を再開（運営）" : "販売を停止（運営）", async () => {
              try {
                await moderate(stamp.id, stamp.status === "stopped" ? "on" : "stopped");
                store(onChange);
              } catch (error) {
                say(status, error.message, true);
              }
            });
          button("削除（運営）", async () => {
            if (!window.confirm("「" + stamp.name + "」を削除します。画像が消え、買った人も使えなくなります（払ったポイントは戻りません）。")) return;
            try {
              await moderate(stamp.id, "deleted");
              store(onChange);
            } catch (error) {
              say(status, error.message, true);
            }
          }, "stamps-danger");
        }
        reportCount(stamp.id).then((n) => n && li.append(node("em", "stamps-reports", "通報 " + n + "件")));
      } else if (!mineStamp) {
        button("通報", async () => {
          try {
            await report(stamp.id);
            say(status, "通報しました。運営が確認します。");
          } catch (error) {
            say(status, error.message, true);
          }
        }, "stamps-report");
      }
      if (actions.children.length) li.append(actions);
      return li;
    };
    let cursor = null;
    const shownIds = new Set();
    // The 運営 sees what is waiting first (a query of its own, so it is not buried under newer stamps).
    if (admin) {
      try {
        const waiting = await queue();
        if (waiting.length) grid.append(node("p", "stamps-queue", "審査待ち " + waiting.length + "件"));
        for (const stamp of waiting) (shownIds.add(stamp.id), grid.append(card(stamp)));
      } catch (error) {
        say(status, error?.message || "審査待ちを読めませんでした。", true);
      }
    }
    const load = async () => {
      more.disabled = true;
      try {
        const result = await page(cursor);
        cursor = result.cursor;
        // (Everybody sees what is for sale; the maker sees their own whatever they are; the 運営 sees all.)
        for (const stamp of result.list) if (!shownIds.has(stamp.id) && (admin ? true : stamp.status === "on" || (stamp.ownerId === me && stamp.status !== "deleted"))) (shownIds.add(stamp.id), grid.append(card(stamp)));
        more.hidden = result.last;
        if (!grid.children.length && result.last) grid.append(node("p", "stamps-empty", "まだスタンプがありません。最初のスタンプを作ってみましょう。"));
      } catch (error) {
        say(status, error?.message || "読み込めませんでした。", true);
      } finally {
        more.disabled = false;
      }
    };
    more.onclick = load;
    await load();
  }
  // Make a stamp, or change one of the player's own: the editor (stamp-editor.js) has the picture, the text, the name and the price.
  function create_(done) {
    if (!window.StampEditor) throw Error("エディターを使えません。");
    window.StampEditor.open({ done });
  }
  async function edit_(stamp, done) {
    if (!window.StampEditor) throw Error("エディターを使えません。");
    window.StampEditor.open({ stamp, done });
  }
  // The tray in a talk: what the player has, to send one, and the way to the store.
  function tray(host, { onPick, onStore }) {
    host.replaceChildren();
    const grid = node("div", "stamps-tray");
    const store_ = node("button", "stamps-store", "ストア");
    store_.type = "button";
    store_.onclick = () => (onStore ? onStore() : store());
    host.append(grid, store_);
    const wait = node("p", "stamps-hint", "読み込み中…");
    grid.append(wait);
    mine(true).then(
      async (ids) => {
        grid.replaceChildren();
        const usable = [];
        for (const id of ids) {
          // Removed ones are hidden here (their id stays in the list).
          try {
            const stamp = await get(id);
            // Only what is approved can be sent (the others would show nothing to the one who gets it).
            if (M.usable(stamp, uid(), window.isAdmin === true) && !M.unreviewed(stamp)) usable.push({ id, stamp });
          } catch {}
        }
        if (!usable.length) return grid.append(node("p", "stamps-hint", "スタンプがありません。ストアで買うか、自分で作れます。"));
        for (const { id, stamp } of usable) {
          const b = node("button", "stamps-pick");
          b.type = "button";
          b.setAttribute("aria-label", "スタンプを送る");
          const picture = img(id);
          b.append(picture);
          lazy(picture, () => pictureOf(stamp));
          b.onclick = () => onPick(id);
          grid.append(b);
        }
      },
      (error) => (wait.textContent = error?.message || "読み込めませんでした。"),
    );
  }
  window.Stamps = Object.freeze({
    get, image, draft, source, prepare, pictureOf, forget, mine, remember, bubble, tray, store, create: create_, make: create, edit, close, report, change, moderate, review, queue,
    ui: { frame, say, node, priceText },
  });
})();
