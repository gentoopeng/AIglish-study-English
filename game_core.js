// ================================================================
// game_core.js —— ゲーム（フラッシュカード＋ソロバトル）関連ロジック
// 読み込み順: app.js → game_core.js
// ================================================================
(function() {
    "use strict";

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
        var startScreen = document.getElementById('game-start-screen');
        if (startScreen) startScreen.style.display = 'none';
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
        var nums = (words || []).map(function(word) { return Number(word.num); }).filter(Number.isFinite);
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
                await window.selectVocabLibraryBook(selectedBook);
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
        var startScreen = document.getElementById('game-start-screen');
        if (startScreen) startScreen.style.display = 'flex';
        var lbArea = document.getElementById('gameLeaderboardArea');
        if (lbArea) lbArea.style.display = 'flex';
    };

    window.startFlashcardSession = async function() {
        var startNum = parseInt(document.getElementById('flashcardRangeStart').value) || 1;
        var endNum = parseInt(document.getElementById('flashcardRangeEnd').value) || 100;
        var sourceSelector = document.getElementById('flashcardSourceSelect');
        if (sourceSelector) flashcardDataSourceMode = sourceSelector.value;

        var pool = [];
        if (typeof vocabList !== 'undefined') {
            vocabList.forEach(function(w) {
                var n = parseInt(w.num);
                if (n < startNum || n > endNum) return;
                var meanings = w.meanings && w.meanings.length ? w.meanings : [{ id: null, text: w.meaning, status: w.status || 'none', history: w.history || [] }];
                meanings.forEach(function(meaning, meaningIndex) {
                    var meaningStatus = getFlashcardMeaningStatus(meaning, w);
                    if (!flashcardSelectedStatuses[meaningStatus]) return;
                    pool.push({
                        num: w.num,
                        en: w.word,
                        ja: meaning.text || w.meaning || '',
                        meaningId: meaning.id !== undefined && meaning.id !== null ? String(meaning.id) : null,
                        meaningIndex: meaningIndex
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
    window.showFlashcardVanishBurst = function(x, y, direction) {
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
        document.body.appendChild(burst);
        setTimeout(function() { burst.remove(); }, 650);
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
            cardWrap.classList.toggle('flipped');
        };

        // Pointer Eventsに統一し、指・ペン・マウスの位置へカード本体を追尾させる。
        // touchとclickを別々に登録すると同じ操作が二重に処理されるため使用しない。
        cardWrap.style.touchAction = 'none';
        var activePointerId = null;
        cardWrap.addEventListener('pointerdown', function(e) {
            if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
            activePointerId = e.pointerId;
            cardTouchStartX = e.clientX;
            cardTouchStartY = e.clientY;
            isCardFlicking = true;
            cardWrap.setPointerCapture(e.pointerId);
            cardWrap.classList.add('is-dragging');
            cardWrap.style.transition = 'none';
            cardWrap.style.animation = 'none';
        });

        cardWrap.addEventListener('pointermove', function(e) {
            if (!isCardFlicking || e.pointerId !== activePointerId) return;
            var dx = e.clientX - cardTouchStartX;
            var dy = e.clientY - cardTouchStartY;
            cardWrap.style.setProperty('transform', "translate3d(" + dx + "px, " + dy + "px, 0) rotate(" + (dx * 0.05) + "deg)", 'important');
            var distance = Math.sqrt(dx * dx + dy * dy);
            var ratio = Math.min(distance / 130, 1);
            var fluidOpacity = Math.pow(ratio, 2.2) * 0.45;
            var rightEdge = document.getElementById('fcEdgeRippleRight');
            var leftEdge = document.getElementById('fcEdgeRippleLeft');
            var topEdge = document.getElementById('fcEdgeRippleTop');
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
                if (rightEdge) rightEdge.style.opacity = 0;
                if (leftEdge) leftEdge.style.opacity = 0;
                if (topEdge) topEdge.style.opacity = 0;
            }
        });

        cardWrap.addEventListener('pointerup', function(e) {
            if (!isCardFlicking || e.pointerId !== activePointerId) return;
            isCardFlicking = false;
            activePointerId = null;
            var dx = e.clientX - cardTouchStartX;
            var dy = e.clientY - cardTouchStartY;
            liveRipple.style.opacity = 0;
            if (dx > 65) { window.swipeFlashcard('right', dx, dy); }
            else if (dx < -65) { window.swipeFlashcard('left', dx, dy); }
            else if (dy < -65) { window.swipeFlashcard('up', dx, dy); }
            else {
                cardWrap.classList.remove('is-dragging');
                cardWrap.style.transition = '';
                cardWrap.style.animation = '';
                cardWrap.style.removeProperty('transform');
                // スマホはclickの発火を待たず、指を離した瞬間にめくる。
                cardWrap.classList.toggle('flipped');
                cardWrap.__ignoreClickUntil = Date.now() + 500;
                var rightEdge2 = document.getElementById('fcEdgeRippleRight');
                var leftEdge2 = document.getElementById('fcEdgeRippleLeft');
                var topEdge2 = document.getElementById('fcEdgeRippleTop');
                if (rightEdge2) rightEdge2.style.opacity = 0;
                if (leftEdge2) leftEdge2.style.opacity = 0;
                if (topEdge2) topEdge2.style.opacity = 0;
            }
        });

        cardWrap.addEventListener('pointercancel', function(e) {
            if (e.pointerId !== activePointerId) return;
            activePointerId = null;
            isCardFlicking = false;
            cardWrap.classList.remove('is-dragging');
            cardWrap.style.transition = '';
            cardWrap.style.animation = '';
            cardWrap.style.removeProperty('transform');
            liveRipple.style.opacity = 0;
        });

        var frontText = flashcardDirectionMode === 'en2ja' ? wordData.en : wordData.ja;
        var backText = flashcardDirectionMode === 'en2ja' ? wordData.ja : wordData.en;
        frontText = window.escapeVocabText(frontText);
        backText = window.escapeVocabText(backText);
        var customStyle = (typeof window.getFlashcardStyleByHistory === 'function') ? window.getFlashcardStyleByHistory(wordData) : "";
        cardWrap.innerHTML += '<div class="flashcard-inner-rotator" style="z-index:2;"><div class="flashcard-face-front" style="' + customStyle + '"><span style="font-size:11px; color:var(--text-sub); position:absolute; top:24px; font-weight:800;">#' + wordData.num + '</span><div style="font-size:24px; font-weight:900; font-family:\'Times New Roman\', serif; word-break:break-word; text-align:center; padding:0 15px; color:#FFFFFF;">' + frontText + '</div></div><div class="flashcard-face-back" style="' + customStyle + '"><div style="font-size:16px; font-weight:700; word-break:break-word; text-align:center; color:#FFFFFF; padding:0 15px; line-height:1.5;">' + backText + '</div></div></div>';
        stage.appendChild(cardWrap);
        if (typeof window.initLucide === 'function') window.initLucide();
    };

    window.swipeFlashcard = function(direction, finalDx, finalDy) {
        var card = document.getElementById('activeFlashcard');
        if (!card) return;
        var currentWord = flashcardOriginQueue[flashcardCurrentIndex];
        if (!currentWord) return;
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

        var stage = document.getElementById('flashcardDeckStage');
        var rect = card.getBoundingClientRect();
        var releaseX = rect.left + rect.width / 2;
        var releaseY = rect.top + rect.height / 2;

        // ゴーストカード
        var ghost = card.cloneNode(true);
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
        document.body.appendChild(ghost);
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
        document.body.appendChild(ripple);
        setTimeout(function() { ripple.remove(); }, 800);
        if (typeof window.showFlashcardVanishBurst === 'function') {
            window.showFlashcardVanishBurst(releaseX, releaseY, direction);
        }
        card.remove();

        if (direction === 'right') { status = 'ok'; flashcardLearnedCount++; }
        else if (direction === 'left') { status = 'bad'; }
        else if (direction === 'up') { status = 'so'; }

        if (typeof totalExp !== 'undefined') totalExp += 1;
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
            if (typeof window.__captureManualVocabDraft === 'function') window.__captureManualVocabDraft();
        } else if (typeof wordMemory !== 'undefined') {
            wordMemory[cleanKey] = status;
            try { localStorage.setItem('wordMemory', JSON.stringify(wordMemory)); } catch (e) {}
        }
        if (typeof userStats !== 'undefined') {
            userStats.flash_count = (userStats.flash_count || 0) + 1;
            userStats.vocab_fixed = (typeof vocabList !== 'undefined') ? vocabList.filter(function(w) { return w.meanings && w.meanings.some(function(m) { return m.status === 'ok'; }); }).length : 0;
        }
        // 次のカードを最初に表示する。単語帳全体の再描画やランキング更新を
        // スワイプと同じ処理内で行うと、端末によって操作後に引っ掛かる。
        flashcardCurrentIndex++;
        window.renderFlashcardDeck();
        setTimeout(function() {
            if (typeof window.saveUserStats === 'function') window.saveUserStats();
            if (typeof window.checkAndRewardTitleBonusXP === 'function') window.checkAndRewardTitleBonusXP();
            if (typeof window.applyProfileToUi === 'function') window.applyProfileToUi();
            if (typeof window.updateReaderWordColors === 'function') window.updateReaderWordColors();
            if (vocabMatch && typeof window.updateVocabCardUi === 'function') window.updateVocabCardUi(vocabMatch.num);
            if (typeof window.renderLeaderboard === 'function') window.renderLeaderboard();
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
        if (typeof wordMemory !== 'undefined') {
            if (previous.previousMemory === undefined) delete wordMemory[previous.cleanKey];
            else wordMemory[previous.cleanKey] = previous.previousMemory;
            try { localStorage.setItem('wordMemory', JSON.stringify(wordMemory)); } catch (e) {}
        }
        if (previous.vocabIndex >= 0 && previous.vocabSnapshot && typeof vocabList !== 'undefined') {
            vocabList[previous.vocabIndex] = JSON.parse(JSON.stringify(previous.vocabSnapshot));
            if (typeof window.saveVocabProgressLocally === 'function') window.saveVocabProgressLocally(vocabList[previous.vocabIndex].num);
            if (typeof window.__captureManualVocabDraft === 'function') window.__captureManualVocabDraft();
        }
        window.renderFlashcardDeck();
    };

    window.quitFlashcardSession = function() {
        if (typeof window.__captureManualVocabDraft === 'function') window.__captureManualVocabDraft();
        if (typeof window.flushChangedVocabData === 'function') window.flushChangedVocabData();
        window.closeFlashcardWordDetails();
        document.body.classList.remove('in-game-active');
        document.getElementById('flashcard-play-screen').style.display = 'none';
        var startScreen = document.getElementById('game-start-screen');
        if (startScreen) startScreen.style.display = 'flex';
        var lbArea = document.getElementById('gameLeaderboardArea');
        if (lbArea) lbArea.style.display = 'flex';
        ['fcEdgeRippleRight', 'fcEdgeRippleLeft', 'fcEdgeRippleTop'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.remove();
        });
    };

    window.finishFlashcardSession = function() {
        if (typeof window.__captureManualVocabDraft === 'function') window.__captureManualVocabDraft();
        if (typeof window.flushChangedVocabData === 'function') window.flushChangedVocabData();
        window.closeFlashcardWordDetails();
        document.body.classList.remove('in-game-active');
        var playScreen = document.getElementById('flashcard-play-screen');
        if (playScreen) playScreen.style.display = 'none';
        var resultScreen = document.getElementById('game-result-screen');
        if (resultScreen) resultScreen.style.display = 'none';
        var startScreen = document.getElementById('game-start-screen');
        if (startScreen) startScreen.style.display = 'flex';
        var lbArea = document.getElementById('gameLeaderboardArea');
        if (lbArea) lbArea.style.display = 'flex';
        ['fcEdgeRippleRight', 'fcEdgeRippleLeft', 'fcEdgeRippleTop'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.remove();
        });
    };
    window.quitFlashcardSession = window.finishFlashcardSession;

    console.log('🎴 game_core.js 読み込み完了');
})();
