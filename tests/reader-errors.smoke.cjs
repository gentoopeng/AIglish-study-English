// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/reader-errors.smoke.cjs
// Reader: when Gemini fails, the reader says why in Japanese (no pop-up) and offers a retry; a busy
// model is asked again, then the other model is tried.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }),
      errors = [],
      calls = [];
    page.on("pageerror", (e) => errors.push(e.message));
    // status per model; null answers with a translation.
    let answers = {};
    await page.route("https://**/*", (r) => r.abort());
    await page.route("https://generativelanguage.googleapis.com/**", (r) => {
      const model = /models\/([^:]+):/.exec(r.request().url())[1];
      calls.push(model);
      const status = answers[model];
      if (status)
        return r.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: { message: "This model is currently experiencing high demand." } }) });
      const text = JSON.stringify({ fullSummaryAbstract: "要約", sentences: [{ text: "Hello world.", translation: "こんにちは世界。", grammarHighlights: [] }] });
      r.fulfill({ status: 200, contentType: "text/event-stream", body: "data: " + JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }) + "\r\n\r\n" });
    });
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
      localStorage.setItem("core_v4_geminiKey", "test-key");
    });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストとしてテストプレイ" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-reader").click();
    const analyse = async () => {
      await page.evaluate(() => window.closeReader());
      await page.locator("#englishTextarea").fill("Hello world.");
      await page.locator("#analysisSubmitBtn").click();
    };
    // Both models busy: each is asked twice, then the reason is shown in the reader.
    answers = { "gemini-2.5-flash": 503, "gemini-flash-latest": 503 };
    await analyse();
    const notice = page.locator(".reader-error-notice");
    await notice.waitFor({ timeout: 20000 });
    assert.deepEqual(calls, ["gemini-2.5-flash", "gemini-2.5-flash", "gemini-flash-latest", "gemini-flash-latest"]);
    assert.match(await notice.innerText(), /AI（Gemini）が混み合っています[\s\S]*アプリやAPIキーの問題ではありません[\s\S]*エラーコード 503/);
    assert.equal(await page.locator("dialog.app-alert").count(), 0);
    assert.equal(await page.locator("#summary-abstract-card").isVisible(), false);
    // Retrying once the newer model answers: the busy one is skipped over.
    answers = { "gemini-2.5-flash": 503 };
    calls.length = 0;
    await notice.getByRole("button", { name: "もう一度解析する" }).click();
    await page.locator(".sentence-ja", { hasText: "こんにちは世界。" }).waitFor({ timeout: 20000 });
    assert.deepEqual(calls, ["gemini-2.5-flash", "gemini-2.5-flash", "gemini-flash-latest"]);
    assert.equal(await page.locator(".reader-error-notice").count(), 0);
    // A key that does not work is said so at once, without asking again.
    answers = { "gemini-2.5-flash": 403 };
    calls.length = 0;
    await page.evaluate(() => window.closeReader());
    await page.locator("#englishTextarea").fill("Hello again.");
    await page.locator("#analysisSubmitBtn").click();
    await notice.waitFor();
    assert.deepEqual(calls, ["gemini-2.5-flash"]);
    assert.match(await notice.innerText(), /APIキーが使えません/);
    // Used up (429): the other model is tried.
    answers = { "gemini-2.5-flash": 429, "gemini-flash-latest": 429 };
    calls.length = 0;
    await page.evaluate(() => window.closeReader());
    await page.locator("#englishTextarea").fill("Hello there.");
    await page.locator("#analysisSubmitBtn").click();
    await page.locator(".reader-error-notice", { hasText: "利用回数の上限" }).waitFor();
    assert.deepEqual(calls, ["gemini-2.5-flash", "gemini-flash-latest"]);
    assert.deepEqual(errors, []);
    console.log("PASS: busy model asked again then the other model, Japanese reasons with retry and no pop-up, unusable key, used-up quota");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
