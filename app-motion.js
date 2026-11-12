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
  reducedQuery?.addEventListener?.("change", apply);
  window.AppMotion = Object.freeze({ mode, on, set, onChange: (fn) => (listeners.add(fn), () => listeners.delete(fn)) });
  apply();
})();
