// How to play poker, in seven short animated scenes (cards dealt, the board turned, the best
// five, hand ranks, the four moves, blinds, winning). Opens by itself the first time.
(function () {
  "use strict";
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  // A card that comes in after `delay` seconds; `flip` turns it over a moment later.
  function card(code, delay, extra) {
    const el = window.Poker?.card ? window.Poker.card(code) : node("span", "pk-card", code);
    el.classList.add("pkt-in");
    if (extra) el.classList.add(...extra.split(" "));
    el.style.setProperty("--d", delay + "s");
    return el;
  }
  function row(cls, ...items) {
    const el = node("div", "pkt-row " + (cls || ""));
    el.append(...items);
    return el;
  }
  const RANKS = [
    ["ロイヤルフラッシュ", "同じマークの10・J・Q・K・A"],
    ["ストレートフラッシュ", "同じマークで5枚連続"],
    ["フォーカード", "同じ数字が4枚"],
    ["フルハウス", "3枚＋2枚の組"],
    ["フラッシュ", "同じマークが5枚"],
    ["ストレート", "数字が5枚連続"],
    ["スリーカード", "同じ数字が3枚"],
    ["ツーペア", "ペアが2組"],
    ["ワンペア", "同じ数字が2枚"],
    ["ハイカード", "役なし（一番高いカードで比べる）"],
  ];
  const STEPS = [
    {
      title: "手札は2枚",
      text: "最初に、自分だけが見られるカードが2枚配られます。相手のカードは裏向きのままです。",
      scene() {
        const back = card(null, 0.1, "pkt-flip");
        const front = card("As", 0.1, "pkt-flip-face");
        const back2 = card(null, 0.25, "pkt-flip");
        const front2 = card("Ks", 0.25, "pkt-flip-face");
        const pair = (b, f) => {
          const holder = node("span", "pkt-flipper");
          holder.append(b, f);
          return holder;
        };
        return [row("pkt-hole", pair(back, front), pair(back2, front2)), node("p", "pkt-caption pkt-in", "あなたの手札")];
      },
    },
    {
      title: "場のカードは5枚",
      text: "テーブルの真ん中に、全員が使える共通のカードが開きます。3枚（フロップ）→1枚（ターン）→1枚（リバー）の順です。",
      scene() {
        const labels = row("pkt-labels", node("span", "pkt-in", "フロップ"), node("span", "pkt-in pkt-late", "ターン"), node("span", "pkt-in pkt-later", "リバー"));
        labels.children[0].style.setProperty("--d", "0.2s");
        labels.children[1].style.setProperty("--d", "1.3s");
        labels.children[2].style.setProperty("--d", "2.1s");
        return [row("pkt-board", card("Qs", 0.2), card("Js", 0.35), card("2d", 0.5), card("7c", 1.3), card("Ts", 2.1)), labels];
      },
    },
    {
      title: "7枚から一番強い5枚",
      text: "手札2枚と場の5枚、合わせて7枚から一番強い5枚の組み合わせで勝負します。この例はフルハウス（Kが3枚＋7が2枚）です。",
      scene() {
        const hole = row("pkt-hole", card("Kh", 0.1, "pkt-best"), card("Kc", 0.2, "pkt-best")),
          board = row("pkt-board", card("Kd", 0.4, "pkt-best"), card("7s", 0.5, "pkt-best"), card("7h", 0.6, "pkt-best"), card("2c", 0.7, "pkt-dim"), card("9d", 0.8, "pkt-dim"));
        const name = node("p", "pkt-hand pkt-in", "フルハウス");
        name.style.setProperty("--d", "1.4s");
        return [board, hole, name];
      },
    },
    {
      title: "役の強さ",
      text: "上ほど強い役です。同じ役どうしなら、使っている数字が大きいほうの勝ちです。",
      scene() {
        const list = node("ol", "pkt-ranks");
        RANKS.forEach(([name, note], i) => {
          const item = node("li", "pkt-in");
          item.style.setProperty("--d", (0.05 + i * 0.08).toFixed(2) + "s");
          item.append(node("strong", "", name), node("span", "", note));
          list.append(item);
        });
        return [list];
      },
    },
    {
      title: "自分の番にできること",
      text: "順番が来たら、この4つから選びます。出したチップは真ん中の「場」に集まり、勝った人がもらいます。上乗せするときは、出す枚数を自分で決められます。",
      scene() {
        const moves = [
          ["降りる", "このハンドはおしまい（フォールド）"],
          ["様子見", "出さずに次の人へ。誰も出していないとき（チェック）"],
          ["同じだけ出す", "前の人と同じ枚数を出す（コール）"],
          ["上乗せする", "もっと出す。枚数は自分で決める（レイズ）"],
        ];
        const list = node("div", "pkt-moves");
        moves.forEach(([name, note], i) => {
          const item = node("div", "pkt-move pkt-in");
          item.style.setProperty("--d", (0.1 + i * 0.25).toFixed(2) + "s");
          item.append(node("strong", "", name), node("span", "", note));
          if (i >= 2) {
            const chip = node("i", "pkt-chip");
            chip.style.setProperty("--d", (0.9 + i * 0.35).toFixed(2) + "s");
            item.append(chip);
          }
          list.append(item);
        });
        const pot = node("div", "pkt-pot pkt-in", "場");
        pot.style.setProperty("--d", "0.1s");
        return [list, pot];
      },
    },
    {
      title: "最初に出す少しのチップ",
      text: "毎ハンド、D（ディーラー）マークの次の2人が、少しだけチップを出してから始まります（ブラインドといいます）。Dマークは毎回となりの人へ移るので、順番に回ってきます。",
      scene() {
        const table = node("div", "pkt-table");
        const seat = (label, cls, delay) => {
          const el = node("div", "pkt-seat pkt-in " + cls);
          el.style.setProperty("--d", delay + "s");
          el.append(node("strong", "", label));
          return el;
        };
        const d = node("span", "pkt-dealer", "D"),
          sb = node("span", "pkt-blind", "小"),
          bb = node("span", "pkt-blind is-big", "大");
        d.style.setProperty("--d", "0.6s");
        sb.style.setProperty("--d", "1s");
        bb.style.setProperty("--d", "1.3s");
        const a = seat("あなた", "is-a", 0.1),
          b = seat("相手1", "is-b", 0.2),
          c = seat("相手2", "is-c", 0.3);
        a.append(d);
        b.append(sb);
        c.append(bb);
        table.append(a, b, c);
        return [table];
      },
    },
    {
      title: "勝ち方",
      text: "ほかの全員が降りたら、残った人が場のチップをもらいます。最後まで残ったら手札を見せ合い、一番強い役の人の勝ちです。画面の下には今の役と、次のカードで揃いそうな役が出ます。「役の一覧」でいつでも見られます。",
      scene() {
        const pot = node("div", "pkt-pot is-win pkt-in", "場 120");
        pot.style.setProperty("--d", "0.1s");
        const you = node("div", "pkt-winner pkt-in", "あなた +120");
        you.style.setProperty("--d", "0.9s");
        return [pot, you];
      },
    },
  ];

  let dialog = null;
  function open(options = {}) {
    dialog?.remove();
    dialog = document.createElement("dialog");
    dialog.className = "pk-tutorial";
    dialog.setAttribute("aria-label", "ポーカーの遊び方");
    dialog.innerHTML =
      '<h2 class="pkt-title"></h2><div class="pkt-scene" aria-hidden="true"></div><p class="pkt-text"></p>' +
      '<div class="pkt-dots"></div><div class="pkt-nav"><button type="button" data-pkt="back">戻る</button><button type="button" data-pkt="next" class="pk-primary">次へ</button></div>' +
      '<button type="button" class="pkt-skip" data-pkt="skip">スキップ</button>';
    const dots = dialog.querySelector(".pkt-dots");
    STEPS.forEach(() => dots.append(node("span")));
    let at = 0;
    const show = () => {
      const step = STEPS[at],
        scene = dialog.querySelector(".pkt-scene");
      dialog.querySelector(".pkt-title").textContent = (at + 1) + ". " + step.title;
      dialog.querySelector(".pkt-text").textContent = step.text;
      scene.replaceChildren(...step.scene());
      [...dots.children].forEach((dot, i) => dot.classList.toggle("is-on", i === at));
      dialog.querySelector('[data-pkt="back"]').disabled = at === 0;
      const next = dialog.querySelector('[data-pkt="next"]');
      next.textContent = at === STEPS.length - 1 ? (options.practice ? "コンピュータと対戦する" : "はじめる") : "次へ";
    };
    const finish = (practice) => {
      dialog.close();
      dialog.remove();
      dialog = null;
      if (practice) options.practice?.();
    };
    dialog.querySelector('[data-pkt="back"]').onclick = () => {
      if (at > 0) at--;
      show();
    };
    dialog.querySelector('[data-pkt="next"]').onclick = () => {
      if (at === STEPS.length - 1) return finish(!!options.practice);
      at++;
      show();
    };
    dialog.querySelector('[data-pkt="skip"]').onclick = () => finish(false);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish(false);
    });
    document.body.append(dialog);
    dialog.showModal();
    show();
  }
  window.PokerTutorial = Object.freeze({ open, steps: STEPS.length });
})();
