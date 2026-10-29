// Rules for すごろくビンゴ in the casino tab, without any screen. A long game kept per player.
//
// A roll costs one fixed bet (one amount, so no bet size is better than another for balls or
// the jackpots). The piece goes round a ring of squares and the square decides:
//   normal   – a wheel of multiples of the bet (×0 to ×3, and ball slots)
//   event    – a four-way wheel: blackjack, dice poker or chinchiro is played once for the bet
//              (a win also gives a ball, a loss gives back half), or a sure ball (×1.5 back)
//   accident – a wheel: lose 0–2× the bet more, go back three squares, or go back to START
// Passing START gives a ball, nothing else.
// The 7×7 bingo card (48 numbers from 1–100, the middle free) is shared by every player and
// kept apart from each player's own state: { cells, owners }, owners[i] the id of whoever's
// ball opened cell i ("" closed, "*" the free middle). A ball is drawn from 1–100: on the card
// and still closed it opens there under the player's name; otherwise it pays 1.5× the bet.
// A finished line pays the bingo prize (3× the bet) and spins a 10-slot wheel: the bet × 5 / 10 /
// 20, four mini games, a miss, the jackpot, or the super-jackpot chance, a 5-slot wheel of the
// super jackpot, the jackpot twice, a bigger tapping game and "back" (the first wheel again).
// Two lines at once pay (n + 1)× and a line of only this player's balls soloBonus× more (not the
// jackpots). The bingo prize is shared by the balls on the finished lines: each other player's
// part waits in card.owed[id] until they next play (collect); the wheel and its mini game are
// the finisher's. The finished lines' numbers are then drawn afresh and their balls cleared.
// The jackpots are shared by the whole casino (see casino-jackpot.js); here they are only events.
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
    costs: [100],
    // The ring: 80 squares, about 23 rolls a lap. S start, n normal, E event, A accident.
    board: Array.from({ length: 80 }, (_, i) => (i === 0 ? "S" : i % 9 === 4 ? "E" : i % 10 === 7 ? "A" : "n")).join(""),
    // The normal wheel: 24 slots; a ball slot gives a ball and nothing else (a ball that misses
    // the card pays missPay).
    normal: {
      100: spread([...N(3), ...N(2), ...N(1.5), ...N(1.25), ...N(0.75, 2), ...N(0.5, 5), ...N(0.25, 7), ...N(0.1, 2), ...N(0, 1), ...BALL(0, 3)]),
    },
    // The event wheel's four choices, and what each result pays back as multiples of the bet.
    events: ["blackjack", "dice", "chinchiro", "ball"],
    eventPay: { lose: 0.5, push: 1, sure: 1.5 },
    // Balls are drawn from 1–NUMBERS; the card holds 48 of them. A ball not on the card (or
    // already open) pays this many times the bet instead.
    numbers: 100,
    missPay: 1.5,
    // A line made only of the player's own balls pays this many times more.
    soloBonus: 1.5,
    // Accident wheel: take: multiples of the bet taken on top, back: squares back, start: back to START.
    accident: [{ take: 0 }, { take: 0.5 }, { back: 3 }, { take: 1 }, { start: true }, { take: 1.5 }, { back: 3 }, { take: 2 }, { take: 0.5 }, { start: true }],
    // Wheels after a line. x: multiples of what was bet since the last line.
    // A line pays this many times the bet whatever the wheel gives (the "bingo prize").
    bingoPrize: 3,
    // After a line: x pays the bet × x; game starts a mini game; miss is the bingo prize alone;
    // the super-jackpot chance leads to the second wheel, where back spins the first again.
    wheels: {
      bingo: [{ x: 5 }, { game: "timer" }, { x: 10 }, { game: "tap" }, { jackpot: "jp" }, { game: "dice" }, { x: 20 }, { game: "math" }, { miss: true }, { next: "sjp" }],
      sjp: [{ jackpot: "sjp" }, { jackpot: "jp" }, { game: "tapex" }, { jackpot: "jp" }, { back: true }],
    },
    // Mini games, scored in points (multiplied like the line's other prizes):
    // timer – stop at 10 seconds: 1,000 less 5 for every 0.01 s off; tap / tapex – taps in 10
    // seconds × 10 / × 50; dice – the face × 100; math – a sum in 15 seconds, 500 if right.
    // Taps count up to `max` (12 a second is about as fast as a finger goes; a tapping tool
    // gains nothing past it).
    games: { timer: { target: 10, max: 1000, per: 5 }, tap: { seconds: 10, per: 10, max: 120 }, tapex: { seconds: 10, per: 50, max: 120 }, dice: { per: 100 }, math: { seconds: 15, prize: 500 } },
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
    const cells = pool.slice(0, CARD * CARD - 1);
    cells.splice(FREE, 0, 0);
    return { cells, owners: cells.map((n) => (n ? "" : "*")) };
  }
  // The card is shared, so anything read back is checked: numbers 1–100 once each with 0 in the
  // middle, "*" only there, ids of a sane length, and what is owed whole points.
  const ID = (id) => typeof id === "string" && id.length > 0 && id.length <= 64 && id !== "*";
  function validCard(card) {
    return (
      !!card &&
      Array.isArray(card.cells) &&
      card.cells.length === CARD * CARD &&
      card.cells.every((n, i) => (i === FREE ? n === 0 : Number.isInteger(n) && n >= 1 && n <= RULES.numbers)) &&
      new Set(card.cells).size === CARD * CARD &&
      Array.isArray(card.owners) &&
      card.owners.length === CARD * CARD &&
      card.owners.every((o, i) => (i === FREE ? o === "*" : o === "" || ID(o))) &&
      (card.owed === undefined || validOwed(card.owed))
    );
  }
  const validOwed = (owed) =>
    !!owed && typeof owed === "object" && !Array.isArray(owed) && Object.entries(owed).every(([id, n]) => ID(id) && Number.isInteger(n) && n >= 0 && n <= 1e7);
  // This player's part of other players' lines, taken off the card.
  function collect(sharedCard, me) {
    const card = clone(sharedCard),
      amount = card.owed?.[me] || 0;
    if (card.owed) delete card.owed[me];
    return { card, amount };
  }
  function newState() {
    return { v: 3, pos: 0, stake: 0, laps: 0, rolls: 0, bet: 0, won: 0, balls: 0, bingos: 0, best: 0, jps: 0, sjps: 0, shared: 0, pending: null, bonus: [], jpWait: [] };
  }
  // A player's own state; an older save (with its own card) keeps its place and counts.
  function valid(state) {
    return (
      !!state &&
      (state.v === 3 || state.v === 2) &&
      Number.isInteger(state.pos) &&
      state.pos >= 0 &&
      state.pos < SIZE &&
      ["stake", "laps", "rolls", "bet", "won", "balls"].every((k) => Number.isFinite(state[k]) && state[k] >= 0)
    );
  }
  function upgrade(state) {
    const { card, marks, lines, cards, ...rest } = state;
    const count = (k) => (Number.isFinite(rest[k]) && rest[k] >= 0 ? rest[k] : 0);
    return { ...newState(), ...rest, v: 3, bingos: count("bingos"), best: count("best"), jps: count("jps"), sjps: count("sjps"), shared: count("shared"), bonus: Array.isArray(rest.bonus) ? rest.bonus : [], jpWait: Array.isArray(rest.jpWait) ? rest.jpWait.filter((k) => k === "jp" || k === "sjp") : [] };
  }
  const isOpen = (card, i) => card.owners[i] !== "";
  const reach = (card) => LINES.map((_, i) => i).filter((i) => LINES[i].filter((c) => !isOpen(card, c)).length === 1);
  const pick = (list, random) => {
    const index = random(list.length);
    return { index, slot: list[index] };
  };

  // A ball is drawn from 1–100. On the card and still closed, it opens that number in the
  // player's name and any finished lines pay; otherwise it pays missPay × the bet.
  function ball(state, card, me, random, events, bet) {
    const number = random(RULES.numbers) + 1,
      cell = card.cells.indexOf(number);
    state.balls++;
    if (cell < 0 || isOpen(card, cell)) {
      const amount = money(bet * RULES.missPay);
      events.push({ t: "ball", number, cell: -1, miss: true, amount });
      return amount;
    }
    card.owners[cell] = me;
    events.push({ t: "ball", number, cell, owner: me });
    const lines = LINES.map((_, i) => i).filter((i) => LINES[i].every((c) => isOpen(card, c)));
    if (!lines.length) return 0;
    const cleared = [...new Set(lines.flatMap((l) => LINES[l]))].filter((c) => c !== FREE),
      solo = cleared.every((c) => card.owners[c] === me),
      mult = (lines.length > 1 ? lines.length + 1 : 1) * (solo ? RULES.soloBonus : 1);
    // Balls per player on the finished lines, for sharing the prize.
    const balls = {};
    for (const c of cleared) balls[card.owners[c]] = (balls[card.owners[c]] || 0) + 1;
    state.stake = 0;
    state.bingos += lines.length;
    events.push({ t: "line", lines, cells: [...new Set(lines.flatMap((l) => LINES[l]))], count: lines.length, solo, mult });
    const gain = spinLine(state, card, bet, mult, random, events, me, balls, cleared.length);
    // The finished lines start again: fresh numbers (not already on the card), no balls.
    const spare = Array.from({ length: RULES.numbers }, (_, i) => i + 1).filter((n) => !card.cells.includes(n));
    const numbers = {};
    for (const c of cleared) {
      const n = spare.splice(random(spare.length), 1)[0];
      card.cells[c] = n;
      card.owners[c] = "";
      numbers[c] = n;
    }
    events.push({ t: "reset", numbers });
    return gain;
  }
  // A line: the bingo prize, shared by the balls on it (others' parts go to card.owed, the
  // rounding stays with the finisher), then the wheel. A mini game is queued in state.bonus and
  // played on the screen (settleBonus); a jackpot waits in state.jpWait for the screen to pay.
  function spinLine(state, card, bet, mult, random, events, me, balls, count) {
    const prize = money(bet * RULES.bingoPrize * mult),
      shares = {};
    let given = 0;
    for (const [id, n] of Object.entries(balls)) {
      if (id === me) continue;
      shares[id] = Math.floor((prize * n) / count);
      given += shares[id];
      card.owed = card.owed || {};
      card.owed[id] = Math.min(1e7, (card.owed[id] || 0) + shares[id]);
    }
    let gain = prize - given;
    events.push({ t: "prize", amount: gain, total: prize, shares, mult });
    for (let wheel = "bingo"; wheel; ) {
      const slots = RULES.wheels[wheel],
        { index, slot } = pick(slots, random);
      const event = { t: "wheel", wheel, slots, index, base: bet, mult };
      events.push(event);
      wheel = null;
      if (slot.next) wheel = slot.next;
      else if (slot.back) wheel = "bingo";
      else if (slot.jackpot) {
        state[slot.jackpot === "jp" ? "jps" : "sjps"]++;
        // Paid by the screen from the casino's pot (CasinoJackpot.win), which may have to wait
        // for the network; until then it stays here.
        state.jpWait = (state.jpWait || []).concat([slot.jackpot]);
        events.push({ t: "jackpot", kind: slot.jackpot });
      }
      else if (slot.game) {
        state.bonus = (state.bonus || []).concat([{ game: slot.game, mult }]);
        events.push({ t: "bonus", game: slot.game, mult });
      } else if (slot.x) {
        event.amount = money(bet * slot.x * mult);
        gain += event.amount;
      }
    }
    return gain;
  }

  // Points for a mini game from what was done: seconds stopped at, taps, the face, right or not.
  function gameScore(game, done) {
    const g = RULES.games[game];
    if (game === "timer") return Number.isFinite(Number(done)) ? Math.max(0, g.max - Math.round(Math.abs(Number(done) - g.target) * 100) * g.per) : 0;
    if (game === "tap" || game === "tapex") return Math.min(g.max, Math.max(0, Math.floor(Number(done) || 0))) * g.per;
    if (game === "dice") return Math.min(6, Math.max(0, Math.floor(Number(done) || 0))) * g.per;
    if (game === "math") return done === true ? g.prize : 0;
    return 0;
  }
  // The first mini game waiting, finished with what was done; done === null when it was left.
  function settleBonus(before, done) {
    if (!before.bonus?.length) throw Error("no bonus");
    const state = clone(before),
      [game, ...rest] = state.bonus,
      score = done === null ? 0 : gameScore(game.game, done),
      gain = money(score * game.mult);
    state.bonus = rest;
    state.won += gain;
    state.best = Math.max(state.best || 0, gain);
    return { state, events: [{ t: "bonusResult", game: game.game, score, mult: game.mult, amount: gain }], gain };
  }
  // A sum for the mental-arithmetic game: middle-school level, whole numbers, negatives allowed.
  function sum(random) {
    const n = (lo, hi) => lo + random(hi - lo + 1);
    const kind = random(5);
    if (kind === 0) {
      const a = n(2, 30), b = n(2, 30), c = n(2, 9), plus = random(2);
      return { text: "(" + a + (plus ? " + " : " − ") + b + ") × " + c, answer: (plus ? a + b : a - b) * c };
    }
    if (kind === 1) {
      const a = n(2, 12), b = n(2, 12), d = n(2, 9), k = n(2, 12), plus = random(2);
      return { text: a + " × " + b + (plus ? " + " : " − ") + d * k + " ÷ " + d, answer: plus ? a * b + k : a * b - k };
    }
    if (kind === 2) {
      const a = n(2, 15), b = n(2, 9), c = n(2, 60);
      return { text: "−" + a + " × " + b + " + " + c, answer: -a * b + c };
    }
    if (kind === 3) {
      const a = n(10, 60), b = n(2, 9), c = n(2, 15), d = n(2, 15);
      return { text: a + " − " + b + " × (" + c + " − " + d + ")", answer: a - b * (c - d) };
    }
    const a = n(2, 9), b = n(2, 9), c = n(2, 9);
    return { text: "(−" + a + ") × (−" + b + ") − " + c + " × " + c, answer: a * b - c * c };
  }

  // One roll. Returns the new state, the events in order and what was paid out (gain, which
  // can be below 0 after an accident). On an event square the roll stops with state.pending set;
  // the game is played on the screen and finished with settle().
  // `card` is the shared card as it is now; the result carries the card as it is after the roll.
  function roll(before, sharedCard, cost, random, me = "me") {
    if (!RULES.costs.includes(cost)) throw Error("bad cost");
    if (before.pending || before.bonus?.length) throw Error("a game is waiting");
    const state = clone(before),
      card = clone(sharedCard),
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
        gain += ball(state, card, me, random, events, cost);
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
      if (slot.ball) gain += ball(state, card, me, random, events, cost);
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
        gain += ball(state, card, me, random, events, cost);
      } else {
        state.pending = { game: slot, bet: cost };
        events.push({ t: "game", game: slot, bet: cost });
      }
    }
    state.won += gain;
    state.best = Math.max(state.best || 0, gain);
    return { state, card, events, gain, cost };
  }

  // The end of an event game: m is the game's own result as multiples of the bet (1 even money,
  // 1.5 a blackjack, 0 a push, below 0 a loss). A win pays bet × (1 + m) and gives a ball, a
  // push gives the bet back and a loss gives back half.
  function settle(before, sharedCard, m, random, me = "me") {
    if (!before.pending) throw Error("no event");
    const state = clone(before),
      card = clone(sharedCard),
      events = [],
      bet = state.pending.bet;
    state.pending = null;
    let gain;
    if (m > 0) {
      gain = money(bet * (1 + m));
      events.push({ t: "result", outcome: "win", amount: gain });
      gain += ball(state, card, me, random, events, bet);
    } else if (m === 0) {
      gain = money(bet * RULES.eventPay.push);
      events.push({ t: "result", outcome: "push", amount: gain });
    } else {
      gain = money(bet * RULES.eventPay.lose);
      events.push({ t: "result", outcome: "lose", amount: gain });
    }
    state.won += gain;
    state.best = Math.max(state.best || 0, gain);
    return { state, card, events, gain };
  }

  const api = { RULES, LINES, CARD, FREE, SIZE, kindAt, newState, newCard, valid, validCard, collect, upgrade, roll, settle, settleBonus, gameScore, sum, reach };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SugorokuModel = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis);
