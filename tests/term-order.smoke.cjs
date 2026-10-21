// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/term-order.smoke.cjs
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
    await page.waitForFunction(() => window.TermOrder && window.openTermOrder);
    await page.getByRole("button", { name: "ゲストとしてテストプレイ" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-vocab").click();
    await page.getByRole("button", { name: "＋ 単語帳を作る", exact: true }).click();
    await page.locator("#libraryBookName").fill("年代テスト");
    await page.locator("#libraryBookTermMode").check();
    await page.locator("#libraryBookWords").fill(
      ["1:織田信長:①1582 「本能寺の変」で死亡②1575「長篠の戦い」:", "2:源頼朝:1192 「鎌倉幕府」を開いた:", "3:徳川家康:①1603 江戸幕府を開いた②1600 関ヶ原の戦い:"].join("\n"),
    );
    await page.getByRole("button", { name: "単語帳を作る", exact: true }).click();
    await page.locator("#vocabLibraryBooks .textbook-list-item").filter({ hasText: "年代テスト" }).waitFor();
    // The study menu offers it only for books in 用語・年号モード.
    await page.getByRole("button", { name: "年代テストの学習方法を選ぶ" }).click();
    await page.getByRole("button", { name: "年代並べ替え", exact: true }).click();
    await page.locator(".term-order-screen .term-order-item").first().waitFor();
    for (let round = 0; round < 10; round++) {
      const items = page.locator(".term-order-screen .term-order-list button");
      assert.equal(await items.count(), 4);
      const years = await page.evaluate(() => {
        const heads = [...document.querySelectorAll(".term-order-list button")].map((b) => b.querySelector("span").textContent);
        const yearOf = { 本能寺の変で死亡: 1582, 長篠の戦い: 1575, 鎌倉幕府を開いた: 1192, 江戸幕府を開いた: 1603, 関ヶ原の戦い: 1600 };
        return heads.map((h) => yearOf[h]);
      });
      const order = years.map((y, i) => [y, i]).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
      // Round one: tap one wrong, take it back, then answer correctly. Round two: answer wrong.
      if (round === 0) {
        await items.nth(order[3]).click();
        assert.equal(await items.nth(order[3]).getAttribute("data-place"), "1");
        await items.nth(order[3]).click();
        assert.equal(await items.nth(order[3]).getAttribute("data-place"), "");
      }
      const taps = round === 1 ? order.slice().reverse() : order;
      assert.equal(await page.getByRole("button", { name: "判定する" }).isDisabled(), true);
      for (const i of taps) await items.nth(i).click();
      if (round === 0 && process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
      await page.getByRole("button", { name: "判定する" }).click();
      assert.equal(await page.locator(".term-order-verdict").textContent(), round === 1 ? "正しい順番" : "正解！");
      const shown = await page.locator(".is-judged .term-order-item em").allTextContents();
      assert.deepEqual(shown, years.slice().sort((a, b) => a - b).map((y) => y + "年"));
      if (round === 1) {
        assert.equal(await page.locator(".is-judged .is-wrong").count() > 0, true);
        if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT.replace(".png", "-judged.png") });
      }
      await page.getByRole("button", { name: round === 9 ? "結果を見る" : "次へ" }).click();
    }
    assert.equal(await page.locator(".term-order-score").textContent(), "9 / 10 問正解");
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    assert.equal(await page.locator(".term-order-screen").count(), 0);
    // Other books do not show it.
    await page.getByRole("button", { name: "＋ 単語帳を作る", exact: true }).click();
    await page.locator("#libraryBookName").fill("英単語");
    await page.locator("#libraryBookWords").fill("1:apple:りんご:");
    await page.getByRole("button", { name: "単語帳を作る", exact: true }).click();
    await page.getByRole("button", { name: "英単語の学習方法を選ぶ" }).click();
    assert.equal(await page.getByRole("button", { name: "年代並べ替え", exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    console.log("PASS: 年代並べ替え in the study menu of term-mode books only, tap order with take-back, judged with years, ten rounds and a score");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
