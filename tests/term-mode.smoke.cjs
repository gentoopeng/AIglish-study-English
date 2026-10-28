// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/term-mode.smoke.cjs
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
    await page.waitForFunction(() => window.TermQuestions && window.TermProgress && window.VocabWordEntry);
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-vocab").click();
    // A book in 用語・年号モード.
    await page.getByRole("button", { name: "＋ 単語帳を作る", exact: true }).click();
    await page.locator("#libraryBookName").fill("日本史");
    await page.locator("#libraryBookTermMode").check();
    await page.locator("#libraryBookWords").fill("1:織田信長:①1582 「本能寺の変」で死亡したとされる人物②1575「長篠の戦い」では「武田勝頼」を破った:");
    await page.getByRole("button", { name: "単語帳を作る", exact: true }).click();
    await page.locator("#vocabLibraryBooks .textbook-list-item").filter({ hasText: "日本史" }).click();
    await page.locator("#vocabAddWord").waitFor({ state: "visible" });
    const book = await page.evaluate(() => currentTextbook);
    assert.equal(await page.evaluate((b) => TermProgress.enabled(b), book), true);
    // The add form has a digits-only year box per line; the year is written at the start of the line.
    await page.locator("#vocabAddWord").click();
    assert.equal(await page.locator(".vocab-entry-dialog.is-term-mode").count(), 1);
    await page.locator("#vocabEntryWord").fill("源頼朝");
    const year = page.getByLabel("説明 1 の年号");
    await year.pressSequentially("１１a9b2");
    assert.equal(await year.inputValue(), "1192");
    await page.getByRole("textbox", { name: "説明 1", exact: true }).fill("「鎌倉幕府」を開いた");
    await page.getByRole("button", { name: "追加する", exact: true }).click();
    await page.locator(".vocab-entry-dialog").waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => vocabList.find((w) => w.word === "源頼朝").meanings[0].text), "1192 「鎌倉幕府」を開いた");
    // Flashcards: every generated question becomes a card; year cards are answered by typing.
    await page.evaluate(() => {
      window.switchTab("vocab");
      window.showVocabLibrarySelection();
    });
    await page.getByRole("button", { name: "日本史の学習方法を選ぶ" }).click();
    await page.getByRole("button", { name: "単語カード", exact: true }).click();
    await page.getByRole("button", { name: "カードを開始する" }).click();
    await page.waitForFunction(() => flashcardOriginQueue.length > 0 && document.getElementById("activeFlashcard"));
    const queue = await page.evaluate(() => flashcardOriginQueue.map((q) => [q.termKey, q.en, q.ja, q.termInput]).sort());
    // 織田信長 has two lines: a whole card for each, as one card per meaning in the normal mode.
    assert.equal(queue.length, 10);
    assert.deepEqual(
      // A 「」 card: only the term on the front; the headword and the rest of the line behind.
      queue.filter((q) => q[0].startsWith("t:")).map((q) => q[1]).sort(),
      ["本能寺の変", "武田勝頼", "鎌倉幕府", "長篠の戦い"].sort(),
    );
    assert.deepEqual(
      queue.filter((q) => q[0].startsWith("t:")).map((q) => q[2]).sort(),
      ["源頼朝　1192年\nを開いた", "織田信長　1575年\nでは武田勝頼を破った", "織田信長　1575年\n長篠の戦いではを破った", "織田信長　1582年\nで死亡したとされる人物"].sort(),
    );
    // The whole-entry card follows the chosen direction (英→日 by default: the headword first);
    // blank and year cards always show the question first.
    assert.deepEqual(
      queue.filter((q) => q[0].startsWith("w") && q[1] === "織田信長").map((q) => q[2]).sort(),
      ["1575年 長篠の戦いでは武田勝頼を破った", "1582年 本能寺の変で死亡したとされる人物"],
    );
    const fronts = await page.evaluate(async () => {
      const seen = {};
      const start = flashcardCurrentIndex;
      for (const kind of ["w", "t:", "y:"]) {
        flashcardCurrentIndex = flashcardOriginQueue.findIndex((q) => q.termKey.startsWith(kind) && (kind !== "w" || q.en === "織田信長"));
        window.renderFlashcardDeck();
        seen[kind] = document.querySelector("#activeFlashcard .flashcard-face-front").textContent;
      }
      flashcardDirectionMode = "ja2en";
      flashcardCurrentIndex = flashcardOriginQueue.findIndex((q) => q.termKey === "w:" + q.meaningId && q.en === "織田信長" && q.ja.startsWith("1582"));
      window.renderFlashcardDeck();
      seen.wReverse = document.querySelector("#activeFlashcard .flashcard-face-front").textContent;
      flashcardDirectionMode = "en2ja";
      flashcardCurrentIndex = start;
      window.renderFlashcardDeck();
      return seen;
    });
    assert.match(fronts.w, /織田信長/);
    assert.doesNotMatch(fronts.w, /本能寺/);
    assert.doesNotMatch(fronts["t:"], /織田信長|源頼朝|（＿＿）/);
    assert.match(fronts["y:"], /（何年？）/);
    assert.match(fronts.wReverse, /本能寺の変/);
    assert.deepEqual(queue.filter((q) => q[3]).map((q) => q[2]).sort(), ["1192", "1575", "1582"]);
    // Answer every card: year cards typed (the first wrong, the rest right), others swiped ○.
    let wrongYear = null;
    for (let i = 0; i < 10; i++) {
      const item = await page.evaluate(() => {
        const q = flashcardOriginQueue[flashcardCurrentIndex];
        return { key: q.termKey, answer: q.ja, input: q.termInput, front: document.querySelector("#activeFlashcard .flashcard-face-front").textContent };
      });
      assert.ok(item.front.length > 0);
      if (item.input) {
        assert.equal(await page.locator(".term-answer-panel").isVisible(), true);
        const box = page.locator("#termYearInput");
        if (!wrongYear) {
          wrongYear = item;
          await box.fill("1");
          await page.locator(".term-answer-panel button").click();
          assert.equal(await page.locator(".term-answer-panel p").textContent(), "正解は " + item.answer + " 年");
        } else {
          await box.fill(item.answer);
          await page.locator(".term-answer-panel button").click();
          assert.equal(await page.locator(".term-answer-panel p").textContent(), "正解！");
        }
        assert.equal(await page.locator("#activeFlashcard.flipped").count(), 1);
        await page.waitForFunction((index) => flashcardCurrentIndex > index, i, { timeout: 4000 });
      } else {
        assert.equal(await page.locator(".term-answer-panel").isVisible(), false);
        await page.evaluate(() => window.swipeFlashcard("right", 0, 0));
      }
    }
    const results = await page.evaluate((b) => TermProgress.read(b), book);
    const nobunaga = await page.evaluate(() => String(vocabList.find((w) => w.word === "織田信長").num));
    assert.equal(results[nobunaga]["t:" + nobunaga + "-0:0"].status, "ok");
    const wrongNum = Object.keys(results).find((num) => results[num][wrongYear.key]);
    assert.equal(results[wrongNum][wrongYear.key].status, "bad");
    // The line a question came from also gets the normal rating (word-level understanding).
    const lines = await page.evaluate((b) => LearningData.read(b), book);
    assert.ok(Object.values(lines[nobunaga].meanings).some((m) => (m.history || []).length));
    // Word list: the year and each 「」 term carry a light marker coloured by their results.
    await page.waitForFunction(() => document.getElementById("activeFlashcard") === null || getComputedStyle(document.getElementById("flashcard-play-screen")).display === "none", null, { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => {
      document.getElementById("flashcard-play-screen").style.display = "none";
      window.switchTab("vocab");
      // Adding a word searched for it; show the whole book again.
      document.getElementById("vocabSearchInput").value = "";
      window.renderVocabList();
    });
    const marks = await page.evaluate(() =>
      [...document.querySelectorAll("#vocabListContainer mark.term-mark")].map((m) => [m.textContent, m.classList.contains("is-rated"), m.style.getPropertyValue("--mark"), m.dataset.termHistory]),
    );
    assert.ok(marks.some(([text, rated, tone, history]) => text === "本能寺の変" && rated && tone === "16,185,129" && history === "○"), JSON.stringify(marks));
    assert.ok(marks.some(([text, rated, tone, history]) => text === wrongYear.answer && rated && tone === "239,68,68" && history === "×"), JSON.stringify(marks));
    // The 「」 are not shown on the card, only the marked term.
    const cardText = await page.evaluate(() => [...document.querySelectorAll("#vocabListContainer .vocab-meaning-text")].map((e) => e.textContent).join(" "));
    assert.ok(cardText.includes("本能寺の変") && !/[「」]/.test(cardText), cardText);
    // Question text keeps the headword, a year and the blank whole, and lines apart.
    const shown = await page.evaluate(() => {
      const box = document.createElement("div");
      box.style.cssText = "width:120px;font-size:20px";
      document.body.append(box);
      window.TermQuestions.show(box, "織田信長　1582年　（＿＿）で死亡したとされる人物\n1575年 長篠の戦い");
      const keeps = [...box.querySelectorAll(".term-keep")].map((k) => [k.textContent, k.getClientRects().length]);
      const brs = box.querySelectorAll("br").length;
      box.remove();
      return { keeps, brs };
    });
    assert.deepEqual(shown, { keeps: [["織田信長", 1], ["1582年", 1], ["（＿＿）", 1], ["1575年", 1]], brs: 1 });
    await page.evaluate(() => document.querySelector("#vocabListContainer mark.term-mark.is-rated").click());
    // The pencil editor has a digits-only year box per line, filled from the start of the line.
    // Messages use the app's dialog: close any left from finishing the deck, and after saving.
    const closeMessages = () =>
      page.evaluate(async () => {
        for (let i = 0; i < 5 && document.querySelector("dialog.app-alert"); i++) {
          document.querySelector("dialog.app-alert button").click();
          await new Promise((r) => setTimeout(r, 50));
        }
      });
    await closeMessages();
    await page.locator("#vocabLibraryBooks .textbook-list-item").filter({ hasText: "日本史" }).click();
    await page.evaluate(() => {
      document.getElementById("vocabSearchInput").value = "";
      window.renderVocabList();
    });
    await page.locator(`.word-row-container[data-word-num="${nobunaga}"] .card-edit-btn`).click();
    const years = page.locator(`#inlineEditMeaningsList-${nobunaga} .inline-year-input`);
    assert.deepEqual(await years.evaluateAll((list) => list.map((e) => e.value)), ["1582", "1575"]);
    assert.equal(await page.locator(`.inline-m-input-${nobunaga}`).first().inputValue(), "「本能寺の変」で死亡したとされる人物");
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
    await years.first().fill("");
    await years.first().pressSequentially("１５a83");
    assert.equal(await years.first().inputValue(), "1583");
    await page.locator(`#wordCardForm-${nobunaga}`).getByRole("button", { name: "保存する", exact: true }).click();
    assert.equal(await page.locator("dialog.app-alert p").innerText(), "単語情報を更新しました。");
    await closeMessages();
    assert.equal(
      await page.evaluate((n) => vocabList.find((w) => String(w.num) === n).meanings[0].text, nobunaga),
      "1583 「本能寺の変」で死亡したとされる人物",
    );
    // A meaning may run over two lines: Enter in its box adds a line break (empty lines and
    // stray spaces dropped), and the list shows the two lines.
    await page.locator(`.word-row-container[data-word-num="${nobunaga}"] .card-edit-btn`).click();
    const second = page.locator(`.inline-m-input-${nobunaga}`).nth(1);
    await second.fill("「長篠の戦い」では  ");
    await second.press("End");
    await second.press("Enter");
    await second.press("Enter");
    await second.pressSequentially("武田勝頼を破った");
    assert.ok((await second.evaluate((e) => e.clientHeight)) > 40);
    await page.locator(`#wordCardForm-${nobunaga}`).getByRole("button", { name: "保存する", exact: true }).click();
    await closeMessages();
    assert.equal(
      await page.evaluate((n) => vocabList.find((w) => String(w.num) === n).meanings[1].text, nobunaga),
      "1575 「長篠の戦い」では\n武田勝頼を破った",
    );
    const twoLines = await page.locator(`.word-row-container[data-word-num="${nobunaga}"] .vocab-meaning-text`).nth(1).evaluate((e) => [e.innerText, getComputedStyle(e).whiteSpace]);
    assert.match(twoLines[0], /では\n武田勝頼/);
    assert.equal(twoLines[1], "pre-line");
    // Books without the mode are unaffected: cards are the plain word/meaning pairs.
    assert.equal(await page.evaluate(() => TermProgress.enabled("no-such-book")), false);
    assert.deepEqual(errors, []);
    console.log("PASS: term-mode book, digits-only year box, whole/year/blank questions from one entry, typed years right and wrong, per-question results and line ratings, coloured markers");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
