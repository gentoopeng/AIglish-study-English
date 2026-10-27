// 用語・年号モード: several questions from one entry.
//
// An entry is a headword (織田信長) and description lines. A line may start with a year
// ("1582 「本能寺の変」で死亡したとされる人物") and may mark terms with 「」. From each entry:
//   whole  — one line shown, answer the headword (one question per line, like one card per
//            meaning in the normal mode)
//   year   — a line without its year, answer the year (typed, digits only)
//   blank  — a line with one 「」 term blanked, answer that term (one question per term)
// The text is stored as is (the year is just the start of the line), so no save path can drop it.
// Per-question results live in their own store, so a word's normal understanding record (which
// whole-word saves replace) is never asked to hold extra keys.
(function (root) {
  "use strict";
  const YEAR = /^\s*([0-9０-９]{1,4})\s*年?\s*/,
    TERM = /「([^「」]+)」/g,
    BLANK = "（＿＿）",
    HISTORY = 20;
  function halfWidth(text) {
    return String(text || "").replace(/[０-９]/g, (d) =>
      String.fromCharCode(d.charCodeAt(0) - 0xfee0),
    );
  }
  // Only digits are kept; "１５８２年" and "1582" are the same answer.
  function normalizeYear(text) {
    const digits = halfWidth(text).replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");
    return digits.slice(0, 4);
  }
  function plain(text) {
    return String(text || "").replace(TERM, "$1");
  }
  function parseLine(text) {
    const source = String(text || ""),
      match = YEAR.exec(source),
      year = match ? normalizeYear(match[1]) : "",
      body = (match ? source.slice(match[0].length) : source).trim(),
      terms = [];
    for (const found of body.matchAll(TERM)) terms.push(found[1].trim());
    // Every 「」 keeps its position so question keys, blanks and list markers count the same way.
    return { year, body, terms };
  }
  function blankOut(body, index) {
    let seen = -1;
    return body.replace(TERM, (all, term) => (++seen === index ? BLANK : term));
  }
  function lines(word) {
    const meanings =
      Array.isArray(word?.meanings) && word.meanings.length
        ? word.meanings
        : [{ id: String(word?.num) + "-0", text: word?.meaning || "" }];
    return meanings
      .map((m, index) => ({ mid: String(m.id ?? String(word.num) + "-" + index), index, ...parseLine(m.text) }))
      .filter((line) => line.body || line.year);
  }
  function questions(word) {
    const head = String(word?.word || "").trim(),
      parts = lines(word),
      list = [];
    if (!head || !parts.length) return list;
    for (const p of parts) {
      // An entry with one line keeps the key "w" it always had, so its record stays.
      list.push({
        key: parts.length === 1 ? "w" : "w:" + p.mid,
        kind: "whole",
        mid: p.mid,
        index: p.index,
        prompt: (p.year ? p.year + "年 " : "") + plain(p.body),
        answer: head,
        input: false,
      });
      if (p.year && p.body)
        list.push({
          key: "y:" + p.mid,
          kind: "year",
          mid: p.mid,
          index: p.index,
          prompt: head + "：" + plain(p.body) + "（何年？）",
          answer: p.year,
          input: true,
        });
      p.terms.forEach((term, t) =>
        term &&
        list.push({
          key: "t:" + p.mid + ":" + t,
          kind: "blank",
          mid: p.mid,
          index: p.index,
          prompt: head + (p.year ? "　" + p.year + "年" : "") + "　" + blankOut(p.body, t),
          answer: term,
          input: false,
        }),
      );
    }
    return list;
  }
  function correctYear(typed, answer) {
    const value = normalizeYear(typed);
    return value !== "" && value === normalizeYear(answer);
  }
  // The same scale as the card backgrounds: the history average runs green → yellow → red.
  function shade(history) {
    const scores = (history || [])
      .map((h) => (h === "ok" ? 1 : h === "so" ? 4 : h === "bad" ? 9 : 0))
      .filter(Boolean);
    if (!scores.length) return null;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length,
      green = [16, 185, 129],
      yellow = [245, 158, 11],
      red = [239, 68, 68],
      [from, to, ratio] = avg <= 5 ? [green, yellow, (avg - 1) / 4] : [yellow, red, (avg - 5) / 4];
    return from.map((c, i) => Math.round(c + (to[i] - c) * ratio));
  }
  function record(store, num, key, status, at = Date.now()) {
    if (!["ok", "so", "bad"].includes(status)) throw Error("理解度の指定を確認してください。");
    const next = { ...(store || {}) },
      word = { ...(next[num] || {}) },
      previous = word[key] || {};
    word[key] = { status, history: [...(previous.history || []), status].slice(-HISTORY), at };
    next[num] = word;
    return next;
  }
  // A question's text split into pieces that must not break across lines: the headword, a year
  // ("1582年"), the blank and "（何年？）" (parts joined by a full-width space or "："), and
  // line breaks between description lines. The rest breaks normally.
  const KEEP = /([0-9０-９]{1,4}年|（＿＿）|（何年？）)/;
  function pieces(text) {
    const out = [];
    String(text || "")
      .split("\n")
      .forEach((line, i) => {
        if (i) out.push({ br: true });
        line.split(/(　|：)/).forEach((part, j, all) => {
          if (!part) return;
          // The headword (the first part, before "　" or "：") stays whole when it is short.
          if (j === 0 && all.length > 1 && part.length <= 12) return out.push({ text: part, keep: true });
          part.split(KEEP).forEach((bit) => bit && out.push({ text: bit, keep: KEEP.test(bit) }));
        });
      });
    return out;
  }
  const model = { parseLine, questions, normalizeYear, correctYear, shade, record, plain, pieces, BLANK };
  root.TermQuestions = model;
  if (typeof module !== "undefined") module.exports = model;
  if (!root.document) return;

  // Per-question results on this device, carried by the full backup with the rest of the book.
  const owner = () => (typeof myId === "string" && myId ? myId : "GUEST-000"),
    key = (book, id = owner()) =>
      "core_v4_term_progress_" + id + "_" + encodeURIComponent(book || "default");
  // The word list asks once per row; keep the parsed value until the stored text changes.
  let cache = { name: null, raw: null, value: {} };
  function read(book) {
    const name = key(book),
      raw = localStorage.getItem(name) || "{}";
    if (cache.name === name && cache.raw === raw) return cache.value;
    let value = {};
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) value = parsed;
    } catch {}
    cache = { name, raw, value };
    return value;
  }
  function save(book, num, questionKey, status) {
    if (root.LibraryState?.isDeleted?.("book", book, owner())) return read(book);
    const next = record(read(book), String(num), questionKey, status);
    localStorage.setItem(key(book), JSON.stringify(next));
    return next;
  }
  // Shows a question's text in an element with pieces() kept whole (no innerHTML of the text).
  function show(node, text) {
    node.replaceChildren();
    node.classList.add("term-text");
    for (const p of pieces(text)) {
      if (p.br) node.append(document.createElement("br"));
      else if (p.keep) {
        const span = document.createElement("span");
        span.className = "term-keep";
        span.textContent = p.text;
        node.append(span);
      } else node.append(document.createTextNode(p.text));
    }
  }
  model.show = show;
  function enabled(book) {
    const pool = typeof textbooksPool !== "undefined" ? textbooksPool : [];
    return (pool || []).some((b) => b && b.id === book && b.termMode === true);
  }
  // Battles only record a drop, as for whole words: a question rated ○ answered wrong becomes ×.
  // 「わからない」 is the player's own "I don't know" and records ×.
  function battle(book, num, questionKey, right, skipped) {
    const previous = read(book)[String(num)]?.[questionKey]?.status;
    if (skipped || (!right && previous === "ok")) return save(book, num, questionKey, "bad");
    return read(book);
  }
  root.TermProgress = Object.freeze({ read, save, key, enabled, battle });

  // Flashcards: record each generated question's own result, and type the year for year questions.
  function current() {
    try {
      return typeof flashcardOriginQueue !== "undefined"
        ? flashcardOriginQueue[flashcardCurrentIndex] || null
        : null;
    } catch {
      return null;
    }
  }
  let panel = null,
    pending = null;
  function answerPanel() {
    if (panel?.isConnected) return panel;
    const screen = document.getElementById("flashcard-play-screen");
    if (!screen) return null;
    panel = document.createElement("form");
    panel.className = "term-answer-panel";
    panel.hidden = true;
    panel.innerHTML =
      '<label for="termYearInput">年号を入力</label><div><input id="termYearInput" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="例：1582"><button type="submit" data-sound="none">答える</button></div><p role="status"></p>';
    const input = panel.querySelector("input");
    input.addEventListener("input", () => (input.value = normalizeYear(input.value)));
    panel.addEventListener("submit", (event) => {
      event.preventDefault();
      const item = current();
      if (!item?.termInput || pending) return;
      if (!normalizeYear(input.value)) {
        panel.querySelector("p").textContent = "数字で入力してください。";
        return;
      }
      const right = correctYear(input.value, item.ja),
        card = document.getElementById("activeFlashcard");
      card?.classList.add("flipped");
      input.disabled = true;
      panel.dataset.result = right ? "right" : "wrong";
      panel.querySelector("p").textContent = right ? "正解！" : "正解は " + item.ja + " 年";
      root.AppSounds?.play(right ? "swipe-right" : "swipe-left");
      pending = setTimeout(
        () => {
          pending = null;
          if (current() === item) root.swipeFlashcard?.(right ? "right" : "left", 0, 0);
        },
        right ? 700 : 1600,
      );
    });
    screen.append(panel);
    return panel;
  }
  function showPanel() {
    clearTimeout(pending);
    pending = null;
    const item = current(),
      box = answerPanel();
    if (!box) return;
    const visible = !!(item?.termInput && document.getElementById("activeFlashcard"));
    box.hidden = !visible;
    if (!visible) return;
    const input = box.querySelector("input");
    input.value = "";
    input.disabled = false;
    delete box.dataset.result;
    box.querySelector("p").textContent = "";
  }
  document.addEventListener("click", (event) => {
    const markEl = event.target instanceof Element ? event.target.closest(".term-mark") : null;
    if (!markEl) return;
    const history = markEl.dataset.termHistory;
    root.showToast?.(
      "「" + markEl.textContent + "」 " + (history ? "これまで：" + history : "まだ出題されていません"),
      "info",
    );
  });
  root.onAppLoaded?.(() => {
    const swipe = root.swipeFlashcard;
    if (typeof swipe === "function" && !swipe.__terms) {
      const wrapped = function (direction) {
        const item = current(),
          status = { right: "ok", left: "bad", up: "so" }[direction];
        if (item?.termKey && status && typeof currentTextbook === "string")
          try {
            save(currentTextbook, item.num, item.termKey, status);
          } catch (error) {
            console.warn("問題ごとの記録を保存できませんでした", error);
          }
        return swipe.apply(this, arguments);
      };
      wrapped.__terms = true;
      root.swipeFlashcard = wrapped;
    }
    const render = root.renderFlashcardDeck;
    if (typeof render === "function" && !render.__terms) {
      const wrapped = function () {
        const result = render.apply(this, arguments);
        showPanel();
        return result;
      };
      wrapped.__terms = true;
      root.renderFlashcardDeck = wrapped;
    }
  });
})(typeof window === "undefined" ? globalThis : window);
