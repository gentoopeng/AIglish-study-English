// book-print.js —— 単語帳を紙に印刷する (10.170; 印刷方式 10.171; 設定と表組み 10.172).
// The word list prints as a table split into page-sized chunks (a long single table
// broke across pages and its cells drifted apart on phones). Both sides can carry a
// colour of their own: the word colour and the meaning colour are picked separately
// (orange by default for meanings, the colour a red sheet / memorisation pen hides).
// Font size, 1 or 2 columns and the check-box column are settings too. The sheet
// opens as its own tab (window.print() on the app page does nothing in home-screen
// apps) with a back button and a page-by-page preview; the settings dialog shows a
// live preview of the first page. Pure helpers are exported for tests.
(function (root) {
  "use strict";

  const COLORS = [
    { id: "orange", name: "オレンジ", value: "#ff7a00" },
    { id: "red", name: "あか", value: "#e8321e" },
    { id: "pink", name: "ピンク", value: "#ff5c8a" },
    { id: "blue", name: "あお", value: "#2563eb" },
    { id: "green", name: "みどり", value: "#1f9d55" },
    { id: "purple", name: "むらさき", value: "#7c3aed" },
    { id: "black", name: "くろ", value: "#111111" },
  ];
  // Font sizes: px on paper, and how many rows fit on one page in one column.
  const FONTS = {
    s: { name: "小", px: 11, per: 34 },
    m: { name: "ふつう", px: 12.5, per: 26 },
    l: { name: "大", px: 14.5, per: 20 },
    xl: { name: "特大", px: 16.5, per: 16 },
  };

  function colorOf(id) {
    return COLORS.find((c) => c.id === id) || COLORS[0];
  }
  function fontOf(id) {
    return FONTS[id] || FONTS.m;
  }
  // A side is coloured only when its colour is a real colour (black/none = plain ink).
  function sideColor(id) {
    if (!id || id === "black" || id === "none") return "";
    return colorOf(id).value;
  }
  function colorName(id) {
    if (!id || id === "none") return "くろ";
    return colorOf(id).name;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

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

  // Normalised print options, with the 10.170 shape (hide + colour) still understood.
  function normalizeOptions(options) {
    const o = Object.assign({}, options || {});
    if (!o.wordColor && !o.meaningColor && o.hide && o.color) {
      if (o.hide === "word") o.wordColor = o.color;
      else o.meaningColor = o.color;
    }
    return {
      wordColor: o.wordColor || "black",
      meaningColor: o.meaningColor || "orange",
      fontSize: FONTS[o.fontSize] ? o.fontSize : "m",
      columns: o.columns === 2 || o.columns === "2" ? 2 : 1,
      checkbox: o.checkbox !== false && o.checkbox !== "false",
      includeSub: !!o.includeSub,
    };
  }

  function rowsPerPage(opts) {
    return fontOf(opts.fontSize).per * opts.columns;
  }
  function pageCount(rowTotal, options) {
    const opts = normalizeOptions(options);
    return Math.max(1, Math.ceil(rowTotal / rowsPerPage(opts)));
  }

  function tableHtml(rows, opts, wordColor, meaningColor) {
    const head =
      '<thead><tr>' +
      (opts.checkbox ? '<th class="bp-check"></th>' : "") +
      '<th class="bp-no">No.</th><th class="bp-word-h">単語・用語</th><th>意味</th></tr></thead>';
    const body = rows
      .map((r) => {
        const meanings = r.meanings
          .map((m) => '<span class="bp-meaning' + (m.minor ? " bp-minor" : "") + '">' + escapeHtml(m.text).replace(/\n/g, "<br>") + "</span>")
          .join("<br>");
        const sub = r.sub ? '<span class="bp-sub">' + escapeHtml(r.sub).replace(/\n/g, "<br>") + "</span>" : "";
        const wordCell = '<span class="bp-side"' + (wordColor ? ' style="color:' + wordColor + '"' : "") + ">" + escapeHtml(r.word) + "</span>";
        const meaningCell = '<span class="bp-side"' + (meaningColor ? ' style="color:' + meaningColor + '"' : "") + ">" + meanings + (meanings && sub ? "<br>" : "") + sub + "</span>";
        return (
          "<tr>" +
          (opts.checkbox ? '<td class="bp-check">☐</td>' : "") +
          '<td class="bp-no">' + escapeHtml(r.no) + '</td><td class="bp-word">' + wordCell + '</td><td class="bp-meanings">' + meaningCell + "</td></tr>"
        );
      })
      .join("");
    return '<table class="bp-table">' + head + "<tbody>" + body + "</tbody></table>";
  }

  // The sheet: a header, then one .bp-page block per printed page, each holding one
  // table (or two side by side). Page-sized chunks keep rows from splitting across
  // pages, which is what bent the table out of shape on phones.
  function sheetHtml(bookName, rows, options, totalRows) {
    const opts = normalizeOptions(options);
    const wordColor = sideColor(opts.wordColor);
    const meaningColor = sideColor(opts.meaningColor);
    const per = fontOf(opts.fontSize).per;
    const pages = [];
    for (let i = 0; i < rows.length; i += per * opts.columns) pages.push(rows.slice(i, i + per * opts.columns));
    if (!pages.length) pages.push([]);
    const shownTotal = Number.isFinite(totalRows) ? totalRows : rows.length;
    const total = pageCount(shownTotal, opts);
    const meta =
      shownTotal + "語 ／ 単語：" + colorName(opts.wordColor) + "、意味：" + colorName(opts.meaningColor) +
      " ／ 文字：" + fontOf(opts.fontSize).name + " ／ " + opts.columns + "列" + (total > 1 ? " ／ 全" + total + "ページ" : "") +
      "（オレンジと赤は赤シート・暗記ペンで隠せます）";
    const header = '<header class="bp-head"><h1>' + escapeHtml(bookName || "単語帳") + '</h1><p class="bp-meta">' + escapeHtml(meta) + "</p></header>";
    const body = pages
      .map((pageRows, pageIndex) => {
        let inner;
        if (opts.columns === 2) {
          const left = pageRows.slice(0, per);
          const right = pageRows.slice(per);
          inner =
            '<div class="bp-cols"><div class="bp-col">' + tableHtml(left, opts, wordColor, meaningColor) + '</div><div class="bp-col">' +
            (right.length ? tableHtml(right, opts, wordColor, meaningColor) : "") + "</div></div>";
        } else {
          inner = tableHtml(pageRows, opts, wordColor, meaningColor);
        }
        return '<section class="bp-page' + (pageIndex === pages.length - 1 ? " bp-page-last" : "") + '" style="--f:' + fontOf(opts.fontSize).px + 'px">' + (pageIndex === 0 ? header : "") + inner + "</section>";
      })
      .join("");
    return body;
  }

  // Styles for a sheet opened in its own tab: paper-looking pages on a grey ground
  // (that is the page preview), plain flow on paper.
  const PRINT_CSS = [
    "body{margin:0;padding:20px 12px 40px;background:#e9e9ee;color:#111;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}",
    ".bp-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;max-width:860px;margin:0 auto 16px}",
    ".bp-toolbar button{font-size:15px;font-weight:800;padding:10px 20px;border-radius:999px;cursor:pointer}",
    ".bp-print-btn{border:none;background:#ff7a00;color:#fff}",
    ".bp-back-btn{background:#fff;border:1px solid #bbb;color:#111}",
    ".bp-toolbar p{font-size:12px;color:#555;margin:0;flex-basis:100%}",
    ".bp-page{background:#fff;max-width:860px;margin:0 auto 18px;padding:26px 28px;box-shadow:0 2px 14px rgba(0,0,0,.18);box-sizing:border-box}",
    ".bp-head h1{font-size:18px;margin:0 0 2px}",
    ".bp-meta{font-size:11px;color:#555;margin:0 0 10px}",
    ".bp-cols{display:flex;gap:16px}.bp-col{flex:1;min-width:0}",
    ".bp-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:var(--f,12.5px)}",
    ".bp-table th,.bp-table td{border:1px solid #bbb;padding:5px 7px;text-align:left;vertical-align:top;line-height:1.5;overflow-wrap:anywhere}",
    ".bp-table thead th{background:#eee;font-size:.88em}",
    ".bp-check{width:26px;text-align:center}",
    ".bp-no{width:42px;color:#555}",
    ".bp-word{font-weight:700}",
    ".bp-word-h{width:32%}",
    ".bp-minor{font-size:.88em;opacity:.75}",
    ".bp-sub{font-size:.88em;color:#444}",
    "@media print{@page{margin:12mm}body{padding:0;background:#fff}.bp-toolbar{display:none}.bp-page{box-shadow:none;margin:0;padding:0;max-width:none;page-break-after:always}.bp-page-last{page-break-after:auto}}",
  ].join("\n");

  // A whole printable page: its own print and back buttons, auto-print once loaded,
  // and the share → Print route always available. The back button closes the tab
  // (it was opened by the app); if the browser refuses, it goes back in history.
  function sheetDocumentHtml(bookName, rows, options) {
    return (
      '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' +
      escapeHtml(bookName || "単語帳") +
      " - 印刷用</title><style>" +
      PRINT_CSS +
      '</style></head><body><div class="bp-toolbar"><button type="button" class="bp-back-btn" onclick="if(window.opener){window.close();}else{history.back();}">← アプリに戻る</button><button type="button" class="bp-print-btn" onclick="window.print()">🖨 印刷する</button><p>下に印刷のプレビュー（ページごと）が出ています。自動で印刷が始まらないときは「印刷する」ボタンか、ブラウザの「共有」→「プリント」を使ってください。終わったら「アプリに戻る」で戻れます。</p></div>' +
      sheetHtml(bookName, rows, options) +
      '<script>window.addEventListener("load",function(){setTimeout(function(){try{window.print();}catch(e){}},400);});<\/script></body></html>'
    );
  }

  const api = { COLORS, FONTS, colorOf, fontOf, sideColor, escapeHtml, rowOf, selectWords, unitsOf, normalizeOptions, rowsPerPage, pageCount, sheetHtml, sheetDocumentHtml, PRINT_CSS };
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
  // Settings from the dialog, filling old saved shapes (10.170: hide + color).
  function initialSettings() {
    const s = Object.assign({ wordColor: "black", meaningColor: "orange", fontSize: "m", columns: 1, checkbox: true, scope: "all", includeSub: false }, savedSettings());
    if (savedSettings().color && !savedSettings().meaningColor && !savedSettings().wordColor) {
      if (s.hide === "word") s.wordColor = s.color;
      else s.meaningColor = s.color;
    }
    return s;
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

  function colorFieldset(legend, name, selected) {
    const swatches = COLORS.map(
      (c) =>
        '<label class="bp-color"><input type="radio" name="' + name + '" value="' + c.id + '"' + (selected === c.id ? " checked" : "") + '><span class="bp-swatch" style="background:' + c.value + '"></span><span>' + escapeHtml(c.name) + "</span></label>"
    ).join("");
    return "<fieldset><legend>" + legend + '</legend><div class="bp-colors">' + swatches + "</div></fieldset>";
  }

  function openDialog() {
    const words = currentWords();
    if (!words.length) {
      window.alert("この単語帳には、まだ単語がありません。");
      return;
    }
    document.getElementById("bookPrintDialog")?.remove();
    const settings = initialSettings();
    const units = unitsOf(words);
    const dialog = document.createElement("dialog");
    dialog.id = "bookPrintDialog";
    dialog.className = "bp-dialog";
    dialog.innerHTML =
      '<form method="dialog" class="bp-form"><header class="bp-dialog-head"><h2>紙に印刷する</h2><button type="button" class="bp-close" aria-label="閉じる">×</button></header>' +
      '<p class="bp-note">単語帳「' + escapeHtml(currentBookName()) + '」（' + words.length + '語）を、紙で使える一覧にします。「印刷する」を押すと、印刷用ページが新しいタブで開きます。</p>' +
      colorFieldset("単語の色", "bpWordColor", settings.wordColor) +
      colorFieldset("意味の色", "bpMeaningColor", settings.meaningColor) +
      '<p class="bp-note">色つきの所は、赤シートや暗記ペンで隠して覚えられます（オレンジ・赤が向いています）。隠さない方は「くろ」にしてください。</p>' +
      '<fieldset><legend>文字の大きさ</legend><div class="bp-inline">' +
      Object.keys(FONTS).map((id) => '<label class="bp-radio"><input type="radio" name="bpFont" value="' + id + '"' + (settings.fontSize === id ? " checked" : "") + "> " + FONTS[id].name + "</label>").join("") +
      "</div></fieldset>" +
      '<fieldset><legend>並べ方</legend><div class="bp-inline">' +
      '<label class="bp-radio"><input type="radio" name="bpCols" value="1"' + (Number(settings.columns) !== 2 ? " checked" : "") + '> 1列</label>' +
      '<label class="bp-radio"><input type="radio" name="bpCols" value="2"' + (Number(settings.columns) === 2 ? " checked" : "") + '> 2列</label></div>' +
      '<label class="bp-check-line"><input type="checkbox" id="bpCheck"' + (settings.checkbox !== false ? " checked" : "") + '> チェックボックス（☐）を付ける</label></fieldset>' +
      '<fieldset><legend>印刷する範囲</legend><label class="bp-radio"><input type="radio" name="bpScope" value="all"' + (settings.scope === "all" ? " checked" : "") + '> 全部</label>' +
      '<label class="bp-radio"><input type="radio" name="bpScope" value="range"' + (settings.scope === "range" ? " checked" : "") + '> 番号で選ぶ <span class="bp-range"><input type="number" id="bpFrom" min="1" inputmode="numeric" placeholder="最初"> ～ <input type="number" id="bpTo" min="1" inputmode="numeric" placeholder="最後"></span></label>' +
      (units.length ? '<label class="bp-radio"><input type="radio" name="bpScope" value="unit"' + (settings.scope === "unit" ? " checked" : "") + '> 単元で選ぶ <select id="bpUnit">' + units.map((u) => '<option value="' + escapeHtml(u) + '"' + (settings.unit === u ? " selected" : "") + ">" + escapeHtml(u) + "</option>").join("") + '</select></label>' : "") +
      "</fieldset>" +
      '<label class="bp-check-line"><input type="checkbox" id="bpSub"' + (settings.includeSub ? " checked" : "") + '> サブ情報も入れる</label>' +
      '<div class="bp-preview-wrap"><p class="bp-count" role="status"></p><div class="bp-preview" aria-label="印刷プレビュー"></div></div>' +
      '<div class="bp-actions"><button type="button" class="bp-cancel">やめる</button><button type="button" class="bp-print">印刷する</button></div></form>';
    document.body.append(dialog);

    const readSettings = () => {
      const from = parseInt(dialog.querySelector("#bpFrom")?.value, 10);
      const to = parseInt(dialog.querySelector("#bpTo")?.value, 10);
      return {
        wordColor: dialog.querySelector('input[name="bpWordColor"]:checked')?.value || "black",
        meaningColor: dialog.querySelector('input[name="bpMeaningColor"]:checked')?.value || "orange",
        fontSize: dialog.querySelector('input[name="bpFont"]:checked')?.value || "m",
        columns: parseInt(dialog.querySelector('input[name="bpCols"]:checked')?.value, 10) === 2 ? 2 : 1,
        checkbox: !!dialog.querySelector("#bpCheck")?.checked,
        scope: dialog.querySelector('input[name="bpScope"]:checked')?.value || "all",
        from: Number.isFinite(from) ? from : undefined,
        to: Number.isFinite(to) ? to : undefined,
        unit: dialog.querySelector("#bpUnit")?.value || "",
        includeSub: !!dialog.querySelector("#bpSub")?.checked,
      };
    };
    const refresh = () => {
      const s = readSettings();
      const picked = selectWords(words, s, shownNo);
      const pages = pageCount(picked.length, s);
      dialog.querySelector(".bp-count").textContent = picked.length + "語 ／ 約" + pages + "ページ（目安）";
      dialog.querySelector(".bp-print").disabled = picked.length === 0;
      const previewRows = picked.slice(0, rowsPerPage(s)).map((w) => rowOf(w, shownNo(w), s.includeSub));
      dialog.querySelector(".bp-preview").innerHTML = picked.length ? sheetHtml(currentBookName(), previewRows, s, picked.length) : '<p class="bp-note">この条件では印刷する単語がありません。</p>';
    };
    dialog.addEventListener("change", refresh);
    dialog.addEventListener("input", refresh);
    refresh();

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
    const rows = words.map((w) => rowOf(w, shownNo(w), settings.includeSub));
    let win = null;
    try {
      win = window.open("", "_blank");
    } catch (e) {}
    if (win && win.document) {
      try {
        win.document.open();
        win.document.write(sheetDocumentHtml(currentBookName(), rows, settings));
        win.document.close();
        if (win.focus) win.focus();
        return;
      } catch (e) {}
    }
    showPreview(rows, settings);
  }

  function showPreview(rows, settings) {
    document.getElementById("bookPrintSheet")?.remove();
    const sheet = document.createElement("section");
    sheet.id = "bookPrintSheet";
    sheet.className = "bp-preview";
    sheet.innerHTML =
      '<div class="bp-sheet-toolbar"><button type="button" class="bp-sheet-back">← アプリに戻る</button><button type="button" class="bp-sheet-print">🖨 印刷する</button><p>印刷が始まらないときは、ブラウザの「共有」→「プリント」でも印刷できます。</p></div>' +
      sheetHtml(currentBookName(), rows, settings);
    document.body.append(sheet);
    document.body.classList.add("bp-previewing");
    const back = () => {
      sheet.remove();
      document.body.classList.remove("bp-previewing", "bp-printing");
    };
    sheet.querySelector(".bp-sheet-back").onclick = back;
    sheet.querySelector(".bp-sheet-print").onclick = () => {
      document.body.classList.add("bp-printing");
      const done = () => {
        document.body.classList.remove("bp-printing");
        window.removeEventListener("afterprint", done);
      };
      window.addEventListener("afterprint", done);
      setTimeout(() => window.print(), 30);
      setTimeout(done, 60000);
    };
    sheet.scrollTop = 0;
  }

  setInterval(ensureButton, 1000);
  if (typeof MutationObserver !== "undefined") new MutationObserver(ensureButton).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", ensureButton);
  root.BookPrintUI = { open: openDialog, ensureButton };
})(typeof window === "undefined" ? globalThis : window);
