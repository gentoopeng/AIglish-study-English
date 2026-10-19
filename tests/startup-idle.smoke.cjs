// Exercise post-ready network responses and automatic warm-up without interaction.
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
    const page = await browser.newPage({
      viewport: { width: 402, height: 874 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("crash", () => errors.push("renderer crash"));
    await page.route("https://**/*", (r) => r.abort());
    // Inject an isolated backend before profile's startup hook registers. No production reads/writes.
    await page.route("**/profile.js?*", async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body:
          `
    window.db={};window.__idleCloudReads=0;
    window.fbDoc=(_, ...parts)=>parts.join('/');window.fbCollection=window.fbDoc;
    const remote={playerName:'遅れて到着',avatarUpdatedAt:2,profileCustomizationJson:JSON.stringify({nickname:'遅れて到着',nameColor:'#ffffff',frame:'wood',updatedAt:2})};
    const snap=value=>({exists:()=>!!value,data:()=>value});
    window.fbGetDocFromServer=window.fbGetDoc=async path=>{window.__idleCloudReads++;await new Promise(resolve=>setTimeout(resolve,path==='users/idle-user'?2200:20));return snap(path==='users/idle-user'?remote:null);};
    window.fbGetDocs=async()=>({docs:[],forEach(){},empty:true,size:0});
    window.fbSetDoc=async()=>{};window.fbDeleteDoc=async()=>{};
    window.fbRunTransaction=async(_,fn)=>fn({get:async path=>snap(path==='users/idle-user'?remote:null),set(){},delete(){}});
   ` + (await response.text()),
      });
    });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "standalone", { value: true });
      if (localStorage.getItem("idle-seeded")) return;
      localStorage.setItem("idle-seeded", "1");
      localStorage.setItem("core_v4_userId", "idle-user");
      localStorage.setItem("core_v4_userName", "初期名");
      localStorage.setItem("core_v4_current_textbook_id", "idle-book");
      const words = Array.from({ length: 300 }, (_, i) => ({
        num: i + 1,
        word: "word" + i,
        meaning: "意味" + i,
      }));
      const progress = Object.fromEntries(
        words.map((w) => [
          w.num,
          { status: "ok", note: "保存するメモ".repeat(30) },
        ]),
      );
      localStorage.setItem("core_v4_cache_idle-book", JSON.stringify(words));
      localStorage.setItem(
        "core_v4_user_vocab_progress_idle-user_idle-book",
        JSON.stringify(progress),
      );
      // A legacy backup must not replay a different device's diagnostic or render guard.
      localStorage.setItem(
        "save_studio_idle-user_main",
        JSON.stringify({
          savedAt: new Date(1).toISOString(),
          data: {
            localStorage: {
              __aiglish_startup_diagnostic: "foreign device",
              __aiglish_render_guard: "foreign guard",
            },
            memory: {},
          },
        }),
      );
    });
    await page.goto("http://127.0.0.1:8000/");
    await page.waitForFunction(() => window.__learningBootReady);
    const baseline = await page.evaluate(() =>
      localStorage.getItem(getVocabProgressStorageKey("idle-book")),
    );
    await page.waitForFunction(() =>
      document.querySelector(".flash-warmup-dialog[open]"),
    );
    await page.waitForFunction(() => myName === "遅れて到着");
    // No click, flip or swipe for the entire 60-second checkpoint window.
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("__aiglish_startup_diagnostic")).runtime
          ?.elapsedMs >= 60000,
      null,
      { timeout: 75000 },
    );
    const record = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("__aiglish_startup_diagnostic")),
    );
    assert.equal(record.phase, "ready");
    assert.equal(record.ready, true);
    assert.equal(record.activity, undefined);
    assert.equal(record.runtime.warmup, true);
    assert.ok(record.runtime.storage.entries >= 1);
    assert.ok(record.events.some((e) => e.label === "warmup:shown"));
    assert.ok(
      record.events.some((e) => /hook:\d+:profile.js:done/.test(e.label)),
    );
    assert.ok(record.events.length <= 12);
    assert.ok(JSON.stringify(record).length < 8000);
    const serialized = JSON.stringify(record);
    for (const content of [
      "idle-user",
      "idle-book",
      "遅れて到着",
      "保存するメモ",
      "word299",
    ])
      assert.equal(serialized.includes(content), false);
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem(getVocabProgressStorageKey("idle-book")),
      ),
      baseline,
    );
    assert.equal(
      await page.evaluate(() =>
        Object.hasOwn(
          __collectGameSaveData().localStorage,
          "__aiglish_startup_diagnostic",
        ),
      ),
      false,
    );
    assert.notEqual(
      await page.evaluate(() => localStorage.getItem("__aiglish_render_guard")),
      "foreign guard",
    );
    assert.deepEqual(errors, []);
    await page.goto("http://127.0.0.1:8000/startup-diagnostics.html");
    await page.waitForFunction(
      () => document.getElementById("copy")?.disabled === false,
    );
    assert.match(
      await page.locator("#report").textContent(),
      /largestImagePixels/,
    );
    assert.match(await page.locator("#report").textContent(), /warmup:shown/);
    await page.goto("http://127.0.0.1:8000/");
    await page.waitForFunction(() => window.__learningBootReady);
    const previous = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("__aiglish_startup_diagnostic"))
          .previous,
    );
    assert.ok(previous.runtime.elapsedMs >= 60000);
    assert.equal(previous.runtime.warmup, true);
    console.log(
      "PASS " +
        type.name() +
        ": idle >60s with delayed remote profile, automatic warmup, bounded private checkpoints, retained learning, device-local diagnostics excluded from backup/replay",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
