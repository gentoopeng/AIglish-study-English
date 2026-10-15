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
  window.openMeaningHistory = function () {
    record();
    const history = read("meaning_history", currentTextbook) || {},
      dates = Object.keys(history).sort().slice(-30),
      d = window.openLibraryDialog(
        "理解度の推移",
        '<p class="library-editor-hint">直近30記録日の意味の数です。記録開始前のデータは含みません。</p><div class="meaning-chart"></div><div class="meaning-chart-legend"></div><button type="button" data-library-close>閉じる</button>',
      ),
      host = d.querySelector(".meaning-chart"),
      colors = {
        ok: "#34d399",
        so: "#fbbf24",
        bad: "#fb7185",
        none: "#94a3b8",
      };
    const max = Math.max(
      1,
      ...dates.map((date) =>
        ["ok", "so", "bad", "none"].reduce((n, k) => n + history[date][k], 0),
      ),
    );
    const chart = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    chart.setAttribute("viewBox", "0 0 340 200");
    chart.setAttribute("role", "img");
    chart.setAttribute("aria-label", "意味ごとの理解度の推移");
    const width = 300 / Math.max(1, dates.length);
    dates.forEach((date, i) => {
      let y = 170;
      for (const k of ["ok", "so", "bad", "none"]) {
        const height = (history[date][k] / max) * 145;
        const rect = document.createElementNS(chart.namespaceURI, "rect");
        rect.setAttribute("x", String(30 + i * width));
        rect.setAttribute("y", String(y - height));
        rect.setAttribute("width", String(Math.max(1, width - 2)));
        rect.setAttribute("height", String(height));
        rect.setAttribute("fill", colors[k]);
        const title = document.createElementNS(chart.namespaceURI, "title");
        title.textContent = date + " " + k + " " + history[date][k];
        rect.append(title);
        chart.append(rect);
        y -= height;
      }
      if (i === 0 || i === dates.length - 1) {
        const text = document.createElementNS(chart.namespaceURI, "text");
        text.setAttribute(
          "x",
          String(i === dates.length - 1 && i > 0 ? 330 : 30),
        );
        text.setAttribute(
          "text-anchor",
          i === dates.length - 1 && i > 0 ? "end" : "start",
        );
        text.setAttribute("y", "193");
        text.setAttribute("fill", "currentColor");
        text.setAttribute("font-size", "11");
        text.textContent = date.slice(5);
        chart.append(text);
      }
    });
    host.append(chart);
    for (const [k, label] of [
      ["ok", "○"],
      ["so", "△"],
      ["bad", "×"],
      ["none", "未履修"],
    ]) {
      const span = document.createElement("span");
      span.style.color = colors[k];
      span.textContent = label + " " + (history[dates.at(-1)]?.[k] || 0);
      d.querySelector(".meaning-chart-legend").append(span);
    }
  };
  const renderList = window.renderVocabList;
  window.renderVocabList = function () {
    const result = renderList.apply(this, arguments),
      host = document.querySelector("#vocabListContainer");
    if (host && !document.querySelector("[data-meaning-history]")) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "meaning-history-button";
      b.dataset.meaningHistory = "";
      b.textContent = "理解度の推移";
      b.onclick = window.openMeaningHistory;
      host.before(b);
    }
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
    const queue = window.migrateVocabData(structuredClone(sampled));
    welcomeOwner = account;
    welcomePending = true;
    let index = 0,
      revealed = false;
    const d = window.openLibraryDialog(
      "まずは" + queue.length + "単語",
      '<p class="warmup-count"></p><button type="button" class="warmup-card" aria-label="答えを表示"></button><div class="warmup-ratings"><button type="button" data-warmup="bad">×</button><button type="button" data-warmup="so">△</button><button type="button" data-warmup="ok">○</button></div><p data-warmup-status role="status"></p><button type="button" data-library-close>あとで</button>',
    );
    welcomeModal = d;
    d.addEventListener(
      "close",
      () => {
        welcomePending = false;
        welcomeModal = null;
        if (index > 0) window.queueBackgroundSave?.();
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
      if (index === queue.length) {
        d.querySelector(".warmup-count").textContent = "準備完了！";
        card.textContent = queue.length + "単語、おつかれさま";
        card.disabled = true;
        ratings.hidden = true;
        d.querySelector("[data-library-close]").textContent = "学習をはじめる";
        return;
      }
      revealed = false;
      card.textContent = queue[index].word;
      card.setAttribute("aria-label", "答えを表示");
      ratings.querySelectorAll("button").forEach((b) => (b.disabled = true));
      d.querySelector(".warmup-count").textContent =
        index + 1 + " / " + queue.length;
    }
    card.onclick = () => {
      if (index >= queue.length) return;
      revealed = !revealed;
      card.textContent = revealed
        ? queue[index].meanings?.[0]?.text || queue[index].meaning
        : queue[index].word;
      ratings
        .querySelectorAll("button")
        .forEach((b) => (b.disabled = !revealed));
    };
    let pointer = null,
      dragged = false;
    card.addEventListener("pointerdown", (e) => {
      pointer = { x: e.clientX, y: e.clientY };
      dragged = false;
    });
    card.addEventListener("pointerup", (e) => {
      if (!pointer || !revealed) return;
      const dx = e.clientX - pointer.x,
        dy = e.clientY - pointer.y;
      pointer = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 50) return;
      dragged = true;
      const status =
        Math.abs(dy) > Math.abs(dx) && dy < 0
          ? "so"
          : Math.abs(dx) > Math.abs(dy)
            ? dx > 0
              ? "ok"
              : "bad"
            : null;
      if (status) ratings.querySelector("[data-warmup=" + status + "]").click();
    });
    card.addEventListener("pointercancel", () => {
      pointer = null;
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
          if (!revealed || uid() !== account) return;
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
            // The same journal as battle answers preserves ratings before any cloud write.

            if (book === currentTextbook) later();
            index++;
            if (index % 5 === 0 || index === queue.length)
              window.WordDuelProgress.flush(account).catch(() => {});
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
