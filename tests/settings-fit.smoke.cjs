// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/settings-fit.smoke.cjs
// The settings screens fit one phone screen (390x740) without scrolling: the whole-app settings
// (three groups: サウンド, 単語の読み上げ, AI取り込み), the card study settings of a book, and the add-word form
// (also with its extra settings open, and with a second meaning). Every control keeps its id.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 740 } }),
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
    await page.waitForFunction(() => window.__learningBootReady === true);
    const fits = (selector) =>
      page.evaluate((s) => {
        const d = document.querySelector(s),
          r = d.getBoundingClientRect();
        return { fits: d.scrollHeight <= d.clientHeight + 2, inside: r.top >= 0 && r.bottom <= innerHeight, wide: d.scrollWidth <= d.clientWidth + 1 };
      }, selector);
    const ok = (result, name) => assert.deepEqual([result.fits, result.inside, result.wide], [true, true, true], name + " " + JSON.stringify(result));

    // The whole-app settings: three groups, every control still there, the key row on one line.
    await page.evaluate(() => window.openSettingsDialog());
    await page.locator("#settingsDialog[open]").waitFor();
    assert.deepEqual(await page.locator("#settingsDialog .settings-group-title").allInnerTexts(), ["サウンド", "単語の読み上げ", "AI取り込み"]);
    for (const id of ["musicEnabled", "musicVolume", "musicTrack", "soundEnabled", "soundVolume", "pronounceEnabled", "pronounceAuto", "pronounceRate", "pronounceAccent", "pronounceTest", "handsFreeAnswerDelay", "sidebarApiKeyInput"])
      assert.equal(await page.locator("#" + id).count(), 1, id);
    ok(await fits("#settingsDialog"), "settings");
    const keyRow = await page.evaluate(() => {
      const input = document.getElementById("sidebarApiKeyInput").getBoundingClientRect(),
        button = [...document.querySelectorAll("#settingsDialog button")].find((b) => b.textContent.trim() === "APIキーを保存").getBoundingClientRect();
      return Math.abs(input.top + input.height / 2 - (button.top + button.height / 2)) < 4;
    });
    assert.equal(keyRow, true);
    await page.evaluate(() => document.getElementById("settingsDialog").close());

    // A book: its card study settings and the add-word form.
    await page.locator("#nav-vocab").click();
    await page.getByRole("button", { name: "＋ 単語帳を作る", exact: true }).click();
    await page.locator("#libraryBookName").fill("収まりの確認");
    await page.locator("#libraryBookWords").fill("1:one:一:\n2:two:二:");
    await page.getByRole("button", { name: "単語帳を作る", exact: true }).click();
    await page.locator("#vocabLibraryBooks .textbook-list-item").filter({ hasText: "収まりの確認" }).click();
    await page.locator("#vocabAddWord").waitFor({ state: "visible" });
    const book = await page.evaluate(() => currentTextbook);
    await page.evaluate((b) => window.openBookFlashcardSettings(b), book);
    await page.locator("dialog.book-flashcard-dialog[open]").waitFor();
    // No numbering; the fields in a column; the book's name is the title (no second pick of a book).
    assert.deepEqual(await page.locator(".flashcard-setup .flashcard-setup-field > span").allInnerTexts().then((list) => list.filter(Boolean)), ["教材", "最初に出す面", "出題範囲", "出す理解度"]);
    assert.equal(await page.locator("#flashcardSourceSelect").isVisible(), false);
    assert.equal(await page.locator("dialog.book-flashcard-dialog h2").first().innerText(), "収まりの確認");
    assert.doesNotMatch(await page.locator("#flashcard-setup-screen").innerText(), /①|②|③/);
    ok(await fits("dialog.book-flashcard-dialog"), "card settings");
    await page.getByRole("button", { name: "裏：意味を先に" }).click();
    assert.equal(await page.locator("#btnCardJa2en.active").count(), 1);
    await page.getByRole("button", { name: "戻る" }).click();

    await page.locator("#vocabAddWord").click();
    await page.locator(".vocab-entry-dialog").waitFor();
    ok(await fits(".vocab-entry-dialog"), "add word");
    await page.getByText("サブ情報・番号・単元を設定", { exact: true }).click();
    // 単元 and 単語番号 sit side by side.
    const pair = await page.evaluate(() => {
      const unit = document.getElementById("vocabEntryUnit").getBoundingClientRect(),
        no = document.getElementById("vocabEntryNumber").getBoundingClientRect();
      return Math.abs(unit.top - no.top) < 2 && unit.right < no.left;
    });
    assert.equal(pair, true);
    ok(await fits(".vocab-entry-dialog"), "add word with the extra settings");
    await page.getByRole("button", { name: "＋ 意味を追加" }).click();
    ok(await fits(".vocab-entry-dialog"), "add word with a second meaning");
    assert.deepEqual(errors, []);
    console.log("PASS: settings fit one screen without scrolling: the app settings (three groups), a book's card study settings (no numbering), and the add-word form (also with its extra settings and a second meaning)");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
