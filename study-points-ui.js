// Point history is cached; only the explicit refresh button reads the cloud.
(function () {
  "use strict";
  const owner = () => (typeof myId === "string" && myId ? myId : "GUEST-000");
  let dialog = null,
    account = "",
    busy = false;
  const node = (tag, text, cls) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  };
  function renderHeader() {
    const el = document.getElementById("headerStudyPoints");
    if (!el) return;
    try {
      el.textContent =
        window.StudyPoints.balance().toLocaleString("ja-JP") + "pt";
    } catch {
      el.textContent = "—pt";
    }
  }
  function close() {
    dialog?.close();
    dialog?.remove();
    dialog = null;
    busy = false;
  }
  function paint() {
    renderHeader();
    if (!dialog || owner() !== account) return;
    const value = window.StudyPoints.read(account),
      balance = window.StudyPoints.balance(account);
    dialog.querySelector("[data-points-total]").textContent =
      balance.toLocaleString("ja-JP") + "pt";
    dialog.querySelector("[data-points-pending]").textContent = Object.keys(
      value.pending,
    ).length
      ? "端末に記録済み・同期待ち " +
        Object.keys(value.pending).length * 10 +
        "pt"
      : "";
    const list = dialog.querySelector("[data-points-history]");
    list.replaceChildren();
    const entries = Object.entries(value.history);
    if (!entries.length)
      list.append(node("li", "まだ獲得履歴はありません。", "points-empty"));
    for (const [token, entry] of entries) {
      const row = node("li"),
        copy = node("div"),
        title = node("strong", entry.word || "単語 " + entry.num),
        detail = node(
          "small",
          "苦手復習 · " + entry.bookName + " · #" + entry.num,
        ),
        date = node(
          "time",
          entry.at
            ? new Date(entry.at).toLocaleString("ja-JP", {
                timeZone: "Asia/Tokyo",
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : entry.day,
        );
      date.dateTime = entry.at ? new Date(entry.at).toISOString() : entry.day;
      copy.append(title, detail, date);
      const amount = node("span", "+10pt");
      if (value.pending[token]) amount.append(node("small", "同期待ち"));
      row.append(copy, amount);
      list.append(row);
    }
  }
  async function refresh() {
    if (busy || !dialog) return;
    busy = true;
    const current = dialog,
      id = account,
      button = current.querySelector("[data-points-refresh]"),
      status = current.querySelector("[data-points-status]");
    button.disabled = true;
    status.textContent = "更新しています…";
    try {
      const saved = await window.StudyPoints.refresh(id);
      if (dialog !== current || owner() !== id) return;
      paint();
      status.textContent = saved
        ? "クラウドの記録を確認しました。"
        : "端末の記録を表示しています。接続後に再試行してください。";
    } catch {
      if (dialog === current && owner() === id)
        status.textContent =
          "更新できませんでした。端末の記録を保持しています。";
    } finally {
      if (dialog === current) {
        busy = false;
        button.disabled = false;
      }
    }
  }
  window.openStudyPoints = function () {
    close();
    account = owner();
    dialog = node("dialog", undefined, "study-points-dialog");
    dialog.setAttribute("aria-label", "ポイント");
    const header = node("header"),
      heading = node("h2", "ポイント"),
      dismiss = node("button", "×");
    dismiss.type = "button";
    dismiss.setAttribute("aria-label", "ポイントを閉じる");
    dismiss.onclick = close;
    header.append(heading, dismiss);
    const total = node("p", undefined, "points-total");
    total.dataset.pointsTotal = "";
    const pending = node("p", undefined, "points-pending");
    pending.dataset.pointsPending = "";
    const tabs = node("div", undefined, "points-tabs");
    for (const [id, label] of [
      ["history", "獲得履歴"],
      ["methods", "獲得方法"],
    ]) {
      const b = node("button", label);
      b.type = "button";
      b.setAttribute("aria-pressed", String(id === "history"));
      b.onclick = () => {
        tabs
          .querySelectorAll("button")
          .forEach((el) => el.setAttribute("aria-pressed", String(el === b)));
        dialog.querySelector("[data-points-history-panel]").hidden =
          id !== "history";
        dialog.querySelector("[data-points-methods]").hidden = id !== "methods";
      };
      tabs.append(b);
    }
    const history = node("section"),
      label = node("h3", "最近100件"),
      list = node("ol", undefined, "points-history");
    history.dataset.pointsHistoryPanel = "";
    list.dataset.pointsHistory = "";
    history.append(label, list);
    const methods = node("section", undefined, "points-methods");
    methods.dataset.pointsMethods = "";
    methods.hidden = true;
    methods.append(
      node("h3", "苦手復習で正解"),
      node("p", "正解5pt ＋ 後日復習5pt", "points-method-value"),
      node(
        "p",
        "前日までに×・△を付けた意味を苦手復習で正解すると、合計10ptを獲得します。同じ単語は意味が複数あっても、日本時間で1日1回です。",
      ),
      node(
        "p",
        "単語カードで理解度を変更するだけではポイントは増えません。単語バトルの得点と累計ポイントは別です。",
      ),
      node(
        "p",
        "学習終了時・スリープ時・手動セーブ時に同期します。通信できない場合も端末に残し、次の保存時に再試行します。",
      ),
    );
    const footer = node("footer"),
      update = node("button", "クラウドから更新");
    update.type = "button";
    update.dataset.pointsRefresh = "";
    update.onclick = refresh;
    const status = node("p");
    status.dataset.pointsStatus = "";
    status.setAttribute("role", "status");
    footer.append(update, status);
    dialog.append(header, total, pending, tabs, history, methods, footer);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });
    document.body.append(dialog);
    try {
      paint();
    } catch (error) {
      dialog.querySelector("[data-points-total]").textContent = "—pt";
      dialog.querySelector("[data-points-status]").textContent =
        "端末のポイント記録を確認できません。保存内容は保持しています。";
    }
    dialog.showModal();
  };
  window.addEventListener("study-points-changed", () => {
    try {
      paint();
    } catch {
      renderHeader();
    }
  });
  window.onAppLoaded?.(() => {
    renderHeader();
    // One-time publication of already confirmed points, never upload pending answers at boot.
    window.StudyPoints.publish().catch((error) =>
      console.warn("ポイント合計は次の保存時に公開を再試行します", error),
    );
  });
  window.onBeforeAppLoad?.(() => {
    close();
  });
})();
