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
      ? window.StudyPoints.pendingAmount(value)
        ? "端末に記録済み・同期待ち " +
          window.StudyPoints.pendingAmount(value) +
          "pt"
        : "時間記録をクラウドと照合待ち"
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
          {
            card: "単語カード",
            quiz: "単語バトルの正解",
            review: "苦手復習",
            work: "ワークの学習記録",
            time: "勉強時間",
          }[entry.source || "review"] +
            " · " +
            entry.bookName +
            (entry.source === "time" ? "" : " · #" + entry.num),
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
      const amount = node("span", "+" + entry.amount + "pt");
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
    methods.append(node("h3", "学習内容に合わせて支給"));
    for (const [name, amount, detail] of [
      [
        "単語カード",
        "2pt／単語・日",
        "スワイプして理解度を記録。最初の10単語も同じ条件です。○・△・×で金額は変わりません。",
      ],
      [
        "単語バトルの正解",
        "2pt／単語・日",
        "正解した単語が対象。シングル・対戦とも同じです。失点・コンボ・イベント・順位の設定では変わりません。",
      ],
      [
        "翌日以降の苦手復習",
        "2pt／単語・日",
        "前日までに×・△を付けた意味に正解。正解は×→△→○と1段階ずつ上げます。",
      ],
      [
        "ワークの個別記録",
        "2pt／問題・日",
        "問題やページの理解度を個別に記録。小問は別の問題として扱います。一括記録・インポート・リセットは対象外です。",
      ],
      [
        "実測の勉強時間",
        "1pt／1分",
        "この更新後にアプリで計測した時間だけが対象。1日分を合算して1分未満は切り捨て。手入力・過去の時間は対象外です。寝落ちの取り消し後、翌日0:06以降の起動・学習終了・保存でポイントに反映します。複数端末の重複を防ぐため、同じ5分区間では実測が多い端末だけを採用します。",
      ],
    ]) {
      methods.append(
        node("h3", name),
        node("p", amount, "points-method-value"),
        node("p", detail),
      );
    }
    methods.append(
      node("h3", "重複して支給しません"),
      node(
        "p",
        "どの方法で答えても1単語2ptです。同じ単語帳の同じ単語は、複数の意味や方法を含めて日本時間で1日1回分。単語カードで2ptもらった単語は、同じ日にバトルや苦手復習で正解しても増えません。獲得履歴も単語・日ごとに表示します。",
      ),
      node(
        "p",
        "獲得ポイントの総額・1日全体の上限はありません。ログインだけ・単語帳一覧の理解度ボタン・グループ目標の達成・対戦順位だけでは増えず、負けても獲得済みポイントは減りません。",
      ),
      node(
        "p",
        "学習終了時・スリープ時に同期します。通信できない場合も端末に残し、次の保存時に再試行します。同期待ちは、別端末での支給と照合して確定します。",
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
    window.StudyPoints.collectTime().catch((error) =>
      console.warn("時間ポイントは次の保存時に再確認します", error),
    );
    // One-time publication of already confirmed points, never upload pending answers at boot.
    window.StudyPoints.publish().catch((error) =>
      console.warn("ポイント合計は次の保存時に公開を再試行します", error),
    );
  });
  window.onBeforeAppLoad?.(() => {
    close();
  });
})();
