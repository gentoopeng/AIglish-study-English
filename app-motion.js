// App motion: the mode (full / calm / off; "test" for an automated browser), the setting for it, and the small pieces of
// motion that need script. The look is in app-motion.css. The mode is decided in index.html's head before the first paint;
// this file keeps the setting in step (aiglish_motion), follows the device's "reduce motion" setting while the app is open,
// and switches the casino's motion layer off with the rest.
(function () {
  "use strict";
  const root = document.documentElement;
  const KEY = "aiglish_motion";
  const reducedQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const saved = () => {
    try {
      const v = localStorage.getItem(KEY);
      return v === "full" || v === "calm" || v === "off" ? v : "";
    } catch {
      return "";
    }
  };
  // What the mode is now: the device's "reduce motion" always wins; else what was chosen; else full (test for an automated browser).
  const decide = () => (reducedQuery?.matches ? "off" : saved() || (navigator.webdriver ? "test" : "full"));
  const mode = () => root.getAttribute("data-motion") || "off";
  const on = () => mode() === "full" || mode() === "calm";
  const listeners = new Set();
  function apply() {
    const next = decide();
    if (next !== mode()) root.setAttribute("data-motion", next);
    // The casino's own layer (casino-motion.css) follows the same mode.
    const casino = document.getElementById("casinoMotionCss");
    if (casino) casino.disabled = !on();
    for (const fn of listeners) fn(next);
    sync();
  }
  function set(value) {
    try {
      if (value === "full" || value === "calm" || value === "off") localStorage.setItem(KEY, value);
    } catch {}
    apply();
  }
  // The setting: one line in the sidebar menu that goes round (おしゃれ → 控えめ → なし).
  const NAMES = { full: "おしゃれ", calm: "控えめ", off: "なし" };
  const NEXT = { full: "calm", calm: "off", off: "full" };
  function sync() {
    const button = document.getElementById("motionMenuButton"),
      value = document.getElementById("motionMenuValue"),
      locked = !!reducedQuery?.matches;
    if (value) value.textContent = locked ? "なし（端末の設定）" : NAMES[saved() || "full"];
    if (button) {
      button.disabled = locked;
      button.setAttribute("aria-label", "画面の動き：" + (locked ? "なし（端末の「動きを減らす」がオン）" : NAMES[saved() || "full"] + "。押すと切り替わります"));
    }
  }
  document.getElementById("motionMenuButton")?.addEventListener("click", () => set(NEXT[saved() || "full"]));
  // ---- Stage 2: tabs and the side menu ----------------------------------------------------------------------------
  // Which way the new tab lies (the bottom navigation's order), for the sideways start of its blocks, and where the pill under the
  // chosen navigation item goes. The place is measured once per switch (and when the window changes), never in a loop.
  const ORDER = ["vocab", "reader", "community", "study", "titles", "casino"];
  let currentTab = "vocab";
  function placePill() {
    const bar = document.getElementById("appMainBottomNavBar"),
      active = bar?.querySelector(".nav-item.active");
    if (!bar || !active || !on() || !active.offsetWidth) return;
    bar.style.setProperty("--am-nav-x", active.offsetLeft - 4 + "px");
    bar.style.setProperty("--am-nav-w", active.offsetWidth + 8 + "px");
    bar.style.setProperty("--am-nav-on", "1");
    // (the first place is taken at once; the sliding starts from the second)
    if (!bar.classList.contains("am-nav-ready")) requestAnimationFrame(() => requestAnimationFrame(() => bar.classList.add("am-nav-ready")));
  }
  window.onTabChange?.((id) => {
    const from = ORDER.indexOf(currentTab),
      to = ORDER.indexOf(id);
    if (from >= 0 && to >= 0 && from !== to) root.setAttribute("data-am-dir", to > from ? "next" : "prev");
    currentTab = id;
    placePill();
  });
  window.addEventListener("resize", placePill);
  listeners.add(placePill);
  // The side menu: the veil fades with a class on <body> (the app sets the veil's display directly, which cannot be animated).
  const toggleSidebar = window.toggleSidebar;
  if (typeof toggleSidebar === "function") {
    window.toggleSidebar = function () {
      const result = toggleSidebar.apply(this, arguments);
      document.body.classList.toggle("am-sidebar-open", !!document.getElementById("sidebarMenu")?.classList.contains("open"));
      return result;
    };
  }
  setTimeout(placePill, 0);

  // ---- Stage 3: toasts, and the points at the top ---------------------------------------------------------------------
  // The app's toast sets its look with inline styles (which a stylesheet cannot animate), so while motion is on a toast is drawn
  // here with classes (app-motion.css): the same host, the same colours and time (2.2s), at most three at once.
  const showToast = window.showToast;
  if (typeof showToast === "function") {
    window.showToast = function (message, type) {
      if (!on()) return showToast.apply(this, arguments);
      let host = document.getElementById("toastHost");
      if (!host) {
        host = document.createElement("div");
        host.id = "toastHost";
        host.style.cssText = "position:fixed; top:64px; left:50%; transform:translateX(-50%); z-index:99997; display:flex; flex-direction:column; gap:8px; align-items:center; pointer-events:none; width:90%; max-width:340px;";
        document.body.appendChild(host);
      }
      while (host.children.length >= 3) host.firstElementChild.remove();
      const toast = document.createElement("div");
      toast.className = "am-toast" + (type === "err" ? " is-err" : type === "warn" ? " is-warn" : "");
      toast.setAttribute("role", "status");
      toast.textContent = message;
      host.appendChild(toast);
      setTimeout(() => {
        const done = () => toast.remove();
        toast.classList.add("is-out");
        toast.addEventListener("animationend", done, { once: true });
        setTimeout(done, 600);
      }, 2200);
    };
  }
  // The points: a glow when the number goes up, a dim when it goes down. (Only the class changes; the text is the app's.)
  const points = document.getElementById("headerStudyPoints");
  if (points) {
    let last = parseInt(points.textContent.replace(/[^\d-]/g, ""), 10);
    new MutationObserver(() => {
      const now = parseInt(points.textContent.replace(/[^\d-]/g, ""), 10);
      if (Number.isFinite(last) && Number.isFinite(now) && now !== last && on()) {
        points.classList.remove("am-up", "am-down");
        void points.offsetWidth;
        points.classList.add(now > last ? "am-up" : "am-down");
        setTimeout(() => points.classList.remove("am-up", "am-down"), 1400);
      }
      if (Number.isFinite(now)) last = now;
    }).observe(points, { childList: true, characterData: true, subtree: true });
  }
  // ---- Stage 4: lists and loading ----------------------------------------------------------------------------------
  // Rows that appear right after the player went somewhere (a tab, a dialog) come in one after another as they scroll into view.
  // Rows added any other time (a live update redrawing a list) just appear: nothing replays every few seconds.
  const REVEAL = ".people-row, .group-list-row, .loans-person, .stamps-card";
  let wentAt = 0;
  const went = () => (wentAt = Date.now());
  window.onTabChange?.(went);
  new MutationObserver((records) => {
    for (const r of records) if (r.target.hasAttribute("open")) went();
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
  const io =
    "IntersectionObserver" in window
      ? new IntersectionObserver((entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            io.unobserve(e.target);
            release(e.target);
          }
        })
      : null;
  function release(el) {
    if (!el.classList.contains("am-wait")) return;
    el.classList.remove("am-wait");
    if (!on()) return;
    el.classList.add("am-go");
    const done = () => el.classList.remove("am-go");
    el.addEventListener("animationend", done, { once: true });
    setTimeout(done, 1500);
  }
  const loadingText = /読み込み中|読み込んでいます|確かめています|取得しています|準備しています|確認しています/;
  function shimmer(el) {
    const loading = el.children.length === 0 && el.textContent.length <= 40 && loadingText.test(el.textContent);
    if (loading && !el.classList.contains("am-loading")) {
      el.style.setProperty("--am-load", getComputedStyle(el).color);
      el.classList.add("am-loading");
    } else if (!loading && el.classList.contains("am-loading")) el.classList.remove("am-loading");
  }
  new MutationObserver((records) => {
    if (!on()) return;
    const fresh = Date.now() - wentAt < 900;
    let batch = 0;
    for (const r of records) {
      // A "loading…" line whose text changed.
      if (r.type === "characterData") {
        if (mode() === "full" && r.target.parentElement) shimmer(r.target.parentElement);
        continue;
      }
      // A line whose text was replaced (a new text node in the same element): it may be a "loading…" line now, or no longer.
      if (mode() === "full" && r.target.nodeType === 1 && [...r.addedNodes].some((n) => n.nodeType === 3)) shimmer(r.target);
      for (const node of r.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (mode() === "full") {
          if (node.childElementCount < 200) for (const el of [node, ...node.querySelectorAll("p, small, span, div, li")]) shimmer(el);
          else shimmer(node);
        }
        if (!fresh || !io) continue;
        const rows = node.matches?.(REVEAL) ? [node] : node.querySelectorAll?.(REVEAL) || [];
        for (const row of rows) {
          if (row.classList.contains("am-wait") || row.classList.contains("am-go")) continue;
          row.style.setProperty("--am-delay", Math.min(batch++, 8) * 45 + "ms");
          row.classList.add("am-wait");
          io.observe(row);
          // (if it was never seen, it is let go anyway, so nothing stays hidden)
          setTimeout(() => release(row), 4000);
        }
      }
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
  document.addEventListener("visibilitychange", () => root.classList.toggle("am-hidden", document.hidden));
  reducedQuery?.addEventListener?.("change", apply);
  window.AppMotion = Object.freeze({ mode, on, set, onChange: (fn) => (listeners.add(fn), () => listeners.delete(fn)) });
  apply();
})();
