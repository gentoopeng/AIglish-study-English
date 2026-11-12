// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/reader-shelf-full.smoke.cjs
// When the device storage is full, saving a text to the bookshelf no longer says "saved" and loses it: the stamp pictures kept on
// the device are let go first, then the text is kept without its (big) analysis, and the player is told.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage(),
      errors = [],
      alerts = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", async (d) => { if (d.type() === "alert") alerts.push(d.message()); await d.accept(); });
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => { localStorage.setItem("b3_tutorial_done", "1"); localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false })); });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true && window.showCustomSaveBookshelfPrompt && window.Stamps);
    // The device is "full" for any shelf write bigger than 3,000 characters, unless the stamp pictures are let go first (when asked: yes).
    await page.evaluate(() => {
      window.__full = { limit: 3000, freed: false };
      localStorage.setItem("aiglish_stamp_image_stampxxxx1", "x".repeat(10));
      localStorage.setItem("aiglish_stamp_images", JSON.stringify(["stampxxxx1"]));
      const store = window.localStorage;
      const wrapped = new Proxy(store, {
        get(target, key) {
          if (key === "setItem") return (k, v) => { if (k === "myBookshelf" && String(v).length > window.__full.limit && !window.__full.freed) throw new DOMException("full", "QuotaExceededError"); return target.setItem(k, v); };
          const value = target[key];
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      Object.defineProperty(window, "localStorage", { configurable: true, get: () => wrapped });
      const realReset = window.Stamps.reset;
      window.Stamps = { ...window.Stamps, reset: () => { realReset(); window.__full.freed = window.__full.freeable === true; } };
    });
    const save = async (title, analysis) => {
      await page.evaluate(([t, a]) => window.showCustomSaveBookshelfPrompt("Hello world. " + t, t, a), [title, analysis]);
      await page.locator("#confirmSaveBookshelfBtn").click();
      // (the app's own alert dialog)
      await page.locator("dialog.app-alert p").waitFor();
      alerts.push(await page.locator("dialog.app-alert p").innerText());
      await page.locator("dialog.app-alert button").click();
    };
    // 1. A small text fits.
    await save("小さい", null);
    assert.match(alerts.at(-1), /に保存しました。$/);
    // 2. A big analysis does not fit, and freeing the stamp pictures does not help: the text is kept without the analysis, and it says so.
    const big = { sentences: "あ".repeat(6000) };
    await save("大きい", big);
    assert.match(alerts.at(-1), /文章を保存しました（解析結果は、端末の容量がいっぱいで保存できませんでした）/);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("myBookshelf")).map((i) => [i.title, !!i.aiAnalysisData]));
    assert.deepEqual(stored, [["小さい", false], ["大きい", false]]);
    assert.equal(await page.evaluate(() => myBookshelf.find((i) => i.title === "大きい").aiAnalysisData.sentences.length), 6000, "the full analysis stays in memory (and in the cloud backup)");
    // 3. When letting the stamp pictures go makes room, everything is saved.
    await page.evaluate(() => { window.__full.freeable = true; });
    await save("やっぱり入る", big);
    assert.match(alerts.at(-1), /に保存しました。$/);
    assert.equal(await page.evaluate(() => localStorage.getItem("aiglish_stamp_image_stampxxxx1")), null, "the stamp pictures were let go to make room");
    assert.equal(await page.evaluate(() => !!JSON.parse(localStorage.getItem("myBookshelf")).find((i) => i.title === "やっぱり入る")?.aiAnalysisData), true);
    // 4. Nothing fits at all: it says so instead of "saved".
    await page.evaluate(() => { window.__full.limit = 10; window.__full.freed = false; window.__full.freeable = false; });
    await save("入らない", null);
    assert.match(alerts.at(-1), /端末には保存できませんでした/);
    assert.deepEqual(errors, []);
    console.log("reader shelf full smoke passed");
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
