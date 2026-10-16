// One bounded document per group; only an open group has a realtime listener.
(function () {
  "use strict";
  const uid = () => myId || "GUEST-000",
    ref = (id) => window.fbDoc(window.db, "studyGroups", id),
    registry = (id) =>
      window.fbCollection(window.db, "users", id, "studyGroups");
  const racePositions = new Map();
  let owner = "",
    list = [],
    loaded = 0,
    job = null,
    unsubscribe = null,
    current = "",
    modal = null,
    publishing = false,
    loadVersion = 0,
    lastPublish = 0;
  const total = () => {
    const ledger = window.StudyTime.snapshot();
    return {
      attempts: window.LearningRankingModel.attemptCount(
        window.LearningRanking.snapshot(),
      ),
      words: window.LearningRankingModel.wordCount(
        window.LearningRanking.snapshot(),
      ),
      time: Math.floor(window.StudyTimeModel.total(ledger) / 60000),
      timeAt: Number(ledger.updatedAt) || 0,
    };
  };
  const fromProfile = (data) => {
    const stats = window.StudyTimeModel.readStats(data);
    return {
      attempts: window.LearningRankingModel.attemptCount(
        window.LearningRankingModel.fromProfile(data),
      ),
      words: window.LearningRankingModel.wordCount(
        window.LearningRankingModel.fromProfile(data),
      ),
      time: Math.floor(
        window.StudyTimeModel.rankingSeconds(stats, "total", Date.now()) / 60,
      ),
      timeAt: Number(stats.study_calendar_v2?.updatedAt) || 0,
    };
  };
  const value = (p, b, k) =>
    Math.max(0, Number(p?.[k] || 0) - Number(b?.[k] || 0));
  function progress(group, type) {
    return Object.keys(group.members || {}).reduce(
      (sum, id) =>
        sum + value(group.progress?.[id], group.goal?.baseline?.[id], type),
      Number(group.goal?.departed || 0),
    );
  }
  function goalReached(group) {
    if (!group.goal) return false;
    if (group.goal.mode !== "individual")
      return progress(group, group.goal.type) >= group.goal.target;
    const ids = Object.keys(group.members || {});
    return (
      ids.length > 0 &&
      ids.every(
        (id) =>
          value(
            group.progress?.[id],
            group.goal.baseline?.[id],
            group.goal.type,
          ) >= group.goal.target,
      )
    );
  }
  function compact(group) {
    group.retainedMemberIds = [
      ...new Set([
        ...Object.keys(group.members),
        ...group.events.map((item) => item.owner).filter(Boolean),
      ]),
    ];
    return group;
  }
  function event(group, item) {
    if (group.events.some((old) => old.id === item.id)) return;
    group.events = [...group.events, item].slice(-40);
  }
  function advance(group, id, now, at) {
    const before = group.progress[id] ||
      group.baseline[id] || { words: 0, time: 0 };
    group.progress[id] = {
      attempts: Math.max(
        Number(before.attempts) || 0,
        Number(now.attempts) || 0,
      ),
      words: Math.max(before.words, now.words),
      time:
        Number(now.timeAt || 0) >= Number(before.timeAt || 0)
          ? Math.max(0, now.time)
          : before.time,
      timeAt: Math.max(Number(now.timeAt || 0), Number(before.timeAt || 0)),
    };
    for (const [type, step, label] of [
      ["words", 100, "語の理解度を記録"],
      ["time", 30, "分勉強"],
    ]) {
      const old = Math.floor(value(before, group.baseline[id], type) / step),
        next = Math.floor(
          value(group.progress[id], group.baseline[id], type) / step,
        );
      if (next > old)
        event(group, {
          id:
            id +
            ":" +
            (group.members[id]?.joinedAt || 0) +
            ":" +
            type +
            ":" +
            next,
          owner: id,
          name: group.members[id]?.name || id,
          text: next * step + label,
          at,
          reactions: {},
        });
    }
    // Sleep/manual corrections may reduce time; an older device cannot undo a newer ledger.
    if (group.progress[id].time < before.time) {
      const prefix = id + ":" + (group.members[id]?.joinedAt || 0) + ":time:";
      const ceiling = Math.floor(
        value(group.progress[id], group.baseline[id], "time") / 30,
      );
      group.events = group.events.filter(
        (item) =>
          !item.id.startsWith(prefix) ||
          Number(item.id.slice(prefix.length)) <= ceiling,
      );
    }
    reconcileGoal(group, at);
    return group;
  }
  function reconcileGoal(group, at) {
    if (group.goal?.done && !goalReached(group)) {
      group.goal.done = false;
      group.events = group.events.filter(
        (item) => item.id !== "goal:" + group.goal.id,
      );
    }
    if (group.goal && !group.goal.done && goalReached(group)) {
      group.goal.done = true;
      event(group, {
        id: "goal:" + group.goal.id,
        owner: "",
        text:
          "みんなで目標達成！ " +
          group.goal.target +
          (group.goal.type === "time"
            ? "分"
            : group.goal.type === "attempts"
              ? "回"
              : "語"),
        at,
        reactions: {},
      });
    }
  }
  function leave(group, account) {
    if (group.goal) {
      group.goal.departed =
        Number(group.goal.departed || 0) +
        value(
          group.progress[account],
          group.goal.baseline[account],
          group.goal.type,
        );
      delete group.goal.baseline[account];
    }
    delete group.members[account];
    delete group.baseline[account];
    delete group.progress[account];
    group.events.forEach((item) => {
      if (item.reactions) delete item.reactions[account];
    });
    if (group.owner === account)
      group.owner = Object.keys(group.members)[0] || "";
    reconcileGoal(group, Date.now());
    return group;
  }
  window.StudyGroupsModel = { progress, advance, leave, goalReached };
  function connected() {
    if (window.FirestoreReadGuard?.paused())
      throw Error("クラウドの利用上限に達しています。後で再試行してください。");
    if (uid() === "GUEST-000" || !window.db)
      throw Error("グループはログイン後に使えます。");
  }
  function stop() {
    racePositions.clear();
    window.GroupChat?.stop();
    unsubscribe?.();
    unsubscribe = null;
    current = "";
    modal = null;
  }
  function error(e) {
    const target =
      modal?.querySelector("[data-group-status]") ||
      document.querySelector("#groupStatus");
    if (target)
      target.textContent = e.message || "接続後に再試行してください。";
  }
  function button(label, fn) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.onclick = async () => {
      if (b.disabled) return;
      b.disabled = true;
      try {
        await fn();
      } catch (e) {
        error(e);
      } finally {
        b.disabled = false;
      }
    };
    return b;
  }
  function remember() {
    try {
      localStorage.setItem("core_v4_groups_" + uid(), JSON.stringify(list));
    } catch {}
  }
  async function load(force = false) {
    if (owner !== uid()) {
      stop();
      owner = uid();
      loaded = 0;
      lastPublish = 0;
      loadVersion++;
      job = null;
      try {
        list = JSON.parse(
          localStorage.getItem("core_v4_groups_" + owner) || "[]",
        );
      } catch {
        list = [];
      }
    }
    render();
    if (
      uid() === "GUEST-000" ||
      !window.db ||
      (!force && Date.now() - loaded < 60000)
    )
      return;
    if (job) return job;
    const account = uid(),
      version = loadVersion;
    job = (async () => {
      try {
        const snap = await window.fbGetDocs(
          window.fbQuery(registry(account), window.fbLimit(20)),
        );
        if (uid() !== account || version !== loadVersion) return;
        list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        loaded = Date.now();
        remember();
        render();
      } catch (e) {
        error(e);
      } finally {
        if (version === loadVersion) job = null;
      }
    })();
    return job;
  }
  function render() {
    const host = document.querySelector("#studyGroupList");
    if (!host) return;
    host.replaceChildren();
    for (const group of list) {
      const b = button(group.name || "グループ", () => open(group.id));
      b.className = "group-list-row";
      b.setAttribute("aria-label", group.name || "グループ");
      const icon = document.createElement("span");
      icon.className = "group-list-avatar";
      icon.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m3 10v-3a6 6 0 0 0-3-5"/></svg>';
      icon.setAttribute("aria-hidden", "true");
      const copy = document.createElement("span"),
        name = document.createElement("span"),
        meta = document.createElement("span"),
        chevron = document.createElement("span");
      copy.className = "group-list-copy";
      name.className = "group-list-name";
      name.textContent = group.name || "グループ";
      meta.className = "group-list-meta";
      meta.textContent = "学習記録・協力目標";
      chevron.className = "group-list-chevron";
      chevron.textContent = "›";
      chevron.setAttribute("aria-hidden", "true");
      copy.append(name, meta);
      b.replaceChildren(icon, copy, chevron);
      host.append(b);
    }
    if (!list.length) {
      const hint = document.createElement("p");
      hint.className = "people-hint";
      hint.textContent = "ユーザーを選んでグループを作れます。";
      host.append(hint);
    }
  }
  async function edit(existing) {
    connected();
    if (!existing && list.length >= 20) throw Error("グループは20個までです。");
    stop();
    const d = window.openLibraryDialog(
      existing ? "メンバーを追加" : "グループを作る",
      '<label>グループ名<input data-group-name maxlength="24" placeholder="グループ名"></label><div class="group-friend-picker"></div><p data-group-status role="status"></p><div class="library-editor-actions"><button type="button" data-library-close>キャンセル</button><button type="button" data-group-create>作成する</button></div>',
    );
    modal = d;
    const account = uid();
    d.querySelector(".library-editor-eyebrow").textContent = "グループ";
    d.querySelector("[data-group-name]").value = existing?.name || "";
    d.querySelector("[data-group-name]").readOnly = !!existing;
    d.querySelector("[data-group-status]").textContent =
      "ユーザーを読み込み中…";
    await window.People.refresh(false);
    if (uid() !== account || !d.open) return;
    d.querySelector("[data-group-status]").textContent = "";
    const choices = window.People.list()
      .map((person) => ({ code: person.id, name: person.name }))
      .filter((f) => f.code !== account && !existing?.members[f.code]);
    for (const friend of choices) {
      const label = document.createElement("label"),
        check = document.createElement("input");
      check.type = "checkbox";
      check.value = friend.code;
      label.append(
        check,
        memberAvatar(friend.code, friend.name),
        document.createTextNode(friend.name || friend.code),
      );
      d.querySelector(".group-friend-picker").append(label);
    }
    if (!choices.length)
      d.querySelector("[data-group-status]").textContent =
        "追加できるユーザーはいません。";
    d.querySelector("[data-group-create]").textContent = existing
      ? "追加する"
      : "作成する";
    d.querySelector("[data-group-create]").onclick = async (e) => {
      const b = e.currentTarget;
      b.disabled = true;
      try {
        const name = d.querySelector("[data-group-name]").value.trim(),
          selected = [
            ...d.querySelectorAll("input[type=checkbox]:checked"),
          ].map((c) => c.value);
        if (!name || !selected.length)
          throw Error("名前を入力し、ユーザーを選んでください。");
        if (
          selected.length +
            Object.keys(existing?.members || { [account]: 1 }).length >
          12
        )
          throw Error("グループは12人までです。");
        const id = existing?.id || crypto.randomUUID();
        await window.fbRunTransaction(window.db, async (tx) => {
          let g;
          if (existing) {
            const snap = await tx.get(ref(id));
            if (!snap.exists() || snap.data().owner !== account)
              throw Error("グループの作成者が追加できます。");
            g = { id, ...snap.data(), name };
          } else
            g = {
              version: 1,
              name,
              owner: account,
              members: {},
              baseline: {},
              progress: {},
              events: [],
              createdAt: Date.now(),
            };
          const ids = existing
              ? selected.filter((member) => !g.members[member])
              : [account, ...selected],
            profiles = [];
          if (!ids.length)
            throw Error("選んだユーザーはすでに参加しています。");
          if (Object.keys(g.members).length + ids.length > 12)
            throw Error("グループは12人までです。");
          for (const member of [...new Set([account, ...ids])]) {
            const s = await tx.get(window.fbDoc(window.db, "users", member));
            if (!s.exists() || s.data().deleted)
              throw Error("メンバーのアカウントを確認してください。");
            if (ids.includes(member)) profiles.push([member, s.data()]);
          }
          if (uid() !== account) throw Error("アカウントが変わりました。");
          for (const [member, data] of profiles) {
            g.members[member] = {
              name: data.playerName || member,
              joinedAt: Date.now(),
            };
            g.baseline[member] =
              member === account ? total() : fromProfile(data);
            g.progress[member] = { ...g.baseline[member] };
            if (g.goal) g.goal.baseline[member] = { ...g.baseline[member] };
            tx.set(
              window.fbDoc(window.db, "users", member, "studyGroups", id),
              { name: g.name, joinedAt: Date.now() },
            );
          }
          reconcileGoal(g, Date.now());
          tx.set(ref(id), compact(g));
        });
        if (uid() !== account) return;
        window.closeLibraryDialog();
        loaded = 0;
        await load(true);
        await open(id);
      } catch (e) {
        error(e);
      } finally {
        b.disabled = false;
      }
    };
  }
  async function mutate(id, fn) {
    connected();
    const account = uid();
    return window.fbRunTransaction(window.db, async (tx) => {
      const snap = await tx.get(ref(id)),
        user = await tx.get(window.fbDoc(window.db, "users", account));
      if (
        uid() !== account ||
        !user.exists() ||
        user.data().deleted ||
        !snap.exists() ||
        !snap.data().members?.[account]
      )
        throw Error("グループへの参加状態を確認してください。");
      const g = snap.data();
      fn(g, tx, account);
      if (Object.keys(g.members).length) tx.set(ref(id), compact(g));
      else tx.delete(ref(id));
    });
  }
  async function open(id) {
    connected();
    stop();
    const account = uid(),
      d = window.openLibraryDialog(
        "グループ",
        '<div class="group-content"></div><p data-group-status role="status">読み込み中…</p><div class="library-editor-actions"><button type="button" data-library-close>閉じる</button></div>',
      );
    modal = d;
    current = id;
    d.querySelector(".library-editor-eyebrow").textContent = "グループ";
    d.addEventListener(
      "close",
      () => {
        if (modal === d) stop();
      },
      { once: true },
    );
    subscribe(id, d, account);
    publish(true, id);
  }
  function subscribe(id, d, account) {
    unsubscribe?.();
    unsubscribe = window.fbOnSnapshot(
      ref(id),
      (snap) => {
        if (uid() !== account || current !== id || !d.isConnected) return;
        if (!snap.exists() || !snap.data().members?.[account]) {
          error(Error("このグループは利用できません。"));
          stop();
          return;
        }
        d.querySelector("[data-group-status]").textContent = "";
        const group = { id, ...snap.data() };
        draw(group, d);
        window.GroupChat?.mount(d, group);
      },
      error,
    );
  }
  function memberAvatar(id, name) {
    const known = window.People?.preview?.(id),
      photo =
        id === uid()
          ? localStorage.getItem("core_v4_user_avatar_" + id) || ""
          : known?.avatar || "";
    const avatar = window.RankingVisuals.avatar(photo, name);
    avatar.dataset.memberAvatar = id;
    if (!photo && id !== uid())
      window.ProfileIdentityCache?.get(id)
        .then((profile) => {
          if (!avatar.isConnected || !profile.avatar) return;
          const updated = window.RankingVisuals.avatar(
            profile.avatar,
            profile.name || name,
          );
          avatar.replaceChildren(...updated.childNodes);
        })
        .catch(() => {});
    return avatar;
  }
  function draw(g, d) {
    const host = d.querySelector(".group-content");
    host.replaceChildren();
    const memberList = document.createElement("section");
    memberList.className = "group-member-list";
    memberList.setAttribute("aria-label", "メンバー");
    for (const [id, member] of Object.entries(g.members || {})) {
      const row = document.createElement("div"),
        button = document.createElement("button"),
        copy = document.createElement("span"),
        name = document.createElement("span"),
        meta = document.createElement("small");
      row.className = "people-row";
      button.type = "button";
      button.className = "people-profile-button";
      name.className = "people-name";
      name.textContent = member.name || id;
      meta.textContent =
        id === uid()
          ? "あなた"
          : g.owner === id
            ? "グループ作成者"
            : "メンバー";
      copy.append(name, meta);
      button.append(memberAvatar(id, member.name), copy);
      button.onclick = () => window.People.open(id);
      row.append(button);
      memberList.append(row);
    }
    host.append(memberList);
    const battle = button("グループで単語バトル", () => {
      window.closeLibraryDialog();
      stop();
      window.openWordDuel(g.id);
    });
    battle.className = "group-battle";
    const goal = document.createElement("section");
    goal.className = "group-goal";
    const heading = document.createElement("h4");
    heading.textContent = "みんなで協力";
    goal.append(heading);
    const note = document.createElement("p");
    note.className = "people-hint";
    note.textContent =
      "目標設定後の記録を集計します。学習終了・保存・更新時に反映。";
    goal.append(note);
    if (g.goal) {
      const unit =
          g.goal.type === "time"
            ? "分"
            : g.goal.type === "attempts"
              ? "回"
              : "語",
        individual = g.goal.mode === "individual",
        ids = Object.keys(g.members),
        complete = ids.filter(
          (id) =>
            value(g.progress?.[id], g.goal.baseline?.[id], g.goal.type) >=
            g.goal.target,
        ).length;
      const summary = document.createElement("p");
      summary.className = "group-race-summary";
      summary.textContent =
        (g.goal.done ? "達成！ " : "") +
        (individual
          ? "1人 " +
            g.goal.target +
            unit +
            " ・ " +
            complete +
            " / " +
            ids.length +
            "人達成"
          : "全員で " +
            progress(g, g.goal.type) +
            " / " +
            g.goal.target +
            unit);
      const meter = document.createElement("progress");
      meter.max = individual ? ids.length * g.goal.target : g.goal.target;
      meter.value = individual
        ? ids.reduce(
            (sum, id) =>
              sum +
              Math.min(
                g.goal.target,
                value(g.progress?.[id], g.goal.baseline?.[id], g.goal.type),
              ),
            0,
          )
        : progress(g, g.goal.type);
      meter.setAttribute("aria-label", "グループ全体の達成度");
      goal.append(summary, meter);
      for (const id of ids) {
        const member = g.members[id],
          n = value(g.progress?.[id], g.goal.baseline?.[id], g.goal.type),
          lane = document.createElement("div"),
          caption = document.createElement("div"),
          name = document.createElement("span"),
          count = document.createElement("strong"),
          track = document.createElement("div"),
          runner = memberAvatar(id, member.name),
          ends = document.createElement("div");
        lane.className =
          "group-race-lane" + (n >= g.goal.target ? " is-complete" : "");
        caption.className = "group-race-caption";
        name.textContent = member.name || id;
        count.textContent = n + " / " + g.goal.target + unit;
        caption.append(name, count);
        track.className = "group-race-track";
        track.setAttribute("role", "progressbar");
        track.setAttribute("aria-label", (member.name || id) + "の達成度");
        track.setAttribute("aria-valuemin", "0");
        track.setAttribute("aria-valuemax", String(g.goal.target));
        track.setAttribute("aria-valuetext", n + " / " + g.goal.target + unit);
        track.setAttribute("aria-valuenow", String(Math.min(n, g.goal.target)));
        runner.classList.add("group-race-runner");
        const raceKey = g.id + "_" + g.goal.id + "_" + id,
          pct = Math.min(100, (n / g.goal.target) * 100) + "%",
          previous = racePositions.get(raceKey) || pct;
        runner.style.setProperty("--race-progress", previous);
        racePositions.set(raceKey, pct);
        if (previous !== pct)
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              if (runner.isConnected)
                runner.style.setProperty("--race-progress", pct);
            }),
          );
        track.append(runner);
        ends.className = "group-race-ends";
        ends.textContent = "スタート";
        const finish = document.createElement("span");
        finish.textContent = n >= g.goal.target ? "達成 ✓" : "ゴール";
        ends.append(finish);
        lane.append(caption, track, ends);
        goal.append(lane);
      }
    }
    if (!g.goal || g.goal.done) {
      const type = document.createElement("select");
      type.setAttribute("aria-label", "協力目標の種類");
      for (const [v, t] of [
        ["attempts", "理解度を付けた回数"],
        ["time", "勉強時間（分）"],
      ]) {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = t;
        type.append(o);
      }
      const mode = document.createElement("select");
      mode.setAttribute("aria-label", "協力目標の達成方式");
      for (const [value, label] of [
        ["individual", "全員がそれぞれ達成"],
        ["sum", "全員の合計で達成"],
      ]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        mode.append(option);
      }
      const target = document.createElement("input");
      target.type = "number";
      target.min = "1";
      target.step = "1";
      target.max = "100000";
      target.value = "100";
      target.setAttribute("aria-label", "協力目標の数");
      type.onchange = () =>
        (target.value = type.value === "time" ? "30" : "100");
      goal.append(
        type,
        mode,
        target,
        button("目標を設定", async () => {
          const n = Number(target.value);
          if (!Number.isInteger(n) || n < 1 || n > 100000)
            throw Error("目標は1〜100000で入力してください。");
          await mutate(g.id, (state) => {
            if (state.goal && !state.goal.done)
              throw Error("すでに進行中の目標があります。");
            advance(state, uid(), total(), Date.now());
            state.goal = {
              id: crypto.randomUUID(),
              type: type.value,
              mode: mode.value,
              target: n,
              baseline: structuredClone(state.progress),
              done: false,
            };
          });
        }),
      );
    }
    host.append(goal);
    const timeline = document.createElement("div");
    timeline.className = "group-timeline";
    const h = document.createElement("h4");
    h.textContent = "みんなの達成";
    timeline.append(h);
    if (!g.events.length) {
      const p = document.createElement("p");
      p.className = "people-hint";
      p.textContent = "参加後、100語・30分ごとの達成がここに届きます。";
      timeline.append(p);
    }
    for (const item of [...g.events].reverse()) {
      const row = document.createElement("article"),
        text = document.createElement("p"),
        date = document.createElement("small");
      text.textContent =
        (g.members[item.owner]?.name || item.name
          ? (g.members[item.owner]?.name || item.name) + " · "
          : "") + item.text;
      date.textContent = new Date(item.at).toLocaleString("ja-JP", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const react = button(
        "いいね " + Object.keys(item.reactions || {}).length,
        () =>
          mutate(g.id, (state, tx, account) => {
            const found = state.events.find((e) => e.id === item.id);
            if (!found) throw Error("記録の表示を更新してください。");
            found.reactions = found.reactions || {};
            if (found.reactions[account]) delete found.reactions[account];
            else found.reactions[account] = true;
          }),
      );
      react.setAttribute("aria-pressed", String(!!item.reactions?.[uid()]));
      row.append(text, date, react);
      timeline.append(row);
    }
    host.append(timeline);
    const actions = document.createElement("div");
    actions.className = "group-actions";
    actions.append(
      button("更新", () => {
        connected();
        if (!unsubscribe && current) subscribe(g.id, d, uid());
        return publish(true, g.id);
      }),
    );
    if (g.owner === uid())
      actions.append(button("メンバーを追加", () => edit(g)));
    actions.append(
      button("グループを退会", async () => {
        if (!confirm("このグループを退会しますか？ 学習記録は残ります。"))
          return;
        await mutate(g.id, (state, tx, account) => {
          leave(state, account);
          tx.delete(
            window.fbDoc(window.db, "users", account, "studyGroups", g.id),
          );
        });
        window.closeLibraryDialog();
        stop();
        loaded = 0;
        await load(true);
      }),
    );
    host.append(battle, actions);
  }
  async function publish(force = false, only) {
    if (window.endOnlyCloudSaves && !force) return;
    if (
      publishing ||
      uid() === "GUEST-000" ||
      !window.db ||
      window.FirestoreReadGuard?.paused() ||
      window.__learningBootReady !== true ||
      document.hidden ||
      (!force && Date.now() - lastPublish < 300000)
    )
      return;
    const account = uid();
    if (owner !== account) return;
    publishing = true;
    try {
      const now = total();
      for (const group of list) {
        if (only && group.id !== only) continue;
        if (uid() !== account) break;
        const key = "core_v4_group_synced_" + account + "_" + group.id;
        let previous;
        try {
          previous = JSON.parse(localStorage.getItem(key) || "null");
        } catch {}
        if (
          previous &&
          previous.words === now.words &&
          Number(previous.attempts || 0) === now.attempts &&
          previous.time === now.time
        )
          continue;
        await mutate(group.id, (state) => {
          advance(state, account, now, Date.now());
          if (state.members[account])
            state.members[account].name = String(myName || account).slice(
              0,
              40,
            );
        });
        if (uid() === account) localStorage.setItem(key, JSON.stringify(now));
      }
      if (uid() === account) lastPublish = Date.now();
    } catch (e) {
      error(e);
    } finally {
      publishing = false;
    }
  }
  function init() {
    const root = document.querySelector("#view-community>div");
    if (!root || document.querySelector("#communitySegments")) return;
    const nav = document.createElement("div");
    nav.id = "communitySegments";
    nav.className = "community-segments";
    const friends = document.createElement("section");
    friends.id = "communityFriends";
    const groups = document.createElement("section");
    groups.id = "communityGroups";
    groups.hidden = true;
    groups.innerHTML =
      '<div class="group-toolbar"><button type="button" id="createStudyGroup">グループを作る</button><button type="button" id="refreshStudyGroups">更新</button></div><p id="groupStatus" role="status"></p><div id="studyGroupList"></div>';
    const battle = root.querySelector(".duel-entry");
    for (const node of [...root.children])
      if (node !== battle) friends.append(node);
    for (const [name, el] of [
      ["ユーザー", friends],
      ["グループ", groups],
    ]) {
      const b = button(name, async () => {
        friends.hidden = el !== friends;
        groups.hidden = el !== groups;
        nav
          .querySelectorAll("button")
          .forEach((n) => n.setAttribute("aria-pressed", String(n === b)));
        if (el === groups) await load();
        else {
          window.People?.render();
          await window.People?.refresh(false);
        }
      });
      b.setAttribute("aria-pressed", String(el === friends));
      nav.append(b);
    }
    root.append(nav, friends, groups);
    if (battle) battle.remove();
    document.querySelector("#createStudyGroup").innerHTML =
      '<span class="group-create-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M19 7v8m-4-4h8"/></svg></span><span>グループを作る</span>';
    document.querySelector("#createStudyGroup").onclick = () =>
      edit().catch(error);
    document.querySelector("#refreshStudyGroups").onclick = () =>
      load(true).catch(error);
    render();
  }
  window.StudyGroups = { load, open, publish, stop };
  window.onAppLoaded(() => {
    init();
    load()
      .then(() => publish())
      .catch(() => {});
  });
  window.onBeforeAppLoad?.(() => {
    if (modal?.isConnected) window.closeLibraryDialog();
    stop();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      unsubscribe?.();
      unsubscribe = null;
    } else if (
      current &&
      modal?.isConnected &&
      owner === uid() &&
      !window.FirestoreReadGuard?.paused()
    )
      subscribe(current, modal, uid());
  });
  window.addEventListener("cloud-quota-paused", () => {
    unsubscribe?.();
    unsubscribe = null;
    if (current)
      error(Error("クラウドの利用上限に達しています。後で更新してください。"));
  });
  window.onTabChange((tab) => {
    if (tab !== "community" && current) {
      window.closeLibraryDialog();
      stop();
    }
  });
  setInterval(() => {
    if (!document.hidden) publish().catch(() => {});
  }, 60000);
})();
