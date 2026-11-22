// Friends: one screen for the player's friends — this week's study ranking among friends, who is
// studying now, and the head-to-head duel record against each friend. Plus DuelRecords, the small
// on-device record of friend duels (casino.js writes it as each duel settles; money moves once per
// round there, and the record rides along).
(function (root) {
  "use strict";

  // ---- Duel records (this device) ----------------------------------------------------------
  // { seen: [round keys], vs: { [opponentId]: { name, w, l, d, at } } } — a round key is recorded
  // once, however often the table redraws. Kept small: the newest 300 rounds, 200 opponents.
  const DuelStore = {
    create(store) {
      const key = (id) => "aiglish_duel_records_" + id;
      const read = (id) => {
        try {
          const value = JSON.parse(store.get(key(id)) || "null");
          return value && typeof value === "object" ? value : {};
        } catch {
          return {};
        }
      };
      // entry: { key, opponent, name, result: "win"|"lose"|"draw", at }. Returns true when new.
      function record(id, entry) {
        if (!id || !entry || !entry.key || !entry.opponent || entry.opponent === id) return false;
        if (!["win", "lose", "draw"].includes(entry.result)) return false;
        const data = read(id),
          seen = Array.isArray(data.seen) ? data.seen : [];
        if (seen.includes(entry.key)) return false;
        const vs = data.vs && typeof data.vs === "object" ? data.vs : {},
          mine = vs[entry.opponent] || { name: "", w: 0, l: 0, d: 0, at: 0 };
        if (entry.result === "win") mine.w++;
        else if (entry.result === "lose") mine.l++;
        else mine.d++;
        if (entry.name) mine.name = String(entry.name).slice(0, 60);
        mine.at = Math.max(mine.at || 0, Number(entry.at) || 0);
        vs[entry.opponent] = mine;
        const opponents = Object.entries(vs).sort((a, b) => (b[1].at || 0) - (a[1].at || 0)).slice(0, 200);
        try {
          store.set(key(id), JSON.stringify({ seen: [...seen, entry.key].slice(-300), vs: Object.fromEntries(opponents) }));
        } catch {}
        return true;
      }
      const get = (id, opponent) => read(id).vs?.[opponent] || null;
      const all = (id) => read(id).vs || {};
      return { record, get, all };
    },
  };

  // ---- Pure helpers ------------------------------------------------------------------------
  // Studying now: active within the last 15 minutes (the app checks in every 5 minutes while
  // open, the same window the people list calls online) and has studied today.
  const studyingNow = (lastActive, todaySecs, now = Date.now()) =>
    lastActive > 0 && lastActive <= now + 60000 && now - lastActive <= 15 * 60000 && (todaySecs || 0) > 0;
  // Ranking rows: by this week's seconds, then today's, then name. `place` starts at 1.
  function rankRows(entries) {
    return [...entries]
      .sort((a, b) => (b.week || 0) - (a.week || 0) || (b.today || 0) - (a.today || 0) || String(a.name).localeCompare(String(b.name), "ja"))
      .map((entry, i) => ({ ...entry, place: i + 1 }));
  }
  const FriendsModel = { studyingNow, rankRows };

  const api = { DuelStore, FriendsModel };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window === "undefined" || root !== window) return;

  // ---- The screen ---------------------------------------------------------------------------
  const uid = () => (typeof myId === "string" && myId ? myId : "GUEST-000");
  const store = {
    get: (k) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set: (k, v) => {
      try {
        localStorage.setItem(k, v);
      } catch {}
    },
  };
  const duels = DuelStore.create(store);
  root.DuelRecords = Object.freeze({
    record: (entry) => duels.record(uid(), entry),
    get: (opponent) => duels.get(uid(), opponent),
    all: () => duels.all(uid()),
  });

  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const mins = (secs) => {
    const m = Math.floor((secs || 0) / 60);
    return m >= 60 ? Math.floor(m / 60) + "時間" + (m % 60 ? (m % 60) + "分" : "") : m + "分";
  };
  const FIELDS = ["playerName", "avatar", "profileCustomizationJson", "friendList", "deleted", "lastActiveAt", "studyPoints", "userStatsJson", "studyLedgerJson", "selectedTitle"];

  function person(id, doc, me, now) {
    const stats = root.StudyTimeModel.readStats(doc),
      lastActive = root.PeopleModel.timestamp(doc.lastActiveAt || stats.lastLoginAt || doc.lastLoginAt || doc.updatedAt),
      today = root.StudyTimeModel.rankingSeconds(stats, "daily", now),
      theirs = Array.isArray(doc.friendList) ? doc.friendList : [];
    return {
      id,
      name: doc.playerName || id,
      avatar: doc.avatar || "",
      custom: doc.profileCustomizationJson,
      mutual: theirs.some((f) => String(f?.code ?? f ?? "") === me),
      lastActive,
      online: root.PeopleModel.online(lastActive, now),
      studying: studyingNow(lastActive, today, now),
      today,
      week: root.StudyTimeModel.rankingSeconds(stats, "weekly", now),
      total: root.StudyTimeModel.rankingSeconds(stats, "total", now),
      points: Number(doc.studyPoints) || 0,
    };
  }

  // Adding, without leaving this screen: search by ID, see who it is, then add.
  function addSection(dialog) {
    const box = node("section", "fr-add");
    box.append(node("h3", "fr-title", "フレンドを追加"));
    const form = node("div", "fr-add-form");
    const input = node("input", "fr-add-input");
    input.type = "text";
    input.placeholder = "相手のID（相手のプロフィールに出ています）";
    input.setAttribute("aria-label", "追加したい相手のID");
    const go = node("button", "fr-add-go", "探す");
    go.type = "button";
    form.append(input, go);
    const result = node("div", "fr-add-result");
    box.append(form, result);
    const search = async () => {
      const id = input.value.trim().toUpperCase();
      result.replaceChildren();
      if (!id) return;
      if (id === uid()) {
        result.append(node("small", "fr-meta", "自分のIDです。"));
        return;
      }
      go.disabled = true;
      try {
        const snap = await root.fbGetDoc(root.fbDoc(root.db, "users", id));
        if (!snap.exists() || snap.data()?.deleted) {
          result.append(node("small", "fr-meta", "このIDのユーザーは見つかりません。"));
          return;
        }
        const p = person(id, snap.data(), uid(), Date.now());
        const row = node("div", "fr-found");
        const text = node("span", "fr-text");
        const nameEl = node("span", "fr-name-text");
        root.RankingVisuals.name(nameEl, p.name, p.custom);
        text.append(nameEl, node("small", "fr-meta", id + (p.mutual ? " ・ あなたを追加しています" : "")));
        row.append(root.RankingVisuals.avatar(p.avatar, p.name, p.custom), text);
        const mine = (typeof myFriendList !== "undefined" && Array.isArray(myFriendList) ? myFriendList : []).some((f) => f.code === id);
        if (mine) row.append(node("span", "fr-badge is-mutual", p.mutual ? "お互いフレンド" : "フレンド済み"));
        else {
          const add = node("button", "fr-add-btn", "フレンドに追加");
          add.type = "button";
          add.onclick = async () => {
            add.disabled = true;
            try {
              const name = await root.People.addFriend(id);
              result.replaceChildren(node("small", "fr-meta", "「" + name + "」を追加しました。"));
              setTimeout(() => dialog.isConnected && open(), 700);
            } catch (error) {
              result.replaceChildren(node("small", "fr-meta", error?.message || "追加できませんでした。"));
            }
          };
          row.append(add);
        }
        result.replaceChildren(row);
      } catch {
        result.append(node("small", "fr-meta", "通信できませんでした。"));
      } finally {
        go.disabled = false;
      }
    };
    go.onclick = search;
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") search();
    });
    return box;
  }

  // People whose friend list has me but whom I have not added yet: one tap to add back. From the
  // people tab's loaded list; when that has not loaded, a way to go and look instead.
  function addedMeSection(dialog) {
    const list = root.People?.list?.() || [],
      them = list.filter((p) => p.addedMe && !p.friend && p.id !== uid());
    if (!them.length && list.length) return null;
    const box = node("section", "fr-addedme");
    box.append(node("h3", "fr-title", "あなたを追加した人"));
    if (!them.length) {
      const go = node("button", "fr-add-btn", "ユーザータブで探す");
      go.type = "button";
      go.onclick = () => {
        root.closeLibraryDialog?.();
        root.switchTab?.("community");
      };
      box.append(node("p", "fr-wait", "まだ読み込んでいません。ユーザータブを開くと、追加してくれた人がここに出ます。"), go);
      return box;
    }
    for (const p of them) {
      const row = node("div", "fr-found");
      const text = node("span", "fr-text");
      text.append(node("span", "fr-name-text", p.name), node("small", "fr-meta", "あなたをフレンドに追加しています"));
      const add = node("button", "fr-add-btn", "追加する");
      add.type = "button";
      add.onclick = async () => {
        add.disabled = true;
        try {
          await root.People.addFriend(p.id);
          setTimeout(() => dialog.isConnected && open(), 300);
        } catch {
          add.disabled = false;
        }
      };
      row.append(root.RankingVisuals.avatar(p.avatar, p.name), text, add);
      box.append(row);
    }
    return box;
  }

  async function open() {
    const me = uid();
    const dialog = root.openLibraryDialog(
      "フレンド",
      '<div class="fr-body"><p class="fr-wait">読み込んでいます…</p></div>',
    );
    const body = dialog.querySelector(".fr-body");
    const say = (text) => body.replaceChildren(node("p", "fr-wait", text));
    if (me === "GUEST-000") return say("ログインするとフレンドが見られます。");
    body.replaceChildren();
    body.append(addSection(dialog));
    const addedMe = addedMeSection(dialog);
    if (addedMe) body.append(addedMe);
    const friendIds = (typeof myFriendList !== "undefined" && Array.isArray(myFriendList) ? myFriendList : []).map((f) => String(f?.code || "")).filter(Boolean);
    if (!friendIds.length) {
      body.append(node("p", "fr-wait", "まだフレンドがいません。IDで探すか、あなたを追加した人から追加できます。"));
      return;
    }
    const wait = node("p", "fr-wait", "読み込んでいます…");
    body.append(wait);
    let docs = [];
    try {
      docs = (await root.UserDirectory?.byIds?.(friendIds, { fields: FIELDS })) || null;
    } catch {
      docs = null;
    }
    if (!Array.isArray(docs)) {
      docs = [];
      for (const id of friendIds) {
        try {
          const snap = await root.fbGetDoc(root.fbDoc(root.db, "users", id));
          if (snap.exists()) docs.push({ id, data: snap.data() });
        } catch {}
      }
    }
    if (!dialog.isConnected) return;
    const now = Date.now(),
      people = docs.filter((d) => !d.data?.deleted).map((d) => person(d.id, d.data, me, now)),
      byId = new Map(people.map((p) => [p.id, p]));
    // Friends whose documents did not come back still show, from the saved list's names.
    for (const f of typeof myFriendList !== "undefined" ? myFriendList : []) {
      const id = String(f?.code || "");
      if (id && !byId.has(id)) people.push({ id, name: f.name || id, avatar: f.customAvatar || "", mutual: false, lastActive: 0, online: false, studying: false, today: 0, week: 0, total: 0, points: 0 });
    }
    wait.remove();
    if (!people.length) {
      body.append(node("p", "fr-wait", "フレンドの情報を読み込めませんでした。"));
      return;
    }

    // This week's ranking, me included.
    const myStats = root.StudyTimeModel.readStats({ userStats: typeof userStats === "object" ? userStats : {} });
    const mine = {
      id: me,
      name: "あなた",
      week: root.StudyTimeModel.rankingSeconds(myStats, "weekly", now),
      today: root.StudyTimeModel.rankingSeconds(myStats, "daily", now),
    };
    const ranked = rankRows([...people, mine]);
    const rankBox = node("section", "fr-rank");
    rankBox.append(node("h3", "fr-title", "今週の勉強ランキング（フレンド内）"));
    const medals = ["🥇", "🥈", "🥉"];
    for (const row of ranked.slice(0, 10)) {
      const line = node("div", "fr-rank-row" + (row.id === me ? " is-me" : ""));
      line.append(
        node("span", "fr-place", medals[row.place - 1] || String(row.place)),
        node("span", "fr-rank-name", row.name),
        node("b", "fr-rank-time", mins(row.week)),
      );
      rankBox.append(line);
    }
    if (ranked.length > 10) {
      const meRow = ranked.find((r) => r.id === me);
      if (meRow && meRow.place > 10) {
        const line = node("div", "fr-rank-row is-me");
        line.append(node("span", "fr-place", String(meRow.place)), node("span", "fr-rank-name", "あなた"), node("b", "fr-rank-time", mins(meRow.week)));
        rankBox.append(line);
      }
    }
    body.append(rankBox);

    // Everyone, studying first.
    const listBox = node("section", "fr-list");
    listBox.append(node("h3", "fr-title", "フレンド一覧"));
    const sorted = [...people].sort((a, b) => Number(b.studying) - Number(a.studying) || Number(b.online) - Number(a.online) || (b.week || 0) - (a.week || 0));
    for (const p of sorted) {
      const row = node("button", "fr-row");
      row.type = "button";
      row.setAttribute("aria-label", p.name + "のプロフィール");
      const avatar = root.RankingVisuals.avatar(p.avatar, p.name, p.custom);
      root.PeopleModel.onlineDot(avatar, p.lastActive);
      const text = node("span", "fr-text");
      const nameLine = node("span", "fr-name");
      const nameEl = node("span", "fr-name-text");
      root.RankingVisuals.name(nameEl, p.name, p.custom);
      nameLine.append(nameEl);
      if (p.studying) nameLine.append(node("span", "fr-badge is-studying", "勉強中"));
      else if (p.online) nameLine.append(node("span", "fr-badge is-online", "オンライン"));
      if (p.mutual) nameLine.append(node("span", "fr-badge is-mutual", "お互いフレンド"));
      text.append(nameLine);
      const meta = node("small", "fr-meta", "今日 " + mins(p.today) + " ・ 今週 " + mins(p.week) + " ・ 合計 " + mins(p.total));
      text.append(meta);
      const record = root.DuelRecords.get(p.id);
      if (record) text.append(node("small", "fr-duel", "対戦成績 " + record.w + "勝" + record.l + "敗" + (record.d ? record.d + "分" : "")));
      row.append(avatar, text);
      row.onclick = () => root.People?.open(p.id);
      listBox.append(row);
    }
    body.append(listBox);
    body.append(node("p", "fr-note", "スタンプストアに出るのは、お互いフレンドのスタンプだけです。"));
  }

  root.Friends = Object.freeze({ open });
})(typeof window !== "undefined" ? window : globalThis);
