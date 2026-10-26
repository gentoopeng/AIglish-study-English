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
      stake: (bet) => move(key + ":bet", -bet),
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
    dice: '<svg viewBox="0 0 64 48" aria-hidden="true"><rect x="10" y="14" width="22" height="22" rx="5" transform="rotate(-10 21 25)" class="is-die"/><rect x="32" y="10" width="22" height="22" rx="5" transform="rotate(8 43 21)" class="is-die"/><g class="is-pip" transform="rotate(-10 21 25)"><circle cx="16" cy="19" r="2"/><circle cx="21" cy="25" r="2"/><circle cx="26" cy="31" r="2"/></g><g class="is-pip" transform="rotate(8 43 21)"><circle cx="38" cy="15" r="2"/><circle cx="48" cy="15" r="2"/><circle cx="38" cy="27" r="2"/><circle cx="48" cy="27" r="2"/></g></svg>',
  };
  const GAMES = [
    { id: "poker", name: "ポーカー", line: "みんなやコンピュータと", level: "じっくり" },
    { id: "blackjack", name: "ブラックジャック", line: "21に近いほうが勝ち。フレンドとも", level: "ふつう" },
    { id: "roulette", name: "ルーレット", line: "止まる数字を当てる。フレンドとも", level: "かんたん" },
    { id: "dice", name: "ダイスポーカー", line: "役をつくる。フレンドとタイマンも", level: "かんたん" },
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
    ({ blackjack, roulette, dice })[id](game.body);
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
  function blackjack(body, state = null, shown = { player: 0, dealer: 0 }) {
    body.replaceChildren();
    const table = node("div", "cs-felt cs-bj");
    const dealerRow = node("div", "cs-hand is-dealer"),
      playerRow = node("div", "cs-hand is-player");
    const cards = (list, hideSecond, from) => {
      const row = node("div", "cs-cards");
      list.forEach((card, i) => {
        const el = window.Poker.card(hideSecond && i === 1 ? null : card);
        if (i >= from) {
          el.classList.add("cs-deal");
          el.style.setProperty("--d", (i - from) * (state?.done ? 0.45 : 0.15) + "s");
        }
        row.append(el);
      });
      return row;
    };
    const label = (who, total) => {
      const line = node("p", "cs-hand-label");
      line.append(node("span", "", who));
      if (total) line.append(node("b", "", total));
      return line;
    };
    if (!state) {
      dealerRow.append(label("ディーラー"), cards([null, null], false, 9));
      playerRow.append(label("あなた"), cards([null, null], false, 9));
      table.append(dealerRow, playerRow);
      body.append(
        modeSwitch(body, "dealer", "blackjack"),
        table,
        betBar("blackjack", "配る", (bet) => {
          const money = round("blackjack");
          money.stake(bet);
          const dealt = C.bjDeal(bet, random);
          dealt.money = money;
          finishIfDone(dealt);
          blackjack(body, dealt, { player: 0, dealer: 0 });
        }),
        rules("ブラックジャックの遊び方", [
          "カードの合計を21に近づけます。21を超えたら負けです。",
          "絵札（J・Q・K）は10、Aは1か11の都合のよいほうで数えます。",
          "「もう1枚」で引き、「これで勝負」で止めます。ディーラーは17以上になるまで引きます。",
          "勝つと賭けた分がもらえます。最初の2枚でA＋10点札（ブラックジャック）なら1.5倍です。",
          "「倍にして1枚」は賭けを2倍にして、あと1枚だけ引きます。",
        ]),
      );
      return refresh();
    }
    const hidden = !state.done;
    const dealerTotal = hidden ? C.bjTotal([state.dealer[0]]).total + " ＋ ?" : String(C.bjTotal(state.dealer).total);
    dealerRow.append(label("ディーラー", dealerTotal), cards(state.dealer, hidden, shown.dealer));
    const mine = C.bjTotal(state.player);
    playerRow.append(label("あなた", String(mine.total) + (mine.soft && mine.total < 21 ? "（Aを11で数えています）" : "")), cards(state.player, false, shown.player));
    table.append(dealerRow, playerRow);
    body.append(table);
    const next = { player: state.player.length, dealer: hidden ? 2 : state.dealer.length };
    if (!state.done) {
      const actions = node("div", "cs-actions");
      const button = (text, fn, primary) => {
        const b = node("button", primary ? "cs-primary" : "", text);
        b.type = "button";
        b.onclick = () => {
          const after = fn(state);
          after.money = state.money;
          finishIfDone(after);
          blackjack(body, after, next);
        };
        actions.append(b);
        return b;
      };
      const hit = button("もう1枚", C.bjHit);
      const stand = button("これで勝負", C.bjStand, true);
      const double = button("倍にして1枚", C.bjDouble);
      double.disabled = !C.bjCanDouble(state) || balance() < state.bet;
      if (!double.disabled) double.onclick = ((go) => () => (state.money.stake(state.bet), go()))(double.onclick);
      // For beginners: what most players would do here, and why.
      const tip = advice(state, !double.disabled);
      ({ hit, stand, double })[tip.move].classList.add("is-suggested");
      body.append(actions, node("p", "cs-advice", "迷ったら「" + { hit: "もう1枚", stand: "これで勝負", double: "倍にして1枚" }[tip.move] + "」：" + tip.why));
      body.append(node("p", "cs-hint", "賭けている額 " + fmt(state.bet * (state.doubled ? 2 : 1)) + unit()));
      return refresh();
    }
    const words = { blackjack: "ブラックジャック！", win: "あなたの勝ち", push: "引き分け（賭けは戻ります）", lose: "ディーラーの勝ち", bust: "21を超えました" };
    const out = result(words[state.outcome], state.net, state.outcome === "blackjack" ? "win" : "");
    if (state.outcome === "blackjack" && !state.celebrated) {
      state.celebrated = true;
      bigWin("BLACKJACK", state.net, "最初の2枚で21", 700);
    }
    // The result shows once the dealer's cards have turned over.
    out.style.setProperty("--d", Math.max(0, state.dealer.length - shown.dealer) * 0.45 + 0.2 + "s");
    body.append(out, betBar("blackjack", "もう一度配る", (bet) => {
      const money = round("blackjack");
      money.stake(bet);
      const dealt = C.bjDeal(bet, random);
      dealt.money = money;
      finishIfDone(dealt);
      blackjack(body, dealt, { player: 0, dealer: 0 });
    }));
    refresh();
  }
  function advice(state, canDouble) {
    const mine = C.bjTotal(state.player),
      up = C.bjTotal([state.dealer[0]]).total;
    if (canDouble && (mine.total === 11 || (mine.total === 10 && up <= 9)) && !mine.soft) return { move: "double", why: "次に10点札が来やすい、勝負どころです" };
    if (mine.total <= 11) return { move: "hit", why: "11以下なら、引いても21を超えません" };
    if (mine.soft && mine.total <= 17) return { move: "hit", why: "Aを1と数え直せるので、超えにくい手です" };
    if (mine.total >= 17) return { move: "stand", why: "17以上は、引くと超えやすくなります" };
    if (up >= 7) return { move: "hit", why: "ディーラーの見えている札が強めです" };
    return { move: "stand", why: "ディーラーの札が弱め。相手が21を超えるのを待ちます" };
  }
  // Pays a finished round once: the stake (doubled or not) back plus what it won.
  function finishIfDone(state) {
    if (!state.done || state.paid) return;
    state.paid = true;
    const stake = state.bet * (state.doubled ? 2 : 1);
    if (stake + state.net > 0) state.money.pay(stake + state.net);
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
        modeSwitch(body, "dealer"),
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
  // Dealer or friends, at the top of each house game.
  function modeSwitch(body, active, kind = "dice") {
    const bar = node("div", "cs-mode");
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "遊び方");
    for (const [id, text] of [
      ["dealer", kind === "dice" ? "ディーラーと" : "ひとりで"],
      ["friend", kind === "dice" ? "フレンドとタイマン" : "フレンドと一緒に"],
    ]) {
      const b = node("button", "", text);
      b.type = "button";
      b.dataset.mode = id;
      b.setAttribute("aria-pressed", String(id === active));
      b.onclick = () => {
        if (id === active) return;
        leaveDuel();
        leaveGroup();
        body.classList.remove("is-roulette-body");
        if (kind === "dice") id === "friend" ? duelLobby(body) : dice(body);
        else if (id === "friend") groupLobby(body, kind);
        else ({ blackjack, roulette })[kind](body);
      };
      bar.append(b);
    }
    return bar;
  }
  function duelReady() {
    if (!real()) throw Error("フレンドとの対戦は、ログインしてクラウドにつながっているときに遊べます。");
    if (!window.fbOnSnapshot) throw Error("クラウドにつながっていません。");
  }
  function duelLobby(body, message = "") {
    body.replaceChildren(modeSwitch(body, "friend"));
    const panel = node("div", "cs-betbar cs-duel-lobby");
    panel.append(node("p", "cs-duel-title", "フレンドと1対1で勝負"), node("p", "cs-hint", "同じ額を賭けて、強い役を作ったほうが2人分をもらいます。"));
    const status = node("p", "cs-duel-status", message);
    status.setAttribute("role", "status");
    const guard = (fn) => async () => {
      status.textContent = "";
      try {
        await fn();
      } catch (error) {
        status.textContent = error?.message || "うまくいきませんでした。もう一度お試しください。";
      }
    };
    const make = betBar("duel", "テーブルを作る", (bet) => guard(async () => enterDuel(body, await createDuel(bet)))());
    const join = node("div", "cs-duel-join");
    const input = node("input");
    input.inputMode = "numeric";
    input.maxLength = 4;
    input.placeholder = "4桁の番号";
    input.setAttribute("aria-label", "テーブル番号");
    input.dataset.duelCode = "";
    const go = node("button", "cs-primary", "入る");
    go.type = "button";
    go.onclick = guard(async () => enterDuel(body, await joinDuel(input.value.trim())));
    join.append(input, go);
    panel.append(node("p", "cs-duel-step", "1. 自分でテーブルを作る"), make, node("p", "cs-duel-step", "2. または、相手の番号で入る"), join, status);
    body.append(
      panel,
      rules("フレンド対戦の遊び方", [
        "「テーブルを作る」で出る4桁の番号を相手に伝え、相手は「入る」に番号を入れます。",
        "そろったら2人とも賭けた額が引かれ、それぞれ自分のダイスを振ります（振り直しは2回まで）。",
        "相手のダイスは、両方が「これで勝負」を押すまで見えません。",
        "強い役のほうが2人分の賭けをもらいます。同じ役と目なら、賭けはそれぞれに戻ります。",
        "途中で相手が抜けたときは、あなたの賭けは戻ります。",
      ]),
    );
    refresh();
  }
  async function createDuel(bet) {
    duelReady();
    if (bet > balance()) throw Error("ポイントが足りません。");
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = String(1000 + random(9000));
      const made = await window.fbRunTransaction(window.db, async (tx) => {
        const snap = await tx.get(duelRef(code));
        if (snap.exists() && snap.data().status !== "closed") return false;
        tx.set(duelRef(code), { kind: "dice", version: 1, code, host: uid(), status: "waiting", createdAt: Date.now(), bet, round: 1, players: { [uid()]: { name: playerName(), joinedAt: Date.now() } }, hands: {}, rematch: {} });
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
  async function joinDuel(code) {
    duelReady();
    if (!/^\d{4}$/.test(code)) throw Error("4桁の番号を入れてください。");
    await updateDuel(code, (room) => {
      if (room.kind !== "dice") throw Error("この番号はダイスポーカーのテーブルではありません。");
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
  function enterDuel(body, code) {
    leaveDuel();
    duel = { code, body, room: null, moved: {} };
    const mine = duel;
    duel.unsub = window.fbOnSnapshot(duelRef(code), (snap) => {
      if (duel !== mine) return;
      if (!snap.exists()) return duelLobby(body, "テーブルが見つかりません。");
      duel.room = snap.data();
      drawDuel();
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
    body.replaceChildren(modeSwitch(body, "friend"));
    const head = node("div", "cs-duel-head");
    head.append(node("span", "", "テーブル " + room.code), node("b", "", "賭け " + fmt(room.bet) + "pt"));
    const leave = node("button", "cs-duel-leave", "抜ける");
    leave.type = "button";
    leave.onclick = async () => {
      await leaveDuel();
      duelLobby(body);
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
      if (hasMoved(room, "bet") && !(myHand && theirHand)) duelMove(room, "refund", room.bet);
      body.append(node("p", "cs-duel-wait", room.leftBy === me ? "テーブルを抜けました。" : "相手がテーブルを抜けました。" + (myHand && theirHand ? "" : "賭けは戻ります。")));
      const back = node("button", "cs-primary", "ロビーへ");
      back.type = "button";
      back.onclick = () => {
        leaveDuel(false);
        duelLobby(body);
      };
      const row = node("div", "cs-actions");
      row.append(back);
      body.append(row);
      return refresh();
    }
    duelMove(room, "bet", -room.bet);
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
    const out = result(order > 0 ? "あなたの勝ち" : order < 0 ? (other?.name || "相手") + "の勝ち" : "引き分け（賭けは戻ります）", net);
    out.style.setProperty("--d", "0.9s");
    body.append(out);
    if (order > 0 && C.diceScore(myHand.dice)[0] >= 6 && !duel.moved[roundKey(room) + ":big"]) {
      duel.moved[roundKey(room) + ":big"] = true;
      bigWin("WIN", room.bet, "フレンドに勝ちました", 1100);
    }
    const again = node("button", "cs-primary", room.rematch?.[me] ? "相手を待っています…" : "もう一勝負");
    again.type = "button";
    again.disabled = !!room.rematch?.[me] || balance() < room.bet;
    again.onclick = () =>
      updateDuel(room.code, (fresh) => {
        if (fresh.status !== "playing" || fresh.round !== room.round) return null;
        fresh.rematch = { ...(fresh.rematch || {}), [me]: true };
        // Both agreed: the next round starts with fresh hands.
        if (Object.keys(fresh.players).every((id) => fresh.rematch[id])) {
          fresh.round++;
          fresh.hands = {};
          fresh.rematch = {};
        }
        return fresh;
      }).catch(() => {});
    const row = node("div", "cs-actions");
    row.append(again);
    body.append(row);
    if (balance() < room.bet) body.append(node("p", "cs-hint", "もう一勝負するにはポイントが足りません。"));
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
  const GAME_NAMES = { blackjack: "ブラックジャック", roulette: "ルーレット" };
  let group = null;
  function groupLobby(body, kind, message = "") {
    leaveGroup();
    body.replaceChildren(modeSwitch(body, "friend", kind));
    const panel = node("div", "cs-betbar cs-duel-lobby");
    panel.append(
      node("p", "cs-duel-title", "フレンドと一緒に" + GAME_NAMES[kind]),
      node("p", "cs-hint", kind === "roulette" ? "同じルーレットに、それぞれ好きなところへ賭けます。勝ち負けは自分の賭けだけです。" : "同じディーラーを相手に、それぞれ自分の手で勝負します。順番に1人ずつ引きます。"),
    );
    const status = node("p", "cs-duel-status", message);
    status.setAttribute("role", "status");
    const guard = (fn) => async () => {
      status.textContent = "";
      try {
        await fn();
      } catch (error) {
        status.textContent = error?.message || "うまくいきませんでした。もう一度お試しください。";
      }
    };
    const make = node("button", "cs-primary", "テーブルを作る");
    make.type = "button";
    make.dataset.groupCreate = "";
    make.onclick = guard(async () => enterGroup(body, kind, await createGroup(kind)));
    const join = node("div", "cs-duel-join");
    const input = node("input");
    input.inputMode = "numeric";
    input.maxLength = 4;
    input.placeholder = "4桁の番号";
    input.setAttribute("aria-label", "テーブル番号");
    input.dataset.groupCode = "";
    const go = node("button", "cs-primary", "入る");
    go.type = "button";
    go.onclick = guard(async () => enterGroup(body, kind, await joinGroup(input.value.trim(), kind)));
    join.append(input, go);
    panel.append(node("p", "cs-duel-step", "1. 自分でテーブルを作る（最大" + GROUP_MAX + "人）"), make, node("p", "cs-duel-step", "2. または、フレンドの番号で入る"), join, status);
    body.append(
      panel,
      rules("フレンドと一緒に遊ぶには", [
        "「テーブルを作る」で出る4桁の番号をフレンドに伝え、フレンドは「入る」に番号を入れます。",
        "賭ける額や場所は、それぞれが自分で決めます。賭けた分は確定したときに引かれます。",
        kind === "roulette" ? "みんなが賭けたら、テーブルを作った人が「回す」を押します。" : "みんなが賭けたら、テーブルを作った人が「配る」を押します。順番が来たら自分の手を決めます。",
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
      if (room.kind !== kind) throw Error("この番号は" + GAME_NAMES[kind] + "のテーブルではありません。");
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
      if (!snap.exists()) return groupLobby(body, kind, "テーブルが見つかりません。");
      group.room = snap.data();
      drawGroup();
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
      const amount = room.kind === "roulette" ? Object.values(room.bets?.[uid()] || {}).reduce((a, v) => a + v, 0) : room.bets?.[uid()] || 0;
      if (amount) groupMove(room, "refund", amount + (groupHasMoved(room, "double") ? amount : 0));
    }
  }
  const nameOf = (room, id) => (id === uid() ? "あなた" : room.players[id]?.name || "だれか");
  function drawGroup() {
    const { room, body, kind } = group,
      me = uid(),
      host = room.host === me;
    body.replaceChildren(modeSwitch(body, "friend", kind));
    const head = node("div", "cs-duel-head");
    head.append(node("span", "", "テーブル " + room.code), node("b", "", Object.keys(room.players).length + "人"));
    const leave = node("button", "cs-duel-leave", "抜ける");
    leave.type = "button";
    leave.onclick = async () => {
      await leaveGroup();
      groupLobby(body, kind);
    };
    head.append(leave);
    body.append(head);
    if (room.status === "closed") {
      refundOpen(room);
      body.append(node("p", "cs-duel-wait", "テーブルを作った人が抜けたので、テーブルは終わりました。決まっていない賭けは戻ります。"));
      const back = node("button", "cs-primary", "ロビーへ");
      back.type = "button";
      back.onclick = () => groupLobby(body, kind);
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
    const felt = node("div", "cs-felt cs-bj cs-group-bj");
    const dealer = node("div", "cs-hand is-dealer");
    const line = (who, total) => {
      const l = node("p", "cs-hand-label");
      l.append(node("span", "", who));
      if (total) l.append(node("b", "", total));
      return l;
    };
    const cardRow = (list, hideSecond) => {
      const row = node("div", "cs-cards");
      list.forEach((c, i) => row.append(window.Poker.card(hideSecond && i === 1 ? null : c)));
      return row;
    };
    if (t) dealer.append(line("ディーラー", t.done ? String(C.bjTotal(t.dealer).total) : C.bjTotal([t.dealer[0]]).total + " ＋ ?"), cardRow(t.dealer, !t.done));
    else dealer.append(line("ディーラー"), cardRow([null, null]));
    felt.append(dealer);
    if (t)
      for (const id of t.order) {
        const h = t.hands[id];
        const seat = node("div", "cs-hand is-player cs-group-seat" + (id === me ? " is-me" : "") + (t.turn === id ? " is-turn" : ""));
        const total = C.bjTotal(h.cards).total;
        seat.append(line(nameOf(room, id) + "（" + fmt(h.bet * (h.doubled ? 2 : 1)) + "pt）", String(total) + (t.turn === id ? "・考え中" : "")), cardRow(h.cards));
        felt.append(seat);
      }
    body.append(felt);
    const hint = node("p", "cs-hint");
    const actions = node("div", "cs-actions");
    if (!t || room.phase === "betting") {
      // Betting: each joins this game with their own amount.
      if (!bet) {
        body.append(
          betBar("group-bj", "この額で参加", async (amount) => {
            const at = room.round;
            const done = await updateDuel(room.code, (fresh) => {
              if (fresh.status === "closed" || fresh.round !== at || fresh.phase !== "betting" || fresh.bets?.[me]) return null;
              fresh.bets = { ...(fresh.bets || {}), [me]: amount };
              return fresh;
            }).catch(() => false);
            if (done) groupMove({ ...room, round: at }, "bet", -amount);
          }),
        );
      } else hint.textContent = fmt(bet) + "pt で参加しています。" + (host ? "みんながそろったら配ってください" : "親が配るのを待っています");
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
            if (fresh.phase !== "betting" || fresh.round !== room.round) return null;
            const order = Object.keys(fresh.bets || {})
              .filter((id) => fresh.players[id])
              .sort((a, b) => fresh.players[a].joinedAt - fresh.players[b].joinedAt);
            if (!order.length) return null;
            fresh.game = C.tableDeal(order, fresh.bets, random);
            fresh.phase = fresh.game.done ? "done" : "playing";
            return fresh;
          }).catch(() => (deal.disabled = false));
        };
        actions.append(deal);
      }
    } else if (!t.done) {
      if (t.turn === me) {
        const act = (text, moveName, primary) => {
          const b = node("button", primary ? "cs-primary" : "", text);
          b.type = "button";
          b.onclick = async () => {
            b.disabled = true;
            const ok = await updateDuel(room.code, (fresh) => {
              if (!fresh.game || fresh.game.turn !== me || fresh.round !== room.round) return null;
              fresh.game = C.tableAct(fresh.game, me, moveName);
              if (fresh.game.done) fresh.phase = "done";
              return fresh;
            }).catch(() => false);
            if (ok && moveName === "double") groupMove(room, "double", -t.hands[me].bet);
            if (!ok) b.disabled = false;
          };
          actions.append(b);
          return b;
        };
        const hit = act("もう1枚", "hit"),
          stand = act("これで勝負", "stand", true),
          double = act("倍にして1枚", "double");
        double.disabled = !C.tableCanDouble(t, me) || balance() < t.hands[me].bet;
        const tip = advice({ player: t.hands[me].cards, dealer: t.dealer }, !double.disabled);
        ({ hit, stand, double })[tip.move].classList.add("is-suggested");
        hint.textContent = "あなたの番です。迷ったら「" + { hit: "もう1枚", stand: "これで勝負", double: "倍にして1枚" }[tip.move] + "」：" + tip.why;
      } else {
        hint.textContent = (t.order.includes(me) ? "" : "この勝負は見学中です。") + nameOf(room, t.turn) + "さんの番です";
        // The table's maker can move things on when someone is away.
        if (host && t.turn !== me) {
          const skip = node("button", "", nameOf(room, t.turn) + "さんを飛ばす");
          skip.type = "button";
          skip.onclick = () =>
            updateDuel(room.code, (fresh) => {
              if (!fresh.game || fresh.game.turn !== t.turn) return null;
              fresh.game = C.tableAct(fresh.game, t.turn, "stand");
              if (fresh.game.done) fresh.phase = "done";
              return fresh;
            }).catch(() => {});
          actions.append(skip);
        }
      }
    } else {
      // Done: each settles their own hand.
      const mine = C.tableOutcome(t, me);
      if (mine) {
        if (mine.stake + mine.net > 0) groupMove(room, "pay", mine.stake + mine.net);
        else groupMove(room, "settled", 0);
        const words = { blackjack: "ブラックジャック！", win: "あなたの勝ち", push: "引き分け（賭けは戻ります）", lose: "ディーラーの勝ち", bust: "21を超えました" };
        body.append(result(words[mine.outcome], mine.net, mine.outcome === "blackjack" ? "win" : ""));
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
    }
    body.append(hint, actions);
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
      if (fresh.game && !fresh.game.done) {
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
