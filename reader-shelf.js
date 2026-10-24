// The reader's bookshelf and history, laid out like the word book list: a heading with a
// toolbar, then rows with a cover, a name, a short line about the contents and a ⋯ menu.
// Shelf books (published by the admin), the user's folders and 未分類 open to their texts.
(function () {
  "use strict";
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const button = (text, action, cls) => {
    const el = node("button", cls, text);
    el.type = "button";
    el.onclick = action;
    return el;
  };
  const books = () => (Array.isArray(bookshelfBooks) ? bookshelfBooks : []);
  const inBook = (item) => !!item.bookId && books().some((b) => b.id === item.bookId);
  const folderOf = (item) =>
    inBook(item) ? null : item.folder && item.folder !== "未分類" ? item.folder : "未分類";
  function folders() {
    const names = [];
    for (const name of (Array.isArray(myFolders) ? myFolders : []).concat(myBookshelf.map(folderOf)))
      if (name && name !== "未分類" && !names.includes(name)) names.push(name);
    return names;
  }
  function persist() {
    try {
      localStorage.setItem("myBookshelf", JSON.stringify(myBookshelf));
      localStorage.setItem("myFolders", JSON.stringify(myFolders));
    } catch {}
    window.markReaderDataChanged();
  }
  // The bookshelf and history live in device keys, but startup restores the last full backup.
  // So a change stamps the device copy as newer than any backup (the restore keeps it, see
  // applySavedMemory in save-system.js), and a backup follows shortly.
  let backupTimer = 0;
  window.markReaderDataChanged = function () {
    const owner = typeof myId === "string" && myId ? myId : "GUEST-000";
    try {
      localStorage.setItem("aiglish_reader_local", JSON.stringify({ owner, at: Date.now() }));
    } catch {}
    window.queueBackgroundSave?.();
    if (owner === "GUEST-000") return;
    clearTimeout(backupTimer);
    backupTimer = setTimeout(() => {
      if ((typeof myId === "string" ? myId : "") === owner) window.saveAfterStudy?.("reader-shelf");
    }, 1500);
  };
  const copy = (value) => (value ? JSON.parse(JSON.stringify(value)) : null);
  const sentenceCount = (text) =>
    (String(text || "").replace(/\n/g, " ").match(/[^.?!]+[.?!]+|[^.?!]+$/g) || []).filter((s) => s.trim()).length;
  function dateOf(id) {
    const at = new Date(Number(id));
    return Number.isFinite(at.getTime()) && Number(id) > 1e12 ? at.getMonth() + 1 + "/" + at.getDate() : "";
  }
  // One text's line: how many sentences, whether the AI analysis is kept, and when it was saved.
  const textMeta = (item) =>
    [sentenceCount(item.text) + "文", item.aiAnalysisData && !item.aiAnalysisData.analysisError ? "解析済み" : "未解析", dateOf(item.id)]
      .filter(Boolean)
      .join(" · ");

  // While sorting, rows show ▲▼ instead of ⋯ (sorting ends when the view changes).
  let sorting = false;
  // A row like a word book: the whole row opens it, ⋯ manages it.
  function row({ cover, name, tag, sub, label, onOpen, onManage, move, compact, index }) {
    const entry = node("div", "vocab-library-book-entry shelf-entry" + (compact ? " is-compact" : "")),
      open = node("button", "textbook-list-item");
    open.type = "button";
    open.style.setProperty("--textbook-index", index || 0);
    open.onclick = onOpen;
    if (label) open.setAttribute("aria-label", label);
    if (!compact) {
      const box = node("span", "textbook-list-cover");
      if (cover?.image) {
        const image = node("img");
        image.src = cover.image;
        image.alt = "";
        image.loading = "lazy";
        box.append(image);
      } else box.textContent = cover?.text || "📁";
      open.append(box);
    }
    const details = node("span", "textbook-list-details"),
      heading = node("span", "textbook-list-heading");
    heading.append(node("span", "textbook-list-name", name));
    if (tag) heading.append(node("span", "textbook-list-visibility", tag));
    details.append(heading, node("span", "shelf-entry-sub", sub));
    open.append(details);
    entry.append(open);
    if (sorting && move) {
      const up = button("▲", () => move(-1), "vocab-library-manage-button shelf-move"),
        down = button("▼", () => move(1), "vocab-library-manage-button shelf-move");
      up.setAttribute("aria-label", name + "を上へ");
      down.setAttribute("aria-label", name + "を下へ");
      up.disabled = !move.canUp;
      down.disabled = !move.canDown;
      entry.append(up, down);
    } else if (onManage) {
      const manage = button("⋯", onManage, "vocab-library-manage-button");
      manage.setAttribute("aria-label", name + "の管理");
      entry.append(manage);
    }
    return entry;
  }
  function header(kicker, title, tools) {
    const head = node("header", "vocab-library-header shelf-header");
    head.append(node("span", "vocab-library-kicker", kicker), node("h2", "", title));
    if (tools.length) {
      const bar = node("div", "library-toolbar");
      bar.append(...tools);
      head.append(bar);
    }
    return head;
  }
  function dialog(title, markup) {
    const modal = window.openLibraryDialog(title, markup);
    const eyebrow = modal.querySelector(".library-editor-eyebrow");
    if (eyebrow) eyebrow.textContent = "BOOKSHELF";
    return modal;
  }
  const show = (view) => {
    if (view !== currentShelfView) sorting = false;
    currentShelfView = view;
    window.renderBookshelf();
    window.scrollTo?.(0, 0);
  };
  function openText(item) {
    window.switchReaderSubTab("analysis", "none");
    window.analyzeText(item.text, item.title || "無題", copy(item.aiAnalysisData));
  }

  // ---- Folder dialogs ------------------------------------------------------------------------
  function askFolderName(title, value, done) {
    const modal = dialog(
      title,
      '<form><label for="shelfFolderName">フォルダの名前</label><input id="shelfFolderName" maxlength="40" required placeholder="例：英語長文・模試">' +
        '<p class="library-editor-error" role="alert"></p><div class="library-editor-actions"><button type="button" data-library-close>キャンセル</button><button type="submit" class="library-editor-primary">保存</button></div></form>',
    );
    const input = modal.querySelector("#shelfFolderName"),
      error = modal.querySelector(".library-editor-error");
    input.value = value || "";
    input.focus();
    modal.querySelector("form").onsubmit = (event) => {
      event.preventDefault();
      const name = input.value.trim().slice(0, 40);
      if (!name || name === "未分類") return (error.textContent = "別の名前を入れてください。");
      if (name !== value && folders().includes(name)) return (error.textContent = "同じ名前のフォルダがあります。");
      window.closeLibraryDialog();
      done(name);
    };
  }
  function createFolder() {
    askFolderName("新しいフォルダ", "", (name) => {
      myFolders = [...myFolders.filter((f) => f !== name), name];
      persist();
      show("folder:" + name);
    });
  }
  function manageFolder(name) {
    const count = myBookshelf.filter((i) => folderOf(i) === name).length,
      modal = dialog(
        name,
        '<div class="library-editor-actions library-editor-actions-stack"><button type="button" data-shelf="rename">名前を変更</button>' +
          '<button type="button" data-shelf="remove" class="library-editor-danger">フォルダを削除</button><button type="button" data-library-close>閉じる</button></div>',
      );
    modal.querySelector('[data-shelf="rename"]').onclick = () =>
      askFolderName("フォルダの名前を変更", name, (next) => {
        if (next === name) return;
        myFolders = myFolders.map((f) => (f === name ? next : f));
        if (!myFolders.includes(next)) myFolders.push(next);
        myBookshelf.forEach((i) => {
          if (folderOf(i) === name) i.folder = next;
        });
        persist();
        show(String(currentShelfView) === "folder:" + name ? "folder:" + next : currentShelfView);
      });
    modal.querySelector('[data-shelf="remove"]').onclick = () => {
      const confirm = dialog(
        "「" + name + "」を削除しますか？",
        '<p class="library-editor-hint">' +
          (count ? "中の長文" + count + "本は「未分類」に移ります。" : "空のフォルダです。") +
          '</p><div class="library-editor-actions"><button type="button" data-library-close>キャンセル</button><button type="button" class="library-editor-danger" data-shelf="confirm">削除する</button></div>',
      );
      confirm.querySelector('[data-shelf="confirm"]').onclick = () => {
        myFolders = myFolders.filter((f) => f !== name);
        myBookshelf.forEach((i) => {
          if (folderOf(i) === name) i.folder = "未分類";
        });
        persist();
        window.closeLibraryDialog();
        show("list");
      };
    };
  }

  // ---- Text dialogs --------------------------------------------------------------------------
  function placeOptions(selected) {
    const esc = (t) => String(t).replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");
    return (
      books().map((b) => '<option value="book:' + esc(b.id) + '">📚 ' + esc(b.name) + "</option>").join("") +
      ["未分類", ...folders()]
        .map((f) => '<option value="folder:' + esc(f) + '">' + (f === "未分類" ? "未分類" : "📁 " + esc(f)) + "</option>")
        .join("") +
      '<option value="new_folder">＋ 新しいフォルダ</option>'
    ).replace('value="' + esc(selected) + '"', 'value="' + esc(selected) + '" selected');
  }
  // Reads the place picked in a dialog: { bookId } or { folder }, or null when a new name is missing.
  function pickedPlace(modal) {
    const choice = modal.querySelector("#selectBookshelfFolder").value;
    if (choice === "new_folder") {
      const name = modal.querySelector("#newFolderNameInput").value.trim().slice(0, 40);
      if (!name || name === "未分類") return null;
      if (!myFolders.includes(name)) myFolders.push(name);
      return { folder: name };
    }
    if (choice.startsWith("book:")) return { bookId: choice.slice(5) };
    return { folder: choice.slice(7) || "未分類" };
  }
  const placeName = (place) =>
    place.bookId ? (books().find((b) => b.id === place.bookId) || {}).name || "本棚" : place.folder;
  const placeField =
    '<label for="selectBookshelfFolder">保存先</label><select id="selectBookshelfFolder"></select>' +
    '<input id="newFolderNameInput" maxlength="40" placeholder="新しいフォルダの名前" hidden>';
  function wirePlace(modal, selected) {
    const select = modal.querySelector("#selectBookshelfFolder"),
      input = modal.querySelector("#newFolderNameInput");
    select.innerHTML = placeOptions(selected);
    select.onchange = () => {
      input.hidden = select.value !== "new_folder";
      if (!input.hidden) input.focus();
    };
  }
  // ---- Order ---------------------------------------------------------------------------------
  const sortButton = () =>
    button(sorting ? "完了" : "並べ替え", () => {
      sorting = !sorting;
      window.renderBookshelf();
    }, sorting ? "shelf-sort is-on" : "shelf-sort");
  // move(delta) for one of a list shown top to bottom; swap(a, b) swaps two shown items.
  function mover(shown, at, swap) {
    const move = (delta) => {
      const other = at + delta;
      if (other < 0 || other >= shown.length) return;
      swap(shown[at], shown[other]);
      persist();
      window.renderBookshelf();
    };
    move.canUp = at > 0;
    move.canDown = at < shown.length - 1;
    return move;
  }
  function swapFolders(a, b) {
    const order = folders(),
      i = order.indexOf(a),
      j = order.indexOf(b);
    [order[i], order[j]] = [order[j], order[i]];
    myFolders = order;
  }
  function swapTexts(a, b) {
    const i = myBookshelf.indexOf(a),
      j = myBookshelf.indexOf(b);
    if (i < 0 || j < 0) return;
    [myBookshelf[i], myBookshelf[j]] = [myBookshelf[j], myBookshelf[i]];
  }

  // Title and text can be changed; a changed text is analysed again when it is next opened.
  function editText(item) {
    const modal = dialog(
      "名前・本文を編集",
      '<form><label for="shelfTextTitle">名前</label><input id="shelfTextTitle" maxlength="80" required>' +
        '<label for="shelfTextBody">本文</label><textarea id="shelfTextBody" rows="10" required></textarea>' +
        '<p class="library-editor-hint">本文を変えると、次に開いたときにAIがもう一度解析します。</p><p class="library-editor-error" role="alert"></p>' +
        '<div class="library-editor-actions"><button type="button" data-library-close>キャンセル</button><button type="submit" class="library-editor-primary">保存</button></div></form>',
    );
    const title = modal.querySelector("#shelfTextTitle"),
      body = modal.querySelector("#shelfTextBody");
    title.value = item.title || "無題";
    body.value = item.text || "";
    modal.querySelector("form").onsubmit = (event) => {
      event.preventDefault();
      const nextTitle = title.value.trim().slice(0, 80),
        nextText = body.value.trim();
      if (!nextTitle || !nextText) return (modal.querySelector(".library-editor-error").textContent = "名前と本文を入れてください。");
      if (nextText !== item.text) {
        item.text = nextText;
        item.aiAnalysisData = null;
      }
      item.title = nextTitle;
      persist();
      window.closeLibraryDialog();
      window.showToast?.("保存しました。", "ok");
      window.renderBookshelf();
    };
  }

  function manageText(item) {
    const modal = dialog(
      item.title || "無題",
      '<div class="library-editor-actions library-editor-actions-stack"><button type="button" data-shelf="open">開く</button><button type="button" data-shelf="edit">名前・本文を編集</button><button type="button" data-shelf="move">別のフォルダへ移動</button>' +
        '<button type="button" data-shelf="remove" class="library-editor-danger">本棚から削除</button><button type="button" data-library-close>閉じる</button></div>',
    );
    modal.querySelector('[data-shelf="open"]').onclick = () => {
      window.closeLibraryDialog();
      openText(item);
    };
    modal.querySelector('[data-shelf="edit"]').onclick = () => editText(item);
    modal.querySelector('[data-shelf="move"]').onclick = () => {
      const move = dialog(
        "移動先を選ぶ",
        placeField +
          '<p class="library-editor-error" role="alert"></p><div class="library-editor-actions"><button type="button" data-library-close>キャンセル</button><button type="button" class="library-editor-primary" data-shelf="confirm">移動する</button></div>',
      );
      wirePlace(move, item.bookId && inBook(item) ? "book:" + item.bookId : "folder:" + folderOf(item));
      move.querySelector('[data-shelf="confirm"]').onclick = () => {
        const place = pickedPlace(move);
        if (!place) return (move.querySelector(".library-editor-error").textContent = "フォルダの名前を入れてください。");
        if (place.bookId) {
          item.bookId = place.bookId;
          item.folder = "";
        } else {
          delete item.bookId;
          item.folder = place.folder;
        }
        persist();
        window.closeLibraryDialog();
        window.showToast?.("「" + placeName(place) + "」に移動しました。", "ok");
        window.renderBookshelf();
      };
    };
    modal.querySelector('[data-shelf="remove"]').onclick = () => {
      const confirm = dialog(
        "「" + (item.title || "無題") + "」を削除しますか？",
        '<p class="library-editor-hint">本棚から外します。履歴には残ります。</p><div class="library-editor-actions"><button type="button" data-library-close>キャンセル</button><button type="button" class="library-editor-danger" data-shelf="confirm">削除する</button></div>',
      );
      confirm.querySelector('[data-shelf="confirm"]').onclick = () => {
        myBookshelf = myBookshelf.filter((b) => b.id !== item.id);
        persist();
        window.closeLibraryDialog();
        window.renderBookshelf();
      };
    };
  }

  // Saving the text shown in the reader.
  window.showCustomSaveBookshelfPrompt = function (text, title, analysis) {
    const data = analysis !== undefined ? analysis : currentActiveAiAnalysisCache;
    const modal = dialog(
      "本棚に保存",
      '<p class="library-editor-hint"></p>' +
        placeField +
        '<p class="library-editor-error" role="alert"></p><div class="library-editor-actions"><button type="button" id="cancelSaveBookshelfBtn" data-library-close>キャンセル</button><button type="button" id="confirmSaveBookshelfBtn" class="library-editor-primary">保存</button></div>',
    );
    modal.querySelector(".library-editor-hint").textContent = title || "無題";
    const last = String(currentShelfView).startsWith("folder:") ? currentShelfView : "folder:未分類";
    wirePlace(modal, books().some((b) => b.id === currentShelfView) ? "book:" + currentShelfView : last);
    modal.querySelector("#confirmSaveBookshelfBtn").onclick = () => {
      const place = pickedPlace(modal);
      if (!place) return (modal.querySelector(".library-editor-error").textContent = "フォルダの名前を入れてください。");
      const same = (item) =>
        item.text === text && (place.bookId ? item.bookId === place.bookId : !inBook(item) && folderOf(item) === place.folder);
      window.closeLibraryDialog();
      if (myBookshelf.some(same)) return alert("すでに保存されています。");
      myBookshelf.push({
        id: Date.now(),
        folder: place.folder || "",
        ...(place.bookId ? { bookId: place.bookId } : {}),
        title: title || "無題",
        text,
        aiAnalysisData: copy(data),
      });
      persist();
      alert("「" + placeName(place) + "」に保存しました。");
      window.renderBookshelf();
    };
  };

  // ---- Shelf ---------------------------------------------------------------------------------
  window.renderBookshelf = function () {
    const container = document.getElementById("myBookshelfContainer");
    if (!container) return;
    container.replaceChildren();
    const names = folders(),
      view = String(currentShelfView),
      folderName = view.startsWith("folder:") ? view.slice(7) : null;
    if (
      view !== "list" &&
      view !== "unclassified" &&
      !(folderName ? names.includes(folderName) : books().some((b) => b.id === view))
    )
      currentShelfView = "list";
    if (currentShelfView === "list") {
      container.append(
        header("BOOKSHELF", "本棚", [
          button("＋ フォルダを作る", createFolder),
          button("英文を解析する", () => window.switchReaderSubTab("analysis", "left")),
          ...(names.length > 1 ? [sortButton()] : []),
        ]),
      );
      const list = node("div", "vocab-library-list");
      let index = 0;
      for (const book of books()) {
        const count = myBookshelf.filter((i) => i.bookId === book.id).length;
        list.append(
          row({
            cover: book.coverType === "image" && book.cover ? { image: book.cover } : { text: book.cover || "📚" },
            name: book.name,
            tag: "教材",
            sub: count + "本の長文",
            onOpen: () => show(book.id),
            index: index++,
          }),
        );
      }
      names.forEach((name, at) => {
        const items = myBookshelf.filter((i) => folderOf(i) === name);
        list.append(
          row({
            cover: { text: "📁" },
            name,
            sub: items.length ? items.length + "本の長文 · " + (items[items.length - 1].title || "無題") : "空のフォルダ",
            onOpen: () => show("folder:" + name),
            onManage: () => manageFolder(name),
            move: mover(names, at, swapFolders),
            index: index++,
          }),
        );
      });
      const loose = myBookshelf.filter((i) => folderOf(i) === "未分類");
      if (loose.length)
        list.append(
          row({ cover: { text: "🗂️" }, name: "未分類", sub: loose.length + "本の長文", onOpen: () => show("unclassified"), index: index++ }),
        );
      if (!index)
        list.append(node("div", "vocab-library-empty", "まだ何もありません。解析した英文を「本棚に保存」すると、ここに並びます。"));
      container.append(list);
      return;
    }
    const book = folderName || currentShelfView === "unclassified" ? null : books().find((b) => b.id === currentShelfView),
      title = folderName || (book ? book.name : "未分類"),
      items = myBookshelf.filter((i) =>
        folderName ? folderOf(i) === folderName : book ? i.bookId === book.id : folderOf(i) === "未分類",
      );
    const tools = [button("‹ 本棚", () => show("list"), "shelf-back")];
    if (folderName) tools.push(button("フォルダの管理", () => manageFolder(folderName)));
    if (items.length > 1) tools.push(sortButton());
    container.append(header(folderName ? "FOLDER" : book ? "SHELF" : "BOOKSHELF", title, tools));
    const list = node("div", "vocab-library-list");
    const shown = items.slice().reverse();
    shown.forEach((item, index) =>
        list.append(
          row({
            cover: { text: "📖" },
            name: item.title || "無題",
            sub: textMeta(item),
            label: (item.title || "無題") + "を開く",
            onOpen: () => openText(item),
            onManage: () => manageText(item),
            move: mover(shown, index, swapTexts),
            index,
          }),
        ),
      );
    if (!items.length) list.append(node("div", "vocab-library-empty", "このフォルダには、まだ長文がありません。"));
    container.append(list);
  };

  // ---- History (analysis tab) ----------------------------------------------------------------
  window.renderHistoryList = function () {
    const container = document.getElementById("historyListContainer");
    if (!container) return;
    container.replaceChildren();
    const list = Array.isArray(textHistory) ? textHistory : [];
    if (!list.length) {
      container.append(node("p", "shelf-history-empty", "解析した英文がここに残ります。"));
      return;
    }
    list.slice(0, 10).forEach((entry, index) =>
      container.append(
        row({
          compact: true,
          name: entry.title || "無題",
          sub: textMeta(entry),
          label: (entry.title || "無題") + "を開く",
          onOpen: () =>
            window.analyzeText(entry.text, entry.title || "無題", copy(entry.aiAnalysisData)),
          onManage: () => {
            const modal = dialog(
              entry.title || "無題",
              '<div class="library-editor-actions library-editor-actions-stack"><button type="button" data-shelf="save">本棚に保存</button>' +
                '<button type="button" data-shelf="remove" class="library-editor-danger">履歴から削除</button><button type="button" data-library-close>閉じる</button></div>',
            );
            modal.querySelector('[data-shelf="save"]').onclick = () =>
              window.showCustomSaveBookshelfPrompt(entry.text, entry.title || "無題", entry.aiAnalysisData || null);
            modal.querySelector('[data-shelf="remove"]').onclick = () => {
              window.closeLibraryDialog();
              window.showCustomDeleteHistoryConfirm(entry.id);
            };
          },
          index,
        }),
      ),
    );
  };
  window.showCustomDeleteHistoryConfirm = function (id) {
    textHistory = (Array.isArray(textHistory) ? textHistory : []).filter((entry) => String(entry.id) !== String(id));
    try {
      localStorage.setItem("textHistory", JSON.stringify(textHistory));
    } catch {}
    window.markReaderDataChanged();
    window.renderHistoryList();
  };
  window.ReaderShelf = Object.freeze({ sentenceCount, folders });
})();
