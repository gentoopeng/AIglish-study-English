// The users tab reads only players active this week, with only the fields the list shows
// (one projected query, plus one batch read for quiet friends), and keeps the list on the
// device so the next launch shows it at once.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }),
      page = await context.newPage(),
      errors = [],
      queries = [],
      gets = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let hold = null;
    const doc = (id, fields) => ({
      name: "projects/test-proj/databases/(default)/documents/users/" + id,
      fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typeof v === "boolean" ? { booleanValue: v } : { stringValue: String(v) }])),
    });
    await page.route("https://**/*", async (route) => {
      const url = route.request().url();
      if (url.includes("firestore.googleapis.com") && url.endsWith(":runQuery")) {
        queries.push(JSON.parse(route.request().postData()));
        if (hold) await hold;
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify([
            { document: doc("recent", { playerName: "最近の人", lastActiveAt: new Date(Date.now() - 60000).toISOString() }) },
            { document: doc("gone", { playerName: "消えた人", deleted: true, lastActiveAt: new Date().toISOString() }) },
          ]),
        });
      }
      if (url.includes("firestore.googleapis.com") && url.endsWith(":batchGet")) {
        gets.push(JSON.parse(route.request().postData()));
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify([{ found: doc("friend-old", { playerName: "昔のフレンド", lastActiveAt: new Date(Date.now() - 30 * 86400000).toISOString() }) }]),
        });
      }
      return route.abort();
    });
    await page.addInitScript(() => localStorage.setItem("b3_tutorial_done", "1"));
    const signIn = () =>
      page.evaluate(() => {
        window.__gcLoginShown = true;
        myId = "people-self";
        myFriendList = [{ code: "friend-old", name: "昔のフレンド" }];
        window.db = { app: { options: { projectId: "test-proj" } } };
        window.fbDoc = (_, ...path) => path.join("/");
        window.fbCollection = (_, ...path) => path.join("/");
        window.fbGetDoc = async () => ({ exists: () => false });
        window.__scans = 0;
        // The old way (every whole user document) is not used when the endpoint is known.
        window.fbGetDocs = async () => {
          window.__scans++;
          return { docs: [] };
        };
      });
    await page.goto("http://127.0.0.1:8000", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.People);
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    // A guest is told to sign in, not left with 読み込み中.
    await page.locator("#nav-community").click();
    await page.locator("#friendListContainer", { hasText: "ログインすると、ほかのユーザーが表示されます。" }).waitFor();
    await page.locator("#nav-vocab").click();
    await signIn();
    await page.locator("#nav-community").click();
    await page.getByRole("button", { name: "最近の人のプロフィール" }).waitFor();
    await page.getByRole("button", { name: "昔のフレンドのプロフィール" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "消えた人のプロフィール" }).count(), 0);
    assert.equal(await page.evaluate(() => window.__scans), 0);
    // One query: active this week, only the list's fields, 50 a page.
    assert.equal(queries.length, 1);
    const q = queries[0].structuredQuery;
    assert.equal(q.where.fieldFilter.field.fieldPath, "lastActiveAt");
    assert.equal(q.where.fieldFilter.op, "GREATER_THAN_OR_EQUAL");
    const since = Date.parse(q.where.fieldFilter.value.stringValue);
    assert.ok(Math.abs(Date.now() - 7 * 86400000 - since) < 120000);
    assert.equal(q.limit, 50);
    const fields = q.select.fields.map((f) => f.fieldPath);
    assert.ok(fields.includes("playerName") && fields.includes("avatar"));
    assert.ok(!fields.includes("saves") && !fields.includes("wordMemory"));
    // The quiet friend comes from one batch read of just that user.
    assert.equal(gets.length, 1);
    assert.deepEqual(gets[0].documents, ["projects/test-proj/databases/(default)/documents/users/friend-old"]);

    // Next launch: the list kept on the device shows at once, before the cloud answers.
    let release;
    hold = new Promise((resolve) => (release = resolve));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.People);
    // A guest session is remembered, so the start screen may not show again.
    await page.getByRole("button", { name: "ゲストで試す" }).click({ timeout: 3000 }).catch(() => {});
    await page.waitForFunction(() => window.__learningBootReady === true);
    await signIn();
    await page.locator("#nav-community").click();
    await page.getByRole("button", { name: "最近の人のプロフィール" }).waitFor({ timeout: 3000 });
    assert.equal(await page.locator("#usersCount").innerText(), "2人");
    assert.equal(queries.length, 2);
    release();
    await page.waitForFunction(() => !document.getElementById("usersStatus")?.textContent);
    assert.deepEqual(errors, []);
    console.log("PASS: a guest is told to sign in; users tab reads only this week's players with the list's fields (one query, quiet friends in one batch read), and shows the list kept on the device at once on the next launch");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
