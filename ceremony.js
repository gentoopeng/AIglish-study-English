// The opening that starts the first ten words, as a piece any screen can use: a ring draws itself
// while a number counts up, the letters of a word fall into place, sparks burst when the number
// lands, and the whole thing zooms away. A tap skips it. Used for session starts and results.
//
//   Ceremony.play({ count: 10, word: "WORDS", sub: "単語スタート" })
//   Ceremony.play({ count: 8, suffix: "/10", ring: 0.8, word: "CLEAR", sub: "正解", note: "+16pt", tone: "gold" })
//
// It resolves when it has gone. `host` defaults to the top open modal dialog (anything outside it
// would be hidden behind the top layer), otherwise the page.
(function () {
  "use strict";
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const RING = 704; // circumference of the r=112 circle
  function topHost() {
    const open = [...document.querySelectorAll("dialog[open]")].filter((d) => d.matches(":modal"));
    return open[open.length - 1] || document.body;
  }
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  let current = null;
  function play(options = {}) {
    current?.end();
    const host = options.host || topHost(),
      total = Math.max(0, Math.round(Number(options.count) || 0)),
      ring = Math.max(0, Math.min(1, options.ring === undefined ? 1 : Number(options.ring) || 0)),
      hold = options.duration || (options.result ? 2800 : 2300),
      word = String(options.word || "");
    const root = el("div", "ceremony" + (options.tone ? " is-" + options.tone : "") + (host === document.body ? " is-page" : ""));
    root.setAttribute("role", "status");
    root.setAttribute("aria-label", [total + (options.suffix || ""), options.sub, options.note].filter(Boolean).join(" "));
    root.innerHTML =
      '<span class="cer-glow"></span><svg class="cer-ring" viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="120" r="112"></circle><circle class="is-draw" cx="120" cy="120" r="112"></circle></svg>' +
      '<span class="cer-sparks" aria-hidden="true"></span><span class="cer-number" aria-hidden="true"><span class="cer-count"></span><small class="cer-suffix"></small></span><span class="cer-word" aria-hidden="true"></span>';
    root.style.setProperty("--to", String(RING * (1 - ring)));
    const count = root.querySelector(".cer-count");
    root.querySelector(".cer-suffix").textContent = options.suffix || "";
    if (String(total).length >= 4) root.classList.add("is-long");
    // As wide as the final number, so counting up never shifts it and a single digit sits tight.
    count.style.minWidth = String(total).length + "ch";
    [...word].forEach((letter, i) => {
      const span = el("span", "", letter);
      span.style.setProperty("--i", i);
      root.querySelector(".cer-word").append(span);
    });
    for (let i = 0; i < 12; i++) {
      const spark = el("i");
      spark.style.setProperty("--a", i * 30 + "deg");
      root.querySelector(".cer-sparks").append(spark);
    }
    if (options.sub) root.append(el("span", "cer-sub", options.sub));
    if (options.note) root.append(el("span", "cer-note", options.note));
    const reduced = calm();
    const from = total <= 1 ? total : Math.max(0, Math.min(total, options.from === undefined ? 1 : options.from));
    count.textContent = String(reduced ? total : from);
    // Held still until frames are really being drawn, so timers never run ahead of what is seen.
    root.classList.add("is-waiting");
    host.append(root);
    let tick = null,
      timer = null,
      finished = false,
      resolveDone;
    const done = new Promise((resolve) => (resolveDone = resolve));
    const end = () => {
      if (finished) return;
      finished = true;
      if (typeof options.onLeave === "function") options.onLeave();
      clearInterval(tick);
      clearTimeout(timer);
      count.textContent = String(total);
      root.classList.add("is-landed", "is-leaving");
      setTimeout(() => {
        root.remove();
        if (current?.root === root) current = null;
        resolveDone();
      }, reduced ? 0 : 550);
    };
    current = { root, end };
    const land = () => root.classList.add("is-landed");
    const run = () => {
      if (finished) return;
      root.classList.remove("is-waiting");
      timer = setTimeout(end, reduced ? 700 : hold);
      if (reduced) return land();
      let shown = from;
      const steps = Math.max(1, total - from);
      if (total === from) {
        setTimeout(land, 500);
        return;
      }
      // The count runs up with the ring (about 0.9 s), in at most 30 steps however large it is.
      const stride = Math.max(1, Math.ceil(steps / 30)),
        every = Math.max(30, Math.round(900 / Math.ceil(steps / stride)));
      tick = setInterval(() => {
        shown = Math.min(total, shown + stride);
        count.textContent = String(shown);
        if (shown >= total) {
          clearInterval(tick);
          land();
        }
      }, every);
    };
    requestAnimationFrame(() => requestAnimationFrame(run));
    root.addEventListener("pointerdown", end);
    if (typeof options.onShow === "function") options.onShow(root);
    return done;
  }
  window.Ceremony = Object.freeze({ play, skip: () => current?.end() });
})();
