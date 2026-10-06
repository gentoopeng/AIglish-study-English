// Personal vocabulary library. Shared teaching material stays available alongside it.
(function() {
    'use strict';
    function userId() { return myId || 'GUEST-000'; }
    function key() { return 'core_v4_personal_library_' + userId(); }
    function readLibrary() {
        var raw = localStorage.getItem(key());
        if (!raw) return { books: [], hidden: [] };
        var data = JSON.parse(raw);
        if (!data || !Array.isArray(data.books) || !Array.isArray(data.hidden)) throw new Error('単語帳一覧を読み込めませんでした。再読み込みしてください。');
        return data;
    }
    function refreshPool() {
        var data = readLibrary();
        var shared = textbooksPool.filter(function(book) { return !book.personal; });
        textbooksPool = shared.filter(function(book) { return data.hidden.indexOf(book.id) < 0; }).concat(data.books);
    }
    function persist(data) {
        data.savedAt = new Date().toISOString();
        localStorage.setItem(key(), JSON.stringify(data));
        refreshPool();
        window.renderVocabLibrarySelection();
        window.updateFlashcardSourceSelectOptions();
    }
    window.isPersonalTextbook = function(bookId) {
        return readLibrary().books.some(function(book) { return book.id === bookId; });
    };
    window.canEditCurrentTextbook = function() { return !!window.isAdmin || window.isPersonalTextbook(currentTextbook); };
    var originalSync = window.syncTextbooksIndexFromFirestore;
    window.syncTextbooksIndexFromFirestore = async function() {
        try { return await originalSync.apply(this, arguments); }
        finally { refreshPool(); window.renderVocabLibrarySelection(); }
    };
    var originalMasterSave = window.saveVocabMasterToStorage;
    window.saveVocabMasterToStorage = async function() {
        if (!window.isPersonalTextbook(currentTextbook)) return originalMasterSave.apply(this, arguments);
        var master = window.stripVocabProgressFromWords(vocabList);
        localStorage.setItem('core_v4_custom_words_' + userId() + '_' + currentTextbook, JSON.stringify(master));
        localStorage.setItem('core_v4_cache_' + currentTextbook, JSON.stringify(master));
        textbooksCacheMap[currentTextbook] = master;
        window.saveVocabProgressLocally();
        window.__captureManualVocabDraft();
    };
    var dialog = null;
    var opener = null;
    function cloudAvailable() { return !!(window.db && window.fbDoc && window.fbSetDoc && window.fbGetDocs && window.fbCollection); }
    function publicRef(id) { return window.fbDoc(window.db, 'publicTextbooks', id); }
    async function publish(record, master, previous) {
        if (record.visibility === 'public') {
            if (userId() === 'GUEST-000') throw new Error('みんなに公開するにはログインしてください。自分だけの単語帳はゲストでも作れます。');
            if (!cloudAvailable()) throw new Error('公開先に接続できません。「自分だけ」で保存するか、接続後にもう一度お試しください。');
            await window.fbSetDoc(publicRef(record.id), { ownerId: userId(), name: record.name, cover: record.cover, masterJson: JSON.stringify(window.stripVocabProgressFromWords(master)), updatedAt: new Date().toISOString() }, { merge: false });
        } else if (previous && previous.visibility === 'public') {
            if (!cloudAvailable() || !window.fbDeleteDoc) throw new Error('公開の取り消しには接続が必要です。接続後にもう一度お試しください。');
            await window.fbDeleteDoc(publicRef(record.id));
        }
    }
    function close() {
        if (!dialog) return;
        dialog.close(); dialog.remove(); dialog = null;
        if (opener && opener.isConnected) opener.focus();
    }
    function open(title, markup) {
        close(); opener = document.activeElement;
        dialog = document.createElement('dialog');
        dialog.className = 'library-editor-dialog';
        dialog.setAttribute('aria-labelledby', 'libraryEditorTitle');
        dialog.innerHTML = '<div class="library-editor-eyebrow">MY VOCABULARY</div><h2 id="libraryEditorTitle"></h2>' + markup;
        dialog.querySelector('h2').textContent = title;
        document.body.appendChild(dialog);
        dialog.addEventListener('cancel', function(event) { event.preventDefault(); close(); });
        dialog.addEventListener('click', function(event) { if (event.target === dialog) close(); });
        dialog.querySelectorAll('[data-library-close]').forEach(function(button) { button.onclick = close; });
        dialog.showModal();
        return dialog;
    }
    function wordsFromText(text, start) {
        return text.split('\n').filter(function(line) { return line.trim(); }).map(function(line, index) {
            var match = line.match(/^\s*(.*?)\s*[:：\t]\s*(.*?)\s*$/);
            if (!match || !match[1] || !match[2]) throw new Error((index + 1) + '行目を「英単語 : 意味」の形式で入力してください。');
            return { num: start + index, word: match[1], meaning: match[2], meanings: [{ id: (start + index) + '-0', text: match[2] }] };
        });
    }
    window.openLibraryBookEditor = function(bookId) {
        var editorUserId = userId();
        var book = textbooksPool.find(function(item) { return item.id === bookId; });
        if (bookId && (!book || !window.isPersonalTextbook(bookId))) return;
        var modal = open(book ? '単語帳を編集' : '新しい単語帳',
            '<form id="libraryBookForm"><label for="libraryBookName">単語帳の名前</label><input id="libraryBookName" maxlength="80" required placeholder="例：毎日の英単語">' +
            '<label for="libraryBookCover">表紙</label><select id="libraryBookCover"><option value="📘">📘 青い本</option><option value="📕">📕 赤い本</option><option value="📗">📗 緑の本</option><option value="🌙">🌙 月</option><option value="✨">✨ 星</option></select>' +
            '<label for="libraryBookVisibility">公開範囲</label><select id="libraryBookVisibility"><option value="private">自分だけ</option><option value="public">みんなに公開</option></select>' +
            '<label for="libraryBookWords">' + (book ? '単語を追加' : '最初の単語（あとから追加できます）') + '</label><textarea id="libraryBookWords" rows="5" placeholder="study : 学ぶ\nread : 読む"></textarea>' +
            '<p class="library-editor-hint">1行に「英単語 : 意味」。公開するのは単語帳の内容だけです。理解度・履歴・メモは公開しません。</p><p class="library-editor-error" role="alert"></p>' +
            '<div class="library-editor-actions"><button type="button" data-library-close>キャンセル</button><button type="submit" class="library-editor-primary">' + (book ? '変更を保存' : '単語帳を作る') + '</button></div></form>');
        var form = modal.querySelector('form');
        if (book) {
            form.querySelector('#libraryBookName').value = book.name;
            form.querySelector('#libraryBookCover').value = book.cover;
            form.querySelector('#libraryBookVisibility').value = book.visibility || 'private';
        }
        form.onsubmit = async function(event) {
            event.preventDefault();
            var submit = form.querySelector('[type="submit"]');
            if (submit.disabled) return;
            submit.disabled = true;
            try {
                if (userId() !== editorUserId) throw new Error('ユーザーが切り替わりました。単語帳一覧から開き直してください。');
                var name = form.querySelector('#libraryBookName').value.trim();
                if (!name) throw new Error('単語帳の名前を入力してください。');
                var id = bookId || 'personal_' + crypto.randomUUID();
                var master = book ? JSON.parse(localStorage.getItem('core_v4_custom_words_' + userId() + '_' + id) || localStorage.getItem('core_v4_cache_' + id) || '[]') : [];
                var start = master.reduce(function(max, word) { return Math.max(max, Number(word.num) || 0); }, 0) + 1;
                var added = wordsFromText(form.querySelector('#libraryBookWords').value, start);
                master = master.concat(added);
                var record = { id: id, name: name, cover: form.querySelector('#libraryBookCover').value, coverType: 'text', personal: true, visibility: form.querySelector('#libraryBookVisibility').value };
                await publish(record, master, book);
                if (userId() !== editorUserId) throw new Error('ユーザーが切り替わりました。単語帳一覧から開き直してください。');
                var data = readLibrary();
                var index = data.books.findIndex(function(item) { return item.id === id; });
                if (index < 0) data.books.push(record); else data.books[index] = record;
                localStorage.setItem('core_v4_custom_words_' + userId() + '_' + id, JSON.stringify(master));
                localStorage.setItem('core_v4_cache_' + id, JSON.stringify(master));
                textbooksCacheMap[id] = master;
                // Keep progress and a complete draft together for restart and manual cloud saves.
                var progress = JSON.parse(localStorage.getItem(window.getVocabProgressStorageKey(id)) || '{}');
                var draft = { master: master, progress: progress, savedAt: new Date().toISOString() };
                localStorage.setItem(window.__manualVocabLocalKey(id), JSON.stringify(draft));
                window.__manualVocabDrafts[id] = draft;
                window.__dirtyManualVocabDrafts = window.__dirtyManualVocabDrafts || {};
                window.__manualVocabDraftRevisions = window.__manualVocabDraftRevisions || {};
                window.__manualVocabDraftRevisions[id] = (window.__manualVocabDraftRevisions[id] || 0) + 1;
                window.__dirtyManualVocabDrafts[id] = window.__manualVocabDraftRevisions[id];
                persist(data);
                close();
            } catch (error) { form.querySelector('.library-editor-error').textContent = error.message; }
            finally { submit.disabled = false; }
        };
    };
    window.openLibraryBookActions = function(bookId) {
        var actionUserId = userId();
        var book = textbooksPool.find(function(item) { return item.id === bookId; });
        if (!book) return;
        var own = window.isPersonalTextbook(bookId);
        var modal = open(book.name, '<div class="library-editor-actions library-editor-actions-stack">' +
            (own ? '<button type="button" id="libraryEditBook">名前・表紙を編集 / 単語を追加</button>' : '') +
            '<button type="button" id="libraryRemoveBook" class="library-editor-danger">' + (own ? '単語帳を削除' : '自分の一覧から外す') + '</button><button type="button" data-library-close>閉じる</button></div>');
        if (own) modal.querySelector('#libraryEditBook').onclick = function() { window.openLibraryBookEditor(bookId); };
        modal.querySelector('#libraryRemoveBook').onclick = function() {
            var confirmDialog = open('「' + book.name + '」を' + (own ? '削除しますか？' : '一覧から外しますか？'),
                '<p class="library-editor-hint">' + (own ? (book.visibility === 'public' ? '公開一覧からも削除します。他の人が自分用に追加したコピーは残ります。' : '削除した単語帳は一覧に表示されなくなります。') : '配信された単語帳と他の人の学習データには影響しません。') + '</p><p class="library-editor-error" role="alert"></p><div class="library-editor-actions"><button type="button" data-library-close>キャンセル</button><button type="button" id="libraryConfirmRemove" class="library-editor-danger">' + (own ? '削除する' : '一覧から外す') + '</button></div>');
            confirmDialog.querySelector('#libraryConfirmRemove').onclick = async function() {
                var remove = confirmDialog.querySelector('#libraryConfirmRemove');
                if (remove.disabled) return;
                remove.disabled = true;
                try {
                    if (userId() !== actionUserId) throw new Error('ユーザーが切り替わりました。単語帳一覧から開き直してください。');
                    if (own && book.visibility === 'public') await publish({id:bookId,visibility:'private'}, [], book);
                    if (userId() !== actionUserId) throw new Error('ユーザーが切り替わりました。単語帳一覧から開き直してください。');
                    var data = readLibrary();
                    data.books = data.books.filter(function(item) { return item.id !== bookId; });
                    if (data.hidden.indexOf(bookId) < 0) data.hidden.push(bookId);
                    persist(data);
                    if (currentTextbook === bookId) {
                        currentTextbook = ''; vocabList = []; currentUserVocabProgress = {};
                        localStorage.setItem('core_v4_current_textbook_id', '');
                    }
                    window.showVocabLibrarySelection(); close();
                } catch (error) { confirmDialog.querySelector('.library-editor-error').textContent = error.message; }
                finally { remove.disabled = false; }
            };
        };
    };
    window.openPublicTextbookCatalog = async function() {
        var catalog = open('みんなの単語帳', '<p class="library-editor-hint">公開された単語帳を、自分用に追加できます。</p><div id="libraryCatalog" aria-live="polite">読み込み中…</div><div class="library-editor-actions"><button type="button" data-library-close>閉じる</button></div>');
        var list = catalog.querySelector('#libraryCatalog');
        try {
            if (!cloudAvailable()) throw new Error('一覧に接続できません。接続後にもう一度お試しください。');
            var result = await window.fbGetDocs(window.fbCollection(window.db, 'publicTextbooks'));
            if (!catalog.isConnected) return;
            list.replaceChildren();
            result.forEach(function(doc) {
                var data = doc.data();
                if (!data || typeof data.name !== 'string' || typeof data.masterJson !== 'string') return;
                var master;
                try { master = JSON.parse(data.masterJson); } catch (e) { return; }
                if (!Array.isArray(master) || !master.every(function(word) { return word && Number.isInteger(Number(word.num)) && Number(word.num) > 0 && typeof word.word === 'string' && typeof word.meaning === 'string'; })) return;
                var row = document.createElement('div'); row.className = 'library-catalog-item';
                var details = document.createElement('div');
                var title = document.createElement('strong'); title.textContent = data.name;
                var count = document.createElement('small'); count.textContent = master.length + '語' + (data.ownerId === userId() ? ' ・ 自分が公開' : '');
                details.append(title, count);
                var add = document.createElement('button'); add.type = 'button'; add.textContent = '自分用に追加';
                add.onclick = function() {
                    try {
                        var id = 'personal_' + crypto.randomUUID();
                        var clean = master.map(function(word, index) {
                            return {num:index+1,word:word.word,meaning:word.meaning,sub:typeof word.sub==='string'?word.sub:'',meanings:(Array.isArray(word.meanings)&&word.meanings.length?word.meanings:[{text:word.meaning}]).map(function(meaning, i){return {id:(index+1)+'-'+i,text:String(meaning.text||'')};})};
                        });
                        var draft = {master:clean,progress:{},savedAt:new Date().toISOString()};
                        localStorage.setItem('core_v4_custom_words_' + userId() + '_' + id, JSON.stringify(clean));
                        localStorage.setItem('core_v4_cache_' + id, JSON.stringify(clean));
                        localStorage.setItem(window.__manualVocabLocalKey(id), JSON.stringify(draft));
                        textbooksCacheMap[id] = clean; window.__manualVocabDrafts[id] = draft;
                        var ownLibrary = readLibrary();
                        ownLibrary.books.push({id:id,name:data.name,cover:'📘',coverType:'text',personal:true,visibility:'private'});
                        persist(ownLibrary); add.textContent = '追加済み'; add.disabled = true;
                    } catch (error) { list.textContent = '追加できませんでした。' + error.message; }
                };
                row.append(details, add); list.appendChild(row);
            });
            if (!list.children.length) list.textContent = '公開された単語帳はまだありません。';
        } catch (error) { list.textContent = error.message; }
    };
    var render = window.renderVocabLibrarySelection;
    window.renderVocabLibrarySelection = function() { refreshPool(); return render.apply(this, arguments); };
    window.onAppLoaded(function() { refreshPool(); window.renderVocabLibrarySelection(); });
    window.renderVocabLibrarySelection();
})();
