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
  const books = () => (Array.isArray(bookshelfBooks) ? bookshelfBooks.filter((b) => b && b.id) : []);
  // Saved data from older versions or other devices may hold broken entries (null, a wrong
  // type): keep only usable ones, so one bad entry cannot stop the shelf or the app's start.
  const usableText = (item) => !!item && typeof item === "object" && typeof item.text === "string";
  function tidy() {
    if (!Array.isArray(myBookshelf)) myBookshelf = [];
    else if (!myBookshelf.every(usableText)) myBookshelf = myBookshelf.filter(usableText);
    if (!Array.isArray(textHistory)) textHistory = [];
    else if (!textHistory.every(usableText)) textHistory = textHistory.filter(usableText);
    if (!Array.isArray(myFolders)) myFolders = ["未分類"];
    else if (!myFolders.every((f) => typeof f === "string" && f)) myFolders = myFolders.filter((f) => typeof f === "string" && f);
  }
  const inBook = (item) => !!item.bookId && books().some((b) => b.id === item.bookId);
  const folderOf = (item) =>
    inBook(item) ? null : item.folder && item.folder !== "未分類" ? item.folder : "未分類";
  function folders() {
    tidy();
    const names = [];
    for (const name of (Array.isArray(myFolders) ? myFolders : []).concat(myBookshelf.map(folderOf)))
      if (name && name !== "未分類" && !names.includes(name)) names.push(name);
    return names;
  }
  // Writes the shelf to this device. The device storage can be full (the AI analyses are big): first the stamp pictures kept on this
  // device are let go, then only the texts are kept without their analyses; and it says so (it used to fail silently while the screen
  // said "saved"). Returns "full" (all saved), "slim" (texts only) or "failed" (nothing could be written).
  function writeDevice(slim) {
    const shelf = slim ? myBookshelf.map(({ aiAnalysisData, ...rest }) => rest) : myBookshelf;
    localStorage.setItem("myBookshelf", JSON.stringify(shelf));
    localStorage.setItem("myFolders", JSON.stringify(myFolders));
  }
  function persist() {
    let result = "full";
    try {
      writeDevice(false);
    } catch {
      try {
        window.Stamps?.reset?.();
        writeDevice(false);
      } catch {
        try {
          writeDevice(true);
          result = "slim";
        } catch {
          result = "failed";
        }
      }
    }
    if (result === "slim") window.showToast?.("この端末の容量がいっぱいで、解析結果は端末に保存できませんでした（文章は保存しました）。不要な本棚の項目を消すと、解析も残せます。", "error");
    if (result === "failed") window.showToast?.("この端末の容量がいっぱいで、本棚を端末に保存できませんでした。不要なデータを消してから、もう一度お試しください。", "error");
    window.markReaderDataChanged();
    return result;
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

  // A first line of the English (what the text is about, at a glance) and small marks: analysed, has questions.
  const previewOf = (item) => {
    const line = String(item.text || "").replace(/\s+/g, " ").trim();
    return line.length > 70 ? line.slice(0, 70) + "…" : line;
  };
  const chipsOf = (item) => {
    const chips = [];
    if (item.aiAnalysisData && !item.aiAnalysisData.analysisError) chips.push({ text: "解析済み", kind: "done" });
    const questions = window.ReaderQuestions?.get?.(item.text);
    if (questions && questions.result) chips.push({ text: "問題" + questions.result.questions.length + "問", kind: "questions" });
    return chips;
  };
  // The search box of the shelf: matches the title and the English; kept while moving between the shelf's views.
  let shelfQuery = "";
  const matches = (item) => {
    const q = shelfQuery.trim().toLowerCase();
    return !q || String(item.title || "").toLowerCase().includes(q) || String(item.text || "").toLowerCase().includes(q);
  };
  function searchBox(onChange) {
    const wrap = node("label", "shelf-search"), input = node("input");
    input.type = "search";
    input.placeholder = "タイトル・英文で探す";
    input.autocomplete = "off";
    input.value = shelfQuery;
    input.setAttribute("aria-label", "本棚を探す");
    input.addEventListener("input", () => {
      shelfQuery = input.value;
      onChange();
    });
    wrap.append(node("span", "shelf-search-icon", "🔍"), input);
    return wrap;
  }

  // While sorting, rows show ▲▼ instead of ⋯ (sorting ends when the view changes).
  let sorting = false;
  // A row like a word book: the whole row opens it, ⋯ manages it.
  function row({ cover, name, tag, sub, preview, chips, label, onOpen, onManage, move, compact, index }) {
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
    if (preview) details.append(node("span", "shelf-entry-preview", preview));
    if (chips && chips.length) {
      const bar = node("span", "shelf-entry-chips");
      for (const chip of chips) bar.append(node("span", "shelf-chip" + (chip.kind ? " is-" + chip.kind : ""), chip.text));
      details.append(bar);
    }
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
    if (eyebrow) eyebrow.textContent = "";
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
      books().map((b) => '<option value="book:' + esc(b.id) + '">' + esc(b.name) + "</option>").join("") +
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

  // ---- Reading a text (no analysis) and the passages other people published ---------------------------------------------
  const paragraphs = (text) => String(text || "").split(/\r?\n\s*\r?\n/).map((p) => p.replace(/\s*\r?\n\s*/g, " ").trim()).filter(Boolean);
  // entry: { title, text, analysis?, by?, name?, key? } (`by` set: another person's published passage)
  function readText(entry) {
    const RS = window.ReaderShared;
    const modal = dialog(entry.title || "無題", '<p class="rt-meta"></p><div class="rt-body" tabindex="0"></div><div class="library-editor-actions library-editor-actions-stack"></div>');
    const count = sentenceCount(entry.text);
    modal.querySelector(".rt-meta").textContent = (entry.by ? entry.name + "さんが公開 · " : "") + count + "文";
    const body = modal.querySelector(".rt-body");
    for (const text of paragraphs(entry.text)) body.append(node("p", "", text));
    const actions = modal.querySelector(".library-editor-actions");
    // A published passage whose analysis was shared: opened from that, with no AI of your own.
    if (entry.by && entry.hasAnalysis && RS)
      actions.append(
        button("みんなの解析で開く", async (event) => {
          const el = event.currentTarget;
          el.disabled = true;
          el.textContent = "読み込んでいます…";
          try {
            const analysis = await RS.fetchAnalysis(entry.key);
            if (!analysis) throw Error("none");
            window.closeLibraryDialog();
            window.switchReaderSubTab("analysis", "none");
            window.analyzeText(entry.text, entry.title || "無題", analysis);
          } catch (error) {
            el.disabled = false;
            el.textContent = "みんなの解析で開く";
            window.showToast?.("みんなの解析を読み込めませんでした。「解析する」で自分で解析できます。", "error");
          }
        }),
      );
    actions.append(
      button("解析する", () => {
        window.closeLibraryDialog();
        window.switchReaderSubTab("analysis", "none");
        window.analyzeText(entry.text, entry.title || "無題", copy(entry.analysis));
      }),
    );
    if (entry.by) {
      actions.append(
        button("自分の本棚に入れる", () => {
          if (myBookshelf.some((i) => i.text === entry.text)) {
            window.closeLibraryDialog();
            return window.showToast?.("すでに本棚にあります。", "ok");
          }
          myBookshelf.push({ id: Date.now(), folder: "", title: entry.title || "無題", text: entry.text, aiAnalysisData: null });
          persist();
          window.closeLibraryDialog();
          window.showToast?.("「未分類」に入れました。", "ok");
          window.renderBookshelf();
        }),
        button("見えなくする", () => {
          RS && RS.hideText(entry.key);
          window.closeLibraryDialog();
          window.renderBookshelf();
        }),
      );
      if (RS && RS.isTextMine(entry.key))
        actions.append(
          button("公開をやめる", async () => {
            try {
              await RS.unshareText(entry.key);
              window.closeLibraryDialog();
              window.showToast?.("公開をやめました。", "ok");
              window.renderBookshelf();
            } catch (error) {
              window.showToast?.(error.message || "公開をやめられませんでした。", "error");
            }
          }, "library-editor-danger"),
        );
    }
    actions.append(button("閉じる", () => window.closeLibraryDialog()));
  }
  const publishMessage = { ok: "みんなの長文に公開しました。", exists: "この英文は、すでに公開されています。", big: "長すぎるので公開できませんでした（2万字まで）。", off: "公開できませんでした（ログインと接続が必要です）。", fail: "公開できませんでした。あとでもう一度お試しください。" };
  function renderSharedView(container) {
    const RS = window.ReaderShared;
    container.append(header("COMMUNITY", "みんなの長文", [button("‹ 本棚", () => show("list"), "shelf-back")]));
    container.append(node("p", "shelf-shared-note", "みんなが本棚から公開した英文です。押すと本文を読めます。ここでの読み取りは、「読み込む」を押したときだけです。解析は、あなたのAPIキーで行います。"));
    const list = node("div", "vocab-library-list"), status = node("p", "vocab-library-empty", "");
    const load = button("みんなの長文を読み込む", () => fetchPage(false), "shelf-shared-load");
    const more = button("もっと見る", () => fetchPage(true), "shelf-shared-load");
    more.hidden = true;
    let busy = false;
    const draw = (items, done) => {
      list.replaceChildren();
      items.forEach((t, index) =>
        list.append(
          row({
            cover: { text: "📄" },
            name: t.title,
            tag: RS.isTextMine(t.key) ? "あなた" : "",
            sub: t.name + "さん · " + sentenceCount(t.text) + "文" + (t.hasAnalysis ? " · 解析あり" : "") + (dateOf(t.at) ? " · " + dateOf(t.at) : ""),
            preview: previewOf(t),
            label: t.title + "を読む",
            onOpen: () => readText({ title: t.title, text: t.text, by: t.by, name: t.name, key: t.key, hasAnalysis: t.hasAnalysis }),
            index,
          }),
        ),
      );
      status.textContent = items.length ? "" : "まだ公開された長文がありません。";
      load.hidden = true;
      more.hidden = done;
    };
    async function fetchPage(next) {
      if (busy) return;
      busy = true;
      status.textContent = "読み込んでいます…";
      try {
        const page = await RS.listTexts(next);
        draw(page.items, page.done);
      } catch (error) {
        status.textContent = "読み込めませんでした。通信か、読み取りの上限かもしれません。時間をおいてお試しください。";
      } finally {
        busy = false;
      }
    }
    container.append(load, list, status, more);
    const cached = RS.cachedTexts();
    if (cached) draw(cached.items, cached.done);
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
    // Reading the text (no analysis), and publishing it to / taking it back from みんなの長文.
    const readButton = button("本文を読む", () => {
      window.closeLibraryDialog();
      readText({ title: item.title, text: item.text, analysis: item.aiAnalysisData });
    });
    modal.querySelector('[data-shelf="open"]').after(readButton);
    const RS = window.ReaderShared;
    if (RS && RS.available()) {
      const share = button("みんなの長文に公開する", null);
      share.disabled = true;
      modal.querySelector('[data-shelf="remove"]').before(share);
      RS.textKey(item.text).then((key) => {
        const published = () => RS.isTextMine(key);
        const label = () => (share.textContent = published() ? "公開をやめる" : "みんなの長文に公開する");
        label();
        share.disabled = false;
        share.onclick = async () => {
          share.disabled = true;
          try {
            if (published()) {
              await RS.unshareText(key);
              window.showToast?.("公開をやめました。", "ok");
            } else {
              const result = await RS.publishText(item.title, item.text);
              if (result === "ok" || result === "exists") RS.shareAnalysis(item.text, item.aiAnalysisData);
              window.showToast?.(publishMessage[result] || publishMessage.fail, result === "ok" || result === "exists" ? "ok" : "error");
            }
          } catch (error) {
            window.showToast?.(error.message || "うまくいきませんでした。", "error");
          }
          label();
          share.disabled = false;
        };
      });
    }
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
    tidy();
    const data = analysis !== undefined ? analysis : currentActiveAiAnalysisCache;
    const modal = dialog(
      "本棚に保存",
      '<p class="library-editor-hint"></p>' +
        placeField +
        '<p class="library-editor-error" role="alert"></p><div class="library-editor-actions"><button type="button" id="cancelSaveBookshelfBtn" data-library-close>キャンセル</button><button type="button" id="confirmSaveBookshelfBtn" class="library-editor-primary">保存</button></div>',
    );
    modal.querySelector(".library-editor-hint").textContent = title || "無題";
    // Published to みんなの長文 with the save (the switch is kept for next time).
    const RS = window.ReaderShared;
    let shareBox = null;
    if (RS && RS.available()) {
      const label = node("label", "shelf-share");
      shareBox = node("input");
      shareBox.type = "checkbox";
      shareBox.checked = RS.textsEnabled();
      shareBox.onchange = () => RS.setTextsEnabled(shareBox.checked);
      label.append(shareBox, node("span", "", "みんなの長文にも公開する（あなたの名前つきで、英文が全員に見えます。教材の著作権に気をつけてください）"));
      modal.querySelector(".library-editor-error").before(label);
    }
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
      const saved = persist();
      if (shareBox && shareBox.checked)
        RS.publishText(title, text).then((result) => (result === "ok" || result === "exists" ? RS.shareAnalysis(text, data) : 0, result)).then((result) => window.showToast?.(publishMessage[result] || publishMessage.fail, result === "ok" || result === "exists" ? "ok" : "error"));
      alert(saved === "full" ? "「" + placeName(place) + "」に保存しました。" : saved === "slim" ? "「" + placeName(place) + "」に文章を保存しました（解析結果は、端末の容量がいっぱいで保存できませんでした）。" : "端末の容量がいっぱいで、端末には保存できませんでした。ログインしていれば、クラウドのバックアップには保存します。");
      window.renderBookshelf();
    };
  };

  // ---- Shelf ---------------------------------------------------------------------------------
  window.renderBookshelf = function () {
    const container = document.getElementById("myBookshelfContainer");
    if (!container) return;
    tidy();
    container.replaceChildren();
    const names = folders(),
      view = String(currentShelfView),
      folderName = view.startsWith("folder:") ? view.slice(7) : null;
    if (
      view !== "list" &&
      view !== "unclassified" &&
      view !== "shared" &&
      !(folderName ? names.includes(folderName) : books().some((b) => b.id === view))
    )
      currentShelfView = "list";
    if (currentShelfView === "list") {
      container.append(
        header(myBookshelf.length ? "全" + myBookshelf.length + "本の長文" : "", "本棚", [
          button("＋ フォルダを作る", createFolder),
          button("英文を解析する", () => window.switchReaderSubTab("analysis", "left")),
          ...(names.length > 1 ? [sortButton()] : []),
        ]),
      );
      const list = node("div", "vocab-library-list");
      let index = 0;
      // With something typed in the search box, the matching texts of the whole shelf are shown (with the folder they are in).
      const found = () => {
        list.replaceChildren();
        const hits = myBookshelf.filter(matches).slice().reverse();
        hits.forEach((item, at) =>
          list.append(
            row({
              cover: { text: "📖" },
              name: item.title || "無題",
              sub: folderOf(item) + " · " + textMeta(item),
              preview: previewOf(item),
              chips: chipsOf(item),
              label: (item.title || "無題") + "を開く",
              onOpen: () => openText(item),
              onManage: () => manageText(item),
              index: at,
            }),
          ),
        );
        if (!hits.length) list.append(node("div", "vocab-library-empty", "「" + shelfQuery.trim() + "」に合う長文はありません。"));
      };
      const drawFolders = () => {
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
      // The passages other people published (read only when this is opened and asked for).
      if (window.ReaderShared && window.ReaderShared.available())
        list.append(row({ cover: { text: "🌐" }, name: "みんなの長文", tag: "公開", sub: "みんなが公開した英文を読む", onOpen: () => show("shared"), index: index++ }));
      };
      const draw = () => {
        list.replaceChildren();
        if (shelfQuery.trim()) found();
        else drawFolders();
      };
      if (myBookshelf.length) container.append(searchBox(draw));
      draw();
      container.append(list);
      return;
    }
    if (currentShelfView === "shared") return renderSharedView(container);
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
    const drawItems = () => {
      list.replaceChildren();
      const visible = shown.filter(matches);
      visible.forEach((item, index) =>
        list.append(
          row({
            cover: { text: "📖" },
            name: item.title || "無題",
            sub: textMeta(item),
            preview: previewOf(item),
            chips: chipsOf(item),
            label: (item.title || "無題") + "を開く",
            onOpen: () => openText(item),
            onManage: () => manageText(item),
            move: shelfQuery.trim() ? undefined : mover(shown, shown.indexOf(item), swapTexts),
            index,
          }),
        ),
      );
      if (!items.length) list.append(node("div", "vocab-library-empty", "このフォルダには、まだ長文がありません。"));
      else if (!visible.length) list.append(node("div", "vocab-library-empty", "「" + shelfQuery.trim() + "」に合う長文はありません。"));
    };
    if (items.length > 3) container.append(searchBox(drawItems));
    drawItems();
    container.append(list);
  };

  // ---- History (analysis tab) ----------------------------------------------------------------
  window.renderHistoryList = function () {
    const container = document.getElementById("historyListContainer");
    if (!container) return;
    tidy();
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
