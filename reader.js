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

    // What went wrong, in words a student can act on: { title, detail }. status is the HTTP status,
    // or 'timeout' / 'network' / 'unreadable'; apiText is Google's own (English) message, if any.
    function describeGeminiError(status, apiText) {
        var code = typeof status === 'number' ? '（エラーコード ' + status + '）' : '';
        if (status === 'timeout') return { title: 'AIから応答がありません', detail: '45秒以上なにも返ってきませんでした。通信状態を確認して、もう一度お試しください。' };
        if (status === 'network') return { title: 'AIに接続できません', detail: 'インターネットにつながっているか確認して、もう一度お試しください。' };
        if (status === 'unreadable') return { title: 'AIの返事を読み取れませんでした', detail: 'ときどき起きる失敗です。もう一度解析すると、たいてい直ります。' };
        if (status === 401 || status === 403 || (status === 400 && /api key|API_KEY/i.test(apiText || '')))
            return { title: 'APIキーが使えません', detail: 'メニューの「設定」にあるGemini APIキーが正しいか確認してください。キーを作り直したときは、新しいキーを保存し直してください。' + code };
        if (status === 429) return { title: 'AIの利用回数の上限に達しました', detail: 'Geminiの無料枠には、1分あたり・1日あたりの回数に上限があります。1分ほど待つか、時間をおいてからもう一度お試しください。' + code };
        if (status === 503 || status === 502 || status === 504)
            return { title: 'AI（Gemini）が混み合っています', detail: 'Google側で利用が集中していて、一時的に応答できない状態です。アプリやAPIキーの問題ではありません。1〜2分ほど待ってから、もう一度お試しください。' + code };
        if (status >= 500) return { title: 'AI（Gemini）側でエラーが起きました', detail: 'Google側の一時的な問題です。少し待ってから、もう一度お試しください。' + code };
        if (status === 404) return { title: 'AIのモデルが見つかりません', detail: 'Google側でモデルの名前が変わった可能性があります。ページを再読み込みしてから、もう一度お試しください。' + code };
        if (status === 400) return { title: 'AIがこの英文を受け付けませんでした', detail: '英文が長すぎるか、読めない文字が含まれている可能性があります。短く区切って試してください。' + code };
        return { title: 'AIの解析に失敗しました', detail: '少し待ってから、もう一度お試しください。' + code };
    }
    window.describeGeminiError = describeGeminiError;

    function buildAnalysisFallback(text, problem) {
        var sentences = String(text || '').replace(/\n/g, ' ').match(/[^.?!]+[.?!]+|[^.?!]+$/g) || [String(text || '')];
        return {
            analysisError: true,
            errorTitle: problem.title,
            errorDetail: problem.detail,
            fullSummaryAbstract: '',
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

    // A reader token as the word book looks it up (lower case, no punctuation).
    window.readerCleanToken = function(token) {
        return String(token || '').toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]"'’‘“”]/g, '');
    };
    // The word book entries that appear in the text (inflected forms too), for the AI to check
    // which are used in a registered meaning: [{ num, word, meanings: [text] }].
    function vocabCandidates(text) {
        if (typeof window.findVocabByToken !== 'function') return [];
        var found = new Map();
        String(text).split(/\s+/).forEach(function(token) {
            var word = window.findVocabByToken(window.readerCleanToken(token));
            if (!word || found.has(String(word.num)) || found.size >= 120) return;
            var meanings = (word.meanings && word.meanings.length ? word.meanings.map(function(m) { return m.text; }) : [word.meaning || ''])
                .map(function(t) { return String(t || '').replace(/\s+/g, ' ').trim().slice(0, 60); });
            found.set(String(word.num), { num: String(word.num), word: String(word.word || ''), meanings: meanings });
        });
        return Array.from(found.values());
    }
    // Where a grammar phrase sits in its sentence: { start, end } or null. The AI's phrase may
    // differ in quotes or spacing, or carry ~ / ... / S V placeholders: then the longest plain
    // piece of it is used. Ranges already taken are skipped.
    window.findGrammarPhrase = function(sentence, phrase, taken) {
        var cleaned = String(phrase || '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();
        var pieces = cleaned.split(/\s*(?:[~〜…()（）\[\]［］/／+＋]|\.\.\.|\b[SVOCAB]\b)\s*/)
            .map(function(piece) { return piece.replace(/^[\s"',.;:!?]+|[\s"',.;:!?]+$/g, ''); })
            .filter(function(piece) { return piece.length >= 2; })
            .sort(function(a, b) { return b.length - a.length; });
        var whole = cleaned.replace(/^[\s"',.;:!?]+|[\s"',.;:!?]+$/g, '');
        if (whole.length >= 2) pieces.unshift(whole);
        for (var i = 0; i < pieces.length; i++) {
            var body = pieces[i].replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/'/g, "['’]").replace(/"/g, '["“”]').replace(/\s+/g, '\\s+');
            var pattern = new RegExp('(^|[^A-Za-z0-9])(' + body + ')(?![A-Za-z0-9])', 'gi'), match;
            while ((match = pattern.exec(sentence))) {
                var start = match.index + match[1].length, end = start + match[2].length;
                var overlaps = (taken || []).some(function(r) { return start < r.end && end > r.start; });
                if (!overlaps) return { start: start, end: end };
                pattern.lastIndex = start + 1;
            }
        }
        return null;
    };
    var CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';
    function analysisPrompt(text, candidates) {
        var list = candidates.length ? candidates.map(function(c) {
            return '#' + c.num + ' ' + c.word + ': ' + c.meanings.map(function(m, i) { return (CIRCLED[i] || '(' + (i + 1) + ')') + m; }).join(' ');
        }).join('\n') : '（なし）';
        return 'あなたは高校生に英語を教える先生です。次の英文を解析してください。英文は省略せず、すべての文を順番どおりに sentences に入れてください。\n\n' +
            '各文について:\n' +
            '- text: 元の英語の1文（そのまま）\n' +
            '- translation: 自然で正確な日本語訳\n' +
            '- grammarHighlights: その文で学ぶ価値のある文法・構文・熟語を1〜3個（関係詞、分詞・分詞構文、不定詞・動名詞の用法、助動詞の意味、時制、受動態、比較、仮定法、接続詞、熟語など）。本当に何もない短い文だけ空にしてよい。\n' +
            '  - phrase: 英文からそのまま抜き出した連続する語句。英文と同じ綴り・記号で書き、「~」「...」「S V」「A」などの記号や言い換えは使わない\n' +
            '  - label: 文法事項の短い名前（例：「助動詞 must（推量）」「分詞構文（付帯状況）」）\n' +
            '  - meaning: 日本語での説明（1〜2文）\n' +
            '- vocab: 下の「単語帳の単語」のうち、この文に出てくるもの（活用形を含む）で、登録された意味のどれかと同じ意味で使われているものだけ。num は番号、meaning は何番目の意味か（1から）。違う意味で使われているもの（例：単語帳の意味が「〜のような」なのに、文では「好む」の意味の like）は入れない。\n\n' +
            'fullSummaryAbstract: 英文全体の日本語要約（3文以内）\n\n' +
            '単語帳の単語:\n' + list + '\n\n英文:\n' + text;
    }
    var ANALYSIS_SCHEMA = {
        type: 'OBJECT',
        properties: {
            fullSummaryAbstract: { type: 'STRING' },
            sentences: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
                text: { type: 'STRING' },
                translation: { type: 'STRING' },
                grammarHighlights: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
                    phrase: { type: 'STRING' }, label: { type: 'STRING' }, meaning: { type: 'STRING' }
                }, required: ['phrase', 'label', 'meaning'], propertyOrdering: ['phrase', 'label', 'meaning'] } },
                vocab: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
                    num: { type: 'STRING' }, meaning: { type: 'INTEGER' }
                }, required: ['num', 'meaning'], propertyOrdering: ['num', 'meaning'] } }
            }, required: ['text', 'translation', 'grammarHighlights', 'vocab'], propertyOrdering: ['text', 'translation', 'grammarHighlights', 'vocab'] } }
        },
        required: ['fullSummaryAbstract', 'sentences'],
        propertyOrdering: ['fullSummaryAbstract', 'sentences']
    };

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
            var candidates = vocabCandidates(text);
            var prompt = analysisPrompt(text, candidates);
            // The schema fixes the shape; if a model refuses it (400), the request goes again without it.
            var useSchema = true;
            var send = function(model) {
                var config = { responseMimeType: "application/json", temperature: 0.2 };
                if (useSchema) config.responseSchema = ANALYSIS_SCHEMA;
                return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':streamGenerateContent?alt=sse&key=' + encodeURIComponent(apiKey), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: config }),
                    signal: controller ? controller.signal : undefined
                });
            };
            // gemini-2.5-flash first (the newest model behind gemini-flash-latest is often busy).
            // A busy model (5xx) is asked once more after a short wait; a busy, used-up (429) or
            // retired (404) model hands over to the other one.
            var models = ['gemini-2.5-flash', 'gemini-flash-latest'], response;
            var busy = function(status) { return status === 500 || status === 502 || status === 503 || status === 504; };
            for (var m = 0; m < models.length; m++) {
              for (var attempt = 0; attempt < 2; attempt++) {
                if (attempt) {
                    show(shown, 'AIが混み合っています。もう一度試しています');
                    await new Promise(function(resolve) { setTimeout(resolve, 2000); });
                    arm();
                }
                response = await send(models[m]);
                if (response.status === 400 && useSchema && /schema|Unknown name|Invalid JSON payload|propertyOrdering/i.test(await response.clone().text())) {
                    useSchema = false;
                    response = await send(models[m]);
                }
                if (!busy(response.status)) break;
              }
              if (response.ok || !(response.status === 404 || response.status === 429 || busy(response.status))) break;
              if (m < models.length - 1) show(shown, '別のAIモデルで試しています');
            }
            if (!response.ok) {
                var errorData = await response.text(), apiText = '';
                try {
                    var parsedError = JSON.parse(errorData);
                    if (Array.isArray(parsedError)) parsedError = parsedError[0];
                    if (parsedError.error && parsedError.error.message) apiText = parsedError.error.message;
                } catch (ignore) {}
                console.error("Gemini API Error details:", response.status, errorData);
                return buildAnalysisFallback(text, describeGeminiError(response.status, apiText));
            }
            show(8, 'AIが英文を読んでいます');
            var responseText = (await readStream(response, function(sofar) {
                var finished = (sofar.match(/"translation"\s*:\s*"(?:[^"\\]|\\.)*"/g) || []).length;
                if (finished > done) {
                    done = finished;
                    show(12 + 85 * Math.min(1, done / expected), '和訳と文法を作っています（' + Math.min(done, expected) + ' / ' + expected + '文）');
                }
            }, arm)).trim();
            if (!responseText) return buildAnalysisFallback(text, describeGeminiError('unreadable'));
            var cleanJsonText = responseText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
            var firstBrace = cleanJsonText.indexOf('{');
            var lastBrace = cleanJsonText.lastIndexOf('}');
            if (firstBrace >= 0 && lastBrace > firstBrace) cleanJsonText = cleanJsonText.slice(firstBrace, lastBrace + 1);
            var result = null;
            try { result = JSON.parse(cleanJsonText); } catch (ignore) {}
            if (!result || !Array.isArray(result.sentences) || !result.sentences.length) return buildAnalysisFallback(text, describeGeminiError('unreadable'));
            // Only words the AI judged to be used in a registered meaning are marked (see analyzeText).
            result.vocabChecked = result.sentences.every(function(sentence) { return sentence && Array.isArray(sentence.vocab); });
            return result;
        } catch (e) {
            console.error("Gemini Analyzer Error:", e);
            return buildAnalysisFallback(text, describeGeminiError(e && e.name === 'AbortError' ? 'timeout' : 'network'));
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

    window.openGrammarPopover = function(event, phrase, meaning, label) {
        if (event) event.stopPropagation();
        currentTargetWordToken = null;
        currentTargetVocabNum = null;
        document.getElementById('popWord').innerText = phrase;
        document.getElementById('popWordNum').innerText = "💡 " + (label || "文法");
        document.getElementById('popMeaning').innerText = meaning;
        document.getElementById('popoverStatusBtns').style.display = "none";
        var pop = document.getElementById('wordPopover');
        pop.style.display = 'flex';
        pop.classList.add('show');
    };
    // A word-book word tapped in the reader: the same card as the flashcard's ⓘ, with the meaning
    // this sentence uses (when the AI said which).
    window.openReaderVocabDetails = function(event, word, senseIndex) {
        if (event) event.stopPropagation();
        var fresh = (Array.isArray(vocabList) && vocabList.find(function(v) { return String(v.num) === String(word.num); })) || word;
        if (typeof window.openVocabDetailsSheet !== 'function') return window.openWordPopoverFromVocab(event, fresh, fresh.word);
        var sense = senseIndex > 0 && fresh.meanings ? fresh.meanings[senseIndex - 1] : null;
        window.openVocabDetailsSheet(fresh, sense ? 'この文での意味：' + (CIRCLED[senseIndex - 1] || '') + sense.text : '');
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
            if (span.dataset.vocabSkip) return;
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
