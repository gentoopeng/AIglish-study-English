// Subscribe to only the latest 10 messages, no older than seven days while this group's dialog is open.
(function (root) {
  "use strict";
  let current = null;
  const policy = root.GroupChatPolicy;
  const uid = () => (typeof myId === "string" ? myId : "GUEST-000");
  function stop() {
    if (!current) return;
    clearTimeout(current.expiryTimer);
    current.unsubscribe?.();
    current.flushDraft?.();
    current = null;
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
      current.group = group;
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
      '<div class="group-chat-messages" role="log" aria-label="グループチャット" aria-live="polite"></div><p data-chat-status role="status"></p><button type="button" data-chat-reconnect hidden>再接続</button><form class="group-chat-compose"><textarea maxlength="1000" rows="2" aria-label="メッセージ" placeholder="メッセージを入力"></textarea><button type="submit">送信</button></form>';
    const content = dialog.querySelector(".group-content");
    content.before(nav, section);
    const select = (chat) => {
      section.hidden = !chat;
      content.hidden = chat;
      talk.setAttribute("aria-pressed", String(chat));
      learn.setAttribute("aria-pressed", String(!chat));
    };
    talk.onclick = () => select(true);
    learn.onclick = () => select(false);
    select(true);
    const list = section.querySelector("[role=log]"),
      status = section.querySelector("[data-chat-status]"),
      form = section.querySelector("form"),
      text = form.querySelector("textarea"),
      send = form.querySelector("button");
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
    text.addEventListener("input", () => {
      clearTimeout(draftTimer);
      draftTimer = setTimeout(state.flushDraft, 500);
    });
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
    function render() {
      const atBottom =
          list.scrollHeight - list.scrollTop - list.clientHeight < 70,
        fragment = document.createDocumentFragment();
      for (const item of [...state.rows.values()].sort(
        (a, b) => a.sentAt - b.sentAt || a.id.localeCompare(b.id),
      )) {
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
          time = document.createElement("time");
        author.textContent = name;
        body.textContent = item.text;
        time.textContent = new Date(item.sentAt).toLocaleTimeString("ja-JP", {
          timeZone: "Asia/Tokyo",
          hour: "2-digit",
          minute: "2-digit",
        });
        time.dateTime = new Date(item.sentAt).toISOString();
        copy.append(author, body, time);
        row.append(root.StudyGroups.memberAvatar(item.ownerId, name), copy);
        fragment.append(row);
      }
      list.replaceChildren(fragment);
      if (atBottom) list.scrollTop = list.scrollHeight;
    }
    async function removeDocs(docs) {
      const pending = docs.filter((doc) => !state.deleting.has(doc.id));
      if (!pending.length || !active() || root.FirestoreReadGuard?.paused())
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
      while (active() && !root.FirestoreReadGuard?.paused()) {
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
      if (!root.FirestoreReadGuard?.paused()) listen();
      else
        status.textContent =
          "クラウド利用制限中です。入力内容を残して、時間を置いて再接続してください。";
    };
    let pendingId = null,
      pendingText = "";
    form.onsubmit = async (e) => {
      e.preventDefault();
      const value = text.value.trim();
      if (!value || state.sending || !active()) return;
      if (root.FirestoreReadGuard?.paused()) {
        status.textContent =
          "クラウドの利用制限中です。入力内容を残しています。";
        return;
      }
      state.sending = true;
      send.disabled = true;
      status.textContent = "送信中…";
      if (!pendingId || pendingText !== value) {
        pendingId = crypto.randomUUID();
        pendingText = value;
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
                { id: messageId, at: now },
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
              { chatRecent: recent },
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
                sentAt: now,
                expiresAt: new Date(now + policy.lifetime),
                createdAt: root.fbServerTimestamp(),
              },
            );
          }),
        );
        pendingId = null;
        if (active()) {
          if (text.value.trim() === value) text.value = "";
          state.flushDraft();
          status.textContent = "送信しました。";
        }
      } catch (error) {
        if (active())
          status.textContent =
            "送信できませんでした。入力内容を残しています。" + error.message;
      } finally {
        expired = true;
        state.sending = false;
        send.disabled = false;
      }
    };
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
      !root.FirestoreReadGuard?.paused()
    )
      current.resume();
  });
})(window);
