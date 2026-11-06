// 大富豪: the screens (the lobby, the waiting room, the table, the results). The game itself is
// DaifugoModel, the shared table and the settlement are DaifugoTable.
(function () {
  "use strict";
  const D = window.DaifugoModel,
    T = window.DaifugoTable;
  const fmt = (n) => Number(n || 0).toLocaleString("ja-JP");
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const sound = (name) => {
    try {
      window.AppSounds?.play?.(name);
    } catch {}
  };
  const SUIT_MARK = { S: "♠", H: "♥", D: "♦", C: "♣" },
    SUIT_NAME = { S: "スペード", H: "ハート", D: "ダイヤ", C: "クラブ" },
    RANK_TEXT = { 11: "J", 12: "Q", 13: "K", 14: "A", 15: "2" };
  const rankText = (rank) => RANK_TEXT[rank] || String(rank);
  const MEDAL = ["👑", "🥈", "🥉"];

  let screen = null,
    off = null,
    ui = null;
  const freshUi = () => ({ selected: [], sig: "", gNo: -1, seq: 0, shown: new Set(), fx: [], lobby: { stake: 100, games: 1, seats: 4, think: 30, miyakoochi: false, practice: 4 }, status: "", sort: "power", rejSeen: 0 });

  // ---- Cards ----------------------------------------------------------------------------
  function cardEl(code, extra) {
    const joker = D.isJoker(code),
      el = node(extra?.button ? "button" : "div", "df-card " + (joker ? "is-joker" : "suit-" + D.suitOf(code)) + (extra?.cls ? " " + extra.cls : ""));
    if (extra?.button) el.type = "button";
    if (code === null) {
      el.className = "df-card is-back" + (extra?.cls ? " " + extra.cls : "");
      return el;
    }
    el.dataset.card = code;
    if (joker) {
      el.append(node("b", "df-corner", "JOKER"), node("i", "df-star", "★"), node("b", "df-corner is-low", "JOKER"));
      el.setAttribute("aria-label", "ジョーカー");
    } else {
      const rank = rankText(D.rankOf(code)),
        mark = SUIT_MARK[D.suitOf(code)];
      const corner = node("b", "df-corner");
      corner.append(node("span", "", rank), node("small", "", mark));
      const low = corner.cloneNode(true);
      low.classList.add("is-low");
      el.append(corner, node("i", "df-pip", mark), low);
      el.setAttribute("aria-label", SUIT_NAME[D.suitOf(code)] + "の" + rank);
    }
    return el;
  }
  const backFan = (count) => {
    const fan = node("div", "df-fan");
    const shown = Math.min(count, 7);
    for (let i = 0; i < shown; i++) {
      const c = node("span", "df-mini");
      c.style.setProperty("--i", i - (shown - 1) / 2);
      fan.append(c);
    }
    return fan;
  };
  function avatarEl(player, size) {
    const wrap = node("span", "df-avatar");
    const label = player?.name || "?";
    if (window.RankingVisuals?.avatar && !player?.bot) wrap.append(window.RankingVisuals.avatar(player?.avatar || "", label, null));
    else wrap.append(node("span", "df-cpu", player?.bot ? "🤖" : label.slice(0, 1)));
    if (size) wrap.style.setProperty("--size", size + "px");
    return wrap;
  }

  // ---- Screen frame -------------------------------------------------------------------
  function open() {
    if (screen) return;
    ui = freshUi();
    screen = document.createElement("dialog");
    screen.className = "df-screen";
    screen.setAttribute("aria-label", "大富豪");
    screen.innerHTML = '<button type="button" class="df-close" aria-label="大富豪を閉じる">×</button><div class="df-view" data-df-view></div>';
    screen.querySelector(".df-close").onclick = () => leave();
    screen.addEventListener("cancel", (event) => {
      event.preventDefault();
      leave();
    });
    document.body.append(screen);
    document.body.classList.add("df-open");
    screen.showModal();
    off = T.subscribe(render);
    render(T.view());
  }
  async function leave() {
    const v = T.view();
    const playing = v && v.room && ["playing", "waiting"].includes(v.room.status) && !v.practice;
    if (playing && v.room.status === "playing") {
      const owes = !v.room.settings.practice;
      if (!window.confirm(owes ? "途中で抜けると、最下位として精算されます。抜けますか？" : "抜けますか？")) return;
    }
    await T.leave();
    closeScreen();
  }
  function closeScreen() {
    off?.();
    off = null;
    if (screen?.open) screen.close();
    screen?.remove();
    screen = null;
    ui = null;
    document.body.classList.remove("df-open");
  }
  const host = () => screen?.querySelector("[data-df-view]");
  function render(v) {
    if (!screen || !ui) return;
    const room = v?.room;
    let sig;
    if (!v) sig = "lobby:" + ui.status;
    else if (room.status === "waiting") sig = "wait:" + Object.keys(room.players).join() + ":" + room.status + ui.status;
    else if (room.status === "finished" || room.status === "closed") sig = "end:" + room.status + ":" + JSON.stringify(T.payments(room).pays.map((p) => T.paid(p.id)?.ok)) + ui.status;
    else sig = ["play", room.gNo, room.g?.seq, room.g?.turn, room.g?.phase, room.g?.ex?.waiting?.join(), v.hand?.hand?.join(), ui.selected.join(), room.rej?.[v.me]?.seq, ui.status, ui.sort, ui.rules, room.betweenAt ? 1 : 0, Object.values(room.players).map((p) => p.left).join()].join("|");
    if (sig === ui.sig) {
      tickTimer(v);
      return;
    }
    ui.sig = sig;
    const view = host();
    if (!view) return;
    const scrolled = view.querySelector(".df-hand")?.scrollLeft || 0;
    view.replaceChildren();
    if (!v) lobby(view);
    else if (room.status === "waiting") waiting(view, v);
    else if (room.status === "finished" || room.status === "closed") ending(view, v);
    else table(view, v);
    const hand = view.querySelector(".df-hand");
    if (hand) hand.scrollLeft = scrolled;
    tickTimer(v);
  }
  function say(text) {
    if (!ui) return;
    ui.status = text || "";
    ui.sig = "";
    render(T.view());
  }

  // ---- Lobby ----------------------------------------------------------------------------
  const RULES = [
    "3〜5人で遊びます。手札を先になくした人が「大富豪」、最後に残った人が「大貧民」です。",
    "強さは 3 が一番弱く、2 が一番強く、ジョーカーは最強です。場と同じ枚数で、強いカードだけ出せます。パスもできます。",
    "同じ数字は2枚・3枚・4枚と出せます。同じマークで数字が続く3枚以上は「階段」です。ジョーカーは何にでもなります。",
    "4枚同じ数字で「革命」。強さがひっくり返ります。8を出すと場が流れ（8切り）、ジョーカー1枚にはスペードの3だけが勝てます（スペ3返し）。",
    "同じマークが続けて出ると「縛り」になり、場が流れるまでそのマークしか出せません。",
    "上がりの1枚が 2・8・ジョーカー・スペードの3だと「反則上がり」で最下位側になります（革命中は 3 も）。",
    "2ゲーム目からは、大貧民が一番強い2枚を大富豪へ、貧民が1枚を富豪へ渡し、代わりに好きなカードを受け取ります。",
    "賭けは終わってから精算します。最下位が1位へ賭け額、下から2番目が上から2番目へ半分を払います。足りない分はカジノからの借金になります。",
  ];
  function rulesBlock() {
    const details = node("details", "df-rules");
    details.append(node("summary", "", "遊び方・ルール"));
    const list = node("ul");
    for (const line of RULES) list.append(node("li", "", line));
    details.append(list, node("p", "df-credit", "ルールは日本大富豪連盟の公式ルールブックに沿っています。"));
    return details;
  }
  const chips = (values, current, onPick, label) => {
    const row = node("div", "df-chips");
    for (const [value, text] of values) {
      const b = node("button", "", text);
      b.type = "button";
      b.setAttribute("aria-pressed", String(current === value));
      b.setAttribute("aria-label", label + " " + text);
      b.onclick = () => {
        sound("tap");
        onPick(value);
      };
      row.append(b);
    }
    return row;
  };
  function payPreview(n, stake) {
    const names = D.NAMES[n],
      order = names.map((_, i) => "#" + i),
      lines = D.payouts(order, stake).map((p) => names[order.indexOf(p.from)] + " → " + names[order.indexOf(p.to)] + "　" + fmt(p.amount) + "pt");
    return lines.join("　／　");
  }
  function lobby(view) {
    const l = ui.lobby;
    const box = node("div", "df-lobby");
    box.append(node("p", "df-kicker", "DAIFUGO"), node("h2", "", "大富豪"), node("p", "df-sub", "3〜5人で遊ぶ、ポイントを賭けられるカードゲーム"));

    // Practice
    const practice = node("section", "df-panel");
    practice.append(node("h3", "", "ひとりで練習"), node("p", "df-note", "コンピュータが相手です。ポイントは動きません。"));
    practice.append(chips([[3, "3人"], [4, "4人"], [5, "5人"]], l.practice, (v) => ((l.practice = v), (ui.sig = ""), render(T.view())), "人数"));
    const go = node("button", "df-primary", "練習をはじめる");
    go.type = "button";
    go.onclick = () => {
      sound("confirm");
      ui.sig = "";
      T.practice(l.practice);
    };
    practice.append(go);

    // Make a table
    const make = node("section", "df-panel");
    make.append(node("h3", "", "テーブルを作る"));
    const stakeRow = node("label", "df-field");
    stakeRow.append(node("span", "", "賭け額（最下位が1位へ払う額）"));
    const stake = node("input");
    Object.assign(stake, { type: "number", min: 1, max: 100000, step: 1, inputMode: "numeric", value: String(l.stake) });
    stake.setAttribute("aria-label", "賭け額");
    stakeRow.append(stake, node("em", "", "pt"));
    const preview = node("p", "df-note df-preview");
    const showPreview = () => (preview.textContent = payPreview(l.seats, Math.max(1, Math.floor(Number(stake.value)) || 1)) + "　足りない分はカジノからの借金");
    stake.oninput = () => {
      l.stake = Math.max(1, Math.min(100000, Math.floor(Number(stake.value)) || 1));
      showPreview();
    };
    const quick = node("div", "df-chips");
    for (const v of [10, 50, 100, 500, 1000]) {
      const b = node("button", "", String(v));
      b.type = "button";
      b.onclick = () => {
        sound("tap");
        l.stake = v;
        stake.value = String(v);
        showPreview();
      };
      quick.append(b);
    }
    const again = () => ((ui.sig = ""), render(T.view()));
    make.append(stakeRow, quick, preview);
    make.append(node("p", "df-label", "人数（最大）"), chips([[3, "3人"], [4, "4人"], [5, "5人"]], l.seats, (v) => ((l.seats = v), again()), "最大人数"));
    make.append(node("p", "df-label", "ゲーム数"), chips([[1, "1ゲーム"], [4, "4ゲーム（1セット）"]], l.games, (v) => ((l.games = v), again()), "ゲーム数"));
    make.append(node("p", "df-label", "持ち時間"), chips(T.THINK.map((s) => [s, s + "秒"]), l.think, (v) => ((l.think = v), again()), "持ち時間"));
    make.append(node("p", "df-label", "都落ち"), chips([[false, "なし"], [true, "あり"]], l.miyakoochi, (v) => ((l.miyakoochi = v), again()), "都落ち"));
    showPreview();
    const create = node("button", "df-primary", "テーブルを作る");
    create.type = "button";
    create.onclick = async () => {
      create.disabled = true;
      try {
        await T.createTable({ stake: l.stake, games: l.games, seats: l.seats, think: l.think, miyakoochi: l.miyakoochi });
      } catch (error) {
        say(window.Poker?.message?.(error) || error.message);
      }
      create.disabled = false;
    };
    make.append(create);

    // Join
    const join = node("section", "df-panel");
    join.append(node("h3", "", "テーブルに入る"));
    const row = node("div", "df-join");
    const code = node("input");
    Object.assign(code, { type: "text", inputMode: "numeric", maxLength: 4, placeholder: "0000", autocomplete: "off" });
    code.setAttribute("aria-label", "テーブル番号");
    const enter = node("button", "df-primary", "入る");
    enter.type = "button";
    const doJoin = async () => {
      enter.disabled = true;
      try {
        await T.joinTable(code.value.trim());
      } catch (error) {
        say(window.Poker?.message?.(error) || error.message);
      }
      enter.disabled = false;
    };
    code.oninput = () => {
      code.value = code.value.replace(/\D/g, "").slice(0, 4);
      if (code.value.length === 4) doJoin();
    };
    enter.onclick = doJoin;
    row.append(code, enter);
    join.append(row);
    box.append(practice, make, join, node("p", "df-status", ui.status), rulesBlock());
    view.append(box);
  }

  // ---- Waiting room -------------------------------------------------------------------
  function waiting(view, v) {
    const { room } = v;
    const box = node("div", "df-lobby df-waiting");
    box.append(node("p", "df-kicker", "TABLE"), node("h2", "", "テーブル " + room.code));
    const big = node("p", "df-code", room.code);
    big.setAttribute("aria-label", "テーブル番号 " + room.code);
    box.append(big, node("p", "df-sub", "この番号を友だちに伝えてください"));
    const s = room.settings;
    box.append(node("p", "df-note", "賭け額 " + fmt(s.stake) + "pt　/　" + (s.games === 4 ? "4ゲーム（1セット）" : "1ゲーム") + "　/　持ち時間 " + s.think + "秒　/　都落ち" + (s.miyakoochi ? "あり" : "なし")));
    const seats = node("ul", "df-seats-list");
    const order = T.seatOrder(room);
    for (let i = 0; i < s.seats; i++) {
      const id = order[i],
        p = id && room.players[id];
      const li = node("li", p ? "is-taken" : "is-empty");
      if (p) li.append(avatarEl(p, 40), node("span", "df-seat-name", p.name + (id === room.host ? "（親）" : "") + (id === v.me ? "（あなた）" : "")));
      else li.append(node("span", "df-seat-empty", "空席"));
      seats.append(li);
    }
    box.append(seats, node("p", "df-note", payPreview(Math.max(3, order.length), s.stake) + "　足りない分はカジノからの借金になります。"));
    if (v.host) {
      const start = node("button", "df-primary", order.length < 3 ? "3人そろうと始められます" : order.length + "人で始める");
      start.type = "button";
      start.disabled = order.length < 3;
      start.onclick = async () => {
        start.disabled = true;
        try {
          await T.start();
        } catch (error) {
          say(error.message);
        }
      };
      box.append(start);
    } else box.append(node("p", "df-note", "親が始めるのを待っています…"));
    const out = node("button", "df-ghost", "テーブルを出る");
    out.type = "button";
    out.onclick = leave;
    box.append(out, node("p", "df-status", ui.status), rulesBlock());
    view.append(box);
  }

  // ---- The table ---------------------------------------------------------------------
  function pseudo(g, hand, me) {
    const hands = {};
    for (const id of g.ids) hands[id] = id === me ? hand : Array(g.counts[id] || 0).fill("S3");
    return { n: g.n, ids: g.ids, hands, field: g.field, lock: g.lock, rev: g.rev, turn: g.turn, passed: g.passed, legal: g.legal, illegal: g.illegal, fallen: g.fallen, phase: g.phase, top: g.top, opts: {}, log: [], blind: [], exchange: g.ex ? { pairs: g.ex.pairs, given: {} } : null };
  }
  function playText(play) {
    if (!play) return "";
    if (play.kind === "stair") return "階段 " + play.n + "枚";
    if (play.rank === D.JOKER_RANK) return play.n === 1 ? "ジョーカー" : "ジョーカーのペア";
    return ({ 1: "", 2: "ペア", 3: "トリプル", 4: "4枚（革命）" }[play.n] || play.n + "枚") + (play.n === 1 ? "" : "");
  }
  function table(view, v) {
    const { room } = v,
      g = room.g,
      me = v.me;
    const box = node("div", "df-table-view" + (g?.rev ? " is-revolution" : ""));
    if (!g) {
      box.append(node("p", "df-dealing", "カードを配っています…"));
      view.append(box);
      return;
    }
    // New events since the last drawing: effects.
    if (ui.gNo !== room.gNo) {
      ui.gNo = room.gNo;
      ui.seq = 0;
      ui.selected = [];
      ui.shown = new Set();
    }
    const fresh = Math.min(12, Math.max(0, g.seq - ui.seq)),
      events = ui.seq === 0 && fresh > 4 ? [] : g.log.slice(g.log.length - fresh);
    ui.seq = g.seq;
    const hand = (v.hand?.hand || []).slice().sort((a, b) => D.cardsByStrength(a, b, g.rev)),
      mine = g.ids.includes(me);
    const state = pseudo(g, hand, me);
    const myTurn = g.turn === me && g.phase === "play" && mine;

    // ---- Top bar
    const bar = node("div", "df-bar");
    const info = node("div", "df-info");
    const games = room.settings.games;
    info.append(node("strong", "", "大富豪"), node("small", "", (games > 1 ? "第" + room.gNo + "/" + games + "ゲーム" : "1ゲーム") + (room.settings.practice ? "　練習" : "　" + fmt(room.settings.stake) + "pt")));
    const chipsRow = node("div", "df-state");
    if (g.rev) chipsRow.append(node("span", "df-chip is-rev", "革命中"));
    if (g.lock) chipsRow.append(node("span", "df-chip is-lock", "縛り " + g.lock.map((s) => SUIT_MARK[s]).join("")));
    const help = node("button", "df-help", "?");
    help.type = "button";
    help.setAttribute("aria-label", "ルールを見る");
    help.onclick = () => {
      ui.rules = !ui.rules;
      ui.sig = "";
      render(T.view());
    };
    bar.append(info, chipsRow, help);
    box.append(bar);
    if (ui.rules) {
      const sheet = node("div", "df-rules-sheet");
      sheet.append(rulesBlock());
      sheet.firstChild.open = true;
      box.append(sheet);
    }

    // ---- Felt: the others, the field
    const felt = node("div", "df-felt");
    const others = [];
    const at = g.ids.indexOf(me);
    for (let i = 1; i < g.ids.length; i++) others.push(g.ids[(Math.max(0, at) + i) % g.ids.length]);
    const POS = { 2: ["tl", "tr"], 3: ["l", "t", "r"], 4: ["l", "tl", "tr", "r"] }[others.length] || ["tl", "tr"];
    others.forEach((id, i) => {
      const p = room.players[id] || {};
      const out = g.legal.includes(id) || g.illegal.includes(id) || g.fallen === id;
      const seat = node("div", "df-seat pos-" + POS[i] + (g.turn === id && g.phase === "play" ? " is-turn" : "") + (out ? " is-out" : "") + (p.left ? " is-left" : ""));
      seat.dataset.player = id;
      const head = node("div", "df-seat-head");
      head.append(avatarEl(p, 36));
      const label = node("div", "df-seat-label");
      label.append(node("b", "", p.name || "?"));
      const badge = out ? (g.illegal.includes(id) ? "反則上がり" : g.fallen === id ? "都落ち" : rankLabel(g, id)) : g.passed.includes(id) ? "パス" : p.left ? "離席" : "";
      if (badge) label.append(node("small", out ? "is-rank" : "is-pass", badge));
      head.append(label);
      seat.append(head);
      if (!out) {
        seat.append(backFan(g.counts[id]), node("span", "df-count", g.counts[id] + "枚"));
        if (g.turn === id && g.phase === "play") seat.append(node("i", "df-timer"));
      }
      felt.append(seat);
    });
    // Field
    const field = node("div", "df-center");
    if (g.field) {
      const key = g.field.play.cards.join();
      const stack = node("div", "df-played");
      g.field.play.cards.forEach((code, i) => {
        const isNew = !ui.shown.has(key);
        const c = cardEl(code, { cls: "is-field" + (isNew ? " is-new" : "") });
        c.style.setProperty("--k", i - (g.field.play.cards.length - 1) / 2);
        stack.append(c);
      });
      ui.shown.add(key);
      field.append(stack);
      const by = room.players[g.field.by]?.name || "";
      field.append(node("p", "df-field-note", by + "　" + playText(g.field.play)));
    } else field.append(node("p", "df-field-empty", g.phase === "play" ? (g.turn === me ? "あなたから出します" : (room.players[g.turn]?.name || "") + " から出します") : ""));
    felt.append(field);
    const fx = node("div", "df-fx");
    felt.append(fx);
    box.append(felt);
    for (const e of events) showFx(fx, e, room, g);

    // ---- Me
    const meBar = node("div", "df-me" + (myTurn ? " is-turn" : ""));
    meBar.append(avatarEl(room.players[me], 34));
    const meLabel = node("div", "df-me-label");
    meLabel.append(node("b", "", (room.players[me]?.name || "") + "（あなた）"));
    const myOut = g.legal.includes(me) || g.illegal.includes(me) || g.fallen === me;
    const sub = myOut ? (g.illegal.includes(me) ? "反則上がり" : g.fallen === me ? "都落ち" : rankLabel(g, me)) : g.passed.includes(me) ? "パス中（場が流れるまで出せません）" : myTurn ? "あなたの番です" : g.phase === "exchange" ? "カード交換" : (room.players[g.turn]?.name || "") + " の番";
    meLabel.append(node("small", myTurn ? "is-go" : "", sub));
    meBar.append(meLabel);
    if (myTurn) meBar.append(node("i", "df-timer"));
    box.append(meBar);

    // ---- Hand and buttons
    const handBox = node("div", "df-hand");
    const exchangeNeed = g.phase === "exchange" && g.ex?.waiting.includes(me) ? g.ex.pairs.find((p) => p.high === me) : null;
    const got = new Set(v.hand?.got || []);
    let playable = null;
    if (myTurn && !ui.selected.length) playable = new Set(D.plays(state, me).flat());
    hand.forEach((code, i) => {
      const picked = ui.selected.includes(code);
      const c = cardEl(code, { button: true, cls: (picked ? "is-picked" : "") + (got.has(code) ? " is-got" : "") + (playable && !playable.has(code) ? " is-dim" : "") });
      c.style.setProperty("--n", i);
      c.setAttribute("aria-pressed", String(picked));
      c.onclick = () => pick(code, g, state, hand, me, exchangeNeed);
      handBox.append(c);
    });
    if (!hand.length && !myOut && mine) handBox.append(node("p", "df-dealing", "カードを待っています…"));
    box.append(handBox);
    requestAnimationFrame(() => {
      const w = handBox.clientWidth,
        cw = handBox.querySelector(".df-card")?.offsetWidth || 54,
        n = hand.length;
      if (n > 1) handBox.style.setProperty("--step", Math.max(16, Math.min(cw * 0.72, (w - cw - 12) / (n - 1))) + "px");
    });

    const actions = node("div", "df-actions");
    const msg = node("p", "df-msg");
    if (exchangeNeed) {
      const lowName = room.players[exchangeNeed.low]?.name || "";
      msg.textContent = lowName + " さんに渡すカードを " + exchangeNeed.count + " 枚選んでください（一番強いカードが代わりに届きます）";
      const give = node("button", "df-primary", "渡す（" + ui.selected.length + "/" + exchangeNeed.count + "）");
      give.type = "button";
      give.disabled = ui.selected.length !== exchangeNeed.count;
      give.onclick = async () => {
        sound("confirm");
        const cards = ui.selected.slice();
        ui.selected = [];
        await T.submit("give", cards);
      };
      actions.append(give);
    } else if (g.phase === "exchange") {
      msg.textContent = g.ex?.pairs.some((p) => p.low === me) ? "強いカードが渡されます。上の人がカードを選ぶまで待っています…" : "カードを交換しています…";
    } else if (g.phase === "play" && mine && !myOut) {
      const pass = node("button", "df-ghost", "パス");
      pass.type = "button";
      pass.disabled = !myTurn || !g.field;
      pass.onclick = async () => {
        sound("back");
        ui.selected = [];
        await T.submit("pass");
      };
      const tip = node("button", "df-ghost", "おすすめ");
      tip.type = "button";
      tip.disabled = !myTurn;
      tip.onclick = () => {
        const cards = D.choose(state, me, Math.random);
        sound("tap");
        ui.selected = cards || [];
        if (!cards) say(g.field ? "出さずにパスがよさそうです" : "");
        else {
          ui.sig = "";
          render(T.view());
        }
      };
      const play = node("button", "df-primary", "出す");
      play.type = "button";
      let reason = "";
      const found = ui.selected.length ? D.resolve(state, ui.selected) : null;
      if (ui.selected.length && !found) {
        try {
          D.play({ ...state, turn: me, phase: "play" }, me, ui.selected);
        } catch (error) {
          reason = error.message;
        }
      }
      play.disabled = !myTurn || !found;
      if (found) play.textContent = "出す（" + (playText(found) || rankText(found.rank) + "を1枚") + "）";
      play.onclick = async () => {
        if (!found) return;
        sound("confirm");
        const cards = ui.selected.slice();
        ui.selected = [];
        await T.submit("play", cards);
      };
      actions.append(pass, tip, play);
      const rej = room.rej?.[me];
      msg.textContent = reason || (rej && rej.seq !== ui.rejSeen ? rej.text : "") || (myTurn ? (ui.selected.length ? "" : g.field ? "場より強いカードを選んでください" : "出すカードを選んでください") : "");
      if (rej) ui.rejSeen = rej.seq;
    } else if (g.phase === "play" && myOut) msg.textContent = "上がりました。ほかの人が終わるまで見ていましょう";
    box.append(msg, actions);

    // ---- Results of a game
    if (g.phase === "done") box.append(gameResult(room, g, me));
    view.append(box);
  }
  function rankLabel(g, id) {
    const at = (g.ranking || g.legal).indexOf(id);
    return at >= 0 ? (MEDAL[at] ? MEDAL[at] + " " : "") + D.NAMES[g.n][at] : "";
  }
  function pick(code, g, state, hand, me, exchangeNeed) {
    sound("tap");
    const list = ui.selected;
    if (list.includes(code)) ui.selected = list.filter((c) => c !== code);
    else if (exchangeNeed) ui.selected = list.length < exchangeNeed.count ? [...list, code] : [...list.slice(1), code];
    else {
      const field = g.field?.play;
      // Against a pair or a triple, one tap picks the whole set of that number.
      if (field && field.kind === "set" && field.n > 1 && !D.isJoker(code) && !list.length) {
        const same = hand.filter((c) => !D.isJoker(c) && D.rankOf(c) === D.rankOf(code));
        const jokers = hand.filter(D.isJoker);
        const take = [code, ...same.filter((c) => c !== code), ...jokers].slice(0, field.n);
        ui.selected = take;
      } else ui.selected = [...list, code];
    }
    ui.sig = "";
    render(T.view());
  }

  // ---- Effects ---------------------------------------------------------------------------
  function showFx(layer, e, room, g) {
    const name = (id) => room.players[id]?.name || "";
    let text = "",
      cls = "";
    if (e.t === "play" && e.rev) (text = "革命！"), (cls = "is-rev");
    else if (e.t === "flow" && e.why && e.why !== "全員パス") (text = e.why), (cls = e.why === "8切り" ? "is-cut" : "is-flow");
    else if (e.t === "illegal") (text = name(e.by) + " 反則上がり"), (cls = "is-bad");
    else if (e.t === "fallen") (text = name(e.by) + " 都落ち"), (cls = "is-bad");
    else if (e.t === "out") (text = name(e.by) + " 上がり！"), (cls = "is-out");
    else if (e.t === "pass") return;
    if (!text) return;
    const el = node("div", "df-fx-item " + cls, text);
    layer.append(el);
    sound(e.t === "play" ? "open" : "navigate");
    setTimeout(() => el.remove(), 1700);
  }

  // ---- Timers -------------------------------------------------------------------------
  function tickTimer(v) {
    const room = v?.room;
    if (!room?.deadline || !screen) return;
    const total = (room.settings.think || 30) * 1000,
      left = Math.max(0, room.deadline - Date.now()),
      p = Math.min(1, left / (room.g?.phase === "exchange" ? T.EXCHANGE_MS : total));
    screen.querySelectorAll(".df-timer").forEach((el) => {
      el.style.setProperty("--p", p);
      el.classList.toggle("is-low", left < 6000);
      el.dataset.left = String(Math.ceil(left / 1000));
    });
    const between = screen.querySelector(".df-next");
    if (between && room.betweenAt) between.textContent = "次のゲームまで " + Math.max(0, Math.ceil((room.betweenAt - Date.now()) / 1000)) + " 秒";
  }
  setInterval(() => {
    if (screen && ui) tickTimer(T.view());
  }, 250);

  // ---- Results ---------------------------------------------------------------------------
  function gameResult(room, g, me) {
    const sheet = node("div", "df-result");
    const card = node("div", "df-result-card");
    card.append(node("h3", "", "ゲーム " + room.gNo + " の結果"));
    const list = node("ol", "df-ranking");
    (g.ranking || []).forEach((id, i) => {
      const p = room.players[id] || {};
      const li = node("li", "df-rank-row" + (id === me ? " is-me" : "") + (i === 0 ? " is-first" : ""));
      li.style.setProperty("--d", i * 0.12 + "s");
      li.append(node("span", "df-rank-no", MEDAL[i] || String(i + 1)), avatarEl(p, 30), node("span", "df-rank-name", p.name || ""), node("em", "", D.NAMES[g.n][i]));
      const gain = D.gamePoints(g.n, i + 1, room.settings.games > 1 && room.gNo === room.settings.games);
      li.append(node("strong", "", "+" + gain + "点"));
      list.append(li);
    });
    card.append(list);
    const last = room.gNo >= room.settings.games;
    if (room.settings.games > 1) {
      const totals = room.totals || {};
      card.append(node("p", "df-note", "合計：" + (g.ids.slice().sort((a, b) => (totals[b] || 0) - (totals[a] || 0)).map((id) => (room.players[id]?.name || "") + " " + (totals[id] || 0) + "点").join("　"))));
    }
    card.append(node("p", "df-next", last ? "まもなく最終結果" : ""));
    sheet.append(card);
    return sheet;
  }
  function ending(view, v) {
    const { room } = v,
      me = v.me;
    const box = node("div", "df-lobby df-end");
    if (room.status === "closed") {
      box.append(node("h2", "", "テーブルが閉じられました"), node("p", "df-sub", room.abandoned ? "ゲームの途中で終わったので、ポイントは動いていません。" : ""));
    } else {
      box.append(node("p", "df-kicker", "RESULT"), node("h2", "", "最終結果"));
      const order = room.final?.order || [];
      const list = node("ol", "df-ranking is-final");
      order.forEach((id, i) => {
        const p = room.players[id] || {};
        const li = node("li", "df-rank-row" + (id === me ? " is-me" : "") + (i === 0 ? " is-first" : ""));
        li.style.setProperty("--d", i * 0.12 + "s");
        li.append(node("span", "df-rank-no", MEDAL[i] || String(i + 1)), avatarEl(p, 34), node("span", "df-rank-name", p.name || ""), node("em", "", D.NAMES[order.length][i]));
        if (room.settings.games > 1 && room.totals) li.append(node("strong", "", (room.totals[id] || 0) + "点"));
        list.append(li);
      });
      box.append(list);
      const pays = T.payments(room).pays;
      if (pays.length) {
        const net = pays.reduce((sum, p) => sum + (p.to === me ? p.amount : 0) - (p.from === me ? p.amount : 0), 0);
        const mineNet = node("p", "df-net " + (net > 0 ? "is-plus" : net < 0 ? "is-minus" : ""), (net > 0 ? "+" : net < 0 ? "−" : "±") + fmt(Math.abs(net)) + "pt");
        box.append(mineNet);
        const ul = node("ul", "df-pays");
        for (const p of pays) {
          const li = node("li", p.from === me || p.to === me ? "is-me" : "");
          const done = T.paid(p.id)?.ok;
          li.append(node("span", "", (room.players[p.from]?.name || "") + " → " + (room.players[p.to]?.name || "")), node("strong", "", fmt(p.amount) + "pt"));
          li.append(node("small", done ? "is-done" : "", p.from === me ? (done ? "支払い済み" : "支払い中…") : p.to === me ? "受け取りは自動です" : ""));
          ul.append(li);
        }
        box.append(ul, node("p", "df-note", "足りないポイントはカジノからの借金になります。相手の端末が支払うまで、受け取りが遅れることがあります。"));
      } else box.append(node("p", "df-note", room.settings.practice ? "練習なので、ポイントは動きません。" : "ポイントのやり取りはありません。"));
    }
    const again = node("button", "df-primary", room.settings.practice ? "もう一度練習" : "ロビーに戻る");
    again.type = "button";
    again.onclick = async () => {
      const practiceCount = room.settings.seats;
      const wasPractice = room.settings.practice;
      await T.leave();
      ui.sig = "";
      ui.selected = [];
      ui.gNo = -1;
      if (wasPractice) T.practice(practiceCount);
      else render(T.view());
    };
    const close = node("button", "df-ghost", "閉じる");
    close.type = "button";
    close.onclick = async () => {
      await T.leave();
      closeScreen();
    };
    box.append(again, close, node("p", "df-status", ui.status));
    view.append(box);
  }

  window.Daifugo = Object.freeze({ open, close: () => leave(), _ui: () => ui });
})();
