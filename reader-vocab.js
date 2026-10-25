// The word books the reader looks words up in. The user picks one or more (the current book when
// none is picked). Words are found with their inflections, given to the AI to check which carry a
// registered meaning, and coloured by the understanding of the meaning the sentence uses.
(function () {
  "use strict";
  const uid = () => (typeof myId === "string" && myId ? myId : "GUEST-000");
  const storeKey = () => "aiglish_reader_books_" + uid();
  const usable = () =>
    (typeof textbooksPool !== "undefined" ? textbooksPool : []).filter(
      (b) => b && b.id && !b.termMode && !window.LibraryState?.isDeleted?.("book", b.id),
    );
  const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩";

  function selected() {
    const ids = usable().map((b) => b.id);
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(storeKey()) || "null");
    } catch {}
    const picked = Array.isArray(saved) ? saved.filter((id) => ids.includes(id)) : [];
    // The open book comes first: its words win when two books have the same word.
    if (picked.length) return picked.sort((a, b) => (b === currentTextbook) - (a === currentTextbook));
    return typeof currentTextbook === "string" && ids.includes(currentTextbook) ? [currentTextbook] : [];
  }
  function choose(ids) {
    try {
      localStorage.setItem(storeKey(), JSON.stringify(ids));
    } catch {}
    renderButton();
  }
  const nameOf = (id) => (usable().find((b) => b.id === id) || {}).name || id;

  // ---- Words of the selected books -----------------------------------------------------------
  // Other books are read from their saved words with this account's understanding merged in.
  const masters = new Map();
  function withProgress(book, words) {
    let progress = {};
    try {
      progress = window.LearningData?.read(book) || {};
    } catch {}
    const signature = window.buildWordSignature;
    return words.map((w) => {
      const p = progress[String(w.num)],
        fits = p && (!p.sig || !signature || p.sig === signature(w));
      return Object.assign({}, w, {
        status: fits ? p.status || "none" : "none",
        history: fits && Array.isArray(p.history) ? p.history : [],
        meanings: (w.meanings || []).map((m) => {
          const mp = fits && p.meanings ? p.meanings[String(m.id)] : null;
          return Object.assign({}, m, {
            status: (mp && mp.status) || "none",
            history: mp && Array.isArray(mp.history) ? mp.history : [],
          });
        }),
      });
    });
  }
  async function wordsOf(book) {
    if (typeof currentTextbook === "string" && book === currentTextbook && Array.isArray(vocabList) && vocabList.length) return vocabList;
    const key = uid() + "\n" + book;
    if (!masters.has(key)) {
      let source = null;
      try {
        source = window.__getBookMasterWords ? await window.__getBookMasterWords(book) : null;
      } catch {}
      if (!Array.isArray(source) || !source.length) return [];
      const plain = window.stripVocabProgressFromWords ? window.stripVocabProgressFromWords(source) : source;
      masters.set(key, window.migrateVocabData ? window.migrateVocabData(plain.map((w) => Object.assign({}, w))) : plain);
    }
    return withProgress(book, masters.get(key));
  }

  // index: word (lower case) -> entries; entry = { book, num, alias }
  let books = [],
    index = new Map(),
    stems = new Map(),
    words = new Map();
  async function load() {
    // Read again each time, so edits to a book show at the next analysis.
    masters.clear();
    const ids = selected(),
      nextIndex = new Map(),
      nextStems = new Map(),
      nextWords = new Map();
    const lists = await Promise.all(ids.map((id) => wordsOf(id)));
    ids.forEach((book, b) => {
      const letter = String.fromCharCode(65 + (b % 26));
      for (const w of lists[b]) {
        const text = String(w.word || "").trim().toLowerCase();
        if (!text) continue;
        const entry = { book, num: String(w.num), alias: letter + w.num };
        nextWords.set(book + "\n" + entry.num, w);
        if (!nextIndex.has(text)) nextIndex.set(text, []);
        nextIndex.get(text).push(entry);
        const stem = window.stemWord ? window.stemWord(text) : "";
        if (stem && stem.length >= 4) {
          if (!nextStems.has(stem)) nextStems.set(stem, []);
          nextStems.get(stem).push(entry);
        }
      }
    });
    books = ids;
    index = nextIndex;
    stems = nextStems;
    words = nextWords;
  }
  // Every entry the token can be: the word itself, its stem, or a plain inflection.
  function find(cleanKey) {
    const w = String(cleanKey || "");
    if (!w) return [];
    if (index.has(w)) return index.get(w);
    const stem = window.stemWord ? window.stemWord(w) : "";
    if (stem && stem.length >= 4 && stems.has(stem)) return stems.get(stem);
    const forms = [];
    if (/s$/.test(w)) forms.push(w.slice(0, -1));
    if (/ies$/.test(w)) forms.push(w.slice(0, -3) + "y");
    if (/ied$/.test(w)) forms.push(w.slice(0, -3) + "y");
    if (/ed$/.test(w)) forms.push(w.slice(0, -1), w.slice(0, -2));
    if (/ing$/.test(w)) forms.push(w.slice(0, -3), w.slice(0, -3) + "e");
    if (/([bcdfgklmnprstvz])\1(ed|ing)$/.test(w)) forms.push(w.replace(/([bcdfgklmnprstvz])\1(ed|ing)$/, "$1"));
    for (const form of forms) if (form.length >= 2 && index.has(form)) return index.get(form);
    return [];
  }
  // The word as it is now (the open book's list is live; others as loaded).
  function word(entry) {
    if (typeof currentTextbook === "string" && entry.book === currentTextbook && Array.isArray(vocabList)) {
      const live = vocabList.find((v) => String(v.num) === String(entry.num));
      if (live) return live;
    }
    return words.get(entry.book + "\n" + entry.num) || null;
  }
  // For the AI: each entry in the text once, with its meanings.
  function candidates(text) {
    const seen = new Map();
    for (const token of String(text).split(/\s+/)) {
      const key = window.readerCleanToken ? window.readerCleanToken(token) : token.toLowerCase();
      for (const entry of find(key)) {
        if (seen.size >= 150 || seen.has(entry.alias)) continue;
        const w = word(entry);
        if (!w) continue;
        const meanings = (w.meanings && w.meanings.length ? w.meanings.map((m) => m.text) : [w.meaning || ""]).map((t) =>
          String(t || "").replace(/\s+/g, " ").trim().slice(0, 60),
        );
        seen.set(entry.alias, { alias: entry.alias, book: entry.book, num: entry.num, word: String(w.word || ""), meanings });
      }
    }
    return [...seen.values()];
  }

  // ---- Colours -------------------------------------------------------------------------------
  // The colour follows the meaning the sentence uses (sense, 1-based); without one, the word.
  function statusClass(w, sense) {
    const meaning = sense > 0 && w.meanings ? w.meanings[sense - 1] : null;
    if (meaning) return meaning.history && meaning.history.length ? "status-" + (meaning.status || "none") : "status-none";
    const list = w.meanings || [];
    if (!list.some((m) => m.history && m.history.length)) return "status-none";
    if (list.some((m) => m.status === "bad")) return "status-bad";
    if (list.some((m) => m.status === "so")) return "status-so";
    if (list.some((m) => m.status === "ok")) return "status-ok";
    return "status-none";
  }
  function paint(span) {
    const w = word({ book: span.dataset.vocabBook, num: span.dataset.vocabNum });
    span.classList.remove("status-ok", "status-so", "status-bad", "status-none");
    if (!w) return;
    span.classList.add("registered", statusClass(w, Number(span.dataset.sense) || 0));
  }

  // ---- Choosing the books --------------------------------------------------------------------
  function renderButton() {
    const button = document.getElementById("readerBooksButton");
    if (!button) return;
    const ids = selected();
    button.textContent = ids.length
      ? nameOf(ids[0]) + (ids.length > 1 ? " ほか" + (ids.length - 1) + "冊" : "") + " ›"
      : "単語帳がありません ›";
  }
  function openPicker() {
    const list = usable();
    const modal = window.openLibraryDialog(
      "参照する単語帳",
      '<p class="library-editor-hint">英文の中のこれらの単語帳の単語に色が付き、タップで意味を確認できます。AIが、文中で登録された意味で使われているかを確かめます。</p>' +
        '<div class="reader-book-choices"></div><p class="library-editor-error" role="alert"></p>' +
        '<div class="library-editor-actions"><button type="button" data-library-close>キャンセル</button><button type="button" class="library-editor-primary" data-reader-books="save">保存</button></div>',
    );
    const eyebrow = modal.querySelector(".library-editor-eyebrow");
    if (eyebrow) eyebrow.textContent = "";
    const box = modal.querySelector(".reader-book-choices"),
      chosen = selected();
    if (!list.length) box.textContent = "単語帳がありません。単語帳タブで作るか追加してください。";
    for (const book of list) {
      const label = document.createElement("label"),
        check = document.createElement("input");
      check.type = "checkbox";
      check.value = book.id;
      check.checked = chosen.includes(book.id);
      label.append(check, document.createTextNode(book.name || book.id));
      box.append(label);
    }
    modal.querySelector('[data-reader-books="save"]').onclick = () => {
      const ids = [...box.querySelectorAll("input:checked")].map((c) => c.value);
      if (list.length && !ids.length) return (modal.querySelector(".library-editor-error").textContent = "1冊以上選んでください。");
      choose(ids);
      window.closeLibraryDialog();
    };
  }

  window.ReaderVocab = Object.freeze({
    selected,
    choose,
    load,
    find,
    word,
    candidates,
    paint,
    statusClass,
    nameOf,
    openPicker,
    renderButton,
    books: () => books.slice(),
    circled: (i) => CIRCLED[i - 1] || "",
  });
  window.onAppLoaded?.(renderButton);
  window.onTabChange?.((tab) => {
    if (tab === "reader") renderButton();
  });
})();
