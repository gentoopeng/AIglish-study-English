// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/poker-practice.smoke.cjs
// Poker practice against the computer (no points, guests too) and the animated how-to.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const base = process.env.APP_URL || "http://127.0.0.1:8000";
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
    });
    await page.goto(base);
    await page.getByRole("button", { name: "ゲストとしてテストプレイ" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    const points = await page.evaluate(() => window.StudyPoints.balance());
    // The first visit opens the how-to: seven scenes, ending with practice.
    await page.evaluate(() => window.Poker.open());
    const tutorial = page.locator("dialog.pk-tutorial[open]");
    await tutorial.waitFor();
    assert.equal(await tutorial.locator(".pkt-title").innerText(), "1. 手札は2枚");
    assert.equal(await tutorial.locator(".pkt-dots span").count(), 7);
    for (let i = 0; i < 6; i++) await tutorial.getByRole("button", { name: "次へ" }).click();
    assert.equal(await tutorial.locator(".pkt-title").innerText(), "7. 勝ち方");
    await tutorial.getByRole("button", { name: "戻る" }).click();
    assert.match(await tutorial.locator(".pkt-title").innerText(), /^6\./);
    await tutorial.getByRole("button", { name: "次へ" }).click();
    await tutorial.getByRole("button", { name: "コンピュータと練習する" }).click();
    // A practice table with one computer.
    const screen = page.locator("dialog.poker-screen[open]");
    await screen.locator(".pk-seat", { hasText: "ペンギン" }).waitFor();
    assert.match(await screen.locator("[data-pk-rules]").innerText(), /練習（ポイントは賭けません）/);
    await screen.locator(".pk-hole .pk-card:not(.is-back)").nth(1).waitFor();
    // Motion: cards are dealt from the middle and every move shows a word over the player.
    await screen.locator(".pk-card.pk-dealt").first().waitFor({ state: "attached" });
    await page.evaluate(() => {
      window.__pkSaid = 0;
      new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach((n) => n.classList?.contains("pk-act") && window.__pkSaid++))).observe(document.querySelector(".pk-felt"), { childList: true, subtree: true });
    });
    // Play by checking or calling; the computer answers by itself until hands are done.
    // The computer thinks for up to 1.6 s and the next hand waits 5 s, so allow time, not a count.
    const play = async (until) => {
      for (const end = Date.now() + 240000; Date.now() < end; ) {
        if (await page.evaluate(until)) return;
        const check = screen.getByRole("button", { name: "様子見" }),
          call = screen.getByRole("button", { name: /^同じだけ出す/ });
        if (await check.count()) await check.click({ timeout: 1000 }).catch(() => {});
        else if (await call.count()) await call.click({ timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(250);
      }
      throw Error("the practice game did not move on: " + JSON.stringify(await page.evaluate(() => { const r = window.Poker._session()?.room; return r && { status: r.status, no: r.handNo, street: r.hand?.street, needs: r.hand?.needs, toAct: r.hand?.toAct, stacks: r.hand?.stacks, players: Object.fromEntries(Object.entries(r.players).map(([k, p]) => [k, p.stack])), log: r.log }; })));
    };
    await play(() => (window.Poker._session()?.room?.handNo || 0) >= 2);
    assert.ok(await page.evaluate(() => window.Poker._session().room.log.some((line) => /^ペンギン：/.test(line))));
    assert.ok((await page.evaluate(() => window.__pkSaid)) >= 2, "moves are announced over the seats");
    // The game ends when one side has no chips; practice never touches points.
    // Between hands the computer is left with at most two chips (set again after every hand, so a
    // redraw cannot undo it); the blinds soon take them and the game ends.
    await play(() => {
      const room = window.Poker._session()?.room;
      if (room?.hand?.street === "done" && room.players["cpu-0"].stack > 2) room.players["cpu-0"].stack = 2;
      return room?.status === "over";
    });
    assert.match(await screen.locator(".pk-final").innerText(), /勝ちました|チップがなくなりました/);
    assert.equal(await page.evaluate(() => window.StudyPoints.balance()), points);
    // Again: a fresh table with the same settings.
    await screen.getByRole("button", { name: "もう一度" }).click();
    await page.waitForFunction(() => window.Poker._session()?.room?.status === "playing" && window.Poker._session().room.players["cpu-0"].stack === 100 || window.Poker._session()?.room?.handNo === 1);
    // The how-to is also in the lobby.
    await screen.getByRole("button", { name: "やめる" }).click();
    await page.evaluate(() => window.Poker.open());
    await page.getByRole("button", { name: "遊び方を見る" }).click();
    await tutorial.waitFor();
    await tutorial.getByRole("button", { name: "スキップ" }).click();
    assert.equal(await page.locator("dialog.pk-tutorial").count(), 0);
    assert.deepEqual(errors, []);
    console.log("PASS: how-to opens on the first visit (7 scenes, back/next, to practice), practice vs computer without points, game end and again, how-to from the lobby");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
