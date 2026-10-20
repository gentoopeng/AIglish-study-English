// Listen only to the current room. No global room scans or matchmaking polling.
(function () {
  "use strict";
  const m = window.WordDuelModel,
    uid = () => myId || "GUEST-000";
  let dialog = null,
    session = null,
    unsubscribe = null,
    timer = null,
    waitingTimer = null,
    sending = null,
    revision = 0,
    published = -1,
    finishing = false,
    opener = null,
    inertElements = [],
    answerTimer = null;
  const portraits = new Map();
  function ms(value) {
    return value?.toMillis
      ? value.toMillis()
      : typeof value === "number"
        ? value
        : 0;
  }
  function ref(code) {
    return window.fbDoc(window.db, "wordDuelRooms", code);
  }
  function connected() {
    if (uid() === "GUEST-000")
      throw Error(
        "対戦はログインしたアカウントで参加できます。一人プレイはゲストでも使えます。",
      );
    if (!window.db || !window.fbRunTransaction || !window.fbOnSnapshot)
      throw Error("対戦にはクラウドへの接続が必要です。");
    if (window.FirestoreReadGuard?.paused?.())
      throw Error(
        "クラウドの利用上限に達しています。今は一人プレイを利用してください。",
      );
  }
  function status(text) {
    const node = dialog?.querySelector(".duel-status");
    if (node) node.textContent = text;
  }
  function stop() {
    unsubscribe?.();
    unsubscribe = null;
    clearInterval(timer);
    clearTimeout(waitingTimer);
    clearTimeout(answerTimer);
    answerTimer = null;
    timer = null;
    waitingTimer = null;
  }
  function cleanup() {
    stop();
    session = null;
    dialog = null;
    finishing = false;
  }
  function closeScreen() {
    if (!dialog) return;
    // Back button / Escape bypass finish(); close the diagnostic once for an unfinished battle.
    if (session?.diagnosticOpen && !session.finished)
      window.StartupMonitor?.event?.("duel:closed");
    if (session && !session.solo && !session.finished) {
      const old = session;
      old.answers = old.answers.slice();
      publish(old, true, true)
        .then(() => old.start && settle(old.code))
        .catch(() => {});
    }
    if (session) {
      window.WordDuelProgress.flush(session.id).catch(() => {});
      window.saveAfterStudy?.("battle-end");
    }
    const el = dialog;
    cleanup();
    el.remove();
    document.body.classList.remove("duel-screen-open");
    inertElements.forEach(([node, value]) => {
      if (node.isConnected) node.inert = value;
    });
    inertElements = [];
    if (opener?.isConnected) opener.focus();
    opener = null;
  }
  function view(title, html) {
    const el = document.createElement("section");
    el.className = "word-duel-screen";
    el.id = "wordDuelScreen";
    el.setAttribute("aria-labelledby", "duelScreenTitle");
    el.tabIndex = -1;
    el.innerHTML =
      '<header class="duel-screen-header"><button type="button" aria-label="戻る" data-duel-back>‹</button><div><h2 id="duelScreenTitle"></h2></div><span class="duel-screen-badge">60秒</span></header><div class="duel-content">' +
      html +
      '<p class="duel-status" role="status"></p></div>';
    el.querySelector("h2").textContent = title;
    opener = document.activeElement;
    inertElements = Array.from(document.body.children)
      .filter((node) => !["SCRIPT", "LINK", "STYLE"].includes(node.tagName))
      .map((node) => [node, node.inert]);
    inertElements.forEach(([node]) => (node.inert = true));
    document.body.append(el);
    document.body.classList.add("duel-screen-open");
    dialog = el;
    el.querySelector("[data-duel-back]").onclick = closeScreen;
    el.querySelectorAll("[data-library-close]").forEach(
      (button) => (button.onclick = closeScreen),
    );
    el.focus();
    return el;
  }
  async function words(seed) {
    return window.BattleLobby.words(dialog, seed);
  }
  function liveScores(target) {
    const players = target.solo
      ? { [target.id]: { answers: target.answers } }
      : {
          ...target.room.players,
          [target.id]: {
            ...target.room.players[target.id],
            answers: target.answers,
          },
        };
    return m.roomScores(
      { ...target, players },
      false,
      Math.max(0, Date.now() - target.start),
    );
  }
  function points(target, answers) {
    return m.finalScore(
      target.pool,
      target.seed,
      answers,
      target.duration,
      target.missPenalty,
      target.rules || m.defaultRules,
      Math.max(0, Math.min(target.duration, Date.now() - target.start)),
    );
  }
  function player() {
    return {
      name: String(myName || uid()).slice(0, 40),
      frame: window.IconFrames?.equipped() || "",
      answers: [],
      done: false,
      abandoned: false,
    };
  }
  function portrait(host, value, name, frame) {
    if (!host) return;
    host.replaceChildren(
      window.RankingVisuals.avatar(value, name, JSON.stringify({ frame })),
    );
  }
  async function opponentPortrait(target, id, person) {
    const host = dialog?.querySelector(
      '[data-player-id="' + CSS.escape(id) + '"] .duel-player-avatar',
    );
    portrait(host, "", person.name, person.frame);
    const cached = portraits.get(id),
      known = window.People?.preview?.(id);
    let photo =
      cached && Date.now() - cached.at < 300000 ? cached.avatar : known?.avatar;
    if (photo === undefined && window.db && window.fbGetDoc) {
      try {
        const snap = await window.fbGetDoc(
          window.fbDoc(window.db, "users", id),
        );
        photo = snap.exists() ? snap.data().avatar : "";
        if (typeof photo !== "string" || photo.length > 100000) photo = "";
        portraits.delete(id);
        portraits.set(id, { at: Date.now(), avatar: photo });
        if (portraits.size > 4) portraits.delete(portraits.keys().next().value);
      } catch {
        photo = "";
      }
    }
    if (
      session === target &&
      dialog?.querySelector(
        '[data-player-id="' + CSS.escape(id) + '"] .duel-player-avatar',
      ) === host
    )
      portrait(host, photo || "", person.name, person.frame);
  }
  function locked(fn) {
    return async (event) => {
      const button = event.currentTarget,
        screen = dialog;
      if (screen.dataset.busy) return;
      screen.dataset.busy = "true";
      button.disabled = true;
      status("準備しています…");
      try {
        await fn();
      } catch (error) {
        if (dialog === screen)
          status(error.message || "接続を確認して再試行してください。");
      } finally {
        delete screen.dataset.busy;
        if (button.isConnected) button.disabled = false;
      }
    };
  }
  function patch(tx, reference, fields) {
    tx.set(reference, fields, { mergeFields: Object.keys(fields) });
  }
  function setup() {
    return window.BattleLobby.read(dialog);
  }
  window.openWordDuel = function (
    groupId,
    intent = typeof groupId === "string" ? "create" : "menu",
  ) {
    if (dialog) return;
    const goBack = () => {
      closeScreen();
      window.openWordDuel(groupId);
    };
    if (intent === "menu") {
      view("カジュアル", window.BattleLobby.entryHtml());
      dialog.classList.add("battle-entry-screen");
      dialog.querySelector(".duel-screen-badge").hidden = true;
      dialog.querySelectorAll("[data-battle-route]").forEach(
        (button) =>
          (button.onclick = () => {
            const next = button.dataset.battleRoute;
            closeScreen();
            window.openWordDuel(groupId, next);
          }),
      );
      return;
    }
    if (intent === "join") {
      view("部屋に入る", window.BattleLobby.joinHtml());
      dialog.classList.add("battle-entry-screen");
      dialog.querySelector(".duel-screen-badge").hidden = true;
      dialog.querySelector("[data-duel-back]").onclick = goBack;
      const input = dialog.querySelector(".duel-join input");
      input.oninput = () =>
        (input.value = input.value.replace(/[^0-9]/g, "").slice(0, 4));
      wireJoin();
      return;
    }
    view("カジュアル", window.BattleLobby.html());
    window.BattleLobby.init(dialog);
    dialog.querySelector("[data-duel-back]").onclick = goBack;
    dialog.querySelector("[data-duel-solo]").hidden = intent !== "solo";
    dialog.querySelector("[data-duel-create]").hidden = intent === "solo";
    dialog.querySelector(".duel-content > .duel-status")?.remove();
    if (typeof groupId === "string") {
      dialog.querySelector("#duelScreenTitle").textContent =
        "グループでカジュアル";

      dialog.querySelector("[data-duel-solo]").hidden = true;
      const groupButton = dialog.querySelector("[data-duel-create]");
      groupButton.textContent = "グループで開始・参加";
      groupButton.onclick = locked(async () => {
        connected();
        const account = uid(),
          screen = dialog,
          settings = setup(),
          seed = crypto.getRandomValues(new Uint32Array(1))[0],
          { book, books, pool } = await words(seed);
        if (dialog !== screen || uid() !== account) return;
        if (new TextEncoder().encode(JSON.stringify(pool)).length > 320000)
          throw Error("出題データが大きすぎます。別の単語帳を選んでください。");
        const code = await window.fbRunTransaction(window.db, async (tx) => {
          const groupRef = window.fbDoc(window.db, "studyGroups", groupId),
            gs = await tx.get(groupRef);
          if (
            !gs.exists() ||
            !gs.data().members?.[account] ||
            uid() !== account
          )
            throw Error("グループの参加状態を確認してください。");
          const existing = gs.data().activeRoom;
          if (existing && /^\d{4}$/.test(existing.code)) {
            const snapshot = await tx.get(ref(existing.code)),
              room = snapshot.exists() ? snapshot.data() : null;
            if (
              room &&
              m.validRoom(room) &&
              room.groupId === groupId &&
              room.status === "waiting" &&
              Date.now() - ms(room.createdAt) < 120000 &&
              Object.keys(room.players).length < room.capacity
            ) {
              if (!room.players[account]) {
                const players = { ...room.players, [account]: player() };
                patch(tx, ref(existing.code), {
                  players,
                  ...(Object.keys(players).length === room.capacity
                    ? {
                        status: "playing",
                        startsAt: window.fbServerTimestamp(),
                      }
                    : {}),
                });
              }
              return existing.code;
            }
          }
          const next = String(
              1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000),
            ),
            roomRef = ref(next),
            collision = await tx.get(roomRef);
          if (collision.exists()) throw Error("もう一度参加してください。");
          const room = {
            version: 9,
            ...settings,
            book,
            books,
            groupId,
            host: account,
            status: "waiting",
            pool,
            seed,
            players: { [account]: player() },
          };
          if (!m.validRoom(room)) throw Error("出題データを確認してください。");
          tx.set(roomRef, { ...room, createdAt: window.fbServerTimestamp() });
          patch(tx, groupRef, { activeRoom: { code: next, at: Date.now() } });
          return next;
        });
        if (dialog !== screen || uid() !== account) {
          await publish({ id: account, code, answers: [] }, true, true);
          return;
        }
        session = { id: account, code, answers: [], finished: false, groupId };
        wait(code);
      });
    }
    dialog.querySelector("[data-duel-solo]").onclick = locked(async () => {
      const settings = setup(),
        seed = crypto.getRandomValues(new Uint32Array(1))[0],
        account = uid(),
        screen = dialog,
        { book, books, pool } = await words(seed);
      if (dialog !== screen || uid() !== account) return;
      session = {
        ...settings,
        solo: true,
        id: account,
        book,
        books,
        pool,
        seed,
        start: Date.now(),
        answers: [],
        finished: false,
      };
      play();
    });
    if (typeof groupId !== "string")
      dialog.querySelector("[data-duel-create]").onclick = locked(async () => {
        connected();
        const settings = setup(),
          seed = crypto.getRandomValues(new Uint32Array(1))[0],
          account = uid(),
          screen = dialog,
          { book, books, pool } = await words(seed);
        if (new TextEncoder().encode(JSON.stringify(pool)).length > 320000)
          throw Error("出題データが大きすぎます。別の単語帳を選んでください。");
        if (dialog !== screen || uid() !== account) return;
        let code;
        const room = {
          version: 9,
          ...settings,
          book,
          books,
          host: account,
          status: "waiting",
          pool,
          seed,
          players: { [account]: player() },
        };
        if (!m.validRoom(room))
          throw Error(
            "単語の出題データを確認できません。別の単語帳を選んでください。",
          );
        for (let attempt = 0; attempt < 5; attempt++) {
          code = String(
            1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000),
          );
          const made = await window.fbRunTransaction(window.db, async (tx) => {
            const roomRef = ref(code),
              snap = await tx.get(roomRef);
            if (snap.exists()) return false;
            tx.set(roomRef, { ...room, createdAt: window.fbServerTimestamp() });
            return true;
          });
          if (made) break;
          code = null;
        }
        if (!code)
          throw Error("部屋番号を作れませんでした。再試行してください。");
        if (dialog !== screen || uid() !== account) {
          await publish({ id: account, code, answers: [] }, true, true);
          return;
        }
        session = { id: account, code, answers: [], finished: false };
        wait(code);
      });
  };
  function wireJoin() {
    dialog.querySelector("[data-duel-join]").onclick = locked(async () => {
      connected();
      const code = dialog.querySelector(".duel-join input").value.trim(),
        account = uid(),
        screen = dialog;
      if (!/^\d{4}$/.test(code))
        throw Error("4桁の部屋番号を入力してください。");
      await window.fbRunTransaction(window.db, async (tx) => {
        const snap = await tx.get(ref(code));
        if (!snap.exists()) throw Error("部屋が見つかりません。");
        const room = snap.data();
        if (!m.validRoom(room))
          throw Error(
            "部屋のデータを確認できません。全員アプリを更新して部屋を作り直してください。",
          );
        if (room.groupId) {
          const group = await tx.get(
            window.fbDoc(window.db, "studyGroups", room.groupId),
          );
          if (!group.exists() || !group.data().members?.[account])
            throw Error("このグループの参加者だけが対戦できます。");
        }
        if (
          room.status !== "waiting" ||
          room.players[account] ||
          Object.keys(room.players).length >= room.capacity
        )
          throw Error("この部屋には参加できません。");
        if (Date.now() - ms(room.createdAt) > 120000)
          throw Error("この部屋の待機時間は終了しました。");
        const players = { ...room.players, [account]: player() },
          full = Object.keys(players).length === room.capacity;
        patch(tx, ref(code), {
          players,
          ...(full
            ? { status: "playing", startsAt: window.fbServerTimestamp() }
            : {}),
        });
      });
      if (dialog !== screen || uid() !== account) {
        await publish({ id: account, code, answers: [] }, true, true);
        await settle(code);
        return;
      }
      session = { id: account, code, answers: [], finished: false };
      wait(code);
    });
  }
  function wait(code) {
    // Joined or created a room: separates a stop while waiting from one after the match starts.
    window.StartupMonitor?.event?.("duel:shown");
    dialog.querySelector("[data-duel-back]").onclick = closeScreen;
    dialog.querySelector(".duel-screen-badge").hidden = false;
    dialog.querySelector(".duel-screen-badge").textContent = "参加待ち";
    dialog.classList.remove("is-configuring");
    dialog.querySelector(".duel-content").innerHTML =
      '<div class="duel-wait"><small>' +
      (session?.groupId ? "グループの対戦" : "部屋番号") +
      "</small><strong>" +
      (session?.groupId ? "参加待ち" : code) +
      '</strong><p data-wait-count></p><p data-wait-names></p><p data-wait-settings></p></div><p class="duel-status" role="status"></p><button type="button" data-duel-cancel>退出</button>';
    dialog.querySelector("[data-duel-cancel]").onclick = closeScreen;
    listen(code);
    waitingTimer = setTimeout(() => {
      if (session && !session.start) {
        status("待機時間が終了しました。部屋を作り直してください。");
        publish(session, true, true).catch(() => {});
        stop();
      }
    }, 120000);
  }
  function listen(code) {
    unsubscribe?.();
    unsubscribe = window.fbOnSnapshot(
      ref(code),
      (snapshot) => {
        if (!session || session.code !== code || uid() !== session.id) return;
        if (!snapshot.exists()) {
          status("部屋が見つかりません。");
          stop();
          return;
        }
        const room = snapshot.data();
        if (!m.validRoom(room)) {
          window.StartupMonitor?.event?.("duel:error");
          status("部屋のデータを確認できません。");
          stop();
          return;
        }
        session.room = room;
        if (room.status === "cancelled") {
          status("対戦は中止されました。");
          stop();
          return;
        }
        if (!room.players[session.id]) {
          status("部屋から退出しました。");
          stop();
          return;
        }
        if (room.status === "finished") {
          result(room);
          return;
        }
        const count = dialog.querySelector("[data-wait-count]");
        if (count) {
          count.textContent =
            Object.keys(room.players).length +
            " / " +
            room.capacity +
            "人 · " +
            "カジュアル" +
            " · " +
            room.duration / 1000 +
            "秒 · ミス " +
            (room.missPenalty ? "−" + room.missPenalty : "0") +
            "点";
          dialog.querySelector("[data-wait-names]").textContent = Object.values(
            room.players,
          )
            .map((person) => person.name)
            .join("、");
        }
        const summary = dialog.querySelector("[data-wait-settings]");
        if (summary) {
          const rules = room.rules || m.defaultRules;
          summary.textContent =
            "教材 " +
            (room.books?.length || 1) +
            "冊 · 正解 " +
            rules.points +
            "点 · ミス −" +
            room.missPenalty +
            "点 · コンボ " +
            rules.combo +
            "倍 · 回答数 ×" +
            rules.answerBonus +
            "点 · イベント " +
            (rules.events ? rules.eventTypes.length + "種類" : "なし");
        }
        const start = ms(room.startsAt);
        if (room.status === "playing" && start && !session.start) {
          clearTimeout(waitingTimer);
          session.start = start + 3000;
          session.book = room.book;
          session.duration = room.duration;
          session.matchType = room.matchType;
          session.missPenalty = room.missPenalty;
          session.capacity = room.capacity;
          session.rules = room.rules || m.defaultRules;
          session.pool = room.pool;
          session.seed = room.seed;
          play();
        }
        opponent();
      },
      () => {
        status(
          "接続できません。回答記録は保持しています。終了後に再確認できます。",
        );
      },
    );
  }

  function play() {
    dialog.querySelector("[data-duel-back]").onclick = closeScreen;
    dialog.querySelector(".duel-screen-badge").hidden = false;
    dialog.classList.remove("is-configuring");
    dialog.classList.add("is-playing");
    window.StartupMonitor?.event?.("duel:start");
    if (session) session.diagnosticOpen = true;
    revision = 0;
    published = -1;
    dialog.querySelector(".duel-screen-badge").textContent =
      session.duration / 1000 + "秒";
    const body = dialog.querySelector(".duel-content");
    body.innerHTML =
      '<div class="duel-clock-row"><button type="button" class="duel-leave">終了する</button><div class="duel-clock" role="timer"></div><small>秒</small></div><div class="duel-scoreboard"></div><div class="duel-time-track"><span></span></div><div class="duel-event-banner" role="status" hidden></div><div class="duel-combo" aria-live="polite"></div><div class="duel-question-card"><small class="duel-question-label"></small><h3 class="duel-prompt"></h3></div><div class="duel-options"></div><div class="duel-correction" role="status" hidden><small>正しい意味</small><strong></strong><button type="button" data-duel-next>次の問題</button></div><p class="duel-status" role="status"></p>';
    const players = session.solo
        ? { [session.id]: player() }
        : session.room.players,
      host = dialog.querySelector(".duel-scoreboard");
    host.style.setProperty("--duel-players", Object.keys(players).length);
    for (const [id, person] of Object.entries(players)) {
      const column = document.createElement("div");
      column.className = "duel-player";
      column.dataset.playerId = id;
      column.innerHTML =
        '<div class="duel-player-avatar"></div><small></small><strong>0</strong>';
      column.querySelector("small").textContent = person.name;
      host.append(column);
      if (id === session.id) {
        column.querySelector("strong").setAttribute("data-duel-score", "");
        portrait(
          column.querySelector(".duel-player-avatar"),
          localStorage.getItem("core_v4_user_avatar_" + id) || "",
          myName,
          window.IconFrames?.equipped(),
        );
      } else opponentPortrait(session, id, person);
    }
    dialog.querySelector(".duel-leave").onclick = () => finish(true);
    dialog.querySelector("[data-duel-next]").onclick = question;
    question();
    clearInterval(timer);
    timer = setInterval(tick, 100);
    tick();
    opponent();
  }
  function question() {
    if (
      !session ||
      session.finished ||
      Date.now() < (session.penaltyUntil || 0)
    )
      return;
    session.questionShownAt = Math.max(0, Date.now() - session.start);
    session.reviewing = false;
    session.answering = false;
    const q = m.question(session.pool, session.seed, session.answers.length),
      host = dialog.querySelector(".duel-options");
    dialog.querySelector(".duel-prompt").textContent = q.prompt;
    dialog.querySelector(".duel-question-label").textContent =
      "第" + (session.answers.length + 1) + "問";
    dialog.querySelector(".duel-correction").hidden = true;
    host.replaceChildren();
    q.options.forEach((text, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = text;
      button.className = index === 9 ? "duel-none" : "";
      button.onclick = () => answer(index);
      host.append(button);
    });
  }
  function answer(choice) {
    if (
      !session ||
      session.finished ||
      session.reviewing ||
      session.answering ||
      Date.now() < (session.penaltyUntil || 0) ||
      Date.now() < session.start ||
      Date.now() - session.start >= session.duration ||
      session.answers.length >= m.maxAnswers
    )
      return;
    const target = session,
      q = m.question(target.pool, target.seed, target.answers.length),
      right = choice === q.correct;
    const before = liveScores(target)[target.id].total;
    target.answers.push({
      choice,
      at: Date.now() - target.start,
      shownAt: target.questionShownAt,
    });
    revision++;
    const scores = liveScores(target),
      value = scores[target.id],
      delta = value.total - before;
    opponent(scores);
    const event = m.eventAt(
      target.seed,
      target.answers.at(-1).at,
      target.rules,
    )?.type;
    const combo = dialog.querySelector(".duel-combo");
    combo.textContent = right
      ? value.combo +
        "連続正解 · " +
        (event === "bank"
          ? "貯金中"
          : delta < 0
            ? "−" + Math.abs(delta)
            : delta === 0
              ? "±0"
              : "+" + delta)
      : "ミス · " +
        (delta < 0 ? "−" + Math.abs(delta) : delta === 0 ? "±0" : "+" + delta);
    combo.classList.toggle("is-miss", !right);
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
      combo.animate?.(
        [
          { transform: "scale(.9)", opacity: 0.4 },
          { transform: "scale(1.08)", opacity: 1 },
          { transform: "scale(1)", opacity: 1 },
        ],
        { duration: 220 },
      );
    window.AppSounds?.play(right ? "swipe-right" : "swipe-left");
    const buttons = dialog.querySelectorAll(".duel-options button");
    buttons.forEach((button) => (button.disabled = true));
    buttons[choice].classList.add("is-selected");
    buttons[choice].setAttribute("aria-pressed", "true");
    window.StartupMonitor?.event?.("duel:answer");
    try {
      window.WordDuelProgress.apply(
        q.ref.book || target.book,
        q.ref,
        right,
        target.id,
      );
      if (right)
        window.StudyPoints?.reward(
          "quiz",
          q.ref.book || target.book,
          q.ref.num,
          target.id,
          {
            word: q.prompt || q.word || "",
            bookName: (
              textbooksPool.find((b) => b.id === (q.ref.book || target.book)) ||
              {}
            ).name,
          },
        );
    } catch (error) {
      status("理解度・ポイントの保存を確認できません。" + error.message);
    }
    if (target.answers.length % 5 === 0)
      window.WordDuelProgress.schedule(target.id);
    if (right) {
      target.answering = true;
      buttons[choice].classList.add("is-correct");
      answerTimer = setTimeout(() => {
        answerTimer = null;
        if (session === target && !target.finished) question();
      }, 180);
    } else {
      target.reviewing = true;
      target.penaltyUntil = Date.now() + 3000;
      buttons[choice].classList.add("is-wrong");
      buttons[q.correct].classList.add("is-correct");
      const correction = dialog.querySelector(".duel-correction");
      correction.querySelector("strong").textContent = q.meaning;
      correction.hidden = false;
      correction.querySelector("button").disabled = true;
      correction.querySelector("button").textContent = "あと3秒";
    }
    if (!target.solo && !sending)
      setTimeout(() => {
        if (session === target && !target.finished)
          publish(target).catch((error) => status(error.message));
      }, 250);
    if (target.answers.length === m.maxAnswers) finish();
  }
  function opponent(scores) {
    if (!session?.start || !dialog?.querySelector(".duel-scoreboard")) return;
    scores = scores || liveScores(session);
    const players = session.solo ? { [session.id]: {} } : session.room.players;
    for (const [id, person] of Object.entries(players)) {
      const column = dialog.querySelector(
        '[data-player-id="' + CSS.escape(id) + '"]',
      );
      if (!column) continue;
      const text = String(scores[id].total),
        node = column.querySelector("strong");
      if (node.textContent !== text) node.textContent = text;
      column.classList.toggle("is-abandoned", !!person.abandoned);
    }
  }
  function tick() {
    if (!session || session.finished) return;
    if (uid() !== session.id) {
      closeScreen();
      return;
    }
    const remain = session.start - Date.now(),
      duration = session.duration,
      clock = dialog.querySelector(".duel-clock"),
      text =
        remain > 0
          ? "開始 " + Math.ceil(remain / 1000)
          : String(Math.max(0, Math.ceil((duration + remain) / 1000)));
    if (clock.textContent !== text) {
      clock.textContent = text;
      dialog.querySelector(".duel-time-track span").style.transform =
        "scaleX(" +
        Math.max(0, Math.min(1, (duration + remain) / duration)) +
        ")";
    }
    clock.classList.toggle(
      "is-urgent",
      remain <= 10000 - duration && remain > -duration,
    );
    dialog
      .querySelectorAll(".duel-options button")
      .forEach(
        (button) =>
          (button.disabled =
            remain > 0 || session.reviewing || session.answering),
      );
    const elapsed = Math.max(0, Date.now() - session.start),
      banner = dialog.querySelector(".duel-event-banner"),
      active = m.eventAt(session.seed, elapsed, session.rules),
      preview = m.eventPreview(
        session.seed,
        elapsed,
        session.rules,
        session.duration,
      ),
      shown = active || preview;
    if (banner) {
      banner.hidden = !shown;
      if (shown) {
        const seconds = Math.max(
          0,
          Math.ceil(((active ? active.until : preview.start) - elapsed) / 1000),
        );
        let text =
          (active ? "" : "まもなく ") +
          window.BattleLobby.labels[shown.type] +
          " · " +
          seconds +
          "秒";
        if (active && preview)
          text += " / 次は" + window.BattleLobby.labels[preview.type];
        if (banner.textContent !== text) banner.textContent = text;
        banner.dataset.phase = active ? "active" : "preview";
      }
    }
    if (session.rules?.events) {
      const stage =
        Math.floor(elapsed / 15000) +
        ":" +
        (elapsed % 15000 < session.rules.eventSeconds * 1000);
      if (session.eventStage !== stage) {
        session.eventStage = stage;
        opponent();
      }
    }
    const next = dialog.querySelector("[data-duel-next]");
    if (next && session.reviewing) {
      const wait = Math.max(
        0,
        Math.ceil(((session.penaltyUntil || 0) - Date.now()) / 1000),
      );
      next.disabled = wait > 0;
      next.textContent = wait ? "あと" + wait + "秒" : "次の問題";
    }
    if (remain <= -duration) finish();
  }

  async function publish(target, done = false, abandoned = false) {
    if (target.solo) return;
    const account = target.id;
    if (uid() !== account) throw Error("アカウントが変更されました。");
    if (sending) await sending;
    if (!done && !abandoned && published === revision) return;
    const version = revision,
      answers = target.answers.slice();
    const task = window.fbRunTransaction(window.db, async (tx) => {
      const roomRef = ref(target.code),
        snap = await tx.get(roomRef);
      if (!snap.exists()) return;
      const room = snap.data(),
        old = room.players?.[account];
      if (!old) throw Error("この部屋の参加者ではありません。");
      if (room.status === "waiting") {
        if (abandoned) {
          if (room.host === account)
            patch(tx, roomRef, { status: "cancelled" });
          else {
            const players = { ...room.players };
            delete players[account];
            patch(tx, roomRef, { players });
          }
        }
        return;
      }
      if (room.status !== "playing" || old.done) return;
      if (answers.length < (old.answers || []).length) return;
      m.roomScores({
        ...room,
        players: { ...room.players, [account]: { ...old, answers } },
      });
      patch(tx, roomRef, {
        players: {
          ...room.players,
          [account]: { ...old, answers, done, abandoned },
        },
      });
    });
    sending = task;
    try {
      await task;
      published = version;
    } finally {
      if (sending === task) sending = null;
    }
    if (!done && session === target && revision !== published)
      await publish(target);
  }
  async function finish(abandoned = false) {
    dialog?.classList.remove("is-playing");
    if (!session || finishing || session.finished) return;
    finishing = true;
    window.StartupMonitor?.event?.("duel:closed");
    clearInterval(timer);
    const banner = dialog?.querySelector(".duel-event-banner");
    if (banner) banner.hidden = true;
    const target = session;
    target.finished = true;
    window.saveAfterStudy?.("battle-end");
    clearTimeout(answerTimer);
    window.WordDuelProgress.flush(target.id).catch(() => {});
    dialog
      .querySelectorAll(".duel-options button,[data-duel-next]")
      .forEach((button) => (button.disabled = true));
    if (target.solo) {
      const value = points(target, target.answers),
        summary = document.createElement("div");
      summary.className = "duel-solo-result";
      summary.innerHTML = "<small></small><strong></strong>";
      summary.querySelector("small").textContent =
        (abandoned ? "途中終了 · " : "終了 · ") +
        value.answered +
        "問 ×" +
        (target.rules || m.defaultRules).answerBonus +
        "点 = +" +
        value.bonus +
        "点";
      summary.querySelector("strong").textContent = value.total + "点";
      dialog.querySelector(".duel-content").prepend(summary);
      dialog.querySelector(".duel-question-card").hidden = true;
      dialog.querySelector(".duel-options").hidden = true;
      dialog.querySelector(".duel-correction").hidden = true;
      status("一人プレイ");
      const close = dialog.querySelector(".duel-leave");
      close.textContent = "閉じる";
      close.onclick = closeScreen;
      finishing = false;
      return;
    }
    const bonus = m.roomScores(
        {
          ...target,
          players: {
            ...target.room.players,
            [target.id]: {
              ...target.room.players[target.id],
              answers: target.answers,
            },
          },
        },
        true,
      )[target.id],
      summary = document.createElement("p");
    summary.className = "duel-answer-bonus";
    summary.textContent =
      bonus.answered +
      "問 ×" +
      (target.rules || m.defaultRules).answerBonus +
      "点 = +" +
      bonus.bonus +
      "点 · 合計 " +
      bonus.total +
      "点";
    dialog.querySelector(".duel-content").prepend(summary);
    status(abandoned ? "退出を保存しています…" : "回答を保存しています…");
    try {
      await publish(target, true, abandoned);
      status("相手の終了を確認しています…");
      await settle(target.code);
      if (dialog && session === target) {
        const snap = await window.fbGetDoc(ref(target.code));
        if (snap.exists() && snap.data().status === "finished")
          result(snap.data());
        else
          waitingTimer = setTimeout(
            () => settle(target.code).catch((error) => status(error.message)),
            Math.max(7000, target.start + target.duration + 7000 - Date.now()),
          );
      }
    } catch (error) {
      status("結果の同期が完了していません。" + error.message);
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "結果を再確認";
      retry.onclick = async () => {
        try {
          await publish(target, true, abandoned);
          await settle(target.code);
        } catch (e) {
          status(e.message);
        }
      };
      dialog?.querySelector(".duel-content").append(retry);
    } finally {
      finishing = false;
    }
  }
  async function settle(code) {
    connected();
    const account = uid();
    return window.fbRunTransaction(window.db, async (tx) => {
      const roomRef = ref(code),
        snap = await tx.get(roomRef);
      if (!snap.exists()) return;
      const room = snap.data();
      if (!m.validRoom(room)) throw Error("部屋のデータを確認できません。");
      if (!room.players?.[account]) throw Error("参加者を確認できません。");
      if (room.status !== "playing") return;
      const end = ms(room.startsAt) + 3000 + room.duration,
        people = Object.values(room.players);
      if (people.every((person) => person.abandoned)) {
        patch(tx, roomRef, { status: "cancelled" });
        return;
      }
      if (Date.now() < end) return;
      if (
        people.some((person) => !person.done && !person.abandoned) &&
        Date.now() < end + 7000
      )
        return;
      const profiles = new Map();
      for (const id of Object.keys(room.players)) {
        const reference = window.fbDoc(window.db, "users", id),
          profile = await tx.get(reference);
        if (!profile.exists()) throw Error("アカウントを確認できません。");
        profiles.set(id, { reference, data: profile.data() });
      }
      const normalized = {
          ...room,
          players: Object.fromEntries(
            Object.entries(room.players).map(([id, person]) => [
              id,
              {
                ...person,
                abandoned:
                  person.abandoned ||
                  !person.done ||
                  profiles.get(id).data.deleted,
              },
            ]),
          ),
        },
        places = m.placements(normalized);
      if (!places) {
        patch(tx, roomRef, { status: "cancelled" });
        return;
      }
      const result = { scores: {}, places: {} };
      for (const entry of places) {
        result.scores[entry.id] = profiles.get(entry.id).data.deleted
          ? 0
          : entry.score;
        result.places[entry.id] = entry.place;
      }
      patch(tx, roomRef, { status: "finished", result });
    });
  }
  function result(room) {
    if (!session || !dialog) return;
    dialog.classList.remove("is-playing");
    session.finished = true;
    stop();
    const mine = session.id;
    const body = dialog.querySelector(".duel-content");
    body.replaceChildren();
    const heading = document.createElement("h3");
    heading.className = "duel-result";
    heading.textContent = room.result.places[mine] + "位";
    const board = document.createElement("ol");
    board.className = "duel-results";
    Object.keys(room.players)
      .sort(
        (a, b) =>
          room.result.places[a] - room.result.places[b] || a.localeCompare(b),
      )
      .forEach((id) => {
        const li = document.createElement("li"),
          person = room.players[id],
          name = document.createElement("span"),
          score = document.createElement("strong"),
          rate = document.createElement("small");
        name.textContent = room.result.places[id] + "位 " + person.name;
        score.textContent = room.result.scores[id] + "点";
        const points = m.roomScores(room, true)[id];
        rate.textContent =
          points.answered + "問 · 回答ボーナス +" + points.bonus + "点";
        li.append(name, score, rate);
        board.append(li);
      });
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "閉じる";
    close.onclick = closeScreen;
    body.append(heading, board, close);
    window.renderLeaderboard?.(false);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && session?.start && !session.finished) finish(true);
  });
  window.addEventListener("pagehide", () => {
    window.WordDuelProgress.flush(session?.id).catch(() => {});
    if (session && !session.solo && !session.finished)
      publish(session, true, true).catch(() => {});
    stop();
  });
  document.addEventListener("keydown", (event) => {
    if (!dialog) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeScreen();
    } else if (event.key === "Tab") {
      const nodes = Array.from(
        dialog.querySelectorAll("button,input,select"),
      ).filter((node) => !node.disabled && node.getClientRects().length);
      if (!nodes.length) return;
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  window.WordDuel = {
    isPlaying: () => !!session?.start && !session.finished,
    settle,
  };
})();
