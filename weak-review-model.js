// JST daily review eligibility lives beside each meaning, in the existing recovery journal.
(function (root) {
  "use strict";
  function day(now = Date.now()) {
    return new Date(now + 9 * 3600000).toISOString().slice(0, 10);
  }
  const weak = (status) => status === "bad" || status === "so";
  function frozen(word, meaning, now) {
    const date = day(now),
      r = meaning?.review || {},
      at = Number(r.at) || Number(word?.editedAt) || 0;
    return r.day === date
      ? !!r.weak
      : weak(meaning?.status) && at > 0 && at <= now && day(at) < date;
  }
  function stampWord(previous, incoming, now) {
    if (!incoming?.meanings) return incoming;
    // The same word while number and headword match (see sameWordSignature in app.js).
    const head = (sig) => String(sig || "").split("::").slice(0, 2).join("::"),
      compatible = !previous?.sig || previous.sig === incoming.sig || head(previous.sig) === head(incoming.sig),
      old = compatible ? previous || {} : {},
      result = { ...incoming, meanings: { ...incoming.meanings } },
      date = day(now);
    for (const [mid, value] of Object.entries(incoming.meanings)) {
      const prior =
          old.meanings?.[mid] ||
          (Object.keys(incoming.meanings).length === 1
            ? { status: old.status || "none", history: old.history || [] }
            : {}),
        before = prior.review || {},
        changed =
          (prior.status || "none") !== (value.status || "none") ||
          JSON.stringify(prior.history || []) !==
            JSON.stringify(value.history || []);
      // A renderer may omit review fields; it must never erase a completed review.
      const review = {
        ...before,
        ...value.review,
        day: date,
        weak: value.status === "none" ? false : frozen(old, prior, now),
        at: changed
          ? now
          : Math.max(
              Number(value.review?.at) || 0,
              Number(before.at) || Number(old.editedAt) || 0,
            ),
      };
      if (!compatible) delete review.passed;
      result.meanings[mid] = { ...value, review };
    }
    return result;
  }
  function eligible(word, meaning, now = Date.now()) {
    return (
      meaning?.status !== "none" &&
      frozen(word, meaning, now) &&
      meaning?.review?.passed !== day(now)
    );
  }
  function question(target, pool, seed, index) {
    let n = (seed ^ Math.imul(index + 1, 2654435761)) >>> 0;
    const random = () => {
      n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
      return n / 4294967296;
    };
    const seen = new Set([target.meaning]),
      others = [];
    for (const item of pool) {
      if (
        (item.ref?.book === target.ref?.book &&
          item.ref?.num === target.ref?.num &&
          item.ref?.num !== undefined) ||
        item.prompt.toLowerCase() === target.prompt.toLowerCase() ||
        seen.has(item.meaning)
      )
        continue;
      seen.add(item.meaning);
      others.push(item.meaning);
    }
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    if (!others.length)
      throw Error("選択式の復習には、異なる単語と意味が2組以上必要です。");
    const size = Math.min(9, others.length),
      position = index % (size + 1),
      absent = position === size,
      options = others.slice(0, absent ? size : size - 1);
    if (!absent) options.splice(position, 0, target.meaning);
    return {
      prompt: target.prompt,
      meaning: target.meaning,
      ref: target.ref,
      options: [...options, "選択肢の中にはない"],
      correct: absent ? options.length : position,
    };
  }
  function reviewPlan(candidates, limit = 20) {
    const groups = new Map(),
      key = (item) => String(item.prompt).trim().toLowerCase();
    for (const item of candidates
      .slice()
      .sort(
        (a, b) =>
          (a.at || 0) - (b.at || 0) ||
          String(a.ref.num).localeCompare(String(b.ref.num), undefined, {
            numeric: true,
          }),
      )) {
      const list = groups.get(key(item)) || [];
      list.push(item);
      groups.set(key(item), list);
    }
    const result = [];
    let previous = null;
    while (result.length < limit) {
      const left = [...groups.entries()].filter(([, list]) => list.length);
      // Another word comes between two meanings of one word when there is one; once only one
      // word is left, its remaining meanings still come, one after another.
      const others = left.filter(([word]) => word !== previous),
        choices = (others.length ? others : left).sort(
          (a, b) =>
            b[1].length - a[1].length || (a[1][0].at || 0) - (b[1][0].at || 0),
        );
      if (!choices.length) break;
      const [word, list] = choices[0];
      result.push(list.shift());
      previous = word;
    }
    return result;
  }
  function nextStatus(status, correct) {
    if (!correct) return "bad";
    return status === "so" || status === "ok" ? "ok" : "so";
  }
  const api = { day, stampWord, eligible, frozen, question, reviewPlan, nextStatus };
  root.WeakReviewModel = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
