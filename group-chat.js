// Subscribe to only the latest 10 messages, no older than seven days while this group's dialog is open.
(function (root) {
  "use strict";
  let current = null;
  const policy = root.GroupChatPolicy;
  const uid = () => (typeof myId === "string" ? myId : "GUEST-000");
  function stop() {
    if (!current) return;
    clearTimeout(current.expiryTimer);
    clearInterval(current.clock);
    current.unsubscribe?.();
    current.flushDraft?.();
    current = null;
  }
  function validQuiz(quiz) {
    return (
      typeof quiz?.word === "string" &&
      Array.isArray(quiz.options) &&
      quiz.options.length === 4 &&
      quiz.options.every((text) => typeof text === "string") &&
      Number.isInteger(quiz.correct) &&
      quiz.correct >= 0 &&
      quiz.correct < 4
    );
  }
  function deadline(task) {
    let timer;
    return Promise.race([
      task,
      new Promise(
        (_, reject) =>
          (timer = setTimeout(
            () =>
              reject(Error("通信に時間がかかっています。再試行してください。")),
            15000,
          )),
      ),
    ]).finally(() => clearTimeout(timer));
  }
  function mount(dialog, group) {
    if (current?.dialog === dialog && current.id === group.id) {
      // Read marks and achievements live on the group document: redraw the talk with them.
      current.group = group;
      current.render?.();
      current.markRead?.();
      return;
    }
    stop();
    const account = uid(),
      state = {
        dialog,
        id: group.id,
        group,
        rows: new Map(),
        unsubscribe: null,
        cleaned: false,
        deleting: new Set(),
        expiryTimer: null,
        sending: false,
      };
    current = state;
    dialog.classList.add("group-chat-dialog");
    dialog.querySelector("h2").textContent = group.name || "グループ";
    const nav = document.createElement("div");
    nav.className = "group-chat-tabs";
    const talk = document.createElement("button"),
      learn = document.createElement("button");
    talk.type = learn.type = "button";
    talk.textContent = "トーク";
    learn.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></svg><span>メンバー</span>';
    nav.append(talk, learn);
    const section = document.createElement("section");
    section.className = "group-chat";
    section.innerHTML =
      '<div data-chat-studying></div><div class="group-chat-messages" role="log" aria-label="グループチャット" aria-live="polite"></div><p data-chat-status role="status"></p><button type="button" data-chat-reconnect hidden>再接続</button><form class="group-chat-compose"><button type="button" class="group-chat-tool" data-chat-quiz aria-label="単語クイズを出す">Q</button><textarea maxlength="1000" rows="1" aria-label="メッセージ" placeholder="メッセージを入力"></textarea><button type="submit">送信</button></form>';
    const content = dialog.querySelector(".group-content");
    content.before(nav, section);
    const select = (chat) => {
      section.hidden = !chat;
      content.hidden = chat;
      talk.setAttribute("aria-pressed", String(chat));
      learn.setAttribute("aria-pressed", String(!chat));
    };
    talk.onclick = () => {
      select(true);
      state.markRead?.();
    };
    learn.onclick = () => select(false);
    select(true);
    const list = section.querySelector("[role=log]"),
      status = section.querySelector("[data-chat-status]"),
      form = section.querySelector("form"),
      text = form.querySelector("textarea"),
      send = form.querySelector("button[type=submit]");
    form.querySelector("[data-chat-quiz]").onclick = () =>
      root.TalkTools?.openQuizPicker((quiz) =>
        state.post?.("単語クイズ：" + quiz.word, { quiz }),
      );
    const draftKey = "core_v4_group_chat_draft_" + account + "_" + group.id;
    try {
      text.value = localStorage.getItem(draftKey) || "";
    } catch {}
    let draftTimer;
    state.flushDraft = () => {
      clearTimeout(draftTimer);
      try {
        if (text.value) localStorage.setItem(draftKey, text.value);
        else localStorage.removeItem(draftKey);
      } catch {}
    };
    // One line, as tall as the send button; grows with the text up to a few lines.
    const fit = () => {
      text.style.height = "auto";
      text.style.height = Math.min(text.scrollHeight + 2, 132) + "px";
    };
    text.addEventListener("input", () => {
      clearTimeout(draftTimer);
      draftTimer = setTimeout(state.flushDraft, 500);
      fit();
    });
    requestAnimationFrame(fit);
    const active = () => current === state && dialog.open && uid() === account;
    const ref = () =>
      root.fbCollection(root.db, "studyGroups", group.id, "messages");
    const query = (cursor, count = policy.maxMessages) =>
      root.fbQuery(
        ref(),
        root.fbOrderBy("createdAt", "desc"),
        ...(cursor ? [root.fbStartAfter(cursor)] : []),
        root.fbLimit(count),
      );
    function readers(item) {
      // Other members whose read mark is at or after this message.
      const marks = state.group.chatRead || {};
      return Object.keys(state.group.members || {}).filter(
        (id) => id !== item.ownerId && Number(marks[id]) >= item.sentAt,
      ).length;
    }
    function clock(at) {
      return new Date(at).toLocaleTimeString("ja-JP", {
        timeZone: "Asia/Tokyo",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    // Achievements (100語・30分ごと, group goals) are posted in the talk with a いいね button.
    function achievements() {
      const since = Date.now() - policy.lifetime;
      return (Array.isArray(state.group.events) ? state.group.events : [])
        .filter((item) => item && item.id && Number(item.at) > since)
        .map((item) => ({ ...item, kind: "event", sentAt: Number(item.at) }));
    }
    function eventRow(item) {
      const row = document.createElement("article"),
        text = document.createElement("p"),
        time = document.createElement("time"),
        likes = Object.keys(item.reactions || {}).length,
        liked = !!item.reactions?.[account],
        react = document.createElement("button"),
        name = state.group.members?.[item.owner]?.name || item.name || "";
      row.className = "group-chat-event";
      text.textContent = (name ? name + " · " : "") + item.text;
      time.textContent = clock(item.sentAt);
      time.dateTime = new Date(item.sentAt).toISOString();
      react.type = "button";
      react.textContent = "👏 " + (likes || "");
      react.setAttribute("aria-label", "いいね " + likes);
      react.setAttribute("aria-pressed", String(liked));
      react.onclick = async () => {
        react.disabled = true;
        try {
          await root.StudyGroups.react(group.id, item.id);
        } catch (error) {
          if (active()) status.textContent = error.message;
        } finally {
          react.disabled = false;
        }
      };
      row.append(text, time, react);
      return row;
    }
    function render() {
      if (current !== state) return;
      const atBottom =
          list.scrollHeight - list.scrollTop - list.clientHeight < 70,
        fragment = document.createDocumentFragment(),
        others = Math.max(0, Object.keys(state.group.members || {}).length - 1);
      for (const item of [...state.rows.values(), ...achievements()].sort(
        (a, b) => a.sentAt - b.sentAt || a.id.localeCompare(b.id),
      )) {
        if (item.kind === "event") {
          fragment.append(eventRow(item));
          continue;
        }
        const row = document.createElement("article");
        row.className =
          "group-chat-message" + (item.ownerId === account ? " is-self" : "");
        const name =
            state.group.members?.[item.ownerId]?.name ||
            item.name ||
            item.ownerId,
          copy = document.createElement("div"),
          author = document.createElement("small"),
          body = document.createElement("p"),
          meta = document.createElement("div"),
          time = document.createElement("time");
        author.textContent = name;
        // A word quiz shows its choices; other messages make English words tappable.
        if (item.quiz && root.TalkTools) {
          body.classList.add("has-quiz");
          body.append(root.TalkTools.quizBubble(item, group.id, state.group.members));
        } else if (root.TalkTools) body.append(root.TalkTools.wordify(item.text));
        else body.textContent = item.text;
        time.textContent = clock(item.sentAt);
        time.dateTime = new Date(item.sentAt).toISOString();
        meta.className = "group-chat-meta";
        if (item.ownerId === account && others) {
          const count = readers(item),
            read = document.createElement("span");
          if (count) {
            read.className = "group-chat-read";
            read.textContent = others === 1 ? "既読" : "既読 " + count;
            meta.append(read);
          }
        }
        meta.append(time);
        copy.append(author, body, meta);
        row.append(root.StudyGroups.memberAvatar(item.ownerId, name), copy);
        fragment.append(row);
      }
      list.replaceChildren(fragment);
      if (atBottom) list.scrollTop = list.scrollHeight;
      // Who is studying right now, above the talk.
      const banner = root.GroupStudy?.studyingBanner(state.group);
      section.querySelector("[data-chat-studying]").replaceChildren(...(banner ? [banner] : []));
    }
    state.render = render;
    // Keep the "studying for N minutes" line current while the talk is open.
    state.clock = setInterval(() => active() && render(), 60000);
    // While the talk is on screen, record that this member has read up to the newest message.
    let reading = false;
    state.markRead = () => {
      if (!active() || section.hidden || document.hidden) return;
      const latest = Math.max(
        0,
        ...[...state.rows.values()].map((item) => item.sentAt),
        ...achievements().map((item) => item.sentAt),
      );
      if (!latest) return;
      root.StudyGroups?.markSeen?.(group.id, latest);
      const mine = Number(state.group.chatRead?.[account]) || 0,
        fromOthers = [...state.rows.values()].some(
          (item) => item.ownerId !== account && item.sentAt > mine,
        );
      if (
        !fromOthers ||
        reading ||
        typeof root.fbSetDoc !== "function" ||
        root.FirestoreReadGuard?.paused?.()
      )
        return;
      reading = true;
      Promise.resolve()
        .then(() =>
          root.fbSetDoc(
          root.fbDoc(root.db, "studyGroups", group.id),
          { chatRead: { [account]: latest } },
          { merge: true },
          ),
        )
        .catch(() => {})
        .finally(() => (reading = false));
    };
    async function removeDocs(docs) {
      const pending = docs.filter((doc) => !state.deleting.has(doc.id));
      if (!pending.length || !active() || root.FirestoreReadGuard?.paused?.())
        return;
      pending.forEach((doc) => state.deleting.add(doc.id));
      try {
        await deadline(
          root.fbRunTransaction(root.db, async (tx) => {
            const g = await tx.get(
                root.fbDoc(root.db, "studyGroups", group.id),
              ),
              user = await tx.get(root.fbDoc(root.db, "users", account));
            if (
              !active() ||
              !g.exists() ||
              !g.data().members?.[account] ||
              !user.exists() ||
              user.data().deleted
            )
              return;
            for (const doc of pending)
              tx.delete(
                doc.ref ||
                  root.fbDoc(
                    root.db,
                    "studyGroups",
                    group.id,
                    "messages",
                    doc.id,
                  ),
              );
          }),
        );
      } catch {
        if (active())
          status.textContent =
            "古いトークの削除は、次にグループを開いた時に再試行します。";
      } finally {
        pending.forEach((doc) => state.deleting.delete(doc.id));
      }
    }
    function expire() {
      clearTimeout(state.expiryTimer);
      if (!active()) return;
      const before = [...state.rows.values()],
        kept = policy.retained(before),
        ids = new Set(kept.map((item) => item.id));
      state.rows = new Map(kept.map((item) => [item.id, item]));
      render();
      removeDocs(before.filter((item) => !ids.has(item.id))).catch(() => {});
      if (kept.length)
        state.expiryTimer = setTimeout(
          expire,
          Math.max(
            1,
            Math.min(
              ...kept.map((item) => policy.time(item) + policy.lifetime),
            ) -
              Date.now() +
              1,
          ),
        );
    }
    async function cleanOlder(docs) {
      if (docs.length < policy.maxMessages) return;
      let cursor = docs.at(-1);
      while (active() && !root.FirestoreReadGuard?.paused?.()) {
        const older = await deadline(root.fbGetDocs(query(cursor, 50)));
        if (!active()) return;
        if (!older.docs?.length) return;
        await removeDocs(older.docs);
        if (older.docs.length < 50) return;
        cursor = older.docs.at(-1);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    function receive(snap) {
      if (!active()) return;
      const docs = snap.docs || [],
        all = docs.map((doc) => ({ ...doc.data(), id: doc.id, ref: doc.ref })),
        kept = policy.retained(all),
        ids = new Set(kept.map((item) => item.id));
      state.rows = new Map(
        kept
          .filter((item) => typeof item.text === "string" && item.ownerId)
          .map((item) => (item.quiz && !validQuiz(item.quiz) ? { ...item, quiz: undefined } : item))
          .map((item) => [
            item.id,
            {
              ...item,
              text: item.text.slice(0, 1000),
              sentAt: policy.time(item),
            },
          ]),
      );
      status.textContent = "";
      section.querySelector("[data-chat-reconnect]").hidden = true;
      expire();
      state.markRead();
      removeDocs(docs.filter((doc) => !ids.has(doc.id))).catch(() => {});
      if (!state.cleaned) {
        state.cleaned = true;
        cleanOlder(docs).catch(() => {
          if (active())
            status.textContent = "古いトークの削除は次回に再試行します。";
        });
      }
    }
    function listen() {
      state.unsubscribe?.();
      status.textContent = "読み込み中…";
      state.unsubscribe = root.fbOnSnapshot(
        query(),
        (snap) => receive(snap),
        (e) => {
          if (active()) {
            status.textContent = "チャットを取得できませんでした。" + e.message;
            section.querySelector("[data-chat-reconnect]").hidden = false;
          }
        },
      );
    }
    state.resume = listen;
    section.querySelector("[data-chat-reconnect]").onclick = () => {
      if (!root.FirestoreReadGuard?.paused?.()) listen();
      else
        status.textContent =
          "クラウド利用制限中です。入力内容を残して、時間を置いて再接続してください。";
    };
    let pendingId = null,
      pendingText = "";
    form.onsubmit = (e) => {
      e.preventDefault();
      post(text.value.trim());
    };
    // Posts a message; `extra` carries a word quiz (talk-tools.js). Returns whether it was sent.
    async function post(value, extra = null) {
      if (!value || state.sending || !active()) return false;
      if (root.FirestoreReadGuard?.paused?.()) {
        status.textContent =
          "クラウドの利用制限中です。入力内容を残しています。";
        return;
      }
      state.sending = true;
      send.disabled = true;
      status.textContent = "送信中…";
      const key = value + (extra ? JSON.stringify(extra) : "");
      if (!pendingId || pendingText !== key) {
        pendingId = crypto.randomUUID();
        pendingText = key;
      }
      const messageId = pendingId;
      let expired = false;
      try {
        await deadline(
          root.fbRunTransaction(root.db, async (tx) => {
            const g = await tx.get(
                root.fbDoc(root.db, "studyGroups", group.id),
              ),
              user = await tx.get(root.fbDoc(root.db, "users", account)),
              existing = await tx.get(
                root.fbDoc(
                  root.db,
                  "studyGroups",
                  group.id,
                  "messages",
                  messageId,
                ),
              );
            if (
              expired ||
              !active() ||
              !g.exists() ||
              !g.data().members?.[account] ||
              !user.exists() ||
              user.data().deleted
            )
              throw Error("グループの参加状態を確認してください。");
            if (existing.exists()) return;
            const previous = Array.isArray(g.data().chatRecent)
              ? g.data().chatRecent
              : [...state.rows.values()].map((item) => ({
                  id: item.id,
                  at: policy.time(item),
                }));
            const now =
              Math.max(
                Date.now(),
                ...previous.map((item) => Number(item.at) || 0),
              ) + 1;
            const recent = [
                ...previous.filter(
                  (item) =>
                    item.id !== messageId && item.at > now - policy.lifetime,
                ),
                { id: messageId, at: now, by: account },
              ]
                .sort((a, b) => b.at - a.at || b.id.localeCompare(a.id))
                .slice(0, policy.maxMessages),
              ids = new Set(recent.map((item) => item.id));
            for (const item of previous)
              if (!ids.has(item.id))
                tx.delete(
                  root.fbDoc(
                    root.db,
                    "studyGroups",
                    group.id,
                    "messages",
                    item.id,
                  ),
                );
            tx.set(
              root.fbDoc(root.db, "studyGroups", group.id),
              { chatRecent: recent, chatRead: { [account]: now } },
              { merge: true },
            );
            // Each member's group list shows the talk as unread until they open it.
            for (const member of Object.keys(g.data().members))
              tx.set(
                root.fbDoc(root.db, "users", member, "studyGroups", group.id),
                { chatAt: now, chatBy: account },
                { merge: true },
              );
            tx.set(
              root.fbDoc(
                root.db,
                "studyGroups",
                group.id,
                "messages",
                messageId,
              ),
              {
                ownerId: account,
                name: g.data().members[account].name || account,
                text: value,
                ...(extra?.quiz ? { quiz: extra.quiz } : {}),
                sentAt: now,
                expiresAt: new Date(now + policy.lifetime),
                createdAt: root.fbServerTimestamp(),
              },
            );
          }),
        );
        pendingId = null;
        if (active()) {
          if (!extra && text.value.trim() === value) text.value = "";
          state.flushDraft();
          fit();
          status.textContent = "送信しました。";
        }
        return true;
      } catch (error) {
        if (active())
          status.textContent =
            "送信できませんでした。" + (extra ? "" : "入力内容を残しています。") + error.message;
        return false;
      } finally {
        expired = true;
        state.sending = false;
        send.disabled = false;
      }
    }
    state.post = post;
    const update = dialog.querySelector("[data-group-status]");
    if (update)
      update.before(
        document.createComment(
          "Chat connection is separate from learning updates.",
        ),
      );
    dialog.addEventListener(
      "close",
      () => {
        if (current === state) stop();
      },
      { once: true },
    );
    listen();
  }
  root.GroupChat = { mount, stop };
  root.addEventListener("pagehide", () => current?.flushDraft?.());
  root.addEventListener("cloud-quota-paused", () => {
    if (current) {
      current.unsubscribe?.();
      current.unsubscribe = null;
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && current) {
      current.unsubscribe?.();
      current.unsubscribe = null;
    } else if (
      current &&
      !current.unsubscribe &&
      !root.FirestoreReadGuard?.paused?.()
    )
      current.resume();
  });
})(window);
