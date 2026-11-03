// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/casino-ranking.smoke.cjs
// ランキング › カジノ: one game at a time (buttons for the six games), with podiums of what was bet,
// what was won (less the bet, so it can be below zero) and how often it was played, all on one
// screen without scrolling; すごろくビンゴ also has bingos, JP, SJP and balls drawn. Only the projected field is read, a
// mode switch does not read, totals that cannot be true are not shown, and the player's own row
// comes from this device.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }),
      errors = [],
      requests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    const encoded = (value) =>
      typeof value === "string" ? { stringValue: value } : typeof value === "number" ? { integerValue: String(value) } : typeof value === "boolean" ? { booleanValue: value } : { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encoded(v)])) } };
    const now = Date.now(),
      recent = new Date(now - 1000).toISOString(),
      user = (id, name, stats, extra = {}) => ({ id, data: { playerName: name, lastActiveAt: recent, lastLoginAt: recent, studyPoints: 100, ...(stats ? { casinoStatsV1: stats } : {}), ...extra } });
    const rows = [
      user("a", "エー", { poker: { b: 1000, n: -400, p: 8 }, blackjack: { b: 500, n: 900, p: 5 }, sugoroku: { b: 2000, n: 500, p: 20, g: 4, j: 1, s: 0, l: 90 } }),
      user("b", "ビー", { poker: { b: 300, n: 250, p: 3 }, roulette: { b: 100, n: -100, p: 1 }, sugoroku: { b: 900, n: -300, p: 9, g: 1, j: 0, s: 1, l: 40 } }),
      // A made-up poker total (won far more than could be) is not shown; the dice one is fine.
      user("c", "シー", { poker: { b: 100, n: 99999999, p: 3 }, dice: { b: 50, n: 10, p: 2 } }),
      user("d", "ディー", null),
      user("old", "以前のログイン", { poker: { b: 99999, n: 99999, p: 99 } }, { lastLoginAt: "2020-01-01T00:00:00Z" }),
    ];
    await page.route("https://firestore.googleapis.com/v1/projects/ranking-test/**", async (route) => {
      const body = route.request().postDataJSON();
      requests.push(body);
      const q = body.structuredQuery,
        data = rows.map((row) => ({ document: { name: "projects/ranking-test/databases/(default)/documents/users/" + row.id, fields: Object.fromEntries(q.select.fields.filter(({ fieldPath }) => row.data[fieldPath] !== undefined).map(({ fieldPath }) => [fieldPath, encoded(row.data[fieldPath])])) } }));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    });
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
    });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true && window.CasinoStats && window.Poker?.casinoStats);
    await page.evaluate(() => {
      myId = "load-self";
      myName = "読み込み確認";
      localStorage.setItem("core_v4_study_points_load-self", JSON.stringify({ balance: 1500, revision: 1, publishedRevision: 1 }));
      // This player's own totals, as kept on this device by the last wallet write.
      localStorage.setItem("aiglish_casino_stats_load-self", JSON.stringify({ poker: { b: 700, n: -50, p: 4 } }));
      userStats = {};
      window.db = { app: { options: { projectId: "ranking-test" } } };
      window.fbDoc = (_, ...parts) => parts.join("/");
      window.fbRunTransaction = () => new Promise(() => {});
      window.fbGetDoc = () => new Promise(() => {});
    });
    await page.locator("#nav-titles").click();
    await page.waitForTimeout(100);
    assert.equal(requests.length, 0, "opening rankings does not fetch");
    await page.locator("[data-rank-mode=casino]").click();
    assert.equal(await page.locator("[data-rank-mode=casino]").getAttribute("aria-pressed"), "true");
    assert.equal(requests.length, 0, "a mode switch does not fetch");
    assert.equal(await page.locator(".casino-rank-note").isVisible(), true);
    await page.locator("#rankingRefresh").click();
    await page.locator('[data-podium-metric="poker:b"] .place-1 .podium-name').waitFor();
    // Only the one projected field is read for this ranking.
    const fields = requests[0].structuredQuery.select.fields.map((f) => f.fieldPath);
    assert.ok(fields.includes("casinoStatsV1") && !fields.includes("rankingLearningSummaryV1") && !fields.includes("studyPoints"));

    // One game at a time: buttons for six games, poker first, with its three panels.
    assert.deepEqual(await page.locator("[data-casino-game]").allInnerTexts(), ["ポーカー", "ブラックジャック", "ルーレット", "ダイスポーカー", "チンチロ", "すごろくビンゴ"]);
    assert.equal(await page.locator(".casino-game-switch").isVisible(), true);
    assert.equal(await page.locator('[data-casino-game="poker"]').getAttribute("aria-pressed"), "true");
    const panelsOf = () => page.locator("#rankingPodium .ranking-mini-panel h3").allInnerTexts();
    assert.deepEqual(await panelsOf(), ["累計賭け額", "累計得額", "プレイ回数"]);
    // Nothing needs scrolling: the panels fill the screen without a scroll in the list or the page.
    const fits = () =>
      page.evaluate(() => {
        const host = document.getElementById("rankingPodium"),
          panels = [...host.querySelectorAll(".ranking-mini-panel")],
          limit = document.querySelector(".tab-view.active")?.getBoundingClientRect().bottom || innerHeight;
        return {
          host: host.scrollHeight <= host.clientHeight + 1 && host.scrollWidth <= host.clientWidth + 1,
          page: document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1,
          inside: panels.every((p) => p.getBoundingClientRect().bottom <= host.getBoundingClientRect().bottom + 1 && p.scrollHeight <= p.clientHeight + 1 && p.getBoundingClientRect().right <= innerWidth + 1),
          count: panels.length,
          limit: Math.round(limit),
        };
      });
    const gameNames = { blackjack: "ブラックジャック", roulette: "ルーレット", dice: "ダイスポーカー", chinchiro: "チンチロ", sugoroku: "すごろくビンゴ" };
    for (const viewport of [{ width: 393, height: 852 }, { width: 320, height: 668 }]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(250);
      for (const game of ["poker", ...Object.keys(gameNames)]) {
        await page.locator('[data-casino-game="' + game + '"]').click();
        assert.equal(await page.locator('[data-casino-game="' + game + '"]').getAttribute("aria-pressed"), "true");
        // (The podiums rise when they first appear: measured after that.)
        await page.waitForTimeout(900);
        const result = await fits();
        assert.equal(result.count, game === "sugoroku" ? 7 : 3, game);
        assert.deepEqual([result.host, result.page, result.inside], [true, true, true], game + " " + viewport.width + "x" + viewport.height + " " + JSON.stringify(result));
      }
    }
    await page.setViewportSize({ width: 393, height: 852 });
    await page.waitForTimeout(250);
    await page.locator('[data-casino-game="sugoroku"]').click();
    assert.deepEqual(await panelsOf(), ["累計賭け額", "累計得額", "プレイ回数", "ビンゴ回数", "JP回数", "SJP回数", "ボール排出回数"]);
    await page.screenshot({ path: "/tmp/casino-ranking-sugoroku.png" });
    await page.locator('[data-casino-game="poker"]').click();
    assert.equal(requests.length, 1, "choosing a game does not read");
    const places = (key) => page.locator('[data-podium-metric="' + key + '"] .learning-podium-place').evaluateAll((list) => list.map((p) => (p.classList.contains("is-empty") ? "—" : p.querySelector(".podium-name").textContent + " " + p.querySelector("strong").textContent)));
    // Bet: エー 1,000, this player 700, ビー 300 (the made-up total of シー is out).
    // (Left to right on the podium: 2nd, 1st, 3rd.)
    assert.deepEqual(await places("poker:b"), ["読み込み確認 700pt", "エー 1,000pt", "ビー 300pt"]);
    // Won less bet: it can be below zero, and ranks by what it is (ビー +250, this player -50, エー -400).
    assert.deepEqual(await places("poker:n"), ["読み込み確認 -50pt", "ビー +250pt", "エー -400pt"]);
    assert.deepEqual(await places("poker:p"), ["読み込み確認 4回", "エー 8回", "ビー 3回"]);
    // A player is in a game only after playing it; シー's valid dice total shows.
    await page.locator('[data-casino-game="dice"]').click();
    assert.deepEqual(await places("dice:b"), ["—", "シー 50pt", "—"]);
    await page.locator('[data-casino-game="chinchiro"]').click();
    assert.deepEqual(await places("chinchiro:b"), ["—", "—", "—"]);
    await page.locator('[data-casino-game="sugoroku"]').click();
    // すごろくビンゴ's own counts: SJP only ビー, balls エー then ビー.
    assert.deepEqual(await places("sugoroku:s"), ["—", "ビー 1回", "—"]);
    assert.deepEqual(await places("sugoroku:l"), ["ビー 40回", "エー 90回", "—"]);
    assert.deepEqual(await places("sugoroku:g"), ["ビー 1回", "エー 4回", "—"]);
    // Your own place under each panel, from this device's totals.
    await page.locator('[data-casino-game="poker"]').click();
    assert.equal(await page.locator('[data-podium-metric="poker:b"] .ranking-mini-self').innerText(), "あなた · 2位　700pt");
    await page.locator('[data-casino-game="roulette"]').click();
    assert.match(await page.locator('[data-podium-metric="roulette:b"] .ranking-mini-self').innerText(), /未計測/);
    await page.locator('[data-casino-game="poker"]').click();

    await page.screenshot({ path: "/tmp/casino-ranking.png" });

    // A podium opens that player's totals for the game.
    await page.getByRole("button", { name: "ポーカー 累計得額 1位 ビーの詳細" }).click();
    const detail = page.locator("dialog.library-editor-dialog");
    await detail.waitFor({ state: "visible" });
    assert.match(await detail.locator(".ranking-detail-place").innerText(), /ポーカー 累計得額 · 1位/);
    assert.deepEqual(await detail.locator("dt").allInnerTexts(), ["累計賭け額", "累計得額", "プレイ回数"]);
    await detail.getByRole("button", { name: "閉じる" }).click();

    // Back to ポイント: the casino rows and note are gone; to カジノ again: from the kept result.
    await page.locator("[data-rank-mode=points]").click();
    assert.equal(await page.locator(".casino-game-switch").isHidden(), true);
    assert.equal(await page.locator(".casino-rank-note").isHidden(), true);
    assert.deepEqual(await panelsOf(), ["ポイント", "総獲得ポイント"]);
    await page.locator("[data-rank-mode=casino]").click();
    await page.locator('[data-podium-metric="poker:b"] .place-1 .podium-name').waitFor();
    assert.equal(requests.length, 1, "switching back uses the kept result");
    assert.deepEqual(errors, []);
    console.log("PASS: カジノ ranking, one game at a time on one screen without scrolling (393x852 and 320x668) (bet, won less bet below zero too, plays; bingos, JP, SJP and balls for すごろくビンゴ), one projected field, made-up totals not shown, own row from this device, detail");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
