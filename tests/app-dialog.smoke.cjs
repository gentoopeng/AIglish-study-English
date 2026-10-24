// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/app-dialog.smoke.cjs
// alert() shows the app's own dialog (no browser dialog), one message after another.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }),
      native = [];
    page.on("dialog", (d) => {
      native.push(d.message());
      d.accept();
    });
    await page.route("https://**/*", (r) => r.abort());
    await page.goto("http://127.0.0.1:8000");
    await page.waitForFunction(() => window.AppDialog);
    await page.evaluate(() => {
      alert("一つ目\n二行目");
      alert("二つ目");
    });
    const dialog = page.locator("dialog.app-alert");
    assert.equal(await dialog.count(), 1);
    assert.equal(await dialog.locator("p").innerText(), "一つ目\n二行目");
    await dialog.getByRole("button", { name: "OK" }).click();
    assert.equal(await dialog.locator("p").innerText(), "二つ目");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    assert.deepEqual(native, []);
    console.log("PASS: alert() uses the app dialog, queued, closed by OK or Escape, no browser dialog");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
