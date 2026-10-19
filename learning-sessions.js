// Durable flash position, daily meaning counts and a short login warm-up.
(function () {
  "use strict";
  const uid = () => myId || "GUEST-000",
    key = (kind, book) =>
      "core_v4_" + kind + "_" + uid() + "_" + encodeURIComponent(book);
  let active = null;
  function read(kind, book) {
    try {
      return JSON.parse(localStorage.getItem(key(kind, book)) || "null");
    } catch {
      return null;
    }
  }
  function session(book) {
    const queue = read("flash_queue", book),
      state = read("flash_cursor", book);
    return queue &&
      state &&
      typeof queue.id === "string" &&
      Array.isArray(queue.items) &&
      queue.id === state.id &&
      Number.isInteger(state.index) &&
      state.index >= 0 &&
      state.index < queue.items.length
      ? { queue, state }
      : null;
  }
  function checkpoint(force = false) {
    if (!active || active.owner !== uid()) return;
    const cursor = read("flash_cursor", active.book);
    if (!force && cursor?.id && cursor.id !== active.id) return;
    localStorage.setItem(
      key("flash_cursor", active.book),
      JSON.stringify({
        id: active.id,
        index: flashcardCurrentIndex,
        learned: flashcardLearnedCount,
        at: Date.now(),
      }),
    );
  }
  function begin() {
    const book = currentTextbook,
      id = crypto.randomUUID();
    active = { owner: uid(), book, id };
    const lookup = new Map(vocabList.map((w) => [String(w.num), w]));
    localStorage.setItem(
      key("flash_queue", book),
      JSON.stringify({
        id,
        direction: flashcardDirectionMode,
        items: flashcardOriginQueue.map((w) => ({
          num: String(w.num),
          mid: w.meaningId,
          index: w.meaningIndex,
          sig: window.buildWordSignature(lookup.get(String(w.num))),
        })),
      }),
    );
    checkpoint(true);
  }
  function finish(keep) {
    if (!active || active.owner !== uid()) return;
    record();
    if (keep) checkpoint();
    else if (read("flash_cursor", active.book)?.id === active.id) {
      localStorage.removeItem(key("flash_cursor", active.book));
      localStorage.removeItem(key("flash_queue", active.book));
    }
    active = null;
  }
  async function resume(book) {
    const saved = session(book),
      account = uid();
    if (!saved) return;
    const result = await window.selectVocabLibraryBook(book);
    if (result === false || uid() !== account) return;
    const lookup = new Map(vocabList.map((w) => [String(w.num), w])),
      queue = saved.queue.items.map((ref) => {
        const w = lookup.get(ref.num);
        if (!w || window.buildWordSignature(w) !== ref.sig) return null;
        const meaning =
          w.meanings?.find((m) => String(m.id) === String(ref.mid)) ||
          w.meanings?.[ref.index];
        if (!meaning) return null;
        return {
          num: w.num,
          en: w.word,
          ja: meaning.text,
          meaningId: String(meaning.id),
          meaningIndex: w.meanings.indexOf(meaning),
          partOfSpeech: window.getFlashcardPartOfSpeech(w, meaning),
        };
      });
    if (queue.some((w) => !w)) {
      alert(
        "中断後に教材の内容が変わっています。範囲を確認して新しく開始してください。理解度は保持されています。",
      );
      return;
    }
    window.closeBookFlashcardSettings();
    window.switchTab("game");
    flashcardOriginQueue = queue;
    flashcardCurrentIndex = saved.state.index;
    flashcardLearnedCount = saved.state.learned || 0;
    flashcardSessionHistory = [];
    window.setFlashcardDirection(saved.queue.direction);
    active = { owner: account, book, id: saved.queue.id };
    document.getElementById("flashcard-setup-screen").style.display = "none";
    document.getElementById("flashcard-play-screen").style.display = "flex";
    document.body.classList.add("in-game-active");
    window.renderFlashcardDeck();
  }
  window.FlashCheckpoint = { begin, save: checkpoint, finish, resume, session };
  window.pauseFlashcardSession = async function () {
    checkpoint();
    window.finishFlashcardSession(true);
    window.queueBackgroundSave?.();
    await window.AppStorage?.flush();
  };
  window.addEventListener("pagehide", () => {
    checkpoint();
    window.AppStorage?.flush();
  });
  window.onBeforeAppLoad(() => {
    checkpoint();
    active = null;
  });
  const openSettings = window.openBookFlashcardSettings;
  window.openBookFlashcardSettings = function (book) {
    openSettings.apply(this, arguments);
    const d = document.querySelector("dialog.book-flashcard-dialog");
    if (!d || d.querySelector("[data-flash-resume]")) return;
    const saved = session(book);
    if (saved) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.flashResume = "";
      b.className = "flash-resume";
      b.textContent =
        "途中から再開（" +
        saved.state.index +
        " / " +
        saved.queue.items.length +
        "）";
      b.onclick = async () => {
        b.disabled = true;
        try {
          await resume(book);
        } catch {
          alert("再開できませんでした。接続・教材を確認してください。");
        } finally {
          b.disabled = false;
        }
      };
      d.querySelector("h2").after(b);
    }
  };

  // Snapshot meaning statuses once per day; never manufacture historical values.
  function counts(words) {
    const result = { ok: 0, so: 0, bad: 0, none: 0 };
    for (const w of words || []) {
      for (const m of w.meanings?.length ? w.meanings : [w])
        result[Object.hasOwn(result, m.status) ? m.status : "none"]++;
    }
    return result;
  }
  let historyAt = 0,
    historyBook = "";
  function record() {
    if (
      window.__learningBootReady !== true ||
      !window.LearningData.canSave(currentTextbook) ||
      !window.VocabMaster.canCapture(currentTextbook, vocabList)
    )
      return;
    historyAt = Date.now();
    historyBook = currentTextbook;
    const date = window.StudyTimeModel.dateKey(Date.now()),
      history = read("meaning_history", currentTextbook) || {};
    const next = counts(vocabList);
    if (
      history[date] &&
      ["ok", "so", "bad", "none"].every((k) => history[date][k] === next[k])
    )
      return;
    history[date] = { ...next, at: Date.now() };
    const dates = Object.keys(history).sort();
    while (dates.length > 366) delete history[dates.shift()];
    localStorage.setItem(
      key("meaning_history", currentTextbook),
      JSON.stringify(history),
    );
  }
  let historyTimer;
  function later() {
    clearTimeout(historyTimer);
    const account = uid(),
      book = currentTextbook;
    historyTimer = setTimeout(
      () => {
        if (uid() === account && book === currentTextbook) record();
      },
      historyBook === book
        ? Math.max(500, 30000 - (Date.now() - historyAt))
        : 500,
    );
  }
  const saveProgress = window.saveVocabProgressLocally;
  window.saveVocabProgressLocally = function () {
    const result = saveProgress.apply(this, arguments);
    later();
    return result;
  };
  function drawMeaningHistory(host, legend) {
    record();
    const history = read("meaning_history", currentTextbook) || {},
      dates = Object.keys(history).sort().slice(-30),
      colors = {
        ok: "#6ed5b0",
        so: "#dec384",
        bad: "#db99a6",
        none: "#a5b4ca",
      };
    const ns = "http://www.w3.org/2000/svg",
      svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 340 200");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "意味ごとの理解度の推移");
    const max = Math.max(
      1,
      ...dates.flatMap((date) =>
        ["ok", "so", "bad", "none"].map((k) => Number(history[date][k]) || 0),
      ),
    );
    function node(tag, attrs, text) {
      const el = document.createElementNS(ns, tag);
      Object.entries(attrs).forEach(([key, value]) =>
        el.setAttribute(key, String(value)),
      );
      if (text !== undefined) el.textContent = text;
      svg.append(el);
      return el;
    }
    for (let i = 0; i < 3; i++) {
      const y = 164 - i * 72;
      node("line", {
        x1: 36,
        x2: 322,
        y1: y,
        y2: y,
        stroke: "currentColor",
        "stroke-opacity": 0.1,
      });
      node(
        "text",
        {
          x: 30,
          y: y + 4,
          "text-anchor": "end",
          fill: "currentColor",
          "font-size": 10,
          opacity: 0.65,
        },
        Math.round((max * i) / 2),
      );
    }
    for (const [k, label] of [
      ["ok", "○"],
      ["so", "△"],
      ["bad", "×"],
      ["none", "未履修"],
    ]) {
      const points = dates.map((date, i) => [
        dates.length === 1 ? 179 : 36 + (i * 286) / (dates.length - 1),
        164 - ((Number(history[date][k]) || 0) / max) * 144,
      ]);
      if (points.length) {
        const path = points
          .map(([x, y], i) => (i ? "L" : "M") + x + "," + y)
          .join(" ");
        if (points.length > 1)
          node("path", {
            d: path + " L322,164 L36,164 Z",
            fill: colors[k],
            "fill-opacity": 0.045,
          });
        node("path", {
          d: path,
          fill: "none",
          stroke: colors[k],
          "stroke-width": 1.7,
          "stroke-linejoin": "round",
        });
        for (const [x, y] of points)
          node("circle", { cx: x, cy: y, r: 2.2, fill: colors[k] });
      }
      const span = document.createElement("span");
      span.style.color = colors[k];
      span.textContent = label + " " + (history[dates.at(-1)]?.[k] || 0);
      legend.append(span);
    }
    for (const [i, anchor] of dates.length === 1
      ? [[0, "middle"]]
      : [
          [0, "start"],
          [dates.length - 1, "end"],
        ])
      if (dates[i] && (dates.length > 1 || i === 0))
        node(
          "text",
          {
            x: anchor === "middle" ? 179 : anchor === "end" ? 322 : 36,
            y: 190,
            "text-anchor": anchor,
            fill: "currentColor",
            "font-size": 11,
            opacity: 0.7,
          },
          dates[i].slice(5),
        );
    host.append(svg);
  }
  const showStats = window.showVocabStatsPopup;
  window.showVocabStatsPopup = function () {
    showStats.apply(this, arguments);
    const overlay = document.getElementById("vocabStatsOverlay"),
      box = overlay?.firstElementChild;
    if (!box) return;
    box.classList.add("vocab-statistics-card");
    const header = box.firstElementChild,
      pie = document.createElement("div");
    pie.dataset.vocabChart = "current";
    while (header.nextSibling) pie.append(header.nextSibling);
    const history = document.createElement("div");
    history.dataset.vocabChart = "history";
    history.hidden = true;
    history.innerHTML =
      '<div class="meaning-chart"></div><div class="meaning-chart-legend"></div><p class="library-editor-hint">直近30記録日の意味の数。記録開始日から表示します。</p>';
    const nav = document.createElement("div");
    nav.className = "statistics-switch";
    nav.setAttribute("aria-label", "理解度グラフの表示");
    for (const [mode, label] of [
      ["current", "現在の理解度"],
      ["history", "推移"],
    ]) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.dataset.chartMode = mode;
      b.setAttribute("aria-pressed", String(mode === "current"));
      b.onclick = () => {
        pie.hidden = mode !== "current";
        history.hidden = mode !== "history";
        nav
          .querySelectorAll("button")
          .forEach((button) =>
            button.setAttribute("aria-pressed", String(button === b)),
          );
        if (mode === "history" && !history.querySelector("svg"))
          drawMeaningHistory(
            history.querySelector(".meaning-chart"),
            history.querySelector(".meaning-chart-legend"),
          );
      };
      nav.append(b);
    }
    box.append(nav, pie, history);
  };
  window.openMeaningHistory = function () {
    window.showVocabStatsPopup();
    document.querySelector("[data-chart-mode=history]")?.click();
  };
  const renderList = window.renderVocabList;
  window.renderVocabList = function () {
    const result = renderList.apply(this, arguments);
    later();
    return result;
  };
  function mergeHistory(local, saved) {
    const merged = { ...saved };
    for (const [date, item] of Object.entries(local || {}))
      if (!merged[date] || Number(item.at) >= Number(merged[date].at))
        merged[date] = item;
    const dates = Object.keys(merged).sort();
    while (dates.length > 366) delete merged[dates.shift()];
    return merged;
  }
  // A save from an older tab must not move a device's current deck position back.
  window.LearningSessionsStorage = {
    restore(k, raw) {
      if (/^core_v4_(?:flash_queue|flash_cursor|group_synced)_/.test(k))
        return true;
      if (!k.startsWith("core_v4_meaning_history_")) return false;
      try {
        const local = JSON.parse(localStorage.getItem(k) || "{}"),
          saved = JSON.parse(raw || "{}");
        localStorage.setItem(k, JSON.stringify(mergeHistory(local, saved)));
      } catch {
        if (localStorage.getItem(k) === null) localStorage.setItem(k, raw);
      }
      return true;
    },
  };
  // Reservoir sampling keeps only ten references even for a very large book.
  function sample(source, limit = 10, random = Math.random) {
    const result = [];
    let seen = 0;
    for (const word of source) {
      if (!word.word || !(word.meanings?.[0]?.text || word.meaning)) continue;
      seen++;
      if (result.length < limit) result.push(word);
      else {
        const at = Math.floor(random() * seen);
        if (at < limit) result[at] = word;
      }
    }
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  window.LearningSessionsModel = { counts, mergeHistory, sample };

  // Separate warm-up UI: no fake loading state and no extra cloud book scans.
  let welcomeOwner = "",
    welcomePending = false,
    welcomeModal = null,
    welcomeRetries = 0,
    welcomeEligible = "";
  async function welcome(force = false) {
    if (!force && welcomeEligible !== uid()) return;
    if (
      welcomePending ||
      welcomeOwner === uid() ||
      uid() === "GUEST-000" ||
      window.__learningBootReady !== true ||
      document.hidden
    )
      return;
    if (
      document.querySelector("dialog[open],#wordDuelScreen") ||
      window.__pgLoad?.overlay?.isConnected
    ) {
      if (welcomeRetries++ < 30) setTimeout(() => welcome(force), 1000);
      return;
    }
    const account = uid(),
      book = window.UserProfile.read().loadingQuiz?.bookId || currentTextbook;
    let source =
      book === currentTextbook
        ? vocabList
        : textbooksCacheMap[book] || window.__manualVocabDrafts?.[book]?.master;
    if (!source && book !== currentTextbook) {
      try {
        source = JSON.parse(
          localStorage.getItem("core_v4_cache_" + book) || "null",
        );
      } catch {}
    }
    if (!source?.length) return;
    const sampled = sample(window.filterLoadingQuizWords(source, book));
    if (!sampled.length) return;
    window.StartupMonitor?.event('warmup:start');
    const queue = window.migrateVocabData(structuredClone(sampled));
    welcomeOwner = account;
    welcomePending = true;
    let index = 0,
      revealed = false;
    const d = window.openLibraryDialog(
      "まずは" + queue.length + "単語",
      '<p class="warmup-count"></p><div class="warmup-directions"><span>× 覚えていない</span><span>△ 上へスワイプ</span><span>○ 覚えた</span></div><div class="warmup-stage"><button type="button" class="warmup-card flashcard-wrapper-3d" aria-label="答えを表示"></button></div><div class="warmup-ratings"><button type="button" data-warmup="bad">×</button><button type="button" data-warmup="so">△</button><button type="button" data-warmup="ok">○</button></div><p data-warmup-status role="status"></p><button type="button" data-library-close>あとで</button>',
    );
    d.classList.add("flash-warmup-dialog", "flashcard-session-screen");
    // Mount the normal flashcard chrome rather than maintaining a second layout.
    // Strip IDs and inline actions so a warm-up cannot control the hidden session.
    const layout = document
      .getElementById("flashcard-play-screen")
      .cloneNode(true);
    const roles = new Map();
    for (const node of [layout, ...layout.querySelectorAll("*")]) {
      if (node.id) {
        roles.set(node.id, node);
        node.removeAttribute("id");
      }
      for (const attr of [...node.attributes])
        if (attr.name.startsWith("on")) node.removeAttribute(attr.name);
    }
    layout.style.display = "flex";
    roles.get("flashcardNotePreview")?.remove();
    const stage = roles.get("flashcardDeckStage"),
      warmCard = d.querySelector(".warmup-card"),
      ratingControls = d.querySelector(".warmup-ratings"),
      statusMessage = d.querySelector("[data-warmup-status]");
    stage.classList.add("warmup-stage");
    stage.replaceChildren(warmCard);
    roles.get("flashcardRemainingBadge").classList.add("warmup-count");
    roles.get("flashcardPartOfSpeech").hidden = true;
    const close = layout.querySelector(".game-finish-inline-btn");
    close.textContent = "あとで";
    close.dataset.libraryClose = "";
    close.onclick = () => window.closeLibraryDialog();
    d.querySelector("[data-library-close]").remove();
    d.querySelector(".warmup-count").remove();
    d.querySelector(".warmup-directions").remove();
    d.querySelector(".warmup-stage").remove();
    d.append(layout, ratingControls, statusMessage);
    const previous = roles.get("flashcardPreviousButton"),
      progress = roles.get("flashcardProgressText"),
      history = roles.get("fcHistoryContainer"),
      info = roles.get("flashcardInfoButton");
    const answers = [];
    let starting = false,
      startTimer;
    function startApp() {
      if (starting || index !== queue.length || uid() !== account) return;
      starting = true;
      card.disabled = true;
      close.disabled = true;
      previous.disabled = true;
      document.body.classList.remove("flash-warmup-open");
      d.classList.add("warmup-start-exiting");
      const finish = () => {
        if (welcomeModal === d) window.closeLibraryDialog();
      };
      startTimer = setTimeout(
        finish,
        matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1100,
      );
    }

    info.onclick = () => {
      const word = queue[index];
      if (!word) return;
      const details = document.createElement("dialog");
      details.className = "menu-dialog warmup-word-details";
      const title = document.createElement("h2"),
        body = document.createElement("p"),
        back = document.createElement("button");
      title.textContent = word.word;
      body.textContent =
        word.subInfo || word.sub_info || word.note || "補足情報はありません。";
      back.type = "button";
      back.textContent = "閉じる";
      back.onclick = () => details.close();
      details.append(title, body, back);
      document.body.append(details);
      details.addEventListener("close", () => details.remove(), { once: true });
      details.showModal();
    };
    previous.onclick = () => {
      const last = answers.pop();
      if (!last || uid() !== account) return;
      index--;
      card.disabled = false;
      ratings.hidden = false;
      close.textContent = "あとで";
      draw();
    };
    window.initLucide?.();
    document.body.classList.add("flash-warmup-open");
    welcomeModal = d;
    window.StartupMonitor?.event('warmup:shown');
    d.addEventListener(
      "close",
      () => {
        clearTimeout(startTimer);
        document.body.classList.remove("flash-warmup-open");
        window.StartupMonitor?.event('warmup:closed');
        welcomePending = false;
        welcomeModal = null;
        if (index > 0) window.saveAfterStudy?.("warmup-end");
      },
      { once: true },
    );
    d.addEventListener(
      "close",
      () => window.WordDuelProgress.flush(account).catch(() => {}),
      { once: true },
    );
    d.querySelector(".library-editor-eyebrow").textContent = "学習をはじめよう";
    const card = d.querySelector(".warmup-card"),
      ratings = d.querySelector(".warmup-ratings");
    function draw() {
      if (uid() !== account) {
        d.close();
        return;
      }
      revealed = false;
      layout.querySelector(".flashcard-note-preview")?.remove();
      previous.disabled = answers.length === 0;
      info.disabled = index === queue.length;
      const learned = answers.filter((answer) => answer.result === "ok").length;
      progress.textContent =
        "表示中の覚えた単語: " +
        Math.round((learned / queue.length) * 100) +
        "%";
      if (index === queue.length) {
        d.querySelector(".warmup-count").textContent = "準備完了！";
        card.replaceChildren();
        card.classList.remove("flipped");
        d.classList.add("warmup-start-ready");
        d.querySelectorAll(
          "#flashcardGhost,.flashcard-post-ripple,.fc-vanish-burst",
        ).forEach((effect) => effect.remove());
        stage.parentElement.classList.add("warmup-start-stage");
        card.classList.add("warmup-start-card");
        const label = document.createElement("span");
        label.className = "warmup-start-label";
        label.textContent = "START";
        card.append(label);
        card.setAttribute("aria-label", "START");
        card.disabled = false;
        ratings.hidden = true;
        close.hidden = true;
        previous.hidden = true;
        info.hidden = true;
        roles.get("flashcardPartOfSpeech").hidden = true;
        history.parentElement.hidden = true;
        card.style.width = card.style.height = "240px";
        return;
      }
      revealed = false;
      card.replaceChildren();
      card.classList.remove("flipped");
      const w = queue[index],
        meaning = w.meanings?.[0];
      const saved = window.LearningData.read(book)[String(w.num)],
        sourceWord = {
          ...w,
          meanings: w.meanings.map((m) => ({
            ...m,
            ...saved?.meanings?.[String(m.id)],
          })),
        };
      const note = String(saved?.note || w.note || "");
      if (note.trim())
        stage.parentElement.before(window.createFlashcardNotePreview(note));
      window.fillFlashcardFaces(
        card,
        w.word,
        meaning?.text || w.meaning,
        w.num,
        window.getFlashcardStyleByHistory?.({
          num: w.num,
          en: w.word,
          meaningId: meaning?.id,
          meaningIndex: 0,
          sourceWord,
        }) || "",
      );
      window.sizeFlashcardFaces(
        card,
        stage,
        roles.get("flashcardPartOfSpeech"),
      );
      const part = window.getFlashcardPartOfSpeech?.(w, meaning),
        pos = roles.get("flashcardPartOfSpeech");
      pos.hidden = !part;
      pos.textContent = part?.short || "";
      history.replaceChildren();
      const recent = [...(sourceWord.meanings[0]?.history || [])].slice(-5);
      while (recent.length < 5) recent.unshift("none");
      recent.forEach((status) => {
        const bubble = document.createElement("div");
        bubble.className =
          "fc-history-bubble" + (status !== "none" ? " " + status : "");
        history.append(bubble);
      });
      card.setAttribute("aria-label", "答えを表示");
      ratings.querySelectorAll("button").forEach((b) => (b.disabled = true));
      d.querySelector(".warmup-count").textContent =
        index + 1 + " / " + queue.length;
    }
    card.onclick = () => {
      if (index === queue.length) {
        startApp();
        return;
      }
      if (index > queue.length) return;
      window.StartupMonitor?.activity("warmup-flip");
      revealed = !revealed;
      card.classList.toggle("flipped", revealed);
      window.AppSounds?.play("back");
      ratings
        .querySelectorAll("button")
        .forEach((b) => (b.disabled = !revealed));
    };
    let pointer = null,
      dragged = false;
    card.addEventListener("pointerdown", (e) => {
      if (index >= queue.length) return;
      if (!e.isPrimary) return;
      card.setPointerCapture(e.pointerId);
      pointer = { x: e.clientX, y: e.clientY };
      dragged = false;
    });
    card.addEventListener("pointermove", (e) => {
      if (!pointer) return;
      card.classList.add("is-dragging");
      card.style.transform =
        "translate(" +
        (e.clientX - pointer.x) +
        "px," +
        (e.clientY - pointer.y) +
        "px) rotate(" +
        (e.clientX - pointer.x) * 0.06 +
        "deg)";
    });
    card.addEventListener("pointerup", (e) => {
      card.classList.remove("is-dragging");
      card.style.removeProperty("transform");
      if (!pointer) return;
      const dx = e.clientX - pointer.x,
        dy = e.clientY - pointer.y;
      pointer = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 65) return;
      dragged = true;
      const status =
        Math.abs(dy) > Math.abs(dx) && dy < 0
          ? "so"
          : Math.abs(dx) > Math.abs(dy)
            ? dx > 0
              ? "ok"
              : "bad"
            : null;
      if (status) {
        window.animateFlashcardSwipe?.(
          card,
          status === "ok" ? "right" : status === "bad" ? "left" : "up",
          dx,
          dy,
          false,
        );
        revealed = true;
        ratings.querySelectorAll("button").forEach((b) => (b.disabled = false));
        window.AppSounds?.play(
          status === "ok"
            ? "swipe-right"
            : status === "bad"
              ? "swipe-left"
              : "navigate",
        );
      }
      if (status) ratings.querySelector("[data-warmup=" + status + "]").click();
    });
    card.addEventListener("pointercancel", () => {
      pointer = null;
      card.classList.remove("is-dragging");
      card.style.removeProperty("transform");
    });
    const flip = card.onclick;
    card.onclick = (e) => {
      if (dragged) {
        dragged = false;
        return;
      }
      flip(e);
    };
    ratings.querySelectorAll("button").forEach(
      (b) =>
        (b.onclick = () => {
          if (!revealed || uid() !== account || index >= queue.length) return;
          const w = queue[index],
            meaning = w.meanings?.[0];
          if (!meaning) {
            index++;
            draw();
            return;
          }
          try {
            window.WordDuelProgress.apply(
              book,
              {
                num: String(w.num),
                mid: String(meaning.id),
                sig: window.buildWordSignature(w),
                count: w.meanings.length,
              },
              b.dataset.warmup,
              account,
            );
            window.StudyPoints?.reward("card", book, w.num, account, {
              word: w.word,
              bookName: (textbooksPool.find((b) => b.id === book) || {}).name,
            });
            answers.push({ result: b.dataset.warmup });
            // The same journal as battle answers preserves ratings before any cloud write.

            if (book === currentTextbook) later();
            index++;
            if (index === queue.length)
              window.WordDuelProgress.flush(account).catch(() => {});
            else if (index % 5 === 0) window.WordDuelProgress.schedule(account);
            draw();
          } catch (e) {
            d.querySelector("[data-warmup-status]").textContent = e.message;
          }
        }),
    );
    draw();
  }
  function startLoginWarmup() {
    welcomeEligible = uid();
    welcomeRetries = 0;
    setTimeout(welcome, 1200);
  }
  window.onAppLoaded(startLoginWarmup);
  window.addEventListener("learning-data-ready", () =>
    setTimeout(welcome, 1200),
  );
  window.onBeforeAppLoad(() => {
    if (welcomeModal) window.closeLibraryDialog();
    welcomeOwner = "";
    welcomeEligible = "";
  });
  window.onTabChange(() => {
    setTimeout(welcome, 400);
  });
  window.LoginWarmup = { open: () => welcome(true) };
})();
