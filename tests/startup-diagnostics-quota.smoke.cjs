const { chromium, webkit } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const type = process.env.BROWSER === "webkit" ? webkit : chromium;
  const browser = await type.launch(
    type === webkit
      ? { executablePath: process.env.WEBKIT_EXECUTABLE_PATH }
      : { executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] },
  );
  try {
    const context = await browser.newContext({
      viewport: { width: 402, height: 874 },
    });
    await context.route("https://**/*", (r) => r.abort());
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "standalone", { value: true });
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (
          key === "__aiglish_startup_diagnostic" ||
          key.startsWith("__aiglish_diagnostic_probe_")
        )
          throw new DOMException("full", "QuotaExceededError");
        return set.call(this, key, value);
      };
    });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:8000/");
    await page.waitForFunction(() => window.__learningBootReady);
    await page
      .getByRole("button", { name: "ゲストとしてテストプレイ" })
      .click();
    await page.waitForFunction(() => window.__learningBootReady);
    await page.evaluate(() => {
      localStorage.setItem(
        "core_v4_user_vocab_progress_keep_book",
        '{"1":{"status":"ok"}}',
      );
      StartupMonitor.progress(12345, 12345);
      StartupMonitor.activity("card-swipe");
    });
    await page.waitForFunction(
      async () =>
        (await StartupDiagnosticStore.read())?.activity?.kind === "card-swipe",
    );
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("__aiglish_startup_diagnostic"),
      ),
      null,
    );
    await page.locator(".menu-trigger").click();
    await page.getByRole("button", { name: "起動診断", exact: true }).click();
    await page.waitForFunction(() => !document.getElementById("copy").disabled);
    const report = await page.locator("#report").textContent();
    assert.match(report, /ホーム画面アプリ: true/);
    assert.match(report, /起動記録の保存先: IndexedDB/);
    assert.match(report, /QuotaExceededError/);
    assert.match(report, /card-swipe/);
    assert.match(report, /12345/);
    assert.equal(report.includes("keep_book"), false);
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("core_v4_user_vocab_progress_keep_book"),
      ),
      '{"1":{"status":"ok"}}',
    );
    assert.equal(
      await page.evaluate(() =>
        Object.keys(localStorage).some((key) =>
          key.startsWith("__aiglish_diagnostic_probe_"),
        ),
      ),
      false,
    );
    // Reload the application: only one diagnostic record survives and previous action remains.
    await page.goto("http://127.0.0.1:8000/");
    await page.waitForFunction(() => window.__learningBootReady);
    await page.waitForFunction(
      async () =>
        (await StartupDiagnosticStore.read())?.previous?.activity?.kind ===
        "card-swipe",
    );
    assert.equal(
      await page.evaluate(async () => {
        const req = indexedDB.open("aiglish-startup-diagnostics", 1);
        return await new Promise((resolve) => {
          req.onsuccess = () => {
            const tx = req.result.transaction("record"),
              count = tx.objectStore("record").count();
            tx.oncomplete = () => resolve(count.result);
          };
        });
      }),
      1,
    );
    await context.close();
    const empty = await browser.newPage();
    await empty.goto("http://127.0.0.1:8000/startup-diagnostics.html");
    await empty.waitForFunction(
      () => !document.getElementById("copy").disabled,
    );
    assert.match(
      await empty.locator("#report").textContent(),
      /アプリ関連キー数: 0/,
    );
    assert.match(
      await empty.locator("#report").textContent(),
      /起動記録を確認できません/,
    );
    console.log(
      "PASS " +
        type.name() +
        ": quota blocks native diagnostics; bounded IDB fallback retains phase/action, menu stays in same context, learning/probe cleanup preserved, empty context distinguished",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
