// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/workbook-explanation-save.smoke.cjs
// ワークのAI解説の保存 (10.169): a generated explanation is kept on the unit — closing and reopening
// shows it without asking Gemini again; 作り直す asks again; 解説を消す clears it.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    let calls = 0;
    await page.route("https://generativelanguage.googleapis.com/**", (route) => {
      calls++;
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ candidates: [{ content: { parts: [{ text: "# 見出し\n\n保存される解説です。" }] } }] }),
      });
    });
    await page.addInitScript(() => localStorage.setItem("b3_tutorial_done", "1"));
    await page.goto(process.env.APP_URL || "http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.evaluate(() => {
      localStorage.setItem("core_v4_geminiKey", "fixture-only");
      localStorage.setItem("vv4_works_GUEST-000", JSON.stringify([{ id: "expsave", name: "解説保存試験", from: 1, to: 1, unitKind: "problem", units: [{ id: "1", num: 1, q: "1+1は？", ans: "2" }] }]));
      showVocabLibrarySelection();
    });
    await page.locator("#nav-vocab").click();
    await page.locator("#vocabLibraryWorks .textbook-list-item").filter({ hasText: "解説保存試験" }).click();

    // First open: generated once, and saved onto the unit.
    await page.getByRole("button", { name: "AIで解説を見る", exact: true }).click();
    await page.locator("#workbookExplanation h3").first().waitFor();
    assert.equal(calls, 1);
    assert.match(await page.locator("#workbookExplanationNote").innerText(), /保存されました/);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("vv4_works_GUEST-000"))[0].units[0].ai);
    assert.ok(saved && saved.text.includes("保存される解説です") && saved.q === "1+1は？");
    await page.getByRole("button", { name: "閉じる", exact: true }).click();

    // Reopen: the saved text shows, no new request, and the note says it is the saved one.
    await page.getByRole("button", { name: "AIで解説を見る", exact: true }).click();
    await page.locator("#workbookExplanation h3").first().waitFor();
    assert.equal(calls, 1, "reopening must not call Gemini again");
    assert.match(await page.locator("#workbookExplanationNote").innerText(), /保存した解説です/);

    // 作り直す asks again and overwrites.
    await page.getByRole("button", { name: "作り直す", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#workbookExplanationNote")?.textContent.includes("保存されました"));
    assert.equal(calls, 2);

    // 解説を消す clears the unit.
    await page.getByRole("button", { name: "解説を消す", exact: true }).click();
    const cleared = await page.evaluate(() => JSON.parse(localStorage.getItem("vv4_works_GUEST-000"))[0].units[0].ai);
    assert.equal(cleared, null);
    assert.deepEqual(errors, []);
    console.log("workbook explanation save smoke ok");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
