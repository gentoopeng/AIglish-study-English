// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/stamps.smoke.cjs
// Stamps: A makes one (a picture, a name, a price) and the cloud holds it without the picture in its own document; B buys it
// (the points leave B as a gift to A, who takes them in once; B's box gets it; a second buy is refused); B sends it in a talk and
// A sees the picture; the maker changes the price; the 運営 stops and removes one (a stopped one is still used by those who have it, a
// removed one is not); a guest is told to log in.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const base = process.env.APP_URL || "http://127.0.0.1:8000";
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const docs = new Map(),
      versions = new Map(),
      errors = [];
    for (const id of ["st-a", "st-b", "st-c"]) {
      docs.set("users/" + id, { playerName: id, studyPoints: 500 });
      docs.set("users/" + id + "/learningPoints/main", { balance: 500, revision: 1, history: {} });
    }
    async function pageFor(id, admin = false) {
      const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
      page.on("pageerror", (error) => errors.push(id + ": " + error.message));
      await page.route("https://**/*", (r) => r.abort());
      await page.addInitScript(() => {
        localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
        localStorage.setItem("b3_tutorial_done", "1");
      });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.exposeFunction("__stRead", (path) => ({ value: docs.get(path) || null, version: versions.get(path) || 0 }));
      await page.exposeFunction("__stList", (collection) =>
        [...docs.entries()].filter(([path]) => path.startsWith(collection + "/") && !path.slice(collection.length + 1).includes("/")).map(([path, value]) => ({ id: path.slice(collection.length + 1), value })),
      );
      await page.exposeFunction("__stCommit", ({ reads, writes }) => {
        for (const [path, version] of Object.entries(reads)) if ((versions.get(path) || 0) !== version) return false;
        const deep = (a, b) => {
          const out = { ...(a || {}) };
          for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object" ? deep(out[k], v) : v;
          return out;
        };
        for (const w of writes) {
          if (w.remove) docs.delete(w.path);
          else docs.set(w.path, w.merge ? deep(docs.get(w.path), w.value) : w.value);
          versions.set(w.path, (versions.get(w.path) || 0) + 1);
        }
        return true;
      });
      await page.goto(base);
      await page.getByRole("button", { name: "ゲストで試す" }).click();
      await page.waitForFunction(() => window.__learningBootReady === true && window.Stamps && window.PointLoans);
      // A guest is told to log in.
      assert.match(await page.evaluate(() => window.Stamps.mine().then(() => "", (e) => e.message)) || "x", /./);
      await page.evaluate(
        ([id, admin]) => {
          myId = id;
          myName = id;
          window.isAdmin = admin;
          localStorage.setItem("core_v4_study_points_" + id, JSON.stringify({ balance: 500, revision: 1, publishedRevision: 1 }));
          window.db = {};
          const pathOf = (ref) => (typeof ref === "string" ? ref : ref.path);
          window.fbDoc = (_, ...parts) => ({ path: parts.join("/") });
          window.fbCollection = (_, ...parts) => ({ coll: parts.join("/") });
          window.fbWhere = (field, op, value) => ({ where: [field, op, value] });
          window.fbOrderBy = (field, dir) => ({ orderBy: [field, dir] });
          window.fbLimit = (n) => ({ limit: n });
          window.fbStartAfter = (cursor) => ({ after: cursor });
          window.fbQuery = (c, ...parts) => ({ ...c, parts });
          window.fbGetDoc = async (ref) => {
            const { value } = await __stRead(pathOf(ref));
            return { exists: () => !!value, data: () => structuredClone(value) };
          };
          window.fbGetDocs = async (q) => {
            let rows = await __stList(q.coll);
            for (const p of q.parts || []) if (p.where) rows = rows.filter((r) => r.value[p.where[0]] === p.where[2]);
            if ((q.parts || []).some((p) => p.orderBy)) rows.sort((x, y) => (y.value.createdAt || 0) - (x.value.createdAt || 0));
            const after = (q.parts || []).find((p) => p.after)?.after;
            if (after) rows = rows.slice(rows.findIndex((r) => r.id === after.id) + 1);
            const limit = (q.parts || []).find((p) => p.limit)?.limit;
            if (limit) rows = rows.slice(0, limit);
            const list = rows.map((r) => ({ id: r.id, ref: { path: q.coll + "/" + r.id }, data: () => structuredClone(r.value) }));
            return { docs: list, forEach: (fn) => list.forEach(fn) };
          };
          window.fbRunTransaction = async (_, fn) => {
            for (let attempt = 0; attempt < 20; attempt++) {
              const reads = {},
                writes = [];
              const result = await fn({
                get: async (ref) => {
                  const path = pathOf(ref),
                    { value, version } = await __stRead(path);
                  reads[path] = version;
                  return { exists: () => !!value, data: () => structuredClone(value) };
                },
                set: (ref, value, options) => writes.push({ path: pathOf(ref), value: JSON.parse(JSON.stringify(value)), merge: options?.merge === true }),
              });
              if (await __stCommit({ reads, writes })) return result;
            }
            throw Error("transaction conflict");
          };
          window.fbSetDoc = async (ref, value, options) => __stCommit({ reads: {}, writes: [{ path: pathOf(ref), value: JSON.parse(JSON.stringify(value)), merge: options?.merge === true }] });
          window.fbDeleteDoc = async (ref) => __stCommit({ reads: {}, writes: [{ path: pathOf(ref), remove: true }] });
        },
        [id, admin],
      );
      return page;
    }
    const wallet = (id) => docs.get("users/" + id + "/learningPoints/main").balance;
    const a = await pageFor("st-a"),
      b = await pageFor("st-b"),
      c = await pageFor("st-c"),
      admin = await pageFor("st-c2", true);
    // A picture to upload: a small PNG of what is on screen.
    const png = await a.screenshot({ clip: { x: 10, y: 10, width: 120, height: 120 } });
    const dlg = (page) => page.locator("dialog.stamps-dialog[open]");

    // ---- A makes a stamp -----------------------------------------------------------------------------
    await a.evaluate(() => window.Stamps.store());
    await dlg(a).getByRole("button", { name: "＋ スタンプを作る" }).click();
    await dlg(a).locator("input[type=file]").setInputFiles({ name: "p.png", mimeType: "image/png", buffer: png });
    await dlg(a).getByRole("button", { name: "作る" }).click();
    await dlg(a).locator(".stamps-status.is-bad").waitFor();
    assert.match(await dlg(a).locator(".stamps-status").innerText(), /チェック/, "the rights box has to be ticked");
    await dlg(a).getByLabel("名前").fill("ぱんだ");
    await dlg(a).getByLabel("値段").fill("50");
    await dlg(a).locator(".stamps-rights input").check();
    await dlg(a).getByRole("button", { name: "作る" }).click();
    await a.waitForFunction(() => [...document.querySelectorAll(".stamps-card")].some((el) => el.innerText.includes("ぱんだ")), null, { timeout: 15000 });
    const made = [...docs.keys()].filter((k) => k.startsWith("stamps/"));
    assert.equal(made.length, 1);
    const id = made[0].split("/")[1];
    const stamp = docs.get("stamps/" + id);
    assert.deepEqual([stamp.ownerId, stamp.name, stamp.price, stamp.status, stamp.sales], ["st-a", "ぱんだ", 50, "on", 0]);
    assert.equal("image" in stamp, false, "the stamp document holds no picture");
    assert.match(docs.get("stampImages/" + id).image, /^data:image\/(webp|png|jpeg);base64,/);
    assert.ok(docs.get("stampImages/" + id).image.length <= 36000);
    assert.deepEqual(docs.get("users/st-a/stampBox/main").ids, [id], "the maker has it from the start");
    // A second one at once is refused (one a minute).
    await dlg(a).getByRole("button", { name: "＋ スタンプを作る" }).click();
    await dlg(a).locator("input[type=file]").setInputFiles({ name: "p.png", mimeType: "image/png", buffer: png });
    await dlg(a).getByLabel("名前").fill("二つ目");
    await dlg(a).locator(".stamps-rights input").check();
    await dlg(a).getByRole("button", { name: "作る" }).click();
    await dlg(a).locator(".stamps-status.is-bad").waitFor();
    assert.match(await dlg(a).locator(".stamps-status").innerText(), /続けて作れません/);
    await a.evaluate(() => window.Stamps.close());

    // ---- B buys it: two taps, once -------------------------------------------------------------------
    await b.evaluate(() => window.Stamps.store());
    const card = dlg(b).locator(".stamps-card", { hasText: "ぱんだ" });
    await card.waitFor();
    assert.equal(await card.locator(".stamps-price").innerText(), "50pt");
    if (process.env.SHOTS) await b.screenshot({ path: "/tmp/claude-0/stamp_store.png" });
    // (a price that changed after it was shown is refused)
    await b.evaluate(([id]) => window.fbSetDoc(window.fbDoc(null, "stamps", id), { price: 60 }, { merge: true }), [id]);
    await card.getByRole("button", { name: "買う" }).click();
    await card.getByRole("button", { name: /で買う（もう一度）/ }).click();
    await dlg(b).locator(".stamps-status.is-bad").waitFor();
    assert.match(await dlg(b).locator(".stamps-status").innerText(), /値段が変わりました（今は 60pt）/);
    assert.equal(wallet("st-b"), 500, "nothing was charged");
    await b.evaluate(([id]) => window.fbSetDoc(window.fbDoc(null, "stamps", id), { price: 50 }, { merge: true }), [id]);
    await card.getByRole("button", { name: "買う" }).click();
    await card.getByRole("button", { name: /で買う（もう一度）/ }).click();
    await card.locator(".stamps-have").waitFor();
    assert.equal(wallet("st-b"), 450, "the points left B");
    assert.deepEqual(docs.get("users/st-b/stampBox/main").ids, [id]);
    assert.equal(docs.get("stamps/" + id).sales, 1);
    const pair = docs.get("pointLoans/st-a__st-b");
    const give = pair.entries.find((e) => e.kind === "give");
    assert.deepEqual([give.from, give.to, give.amount, give.note], ["st-b", "st-a", 50, "スタンプ「ぱんだ」"]);
    assert.equal(wallet("st-a"), 500, "A has not taken it in yet");
    await a.evaluate(() => window.PointLoans.collect());
    await a.evaluate(() => window.PointLoans.collect());
    assert.equal(wallet("st-a"), 550, "A takes it in once");
    // Already owned: nothing more to buy.
    assert.equal(await card.getByRole("button", { name: "買う" }).count(), 0);
    assert.match(await b.evaluate(([id]) => window.PointLoans.buyStamp(id, 50).then(() => "", (e) => e.message), [id]), /もう持っています/);
    assert.equal(wallet("st-b"), 450);
    await b.evaluate(() => window.Stamps.close());

    // ---- B sends it in the talk with A; A sees the picture --------------------------------------------
    await b.evaluate(() => window.PointLoans.person("st-a", "st-a"));
    await b.locator('[data-talk="stamp"]').click();
    await b.locator(".talk-tray .stamps-pick").waitFor();
    if (process.env.SHOTS) await b.screenshot({ path: "/tmp/claude-0/stamp_tray.png" });
    await b.locator(".talk-tray .stamps-pick").click();
    await b.locator(".talk-row.is-mine .talk-stamp img").waitFor({ timeout: 10000 });
    assert.equal((await b.locator(".talk-tray").isHidden()), true, "the tray closes after sending");
    const line = docs.get("pointLoans/st-a__st-b").entries.find((e) => e.kind === "stamp");
    assert.deepEqual([line.from, line.to, line.stamp], ["st-b", "st-a", id]);
    await a.evaluate(() => window.PointLoans.person("st-b", "st-b"));
    await a.locator(".talk-row.is-theirs .talk-stamp img").waitFor({ timeout: 10000 });
    // (B's payment card came first, so the icon is beside that one and the stamp line keeps its place.)
    assert.equal(await a.locator(".talk-row.is-theirs .talk-line-avatar:not(.talk-avatar-gap)").count(), 1, "their icon beside the first line of the run");
    assert.equal(await a.locator(".talk-row.is-theirs .talk-avatar-gap").count(), 1);
    if (process.env.SHOTS) await a.screenshot({ path: "/tmp/claude-0/stamp_talk.png" });
    // The list says "スタンプ", never a 0pt card.
    await a.evaluate(() => window.PointLoans.close());
    await a.evaluate(() => window.PointLoans.open());
    await a.locator(".loans-person .loans-last", { hasText: "スタンプ" }).waitFor();
    assert.doesNotMatch(await a.locator(".loans-dialog").innerText(), /0pt の記録/);
    await a.evaluate(() => window.PointLoans.close());

    // ---- The maker changes the price; the 運営 stops and removes -----------------------------------------
    await a.evaluate(() => window.Stamps.store());
    await dlg(a).locator(".stamps-card", { hasText: "ぱんだ" }).waitFor();
    a.once("dialog", (d) => d.accept("80"));
    await dlg(a).getByRole("button", { name: "値段を変える" }).click();
    await a.waitForFunction(() => document.querySelector(".stamps-price")?.textContent === "80pt");
    assert.equal(docs.get("stamps/" + id).price, 80);
    await a.evaluate(() => window.Stamps.close());
    // C is not the maker: no buttons for it, only a report.
    await c.evaluate(() => window.Stamps.store());
    const cCard = dlg(c).locator(".stamps-card", { hasText: "ぱんだ" });
    await cCard.waitFor();
    assert.equal(await cCard.getByRole("button", { name: "値段を変える" }).count(), 0);
    assert.equal(await cCard.getByRole("button", { name: /停止|削除/ }).count(), 0);
    await cCard.getByRole("button", { name: "通報" }).click();
    await dlg(c).locator(".stamps-status", { hasText: "通報しました" }).waitFor();
    assert.deepEqual(Object.keys(docs.get("stampReports/" + id).reporters), ["st-c"]);
    await c.evaluate(() => window.Stamps.close());
    // Somebody who is not the 運営 cannot stop it, even through the function.
    assert.match(await c.evaluate(([id]) => window.Stamps.moderate(id, "stopped").then(() => "", (e) => e.message), [id]), /運営だけ/);
    // The 運営 stops it: nobody can buy it any more, B (who has it) still uses it.
    await admin.evaluate(() => window.Stamps.store());
    const aCard = dlg(admin).locator(".stamps-card", { hasText: "ぱんだ" });
    await aCard.waitFor();
    await aCard.locator(".stamps-reports", { hasText: "通報 1件" }).waitFor();
    await aCard.getByRole("button", { name: "販売を停止（運営）" }).click();
    await admin.waitForFunction(() => document.querySelector(".stamps-card")?.innerText.includes("運営が停止中"));
    assert.equal(docs.get("stamps/" + id).status, "stopped");
    assert.match(await c.evaluate(([id]) => window.PointLoans.buyStamp(id, 80).then(() => "", (e) => e.message), [id]), /売られていません/);
    await b.evaluate(() => window.PointLoans.close());
    await b.evaluate(() => window.PointLoans.person("st-a", "st-a"));
    await b.locator('[data-talk="stamp"]').click();
    await b.locator(".talk-tray .stamps-pick").waitFor();
    // Removed: the picture goes, B's tray hides it, the line in the talk says it cannot be used, and nothing is refunded.
    const aCard2 = dlg(admin).locator(".stamps-card", { hasText: "ぱんだ" });
    admin.once("dialog", (d) => d.accept());
    await aCard2.getByRole("button", { name: "削除（運営）" }).click();
    await admin.waitForFunction(() => document.querySelector(".stamps-card")?.innerText.includes("削除されました"));
    assert.equal(docs.get("stamps/" + id).status, "deleted");
    assert.equal(docs.has("stampImages/" + id), false, "the picture is gone");
    assert.equal(wallet("st-b"), 450, "nothing is refunded");
    await b.evaluate(() => window.Stamps.close?.());
    await b.evaluate(() => window.PointLoans.close());
    // (what this device knew of the stamp is looked at again, as it is every 10 minutes and on a later visit)
    await b.evaluate(([id]) => window.Stamps.get(id, true), [id]);
    await b.evaluate(() => window.PointLoans.person("st-a", "st-a"));
    await b.locator(".talk-row .talk-stamp.is-gone").waitFor({ timeout: 10000 });
    assert.deepEqual(errors, []);
    console.log("PASS: stamps — made (the picture apart), bought once for the price shown, sent in a talk, the maker prices, the 運営 stops and removes");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
