// The review round reads one downloaded book and writes only explicit answers.
(function () {
  "use strict";
  const owner = () => (typeof myId === "string" && myId ? myId : "GUEST-000");
  let menu,
    view,
    session,
    opening = 0;
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
  function closeMenu() {
    menu?.close();
    menu?.remove();
    menu = null;
  }
  window.openBookStudyMenu = function (book) {
    closeMenu();
    menu = node("dialog", "book-study-menu");
    menu.setAttribute("aria-label", "学習方法");
    menu.append(
      node("h2", "", "学習方法"),
      button("単語カード", () => {
        closeMenu();
        window.openBookFlashcardSettings(book);
      }),
      button("苦手復習", () => {
        closeMenu();
        open(book);
      }),
      button("閉じる", closeMenu, "review-subtle"),
    );
    menu.addEventListener("click", (event) => {
      if (event.target === menu) {
        const rect = menu.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          closeMenu();
      }
    });
    document.body.append(menu);
    menu.showModal();
  };
  function shell() {
    view = node("dialog", "weak-review-screen");
    view.setAttribute("aria-label", "苦手復習");
    const header = node("header");
    header.append(
      node("h2", "", "苦手復習"),
      button(
        "終了",
        () => (session?.playing ? finish() : close()),
        "review-subtle",
      ),
    );
    view.append(header, node("div", "review-content"));
    view.addEventListener("cancel", (event) => {
      event.preventDefault();
      session?.playing ? finish() : close();
    });
    document.body.append(view);
    view.showModal();
  }
  function content() {
    return view.querySelector(".review-content");
  }
  function message(text, detail) {
    view.dataset.state = "message";
    const body = content();
    body.replaceChildren(node("h3", "", text));
    if (detail) body.append(node("p", "review-description", detail));
    body.append(button("単語帳に戻る", close, "review-primary"));
  }
  function close() {
    opening++;
    session = null;
    view?.close();
    view?.remove();
    view = null;
    window.showVocabLibrarySelection?.();
  }
  async function open(book) {
    if (view) return;
    const token = ++opening,
      id = owner();
    session = null;
    shell();
    content().append(node("p", "", "教材を読み込んでいます…"));
    try {
      if (!window.LearningData.canSave(book))
        throw Error("理解度の読み込みが完了してから開いてください。");
      let source = window.TextbookFiles
        ? await window.TextbookFiles.getWords(book)
        : window.VocabMaster?.resolve(book)?.master;
      if (!source && window.__getBookMasterWords)
        source = await window.__getBookMasterWords(book);
      if (token !== opening || id !== owner()) return;
      if (!source?.length)
        throw Error("教材の内容を確認できません。単語帳を読み直してください。");
      window.StudyPoints.read(id);
      const progress = window.LearningData.read(book),
        now = Date.now(),
        sampler = window.WordDuelModel.poolSampler(now),
        targets = [];
      let count = 0;
      for (const word of window.migrateVocabData(
        window.stripVocabProgressFromWords(source),
      )) {
        const num = String(word.num),
          saved = progress[num],
          sig = window.buildWordSignature(word);
        for (const meaning of word.meanings || []) {
          const prompt = String(word.word || word.en || "").trim(),
            text = String(meaning.text || "").trim();
          if (!prompt || !text) continue;
          sampler.add({ word: prompt, meaning: text, duelRef: { book, num } });
          if (saved?.sig && saved.sig !== sig) continue;
          const prior =
            saved?.meanings?.[String(meaning.id)] ||
            (word.meanings.length === 1 ? { status: saved?.status } : null);
          if (!prior || !window.WeakReviewModel.eligible(saved, prior, now))
            continue;
          count++;
          const target = {
            prompt,
            meaning: text,
            ref: {
              book,
              num,
              mid: String(meaning.id),
              sig,
              count: word.meanings.length,
            },
            at: Number(prior.review?.at) || Number(saved?.editedAt) || 0,
          };
          targets.push(target);
          targets.sort(
            (a, b) =>
              a.at - b.at ||
              a.ref.num.localeCompare(b.ref.num, undefined, { numeric: true }),
          );
          if (targets.length > 20) targets.pop();
        }
      }
      const pool = sampler.result();
      if (!count) {
        message(
          "今日の苦手復習はありません",
          "前日までに×・△を付けた意味が対象です。今日初めて学習した単語は、明日から復習できます。",
        );
        return;
      }
      if (pool.length < 2)
        throw Error("選択式の復習には、異なる単語と意味が2組以上必要です。");
      session = {
        id,
        book,
        day: window.WeakReviewModel.day(now),
        seed: now,
        targets,
        pool,
        count,
        index: 0,
        correct: 0,
        points: 0,
        playing: true,
        answered: false,
      };
      render();
    } catch (error) {
      if (token === opening && id === owner())
        message("復習を開けませんでした", error.message);
    }
  }
  function render() {
    const s = session,
      target = s.targets[s.index],
      body = content();
    view.dataset.state = "playing";
    s.answered = false;
    s.question = window.WeakReviewModel.question(
      target,
      s.pool,
      s.seed,
      s.index,
    );
    const progress = node("div", "review-progress");
    progress.append(
      node("span", "", `${s.index + 1} / ${s.targets.length}`),
      node("span", "", `正解 ${s.correct}`),
    );
    const bar = node("progress");
    bar.setAttribute("aria-label", "復習の進み具合");
    bar.max = s.targets.length;
    bar.value = s.index;
    const question = node("section", "review-question"),
      prompt = node("h3", "review-prompt", target.prompt),
      choices = node("div", "review-choices");
    question.append(
      node("small", "review-question-label", "意味を選んでください"),
      prompt,
    );
    choices.style.setProperty(
      "--review-answer-rows",
      String(Math.ceil((s.question.options.length - 1) / 3)),
    );
    s.question.options.forEach((text, index) =>
      choices.append(
        button(
          text,
          () => answer(index),
          index === s.question.options.length - 1 ? "review-none" : "",
        ),
      ),
    );
    const feedback = node("div", "review-feedback");
    feedback.setAttribute("aria-live", "polite");
    body.replaceChildren(progress, bar, question, choices, feedback);
  }
  function answer(index) {
    const s = session;
    if (!s?.playing || s.answered) return;
    const feedback = content().querySelector(".review-feedback"),
      target = s.targets[s.index];
    if (owner() !== s.id || !window.LearningData.canSave(s.book)) {
      feedback.textContent =
        "読み込みが完了していません。終了してから開き直してください。";
      return;
    }
    if (window.WeakReviewModel.day() !== s.day) {
      finish("日付が変わったため、ここまでの回答を保存しました。");
      return;
    }
    const correct = index === s.question.correct;
    try {
      // Confirm the live record before issuing an award; stale/deleted books cannot earn points.
      if (window.LibraryState?.isDeleted("book", s.book, s.id))
        throw Error("この単語帳は削除されています。");
      const saved = window.LearningData.read(s.book)[target.ref.num];
      if (saved?.sig && saved.sig !== target.ref.sig)
        throw Error("教材が変更されています。終了して開き直してください。");
      let points = 0;
      if (correct)
        points = window.StudyPoints.award(s.book, target.ref.num, s.day, s.id, {
          word: target.prompt,
          bookName:
            (typeof textbooksPool !== "undefined" ? textbooksPool : []).find(
              (book) => book.id === s.book,
            )?.name || s.book,
        });
      window.WordDuelProgress.apply(s.book, target.ref, correct, s.id, {
        reviewDay: s.day,
      });
      window.WordDuelProgress.schedule(s.id);
      s.points += points;
      s.answered = true;
      if (correct) s.correct++;
      content().querySelector(".review-progress span:last-child").textContent =
        `正解 ${s.correct}`;
      content().querySelector("progress").value = s.index + 1;
      const buttons = [...content().querySelectorAll(".review-choices button")];
      buttons.forEach((el, i) => {
        el.disabled = true;
        if (i === s.question.correct) el.classList.add("is-correct");
        if (i === index) el.classList.add(correct ? "is-selected" : "is-wrong");
      });
      const response = node("div", "review-response");
      response.append(
        node(
          "p",
          "",
          correct
            ? `正解${points ? "　+10pt" : "　この単語は本日支給済み"}`
            : `正解：${target.meaning}`,
        ),
      );
      if (!correct)
        response.append(node("small", "", "この意味は苦手復習に残ります。"));
      feedback.append(response);
      feedback.append(
        button(
          s.index + 1 < s.targets.length ? "次へ" : "結果を見る",
          () => {
            s.index++;
            s.index < s.targets.length ? render() : finish();
          },
          "review-primary",
        ),
      );
    } catch (error) {
      feedback.textContent =
        "端末への保存を確認できませんでした。" + error.message;
    }
  }
  async function finish(detail) {
    const s = session;
    if (!s?.playing) return;
    s.playing = false;
    view.dataset.state = "result";
    const answered =
        s.index + (s.answered && s.index < s.targets.length ? 1 : 0),
      body = content();
    body.replaceChildren(
      node("h3", "", "復習おつかれさまでした"),
      node("p", "review-result", `${s.correct} / ${answered} 正解`),
      node(
        "p",
        "",
        `今回 +${s.points}pt　・　合計 ${window.StudyPoints.balance(s.id)}pt`,
      ),
    );
    if (detail) body.append(node("p", "", detail));
    body.append(
      node(
        "p",
        "review-description",
        "同じ単語のポイントは1日1回。複数の意味を復習しても、支給は最大10ptです。",
      ),
    );
    const state = node(
      "p",
      "review-save-state",
      "端末に保存済み・クラウドに同期中…",
    );
    state.setAttribute("aria-live", "polite");
    body.append(state);
    const again = button(
      "続けて復習",
      async () => {
        again.disabled = true;
        await saving;
        if (session !== s || owner() !== s.id) return;
        const book = s.book;
        close();
        open(book);
      },
      "review-primary",
    );
    body.append(again, button("単語帳に戻る", close, "review-subtle"));
    const saving = Promise.resolve(window.saveAfterStudy?.("review-end"))
      .then((result) => {
        if (session !== s || owner() !== s.id || !view) return;
        state.textContent = result?.cloudSaved
          ? "端末・クラウドに保存しました。"
          : "端末に保存済み。次の終了時・手動セーブで同期します。";
        const resultText =
          body.querySelector(".review-result")?.nextElementSibling;
        if (resultText)
          resultText.textContent = `今回 +${s.points}pt　・　合計 ${window.StudyPoints.balance(s.id)}pt`;
      })
      .catch(() => {
        if (session === s && view)
          state.textContent =
            "端末に保存済み。次の保存時に同期を再試行します。";
      });
  }
  window.onBeforeAppLoad?.(() => {
    closeMenu();
    if (view) {
      opening++;
      session = null;
      view.close();
      view.remove();
      view = null;
    }
  });
  window.WeakReview = { open, isPlaying: () => !!session?.playing };
})();
