// 年代並べ替え: in a 用語・年号モード book, put three or four events in order, oldest first.
// Events are the lines that start with a year, a century or an era; one round uses only one of
// these (years with years, centuries with centuries, eras with eras), since a century and a year
// inside it cannot be told apart.
// Practice only: it reads the year questions' results to show weak events more often and
// writes no understanding record (the year itself is asked by the year questions).
(function (root) {
  "use strict";
  const ROUNDS = 10,
    SIZE = 4;
  const plain = (text) => String(text || "").replace(/「([^「」]+)」/g, "$1");
  const PREFIX = { year: "y:", century: "c:", era: "e:" };
  // Every line with a year, a century or an era becomes an event. `year` is the number that puts
  // events of one kind in order (the year; the year a century or an era began).
  function events(words, parse) {
    const list = [];
    for (const word of words || []) {
      const head = String(word?.word || "").trim();
      (word?.meanings || []).forEach((m, index) => {
        const line = parse(m.text),
          mid = String(m.id ?? String(word.num) + "-" + index);
        if (head && line.when && line.body)
          list.push({ num: String(word.num), mid, kind: line.when.kind, label: line.when.label, key: PREFIX[line.when.kind] + mid, year: line.when.value, head, text: plain(line.body) });
      });
    }
    return list;
  }
  function distinctYears(list) {
    return new Set(list.map((e) => e.year)).size;
  }
  // The events of each kind that have at least three different values to put in order.
  function playable(list) {
    const kinds = new Map();
    for (const e of list || []) kinds.set(e.kind || "year", [...(kinds.get(e.kind || "year") || []), e]);
    return [...kinds.values()].filter((group) => distinctYears(group) >= 3);
  }
  // Picks up to four events with different years; weight favours events whose year was missed.
  function round(all, random = Math.random, weight = () => 1) {
    const groups = playable(all);
    if (!groups.length) return [];
    // With more than one kind to play, one is chosen by how many events it has.
    let list = groups[0];
    if (groups.length > 1) {
      let at = random() * groups.reduce((n, g) => n + g.length, 0);
      list = groups.find((g) => (at -= g.length) < 0) || groups[groups.length - 1];
    }
    const size = Math.min(SIZE, distinctYears(list)),
      picked = [],
      years = new Set();
    const keyed = list
      .map((event) => ({ event, key: -Math.log(Math.max(random(), 1e-10)) / Math.max(1, weight(event)) }))
      .sort((a, b) => a.key - b.key);
    for (const { event } of keyed) {
      if (years.has(event.year)) continue;
      years.add(event.year);
      picked.push(event);
      if (picked.length === size) break;
    }
    // Shown shuffled, but never already in order.
    for (let tries = 0; tries < 10 && inOrder(picked); tries++)
      for (let i = picked.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [picked[i], picked[j]] = [picked[j], picked[i]];
      }
    if (inOrder(picked)) picked.push(picked.shift());
    return picked;
  }
  function inOrder(list) {
    return list.every((e, i) => i === 0 || list[i - 1].year < e.year);
  }
  // Position by position: which of the player's picks are where they belong.
  function check(order) {
    const sorted = order.slice().sort((a, b) => a.year - b.year);
    return { right: order.every((e, i) => e === sorted[i]), marks: order.map((e, i) => e === sorted[i]), sorted };
  }
  // The word numbers the events come from (a range is a first and last word number).
  function bounds(list) {
    const nums = (list || []).map((e) => Number(e.num)).filter(Number.isFinite);
    return nums.length ? { min: Math.min(...nums), max: Math.max(...nums) } : { min: 0, max: 0 };
  }
  // The events whose word number is inside the range (a missing end means no limit; reversed ends are put right).
  function inRange(list, from, to) {
    let lo = Number.isFinite(Number(from)) && from !== "" && from !== null ? Number(from) : -Infinity,
      hi = Number.isFinite(Number(to)) && to !== "" && to !== null ? Number(to) : Infinity;
    if (lo > hi) [lo, hi] = [hi, lo];
    return (list || []).filter((e) => {
      const n = Number(e.num);
      return Number.isFinite(n) && n >= lo && n <= hi;
    });
  }
  // The years the events are placed at (the year; the year a century or an era began).
  function yearBounds(list) {
    const years = (list || []).map((e) => Number(e.year)).filter(Number.isFinite);
    return years.length ? { min: Math.min(...years), max: Math.max(...years) } : { min: 0, max: 0 };
  }
  // The events placed inside a range of years (empty ends mean no limit; reversed ends are put right).
  function inYears(list, from, to) {
    const num = (v) => (v === "" || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));
    let lo = num(from) ?? -Infinity,
      hi = num(to) ?? Infinity;
    if (lo > hi) [lo, hi] = [hi, lo];
    return (list || []).filter((e) => Number.isFinite(Number(e.year)) && Number(e.year) >= lo && Number(e.year) <= hi);
  }
  // How many events of each kind a list has, for the range screen.
  function counts(list) {
    const out = { year: 0, century: 0, era: 0 };
    for (const e of list || []) out[e.kind || "year"]++;
    return out;
  }
  const model = { events, round, check, inOrder, distinctYears, playable, bounds, inRange, yearBounds, inYears, counts, ROUNDS };
  root.TermOrder = model;
  if (typeof module !== "undefined") module.exports = model;
  if (!root.document) return;

  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const button = (text, action, cls = "") => {
    const el = node("button", cls, text);
    el.type = "button";
    el.onclick = action;
    return el;
  };
  let view = null,
    session = null;
  function close() {
    session = null;
    view?.close();
    view?.remove();
    view = null;
  }
  function body() {
    return view.querySelector(".review-content");
  }
  async function load(book) {
    let source = root.TextbookFiles
      ? await root.TextbookFiles.getWords(book)
      : root.VocabMaster?.resolve(book)?.master;
    if (!source && root.__getBookMasterWords) source = await root.__getBookMasterWords(book);
    if (!source?.length) throw Error("単語帳の読み込みを確認してください。");
    return root.migrateVocabData(root.stripVocabProgressFromWords(source));
  }
  async function open(book) {
    if (view) return;
    view = node("dialog", "weak-review-screen term-order-screen");
    view.setAttribute("aria-label", "年代並べ替え");
    const header = node("header");
    header.append(node("h2", "", "年代並べ替え"), button("終了", () => (session?.done && view.dataset.state !== "result" ? finish() : close()), "review-subtle"));
    view.append(header, node("div", "review-content"));
    view.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });
    document.body.append(view);
    view.showModal();
    body().append(node("p", "", "教材を読み込んでいます…"));
    // Closing (and maybe opening another book) while this one loads makes its result stale.
    const screen = view;
    try {
      const list = events(await load(book), root.TermQuestions.parseLine);
      if (view !== screen) return;
      if (!playable(list).length) {
        view.dataset.state = "message";
        body().replaceChildren(
          node("h3", "", "年・世紀・時代の入った説明が足りません"),
          node("p", "review-description", "行の頭に年・世紀・時代が入った説明が、同じ種類で3つ以上（違うもの）あると並べ替えができます。"),
          button("閉じる", close, "review-primary"),
        );
        return;
      }
      const results = root.TermProgress.read(book);
      // A missed year question makes its event come up more often.
      const weight = (e) => {
        const status = results[e.num]?.[e.key || "y:" + e.mid]?.status;
        return status === "bad" ? 4 : status === "so" ? 2 : 1;
      };
      session = { book, all: list, list, weight, done: 0, right: 0 };
      setup();
    } catch (error) {
      if (view !== screen) return;
      view.dataset.state = "message";
      body().replaceChildren(node("h3", "", "開けませんでした"), node("p", "review-description", error.message), button("閉じる", close, "review-primary"));
    }
  }
  const rangeKey = (book) => "aiglish_term_order_range_" + String(book);
  const readRange = (book) => {
    try {
      const saved = JSON.parse(localStorage.getItem(rangeKey(book)) || "null");
      return saved && typeof saved === "object" ? saved : {};
    } catch {
      return {};
    }
  };
  // The range screen: which word numbers the rounds are made from (the whole book to begin with).
  function setup() {
    if (!session) return;
    view.dataset.state = "setup";
    const limits = bounds(session.all),
      years = yearBounds(session.all),
      saved = readRange(session.book),
      pick = (v, lo, hi, fallback) => (Number.isFinite(Number(v)) && v !== "" && v !== null && v !== undefined ? Math.min(hi, Math.max(lo, Number(v))) : fallback);
    const input = (label, value, lo, hi) => {
      const el = node("input", "search-input");
      el.type = "number";
      el.min = String(lo);
      el.max = String(hi);
      el.value = String(value);
      el.setAttribute("aria-label", label);
      return el;
    };
    const from = input("開始番号", pick(saved.from, limits.min, limits.max, limits.min), limits.min, limits.max),
      to = input("終了番号", pick(saved.to, limits.min, limits.max, limits.max), limits.min, limits.max),
      yearFrom = input("開始年", pick(saved.yearFrom, years.min, years.max, years.min), years.min, years.max),
      yearTo = input("終了年", pick(saved.yearTo, years.min, years.max, years.max), years.min, years.max),
      note = node("p", "review-description"),
      chosen = () => inYears(inRange(session.all, from.value, to.value), yearFrom.value, yearTo.value),
      go = button("はじめる", () => {
        session = { ...session, list: chosen(), done: 0, right: 0 };
        try {
          localStorage.setItem(rangeKey(session.book), JSON.stringify({ from: Number(from.value), to: Number(to.value), yearFrom: Number(yearFrom.value), yearTo: Number(yearTo.value) }));
        } catch {}
        next();
      }, "review-primary");
    go.dataset.termOrderStart = "";
    const refresh = () => {
      const list = chosen(),
        n = counts(list),
        ok = playable(list).length > 0;
      note.textContent = ok
        ? "この範囲：" + list.length + "件（年 " + n.year + "・世紀 " + n.century + "・時代 " + n.era + "）"
        : "この範囲では並べ替えができません。同じ種類（年・世紀・時代）で、違うものが3つ以上入る範囲にしてください。";
      go.disabled = !ok;
    };
    for (const el of [from, to, yearFrom, yearTo]) el.oninput = refresh;
    const field = (label, a, b) => {
      const box = node("div", "flashcard-setup-field"),
        row = node("div", "flashcard-setup-range");
      row.append(a, node("span", "", "〜"), b);
      box.append(node("span", "", label), row);
      return box;
    };
    body().replaceChildren(
      node("h3", "", "範囲を選ぶ"),
      node("p", "review-description", "番号 " + limits.min + "〜" + limits.max + "、年 " + years.min + "〜" + years.max + " の中から選べます（両方を使うと、重なるところだけ）。"),
      field("出題範囲（番号）", from, to),
      field("出題範囲（年・世紀・時代のはじまりの年）", yearFrom, yearTo),
      note,
      go,
    );
    refresh();
  }
  function next() {
    if (!session) return;
    if (session.done >= ROUNDS) return finish();
    view.dataset.state = "order";
    const items = round(session.list, Math.random, session.weight),
      picked = [],
      host = node("ol", "term-order-list"),
      submit = button("判定する", () => judge(items, picked), "review-primary");
    submit.disabled = true;
    const draw = () => {
      host.querySelectorAll("button").forEach((el, i) => {
        const at = picked.indexOf(items[i]);
        el.dataset.place = at < 0 ? "" : String(at + 1);
        el.setAttribute("aria-pressed", String(at >= 0));
      });
      submit.disabled = picked.length !== items.length;
    };
    items.forEach((item) => {
      const li = node("li"),
        el = button("", () => {
          const at = picked.indexOf(item);
          // Tapping a numbered event takes it and every later one back.
          if (at >= 0) picked.splice(at);
          else picked.push(item);
          draw();
        }, "term-order-item");
      el.append(node("b", "", item.head), node("span", "", item.text));
      li.append(el);
      host.append(li);
    });
    body().replaceChildren(
      node("small", "review-progress", session.done + 1 + " / " + ROUNDS),
      node("h3", "", "古い順にタップ"),
      host,
      submit,
    );
    draw();
  }
  function judge(items, picked) {
    const result = check(picked);
    session.done++;
    if (result.right) session.right++;
    root.AppSounds?.play(result.right ? "swipe-right" : "swipe-left");
    const host = node("ol", "term-order-list is-judged");
    result.sorted.forEach((item) => {
      const li = node("li"),
        row = node("div", "term-order-item " + (picked[result.sorted.indexOf(item)] === item ? "is-right" : "is-wrong"));
      row.append(node("em", "", item.label || item.year + "年"), node("b", "", item.head), node("span", "", item.text));
      li.append(row);
      host.append(li);
    });
    body().replaceChildren(
      node("small", "review-progress", session.done + " / " + ROUNDS),
      node("h3", "term-order-verdict", result.right ? "正解！" : "正しい順番"),
      host,
      button(session.done >= ROUNDS ? "結果を見る" : "次へ", next, "review-primary"),
    );
  }
  function finish() {
    if (!session) return close();
    view.dataset.state = "result";
    body().replaceChildren(
      node("h3", "", "年代並べ替えの結果"),
      node("p", "term-order-score", session.right + " / " + session.done + " 問正解"),
      button("もう一度", () => {
        session = { ...session, done: 0, right: 0 };
        next();
      }, "review-primary"),
      button("範囲を変える", setup, "review-subtle"),
      button("閉じる", close, "review-subtle"),
    );
  }
  root.openTermOrder = open;
  root.onAppLoaded?.(() => {
    const menu = root.openBookStudyMenu;
    if (typeof menu !== "function" || menu.__order) return;
    const wrapped = function (book) {
      const result = menu.apply(this, arguments),
        dialog = document.querySelector("dialog.book-study-menu");
      if (dialog && root.TermProgress?.enabled(book)) {
        const closeButton = [...dialog.querySelectorAll("button")].find((el) => el.textContent === "閉じる");
        dialog.insertBefore(
          button("年代並べ替え", () => {
            dialog.close();
            dialog.remove();
            open(book);
          }),
          closeButton || null,
        );
      }
      return result;
    };
    wrapped.__order = true;
    root.openBookStudyMenu = wrapped;
  });
})(typeof window === "undefined" ? globalThis : window);
