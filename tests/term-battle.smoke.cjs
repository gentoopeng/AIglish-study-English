// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/term-battle.smoke.cjs
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }),
      errors = [];
    page.setDefaultTimeout(10000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
    });
    await page.goto("http://127.0.0.1:8000");
    await page.waitForFunction(() => window.TermQuestions && window.TermProgress && window.BattleLobby);
    await page.getByRole("button", { name: "ゲストとしてテストプレイ" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-vocab").click();
    await page.getByRole("button", { name: "＋ 単語帳を作る", exact: true }).click();
    await page.locator("#libraryBookName").fill("日本史バトル");
    await page.locator("#libraryBookTermMode").check();
    const lines = Array.from({ length: 12 }, (_, i) => i + 1 + ":人物" + i + ":" + (1500 + (i % 4)) + " 「出来事" + i + "」で「相手" + i + "」を破った:");
    await page.locator("#libraryBookWords").fill(lines.join("\n"));
    await page.getByRole("button", { name: "単語帳を作る", exact: true }).click();
    await page.locator("#vocabLibraryBooks .textbook-list-item").filter({ hasText: "日本史バトル" }).click();
    await page.locator("#vocabAddWord").waitFor({ state: "visible" });
    const book = await page.evaluate(() => currentTextbook);
    // Every year question was answered ○ before; a wrong battle answer drops it to ×.
    const answers = await page.evaluate((b) => {
      const map = {};
      for (const w of vocabList)
        for (const q of TermQuestions.questions(w)) {
          map[q.prompt] = { answer: q.answer, kind: q.kind, key: q.key, num: String(w.num) };
          if (q.kind === "year") TermProgress.save(b, w.num, q.key, "ok");
        }
      return map;
    }, book);
    await page.locator("#nav-battle").click();
    await page.locator(".mode-casual").click();
    await page.locator("[data-battle-route=solo]").click();
    await page.locator(`.battle-book-picker input[value="${book}"]`).check();
    const others = page.locator(`.battle-book-picker input:checked:not([value="${book}"])`);
    for (let i = await others.count(); i > 0; i--) await others.first().uncheck();
    const pool = await page.evaluate(() => BattleLobby.words(document.querySelector("#wordDuelScreen"), 9));
    assert.equal(pool.pool.length, 48);
    assert.deepEqual([...new Set(pool.pool.map((w) => w.kind))].sort(), ["blank", "whole", "year"]);
    assert.ok(pool.pool.every((w) => w.ref.term));
    await page.locator("[data-duel-solo]").click();
    await page.locator(".duel-prompt").waitFor();
    const terms = new Set(Object.values(answers).filter((a) => a.kind === "blank").map((a) => a.answer)),
      heads = new Set(Object.values(answers).filter((a) => a.kind === "whole").map((a) => a.answer));
    const seen = { whole: 0, blank: 0, yearWrong: null, yearRight: 0 };
    for (let n = 0; n < 40 && !(seen.whole && seen.blank && seen.yearWrong && seen.yearRight); n++) {
      await page.waitForFunction(() => document.querySelector(".duel-options button:not(:disabled), .duel-typed input:not(:disabled)"));
      const prompt = await page.locator(".duel-prompt").textContent(),
        item = answers[prompt];
      assert.ok(item, prompt);
      assert.equal(await page.locator(".duel-prompt.is-term").count(), 1);
      if (item.kind === "year") {
        const box = page.locator(".duel-typed input");
        if (process.env.SHOT && !seen.yearWrong) await page.screenshot({ path: process.env.SHOT });
        await box.pressSequentially("1a5");
        assert.equal(await box.inputValue(), "15");
        if (!seen.yearWrong) {
          await box.fill("1");
          await page.locator(".duel-typed button").click();
          await page.locator(".duel-correction").waitFor({ state: "visible" });
          assert.equal(await page.locator(".duel-correction strong").textContent(), item.answer + "年");
          assert.equal(await page.locator(".duel-typed input.is-wrong").count(), 1);
          seen.yearWrong = item;
          await page.waitForTimeout(3100);
          await page.locator("[data-duel-next]").click();
        } else {
          await box.fill(item.answer);
          await page.locator(".duel-typed button").click();
          seen.yearRight++;
          await page.waitForFunction((p) => document.querySelector(".duel-prompt").textContent !== p, prompt);
        }
        continue;
      }
      const texts = await page.locator(".duel-options button").allTextContents(),
        choices = texts.slice(0, 9);
      assert.ok(choices.every((text) => (item.kind === "blank" ? terms : heads).has(text)), JSON.stringify(texts));
      seen[item.kind]++;
      const at = choices.indexOf(item.answer);
      await page.locator(".duel-options button").nth(at < 0 ? 9 : at).click();
      await page.waitForFunction((p) => document.querySelector(".duel-prompt").textContent !== p, prompt);
    }
    assert.ok(seen.whole && seen.blank && seen.yearWrong && seen.yearRight, JSON.stringify(seen));
    const store = await page.evaluate((b) => TermProgress.read(b), book);
    assert.equal(store[seen.yearWrong.num][seen.yearWrong.key].status, "bad");
    // Right answers leave the records as they were.
    const untouched = Object.values(answers).filter((a) => a.kind === "blank");
    assert.ok(untouched.every((a) => !store[a.num]?.[a.key]));
    assert.deepEqual(errors, []);
    console.log("PASS: term-mode battle pool (whole/blank/year), same-kind choices, digits-only typed years right and wrong, the correct year shown, a ○ year answered wrong drops to ×");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
