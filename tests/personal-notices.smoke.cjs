// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/personal-notices.smoke.cjs
// Points that came in from elsewhere (a share of another player's line, a day's study time)
// show in the お知らせボックス under 「あなたへ」: the bell counts them, the new ones are marked
// while the box is open, and they are read once it has been opened.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 740 } }),
      errors = [];
    page.setDefaultTimeout(10000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true && window.PersonalNotices && window.Notices);
    const bell = page.locator("#headerNotices"),
      badge = bell.locator(".notice-badge");
    await page.waitForTimeout(1700);
    assert.equal(await badge.isHidden(), true);
    // A notice arrives: the bell shows 1 without anything being opened.
    await page.evaluate(() =>
      PersonalNotices.add("GUEST-000", { id: "time:2026-11-02", title: "11月2日の勉強時間 合計 300pt", body: "勉強時間 60分（1分5pt）。所持ポイントに加わりました。", amount: 300 }),
    );
    await badge.waitFor({ state: "visible" });
    assert.equal(await badge.innerText(), "1");
    assert.equal(await bell.getAttribute("aria-label"), "お知らせ（未読 1件）");
    // A second one; the box lists both under 「あなたへ」, newest first, marked new.
    await page.evaluate(() =>
      PersonalNotices.add("GUEST-000", { id: "sugoroku:1", title: "ほかの人のビンゴの分け前 +120pt", body: "すごろくビンゴで、ほかの人のラインの分け前が届きました。", amount: 120 }),
    );
    assert.equal(await badge.innerText(), "2");
    await bell.click();
    const box = page.locator("dialog.notices-dialog[open]");
    await box.getByRole("heading", { name: "あなたへ" }).waitFor();
    const own = box.locator("ol[aria-label='あなた宛てのお知らせ'] li");
    assert.deepEqual(await own.locator(".notice-head strong").allInnerTexts(), ["ほかの人のビンゴの分け前 +120pt", "11月2日の勉強時間 合計 300pt"]);
    assert.equal(await box.locator("ol[aria-label='あなた宛てのお知らせ'] li.is-new").count(), 2);
    assert.match(await own.nth(1).innerText(), /60分（1分5pt）/);
    // The team's notices stay in their own list below.
    await box.getByRole("heading", { name: "運営から" }).waitFor();
    // Opened, so read: the badge is gone; next time they are not marked new.
    await badge.waitFor({ state: "hidden" });
    await box.getByRole("button", { name: "閉じる" }).click();
    await bell.click();
    await box.getByRole("heading", { name: "あなたへ" }).waitFor();
    assert.equal(await box.locator("ol[aria-label='あなた宛てのお知らせ'] li.is-new").count(), 0);
    await box.getByRole("button", { name: "閉じる" }).click();
    // The same day counted again with more minutes is the same notice, new again.
    await page.evaluate(() =>
      PersonalNotices.add("GUEST-000", { id: "time:2026-11-02", title: "11月2日の勉強時間 合計 350pt", body: "勉強時間 70分（1分5pt）。あとから +50pt 加わりました。", amount: 350 }),
    );
    assert.equal(await badge.innerText(), "1");
    await bell.click();
    assert.equal(await box.locator("ol[aria-label='あなた宛てのお知らせ'] li").count(), 2);
    assert.deepEqual(await box.locator("ol[aria-label='あなた宛てのお知らせ'] li.is-new .notice-head strong").allInnerTexts(), ["11月2日の勉強時間 合計 350pt"]);
    await page.screenshot({ path: "/tmp/personal-notices.png" });
    assert.deepEqual(errors, []);
    console.log("PASS: the bell counts notices for this player, the box lists them under あなたへ with new ones marked, opening reads them, a re-counted day is one notice");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
