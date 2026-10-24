// Messages that used the browser's alert() show in the app's own dialog instead, in the app's
// colours and without blocking the page. Several messages in a row are shown one after another.
(function () {
  "use strict";
  const native = typeof window.alert === "function" ? window.alert.bind(window) : null,
    queue = [];
  let open = null;
  function show() {
    if (open || !queue.length) return;
    if (!document.body) return void setTimeout(show, 50);
    const text = queue.shift(),
      dialog = document.createElement("dialog"),
      message = document.createElement("p"),
      ok = document.createElement("button");
    dialog.className = "app-alert";
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-label", "お知らせ");
    message.textContent = text;
    ok.type = "button";
    ok.textContent = "OK";
    dialog.append(message, ok);
    document.body.append(dialog);
    open = dialog;
    const done = () => {
      dialog.close?.();
      dialog.remove();
      open = null;
      show();
    };
    ok.onclick = done;
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      done();
    });
    try {
      dialog.showModal();
    } catch {
      dialog.setAttribute("open", "");
    }
    ok.focus({ preventScroll: true });
  }
  window.alert = function (message) {
    queue.push(String(message ?? ""));
    show();
  };
  window.AppDialog = Object.freeze({ alert: window.alert, native, isOpen: () => !!open });
})();
