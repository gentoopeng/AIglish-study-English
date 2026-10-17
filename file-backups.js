// User-owned files provide a copy outside Safari/PWA site storage, without Firestore reads.
(function () {
  "use strict";
  const MAX = 20 * 1024 * 1024,
    uid = () => myId || "GUEST-000";
  const globals = new Set([
    "core_v4_current_textbook_id",
    "core_v4_userName",
    "core_v4_userTarget",
    "core_v4_friend_list",
    "core_v4_loadquiz_book",
    "wordMemory",
    "textHistory",
    "myBookshelf",
    "myFolders",
  ]);
  const scoped = [
    "core_v4_user_vocab_progress_",
    "core_v4_custom_words_",
    "core_v4_vocab_draft_",
    "core_v4_personal_library_",
    "core_v4_user_stats_",
    "core_v4_profile_customization_",
    "core_v4_user_avatar_",
    "core_v4_learning_ranking_v2_",
    "core_v4_ranking_swipes_v2_",
    "core_v4_library_deletions_",
    "core_v4_vocab_note_sharing_",
    "core_v4_meaning_history_",
    "core_v4_word_duel_pending_",
    "core_v4_study_points_",
    "aiglish_study_ledger_",
    "aiglish_learning_recovery_",
    "vv4_works_",
  ];
  const fields = new Set([
    "myName",
    "myTarget",
    "myFriendList",
    "userStats",
    "todayStudySeconds",
    "weeklyStudyMinutesLog",
    "lastAccessDateStr",
    "vocabBookKey",
    "vocabMaster",
    "vocabEmptyConfirmed",
    "vocabProgress",
    "vocabBooks",
    "wordMemory",
    "textHistory",
    "myBookshelf",
    "myFolders",
    "currentTextbook",
    "textbooksPool",
  ]);
  const suffixed = new Set([
    "core_v4_user_vocab_progress_",
    "core_v4_custom_words_",
    "core_v4_vocab_draft_",
    "core_v4_ranking_swipes_v2_",
    "core_v4_meaning_history_",
    "aiglish_learning_recovery_",
    "core_v4_vocab_note_sharing_",
  ]);
  function allowed(key, id) {
    return (
      globals.has(key) ||
      scoped.some(
        (prefix) =>
          key === prefix + id ||
          (suffixed.has(prefix) && key.startsWith(prefix + id + "_")) ||
          (prefix === "vv4_works_" && key === prefix + id + "__ts"),
      )
    );
  }
  function safe(value) {
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(safe);
    const result = Object.create(null);
    for (const [k, v] of Object.entries(value)) {
      if (["__proto__", "constructor", "prototype"].includes(k))
        throw Error("バックアップの形式を確認してください。");
      if (/^(pin|password|geminiApiKey|geminiKey|apiKey)$/i.test(k)) continue;
      result[k] = safe(v);
    }
    return result;
  }
  function clean(data, id) {
    const storage = Object.create(null),
      memory = Object.create(null);
    for (const [k, v] of Object.entries(data.localStorage || {})) {
      if (!allowed(k, id)) continue;
      if (typeof v !== "string") throw Error("保存データの形式が違います。");
      if (/^[\[{]/.test(v)) {
        let parsed;
        try {
          parsed = JSON.parse(v);
        } catch {
          throw Error("読み取れない保存記録があります: " + k);
        }
        storage[k] = JSON.stringify(safe(parsed));
      } else storage[k] = v;
    }
    for (const [k, v] of Object.entries(data.memory || {}))
      if (fields.has(k)) memory[k] = safe(v);
    return { localStorage: storage, memory };
  }
  function checksum(value) {
    return window.__gameSaveChecksum(JSON.stringify(value));
  }
  async function capture() {
    if (
      window.__learningBootReady !== true ||
      !window.LearningData.canSave(currentTextbook)
    )
      throw Error("教材の読み込みが終わってから書き出してください。");
    const owner = uid();
    if (
      localStorage.getItem("core_v4_userId") &&
      localStorage.getItem("core_v4_userId") !== owner
    )
      throw Error("ログイン中のアカウントを確認してから書き出してください。");
    window.saveVocabProgressLocally(null, true);
    const data = clean(window.__collectGameSaveData(), owner);
    data.memory.vocabBooks = data.memory.vocabBooks || {};
    for (const book of textbooksPool || []) {
      if (window.LibraryState.isDeleted("book", book.id, owner)) continue;
      let draft = window.VocabMaster.resolve(book.id);
      if (!draft && window.TextbookFiles)
        draft = await window.TextbookFiles.restoreBook(book.id, owner, true);
      if (
        draft?.masterRef &&
        !Array.isArray(draft.master) &&
        window.TextbookFiles
      )
        draft = await window.TextbookFiles.hydrate(book.id, draft, owner, true);
      if (draft)
        data.memory.vocabBooks[book.id] = {
          ...safe(draft),
          progress: window.LearningData.read(book.id),
        };
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (uid() !== owner) throw Error("アカウントが変わりました。");
    }
    // A downloaded cloud save may contain unopened books as references. A manual
    // backup must be self-contained; never silently export missing textbook bodies.
    if (window.TextbookFiles) {
      for (const [book, draft] of Object.entries(data.memory.vocabBooks)) {
        if (draft.masterRef && !Array.isArray(draft.master)) {
          data.memory.vocabBooks[book] = safe(
            await window.TextbookFiles.hydrate(book, draft, owner, true),
          );
        }
      }
    }
    const result = {
      schema: "aiglish-learning-backup",
      version: 1,
      owner,
      savedAt: new Date().toISOString(),
      data,
    };
    result.checksum = checksum(data);
    const raw = JSON.stringify(result);
    if (new Blob([raw]).size > MAX)
      throw Error(
        "20MBを超えるため書き出せません。元の端末のデータを保管してください。",
      );
    return result;
  }
  function validate(value, id) {
    if (
      !value ||
      value.schema !== "aiglish-learning-backup" ||
      value.version !== 1 ||
      !value.data ||
      !value.data.memory ||
      !value.data.localStorage ||
      !Number.isFinite(Date.parse(value.savedAt))
    )
      throw Error("このアプリのバックアップファイルを選んでください。");
    if (value.owner !== id)
      throw Error("このファイルを保存したアカウントでログインしてください。");
    if (value.checksum !== checksum(value.data))
      throw Error("ファイルの内容が変わっているか、破損しています。");
    const data = clean(value.data, id);
    if (
      !Array.isArray(data.memory.textbooksPool) ||
      !data.memory.vocabBooks ||
      typeof data.memory.vocabBooks !== "object" ||
      !Object.keys(data.localStorage).length
    )
      throw Error("学習記録を確認できません。");
    return { ...value, data };
  }
  function download(raw, name) {
    const url = URL.createObjectURL(
        new Blob([raw], { type: "application/json" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function exportFile() {
    const backup = await capture(),
      name = "TangoLabo-" + backup.savedAt.replace(/[:.]/g, "-") + ".json";
    download(JSON.stringify(backup), name);
    return backup;
  }
  async function restore(backup) {
    const owner = uid(),
      value = validate(backup, owner);
    const catalog = "core_v4_personal_library_" + owner;
    if (value.data.localStorage[catalog])
      value.data.localStorage[catalog] = JSON.stringify(
        window.LibraryState.mergeCatalog(
          JSON.parse(localStorage.getItem(catalog) || "null"),
          JSON.parse(value.data.localStorage[catalog]),
          owner,
        ),
      );
    await window.__restoreLearningFile(
      { savedAt: value.savedAt, data: value.data },
      owner,
    );
    return true;
  }
  function attach(panel) {
    const host = panel.querySelector(".fbsv-card");
    if (!host || host.querySelector(".file-backup-actions")) return;
    const section = document.createElement("section");
    section.className = "file-backup-actions";
    section.innerHTML =
      '<h3>ファイルにバックアップ</h3><p>教材の自動保存とは別の予備コピーです。「ファイル」やiCloud Driveへ保管できます。</p><div><button type="button" data-backup-export>書き出す</button><button type="button" data-backup-import>ファイルから復元</button></div><input type="file" accept=".json,application/json" hidden><p data-backup-status role="status"></p><div data-backup-preview hidden></div>';
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "ファイルにバックアップ・復元（任意）";
    details.append(summary, section);
    host.append(details);
    const message = section.querySelector("[data-backup-status]"),
      input = section.querySelector("input");
    section.querySelector("[data-backup-export]").onclick = async (e) => {
      e.currentTarget.disabled = true;
      message.textContent = "ファイルを準備中…";
      try {
        section.querySelector("[data-backup-share]")?.remove();
        const backup = await capture(),
          name = "TangoLabo-" + backup.savedAt.replace(/[:.]/g, "-") + ".json",
          raw = JSON.stringify(backup),
          file = new File([raw], name, { type: "application/json" });
        if (navigator.canShare?.({ files: [file] }) && navigator.share) {
          const share = document.createElement("button");
          share.type = "button";
          share.dataset.backupShare = "";
          share.textContent = "ファイルに保存・共有";
          share.onclick = () => {
            share.disabled = true;
            navigator
              .share({ files: [file], title: "学習データのバックアップ" })
              .then(() => {
                message.textContent =
                  "保存先を選んだ場合は「ファイル」アプリで確認してください。";
              })
              .catch((error) => {
                message.textContent =
                  error.name === "AbortError"
                    ? "保存をキャンセルしました。もう一度保存先を選べます。"
                    : error.message;
              })
              .finally(() => (share.disabled = false));
          };
          section.querySelector("div").append(share);
          message.textContent =
            "準備できました。「ファイルに保存・共有」から保存先を選んでください。";
        } else {
          download(raw, name);
          message.textContent =
            "書き出しを開始しました。ブラウザーのダウンロードメニューで保存先を確認してください。";
        }
      } catch (error) {
        message.textContent = error.message;
      } finally {
        section.querySelector("[data-backup-export]").disabled = false;
      }
    };
    section.querySelector("[data-backup-import]").onclick = () => input.click();
    input.onchange = async () => {
      const file = input.files[0],
        preview = section.querySelector("[data-backup-preview]");
      preview.replaceChildren();
      preview.hidden = true;
      input.value = "";
      if (!file) return;
      try {
        if (file.size > MAX)
          throw Error("20MB以下のバックアップファイルを選んでください。");
        const backup = validate(JSON.parse(await file.text()), uid());
        message.textContent = "";
        const info = document.createElement("p");
        info.textContent =
          new Date(backup.savedAt).toLocaleString("ja-JP") +
          " ／ 教材 " +
          Object.keys(backup.data.memory.vocabBooks).length +
          "冊。同じアカウントへ復元し、新しい理解度の記録は保持します。";
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "この内容を復元する";
        button.onclick = async () => {
          button.disabled = true;
          message.textContent = "端末に復元中…";
          try {
            await restore(backup);
            preview.hidden = true;
            message.textContent =
              "端末への復元が完了しました。クラウド同期は接続後に行います。";
          } catch (error) {
            message.textContent = error.message;
          } finally {
            button.disabled = false;
          }
        };
        preview.append(info, button);
        preview.hidden = false;
      } catch (error) {
        message.textContent = error.message;
      }
    };
  }
  window.FileBackups = {
    attach,
    capture,
    validate,
    restore,
    exportFile,
    allowed,
  };
})();
