// The points graph: each player's balance at the end of every day, kept on users/{id} as
// pointTrend { "YYYY-MM-DD": balance } (Japan days) and written in the same transactions that
// write studyPoints, so it costs no extra writes. Only the days since 10.138.00.00 are known:
// nothing older was kept. Days older than KEEP are deleted as new ones are written.
(function (root) {
  "use strict";
  const KEEP = 120,
    DAY = 864e5;
  const day = (now = Date.now()) => new Date(now + 9 * 3600000).toISOString().slice(0, 10);
  const shift = (key, n) => new Date(Date.parse(key + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
  const isDay = (key) => /^\d{4}-\d{2}-\d{2}$/.test(key) && !Number.isNaN(Date.parse(key + "T00:00:00Z"));
  const isPoints = (v) => Number.isSafeInteger(v) && v >= 0 && v <= 1e12;
  // A pointTrend read back from someone's document: whole, sane balances on real days only.
  function clean(map) {
    const out = {};
    if (!map || typeof map !== "object" || Array.isArray(map)) return out;
    for (const [key, value] of Object.entries(map)) if (isDay(key) && isPoints(Number(value))) out[key] = Number(value);
    return out;
  }
  // The fields to merge into users/{id} with studyPoints: today's balance, and the days just
  // past KEEP removed (a stretch of 60, so a gap of up to two months in playing still clears them).
  function entry(balance, now = Date.now(), remove = root.fbDeleteField) {
    if (!isPoints(balance)) return {};
    const today = day(now),
      trend = { [today]: balance };
    if (typeof remove === "function") for (let n = KEEP; n < KEEP + 60; n++) trend[shift(today, -n)] = remove();
    return { pointTrend: trend };
  }
  // One value per day for the last `days` days ending today: the balance at the end of that day
  // (a day without a change carries the one before), null before anything was recorded. `current`
  // (the balance read now) stands for today.
  function series(map, days, now = Date.now(), current) {
    const trend = clean(map),
      today = day(now),
      first = shift(today, -(days - 1)),
      keys = Object.keys(trend).sort();
    let last = null;
    for (const key of keys) if (key < first) last = trend[key];
    const out = [];
    for (let i = 0; i < days; i++) {
      const key = shift(first, i);
      if (Object.hasOwn(trend, key)) last = trend[key];
      out.push({ day: key, value: key === today && isPoints(current) ? current : last });
    }
    return out;
  }
  // The change of each day from the day before (null where either is unknown).
  function deltas(list) {
    return list.map((p, i) => ({ day: p.day, value: i && p.value !== null && list[i - 1].value !== null ? p.value - list[i - 1].value : null }));
  }
  // Rounded steps for the side of the chart: about `count` ticks covering lo..hi.
  function ticks(lo, hi, count = 4) {
    if (lo === hi) [lo, hi] = [lo - 1, hi + 1];
    const raw = (hi - lo) / count,
      mag = 10 ** Math.floor(Math.log10(raw)),
      step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
    const out = [];
    for (let v = Math.floor(lo / step) * step; v <= hi + step / 2; v += step) out.push(Math.round(v));
    if (out[out.length - 1] < hi) out.push(out[out.length - 1] + step);
    return out;
  }
  const model = { KEEP, day, shift, clean, entry, series, deltas, ticks };
  if (typeof module === "object" && module.exports) {
    module.exports = model;
    return;
  }

  // ---- The graph (a tab of the points dialog) ----
  const COLORS = ["#e5cf91", "#60a5fa", "#f87171", "#34d399", "#c084fc", "#fb923c", "#f472b6", "#22d3ee"];
  const MAX = COLORS.length;
  const SVG = "http://www.w3.org/2000/svg";
  const fmt = (n) => (n < 0 ? "−" : "") + Math.abs(n).toLocaleString("ja-JP");
  const me = () => (typeof myId === "string" && myId ? myId : "GUEST-000");
  const prefKey = () => "aiglish_point_trend_view_" + me();
  const readPref = () => {
    try {
      const v = JSON.parse(localStorage.getItem(prefKey()) || "{}");
      return v && typeof v === "object" ? v : {};
    } catch {
      return {};
    }
  };
  const writePref = (v) => {
    try {
      localStorage.setItem(prefKey(), JSON.stringify(v));
    } catch {}
  };
  let cache = null; // { at, owner, players: [{ id, name, points, trend }] }
  const node = (tag, text, cls) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  };
  const svg = (tag, attrs = {}) => {
    const el = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };
  // The players of the last 30 days (as the ranking lists them), with their balances and graphs.
  async function players() {
    if (cache && cache.owner === me() && Date.now() - cache.at < 5 * 60e3) return cache.players;
    const recent = root.UserDirectory?.recent;
    const rows = recent ? await recent(Date.now() - 30 * DAY, [], { fields: ["playerName", "name", "deleted", "lastActiveAt", "studyPoints", "pointTrend"] }) : null;
    if (!rows) throw Error("ほかの人の記録を読み込めませんでした。");
    // The player's own row carries the days written from other devices.
    const own = rows.find((r) => r.id === me());
    if (own) mergeOwn(clean(own.data?.pointTrend));
    const list = rows
      .filter((r) => r.id && r.id !== me() && r.data && !r.data.deleted)
      .map((r) => ({ id: r.id, name: String(r.data.playerName || r.data.name || "名前なし").slice(0, 40), points: isPoints(Number(r.data.studyPoints)) ? Number(r.data.studyPoints) : null, trend: clean(r.data.pointTrend) }))
      .sort((a, b) => (b.points ?? -1) - (a.points ?? -1));
    cache = { at: Date.now(), owner: me(), players: list };
    return list;
  }
  function mine() {
    let points = null;
    try {
      points = root.StudyPoints?.balance?.();
    } catch {}
    let trend = {};
    try {
      trend = clean(JSON.parse(localStorage.getItem("aiglish_point_trend_" + me()) || "{}"));
    } catch {}
    return { id: me(), name: "自分", points: isPoints(points) ? points : null, trend, self: true };
  }
  // Keeps the player's own days on the device too, so the graph shows them before the cloud is read.
  function remember(balance, now = Date.now()) {
    if (!isPoints(balance) || me() === "GUEST-000") return;
    try {
      const key = "aiglish_point_trend_" + me(),
        trend = clean(JSON.parse(localStorage.getItem(key) || "{}")),
        first = shift(day(now), -(KEEP - 1));
      trend[day(now)] = balance;
      for (const k of Object.keys(trend)) if (k < first) delete trend[k];
      localStorage.setItem(key, JSON.stringify(trend));
    } catch {}
  }
  function mergeOwn(trend) {
    if (me() === "GUEST-000") return;
    try {
      const key = "aiglish_point_trend_" + me(),
        kept = clean(JSON.parse(localStorage.getItem(key) || "{}")),
        first = shift(day(), -(KEEP - 1));
      // The device's own record wins for a day it wrote (it is the newer one there).
      const merged = { ...trend, ...kept };
      for (const k of Object.keys(merged)) if (k < first) delete merged[k];
      localStorage.setItem(key, JSON.stringify(merged));
    } catch {}
  }
  function chart(lines, mode, days) {
    const W = 340,
      H = 200,
      L = 52,
      R = 8,
      T = 10,
      B = 22;
    const box = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "trend-svg", role: "img", "aria-label": mode === "delta" ? "1日の増減のグラフ" : "ポイントの残高のグラフ" });
    const values = lines.flatMap((l) => l.points.map((p) => p.value).filter((v) => v !== null));
    if (!values.length) {
      const t = svg("text", { x: W / 2, y: H / 2, "text-anchor": "middle", class: "trend-empty" });
      t.textContent = "まだ記録がありません";
      box.append(t);
      return box;
    }
    let lo = Math.min(...values),
      hi = Math.max(...values);
    if (mode === "delta") (lo = Math.min(lo, 0)), (hi = Math.max(hi, 0));
    const marks = ticks(lo, hi);
    (lo = marks[0]), (hi = marks[marks.length - 1]);
    const x = (i) => L + (days === 1 ? 0 : (i * (W - L - R)) / (days - 1)),
      y = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo || 1);
    for (const v of marks) {
      box.append(svg("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), class: v === 0 && mode === "delta" ? "trend-zero" : "trend-grid" }));
      const t = svg("text", { x: L - 6, y: y(v) + 4, "text-anchor": "end", class: "trend-axis" });
      t.textContent = Math.abs(v) >= 1e4 ? fmt(Math.round(v / 1000)) + "k" : fmt(v);
      box.append(t);
    }
    const dates = lines[0].points.map((p) => p.day);
    for (const i of [0, Math.floor((days - 1) / 2), days - 1]) {
      const t = svg("text", { x: x(i), y: H - 6, "text-anchor": i === 0 ? "start" : i === days - 1 ? "end" : "middle", class: "trend-axis" });
      t.textContent = dates[i].slice(5).replace("-", "/");
      box.append(t);
    }
    for (const line of lines) {
      // A break where the value is unknown; a lone known day is a dot.
      let d = "";
      line.points.forEach((p, i) => {
        if (p.value === null) return;
        d += (i && line.points[i - 1].value !== null ? "L" : "M") + x(i).toFixed(1) + " " + y(p.value).toFixed(1);
      });
      box.append(svg("path", { d, fill: "none", stroke: line.color, "stroke-width": line.self ? 3 : 2, "stroke-linejoin": "round", "stroke-linecap": "round", "data-trend-line": line.id }));
      line.points.forEach((p, i) => {
        const alone = p.value !== null && (i === 0 || line.points[i - 1].value === null) && (i === days - 1 || line.points[i + 1].value === null);
        if (alone) box.append(svg("circle", { cx: x(i), cy: y(p.value), r: 3, fill: line.color }));
      });
    }
    // Tapping the graph shows that day's values.
    const cursor = svg("line", { y1: T, y2: H - B, class: "trend-cursor", visibility: "hidden" });
    box.append(cursor);
    box.addEventListener("click", (e) => {
      const rect = box.getBoundingClientRect(),
        px = ((e.clientX - rect.left) / rect.width) * W,
        i = Math.max(0, Math.min(days - 1, Math.round(((px - L) / (W - L - R)) * (days - 1))));
      cursor.setAttribute("x1", x(i));
      cursor.setAttribute("x2", x(i));
      cursor.setAttribute("visibility", "visible");
      box.dispatchEvent(new CustomEvent("trend-pick", { detail: i }));
    });
    return box;
  }
  // Fills `panel` (the dialog's graph tab). Reads the others only when the tab is opened.
  async function render(panel) {
    const pref = readPref();
    const state = { days: [7, 30, 90].includes(pref.days) ? pref.days : 30, mode: pref.mode === "delta" ? "delta" : "balance", picked: Array.isArray(pref.picked) ? pref.picked.filter((id) => typeof id === "string").slice(0, MAX - 1) : null, others: [], error: "" };
    panel.replaceChildren(node("p", "読み込み中…", "trend-note"));
    try {
      state.others = await players();
    } catch (error) {
      state.error = error.message || "読み込めませんでした。";
    }
    if (!panel.isConnected) return;
    // At first: the three players with the most points.
    if (!state.picked) state.picked = state.others.slice(0, 3).map((p) => p.id);
    const draw = () => {
      writePref({ days: state.days, mode: state.mode, picked: state.picked });
      const self = mine(),
        chosen = [self, ...state.picked.map((id) => state.others.find((p) => p.id === id)).filter(Boolean)];
      const lines = chosen.map((p, i) => {
        const list = series(p.trend, state.days, Date.now(), p.points);
        return { id: p.id, name: p.name, self: !!p.self, color: COLORS[i % COLORS.length], points: state.mode === "delta" ? deltas(list) : list };
      });
      const controls = node("div", undefined, "trend-controls");
      const group = (options, value, set, label) => {
        const g = node("div", undefined, "trend-seg");
        g.setAttribute("role", "group");
        g.setAttribute("aria-label", label);
        for (const [v, text] of options) {
          const b = node("button", text);
          b.type = "button";
          b.setAttribute("aria-pressed", String(v === value));
          b.onclick = () => {
            set(v);
            draw();
          };
          g.append(b);
        }
        return g;
      };
      controls.append(
        group([["balance", "残高"], ["delta", "1日の増減"]], state.mode, (v) => (state.mode = v), "グラフの種類"),
        group([[7, "7日"], [30, "30日"], [90, "90日"]], state.days, (v) => (state.days = v), "期間"),
      );
      const legend = node("ul", undefined, "trend-legend");
      const pickLine = node("p", "グラフをタップすると、その日の数字が出ます。", "trend-pick");
      for (const l of lines) {
        const li = node("li");
        li.style.setProperty("--trend-color", l.color);
        li.append(node("span", "", "trend-swatch"), node("span", l.name));
        legend.append(li);
      }
      const graph = chart(lines, state.mode, state.days);
      graph.addEventListener("trend-pick", (e) => {
        const i = e.detail;
        pickLine.textContent = lines[0].points[i].day.slice(5).replace("-", "/") + "　" + lines.map((l) => l.name + " " + (l.points[i].value === null ? "—" : (state.mode === "delta" && l.points[i].value > 0 ? "+" : "") + fmt(l.points[i].value) + "pt")).join("　");
      });
      const people = node("details", undefined, "trend-people");
      people.append(node("summary", "くらべる人を選ぶ（" + state.picked.length + "／" + (MAX - 1) + "人）"));
      const list = node("ol");
      for (const p of state.others) {
        const li = node("li"),
          label = node("label"),
          box = node("input");
        box.type = "checkbox";
        box.checked = state.picked.includes(p.id);
        box.disabled = !box.checked && state.picked.length >= MAX - 1;
        box.dataset.trendPick = p.id;
        box.onchange = () => {
          state.picked = box.checked ? state.picked.concat(p.id).slice(0, MAX - 1) : state.picked.filter((id) => id !== p.id);
          draw();
          panel.querySelector(".trend-people").open = true;
        };
        label.append(box, node("span", p.name), node("strong", p.points === null ? "—" : fmt(p.points) + "pt"));
        li.append(label);
        list.append(li);
      }
      people.append(list);
      panel.replaceChildren(controls, graph, pickLine, legend, ...(state.error ? [node("p", state.error, "trend-note")] : []), people, node("p", "1日の終わりの残高を記録します（10.138から）。それより前の日は記録がないので線がありません。", "trend-note"));
    };
    draw();
  }
  // The device keeps the player's own days as the balance changes.
  root.addEventListener?.("study-points-changed", () => {
    try {
      remember(root.StudyPoints?.balance?.());
    } catch {}
  });
  root.PointTrend = Object.freeze({ ...model, render, remember, _reset: () => (cache = null) });
})(typeof window !== "undefined" ? window : globalThis);
