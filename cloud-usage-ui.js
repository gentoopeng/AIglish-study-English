(function () {
  "use strict";
  const storageRows = [
    [
      "単語帳・ワークの本文",
      "端末にダウンロード＋Firebase",
      "開いた教材をIndexedDBへ保存。作成・変更した本文は終了時や手動保存でクラウドへ。",
    ],
    [
      "理解度・メモ・付箋・復習予定",
      "端末＋Firebase",
      "操作は端末に記録。学習終了・スリープ・手動保存で同期。途中の定期送信はしません。",
    ],
    [
      "勉強時間・学習カウンター",
      "端末＋Firebase",
      "端末で計測し、終了・スリープ・手動保存で同期。",
    ],
    ["フラッシュの中断位置", "端末", "この端末から再開するための記録。"],
    [
      "名前・写真・文字色・フレーム",
      "端末＋Firebase",
      "プロフィールの保存・装備時に同期。",
    ],
    [
      "共有メモ・教材の公開",
      "Firebase＋端末キャッシュ",
      "共有する・公開する操作で反映。",
    ],
    [
      "ユーザー・グループ・チャット",
      "Firebase＋一部端末キャッシュ",
      "メンバーやメッセージは共有データ。",
    ],
    [
      "ポイント・獲得履歴",
      "Firebase＋端末記録",
      "獲得時は端末に記録し、学習終了時などに同期。確定した合計だけを他のユーザーに表示。",
    ],
    [
      "対戦部屋・スコア",
      "Firebase＋一部端末記録",
      "対戦中の通信はリアルタイム。",
    ],
    [
      "背景・音楽・効果音",
      "アプリ配信ファイル＋端末設定",
      "画像・音声はGitHub Pages。選択や音量は端末に保存し、一部設定はセーブに含まれます。",
    ],
    [
      "長文リーダーの文章・履歴・本棚",
      "端末＋Firebase",
      "端末に保持し、学習終了や手動の全体セーブで同期。",
    ],
    [
      "APIキー",
      "端末＋全体セーブ",
      "端末設定に保存され、Firebaseの全体セーブにも含まれます。ファイル用バックアップからは除外します。",
    ],
    [
      "チャットの入力途中の下書き",
      "この端末のみ",
      "送信前の入力は端末へ保存。送信したメッセージはFirebaseへ保存。",
    ],
    ["通信量の推定値", "この端末のみ", "Firebaseには送信しません。"],
    [
      "ファイルへのバックアップ",
      "自分で選んだファイル",
      "書き出したJSON。iCloud Driveへ保存した場合もFirebaseとは別です。",
    ],
  ];
  function add(tag, text, parent) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    parent?.append(el);
    return el;
  }
  window.openCloudUsage = function () {
    window.toggleSidebar(false);
    const d = window.openLibraryDialog(
      "通信量と保存先",
      '<div class="cloud-usage-content"></div><button type="button" data-library-close>閉じる</button>',
    );
    d.classList.add("cloud-usage-dialog");
    const host = d.querySelector(".cloud-usage-content");
    add(
      "p",
      "この端末・このブラウザーで計測した推定値です。Firebase全体の残り無料枠や請求値ではありません。別端末・管理画面の使用分は含みません。",
      host,
    );
    const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10),
      rows = window.CloudUsage?.snapshot?.().days[today] || {},
      table = add("table", undefined, host),
      head = add("tr", undefined, add("thead", undefined, table));
    for (const text of ["本日（日本時間）", "読取", "書込", "失敗"])
      add("th", text, head);
    const body = add("tbody", undefined, table);
    for (const [label, value] of Object.entries(rows)) {
      const tr = add("tr", undefined, body);
      for (const v of [label, value.reads, value.writes, value.errors])
        add("td", String(v), tr);
    }
    if (!Object.keys(rows).length)
      add("p", "今日の計測記録はまだありません。", host);
    add(
      "p",
      "日本時間の日付で集計しています。Firebase無料枠のリセット時刻とは一致しません。キャッシュや再試行などにより実際の課金回数と異なります。失敗には通信切断も含みます。過去14日分を端末に保持します。",
      host,
    );
    add(
      "p",
      window.FirestoreReadGuard?.paused?.()
        ? "クラウド利用制限を検出しています。端末の記録を保持しています。"
        : "現在、クラウド利用制限は検出していません。",
      host,
    );
    const id = typeof myId === "string" ? myId : "";
    let marker;
    try {
      marker = JSON.parse(
        localStorage.getItem("game_save_cloud_meta_" + id) || "null",
      );
    } catch {}
    add(
      "p",
      "クラウド保存確認: " +
        (marker?.savedAt
          ? new Date(marker.savedAt).toLocaleString("ja-JP")
          : "まだ確認記録がありません"),
      host,
    );
    let local;
    try {
      local = JSON.parse(
        localStorage.getItem("game_save_meta_" + id) || "null",
      );
    } catch {}
    add(
      "p",
      "端末セーブ確認: " +
        (local?.savedAt
          ? new Date(local.savedAt).toLocaleString("ja-JP")
          : "操作ごとの端末記録とは別の、全体セーブの確認記録はありません"),
      host,
    );
    add("h3", "保存先の一覧", host);
    for (const [name, where, detail] of storageRows) {
      const section = add("section", undefined, host);
      add("h4", name, section);
      add("strong", where, section);
      add("p", detail, section);
    }
    add(
      "p",
      "端末保存はSafari/PWA内のIndexedDB等です。「ファイル」アプリのファイルとは別です。タブを閉じても通常残りますが、サイトデータ削除やOSによる削除に備え、ファイルへの書き出しも利用できます。",
      host,
    );
  };
})();
