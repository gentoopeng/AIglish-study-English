// Read-aloud for the reader: per-sentence playback, a through/shadowing/loop player for the
// whole text, and single-word pronunciation for the word detail sheet. Uses the browser's own
// speech synthesis (no API key, no network). Settings (mode, speed) are kept on the device.
(function () {
  "use strict";
  var synth = window.speechSynthesis || null;
  if (!synth) { window.ReaderSpeech = { enabled: false }; return; }

  var MODE_KEY = "aiglish_speech_mode", RATE_KEY = "aiglish_speech_rate";
  var mode = "through", rate = 1;
  try {
    var m = localStorage.getItem(MODE_KEY); if (m === "shadow" || m === "loop" || m === "through") mode = m;
    var r = parseFloat(localStorage.getItem(RATE_KEY) || "1"); if (r === 0.75 || r === 1 || r === 1.25) rate = r;
  } catch (e) {}

  var voices = [];
  function refreshVoices() { try { voices = synth.getVoices() || []; } catch (e) { voices = []; } }
  refreshVoices();
  if (typeof synth.addEventListener === "function") synth.addEventListener("voiceschanged", refreshVoices);
  else if ("onvoiceschanged" in synth) synth.onvoiceschanged = refreshVoices;

  function pickVoice(lang) {
    var want = String(lang || "en-US");
    var short = want.slice(0, 2);
    var pool = voices.filter(function (v) { return v && v.lang && v.lang.replace("_", "-").toLowerCase().indexOf(short) === 0; });
    if (!pool.length) return null;
    var exact = pool.filter(function (v) { return v.lang.replace("_", "-").toLowerCase() === want.toLowerCase(); });
    var list = exact.length ? exact : pool;
    return list.filter(function (v) { return /google/i.test(v.name); })[0] || list[0] || null;
  }

  var items = [];        // [{el, text}] for the text on screen
  var index = -1;        // sentence being read (bar player / single)
  var playing = false;   // a sequence is running
  var paused = false;
  var runId = 0;         // bumped to cancel the running sequence
  var bar = null, playBtn = null, stopBtn = null, countEl = null;

  function estimateMs(text) {
    var words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
    var ms = words / (150 * rate) * 60000;
    return Math.max(900, Math.min(15000, Math.round(ms)));
  }

  function speak(text, lang) {
    return new Promise(function (resolve) {
      var done = false;
      var finish = function () { if (!done) { done = true; resolve(); } };
      try {
        var u = new SpeechSynthesisUtterance(String(text || ""));
        u.lang = lang || "en-US";
        u.rate = rate;
        var v = pickVoice(u.lang); if (v) u.voice = v;
        u.onend = finish; u.onerror = finish;
        synth.speak(u);
        // Safety net: an utterance that never reports its end must not stall the sequence.
        setTimeout(finish, estimateMs(text) + 12000);
      } catch (e) { finish(); }
    });
  }

  async function sleep(ms, id) {
    var left = ms;
    while (left > 0) {
      if (id !== runId) return;
      var step = Math.min(90, left);
      await new Promise(function (res) { setTimeout(res, step); });
      if (!paused) left -= step;
    }
  }

  function highlight(i, on) {
    items.forEach(function (it, j) { if (it.el) it.el.classList.toggle("speech-active", !!on && j === i); });
  }

  function updateBar() {
    if (!bar) return;
    bar.style.display = items.length ? "flex" : "none";
    if (playBtn) playBtn.innerHTML = playing && !paused ? '<i data-lucide="pause" size="16"></i>' : '<i data-lucide="play" size="16"></i>';
    if (stopBtn) stopBtn.style.opacity = playing ? "1" : ".45";
    if (countEl) countEl.textContent = items.length ? ((index >= 0 ? (index + 1) + " / " : "") + items.length + "文") : "";
    bar.querySelectorAll("[data-sp-mode]").forEach(function (b) { b.classList.toggle("on", b.dataset.spMode === mode); });
    bar.querySelectorAll("[data-sp-rate]").forEach(function (b) { b.classList.toggle("on", parseFloat(b.dataset.spRate) === rate); });
    if (typeof window.initLucide === "function") window.initLucide();
  }

  async function run(fromIdx, singleIdx) {
    var id = ++runId;
    playing = true; paused = false;
    try { synth.cancel(); } catch (e) {}
    await new Promise(function (res) { setTimeout(res, 60); });
    if (id !== runId) return;
    updateBar();
    var last = singleIdx != null ? singleIdx : items.length - 1;
    for (var i = fromIdx; i <= last; i++) {
      if (id !== runId) return;
      index = i; highlight(i, true); updateBar();
      if (items[i].el) items[i].el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      var reps = singleIdx != null ? (mode === "loop" ? Infinity : 1) : (mode === "loop" ? 3 : 1);
      for (var r = 0; r < reps; r++) {
        if (id !== runId) return;
        await speak(items[i].text);
        if (id !== runId) return;
        if (r < reps - 1) await sleep(700, id);
      }
      highlight(i, false);
      if (i < last) await sleep(mode === "shadow" && singleIdx == null ? estimateMs(items[i].text) : 320, id);
    }
    if (id === runId) { playing = false; paused = false; index = -1; highlight(-1, false); updateBar(); }
  }

  function stop() {
    runId++;
    playing = false; paused = false; index = -1;
    try { synth.cancel(); } catch (e) {}
    highlight(-1, false);
    updateBar();
  }

  function togglePlay() {
    if (playing) {
      if (paused) { try { synth.resume(); } catch (e) {} paused = false; }
      else { try { synth.pause(); } catch (e) {} paused = true; }
      updateBar();
      return;
    }
    if (items.length) run(0, null);
  }

  function buildBar() {
    bar = document.createElement("div");
    bar.className = "reader-speech-bar";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "音読コントロール");
    playBtn = document.createElement("button");
    playBtn.type = "button"; playBtn.className = "sp-main"; playBtn.setAttribute("aria-label", "再生・一時停止");
    playBtn.onclick = togglePlay;
    stopBtn = document.createElement("button");
    stopBtn.type = "button"; stopBtn.className = "sp-main"; stopBtn.setAttribute("aria-label", "停止");
    stopBtn.innerHTML = '<i data-lucide="square" size="15"></i>';
    stopBtn.onclick = stop;
    var modeSeg = document.createElement("div"); modeSeg.className = "sp-seg"; modeSeg.setAttribute("aria-label", "再生モード");
    [["through", "通し"], ["shadow", "シャドー"], ["loop", "ループ"]].forEach(function (pair) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = pair[1]; b.dataset.spMode = pair[0];
      b.onclick = function () { mode = pair[0]; try { localStorage.setItem(MODE_KEY, mode); } catch (e) {} updateBar(); };
      modeSeg.appendChild(b);
    });
    var rateSeg = document.createElement("div"); rateSeg.className = "sp-seg"; rateSeg.setAttribute("aria-label", "速度");
    [0.75, 1, 1.25].forEach(function (v) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = String(v); b.dataset.spRate = String(v);
      b.onclick = function () { rate = v; try { localStorage.setItem(RATE_KEY, String(v)); } catch (e) {} updateBar(); };
      rateSeg.appendChild(b);
    });
    countEl = document.createElement("span"); countEl.className = "sp-count";
    bar.append(playBtn, stopBtn, modeSeg, rateSeg, countEl);
  }

  // Called by the reader's renderer for each sentence block.
  function decorate(block, text) {
    if (!block || !text || !String(text).trim()) return;
    block.dataset.speechText = String(text);
    var b = document.createElement("button");
    b.type = "button"; b.className = "sentence-speak-btn"; b.setAttribute("aria-label", "この文を音読");
    b.innerHTML = '<i data-lucide="volume-2" size="15"></i>';
    b.onclick = function (e) {
      e.stopPropagation();
      var idx = items.findIndex(function (it) { return it.el === block; });
      if (idx < 0) return;
      if (playing && index === idx) { stop(); return; }
      run(idx, idx);
    };
    block.appendChild(b);
  }

  // Called after a text is rendered: collect its sentences and put the player above them.
  function mount(container) {
    stop();
    items = [];
    if (!container) { updateBar(); return; }
    container.querySelectorAll(".sentence-container").forEach(function (el) {
      var t = el.dataset.speechText;
      if (t && t.trim()) items.push({ el: el, text: t });
    });
    if (!bar) buildBar();
    if (bar.parentNode !== container.parentNode) container.parentNode.insertBefore(bar, container);
    updateBar();
  }

  // One word (or short phrase) on its own: Japanese headwords are read as Japanese.
  function speakWord(text) {
    var t = String(text || "").trim();
    if (!t) return;
    stop();
    var lang = /[぀-ヿ一-鿿]/.test(t) ? "ja-JP" : "en-US";
    var id = ++runId;
    (async function () {
      try { synth.cancel(); } catch (e) {}
      await new Promise(function (res) { setTimeout(res, 60); });
      if (id !== runId) return;
      await speak(t, lang);
    })();
  }

  window.ReaderSpeech = { enabled: true, decorate: decorate, mount: mount, stop: stop, speakWord: speakWord };
})();
