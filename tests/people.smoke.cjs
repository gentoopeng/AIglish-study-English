const { chromium, webkit } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await (process.env.BROWSER === "webkit" ? webkit : chromium).launch(process.env.BROWSER === "webkit" ? {executablePath: process.env.WEBKIT_EXECUTABLE_PATH} : {executablePath: "/usr/bin/chromium", args: ["--no-sandbox"]});
  try {
    const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (route) => route.abort());
    await page.addInitScript(() =>
      localStorage.setItem("b3_tutorial_done", "1"),
    );
    await page.goto("http://127.0.0.1:8000", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.People);
    await page
      .getByRole("button", { name: "ゲストとしてテストプレイ" })
      .click();
    await page.evaluate(() => {
      window.__gcLoginShown = true;
      myId = "people-self";
      myFriendList = [
        { code: "friend-old", name: "昔のフレンド" },
        { code: "friend-deleted", name: "削除されたフレンド" },
      ];
      window.db = {};
      window.profileReads = 0;
      window.passiveBackups = 0;
      window.queueBackgroundSave = () => passiveBackups++;
      window.friendReads = 0;
      window.fbDoc = (_, ...path) => path.join("/");
      window.fbGetDoc = async (ref) => {
        if (ref.startsWith("users/friend-")) friendReads++;
        if (ref === "users/recent") {
          profileReads++;
          return {
            exists: () => true,
            data: () => ({
              playerName: "最近の人",
              userTarget: "英語を勉強",
              lastActiveAt: Date.now(),
            }),
          };
        }
        return { exists: () => false };
      };
      window.fbCollection = (_, ...path) => path.join("/");
      window.fbGetDocs = async () => ({
        forEach: (fn) =>
          [
            [
              "friend-deleted",
              {
                playerName: "削除されたフレンド",
                deleted: true,
                lastActiveAt: Date.now(),
              },
            ],
            [
              "friend-old",
              {
                playerName: "昔のフレンド",
                lastActiveAt: Date.now() - 30 * 86400000,
              },
            ],
            [
              "recent",
              {
                playerName: "最近の人",
                lastActiveAt: Date.now() - 1000,
                userTarget: "英語を勉強",
              },
            ],
            [
              "old",
              {
                playerName: "古いユーザー",
                lastActiveAt: Date.now() - 8 * 86400000,
              },
            ],
          ].forEach(([id, data]) => fn({ id, data: () => data })),
      });
    });
    await page.locator("#nav-community").click();
    await page
      .getByRole("button", { name: "最近の人のプロフィール" })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "昔のフレンドのプロフィール" })
        .count(),
      1,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "古いユーザーのプロフィール" })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "削除されたフレンドのプロフィール" })
        .count(),
      0,
    );
    await page.getByRole("button", { name: "最近の人のプロフィール" }).click();
    assert.equal(await page.locator("dialog[open]").isVisible(), true);
    // The profile no longer shows a goal (目標 was retired).
    assert.doesNotMatch(
      await page.locator("dialog[open]").textContent(),
      /目標|英語を勉強/,
    );
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    await page.getByRole("button", { name: "最近の人のプロフィール" }).click();
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    assert.equal(await page.evaluate(() => profileReads), 1);
    await page.evaluate(() => refreshFriendListFromFirebase(false));
    assert.equal(
      await page.evaluate(() => passiveBackups),
      0,
      "friend metadata must not trigger a whole learning backup",
    );
    assert.equal(
      await page.evaluate(() => friendReads),
      0,
      "directory refresh must not also reread every friend",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.equal(
      await page
        .locator(
          ".people-remove,#friendSearchInput,#friendSortSelect,#myFriendCodeDisplay,#friendRefreshButton",
        )
        .count(),
      0,
    );
    assert.equal(await page.locator("#usersRefreshButton").count(), 1);
    // Online and recent users come under their own headings, each with a count.
    const headings = await page.locator("#friendListContainer .people-section-heading").allInnerTexts();
    assert.ok(headings.length >= 1 && headings.every((text) => /^(オンライン|最近)（\d+）$/.test(text)), headings.join(","));
    await page.locator("#usersRefreshButton").click();
    await page.waitForFunction(
      () => !document.getElementById("usersRefreshButton").disabled,
    );
    assert.equal(await page.evaluate(() => passiveBackups), 0);
    const ids = await page
      .locator(".nav-bar .nav-item")
      .evaluateAll((nodes) => nodes.map((node) => node.id));
    assert.equal(ids[ids.indexOf("nav-community") + 1], "nav-battle");
    assert.equal(await page.locator("#nav-community").innerText(), "ユーザー");
    await page.locator("#nav-battle").click();
    assert.equal(await page.locator("#view-battle").isVisible(), true);
    assert.equal(
      await page.locator("#view-battle").evaluate((el) => el.childElementCount),
      1,
    );
    assert.equal(await page.locator("#wordDuelScreen").count(), 0);
    await page.setViewportSize({ width: 320, height: 720 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.locator("#nav-community").click();
    await page.screenshot({ path: "/tmp/users-directory-ui.png" });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: user-only directory, legacy inactive contacts retained, profile cache, compact refresh, no friend controls, adjacent battle mode tab and 320px layout",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
