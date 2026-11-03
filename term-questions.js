// 用語・年号モード: several questions from one entry.
//
// An entry is a headword (織田信長) and description lines. A line may start with a "when" (a year,
// a century or an era: "1582 「本能寺の変」で死亡したとされる人物", "12世紀 …", "平安時代 …") and may
// mark terms with 「」. From each entry:
//   whole  — one line shown, answer the headword (one question per line, like one card per
//            meaning in the normal mode)
//   year   — a line without its year, answer the year (typed, digits only); with a century
//            ("12世紀", "紀元前3世紀") the same, answering the number of the century
//   era    — a line without its era ("平安時代"), answer the era (a card, rated by the player)
//   blank  — a line with one 「」 term blanked, answer that term (one question per term)
// The text is stored as is (the year is just the start of the line), so no save path can drop it.
// Per-question results live in their own store, so a word's normal understanding record (which
// whole-word saves replace) is never asked to hold extra keys.
(function (root) {
  "use strict";
  // Eras of Japanese history with the year each began (for putting them in order).
  const ERAS = [["縄文", -14000], ["弥生", -1000], ["古墳", 250], ["飛鳥", 592], ["奈良", 710], ["平安", 794], ["鎌倉", 1185], ["室町", 1336], ["安土桃山", 1573], ["江戸", 1603], ["明治", 1868], ["大正", 1912], ["昭和", 1926], ["平成", 1989], ["令和", 2019]];
  const ERA_START = new Map(ERAS);
  // A line starts with a "when": a century (12世紀, 紀元前3世紀), an era (平安時代: the 時代 is
  // needed, so a line that only starts with 明治維新 is not taken for one) or a year (1582, 1582年).
  const WHEN_LEAD = new RegExp(
    "^(\\s*)(?:((?:紀元前|前)?\\s*[0-9０-９]{1,2}\\s*世紀|(?:" + ERAS.map((e) => e[0]).join("|") + ")時代)(\\s*)|([0-9０-９]{1,4})(\\s*年?\\s*))",
  );
  const TERM = /「([^「」]+)」/g,
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
  // What a "when" in the text is: { kind: "year" | "century" | "era", label, value, answer, ... }.
  // `value` puts events of the same kind in order (the start year of a century or an era).
  function describe(raw) {
    const text = halfWidth(raw).replace(/\s+/g, "");
    if (/世紀$/.test(text)) {
      const bc = /^(紀元前|前)/.test(text),
        n = Number(text.replace(/[^0-9]/g, ""));
      if (!(n >= 1)) return null;
      return { kind: "century", label: (bc ? "紀元前" : "") + n + "世紀", value: bc ? 1 - n * 100 : (n - 1) * 100 + 1, answer: String(n), unit: "世紀", prefix: bc ? "紀元前" : "", ask: bc ? "紀元前何世紀" : "何世紀" };
    }
    if (/時代$/.test(text)) {
      const name = text.slice(0, -2);
      return ERA_START.has(name) ? { kind: "era", label: name + "時代", value: ERA_START.get(name), answer: name + "時代", unit: "", prefix: "", ask: "何時代" } : null;
    }
    const year = normalizeYear(text);
    return year === "" ? null : { kind: "year", label: year + "年", value: Number(year), answer: year, unit: "年", prefix: "", ask: "何年" };
  }
  // The "when" at the start of a line: the text around it and what it is, or null.
  function splitWhen(text) {
    const m = WHEN_LEAD.exec(String(text || ""));
    if (!m) return null;
    const raw = m[2] || m[4],
      when = describe(raw);
    return when ? { lead: m[1], raw, rest: m[2] ? m[3] : m[5], length: m[0].length, when } : null;
  }
  // What a box for the "when" accepts: "1582", "１５８２年", "12世紀", "紀元前3世紀", "平安", "平安時代".
  // Returns the text as a line starts with it ("1582", "12世紀", "平安時代"), "" for nothing, or null
  // when it is none of these.
  function whenText(input) {
    const text = halfWidth(input).replace(/\s+/g, "");
    if (!text) return "";
    const bare = ERA_START.has(text) ? text + "時代" : text,
      found = splitWhen(bare);
    if (!found || found.length !== bare.length) return null;
    return found.when.kind === "year" ? found.when.answer : found.when.label;
  }
  function parseLine(text) {
    const source = String(text || ""),
      found = splitWhen(source),
      when = found ? found.when : null,
      year = when?.kind === "year" ? when.answer : "",
      body = (found ? source.slice(found.length) : source).trim(),
      terms = [];
    for (const term of body.matchAll(TERM)) terms.push(term[1].trim());
    // Every 「」 keeps its position so question keys, blanks and list markers count the same way.
    return { year, when, body, terms };
  }
  function blankOut(body, index) {
    let seen = -1;
    return body.replace(TERM, (all, term) => (++seen === index ? BLANK : term));
  }
  const JAPANESE = /[\u3040-\u30ff\u3400-\u9fff]/;
  // A phrase line in an English book: the English with its 「」 and then the Japanese, either on
  // the next line ("+ A + 「as」 B" / "AをBとみなす") or straight after a leading 「」 (「following」次の).
  // Lines like 「本能寺の変」で死亡した (the 「」 is Japanese) are not phrase lines.
  function phrase(body) {
    const nl = body.indexOf("\n");
    if (nl > 0) {
      const english = body.slice(0, nl).trim(),
        japanese = body.slice(nl + 1).trim();
      // Without 「」 the whole English line is what is asked (considering / Vしようかと思う).
      if (english && japanese && /[A-Za-z]/.test(english) && !JAPANESE.test(english) && JAPANESE.test(japanese))
        return /「[^「」]+」/.test(english) ? { english, japanese } : { english: "「" + english + "」", japanese, bare: true };
    }
    const lead = /^「([^「」]+)」\s*([\s\S]+)$/.exec(body);
    if (lead && !JAPANESE.test(lead[1]) && JAPANESE.test(lead[2]))
      return { english: "「" + lead[1] + "」", japanese: lead[2].trim() };
    return null;
  }
  function lines(word) {
    const meanings =
      Array.isArray(word?.meanings) && word.meanings.length
        ? word.meanings
        : [{ id: String(word?.num) + "-0", text: word?.meaning || "" }];
    return meanings
      .map((m, index) => ({ mid: String(m.id ?? String(word.num) + "-" + index), index, only: m.blankOnly === true, ...parseLine(m.text) }))
      .filter((line) => line.body || line.when);
  }
  function questions(word) {
    const head = String(word?.word || "").trim(),
      parts = lines(word),
      list = [];
    if (!head || !parts.length) return list;
    for (const p of parts) {
      // A line set to 「」の問題だけ (its 「」 is a different phrase, so "which headword?" would not
      // be one-to-one) gives no whole question, as long as it has a term to ask.
      // An entry with one line keeps the key "w" it always had, so its record stays. A phrase line
      // is asked through its own card below (a "which headword?" card would not be one-to-one).
      const ph = (p.terms[0] || !p.terms.length) ? phrase(p.body) : null;
      // A bare English line stands for its own 「」.
      if (ph?.bare) p.terms = [plain(ph.english)];
      if (!(p.only && p.terms.some(Boolean)) && !ph)
        list.push({
          key: parts.length === 1 ? "w" : "w:" + p.mid,
          kind: "whole",
          mid: p.mid,
          index: p.index,
          prompt: (p.when ? p.when.label + " " : "") + plain(p.body),
          answer: head,
          input: false,
        });
      if (p.when && p.body && p.when.kind !== "era")
        list.push({
          key: (p.when.kind === "year" ? "y:" : "c:") + p.mid,
          kind: "year",
          mid: p.mid,
          index: p.index,
          prompt: head + "：" + plain(p.body) + "（" + p.when.ask + "？）",
          answer: p.when.answer,
          unit: p.when.unit,
          prefix: p.when.prefix,
          input: true,
        });
      // An era is a card: the line without it → the era (rated by the player, not typed).
      if (p.when?.kind === "era" && p.body)
        list.push({
          key: "e:" + p.mid,
          kind: "era",
          mid: p.mid,
          index: p.index,
          prompt: head + "：" + plain(p.body) + "（何時代？）",
          answer: p.when.label,
          input: false,
        });
      if (ph) {
        // One card for the line. 英単語を先に: the English in full → the Japanese. 意味を先に: the
        // headword, the English with its 「」 blanked (unless the 「」 is the whole English) and the
        // Japanese → the 「」 and the full English.
        // A pattern written with "+" (+ to V, + A + as B) joins onto the headword without the
        // plus signs, on one line: expect to V, consider A as B.
        const pattern = /^\s*[+＋]/.test(plain(ph.english)),
          join = (text) => (pattern ? head + " " + text.replace(/\s*[+＋]\s*/g, " ").replace(/[ 　]+/g, " ").trim() : text),
          english = join(plain(ph.english).replace(/[ 　]+/g, " ").trim()),
          // The English line as it is (increasingly, as follows); a "+" pattern already starts
          // with the headword.
          shown = english,
          whole = ph.english.trim() === "「" + p.terms[0] + "」",
          blanked = join(ph.english.replace(TERM, BLANK).replace(/[ 　]+/g, " ").trim());
        list.push({
          key: "t:" + p.mid + ":0",
          kind: "blank",
          mid: p.mid,
          index: p.index,
          prompt: head + "　" + blankOut(p.body, 0),
          answer: p.terms[0],
          front: shown,
          back: ph.japanese,
          reverse: {
            front: (pattern ? blanked : head + (whole ? "" : "\n" + blanked)) + "\n" + ph.japanese,
            back: whole ? (pattern ? english : p.terms.filter(Boolean).join("、")) : p.terms.filter(Boolean).join("、") + "\n" + english,
          },
          input: false,
        });
        continue;
      }
      p.terms.forEach((term, t) =>
        term &&
        list.push({
          key: "t:" + p.mid + ":" + t,
          kind: "blank",
          mid: p.mid,
          index: p.index,
          prompt: head + (p.when ? "　" + p.when.label : "") + "　" + blankOut(p.body, t),
          answer: term,
          // As a card too: the line with the term blanked on the front, the term behind (showing
          // the term alone first asked "大連 → ?" with nothing to answer).
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
  const KEEP = new RegExp("((?:紀元前)?[0-9０-９]{1,4}(?:年|世紀)|(?:" + ERAS.map((e) => e[0]).join("|") + ")時代|（＿＿）|（(?:紀元前)?何(?:年|世紀|時代)？）)");
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
  const model = { parseLine, questions, normalizeYear, correctYear, shade, record, plain, pieces, splitWhen, whenText, ERAS, BLANK };
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
  // head (optional): the headword, shown in bold wherever it stands as a word.
  function show(node, text, head) {
    node.replaceChildren();
    node.classList.add("term-text");
    const word = String(head || "").trim(),
      find = word ? new RegExp("(^|[^A-Za-z])(" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?![A-Za-z])", "gi") : null;
    // Plain text with the headword picked out.
    const add = (parent, value) => {
      if (!find) return parent.append(document.createTextNode(value));
      let at = 0;
      for (const m of value.matchAll(find)) {
        const start = m.index + m[1].length;
        if (start > at) parent.append(document.createTextNode(value.slice(at, start)));
        const b = document.createElement("b");
        b.className = "term-head";
        b.textContent = m[2];
        parent.append(b);
        at = start + m[2].length;
      }
      if (at < value.length) parent.append(document.createTextNode(value.slice(at)));
    };
    for (const p of pieces(text)) {
      if (p.br) node.append(document.createElement("br"));
      else if (p.keep) {
        const span = document.createElement("span");
        span.className = "term-keep";
        add(span, p.text);
        node.append(span);
      } else add(node, p.text);
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
      '<section class="term-answer-question" hidden></section><label for="termYearInput">年号を入力</label><div><input id="termYearInput" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="例：1582"><button type="submit" data-sound="none">答える</button></div><p role="status"></p>';
    const input = panel.querySelector("input");
    input.addEventListener("input", () => (input.value = normalizeYear(input.value)));
    // While typing, the keyboard covers the lower half of the screen and the phone moves the whole
    // page up to keep the box in view, which pushes the question off the top. So the panel moves
    // to the top (where no moving is needed) and carries the question with it.
    const question = panel.querySelector(".term-answer-question");
    let leaving = 0;
    input.addEventListener("focus", () => {
      clearTimeout(leaving);
      const item = current();
      if (item) {
        show(question, item.en, item.head);
        question.hidden = false;
      }
      panel.classList.add("is-typing");
    });
    // Left a moment after, so a tap on 答える (the box loses focus just before it) is not lost to
    // the panel moving away under the finger.
    input.addEventListener("blur", () => {
      clearTimeout(leaving);
      leaving = setTimeout(() => {
        // Still in the panel, or an answer is on show (a tap on 答える does not always focus it):
        // the question stays until the next card.
        if (panel.contains(document.activeElement) || panel.dataset.result) return;
        panel.classList.remove("is-typing");
        question.hidden = true;
      }, 400);
    });
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
      panel.querySelector("p").textContent = right ? "正解！" : "正解は " + (item.termPrefix || "") + item.ja + " " + (item.termUnit || "年");
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
    box.classList.remove("is-typing");
    box.querySelector(".term-answer-question").hidden = true;
    if (!visible) return;
    const input = box.querySelector("input"),
      century = item.termUnit === "世紀";
    // A century is typed as its number (one or two digits), a year as up to four.
    box.querySelector("label").textContent = (item.termPrefix || "") + (century ? "世紀を入力" : "年号を入力");
    input.maxLength = century ? 2 : 4;
    input.placeholder = century ? "例：12" : "例：1582";
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
