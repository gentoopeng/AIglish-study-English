// The number on the app's home-screen icon: how many group talks have unread messages.
// Home-screen apps on iOS 16.4+ (and installed apps elsewhere) show it once notifications are
// allowed; it is updated whenever the group list is read, and when the app goes to the background.
(function () {
  "use strict";
  const key = "aiglish_app_badge",
    supported = () => typeof navigator.setAppBadge === "function";
  const enabled = () => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  };
  function update() {
    if (!supported()) return;
    const count = enabled() ? window.StudyGroups?.unreadCount?.() || 0 : 0;
    (count ? navigator.setAppBadge(count) : navigator.clearAppBadge?.())?.catch?.(() => {});
  }
  function render() {
    const section = document.getElementById("appBadgeSettings"),
      input = document.getElementById("appBadgeEnabled"),
      note = document.getElementById("appBadgeStatus");
    if (!section) return;
    section.hidden = !supported();
    if (input) input.checked = enabled();
    if (note)
      note.textContent =
        enabled() && typeof Notification !== "undefined" && Notification.permission === "denied"
          ? "通知が許可されていないため表示できません。端末の設定で通知を許可してください。"
          : "ホーム画面に追加したアプリで、通知の許可が必要です。";
  }
  document.getElementById("appBadgeEnabled")?.addEventListener("change", async (event) => {
    const on = event.target.checked;
    try {
      localStorage.setItem(key, on ? "1" : "0");
    } catch {}
    // iOS shows a badge only for apps allowed to notify; ask on this tap.
    if (on && typeof Notification !== "undefined" && Notification.permission === "default")
      await Notification.requestPermission().catch(() => {});
    render();
    update();
  });
  document.addEventListener("study-groups-unread", update);
  document.addEventListener("visibilitychange", update);
  window.AppBadge = Object.freeze({ update, supported });
  render();
  window.onAppLoaded?.(() => {
    render();
    update();
  });
})();
