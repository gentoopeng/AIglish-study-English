// Rules for すごろくビンゴ in the casino tab, without any screen. A long game kept per player.
//
// A roll costs a bet of 100 (every payout is a multiple of it). The piece goes round a ring of 100 squares and the square decides:
//   normal   – a wheel of multiples of the bet (×0.25 to −×1) and ball, game and 確変 slots;
//              a 確変 slot (1 in 10) spins the 確変 wheel: ×2 to ×10, or two balls in a row
//   event    – a four-way wheel: blackjack, dice poker or chinchiro is played once for the bet
//              (a win also gives a ball, a loss gives nothing back), or a sure ball (the bet back)
//   accident – a wheel: lose 0–2× the bet more, go back three squares, or go back to START
// Passing START gives a ball, nothing else.
// Items: a slot of the normal wheel spins the item wheel and a player holds up to itemMax of them
// One is used before a roll (roll()'s `use`):
// ダブルダイス / トリプルダイス throw two / three dice, ぴったり picks the face, ガード cancels accident squares
// for this and the next two rolls, 倍がけ doubles what the normal wheel pays or takes.
// The bingo cards: two 7×7 cards (98 numbers) shared by every player and kept apart from each
// player's own state: { v: 2, cells, owners, special }, cells[0..48] the first card and
// cells[49..97] the second, owners[i] the id of whoever's ball opened cell i ("" closed). A ball is
// drawn from 1–99: the 98 numbers on the cards cover all but one, the special number, so a ball
// opens a number unless that one is already open (then it pays 2× the bet); the special number
// spins the special wheel. A finished line pays the bingo prize (5× the bet) and spins a 10-slot wheel: the bet × 10 / 20 /
// 50, four mini games, the jackpot (twice), or the super-jackpot chance, a 5-slot wheel of the
// super jackpot, the jackpot twice, a bigger tapping game and "back" (the first wheel again).
// Two lines at once pay (n + 1)× and a line of only this player's balls soloBonus× more (not the
// jackpots, and not the mini games, which pay their points × bingoGameBoost). The bingo prize is shared by the balls on the finished lines, and wheelShare of the
// bingo wheel's multiples too: each other player's part waits in card.owed[id] until they next
// play (collect). The rest of the wheel, its mini game and any jackpot are the finisher's. The finished lines' balls are then cleared (the numbers stay).
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
  const GAME = (game, n = 1) => Array(n).fill({ x: 0, game });
  const EVENT = (event) => [{ x: 0, event }];
  // (A second kind of ×0 so the wheel can be laid out without equal slots side by side.)
  const KAKU = (n = 1) => Array(n).fill({ x: 0, kakuhen: true });
  // A normal-wheel slot that spins the item wheel.
  const ITEM = (n = 1) => Array(n).fill({ x: 0, item: true });
  const GET = (item, n = 1) => Array(n).fill({ item });
  const RULES = {
    // The bet of a roll: 50, 100 or 200. Every payout is a multiple of it, so nothing is better value at one
    // size than another; the bingo wheel's jackpot slots grow with it (bingoWheel) for the same reason.
    costs: [100],
    // The ring: 100 squares, about 29 rolls a lap. S start, n normal, E event, A accident.
    board: Array.from({ length: 100 }, (_, i) => (i === 0 ? "S" : i % 9 === 4 ? "E" : i % 10 === 7 ? "A" : "n")).join(""),
    // The normal wheel: 40 slots from ×7 down to −×5 (one is a 確変 slot) (a minus takes that much more than the
    // bet). A ball slot gives a ball and nothing else (a ball that misses the card pays missPay);
    // a game slot starts a quick mini game paid in multiples of the bet; an event slot plays
    // blackjack, dice poker or chinchiro as an event square does.
    normal: {
      // (The same wheel for every bet: it pays multiples of the bet.)
      100: spread([
        // The top of the wheel is a 確変 slot: it starts the 確変 wheel below, which holds the
        // multiples these slots used to pay (×10, ×5, ×1.5, ×1) and more besides.
        ...KAKU(1),
        // High risk, high return: a bad slot takes −1 to −5 times the bet, a good one gives up to 5 times.
        ...N(-5, 3), ...N(-2, 2), ...N(-1, 2),
        ...N(0, 6), ...ITEM(5),
        ...N(0.5, 3), ...N(2, 2), ...N(3), ...N(4, 2), ...N(5),
        ...BALL(0, 2), ...GAME("stop", 2), ...GAME("hilo", 2), ...EVENT("blackjack"), ...EVENT("blackjack"), ...EVENT("dice"), ...EVENT("dice"), ...EVENT("chinchiro"), ...EVENT("chinchiro"),
      ]),
    },
    // Items: held as a count of each (itemMax in all). They are not sold. The item wheel decides
    // which one comes, and pays itemCash × the bet besides.
    itemMax: 99,
    // Every spin of the item wheel also pays this many times the bet.
    itemCash: 1,
    // ガード keeps accident squares off for this many rolls (the one it is used on and the next ones).
    guardRolls: 3,
    // 倍がけ doubles what a roll pays or takes, by at most this many times the bet.
    x2Cap: 10,
    items: {
      dice2: { name: "ダブルダイス" },
      dice3: { name: "トリプルダイス" },
      exact: { name: "ぴったり" },
      guard: { name: "ガード" },
      x2: { name: "倍がけ" },
    },
    itemWheel: spread([...GET("dice2", 4), ...GET("dice3"), ...GET("exact"), ...GET("guard", 2), ...GET("x2", 2)]),
    // The 確変 wheel (after a 確変 slot of the normal wheel): x pays the bet × x; balls draws that
    // many balls one after another (each as any ball: it opens a number or pays missPay, and a
    // line made leads to the bingo wheels as usual). Tuned so the normal wheel as a whole pays
    // what it paid before the 確変 slots took its top slots.
    kakuhen: spread([
      ...N(16), ...N(20), ...N(24), ...N(28), ...N(36), ...N(40), ...N(48), ...N(56), ...N(60),
      { x: 0, balls: 15 }, { x: 0, balls: 15 }, { x: 0, balls: 15 },
    ]),
    // The hidden 確変 slot starts the 確変 wheel only 1 time in chanceOdds (otherwise it reads and pays ×0 like
    // the plain ×0 slots): about 1 in 24 of the landings that read ×0, and 1 in about 200 rolls. Rare and big.
    chanceOdds: 4,
    // The event wheel's four choices, and what each result pays back as multiples of the bet.
    events: ["blackjack", "dice", "chinchiro", "ball"],
    eventPay: { lose: 0, push: 1, sure: 1 },
    // Balls are drawn from 1–NUMBERS; the two cards hold all but the special one. A ball on a
    // number that is already open pays this many times the bet instead.
    numbers: 99,
    missPay: 1.5,
    // A line made only of the player's own balls pays this many times more.
    soloBonus: 1.1,
    // A part of someone else's line not collected within owedDays is dropped, and the card keeps
    // at most owedMax people's parts (the oldest go first), so it cannot grow without end.
    owedDays: 30,
    owedMax: 200,
    // Accident wheel: take: multiples of the bet taken on top, give: multiples of the bet paid, back: squares back, start: back to START.
    accident: [{ take: 6 }, { take: 4 }, { take: 3 }, { take: 2 }, { give: 1 }, { give: 3 }, { give: 6 }, { back: 3 }, { start: true }, { take: 0 }],
    // Wheels after a line. x: multiples of what was bet since the last line.
    // A line pays this many times the bet whatever the wheel gives (the "bingo prize").
    bingoPrize: 7,
    // The bingo wheels' mini games score this many times their points.
    bingoGameBoost: 2,
    // Of the bingo prize, this part is shared by the balls on the line (the finisher's own balls
    // included); the rest is the finisher's.
    prizeShare: 1,
    // Of what the bingo wheel's ×5 / ×10 / ×20 pays, this part goes to the other players with
    // balls on the line, by their balls (the prize above is shared in full the same way).
    wheelShare: 0.5,
    // After a line: x pays the bet × x; game starts a mini game; miss is the bingo prize alone;
    // the super-jackpot chance leads to the second wheel, where back spins the first again.
    wheels: {
      // The special number: one wheel (the bet × x, or three more balls).
      special: spread([{ x: 10 }, { x: 10 }, { x: 15 }, { x: 20 }, { x: 20 }, { x: 30 }, { x: 50 }, { x: 0, balls: 3 }, { x: 0, balls: 3 }, { x: 40 }]),
      bingo: null, // (see bingoWheel: made for the bet)
      sjp: [{ jackpot: "sjp" }, { jackpot: "jp" }, { game: "tapex" }, { jackpot: "sjp" }, { back: true }],
    },
    // Mini games, scored in points (multiplied like the line's other prizes):
    // timer – stop at 10 seconds: 1,000 less 5 for every 0.01 s off; tap / tapex – taps in 10
    // seconds × 10 / × 25; dice – three dice, the sum × 50; math – a sum of the chosen level (easy 300 / normal 600 / hard 1,200).
    // Taps count up to `max` (12 a second is about as fast as a finger goes; a tapping tool
    // gains nothing past it).
    // stop / hilo are the normal squares' quick games, paid in multiples of the bet: stop the
    // light in the gold (perfect) or silver (good) part of the bar; say whether the next card is
    // higher or lower. In 早送り they are not played and pay `auto`.
    // The slots of the bingo wheel besides the jackpot and the super chance (each twice on the wheel).
    wheelParts: { others: [{ x: 12 }, { game: "timer" }, { x: 20 }, { game: "tap" }, { game: "dice" }, { x: 50 }, { game: "math" }, { x: 32 }] },
    games: { stop: { pay: { perfect: 2, good: 0.75, miss: 0 }, auto: 0.5, seconds: 5 }, hilo: { pay: { win: 1.25, tie: 1, lose: 0 }, auto: 0.5 }, timer: { target: 10, max: 1000, per: 5 }, tap: { seconds: 10, per: 10, max: 120 }, tapex: { seconds: 10, per: 25, max: 120 }, dice: { count: 3, per: 50 }, math: { easy: { seconds: 15, prize: 300 }, normal: { seconds: 15, prize: 600 }, hard: { seconds: 20, prize: 1200 } } },
  };
  RULES.normal[50] = RULES.normal[200] = RULES.normal[100];
  // The bingo wheel for a bet (the average bet of the balls on the line): the jackpot and the
  // super-jackpot chance take as many places as the bet is a multiple of 100 (a half, one, or two
  // of the 20 places of each), and the other slots pay `scale` times more or less, so one point
  // of bet is worth about the same at every size.
  function bingoWheel(cost) {
    const k = cost / 100,
      count = Math.max(1, Math.round(2 * k)),
      others = RULES.wheelParts.others,
      size = others.length * 2 + count * 2,
      scale = size / 20,
      list = [];
    for (let i = 0; i < 2; i++) for (const o of others) list.push(o.x ? { x: Math.round(o.x * scale * 10) / 10 } : { ...o, boost: Math.round(RULES.bingoGameBoost * scale * 100) / 100 });
    for (let i = 0; i < count; i++) list.push({ jackpot: "jp" }, { next: "sjp" });
    return spread(list);
  }
  RULES.wheels.bingo = bingoWheel(100);
  const SIZE = RULES.board.length,
    CARD = 7,
    CARDS = 2,
    CELLS = CARD * CARD * CARDS;
  const KIND = { S: "start", n: "normal", E: "event", A: "accident" };
  const kindAt = (i) => KIND[RULES.board[i]];
  // 16 lines on each card (7 rows, 7 columns, 2 diagonals): 32 in all, cells numbered card by card.
  const LINES = (() => {
    const lines = [],
      seq = [0, 1, 2, 3, 4, 5, 6];
    for (let card = 0; card < CARDS; card++) {
      const at = (r, c) => card * CARD * CARD + r * CARD + c;
      for (let i = 0; i < CARD; i++) {
        lines.push(seq.map((j) => at(i, j)));
        lines.push(seq.map((j) => at(j, i)));
      }
      lines.push(seq.map((j) => at(j, j)), seq.map((j) => at(j, CARD - 1 - j)));
    }
    return lines;
  })();
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const money = (n) => Math.round(n);

  // Fresh cards: the numbers 1–99 in random places, one of them (the special number) on neither card.
  function newCard(random) {
    const pool = Array.from({ length: RULES.numbers }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = random(i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return { v: 2, cells: pool.slice(1, CELLS + 1), owners: Array(CELLS).fill(""), special: pool[0] };
  }
  // The card is shared, so anything read back is checked: the 98 numbers once each from 1–99 and a
  // special number that is not among them, ids of a sane length, and what is owed whole points.
  // (A card from before the second card, with 49 cells, is not valid: a new one takes its place.)
  const ID = (id) => typeof id === "string" && id.length > 0 && id.length <= 64;
  function validCard(card) {
    return (
      !!card &&
      card.v === 2 &&
      Array.isArray(card.cells) &&
      card.cells.length === CELLS &&
      card.cells.every((n) => Number.isInteger(n) && n >= 1 && n <= RULES.numbers) &&
      new Set(card.cells).size === CELLS &&
      (card.bets === undefined || (Array.isArray(card.bets) && card.bets.length === CELLS && card.bets.every((n) => Number.isFinite(n) && n >= 0 && n <= 1000))) &&
      Number.isInteger(card.special) &&
      card.special >= 1 &&
      card.special <= RULES.numbers &&
      !card.cells.includes(card.special) &&
      Array.isArray(card.owners) &&
      card.owners.length === CELLS &&
      card.owners.every((o) => o === "" || ID(o)) &&
      (card.owed === undefined || validOwed(card.owed)) &&
      (card.owedAt === undefined || (!!card.owedAt && typeof card.owedAt === "object" && !Array.isArray(card.owedAt) && Object.entries(card.owedAt).every(([id, t]) => ID(id) && Number.isFinite(t))))
    );
  }
  const validOwed = (owed) =>
    !!owed && typeof owed === "object" && !Array.isArray(owed) && Object.entries(owed).every(([id, n]) => ID(id) && Number.isInteger(n) && n >= 0 && n <= 1e7);
  // After a change at time `at`: each part that grew is stamped, parts older than owedDays go,
  // and only the owedMax newest stay. `before` is the card the change was made on.
  function tidyOwed(card, before, at) {
    const owed = { ...(card.owed || {}) },
      stamp = { ...(card.owedAt || {}) };
    for (const id of Object.keys(stamp)) if (!(id in owed)) delete stamp[id];
    for (const [id, n] of Object.entries(owed)) if (n > (before?.owed?.[id] || 0) || !(id in stamp)) stamp[id] = at;
    const keep = Object.keys(owed)
      .filter((id) => at - stamp[id] <= RULES.owedDays * 864e5 && owed[id] > 0)
      .sort((a, b) => stamp[b] - stamp[a])
      .slice(0, RULES.owedMax);
    card.owed = Object.fromEntries(keep.map((id) => [id, owed[id]]));
    card.owedAt = Object.fromEntries(keep.map((id) => [id, stamp[id]]));
    return card;
  }
  // This player's part of other players' lines, taken off the card.
  function collect(sharedCard, me) {
    const card = clone(sharedCard),
      amount = card.owed?.[me] || 0;
    if (card.owed) delete card.owed[me];
    if (card.owedAt) delete card.owedAt[me];
    return { card, amount };
  }
  // The items a state holds: known ones only, at most itemMax.
  const isItem = (id) => typeof id === "string" && Object.prototype.hasOwnProperty.call(RULES.items, id);
  const itemsOf = (state) => (Array.isArray(state?.items) ? state.items.filter(isItem).slice(0, RULES.itemMax) : []);
  // Which copy of a game is further on: counts a roll and a purchase (a save from before has only its rolls).
  const revOf = (state) => (Number.isFinite(state?.rev) && state.rev >= 0 ? state.rev : Number(state?.rolls) || 0);
  function newState() {
    return { v: 3, pos: 0, stake: 0, laps: 0, rolls: 0, bet: 0, won: 0, balls: 0, bingos: 0, best: 0, jps: 0, sjps: 0, shared: 0, pending: null, bonus: [], jpWait: [], items: [], guard: 0, rev: 0 };
  }
  // A player's own state; an older save (with its own card) keeps its place and counts.
  function valid(state) {
    return (
      !!state &&
      (state.v === 3 || state.v === 2) &&
      Number.isInteger(state.pos) &&
      state.pos >= 0 &&
      state.pos < SIZE &&
      ["stake", "laps", "rolls", "bet", "balls"].every((k) => Number.isFinite(state[k]) && state[k] >= 0) &&
      // What came back can be below 0: a minus slot or an accident takes more than the bet.
      Number.isFinite(state.won)
    );
  }
  function upgrade(state) {
    const { card, marks, lines, cards, ...rest } = state;
    const count = (k) => (Number.isFinite(rest[k]) && rest[k] >= 0 ? rest[k] : 0);
    return { ...newState(), ...rest, v: 3, bingos: count("bingos"), best: count("best"), jps: count("jps"), sjps: count("sjps"), shared: count("shared"), bonus: Array.isArray(rest.bonus) ? rest.bonus : [], items: itemsOf(rest), guard: Math.min(RULES.guardRolls, count("guard")), rev: revOf(rest), jpWait: Array.isArray(rest.jpWait) ? rest.jpWait.filter((k) => k === "jp" || k === "sjp") : [] };
  }
  const isOpen = (card, i) => card.owners[i] !== "";
  const reach = (card) => LINES.map((_, i) => i).filter((i) => LINES[i].filter((c) => !isOpen(card, c)).length === 1);
  const pick = (list, random) => {
    const index = random(list.length);
    return { index, slot: list[index] };
  };

  // A ball is drawn from 1–99. The special number spins the special wheel; any other number is on
  // a card: closed, it opens in the player's name and any finished lines pay; already open, it
  // pays missPay × the bet.
  function ball(state, card, me, random, events, bet) {
    const number = random(RULES.numbers) + 1;
    state.balls++;
    if (number === card.special) {
      events.push({ t: "ball", number, cell: -1, special: true });
      return spinSpecial(state, card, me, random, events, bet);
    }
    const cell = card.cells.indexOf(number);
    if (isOpen(card, cell)) {
      const amount = money(bet * RULES.missPay);
      events.push({ t: "ball", number, cell: -1, miss: true, amount });
      return amount;
    }
    card.owners[cell] = me;
    card.bets = Array.isArray(card.bets) && card.bets.length === CELLS ? card.bets : Array(CELLS).fill(0);
    card.bets[cell] = bet;
    events.push({ t: "ball", number, cell, owner: me });
    const lines = LINES.map((_, i) => i).filter((i) => LINES[i].every((c) => isOpen(card, c)));
    if (!lines.length) return 0;
    const cleared = [...new Set(lines.flatMap((l) => LINES[l]))],
      solo = cleared.every((c) => card.owners[c] === me),
      mult = (lines.length > 1 ? lines.length + 1 : 1) * (solo ? RULES.soloBonus : 1);
    // What each player's balls on the finished lines were bet at (a ball with no bet recorded
    // counts as 100): the prize is shared by these, so a ball earns by its own bet.
    const weight = (c) => card.bets[c] || 100,
      balls = {};
    for (const c of cleared) balls[card.owners[c]] = (balls[card.owners[c]] || 0) + weight(c);
    state.stake = 0;
    state.bingos += lines.length;
    events.push({ t: "line", lines, cells: [...cleared], count: lines.length, solo, mult });
    // What the balls share is worth the average bet of the balls on the line; what the finisher
    // keeps is worth the finishing roll's own bet. So everyone is paid by their own bet.
    const total = cleared.reduce((a, c) => a + weight(c), 0),
      avg = total / cleared.length;
    const gain = spinLine(state, card, bet, avg, mult, random, events, me, balls, total);
    // The finished lines start again: their balls leave (the numbers stay).
    for (const c of cleared) {
      card.owners[c] = "";
      card.bets[c] = 0;
    }
    events.push({ t: "reset", cells: [...cleared] });
    return gain;
  }
  // The special number: its own wheel. x pays the bet × x, balls draws that many more balls, a
  // jackpot waits for the screen to pay it (as after a line).
  function spinSpecial(state, card, me, random, events, bet) {
    const slots = RULES.wheels.special,
      { index, slot } = pick(slots, random);
    const event = { t: "wheel", wheel: "special", slots, index, base: bet };
    events.push(event);
    let gain = 0;
    if (slot.x) {
      gain += money(bet * slot.x);
      event.amount = gain;
    }
    if (slot.jackpot) {
      state[slot.jackpot === "jp" ? "jps" : "sjps"]++;
      state.jpWait = (state.jpWait || []).concat([slot.jackpot]);
      events.push({ t: "jackpot", kind: slot.jackpot });
    }
    for (let b = 0; b < (slot.balls || 0); b++) gain += ball(state, card, me, random, events, bet);
    return gain;
  }
  // A line: the bingo prize, shared by the balls on it (others' parts go to card.owed, the
  // rounding stays with the finisher), then the wheel. A mini game is queued in state.bonus and
  // played on the screen (settleBonus); a jackpot waits in state.jpWait for the screen to pay.
  function spinLine(state, card, bet, avg, mult, random, events, me, balls, count) {
    const grid = RULES.costs.reduce((best, c) => (Math.abs(c - bet) < Math.abs(best - bet) ? c : best));
    // `unit` is what one bet of 1 is worth for the balls (the average) and for the finisher (the roll's bet):
    // the shared `part` of the amount goes to the players by their balls' bets, the rest is the finisher's.
    // Returns what stays with the finisher and the others' shares.
    const share = (x, part) => {
      const pool = money(avg * x * part),
        shares = {},
        bonus = money(bet * x * (1 - part));
      let given = 0;
      for (const [id, n] of Object.entries(balls)) {
        if (id === me) continue;
        shares[id] = Math.floor((pool * n) / count);
        if (!shares[id]) continue;
        given += shares[id];
        card.owed = card.owed || {};
        card.owed[id] = Math.min(1e7, (card.owed[id] || 0) + shares[id]);
      }
      return { kept: pool - given + bonus, total: pool + bonus, shares };
    };
    const split = share(RULES.bingoPrize * mult, RULES.prizeShare),
      prize = split.total;
    let gain = split.kept;
    events.push({ t: "prize", amount: gain, total: prize, shares: split.shares, mult });
    for (let wheel = "bingo"; wheel; ) {
      const slots = wheel === "bingo" ? bingoWheel(grid) : RULES.wheels[wheel],
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
        // A mini game is not multiplied by the lines (or the solo bonus): only by bingoGameBoost.
        state.bonus = (state.bonus || []).concat([{ game: slot.game, mult: slot.boost ?? RULES.bingoGameBoost, bet: grid }]);
        events.push({ t: "bonus", game: slot.game, mult: slot.boost ?? RULES.bingoGameBoost });
      } else if (slot.x) {
        const part = share(slot.x * mult, RULES.wheelShare);
        Object.assign(event, { amount: part.kept, total: part.total, shares: part.shares });
        gain += part.kept;
      }
    }
    return gain;
  }

  // Points for a mini game from what was done: seconds stopped at, taps, the face, right or not.
  // `bet`: the bet of the roll that started the game (every score is a multiple of the bet / 100).
  function gameScore(game, done, bet = 100) {
    const g = RULES.games[game],
      scale = bet / 100;
    if (game === "timer") return Number.isFinite(Number(done)) ? money(Math.max(0, g.max - Math.round(Math.abs(Number(done) - g.target) * 100) * g.per) * scale) : 0;
    if (game === "tap" || game === "tapex") return money(Math.min(g.max, Math.max(0, Math.floor(Number(done) || 0))) * g.per * scale);
    // dice: the sum of the three dice (3 to 18); math: the level that was answered right (true = the old 500).
    if (game === "dice") return money(Math.min(6 * g.count, Math.max(0, Math.floor(Number(done) || 0))) * g.per * scale);
    if (game === "math") return done === true ? money(500 * scale) : Object.prototype.hasOwnProperty.call(g, done) ? money(g[done].prize * scale) : 0;
    if (game === "stop" || game === "hilo") return money(bet * (done === "auto" ? g.auto : g.pay[done] || 0));
    return 0;
  }
  // The first mini game waiting, finished with what was done; done === null when it was left.
  function settleBonus(before, done) {
    if (!before.bonus?.length) throw Error("no bonus");
    const state = clone(before),
      [game, ...rest] = state.bonus,
      score = done === null ? 0 : gameScore(game.game, done, game.bet || 100),
      gain = money(score * game.mult);
    state.bonus = rest;
    state.won += gain;
    state.best = Math.max(state.best || 0, gain);
    return { state, events: [{ t: "bonusResult", game: game.game, score, mult: game.mult, amount: gain }], gain };
  }
  // A sum for the mental-arithmetic game, by level. easy: one step with two-digit numbers; normal: middle-school
  // level, whole numbers, negatives allowed; hard: bigger numbers and two or three steps.
  function sum(random, level = "normal") {
    const n = (lo, hi) => lo + random(hi - lo + 1);
    if (level === "easy") {
      const kind = random(3);
      if (kind === 0) {
        const a = n(11, 69), b = n(11, 69);
        return { text: a + " + " + b, answer: a + b };
      }
      if (kind === 1) {
        const a = n(3, 12), b = n(3, 12);
        return { text: a + " × " + b, answer: a * b };
      }
      const a = n(40, 99), b = n(11, 39);
      return { text: a + " − " + b, answer: a - b };
    }
    if (level === "hard") {
      const kind = random(3);
      if (kind === 0) {
        const a = n(12, 40), b = n(3, 9), c = n(12, 60), d = n(2, 9);
        return { text: a + " × " + b + " − " + c + " × " + d, answer: a * b - c * d };
      }
      if (kind === 1) {
        const a = n(15, 80), b = n(15, 80), c = n(3, 12), d = n(11, 40);
        return { text: "(" + a + " − " + b + ") × " + c + " + " + d, answer: (a - b) * c + d };
      }
      const a = n(11, 25), b = n(11, 25), c = n(2, 9), d = n(2, 9);
      return { text: a + " × " + b + " − " + c + " × " + d + " × " + d, answer: a * b - c * d * d };
    }
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
  // `use`: { items: [ids to use before this roll], face: 1-6 for ぴったり }.
  function roll(before, sharedCard, cost, random, me = "me", use = {}) {
    if (!RULES.costs.includes(cost)) throw Error("bad cost");
    if (before.pending || before.bonus?.length) throw Error("a game is waiting");
    const state = clone(before),
      card = clone(sharedCard),
      events = [];
    let gain = 0;
    state.rev = revOf(before) + 1;
    state.rolls++;
    state.bet += cost;
    state.stake += cost;
    // The items used for this roll leave the bag (each of the five once, and not two kinds of dice).
    state.items = itemsOf(state);
    const picked = {};
    for (const id of Array.isArray(use?.items) ? use.items : []) {
      const at = state.items.indexOf(id);
      if (at < 0 || picked[id]) throw Error("no such item");
      picked[id] = true;
      state.items.splice(at, 1);
    }
    if ((picked.dice2 ? 1 : 0) + (picked.dice3 ? 1 : 0) + (picked.exact ? 1 : 0) > 1) throw Error("two kinds of dice");
    if (picked.exact && !(Number.isInteger(use.face) && use.face >= 1 && use.face <= 6)) throw Error("bad face");
    let die;
    if (picked.exact) {
      die = use.face;
      events.push({ t: "item", id: "exact" });
      events.push({ t: "die", value: die, exact: true });
    } else if (picked.dice2 || picked.dice3) {
      // Two or three dice: the sum moves the piece.
      const count = picked.dice3 ? 3 : 2,
        values = Array.from({ length: count }, () => random(6) + 1);
      die = values.reduce((n, v) => n + v, 0);
      events.push({ t: "item", id: picked.dice3 ? "dice3" : "dice2" });
      events.push({ t: "die", value: die, values });
    } else {
      die = random(6) + 1;
      events.push({ t: "die", value: die });
    }
    // ガード: this roll and the next two are safe from accident squares.
    if (picked.guard) {
      state.guard = RULES.guardRolls;
      events.push({ t: "item", id: "guard" });
    }
    const guarded = state.guard > 0;
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
        { index, slot } = pick(slots, random);
      // ガード: a minus slot of the normal wheel pays nothing (the plus slots stay).
      const blocked = guarded && slot.x < 0,
        amount = blocked ? 0 : money(cost * slot.x),
        spin = { t: "wheel", wheel: "normal", slots, index, base: cost, amount };
      events.push(spin);
      if (blocked) events.push({ t: "guarded" });
      gain += amount;
      if (slot.item) gain += spinItem(state, random, events, cost);
      if (slot.ball) gain += ball(state, card, me, random, events, cost);
      if (slot.kakuhen) spin.chance = random(RULES.chanceOdds) === 0;
      if (slot.kakuhen && spin.chance) {
        const k = pick(RULES.kakuhen, random),
          pay = money(cost * k.slot.x);
        events.push({ t: "wheel", wheel: "kakuhen", slots: RULES.kakuhen, index: k.index, base: cost, amount: pay });
        gain += pay;
        for (let b = 0; b < (k.slot.balls || 0); b++) gain += ball(state, card, me, random, events, cost);
      }
      if (slot.game) {
        state.bonus = (state.bonus || []).concat([{ game: slot.game, mult: 1, bet: cost }]);
        events.push({ t: "bonus", game: slot.game, mult: 1 });
      }
      if (slot.event) {
        // A plain game for the bet: a win pays as the game does, a loss takes the bet, no ball.
        state.pending = { game: slot.event, bet: cost, plain: true };
        events.push({ t: "game", game: slot.event, bet: cost, plain: true });
      }
    } else if (kind === "accident") {
      const { index, slot } = pick(RULES.accident, random);
      events.push({ t: "wheel", wheel: "accident", slots: RULES.accident, index, base: cost });
      if (slot.give) {
        // A good slot pays whether or not the roll is guarded.
        const amount = money(cost * slot.give);
        gain += amount;
        events.push({ t: "give", amount });
      } else if (guarded && (slot.start || slot.back || slot.take)) {
        // ガード: the bad slots do nothing.
        events.push({ t: "guarded" });
      } else if (slot.start) {
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
    // 倍がけ: what this roll paid or took (the balls and wheels it ran; not a part of a line owed to
    // others, a jackpot, or an event game settled afterwards) counts twice, by at most x2Cap times the bet.
    if (picked.x2) {
      const extra = Math.max(-RULES.x2Cap * cost, Math.min(RULES.x2Cap * cost, gain));
      events.push({ t: "item", id: "x2" }, { t: "x2", amount: extra });
      gain += extra;
    }
    if (state.guard > 0) state.guard--;
    state.won += gain;
    state.best = Math.max(state.best || 0, gain);
    return { state, card, events, gain, cost };
  }
  // The item wheel: the item goes into the bag (counted ×n; a full bag gets none) and itemCash × the bet is paid besides.
  function spinItem(state, random, events, cost) {
    const slots = RULES.itemWheel,
      { index, slot } = pick(slots, random),
      cash = money(cost * RULES.itemCash);
    events.push({ t: "wheel", wheel: "item", slots, index, base: 0 });
    if (state.items.length < RULES.itemMax) {
      state.items.push(slot.item);
      events.push({ t: "itemGet", id: slot.item, amount: cash });
    } else events.push({ t: "itemGet", id: slot.item, full: true, amount: cash });
    return cash;
  }
  // The end of an event game: m is the game's own result as multiples of the bet (1 even money,
  // 1.5 a blackjack, 0 a push, below 0 a loss). A win pays bet × (1 + m) and gives a ball, a
  // push gives the bet back and a loss gives back half. A game from a normal square (`plain`)
  // is a plain bet: no ball, and a loss gives nothing back.
  function settle(before, sharedCard, m, random, me = "me") {
    if (!before.pending) throw Error("no event");
    const state = clone(before),
      card = clone(sharedCard),
      events = [],
      bet = state.pending.bet,
      plain = state.pending.plain === true;
    state.pending = null;
    let gain;
    if (m > 0) {
      gain = money(bet * (1 + m));
      events.push({ t: "result", outcome: "win", amount: gain, net: gain - bet });
      if (!plain) gain += ball(state, card, me, random, events, bet);
    } else if (m === 0) {
      gain = money(bet * RULES.eventPay.push);
      events.push({ t: "result", outcome: "push", amount: gain, net: gain - bet });
    } else {
      // A loss costs the bet and, as in the casino, what the game loses beyond it (a double, a ヒフミ ×2, a
      // parent's ゾロ目 ×3): the bet is already paid, so a loss of ×2 pays back −1 × the bet.
      gain = money(bet * (1 + m));
      events.push({ t: "result", outcome: "lose", amount: gain, net: gain - bet });
    }
    state.won += gain;
    state.best = Math.max(state.best || 0, gain);
    return { state, card, events, gain };
  }

  // Who got what from the lines of one roll, for the pop-up that follows a bingo: the prize and the wheel's
  // multiples (what the finisher keeps is under `me`, the others' parts by id), and the things only the
  // finisher gets (mini games, jackpots). null when the roll made no line.
  function bingoSplit(events, me) {
    const lines = events.filter((e) => e.t === "line");
    if (!lines.length) return null;
    const rows = {},
      add = (id, key, n) => {
        if (!n) return;
        rows[id] = rows[id] || { id, prize: 0, wheel: 0, total: 0 };
        rows[id][key] += n;
        rows[id].total += n;
      };
    let prize = 0,
      wheel = 0;
    for (const e of events) {
      if (e.t === "prize") {
        prize += e.total;
        add(me, "prize", e.amount);
        for (const [id, n] of Object.entries(e.shares || {})) add(id, "prize", n);
      } else if (e.t === "wheel" && e.wheel === "bingo" && Number.isFinite(e.total)) {
        wheel += e.total;
        add(me, "wheel", e.amount);
        for (const [id, n] of Object.entries(e.shares || {})) add(id, "wheel", n);
      }
    }
    return {
      count: lines.reduce((n, e) => n + e.count, 0),
      mult: lines[0].mult,
      solo: lines.every((e) => e.solo),
      prize,
      wheel,
      rows: Object.values(rows).sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : b.total - a.total)),
      games: events.filter((e) => e.t === "bonus").map((e) => e.game),
      jackpots: events.filter((e) => e.t === "jackpot").map((e) => e.kind),
    };
  }
  const api = { RULES, bingoSplit, bingoWheel, LINES, CARD, CARDS, CELLS, SIZE, kindAt, itemsOf, revOf, newState, newCard, valid, validCard, collect, tidyOwed, upgrade, roll, settle, settleBonus, gameScore, sum, reach };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SugorokuModel = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis);
