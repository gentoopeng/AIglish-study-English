// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/layout-overflow.smoke.cjs
// On a 320 px phone, no visible element on the main screens sticks out past the screen's sides.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://**/*", (r) => r.abort());
  await page.addInitScript(() => { localStorage.setItem("b3_tutorial_done", "1"); localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false })); });
  await page.goto("http://127.0.0.1:8000");
  const problems = [],
    check = ({ label, out }) => out.length && problems.push(label + ": " + out.slice(0, 6).join(" | "));
  const scan = (label) => page.evaluate((label) => {
    const W = innerWidth, out = [];
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || el.closest("[hidden]")) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (el.closest("#sidebarMenu") && !document.body.classList.contains("sidebar-open")) continue;
      if (r.right <= 0 || r.left >= W) continue;
      if (r.right > W + 1 || r.left < -1) {
        // skip if clipped by an ancestor with overflow hidden/auto inside viewport
        let p = el.parentElement, clipped = false;
        while (p && p !== document.body) { const ps = getComputedStyle(p); if (/(hidden|auto|scroll|clip)/.test(ps.overflowX)) { const pr = p.getBoundingClientRect(); if (pr.right <= W + 1 && pr.left >= -1) { clipped = true; break; } } p = p.parentElement; }
        if (clipped || cs.position === "fixed" && (r.left > W || r.right < 0)) continue;
        out.push((el.id ? "#" + el.id : el.tagName.toLowerCase() + "." + [...el.classList].slice(0, 2).join(".")) + " [" + Math.round(r.left) + "," + Math.round(r.right) + "] " + (el.textContent || "").trim().slice(0, 20));
      }
    }
    return { label, out };
  }, label);
  check(await scan("login"));
  await page.getByRole("button", { name: "ゲストで試す" }).click();
  await page.waitForFunction(() => window.__learningBootReady === true);
  await page.waitForTimeout(800);
  check(await scan("home"));
  await page.locator("#nav-vocab").click();
  await page.getByRole("button", { name: "＋ 単語帳を作る", exact: true }).click();
  check(await scan("book-editor"));
  await page.locator("#libraryBookName").fill("テスト");
  await page.locator("#libraryBookWords").fill(Array.from({ length: 12 }, (_, i) => i + 1 + ":word" + i + ":意味" + i + ":").join("\n"));
  await page.getByRole("button", { name: "単語帳を作る", exact: true }).click();
  await page.locator("#vocabLibraryBooks .textbook-list-item").filter({ hasText: "テスト" }).first().click();
  await page.waitForTimeout(500);
  check(await scan("vocab-list"));
  await page.locator("#vocabAddWord").click(); await page.waitForTimeout(300);
  check(await scan("entry"));
  await page.locator("[data-entry-close]").first().click();
  await page.evaluate(() => window.showVocabLibrarySelection());
  await page.getByRole("button", { name: "テストの学習方法を選ぶ" }).click();
  check(await scan("study-menu"));
  await page.getByRole("button", { name: "単語カード", exact: true }).click(); await page.waitForTimeout(300);
  check(await scan("flash-settings"));
  await page.getByRole("button", { name: "カードを開始する" }).click(); await page.waitForTimeout(800);
  check(await scan("flash-play"));
  await page.locator("#flashcard-play-screen").getByRole("button", { name: "中断", exact: true }).click().catch(() => {});
  await page.waitForTimeout(500);
  for (const tab of ["nav-reader", "nav-community", "nav-casino", "nav-battle"]) { await page.locator("#" + tab).click(); await page.waitForTimeout(500); check(await scan(tab)); }
  await page.locator(".mode-casual").click(); await page.waitForTimeout(300); check(await scan("battle-entry"));
  await page.locator("[data-battle-route=solo]").click(); await page.waitForTimeout(300); check(await scan("battle-config"));
  await page.evaluate(() => document.querySelector("[data-duel-back]")?.click());
  await page.locator(".menu-trigger").click().catch(() => {}); await page.waitForTimeout(400); check(await scan("sidebar"));
  await browser.close();
  assert.deepEqual(problems, []);
  assert.deepEqual(errors, []);
  console.log("PASS: no horizontal overflow at 320 px on login, home, word books, entry, flashcards, reader, users, battle and the menu");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
