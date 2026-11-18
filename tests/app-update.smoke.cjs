// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/app-update.smoke.cjs
// A newer version on the server: the update screen covers the splash and the login until the app is updated;
// the same or an older version, or no answer (offline), changes nothing; coming back later checks again.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const base = process.env.APP_URL || "http://127.0.0.1:8000";
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => localStorage.setItem("b3_tutorial_done", "1"));
    let served = null; // null: the real file; a version: a page with that version; "fail": no answer
    let checks = 0;
    await page.route(/\?version-check=/, (route) => {
      checks++;
      if (served === "fail") return route.abort();
      if (served === null) return route.continue();
      return route.fulfill({ contentType: "text/html", body: '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="application-version" content="' + served + '"></head></html>' });
    });
    await page.goto(base);
    const running = await page.evaluate(() => document.querySelector('meta[name="application-version"]').content);
    const [a, b, c, d] = running.split(".").map(Number);
    const newer = [a, b, c + 1, d].map((n, i) => (i ? String(n).padStart(2, "0") : n)).join("."),
      older = [a, b, c - 1, d].map((n, i) => (i ? String(n).padStart(2, "0") : n)).join(".");
    // The same version: nothing, and the login works as before.
    await page.waitForFunction(() => !document.getElementById("appSplash"));
    assert.ok(checks >= 1, "it checked");
    assert.equal(await page.locator("#appUpdate").isVisible(), false);
    // The model of versions.
    assert.deepEqual(await page.evaluate(() => [AppUpdate.newer("10.151.00.00", "10.150.00.00"), AppUpdate.newer("10.150.00.00", "10.150.00.00"), AppUpdate.newer("10.149.00.00", "10.150.00.00"), AppUpdate.newer("11.0.0.0", "10.999.00.00")]), [true, false, false, true]);

    // A newer version on the server: the update screen, over the login (nothing under it can be pressed).
    served = newer;
    await page.goto(base);
    await page.locator("#appUpdate").waitFor();
    assert.equal(await page.locator("[data-update-from]").innerText(), "ver " + running);
    assert.equal(await page.locator("[data-update-to]").innerText(), "ver " + newer);
    await page.waitForFunction(() => !document.getElementById("appSplash"));
    const covered = await page.evaluate(() => {
      const button = [...document.querySelectorAll("#auth-gate-screen button")].find((el) => el.textContent.includes("ゲストで試す")),
        r = button.getBoundingClientRect();
      return document.getElementById("appUpdate").contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
    });
    assert.equal(covered, true, "the login is under the update screen");
    // 更新する: the page is opened again for the new version.
    await Promise.all([page.waitForURL(/\?update=/), page.locator("[data-update-go]").click()]);
    assert.match(page.url(), new RegExp("update=" + newer.replace(/\./g, "\\.")));
    // Still the old version after pressing (the new one has not arrived): said so.
    await page.locator("#appUpdate").waitFor();
    await page.locator("[data-update-note]").waitFor();

    // An older version there, or no answer: nothing.
    for (const what of [older, "fail"]) {
      served = what;
      await page.goto(base);
      await page.waitForFunction(() => !document.getElementById("appSplash"));
      await page.waitForTimeout(300);
      assert.equal(await page.locator("#appUpdate").isVisible(), false, String(what));
    }
    // Coming back to the app later: checked again (here, at once).
    served = newer;
    await page.evaluate(() => AppUpdate.check());
    await page.locator("#appUpdate").waitFor();
    assert.deepEqual(errors, []);
    console.log("app-update smoke ok");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
