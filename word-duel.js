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
    stopTimers();
  }
  function stopTimers() {
    clearInterval(timer);
    clearTimeout(waitingTimer);
    clearTimeout(answerTimer);
    answerTimer = null;
    timer = null;
    waitingTimer = null;
  }
  function cleanup() {
    stop();
    pendingRematch = null;
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
            version: 10,
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
        await announceRematch(code);
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
          version: 10,
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
        await announceRematch(code);
        session = { id: account, code, answers: [], finished: false };
        wait(code);
      });
  };
  function wireJoin() {
    dialog.querySelector("[data-duel-join]").onclick = locked(() =>
      joinRoom(dialog.querySelector(".duel-join input").value.trim()),
    );
  }
  async function joinRoom(code) {
    connected();
    const account = uid(),
      screen = dialog;
    if (!/^\d{4}$/.test(code)) throw Error("4桁の部屋番号を入力してください。");
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
  }
  // A rematch room made with "choose rules" is announced in the finished room once created.
  let pendingRematch = null;
  async function announceRematch(code) {
    const from = pendingRematch;
    pendingRematch = null;
    if (!from || from.code === code) return;
    try {
      await window.fbRunTransaction(window.db, async (tx) => {
        const snap = await tx.get(ref(from.code));
        if (!snap.exists() || snap.data().status !== "finished") return;
        patch(tx, ref(from.code), {
          rematch: { code, by: uid(), keep: false, at: Date.now() },
        });
      });
    } catch (error) {
      status("再戦の案内を送れませんでした。部屋番号を伝えてください。");
    }
  }
  function present(room) {
    return Object.values(room.players).filter((person) => !person.abandoned)
      .length;
  }
  async function rematch(keep) {
    const old = session,
      room = old?.room;
    if (!room || old.solo || !dialog) return;
    if (!keep) {
      // Start from the previous rules on the usual settings screen.
      const groupId = room.groupId;
      closeScreen();
      window.openWordDuel(groupId, "create");
      if (!dialog) return;
      window.BattleLobby.apply(dialog, { ...room, capacity: room.capacity });
      pendingRematch = { code: old.code };
      status("前回のルールを読み込みました。部屋を作ると、前回のメンバーに再戦の案内が届きます。");
      return;
    }
    connected();
    // Someone may already have made the rematch room: join it instead of making another.
    if (room.rematch?.code && room.rematch.by !== old.id)
      return joinRoom(room.rematch.code);
    const account = uid(),
      screen = dialog,
      next = {
        version: 10,
        matchType: room.matchType,
        duration: room.duration,
        capacity: Math.max(2, Math.min(room.capacity, present(room))),
        missPenalty: room.missPenalty,
        rules: room.rules || m.defaultRules,
        book: room.book,
        books: room.books,
        ...(room.groupId ? { groupId: room.groupId } : {}),
        host: account,
        status: "waiting",
        // Same words, new seed: the questions come in a different order.
        pool: room.pool,
        seed: crypto.getRandomValues(new Uint32Array(1))[0],
        players: { [account]: player() },
      };
    if (!m.validRoom(next)) throw Error("前回の部屋の設定を確認できません。");
    let code = null,
      other = null;
    for (let attempt = 0; attempt < 5 && !code && !other; attempt++) {
      const candidate = String(
        1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000),
      );
      const made = await window.fbRunTransaction(window.db, async (tx) => {
        const previous = await tx.get(ref(old.code)),
          taken = await tx.get(ref(candidate));
        const existing = previous.exists() ? previous.data().rematch : null;
        if (existing?.code && existing.by !== account)
          return { other: existing.code };
        if (taken.exists()) return null;
        tx.set(ref(candidate), {
          ...next,
          createdAt: window.fbServerTimestamp(),
        });
        patch(tx, ref(old.code), {
          rematch: { code: candidate, by: account, keep: true, at: Date.now() },
        });
        return { code: candidate };
      });
      code = made?.code || null;
      other = made?.other || null;
    }
    if (other) return joinRoom(other);
    if (!code) throw Error("部屋番号を作れませんでした。再試行してください。");
    if (dialog !== screen || uid() !== account) {
      await publish({ id: account, code, answers: [] }, true, true);
      return;
    }
    session = {
      id: account,
      code,
      answers: [],
      finished: false,
      ...(room.groupId ? { groupId: room.groupId } : {}),
    };
    wait(code);
  }
  function rematchInvite(room) {
    const box = dialog?.querySelector(".duel-rematch"),
      invite = room.rematch;
    if (!box || !session) return;
    const show =
        !!invite && /^\d{4}$/.test(invite.code) && invite.by !== session.id,
      text = box.querySelector("[data-rematch-invite]"),
      join = box.querySelector("[data-rematch-join]");
    text.hidden = join.hidden = !show;
    if (!show) return;
    text.textContent =
      (room.players[invite.by]?.name || "相手") +
      "さんが再戦の部屋を作りました" +
      (invite.keep ? "（ルールそのまま）" : "（新しいルール）");
    join.onclick = locked(() => joinRoom(invite.code));
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

  // Callouts float over the screen without blocking taps. They use the Web Animations API,
  // which keeps working where page-wide CSS animation is switched off for stability on iOS.
  const eventInfo = Object.fromEntries(
      m.eventCatalog.map((event) => [event.id, event]),
    ),
    tones = {
      得点: "score",
      順位: "rank",
      コンボ: "combo",
      チャレンジ: "challenge",
      特殊: "special",
    };
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  function eventText(type) {
    const info = eventInfo[type] || {},
      points = session?.rules?.eventPoints;
    return {
      name: info.name || type,
      hint: info.hint || info.description || "",
      detail: (info.description || "").replaceAll(
        "イベント点",
        points == null ? "イベント点" : points + "点",
      ),
      tone: tones[info.group] || "score",
    };
  }
  function announce(card, priority = 1, duration = 1800) {
    const host = dialog?.querySelector(".duel-announce");
    if (!host) return;
    const now = Date.now();
    if (Number(host.dataset.until) > now && Number(host.dataset.priority) > priority)
      return;
    host.dataset.priority = priority;
    host.dataset.until = now + duration;
    host.dataset.tone = card.tone || "";
    host.classList.toggle("is-effect", !!card.effect);
    host.replaceChildren();
    for (const [tag, text, name] of [
      ["small", card.kicker],
      ["strong", card.title],
      ["p", card.text],
      ["p", card.detail, "duel-announce-detail"],
    ]) {
      if (!text) continue;
      const node = document.createElement(tag);
      node.textContent = text;
      if (name) node.className = name;
      host.append(node);
    }
    host.getAnimations?.().forEach((run) => run.cancel());
    host.hidden = false;
    const run = host.animate?.(
      calm()
        ? [
            { opacity: 0 },
            { opacity: 1, offset: 0.1 },
            { opacity: 1, offset: 0.85 },
            { opacity: 0 },
          ]
        : [
            { opacity: 0, transform: "translateX(-50%) scale(1.6)" },
            { opacity: 1, transform: "translateX(-50%) scale(.94)", offset: 0.14 },
            { opacity: 1, transform: "translateX(-50%) scale(1)", offset: 0.22 },
            { opacity: 1, transform: "translateX(-50%) scale(1)", offset: 0.82 },
            {
              opacity: 0,
              transform: "translateX(-50%) translateY(-18px) scale(.92)",
            },
          ],
      { duration, easing: "ease-out", fill: "forwards" },
    );
    if (run) run.onfinish = () => (host.hidden = true);
    else setTimeout(() => (host.hidden = true), duration);
  }
  function pop(column, delta) {
    if (!column || !delta) return;
    column = column.querySelector(".duel-step") || column;
    const node = document.createElement("span");
    node.className = "duel-score-pop" + (delta < 0 ? " is-minus" : "");
    node.textContent = (delta < 0 ? "−" : "+") + Math.abs(delta);
    column.append(node);
    const run = node.animate?.(
      calm()
        ? [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }]
        : [
            { opacity: 0, transform: "translate(-50%,6px)" },
            { opacity: 1, transform: "translate(-50%,0)", offset: 0.2 },
            { opacity: 0, transform: "translate(-50%,-26px)" },
          ],
      { duration: 850, easing: "ease-out" },
    );
    if (run) run.onfinish = () => node.remove();
    else setTimeout(() => node.remove(), 850);
  }
  function nudge(node, frames, duration) {
    if (node && !calm()) node.animate?.(frames, { duration, easing: "ease-out" });
  }
  function roster(target) {
    return target.solo
      ? { [target.id]: { name: myName, answers: target.answers } }
      : {
          ...target.room.players,
          [target.id]: {
            ...target.room.players[target.id],
            answers: target.answers,
          },
        };
  }
  function scoresAt(target, at) {
    return m.roomScores({ ...target, players: roster(target) }, false, at);
  }
  // Right/wrong per answer, extended as answers arrive instead of recomputed every tick.
  function rightsOf(target, id, answers) {
    const cache = (target.rightCache ||= {}),
      entry = (cache[id] ||= { flags: [] });
    if (entry.flags.length > answers.length) entry.flags = [];
    for (let i = entry.flags.length; i < answers.length; i++)
      entry.flags.push(
        m.correctChoice(target.pool, target.seed, i) === answers[i].choice,
      );
    return entry.flags;
  }
  function namesOf(target, ids) {
    const people = roster(target);
    return ids
      .map((id) => (id === target.id ? "あなた" : people[id]?.name || "相手"))
      .join("・");
  }
  const rankEvents = ["chase", "pressure", "comeback", "lead", "steal", "hunt"];
  // What the running event means for this player right now, so its effect is visible
  // without opening the rules: whether the player is targeted, and challenge progress.
  function eventLine(target, active, elapsed, final = false) {
    const type = active.type,
      me = target.id,
      people = roster(target),
      ids = Object.keys(people),
      p = target.rules.eventPoints,
      start = active.until - target.rules.eventSeconds * 1000,
      inside = (id) => {
        const answers = people[id].answers || [],
          flags = rightsOf(target, id, answers);
        return answers
          .map((answer, i) => ({ at: answer.at, right: flags[i] }))
          .filter(
            (answer) =>
              answer.at >= start &&
              answer.at < active.until &&
              answer.at <= elapsed,
          );
      };
    if (rankEvents.includes(type)) {
      if (ids.length < 2 && ["chase", "steal", "hunt"].includes(type))
        return null;
      // Same basis as the scoring: standings just before the event started.
      const key =
        start + ":" + ids.map((id) => (people[id].answers || []).length).join();
      if (target.rankKey !== key) {
        const totals = scoresAt(target, start - 1),
          levels = [...new Set(ids.map((id) => totals[id].total))].sort(
            (a, b) => b - a,
          );
        target.rankKey = key;
        target.rankInfo = {
          ranks: Object.fromEntries(
            ids.map((id) => [id, levels.indexOf(totals[id].total)]),
          ),
          last: levels.length - 1,
        };
      }
      const { ranks, last } = target.rankInfo,
        r = ranks[me],
        at = (rank) =>
          namesOf(
            target,
            ids.filter((id) => id !== me && ranks[id] === rank),
          );
      if (type === "chase")
        return r > 0
          ? { text: "あなたは対象：正解すると2倍！", kind: "good" }
          : { text: "あなたは首位なので対象外" };
      if (type === "pressure")
        return r === 0
          ? { text: "あなたは首位：ミスの失点2倍！", kind: "bad" }
          : { text: "首位の" + at(0) + "はミスの失点2倍" };
      if (type === "comeback")
        return r === last
          ? { text: "あなたは最下位：正解すると3倍！", kind: "good" }
          : { text: "最下位の" + at(last) + "は正解3倍" };
      if (type === "lead")
        return r === 0
          ? { text: "あなたは首位：正解で+" + p + "点！", kind: "good" }
          : { text: "首位の" + at(0) + "は正解で+" + p + "点" };
      if (type === "steal")
        return r === 0
          ? { text: "あなたは首位：正解した相手に点を奪われる！", kind: "bad" }
          : { text: "正解で首位の" + at(0) + "から" + p + "点奪える！", kind: "good" };
      return r === 0
        ? { text: "あなたは首位：一つ下の相手に狙われる！", kind: "bad" }
        : { text: "正解で" + at(r - 1) + "を−" + p + "点！", kind: "good" };
    }
    const mine = inside(me);
    if (type === "streak") {
      let run = 0,
        done = false;
      for (const answer of mine) {
        run = answer.right ? run + 1 : 0;
        if (run >= 3) done = true;
      }
      return done
        ? { text: "達成！ +" + p + "点", kind: "good" }
        : { text: "連続正解 " + run + " / 3" + (final ? "（未達成）" : "") };
    }
    if (type === "perfect") {
      const right = mine.filter((answer) => answer.right).length;
      if (mine.some((answer) => !answer.right))
        return { text: "ミスしたので今回は失敗", kind: "bad" };
      if (final)
        return right >= 3
          ? { text: "達成！ +" + p + "点", kind: "good" }
          : { text: "正解が3問に届かず" };
      return {
        text: "正解 " + right + " / 3 · ミスなし",
        kind: right >= 3 ? "good" : "",
      };
    }
    if (type === "first") {
      let winner = null;
      for (const id of ids)
        for (const answer of inside(id))
          if (answer.right && (!winner || answer.at < winner.at))
            winner = { id, at: answer.at };
      if (!winner)
        return { text: final ? "誰も正解できなかった" : "まだ誰も正解していない！" };
      return winner.id === me
        ? { text: "あなたが一番乗り！ +" + p + "点", kind: "good" }
        : { text: namesOf(target, [winner.id]) + "が一番乗り" };
    }
    if (type === "cooperate") {
      const need = ids.length * 3,
        total = ids.reduce(
          (sum, id) => sum + inside(id).filter((answer) => answer.right).length,
          0,
        );
      return total >= need
        ? { text: "全員達成！ +" + p + "点", kind: "good" }
        : { text: "全員の正解 " + total + " / " + need };
    }
    if (type === "risk") {
      if (!mine.length)
        return { text: "次の1問が勝負！（得点も失点も3倍）", kind: "bad" };
      return mine[0].right
        ? { text: "勝負に勝った！", kind: "good" }
        : { text: "勝負に負けた…", kind: "bad" };
    }
    if (type === "last")
      return active.until - elapsed <= 3000
        ? { text: "今！ 正解で+" + p + "点", kind: "good" }
        : { text: "残り3秒になったら正解で+" + p + "点" };
    return null;
  }
  function showEventEnd(target, ended) {
    const before = scoresAt(target, ended.start - 1)[target.id].total,
      after = scoresAt(target, ended.until)[target.id].total,
      delta = after - before,
      line = rankEvents.includes(ended.type)
        ? null
        : eventLine(target, ended, ended.until, true),
      info = eventText(ended.type),
      gained =
        "イベント中 " + (delta < 0 ? "−" + Math.abs(delta) : "+" + delta) + "点";
    announce(
      {
        kicker: "イベント終了 · " + info.name,
        title: line ? line.text : gained,
        text: line ? gained : "",
        tone: info.tone,
        effect: true,
      },
      3,
      1900,
    );
  }
  // Podium: 2nd, 1st, 3rd, 4th from the left, with steps by rank (ties share a step).
  // When the order changes, each player slides from where they were to their new place.
  function podium(host, ids, scores) {
    const levels = [...new Set(ids.map((id) => scores[id].total))].sort(
        (a, b) => b - a,
      ),
      sorted = ids
        .map((id, index) => ({ id, index, rank: levels.indexOf(scores[id].total) }))
        .sort((a, b) => a.rank - b.rank || a.index - b.index),
      slots =
        sorted.length < 2
          ? sorted
          : [sorted[1], sorted[0], ...sorted.slice(2)],
      key = slots.map((entry) => entry.id + ":" + entry.rank).join();
    if (host.dataset.podium === key) return;
    const columns = slots.map((entry) => ({
      ...entry,
      node: host.querySelector('[data-player-id="' + CSS.escape(entry.id) + '"]'),
    }));
    if (columns.some((entry) => !entry.node)) return;
    const before = columns.map((entry) => ({
      left: entry.node.getBoundingClientRect().left,
      step: entry.node.querySelector(".duel-step")?.offsetHeight || 0,
    }));
    const first = !host.dataset.podium;
    host.dataset.podium = key;
    columns.forEach((entry, order) => {
      entry.node.style.order = order;
      entry.node.dataset.rank = String(entry.rank + 1);
    });
    if (first || calm()) return;
    columns.forEach((entry, i) => {
      const dx = before[i].left - entry.node.getBoundingClientRect().left,
        step = entry.node.querySelector(".duel-step");
      if (Math.abs(dx) > 1)
        entry.node.animate?.(
          [
            { transform: "translate(" + dx + "px,0)" },
            { transform: "translate(" + dx / 2 + "px,-14px)", offset: 0.5 },
            { transform: "translate(0,0)" },
          ],
          { duration: 520, easing: "ease-in-out" },
        );
      if (step && before[i].step && before[i].step !== step.offsetHeight)
        step.animate?.(
          [{ height: before[i].step + "px" }, { height: step.offsetHeight + "px" }],
          { duration: 420, easing: "ease-out" },
        );
    });
  }
  function confetti() {
    if (calm() || !dialog || !document.body.animate) return;
    const layer = document.createElement("div"),
      colors = ["#ffd36b", "#7fd3ff", "#86f0b5", "#ff9d8a", "#cfa8ff", "#fff1c5"];
    layer.className = "duel-confetti";
    layer.setAttribute("aria-hidden", "true");
    let longest = 0;
    for (let i = 0; i < 28; i++) {
      const piece = document.createElement("i"),
        drift = Math.round((Math.random() - 0.5) * 120),
        spin = Math.round((Math.random() - 0.5) * 900),
        time = 1500 + Math.random() * 1100,
        delay = Math.random() * 350;
      piece.style.left = Math.random() * 100 + "%";
      piece.style.background = colors[i % colors.length];
      layer.append(piece);
      piece.animate(
        [
          { transform: "translate(0,-20px) rotate(0deg)", opacity: 1 },
          {
            transform: "translate(" + drift + "px,105vh) rotate(" + spin + "deg)",
            opacity: 0.9,
          },
        ],
        { duration: time, delay, easing: "cubic-bezier(.25,.6,.4,1)", fill: "backwards" },
      );
      longest = Math.max(longest, time + delay);
    }
    dialog.append(layer);
    setTimeout(() => layer.remove(), longest + 100);
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
      '<div class="duel-clock-row"><button type="button" class="duel-leave">終了する</button><div class="duel-clock" role="timer"></div><small>秒</small></div><div class="duel-scoreboard"></div><div class="duel-time-track"><span></span></div><div class="duel-event-banner" role="status" hidden><b></b><em></em><span></span><small></small><i></i></div><div class="duel-announce" aria-hidden="true" hidden></div><div class="duel-combo" aria-live="polite"></div><div class="duel-question-card"><small class="duel-question-label"></small><h3 class="duel-prompt"></h3></div><div class="duel-options"></div><div class="duel-correction" role="status" hidden><small>正しい意味</small><div class="duel-correction-say"><em></em><button type="button" class="pronounce-button duel-speak" data-sound="none" data-say="" aria-label="発音を聞く"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg></button></div><strong></strong><button type="button" data-duel-next>次の問題</button></div><p class="duel-status" role="status"></p>';
    const players = session.solo
        ? { [session.id]: player() }
        : session.room.players,
      host = dialog.querySelector(".duel-scoreboard");
    host.style.setProperty("--duel-players", Object.keys(players).length);
    for (const [id, person] of Object.entries(players)) {
      const column = document.createElement("div");
      column.className = "duel-player";
      column.dataset.playerId = id;
      column.dataset.rank = "1";
      column.innerHTML =
        '<div class="duel-player-avatar"></div><em class="duel-player-correct" title="正解数">✓0</em><small></small><div class="duel-step"><strong>0</strong></div>';
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
    // Older rooms are played by older apps that do not know this choice.
    if (session.solo || (session.room?.version || 0) >= 10) {
      const skip = document.createElement("button");
      skip.type = "button";
      skip.textContent = "わからない";
      skip.className = "duel-pass";
      skip.onclick = () => answer(m.pass);
      host.append(skip);
    }
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
      right = choice === q.correct,
      skipped = choice === m.pass;
    const previous = liveScores(target)[target.id],
      before = previous.total;
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
      : skipped
        ? "わからない · 減点なし"
        : "ミス · " +
          (delta < 0 ? "−" + Math.abs(delta) : delta === 0 ? "±0" : "+" + delta);
    combo.classList.toggle("is-miss", !right);
    combo.dataset.tier = !right
      ? ""
      : value.combo >= 20
        ? "rainbow"
        : value.combo >= 10
          ? "gold"
          : value.combo >= 5
            ? "blue"
            : "";
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
    pop(
      dialog.querySelector(
        '[data-player-id="' + CSS.escape(target.id) + '"]',
      ),
      delta,
    );
    if (!right && !skipped)
      nudge(
        dialog.querySelector(".duel-question-card"),
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-7px)" },
          { transform: "translateX(6px)" },
          { transform: "translateX(-4px)" },
          { transform: "translateX(0)" },
        ],
        320,
      );
    else if (q.correct === 9)
      announce(
        { kicker: "選択肢になし", title: "見抜いた！ 得点2倍", tone: "challenge" },
        1,
        1100,
      );
    else if (
      value.combo >= 5 &&
      Math.floor(value.combo / 5) > Math.floor(previous.combo / 5)
    ) {
      announce(
        {
          title: value.combo + "コンボ！",
          tone:
            value.combo >= 20 ? "rainbow" : value.combo >= 10 ? "score" : "combo",
        },
        1,
        1100,
      );
      window.AppSounds?.play("confirm");
    }
    const buttons = dialog.querySelectorAll(".duel-options button");
    buttons.forEach((button) => (button.disabled = true));
    buttons[choice].classList.add("is-selected");
    if (right)
      nudge(
        buttons[choice],
        [
          { transform: "scale(.96)" },
          { transform: "scale(1.06)" },
          { transform: "scale(1)" },
        ],
        180,
      );
    buttons[choice].setAttribute("aria-pressed", "true");
    window.StartupMonitor?.event?.("duel:answer");
    try {
      // A battle only lowers a ○; 「わからない」 is the player's own "I don't know" and records ×.
      window.WordDuelProgress.apply(
        q.ref.book || target.book,
        q.ref,
        right,
        target.id,
        { onlyDowngrade: !skipped },
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
      if (!skipped) buttons[choice].classList.add("is-wrong");
      buttons[q.correct].classList.add("is-correct");
      const correction = dialog.querySelector(".duel-correction");
      correction.querySelector("strong").textContent = q.meaning;
      correction.querySelector(".duel-correction-say em").textContent = q.prompt;
      correction.querySelector(".duel-speak").dataset.say = q.prompt;
      window.Pronounce?.auto(q.prompt);
      correction.hidden = false;
      const next = correction.querySelector("[data-duel-next]");
      next.disabled = true;
      next.textContent = "あと3秒";
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
    const players = session.solo ? { [session.id]: {} } : session.room.players,
      ids = Object.keys(players),
      top = Math.max(...ids.map((id) => scores[id].total));
    for (const [id, person] of Object.entries(players)) {
      const column = dialog.querySelector(
        '[data-player-id="' + CSS.escape(id) + '"]',
      );
      if (!column) continue;
      const text = String(scores[id].total),
        node = column.querySelector("strong");
      if (node.textContent !== text) {
        if (id !== session.id && node.dataset.shown)
          pop(column, scores[id].total - Number(node.textContent));
        node.textContent = text;
        node.dataset.shown = "1";
      }
      column.classList.toggle("is-abandoned", !!person.abandoned);
      column.classList.toggle(
        "is-leading",
        ids.length > 1 && top > 0 && scores[id].total === top,
      );
      const answers =
          id === session.id ? session.answers : person.answers || [],
        flags = rightsOf(session, id, answers),
        badge = column.querySelector(".duel-player-correct"),
        count = "✓" + flags.filter(Boolean).length,
        seen = (session.seenAnswers ||= {});
      if (badge && badge.textContent !== count) badge.textContent = count;
      // Another player just answered correctly: their icon lights up.
      if (
        id !== session.id &&
        seen[id] !== undefined &&
        answers.length > seen[id] &&
        flags[answers.length - 1]
      )
        nudge(
          column.querySelector(".duel-player-avatar"),
          [
            { transform: "scale(1)", boxShadow: "0 0 0 0 #86f0b5cc" },
            {
              transform: "scale(1.16)",
              boxShadow: "0 0 0 6px #86f0b566",
              offset: 0.4,
            },
            { transform: "scale(1)", boxShadow: "0 0 0 12px #86f0b500" },
          ],
          600,
        );
      seen[id] = answers.length;
    }
    podium(dialog.querySelector(".duel-scoreboard"), ids, scores);
    // A new sole leader replaces the previous one: call out the comeback.
    const leaders = ids.filter((id) => scores[id].total === top);
    if (ids.length > 1 && top > 0 && leaders.length === 1) {
      const leader = leaders[0];
      if (session.leader && session.leader !== leader) {
        announce(
          {
            title: "逆転！",
            text:
              leader === session.id
                ? "あなたが1位に！"
                : namesOf(session, [leader]) + "が1位に！",
            tone: "score",
          },
          2,
          1500,
        );
        nudge(
          dialog.querySelector(
            '[data-player-id="' + CSS.escape(leader) + '"] strong',
          ),
          [
            { transform: "scale(1)" },
            { transform: "scale(1.4)", color: "#fff6c0" },
            { transform: "scale(1)" },
          ],
          700,
        );
        window.AppSounds?.play("confirm");
      }
      session.leader = leader;
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
    if (remain > 0) {
      const count = Math.ceil(remain / 1000);
      if (count <= 3 && session.countdown !== count) {
        session.countdown = count;
        announce({ title: String(count), tone: "count" }, 2, 800);
      }
    } else if (session.countdown !== 0) {
      session.countdown = 0;
      if (-remain < 1500)
        announce({ title: "スタート！", tone: "count" }, 2, 900);
    }
    if (
      duration > 15000 &&
      !session.lastCall &&
      duration + remain <= 10000 &&
      duration + remain > 0
    ) {
      session.lastCall = true;
      announce({ title: "ラスト10秒！", tone: "urgent" }, 2, 1300);
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
          ),
          info = eventText(shown.type),
          fill = active
            ? Math.max(
                0,
                Math.min(
                  1,
                  (active.until - elapsed) / (session.rules.eventSeconds * 1000),
                ),
              )
            : 0,
          line = active ? eventLine(session, active, elapsed) : null,
          parts = [
            ["b", (active ? "" : "まもなく ") + info.name],
            ["em", (active ? "残り" : "") + seconds + "秒"],
            ["span", line ? line.text : info.hint],
            [
              "small",
              info.detail +
                (active && preview
                  ? " / 次は" + window.BattleLobby.labels[preview.type]
                  : ""),
            ],
          ];
        banner.querySelector("span").dataset.kind = line?.kind || "";
        for (const [tag, text] of parts) {
          const node = banner.querySelector(tag);
          if (node.textContent !== text) node.textContent = text;
        }
        banner.querySelector("i").style.transform = "scaleX(" + fill + ")";
        banner.dataset.phase = active ? "active" : "preview";
        banner.dataset.tone = info.tone;
      }
    }
    if (session.rules?.events) {
      const stage =
        Math.floor(elapsed / 15000) +
        ":" +
        (elapsed % 15000 < session.rules.eventSeconds * 1000);
      if (session.eventStage !== stage) {
        const ended = session.activeEvent;
        session.eventStage = stage;
        opponent();
        if (ended && ended.until !== active?.until) {
          session.activeEvent = null;
          if (!active) showEventEnd(session, ended);
        }
        if (active) {
          session.activeEvent = {
            type: active.type,
            until: active.until,
            start: active.until - session.rules.eventSeconds * 1000,
          };
          const info = eventText(active.type),
            line = rankEvents.includes(active.type)
              ? eventLine(session, active, elapsed)
              : null;
          announce(
            {
              kicker:
                "イベント発生 · " +
                info.name +
                " · " +
                session.rules.eventSeconds +
                "秒間",
              title: line?.kind ? line.text : info.hint,
              tone: info.tone,
              effect: true,
            },
            3,
            2400,
          );
          window.AppSounds?.play("open");
        }
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
    const callout = dialog?.querySelector(".duel-announce");
    if (callout && !abandoned) {
      announce({ title: "そこまで！", tone: "count" }, 4, 1500);
      window.AppSounds?.play("confirm");
    } else if (callout) {
      callout.getAnimations?.().forEach((run) => run.cancel());
      callout.hidden = true;
    }
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
      const close = dialog.querySelector(".duel-leave"),
        again = document.createElement("button");
      close.textContent = "閉じる";
      close.onclick = closeScreen;
      again.type = "button";
      again.className = "duel-again";
      again.textContent = "もう一度（ルールそのまま）";
      again.onclick = () => {
        if (!dialog || session !== target) return;
        session = {
          ...target,
          seed: crypto.getRandomValues(new Uint32Array(1))[0],
          start: Date.now(),
          answers: [],
          finished: false,
          penaltyUntil: 0,
          reviewing: false,
          answering: false,
          rightCache: {},
          seenAnswers: {},
          countdown: undefined,
          lastCall: false,
          eventStage: undefined,
          activeEvent: null,
          leader: undefined,
        };
        dialog.querySelector(".duel-solo-result")?.remove();
        play();
      };
      close.before(again);
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
    // The room listener may already have drawn the results; do not write progress over them.
    const note = (text) => {
      if (dialog?.dataset.resultCode !== target.code) status(text);
    };
    note(abandoned ? "退出を保存しています…" : "回答を保存しています…");
    try {
      await publish(target, true, abandoned);
      note("相手の終了を確認しています…");
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
    // The finished room keeps being watched for a rematch invitation; render the results once.
    if (dialog.dataset.resultCode === session.code) {
      rematchInvite(room);
      return;
    }
    dialog.dataset.resultCode = session.code;
    dialog.classList.remove("is-playing");
    session.finished = true;
    session.room = room;
    stopTimers();
    const mine = session.id;
    const body = dialog.querySelector(".duel-content");
    body.replaceChildren();
    const heading = document.createElement("h3");
    heading.className = "duel-result";
    heading.textContent = room.result.places[mine] + "位";
    heading.dataset.place = room.result.places[mine];
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
        if (room.result.places[id] === 1) li.classList.add("is-first");
        board.append(li);
      });
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "閉じる";
    close.onclick = closeScreen;
    const again = document.createElement("div");
    again.className = "duel-rematch";
    again.innerHTML =
      '<p data-rematch-invite hidden></p><button type="button" data-rematch-join hidden>参加する</button><div class="duel-rematch-actions"><button type="button" data-rematch="keep">再戦（ルールそのまま）</button><button type="button" data-rematch="choose">ルールを選んで再戦</button></div><p class="duel-status" role="status"></p>';
    again.querySelector('[data-rematch="keep"]').onclick = locked(() =>
      rematch(true),
    );
    again.querySelector('[data-rematch="choose"]').onclick = () =>
      rematch(false);
    body.append(heading, board, again, close);
    rematchInvite(room);
    // Results come in from last place to first, then the player's own place and confetti.
    if (!calm() && board.animate) {
      const rows = [...board.children],
        step = 420;
      rows.forEach((row, i) =>
        row.animate(
          [
            { opacity: 0, transform: "translateY(14px) scale(.96)" },
            { opacity: 1, transform: "none" },
          ],
          {
            duration: 380,
            delay: (rows.length - 1 - i) * step,
            easing: "ease-out",
            fill: "backwards",
          },
        ),
      );
      heading.animate(
        [
          { opacity: 0, transform: "scale(1.8)" },
          { opacity: 1, transform: "scale(.92)", offset: 0.6 },
          { opacity: 1, transform: "scale(1)" },
        ],
        {
          duration: 520,
          delay: rows.length * step,
          easing: "ease-out",
          fill: "backwards",
        },
      );
      setTimeout(() => {
        if (board.isConnected) confetti();
      }, rows.length * step + 200);
    }
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
