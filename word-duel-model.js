(function (root) {
  "use strict";
  const duration = 60000,
    durations = [30000, 60000, 120000, 180000],
    maxAnswers = 1200;
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
  const correctness = new WeakMap();
  function correctChoice(words, seed, index) {
    let seeds = correctness.get(words);
    if (!seeds) {
      seeds = new Map();
      correctness.set(words, seeds);
    }
    let choices = seeds.get(seed);
    if (!choices) {
      choices = new Map();
      seeds.set(seed, choices);
      if (seeds.size > 2) seeds.delete(seeds.keys().next().value);
    }
    if (!choices.has(index))
      choices.set(index, question(words, seed, index).correct);
    return choices.get(index);
  }
  const eventCatalog = [
    {
      id: "double",
      name: "ダブル",
      hint: "正解すると得点2倍！",
      group: "得点",
      description: "正解の獲得点が2倍。",
      recommended: true,
    },
    {
      id: "triple",
      name: "トリプル",
      hint: "正解すると得点3倍！",
      group: "得点",
      description: "正解の獲得点が3倍。",
      recommended: false,
    },
    {
      id: "half",
      name: "ハーフ",
      hint: "正解の得点が半分に",
      group: "得点",
      description: "正解の獲得点が半分。",
      recommended: false,
    },
    {
      id: "reset",
      name: "リセット注意",
      hint: "ミスすると自分の点が0に！",
      group: "特殊",
      description: "ミスすると自分の累積スコアが0。",
      recommended: false,
    },
    {
      id: "attack",
      name: "全員に攻撃",
      hint: "正解で相手全員の点を削れる！",
      group: "特殊",
      description: "正解で相手全員からイベント点を減点。",
      recommended: false,
    },
    {
      id: "gift",
      name: "相手にプレゼント",
      hint: "ミスすると相手に点が入る",
      group: "特殊",
      description: "ミスで相手全員にイベント点を加点。",
      recommended: false,
    },
    {
      id: "steal",
      name: "横取り",
      hint: "首位から点を奪え！",
      group: "順位",
      description: "開始時の首位からイベント点を奪う。同点首位は全員対象。",
      recommended: false,
    },
    {
      id: "chase",
      name: "首位を追え",
      hint: "首位以外は正解で2倍！",
      group: "順位",
      description: "開始時に首位でなかった人の正解点が2倍。",
      recommended: false,
    },
    {
      id: "pressure",
      name: "首位の重圧",
      hint: "首位はミスの失点が2倍",
      group: "順位",
      description: "開始時の首位はミスの失点が2倍。",
      recommended: false,
    },
    {
      id: "comeback",
      name: "最下位の逆襲",
      hint: "最下位は正解で3倍！",
      group: "順位",
      description: "開始時の最下位は正解点が3倍。",
      recommended: false,
    },
    {
      id: "hunt",
      name: "僅差の勝負",
      hint: "正解で一つ上の相手を減点！",
      group: "順位",
      description: "正解で開始時の一つ上の順位の相手全員を減点。",
      recommended: false,
    },
    {
      id: "lead",
      name: "独走ボーナス",
      hint: "首位は正解でボーナス",
      group: "順位",
      description: "開始時の首位は正解にイベント点を追加。",
      recommended: false,
    },
    {
      id: "comboBoost",
      name: "コンボ加速",
      hint: "正解1回でコンボ2段階アップ！",
      group: "コンボ",
      description: "正解1回でコンボが2段階進む。",
      recommended: true,
    },
    {
      id: "comboGuard",
      name: "コンボ保護",
      hint: "ミスしてもコンボが切れない",
      group: "コンボ",
      description: "ミスしてもコンボが切れない。失点と3秒待ちは残る。",
      recommended: true,
    },
    {
      id: "comboCashout",
      name: "コンボ清算",
      hint: "コンボを得点に交換！",
      group: "コンボ",
      description: "開始時にコンボ数×イベント点を加点してコンボを0に。",
      recommended: false,
    },
    {
      id: "streak",
      name: "連続正解チャレンジ",
      hint: "3連続正解でボーナス！",
      group: "チャレンジ",
      description: "期間中に3連続正解で一度だけイベント点を追加。",
      recommended: true,
    },
    {
      id: "perfect",
      name: "全問正解チャレンジ",
      hint: "3問以上全問正解でボーナス！",
      group: "チャレンジ",
      description: "期間中3問以上、全問正解なら終了時にイベント点を追加。",
      recommended: true,
    },
    {
      id: "first",
      name: "初速勝負",
      hint: "最初に正解した人にボーナス！",
      group: "チャレンジ",
      description: "期間中、最初に正解した1人にイベント点を追加。",
      recommended: true,
    },
    {
      id: "last",
      name: "ラストチャンス",
      hint: "最後の3秒の正解にボーナス！",
      group: "チャレンジ",
      description: "終了までの最後の3秒間、正解にイベント点を追加。",
      recommended: true,
    },
    {
      id: "speed",
      name: "スピード勝負",
      hint: "3秒以内に答えるとボーナス！",
      group: "チャレンジ",
      description: "問題が出て3秒以内の正解にイベント点を追加。",
      recommended: true,
    },
    {
      id: "careful",
      name: "慎重に回答",
      hint: "正解でボーナス、ミスは失点3倍",
      group: "得点",
      description: "正解にイベント点を追加。ミスの失点は3倍。",
      recommended: false,
    },
    {
      id: "safe",
      name: "ノーペナルティ",
      hint: "ミスしても減点なし！",
      group: "得点",
      description: "ミスの失点が0。コンボ解除と3秒待ちは残る。",
      recommended: true,
    },
    {
      id: "fixed",
      name: "得点固定",
      hint: "正解の得点がコンボに関係なく一定",
      group: "得点",
      description: "コンボに関係なく正解は設定した基本得点。",
      recommended: true,
    },
    {
      id: "risk",
      name: "一発勝負",
      hint: "最初の1問だけ得点も失点も3倍！",
      group: "チャレンジ",
      description: "期間中の最初の回答だけ得点・失点が3倍。",
      recommended: false,
    },
    {
      id: "shield",
      name: "盾",
      hint: "次の失点を1回防ぐ盾をもらえる",
      group: "特殊",
      description: "次の失点を1回防ぐ。終了後も持ち越し、重複はしない。",
      recommended: true,
    },
    {
      id: "counter",
      name: "カウンター",
      hint: "次に受けた攻撃の半分を返す",
      group: "特殊",
      description:
        "次に受けた攻撃の半分を返す。終了後も持ち越し、重複はしない。",
      recommended: false,
    },
    {
      id: "share",
      name: "おすそ分け",
      hint: "正解で相手にも点をおすそ分け",
      group: "特殊",
      description: "正解で自分に通常点、相手全員にイベント点の半分を加点。",
      recommended: true,
    },
    {
      id: "cooperate",
      name: "全員で達成",
      hint: "全員で人数×3問正解すると全員に点！",
      group: "チャレンジ",
      description: "期間中の合計正解が人数×3問で全員にイベント点。",
      recommended: true,
    },
    {
      id: "collective",
      name: "連帯責任",
      hint: "ミスすると全員が減点",
      group: "特殊",
      description: "ミスの通常失点に加えて全員からイベント点を減点。",
      recommended: false,
    },
    {
      id: "bank",
      name: "得点を貯金",
      hint: "正解点を貯めて最後にまとめて加点",
      group: "特殊",
      description: "期間中の正解点をため、終了時にまとめて加点。",
      recommended: true,
    },
  ];
  const eventTypes = eventCatalog.map((event) => event.id),
    recommendedEvents = eventCatalog
      .filter((event) => event.recommended)
      .map((event) => event.id);
  const defaultRules = {
    points: 100,
    combo: 1.1,
    answerBonus: 10,
    events: false,
    eventTypes: eventTypes.slice(0, 6),
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
      r.eventTypes.length <= 30 &&
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
  function eventPreview(seed, at, rules, limit = 600000) {
    if (!rules?.events) return null;
    const start = (Math.floor(at / 15000) + 1) * 15000;
    if (start >= limit || start - at > 3000) return null;
    const next = eventAt(seed, start, rules);
    return next ? { ...next, start } : null;
  }
  function replay(room, elapsed, cashOutBank = false) {
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
    elapsed = Math.max(0, Math.min(room.duration, elapsed ?? room.duration));
    const ids = Object.keys(room.players).sort(),
      values = {},
      timeline = [],
      shields = {},
      counters = {};
    for (const id of ids) {
      const answers = room.players[id].answers;
      if (!Array.isArray(answers) || answers.length > maxAnswers)
        throw Error("回答記録を確認できません。");
      values[id] = { total: 0, combo: 0 };
      let last = -1,
        unlockAt = 0,
        previousRight = true;
      answers.forEach((answer, index) => {
        if (
          !Number.isFinite(answer.at) ||
          answer.at < 0 ||
          answer.at >= room.duration ||
          answer.at < last ||
          answer.at < unlockAt ||
          !Number.isInteger(answer.choice) ||
          answer.choice < 0 ||
          answer.choice > 9 ||
          (answer.shownAt !== undefined &&
            (!Number.isFinite(answer.shownAt) ||
              answer.shownAt < Math.max(0, last) ||
              answer.shownAt > answer.at))
        )
          throw Error("回答記録を確認できません。");
        const shownAt =
          answer.shownAt ?? Math.max(0, last + (previousRight ? 180 : 3000));
        last = answer.at;
        const right =
          correctChoice(room.pool, room.seed, index) === answer.choice;
        if (!right) unlockAt = answer.at + 3000;
        previousRight = right;
        if (answer.at <= elapsed)
          timeline.push({
            kind: "answer",
            order: 2,
            id,
            index,
            at: answer.at,
            right,
            shownAt,
          });
      });
    }
    if (rules.events)
      for (
        let start = 15000;
        start < room.duration && start <= elapsed;
        start += 15000
      ) {
        const event = eventAt(room.seed, start, rules),
          end = Math.min(event.until, room.duration);
        timeline.push({
          kind: "start",
          order: 1,
          at: start,
          type: event.type,
          end,
        });
        if (end <= elapsed) timeline.push({ kind: "end", order: 0, at: end });
      }
    timeline.sort(
      (a, b) =>
        a.at - b.at ||
        a.order - b.order ||
        (a.id || "").localeCompare(b.id || "") ||
        (a.index || 0) - (b.index || 0),
    );
    let active = null;
    function loss(id, amount, source) {
      if (amount <= 0) return 0;
      if (shields[id]) {
        shields[id] = false;
        return 0;
      }
      values[id].total -= amount;
      if (source && source !== id && counters[id]) {
        counters[id] = false;
        loss(source, Math.round(amount / 2));
      }
      return amount;
    }
    for (const entry of timeline) {
      if (entry.kind === "start") {
        const levels = [...new Set(ids.map((id) => values[id].total))].sort(
            (a, b) => b - a,
          ),
          ranks = Object.fromEntries(
            ids.map((id) => [id, levels.indexOf(values[id].total)]),
          );
        active = {
          ...entry,
          ranks,
          lastRank: levels.length - 1,
          correct: Object.fromEntries(ids.map((id) => [id, 0])),
          misses: {},
          streaks: {},
          awarded: {},
          used: {},
          bank: {},
          first: false,
          cooperated: false,
        };
        if (entry.type === "comboCashout")
          for (const id of ids) {
            values[id].total += values[id].combo * rules.eventPoints;
            values[id].combo = 0;
          }
        if (entry.type === "shield") for (const id of ids) shields[id] = true;
        if (entry.type === "counter") for (const id of ids) counters[id] = true;
        continue;
      }
      if (entry.kind === "end") {
        if (active?.type === "perfect")
          for (const id of ids)
            if (active.correct[id] >= 3 && !active.misses[id])
              values[id].total += rules.eventPoints;
        if (active?.type === "bank")
          for (const id of ids) values[id].total += active.bank[id] || 0;
        active = null;
        continue;
      }
      const { id, right } = entry,
        v = values[id],
        type = active?.type;
      if (right) {
        let gain = rules.points * (1 + v.combo * (rules.combo - 1));
        if (type === "fixed") gain = rules.points;
        if (type === "double" || (type === "chase" && active.ranks[id] > 0))
          gain *= 2;
        if (
          type === "triple" ||
          (type === "comeback" && active.ranks[id] === active.lastRank)
        )
          gain *= 3;
        if (type === "half") gain *= 0.5;
        if (type === "risk" && !active.used[id]) gain *= 3;
        gain = Math.round(gain);
        if (type === "careful" || (type === "lead" && active.ranks[id] === 0))
          gain += rules.eventPoints;
        if (type === "first" && !active.first) {
          gain += rules.eventPoints;
          active.first = true;
        }
        if (type === "last" && active.end - entry.at <= 3000)
          gain += rules.eventPoints;
        if (type === "speed" && entry.at - entry.shownAt <= 3000)
          gain += rules.eventPoints;
        if (active) {
          active.correct[id]++;
          active.streaks[id] = (active.streaks[id] || 0) + 1;
          if (
            type === "streak" &&
            active.streaks[id] >= 3 &&
            !active.awarded[id]
          ) {
            gain += rules.eventPoints;
            active.awarded[id] = true;
          }
        }
        if (type === "bank") active.bank[id] = (active.bank[id] || 0) + gain;
        else v.total += gain;
        v.combo += type === "comboBoost" ? 2 : 1;
        if (["attack", "hunt", "steal"].includes(type))
          for (const other of ids) {
            if (other === id) continue;
            if (type === "hunt" && active.ranks[other] !== active.ranks[id] - 1)
              continue;
            if (type === "steal" && active.ranks[other] !== 0) continue;
            const amount =
              type === "steal"
                ? Math.min(rules.eventPoints, Math.max(0, values[other].total))
                : rules.eventPoints;
            const taken = loss(other, amount, id);
            if (type === "steal") v.total += taken;
          }
        if (type === "share")
          for (const other of ids)
            if (other !== id)
              values[other].total += Math.round(rules.eventPoints / 2);
        if (
          type === "cooperate" &&
          !active.cooperated &&
          Object.values(active.correct).reduce(
            (sum, count) => sum + count,
            0,
          ) >=
            ids.length * 3
        ) {
          for (const other of ids) values[other].total += rules.eventPoints;
          active.cooperated = true;
        }
      } else {
        let penalty = room.missPenalty;
        if (type === "safe") penalty = 0;
        if (type === "careful" || (type === "risk" && !active.used[id]))
          penalty *= 3;
        if (type === "pressure" && active.ranks[id] === 0) penalty *= 2;
        if (type === "reset") {
          if (shields[id]) shields[id] = false;
          else v.total = 0;
        } else loss(id, penalty);
        if (type !== "comboGuard") v.combo = 0;
        if (active) {
          active.misses[id] = true;
          active.streaks[id] = 0;
        }
        if (type === "gift")
          for (const other of ids)
            if (other !== id) values[other].total += rules.eventPoints;
        if (type === "collective")
          for (const other of ids) loss(other, rules.eventPoints, id);
      }
      if (active) active.used[id] = true;
    }
    if (cashOutBank && active?.type === "bank")
      for (const id of ids) values[id].total += active.bank[id] || 0;
    return values;
  }
  function score(
    words,
    seed,
    answers,
    limit = duration,
    missPenalty = 50,
    rules = defaultRules,
    elapsed,
  ) {
    return replay(
      {
        pool: words,
        seed,
        players: { self: { answers } },
        duration: limit,
        missPenalty,
        rules,
      },
      elapsed,
    ).self;
  }
  function finalScore(
    words,
    seed,
    answers,
    limit = duration,
    missPenalty = 50,
    rules = defaultRules,
    elapsed,
  ) {
    const base = replay(
        {
          pool: words,
          seed,
          players: { self: { answers } },
          duration: limit,
          missPenalty,
          rules,
        },
        elapsed,
        true,
      ).self,
      bonus = answers.length * rules.answerBonus;
    return {
      base: base.total,
      bonus,
      answered: answers.length,
      total: base.total + bonus,
    };
  }
  function roomScores(room, final = false, elapsed) {
    const values = replay(room, final ? room.duration : elapsed);
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
    for (let i = 0; i < entries.length; ) {
      let end = i + 1;
      while (
        end < entries.length &&
        entries[end].abandoned === entries[i].abandoned &&
        (entries[i].abandoned || entries[end].score === entries[i].score)
      )
        end++;
      for (let j = i; j < end; j++) {
        entries[j].place = i + 1;
      }
      i = end;
    }
    return entries;
  }
  function validRoom(room) {
    try {
      if (
        !(
          [7, 8, 9].includes(room?.version) &&
          (room.version < 8 ||
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
          room.matchType === "casual" &&
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
              Number.isFinite(room.result.scores?.[id]) &&
              Number.isInteger(room.result.places?.[id]) &&
              room.result.places[id] >= 1 &&
              room.result.places[id] <= room.capacity,
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
    eventCatalog,
    recommendedEvents,
    eventPreview,
    eventTypes,
    validRules,
    validDuration,
    eventAt,
    correctChoice,
    roomScores,
    poolSampler,
    selectPool,
    duration,
    durations,
    maxAnswers,
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
