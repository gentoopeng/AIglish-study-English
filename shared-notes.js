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
    const noteCache=new Map(),pending=new Map(),presence=new Map(),presenceJobs=new Map();let cacheOwner='',cacheVersion=0;
    function accountCache(){if(cacheOwner!==owner()){cacheOwner=owner();cacheVersion++;noteCache.clear();pending.clear();presence.clear();presenceJobs.clear();}}
    function deadline(task){let timer;return Promise.race([task,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('共有メモの通信が完了しませんでした。')),15000))]).finally(()=>clearTimeout(timer));}
    async function presenceFor(word){accountCache();const key=identity(word),cached=presence.get(key);if(cached&&Date.now()-cached.at<300000)return cached.owners;if(presenceJobs.has(key))return presenceJobs.get(key);
        const account=owner(),version=cacheVersion,task=(async()=>{const owners=await window.SharedNoteIndex.owners(await topicKey(word));if(owner()===account&&version===cacheVersion)presence.set(key,{at:Date.now(),owners});return owners;})();presenceJobs.set(key,task);try{return await task;}finally{if(presenceJobs.get(key)===task)presenceJobs.delete(key);}
    }
    async function recordsFor(word){accountCache();const key=identity(word),cached=noteCache.get(key);if(cached&&Date.now()-cached.at<300000)return cached.records;if(pending.has(key))return pending.get(key);
        const account=owner(),version=cacheVersion,task=(async()=>{if(!available())throw Error('共有メモに接続できません。');const topic=await topicKey(word),snap=await deadline(window.fbGetDocs(window.fbCollection(window.db,'publicVocabNotes',topic,'notes'))),records=[];
            const append=doc=>{const data=doc.data();if(typeof data?.note==='string'&&typeof data.ownerId==='string'&&data.note.trim())records.push({...data,note:data.note.slice(0,500)});};if(snap.docs)snap.docs.forEach(append);else snap.forEach(append);
            if(owner()===account&&version===cacheVersion)noteCache.set(key,{at:Date.now(),records});return records;})();pending.set(key,task);try{return await task;}finally{if(pending.get(key)===task)pending.delete(key);}
    }
    window.SharedVocabNotes={invalidate:()=>{cacheVersion++;noteCache.clear();pending.clear();presence.clear();presenceJobs.clear();window.SharedNoteIndex?.invalidate();},has:word=>{accountCache();return (presence.get(identity(word))?.owners||[]).some(id=>id!==owner());},ready:words=>{accountCache();return words.every(word=>{const item=presence.get(identity(word));return item&&Date.now()-item.at<300000;});},prepare:async words=>{let index=0;await Promise.all(Array.from({length:3},async()=>{while(index<words.length)await presenceFor(words[index++]);}));}};
    const authors=new Map();
    async function author(id){
        if(id===owner())return {name:myName||id,avatar:localStorage.getItem('core_v4_user_avatar_'+id)||''};
        if(window.ProfileIdentityCache)return ProfileIdentityCache.get(id);
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
        const show=document.createElement('button');show.type='button';show.className='shared-vocab-note-open';show.textContent='共有メモあり';show.hidden=true;show.setAttribute('aria-expanded','false');heading.hidden=true;list.hidden=true;area.append(show,heading,list,message); section.append(area);
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
            let frame = 0;
            function measure() { if (row.isConnected && !row.classList.contains('is-expanded')) { const hidden = text.scrollWidth <= text.clientWidth; if (more.hidden !== hidden) more.hidden = hidden; } }
            function scheduleMeasure() { if (!frame) frame = requestAnimationFrame(() => {frame = 0; measure();}); }
            if (typeof ResizeObserver !== 'undefined') {
                const observer = new ResizeObserver(() => {if (!row.isConnected) {observer.disconnect(); cancelAnimationFrame(frame); return;} scheduleMeasure();}); observer.observe(text);
            }
            scheduleMeasure();
            return row;
        }
        async function load() {
            if (!current() || busy) return;
            const request = ++generation; heading.hidden=false;list.hidden=false;show.setAttribute('aria-expanded','true');list.textContent = '読み込み中…'; message.textContent = '';
            try {
                if (!available()) throw new Error('共有メモに接続できません。接続後にメモを開き直してください。');
                const known=presence.get(identity(original));
                const shared=known&&Date.now()-known.at<300000&&!known.owners.some(id=>id!==openingOwner)?[]:await recordsFor(original);
                if (!current() || request !== generation) return;
                const records = []; ownNote = !!known?.owners.includes(openingOwner);
                shared.forEach(data => {if(data.ownerId===openingOwner)ownNote=true;else records.push({ownerId:data.ownerId,note:data.note,updatedAt:String(data.updatedAt||'')});});
                records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); list.replaceChildren(); records.forEach(record => list.append(noteRow(record)));
                if (!records.length) list.textContent = '';
                loaded = true; buttons();
            } catch (error) {if (current() && request === generation) {list.textContent = ''; message.textContent = error.message; loaded = false;}}
        }
        show.onclick=event=>{event.preventDefault();event.stopPropagation();if(loaded&&show.getAttribute('aria-expanded')==='true'){window.toggleVocabNoteEditor({preventDefault(){},stopPropagation(){},currentTarget:show},word.num,true);return;}if(editor.style.display==='none'){window.toggleVocabNoteEditor({preventDefault(){},stopPropagation(){},currentTarget:show},word.num,false);}else if(!loaded)load();else{heading.hidden=false;list.hidden=false;show.setAttribute('aria-expanded','true');}};
        section.addEventListener('vocab-note-close',()=>{heading.hidden=true;list.hidden=true;show.setAttribute('aria-expanded','false');});
        section.addEventListener('vocab-note-open', () => { const latest = preference(); if (!busy) checkbox.checked = !latest || latest.enabled !== false; if (!loaded||Date.now()-(noteCache.get(identity(original))?.at||0)>=300000) load(); else {heading.hidden=false;list.hidden=false;show.setAttribute('aria-expanded','true');requestAnimationFrame(() => list.querySelectorAll('.shared-vocab-note-preview').forEach(text => {const row = text.parentElement; if (!row.classList.contains('is-expanded')) row.querySelector('button').hidden = text.scrollWidth <= text.clientWidth;}));} });
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
                if (!available() || !window.SharedNoteIndex) throw new Error(remove ? '共有の取り消しを確認できません。接続後にもう一度保存してください。' : '共有先に接続できません。接続後にもう一度保存してください。');
                const topic = await topicKey(original);
                if (!current()) throw new Error('単語帳またはユーザーが切り替わりました。');
                const published={ownerId:openingOwner,note,updatedAt:new Date().toISOString()};
                const indexed=await window.SharedNoteIndex.publish(topic,openingOwner,remove?'':note);
                if (!current()) return;
                ownNote = !remove; remember(enabled, ownNote); loaded = false;cacheVersion++;
                const key=identity(original),cached=noteCache.get(key);
                if(cached){const next=cached.records.filter(record=>record.ownerId!==openingOwner);if(!remove)next.push(published);noteCache.set(key,{at:cached.at,records:next});}
                presence.set(key,{at:Date.now(),owners:Object.entries(indexed.entries[topic]||{}).filter(([,stamp])=>stamp>0).map(([id])=>id)});
                show.hidden=!window.SharedVocabNotes.has(original);heading.hidden=true;list.hidden=true;show.setAttribute('aria-expanded','false');
                editor.style.display = 'none';
            } catch (error) { if (section.isConnected) message.textContent = (localSaved && openingOwner !== 'GUEST-000' ? 'メモは端末に保存しました。' : '') + error.message; }
            finally {busy = false; buttons();}
        }
        save.onclick = write;
        requestAnimationFrame(async function(){if(!current()||!available())return;try{const ids=await presenceFor(original);if(!current())return;ownNote=ids.includes(openingOwner);show.hidden=!ids.some(id=>id!==openingOwner);}catch(error){if(current()){show.hidden=false;show.textContent='共有メモを確認';show.title=error.message;}}});

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
