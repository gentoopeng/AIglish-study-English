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
  function move(key, delta) {
    if (!delta) return;
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
    { id: "poker", name: "ポーカー", line: "みんなやコンピュータと" },
    { id: "blackjack", name: "ブラックジャック", line: "21に近いほうが勝ち" },
    { id: "roulette", name: "ルーレット", line: "玉が止まる数字を当てる" },
    { id: "dice", name: "ダイスポーカー", line: "5つのダイスで役をつくる" },
  ];

  // ---- The tab ---------------------------------------------------------------------------
  function mount() {
    const host = document.getElementById("view-casino");
    if (!host) return;
    if (!host.childElementCount) {
      host.innerHTML =
        '<section class="casino" aria-label="カジノ"><header class="casino-head"><span class="casino-chip">' +
        CHIP_SVG +
        '</span><div><small data-casino-unit></small><strong data-casino-balance></strong></div></header><div class="casino-games"></div><p class="casino-note"></p></section>';
      const list = host.querySelector(".casino-games");
      for (const game of GAMES) {
        const button = node("button", "casino-game mode-" + game.id);
        button.type = "button";
        button.dataset.game = game.id;
        button.innerHTML = '<span class="casino-pic">' + PICTURES[game.id] + "</span>";
        button.append(node("b", "", game.name), node("small", "", game.line));
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
      host.querySelector(".casino-note").textContent = real()
        ? "ブラックジャック・ルーレット・ダイスポーカーは1回" + fmt(MAX_BET) + "ptまで賭けられます。"
        : "ゲストやオフラインのときは練習チップで遊べます（ポイントは増減しません）。";
    }
    screen?.querySelector("[data-cs-balance]")?.replaceChildren(fmt(balance()) + unit());
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
      'を閉じる">×</button><header class="cs-bar"><div><p class="cs-kicker">CASINO</p><h2></h2></div><p class="cs-balance"><span class="cs-coin">' +
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
    return line;
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
      button("もう1枚", C.bjHit);
      button("これで勝負", C.bjStand, true);
      const double = button("倍にして1枚", C.bjDouble);
      double.disabled = !C.bjCanDouble(state) || balance() < state.bet;
      if (!double.disabled) double.onclick = ((go) => () => (state.money.stake(state.bet), go()))(double.onclick);
      body.append(actions);
      body.append(node("p", "cs-hint", "賭けている額 " + fmt(state.bet * (state.doubled ? 2 : 1)) + unit()));
      return refresh();
    }
    const words = { blackjack: "ブラックジャック！", win: "あなたの勝ち", push: "引き分け（賭けは戻ります）", lose: "ディーラーの勝ち", bust: "21を超えました" };
    const out = result(words[state.outcome], state.net, state.outcome === "blackjack" ? "win" : "");
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
  function roulette(body) {
    body.replaceChildren();
    const bets = new Map();
    let chip = 10,
      spinning = false,
      turned = 0;
    const wheel = node("div", "cs-wheel");
    wheel.innerHTML = wheelSvg() + '<span class="cs-pointer" aria-hidden="true"></span><output class="cs-landed" aria-live="polite"></output>';
    const board = node("div", "cs-board");
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
    const zero = spotButton("0", "0", "is-green is-zero");
    const numbers = node("div", "cs-numbers");
    for (let n = 1; n <= 36; n++) numbers.append(spotButton(String(n), String(n), "is-" + C.colourOf(n)));
    const outside = node("div", "cs-outside");
    for (const on of ["d1", "d2", "d3", "low", "even", "red", "black", "odd", "high"]) outside.append(spotButton(on, C.SPOTS[on].label, on === "red" ? "is-red" : on === "black" ? "is-black" : ""));
    board.append(zero, numbers, outside);
    const chipRow = node("div", "cs-chips cs-chip-pick");
    chipRow.setAttribute("aria-label", "置くチップ");
    for (const value of CHIPS) {
      const b = node("button", "cs-chip-btn", fmt(value));
      b.type = "button";
      b.setAttribute("aria-pressed", String(value === chip));
      b.onclick = () => {
        chip = value;
        chipRow.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      };
      chipRow.append(b);
    }
    const total = node("p", "cs-hint");
    const message = node("p", "cs-result-slot");
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
      // The table is below the wheel on a phone: bring the wheel back into view to watch it turn.
      screen?.scrollTo({ top: 0, behavior: calm() ? "auto" : "smooth" });
      const money = round("roulette");
      money.stake(staked);
      refresh();
      const number = C.rouletteSpin(random),
        index = C.WHEEL.indexOf(number);
      // Several turns, ending with the winning pocket under the pointer at the top.
      turned += 360 * 5 + ((360 - ((index * 360) / 37 + (turned % 360))) % 360 + 360) % 360;
      wheel.querySelector(".cs-wheel-spin").style.transform = "rotate(" + turned + "deg)";
      wheel.querySelector(".cs-landed").textContent = "";
      message.replaceChildren();
      await later(3600);
      if (!screen || game?.body !== body) return;
      const outcome = C.rouletteSettle([...bets].map(([on, amount]) => ({ on, amount })), number);
      const back = outcome.lines.filter((l) => l.won).reduce((a, l) => a + l.amount + l.net, 0);
      if (back > 0) money.pay(back);
      const landed = wheel.querySelector(".cs-landed");
      landed.textContent = String(number);
      landed.className = "cs-landed is-" + outcome.colour;
      board.querySelectorAll(".cs-spot").forEach((b) => b.classList.toggle("is-hit", !!C.spot(b.dataset.on)?.hit(number)));
      const colour = { red: "赤", black: "黒", green: "緑" }[outcome.colour];
      message.replaceChildren(result(number + "（" + colour + "）" + (outcome.net > 0 ? " 当たり" : outcome.lines.some((l) => l.won) ? " 一部当たり" : " はずれ"), outcome.net));
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
      total.textContent = sum ? "賭けた合計 " + fmt(sum) + unit() : "置くチップを選んで、数字や色をタップ";
      spin.disabled = spinning || !sum || sum > balance();
      clear.disabled = spinning || !sum;
    }
    body.append(
      wheel,
      message,
      chipRow,
      board,
      total,
      actions,
      rules("ルーレットの遊び方", [
        "玉が止まる場所を予想してチップを置きます。いくつ置いても構いません。",
        "数字1つを当てると36倍（賭けた分＋35倍）。",
        "1〜12などの12個の組は3倍、赤・黒・奇数・偶数・1〜18・19〜36は2倍で戻ります。",
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
      const again = node("button", "", left ? "キープ以外を振る（あと" + left + "回）" : "もう振れません");
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
        dice(body, done, null);
      };
      actions.append(again, stand);
      body.append(actions, node("p", "cs-hint", left ? "残したいダイスをタップ" : "これで勝負しましょう"));
      return refresh();
    }
    const words = { win: "あなたの勝ち", lose: "ディーラーの勝ち", push: "引き分け（賭けは戻ります）" };
    const out = result(words[state.outcome], state.net);
    out.style.setProperty("--d", "0.9s");
    body.append(out, betBar("dice", "もう一度振る", start));
    refresh();
  }

  window.addEventListener("study-points-changed", refresh);
  window.onTabChange?.((tab) => {
    if (tab === "casino") mount();
  });
  window.Casino = Object.freeze({ open, close, mount, balance, _real: real });
})();
