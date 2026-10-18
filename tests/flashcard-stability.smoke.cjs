const { chromium, webkit } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const useWebkit = process.env.BROWSER === "webkit";
  const browser = await (useWebkit ? webkit : chromium).launch(
    useWebkit
      ? { executablePath: process.env.WEBKIT_EXECUTABLE_PATH }
      : { executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] },
  );
  try {
    const page = await browser.newPage({
      viewport: { width: 393, height: 852 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() =>
      localStorage.setItem("b3_tutorial_done", "1"),
    );
    await page.goto("http://127.0.0.1:8000");
    await page
      .getByRole("button", { name: "ゲストとしてテストプレイ" })
      .click();
    await page.waitForFunction(() => window.__learningBootReady);
    await page.evaluate(() => {
      textbooksPool = [{ id: "stress-book", name: "連続操作確認" }];
      textbooksCacheMap["stress-book"] = Array.from(
        { length: 2000 },
        (_, i) => ({ num: i + 1, word: "word" + i, meaning: "意味" + i }),
      );
      switchTab("vocab");
      showVocabLibrarySelection();
    });
    await page
      .getByRole("button", { name: "連続操作確認の学習方法を選ぶ" })
      .click();
    await page.getByRole("button", { name: "単語カード", exact: true }).click();
    await page.getByRole("button", { name: "カードを開始する" }).click();
    await page.locator("#activeFlashcard").waitFor({ state: "visible" });
    await page.evaluate(() => {
      window.__stressCaptures = 0;
      const capture = window.__captureManualVocabDraft;
      window.__captureManualVocabDraft = function (...args) {
        window.__stressCaptures++;
        return capture?.apply(this, args);
      };
    });
    for (let batch = 0; batch < 10; batch++) {
      const state = await page.evaluate(() => {
        for (let i = 0; i < 10; i++) {
          const card = document.getElementById("activeFlashcard");
          card.click();
          const rotator = card.querySelector(".flashcard-inner-rotator");
          if (getComputedStyle(rotator).transform !== "none")
            throw Error("3D flip returned");
          const visible = [...rotator.children].filter(
            (f) => getComputedStyle(f).visibility === "visible",
          );
          if (visible.length !== 1) throw Error("overlapping card faces");
          swipeFlashcard(i % 2 ? "left" : "right", 90, 0);
          if (document.querySelectorAll("#flashcardGhost").length !== 1)
            throw Error("outgoing cards accumulate");
          if (
            document.querySelectorAll(
              "#flashcardGhost .flashcard-inner-rotator > *",
            ).length !== 1
          )
            throw Error("ghost clones both faces");
        }
        return {
          index: flashcardCurrentIndex,
          captures: window.__stressCaptures,
          effects: document.querySelectorAll(
            "#flashcardGhost,.flashcard-post-ripple,.fc-vanish-burst",
          ).length,
        };
      });
      assert.equal(state.index, (batch + 1) * 10);
      assert.equal(state.captures, 0);
      assert.ok(state.effects <= 3);
      await page.waitForTimeout(30);
    }
    await page.evaluate(() => goBackFlashcard());
    assert.equal(await page.evaluate(() => flashcardCurrentIndex), 99);
    assert.equal(await page.evaluate(() => window.__stressCaptures), 0);
    assert.ok(
      await page.evaluate(() =>
        vocabList.some(
          (v) =>
            v.meanings?.some((m) => m.status === "ok" || m.status === "bad") ||
            v.history === "ok" ||
            v.history === "bad",
        ),
      ),
    );
    await page.waitForTimeout(1100);
    assert.equal(
      await page
        .locator("#flashcardGhost,.flashcard-post-ripple,.fc-vanish-burst")
        .count(),
      0,
    );
    await page.evaluate(() => finishFlashcardSession());
    assert.ok((await page.evaluate(() => window.__stressCaptures)) > 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: 2,000-word book, 100 flips/swipes, bounded single-face effects, no whole-book capture during play, undo and end capture preserved (" +
        (useWebkit ? "WebKit" : "Chromium") +
        ")",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
