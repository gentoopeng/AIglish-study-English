// ================================================================
// Long-form reader helpers
//
// app.js owns rendering and the study-time lifecycle; reader-shelf.js draws the history and
// the bookshelf.
// This file only supplies the reader actions that app.js and index.html
// call but do not define themselves. Keep it loaded after app.js.
// ================================================================
(function () {
    "use strict";

    // The history list and the bookshelf are drawn by reader-shelf.js.

    // Under the English box: how many sentences and words it has, paste and clear.
    function countSentences(text) {
        return (String(text).replace(/\n/g, ' ').match(/[^.?!]+[.?!]+|[^.?!]+$/g) || []).filter(function(s) { return /[A-Za-z]/.test(s); }).length;
    }
    function updateInputCount() {
        var area = document.getElementById('englishTextarea'), count = document.getElementById('readerInputCount');
        if (!area || !count) return;
        var text = area.value.trim(), words = text ? (text.match(/[A-Za-z][A-Za-z'’-]*/g) || []).length : 0;
        count.textContent = countSentences(text) + '文・' + words + '語';
    }
    function bindReaderInput() {
        var area = document.getElementById('englishTextarea');
        if (!area || area.dataset.inputBound) return;
        area.dataset.inputBound = '1';
        area.addEventListener('input', updateInputCount);
        var paste = document.getElementById('readerPasteButton'), clear = document.getElementById('readerClearButton');
        if (paste) paste.onclick = async function() {
            try {
                var text = await navigator.clipboard.readText();
                if (!text.trim()) return window.showToast && window.showToast('クリップボードが空です。', 'info');
                area.value = text.trim();
                updateInputCount();
            } catch (e) {
                area.focus();
                if (window.showToast) window.showToast('貼り付けできませんでした。入力欄を長押しして貼り付けてください。', 'info');
            }
        };
        if (clear) clear.onclick = function() {
            area.value = '';
            var ja = document.getElementById('customJapanesetextarea'), title = document.getElementById('customTextTitle');
            if (ja) ja.value = '';
            if (title) title.value = '';
            updateInputCount();
            area.focus();
        };
        updateInputCount();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindReaderInput, { once: true });
    else bindReaderInput();

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

    // Reads a streamed (SSE) answer and returns its text; onText gets the text so far.
    async function readStream(response, onText, onChunk) {
        var buffer = '', out = '';
        function take(chunk, last) {
            buffer += chunk;
            var lines = buffer.split(/\r?\n/);
            buffer = last ? '' : lines.pop();
            lines.forEach(function(line) {
                if (line.indexOf('data:') !== 0) return;
                try {
                    var event = JSON.parse(line.slice(5).trim());
                    var parts = event && event.candidates && event.candidates[0] && event.candidates[0].content && event.candidates[0].content.parts;
                    (parts || []).forEach(function(part) { if (part.text && !part.thought) out += part.text; });
                } catch (ignore) {}
            });
            onText(out);
        }
        var reader = response.body && response.body.getReader ? response.body.getReader() : null;
        if (!reader) {
            take(await response.text(), true);
            return out;
        }
        var decoder = new TextDecoder();
        for (;;) {
            var step = await reader.read();
            if (step.done) break;
            onChunk();
            take(decoder.decode(step.value, { stream: true }), false);
        }
        take(decoder.decode(), true);
        return out;
    }

    // onProgress(percent, label): the analysis streams in, so the percent follows the sentences
    // translated so far; before the first one, it creeps up slowly while the AI reads.
    window.callGeminiAnalyzer = async function(text, onProgress) {
        var input = document.getElementById('sidebarApiKeyInput');
        var apiKey = (input && input.value.trim()) || localStorage.getItem('core_v4_geminiKey') || (typeof geminiApiKey !== 'undefined' ? geminiApiKey : '');
        if (!apiKey) {
            alert("Gemini APIキーが設定されていません。左上メニューからAPIキーを設定してください。");
            return null;
        }
        var report = typeof onProgress === 'function' ? onProgress : function() {};
        var expected = Math.max(1, (String(text).replace(/\n/g, ' ').match(/[^.?!]+[.?!]+|[^.?!]+$/g) || []).filter(function(s) { return s.trim(); }).length);
        var shown = 1, done = 0, label = 'AIが英文を読んでいます';
        function show(value, nextLabel) {
            shown = Math.max(shown, Math.min(97, value));
            if (nextLabel) label = nextLabel;
            report(Math.round(shown), label);
        }
        // Between sentences the bar keeps moving, but never past the next sentence.
        var creep = setInterval(function() {
            var ceiling = done ? 12 + 85 * Math.min(1, (done + 0.9) / expected) : 12;
            if (shown < ceiling) show(shown + (done ? 0.4 : 0.35));
        }, 400);
        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timeoutId = null;
        // Times out when nothing arrives for 45 seconds (a long text may take longer in total).
        function arm() {
            if (!controller) return;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(function() { controller.abort(); }, 45000);
        }
        arm();
        try {
            var prompt = "以下の英文を解析し、指定したJSON形式だけを返してください。英文を省略しないでください。\n\n英文:\n" + text + "\n\nJSON形式:\n{\"fullSummaryAbstract\":\"英文全体の日本語要約（3文以内）\",\"sentences\":[{\"text\":\"元の英語の1文\",\"translation\":\"正確な日本語訳\",\"grammarHighlights\":[{\"phrase\":\"重要表現\",\"meaning\":\"日本語での文法説明\"}]}]}";
            // The newest Flash model first; a fixed model name that Google retires answers 404,
            // so the older name is the fallback.
            var models = ['gemini-flash-latest', 'gemini-2.5-flash'], response;
            for (var m = 0; m < models.length; m++) {
                response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + models[m] + ':streamGenerateContent?alt=sse&key=' + encodeURIComponent(apiKey), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
                    }),
                    signal: controller ? controller.signal : undefined
                });
                if (response.status !== 404) break;
            }
            if (!response.ok) {
                var errorData = await response.text();
                console.error("Gemini API Error details:", errorData);
                var apiMessage = "Gemini APIエラー（" + response.status + "）";
                try {
                    var parsedError = JSON.parse(errorData);
                    if (Array.isArray(parsedError)) parsedError = parsedError[0];
                    if (parsedError.error && parsedError.error.message) apiMessage += ": " + parsedError.error.message;
                } catch (ignore) {}
                alert(apiMessage);
                return buildAnalysisFallback(text, apiMessage);
            }
            show(8, 'AIが英文を読んでいます');
            var responseText = (await readStream(response, function(sofar) {
                var finished = (sofar.match(/"translation"\s*:\s*"(?:[^"\\]|\\.)*"/g) || []).length;
                if (finished > done) {
                    done = finished;
                    show(12 + 85 * Math.min(1, done / expected), '和訳と文法を作っています（' + Math.min(done, expected) + ' / ' + expected + '文）');
                }
            }, arm)).trim();
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
            var message = e && e.name === 'AbortError' ? "Gemini APIが45秒以上応答しませんでした" : (e.message || "Gemini APIとの通信に失敗しました");
            alert(message);
            return buildAnalysisFallback(text, message);
        } finally {
            clearInterval(creep);
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
