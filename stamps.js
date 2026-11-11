// Stamps for the talk: make one from a picture, sell it, buy others', and use what you have in a 1:1 talk.
// The rules are in stamps-model.js; the purchase itself (one transaction that also moves the points) is
// PointLoans.buyStamp. Data: stamps/{id} (no picture), stampImages/{id} (the picture), users/{id}/stampBox/main.
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
  const boxRef = (id = uid()) => window.fbDoc(window.db, "users", id, "stampBox", "main");

  // ---- What was read (kept, so the talk shows at once) ----------------------------------------
  const metas = new Map(), // id -> { stamp, at }
    images = new Map(); // id -> data URL ('' once known to be gone)
  const IMG_KEY = (id) => "aiglish_stamp_image_" + id,
    IMG_INDEX = "aiglish_stamp_images";
  const META_TTL = 10 * 60e3;
  function keepImage(id, image) {
    try {
      const index = JSON.parse(localStorage.getItem(IMG_INDEX) || "[]").filter((k) => k !== id);
      index.push(id);
      // At most 40 pictures on the device, the oldest first out (a write that does not fit is simply not kept).
      for (const old of index.splice(0, Math.max(0, index.length - 40))) localStorage.removeItem(IMG_KEY(old));
      localStorage.setItem(IMG_KEY(id), image);
      localStorage.setItem(IMG_INDEX, JSON.stringify(index));
    } catch {}
  }
  function dropImage(id) {
    images.delete(id);
    try {
      localStorage.removeItem(IMG_KEY(id));
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
  // The picture (a data URL checked to be one), '' when there is none.
  async function image(id) {
    if (!M.isId(id)) return "";
    if (images.has(id)) return images.get(id);
    try {
      const kept = localStorage.getItem(IMG_KEY(id));
      if (kept && M.imageOk(kept)) {
        images.set(id, kept);
        return kept;
      }
    } catch {}
    try {
      guard();
      const snap = await window.fbGetDoc(imageRef(id));
      const value = snap.exists() ? snap.data().image : "";
      const ok = M.imageOk(value) ? value : "";
      images.set(id, ok);
      if (ok) keepImage(id, ok);
      return ok;
    } catch (error) {
      console.warn("[stamps] image", error);
      return "";
    }
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
  async function create({ file, name, price, rights }) {
    guard();
    if (!rights) throw Error("「自分で作った画像（または使っていい画像）です」にチェックを入れてください。");
    const wait = M.COOLDOWN - (Date.now() - lastMade());
    if (wait > 0) throw Error("続けて作れません。あと " + Math.ceil(wait / 1000) + "秒 待ってください。");
    const me = uid(),
      at = Date.now(),
      id = newId();
    const doc = M.make({ ownerId: me, ownerName: window.myName || me, name, price, at });
    if (!file) throw Error("画像を選んでください。");
    const data = await prepare(file);
    // How many this player has made (a query of their own).
    if (window.fbGetDocs && window.fbQuery && window.fbWhere && window.fbCollection) {
      const made = await window.fbGetDocs(window.fbQuery(window.fbCollection(window.db, "stamps"), window.fbWhere("ownerId", "==", me)));
      let n = 0;
      made.forEach((d) => d.data()?.status !== "deleted" && n++);
      if (n >= M.MAX_MADE) throw Error("作れるスタンプは " + M.MAX_MADE + "個までです。");
    }
    await window.fbRunTransaction(window.db, async (tx) => {
      const snap = await tx.get(boxRef(me));
      const ids = snap.exists() ? M.box(snap.data().ids) : [];
      tx.set(stampRef(id), doc);
      tx.set(imageRef(id), { image: data, ownerId: me });
      tx.set(boxRef(me), { ids: [...ids, id], updatedAt: at }, { merge: true });
    });
    try {
      localStorage.setItem("aiglish_stamp_made_at_" + me, String(at));
    } catch {}
    metas.set(id, { stamp: M.clean(doc, id), at });
    images.set(id, data);
    keepImage(id, data);
    boxCache = { owner: me, ids: [...(boxCache.owner === me ? boxCache.ids : []), id], at: Date.now() };
    return id;
  }
  // The maker changes the price, or stops / resumes selling (not once the 運営 has stopped or removed it).
  async function change(id, patch) {
    guard();
    const me = uid();
    await window.fbRunTransaction(window.db, async (tx) => {
      const snap = await tx.get(stampRef(id));
      const stamp = snap.exists() ? M.clean(snap.data(), id) : null;
      if (!stamp || stamp.ownerId !== me) throw Error("自分のスタンプだけ変えられます。");
      if (stamp.status === "stopped" || stamp.status === "deleted") throw Error("このスタンプは運営が止めているため、変えられません。");
      const next = {};
      if (patch.price !== undefined) next.price = M.priceOf(patch.price);
      if (patch.status !== undefined) {
        if (patch.status !== "on" && patch.status !== "paused") throw Error("不明な操作です。");
        next.status = patch.status;
      }
      tx.set(stampRef(id), next, { merge: true });
    });
    metas.delete(id);
  }
  // The 運営: stop, resume, or remove (the picture goes; those who bought it keep the points they paid, nothing is refunded).
  async function moderate(id, status) {
    if (window.isAdmin !== true) throw Error("運営だけができます。");
    guard();
    if (status !== "on" && status !== "stopped" && status !== "deleted") throw Error("不明な操作です。");
    await window.fbSetDoc(stampRef(id), { status, moderatedAt: Date.now() }, { merge: true });
    if (status === "deleted" && window.fbDeleteDoc) await window.fbDeleteDoc(imageRef(id));
    dropImage(id);
    metas.delete(id);
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
        (stamp) => (M.usable(stamp) ? image(id) : ""),
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
  // Pictures are read when they scroll into view.
  const seen =
    "IntersectionObserver" in window
      ? new IntersectionObserver((entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            seen.unobserve(e.target);
            const el = e.target;
            image(el.dataset.stamp).then((src) => (src ? (el.src = src) : el.classList.add("is-gone")));
          }
        })
      : null;
  const lazy = (el) => (seen ? seen.observe(el) : image(el.dataset.stamp).then((src) => src && (el.src = src)));

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
  async function store(onChange) {
    const { body, status } = frame("スタンプストア");
    const admin = window.isAdmin === true,
      me = uid();
    const make = node("button", "stamps-make", "＋ スタンプを作る");
    make.type = "button";
    make.onclick = () => create_(() => store(onChange));
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
      lazy(picture);
      const note = { paused: "販売をやめています", stopped: "運営が停止中", deleted: "削除されました" }[stamp.status];
      if (note) li.append(node("em", "stamps-note", note));
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
        button("値段を変える", async () => {
          const value = window.prompt("新しい値段（0〜" + M.MAX_PRICE + "pt。0で無料）", String(stamp.price));
          if (value === null) return;
          try {
            await change(stamp.id, { price: value });
            stamp.price = M.priceOf(value);
            li.querySelector(".stamps-price").textContent = priceText(stamp);
            say(status, "値段を変えました。");
          } catch (error) {
            say(status, error.message, true);
          }
        });
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
    const load = async () => {
      more.disabled = true;
      try {
        const result = await page(cursor);
        cursor = result.cursor;
        // (Everybody sees what is for sale; the maker sees their own whatever they are; the 運営 sees all.)
        for (const stamp of result.list) if (admin ? true : stamp.status === "on" || (stamp.ownerId === me && stamp.status !== "deleted")) grid.append(card(stamp));
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
  // Make a stamp: a picture, a name and a price (0 for free).
  function create_(done) {
    const { body, status } = frame("スタンプを作る");
    const file = node("input");
    Object.assign(file, { type: "file", accept: "image/*" });
    file.setAttribute("aria-label", "画像");
    const preview = node("div", "stamps-preview");
    const name = node("input");
    Object.assign(name, { type: "text", maxLength: M.MAX_NAME, placeholder: "名前（" + M.MAX_NAME + "文字まで）" });
    name.setAttribute("aria-label", "名前");
    const price = node("input");
    Object.assign(price, { type: "number", min: 0, max: M.MAX_PRICE, step: 1, inputMode: "numeric", value: "0" });
    price.setAttribute("aria-label", "値段");
    const rights = node("input");
    rights.type = "checkbox";
    const rightsRow = node("label", "stamps-rights");
    rightsRow.append(rights, node("span", "", "自分で作った画像（または使っていい画像）です"));
    const go = node("button", "stamps-primary", "作る");
    go.type = "button";
    file.onchange = () => {
      preview.replaceChildren();
      const f = file.files[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      const el = node("img");
      el.alt = "";
      el.onload = () => URL.revokeObjectURL(url);
      el.src = url;
      preview.append(el);
    };
    go.onclick = async () => {
      go.disabled = true;
      say(status, "作っています…");
      try {
        await create({ file: file.files[0], name: name.value, price: price.value, rights: rights.checked });
        say(status, "作りました。");
        done?.();
      } catch (error) {
        say(status, error?.message || "作れませんでした。", true);
        go.disabled = false;
      }
    };
    const label = (text, el) => {
      const row = node("label", "stamps-field");
      row.append(node("span", "", text), el);
      return row;
    };
    body.append(
      label("画像", file),
      preview,
      label("名前", name),
      label("値段（pt）", price),
      node("p", "stamps-hint", "売れると、値段のポイントがあなたに届きます（トークの「もらった」に出ます）。0ptなら無料で配れます。運営が内容を見て、止めたり削除したりすることがあります。"),
      rightsRow,
      go,
    );
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
            if (M.usable(stamp)) usable.push(id);
          } catch {}
        }
        if (!usable.length) return grid.append(node("p", "stamps-hint", "スタンプがありません。ストアで買うか、自分で作れます。"));
        for (const id of usable) {
          const b = node("button", "stamps-pick");
          b.type = "button";
          b.setAttribute("aria-label", "スタンプを送る");
          const picture = img(id);
          b.append(picture);
          lazy(picture);
          b.onclick = () => onPick(id);
          grid.append(b);
        }
      },
      (error) => (wait.textContent = error?.message || "読み込めませんでした。"),
    );
  }
  window.Stamps = Object.freeze({ get, image, mine, remember, bubble, tray, store, create: create_, close, report, change, moderate });
})();
