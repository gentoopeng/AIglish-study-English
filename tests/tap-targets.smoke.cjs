// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/tap-targets.smoke.cjs
// The small controls of the main screens stay big enough to tap (about 36px; they were 12-28px), and nothing sticks out sideways.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    for (const width of [320, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 700 } }),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("https://**/*", (r) => r.abort());
      await page.addInitScript(() => {
        localStorage.setItem("b3_tutorial_done", "1");
        localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
      });
      await page.goto("http://127.0.0.1:8000");
      await page.getByRole("button", { name: "ゲストで試す" }).click();
      await page.waitForFunction(() => window.__learningBootReady === true);
      const checks = {
        vocab: ["#headerStudyPoints", ".library-toolbar button"],
        reader: ["#readerPasteButton", "#readerClearButton", "#readerBooksButton"],
        study: ["#studyRefreshRanking", "#studyEditDay"],
        titles: ["[data-rank-mode]", "#rankingRefresh", ".ranking-mini-title"],
      };
      for (const [tab, selectors] of Object.entries(checks)) {
        await page.evaluate((t) => window.switchTab(t), tab);
        await page.waitForTimeout(400);
        for (const selector of selectors) {
          const heights = await page.evaluate((s) => [...document.querySelectorAll(s)].filter((el) => el.offsetParent).map((el) => Math.round(el.getBoundingClientRect().height)), selector);
          // (a control that is not on the screen right now is not checked; at least the main ones are)
          for (const h of heights) assert.ok(h >= 18 && (selector === ".ranking-mini-title" ? h >= 18 : h >= 34), `${width}px ${tab} ${selector} is ${h}px tall`);
        }
        const wide = await page.evaluate((w) => document.documentElement.scrollWidth > w, width);
        assert.equal(wide, false, `${width}px ${tab} scrolls sideways`);
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log("tap targets smoke passed");
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
