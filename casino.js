// The casino tab: the points balance as a chip, and four tables to sit at. Poker opens its own
// screen; blackjack, roulette and dice poker are played against the house here.
//
// Logged in with the cloud reachable, a game stakes points: the bet leaves the wallet when the
// round starts and anything won comes back when it ends, each through Poker.settle once per
// round key, so leaving a round half way still costs its bet. Otherwise the same games run on
// practice chips kept on this device.
(function () {
  "use strict";
  const C = window.CasinoModel;
  const MAX_BET = 1000,
    PRACTICE_START = 1000,
    CHIPS = [1, 5, 10, 50, 100];
  const fmt = (n) => Number(n || 0).toLocaleString("ja-JP");
  const signed = (n) => (n > 0 ? "+" + fmt(n) : n < 0 ? "−" + fmt(-n) : "±0");
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const random = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const uid = () => (typeof myId === "string" && myId ? myId : "GUEST-000");
  const later = (ms) => new Promise((resolve) => setTimeout(resolve, calm() ? 0 : ms));

  // ---- Wallet ----------------------------------------------------------------------------
  // Settlements still on their way are counted at once, so a fast second bet sees them.
  let pending = 0;
  const real = () => uid() !== "GUEST-000" && !!window.db && !!window.fbRunTransaction && !!window.Poker?.settle && !window.FirestoreReadGuard?.paused?.();
  const practiceName = () => "aiglish_casino_chips_" + uid();
  function practiceChips() {
    try {
      const saved = localStorage.getItem(practiceName());
      return saved === null ? PRACTICE_START : Math.max(0, Number(saved) || 0);
    } catch {
      return PRACTICE_START;
    }
  }
  function setPractice(value) {
    try {
      localStorage.setItem(practiceName(), String(Math.max(0, Math.round(value))));
    } catch {}
  }
  const balance = () => (real() ? Math.max(0, (window.StudyPoints?.balance() || 0) + pending) : practiceChips());
  const unit = () => (real() ? "pt" : "枚");
  // Today's running total (Japan time), kept apart for points and practice chips.
  const todayName = () => "aiglish_casino_today_" + uid() + (real() ? "" : "_practice");
  const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  function todayNet() {
    try {
      const saved = JSON.parse(localStorage.getItem(todayName()) || "null");
      return saved && saved.day === today() ? Number(saved.net) || 0 : 0;
    } catch {
      return 0;
    }
  }
  function addToday(delta) {
    try {
      localStorage.setItem(todayName(), JSON.stringify({ day: today(), net: todayNet() + delta }));
    } catch {}
  }
  function move(key, delta) {
    if (!delta) return;
    addToday(delta);
    if (!real()) return setPractice(practiceChips() + delta);
    pending += delta;
    window.Poker.settle(key, delta).finally(() => {
      pending -= delta;
      refresh();
    });
  }
  // A round: take the bet now, pay out when it ends (the bet back plus what was won).
  function round(game) {
    const key = "casino:" + game + ":" + Date.now().toString(36) + random(1e6).toString(36);
    return {
      // Each part of a round is its own key, so a double or a split after the bet is taken too.
      stake: (bet, part = "bet") => move(key + ":" + part, -bet),
      pay: (amount) => move(key + ":pay", amount),
    };
  }

  // ---- Pictures --------------------------------------------------------------------------
  const CHIP_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true" class="cs-chip-svg"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="5.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M12 2v3.6M12 18.4V22M2 12h3.6M18.4 12H22M4.9 4.9l2.5 2.5M16.6 16.6l2.5 2.5M4.9 19.1l2.5-2.5M16.6 7.4l2.5-2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const PICTURES = {
    poker: '<svg viewBox="0 0 64 48" aria-hidden="true"><rect x="12" y="6" width="22" height="32" rx="3" transform="rotate(-12 23 22)" class="is-card"/><rect x="28" y="8" width="22" height="32" rx="3" transform="rotate(10 39 24)" class="is-card"/><path d="M39 17c-3 4-6 5-6 8a3 3 0 0 0 5 2l-1 4h4l-1-4a3 3 0 0 0 5-2c0-3-3-4-6-8z" class="is-ink" transform="rotate(10 39 24)"/></svg>',
    blackjack: '<svg viewBox="0 0 64 48" aria-hidden="true"><rect x="14" y="8" width="22" height="32" rx="3" class="is-card"/><rect x="28" y="8" width="22" height="32" rx="3" class="is-card"/><text x="19" y="22" class="is-ink">A</text><text x="33" y="22" class="is-red">K</text></svg>',
    roulette: '<svg viewBox="0 0 64 48" aria-hidden="true"><circle cx="32" cy="24" r="19" class="is-rim"/><circle cx="32" cy="24" r="14" fill="none" stroke-dasharray="5.5 5.5" class="is-pockets"/><circle cx="32" cy="24" r="6" class="is-hub"/><circle cx="32" cy="9" r="2.6" class="is-ball"/></svg>',
    chinchiro: '<svg viewBox="0 0 64 48" aria-hidden="true"><ellipse cx="32" cy="30" rx="26" ry="13" class="is-bowl"/><ellipse cx="32" cy="27" rx="21" ry="8" class="is-bowl-in"/><rect x="16" y="20" width="10" height="10" rx="2.5" class="is-die"/><rect x="28" y="18" width="10" height="10" rx="2.5" class="is-die"/><rect x="40" y="21" width="10" height="10" rx="2.5" class="is-die"/><g class="is-pip"><circle cx="21" cy="25" r="1.6"/><circle cx="31" cy="21" r="1.4"/><circle cx="35" cy="25" r="1.4"/><circle cx="43" cy="24" r="1.4"/><circle cx="47" cy="28" r="1.4"/><circle cx="45" cy="26" r="1.4"/></g></svg>',
    dice: '<svg viewBox="0 0 64 48" aria-hidden="true"><rect x="10" y="14" width="22" height="22" rx="5" transform="rotate(-10 21 25)" class="is-die"/><rect x="32" y="10" width="22" height="22" rx="5" transform="rotate(8 43 21)" class="is-die"/><g class="is-pip" transform="rotate(-10 21 25)"><circle cx="16" cy="19" r="2"/><circle cx="21" cy="25" r="2"/><circle cx="26" cy="31" r="2"/></g><g class="is-pip" transform="rotate(8 43 21)"><circle cx="38" cy="15" r="2"/><circle cx="48" cy="15" r="2"/><circle cx="38" cy="27" r="2"/><circle cx="48" cy="27" r="2"/></g></svg>',
  };
  const GAMES = [
    { id: "poker", name: "ポーカー", line: "みんなやコンピュータと", level: "じっくり" },
    { id: "blackjack", name: "ブラックジャック", line: "21に近いほうが勝ち", level: "ふつう" },
    { id: "roulette", name: "ルーレット", line: "止まる数字を当てる", level: "かんたん" },
    { id: "dice", name: "ダイスポーカー", line: "5つのダイスで役をつくる", level: "かんたん" },
    { id: "chinchiro", name: "チンチロ", line: "どんぶりに3つのサイコロ", level: "かんたん" },
  ];

  // ---- The tab ---------------------------------------------------------------------------
  function mount() {
    const host = document.getElementById("view-casino");
    if (!host) return;
    if (!host.childElementCount) {
      host.innerHTML =
        '<section class="casino" aria-label="カジノ"><header class="casino-head"><span class="casino-chip">' +
        CHIP_SVG +
        '</span><div><small data-casino-unit></small><strong data-casino-balance></strong></div><p class="casino-today" data-casino-today></p></header><div class="casino-games"></div><p class="casino-note"></p></section>';
      const list = host.querySelector(".casino-games");
      for (const game of GAMES) {
        const button = node("button", "casino-game mode-" + game.id);
        button.type = "button";
        button.dataset.game = game.id;
        button.innerHTML = '<span class="casino-pic">' + PICTURES[game.id] + "</span>";
        button.append(node("em", "casino-level is-" + (game.level === "かんたん" ? "easy" : game.level === "ふつう" ? "mid" : "deep"), game.level), node("b", "", game.name), node("small", "", game.line));
        button.onclick = () => (game.id === "poker" ? window.Poker?.open() : open(game.id));
        list.append(button);
      }
    }
    refresh();
  }
  function refresh() {
    const host = document.getElementById("view-casino");
    if (host?.childElementCount) {
      host.querySelector("[data-casino-unit]").textContent = real() ? "所持ポイント" : "練習チップ";
      host.querySelector("[data-casino-balance]").textContent = fmt(balance()) + unit();
      const net = todayNet();
      host.querySelector("[data-casino-today]").textContent = net ? "今日 " + signed(net) + unit() : "";
      host.querySelector(".casino-note").textContent = real()
        ? "ブラックジャック・ルーレット・ダイスポーカーは1回" + fmt(MAX_BET) + "ptまで賭けられます。"
        : "ゲストやオフラインのときは練習チップで遊べます（ポイントは増減しません）。";
    }
    // While the wheel turns the balance already holds the result; it shows once the wheel stops.
    if (!screen?.querySelector(".cs-body.is-spinning")) showBalance(screen?.querySelector("[data-cs-balance]"));
  }

  // The number runs to its new value and flashes up or down, so a win or a bet is felt.
  function showBalance(el) {
    if (!el) return;
    const to = balance(),
      from = Number(el.dataset.value);
    el.dataset.value = String(to);
    clearInterval(el._tick);
    if (!Number.isFinite(from) || from === to || calm()) return void (el.textContent = fmt(to) + unit());
    el.classList.remove("is-up", "is-down");
    void el.offsetWidth;
    el.classList.add(to > from ? "is-up" : "is-down");
    let step = 0;
    el._tick = setInterval(() => {
      step++;
      el.textContent = fmt(Math.round(from + ((to - from) * step) / 12)) + unit();
      if (step >= 12) clearInterval(el._tick);
    }, 30);
  }
  // ---- Game screen -----------------------------------------------------------------------
  let screen = null,
    game = null;
  function open(id) {
    close();
    const info = GAMES.find((g) => g.id === id);
    screen = node("dialog", "casino-screen is-" + id);
    screen.setAttribute("aria-label", info.name);
    screen.innerHTML =
      '<button type="button" class="cs-close" aria-label="' +
      info.name +
      'を閉じる">×</button><header class="cs-bar"><div><h2></h2></div><p class="cs-balance"><span class="cs-coin">' +
      CHIP_SVG +
      '</span><span data-cs-balance></span></p></header><div class="cs-body"></div>';
    screen.querySelector("h2").textContent = info.name;
    screen.querySelector(".cs-close").onclick = close;
    screen.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });
    document.body.append(screen);
    document.body.classList.add("casino-open");
    screen.showModal();
    game = { id, body: screen.querySelector(".cs-body") };
    ({ blackjack, roulette, dice, chinchiro })[id](game.body);
    refresh();
  }
  function close() {
    leaveDuel();
    leaveGroup();
    if (game?.timer) clearTimeout(game.timer);
    game = null;
    if (screen?.open) screen.close();
    screen?.remove();
    screen = null;
    document.body.classList.remove("casino-open");
    refresh();
  }

  // The amount to bet: chips add up, the last bet is kept for the next round.
  const lastBet = {};
  function betBar(id, label, onPlay) {
    const bar = node("div", "cs-betbar");
    let bet = Math.min(lastBet[id] || 10, cap());
    const amount = node("output", "cs-bet");
    const chips = node("div", "cs-chips");
    for (const value of CHIPS) {
      const chip = node("button", "cs-chip-btn", "+" + fmt(value));
      chip.type = "button";
      chip.dataset.chip = value;
      chip.onclick = () => {
        bet = Math.min(cap(), bet + value);
        draw();
      };
      chips.append(chip);
    }
    const clear = node("button", "cs-clear", "0に戻す");
    clear.type = "button";
    clear.onclick = () => {
      bet = 0;
      draw();
    };
    const play = node("button", "cs-primary", label);
    play.type = "button";
    play.dataset.csPlay = "";
    play.onclick = () => {
      if (bet <= 0 || bet > balance()) return draw();
      lastBet[id] = bet;
      onPlay(bet);
    };
    const row = node("div", "cs-bet-row");
    row.append(node("span", "", "賭ける"), amount, clear);
    bar.append(row, chips, play);
    if (real() && balance() <= 0) bar.append(node("p", "cs-hint", "賭けられるポイントがありません。単語カードや苦手復習でポイントがたまります。"));
    if (!real() && balance() <= 0) {
      const reset = node("button", "cs-reset", "練習チップを" + fmt(PRACTICE_START) + "枚に戻す");
      reset.type = "button";
      reset.onclick = () => {
        setPractice(PRACTICE_START);
        refresh();
        bet = 10;
        draw();
        reset.remove();
      };
      bar.append(reset);
    }
    function draw() {
      bet = Math.max(0, Math.min(bet, cap()));
      amount.textContent = fmt(bet) + unit();
      play.disabled = bet <= 0;
      chips.querySelectorAll("button").forEach((b) => (b.disabled = bet + Number(b.dataset.chip) > cap() && bet >= cap()));
    }
    draw();
    return bar;
  }
  const cap = () => Math.min(MAX_BET, balance());
  function result(text, net, tone) {
    const line = node("p", "cs-result is-" + (tone || (net > 0 ? "win" : net < 0 ? "lose" : "push")));
    line.setAttribute("role", "status");
    line.append(node("span", "", text), node("b", "", signed(net) + unit()));
    if (net > 0 && !calm()) {
      const burst = node("span", "cs-burst");
      burst.setAttribute("aria-hidden", "true");
      for (let i = 0; i < 10; i++) {
        const chip = node("i");
        chip.style.setProperty("--a", i * 36 + "deg");
        burst.append(chip);
      }
      line.append(burst);
    }
    return line;
  }
  // Only the rare wins get the full-screen moment, so ordinary rounds stay quiet.
  function bigWin(word, net, sub, delay) {
    if (!window.Ceremony || net <= 0) return;
    setTimeout(() => screen && window.Ceremony.play({ style: "chips", result: true, count: net, from: 0, suffix: unit(), word, sub, tone: "gold" }), calm() ? 0 : delay);
  }
  const rules = (summary, lines) => {
    const box = node("details", "cs-rules");
    box.append(node("summary", "", summary));
    const list = node("ul");
    for (const text of lines) list.append(node("li", "", text));
    box.append(list);
    return box;
  };

  // ---- Blackjack -------------------------------------------------------------------------
  // ---- Blackjack: one table view for alone and together -----------------------------------
  // Cards come out one at a time in the order they were dealt (round the table, then the dealer),
  // and the dealer's cards after everyone has played. `seen` remembers what was already shown.
  const MOVE_WORDS = {
    hit: ["ヒット", "もう1枚"],
    stand: ["スタンド", "これで勝負"],
    double: ["ダブル", "賭け2倍で1枚"],
    split: ["スプリット", "2つの手に分ける"],
  };
  const OUTCOME_WORDS = { blackjack: "ブラックジャック", win: "勝ち", push: "引き分け", lose: "負け", bust: "21超え" };
  function bjFelt(t, me, nameFor, seen) {
    const felt = node("div", "cs-felt cs-bj");
    const fresh = !seen.round || seen.round !== t.dealtAt;
    if (fresh) {
      for (const k of Object.keys(seen)) delete seen[k];
      seen.round = t.dealtAt;
    }
    const queue = [];
    const cardsRow = (key, cards) => {
      const row = node("div", "cs-cards");
      const before = seen[key] || 0;
      cards.forEach((c, i) => {
        const el = window.Poker.card(c);
        if (i >= before && !calm()) queue.push({ el, key, i });
        row.append(el);
      });
      seen[key] = cards.length;
      return row;
    };
    const label = (who, total, cls) => {
      const l = node("p", "cs-hand-label" + (cls ? " " + cls : ""));
      l.append(node("span", "", who));
      if (total) l.append(node("b", "", total));
      return l;
    };
    const dealer = node("div", "cs-hand is-dealer");
    const dealerTotal = C.bjTotal(t.dealer).total;
    const dealerRow = cardsRow("dealer", t.dealer);
    // Until everyone has played the dealer has one card; the face-down one only marks the place.
    if (!t.done) dealerRow.append(window.Poker.card(null));
    dealer.append(label("ディーラー", t.done ? String(dealerTotal) : dealerTotal + "（2枚目はみんなのあと）"), dealerRow);
    felt.append(dealer);
    for (const id of t.order) {
      const seat = t.seats[id];
      const box = node("div", "cs-hand is-player cs-seat" + (id === me ? " is-me" : "") + (t.turn === id ? " is-turn" : ""));
      seat.hands.forEach((h, i) => {
        const total = C.bjTotal(h.cards).total;
        const out = t.done ? C.tableOutcome(t, id).results[i] : null;
        const who = (i === 0 ? nameFor(id) : "") + (seat.hands.length > 1 ? "　手" + (i + 1) : "") + "（" + fmt(h.bet * (h.doubled ? 2 : 1)) + "）";
        const hand = node("div", "cs-seat-hand" + (t.turn === id && seat.active === i ? " is-active" : ""));
        hand.append(label(who, String(total) + (out ? "・" + OUTCOME_WORDS[out.outcome] : ""), out ? "is-" + out.outcome : ""), cardsRow(id + ":" + i, h.cards));
        box.append(hand);
      });
      felt.append(box);
    }
    // The order cards come out in: a fresh deal goes round the table twice with the dealer between.
    if (fresh) {
      const rank = (q) => (q.key === "dealer" ? (q.i === 0 ? t.order.length : 1000 + q.i) : q.i === 0 ? t.order.indexOf(q.key.split(":")[0]) : t.order.length + 1 + t.order.indexOf(q.key.split(":")[0]) + q.i * 10);
      queue.sort((a, b) => rank(a) - rank(b));
    } else queue.sort((a, b) => (a.key === "dealer") - (b.key === "dealer"));
    queue.forEach((q, k) => {
      q.el.classList.add("cs-deal");
      q.el.style.setProperty("--d", (k * 0.38).toFixed(2) + "s");
    });
    felt.dataset.dealTime = String(queue.length * 0.38);
    return felt;
  }
  // The buttons for my turn, with the usual move marked and why.
  function bjActions(t, me, onMove) {
    const box = node("div", "cs-bj-actions");
    const row = node("div", "cs-actions cs-moves");
    const buttons = {};
    for (const move of ["hit", "stand", "double", "split"]) {
      if ((move === "double" || move === "split") && !C.tableCan(t, me, move)) continue;
      const b = node("button", move === "stand" ? "cs-primary" : "");
      b.type = "button";
      b.dataset.move = move;
      b.append(node("b", "", MOVE_WORDS[move][0]), node("small", "", MOVE_WORDS[move][1]));
      const cost = C.tableCost(t, me, move);
      b.disabled = cost > balance();
      b.onclick = () => {
        row.querySelectorAll("button").forEach((x) => (x.disabled = true));
        onMove(move, cost);
      };
      buttons[move] = b;
      row.append(b);
    }
    const seat = t.seats[me],
      h = seat.hands[seat.active];
    const tip = advice({ player: h.cards, dealer: t.dealer }, !!buttons.double && !buttons.double.disabled, !!buttons.split && !buttons.split.disabled);
    buttons[tip.move]?.classList.add("is-suggested");
    box.append(row, node("p", "cs-advice", (seat.hands.length > 1 ? "手" + (seat.active + 1) + "：" : "") + "迷ったら「" + MOVE_WORDS[tip.move][0] + "」：" + tip.why));
    return box;
  }
  function bjResultLine(out) {
    if (!out) return null;
    const best = out.results.map((r) => r.outcome);
    const text = best.length > 1 ? best.map((o, i) => "手" + (i + 1) + " " + OUTCOME_WORDS[o]).join("・") : { blackjack: "ブラックジャック！", win: "あなたの勝ち", push: "引き分け（賭けは戻ります）", lose: "ディーラーの勝ち", bust: "21を超えました" }[best[0]];
    return result(text, out.net, best.includes("blackjack") && out.net > 0 ? "win" : "");
  }
  function blackjack(body, state = null) {
    body.replaceChildren();
    const start = (bet) => {
      const money = round("blackjack");
      money.stake(bet);
      const t = C.tableDeal(["me"], { me: bet }, random);
      t.dealtAt = Date.now();
      blackjack(body, { t, bet, money, seen: {}, extras: 0 });
    };
    if (!state) {
      const table = node("div", "cs-felt cs-bj");
      const empty = (who) => {
        const seat = node("div", "cs-hand");
        const l = node("p", "cs-hand-label");
        l.append(node("span", "", who));
        const row = node("div", "cs-cards");
        row.append(window.Poker.card(null), window.Poker.card(null));
        seat.append(l, row);
        return seat;
      };
      table.append(empty("ディーラー"), empty("あなた"));
      body.append(
        modeSwitch(body, "dealer", "blackjack"),
        table,
        betBar("blackjack", "配る", start),
        rules("ブラックジャックの遊び方", [
          "カードの合計を21に近づけます。21を超えたら負けです。絵札は10、Aは1か11で数えます。",
          "ディーラーは最初1枚だけ。みんなが終わってから、17以上になるまで1枚ずつ引きます。",
          "ヒットでもう1枚、スタンドでそこで勝負。勝つと賭けた分がもらえ、最初の2枚で21（ブラックジャック）なら1.5倍です。",
          "ダブル：賭けを2倍にして、あと1枚だけ引きます。",
          "スプリット：同じ数の2枚を2つの手に分けて、それぞれ勝負します（賭けがもう1つ分かかります）。Aを分けたときは1枚ずつです。",
        ]),
      );
      return refresh();
    }
    const { t } = state;
    const felt = bjFelt(t, "me", () => "あなた", state.seen);
    body.append(modeSwitch(body, "dealer", "blackjack"), felt);
    if (!t.done) {
      body.append(
        bjActions(t, "me", (move, cost) => {
          if (cost) state.money.stake(cost, move + (++state.extras));
          state.t = C.tableAct(t, "me", move);
          state.t.dealtAt = t.dealtAt;
          blackjack(body, state);
        }),
      );
      return refresh();
    }
    const out = C.tableOutcome(t, "me");
    if (!state.paid) {
      state.paid = true;
      if (out.stake + out.net > 0) state.money.pay(out.stake + out.net);
      if (out.results.some((r) => r.outcome === "blackjack") && out.net > 0) bigWin("BLACKJACK", out.net, "最初の2枚で21", 700 + Number(felt.dataset.dealTime) * 1000);
    }
    const line = bjResultLine(out);
    line.style.setProperty("--d", (Number(felt.dataset.dealTime) + 0.2).toFixed(2) + "s");
    body.append(line, betBar("blackjack", "もう一度配る", start));
    refresh();
  }
  function advice(state, canDouble, canSplit) {
    const mine = C.bjTotal(state.player),
      up = C.bjTotal([state.dealer[0]]).total,
      pair = state.player.length === 2 && state.player[0][0] === state.player[1][0] ? state.player[0][0] : "";
    if (canSplit && (pair === "A" || pair === "8")) return { move: "split", why: pair === "A" ? "Aは分けると、それぞれ21を狙えます" : "8が2枚の16は弱い手。分けたほうが勝ちやすくなります" };
    if (canDouble && (mine.total === 11 || (mine.total === 10 && up <= 9)) && !mine.soft) return { move: "double", why: "次に10点札が来やすい、勝負どころです" };
    if (mine.total <= 11) return { move: "hit", why: "11以下なら、引いても21を超えません" };
    if (mine.soft && mine.total <= 17) return { move: "hit", why: "Aを1と数え直せるので、超えにくい手です" };
    if (mine.total >= 17) return { move: "stand", why: "17以上は、引くと超えやすくなります" };
    if (up >= 7) return { move: "hit", why: "ディーラーの見えている札が強めです" };
    return { move: "stand", why: "ディーラーの札が弱め。相手が21を超えるのを待ちます" };
  }

  // ---- Roulette --------------------------------------------------------------------------
  function wheelSvg() {
    const step = 360 / 37,
      parts = [];
    C.WHEEL.forEach((n, i) => {
      const a0 = ((i * step - step / 2 - 90) * Math.PI) / 180,
        a1 = ((i * step + step / 2 - 90) * Math.PI) / 180,
        r = 96,
        p = (a, rr) => (100 + rr * Math.cos(a)).toFixed(2) + " " + (100 + rr * Math.sin(a)).toFixed(2);
      parts.push('<path class="is-' + C.colourOf(n) + '" d="M100 100 L' + p(a0, r) + " A" + r + " " + r + " 0 0 1 " + p(a1, r) + ' Z"/>');
      const mid = (i * step - 90) * (Math.PI / 180);
      parts.push('<text x="' + (100 + 82 * Math.cos(mid)).toFixed(1) + '" y="' + (100 + 82 * Math.sin(mid)).toFixed(1) + '" transform="rotate(' + (i * step).toFixed(1) + " " + (100 + 82 * Math.cos(mid)).toFixed(1) + " " + (100 + 82 * Math.sin(mid)).toFixed(1) + ')">' + n + "</text>");
    });
    return '<svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="99" class="is-rim"/><g class="cs-wheel-spin">' + parts.join("") + '<circle cx="100" cy="100" r="62" class="is-inner"/><circle cx="100" cy="100" r="14" class="is-hub"/></g></svg>';
  }
  // The table as it is printed on felt: 0 on the left, three rows of twelve numbers (3, 6 … 36
  // on top), the row bets on the right, the dozens and the even-money bets underneath.
  // `spot(on, label, cls)` makes each button, so solo and shared tables place chips their own way.
  function rouletteBoard(spotButton) {
    const board = node("div", "cs-board");
    const place = (b, column, row) => {
      b.style.gridColumn = column;
      b.style.gridRow = row;
      board.append(b);
      return b;
    };
    place(spotButton("0", "0", "is-zero"), "1", "1 / 4");
    for (let n = 1; n <= 36; n++) {
      const b = spotButton(String(n), "", "is-num");
      b.append(node("span", "cs-pip is-" + C.colourOf(n), String(n)));
      place(b, String(Math.ceil(n / 3) + 1), String(3 - ((n - 1) % 3)));
    }
    // What each outside bet pays back, so a beginner can weigh them at a glance.
    const outside = (on, text, column, row, cls) => {
      const b = place(spotButton(on, text, "is-outside " + (cls || "")), column, row);
      b.setAttribute("aria-label", C.SPOTS[on].label + "（" + (C.SPOTS[on].pays + 1) + "倍）");
      b.append(node("small", "cs-pays", C.SPOTS[on].pays + 1 + "倍"));
    };
    outside("c3", "列", "14", "1");
    outside("c2", "列", "14", "2");
    outside("c1", "列", "14", "3");
    outside("d1", "1〜12", "2 / 6", "4");
    outside("d2", "13〜24", "6 / 10", "4");
    outside("d3", "25〜36", "10 / 14", "4");
    outside("low", "1〜18", "2 / 4", "5");
    outside("even", "偶数", "4 / 6", "5");
    outside("red", "赤", "6 / 8", "5", "is-red");
    outside("black", "黒", "8 / 10", "5", "is-black");
    outside("odd", "奇数", "10 / 12", "5");
    outside("high", "19〜36", "12 / 14", "5");
    return board;
  }
  // A chip picker: five chip sizes, one pressed.
  function chipPicker(onPick, chosen) {
    const row = node("div", "cs-chips cs-chip-pick");
    row.setAttribute("aria-label", "置くチップ");
    for (const value of CHIPS) {
      const b = node("button", "cs-chip-btn", fmt(value));
      b.type = "button";
      b.setAttribute("aria-pressed", String(value === chosen));
      b.onclick = () => {
        onPick(value);
        row.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      };
      row.append(b);
    }
    return row;
  }
  // The wheel: spinTo(n) turns it so pocket n stops under the pointer; land(n) shows the number.
  function makeWheel() {
    const wheel = node("div", "cs-wheel");
    wheel.innerHTML = wheelSvg() + '<span class="cs-pointer" aria-hidden="true"></span><output class="cs-landed" aria-live="polite"></output>';
    let turned = 0;
    return {
      el: wheel,
      spinTo(number) {
        const index = C.WHEEL.indexOf(number);
        turned += 360 * 5 + ((360 - ((index * 360) / 37 + (turned % 360))) % 360 + 360) % 360;
        wheel.querySelector(".cs-wheel-spin").style.transform = "rotate(" + turned + "deg)";
        wheel.querySelector(".cs-landed").textContent = "";
      },
      land(number) {
        const landed = wheel.querySelector(".cs-landed");
        landed.textContent = String(number);
        landed.className = "cs-landed is-" + C.colourOf(number);
      },
    };
  }
  function roulette(body) {
    body.replaceChildren();
    const bets = new Map();
    let chip = 10,
      spinning = false;
    const wheelBox = makeWheel(),
      wheel = wheelBox.el;
    const spotButton = (on, label, cls) => {
      const b = node("button", "cs-spot " + (cls || ""), label);
      b.type = "button";
      b.dataset.on = on;
      b.onclick = () => {
        if (spinning) return;
        const total = [...bets.values()].reduce((a, v) => a + v, 0);
        const add = Math.min(chip, cap() - total);
        if (add <= 0) return status("これ以上は賭けられません（1回" + fmt(cap()) + unit() + "まで）");
        bets.set(on, (bets.get(on) || 0) + add);
        draw();
      };
      return b;
    };
    const board = rouletteBoard(spotButton);
    const chipRow = chipPicker((value) => (chip = value), chip);
    const total = node("p", "cs-hint");
    const message = node("div", "cs-result-slot");
    const recent = node("div", "cs-recent");
    recent.setAttribute("aria-label", "最近の数字");
    const history = [];
    const actions = node("div", "cs-actions");
    const clear = node("button", "", "賭けを外す");
    clear.type = "button";
    clear.onclick = () => {
      if (spinning) return;
      bets.clear();
      draw();
    };
    const spin = node("button", "cs-primary", "回す");
    spin.type = "button";
    spin.dataset.csPlay = "";
    spin.onclick = async () => {
      const staked = [...bets.values()].reduce((a, v) => a + v, 0);
      if (spinning || !staked || staked > balance()) return;
      spinning = true;
      body.classList.add("is-spinning");
      board.querySelectorAll(".is-hit").forEach((b) => b.classList.remove("is-hit"));
      draw();
      const money = round("roulette");
      money.stake(staked);
      showBalance(screen.querySelector("[data-cs-balance]"));
      const number = C.rouletteSpin(random);
      // Several turns, ending with the winning pocket under the pointer at the top.
      wheelBox.spinTo(number);
      message.replaceChildren();
      // Paid as soon as the number is drawn, so closing during the spin never loses a win.
      const outcome = C.rouletteSettle([...bets].map(([on, amount]) => ({ on, amount })), number);
      const back = outcome.lines.filter((l) => l.won).reduce((a, l) => a + l.amount + l.net, 0);
      if (back > 0) money.pay(back);
      await later(3600);
      if (!screen || game?.body !== body) return;
      wheelBox.land(number);
      board.querySelectorAll(".cs-spot").forEach((b) => b.classList.toggle("is-hit", !!C.spot(b.dataset.on)?.hit(number)));
      const colour = { red: "赤", black: "黒", green: "緑" }[outcome.colour];
      if (outcome.lines.some((l) => l.won && /^\d+$/.test(l.on))) bigWin("HIT", outcome.net, number + " ぴったり", 400);
      message.replaceChildren(result(number + "（" + colour + "）" + (outcome.net > 0 ? " 当たり" : outcome.lines.some((l) => l.won) ? " 一部当たり" : " はずれ"), outcome.net));
      history.unshift(number);
      recent.replaceChildren(...history.slice(0, 8).map((n) => node("i", "is-" + C.colourOf(n), String(n))));
      spinning = false;
      body.classList.remove("is-spinning");
      // The same bets stay on the table for another spin, as long as they can still be paid.
      if ([...bets.values()].reduce((a, v) => a + v, 0) > balance()) bets.clear();
      draw();
      refresh();
    };
    actions.append(clear, spin);
    const status = (text) => {
      total.textContent = text;
    };
    function draw() {
      const sum = [...bets.values()].reduce((a, v) => a + v, 0);
      board.querySelectorAll(".cs-spot").forEach((b) => {
        const amount = bets.get(b.dataset.on) || 0;
        b.querySelector(".cs-stake")?.remove();
        if (amount) b.append(node("i", "cs-stake", fmt(amount)));
      });
      total.textContent = sum ? "賭けた合計 " + fmt(sum) + unit() : "数字や色をタップしてチップを置きます（初めてなら赤か黒）";
      spin.disabled = spinning || !sum || sum > balance();
      clear.disabled = spinning || !sum;
    }
    const stage = node("div", "cs-stage");
    const side = node("div", "cs-stage-side");
    side.append(message, recent);
    stage.append(wheel, side);
    body.classList.add("is-roulette-body");
    body.append(
      modeSwitch(body, "dealer", "roulette"),
      stage,
      chipRow,
      board,
      total,
      actions,
      rules("ルーレットの遊び方", [
        "玉が止まる場所を予想してチップを置きます。いくつ置いても構いません。",
        "数字1つを当てると36倍（賭けた分＋35倍）。",
        "右の「列」は横一列の12個、1〜12などは12個の組で、どちらも3倍で戻ります。",
        "赤・黒・奇数・偶数・1〜18・19〜36は2倍で戻ります。",
        "0は数字に賭けたときだけ当たりです。",
      ]),
    );
    draw();
  }

  // ---- Dice poker ------------------------------------------------------------------------
  const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  function die(value, cls) {
    const el = node("span", "cs-die " + (cls || ""));
    el.dataset.value = value;
    for (let i = 1; i <= 9; i++) el.append(node("i", PIPS[value].includes(i) ? "is-on" : ""));
    return el;
  }
  const handName = (dice) => {
    const category = C.diceScore(dice)[0];
    return C.DICE_NAMES[category] + "（" + C.DICE_PLAIN[category] + "）";
  };
  function dice(body, state = null, rolled = null) {
    body.replaceChildren();
    const felt = node("div", "cs-felt cs-dice-table");
    const dealer = node("div", "cs-hand is-dealer");
    const dealerLine = node("p", "cs-hand-label");
    dealerLine.append(node("span", "", "ディーラー"));
    const dealerDice = node("div", "cs-dice");
    if (state?.done) {
      dealerLine.append(node("b", "", handName(state.dealer)));
      state.dealer.forEach((v, i) => {
        const el = die(v, "is-rolling");
        el.style.setProperty("--d", 0.15 * i + "s");
        dealerDice.append(el);
      });
    } else for (let i = 0; i < 5; i++) dealerDice.append(node("span", "cs-die is-empty"));
    dealer.append(dealerLine, dealerDice);
    const me = node("div", "cs-hand is-player");
    const myLine = node("p", "cs-hand-label");
    myLine.append(node("span", "", "あなた"));
    const myDice = node("div", "cs-dice");
    const suggest = state && !state.done && state.rolls < 3 ? C.dealerKeeps(state.dice) : null;
    if (state) {
      myLine.append(node("b", "", handName(state.dice)));
      state.dice.forEach((v, i) => {
        const b = node("button", "cs-die-btn");
        b.type = "button";
        b.setAttribute("aria-pressed", String(state.held[i]));
        b.setAttribute("aria-label", v + "の目" + (state.held[i] ? "（キープ中）" : ""));
        const face = die(v, rolled?.[i] ? "is-rolling" : "");
        face.style.setProperty("--d", 0.06 * i + "s");
        b.append(face, node("small", "", state.held[i] && !state.done ? "キープ" : ""));
        b.disabled = state.done || state.rolls >= 3;
        if (suggest?.[i] && !state.held[i]) b.classList.add("is-suggested");
        b.onclick = () => {
          const next = C.diceToggle(state, i);
          next.money = state.money;
          dice(body, next, null);
        };
        myDice.append(b);
      });
    } else for (let i = 0; i < 5; i++) myDice.append(node("span", "cs-die is-empty"));
    me.append(myLine, myDice);
    felt.append(dealer, me);
    body.append(felt);
    const start = (bet) => {
      const money = round("dice");
      money.stake(bet);
      const first = C.diceStart(bet, random);
      first.money = money;
      dice(body, first, [true, true, true, true, true]);
    };
    if (!state) {
      body.append(
        modeSwitch(body, "dealer", "dice"),
        betBar("dice", "ダイスを振る", start),
        rules("ダイスポーカーの遊び方", [
          "5つのダイスを振り、残したいダイスをタップして「キープ」します。",
          "キープしていないダイスを、あと2回まで振り直せます。",
          "「これで勝負」のあとディーラーも同じように振り、強い役のほうが勝ちです。",
          "勝つと賭けた分がもらえ、同じ役と目なら引き分けです。",
          "役の強さ：" + C.DICE_NAMES.slice(1).reverse().join(" ＞ "),
        ]),
      );
      return refresh();
    }
    if (!state.done) {
      const left = 3 - state.rolls;
      const actions = node("div", "cs-actions");
      const again = node("button", "", left ? "振り直す（あと" + left + "回）" : "もう振れません");
      again.type = "button";
      again.disabled = !C.diceCanRoll(state);
      again.onclick = () => {
        const next = C.diceReroll(state, random);
        next.money = state.money;
        dice(body, next, state.held.map((h) => !h));
      };
      const stand = node("button", "cs-primary", "これで勝負");
      stand.type = "button";
      stand.onclick = () => {
        const done = C.diceStand(state, random);
        done.money = state.money;
        if (done.bet + done.net > 0) done.money.pay(done.bet + done.net);
        const made = C.diceScore(done.dice)[0];
        if (done.outcome === "win" && made >= 6) bigWin(made === 7 ? "FIVE DICE" : "FOUR DICE", done.net, C.DICE_NAMES[made], 1100);
        dice(body, done, null);
      };
      actions.append(again, stand);
      body.append(actions);
      if (left && suggest?.some((k, i) => k && !state.held[i])) {
        const keep = node("button", "cs-advice-btn", "おすすめのダイスをキープ");
        keep.type = "button";
        keep.onclick = () => {
          const next = { ...JSON.parse(JSON.stringify({ ...state, money: null })), held: suggest.slice(), money: state.money };
          dice(body, next, null);
        };
        body.append(keep);
      }
      body.append(node("p", "cs-hint", left ? (suggest?.every(Boolean) ? "もう役ができています。このまま勝負できます" : "光っているダイスを残すのがおすすめ。タップで選べます") : "これで勝負しましょう"));
      return refresh();
    }
    const words = { win: "あなたの勝ち", lose: "ディーラーの勝ち", push: "引き分け（賭けは戻ります）" };
    const out = result(words[state.outcome], state.net);
    out.style.setProperty("--d", "0.9s");
    body.append(out, betBar("dice", "もう一度振る", start));
    refresh();
  }


  // ---- Dice poker against a friend -------------------------------------------------------
  // Two players at a 4-digit table. Both put in the same bet when the round starts, each rolls
  // their own five dice (two re-rolls), and the better hand takes both bets; the same hand gives
  // each their bet back. Every player only ever moves their own points. The table lives in the
  // poker tables' collection, marked kind "dice", so poker never opens it.
  const duelRef = (code) => window.fbDoc(window.db, "pokerRooms", code);
  const playerName = () => String((typeof myName === "string" && myName) || uid()).slice(0, 24);
  let duel = null;
  // How to play, at the top of each house game: alone against the dealer, together with friends
  // against the dealer, or one against one with a friend (not for roulette, which has no opponent).
  function modeSwitch(body, active, game = "dice") {
    const bar = node("div", "cs-mode");
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "遊び方");
    const modes = [
      ["dealer", "ひとりで"],
      ["group", "一緒に"],
    ];
    if (game !== "roulette") modes.push(["duel", "タイマン"]);
    bar.style.setProperty("--n", String(modes.length));
    for (const [id, text] of modes) {
      const b = node("button", "", text);
      b.type = "button";
      b.dataset.mode = id;
      b.setAttribute("aria-pressed", String(id === active));
      b.onclick = () => {
        if (id === active) return;
        leaveDuel();
        leaveGroup();
        body.classList.remove("is-roulette-body");
        if (id === "group") groupLobby(body, game);
        else if (id === "duel") duelLobby(body, game);
        else ({ blackjack, roulette, dice, chinchiro })[game](body);
      };
      bar.append(b);
    }
    return bar;
  }
  function duelReady() {
    if (uid() === "GUEST-000") throw Error("フレンドと遊ぶにはログインが必要です（ゲストでは使えません）。");
    if (window.FirestoreReadGuard?.paused?.()) throw Error("クラウドの利用上限に達しています。時間をおいてお試しください。");
    if (!real() || !window.fbOnSnapshot) throw Error("クラウドにつながっていません。通信を確認してもう一度お試しください。");
  }
  const duelKind = (game) => (game === "dice" ? "dice" : game + "-duel");
  // Lobby buttons say what they are doing until the cloud answers, and any failure is shown in
  // plain words right under them.
  function lobbyGuard(status) {
    return (fn, button, text) => async () => {
      status.textContent = "";
      const label = button?.textContent;
      if (button) {
        button.disabled = true;
        button.textContent = text;
      }
      try {
        await fn();
      } catch (error) {
        console.warn("[casino] table", error);
        status.textContent = window.Poker?.message?.(error) || error?.message || "うまくいきませんでした。もう一度お試しください。";
      } finally {
        if (button?.isConnected) {
          button.disabled = false;
          button.textContent = label;
        }
      }
    };
  }
  function duelLobby(body, game = "dice", message = "") {
    leaveDuel();
    body.replaceChildren(modeSwitch(body, "duel", game));
    const panel = node("div", "cs-betbar cs-duel-lobby");
    panel.append(node("p", "cs-duel-title", "フレンドと1対1で勝負"), node("p", "cs-hint", { dice: "同じ額を賭けて、強い役を作ったほうが2人分をもらいます。", blackjack: "同じ額を賭けて、21に近いほうが2人分をもらいます。ディーラーはいません。", chinchiro: "同じ額を賭けて、2人ともサイコロを振り、強い役のほうが2人分をもらいます。" }[game]));
    const status = node("p", "cs-duel-status", message);
    status.setAttribute("role", "status");
    const guard = lobbyGuard(status);
    const make = betBar("duel", "テーブルを作る", (bet) => guard(async () => enterDuel(body, await createDuel(bet, game), game), make.querySelector("[data-cs-play]"), "作っています…")());
    const join = node("div", "cs-duel-join");
    const input = node("input");
    input.inputMode = "numeric";
    input.maxLength = 4;
    input.placeholder = "4桁の番号";
    input.setAttribute("aria-label", "テーブル番号");
    input.dataset.duelCode = "";
    const go = node("button", "cs-primary", "入る");
    go.type = "button";
    go.onclick = guard(async () => enterDuel(body, await joinDuel(input.value.trim(), game), game), go, "入っています…");
    join.append(input, go);
    panel.append(node("p", "cs-duel-step", "1. 自分でテーブルを作る"), make, node("p", "cs-duel-step", "2. または、相手の番号で入る"), join, status);
    body.append(
      panel,
      rules("タイマンの遊び方", [
        "「テーブルを作る」で出る4桁の番号を相手に伝え、相手は「入る」に番号を入れます。",
        { dice: "そろったら2人とも賭けた額が引かれ、それぞれ自分のダイスを振ります（振り直しは2回まで）。", blackjack: "そろったら2人とも賭けた額が引かれ、2枚ずつ配られます。それぞれ「もう1枚」か「これで勝負」を選びます。", chinchiro: "そろったら2人とも賭けた額が引かれ、それぞれ役ができるまで3回までサイコロを振ります。" }[game],
        { dice: "相手のダイスは、両方が「これで勝負」を押すまで見えません。", blackjack: "相手のカードは1枚目だけ見えます。21を超えたら負け、同じ数なら引き分けです。", chinchiro: "相手のどんぶりは、2人とも振り終わるまで見えません。" }[game],
        { dice: "強い役のほうが2人分の賭けをもらいます。同じ役と目なら、賭けはそれぞれに戻ります。", blackjack: "21に近いほうが2人分の賭けをもらいます。最初の2枚で21（ブラックジャック）は、引いて作った21より強い手です。", chinchiro: "強い役のほうが2人分の賭けをもらいます（タイマンでは倍率なし）。同じ強さなら引き分けです。" }[game],
        "途中で相手が抜けたときは、あなたの賭けは戻ります。",
      ]),
    );
    refresh();
  }
  async function createDuel(bet, game = "dice") {
    duelReady();
    if (bet > balance()) throw Error("ポイントが足りません。");
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = String(1000 + random(9000));
      const made = await window.fbRunTransaction(window.db, async (tx) => {
        const snap = await tx.get(duelRef(code));
        if (snap.exists() && snap.data().status !== "closed") return false;
        tx.set(duelRef(code), { kind: duelKind(game), version: 1, code, host: uid(), status: "waiting", createdAt: Date.now(), bet, round: 1, players: { [uid()]: { name: playerName(), joinedAt: Date.now() } }, hands: {}, deal: null, rematch: {} });
        return true;
      });
      if (made) return code;
    }
    throw Error("テーブル番号を作れませんでした。もう一度お試しください。");
  }
  async function updateDuel(code, change) {
    return window.fbRunTransaction(window.db, async (tx) => {
      const snap = await tx.get(duelRef(code));
      if (!snap.exists()) throw Error("テーブルが見つかりません。");
      const next = change(JSON.parse(JSON.stringify(snap.data())));
      if (!next) return false;
      tx.set(duelRef(code), next);
      return true;
    });
  }
  async function joinDuel(code, game = "dice") {
    duelReady();
    if (!/^\d{4}$/.test(code)) throw Error("4桁の番号を入れてください。");
    await updateDuel(code, (room) => {
      if (room.kind !== duelKind(game)) throw Error("この番号は" + GAME_NAMES[game] + "のタイマンのテーブルではありません。");
      if (room.status === "closed") throw Error("このテーブルは終わっています。");
      if (room.players[uid()]) return null;
      if (Object.keys(room.players).length >= 2) throw Error("このテーブルはもう2人そろっています。");
      if (room.bet > balance()) throw Error(fmt(room.bet) + "pt の勝負に対してポイントが足りません。");
      room.players[uid()] = { name: playerName(), joinedAt: Date.now() };
      room.status = "playing";
      return room;
    });
    return code;
  }
  // This device's own dice for a round, kept so a reload cannot roll a fresh hand.
  const localName = (room) => "aiglish_casino_duel_" + uid() + "_" + room.code + "_" + room.createdAt + "_" + room.round;
  function localHand(room) {
    try {
      const saved = JSON.parse(localStorage.getItem(localName(room)) || "null");
      if (saved) return saved;
    } catch {}
    const fresh = C.diceStart(room.bet, random);
    saveHand(room, fresh);
    return fresh;
  }
  function saveHand(room, hand) {
    try {
      localStorage.setItem(localName(room), JSON.stringify(hand));
    } catch {}
  }
  const roundKey = (room) => "casino:duel:" + room.code + ":" + room.createdAt + ":" + room.round;
  function enterDuel(body, code, game = "dice") {
    leaveDuel();
    duel = { code, body, game, room: null, moved: {} };
    const mine = duel;
    duel.unsub = window.fbOnSnapshot(duelRef(code), (snap) => {
      if (duel !== mine) return;
      if (!snap.exists()) return duelLobby(body, game, "テーブルが見つかりません。");
      duel.room = snap.data();
      drawDuel();
    }, (error) => {
      if (duel !== mine) return;
      console.warn("[casino] listen", error);
      duelLobby(body, game, window.Poker?.message?.(error) || "テーブルを読み込めませんでした。");
    });
  }
  // Money moves once per round and key, however often the table redraws.
  function hasMoved(room, part) {
    const key = roundKey(room) + ":" + part;
    try {
      if (localStorage.getItem("aiglish_casino_moved_" + key)) return true;
    } catch {}
    return !!duel.moved[key];
  }
  function duelMove(room, part, delta) {
    const key = roundKey(room) + ":" + part;
    if (duel.moved[key]) return;
    duel.moved[key] = true;
    try {
      if (localStorage.getItem("aiglish_casino_moved_" + key)) return;
      localStorage.setItem("aiglish_casino_moved_" + key, "1");
    } catch {}
    move(key, delta);
  }
  function drawDuel() {
    const { room, body } = duel,
      me = uid(),
      otherId = Object.keys(room.players).find((id) => id !== me),
      other = otherId ? room.players[otherId] : null;
    const game = duel.game;
    body.replaceChildren(modeSwitch(body, "duel", game));
    const head = node("div", "cs-duel-head");
    head.append(node("span", "", "テーブル " + room.code), node("b", "", "賭け " + fmt(room.bet) + "pt"));
    const leave = node("button", "cs-duel-leave", "抜ける");
    leave.type = "button";
    leave.onclick = async () => {
      await leaveDuel();
      duelLobby(body, game);
    };
    head.append(leave);
    body.append(head);
    if (room.status === "waiting") {
      const wait = node("div", "cs-duel-wait");
      wait.append(node("p", "", "この番号を相手に伝えてください"), node("strong", "cs-duel-code", room.code), node("p", "cs-hint", "相手が入ると、すぐに始まります。"));
      body.append(wait);
      return refresh();
    }
    const myHand = room.hands?.[me],
      theirHand = otherId ? room.hands?.[otherId] : null;
    if (room.status === "closed") {
      // The other player left: a round still open gives this player their bet back.
      const open = hasMoved(room, "bet") && !hasMoved(room, "pay") && !hasMoved(room, "settled");
      if (open) duelMove(room, "refund", room.bet);
      body.append(node("p", "cs-duel-wait", room.leftBy === me ? "テーブルを抜けました。" : "相手がテーブルを抜けました。" + (open ? "賭けは戻ります。" : "")));
      const back = node("button", "cs-primary", "ロビーへ");
      back.type = "button";
      back.onclick = () => {
        leaveDuel(false);
        duelLobby(body, game);
      };
      const row = node("div", "cs-actions");
      row.append(back);
      body.append(row);
      return refresh();
    }
    duelMove(room, "bet", -room.bet);
    if (game === "blackjack") return drawBlackjackDuel(room, body, me, otherId, other);
    if (game === "chinchiro") return drawChinchiroDuel(room, body, me, otherId, other);
    let hand = localHand(room);
    const felt = node("div", "cs-felt cs-dice-table");
    const them = node("div", "cs-hand is-dealer");
    const theirLine = node("p", "cs-hand-label");
    theirLine.append(node("span", "", other?.name || "相手"));
    const theirDice = node("div", "cs-dice");
    const both = !!(myHand && theirHand);
    if (both) {
      theirLine.append(node("b", "", handName(theirHand.dice)));
      theirHand.dice.forEach((v, i) => {
        const el = die(v, "is-rolling");
        el.style.setProperty("--d", 0.15 * i + "s");
        theirDice.append(el);
      });
    } else {
      theirLine.append(node("b", "cs-duel-thinking", theirHand ? "決めました" : "考え中…"));
      for (let i = 0; i < 5; i++) theirDice.append(node("span", "cs-die is-empty"));
    }
    them.append(theirLine, theirDice);
    const mine = node("div", "cs-hand is-player");
    const myLine = node("p", "cs-hand-label");
    myLine.append(node("span", "", "あなた"), node("b", "", handName(myHand ? myHand.dice : hand.dice)));
    const myDice = node("div", "cs-dice");
    const locked = !!myHand || hand.rolls >= 3;
    const suggest = locked ? null : C.dealerKeeps(hand.dice);
    (myHand ? myHand.dice : hand.dice).forEach((v, i) => {
      const b = node("button", "cs-die-btn");
      b.type = "button";
      b.setAttribute("aria-pressed", String(!myHand && hand.held[i]));
      b.setAttribute("aria-label", v + "の目" + (!myHand && hand.held[i] ? "（キープ中）" : ""));
      b.append(die(v, duel.rolled?.[i] ? "is-rolling" : ""), node("small", "", !myHand && hand.held[i] ? "キープ" : ""));
      b.disabled = locked;
      if (suggest?.[i] && !hand.held[i]) b.classList.add("is-suggested");
      b.onclick = () => {
        hand = C.diceToggle(hand, i);
        saveHand(room, hand);
        duel.rolled = null;
        drawDuel();
      };
      myDice.append(b);
    });
    duel.rolled = null;
    mine.append(myLine, myDice);
    felt.append(them, mine);
    body.append(felt);
    if (!myHand) {
      const left = 3 - hand.rolls;
      const actions = node("div", "cs-actions");
      const again = node("button", "", left ? "振り直す（あと" + left + "回）" : "もう振れません");
      again.type = "button";
      again.disabled = !C.diceCanRoll(hand);
      again.onclick = () => {
        duel.rolled = hand.held.map((h) => !h);
        hand = C.diceReroll(hand, random);
        saveHand(room, hand);
        drawDuel();
      };
      const stand = node("button", "cs-primary", "これで勝負");
      stand.type = "button";
      stand.onclick = async () => {
        stand.disabled = true;
        const at = room.round;
        await updateDuel(room.code, (fresh) => {
          if (fresh.status !== "playing" || fresh.round !== at || fresh.hands?.[me]) return null;
          fresh.hands = { ...(fresh.hands || {}), [me]: { dice: hand.dice, at: Date.now() } };
          return fresh;
        }).catch(() => (stand.disabled = false));
      };
      actions.append(again, stand);
      body.append(actions, node("p", "cs-hint", left ? "光っているダイスを残すのがおすすめ。相手のダイスは2人とも決めるまで見えません" : "これで勝負しましょう"));
      return refresh();
    }
    if (!both) {
      body.append(node("p", "cs-duel-wait", "相手が決めるのを待っています…"));
      return refresh();
    }
    // Both hands are in: each player settles only their own side.
    const order = C.compare(C.diceScore(myHand.dice), C.diceScore(theirHand.dice)),
      net = order > 0 ? room.bet : order < 0 ? -room.bet : 0;
    if (order > 0) duelMove(room, "pay", room.bet * 2);
    else if (order === 0) duelMove(room, "pay", room.bet);
    else duelMove(room, "settled", 0);
    const out = result(order > 0 ? "あなたの勝ち" : order < 0 ? (other?.name || "相手") + "の勝ち" : "引き分け（賭けは戻ります）", net);
    out.style.setProperty("--d", "0.9s");
    body.append(out);
    if (order > 0 && C.diceScore(myHand.dice)[0] >= 6 && !duel.moved[roundKey(room) + ":big"]) {
      duel.moved[roundKey(room) + ":big"] = true;
      bigWin("WIN", room.bet, "フレンドに勝ちました", 1100);
    }
    rematchRow(room, body, me);
    refresh();
  }
  // Both press もう一勝負 and the next round starts with fresh hands.
  function rematchRow(room, body, me) {
    const again = node("button", "cs-primary", room.rematch?.[me] ? "相手を待っています…" : "もう一勝負");
    again.type = "button";
    again.disabled = !!room.rematch?.[me] || balance() < room.bet;
    again.onclick = () =>
      updateDuel(room.code, (fresh) => {
        if (fresh.status !== "playing" || fresh.round !== room.round) return null;
        fresh.rematch = { ...(fresh.rematch || {}), [me]: true };
        if (Object.keys(fresh.players).every((id) => fresh.rematch[id])) {
          fresh.round++;
          fresh.hands = {};
          fresh.deal = null;
          fresh.rematch = {};
        }
        return fresh;
      }).catch(() => {});
    const row = node("div", "cs-actions");
    row.append(again);
    body.append(row);
    if (balance() < room.bet) body.append(node("p", "cs-hint", "もう一勝負するにはポイントが足りません。"));
  }
  // Blackjack one against one: the table's maker deals two hands from one deck, both draw at the
  // same time, and the other's cards past the first stay face down until both have stood.
  function drawBlackjackDuel(room, body, me, otherId, other) {
    const deal = room.deal;
    if (!deal) {
      if (room.host === me && !duel.dealing) {
        duel.dealing = room.round;
        updateDuel(room.code, (fresh) => {
          if (fresh.deal || fresh.round !== room.round || fresh.status !== "playing") return null;
          fresh.deal = C.duelDeal(Object.keys(fresh.players).sort((a, b) => fresh.players[a].joinedAt - fresh.players[b].joinedAt), random);
          return fresh;
        }).catch(() => (duel && (duel.dealing = 0)));
      }
      body.append(node("p", "cs-duel-wait", "カードを配っています…"));
      return refresh();
    }
    const mine = deal.hands[me],
      theirs = deal.hands[otherId],
      both = C.duelDone(deal);
    const felt = node("div", "cs-felt cs-bj");
    const row = (who, cards, hideAfterFirst, total) => {
      const seat = node("div", "cs-hand " + (who === "あなた" ? "is-player" : "is-dealer"));
      const l = node("p", "cs-hand-label");
      l.append(node("span", "", who), node("b", "", total));
      const cs = node("div", "cs-cards");
      cards.forEach((c, i) => cs.append(window.Poker.card(hideAfterFirst && i > 0 ? null : c)));
      seat.append(l, cs);
      return seat;
    };
    const theirTotal = both ? String(C.bjTotal(theirs.cards).total) : theirs?.done ? "決めました" : "引いています…";
    felt.append(row(other?.name || "相手", theirs?.cards || [], !both, theirTotal), row("あなた", mine.cards, false, String(C.bjTotal(mine.cards).total)));
    body.append(felt);
    if (!mine.done) {
      const actions = node("div", "cs-actions");
      const act = (text, moveName, primary) => {
        const b = node("button", primary ? "cs-primary" : "", text);
        b.type = "button";
        b.onclick = async () => {
          b.disabled = true;
          await updateDuel(room.code, (fresh) => {
            if (!fresh.deal || fresh.round !== room.round || fresh.deal.hands[me]?.done) return null;
            fresh.deal = C.duelAct(fresh.deal, me, moveName);
            return fresh;
          }).catch(() => (b.disabled = false));
        };
        actions.append(b);
        return b;
      };
      const total = C.bjTotal(mine.cards).total;
      const hit = act("もう1枚", "hit"),
        stand = act("これで勝負", "stand", true);
      (total <= 11 ? hit : total >= 17 ? stand : null)?.classList.add("is-suggested");
      body.append(actions, node("p", "cs-hint", total <= 11 ? "11以下なら、引いても21を超えません" : total >= 17 ? "17以上は、引くと超えやすくなります" : "相手の見えている1枚も参考に"));
      return refresh();
    }
    if (!both) {
      body.append(node("p", "cs-duel-wait", "相手が決めるのを待っています…"));
      return refresh();
    }
    const order = C.duelCompare(mine.cards, theirs.cards),
      net = order > 0 ? room.bet : order < 0 ? -room.bet : 0;
    if (order > 0) duelMove(room, "pay", room.bet * 2);
    else if (order === 0) duelMove(room, "pay", room.bet);
    else duelMove(room, "settled", 0);
    const out = result(order > 0 ? "あなたの勝ち" : order < 0 ? (other?.name || "相手") + "の勝ち" : "引き分け（賭けは戻ります）", net);
    out.style.setProperty("--d", "0.4s");
    body.append(out);
    rematchRow(room, body, me);
    refresh();
  }
  async function leaveDuel(tell = true) {
    const current = duel;
    if (!current) return;
    duel = null;
    current.unsub?.();
    if (!tell || !current.room || current.room.status === "closed") return;
    await updateDuel(current.code, (room) => {
      if (room.status === "closed") return null;
      room.status = "closed";
      room.leftBy = uid();
      return room;
    }).catch(() => {});
  }

  // ---- Blackjack and roulette with friends -----------------------------------------------
  // Up to six people at a 4-digit table, all playing the house rather than each other. Each puts
  // in their own bet; the table's maker deals or spins; each settles only their own bet, once per
  // round. Stored with the poker tables, marked by kind, like the dice duel.
  const GROUP_MAX = 6;
  const GAME_NAMES = { blackjack: "ブラックジャック", roulette: "ルーレット", dice: "ダイスポーカー", chinchiro: "チンチロ" };
  // Dice tables for friends together are kept apart from the dice duel's.
  const groupKind = (game) => (game === "dice" ? "dice-together" : game);
  const gameOf = (kind) => (kind === "dice-together" ? "dice" : kind);
  let group = null;
  function groupLobby(body, game, message = "") {
    leaveGroup();
    const kind = groupKind(game);
    body.replaceChildren(modeSwitch(body, "group", game));
    const panel = node("div", "cs-betbar cs-duel-lobby");
    panel.append(
      node("p", "cs-duel-title", "フレンドと一緒に" + GAME_NAMES[game]),
      node("p", "cs-hint", { roulette: "同じルーレットに、それぞれ好きなところへ賭けます。勝ち負けは自分の賭けだけです。", blackjack: "同じディーラーを相手に、それぞれ自分の手で勝負します。順番に1人ずつ引きます。", dice: "同じディーラーを相手に、それぞれ自分のダイスで勝負します。", chinchiro: "コンピュータの親を相手に、みんなが子になって勝負します。" }[game]),
    );
    const status = node("p", "cs-duel-status", message);
    status.setAttribute("role", "status");
    const guard = lobbyGuard(status);
    const make = node("button", "cs-primary", "テーブルを作る");
    make.type = "button";
    make.dataset.groupCreate = "";
    make.onclick = guard(async () => enterGroup(body, kind, await createGroup(kind)), make, "作っています…");
    const join = node("div", "cs-duel-join");
    const input = node("input");
    input.inputMode = "numeric";
    input.maxLength = 4;
    input.placeholder = "4桁の番号";
    input.setAttribute("aria-label", "テーブル番号");
    input.dataset.groupCode = "";
    const go = node("button", "cs-primary", "入る");
    go.type = "button";
    go.onclick = guard(async () => enterGroup(body, kind, await joinGroup(input.value.trim(), kind)), go, "入っています…");
    join.append(input, go);
    panel.append(node("p", "cs-duel-step", "1. 自分でテーブルを作る（最大" + GROUP_MAX + "人）"), make, node("p", "cs-duel-step", "2. または、フレンドの番号で入る"), join, status);
    body.append(
      panel,
      rules("フレンドと一緒に遊ぶには", [
        "「テーブルを作る」で出る4桁の番号をフレンドに伝え、フレンドは「入る」に番号を入れます。",
        "賭ける額や場所は、それぞれが自分で決めます。賭けた分は確定したときに引かれます。",
        { roulette: "みんなが賭けたら、テーブルを作った人が「回す」を押します。", blackjack: "みんなが賭けたら、テーブルを作った人が「配る」を押します。順番が来たら自分の手を決めます。", dice: "みんなが賭けたら、テーブルを作った人が「始める」を押します。それぞれダイスを振り、全員が決めるとディーラーが振ります。", chinchiro: "みんなが賭けたら、テーブルを作った人が「始める」を押します。親が振ったあと、それぞれ自分のサイコロを振ります。" }[game],
        "勝ち負けはディーラーとの間だけで、フレンドのポイントは動きません。",
        "テーブルを作った人が抜けるとテーブルは終わり、まだ決まっていない賭けは戻ります。",
      ]),
    );
    refresh();
  }
  async function createGroup(kind) {
    duelReady();
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = String(1000 + random(9000));
      const made = await window.fbRunTransaction(window.db, async (tx) => {
        const snap = await tx.get(duelRef(code));
        if (snap.exists() && snap.data().status !== "closed") return false;
        tx.set(duelRef(code), { kind, version: 1, code, host: uid(), status: "open", createdAt: Date.now(), round: 1, phase: "betting", players: { [uid()]: { name: playerName(), joinedAt: Date.now() } }, bets: {}, game: null, number: null, history: [] });
        return true;
      });
      if (made) return code;
    }
    throw Error("テーブル番号を作れませんでした。もう一度お試しください。");
  }
  async function joinGroup(code, kind) {
    duelReady();
    if (!/^\d{4}$/.test(code)) throw Error("4桁の番号を入れてください。");
    await updateDuel(code, (room) => {
      if (room.kind !== kind) throw Error("この番号は" + GAME_NAMES[gameOf(kind)] + "のテーブルではありません。");
      if (room.status === "closed") throw Error("このテーブルは終わっています。");
      if (room.players[uid()]) return null;
      if (Object.keys(room.players).length >= GROUP_MAX) throw Error("このテーブルは満席です（" + GROUP_MAX + "人）。");
      room.players[uid()] = { name: playerName(), joinedAt: Date.now() };
      return room;
    });
    return code;
  }
  function enterGroup(body, kind, code) {
    leaveGroup(false);
    group = { kind, code, body, room: null, moved: {}, bets: new Map(), chip: 10, wheel: null, shownRound: 0 };
    const mine = group;
    group.unsub = window.fbOnSnapshot(duelRef(code), (snap) => {
      if (group !== mine) return;
      if (!snap.exists()) return groupLobby(body, gameOf(kind), "テーブルが見つかりません。");
      group.room = snap.data();
      drawGroup();
    }, (error) => {
      if (group !== mine) return;
      console.warn("[casino] listen", error);
      groupLobby(body, gameOf(kind), window.Poker?.message?.(error) || "テーブルを読み込めませんでした。");
    });
  }
  const groupKey = (room) => "casino:" + room.kind + ":" + room.code + ":" + room.createdAt + ":" + room.round;
  function groupHasMoved(room, part) {
    const key = groupKey(room) + ":" + part;
    try {
      if (localStorage.getItem("aiglish_casino_moved_" + key)) return true;
    } catch {}
    return !!group?.moved[key];
  }
  function groupMove(room, part, delta) {
    const key = groupKey(room) + ":" + part;
    if (group.moved[key]) return;
    group.moved[key] = true;
    try {
      if (localStorage.getItem("aiglish_casino_moved_" + key)) return;
      localStorage.setItem("aiglish_casino_moved_" + key, "1");
    } catch {}
    move(key, delta);
  }
  // A bet that was taken but never settled comes back (the table closed, or I left before play).
  function refundOpen(room) {
    if (groupHasMoved(room, "bet") && !groupHasMoved(room, "pay") && !groupHasMoved(room, "settled")) {
      const seat = room.kind === "blackjack" ? room.game?.seats?.[uid()] : null;
      const amount = room.kind === "roulette" ? Object.values(room.bets?.[uid()] || {}).reduce((a, v) => a + v, 0) : seat ? seat.hands.reduce((a, h) => a + h.bet * (h.doubled ? 2 : 1), 0) : room.bets?.[uid()] || 0;
      if (amount) groupMove(room, "refund", amount);
    }
  }
  const nameOf = (room, id) => (id === uid() ? "あなた" : room.players[id]?.name || "だれか");
  function drawGroup() {
    const { room, body, kind } = group,
      me = uid(),
      host = room.host === me;
    body.replaceChildren(modeSwitch(body, "group", gameOf(kind)));
    const head = node("div", "cs-duel-head");
    head.append(node("span", "", "テーブル " + room.code), node("b", "", Object.keys(room.players).length + "人"));
    const leave = node("button", "cs-duel-leave", "抜ける");
    leave.type = "button";
    leave.onclick = async () => {
      await leaveGroup();
      groupLobby(body, gameOf(kind));
    };
    head.append(leave);
    body.append(head);
    if (room.status === "closed") {
      refundOpen(room);
      body.append(node("p", "cs-duel-wait", "テーブルを作った人が抜けたので、テーブルは終わりました。決まっていない賭けは戻ります。"));
      const back = node("button", "cs-primary", "ロビーへ");
      back.type = "button";
      back.onclick = () => groupLobby(body, gameOf(kind));
      const row = node("div", "cs-actions");
      row.append(back);
      body.append(row);
      return refresh();
    }
    // Who is here, and the number to share while friends are still coming.
    const people = node("div", "cs-group-people");
    for (const [id, p] of Object.entries(room.players).sort((a, b) => a[1].joinedAt - b[1].joinedAt)) {
      const chip = node("span", "cs-group-person" + (id === me ? " is-me" : "") + (room.game?.turn === id ? " is-turn" : ""), id === me ? "あなた" : p.name);
      if (id === room.host) chip.append(node("small", "", "親"));
      people.append(chip);
    }
    // Roulette keeps to one screen: its side panel already lists everyone and their bets.
    if (kind !== "roulette") body.append(people);
    if (Object.keys(room.players).length < 2) body.append(node("p", "cs-group-code", "フレンドにこの番号を伝えてください：" + room.code));
    if (kind === "roulette") drawGroupRoulette(room, body, me, host);
    else if (kind === "dice-together") drawGroupDice(room, body, me, host);
    else if (kind === "chinchiro") drawGroupChinchiro(room, body, me, host);
    else drawGroupBlackjack(room, body, me, host);
    refresh();
  }

  // Roulette together: everyone bets on the same spin.
  function drawGroupRoulette(room, body, me, host) {
    if (!group.wheel) group.wheel = makeWheel();
    const wheelBox = group.wheel,
      mineBets = room.bets?.[me],
      confirmed = !!mineBets,
      spun = room.phase === "spun";
    const stage = node("div", "cs-stage");
    const side = node("div", "cs-stage-side");
    const message = node("div", "cs-result-slot");
    const recent = node("div", "cs-recent");
    recent.replaceChildren(...(room.history || []).slice(0, 8).map((n) => node("i", "is-" + C.colourOf(n), String(n))));
    // Everyone's bets so far.
    const list = node("ul", "cs-group-bets");
    for (const id of Object.keys(room.players)) {
      const total = Object.values(room.bets?.[id] || {}).reduce((a, v) => a + v, 0);
      list.append(node("li", "", nameOf(room, id) + "：" + (total ? fmt(total) + "pt" : "まだ")));
    }
    side.append(message, list, recent);
    stage.append(wheelBox.el, side);
    const board = rouletteBoard((on, label, cls) => {
      const b = node("button", "cs-spot " + (cls || ""), label);
      b.type = "button";
      b.dataset.on = on;
      b.onclick = () => {
        if (confirmed || spun) return;
        const sum = [...group.bets.values()].reduce((a, v) => a + v, 0),
          add = Math.min(group.chip, cap() - sum);
        if (add <= 0) return;
        group.bets.set(on, (group.bets.get(on) || 0) + add);
        drawGroup();
      };
      return b;
    });
    const shown = confirmed ? new Map(Object.entries(mineBets)) : group.bets;
    board.querySelectorAll(".cs-spot").forEach((b) => {
      const amount = shown.get(b.dataset.on) || 0;
      if (amount) b.append(node("i", "cs-stake", fmt(amount)));
      if (spun && C.spot(b.dataset.on)?.hit(room.number)) b.classList.add("is-hit");
    });
    body.classList.add("is-roulette-body");
    body.append(stage);
    if (!confirmed && !spun) body.append(chipPicker((v) => (group.chip = v), group.chip));
    body.append(board);
    const hint = node("p", "cs-hint");
    const actions = node("div", "cs-actions");
    const sum = [...shown.values()].reduce((a, v) => a + v, 0);
    if (!spun) {
      if (!confirmed) {
        hint.textContent = sum ? "賭けた合計 " + fmt(sum) + unit() + "。よければ「賭けを確定」" : "数字や色をタップしてチップを置きます";
        const clear = node("button", "", "賭けを外す");
        clear.type = "button";
        clear.disabled = !sum;
        clear.onclick = () => {
          group.bets.clear();
          drawGroup();
        };
        const ok = node("button", host ? "" : "cs-primary", "賭けを確定");
        ok.type = "button";
        ok.disabled = !sum || sum > balance();
        ok.onclick = async () => {
          ok.disabled = true;
          const bets = Object.fromEntries(group.bets);
          const at = room.round;
          const done = await updateDuel(room.code, (fresh) => {
            if (fresh.status === "closed" || fresh.round !== at || fresh.phase !== "betting" || fresh.bets?.[me]) return null;
            fresh.bets = { ...(fresh.bets || {}), [me]: bets };
            return fresh;
          }).catch(() => false);
          if (done) {
            groupMove({ ...room, round: at }, "bet", -sum);
            group.bets.clear();
          } else ok.disabled = false;
        };
        actions.append(clear, ok);
      } else hint.textContent = "賭けを確定しました（" + fmt(sum) + "pt）。" + (host ? "みんなが賭けたら回してください" : "親が回すのを待っています");
      if (host) {
        const spin = node("button", "cs-primary", "回す");
        spin.type = "button";
        spin.dataset.groupSpin = "";
        spin.disabled = !Object.keys(room.bets || {}).length;
        spin.onclick = async () => {
          spin.disabled = true;
          const number = C.rouletteSpin(random);
          await updateDuel(room.code, (fresh) => {
            if (fresh.phase !== "betting" || fresh.round !== room.round) return null;
            fresh.phase = "spun";
            fresh.number = number;
            fresh.spunAt = Date.now();
            fresh.history = [number].concat(fresh.history || []).slice(0, 20);
            return fresh;
          }).catch(() => (spin.disabled = false));
        };
        actions.append(spin);
      }
    } else {
      // The number is drawn: turn the wheel once for this round, then show what my bets did.
      const outcome = mineBets ? C.rouletteSettle(Object.entries(mineBets).map(([on, amount]) => ({ on, amount })), room.number) : null;
      if (outcome) {
        const back = outcome.lines.filter((l) => l.won).reduce((a, l) => a + l.amount + l.net, 0);
        if (back > 0) groupMove(room, "pay", back);
        else groupMove(room, "settled", 0);
      }
      const reveal = () => {
        wheelBox.land(room.number);
        const colour = { red: "赤", black: "黒", green: "緑" }[C.colourOf(room.number)];
        message.replaceChildren(outcome ? result(room.number + "（" + colour + "）" + (outcome.net > 0 ? " 当たり" : outcome.lines.some((l) => l.won) ? " 一部当たり" : " はずれ"), outcome.net) : node("p", "cs-hint", room.number + "（" + colour + "）でした"));
      };
      if (group.shownRound !== room.round) {
        group.shownRound = room.round;
        wheelBox.spinTo(room.number);
        group.revealAt = Date.now() + (calm() ? 0 : 3600);
      }
      const wait = Math.max(0, (group.revealAt || 0) - Date.now());
      if (wait) setTimeout(() => group?.room === room && reveal(), wait);
      else reveal();
      hint.textContent = host ? "次の勝負は「次へ」で始まります" : "親が「次へ」を押すと次の勝負です";
      if (host) {
        const next = node("button", "cs-primary", "次へ");
        next.type = "button";
        next.onclick = () =>
          updateDuel(room.code, (fresh) => {
            if (fresh.round !== room.round) return null;
            fresh.round++;
            fresh.phase = "betting";
            fresh.bets = {};
            fresh.number = null;
            return fresh;
          }).catch(() => {});
        actions.append(next);
      }
    }
    body.append(hint, actions);
  }

  // Blackjack together: one dealer, everyone's own hand, in turn.
  function drawGroupBlackjack(room, body, me, host) {
    const t = room.game,
      bet = room.bets?.[me] || 0;
    if (!group.seen) group.seen = {};
    if (t) body.append(bjFelt(t, me, (id) => nameOf(room, id), group.seen));
    else {
      const felt = node("div", "cs-felt cs-bj");
      const l = node("p", "cs-hand-label");
      l.append(node("span", "", "ディーラー"));
      const row = node("div", "cs-cards");
      row.append(window.Poker.card(null));
      const d = node("div", "cs-hand is-dealer");
      d.append(l, row);
      felt.append(d);
      body.append(felt);
    }
    const hint = node("p", "cs-hint");
    const actions = node("div", "cs-actions");
    if (!t) {
      // Betting: each joins this game with their own amount.
      if (!bet)
        body.append(
          betBar("group-bj", "この額で参加", async (amount) => {
            const at = room.round;
            const done = await updateDuel(room.code, (fresh) => {
              if (fresh.status === "closed" || fresh.round !== at || fresh.game || fresh.bets?.[me]) return null;
              fresh.bets = { ...(fresh.bets || {}), [me]: amount };
              return fresh;
            }).catch(() => false);
            if (done) groupMove({ ...room, round: at }, "bet", -amount);
          }),
        );
      else hint.textContent = fmt(bet) + "pt で参加しています。" + (host ? "みんながそろったら配ってください" : "親が配るのを待っています");
      const joined = Object.keys(room.bets || {});
      body.append(node("p", "cs-group-joined", "参加：" + (joined.length ? joined.map((id) => nameOf(room, id)).join("・") : "まだだれも")));
      if (host) {
        const deal = node("button", "cs-primary", "配る");
        deal.type = "button";
        deal.dataset.groupDeal = "";
        deal.disabled = !joined.length;
        deal.onclick = async () => {
          deal.disabled = true;
          await updateDuel(room.code, (fresh) => {
            if (fresh.game || fresh.round !== room.round) return null;
            const order = Object.keys(fresh.bets || {})
              .filter((id) => fresh.players[id])
              .sort((a, b) => fresh.players[a].joinedAt - fresh.players[b].joinedAt);
            if (!order.length) return null;
            fresh.game = C.tableDeal(order, fresh.bets, random);
            fresh.game.dealtAt = Date.now();
            fresh.phase = fresh.game.done ? "done" : "playing";
            return fresh;
          }).catch(() => (deal.disabled = false));
        };
        actions.append(deal);
      }
      body.append(hint, actions);
      return;
    }
    if (!t.done) {
      if (t.turn === me) {
        body.append(
          bjActions(t, me, async (moveName, cost) => {
            const seat = t.seats[me];
            const ok = await updateDuel(room.code, (fresh) => {
              if (!fresh.game || fresh.game.turn !== me || fresh.round !== room.round) return null;
              const dealtAt = fresh.game.dealtAt;
              fresh.game = C.tableAct(fresh.game, me, moveName);
              fresh.game.dealtAt = dealtAt;
              if (fresh.game.done) fresh.phase = "done";
              return fresh;
            }).catch(() => false);
            if (ok && cost) groupMove(room, moveName + ":" + seat.hands.length + ":" + seat.active, -cost);
            if (!ok) drawGroup();
          }),
        );
      } else {
        hint.textContent = (t.order.includes(me) ? "" : "この勝負は見学中です。") + nameOf(room, t.turn) + "さんの番です";
        // The table's maker can move things on when someone is away.
        if (host) {
          const skip = node("button", "", nameOf(room, t.turn) + "さんを飛ばす");
          skip.type = "button";
          skip.onclick = () =>
            updateDuel(room.code, (fresh) => {
              if (!fresh.game || fresh.game.turn !== t.turn) return null;
              const dealtAt = fresh.game.dealtAt;
              fresh.game = C.tableAct(fresh.game, t.turn, "stand");
              fresh.game.dealtAt = dealtAt;
              if (fresh.game.done) fresh.phase = "done";
              return fresh;
            }).catch(() => {});
          actions.append(skip);
        }
      }
      body.append(hint, actions);
      return;
    }
    // Done: each settles their own hands.
    const mine = C.tableOutcome(t, me);
    if (mine) {
      if (mine.stake + mine.net > 0) groupMove(room, "pay", mine.stake + mine.net);
      else groupMove(room, "settled", 0);
      const line = bjResultLine(mine);
      line.style.setProperty("--d", "1.2s");
      body.append(line);
    }
    hint.textContent = host ? "「次のゲーム」でまた賭けられます" : "親が「次のゲーム」を押すとまた賭けられます";
    if (host) {
      const next = node("button", "cs-primary", "次のゲーム");
      next.type = "button";
      next.onclick = () =>
        updateDuel(room.code, (fresh) => {
          if (fresh.round !== room.round) return null;
          fresh.round++;
          fresh.phase = "betting";
          fresh.bets = {};
          fresh.game = null;
          return fresh;
        }).catch(() => {});
      actions.append(next);
    }
    body.append(hint, actions);
  }

  // Dice poker together: everyone in plays the same dealer with their own five dice.
  function drawGroupDice(room, body, me, host) {
    const g = room.game,
      bet = room.bets?.[me] || 0;
    const felt = node("div", "cs-felt cs-dice-table");
    const dealerSeat = node("div", "cs-hand is-dealer");
    const dl = node("p", "cs-hand-label");
    dl.append(node("span", "", "ディーラー"));
    const dd = node("div", "cs-dice");
    if (g?.dealer) {
      dl.append(node("b", "", handName(g.dealer)));
      g.dealer.forEach((v, i) => {
        const el = die(v, "is-rolling");
        el.style.setProperty("--d", 0.15 * i + "s");
        dd.append(el);
      });
    } else for (let i = 0; i < 5; i++) dd.append(node("span", "cs-die is-empty"));
    dealerSeat.append(dl, dd);
    felt.append(dealerSeat);
    body.append(felt);
    const hint = node("p", "cs-hint");
    const actions = node("div", "cs-actions");
    if (!g) {
      if (!bet)
        body.append(
          betBar("group-dice", "この額で参加", async (amount) => {
            const at = room.round;
            const done = await updateDuel(room.code, (fresh) => {
              if (fresh.status === "closed" || fresh.round !== at || fresh.game || fresh.bets?.[me]) return null;
              fresh.bets = { ...(fresh.bets || {}), [me]: amount };
              return fresh;
            }).catch(() => false);
            if (done) groupMove({ ...room, round: at }, "bet", -amount);
          }),
        );
      else hint.textContent = fmt(bet) + "pt で参加しています。" + (host ? "みんながそろったら始めてください" : "親が始めるのを待っています");
      const joined = Object.keys(room.bets || {});
      body.append(node("p", "cs-group-joined", "参加：" + (joined.length ? joined.map((id) => nameOf(room, id)).join("・") : "まだだれも")));
      if (host) {
        const start = node("button", "cs-primary", "始める");
        start.type = "button";
        start.dataset.groupDeal = "";
        start.disabled = !joined.length;
        start.onclick = () =>
          updateDuel(room.code, (fresh) => {
            if (fresh.game || fresh.round !== room.round) return null;
            const order = Object.keys(fresh.bets || {}).filter((id) => fresh.players[id]);
            if (!order.length) return null;
            fresh.game = { order, hands: {}, dealer: null };
            fresh.phase = "playing";
            return fresh;
          }).catch(() => {});
        actions.append(start);
      }
      body.append(hint, actions);
      return;
    }
    // Everyone else at the table, and how far they are.
    const list = node("ul", "cs-group-bets cs-group-dice");
    for (const id of g.order) {
      if (id === me) continue;
      const theirs = g.hands[id];
      const li = node("li", "", nameOf(room, id) + "：" + (g.dealer && theirs ? handName(theirs) : theirs ? "決めました" : "振っています…"));
      list.append(li);
    }
    if (list.childElementCount) body.append(list);
    const inGame = g.order.includes(me),
      mineDone = g.hands[me];
    if (inGame && !mineDone && !g.dealer) {
      let hand = localHand(room);
      body.append(myDiceRow(hand, null, (i) => {
        hand = C.diceToggle(hand, i);
        saveHand(room, hand);
        drawGroup();
      }));
      const left = 3 - hand.rolls;
      const again = node("button", "", left ? "振り直す（あと" + left + "回）" : "もう振れません");
      again.type = "button";
      again.disabled = !C.diceCanRoll(hand);
      again.onclick = () => {
        hand = C.diceReroll(hand, random);
        saveHand(room, hand);
        drawGroup();
      };
      const stand = node("button", "cs-primary", "これで勝負");
      stand.type = "button";
      stand.onclick = async () => {
        stand.disabled = true;
        await updateDuel(room.code, (fresh) => {
          if (!fresh.game || fresh.game.dealer || fresh.round !== room.round || fresh.game.hands[me]) return null;
          fresh.game.hands = { ...fresh.game.hands, [me]: hand.dice };
          return fresh;
        }).catch(() => (stand.disabled = false));
      };
      actions.append(again, stand);
      hint.textContent = left ? "光っているダイスを残すのがおすすめ" : "これで勝負しましょう";
      body.append(hint, actions);
      return;
    }
    if (mineDone) body.append(myDiceRow({ dice: mineDone, held: [], rolls: 3 }, true));
    const waiting = g.order.filter((id) => !g.hands[id]);
    if (!g.dealer) {
      // When every hand is in, the table's maker rolls for the dealer.
      if (host && !waiting.length && group.rolling !== room.round) {
        group.rolling = room.round;
        updateDuel(room.code, (fresh) => {
          if (!fresh.game || fresh.game.dealer || fresh.round !== room.round) return null;
          if (fresh.game.order.some((id) => !fresh.game.hands[id])) return null;
          fresh.game.dealer = C.diceDealer(random).dice;
          fresh.phase = "done";
          return fresh;
        }).catch(() => group && (group.rolling = 0));
      }
      hint.textContent = inGame ? "みんなが決めるのを待っています…" : "この勝負は見学中です";
      if (host && waiting.length) {
        const skip = node("button", "", "待たずに進める（" + waiting.map((id) => nameOf(room, id)).join("・") + "）");
        skip.type = "button";
        skip.onclick = () =>
          updateDuel(room.code, (fresh) => {
            if (!fresh.game || fresh.game.dealer || fresh.round !== room.round) return null;
            fresh.game.order = fresh.game.order.filter((id) => fresh.game.hands[id]);
            return fresh;
          }).catch(() => {});
        actions.append(skip);
      }
      body.append(hint, actions);
      return;
    }
    // The dealer has rolled: each settles their own hand.
    if (inGame && mineDone) {
      const order = C.diceVs(mineDone, g.dealer),
        net = order > 0 ? bet : order < 0 ? -bet : 0;
      if (order > 0) groupMove(room, "pay", bet * 2);
      else if (order === 0) groupMove(room, "pay", bet);
      else groupMove(room, "settled", 0);
      const out = result(order > 0 ? "あなたの勝ち" : order < 0 ? "ディーラーの勝ち" : "引き分け（賭けは戻ります）", net);
      out.style.setProperty("--d", "0.9s");
      body.append(out);
    }
    hint.textContent = host ? "「次のゲーム」でまた賭けられます" : "親が「次のゲーム」を押すとまた賭けられます";
    if (host) {
      const next = node("button", "cs-primary", "次のゲーム");
      next.type = "button";
      next.onclick = () =>
        updateDuel(room.code, (fresh) => {
          if (fresh.round !== room.round) return null;
          fresh.round++;
          fresh.phase = "betting";
          fresh.bets = {};
          fresh.game = null;
          return fresh;
        }).catch(() => {});
      actions.append(next);
    }
    body.append(hint, actions);
  }
  // My five dice as buttons: tap to keep; the ones worth keeping glow.
  function myDiceRow(hand, locked, onToggle) {
    const seat = node("div", "cs-hand is-player cs-my-dice");
    const l = node("p", "cs-hand-label");
    l.append(node("span", "", "あなた"), node("b", "", handName(hand.dice)));
    const row = node("div", "cs-dice");
    const done = locked || hand.rolls >= 3;
    const suggest = done ? null : C.dealerKeeps(hand.dice);
    hand.dice.forEach((v, i) => {
      const b = node("button", "cs-die-btn");
      b.type = "button";
      b.setAttribute("aria-pressed", String(!!hand.held[i]));
      b.setAttribute("aria-label", v + "の目" + (hand.held[i] ? "（キープ中）" : ""));
      b.append(die(v), node("small", "", hand.held[i] && !done ? "キープ" : ""));
      b.disabled = !!done;
      if (suggest?.[i] && !hand.held[i]) b.classList.add("is-suggested");
      if (onToggle) b.onclick = () => onToggle(i);
      row.append(b);
    });
    seat.append(l, row);
    const felt = node("div", "cs-felt cs-dice-table");
    felt.append(seat);
    return felt;
  }

  // ---- Chinchiro ---------------------------------------------------------------------------
  // Three dice in a bowl. The parent (the computer) rolls first; unless that settles it, each
  // player rolls up to three times until the dice make a hand.
  const CHIN_RULES = [
    "3つのサイコロをどんぶりに振り、役ができるまで振り直せます。親（ディーラー）は3回まで、子（あなた）は2回までです。",
    "強い順：ピンゾロ（1・1・1）＞ゾロ目（3つ同じ）＞シゴロ（4・5・6）＞目（2つ同じで、残り1つが目。6が強い）＞目なし＞ヒフミ（1・2・3）。",
    "親が先に振ります。親がシゴロ・ゾロ目・ピンゾロなら親の勝ち、ヒフミなら子の勝ちで、すぐ決まります。",
    "それ以外は子が振り、目の大きいほうが勝ちです。同じ目（目なし同士も）は親の勝ち。子のシゴロは2倍、ゾロ目は3倍、ピンゾロは5倍もらえ、ヒフミは2倍払います。",
    "負けたときは役によって賭けの2〜5倍を払うことがあります（所持ポイントの分まで）。",
  ];
  function bowl(dice, rolling) {
    const el = node("div", "cs-bowl");
    (dice || [null, null, null]).forEach((v, i) => {
      if (!v) return el.append(node("span", "cs-die is-empty"));
      const d = die(v, rolling ? "is-rolling" : "");
      d.style.setProperty("--d", (0.08 * i).toFixed(2) + "s");
      el.append(d);
    });
    return el;
  }
  // One side's turn: who, the hand so far, the bowl with the latest throw, and the throws before.
  function chinSide(who, turn, hidden, rolling) {
    const seat = node("div", "cs-hand cs-chin-side");
    const l = node("p", "cs-hand-label");
    l.append(node("span", "", who), node("b", "", hidden ? (turn?.done ? "決めました" : "振っています…") : turn?.hand ? turn.hand.name : turn?.rolls?.length ? "まだ役なし" : ""));
    const last = turn?.rolls?.length && !hidden ? turn.rolls[turn.rolls.length - 1] : null;
    seat.append(l, bowl(last, rolling));
    if (turn?.rolls?.length > 1 && !hidden) {
      const before = node("p", "cs-chin-before", turn.rolls.slice(0, -1).map((r, i) => i + 1 + "投目 " + r.join("・")).join("　"));
      seat.append(before);
    }
    return seat;
  }
  // Settling against the parent: the bet back and the winnings, or what more the loss costs.
  function chinMoney(m, bet, pay, extra) {
    if (m > 0) pay(bet + m * bet);
    else if (m === 0) pay(bet);
    else if (m < -1) extra(Math.min((-m - 1) * bet, balance()));
  }
  const chinWords = (m) => (m > 1 ? "あなたの勝ち（" + m + "倍）" : m === 1 ? "あなたの勝ち" : m === 0 ? "引き分け（賭けは戻ります）" : m < -1 ? "親の勝ち（" + -m + "倍）" : "親の勝ち");
  function chinchiro(body, state = null) {
    body.replaceChildren(modeSwitch(body, "dealer", "chinchiro"));
    const felt = node("div", "cs-felt cs-chin");
    const start = (bet) => {
      const money = round("chinchiro");
      money.stake(bet);
      chinchiro(body, { bet, money, parent: C.chinTurn(random), child: C.chinStart(), shown: false });
    };
    if (!state) {
      felt.append(chinSide("親（ディーラー）", null), chinSide("あなた", null));
      body.append(felt, betBar("chinchiro", "勝負する", start), rules("チンチロの遊び方", CHIN_RULES));
      return refresh();
    }
    const { parent, child } = state;
    const early = C.chinParentDecides(parent.hand);
    felt.append(chinSide("親（ディーラー）", parent, false, !state.shown), chinSide("あなた", early !== null ? null : child, false, state.rolled));
    state.shown = true;
    state.rolled = false;
    body.append(felt);
    if (early === null && !child.done) {
      const go = node("button", "cs-primary", child.rolls.length ? "もう一度振る（あと" + (C.CHILD_THROWS - child.rolls.length) + "回）" : "サイコロを振る");
      go.type = "button";
      go.dataset.chinRoll = "";
      go.onclick = () => {
        state.child = C.chinNext(child, random, C.CHILD_THROWS);
        state.rolled = true;
        chinchiro(body, state);
      };
      const row = node("div", "cs-actions");
      row.append(go);
      body.append(node("p", "cs-hint", "親は「" + parent.hand.name + "」。" + (child.rolls.length ? "役ができるまで、あと" + (C.CHILD_THROWS - child.rolls.length) + "回振れます" : "あなたの番です（" + C.CHILD_THROWS + "回まで）")), row);
      return refresh();
    }
    const m = early !== null ? early : C.chinSettle(parent.hand, child.hand);
    if (!state.paid) {
      state.paid = true;
      chinMoney(m, state.bet, state.money.pay, (n) => n > 0 && state.money.stake(n, "extra"));
      if (m >= 3) bigWin(child.hand?.name === "ピンゾロ" ? "PINZORO" : "ZOROME", m * state.bet, child.hand?.name || "", 900);
    }
    const out = result((early !== null ? "親が「" + parent.hand.name + "」：" : "") + chinWords(m), m * state.bet);
    out.style.setProperty("--d", "0.6s");
    body.append(out, betBar("chinchiro", "もう一度", start));
    refresh();
  }

  // Chinchiro together: the computer is the parent for the whole table.
  function drawGroupChinchiro(room, body, me, host) {
    const g = room.game,
      bet = room.bets?.[me] || 0;
    const felt = node("div", "cs-felt cs-chin");
    felt.append(chinSide("親（ディーラー）", g?.parent || null, false, g && group.parentShown !== room.round));
    if (g) group.parentShown = room.round;
    const hint = node("p", "cs-hint");
    const actions = node("div", "cs-actions");
    if (!g) {
      body.append(felt);
      if (!bet)
        body.append(
          betBar("group-chin", "この額で参加", async (amount) => {
            const at = room.round;
            const done = await updateDuel(room.code, (fresh) => {
              if (fresh.status === "closed" || fresh.round !== at || fresh.game || fresh.bets?.[me]) return null;
              fresh.bets = { ...(fresh.bets || {}), [me]: amount };
              return fresh;
            }).catch(() => false);
            if (done) groupMove({ ...room, round: at }, "bet", -amount);
          }),
        );
      else hint.textContent = fmt(bet) + "pt で参加しています。" + (host ? "みんながそろったら始めてください" : "親が始めるのを待っています");
      const joined = Object.keys(room.bets || {});
      body.append(node("p", "cs-group-joined", "参加：" + (joined.length ? joined.map((id) => nameOf(room, id)).join("・") : "まだだれも")));
      if (host) {
        const go = node("button", "cs-primary", "始める（親が振ります）");
        go.type = "button";
        go.dataset.groupDeal = "";
        go.disabled = !joined.length;
        go.onclick = () =>
          updateDuel(room.code, (fresh) => {
            if (fresh.game || fresh.round !== room.round) return null;
            const order = Object.keys(fresh.bets || {}).filter((id) => fresh.players[id]);
            if (!order.length) return null;
            fresh.game = { order, parent: C.chinTurn(random), hands: {} };
            fresh.phase = "playing";
            return fresh;
          }).catch(() => {});
        actions.append(go);
      }
      body.append(rules("チンチロの遊び方", CHIN_RULES), hint, actions);
      return;
    }
    const early = C.chinParentDecides(g.parent.hand),
      inGame = g.order.includes(me);
    const local = "aiglish_casino_chin_" + uid() + "_" + room.code + "_" + room.createdAt + "_" + room.round;
    let mine = g.hands[me] || null;
    if (!mine && inGame && early === null) {
      try {
        mine = JSON.parse(localStorage.getItem(local) || "null");
      } catch {}
      mine = mine || C.chinStart();
    }
    if (inGame) felt.append(chinSide("あなた", early !== null ? null : mine, false, group.chinRolled));
    group.chinRolled = false;
    body.append(felt);
    // The others, once they have finished.
    const others = node("ul", "cs-group-bets cs-group-dice");
    for (const id of g.order) if (id !== me) others.append(node("li", "", nameOf(room, id) + "：" + (early !== null ? "—" : g.hands[id] ? g.hands[id].hand.name : "振っています…")));
    if (others.childElementCount) body.append(others);
    if (inGame && early === null && !g.hands[me]) {
      if (!mine.done) {
        const go = node("button", "cs-primary", mine.rolls.length ? "もう一度振る（あと" + (C.CHILD_THROWS - mine.rolls.length) + "回）" : "サイコロを振る");
        go.type = "button";
        go.dataset.chinRoll = "";
        go.onclick = async () => {
          mine = C.chinNext(mine, random, C.CHILD_THROWS);
          try {
            localStorage.setItem(local, JSON.stringify(mine));
          } catch {}
          group.chinRolled = true;
          if (mine.done)
            await updateDuel(room.code, (fresh) => {
              if (!fresh.game || fresh.round !== room.round || fresh.game.hands[me]) return null;
              fresh.game.hands = { ...fresh.game.hands, [me]: mine };
              return fresh;
            }).catch(() => {});
          drawGroup();
        };
        actions.append(go);
        hint.textContent = "親は「" + g.parent.hand.name + "」。子は" + C.CHILD_THROWS + "回まで振れます";
        body.append(hint, actions);
        return;
      }
    }
    if (inGame && (early !== null || mine?.done)) {
      const m = early !== null ? early : C.chinSettle(g.parent.hand, mine.hand);
      if (m > 0 || m === 0) groupMove(room, "pay", bet + Math.max(0, m) * bet);
      else {
        groupMove(room, "settled", 0);
        if (m < -1) groupMove(room, "extra", -Math.min((-m - 1) * bet, balance()));
      }
      const out = result((early !== null ? "親が「" + g.parent.hand.name + "」：" : "") + chinWords(m), m * bet);
      out.style.setProperty("--d", "0.6s");
      body.append(out);
    }
    hint.textContent = host ? "「次のゲーム」でまた賭けられます" : "親（テーブルを作った人）が「次のゲーム」を押すとまた賭けられます";
    if (host) {
      const next = node("button", "cs-primary", "次のゲーム");
      next.type = "button";
      next.onclick = () =>
        updateDuel(room.code, (fresh) => {
          if (fresh.round !== room.round) return null;
          fresh.round++;
          fresh.phase = "betting";
          fresh.bets = {};
          fresh.game = null;
          return fresh;
        }).catch(() => {});
      actions.append(next);
    }
    body.append(hint, actions);
  }

  // Chinchiro one against one: both roll, the other's bowl stays covered until both are done.
  function drawChinchiroDuel(room, body, me, otherId, other) {
    const local = "aiglish_casino_chin_" + uid() + "_" + room.code + "_" + room.createdAt + "_" + room.round;
    let mine = room.hands?.[me] || null;
    if (!mine) {
      try {
        mine = JSON.parse(localStorage.getItem(local) || "null");
      } catch {}
      mine = mine || C.chinStart();
    }
    const theirs = otherId ? room.hands?.[otherId] : null,
      both = !!(room.hands?.[me] && theirs);
    const felt = node("div", "cs-felt cs-chin");
    felt.append(chinSide(other?.name || "相手", theirs, !both, both && duel.chinShown !== room.round), chinSide("あなた", mine, false, duel.chinRolled));
    if (both) duel.chinShown = room.round;
    duel.chinRolled = false;
    body.append(felt);
    if (!room.hands?.[me]) {
      const go = node("button", "cs-primary", mine.rolls.length ? "もう一度振る（" + (3 - mine.rolls.length) + "回まで）" : "サイコロを振る");
      go.type = "button";
      go.dataset.chinRoll = "";
      go.onclick = async () => {
        mine = C.chinNext(mine, random);
        try {
          localStorage.setItem(local, JSON.stringify(mine));
        } catch {}
        duel.chinRolled = true;
        if (mine.done)
          await updateDuel(room.code, (fresh) => {
            if (fresh.status !== "playing" || fresh.round !== room.round || fresh.hands?.[me]) return null;
            fresh.hands = { ...(fresh.hands || {}), [me]: mine };
            return fresh;
          }).catch(() => {});
        drawDuel();
      };
      const row = node("div", "cs-actions");
      row.append(go);
      body.append(row, node("p", "cs-hint", "役ができるまで3回まで振れます。相手のどんぶりは2人とも決めるまで見えません"));
      return refresh();
    }
    if (!both) {
      body.append(node("p", "cs-duel-wait", "相手が振り終わるのを待っています…"));
      return refresh();
    }
    const order = C.chinVs(room.hands[me].hand, theirs.hand),
      net = order > 0 ? room.bet : order < 0 ? -room.bet : 0;
    if (order > 0) duelMove(room, "pay", room.bet * 2);
    else if (order === 0) duelMove(room, "pay", room.bet);
    else duelMove(room, "settled", 0);
    const out = result(order > 0 ? "あなたの勝ち" : order < 0 ? (other?.name || "相手") + "の勝ち" : "引き分け（賭けは戻ります）", net);
    out.style.setProperty("--d", "0.6s");
    body.append(out);
    rematchRow(room, body, me);
    refresh();
  }

  async function leaveGroup(tell = true) {
    const current = group;
    if (!current) return;
    group = null;
    current.unsub?.();
    const room = current.room;
    if (!tell || !room || room.status === "closed") return;
    const me = uid();
    // Leaving before play gives my bet back; leaving mid-hand loses it.
    const before = room.kind === "roulette" ? room.phase === "betting" : !room.game;
    group = current;
    if (before) refundOpen(room);
    group = null;
    await updateDuel(current.code, (fresh) => {
      if (fresh.status === "closed") return null;
      if (fresh.host === me) {
        fresh.status = "closed";
        fresh.leftBy = me;
        return fresh;
      }
      delete fresh.players[me];
      if (fresh.phase === "betting" && fresh.bets) delete fresh.bets[me];
      if ((fresh.kind === "dice-together" && fresh.game && !fresh.game.dealer) || (fresh.kind === "chinchiro" && fresh.game)) fresh.game.order = fresh.game.order.filter((id) => id !== me);
      else if (fresh.game && !fresh.game.done) {
        fresh.game = C.tableDrop(fresh.game, me);
        if (fresh.game.done) fresh.phase = "done";
      }
      return fresh;
    }).catch(() => {});
  }

  window.addEventListener("study-points-changed", refresh);
  window.onTabChange?.((tab) => {
    if (tab === "casino") mount();
  });
  window.Casino = Object.freeze({ open, close, mount, balance, _real: real });
})();
