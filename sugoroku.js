// すごろくビンゴ: the screen for SugorokuModel inside the casino. The ring of 24 squares runs
// round the edge of a 7×7 grid and the bingo card fills its middle. A roll is worked out and
// saved (here and, with points, in the cloud) before anything moves, and its points are paid
// at once, so closing the screen half way loses nothing; the board then plays it out.
(function () {
  "use strict";
  const S = window.SugorokuModel;
  const fmt = (n) => Number(n || 0).toLocaleString("ja-JP");
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const random = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  // The ring, clockwise from the top left: grid row and column (1-based) of each square.
  const RING = (() => {
    const at = [];
    for (let c = 1; c <= 7; c++) at.push([1, c]);
    for (let r = 2; r <= 7; r++) at.push([r, 7]);
    for (let c = 6; c >= 1; c--) at.push([7, c]);
    for (let r = 6; r >= 2; r--) at.push([r, 1]);
    return at;
  })();
  const LABEL = {
    start: () => "START",
    pt: (sq) => "×" + sq.m,
    again: () => "もう1回",
    go: (sq) => "+" + sq.k + "マス",
    bonus: () => "穴あけ",
    plain: () => "",
  };
  const WHEEL_NAMES = { 1: "ビンゴ・ルーレット", 2: "JACKPOT CHANCE", 3: "SUPER JACKPOT CHANCE" };
  const RULES_TEXT = [
    "プレ版のため、練習チップで遊びます（ポイントは動きません）。1回振るごとにチップを使います（10・50・100枚から選べます）。コマが出た目だけ進み、止まったマスの番号がビンゴカードで開きます。",
    "マスの効果：×の数字は使ったポイントのその倍がもらえます。「もう1回」はタダでもう1回振れます。「+2マス」などはさらに進み、止まったマスの番号も開きます。「穴あけ」はカードのどこかが1つ開きます。STARTを通ると少しもらえます。",
    "たて・よこ・ななめが1列そろうとビンゴ。前のビンゴから使ったポイントをもとに、10マスのルーレットが回ります。",
    "ルーレットの「JPチャンス」に止まると、JACKPOTの入ったルーレットへ。そこで「SJPチャンス」に止まると、SUPER JACKPOTの入ったルーレットへ進みます。",
    "JACKPOTとSUPER JACKPOTは自分だけの貯金で、振るたびに少しずつ増えていきます。当てるとはじめの額に戻ります。",
    "カードが全部開くと、新しいカードになります。カードとコマの位置は、やめても続きから遊べます。",
  ];

  // ---- Saving ----------------------------------------------------------------------------
  // One copy on this device for each account and wallet; with points also one in the cloud.
  // Whichever has rolled more is the one to go on from.
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
    view = { body, state, cost: Number(localStorage.getItem("aiglish_sugoroku_cost")) || 10, busy: false, fast: false };
    if (!S.RULES.costs.includes(view.cost)) view.cost = S.RULES.costs[0];
    draw();
  }
  function draw() {
    const { body, state } = view;
    body.classList.add("sg-body");
    const pots = node("div", "sg-pots");
    pots.append(pot("jp", "JACKPOT"), pot("sjp", "SUPER JACKPOT"));
    const board = node("div", "sg-board");
    view.squares = S.RULES.board.map((sq, i) => {
      const cell = node("div", "sg-sq is-" + sq.kind + (sq.kind === "pt" && sq.m >= 1 ? " is-big" : ""));
      cell.style.gridArea = RING[i][0] + " / " + RING[i][1];
      cell.append(node("small", "", String(i + 1)), node("b", "", LABEL[sq.kind](sq)));
      board.append(cell);
      return cell;
    });
    const card = node("div", "sg-card");
    view.cells = state.card.map((n, i) => {
      const cell = node("div", "sg-cell" + (i === S.FREE ? " is-free" : ""));
      cell.append(node("span", "", i === S.FREE ? "FREE" : String(n)));
      card.append(cell);
      return cell;
    });
    board.append(card);
    view.piece = node("div", "sg-piece");
    view.piece.setAttribute("aria-hidden", "true");
    board.append(view.piece);
    view.die = node("div", "sg-die");
    view.die.setAttribute("aria-hidden", "true");
    board.append(view.die);
    view.banner = node("div", "sg-banner");
    view.banner.setAttribute("role", "status");
    board.append(view.banner);
    board.onclick = () => view.busy && (view.fast = true);
    view.board = board;

    const info = node("div", "sg-info");
    view.stake = node("p", "sg-stake");
    view.stats = node("p", "sg-stats");
    info.append(view.stake, view.stats);

    const controls = node("div", "sg-controls");
    const costs = node("div", "sg-costs");
    costs.setAttribute("role", "radiogroup");
    costs.setAttribute("aria-label", "1回に使うポイント");
    for (const cost of S.RULES.costs) {
      const b = node("button", "sg-cost", fmt(cost) + api.unit());
      b.type = "button";
      b.setAttribute("role", "radio");
      b.dataset.cost = cost;
      b.onclick = () => {
        view.cost = cost;
        try {
          localStorage.setItem("aiglish_sugoroku_cost", String(cost));
        } catch {}
        hud();
      };
      costs.append(b);
    }
    view.costs = costs;
    view.go = node("button", "cs-primary sg-go", "サイコロを振る");
    view.go.type = "button";
    view.go.dataset.sgRoll = "";
    view.go.onclick = roll;
    view.note = node("p", "cs-hint");
    controls.append(costs, view.go, view.note);

    view.wheel = node("div", "sg-wheel");
    view.wheel.hidden = true;
    body.replaceChildren(pots, board, info, controls, view.wheel, rulesBox());
    hud();
    place(state.pos);
  }
  function pot(kind, name) {
    const box = node("div", "sg-pot is-" + kind);
    box.append(node("small", "", name), node("b", ""));
    box.dataset.pot = kind;
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
  // Everything that only reads the state: pools, marks, reach lines, counts and the button.
  function hud() {
    const { state } = view;
    for (const kind of ["jp", "sjp"]) view.body.querySelector('[data-pot="' + kind + '"] b').textContent = fmt(Math.floor(state[kind])) + api.unit();
    const reach = new Set(S.reach(state).flatMap((line) => S.LINES[line]));
    const done = new Set(state.lines.flatMap((line) => S.LINES[line]));
    view.cells.forEach((cell, i) => {
      cell.classList.toggle("is-on", state.marks[i]);
      cell.classList.toggle("is-reach", !state.marks[i] && reach.has(i));
      cell.classList.toggle("is-line", done.has(i));
    });
    view.stake.replaceChildren(node("span", "", "次のビンゴのもと"), node("b", "", fmt(state.stake) + api.unit()));
    view.stats.textContent = "カード" + (state.cards + 1) + "枚目 ・ ビンゴ" + state.lines.length + "列 ・ リーチ" + S.reach(state).length + "列";
    view.costs.querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-checked", String(Number(b.dataset.cost) === view.cost));
      b.disabled = view.busy;
    });
    const short = api.balance() < view.cost;
    view.go.disabled = view.busy || short;
    view.note.textContent = short ? (api.real() ? "ポイントが足りません。単語カードや苦手復習でポイントがたまります。" : "練習チップが足りません。") : "1回 " + fmt(view.cost) + api.unit() + "。盤面をタップすると早送りできます。";
  }
  function place(pos) {
    view.piece.style.gridArea = RING[pos][0] + " / " + RING[pos][1];
    view.squares.forEach((sq, i) => sq.classList.toggle("is-here", i === pos));
  }

  // ---- A roll ----------------------------------------------------------------------------
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, calm() || view?.fast ? Math.min(ms, 30) : ms));
  async function roll() {
    if (view.busy || api.balance() < view.cost) return;
    const cost = view.cost,
      out = S.roll(view.state, cost, random);
    // Saved and paid before the show, so leaving half way changes nothing.
    save(out.state);
    const money = api.round("sugoroku");
    money.stake(cost);
    if (out.gain) money.pay(out.gain);
    const shown = view.state,
      target = view;
    view.busy = true;
    view.fast = false;
    view.body.classList.add("is-spinning");
    // The board shows the old card until the events have played.
    const live = { ...shown, marks: [...shown.marks], lines: [...shown.lines], jp: out.state.jp, sjp: out.state.sjp, stake: shown.stake + cost };
    view.state = live;
    hud();
    try {
      await show(out.events, live, cost);
    } finally {
      if (target === view) {
        view.state = out.state;
        view.busy = false;
        view.body.classList.remove("is-spinning");
        if (out.events.some((e) => e.t === "complete")) draw();
        else hud();
        if (out.gain) say("この回 +" + fmt(out.gain) + api.unit(), out.gain >= cost * 5 ? "is-big" : "is-gain");
        api.refresh();
      }
    }
  }
  function say(text, cls = "") {
    const b = view.banner;
    b.className = "sg-banner " + cls;
    b.textContent = text;
    void b.offsetWidth;
    b.classList.add("is-on");
  }
  function float(pos, text, cls = "") {
    const f = node("div", "sg-float " + cls, text);
    f.style.gridArea = RING[pos][0] + " / " + RING[pos][1];
    view.board.append(f);
    setTimeout(() => f.remove(), 1200);
  }
  async function show(events, live, cost) {
    for (const e of events) {
      if (!view || !view.body.isConnected) return;
      if (e.t === "die") {
        view.die.textContent = String(e.value);
        view.die.className = "sg-die is-on" + (e.free ? " is-free" : "");
        await wait(e.free ? 700 : 500);
      } else if (e.t === "step") {
        live.pos = e.to;
        place(e.to);
        await wait(170);
      } else if (e.t === "lap") {
        float(0, "1周 +" + fmt(e.amount), "is-gain");
      } else if (e.t === "land") {
        const sq = view.squares[e.square];
        sq.classList.remove("is-flash");
        void sq.offsetWidth;
        sq.classList.add("is-flash");
        await wait(250);
      } else if (e.t === "pt") {
        float(e.square, "+" + fmt(e.amount), e.amount >= cost ? "is-big" : "is-gain");
        await wait(350);
      } else if (e.t === "fill") {
        live.marks[e.cell] = true;
        const cell = view.cells[e.cell];
        cell.classList.add("is-stamp");
        if (e.by === "bonus") say("穴あけ！ " + e.number + "番", "is-info");
        hud();
        await wait(e.by === "bonus" ? 700 : 380);
      } else if (e.t === "again") {
        say("もう1回！", "is-info");
        await wait(600);
      } else if (e.t === "go") {
        say(e.k + "マス進む", "is-info");
        await wait(450);
      } else if (e.t === "line") {
        live.lines.push(e.line);
        hud();
        for (const c of e.cells) {
          view.cells[c].classList.remove("is-run");
          void view.cells[c].offsetWidth;
          view.cells[c].classList.add("is-run");
        }
        say("BINGO!", "is-bingo");
        await wait(1100);
      } else if (e.t === "spin") {
        live.stake = 0;
        hud();
        await wheel(e);
      } else if (e.t === "jackpot") {
        live[e.kind] = S.RULES.pool[e.kind + "Seed"];
        hud();
        if (window.Ceremony && !calm()) window.Ceremony.play({ style: "chips", result: true, count: e.amount, from: 0, suffix: api.unit(), word: e.kind === "sjp" ? "SUPER JACKPOT" : "JACKPOT", sub: "すごろくビンゴ", tone: "gold" });
        say((e.kind === "sjp" ? "SUPER JACKPOT " : "JACKPOT ") + fmt(e.amount) + api.unit(), "is-jackpot");
        await wait(2400);
      } else if (e.t === "complete") {
        say("カードコンプリート！ 新しいカードへ", "is-bingo");
        await wait(1400);
      }
    }
  }
  // The roulette: lights run round the ten slots, slow down and stop on the drawn one.
  function slotText(slot, base) {
    if (slot.next === 2) return ["JPチャンス", ""];
    if (slot.next === 3) return ["SJPチャンス", ""];
    if (slot.jp) return [slot.jp === "sjp" ? "SUPER JP" : "JACKPOT", fmt(Math.floor(view.state[slot.jp])) + api.unit()];
    return ["×" + slot.x, fmt(Math.round(base * slot.x)) + api.unit()];
  }
  async function wheel(e) {
    const box = view.wheel;
    box.className = "sg-wheel is-stage" + e.stage;
    box.hidden = false;
    const head = node("p", "sg-wheel-head", WHEEL_NAMES[e.stage]);
    const ring = node("div", "sg-wheel-ring");
    const lamps = e.slots.map((slot) => {
      const lamp = node("div", "sg-slot" + (slot.next ? " is-chance" : slot.jp ? " is-jp is-" + slot.jp : ""));
      const [top, sub] = slotText(slot, e.base);
      lamp.append(node("b", "", top), node("small", "", sub));
      ring.append(lamp);
      return lamp;
    });
    box.replaceChildren(head, ring, node("p", "sg-wheel-base", "もと " + fmt(Math.round(e.base)) + api.unit()));
    // Light order round the 5×2 grid: top row left to right, bottom row right to left.
    const order = [0, 1, 2, 3, 4, 9, 8, 7, 6, 5];
    const turns = 3 + e.stage,
      stopAt = order.indexOf(e.index),
      total = turns * 10 + stopAt;
    for (let i = 0; i <= total; i++) {
      lamps.forEach((l) => l.classList.remove("is-lit"));
      lamps[order[i % 10]].classList.add("is-lit");
      const left = total - i;
      await wait(left > 12 ? 45 : 45 + (12 - left) * 28);
    }
    const hit = lamps[e.index];
    hit.classList.add("is-hit");
    const slot = e.slots[e.index];
    if (slot.next) say(slot.next === 2 ? "JACKPOT CHANCE!" : "SUPER JACKPOT CHANCE!", "is-jackpot");
    else if (!slot.jp) say("ビンゴ +" + fmt(e.amount) + api.unit(), e.amount >= e.base ? "is-big" : "is-gain");
    await wait(slot.next ? 1500 : 1200);
    box.hidden = true;
  }

  window.Sugoroku = Object.freeze({ play });
})();
