// The planner on the ステータス tab (10.163): a week or month calendar to write on (tests, events, notes), plans that
// spread a range of a word book or a workbook over days, each day's list to tick off (done by hand, or by itself
// once every word / problem of the day's range has a rating), and an AI prompt whose answer is imported at once.
// Data: localStorage "aiglish_planner_<id>" (PlannerModel; it goes to the cloud with the full save).
(function (root) {
  "use strict";
  const P = root.PlannerModel;
  if (!P) return;
  const uid = () => (typeof myId === "string" && myId) || "GUEST-000";
  const key = () => "aiglish_planner_" + uid();
  const WEEK = ["日", "月", "火", "水", "木", "金", "土"];
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const today = () => P.dateKey(Date.now());

  // ---- Storage ----
  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(key()) || "{}");
      return { ...P.clean(raw), updatedAt: Number(raw.updatedAt) || 0 };
    } catch {
      return { ...P.clean({}), updatedAt: 0 };
    }
  }
  let dirty = false;
  function write(data) {
    try {
      localStorage.setItem(key(), JSON.stringify({ ...P.clean(data), updatedAt: Date.now() }));
    } catch (error) {
      say("保存できませんでした（端末の空きが足りないかもしれません）。");
      return false;
    }
    root.queueBackgroundSave?.();
    dirty = true;
    return true;
  }
  // Changed while the card was open: the cloud save runs when the player leaves the ステータス tab.
  // (Also when the app goes to the background while still here.)
  const flush = () => {
    if (!dirty) return;
    dirty = false;
    root.saveAfterStudy?.("planner-end");
  };
  root.onTabChange?.((tab) => tab !== "status" && flush());
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());

  // ---- The player's books and works ----
  const works = () => {
    try {
      return (root.workbookList?.() || []).filter((w) => w && w.id);
    } catch {
      return [];
    }
  };
  // Test days set on works (their 「テスト日」) are shown as tests, read only (they are kept on the work).
  function workTests() {
    return works()
      .filter((w) => P.day(w.testDate))
      .map((w) => ({ id: "work-test-" + w.id, date: P.day(w.testDate), kind: "test", title: String(w.name || "ワーク") + " テスト", memo: "", at: 1, readonly: true }));
  }
  // The data to show: the planner's own, with the works' test days.
  const view = (data) => ({ ...data, events: [...data.events, ...workTests()] });
  function books() {
    const pool = typeof textbooksPool !== "undefined" && Array.isArray(textbooksPool) ? textbooksPool : [];
    return [...pool.map((b) => ({ type: "vocab", id: String(b.id), name: String(b.name || "単語帳") })), ...works().map((w) => ({ type: "work", id: String(w.id), name: String(w.name || "ワーク") }))];
  }
  // What one draw reads, once per book (a book's words and its ratings are large).
  let memo = null;
  const once = (k, fn) => {
    if (!memo) return fn();
    if (!memo.has(k)) memo.set(k, fn());
    return memo.get(k);
  };
  function vocabWords(bookId) {
    return once("w:" + bookId, () => readWords(bookId));
  }
  function readWords(bookId) {
    if (typeof currentTextbook !== "undefined" && bookId === currentTextbook && typeof vocabList !== "undefined" && Array.isArray(vocabList) && vocabList.length) return vocabList;
    for (const k of ["core_v4_user_vocab_book_" + uid() + "_" + bookId, "core_v4_custom_words_" + uid() + "_" + bookId, "core_v4_cache_" + bookId]) {
      try {
        const list = JSON.parse(localStorage.getItem(k) || "null");
        if (Array.isArray(list) && list.length) return list;
      } catch {}
    }
    return typeof textbooksCacheMap !== "undefined" && Array.isArray(textbooksCacheMap?.[bookId]) ? textbooksCacheMap[bookId] : [];
  }
  // How far a day's range is done: { done, total } (rated words / problems), or null when it cannot be told.
  function progress(task) {
    const { source } = task.plan;
    if (source.type === "vocab") {
      // A 用語・年号 book keeps its ratings by question elsewhere: not counted here (ticked by hand).
      if (root.TermProgress?.enabled?.(source.id)) return null;
      const words = vocabWords(source.id).filter((w) => {
        const no = root.VocabOrder ? root.VocabOrder.no(w) : Number(w.num);
        return no >= task.from && no <= task.to;
      });
      if (!words.length) return null;
      const saved = once("p:" + source.id, () => {
        try {
          return JSON.parse(localStorage.getItem(root.getVocabProgressStorageKey ? root.getVocabProgressStorageKey(source.id) : "") || "{}") || {};
        } catch {
          return {};
        }
      });
      const rated = (w) => {
        const p = saved[String(w.num)];
        if (p && p.status && p.status !== "none") return true;
        if (p && p.meanings && Object.values(p.meanings).some((m) => m && m.status && m.status !== "none")) return true;
        return (w.meanings || []).some((m) => m.status && m.status !== "none") || (w.status && w.status !== "none");
      };
      return { done: words.filter(rated).length, total: words.length };
    }
    if (source.type === "work") {
      const work = once("works", works).find((w) => w.id === source.id);
      if (!work) return null;
      const list = root.WorkbookModel?.visibleUnits ? root.WorkbookModel.visibleUnits(work) : work.units || [];
      const units = list.filter((u) => u && Number(u.num) >= task.from && Number(u.num) <= task.to);
      if (!units.length) return null;
      // Only what was rated on or after the plan's first day counts (a work keeps when each problem was rated).
      const since = new Date(task.plan.start + "T00:00:00").getTime();
      return { done: units.filter((u) => u.status && u.status !== "none" && Number(u.lastReview) >= since).length, total: units.length };
    }
    return null;
  }
  // Ticked or unticked by hand decides; otherwise done once everything in the range is rated.
  const isDone = (task, p = progress(task)) => (task.manual ? task.checked : !!(p && p.total && p.done >= p.total));
  function open(task) {
    const { source } = task.plan;
    if (source.type === "work") {
      if (!root.openWorkbookRange?.(source.id, task.from, task.to)) say("このワークが見つかりません。");
      return;
    }
    if (source.type === "vocab") {
      if (!books().some((b) => b.type === "vocab" && b.id === source.id)) return say("この単語帳が見つかりません。");
      root.switchTab?.("vocab");
      Promise.resolve(root.openBookFlashcardSettings?.(source.id)).then(() => {
        const start = document.getElementById("flashcardRangeStart"),
          end = document.getElementById("flashcardRangeEnd");
        if (start && end) {
          start.value = String(Math.max(1, task.from));
          end.value = String(Math.max(1, task.to));
        }
        const unit = document.getElementById("flashcardUnitSelect");
        if (unit) unit.value = "";
      });
    }
  }

  // ---- Screen state ----
  let mode = "week",
    selected = today(),
    host = null,
    note = "";
  try {
    mode = localStorage.getItem("aiglish_planner_view") === "month" ? "month" : "week";
  } catch {}
  function say(text) {
    note = text;
    draw();
  }
  function range() {
    if (mode === "week") {
      const d = new Date(P.dateKey(new Date(selected + "T00:00:00")) + "T00:00:00");
      d.setDate(d.getDate() - d.getDay());
      const from = P.dateKey(d);
      return { from, to: P.addDays(from, 6), days: Array.from({ length: 7 }, (_, i) => P.addDays(from, i)) };
    }
    const first = new Date(selected + "T00:00:00");
    first.setDate(1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const from = P.dateKey(start),
      days = Array.from({ length: 42 }, (_, i) => P.addDays(from, i));
    return { from, to: days[41], days, month: first.getMonth() };
  }
  // The next tests from today, nearest first: [{ title, date, days }].
  function upcomingTests(data, limit = 3) {
    const t = today();
    return P.live(view(data).events)
      .filter((e) => e.kind === "test" && e.date >= t)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .slice(0, limit)
      .map((e) => ({ ...e, days: P.daysBetween(t, e.date) }));
  }
  const nextTest = (data) => upcomingTests(data, 1)[0] || null;

  // ---- Drawing ----
  // One card for the life of the page: the status board puts this same node back when it redraws, so what the player
  // is doing here (the day picked, week or month) is kept.
  let owner = "";
  function card() {
    if (!host) {
      host = el("section", "sb-card sb-planner");
      host.setAttribute("aria-label", "予定");
    }
    if (owner !== uid()) {
      owner = uid();
      selected = today();
    }
    draw();
    return host;
  }
  function draw() {
    if (!host) return;
    memo = new Map();
    try {
      paint();
    } finally {
      memo = null;
    }
  }
  function paint() {
    const data = read(),
      t = today(),
      r = range(),
      marks = P.marks(view(data), r.from, r.to),
      det = P.details(view(data), r.from, r.to);
    const head = el("div", "pl-head");
    const title = el("h3", "sb-title", "予定");
    const toggle = el("div", "pl-toggle");
    toggle.setAttribute("role", "group");
    toggle.setAttribute("aria-label", "表示");
    for (const [value, label] of [["week", "週"], ["month", "月"]]) {
      const b = el("button", value === mode ? "is-on" : "", label);
      b.type = "button";
      b.setAttribute("aria-pressed", String(value === mode));
      b.onclick = () => {
        mode = value;
        try {
          localStorage.setItem("aiglish_planner_view", mode);
        } catch {}
        draw();
      };
      toggle.append(b);
    }
    head.append(title, toggle);
    const nodes = [head];
    for (const test of upcomingTests(data)) {
      const countdown = el("p", "pl-countdown" + (test.days <= 3 ? " is-near" : ""));
      countdown.append(el("b", "", test.days === 0 ? "今日" : "あと" + test.days + "日"), el("span", "", test.title));
      nodes.push(countdown);
    }
    // The month or week, with arrows.
    const nav = el("div", "pl-nav");
    const prev = el("button", "", "‹"),
      next = el("button", "", "›"),
      label = el("span", "pl-label");
    prev.type = next.type = "button";
    prev.setAttribute("aria-label", mode === "week" ? "前の週" : "前の月");
    next.setAttribute("aria-label", mode === "week" ? "次の週" : "次の月");
    const shift = (n) => {
      if (mode === "week") selected = P.addDays(selected, 7 * n);
      else {
        const d = new Date(selected + "T00:00:00");
        d.setDate(1);
        d.setMonth(d.getMonth() + n);
        selected = P.dateKey(d);
      }
      draw();
    };
    prev.onclick = () => shift(-1);
    next.onclick = () => shift(1);
    const sel = new Date(selected + "T00:00:00");
    label.textContent = sel.getFullYear() + "年" + (sel.getMonth() + 1) + "月";
    const back = el("button", "pl-today", "今日");
    back.type = "button";
    back.onclick = () => {
      selected = t;
      draw();
    };
    nav.append(prev, label, next, back);
    nodes.push(nav);
    const grid = el("div", "pl-grid pl-" + mode);
    for (const w of WEEK) grid.append(el("span", "pl-wd", w));
    for (const date of r.days) {
      const d = new Date(date + "T00:00:00"),
        m = marks[date];
      const cell = el("button", "pl-day" + (date === t ? " is-today" : "") + (date === selected ? " is-selected" : "") + (mode === "month" && d.getMonth() !== r.month ? " is-out" : "") + (m?.tests ? " has-test" : "") + (d.getDay() === 0 ? " is-sun" : d.getDay() === 6 ? " is-sat" : ""));
      cell.type = "button";
      cell.dataset.date = date;
      cell.setAttribute("aria-label", d.getMonth() + 1 + "月" + d.getDate() + "日" + (m ? "（" + [m.tests && "テスト" + m.tests, m.events && "予定" + m.events, m.tasks && "やること" + m.tasks].filter(Boolean).join("・") + "）" : ""));
      cell.append(el("b", "", String(d.getDate())));
      const items = (det[date] || []).filter((item) => item.kind !== "task");
      if (items.length) {
        const chips = el("span", "pl-chips");
        const limit = mode === "week" ? 3 : 2;
        for (const item of items.slice(0, limit)) chips.append(el("span", "pl-chip pl-chip-" + item.kind, item.title));
        if (items.length > limit) chips.append(el("span", "pl-more", "+" + (items.length - limit)));
        cell.append(chips);
      }
      cell.onclick = () => {
        selected = date;
        draw();
      };
      grid.append(cell);
    }
    nodes.push(grid);
    nodes.push(dayPanel(data, selected));
    const tools = el("div", "pl-tools");
    for (const [label, fn] of [["＋ 書く", () => eventForm()], ["＋ 計画", () => planForm()], ["AIで計画", () => aiForm()]]) {
      const b = el("button", "", label);
      b.type = "button";
      b.onclick = fn;
      tools.append(b);
    }
    nodes.push(tools);
    if (note) nodes.push(el("p", "pl-note", note));
    note = "";
    host.replaceChildren(...nodes);
  }
  function dayPanel(data, date) {
    const box = el("div", "pl-daybox");
    const d = new Date(date + "T00:00:00");
    box.append(el("h4", "", (date === today() ? "今日 " : "") + (d.getMonth() + 1) + "/" + d.getDate() + "（" + WEEK[d.getDay()] + "）"));
    const { events, tasks } = P.on(view(data), date);
    // On today: earlier days' shares not done yet (by hand or by ratings) come back here.
    const late = date === today() ? P.overdue(data, date, (t) => isDone(t)) : [];
    if (!events.length && !tasks.length && !late.length) box.append(el("p", "pl-empty", "なし"));
    const list = el("ul", "pl-list");
    for (const e of events) {
      const li = el("li", "pl-event pl-kind-" + e.kind);
      li.append(el("span", "pl-badge", P.KINDS[e.kind]));
      const text = el("span", "pl-text");
      text.append(el("b", "", e.title));
      if (e.memo) text.append(el("small", "", e.memo));
      li.append(text);
      if (!e.readonly) {
        const edit = el("button", "pl-mini", "…");
        edit.type = "button";
        edit.setAttribute("aria-label", e.title + "を直す");
        edit.onclick = () => eventForm(e);
        li.append(edit);
      }
      list.append(li);
    }
    for (const task of [...late, ...tasks]) {
      const p = progress(task),
        done = isDone(task, p),
        overdue = task.date < date;
      const li = el("li", "pl-task" + (done ? " is-done" : "") + (overdue ? " is-late" : ""));
      const tick = el("input");
      tick.type = "checkbox";
      tick.checked = done;
      tick.setAttribute("aria-label", task.plan.title + "を終えた");
      tick.onchange = () => {
        write(P.check(read(), task.key, tick.checked));
        draw();
      };
      const text = el("span", "pl-text");
      const what = task.plan.title + " " + (task.from === task.to ? task.from : task.from + "–" + task.to);
      text.append(el("b", "", what));
      const info = [overdue ? (Number(task.date.slice(5, 7)) + "/" + Number(task.date.slice(8))) + "の分" : "", p ? p.done + "/" + p.total : ""].filter(Boolean).join("・");
      if (info) text.append(el("small", "", info));
      li.append(tick, text);
      if (task.plan.source.type !== "free") {
        const go = el("button", "pl-go", "開く");
        go.type = "button";
        go.onclick = () => open(task);
        li.append(go);
      }
      const more = el("button", "pl-mini", "…");
      more.type = "button";
      more.setAttribute("aria-label", task.plan.title + "の計画");
      more.onclick = () => planInfo(task.plan);
      li.append(more);
      list.append(li);
    }
    if (list.children.length) box.append(list);
    return box;
  }

  // ---- Forms ----
  function dialog(title, html) {
    return root.openLibraryDialog(title, html);
  }
  function eventForm(e) {
    const modal = dialog(e ? "予定を直す" : "書く", '<form class="pl-form"><label>日付<input name="date" type="date" required value="' + esc(e?.date || selected) + '"></label><label>種類<select name="kind">' + Object.entries(P.KINDS).map(([k, v]) => '<option value="' + k + '"' + ((e?.kind || "event") === k ? " selected" : "") + ">" + v + "</option>").join("") + '</select></label><label>内容<input name="title" maxlength="60" required value="' + esc(e?.title || "") + '" placeholder="例: 英語の小テスト"></label><label>メモ<textarea name="memo" maxlength="300" rows="2" placeholder="範囲など（なくてもOK）">' + esc(e?.memo || "") + '</textarea></label><p class="library-editor-error" role="alert"></p><div class="library-editor-actions">' + (e ? '<button type="button" class="pl-delete">消す</button>' : "") + '<button type="button" data-library-close>キャンセル</button><button type="submit" class="library-editor-primary">保存</button></div></form>');
    const form = modal.querySelector("form");
    form.onsubmit = (event) => {
      event.preventDefault();
      const f = form.elements,
        date = P.day(f.date.value);
      if (!date) return (modal.querySelector(".library-editor-error").textContent = "日付を入れてください。");
      if (!e && !P.room(read(), "events")) return (modal.querySelector(".library-editor-error").textContent = "予定がいっぱいです（" + P.MAX_EVENTS + "件まで）。古い予定を消してください。");
      if (!write(P.addEvent(read(), { id: e?.id, date, kind: f.kind.value, title: f.title.value, memo: f.memo.value }))) return;
      selected = date;
      root.closeLibraryDialog?.();
      draw();
    };
    const del = modal.querySelector(".pl-delete");
    if (del)
      del.onclick = () => {
        write(P.remove(read(), "events", e.id));
        root.closeLibraryDialog?.();
        draw();
      };
  }
  function planForm() {
    const list = books(),
      data = read(),
      test = nextTest(data);
    const end = test ? P.addDays(test.date, -1) > today() ? P.addDays(test.date, -1) : test.date : P.addDays(today(), 6);
    const options =
      (list.some((b) => b.type === "vocab") ? '<optgroup label="単語帳">' + list.filter((b) => b.type === "vocab").map((b) => '<option value="vocab:' + esc(b.id) + '">' + esc(b.name) + "</option>").join("") + "</optgroup>" : "") +
      (list.some((b) => b.type === "work") ? '<optgroup label="ワーク">' + list.filter((b) => b.type === "work").map((b) => '<option value="work:' + esc(b.id) + '">' + esc(b.name) + "</option>").join("") + "</optgroup>" : "") +
      '<option value="free:">ほか（自由に書く）</option>';
    const modal = dialog("計画を作る", '<form class="pl-form"><label>何を<select name="source">' + options + '</select></label><label class="pl-free" hidden>名前<input name="title" maxlength="60" placeholder="例: 教科書 p."></label><div class="pl-row"><label>番号<input name="from" type="number" min="1" required value="1"></label><span>〜</span><label>　<input name="to" type="number" min="1" required value="100"></label></div><div class="pl-row"><label>いつから<input name="start" type="date" required value="' + today() + '"></label><label>いつまで<input name="end" type="date" required value="' + end + '"></label></div><p class="library-editor-hint">毎日同じくらいの量に分けて、その日のやることに出します。</p><p class="library-editor-error" role="alert"></p><div class="library-editor-actions"><button type="button" data-library-close>キャンセル</button><button type="submit" class="library-editor-primary">作る</button></div></form>');
    const form = modal.querySelector("form"),
      f = form.elements;
    const sync = () => {
      const free = f.source.value.startsWith("free:");
      modal.querySelector(".pl-free").hidden = !free;
      f.title.required = free;
    };
    f.source.onchange = sync;
    sync();
    form.onsubmit = (event) => {
      event.preventDefault();
      const [type, id] = [f.source.value.split(":")[0], f.source.value.slice(f.source.value.indexOf(":") + 1)];
      const book = list.find((b) => b.type === type && b.id === id);
      const plan = { source: book ? { type, id, name: book.name } : { type: "free", name: f.title.value }, title: book ? book.name : f.title.value, from: Number(f.from.value), to: Number(f.to.value), start: f.start.value, end: f.end.value };
      if (!P.room(read(), "plans")) return (modal.querySelector(".library-editor-error").textContent = "計画がいっぱいです（" + P.MAX_PLANS + "件まで）。終わった計画を消してください。");
      const planId = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        next = P.addPlan(read(), { ...plan, id: planId });
      if (!P.live(next.plans).some((p) => p.id === planId))
        return (modal.querySelector(".library-editor-error").textContent = "番号（はじめ ≦ おわり、5000個まで）と日付（いつから ≦ いつまで、1年以内）を確かめてください。");
      if (!write(next)) return;
      selected = plan.start;
      root.closeLibraryDialog?.();
      draw();
    };
  }
  function planInfo(plan) {
    const parts = P.split(plan);
    const modal = dialog(plan.title, '<div class="pl-form"><p>' + esc(plan.source.type === "free" ? plan.title : plan.source.name) + " " + plan.from + "〜" + plan.to + "</p><p>" + plan.start.replace(/-/g, "/") + " 〜 " + plan.end.replace(/-/g, "/") + "（" + parts.length + "日・1日 約" + Math.ceil((plan.to - plan.from + 1) / Math.max(1, parts.length)) + "）</p>" + '<div class="library-editor-actions"><button type="button" class="pl-delete">この計画を消す</button><button type="button" data-library-close>閉じる</button></div></div>');
    modal.querySelector(".pl-delete").onclick = () => {
      write(P.remove(read(), "plans", plan.id));
      root.closeLibraryDialog?.();
      draw();
    };
  }
  function prompt() {
    const list = books(),
      tests = P.live(read().events).filter((e) => e.kind === "test" && e.date >= today());
    return [
      "あなたは勉強の計画を立てる手伝いをします。下の「私の予定・やりたいこと」を、学習アプリのカレンダーに取り込める形のJSONにしてください。",
      "",
      "【出力】次の形のJSONだけを返してください。説明文は書かないでください。",
      '{"events":[{"date":"YYYY-MM-DD","kind":"test","title":"内容","memo":"範囲など"}],"plans":[{"title":"短い名前","book":"教材名","from":1,"to":100,"start":"YYYY-MM-DD","end":"YYYY-MM-DD"}]}',
      "",
      "【events：カレンダーに書く予定】",
      "・テストは kind を \"test\"、ほかの予定は \"event\"、ちょっとしたメモは \"note\"。",
      "・title は短く（20字くらい）。範囲や持ち物などは memo に。",
      "",
      "【plans：毎日に分ける勉強】",
      "・「この教材の何番から何番を、いつからいつまでにやる」を1つずつ。アプリが毎日同じくらいの量に分けます。",
      "・book は下の「私の教材」の名前をそのまま書く。ないものは教材の名前をそのまま書く（アプリでは自由な計画になります）。",
      "・from / to は問題番号・単語番号（整数）。ページで決めているときはページ番号。",
      "・end はテストの前日までにする。量が多すぎる日ができないように、期間と範囲を調整する。",
      "・同じ教材でも、期間を分けたいときは plans を分ける（例：1〜200 を前半、201〜400 を後半）。",
      "",
      "【日付】今日は " + today() + "。日付は必ず YYYY-MM-DD で書く。",
      "",
      "【私の教材】",
      ...(list.length ? list.map((b) => "・" + b.name + "（" + (b.type === "vocab" ? "単語帳" : "ワーク") + "）") : ["・（まだありません）"]),
      ...(tests.length ? ["", "【もう決まっているテスト】", ...tests.map((e) => "・" + e.date + " " + e.title)] : []),
      "",
      "【私の予定・やりたいこと】",
      "（ここに書いてください）",
    ].join("\n");
  }
  function aiForm() {
    const modal = dialog("AIで計画", '<div class="pl-form"><p class="library-editor-hint">1. 下のボタンでプロンプトをコピーして、AI（ChatGPT など）に貼り、最後に予定ややりたいことを書いて送ります。<br>2. AIの答えをそのまま下に貼り付けて「取り込む」を押します。</p><button type="button" class="pl-copy">プロンプトをコピー</button><textarea class="pl-paste" rows="6" placeholder="AIの答え（{ から } まで）"></textarea><p class="library-editor-error" role="alert"></p><div class="library-editor-actions"><button type="button" data-library-close>閉じる</button><button type="button" class="library-editor-primary pl-import">取り込む</button></div></div>');
    const copy = modal.querySelector(".pl-copy");
    copy.onclick = async () => {
      const text = prompt();
      try {
        await navigator.clipboard.writeText(text);
        copy.textContent = "コピーしました";
      } catch {
        const area = el("textarea", "library-prompt-fallback");
        area.readOnly = true;
        area.value = text;
        copy.after(area);
        area.select();
        copy.textContent = "下の文を選択してコピーしてください";
      }
    };
    modal.querySelector(".pl-import").onclick = () => {
      const error = modal.querySelector(".library-editor-error");
      try {
        const result = P.importAi(modal.querySelector(".pl-paste").value, read(), books());
        if (!result.events && !result.plans) return (error.textContent = "取り込めるものがありませんでした。");
        if (!write(result.data)) return;
        root.closeLibraryDialog?.();
        say("予定 " + result.events + "件・計画 " + result.plans + "件を取り込みました。" + (result.free.length ? "（" + result.free.join("、") + " は自由な計画）" : "") + (result.skipped.length ? "（取り込めなかった: " + result.skipped.join("、") + "）" : ""));
      } catch (e) {
        error.textContent = e.message;
      }
    };
  }
  root.Planner = Object.freeze({ card, draw, read, prompt, progress, books, key });
})(window);
