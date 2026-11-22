// book-print.js —— 単語帳を紙に印刷する (10.170).
// The word list can be printed as a plain table. The side the player wants to memorise
// (the meanings, or the words) is printed in a colour they pick: orange by default, the
// colour an orange "check" pen / red sheet hides, so the printed sheet works like a
// red-sheet study sheet. Pure helpers (rows / filtering / sheet HTML) are exported for
// tests; the dialog and the print sheet are built only in the browser.
(function (root) {
  "use strict";

  // Colours the player can pick for the hidden side. Orange first: it is the colour
  // that disappears under a red sheet / orange memorisation pen.
  const COLORS = [
    { id: "orange", name: "オレンジ（赤シートで隠れる）", value: "#ff7a00" },
    { id: "red", name: "あか（赤シートで隠れる）", value: "#e8321e" },
    { id: "pink", name: "ピンク", value: "#ff5c8a" },
    { id: "blue", name: "あお", value: "#2563eb" },
    { id: "green", name: "みどり", value: "#1f9d55" },
    { id: "purple", name: "むらさき", value: "#7c3aed" },
    { id: "black", name: "くろ（隠さない）", value: "#111111" },
  ];

  function colorOf(id) {
    return COLORS.find((c) => c.id === id) || COLORS[0];
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  // One printed row per word: its shown number, the word, every meaning on its own
  // line (seldom-used ones included, marked), and the sub text when asked for.
  function rowOf(word, no, includeSub) {
    const meanings = Array.isArray(word.meanings) && word.meanings.length ? word.meanings : word.meaning ? [{ text: word.meaning }] : [];
    return {
      no: no,
      word: String(word.word || ""),
      meanings: meanings.map((m) => ({ text: String((m && m.text) || ""), minor: !!(m && m.minor) })).filter((m) => m.text.trim()),
      sub: includeSub ? String(word.sub || "") : "",
      unit: String(word.unit || ""),
    };
  }

  // Words to print, in book order: all of them, a number range, or one unit.
  // `noOf` says which number a word is shown with (VocabOrder when present).
  function selectWords(words, options, noOf) {
    const opts = options || {};
    const no = typeof noOf === "function" ? noOf : (w) => parseInt(w.num, 10);
    const list = (Array.isArray(words) ? words : []).slice().sort((a, b) => (no(a) || 0) - (no(b) || 0));
    return list.filter((w) => {
      if (opts.scope === "range") {
        const n = no(w);
        if (Number.isFinite(opts.from) && n < opts.from) return false;
        if (Number.isFinite(opts.to) && n > opts.to) return false;
      }
      if (opts.scope === "unit" && String(w.unit || "") !== String(opts.unit || "")) return false;
      return true;
    });
  }

  function unitsOf(words) {
    const seen = [];
    (Array.isArray(words) ? words : []).forEach((w) => {
      const u = String((w && w.unit) || "");
      if (u && !seen.includes(u)) seen.push(u);
    });
    return seen;
  }

  // The printable sheet: a header (book, count, what is hidden in which colour) and a
  // table with a check box per row. The hidden side carries the chosen colour inline;
  // book-print.css forces colours to print (@media print, print-color-adjust: exact).
  function sheetHtml(bookName, rows, options) {
    const opts = options || {};
    const color = colorOf(opts.color);
    const hide = opts.hide === "word" ? "word" : "meaning";
    const side = (which, text) =>
      '<span class="bp-side' + (hide === which ? " bp-hidden-side" : "") + '"' + (hide === which ? ' style="color:' + color.value + '"' : "") + ">" + text + "</span>";
    const body = rows
      .map((r) => {
        const meanings = r.meanings
          .map((m) => '<span class="bp-meaning' + (m.minor ? " bp-minor" : "") + '">' + escapeHtml(m.text).replace(/\n/g, "<br>") + "</span>")
          .join("<br>");
        const sub = r.sub ? '<span class="bp-sub">' + escapeHtml(r.sub).replace(/\n/g, "<br>") + "</span>" : "";
        const meaningCell = side("meaning", meanings + (meanings && sub ? "<br>" : "") + sub);
        return (
          '<tr><td class="bp-check">☐</td><td class="bp-no">' + escapeHtml(r.no) + '</td><td class="bp-word">' + side("word", escapeHtml(r.word)) + '</td><td class="bp-meanings">' + meaningCell + "</td></tr>"
        );
      })
      .join("");
    const hiddenLabel = hide === "word" ? "単語" : "意味";
    return (
      '<header class="bp-head"><h1>' + escapeHtml(bookName || "単語帳") + '</h1><p class="bp-meta">' + rows.length + "語 ／ " + hiddenLabel + "を" + escapeHtml(color.name.split("（")[0]) + "で印刷（赤シート・暗記ペンで隠せます）</p></header>" +
      '<table class="bp-table"><thead><tr><th class="bp-check"></th><th class="bp-no">No.</th><th>単語・用語</th><th>意味</th></tr></thead><tbody>' + body + "</tbody></table>"
    );
  }

  const api = { COLORS, colorOf, escapeHtml, rowOf, selectWords, unitsOf, sheetHtml };
  root.BookPrint = Object.freeze(api);
  if (typeof module !== "undefined") module.exports = api;

  // ---------------------------------------------------------------- browser UI
  if (typeof document === "undefined") return;

  const STORE_KEY = "tangolabo.bookPrint.v1";
  function savedSettings() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }
  function saveSettings(s) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(s));
    } catch (e) {}
  }

  function currentWords() {
    return typeof vocabList !== "undefined" && Array.isArray(vocabList) ? vocabList : [];
  }
  function currentBookName() {
    try {
      const pool = typeof textbooksPool !== "undefined" && Array.isArray(textbooksPool) ? textbooksPool : [];
      const book = pool.find((b) => b.id === (typeof currentTextbook !== "undefined" ? currentTextbook : null));
      return book ? book.name : "単語帳";
    } catch (e) {
      return "単語帳";
    }
  }
  function shownNo(w) {
    return root.VocabOrder && typeof root.VocabOrder.no === "function" ? root.VocabOrder.no(w) : parseInt(w.num, 10);
  }

  function ensureButton() {
    const container = document.getElementById("vocabListContainer");
    if (!container || document.getElementById("bookPrintButton")) return;
    const bar = document.createElement("div");
    bar.className = "bp-bar";
    const button = document.createElement("button");
    button.type = "button";
    button.id = "bookPrintButton";
    button.className = "bp-open";
    button.textContent = "🖨 紙に印刷";
    button.setAttribute("aria-label", "この単語帳を紙に印刷する");
    button.onclick = openDialog;
    bar.append(button);
    container.before(bar);
  }

  function openDialog() {
    const words = currentWords();
    if (!words.length) {
      window.alert("この単語帳には、まだ単語がありません。");
      return;
    }
    document.getElementById("bookPrintDialog")?.remove();
    const settings = Object.assign({ hide: "meaning", color: "orange", scope: "all", includeSub: false }, savedSettings());
    const units = unitsOf(words);
    const dialog = document.createElement("dialog");
    dialog.id = "bookPrintDialog";
    dialog.className = "bp-dialog";
    const colorSwatches = COLORS.map(
      (c) =>
        '<label class="bp-color"><input type="radio" name="bpColor" value="' + c.id + '"' + (settings.color === c.id ? " checked" : "") + '><span class="bp-swatch" style="background:' + c.value + '"></span><span>' + escapeHtml(c.name) + "</span></label>"
    ).join("");
    dialog.innerHTML =
      '<form method="dialog" class="bp-form"><header class="bp-dialog-head"><h2>紙に印刷する</h2><button type="button" class="bp-close" aria-label="閉じる">×</button></header>' +
      '<p class="bp-note">単語帳「' + escapeHtml(currentBookName()) + '」（' + words.length + '語）を、紙で使える一覧にします。隠したい側は色つきで印刷されるので、赤シートや暗記ペンで隠して覚えられます。</p>' +
      '<fieldset><legend>隠すところ</legend><label class="bp-radio"><input type="radio" name="bpHide" value="meaning"' + (settings.hide !== "word" ? " checked" : "") + '> 意味を隠す（単語を見て意味を答える）</label>' +
      '<label class="bp-radio"><input type="radio" name="bpHide" value="word"' + (settings.hide === "word" ? " checked" : "") + '> 単語を隠す（意味を見て単語を答える）</label></fieldset>' +
      '<fieldset><legend>隠す色</legend><div class="bp-colors">' + colorSwatches + '</div></fieldset>' +
      '<fieldset><legend>印刷する範囲</legend><label class="bp-radio"><input type="radio" name="bpScope" value="all"' + (settings.scope === "all" ? " checked" : "") + '> 全部</label>' +
      '<label class="bp-radio"><input type="radio" name="bpScope" value="range"' + (settings.scope === "range" ? " checked" : "") + '> 番号で選ぶ <span class="bp-range"><input type="number" id="bpFrom" min="1" inputmode="numeric" placeholder="最初"> ～ <input type="number" id="bpTo" min="1" inputmode="numeric" placeholder="最後"></span></label>' +
      (units.length ? '<label class="bp-radio"><input type="radio" name="bpScope" value="unit"' + (settings.scope === "unit" ? " checked" : "") + '> 単元で選ぶ <select id="bpUnit">' + units.map((u) => '<option value="' + escapeHtml(u) + '"' + (settings.unit === u ? " selected" : "") + ">" + escapeHtml(u) + "</option>").join("") + '</select></label>' : "") +
      '</fieldset>' +
      '<label class="bp-check-line"><input type="checkbox" id="bpSub"' + (settings.includeSub ? " checked" : "") + '> サブ情報も入れる</label>' +
      '<p class="bp-count" role="status"></p>' +
      '<div class="bp-actions"><button type="button" class="bp-cancel">やめる</button><button type="button" class="bp-print">印刷する</button></div></form>';
    document.body.append(dialog);

    const readSettings = () => {
      const from = parseInt(dialog.querySelector("#bpFrom")?.value, 10);
      const to = parseInt(dialog.querySelector("#bpTo")?.value, 10);
      return {
        hide: dialog.querySelector('input[name="bpHide"]:checked')?.value || "meaning",
        color: dialog.querySelector('input[name="bpColor"]:checked')?.value || "orange",
        scope: dialog.querySelector('input[name="bpScope"]:checked')?.value || "all",
        from: Number.isFinite(from) ? from : undefined,
        to: Number.isFinite(to) ? to : undefined,
        unit: dialog.querySelector("#bpUnit")?.value || "",
        includeSub: !!dialog.querySelector("#bpSub")?.checked,
      };
    };
    const refreshCount = () => {
      const s = readSettings();
      const picked = selectWords(words, s, shownNo);
      dialog.querySelector(".bp-count").textContent = picked.length + "語が印刷されます";
      dialog.querySelector(".bp-print").disabled = picked.length === 0;
    };
    dialog.addEventListener("change", refreshCount);
    dialog.addEventListener("input", refreshCount);
    refreshCount();

    dialog.querySelector(".bp-close").onclick = () => dialog.close();
    dialog.querySelector(".bp-cancel").onclick = () => dialog.close();
    dialog.querySelector(".bp-print").onclick = () => {
      const s = readSettings();
      saveSettings(s);
      const picked = selectWords(words, s, shownNo);
      if (!picked.length) return;
      printSheet(picked, s);
      dialog.close();
    };
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function printSheet(words, settings) {
    document.getElementById("bookPrintSheet")?.remove();
    const rows = words.map((w) => rowOf(w, shownNo(w), settings.includeSub));
    const sheet = document.createElement("section");
    sheet.id = "bookPrintSheet";
    sheet.innerHTML = sheetHtml(currentBookName(), rows, settings);
    document.body.append(sheet);
    document.body.classList.add("bp-printing");
    const cleanup = () => {
      sheet.remove();
      document.body.classList.remove("bp-printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => window.print(), 30);
    setTimeout(cleanup, 60000);
  }

  setInterval(ensureButton, 1000);
  if (typeof MutationObserver !== "undefined") new MutationObserver(ensureButton).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", ensureButton);
  root.BookPrintUI = { open: openDialog, ensureButton };
})(typeof window === "undefined" ? globalThis : window);
