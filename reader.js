// ================================================================
// Long-form reader helpers
//
// app.js owns rendering, history, bookshelf, and study-time lifecycle.
// This file only supplies the reader actions that app.js and index.html
// call but do not define themselves. Keep it loaded after app.js.
// ================================================================
(function () {
    "use strict";

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
        // サイドバーに入力済みのキーを解析開始時にも反映する。
        // プロフィール保存処理の完了順に依存させない。
        var apiKeyInput = document.getElementById('sidebarApiKeyInput');
        var enteredApiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
        if (enteredApiKey) {
            geminiApiKey = enteredApiKey;
            localStorage.setItem('core_v4_geminiKey', enteredApiKey);
        }
        var submitButton = document.getElementById('analysisSubmitBtn');
        if (submitButton && submitButton.disabled) return;
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.dataset.originalHtml = submitButton.innerHTML;
            submitButton.textContent = "解析しています…";
        }
        totalExp += 5;
        userStats.reader_open++;
        window.saveUserStats();
        window.checkAndRewardTitleBonusXP();
        window.applyProfileToUi();
        window.renderLeaderboard();
        if (typeof window.analyzeText !== 'function') {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = submitButton.dataset.originalHtml || "英文解析";
            }
            alert("英文解析機能の読み込みに失敗しました。ページを再読み込みしてください。");
            return;
        }
        Promise.resolve(window.analyzeText(rawText, assignedTitle)).catch(function(error) {
            console.error("English analysis failed:", error);
            alert("英文解析に失敗しました。\n" + (error && error.message ? error.message : "通信状態とAPIキーを確認してください。"));
        }).finally(function() {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = submitButton.dataset.originalHtml || "英文解析";
                if (typeof window.initLucide === 'function') window.initLucide();
            }
        });
    };

    function buildAnalysisFallback(text, message) {
        var sentences = String(text || '').replace(/\n/g, ' ').match(/[^.?!]+[.?!]+|[^.?!]+$/g) || [String(text || '')];
        return {
            analysisError: true,
            fullSummaryAbstract: message,
            sentences: sentences.filter(function(sentence) { return sentence.trim(); }).map(function(sentence) {
                return { text: sentence.trim(), translation: "（AI和訳を取得できませんでした）", grammarHighlights: [] };
            })
        };
    }

    window.callGeminiAnalyzer = async function(text) {
        var input = document.getElementById('sidebarApiKeyInput');
        var apiKey = (input && input.value.trim()) || localStorage.getItem('core_v4_geminiKey') || (typeof geminiApiKey !== 'undefined' ? geminiApiKey : '');
        if (!apiKey) {
            alert("Gemini APIキーが設定されていません。左上メニューからAPIキーを設定してください。");
            return null;
        }
        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timeoutId = controller ? setTimeout(function() { controller.abort(); }, 45000) : null;
        try {
            var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(apiKey);
            var prompt = "以下の英文を解析し、指定したJSON形式だけを返してください。英文を省略しないでください。\n\n英文:\n" + text + "\n\nJSON形式:\n{\"fullSummaryAbstract\":\"英文全体の日本語要約（3文以内）\",\"sentences\":[{\"text\":\"元の英語の1文\",\"translation\":\"正確な日本語訳\",\"grammarHighlights\":[{\"phrase\":\"重要表現\",\"meaning\":\"日本語での文法説明\"}]}]}";
            var response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
                }),
                signal: controller ? controller.signal : undefined
            });
            if (!response.ok) {
                var errorData = await response.text();
                console.error("Gemini API Error details:", errorData);
                var apiMessage = "Gemini APIエラー（" + response.status + "）";
                try {
                    var parsedError = JSON.parse(errorData);
                    if (parsedError.error && parsedError.error.message) apiMessage += ": " + parsedError.error.message;
                } catch (ignore) {}
                alert(apiMessage);
                return buildAnalysisFallback(text, apiMessage);
            }
            var data = await response.json();
            var parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
            var responseText = parts && parts.map(function(part) { return part.text || ''; }).join('').trim();
            if (!responseText) throw new Error("Geminiから解析結果が返されませんでした");
            var cleanJsonText = responseText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
            var firstBrace = cleanJsonText.indexOf('{');
            var lastBrace = cleanJsonText.lastIndexOf('}');
            if (firstBrace >= 0 && lastBrace > firstBrace) cleanJsonText = cleanJsonText.slice(firstBrace, lastBrace + 1);
            var result = JSON.parse(cleanJsonText);
            if (!result || !Array.isArray(result.sentences) || !result.sentences.length) throw new Error("解析結果の文章データが空です");
            return result;
        } catch (e) {
            console.error("Gemini Analyzer Error:", e);
            var message = e && e.name === 'AbortError' ? "Gemini APIが45秒以内に応答しませんでした" : (e.message || "Gemini APIとの通信に失敗しました");
            alert(message);
            return buildAnalysisFallback(text, message);
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
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

    console.log('📖 reader helpers loaded');
})();
