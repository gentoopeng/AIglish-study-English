// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/login-splash.smoke.cjs
// The startup splash and the login screen: TangoLabo over the device's last background; signed out,
// the login form shows once the splash leaves; signed in, the form is never shown; the warm-up of
// the first 10 words can be turned off in the settings (kept with the profile).
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const base = process.env.APP_URL || "http://127.0.0.1:8000";
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false }));
      // Recorded at the first paint, before any app script.
      document.addEventListener("DOMContentLoaded", () => {
        window.__atFirstPaint = { splashing: document.documentElement.classList.contains("app-splashing"), signedIn: document.documentElement.classList.contains("signed-in"), image: document.documentElement.style.getPropertyValue("--splash-image"), card: getComputedStyle(document.querySelector("#auth-gate-screen .auth-card")).visibility };
      });
    });
    // Signed out: the splash is up at first, then the login form with the TangoLabo letters.
    await page.goto(base);
    const first = await page.evaluate(() => window.__atFirstPaint);
    assert.equal(first.splashing, true);
    assert.equal(first.signedIn, false);
    await page.waitForFunction(() => !document.getElementById("appSplash"));
    assert.equal(await page.locator(".auth-brand").getAttribute("aria-label"), "TangoLabo");
    assert.ok(await page.locator("#auth-gate-screen .auth-card").isVisible());
    assert.equal(await page.locator("#loginPinInput").getAttribute("autocomplete"), "current-password", "the saved password still fills in");
    // The guest button works as before; the background is kept for the next start.
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.waitForFunction(() => !!localStorage.getItem("aiglish_splash_background"));
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("aiglish_splash_background"))), { src: "assets/background-night.webp", position: 50 });
    // A chosen bundled background is what the next start shows.
    await page.evaluate(() => localStorage.setItem("aiglish_splash_background", JSON.stringify({ src: "assets/background-classroom.webp", position: 30 })));
    // Signed in on this device: the form is hidden from the first paint, and the app opens.
    await page.goto(base);
    const again = await page.evaluate(() => window.__atFirstPaint);
    assert.equal(again.signedIn, true);
    assert.equal(again.card, "hidden");
    assert.match(again.image, /background-classroom\.webp/);
    await page.waitForFunction(() => !document.getElementById("appSplash"));
    assert.equal(await page.locator("#auth-gate-screen").isVisible(), false);
    // While the app has not decided (the gate still up), a signed-in device never shows the form, even after the splash.
    assert.equal(await page.evaluate(() => {
      document.documentElement.classList.add("signed-in");
      const gate = document.getElementById("auth-gate-screen");
      gate.style.removeProperty("display");
      const hidden = getComputedStyle(gate.querySelector(".auth-card")).visibility;
      gate.style.display = "none";
      return hidden;
    }), "hidden");
    // A photo is kept as a small JPEG copy.
    await page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 1200;
      c.height = 800;
      const g = c.getContext("2d");
      g.fillStyle = "#3a6";
      g.fillRect(0, 0, 1200, 800);
      const data = c.toDataURL("image/jpeg", 0.9);
      const id = myId;
      localStorage.setItem("aiglish_app_background_catalog_" + id, JSON.stringify({ backgrounds: [{ id: "p1", name: "写真", image: data, position: 40 }], mode: "photo", selected: "p1", updatedAt: 1 }));
      localStorage.setItem("aiglish_app_background_" + id, JSON.stringify({ mode: "photo", selected: "p1", updatedAt: 2 }));
      window.dispatchEvent(new Event("background-catalog-changed"));
    });
    await page.waitForFunction(() => /^data:image\/jpeg/.test(JSON.parse(localStorage.getItem("aiglish_splash_background") || "{}").src || ""), null, { timeout: 10000 });
    const photo = await page.evaluate(() => JSON.parse(localStorage.getItem("aiglish_splash_background")));
    assert.ok(photo.src.length < 60000 && photo.position === 40, String(photo.src.length));
    // Anything else in the splash's store is not used.
    await page.evaluate(() => localStorage.setItem("aiglish_splash_background", JSON.stringify({ src: 'x");background:red;("', position: 1 })));
    await page.goto(base);
    assert.equal((await page.evaluate(() => window.__atFirstPaint)).image, "");
    await page.waitForFunction(() => window.__learningBootReady === true);
    // A deleted account saved on this device: the saved id goes and the login form shows (not the splash, not an empty screen).
    await page.evaluate(() => {
      localStorage.setItem("core_v4_userId", "gone-user");
      localStorage.setItem("core_v4_account_deleted_gone-user", "1");
    });
    await page.goto(base);
    assert.equal((await page.evaluate(() => window.__atFirstPaint)).signedIn, true);
    await page.waitForFunction(() => !document.getElementById("appSplash") && !document.documentElement.classList.contains("signed-in"));
    assert.equal(await page.locator("#auth-gate-screen .auth-card").isVisible(), true);
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    // The warm-up switch: on at first, turned off, kept after a restart. A guest cannot change it.
    await page.evaluate(() => {
      myId = "splash-user";
      window.__runAppLoadedForTest?.();
    });
    const sw = page.locator("#loginWarmupEnabled");
    await page.evaluate(() => document.getElementById("settingsDialog").showModal());
    await page.evaluate(() => window.dispatchEvent(new StorageEvent("storage")));
    assert.equal(await sw.isChecked(), true);
    assert.equal(await sw.isDisabled(), false);
    await sw.uncheck();
    assert.equal(await page.evaluate(() => window.UserProfile.read().loginWarmup), false);
    await page.evaluate(() => window.dispatchEvent(new StorageEvent("storage")));
    assert.equal(await sw.isChecked(), false);
    await page.evaluate(() => {
      myId = "GUEST-000";
      window.dispatchEvent(new StorageEvent("storage"));
    });
    assert.equal(await sw.isDisabled(), true);
    await page.screenshot({ path: "/tmp/claude-0/settings.png" });
    // On an iPhone (iOS stable rendering stops animations page-wide) the letters still show, animated, and
    // with motion turned off they show at once.
    for (const motion of ["full", "off"]) {
      const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
      await phone.route("https://**/*", (r) => r.abort());
      await phone.addInitScript((m) => localStorage.setItem("aiglish_motion", m), motion);
      await phone.goto(base);
      assert.equal(await phone.evaluate(() => document.documentElement.classList.contains("ios-stable-rendering")), true);
      await phone.waitForTimeout(motion === "full" ? 1500 : 200);
      const seen = await phone.evaluate(() => [...document.querySelectorAll("#appSplash .splash-brand span, .auth-brand span")].map((el) => Number(getComputedStyle(el).opacity)));
      assert.ok(seen.length === 18 || seen.length === 9, String(seen.length));
      if (seen.length === 18) assert.ok(seen.slice(0, 9).every((o) => o > 0.95), motion + " splash " + seen);
      // The login screen's letters, once the splash has gone.
      await phone.waitForFunction(() => !document.getElementById("appSplash"));
      await phone.waitForTimeout(motion === "full" ? 1500 : 100);
      const login = await phone.evaluate(() => [...document.querySelectorAll(".auth-brand span")].map((el) => Number(getComputedStyle(el).opacity)));
      assert.ok(login.every((o) => o > 0.95), motion + " login " + login);
      await phone.close();
    }
    assert.deepEqual(errors, []);
    console.log("login-splash smoke ok");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
