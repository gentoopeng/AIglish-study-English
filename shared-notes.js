// Vocabulary notes are private until the user explicitly chooses to share one.
(function () {
    'use strict';
    function owner() { return myId || 'GUEST-000'; }
    function available() { return !!(window.db && window.fbDoc && window.fbCollection && window.fbGetDocs && window.fbSetDoc); }
    function normalized(value) { return String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' '); }
    async function topicKey(word) {
        // Copies of a textbook can have different book IDs and word numbers.
        // Match the word and its meanings, so unrelated senses stay separate.
        const meanings = (word.meanings && word.meanings.length ? word.meanings.map(m => m.text) : [word.meaning]).map(normalized).sort();
        const identity = JSON.stringify([normalized(word.word).toLowerCase(), meanings]);
        const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
        return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
    }
    window.attachSharedVocabNotes = function (section, word) {
        if (section.dataset.sharedNotesAttached) return;
        section.dataset.sharedNotesAttached = 'true';
        const editor = section.querySelector('.vocab-note-editor');
        const textarea = section.querySelector('.vocab-note-input');
        const actions = section.querySelector('.vocab-note-actions');
        const bookId = currentTextbook, openingOwner = owner();
        const original = vocabList.find(w => String(w.num) === String(word.num)) || word;
        const signature = window.buildWordSignature(original);
        const area = document.createElement('div'); area.className = 'shared-vocab-notes';
        const heading = document.createElement('div'); heading.className = 'shared-vocab-notes-heading'; heading.textContent = 'ほかの人の共有メモ';
        const list = document.createElement('div'); list.className = 'shared-vocab-notes-list'; list.setAttribute('aria-live', 'polite');
        const message = document.createElement('p'); message.className = 'shared-vocab-notes-message'; message.setAttribute('role', 'status');
        area.append(heading, list, message); textarea.after(area);
        const share = document.createElement('button'); share.type = 'button'; share.className = 'list-action-link shared-vocab-note-share'; share.textContent = '共有する';
        const unshare = document.createElement('button'); unshare.type = 'button'; unshare.className = 'list-action-link shared-vocab-note-unshare'; unshare.textContent = '共有を取り消す'; unshare.hidden = true;
        actions.prepend(share, unshare);
        const hint = document.createElement('p'); hint.className = 'shared-vocab-notes-hint'; hint.textContent = '「共有する」を押したメモだけ公開されます。'; actions.before(hint);
        let generation = 0, loaded = false, ownNote = false, busy = false;
        function current() {
            const item = vocabList.find(w => String(w.num) === String(word.num));
            return section.isConnected && owner() === openingOwner && currentTextbook === bookId && item && window.buildWordSignature(item) === signature;
        }
        function buttons() { share.textContent = ownNote ? '共有を更新' : '共有する'; unshare.hidden = !ownNote; share.disabled = busy; unshare.disabled = busy; }
        function noteRow(record) {
            const row = document.createElement('div'); row.className = 'shared-vocab-note-row';
            const text = document.createElement('span'); text.className = 'shared-vocab-note-preview'; text.textContent = record.note;
            const more = document.createElement('button'); more.type = 'button'; more.className = 'shared-vocab-note-more'; more.textContent = 'すべて表示'; more.hidden = true; more.setAttribute('aria-expanded', 'false');
            row.append(text, more);
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
                const topic = await topicKey(original);
                const snapshot = await window.fbGetDocs(window.fbCollection(window.db, 'publicVocabNotes', topic, 'notes'));
                if (!current() || request !== generation) return;
                const records = []; ownNote = false;
                snapshot.forEach(doc => { const data = doc.data(); if (!data || typeof data.ownerId !== 'string' || typeof data.note !== 'string' || !data.note.trim()) return; if (data.ownerId === openingOwner) ownNote = true; else records.push({note: data.note.slice(0, 500), updatedAt: String(data.updatedAt || '')}); });
                records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); list.replaceChildren(); records.forEach(record => list.append(noteRow(record)));
                if (!records.length) list.textContent = '共有メモはまだありません。';
                loaded = true; buttons();
            } catch (error) {if (current() && request === generation) {list.textContent = ''; message.textContent = error.message; loaded = false;}}
        }
        section.addEventListener('vocab-note-open', () => { if (!loaded) load(); else requestAnimationFrame(() => list.querySelectorAll('.shared-vocab-note-preview').forEach(text => {const row = text.parentElement; if (!row.classList.contains('is-expanded')) row.querySelector('button').hidden = text.scrollWidth <= text.clientWidth;})); });
        async function write(remove, event) {
            event.preventDefault(); event.stopPropagation(); if (busy) return;
            busy = true; ++generation; buttons(); message.textContent = '';
            try {
                if (!current()) throw new Error('単語帳またはユーザーが切り替わりました。メモを開き直してください。');
                if (openingOwner === 'GUEST-000') throw new Error('メモを共有するにはログインしてください。');
                if (!available() || (remove && !window.fbDeleteDoc)) throw new Error('共有先に接続できません。接続後にお試しください。');
                const note = textarea.value.trim().slice(0, 500);
                if (!remove && !note) throw new Error('共有するメモを入力してください。');
                const topic = await topicKey(original);
                if (!current()) throw new Error('単語帳またはユーザーが切り替わりました。');
                const ref = window.fbDoc(window.db, 'publicVocabNotes', topic, 'notes', encodeURIComponent(openingOwner));
                if (remove) await window.fbDeleteDoc(ref);
                else await window.fbSetDoc(ref, {ownerId: openingOwner, note, updatedAt: new Date().toISOString()}, {merge: false});
                if (!current()) return;
                if (!remove) {window.saveVocabNote(event, word.num); editor.style.display = 'block';}
                ownNote = !remove; message.textContent = remove ? '共有を取り消しました。自分のメモは残ります。' : '共有しました。'; loaded = false;
            } catch (error) { if (section.isConnected) message.textContent = error.message; }
            finally {busy = false; buttons();}
        }
        share.onclick = event => write(false, event); unshare.onclick = event => write(true, event);
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
