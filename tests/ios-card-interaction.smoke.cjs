const { chromium, webkit } = require("playwright");
const assert = require("node:assert/strict");
const effects =
  "#flashcardGhost,.flashcard-post-ripple,.fc-vanish-burst,.flashcard-edge-ripple,#flashcardLiveRippleLayer";
(async () => {
  const type = process.env.BROWSER === "webkit" ? webkit : chromium;
  const browser = await type.launch(
    type === webkit
      ? { executablePath: process.env.WEBKIT_EXECUTABLE_PATH }
      : { executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] },
  );
  try {
    const page = await browser.newPage({
      viewport: { width: 393, height: 852 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("crash", () => errors.push("renderer crashed"));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "standalone", { value: true });
      window.__audioPlayers = [];
      const Original = window.Audio;
      window.Audio = new Proxy(Original, {
        construct(target, args) {
          const player = new target(...args);
          __audioPlayers.push(player);
          return player;
        },
      });
    });
    await page.goto("http://127.0.0.1:8000/");
    await page
      .getByRole("button", { name: "ゲストとしてテストプレイ" })
      .click();
    await page.waitForFunction(() => window.__learningBootReady);
    await page.evaluate(async () => {
      myId = "ios-card-check";
      myName = "検証";
      localStorage.setItem("core_v4_userId", myId);
      window.db = null;
      currentTextbook = "ios-book";
      textbooksPool = [{ id: "ios-book", name: "古文の確認" }];
      const master = Array.from({ length: 315 }, (_, i) => ({
        num: i + 1,
        word: "古文の単語" + (i + 1),
        meanings: [
          { id: i + 1 + "-0", text: "意味その一" },
          { id: i + 1 + "-1", text: "意味その二" },
        ],
      }));
      textbooksCacheMap["ios-book"] = master;
      localStorage.setItem("core_v4_cache_ios-book", JSON.stringify(master));
      await loadCurrentTextbookData();
      switchTab("vocab");
      showVocabLibrarySelection();
    });
    await page
      .getByRole("button", { name: "古文の確認の学習方法を選ぶ" })
      .click();
    await page.getByRole("button", { name: "単語カード", exact: true }).click();
    await page.getByRole("button", { name: "カードを開始する" }).click();
    async function swipe(selector, index) {
      const box = await page.locator(selector).boundingBox();
      assert.ok(box);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      const dx = index % 3 === 0 ? 95 : index % 3 === 1 ? -95 : 0,
        dy = index % 3 === 2 ? -95 : 0;
      await page.mouse.move(
        box.x + box.width / 2 + dx,
        box.y + box.height / 2 + dy,
        { steps: 8 },
      );
      const transform = await page
        .locator(selector)
        .evaluate((el) => getComputedStyle(el).transform);
      assert.ok(!transform.includes("matrix3d"), "drag must stay in 2D");
      await page.mouse.up();
      await page.waitForTimeout(100);
      assert.equal(
        await page.locator(effects).count(),
        0,
        "no outgoing GPU surfaces in either session",
      );
    }
    for (let i = 0; i < 30; i++) {
      await page.locator("#activeFlashcard").tap();
      await swipe("#activeFlashcard", i);
      assert.equal(await page.evaluate(() => flashcardCurrentIndex), i + 1);
    }
    assert.equal(
      await page
        .locator("#activeFlashcard")
        .evaluate((el) => getComputedStyle(el).animationName),
      "none",
    );
    await page.evaluate(() => finishFlashcardSession());
    assert.ok(
      await page.evaluate(() =>
        Object.values(LearningData.read("ios-book")).some((w) =>
          Object.values(w.meanings || {}).some((m) =>
            ["ok", "so", "bad"].includes(m.status),
          ),
        ),
      ),
    );
    await page.evaluate(() => LoginWarmup.open());
    await page.locator(".flash-warmup-dialog[open]").waitFor();
    for (let i = 0; i < 10; i++) {
      await page.locator(".warmup-card").tap();
      await swipe(".warmup-card", i);
      assert.equal(
        await page.locator(".warmup-count").textContent(),
        i === 9 ? "準備完了！" : i + 2 + " / 10",
      );
    }
    assert.equal(await page.locator(".warmup-start-card").count(), 1);
    const diagnostic = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("__aiglish_startup_diagnostic")),
    );
    assert.equal(diagnostic.activity.kind, "warmup-swipe");
    assert.equal(
      diagnostic.ready,
      true,
      "runtime checkpoints must not pretend startup failed",
    );
    assert.equal(JSON.stringify(diagnostic).includes("ios-card-check"), false);
    assert.equal(
      await page.evaluate(() => __audioPlayers.length),
      1,
      "real sound reuses one media channel",
    );
    await page.locator(".warmup-start-card").tap();
    await page.locator(".flash-warmup-dialog").waitFor({ state: "detached" });
    await page.evaluate(() => AppStorage.flush());
    await page.reload();
    await page.waitForFunction(() => window.__learningBootReady);
    assert.ok(
      await page.evaluate(
        () => Object.keys(LearningData.read("ios-book")).length > 0,
      ),
    );
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("__aiglish_startup_diagnostic"))
            .previous.activity.kind,
      ),
      "warmup-swipe",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS " +
        type.name() +
        ": 30 ordinary + 10 warm-up trusted flips/drags with real sounds; flat 2D feedback, zero outgoing surfaces, START, ratings/reload and bounded runtime checkpoint",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
