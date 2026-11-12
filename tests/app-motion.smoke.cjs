// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/app-motion.smoke.cjs
// The app motion layer (app-motion.css / app-motion.js): the mode is decided before the first paint (an automated browser that did
// not ask gets "test": no motion; the device's "reduce motion" always means "off"), the setting in the sidebar changes and keeps
// it, the casino's motion layer follows it, and in full / calm the buttons, fields and cards get their touch feedback.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    async function open({ saved, reduced = false } = {}) {
      const page = await browser.newPage({ viewport: { width: 390, height: 800 } }),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("https://**/*", (r) => r.abort());
      await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
      await page.addInitScript((saved) => {
        localStorage.setItem("b3_tutorial_done", "1");
        localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
        if (saved && !localStorage.getItem("aiglish_motion")) localStorage.setItem("aiglish_motion", saved);
      }, saved);
      await page.goto("http://127.0.0.1:8000");
      await page.getByRole("button", { name: "ゲストで試す" }).click();
      await page.waitForFunction(() => window.__learningBootReady === true && window.AppMotion);
      return { page, errors };
    }
    const info = (page) =>
      page.evaluate(() => {
        const b = document.querySelector(".menu-trigger") || document.querySelector("button");
        const input = document.querySelector("#motionMenuButton");
        return {
          mode: document.documentElement.dataset.motion,
          casinoDisabled: document.getElementById("casinoMotionCss").disabled,
          buttonTransition: getComputedStyle(document.querySelector(".nav-item")).transitionProperty,
          label: document.querySelector("#motionMenuValue").textContent,
          selectDisabled: input.disabled,
        };
      });

    // An automated browser that did not ask: "test" (nothing moves), and the casino's layer is off too.
    let { page, errors } = await open();
    let state = await info(page);
    assert.equal(state.mode, "test");
    assert.equal(state.casinoDisabled, true);
    assert.ok(!/scale/.test(state.buttonTransition), "no touch feedback in test mode: " + state.buttonTransition);
    await page.close();

    // Asked for: full. Buttons get the touch feedback; the casino layer is on.
    ({ page, errors } = await open({ saved: "full" }));
    state = await info(page);
    assert.equal(state.mode, "full");
    assert.equal(state.casinoDisabled, false);
    assert.match(state.buttonTransition, /scale/);
    // A press sinks the button (the separate `scale` property), a focused field gets its light.
    const pressed = await page.evaluate(() => {
      const b = document.querySelector(".nav-item:not(.active)");
      b.style.transition = "none";
      b.classList.add("am-probe");
      return getComputedStyle(b).scale;
    });
    assert.ok(pressed === "none" || pressed === "1", "not pressed: " + pressed);
    const field = await page.evaluate(() => {
      const el = document.createElement("input");
      el.type = "text";
      document.body.append(el);
      el.focus();
      const t = getComputedStyle(el).transitionProperty;
      el.remove();
      return t;
    });
    assert.match(field, /box-shadow/);

    // Stage 2: tabs fade and rise from the side they lie on (not the casino tab), the pill under the navigation moves, the side menu's
    // veil fades with a class on <body>, its entries come one after another.
    await page.evaluate(() => window.switchTab("study"));
    const tab = await page.evaluate(() => ({
      dir: document.documentElement.dataset.amDir,
      tab: getComputedStyle(document.getElementById("view-study")).animationName,
      child: getComputedStyle(document.querySelector("#view-study > :nth-child(1)")).animationName,
      pillX: document.getElementById("appMainBottomNavBar").style.getPropertyValue("--am-nav-x"),
      pillOn: document.getElementById("appMainBottomNavBar").style.getPropertyValue("--am-nav-on"),
    }));
    assert.deepEqual([tab.dir, tab.tab, tab.child, tab.pillOn], ["next", "am-tab-in", "am-tab-child", "1"]);
    await page.evaluate(() => window.switchTab("vocab"));
    const back = await page.evaluate(() => [document.documentElement.dataset.amDir, document.getElementById("appMainBottomNavBar").style.getPropertyValue("--am-nav-x")]);
    assert.equal(back[0], "prev");
    assert.notEqual(back[1], tab.pillX, "the pill moved with the chosen item");
    await page.evaluate(() => window.switchTab("casino"));
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.getElementById("view-casino")).animationName), "am-tab-in", "the fixed casino tab is left alone");
    await page.evaluate(() => window.switchTab("vocab"));
    await page.evaluate(() => window.toggleSidebar(true));
    await page.waitForTimeout(700);
    const side = await page.evaluate(() => {
      const veil = getComputedStyle(document.getElementById("sidebarOverlay"));
      return { open: document.body.classList.contains("am-sidebar-open"), opacity: veil.opacity, visibility: veil.visibility, item: getComputedStyle(document.querySelector(".sidebar-menu-list > :nth-child(3)")).animationName };
    });
    assert.deepEqual([side.open, side.opacity, side.visibility, side.item], [true, "1", "visible", "am-side-in"]);
    await page.evaluate(() => window.toggleSidebar(false));
    await page.waitForTimeout(700);
    const shut = await page.evaluate(() => ({ open: document.body.classList.contains("am-sidebar-open"), visibility: getComputedStyle(document.getElementById("sidebarOverlay")).visibility }));
    assert.deepEqual([shut.open, shut.visibility], [false, "hidden"]);

    // Stage 3: dialogs come up (opacity / size, no leftover), toasts are drawn with classes and leave by themselves, the points glow.
    await page.evaluate(() => window.alert("こんにちは"));
    await page.locator("dialog.app-alert[open]").waitFor();
    const dlg = await page.evaluate(() => [getComputedStyle(document.querySelector("dialog.app-alert")).animationName, getComputedStyle(document.querySelector("dialog.app-alert"), "::backdrop").animationName]);
    assert.deepEqual(dlg, ["am-dialog-in", "am-backdrop-in"]);
    await page.evaluate(() => document.querySelector("dialog.app-alert button").click());
    await page.waitForTimeout(700);
    const left = await page.evaluate(() => {
      document.getElementById("profileDialog").showModal();
      return getComputedStyle(document.getElementById("profileDialog")).animationName;
    });
    assert.equal(left, "am-dialog-in", "the menu dialogs get the same entrance");
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("profileDialog")).scale), "none", "nothing is left on the dialog afterwards");
    await page.evaluate(() => document.getElementById("profileDialog").close());
    await page.evaluate(() => { window.showToast("保存しました", "ok"); window.showToast("失敗", "err"); window.showToast("注意", "warn"); window.showToast("四つ目", "ok"); });
    const toasts = await page.evaluate(() => [...document.querySelectorAll("#toastHost .am-toast")].map((t) => [t.textContent, t.className, getComputedStyle(t).animationName]));
    assert.equal(toasts.length, 3, "at most three at once");
    assert.deepEqual(toasts.map((t) => t[0]), ["失敗", "注意", "四つ目"]);
    assert.ok(toasts[0][1].includes("is-err") && toasts[1][1].includes("is-warn"));
    assert.equal(toasts[2][2], "am-toast-in");
    await page.waitForFunction(() => !document.querySelector("#toastHost .am-toast"), null, { timeout: 6000 });
    const glow = await page.evaluate(async () => {
      const el = document.getElementById("headerStudyPoints");
      el.textContent = "100pt";
      await new Promise((r) => setTimeout(r, 50));
      el.textContent = "150pt";
      await new Promise((r) => setTimeout(r, 50));
      const up = el.className.includes("am-up");
      el.textContent = "120pt";
      await new Promise((r) => setTimeout(r, 50));
      return [up, el.className.includes("am-down"), el.textContent];
    });
    assert.deepEqual(glow, [true, true, "120pt"]);

    // Stage 4: rows that appear right after going somewhere wait until they are on screen, then come in (a row added later, as a live
    // update does, just appears); "loading…" lines shimmer; the book list's bar grows in.
    const rows = await page.evaluate(async () => {
      window.switchTab("community");
      const host = document.getElementById("view-community");
      const add = (n) => {
        const box = document.createElement("div");
        box.id = "am-box";
        for (let i = 0; i < n; i++) {
          const row = document.createElement("div");
          row.className = "people-row";
          row.style.height = "60px";
          row.textContent = "row " + i;
          box.append(row);
        }
        host.prepend(box);
        return box;
      };
      const first = add(30);
      await new Promise((r) => setTimeout(r, 120));
      const rowsNow = [...first.children];
      const result = {
        waitingBelowTheFold: rowsNow[29].classList.contains("am-wait"),
        visibleOneReleased: !rowsNow[0].classList.contains("am-wait"),
        animated: [...first.children].slice(0, 3).some((r) => r.classList.contains("am-go")),
      };
      first.remove();
      await new Promise((r) => setTimeout(r, 1100));
      const late = add(2);
      await new Promise((r) => setTimeout(r, 60));
      result.late = [...late.children].some((r) => r.classList.contains("am-wait") || r.classList.contains("am-go"));
      late.remove();
      return result;
    });
    assert.deepEqual(rows, { waitingBelowTheFold: true, visibleOneReleased: true, animated: true, late: false });
    const shimmer = await page.evaluate(async () => {
      const p = document.createElement("p");
      p.textContent = "読み込み中…";
      document.body.append(p);
      await new Promise((r) => setTimeout(r, 60));
      const on = [p.classList.contains("am-loading"), getComputedStyle(p).animationName];
      p.textContent = "完了しました";
      await new Promise((r) => setTimeout(r, 60));
      const off = p.classList.contains("am-loading");
      p.remove();
      const fill = document.createElement("span");
      fill.className = "textbook-list-progress-fill";
      document.body.append(fill);
      const bar = getComputedStyle(fill).animationName;
      fill.remove();
      return { on, off, bar };
    });
    assert.deepEqual(shimmer, { on: [true, "am-shimmer"], off: false, bar: "am-bar-grow" });

    // The setting: calm, then off; it is kept, and the casino layer follows.
    // (one line in the sidebar menu that goes round: おしゃれ → 控えめ → なし)
    const next = () => page.evaluate(() => document.getElementById("motionMenuButton").click());
    await next();
    assert.deepEqual([(await info(page)).mode, (await info(page)).label], ["calm", "控えめ"]);
    assert.equal(await page.evaluate(() => localStorage.getItem("aiglish_motion")), "calm");
    await next();
    state = await info(page);
    assert.deepEqual([state.mode, state.casinoDisabled], ["off", true]);
    await page.reload();
    await page.waitForFunction(() => window.__learningBootReady === true && window.AppMotion);
    assert.equal((await info(page)).mode, "off", "kept after a restart");
    assert.deepEqual(errors, []);
    await page.close();

    // Off (and test): the old behaviour stays — no tab animation, the veil is switched with display.
    ({ page, errors } = await open({ saved: "off" }));
    const plain = await page.evaluate(() => {
      window.switchTab("study");
      window.toggleSidebar(true);
      const veilOpen = getComputedStyle(document.getElementById("sidebarOverlay")).display;
      window.toggleSidebar(false);
      return { tab: getComputedStyle(document.getElementById("view-study")).animationName, veilOpen, veilShut: getComputedStyle(document.getElementById("sidebarOverlay")).display };
    });
    assert.deepEqual(plain, { tab: "none", veilOpen: "block", veilShut: "none" });
    const quiet = await page.evaluate(async () => {
      const p = document.createElement("p");
      p.textContent = "読み込み中…";
      document.body.append(p);
      await new Promise((r) => setTimeout(r, 60));
      return p.classList.contains("am-loading");
    });
    assert.equal(quiet, false, "no shimmer when motion is off");
    // (and the app's own toast, drawn with inline styles, stays as it was)
    const old = await page.evaluate(() => { window.showToast("ふつう", "ok"); const t = document.querySelector("#toastHost > div"); return [t.className, t.style.opacity !== undefined]; });
    assert.deepEqual(old, ["", true]);
    assert.deepEqual(errors, []);
    await page.close();

    // The device's "reduce motion" always means off, even when full was chosen; the setting is locked.
    ({ page, errors } = await open({ saved: "full", reduced: true }));
    state = await info(page);
    assert.deepEqual([state.mode, state.casinoDisabled, state.selectDisabled], ["off", true, true]);
    await page.close();
    console.log("app motion smoke passed");
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
