// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/copy-follow.smoke.cjs
// A personal copy follows its original word by word and keeps the player's own changes:
//  - a copy of a distributed book (made before this, so it has no base and is up to date) gets a base
//    from the original and keeps its player's edit; a later change of the original replaces the
//    words the player did not touch, adds new words and drops removed ones;
//  - a copy made from the public catalogue ("自分用に追加") does the same through its own numbering.
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
    await page.waitForFunction(() => window.__learningBootReady === true && window.CopyFollow && window.__followPublicCopies);
    const words = (id) => page.evaluate((b) => window.VocabMaster.resolve(b).master.map((w) => w.num + ":" + w.word + "=" + w.meaning).join(" | "), id);

    // ---- A copy of a distributed book -------------------------------------------------------
    await page.evaluate(async () => {
      myId = "follower";
      const own = [{ num: 1, word: "a", meaning: "あ" }, { num: 2, word: "b", meaning: "自分の意味" }, { num: 3, word: "c", meaning: "し" }];
      localStorage.setItem("core_v4_personal_library_follower", JSON.stringify({ books: [{ id: "personal_a", name: "配信（自分用）", cover: "📔", coverType: "text", personal: true, visibility: "private", copiedFrom: "shared-1", sourceSyncedAt: "2026-10-27T03:00:00.000Z" }], hidden: [], visibility: {}, savedAt: "2026-10-27T03:00:00.000Z" }));
      localStorage.setItem("core_v4_cache_personal_a", JSON.stringify(own));
      localStorage.setItem("core_v4_custom_words_follower_personal_a", JSON.stringify(own));
      window.__docs = new Map([
        ["shared/textbooks_index", { textbooks: [{ id: "shared-1", name: "配信", updatedAt: "2026-10-27T03:00:00.000Z" }] }],
        ["shared/vocab_shared-1", { custom_words: [{ num: 1, word: "a", meaning: "あ" }, { num: 2, word: "b", meaning: "び" }, { num: 3, word: "c", meaning: "し" }] }],
      ]);
      window.__reads = [];
      window.db = {};
      window.fbDoc = (_, ...parts) => ({ path: parts.join("/") });
      window.fbGetDoc = async (ref) => (__reads.push(ref.path), { exists: () => __docs.has(ref.path), data: () => structuredClone(__docs.get(ref.path) || {}) });
      window.fbSetDoc = async (ref, data, o) => __docs.set(ref.path, o?.merge ? { ...(__docs.get(ref.path) || {}), ...data } : data);
      window.fbRunTransaction = async (_, fn) => fn({ get: window.fbGetDoc, set: () => {} });
      const wait = async (check) => { for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 50)); };
      window.__waitFor = wait;
      await window.syncTextbooksIndexFromFirestore();
      await wait(() => localStorage.getItem("aiglish_copy_base_follower_personal_a"));
    });
    // Up to date and no base yet: the base is made from the original, the copy is left as it is.
    assert.equal(await words("personal_a"), "1:a=あ | 2:b=自分の意味 | 3:c=し");
    assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem("aiglish_copy_base_follower_personal_a")).fp[2]));
    // The original changes word 1 and 2, drops 3 and adds 4.
    await page.evaluate(async () => {
      __docs.set("shared/vocab_shared-1", { custom_words: [{ num: 1, word: "a", meaning: "あ２" }, { num: 2, word: "b", meaning: "び２" }, { num: 4, word: "d", meaning: "で" }] });
      __docs.get("shared/textbooks_index").textbooks[0].updatedAt = "2026-11-02T03:00:00.000Z";
      await window.syncTextbooksIndexFromFirestore();
      await window.__waitFor(() => JSON.parse(localStorage.getItem("core_v4_cache_personal_a")).some((w) => w.num === 4));
    });
    // 1: replaced; 2: the player's own stays; 3: dropped (the player had not changed it); 4: added.
    assert.equal(await words("personal_a"), "1:a=あ２ | 2:b=自分の意味 | 4:d=で");

    // A copy made on another device (it has the followBase mark) whose base did not reach this one, and
    // whose original has moved on: nothing is replaced (the player's words are kept), the base starts afresh.
    await page.evaluate(async () => {
      const lib = JSON.parse(localStorage.getItem("core_v4_personal_library_follower"));
      lib.books.push({ id: "personal_b", name: "別の端末のコピー", cover: "📔", coverType: "text", personal: true, visibility: "private", copiedFrom: "shared-2", followBase: 1, sourceSyncedAt: "2026-10-01T00:00:00.000Z" });
      localStorage.setItem("core_v4_personal_library_follower", JSON.stringify(lib));
      const mineB = [{ num: 1, word: "x", meaning: "自分で直した" }, { num: 2, word: "y", meaning: "わい" }];
      localStorage.setItem("core_v4_cache_personal_b", JSON.stringify(mineB));
      localStorage.setItem("core_v4_custom_words_follower_personal_b", JSON.stringify(mineB));
      __docs.get("shared/textbooks_index").textbooks.push({ id: "shared-2", name: "別の配信", updatedAt: "2026-11-02T03:00:00.000Z" });
      __docs.set("shared/vocab_shared-2", { custom_words: [{ num: 1, word: "x", meaning: "原本の意味" }, { num: 2, word: "y", meaning: "わい" }, { num: 3, word: "z", meaning: "ぜっと" }] });
      await window.syncTextbooksIndexFromFirestore();
      await window.__waitFor(() => localStorage.getItem("aiglish_copy_base_follower_personal_b"));
    });
    assert.equal(await words("personal_b"), "1:x=自分で直した | 2:y=わい");
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("core_v4_personal_library_follower")).books.find((b) => b.id === "personal_b").sourceSyncedAt), "2026-11-02T03:00:00.000Z");
    // Next change of that original: its word 3 is new, but the player's own word 3 is there first.
    await page.evaluate(async () => {
      const own = JSON.parse(localStorage.getItem("core_v4_custom_words_follower_personal_b"));
      own.push({ num: 3, word: "mine", meaning: "自分で足した" });
      localStorage.setItem("core_v4_custom_words_follower_personal_b", JSON.stringify(own));
      localStorage.setItem("core_v4_cache_personal_b", JSON.stringify(own));
      delete window.__manualVocabDrafts.personal_b;
      localStorage.removeItem(window.__manualVocabLocalKey("personal_b"));
      __docs.set("shared/vocab_shared-2", { custom_words: [{ num: 1, word: "x", meaning: "原本の意味" }, { num: 2, word: "y", meaning: "わい" }, { num: 3, word: "z", meaning: "ぜっと" }, { num: 4, word: "w", meaning: "だぶりゅ" }] });
      __docs.get("shared/textbooks_index").textbooks.find((b) => b.id === "shared-2").updatedAt = "2026-11-03T03:00:00.000Z";
      await window.syncTextbooksIndexFromFirestore();
      await window.__waitFor(() => JSON.parse(localStorage.getItem("core_v4_cache_personal_b")).some((w) => w.word === "w"));
    });
    // The original's word 3 (z, already new at the start: part of the base) stays out; word 4 comes in.
    assert.equal(await words("personal_b"), "1:x=自分で直した | 2:y=わい | 3:mine=自分で足した | 4:w=だぶりゅ");

    // ---- A copy made from the public catalogue ---------------------------------------------------
    await page.evaluate(() => {
      myId = "public-follower";
      window.__pub = { ownerId: "other-user", name: "みんなの単語帳", updatedAt: "2026-11-01T00:00:00.000Z", masterJson: JSON.stringify([{ num: 10, word: "a", meaning: "あ" }, { num: 20, word: "b", meaning: "び" }, { num: 30, word: "c", meaning: "し" }]) };
      window.__reads = [];
      window.fbDoc = (...args) => args;
      window.fbCollection = (...args) => args;
      window.fbGetDoc = async (ref) => (__reads.push(ref.join("/")), { exists: () => ref[1] === "publicTextbooks" && ref.at(-1) === "pub-1", data: () => structuredClone(__pub) });
      window.fbGetDocs = async (ref) => (ref[1] !== "publicTextbooks" ? { forEach: () => {} } : { forEach: (cb) => cb({ id: "pub-1", data: () => structuredClone(__pub) }) });
      window.showVocabLibrarySelection();
    });
    await page.getByRole("button", { name: "みんなの単語帳", exact: true }).click();
    await page.getByRole("button", { name: "自分用に追加" }).click();
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    const id = await page.evaluate(() => JSON.parse(localStorage.getItem("core_v4_personal_library_public-follower")).books.find((b) => b.copiedFromPublic === "pub-1").id);
    // The copy numbers the words 1, 2, 3 (the original's are 10, 20, 30) and knows where each came from.
    assert.equal(await words(id), "1:a=あ | 2:b=び | 3:c=し");
    assert.deepEqual(await page.evaluate((b) => JSON.parse(localStorage.getItem("aiglish_copy_base_public-follower_" + b)).map, id), { 10: "1", 20: "2", 30: "3" });
    // The player changes word 2 of the copy.
    await page.evaluate((b) => {
      const draft = structuredClone(window.__manualVocabDrafts[b]);
      draft.master[1].meaning = "自分";
      draft.master[1].meanings[0].text = "自分";
      draft.savedAt = new Date(Date.now() + 5000).toISOString();
      localStorage.setItem(window.__manualVocabLocalKey(b), JSON.stringify(draft));
      window.__manualVocabDrafts[b] = draft;
    }, id);
    // The owner changes 10 and 20, drops 30 and adds 40.
    await page.evaluate(async (b) => {
      window.__pub = { ...__pub, updatedAt: "2026-11-03T00:00:00.000Z", masterJson: JSON.stringify([{ num: 10, word: "a", meaning: "あ２" }, { num: 20, word: "b", meaning: "び２" }, { num: 40, word: "d", meaning: "で" }]) };
      __reads = [];
      localStorage.removeItem("aiglish_copy_checked_public-follower_" + b);
      await window.__followPublicCopies();
    }, id);
    assert.equal(await words(id), "1:a=あ２ | 2:b=自分 | 4:d=で");
    assert.equal(await page.evaluate(() => __reads.filter((r) => r.includes("publicTextbooks")).length), 1);
    // Looked at again within a few hours: no read at all.
    await page.evaluate(async () => { __reads = []; await window.__followPublicCopies(); });
    assert.equal(await page.evaluate(() => __reads.length), 0);
    assert.deepEqual(errors, []);
    console.log("PASS: a copy of a distributed book and a copy of a public book follow their originals word by word, keep the player's own words, add and drop the rest, and check at most once every few hours");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
