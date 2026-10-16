// Local configuration only. Opening this screen never scans rooms or fetches rankings.
(function () {
  "use strict";
  const m = window.WordDuelModel,
    labels = Object.fromEntries(
      m.eventCatalog.map((event) => [event.id, event.name]),
    );
  function entryHtml() {
    return '<div class="battle-entry"><p>遊び方を選ぶ</p><button type="button" data-battle-route="create"><span class="battle-route-symbol">＋</span><span>部屋を作る<small>教材とルールを決める</small></span><span>›</span></button><button type="button" data-battle-route="join"><span class="battle-route-symbol">＃</span><span>部屋に入る<small>4桁の部屋番号で参加</small></span><span>›</span></button><button type="button" data-battle-route="solo" class="battle-solo-link">一人プレイ</button></div>';
  }
  function joinHtml() {
    return '<div class="battle-join-card"><p>部屋に入る</p><div class="duel-join"><label>部屋番号<input aria-label="部屋番号" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" placeholder="0000"></label><button type="button" data-duel-join>参加</button></div><small>教材・ルールは部屋の設定が適用されます。</small></div>';
  }
  function eventHtml() {
    const groups = ["得点", "順位", "コンボ", "チャレンジ", "特殊"];
    return `<section data-config-panel="events" class="battle-config-panel" hidden><label class="battle-event-toggle">イベントを発生させる<input type="checkbox" data-events checked></label><div class="battle-event-presets"><button type="button" data-event-preset="recommended">おすすめ</button><button type="button" data-event-preset="all">全部</button><button type="button" data-event-preset="none">選択解除</button><span data-event-count></span></div><nav class="battle-event-categories" aria-label="イベントの種類">${groups.map((group, i) => `<button type="button" data-event-category="${group}" aria-pressed="${i === 0}">${group}</button>`).join("")}</nav><div class="battle-event-list">${groups
      .map(
        (group, i) =>
          `<div class="battle-event-group" data-event-group="${group}" ${i ? "hidden" : ""}>${m.eventCatalog
            .filter((event) => event.group === group)
            .map(
              (event) =>
                `<label><input type="checkbox" data-event-type value="${event.id}" ${event.recommended ? "checked" : ""}><span><strong>${event.name}</strong><small>${event.description}</small></span></label>`,
            )
            .join("")}</div>`,
      )
      .join(
        "",
      )}</div><div class="battle-rule-grid"><label>継続する秒数<input type="number" data-event-seconds aria-label="イベント継続秒数" min="3" max="15" value="8"></label><label>イベント点<input type="number" data-event-points aria-label="イベント加減点" min="0" max="10000" value="100"></label></div><p class="battle-config-hint">15秒ごとに1種類。3秒前に予告。順位は開始時に固定。</p></section>`;
  }
  function mount() {
    const host = document.getElementById("view-battle");
    if (!host || host.childElementCount) return;
    host.innerHTML =
      '<div class="battle-mode-grid"><button type="button" class="battle-mode-card mode-casual"><span>カジュアル<small>自由なルールで遊ぶ</small></span></button><button type="button" class="battle-mode-card mode-serious"><span>ガチ<small>準備中</small></span></button></div>';
    host.querySelector(".mode-casual").onclick = () => window.openWordDuel();
    host.querySelector(".mode-serious").onclick = () => {
      const d = window.openLibraryDialog(
        "ガチモード",
        '<p style="text-align:center;padding:30px 0">ガチモードは準備中です。</p><button type="button" data-library-close>閉じる</button>',
      );
      d.querySelector("[data-library-close]")?.focus();
    };
  }
  function html() {
    return `<nav class="battle-config-tabs" aria-label="バトル設定"><button type="button" data-config-tab="books" aria-pressed="true">教材</button><button type="button" data-config-tab="rules" aria-pressed="false">ルール</button><button type="button" data-config-tab="events" aria-pressed="false">イベント</button></nav>
<section data-config-panel="books" class="battle-config-panel"><div class="battle-book-heading">出題する単語帳 <span data-book-count></span></div><div class="battle-book-picker"></div><div class="battle-range"><label>単語番号<input type="number" aria-label="最初の単語番号" data-range-start min="1" placeholder="最初"></label><span>—</span><label>まで<input type="number" aria-label="最後の単語番号" data-range-end min="1" placeholder="最後"></label></div><label class="battle-field">出題内容<select data-question-mode aria-label="出題内容"><option value="random">全範囲ランダム</option><option value="status">理解度を選ぶ</option><option value="weak">苦手な傾向のある単語</option></select></label><div class="battle-status-picker" hidden>${[
      ["ok", "○"],
      ["so", "△"],
      ["bad", "×"],
      ["none", "未履修"],
    ]
      .map(
        ([value, label]) =>
          `<label><input type="checkbox" value="${value}" checked><span>${label}</span></label>`,
      )
      .join(
        "",
      )}</div><p class="battle-config-hint" data-selection-hint>複数の単語帳をまとめて選べます。</p></section>
<section data-config-panel="rules" class="battle-config-panel" hidden><div class="battle-time"><span>制限時間</span><div class="battle-time-wheels"><label><select aria-label="制限時間の分" data-time-minutes>${Array.from({ length: 11 }, (_, i) => `<option value="${i}" ${i === 1 ? "selected" : ""}>${String(i).padStart(2, "0")}</option>`).join("")}</select>分</label><b>:</b><label><select aria-label="制限時間の秒" data-time-seconds>${Array.from({ length: 12 }, (_, i) => `<option value="${i * 5}">${String(i * 5).padStart(2, "0")}</option>`).join("")}</select>秒</label></div></div><div class="battle-rule-grid"><label>正解の得点<input type="number" data-points aria-label="正解の得点" min="1" max="10000" step="1" value="100"></label><label>ミスの失点<input type="number" data-duel-penalty aria-label="ミス時の減点" min="0" max="1000" step="1" value="100"></label><label>コンボ倍率<input type="number" data-combo aria-label="コンボ倍率" min="1" max="3" step=".01" value="1.1"></label><label>回答数 × 点<input type="number" data-answer-bonus aria-label="問題数ボーナス" min="0" max="1000" step="1" value="10"></label></div><label class="battle-field">対戦人数<select data-duel-capacity aria-label="対戦人数"><option value="2">2人</option><option value="3">3人</option><option value="4">4人</option></select></label><p class="battle-config-hint">1.1倍：100 → 110 → 120点…<br>終了時に回答数×設定点を加算。ミス後は3秒休み。</p></section>
${eventHtml()}
<footer class="battle-config-footer"><p class="duel-status" role="status"></p><div class="duel-lobby-actions"><button type="button" data-duel-solo>一人プレイ</button><button type="button" data-duel-create>部屋を作る</button></div></footer>`;
  }
  function timeWheel(select) {
    const wheel = document.createElement("div");
    wheel.className = "battle-time-wheel";
    wheel.tabIndex = 0;
    wheel.setAttribute("role", "listbox");
    wheel.setAttribute(
      "aria-label",
      select.hasAttribute("data-time-minutes")
        ? "分を回して選ぶ"
        : "秒を回して選ぶ",
    );
    const options = [...select.options];
    select.classList.add("battle-native-time");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    const step = () =>
      parseFloat(getComputedStyle(wheel).getPropertyValue("--wheel-step")) ||
      26;
    function mark(index) {
      select.selectedIndex = index;
      [...wheel.children].forEach((node, i) => {
        node.setAttribute("aria-selected", String(i === index));
        node.tabIndex = -1;
      });
      wheel.setAttribute("aria-activedescendant", wheel.children[index].id);
    }
    options.forEach((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.id =
        "battle-time-" +
        (select.hasAttribute("data-time-minutes") ? "min" : "sec") +
        "-" +
        index;
      button.setAttribute("role", "option");
      button.textContent = option.textContent;
      button.onclick = () => {
        mark(index);
        wheel.scrollTo({
          top: index * step(),
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
        });
      };
      wheel.append(button);
    });
    select.after(wheel);
    let syncing = false,
      ready = false;
    const sync = () => {
      mark(select.selectedIndex);
      if (!wheel.offsetHeight) {
        ready = false;
        return;
      }
      syncing = true;
      wheel.scrollTop = select.selectedIndex * step();
      requestAnimationFrame(() => {
        syncing = false;
        ready = true;
      });
    };
    select.onchange = sync;
    wheel.addEventListener(
      "scroll",
      () => {
        if (syncing || !ready || !wheel.offsetHeight) return;
        mark(
          Math.max(
            0,
            Math.min(options.length - 1, Math.round(wheel.scrollTop / step())),
          ),
        );
      },
      { passive: true },
    );
    wheel.onkeydown = (event) => {
      const delta =
        event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
      if (!delta) return;
      event.preventDefault();
      mark(
        Math.max(0, Math.min(options.length - 1, select.selectedIndex + delta)),
      );
      wheel.scrollTop = select.selectedIndex * step();
    };
    sync();
    return sync;
  }
  function init(screen) {
    screen.classList.add("is-configuring");
    screen.querySelector(".duel-screen-badge").textContent = "レート変動なし";
    const wheelSync = [
      ...screen.querySelectorAll("[data-time-minutes],[data-time-seconds]"),
    ].map(timeWheel);
    const picker = screen.querySelector(".battle-book-picker"),
      books = typeof textbooksPool === "undefined" ? [] : textbooksPool;
    for (const book of books) {
      if (window.LibraryState?.isDeleted("book", book.id)) continue;
      const label = document.createElement("label"),
        input = document.createElement("input"),
        text = document.createElement("span");
      input.type = "checkbox";
      input.value = book.id;
      input.checked = book.id === currentTextbook;
      text.textContent = book.name || book.title || book.id;
      label.append(input, text);
      picker.append(label);
    }
    function update() {
      const count = picker.querySelectorAll("input:checked").length;
      screen.querySelector("[data-book-count]").textContent = count + "/10冊";
      screen.querySelector(".battle-range").hidden = count !== 1;
      const mode = screen.querySelector("[data-question-mode]").value;
      screen.querySelector(".battle-status-picker").hidden = mode !== "status";
      screen.querySelector("[data-selection-hint]").textContent =
        mode === "weak"
          ? "過去の×・△を優先し、○の単語も混ぜます。"
          : count > 1
            ? "複数選択時は単語番号の指定はありません。"
            : "異なる意味を持つ10語以上が必要です。";
    }
    picker.onchange = update;
    screen.querySelector("[data-question-mode]").onchange = update;
    screen.querySelectorAll("[data-config-tab]").forEach(
      (button) =>
        (button.onclick = () => {
          screen
            .querySelectorAll("[data-config-tab]")
            .forEach((b) =>
              b.setAttribute("aria-pressed", String(b === button)),
            );
          screen
            .querySelectorAll("[data-config-panel]")
            .forEach(
              (panel) =>
                (panel.hidden =
                  panel.dataset.configPanel !== button.dataset.configTab),
            );
          if (button.dataset.configTab === "rules")
            wheelSync.forEach((sync) => sync());
        }),
    );
    const toggle = screen.querySelector("[data-events]");
    toggle.onchange = () => {
      screen
        .querySelector(".battle-event-list")
        .classList.toggle("is-disabled", !toggle.checked);
      screen
        .querySelectorAll(
          "[data-event-type],[data-event-seconds],[data-event-points]",
        )
        .forEach((input) => (input.disabled = !toggle.checked));
    };
    toggle.onchange();
    const count = () => {
      screen.querySelector("[data-event-count]").textContent =
        screen.querySelectorAll("[data-event-type]:checked").length + "/30";
    };
    screen
      .querySelector(".battle-event-list")
      .addEventListener("change", count);
    screen.querySelectorAll("[data-event-preset]").forEach(
      (button) =>
        (button.onclick = () => {
          const preset = button.dataset.eventPreset;
          screen
            .querySelectorAll("[data-event-type]")
            .forEach(
              (input) =>
                (input.checked =
                  preset === "all" ||
                  (preset === "recommended" &&
                    m.recommendedEvents.includes(input.value))),
            );
          toggle.checked = true;
          toggle.onchange();
          count();
        }),
    );
    screen.querySelectorAll("[data-event-category]").forEach(
      (button) =>
        (button.onclick = () => {
          screen
            .querySelectorAll("[data-event-category]")
            .forEach((other) =>
              other.setAttribute("aria-pressed", String(other === button)),
            );
          screen
            .querySelectorAll("[data-event-group]")
            .forEach(
              (group) =>
                (group.hidden =
                  group.dataset.eventGroup !== button.dataset.eventCategory),
            );
          screen.querySelector(".battle-event-list").scrollTop = 0;
        }),
    );
    count();
    update();
  }
  function read(screen) {
    const val = (key) => Number(screen.querySelector(key).value),
      rules = {
        points: val("[data-points]"),
        combo: val("[data-combo]"),
        answerBonus: val("[data-answer-bonus]"),
        events: screen.querySelector("[data-events]").checked,
        eventTypes: m.eventTypes.filter(
          (type) =>
            screen.querySelector('[data-event-type][value="' + type + '"]')
              .checked,
        ),
        eventSeconds: val("[data-event-seconds]"),
        eventPoints: val("[data-event-points]"),
      },
      duration =
        val("[data-time-minutes]") * 60000 + val("[data-time-seconds]") * 1000,
      missPenalty = val("[data-duel-penalty]");
    for (const input of screen.querySelectorAll("input[type=number]"))
      if (
        !input.disabled &&
        !(
          input.closest(".battle-range") &&
          (input.closest(".battle-range").hidden || input.value === "")
        ) &&
        (!input.checkValidity() || input.value === "")
      )
        throw Error("数値の範囲を確認してください。");
    if (!m.validDuration(duration))
      throw Error("制限時間は15秒〜10分で設定してください。");
    if (
      !m.validRules(rules) ||
      !Number.isInteger(missPenalty) ||
      missPenalty < 0 ||
      missPenalty > 1000
    )
      throw Error("ルールの設定を確認してください。");
    return {
      matchType: "casual",
      duration,
      capacity: val("[data-duel-capacity]"),
      missPenalty,
      rules,
    };
  }
  async function words(screen, seed) {
    const ids = [
      ...screen.querySelectorAll(".battle-book-picker input:checked"),
    ].map((el) => el.value);
    if (!ids.length) throw Error("単語帳を選んでください。");
    if (ids.length > 10) throw Error("一度に選べる単語帳は10冊までです。");
    const mode = screen.querySelector("[data-question-mode]").value,
      statuses = [
        ...screen.querySelectorAll(".battle-status-picker input:checked"),
      ].map((el) => el.value),
      from = Number(screen.querySelector("[data-range-start]").value) || 0,
      to = Number(screen.querySelector("[data-range-end]").value) || Infinity;
    if (ids.length === 1 && from > to)
      throw Error("単語番号の範囲を確認してください。");
    const sampler = m.poolSampler(seed, mode === "weak");
    for (const book of ids) {
      let source = window.TextbookFiles
        ? await window.TextbookFiles.getWords(book)
        : window.VocabMaster.resolve(book)?.master;
      if (!source && window.__getBookMasterWords)
        source = await window.__getBookMasterWords(book);
      if (!source?.length) throw Error("単語帳の読み込みを確認してください。");
      const progress = window.LearningData.read(book),
        normalized = window.migrateVocabData(
          window.stripVocabProgressFromWords(source),
        );
      for (const word of normalized) {
        if (
          ids.length === 1 &&
          (Number(word.num) < from || Number(word.num) > to)
        )
          continue;
        const saved = progress[String(word.num)],
          sig = window.buildWordSignature(word),
          compatible = !saved?.sig || saved.sig === sig;
        for (const meaning of word.meanings || []) {
          const prior = compatible
              ? saved?.meanings?.[String(meaning.id)]
              : null,
            status =
              prior?.status ||
              (compatible && word.meanings.length === 1
                ? saved?.status
                : null) ||
              "none";
          if (mode === "status" && !statuses.includes(status)) continue;
          sampler.add({
            word: word.word || word.en,
            meaning: meaning.text,
            duelStatus: status,
            duelHistory:
              prior?.history ||
              (compatible && word.meanings.length === 1
                ? saved?.history
                : []) ||
              [],
            duelRef: {
              book,
              num: String(word.num),
              mid: String(meaning.id),
              sig,
              count: word.meanings.length,
            },
          });
        }
      }
    }
    const pool = sampler.result();
    if (pool.length < 10)
      throw Error("条件に合う異なる意味の単語を10個以上選んでください。");
    return { pool, book: ids[0], books: ids };
  }
  window.BattleLobby = { html, init, read, words, labels, entryHtml, joinHtml };
  window.onAppLoaded(mount);
})();
