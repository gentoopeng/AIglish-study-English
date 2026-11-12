// 「今日の学習」: a card at the top of the home screen (the word-book list) for the book the player is on: go on with the
// flashcards where they stopped (or start them), and 苦手復習 with how many meanings are waiting. It only opens what already
// exists (FlashResume / openBookFlashcardSettings in learning-sessions.js, WeakReview.open in weak-review.js).
(function () {
  "use strict";
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const owner = () => (typeof myId === "string" && myId ? myId : "GUEST-000");
  const bookId = () => {
    try {
      return (typeof currentTextbook === "string" && currentTextbook) || localStorage.getItem("core_v4_current_textbook_id") || "";
    } catch {
      return "";
    }
  };
  // How many meanings 苦手復習 has for today in this book (from what is saved on this device; null while that is still loading).
  function weakCount(book) {
    const L = window.LearningData,
      W = window.WeakReviewModel;
    if (!L || !W || !L.canSave(book)) return null;
    let n = 0;
    const now = Date.now();
    for (const saved of Object.values(L.read(book) || {})) {
      if (!saved || typeof saved !== "object") continue;
      const meanings = saved.meanings && Object.keys(saved.meanings).length ? Object.values(saved.meanings) : [{ status: saved.status }];
      for (const prior of meanings) if (prior && W.eligible(saved, prior, now)) n++;
    }
    return n;
  }
  function render() {
    const section = document.getElementById("vocabLibrarySelection");
    if (!section) return;
    let card = document.getElementById("todayStudy");
    const book = bookId(),
      row = book && [...document.querySelectorAll("#vocabLibraryBooks .textbook-list-item")].find((el) => el.dataset.bookId === book);
    if (!book || !row) {
      card?.remove();
      return;
    }
    if (!card) {
      card = node("section", "today-study");
      card.id = "todayStudy";
      card.setAttribute("aria-label", "今日の学習");
      section.querySelector(".vocab-library-header")?.after(card);
    }
    const name = row.querySelector(".textbook-list-name")?.textContent || "この単語帳";
    const saved = window.FlashResume?.info(book),
      weak = weakCount(book);
    card.replaceChildren();
    const head = node("div", "today-study-head");
    head.append(node("b", "", "今日の学習"), node("small", "", name));
    const go = node("button", "today-study-main", saved ? "単語カードを続きから（" + saved.index + " / " + saved.total + "）" : "単語カードを始める");
    go.type = "button";
    go.onclick = async () => {
      go.disabled = true;
      try {
        if (saved) await window.FlashResume.resume(book);
        else window.openBookFlashcardSettings(book);
      } catch {
        window.showToast?.("開けませんでした。もう一度お試しください。", "error");
      } finally {
        go.disabled = false;
      }
    };
    const review = node("button", "today-study-sub", weak === null ? "苦手復習（読み込み中…）" : weak ? "苦手復習（" + weak + "）" : "苦手復習（今日はありません）");
    review.type = "button";
    review.disabled = !weak;
    review.onclick = () => window.WeakReview?.open(book);
    const more = node("button", "today-study-more", "ほかの勉強方法");
    more.type = "button";
    more.onclick = () => window.openBookStudyMenu?.(book);
    const row2 = node("div", "today-study-row");
    row2.append(review, more);
    card.append(head, go, row2);
  }
  const wrap = window.renderVocabLibrarySelection;
  window.renderVocabLibrarySelection = function () {
    const result = typeof wrap === "function" ? wrap.apply(this, arguments) : undefined;
    try {
      render();
    } catch (error) {
      console.warn("[today-study]", error);
    }
    return result;
  };
  window.onAppLoaded?.(() => setTimeout(render, 0));
  window.TodayStudy = { render, weakCount };
  render();
})();
