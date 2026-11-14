// Shared explanations: a solved set is written once to readerExplanations (no figures, no pictures), another person who types the same
// questions gets it without the AI (marked as theirs, re-solvable), "みんなの解説を見る" reads only when pressed (and is kept 6 hours),
// bad data is not shown, sharing can be switched off, and the maker can take a set back.
const { chromium } = require("playwright"), assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }), errors = [], prompts = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let solves = 0;
    const answers = [{ number: "1", question: "What does Tom like?", answer: "②", explanation: "本文の1文目に書かれています。", evidence: "Tom likes tea.", evidenceTranslation: "トムは紅茶が好きだ。", figures: [{ image: 1, box: [100, 100, 500, 600], caption: "表1" }], choices: [{ label: "①", correct: false, reason: "coffee は出てきません。" }, { label: "②", correct: true, reason: "tea と一致します。" }] }];
    await page.route("https://**/*", (r) => r.abort());
    await page.route("https://generativelanguage.googleapis.com/**", (r) => {
      const url = r.request().url(), body = JSON.parse(r.request().postData() || "{}"), prompt = body.contents[0].parts[0].text;
      prompts.push(prompt);
      if (/streamGenerateContent/.test(url)) {
        const analysis = { fullSummaryAbstract: "要約", sentences: [{ text: "Tom likes tea.", translation: "トムは紅茶が好きだ。", grammarHighlights: [], vocab: [] }] };
        if (/questionAnswers/.test(prompt)) analysis.questionAnswers = answers;
        return r.fulfill({ status: 200, contentType: "text/event-stream", body: "data: " + JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(analysis) }] } }] }) + "\r\n\r\n" });
      }
      solves++;
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ questions: answers }) }] } }] }) });
    });
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
      localStorage.setItem("core_v4_geminiKey", "test-key");
    });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true && window.ReaderQuestions && window.ReaderShared);
    // An in-memory Firestore for readerExplanations.
    await page.evaluate(() => {
      window.__docs = new Map(); window.__reads = 0; window.__writes = 0;
      window.db = {};
      window.fbDoc = (_, ...p) => ({ path: p.join("/") });
      window.fbCollection = window.fbDoc;
      window.fbWhere = (field, op, value) => ({ where: [field, op, value] });
      window.fbOrderBy = (field, dir) => ({ order: [field, dir] });
      window.fbLimit = (n) => ({ limit: n });
      window.fbQuery = (ref, ...c) => ({ ref, c });
      const snapOf = (path) => ({ id: path.split("/").pop(), data: () => structuredClone(__docs.get(path)), exists: () => __docs.has(path) });
      window.fbGetDocs = async (q) => {
        const ref = q.ref || q, cs = q.c || [];
        if (/^readerExplanations/.test(ref.path)) __reads++;
        let paths = [...__docs.keys()].filter((p) => p.startsWith(ref.path + "/") && p.split("/").length === ref.path.split("/").length + 1);
        for (const c of cs) {
          if (c.where) paths = paths.filter((p) => __docs.get(p)[c.where[0]] === c.where[2]);
          if (c.order) paths.sort((a, b) => __docs.get(b)[c.order[0]] - __docs.get(a)[c.order[0]]);
          if (c.limit) paths = paths.slice(0, c.limit);
        }
        return { docs: paths.map(snapOf) };
      };
      window.fbRunTransaction = async (_, cb) => cb({ get: async (ref) => snapOf(ref.path), set: (ref, value) => { if (/^readerExplanations/.test(ref.path)) __writes++; __docs.set(ref.path, structuredClone(value)); } });
      window.fbDeleteDoc = async (ref) => { __docs.delete(ref.path); };
      window.__as = (id, name) => { myId = id; myName = name; ["aiglish_reader_questions", "aiglish_reader_shared_cache", "aiglish_reader_shared_mine", "aiglish_reader_shared_hidden"].forEach((k) => localStorage.removeItem(k)); };
      window.__as("U1", "たろう");
    });
    await page.locator("#nav-reader").click();
    const card = page.locator("#readerQuestionsCard");
    const analyse = async (passage, questions) => {
      await page.evaluate(() => window.closeReader());
      await page.locator("#englishTextarea").fill(passage);
      if (questions) { if (!(await page.locator("#readerQuestionsBox").isVisible())) await page.locator("#readerQuestionsToggle").click(); await page.locator("#readerQuestionsInput").fill(questions); }
      await page.locator("#analysisSubmitBtn").click();
    };
    const Q = "1. What does Tom like?\n① coffee ② tea";

    // A: the first person solves it: one request, and the set is written once (without the figures).
    await analyse("Tom likes tea.", Q);
    await card.locator(".rq-answer strong", { hasText: "②" }).waitFor({ timeout: 20000 });
    await page.waitForFunction(() => __writes === 1);
    const stored = await page.evaluate(() => [...__docs.entries()].filter(([k]) => /^readerExplanations/.test(k)));
    assert.equal(stored.length, 1);
    assert.match(stored[0][0], /^readerExplanations\/n1[0-9a-f]{24}\/sets\/n1[0-9a-f]{24}$/);
    assert.deepEqual([stored[0][1].v, stored[0][1].by, stored[0][1].name, stored[0][1].questions.length], [1, "U1", "たろう", 1]);
    assert.ok(stored[0][1].inputKey.startsWith("n1"));
    assert.equal(JSON.stringify(stored[0][1]).includes("figures"), false, "no figures go up");
    assert.equal(JSON.stringify(stored[0][1]).includes("data:image"), false);
    assert.equal(solves, 0);

    // B: another person types the same questions: taken from the set, the AI is not asked for them, and it says whose it is.
    await page.evaluate(() => __as("U2", "はなこ"));
    const before = await page.evaluate(() => [__reads, __writes]);
    prompts.length = 0;
    await analyse("Tom likes tea.\n\n", Q);
    await card.locator(".rq-shared-note").waitFor({ timeout: 20000 });
    assert.match(await card.locator(".rq-shared-note").innerText(), /たろうさん[\s\S]*確認されていません/);
    await card.locator(".rq-answer strong", { hasText: "②" }).waitFor();
    assert.equal(prompts.some((p) => /questionAnswers/.test(p)), false, "the analysis request carries no questions");
    assert.deepEqual(await page.evaluate(() => [__reads, __writes]), [before[0] + 1, before[1]], "one lookup, no write");
    // …and can be solved again by the AI (then it is theirs, and nothing is written over the existing set).
    await card.getByRole("button", { name: "自分でAIに解かせる" }).click();
    await page.waitForFunction(() => document.querySelectorAll("#readerQuestionsCard .rq-shared-note").length === 0);
    await card.locator(".rq-answer strong", { hasText: "②" }).waitFor();
    await page.waitForFunction(() => !document.querySelector("#readerQuestionsCard .reader-analyzing"));
    assert.equal(solves, 1);
    assert.equal(await page.evaluate(() => __writes), before[1], "the same set is not written twice");

    // C: a person with no questions of their own: nothing is read until the button is pressed; then one query, kept afterwards.
    await page.evaluate(() => __as("U3", "じろう"));
    const base = await page.evaluate(() => __reads);
    await analyse("Tom likes tea.");
    await card.getByRole("button", { name: "みんなの解説を見る" }).waitFor({ timeout: 20000 });
    assert.equal(await page.evaluate(() => __reads), base, "nothing read yet");
    await card.getByRole("button", { name: "みんなの解説を見る" }).click();
    await card.locator(".rq-shared-set summary", { hasText: "たろうさん" }).waitFor();
    assert.equal(await page.evaluate(() => __reads), base + 1);
    await analyse("Tom likes tea.");
    await card.getByRole("button", { name: "みんなの解説を見る" }).click();
    await card.locator(".rq-shared-set").waitFor();
    assert.equal(await page.evaluate(() => __reads), base + 1, "kept on the device: no second read");
    // Bad data (two correct choices) is not shown.
    await page.evaluate(() => { const [path, doc] = [...__docs.entries()].filter(([k]) => /^readerExplanations/.test(k))[0]; const bad = structuredClone(doc); bad.questions[0].choices[0].correct = true; bad.at += 5; __docs.set(path.replace(/[^/]+$/, "n1badbad"), bad); localStorage.removeItem("aiglish_reader_shared_cache"); });
    await analyse("Tom likes tea.");
    await card.getByRole("button", { name: "みんなの解説を見る" }).click();
    await card.locator(".rq-shared-set").first().waitFor();
    assert.equal(await card.locator(".rq-shared-set").count(), 1, "the bad one is left out");

    // D: sharing off: nothing is read for typed questions, nothing is written.
    await page.evaluate(() => { __as("U4", "さぶろう"); ReaderShared.setEnabled(false); });
    const off = await page.evaluate(() => [__reads, __writes]);
    prompts.length = 0;
    await analyse("Tom likes tea.", Q);
    await card.locator(".rq-answer strong", { hasText: "②" }).waitFor({ timeout: 20000 });
    assert.ok(prompts.some((p) => /questionAnswers/.test(p)), "solved by the AI");
    assert.deepEqual(await page.evaluate(() => [__reads, __writes]), off);
    await page.evaluate(() => ReaderShared.setEnabled(true));

    // E: the maker takes a set back.
    await page.evaluate(() => { [...__docs.keys()].filter((k) => /^readerExplanations/.test(k)).forEach((k) => __docs.delete(k)); __as("U1", "たろう"); });
    await analyse("Tom likes tea.", Q);
    await card.locator(".rq-answer strong", { hasText: "②" }).waitFor({ timeout: 20000 });
    await page.waitForFunction(() => [...__docs.keys()].filter((k) => /^readerExplanations/.test(k)).length === 1);
    await page.evaluate(() => localStorage.removeItem("aiglish_reader_questions"));
    await analyse("Tom likes tea.");
    await card.getByRole("button", { name: "みんなの解説を見る" }).click();
    await card.locator(".rq-shared-set summary").click();
    await card.getByRole("button", { name: "共有をやめる" }).click();
    await page.waitForFunction(() => [...__docs.keys()].filter((k) => /^readerExplanations/.test(k)).length === 0);
    assert.deepEqual(errors, []);
    console.log("reader shared smoke passed");
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
