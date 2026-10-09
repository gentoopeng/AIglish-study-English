// Deletions survive old saves, delayed responses and another device's snapshots.
(function () {
    'use strict';
    const storageKey = owner => 'core_v4_library_deletions_' + owner;
    const currentUser = () => typeof myId !== 'undefined' && myId ? myId : 'GUEST-000';
    function read(owner = currentUser()) {
        try { return JSON.parse(localStorage.getItem(storageKey(owner)) || '{}'); } catch (e) { return {}; }
    }
    function merge(left, right) {
        const result = Object.assign({}, left);
        Object.entries(right || {}).forEach(([key, item]) => {
            if (!item || !['book', 'work'].includes(item.kind) || typeof item.id !== 'string') return;
            if (!result[key] || (Number(item.updatedAt) || 0) > (Number(result[key].updatedAt) || 0)) result[key] = item;
        });
        return result;
    }
    function isDeleted(kind, id, owner = currentUser()) { return !!read(owner)[kind + ':' + id]; }
    function cloudReady() { return !!(window.db && window.fbDoc && window.fbSetDoc && window.fbCollection && window.fbGetDocs); }
    async function mark(kind, id, metadata, owner = currentUser()) {
        const existing = read(owner)[kind + ':' + id];
        const item = existing || {kind, id, metadata:{id,personal:!!(metadata&&metadata.personal),visibility:metadata&&metadata.visibility||'private'}, deletedAt:Date.now(), updatedAt:Date.now(), pending:true};
        // Record intent before the network; an interrupted request cannot resurrect contents.
        localStorage.setItem(storageKey(owner), JSON.stringify(merge(read(owner), {[kind + ':' + id]:item})));
        if (owner !== 'GUEST-000' && cloudReady()) {
            try {await window.fbSetDoc(window.fbDoc(window.db, 'users', owner, 'libraryDeletions', encodeURIComponent(kind + ':' + id)), item, {merge:false});}
            catch(error){console.warn('削除の記録は接続後に再送します',error);}
        }
        return item;
    }
    async function complete(kind, id, owner = currentUser()) {
        const item = Object.assign({}, read(owner)[kind + ':' + id], {pending:false, updatedAt:Math.max(Date.now(), (Number((read(owner)[kind + ':' + id] || {}).updatedAt) || 0) + 1)});
        if (owner !== 'GUEST-000') await window.fbSetDoc(window.fbDoc(window.db, 'users', owner, 'libraryDeletions', encodeURIComponent(kind + ':' + id)), item, {merge:false});
        localStorage.setItem(storageKey(owner), JSON.stringify(merge(read(owner), {[kind + ':' + id]:item})));
    }
    async function loadCloud(owner = currentUser()) {
        if (owner === 'GUEST-000' || !cloudReady()) return;
        const snapshot = await window.fbGetDocs(window.fbCollection(window.db, 'users', owner, 'libraryDeletions'));
        const remote = {};
        snapshot.forEach(doc => {const item = doc.data(); if(item && item.id && item.kind) remote[item.kind + ':' + item.id] = item;});
        localStorage.setItem(storageKey(owner), JSON.stringify(merge(read(owner), remote)));
    }
    function bookKeys(owner, id) {
        return ['core_v4_custom_words_' + owner + '_' + id, 'core_v4_cache_' + id, 'core_v4_user_vocab_book_' + owner + '_' + id,
            'core_v4_vocab_draft_' + owner + '_' + encodeURIComponent(id), 'core_v4_user_vocab_progress_' + owner + '_' + id,
            'core_v4_user_vocab_progress_' + owner + '_' + id + '__ts'];
    }
    function mergeCatalog(left,right,owner=currentUser()) {
        left=left||{books:[],hidden:[]};right=right||{books:[],hidden:[]};
        const books=new Map(),visibility={};
        [left,right].forEach(list=>{
            (list.books||[]).forEach(book=>{const old=books.get(book.id);if(!old||(Date.parse(book.updatedAt||list.savedAt||'')||0)>=(Date.parse(old.updatedAt||'')||0))books.set(book.id,Object.assign({},book,{updatedAt:book.updatedAt||list.savedAt}));});
            const states=Object.assign({},list.visibility||{});
            (list.hidden||[]).forEach(id=>{if(!states[id])states[id]={hidden:true,updatedAt:Date.parse(list.savedAt||'')||0,legacy:true};});
            Object.entries(states).forEach(([id,state])=>{const old=visibility[id];if(!old||(old.legacy&&!state.legacy)||(!!old.legacy===!!state.legacy&&(Number(state.updatedAt)>Number(old.updatedAt)||(Number(state.updatedAt)===Number(old.updatedAt)&&state.hidden))))visibility[id]=state;});
        });
        const latest=(Date.parse(left.savedAt||'')||0)>=(Date.parse(right.savedAt||'')||0)?left:right;
        return {books:Array.from(books.values()).filter(book=>!isDeleted('book',book.id,owner)),visibility,hidden:Object.keys(visibility).filter(id=>visibility[id].hidden),savedAt:latest.savedAt||''};
    }
    function sanitizeSave(save, owner = currentUser()) {
        const data = save.data || save, storage = data.localStorage || {}, memory = data.memory || {};
        // Always merge the immutable deletion history before restoring any contents.
        let registry = read(owner);
        if (storage[storageKey(owner)]) {try {registry = merge(registry, JSON.parse(storage[storageKey(owner)]));} catch (e) {}}
        const ownedKey='core_v4_profile_shop_owned_'+owner;
        if(storage[ownedKey]){try{storage[ownedKey]=JSON.stringify(Array.from(new Set([...JSON.parse(localStorage.getItem(ownedKey)||'[]'),...JSON.parse(storage[ownedKey])])));}catch(e){}}
        const profileKey='core_v4_profile_customization_'+owner;
        if(storage[profileKey]&&window.UserProfileModel)storage[profileKey]=JSON.stringify(window.UserProfileModel.merge(localStorage.getItem(profileKey),storage[profileKey]));
        const libraryKey='core_v4_personal_library_'+owner;
        if(storage[libraryKey])storage[libraryKey]=JSON.stringify(mergeCatalog(JSON.parse(storage[libraryKey]),JSON.parse(localStorage.getItem(libraryKey)||'null'),owner));
        Object.values(registry).forEach(item => {
            const id = item.id;
            if (item.kind === 'work') {
                const key = 'vv4_works_' + owner;
                if (storage[key]) {const works = JSON.parse(storage[key]);storage[key] = JSON.stringify(works.filter(work => work.id !== id));}
                if (Array.isArray(memory.workbooks)) memory.workbooks = memory.workbooks.filter(work => work.id !== id);
                return;
            }
            bookKeys(owner, id).forEach(key => delete storage[key]);
            const key = 'core_v4_personal_library_' + owner;
            if (storage[key]) {const library = JSON.parse(storage[key]);library.books = library.books.filter(book => book.id !== id);library.hidden = Array.from(new Set((library.hidden || []).concat(id)));storage[key] = JSON.stringify(library);}
            if (memory.vocabBooks) delete memory.vocabBooks[id];
            if (Array.isArray(memory.textbooksPool)) memory.textbooksPool = memory.textbooksPool.filter(book => book.id !== id);
            if (memory.vocabBookKey === id || memory.currentTextbook === id) {memory.vocabBookKey = '';memory.currentTextbook = '';memory.vocabList = [];delete memory.vocabMaster;delete memory.vocabProgress;memory.vocabBookDeleted = true;}
            if (storage.core_v4_current_textbook_id === id) storage.core_v4_current_textbook_id = '';
        });
        if (Object.keys(registry).length) storage[storageKey(owner)] = JSON.stringify(registry);
        return save;
    }
    function cleanLocal(owner = currentUser()) {
        if(!Object.keys(read(owner)).length)return;
        const storage = {};
        for (let i = 0; i < localStorage.length; i++) {const key = localStorage.key(i);storage[key] = localStorage.getItem(key);}
        const originalKeys = Object.keys(storage);sanitizeSave({localStorage:storage}, owner);
        originalKeys.forEach(key => {if (!(key in storage)) localStorage.removeItem(key);});
        Object.entries(storage).forEach(([key, value]) => {if (key.startsWith('save_studio_' + owner + '_')) {value = JSON.stringify(sanitizeSave(JSON.parse(value), owner));}if(localStorage.getItem(key)!==value)localStorage.setItem(key, value);});
    }
    const writes = new Map();
    function track(owner, task) {
        const pending = writes.get(owner) || new Set();writes.set(owner, pending);
        const promise = Promise.resolve().then(task);pending.add(promise);
        promise.then(() => pending.delete(promise), () => pending.delete(promise));return promise;
    }
    async function waitForWrites(owner) {const pending = writes.get(owner);if (pending) await Promise.allSettled(Array.from(pending));}
    window.LibraryState = {storageKey, read, merge, mergeCatalog, isDeleted, mark, complete, loadCloud, bookKeys, sanitizeSave, cleanLocal, track, waitForWrites};
})();
