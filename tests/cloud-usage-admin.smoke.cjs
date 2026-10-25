const { chromium, webkit } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const use = process.env.BROWSER === "webkit",
    browser = await (use ? webkit : chromium).launch(
      use
        ? { executablePath: process.env.WEBKIT_EXECUTABLE_PATH }
        : { executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] },
    );
  try {
    const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      }),
      requests = [],
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.route(
      "https://firestore.googleapis.com/v1/projects/admin-small/**",
      async (route) => {
        requests.push(route.request().url());
        if (route.request().method() === "POST") {
          const q = route.request().postDataJSON().structuredQuery;
          assert.deepEqual(
            q.select.fields.map((f) => f.fieldPath),
            ["playerName", "deleted"],
          );
          await route.fulfill({
            json: [
              {
                document: {
                  name: "projects/admin-small/databases/(default)/documents/users/a",
                  fields: { playerName: { stringValue: "利用者A" } },
                },
              },
            ],
          });
        } else {
          assert.ok(route.request().url().includes("mask.fieldPaths="));
          await route.fulfill({
            json: {
              fields: {
                playerName: { stringValue: "利用者A" },
                age: { stringValue: "18" },
                wordDuelRating: { integerValue: "1500" },
              },
            },
          });
        }
      },
    );
    await page.goto("http://127.0.0.1:8000");
    await page
      .getByRole("button", { name: "ゲストで試す" })
      .click();
    await page.waitForFunction(() => __learningBootReady);
    await page.evaluate(() => {
      window.db = { app: { options: { projectId: "admin-small" } } };
      window.fbRunTransaction = async () => {};
      window.verifyAdminPassword = (x) => x === "test";
    });
    await page.locator(".menu-trigger").click();
    await page
      .getByRole("button", { name: "データとバックアップ", exact: true })
      .click();
    assert.equal(requests.length, 0);
    // Short: automatic saving, the last cloud save, the file backup and a folded traffic estimate.
    assert.match(
      await page.locator(".cloud-usage-dialog").textContent(),
      /自動で保存されます[\s\S]*最終クラウド保存/,
    );
    assert.equal(await page.locator(".cloud-usage-dialog .file-backup-actions").count(), 1);
    assert.equal(await page.locator(".cloud-usage-dialog details.data-usage").count(), 1);
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    await page.evaluate(() => AdminPlayers.open());
    await page.locator("[data-auth] input").fill("test");
    await page
      .getByRole("button", { name: "管理者ツールを開く", exact: true })
      .click();
    await page
      .locator(".admin-player-row")
      .filter({ hasText: "利用者A" })
      .click();
    await page.locator("input[name=playerName]").waitFor();
    assert.equal(
      await page.locator("input[name=playerName]").inputValue(),
      "利用者A",
    );
    assert.equal(requests.length, 2);
    await page
      .getByRole("button", { name: "管理者ツールを閉じる", exact: true })
      .click();
    await page.evaluate(() => {
      db = {};
      UserDirectory.scan = () => new Promise(() => {});
      const native = setTimeout;
      window.setTimeout = (fn, ms, ...args) =>
        native(fn, ms === 15000 ? 100 : ms, ...args);
      AdminPlayers.open();
    });
    await page.locator("[data-auth] input").fill("test");
    await page
      .getByRole("button", { name: "管理者ツールを開く", exact: true })
      .click();
    await page.waitForFunction(() =>
      document
        .querySelector(".admin-players-dialog [role=status]")
        .textContent.includes("時間がかか"),
    );
    assert.equal(
      await page
        .getByRole("button", { name: "管理者ツールを閉じる", exact: true })
        .isEnabled(),
      true,
    );
    await page
      .getByRole("button", { name: "管理者ツールを閉じる", exact: true })
      .click();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: usage/storage menu makes no Firebase requests; projected admin list/detail and stalled-directory timeout/close",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
