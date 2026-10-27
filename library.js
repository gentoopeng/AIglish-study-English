// Personal vocabulary library. Shared teaching material stays available alongside it.
(function() {
    'use strict';
    function userId() { return myId || 'GUEST-000'; }
    // The distributed books as the index lists them, hidden ones included (the pool leaves those out).
    var sharedBooks = [];
    function key() { return 'core_v4_personal_library_' + userId(); }
    function readLibrary() {
        var raw = localStorage.getItem(key());
        if (!raw) return { books: [], hidden: [] };
        var data = JSON.parse(raw);
        if (!data || !Array.isArray(data.books) || !Array.isArray(data.hidden)) throw new Error('単語帳一覧を読み込めませんでした。再読み込みしてください。');
        if(window.LibraryState)data.books=data.books.filter(function(book){return !window.LibraryState.isDeleted('book',book.id);});
        return data;
    }
    function refreshPool() {
        var data = readLibrary();
        // Hidden distributed books are not in the pool, so the index's list brings one back when unhidden.
        var shared = textbooksPool.filter(function(book) { return !book.personal; });
        sharedBooks.forEach(function(book) { if (!shared.some(function(b) { return b.id === book.id; })) shared.push(book); });
        shared = shared.filter(function(book) { return !(window.LibraryState&&window.LibraryState.isDeleted('book',book.id)); });
        textbooksPool = shared.filter(function(book) { return data.hidden.indexOf(book.id) < 0; }).concat(data.books.filter(function(book){return data.hidden.indexOf(book.id)<0;}));
    }
    const pendingCatalogs=new Set();
    function persist(data) {
        pendingCatalogs.add(userId());
        if(window.LibraryState)data.books=data.books.filter(function(book){return !window.LibraryState.isDeleted('book',book.id);});
        data.savedAt = new Date().toISOString();
        data.books.forEach(function(book){book.updatedAt=data.savedAt;});
        localStorage.setItem(key(), JSON.stringify(data));
        if(window.queueBackgroundSave)window.queueBackgroundSave();
        syncLibraryCloud(data).catch(function(error){console.warn('単語帳一覧の同期を次回に再試行します',error);});
        refreshPool();
        window.renderVocabLibrarySelection();
        window.updateFlashcardSourceSelectOptions();
    }
    function mergeLibraries(local,remote,owner){
        return window.LibraryState.mergeCatalog(local,remote,owner||userId());
    }
    function setHidden(data,id,hidden){data.visibility=data.visibility||{};data.visibility[id]={hidden:!!hidden,updatedAt:Math.max(Date.now(),Number(data.visibility[id]&&data.visibility[id].updatedAt||0)+1)};data.hidden=(data.hidden||[]).filter(value=>value!==id);if(hidden)data.hidden.push(id);}
    async function syncLibraryCloud(snapshot){
        var owner=userId();if(owner==='GUEST-000'||!window.db||!window.fbRunTransaction)return;
        var ref=window.fbDoc(window.db,'users',owner,'library','catalog');
        var result=await window.fbRunTransaction(window.db,async function(tx){var doc=await tx.get(ref),remote=doc.exists()?JSON.parse(doc.data().libraryJson||'null'):null;var merged=mergeLibraries(snapshot,remote,owner);tx.set(ref,{libraryJson:JSON.stringify(merged)},{merge:true});return merged;});
        if(userId()===owner){localStorage.setItem(key(),JSON.stringify(mergeLibraries(readLibrary(),result)));if(readLibrary().savedAt===result.savedAt)pendingCatalogs.delete(owner);refreshPool();window.renderVocabLibrarySelection();}
    }
    function retryCatalog(){if(pendingCatalogs.has(userId()))syncLibraryCloud(readLibrary()).catch(function(error){console.warn('単語帳一覧の再同期を保留します',error);});}
    setInterval(retryCatalog,30000);window.addEventListener('online',retryCatalog);
    window.onAppLoaded(async function(){var owner=userId();if(owner==='GUEST-000'||!window.db||!window.fbGetDoc)return;try{var doc=await window.fbGetDoc(window.fbDoc(window.db,'users',owner,'library','catalog'));if(userId()!==owner)return;if(doc.exists()){localStorage.setItem(key(),JSON.stringify(mergeLibraries(readLibrary(),JSON.parse(doc.data().libraryJson||'null'))));refreshPool();window.renderVocabLibrarySelection();}await syncLibraryCloud(readLibrary());}catch(error){pendingCatalogs.add(owner);console.warn('単語帳一覧は端末の保存を使います',error);}});
    window.isPersonalTextbook = function(bookId) {
        return readLibrary().books.some(function(book) { return book.id === bookId; });
    };
    window.canEditCurrentTextbook = function() { return !!window.isAdmin || window.isPersonalTextbook(currentTextbook); };
    var originalSync = window.syncTextbooksIndexFromFirestore;
    window.syncTextbooksIndexFromFirestore = async function() {
        var shared = null;
        try { var result = await originalSync.apply(this, arguments); shared = textbooksPool.filter(function(b) { return b && b.id && !b.personal; }); sharedBooks = shared; return result; }
        finally { refreshPool(); window.renderVocabLibrarySelection(); if (shared) followSharedBooks(shared).catch(function(error) { console.warn('配信中の単語帳の変更を次回に反映します', error); }); }
    };
    // A copy of a distributed word book follows it: when the admin changes the distributed book
    // (its entry in shared/textbooks_index gets a newer updatedAt), every user's copy takes the
    // new words and the book's 用語・年号モード. Ratings, notes and sticky notes are kept by word
    // number. The index is read at start anyway, so an unchanged book costs no reads.
    function setCopyMaster(id, master) {
        var owner = userId();
        localStorage.setItem('core_v4_custom_words_' + owner + '_' + id, JSON.stringify(master));
        localStorage.setItem('core_v4_cache_' + id, JSON.stringify(master));
        textbooksCacheMap[id] = master;
        var draftKey = window.__manualVocabLocalKey(id), old = null;
        try { old = JSON.parse(localStorage.getItem(draftKey) || 'null'); } catch (e) {}
        var progress = (old && old.progress) || (window.LearningData ? window.LearningData.read(id) : {}) || {};
        var draft = { master: master, emptyConfirmed: false, progress: progress, savedAt: new Date().toISOString() };
        localStorage.setItem(draftKey, JSON.stringify(draft));
        window.__manualVocabDrafts[id] = draft;
        window.__dirtyManualVocabDrafts = window.__dirtyManualVocabDrafts || {};
        window.__manualVocabDraftRevisions = window.__manualVocabDraftRevisions || {};
        window.__manualVocabDraftRevisions[id] = (window.__manualVocabDraftRevisions[id] || 0) + 1;
        window.__dirtyManualVocabDrafts[id] = window.__manualVocabDraftRevisions[id];
    }
    var following = false;
    async function followSharedBooks(shared) {
        if (following || userId() === 'GUEST-000' || !window.db || !window.fbGetDoc) return;
        following = true;
        try {
            var owner = userId(), data = readLibrary(), changed = false, reopen = false;
            var plainName = function(name) { return String(name || '').replace(/（自分用）$/, ''); };
            for (var i = 0; i < data.books.length; i++) {
                var copy = data.books[i];
                if (!copy.personal) continue;
                // Copies made before copiedFrom was kept are matched once by name.
                var source = shared.find(function(b) { return b.id === copy.copiedFrom; }) ||
                    (!copy.copiedFrom && /（自分用）$/.test(copy.name || '') ? shared.find(function(b) { return b.name === plainName(copy.name); }) : null);
                if (!source) continue;
                if (copy.copiedFrom !== source.id) { copy.copiedFrom = source.id; changed = true; }
                if (!!copy.termMode !== (source.termMode === true)) { if (source.termMode === true) copy.termMode = true; else delete copy.termMode; changed = true; }
                var at = Date.parse(source.updatedAt || '') || 0;
                if (!at || at <= (Date.parse(copy.sourceSyncedAt || '') || 0)) continue;
                var snap = await window.fbGetDoc(window.fbDoc(window.db, 'shared', 'vocab_' + source.id));
                if (userId() !== owner) return;
                var words = snap.exists() && Array.isArray(snap.data().custom_words) ? window.stripVocabProgressFromWords(snap.data().custom_words) : null;
                if (!words || !words.length) continue;
                setCopyMaster(copy.id, words);
                copy.sourceSyncedAt = source.updatedAt;
                changed = true;
                if (currentTextbook === copy.id) reopen = true;
            }
            if (!changed || userId() !== owner) return;
            persist(data);
            if (reopen && !document.body.classList.contains('in-game-active') && typeof window.loadCurrentTextbookData === 'function') {
                await window.loadCurrentTextbookData();
                window.renderVocabList?.();
            }
        } finally { following = false; }
    }
    // Marks a distributed book as changed, so the copies follow it (above).
    window.__touchSharedBook = async function(bookId) {
        if (!window.db || !window.fbRunTransaction || !window.fbDoc || !bookId) return;
        var now = new Date().toISOString();
        await window.fbRunTransaction(window.db, async function(tx) {
            var ref = window.fbDoc(window.db, 'shared', 'textbooks_index'), snap = await tx.get(ref);
            var list = snap.exists() && Array.isArray(snap.data().textbooks) ? snap.data().textbooks.map(function(b) { return Object.assign({}, b); }) : [];
            var entry = list.find(function(b) { return b && b.id === bookId; });
            if (!entry) return;
            entry.updatedAt = now;
            tx.set(ref, { textbooks: list }, { merge: true });
        });
    };
    var originalMasterSave = window.saveVocabMasterToStorage;
    window.saveVocabMasterToStorage = async function() {
        if (!window.isPersonalTextbook(currentTextbook)) return originalMasterSave.apply(this, arguments);
        if(!window.VocabMaster.canCapture(currentTextbook,vocabList))return false;
        var master = window.stripVocabProgressFromWords(vocabList);
        localStorage.setItem('core_v4_custom_words_' + userId() + '_' + currentTextbook, JSON.stringify(master));
        localStorage.setItem('core_v4_cache_' + currentTextbook, JSON.stringify(master));
        textbooksCacheMap[currentTextbook] = master;
        window.saveVocabProgressLocally();
        window.__captureManualVocabDraft();
    };
    ['saveVocabToStorage','saveUserVocabProgress','saveVocabMasterToStorage'].forEach(function(name){
        var original=window[name];
        window[name]=function(){
            if(!currentTextbook&&vocabList.length===0)return Promise.resolve(false);
            if(window.LibraryState&&window.LibraryState.isDeleted('book',currentTextbook||'default'))return Promise.resolve(false);
            var owner=userId(),self=this,args=arguments;
            return window.LibraryState?window.LibraryState.track(owner,function(){return original.apply(self,args);}):original.apply(self,args);
        };
    });
    var originalProgressLoad=window.loadUserVocabProgress;
    window.loadUserVocabProgress=function(bookKey){
        bookKey=bookKey||currentTextbook||'default';
        if(window.LibraryState&&window.LibraryState.isDeleted('book',bookKey))return Promise.resolve(false);
        var owner=userId(),self=this;
        return window.LibraryState?window.LibraryState.track(owner,function(){return originalProgressLoad.call(self,bookKey);}):originalProgressLoad.call(self,bookKey);
    };
    var dialog = null;
    var opener = null;
    function cloudAvailable() { return !!(window.db && window.fbDoc && window.fbSetDoc && window.fbGetDocs && window.fbCollection); }
    function publicRef(id) { return window.fbDoc(window.db, 'publicTextbooks', id); }
    async function publish(record, master, previous) {
        if(window.LibraryState&&window.LibraryState.isDeleted('book',record.id))throw new Error('この単語帳は削除済みです。');
        if (record.visibility === 'public') {
            if (userId() === 'GUEST-000') throw new Error('みんなに公開するにはログインしてください。自分だけの単語帳はゲストでも作れます。');
            if (!cloudAvailable()) throw new Error('公開先に接続できません。「自分だけ」で保存するか、接続後にもう一度お試しください。');
            await window.fbSetDoc(publicRef(record.id), { ownerId: userId(), name: record.name, cover: record.cover, coverType: record.coverType, masterJson: JSON.stringify(window.stripVocabProgressFromWords(master)), updatedAt: new Date().toISOString() }, { merge: false });
        } else if (previous && previous.visibility === 'public') {
            if (!cloudAvailable() || !window.fbDeleteDoc) throw new Error('公開の取り消しには接続が必要です。接続後にもう一度お試しください。');
            await window.fbDeleteDoc(publicRef(record.id));
        }
    }
    window.publishVocabEntryMaster = async function(bookId, master, owner) {
        if(userId()!==owner)throw new Error('ユーザーが切り替わりました。');
        if(window.LibraryState?.isDeleted('book',bookId,owner))throw new Error('この単語帳は削除済みです。');
        var book=readLibrary().books.find(function(b){return b.id===bookId;});
        if(book){await publish(book,master,book);return;}
        if(!window.isAdmin)throw new Error('教材の編集権限を確認してください。');
        if(!cloudAvailable()||owner==='GUEST-000')throw new Error('配信先に接続できません。次の保存時に再試行します。');
        await window.fbSetDoc(window.fbDoc(window.db,'shared','vocab_'+bookId),{custom_words:window.stripVocabProgressFromWords(master),emptyConfirmed:false,updatedAt:new Date().toISOString()},{merge:true});
    };
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
        dialog.innerHTML = '<div class="library-editor-eyebrow"></div><h2 id="libraryEditorTitle"></h2>' + markup;
        dialog.querySelector('h2').textContent = title;
        document.body.appendChild(dialog);
        dialog.addEventListener('cancel', function(event) { event.preventDefault(); close(); });
        dialog.addEventListener('click', function(event) { if (event.target === dialog) close(); });
        dialog.querySelectorAll('[data-library-close]').forEach(function(button) { button.onclick = close; });
        dialog.showModal();
        return dialog;
    }
    window.openLibraryDialog = open;
    window.closeLibraryDialog = close;
    window.openLibraryBookEditor = function(bookId) {
        var editorUserId = userId();
        var book = textbooksPool.find(function(item) { return item.id === bookId; }) || readLibrary().books.find(function(item) { return item.id === bookId; });
        if (bookId && (!book || !window.isPersonalTextbook(bookId))) return;
        var modal = open(book ? '単語帳を編集' : '新しい単語帳',
            '<form id="libraryBookForm"><label for="libraryBookName">単語帳の名前</label><input id="libraryBookName" maxlength="80" required placeholder="例：英語・古文・日本史">' +
            '<label for="libraryBookCover">表紙の写真</label><input type="file" id="libraryBookCover" accept="image/*"><img id="libraryBookCoverPreview" class="library-cover-preview" alt="表紙プレビュー" hidden>' +
            '<label for="libraryBookVisibility">公開範囲</label><select id="libraryBookVisibility"><option value="private">自分だけ</option><option value="public">みんなに公開</option></select>' +
            '<label class="library-term-mode"><input type="checkbox" id="libraryBookTermMode">用語・年号モード<small>「」で囲んだ言葉と、行の頭の年号から問題を作ります（日本史・用語集など）。</small></label>' +
            '<label for="libraryBookWords">' + (book ? '単語を追加' : '最初の単語（あとから追加できます）') + '</label><textarea id="libraryBookWords" rows="5" placeholder="1:follow:①〜に従う②〜に続く:as follows 次のように…\n2:read:読む:read a book"></textarea>' +
            '<p class="library-editor-hint">番号:単語:意味:サブ情報（任意）。①②で複数の意味を登録できます。同じ番号は更新されます。JSON配列は全項目の置き換えです。<button type="button" id="libraryCopyPhotoPrompt" class="library-prompt-copy">写真から抽出するAI用プロンプトをコピー</button>公開されるのは単語帳の内容だけです。</p><p class="library-editor-error" role="alert"></p>' +
            '<div class="library-editor-actions"><button type="button" data-library-close>キャンセル</button><button type="submit" class="library-editor-primary">' + (book ? '変更を保存' : '単語帳を作る') + '</button></div></form>');
        var form = modal.querySelector('form');
        var cover = book && book.coverType === 'image' ? book.cover : '';
        var coverReady = Promise.resolve();
        function previewCover() { var preview=form.querySelector('#libraryBookCoverPreview');preview.hidden=!cover;if(cover)preview.src=cover; }
        previewCover();
        form.querySelector('#libraryBookCover').onchange=function(){
            var file=this.files[0];if(!file)return;
            coverReady=new Promise(function(resolve,reject){
                if(!file.type.startsWith('image/')){reject(new Error('画像ファイルを選んでください。'));return;}
                var reader=new FileReader();reader.onerror=function(){reject(new Error('画像を読み込めませんでした。'));};
                reader.onload=function(){var image=new Image();image.onerror=function(){reject(new Error('画像を開けませんでした。'));};image.onload=function(){var scale=Math.min(1,240/Math.max(image.width,image.height));var canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);cover=canvas.toDataURL('image/jpeg',.8);previewCover();resolve();};image.src=reader.result;};reader.readAsDataURL(file);
            });
            coverReady.catch(function(error){form.querySelector('.library-editor-error').textContent=error.message;});
        };
        form.querySelector('#libraryCopyPhotoPrompt').onclick=async function(){var button=this;var prompt="添付写真の教材を、このアプリの単語帳に登録できる形で抽出してください。英語に限らず、古文・漢文・歴史・理科などの単語、用語、一問一答を対象にします。\n\n【情報の選び方】\n・写真に載っている見出し語・用語・設問と、それに対応する主要な意味・答えを抽出します。主要な意味を勝手に増やさず、詳しい説明はサブ情報へ分けてください。\n・目的は定期試験・共通テストの基礎確認です。私が科目・学年・試験範囲・先生の指定を添えた場合は、その範囲を優先してください。範囲が不明な場合は写真の主要な内容を残し、出題されないと断定して省かないでください。\n・意味欄はフラッシュ単語や選択問題の答えになります。短く、単独で理解できる形にし、長い説明文、品詞表記、括弧だらけの注釈を混ぜないでください。区別に必要な条件は短く残してください。\n・同じ意味の言い換えは一つにまとめます。独立して覚える意味・答えだけを①②③で分けてください。この区切りごとに理解度を記録するため、説明の箇条書きには使わないでください。\n・サブ情報はタップして開く詳細欄なので、学習に役立つ情報を十分にまとめてください。写真の解説・用法・例文と訳・熟語・関連語・品詞・活用・注意点・紛らわしい項目との違いを、科目に応じて整理します。歴史なら背景・因果関係・関連人物や年代、理科なら原理・式・条件・単位などを入れてください。\n・写真の重要な補足は省略せずサブ情報へ入れてください。定期試験・共通テストでの理解や区別に役立つ説明・代表例は補って構いませんが、写真からの抽出と補足を「教材の補足」「理解の補足」のように区別してください。確信できない知識、無関係な雑学、範囲外の高度な専門情報を無理に足さず、同じ説明の重複を避けてください。サブ情報は「用法／例文／注意点」などの短い見出しと「・」「／」で読みやすくまとめ、詳しくても1項目1行を守ります。有用な補足が本当にない場合だけ空欄にしてください。\n\n【出力形式】\n1行に1項目、番号:単語・用語・短い設問:意味・答え:サブ情報\n・区切りは半角コロン3個。項目内のコロンは全角に置き換え、項目内で改行しないでください。サブ情報がなければ末尾のコロンだけ残します。\n・元の正の整数番号を保持します。番号がない場合だけ上から1、2、3…と付けます。同じ番号を複数の行に使わないでください。違う内容の同一番号がある場合は、私に番号の整理を確認してから出力してください。\n・見出し語を長い説明にせず、意味は①〜に従う②〜に続くのように分けます。一つの意味なら①は不要です。\n・写真で判読できない項目は推測せず、その項目を省略します。読み取れる主要な内容は漏らさないでください。\n・コードブロック、見出し、説明、JSON、理解度、履歴、個人メモは出力せず、登録用の行だけを返してください。\n\n形式例（意味は写真を優先し、補足は必要に応じて区別して記載すること）\n1:follow:①〜に従う②〜に続く:用法・follow＋指示や規則で「従う」／例文・Follow the rules. 規則に従いなさい。／熟語・as follows 次のように\n2:あはれなり:①しみじみと趣深い②かわいそうだ:品詞・形容動詞／注意点・文脈に応じて感動か同情かを判断する\n3:大化の改新が始まった年:645年:理解の補足・乙巳の変をきっかけに始まった政治改革／関連人物・中大兄皇子、中臣鎌足\n\nこの出力は同じ番号の項目を更新します。既存の単語帳へ追加する場合は、私が指定した未使用の開始番号や元の番号を守ってください。";try{await navigator.clipboard.writeText(prompt);button.textContent='コピーしました';}catch(e){var fallback=document.createElement('textarea');fallback.className='library-prompt-fallback';fallback.readOnly=true;fallback.value=prompt;button.after(fallback);fallback.select();button.textContent='下の文を選択してコピーしてください';}};
        if (book) {
            form.querySelector('#libraryBookName').value = book.name;
            form.querySelector('#libraryBookVisibility').value = book.visibility || 'private';
            form.querySelector('#libraryBookTermMode').checked = book.termMode === true;
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
                var master = [];
                var importText=form.querySelector('#libraryBookWords').value.trim();
                if(book){var recovered=window.VocabMaster.resolve(id);if(recovered)master=recovered.master;else if(importText[0]!=='[')throw new Error('単語データを読み込んでから編集してください。');}
                if(book&&importText[0]==='['&&!confirm('バックアップデータで完全に上書きしますか？'))return;
                master=window.parseVocabImport(importText,master);
                await coverReady;
                var record = { id: id, name: name, cover: cover || '📔', coverType: cover ? 'image' : 'text', personal: true, visibility: form.querySelector('#libraryBookVisibility').value };
                if (form.querySelector('#libraryBookTermMode').checked) record.termMode = true;
                await publish(record, master, book);
                if (userId() !== editorUserId) throw new Error('ユーザーが切り替わりました。単語帳一覧から開き直してください。');
                if(window.LibraryState&&window.LibraryState.isDeleted('book',id)){if(record.visibility==='public'&&window.fbDeleteDoc)await window.fbDeleteDoc(publicRef(id));throw new Error('この単語帳は削除済みです。');}
                var data = readLibrary();
                var index = data.books.findIndex(function(item) { return item.id === id; });
                if (index < 0) data.books.push(record); else data.books[index] = record;
                localStorage.setItem('core_v4_custom_words_' + userId() + '_' + id, JSON.stringify(master));
                localStorage.setItem('core_v4_cache_' + id, JSON.stringify(master));
                textbooksCacheMap[id] = master;
                // Keep progress and a complete draft together for restart and manual cloud saves.
                var progress = JSON.parse(localStorage.getItem(window.getVocabProgressStorageKey(id)) || '{}');
                if(importText[0]==='['){progress={};master.forEach(function(w){var meanings={};(w.meanings||[]).forEach(function(m){meanings[m.id]={status:m.status||'none',history:m.history||[]};});progress[String(w.num)]={sig:window.buildWordSignature(w),status:w.status||'none',history:w.history||[],note:w.note||'',meanings:meanings};});localStorage.setItem(window.getVocabProgressStorageKey(id),JSON.stringify(progress));localStorage.setItem(window.getVocabProgressStorageKey(id)+'__ts',String(Date.now()));}
                var draft = { master: master, emptyConfirmed:master.length===0, progress: progress, savedAt: new Date().toISOString() };
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
    function bookStorageKeys(id) {
        var progress=window.getVocabProgressStorageKey(id);
        return ['core_v4_custom_words_'+userId()+'_'+id,'core_v4_cache_'+id,'core_v4_user_vocab_book_'+userId()+'_'+id,window.__manualVocabLocalKey(id),progress,progress+'__ts','aiglish_learning_recovery_'+userId()+'_'+id,'core_v4_term_progress_'+userId()+'_'+encodeURIComponent(id)];
    }
    function scrubSave(save,id,kind,owner) {
        if(window.LibraryState)return window.LibraryState.sanitizeSave(save,owner||userId());
        var data=save.data||save, storage=data.localStorage||{}, memory=data.memory||{};
        bookStorageKeys(id).forEach(function(k){delete storage[k];});
        if(storage[key()]){var library=JSON.parse(storage[key()]);library.books=library.books.filter(function(b){return b.id!==id;});if(library.hidden.indexOf(id)<0)library.hidden.push(id);library.savedAt=new Date().toISOString();storage[key()]=JSON.stringify(library);}
        if(memory.vocabBooks)delete memory.vocabBooks[id];
        if(memory.textbooksPool)memory.textbooksPool=memory.textbooksPool.filter(function(b){return b.id!==id;});
        if(memory.vocabBookKey===id||memory.currentTextbook===id){memory.vocabBookKey='';memory.currentTextbook='';memory.vocabList=[];memory.vocabMaster=[];memory.vocabProgress={};}
        if(storage.core_v4_current_textbook_id===id)storage.core_v4_current_textbook_id='';
        return save;
    }
    // A save that never mentions the item has nothing to remove: skip parsing and rewriting it.
    // Any match (even an unrelated substring) falls back to the full scrub.
    function mentions(raw,id){return typeof raw!=='string'||raw.indexOf(JSON.stringify(String(id)).slice(1,-1))!==-1;}
    async function eraseBook(id,book,kind) {
        kind=kind||'book';
        var uid=userId();
        if(window.LibraryState){await window.LibraryState.mark(kind,id,book,uid);window.LibraryState.cleanLocal(uid);await window.LibraryState.waitForWrites(uid);}
        if(window.TextbookFiles)await window.TextbookFiles.remove(uid,kind==='work'?window.TextbookFiles.workKey(id):id);

        var localSaves=[];
        for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k.startsWith('save_studio_'+uid+'_')){var localRaw=localStorage.getItem(k);if(mentions(localRaw,id))localSaves.push([k,JSON.stringify(scrubSave(JSON.parse(localRaw),id,kind,uid))]);}}
        if(uid!=='GUEST-000') {
            if(!cloudAvailable()||!window.fbDeleteDoc)throw new Error('完全削除にはクラウド接続が必要です。接続後に再度お試しください。');
            var saves=await window.fbGetDocs(window.fbCollection(window.db,'users',uid,'saves'));
            var jobs=[];saves.forEach(function(doc){jobs.push(doc);});
            for(var doc of jobs){
                var meta=doc.data(), raw='', parts=[];
                if(meta.partCount){
                    var snapshot=await window.fbGetDocs(window.fbCollection(window.db,'users',uid,'saves',doc.id,'parts'));
                    snapshot.forEach(function(p){parts.push(p);});
                    for(var n=0;n<meta.partCount;n++){var part=parts.find(function(p){return p.id===(meta.generation?meta.generation+'_p'+n:'p'+n);});if(!part)throw new Error('古いセーブの読み込みに失敗しました。削除を中止しました。');raw+=part.data().d;}
                    if((meta.rawLength!=null&&meta.rawLength!==raw.length)||(meta.checksum&&meta.checksum!==window.__gameSaveChecksum(raw)))throw new Error('古いセーブを検証できません。削除を中止しました。');
                    if(!mentions(raw,id)){raw='';parts=[];continue;}
                    var clean=JSON.stringify(scrubSave(JSON.parse(raw),id,kind,uid));var generation='delete_'+crypto.randomUUID(),chunks=[];
                    for(var offset=0;offset<clean.length;offset+=280000)chunks.push(clean.slice(offset,offset+280000));
                    for(var p=0;p<chunks.length;p++)await window.fbSetDoc(window.fbDoc(window.db,'users',uid,'saves',doc.id,'parts',generation+'_p'+p),{d:chunks[p]},{merge:false});
                    await window.fbSetDoc(window.fbDoc(window.db,'users',uid,'saves',doc.id),Object.assign({},meta,{generation:generation,partCount:chunks.length,rawLength:clean.length,checksum:window.__gameSaveChecksum(clean)}),{merge:false});
                    for(var old of parts)await window.fbDeleteDoc(window.fbDoc(window.db,'users',uid,'saves',doc.id,'parts',old.id));
                }else if(meta.v===6){
                    // Itemized backup: rewrite only the items that mention it and remove the replaced ones
                    // now, so the deletion stays pending (and is retried) until the cloud copy is clean.
                    if(!window.__rewriteCloudSave)throw new Error('セーブを整理できません。削除を中止しました。');
                    await window.__rewriteCloudSave(uid,function(save){return mentions(JSON.stringify(save),id)?scrubSave(save,id,kind,uid):null;});
                }else if(meta.data&&mentions(JSON.stringify(meta),id)){await window.fbSetDoc(window.fbDoc(window.db,'users',uid,'saves',doc.id),scrubSave(meta,id,kind,uid),{merge:false});}
            }
            if(kind==='work'&&window.TextbookFiles){
                var workFileId=encodeURIComponent(window.TextbookFiles.workKey(id));
                var workFileParts=await window.fbGetDocs(window.fbCollection(window.db,'users',uid,'vocabBooks',workFileId,'parts'));
                var workFileRefs=[];workFileParts.forEach(function(part){workFileRefs.push(window.fbDoc(window.db,'users',uid,'vocabBooks',workFileId,'parts',part.id));});
                for(var workFileRef of workFileRefs)await window.fbDeleteDoc(workFileRef);
            }
            if(kind==='book'){
            var cloudId=window.__manualVocabCloudId(id);
            var bookParts=await window.fbGetDocs(window.fbCollection(window.db,'users',uid,'vocabBooks',cloudId,'parts'));
            var refs=[];bookParts.forEach(function(p){refs.push(window.fbDoc(window.db,'users',uid,'vocabBooks',cloudId,'parts',p.id));});
            for(var ref of refs)await window.fbDeleteDoc(ref);
            await window.fbDeleteDoc(window.fbDoc(window.db,'users',uid,'vocabBooks',cloudId));
            await window.fbDeleteDoc(window.fbDoc(window.db,'users',uid,'vocabProgress',id));
            if(book.personal){var publicBookRef=window.fbDoc(window.db,'publicTextbooks',id);var publicBook=await window.fbGetDoc(publicBookRef);if(publicBook.exists()&&publicBook.data().ownerId===uid)await window.fbDeleteDoc(publicBookRef);}
            }else{
                var publicWorkRef=window.fbDoc(window.db,'publicWorkbooks',id);
                if(window.fbGetDoc){var publicWork=await window.fbGetDoc(publicWorkRef);if(publicWork&&publicWork.exists()&&publicWork.data().ownerId===uid)await window.fbDeleteDoc(publicWorkRef);}
                else if(book.visibility==='public')await window.fbDeleteDoc(publicWorkRef);
                // Legacy workbooks were published in a shared array. Remove only this owner's entry atomically.
                if(window.fbRunTransaction){
                    var legacyRef=window.fbDoc(window.db,'public_works','all');
                    await window.fbRunTransaction(window.db,async function(transaction){
                        var legacy=await transaction.get(legacyRef);if(!legacy.exists()||!legacy.data().worksJson)return;
                        var records=JSON.parse(legacy.data().worksJson);if(!Array.isArray(records))throw new Error('従来の公開ワーク一覧を確認できませんでした。');
                        var kept=records.filter(function(record){return !(record.id===id&&record.sharedBy===uid);});
                        if(kept.length!==records.length)transaction.set(legacyRef,{worksJson:JSON.stringify(kept),updatedAt:Date.now()},{merge:true});
                    });
                }
            }

        }
        if(userId()!==uid)throw new Error('ユーザーが切り替わりました。開き直してください。');
        if(window.__pendingGameSaveMemory&&window.__pendingGameSaveMemory.id===uid)scrubSave({memory:window.__pendingGameSaveMemory.data},id,kind,uid);
        localSaves.forEach(function(save){localStorage.setItem(save[0],save[1]);});
        if(kind==='book')bookStorageKeys(id).forEach(function(k){localStorage.removeItem(k);});
        if(kind==='book')[textbooksCacheMap,window.__manualVocabDrafts,window.__dirtyManualVocabDrafts,window.__manualVocabDraftRevisions,window.__dirtyVocabProgress].forEach(function(map){if(map)delete map[id];});
        if(window.LibraryState){window.LibraryState.cleanLocal(uid);await window.LibraryState.complete(kind,id,uid);}
    }

    window.eraseLibraryItem=eraseBook;
    // The startup delay is separate from failure back-off: reconnecting skips back-off, never the delay.
    var retrying=false,retryFailures=0,nextRetryAt=0,startupUntil=Date.now()+60000;
    // If the page ended while pending deletions were being processed (an iOS termination
    // leaves no error), pause automatic processing for 24 hours. The deletions stay recorded.
    var deletionGuardKey='__aiglish_deletion_guard',suppressedUntil=0;
    function readDeletionGuard(){try{return JSON.parse(localStorage.getItem(deletionGuardKey)||'null')||{};}catch(e){return {};}}
    function writeDeletionGuard(value){try{localStorage.setItem(deletionGuardKey,JSON.stringify(value));}catch(e){}}
    (function(){var guard=readDeletionGuard();if(guard.startedAt){suppressedUntil=Date.now()+86400000;writeDeletionGuard({suppressUntil:suppressedUntil});}else suppressedUntil=Number(guard.suppressUntil)||0;})();
    // Each retry re-reads and rewrites every local and cloud save. A deletion that keeps
    // failing must not repeat that every 30 seconds: back off 1, 2, 4 ... up to 60 minutes.
    async function retryPendingDeletions(force){
        if(retrying||!window.LibraryState)return;
        if(Date.now()<suppressedUntil||Date.now()<startupUntil||document.hidden)return;
        if(force!==true&&Date.now()<nextRetryAt)return;
        retrying=true;var guarded=false;
        try{var owner=userId();await window.LibraryState.loadCloud(owner);if(userId()!==owner)return;for(var item of Object.values(window.LibraryState.read(owner))){if(userId()!==owner)return;if(item.pending){if(!guarded){guarded=true;writeDeletionGuard({startedAt:Date.now()});}await eraseBook(item.id,item.metadata,item.kind);}}window.LibraryState.cleanLocal(owner);retryFailures=0;nextRetryAt=0;}
        catch(e){retryFailures++;nextRetryAt=Date.now()+Math.min(3600000,60000*Math.pow(2,retryFailures-1));console.warn('削除の同期は接続後に再試行します',e);}
        finally{retrying=false;if(guarded)writeDeletionGuard({});}
    }
    setInterval(function(){if(window.LibraryState&&Object.values(window.LibraryState.read()).some(function(item){return item.pending;}))retryPendingDeletions();},30000);
    function applyDeletionVisibility(){
        if(!window.LibraryState)return;
        if(currentTextbook&&window.LibraryState.isDeleted('book',currentTextbook)){
            var play=document.getElementById('flashcard-play-screen');if(play&&play.style.display!=='none'&&window.finishFlashcardSession)window.finishFlashcardSession();
            currentTextbook='';vocabList=[];currentUserVocabProgress={};localStorage.setItem('core_v4_current_textbook_id','');window.showVocabLibrarySelection();
        }
        refreshPool();window.renderVocabLibrarySelection();
    }
    window.addEventListener('storage',function(event){if(window.LibraryState&&event.key===window.LibraryState.storageKey(userId()))applyDeletionVisibility();});
    window.addEventListener('online',function(){retryPendingDeletions(true);});
    // Not at launch: startup already loads the active book, background and warm-up.
    window.onAppLoaded(function(){setTimeout(retryPendingDeletions,60000);});
    // A shared word book copied into the user's own: same words, the understanding so far, and
    // editable from then on. The original can leave the list at the same time.
    async function copyBook(bookId, hideOriginal) {
        var owner = userId();
        var book = textbooksPool.find(function(item) { return item.id === bookId; });
        if (!book) throw new Error('単語帳が見つかりません。');
        var source = await window.__getBookMasterWords(bookId);
        if (userId() !== owner) throw new Error('ユーザーが切り替わりました。単語帳一覧から開き直してください。');
        if (!Array.isArray(source) || !source.length) throw new Error('単語を読み込めませんでした。接続後にもう一度お試しください。');
        var master = window.stripVocabProgressFromWords(source).map(function(w) { return Object.assign({}, w); });
        var id = 'personal_' + crypto.randomUUID();
        var record = { id: id, name: (book.name + '（自分用）').slice(0, 80), cover: book.cover || '📔', coverType: book.coverType === 'image' ? 'image' : 'text', personal: true, visibility: 'private', copiedFrom: bookId };
        if (book.termMode) record.termMode = true;
        await publish(record, master, null);
        if (userId() !== owner) throw new Error('ユーザーが切り替わりました。単語帳一覧から開き直してください。');
        var progress = window.LearningData ? window.LearningData.read(bookId) : {};
        var progressRaw = JSON.stringify(progress || {});
        localStorage.setItem('core_v4_custom_words_' + owner + '_' + id, JSON.stringify(master));
        localStorage.setItem('core_v4_cache_' + id, JSON.stringify(master));
        localStorage.setItem(window.getVocabProgressStorageKey(id), progressRaw);
        if (window.LearningData && window.LearningData.recoveryKey) localStorage.setItem(window.LearningData.recoveryKey(id), progressRaw);
        textbooksCacheMap[id] = master;
        var draft = { master: master, emptyConfirmed: false, progress: progress || {}, savedAt: new Date().toISOString() };
        localStorage.setItem(window.__manualVocabLocalKey(id), JSON.stringify(draft));
        window.__manualVocabDrafts[id] = draft;
        window.__dirtyManualVocabDrafts = window.__dirtyManualVocabDrafts || {};
        window.__manualVocabDraftRevisions = window.__manualVocabDraftRevisions || {};
        window.__manualVocabDraftRevisions[id] = (window.__manualVocabDraftRevisions[id] || 0) + 1;
        window.__dirtyManualVocabDrafts[id] = window.__manualVocabDraftRevisions[id];
        var data = readLibrary();
        data.books.push(record);
        if (hideOriginal) setHidden(data, bookId, true);
        persist(data);
        return record;
    }
    function openCopyBook(bookId) {
        var book = textbooksPool.find(function(item) { return item.id === bookId; });
        if (!book) return;
        var modal = open('自分用にコピーして編集', '<p class="library-editor-hint"></p>' +
            '<label class="library-term-mode"><input type="checkbox" id="libraryCopyHide" checked>元の単語帳を一覧から外す<small>あとから「非表示の単語帳」で戻せます。</small></label>' +
            '<p class="library-editor-error" role="alert"></p><div class="library-editor-actions"><button type="button" data-library-close>キャンセル</button><button type="button" id="libraryCopyConfirm" class="library-editor-primary">コピーする</button></div>');
        modal.querySelector('.library-editor-hint').textContent = '「' + book.name + '」の単語と、これまでの理解度を自分の単語帳にコピーします。コピーした単語帳は自由に編集できます（元の単語帳は変わりません）。';
        var confirmButton = modal.querySelector('#libraryCopyConfirm');
        confirmButton.onclick = async function() {
            if (confirmButton.disabled) return;
            confirmButton.disabled = true;
            confirmButton.textContent = 'コピー中…';
            try {
                var record = await copyBook(bookId, modal.querySelector('#libraryCopyHide').checked);
                close();
                if (window.showToast) window.showToast('「' + record.name + '」を作りました。単語を自由に編集できます。', 'ok');
                window.selectVocabLibraryBook(record.id);
            } catch (error) {
                modal.querySelector('.library-editor-error').textContent = error.message;
                confirmButton.disabled = false;
                confirmButton.textContent = 'コピーする';
            }
        };
    }
    window.openCopyLibraryBook = openCopyBook;

    // Admin editing mode: a word book the admin copied for themselves (to change it freely, or to
    // turn on 用語・年号モード) goes back to the distributed book everyone uses. The distributed
    // book's words become the copy's (numbers kept, so everyone's ratings stay on their words),
    // and its 用語・年号モード is set in the shared index, in one transaction. A book of the admin's
    // own that is not a copy can be distributed as a new book (targetId NEW_SHARED); from then on
    // it is linked to it like a copy.
    var NEW_SHARED = '__new__';
    async function pushToShared(copyId, targetId, termMode) {
        if (window.__adminBookEditing !== true || window.isAdmin !== true) throw new Error('管理者ツールで「配信中の単語帳を編集する」にしてから操作してください。');
        if (!window.db || !window.fbRunTransaction || !window.fbDoc) throw new Error('クラウドにつながっていません。');
        var master = currentTextbook === copyId && Array.isArray(vocabList) && vocabList.length ? window.stripVocabProgressFromWords(vocabList) : await window.__getBookMasterWords(copyId);
        if (!Array.isArray(master) || !master.length) throw new Error('反映する単語がありません。');
        var now = new Date().toISOString(), entry = null, created = targetId === NEW_SHARED;
        var own = readLibrary().books.find(function(b) { return b.id === copyId; });
        if (created) {
            if (!own) throw new Error('単語帳が見つかりません。');
            targetId = 'shared_' + crypto.randomUUID();
        }
        await window.fbRunTransaction(window.db, async function(tx) {
            var indexRef = window.fbDoc(window.db, 'shared', 'textbooks_index');
            var snap = await tx.get(indexRef);
            var list = snap.exists() && Array.isArray(snap.data().textbooks) ? snap.data().textbooks.map(function(b) { return Object.assign({}, b); }) : [];
            entry = list.find(function(b) { return b && b.id === targetId; });
            if (!entry && created) {
                entry = { id: targetId, name: String(own.name || '単語帳').replace(/（自分用）$/, '').slice(0, 80), cover: own.cover || '📔', coverType: own.coverType === 'image' ? 'image' : 'text' };
                list.push(entry);
            }
            if (!entry) throw new Error('配信中の単語帳が見つかりません。');
            if (termMode) entry.termMode = true; else delete entry.termMode;
            entry.updatedAt = now;
            tx.set(indexRef, { textbooks: list }, { merge: true });
            tx.set(window.fbDoc(window.db, 'shared', 'vocab_' + targetId), { custom_words: master, emptyConfirmed: false, updatedAt: now }, { merge: true });
        });
        // This device sees the new words and mode at once.
        textbooksCacheMap[targetId] = master;
        try { localStorage.setItem('core_v4_cache_' + targetId, JSON.stringify(master)); } catch (e) {}
        textbooksPool.forEach(function(b) { if (b.id === targetId) { if (termMode) b.termMode = true; else delete b.termMode; b.updatedAt = now; } });
        if (created) textbooksPool.push(Object.assign({}, entry));
        var mine = readLibrary(), self = mine.books.find(function(b) { return b.id === copyId; });
        // The admin keeps working in their own book; the new distributed one stays out of their list.
        if (created) setHidden(mine, targetId, true);
        if (self) { self.copiedFrom = targetId; self.sourceSyncedAt = now; if (termMode) self.termMode = true; else delete self.termMode; }
        if (self || created) persist(mine);
        return { name: entry.name, count: master.length };
    }
    async function openPushShared(copyId) {
        var copy = readLibrary().books.find(function(b) { return b.id === copyId; });
        if (!copy) return;
        var modal = open('全員に配信・反映', '<p class="library-editor-hint"></p><label for="libraryPushTarget">反映先</label><select id="libraryPushTarget"><option value="">読み込み中…</option></select>' +
            '<label class="library-term-mode"><input type="checkbox" id="libraryPushTermMode">用語・年号モード<small>「」で囲んだ言葉と、行の頭の年号から問題を作ります。</small></label>' +
            '<p class="library-editor-error" role="alert"></p><div class="library-editor-actions"><button type="button" data-library-close>キャンセル</button><button type="button" id="libraryPushConfirm" class="library-editor-primary">全員に反映</button></div>');
        var hint = modal.querySelector('.library-editor-hint');
        var explain = function() {
            hint.textContent = select.value === NEW_SHARED
                ? '「' + copy.name + '」を新しい単語帳として全員に配信します。このあと直した内容も、ここからまた反映できます。'
                : '「' + copy.name + '」の単語で、配信中の単語帳を置き換えます。番号が同じ単語の理解度・メモ・付箋は、使っている人それぞれにそのまま残ります。';
        };
        modal.querySelector('#libraryPushTermMode').checked = copy.termMode === true;
        var select = modal.querySelector('#libraryPushTarget');
        explain();
        select.onchange = explain;
        var confirmButton = modal.querySelector('#libraryPushConfirm'), error = modal.querySelector('.library-editor-error');
        confirmButton.disabled = true;
        try {
            var snap = await window.fbGetDoc(window.fbDoc(window.db, 'shared', 'textbooks_index'));
            var list = snap.exists() && Array.isArray(snap.data().textbooks) ? snap.data().textbooks.filter(function(b) { return b && b.id && !b.personal; }) : [];
            var guess = list.find(function(b) { return b.id === copy.copiedFrom; }) || list.find(function(b) { return (b.name + '（自分用）') === copy.name || b.name === String(copy.name).replace(/（自分用）$/, ''); });
            select.replaceChildren();
            list.forEach(function(b) { var option = document.createElement('option'); option.value = b.id; option.textContent = b.name || b.id; select.append(option); });
            var fresh = document.createElement('option');
            fresh.value = NEW_SHARED;
            fresh.textContent = '＋ 新しく配信する';
            select.append(fresh);
            // A book that is not a copy of a distributed one starts as a new one.
            select.value = guess ? guess.id : NEW_SHARED;
            explain();
            confirmButton.disabled = false;
        } catch (e) { error.textContent = e.message || '配信中の単語帳を読み込めませんでした。'; return; }
        confirmButton.onclick = async function() {
            if (confirmButton.disabled) return;
            confirmButton.disabled = true;
            confirmButton.textContent = '反映しています…';
            error.textContent = '';
            try {
                var result = await pushToShared(copyId, select.value, modal.querySelector('#libraryPushTermMode').checked);
                close();
                window.showToast?.('「' + result.name + '」に' + result.count + '語を反映しました。', 'ok');
                window.renderVocabLibrarySelection?.();
            } catch (e) {
                error.textContent = e.message;
                confirmButton.disabled = false;
                confirmButton.textContent = '全員に反映';
            }
        };
    }
    window.LibraryPushShared = Object.freeze({ open: openPushShared, push: pushToShared });

    window.openLibraryBookActions = function(bookId) {
        var actionUserId = userId();
        var book = textbooksPool.find(function(item) { return item.id === bookId; }) || readLibrary().books.find(function(item) { return item.id === bookId; });
        if (!book) return;
        var own = window.isPersonalTextbook(bookId);
        var modal = open(book.name, '<div class="library-editor-actions library-editor-actions-stack">' +
            (own ? '<button type="button" id="libraryEditBook">名前・表紙を編集 / 単語を追加</button>' : '<button type="button" id="libraryCopyBook">自分用にコピーして編集</button>') +
            (own && window.__adminBookEditing === true && window.isAdmin === true ? '<button type="button" id="libraryPushShared">全員に配信・反映</button>' : '') +
            (readLibrary().hidden.indexOf(bookId) >= 0 ? '<button type="button" id="libraryRestoreBook">一覧に戻す</button>' : '') +
            '<button type="button" id="libraryRemoveBook" class="library-editor-danger">' + '自分の一覧から外す' + '</button>' + '<button type="button" id="libraryEraseBook" class="library-editor-danger">' + (own ? '単語帳を完全削除' : '自分の単語帳データを完全削除') + '</button>' + '<button type="button" data-library-close>閉じる</button></div>');
        if (own) modal.querySelector('#libraryEditBook').onclick = function() { window.openLibraryBookEditor(bookId); };
        else modal.querySelector('#libraryCopyBook').onclick = function() { openCopyBook(bookId); };
        var push = modal.querySelector('#libraryPushShared');
        if (push) push.onclick = function() { openPushShared(bookId); };
        var restore = modal.querySelector('#libraryRestoreBook');
        if (restore) restore.onclick = function() { var data = readLibrary(); setHidden(data,bookId,false); persist(data); close(); };
        function removeBook(permanent) {
            var confirmDialog = open('「' + book.name + '」を' + (permanent ? '完全削除しますか？' : '一覧から外しますか？'),
                '<p class="library-editor-hint">' + (permanent ? (own ? '単語・理解度・保存済みセーブ内のデータと公開一覧から削除します。元に戻せません。他の人が追加したコピーは残ります。' : 'この端末と自分のクラウドにある単語帳・学習データを削除します。他の人と配信用の原本は残ります。') : '一覧から非表示にします。単語と学習データは残ります。') + '</p><p class="library-editor-error" role="alert"></p><div class="library-editor-actions"><button type="button" data-library-close>キャンセル</button><button type="button" id="libraryConfirmRemove" class="library-editor-danger">' + (permanent ? '完全削除する' : '一覧から外す') + '</button></div>');
            confirmDialog.querySelector('#libraryConfirmRemove').onclick = async function() {
                var remove = confirmDialog.querySelector('#libraryConfirmRemove');
                if (remove.disabled) return;
                remove.disabled = true;
                var removeLabel = remove.textContent;
                remove.textContent = permanent ? '削除中…' : '変更中…';
                try {
                    if (userId() !== actionUserId) throw new Error('ユーザーが切り替わりました。単語帳一覧から開き直してください。');
                    if (permanent) await eraseBook(bookId,Object.assign({},book,{personal:own}));
                    if (userId() !== actionUserId) throw new Error('ユーザーが切り替わりました。単語帳一覧から開き直してください。');
                    var data = readLibrary();
                    if(permanent)data.books = data.books.filter(function(item) { return item.id !== bookId; });
                    setHidden(data,bookId,true);
                    persist(data);
                    if (currentTextbook === bookId) {
                        currentTextbook = ''; vocabList = []; currentUserVocabProgress = {};
                        localStorage.setItem('core_v4_current_textbook_id', '');
                    }
                    window.showVocabLibrarySelection(); close();
                } catch (error) { confirmDialog.querySelector('.library-editor-error').textContent = error.message;if(window.LibraryState&&window.LibraryState.isDeleted('book',bookId)){refreshPool();window.renderVocabLibrarySelection();} }
                finally { remove.disabled = false; remove.textContent = removeLabel; }
            };
        }
        modal.querySelector('#libraryRemoveBook').onclick=function(){removeBook(false);};
        modal.querySelector('#libraryEraseBook').onclick=function(){removeBook(true);};
    };
    window.openHiddenTextbookList = function() {
        var data = readLibrary();
        var modal = open('非表示の単語帳', '<div id="libraryHiddenBooks"></div><div class="library-editor-actions"><button type="button" data-library-close>閉じる</button></div>');
        var list = modal.querySelector('#libraryHiddenBooks');
        data.books.filter(function(book) { return data.hidden.indexOf(book.id) >= 0; }).forEach(function(book) {
            var row = document.createElement('div'); row.className = 'library-catalog-item';
            var name = document.createElement('div'); name.textContent = book.name;
            var manage = document.createElement('button'); manage.type = 'button'; manage.textContent = '管理';
            manage.onclick = function() { window.openLibraryBookActions(book.id); };
            row.append(name, manage); list.append(row);
        });
        // Distributed books taken off the list (for example when copied for oneself) come back here.
        sharedBooks.filter(function(book) { return data.hidden.indexOf(book.id) >= 0; }).forEach(function(book) {
            var row = document.createElement('div'); row.className = 'library-catalog-item';
            var name = document.createElement('div'); name.textContent = book.name;
            var tag = document.createElement('small'); tag.textContent = '配信中'; name.append(' ', tag);
            var restore = document.createElement('button'); restore.type = 'button'; restore.textContent = '一覧に戻す';
            restore.onclick = function() { var latest = readLibrary(); setHidden(latest, book.id, false); persist(latest); row.remove(); if (!list.children.length) list.textContent = '非表示の単語帳はありません。'; window.showToast?.('「' + book.name + '」を一覧に戻しました。', 'ok'); };
            row.append(name, restore); list.append(row);
        });
        if (!list.children.length) list.textContent = '非表示の単語帳はありません。';
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
                        // A copy numbers words in the order they are shown and keeps their units.
                        var clean = (window.VocabOrder ? window.VocabOrder.sort(master) : master).map(function(word, index) {
                            return {num:index+1,...(window.VocabOrder&&window.VocabOrder.cleanUnit(word.unit)?{unit:window.VocabOrder.cleanUnit(word.unit)}:{}),word:word.word,meaning:word.meaning,sub:typeof word.sub==='string'?word.sub:'',meanings:(Array.isArray(word.meanings)&&word.meanings.length?word.meanings:[{text:word.meaning}]).map(function(meaning, i){return {id:(index+1)+'-'+i,text:String(meaning.text||''),partOfSpeech:String(meaning.partOfSpeech||meaning.pos||word.partOfSpeech||word.pos||''),...(meaning.minor===true?{minor:true}:{})};})};
                        });
                        var draft = {master:clean,progress:{},savedAt:new Date().toISOString()};
                        localStorage.setItem('core_v4_custom_words_' + userId() + '_' + id, JSON.stringify(clean));
                        localStorage.setItem('core_v4_cache_' + id, JSON.stringify(clean));
                        localStorage.setItem(window.__manualVocabLocalKey(id), JSON.stringify(draft));
                        textbooksCacheMap[id] = clean; window.__manualVocabDrafts[id] = draft;
                        var ownLibrary = readLibrary();
                        ownLibrary.books.push({id:id,name:data.name,cover:data.coverType==='image'&&/^data:image\/(jpeg|png|webp);base64,/.test(data.cover||'')?data.cover:'📘',coverType:data.coverType==='image'&&/^data:image\/(jpeg|png|webp);base64,/.test(data.cover||'')?'image':'text',personal:true,visibility:'private'});
                        window.__dirtyManualVocabDrafts=window.__dirtyManualVocabDrafts||{};window.__dirtyManualVocabDrafts[id]=draft.savedAt;persist(ownLibrary); add.textContent = '追加済み'; add.disabled = true;
                    } catch (error) { list.textContent = '追加できませんでした。' + error.message; }
                };
                row.append(details, add); list.appendChild(row);
            });
            if (!list.children.length) list.textContent = '公開された単語帳はまだありません。';
        } catch (error) { list.textContent = error.message; }
    };
    var render = window.renderVocabLibrarySelection;
    window.renderVocabLibrarySelection = function() { refreshPool(); var hidden = document.getElementById('libraryHiddenBooksButton'); if(hidden){var data=readLibrary();hidden.hidden=!data.books.concat(sharedBooks).some(function(book){return data.hidden.indexOf(book.id)>=0;});} return render.apply(this, arguments); };
    window.onAppLoaded(function() { refreshPool(); window.renderVocabLibrarySelection(); });
    window.renderVocabLibrarySelection();
})();
