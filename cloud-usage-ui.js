(function () {
  "use strict";
  function add(tag, text, parent) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    parent?.append(el);
    return el;
  }
  // データとバックアップ: saving is automatic, so this shows only when it last reached the cloud,
  // the optional file backup, and (folded away) this device's estimate of today's traffic.
  window.openCloudUsage = function () {
    window.toggleSidebar(false);
    const d = window.openLibraryDialog(
      "データとバックアップ",
      '<div class="cloud-usage-content" data-backup-host></div><button type="button" data-library-close>閉じる</button>',
    );
    d.classList.add("cloud-usage-dialog");
    const host = d.querySelector(".cloud-usage-content");
    const id = typeof myId === "string" ? myId : "";
    let marker;
    try {
      marker = JSON.parse(
        localStorage.getItem("game_save_cloud_meta_" + id) || "null",
      );
    } catch {}
    const state = add("section", undefined, host);
    state.className = "data-save-state";
    add("strong", "学習記録は自動で保存されます", state);
    add(
      "p",
      window.FirestoreReadGuard?.paused?.()
        ? "いまはクラウドの利用制限中です。記録は端末に残し、あとで同期します。"
        : "最終クラウド保存: " +
            (marker?.savedAt
              ? new Date(marker.savedAt).toLocaleString("ja-JP")
              : "まだありません"),
      state,
    );
    window.FileBackups?.attach(d);
    const usage = add("details", undefined, host);
    usage.className = "data-usage";
    add("summary", "今日の通信量（この端末の推定）", usage);
    const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10),
      rows = window.CloudUsage?.snapshot?.().days[today] || {};
    if (!Object.keys(rows).length) add("p", "まだ記録はありません。", usage);
    else {
      const table = add("table", undefined, usage),
        head = add("tr", undefined, add("thead", undefined, table));
      for (const text of ["", "読取", "書込", "失敗"]) add("th", text, head);
      const body = add("tbody", undefined, table);
      for (const [label, value] of Object.entries(rows)) {
        const tr = add("tr", undefined, body);
        for (const v of [label, value.reads, value.writes, value.errors])
          add("td", String(v), tr);
      }
    }
  };
})();
