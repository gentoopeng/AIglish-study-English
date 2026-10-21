// English pronunciation with the browser's built-in speech (Web Speech API): free, no server,
// and only short utterances, so it adds no load to studying. Every speaker button is a
// `.pronounce-button[data-say]`, handled by one delegated listener.
(function () {
  "use strict";
  const key = "aiglish_pronounce_settings",
    synth = window.speechSynthesis,
    supported = !!synth && typeof window.SpeechSynthesisUtterance === "function",
    root = document.documentElement;
  let settings = { enabled: true, auto: false, rate: 0.9, accent: "en-US" },
    voice = null;

  function read() {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null") || {};
      settings = {
        enabled: saved.enabled !== false,
        auto: saved.auto === true,
        rate: Number.isFinite(saved.rate)
          ? Math.max(0.6, Math.min(1.2, saved.rate))
          : 0.9,
        accent: saved.accent === "en-GB" ? "en-GB" : "en-US",
      };
    } catch {}
    voice = null;
    render();
  }
  function save() {
    try {
      localStorage.setItem(key, JSON.stringify(settings));
    } catch {}
    voice = null;
    render();
  }
  // Prefer a voice for the chosen accent that ships with the device; fall back to any English one.
  function pick() {
    if (voice) return voice;
    const voices = synth.getVoices() || [],
      lang = (v) => String(v.lang || "").replace("_", "-").toLowerCase(),
      wanted = settings.accent.toLowerCase(),
      exact = voices.filter((v) => lang(v) === wanted),
      english = voices.filter((v) => lang(v).startsWith("en"));
    voice =
      exact.find((v) => v.localService) ||
      exact[0] ||
      english.find((v) => v.localService) ||
      english[0] ||
      null;
    return voice;
  }
  function speak(text) {
    text = String(text || "").trim().slice(0, 200);
    if (!supported || !settings.enabled || !text || document.hidden) return false;
    try {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = settings.accent;
      utterance.rate = settings.rate;
      const chosen = pick();
      if (chosen) utterance.voice = chosen;
      synth.speak(utterance);
      return true;
    } catch {
      return false;
    }
  }
  // Automatic reading is opt-in; browsers may still require one tap first (iOS).
  function auto(text) {
    return settings.auto ? speak(text) : false;
  }
  function render() {
    root.classList.toggle("pronounce-off", !supported || !settings.enabled);
    const enabled = document.getElementById("pronounceEnabled"),
      autoplay = document.getElementById("pronounceAuto"),
      rate = document.getElementById("pronounceRate"),
      accent = document.getElementById("pronounceAccent"),
      note = document.getElementById("pronounceStatus");
    if (enabled) {
      enabled.checked = supported && settings.enabled;
      enabled.disabled = !supported;
    }
    if (autoplay) {
      autoplay.checked = settings.auto;
      autoplay.disabled = !supported || !settings.enabled;
    }
    if (rate) {
      rate.value = String(settings.rate);
      rate.disabled = !supported || !settings.enabled;
    }
    const rateLabel = document.getElementById("pronounceRateValue");
    if (rateLabel) rateLabel.textContent = settings.rate.toFixed(1) + "倍";
    if (accent) {
      accent.value = settings.accent;
      accent.disabled = !supported || !settings.enabled;
    }
    if (note) note.hidden = supported;
  }
  document.getElementById("pronounceEnabled")?.addEventListener("change", (event) => {
    settings.enabled = event.target.checked;
    save();
  });
  document.getElementById("pronounceAuto")?.addEventListener("change", (event) => {
    settings.auto = event.target.checked;
    save();
  });
  document.getElementById("pronounceRate")?.addEventListener("input", (event) => {
    settings.rate = Number(event.target.value);
    const label = document.getElementById("pronounceRateValue");
    if (label) label.textContent = settings.rate.toFixed(1) + "倍";
  });
  document.getElementById("pronounceRate")?.addEventListener("change", (event) => {
    const rate = Number(event.target.value);
    if (Number.isFinite(rate)) settings.rate = Math.max(0.6, Math.min(1.2, rate));
    save();
  });
  document.getElementById("pronounceAccent")?.addEventListener("change", (event) => {
    settings.accent = event.target.value === "en-GB" ? "en-GB" : "en-US";
    save();
  });
  document.getElementById("pronounceTest")?.addEventListener("click", () =>
    speak("Hello! Let's study English together."),
  );
  // One listener for every speaker button. Buttons on rows or cards stop the event there, so
  // a tap never also opens, flips or rates what it sits on.
  document.addEventListener(
    "click",
    (event) => {
      const button =
        event.target instanceof Element
          ? event.target.closest(".pronounce-button[data-say]")
          : null;
      if (!button || button.disabled) return;
      event.preventDefault();
      event.stopPropagation();
      speak(button.dataset.say);
    },
    true,
  );
  if (supported) {
    synth.addEventListener?.("voiceschanged", () => (voice = null));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) synth.cancel();
    });
    window.addEventListener("pagehide", () => synth.cancel());
  }
  window.addEventListener("storage", (event) => {
    if (event.key === key) read();
  });

  // The flashcard speaker sits beside the card (not on it), so card taps and swipes are untouched.
  function currentCard() {
    try {
      return typeof flashcardOriginQueue !== "undefined"
        ? flashcardOriginQueue[flashcardCurrentIndex]
        : null;
    } catch {
      return null;
    }
  }
  let watcher = null;
  function hookFlashcards() {
    const original = window.renderFlashcardDeck;
    if (typeof original !== "function" || original.__pronounce) return;
    const wrapped = function () {
      const result = original.apply(this, arguments),
        word = currentCard(),
        button = document.getElementById("flashcardSpeakButton"),
        card = document.getElementById("activeFlashcard");
      if (button) {
        button.dataset.say = word?.en || "";
        button.disabled = !word?.en;
      }
      watcher?.disconnect();
      watcher = null;
      if (!word?.en || !card) return result;
      const englishFirst =
        typeof flashcardDirectionMode === "undefined" ||
        flashcardDirectionMode === "en2ja";
      if (englishFirst) auto(word.en);
      else if (settings.auto && window.MutationObserver) {
        // Japanese first: read the English when the card is turned over.
        watcher = new MutationObserver(() => {
          if (card.classList.contains("flipped")) {
            watcher?.disconnect();
            watcher = null;
            auto(word.en);
          }
        });
        watcher.observe(card, { attributes: true, attributeFilter: ["class"] });
      }
      return result;
    };
    wrapped.__pronounce = true;
    window.renderFlashcardDeck = wrapped;
  }

  window.Pronounce = Object.freeze({
    supported,
    speak,
    auto,
    enabled: () => supported && settings.enabled,
  });
  read();
  window.onAppLoaded?.(() => {
    read();
    hookFlashcards();
  });
})();
