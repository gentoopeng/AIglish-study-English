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
    pending = null,
    cacheVersion = 0,
    deletedIds = new Set();
  const uid = () => myId || "GUEST-000";
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
  async function detail(person) {
    const account = uid(),
      version = cacheVersion;
    let detailDoc = person.doc || {};
    try {
      if (window.db && window.fbGetDoc) {
        if (person.id === account) await window.LearningRanking.sync();
        const snap = await detailSnapshot(person.id);
        if (uid() !== account || version !== cacheVersion) return;
        if (snap.exists()) {
          detailDoc = snap.data();
        }
      }
    } catch (error) {
      console.warn("最新のプロフィールを取得できませんでした", error);
    }
    if (detailDoc.deleted) {
      window.openLibraryDialog(
        "削除済み",
        '<p>このアカウントは削除されています。</p><button type="button" data-library-close>閉じる</button>',
      );
      return;
    }
    const doc = detailDoc,
      stats = window.StudyTimeModel.readStats(doc),
      time = timestamp(
        doc.lastActiveAt ||
          stats.lastLoginAt ||
          doc.updatedAt ||
          person.timestamp,
      );
    const dialog = window.openLibraryDialog(
      "プロフィール",
      '<div class="people-detail-person"></div><dl class="people-detail-data"></dl><div class="library-editor-actions"><button type="button" data-library-close>閉じる</button></div>',
    );
    dialog.querySelector(".library-editor-eyebrow").textContent = "";
    const header = dialog.querySelector(".people-detail-person"),
      name = document.createElement("h3");
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
    [
      ["ポイント", (person.id === account ? window.StudyPoints?.balance() || 0 : Number(doc.studyPoints) || 0).toLocaleString("ja-JP") + "pt"],
      ["ID", person.id],
      [
        "最終アクティブ",
        time ? new Date(time).toLocaleString("ja-JP") : "記録なし",
      ],
      [
        "合計勉強時間",
        Math.floor(
          window.StudyTimeModel.rankingSeconds(stats, "total", Date.now()) / 60,
        ) + "分",
      ],
      ["理解度の記録", window.LearningRankingModel.wordCount(ranking) + "語"],
      ["フラッシュ", window.LearningRankingModel.flashCount(ranking) + "回"],
    ].forEach(([label, value]) => {
      const dt = document.createElement("dt"),
        dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = value;
      dialog.querySelector("dl").append(dt, dd);
    });
    // Lending points starts from the other person's profile.
    if (window.PointLoans && person.id !== account && account !== "GUEST-000") {
      const loans = document.createElement("div");
      loans.className = "people-loans";
      for (const [text, primary] of [
        ["貸す", true],
        ["借りたいと頼む", false],
      ]) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = text;
        if (primary) b.className = "library-editor-primary";
        b.onclick = () => {
          window.closeLibraryDialog?.();
          window.PointLoans.person(person.id, doc.playerName || person.name);
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
    button.onclick = () => detail(person);
    wrapper.append(button);
    return wrapper;
  }
  function render() {
    const host = document.getElementById("friendListContainer");
    if (!host) return;
    host.replaceChildren();
    const query = (document.getElementById("usersSearch")?.value || "").trim().toLowerCase();
    const all = users
      .filter((person) => !deletedIds.has(person.id))
      .sort((a, b) => b.timestamp - a.timestamp || a.id.localeCompare(b.id));
    const list = query ? all.filter((person) => String(person.name).toLowerCase().includes(query)) : all;
    const count = document.getElementById("usersCount");
    if (count) count.textContent = loadedAt ? all.length + "人" : "";
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
      hint.textContent = query && all.length ? "「" + query + "」に一致するユーザーはいません。" : loadedAt ? "ユーザーがいません。" : "読み込み中…";
      host.append(hint);
    }
  }
  async function refresh(force) {
    const status = document.getElementById("usersStatus");
    if (status) status.textContent = "";
    if (force) {
      detailCache.clear();
    }
    if (owner !== uid()) {
      owner = uid();
      users = [];
      loadedAt = 0;
      deletedIds = new Set();
      detailCache.clear();
      detailJobs.clear();
    }
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
        await window.UserDirectory.scan(
          (id, data) => {
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
          },
          () =>
            version === cacheVersion &&
            uid() === account &&
            currentActiveTabId === "community" &&
            document.visibilityState === "visible",
        );
        if (uid() === account && version === cacheVersion) {
          users = list;
          deletedIds = removed;
          loadedAt = Date.now();
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
      } finally {
        if (version === cacheVersion) pending = null;
      }
    })();
    return pending;
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
      detailCache.clear();
      detailJobs.clear();
    },
    list: () => (owner === uid() ? users.map((person) => ({ ...person })) : []),
    open: (id) =>
      detail(
        users.find((person) => person.id === id) || {
          id,
          name: id,
          avatar: "",
        },
      ),
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
