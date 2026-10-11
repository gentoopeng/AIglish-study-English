// Vocabulary notes share by default when saved; the checkbox opts individual notes out.
(function () {
    'use strict';
    function owner() { return myId || 'GUEST-000'; }
    function available() { return !!(window.db && window.fbDoc && window.fbCollection && window.fbGetDocs && window.fbSetDoc); }
    function normalized(value) { return String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' '); }
    function identity(word) {
        // Copies of a textbook can have different book IDs and word numbers.
        // Match the word and its meanings, so unrelated senses stay separate.
        const meanings = (word.meanings && word.meanings.length ? word.meanings.map(m => m.text) : [word.meaning]).map(normalized).sort();
        return JSON.stringify([normalized(word.word).toLowerCase(), meanings]);
    }
    async function topicKey(word) {
        const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity(word)));
        return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
    }
    const noteCache=new Map(),pending=new Map();let cacheOwner='',directory=null,directoryTask=null,directoryAt=0;
    function accountCache(){if(cacheOwner!==owner()){cacheOwner=owner();noteCache.clear();pending.clear();directory=null;directoryTask=null;directoryAt=0;}}
    function deadline(task){let timer;return Promise.race([task,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('共有メモの通信が完了しませんでした。')),15000))]).finally(()=>clearTimeout(timer));}
    async function directoryRead(){
        if(directory&&Date.now()-directoryAt<300000)return directory;if(directoryTask)return directoryTask;
        const account=owner();const task=(async()=>{const result=new Map();let cursor;
            for(let page=0;page<20;page++){
                const parts=[window.fbOrderBy(window.fbDocumentId()),window.fbLimit(100)];if(cursor)parts.push(window.fbStartAfter(cursor));
                const snap=await deadline(window.fbGetDocs(window.fbQuery(window.fbCollectionGroup(window.db,'notes'),...parts)));
                const docs=snap.docs||[];for(const doc of docs){const path=doc.ref?.path||'',match=/^publicVocabNotes\/([^/]+)\/notes\/[^/]+$/.exec(path);if(!match)continue;const data=doc.data();if(typeof data?.note==='string'&&typeof data.ownerId==='string'&&data.note.trim()){if(!result.has(match[1]))result.set(match[1],[]);result.get(match[1]).push({...data,note:data.note.slice(0,500)});}}
                if(docs.length<100){if(owner()===account){directory=result;directoryAt=Date.now();}return result;}cursor=docs.at(-1);
            }throw Error('共有メモが多いため全件を確認できませんでした。');
        })();directoryTask=task;try{return await task;}finally{if(directoryTask===task)directoryTask=null;}
    }
    async function recordsFor(word){accountCache();const key=identity(word),cached=noteCache.get(key);if(cached&&Date.now()-cached.at<300000)return cached.records;if(pending.has(key))return pending.get(key);
        const account=owner(),task=(async()=>{let records=[];if(available()){
            const topic=await topicKey(word);
            if(window.fbCollectionGroup&&window.fbQuery&&window.fbOrderBy&&window.fbDocumentId&&window.fbLimit&&window.fbStartAfter)records=(await directoryRead()).get(topic)||[];
            else {const snap=await deadline(window.fbGetDocs(window.fbCollection(window.db,'publicVocabNotes',topic,'notes')));snap.forEach(doc=>{const data=doc.data();if(typeof data?.note==='string'&&typeof data.ownerId==='string'&&data.note.trim())records.push({...data,note:data.note.slice(0,500)});});}
        }if(owner()===account)noteCache.set(key,{at:Date.now(),records});return records;})();pending.set(key,task);try{return await task;}finally{if(pending.get(key)===task)pending.delete(key);}
    }
    window.SharedVocabNotes={invalidate:()=>{noteCache.clear();directory=null;directoryAt=0;},has:word=>{accountCache();return (noteCache.get(identity(word))?.records||[]).some(record=>record.ownerId!==owner());},ready:words=>{accountCache();return words.every(word=>{const item=noteCache.get(identity(word));return item&&Date.now()-item.at<300000;});},prepare:async words=>{let index=0;await Promise.all(Array.from({length:3},async()=>{while(index<words.length)await recordsFor(words[index++]);}));}};
    const authors=new Map();
    async function author(id){
        if(id===owner())return {name:myName||id,avatar:localStorage.getItem('core_v4_user_avatar_'+id)||''};
        const known=window.People?.preview?.(id);if(known)return {name:known.name||id,avatar:known.avatar||''};
        const existing=authors.get(id);if(existing&&Date.now()-existing.at<300000)return existing.task;
        const task=(async()=>{const project=window.db?.app?.options?.projectId;if(!project||window.FirestoreReadGuard?.paused())return {name:id,avatar:''};
            try{const url='https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(project)+'/databases/(default)/documents/users/'+encodeURIComponent(id)+'?mask.fieldPaths=avatar&mask.fieldPaths=playerName';const response=await deadline(fetch(url));if(!response.ok)throw Error('profile');const data=await response.json();return {name:data.fields?.playerName?.stringValue||id,avatar:data.fields?.avatar?.stringValue||''};}catch{return {name:id,avatar:''};}
        })();authors.set(id,{at:Date.now(),task});if(authors.size>50)authors.delete(authors.keys().next().value);return task;
    }
    function authorIcon(id){const icon=document.createElement('span');icon.className='vocab-note-author';icon.title=id;icon.textContent=String(id||'人').slice(0,1);icon.setAttribute('aria-label','メモの投稿者 '+id);
        author(id).then(profile=>{if(!icon.isConnected)return;icon.title=profile.name+' ('+id+')';icon.setAttribute('aria-label',profile.name+'のメモ');icon.textContent=String(profile.name).slice(0,1);if(typeof profile.avatar==='string'&&profile.avatar.length<=48000&&/^(https?:\/\/|data:image\/(png|jpeg|webp|gif);base64,)/i.test(profile.avatar)){const img=document.createElement('img');img.src=profile.avatar;img.alt=profile.name;img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();icon.replaceChildren(img);}});return icon;}
    window.attachSharedVocabNotes = function (section, word) {
        if (section.dataset.sharedNotesAttached) return;
        section.dataset.sharedNotesAttached = 'true';
        const editor = section.querySelector('.vocab-note-editor');
        const textarea = section.querySelector('.vocab-note-input');
        const actions = section.querySelector('.vocab-note-actions');
        const bookId = currentTextbook, openingOwner = owner();
        const original = vocabList.find(w => String(w.num) === String(word.num)) || word;
        const signature = window.buildWordSignature(original);
        const ownText=section.querySelector('.vocab-note-text');if(ownText){const ownRow=document.createElement('div');ownRow.className='vocab-own-note-row';ownText.before(ownRow);ownRow.append(ownText,authorIcon(openingOwner));}
        const area = document.createElement('div'); area.className = 'shared-vocab-notes';
        const heading = document.createElement('div'); heading.className = 'shared-vocab-notes-heading'; heading.textContent = 'ほかの人の共有メモ';
        const list = document.createElement('div'); list.className = 'shared-vocab-notes-list'; list.setAttribute('aria-live', 'polite');
        const message = document.createElement('p'); message.className = 'shared-vocab-notes-message'; message.setAttribute('role', 'status');
        area.append(heading, list, message); section.append(area);
        const preferenceKey = 'core_v4_vocab_note_sharing_' + openingOwner + '_' + encodeURIComponent(identity(original));
        function preference() { try { return JSON.parse(localStorage.getItem(preferenceKey) || 'null'); } catch (e) { return null; } }
        const savedPreference = preference();
        const label = document.createElement('label'); label.className = 'shared-vocab-note-sharing';
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.className = 'shared-vocab-note-checkbox'; checkbox.checked = !savedPreference || savedPreference.enabled !== false;
        label.append(checkbox, document.createTextNode('共有する')); actions.before(label);
        const save = section.querySelector('.vocab-note-save');
        let generation = 0, loaded = false, ownNote = !!(savedPreference && savedPreference.published), busy = false;
        function remember(enabled, published) { localStorage.setItem(preferenceKey, JSON.stringify({enabled, published, savedAt: new Date().toISOString()})); }
        function current() {
            const item = vocabList.find(w => String(w.num) === String(word.num));
            return section.isConnected && owner() === openingOwner && currentTextbook === bookId && item && window.buildWordSignature(item) === signature;
        }
        function buttons() { save.disabled = busy; checkbox.disabled = busy; save.textContent = busy ? '保存中…' : 'メモを保存'; }
        function noteRow(record) {
            const row = document.createElement('div'); row.className = 'shared-vocab-note-row';
            const text = document.createElement('span'); text.className = 'shared-vocab-note-preview'; text.textContent = record.note;
            const more = document.createElement('button'); more.type = 'button'; more.className = 'shared-vocab-note-more'; more.textContent = 'すべて表示'; more.hidden = true; more.setAttribute('aria-expanded', 'false');
            row.append(text,more,authorIcon(record.ownerId));
            more.onclick = event => {event.preventDefault(); event.stopPropagation(); const expanded = row.classList.toggle('is-expanded'); more.textContent = expanded ? '折りたたむ' : 'すべて表示'; more.setAttribute('aria-expanded', String(expanded)); if (!expanded) measure();};
            function measure() { if (row.isConnected && !row.classList.contains('is-expanded')) more.hidden = text.scrollWidth <= text.clientWidth; }
            if (typeof ResizeObserver !== 'undefined') {
                const observer = new ResizeObserver(() => {if (!row.isConnected) {observer.disconnect(); return;} measure();}); observer.observe(text);
            }
            requestAnimationFrame(measure);
            return row;
        }
        async function load() {
            if (!current() || busy) return;
            const request = ++generation; list.textContent = '読み込み中…'; message.textContent = '';
            try {
                if (!available()) throw new Error('共有メモに接続できません。接続後にメモを開き直してください。');
                const shared = await recordsFor(original);
                if (!current() || request !== generation) return;
                const records = []; ownNote = false;
                shared.forEach(data => {if(data.ownerId===openingOwner)ownNote=true;else records.push({ownerId:data.ownerId,note:data.note,updatedAt:String(data.updatedAt||'')});});
                records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); list.replaceChildren(); records.forEach(record => list.append(noteRow(record)));
                if (!records.length) list.textContent = '';
                loaded = true; buttons();
            } catch (error) {if (current() && request === generation) {list.textContent = ''; message.textContent = error.message; loaded = false;}}
        }
        section.addEventListener('vocab-note-open', () => { const latest = preference(); if (!busy) checkbox.checked = !latest || latest.enabled !== false; if (!loaded) load(); else requestAnimationFrame(() => list.querySelectorAll('.shared-vocab-note-preview').forEach(text => {const row = text.parentElement; if (!row.classList.contains('is-expanded')) row.querySelector('button').hidden = text.scrollWidth <= text.clientWidth;})); });
        async function write(event) {
            event.preventDefault(); event.stopPropagation(); if (busy) return;
            busy = true; ++generation; buttons(); message.textContent = '';
            let localSaved = false;
            const enabled = checkbox.checked;
            try {
                if (!current()) throw new Error('単語帳またはユーザーが切り替わりました。メモを開き直してください。');
                const note = textarea.value.trim().slice(0, 500);
                const remove = !enabled || !note;
                remember(enabled, ownNote);
                // Personal notes survive offline use and crashes even if sharing fails.
                window.saveVocabNote(event, word.num); localSaved = true;
                editor.style.display = 'block';
                if (openingOwner === 'GUEST-000') {
                    if (enabled && note) throw new Error('共有にはログインが必要です。メモはこの端末に保存しました。');
                    editor.style.display = 'none'; return;
                }
                if (!available() || (remove && !window.fbDeleteDoc)) throw new Error(remove ? '共有の取り消しを確認できません。接続後にもう一度保存してください。' : '共有先に接続できません。接続後にもう一度保存してください。');
                const topic = await topicKey(original);
                if (!current()) throw new Error('単語帳またはユーザーが切り替わりました。');
                const ref = window.fbDoc(window.db, 'publicVocabNotes', topic, 'notes', encodeURIComponent(openingOwner));
                if (remove) await window.fbDeleteDoc(ref);
                else await window.fbSetDoc(ref, {ownerId: openingOwner, note, updatedAt: new Date().toISOString()}, {merge: false});
                if (!current()) return;
                ownNote = !remove; remember(enabled, ownNote); loaded = false;noteCache.delete(identity(original));directory=null;directoryAt=0;
                editor.style.display = 'none';
            } catch (error) { if (section.isConnected) message.textContent = (localSaved && openingOwner !== 'GUEST-000' ? 'メモは端末に保存しました。' : '') + error.message; }
            finally {busy = false; buttons();}
        }
        save.onclick = write;
        requestAnimationFrame(function(){if(current()&&available())load();});

    };
    // Initial textbook rendering can finish before this deferred script executes.
    document.querySelectorAll('.vocab-note-section').forEach(section => {
        const button = section.querySelector('[id^="vocabNoteButton-"]');
        if (!button) return;
        const num = button.id.slice('vocabNoteButton-'.length);
        const word = vocabList.find(w => String(w.num) === num);
        if (word) window.attachSharedVocabNotes(section, word);
    });
    window.getSharedVocabNoteTopic = topicKey;
})();
