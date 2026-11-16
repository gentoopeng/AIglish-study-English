// 用語・年号モード: the 年・世紀・時代 box in the add / 差し込む form (the year goes to the start of the line), a span of years
// (1467〜1477) as a year, typed in two boxes on the card, and the same box in the list's editor.
const { chromium } = require("playwright"), assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }), errors = [];
    page.setDefaultTimeout(10000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => { localStorage.setItem("b3_tutorial_done", "1"); localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false })); });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true && window.TermQuestions && window.VocabWordEntry);
    await page.locator("#nav-vocab").click();
    await page.getByRole("button", { name: "＋ 単語帳を作る", exact: true }).click();
    await page.locator("#libraryBookName").fill("日本史");
    await page.locator("#libraryBookTermMode").check();
    await page.locator("#libraryBookWords").fill("1:織田信長:1582 「本能寺の変」で死亡した:\n2:徳川家康:1603 「江戸幕府」を開いた:");
    await page.getByRole("button", { name: "単語帳を作る", exact: true }).click();
    await page.locator("#vocabLibraryBooks .textbook-list-item").filter({ hasText: "日本史" }).click();
    await page.locator("#vocabAddWord").waitFor({ state: "visible" });
    await page.evaluate(() => window.renderVocabList());

    // 差し込む: the form has the box; a span of years typed there goes to the start of the line.
    await page.getByRole("button", { name: "#1 織田信長 の次に単語を追加" }).click();
    const dialog = page.locator("dialog.vocab-entry-dialog[open]");
    await dialog.waitFor();
    assert.equal(await dialog.locator("#vocabEntryTitle").innerText(), "単語を差し込む");
    const year = dialog.getByRole("textbox", { name: "説明1 の年・世紀・時代" });
    await year.waitFor();
    await dialog.locator("#vocabEntryWord").fill("応仁の乱");
    await dialog.getByRole("textbox", { name: "説明 1", exact: true }).fill("「京都」で起きた戦乱");
    // Something that is no year is marked, and refused when adding.
    await year.fill("むかし");
    assert.equal(await year.evaluate((e) => e.classList.contains("is-invalid")), true);
    await dialog.getByRole("button", { name: "追加する", exact: true }).click();
    assert.match(await dialog.locator("[role=alert]").first().innerText(), /1467〜1477/);
    await year.fill("１４６７-1477年");
    await year.blur();
    assert.equal(await year.inputValue(), "1467〜1477", "written one way");
    assert.match(await dialog.locator(".vocab-entry-preview").innerText(), /何年から何年？[\s\S]*1467〜1477/);
    await dialog.getByRole("button", { name: "追加する", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    assert.deepEqual(await page.evaluate(() => vocabList.slice().sort((a, b) => VocabOrder.no(a) - VocabOrder.no(b)).map((w) => [VocabOrder.no(w), w.word, w.meanings[0].text])), [[1, "織田信長", "1582 「本能寺の変」で死亡した"], [2, "応仁の乱", "1467〜1477 「京都」で起きた戦乱"], [3, "徳川家康", "1603 「江戸幕府」を開いた"]]);

    // 追加 has the box too (a century, here).
    await page.locator("#vocabAddWord").click();
    await dialog.waitFor();
    await dialog.locator("#vocabEntryWord").fill("平氏");
    await dialog.getByRole("textbox", { name: "説明1 の年・世紀・時代" }).fill("12世紀");
    await dialog.getByRole("textbox", { name: "説明 1", exact: true }).fill("政権をにぎった");
    await dialog.getByRole("button", { name: "追加する", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => vocabList.find((w) => w.word === "平氏").meanings[0].text), "12世紀 政権をにぎった");

    // The card: a span is typed in two boxes; one year alone is not enough, both right is right.
    await page.evaluate(() => { window.switchTab("vocab"); window.showVocabLibrarySelection(); });
    await page.getByRole("button", { name: "日本史の学習方法を選ぶ" }).click();
    await page.getByRole("button", { name: "単語カード", exact: true }).click();
    await page.getByRole("button", { name: "カードを開始する" }).click();
    await page.waitForFunction(() => flashcardOriginQueue.length > 0 && document.getElementById("activeFlashcard"));
    await page.evaluate(() => {
      const at = flashcardOriginQueue.findIndex((q) => q.termInput && /〜/.test(q.ja));
      flashcardOriginQueue = [flashcardOriginQueue[at], ...flashcardOriginQueue.filter((_, i) => i !== at)];
      flashcardCurrentIndex = 0;
      window.renderFlashcardDeck();
    });
    const panel = page.locator(".term-answer-panel");
    await panel.waitFor();
    assert.match(await panel.locator("label").innerText(), /何年から何年/);
    assert.equal(await page.locator("#termYearInputEnd").isVisible(), true);
    await page.locator("#termYearInput").fill("1467");
    await panel.getByRole("button", { name: "答える" }).click();
    assert.match(await panel.locator("p").innerText(), /始まりと終わりの年/);
    await page.locator("#termYearInputEnd").fill("1477");
    await panel.getByRole("button", { name: "答える" }).click();
    assert.match(await panel.locator("p").innerText(), /正解！/);
    // The next year question (one year) has one box again.
    await page.waitForFunction(() => !document.querySelector(".term-answer-panel").dataset.result || true);
    await page.waitForTimeout(1200);
    await page.evaluate(() => { flashcardCurrentIndex = flashcardOriginQueue.findIndex((q) => q.termInput && !/〜/.test(q.ja) && q.termUnit !== "世紀"); window.renderFlashcardDeck(); });
    await page.waitForFunction(() => document.getElementById("termYearInputEnd").hidden === true);
    assert.deepEqual(errors, []);
    console.log("term year range smoke passed");
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
