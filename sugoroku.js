// すごろくビンゴ: the screen for SugorokuModel inside the casino.
//
// One screen, no scrolling: the jackpots, the card, the die beside a strip of the track with
// the piece on it, and the bet and roll button. The wheels and the event games come up over it.
// It is a dark green felt with brass and ivory; the wheels carry the colour (gold for the big
// multiples, wine for nothing) and only BINGO and the jackpot wheels dim the room.
//
// A roll is worked out and saved before anything moves, and its chips are paid at once, so
// closing half way changes nothing. An event game is saved move by move in state.pending.
// For now the game is a preview: practice chips only, and a jackpot is shown but not paid.
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
  const WHEEL_NAMES = { event: "EVENT", accident: "ACCIDENT", bingo: "BINGO", jp: "JACKPOT CHANCE", sjp: "SUPER JACKPOT CHANCE" };
  const HOT = new Set(["bingo", "jp", "sjp"]);
  const RULES_TEXT = [
    "プレ版のため練習チップで遊びます。ポイントは動かず、ジャックポットも演出だけです。",
    "1回に使う額（10・50・100）を選んでサイコロを振ります。出る目は同じですが、額が大きいほど通常マスのルーレットに「ボール」が多く入ります。",
    "通常マス：ルーレットで ×3〜×0 のどれかが額に掛かって戻ります。「●（ボール）」ならボールが出ます。",
    "★（EVENT）：ブラックジャック・ダイスポーカー・チンチロ・ボール確定のどれか。ゲームに勝つと配当とボール、引き分けは額が戻り、負けると半分が戻ります。ボール確定はボールと額の1.5倍です。",
    "！（アクシデント）：額の0〜2倍が引かれるか、3マス戻るか、STARTに戻ります。",
    "STARTを通るとボールが1つ出ます。",
    "ビンゴカードはみんなで共通です。ボールは1〜100から抽選で、カードにあってまだ誰のボールもない番号ならそこに自分のボール（アイコン）が入ります。カードにない番号や、もうボールのある番号なら額の1.5倍がもらえます。1列そろえた人は、自分が前のビンゴから使った額をもとにルーレットを回し、JP CHANCEからジャックポットを狙えます。自分のボールだけでそろえると報酬が1.5倍、2列・3列を同時にそろえると3倍・4倍です。そろった列は新しい番号になり、ボールも消えます。",
    "ジャックポットはカジノ全体で賭けられたポイントから貯まります。",
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
  function save(state) {
    try {
      localStorage.setItem(saveName(), JSON.stringify(state));
    } catch {}
    if (api.real()) Promise.resolve(window.fbSetDoc(cloudRef(), { state: JSON.stringify(state), rolls: state.rolls, savedAt: Date.now() })).catch((error) => console.warn("[sugoroku] save", error));
  }
  async function load() {
    let state = readLocal();
    if (api.real()) {
      try {
        const snap = await window.fbGetDoc(cloudRef());
        const remote = snap.exists() ? JSON.parse(snap.data().state || "null") : null;
        if (S.valid(remote) && (!state || remote.rolls > state.rolls)) state = remote;
      } catch (error) {
        console.warn("[sugoroku] load", error);
      }
    }
    return state ? S.upgrade(state) : S.newState();
  }

  // ---- The shared card ---------------------------------------------------------------------
  // One card for everybody in shared/sugoroku_card: { cells, owners, people }, people[id] the
  // name and a small icon for each id whose ball is on it. Every roll reads it and, if a ball
  // landed, writes it back in one transaction, so two players never take the same cell. A
  // guest, or a device off the cloud, plays on a card of its own.
  const shared = () => api.uid() !== "GUEST-000" && !!(window.db && window.fbDoc && window.fbRunTransaction) && !window.FirestoreReadGuard?.paused?.();
  const cardRef = () => window.fbDoc(window.db, "shared", "sugoroku_card");
  const localCardName = () => "aiglish_sugoroku_card_" + (shared() ? "shared" : api.uid());
  function readCard(data) {
    const card = data && { cells: data.cells, owners: data.owners };
    return S.validCard(card) ? { card, people: data.people && typeof data.people === "object" ? data.people : {} } : null;
  }
  function keepCard(card, people) {
    try {
      localStorage.setItem(localCardName(), JSON.stringify({ ...card, people }));
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
    return cachedCard() || { card: S.newCard(random), people: {} };
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
  // returns, with this player in people and only people who still have a ball on it.
  async function onCard(change) {
    const mine = await person(),
      id = api.uid();
    const keep = (card, people) => {
      const ids = new Set(card.owners);
      const next = Object.fromEntries(Object.entries(people).filter(([k]) => ids.has(k)));
      if (ids.has(id)) next[id] = mine;
      return next;
    };
    if (shared())
      try {
        const result = await window.fbRunTransaction(window.db, async (tx) => {
          const snap = await tx.get(cardRef());
          const now = (snap.exists() && readCard(snap.data())) || { card: S.newCard(random), people: {} };
          const out = change(now.card);
          const people = keep(out.card, now.people);
          if (!snap.exists() || JSON.stringify(out.card) !== JSON.stringify(now.card)) tx.set(cardRef(), { cells: out.card.cells, owners: out.card.owners, people, updatedAt: Date.now() });
          return { out, before: now, people };
        });
        keepCard(result.out.card, result.people);
        return result;
      } catch (error) {
        console.warn("[sugoroku] shared card", error);
      }
    const now = cachedCard() || { card: view.card, people: view.people };
    const out = change(now.card),
      people = keep(out.card, now.people);
    keepCard(out.card, people);
    return { out, before: now, people };
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
        view.card = found.card;
        view.people = found.people;
        keepCard(found.card, found.people);
        paintCard();
        hud();
      });
    } catch (error) {
      console.warn("[sugoroku] listen", error);
    }
  }

  // ---- Screen ----------------------------------------------------------------------------
  let view = null;
  async function play(body, wallet) {
    api = wallet;
    body.replaceChildren(node("p", "cs-hint", "読み込み中…"));
    const [state, found] = await Promise.all([load(), loadCard()]);
    if (!body.isConnected) return;
    let cost = 10;
    try {
      cost = Number(localStorage.getItem("aiglish_sugoroku_cost")) || 10;
    } catch {}
    view = { body, state, card: found.card, people: found.people, cost: S.RULES.costs.includes(cost) ? cost : 10, busy: false, fast: false };
    draw();
    listen();
    if (state.pending) game();
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
    pots.append(pot("jp", "JACKPOT"), pot("sjp", "SUPER JACKPOT"), help);
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
    const costs = node("div", "sg-costs");
    costs.setAttribute("role", "radiogroup");
    costs.setAttribute("aria-label", "1回に使う額");
    for (const c of S.RULES.costs) {
      const b = node("button", "sg-cost", fmt(c) + api.unit());
      b.type = "button";
      b.setAttribute("role", "radio");
      b.dataset.cost = c;
      b.onclick = () => {
        view.cost = c;
        try {
          localStorage.setItem("aiglish_sugoroku_cost", String(c));
        } catch {}
        hud();
      };
      costs.append(b);
    }
    view.costs = costs;
    view.go = node("button", "sg-go", "サイコロを振る");
    view.go.type = "button";
    view.go.dataset.sgRoll = "";
    view.go.onclick = roll;
    controls.append(costs, view.go);

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
    view.info.replaceChildren(
      node("span", "", "ビンゴのもと "),
      node("b", "", fmt(state.stake) + api.unit()),
      node("span", "", "　リーチ "),
      node("b", "", String(reaches.length)),
    );
    view.costs.querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-checked", String(Number(b.dataset.cost) === view.cost));
      b.disabled = view.busy;
    });
    const short = api.balance() < view.cost;
    view.go.disabled = view.busy || short || !!state.pending;
    view.go.textContent = short ? "チップが足りません" : view.busy ? "…" : "サイコロを振る";
  }
  // The piece sits on its square; the strip slides so the piece stays a little left of centre.
  function place(pos, smooth = true) {
    view.squares.forEach((sq, i) => sq.classList.toggle("is-here", i === pos));
    const sq = view.squares[pos];
    view.piece.style.transform = "translateX(" + (sq.offsetLeft + sq.offsetWidth / 2) + "px)";
    view.piece.classList.remove("is-hop");
    if (smooth && !calm() && !view.fast) {
      void view.piece.offsetWidth;
      view.piece.classList.add("is-hop");
    }
    const left = sq.offsetLeft - view.track.clientWidth * 0.35;
    view.track.scrollTo?.({ left, behavior: smooth && !calm() && !view.fast ? "smooth" : "auto" });
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
          quick = calm() || view.fast;
        // Whole extra turns so it tumbles, then the face for the number.
        turn = [turn[0] - (turn[0] % 360) + 720 + x, turn[1] - (turn[1] % 360) + 720 + y];
        body.style.transition = quick ? "none" : "transform 1000ms cubic-bezier(.2,.75,.25,1)";
        box.classList.remove("is-rolling");
        void box.offsetWidth;
        if (!quick) box.classList.add("is-rolling");
        body.style.transform = "rotateX(" + turn[0] + "deg) rotateY(" + turn[1] + "deg)";
        await wait(1050);
      },
    };
  }

  // ---- A roll ----------------------------------------------------------------------------
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, calm() || view?.fast ? Math.min(ms, 20) : ms));
  function pay(out, cost) {
    const money = api.round("sugoroku");
    if (cost) money.stake(cost);
    if (out.gain > 0) money.pay(out.gain);
    // An accident takes more than the bet, but never more than there is (no debt in the preview).
    else if (out.gain < 0) money.stake(Math.min(-out.gain, api.balance()), "accident");
  }
  async function roll() {
    if (view.busy || view.state.pending || api.balance() < view.cost) return;
    const cost = view.cost,
      state = view.state;
    view.busy = true;
    hud();
    const { out, before, people } = await onCard((card) => S.roll(state, card, cost, random, api.uid()));
    save(out.state);
    pay(out, cost);
    await run(out, { ...state, stake: state.stake + cost }, before, people);
    if (view?.state.pending) game();
  }
  // Plays events over a copy of the state shown so far, then shows the real new state.
  // `before` is the card the change was made on (it may hold other players' new balls).
  async function run(out, shown, before, people) {
    const target = view;
    view.busy = true;
    view.fast = false;
    view.body.classList.add("is-spinning");
    const live = { ...shown };
    view.state = live;
    view.card = { cells: [...before.card.cells], owners: [...before.card.owners] };
    view.people = { ...before.people, ...people };
    paintCard();
    hud();
    try {
      await show(out.events, live);
    } finally {
      if (target === view) {
        view.state = out.state;
        view.card = out.card;
        view.people = people;
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
      if (e.t === "die") {
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
        if (e.wheel === "bingo") live.stake = 0;
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
        await jackpot(e.kind);
      }
    }
  }

  // ---- The ball draw: a numbered ball rolls in from the right; on the card it flies into its
  // number, otherwise it greys out and pays 1.5× ------------------------------------------------
  async function drawBall(e, live) {
    const ball = node("div", "sg-ball", String(e.number));
    view.cardWrap.append(ball);
    say("");
    ball.classList.add("is-in");
    await wait(1100);
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
    say(e.number + " にボール", "is-ball");
    hud();
    await wait(700);
  }

  // ---- Wheels ----------------------------------------------------------------------------
  // The colour says what a slot is worth before the label is read.
  function tone(wheel, slot) {
    if (wheel === "event") return slot === "ball" ? "ball" : "game-" + slot;
    if (wheel === "accident") return slot.start ? "worst" : slot.back ? "bad" : slot.take >= 1.5 ? "worst" : slot.take ? "bad" : "safe";
    if (slot.ball) return "ball";
    if (slot.next || slot.jackpot) return "jackpot";
    if (wheel !== "normal") {
      const top = Math.max(...S.RULES.wheels[wheel].map((s) => s.x || 0));
      return slot.x >= top * 0.6 ? "gold" : slot.x >= top * 0.3 ? "high" : slot.x >= top * 0.12 ? "mid" : "low";
    }
    return slot.x >= 3 ? "gold" : slot.x >= 2 ? "champagne" : slot.x >= 1.25 ? "high" : slot.x >= 0.5 ? "mid" : slot.x > 0 ? "low" : "zero";
  }
  function slotLabel(wheel, slot) {
    if (wheel === "event") return slot === "ball" ? "BALL" : { blackjack: "BJ", dice: "DICE", chinchiro: "チンチロ" }[slot];
    if (wheel === "accident") return slot.start ? "START" : slot.back ? "−" + slot.back + "マス" : slot.take ? "−×" + slot.take : "SAFE";
    if (slot.ball) return "●";
    if (slot.next) return slot.next === "jp" ? "JP" : "SJP";
    if (slot.jackpot) return slot.jackpot === "jp" ? "JACKPOT" : "SUPER";
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
    if (e.wheel === "bingo") box.append(node("p", "sg-wheel-base", "前のビンゴから " + fmt(Math.round(e.base)) + api.unit()));
    layer.replaceChildren(box);
    const n = e.slots.length,
      turns = { normal: 4, event: 4, accident: 4, bingo: 5, jp: 6, sjp: 7 }[e.wheel],
      jitter = (random(60) - 30) / 100,
      angle = turns * 360 - ((e.index + 0.5 + jitter * 0.8) * 360) / n;
    const time = calm() || view.fast ? 0 : { normal: 1700, event: 2000, accident: 2000, bingo: 3000, jp: 3800, sjp: 4600 }[e.wheel];
    box.classList.add("is-spinning");
    disc.style.transition = time ? "transform " + time + "ms cubic-bezier(.15,.6,.1,1)" : "none";
    void disc.getBoundingClientRect();
    disc.style.transform = "rotate(" + angle + "deg)";
    await wait(time + 60);
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
            ? slot.next === "jp" ? "JACKPOT CHANCE" : "SUPER JACKPOT CHANCE"
            : slot.jackpot
              ? slot.jackpot === "jp" ? "JACKPOT" : "SUPER JACKPOT"
              : "×" + slot.x + "　+" + fmt(e.amount) + api.unit() + (slot.ball ? "　BALL" : "");
    box.classList.add("is-done");
    if (slot.next || slot.jackpot) layer.classList.add("is-hotter");
    await wait(hot || slot.x >= 2 || slot.ball ? 1300 : 750);
    layer.hidden = true;
  }
  async function jackpot(kind) {
    const amount = window.CasinoJackpot?.amounts()[kind] || 0,
      word = kind === "sjp" ? "SUPER JACKPOT" : "JACKPOT";
    const layer = view.layer;
    layer.className = "sg-layer is-hot is-hotter is-jackpot";
    layer.hidden = false;
    const box = node("div", "sg-jackpot");
    const value = node("b", "", "0pt");
    box.append(node("p", "sg-jackpot-word", word), value, node("small", "", "プレ版のため、ジャックポットは演出のみです"));
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
    const button = (text, onClick, data) => {
      const b = node("button", "sg-game-btn", text);
      b.type = "button";
      if (data) b.dataset.sgGame = data;
      b.onclick = onClick;
      actions.append(b);
      return b;
    };
    const end = (m) => {
      actions.replaceChildren();
      button("つづける", () => finish(m), "next");
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
      if (!p.round) keepRound((p.round = { parent: C.chinTurn(random), child: C.chinStart() }));
      draw();
    }
  }
  function die(value) {
    const el = node("span", "cs-die");
    el.dataset.value = value;
    for (let i = 1; i <= 9; i++) el.append(node("i", PIPS[value].includes(i) ? "is-on" : ""));
    return el;
  }
  async function finish(m) {
    view.layer.hidden = true;
    const state = view.state;
    const { out, before, people } = await onCard((card) => S.settle(state, card, m, random, api.uid()));
    save(out.state);
    pay(out, 0);
    view.busy = false;
    await run(out, { ...state, pending: null }, before, people);
  }

  window.Sugoroku = Object.freeze({ play });
})();
