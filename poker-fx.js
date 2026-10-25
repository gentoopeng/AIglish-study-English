// Motion for the poker table. The table is rebuilt on every change, so this compares each new
// state with the last one drawn and animates only what changed: cards dealt from the middle,
// the board turned over, chips thrown in and swept to the pot, a word for every move, folded
// cards slid away, the pot flown to the winner, and a burst when the game is won.
(function () {
  "use strict";
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const words = { fold: "降りる", check: "様子見", call: "同じだけ", raise: "上乗せ", allin: "全部！" };
  let seen = null;
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  // Where a seat sits, in pixels from the middle of the felt.
  function offset(felt, place) {
    const box = felt.getBoundingClientRect();
    return { x: ((place.x - 50) / 100) * box.width, y: ((place.y - 50) / 100) * box.height };
  }
  function layer(felt) {
    let fx = felt.querySelector(".pk-fx");
    if (!fx) {
      fx = node("div", "pk-fx");
      fx.setAttribute("aria-hidden", "true");
      felt.append(fx);
    }
    return fx;
  }
  // A short-lived element in the effects layer, removed when its animation ends.
  function spawn(fx, cls, at, vars, text, life = 1600) {
    const el = node("span", cls, text);
    el.style.left = at.x + "%";
    el.style.top = at.y + "%";
    for (const [k, v] of Object.entries(vars || {})) el.style.setProperty(k, v);
    fx.append(el);
    setTimeout(() => el.remove(), life);
    return el;
  }
  const POT = { x: 50, y: 50 };
  function chips(fx, from, to, count, felt, delay = 0) {
    const a = offset(felt, from),
      b = offset(felt, to);
    for (let i = 0; i < count; i++)
      spawn(fx, "pk-fly-chip", from, {
        "--tx": b.x - a.x + (i % 3) * 4 - 4 + "px",
        "--ty": b.y - a.y + Math.floor(i / 3) * 3 + "px",
        "--d": delay + i * 0.06 + "s",
      });
  }

  // After the table is drawn: `ring` lists the seats from the player round, `places` their spots.
  function decorate(view, room, ring, places, me) {
    const h = room.hand,
      felt = view.querySelector(".pk-felt"),
      key = room.code + ":" + (room.createdAt || 0);
    if (!felt) return;
    const was = seen && seen.key === key ? seen : null,
      now = {
        key,
        hand: h?.no ?? -1,
        street: h?.street || "",
        board: h?.board?.length || 0,
        bets: { ...(h?.bet || {}) },
        folded: { ...(h?.folded || {}) },
        stacks: Object.fromEntries(ring.map((id) => [id, h && h.seats.includes(id) ? h.stacks[id] : room.players[id]?.stack])),
        act: h ? JSON.stringify([h.no, h.street, h.last, h.bet]) : "",
        done: h?.street === "done",
        pot: h && h.street !== "done" ? window.PokerModel.potOf(h) : 0,
        over: room.status === "over",
        hole: was?.hole ?? -1,
        holeAt: was?.holeAt ?? 0,
        // When the deal, the newest board cards and the showdown began, so a redraw shortly
        // after carries on the same animation instead of cutting it off.
        dealAt: was && was.hand === (h?.no ?? -1) ? was.dealAt : performance.now(),
        boardAt: was && was.hand === (h?.no ?? -1) && was.board === (h?.board?.length || 0) ? was.boardAt : performance.now(),
        boardFrom: was && was.hand === (h?.no ?? -1) ? (was.board === (h?.board?.length || 0) ? was.boardFrom : was.board) : 0,
        doneAt: was && was.done && h?.street === "done" && was.hand === (h?.no ?? -1) ? was.doneAt : performance.now(),
      };
    seen = now;
    if (!was || calm()) return;
    const fx = layer(felt),
      sameHand = !!h && was.hand === now.hand,
      newHand = !!h && !sameHand,
      t = performance.now(),
      dealing = !!h && (t - now.dealAt) / 1000,
      at = (id) => places[ring.indexOf(id)] || POT;
    // A start time in the past shows as a negative delay, so the animation resumes mid-way.
    const since = (start) => (t - start) / 1000;
    ring.forEach((id, i) => {
      const seat = view.querySelector('.pk-seat[data-id="' + CSS.escape(id) + '"]');
      if (!seat) return;
      const from = offset(felt, at(id));
      // Dealt from the middle, one card to each player in turn, twice round.
      if (h && h.street !== "done" && dealing < 1.8)
        seat.querySelectorAll(".pk-seat-cards .pk-card").forEach((card, k) => {
          card.classList.add("pk-dealt");
          card.style.setProperty("--dx", -from.x + "px");
          card.style.setProperty("--dy", -from.y + "px");
          card.style.setProperty("--d", (i + k * ring.length) * 0.09 - dealing + "s");
        });
      if (now.done && since(now.doneAt) < 2.2) {
        seat.querySelectorAll(".pk-seat-cards .pk-card:not(.is-back)").forEach((card, k) => {
          card.classList.add("pk-reveal");
          card.style.setProperty("--d", 0.1 + k * 0.12 - since(now.doneAt) + "s");
        });
        if (seat.querySelector(".pk-won")) {
          seat.classList.add("is-winner");
          seat.style.setProperty("--w", -since(now.doneAt) + "s");
        }
      }
      const bet = seat.querySelector(".pk-bet"),
        before = sameHand && was.street === now.street ? was.bets[id] || 0 : 0;
      if (bet && (h.bet[id] || 0) > before) bet.classList.add("is-new");
      const stack = seat.querySelector(".pk-stack");
      if (stack && was.stacks[id] !== undefined && now.stacks[id] !== was.stacks[id])
        stack.classList.add(now.stacks[id] > was.stacks[id] ? "is-up" : "is-down");
      // Folded cards slide into the middle and fade.
      if (sameHand && h.folded[id] && !was.folded[id] && id !== me)
        for (let k = 0; k < 2; k++)
          spawn(fx, "pk-fly-card", at(id), { "--tx": -from.x + "px", "--ty": -from.y + "px", "--d": k * 0.08 + "s", "--r": (k ? 24 : -18) + "deg" });
      if (h?.toAct === id && (was.act !== now.act || newHand)) seat.classList.add("is-new-turn");
    });
    // A word over the player who just moved.
    if (h?.last && sameHand && was.act !== now.act) {
      const last = h.last,
        amount = ["call", "raise", "allin"].includes(last.type) && last.amount ? " " + last.amount.toLocaleString("ja-JP") : "";
      spawn(fx, "pk-act is-" + last.type, { x: at(last.id).x, y: at(last.id).y - 9 }, {}, words[last.type] + amount, 1500);
      if (["call", "raise", "allin"].includes(last.type)) chips(fx, at(last.id), { x: (at(last.id).x + 50) / 2, y: (at(last.id).y + 50) / 2 }, last.type === "call" ? 2 : 4, felt);
    }
    // A street ends: everyone's bets are swept into the pot.
    if (sameHand && was.street !== now.street)
      for (const [id, amount] of Object.entries(was.bets)) if (amount > 0) chips(fx, at(id), POT, 3, felt);
    const pot = view.querySelector(".pk-pot");
    if (pot && now.pot !== was.pot && now.pot > 0) pot.classList.add("is-bump");
    // Board cards turned over in order.
    if (now.board > now.boardFrom && since(now.boardAt) < 1.4)
      view.querySelectorAll(".pk-board .pk-card").forEach((card, i) => {
        if (i < now.boardFrom || i >= now.board) return;
        card.classList.add("pk-turnover");
        card.style.setProperty("--d", (i - now.boardFrom) * 0.18 - since(now.boardAt) + "s");
      });
    // The pot goes to the winners, and a winner at the table gets a burst of light.
    if (now.done && !was.done && h.result?.won)
      Object.entries(h.result.won).forEach(([id, amount], w) => {
        if (!amount) return;
        const gain = h.result.net?.[id] || 0;
        chips(fx, POT, at(id), 8, felt, 0.35 + w * 0.2);
        if (gain > 0) spawn(fx, "pk-win-text", { x: at(id).x, y: at(id).y - 12 }, { "--d": 0.9 + w * 0.2 + "s" }, "+" + gain.toLocaleString("ja-JP"), 2600);
        if (id === me) for (let s = 0; s < 14; s++) spawn(fx, "pk-spark", at(id), { "--a": s * (360 / 14) + "deg", "--d": 0.9 + (s % 3) * 0.05 + "s" }, undefined, 2200);
      });
    if (now.over && !was.over) over(view, room, me);
  }

  // My two cards: flown in from the middle of the table and turned face up.
  function hole(view, room, me) {
    const h = room.hand,
      cards = view.querySelectorAll(".pk-hole .pk-card");
    if (!h || !cards.length || !seen || calm()) return;
    if (seen.hole !== h.no) {
      seen.hole = h.no;
      seen.holeAt = performance.now();
    }
    const gone = (performance.now() - seen.holeAt) / 1000;
    if (gone > 2) return;
    const felt = view.querySelector(".pk-felt")?.getBoundingClientRect(),
      own = view.querySelector(".pk-hole")?.getBoundingClientRect();
    if (!felt || !own) return;
    const dx = felt.left + felt.width / 2 - (own.left + own.width / 2),
      dy = felt.top + felt.height / 2 - (own.top + own.height / 2),
      seats = (h.seats || []).length || 2,
      mine = Math.max(0, (h.seats || []).indexOf(me));
    cards.forEach((card, k) => {
      card.classList.add("pk-dealt", "pk-dealt-me");
      card.style.setProperty("--dx", dx + "px");
      card.style.setProperty("--dy", dy + "px");
      card.style.setProperty("--d", (mine + k * seats) * 0.09 - gone + "s");
    });
  }

  // End of a practice game: the chips won (or the hands played) counted up, and confetti for a win.
  function over(view, room, me) {
    const won = room.players[me]?.stack > 0;
    window.Ceremony?.play(
      won
        ? { style: "chips", result: true, count: room.players[me].stack, from: 0, word: "WIN", sub: "全員のチップを獲得", note: room.handNo + "ハンド", tone: "gold" }
        : { style: "fold", result: true, count: room.handNo || 0, from: 0, suffix: "ハンド", word: "GOOD GAME", sub: "チップがなくなりました", tone: "quiet" },
    );
    if (!won || calm()) return;
    const sky = node("div", "pk-confetti");
    sky.setAttribute("aria-hidden", "true");
    const colours = ["#e9d9a6", "#f3e9cf", "#c6b790", "#7dd3c0", "#f0a8a8"];
    for (let i = 0; i < 48; i++) {
      const bit = node("i");
      bit.style.left = Math.random() * 100 + "%";
      bit.style.background = colours[i % colours.length];
      bit.style.setProperty("--d", Math.random() * 0.8 + "s");
      bit.style.setProperty("--x", (Math.random() * 2 - 1) * 60 + "px");
      bit.style.setProperty("--r", Math.random() * 720 - 360 + "deg");
      sky.append(bit);
    }
    view.append(sky);
    setTimeout(() => sky.remove(), 4200);
  }
  function reset() {
    seen = null;
  }
  window.PokerFX = Object.freeze({ decorate, hole, reset });
})();
