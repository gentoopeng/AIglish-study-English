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
        if(window.LibraryState)data.books=data.books.filter(function(book){return !window.LibraryState.isDeleted('book',book.id);});
        return data;
    }
    function refreshPool() {
        var data = readLibrary();
        var shared = textbooksPool.filter(function(book) { return !book.personal && !(window.LibraryState&&window.LibraryState.isDeleted('book',book.id)); });
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
        try { return await originalSync.apply(this, arguments); }
        finally { refreshPool(); window.renderVocabLibrarySelection(); }
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
    window.openLibraryDialog = open;
    window.closeLibraryDialog = close;
    window.openLibraryBookEditor = function(bookId) {
        var editorUserId = userId();
        var book = textbooksPool.find(function(item) { return item.id === bookId; }) || readLibrary().books.find(function(item) { return item.id === bookId; });
        if (bookId && (!book || !window.isPersonalTextbook(bookId))) return;
        var modal = open(book ? '単語帳を編集' : '新しい単語帳',
            '<form id="libraryBookForm"><label for="libraryBookName">単語帳の名前</label><input id="libraryBookName" maxlength="80" required placeholder="例：毎日の英単語">' +
            '<label for="libraryBookCover">表紙の写真</label><input type="file" id="libraryBookCover" accept="image/*"><img id="libraryBookCoverPreview" class="library-cover-preview" alt="表紙プレビュー" hidden>' +
            '<label for="libraryBookVisibility">公開範囲</label><select id="libraryBookVisibility"><option value="private">自分だけ</option><option value="public">みんなに公開</option></select>' +
            '<label for="libraryBookWords">' + (book ? '単語を追加' : '最初の単語（あとから追加できます）') + '</label><textarea id="libraryBookWords" rows="5" placeholder="1:follow:①〜に従う②〜に続く:as follows 次のように…\n2:read:読む:read a book"></textarea>' +
            '<p class="library-editor-hint">番号:単語:意味:サブ情報（任意）。①②で複数の意味を登録できます。JSONバックアップにも対応。<button type="button" id="libraryCopyPhotoPrompt" class="library-prompt-copy">写真から抽出するAI用プロンプトをコピー</button>公開されるのは単語帳の内容だけです。</p><p class="library-editor-error" role="alert"></p>' +
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
        form.querySelector('#libraryCopyPhotoPrompt').onclick=async function(){var button=this;var prompt='添付写真に写っている英単語帳を読み取り、次の形式だけで出力してください。1行に1語、番号:英単語:日本語の意味:サブ情報。元の番号を保持し、複数の意味は①意味②意味のように並べてください。サブ情報には熟語・例文・補足を入れ、なければ空欄にしてください。区切りのコロンは半角を使い、各項目の内部にはコロンを使わないでください。写真で読めない箇所は推測せず、その行を省略してください。コードブロックや見出し、余分な説明は付けず、登録用の行だけを返してください。例: 1:follow:①〜に従う②〜に続く:as follows 次のように';try{await navigator.clipboard.writeText(prompt);button.textContent='コピーしました';}catch(e){var fallback=document.createElement('textarea');fallback.className='library-prompt-fallback';fallback.readOnly=true;fallback.value=prompt;button.after(fallback);fallback.select();button.textContent='下の文を選択してコピーしてください';}};
        if (book) {
            form.querySelector('#libraryBookName').value = book.name;
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
                var master = [];
                var importText=form.querySelector('#libraryBookWords').value.trim();
                if(book){var recovered=window.VocabMaster.resolve(id);if(recovered)master=recovered.master;else if(importText[0]!=='[')throw new Error('単語データを読み込んでから編集してください。');}
                if(book&&importText[0]==='['&&!confirm('バックアップデータで完全に上書きしますか？'))return;
                master=window.parseVocabImport(importText,master);
                await coverReady;
                var record = { id: id, name: name, cover: cover || '📔', coverType: cover ? 'image' : 'text', personal: true, visibility: form.querySelector('#libraryBookVisibility').value };
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
        return ['core_v4_custom_words_'+userId()+'_'+id,'core_v4_cache_'+id,'core_v4_user_vocab_book_'+userId()+'_'+id,window.__manualVocabLocalKey(id),progress,progress+'__ts','aiglish_learning_recovery_'+userId()+'_'+id];
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
    async function eraseBook(id,book,kind) {
        kind=kind||'book';
        var uid=userId();
        if(window.LibraryState){await window.LibraryState.mark(kind,id,book,uid);window.LibraryState.cleanLocal(uid);await window.LibraryState.waitForWrites(uid);}

        var localSaves=[];
        for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k.startsWith('save_studio_'+uid+'_'))localSaves.push([k,JSON.stringify(scrubSave(JSON.parse(localStorage.getItem(k)),id,kind,uid))]);}
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
                    var clean=JSON.stringify(scrubSave(JSON.parse(raw),id,kind,uid));var generation='delete_'+crypto.randomUUID(),chunks=[];
                    for(var offset=0;offset<clean.length;offset+=280000)chunks.push(clean.slice(offset,offset+280000));
                    for(var p=0;p<chunks.length;p++)await window.fbSetDoc(window.fbDoc(window.db,'users',uid,'saves',doc.id,'parts',generation+'_p'+p),{d:chunks[p]},{merge:false});
                    await window.fbSetDoc(window.fbDoc(window.db,'users',uid,'saves',doc.id),Object.assign({},meta,{generation:generation,partCount:chunks.length,rawLength:clean.length,checksum:window.__gameSaveChecksum(clean)}),{merge:false});
                    for(var old of parts)await window.fbDeleteDoc(window.fbDoc(window.db,'users',uid,'saves',doc.id,'parts',old.id));
                }else if(meta.data){await window.fbSetDoc(window.fbDoc(window.db,'users',uid,'saves',doc.id),scrubSave(meta,id,kind,uid),{merge:false});}
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
    var retrying=false;
    async function retryPendingDeletions(){
        if(retrying||!window.LibraryState)return;retrying=true;
        try{var owner=userId();await window.LibraryState.loadCloud(owner);if(userId()!==owner)return;for(var item of Object.values(window.LibraryState.read(owner))){if(userId()!==owner)return;if(item.pending)await eraseBook(item.id,item.metadata,item.kind);}window.LibraryState.cleanLocal(owner);}
        catch(e){console.warn('削除の同期は接続後に再試行します',e);}
        finally{retrying=false;}
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
    window.addEventListener('online',retryPendingDeletions);
    window.onAppLoaded(retryPendingDeletions);
    window.openLibraryBookActions = function(bookId) {
        var actionUserId = userId();
        var book = textbooksPool.find(function(item) { return item.id === bookId; }) || readLibrary().books.find(function(item) { return item.id === bookId; });
        if (!book) return;
        var own = window.isPersonalTextbook(bookId);
        var modal = open(book.name, '<div class="library-editor-actions library-editor-actions-stack">' +
            (own ? '<button type="button" id="libraryEditBook">名前・表紙を編集 / 単語を追加</button>' : '') +
            (readLibrary().hidden.indexOf(bookId) >= 0 ? '<button type="button" id="libraryRestoreBook">一覧に戻す</button>' : '') +
            '<button type="button" id="libraryRemoveBook" class="library-editor-danger">' + '自分の一覧から外す' + '</button>' + '<button type="button" id="libraryEraseBook" class="library-editor-danger">' + (own ? '単語帳を完全削除' : '自分の単語帳データを完全削除') + '</button>' + '<button type="button" data-library-close>閉じる</button></div>');
        if (own) modal.querySelector('#libraryEditBook').onclick = function() { window.openLibraryBookEditor(bookId); };
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
        var modal = open('非表示の自分の単語帳', '<div id="libraryHiddenBooks"></div><div class="library-editor-actions"><button type="button" data-library-close>閉じる</button></div>');
        var list = modal.querySelector('#libraryHiddenBooks');
        data.books.filter(function(book) { return data.hidden.indexOf(book.id) >= 0; }).forEach(function(book) {
            var row = document.createElement('div'); row.className = 'library-catalog-item';
            var name = document.createElement('div'); name.textContent = book.name;
            var manage = document.createElement('button'); manage.type = 'button'; manage.textContent = '管理';
            manage.onclick = function() { window.openLibraryBookActions(book.id); };
            row.append(name, manage); list.append(row);
        });
        if (!list.children.length) list.textContent = '非表示の自分の単語帳はありません。';
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
                            return {num:index+1,word:word.word,meaning:word.meaning,sub:typeof word.sub==='string'?word.sub:'',meanings:(Array.isArray(word.meanings)&&word.meanings.length?word.meanings:[{text:word.meaning}]).map(function(meaning, i){return {id:(index+1)+'-'+i,text:String(meaning.text||''),partOfSpeech:String(meaning.partOfSpeech||meaning.pos||word.partOfSpeech||word.pos||'')};})};
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
    window.renderVocabLibrarySelection = function() { refreshPool(); var hidden = document.getElementById('libraryHiddenBooksButton'); if(hidden){var data=readLibrary();hidden.hidden=!data.books.some(function(book){return data.hidden.indexOf(book.id)>=0;});} return render.apply(this, arguments); };
    window.onAppLoaded(function() { refreshPool(); window.renderVocabLibrarySelection(); });
    window.renderVocabLibrarySelection();
})();
