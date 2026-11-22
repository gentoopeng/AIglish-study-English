// ステータス (10.156): the first tab, the player's card — icon, frame, name, title, rank by study time, points,
// study time, streak, word-book mastery and more. Reads only what this device already has (no cloud reads).
(function (root) {
  "use strict";
  const DAY = 86400000;
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const svg = (tag, attrs) => {
    const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, String(v));
    return n;
  };
  const safe = (fn, fallback) => {
    try {
      const v = fn();
      return v === undefined ? fallback : v;
    } catch {
      return fallback;
    }
  };
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const comma = (v) => Math.round(num(v)).toLocaleString("ja-JP");
  const pad = (v) => String(v).padStart(2, "0");
  const dateKey = (t) => {
    const d = new Date(t);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  };
  // "3時間5分", "12分", "0分".
  function spoken(ms) {
    const m = Math.floor(Math.max(0, ms) / 60000),
      h = Math.floor(m / 60);
    return h ? h + "時間" + (m % 60 ? (m % 60) + "分" : "") : m + "分";
  }
  // Big number with a small unit: [["3", "時間"], ["5", "分"]].
  function parts(ms) {
    const m = Math.floor(Math.max(0, ms) / 60000),
      h = Math.floor(m / 60);
    return h ? [[String(h), "時間"], [String(m % 60), "分"]] : [[String(m), "分"]];
  }
  const me = () => (typeof myId !== "undefined" && myId ? myId : "GUEST-000");
  const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

  // The mastery graph's word selection (10.181), kept on this device: {bookId: [num, ...]}.
  const selKey = () => "aiglish_mastery_selection_" + me();
  function readSelection() {
    const raw = safe(() => JSON.parse(localStorage.getItem(selKey()) || "{}"), {});
    const out = {};
    if (raw && typeof raw === "object")
      for (const [k, v] of Object.entries(raw)) if (Array.isArray(v) && v.length) out[k] = v.map(String);
    return out;
  }
  function writeSelection(sel) {
    safe(() => localStorage.setItem(selKey(), JSON.stringify(sel)), null);
  }
  const selectionCount = (sel) => Object.values(sel).reduce((a, v) => a + v.length, 0);

  // Everything the card shows, from this device. Pure apart from the reads; tested through the screen.
  function collect(now = Date.now()) {
    const model = root.StudyTimeModel;
    // The ledger as study-time.js last mirrored it on userStats (read only: StudyTime.snapshot would switch
    // its owner to whoever is signed in now, in the middle of a sign-in).
    const mirrored = typeof userStats === "object" && userStats ? userStats.study_calendar_v2 : null;
    const ledger = (model && mirrored ? safe(() => model.resetLedger(mirrored), null) : null) || { days: {}, offset: 0 };
    const dayMs = (key) => (model ? model.dayMilliseconds(ledger.days?.[key]) : 0);
    const today = dateKey(now);
    const days = Array.from({ length: 14 }, (_, i) => {
      const t = now - (13 - i) * DAY,
        key = dateKey(t);
      return { key, ms: dayMs(key), label: new Date(t).getDate(), week: WEEK[new Date(t).getDay()], today: key === today };
    });
    let streak = 0;
    {
      const d = new Date(now);
      if (dayMs(dateKey(d)) < 60000) d.setDate(d.getDate() - 1);
      while (dayMs(dateKey(d)) >= 60000 && streak < 3660) {
        streak++;
        d.setDate(d.getDate() - 1);
      }
    }
    const all = Object.keys(ledger.days || {}).map(dayMs);
    const studied = all.filter((ms) => ms >= 60000);
    const week = model ? safe(() => model.rangeValue(ledger, "weekly", now), 0) : 0;
    const total = model ? safe(() => model.total(ledger), 0) : 0;
    const weekdays = Array(7).fill(0);
    for (const [key, day] of Object.entries(ledger.days || {})) {
      const d = new Date(key + "T00:00:00");
      if (!Number.isNaN(d.getTime())) weekdays[d.getDay()] += model ? model.dayMilliseconds(day) : 0;
    }
    // Frame = rank: the frames unlock with total study time.
    const catalog = root.IconFrameCatalog || [];
    const seconds = Math.floor(total / 1000);
    let tier = -1;
    catalog.forEach((f, i) => {
      if (seconds >= f.seconds) tier = i;
    });
    const next = catalog[tier + 1] || null,
      base = tier >= 0 ? catalog[tier].seconds : 0;
    const profile = safe(() => root.UserProfile.read(), {}) || {};
    const balance = safe(() => root.StudyPoints.balance(), null);
    const earned = safe(() => root.StudyPoints.earned(), null);
    // (point-trend.js keeps the player's own days on this device under this key.)
    const trend = safe(() => root.PointTrend.clean(JSON.parse(localStorage.getItem("aiglish_point_trend_" + me()) || "{}")), {}) || {};
    const points = root.PointTrend ? safe(() => root.PointTrend.series(trend, 14, now, Number.isFinite(balance) ? balance : undefined), []) : [];
    const known = points.filter((p) => p.value !== null && p.value !== undefined);
    const pointWeek = known.length >= 2 ? safe(() => {
      const last = known[known.length - 1].value,
        from = points.slice(-8).find((p) => p.value !== null && p.value !== undefined);
      return from ? last - from.value : null;
    }, null) : null;
    const pool = typeof textbooksPool !== "undefined" && Array.isArray(textbooksPool) ? textbooksPool : [];
    const selection = readSelection();
    const selActive = selectionCount(selection) > 0;
    const books = pool.map((b) => {
      const picked = selActive ? new Set(selection[b.id] || []) : null;
      const c = picked && !picked.size ? { ok: 0, so: 0, bad: 0, none: 0 } : safe(() => root.getTextbookMasteryStats(b.id, picked || undefined), null) || { ok: 0, so: 0, bad: 0, none: 0 };
      const sum = num(c.ok) + num(c.so) + num(c.bad) + num(c.none);
      return { id: b.id, name: String(b.name || "単語帳"), cover: b.coverType === "image" ? "" : String(b.cover || "📘").slice(0, 4), ok: num(c.ok), so: num(c.so), bad: num(c.bad), none: num(c.none), sum, picked: picked ? picked.size : 0 };
    });
    const mastery = books.reduce((a, b) => ({ ok: a.ok + b.ok, so: a.so + b.so, bad: a.bad + b.bad, none: a.none + b.none }), { ok: 0, so: 0, bad: 0, none: 0 });
    mastery.sum = mastery.ok + mastery.so + mastery.bad + mastery.none;
    const stats = typeof userStats === "object" && userStats ? userStats : {};
    return {
      id: me(),
      guest: me() === "GUEST-000",
      name: typeof myName === "string" && myName ? myName : "プレイヤー",
      title: typeof selectedTitle === "string" && selectedTitle && selectedTitle !== "称号なし" ? selectedTitle : "",
      photo: safe(() => localStorage.getItem("core_v4_user_avatar_" + me()), "") || "",
      profile,
      // The equipped frame, if this much study time has unlocked it (as icon-frames.js decides).
      frame: catalog.some((f) => f.id === profile.frame && seconds >= f.seconds) ? profile.frame : "",
      rank: { tier, name: tier >= 0 ? catalog[tier].name : "ビギナー", id: tier >= 0 ? catalog[tier].id : "none", next, progress: next ? Math.min(1, (seconds - base) / Math.max(1, next.seconds - base)) : 1, left: next ? (next.seconds - seconds) * 1000 : 0, count: catalog.length },
      study: { today: dayMs(today), week, total, streak, best: all.length ? Math.max(...all) : 0, days: studied.length, average: studied.length ? studied.reduce((a, b) => a + b, 0) / studied.length : 0, recent: days, weekdays },
      points: { balance: Number.isFinite(balance) ? balance : null, earned: Number.isFinite(earned) ? earned : null, series: points, week: pointWeek },
      books,
      mastery,
      selActive,
      selCount: selectionCount(selection),
      rated: num(stats.vocab_rated_count),
      flash: num(stats.flash_count),
    };
  }

  const motion = () => {
    const m = document.documentElement.dataset.motion;
    return !(m === "off" || m === "test" || matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  };
  // Numbers count up when the card opens (not with motion off).
  let quiet = false;
  function countUp(node, value, format = comma) {
    node.textContent = format(value);
    if (quiet || !motion() || !Number.isFinite(value) || Math.abs(value) < 2) return;
    const start = performance.now(),
      span = 900;
    const step = (t) => {
      if (!node.isConnected) return;
      const k = Math.min(1, (t - start) / span),
        e = 1 - Math.pow(1 - k, 3);
      node.textContent = format(value * e);
      if (k < 1) requestAnimationFrame(step);
      else node.textContent = format(value);
    };
    requestAnimationFrame(step);
  }

  function hero(d) {
    const card = el("section", "sb-hero sb-rank-" + d.rank.id);
    card.setAttribute("aria-label", "プレイヤー情報");
    card.append(el("span", "sb-hero-aura"), el("span", "sb-hero-grid"));
    const top = el("div", "sb-hero-top");
    const ring = el("div", "sb-avatar-ring");
    ring.append(el("span", "sb-avatar-orbit"));
    const avatar = root.RankingVisuals ? root.RankingVisuals.avatar(d.photo, d.name, JSON.stringify({ frame: d.frame })) : el("span", "podium-avatar", d.name.slice(0, 1));
    avatar.classList.add("sb-avatar");
    // The player's own photo at full size (the shared avatar makes a small preview of a data: image).
    const img = avatar.querySelector("img");
    if (img && /^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(d.photo)) {
      const full = document.createElement("img");
      full.alt = img.alt;
      full.decoding = "async";
      full.src = d.photo;
      img.replaceWith(full);
    }
    ring.append(avatar);
    const who = el("div", "sb-who");
    const name = el("h2", "sb-name", d.name);
    if (root.RankingVisuals) safe(() => root.RankingVisuals.name(name, d.name, JSON.stringify(d.profile)));
    name.classList.add("sb-name");
    const chips = el("div", "sb-chips");
    if (d.title) chips.append(el("span", "sb-chip sb-chip-title", "👑 " + d.title));
    who.append(el("p", "sb-kicker", d.guest ? "GUEST PLAYER" : "PLAYER STATUS"), name, chips);
    if (!d.guest) who.append(el("p", "sb-id", "ID " + d.id));
    top.append(ring, who);
    // Rank by study time (the frames): the current one and the way to the next.
    const rank = el("div", "sb-rank");
    const label = el("div", "sb-rank-label");
    const badge = el("span", "sb-rank-badge");
    badge.append(el("small", "", "RANK"), el("b", "", d.rank.name));
    const steps = el("div", "sb-rank-steps");
    for (let i = 0; i < d.rank.count; i++) steps.append(el("i", i <= d.rank.tier ? "on" : ""));
    label.append(badge, steps);
    const bar = el("div", "sb-rank-bar");
    const fill = el("i");
    fill.style.setProperty("--sb-fill", String(d.rank.progress));
    bar.append(fill);
    const note = el("p", "sb-rank-note", d.rank.next ? "NEXT " + d.rank.next.name + "　" + spoken(d.rank.left) : "MAX");
    rank.append(label, bar, note);
    card.append(top, rank);
    return card;
  }

  function pointsCard(d) {
    const card = el("section", "sb-card sb-points");
    const head = el("div", "sb-points-head");
    const left = el("div");
    left.append(el("p", "sb-label", "POINTS"));
    const value = el("strong", "sb-points-value");
    const n = el("span");
    if (d.points.balance === null) n.textContent = "—";
    else countUp(n, d.points.balance);
    value.append(n, el("small", "", "pt"));
    left.append(value);
    head.append(left);
    if (d.points.week !== null) {
      const up = d.points.week >= 0;
      head.append(el("span", "sb-delta " + (up ? "is-up" : "is-down"), (up ? "▲ +" : "▼ ") + comma(d.points.week) + " 7d"));
    }
    card.append(head);
    // The last 14 days of the balance as a line.
    const known = d.points.series.map((p, i) => [i, p.value]).filter((p) => p[1] !== null && p[1] !== undefined);
    if (known.length >= 2) {
      const W = 300,
        H = 70,
        lo = Math.min(...known.map((p) => p[1])),
        hi = Math.max(...known.map((p) => p[1])),
        span = hi - lo || 1;
      const xy = known.map(([i, v]) => [(i / 13) * W, H - 6 - ((v - lo) / span) * (H - 16)]);
      const line = xy.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
      const chart = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "sb-spark", preserveAspectRatio: "none", role: "img", "aria-label": "14日間のポイントの動き" });
      const defs = svg("defs");
      const grad = svg("linearGradient", { id: "sbSparkFill", x1: 0, y1: 0, x2: 0, y2: 1 });
      grad.append(svg("stop", { offset: "0", "stop-color": "#22d3ee", "stop-opacity": ".45" }), svg("stop", { offset: "1", "stop-color": "#22d3ee", "stop-opacity": "0" }));
      defs.append(grad);
      chart.append(defs, svg("path", { d: line + " L" + xy[xy.length - 1][0].toFixed(1) + " " + H + " L" + xy[0][0].toFixed(1) + " " + H + " Z", fill: "url(#sbSparkFill)" }), svg("path", { d: line, class: "sb-spark-line", pathLength: 100 }));
      const last = xy[xy.length - 1];
      chart.append(svg("circle", { cx: last[0], cy: last[1], r: 3.5, class: "sb-spark-dot" }));
      card.append(chart);
    }
    const foot = el("div", "sb-points-foot");
    foot.append(el("span", "", "累計 " + (d.points.earned === null ? "—" : comma(d.points.earned) + " pt")));
    const open = el("button", "sb-link", "›");
    open.setAttribute("aria-label", "ポイントの詳細");
    open.type = "button";
    open.onclick = () => root.openStudyPoints?.();
    foot.append(open);
    card.append(foot);
    return card;
  }

  function tile(icon, label, valueParts, tone, sub) {
    const t = el("div", "sb-tile sb-tone-" + tone);
    t.append(el("span", "sb-tile-icon", icon), el("p", "sb-label", label));
    const v = el("strong", "sb-tile-value");
    for (const [n, unit] of valueParts) v.append(el("span", "", n), el("small", "", unit));
    t.append(v);
    if (sub) t.append(el("p", "sb-tile-sub", sub));
    return t;
  }

  function studyCard(d) {
    const s = d.study;
    const card = el("section", "sb-card sb-study");
    card.append(el("h3", "sb-title", "勉強時間"));
    const grid = el("div", "sb-tiles");
    grid.append(
      tile("⏱", "今日", parts(s.today), "cyan"),
      tile("📅", "今週", parts(s.week), "violet"),
      tile("∑", "合計", parts(s.total), "gold"),
      tile("🔥", "連続", [[String(s.streak), "日"]], "flame"),
    );
    card.append(grid);
    // The last 14 days as bars, today glowing.
    const max = Math.max(60000, ...s.recent.map((r) => r.ms));
    const bars = el("div", "sb-bars");
    bars.setAttribute("role", "img");
    bars.setAttribute("aria-label", "14日間の勉強時間");
    s.recent.forEach((r, i) => {
      const col = el("div", "sb-bar" + (r.today ? " is-today" : "") + (r.ms >= 60000 ? "" : " is-zero"));
      const b = el("i");
      b.style.setProperty("--sb-h", String(Math.max(0.03, r.ms / max)));
      b.style.setProperty("--sb-i", String(i));
      b.title = r.key + " " + spoken(r.ms);
      col.append(b, el("span", "", r.today ? "今日" : String(r.label)));
      bars.append(col);
    });
    card.append(bars);
    const facts = el("dl", "sb-facts");
    const fact = (k, v) => {
      const row = el("div");
      row.append(el("dt", "", k), el("dd", "", v));
      facts.append(row);
    };
    fact("日数", s.days + "日");
    fact("最高", spoken(s.best));
    fact("平均", spoken(s.average));
    const topDay = s.weekdays.some((v) => v > 0) ? WEEK[s.weekdays.indexOf(Math.max(...s.weekdays))]  : "—";
    fact("曜日", topDay);
    card.append(facts);
    return card;
  }

  function masteryCard(d) {
    const m = d.mastery;
    const card = el("section", "sb-card sb-mastery");
    const headRow = el("div", "sb-mastery-head");
    headRow.append(el("h3", "sb-title", "理解度"));
    const pickBtn = el("button", "sb-pick-btn", "単語を選ぶ");
    pickBtn.type = "button";
    pickBtn.onclick = () => openMasteryPicker();
    headRow.append(pickBtn);
    card.append(headRow);
    if (d.selActive) {
      const note = el("div", "sb-sel-note");
      note.append(el("span", "", "選んだ単語のみ（" + comma(d.selCount) + "語）"));
      const clearBtn = el("button", "sb-sel-clear", "解除");
      clearBtn.type = "button";
      clearBtn.onclick = () => {
        writeSelection({});
        render({ quiet: true });
      };
      note.append(clearBtn);
      card.append(note);
    }
    const top = el("div", "sb-mastery-top");
    // A ring: ○ △ ×, the rest dark.
    const R = 52,
      C = 2 * Math.PI * R,
      ring = svg("svg", { viewBox: "0 0 140 140", class: "sb-donut", role: "img", "aria-label": "理解度の割合" });
    ring.append(svg("circle", { cx: 70, cy: 70, r: R, class: "sb-donut-track" }));
    let at = 0;
    [["ok", m.ok], ["so", m.so], ["bad", m.bad]].forEach(([k, v], i) => {
      if (!m.sum || !v) return;
      const len = (v / m.sum) * C;
      const seg = svg("circle", { cx: 70, cy: 70, r: R, class: "sb-donut-seg sb-seg-" + k, "stroke-dasharray": len.toFixed(2) + " " + (C - len).toFixed(2), "stroke-dashoffset": (-at).toFixed(2), style: "--sb-i:" + i });
      ring.append(seg);
      at += len;
    });
    const pct = m.sum ? Math.round((m.ok / m.sum) * 100) : 0;
    const center = el("div", "sb-donut-center");
    const p = el("strong");
    const pn = el("span");
    countUp(pn, pct);
    p.append(pn, el("small", "", "%"));
    center.append(p);
    const wrap = el("div", "sb-donut-wrap");
    wrap.append(ring, center);
    const legend = el("ul", "sb-legend");
    [["ok", "○", m.ok], ["so", "△", m.so], ["bad", "×", m.bad], ["none", "ー", m.none]].forEach(([k, label, v]) => {
      const li = el("li", "sb-leg-" + k);
      li.append(el("i"), el("span", "", label), el("b", "", comma(v)));
      legend.append(li);
    });
    top.append(wrap, legend);
    card.append(top);
    const summary = el("div", "sb-mini");
    const mini = (label, value) => {
      const x = el("div");
      x.append(el("strong", "", value), el("span", "", label));
      summary.append(x);
    };
    mini("冊", comma(d.selActive ? d.books.filter((b) => b.picked > 0).length : d.books.length));
    mini("問題", comma(m.sum));
    mini("評価", comma(d.rated));
    mini("フラッシュ", comma(d.flash));
    card.append(summary);
    // Each book: a stacked bar, the most worked on first.
    const list = el("ul", "sb-books");
    d.books
      .filter((b) => (d.selActive ? b.picked > 0 : b.ok + b.so + b.bad))
      .sort((a, b) => b.ok + b.so + b.bad - (a.ok + a.so + a.bad) || b.sum - a.sum)
      .slice(0, 6)
      .forEach((b, i) => {
        const li = el("li", "sb-book");
        li.style.setProperty("--sb-i", String(i));
        const head = el("button", "sb-book-head");
        head.type = "button";
        head.setAttribute("aria-label", b.name + "を開く");
        head.onclick = () => {
          root.switchTab?.("vocab");
          root.selectVocabLibraryBook?.(b.id);
        };
        head.append(el("span", "sb-book-cover", b.cover || "📘"), el("span", "sb-book-name", b.name), el("b", "", Math.round((b.ok / b.sum) * 100) + "%"));
        const bar = el("div", "sb-stack");
        for (const k of ["ok", "so", "bad"]) {
          const seg = el("i", "sb-seg-" + k);
          seg.style.flexGrow = String(b[k]);
          if (b[k]) bar.append(seg);
        }
        const rest = el("i", "sb-seg-none");
        rest.style.flexGrow = String(b.none);
        if (b.none) bar.append(rest);
        li.append(head, bar);
        list.append(li);
      });
    if (list.childElementCount) card.append(list);
    return card;
  }

  // Picking the words the mastery graph is built from (10.181): any number, from any books,
  // kept on this device. While a selection exists, the graph uses only those words.
  function openMasteryPicker() {
    const sel = readSelection();
    const pool = typeof textbooksPool !== "undefined" && Array.isArray(textbooksPool) ? textbooksPool : [];
    const dialog = root.openLibraryDialog("グラフに使う単語", '<div class="sb-picker"><p class="sb-picker-note">読み込んでいます…</p></div>');
    const body = dialog.querySelector(".sb-picker");
    if (!pool.length) {
      body.replaceChildren(el("p", "sb-picker-note", "単語帳がまだありません。"));
      return;
    }
    body.replaceChildren();
    const bar = el("div", "sb-picker-bar");
    const bookSel = document.createElement("select");
    bookSel.className = "sb-picker-book";
    bookSel.setAttribute("aria-label", "単語帳");
    for (const b of pool) {
      const opt = document.createElement("option");
      opt.value = String(b.id);
      opt.textContent = String(b.name || "単語帳");
      bookSel.append(opt);
    }
    const search = document.createElement("input");
    search.type = "search";
    search.className = "sb-picker-search";
    search.placeholder = "単語・意味で探す";
    search.setAttribute("aria-label", "単語・意味で探す");
    bar.append(bookSel, search);
    const actions = el("div", "sb-picker-bar");
    const allBtn = el("button", "sb-pick-btn", "この単語帳をすべて選ぶ");
    allBtn.type = "button";
    const noneBtn = el("button", "sb-pick-btn", "この単語帳をすべて外す");
    noneBtn.type = "button";
    actions.append(allBtn, noneBtn);
    const list = el("div", "sb-picker-list");
    const foot = el("div", "sb-picker-foot");
    const count = el("span", "sb-picker-count");
    const done = el("button", "sb-pick-btn is-done", "完了");
    done.type = "button";
    foot.append(count, done);
    body.append(bar, actions, list, foot);
    const drawCount = () => {
      count.textContent = "選択中：合計" + comma(selectionCount(sel)) + "語";
    };
    const words = () => safe(() => root.getTextbookWordList(bookSel.value), []) || [];
    function drawList() {
      const picked = new Set(sel[bookSel.value] || []);
      const q = search.value.trim().toLowerCase();
      const matched = words().filter((w) => !q || String(w.word || "").toLowerCase().includes(q) || String(w.meaning || "").toLowerCase().includes(q) || (Array.isArray(w.meanings) && w.meanings.some((m) => String(m.text || "").toLowerCase().includes(q))));
      list.replaceChildren();
      if (!matched.length) {
        list.append(el("p", "sb-picker-note", "単語が見つかりません。"));
        return;
      }
      const shown = matched.slice(0, 300);
      for (const w of shown) {
        const row = el("label", "sb-pick-row");
        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = picked.has(String(w.num));
        box.onchange = () => {
          const set = new Set(sel[bookSel.value] || []);
          if (box.checked) set.add(String(w.num));
          else set.delete(String(w.num));
          if (set.size) sel[bookSel.value] = [...set];
          else delete sel[bookSel.value];
          writeSelection(sel);
          drawCount();
        };
        const text = el("span", "sb-pick-text");
        const first = (Array.isArray(w.meanings) && w.meanings[0] && w.meanings[0].text) || w.meaning || "";
        text.append(el("b", "", "#" + w.num + " " + String(w.word || "")), el("small", "", String(first)));
        row.append(box, text);
        list.append(row);
      }
      if (matched.length > shown.length) list.append(el("p", "sb-picker-note", "上位" + shown.length + "件まで表示しています。検索で絞り込んでください（選択数に上限はありません）。"));
    }
    allBtn.onclick = () => {
      const all = words().map((w) => String(w.num));
      if (all.length) sel[bookSel.value] = all;
      else delete sel[bookSel.value];
      writeSelection(sel);
      drawCount();
      drawList();
    };
    noneBtn.onclick = () => {
      delete sel[bookSel.value];
      writeSelection(sel);
      drawCount();
      drawList();
    };
    bookSel.onchange = drawList;
    search.oninput = drawList;
    done.onclick = () => root.closeLibraryDialog?.();
    dialog.addEventListener("close", () => render({ quiet: true }));
    drawCount();
    drawList();
  }

  let timer = 0;
  // A redraw while the card is open (new data) is quiet: no entrance, no count-up. And the page keeps its height
  // while the card is swapped: on iPhone, a page that shrinks for a moment under the player's scroll left the
  // fixed tab bar and header stuck in the middle of the screen (10.158).
  function render(opts = {}) {
    const host = document.getElementById("statusBoard");
    if (!host) return;
    quiet = !!opts.quiet;
    const d = collect();
    const now = new Date();
    const head = el("header", "sb-head");
    head.append(el("span", "sb-head-date", now.getMonth() + 1 + "/" + now.getDate() + " " + WEEK[now.getDay()]));
    const keep = host.offsetHeight;
    if (keep) host.style.minHeight = keep + "px";
    // The planner (planner.js, 10.163) at the bottom of the tab, as the player asked; its countdowns stay
    // under the player card. Both are the same nodes each time, so they keep their state.
    const planner = root.Planner ? safe(() => root.Planner.card(), null) : null;
    const countdown = root.Planner?.countdown ? safe(() => root.Planner.countdown(), null) : null;
    host.replaceChildren(...[head, hero(d), countdown, pointsCard(d), studyCard(d), masteryCard(d), planner].filter(Boolean));
    host.style.minHeight = "";
    quiet = false;
    if (opts.quiet) return;
    host.classList.remove("sb-enter");
    void host.offsetWidth;
    host.classList.add("sb-enter");
  }
  function active() {
    return document.getElementById("view-status")?.classList.contains("active");
  }
  // What the card is drawn from, cheaply (no parsing): when it changes, the card is drawn again. It covers the
  // account, the books arriving, cloud study time and ratings coming in (userStats), and the points record.
  function signature() {
    const pool = typeof textbooksPool !== "undefined" && Array.isArray(textbooksPool) ? textbooksPool.length : 0,
      stats = typeof userStats === "object" && userStats ? userStats : {};
    // (Study time in 5-minute steps: a warm-up over the card adds seconds all the time.)
    return [me(), pool, Math.floor(num(stats.study_total_secs) / 300), stats.vocab_rated_count, stats.flash_count, safe(() => localStorage.getItem("core_v4_study_points_" + me()) || "", ""), safe(() => (localStorage.getItem("aiglish_planner_" + me()) || "").length, 0), safe(() => localStorage.getItem("aiglish_mastery_selection_" + me()) || "", "")].join("|");
  }
  let last = "";
  function start(opts) {
    last = signature();
    render(opts);
    clearInterval(timer);
    // Today's time moves while the card is open: refresh that tile now and then (quietly, no count-up).
    timer = setInterval(() => {
      if (!active() || document.visibilityState !== "visible") return;
      const tile = document.querySelector("#statusBoard .sb-tone-cyan .sb-tile-value"),
        stats = typeof userStats === "object" && userStats ? userStats : {};
      if (tile) tile.replaceChildren(...parts(num(stats.study_today_secs) * 1000).flatMap(([n, u]) => [el("span", "", n), el("small", "", u)]));
    }, 30000);
  }
  if (root.onTabChange)
    root.onTabChange((tab) => {
      if (tab === "status") start();
      else clearInterval(timer);
    });
  // The card is the first screen: drawn at once with what this device has (so it is never blank while a book
  // loads), when the player's data is in, and again whenever what it shows changes (cloud stats, a rating in the
  // warm-up over it, points, another account).
  let scrolledAt = 0;
  // (The card scrolls inside its own view, not the page.)
  document.getElementById("view-status")?.addEventListener("scroll", () => (scrolledAt = performance.now()), { passive: true });
  if (active()) start();
  // Books arriving in the background are not a reason to draw the card again with its entrance: that read as
  // the screen refreshing itself. Only a real change in what the card shows redraws it, and always quietly.
  root.addEventListener?.("learning-data-ready", () => {
    if (!active() || signature() === last) return;
    start({ quiet: true });
  });
  setInterval(() => {
    if (!active() || document.visibilityState !== "visible" || document.hidden) return;
    // (Not while the player is scrolling: it waits until the page is still.)
    if (signature() !== last && performance.now() - scrolledAt > 1500) start({ quiet: true });
  }, 1500);
  root.StatusBoard = Object.freeze({ collect, render });
})(window);
