// 大富豪 (Daifugo): the rules of one game, without any screen or network. Pure functions on plain
// objects; every move returns a new state. The rules follow the 日本大富豪連盟 rule book (see
// docs/daifugo-rules.md): 3 to 5 players, 革命, 8切り, スペ3返し, 縛り, 階段, ジョーカー,
// 反則上がり, 都落ち and the card exchange between games.
//
// Cards are strings: a suit letter and a rank number, "S3" .. "S15" (11 J, 12 Q, 13 K, 14 A, 15 2),
// suits S H D C; the jokers are "J1" and "J2".
//
// Strength: 3 < 4 < ... < K < A < 2 < joker; in a 革命 the order of the numbers is reversed
// (2 < A < ... < 3), the joker stays the strongest. A stair is read in "strength" numbers (3..15
// for the cards, 16 for a joker standing above the strongest card), so it runs the same way in
// either order.
(function (root) {
  "use strict";
  const SUITS = ["S", "H", "D", "C"];
  const JOKER_RANK = 16;
  const isJoker = (card) => card[0] === "J";
  const rankOf = (card) => (isJoker(card) ? JOKER_RANK : Number(card.slice(1)));
  const suitOf = (card) => (isJoker(card) ? null : card[0]);
  // Strength of a rank in the current order (the joker is above every card).
  const strength = (rank, rev) => (rank === JOKER_RANK ? JOKER_RANK : rev ? 18 - rank : rank);
  const cardsByStrength = (a, b, rev) => strength(rankOf(a), rev) - strength(rankOf(b), rev) || (suitOf(a) || "").localeCompare(suitOf(b) || "");

  // How many players, what is dealt, how many cards are put aside (ブラインド), cards per hand.
  const SETUP = {
    3: { suits: ["S", "H", "D"], jokers: 1, blind: 1, hand: 13 },
    4: { suits: SUITS, jokers: 2, blind: 2, hand: 13 },
    5: { suits: SUITS, jokers: 2, blind: 4, hand: 10 },
  };
  const NAMES = {
    3: ["富豪", "平民", "貧民"],
    4: ["大富豪", "富豪", "貧民", "大貧民"],
    5: ["大富豪", "富豪", "平民", "貧民", "大貧民"],
  };
  // 4 same ranks make a 革命 (3 in the 3-player game, which has only 3 suits).
  const revolutionSize = (n) => (n === 3 ? 3 : 4);

  // ---- Local rules (ローカルルール) ---------------------------------------------------------
  // What a table can switch: [key, name, on by default, what it does]. The first six are the rule book's own rules (on unless switched
  // off); the rest are local rules (off unless switched on). A game keeps its rules in state.opts; a rule missing there (a game dealt
  // by an older version) counts as its default.
  const RULES = [
    ["revolution", "革命", true, "同じ数字4枚（3人のときは3枚）で、強さが逆になります。"],
    ["eight", "8切り", true, "8を出すと場が流れ、出した人からまた始めます。"],
    ["shibari", "縛り", true, "同じマークが続くと、場が流れるまでそのマークしか出せません。"],
    ["stairs", "階段", true, "同じマークで続く3枚以上を、まとめて出せます。"],
    ["spade3", "スペ3返し", true, "1枚のジョーカーに、スペードの3だけが勝てます。"],
    ["foul", "反則上がり", true, "2・8・ジョーカー・スペ3（革命中は3）で上がると、最下位になります。"],
    ["miyakoochi", "都落ち", false, "前のゲームの大富豪は、1位で上がれないと最下位になります。"],
    ["elevenBack", "11バック", false, "Jを出すと、場が流れるまで強さが逆になります。"],
    ["fiveSkip", "5飛ばし", false, "5を出すと、出した枚数だけ次の人を飛ばします。"],
    ["sevenPass", "7渡し", false, "7を出すと、出した枚数だけ手札を次の人に渡します。"],
    ["tenDiscard", "10捨て", false, "10を出すと、出した枚数だけ手札を捨てます。"],
    ["nineReverse", "9リバース", false, "9を出すと、順番が逆回りになります。"],
  ];
  const RULE_DEFAULT = Object.fromEntries(RULES.map(([key, , on]) => [key, on]));
  const normalizeRules = (opts) => Object.fromEntries(RULES.map(([key, , on]) => [key, typeof opts?.[key] === "boolean" ? opts[key] : on]));
  const rule = (state, key) => (typeof state?.opts?.[key] === "boolean" ? state.opts[key] : RULE_DEFAULT[key]);
  // The rules of a table that differ from the defaults, as names ("8切りなし", "7渡し").
  const ruleTags = (opts) => RULES.filter(([key, , on]) => normalizeRules(opts)[key] !== on).map(([, name, on]) => (on ? name + "なし" : name));
  // Is the order of the numbers reversed now? (a 革命, or an 11バック until the field flows; both together cancel out)
  const reversed = (state) => !!state.rev !== !!state.back;

  function deck(n) {
    const setup = SETUP[n];
    if (!setup) throw Error("大富豪は3〜5人で遊びます。");
    const cards = [];
    for (const suit of setup.suits) for (let rank = 3; rank <= 15; rank++) cards.push(suit + rank);
    for (let i = 1; i <= setup.jokers; i++) cards.push("J" + i);
    return cards;
  }
  function shuffle(cards, rand = Math.random) {
    const list = cards.slice();
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }
  // Puts the blind cards (never jokers) aside, then deals one by one round the table.
  function deal(n, rand = Math.random) {
    const setup = SETUP[n],
      all = shuffle(deck(n), rand),
      blind = [];
    for (let i = 0; i < all.length && blind.length < setup.blind; i++) if (!isJoker(all[i])) blind.push(all[i]);
    const rest = all.filter((card) => !blind.includes(card)),
      hands = Array.from({ length: n }, () => []);
    rest.forEach((card, i) => hands[i % n].push(card));
    return { hands: hands.map((hand) => hand.slice(0, setup.hand)), blind };
  }

  // ---- Plays ----------------------------------------------------------------------------
  // A play is { kind: "set" | "stair", n, rank | a, suits, jokers, cards }.
  //   set:   `rank` of the cards (a joker stands in for the missing ones; JOKER_RANK when only jokers)
  //   stair: `a` is the strength of its lowest card; `top` is true when a joker stands above the strongest card
  // Every way a group of cards can be read (a stair with a joker at either end has two or more).
  function readings(cards, rev) {
    const jokers = cards.filter(isJoker),
      real = cards.filter((card) => !isJoker(card)),
      out = [];
    const n = cards.length;
    if (!n) return out;
    const suits = real.map(suitOf).sort();
    if (!real.length) {
      if (n <= 2) out.push({ kind: "set", n, rank: JOKER_RANK, suits, jokers: n, cards });
      return out;
    }
    if (real.every((card) => rankOf(card) === rankOf(real[0]))) out.push({ kind: "set", n, rank: rankOf(real[0]), suits, jokers: jokers.length, cards });
    if (n >= 3 && real.every((card) => suitOf(card) === suitOf(real[0]))) {
      const have = real.map((card) => strength(rankOf(card), rev));
      if (new Set(have).size === have.length) {
        for (let a = 16 - n + 1; a >= 3; a--) {
          const b = a + n - 1;
          if (have.every((s) => s >= a && s <= b) && n - have.length === jokers.length) out.push({ kind: "stair", n, a, top: b === 16, suits, jokers: jokers.length, cards });
        }
      }
    }
    return out;
  }
  // Can `play` answer the cards on the field (a play, or null for an empty field) in this state?
  function beats(field, play, rev, spade3 = true) {
    if (!field) return true;
    if (play.kind !== field.kind || play.n !== field.n) return false;
    if (field.kind === "stair") return play.a > field.a;
    // Only the spade 3 stands up to a single joker (スペ3返し).
    if (field.rank === JOKER_RANK) return spade3 && field.n === 1 && play.cards.length === 1 && play.cards[0] === "S3";
    if (play.rank === JOKER_RANK) return true;
    return strength(play.rank, rev) > strength(field.rank, rev);
  }
  const isSpade3Return = (field, play) => !!field && field.kind === "set" && field.n === 1 && field.rank === JOKER_RANK && play.cards.length === 1 && play.cards[0] === "S3";
  // Under a 縛り only the locked suits can be played (a joker stands in for any).
  function underLock(lock, play) {
    if (!lock) return true;
    const left = lock.slice();
    for (const suit of play.suits) {
      const at = left.indexOf(suit);
      if (at < 0) return false;
      left.splice(at, 1);
    }
    return true;
  }
  const flows = (play, field, state) =>
    // 8切り (a set of 8s, a joker standing in for one included; never a stair), JK pair, 6 cards, 最強階段, スペ3返し
    (play.kind === "set" && play.rank === 8 && rule(state, "eight")) || (play.kind === "set" && play.rank === JOKER_RANK && play.n === 2) || (play.kind === "set" && play.n >= 6) || (play.kind === "stair" && play.top) || isSpade3Return(field, play);
  // What to call the play that cleared the field.
  const flowName = (play, field) =>
    isSpade3Return(field, play) ? "スペ3返し" : play.kind === "stair" ? "最強階段" : play.rank === 8 ? "8切り" : play.rank === JOKER_RANK ? "ジョーカーのペア" : "シックスカード";
  // The play that goes on the field for these cards, or null: the strongest valid reading.
  function resolve(state, cards) {
    // 7渡し / 10捨て waiting: the cards to give or throw away (exactly as many as asked).
    if (state.pending) return Array.isArray(cards) && cards.length === state.pending.count && new Set(cards).size === cards.length ? { kind: "extra", t: state.pending.t, n: cards.length, cards, jokers: 0, suits: [] } : null;
    let best = null;
    const rev = reversed(state),
      sp3 = rule(state, "spade3");
    for (const play of readings(cards, rev)) {
      if (play.kind === "stair" && !rule(state, "stairs")) continue;
      if (!beats(state.field?.play || null, play, rev, sp3)) continue;
      if (!isSpade3Return(state.field?.play, play) && !underLock(state.lock, play)) continue;
      if (!best || (play.kind === "stair" && play.a > best.a)) best = play;
    }
    return best;
  }
  // The final play of a hand that is not allowed (反則上がり), judged in the state before the play.
  function illegalFinish(state, play) {
    if (!rule(state, "foul") || play.kind === "extra") return false;
    if (play.jokers > 0) return true;
    if (play.kind === "set" && play.rank === 8 && rule(state, "eight")) return true;
    if (play.n === 1 && play.cards[0] === "S3" && rule(state, "spade3")) return true;
    const ranks = play.cards.map(rankOf);
    return reversed(state) ? ranks.includes(3) : ranks.includes(15);
  }

  // ---- Game state ------------------------------------------------------------------------
  // opts: the table's rules (normalizeRules). prev: { ranking: [ids best first] } of the game before, if any.
  function start({ ids, rand = Math.random, prev = null, first = null, opts = {} }) {
    const n = ids.length;
    if (!SETUP[n]) throw Error("大富豪は3〜5人で遊びます。");
    const { hands, blind } = deal(n, rand),
      held = {};
    ids.forEach((id, i) => (held[id] = hands[i].sort((a, b) => cardsByStrength(a, b, false))));
    const state = {
      n,
      ids: ids.slice(),
      hands: held,
      blind,
      field: null,
      lock: null,
      rev: false,
      turn: null,
      passed: [],
      legal: [],
      illegal: [],
      fallen: null,
      top: prev?.ranking?.[0] || null,
      // 11バック until the field flows; the way round the table (9リバース); what a 7渡し / 10捨て waits for.
      back: false,
      dir: 1,
      pending: null,
      opts: normalizeRules(opts),
      phase: "play",
      exchange: null,
      ranking: null,
      log: [],
    };
    // The first player: the last of the game before, else the first seat.
    state.turn = first || prev?.ranking?.[n - 1] || ids[0];
    if (prev?.ranking) {
      const pairs = exchangePairs(prev.ranking);
      // The lower players give their strongest cards; the upper ones choose (exchange()).
      state.exchange = { pairs, given: {} };
      state.phase = "exchange";
    }
    return state;
  }
  // [{ low, high, count }] from the ranking of the game before.
  function exchangePairs(ranking) {
    const n = ranking.length;
    if (n === 3) return [{ low: ranking[2], high: ranking[0], count: 1 }];
    const pairs = [{ low: ranking[n - 1], high: ranking[0], count: 2 }];
    if (n === 4) pairs.push({ low: ranking[2], high: ranking[1], count: 1 });
    if (n === 5) pairs.push({ low: ranking[3], high: ranking[1], count: 1 });
    return pairs;
  }
  // `picks`: { highId: [cards they give] } for each upper player (the lower ones give their
  // strongest cards, joker first). Moves the cards and starts play.
  function exchange(state, picks) {
    if (state.phase !== "exchange") throw Error("いまはカードを交換しません。");
    const next = clone(state);
    for (const pair of next.exchange.pairs) {
      const low = next.hands[pair.low],
        high = next.hands[pair.high],
        give = (picks?.[pair.high] || []).slice(0, pair.count);
      if (give.length !== pair.count || give.some((card) => !high.includes(card)) || new Set(give).size !== give.length) throw Error("渡すカードを" + pair.count + "枚選んでください。");
      const strongest = low.slice().sort((a, b) => cardsByStrength(b, a, false)).slice(0, pair.count);
      for (const card of strongest) low.splice(low.indexOf(card), 1);
      for (const card of give) high.splice(high.indexOf(card), 1);
      low.push(...give);
      high.push(...strongest);
      next.exchange.given[pair.low] = strongest;
      next.exchange.given[pair.high] = give;
    }
    for (const id of next.ids) next.hands[id].sort((a, b) => cardsByStrength(a, b, false));
    next.phase = "play";
    return next;
  }
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const activeIds = (state) => state.ids.filter((id) => !state.legal.includes(id) && !state.illegal.includes(id) && state.fallen !== id);
  // The next player who is still in, going round the table from `id` (the other way after a 9リバース), and (for a field) has not passed.
  function nextAfter(state, id, skipPassed) {
    const n = state.ids.length,
      at = state.ids.indexOf(id),
      dir = state.dir === -1 ? -1 : 1;
    for (let step = 1; step <= n; step++) {
      const other = state.ids[(((at + step * dir) % n) + n) % n];
      if (activeIds(state).includes(other) && !(skipPassed && state.passed.includes(other))) return other;
    }
    return null;
  }
  function log(state, entry) {
    state.log.push(entry);
    if (state.log.length > 60) state.log.shift();
  }
  function finishGame(state) {
    const active = activeIds(state);
    state.phase = "done";
    state.field = null;
    state.turn = null;
    state.pending = null;
    state.ranking = [...state.legal, ...active, ...(state.fallen ? [state.fallen] : []), ...state.illegal.slice().reverse()];
  }
  // The field is cleared; `leader` leads (or the next player in if they are out). An 11バック ends with the field.
  function flow(state, leader, why) {
    state.field = null;
    state.lock = null;
    state.back = false;
    state.passed = [];
    state.turn = activeIds(state).includes(leader) ? leader : nextAfter(state, leader, false);
    log(state, { t: "flow", why });
  }
  const othersPassed = (state, id) => activeIds(state).every((other) => other === id || state.passed.includes(other));

  // After a play (and its 7渡し / 10捨て, if any): is the player out, does the game end, does the field flow, whose turn is it.
  // `foul`: the finish is a 反則上がり. `why`: the play clears the field. `skip`: players jumped by a 5飛ばし.
  function settle(next, id, { foul = false, why = null, skip = 0 }) {
    if (next.hands[id].length === 0) {
      if (foul) {
        next.illegal.push(id);
        log(next, { t: "illegal", by: id });
      } else {
        // 都落ち: the 大富豪 of the game before drops when another player is first to finish.
        if (!next.legal.length && rule(next, "miyakoochi") && next.top && next.top !== id && activeIds(next).includes(next.top)) {
          next.fallen = next.top;
          log(next, { t: "fallen", by: next.top });
        }
        next.legal.push(id);
        log(next, { t: "out", by: id, rank: next.legal.length });
      }
      next.passed = next.passed.filter((other) => other !== id);
    }
    if (activeIds(next).length <= 1) {
      finishGame(next);
      return next;
    }
    if (why) {
      flow(next, id, why);
      return next;
    }
    if (othersPassed(next, id) && activeIds(next).includes(id)) {
      flow(next, id, "全員パス");
      return next;
    }
    let turn = nextAfter(next, id, true) || id;
    // 5飛ばし: the players jumped have not passed; they play again when the turn comes round.
    for (let i = 0; i < skip; i++) {
      next.turn = turn;
      turn = nextAfter(next, turn, true) || turn;
    }
    if (skip) log(next, { t: "skip", n: skip });
    next.turn = turn;
    // Everyone else is out or has passed: the field flows to the one who played, or to the next in.
    if (!activeIds(next).includes(next.turn)) flow(next, id, "全員パス");
    return next;
  }
  // The cards of a 7渡し (to the next player) or a 10捨て (out of the game), then the turn goes on.
  function extra(state, id, cards) {
    const pending = state.pending,
      hand = state.hands[id];
    const word = pending.t === "seven" ? "渡す" : "捨てる";
    if (pending.by !== id) throw Error("あなたの番ではありません。");
    if (!Array.isArray(cards) || cards.length !== pending.count || new Set(cards).size !== cards.length || cards.some((card) => !hand.includes(card))) throw Error(word + "カードを" + pending.count + "枚選んでください。");
    const next = clone(state);
    next.pending = null;
    next.hands[id] = hand.filter((card) => !cards.includes(card));
    if (pending.t === "seven" && pending.to && next.hands[pending.to]) {
      next.hands[pending.to].push(...cards);
      next.hands[pending.to].sort((a, b) => cardsByStrength(a, b, false));
      // (which cards is between the two players: the log says only how many)
      log(next, { t: "give", by: id, to: pending.to, n: cards.length });
    } else log(next, { t: "discard", by: id, cards: cards.slice() });
    return settle(next, id, { why: pending.why, skip: pending.skip });
  }

  // `id` plays `cards`. Returns the new state, or throws a message that can be shown.
  function play(state, id, cards) {
    if (state.phase !== "play") throw Error("いまは出せません。");
    if (state.turn !== id) throw Error("あなたの番ではありません。");
    if (state.pending) return extra(state, id, cards);
    const hand = state.hands[id];
    if (!Array.isArray(cards) || !cards.length || new Set(cards).size !== cards.length || cards.some((card) => !hand.includes(card))) throw Error("そのカードは出せません。");
    const found = resolve(state, cards);
    if (!found) {
      const rev = reversed(state),
        could = readings(cards, rev).filter((read) => beats(state.field?.play || null, read, rev, rule(state, "spade3")));
      if (could.length && could.every((read) => read.kind === "stair") && !rule(state, "stairs")) throw Error("このテーブルでは階段は出せません。");
      if (state.lock && could.length) throw Error("縛り中です。同じスートのカードだけ出せます。");
      throw Error(state.field ? "場のカードより強い、同じ形のカードを出してください。" : "その組み合わせは出せません。");
    }
    const next = clone(state),
      before = state;
    const wasField = state.field?.play || null;
    next.hands[id] = hand.filter((card) => !cards.includes(card));
    // 縛り: the same suits twice in a row (no joker), and it stays until the field flows.
    if (rule(next, "shibari") && wasField && !next.lock && wasField.jokers === 0 && found.jokers === 0 && wasField.suits.join() === found.suits.join() && wasField.kind === found.kind) next.lock = found.suits.slice();
    next.field = { by: id, play: found };
    let revolution = false;
    if (rule(next, "revolution") && found.kind === "set" && found.n >= revolutionSize(next.n) && found.rank !== JOKER_RANK) {
      next.rev = !next.rev;
      revolution = true;
    }
    log(next, { t: "play", by: id, cards: cards.slice(), kind: found.kind, rev: revolution });
    const set = found.kind === "set" ? found.rank : 0,
      left = next.hands[id].length,
      why = flows(found, wasField, next) ? flowName(found, wasField) : null;
    // The local rules of the numbers (sets only; a joker standing in counts as the number).
    if (set === 11 && rule(next, "elevenBack") && !next.back) {
      next.back = true;
      log(next, { t: "back" });
    }
    if (set === 9 && rule(next, "nineReverse")) {
      next.dir = next.dir === -1 ? 1 : -1;
      log(next, { t: "reverse" });
    }
    const skip = set === 5 && rule(next, "fiveSkip") ? found.n : 0;
    const wait = left > 0 && ((set === 7 && rule(next, "sevenPass") && "seven") || (set === 10 && rule(next, "tenDiscard") && "ten"));
    if (wait) {
      // The player chooses the cards next (play() again, with those cards); the turn stays with them until then.
      const to = wait === "seven" ? nextAfter(next, id, false) : null;
      if (wait === "ten" || to) {
        next.pending = { t: wait, by: id, count: Math.min(found.n, left), to, why, skip };
        return next;
      }
    }
    return settle(next, id, { foul: left === 0 && illegalFinish(before, found), why, skip });
  }
  function pass(state, id) {
    if (state.phase !== "play") throw Error("いまはパスできません。");
    if (state.turn !== id) throw Error("あなたの番ではありません。");
    if (state.pending) throw Error((state.pending.t === "seven" ? "渡す" : "捨てる") + "カードを" + state.pending.count + "枚選んでください。");
    if (!state.field) throw Error("最初に出す人はパスできません。");
    const next = clone(state);
    next.passed.push(id);
    log(next, { t: "pass", by: id });
    const by = next.field.by;
    if (othersPassed(next, by)) {
      flow(next, by, "全員パス");
      return next;
    }
    next.turn = nextAfter(next, id, true);
    return next;
  }
  // Every play the player could make now (empty when they can only pass).
  function plays(state, id) {
    const hand = state.hands[id] || [],
      jokers = hand.filter(isJoker),
      real = hand.filter((card) => !isJoker(card)),
      out = [],
      seen = new Set();
    // 7渡し / 10捨て waiting: any card can be chosen.
    if (state.pending) return state.pending.by === id ? hand.map((card) => [card]) : [];
    const add = (cards) => {
      const key = cards.slice().sort().join(",");
      if (seen.has(key)) return;
      seen.add(key);
      if (resolve(state, cards)) out.push(cards);
    };
    const choose = (list, k, from = 0, picked = [], found = []) => {
      if (picked.length === k) return found.push(picked.slice()), found;
      for (let i = from; i < list.length; i++) {
        picked.push(list[i]);
        choose(list, k, i + 1, picked, found);
        picked.pop();
      }
      return found;
    };
    for (let rank = 3; rank <= 15; rank++) {
      const same = real.filter((card) => rankOf(card) === rank);
      for (let m = 1; m <= same.length; m++)
        for (const group of choose(same, m)) for (let j = 0; j <= jokers.length; j++) if (m + j <= SETUP[state.n].suits.length + 2) add([...group, ...jokers.slice(0, j)]);
    }
    for (let j = 1; j <= jokers.length; j++) add(jokers.slice(0, j));
    for (const suit of SETUP[state.n].suits) {
      const mine = real.filter((card) => suitOf(card) === suit),
        byStrength = new Map(mine.map((card) => [strength(rankOf(card), reversed(state)), card]));
      for (let n = 3; n <= 14; n++)
        for (let a = 3; a + n - 1 <= 16; a++) {
          const cards = [];
          let need = 0;
          for (let s = a; s < a + n; s++) {
            if (byStrength.has(s)) cards.push(byStrength.get(s));
            else need++;
          }
          if (cards.length && need <= jokers.length) add([...cards, ...jokers.slice(0, need)]);
        }
    }
    return out;
  }

  // ---- Points ---------------------------------------------------------------------------
  // A game's points by rank (1 = best): 6/4/2/0 for 4 players (and the same step for 3 and 5);
  // the best of the last game of a set gets 2 more.
  const gamePoints = (n, rank, last = false) => 2 * (n - rank) + (last && rank === 1 ? 2 : 0);
  // The standing of a set: ids best first, by total points, then by the last game's rank.
  function standing(ids, games) {
    const n = ids.length,
      total = Object.fromEntries(ids.map((id) => [id, 0]));
    games.forEach((ranking, g) => ranking.forEach((id, i) => (total[id] += gamePoints(n, i + 1, g === games.length - 1))));
    const lastRank = (id) => games[games.length - 1].indexOf(id);
    return ids.slice().sort((a, b) => total[b] - total[a] || lastRank(a) - lastRank(b));
  }
  // Who pays whom: the best pairs with the worst (the full stake), the second with the second
  // worst (half), and so on; the middle player of an odd table pays and gets nothing. The sum is 0.
  function payouts(order, stake) {
    const n = order.length,
      out = [];
    for (let i = 0; i < Math.floor(n / 2); i++) {
      const amount = i === 0 ? stake : Math.floor(stake / 2);
      if (amount > 0) out.push({ from: order[n - 1 - i], to: order[i], amount });
    }
    return out;
  }

  // ---- A computer player ---------------------------------------------------------------
  // What it would play: the weakest play that wins, keeping jokers and 2s unless it can finish or
  // somebody is nearly out. Returns cards, or null to pass.
  function choose(state, id, rand = Math.random) {
    const hand = state.hands[id];
    // 7渡し / 10捨て: the weakest cards go (a joker last).
    if (state.pending) return state.pending.by === id ? hand.slice().sort((a, b) => cardsByStrength(a, b, reversed(state))).slice(0, state.pending.count) : null;
    const options = plays(state, id);
    if (!options.length) return null;
    const score = (cards) => {
      const read = resolve(state, cards);
      const s = read.kind === "stair" ? read.a : read.rank === JOKER_RANK ? 30 : strength(read.rank, reversed(state));
      // Prefer getting rid of more cards at the same strength; avoid illegal finishes.
      return s * 10 - cards.length + (cards.length === hand.length && illegalFinish(state, read) ? 1000 : 0) + (rand() - 0.5);
    };
    const lowest = options.slice().sort((a, b) => score(a) - score(b))[0];
    const read = resolve(state, lowest);
    const finishing = lowest.length === hand.length;
    const threatened = activeIds(state).some((other) => other !== id && state.hands[other].length <= 2);
    const strong = read.jokers > 0 || (read.kind === "set" && strength(read.rank, reversed(state)) >= 15);
    if (state.field && strong && !finishing && !threatened && hand.length > 4) return null;
    if (finishing && illegalFinish(state, read) && options.length > 1) {
      const other = options.filter((cards) => cards.length !== hand.length || !illegalFinish(state, resolve(state, cards)));
      if (other.length) return other.slice().sort((a, b) => score(a) - score(b))[0];
    }
    return lowest;
  }

  const api = { RULES, normalizeRules, ruleTags, rule, reversed, SUITS, JOKER_RANK, SETUP, NAMES, isJoker, rankOf, suitOf, strength, deck, shuffle, deal, readings, beats, resolve, illegalFinish, start, exchangePairs, exchange, activeIds, play, pass, plays, gamePoints, standing, payouts, choose, revolutionSize, cardsByStrength };
  root.DaifugoModel = Object.freeze(api);
  if (typeof module !== "undefined") module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
