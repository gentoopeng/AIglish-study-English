// Rules for すごろくビンゴ in the casino tab, without any screen. A long game kept per player.
//
// A roll costs the chosen bet. The piece goes round a ring of squares and the square decides:
//   normal   – a wheel of multiples of the bet (×0 to ×3, and ball slots); bigger bets carry
//              more ball slots, the die itself is the same for every bet
//   event    – a four-way wheel: blackjack, dice poker or chinchiro is played once for the bet
//              (a win also gives a ball, a loss gives back half), or a sure ball (×1.5 back)
//   accident – a wheel: lose 0–2× the bet more, go back three squares, or go back to START
// Passing START gives a ball, nothing else.
// A ball is drawn from 1–100. If it is on the 7×7 card (48 numbers from 1–100, the middle free)
// and still closed it opens there; otherwise it pays 1.5× the bet. A new line spins the
// bingo wheel on what was bet since the last line; two of its 20 slots lead to the jackpot
// wheel, whose jackpot and super-jackpot-chance slots are two in 20 each (one in ten), and so on.
// The jackpots themselves are shared by the whole casino (see casino-jackpot.js); here they are
// only events for the screen and the caller to pay.
//
// Every amount lives in RULES so it can be tuned. `random(n)` gives 0..n-1.
(function (root) {
  "use strict";
  // Lays a wheel out so the same slot is spread round it instead of sitting side by side: each
  // kind, most common first, takes the free places nearest to evenly spaced points.
  function spread(list) {
    const groups = new Map();
    for (const slot of list) {
      const key = JSON.stringify(slot);
      groups.set(key, (groups.get(key) || []).concat([slot]));
    }
    const out = Array(list.length).fill(null),
      n = list.length;
    let offset = 0;
    for (const items of [...groups.values()].sort((a, b) => b.length - a.length)) {
      items.forEach((slot, k) => {
        let at = Math.round(offset + (k * n) / items.length) % n;
        while (out[at]) at = (at + 1) % n;
        out[at] = slot;
      });
      offset += 1.7;
    }
    return out;
  }
  const N = (x, n = 1) => Array(n).fill({ x });
  const BALL = (x = 1, n = 1) => Array(n).fill({ x, ball: true });
  const RULES = {
    costs: [10, 50, 100],
    // The ring: 80 squares, about 23 rolls a lap. S start, n normal, E event, A accident.
    board: Array.from({ length: 80 }, (_, i) => (i === 0 ? "S" : i % 9 === 4 ? "E" : i % 10 === 7 ? "A" : "n")).join(""),
    // Normal wheels by bet: 24 slots each; a ball slot gives a ball and nothing else (a ball that
    // misses the card pays missPay).
    normal: {
      10: spread([...N(3), ...N(2), ...N(1.5), ...N(1.25, 2), ...N(0.75, 5), ...N(0.5, 5), ...N(0.25, 5), ...N(0.1, 2), ...N(0, 1), ...BALL(0, 1)]),
      50: spread([...N(3), ...N(2), ...N(1.5), ...N(1.25, 2), ...N(0.75, 4), ...N(0.5, 4), ...N(0.25, 6), ...N(0.1, 2), ...N(0, 1), ...BALL(0, 2)]),
      100: spread([...N(3), ...N(2), ...N(1.5), ...N(1.25, 2), ...N(0.75, 2), ...N(0.5, 4), ...N(0.25, 6), ...N(0.1, 3), ...N(0, 1), ...BALL(0, 3)]),
    },
    // The event wheel's four choices, and what each result pays back as multiples of the bet.
    events: ["blackjack", "dice", "chinchiro", "ball"],
    eventPay: { lose: 0.5, push: 1, sure: 1.5 },
    // Balls are drawn from 1–NUMBERS; the card holds 48 of them. A ball not on the card (or
    // already open) pays this many times the bet instead.
    numbers: 100,
    missPay: 1.5,
    // Accident wheel: take: multiples of the bet taken on top, back: squares back, start: back to START.
    accident: [{ take: 0 }, { take: 0.5 }, { back: 3 }, { take: 1 }, { start: true }, { take: 1.5 }, { back: 3 }, { take: 2 }, { take: 0.5 }, { start: true }],
    // Wheels after a line. x: multiples of what was bet since the last line.
    wheels: {
      bingo: spread([...N(0.02, 4), ...N(0.05, 4), ...N(0.08, 3), ...N(0.1, 3), ...N(0.15, 2), ...N(0.2, 1), ...N(0.3, 1), ...Array(2).fill({ next: "jp" })]),
      jp: spread([...N(0.2, 4), ...N(0.3, 4), ...N(0.4, 3), ...N(0.5, 3), ...N(0.8, 1), ...N(1, 1), ...Array(2).fill({ jackpot: "jp" }), ...Array(2).fill({ next: "sjp" })]),
      sjp: spread([...N(1, 4), ...N(1.5, 4), ...N(2, 4), ...N(2.5, 3), ...N(3, 2), ...N(5, 1), ...Array(2).fill({ jackpot: "sjp" })]),
    },
  };
  const SIZE = RULES.board.length,
    CARD = 7,
    FREE = 24;
  const KIND = { S: "start", n: "normal", E: "event", A: "accident" };
  const kindAt = (i) => KIND[RULES.board[i]];
  const LINES = (() => {
    const lines = [],
      seq = [0, 1, 2, 3, 4, 5, 6];
    for (let i = 0; i < CARD; i++) {
      lines.push(seq.map((j) => i * CARD + j));
      lines.push(seq.map((j) => j * CARD + i));
    }
    lines.push(seq.map((j) => j * CARD + j), seq.map((j) => j * CARD + (CARD - 1 - j)));
    return lines;
  })();
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const money = (n) => Math.round(n);

  // A fresh card: 48 different numbers from 1–100 in random places, the middle free.
  function newCard(random) {
    const pool = Array.from({ length: RULES.numbers }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = random(i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const numbers = pool.slice(0, CARD * CARD - 1);
    numbers.splice(FREE, 0, 0);
    return { card: numbers, marks: numbers.map((n) => n === 0), lines: [] };
  }
  function newState(random) {
    return { v: 2, pos: 0, ...newCard(random), stake: 0, laps: 0, rolls: 0, bet: 0, won: 0, balls: 0, cards: 0, bingos: 0, pending: null };
  }
  function valid(state) {
    return (
      !!state &&
      state.v === 2 &&
      Array.isArray(state.card) &&
      state.card.length === CARD * CARD &&
      Array.isArray(state.marks) &&
      state.marks.length === CARD * CARD &&
      Array.isArray(state.lines) &&
      Number.isInteger(state.pos) &&
      state.pos >= 0 &&
      state.pos < SIZE &&
      ["stake", "laps", "rolls", "bet", "won", "balls"].every((k) => Number.isFinite(state[k]) && state[k] >= 0)
    );
  }
  const reach = (state) => LINES.map((_, i) => i).filter((i) => !state.lines.includes(i) && LINES[i].filter((c) => !state.marks[c]).length === 1);
  const pick = (list, random) => {
    const index = random(list.length);
    return { index, slot: list[index] };
  };

  // A ball is drawn from 1–100. On the card and still closed, it opens that number and any new
  // lines spin their wheels; otherwise it pays missPay × the bet.
  function ball(state, random, events, bet) {
    const number = random(RULES.numbers) + 1,
      cell = state.card.indexOf(number);
    state.balls++;
    if (cell < 0 || state.marks[cell]) {
      const amount = money(bet * RULES.missPay);
      events.push({ t: "ball", number, cell: -1, miss: true, amount });
      return amount;
    }
    state.marks[cell] = true;
    events.push({ t: "ball", number, cell });
    let gain = 0;
    const lines = LINES.map((_, i) => i).filter((i) => !state.lines.includes(i) && LINES[i].every((c) => state.marks[c]));
    if (lines.length) {
      const base = state.stake / lines.length;
      state.stake = 0;
      for (const line of lines) {
        state.lines.push(line);
        state.bingos++;
        events.push({ t: "line", line, cells: LINES[line] });
        gain += spinLine(base, random, events);
      }
    }
    if (state.marks.every(Boolean)) {
      state.cards++;
      Object.assign(state, newCard(random));
      events.push({ t: "complete", cards: state.cards });
    }
    return gain;
  }
  function spinLine(base, random, events) {
    let gain = 0;
    for (let wheel = "bingo"; wheel; ) {
      const slots = RULES.wheels[wheel],
        { index, slot } = pick(slots, random);
      const event = { t: "wheel", wheel, slots, index, base };
      events.push(event);
      wheel = null;
      if (slot.next) wheel = slot.next;
      else if (slot.jackpot) events.push({ t: "jackpot", kind: slot.jackpot });
      else {
        event.amount = money(base * slot.x);
        gain += event.amount;
      }
    }
    return gain;
  }

  // One roll. Returns the new state, the events in order and what was paid out (gain, which
  // can be below 0 after an accident). On an event square the roll stops with state.pending set;
  // the game is played on the screen and finished with settle().
  function roll(before, cost, random) {
    if (!RULES.costs.includes(cost)) throw Error("bad cost");
    if (before.pending) throw Error("an event is waiting");
    const state = clone(before),
      events = [];
    let gain = 0;
    state.rolls++;
    state.bet += cost;
    state.stake += cost;
    const die = random(6) + 1;
    events.push({ t: "die", value: die });
    for (let s = 0; s < die; s++) {
      state.pos = (state.pos + 1) % SIZE;
      events.push({ t: "step", to: state.pos });
      if (state.pos === 0) {
        state.laps++;
        events.push({ t: "lap" });
        gain += ball(state, random, events, cost);
      }
    }
    const kind = kindAt(state.pos);
    events.push({ t: "land", square: state.pos, kind });
    if (kind === "normal" || kind === "start") {
      const slots = RULES.normal[cost],
        { index, slot } = pick(slots, random),
        amount = money(cost * slot.x);
      events.push({ t: "wheel", wheel: "normal", slots, index, base: cost, amount });
      gain += amount;
      if (slot.ball) gain += ball(state, random, events, cost);
    } else if (kind === "accident") {
      const { index, slot } = pick(RULES.accident, random);
      events.push({ t: "wheel", wheel: "accident", slots: RULES.accident, index, base: cost });
      if (slot.start) {
        state.pos = 0;
        events.push({ t: "back", to: 0 });
      } else if (slot.back) {
        state.pos = Math.max(0, state.pos - slot.back);
        events.push({ t: "back", to: state.pos, by: slot.back });
      } else if (slot.take) {
        const amount = money(cost * slot.take);
        gain -= amount;
        events.push({ t: "take", amount });
      }
    } else {
      const { index, slot } = pick(RULES.events, random);
      events.push({ t: "wheel", wheel: "event", slots: RULES.events, index, base: cost });
      if (slot === "ball") {
        const amount = money(cost * RULES.eventPay.sure);
        gain += amount;
        events.push({ t: "sure", amount });
        gain += ball(state, random, events, cost);
      } else {
        state.pending = { game: slot, bet: cost };
        events.push({ t: "game", game: slot, bet: cost });
      }
    }
    state.won += gain;
    return { state, events, gain, cost };
  }

  // The end of an event game: m is the game's own result as multiples of the bet (1 even money,
  // 1.5 a blackjack, 0 a push, below 0 a loss). A win pays bet × (1 + m) and gives a ball, a
  // push gives the bet back and a loss gives back half.
  function settle(before, m, random) {
    if (!before.pending) throw Error("no event");
    const state = clone(before),
      events = [],
      bet = state.pending.bet;
    state.pending = null;
    let gain;
    if (m > 0) {
      gain = money(bet * (1 + m));
      events.push({ t: "result", outcome: "win", amount: gain });
      gain += ball(state, random, events, bet);
    } else if (m === 0) {
      gain = money(bet * RULES.eventPay.push);
      events.push({ t: "result", outcome: "push", amount: gain });
    } else {
      gain = money(bet * RULES.eventPay.lose);
      events.push({ t: "result", outcome: "lose", amount: gain });
    }
    state.won += gain;
    return { state, events, gain };
  }

  const api = { RULES, LINES, CARD, FREE, SIZE, kindAt, newState, newCard, valid, roll, settle, reach };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SugorokuModel = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis);
