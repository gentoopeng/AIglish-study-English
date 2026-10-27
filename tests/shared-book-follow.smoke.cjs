// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/shared-book-follow.smoke.cjs
// A user's copy of a distributed word book follows the admin's changes: when the book's entry
// in the shared index is newer, the copy takes its words and its 用語・年号モード, keeping the
// user's ratings; an unchanged book costs no extra reads; copies made before copiedFrom are
// matched by name once.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
    });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    const result = await page.evaluate(async () => {
      myId = "follower";
      const old = [{ num: 1, word: "1600 関ヶ原", meaning: "戦い" }, { num: 2, word: "apple", meaning: "りんご" }];
      // An old copy (no copiedFrom) with a rating on word 1.
      localStorage.setItem("core_v4_personal_library_follower", JSON.stringify({ books: [{ id: "personal_old", name: "配信単語（自分用）", cover: "📔", coverType: "text", personal: true, visibility: "private" }], hidden: ["shared-1"], savedAt: "2026-01-01T00:00:00.000Z" }));
      localStorage.setItem("core_v4_cache_personal_old", JSON.stringify(old));
      localStorage.setItem("core_v4_custom_words_follower_personal_old", JSON.stringify(old));
      window.__docs = new Map([
        ["shared/textbooks_index", { textbooks: [{ id: "shared-1", name: "配信単語", termMode: true, updatedAt: "2026-10-27T03:00:00.000Z" }, { id: "shared-2", name: "別の配信" }] }],
        ["shared/vocab_shared-1", { custom_words: [{ num: 1, word: "1600 「関ヶ原の戦い」", meaning: "徳川家康が勝つ", unit: "江戸" }, { num: 2, word: "apples", meaning: "りんご" }] }],
      ]);
      window.__reads = [];
      window.db = {};
      window.fbDoc = (_, ...parts) => ({ path: parts.join("/") });
      window.fbGetDoc = async (ref) => (__reads.push(ref.path), { exists: () => __docs.has(ref.path), data: () => structuredClone(__docs.get(ref.path) || {}) });
      window.fbSetDoc = async (ref, data, o) => __docs.set(ref.path, o?.merge ? { ...(__docs.get(ref.path) || {}), ...data } : data);
      window.fbRunTransaction = async (_, fn) => {
        const writes = [];
        const r = await fn({ get: window.fbGetDoc, set: (ref, data, o) => writes.push([ref.path, JSON.parse(JSON.stringify(data)), o?.merge]) });
        for (const [path, data, merge] of writes) __docs.set(path, merge ? { ...(__docs.get(path) || {}), ...data } : data);
        return r;
      };
      const wait = async (check) => { for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 50)); };
      const copy = () => JSON.parse(localStorage.getItem("core_v4_personal_library_follower")).books.find((b) => b.id === "personal_old");
      await window.syncTextbooksIndexFromFirestore();
      await wait(() => copy().sourceSyncedAt);
      const first = { copy: copy(), units: JSON.parse(localStorage.getItem("core_v4_cache_personal_old")).map((w) => w.unit || ""), words: JSON.parse(localStorage.getItem("core_v4_cache_personal_old")).map((w) => w.word), mode: window.TermQuestions?.enabled ? null : null, reads: __reads.slice() };
      // Nothing new: no read of the book's words.
      __reads = [];
      await window.syncTextbooksIndexFromFirestore();
      await new Promise((r) => setTimeout(r, 300));
      const second = __reads.slice();
      // The admin changes the distributed book (as the editing mode's save does) and turns the mode off.
      __docs.get("shared/vocab_shared-1").custom_words[1].word = "apple pie";
      __docs.get("shared/textbooks_index").textbooks[0].termMode = false;
      await window.__touchSharedBook("shared-1");
      await window.syncTextbooksIndexFromFirestore();
      await wait(() => JSON.parse(localStorage.getItem("core_v4_cache_personal_old"))[1].word === "apple pie");
      const third = { copy: copy(), words: JSON.parse(localStorage.getItem("core_v4_cache_personal_old")).map((w) => w.word), pool: textbooksPool.find((b) => b.id === "personal_old") };
      // Ratings stay with the word while its number and headword are the same, even when the
      // admin changed its meanings; a different word in that number starts afresh.
      const word = { num: 1, word: "1600 「関ヶ原の戦い」", meaning: "", meanings: [{ id: "1-0", text: "徳川家康が勝つ（東軍）" }] };
      const oldSig = window.buildWordSignature({ num: 1, word: "1600 「関ヶ原の戦い」", meanings: [{ text: "徳川家康が勝つ" }] });
      currentUserVocabProgress = { 1: { sig: oldSig, status: "ok", note: "メモ", sticky: true, meanings: { "1-0": { status: "ok", history: ["ok"] } } } };
      vocabList = [structuredClone(word)];
      window.applyUserProgressToVocabList();
      const kept = [vocabList[0].meanings[0].status, vocabList[0].note, vocabList[0].sticky];
      vocabList = [{ ...structuredClone(word), word: "1615 大坂夏の陣" }];
      window.applyUserProgressToVocabList();
      const fresh = [vocabList[0].meanings[0].status, vocabList[0].note];
      return { first, second, third, kept, fresh };
    });
    assert.equal(result.first.copy.copiedFrom, "shared-1");
    assert.equal(result.first.copy.termMode, true);
    assert.deepEqual(result.first.words, ["1600 「関ヶ原の戦い」", "apples"]);
    // Units are part of the words, so a unit set on the distributed book reaches the copy too.
    assert.deepEqual(result.first.units, ["江戸", ""]);
    assert.ok(result.first.reads.includes("shared/vocab_shared-1"));
    assert.deepEqual(result.second.filter((p) => p.startsWith("shared/vocab_")), []);
    assert.deepEqual(result.third.words, ["1600 「関ヶ原の戦い」", "apple pie"]);
    assert.equal(result.third.copy.termMode, undefined);
    assert.equal(!!result.third.pool?.termMode, false);
    assert.deepEqual(result.kept, ["ok", "メモ", true]);
    assert.deepEqual(result.fresh, ["none", "メモ"]);
    assert.deepEqual(errors, []);
    console.log("PASS: an old copy is matched by name, takes the distributed book's words and 用語・年号モード; no extra read when unchanged; a later admin change and mode off reach it; ratings stay when only meanings changed");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
