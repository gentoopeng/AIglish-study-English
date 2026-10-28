// Rules for すごろくビンゴ in the casino tab, without any screen. A long game kept per player:
// each roll costs points, the piece goes round a 24-square ring, the square's number is marked
// on a 5×5 bingo card (the middle is free) and the square's effect happens. A new line on the
// card spins a 10-slot roulette worth a multiple of what was bet since the last line; one slot
// leads to the jackpot chance, and from there one slot to the super jackpot chance.
//
// The two jackpots are the player's own pools: part of every bet goes in, and winning one
// empties it back to its seed. Amounts and the line-up all live in RULES so they can be tuned.
// `random(n)` gives 0..n-1; the app passes a crypto-backed one, the tests a fixed one.
(function (root) {
  "use strict";
  const RULES = {
    costs: [10, 50, 100],
    // A lap past START pays this many times the roll's cost.
    lap: 0.3,
    // What each bet adds to the pools, and what a pool starts again from.
    pool: { jp: 0.03, sjp: 0.01, jpSeed: 100, sjpSeed: 1000 },
    // Free rolls and extra moves in a row stop after this many, so one roll always ends.
    chain: 6,
    // The ring, from START. pt: points × cost, again: a free roll, go: k more squares,
    // bonus: one more number on the card at random.
    board: [
      { kind: "start" },
      { kind: "pt", m: 0.2 },
      { kind: "plain" },
      { kind: "pt", m: 0.5 },
      { kind: "go", k: 2 },
      { kind: "plain" },
      { kind: "again" },
      { kind: "pt", m: 0.2 },
      { kind: "pt", m: 1 },
      { kind: "plain" },
      { kind: "pt", m: 0.2 },
      { kind: "go", k: 3 },
      { kind: "bonus" },
      { kind: "plain" },
      { kind: "pt", m: 0.2 },
      { kind: "plain" },
      { kind: "pt", m: 0.5 },
      { kind: "pt", m: 1.5 },
      { kind: "plain" },
      { kind: "pt", m: 0.2 },
      { kind: "again" },
      { kind: "plain" },
      { kind: "pt", m: 0.5 },
      { kind: "plain" },
    ],
    // Roulettes: x is a multiple of what was bet since the last line.
    wheels: {
      1: [{ x: 0.1 }, { x: 0.1 }, { x: 0.2 }, { x: 0.2 }, { x: 0.3 }, { x: 0.3 }, { x: 0.5 }, { x: 0.8 }, { x: 1 }, { next: 2 }],
      2: [{ x: 0.5 }, { x: 0.5 }, { x: 1 }, { x: 1 }, { x: 1.5 }, { x: 2 }, { x: 3 }, { x: 5 }, { jp: "jp" }, { next: 3 }],
      3: [{ x: 2 }, { x: 3 }, { x: 4 }, { x: 5 }, { x: 6 }, { x: 8 }, { x: 10 }, { jp: "jp" }, { jp: "jp" }, { jp: "sjp" }],
    },
  };
  const SIZE = RULES.board.length,
    FREE = 12;
  const LINES = (() => {
    const lines = [];
    for (let i = 0; i < 5; i++) {
      lines.push([0, 1, 2, 3, 4].map((j) => i * 5 + j));
      lines.push([0, 1, 2, 3, 4].map((j) => j * 5 + i));
    }
    lines.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
    return lines;
  })();
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const round = (n) => Math.round(n);

  // A fresh card: the numbers 1–24 (one for each square) in random places, the middle free.
  function newCard(random) {
    const numbers = Array.from({ length: SIZE }, (_, i) => i + 1);
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = random(i + 1);
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    numbers.splice(FREE, 0, 0);
    return { card: numbers, marks: numbers.map((n) => n === 0), lines: [] };
  }
  function newState(random) {
    return { v: 1, pos: 0, ...newCard(random), stake: 0, jp: RULES.pool.jpSeed, sjp: RULES.pool.sjpSeed, bet: 0, won: 0, rolls: 0, laps: 0, cards: 0, jpWins: 0, sjpWins: 0 };
  }
  // A saved state from an older or broken copy is started again rather than trusted.
  function valid(state) {
    return (
      !!state &&
      state.v === 1 &&
      Array.isArray(state.card) &&
      state.card.length === 25 &&
      Array.isArray(state.marks) &&
      state.marks.length === 25 &&
      Array.isArray(state.lines) &&
      Number.isInteger(state.pos) &&
      state.pos >= 0 &&
      state.pos < SIZE &&
      ["stake", "jp", "sjp", "bet", "won", "rolls"].every((k) => Number.isFinite(state[k]) && state[k] >= 0)
    );
  }
  const newLines = (state) => LINES.map((cells, i) => i).filter((i) => !state.lines.includes(i) && LINES[i].every((c) => state.marks[c]));
  // How much is on the card: marks and which lines are one away.
  function reach(state) {
    return LINES.map((cells, i) => i).filter((i) => !state.lines.includes(i) && LINES[i].filter((c) => !state.marks[c]).length === 1);
  }

  // One spin chain for a line: stage 1, and onward while a chance slot comes up.
  function spin(state, base, random, events) {
    let gain = 0;
    for (let stage = 1; stage; ) {
      const slots = RULES.wheels[stage],
        index = random(slots.length),
        slot = slots[index];
      const event = { t: "spin", stage, index, slots, base };
      events.push(event);
      if (slot.next) {
        stage = slot.next;
        continue;
      }
      if (slot.jp) {
        const amount = round(state[slot.jp]);
        state[slot.jp] = slot.jp === "jp" ? RULES.pool.jpSeed : RULES.pool.sjpSeed;
        state[slot.jp + "Wins"] = (state[slot.jp + "Wins"] || 0) + 1;
        event.amount = amount;
        events.push({ t: "jackpot", kind: slot.jp, amount });
        gain += amount;
      } else {
        event.amount = round(base * slot.x);
        gain += event.amount;
      }
      stage = 0;
    }
    return gain;
  }

  // One roll, with every free roll and extra move it leads to. Returns the new state, the
  // events in order (for the screen) and the points paid out; `cost` is taken by the caller.
  function roll(before, cost, random) {
    if (!RULES.costs.includes(cost)) throw Error("bad cost");
    const state = clone(before),
      events = [];
    let gain = 0,
      rolls = 1,
      chain = 0;
    state.rolls++;
    state.bet += cost;
    state.stake += cost;
    state.jp += cost * RULES.pool.jp;
    state.sjp += cost * RULES.pool.sjp;
    const mark = (number, by) => {
      const cell = state.card.indexOf(number);
      if (cell < 0 || state.marks[cell]) return;
      state.marks[cell] = true;
      events.push({ t: "fill", number, cell, by });
    };
    const land = (square) => {
      const info = RULES.board[square];
      events.push({ t: "land", square, kind: info.kind });
      mark(square + 1, "land");
      if (info.kind === "pt") {
        const amount = round(cost * info.m);
        gain += amount;
        events.push({ t: "pt", square, amount });
      } else if (info.kind === "bonus") {
        const open = state.card.filter((n, i) => !state.marks[i]);
        if (open.length) mark(open[random(open.length)], "bonus");
      } else if (info.kind === "again" && chain < RULES.chain) {
        chain++;
        rolls++;
        events.push({ t: "again" });
      } else if (info.kind === "go" && chain < RULES.chain) {
        chain++;
        events.push({ t: "go", k: info.k });
        walk(info.k);
      }
    };
    const walk = (steps) => {
      for (let s = 0; s < steps; s++) {
        state.pos = (state.pos + 1) % SIZE;
        events.push({ t: "step", to: state.pos });
        if (state.pos === 0) {
          const amount = round(cost * RULES.lap);
          state.laps++;
          gain += amount;
          events.push({ t: "lap", amount });
        }
      }
      land(state.pos);
    };
    while (rolls > 0) {
      rolls--;
      const die = random(6) + 1;
      events.push({ t: "die", value: die, free: events.length > 0 });
      walk(die);
    }
    // New lines spin on what was bet since the last line, shared when several come at once;
    // the card starts again when full.
    const lines = newLines(state);
    if (lines.length) {
      const base = state.stake / lines.length;
      state.stake = 0;
      for (const line of lines) {
        state.lines.push(line);
        events.push({ t: "line", line, cells: LINES[line] });
        gain += spin(state, base, random, events);
      }
    }
    if (state.marks.every(Boolean)) {
      state.cards++;
      Object.assign(state, newCard(random));
      events.push({ t: "complete", cards: state.cards });
    }
    state.won += gain;
    return { state, events, gain, cost };
  }

  const api = { RULES, LINES, FREE, SIZE, newState, newCard, valid, roll, reach, newLines };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SugorokuModel = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis);
