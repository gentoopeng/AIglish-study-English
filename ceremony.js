// Short full-screen moments for starts and results. Each shares the same frame (a number counting
// up, a word falling in letter by letter, a line under it, tap to skip, a zoom away) and has its
// own picture, chosen to fit the moment:
//   ring   the first ten words: a ring draws itself, sparks burst when the number lands
//   deck   a flashcard session: cards fan out and gather into one deck
//   stars  a result: a bar fills to the score and up to three stars light
//   focus  a review: target rings close in on the number
//   flame  a streak: a flame flickers and the last seven days light one by one
//   trophy a reached goal: a cup rises in front of turning rays, with confetti
//   chips  a win at the table: chips rain down into stacks
//   fold   a game lost: two cards turn face down and fall away
//
//   Ceremony.play({ style: "stars", count: 7, suffix: "/10", score: 0.7, word: "CLEAR", sub: "正解", note: "+14pt" })
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
  const clamp01 = (v, fallback) => Math.max(0, Math.min(1, v === undefined ? fallback : Number(v) || 0));
  const ringSvg = (cls) =>
    '<svg class="' + cls + '" viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="120" r="112"></circle><circle class="is-draw" cx="120" cy="120" r="112"></circle></svg>';
  function sparks(stage, n = 12) {
    const box = el("span", "cer-sparks");
    for (let i = 0; i < n; i++) {
      const spark = el("i");
      spark.style.setProperty("--a", (i * 360) / n + "deg");
      box.append(spark);
    }
    stage.append(box);
  }
  // Each picture adds its own pieces to the stage behind (or above) the number.
  const PICTURES = {
    ring(stage, root, o) {
      stage.insertAdjacentHTML("beforeend", '<span class="cer-glow"></span>' + ringSvg("cer-ring"));
      root.style.setProperty("--to", String(RING * (1 - clamp01(o.score, 1))));
      sparks(stage);
    },
    deck(stage) {
      const deck = el("span", "cer-deck");
      for (let i = 0; i < 7; i++) {
        const card = el("i");
        card.style.setProperty("--k", i - 3);
        deck.append(card);
      }
      stage.append(el("span", "cer-glow"), deck);
    },
    stars(stage, root, o) {
      const score = clamp01(o.score, 1),
        lit = score >= 1 ? 3 : score >= 2 / 3 ? 2 : score >= 1 / 3 ? 1 : 0;
      const row = el("span", "cer-stars");
      for (let i = 0; i < 3; i++) {
        const star = el("i", i < lit ? "is-lit" : "");
        star.style.setProperty("--i", i);
        star.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z"/></svg>';
        row.append(star);
      }
      const bar = el("span", "cer-bar");
      bar.append(el("i"));
      root.style.setProperty("--score", String(score));
      root.classList.toggle("is-perfect", lit === 3);
      stage.append(el("span", "cer-glow"), row);
      root.dataset.stars = String(lit);
      return { after: bar };
    },
    focus(stage) {
      const rings = el("span", "cer-focus");
      for (let i = 0; i < 3; i++) {
        const ring = el("i");
        ring.style.setProperty("--i", i);
        rings.append(ring);
      }
      rings.append(el("b", "is-cross-h"), el("b", "is-cross-v"));
      stage.append(rings);
    },
    flame(stage, root, o) {
      const flame = el("span", "cer-flame");
      flame.append(el("i", "is-outer"), el("i", "is-inner"), el("i", "is-core"));
      const days = el("span", "cer-days");
      const studied = Array.isArray(o.days) ? o.days.slice(-7) : [];
      const labels = Array.isArray(o.dayLabels) ? o.dayLabels.slice(-7) : [];
      studied.forEach((on, i) => {
        const day = el("i", on ? "is-on" : "");
        day.style.setProperty("--i", i);
        day.append(el("small", "", labels[i] || ""));
        days.append(day);
      });
      stage.append(el("span", "cer-glow"), flame);
      return { after: studied.length ? days : null };
    },
    trophy(stage) {
      const rays = el("span", "cer-rays");
      const cup = el("span", "cer-trophy");
      cup.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><path class="is-cup" d="M18 8h28v10c0 10-6 17-14 17S18 28 18 18z"/><path class="is-handle" d="M18 12H9c0 8 4 12 10 13M46 12h9c0 8-4 12-10 13"/><path class="is-stem" d="M28 35h8v9h-8z"/><path class="is-base" d="M20 44h24v6H20z"/></svg>';
      const confetti = el("span", "cer-confetti");
      const colours = ["#e9d9a6", "#f3e9cf", "#9fd5c2", "#f0a8a8", "#c6b790"];
      for (let i = 0; i < 26; i++) {
        const bit = el("i");
        bit.style.setProperty("--x", (Math.random() * 2 - 1) * 170 + "px");
        bit.style.setProperty("--y", -(80 + Math.random() * 200) + "px");
        bit.style.setProperty("--r", Math.random() * 720 - 360 + "deg");
        bit.style.setProperty("--d", (0.55 + Math.random() * 0.3).toFixed(2) + "s");
        bit.style.background = colours[i % colours.length];
        confetti.append(bit);
      }
      stage.append(rays, el("span", "cer-glow"), cup, confetti);
    },
    chips(stage) {
      const rain = el("span", "cer-chips");
      for (let i = 0; i < 18; i++) {
        const chip = el("i");
        const column = i % 3;
        chip.style.setProperty("--x", (column - 1) * 44 + "px");
        chip.style.setProperty("--h", Math.floor(i / 3));
        chip.style.setProperty("--d", (i * 0.06).toFixed(2) + "s");
        rain.append(chip);
      }
      stage.append(el("span", "cer-glow"), rain);
    },
    fold(stage) {
      const pair = el("span", "cer-fold");
      pair.append(el("i", "is-left"), el("i", "is-right"));
      stage.append(pair);
    },
  };
  let current = null;
  function play(options = {}) {
    current?.end();
    const style = PICTURES[options.style] ? options.style : "ring",
      host = options.host || topHost(),
      total = Math.max(0, Math.round(Number(options.count) || 0)),
      hold = options.duration || (options.result ? 2800 : 2300),
      word = String(options.word || "");
    const root = el("div", "ceremony is-" + style + (options.tone ? " is-" + options.tone : "") + (host === document.body ? " is-page" : ""));
    root.setAttribute("role", "status");
    root.setAttribute("aria-label", [total + (options.suffix || ""), options.sub, options.note].filter(Boolean).join(" "));
    const stage = el("span", "cer-stage");
    stage.setAttribute("aria-hidden", "true");
    const copy = el("span", "cer-copy");
    copy.setAttribute("aria-hidden", "true");
    copy.innerHTML = '<span class="cer-number"><span class="cer-count"></span><small class="cer-suffix"></small></span><span class="cer-word"></span>';
    root.append(stage, copy);
    const extra = PICTURES[style](stage, root, options) || {};
    const count = copy.querySelector(".cer-count");
    copy.querySelector(".cer-suffix").textContent = options.suffix || "";
    if (String(total).length >= 4) root.classList.add("is-long");
    // As wide as the final number, so counting up never shifts it and a single digit sits tight.
    count.style.minWidth = String(total).length + "ch";
    [...word].forEach((letter, i) => {
      const span = el("span", "", letter);
      span.style.setProperty("--i", i);
      copy.querySelector(".cer-word").append(span);
    });
    if (extra.after) copy.append(extra.after);
    if (options.sub) copy.append(el("span", "cer-sub", options.sub));
    if (options.note) copy.append(el("span", "cer-note", options.note));
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
      // The count runs up with the picture (about 0.9 s), in at most 30 steps however large it is.
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
    // Most moments never stand in the way: the first touch anywhere ends them and still reaches what
    // is underneath (a card flips, a button presses). `block: true` makes the tap only skip instead.
    if (options.block) {
      root.classList.add("is-blocking");
      root.addEventListener("pointerdown", end);
    } else {
      const touch = () => end();
      document.addEventListener("pointerdown", touch, { capture: true, once: true });
      done.then(() => document.removeEventListener("pointerdown", touch, { capture: true }));
    }
    if (typeof options.onShow === "function") options.onShow(root);
    return done;
  }
  window.Ceremony = Object.freeze({ play, skip: () => current?.end(), styles: Object.keys(PICTURES) });
})();
