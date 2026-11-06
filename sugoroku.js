// すごろくビンゴ: the screen for SugorokuModel inside the casino.
//
// One screen, no scrolling: the jackpots, the card, the die beside a strip of the track with
// the piece on it, and the bet and roll button. The wheels and the event games come up over it.
// It is a dark green felt with brass and ivory; the wheels carry the colour (gold for the big
// multiples, wine for nothing) and only BINGO and the jackpot wheels dim the room.
//
// A roll is worked out and saved before anything moves, and its chips are paid at once, so
// closing half way changes nothing. An event game is saved move by move in state.pending, and a
// jackpot waits in state.jpWait until it is paid.
// Signed in and online it stakes points (casino.js); a guest or a device off the cloud plays on
// practice chips and its own card, where a jackpot is shown but not paid.
// Speed: 早送り plays the everyday parts quickly (the die, the steps, the normal, event and
// accident wheels, balls off the reach); a line, its wheels, a jackpot and a reach ball keep
// their full time. A tap on the board skips to the end of the roll.
(function () {
  "use strict";
  const S = window.SugorokuModel,
    C = window.CasinoModel;
  const fmt = (n) => Number(n || 0).toLocaleString("ja-JP");
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const draw32 = () => crypto.getRandomValues(new Uint32Array(1))[0];
  const random = (n) => draw32() % n;
  // A roll is first worked out on the card as last seen, recording each raw draw; only a roll
  // that touches the card (a ball) goes to the cloud, where the same draws are played again on
  // the newest card (so the die and the wheels come out the same). `replay` restarts each time
  // the transaction runs its function.
  const recorder = (tape) => (n) => {
    const v = draw32();
    tape.push(v);
    return v % n;
  };
  const replay = (tape) => {
    let i = 0;
    return (n) => (i < tape.length ? tape[i++] : draw32()) % n;
  };
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const SQUARE = { start: "START", normal: "", event: "★", accident: "!" };
  const GAME_NAMES = { blackjack: "ブラックジャック", dice: "ダイスポーカー", chinchiro: "チンチロ", ball: "ボール確定" };
  const ITEM_INFO = {
    dice2: { n: "ダブルダイス", d: "サイコロを2個振って、合計だけ進みます", img: "die", dice: 2 },
    dice3: { n: "トリプルダイス", d: "サイコロを3個振って、合計だけ進みます", img: "die", dice: 3 },
    exact: { n: "ぴったり", d: "出目を1〜6から選べます", img: "die-gold" },
    guard: { n: "ガード", d: "この回から3回、アクシデントのマスが無効になります", img: "shield" },
    x2: { n: "倍がけ", d: "通常マスのルーレットの増減が2倍になります（ほかのマスでは使われません）", img: "potion" },
    // (No longer given or sold; one already in a bag can still be used.)
    ball: { n: "ボール券", d: "この回、ボールを1個出します", img: "" },
  };
  // An item's picture: the dice are stacked (two or three of the same die, a little turned).
  function itemIcon(id) {
    const info = ITEM_INFO[id],
      icon = node("span", "sg-ico is-" + id);
    icon.setAttribute("aria-hidden", "true");
    if (!info.img) {
      icon.textContent = "●";
      return icon;
    }
    for (let i = 0; i < (info.dice || 1); i++) {
      const img = node("img");
      img.src = "assets/sugoroku/" + info.img + ".png";
      img.alt = "";
      img.decoding = "async";
      img.draggable = false;
      img.className = "n" + i;
      icon.append(img);
    }
    return icon;
  }
  const WHEEL_NAMES = { item: "ITEM ROULETTE", event: "EVENT", accident: "ACCIDENT", bingo: "BINGO", sjp: "SUPER JACKPOT CHANCE", kakuhen: "BONUS", special: "SPECIAL BALL" };
  const HOT = new Set(["bingo", "sjp", "kakuhen", "special"]);
  const MINI = { timer: "10秒ぴったり", tap: "連打", tapex: "連打EX", dice: "サイコロ", math: "暗算", stop: "ストップ", hilo: "ハイ＆ロー" };
  // The normal squares' quick games, paid in multiples of the bet (not played in 早送り).
  const QUICK_GAMES = new Set(["stop", "hilo"]);
  const LOG_NAMES = { bingo: "BINGO", jp: "JACKPOT", sjp: "SUPER JACKPOT" };
  const RULES_TEXT = [
    "ログインしているときはポイント、ゲストやオフラインのときは練習チップで遊びます。1回の賭けは50・100・200から選べます。払い戻しは賭け額に比例し、ジャックポットの当たりやすさも賭け額に合わせて変わります。",
    "通常マス：ルーレットで −×5 〜 ×7 が額に掛かって戻ります（−は額とは別に引かれ、足りない分はカジノからの借金になります）。「BJ」「DICE」「チンチロ」はそのゲームを1回（勝てば配当、負けると賭けた分はなくなります）、「●」はボール、「STOP」「H&L」はミニゲームです。たまに「BONUS」ルーレットが当たり、大きな配当やボール5個連続が出ます。",
    "★（EVENT）：ブラックジャック・ダイスポーカー・チンチロ・ボール確定のどれか。勝てば配当とボール、引き分けは額が戻ります。サイコロは本当に振っていて、相手の目も見えます。",
    "！（アクシデント）：額の0〜2倍が引かれるか、3マス戻るか、STARTに戻ります。",
    "100マスで1周してSTARTを通ると、ボールが1つ出ます。",
    "ビンゴカードは2枚で、みんなで共通です（左右にスワイプ）。ボールは1〜99の抽選で、開いていない番号なら自分のボールが入ります。すでに開いている番号は額の2倍がもらえます。★の数字（特別な数字）が出ると、スペシャルルーレットが回ります。1列そろうとビンゴ賞金とビンゴルーレット。そろった列のボールは戻ります。",
    "ビンゴ賞金の7割と、ルーレットの倍率の5割は、その列にボールを置いていた人でボールの数に応じて分けます（そろえた人のボールも数えます）。ほかの人の分は、その人が開いたときに届きます。ミニゲームとジャックポットはそろえた人のものです。",
    "通常マスの「ITEM」で、アイテムルーレットが回ります。アイテムは3個まで持て、ショップでも買えます。振る前に押して使います。ダブルダイス（サイコロ2個）・トリプルダイス（3個）・ぴったり（出目を選ぶ）・ガード（3回アクシデント無効）・倍がけ（通常マスの増減が2倍）。持ちきれないときは、値段の半分がもらえます。",
    "ジャックポットは、カジノでディーラー相手に賭けられたポイントから貯まります。",
    "「早送り」にすると、ふだんのマスは短く進みます。★マスは自動で進み、盤面をタップするとその回を飛ばせます。",
    "ほかの人のビンゴの分け前は、30日受け取らないと消えます。",
  ];

  // ---- Saving ----------------------------------------------------------------------------
  let api = null;
  const saveName = () => "aiglish_sugoroku_" + api.uid() + (api.real() ? "" : "_practice");
  const cloudRef = () => window.fbDoc(window.db, "users", api.uid(), "sync", "sugoroku");
  function readLocal() {
    try {
      const saved = JSON.parse(localStorage.getItem(saveName()) || "null");
      return S.valid(saved) ? saved : null;
    } catch {
      return null;
    }
  }
  // Every save goes to this device at once. The cloud copy (for carrying on from another device)
  // is written at once when a game, a mini game, a jackpot or an item comes or goes (so none can be
  // played twice from two devices), and otherwise at most every 30 seconds and when the page is
  // hidden, to keep cloud writes few.
  const cloud = { key: null, at: 0, timer: 0, state: null };
  const gate = (state) => JSON.stringify([state.pending || null, state.bonus || [], state.jpWait || [], state.items || []]);
  function saveCloud() {
    clearTimeout(cloud.timer);
    cloud.timer = 0;
    const state = cloud.state;
    if (!state || !api?.real()) return;
    cloud.state = null;
    cloud.key = gate(state);
    cloud.at = Date.now();
    Promise.resolve()
      .then(() => window.fbSetDoc(cloudRef(), { state: JSON.stringify(state), rolls: state.rolls, savedAt: Date.now() }))
      .catch((error) => console.warn("[sugoroku] save", error));
  }
  function save(state) {
    try {
      localStorage.setItem(saveName(), JSON.stringify(state));
    } catch {}
    if (!api.real()) return;
    cloud.state = state;
    if (gate(state) !== cloud.key || Date.now() - cloud.at > 30e3) saveCloud();
    else if (!cloud.timer) cloud.timer = setTimeout(saveCloud, 30e3);
  }
  document.addEventListener("visibilitychange", () => document.hidden && saveCloud());
  addEventListener("pagehide", saveCloud);
  // The game as kept in the cloud (from another device), or null.
  async function loadCloud() {
    if (!api.real()) return null;
    try {
      const snap = await window.fbGetDoc(cloudRef());
      const remote = snap.exists() ? JSON.parse(snap.data().state || "null") : null;
      if (!S.valid(remote)) return null;
      cloud.key = gate(remote);
      return S.upgrade(remote);
    } catch (error) {
      console.warn("[sugoroku] load", error);
      return null;
    }
  }

  // ---- The shared card ---------------------------------------------------------------------
  // One card for everybody in shared/sugoroku_live (the preview's shared/sugoroku_card, with its
  // practice-chip parts, is left behind): { cells, owners, owed, owedAt, people, log }, people[id] the
  // name and a small icon for each id whose ball is on it. Every roll reads it and, if a ball
  // landed, writes it back in one transaction, so two players never take the same cell. A
  // guest, or a device off the cloud, plays on a card of its own.
  const shared = () => api.uid() !== "GUEST-000" && !!(window.db && window.fbDoc && window.fbRunTransaction) && !window.FirestoreReadGuard?.paused?.();
  // The two-card game lives in its own document: a copy of the game from before (an open tab on the
  // old code) keeps writing its 49-cell card to `sugoroku_live` and never touches this one. The first
  // roll after the change makes this document from that one (see legacyCard).
  const CARD_DOC = "sugoroku_live2",
    LEGACY_DOC = "sugoroku_live";
  const cardRef = () => window.fbDoc(window.db, "shared", CARD_DOC);
  const legacyRef = () => window.fbDoc(window.db, "shared", LEGACY_DOC);
  // Once the screen is open it stays on the card it opened with (see view.online).
  const localCardName = () => "aiglish_sugoroku_card_" + ((view ? view.online : shared()) ? "live" : api.uid());
  // Everything on the shared card is read as untrusted: the card itself is checked by the model,
  // names are cut short, an icon must be a small inline image (it goes into a CSS url()), and the
  // log keeps only well-formed entries.
  const ICON = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]{1,16000}$/;
  const okId = (id) => typeof id === "string" && id.length > 0 && id.length <= 64;
  function cleanPeople(people) {
    const out = {};
    if (people && typeof people === "object" && !Array.isArray(people))
      for (const [id, p] of Object.entries(people).slice(0, 100))
        if (okId(id) && p && typeof p === "object") out[id] = { n: String(p.n ?? "").slice(0, 24), i: typeof p.i === "string" && ICON.test(p.i) ? p.i : "" };
    return out;
  }
  function cleanLog(log) {
    if (!Array.isArray(log)) return [];
    return log
      .filter((e) => e && LOG_NAMES[e.t] && okId(e.id) && Number.isFinite(e.at))
      .slice(-30)
      .map((e) => ({ t: e.t, id: e.id, n: String(e.n ?? "").slice(0, 24), c: Math.min(12, Math.max(1, Math.floor(Number(e.c) || 1))), at: e.at }));
  }
  function readCard(data) {
    if (!data) return null;
    const card = { v: data.v, cells: data.cells, owners: data.owners, special: data.special, ...(data.bets ? { bets: data.bets } : {}), ...(data.owed ? { owed: data.owed } : {}), ...(data.owedAt ? { owedAt: data.owedAt } : {}) };
    return S.validCard(card) ? { card, people: cleanPeople(data.people), log: cleanLog(data.log) } : null;
  }
  // The game from before the second card: new cards, but what was owed there (only the whole-point
  // parts that are sane), the people and the log come across.
  function legacyCard(data) {
    if (!data || typeof data !== "object") return null;
    const fresh = S.newCard(random);
    const owed = {},
      owedAt = {};
    if (data.owed && typeof data.owed === "object" && !Array.isArray(data.owed))
      for (const [id, n] of Object.entries(data.owed).slice(0, 200))
        if (okId(id) && Number.isInteger(n) && n > 0 && n <= 1e7) {
          owed[id] = n;
          owedAt[id] = Number.isFinite(data.owedAt?.[id]) ? data.owedAt[id] : Date.now();
        }
    return { card: { ...fresh, owed, owedAt }, people: cleanPeople(data.people), log: cleanLog(data.log) };
  }
  function keepCard(card, people, log) {
    try {
      localStorage.setItem(localCardName(), JSON.stringify({ ...card, people, log }));
    } catch {}
  }
  function cachedCard() {
    try {
      return readCard(JSON.parse(localStorage.getItem(localCardName()) || "null"));
    } catch {
      return null;
    }
  }
  async function loadCard() {
    if (shared())
      try {
        const snap = await window.fbGetDoc(cardRef());
        const found = snap.exists() ? readCard(snap.data()) : null;
        if (found) return found;
        // Not made yet: made now from the game before, so every device shows the same cards.
        if (!snap.exists() && typeof window.fbRunTransaction === "function") {
          const made = await window.fbRunTransaction(window.db, async (tx) => {
            const again = await tx.get(cardRef());
            if (again.exists()) return readCard(again.data());
            const old = await tx.get(legacyRef()),
              now = (old.exists() && legacyCard(old.data())) || { card: S.newCard(random), people: {}, log: [] };
            tx.set(cardRef(), { v: 2, cells: now.card.cells, owners: now.card.owners, special: now.card.special, bets: now.card.bets || Array(now.card.cells.length).fill(0), owed: now.card.owed || {}, owedAt: now.card.owedAt || {}, people: now.people, log: now.log, updatedAt: Date.now() });
            return now;
          });
          if (made) return made;
        }
      } catch (error) {
        console.warn("[sugoroku] card", error);
      }
    return cachedCard() || { card: S.newCard(random), people: {}, log: [] };
  }
  // This player's name and icon (shrunk to 40px) to show on their balls.
  let me = null;
  // The small icon is kept on this device for the picture it was made from, so opening the game
  // does not wait for an image to load and shrink again.
  const iconName = (id) => "aiglish_sugoroku_icon_" + id;
  const avatarOf = (id) => {
    try {
      return localStorage.getItem("core_v4_user_avatar_" + id) || "";
    } catch {
      return "";
    }
  };
  const avatarKey = (avatar) => avatar.length + ":" + avatar.slice(0, 48) + avatar.slice(-48);
  // At once: the name and the icon made before (if the picture has not changed).
  function personNow() {
    const id = api.uid(),
      name = (typeof myName === "string" && myName) || (id === "GUEST-000" ? "ゲスト" : id);
    let icon = "";
    try {
      const saved = JSON.parse(localStorage.getItem(iconName(id)) || "null");
      if (saved && saved.key === avatarKey(avatarOf(id))) icon = saved.i || "";
    } catch {}
    return { n: String(name).slice(0, 24), i: icon };
  }
  async function person() {
    if (me && me.id === api.uid()) return me.value;
    const id = api.uid(),
      value = personNow(),
      avatar = avatarOf(id);
    if (!value.i && (/^data:image\//.test(avatar) || /^https?:/.test(avatar))) {
      value.i = await shrink(avatar, 40);
      try {
        localStorage.setItem(iconName(id), JSON.stringify({ key: avatarKey(avatar), i: value.i }));
      } catch {}
    }
    me = { id, value };
    return value;
  }
  function shrink(src, size) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = size;
          const side = Math.min(img.naturalWidth, img.naturalHeight);
          canvas.getContext("2d").drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        } catch {
          resolve("");
        }
      };
      img.onerror = () => resolve("");
      // A picture that never answers does not hold anything up.
      setTimeout(() => resolve(""), 3000);
      img.src = src;
    });
  }
  // Runs `change(card)` (a model roll or settle) on the newest card and stores the card it
  // returns, with this player in people and only people who still have a ball on it. First this
  // player's part of other players' lines is taken off the card (collected). Lines and jackpots
  // go into the card's log for everybody.
  // On the shared card a failed write throws: nothing is paid or saved, and the player is asked
  // to try again (playing on a card of its own would leave the two apart).
  async function onCard(change) {
    const mine = await person(),
      id = api.uid();
    const keep = (card, people) => {
      const ids = new Set(card.owners);
      const next = Object.fromEntries(Object.entries(people).filter(([k]) => ids.has(k)));
      if (ids.has(id)) next[id] = mine;
      return next;
    };
    const apply = (now) => {
      const got = S.collect(now.card, id),
        out = change(got.card),
        at = Date.now(),
        entries = [];
      S.tidyOwed(out.card, now.card, at);
      for (const e of out.events) {
        if (e.t === "line") entries.push({ t: "bingo", id, n: mine.n, c: e.count, at });
        if (e.t === "jackpot") entries.push({ t: e.kind, id, n: mine.n, c: 1, at });
      }
      out.state.won += got.amount;
      out.state.shared = (out.state.shared || 0) + got.amount;
      return { out, collected: got.amount, people: keep(out.card, now.people), log: entries.length ? (now.log || []).concat(entries).slice(-30) : now.log || [] };
    };
    if (view.online) {
      const attempt = () =>
        window.fbRunTransaction(window.db, async (tx) => {
          const snap = await tx.get(cardRef());
          let now = snap.exists() ? readCard(snap.data()) : null;
          if (!now) {
            // The first roll of the two-card game: the cards are made from the game before.
            const old = snap.exists() ? null : await tx.get(legacyRef());
            now = (old?.exists() && legacyCard(old.data())) || { card: S.newCard(random), people: {}, log: [] };
          }
          const done = apply(now);
          if (!snap.exists() || done.collected || JSON.stringify(done.out.card) !== JSON.stringify(now.card) || done.log !== now.log)
            tx.set(cardRef(), { v: 2, cells: done.out.card.cells, owners: done.out.card.owners, special: done.out.card.special, bets: done.out.card.bets || Array(done.out.card.cells.length).fill(0), owed: done.out.card.owed || {}, owedAt: done.out.card.owedAt || {}, people: done.people, log: done.log, updatedAt: Date.now() });
          return { ...done, before: now };
        });
      // Many players at once can crowd the one card: one more try after a moment before giving up.
      let result;
      try {
        result = await attempt();
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 400 + random(400)));
        result = await attempt();
      }
      keepCard(result.out.card, result.people, result.log);
      // Whatever waited was just taken.
      peek = { id, at: Date.now(), amount: 0 };
      return result;
    }
    const now = cachedCard() || { card: view.card, people: view.people, log: view.log };
    const done = apply(now);
    keepCard(done.out.card, done.people, done.log);
    return { ...done, before: now };
  }
  // What waits for `id` on the shared card (their part of other players' lines), for the casino
  // tab; the cloud is read at most every five minutes.
  let peek = { id: null, at: 0, amount: 0 };
  async function waiting(id) {
    if (!id || id === "GUEST-000" || !window.db || !window.fbDoc || !window.fbGetDoc || window.FirestoreReadGuard?.paused?.()) return 0;
    if (peek.id !== id || Date.now() - peek.at > 300e3)
      try {
        const snap = await window.fbGetDoc(cardRef());
        // (Before the first roll of the two-card game, what is owed is still on the document before.)
        const found = snap.exists() ? readCard(snap.data()) : legacyCard((await window.fbGetDoc(legacyRef())).data?.());
        peek = { id, at: Date.now(), amount: found?.card.owed?.[id] || 0 };
      } catch (error) {
        console.warn("[sugoroku] waiting", error);
      }
    return peek.id === id ? peek.amount : 0;
  }
  // Other players' balls come in while the screen is open.
  function listen() {
    listenHere();
    markHere();
    view.stop?.();
    view.stop = null;
    if (!shared() || typeof window.fbOnSnapshot !== "function") return;
    const target = view;
    try {
      view.stop = window.fbOnSnapshot(cardRef(), (snap) => {
        if (target !== view || !view.body.isConnected) return target.stop?.();
        const found = snap.exists() && readCard(snap.data());
        if (!found) return;
        // While a roll or a game is shown, the card is not swapped under it. The change is not
        // dropped either: the card is read again as soon as the screen is free (see catchUp).
        if (view.busy) return void (view.stale = true);
        showCard(found);
      });
    } catch (error) {
      console.warn("[sugoroku] listen", error);
    }
  }
  // Who else is playing: shared/sugoroku_here holds { [id]: { n, at } }. A player is marked
  // when the screen opens and then with their rolls, at most every 45 seconds, and counts as
  // playing for two minutes after that. Entries older than a day are cleared by whoever writes.
  const HERE_DOC = "sugoroku_here",
    HERE_EVERY = 45e3,
    HERE_FOR = 120e3;
  const hereRef = () => window.fbDoc(window.db, "shared", HERE_DOC);
  function markHere() {
    if (!view || !view.online || !shared() || typeof window.fbSetDoc !== "function") return;
    const now = Date.now();
    if (now - (view.hereAt || 0) < HERE_EVERY) return;
    view.hereAt = now;
    const id = api.uid(),
      mine = { [id]: { n: (view.people[id]?.n || personNow().n || "").slice(0, 24), at: now } };
    if (typeof window.fbDeleteField === "function")
      for (const [other, p] of Object.entries(view.here || {})) if (other !== id && now - p.at > 864e5) mine[other] = window.fbDeleteField();
    Promise.resolve()
      .then(() => window.fbSetDoc(hereRef(), mine, { merge: true }))
      .catch((error) => console.warn("[sugoroku] here", error));
  }
  function cleanHere(data) {
    const out = {};
    if (data && typeof data === "object")
      for (const [id, p] of Object.entries(data).slice(0, 200))
        if (okId(id) && p && typeof p === "object" && Number.isFinite(p.at)) out[id] = { n: String(p.n ?? "").slice(0, 24), at: p.at };
    return out;
  }
  function listenHere() {
    view.stopHere?.();
    view.stopHere = null;
    if (!view.online || !shared() || typeof window.fbOnSnapshot !== "function") return;
    const target = view;
    try {
      view.stopHere = window.fbOnSnapshot(hereRef(), (snap) => {
        if (target !== view || !view.body.isConnected) return target.stopHere?.();
        view.here = cleanHere(snap.exists() ? snap.data() : null);
        paintHere();
      });
    } catch (error) {
      console.warn("[sugoroku] listen here", error);
    }
    // Someone who stops rolling drops off the list after a while, with no write needed.
    const tick = setInterval(() => (target === view && view.body.isConnected ? paintHere() : clearInterval(tick)), 20e3);
  }
  function paintHere() {
    if (!view?.hereEl) return;
    const now = Date.now(),
      me = api.uid(),
      others = Object.entries(view.here || {})
        .filter(([id, p]) => id !== me && now - p.at < HERE_FOR)
        .sort((a, b) => b[1].at - a[1].at);
    view.hereEl.hidden = !others.length;
    view.hereEl.replaceChildren();
    if (!others.length) return;
    view.hereEl.append(node("i", "sg-here-dot"), node("span", "", "いっしょにプレイ中　"));
    for (const [id, p] of others.slice(0, 5)) {
      const who = node("span", "sg-here-who"),
        icon = view.people[id]?.i;
      const face = node("i", "sg-here-face");
      face.style.setProperty("--hue", hue(id));
      if (icon) face.style.backgroundImage = 'url("' + icon + '")';
      else face.textContent = (p.n || "?").trim().slice(0, 1);
      who.append(face, node("span", "", (p.n || "だれか") + "さん"));
      view.hereEl.append(who);
    }
    if (others.length > 5) view.hereEl.append(node("span", "", "ほか" + (others.length - 5) + "人"));
  }
  // Other players' balls that came in while this screen was busy: the card is read once more
  // when it is free, so they show now instead of with somebody's next ball.
  function catchUp() {
    const target = view;
    if (!target || !target.stale || !target.online || !shared()) return;
    target.stale = false;
    window
      .fbGetDoc(cardRef())
      .then((snap) => {
        const found = snap.exists() && readCard(snap.data());
        if (!found || target !== view || !view.body.isConnected) return;
        if (view.busy) return void (view.stale = true);
        showCard(found);
      })
      .catch((error) => console.warn("[sugoroku] catch up", error));
  }
  function showCard(found) {
    const news = found.log.filter((e) => e.at > lastLog() && e.id !== api.uid());
    view.card = found.card;
    view.people = found.people;
    view.log = found.log;
    keepCard(found.card, found.people, found.log);
    paintCard();
    hud();
    // Somebody else's line or jackpot just now.
    const last = news[news.length - 1];
    if (last) say((last.n || "だれか") + "さんが " + logText(last), "is-hot");
    seeLog();
    notify();
    if (found.card.owed?.[api.uid()] > 0) setTimeout(collectNow, last ? 1500 : 0);
  }

  // The newest log entry this screen has shown.
  const lastLog = () => (view?.log || []).reduce((t, e) => Math.max(t, e.at), view?.seen || 0);
  const seeLog = () => view && (view.seen = lastLog());
  const logText = (e) => (e.t === "bingo" ? (e.c === 2 ? "DOUBLE BINGO" : e.c === 3 ? "TRIPLE BINGO" : e.c > 3 ? e.c + " BINGO" : "BINGO") : LOG_NAMES[e.t]);

  // ---- Notices ---------------------------------------------------------------------------
  // What happens on the shared card goes into the お知らせボックス, once each: another player's BINGO or
  // jackpot, and how many lines are one number from done (one notice that is replaced as it changes).
  // Only with points on the shared card; practice chips and a card of your own say nothing.
  function notify() {
    if (!view || view.busy || !view.online || !api.real() || !window.PersonalNotices) return;
    const me = api.uid();
    try {
      const last = (view.log || []).reduce((t, e) => Math.max(t, e.at), 0),
        key = "aiglish_sugoroku_noticed_" + me,
        seen = localStorage.getItem(key);
      // The first time: what is already in the log is old news.
      if (seen === null) localStorage.setItem(key, String(last));
      else {
        const news = (view.log || []).filter((e) => e.at > Number(seen) && e.id !== me).slice(-5);
        for (const e of news)
          window.PersonalNotices.add(me, { id: "sugoroku-log:" + e.id + ":" + e.at, title: (e.n || "だれか") + "さんが " + logText(e), body: "すごろくビンゴ", amount: 0 });
        if (last > Number(seen)) localStorage.setItem(key, String(last));
      }
      const reaches = S.reach(view.card),
        wanted = [...new Set(reaches.map((line) => view.card.cells[S.LINES[line].find((c) => !view.card.owners[c])]))].sort((a, b) => a - b),
        sign = reaches.length + ":" + wanted.join(","),
        signKey = "aiglish_sugoroku_reach_" + me;
      if (localStorage.getItem(signKey) !== sign) {
        const before = localStorage.getItem(signKey);
        localStorage.setItem(signKey, sign);
        if (!reaches.length) {
          // The old "N lines" notice must not stay: replace it (same id) once the reaches are gone.
          if (before && !before.startsWith("0:")) window.PersonalNotices.add(me, { id: "sugoroku:reach", title: "いまリーチ中のラインはありません", body: "すごろくビンゴ", amount: 0 });
        } else
          window.PersonalNotices.add(me, { id: "sugoroku:reach", title: "いま " + reaches.length + " 本リーチ中", body: "あと1つで揃う番号：" + wanted.slice(0, 8).join("・") + (wanted.length > 8 ? "…" : ""), amount: 0 });
      }
    } catch (error) {
      console.warn("[sugoroku] notice", error);
    }
  }

  // ---- Screen ----------------------------------------------------------------------------
  let view = null;
  const QUICK = "aiglish_sugoroku_quick",
    COST_KEY = "aiglish_sugoroku_cost";
  // The bet chosen last time (100 until one is chosen).
  const savedCost = () => {
    try {
      const value = Number(localStorage.getItem(COST_KEY));
      return S.RULES.costs.includes(value) ? value : 100;
    } catch {
      return 100;
    }
  };
  const quickSaved = () => {
    try {
      return localStorage.getItem(QUICK) === "1";
    } catch {
      return false;
    }
  };
  async function play(body, wallet) {
    api = wallet;
    // A screen opened before stops here (its listener and its card choice).
    view?.stop?.();
    view?.stopHere?.();
    view?.unsub?.();
    view = null;
    body.replaceChildren(node("p", "cs-hint", "読み込み中…"));
    // The screen comes up at once from what this device kept (the game, the card as last seen,
    // the player's icon); the cloud copies come in behind it (the card through its listener).
    // Only what this device has never seen is waited for.
    const id = api.uid(),
      kept = readLocal(),
      cached = shared() ? cachedCard() : null,
      cloudGame = loadCloud();
    const [state, found] = await Promise.all([
      kept ? S.upgrade(kept) : cloudGame.then((remote) => remote || S.newState()),
      cached || loadCard(),
    ]);
    if (!body.isConnected) return;
    // This player's own balls always show their own name and icon.
    found.people = { ...found.people, [id]: me && me.id === id ? me.value : personNow() };
    view = { body, state, card: found.card, people: found.people, log: found.log || [], seen: 0, online: shared(), cost: savedCost(), fast: false, hot: false, quick: quickSaved(), stale: false };
    // When the screen becomes free, a card change that came in meanwhile is caught up.
    let busy = false;
    Object.defineProperty(view, "busy", {
      get: () => busy,
      set: (value) => {
        busy = !!value;
        if (!busy) setTimeout(notify, 0);
        if (!busy && view?.stale) setTimeout(catchUp, 0);
      },
      enumerable: true,
    });
    const target = view;
    seeLog();
    draw();
    listen();
    setTimeout(notify, 0);
    // A game played further on another device takes over, if nothing is going on here.
    if (kept) {
      // Until the cloud copy has been compared, no roll starts (it could throw away a purchase made elsewhere).
      view.syncing = true;
      const done = () => {
        if (target !== view) return;
        view.syncing = false;
        hud();
      };
      cloudGame.then(done, done);
      cloudGame.then((remote) => {
        if (!remote || target !== view || view.busy || S.revOf(remote) <= S.revOf(view.state) || view.state.pending || view.state.bonus?.length) return;
        view.state = remote;
        save(remote);
        hud();
        place(remote.pos, false);
      }, () => {});
    }
    // Without a listener, the card as last seen is brought up to date once.
    if (cached && view.online && typeof window.fbOnSnapshot !== "function")
      loadCard().then((fresh) => {
        if (target !== view || view.busy) return;
        view.card = fresh.card;
        view.people = { ...fresh.people, [id]: view.people[id] };
        view.log = fresh.log || view.log;
        keepCard(fresh.card, fresh.people, fresh.log);
        paintCard();
        hud();
      });
    // The icon, made once and kept.
    person().then((value) => {
      if (target !== view) return;
      view.people = { ...view.people, [id]: value };
      paintCard();
    });
    if (state.jpWait?.length) {
      const left = { state };
      await payJackpots(left);
      if (view) view.state = left.state;
    }
    if (view?.state.bonus?.length) await bonus();
    if (view?.state.pending) game();
    else await collectNow();
  }
  function draw() {
    const { body, state } = view;
    body.classList.add("sg-body");
    body.closest("dialog")?.classList.add("is-fit");

    const pots = node("div", "sg-pots");
    const help = node("button", "sg-help", "?");
    help.type = "button";
    help.setAttribute("aria-label", "すごろくビンゴの遊び方");
    help.onclick = rules;
    const records = node("button", "sg-help sg-records", "記録");
    records.type = "button";
    records.setAttribute("aria-label", "すごろくビンゴの記録");
    records.onclick = book;
    pots.append(pot("jp", "JACKPOT"), pot("sjp", "SUPER JACKPOT"), records, help);
    view.unsub?.();
    view.unsub = window.CasinoJackpot?.onChange(() => view?.body.isConnected && hud());
    window.CasinoJackpot?.refresh();

    const cardWrap = node("div", "sg-card-wrap");
    // Two cards side by side: swipe (or press the tabs) to turn between them.
    const slider = node("div", "sg-cards-slider");
    view.slider = slider;
    view.cells = [];
    const per = S.CARD * S.CARD;
    for (let b = 0; b < S.CARDS; b++) {
      const card = node("div", "sg-card");
      card.setAttribute("aria-label", "ビンゴカード" + (b + 1));
      for (let i = 0; i < per; i++) {
        const cell = node("div", "sg-cell");
        cell.append(node("span", "", String(view.card.cells[b * per + i])));
        card.append(cell);
        view.cells[b * per + i] = cell;
      }
      slider.append(card);
    }
    const tabs = node("div", "sg-card-tabs");
    view.tabs = [];
    for (let b = 0; b < S.CARDS; b++) {
      const tab = node("button");
      tab.type = "button";
      tab.append(node("i", "sg-tab-reach", ""), node("span", "", "カード" + (b + 1)));
      tab.onclick = () => turnTo(b, true);
      tabs.append(tab);
      view.tabs.push(tab);
    }
    view.special = node("span", "sg-special");
    tabs.append(view.special);
    slider.addEventListener("scroll", () => {
      clearTimeout(view.scrollTimer);
      view.scrollTimer = setTimeout(syncTabs, 90);
    });
    view.say = node("p", "sg-say");
    view.say.setAttribute("role", "status");
    view.cardWrap = cardWrap;
    cardWrap.append(tabs, slider, view.say);

    const board = node("div", "sg-boardrow");
    view.die = cube();
    const track = node("div", "sg-track");
    const lane = node("div", "sg-lane");
    view.squares = Array.from({ length: S.SIZE }, (_, i) => {
      const kind = S.kindAt(i),
        sq = node("div", "sg-sq is-" + kind);
      sq.append(node("small", "", String(i)), node("b", "", SQUARE[kind]));
      lane.append(sq);
      return sq;
    });
    view.piece = node("i", "sg-piece");
    lane.append(view.piece);
    track.append(lane);
    view.track = track;
    view.lane = lane;
    board.append(view.die.box, track);
    board.onclick = () => view.busy && (view.fast = true);
    cardWrap.onclick = board.onclick;

    view.armed = { ids: [], face: 0 };
    view.itemBar = node("div", "sg-items");
    view.facePick = node("div", "sg-faces");
    view.facePick.hidden = true;
    view.info = node("p", "sg-status");
    view.hereEl = node("p", "sg-here");
    view.hereEl.hidden = true;
    view.hereEl.setAttribute("aria-label", "いっしょにプレイ中の人");

    const controls = node("div", "sg-controls");
    // The bet of a roll: 50, 100 or 200 (kept for next time).
    const costs = node("div", "sg-costs is-choice");
    costs.setAttribute("role", "group");
    costs.setAttribute("aria-label", "1回の賭け");
    view.costBtns = S.RULES.costs.map((value) => {
      const b = node("button", "", fmt(value) + api.unit());
      b.type = "button";
      b.dataset.cost = String(value);
      b.onclick = () => {
        if (view.busy || view.state.pending || view.cost === value) return;
        view.cost = value;
        try {
          localStorage.setItem(COST_KEY, String(value));
        } catch {}
        hud();
      };
      costs.append(b);
      return b;
    });
    view.go = node("button", "sg-go", "サイコロを振る");
    view.go.type = "button";
    view.go.dataset.sgRoll = "";
    view.go.onclick = roll;
    view.quickBtn = node("button", "sg-quick", "早送り");
    view.quickBtn.type = "button";
    view.quickBtn.setAttribute("aria-pressed", String(view.quick));
    view.quickBtn.onclick = () => {
      view.quick = !view.quick;
      view.quickBtn.setAttribute("aria-pressed", String(view.quick));
      try {
        localStorage.setItem(QUICK, view.quick ? "1" : "0");
      } catch {}
    };
    controls.append(costs, view.go, view.quickBtn);
    view.studyEl = node("p", "sg-study");
    view.studyEl.hidden = true;

    view.layer = node("div", "sg-layer");
    view.layer.hidden = true;
    body.replaceChildren(pots, view.hereEl, cardWrap, board, view.info, view.itemBar, view.facePick, controls, view.studyEl, view.layer);
    paintCard();
    paintHere();
    hud();
    place(state.pos, false);
  }
  function pot(kind, name) {
    const box = node("div", "sg-pot is-" + kind);
    box.dataset.pot = kind;
    box.append(node("small", "", name), node("b", ""));
    return box;
  }
  function rules() {
    if (view.busy) return;
    const layer = view.layer;
    layer.className = "sg-layer";
    layer.hidden = false;
    const box = node("div", "sg-sheet");
    box.append(node("p", "sg-sheet-title", "すごろくビンゴの遊び方"));
    const list = node("ul");
    for (const text of RULES_TEXT) list.append(node("li", "", text));
    const close = node("button", "sg-game-btn", "閉じる");
    close.type = "button";
    close.onclick = () => (layer.hidden = true);
    box.append(list, close);
    layer.replaceChildren(box);
  }
  // 記録: this player's own numbers, then the latest lines and jackpots of everybody.
  function book() {
    if (view.busy) return;
    const { state } = view,
      layer = view.layer;
    layer.className = "sg-layer";
    layer.hidden = false;
    const box = node("div", "sg-sheet sg-book");
    box.append(node("p", "sg-sheet-title", "記録"));
    const mine = node("dl", "sg-stats");
    const net = state.won - state.bet;
    for (const [k, v] of [
      ["振った回数", fmt(state.rolls) + "回"],
      ["賭けた合計", fmt(state.bet) + api.unit()],
      ["戻った合計", fmt(state.won) + api.unit()],
      ["収支", (net > 0 ? "+" : net < 0 ? "−" : "±") + fmt(Math.abs(net)) + api.unit()],
      ["ボール", fmt(state.balls) + "個"],
      ["ビンゴ", fmt(state.bingos) + "列"],
      ["1回の最高", fmt(state.best) + api.unit()],
      ["ほかの人のビンゴの分け前", fmt(state.shared) + api.unit()],
      ["JACKPOT / SUPER", (state.jps || 0) + "回 / " + (state.sjps || 0) + "回"],
    ]) {
      const row = node("div", "");
      row.append(node("dt", "", k), node("dd", "", v));
      mine.append(row);
    }
    const recent = node("ol", "sg-log");
    recent.setAttribute("aria-label", "みんなの最近の記録");
    const when = (at) => new Date(at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
    for (const e of view.log.slice().reverse()) {
      const li = node("li", "is-" + e.t);
      li.append(node("time", "", when(e.at)), node("span", "", (e.id === api.uid() ? "あなた" : (e.n || "だれか") + "さん") + "　" + logText(e)));
      recent.append(li);
    }
    if (!view.log.length) recent.append(node("li", "sg-log-empty", "まだありません"));
    const close = node("button", "sg-game-btn", "閉じる");
    close.type = "button";
    close.onclick = () => (layer.hidden = true);
    box.append(mine, node("p", "sg-book-title", "みんなの最近の記録"), recent, close);
    layer.replaceChildren(box);
  }
  // Which card is in view, and turning to one (by the tabs, a swipe, or the ball that just landed).
  const cardOf = (cell) => Math.floor(cell / (S.CARD * S.CARD));
  function currentCard() {
    const w = view.slider?.clientWidth || 1;
    return Math.max(0, Math.min(S.CARDS - 1, Math.round((view.slider?.scrollLeft || 0) / w)));
  }
  function syncTabs() {
    if (!view?.tabs) return;
    const now = currentCard();
    view.tabs.forEach((tab, b) => tab.setAttribute("aria-pressed", String(b === now)));
  }
  function turnTo(b, smooth) {
    if (!view?.slider || currentCard() === b) return syncTabs();
    const w = view.slider.clientWidth;
    view.slider.scrollTo({ left: b * w, behavior: smooth && !calm() ? "smooth" : "auto" });
    view.tabs?.forEach((tab, i) => tab.setAttribute("aria-pressed", String(i === b)));
  }
  // Each cell: its number, or the ball of whoever opened it — their icon, or their initial on a
  // colour of their own — with this player's balls ringed in gold.
  function paintCard() {
    const id = api.uid();
    view.cells.forEach((cell, i) => {
      const owner = view.card.owners[i],
        who = owner && view.people[owner];
      cell.classList.toggle("is-on", !!owner);
      cell.classList.toggle("is-mine", owner === id);
      cell.style.backgroundImage = who?.i ? 'url("' + who.i + '")' : "";
      cell.style.setProperty("--hue", hue(owner));
      cell.title = owner ? (who?.n || "だれか") + "のボール（" + view.card.cells[i] + "）" : "";
      cell.firstChild.textContent = String(view.card.cells[i]);
      cell.dataset.initial = owner && !who?.i ? (who?.n || "?").trim().slice(0, 1) : "";
      cell.classList.toggle("has-icon", !!who?.i);
    });
  }
  // The bag: up to three items (tap one to use it on the next roll), and the shop.
  function paintItems() {
    if (!view.itemBar) return;
    const held = S.itemsOf(view.state);
    view.armed.ids = view.armed.ids.filter((id) => held.includes(id));
    if (!view.armed.ids.includes("exact")) view.armed.face = 0;
    const locked = view.busy || !!view.state.pending;
    view.itemBar.replaceChildren();
    for (let i = 0; i < S.RULES.itemMax; i++) {
      const id = held[i],
        b = node("button", "sg-item" + (id ? "" : " is-empty"));
      b.type = "button";
      if (id) b.append(itemIcon(id), node("span", "", ITEM_INFO[id].n));
      else b.textContent = "—";
      b.disabled = !id || locked;
      if (id) {
        b.dataset.item = id;
        b.title = ITEM_INFO[id].d;
        // (Two of a kind: only the first lights up.)
        b.setAttribute("aria-pressed", String(view.armed.ids.includes(id) && held.indexOf(id) === i));
        b.onclick = () => arm(id);
      }
      view.itemBar.append(b);
    }
    const shop = node("button", "sg-shop", "ショップ");
    shop.type = "button";
    shop.disabled = view.busy;
    shop.onclick = () => openShop();
    view.itemBar.append(shop);
    view.facePick.hidden = !view.armed.ids.includes("exact");
    view.facePick.replaceChildren();
    if (!view.facePick.hidden)
      for (let f = 1; f <= 6; f++) {
        const b = node("button", "", String(f));
        b.type = "button";
        b.disabled = locked;
        b.setAttribute("aria-pressed", String(view.armed.face === f));
        b.setAttribute("aria-label", "出目 " + f);
        b.onclick = () => {
          view.armed.face = f;
          hud();
        };
        view.facePick.append(b);
      }
  }
  function arm(id) {
    if (view.busy || view.state.pending) return;
    const ids = view.armed.ids;
    if (ids.includes(id)) view.armed.ids = ids.filter((x) => x !== id);
    else {
      // The two kinds of dice do not go together.
      view.armed.ids = [...ids.filter((x) => !(id === "dice2" && x === "exact") && !(id === "exact" && x === "dice2")), id];
    }
    hud();
  }
  const useNow = () => ({ items: view.armed.ids.slice(), ...(view.armed.ids.includes("exact") ? { face: view.armed.face } : {}) });
  function openShop(note = "") {
    if (view.busy) return;
    const layer = view.layer;
    layer.className = "sg-layer";
    layer.hidden = false;
    const box = node("div", "sg-sheet sg-shopbox");
    box.append(node("p", "sg-sheet-title", "アイテムショップ"));
    const held = S.itemsOf(view.state);
    box.append(node("p", "sg-shop-have", "持っているもの " + held.length + "/" + S.RULES.itemMax + "　所持 " + fmt(api.balance()) + api.unit()));
    const list = node("ul", "sg-shop-list");
    for (const [id, info] of Object.entries(ITEM_INFO)) {
      if (S.RULES.items[id].retired) continue;
      const price = S.RULES.items[id].price,
        li = node("li", "");
      const text = node("span", "sg-shop-text");
      text.append(node("b", "", info.n), node("small", "", info.d));
      const buy = node("button", "sg-game-btn", fmt(price) + api.unit());
      buy.type = "button";
      buy.dataset.buy = id;
      buy.disabled = held.length >= S.RULES.itemMax || api.balance() < price;
      buy.onclick = () => buyItem(id);
      li.append(itemIcon(id), text, buy);
      list.append(li);
    }
    const out = node("p", "sg-shop-note", typeof note === "string" ? note : "");
    const close = node("button", "sg-game-btn", "閉じる");
    close.type = "button";
    close.onclick = () => (layer.hidden = true);
    box.append(list, out, close);
    layer.replaceChildren(box);
  }
  function buyItem(id) {
    if (view.busy) return;
    const price = S.RULES.items[id].price;
    if (api.balance() < price) return openShop("足りません");
    let bought;
    try {
      bought = S.buy(view.state, id);
    } catch {
      return openShop("いっぱいです");
    }
    api.round("sugoroku-shop").net(-price, 0);
    view.state = bought.state;
    save(bought.state);
    api.refresh();
    hud();
    openShop(ITEM_INFO[id].n + " を買いました");
  }
  const hue = (id) => [...String(id || "")].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  function hud() {
    const { state } = view;
    const pots = window.CasinoJackpot?.amounts() || { jp: 0, sjp: 0 };
    for (const kind of ["jp", "sjp"]) view.body.querySelector('[data-pot="' + kind + '"] b').textContent = fmt(pots[kind]) + "pt";
    const reaches = S.reach(view.card),
      reach = new Set(reaches.flatMap((line) => S.LINES[line]));
    view.cells.forEach((cell, i) => cell.classList.toggle("is-reach", !view.card.owners[i] && reach.has(i)));
    // Reaches per card on the tabs (the card not in view may be the one waiting), and the special number.
    const perCard = Array(S.CARDS).fill(0);
    for (const line of reaches) perCard[cardOf(S.LINES[line][0])]++;
    view.tabs?.forEach((tab, b) => {
      tab.firstChild.textContent = perCard[b] ? "リーチ" + perCard[b] : "";
      tab.classList.toggle("has-reach", perCard[b] > 0);
    });
    syncTabs();
    if (view.special) view.special.textContent = "★ " + view.card.special;
    // The more lines wait on one number, the warmer the card.
    view.cardWrap.style.setProperty("--heat", String(Math.min(reaches.length, 6)));
    view.cardWrap.classList.toggle("is-warm", reaches.length > 0);
    const wanted = [...new Set(reaches.map((line) => view.card.cells[S.LINES[line].find((c) => !view.card.owners[c])]))].sort((a, b) => a - b);
    view.info.replaceChildren(
      node("span", "", "リーチ "),
      node("b", "", String(reaches.length)),
      ...(wanted.length ? [node("span", "sg-wanted", "（" + wanted.slice(0, 4).join("・") + (wanted.length > 4 ? "…" : "") + "）")] : []),
      node("span", "", "　ビンゴ "),
      node("b", "", (state.bingos || 0) + "回"),
      ...(view.online ? [] : [node("span", "sg-alone", api.uid() === "GUEST-000" ? "　自分だけのカード" : "　オフライン：自分だけのカード")]),
    );
    // Out of practice chips: the button fills them up again instead.
    const short = api.balance() < view.cost,
      refill = short && !api.real() && !!api.resetPractice,
      // On points, today's bets are limited by today's study (see Casino.allowance).
      study = !short && api.real() && !!api.allowance && api.allowance() < view.cost;
    for (const b of view.costBtns || []) {
      b.setAttribute("aria-pressed", String(Number(b.dataset.cost) === view.cost));
      b.disabled = view.busy || !!state.pending || !!state.bonus?.length;
    }
    paintItems();
    const needFace = view.armed.ids.includes("exact") && !view.armed.face;
    view.go.disabled = view.busy || !!view.syncing || (short && !refill) || study || !!state.pending || needFace;
    view.go.textContent = refill
      ? "練習チップを" + fmt(api.practiceStart) + "枚に戻す"
      : short
        ? api.real()
          ? "ポイントが足りません"
          : "チップが足りません"
        : view.busy
          ? "…"
          : study
            ? "勉強すると振れます"
            : needFace
              ? "出目を選んでください"
              : "サイコロを振る";
    view.go.title = study ? api.studyHint(view.cost) : "";
    if (view.studyEl) {
      view.studyEl.hidden = !api.real() || !api.allowance;
      if (!view.studyEl.hidden) view.studyEl.textContent = study ? api.studyHint(view.cost) : "今日あと " + fmt(api.allowance()) + "pt（" + Math.floor(api.allowance() / view.cost) + "回）振れます";
    }
  }
  // The piece sits on its square; the strip slides so the piece stays a little left of centre.
  function place(pos, smooth = true) {
    view.squares.forEach((sq, i) => sq.classList.toggle("is-here", i === pos));
    const sq = view.squares[pos];
    view.piece.style.transform = "translateX(" + (sq.offsetLeft + sq.offsetWidth / 2) + "px)";
    view.piece.classList.remove("is-hop");
    if (smooth && pace() === 1) {
      void view.piece.offsetWidth;
      view.piece.classList.add("is-hop");
    }
    const left = sq.offsetLeft - view.track.clientWidth * 0.35;
    view.track.scrollTo?.({ left, behavior: smooth && pace() === 1 ? "smooth" : "auto" });
  }

  // ---- The die: a cube that tumbles and lands on its number --------------------------------
  const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  // Which way the cube turns to show each number at the front.
  const FACE = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 2: [90, 0] };
  function cube() {
    const box = node("div", "sg-dice3d"),
      body = node("div", "sg-cube");
    box.setAttribute("aria-hidden", "true");
    for (const [v, side] of [[1, "front"], [6, "back"], [3, "right"], [4, "left"], [5, "top"], [2, "bottom"]]) {
      const face = node("div", "sg-face is-" + side + (v === 1 ? " is-one" : ""));
      for (let i = 1; i <= 9; i++) face.append(node("i", PIPS[v].includes(i) ? "is-on" : ""));
      body.append(face);
    }
    box.append(body, node("span", "sg-shadow"));
    let turn = [0, 0];
    return {
      box,
      // Shaken in the hand from the press until the result is known.
      shake() {
        if (pace()) box.classList.add("is-shaking");
      },
      stop() {
        box.classList.remove("is-shaking");
      },
      async roll(value) {
        box.classList.remove("is-shaking");
        const [x, y] = FACE[value],
          quick = !pace();
        // Whole extra turns so it tumbles, then the face for the number.
        turn = [turn[0] - (turn[0] % 360) + 720 + x, turn[1] - (turn[1] % 360) + 720 + y];
        body.style.transition = quick ? "none" : "transform " + 1000 * pace() + "ms cubic-bezier(.2,.75,.25,1)";
        box.classList.remove("is-rolling");
        void box.offsetWidth;
        if (!quick) box.classList.add("is-rolling");
        body.style.transform = "rotateX(" + turn[0] + "deg) rotateY(" + turn[1] + "deg)";
        await wait(1050);
      },
    };
  }

  // ---- A roll ----------------------------------------------------------------------------
  // How long things take: skipped (reduced motion, or a tap to skip), a quarter in 早送り outside
  // the hot moments, or in full.
  const pace = () => (calm() || view?.fast ? 0 : view?.quick && !view.hot ? 0.25 : 1);
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, pace() ? ms * pace() : Math.min(ms, 20)));
  // A roll (or a game's end) moves the wallet once: what came back (with any part of other
  // players' lines collected) less the bet. An accident can take more than there is: with points
  // the rest is owed to the casino (a 請求 in ポイントの貸し借り); on practice chips it stops at 0.
  function pay(out, cost) {
    const net = (out.collected || 0) + out.gain - cost,
      have = api.balance();
    // A part of other players' lines, with points: a notice in the お知らせボックス.
    if (out.collected > 0 && api.real()) {
      try {
        window.PersonalNotices?.add(api.uid(), {
          id: "sugoroku:" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          title: "ほかの人のビンゴの分け前 +" + fmt(out.collected) + "pt",
          body: "すごろくビンゴで、ほかの人のラインの分け前が届きました。",
          amount: out.collected,
        });
      } catch (error) {
        console.warn("[sugoroku] notice", error);
      }
    }
    api.round("sugoroku").net(Math.max(net, -have), cost);
    if (-net > have && api.real())
      Promise.resolve(window.PointLoans?.owe?.(-net - have, "すごろくビンゴのアクシデント")).catch((error) => console.warn("[sugoroku] debt", error));
  }
  // Jackpots waiting in out.state: with points each is taken from the casino's pot and paid (and
  // stays waiting if the network fails); in the preview it is only shown. The amounts go onto
  // the jackpot events, in order, for the show.
  async function payJackpots(out) {
    const shows = (out.events || []).filter((e) => e.t === "jackpot");
    while (out.state.jpWait?.length) {
      const kind = out.state.jpWait[0];
      let amount = window.CasinoJackpot?.amounts()[kind] || 0;
      if (api.real()) {
        try {
          amount = await window.CasinoJackpot.win(kind, { id: api.uid(), n: (await person()).n });
        } catch (error) {
          console.warn("[sugoroku] jackpot", error);
          say("ジャックポットは通信できたときに受け取ります", "is-loss");
          return;
        }
        api.round("sugoroku-jackpot").pay(amount);
      }
      out.state = { ...out.state, jpWait: out.state.jpWait.slice(1) };
      save(out.state);
      const show = shows.shift();
      if (show) show.amount = amount;
    }
  }
  async function roll() {
    if (!view.busy && api.balance() < view.cost && !api.real() && api.resetPractice) {
      api.resetPractice();
      return hud();
    }
    if (view.busy || view.state.pending || api.balance() < view.cost) return;
    if (api.real() && api.allowance && api.allowance() < view.cost) return hud();
    const cost = view.cost,
      state = view.state,
      me = api.uid();
    const use = useNow();
    view.armed = { ids: [], face: 0 };
    view.busy = true;
    hud();
    markHere();
    view.die.shake();
    // Worked out at once on the card as last seen. Most rolls draw no ball and leave the card
    // alone, so they need no cloud round trip; a ball (or a part waiting for this player) does.
    const tape = [],
      local = S.roll(state, view.card, cost, recorder(tape), me, use),
      touches = local.events.some((e) => e.t === "ball") || view.card.owed?.[me] > 0;
    let result,
      shownEarly = 0,
      early = null,
      liveEarly = { ...state, stake: state.stake + cost };
    if (view.online && !touches) result = { out: local, collected: 0, people: view.people, log: view.log, before: { card: view.card, people: view.people, log: view.log } };
    else {
      // While the cloud answers, what does not depend on the card plays already: the same draws
      // give the same die, steps and wheels up to the first ball, so the die lands at once.
      const k = local.events.findIndex((e) => e.t === "ball");
      shownEarly = k < 0 ? local.events.length : k;
      view.fast = false;
      view.hot = false;
      view.body.classList.add("is-spinning");
      view.state = liveEarly;
      early = show(local.events.slice(0, shownEarly), liveEarly);
      try {
        result = await onCard((card) => S.roll(state, card, cost, replay(tape), me, use));
      } catch (error) {
        console.warn("[sugoroku] roll", error);
        await early;
        view.die.stop();
        view.state = state;
        view.busy = false;
        view.body.classList.remove("is-spinning");
        place(state.pos, false);
        hud();
        say("通信できませんでした。もう一度振ってください", "is-loss");
        return;
      }
      await early;
    }
    const { out, before, people, collected } = result;
    out.collected = collected;
    save(out.state);
    pay(out, cost);
    await payJackpots(out);
    if (collected) out.events.push({ t: "share", amount: collected });
    await run(out, liveEarly, before, people, result.log, shownEarly);
    if (view?.state.bonus?.length) await bonus();
    if (view?.state.pending) game();
  }
  // A part of other players' lines waiting for this player is taken as soon as it is seen (on
  // opening, or when the card changes), not only with the next ball.
  async function collectNow() {
    const me = api.uid();
    if (!view || view.busy || !view.online || !(view.card.owed?.[me] > 0) || view.state.pending || view.state.bonus?.length) return;
    view.busy = true;
    hud();
    let result;
    try {
      result = await onCard((card) => ({ state: { ...view.state }, card, events: [], gain: 0 }));
    } catch (error) {
      console.warn("[sugoroku] collect", error);
      view.busy = false;
      return hud();
    }
    const { out, collected } = result;
    out.collected = collected;
    view.state = out.state;
    view.card = out.card;
    view.people = result.people;
    view.log = result.log;
    view.busy = false;
    save(out.state);
    if (collected) {
      pay(out, 0);
      say("ほかの人のビンゴの分け前　+" + fmt(collected) + api.unit(), "is-gain");
      api.refresh();
    }
    paintCard();
    hud();
  }
  // Plays events over a copy of the state shown so far, then shows the real new state.
  // `before` is the card the change was made on (it may hold other players' new balls).
  // `skip`: how many of the events were already shown while the cloud answered (the tap to skip
  // and the heat carry on from them).
  async function run(out, shown, before, people, log, skip = 0) {
    const target = view;
    view.busy = true;
    if (!skip) {
      view.fast = false;
      view.hot = false;
    }
    view.body.classList.add("is-spinning");
    const live = { ...shown };
    view.state = live;
    view.card = { ...before.card, cells: [...before.card.cells], owners: [...before.card.owners], ...(before.card.bets ? { bets: [...before.card.bets] } : {}) };
    // This player's own name and icon stay known even if a finished line just took their balls.
    view.people = { ...before.people, ...people, ...(me && me.id === api.uid() ? { [me.id]: me.value } : {}) };
    paintCard();
    hud();
    try {
      await show(out.events.slice(skip), live);
    } finally {
      if (target === view) {
        view.state = out.state;
        view.card = out.card;
        view.log = log || view.log;
        view.hot = false;
        seeLog();
        view.people = { ...people, ...(me && me.id === api.uid() ? { [me.id]: me.value } : {}) };
        view.busy = false;
        view.body.classList.remove("is-spinning");
        paintCard();
        hud();
        if (out.gain && !out.state.pending) say(out.gain > 0 ? "+" + fmt(out.gain) + api.unit() : "−" + fmt(-out.gain) + api.unit(), out.gain > 0 ? "is-gain" : "is-loss");
        api.refresh();
      }
    }
  }
  function say(text, cls = "") {
    const el = view.say;
    el.className = "sg-say " + cls;
    el.textContent = text;
    if (!text) return;
    void el.offsetWidth;
    el.classList.add("is-on");
  }
  async function show(events, live) {
    for (const e of events) {
      if (!view?.body.isConnected) return;
      // From a line on, the rest of the roll keeps its full time even in 早送り.
      if (e.t === "line" || e.t === "jackpot") view.hot = true;
      if (e.t === "share") {
        say("ほかの人のビンゴの分け前　+" + fmt(e.amount) + api.unit(), "is-gain");
        await wait(1100);
      } else if (e.t === "item") {
        say(ITEM_INFO[e.id].n + "！", "is-hot");
        await wait(800);
      } else if (e.t === "itemGet") {
        say(e.full ? ITEM_INFO[e.id].n + "　持ちきれないので +" + fmt(e.amount) + api.unit() : ITEM_INFO[e.id].n + " をゲット！", e.full ? "is-gain" : "is-hot");
        await wait(1200);
      } else if (e.t === "guarded") {
        say("ガードで、アクシデントは無効", "is-gain");
        await wait(1000);
      } else if (e.t === "die") {
        say("");
        if (e.values) {
          // Two or three dice: one after the other, then their sum.
          for (let i = 0; i < e.values.length; i++) {
            await view.die.roll(e.values[i]);
            say(e.values.slice(0, i + 1).join(" + ") + (i === e.values.length - 1 ? " = " + e.value : ""), i === e.values.length - 1 ? "is-gain" : "is-ball");
          }
          await wait(500);
        } else await view.die.roll(e.value);
      } else if (e.t === "step") {
        live.pos = e.to;
        place(e.to);
        hud();
        await wait(190);
      } else if (e.t === "lap") {
        say("START通過　ボール", "is-ball");
        await wait(900);
      } else if (e.t === "land") {
        const sq = view.squares[e.square];
        sq.classList.add("is-flash");
        setTimeout(() => sq.classList.remove("is-flash"), 600);
        await wait(220);
      } else if (e.t === "wheel") {
        await wheel(e);
      } else if (e.t === "ball") {
        await drawBall(e, live);
      } else if (e.t === "line") {
        turnTo(cardOf(e.cells[0]), true);
        hud();
        e.cells.forEach((c, i) => {
          const cell = view.cells[c];
          cell.style.setProperty("--i", i);
          cell.classList.add("is-run");
          setTimeout(() => cell.classList.remove("is-run"), 1800);
        });
        say((e.count === 2 ? "DOUBLE BINGO" : e.count === 3 ? "TRIPLE BINGO" : e.count > 3 ? e.count + " BINGO" : "BINGO") + (e.solo ? "　ひとりで" : ""), "is-hot");
        await wait(1600);
        if (e.mult > 1) {
          say("報酬 ×" + e.mult + (e.solo ? "（自分のボールだけ ×" + S.RULES.soloBonus + "）" : "") + (e.count > 1 ? "（" + e.count + "列同時 ×" + (e.count + 1) + "）" : ""), "is-gain");
          await wait(1300);
        }
      } else if (e.t === "reset") {
        // The finished lines start again: their balls leave (the numbers stay).
        for (const c of e.cells) {
          view.card.owners[c] = "";
          view.cells[c].classList.add("is-new");
          setTimeout(() => view?.cells[c]?.classList.remove("is-new"), 1200);
        }
        paintCard();
        hud();
        say("そろった列のボールが戻る", "is-ball");
        await wait(900);
      } else if (e.t === "prize") {
        say("ビンゴ賞金　+" + fmt(e.amount) + api.unit() + (e.total > e.amount ? "（みんなに " + fmt(e.total - e.amount) + "）" : ""), "is-gain");
        await wait(1000);
      } else if (e.t === "bonus") {
        say("ミニゲーム：" + MINI[e.game], "is-hot");
        await wait(900);
      } else if (e.t === "take") {
        say("アクシデント　−" + fmt(e.amount) + api.unit(), "is-loss");
        await wait(900);
      } else if (e.t === "back") {
        live.pos = e.to;
        place(e.to);
        hud();
        say(e.by ? e.by + "マス戻る" : "STARTに戻る", "is-loss");
        await wait(900);
      } else if (e.t === "sure") {
        say("ボール確定　+" + fmt(e.amount) + api.unit(), "is-gain");
        await wait(800);
      } else if (e.t === "result") {
        say({ win: "勝ち　+", push: "引き分け　+", lose: "負け　+" }[e.outcome] + fmt(e.amount) + api.unit(), e.outcome === "win" ? "is-gain" : "");
        await wait(900);
      } else if (e.t === "jackpot") {
        await jackpot(e.kind, e.amount);
      }
    }
  }

  // ---- The ball draw: a numbered ball rolls in from the right; on the card it flies into its
  // number, otherwise it greys out and pays 2× ------------------------------------------------
  async function drawBall(e, live) {
    const ball = node("div", "sg-ball", String(e.number));
    // A ball for a number a line is waiting on: it glows and takes its time, even in 早送り.
    const reachBefore = S.reach(view.card),
      onReach = e.cell >= 0 && reachBefore.some((line) => S.LINES[line].includes(e.cell)),
      hot = view.hot;
    if (onReach) {
      view.hot = true;
      ball.classList.add("is-reach");
    }
    view.cardWrap.append(ball);
    if (e.cell >= 0) turnTo(cardOf(e.cell), true);
    if (e.special) ball.classList.add("is-special");
    say(e.special ? "SPECIAL BALL ★" : onReach ? "リーチの番号！" : "", e.special ? "is-hot" : onReach ? "is-hot" : "");
    ball.classList.add("is-in");
    await wait(onReach ? 1600 : 1100);
    if (e.special) {
      await wait(500);
      ball.remove();
      return;
    }
    if (e.miss) {
      ball.classList.add("is-miss");
      say("もう開いている " + e.number + "　×2 +" + fmt(e.amount) + api.unit(), "is-gain");
      await wait(900);
      ball.remove();
      return;
    }
    const cell = view.cells[e.cell],
      from = ball.getBoundingClientRect(),
      to = cell.getBoundingClientRect();
    ball.style.setProperty("--dx", to.left + to.width / 2 - (from.left + from.width / 2) + "px");
    ball.style.setProperty("--dy", to.top + to.height / 2 - (from.top + from.height / 2) + "px");
    ball.classList.add("is-hit");
    await wait(450);
    ball.remove();
    view.card.owners[e.cell] = e.owner;
    paintCard();
    cell.classList.add("is-new");
    setTimeout(() => cell.classList.remove("is-new"), 1300);
    // A new reach is called out.
    const more = S.reach(view.card).length > reachBefore.length;
    say(e.number + " にボール" + (more ? "　リーチ！" : ""), more ? "is-hot" : "is-ball");
    hud();
    await wait(more ? 1000 : 700);
    view.hot = hot;
  }

  // ---- Wheels ----------------------------------------------------------------------------
  // The colour says what a slot is worth before the label is read.
  function tone(wheel, slot) {
    if (wheel === "event") return slot === "ball" ? "ball" : "game-" + slot;
    if (wheel === "accident") return slot.start ? "worst" : slot.back ? "bad" : slot.take >= 1.5 ? "worst" : slot.take ? "bad" : "safe";
    if (slot.kakuhen) return "zero";
    if (wheel === "item") return slot.item === "ball" ? "gold" : slot.item === "exact" ? "champagne" : "high";
    if (slot.item === true) return "gold";
    if (wheel === "special") return slot.balls ? "ball" : slot.x >= 30 ? "gold" : slot.x >= 15 ? "champagne" : "high";
    if (wheel === "kakuhen") return slot.balls ? "ball" : slot.x >= 10 ? "gold" : slot.x >= 5 ? "champagne" : slot.x >= 3 ? "high" : "mid";
    if (slot.ball) return "ball";
    if (slot.game && wheel === "normal") return "game-mini";
    if (slot.event) return "game-" + slot.event;
    if (slot.next || slot.jackpot) return "jackpot";
    if (wheel !== "normal") return slot.game ? "game-mini" : slot.miss ? "zero" : slot.back ? "bad" : slot.x >= 20 ? "gold" : slot.x >= 10 ? "champagne" : "high";
    return slot.x >= 3 ? "gold" : slot.x >= 2 ? "champagne" : slot.x >= 1.25 ? "high" : slot.x >= 0.5 ? "mid" : slot.x > 0 ? "low" : slot.x < 0 ? "worst" : "zero";
  }
  function slotLabel(wheel, slot) {
    if (wheel === "event") return slot === "ball" ? "BALL" : { blackjack: "BJ", dice: "DICE", chinchiro: "チンチロ" }[slot];
    if (wheel === "accident") return slot.start ? "START" : slot.back ? "−" + slot.back + "マス" : slot.take ? "−×" + slot.take : "SAFE";
    // Looks like any ×0 slot: the player finds out when the bonus effect starts.
    if (slot.kakuhen) return "×0";
    if (wheel === "item") return ITEM_INFO[slot.item].n;
    if (slot.item === true) return "ITEM";
    if (slot.balls) return "●×" + slot.balls;
    if (slot.ball) return "●";
    if (slot.next) return "SJP";
    if (slot.jackpot) return slot.jackpot === "jp" ? "JACKPOT" : "SUPER";
    if (slot.game) return { timer: "10秒", tap: "連打", tapex: "連打EX", dice: "サイコロ", math: "暗算", stop: "STOP", hilo: "H&L" }[slot.game];
    if (slot.event) return { blackjack: "BJ", dice: "DICE", chinchiro: "チンチロ" }[slot.event];
    if (slot.miss) return "ハズレ";
    if (slot.back) return "もう一回";
    return slot.x < 0 ? "−×" + -slot.x : "×" + slot.x;
  }
  function wheelSvg(e) {
    const n = e.slots.length,
      r = 100,
      ns = "http://www.w3.org/2000/svg",
      svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "-118 -118 236 236");
    svg.setAttribute("aria-hidden", "true");
    const el = (tag, attrs) => {
      const x = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) x.setAttribute(k, v);
      return x;
    };
    svg.append(el("circle", { r: 116, class: "sg-rim" }));
    // Lamps round the rim: they run while the wheel turns and flash on the result.
    const lamps = el("g", { class: "sg-lamps" });
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI * 2) / 24;
      const lamp = el("circle", { cx: Math.sin(a) * 108, cy: -Math.cos(a) * 108, r: 2.6, class: "sg-lamp" });
      lamp.style.setProperty("--i", i);
      lamps.append(lamp);
    }
    svg.append(lamps);
    const disc = el("g", { class: "sg-disc" });
    const at = (deg, rad) => [Math.sin((deg * Math.PI) / 180) * rad, -Math.cos((deg * Math.PI) / 180) * rad];
    e.slots.forEach((slot, i) => {
      const a = (i * 360) / n,
        b = ((i + 1) * 360) / n,
        [x1, y1] = at(a, r),
        [x2, y2] = at(b, r);
      disc.append(el("path", { d: "M0 0L" + x1 + " " + y1 + "A" + r + " " + r + " 0 0 1 " + x2 + " " + y2 + "Z", class: "sg-seg is-" + tone(e.wheel, slot) }));
      const mid = (a + b) / 2,
        [tx, ty] = at(mid, n > 12 ? 80 : 68),
        label = slotLabel(e.wheel, slot);
      // On a crowded wheel (the normal one) each label runs along its slice, from the rim in.
      const dense = n > 24,
        [dx, dy] = dense ? at(mid, 74) : [tx, ty];
      const text = el("text", { transform: "translate(" + dx + " " + dy + ") rotate(" + (dense ? mid - 90 : mid) + ")", class: "sg-seg-text is-" + tone(e.wheel, slot) + (dense ? " is-dense" : (label.length > 4 ? " is-long" : "") + (n > 12 ? " is-many" : "")) });
      text.textContent = label;
      disc.append(text);
    });
    svg.append(disc, el("circle", { r: 20, class: "sg-hub" }));
    return { svg, disc };
  }
  async function wheel(e) {
    const layer = view.layer,
      hot = HOT.has(e.wheel);
    layer.className = "sg-layer is-" + e.wheel + (hot ? " is-hot" : "");
    layer.hidden = false;
    const box = node("div", "sg-wheel");
    box.append(node("p", "sg-wheel-title", e.wheel === "normal" ? "BET " + fmt(e.base) + api.unit() : WHEEL_NAMES[e.wheel]));
    const face = node("div", "sg-wheel-face");
    const { svg, disc } = wheelSvg(e);
    face.append(svg, node("i", "sg-pointer"));
    box.append(face);
    const outcome = node("p", "sg-wheel-out");
    box.append(outcome);
    if (e.mult > 1 && HOT.has(e.wheel)) box.append(node("p", "sg-wheel-base", "賞金とミニゲームは ×" + e.mult));
    layer.replaceChildren(box);
    const n = e.slots.length,
      turns = { normal: 4, event: 4, accident: 4, bingo: 5, jp: 6, sjp: 7, kakuhen: 5, special: 5, item: 4 }[e.wheel],
      jitter = (random(60) - 30) / 100,
      angle = turns * 360 - ((e.index + 0.5 + jitter * 0.8) * 360) / n;
    const full = { normal: 1700, event: 2000, accident: 2000, bingo: 3000, jp: 3800, sjp: 4600, kakuhen: 3200, special: 3200, item: 2200 }[e.wheel],
      time = full * pace();
    box.classList.add("is-spinning");
    disc.style.transition = time ? "transform " + time + "ms cubic-bezier(.15,.6,.1,1)" : "none";
    void disc.getBoundingClientRect();
    disc.style.transform = "rotate(" + angle + "deg)";
    await wait(full + 60);
    box.classList.remove("is-spinning");
    const slot = e.slots[e.index];
    outcome.className = "sg-wheel-out is-" + tone(e.wheel, slot);
    outcome.textContent =
      e.wheel === "event"
        ? GAME_NAMES[slot]
        : e.wheel === "accident"
          ? slot.start
            ? "STARTに戻る"
            : slot.back
              ? slot.back + "マス戻る"
              : slot.take
                ? "−" + fmt(Math.round(e.base * slot.take)) + api.unit()
                : "セーフ"
          : e.wheel === "item"
            ? ITEM_INFO[slot.item].n
          : slot.item === true
            ? "ITEM チャンス"
          : slot.balls
            ? "ボール " + slot.balls + "連続！"
          : slot.next
            ? "SUPER JACKPOT CHANCE"
            : slot.jackpot
              ? slot.jackpot === "jp" ? "JACKPOT" : "SUPER JACKPOT"
              : slot.game
                ? MINI[slot.game] + " チャレンジ"
                : slot.event
                  ? GAME_NAMES[slot.event]
                  : slot.x < 0
                    ? "−×" + -slot.x + "　−" + fmt(-e.amount) + api.unit()
                : slot.miss
                  ? "ハズレ（ビンゴ賞金のみ）"
                  : slot.back
                    ? "もう一回！"
                    : "×" + slot.x + "　+" + fmt(e.amount) + api.unit() + (slot.ball ? "　BALL" : "") + (e.total > e.amount ? "（みんなに " + fmt(e.total - e.amount) + "）" : "");
    box.classList.add("is-done");
    if (slot.next || slot.jackpot || slot.balls || slot.x >= 5) layer.classList.add("is-hotter");
    // A hidden bonus slot: it reads ×0 for a moment, then the room goes gold and shakes.
    if (slot.kakuhen) {
      await wait(900);
      layer.classList.add("is-hot", "is-hotter");
      box.classList.add("is-surge");
      outcome.className = "sg-wheel-out is-gold";
      outcome.textContent = "CHANCE";
      window.AppSounds?.play("swipe-right");
      await wait(1700);
      layer.hidden = true;
      return;
    }
    await wait(hot || slot.x >= 2 || slot.x < 0 || slot.ball ? 1300 : 750);
    layer.hidden = true;
  }
  async function jackpot(kind, won) {
    const amount = won ?? (window.CasinoJackpot?.amounts()[kind] || 0),
      word = kind === "sjp" ? "SUPER JACKPOT" : "JACKPOT";
    const layer = view.layer;
    layer.className = "sg-layer is-hot is-hotter is-jackpot";
    layer.hidden = false;
    const box = node("div", "sg-jackpot");
    const value = node("b", "", "0pt");
    box.append(node("p", "sg-jackpot-word", word), value, ...(api.real() ? [] : [node("small", "", "練習チップのため、ジャックポットは演出のみです")]));
    layer.replaceChildren(box);
    const steps = calm() || view.fast ? 1 : 50;
    for (let i = 1; i <= steps; i++) {
      value.textContent = fmt(Math.round((amount * i) / steps)) + "pt";
      await wait(40);
    }
    await wait(2800);
    layer.hidden = true;
  }

  // ---- Event games -----------------------------------------------------------------------
  // The game's round lives in state.pending.round and is saved after every move.
  function keepRound(round) {
    view.state = { ...view.state, pending: { ...view.state.pending, round } };
    save(view.state);
  }
  function game() {
    const p = view.state.pending,
      layer = view.layer;
    layer.className = "sg-layer is-game";
    layer.hidden = false;
    view.busy = true;
    hud();
    const box = node("div", "sg-game");
    box.append(node("p", "sg-wheel-title", GAME_NAMES[p.game] + "　" + fmt(p.bet) + api.unit()), node("p", "sg-game-rule", p.plain ? "普通のマスのゲーム：勝てば配当、負けると賭けた分はなくなります（ボールは出ません）。" : "勝てば配当とボール。負けると賭けた分はなくなります。"));
    const table = node("div", "sg-game-table"),
      actions = node("div", "sg-game-actions"),
      line = node("p", "sg-game-line");
    box.append(table, line, actions);
    layer.replaceChildren(box);
    // おまかせ plays the round with a plain strategy (blackjack: draw below 17; dice poker: keep
    // what the dealer would; chinchiro: throw until done) and goes on by itself. In 早送り it
    // starts on its own. Each game sets `step` (one move; false when the round is over) and `redraw`.
    let auto = false,
      step = null,
      redraw = null;
    const autoBtn = node("button", "sg-game-btn sg-auto", "おまかせ");
    autoBtn.type = "button";
    autoBtn.dataset.sgGame = "auto";
    const play = async () => {
      if (auto || !step) return;
      auto = true;
      autoBtn.disabled = true;
      redraw();
      while (view?.layer === layer && !layer.hidden && step()) await wait(400);
    };
    autoBtn.onclick = play;
    const button = (text, onClick, data) => {
      const b = node("button", "sg-game-btn", text);
      b.type = "button";
      if (data) b.dataset.sgGame = data;
      b.onclick = onClick;
      // While おまかせ plays, the buttons are its own.
      if (auto) b.disabled = true;
      actions.append(b);
      return b;
    };
    // The result shows for a moment and the board goes on by itself (no つづける to press).
    let ended = false;
    const end = (m) => {
      actions.replaceChildren();
      autoBtn.remove();
      if (ended) return;
      ended = true;
      const target = view;
      setTimeout(() => target === view && view.layer === layer && !layer.hidden && finish(m), view.quick ? 500 : calm() ? 300 : 1400);
    };
    // The other side's throws, one at a time, so every die can be seen landing.
    const reveal = async (count, show) => {
      for (let i = 1; i <= count; i++) {
        show(i);
        if (i < count) await wait(view.quick ? 150 : 550);
      }
    };
    if (p.game === "blackjack") {
      const draw = () => {
        const t = p.round;
        table.replaceChildren();
        for (const [who, cards, hide] of [["ディーラー", t.dealer, !t.done], ["あなた", t.seats.me.hands[0].cards, false]]) {
          const row = node("div", "sg-hand");
          row.append(node("span", "", who + "　" + (hide ? "" : C.bjTotal(cards).total)));
          const list = node("div", "sg-cards");
          for (const c of cards) list.append(window.Poker.card(c));
          if (hide && cards.length === 1) list.append(window.Poker.card(null));
          row.append(list);
          table.append(row);
        }
        actions.replaceChildren();
        line.textContent = "";
        if (!t.done) {
          const act = (move) => () => {
            p.round = C.tableAct(p.round, "me", move);
            keepRound(p.round);
            draw();
          };
          button("もう1枚", act("hit"), "hit");
          button("これで勝負", act("stand"), "stand");
        } else {
          const out = C.tableOutcome(t, "me"),
            m = out.net / p.bet;
          line.textContent = m > 0 ? "勝ち" : m === 0 ? "引き分け" : "負け";
          end(m);
        }
      };
      step = () => {
        const t = p.round;
        if (t.done) return false;
        const hand = t.seats.me.hands.find((h) => !h.done) || t.seats.me.hands[0];
        p.round = C.tableAct(t, "me", C.bjTotal(hand.cards).total < 17 ? "hit" : "stand");
        keepRound(p.round);
        draw();
        return true;
      };
      redraw = draw;
      if (!p.round) keepRound((p.round = C.tableDeal(["me"], { me: p.bet }, random)));
      draw();
    } else if (p.game === "dice") {
      const draw = () => {
        const r = p.round;
        table.replaceChildren();
        const mine = node("div", "sg-dice");
        r.dice.forEach((v, i) => {
          const b = node("button", "sg-die-btn" + (r.held[i] ? " is-held" : ""));
          b.type = "button";
          b.setAttribute("aria-pressed", String(r.held[i]));
          b.setAttribute("aria-label", v + "の目" + (r.held[i] ? "（残す）" : ""));
          b.append(die(v));
          b.onclick = () => {
            if (r.done) return;
            p.round = C.diceToggle(r, i);
            keepRound(p.round);
            draw();
          };
          mine.append(b);
        });
        const name = (dice) => C.DICE_NAMES[C.diceScore(dice)[0]];
        const me = node("div", "sg-hand");
        me.append(node("span", "", "あなた　" + name(r.dice)), mine);
        table.append(me);
        const throws = r.dealerRolls || (r.dealer ? [r.dealer] : []),
          seen = Math.min(shown ?? throws.length, throws.length);
        if (seen) {
          const dealer = node("div", "sg-hand"),
            row = node("div", "sg-dice"),
            dice = throws[seen - 1];
          dice.forEach((v) => row.append(die(v)));
          dealer.append(node("span", "", "ディーラー　" + name(dice) + "（" + seen + "投目）"), row);
          table.prepend(dealer);
        }
        actions.replaceChildren();
        if (r.done && seen < throws.length) {
          line.textContent = "ディーラーが振っています…";
          return;
        }
        if (!r.done) {
          const most = r.most || 3;
          line.textContent = "残すダイスをタップ（振り直しはあと" + (most - r.rolls) + "回。ディーラーは2回まで）";
          const again = button("振り直す", () => {
            p.round = C.diceReroll(r, random);
            keepRound(p.round);
            draw();
          }, "reroll");
          again.disabled = r.rolls >= 3 || r.held.every(Boolean);
          button("これで勝負", () => stand(), "stand");
        } else {
          // Fair: the same number of throws as the dealer, the same hands, a win pays the bet.
          line.textContent = r.outcome === "win" ? "勝ち" : r.outcome === "push" ? "引き分け" : "負け";
          end(r.net / p.bet);
        }
      };
      // How many of the dealer's throws are on the table (null: all of them, as after a reload).
      let shown = null;
      const stand = () => {
        if (p.round.done) return;
        p.round = C.diceStand(p.round, random);
        keepRound(p.round);
        shown = 0;
        reveal(p.round.dealerRolls.length, (i) => {
          shown = i;
          draw();
        });
      };
      step = () => {
        const r = p.round;
        if (r.done) return false;
        const keep = C.dealerKeeps(r.dice);
        if (r.rolls < (r.most || 3) && !keep.every(Boolean)) {
          let next = r;
          keep.forEach((k, i) => next.held[i] !== k && (next = C.diceToggle(next, i)));
          p.round = C.diceReroll(next, random);
          keepRound(p.round);
          draw();
        } else stand();
        return true;
      };
      redraw = draw;
      if (!p.round) keepRound((p.round = C.diceStart(p.bet, random)));
      draw();
    } else {
      // How many of the parent's throws are on the table (null: all of them).
      let shown = null;
      const draw = () => {
        const r = p.round,
          seen = Math.min(shown ?? r.parent.rolls.length, r.parent.rolls.length),
          parentDone = seen >= r.parent.rolls.length;
        table.replaceChildren();
        const parent = { rolls: r.parent.rolls.slice(0, seen), hand: parentDone ? r.parent.hand : null };
        for (const [who, turn] of [["親", parent], ["あなた", r.child]]) {
          const row = node("div", "sg-hand"),
            list = node("div", "sg-dice");
          const last = turn.rolls[turn.rolls.length - 1];
          (last || []).forEach((v) => list.append(die(v)));
          row.append(node("span", "", who + "　" + (turn.hand ? turn.hand.name : turn.rolls.length ? "役なし" : "") + (turn.rolls.length ? "（" + turn.rolls.length + "投目）" : "")), list);
          table.append(row);
        }
        actions.replaceChildren();
        if (!parentDone) {
          line.textContent = "親が振っています…（親もあなたも3回まで）";
          return;
        }
        const early = C.chinParentDecides(r.parent.hand);
        if (early === null && !r.child.done) {
          line.textContent = "あと" + (C.CHILD_THROWS - r.child.rolls.length) + "回振れます";
          button("サイコロを振る", () => {
            p.round = { ...r, child: C.chinNext(r.child, random, C.CHILD_THROWS) };
            keepRound(p.round);
            draw();
          }, "roll");
        } else {
          const m = early !== null ? early : C.chinSettle(r.parent.hand, r.child.hand);
          line.textContent = (early !== null ? "親が「" + r.parent.hand.name + "」　" : "") + (m > 0 ? "勝ち" + (m > 1 ? "（" + m + "倍）" : "") : "負け");
          end(m);
        }
      };
      step = () => {
        const r = p.round;
        // おまかせ waits while the parent's throws are still landing.
        if (shown !== null && shown < r.parent.rolls.length) return true;
        if (C.chinParentDecides(r.parent.hand) !== null || r.child.done) return false;
        p.round = { ...r, child: C.chinNext(r.child, random, C.CHILD_THROWS) };
        keepRound(p.round);
        draw();
        return true;
      };
      redraw = draw;
      if (!p.round) {
        keepRound((p.round = { parent: C.chinTurn(random), child: C.chinStart() }));
        shown = 0;
        reveal(p.round.parent.rolls.length, (i) => {
          shown = i;
          draw();
        });
      }
      draw();
    }
    if (!ended) box.append(autoBtn);
    if (view.quick) play();
  }
  function die(value) {
    const el = node("span", "cs-die");
    el.dataset.value = value;
    for (let i = 1; i <= 9; i++) el.append(node("i", PIPS[value].includes(i) ? "is-on" : ""));
    return el;
  }
  // The end of an event game, a moment after its result shows. If the shared card cannot be
  // written, the game stays (its round is saved) and a button sends it again. Only one settle
  // runs at a time, so a won game cannot be paid twice.
  async function finish(m) {
    if (!view || view.finishing || !view.state?.pending) return;
    const state = view.state,
      me = api.uid(),
      tape = [],
      local = S.settle(state, view.card, m, recorder(tape), me);
    const retry = view.layer.querySelector('[data-sg-game="retry"]');
    view.finishing = true;
    retry?.remove();
    let result;
    try {
      // A loss or a push draws no ball: no cloud round trip, as for a roll.
      if (view.online && !local.events.some((e) => e.t === "ball") && !(view.card.owed?.[me] > 0))
        result = { out: local, collected: 0, people: view.people, log: view.log, before: { card: view.card, people: view.people, log: view.log } };
      else result = await onCard((card) => S.settle(state, card, m, replay(tape), me));
    } catch (error) {
      console.warn("[sugoroku] settle", error);
      const line = view.layer.querySelector(".sg-game-line"),
        actions = view.layer.querySelector(".sg-game-actions");
      if (line) line.textContent = "通信できませんでした。もう一度送ってください";
      view.finishing = false;
      if (actions) {
        const again = node("button", "sg-game-btn", "もう一度送る");
        again.type = "button";
        again.dataset.sgGame = "retry";
        again.onclick = () => finish(m);
        actions.replaceChildren(again);
      }
      return;
    }
    // The pending game is gone from here on, so a late tap finds nothing to settle.
    view.state = result.out.state;
    view.finishing = false;
    view.layer.hidden = true;
    const { out, before, people, collected } = result;
    out.collected = collected;
    save(out.state);
    pay(out, 0);
    await payJackpots(out);
    if (collected) out.events.unshift({ t: "share", amount: collected });
    view.busy = false;
    await run(out, { ...state, pending: null }, before, people, result.log);
    if (view?.state.bonus?.length) await bonus();
  }

  // ---- Mini games after a line ------------------------------------------------------------
  // Each waits in state.bonus. Starting one is saved first, so leaving half way and coming
  // back scores it 0 instead of trying again.
  const RULE_TEXT = {
    timer: "スタートから心の中で10秒数えて、ちょうど10秒でストップ。3秒で表示が消えます。1,000点から0.01秒ずれるごとに5点減ります。",
    tap: "10秒間、ボタンをできるだけたくさん押してください。1回10点（120回まで）。",
    tapex: "10秒間、ボタンをできるだけたくさん押してください。1回25点（120回まで）。",
    dice: "サイコロを1回振って、出た目×100点。",
    math: "15秒以内に計算の答えを入れてください。正解で500点。",
    stop: "左右に動く光を、まん中の金色で止めると額の2倍、銀色なら0.75倍。外れると0。5秒たつと外れです。",
    hilo: "めくったカード（A〜K）より次のカードが大きいか小さいかを当てます。当たりで額の1.25倍、同じ数なら1倍、外れると0。",
  };
  async function bonus() {
    while (view?.state.bonus?.length) {
      const item = view.state.bonus[0];
      let done = null;
      // 早送り: a normal square's quick game is not played; it pays its fixed part.
      if (view.quick && QUICK_GAMES.has(item.game) && !item.started) done = "auto";
      else if (item.started) {
        await miniShell(item, (box, finish) => {
          box.append(node("p", "sg-game-line", "途中でやめたので0点です。"));
          finish(null);
        });
      } else done = await miniShell(item, (box, finish) => miniGame(item, box, finish));
      const out = S.settleBonus(view.state, done);
      view.state = out.state;
      save(out.state);
      pay(out, 0);
      hud();
      if (out.gain) say(MINI[item.game] + "　+" + fmt(out.gain) + api.unit(), "is-gain");
      api.refresh();
    }
  }
  // The frame every mini game is played in; resolves with what was done.
  function miniShell(item, build) {
    return new Promise((resolve) => {
      const layer = view.layer;
      layer.className = "sg-layer is-game is-mini";
      layer.hidden = false;
      view.busy = true;
      hud();
      const box = node("div", "sg-game sg-mini");
      box.append(node("p", "sg-wheel-title", MINI[item.game] + (item.mult > 1 ? "　×" + item.mult : "")), node("p", "sg-game-rule", RULE_TEXT[item.game]));
      layer.replaceChildren(box);
      // The score shows for a moment, then the board goes on by itself.
      let over = false;
      build(box, (done) => {
        if (over) return;
        over = true;
        box.classList.add("is-over");
        setTimeout(() => {
          layer.hidden = true;
          if (view) view.busy = false;
          resolve(done);
        }, view.quick ? 600 : calm() ? 300 : 1600);
      });
    });
  }
  function started(item) {
    view.state = { ...view.state, bonus: [{ ...item, started: true }, ...view.state.bonus.slice(1)] };
    save(view.state);
  }
  function miniGame(item, box, finish) {
    const show = node("p", "sg-mini-big", ""),
      line = node("p", "sg-game-line", ""),
      go = node("button", "sg-game-btn", "スタート");
    go.type = "button";
    go.dataset.sgGame = "start";
    box.append(show, line, go);
    const score = (done) => S.gameScore(item.game, done, item.bet || 100) * item.mult;
    const end = (done, text) => {
      go.remove();
      // A normal square's quick game pays in chips or points; the bigger games score points.
      line.textContent = text + "　→　" + fmt(score(done)) + (QUICK_GAMES.has(item.game) ? api.unit() : "点");
      finish(done);
    };
    if (item.game === "timer") {
      show.textContent = "0.00";
      let t0 = 0,
        tick = 0;
      // Only real presses (not a script's) start and stop it.
      go.onclick = (e) => {
        if (!e.isTrusted) return;
        if (!t0) {
          started(item);
          t0 = performance.now();
          go.textContent = "ストップ";
          go.dataset.sgGame = "stop";
          tick = setInterval(() => {
            const t = (performance.now() - t0) / 1000;
            show.textContent = t < 3 ? t.toFixed(2) : "?.??";
          }, 30);
          return;
        }
        clearInterval(tick);
        const t = (performance.now() - t0) / 1000;
        show.textContent = t.toFixed(2);
        end(t, "ずれ " + Math.abs(t - 10).toFixed(2) + "秒");
      };
    } else if (item.game === "tap" || item.game === "tapex") {
      show.textContent = "0";
      go.onclick = async () => {
        started(item);
        go.disabled = true;
        for (const n of ["3", "2", "1"]) {
          line.textContent = n;
          await new Promise((r) => setTimeout(r, calm() ? 10 : 600));
        }
        // Only real presses count (not ones made by a script), up to the cap.
        let taps = 0;
        const most = S.RULES.games[item.game].max;
        const tap = (e) => {
          if (!e.isTrusted || taps >= most) return;
          taps++;
          show.textContent = String(taps);
        };
        const pad = node("button", "sg-tap", "タップ！");
        pad.type = "button";
        pad.dataset.sgGame = "tap";
        pad.onpointerdown = (e) => {
          e.preventDefault();
          tap(e);
        };
        pad.onclick = (e) => e.detail === 0 && tap(e);
        go.replaceWith(pad);
        const seconds = S.RULES.games[item.game].seconds,
          t0 = performance.now();
        await new Promise((r) => {
          const tick = setInterval(() => {
            const left = seconds - (performance.now() - t0) / 1000;
            line.textContent = "のこり " + Math.max(0, left).toFixed(1) + "秒";
            if (left <= 0) clearInterval(tick), r();
          }, 50);
        });
        pad.remove();
        end(taps, taps + "回");
      };
    } else if (item.game === "stop") {
      // A light runs left and right (once across in 0.7 s); stopped within 5% of the middle is
      // perfect, within 20% good. Where it is comes from the clock, not from the screen.
      const bar = node("div", "sg-stopbar"),
        light = node("i", "sg-stoplight");
      bar.append(node("b", "is-good"), node("b", "is-perfect"), light);
      show.replaceWith(bar);
      let t0 = 0,
        frame = 0,
        timer = 0;
      const at = () => {
        const phase = ((performance.now() - t0) / 1400) % 1;
        return phase < 0.5 ? phase * 2 : 2 - phase * 2;
      };
      const stop = (p) => {
        cancelAnimationFrame(frame);
        clearTimeout(timer);
        light.style.left = p * 100 + "%";
        const off = Math.abs(p - 0.5),
          zone = p < 0 ? "miss" : off <= 0.05 ? "perfect" : off <= 0.2 ? "good" : "miss";
        bar.dataset.zone = zone;
        end(zone, { perfect: "ぴったり！", good: "おしい", miss: p < 0 ? "時間切れ" : "はずれ" }[zone]);
      };
      go.onclick = (e) => {
        if (!e.isTrusted) return;
        if (!t0) {
          started(item);
          t0 = performance.now();
          go.textContent = "ストップ";
          go.dataset.sgGame = "stop";
          const tick = () => {
            light.style.left = at() * 100 + "%";
            frame = requestAnimationFrame(tick);
          };
          tick();
          timer = setTimeout(() => stop(-1), S.RULES.games.stop.seconds * 1000);
          return;
        }
        stop(at());
      };
    } else if (item.game === "hilo") {
      const face = (n) => ({ 1: "A", 11: "J", 12: "Q", 13: "K" })[n] || String(n);
      const cards = node("div", "sg-hilo");
      const first = node("span", "sg-hilo-card", "?"),
        next = node("span", "sg-hilo-card is-next", "?");
      cards.append(first, next);
      show.replaceWith(cards);
      go.textContent = "カードをめくる";
      go.dataset.sgGame = "flip";
      let n = 0;
      const guess = (high) => (e) => {
        if (!e.isTrusted || !n) return;
        const m = random(13) + 1;
        next.textContent = face(m);
        next.classList.add("is-open");
        hi.remove();
        lo.remove();
        const outcome = m === n ? "tie" : m > n === high ? "win" : "lose";
        end(outcome, { win: "当たり", tie: "同じ数", lose: "はずれ" }[outcome]);
      };
      const hi = node("button", "sg-game-btn", "HIGH ↑"),
        lo = node("button", "sg-game-btn", "LOW ↓");
      for (const [b, high, data] of [[hi, true, "high"], [lo, false, "low"]]) {
        b.type = "button";
        b.dataset.sgGame = data;
        b.onclick = guess(high);
      }
      go.onclick = (e) => {
        if (!e.isTrusted || n) return;
        started(item);
        n = random(13) + 1;
        first.textContent = face(n);
        first.classList.add("is-open");
        go.replaceWith(hi, lo);
      };
    } else if (item.game === "dice") {
      const cubeBox = cube();
      show.replaceWith(cubeBox.box);
      cubeBox.box.classList.add("sg-mini-die");
      go.textContent = "サイコロを振る";
      go.dataset.sgGame = "roll";
      go.onclick = async () => {
        started(item);
        go.disabled = true;
        const face = random(6) + 1;
        await cubeBox.roll(face);
        end(face, face + "の目");
      };
    } else {
      const q = S.sum(random);
      let typed = "",
        over = false;
      show.textContent = "？";
      const keys = node("div", "sg-keys");
      const answer = node("p", "sg-mini-answer", "");
      const submit = () => {
        if (over) return;
        over = true;
        keys.remove();
        const right = typed !== "" && typed !== "−" && Number(typed.replace("−", "-")) === q.answer;
        end(right, (right ? "正解" : "ざんねん") + "（答え " + q.answer + "）");
      };
      go.onclick = () => {
        started(item);
        go.remove();
        show.textContent = q.text + " =";
        box.insertBefore(answer, line);
        box.insertBefore(keys, line);
        for (const k of ["7", "8", "9", "4", "5", "6", "1", "2", "3", "−", "0", "⌫"]) {
          const b = node("button", "sg-key", k);
          b.type = "button";
          b.dataset.key = k;
          b.onclick = (e) => {
            if (!e.isTrusted) return;
            if (k === "⌫") typed = typed.slice(0, -1);
            else if (k === "−") typed = typed.startsWith("−") ? typed.slice(1) : "−" + typed;
            else if (typed.replace("−", "").length < 5) typed += k;
            answer.textContent = typed;
          };
          keys.append(b);
        }
        const ok = node("button", "sg-game-btn", "こたえる");
        ok.type = "button";
        ok.dataset.sgGame = "answer";
        ok.onclick = (e) => e.isTrusted && submit();
        keys.append(ok);
        const t0 = performance.now(),
          seconds = S.RULES.games.math.seconds;
        const tick = setInterval(() => {
          const left = seconds - (performance.now() - t0) / 1000;
          if (over) return clearInterval(tick);
          line.textContent = "のこり " + Math.max(0, left).toFixed(1) + "秒";
          if (left <= 0) clearInterval(tick), submit();
        }, 100);
      };
    }
  }

  // Lifetime totals for the カジノ ranking, from this device's save of real play (never the practice
  // save): bet, won less bet, rolls, line count, JP, SJP and balls drawn. null with no save.
  function stats(id) {
    try {
      const state = JSON.parse(localStorage.getItem("aiglish_sugoroku_" + id) || "null");
      if (!S.valid(state)) return null;
      const n = (v) => (Number.isSafeInteger(v) && v > 0 ? v : 0);
      return { b: n(state.bet), n: Math.round((Number(state.won) || 0) - n(state.bet)), p: n(state.rolls), g: n(state.bingos), j: n(state.jps), s: n(state.sjps), l: n(state.balls) };
    } catch {
      return null;
    }
  }
  window.Sugoroku = Object.freeze({ play, waiting, stats });
})();
