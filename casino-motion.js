// Casino motion, the part CSS cannot do: when the balance on a game screen changes, the change floats up beside it ("+250" in
// gold, "−100" in a muted red) and fades. It only draws; the balance text itself is never touched (casino.js sets it).
(function () {
  "use strict";
  const calm = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  const fmt = (n) => Number(n).toLocaleString("ja-JP");
  function float(el, from, to) {
    const host = el.closest(".cs-balance");
    if (!host || calm() || !Number.isFinite(from) || !Number.isFinite(to) || from === to) return;
    const delta = to - from,
      chip = document.createElement("span");
    chip.className = "cm-delta " + (delta > 0 ? "is-up" : "is-down");
    chip.setAttribute("aria-hidden", "true");
    chip.textContent = (delta > 0 ? "+" : "−") + fmt(Math.abs(delta));
    host.append(chip);
    setTimeout(() => chip.remove(), 1700);
  }
  const seen = new WeakMap();
  new MutationObserver((records) => {
    for (const r of records) {
      const el = r.target;
      if (!(el instanceof Element) || !el.matches("[data-cs-balance]")) continue;
      const to = Number(el.dataset.value),
        from = seen.has(el) ? seen.get(el) : r.oldValue === null ? NaN : Number(r.oldValue);
      seen.set(el, to);
      float(el, from, to);
    }
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-value"], attributeOldValue: true });
})();
