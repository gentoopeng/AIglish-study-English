// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/friends.smoke.cjs
// フレンド画面とメニュー整理 (10.168): the sidebar loses 画面の動き・データとバックアップ・ログアウト
// (the first two move into 設定), gains ショップ and フレンド; the header shows today's bettable
// amount under the points; the friends screen opens (a guest is told to log in).
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => localStorage.setItem("b3_tutorial_done", "1"));
    await page.goto(process.env.APP_URL || "http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);

    // The header carries the bettable line under the points (empty for a guest).
    assert.equal(await page.locator("#headerBettable").count(), 1);
    assert.equal(await page.locator(".header-points-stack #headerStudyPoints").count(), 1);

    // The sidebar: shop and friends in, motion / data / logout out.
    await page.locator(".menu-trigger").first().click();
    const menu = page.locator("#sidebarMenu");
    await menu.locator(".sidebar-item", { hasText: "ショップ" }).waitFor();
    assert.equal(await menu.locator(".sidebar-item", { hasText: "フレンド" }).count(), 1);
    assert.equal(await menu.locator(".sidebar-item", { hasText: "ログアウト" }).count(), 0);
    assert.equal(await menu.locator("#motionMenuButton").count(), 0);
    assert.equal(await menu.locator(".sidebar-item", { hasText: "データとバックアップ" }).count(), 0);

    // What left the sidebar lives in 設定 now.
    await menu.locator("#settingsMenuButton").click();
    const settings = page.locator("#settingsDialog");
    await settings.locator("#motionMenuButton").waitFor();
    assert.match(await settings.locator("#motionMenuValue").innerText(), /おしゃれ|控えめ|なし/);
    assert.equal(await settings.locator(".settings-nav-row", { hasText: "データとバックアップ" }).count(), 1);
    await settings.locator("[data-menu-dialog-close]").first().click();

    // The friends screen opens; a guest is told to log in.
    await page.evaluate(() => window.Friends.open());
    await page.locator(".fr-wait").waitFor();
    assert.match(await page.locator(".fr-wait").innerText(), /ログインするとフレンドが見られます/);
    assert.deepEqual(errors, []);
    console.log("friends smoke ok");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
