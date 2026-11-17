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
    minimum = html.getAttribute("data-motion") === "full" ? 1700 : 0,
    started = performance.now();
  const leave = () => setTimeout(() => splash?.hide(), Math.max(0, minimum - (performance.now() - started)));
  const savedId = () => {
    try {
      return !!localStorage.getItem("core_v4_userId");
    } catch {
      return false;
    }
  };
  let poll = 0;
  function update() {
    if (!gate) return leave();
    if (gate.style.display === "none") {
      // The app is shown for the saved account.
      clearInterval(poll);
      return leave();
    }
    if (!html.classList.contains("signed-in") || !savedId() || gate.style.display === "flex") {
      // Nobody to start: the login form.
      html.classList.remove("signed-in");
      clearInterval(poll);
      leave();
    }
  }
  if (gate) new MutationObserver(update).observe(gate, { attributes: true, attributeFilter: ["style"] });
  // A saved id removed without touching the gate (a deleted account) is caught by looking now and then.
  if (html.classList.contains("signed-in")) poll = setInterval(update, 300);
  setTimeout(() => clearInterval(poll), 60000);
  update();
})();
