// Editing an analysis (長文解析の結果を直す): the translation of a sentence, its grammar points (add, change, remove) and the summary.
// "解析を編集" in the reader's title row switches the edit marks on; each sentence then has a ✎. A change is kept with the history
// entry and with the bookshelf texts of the same passage (so opening it again shows the edited analysis, without asking the AI).
// The English itself is not edited here (the bookshelf's "名前・本文を編集" does that, and the passage is analysed again).
(function () {
  "use strict";
  const node = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text !== undefined) el.textContent = text; return el; };
  const button = (text, action, cls) => { const el = node("button", cls, text); el.type = "button"; el.onclick = action; return el; };
  const copy = (value) => JSON.parse(JSON.stringify(value));
  let editing = false;
  const analysis = () => (typeof currentActiveAiAnalysisCache !== "undefined" ? currentActiveAiAnalysisCache : null);
  const editable = () => { const a = analysis(); return !!a && !a.analysisError && Array.isArray(a.sentences) && a.sentences.length > 0; };

  // Keeps the changed analysis everywhere the passage is held, and draws it again.
  function commit(next) {
    const text = currentActiveReaderText, title = currentActiveTitle;
    next.edited = true;
    // A translation typed by hand before the analysis is part of the analysis from now on (it would hide the edit otherwise).
    const manual = document.getElementById("customJapanesetextarea");
    if (manual) manual.value = "";
    if (Array.isArray(myBookshelf)) {
      let touched = false;
      for (const item of myBookshelf) if (item && item.text === text) { item.aiAnalysisData = copy(next); item.updatedAt = Date.now(); touched = true; }
      if (touched) window.ReaderShelf?.save?.();
    }
    const top = window.scrollY;
    // (analyzeText puts the passage at the head of the history with this analysis, and saves the history)
    return Promise.resolve(window.analyzeText(text, title, next)).then(() => { window.scrollTo(0, top); window.showToast?.("解析を直しました。", "ok"); });
  }
  // Before the first edit: what the screen shows as the translation (a hand-typed line wins over the AI's) becomes the analysis.
  function baked() {
    const next = copy(analysis());
    const manual = document.getElementById("customJapanesetextarea");
    const lines = manual ? manual.value.trim().split("\n").filter((l) => l.trim() !== "") : [];
    next.sentences.forEach((s, i) => { if (lines[i]) s.translation = lines[i]; else if (!s.translation && s.translations) s.translation = s.translations; });
    return next;
  }

  function editSentence(index) {
    const draft = baked(), sentence = draft.sentences[index];
    if (!sentence) return;
    const modal = window.openLibraryDialog((index + 1) + "文目を編集", '<form class="re-form"><p class="re-english"></p><label for="reJa">和訳</label><textarea id="reJa" rows="3"></textarea><div class="re-points-head"><span>文法のポイント</span></div><div class="re-points"></div><button type="button" class="re-add">＋ ポイントを追加</button><p class="library-editor-error" role="alert"></p><div class="library-editor-actions"><button type="button" data-library-close>キャンセル</button><button type="submit" class="library-editor-primary">保存</button></div></form>');
    const eyebrow = modal.querySelector(".library-editor-eyebrow");
    if (eyebrow) eyebrow.textContent = "";
    modal.querySelector(".re-english").textContent = sentence.text;
    const ja = modal.querySelector("#reJa"), points = modal.querySelector(".re-points"), error = modal.querySelector(".library-editor-error");
    ja.value = sentence.translation || "";
    const addPoint = (h) => {
      const box = node("div", "re-point");
      const field = (label, value, cls, multi) => {
        const wrap = node("label", "re-field", label), input = node(multi ? "textarea" : "input", cls);
        if (multi) input.rows = 2;
        input.value = value || "";
        wrap.append(input);
        return wrap;
      };
      box.append(field("英文の中の語句（そのまま）", h.phrase, "re-phrase"), field("名前（例：分詞構文）", h.label, "re-label"), field("説明", h.meaning, "re-meaning", true), button("このポイントを削除", () => box.remove(), "re-remove"));
      points.append(box);
      return box;
    };
    (Array.isArray(sentence.grammarHighlights) ? sentence.grammarHighlights : []).forEach(addPoint);
    modal.querySelector(".re-add").onclick = () => addPoint({}).querySelector(".re-phrase").focus();
    modal.querySelector("form").onsubmit = (event) => {
      event.preventDefault();
      const list = [];
      for (const box of points.querySelectorAll(".re-point")) {
        const phrase = box.querySelector(".re-phrase").value.trim(), label = box.querySelector(".re-label").value.trim(), meaning = box.querySelector(".re-meaning").value.trim();
        if (!phrase && !label && !meaning) continue;
        if (!phrase || !meaning) { error.textContent = "ポイントには、英文の中の語句と説明を入れてください。"; return; }
        // The phrase is what gets underlined: it has to be found in the sentence.
        if (typeof window.findGrammarPhrase === "function" && !window.findGrammarPhrase(sentence.text, phrase, [])) { error.textContent = "「" + phrase + "」が、この英文の中に見つかりません。英文の語句をそのまま入れてください。"; return; }
        list.push({ phrase: phrase.slice(0, 300), label: (label || "文法").slice(0, 60), meaning: meaning.slice(0, 600) });
      }
      sentence.translation = ja.value.trim().slice(0, 2000);
      delete sentence.translations;
      sentence.grammarHighlights = list.slice(0, 8);
      window.closeLibraryDialog();
      commit(draft);
    };
  }
  function editSummary() {
    const draft = baked();
    const modal = window.openLibraryDialog("要約を編集", '<form class="re-form"><label for="reSummary">要約</label><textarea id="reSummary" rows="5"></textarea><div class="library-editor-actions"><button type="button" data-library-close>キャンセル</button><button type="submit" class="library-editor-primary">保存</button></div></form>');
    const eyebrow = modal.querySelector(".library-editor-eyebrow");
    if (eyebrow) eyebrow.textContent = "";
    const input = modal.querySelector("#reSummary");
    input.value = draft.fullSummaryAbstract || "";
    modal.querySelector("form").onsubmit = (event) => {
      event.preventDefault();
      draft.fullSummaryAbstract = input.value.trim().slice(0, 3000);
      window.closeLibraryDialog();
      commit(draft);
    };
  }

  // The marks on the screen: the switch in the title row, a ✎ on every sentence, one on the summary.
  function decorate() {
    const row = document.querySelector("#readerCurrentTitle .reader-title-row"), container = document.getElementById("englishContainer");
    document.querySelectorAll(".re-toggle, .re-pen").forEach((el) => el.remove());
    if (!row || !container || !editable()) return;
    const toggle = button(editing ? "編集を終わる" : "解析を編集", () => { editing = !editing; decorate(); }, "reader-save-button re-toggle" + (editing ? " is-on" : ""));
    toggle.setAttribute("aria-pressed", String(editing));
    row.append(toggle);
    container.classList.toggle("re-editing", editing);
    if (!editing) return;
    // The blocks on the screen are the sentences that have a text, in order.
    const sentences = analysis().sentences, blocks = [...container.querySelectorAll(".sentence-container")];
    let at = 0;
    sentences.forEach((s, index) => {
      if (!s || !String(s.text || "").trim()) return;
      const block = blocks[at++];
      if (!block) return;
      const pen = button("✎ 編集", () => editSentence(index), "re-pen");
      pen.setAttribute("aria-label", (index + 1) + "文目を編集");
      block.append(pen);
    });
    const card = document.getElementById("summary-abstract-card");
    if (card) {
      const pen = button("✎ 編集", editSummary, "re-pen re-pen-summary");
      pen.setAttribute("aria-label", "要約を編集");
      card.style.display = "block";
      card.append(pen);
    }
  }
  const original = window.analyzeText;
  window.analyzeText = async function (rawText) {
    // Another passage: the edit marks are switched off again.
    if (typeof currentActiveReaderText !== "undefined" && rawText !== currentActiveReaderText) editing = false;
    const result = await original.apply(this, arguments);
    try { decorate(); } catch (error) { console.warn("[reader] edit marks", error); }
    return result;
  };
  window.ReaderEdit = { decorate };
})();
