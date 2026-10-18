const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.route("https://**/*", (route) => route.abort());
    await page.goto("http://127.0.0.1:8000/startup-diagnostics.html");
    await page.evaluate(() => {
      localStorage.setItem(
        "core_v4_user_vocab_progress_diagnostic_book",
        '{"1":{"status":"ok"}}',
      );
      localStorage.setItem(
        "__aiglish_startup_diagnostic",
        JSON.stringify({
          version: "previous-version",
          startedAt: "2026-10-18T00:00:00Z",
          phase: "storage-hydrate",
          ready: false,
        }),
      );
    });
    const requests = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.reload();
    assert.match(
      await page.locator("#report").textContent(),
      /storage-hydrate/,
    );
    assert.equal(
      requests.some((url) =>
        /app-storage|app\.js|firebase|app-loader/.test(url),
      ),
      false,
    );
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("core_v4_user_vocab_progress_diagnostic_book"),
      ),
      '{"1":{"status":"ok"}}',
    );
    await page.goto("http://127.0.0.1:8000/index.html");
    await page.waitForFunction(() => window.__learningBootReady);
    const state = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("__aiglish_startup_diagnostic")),
    );
    assert.equal(state.phase, "ready");
    assert.equal(state.previous.phase, "storage-hydrate");
    assert.equal(state.previous.ready, false);
    assert.equal(state.previous.version, "previous-version");
    assert.ok(JSON.stringify(state).length < 1000);
    assert.equal(JSON.stringify(state).includes("status"), false);
    await page.evaluate(() => {
      StartupMonitor.progress(1234, 1234);
      StartupMonitor.activity("card-swipe");
    });
    const after = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("__aiglish_startup_diagnostic")),
    );
    assert.equal(after.ready, true);
    assert.equal(after.activity.kind, "card-swipe");
    assert.deepEqual(after.progressChars, { primary: 1234, recovery: 1234 });
    await page.reload();
    await page.waitForFunction(() => window.__learningBootReady);
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("__aiglish_startup_diagnostic"))
            .previous.activity.kind,
      ),
      "card-swipe",
    );
    console.log(
      "PASS: standalone startup diagnostics avoid application/storage hydration, retain learning and preserve interrupted phase across next successful startup",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
