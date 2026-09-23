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
