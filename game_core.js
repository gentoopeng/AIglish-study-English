// ================================================================
// game_core.js —— フラッシュカード関連ロジック
// 読み込み順: app.js → game_core.js
// ================================================================
(function() {
    "use strict";

    // Prefer the selected meaning's grammatical label; words can have different parts of speech per sense.
    window.getFlashcardPartOfSpeech = function(word, meaning) {
        var labels = [
            {short:'名',name:'名詞',aliases:['名詞','noun','n']},
            {short:'動',name:'動詞',aliases:['動詞','自動詞','他動詞','verb','v','vi','vt','自','他']},
            {short:'形',name:'形容詞',aliases:['形容詞','adjective','adj']},
            {short:'形動',name:'形容動詞',aliases:['形容動詞']},
            {short:'助詞',name:'助詞',aliases:['助詞','particle']},
            {short:'連',name:'連体詞',aliases:['連体詞']},
            {short:'副',name:'副詞',aliases:['副詞','adverb','adv']},
            {short:'前',name:'前置詞',aliases:['前置詞','preposition','prep']},
            {short:'接',name:'接続詞',aliases:['接続詞','conjunction','conj']},
            {short:'代',name:'代名詞',aliases:['代名詞','pronoun','pron']},
            {short:'冠',name:'冠詞',aliases:['冠詞','article','art']},
            {short:'助',name:'助動詞',aliases:['助動詞','auxiliary','aux']},
            {short:'間',name:'間投詞',aliases:['間投詞','感嘆詞','interjection','interj']}
        ];
        function detect(text, metadata) {
            var value=String(text||'').trim().toLowerCase();
            return labels.filter(function(label) {
                return [label.short].concat(label.aliases).some(function(alias) {
                    if(metadata && value.split(/[\s,、・/|]+/).some(function(part){return part.replace(/\.$/,'')===alias;}))return true;
                    return false;
                });
            });
        }
        var candidates=[{text:meaning&&meaning.partOfSpeech||meaning&&meaning.pos,meta:true},{text:word&&word.partOfSpeech||word&&word.pos,meta:true},];
        for(var i=0;i<candidates.length;i++){var found=detect(candidates[i].text,candidates[i].meta);if(found.length)return {short:found.map(function(label){return label.short;}).join('・'),name:found.map(function(label){return label.name;}).join('・')};}
        return null;
    };

    // ================================================================
    // 1. フラッシュカード関連
    // ================================================================

    window.updateFlashcardSourceSelectOptions = function() {
        var select = document.getElementById('flashcardSourceSelect');
        if (!select) return;
        select.innerHTML = "";
        if (typeof textbooksPool === 'undefined' || !textbooksPool || textbooksPool.length === 0) {
            select.innerHTML = "<option value=''>配信中の教材なし</option>";
            return;
        }
        textbooksPool.forEach(function(book) {
            var opt = document.createElement('option');
            opt.value = book.id;
            opt.innerText = book.name;
            if (book.id === currentTextbook) opt.selected = true;
            select.appendChild(opt);
        });
    };

    window.showFlashcardSetupScreen = function() {
        var lbArea = document.getElementById('gameLeaderboardArea');
        if (lbArea) lbArea.style.display = 'none';
        document.getElementById('flashcard-setup-screen').style.display = 'block';
        window.updateFlashcardSourceSelectOptions();
        window.setFlashcardDirection('en2ja');
        window.resetFlashcardStatusFilters();
        window.applyVocabMaxRange();
    };

    var flashcardSelectedStatuses = { ok: true, so: true, bad: true, none: true };

    var bookSettingsDialog = null;
    var settingsHome = null;
    var settingsNext = null;
    var settingsOpener = null;
    var startingBookSettings = false;

    window.openBookFlashcardSettings = function(bookId) {
        if (bookSettingsDialog) return;
        var book = textbooksPool.find(function(item) { return item.id === bookId; });
        if (!book) return;
        var settings = document.getElementById('flashcard-setup-screen');
        settingsHome = settings.parentNode;
        settingsNext = settings.nextSibling;
        settingsOpener = document.activeElement;
        var dialog = document.createElement('dialog');
        dialog.className = 'book-flashcard-dialog';
        dialog.setAttribute('aria-label', book.name + 'のフラッシュ単語設定');
        var title = document.createElement('h2');
        title.textContent = book.name;
        dialog.append(title, settings);
        document.body.appendChild(dialog);
        bookSettingsDialog = dialog;
        window.updateFlashcardSourceSelectOptions();
        document.getElementById('flashcardSourceSelect').value = bookId;
        window.setFlashcardDirection('en2ja');
        window.resetFlashcardStatusFilters();
        var words = typeof textbooksCacheMap !== 'undefined' && textbooksCacheMap[bookId];
        if (!words) {
            try { words = JSON.parse(localStorage.getItem('core_v4_cache_' + bookId) || '[]'); } catch (e) { words = []; }
        }
        var nums = (words || []).map(function(word) { return window.VocabOrder ? window.VocabOrder.no(word) : Number(word.num); }).filter(Number.isFinite);
        // Units of this book, if any, can narrow the cards to one unit.
        var unitSelect = document.getElementById('flashcardUnitSelect'), unitField = document.getElementById('flashcardUnitField');
        if (unitSelect && unitField && window.VocabOrder) {
            var units = window.VocabOrder.units(words || []);
            unitSelect.replaceChildren(new Option('すべての単元', ''));
            units.forEach(function(unit) { unitSelect.append(new Option(unit.name + '（#' + unit.from + '–' + unit.to + '・' + unit.count + '語）', unit.name)); });
            unitSelect.value = '';
            unitField.hidden = !units.length;
        }
        document.getElementById('flashcardRangeStart').value = nums.length ? Math.min.apply(null, nums) : 1;
        document.getElementById('flashcardRangeEnd').value = nums.length ? Math.max.apply(null, nums) : 100;
        settings.style.display = 'block';
        dialog.addEventListener('cancel', function(event) { event.preventDefault(); closeBookSettings(); });
        dialog.addEventListener('click', function(event) { if (event.target === dialog) closeBookSettings(); });
        dialog.showModal();
    };

    function closeBookSettings() {
        if (!bookSettingsDialog) return;
        var settings = document.getElementById('flashcard-setup-screen');
        settingsHome.insertBefore(settings, settingsNext);
        settings.style.display = 'none';
        bookSettingsDialog.close();
        bookSettingsDialog.remove();
        bookSettingsDialog = null;
        if (settingsOpener && settingsOpener.isConnected) settingsOpener.focus();
    }

    window.closeBookFlashcardSettings = closeBookSettings;

    window.startFlashcardFromSettings = async function() {
        if (startingBookSettings) return;
        var start = Number(document.getElementById('flashcardRangeStart').value);
        var end = Number(document.getElementById('flashcardRangeEnd').value);
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
            alert('出題範囲は1以上の整数で、開始番号以下にならない終了番号を指定してください。');
            return;
        }
        if (!Object.keys(flashcardSelectedStatuses).some(function(key) { return flashcardSelectedStatuses[key]; })) {
            alert('出題する理解度を1つ以上選択してください。');
            return;
        }
        if (bookSettingsDialog) {
            var activeDialog = bookSettingsDialog;
            var selectedBook = document.getElementById('flashcardSourceSelect').value;
            startingBookSettings = true;
            try {
                if(await window.selectVocabLibraryBook(selectedBook)===false)return;
            } finally {
                startingBookSettings = false;
            }
            // 教材ロードによる範囲の初期化後も、ポップアップで選んだ値を使う。
            document.getElementById('flashcardRangeStart').value = start;
            document.getElementById('flashcardRangeEnd').value = end;
            if (bookSettingsDialog !== activeDialog) return;
            closeBookSettings();
            window.switchTab('game');
        }
        await window.startFlashcardSession();
    };

    function updateFlashcardStatusFilterUi() {
        var labels = { ok: '○', so: '△', bad: '×', none: 'ー' };
        var selected = [];
        document.querySelectorAll('.flashcard-status-filter').forEach(function(button) {
            var enabled = !!flashcardSelectedStatuses[button.dataset.status];
            button.classList.toggle('active', enabled);
            button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
            if (enabled) selected.push(labels[button.dataset.status]);
        });
        var summary = document.getElementById('flashcardStatusFilterSummary');
        if (summary) summary.textContent = selected.length === 4 ? 'すべての理解度を出題' : selected.length ? selected.join('・') + 'のみ出題' : '理解度を1つ以上選択してください';
    }

    window.resetFlashcardStatusFilters = function() {
        flashcardSelectedStatuses = { ok: true, so: true, bad: true, none: true };
        updateFlashcardStatusFilterUi();
    };

    window.toggleFlashcardStatusFilter = function(status) {
        if (!Object.prototype.hasOwnProperty.call(flashcardSelectedStatuses, status)) return;
        flashcardSelectedStatuses[status] = !flashcardSelectedStatuses[status];
        updateFlashcardStatusFilterUi();
    };

    function getFlashcardMeaningStatus(meaning, word) {
        if (meaning && meaning.status) return meaning.status;
        if (word && (!word.meanings || !word.meanings.length) && word.status) return word.status;
        return 'none';
    }

    window.setFlashcardDirection = function(mode) {
        flashcardDirectionMode = mode;
        var btnEn = document.getElementById('btnCardEn2Ja');
        var btnJa = document.getElementById('btnCardJa2en');
        if (btnEn) btnEn.classList.toggle('active', mode === 'en2ja');
        if (btnJa) btnJa.classList.toggle('active', mode === 'ja2en');
    };

    window.backToGameMenuFromCardSetup = function() {
        if (bookSettingsDialog) { closeBookSettings(); return; }
        document.getElementById('flashcard-setup-screen').style.display = 'none';
        var lbArea = document.getElementById('gameLeaderboardArea');
        if (lbArea) lbArea.style.display = 'flex';
    };

    window.startFlashcardSession = async function() {
        var startNum = parseInt(document.getElementById('flashcardRangeStart').value) || 1;
        var endNum = parseInt(document.getElementById('flashcardRangeEnd').value) || 100;
        var sourceSelector = document.getElementById('flashcardSourceSelect');
        if (sourceSelector) flashcardDataSourceMode = sourceSelector.value;

        var pool = [];
        var unitField = document.getElementById('flashcardUnitField'), unitSelect = document.getElementById('flashcardUnitSelect');
        var unit = unitField && !unitField.hidden && unitSelect ? unitSelect.value : '';
        if (typeof vocabList !== 'undefined') {
            vocabList.forEach(function(w) {
                var n = window.VocabOrder ? window.VocabOrder.no(w) : parseInt(w.num);
                if (n < startNum || n > endNum) return;
                if (unit && !(w.unit && window.VocabOrder.cleanUnit(w.unit) === unit)) return;
                var meanings = w.meanings && w.meanings.length ? w.meanings : [{ id: null, text: w.meaning, status: w.status || 'none', history: w.history || [] }];
                meanings.forEach(function(meaning, meaningIndex) {
                    var meaningStatus = getFlashcardMeaningStatus(meaning, w);
                    if (!flashcardSelectedStatuses[meaningStatus]) return;
                    pool.push({
                        num: w.num,
                        shownNo: window.VocabOrder ? window.VocabOrder.no(w) : w.num,
                        en: w.word,
                        ja: meaning.text || w.meaning || '',
                        meaningId: meaning.id !== undefined && meaning.id !== null ? String(meaning.id) : null,
                        meaningIndex: meaningIndex,
                        partOfSpeech: window.getFlashcardPartOfSpeech(w,meaning)
                    });
                });
            });
        }

        if (pool.length === 0) {
            alert("指定した番号と理解度に該当する単語がありません。");
            return;
        }

        flashcardOriginQueue = pool.slice().sort(function() { return Math.random() - 0.5; });
        flashcardCurrentIndex = 0;
        flashcardLearnedCount = 0;
        flashcardSessionHistory = [];
        window.FlashCheckpoint?.begin();

        document.getElementById('flashcard-setup-screen').style.display = 'none';
        document.getElementById('flashcard-play-screen').style.display = 'flex';
        document.body.classList.add('in-game-active');

        // エッジリップル要素を確保
        ['fcEdgeRippleRight', 'fcEdgeRippleLeft', 'fcEdgeRippleTop'].forEach(function(id) {
            if (!document.getElementById(id)) {
                var el = document.createElement('div');
                el.id = id;
                el.className = 'flashcard-edge-ripple edge-' + id.replace('fcEdgeRipple', '').toLowerCase();
                document.body.appendChild(el);
            }
        });

        window.renderFlashcardDeck();
    };

    window.renderFlashcardHistoryBubbles = function(wordData) {
        var container = document.getElementById('fcHistoryContainer');
        if (!container) return;
        container.innerHTML = "";
        var cleanKey = String(wordData.en || '').toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]\"']/g, "");
        var vocabMatch = null;
        if (typeof vocabList !== 'undefined') {
            vocabMatch = vocabList.find(function(v) { return v.word.toLowerCase() === cleanKey; });
        }
        var targetHistory = [];
        if (vocabMatch) {
            var targetMeaning = null;
            if (vocabMatch.meanings && vocabMatch.meanings.length) {
                if (wordData.meaningId !== null && wordData.meaningId !== undefined) {
                    targetMeaning = vocabMatch.meanings.find(function(meaning) { return String(meaning.id) === String(wordData.meaningId); });
                }
                if (!targetMeaning) targetMeaning = vocabMatch.meanings[wordData.meaningIndex || 0];
            }
            if (targetMeaning && targetMeaning.history && targetMeaning.history.length > 0) targetHistory = targetHistory.concat(targetMeaning.history);
            else if (targetMeaning && targetMeaning.status && targetMeaning.status !== 'none') targetHistory.push(targetMeaning.status);
            else if ((!vocabMatch.meanings || !vocabMatch.meanings.length) && vocabMatch.history && vocabMatch.history.length > 0) targetHistory = targetHistory.concat(vocabMatch.history);
        } else {
            var memStatus = (typeof wordMemory !== 'undefined') ? wordMemory[cleanKey] : null;
            if (memStatus && memStatus !== 'none') targetHistory.push(memStatus);
        }
        var displayList = targetHistory.slice(-5);
        while (displayList.length < 5) displayList.unshift('none');
        displayList.forEach(function(status) {
            var bubble = document.createElement('div');
            bubble.className = "fc-history-bubble";
            if (status !== 'none') bubble.classList.add(status);
            container.appendChild(bubble);
        });
    };

    function findCurrentFlashcardVocab() {
        var current = flashcardOriginQueue[flashcardCurrentIndex];
        if (!current || typeof vocabList === 'undefined') return null;
        return vocabList.find(function(word) {
            return String(word.num) === String(current.num);
        }) || vocabList.find(function(word) {
            return String(word.word || '').toLowerCase() === String(current.en || '').toLowerCase();
        }) || null;
    }

    window.closeFlashcardWordDetails = function() {
        var sheet = document.getElementById('flashcardWordDetails');
        if (!sheet) return;
        sheet.classList.remove('is-open');
        sheet.setAttribute('aria-hidden', 'true');
    };

    window.openFlashcardWordDetails = function() {
        var current = flashcardOriginQueue[flashcardCurrentIndex];
        if (!current) return;
        var word = findCurrentFlashcardVocab();
        var sheet = document.getElementById('flashcardWordDetails');
        if (!sheet) {
            sheet = document.createElement('div');
            sheet.id = 'flashcardWordDetails';
            sheet.className = 'flashcard-detail-sheet';
            sheet.setAttribute('aria-hidden', 'true');
            sheet.innerHTML = '<button type="button" class="flashcard-detail-backdrop" aria-label="詳細を閉じる"></button><section class="flashcard-detail-panel" role="dialog" aria-modal="true" aria-label="単語の詳細"><div class="flashcard-detail-handle"></div><button type="button" class="flashcard-detail-close" aria-label="閉じる">×</button><div id="flashcardDetailContent" class="flashcard-detail-content"></div></section>';
            sheet.querySelector('.flashcard-detail-backdrop').onclick = window.closeFlashcardWordDetails;
            sheet.querySelector('.flashcard-detail-close').onclick = window.closeFlashcardWordDetails;
            document.body.appendChild(sheet);
        }

        var content = sheet.querySelector('#flashcardDetailContent');
        content.replaceChildren();
        if (word && typeof window.createVocabCard === 'function') {
            // 単語帳と同じ生成関数を使う。似せた別UIではなく、完全に同じカードを表示する。
            content.appendChild(window.createVocabCard(word));
            if (typeof window.initLucide === 'function') window.initLucide();
        } else {
            var unavailable = document.createElement('div');
            unavailable.className = 'word-row-container';
            unavailable.textContent = '単語の詳細を読み込めませんでした。';
            content.appendChild(unavailable);
        }

        sheet.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(function() { sheet.classList.add('is-open'); });
        sheet.querySelector('.flashcard-detail-close').focus();
    };

    // スワイプ確定時だけ表示する軽量な消滅演出。
    // 指への追尾はせず、8個の粒と1本の輪をCSSだけで短時間描画する。
    window.showFlashcardVanishBurst = function(x, y, direction, host) {
        var burst = document.createElement('div');
        burst.className = 'fc-vanish-burst fc-vanish-' + direction;
        burst.style.left = x + 'px';
        burst.style.top = y + 'px';

        var ring = document.createElement('span');
        ring.className = 'fc-vanish-ring';
        burst.appendChild(ring);

        var colors = direction === 'right'
            ? ['#6EE7B7', '#34D399', '#FFFFFF']
            : direction === 'left'
                ? ['#FCA5A5', '#FB7185', '#FFFFFF']
                : ['#FDE68A', '#F59E0B', '#FFFFFF'];
        for (var i = 0; i < 8; i++) {
            var particle = document.createElement('span');
            particle.className = 'fc-vanish-particle';
            var angle = (Math.PI * 2 * i / 8) + (i % 2 ? 0.14 : -0.08);
            var distance = 52 + (i % 3) * 12;
            particle.style.setProperty('--fc-burst-x', Math.round(Math.cos(angle) * distance) + 'px');
            particle.style.setProperty('--fc-burst-y', Math.round(Math.sin(angle) * distance) + 'px');
            particle.style.setProperty('--fc-burst-delay', (i * 12) + 'ms');
            particle.style.setProperty('--fc-burst-size', (5 + (i % 3) * 2) + 'px');
            particle.style.background = colors[i % colors.length];
            particle.style.color = colors[i % colors.length];
            burst.appendChild(particle);
        }
        (host||document.body).appendChild(burst);
        setTimeout(function() { burst.remove(); }, 650);
    };

    // Shared card surface and sizing for ordinary flashcards and the login warm-up.
    window.fillFlashcardFaces=function(cardWrap,front,back,num,style){
        var rotator=document.createElement('div');rotator.className='flashcard-inner-rotator';
        ['front','back'].forEach(function(side){var face=document.createElement('div');face.className='flashcard-face-'+side;face.style.cssText=style||'';if(side==='front'){var badge=document.createElement('span');badge.className='flashcard-number';badge.textContent='#'+num;face.append(badge);}var text=document.createElement('div');text.style.cssText='font-size:'+(side==='front'?24:16)+'px;font-weight:'+(side==='front'?900:700)+';text-align:center;color:white;word-break:break-word;overflow-wrap:anywhere';if(side==='front')text.style.fontFamily='Times New Roman, serif';text.textContent=side==='front'?front:back;face.append(text);rotator.append(face);});cardWrap.append(rotator);
    };
    window.sizeFlashcardFaces=function(cardWrap,stage,posLabel){
        var texts=Array.from(cardWrap.querySelectorAll('.flashcard-face-front > div,.flashcard-face-back > div'));
        var diameter=240,maxDiameter=Math.max(240,Math.min(420,window.innerWidth-32));
        function sizeTextArea(){
            cardWrap.style.width=cardWrap.style.height=diameter+'px';
            texts.forEach(function(text){text.style.width=(diameter*.74)+'px';text.style.padding='0';text.style.boxSizing='border-box';text.style.flexShrink='0';text.style.whiteSpace='normal';text.style.lineHeight='1.5';text.style.maxHeight='none';});
        }
        sizeTextArea();
        while(diameter<maxDiameter && texts.some(function(text){return text.scrollHeight>diameter*.62;})) {
            diameter=Math.min(maxDiameter,diameter+16);sizeTextArea();
        }
        texts.forEach(function(text){
            var font=parseFloat(text.style.fontSize),minimum=14;
            while(font>minimum && text.scrollHeight>diameter*.62){font--;text.style.fontSize=font+'px';}
            text.style.maxHeight=(diameter*.62)+'px';text.style.overflowY='hidden';text.style.overscrollBehavior='contain';
            if(text.scrollHeight>text.clientHeight){text.style.overflowY='auto';text.style.touchAction='pan-y';}
        });
        stage.style.height=Math.max(320,diameter+40)+'px';
        if(posLabel)posLabel.style.top='calc(50% + '+(diameter/2+12)+'px)';

    };

    window.createFlashcardNotePreview=function(note){
            var panel=document.createElement('div');panel.className='flashcard-note-preview';
            var reveal=document.createElement('button');reveal.type='button';reveal.className='flashcard-note-reveal';reveal.setAttribute('aria-label','メモを表示');reveal.textContent='メモを表示';
            var content=document.createElement('div');content.className='flashcard-note-content';content.textContent=note;content.setAttribute('aria-hidden','true');
            reveal.onclick=function(){panel.classList.add('revealed');content.removeAttribute('aria-hidden');reveal.remove();more.hidden=content.scrollHeight<=content.clientHeight+1;};
            var more=document.createElement('button');more.type='button';more.className='flashcard-note-more';more.textContent='すべて表示';more.onclick=function(){content.classList.toggle('expanded');more.textContent=content.classList.contains('expanded')?'折りたたむ':'すべて表示';};
            panel.append(reveal,content,more);return panel;
    };

    // 距離が足りなくても、素早く弾いた場合はスワイプとして扱う。
    window.flashcardSwipeDirection = function(dx, dy, vx, vy) {
        var fast = 0.45, flick = 28;
        var horizontal = Math.abs(dx) >= Math.abs(dy);
        if (horizontal && (Math.abs(dx) > 65 || (Math.abs(dx) > flick && Math.abs(vx) > fast && vx * dx > 0))) return dx > 0 ? 'right' : 'left';
        if (!horizontal && dy < 0 && (dy < -65 || (dy < -flick && vy < -fast))) return 'up';
        if (dx > 65) return 'right';
        if (dx < -65) return 'left';
        return null;
    };

    window.renderFlashcardDeck = function() {
        var stage = document.getElementById('flashcardDeckStage');
        if (!stage) return;
        stage.innerHTML = "";
        var remaining = flashcardOriginQueue.length - flashcardCurrentIndex;
        document.getElementById('flashcardRemainingBadge').innerText = '残り ' + remaining + '枚';
        var progressPercent = flashcardOriginQueue.length > 0 ? Math.round((flashcardLearnedCount / flashcardOriginQueue.length) * 100) : 0;
        document.getElementById('flashcardProgressText').innerText = '表示中の覚えた単語: ' + progressPercent + '%';
        var previousButton = document.getElementById('flashcardPreviousButton');
        if (previousButton) previousButton.disabled = flashcardSessionHistory.length === 0;

        if (remaining <= 0) {
            alert('🎉 カードの試練達成！\n習得単語数: ' + flashcardLearnedCount + ' / ' + flashcardOriginQueue.length);
            window.quitFlashcardSession();
            return;
        }

        var wordData = flashcardOriginQueue[flashcardCurrentIndex];
        var oldNote=document.getElementById('flashcardNotePreview');if(oldNote)oldNote.remove();
        var original=vocabList.find(function(w){return String(w.num)===String(wordData.num);});
        var note=String(original&&original.note||'');
        if(!note&&window.LearningData){var saved=LearningData.read(currentTextbook)[String(wordData.num)];note=String(saved&&saved.note||'');}
        if(note.trim()){var panel=window.createFlashcardNotePreview(note);panel.id='flashcardNotePreview';stage.parentElement.parentElement.insertBefore(panel,stage.parentElement);}

        var posLabel=document.getElementById('flashcardPartOfSpeech');
        if(posLabel){posLabel.hidden=!wordData.partOfSpeech;posLabel.textContent=wordData.partOfSpeech?wordData.partOfSpeech.short:'';posLabel.title=wordData.partOfSpeech?wordData.partOfSpeech.name:'';posLabel.setAttribute('aria-label',wordData.partOfSpeech?wordData.partOfSpeech.name:'');}
        window.renderFlashcardHistoryBubbles(wordData);
        var cardWrap = document.createElement('div');
        cardWrap.className = "flashcard-wrapper-3d";
        cardWrap.id = "activeFlashcard";

        var liveRipple = document.createElement('div');
        liveRipple.id = "flashcardLiveRippleLayer";
        liveRipple.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; border-radius:50%; pointer-events:none; opacity:0; z-index:30 !important; mix-blend-mode: screen; transition: opacity 0.1s ease;";
        cardWrap.appendChild(liveRipple);

        cardWrap.onclick = function(e) {
            if (isCardFlicking) return;
            if (cardWrap.__ignoreClickUntil && Date.now() < cardWrap.__ignoreClickUntil) return;
            window.StartupMonitor?.activity?.('card-flip');
            cardWrap.classList.toggle('flipped');
            window.AppSounds?.play('back');
        };

        // Pointer Eventsに統一し、指・ペン・マウスの位置へカード本体を追尾させる。
        // touchとclickを別々に登録すると同じ操作が二重に処理されるため使用しない。
        cardWrap.style.touchAction = 'none';
        var activePointerId = null, dragStarted = false, baseTransform = '', frame = 0, pendingMove = null, samples = [];
        function edges() { return [document.getElementById('fcEdgeRippleRight'), document.getElementById('fcEdgeRippleLeft'), document.getElementById('fcEdgeRippleTop')]; }
        function clearEdges() { edges().forEach(function(edge) { if (edge) edge.style.opacity = 0; }); }
        function paint() {
            frame = 0;
            if (!pendingMove || !dragStarted) return;
            var dx = pendingMove.dx, dy = pendingMove.dy;
            // 掴んだ時点の浮遊アニメーションの姿勢に指の移動量を重ね、触れた瞬間に跳ねないようにする。
            cardWrap.style.setProperty('transform', baseTransform + " translate3d(" + dx + "px, " + dy + "px, 0) rotate(" + (dx * 0.05) + "deg)", 'important');
            var distance = Math.sqrt(dx * dx + dy * dy);
            var ratio = Math.min(distance / 130, 1);
            var fluidOpacity = Math.pow(ratio, 2.2) * 0.45;
            var e3 = edges(), rightEdge = e3[0], leftEdge = e3[1], topEdge = e3[2];
            if (distance > 10) {
                if (dy < -15 && Math.abs(dy) > Math.abs(dx)) {
                    liveRipple.style.background = "radial-gradient(circle, rgba(245, 158, 11, 0.4) 0%, rgba(245, 158, 11, 0) 75%)";
                    liveRipple.style.opacity = fluidOpacity;
                    if (topEdge) { topEdge.style.opacity = ratio; topEdge.style.transform = "scaleY(" + (1 + ratio * 0.35) + ")"; }
                    if (rightEdge) rightEdge.style.opacity = 0;
                    if (leftEdge) leftEdge.style.opacity = 0;
                } else if (dx > 15) {
                    liveRipple.style.background = "radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, rgba(16, 185, 129, 0) 75%)";
                    liveRipple.style.opacity = fluidOpacity;
                    if (rightEdge) { rightEdge.style.opacity = ratio; rightEdge.style.transform = "scaleX(" + (1 + ratio * 0.35) + ")"; }
                    if (leftEdge) leftEdge.style.opacity = 0;
                    if (topEdge) topEdge.style.opacity = 0;
                } else if (dx < -15) {
                    liveRipple.style.background = "radial-gradient(circle, rgba(239, 68, 68, 0.4) 0%, rgba(239, 68, 68, 0) 75%)";
                    liveRipple.style.opacity = fluidOpacity;
                    if (leftEdge) { leftEdge.style.opacity = ratio; leftEdge.style.transform = "scaleX(" + (1 + ratio * 0.35) + ")"; }
                    if (rightEdge) rightEdge.style.opacity = 0;
                    if (topEdge) topEdge.style.opacity = 0;
                }
            } else {
                liveRipple.style.opacity = 0;
                clearEdges();
            }
        }
        // スワイプしきれなかった時は中央へ滑らかに戻してから浮遊アニメーションを再開する。
        function settle() {
            if (frame) { cancelAnimationFrame(frame); frame = 0; }
            pendingMove = null;
            liveRipple.style.opacity = 0;
            clearEdges();
            if (!dragStarted) { cardWrap.classList.remove('is-dragging'); return; }
            dragStarted = false;
            cardWrap.classList.add('is-settling');
            cardWrap.classList.remove('is-dragging');
            cardWrap.style.removeProperty('transform');
            var done = function() { cardWrap.classList.remove('is-settling'); cardWrap.removeEventListener('transitionend', done); };
            cardWrap.addEventListener('transitionend', done);
            setTimeout(done, 260);
        }
        cardWrap.addEventListener('pointerdown', function(e) {
            if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
            activePointerId = e.pointerId;
            cardTouchStartX = e.clientX;
            cardTouchStartY = e.clientY;
            isCardFlicking = true;
            dragStarted = false;
            samples = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }];
            cardWrap.setPointerCapture(e.pointerId);
        });

        cardWrap.addEventListener('pointermove', function(e) {
            if (!isCardFlicking || e.pointerId !== activePointerId) return;
            var dx = e.clientX - cardTouchStartX;
            var dy = e.clientY - cardTouchStartY;
            samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
            while (samples.length > 2 && e.timeStamp - samples[0].t > 100) samples.shift();
            // 指の小さな揺れではカードを動かさない（タップでのピクつき防止）。
            if (!dragStarted) {
                if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
                var current = getComputedStyle(cardWrap).transform;
                baseTransform = current && current !== 'none' ? current : '';
                dragStarted = true;
                cardWrap.classList.remove('is-settling');
                cardWrap.classList.add('is-dragging');
            }
            pendingMove = { dx: dx, dy: dy };
            if (!frame) frame = requestAnimationFrame(paint);
        });

        cardWrap.addEventListener('pointerup', function(e) {
            if (!isCardFlicking || e.pointerId !== activePointerId) return;
            isCardFlicking = false;
            activePointerId = null;
            var dx = e.clientX - cardTouchStartX;
            var dy = e.clientY - cardTouchStartY;
            var first = samples[0], elapsed = first ? Math.max(1, e.timeStamp - first.t) : 1;
            var direction = window.flashcardSwipeDirection(dx, dy, first ? (e.clientX - first.x) / elapsed : 0, first ? (e.clientY - first.y) / elapsed : 0);
            if (direction) {
                if (frame) { cancelAnimationFrame(frame); frame = 0; }
                dragStarted = false;
                liveRipple.style.opacity = 0;
                window.swipeFlashcard(direction, dx, dy);
            } else if (dragStarted) {
                // 届かなかったスワイプはめくらずに戻す（直後のclickも無視する）。
                cardWrap.__ignoreClickUntil = Date.now() + 500;
                settle();
            } else {
                settle();
                // スマホはclickの発火を待たず、指を離した瞬間にめくる。
                window.StartupMonitor?.activity?.('card-flip');
                cardWrap.classList.toggle('flipped');
                window.AppSounds?.play('back');
                cardWrap.__ignoreClickUntil = Date.now() + 500;
            }
        });

        cardWrap.addEventListener('pointercancel', function(e) {
            if (e.pointerId !== activePointerId) return;
            activePointerId = null;
            isCardFlicking = false;
            settle();
        });

        var frontText = flashcardDirectionMode === 'en2ja' ? wordData.en : wordData.ja;
        var backText = flashcardDirectionMode === 'en2ja' ? wordData.ja : wordData.en;
        frontText = window.escapeVocabText(frontText);
        backText = window.escapeVocabText(backText);
        var customStyle = (typeof window.getFlashcardStyleByHistory === 'function') ? window.getFlashcardStyleByHistory(wordData) : "";
        window.fillFlashcardFaces(cardWrap,flashcardDirectionMode === 'en2ja'?wordData.en:wordData.ja,flashcardDirectionMode === 'en2ja'?wordData.ja:wordData.en,wordData.shownNo||wordData.num,customStyle);
        stage.appendChild(cardWrap);
        // The text box must grow with the circle; flex shrinking otherwise hides extra lines.
        window.sizeFlashcardFaces(cardWrap,stage,posLabel);

        if (typeof window.initLucide === 'function') window.initLucide();
    };

    window.animateFlashcardSwipe=function(card,direction,finalDx,finalDy,removeCard){
        window.StartupMonitor?.activity?.(card.closest('.flash-warmup-dialog')?'warmup-swipe':'card-swipe');
        var effectHost=card.closest('dialog')||document.body;
        var rect = card.getBoundingClientRect();
        var releaseX = rect.left + rect.width / 2;
        var releaseY = rect.top + rect.height / 2;

        document.querySelectorAll('#flashcardGhost,.flashcard-post-ripple,.fc-vanish-burst').forEach(function(effect){effect.remove();});
        // iOS must not clone a nested 3D/scrolling subtree for the outgoing effect.
        var ghost;
        if(document.documentElement.classList.contains('ios-stable-rendering')){
            ghost=document.createElement('div');ghost.className='flashcard-wrapper-3d fc-flat-ghost';
            var surface=card.querySelector(card.classList.contains('flipped')?'.flashcard-face-back':'.flashcard-face-front');
            var rotator=document.createElement('div');rotator.className='flashcard-inner-rotator';
            if(surface){var face=surface.cloneNode(true);face.className='flashcard-face-front';face.querySelectorAll('div').forEach(function(text){text.style.overflow='hidden';});rotator.append(face);}
            ghost.append(rotator);
        }else ghost=card.cloneNode(true);
        ghost.classList.remove('warmup-card');
        ghost.classList.add('flashcard-ghost');
        ghost.setAttribute('aria-hidden','true');ghost.tabIndex=-1;
        if(ghost.tagName==='BUTTON')ghost.disabled=true;
        ghost.id = "flashcardGhost";
        ghost.style.position = "fixed";
        ghost.style.left = (rect.left) + "px";
        ghost.style.top = (rect.top) + "px";
        ghost.style.width = rect.width + "px";
        ghost.style.height = rect.height + "px";
        ghost.style.margin = "0";
        ghost.style.zIndex = "5000";
        ghost.style.pointerEvents = "none";
        ghost.style.animation = "none";
        ghost.style.transform = "translate3d(" + (finalDx || 0) + "px, " + (finalDy || 0) + "px, 0) rotate(" + ((finalDx || 0) * 0.05) + "deg)";
        ghost.style.opacity = "1";
        effectHost.appendChild(ghost);
        requestAnimationFrame(function() {
            ghost.style.transition = "transform 0.8s cubic-bezier(0.1, 0.8, 0.25, 1), opacity 0.8s ease";
            ghost.style.transform = "translate3d(" + (finalDx || 0) + "px, " + (finalDy || 0) + "px, 0) scale(0) rotate(" + ((finalDx || 0) * 0.05) + "deg)";
            ghost.style.opacity = "0";
        });
        setTimeout(function() { ghost.remove(); }, 850);

        // リップル
        var ripple = document.createElement('div');
        ripple.className = "flashcard-post-ripple firework-余韻-" + direction;
        ripple.style.position = "fixed";
        ripple.style.left = (releaseX - 120) + "px";
        ripple.style.top = (releaseY - 120) + "px";
        ripple.style.width = "240px";
        ripple.style.height = "240px";
        ripple.style.transform = "none";
        ripple.style.zIndex = "4999";
        ripple.style.animationDuration = "0.8s";
        effectHost.appendChild(ripple);
        setTimeout(function() { ripple.remove(); }, 800);
        if (typeof window.showFlashcardVanishBurst === 'function') {
            window.showFlashcardVanishBurst(releaseX, releaseY, direction, effectHost);
        }
        if(removeCard!==false)card.remove();
    };

    window.swipeFlashcard = function(direction, finalDx, finalDy) {
        var card = document.getElementById('activeFlashcard');
        if (!card) return;
        var currentWord = flashcardOriginQueue[flashcardCurrentIndex];
        if (!currentWord) return;
        window.AppSounds?.play(direction === 'right' ? 'swipe-right' : direction === 'left' ? 'swipe-left' : 'navigate');
        var cleanKey = String(currentWord.en || '').toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]\"']/g, "");
        var status = 'none';
        var vocabIndex = -1;
        if (typeof vocabList !== 'undefined') {
            vocabIndex = vocabList.findIndex(function(v) { return String(v.num) === String(currentWord.num); });
            if (vocabIndex < 0) vocabIndex = vocabList.findIndex(function(v) { return String(v.word || '').toLowerCase() === cleanKey; });
        }
        var previousMemory = (typeof wordMemory !== 'undefined' && Object.prototype.hasOwnProperty.call(wordMemory, cleanKey)) ? wordMemory[cleanKey] : undefined;
        flashcardSessionHistory.push({
            queueIndex: flashcardCurrentIndex,
            cleanKey: cleanKey,
            previousMemory: previousMemory,
            vocabIndex: vocabIndex,
            vocabSnapshot: vocabIndex >= 0 ? JSON.parse(JSON.stringify(vocabList[vocabIndex])) : null,
            learnedCount: flashcardLearnedCount,
            totalExp: typeof totalExp !== 'undefined' ? totalExp : null,
            flashCount: typeof userStats !== 'undefined' ? (userStats.flash_count || 0) : null
        });

        window.animateFlashcardSwipe(card,direction,finalDx,finalDy);

        if (direction === 'right') { status = 'ok'; flashcardLearnedCount++; }
        else if (direction === 'left') { status = 'bad'; }
        else if (direction === 'up') { status = 'so'; }


        var vocabMatch = null;
        if (typeof vocabList !== 'undefined') {
            vocabMatch = vocabIndex >= 0 ? vocabList[vocabIndex] : null;
        }
        if (vocabMatch) {
            var answeredMeaning = null;
            if (vocabMatch.meanings && vocabMatch.meanings.length > 0) {
                if (currentWord.meaningId !== null && currentWord.meaningId !== undefined) {
                    answeredMeaning = vocabMatch.meanings.find(function(meaning) { return String(meaning.id) === String(currentWord.meaningId); });
                }
                if (!answeredMeaning) answeredMeaning = vocabMatch.meanings[currentWord.meaningIndex || 0];
            }
            if (answeredMeaning) {
                answeredMeaning.status = status;
                if (!answeredMeaning.history) answeredMeaning.history = [];
                answeredMeaning.history.push(status);
                answeredMeaning.history = answeredMeaning.history.slice(-20);
                vocabMatch.status = typeof window.wordOverallStatus === 'function' ? window.wordOverallStatus(vocabMatch) : status;
            } else {
                vocabMatch.status = status;
                if (!vocabMatch.history) vocabMatch.history = [];
                vocabMatch.history.push(status);
                vocabMatch.history = vocabMatch.history.slice(-20);
            }
            // 単語単位の補助記憶には、特定の意味の回答ではなく全意味から求めた状態を入れる。
            if (typeof wordMemory !== 'undefined') {
                wordMemory[cleanKey] = vocabMatch.status || status;
                try { localStorage.setItem('wordMemory', JSON.stringify(wordMemory)); } catch (e) {}
            }
            // 回答と同じ処理内で端末へ確定する。終了処理やタイマーまで待たない。
            if (typeof window.saveVocabProgressLocally === 'function') window.saveVocabProgressLocally(vocabMatch.num);
            if (status !== 'none') {
                try { window.StudyPoints?.reward('card', currentTextbook, vocabMatch.num, myId || 'GUEST-000', {word:vocabMatch.word,bookName:(textbooksPool.find(b=>b.id===currentTextbook)||{}).name}); }
                catch (error) { console.warn('単語カードのポイント記録を確認してください',error); window.showToast?.('ポイントを記録できませんでした。端末の空き容量を確認してください。','err'); }
            }
        } else if (typeof wordMemory !== 'undefined') {
            wordMemory[cleanKey] = status;
            try { localStorage.setItem('wordMemory', JSON.stringify(wordMemory)); } catch (e) {}
        }
        if (typeof userStats !== 'undefined') {
            userStats.flash_count = (userStats.flash_count || 0) + 1;
            if (window.recordRankedSwipe) window.recordRankedSwipe();
            if (window.noteFlashSwipe) window.noteFlashSwipe();
            if (vocabMatch && window.recordRankedWord) window.recordRankedWord(currentTextbook, vocabMatch.num);
            userStats.vocab_fixed = (typeof vocabList !== 'undefined') ? vocabList.filter(function(w) { return w.meanings && w.meanings.some(function(m) { return m.status === 'ok'; }); }).length : 0;
        }
        // 次のカードを最初に表示する。単語帳全体の再描画やランキング更新を
        // スワイプと同じ処理内で行うと、端末によって操作後に引っ掛かる。
        flashcardCurrentIndex++;
        window.FlashCheckpoint?.save();
        window.renderFlashcardDeck();
        setTimeout(function() {
            // Update hidden library/ranking/profile views only after leaving the session.
            if(!document.body.classList.contains('in-game-active')){
                if (typeof window.applyProfileToUi === 'function') window.applyProfileToUi();
                if (typeof window.updateReaderWordColors === 'function') window.updateReaderWordColors();
                if (vocabMatch && typeof window.updateVocabCardUi === 'function') window.updateVocabCardUi(vocabMatch.num);
            }
            var rightEdge3 = document.getElementById('fcEdgeRippleRight');
            var leftEdge3 = document.getElementById('fcEdgeRippleLeft');
            var topEdge3 = document.getElementById('fcEdgeRippleTop');
            if (rightEdge3) rightEdge3.style.opacity = 0;
            if (leftEdge3) leftEdge3.style.opacity = 0;
            if (topEdge3) topEdge3.style.opacity = 0;
        }, 0);
    };

    window.goBackFlashcard = function() {
        if (!flashcardSessionHistory.length) return;
        var previous = flashcardSessionHistory.pop();
        flashcardCurrentIndex = previous.queueIndex;
        flashcardLearnedCount = previous.learnedCount;
        if (previous.totalExp !== null && typeof totalExp !== 'undefined') totalExp = previous.totalExp;
        if (previous.flashCount !== null && typeof userStats !== 'undefined') userStats.flash_count = previous.flashCount;
        if (window.syncRankingMetrics) window.syncRankingMetrics(); // Swipes remain counted when going back.
        if (typeof wordMemory !== 'undefined') {
            if (previous.previousMemory === undefined) delete wordMemory[previous.cleanKey];
            else wordMemory[previous.cleanKey] = previous.previousMemory;
            try { localStorage.setItem('wordMemory', JSON.stringify(wordMemory)); } catch (e) {}
        }
        if (previous.vocabIndex >= 0 && previous.vocabSnapshot && typeof vocabList !== 'undefined') {
            vocabList[previous.vocabIndex] = JSON.parse(JSON.stringify(previous.vocabSnapshot));
            if (typeof window.saveVocabProgressLocally === 'function') window.saveVocabProgressLocally(vocabList[previous.vocabIndex].num);
        }
        window.FlashCheckpoint?.save();
        window.renderFlashcardDeck();
    };

    window.quitFlashcardSession = function() {
        if (typeof window.__captureManualVocabDraft === 'function') window.__captureManualVocabDraft();
        if (typeof window.flushChangedVocabData === 'function') window.flushChangedVocabData();
        window.closeFlashcardWordDetails();
        document.body.classList.remove('in-game-active');
        document.getElementById('flashcard-play-screen').style.display = 'none';
        var lbArea = document.getElementById('gameLeaderboardArea');
        if (lbArea) lbArea.style.display = 'flex';
        ['fcEdgeRippleRight', 'fcEdgeRippleLeft', 'fcEdgeRippleTop'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.remove();
        });
    };

    window.finishFlashcardSession = function(keepCheckpoint) {
        window.FlashCheckpoint?.finish(keepCheckpoint===true);
        if(window.flushFlashAutosave)window.flushFlashAutosave();
        if (typeof window.__captureManualVocabDraft === 'function') window.__captureManualVocabDraft();
        if (typeof window.flushChangedVocabData === 'function') window.flushChangedVocabData();
        window.closeFlashcardWordDetails();
        document.body.classList.remove('in-game-active');
        var playScreen = document.getElementById('flashcard-play-screen');
        if (playScreen) playScreen.style.display = 'none';
        var resultScreen = document.getElementById('game-result-screen');
        if (resultScreen) resultScreen.style.display = 'none';
        var lbArea = document.getElementById('gameLeaderboardArea');
        if (lbArea) lbArea.style.display = 'flex';
        ['fcEdgeRippleRight', 'fcEdgeRippleLeft', 'fcEdgeRippleTop'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.remove();
        });
        window.switchTab('vocab');
    };
    window.quitFlashcardSession = window.finishFlashcardSession;

    console.log('🎴 game_core.js 読み込み完了');
})();
