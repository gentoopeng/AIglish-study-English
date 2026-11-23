// The startup splash (index.html) and the signed-in state of the login screen.
// - Signed out: the splash leaves when the scripts are in; the login form rises in its place.
// - Signed in on this device (html.signed-in): the form stays hidden until the app has decided.
//   The splash leaves once the login gate is closed for the saved account. If the account cannot
//   start (deleted: AdminPlayers removes the saved id) or the gate is opened (logout), the class
//   goes and the form shows. A slow network keeps the form hidden: the splash may leave (after 9 s
//   at most), but the form never flashes up for someone who is signed in.
// With full motion the splash stays long enough for the letters to finish.
(function () {
  "use strict";
  const html = document.documentElement,
    splash = window.AppSplash,
    gate = document.getElementById("auth-gate-screen"),
    // (counted from the page's start: performance.now() is time since the page began to load)
    minimum = html.getAttribute("data-motion") === "full" ? 2300 : 0;
  const leave = () => setTimeout(() => splash?.hide(), Math.max(0, minimum - performance.now()));
  const savedId = () => {
    try {
      return !!localStorage.getItem("core_v4_userId");
    } catch {
      return false;
    }
  };
  let poll = 0;
  // The version and settings in the corner show on the login screen too (not over the app).
  const gateShown = () => !!gate && gate.style.display !== "none" && !html.classList.contains("signed-in");
  const corner = () => html.classList.toggle("gate-open", gateShown());
  if (gate) new MutationObserver(corner).observe(gate, { attributes: true, attributeFilter: ["style"] });
  new MutationObserver(corner).observe(html, { attributes: true, attributeFilter: ["class"] });
  corner();
  splash?.progress?.(0.88, html.classList.contains("signed-in") ? "ログインしています…" : "まもなく始まります…");
  function update() {
    if (!gate) return leave();
    if (gate.style.display === "none") {
      // The app is shown for the saved account.
      clearInterval(poll);
      splash?.progress?.(1, "準備ができました");
      return leave();
    }
    if (!html.classList.contains("signed-in") || !savedId() || gate.style.display === "flex") {
      // Nobody to start: the login form.
      html.classList.remove("signed-in");
      clearInterval(poll);
      splash?.progress?.(1, "準備ができました");
      leave();
    }
  }
  if (gate) new MutationObserver(update).observe(gate, { attributes: true, attributeFilter: ["style"] });
  // Starting a saved account can wait on the network (the cloud save, the deleted-account check). After 8 seconds the
  // splash offers a way out: the login form (as the screen before 10.140 showed it all along) or a fresh load.
  // Before 10.152 there was none: the gauge stood at 88% and, when the splash went, nothing was left to press.
  const help = document.querySelector("[data-splash-help]");
  if (help && html.classList.contains("signed-in")) {
    const showHelp = setTimeout(() => {
      if (!html.classList.contains("signed-in") || !splash?.shown?.()) return;
      help.hidden = false;
    }, 8000);
    help.querySelector("[data-splash-login]").onclick = () => {
      clearTimeout(showHelp);
      clearInterval(poll);
      html.classList.remove("signed-in");
      splash?.hide();
    };
    help.querySelector("[data-splash-reload]").onclick = () => location.replace(location.pathname + "?reload=" + Date.now());
    // Still waiting after 45 seconds: the login form comes up by itself (never an empty screen).
    setTimeout(() => {
      if (html.classList.contains("signed-in") && splash?.shown?.() && gate && gate.style.display !== "none") help.querySelector("[data-splash-login]").click();
    }, 45000);
  }
  // Always there (10.182): the login form without waiting for a stall — a guest who wants their
  // account, or a saved account that will not start. The same way out as the help's button.
  const alwaysLogin = document.querySelector("[data-splash-login-always]");
  if (alwaysLogin) alwaysLogin.onclick = () => {
    clearInterval(poll);
    html.classList.remove("signed-in");
    splash?.hide();
  };
  // A saved id removed without touching the gate (a deleted account) is caught by looking now and then.
  if (html.classList.contains("signed-in")) poll = setInterval(update, 300);
  setTimeout(() => clearInterval(poll), 60000);
  update();
})();
