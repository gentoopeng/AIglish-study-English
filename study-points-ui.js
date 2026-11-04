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
    const earned = window.StudyPoints.earned?.(account);
    dialog.querySelector("[data-points-earned]").textContent =
      "総獲得ポイント " + (earned === null || earned === undefined ? "集計中" : earned.toLocaleString("ja-JP") + "pt");
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
    // Every day's points, newest day first: study by kind (from the per-day record kept with the
    // wallet, topped up from the recent detail), the login bonus, lending, and the casino.
    const P = window.StudyPointPolicy;
    let fromDetail = {};
    for (const entry of Object.values(value.history))
      fromDetail = P.addDaily(fromDetail, entry.day, entry.source || "review", entry.amount, 1, entry.source === "time" ? Math.round(entry.amount / P.timeRate(entry.day)) : undefined);
    const days = new Map(Object.entries(P.mergeDaily(fromDetail, value.daily)).map(([day, row]) => [day, { study: row, casino: [] }]));
    // Newest casino line first, like the days.
    for (const entry of (window.Poker?.casinoLog?.(account) || []).slice().reverse()) {
      const day = P.day(entry.at);
      if (!days.has(day)) days.set(day, { study: {}, casino: [] });
      days.get(day).casino.push(entry);
    }
    const order = [...days.keys()].sort().reverse();
    if (!order.length) list.append(node("li", "まだ履歴はありません。", "points-empty"));
    const signed = (n) => (n > 0 ? "+" : n < 0 ? "−" : "±") + Math.abs(n).toLocaleString("ja-JP") + "pt";
    const LABELS = {
      time: ["勉強時間", (n) => n + "分"],
      card: ["単語カード", (n) => n + "回"],
      quiz: ["単語バトルの正解", (n) => n + "語"],
      review: ["苦手復習", (n) => n + "語"],
      work: ["ワークの学習記録", (n) => n + "問"],
      bonus: ["ログインボーナス", () => ""],
      loan: ["ポイントの貸し借り", () => ""],
    };
    const line = (title, detail, points, extra = "") => {
      const row = node("li", undefined, extra),
        copy = node("div");
      copy.append(node("strong", title));
      if (detail) copy.append(node("small", detail));
      row.append(copy, node("span", signed(points), points < 0 ? "is-minus" : ""));
      return row;
    };
    const shown = Math.min(order.length, dialog._daysShown || 30);
    for (const day of order.slice(0, shown)) {
      const { study, casino } = days.get(day),
        rows = [];
      // Study time first: it is the main thing studied for.
      for (const source of ["time", ...P.DAILY_SOURCES.filter((name) => name !== "time")]) {
        const item = study[source];
        if (!item || !item.p) continue;
        const [title, count] = LABELS[source];
        rows.push(line(title, count(item.n), item.p, "is-" + source));
      }
      for (const entry of casino)
        rows.push(line(window.Poker.LOG_GAMES[entry.g], "カジノ" + (entry.n > 1 ? " · " + entry.n + "回分" : ""), entry.d, "is-casino"));
      if (!rows.length) continue;
      const total = Object.values(study).reduce((a, item) => a + item.p, 0) + casino.reduce((a, e) => a + e.d, 0),
        head = node("li", undefined, "points-day"),
        date = node("time", new Date(P.dayStart(day)).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" }));
      date.dateTime = day;
      head.append(date, node("span", "計 " + signed(total), total < 0 ? "is-minus" : ""));
      list.append(head, ...rows);
    }
    if (order.length > shown) {
      const more = node("button", "もっと前を見る（あと" + (order.length - shown) + "日）", "points-more");
      more.type = "button";
      more.onclick = () => {
        dialog._daysShown = shown + 30;
        paint();
      };
      const item = node("li", undefined, "points-more-row");
      item.append(more);
      list.append(item);
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
      // The casino's record lives in the same wallet document.
      await window.Poker?.refreshLog?.(id).catch(() => null);
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
    // Everything earned by studying and the daily bonus; spending and the casino do not lower it.
    const earnedLine = node("p", undefined, "points-earned");
    earnedLine.dataset.pointsEarned = "";
    const pending = node("p", undefined, "points-pending");
    pending.dataset.pointsPending = "";
    const loans = node("button", "ポイントの貸し借り", "points-loans");
    loans.type = "button";
    loans.onclick = () => {
      close();
      window.PointLoans?.open();
    };
    const tabs = node("div", undefined, "points-tabs");
    for (const [id, label] of [
      ["history", "履歴"],
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
      label = node("h3", "日ごとの記録"),
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
        "5pt／1分",
        "アプリで計測した時間だけが対象。1日分を合算して1分未満は切り捨て。手入力・過去の時間は対象外です。寝落ちの取り消し後、翌日0:06以降の起動・学習終了・保存でポイントに反映します。複数端末の重複を防ぐため、同じ5分区間では実測が多い端末だけを採用します。",
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
        "獲得ポイントの総額・1日全体の上限はありません。ログインだけ・単語帳一覧の理解度ボタン・グループ目標の達成・対戦順位だけでは増えず、単語バトルで負けても獲得済みポイントは減りません。",
      ),
      node("h3", "カジノとポーカー"),
      node(
        "p",
        "カジノのゲームとポーカーは所持ポイントを賭けます。賭けられるのは、その日アプリで測った勉強時間1分につき100ptまでです（手入力の時間は数えません）。賭けた分は始めたときに引かれ、勝った分は終わったときに戻ります。この増減も履歴に載ります（同じゲームを30分以内に続けた分は1行にまとめ、何回分かを表示します）。総獲得ポイントには入りません。",
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
    dialog.append(header, total, earnedLine, pending, loans, tabs, history, methods, footer);
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
