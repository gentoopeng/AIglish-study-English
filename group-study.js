// Studying together in groups: who is studying right now (shown in the talk), and the words
// the members keep missing (shown under the members, playable as a quiz or a group battle).
(function (root) {
  "use strict";
  const uid = () => (typeof myId === "string" ? myId : "GUEST-000");
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };

  // ---- Missed words (this device) -------------------------------------------------------
  // A short list of recently missed words with their book reference, from flashcards rated ×
  // and battle answers that were wrong. The group shares only its top few.
  const missKey = () => "core_v4_miss_log_" + uid();
  function misses() {
    try {
      const value = JSON.parse(localStorage.getItem(missKey()) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }
  function miss(en, ja, ref) {
    en = String(en || "").trim().slice(0, 160);
    ja = String(ja || "").trim().slice(0, 240);
    if (!en || !ja || uid() === "GUEST-000") return;
    const list = misses(),
      found = list.find((item) => item.en === en && item.ja === ja),
      entry = found || { en, ja, n: 0 };
    entry.n = (entry.n || 0) + 1;
    entry.at = Date.now();
    if (ref?.book && ref.num && ref.mid && ref.sig) entry.ref = ref;
    const next = [entry, ...list.filter((item) => item !== found)].slice(0, 40);
    try {
      localStorage.setItem(missKey(), JSON.stringify(next));
    } catch {}
  }
  // The few words shared with the groups: most missed, then most recent (last 30 days).
  function top(count = 8) {
    const since = Date.now() - 30 * 86400000;
    return misses()
      .filter((item) => item.at > since)
      .sort((a, b) => b.n - a.n || b.at - a.at)
      .slice(0, count)
      .map((item) => ({ en: item.en, ja: item.ja, ...(item.ref ? { ref: item.ref } : {}) }));
  }
  // Group view: each word with how many members are missing it.
  function groupWeak(group) {
    const words = new Map();
    for (const [member, items] of Object.entries(group.weak || {})) {
      if (!group.members?.[member] || !Array.isArray(items)) continue;
      for (const item of items) {
        if (typeof item?.en !== "string" || typeof item.ja !== "string") continue;
        const key = item.en.toLowerCase() + "\n" + item.ja,
          entry = words.get(key) || { en: item.en, ja: item.ja, ref: item.ref, members: [] };
        if (!entry.members.includes(member)) entry.members.push(member);
        if (!entry.ref && item.ref) entry.ref = item.ref;
        words.set(key, entry);
      }
    }
    return [...words.values()].sort((a, b) => b.members.length - a.members.length || a.en.localeCompare(b.en));
  }

  // ---- Studying now -----------------------------------------------------------------------
  // While a flashcard round, a battle or a weak-word review runs for 15 s or more, each of the
  // member's groups gets studying.{member} = { at, kind }; it is cleared when the study ends.
  function activity() {
    if (root.WordDuel?.isPlaying?.()) return "バトル";
    if (root.WeakReview?.isPlaying?.()) return "苦手復習";
    if (document.body?.classList.contains("in-game-active")) return "単語カード";
    return "";
  }
  let since = 0,
    kind = "",
    posted = null;
  async function mark(value) {
    const groups = root.StudyGroups?.groups?.() || [];
    if (!groups.length || !root.db || typeof root.fbSetDoc !== "function") return;
    if (root.FirestoreReadGuard?.paused?.()) return;
    const account = uid();
    await Promise.all(
      groups.map((id) =>
        root
          .fbSetDoc(
            root.fbDoc(root.db, "studyGroups", id),
            { studying: { [account]: value } },
            { merge: true },
          )
          .catch(() => {}),
      ),
    );
  }
  function check() {
    if (uid() === "GUEST-000") return;
    const now = activity();
    if (now && now !== kind) {
      kind = now;
      since = Date.now();
    }
    if (!now) {
      kind = "";
      since = 0;
      if (posted) {
        posted = null;
        mark(null);
      }
      return;
    }
    if (!posted && Date.now() - since >= 15000) {
      posted = { at: since, kind };
      mark(posted);
    }
  }
  setInterval(check, 5000);
  root.addEventListener("pagehide", () => {
    if (posted) mark(null);
  });
  // Shown in the talk: other members studying now (posted within the last 90 minutes).
  function studyingBanner(group) {
    const account = uid(),
      now = Date.now(),
      people = Object.entries(group.studying || {}).filter(
        ([id, value]) =>
          id !== account &&
          group.members?.[id] &&
          value &&
          Number(value.at) > now - 90 * 60000 &&
          Number(value.at) <= now + 60000,
      );
    if (!people.length) return null;
    const bar = node("div", "group-studying");
    bar.setAttribute("role", "status");
    for (const [id, value] of people) {
      const minutes = Math.max(1, Math.round((now - value.at) / 60000));
      bar.append(
        node(
          "span",
          "",
          "📖 " + (group.members[id].name || id) + "さんが" + (value.kind || "勉強") + "中 · " + minutes + "分",
        ),
      );
    }
    return bar;
  }

  // ---- Members tab: everyone's weak words --------------------------------------------------
  function weakSection(group, host) {
    const words = groupWeak(group),
      section = node("section", "group-weak");
    section.append(node("h4", "", "みんなの苦手"));
    if (!words.length) {
      section.append(
        node("p", "people-hint", "単語カードで×にした単語やバトルで間違えた単語が、学習の保存時にここへ集まります。"),
      );
      host.append(section);
      return;
    }
    const list = node("ol", "group-weak-list");
    for (const word of words.slice(0, 12)) {
      const row = node("li");
      row.append(node("strong", "", word.en), node("span", "", word.ja), node("small", "", word.members.length + "人"));
      list.append(row);
    }
    section.append(list);
    const actions = node("div", "group-weak-actions"),
      playable = words.filter((w) => w.ref);
    const battle = node("button", "", "苦手単語でグループバトル");
    battle.type = "button";
    battle.disabled = new Set(playable.map((w) => w.ja)).size < 10;
    battle.onclick = () => startBattle(group, playable);
    actions.append(battle);
    if (battle.disabled)
      actions.append(node("p", "people-hint", "バトルには意味の違う苦手単語が10語以上必要です（いま" + new Set(playable.map((w) => w.ja)).size + "語）。"));
    section.append(actions);
    host.append(section);
  }
  function startBattle(group, words) {
    const m = root.WordDuelModel;
    root.closeLibraryDialog?.();
    root.StudyGroups?.stop?.();
    root.openWordDuel(group.id);
    const screen = document.getElementById("wordDuelScreen");
    if (!screen) return;
    const books = [...new Set(words.map((w) => w.ref.book))].slice(0, 10);
    // The lobby asks for the words when the room is made; give it this list instead of books.
    screen.__presetWords = (seed) => {
      const pool = m.selectPool(
        words
          .filter((w) => books.includes(w.ref.book))
          .map((w) => ({ word: w.en, meaning: w.ja, duelRef: w.ref })),
        seed,
      );
      if (pool.length < 10) throw Error("意味の違う苦手単語が10語以上必要です。");
      return { pool, book: pool[0].ref.book, books: [...new Set([pool[0].ref.book, ...pool.map((w) => w.ref.book)])] };
    };
    const panel = screen.querySelector('[data-config-panel="books"]');
    if (panel) {
      panel.querySelectorAll(":scope > *").forEach((el) => (el.hidden = true));
      const note = node("p", "group-weak-preset", "出題：みんなの苦手単語（" + words.length + "語）");
      panel.prepend(note);
    }
  }

  root.GroupStudy = Object.freeze({ miss, misses, top, groupWeak, studyingBanner, weakSection, check });
  // Flashcards rated × (left) go to the missed list.
  root.onAppLoaded?.(() => {
    const swipe = root.swipeFlashcard;
    if (typeof swipe !== "function" || swipe.__missLog) return;
    const wrapped = function (direction) {
      if (direction === "left")
        try {
          const item = flashcardOriginQueue[flashcardCurrentIndex];
          if (item && !item.termKey) {
            const word =
              typeof vocabList !== "undefined" && vocabList.find((w) => String(w.num) === String(item.num));
            const english = item.en,
              japanese = item.ja;
            miss(
              english,
              japanese,
              word && typeof currentTextbook === "string"
                ? {
                    book: currentTextbook,
                    num: String(item.num),
                    mid: String(item.meaningId ?? item.num + "-0"),
                    sig: root.buildWordSignature(word),
                    count: (word.meanings || []).length || 1,
                  }
                : null,
            );
          }
        } catch {}
      return swipe.apply(this, arguments);
    };
    wrapped.__missLog = true;
    Object.keys(swipe).forEach((k) => (wrapped[k] = swipe[k]));
    root.swipeFlashcard = wrapped;
  });
})(window);
