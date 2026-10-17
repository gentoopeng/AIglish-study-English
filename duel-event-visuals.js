// Event feedback is local only: one notification and at most one score delta per player.
(function (root) {
  "use strict";
  const model =
    root.WordDuelModel ||
    (typeof require === "function" ? require("./word-duel-model.js") : null);
  const signed = (value) =>
    value < 0 ? "−" + Math.abs(value) : value === 0 ? "±0" : "＋" + value;
  function describe(target, event) {
    const spec = model.eventCatalog.find((item) => item.id === event.type),
      points = target.rules?.eventPoints ?? 100;
    const description = (spec?.description || "")
      .replaceAll("イベント点の半分", Math.round(points / 2) + "点")
      .replaceAll("イベント点", points + "点");
    const state = target.eventInfo?.active,
      own = target.id,
      names = (id) =>
        id === own
          ? "あなた"
          : Array.from(target.room?.players?.[id]?.name || id)
              .slice(0, 8)
              .join("");
    let detail = "対象：全員",
      eligible = true;
    if (state?.type === event.type) {
      const ids = Object.keys(state.ranks),
        rank = state.ranks[own];
      let targets;
      if (["lead", "pressure"].includes(event.type))
        targets = ids.filter((id) => state.ranks[id] === 0);
      if (event.type === "steal") {
        targets = ids.filter((id) => id !== own && state.ranks[id] === 0);
        eligible = targets.length > 0;
      }
      if (event.type === "chase")
        targets = ids.filter((id) => state.ranks[id] > 0);
      if (event.type === "comeback")
        targets = ids.filter((id) => state.ranks[id] === state.lastRank);
      if (event.type === "hunt") {
        targets = ids.filter((id) => state.ranks[id] === rank - 1);
        eligible = targets.length > 0;
      }
      if (targets) {
        if (!["hunt", "steal"].includes(event.type))
          eligible = targets.includes(own);
        detail =
          (event.type === "steal" ? "奪う相手：" : "開始時の対象：") +
          (targets.length ? targets.map(names).join("・") : "なし（同点）");
      }
      if (event.type === "streak")
        detail =
          "あなた：" +
          (state.awarded[own]
            ? "達成済み"
            : Math.min(3, state.streaks[own] || 0) + " / 3 連続正解");
      if (event.type === "perfect")
        detail =
          "あなた：" +
          (state.misses[own]
            ? "今回は未達（ミスあり）"
            : (state.correct[own] || 0) + "問正解・ミスなし（3問以上で達成）");
      if (event.type === "cooperate")
        detail =
          "全員：" +
          Object.values(state.correct).reduce((sum, n) => sum + n, 0) +
          " / " +
          ids.length * 3 +
          "問" +
          (state.cooperated ? " 達成！" : "");
      if (event.type === "bank")
        detail =
          "あなたの貯金：" + (state.bank[own] || 0) + "点 → 終了時に加算";
      if (event.type === "shield")
        detail =
          "あなた：" +
          (target.eventInfo.shields[own] ? "盾を保持中" : "盾は使用済み");
      if (event.type === "counter")
        detail =
          "あなた：" +
          (target.eventInfo.counters[own]
            ? "次の攻撃を反射"
            : "反射は使用済み");
      if (event.type === "first" && state.firstWinner)
        detail = "ボーナス獲得：" + names(state.firstWinner);
      if (event.type === "risk")
        detail =
          "あなた：" +
          (state.used[own] ? "一発勝負は使用済み" : "次の1問が得点・失点3倍");
    }
    return { name: spec?.name || event.type, description, detail, eligible };
  }
  function create(screen, target) {
    const panel = screen.querySelector(".duel-event-banner");
    panel.setAttribute("aria-live", "off");
    panel.innerHTML =
      '<div class="duel-event-heading"><span data-event-phase></span><strong data-event-title></strong><b data-event-clock></b></div><p data-event-explanation></p><small data-event-target></small><div class="duel-event-meter"><span></span></div>';
    const notice = document.createElement("div");
    notice.className = "duel-event-notice";
    notice.hidden = true;
    notice.setAttribute("role", "status");
    notice.innerHTML = "<div><small></small><strong></strong><p></p></div>";
    screen.append(notice);
    let lastKey = "",
      previous = null,
      previousInfo = null,
      noticeTimer = null,
      disposed = false;
    const timers = new Map();
    const write = (selector, text) => {
      const node = panel.querySelector(selector);
      if (node.textContent !== text) node.textContent = text;
    };
    function announce(phase, name, description) {
      clearTimeout(noticeTimer);
      notice.hidden = false;
      notice.querySelector("small").textContent = phase;
      notice.querySelector("strong").textContent = name;
      notice.querySelector("p").textContent = description;
      notice
        .querySelector("div")
        .getAnimations?.()
        .forEach((animation) => animation.cancel());
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
        notice.querySelector("div").animate?.(
          [
            { opacity: 0, transform: "translateY(-12px) scale(.95)" },
            { opacity: 1, transform: "translateY(0) scale(1)" },
            { opacity: 1, transform: "translateY(0) scale(1)" },
            { opacity: 0, transform: "translateY(-5px)" },
          ],
          { duration: 1600, easing: "ease-out" },
        );
      noticeTimer = setTimeout(() => (notice.hidden = true), 1600);
    }
    function refresh(elapsed, active, preview) {
      if (disposed) return;
      if (!target.rules?.events) {
        panel.hidden = true;
        return;
      }
      const event = active || preview,
        own = target.id,
        held = [
          target.eventInfo?.shields[own] ? "盾を保持中" : "",
          target.eventInfo?.counters[own] ? "カウンター待機中" : "",
        ].filter(Boolean);
      if (previous && !active) {
        const bank = previousInfo?.active?.bank?.[own] || 0;
        announce(
          "イベント終了",
          root.WordDuelModel.eventCatalog.find((x) => x.id === previous.type)
            ?.name || "",
          previous.type === "bank"
            ? "貯金 " + bank + "点を精算"
            : "通常のルールに戻ります" +
                (held.length ? "・" + held.join("／") : ""),
        );
      }
      if (event) {
        const info = describe(target, event),
          seconds = Math.max(
            0,
            Math.ceil(
              ((active
                ? Math.min(active.until, target.duration)
                : preview.start) -
                elapsed) /
                1000,
            ),
          );
        panel.hidden = false;
        panel.dataset.phase = active ? "active" : "preview";
        screen.dataset.battleEvent = active ? "active" : "preview";
        write("[data-event-phase]", active ? "発生中" : "まもなく");
        write("[data-event-title]", info.name);
        write("[data-event-clock]", seconds + "秒");
        write("[data-event-explanation]", info.description);
        write(
          "[data-event-target]",
          active ? info.detail : "次のイベントを予告中",
        );
        panel.querySelector(".duel-event-meter").hidden = false;
        panel.querySelector(".duel-event-meter span").style.transform =
          "scaleX(" +
          Math.max(
            0,
            Math.min(
              1,
              (active
                ? Math.min(active.until, target.duration) - elapsed
                : preview.start - elapsed) /
                (active ? target.rules.eventSeconds * 1000 : 3000),
            ),
          ) +
          ")";
        const key = active
          ? Math.floor(elapsed / 15000) + ":" + active.type
          : "";
        if (active && key !== lastKey) {
          lastKey = key;
          announce("イベント発生", info.name, info.description);
          root.AppSounds?.play("confirm");
        }
      } else if (held.length) {
        panel.hidden = false;
        panel.dataset.phase = "held";
        delete screen.dataset.battleEvent;
        write("[data-event-phase]", "効果を保持");
        write("[data-event-title]", held.join("／"));
        write("[data-event-clock]", "");
        write(
          "[data-event-explanation]",
          "次の対象となる失点・攻撃に自動で発動します。",
        );
        write("[data-event-target]", "対象：あなた");
        panel.querySelector(".duel-event-meter").hidden = true;
      } else {
        panel.hidden = true;
        delete screen.dataset.battleEvent;
      }
      previous = active;
      previousInfo = target.eventInfo;
    }
    function score(column, delta) {
      if (disposed || !target.rules?.events || !delta) return;
      let node = column.querySelector(".duel-score-change");
      if (!node) {
        node = document.createElement("span");
        node.className = "duel-score-change";
        node.setAttribute("aria-hidden", "true");
        column.append(node);
      }
      clearTimeout(timers.get(node));
      node.textContent = signed(delta);
      node.dataset.direction = delta < 0 ? "down" : "up";
      node.hidden = false;
      node.getAnimations?.().forEach((animation) => animation.cancel());
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
        node.animate?.(
          [
            { opacity: 1, transform: "translateY(4px)" },
            { opacity: 1, transform: "translateY(-3px)" },
            { opacity: 0, transform: "translateY(-12px)" },
          ],
          { duration: 950, easing: "ease-out" },
        );
      timers.set(
        node,
        setTimeout(() => {
          node.hidden = true;
          timers.delete(node);
        }, 950),
      );
    }
    return {
      refresh,
      score,
      dispose() {
        disposed = true;
        clearTimeout(noticeTimer);
        for (const timer of timers.values()) clearTimeout(timer);
        timers.clear();
        notice
          .getAnimations?.({ subtree: true })
          .forEach((animation) => animation.cancel());
        notice.remove();
        panel.hidden = true;
        delete screen.dataset.battleEvent;
        screen.querySelectorAll(".duel-score-change").forEach((node) => {
          node.getAnimations?.().forEach((animation) => animation.cancel());
          node.remove();
        });
      },
    };
  }
  const api = { describe, create, signed };
  root.DuelEventVisuals = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
