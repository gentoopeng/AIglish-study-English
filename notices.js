// The お知らせボックス (the bell at the top right): today's login bonus and the notices from the
// team, newest first. The badge counts what has not been seen on this device.
//
// Cloud: shared/notices holds { items: [...] }, the latest 30 notices, read once when the app
// opens and again when the box is opened. users/{id}/learningPoints/bonus records the day of the
// last bonus; the prize is drawn inside the same transaction that writes it and adds the points
// to the wallet, so a second device or a second tap gets nothing more that day.
(function () {
  "use strict";
  const M = window.NoticesModel;
  const fmt = (n) => Number(n || 0).toLocaleString("ja-JP");
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const uid = () => (typeof myId === "string" && myId ? myId : "GUEST-000");
  const guest = () => uid() === "GUEST-000";
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const noticesRef = () => window.fbDoc(window.db, "shared", "notices");
  const bonusRef = (id) => window.fbDoc(window.db, "users", id, "learningPoints", "bonus");
  const walletRef = (id) => window.fbDoc(window.db, "users", id, "learningPoints", "main");
  const online = () => !!(window.db && window.fbGetDoc && window.fbRunTransaction) && !window.FirestoreReadGuard?.paused?.();
  let notices = [],
    dialog = null,
    spinning = false;

  // ---- What this device has seen ---------------------------------------------------------
  const store = {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {}
    },
  };
  const seenKey = "aiglish_notices_seen",
    lookedKey = "aiglish_notices_looked";
  const keep = (items) => {
    notices = items;
    store.set(lookedKey, JSON.stringify({ at: Date.now(), items }));
    return items;
  };
  const bonusKey = () => "aiglish_login_bonus_" + uid();
  // { day, prize } of the last bonus taken on this account, as far as this device knows.
  function taken() {
    try {
      const value = JSON.parse(store.get(bonusKey()) || "null");
      return value && value.day === M.dayKey() ? value : null;
    } catch {
      return null;
    }
  }
  const bonusWaiting = () => !guest() && !taken();
  function badge() {
    const button = document.getElementById("headerNotices");
    if (!button) return;
    const count = M.unread(notices, store.get(seenKey)) + (bonusWaiting() ? 1 : 0),
      mark = button.querySelector(".notice-badge");
    mark.hidden = !count;
    mark.textContent = count > 9 ? "9+" : String(count);
    button.setAttribute("aria-label", count ? "お知らせ（未読 " + count + "件）" : "お知らせ");
  }

  // ---- Cloud -----------------------------------------------------------------------------
  async function load() {
    if (!online()) return notices;
    try {
      const snap = await window.fbGetDoc(noticesRef());
      keep(snap.exists() && Array.isArray(snap.data().items) ? snap.data().items : []);
    } catch (error) {
      console.warn("[notices]", error);
    }
    badge();
    return notices;
  }
  async function claim() {
    if (guest()) throw Error("ログインボーナスはログインしたアカウントで受け取れます。");
    if (!online()) throw Error("クラウドにつながっていません。");
    const me = uid(),
      day = M.dayKey();
    const result = await window.fbRunTransaction(window.db, async (tx) => {
      const [bonusSnap, walletSnap] = [await tx.get(bonusRef(me)), await tx.get(walletRef(me))];
      const last = bonusSnap.exists() ? bonusSnap.data() : {};
      if (last.day === day) return { already: true, prize: Number(last.prize) || 0 };
      const prize = M.drawPrize(),
        wallet = walletSnap.exists() ? walletSnap.data() : {},
        value = { balance: (Number(wallet.balance) || 0) + prize, revision: (Number(wallet.revision) || 0) + 1 };
      tx.set(bonusRef(me), { day, prize, at: Date.now() });
      tx.set(walletRef(me), value, { merge: true });
      tx.set(window.fbDoc(window.db, "users", me), { studyPoints: value.balance }, { merge: true });
      return { prize, value };
    });
    if (uid() !== me) return result;
    store.set(bonusKey(), JSON.stringify({ day, prize: result.prize }));
    if (result.value) window.StudyPoints?.restore?.({ ...result.value, publishedRevision: result.value.revision });
    badge();
    return result;
  }
  // The admin tools post and delete; the list stays at the latest 30.
  async function post({ title, body }) {
    if (!window.isAdmin) throw Error("管理者ツールから配信してください。");
    if (!online()) throw Error("クラウドにつながっていません。");
    const id = Date.now().toString(36) + crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
    keep(await window.fbRunTransaction(window.db, async (tx) => {
      const snap = await tx.get(noticesRef());
      const items = M.addNotice(snap.exists() ? snap.data().items : [], { id, title, body, at: Date.now(), by: "運営" });
      tx.set(noticesRef(), { items });
      return items;
    }));
    badge();
    return notices;
  }
  async function remove(id) {
    if (!window.isAdmin) throw Error("管理者ツールから操作してください。");
    if (!online()) throw Error("クラウドにつながっていません。");
    keep(await window.fbRunTransaction(window.db, async (tx) => {
      const snap = await tx.get(noticesRef());
      const items = M.removeNotice(snap.exists() ? snap.data().items : [], id);
      tx.set(noticesRef(), { items });
      return items;
    }));
    badge();
    return notices;
  }

  // ---- The box ---------------------------------------------------------------------------
  const when = (at) => {
    const d = new Date(at);
    return d.getMonth() + 1 + "月" + d.getDate() + "日 " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  };
  function close() {
    if (spinning) return;
    dialog?.close();
    dialog?.remove();
    dialog = null;
  }
  function frame(title) {
    if (!dialog) {
      dialog = node("dialog", "study-points-dialog notices-dialog");
      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        close();
      });
      dialog.addEventListener("click", (event) => event.target === dialog && close());
      document.body.append(dialog);
      dialog.showModal();
    }
    dialog.setAttribute("aria-label", title);
    const header = node("header");
    const shut = node("button", "", "×");
    shut.type = "button";
    shut.setAttribute("aria-label", "閉じる");
    shut.onclick = close;
    header.append(node("h2", "", title), shut);
    const body = node("div", "notices-body");
    dialog.replaceChildren(header, body);
    return body;
  }
  function bonusCard() {
    const card = node("section", "notice-bonus");
    const text = node("div");
    text.append(node("strong", "", "今日のログインボーナス"));
    const got = taken();
    if (guest()) text.append(node("small", "", "ログインすると毎日1回ルーレットでポイントがもらえます。"));
    else if (got) text.append(node("small", "", "受け取りました（+" + fmt(got.prize) + "pt）。また明日。"));
    else text.append(node("small", "", "1日1回、ルーレットで最大1,000ptもらえます。"));
    card.append(node("span", "notice-bonus-mark"), text);
    if (!guest() && !got) {
      const go = node("button", "notice-primary", "回す");
      go.type = "button";
      go.onclick = wheel;
      card.append(go);
      card.classList.add("is-ready");
    }
    return card;
  }
  async function open() {
    spinning = false;
    const body = frame("お知らせ");
    const draw = () => {
      const seenAt = Number(store.get(seenKey)) || 0;
      body.replaceChildren(bonusCard());
      const list = node("ol", "notice-list");
      list.setAttribute("aria-label", "運営からのお知らせ");
      for (const n of notices) {
        const li = node("li", n.at > seenAt ? "is-new" : "");
        const head = node("p", "notice-head");
        head.append(node("strong", "", n.title), node("time", "", when(n.at)));
        li.append(head);
        if (n.body) li.append(node("p", "notice-text", n.body));
        list.append(li);
      }
      if (!notices.length) list.append(node("li", "notice-empty", "運営からのお知らせはまだありません。"));
      body.append(node("h3", "", "運営から"), list);
    };
    draw();
    await load();
    if (!dialog || dialog.getAttribute("aria-label") !== "お知らせ") return;
    draw();
    // Seen once opened; the "new" marks stay for this look.
    const newest = notices.reduce((a, n) => Math.max(a, n.at || 0), 0);
    if (newest) store.set(seenKey, String(Math.max(newest, Number(store.get(seenKey)) || 0)));
    badge();
  }

  // ---- The wheel -------------------------------------------------------------------------
  const COLORS = ["#d5bf86", "#22324c", "#b98a4a", "#2c4466", "#e6d29a", "#1b2a40"];
  function wheelFace() {
    const ns = "http://www.w3.org/2000/svg",
      svg = document.createElementNS(ns, "svg"),
      n = M.PRIZES.length,
      r = 100;
    svg.setAttribute("viewBox", "-110 -110 220 220");
    svg.setAttribute("aria-hidden", "true");
    const ring = document.createElementNS(ns, "circle");
    ring.setAttribute("r", "108");
    ring.setAttribute("class", "notice-wheel-rim");
    svg.append(ring);
    M.PRIZES.forEach((prize, i) => {
      const a0 = ((i * 360) / n - 90) * (Math.PI / 180),
        a1 = (((i + 1) * 360) / n - 90) * (Math.PI / 180);
      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", `M0 0 L${r * Math.cos(a0)} ${r * Math.sin(a0)} A${r} ${r} 0 0 1 ${r * Math.cos(a1)} ${r * Math.sin(a1)} Z`);
      path.setAttribute("fill", COLORS[i % COLORS.length]);
      svg.append(path);
      const mid = (i + 0.5) * (360 / n);
      const label = document.createElementNS(ns, "text");
      label.setAttribute("transform", `rotate(${mid}) translate(0 -66) rotate(0)`);
      label.setAttribute("class", i % 2 ? "is-dark" : "is-light");
      label.textContent = prize >= 1000 ? "1000" : String(prize);
      svg.append(label);
    });
    const hub = document.createElementNS(ns, "circle");
    hub.setAttribute("r", "16");
    hub.setAttribute("class", "notice-wheel-hub");
    svg.append(hub);
    return svg;
  }
  function wheel() {
    const body = frame("ログインボーナス");
    const stage = node("div", "notice-wheel");
    const disc = node("div", "notice-wheel-disc");
    disc.append(wheelFace());
    stage.append(node("span", "notice-wheel-pointer"), disc);
    const status = node("p", "notice-wheel-status", "止まったところのポイントがもらえます。");
    status.setAttribute("role", "status");
    const spin = node("button", "notice-primary notice-spin", "回す");
    spin.type = "button";
    const back = node("button", "notice-back", "‹ お知らせへ");
    back.type = "button";
    back.onclick = open;
    const odds = node("details", "notice-odds");
    odds.append(node("summary", "", "出る確率"), node("p", "", [1000, 500, 200, 100, 50, 10].map((p) => fmt(p) + "pt " + M.percent(p)).join("・")));
    body.append(stage, status, spin, odds, back);
    spin.onclick = async () => {
      if (spinning) return;
      spinning = true;
      spin.disabled = back.disabled = true;
      status.textContent = "回しています…";
      disc.classList.add("is-waiting");
      let result;
      try {
        result = await claim();
      } catch (error) {
        spinning = false;
        disc.classList.remove("is-waiting");
        spin.disabled = back.disabled = false;
        status.textContent = window.Poker?.message?.(error) || error.message;
        return;
      }
      disc.classList.remove("is-waiting");
      if (result.already) {
        spinning = false;
        back.disabled = false;
        spin.hidden = true;
        status.textContent = "今日はもう受け取りました（+" + fmt(result.prize) + "pt）。また明日。";
        return;
      }
      const angle = M.stopAngle(result.prize, 6, Math.random() * 0.7 - 0.35);
      const landed = () => {
        if (!spinning) return;
        spinning = false;
        back.disabled = false;
        spin.hidden = true;
        status.replaceChildren(node("strong", "notice-won", "+" + fmt(result.prize) + "pt"), document.createTextNode(" 受け取りました。また明日。"));
        stage.classList.add("is-won");
        if (result.prize >= 500 && window.Ceremony)
          window.Ceremony.play({ style: "chips", result: true, count: result.prize, from: 0, suffix: "pt", word: "BONUS", sub: "ログインボーナス", tone: "gold" });
      };
      if (calm()) {
        disc.style.transform = `rotate(${angle % 360}deg)`;
        return landed();
      }
      disc.addEventListener("transitionend", landed, { once: true });
      setTimeout(landed, 5200);
      requestAnimationFrame(() => (disc.style.transform = `rotate(${angle}deg)`));
    };
  }

  // On start, for a signed-in account, unless this device looked in the last half hour; the
  // box itself always reads the latest.
  function startup() {
    try {
      const cached = JSON.parse(store.get(lookedKey) || "null");
      if (Array.isArray(cached?.items)) notices = cached.items;
      badge();
      if (guest() || Date.now() - (Number(cached?.at) || 0) < 30 * 60 * 1000) return;
    } catch {}
    load().catch(() => {});
  }
  window.onAppLoaded?.(() => setTimeout(startup, 1500));
  window.addEventListener("focus", badge);
  badge();
  window.Notices = Object.freeze({ open, close, load, claim, post, remove, badge, list: () => notices.slice() });
})();
