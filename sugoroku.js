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
  const random = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const SQUARE = { start: "START", normal: "", event: "★", accident: "!" };
  const GAME_NAMES = { blackjack: "ブラックジャック", dice: "ダイスポーカー", chinchiro: "チンチロ", ball: "ボール確定" };
  const WHEEL_NAMES = { event: "EVENT", accident: "ACCIDENT", bingo: "BINGO", sjp: "SUPER JACKPOT CHANCE" };
  const HOT = new Set(["bingo", "sjp"]);
  const MINI = { timer: "10秒ぴったり", tap: "連打", tapex: "連打EX", dice: "サイコロ", math: "暗算" };
  const LOG_NAMES = { bingo: "BINGO", jp: "JACKPOT", sjp: "SUPER JACKPOT" };
  const RULES_TEXT = [
    "ログインしてクラウドにつながっているときはポイントを賭けます。ゲストやオフラインのときは練習チップで、ジャックポットは演出だけです。",
    "1回100（ポイントまたは練習チップ）でサイコロを振ります（額はみんな同じです）。",
    "通常マス：ルーレットで ×3〜×0 のどれかが額に掛かって戻ります。「●（ボール）」ならボールが出ます。",
    "★（EVENT）：ブラックジャック・ダイスポーカー・チンチロ・ボール確定のどれか。ゲームに勝つと配当とボール、引き分けは額が戻り、負けると半分が戻ります。ボール確定はボールと額の1.5倍です。",
    "！（アクシデント）：額の0〜2倍が引かれるか、3マス戻るか、STARTに戻ります。",
    "STARTを通るとボールが1つ出ます。",
    "ビンゴカードはみんなで共通です。ボールは1〜100から抽選で、カードにあってまだ誰のボールもない番号ならそこに自分のボール（アイコン）が入ります。カードにない番号や、もうボールのある番号なら額の1.5倍がもらえます。1列そろえるとビンゴ賞金（300）と、ビンゴルーレット（掛け金×5・×10・×20、10秒ぴったり、連打、サイコロ、暗算、JACKPOT×2、SUPER JACKPOT CHANCE）。SUPER JACKPOT CHANCEはSUPER JACKPOT×2・JACKPOT・連打EX・もう一回の5つ。自分のボールだけでそろえると賞金とミニゲームが1.5倍、2列・3列を同時にそろえると3倍・4倍です。そろった列は新しい番号になり、ボールも消えます。",
    "ビンゴ賞金は、その列にボールを置いていた人でボールの数に応じて山分けします。ほかの人の分は、その人が次にすごろくビンゴを開いたときに届きます。ルーレットとミニゲームはそろえた人のものです。",
    "連打は120回まで数えます。",
    "ジャックポットは、カジノでハウス（ディーラー）相手に賭けられたポイントから貯まります（JACKPOT 1,000 + 3%で上限10,000、SUPER JACKPOT 5,000 + 2%で上限100,000。JACKPOTが上限を超えた分はSUPER JACKPOTに回ります）。",
    "「早送り」にすると、ふだんのマスは短く、ビンゴやジャックポットはいつもどおり見られます。★マスのゲームも自動（おまかせ）で進みます。盤面をタップするとその回を最後まで飛ばせます。",
    "★マスのゲームは「おまかせ」を押すと、決まったやり方（ブラックジャックは17未満なら引く など）で自動で進みます。",
    "ほかの人のビンゴの分け前は、30日受け取りに来ないと消えます。届いている分はカジノのタブにも出ます。",
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
  // is written at once when a game, a mini game or a jackpot starts or ends (so none can be
  // played twice from two devices), and otherwise at most every 30 seconds and when the page is
  // hidden, to keep cloud writes few.
  const cloud = { key: null, at: 0, timer: 0, state: null };
  const gate = (state) => JSON.stringify([state.pending || null, state.bonus || [], state.jpWait || []]);
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
  async function load() {
    let state = readLocal();
    if (api.real()) {
      try {
        const snap = await window.fbGetDoc(cloudRef());
        const remote = snap.exists() ? JSON.parse(snap.data().state || "null") : null;
        if (S.valid(remote) && (!state || remote.rolls > state.rolls)) state = remote;
        if (S.valid(remote)) cloud.key = gate(remote);
      } catch (error) {
        console.warn("[sugoroku] load", error);
      }
    }
    return state ? S.upgrade(state) : S.newState();
  }

  // ---- The shared card ---------------------------------------------------------------------
  // One card for everybody in shared/sugoroku_live (the preview's shared/sugoroku_card, with its
  // practice-chip parts, is left behind): { cells, owners, owed, owedAt, people, log }, people[id] the
  // name and a small icon for each id whose ball is on it. Every roll reads it and, if a ball
  // landed, writes it back in one transaction, so two players never take the same cell. A
  // guest, or a device off the cloud, plays on a card of its own.
  const shared = () => api.uid() !== "GUEST-000" && !!(window.db && window.fbDoc && window.fbRunTransaction) && !window.FirestoreReadGuard?.paused?.();
  const CARD_DOC = "sugoroku_live";
  const cardRef = () => window.fbDoc(window.db, "shared", CARD_DOC);
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
    const card = data && { cells: data.cells, owners: data.owners, ...(data.owed ? { owed: data.owed } : {}), ...(data.owedAt ? { owedAt: data.owedAt } : {}) };
    return S.validCard(card) ? { card, people: cleanPeople(data.people), log: cleanLog(data.log) } : null;
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
      } catch (error) {
        console.warn("[sugoroku] card", error);
      }
    return cachedCard() || { card: S.newCard(random), people: {}, log: [] };
  }
  // This player's name and icon (shrunk to 40px) to show on their balls.
  let me = null;
  async function person() {
    if (me && me.id === api.uid()) return me.value;
    const id = api.uid(),
      name = (typeof myName === "string" && myName) || (id === "GUEST-000" ? "ゲスト" : id);
    let icon = "";
    try {
      const avatar = localStorage.getItem("core_v4_user_avatar_" + id) || "";
      if (/^data:image\//.test(avatar) || /^https?:/.test(avatar)) icon = await shrink(avatar, 40);
    } catch {}
    me = { id, value: { n: String(name).slice(0, 24), i: icon } };
    return me.value;
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
          const now = (snap.exists() && readCard(snap.data())) || { card: S.newCard(random), people: {}, log: [] };
          const done = apply(now);
          if (!snap.exists() || done.collected || JSON.stringify(done.out.card) !== JSON.stringify(now.card) || done.log !== now.log)
            tx.set(cardRef(), { cells: done.out.card.cells, owners: done.out.card.owners, owed: done.out.card.owed || {}, owedAt: done.out.card.owedAt || {}, people: done.people, log: done.log, updatedAt: Date.now() });
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
        const snap = await window.fbGetDoc(cardRef()),
          found = snap.exists() ? readCard(snap.data()) : null;
        peek = { id, at: Date.now(), amount: found?.card.owed?.[id] || 0 };
      } catch (error) {
        console.warn("[sugoroku] waiting", error);
      }
    return peek.id === id ? peek.amount : 0;
  }
  // Other players' balls come in while the screen is open.
  function listen() {
    view.stop?.();
    view.stop = null;
    if (!shared() || typeof window.fbOnSnapshot !== "function") return;
    const target = view;
    try {
      view.stop = window.fbOnSnapshot(cardRef(), (snap) => {
        const found = snap.exists() && readCard(snap.data());
        if (!found || target !== view || !view.body.isConnected) return target.stop?.();
        if (view.busy) return;
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
      });
    } catch (error) {
      console.warn("[sugoroku] listen", error);
    }
  }

  // The newest log entry this screen has shown.
  const lastLog = () => (view?.log || []).reduce((t, e) => Math.max(t, e.at), view?.seen || 0);
  const seeLog = () => view && (view.seen = lastLog());
  const logText = (e) => (e.t === "bingo" ? (e.c === 2 ? "DOUBLE BINGO" : e.c === 3 ? "TRIPLE BINGO" : e.c > 3 ? e.c + " BINGO" : "BINGO") : LOG_NAMES[e.t]);

  // ---- Screen ----------------------------------------------------------------------------
  let view = null;
  const QUICK = "aiglish_sugoroku_quick";
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
    view?.unsub?.();
    view = null;
    body.replaceChildren(node("p", "cs-hint", "読み込み中…"));
    const [state, found, mine] = await Promise.all([load(), loadCard(), person()]);
    if (!body.isConnected) return;
    // This player's own balls always show their own name and icon.
    found.people = { ...found.people, [api.uid()]: mine };
    view = { body, state, card: found.card, people: found.people, log: found.log || [], seen: 0, online: shared(), cost: S.RULES.costs[0], busy: false, fast: false, hot: false, quick: quickSaved() };
    seeLog();
    draw();
    listen();
    if (state.jpWait?.length) {
      const left = { state };
      await payJackpots(left);
      if (view) view.state = left.state;
    }
    if (view?.state.bonus?.length) await bonus();
    if (view?.state.pending) game();
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
    const card = node("div", "sg-card");
    card.setAttribute("aria-label", "ビンゴカード");
    view.cells = view.card.cells.map((n, i) => {
      const cell = node("div", "sg-cell" + (i === S.FREE ? " is-free" : ""));
      cell.append(node("span", "", i === S.FREE ? "FREE" : String(n)));
      card.append(cell);
      return cell;
    });
    view.say = node("p", "sg-say");
    view.say.setAttribute("role", "status");
    view.cardWrap = cardWrap;
    cardWrap.append(card, view.say);

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

    view.info = node("p", "sg-status");

    const controls = node("div", "sg-controls");
    // One fixed bet for everybody.
    const costs = node("p", "sg-costs is-fixed");
    costs.append(node("span", "", "1回"), node("b", "", fmt(view.cost) + api.unit()));
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

    view.layer = node("div", "sg-layer");
    view.layer.hidden = true;
    body.replaceChildren(pots, cardWrap, board, view.info, controls, view.layer);
    paintCard();
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
  // Each cell: its number, or the ball of whoever opened it — their icon, or their initial on a
  // colour of their own — with this player's balls ringed in gold.
  function paintCard() {
    const id = api.uid();
    view.cells.forEach((cell, i) => {
      if (i === S.FREE) return;
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
  const hue = (id) => [...String(id || "")].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  function hud() {
    const { state } = view;
    const pots = window.CasinoJackpot?.amounts() || { jp: 0, sjp: 0 };
    for (const kind of ["jp", "sjp"]) view.body.querySelector('[data-pot="' + kind + '"] b').textContent = fmt(pots[kind]) + "pt";
    const reaches = S.reach(view.card),
      reach = new Set(reaches.flatMap((line) => S.LINES[line]));
    view.cells.forEach((cell, i) => cell.classList.toggle("is-reach", !view.card.owners[i] && reach.has(i)));
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
      refill = short && !api.real() && !!api.resetPractice;
    view.go.disabled = view.busy || (short && !refill) || !!state.pending;
    view.go.textContent = refill ? "練習チップを" + fmt(api.practiceStart) + "枚に戻す" : short ? (api.real() ? "ポイントが足りません" : "チップが足りません") : view.busy ? "…" : "サイコロを振る";
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
      async roll(value) {
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
    const cost = view.cost,
      state = view.state;
    view.busy = true;
    hud();
    let result;
    try {
      result = await onCard((card) => S.roll(state, card, cost, random, api.uid()));
    } catch (error) {
      console.warn("[sugoroku] roll", error);
      view.busy = false;
      hud();
      say("通信できませんでした。もう一度振ってください", "is-loss");
      return;
    }
    const { out, before, people, collected } = result;
    out.collected = collected;
    save(out.state);
    pay(out, cost);
    await payJackpots(out);
    if (collected) out.events.unshift({ t: "share", amount: collected });
    await run(out, { ...state, stake: state.stake + cost }, before, people, result.log);
    if (view?.state.bonus?.length) await bonus();
    if (view?.state.pending) game();
  }
  // Plays events over a copy of the state shown so far, then shows the real new state.
  // `before` is the card the change was made on (it may hold other players' new balls).
  async function run(out, shown, before, people, log) {
    const target = view;
    view.busy = true;
    view.fast = false;
    view.hot = false;
    view.body.classList.add("is-spinning");
    const live = { ...shown };
    view.state = live;
    view.card = { cells: [...before.card.cells], owners: [...before.card.owners] };
    // This player's own name and icon stay known even if a finished line just took their balls.
    view.people = { ...before.people, ...people, ...(me && me.id === api.uid() ? { [me.id]: me.value } : {}) };
    paintCard();
    hud();
    try {
      await show(out.events, live);
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
      } else if (e.t === "die") {
        say("");
        await view.die.roll(e.value);
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
        // The finished lines start again: their balls leave and fresh numbers come in.
        for (const [c, n] of Object.entries(e.numbers)) {
          view.card.cells[c] = n;
          view.card.owners[c] = "";
          view.cells[c].classList.add("is-new");
          setTimeout(() => view?.cells[c]?.classList.remove("is-new"), 1200);
        }
        paintCard();
        hud();
        say("そろった列は新しい番号に", "is-ball");
        await wait(900);
      } else if (e.t === "prize") {
        say("ビンゴ賞金　+" + fmt(e.amount) + api.unit(), "is-gain");
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
  // number, otherwise it greys out and pays 1.5× ------------------------------------------------
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
    say(onReach ? "リーチの番号！" : "", onReach ? "is-hot" : "");
    ball.classList.add("is-in");
    await wait(onReach ? 1600 : 1100);
    if (e.miss) {
      ball.classList.add("is-miss");
      say("ハズレ " + e.number + "　×1.5 +" + fmt(e.amount) + api.unit(), "is-gain");
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
    if (slot.ball) return "ball";
    if (slot.next || slot.jackpot) return "jackpot";
    if (wheel !== "normal") return slot.game ? "game-mini" : slot.miss ? "zero" : slot.back ? "bad" : slot.x >= 20 ? "gold" : slot.x >= 10 ? "champagne" : "high";
    return slot.x >= 3 ? "gold" : slot.x >= 2 ? "champagne" : slot.x >= 1.25 ? "high" : slot.x >= 0.5 ? "mid" : slot.x > 0 ? "low" : "zero";
  }
  function slotLabel(wheel, slot) {
    if (wheel === "event") return slot === "ball" ? "BALL" : { blackjack: "BJ", dice: "DICE", chinchiro: "チンチロ" }[slot];
    if (wheel === "accident") return slot.start ? "START" : slot.back ? "−" + slot.back + "マス" : slot.take ? "−×" + slot.take : "SAFE";
    if (slot.ball) return "●";
    if (slot.next) return "SJP";
    if (slot.jackpot) return slot.jackpot === "jp" ? "JACKPOT" : "SUPER";
    if (slot.game) return { timer: "10秒", tap: "連打", tapex: "連打EX", dice: "サイコロ", math: "暗算" }[slot.game];
    if (slot.miss) return "ハズレ";
    if (slot.back) return "もう一回";
    return "×" + slot.x;
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
      const text = el("text", { transform: "translate(" + tx + " " + ty + ") rotate(" + mid + ")", class: "sg-seg-text is-" + tone(e.wheel, slot) + (label.length > 4 ? " is-long" : "") + (n > 12 ? " is-many" : "") });
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
      turns = { normal: 4, event: 4, accident: 4, bingo: 5, jp: 6, sjp: 7 }[e.wheel],
      jitter = (random(60) - 30) / 100,
      angle = turns * 360 - ((e.index + 0.5 + jitter * 0.8) * 360) / n;
    const full = { normal: 1700, event: 2000, accident: 2000, bingo: 3000, jp: 3800, sjp: 4600 }[e.wheel],
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
          : slot.next
            ? "SUPER JACKPOT CHANCE"
            : slot.jackpot
              ? slot.jackpot === "jp" ? "JACKPOT" : "SUPER JACKPOT"
              : slot.game
                ? MINI[slot.game] + " チャレンジ"
                : slot.miss
                  ? "ハズレ（ビンゴ賞金のみ）"
                  : slot.back
                    ? "もう一回！"
                    : "×" + slot.x + "　+" + fmt(e.amount) + api.unit() + (slot.ball ? "　BALL" : "");
    box.classList.add("is-done");
    if (slot.next || slot.jackpot) layer.classList.add("is-hotter");
    await wait(hot || slot.x >= 2 || slot.ball ? 1300 : 750);
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
    box.append(node("p", "sg-wheel-title", GAME_NAMES[p.game] + "　" + fmt(p.bet) + api.unit()), node("p", "sg-game-rule", "勝てばボール。負けても半分戻ります。"));
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
      // While おまかせ plays, only つづける is pressed (by itself).
      if (auto && data !== "next") b.disabled = true;
      actions.append(b);
      return b;
    };
    const end = (m) => {
      actions.replaceChildren();
      autoBtn.remove();
      const next = button("つづける", () => finish(m), "next");
      if (auto) setTimeout(() => next.isConnected && !next.disabled && next.click(), 900 * (pace() || 0.02));
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
        if (r.dealer) {
          const dealer = node("div", "sg-hand"),
            row = node("div", "sg-dice");
          r.dealer.forEach((v) => row.append(die(v)));
          dealer.append(node("span", "", "ディーラー　" + name(r.dealer)), row);
          table.prepend(dealer);
        }
        actions.replaceChildren();
        if (!r.done) {
          line.textContent = "残すダイスをタップ（振り直しはあと" + (3 - r.rolls) + "回）";
          const again = button("振り直す", () => {
            p.round = C.diceReroll(r, random);
            keepRound(p.round);
            draw();
          }, "reroll");
          again.disabled = r.rolls >= 3 || r.held.every(Boolean);
          button("これで勝負", () => {
            p.round = C.diceStand(r, random);
            keepRound(p.round);
            draw();
          }, "stand");
        } else {
          line.textContent = r.outcome === "win" ? "勝ち" : r.outcome === "push" ? "引き分け" : "負け";
          end(r.net / p.bet);
        }
      };
      step = () => {
        const r = p.round;
        if (r.done) return false;
        const keep = C.dealerKeeps(r.dice);
        if (r.rolls < 3 && !keep.every(Boolean)) {
          let next = r;
          keep.forEach((k, i) => next.held[i] !== k && (next = C.diceToggle(next, i)));
          p.round = C.diceReroll(next, random);
        } else p.round = C.diceStand(r, random);
        keepRound(p.round);
        draw();
        return true;
      };
      redraw = draw;
      if (!p.round) keepRound((p.round = C.diceStart(p.bet, random)));
      draw();
    } else {
      const draw = () => {
        const r = p.round;
        table.replaceChildren();
        for (const [who, turn] of [["親", r.parent], ["あなた", r.child]]) {
          const row = node("div", "sg-hand"),
            list = node("div", "sg-dice");
          const last = turn.rolls[turn.rolls.length - 1];
          (last || []).forEach((v) => list.append(die(v)));
          row.append(node("span", "", who + "　" + (turn.hand ? turn.hand.name : turn.rolls.length ? "役なし" : "")), list);
          table.append(row);
        }
        actions.replaceChildren();
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
        if (C.chinParentDecides(r.parent.hand) !== null || r.child.done) return false;
        p.round = { ...r, child: C.chinNext(r.child, random, C.CHILD_THROWS) };
        keepRound(p.round);
        draw();
        return true;
      };
      redraw = draw;
      if (!p.round) keepRound((p.round = { parent: C.chinTurn(random), child: C.chinStart() }));
      draw();
    }
    if (autoBtn.isConnected || !actions.querySelector('[data-sg-game="next"]')) box.append(autoBtn);
    if (view.quick) play();
  }
  function die(value) {
    const el = node("span", "cs-die");
    el.dataset.value = value;
    for (let i = 1; i <= 9; i++) el.append(node("i", PIPS[value].includes(i) ? "is-on" : ""));
    return el;
  }
  // The end of an event game. If the shared card cannot be written, the game stays (its round
  // is saved) and つづける can be pressed again.
  async function finish(m) {
    const state = view.state;
    let result;
    try {
      result = await onCard((card) => S.settle(state, card, m, random, api.uid()));
    } catch (error) {
      console.warn("[sugoroku] settle", error);
      const line = view.layer.querySelector(".sg-game-line");
      if (line) line.textContent = "通信できませんでした。もう一度「つづける」を押してください";
      return;
    }
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
    tapex: "10秒間、ボタンをできるだけたくさん押してください。1回50点（120回まで）。",
    dice: "サイコロを1回振って、出た目×100点。",
    math: "15秒以内に計算の答えを入れてください。正解で500点。",
  };
  async function bonus() {
    while (view?.state.bonus?.length) {
      const item = view.state.bonus[0];
      let done = null;
      if (item.started) {
        await miniShell(item, (box, finish) => {
          box.append(node("p", "sg-game-line", "途中でやめたので0点です。"));
          finish(null, "つづける");
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
      build(box, (done, label = "つづける") => {
        const next = node("button", "sg-game-btn", label);
        next.type = "button";
        next.dataset.sgGame = "next";
        next.onclick = () => {
          layer.hidden = true;
          view.busy = false;
          resolve(done);
        };
        box.append(next);
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
    const score = (done) => S.gameScore(item.game, done) * item.mult;
    const end = (done, text) => {
      go.remove();
      line.textContent = text + "　→　" + fmt(score(done)) + "点";
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

  window.Sugoroku = Object.freeze({ play, waiting });
})();
