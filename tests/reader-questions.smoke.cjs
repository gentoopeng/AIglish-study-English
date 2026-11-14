// Reader: 「問題を追加」 under the pasted passage. The pasted questions are solved from the passage after the analysis (answer, why, the
// passage's own lines, every choice), kept per passage so reopening does not ask again, and an error says why and can be retried.
const { chromium } = require("playwright"), assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }), errors = [], prompts = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let solveStatus = 0, solves = 0, streams = 0, omitAnswers = false, lastParts = [];
    const answers = [{ number: "1", question: "What does Tom like?", answer: "②", explanation: "本文の1文目に、トムは紅茶が好きだと書かれています。", evidence: "Tom likes tea.", evidenceTranslation: "トムは紅茶が好きだ。", choices: [{ label: "①", correct: false, reason: "コーヒーのことは書かれていません。" }, { label: "②", correct: true, reason: "tea と一致します。" }] }];
    await page.route("https://**/*", (r) => r.abort());
    await page.route("https://generativelanguage.googleapis.com/**", (r) => {
      const url = r.request().url(), body = JSON.parse(r.request().postData() || "{}");
      if (/streamGenerateContent/.test(url)) {
        streams++;
        lastParts = body.contents[0].parts;
        prompts.push(body.contents[0].parts[0].text);
        const analysis = { fullSummaryAbstract: "要約", sentences: [{ text: "Tom likes tea.", translation: "トムは紅茶が好きだ。", grammarHighlights: [], vocab: [] }] };
        // With questions, the one analysis request carries them too (and asks for their answers in the same reply).
        if (/questionAnswers/.test(body.contents[0].parts[0].text) && !omitAnswers) analysis.questionAnswers = answers;
        const text = JSON.stringify(analysis);
        return r.fulfill({ status: 200, contentType: "text/event-stream", body: "data: " + JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }) + "\r\n\r\n" });
      }
      solves++;
      prompts.push(body.contents[0].parts[0].text);
      if (solveStatus) return r.fulfill({ status: solveStatus, contentType: "application/json", body: JSON.stringify({ error: { message: "busy" } }) });
      const text = JSON.stringify({ questions: [{ number: "1", question: "What does Tom like?", answer: "②", explanation: "本文の1文目に、トムは紅茶が好きだと書かれています。", evidence: "Tom likes tea.", evidenceTranslation: "トムは紅茶が好きだ。", choices: [{ label: "①", correct: false, reason: "コーヒーのことは書かれていません。" }, { label: "②", correct: true, reason: "tea と一致します。" }] }] });
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }) });
    });
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
      localStorage.setItem("core_v4_geminiKey", "test-key");
    });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true && window.ReaderQuestions);
    await page.locator("#nav-reader").click();

    // The button is under the pasted passage, and opens a box for the questions.
    const order = await page.evaluate(() => {
      const y = (id) => document.getElementById(id).getBoundingClientRect().top;
      return [y("englishTextarea"), y("readerQuestionsToggle"), y("analysisSubmitBtn")];
    });
    assert.ok(order[0] < order[1] && order[1] < order[2], "button sits between the passage and the analyse button: " + order);
    assert.equal(await page.locator("#readerQuestionsBox").isVisible(), false);
    await page.locator("#readerQuestionsToggle").click();
    await page.locator("#readerQuestionsInput").waitFor();
    await page.locator("#englishTextarea").fill("Tom likes tea.");
    await page.locator("#readerQuestionsInput").fill("1. What does Tom like?\n① coffee ② tea");
    await page.locator("#analysisSubmitBtn").click();

    // The analysis, then the explanation under it.
    const card = page.locator("#readerQuestionsCard");
    await card.locator(".rq-answer strong", { hasText: "②" }).waitFor({ timeout: 20000 });
    // One request did both: the analysis, and the answers inside it (no separate request for the questions).
    assert.deepEqual([streams, solves], [1, 0]);
    assert.match(prompts[0], /questionAnswers[\s\S]*Tom likes tea\.[\s\S]*What does Tom like\?/);
    assert.equal(await page.evaluate(() => JSON.stringify(textHistory[0].aiAnalysisData).includes("questionAnswers")), false, "answers are not stored inside the analysis");
    assert.match(await card.innerText(), /本文の根拠[\s\S]*Tom likes tea\.[\s\S]*× ①[\s\S]*○ ②/);
    const below = await page.evaluate(() => document.getElementById("readerQuestionsCard").getBoundingClientRect().top > document.getElementById("englishContainer").getBoundingClientRect().top);
    assert.ok(below, "explanation is under the analysed passage");
    // The box was emptied for the next passage.
    await page.evaluate(() => window.closeReader());
    assert.equal(await page.locator("#readerQuestionsInput").inputValue(), "");

    // Opening the same passage again shows it without asking the AI again.
    await page.locator("#englishTextarea").fill("Tom likes tea.");
    await page.locator("#analysisSubmitBtn").click();
    await card.locator(".rq-answer strong", { hasText: "②" }).waitFor({ timeout: 20000 });
    assert.deepEqual([streams, solves], [2, 0], "kept per passage: only the analysis is asked again, never the questions");

    // If the analysis comes back without the answers, they are asked for separately.
    await page.evaluate(() => window.closeReader());
    omitAnswers = true;
    await page.locator("#englishTextarea").fill("Tom likes tea. He drinks it daily.");
    await page.locator("#readerQuestionsToggle").click();
    await page.locator("#readerQuestionsInput").fill("1. What does Tom like?\n① coffee ② tea");
    await page.locator("#analysisSubmitBtn").click();
    await card.locator(".rq-answer strong", { hasText: "②" }).waitFor({ timeout: 20000 });
    assert.equal(solves, 1, "asked separately only because the analysis had no answers");
    omitAnswers = false;

    // A question that is a picture (a photo or screenshot): no text needed; it goes along in the same single request.
    await page.evaluate(() => window.closeReader());
    const photo = await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 900; c.height = 600; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 900, 600); x.fillStyle = "#000"; x.font = "40px sans-serif"; x.fillText("1. What does Tom like?", 40, 100); return c.toDataURL("image/jpeg", 0.9).split(",")[1]; });
    await page.locator("#englishTextarea").fill("Tom likes tea. He is kind.");
    await page.locator("#readerQuestionsToggle").click();
    await page.locator("#readerQuestionsBox input[type=file]").setInputFiles({ name: "q.jpg", mimeType: "image/jpeg", buffer: Buffer.from(photo, "base64") });
    await page.locator("#readerQuestionsBox .rq-thumb").waitFor();
    assert.match(await page.locator("#readerQuestionsToggle").innerText(), /問題を閉じる/);
    const beforeStreams = streams, beforeSolves = solves;
    await page.locator("#analysisSubmitBtn").click();
    await card.locator(".rq-answer strong", { hasText: "②" }).waitFor({ timeout: 20000 });
    assert.deepEqual([streams - beforeStreams, solves - beforeSolves], [1, 0], "a picture question is also one request");
    assert.equal(lastParts.filter((p) => p.inlineData && p.inlineData.mimeType === "image/jpeg" && p.inlineData.data.length > 100).length, 1, "the picture goes along");
    assert.match(lastParts[0].text, /添付の画像1枚/);
    assert.equal(await page.locator("#readerQuestionsBox .rq-thumb").count(), 0, "emptied after use");
    // The saved question keeps no picture, only the answers.
    assert.equal(await page.evaluate(() => /base64/.test(localStorage.getItem("aiglish_reader_questions"))), false);

    // Another passage has none; the card offers to add questions there, and an error is said and can be retried.
    await page.evaluate(() => window.closeReader());
    await page.locator("#englishTextarea").fill("Mary reads books.");
    await page.locator("#analysisSubmitBtn").click();
    await card.getByRole("button", { name: "解いて解説する" }).waitFor({ timeout: 20000 });
    solveStatus = 503;
    await card.locator(".rq-input").fill("1. What does Mary do?");
    await card.getByRole("button", { name: "解いて解説する" }).click();
    await card.locator(".reader-error-notice").waitFor({ timeout: 30000 });
    assert.match(await card.innerText(), /混み合っています/);
    solveStatus = 0;
    await card.getByRole("button", { name: "もう一度解く" }).click();
    await card.locator(".rq-answer strong").waitFor({ timeout: 20000 });
    // The questions can be removed.
    await card.getByRole("button", { name: "問題を消す" }).click();
    await card.getByRole("button", { name: "解いて解説する" }).waitFor();
    assert.deepEqual(errors, []);
    console.log("reader questions smoke passed");
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
