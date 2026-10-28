// Small, structured word entry; existing import and canonical learning records stay intact.
(function (root) {
  "use strict";
  const order = () =>
    root.VocabOrder ||
    (typeof require === "function" ? require("./vocab-order.js") : null);
  function nextNumber(master) {
    const max = (master || []).reduce(
      (n, w) =>
        Number.isSafeInteger(Number(w.num)) ? Math.max(n, Number(w.num)) : n,
      0,
    );
    if (max >= Number.MAX_SAFE_INTEGER)
      throw Error("単語番号を指定してください。");
    return max + 1;
  }
  function append(master, fields) {
    if (!Array.isArray(master))
      throw Error("単語データの読み込みを確認してください。");
    const num = fields.num == null ? nextNumber(master) : Number(fields.num);
    if (!Number.isSafeInteger(num) || num < 1)
      throw Error("番号は1以上の整数で入力してください。");
    if (master.some((w) => Number(w.num) === num))
      throw Error("この番号は使用中です。別の番号にしてください。");
    const word = String(fields.word || "").trim();
    if (!word) throw Error("単語・用語・問題文を入力してください。");
    if (!Array.isArray(fields.meanings) || !fields.meanings.length)
      throw Error("意味・答えを入力してください。");
    const meanings = fields.meanings.map((m, i) => {
      // Lines kept (a meaning may run over several), each trimmed, empty ones dropped.
      const text = String(m.text || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n");
      if (!text) throw Error("意味・答え " + (i + 1) + " を入力してください。");
      return {
        id: num + "-" + i,
        text,
        ...(m.partOfSpeech ? { partOfSpeech: String(m.partOfSpeech) } : {}),
        ...(m.minor ? { minor: true } : {}),
        ...(m.blankOnly ? { blankOnly: true } : {}),
      };
    });
    const entry = {
      num,
      word,
      meaning:
        meanings.length === 1
          ? meanings[0].text
          : meanings
              .map(
                (m, i) =>
                  (i < 20
                    ? String.fromCharCode(0x2460 + i)
                    : "(" + (i + 1) + ")") + m.text,
              )
              .join(""),
      meanings,
      sub: String(fields.sub || "").trim(),
    };
    const unit = order().cleanUnit(fields.unit);
    if (unit) entry.unit = unit;
    // `num` is the permanent identity; the number shown (`no`) can be chosen, and a used one can
    // be taken by inserting, which moves the following run of numbers down by one.
    let words = [...master, entry];
    if (fields.no != null && fields.no !== "") {
      const wanted = Number(fields.no);
      if (!Number.isSafeInteger(wanted) || wanted < 1)
        throw Error("番号は1以上の整数で入力してください。");
      if (!fields.insert && master.some((w) => order().no(w) === wanted))
        throw Error(
          "この番号は使用中です。差し込む場合は「差し込む」にチェックしてください。",
        );
      words = order().place(words, num, wanted);
    } else if (fields.num == null && order().maxNo(master) >= num)
      words = order().place(words, num, order().maxNo(master) + 1);
    words.sort((a, b) => Number(a.num) - Number(b.num));
    return { entry: words.find((w) => Number(w.num) === num), master: words };
  }
  const model = { nextNumber, append };
  root.VocabEntryModel = model;
  if (typeof module !== "undefined") module.exports = model;
  if (!root.document) return;

  const owner = () => myId || "GUEST-000",
    queueKey = (id) => "core_v4_vocab_entry_publications_" + id;
  const flights = new Map();
  let dialog = null;
  function publicationQueue(id) {
    return JSON.parse(localStorage.getItem(queueKey(id)) || "{}");
  }
  function ready(book, id) {
    return (
      owner() === id &&
      currentTextbook === book &&
      root.__learningBootReady !== false &&
      root.canEditCurrentTextbook?.() &&
      root.LearningData.canSave(book) &&
      !root.LibraryState?.isDeleted("book", book, id)
    );
  }
  function metadata(book) {
    return textbooksPool.find((b) => b.id === book);
  }
  function save(fields, book, id) {
    if (!ready(book, id))
      throw Error(
        "単語帳の読み込み・編集権限を確認してください。開き直すと再試行できます。",
      );
    const previous = root.VocabMaster.resolve(book);
    if (!previous)
      throw Error(
        "単語を読み込んでから追加してください。既存データは変更していません。",
      );
    const result = append(
      root.stripVocabProgressFromWords(previous.master),
      fields,
    );
    const progress = root.LearningData.read(book),
      savedAt = new Date(
        Math.max(Date.now(), (Date.parse(previous.savedAt) || 0) + 1),
      ).toISOString();
    const draft = {
      master: result.master,
      emptyConfirmed: false,
      progress,
      savedAt,
    };
    // A single complete draft is the recovery source. Write it before changing live state.
    const record = metadata(book),
      publicChange =
        !root.isPersonalTextbook(book) || record?.visibility === "public";
    if (publicChange)
      localStorage.setItem(
        queueKey(id),
        JSON.stringify({ ...publicationQueue(id), [book]: savedAt }),
      );
    localStorage.setItem(
      root.__manualVocabLocalKey(book),
      JSON.stringify(draft),
    );
    root.__manualVocabDrafts[book] = draft;
    root.__manualVocabDraftRevisions ||= {};
    root.__dirtyManualVocabDrafts ||= {};
    root.__dirtyManualVocabDrafts[book] = root.__manualVocabDraftRevisions[
      book
    ] = (root.__manualVocabDraftRevisions[book] || 0) + 1;
    textbooksCacheMap[book] = result.master;
    // These are secondary copies; the complete recovery draft above already succeeded.
    try {
      localStorage.setItem(
        "core_v4_custom_words_" + id + "_" + book,
        JSON.stringify(result.master),
      );
      localStorage.setItem(
        "core_v4_cache_" + book,
        JSON.stringify(result.master),
      );
    } catch (error) {
      console.warn("追加した単語は単語帳の下書きに保存済みです", error);
    }
    try {
      vocabList = root.migrateVocabData(structuredClone(result.master));
      currentUserVocabProgress = progress;
      root.applyUserProgressToVocabList();
      userStats.vocab_reg = vocabList.length;
      root.queueBackgroundSave?.();
      root.updateFlashcardSourceSelectOptions();
      root.applyVocabMaxRange?.();
      root.renderVocabList();
      root.renderVocabLibrarySelection();
    } catch (error) {
      console.warn(
        "単語は下書きに保存済みです。表示を開き直してください。",
        error,
      );
    }
    return result.entry;
  }
  function restorePublications(incoming, id = owner()) {
    if (
      id !== owner() ||
      !incoming ||
      typeof incoming !== "object" ||
      Array.isArray(incoming)
    )
      throw Error("公開更新の記録を確認してください。");
    const queue = publicationQueue(id);
    for (const [book, stamp] of Object.entries(incoming)) {
      if (root.LibraryState?.isDeleted("book", book, id)) continue;
      if (
        Number.isFinite(Date.parse(stamp)) &&
        (!queue[book] || Date.parse(stamp) > Date.parse(queue[book]))
      )
        queue[book] = stamp;
    }
    localStorage.setItem(queueKey(id), JSON.stringify(queue));
  }
  async function flushPublications(id = owner()) {
    if (id !== owner()) return false;
    if (flights.has(id)) return flights.get(id);
    if (root.FirestoreReadGuard?.paused?.())
      return !Object.keys(publicationQueue(id)).length;
    const task = (async () => {
      let success = true;
      for (const [book, stamp] of Object.entries(publicationQueue(id))) {
        if (id !== owner()) return false;
        if (root.LibraryState?.isDeleted("book", book, id)) {
          const q = publicationQueue(id);
          delete q[book];
          localStorage.setItem(queueKey(id), JSON.stringify(q));
          continue;
        }
        const draft = root.VocabMaster.resolve(book);
        if (!draft) {
          success = false;
          continue;
        }
        try {
          let timeout;
          try {
            await Promise.race([
              root.publishVocabEntryMaster(book, draft.master, id),
              new Promise((_, reject) => {
                timeout = setTimeout(
                  () => reject(Error("公開の更新は次の保存時に再試行します。")),
                  8000,
                );
              }),
            ]);
          } finally {
            clearTimeout(timeout);
          }
          if (id !== owner()) return false;
          const q = publicationQueue(id);
          if (
            q[book] === stamp &&
            root.VocabMaster.resolve(book)?.savedAt === draft.savedAt &&
            JSON.stringify(root.VocabMaster.resolve(book)?.master) ===
              JSON.stringify(draft.master)
          ) {
            delete q[book];
            localStorage.setItem(queueKey(id), JSON.stringify(q));
          }
        } catch (error) {
          success = false;
          console.warn("公開用の単語は次の保存時に再同期します", error);
          break;
        }
      }
      return success;
    })().finally(() => flights.delete(id));
    flights.set(id, task);
    return task;
  }
  function close() {
    dialog?.close();
    dialog?.remove();
    dialog = null;
    document.getElementById("vocabAddWord")?.focus();
  }
  function el(tag, text, cls) {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }
  const positions = [
    ["", "品詞なし"],
    ["名", "名詞"],
    ["動", "動詞"],
    ["形", "形容詞"],
    ["形動", "形容動詞"],
    ["副", "副詞"],
    ["代", "代名詞"],
    ["前", "前置詞"],
    ["接", "接続詞"],
    ["助詞", "助詞"],
    ["助", "助動詞"],
    ["連", "連体詞"],
    ["冠", "冠詞"],
    ["間", "間投詞"],
  ];
  function openEntry() {
    const id = owner(),
      book = currentTextbook;
    if (!ready(book, id)) return;
    const original = root.VocabMaster.resolve(book);
    if (!original) return;
    close();
    const d = (dialog = el(
      "dialog",
      undefined,
      "library-editor-dialog vocab-entry-dialog",
    ));
    d.setAttribute("aria-labelledby", "vocabEntryTitle");
    d.innerHTML =
      '<header><div><h2 id="vocabEntryTitle">単語を追加</h2><p class="vocab-entry-book"></p></div><button type="button" data-entry-close aria-label="単語の追加を閉じる">×</button></header><form><label for="vocabEntryWord">単語・用語・問題文</label><input id="vocabEntryWord" required autocomplete="off" placeholder="例：follow ／ あはれなり"><div class="vocab-entry-meanings"></div><button type="button" class="vocab-entry-add-meaning">＋ 意味を追加</button><details><summary>サブ情報・番号・単元を設定</summary><label for="vocabEntrySub">サブ情報</label><textarea id="vocabEntrySub" rows="3" placeholder="用法・例文・関連知識など（任意）"></textarea><label for="vocabEntryUnit">単元</label><input id="vocabEntryUnit" list="vocabEntryUnits" autocomplete="off" maxlength="60" placeholder="例：第1章 ／ 鎌倉時代（任意）"><datalist id="vocabEntryUnits"></datalist><label for="vocabEntryNumber">単語番号</label><input id="vocabEntryNumber" type="number" min="1" step="1"><label class="vocab-entry-insert"><input type="checkbox" id="vocabEntryInsert">使用中の番号なら差し込む（それ以降の番号を1つずつずらす）</label><p class="library-editor-hint">通常は末尾の次の番号を自動で使います。2と3の間に入れるなら「3」にして差し込みます。理解度などの記録は単語ごとに保たれます。</p></details><p class="vocab-entry-status" role="status"></p><p class="library-editor-error" role="alert"></p><label class="vocab-entry-continue"><input type="checkbox" id="vocabEntryContinue">続けて追加する</label><div class="library-editor-actions"><button type="button" data-entry-close>キャンセル</button><button type="submit" class="library-editor-primary">追加する</button></div></form>';
    d.querySelector(".vocab-entry-book").textContent =
      metadata(book)?.name || "単語帳";
    // 用語・年号モード: each line can start with a year (digits only) and mark terms with 「」.
    const term = !!root.TermProgress?.enabled(book);
    d.classList.toggle("is-term-mode", term);
    if (term) {
      const hint = el(
        "p",
        "「」で囲んだ言葉が空欄の問題に、年号を入れた行は年号の問題になります。",
        "library-editor-hint vocab-entry-term-hint",
      );
      d.querySelector(".vocab-entry-meanings").before(hint);
      d.querySelector(".vocab-entry-add-meaning").textContent = "＋ 説明の行を追加";
    }
    const form = d.querySelector("form"),
      number = d.querySelector("#vocabEntryNumber"),
      list = d.querySelector(".vocab-entry-meanings"),
      error = d.querySelector(".library-editor-error"),
      message = d.querySelector("[role=status]");
    let manual = false;
    const unitInput = d.querySelector("#vocabEntryUnit"),
      nextShown = (words) => root.VocabOrder.maxNo(words) + 1;
    for (const unit of root.VocabOrder.units(original.master)) {
      const option = el("option");
      option.value = unit.name;
      d.querySelector("#vocabEntryUnits").append(option);
    }
    number.value = nextShown(original.master);
    number.oninput = () => {
      manual = number.value !== "";
    };
    function relabel() {
      [...list.children].forEach((row, i) => {
        row.querySelector("label").textContent =
          (term ? "説明 " : "意味・答え ") + (i + 1);
        row
          .querySelector(".vocab-entry-year")
          ?.setAttribute("aria-label", "説明 " + (i + 1) + " の年号");
        row
          .querySelector("textarea")
          .setAttribute("aria-label", (term ? "説明 " : "意味・答え ") + (i + 1));
        row
          .querySelector("select")
          .setAttribute("aria-label", "意味 " + (i + 1) + " の品詞");
        row
          .querySelector("button")
          .setAttribute("aria-label", "意味 " + (i + 1) + " を削除");
        row.querySelector("button").hidden = list.children.length === 1;
      });
    }
    function addMeaning(focus = true) {
      const row = el("div", undefined, "vocab-entry-meaning"),
        label = el("label"),
        // A text area, so Enter adds a line break (a phrase on one line, its Japanese on the next).
        input = el("textarea", undefined, "vocab-entry-meaning-text"),
        select = el("select"),
        remove = el("button", "−"),
        controls = el("div", undefined, "vocab-entry-meaning-controls");
      const inputId = "entryMeaning-" + crypto.randomUUID();
      input.id = inputId;
      input.required = true;
      input.placeholder = term ? "例：「本能寺の変」で死亡したとされる人物" : "例：〜に従う";
      input.autocomplete = "off";
      input.rows = 1;
      input.oninput = () => {
        input.style.height = "auto";
        input.style.height = input.scrollHeight + 2 + "px";
      };
      label.htmlFor = inputId;
      for (const [value, text] of positions) {
        const option = el("option", text);
        option.value = value;
        select.append(option);
      }
      remove.type = "button";
      remove.onclick = () => {
        row.remove();
        relabel();
        list.querySelector("textarea").focus();
      };
      if (term) {
        // Digits only: full-width digits are converted, everything else is dropped as typed.
        const year = el("input", undefined, "vocab-entry-year");
        year.type = "text";
        year.inputMode = "numeric";
        year.pattern = "[0-9]*";
        year.maxLength = 4;
        year.placeholder = "年号";
        year.autocomplete = "off";
        year.oninput = () =>
          (year.value = root.TermQuestions.normalizeYear(year.value));
        controls.append(year);
      }
      controls.append(input, select, remove);
      row.append(label, controls);
      // A meaning seldom used but worth knowing: shown small under the main ones.
      if (!term) {
        const minor = el("label", undefined, "vocab-entry-minor"),
          box = el("input");
        box.type = "checkbox";
        minor.append(box, document.createTextNode("あまり使わない意味"));
        row.append(minor);
      } else {
        // When the 「」 is a different phrase (「following」 under follow), asking for the headword
        // is not one-to-one: this line can be asked by its 「」 only.
        const only = el("label", undefined, "vocab-entry-minor vocab-entry-blank-only"),
          box = el("input");
        box.type = "checkbox";
        only.append(box, document.createTextNode("「」の問題だけ出す"));
        row.append(only);
      }
      list.append(row);
      requestAnimationFrame(() => input.oninput());
      relabel();
      if (focus) input.focus();
    }
    addMeaning(false);
    d.querySelector(".vocab-entry-add-meaning").onclick = () => addMeaning();
    d.querySelectorAll("[data-entry-close]").forEach(
      (b) => (b.onclick = close),
    );
    d.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });
    form.onsubmit = (event) => {
      event.preventDefault();
      error.textContent = "";
      message.textContent = "";
      const submit = form.querySelector("[type=submit]");
      if (submit.disabled) return;
      submit.disabled = true;
      try {
        const entry = save(
          {
            no: manual ? number.value : null,
            insert: form.querySelector("#vocabEntryInsert").checked,
            unit: unitInput.value,
            word: form.querySelector("#vocabEntryWord").value,
            sub: form.querySelector("#vocabEntrySub").value,
            meanings: [...list.children].map((row) => {
              const year = row.querySelector(".vocab-entry-year")?.value || "",
                text = row.querySelector("textarea").value;
              return {
                text: year && text.trim() ? year + " " + text.trim() : text,
                partOfSpeech: row.querySelector("select").value,
                minor: !term && !!row.querySelector(".vocab-entry-minor input")?.checked,
                blankOnly: !!row.querySelector(".vocab-entry-blank-only input")?.checked,
              };
            }),
          },
          book,
          id,
        );
        root.showToast?.("「" + entry.word + "」を追加しました。", "ok");
        if (form.querySelector("#vocabEntryContinue").checked) {
          form.querySelector("#vocabEntryWord").value = "";
          form.querySelector("#vocabEntrySub").value = "";
          manual = false;
          number.value = nextShown(root.VocabMaster.resolve(book).master);
          form.querySelector("#vocabEntryInsert").checked = false;
          list.replaceChildren();
          addMeaning(false);
          message.textContent =
            "#" + root.VocabOrder.no(entry) + " 「" + entry.word + "」を追加しました。";
          form.querySelector("#vocabEntryWord").focus();
        } else {
          close();
          // Show the newly created word even when the list was filtered or on a later page.
          document.getElementById("vocabSearchInput").value = entry.word;
          document.getElementById("vocabRangeStart").value = 1;
          root.setVocabFilter("all");
        }
      } catch (e) {
        error.textContent = e.message;
      } finally {
        submit.disabled = false;
      }
    };
    document.body.append(d);
    d.showModal();
    d.querySelector("#vocabEntryWord").focus();
  }
  function updateButton() {
    const button = document.getElementById("vocabAddWord");
    if (!button) return;
    button.hidden = !(currentTextbook && ready(currentTextbook, owner()));
  }
  const render = root.renderVocabList;
  root.renderVocabList = function () {
    updateButton();
    return render.apply(this, arguments);
  };
  root.onBeforeAppLoad?.(close);
  root.onAppLoaded?.(updateButton);
  root.addEventListener("learning-data-ready", updateButton);
  root.openVocabWordEntry = openEntry;
  root.VocabWordEntry = { save, flushPublications, restorePublications };
})(typeof window === "undefined" ? globalThis : window);
