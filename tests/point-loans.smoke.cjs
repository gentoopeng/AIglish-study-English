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
    // signIn: how long after the app has loaded the player signs in (a slow login).
    async function pageFor(id, signIn = 0) {
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
      if (signIn) await page.waitForTimeout(signIn);
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
        // A plain write (the 既読 mark): one document, merged.
        window.__plainWrites = 0;
        window.fbSetDoc = async (ref, value, options) => {
          window.__plainWrites++;
          await __lnCommit({ reads: {}, writes: [{ path: pathOf(ref), value: JSON.parse(JSON.stringify(value)), merge: options?.merge === true }] });
        };
      }, id);
      return page;
    }
    const a = await pageFor("loan-a"),
      b = await pageFor("loan-b");
    const wallet = (id) => docs.get("users/" + id + "/learningPoints/main").balance;
    const dialogOf = (page) => page.locator("dialog.loans-dialog[open]");

    // From B's profile, A chooses 貸す: the talk with B opens with the points form set to lend.
    await a.evaluate(() => window.People.open("loan-b", { profile: true }));
    await a.locator(".people-loans").getByRole("button", { name: "貸す", exact: true }).click();
    await dialogOf(a).getByRole("heading", { name: "loan-bさん" }).waitFor();
    // A talk screen in the points dialog's frame, tall enough to read.
    assert.equal(await dialogOf(a).evaluate((d) => d.classList.contains("study-points-dialog") && d.classList.contains("is-talk")), true);
    await dialogOf(a).locator("[data-loan-amount]").waitFor();
    assert.ok((await dialogOf(a).evaluate((el) => el.getBoundingClientRect().height)) > 400);
    // Opened from 貸す, the form is set to lend, with no interest unless one is chosen.
    assert.equal(await dialogOf(a).getByRole("tab", { name: "貸す" }).getAttribute("aria-selected"), "true");
    assert.equal(await dialogOf(a).getByRole("button", { name: "利子 なし" }).getAttribute("aria-pressed"), "true");
    await dialogOf(a).locator("[data-loan-amount]").fill("50");
    await dialogOf(a).getByRole("textbox", { name: "ひとこと" }).fill("ポーカー用");
    await dialogOf(a).getByRole("button", { name: "貸す", exact: true }).click();
    await dialogOf(a).locator(".loans-summary strong", { hasText: "50pt" }).waitFor();
    assert.match(await dialogOf(a).locator(".loans-summary").innerText(), /loan-bさんに 50pt 貸しています/);
    // The loan shows in the talk as A's own card, on the right.
    assert.equal(await dialogOf(a).locator(".talk-row.is-mine .talk-card span").last().innerText(), "50pt 貸した");
    assert.equal(wallet("loan-a"), 450);
    assert.equal(await a.evaluate(() => window.StudyPoints.balance()), 450);
    assert.equal(wallet("loan-b"), 500);
    // A says something; it is a green bubble on the right.
    await dialogOf(a).getByRole("textbox", { name: "メッセージ" }).fill("ポーカーがんばって");
    await dialogOf(a).getByRole("button", { name: "送信" }).click();
    await dialogOf(a).locator(".talk-row.is-mine .talk-bubble", { hasText: "ポーカーがんばって" }).waitFor();
    // B collects it once, however often they look.
    await b.evaluate(() => window.PointLoans.collect());
    await b.evaluate(() => window.PointLoans.collect());
    await b.evaluate(() => window.PointLoans.claim("loan-a__loan-b"));
    assert.equal(wallet("loan-b"), 550);
    assert.equal(await b.evaluate(() => window.StudyPoints.balance()), 550);
    // B's list shows the debt and the last line; B sees A's line on the left.
    await b.evaluate(() => window.PointLoans.open());
    await dialogOf(b).locator(".loans-person", { hasText: "loan-a" }).waitFor();
    assert.match(await dialogOf(b).locator(".loans-person").innerText(), /50pt 借りています/);
    assert.match(await dialogOf(b).locator(".loans-person .loans-last").innerText(), /ポーカーがんばって/);
    await dialogOf(b).locator(".loans-person").click();
    await dialogOf(b).getByText("loan-aさんから 50pt 借りています").waitFor();
    await dialogOf(b).locator(".talk-row.is-theirs .talk-bubble", { hasText: "ポーカーがんばって" }).waitFor();
    // B has lent nothing, so B cannot 請求.
    await dialogOf(b).getByRole("button", { name: "ポイント" }).click();
    assert.equal(await dialogOf(b).getByRole("tab", { name: "請求" }).isDisabled(), true);

    // A asks for 30 back (請求); B pays it from the request.
    await dialogOf(a).getByRole("button", { name: "ポイント" }).click();
    await dialogOf(a).getByRole("tab", { name: "請求" }).click();
    await dialogOf(a).locator("[data-loan-amount]").fill("80");
    await dialogOf(a).getByRole("button", { name: "返してと請求" }).click();
    assert.match(await dialogOf(a).locator(".loans-error").innerText(), /請求できるのは貸している50ptまで/);
    await dialogOf(a).locator("[data-loan-amount]").fill("30");
    await dialogOf(a).getByRole("button", { name: "返してと請求" }).click();
    await dialogOf(a).getByText("30pt 請求した・返事待ち").waitFor();
    await b.evaluate(() => window.PointLoans.person("loan-a", "loan-a"));
    await dialogOf(b).getByText("30pt 請求された・返事待ち").waitFor();
    await dialogOf(b).locator(".loans-request").getByRole("button", { name: "払う" }).click();
    await dialogOf(b).getByText("loan-aさんから 20pt 借りています").waitFor();
    assert.equal(wallet("loan-b"), 520);
    await a.evaluate(() => window.PointLoans.collect());
    assert.equal(wallet("loan-a"), 480);

    // B asks to borrow 100; A declines. Both talks keep everything, oldest first.
    await dialogOf(b).getByRole("button", { name: "ポイント" }).click();
    await dialogOf(b).getByRole("tab", { name: "借りる" }).click();
    await dialogOf(b).locator("[data-loan-amount]").fill("100");
    await dialogOf(b).getByRole("button", { name: "借りたいと頼む" }).click();
    await dialogOf(b).getByText("100pt 借りたいと頼んだ・返事待ち").waitFor();
    await a.evaluate(() => window.PointLoans.person("loan-b", "loan-b"));
    await dialogOf(a).getByText("100pt 借りたいと頼まれた・返事待ち").waitFor();
    await dialogOf(a).locator(".loans-request").getByRole("button", { name: "断る" }).click();
    // Wait for the redrawn screen, not the one still showing before the answer.
    await dialogOf(a).locator(".talk-card span", { hasText: "断った" }).waitFor();
    assert.deepEqual(await dialogOf(a).locator(".talk-card span").allInnerTexts(), ["50pt 貸した", "30pt 請求した・済み", "30pt 返ってきた", "100pt 借りたいと頼まれた・断った"]);
    await b.evaluate(() => window.PointLoans.person("loan-a", "loan-a"));
    await dialogOf(b).locator(".talk-card span", { hasText: "断られた" }).waitFor();
    assert.deepEqual(await dialogOf(b).locator(".talk-card span").allInnerTexts(), ["50pt 借りた", "30pt 請求された・済み", "30pt 返した", "100pt 借りたいと頼んだ・断られた"]);
    assert.match(await dialogOf(b).locator(".talk-log").innerText(), /「ポーカー用」/);
    // Repaying the rest: no more than is owed.
    await dialogOf(b).getByRole("button", { name: "ポイント" }).click();
    await dialogOf(b).getByRole("tab", { name: "返す" }).click();
    await dialogOf(b).getByRole("button", { name: "全部（20）" }).click();
    assert.match(await dialogOf(b).locator(".loans-preview").innerText(), /返したあと 残り 0pt/);
    await dialogOf(b).getByRole("button", { name: "返す", exact: true }).click();
    await dialogOf(b).getByText("貸し借りはありません").waitFor();
    assert.equal(wallet("loan-b"), 500);
    await a.evaluate(() => window.PointLoans.collect());
    assert.equal(wallet("loan-a"), 500);
    await b.screenshot({ path: "/tmp/point-loans.png" });

    // A loan with interest: B asks for 100, A answers the request choosing 10%; B owes 110 and
    // pays it all back.
    await b.evaluate(() => window.PointLoans.person("loan-a", "loan-a"));
    await dialogOf(b).getByRole("button", { name: "ポイント" }).click();
    await dialogOf(b).getByRole("tab", { name: "借りる" }).click();
    await dialogOf(b).locator("[data-loan-amount]").fill("100");
    await dialogOf(b).getByRole("button", { name: "借りたいと頼む" }).click();
    await dialogOf(b).getByText("100pt 借りたいと頼んだ・返事待ち").waitFor();
    await a.evaluate(() => window.PointLoans.person("loan-b", "loan-b"));
    await dialogOf(a).locator(".loans-request").getByRole("button", { name: "条件を決めて貸す" }).click();
    assert.equal(await dialogOf(a).locator("[data-loan-amount]").inputValue(), "100");
    await dialogOf(a).getByRole("button", { name: "利子 10%" }).click();
    assert.match(await dialogOf(a).locator(".loans-preview").innerText(), /返してもらう額 110pt（利子 10pt）/);
    await dialogOf(a).getByRole("button", { name: "貸す", exact: true }).click();
    await dialogOf(a).getByText("loan-bさんに 110pt 貸しています").waitFor();
    assert.match(await dialogOf(a).locator(".talk-card span").last().innerText(), /100pt 貸した（利子10%・返す額110pt）/);
    assert.equal(wallet("loan-a"), 400);
    await b.evaluate(() => window.PointLoans.person("loan-a", "loan-a"));
    await dialogOf(b).getByText("loan-aさんから 110pt 借りています").waitFor();
    assert.equal(wallet("loan-b"), 600);
    await dialogOf(b).getByRole("button", { name: "ポイント" }).click();
    await dialogOf(b).getByRole("tab", { name: "返す" }).click();
    await dialogOf(b).getByRole("button", { name: "全部（110）" }).click();
    await dialogOf(b).getByRole("button", { name: "返す", exact: true }).click();
    await dialogOf(b).getByText("貸し借りはありません").waitFor();
    assert.equal(wallet("loan-b"), 490);
    await a.evaluate(() => window.PointLoans.collect());
    assert.equal(wallet("loan-a"), 510);
    await a.evaluate(() => window.PointLoans.close());
    await b.evaluate(() => window.PointLoans.close());

    // あげる and もらう, with the 既読 mark. A gives B 40 (nobody owes anything), B opens the talk and
    // A then sees 既読; A asks B for 40 (もらう) and B answers あげる; neither can be done with the
    // casino or the 運営.
    assert.equal(wallet("loan-a"), 510);
    assert.equal(wallet("loan-b"), 490);
    await a.evaluate(() => window.PointLoans.person("loan-b", "loan-b"));
    await dialogOf(a).getByRole("button", { name: "ポイント" }).click();
    for (const name of ["貸す", "返す", "あげる", "借りる", "請求", "もらう"]) await dialogOf(a).getByRole("tab", { name }).waitFor();
    await dialogOf(a).getByRole("tab", { name: "あげる" }).click();
    await dialogOf(a).locator("[data-loan-amount]").fill("40");
    assert.match(await dialogOf(a).locator(".loans-preview").innerText(), /返してもらえません。あげたあと 所持 470pt/);
    await dialogOf(a).getByRole("textbox", { name: "ひとこと" }).fill("お祝い");
    await dialogOf(a).getByRole("button", { name: "あげる", exact: true }).click();
    await dialogOf(a).locator(".talk-card span", { hasText: "40pt あげた" }).waitFor();
    assert.match(await dialogOf(a).locator(".loans-summary").innerText(), /貸し借りはありません/);
    assert.equal(wallet("loan-a"), 470);
    assert.equal(wallet("loan-b"), 490);
    // Big amount on the card. B has seen the earlier lines (既読 sits under the last of them), but
    // not this one yet.
    assert.equal(await dialogOf(a).locator(".talk-row.is-give .card-amount").innerText(), "40pt");
    assert.equal(await dialogOf(a).locator(".talk-read").count(), 1);
    assert.equal(await dialogOf(a).locator(".talk-row.is-give .talk-read").count(), 0);
    await a.evaluate(() => window.PointLoans.close());
    // B collects it once, opens the talk, and the 既読 mark is written once.
    await b.evaluate(() => window.PointLoans.collect());
    await b.evaluate(() => window.PointLoans.claim("loan-a__loan-b"));
    assert.equal(wallet("loan-b"), 530);
    const writes0 = await b.evaluate(() => window.__plainWrites);
    await b.evaluate(() => window.PointLoans.person("loan-a", "loan-a"));
    await dialogOf(b).locator(".talk-card span", { hasText: "40pt もらった" }).waitFor();
    for (let i = 0; i < 40 && !docs.get("loan-a__loan-b".replace(/^/, "pointLoans/"))?.read?.["loan-b"]; i++) await b.waitForTimeout(100);
    const pair = docs.get("pointLoans/loan-a__loan-b");
    assert.equal(pair.read["loan-b"], pair.entries.filter((e) => e.from === "loan-a").at(-1).at);
    assert.equal(wallet("loan-b"), 530);
    assert.equal(await b.evaluate(() => window.__plainWrites), writes0 + 1);
    // Looking again writes nothing more, and nothing of what was sent is lost.
    await b.evaluate(() => window.PointLoans.person("loan-a", "loan-a"));
    await dialogOf(b).locator(".talk-card span", { hasText: "40pt もらった" }).waitFor();
    await b.waitForTimeout(300);
    assert.equal(await b.evaluate(() => window.__plainWrites), writes0 + 1);
    assert.equal(pair.entries.length, docs.get("pointLoans/loan-a__loan-b").entries.length);
    // A opens the talk again: 既読 under the give, but not under what is after what B has seen.
    await b.evaluate(() => window.PointLoans.close());
    await a.evaluate(() => window.PointLoans.person("loan-b", "loan-b"));
    await dialogOf(a).locator(".talk-row.is-give .talk-read", { hasText: "既読" }).waitFor();
    assert.equal(await dialogOf(a).locator(".talk-read").count(), 1);
    // A asks B for 40 (もらう); B answers あげる.
    await dialogOf(a).getByRole("button", { name: "ポイント" }).click();
    await dialogOf(a).getByRole("tab", { name: "もらう" }).click();
    await dialogOf(a).locator("[data-loan-amount]").fill("40");
    await dialogOf(a).getByRole("button", { name: "もらいたいと頼む" }).click();
    await dialogOf(a).locator(".talk-card span", { hasText: "40pt もらいたいと頼んだ・返事待ち" }).waitFor();
    await dialogOf(a).locator(".loans-request.is-mine").getByRole("button", { name: "取り消す" }).waitFor();
    await b.evaluate(() => window.PointLoans.person("loan-a", "loan-a"));
    await dialogOf(b).locator(".talk-card span", { hasText: "40pt もらいたいと頼まれた・返事待ち" }).waitFor();
    assert.equal(await dialogOf(b).locator(".loans-request").getByRole("button", { name: "断る" }).count(), 1);
    await dialogOf(b).locator(".loans-request").getByRole("button", { name: "あげる" }).click();
    await dialogOf(b).locator(".talk-card span", { hasText: "40pt もらいたいと頼まれた・済み" }).waitFor();
    assert.equal(wallet("loan-b"), 490);
    // A is asked nothing more, and 40pt arrive in A's wallet once.
    await a.evaluate(() => window.PointLoans.collect());
    await a.evaluate(() => window.PointLoans.claim("loan-a__loan-b"));
    assert.equal(wallet("loan-a"), 510);
    // The same request cannot be answered twice (B's screen is stale).
    const stale = docs.get("pointLoans/loan-a__loan-b").entries.find((e) => e.kind === "ask-give");
    assert.equal(await b.evaluate((id) => window.PointLoans.send("loan-a", "loan-a", 40, "give", "", id).then(() => "paid", (e) => e.message), stale.id), "この頼みはもう終わっています。");
    assert.equal(wallet("loan-b"), 490);
    await a.evaluate(() => window.PointLoans.close());
    await b.evaluate(() => window.PointLoans.close());
    // Nothing is given to, or asked of, the casino or the 運営.
    for (const [kind, other] of [["give", "CASINO"], ["give", "ADMIN"]])
      assert.match(await a.evaluate(([k, o]) => window.PointLoans.send(o, o, 5, k).then(() => "ok", (e) => e.message), [kind, other]), /あげたりもらったり/);
    assert.match(await a.evaluate(() => window.PointLoans.ask("ADMIN", "運営", 5, "ask-give").then(() => "ok", (e) => e.message)), /あげたりもらったり/);
    assert.equal(wallet("loan-a"), 510);

    // Points from the 運営: they reach B's wallet once, and B's talk with 運営 shows them, with
    // nothing to type (nobody reads it) and nothing to lend.
    await a.evaluate(() => window.PointLoans.grant("loan-b", "loan-b", 500, "がんばったで賞"));
    await b.evaluate(() => window.PointLoans.collect());
    await b.evaluate(() => window.PointLoans.collect());
    assert.equal(wallet("loan-b"), 990);
    await b.evaluate(() => window.PointLoans.open());
    await dialogOf(b).locator(".loans-person", { hasText: "運営" }).click();
    await dialogOf(b).getByText("500pt 届いた").waitFor();
    assert.match(await dialogOf(b).locator(".talk-log").innerText(), /「がんばったで賞」/);
    assert.equal(await dialogOf(b).getByRole("textbox", { name: "メッセージ" }).count(), 0);
    assert.match(await dialogOf(b).locator(".loans-summary").innerText(), /貸し借りはありません/);
    await b.evaluate(() => window.PointLoans.close());
    // The 運営 takes 100 back: B's device takes it from the wallet once, and the talk says so.
    await a.evaluate(() => window.PointLoans.grant("loan-b", "loan-b", 100, "調整", "charge"));
    await b.evaluate(() => window.PointLoans.collect());
    await b.evaluate(() => window.PointLoans.collect());
    assert.equal(wallet("loan-b"), 890);
    const ledger = await a.evaluate(() => window.PointLoans.adminLedger("loan-b"));
    assert.deepEqual(ledger.entries.map((e) => [e.kind, e.amount, e.taken]), [["gift", 500, true], ["charge", 100, true]]);
    assert.equal(ledger.balance, 890);
    await b.evaluate(() => window.PointLoans.person("ADMIN", "運営"));
    await dialogOf(b).getByText("100pt 引かれた").waitFor();
    await b.evaluate(() => window.PointLoans.close());
    // A player still signing in when the app loaded gets points sent to them without opening
    // anything: they are collected once the player is signed in.
    docs.set("users/loan-c", { playerName: "loan-c", studyPoints: 0 });
    docs.set("users/loan-c/learningPoints/main", { balance: 0, revision: 1, history: {} });
    await a.evaluate(() => window.PointLoans.grant("loan-c", "loan-c", 300, "ようこそ"));
    const c = await pageFor("loan-c", 3000);
    for (let i = 0; i < 40 && wallet("loan-c") !== 300; i++) await c.waitForTimeout(500);
    assert.equal(wallet("loan-c"), 300);
    await c.close();

    // An accident in すごろくビンゴ past the wallet: the rest is owed to the casino, one 請求 for
    // all of it, that can only be paid (not declined, no lending to the casino).
    await a.evaluate(async () => {
      await window.PointLoans.owe(150, "すごろくビンゴのアクシデント");
      await window.PointLoans.owe(50, "すごろくビンゴのアクシデント");
    });
    assert.equal(wallet("loan-a"), 510);
    await a.evaluate(() => window.PointLoans.open());
    await dialogOf(a).locator(".loans-person", { hasText: "カジノ" }).click();
    await dialogOf(a).getByText("200pt 請求された・返事待ち").waitFor();
    assert.equal(await dialogOf(a).locator(".loans-request").count(), 1);
    assert.equal(await dialogOf(a).locator(".loans-request").getByRole("button", { name: "断る" }).count(), 0);
    assert.equal(await dialogOf(a).getByRole("button", { name: "貸す", exact: true }).count(), 0);
    assert.equal(await dialogOf(a).getByRole("button", { name: "返してと請求" }).count(), 0);
    await dialogOf(a).locator(".loans-request").getByRole("button", { name: "払う" }).click();
    await dialogOf(a).getByText("貸し借りはありません").waitFor();
    assert.equal(wallet("loan-a"), 310);
    // Collecting never adds the casino's "loan" to the wallet.
    await a.evaluate(() => window.PointLoans.collect());
    assert.equal(wallet("loan-a"), 310);
    await a.evaluate(() => window.PointLoans.close());

    // With a slow cloud (every read takes 3 seconds) the list, a person and a profile still come
    // up at once from what was seen before; the cloud's copies fill them in behind.
    await a.evaluate(() => {
      const get = window.fbGetDoc;
      window.__fastGet = get;
      window.fbGetDoc = (ref) => new Promise((resolve) => setTimeout(() => resolve(get(ref)), 3000));
    });
    // The list kept on the device may name a pair whose record this device has never read (after
    // a restart): it is drawn with "…" until the record comes in, without an error.
    await a.evaluate(() => {
      const kept = JSON.parse(localStorage.getItem("aiglish_loans_inbox_loan-a") || "{}");
      kept["loan-a__loan-z"] = { other: "loan-z", name: "loan-z", at: Date.now() };
      localStorage.setItem("aiglish_loans_inbox_loan-a", JSON.stringify(kept));
    });
    let t0 = Date.now();
    await a.evaluate(() => void window.PointLoans.open());
    await dialogOf(a).locator(".loans-person", { hasText: "loan-z" }).waitFor({ timeout: 1500 });
    assert.match(await dialogOf(a).locator(".loans-person", { hasText: "loan-z" }).innerText(), /…/);
    await dialogOf(a).locator(".loans-person", { hasText: "loan-b" }).waitFor({ timeout: 1500 });
    assert.ok(Date.now() - t0 < 1500, "list in " + (Date.now() - t0) + "ms");
    t0 = Date.now();
    await dialogOf(a).locator(".loans-person", { hasText: "loan-b" }).click();
    await dialogOf(a).getByText("最新の記録を確かめています…").waitFor({ timeout: 1500 });
    assert.match(await dialogOf(a).locator(".loans-summary").innerText(), /貸し借りはありません/);
    await dialogOf(a).locator(".loans-loading").waitFor({ state: "detached", timeout: 8000 });
    await a.evaluate(() => window.PointLoans.close());
    t0 = Date.now();
    await a.evaluate(() => void window.People.open("loan-b", { profile: true }));
    await a.locator(".people-loans").waitFor({ timeout: 1500 });
    assert.ok(Date.now() - t0 < 1500, "profile in " + (Date.now() - t0) + "ms");
    await a.evaluate(() => (window.fbGetDoc = window.__fastGet));
    await a.evaluate(() => window.closeLibraryDialog?.());

    // The points dialog opens the screen.
    await b.evaluate(() => window.PointLoans.close());
    await b.evaluate(() => window.openStudyPoints());
    await b.getByRole("button", { name: "ポイントの貸し借り" }).click();
    await dialogOf(b).locator(".loans-person", { hasText: "loan-a" }).waitFor();
    assert.deepEqual(errors, []);
    console.log("PASS: a talk (lines, points and requests as bubbles), points from the 運営, lists, people and profiles open at once on a slow cloud, a loan with interest against a request, casino debt from an accident paid through one 請求, loan out of the lender's wallet with the record, collected once by the borrower, 請求 paid, borrow request declined, matching histories, repay capped at the debt, guest message, opened from the points dialog");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
