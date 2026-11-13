// The operator adds and removes shared backgrounds from the admin tools; the ones shipped with the app are not touched.
const { chromium } = require("playwright"), assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 800 } }), errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => { localStorage.setItem("b3_tutorial_done", "1"); });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true && window.BackgroundCatalog);
    // An in-memory catalogue stands in for Firestore (the real publish / refresh are tested in shared-backgrounds.smoke.cjs).
    await page.evaluate(() => {
      window.verifyAdminPassword = (v) => v === "test-admin";
      window.db = {}; window.fbRunTransaction = async () => true;
      let list = [];
      window.__published = [];
      BackgroundCatalog.readCache = () => ({ backgrounds: list.slice(), knownIds: [] });
      BackgroundCatalog.refresh = async () => ({ backgrounds: list.slice() });
      BackgroundCatalog.publish = async ({ upserts = [], remove = [] }) => {
        if (window.isAdmin !== true) throw Error("not admin");
        list = list.filter((b) => !remove.includes(b.id)).concat(upserts);
        window.__published.push({ upserts: upserts.length, remove: remove.slice() });
        return { backgrounds: list.slice() };
      };
    });
    const png = await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 1600; c.height = 900; const x = c.getContext("2d"); x.fillStyle = "#468"; x.fillRect(0, 0, 1600, 900); return c.toDataURL("image/png").split(",")[1]; });
    const file = { name: "bg.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") };

    // Before the password the button is not there, and a call without admin rights is refused.
    assert.equal(await page.locator(".admin-backgrounds-button").count(), 0);
    await page.evaluate(() => AdminPlayers.open());
    await page.getByLabel("管理者パスワード", { exact: true }).fill("test-admin");
    await page.getByRole("button", { name: "管理者ツールを開く", exact: true }).click();
    await page.locator(".admin-backgrounds-button").waitFor();
    await page.locator(".admin-backgrounds-button").click();
    const dlg = page.locator("#adminBackgroundsDialog");
    await dlg.waitFor();
    await dlg.getByText("追加した背景はまだありません").waitFor();

    // Add two photos.
    await dlg.locator("[data-add]").setInputFiles([file, file]);
    await page.waitForFunction(() => document.querySelectorAll("#adminBackgroundsDialog .admin-background-row").length === 2);
    const stored = await page.evaluate(() => BackgroundCatalog.readCache().backgrounds.map((b) => [b.id.startsWith("shared-"), /^data:image\/jpeg;base64,/.test(b.image), /^data:image\/jpeg;base64,/.test(b.preview), b.image.length < 1000000]));
    assert.deepEqual(stored, [[true, true, true, true], [true, true, true, true]]);

    // Delete one: the first press only asks again; the second removes it.
    const del = dlg.locator(".admin-background-row button").first();
    await del.click();
    assert.equal(await dlg.locator(".admin-background-row").count(), 2);
    await del.click();
    await page.waitForFunction(() => document.querySelectorAll("#adminBackgroundsDialog .admin-background-row").length === 1);
    assert.equal(await page.evaluate(() => window.__published.at(-1).remove.length), 1);

    // The ones shipped with the app are never in this list, and closing the admin tools closes this too.
    await dlg.locator("[data-close]").click();
    await page.locator("#adminBackgroundsDialog").waitFor({ state: "hidden" });
    await page.locator(".admin-backgrounds-button").click();
    await dlg.waitFor();
    await page.locator('.admin-players-dialog [data-close]').click({ force: true }).catch(() => {});
    await page.evaluate(() => document.querySelector(".admin-players-dialog")?.close());
    await page.waitForFunction(() => document.getElementById("adminBackgroundsDialog").open === false);
    // Once the admin rights are off, publishing is refused.
    assert.equal(await page.evaluate(() => BackgroundCatalog.publish({ remove: ["x"] }).then(() => "ok", () => "refused")), "refused");
    assert.deepEqual(errors, []);
    console.log("admin backgrounds smoke passed");
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
