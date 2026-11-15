// 大富豪のローカルルール: chosen in the lobby (kept on the device, shown as tags and in the rules sheet), dealt into the game
// (practice and tables use them), and a 7渡し / 10捨て is chosen with the hand and the same button. Games with every local rule on
// are played through the screen to the end.
const { chromium } = require("playwright"), assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }), errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => { localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false })); localStorage.setItem("b3_tutorial_done", "1"); });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true && window.Daifugo);
    await page.evaluate(() => window.Daifugo.open());
    const screen = page.locator("dialog.df-screen[open]");
    await screen.waitFor();

    // The panel is closed at first and says the rules are the standard ones.
    const head = screen.locator(".df-rule-head");
    assert.match(await head.innerText(), /ローカルルール[\s\S]*標準のルール/);
    assert.equal(await screen.locator(".df-rule").count(), 0);
    await head.click();
    assert.equal(await screen.locator(".df-rule").count(), 12);
    assert.equal(await screen.locator('.df-rule[aria-pressed="true"]').count(), 6, "the rule book's six are on");
    // Local rules on, one of the basic rules off.
    for (const name of ["7渡し なし", "10捨て なし", "11バック なし", "5飛ばし なし", "9リバース なし", "8切り あり"]) await screen.getByRole("button", { name, exact: true }).click();
    assert.match(await screen.locator(".df-rule-head").innerText(), /8切りなし・11バック・5飛ばし・7渡し・10捨て・9リバース/);
    // Kept for the next time, and shown in the rules sheet.
    await page.reload();
    await page.getByRole("button", { name: "ゲストで試す" }).click().catch(() => {});
    await page.waitForFunction(() => window.__learningBootReady === true && window.Daifugo);
    await page.evaluate(() => window.Daifugo.open());
    await screen.waitFor();
    assert.match(await screen.locator(".df-rule-head").innerText(), /8切りなし・11バック/);
    await screen.getByRole("button", { name: "ルールを見る" }).click();
    assert.match(await screen.locator(".df-rules-sheet").innerText(), /選んでいるルール[\s\S]*8切りなし[\s\S]*7渡し：7を出すと/);
    await screen.getByRole("button", { name: "ルールを閉じる" }).click();

    // Practice games with those rules: dealt into the game, and played to the end through the screen.
    let gave = 0, threw = 0;
    for (let game = 0; game < 3; game++) {
      await screen.getByRole("button", { name: "練習をはじめる" }).click();
      await screen.locator(".df-hand .df-card").first().waitFor();
      const dealt = await page.evaluate(() => { const g = window.DaifugoTable.view().room.g; return [g.opts.sevenPass, g.opts.tenDiscard, g.opts.eight, g.opts.elevenBack, g.dir]; });
      assert.deepEqual(dealt, [true, true, false, true, 1]);
      for (let step = 0; step < 600; step++) {
        if (await screen.locator(".df-end").count()) break;
        const st = await page.evaluate(() => { const v = window.DaifugoTable.view(), g = v?.room?.g; return g ? { mine: g.phase === "play" && g.turn === v.me && !g.legal.includes(v.me) && !g.illegal.includes(v.me), pending: g.pending && g.pending.by === v.me ? g.pending : null } : null; });
        if (!st || !st.mine) { await page.waitForTimeout(120); continue; }
        try {
          const t = { timeout: 2500 };
          if (st.pending) {
            // The cards of a 7渡し / 10捨て: the button counts them, passing is not possible, おすすめ picks the weakest.
            const word = st.pending.t === "seven" ? "渡す" : "捨てる";
            assert.match(await screen.locator(".df-actions .df-primary").innerText(), new RegExp(word + "（0/" + st.pending.count + "）"));
            assert.equal(await screen.getByRole("button", { name: "パス", exact: true }).isDisabled(), true);
            assert.match(await screen.locator(".df-msg").innerText(), new RegExp(word + " " + st.pending.count + " 枚を選ぶ"));
            await screen.getByRole("button", { name: "おすすめ" }).click(t);
            await screen.locator(".df-actions .df-primary").click(t);
            st.pending.t === "seven" ? gave++ : threw++;
          } else {
            await screen.getByRole("button", { name: "おすすめ" }).click(t);
            const play = screen.locator(".df-actions .df-primary");
            if (await play.isEnabled()) await play.click(t);
            else await screen.getByRole("button", { name: "パス", exact: true }).click(t);
          }
        } catch (error) { if (/Assertion/.test(String(error))) throw error; }
        await page.waitForTimeout(80);
      }
      await screen.locator(".df-end").waitFor({ timeout: 60000 });
      await screen.getByRole("button", { name: "閉じる", exact: true }).click();
      await screen.waitFor({ state: "detached" });
      await page.evaluate(() => window.Daifugo.open());
      await screen.waitFor();
    }
    console.log("  (7渡し chosen " + gave + " times, 10捨て " + threw + " times)");

    // 標準に戻す puts the rule book back.
    await screen.locator(".df-rule-head").click();
    await screen.getByRole("button", { name: "標準に戻す" }).click();
    assert.match(await screen.locator(".df-rule-head").innerText(), /標準のルール/);
    assert.deepEqual(await page.evaluate(() => window.DaifugoModel.ruleTags(JSON.parse(localStorage.getItem("aiglish_df_rules")))), []);
    assert.deepEqual(errors, []);
    console.log("daifugo rules smoke passed");
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
