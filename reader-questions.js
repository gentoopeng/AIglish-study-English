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
    // The cut-out figures make the record bigger: when the device is full, the older passages lose their figures first.
    const order = keys.slice().reverse();
    for (let attempt = 0; attempt <= order.length; attempt++) {
      try { localStorage.setItem(KEY, JSON.stringify(all)); window.markReaderDataChanged?.(); return true; } catch { /* make room */ }
      const k = order[attempt];
      if (!k || !all[k] || !all[k].result) continue;
      for (const q of all[k].result.questions) q.figures = [];
    }
    return false;
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
            figures: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: { image: { type: "INTEGER" }, box: { type: "ARRAY", items: { type: "INTEGER" } }, caption: { type: "STRING" } },
                required: ["image", "box", "caption"],
                propertyOrdering: ["image", "box", "caption"],
              },
            },
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
          propertyOrdering: ["number", "question", "answer", "explanation", "evidence", "evidenceTranslation", "figures", "choices"],
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
    "- figures: 問題の画像が添付されていて、その中に、問題を解くのに必要な図・表・グラフ・地図・イラストがあるときだけ、その位置を入れる（問題文や選択肢の文字だけの部分は入れない。画像がないときは空の配列）。image: 何枚目の画像か（1から）。box: [上, 左, 下, 右] を、画像の左上を (0,0)、右下を (1000,1000) とした整数で、図や表をちょうど囲む四角。caption: 図の名前を10字ほどで（例：「表1」「地図」「図」）。1つの問題に最大2つ。\n" +
    "- choices: 選択肢がある問題では、すべての選択肢について label（記号）、correct（正解なら true）、reason（その選択肢が英文に合っている／合っていない理由を、英文に基づいて1文）。選択肢がない問題では空の配列。\n";
  // The questions as text for the prompt: what was typed, and a note about the pictures that go with it (a photo or screenshot of the questions).
  const IMAGE_MAX = 4;
  const hasQ = (q) => !!q && (!!q.text || (Array.isArray(q.images) && q.images.length > 0));
  const labelOf = (q) => q.text || "画像の問題（" + q.images.length + "枚）";
  function questionBlock(q) {
    const n = Array.isArray(q.images) ? q.images.length : 0;
    return (q.text || (n ? "（問題は、添付の画像に書かれています）" : "")) +
      (n ? "\n\n添付の画像" + n + "枚は、この問題の写真やスクリーンショットです。画像の文字を読み取って、問題として解いてください（question には、読み取った問題文を書く）。図や表があるときは、それも手がかりにする。" : "");
  }
  const imageParts = (images) => (Array.isArray(images) ? images : []).slice(0, IMAGE_MAX).map((src) => ({ inlineData: { mimeType: "image/jpeg", data: String(src).slice(String(src).indexOf(",") + 1) } }));
  function prompt(passage, q) {
    return (
      "あなたは高校生に英語の読解を教える先生です。次の「英文」について出された「問題」を解いて、日本語で解説してください。\n\n" +
      RULES + "\n英文:\n" + passage + "\n\n問題:\n" + questionBlock(q)
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
        // Where the figures are (0-1000 of each picture): cut out later, in cropFigures, while the pictures are still at hand.
        figures: (Array.isArray(q && q.figures) ? q.figures : []).slice(0, 2).map((f) => {
          const b = Array.isArray(f && f.box) ? f.box.map((v) => Math.max(0, Math.min(1000, Math.round(Number(v) || 0)))) : [];
          return b.length === 4 && b[2] - b[0] >= 20 && b[3] - b[1] >= 20 ? { src: Math.max(1, Math.round(Number(f.image) || 1)), box: b, caption: str(f.caption, 24) } : null;
        }).filter(Boolean),
        choices: (Array.isArray(q && q.choices) ? q.choices : []).slice(0, 10).map((c) => ({ label: str(c && c.label, 12), correct: !!(c && c.correct), reason: str(c && c.reason, 500) })),
      })),
    };
  }
  // Cuts the figures out of the pictures that were sent (each as a small JPEG, long side at most 640px) and puts them in the result:
  // figure.image. A box that does not make sense (outside the picture, or the whole picture) is dropped. Never throws.
  const FIGURE_SIDE = 640;
  async function cropFigures(result, images) {
    if (!result) return false;
    // Without pictures there is nothing to cut (the boxes are dropped).
    if (!Array.isArray(images) || !images.length) { for (const q of result.questions) q.figures = []; return false; }
    const loaded = new Map();
    const load = (i) => {
      if (!loaded.has(i)) loaded.set(i, new Promise((resolve) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = images[i]; }));
      return loaded.get(i);
    };
    let changed = false;
    for (const q of result.questions) {
      const out = [];
      for (const f of q.figures || []) {
        if (f.image) { out.push(f); continue; }
        try {
          const img = await load(Math.min(images.length, f.src || 1) - 1);
          if (!img) continue;
          const [top, left, bottom, right] = f.box, pad = 0.02;
          const x0 = Math.max(0, (left / 1000 - pad) * img.naturalWidth), x1 = Math.min(img.naturalWidth, (right / 1000 + pad) * img.naturalWidth);
          const y0 = Math.max(0, (top / 1000 - pad) * img.naturalHeight), y1 = Math.min(img.naturalHeight, (bottom / 1000 + pad) * img.naturalHeight);
          const w = x1 - x0, h = y1 - y0;
          if (w < 24 || h < 24 || (w > img.naturalWidth * 0.96 && h > img.naturalHeight * 0.96)) continue;
          const scale = Math.min(1, FIGURE_SIDE / Math.max(w, h)), canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(w * scale)); canvas.height = Math.max(1, Math.round(h * scale));
          const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, x0, y0, w, h, 0, 0, canvas.width, canvas.height);
          out.push({ image: canvas.toDataURL("image/jpeg", 0.7), caption: f.caption });
          canvas.width = 0; canvas.height = 0; changed = true;
        } catch { /* no figure for this one */ }
      }
      q.figures = out;
    }
    return changed || result.questions.some((q) => (q.figures || []).length === 0);
  }
  function apiKey() {
    const input = document.getElementById("sidebarApiKeyInput");
    return (input && input.value.trim()) || localStorage.getItem("core_v4_geminiKey") || (typeof geminiApiKey !== "undefined" ? geminiApiKey : "");
  }
  // { result } or { error: { title, detail } }
  async function solve(passage, q) {
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
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt(passage, q) }].concat(imageParts(q.images)) }], generationConfig: config }),
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

  // ---- Pictures of the questions (a photo or screenshot) ---------------------------------------
  // Each is cut down to 1400px JPEG here; they are sent with the request and not kept (only the answers are).
  function picker(onChange) {
    const images = [], root = node("div", "rq-images"), strip = node("div", "rq-thumbs");
    const add = node("button", "rq-photo", "📷 画像を追加（写真・スクリーンショット）"), status = node("small", "rq-photo-status"), file = node("input");
    add.type = "button"; file.type = "file"; file.accept = "image/*"; file.multiple = true; file.hidden = true;
    const draw = () => {
      strip.replaceChildren();
      images.forEach((src, i) => {
        const item = node("span", "rq-thumb"), img = node("img"), drop = node("button", "", "×");
        img.src = src; img.alt = "問題の画像" + (i + 1);
        drop.type = "button"; drop.setAttribute("aria-label", "画像" + (i + 1) + "を外す");
        drop.onclick = () => { images.splice(i, 1); draw(); onChange && onChange(); };
        item.append(img, drop); strip.append(item);
      });
      add.disabled = images.length >= IMAGE_MAX;
    };
    add.onclick = () => file.click();
    file.onchange = async () => {
      const files = [...file.files]; file.value = ""; let message = "";
      for (const f of files) {
        if (images.length >= IMAGE_MAX) { message = "画像は" + IMAGE_MAX + "枚までです。"; break; }
        status.textContent = "画像を準備しています…";
        try { images.push(await window.ProfileImages.imageFile(f, 1400, "image/jpeg", () => true, 0.75)); }
        catch (error) { message = (error && error.message) || "画像を読み込めませんでした。"; }
      }
      status.textContent = message; draw(); onChange && onChange();
    };
    root.append(add, file, strip, status); draw();
    return { node: root, images: () => images.slice(), clear: () => { images.length = 0; draw(); } };
  }

  // ---- The input side: the button under the pasted passage ------------------------------------
  const el = (id) => document.getElementById(id);
  let pending = null, inputPicker = null;
  function bindInput() {
    const toggle = el("readerQuestionsToggle"), box = el("readerQuestionsBox"), input = el("readerQuestionsInput");
    if (!toggle || !box || !input) return;
    const refresh = () => {
      const open = !box.hidden, has = !!input.value.trim() || !!(inputPicker && inputPicker.images().length);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.classList.toggle("has-questions", has);
      toggle.querySelector("span").textContent = open ? "問題を閉じる" : has ? "問題を追加済み（開く）" : "問題を追加";
    };
    inputPicker = picker(refresh);
    input.after(inputPicker.node);
    toggle.onclick = () => { box.hidden = !box.hidden; refresh(); if (!box.hidden) input.focus(); };
    input.addEventListener("input", refresh);
    el("readerClearButton")?.addEventListener("click", () => { input.value = ""; inputPicker.clear(); box.hidden = true; refresh(); });
    refresh();
  }
  const node = (tag, className, text) => { const n = document.createElement(tag); if (className) n.className = className; if (text !== undefined) n.textContent = text; return n; };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindInput, { once: true });
  else bindInput();

  // ---- The result side: the card under the analysed passage ----------------------------------
  let shownFor = "", token = 0;
  const memory = new Map(); // the last questions with their pictures, per passage, for "もう一度解く" (pictures are not kept after a reload)
  function chooser(card, passage, initial) {
    const box = node("div", "rq-add");
    const label = node("label", "reader-field-label", "問題（選択肢もいっしょに貼り付け、または画像）");
    const input = node("textarea", "modern-textarea rq-input"); input.maxLength = QUESTION_LIMIT; input.value = initial || "";
    input.placeholder = "例：\n1. What is the main idea of the passage?\n① …\n② …\n③ …\n④ …";
    label.append(input);
    const pk = picker();
    const go = node("button", "modern-btn rq-go", "解いて解説する");
    go.type = "button";
    go.onclick = () => {
      const q = { text: input.value.trim(), images: pk.images() };
      if (!hasQ(q)) { input.focus(); return; }
      run(passage, q);
    };
    box.append(label, pk.node, go);
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
    if (!saved || (!saved.text && !saved.imageCount)) {
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
      const again = node("button", "", "もう一度解く"); again.type = "button"; again.onclick = () => retry(passage, saved, card);
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
      item.append(head);
      (q.figures || []).forEach((f, fi) => {
        if (!f.image) return;
        const fig = node("figure", "rq-figure"), img = node("img"), drop = node("button", "rq-figure-drop", "図を外す");
        img.src = f.image; img.alt = f.caption || "問題の図";
        drop.type = "button";
        drop.onclick = () => {
          const now = get(passage);
          if (!now || !now.result) return;
          const target = now.result.questions.find((x) => x.number === q.number);
          if (target) target.figures = (target.figures || []).filter((_, i) => i !== fi);
          set(passage, now); render(passage);
        };
        fig.append(img);
        if (f.caption) fig.append(node("figcaption", "", f.caption));
        fig.append(drop);
        item.append(fig);
      });
      item.append(answer, node("p", "rq-explanation", q.explanation));
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
  async function run(passage, q) {
    const mine = ++token, base = { text: q.text, imageCount: q.images.length };
    memory.set(passage, q);
    set(passage, { ...base, loading: true });
    render(passage);
    const out = await solve(passage, q);
    if (mine !== token) return;
    if (out.result) await cropFigures(out.result, q.images);
    if (mine !== token) return;
    set(passage, out.result ? { ...base, result: out.result } : { ...base, error: out.error });
    if (shownFor === passage) render(passage);
  }
  // Asking again: with the pictures of this session, or (after a reload) with the typed text only; pictures have to be chosen again.
  function retry(passage, saved, card) {
    const q = memory.get(passage) || (saved.text ? { text: saved.text, images: [] } : null);
    if (q && (!saved.imageCount || q.images.length)) { run(passage, q); return; }
    card.replaceChildren(node("h2", "", "問題の解説"), node("p", "rq-hint", "画像は残していないので、もう一度選んでください。"), chooser(card, passage, saved.text));
  }
  const api = {
    // The text pasted on the input side, handed to the next analysis.
    takeInput() {
      const input = el("readerQuestionsInput");
      const q = { text: input ? input.value.trim() : "", images: inputPicker ? inputPicker.images() : [] };
      pending = hasQ(q) ? q : null;
      // Taken for this analysis: the box is emptied so the next passage does not get these questions.
      if (pending && input) { input.value = ""; inputPicker && inputPicker.clear(); const box = el("readerQuestionsBox"); if (box) box.hidden = true; input.dispatchEvent(new Event("input")); }
      return !!pending;
    },
    // Called when a passage is shown in the reader view.
    show(passage) {
      shownFor = String(passage || "");
      token++;
      const q = pending; pending = null;
      if (q) { run(shownFor, q); return; }
      const saved = get(shownFor);
      // A solve that was cut off (the page closed) is asked again (typed questions only: the pictures are gone).
      if (saved && saved.loading) {
        if (saved.text && !saved.imageCount) { run(shownFor, { text: saved.text, images: [] }); return; }
        set(shownFor, null);
      }
      render(shownFor);
    },
    // The questions waiting for the next analysis (reader.js sends them along with it, in the same request).
    pending: () => pending,
    questionBlock, imageParts,
    // The answers that came back with the analysis: kept for the passage, and no separate request is needed.
    adopt(passage, q, answers) {
      const result = normalize(answers);
      if (!result || !q || q !== pending) return false;
      pending = null;
      const key = String(passage || ""), base = { text: q.text, imageCount: q.images.length };
      set(key, { ...base, result });
      // The figures are cut out right after (the pictures are at hand now); the card shows them when they are ready.
      cropFigures(result, q.images).then(() => { set(key, { ...base, result }); if (shownFor === key) render(key); });
      return true;
    },
    ITEM: SCHEMA.properties.questions.items, RULES, normalize,
    get, solve,
  };
  window.ReaderQuestions = api;
})();
