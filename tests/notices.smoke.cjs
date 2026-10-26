// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/notices.smoke.cjs
// The お知らせボックス: the bell at the top right with an unread badge; a notice posted from the
// admin tools reaches the box; the daily login bonus is spun from the box, pays into the wallet
// once a day (a second device gets nothing more); a guest is told to log in. Also the dice in
// the casino tumble and land before the hand and the result show.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const base = process.env.APP_URL || "http://127.0.0.1:8000";
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const docs = new Map(),
      versions = new Map(),
      errors = [];
    docs.set("users/nb-a", { playerName: "nb-a", studyPoints: 500 });
    docs.set("users/nb-a/learningPoints/main", { balance: 500, revision: 1, history: {} });
    docs.set("users/nb-c", { playerName: "nb-c", studyPoints: 500 });
    docs.set("users/nb-c/learningPoints/main", { balance: 500, revision: 1, history: {} });
    async function pageFor(id, motion = "reduce") {
      const page = await browser.newPage({ viewport: { width: 375, height: 740 } });
      page.on("pageerror", (error) => errors.push(id + ": " + error.message));
      await page.route("https://**/*", (r) => r.abort());
      await page.addInitScript(() => {
        localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
        localStorage.setItem("b3_tutorial_done", "1");
      });
      await page.emulateMedia({ reducedMotion: motion });
      await page.exposeFunction("__nbRead", (path) => ({ value: docs.get(path) || null, version: versions.get(path) || 0 }));
      await page.exposeFunction("__nbCommit", ({ reads, writes }) => {
        for (const [path, version] of Object.entries(reads)) if ((versions.get(path) || 0) !== version) return false;
        for (const w of writes) {
          docs.set(w.path, w.merge ? { ...(docs.get(w.path) || {}), ...w.value } : w.value);
          versions.set(w.path, (versions.get(w.path) || 0) + 1);
        }
        return true;
      });
      await page.goto(base);
      await page.getByRole("button", { name: "ゲストで試す" }).click();
      await page.waitForFunction(() => window.__learningBootReady === true && window.Notices);
      return page;
    }
    async function signIn(page, id) {
      await page.evaluate((id) => {
        myId = id;
        myName = id;
        localStorage.setItem("core_v4_study_points_" + id, JSON.stringify({ balance: 500, revision: 1, publishedRevision: 1 }));
        window.db = {};
        const pathOf = (ref) => (typeof ref === "string" ? ref : ref.path);
        window.fbDoc = (_, ...parts) => ({ path: parts.join("/") });
        window.fbGetDoc = async (ref) => {
          const { value } = await __nbRead(pathOf(ref));
          return { exists: () => !!value, data: () => structuredClone(value) };
        };
        window.fbRunTransaction = async (_, fn) => {
          for (let attempt = 0; attempt < 20; attempt++) {
            const reads = {},
              writes = [];
            const result = await fn({
              get: async (ref) => {
                if (writes.length) throw Error("read after write");
                const path = pathOf(ref),
                  { value, version } = await __nbRead(path);
                reads[path] = version;
                return { exists: () => !!value, data: () => structuredClone(value) };
              },
              set: (ref, value, options) => writes.push({ path: pathOf(ref), value: JSON.parse(JSON.stringify(value)), merge: options?.merge === true }),
            });
            if (await __nbCommit({ reads, writes })) return result;
          }
          throw Error("transaction conflict");
        };
      }, id);
    }
    const a = await pageFor("nb-a");
    const box = a.locator("dialog.notices-dialog[open]");

    // The bell sits at the top right, clear of the clock and inside the screen.
    const bell = a.locator("#headerNotices");
    const place = await a.evaluate(() => {
      const b = document.getElementById("headerNotices").getBoundingClientRect(),
        g = document.querySelector(".header-clock-group").getBoundingClientRect();
      return { right: b.right, left: b.left, groupRight: g.right, top: b.top };
    });
    assert.ok(place.right <= 375 && place.right > 330 && place.left >= place.groupRight, JSON.stringify(place));
    // A guest is told the bonus needs an account.
    assert.equal(await bell.locator(".notice-badge").isHidden(), true);
    await bell.click();
    await box.getByText("ログインすると毎日1回ルーレットでポイントがもらえます。").waitFor();
    await box.getByText("運営からのお知らせはまだありません。").waitFor();
    await box.getByRole("button", { name: "閉じる" }).click();

    // Signed in: the bonus is waiting.
    await signIn(a, "nb-a");
    await a.evaluate(() => window.Notices.load());
    assert.equal(await bell.locator(".notice-badge").innerText(), "1");

    // The admin tools post a notice for everyone.
    await a.evaluate(() => {
      window.verifyAdminPassword = (value) => value === "test-admin";
    });
    await a.evaluate(() => window.AdminPlayers.open());
    await a.getByLabel("管理者パスワード", { exact: true }).fill("test-admin");
    await a.getByRole("button", { name: "管理者ツールを開く", exact: true }).click();
    await a.getByRole("button", { name: "お知らせを配信" }).click();
    await a.getByLabel("タイトル", { exact: true }).fill("メンテナンスのお知らせ");
    await a.getByLabel("本文", { exact: true }).fill("10月30日 2:00〜3:00 は使えません。\nご迷惑をおかけします。");
    await a.getByRole("button", { name: "全員に配信" }).click();
    await a.getByText("配信しました。ベルのお知らせに届きます。").waitFor();
    assert.equal(docs.get("shared/notices").items[0].title, "メンテナンスのお知らせ");
    assert.deepEqual(await a.locator(".admin-notice-list li span").allInnerTexts(), ["メンテナンスのお知らせ"]);
    await a.getByRole("button", { name: "管理者ツールを閉じる" }).click();
    assert.equal(await bell.locator(".notice-badge").innerText(), "2");

    // The box: the bonus first, then the notice marked new; opening it marks it read.
    await bell.click();
    await box.locator(".notice-list li.is-new", { hasText: "メンテナンスのお知らせ" }).waitFor();
    assert.match(await box.locator(".notice-text").innerText(), /2:00〜3:00 は使えません。\nご迷惑/);
    assert.equal(await bell.locator(".notice-badge").innerText(), "1");
    await a.screenshot({ path: "/tmp/notices-box.png" });

    // The wheel: one spin, the prize into the wallet.
    await box.locator(".notice-bonus").getByRole("button", { name: "回す" }).click();
    await box.locator(".notice-wheel svg").waitFor();
    assert.equal(await box.locator(".notice-wheel-slice").count(), 50);
    assert.match(await box.locator(".notice-odds p").textContent(), /^1,000pt 2%（1マス）・500pt 4%（2マス）.*10pt 40%（20マス）$/);
    await a.screenshot({ path: "/tmp/notices-wheel.png" });
    await box.locator(".notice-spin").click();
    await box.getByText("受け取りました。また明日。").waitFor();
    await a.screenshot({ path: "/tmp/notices-wheel-stopped.png" });
    const prize = docs.get("users/nb-a/learningPoints/bonus").prize;
    assert.ok([10, 50, 100, 200, 500, 1000].includes(prize));
    const segment = docs.get("users/nb-a/learningPoints/bonus").segment;
    assert.equal(await a.evaluate((i) => window.NoticesModel.SEGMENTS[i], segment), prize);
    // The slice under the pointer is the one drawn.
    const under = await a.evaluate(() => {
      const p = document.querySelector(".notice-wheel-pointer").getBoundingClientRect();
      return [...document.elementsFromPoint(p.left + p.width / 2, p.bottom + 6)].find((el) => el.classList?.contains("notice-wheel-slice"))?.getAttribute("fill");
    });
    assert.equal(under, { 10: "#1b2a40", 50: "#2c4466", 100: "#3d6378", 200: "#b98a4a", 500: "#e6d29a", 1000: "#c9483f" }[prize]);
    assert.equal(await box.locator(".notice-won").innerText(), "+" + prize.toLocaleString("ja-JP") + "pt");
    assert.equal(docs.get("users/nb-a/learningPoints/main").balance, 500 + prize);
    assert.equal(docs.get("users/nb-a").studyPoints, 500 + prize);
    assert.equal(await a.evaluate(() => window.StudyPoints.balance()), 500 + prize);
    assert.equal(docs.get("users/nb-a/learningPoints/bonus").day, await a.evaluate(() => window.NoticesModel.dayKey()));
    assert.equal(await bell.locator(".notice-badge").isHidden(), true);
    await a.locator(".ceremony").evaluateAll((list) => list.forEach((c) => c.click()));
    await box.getByRole("button", { name: "‹ お知らせへ" }).click();
    await box.getByText("受け取りました（+" + prize.toLocaleString("ja-JP") + "pt）。また明日。").waitFor();
    assert.equal(await box.locator(".notice-bonus button").count(), 0);
    await box.getByRole("button", { name: "閉じる" }).click();

    // Another device on the same account gets nothing more today.
    const b = await pageFor("nb-a-2");
    await signIn(b, "nb-a");
    await b.evaluate(() => window.Notices.load());
    assert.equal(await b.locator("#headerNotices .notice-badge").innerText(), "2");
    await b.locator("#headerNotices").click();
    const boxB = b.locator("dialog.notices-dialog[open]");
    await boxB.locator(".notice-bonus").getByRole("button", { name: "回す" }).click();
    await boxB.locator(".notice-spin").click();
    await boxB.getByText("今日はもう受け取りました（+" + prize.toLocaleString("ja-JP") + "pt）。また明日。").waitFor();
    assert.equal(docs.get("users/nb-a/learningPoints/main").balance, 500 + prize);
    assert.equal(await b.locator("#headerNotices .notice-badge").isHidden(), true);

    // The admin tools take the notice down.
    await a.evaluate(() => window.AdminPlayers.open());
    await a.getByLabel("管理者パスワード", { exact: true }).fill("test-admin");
    await a.getByRole("button", { name: "管理者ツールを開く", exact: true }).click();
    await a.getByRole("button", { name: "お知らせを配信" }).click();
    await a.locator(".admin-notice-list li", { hasText: "メンテナンスのお知らせ" }).getByRole("button", { name: "取り下げる" }).click();
    await a.getByText("取り下げました。").waitFor();
    assert.deepEqual(docs.get("shared/notices").items, []);
    await a.getByRole("button", { name: "管理者ツールを閉じる" }).click();

    // With motion, on an iPhone (where most motion is turned off): the wheel really turns, from
    // the tap, slows down and stops on the slice that is paid.
    const w = await pageFor("wheel", "no-preference");
    await signIn(w, "nb-c");
    await w.evaluate(() => document.documentElement.classList.add("ios-stable-rendering"));
    await w.evaluate(() => window.Notices.open());
    const boxW = w.locator("dialog.notices-dialog[open]");
    await boxW.locator(".notice-bonus").getByRole("button", { name: "回す" }).click();
    await boxW.locator(".notice-spin").click();
    const turn = () => w.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector(".notice-wheel-disc")).transform).toString());
    const t1 = await turn();
    await w.waitForTimeout(250);
    const t2 = await turn();
    await w.waitForTimeout(250);
    const t3 = await turn();
    assert.ok(t1 !== t2 && t2 !== t3, "the wheel turns: " + [t1, t2, t3].join(" | "));
    assert.equal(await boxW.locator(".notice-wheel-status").innerText(), "回しています…");
    await boxW.getByText("受け取りました。また明日。").waitFor({ timeout: 12000 });
    const prizeW = docs.get("users/nb-c/learningPoints/bonus").prize;
    const underW = await w.evaluate(() => {
      const p = document.querySelector(".notice-wheel-pointer").getBoundingClientRect();
      return [...document.elementsFromPoint(p.left + p.width / 2, p.bottom + 6)].find((el) => el.classList?.contains("notice-wheel-slice"))?.getAttribute("fill");
    });
    assert.equal(underW, { 10: "#1b2a40", 50: "#2c4466", 100: "#3d6378", 200: "#b98a4a", 500: "#e6d29a", 1000: "#c9483f" }[prizeW]);
    assert.equal(docs.get("users/nb-c/learningPoints/main").balance, 500 + prizeW);

    // Dice: thrown dice tumble, then land; the hand's name and the result wait for the landing.
    const c = await pageFor("dice", "no-preference");
    await c.locator("#nav-casino").click();
    await c.locator("#view-casino.active .mode-chinchiro").click();
    const ch = c.locator("dialog.casino-screen[open]");
    await ch.getByRole("button", { name: "勝負する" }).click();
    await ch.locator(".cs-bowl .cs-die.is-rolling").first().waitFor();
    await ch.locator(".cs-bowl .cs-die.is-landed").first().waitFor();
    await c.waitForFunction(() => !document.querySelector(".cs-bowl .cs-die.is-rolling:not(.is-landed)"), null, { timeout: 4000 });
    assert.equal(await ch.locator(".cs-bowl.is-shaking").count(), 0);
    // The landed faces are the numbers rolled.
    const faces = await ch.locator(".cs-bowl .cs-die.is-landed").evaluateAll((list) => list.map((d) => [Number(d.dataset.value), d.querySelectorAll("i.is-on").length]));
    for (const [value, pips] of faces) assert.equal(pips, value);
    assert.deepEqual(errors, []);
    console.log("PASS: bell at the top right with unread badge, admin posts and takes down a notice, notice marked new then read, bonus wheel pays once into the wallet, the wheel really turns on an iPhone and stops on the paid slice, second device refused, guest message, dice tumble and land on their numbers");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
