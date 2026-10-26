// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/point-loans.smoke.cjs
// Lending points between two users: a loan leaves the lender's wallet at once and reaches the
// borrower's once; a repayment request (請求) is paid; a borrow request is declined; both see
// the same history; a guest is told to log in; the points dialog opens the screen.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const base = process.env.APP_URL || "http://127.0.0.1:8000";
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const docs = new Map(),
      versions = new Map(),
      errors = [];
    for (const id of ["loan-a", "loan-b"]) {
      docs.set("users/" + id, { playerName: id, studyPoints: 500 });
      docs.set("users/" + id + "/learningPoints/main", { balance: 500, revision: 1, history: {} });
    }
    async function pageFor(id) {
      const page = await browser.newPage({ viewport: { width: 375, height: 740 } });
      page.on("pageerror", (error) => errors.push(id + ": " + error.message));
      await page.route("https://**/*", (r) => r.abort());
      await page.addInitScript(() => {
        localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
        localStorage.setItem("b3_tutorial_done", "1");
      });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.exposeFunction("__lnRead", (path) => ({ value: docs.get(path) || null, version: versions.get(path) || 0 }));
      await page.exposeFunction("__lnCommit", ({ reads, writes }) => {
        for (const [path, version] of Object.entries(reads)) if ((versions.get(path) || 0) !== version) return false;
        const deep = (a, b) => {
          const out = { ...(a || {}) };
          for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object" ? deep(out[k], v) : v;
          return out;
        };
        for (const w of writes) {
          docs.set(w.path, w.merge ? deep(docs.get(w.path), w.value) : w.value);
          versions.set(w.path, (versions.get(w.path) || 0) + 1);
        }
        return true;
      });
      await page.goto(base);
      await page.getByRole("button", { name: "ゲストで試す" }).click();
      await page.waitForFunction(() => window.__learningBootReady === true);
      // A guest is told the screen needs an account.
      await page.evaluate(() => window.PointLoans.open());
      await page.getByText("ポイントの貸し借りはログインしたアカウントで使えます。").waitFor();
      await page.evaluate(() => window.PointLoans.close());
      await page.evaluate((id) => {
        myId = id;
        myName = id;
        localStorage.setItem("core_v4_study_points_" + id, JSON.stringify({ balance: 500, revision: 1, publishedRevision: 1 }));
        window.db = {};
        const pathOf = (ref) => (typeof ref === "string" ? ref : ref.path);
        window.fbDoc = (_, ...parts) => ({ path: parts.join("/") });
        window.fbGetDoc = async (ref) => {
          const { value } = await __lnRead(pathOf(ref));
          return { exists: () => !!value, data: () => structuredClone(value) };
        };
        window.fbRunTransaction = async (_, fn) => {
          for (let attempt = 0; attempt < 20; attempt++) {
            const reads = {},
              writes = [];
            const result = await fn({
              get: async (ref) => {
                const path = pathOf(ref),
                  { value, version } = await __lnRead(path);
                reads[path] = version;
                return { exists: () => !!value, data: () => structuredClone(value) };
              },
              set: (ref, value, options) => writes.push({ path: pathOf(ref), value: JSON.parse(JSON.stringify(value)), merge: options?.merge === true }),
            });
            if (await __lnCommit({ reads, writes })) return result;
          }
          throw Error("transaction conflict");
        };
      }, id);
      return page;
    }
    const a = await pageFor("loan-a"),
      b = await pageFor("loan-b");
    const wallet = (id) => docs.get("users/" + id + "/learningPoints/main").balance;
    const dialogOf = (page) => page.locator("dialog.loans-dialog[open]");

    // From B's profile, A chooses 貸す; it leaves A's wallet with the record.
    await a.evaluate(() => window.People.open("loan-b"));
    await a.locator(".people-loans").getByRole("button", { name: "貸す" }).click();
    await dialogOf(a).getByRole("heading", { name: "loan-bさんとの貸し借り" }).waitFor();
    // The screen sits in the points dialog's frame and its body is never squashed to nothing.
    assert.equal(await dialogOf(a).evaluate((d) => d.classList.contains("study-points-dialog")), true);
    await dialogOf(a).locator("[data-loan-amount]").waitFor();
    assert.ok((await dialogOf(a).locator(".loans-body").evaluate((el) => el.getBoundingClientRect().height)) > 200);
    await dialogOf(a).locator("[data-loan-amount]").fill("50");
    await dialogOf(a).getByRole("textbox", { name: "ひとこと" }).fill("ポーカー用");
    await dialogOf(a).getByRole("button", { name: "貸す", exact: true }).click();
    await dialogOf(a).locator(".loans-summary strong", { hasText: "50pt" }).waitFor();
    assert.match(await dialogOf(a).locator(".loans-summary").innerText(), /loan-bさんに 50pt 貸しています/);
    assert.equal(wallet("loan-a"), 450);
    assert.equal(await a.evaluate(() => window.StudyPoints.balance()), 450);
    assert.equal(wallet("loan-b"), 500);
    // B collects it once, however often they look.
    await b.evaluate(() => window.PointLoans.collect());
    await b.evaluate(() => window.PointLoans.collect());
    await b.evaluate(() => window.PointLoans.claim("loan-a__loan-b"));
    assert.equal(wallet("loan-b"), 550);
    assert.equal(await b.evaluate(() => window.StudyPoints.balance()), 550);
    // B's list shows the debt.
    await b.evaluate(() => window.PointLoans.open());
    await dialogOf(b).locator(".loans-person", { hasText: "loan-a" }).waitFor();
    assert.match(await dialogOf(b).locator(".loans-person").innerText(), /50pt 借りています/);
    await dialogOf(b).locator(".loans-person").click();
    await dialogOf(b).getByText("loan-aさんから 50pt 借りています").waitFor();
    assert.equal(await dialogOf(b).getByRole("button", { name: "返してと請求" }).isDisabled(), true);

    // A asks for 30 back (請求); B pays it from the request.
    await dialogOf(a).locator("[data-loan-amount]").fill("80");
    await dialogOf(a).getByRole("button", { name: "返してと請求" }).click();
    assert.match(await dialogOf(a).locator(".loans-error").innerText(), /請求できるのは貸している50ptまで/);
    await dialogOf(a).locator("[data-loan-amount]").fill("30");
    await dialogOf(a).getByRole("button", { name: "返してと請求" }).click();
    await dialogOf(a).getByText("30pt を請求しています（返事待ち）").waitFor();
    await b.evaluate(() => window.PointLoans.person("loan-a", "loan-a"));
    await dialogOf(b).getByText("loan-aさんから 30pt の請求です").waitFor();
    await dialogOf(b).locator(".loans-request").getByRole("button", { name: "払う" }).click();
    await dialogOf(b).getByText("loan-aさんから 20pt 借りています").waitFor();
    assert.equal(wallet("loan-b"), 520);
    await a.evaluate(() => window.PointLoans.collect());
    assert.equal(wallet("loan-a"), 480);

    // B asks to borrow 100; A declines. Both histories keep everything.
    await dialogOf(b).locator("[data-loan-amount]").fill("100");
    await dialogOf(b).getByRole("button", { name: "借りたいと頼む" }).click();
    await dialogOf(b).getByText("100pt 借りたいと頼んでいます（返事待ち）").waitFor();
    await a.evaluate(() => window.PointLoans.person("loan-b", "loan-b"));
    await dialogOf(a).getByText("loan-bさんが 100pt 借りたいそうです").waitFor();
    await dialogOf(a).locator(".loans-request").getByRole("button", { name: "断る" }).click();
    // Wait for the redrawn screen, not the one still showing before the answer.
    await dialogOf(a).locator(".loans-history li span", { hasText: "断った" }).waitFor();
    assert.deepEqual((await dialogOf(a).locator(".loans-history li span").allInnerTexts()), ["100pt 借りたいと頼まれた・断った", "30pt 返ってきた", "30pt 請求した・済み", "50pt 貸した"]);
    await b.evaluate(() => window.PointLoans.person("loan-a", "loan-a"));
    await dialogOf(b).locator(".loans-history li span", { hasText: "断られた" }).waitFor();
    assert.deepEqual((await dialogOf(b).locator(".loans-history li span").allInnerTexts()), ["100pt 借りたいと頼んだ・断られた", "30pt 返した", "30pt 請求された・済み", "50pt 借りた"]);
    assert.match(await dialogOf(b).locator(".loans-history").innerText(), /「ポーカー用」/);
    // Repaying the rest: no more than is owed.
    await dialogOf(b).getByRole("button", { name: "全部（20）" }).click();
    await dialogOf(b).getByRole("button", { name: "返す", exact: true }).click();
    await dialogOf(b).getByText("貸し借りはありません").waitFor();
    assert.equal(wallet("loan-b"), 500);
    await a.evaluate(() => window.PointLoans.collect());
    assert.equal(wallet("loan-a"), 500);
    await b.screenshot({ path: "/tmp/point-loans.png" });

    // The points dialog opens the screen.
    await b.evaluate(() => window.PointLoans.close());
    await b.evaluate(() => window.openStudyPoints());
    await b.getByRole("button", { name: "ポイントの貸し借り" }).click();
    await dialogOf(b).locator(".loans-person", { hasText: "loan-a" }).waitFor();
    assert.deepEqual(errors, []);
    console.log("PASS: loan out of the lender's wallet with the record, collected once by the borrower, 請求 paid, borrow request declined, matching histories, repay capped at the debt, guest message, opened from the points dialog");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
