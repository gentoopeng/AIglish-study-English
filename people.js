(function () {
  const WEEK = 7 * 86400000;
  function timestamp(value) {
    if (value && typeof value.toMillis === "function") return value.toMillis();
    if (value && typeof value.seconds === "number") return value.seconds * 1000;
    return typeof value === "number" ? value : Date.parse(value || "") || 0;
  }
  function active(doc, now) {
    const stats = window.StudyTimeModel.readStats(doc),
      time = timestamp(
        doc.lastActiveAt ||
          stats.lastLoginAt ||
          doc.lastLoginAt ||
          doc.updatedAt,
      );
    return time > 0 && time <= now && now - time <= WEEK;
  }
  // Active within the last 15 minutes (the app checks in every 5 minutes while open).
  const ONLINE = 15 * 60000;
  function online(time, now = Date.now()) {
    return time > 0 && time <= now + 60000 && now - time <= ONLINE;
  }
  // A small green dot on an avatar for someone online.
  function onlineDot(avatar, time) {
    avatar.querySelector(".online-dot")?.remove();
    if (!online(time)) return avatar;
    const dot = document.createElement("span");
    dot.className = "online-dot";
    dot.setAttribute("role", "img");
    dot.setAttribute("aria-label", "オンライン");
    avatar.classList.add("has-online-dot");
    avatar.append(dot);
    return avatar;
  }
  window.PeopleModel = { timestamp, active, online, onlineDot };
  let owner = "",
    users = [],
    loadedAt = 0,
    shownFromCache = false,
    pending = null,
    cacheVersion = 0,
    deletedIds = new Set();
  const uid = () => myId || "GUEST-000";
  // The list as last loaded is kept on the device, so the tab shows it at once on the next
  // launch while a fresh copy loads behind it. Photos are dropped from the copy if it gets big.
  const listName = (id) => "aiglish_people_list_" + id;
  function keepList(id, list, removed) {
    try {
      let text = JSON.stringify({ at: Date.now(), users: list, deleted: [...removed] });
      if (text.length > 1500000) text = JSON.stringify({ at: Date.now(), users: list.map((p) => ({ ...p, avatar: "" })), deleted: [...removed] });
      localStorage.setItem(listName(id), text);
    } catch {}
  }
  function keptList(id) {
    try {
      const saved = JSON.parse(localStorage.getItem(listName(id)) || "null");
      if (!saved || !Array.isArray(saved.users)) return null;
      return { users: saved.users.filter((p) => p && typeof p.id === "string"), deleted: new Set(Array.isArray(saved.deleted) ? saved.deleted : []) };
    } catch {
      return null;
    }
  }
  const detailCache = new Map(),
    detailJobs = new Map();
  async function detailSnapshot(id) {
    const key = uid() + "\n" + id,
      account = uid(),
      version = cacheVersion,
      cached = detailCache.get(key);
    if (id !== account && cached && Date.now() - cached.at < 300000)
      return cached.snap;
    if (detailJobs.has(key)) return detailJobs.get(key);
    const task = (async () => {
      const snap = await window.fbGetDoc(window.fbDoc(window.db, "users", id));
      if (account === uid() && version === cacheVersion && snap.exists())
        window.ProfileIdentityCache?.remember(id, snap.data());
      if (account === uid() && version === cacheVersion && id !== account) {
        detailCache.delete(key);
        detailCache.set(key, { at: Date.now(), snap });
        while (detailCache.size > 3)
          detailCache.delete(detailCache.keys().next().value);
      }
      return snap;
    })();
    detailJobs.set(key, task);
    try {
      return await task;
    } finally {
      if (detailJobs.get(key) === task) detailJobs.delete(key);
    }
  }
  // A profile comes up at once from what the user list already has, then is filled again with
  // the latest copy (and, for this player, the latest ranking) when it arrives.
  async function detail(person) {
    const account = uid(),
      version = cacheVersion;
    if (person.doc?.deleted) return deleted();
    const dialog = window.openLibraryDialog(
      "プロフィール",
      '<div class="people-detail-person"></div><dl class="people-detail-data"></dl><div class="library-editor-actions"><button type="button" data-library-close>閉じる</button></div>',
    );
    dialog.querySelector(".library-editor-eyebrow").textContent = "";
    fill(dialog, person, person.doc || {}, !person.doc);
    let latest = person.doc || {};
    try {
      if (window.db && window.fbGetDoc) {
        const [snap] = await Promise.all([
          detailSnapshot(person.id),
          person.id === account ? window.LearningRanking.sync() : null,
        ]);
        if (uid() !== account || version !== cacheVersion || !dialog.isConnected) return;
        if (snap.exists()) latest = snap.data();
      }
    } catch (error) {
      console.warn("最新のプロフィールを取得できませんでした", error);
    }
    if (!dialog.isConnected) return;
    if (latest.deleted) {
      window.closeLibraryDialog?.();
      return deleted();
    }
    fill(dialog, person, latest, false);
  }
  function deleted() {
    window.openLibraryDialog(
      "削除済み",
      '<p>このアカウントは削除されています。</p><button type="button" data-library-close>閉じる</button>',
    );
  }
  function fill(dialog, person, doc, loading) {
    const account = uid(),
      stats = window.StudyTimeModel.readStats(doc),
      time = timestamp(
        doc.lastActiveAt ||
          stats.lastLoginAt ||
          doc.updatedAt ||
          person.timestamp,
      );
    const header = dialog.querySelector(".people-detail-person"),
      list = dialog.querySelector("dl"),
      name = document.createElement("h3");
    header.replaceChildren();
    list.replaceChildren();
    dialog.querySelector(".people-loans")?.remove();
    window.RankingVisuals.name(name, doc.playerName || person.name);
    header.append(
      window.RankingVisuals.avatar(
        doc.avatar || person.avatar,
        doc.playerName || person.name,
      ),
      name,
    );
    const ranking = window.LearningRankingModel.merge(
      window.LearningRankingModel.fromProfile(doc),
      person.id === account ? window.LearningRanking.snapshot() : null,
    );
    const later = (value) => (loading ? "…" : value);
    [
      ["ポイント", (person.id === account ? window.StudyPoints?.balance() || 0 : Number(doc.studyPoints) || 0).toLocaleString("ja-JP") + "pt"],
      ["ID", person.id],
      [
        "最終アクティブ",
        later(time ? new Date(time).toLocaleString("ja-JP") : "記録なし"),
      ],
      [
        "合計勉強時間",
        later(Math.floor(
          window.StudyTimeModel.rankingSeconds(stats, "total", Date.now()) / 60,
        ) + "分"),
      ],
      ["理解度の記録", later(window.LearningRankingModel.wordCount(ranking) + "語")],
      ["フラッシュ", later(window.LearningRankingModel.flashCount(ranking) + "回")],
    ].forEach(([label, value]) => {
      const dt = document.createElement("dt"),
        dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = value;
      list.append(dt, dd);
    });
    // Lending points starts from the other person's profile.
    if (window.PointLoans && person.id !== account && account !== "GUEST-000") {
      const loans = document.createElement("div");
      loans.className = "people-loans";
      for (const [text, primary, mode] of [
        ["トーク", true, null],
        ["貸す", false, "lend"],
        ["借りたいと頼む", false, "borrow"],
      ]) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = text;
        if (primary) b.className = "library-editor-primary";
        b.onclick = () => {
          window.closeLibraryDialog?.();
          window.PointLoans.person(person.id, doc.playerName || person.name, mode ? { mode } : undefined);
        };
        loans.append(b);
      }
      dialog.querySelector(".library-editor-actions").before(loans);
    }
  }
  // "たった今", "12分前", "3時間前", "2日前".
  function ago(time, now = Date.now()) {
    if (!time) return "";
    const minutes = Math.max(0, Math.floor((now - time) / 60000));
    if (minutes < 1) return "たった今";
    if (minutes < 60) return minutes + "分前";
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + "時間前";
    return Math.floor(hours / 24) + "日前";
  }
  const studied = (seconds) => {
    const minutes = Math.floor((seconds || 0) / 60);
    return minutes >= 60 ? Math.floor(minutes / 60) + "時間" + (minutes % 60 ? (minutes % 60) + "分" : "") : minutes + "分";
  };
  function row(person) {
    const wrapper = document.createElement("div");
    wrapper.className = "people-row";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "people-profile-button";
    button.setAttribute("aria-label", person.name + "のプロフィール");
    const name = document.createElement("span");
    name.className = "people-name";
    window.RankingVisuals.name(
      name,
      person.name,
      person.doc && person.doc.profileCustomizationJson,
    );
    button.append(
      onlineDot(
        window.RankingVisuals.avatar(
          person.avatar,
          person.name,
          person.doc && person.doc.profileCustomizationJson,
        ),
        person.id === uid() ? 0 : person.timestamp,
      ),
      name,
    );
    // Under the name: online or how long ago, today's study time, and a friend mark.
    const isOnline = person.id !== uid() && online(person.timestamp);
    const meta = document.createElement("small");
    meta.className = "people-meta";
    const when = document.createElement("span");
    when.className = isOnline ? "is-online" : "";
    when.textContent = isOnline ? "オンライン" : ago(person.timestamp);
    meta.append(when);
    if (person.today >= 60) {
      const today = document.createElement("span");
      today.className = "people-today";
      today.textContent = "今日 " + studied(person.today);
      meta.append(today);
    }
    if (person.friend) {
      const mark = document.createElement("span");
      mark.className = "people-friend";
      mark.textContent = "フレンド";
      meta.append(mark);
    }
    name.after(meta);
    const text = document.createElement("span");
    text.className = "people-text";
    name.before(text);
    text.append(name, meta);
    button.onclick = () => window.People.open(person.id);
    wrapper.append(button);
    return wrapper;
  }
  // A different account (or the first look) starts from that account's list kept on the device.
  function ensureOwner() {
    if (owner === uid()) return;
    owner = uid();
    const kept = owner === "GUEST-000" ? null : keptList(owner);
    users = kept ? kept.users : [];
    loadedAt = 0;
    deletedIds = kept ? kept.deleted : new Set();
    shownFromCache = !!kept;
    detailCache.clear();
    detailJobs.clear();
  }
  function render() {
    const host = document.getElementById("friendListContainer");
    if (!host) return;
    ensureOwner();
    host.replaceChildren();
    const query = (document.getElementById("usersSearch")?.value || "").trim().toLowerCase();
    const all = users
      .filter((person) => !deletedIds.has(person.id))
      .sort((a, b) => b.timestamp - a.timestamp || a.id.localeCompare(b.id));
    const list = query ? all.filter((person) => String(person.name).toLowerCase().includes(query)) : all;
    const count = document.getElementById("usersCount");
    if (count) count.textContent = loadedAt || shownFromCache ? all.length + "人" : "";
    // Online first, then everyone active this week (friends included even when quiet).
    const now = Date.now(),
      groups = [
        ["オンライン", list.filter((person) => person.id !== uid() && online(person.timestamp, now))],
        ["最近", list.filter((person) => !(person.id !== uid() && online(person.timestamp, now)))],
      ];
    let index = 0;
    for (const [title, people] of groups) {
      if (!people.length) continue;
      const heading = document.createElement("h3");
      heading.className = "people-section-heading";
      heading.textContent = title + "（" + people.length + "）";
      host.append(heading);
      for (const person of people) {
        const item = row(person, false);
        item.style.setProperty("--i", Math.min(index++, 12));
        host.append(item);
      }
    }
    if (!list.length) {
      const hint = document.createElement("p");
      hint.className = "people-hint";
      // A guest, or a device off the cloud, never gets a list: say so instead of 読み込み中 forever.
      hint.textContent =
        query && all.length
          ? "「" + query + "」に一致するユーザーはいません。"
          : loadedAt || shownFromCache
            ? "ユーザーがいません。"
            : uid() === "GUEST-000"
              ? "ログインすると、ほかのユーザーが表示されます。"
              : !window.db
                ? "オフラインのため読み込めません。つながったら右上の更新で読み込めます。"
                : "読み込み中…";
      host.append(hint);
    }
  }
  async function refresh(force) {
    const status = document.getElementById("usersStatus");
    if (status) status.textContent = "";
    if (force) {
      detailCache.clear();
    }
    ensureOwner();
    if (!force && Date.now() - loadedAt < 900000) {
      render();
      return;
    }
    if (pending) return pending;
    const account = owner,
      version = cacheVersion;
    pending = (async () => {
      try {
        if (!window.db || !window.fbGetDocs) return;
        const list = [],
          removed = new Set();
        const status = document.getElementById("usersStatus");
        if (status && users.length) status.textContent = "更新しています…";
        const visit = (id, data) => {
            if (data.deleted) {
              removed.add(id);
              return;
            }
            if (id === "GUEST-000") return;
            const stats = window.StudyTimeModel.readStats(data),
              time = timestamp(
                data.lastActiveAt ||
                  stats.lastLoginAt ||
                  data.lastLoginAt ||
                  data.updatedAt,
              );
            const friend = (myFriendList || []).some(
              (item) => item.code === id,
            );
            if (
              !friend &&
              !(time > 0 && time <= Date.now() && Date.now() - time <= WEEK)
            )
              return;
            list.push({
              id,
              name: data.playerName || data.userName || data.name || id,
              avatar:
                typeof data.avatar === "string" && data.avatar.length <= 48000
                  ? data.avatar
                  : "",
              timestamp: time,
              friend,
              today: window.StudyTimeModel.rankingSeconds(stats, "daily", Date.now()),
              doc: {
                lastActiveAt: time,
              },
            });
          };
        const current = () =>
          version === cacheVersion &&
          uid() === account &&
          currentActiveTabId === "community" &&
          document.visibilityState === "visible";
        // Only players active this week (and friends) are listed, so only they are read, with
        // just the fields the list shows. Without the REST endpoint, every user is scanned.
        const controller = new AbortController(),
          timer = setTimeout(() => controller.abort(), 15000);
        let rows = null;
        try {
          rows = await window.UserDirectory.recent?.(
            Date.now() - WEEK,
            (myFriendList || []).map((friend) => friend.code),
            { signal: controller.signal },
          );
        } finally {
          clearTimeout(timer);
        }
        if (rows) {
          for (const row of rows) visit(row.id, row.data);
        } else await window.UserDirectory.scan(visit, current);
        if (status) status.textContent = "";
        if (uid() === account && version === cacheVersion) {
          users = list;
          deletedIds = removed;
          loadedAt = Date.now();
          shownFromCache = false;
          keepList(account, list, removed);
          let changed = false;
          for (const friend of myFriendList || []) {
            const person = list.find((item) => item.id === friend.code);
            if (
              person &&
              (friend.name !== person.name ||
                friend.customAvatar !== person.avatar ||
                friend.timestamp !== person.timestamp)
            ) {
              friend.name = person.name;
              friend.customAvatar = person.avatar;
              friend.timestamp = person.timestamp;
              changed = true;
            }
          }
          if (changed) {
            localStorage.setItem(
              "core_v4_friend_list",
              JSON.stringify(myFriendList),
            );
          }
          render();
        }
      } catch (error) {
        console.warn("ユーザー一覧の取得は次回に再試行します", error);
        const status = document.getElementById("usersStatus");
        if (status)
          status.textContent = "取得できませんでした。更新で再試行できます。";
      }
    })();
    // Cleared once the load has really finished. (Clearing it inside the load ran before this
    // assignment when the load ended without waiting, e.g. before the cloud was ready, and left
    // a finished load in place that blocked every later one, the 更新 button included.)
    const job = pending;
    job.finally(() => {
      if (pending === job) pending = null;
    });
    return job;
  }
  window.refreshUsersFromButton = async (button) => {
    if (button.disabled) return;
    button.disabled = true;
    try {
      await refresh(true);
    } finally {
      button.disabled = false;
    }
  };
  window.sortAndRenderFriendList = render;
  window.People = {
    invalidate() {
      cacheVersion++;
      pending = null;
      users = [];
      loadedAt = 0;
      shownFromCache = false;
      try {
        localStorage.removeItem(listName(uid()));
      } catch {}
      detailCache.clear();
      detailJobs.clear();
    },
    list: () => (owner === uid() ? users.map((person) => ({ ...person })) : []),
    // Another signed-in player opens as a talk (point-loans.js), with the profile a tap away;
    // this player, a guest, or { profile: true } opens the profile.
    open(id, options) {
      const person = users.find((p) => p.id === id) || { id, name: id, avatar: "" };
      if (!options?.profile && id !== uid() && uid() !== "GUEST-000" && window.PointLoans?.person)
        return window.PointLoans.person(id, person.doc?.playerName || person.name);
      return detail(person);
    },
    render,
    refresh,
    preview: (id) =>
      owner === uid() && Date.now() - loadedAt < 900000
        ? users.find((person) => person.id === id)
        : undefined,
  };
  window.onTabChange((tab) => {
    if (tab === "community") {
      render();
      if (!document.getElementById("communityFriends")?.hidden) refresh(false);
    }
  });
  let heartbeatOwner = "",
    heartbeatAt = 0;
  async function heartbeat() {
    const account = uid(),
      gate = document.getElementById("auth-gate-screen");
    if (
      account === "GUEST-000" ||
      !account ||
      document.visibilityState !== "visible" ||
      (gate && getComputedStyle(gate).display !== "none") ||
      !window.db ||
      !window.fbSetDoc
    )
      return;
    if (heartbeatOwner === account && Date.now() - heartbeatAt < 300000) return;
    try {
      await window.fbSetDoc(
        window.fbDoc(window.db, "users", account),
        {
          lastActiveAt: new Date().toISOString(),
          ...(heartbeatOwner !== account
            ? { lastLoginAt: new Date().toISOString() }
            : {}),
        },
        { merge: true },
      );
      if (uid() === account) {
        heartbeatOwner = account;
        heartbeatAt = Date.now();
      }
    } catch (error) {
      console.warn("アクティブ日時は次回に同期します", error);
    }
  }
  window.onAppLoaded(() => {
    render();
    heartbeat();
  });
  setInterval(heartbeat, 300000);

  // The same directory includes inactive friends; do not fetch every friend again.
  window.refreshFriendListFromFirebase = function (force) {
    return refresh(!!force);
  };
})();
