// What changed in each update, very short (10.161): shown in the お知らせ (🔔) beside the team's notices.
// One entry is added at the top with every update (see CLAUDE.md, "Shipping a change"). Newest first; at most 20 kept.
// at: when it was released (ISO). text: one or two short lines, plain words.
(function (root) {
  "use strict";
  const NOTES = [
    { version: "10.165.00.00", at: "2026-11-22T23:24:00+09:00", text: "予定のカレンダーで、テストまでの「あと◯日」が近い順に3つまで出るようになりました。カレンダーのマスには予定だけを出し、やることは下のリストで見られます。" },
    { version: "10.164.00.00", at: "2026-11-22T23:08:00+09:00", text: "予定のカレンダーで、その日の予定の名前がマスの中にそのまま見えるようになりました。テスト・予定・メモ・やることが色分けで出ます。" },
    { version: "10.163.00.00", at: "2026-11-19T17:55:00+09:00", text: "ステータスに予定のカレンダーができました。テストの日を書いたり、単語帳やワークの範囲を毎日に分けて、やることリストにできます。AIで計画を作って取り込むこともできます。" },
    { version: "10.162.00.00", at: "2026-11-19T15:00:00+09:00", text: "相手のプロフィールで「フレンドに追加」できるようにしました。お互いに追加すると、相手のスタンプがストアに並びます。" },
    { version: "10.161.00.00", at: "2026-11-19T12:00:00+09:00", text: "スタンプストアには、お互いにフレンドの人のスタンプだけが並ぶようにしました。🔔ではお知らせがいちばん上に出て、アップデートの内容もここに届きます。" },
    { version: "10.160.00.00", at: "2026-11-19T09:00:00+09:00", text: "勉強時間の「開始」ボタンをなくしました。時間は勉強している画面でだけ増えます。カレンダーの編集は減らすだけになりました。" },
    { version: "10.159.00.00", at: "2026-11-18T21:00:00+09:00", text: "iPhoneでステータスをスクロールすると、下のタブがついてくる問題を直しました。" },
    { version: "10.157.00.00", at: "2026-11-18T18:00:00+09:00", text: "ステータスの文字を減らし、背景が透けるようにしました。" },
    { version: "10.156.00.00", at: "2026-11-18T16:00:00+09:00", text: "いちばん左に「ステータス」タブができました。アプリを開くと最初に出ます。" },
  ];
  const items = NOTES.slice(0, 20)
    .map((n) => ({ id: "release-" + n.version, title: "アップデート " + n.version.split(".").slice(0, 2).join("."), body: n.text, at: Date.parse(n.at), release: true }))
    .filter((n) => Number.isFinite(n.at));
  // (`at` must be the real release time, not later: a later one would count as new on a device set up before it.)
  root.ReleaseNotes = Object.freeze({ items: () => items.map((n) => ({ ...n })) });
})(window);
