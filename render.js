// ================================================================
// reader.js —— 長文リーダー・本棚・勉強時間グラフ関連（完全版）
// 読み込み順: app.js → game_core.js → vocab_ui.js → reader.js
// ================================================================
(function() {
    "use strict";

    // ================================================================
    // 1. 勉強時間グラフ・タイマー
    // ================================================================

    window.__updateStudyTimeDisplay = function() {
        var minStr = String(Math.floor(todayStudySeconds / 60)).padStart(2, '0');
        var secStr = String(todayStudySeconds % 60).padStart(2, '0');
        var el = document.getElementById('todayStudyTimeDisplay');
        if (el) el.innerText = minStr + '分' + secStr + '秒';
    };

    window.renderActivityChart = function() {
        var chart = document.getElementById('activityBarChart');
        if (!chart) return;
        chart.innerHTML = "";
        var now = new Date();
        var currentDayIdx = now.getDay() - 1;
        if (currentDayIdx < 0) currentDayIdx = 6;
        var currentTodayMinutes = todayStudySeconds / 60;
        weeklyStudyMinutesLog[currentDayIdx] = currentTodayMinutes;
        var daysLabels = ["月", "火", "水", "木", "金", "土", "日"];
        daysLabels.forEach(function(d, idx) {
            var wrap = document.createElement('div');
            wrap.className = "bar-wrapper";
            wrap.style.cssText = "display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; flex: 1; min-width: 0;";
            var rawMin = weeklyStudyMinutesLog[idx] || 0;
            var fillHeightPercent = Math.min(100, Math.max(4, Math.round((rawMin / 60) * 100)));
            var fill = document.createElement('div');
            fill.className = "bar-fill active";
            fill.style.height = fillHeightPercent + "%";
            var valLbl = document.createElement('div');
            valLbl.style.cssText = "font-size: 8px; font-weight: 700; color: #FFFFFF; margin-bottom: 2px; white-space: nowrap;";
            valLbl.innerText = Math.floor(rawMin) + "分";
            var lbl = document.createElement('div');
            lbl.style.cssText = "font-size: 10px; color: var(--text-sub); margin-top: 4px; font-weight: bold;";
            lbl.innerText = d;
            wrap.appendChild(valLbl);
            wrap.appendChild(fill);
            wrap.appendChild(lbl);
            chart.appendChild(wrap);
        });
    };

    window.initStudyTimerAndDataRotation = function() {
        if (window.__studyTimerIntervalId) {
            clearInterval(window.__studyTimerIntervalId);
            window.__studyTimerIntervalId = null;
        }
        var now = new Date();
        var todayStr = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
        if (lastAccessDateStr && lastAccessDateStr !== todayStr) {
            var oldDate = new Date(lastAccessDateStr);
            var oldDayIdx = oldDate.getDay() - 1;
            if (oldDayIdx < 0) oldDayIdx = 6;
            weeklyStudyMinutesLog[oldDayIdx] = todayStudySeconds / 60;
            localStorage.setItem('core_v4_study_weekly_log', JSON.stringify(weeklyStudyMinutesLog));
            todayStudySeconds = 0;
            localStorage.setItem('core_v4_study_today_secs', "0");
        }
        lastAccessDateStr = todayStr;
        localStorage.setItem('core_v4_study_last_date', todayStr);
        var localTotal = parseInt(localStorage.getItem('core_v4_study_total_secs') || '0');
        if (typeof userStats.study_total_secs === 'undefined' || userStats.study_total_secs === null || localTotal > userStats.study_total_secs) {
            userStats.study_total_secs = localTotal;
        }
        window.__studyTimerIntervalId = setInterval(function() {
            var shouldCount = false;
            if (currentActiveTabId === "vocab" || currentActiveTabId === "reader") {
                shouldCount = true;
            } else if (currentActiveTabId === "game") {
                var isFcardPlay = (document.getElementById('flashcard-play-screen') && document.getElementById('flashcard-play-screen').style.display === 'flex');
                var isSoloPlay = (document.getElementById('game-play-screen') && document.getElementById('game-play-screen').style.display === 'block');
                var isMultiPlay = (document.getElementById('multi-battle-play-screen') && document.getElementById('multi-battle-play-screen').style.display === 'flex');
                if (isFcardPlay || isSoloPlay || isMultiPlay) shouldCount = true;
            }
            if (window.__loadQuiz && window.__loadQuiz.active) shouldCount = true;
            if (shouldCount) {
                todayStudySeconds++;
                userStats.study_total_secs = (userStats.study_total_secs || 0) + 1;
                localStorage.setItem('core_v4_study_today_secs', String(todayStudySeconds));
                localStorage.setItem('core_v4_study_total_secs', String(userStats.study_total_secs));
                var currentMin = Math.floor(todayStudySeconds / 60);
                if (currentMin > userStats.study_burst) {
                    userStats.study_burst = currentMin;
                    window.saveUserStats();
                    window.checkAndRewardTitleBonusXP();
                }
                if (todayStudySeconds % 10 === 0) {
                    var d = new Date();
                    var dayIdx = d.getDay() - 1; if (dayIdx < 0) dayIdx = 6;
                    weeklyStudyMinutesLog[dayIdx] = todayStudySeconds / 60;
                    localStorage.setItem('core_v4_study_weekly_log', JSON.stringify(weeklyStudyMinutesLog));
                }
                if (todayStudySeconds % 60 === 0) {
                    try { window.saveUserStats(); } catch (e) {}
                }
            }
            window.__updateStudyTimeDisplay();
            if (shouldCount) window.renderActivityChart();
        }, 1000);
        window.__updateStudyTimeDisplay();
        window.renderActivityChart();
    };

    // ================================================================
    // 2. 長文リーダー本体
    // ================================================================

    window.startAnalysisWithEmbeddedTitle = function() {
        var textareaEl = document.getElementById('englishTextarea');
        if (!textareaEl) return;
        var rawText = textareaEl.value.trim();
        if (!rawText) {
            alert("英文を入力してください");
            return;
        }
        var titleInputEl = document.getElementById('customTextTitle');
        var assignedTitle = titleInputEl ? titleInputEl.value.trim() : "";
        if (!assignedTitle) {
            var now = new Date();
            var yyyy = now.getFullYear();
            var mm = String(now.getMonth() + 1).padStart(2, '0');
            var dd = String(now.getDate()).padStart(2, '0');
            var hh = String(now.getHours()).padStart(2, '0');
            var min = String(now.getMinutes()).padStart(2, '0');
            var ss = String(now.getSeconds()).padStart(2, '0');
            assignedTitle = yyyy + '/' + mm + '/' + dd + ' ' + hh + ':' + min + ':' + ss;
        }
        totalExp += 5;
        userStats.reader_open++;
        window.saveUserStats();
        window.checkAndRewardTitleBonusXP();
        window.applyProfileToUi();
        window.renderLeaderboard();
        window.analyzeText(rawText, assignedTitle);
    };

    window.callGeminiAnalyzer = async function(text) {
        if (!geminiApiKey) {
            alert("【デバッグ情報】\nAPIキーが設定されていないため、AI通信をスキップしました。");
            return null;
        }
        try {
            var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + geminiApiKey;
            var prompt = "以下の英文をパースし、指定 of JSONスキーマ形式のみで返答してください。\n\n英文:\n " + text + "\n\n出力JSON形式:\n{\n   \"fullSummaryAbstract\": \"英文全体のシンプルな日本語要約(3文以内)\",\n   \"sentences\": [\n    {\n       \"text\": \"元の英語の1文\",\n       \"translation\": \"その文の正確な日本語訳\",\n       \"grammarHighlights\": [\n        {\n           \"phrase\": \"フレーズ\",\n           \"meaning\": \"意味\"\n        }\n      ]\n    }\n  ]\n}";
            var response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            if (!response.ok) {
                var errorData = await response.text();
                console.error("Gemini API Error details:", errorData);
                return null;
            }
            var data = await response.json();
            var responseText = data.candidates[0].content.parts[0].text.trim();
            var cleanJsonText = responseText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
            return JSON.parse(cleanJsonText);
        } catch (e) {
            console.error("Gemini Analyzer Error:", e);
            return null;
        }
    };

    window.analyzeText = async function(rawText, assignedTitle, preParsedData) {
        if (!rawText) return;
        currentActiveReaderText = rawText;
        currentActiveTitle = assignedTitle || "無題のテキスト";
        var customJaEl = document.getElementById('customJapanesetextarea');
        var customJaLines = customJaEl ? customJaEl.value.trim().split('\n').filter(function(l) { return l.trim() !== ''; }) : [];
        textHistory = textHistory.filter(function(h) { return h.text !== rawText; });
        textHistory.unshift({ id: Date.now(), title: currentActiveTitle, text: rawText });
        localStorage.setItem('textHistory', JSON.stringify(textHistory));
        window.renderHistoryList();
        document.getElementById('text-input-view').style.display = 'none';
        document.getElementById('text-reader-view').style.display = 'block';
        var englishContainer = document.getElementById('englishContainer');
        englishContainer.innerHTML = '<div style="text-align:center; padding: 60px 20px; color: var(--cosmic-cyan); font-weight: bold; font-size: 16px; display:flex; flex-direction:column; align-items:center;"><i data-lucide="loader" class="animate-spin" size="36" style="margin-bottom:16px;"></i><span>🌀 AI構文解析・全文要約取得中...</span></div>';
        var abstractCard = document.getElementById('summary-abstract-card');
        var abstractContainer = document.getElementById('summaryAbstractContainer');
        if (abstractCard) abstractCard.style.display = 'none';
        if (abstractContainer) abstractContainer.innerText = "要約データを生成しています...";
        window.initLucide();
        var aiAnalysisResult = null;
        if (preParsedData) {
            aiAnalysisResult = preParsedData;
        } else {
            aiAnalysisResult = geminiApiKey ? await window.callGeminiAnalyzer(rawText) : null;
        }
        if (geminiApiKey && !aiAnalysisResult) {
            window.closeReader();
            return;
        }
        currentActiveAiAnalysisCache = aiAnalysisResult;
        var safeTextForBtn = rawText.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
        var safeTitleForBtn = currentActiveTitle ? currentActiveTitle.replace(/'/g, "\\'").replace(/"/g, "&quot;") : "無題";
        document.getElementById('readerCurrentTitle').innerHTML =
            '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; width:100%;">' +
            '<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; max-width:260px;">📖 ' + currentActiveTitle + '</span>' +
            '<button style="padding:6px 12px; font-size:11px; font-weight:bold; border-radius:6px; background:rgba(255,255,255,0.1); color:#E2E8F0; border:1px solid rgba(255,255,255,0.3); cursor:pointer; white-space:nowrap; transition:all 0.2s;" onclick="window.showCustomSaveBookshelfPrompt(\`' + safeTextForBtn + '\`, \'' + safeTitleForBtn + '\')">' +
            '<i data-lucide="folder-plus" size="12" style="vertical-align:middle; margin-right:2px;"></i> 本棚に保存する' +
            '</button></div>';
        window.initLucide();
        englishContainer.innerHTML = '';
        var totalSummaryJa = "";
        var fallbackSentences = rawText.replace(/\n/g, ' ').match(/[^.?!]+[.?!]+|[^.?!]+$/g) || [rawText];
        var sentencesData = (aiAnalysisResult && aiAnalysisResult.sentences) ? aiAnalysisResult.sentences : fallbackSentences.map(function(s) { return { text: s.trim(), translations: "（和訳未取得）", grammarHighlights: [] }; });
        if (aiAnalysisResult && aiAnalysisResult.fullSummaryAbstract) {
            if (abstractContainer) abstractContainer.innerText = aiAnalysisResult.fullSummaryAbstract;
            if (abstractCard) abstractCard.style.display = 'block';
        }
        sentencesData.forEach(function(sData, sIdx) {
            var sentenceText = sData.text || "";
            if (!sentenceText.trim()) return;
            var block = document.createElement('div');
            block.className = 'sentence-container';
            var mainContent = document.createElement('div');
            mainContent.style.flex = "1";
            mainContent.innerHTML = '<span class="sentence-num">' + (sIdx + 1) + '</span>';
            var highlights = sData.grammarHighlights || [];
            highlights.sort(function(a, b) { return b.phrase.length - a.phrase.length; });
            var textMarker = sentenceText;
            var phraseMap = {};
            highlights.forEach(function(h, hIdx) {
                var pKey = '___GRAMMAR_' + hIdx + '___';
                var regex = new RegExp(h.phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
                if (textMarker.match(regex)) {
                    textMarker = textMarker.replace(regex, pKey);
                    phraseMap[pKey] = h;
                }
            });
            textMarker.split(' ').forEach(function(wStr) {
                if (!wStr) return;
                var cleanToken = wStr.trim();
                var isGrammar = false,
                    grammarData = null;
                for (var key in phraseMap) {
                    if (cleanToken.indexOf(key) !== -1) {
                        isGrammar = true;
                        grammarData = phraseMap[key];
                        wStr = wStr.replace(key, grammarData.phrase);
                        break;
                    }
                }
                var wordContainer = mainContent;
                if (isGrammar && grammarData) {
                    var gSpan = document.createElement('span');
                    gSpan.className = 'grammar-span';
                    gSpan.onclick = function(e) {
                        if (e.target.classList.contains('word-span')) return;
                        window.openGrammarPopover(e, grammarData.phrase, grammarData.meaning);
                    };
                    mainContent.appendChild(gSpan);
                    wordContainer = gSpan;
                }
                var subTokens = isGrammar ? wStr.split(' ') : [wStr];
                subTokens.forEach(function(subToken, index) {
                    if (!subToken) return;
                    var cleanKey = subToken.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]\"']/g, "");
                    var span = document.createElement('span');
                    span.className = 'word-span';
                    span.innerText = subToken + (index < subTokens.length - 1 ? ' ' : (isGrammar ? ' ' : ' '));
                    var vocabMatch = window.findVocabByToken(cleanKey);
                    if (vocabMatch) {
                        span.classList.add('registered');
                        var hasOk = false,
                            hasBad = false,
                            hasSo = false,
                            hasAnyHistory = false;
                        vocabMatch.meanings.forEach(function(m) {
                            if (m.history && m.history.length > 0) hasAnyHistory = true;
                            if (m.status === 'ok') hasOk = true;
                            if (m.status === 'so') hasSo = true;
                            if (m.status === 'bad') hasBad = true;
                        });
                        if (!hasAnyHistory) span.classList.add('status-none');
                        else if (hasBad) span.classList.add('status-bad');
                        else if (hasSo) span.classList.add('status-so');
                        else if (hasOk) span.classList.add('status-ok');
                        span.onclick = function(e) {
                            window.openWordPopoverFromVocab(e, vocabMatch, subToken);
                        };
                    } else {
                        var dictMatch = dictionaryData.find(function(d) { return d.en === cleanKey; });
                        if (dictMatch) {
                            span.classList.add('registered');
                            span.classList.add(wordMemory[cleanKey] ? 'status-' + wordMemory[cleanKey] : 'status-none');
                            span.onclick = function(e) {
                                window.openWordPopover(e, cleanKey, subToken);
                            };
                        }
                    }
                    wordContainer.appendChild(span);
                });
            });
            var finalJaText = customJaLines[sIdx] || sData.translation || sData.translations || "（和訳未取得）";
            totalSummaryJa += (sIdx + 1) + '. ' + finalJaText + '<br>';
            var jaSpan = document.createElement('span');
            jaSpan.className = 'sentence-ja';
            jaSpan.innerText = finalJaText;
            mainContent.appendChild(jaSpan);
            block.appendChild(mainContent);
            englishContainer.appendChild(block);
        });
        document.getElementById('summaryJaContainer').innerHTML = totalSummaryJa;
        window.setTranslationMode(currentTranslationMode);
        window.initLucide();
    };

    window.openWordPopover = function(event, cleanKey, originalText) {
        if (event) event.stopPropagation();
        currentTargetWordToken = cleanKey;
        currentTargetVocabNum = null;
        var match = dictionaryData.find(function(d) { return d.en === cleanKey; });
        document.getElementById('popWord').innerText = originalText;
        document.getElementById('popWordNum').innerText = "";
        document.getElementById('popMeaning').innerText = match ? match.ja : '未登録';
        document.getElementById('popoverStatusBtns').style.display = "flex";
        var pop = document.getElementById('wordPopover');
        pop.style.display = 'flex';
        pop.classList.add('show');
    };

    window.setWordStatusFromReader = function(status) {
        if (currentTargetWordToken && !currentTargetVocabNum) {
            wordMemory[currentTargetWordToken] = status;
            localStorage.setItem('wordMemory', JSON.stringify(wordMemory));
            totalExp += 1;
            window.saveUserStats();
            window.updateReaderWordColors();
        }
        window.checkAndRewardTitleBonusXP();
        window.applyProfileToUi();
        window.renderLeaderboard();
        window.closeWordPopover();
    };

    window.openGrammarPopover = function(event, phrase, meaning) {
        if (event) event.stopPropagation();
        currentTargetWordToken = null;
        currentTargetVocabNum = null;
        document.getElementById('popWord').innerText = phrase;
        document.getElementById('popWordNum').innerText = "💡 文法";
        document.getElementById('popMeaning').innerText = meaning;
        document.getElementById('popoverStatusBtns').style.display = "none";
        var pop = document.getElementById('wordPopover');
        pop.style.display = 'flex';
        pop.classList.add('show');
    };

    window.closeWordPopover = function() {
        document.getElementById('wordPopover').classList.remove('show');
        document.getElementById('wordPopover').style.display = 'none';
    };

    window.setTranslationMode = function(mode) {
        currentTranslationMode = mode;
        document.getElementById('toggle-inline').classList.toggle('active', mode === 'inline');
        document.getElementById('toggle-bottom').classList.toggle('active', mode === 'bottom');
        document.querySelectorAll('.sentence-ja').forEach(function(el) {
            el.style.display = mode === 'inline' ? 'block' : 'none';
        });
        document.getElementById('summary-ja-card').style.display = mode === 'bottom' ? 'block' : 'none';
        var abstractCard = document.getElementById('summary-abstract-card');
        if (abstractCard && document.getElementById('summaryAbstractContainer').innerText !== "要約データを生成しています...") {
            abstractCard.style.display = 'block';
        }
    };

    window.updateReaderWordColors = function() {
        document.querySelectorAll('.word-span').forEach(function(span) {
            var text = span.innerText.trim();
            var cleanKey = text.toLowerCase().replace(/[.,/#!$%^&*;:{}=-_`~()[]"']/g, "");
            if (!cleanKey) return;
            span.classList.remove('status-ok', 'status-so', 'status-bad', 'status-none');
            var vocabMatch = window.findVocabByToken(cleanKey);
            if (vocabMatch) {
                span.classList.add('registered');
                var hasOk = false,
                    hasBad = false,
                    hasSo = false,
                    hasAnyHistory = false;
                vocabMatch.meanings.forEach(function(m) {
                    if (m.history && m.history.length > 0) hasAnyHistory = true;
                    if (m.status === 'ok') hasOk = true;
                    if (m.status === 'so') hasSo = true;
                    if (m.status === 'bad') hasBad = true;
                });
                if (!hasAnyHistory) span.classList.add('status-none');
                else if (hasBad) span.classList.add('status-bad');
                else if (hasSo) span.classList.add('status-so');
                else if (hasOk) span.classList.add('status-ok');
            } else {
                var dictMatch = dictionaryData.find(function(d) { return d.en === cleanKey; });
                if (dictMatch) {
                    span.classList.add('registered');
                    span.classList.add(wordMemory[cleanKey] ? 'status-' + wordMemory[cleanKey] : 'status-none');
                }
            }
        });
    };

    window.closeReader = function() {
        document.getElementById('text-input-view').style.display = 'block';
        document.getElementById('text-reader-view').style.display = 'none';
        currentActiveAiAnalysisCache = null;
        var trainer = document.getElementById('readerVocabTrainerCard');
        if (trainer && trainer.parentNode) trainer.parentNode.removeChild(trainer);
    };

    // ================================================================
    // 3. 履歴・本棚
    // ================================================================

    window.renderHistoryList = function() {
        var container = document.getElementById('historyListContainer');
        if (!container) return;
        container.innerHTML = '';
        if (textHistory.length === 0) {
            container.innerHTML = '<div style="color:var(--text-sub); font-size:12px;">ログがありません</div>';
            return;
        }
        textHistory.forEach(function(h, idx) {
            var safeText = h.text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
            var safeTitle = h.title ? h.title.replace(/'/g, "\\'").replace(/"/g, "&quot;") : "無題";
            var row = document.createElement('div');
            row.className = 'list-item-row';
            row.innerHTML = '<div class="list-item-title"><span>' + h.title + '</span></div> <div style="display:flex; gap:8px;"> <button class="list-action-link" data-open-idx="' + idx + '">開く</button> <button class="word-delete-btn" style="display:flex !important; background:none; border:none; color:var(--text-sub); padding:4px; cursor:pointer;" onclick="event.stopPropagation(); event.preventDefault(); window.showCustomDeleteHistoryConfirm(\'' + h.id + '\')"><i data-lucide="trash-2" size="14"></i></button> </div>';
            container.appendChild(row);
        });
        // 開くボタンを安全なリスナで再バインド
        container.querySelectorAll('[data-open-idx]').forEach(function(btn) {
            btn.removeAttribute('onclick');
            btn.addEventListener('click', function(ev) {
                if (ev) ev.stopPropagation();
                var entry = textHistory[parseInt(btn.getAttribute('data-open-idx'), 10)];
                if (!entry) return;
                window.analyzeText(entry.text, entry.title || '無題');
            });
        });
        window.initLucide();
    };

    window.showCustomDeleteHistoryConfirm = function(idString) {
        textHistory = textHistory.filter(function(h) { return String(h.id) !== String(idString); });
        localStorage.setItem('textHistory', JSON.stringify(textHistory));
        window.renderHistoryList();
    };

    window.showCustomSaveBookshelfPrompt = function(text, title) {
        if (document.getElementById('saveBookshelfOverlay')) return;
        var overlay = document.createElement('div');
        overlay.id = 'saveBookshelfOverlay';
        overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);";
        var box = document.createElement('div');
        box.style.cssText = "background:var(--card-bg); border:1px solid var(--cosmic-cyan); border-radius:16px; padding:24px; width:85%; max-width:320px; text-align:center; box-shadow: 0 10px 30px rgba(0,0,0,0.6);";
        var optionsHtml = '';
        if (typeof bookshelfBooks !== 'undefined' && bookshelfBooks.length > 0) {
            bookshelfBooks.forEach(function(b) {
                optionsHtml += '<option value="' + b.id + '">📖 ' + b.name + '</option>';
            });
        }
        optionsHtml += '<option value="">🗂️ 未分類</option>';
        box.innerHTML = '<div style="color:white; font-size:18px; font-weight:800; margin-bottom:12px;">📚 本棚に保存</div>' +
            '<div style="font-size:11px;color:var(--text-sub);margin-bottom:8px;text-align:left;">保存先の教材を選択</div>' +
            '<select id="selectBookshelfBook" class="search-input" style="width:100%;margin-bottom:16px;">' + optionsHtml + '</select>' +
            '<div style="display:flex;gap:12px;">' +
            '<button style="flex:1;padding:12px;border-radius:10px;border:none;background:var(--input-bg);color:var(--text-main);font-weight:700;cursor:pointer;" id="cancelSaveBookshelfBtn">キャンセル</button>' +
            '<button style="flex:1;padding:12px;border-radius:10px;border:none;background:var(--cosmic-cyan);color:#000;font-weight:700;cursor:pointer;" id="confirmSaveBookshelfBtn">保存</button>' +
            '</div>';
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        document.getElementById('cancelSaveBookshelfBtn').onclick = function() { document.body.removeChild(overlay); };
        document.getElementById('confirmSaveBookshelfBtn').onclick = function() {
            var selVal = document.getElementById('selectBookshelfBook').value;
            var bookId = selVal || null;
            var dup = myBookshelf.some(function(item) {
                return item.text === text && String(item.bookId || '') === String(bookId || '');
            });
            if (dup) { alert("すでに保存されています！"); document.body.removeChild(overlay); return; }
            myBookshelf.push({
                id: Date.now(),
                bookId: bookId,
                title: title || "無題",
                text: text,
                aiAnalysisData: currentActiveAiAnalysisCache ? JSON.parse(JSON.stringify(currentActiveAiAnalysisCache)) : null
            });
            localStorage.setItem('myBookshelf', JSON.stringify(myBookshelf));
            alert("保存しました！");
            window.renderBookshelf();
            document.body.removeChild(overlay);
        };
    };

    window.renderBookshelf = function() {
        var container = document.getElementById('myBookshelfContainer');
        if (!container) return;
        container.innerHTML = "";
        if (myBookshelf.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:var(--text-sub); font-size:12px; padding:20px;">本棚は空です。</div>';
            return;
        }
        var foldersData = {};
        myBookshelf.forEach(function(item) {
            if (!foldersData[item.folder]) foldersData[item.folder] = [];
            foldersData[item.folder].push(item);
        });
        for (var folderName in foldersData) {
            var folderHtml = '<div style="margin-bottom:20px; background:rgba(0,0,0,0.2); border-radius:12px; padding:12px; border:1px solid rgba(255,255,255,0.15);"> <h3 style="color:var(--cosmic-cyan); font-size:15px; border-bottom:1px dashed rgba(0,240,255,0.3); padding-bottom:6px; margin-top:0; margin-bottom:12px; display:flex; align-items:center; gap:6px;"><i data-lucide="folder" size="16"></i> ' + folderName + '</h3>';
            foldersData[folderName].forEach(function(item) {
                var safeText = item.text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
                var safeTitle = item.title ? item.title.replace(/'/g, "\\'").replace(/"/g, "&quot;") : "無題";
                var itemIndex = myBookshelf.findIndex(function(b) { return b.id === item.id; });
                var parseCallParam = item.aiAnalysisData ? 'myBookshelf[' + itemIndex + '].aiAnalysisData' : 'null';
                folderHtml +=
                    '<div class="list-item-row" style="background:rgba(255,255,255,0.05); padding:10px 14px; border-radius:8px; margin-bottom:8px;">' +
                    '<div class="list-item-title" style="flex:1;"><span><i data-lucide="file-text" size="12" style="color:var(--text-sub); margin-right:4px;"></i>' + item.title + '</span></div>' +
                    '<div style="display:flex; gap:8px;">' +
                    '<button class="list-action-link" onclick="window.analyzeText(\`' + safeText + '\`, \'' + safeTitle + '\', ' + parseCallParam + ')">開く</button>' +
                    '<button class="word-delete-btn" style="display:flex !important; background:none; border:none; color:#EF4444; padding:4px; cursor:pointer;" onclick="event.stopPropagation(); event.preventDefault(); window.showCustomDeleteBookshelfConfirm(\'' + item.id + '\')"><i data-lucide="trash-2" size="14"></i></button>' +
                    '</div></div>';
            });
            folderHtml += '</div>';
            container.innerHTML += folderHtml;
        }
        window.initLucide();
    };

    window.showCustomDeleteBookshelfConfirm = function(idString) {
        myBookshelf = myBookshelf.filter(function(item) { return String(item.id) !== String(idString); });
        localStorage.setItem('myBookshelf', JSON.stringify(myBookshelf));
        window.renderBookshelf();
    };

    console.log('📖 reader.js 読み込み完了');
})();