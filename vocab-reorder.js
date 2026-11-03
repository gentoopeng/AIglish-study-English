// Reordering the words of a book: a 「並び替え」 mode for the word list. Each word is one short
// row with a grip to drag (a finger or the mouse) and ▲▼ to move it one place; the last move can
// be undone. Moving only hands the existing display numbers on (VocabOrder.move), so records,
// notes and ratings, which follow a word's identity number, stay with it.
(function (root) {
  "use strict";
  let active = false,
    book = null,
    undo = null,
    message = "",
    focus = null;
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const svg = (paths) => {
    const NS = "http://www.w3.org/2000/svg",
      el = document.createElementNS(NS, "svg");
    for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" })) el.setAttribute(k, v);
    for (const d of paths) {
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      el.append(path);
    }
    return el;
  };
  const ICONS = { grip: ["M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"], up: ["M6 15l6-6 6 6"], down: ["M6 9l6 6 6-6"] };
  const canEdit = () => !!root.canEditCurrentTextbook?.();
  const list = () => (typeof vocabList !== "undefined" ? vocabList : []);
  const shownNo = (w) => root.VocabOrder.no(w);

  // The button above the list: shown to whoever may edit this book.
  function sync() {
    const button = document.getElementById("vocabReorderButton");
    const now = typeof currentTextbook !== "undefined" ? currentTextbook : null;
    if (book !== now) {
      book = now;
      active = false;
      undo = null;
      message = "";
    }
    const allowed = canEdit() && list().length > 1;
    if (!allowed) active = false;
    if (!button) return;
    button.hidden = !allowed;
    button.setAttribute("aria-pressed", String(active));
    button.textContent = active ? "並び替えを終える" : "並び替え";
    button.classList.toggle("is-on", active);
  }
  function toggle() {
    active = !active;
    undo = null;
    message = "";
    root.renderVocabList();
  }

  // Apply a move: `to` is the place in the order of the whole book.
  function applyMove(num, to) {
    const words = list(),
      before = new Map(words.map((w) => [String(w.num), w.no])),
      placed = root.VocabOrder.move(words.map((w) => (w.no === undefined ? { num: w.num } : { num: w.num, no: w.no })), num, to),
      byNum = new Map(placed.map((w) => [String(w.num), w]));
    words.forEach((w) => {
      const p = byNum.get(String(w.num));
      if (p && p.no !== undefined) w.no = p.no;
      else delete w.no;
    });
    const moved = words.find((w) => String(w.num) === String(num));
    undo = { before, words: wordSet() };
    message = "「" + moved.word + "」を " + shownNo(moved) + " 番に動かしました。";
    save();
  }
  // The words of the book as they were when a move was made: an undo is only for that same set
  // (a word added or taken out since would otherwise be given a number that is no longer free).
  const wordSet = () => list().map((w) => String(w.num)).sort().join("\n");
  const undoable = () => !!undo && undo.words === wordSet();
  function revert() {
    if (!undoable()) {
      undo = null;
      message = "単語が追加・削除されたため、元に戻せません。";
      return root.renderVocabList();
    }
    list().forEach((w) => {
      const had = undo.before.get(String(w.num));
      if (had === undefined) delete w.no;
      else w.no = had;
    });
    undo = null;
    message = "元に戻しました。";
    save();
  }
  function save() {
    root.saveVocabToStorage?.();
    root.__captureManualVocabDraft?.();
    root.renderVocabList();
  }

  // The place in the whole book the word takes when it is put `slot` places into the shown list
  // (0 = before the first shown word, shown.length = after the last).
  function placeFor(shown, from, slot) {
    if (slot === from || slot === from + 1) return null;
    const order = root.VocabOrder.sort(list()),
      indexOf = (w) => order.findIndex((x) => String(x.num) === String(w.num));
    return slot > from ? indexOf(shown[slot - 1]) : indexOf(shown[slot]);
  }

  function scrollerOf(el) {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const style = getComputedStyle(p);
      if (/(auto|scroll)/.test(style.overflowY) && p.scrollHeight > p.clientHeight) return p;
    }
    return document.scrollingElement || document.documentElement;
  }

  function render(container, shown) {
    container.replaceChildren();
    if (undo && !undoable()) undo = null;
    const bar = node("div", "vocab-reorder-bar");
    bar.append(node("p", "vocab-reorder-hint", "左の「⋮⋮」をつかんで動かすか、▲▼で1つずつ動かせます。"));
    if (undo) {
      const back = node("button", "vocab-reorder-undo", "元に戻す");
      back.type = "button";
      back.onclick = revert;
      bar.append(back);
    }
    const status = node("p", "vocab-reorder-status", message);
    status.setAttribute("role", "status");
    container.append(bar, status);
    if (!shown.length) {
      container.append(node("p", "vocab-reorder-empty", "この条件に合う単語がありません。"));
      return;
    }
    const ol = node("ol", "vocab-reorder-list");
    shown.forEach((w, i) => {
      const li = node("li", "vocab-reorder-row");
      li.dataset.wordNum = w.num;
      const grip = node("button", "vocab-reorder-grip");
      grip.type = "button";
      grip.append(svg(ICONS.grip));
      grip.setAttribute("aria-label", "「" + w.word + "」を動かす（ドラッグ、または上下の矢印キー）");
      const text = node("span", "vocab-reorder-text");
      const meaning = String((w.meanings && w.meanings[0] && w.meanings[0].text) || w.meaning || "");
      text.append(node("b", "", w.word), node("small", "", meaning));
      const mk = (cls, icon, label, target) => {
        const b = node("button", "vocab-reorder-step " + cls);
        b.type = "button";
        b.append(svg(ICONS[icon]));
        b.setAttribute("aria-label", "「" + w.word + "」を" + label);
        b.disabled = !target;
        b.onclick = () => {
          focus = { num: w.num, role: cls };
          applyMove(w.num, placeFor(shown, i, target === "up" ? i - 1 : i + 2));
        };
        return b;
      };
      const up = mk("is-up", "up", "1つ上へ", i > 0 ? "up" : null),
        down = mk("is-down", "down", "1つ下へ", i < shown.length - 1 ? "down" : null);
      li.append(grip, node("span", "vocab-reorder-no", "#" + shownNo(w)), text, up, down);
      grip.onkeydown = (event) => {
        const key = event.key === "ArrowUp" ? up : event.key === "ArrowDown" ? down : null;
        if (!key) return;
        event.preventDefault();
        if (!key.disabled) key.click();
      };
      grip.onpointerdown = (event) => startDrag(event, { ol, li, grip, shown, from: i });
      ol.append(li);
    });
    container.append(ol);
    if (focus) {
      const row = ol.querySelector('[data-word-num="' + CSS.escape(String(focus.num)) + '"]');
      const control = row && (row.querySelector("." + focus.role + ":not(:disabled)") || row.querySelector(".vocab-reorder-grip"));
      control?.focus({ preventScroll: true });
      focus = null;
    }
  }

  // Dragging by the grip: the row under the finger shows a line where the word would go, and the
  // list scrolls when the finger is near its top or bottom edge.
  function startDrag(event, ctx) {
    if (event.button > 0) return;
    event.preventDefault();
    const { ol, li, grip, shown, from } = ctx,
      scroller = scrollerOf(ol),
      drag = { y: event.clientY, slot: from, raf: 0 };
    grip.setPointerCapture?.(event.pointerId);
    li.classList.add("is-dragging");
    ol.classList.add("is-sorting");
    const rows = [...ol.children];
    const mark = () => {
      rows.forEach((r) => r.classList.remove("is-drop-before", "is-drop-after"));
      if (drag.slot === from || drag.slot === from + 1) return;
      if (drag.slot >= rows.length) rows[rows.length - 1].classList.add("is-drop-after");
      else rows[drag.slot].classList.add("is-drop-before");
    };
    const locate = () => {
      let slot = rows.length;
      for (let i = 0; i < rows.length; i++) {
        const box = rows[i].getBoundingClientRect();
        if (drag.y < box.top + box.height / 2) {
          slot = i;
          break;
        }
      }
      drag.slot = slot;
      mark();
    };
    const tick = () => {
      const edge = 80,
        top = scroller === document.scrollingElement || scroller === document.documentElement ? 0 : scroller.getBoundingClientRect().top,
        bottom = scroller === document.scrollingElement || scroller === document.documentElement ? innerHeight : scroller.getBoundingClientRect().bottom;
      if (drag.y < top + edge) scroller.scrollBy(0, -Math.min(18, (top + edge - drag.y) / 3));
      else if (drag.y > bottom - edge) scroller.scrollBy(0, Math.min(18, (drag.y - (bottom - edge)) / 3));
      locate();
      drag.raf = requestAnimationFrame(tick);
    };
    const end = (event2, drop) => {
      cancelAnimationFrame(drag.raf);
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
      grip.removeEventListener("pointercancel", cancel);
      li.classList.remove("is-dragging");
      ol.classList.remove("is-sorting");
      rows.forEach((r) => r.classList.remove("is-drop-before", "is-drop-after"));
      if (!drop) return;
      const to = placeFor(shown, from, drag.slot);
      if (to === null) return;
      focus = { num: shown[from].num, role: "vocab-reorder-grip" };
      applyMove(shown[from].num, to);
    };
    const move = (e) => {
      drag.y = e.clientY;
      locate();
    };
    const up = (e) => {
      drag.y = e.clientY;
      locate();
      end(e, true);
    };
    const cancel = (e) => end(e, false);
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
    grip.addEventListener("pointercancel", cancel);
    drag.raf = requestAnimationFrame(tick);
    locate();
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest?.("#vocabReorderButton")) toggle();
  });
  root.VocabReorder = { active: () => active, sync, render, toggle };
})(window);
