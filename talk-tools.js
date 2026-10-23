// Study tools inside the group talk: a word quiz sent from one's own word book, and English
// words in messages that can be tapped to see their meaning, hear them and keep them.
(function (root) {
  "use strict";
  const uid = () => (typeof myId === "string" ? myId : "GUEST-000");
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
  const books = () =>
    (typeof textbooksPool !== "undefined" ? textbooksPool : []).filter(
      (b) => b && b.id && !b.termMode,
    );
  // Words of a book, as stored (no learning records).
  async function wordsOf(book) {
    let source = root.TextbookFiles
      ? await root.TextbookFiles.getWords(book)
      : root.VocabMaster?.resolve(book)?.master;
    if (!source && root.__getBookMasterWords)
      source = await root.__getBookMasterWords(book);
    if (!source?.length) throw Error("単語帳の読み込みを確認してください。");
    return root.migrateVocabData(root.stripVocabProgressFromWords(source));
  }
  const meaningOf = (word) =>
    String(word.meanings?.[0]?.text || word.meaning || "").trim();

  // ---- Word quiz ----------------------------------------------------------------------
  // A quiz is the word, four meanings (one right) and a reference to the sender's book entry,
  // so members who study the same book get the answer recorded like a battle answer.
  function makeQuiz(word, pool, book) {
    const meaning = meaningOf(word),
      others = [
        ...new Set(
          pool
            .map(meaningOf)
            .filter((text) => text && text !== meaning),
        ),
      ];
    if (!meaning || others.length < 3)
      throw Error("意味の違う単語が4つ以上ある単語帳を選んでください。");
    const picks = [];
    while (picks.length < 3) {
      const text = others[Math.floor(Math.random() * others.length)];
      if (!picks.includes(text)) picks.push(text);
    }
    const correct = Math.floor(Math.random() * 4),
      options = picks.slice();
    options.splice(correct, 0, meaning);
    const first = word.meanings?.[0];
    return {
      word: String(word.word || "").slice(0, 160),
      options: options.map((text) => text.slice(0, 160)),
      correct,
      ref: {
        book,
        num: String(word.num),
        mid: String(first?.id ?? word.num + "-0"),
        sig: root.buildWordSignature(word),
        count: (word.meanings || []).length || 1,
      },
    };
  }
  // Pick a word to send: weak ones (× or △) first, then any.
  function pickWord(words, book) {
    const progress = root.LearningData?.read(book) || {},
      rated = (w, status) =>
        Object.values(progress[String(w.num)]?.meanings || {}).some(
          (m) => m.status === status,
        ) || progress[String(w.num)]?.status === status,
      usable = words.filter((w) => meaningOf(w) && w.word),
      weak = usable.filter((w) => rated(w, "bad") || rated(w, "so")),
      from = weak.length && Math.random() < 0.7 ? weak : usable;
    return from[Math.floor(Math.random() * from.length)];
  }
  function openQuizPicker(send) {
    const list = books();
    if (!list.length) return root.showToast?.("単語帳がありません。", "info");
    const sheet = node("dialog", "talk-sheet");
    sheet.setAttribute("aria-label", "単語クイズを出す");
    const close = () => {
      sheet.close();
      sheet.remove();
    };
    const select = node("select");
    select.setAttribute("aria-label", "単語帳");
    for (const b of list) {
      const option = node("option", "", b.name || b.id);
      option.value = b.id;
      select.append(option);
    }
    if (typeof currentTextbook === "string" && list.some((b) => b.id === currentTextbook))
      select.value = currentTextbook;
    const preview = node("div", "talk-quiz-preview"),
      message = node("p", "talk-sheet-status");
    message.setAttribute("role", "status");
    let quiz = null,
      words = [],
      loadedBook = "";
    const draw = () => {
      preview.replaceChildren();
      if (!quiz) return;
      preview.append(
        node("strong", "", quiz.word),
        ...quiz.options.map((text, i) =>
          node("span", i === quiz.correct ? "is-answer" : "", text),
        ),
      );
    };
    const next = async () => {
      message.textContent = "";
      try {
        if (loadedBook !== select.value) {
          message.textContent = "読み込み中…";
          words = await wordsOf(select.value);
          loadedBook = select.value;
          message.textContent = "";
        }
        quiz = makeQuiz(pickWord(words, select.value), words, select.value);
      } catch (error) {
        quiz = null;
        message.textContent = error.message;
      }
      draw();
    };
    select.onchange = next;
    const sendButton = button(
      "トークに送る",
      async () => {
        if (!quiz) return;
        sendButton.disabled = true;
        if (await send(quiz)) close();
        else sendButton.disabled = false;
      },
      "talk-primary",
    );
    sheet.append(
      node("h3", "", "単語クイズを出す"),
      node("p", "talk-sheet-hint", "苦手な単語から多めに選びます。正解はみんなが答えた後にわかります。"),
      select,
      preview,
      message,
      node("div", "talk-sheet-actions"),
    );
    sheet
      .querySelector(".talk-sheet-actions")
      .append(button("別の単語", next), sendButton, button("閉じる", close, "talk-subtle"));
    sheet.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });
    document.body.append(sheet);
    sheet.showModal();
    next();
  }
  // Answers are kept on the message: answers.{member} = { c: choice, at }.
  async function answerQuiz(groupId, item, choice) {
    const account = uid();
    if (item.answers?.[account] || item.ownerId === account) return;
    await root.fbSetDoc(
      root.fbDoc(root.db, "studyGroups", groupId, "messages", item.id),
      { answers: { [account]: { c: choice, at: Date.now() } } },
      { merge: true },
    );
    const right = choice === item.quiz.correct,
      ref = item.quiz.ref;
    // Same rule as battles: only a ○ answered wrong drops; recorded only for a book this
    // member has, with the same word (the signature check refuses a changed entry).
    if (ref?.book && books().some((b) => b.id === ref.book))
      try {
        root.WordDuelProgress?.apply(ref.book, ref, right, account, { onlyDowngrade: true });
      } catch {}
    if (right)
      root.StudyPoints?.reward?.("quiz", ref?.book || "talk", ref?.num || item.id, account, {
        word: item.quiz.word,
      });
  }
  function quizBubble(item, groupId, members) {
    const account = uid(),
      quiz = item.quiz,
      mine = item.answers?.[account],
      answered = Object.keys(item.answers || {}).filter((id) => id !== item.ownerId),
      rights = answered.filter((id) => item.answers[id].c === quiz.correct).length,
      own = item.ownerId === account,
      reveal = own || !!mine,
      box = node("div", "talk-quiz");
    box.append(node("small", "talk-quiz-label", "単語クイズ"), node("strong", "talk-quiz-word", quiz.word));
    const options = node("div", "talk-quiz-options");
    quiz.options.forEach((text, i) => {
      const b = button(text, async () => {
        options.querySelectorAll("button").forEach((el) => (el.disabled = true));
        b.classList.add("is-picked");
        try {
          await answerQuiz(groupId, item, i);
        } catch (error) {
          options.querySelectorAll("button").forEach((el) => (el.disabled = false));
          root.showToast?.("回答を送れませんでした。" + error.message, "err");
        }
      });
      if (reveal) {
        b.disabled = true;
        if (i === quiz.correct) b.classList.add("is-right");
        else if (mine?.c === i) b.classList.add("is-wrong");
      }
      options.append(b);
    });
    box.append(options);
    const total = Math.max(0, Object.keys(members || {}).length - 1);
    box.append(
      node(
        "p",
        "talk-quiz-result",
        mine
          ? (mine.c === quiz.correct ? "正解！" : "正解は「" + quiz.options[quiz.correct] + "」") +
              " · " + rights + " / " + answered.length + "人正解"
          : own
            ? answered.length + " / " + total + "人が回答 · " + rights + "人正解"
            : "タップして答える",
      ),
    );
    if (reveal)
      box.append(
        button("🔊", () => root.Pronounce?.speak(quiz.word), "talk-quiz-speak"),
      );
    box.querySelector(".talk-quiz-speak")?.setAttribute("aria-label", "発音を聞く");
    return box;
  }

  // ---- Tappable English words -------------------------------------------------------------
  const WORD = /[A-Za-z][A-Za-z0-9'’-]*[A-Za-z0-9]|[A-Za-z]/g;
  function wordify(text) {
    const fragment = document.createDocumentFragment();
    let at = 0;
    for (const match of String(text).matchAll(WORD)) {
      if (match.index > at) fragment.append(text.slice(at, match.index));
      const word = button(match[0], (event) => {
        event.stopPropagation();
        openWord(match[0]);
      }, "talk-word");
      fragment.append(word);
      at = match.index + match[0].length;
    }
    if (at < text.length) fragment.append(text.slice(at));
    return fragment;
  }
  // Meanings from the word books already on this device (no download, no network).
  function lookup(word) {
    const wanted = word.toLowerCase().replace(/’/g, "'"),
      found = [];
    for (const b of books()) {
      const master =
        (typeof textbooksCacheMap !== "undefined" && textbooksCacheMap[b.id]) ||
        root.VocabMaster?.resolve?.(b.id)?.master ||
        [];
      for (const w of master)
        if (String(w.word || "").trim().toLowerCase() === wanted) {
          const meaning = meaningOf(root.migrateVocabData([w])[0]);
          if (meaning) found.push({ book: b.name || b.id, meaning });
        }
      if (found.length >= 3) break;
    }
    return found;
  }
  const collection = "トークの単語";
  // Keep a word: the word book editor opens with the word filled in, for one tap to save.
  function keep(word, meaning) {
    const existing = books().find((b) => b.name === collection && root.isPersonalTextbook?.(b.id));
    let next = 1;
    if (existing) {
      const master = root.VocabMaster?.resolve?.(existing.id)?.master || [];
      next = master.reduce((n, w) => Math.max(n, Number(w.num) || 0), 0) + 1;
    }
    root.switchTab?.("vocab");
    root.openLibraryBookEditor(existing?.id);
    const name = document.getElementById("libraryBookName"),
      words = document.getElementById("libraryBookWords");
    if (!existing && name) name.value = collection;
    if (words) {
      words.value = next + ":" + word + ":" + (meaning || "");
      words.focus();
      words.setSelectionRange(words.value.length, words.value.length);
    }
  }
  function openWord(word) {
    const sheet = node("dialog", "talk-sheet talk-word-sheet");
    sheet.setAttribute("aria-label", word);
    const close = () => {
      sheet.close();
      sheet.remove();
    };
    const found = lookup(word),
      head = node("div", "talk-word-head");
    head.append(
      node("strong", "", word),
      button("🔊", () => root.Pronounce?.speak(word), "talk-quiz-speak"),
    );
    head.querySelector("button").setAttribute("aria-label", "発音を聞く");
    sheet.append(head);
    if (found.length)
      for (const item of found) {
        const row = node("p", "talk-word-meaning");
        row.append(node("span", "", item.meaning), node("small", "", item.book));
        sheet.append(row);
      }
    else sheet.append(node("p", "talk-sheet-hint", "手元の単語帳には見つかりませんでした。"));
    const actions = node("div", "talk-sheet-actions");
    actions.append(
      button("「" + collection + "」に追加", () => {
        close();
        keep(word, found[0]?.meaning || "");
      }, "talk-primary"),
      button("閉じる", close, "talk-subtle"),
    );
    sheet.append(actions);
    sheet.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });
    sheet.addEventListener("click", (event) => {
      if (event.target === sheet) close();
    });
    document.body.append(sheet);
    sheet.showModal();
    root.Pronounce?.speak(word);
  }
  root.TalkTools = Object.freeze({ openQuizPicker, quizBubble, wordify, lookup, makeQuiz, openWord });
})(window);
