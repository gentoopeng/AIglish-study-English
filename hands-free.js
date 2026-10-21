// Hands-free flashcards: earphone / lock-screen media buttons rate the card (1 press ○,
// 2 presses ×, 3 presses △), the card is read aloud and its answer follows after a set delay.
// Keyboards and presentation clickers rate with the arrow keys. A pocket mode keeps the screen
// awake under a black, touch-proof cover. Media buttons only reach a page that is playing
// audio, so hands-free mode loops a tiny silent track while it is on.
(function () {
  "use strict";
  const key = "aiglish_handsfree_settings",
    delays = [0, 1, 2, 3, 5, 8, 10];
  let settings = { answerDelay: 3 },
    active = false,
    audio = null,
    lock = null,
    timer = null,
    lastRate = 0,
    pocket = null;

  function read() {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null") || {};
      settings = {
        answerDelay: delays.includes(saved.answerDelay) ? saved.answerDelay : 3,
      };
    } catch {}
    render();
  }
  function save() {
    try {
      localStorage.setItem(key, JSON.stringify(settings));
    } catch {}
    render();
  }
  function screenOn() {
    const screen = document.getElementById("flashcard-play-screen");
    return (
      !!screen &&
      getComputedStyle(screen).display !== "none" &&
      !!document.getElementById("activeFlashcard")
    );
  }
  function current() {
    try {
      return flashcardOriginQueue[flashcardCurrentIndex] || null;
    } catch {
      return null;
    }
  }
  function englishFirst() {
    try {
      return flashcardDirectionMode !== "ja2en";
    } catch {
      return true;
    }
  }
  // 8 kHz, 8-bit mono silence: about 16 KB for two seconds, looped.
  function silence() {
    const rate = 8000,
      length = rate * 2,
      buffer = new ArrayBuffer(44 + length),
      view = new DataView(buffer),
      text = (offset, value) => {
        for (let i = 0; i < value.length; i++)
          view.setUint8(offset + i, value.charCodeAt(i));
      };
    text(0, "RIFF");
    view.setUint32(4, 36 + length, true);
    text(8, "WAVE");
    text(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true);
    text(36, "data");
    view.setUint32(40, length, true);
    new Uint8Array(buffer, 44).fill(128);
    return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
  }
  function keepPlaying() {
    if (!active) return;
    if (audio?.paused) audio.play().catch(() => {});
    if (navigator.mediaSession) navigator.mediaSession.playbackState = "playing";
  }
  // Same path as a swipe: right ○, left ×, up △.
  function rate(direction) {
    if (!screenOn()) return false;
    const now = Date.now();
    if (now - lastRate < 600) return false;
    lastRate = now;
    clearTimeout(timer);
    window.speechSynthesis?.cancel?.();
    window.swipeFlashcard?.(direction, 0, 0);
    // A short effect sound may take over the media session; reclaim it afterwards.
    if (active) setTimeout(keepPlaying, 450);
    return true;
  }
  function flip() {
    document.getElementById("activeFlashcard")?.classList.toggle("flipped");
  }
  function metadata(word) {
    if (!navigator.mediaSession || typeof MediaMetadata !== "function") return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: (englishFirst() ? word.en : word.ja) || "単語カード",
        artist: "AIglish 単語カード",
        album: "1回 ○ ・ 2回 × ・ 3回 △",
      });
    } catch {}
  }
  // Read the visible side, wait for it to finish, then turn the card and read the answer.
  function readCard() {
    clearTimeout(timer);
    if (!active) return;
    const word = current();
    if (!word) return;
    metadata(word);
    const english = { text: word.en },
      japanese = { text: word.ja, lang: "ja-JP" },
      [first, second] = englishFirst() ? [english, japanese] : [japanese, english],
      answer = () => {
        if (!active || current() !== word || settings.answerDelay <= 0) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (!active || current() !== word) return;
          document.getElementById("activeFlashcard")?.classList.add("flipped");
          window.Pronounce?.speak(second.text, {
            lang: second.lang,
            background: true,
          });
        }, settings.answerDelay * 1000);
      };
    const spoken = window.Pronounce?.speak(first.text, {
      lang: first.lang,
      background: true,
      onend: answer,
    });
    if (!spoken) answer();
  }
  function media(on) {
    const session = navigator.mediaSession;
    if (!session) return;
    const actions = {
      play: "right",
      pause: "right",
      nexttrack: "left",
      previoustrack: "up",
    };
    for (const [action, direction] of Object.entries(actions))
      try {
        session.setActionHandler(
          action,
          on
            ? () => {
                keepPlaying();
                rate(direction);
              }
            : null,
        );
      } catch {}
    session.playbackState = on ? "playing" : "none";
    if (!on) session.metadata = null;
  }
  async function wake() {
    try {
      lock = (await navigator.wakeLock?.request("screen")) || null;
      lock?.addEventListener?.("release", () => (lock = null));
    } catch {
      lock = null;
    }
  }
  // Must be called from a tap: browsers only start audio inside a user gesture.
  function start() {
    if (active || !screenOn()) return false;
    active = true;
    if (!audio) {
      audio = new Audio(silence());
      audio.loop = true;
    }
    audio.play().catch(() => {});
    media(true);
    wake();
    render();
    readCard();
    return true;
  }
  function stop() {
    if (!active) return;
    active = false;
    clearTimeout(timer);
    audio?.pause();
    media(false);
    lock?.release?.().catch?.(() => {});
    lock = null;
    setPocket(false);
    window.speechSynthesis?.cancel?.();
    render();
  }
  // Black, touch-proof cover; a 2-second hold removes it.
  function setPocket(on) {
    if (on && active && !pocket) {
      pocket = document.createElement("div");
      pocket.className = "handsfree-pocket";
      pocket.setAttribute("role", "dialog");
      pocket.setAttribute("aria-label", "ポケットモード");
      pocket.innerHTML =
        '<p>ポケットモード<small>イヤホンのボタンで操作できます<br>1回 ○ ・ 2回 × ・ 3回 △</small></p><p class="handsfree-pocket-exit">画面を2秒長押しで解除</p>';
      let hold = null;
      const cancel = () => {
        clearTimeout(hold);
        hold = null;
        pocket?.classList.remove("is-holding");
      };
      pocket.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        pocket.classList.add("is-holding");
        hold = setTimeout(() => setPocket(false), 2000);
      });
      for (const type of ["pointerup", "pointercancel", "pointerleave"])
        pocket.addEventListener(type, cancel);
      pocket.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopPropagation();
        },
        true,
      );
      document.body.append(pocket);
    } else if (!on && pocket) {
      pocket.remove();
      pocket = null;
    }
    render();
  }
  function render() {
    const button = document.getElementById("flashcardHandsFreeButton"),
      bar = document.getElementById("handsFreeBar"),
      select = document.getElementById("handsFreeAnswerDelay");
    if (button) {
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("is-active", active);
    }
    if (bar) bar.hidden = !active;
    if (select) select.value = String(settings.answerDelay);
  }

  document.getElementById("handsFreeAnswerDelay")?.addEventListener("change", (event) => {
    const value = Number(event.target.value);
    settings.answerDelay = delays.includes(value) ? value : 3;
    save();
  });
  document.getElementById("flashcardHandsFreeButton")?.addEventListener("click", () =>
    active ? stop() : start(),
  );
  document.getElementById("handsFreeStop")?.addEventListener("click", stop);
  document.getElementById("handsFreePocket")?.addEventListener("click", () =>
    setPocket(true),
  );
  // Keyboards and presentation clickers: → / PageDown ○, ← / PageUp ×, ↑ △, Space / Enter turns.
  document.addEventListener("keydown", (event) => {
    if (!screenOn() || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey)
      return;
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("input,textarea,select,[contenteditable=true]")
    )
      return;
    if (document.querySelector("dialog[open]")) return;
    const direction = {
      ArrowRight: "right",
      PageDown: "right",
      ArrowLeft: "left",
      PageUp: "left",
      ArrowUp: "up",
    }[event.key];
    if (direction) {
      event.preventDefault();
      rate(direction);
    } else if (event.key === " " || event.key === "Enter") {
      if (target instanceof Element && target.closest("button,a")) return;
      event.preventDefault();
      flip();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (active && !document.hidden && !lock) wake();
  });

  window.HandsFree = Object.freeze({
    active: () => active,
    start,
    stop,
    pocket: setPocket,
  });
  read();
  window.onAppLoaded?.(() => {
    read();
    // Each new card is read; leaving the card screen ends hands-free mode.
    const render = window.renderFlashcardDeck;
    if (typeof render === "function" && !render.__handsFree) {
      const wrapped = function () {
        const result = render.apply(this, arguments);
        if (active) screenOn() ? readCard() : stop();
        return result;
      };
      wrapped.__handsFree = true;
      window.renderFlashcardDeck = wrapped;
    }
    const finish = window.finishFlashcardSession;
    if (typeof finish === "function" && !finish.__handsFree) {
      const wrapped = function () {
        stop();
        return finish.apply(this, arguments);
      };
      wrapped.__handsFree = true;
      window.finishFlashcardSession = wrapped;
    }
  });
})();
