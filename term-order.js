// 年代並べ替え: in a 用語・年号モード book, put three or four events in order, oldest first.
// Practice only: it reads the year questions' results to show weak events more often and
// writes no understanding record (the year itself is asked by the year questions).
(function (root) {
  "use strict";
  const ROUNDS = 10,
    SIZE = 4;
  const plain = (text) => String(text || "").replace(/「([^「」]+)」/g, "$1");
  // Every line with a year becomes an event.
  function events(words, parse) {
    const list = [];
    for (const word of words || []) {
      const head = String(word?.word || "").trim();
      (word?.meanings || []).forEach((m, index) => {
        const line = parse(m.text),
          mid = String(m.id ?? String(word.num) + "-" + index);
        if (head && line.year && line.body)
          list.push({ num: String(word.num), mid, year: Number(line.year), head, text: plain(line.body) });
      });
    }
    return list;
  }
  function distinctYears(list) {
    return new Set(list.map((e) => e.year)).size;
  }
  // Picks up to four events with different years; weight favours events whose year was missed.
  function round(list, random = Math.random, weight = () => 1) {
    const size = Math.min(SIZE, distinctYears(list)),
      picked = [],
      years = new Set();
    if (size < 3) return [];
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
  const model = { events, round, check, inOrder, distinctYears, ROUNDS };
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
    try {
      const list = events(await load(book), root.TermQuestions.parseLine);
      if (!view) return;
      if (distinctYears(list) < 3) {
        view.dataset.state = "message";
        body().replaceChildren(
          node("h3", "", "年号の入った説明が足りません"),
          node("p", "review-description", "違う年号の説明が3つ以上あると並べ替えができます。"),
          button("閉じる", close, "review-primary"),
        );
        return;
      }
      const results = root.TermProgress.read(book);
      // A missed year question makes its event come up more often.
      const weight = (e) => {
        const status = results[e.num]?.["y:" + e.mid]?.status;
        return status === "bad" ? 4 : status === "so" ? 2 : 1;
      };
      session = { book, list, weight, done: 0, right: 0 };
      next();
    } catch (error) {
      if (!view) return;
      view.dataset.state = "message";
      body().replaceChildren(node("h3", "", "開けませんでした"), node("p", "review-description", error.message), button("閉じる", close, "review-primary"));
    }
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
      row.append(node("em", "", item.year + "年"), node("b", "", item.head), node("span", "", item.text));
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
