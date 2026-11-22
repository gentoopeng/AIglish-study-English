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

  async function open() {
    const me = uid();
    const dialog = root.openLibraryDialog(
      "フレンド",
      '<div class="fr-body"><p class="fr-wait">読み込んでいます…</p></div>',
    );
    const body = dialog.querySelector(".fr-body");
    const say = (text) => body.replaceChildren(node("p", "fr-wait", text));
    if (me === "GUEST-000") return say("ログインするとフレンドが見られます。");
    const friendIds = (typeof myFriendList !== "undefined" && Array.isArray(myFriendList) ? myFriendList : []).map((f) => String(f?.code || "")).filter(Boolean);
    if (!friendIds.length) return say("まだフレンドがいません。ユーザーのプロフィールや、コミュニティのID検索から追加できます。");
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
    if (!people.length) return say("フレンドの情報を読み込めませんでした。");
    body.replaceChildren();

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
