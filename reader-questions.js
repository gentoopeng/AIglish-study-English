// Questions on a passage (長文解析の「問題を追加」). The pasted questions are solved from the passage itself (not from outside
// knowledge) by Gemini, with the answer, why, the lines of the passage it rests on, and what is wrong with each other choice.
// The questions and the explanation are kept on this device per passage (aiglish_reader_questions), so opening the passage
// again from the history or the shelf shows them without asking the AI again.
(function () {
  "use strict";
  const KEY = "aiglish_reader_questions", MAX = 30, QUESTION_LIMIT = 6000;
  const hash = (value) => {
    const s = String(value);
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36) + "_" + s.length;
  };
  function readAll() {
    try { const v = JSON.parse(localStorage.getItem(KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
  }
  function writeAll(all) {
    const keys = Object.keys(all).sort((a, b) => (all[b].at || 0) - (all[a].at || 0));
    for (const k of keys.slice(MAX)) delete all[k];
    try { localStorage.setItem(KEY, JSON.stringify(all)); window.markReaderDataChanged?.(); return true; } catch { return false; }
  }
  const get = (passage) => readAll()[hash(passage)] || null;
  function set(passage, value) {
    const all = readAll();
    if (value) all[hash(passage)] = { ...value, at: Date.now() };
    else delete all[hash(passage)];
    return writeAll(all);
  }

  const SCHEMA = {
    type: "OBJECT",
    properties: {
      questions: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            number: { type: "STRING" },
            question: { type: "STRING" },
            answer: { type: "STRING" },
            explanation: { type: "STRING" },
            evidence: { type: "STRING" },
            evidenceTranslation: { type: "STRING" },
            choices: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: { label: { type: "STRING" }, correct: { type: "BOOLEAN" }, reason: { type: "STRING" } },
                required: ["label", "correct", "reason"],
                propertyOrdering: ["label", "correct", "reason"],
              },
            },
          },
          required: ["number", "question", "answer", "explanation", "evidence", "evidenceTranslation", "choices"],
          propertyOrdering: ["number", "question", "answer", "explanation", "evidence", "evidenceTranslation", "choices"],
        },
      },
    },
    required: ["questions"],
  };
  // The rules for solving, shared by the separate request below and the one that goes with the analysis (reader.js).
  const RULES =
    "決まり:\n" +
    "- 答えは、英文に書かれていることだけをもとに決める。英文に書かれていないこと（ふつうの知識や想像）は根拠にしない。英文から決められない問題は、そのことを explanation に書く。\n" +
    "- 問題が複数あるときは、問題ごとに分けて、出てきた順に入れる。番号がなければ 1, 2, … とふる（number）。\n" +
    "- question: 問題文をそのまま（英語なら英語のまま）。選択肢は含めない。\n" +
    "- 選択肢がある問題: answer は選択肢の記号を、問題に書かれたとおりに（①②③④、ア〜エ、A〜D、1〜4 など）。選択肢がない問題: answer は答えを短く。\n" +
    "- explanation: なぜその答えになるのかを、英文の内容にそって2〜4文で。\n" +
    "- evidence: 根拠になる英文の部分を、英文からそのまま抜き出す（1〜2文、書き換えない）。根拠が見つからないときは空の文字列。\n" +
    "- evidenceTranslation: evidence の自然な日本語訳。\n" +
    "- choices: 選択肢がある問題では、すべての選択肢について label（記号）、correct（正解なら true）、reason（その選択肢が英文に合っている／合っていない理由を、英文に基づいて1文）。選択肢がない問題では空の配列。\n";
  function prompt(passage, questions) {
    return (
      "あなたは高校生に英語の読解を教える先生です。次の「英文」について出された「問題」を解いて、日本語で解説してください。\n\n" +
      RULES + "\n英文:\n" + passage + "\n\n問題:\n" + questions
    );
  }
  // What the AI sent back, cut to a safe size: { questions: [...] } or null.
  function normalize(list) {
    if (!Array.isArray(list) || !list.length) return null;
    const str = (v, n) => String(v == null ? "" : v).slice(0, n);
    return {
      questions: list.slice(0, 20).map((q, i) => ({
        number: str((q && q.number) || i + 1, 12),
        question: str(q && q.question, 1200),
        answer: str(q && q.answer, 300),
        explanation: str(q && q.explanation, 1500),
        evidence: str(q && q.evidence, 600),
        evidenceTranslation: str(q && q.evidenceTranslation, 600),
        choices: (Array.isArray(q && q.choices) ? q.choices : []).slice(0, 10).map((c) => ({ label: str(c && c.label, 12), correct: !!(c && c.correct), reason: str(c && c.reason, 500) })),
      })),
    };
  }
  function apiKey() {
    const input = document.getElementById("sidebarApiKeyInput");
    return (input && input.value.trim()) || localStorage.getItem("core_v4_geminiKey") || (typeof geminiApiKey !== "undefined" ? geminiApiKey : "");
  }
  // { result } or { error: { title, detail } }
  async function solve(passage, questions) {
    const key = apiKey();
    if (!key) return { error: { title: "APIキーが必要です", detail: "メニューの「設定」でGemini APIキーを保存すると、問題を解けます。" } };
    const describe = window.describeGeminiError || ((s) => ({ title: "AIの解析に失敗しました", detail: "少し待ってから、もう一度お試しください。" }));
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = setTimeout(() => controller && controller.abort(), 60000);
    try {
      let useSchema = true;
      const send = (model) => {
        const config = { responseMimeType: "application/json", temperature: 0.2 };
        if (useSchema) config.responseSchema = SCHEMA;
        return fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(key), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt(passage, questions) }] }], generationConfig: config }),
          signal: controller ? controller.signal : undefined,
        });
      };
      const busy = (s) => s === 500 || s === 502 || s === 503 || s === 504;
      const models = ["gemini-2.5-flash", "gemini-flash-latest"];
      let response;
      for (let m = 0; m < models.length; m++) {
        for (let attempt = 0; attempt < 2; attempt++) {
          if (attempt) await new Promise((r) => setTimeout(r, 2000));
          response = await send(models[m]);
          if (response.status === 400 && useSchema && /schema|Unknown name|Invalid JSON payload|propertyOrdering/i.test(await response.clone().text())) {
            useSchema = false;
            response = await send(models[m]);
          }
          if (!busy(response.status)) break;
        }
        if (response.ok || !(response.status === 404 || response.status === 429 || busy(response.status))) break;
      }
      if (!response.ok) {
        let apiText = "";
        try { const p = JSON.parse(await response.text()); apiText = (Array.isArray(p) ? p[0] : p).error?.message || ""; } catch {}
        return { error: describe(response.status, apiText) };
      }
      const body = await response.json();
      let text = String(body?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "").trim();
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      const a = text.indexOf("{"), b = text.lastIndexOf("}");
      if (a >= 0 && b > a) text = text.slice(a, b + 1);
      let data = null;
      try { data = JSON.parse(text); } catch {}
      if (!data || !Array.isArray(data.questions) || !data.questions.length) return { error: describe("unreadable") };
      const out = normalize(data.questions);
      if (!out) return { error: describe("unreadable") };
      return { result: out };
    } catch (e) {
      return { error: describe(e && e.name === "AbortError" ? "timeout" : "network") };
    } finally {
      clearTimeout(timer);
    }
  }

  // ---- The input side: the button under the pasted passage ------------------------------------
  const el = (id) => document.getElementById(id);
  let pending = "";
  function bindInput() {
    const toggle = el("readerQuestionsToggle"), box = el("readerQuestionsBox"), input = el("readerQuestionsInput");
    if (!toggle || !box || !input) return;
    const refresh = () => {
      const open = !box.hidden, has = !!input.value.trim();
      toggle.setAttribute("aria-expanded", String(open));
      toggle.classList.toggle("has-questions", has);
      toggle.querySelector("span").textContent = open ? "問題を閉じる" : has ? "問題を追加済み（開く）" : "問題を追加";
    };
    toggle.onclick = () => { box.hidden = !box.hidden; refresh(); if (!box.hidden) input.focus(); };
    input.addEventListener("input", refresh);
    el("readerClearButton")?.addEventListener("click", () => { input.value = ""; box.hidden = true; refresh(); });
    refresh();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindInput, { once: true });
  else bindInput();

  // ---- The result side: the card under the analysed passage ----------------------------------
  let shownFor = "", token = 0;
  const node = (tag, className, text) => { const n = document.createElement(tag); if (className) n.className = className; if (text !== undefined) n.textContent = text; return n; };
  function chooser(card, passage, initial) {
    const box = node("div", "rq-add");
    const label = node("label", "reader-field-label", "問題（選択肢もいっしょに貼り付け）");
    const input = node("textarea", "modern-textarea rq-input"); input.maxLength = QUESTION_LIMIT; input.value = initial || "";
    input.placeholder = "例：\n1. What is the main idea of the passage?\n① …\n② …\n③ …\n④ …";
    label.append(input);
    const go = node("button", "modern-btn rq-go", "解いて解説する");
    go.type = "button";
    go.onclick = () => {
      const text = input.value.trim();
      if (!text) { input.focus(); return; }
      run(passage, text);
    };
    box.append(label, go);
    return box;
  }
  function render(passage) {
    const card = el("readerQuestionsCard");
    if (!card) return;
    card.replaceChildren();
    card.hidden = false;
    const heading = node("h2", "", "問題の解説");
    card.append(heading);
    const saved = get(passage);
    if (!saved || !saved.text) {
      card.append(node("p", "rq-hint", "この英文の問題を貼り付けると、英文の内容にそって解いて、解説します。"), chooser(card, passage, ""));
      return;
    }
    if (saved.loading) {
      const status = node("div", "reader-analyzing"); status.setAttribute("role", "status");
      status.append(node("span", "", "問題を解いています…"));
      card.append(status);
      return;
    }
    if (saved.error) {
      const notice = node("div", "reader-key-notice reader-error-notice"); notice.setAttribute("role", "alert");
      const again = node("button", "", "もう一度解く"); again.type = "button"; again.onclick = () => run(passage, saved.text);
      notice.append(node("strong", "", saved.error.title || "問題を解けませんでした"), node("span", "", saved.error.detail || ""), again);
      card.append(notice, tools(card, passage, saved));
      return;
    }
    for (const q of saved.result.questions) {
      const item = node("section", "rq-item");
      const head = node("div", "rq-head");
      head.append(node("span", "rq-num", q.number), node("span", "rq-question", q.question));
      const answer = node("div", "rq-answer");
      answer.append(node("small", "", "答え"), node("strong", "", q.answer));
      item.append(head, answer, node("p", "rq-explanation", q.explanation));
      if (q.evidence) {
        const quote = node("blockquote", "rq-evidence");
        quote.append(node("small", "", "本文の根拠"), node("span", "rq-en", q.evidence));
        if (q.evidenceTranslation) quote.append(node("span", "rq-ja", q.evidenceTranslation));
        item.append(quote);
      }
      if (q.choices.length) {
        const list = node("ul", "rq-choices");
        for (const c of q.choices) {
          const li = node("li", c.correct ? "is-correct" : "is-wrong");
          li.append(node("b", "", (c.correct ? "○ " : "× ") + c.label), node("span", "", c.reason));
          list.append(li);
        }
        item.append(list);
      }
      card.append(item);
    }
    card.append(tools(card, passage, saved));
  }
  function tools(card, passage, saved) {
    const row = node("div", "rq-tools");
    const redo = node("button", "", "問題を入れ直す"); redo.type = "button";
    redo.onclick = () => { card.replaceChildren(node("h2", "", "問題の解説"), chooser(card, passage, saved.text)); };
    const clear = node("button", "", "問題を消す"); clear.type = "button";
    clear.onclick = () => { set(passage, null); render(passage); };
    row.append(redo, clear);
    return row;
  }
  async function run(passage, text) {
    const mine = ++token;
    set(passage, { text, loading: true });
    render(passage);
    const out = await solve(passage, text);
    if (mine !== token) return;
    set(passage, out.result ? { text, result: out.result } : { text, error: out.error });
    if (shownFor === passage) render(passage);
  }
  const api = {
    // The text pasted on the input side, handed to the next analysis.
    takeInput() {
      const input = el("readerQuestionsInput");
      const text = input ? input.value.trim() : "";
      pending = text;
      // Taken for this analysis: the box is emptied so the next passage does not get these questions.
      if (input && text) { input.value = ""; input.dispatchEvent(new Event("input")); const box = el("readerQuestionsBox"); if (box) { box.hidden = true; input.dispatchEvent(new Event("input")); } }
      return text;
    },
    // Called when a passage is shown in the reader view.
    show(passage) {
      shownFor = String(passage || "");
      token++;
      const text = pending; pending = "";
      if (text) { run(shownFor, text); return; }
      const saved = get(shownFor);
      // A solve that was cut off (the page closed) is asked again.
      if (saved && saved.loading) { run(shownFor, saved.text); return; }
      render(shownFor);
    },
    // The questions waiting for the next analysis (reader.js sends them along with it, in the same request).
    pendingText: () => pending,
    // The answers that came back with the analysis: kept for the passage, and no separate request is needed.
    adopt(passage, text, answers) {
      const result = normalize(answers);
      if (!result || !text || text !== pending) return false;
      pending = "";
      set(String(passage || ""), { text, result });
      return true;
    },
    ITEM: SCHEMA.properties.questions.items, RULES, normalize,
    get, solve,
  };
  window.ReaderQuestions = api;
})();
