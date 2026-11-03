// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/vocab-reorder.smoke.cjs
// 並び替え: the word list has a mode with one short row per word; ▲▼ move a word one place, the
// grip drags it, the last move can be undone, the numbers are only handed on, and a word's
// rating and note stay with it.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }),
      errors = [];
    page.setDefaultTimeout(10000);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
    });
    await page.goto("http://127.0.0.1:8000");
    await page.waitForFunction(() => window.VocabReorder && window.VocabOrder);
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-vocab").click();
    await page.getByRole("button", { name: "＋ 単語帳を作る", exact: true }).click();
    await page.locator("#libraryBookName").fill("並び替えテスト");
    await page.locator("#libraryBookWords").fill("1:one:一:\n2:two:二:\n3:three:三:\n4:four:四:\n5:five:五:");
    await page.getByRole("button", { name: "単語帳を作る", exact: true }).click();
    await page.locator("#vocabLibraryBooks .textbook-list-item").filter({ hasText: "並び替えテスト" }).click();
    await page.locator("#vocabAddWord").waitFor({ state: "visible" });
    // "three" has a rating and a note that must stay with it.
    await page.evaluate(() => {
      const w = vocabList.find((x) => String(x.num) === "3");
      w.meanings[0].status = "ok";
      w.meanings[0].history = ["ok"];
      w.note = "三のメモ";
      saveVocabProgressLocally(3);
      __captureManualVocabDraft();
    });
    const order = () => page.evaluate(() => VocabOrder.sort(vocabList).map((w) => w.word + ":" + VocabOrder.no(w)).join(" "));
    const rows = () => page.locator("#vocabListContainer .vocab-reorder-row b").allInnerTexts();
    const row = (word) => page.locator("#vocabListContainer .vocab-reorder-row").filter({ has: page.locator("b", { hasText: new RegExp("^" + word + "$") }) });
    const button = page.locator("#vocabReorderButton");

    // The button is there for the owner of the book; the normal cards come back when it is left.
    await button.waitFor({ state: "visible" });
    assert.equal(await page.locator("#vocabListContainer .word-row-container").count(), 5);
    await button.click();
    assert.equal(await button.getAttribute("aria-pressed"), "true");
    assert.deepEqual(await rows(), ["one", "two", "three", "four", "five"]);
    assert.equal(await page.locator("#vocabListContainer .word-row-container").count(), 0);
    assert.equal(await row("one").locator(".is-up").isDisabled(), true);
    assert.equal(await row("five").locator(".is-down").isDisabled(), true);

    // ▼ and ▲ move one place; the numbers only change hands.
    await row("one").locator(".is-down").click();
    assert.deepEqual(await rows(), ["two", "one", "three", "four", "five"]);
    assert.equal(await order(), "two:1 one:2 three:3 four:4 five:5");
    await page.locator(".vocab-reorder-status", { hasText: "「one」を 2 番に動かしました。" }).waitFor();
    // The same button stays under the finger for the next move.
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "「one」を1つ下へ");
    await row("five").locator(".is-up").click();
    assert.equal(await order(), "two:1 one:2 three:3 five:4 four:5");
    // Undo puts back the last move only.
    await page.getByRole("button", { name: "元に戻す" }).click();
    assert.equal(await order(), "two:1 one:2 three:3 four:4 five:5");
    assert.equal(await page.getByRole("button", { name: "元に戻す" }).count(), 0);

    // Dragging the grip of "four" up between "two" and "one".
    const grip = row("four").locator(".vocab-reorder-grip"),
      target = await row("one").boundingBox(),
      from = await grip.boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 10, target.y + 4, { steps: 6 });
    await page.locator(".vocab-reorder-row.is-drop-before").waitFor();
    await page.mouse.up();
    assert.equal(await order(), "two:1 four:2 one:3 three:4 five:5");
    // Dropping where it already is changes nothing.
    const again = await row("four").locator(".vocab-reorder-grip").boundingBox();
    await page.mouse.move(again.x + 5, again.y + 5);
    await page.mouse.down();
    await page.mouse.move(again.x + 5, again.y + 8, { steps: 3 });
    await page.mouse.up();
    assert.equal(await order(), "two:1 four:2 one:3 three:4 five:5");
    // Keys on the grip move it too.
    await row("five").locator(".vocab-reorder-grip").focus();
    await page.keyboard.press("ArrowUp");
    assert.equal(await order(), "two:1 four:2 one:3 five:4 three:5");

    // Leaving the mode shows the cards in the new order, with the rating and note on "three".
    await button.click();
    assert.equal(await button.getAttribute("aria-pressed"), "false");
    const cards = await page.locator("#vocabListContainer .word-row-container .word-main-line span:nth-child(2)").allInnerTexts();
    assert.match(cards.join(" "), /two.*four.*one.*five.*three/);
    const three = await page.evaluate(() => {
      const w = vocabList.find((x) => String(x.num) === "3");
      return [w.meanings[0].status, w.note, VocabOrder.no(w)];
    });
    assert.deepEqual(three, ["ok", "三のメモ", 5]);
    // The order is saved: it is still there after the list is read back from this device.
    await page.reload();
    await page.waitForFunction(() => window.VocabReorder);
    const guest = page.getByRole("button", { name: "ゲストで試す" });
    if (await guest.isVisible().catch(() => false)) await guest.click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-vocab").click();
    await page.locator("#vocabLibraryBooks .textbook-list-item").filter({ hasText: "並び替えテスト" }).click();
    await page.locator("#vocabAddWord").waitFor({ state: "visible" });
    assert.equal(await order(), "two:1 four:2 one:3 five:4 three:5");
    // A word added after a move: the move can no longer be undone (it would take that word's number),
    // and the added word keeps the number it has.
    await button.click();
    await row("two").locator(".is-down").click();
    await page.getByRole("button", { name: "元に戻す" }).waitFor();
    await page.evaluate(() => {
      vocabList.push({ num: 99, no: 3, word: "added", meaning: "追加", meanings: [{ id: "99-0", text: "追加", status: "none", history: [] }] });
      renderVocabList();
    });
    assert.equal(await page.getByRole("button", { name: "元に戻す" }).count(), 0);
    assert.equal(await page.evaluate(() => VocabOrder.no(vocabList.find((w) => w.num === 99))), 3);
    assert.deepEqual(errors, []);
    console.log("PASS: reorder mode with ▲▼, drag, keys and undo; numbers only handed on; rating and note stay; order saved");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
