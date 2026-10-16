(function (root) {
  "use strict";
  const duration = 60000,
    durations = [30000, 60000, 120000, 180000],
    maxAnswers = 1200;
  function rating(value) {
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : 1500;
  }
  function pool(words, seed = 0) {
    const seen = new Set(),
      prompts = new Set(),
      result = [],
      random = rng(seed);
    let count = 0;
    for (const word of words || []) {
      const meaning = String(word.meanings?.[0]?.text || word.meaning || "")
          .trim()
          .slice(0, 240),
        prompt = String(word.word || word.en || "")
          .trim()
          .slice(0, 160);
      if (
        !meaning ||
        !prompt ||
        seen.has(meaning) ||
        prompts.has(prompt.toLowerCase())
      )
        continue;
      seen.add(meaning);
      prompts.add(prompt.toLowerCase());
      count++;
      const item = {
        prompt,
        meaning,
        ...(word.duelRef ? { ref: word.duelRef } : {}),
      };
      if (result.length < 120) result.push(item);
      else {
        const index = Math.floor(random() * count);
        if (index < 120) result[index] = item;
      }
    }
    return result;
  }
  function rng(seed) {
    let n = seed >>> 0;
    return () => {
      n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
      return n / 4294967296;
    };
  }
  function shuffle(values, random) {
    const copy = values.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  const layouts = new WeakMap();
  function layout(words, seed, cycle) {
    let seeds = layouts.get(words);
    if (!seeds) {
      seeds = new Map();
      layouts.set(words, seeds);
    }
    let plan = seeds.get(seed);
    if (!plan) {
      plan = {
        choices: shuffle(words, rng(seed ^ 3266489917)),
        cycles: new Map(),
      };
      seeds.set(seed, plan);
      if (seeds.size > 2) seeds.delete(seeds.keys().next().value);
    }
    if (!plan.cycles.has(cycle)) {
      plan.cycles.set(
        cycle,
        shuffle(words, rng(seed ^ Math.imul(cycle + 1, 2246822519))),
      );
      if (plan.cycles.size > 40)
        plan.cycles.delete(plan.cycles.keys().next().value);
    }
    return { choices: plan.choices, deck: plan.cycles.get(cycle) };
  }
  function answerPosition(seed, index) {
    const block = Math.floor(index / 10),
      order = (n) =>
        shuffle(
          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
          rng(seed ^ Math.imul(n + 1, 1597334677)),
        ),
      positions = order(block);
    if (block > 0 && positions[0] === 9 && order(block - 1)[9] === 9)
      [positions[0], positions[1]] = [positions[1], positions[0]];
    return positions[index % 10];
  }
  function question(words, seed, index) {
    if (words.length < 10)
      throw Error("異なる意味を持つ単語が10個以上必要です。");
    const random = rng((seed + Math.imul(index + 1, 2654435761)) >>> 0),
      cycle = Math.floor(index / words.length),
      { deck, choices } = layout(words, seed, cycle),
      word = deck[index % words.length],
      position = answerPosition(seed, index),
      absent = position === 9,
      others = [];
    for (let i = 0; others.length < 9; i++) {
      const item = choices[(index * 9 + i) % choices.length];
      if (item.meaning !== word.meaning) others.push(item.meaning);
    }
    const options = shuffle(absent ? others : others.slice(0, 8), random);
    if (!absent) options.splice(position, 0, word.meaning);
    return {
      prompt: word.prompt,
      meaning: word.meaning,
      ...(word.ref ? { ref: word.ref } : {}),
      options: [...options, "選択肢の中にはない"],
      correct: absent ? 9 : options.indexOf(word.meaning),
    };
  }
  const eventTypes = ["double", "triple", "half", "reset", "attack", "gift"];
  const defaultRules = {
    points: 100,
    combo: 1.1,
    answerBonus: 10,
    events: false,
    eventTypes: [...eventTypes],
    eventSeconds: 8,
    eventPoints: 100,
  };
  function validRules(r) {
    return (
      !!r &&
      Number.isInteger(r.points) &&
      r.points >= 1 &&
      r.points <= 10000 &&
      Number.isFinite(r.combo) &&
      r.combo >= 1 &&
      r.combo <= 3 &&
      Number.isInteger(r.answerBonus) &&
      r.answerBonus >= 0 &&
      r.answerBonus <= 1000 &&
      typeof r.events === "boolean" &&
      Array.isArray(r.eventTypes) &&
      r.eventTypes.length <= 6 &&
      new Set(r.eventTypes).size === r.eventTypes.length &&
      r.eventTypes.every((t) => eventTypes.includes(t)) &&
      (!r.events || r.eventTypes.length > 0) &&
      Number.isInteger(r.eventSeconds) &&
      r.eventSeconds >= 3 &&
      r.eventSeconds <= 15 &&
      Number.isInteger(r.eventPoints) &&
      r.eventPoints >= 0 &&
      r.eventPoints <= 10000
    );
  }
  function validDuration(limit) {
    return (
      Number.isInteger(limit) &&
      limit >= 15000 &&
      limit <= 600000 &&
      limit % 5000 === 0
    );
  }
  function eventAt(seed, at, rules) {
    if (!rules?.events || !rules.eventTypes.length || at < 15000) return null;
    const slot = Math.floor(at / 15000);
    if (at % 15000 >= rules.eventSeconds * 1000) return null;
    const type =
      rules.eventTypes[
        Math.floor(
          rng(seed ^ Math.imul(slot, 374761393))() * rules.eventTypes.length,
        )
      ];
    return { type, until: slot * 15000 + rules.eventSeconds * 1000 };
  }
  function replay(room) {
    room = { duration, missPenalty: 50, ...room };
    const rules = room.rules || defaultRules;
    if (
      !validRules(rules) ||
      !validDuration(room.duration) ||
      !Number.isInteger(room.missPenalty) ||
      room.missPenalty < 0 ||
      room.missPenalty > 1000
    )
      throw Error("対戦の設定を確認できません。");
    const values = {},
      timeline = [];
    for (const [id, player] of Object.entries(room.players)) {
      const answers = player.answers;
      if (!Array.isArray(answers) || answers.length > maxAnswers)
        throw Error("回答記録を確認できません。");
      values[id] = { total: 0, combo: 0 };
      let last = -1,
        unlockAt = 0;
      answers.forEach((answer, index) => {
        if (
          !Number.isFinite(answer.at) ||
          answer.at < 0 ||
          answer.at >= room.duration ||
          answer.at < last ||
          answer.at < unlockAt ||
          !Number.isInteger(answer.choice) ||
          answer.choice < 0 ||
          answer.choice > 9
        )
          throw Error("回答記録を確認できません。");
        last = answer.at;
        const right =
          question(room.pool, room.seed, index).correct === answer.choice;
        if (!right) unlockAt = answer.at + 3000;
        timeline.push({ id, index, at: answer.at, right });
      });
    }
    timeline.sort(
      (a, b) => a.at - b.at || a.id.localeCompare(b.id) || a.index - b.index,
    );
    for (const answer of timeline) {
      const v = values[answer.id],
        event = eventAt(room.seed, answer.at, rules)?.type;
      if (answer.right) {
        const factor =
          event === "double"
            ? 2
            : event === "triple"
              ? 3
              : event === "half"
                ? 0.5
                : 1;
        v.total += Math.round(
          rules.points * (1 + v.combo * (rules.combo - 1)) * factor,
        );
        v.combo++;
        if (event === "attack")
          for (const [id, other] of Object.entries(values))
            if (id !== answer.id) other.total -= rules.eventPoints;
      } else {
        v.total = event === "reset" ? 0 : v.total - room.missPenalty;
        v.combo = 0;
        if (event === "gift")
          for (const [id, other] of Object.entries(values))
            if (id !== answer.id) other.total += rules.eventPoints;
      }
    }
    return values;
  }
  function score(
    words,
    seed,
    answers,
    limit = duration,
    missPenalty = 50,
    rules = defaultRules,
  ) {
    return replay({
      pool: words,
      seed,
      players: { self: { answers } },
      duration: limit,
      missPenalty,
      rules,
    }).self;
  }
  function finalScore(
    words,
    seed,
    answers,
    limit = duration,
    missPenalty = 50,
    rules = defaultRules,
  ) {
    const base = score(words, seed, answers, limit, missPenalty, rules),
      bonus = answers.length * rules.answerBonus;
    return {
      base: base.total,
      bonus,
      answered: answers.length,
      total: base.total + bonus,
    };
  }
  function roomScores(room, final = false) {
    const values = replay(room);
    if (final)
      for (const [id, value] of Object.entries(values)) {
        value.bonus =
          room.players[id].answers.length *
          (room.rules || defaultRules).answerBonus;
        value.answered = room.players[id].answers.length;
        value.base = value.total;
        value.total += value.bonus;
      }
    return values;
  }
  // Weighted reservoir: previous errors are more likely, but mastered words keep a nonzero chance.
  function poolSampler(seed, weak = false) {
    const random = rng(seed),
      seen = new Set(),
      prompts = new Set(),
      ranked = [];
    return {
      add(word) {
        const meaning = String(word.meanings?.[0]?.text || word.meaning || "")
            .trim()
            .slice(0, 240),
          prompt = String(word.word || word.en || "")
            .trim()
            .slice(0, 160);
        if (
          !meaning ||
          !prompt ||
          seen.has(meaning) ||
          prompts.has(prompt.toLowerCase())
        )
          return;
        seen.add(meaning);
        prompts.add(prompt.toLowerCase());
        const h = word.duelHistory || [],
          weight = weak
            ? 1 +
              h.filter((s) => s === "bad").length * 3 +
              h.filter((s) => s === "so").length +
              (word.duelStatus === "bad" ? 6 : word.duelStatus === "so" ? 3 : 0)
            : 1,
          key = -Math.log(Math.max(random(), 1e-10)) / weight;
        if (ranked.length === 120 && key >= ranked[119].key) return;
        let lo = 0,
          hi = ranked.length;
        while (lo < hi) {
          const mid = (lo + hi) >>> 1;
          if (ranked[mid].key <= key) lo = mid + 1;
          else hi = mid;
        }
        ranked.splice(lo, 0, {
          key,
          word: {
            word: prompt,
            meaning,
            ...(word.duelRef ? { duelRef: word.duelRef } : {}),
          },
        });
        if (ranked.length > 120) ranked.pop();
      },
      result: () =>
        pool(
          ranked.map((x) => x.word),
          seed,
        ),
    };
  }
  function selectPool(candidates, seed, weak = false) {
    const sampler = poolSampler(seed, weak);
    for (const word of candidates) sampler.add(word);
    return sampler.result();
  }
  function placements(room) {
    const scores = roomScores(room, true),
      entries = Object.entries(room.players).map(([id, player]) => ({
        id,
        abandoned: !!player.abandoned,
        score: scores[id].total,
      }));
    entries.sort(
      (a, b) =>
        Number(a.abandoned) - Number(b.abandoned) ||
        b.score - a.score ||
        a.id.localeCompare(b.id),
    );
    if (entries.every((entry) => entry.abandoned)) return null;
    const weights =
      entries.length === 2
        ? [30, -30]
        : entries.length === 3
          ? [30, 0, -30]
          : [30, 15, -15, -30];
    for (let i = 0; i < entries.length; ) {
      let end = i + 1;
      while (
        end < entries.length &&
        entries[end].abandoned === entries[i].abandoned &&
        (entries[i].abandoned || entries[end].score === entries[i].score)
      )
        end++;
      const average =
          weights.slice(i, end).reduce((a, b) => a + b, 0) / (end - i),
        delta = Math.sign(average) * Math.round(Math.abs(average));
      for (let j = i; j < end; j++) {
        entries[j].place = i + 1;
        entries[j].delta = delta;
      }
      i = end;
    }
    return entries;
  }
  function validRoom(room) {
    try {
      if (
        !(
          [7, 8].includes(room?.version) &&
          (room.version !== 8 ||
            (room.matchType === "casual" &&
              validRules(room.rules) &&
              Array.isArray(room.books) &&
              room.books.length >= 1 &&
              room.books.length <= 10 &&
              new Set(room.books).size === room.books.length &&
              room.books.every(
                (book) =>
                  typeof book === "string" &&
                  book.length > 0 &&
                  book.length <= 160,
              ) &&
              room.books[0] === room.book &&
              room.pool?.every((word) =>
                room.books.includes(word.ref?.book),
              ))) &&
          ["casual", "ranked"].includes(room.matchType) &&
          (room.matchType !== "ranked" ||
            (room.duration === 180000 && room.missPenalty === 200)) &&
          Number.isInteger(room.missPenalty) &&
          room.missPenalty >= 0 &&
          room.missPenalty <= 1000 &&
          validDuration(room.duration) &&
          [2, 3, 4].includes(room.capacity) &&
          typeof room.book === "string" &&
          room.book.length > 0 &&
          room.book.length <= 160 &&
          Number.isInteger(room.seed) &&
          Array.isArray(room.pool) &&
          room.pool.length >= 10 &&
          room.pool.length <= 120 &&
          room.pool.every(
            (word) =>
              typeof word.prompt === "string" &&
              typeof word.meaning === "string" &&
              word.prompt.length <= 160 &&
              word.meaning.length <= 240 &&
              word.ref &&
              typeof word.ref.num === "string" &&
              word.ref.num.length <= 80 &&
              typeof word.ref.mid === "string" &&
              word.ref.mid.length <= 80 &&
              typeof word.ref.sig === "string" &&
              word.ref.sig.length > 0 &&
              word.ref.sig.length <= 8192 &&
              Number.isInteger(word.ref.count) &&
              word.ref.count > 0 &&
              word.ref.count <= 100,
          ) &&
          new Set(room.pool.map((word) => word.meaning)).size ===
            room.pool.length &&
          room.players &&
          typeof room.host === "string" &&
          room.players[room.host] &&
          Object.keys(room.players).length >= 1 &&
          Object.keys(room.players).length <= room.capacity &&
          ["waiting", "playing", "finished", "cancelled"].includes(room.status)
        )
      )
        return false;
      roomScores(room);
      if (
        ["playing", "finished"].includes(room.status) &&
        Object.keys(room.players).length !== room.capacity
      )
        return false;
      if (
        room.status === "finished" &&
        (!room.result ||
          !Object.keys(room.players).every(
            (id) =>
              Number.isFinite(room.result.ratings?.[id]) &&
              Number.isFinite(room.result.scores?.[id]) &&
              Number.isInteger(room.result.places?.[id]) &&
              room.result.places[id] >= 1 &&
              room.result.places[id] <= room.capacity &&
              Number.isFinite(room.result.deltas?.[id]),
          ))
      )
        return false;
      return true;
    } catch {
      return false;
    }
  }
  const model = {
    defaultRules,
    eventTypes,
    validRules,
    validDuration,
    eventAt,
    roomScores,
    poolSampler,
    selectPool,
    duration,
    durations,
    maxAnswers,
    rating,
    pool,
    question,
    score,
    finalScore,
    placements,
    validRoom,
  };
  root.WordDuelModel = model;
  if (typeof module !== "undefined") module.exports = model;
})(typeof window === "undefined" ? globalThis : window);
