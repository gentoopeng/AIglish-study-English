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
        window.applyVocabMaxRange();
    };

    window.setFlashcardDirection = function(mode) {
        flashcardDirectionMode = mode;
        var btnEn = document.getElementById('btnCardEn2Ja');
        var btnJa = document.getElementById('btnCardJa2en');
        if (btnEn) btnEn.classList.toggle('active', mode === 'en2ja');
        if (btnJa) btnJa.classList.toggle('active', mode === 'ja2en');
    };

    window.backToGameMenuFromCardSetup = function() {
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
            pool = vocabList.filter(function(w) {
                var n = parseInt(w.num);
                return n >= startNum && n <= endNum;
            }).map(function(w) {
                return {
                    num: w.num,
                    en: w.word,
                    ja: w.meanings && w.meanings[0] ? w.meanings[0].text : w.meaning
                };
            });
        }

        if (pool.length === 0) {
            alert("指定された範囲または教材にデータが存在しません。");
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
            if (vocabMatch.history && vocabMatch.history.length > 0) targetHistory = targetHistory.concat(vocabMatch.history);
            else if (vocabMatch.status && vocabMatch.status !== 'none') targetHistory.push(vocabMatch.status);
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

    window.createFlickTrailParticle = function(x, y, type) {
        var stage = document.getElementById('flashcard-play-screen');
        if (!stage) return;
        var p = document.createElement('div');
        p.className = 'fc-history-bubble';
        p.style.position = 'absolute';
        p.style.left = x + "px";
        p.style.top = y + "px";
        p.style.width = (Math.random() * 8 + 6) + "px";
        p.style.height = p.style.width;
        p.style.pointerEvents = 'none';
        p.style.zIndex = '400';
        p.style.opacity = '0.85';
        p.style.transform = 'translate(-50%, -50%)';
        p.style.transition = 'all 0.8s cubic-bezier(0.1, 0.8, 0.25, 1)';
        if (type === 'right') p.classList.add('ok');
        else if (type === 'left') p.classList.add('bad');
        else if (type === 'up') p.classList.add('so');
        else p.style.borderColor = 'rgba(255,255,255,0.6)';
        stage.appendChild(p);
        setTimeout(function() {
            p.style.transform = "translate(" + ((Math.random() - 0.5) * 40) + "px, " + (-60 - Math.random() * 40) + "px) scale(0)";
            p.style.opacity = '0';
        }, 10);
        setTimeout(function() { p.remove(); }, 850);
    };

    window.renderFlashcardDeck = function() {
        var stage = document.getElementById('flashcardDeckStage');
        if (!stage) return;
        stage.innerHTML = "";
        var remaining = flashcardOriginQueue.length - flashcardCurrentIndex;
        document.getElementById('flashcardRemainingBadge').innerText = '残り ' + remaining + '枚';
        var progressPercent = flashcardOriginQueue.length > 0 ? Math.round((flashcardLearnedCount / flashcardOriginQueue.length) * 100) : 0;
        document.getElementById('flashcardProgressText').innerText = '表示中の覚えた単語: ' + progressPercent + '%';

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
            cardWrap.classList.toggle('flipped');
        };

        cardWrap.addEventListener('touchstart', function(e) {
            cardTouchStartX = e.touches[0].clientX;
            cardTouchStartY = e.touches[0].clientY;
            isCardFlicking = true;
        }, { passive: true });

        cardWrap.addEventListener('touchmove', function(e) {
            if (!isCardFlicking) return;
            var dx = e.touches[0].clientX - cardTouchStartX;
            var dy = e.touches[0].clientY - cardTouchStartY;
            cardWrap.style.transform = "translate3d(" + dx + "px, " + dy + "px, 0) rotate(" + (dx * 0.05) + "deg)";
            var distance = Math.sqrt(dx * dx + dy * dy);
            var ratio = Math.min(distance / 130, 1);
            var fluidOpacity = Math.pow(ratio, 2.2) * 0.45;
            if (Math.random() < 0.35) {
                window.createFlickTrailParticle(e.touches[0].clientX, e.touches[0].clientY, 'trail');
            }
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
        }, { passive: true });

        cardWrap.addEventListener('touchend', function(e) {
            if (!isCardFlicking) return;
            isCardFlicking = false;
            var dx = e.changedTouches[0].clientX - cardTouchStartX;
            var dy = e.changedTouches[0].clientY - cardTouchStartY;
            liveRipple.style.opacity = 0;
            if (dx > 65) { window.swipeFlashcard('right', dx, dy); }
            else if (dx < -65) { window.swipeFlashcard('left', dx, dy); }
            else if (dy < -65) { window.swipeFlashcard('up', dx, dy); }
            else {
                cardWrap.style.transform = "";
                var rightEdge2 = document.getElementById('fcEdgeRippleRight');
                var leftEdge2 = document.getElementById('fcEdgeRippleLeft');
                var topEdge2 = document.getElementById('fcEdgeRippleTop');
                if (rightEdge2) rightEdge2.style.opacity = 0;
                if (leftEdge2) leftEdge2.style.opacity = 0;
                if (topEdge2) topEdge2.style.opacity = 0;
            }
        });

        var frontText = flashcardDirectionMode === 'en2ja' ? wordData.en : wordData.ja;
        var backText = flashcardDirectionMode === 'en2ja' ? wordData.ja : wordData.en;
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

        // パーティクル
        for (var i = 0; i < 15; i++) {
            setTimeout(function() {
                window.createFlickTrailParticle(releaseX + (Math.random() - 0.5) * 80, releaseY + (Math.random() - 0.5) * 80, direction);
            }, i * 15);
        }

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
        card.remove();

        if (direction === 'right') { status = 'ok'; flashcardLearnedCount++; }
        else if (direction === 'left') { status = 'bad'; }
        else if (direction === 'up') { status = 'so'; }

        if (typeof totalExp !== 'undefined') totalExp += 1;
        if (typeof wordMemory !== 'undefined') {
            wordMemory[cleanKey] = status;
            try { localStorage.setItem('wordMemory', JSON.stringify(wordMemory)); } catch (e) {}
        }
        var vocabMatch = null;
        if (typeof vocabList !== 'undefined') {
            vocabMatch = vocabList.find(function(v) { return String(v.num) === String(currentWord.num); });
            if (!vocabMatch) vocabMatch = vocabList.find(function(v) { return v.word.toLowerCase() === cleanKey; });
        }
        if (vocabMatch) {
            vocabMatch.status = status;
            if (vocabMatch.meanings && vocabMatch.meanings.length > 0) {
                vocabMatch.meanings[0].status = status;
                if (!vocabMatch.meanings[0].history) vocabMatch.meanings[0].history = [];
                vocabMatch.meanings[0].history.push(status);
            }
            if (!vocabMatch.history) vocabMatch.history = [];
            vocabMatch.history.push(status);
            if (typeof window.saveVocabToStorage === 'function') window.saveVocabToStorage();
        }
        if (typeof userStats !== 'undefined') {
            userStats.flash_count = (userStats.flash_count || 0) + 1;
            userStats.vocab_fixed = (typeof vocabList !== 'undefined') ? vocabList.filter(function(w) { return w.meanings && w.meanings.some(function(m) { return m.status === 'ok'; }); }).length : 0;
            if (typeof window.saveUserStats === 'function') window.saveUserStats();
            if (typeof window.checkAndRewardTitleBonusXP === 'function') window.checkAndRewardTitleBonusXP();
        }
        if (typeof window.applyProfileToUi === 'function') window.applyProfileToUi();
        if (typeof window.updateReaderWordColors === 'function') window.updateReaderWordColors();
        if (typeof window.renderVocabList === 'function') window.renderVocabList();
        if (typeof window.renderLeaderboard === 'function') window.renderLeaderboard();

        setTimeout(function() {
            flashcardCurrentIndex++;
            window.renderFlashcardDeck();
            var rightEdge3 = document.getElementById('fcEdgeRippleRight');
            var leftEdge3 = document.getElementById('fcEdgeRippleLeft');
            var topEdge3 = document.getElementById('fcEdgeRippleTop');
            if (rightEdge3) rightEdge3.style.opacity = 0;
            if (leftEdge3) leftEdge3.style.opacity = 0;
            if (topEdge3) topEdge3.style.opacity = 0;
        }, 800);
    };

    window.quitFlashcardSession = function() {
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
        if (typeof window.renderGameLeaderboard === 'function') window.renderGameLeaderboard();
    };

    window.finishFlashcardSession = function() {
        document.body.classList.remove('in-game-active');
        var playScreen = document.getElementById('flashcard-play-screen');
        if (playScreen) playScreen.style.display = 'none';
        var resultScreen = document.getElementById('game-result-screen');
        if (resultScreen) resultScreen.style.display = 'block';
        var totalQ = typeof flashcardCurrentIndex !== 'undefined' ? flashcardCurrentIndex : 0;
        var accuracy = totalQ > 0 ? Math.round((flashcardLearnedCount / totalQ) * 100) : 0;
        var resScore = document.getElementById('resScore');
        var resAccuracy = document.getElementById('resAccuracy');
        var resLblScore = document.getElementById('resLblScore');
        if (resLblScore) resLblScore.innerText = "学習カード数";
        if (resScore) resScore.innerText = totalQ;
        if (resAccuracy) resAccuracy.innerText = accuracy + '%';
        var resBest = document.getElementById('resBoxBest');
        var resHigh = document.getElementById('resBoxHigh');
        if (resBest) resBest.style.display = 'none';
        if (resHigh) resHigh.style.display = 'none';
        var histTitle = document.querySelector('#game-result-screen h3.cosmic-list-title');
        if (histTitle) histTitle.style.display = 'none';
        var histContainer = document.getElementById('gameHistoryListContainer');
        if (histContainer) histContainer.style.display = 'none';
        ['fcEdgeRippleRight', 'fcEdgeRippleLeft', 'fcEdgeRippleTop'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.remove();
        });
        if (typeof window.renderGameLeaderboard === 'function') window.renderGameLeaderboard();
        if (typeof window.saveVocabToStorage === 'function') window.saveVocabToStorage();
    };
    window.quitFlashcardSession = window.finishFlashcardSession;

    // ================================================================
    // 2. ソロゲーム（単語の試練）
    // ================================================================

    window.showModeSelectScreen = function() {
        var startScreen = document.getElementById('game-start-screen');
        var lbArea = document.getElementById('gameLeaderboardArea');
        var modeSelectScreen = document.getElementById('game-mode-select-screen');
        if (startScreen) startScreen.style.display = 'none';
        if (lbArea) lbArea.style.display = 'none';
        if (modeSelectScreen) modeSelectScreen.style.display = 'block';
    };

    window.goToDifficultySelect = function(mode) {
        selectedQuestionMode = mode;
        document.getElementById('game-mode-select-screen').style.display = 'none';
        document.getElementById('game-difficulty-select-screen').style.display = 'block';
    };

    window.backToGameMenu = function() {
        document.body.classList.remove('in-game-active');
        ['game-mode-select-screen', 'game-difficulty-select-screen', 'game-play-screen', 'game-result-screen', 'flashcard-setup-screen', 'flashcard-play-screen'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        var startScreen = document.getElementById('game-start-screen');
        if (startScreen) startScreen.style.display = 'flex';
        var lbArea = document.getElementById('gameLeaderboardArea');
        if (lbArea) lbArea.style.display = 'flex';
    };

    window.backToModeSelect = function() {
        document.getElementById('game-difficulty-select-screen').style.display = 'none';
        document.getElementById('game-mode-select-screen').style.display = 'block';
    };

    window.startActualGame = function(difficulty) {
        currentGameDifficulty = difficulty;
        document.getElementById('game-difficulty-select-screen').style.display = 'none';
        document.getElementById('game-play-screen').style.display = 'block';
        document.body.classList.add('in-game-active');

        gameScoreCount = 0;
        gameMistakeCount = 0;
        gameComboCount = 0;
        document.getElementById('gameScoreNum').innerText = "0000";

        if (difficulty === 'normal') { gameRemainingTime = 180; document.getElementById('gameTimerNum').innerText = gameRemainingTime; }
        else if (difficulty === 'hard') { gameRemainingTime = 420; document.getElementById('gameTimerNum').innerText = gameRemainingTime; }
        else if (difficulty === 'expert') { gameRemainingTime = 900; document.getElementById('gameTimerNum').innerText = gameRemainingTime; }
        else { gameRemainingTime = 9999; document.getElementById('gameTimerNum').innerText = "❤️×5"; }

        gameCurrentWordsQueue = [];
        if (typeof vocabList !== 'undefined') {
            vocabList.forEach(function(w) {
                if (w.meanings && w.meanings.length > 0) {
                    gameCurrentWordsQueue.push({
                        wordNum: w.num,
                        word: w.word,
                        meaning: typeof window.formatWordForDisplay === 'function' ? window.formatWordForDisplay(w.meanings[0].text) : w.meanings[0].text
                    });
                }
            });
        }
        if (gameCurrentWordsQueue.length === 0) {
            alert("学習用単語が存在しません。");
            window.backToGameMenu();
            return;
        }
        gameCurrentWordsQueue.sort(function() { return Math.random() - 0.5; });
        gameCurrentIndex = 0;
        gameHistoryLog = [];
        isGameProcessingAnswer = false;
        clearInterval(gameTimerInterval);
        gameTimerInterval = setInterval(function() {
            if (difficulty !== 'endless') {
                gameRemainingTime--;
                document.getElementById('gameTimerNum').innerText = gameRemainingTime;
                if (gameRemainingTime <= 0) { window.endGameSession(); }
            } else {
                var remainingHearts = Math.max(0, 5 - gameMistakeCount);
                document.getElementById('gameTimerNum').innerText = "❤️×" + remainingHearts;
            }
        }, 1000);
        window.showNextGameQuestion();
    };

    window.showNextGameQuestion = function() {
        if (gameCurrentIndex >= gameCurrentWordsQueue.length) {
            gameCurrentWordsQueue.sort(function() { return Math.random() - 0.5; });
            gameCurrentIndex = 0;
        }
        var currentQ = gameCurrentWordsQueue[gameCurrentIndex];
        var type = selectedQuestionMode;
        if (type === 'mixed') type = Math.random() < 0.5 ? 'ja2en' : 'en2ja';
        currentQuestionType = type;
        var targetDisplay = document.getElementById('gameWordTarget');
        if (type === 'ja2en') { targetDisplay.innerText = currentQ.meaning; }
        else { targetDisplay.innerText = currentQ.word; }
        var inputEl = document.getElementById('gameAnswerInput');
        inputEl.value = "";
        inputEl.focus();
        document.getElementById('giantJudgmentOverlay').classList.remove('show');
        document.getElementById('feedbackContent').style.display = 'none';
        document.getElementById('gameNextBtn').style.display = 'none';
        isGameProcessingAnswer = false;
    };

    window.submitGameAnswer = function() {
        if (isGameProcessingAnswer) return;
        if (document.getElementById('feedbackContent').style.display === 'block') return;
        var inputEl = document.getElementById('gameAnswerInput');
        var userAns = inputEl.value.trim();
        if (!userAns) return;
        isGameProcessingAnswer = true;
        var currentQ = gameCurrentWordsQueue[gameCurrentIndex];
        var correctTarget = currentQuestionType === 'ja2en' ? currentQ.word : currentQ.meaning;
        var isDirectMatch = userAns.toLowerCase() === correctTarget.toLowerCase();
        if (isDirectMatch) {
            window.processJudgmentResult("OK", correctTarget, userAns);
        } else {
            document.getElementById('gameJudgingIndicator').style.display = 'flex';
            if (typeof window.callGeminiGameJudge === 'function') {
                window.callGeminiGameJudge(document.getElementById('gameWordTarget').innerText, correctTarget, userAns, currentQuestionType)
                    .then(function(result) {
                        document.getElementById('gameJudgingIndicator').style.display = 'none';
                        window.processJudgmentResult(result.status, correctTarget, userAns, result.alternatives);
                    })
                    .catch(function() {
                        document.getElementById('gameJudgingIndicator').style.display = 'none';
                        window.processJudgmentResult("NG", correctTarget, userAns);
                    });
            } else {
                document.getElementById('gameJudgingIndicator').style.display = 'none';
                window.processJudgmentResult("NG", correctTarget, userAns);
            }
        }
    };

    window.skipGameWordWithPass = function() {
        if (isGameProcessingAnswer) return;
        if (document.getElementById('feedbackContent').style.display === 'block') return;
        isGameProcessingAnswer = true;
        var currentQ = gameCurrentWordsQueue[gameCurrentIndex];
        var correctTarget = currentQuestionType === 'ja2en' ? currentQ.word : currentQ.meaning;
        window.processJudgmentResult("NG", correctTarget, "（パス）", "", true);
    };

    // これはグローバル関数として定義されているので、window 経由で公開
    window.processJudgmentResult = function(status, correctTarget, userAns, alternatives, isPass) {
        var overlay = document.getElementById('giantJudgmentOverlay');
        var mark = document.getElementById('giantJudgmentMark');
        var txt = document.getElementById('giantJudgmentText');
        var scorePopup = document.getElementById('giantScorePopup');
        overlay.className = "giant-judgment-overlay";
        scorePopup.className = "giant-score-popup";
        var addedPoints = 0;
        var isCorrect = status === 'OK' || status === 'SO';
        var earnedExpThisTurn = 2;
        if (isCorrect) {
            if (status === 'OK') {
                overlay.classList.add('correct');
                mark.innerText = "◎";
                txt.innerText = "正解！";
                gameComboCount++;
                addedPoints = 100 + Math.min(gameComboCount * 10, 200);
                gameScoreCount += addedPoints;
                scorePopup.innerText = "+" + addedPoints;
                scorePopup.classList.add('score-anim-plus');
            } else if (status === 'SO') {
                overlay.classList.add('correct');
                mark.innerText = "○";
                txt.innerText = "おまけ正解！";
                gameComboCount++;
                addedPoints = 50;
                gameScoreCount += addedPoints;
                scorePopup.innerText = "+" + addedPoints;
                scorePopup.classList.add('score-anim-plus');
            }
            earnedExpThisTurn += 1;
            if (gameComboCount > (typeof userStats !== 'undefined' ? userStats.combo_max : 0)) {
                if (typeof userStats !== 'undefined') userStats.combo_max = gameComboCount;
            }
        } else {
            overlay.classList.add('incorrect');
            mark.innerText = "✕";
            txt.innerText = "不正解...";
            gameComboCount = 0;
            gameMistakeCount++;
            scorePopup.innerText = "MISS";
            scorePopup.classList.add('score-anim-minus');
            if (typeof userStats !== 'undefined') userStats.mistake_count = (userStats.mistake_count || 0) + 1;
            if (currentGameDifficulty === 'endless') {
                var remainingHearts = Math.max(0, 5 - gameMistakeCount);
                document.getElementById('gameTimerNum').innerText = "❤️×" + remainingHearts;
            }
        }
        if (typeof totalExp !== 'undefined') totalExp += earnedExpThisTurn;
        document.getElementById('gameScoreNum').innerText = String(gameScoreCount).padStart(4, '0');
        var comboContainer = document.getElementById('persistentComboContainer');
        if (gameComboCount >= 2) {
            comboContainer.style.display = 'flex';
            document.getElementById('persistentComboText').innerText = gameComboCount + " COMBO!";
        } else {
            comboContainer.style.display = 'none';
        }
        if (!isPass) overlay.classList.add('show');
        document.getElementById('feedbackUserAns').innerText = userAns;
        document.getElementById('feedbackCorrectAns').innerText = correctTarget;
        if (alternatives) {
            document.getElementById('feedbackDiffAnswersRow').style.display = 'block';
            document.getElementById('feedbackOtherAns').innerText = alternatives;
        } else {
            document.getElementById('feedbackDiffAnswersRow').style.display = 'none';
        }
        gameHistoryLog.push({
            question: document.getElementById('gameWordTarget').innerText,
            userAns: userAns,
            correctAns: correctTarget,
            status: status
        });
        var currentQ = gameCurrentWordsQueue[gameCurrentIndex];
        if (currentQ && typeof vocabList !== 'undefined') {
            var targetVocab = vocabList.find(function(w) { return String(w.num) === String(currentQ.wordNum); });
            if (targetVocab) {
                var wordStatus = isCorrect ? 'ok' : 'bad';
                if (targetVocab.meanings && targetVocab.meanings.length > 0) {
                    targetVocab.meanings[0].status = wordStatus;
                    if (!targetVocab.meanings[0].history) targetVocab.meanings[0].history = [];
                    targetVocab.meanings[0].history.push(wordStatus);
                }
                targetVocab.status = wordStatus;
                if (!targetVocab.history) targetVocab.history = [];
                targetVocab.history.push(wordStatus);
                if (typeof window.saveVocabToStorage === 'function') window.saveVocabToStorage();
            }
        }
        if (typeof window.saveUserStats === 'function') window.saveUserStats();
        if (typeof window.checkAndRewardTitleBonusXP === 'function') window.checkAndRewardTitleBonusXP();
        if (typeof window.applyProfileToUi === 'function') window.applyProfileToUi();
        if (typeof window.renderLeaderboard === 'function') window.renderLeaderboard();

        var feedbackDelay = isPass ? 10 : 800;
        setTimeout(function() {
            if (currentGameDifficulty === 'endless' && gameMistakeCount >= 5) {
                window.endGameSession();
                return;
            }
            document.getElementById('feedbackContent').style.display = 'block';
            document.getElementById('gameNextBtn').style.display = 'block';
        }, feedbackDelay);
    };

    window.goToNextGameWord = function() {
        gameCurrentIndex++;
        window.showNextGameQuestion();
    };

    window.endGameSession = async function() {
        clearInterval(gameTimerInterval);
        document.getElementById('game-play-screen').style.display = 'none';
        document.getElementById('game-result-screen').style.display = 'block';
        document.body.classList.remove('in-game-active');

        document.getElementById('resScore').innerText = gameScoreCount;
        var totalQ = gameHistoryLog.length;
        var correctQ = gameHistoryLog.filter(function(h) { return h.status === 'OK' || h.status === 'SO'; }).length;
        var accuracy = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0;
        document.getElementById('resAccuracy').innerText = accuracy + '%';

        var keyBest = 'cosmic_best_' + selectedQuestionMode + '_' + currentGameDifficulty;
        var oldBest = parseInt(localStorage.getItem(keyBest) || "0");
        if (gameScoreCount > oldBest) {
            localStorage.setItem(keyBest, gameScoreCount);
            oldBest = gameScoreCount;
        }
        document.getElementById('resBestScore').innerText = oldBest;

        var logKey = 'cosmic_score_' + selectedQuestionMode + '_' + currentGameDifficulty;
        var history = JSON.parse(localStorage.getItem(logKey) || "[]");
        var now = new Date();
        var dateStr = (now.getMonth() + 1) + '/' + now.getDate() + ' ' + now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
        history.push({ score: gameScoreCount, date: dateStr });
        history.sort(function(a, b) { return b.score - a.score; });
        localStorage.setItem(logKey, JSON.stringify(history.slice(0, 5)));

        if (window.db && window.fbSetDoc && window.fbDoc && gameScoreCount > 0) {
            try {
                var scoresRef = window.fbDoc(window.db, "shared", "game_scores_" + selectedQuestionMode);
                var snap = await window.fbGetDoc(scoresRef);
                var remoteScores = snap.exists() && snap.data().scores ? snap.data().scores : [];
                remoteScores = remoteScores.filter(function(s) { return s.id !== myId; });
                remoteScores.push({ id: myId, name: myName, score: gameScoreCount, date: dateStr });
                remoteScores.sort(function(a, b) { return b.score - a.score; });
                await window.fbSetDoc(scoresRef, { scores: remoteScores.slice(0, 20) }, { merge: true });
            } catch (e) { console.error("Firebaseスコア同期エラー:", e); }
        }

        var container = document.getElementById('gameHistoryListContainer');
        container.innerHTML = "";
        gameHistoryLog.forEach(function(h) {
            var item = document.createElement('div');
            item.style.cssText = "display:flex; justify-content:space-between; padding:6px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:12px;";
            var mark = (h.status === 'OK' || h.status === 'SO') ? "⚪︎" : "✕";
            item.innerHTML = '<div><strong>' + h.question + '</strong> -> ' + h.userAns + '</div><div style="color:' + (mark === '⚪︎' ? 'var(--word-ok)' : 'var(--word-bad)') + '">' + mark + ' (正解: ' + h.correctAns + ')</div>';
            container.appendChild(item);
        });

        if (typeof userStats !== 'undefined') {
            if (gameComboCount > userStats.combo_max) userStats.combo_max = gameComboCount;
            userStats.test_count = (userStats.test_count || 0) + totalQ;
            if (gameScoreCount > (userStats.high_score || 0)) userStats.high_score = gameScoreCount;
            await window.saveUserStats();
            window.checkAndRewardTitleBonusXP();
        }
        window.applyProfileToUi();
        window.renderLeaderboard();
        window.renderGameLeaderboard();
    };

    // ================================================================
    // 3. ゲームランキング関連
    // ================================================================

    window.setLbMode = function(mode) {
        currentLbMode = mode;
        ['lbBtnModeJa', 'lbBtnModeEn', 'lbBtnModeMix'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) { el.style.background = 'rgba(7, 11, 25, 0.85)'; el.style.boxShadow = '0 0 12px rgba(0, 240, 255, 0.2)'; }
        });
        var targetId = mode === 'ja2en' ? 'lbBtnModeJa' : mode === 'en2ja' ? 'lbBtnModeEn' : 'lbBtnModeMix';
        var targetEl = document.getElementById(targetId);
        if (targetEl) {
            targetEl.style.background = 'linear-gradient(135deg, rgba(0, 240, 255, 0.4) 0%, rgba(192, 132, 252, 0.4) 100%)';
            targetEl.style.boxShadow = '0 0 15px rgba(0, 240, 255, 0.6)';
        }
        window.renderGameLeaderboard();
    };

    window.setLbDiff = function(diff) {
        currentLbDiff = diff;
        ['lbBtnDiffNormal', 'lbBtnDiffHard', 'lbBtnDiffExpert', 'lbBtnDiffEndless'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) { el.style.background = 'rgba(7, 11, 25, 0.85)'; el.style.boxShadow = '0 0 12px rgba(0, 240, 255, 0.2)'; }
        });
        var targetId = diff === 'normal' ? 'lbBtnDiffNormal' : diff === 'hard' ? 'lbBtnDiffHard' : diff === 'expert' ? 'lbBtnDiffExpert' : diff === 'endless' ? 'lbBtnDiffEndless' : '';
        var targetEl = document.getElementById(targetId);
        if (targetEl) {
            targetEl.style.background = 'linear-gradient(135deg, rgba(0, 240, 255, 0.4) 0%, rgba(192, 132, 252, 0.4) 100%)';
            targetEl.style.boxShadow = '0 0 15px rgba(0, 240, 255, 0.6)';
        }
        window.renderGameLeaderboard();
    };

    window.renderGameLeaderboard = function() {
        var container = document.getElementById('leaderboardListContainer');
        if (!container) return;
        container.innerHTML = "";
        var keyHistory = 'cosmic_score_' + currentLbMode + '_endless';
        var history = JSON.parse(localStorage.getItem(keyHistory) || "[]");
        var myBestScoreCurrent = history.length > 0 ? history[0].score : 0;
        var gameRankings = [];
        if (myBestScoreCurrent > 0) {
            gameRankings.push({
                name: myName + ' (あなた)',
                score: myBestScoreCurrent,
                date: history.length > 0 ? history[0].date : "記録なし",
                isMe: true
            });
        }
        gameRankings.sort(function(a, b) { return b.score - a.score; });
        var rankColors = ["#FBBF24", "#94A3B8", "#D97706", "white", "white", "white"];
        gameRankings.forEach(function(record, index) {
            var row = document.createElement('div');
            var bgStyle = record.isMe ? "background: linear-gradient(135deg, rgba(192, 132, 252, 0.15) 0%, rgba(15, 23, 42, 0.6) 100%); border-left: 3px solid var(--cosmic-purple-light);" : "border-bottom:1px solid rgba(255,255,255,0.05);";
            row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:6px 8px; ' + bgStyle;
            row.innerHTML = '<div style="display:flex; gap:12px; align-items:center;"><span style="color:' + rankColors[index] + '; font-weight:900; font-size:14px; width:18px; text-align:center;">' + (index + 1) + '</span><span style="color:white; font-weight:800; letter-spacing:0.5px;">' + record.name + '</span></div><div style="text-align:right;"><span style="color:var(--cosmic-cyan); font-weight:900; font-family:monospace; font-size:13px; margin-right:8px;">' + record.score + ' <span style="font-size:8px; font-weight:normal; color:var(--text-sub);">PTS</span></span><span style="color:var(--text-sub); font-size:9px; display:block; margin-top:1px;">' + record.date + '</span></div>';
            container.appendChild(row);
        });
    };

    window.resetLeaderboard = function() {
        if (confirm("ランキング履歴を一括で削除しますか？")) {
            ['ja2en', 'en2ja', 'mixed'].forEach(function(m) {
                ['endless'].forEach(function(d) {
                    localStorage.removeItem('cosmic_score_' + m + '_' + d);
                });
            });
            window.renderGameLeaderboard();
        }
    };

    window.resetBestScore = function() {
        if (confirm("ベストスコアを0に戻しますか？")) {
            ['ja2en', 'en2ja', 'mixed'].forEach(function(m) {
                ['endless'].forEach(function(d) {
                    localStorage.removeItem('cosmic_best_' + m + '_' + d);
                });
            });
        }
    };

    window.resetScorePopup = function(popupEl) {
        popupEl.className = "giant-score-popup";
        void popupEl.offsetWidth;
    };

    console.log('🎮 game_core.js 読み込み完了');
})();