// すごろくビンゴ: the screen for SugorokuModel inside the casino.
//
// Quiet most of the time — ivory numbers on a dark green felt, one thin gold line — and warm
// only when it matters: a line, the jackpot wheels and a jackpot. A roll is worked out and saved
// before anything moves, and its chips are paid at once, so closing half way changes nothing.
// An event game is saved move by move in state.pending, so it carries on where it was left.
// For now the game is a preview: the casino gives it practice chips only, and a jackpot is shown
// but not paid.
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
  const SQUARE = { start: ["START", ""], normal: ["", "ルーレット"], event: ["EVENT", "ゲーム"], accident: ["!", "アクシデント"] };
  const GAME_NAMES = { blackjack: "ブラックジャック", dice: "ダイスポーカー", chinchiro: "チンチロ", ball: "ボール確定" };
  const WHEEL_NAMES = { normal: "", event: "イベント", accident: "アクシデント", bingo: "BINGO", jp: "JACKPOT CHANCE", sjp: "SUPER JACKPOT CHANCE" };
  const HOT = new Set(["bingo", "jp", "sjp"]);
  const RULES_TEXT = [
    "プレ版のため練習チップで遊びます。ポイントは動かず、ジャックポットも演出だけです。",
    "1回に使う額（10・50・100）を選んでサイコロを振ります。出る目は同じですが、額が大きいほど通常マスのルーレットに「ボール」が多く入ります。",
    "通常マス：ルーレットで ×3〜×0 のどれかが額に掛かって戻ります。「ボール」ならボールが出て額がそのまま戻ります。",
    "EVENT：ブラックジャック・ダイスポーカー・チンチロ・ボール確定のどれかが選ばれます。ゲームに勝つと配当とボール、引き分けは額が戻り、負けると額の半分が戻ります。ボール確定はボールと額の1.5倍です。",
    "アクシデント：額の0〜2倍が引かれるか、STARTに戻ります。",
    "STARTを通るとボールが出て、額に関係なく少しもらえます（周回が増えるほど少しずつ増えます）。",
    "ボールが出るとカードの番号が1つ開きます。たて・よこ・ななめが1列そろうと、前のビンゴから使った額をもとにルーレットが回り、「JP CHANCE」からジャックポットを狙えます。",
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
    return state || S.newState(random);
  }

  // ---- Screen ----------------------------------------------------------------------------
  let view = null;
  async function play(body, wallet) {
    api = wallet;
    body.replaceChildren(node("p", "cs-hint", "読み込み中…"));
    const state = await load();
    if (!body.isConnected) return;
    let cost = 10;
    try {
      cost = Number(localStorage.getItem("aiglish_sugoroku_cost")) || 10;
    } catch {}
    view = { body, state, cost: S.RULES.costs.includes(cost) ? cost : 10, busy: false, fast: false };
    draw();
    if (state.pending) game();
  }
  function draw() {
    const { body, state } = view;
    body.classList.add("sg-body");
    const pots = node("div", "sg-pots");
    pots.append(pot("jp", "JACKPOT"), pot("sjp", "SUPER JACKPOT"));
    view.unsub?.();
    view.unsub = window.CasinoJackpot?.onChange(() => view?.body.isConnected && hud());
    window.CasinoJackpot?.refresh();

    const card = node("div", "sg-card");
    card.setAttribute("aria-label", "ビンゴカード");
    view.cells = state.card.map((n, i) => {
      const cell = node("div", "sg-cell" + (i === S.FREE ? " is-free" : ""));
      cell.append(node("span", "", i === S.FREE ? "FREE" : String(n)));
      card.append(cell);
      return cell;
    });

    const track = node("div", "sg-track");
    const lane = node("div", "sg-lane");
    view.squares = Array.from({ length: S.SIZE }, (_, i) => {
      const kind = S.kindAt(i),
        sq = node("div", "sg-sq is-" + kind);
      sq.append(node("small", "", String(i)), node("b", "", SQUARE[kind][0] || "◯"), node("em", "", SQUARE[kind][1]));
      lane.append(sq);
      return sq;
    });
    track.append(lane);
    view.track = track;
    view.lap = node("p", "sg-lap");

    const stage = node("div", "sg-stage");
    view.die = node("div", "sg-die");
    view.die.setAttribute("aria-hidden", "true");
    view.say = node("p", "sg-say");
    view.say.setAttribute("role", "status");
    stage.append(view.die, view.say);
    stage.onclick = () => view.busy && (view.fast = true);
    track.onclick = stage.onclick;

    const info = node("dl", "sg-info");
    view.info = info;

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
    view.note = node("p", "sg-note");
    controls.append(costs, view.go, view.note);

    view.layer = node("div", "sg-layer");
    view.layer.hidden = true;
    body.replaceChildren(pots, card, stage, track, view.lap, info, controls, rulesBox(), view.layer);
    hud();
    place(state.pos, false);
  }
  function pot(kind, name) {
    const box = node("div", "sg-pot is-" + kind);
    box.dataset.pot = kind;
    box.append(node("small", "", name), node("b", ""));
    return box;
  }
  function rulesBox() {
    const box = node("details", "cs-rules");
    box.append(node("summary", "", "すごろくビンゴの遊び方"));
    const list = node("ul");
    for (const text of RULES_TEXT) list.append(node("li", "", text));
    box.append(list);
    return box;
  }
  function hud() {
    const { state } = view;
    const pots = window.CasinoJackpot?.amounts() || { jp: 0, sjp: 0 };
    for (const kind of ["jp", "sjp"]) view.body.querySelector('[data-pot="' + kind + '"] b').textContent = fmt(pots[kind]) + "pt";
    const reach = new Set(S.reach(state).flatMap((line) => S.LINES[line]));
    const done = new Set(state.lines.flatMap((line) => S.LINES[line]));
    view.cells.forEach((cell, i) => {
      cell.classList.toggle("is-on", state.marks[i]);
      cell.classList.toggle("is-reach", !state.marks[i] && reach.has(i));
      cell.classList.toggle("is-line", done.has(i));
    });
    view.lap.textContent = "マス " + state.pos + " / " + S.SIZE + "　・　" + state.laps + "周";
    const rows = [
      ["次のビンゴのもと", fmt(state.stake) + api.unit()],
      ["ビンゴ", state.lines.length + "列（リーチ" + S.reach(state).length + "）"],
      ["カード", state.cards + 1 + "枚目"],
    ];
    view.info.replaceChildren(
      ...rows.map(([k, v]) => {
        const row = node("div");
        row.append(node("dt", "", k), node("dd", "", v));
        return row;
      }),
    );
    view.costs.querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-checked", String(Number(b.dataset.cost) === view.cost));
      b.disabled = view.busy;
    });
    const short = api.balance() < view.cost;
    view.go.disabled = view.busy || short || !!state.pending;
    view.note.textContent = short ? "チップが足りません。" : "盤面をタップすると早送りできます。";
  }
  // The piece is the lit square; the lane slides so it stays in the middle.
  function place(pos, smooth = true) {
    view.squares.forEach((sq, i) => sq.classList.toggle("is-here", i === pos));
    const sq = view.squares[pos],
      track = view.track;
    const left = sq.offsetLeft - (track.clientWidth - sq.offsetWidth) / 2;
    track.scrollTo?.({ left, behavior: smooth && !calm() && !view.fast ? "smooth" : "auto" });
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
      out = S.roll(view.state, cost, random);
    save(out.state);
    pay(out, cost);
    await run(out, { ...view.state, stake: view.state.stake + cost });
    if (view?.state.pending) game();
  }
  // Plays events over a copy of the state shown so far, then shows the real new state.
  async function run(out, shown) {
    const target = view;
    view.busy = true;
    view.fast = false;
    view.body.classList.add("is-spinning");
    const live = { ...shown, marks: [...shown.marks], lines: [...shown.lines] };
    view.state = live;
    hud();
    try {
      await show(out.events, live);
    } finally {
      if (target === view) {
        view.state = out.state;
        view.busy = false;
        view.body.classList.remove("is-spinning");
        if (out.events.some((e) => e.t === "complete")) draw();
        else hud();
        if (out.gain && !out.state.pending) say(out.gain > 0 ? "+" + fmt(out.gain) + api.unit() : "−" + fmt(-out.gain) + api.unit(), out.gain > 0 ? "is-gain" : "is-loss");
        api.refresh();
      }
    }
  }
  function say(text, cls = "") {
    view.say.className = "sg-say " + cls;
    view.say.textContent = text;
  }
  async function show(events, live) {
    for (const e of events) {
      if (!view?.body.isConnected) return;
      if (e.t === "die") {
        view.die.textContent = String(e.value);
        view.die.classList.remove("is-on");
        void view.die.offsetWidth;
        view.die.classList.add("is-on");
        say("");
        await wait(450);
      } else if (e.t === "step") {
        live.pos = e.to;
        place(e.to);
        hud();
        await wait(160);
      } else if (e.t === "lap") {
        live.laps = e.laps;
        say(e.laps + "周目　+" + fmt(e.amount) + api.unit() + "とボール", "is-gain");
        await wait(800);
      } else if (e.t === "land") {
        view.squares[e.square].classList.add("is-flash");
        setTimeout(() => view?.squares[e.square]?.classList.remove("is-flash"), 500);
        await wait(250);
      } else if (e.t === "wheel") {
        if (e.wheel === "bingo") live.stake = 0;
        await wheel(e);
      } else if (e.t === "ball") {
        live.marks[e.cell] = true;
        const cell = view.cells[e.cell];
        cell.classList.add("is-new");
        setTimeout(() => cell.classList.remove("is-new"), 1200);
        say("ボール " + e.number, "is-ball");
        hud();
        await wait(700);
      } else if (e.t === "line") {
        live.lines.push(e.line);
        hud();
        e.cells.forEach((c, i) => {
          const cell = view.cells[c];
          cell.style.setProperty("--i", i);
          cell.classList.add("is-run");
          setTimeout(() => cell.classList.remove("is-run"), 1600);
        });
        say("BINGO", "is-hot");
        await wait(1500);
      } else if (e.t === "take") {
        say("アクシデント　−" + fmt(e.amount) + api.unit(), "is-loss");
        await wait(800);
      } else if (e.t === "back") {
        live.pos = 0;
        place(0);
        say("STARTに戻る", "is-loss");
        await wait(800);
      } else if (e.t === "sure") {
        say("ボール確定　+" + fmt(e.amount) + api.unit(), "is-gain");
        await wait(700);
      } else if (e.t === "result") {
        say({ win: "勝ち　+", push: "引き分け　+", lose: "負け　+" }[e.outcome] + fmt(e.amount) + api.unit(), e.outcome === "win" ? "is-gain" : "");
        await wait(800);
      } else if (e.t === "jackpot") {
        await jackpot(e.kind);
      } else if (e.t === "complete") {
        say("カードがすべて開きました。新しいカードへ", "is-hot");
        await wait(1400);
      }
    }
  }

  // ---- Wheels ----------------------------------------------------------------------------
  function slotLabel(wheel, slot, base) {
    if (wheel === "event") return [slot === "ball" ? "ボール" : { blackjack: "BJ", dice: "ダイス", chinchiro: "チンチロ" }[slot], ""];
    if (wheel === "accident") return slot.start ? ["START", "へ"] : slot.take ? ["−" + slot.take, "倍"] : ["0", "セーフ"];
    if (slot.ball) return ["●", "ボール"];
    if (slot.next) return [slot.next === "jp" ? "JP" : "SJP", "CHANCE"];
    if (slot.jackpot) return [slot.jackpot === "jp" ? "JACKPOT" : "SUPER", slot.jackpot === "jp" ? "" : "JACKPOT"];
    if (wheel === "normal") return ["×" + slot.x, ""];
    return ["×" + slot.x, fmt(Math.round(base * slot.x))];
  }
  function wheelSvg(e) {
    const n = e.slots.length,
      r = 100,
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "-110 -110 220 220");
    svg.setAttribute("aria-hidden", "true");
    const disc = document.createElementNS(svg.namespaceURI, "g");
    disc.setAttribute("class", "sg-disc");
    const at = (deg, rad) => [Math.sin((deg * Math.PI) / 180) * rad, -Math.cos((deg * Math.PI) / 180) * rad];
    e.slots.forEach((slot, i) => {
      const a = (i * 360) / n,
        b = ((i + 1) * 360) / n,
        [x1, y1] = at(a, r),
        [x2, y2] = at(b, r);
      const path = document.createElementNS(svg.namespaceURI, "path");
      path.setAttribute("d", "M0 0L" + x1 + " " + y1 + "A" + r + " " + r + " 0 0 1 " + x2 + " " + y2 + "Z");
      const special = slot === "ball" || slot.ball || slot.next || slot.jackpot || slot.start || (slot.x >= 3 && e.wheel === "normal");
      path.setAttribute("class", "sg-seg" + (i % 2 ? " is-odd" : "") + (special ? " is-special" : "") + (slot.jackpot ? " is-jackpot" : "") + (slot.x === 0 ? " is-zero" : ""));
      disc.append(path);
      const [top, sub] = slotLabel(e.wheel, slot, e.base),
        mid = (a + b) / 2,
        [tx, ty] = at(mid, n > 12 ? 78 : 66);
      const text = document.createElementNS(svg.namespaceURI, "text");
      text.setAttribute("transform", "translate(" + tx + " " + ty + ") rotate(" + mid + ")");
      text.setAttribute("class", "sg-seg-text" + (n > 12 ? " is-small" : ""));
      text.textContent = top;
      if (sub && n <= 12) {
        const tspan = document.createElementNS(svg.namespaceURI, "tspan");
        tspan.setAttribute("x", "0");
        tspan.setAttribute("dy", "11");
        tspan.setAttribute("class", "sg-seg-sub");
        tspan.textContent = sub;
        text.append(tspan);
      }
      disc.append(text);
    });
    const hub = document.createElementNS(svg.namespaceURI, "circle");
    hub.setAttribute("r", "14");
    hub.setAttribute("class", "sg-hub");
    svg.append(disc, hub);
    return { svg, disc };
  }
  async function wheel(e) {
    const layer = view.layer,
      hot = HOT.has(e.wheel);
    layer.className = "sg-layer is-" + e.wheel + (hot ? " is-hot" : "");
    layer.hidden = false;
    const box = node("div", "sg-wheel");
    box.append(node("p", "sg-wheel-title", e.wheel === "normal" ? fmt(e.base) + api.unit() + " のルーレット" : WHEEL_NAMES[e.wheel]));
    const face = node("div", "sg-wheel-face");
    const { svg, disc } = wheelSvg(e);
    face.append(svg, node("i", "sg-pointer"));
    box.append(face);
    const outcome = node("p", "sg-wheel-out");
    box.append(outcome);
    if (hot && e.wheel !== "jp" && e.wheel !== "sjp") box.append(node("p", "sg-wheel-base", "もと " + fmt(Math.round(e.base)) + api.unit()));
    layer.replaceChildren(box);
    const n = e.slots.length,
      turns = { normal: 3, event: 3, accident: 3, bingo: 4, jp: 5, sjp: 6 }[e.wheel],
      jitter = (random(60) - 30) / 100,
      angle = turns * 360 - ((e.index + 0.5 + jitter * 0.8) * 360) / n;
    const time = calm() || view.fast ? 0 : { normal: 1300, event: 1600, accident: 1600, bingo: 2600, jp: 3400, sjp: 4200 }[e.wheel];
    disc.style.transition = time ? "transform " + time + "ms cubic-bezier(.12,.6,.08,1)" : "none";
    void disc.getBoundingClientRect();
    disc.style.transform = "rotate(" + angle + "deg)";
    await wait(time + 60);
    const slot = e.slots[e.index],
      [top, sub] = slotLabel(e.wheel, slot, e.base);
    outcome.textContent =
      e.wheel === "event" ? GAME_NAMES[slot] : e.wheel === "accident" ? (slot.start ? "STARTに戻る" : slot.take ? "−" + fmt(Math.round(e.base * slot.take)) + api.unit() : "セーフ") : e.amount !== undefined ? top + "　+" + fmt(e.amount) + api.unit() + (slot.ball ? "　ボール" : "") : top + " " + sub;
    box.classList.add("is-done");
    if (slot.next || slot.jackpot) layer.classList.add("is-hotter");
    await wait(hot ? 1300 : 650);
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
    const steps = calm() || view.fast ? 1 : 40;
    for (let i = 1; i <= steps; i++) {
      value.textContent = fmt(Math.round((amount * i) / steps)) + "pt";
      await wait(40);
    }
    await wait(2600);
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
  const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  function die(value) {
    const el = node("span", "cs-die");
    el.dataset.value = value;
    for (let i = 1; i <= 9; i++) el.append(node("i", PIPS[value].includes(i) ? "is-on" : ""));
    return el;
  }
  async function finish(m) {
    view.layer.hidden = true;
    const out = S.settle(view.state, m, random);
    save(out.state);
    pay(out, 0);
    view.busy = false;
    await run(out, { ...view.state, pending: null });
  }

  window.Sugoroku = Object.freeze({ play });
})();
