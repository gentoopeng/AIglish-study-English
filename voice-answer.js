// 声で答える: in hands-free flashcards, after the card is read the app listens, and the spoken
// answer rates the card (○ when it matches the meaning, × otherwise). Speech recognition is the
// browser's (Web Speech API); where it is missing, hands-free mode works as before.
(function (root) {
  "use strict";
  // Compared after normalize(), so katakana has become hiragana.
  const PASS = /^(わからない|わかんない|分からない|ぱす|すきっぷ|知らない|しらない)$/;
  function hiragana(text) {
    return text.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  }
  function normalize(text) {
    return hiragana(String(text || "").normalize("NFKC").toLowerCase())
      .replace(/[\s　、。，．,.!?！？「」『』()（）\[\]［］〜~・:：;；"'’…-]/g, "");
  }
  // The accepted answers for a meaning like "①〜に従う②〜に続く(名詞)": each part, without the
  // 〜 placeholder and the particle right after it, and without notes in brackets.
  function answers(meaning) {
    const parts = String(meaning || "")
      .replace(/[(（][^)）]*[)）]/g, "")
      .split(/[①-⑳]|[、,，;；/／・]|\(\d+\)/)
      .map((part) => part.trim())
      .filter(Boolean);
    const list = new Set();
    for (const part of parts.length ? parts : [String(meaning || "")]) {
      const plain = normalize(part);
      if (plain) list.add(plain);
      const bare = normalize(part.replace(/^[〜~]\s*(に|を|が|で|と|へ|から|より|の)?/, ""));
      if (bare) list.add(bare);
    }
    return [...list];
  }
  function bigrams(text) {
    const out = [];
    for (let i = 0; i < text.length - 1; i++) out.push(text.slice(i, i + 2));
    return out;
  }
  function similar(a, b) {
    if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
    const x = bigrams(a),
      y = bigrams(b),
      pool = [...y];
    let hits = 0;
    for (const g of x) {
      const at = pool.indexOf(g);
      if (at >= 0) {
        hits++;
        pool.splice(at, 1);
      }
    }
    return (2 * hits) / (x.length + y.length);
  }
  // heard: the recognizer's alternatives. Returns "ok", "bad", or "pass" (said "わからない").
  function judge(heard, meaning, english = false) {
    const alternatives = (Array.isArray(heard) ? heard : [heard])
      .map((text) => String(text || "").trim())
      .filter(Boolean);
    if (!alternatives.length) return "bad";
    if (alternatives.some((text) => PASS.test(normalize(text)))) return "pass";
    const targets = english
      ? [normalize(meaning).replace(/^(to|a|an|the)(?=[a-z])/, ""), normalize(meaning)]
      : answers(meaning);
    for (const text of alternatives) {
      let said = normalize(text);
      if (english) said = said.replace(/^(to|a|an|the)(?=[a-z]{3})/, "");
      for (const target of targets) {
        if (!said || !target) continue;
        if (said === target) return "ok";
        if (!english && target.length >= 2 && said.includes(target)) return "ok";
        if (!english && said.length >= 2 && target.includes(said) && said.length >= target.length * 0.6)
          return "ok";
        // A verb or adjective said in another form: 従う → 従います, 静かな → 静かです.
        if (!english && /[\u3400-\u9fff]/.test(target) && /[\u3041-\u3096]$/.test(target)) {
          const stem = target.replace(/[\u3041-\u3096]+$/, "");
          const rest = said.slice(stem.length);
          if (stem && said.startsWith(stem) && rest.length <= 4 && /^[\u3041-\u3096]*$/.test(rest)) return "ok";
        }
        if (similar(said, target) >= (english ? 0.85 : 0.67)) return "ok";
      }
    }
    return "bad";
  }
  const model = { judge, answers, normalize };
  root.VoiceAnswerModel = model;
  if (typeof module !== "undefined") module.exports = model;
  if (!root.document) return;

  const Recognition = root.SpeechRecognition || root.webkitSpeechRecognition,
    key = "aiglish_voice_answer";
  let enabled = false,
    blocked = "",
    running = null;
  try {
    enabled = localStorage.getItem(key) === "1";
  } catch {}
  const supported = () => typeof (root.SpeechRecognition || root.webkitSpeechRecognition) === "function";
  function set(on) {
    enabled = !!on;
    try {
      localStorage.setItem(key, enabled ? "1" : "0");
    } catch {}
    if (!enabled) cancel();
    render();
  }
  function cancel() {
    const job = running;
    running = null;
    try {
      job?.recognition.abort();
    } catch {}
    job?.done(null);
  }
  // Listen once for up to `seconds`. Resolves with the alternatives heard, or null.
  function listen(lang, seconds = 6) {
    cancel();
    const Ctor = root.SpeechRecognition || root.webkitSpeechRecognition;
    if (!enabled || !Ctor) return Promise.resolve(null);
    return new Promise((resolve) => {
      let finished = false;
      const recognition = new Ctor(),
        job = {
          recognition,
          done(value) {
            if (finished) return;
            finished = true;
            clearTimeout(job.timer);
            if (running === job) running = null;
            render();
            resolve(value);
          },
        };
      running = job;
      recognition.lang = lang;
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.maxAlternatives = 5;
      recognition.onresult = (event) => {
        const result = event.results?.[0];
        const heard = result ? [...result].map((alt) => alt.transcript) : [];
        job.done(heard.length ? heard : null);
      };
      recognition.onerror = (event) => {
        if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
          blocked = "マイクの使用が許可されていません。端末の設定で許可してください。";
          enabled = false;
        }
        job.done(null);
      };
      recognition.onend = () => job.done(null);
      job.timer = setTimeout(() => {
        try {
          recognition.stop();
        } catch {}
        setTimeout(() => job.done(null), 800);
      }, seconds * 1000);
      try {
        recognition.start();
        render();
      } catch {
        job.done(null);
      }
    });
  }
  function render() {
    const toggle = document.getElementById("handsFreeVoice");
    if (!toggle) return;
    toggle.hidden = false;
    if (!supported()) {
      toggle.textContent = "🎤 非対応";
      toggle.setAttribute("aria-pressed", "false");
      toggle.classList.remove("is-on", "is-listening");
      return;
    }
    toggle.setAttribute("aria-pressed", String(enabled));
    toggle.classList.toggle("is-on", enabled);
    toggle.classList.toggle("is-listening", !!running);
    toggle.textContent = running ? "🎤 聞いています" : enabled ? "🎤 声で答える" : "🎤 オフ";
    if (blocked) {
      root.showToast?.(blocked, "err");
      blocked = "";
    }
  }
  // What was heard, shown in the hands-free bar for a moment.
  let hideTimer = 0;
  function show(text, verdict) {
    const bar = document.getElementById("handsFreeHeard");
    if (!bar) return;
    clearTimeout(hideTimer);
    // Stays a moment into the next card, so the result can be read.
    if (text) hideTimer = setTimeout(() => show(""), 2500);
    bar.hidden = !text;
    bar.textContent = text ? "「" + text + "」 " + (verdict === "ok" ? "○" : "×") : "";
    bar.dataset.verdict = verdict || "";
  }
  document.getElementById("handsFreeVoice")?.addEventListener("click", () => {
    if (!supported())
      return root.showToast?.(
        "この画面では音声認識が使えません。ホーム画面のアプリで使えない場合は、Safariで開くと使えることがあります。",
        "info",
      );
    set(!enabled);
  });
  root.VoiceAnswer = Object.freeze({
    supported,
    on: () => enabled && supported(),
    set,
    listen,
    cancel,
    show,
    judge,
  });
  render();
})(typeof window === "undefined" ? globalThis : window);
