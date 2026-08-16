// ================================================================
// vocab_ui.js —— 単語帳表示・操作関連（完全版）
// 読み込み順: app.js → game_core.js → vocab_ui.js
// ================================================================
(function() {
    "use strict";

    // ================================================================
    // 1. データ変換・ユーティリティ
    // ================================================================

    window.migrateVocabData = function(words) {
        return words.map(function(w) {
            if (!w.meanings || w.meanings.length === 0) {
                w.meanings = [];
                var mStr = w.meaning || "";
                var hasCircle = /[①-⑳]/.test(mStr);
                if (hasCircle) {
                    var parts = mStr.split(/(?=[①-⑳])/).map(function(p) {
                        return p.replace(/[①-⑳]/g, '').trim();
                    }).filter(function(p) { return p; });
                    w.meanings = parts.map(function(p, i) {
                        return { id: w.num + "-" + i, text: p, status: 'none', history: [] };
                    });
                } else {
                    w.meanings.push({ id: w.num + "-0", text: mStr.trim(), status: 'none', history: [] });
                }
            }
            return w;
        });
    };

    window.formatWordForDisplay = function(str) {
        return str.replace(/[;；].*$/g, '')
            .replace(/（[^）]*）/g, '')
            .replace(/\([^)]*\)/g, '')
            .replace(/(動|名|形|副|代|接|前|自動|他動)[:：]\s*/g, '')
            .replace(/〜[をにがとへでや]\s*/g, '')
            .replace(/^[ ,　]+/, '')
            .trim();
    };

    window.stemWord = function(word) {
        var w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
        if (w.length < 4) return w;
        if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
        if (w.length > 5 && w.endsWith('ing')) {
            var s = w.slice(0, -3);
            if (s.length >= 3 && s[s.length - 1] === s[s.length - 2] && !/[aeiou]/.test(s[s.length - 1])) s = s.slice(0, -1);
            if (s.length >= 3) return s;
        }
        if (w.length > 4 && w.endsWith('ed')) {
            var s2 = w.slice(0, -2);
            if (s2.length >= 3 && s2[s2.length - 1] === s2[s2.length - 2] && !/[aeiou]/.test(s2[s2.length - 1])) s2 = s2.slice(0, -1);
            if (s2.length >= 3) return s2;
        }
        if (w.length > 5 && w.endsWith('est')) return w.slice(0, -3);
        if (w.length > 4 && w.endsWith('er')) return w.slice(0, -2);
        if (w.length > 4 && w.endsWith('ly')) return w.slice(0, -2);
        if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
        if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
        return w;
    };

    window.rebuildVocabStemIndex = function() {
        window._vocabStemIndex = {};
        if (!Array.isArray(vocabList)) return;
        vocabList.forEach(function(v) {
            var sk = window.stemWord(v.word);
            if (sk && sk.length >= 4 && !window._vocabStemIndex[sk]) window._vocabStemIndex[sk] = v;
        });
    };

    window.findVocabByToken = function(cleanKey) {
        if (!cleanKey) return null;
        var m = vocabList.find(function(v) { return v.word.toLowerCase() === cleanKey; });
        if (m) return m;
        var sk = window.stemWord(cleanKey);
        if (sk && sk.length >= 4 && window._vocabStemIndex && window._vocabStemIndex[sk]) return window._vocabStemIndex[sk];
        return null;
    };

    // ================================================================
    // 2. UIラベル・範囲適用
    // ================================================================

    window.relabelUiText = function() {
        var pairs = [['和訳', '意味'], ['英訳', '単語'], ['(1〜100)', '(1〜)'], ['（1〜100）', '(1〜)']];
        var protect = ['和訳未取得', '総和訳'];
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: function(node) {
                var p = node.parentElement;
                if (!p) return NodeFilter.FILTER_REJECT;
                var tag = p.tagName;
                if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'INPUT') return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        var targets = [];
        var n;
        while ((n = walker.nextNode())) targets.push(n);
        targets.forEach(function(node) {
            var t = node.nodeValue;
            protect.forEach(function(p, i) {
                if (t.indexOf(p) !== -1) t = t.split(p).join('�P' + i + '�');
            });
            var changed = false;
            pairs.forEach(function(pair) {
                if (t.indexOf(pair[0]) !== -1) { t = t.split(pair[0]).join(pair[1]); changed = true; }
            });
            protect.forEach(function(p, i) {
                var tok = '�P' + i + '�';
                if (t.indexOf(tok) !== -1) { t = t.split(tok).join(p); changed = true; }
            });
            if (changed) node.nodeValue = t;
        });
    };

    window.applyVocabMaxRange = function() {
        var maxNum = vocabList.reduce(function(m, w) {
            var n = parseInt(w.num);
            return isNaN(n) ? m : Math.max(m, n);
        }, 0);
        if (maxNum <= 0) return;
        ['flashcardRangeEnd', 'vocabRangeEnd'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.value = maxNum;
        });
    };

    // ================================================================
    // 3. 単語状態・統計
    // ================================================================

    window.wordOverallStatus = function(w) {
        if (!w.meanings || w.meanings.length === 0) return 'none';
        var sts = w.meanings.map(function(m) { return m.status || 'none'; });
        if (sts.every(function(s) { return s === 'ok'; })) return 'ok';
        if (sts.some(function(s) { return s === 'bad'; })) return 'bad';
        if (sts.some(function(s) { return s === 'so'; })) return 'so';
        if (sts.some(function(s) { return s === 'ok'; })) return 'ok';
        return 'none';
    };

    window.showVocabStatsPopup = function() {
        var old = document.getElementById('vocabStatsOverlay');
        if (old) old.remove();
        var total = vocabList.length;
        var ok = 0,
            so = 0,
            bad = 0,
            none = 0;
        vocabList.forEach(function(w) {
            var s = window.wordOverallStatus(w);
            if (s === 'ok') ok++;
            else if (s === 'so') so++;
            else if (s === 'bad') bad++;
            else none++;
        });
        var denom = total || 1;
        var pct = function(v) { return total ? Math.round(v / denom * 100) : 0; };
        var segs = [
            { value: ok, color: '#10B981', label: '⚪︎ 定着' },
            { value: so, color: '#F59E0B', label: '△ 曖昧' },
            { value: bad, color: '#EF4444', label: '✕ 不可' },
            { value: none, color: '#64748B', label: '未学習' }
        ];
        var r = 42,
            c = 2 * Math.PI * r,
            offset = 0,
            circles = '';
        segs.forEach(function(seg) {
            var frac = seg.value / denom;
            var len = frac * c;
            if (len > 0) circles += '<circle r="' + r + '" cx="60" cy="60" fill="none" stroke="' + seg.color + '" stroke-width="14" stroke-dasharray="' + len + ' ' + (c - len) + '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 60 60)"/>';
            offset += len;
        });
        if (total === 0) circles = '<circle r="' + r + '" cx="60" cy="60" fill="none" stroke="#334155" stroke-width="14"/>';
        var listHtml = '';
        segs.forEach(function(seg) {
            listHtml += '<div style="display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.08); font-size:13px;"><span style="display:flex; align-items:center; gap:8px;"><span style="width:12px; height:12px; border-radius:3px; background:' + seg.color + '; display:inline-block;"></span>' + seg.label + '</span><span style="font-weight:800;">' + seg.value + '語 <span style="color:var(--text-sub); font-weight:600;">(' + pct(seg.value) + '%)</span></span></div>';
        });
        var ov = document.createElement('div');
        ov.id = 'vocabStatsOverlay';
        ov.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px);";
        var box = document.createElement('div');
        box.style.cssText = "background:var(--card-bg); border:1px solid var(--cosmic-cyan); border-radius:16px; padding:20px; width:88%; max-width:340px; color:#fff; box-shadow:0 10px 30px rgba(0,0,0,0.6);";
        var currentBook = (typeof textbooksPool !== 'undefined' && Array.isArray(textbooksPool)) ? textbooksPool.find(function(b) { return b.id === currentTextbook; }) : null;
        var bookName = currentBook ? currentBook.name : '共通単語帳';
        box.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;"><div style="font-size:16px; font-weight:900;">📊 単語帳の詳細</div><button id="vocabStatsClose" style="background:none; border:none; color:var(--text-sub); font-size:20px; cursor:pointer; line-height:1;">×</button></div><div style="text-align:center; font-size:12px; color:var(--cosmic-purple-light); font-weight:800; margin-bottom:8px;">📔 ' + bookName + '</div><div style="text-align:center; font-size:13px; margin-bottom:12px;">登録単語数: <strong style="color:var(--cosmic-cyan); font-size:18px;">' + total + '</strong> 語</div><div style="display:flex; justify-content:center; margin-bottom:14px;"><svg width="120" height="120" viewBox="0 0 120 120">' + circles + '<text x="60" y="64" text-anchor="middle" fill="#fff" font-size="16" font-weight="900">' + total + '</text></svg></div>' + listHtml;
        ov.appendChild(box);
        document.body.appendChild(ov);
        ov.querySelector('#vocabStatsClose').onclick = function() { ov.remove(); };
        ov.onclick = function(e) { if (e.target === ov) ov.remove(); };
    };

    window.injectVocabStatsButton = function() {
        if (document.getElementById('vocabStatsBtn')) return;
        var titleEl = document.getElementById('vocabBookTitle');
        if (!titleEl) return;
        var parent = titleEl.parentElement;
        if (!parent) return;
        var btn = document.createElement('button');
        btn.id = 'vocabStatsBtn';
        btn.type = 'button';
        btn.textContent = '📊 詳細';
        btn.style.cssText = "margin-left:auto; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.25); color:#fff; font-size:11px; font-weight:700; padding:6px 10px; border-radius:20px; cursor:pointer; white-space:nowrap; flex-shrink:0;";
        btn.onclick = function(e) { e.stopPropagation(); window.showVocabStatsPopup(); };
        if (getComputedStyle(parent).display === 'block') {
            parent.style.display = 'flex';
            parent.style.alignItems = 'center';
            parent.style.gap = '8px';
        }
        parent.appendChild(btn);
    };

    // ================================================================
    // 4. 一括インポート・削除・リセット
    // ================================================================

    window.toggleBulkImportCard = function() {
        var sec = document.getElementById('bulkImportToggleSection');
        if (!sec) return;
        sec.style.display = sec.style.display === 'none' ? 'block' : 'none';
        if (sec.style.display === 'block') window.renderBulkDeleteList();
    };

    window.handleBulkWordImport = function() {
        var input = document.getElementById('bulkWordInput');
        if (!input) return;
        var text = input.value.trim();
        if (!text) return;
        if (text.startsWith("[") && text.endsWith("]")) {
            try {
                var parsed = JSON.parse(text);
                if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].word) {
                    if (confirm("バックアップデータで完全に上書きしますか？")) {
                        vocabList = window.migrateVocabData(parsed);
                        window.saveVocabToStorage();
                        window.renderVocabList();
                        window.renderBulkDeleteList();
                        input.value = "";
                        alert("統合完了しました！");
                        return;
                    }
                }
            } catch (e) {}
        }
        text.split('\n').forEach(function(line) {
            var parts = line.split(':');
            if (parts.length >= 3) {
                var num = parts[0].trim(),
                    word = parts[1].trim(),
                    sub = parts[3] ? parts[3].trim() : "";
                var meaning = parts[2].trim().replace(/(動|名|形|副|代|接|前|自動|他動)[:：]\s*/g, '').replace(/^[ ,　]+/, '');
                if (num && word && meaning) {
                    var existingIdx = vocabList.findIndex(function(w) { return String(w.num) === String(num); });
                    var newWord = { num: num, word: word, meaning: meaning, sub: sub, status: "none", history: [] };
                    newWord = window.migrateVocabData([newWord])[0];
                    if (existingIdx >= 0) vocabList[existingIdx] = newWord;
                    else vocabList.push(newWord);
                }
            }
        });
        vocabList.sort(function(a, b) { return parseInt(a.num) - parseInt(b.num); });
        userStats.vocab_reg = vocabList.length;
        window.saveUserStats();
        window.saveVocabToStorage();
        window.renderVocabList();
        window.renderBulkDeleteList();
        input.value = "";
        alert("一括インポートが完了しました。");
    };

    window.renderBulkDeleteList = function() {
        var c = document.getElementById('bulkDeleteListContainer');
        if (!c) return;
        c.innerHTML = "";
        vocabList.forEach(function(w) {
            var row = document.createElement('div');
            row.style.cssText = "display:flex; align-items:center; gap:8px; padding:6px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:13px;";
            row.innerHTML = '<input type="checkbox" class="bulk-delete-chk" value="' + w.num + '"><span style="color:var(--text-sub);">#' + w.num + '</span><strong>' + w.word + '</strong>';
            c.appendChild(row);
        });
    };

    window.selectAllBulkDelete = function(checked) {
        document.querySelectorAll('.bulk-delete-chk').forEach(function(chk) { chk.checked = checked; });
    };

    window.showCustomBulkDeleteConfirm = function(count, numsToDelete) {
        if (document.getElementById('bulkDelOverlayLayer')) return;
        var overlay = document.createElement('div');
        overlay.id = 'bulkDelOverlayLayer';
        overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);";
        var box = document.createElement('div');
        box.style.cssText = "background:var(--card-bg); border:1px solid #EF4444; border-radius:16px; padding:24px; width:85%; max-width:320px; text-align:center; box-shadow: 0 10px 30px rgba(0,0,0,0.6);";
        box.innerHTML = '<div style="color:white; font-size:18px; font-weight:800; margin-bottom:12px;">⚠️ 一括削除</div> <div style="color:var(--text-sub); font-size:13px; margin-bottom:24px; line-height:1.5;">選択された <strong style="color:white;">' + count + '</strong> 件の単語を完全に削除しますか？</div> <div style="display:flex; gap:12px;"> <button style="flex:1; padding:12px; border-radius:10px; border:none; background:var(--input-bg); color:var(--text-main); font-weight:700; cursor:pointer;" id="cancelBulkDelBtn">キャンセル</button> <button style="flex:1; padding:12px; border-radius:10px; border:none; background:#EF4444; color:white; font-weight:700; cursor:pointer;" id="confirmBulkDelBtn">削除する</button> </div>';
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        document.getElementById('cancelBulkDelBtn').onclick = function() { document.body.removeChild(overlay); };
        document.getElementById('confirmBulkDelBtn').onclick = function() {
            vocabList = vocabList.filter(function(w) { return !numsToDelete.includes(String(w.num)); });
            userStats.delete_count += numsToDelete.length;
            userStats.vocab_reg = vocabList.length;
            window.saveUserStats();
            window.saveVocabToStorage();
            window.renderVocabList();
            window.renderBulkDeleteList();
            document.body.removeChild(overlay);
        };
    };

    window.handleBulkDeleteExecute = function() {
        var checkedBoxes = document.querySelectorAll('.bulk-delete-chk:checked');
        if (checkedBoxes.length === 0) return alert("削除したい単語にチェックを入れてください。");
        var nums = Array.from(checkedBoxes).map(function(chk) { return String(chk.value); });
        window.showCustomBulkDeleteConfirm(checkedBoxes.length, nums);
    };

    window.showCustomBulkResetConfirm = function(count, numsToReset) {
        if (document.getElementById('bulkResetOverlayLayer')) return;
        var overlay = document.createElement('div');
        overlay.id = 'bulkResetOverlayLayer';
        overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);";
        var box = document.createElement('div');
        box.style.cssText = "background:var(--card-bg); border:1px solid #10B981; border-radius:16px; padding:24px; width:85%; max-width:320px; text-align:center; box-shadow: 0 10px 30px rgba(0,0,0,0.6);";
        box.innerHTML = '<div style="color:white; font-size:18px; font-weight:800; margin-bottom:12px;">🔄 理解度の一括リセット</div> <div style="color:var(--text-sub); font-size:13px; margin-bottom:24px; line-height:1.5;">選択された <strong style="color:white;">' + count + '</strong> 件の単語の理解度を初期状態に戻しますか？</div> <div style="display:flex; gap:12px;"> <button style="flex:1; padding:12px; border-radius:10px; border:none; background:var(--input-bg); color:var(--text-main); font-weight:700; cursor:pointer;" id="cancelBulkResetBtn">やめる</button> <button style="flex:1; padding:12px; border-radius:10px; border:none; background:#10B981; color:white; font-weight:700; cursor:pointer;" id="confirmBulkResetBtn">リセット</button> </div>';
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        document.getElementById('cancelBulkResetBtn').onclick = function() { document.body.removeChild(overlay); };
        document.getElementById('confirmBulkResetBtn').onclick = function() {
            vocabList.forEach(function(w) {
                if (numsToReset.includes(String(w.num))) {
                    w.status = "none";
                    w.history = [];
                    if (w.meanings) w.meanings.forEach(function(m) { m.status = "none";
                        m.history = []; });
                }
            });
            userStats.vocab_fixed = vocabList.filter(function(w) { return w.meanings && w.meanings.some(function(m) { return m.status === 'ok'; }); }).length;
            window.saveUserStats();
            window.saveVocabToStorage();
            window.renderVocabList();
            window.renderBulkDeleteList();
            document.body.removeChild(overlay);
        };
    };

    window.handleBulkResetExecute = function() {
        var checkedBoxes = document.querySelectorAll('.bulk-delete-chk:checked');
        if (checkedBoxes.length === 0) return alert("リセットしたい単語にチェックを入れてください。");
        var nums = Array.from(checkedBoxes).map(function(chk) { return String(chk.value); });
        window.showCustomBulkResetConfirm(checkedBoxes.length, nums);
    };

    // ================================================================
    // 5. フィルタ・削除確認
    // ================================================================

    window.setVocabFilter = function(filter) {
        vocabFilter = filter;
        document.querySelectorAll('.filter-scroller .pill-btn').forEach(function(b) { b.classList.remove('active'); });
        var fBtn = document.getElementById('filter-' + filter);
        if (fBtn) fBtn.classList.add('active');
        window.renderVocabList();
    };

    window.showCustomDeleteConfirm = function(numStr) {
        if (document.getElementById('delOverlayLayer')) return;
        var overlay = document.createElement('div');
        overlay.id = 'delOverlayLayer';
        overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);";
        var box = document.createElement('div');
        box.style.cssText = "background:var(--card-bg); border:1px solid #EF4444; border-radius:16px; padding:24px; width:85%; max-width:320px; text-align:center; box-shadow: 0 10px 30px rgba(0,0,0,0.6);";
        box.innerHTML = '<div style="color:white; font-size:18px; font-weight:800; margin-bottom:12px;">⚠️ 単語の削除</div> <div style="color:white; font-size:13px; margin-bottom:24px; line-height:1.5;">単語 <strong style="color:white;">#' + numStr + '</strong> を完全に削除しますか？</div> <div style="display:flex; gap:12px;"> <button style="flex:1; padding:12px; border-radius:10px; border:none; background:var(--input-bg); color:var(--text-main); font-weight:700; cursor:pointer;" id="cancelDelBtn">やめる</button> <button style="flex:1; padding:12px; border-radius:10px; border:none; background:#EF4444; color:white; font-weight:700; cursor:pointer;" id="confirmDelBtn">削除する</button> </div>';
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        document.getElementById('cancelDelBtn').onclick = function() { document.body.removeChild(overlay); };
        document.getElementById('confirmDelBtn').onclick = function() {
            vocabList = vocabList.filter(function(w) { return String(w.num) !== String(numStr); });
            userStats.delete_count++;
            userStats.vocab_reg = vocabList.length;
            window.saveUserStats();
            window.saveVocabToStorage();
            window.renderVocabList();
            window.renderBulkDeleteList();
            document.body.removeChild(overlay);
        };
    };

    // ================================================================
    // 6. カードスタイル
    // ================================================================

    window.getCardStyleByHistory = function(wordObj) {
        var defaultBg = "rgba(30, 41, 59, 0.85)";
        var allHistory = [];
        if (wordObj.meanings && wordObj.meanings.length > 0) {
            wordObj.meanings.forEach(function(m) {
                if (m.history && m.history.length > 0) allHistory = allHistory.concat(m.history);
            });
        }
        if (allHistory.length === 0) return 'background: ' + defaultBg + ';';
        var totalScore = 0;
        allHistory.forEach(function(h) {
            if (h === 'ok') totalScore += 1;
            else if (h === 'so') totalScore += 4;
            else if (h === 'bad') totalScore += 9;
        });
        var avg = totalScore / allHistory.length;
        var green = [16, 185, 129],
            yellow = [245, 158, 11],
            red = [239, 68, 68];
        var r, g, b;
        if (avg <= 5) {
            var ratio = (avg - 1) / (5 - 1);
            r = Math.round(green[0] + (yellow[0] - green[0]) * ratio);
            g = Math.round(green[1] + (yellow[1] - green[1]) * ratio);
            b = Math.round(green[2] + (yellow[2] - green[2]) * ratio);
        } else {
            var ratio2 = (avg - 5) / (9 - 5);
            r = Math.round(yellow[0] + (red[0] - yellow[0]) * ratio2);
            g = Math.round(yellow[1] + (red[1] - yellow[1]) * ratio2);
            b = Math.round(yellow[2] + (red[2] - yellow[2]) * ratio2);
        }
        return 'background: linear-gradient(135deg, rgba(' + r + ', ' + g + ', ' + b + ', 0.22) 0%, rgba(30, 41, 59, 0.9) 75%);';
    };

    window.getFlashcardStyleByHistory = function(wordData) {
        var cleanKey = wordData.en.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]\"']/g, "");
        var vocabMatch = vocabList.find(function(v) { return v.word.toLowerCase() === cleanKey; });
        var allHistory = [];
        if (vocabMatch) {
            if (vocabMatch.history && vocabMatch.history.length > 0) allHistory = allHistory.concat(vocabMatch.history);
            if (vocabMatch.meanings) {
                vocabMatch.meanings.forEach(function(m) {
                    if (m.history && m.history.length > 0) allHistory = allHistory.concat(m.history);
                });
            }
        } else {
            var memStatus = wordMemory[cleanKey];
            if (memStatus && memStatus !== 'none') allHistory.push(memStatus);
        }
        if (allHistory.length === 0) {
            return "background: radial-gradient(circle at center, rgba(255, 255, 255, 0.04) 0%, #130a24 75%, #090514 100%) !important; border: none !important; box-shadow: none !important;";
        }
        var totalScore = 0;
        allHistory.forEach(function(h) {
            if (h === 'ok') totalScore += 1;
            else if (h === 'so') totalScore += 4;
            else if (h === 'bad') totalScore += 9;
        });
        var avg = totalScore / allHistory.length;
        var green = [16, 185, 129],
            yellow = [245, 158, 11],
            red = [239, 68, 68];
        var r, g, b;
        if (avg <= 5) {
            var ratio = (avg - 1) / (5 - 1);
            r = Math.round(green[0] + (yellow[0] - green[0]) * ratio);
            g = Math.round(green[1] + (yellow[1] - green[1]) * ratio);
            b = Math.round(green[2] + (yellow[2] - green[2]) * ratio);
        } else {
            var ratio2 = (avg - 5) / (9 - 5);
            r = Math.round(yellow[0] + (red[0] - yellow[0]) * ratio2);
            g = Math.round(yellow[1] + (red[1] - yellow[1]) * ratio2);
            b = Math.round(yellow[2] + (red[2] - yellow[2]) * ratio2);
        }
        return 'background: radial-gradient(circle at center, rgba(' + r + ', ' + g + ', ' + b + ', 0.22) 0%, rgba(' + r + ', ' + g + ', ' + b + ', 0.12) 50%, rgba(' + r + ', ' + g + ', ' + b + ', 0) 100%);';
    };

    // ================================================================
    // 7. 理解度更新（コア）
    // ================================================================

    window.updateMeaningStatus = function(wordNum, meaningId, status, event) {
        if (event) event.stopPropagation();
        var wIdx = vocabList.findIndex(function(w) { return String(w.num) === String(wordNum); });
        if (wIdx >= 0) {
            var mIdx = vocabList[wIdx].meanings.findIndex(function(m) { return String(m.id) === String(meaningId); });
            if (mIdx >= 0) {
                if (status === 'none') {
                    vocabList[wIdx].meanings[mIdx].status = 'none';
                    vocabList[wIdx].meanings[mIdx].history = [];
                } else {
                    vocabList[wIdx].meanings[mIdx].status = status;
                    if (!vocabList[wIdx].meanings[mIdx].history) vocabList[wIdx].meanings[mIdx].history = [];
                    vocabList[wIdx].meanings[mIdx].history.push(status);
                    totalExp += 1;
                }
                userStats.vocab_fixed = vocabList.filter(function(w) { return w.meanings && w.meanings.some(function(m) { return m.status === 'ok'; }); }).length;
                window.saveUserStats();
                window.checkAndRewardTitleBonusXP();
                window.saveVocabToStorage();
                window.renderVocabList();
                window.applyProfileToUi();
                window.renderLeaderboard();
            }
        }
    };

    // ================================================================
    // 8. ポップオーバー
    // ================================================================

    window.openWordPopoverFromVocab = function(event, vocabItem, originalText) {
        if (!vocabItem) return;
        if (event) event.stopPropagation();
        currentTargetWordToken = vocabItem.word.toLowerCase();
        currentTargetVocabNum = vocabItem.num;
        document.getElementById('popWord').innerText = originalText;
        document.getElementById('popWordNum').innerText = '#' + vocabItem.num;
        var meaningHtml = "";
        vocabItem.meanings.forEach(function(m) {
            meaningHtml += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:6px;"> <span style="font-size:14px; color:white; flex:1; line-height:1.4;">' + m.text + '</span> <div style="display:flex; gap:4px; flex-shrink:0; margin-left:8px;"> <button style="width:26px; height:26px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:' + (m.status === 'ok' ? 'var(--word-ok)' : 'rgba(0,0,0,0.5)') + '; color:' + (m.status === 'ok' ? '#000' : 'white') + '; font-size:10px; font-weight:900; cursor:pointer;" onclick="window.updateMeaningStatusFromPopover(\'' + vocabItem.num + '\', \'' + m.id + '\', \'ok\', event)">⚪︎</button> <button style="width:26px; height:26px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:' + (m.status === 'so' ? 'var(--word-so)' : 'rgba(0,0,0,0.5)') + '; color:' + (m.status === 'so' ? '#000' : 'white') + '; font-size:10px; font-weight:900; cursor:pointer;" onclick="window.updateMeaningStatusFromPopover(\'' + vocabItem.num + '\', \'' + m.id + '\', \'so\', event)">△</button> <button style="width:26px; height:26px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:' + (m.status === 'bad' ? 'var(--word-bad)' : 'rgba(0,0,0,0.5)') + '; color:' + (m.status === 'bad' ? '#FFF' : 'white') + '; font-size:10px; font-weight:900; cursor:pointer;" onclick="window.updateMeaningStatusFromPopover(\'' + vocabItem.num + '\', \'' + m.id + '\', \'bad\', event)">✕</button> <button style="width:26px; height:26px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); color:white; font-size:10px; font-weight:900; cursor:pointer;" onclick="window.updateMeaningStatusFromPopover(\'' + vocabItem.num + '\', \'' + m.id + '\', \'none\', event)">ー</button> </div> </div>';
        });
        document.getElementById('popMeaning').innerHTML = meaningHtml;
        document.getElementById('popoverStatusBtns').style.display = "none";
        var pop = document.getElementById('wordPopover');
        pop.style.display = 'flex';
        pop.classList.add('show');
    };

    window.updateMeaningStatusFromPopover = function(wordNum, meaningId, status, event) {
        if (event) event.stopPropagation();
        window.updateMeaningStatus(wordNum, meaningId, status, null);
        var vocabItem = vocabList.find(function(w) { return String(w.num) === String(wordNum); });
        if (vocabItem) {
            window.openWordPopoverFromVocab(null, vocabItem, document.getElementById('popWord').innerText);
            window.updateReaderWordColors();
        }
    };

    // ================================================================
    // 9. 展開・ガイドトグル
    // ================================================================

    window.coreSystemToggleExpand = function(event, btn) {
        if (event) event.stopPropagation();
        var ex = btn.nextElementSibling;
        if (ex.style.display === 'none' || !ex.style.display) {
            ex.style.display = 'block';
            btn.innerHTML = '閉じる <i data-lucide="chevron-up" size="12"></i>';
        } else {
            ex.style.display = 'none';
            btn.innerHTML = 'サブ情報を展開 <i data-lucide="chevron-down" size="12"></i>';
        }
        window.initLucide();
    };

    window.coreSystemStaticGuideToggle = function(event, btn) {
        if (event) event.stopPropagation();
        var contentBox = btn.nextElementSibling;
        var stateTextLabel = btn.querySelector('.guide-toggle-state-text');
        if (contentBox.style.display === 'none' || !contentBox.style.display) {
            contentBox.style.display = 'block';
            if (stateTextLabel) {
                stateTextLabel.innerHTML = '閉じる <i data-lucide="chevron-up" size="12"></i>';
            }
        } else {
            contentBox.style.display = 'none';
            if (stateTextLabel) {
                stateTextLabel.innerHTML = '開く <i data-lucide="chevron-down" size="12"></i>';
            }
        }
        window.initLucide();
    };

    // ================================================================
    // 10. 管理者インライン編集
    // ================================================================

    window.toggleInlineWordEdit = function(event, wordNum) {
        if (!window.isAdmin) return;
        if (event) event.stopPropagation();
        var cardBody = document.getElementById('wordCardBody-' + wordNum);
        var cardForm = document.getElementById('wordCardForm-' + wordNum);
        if (cardBody && cardForm) {
            if (cardForm.style.display === 'none' || !cardForm.style.display) {
                cardBody.style.display = 'none';
                cardForm.style.display = 'block';
                window.renderInlineEditFormMeanings(wordNum);
            } else {
                cardBody.style.display = 'block';
                cardForm.style.display = 'none';
            }
        }
        window.initLucide();
    };

    window.renderInlineEditFormMeanings = function(wordNum) {
        var listContainer = document.getElementById('inlineEditMeaningsList-' + wordNum);
        if (!listContainer) return;
        listContainer.innerHTML = "";
        var wEl = vocabList.find(function(w) { return String(w.num) === String(wordNum); });
        if (!wEl || !wEl.meanings) return;
        wEl.meanings.forEach(function(m, index) {
            var itemRow = document.createElement('div');
            itemRow.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid rgba(255,255,255,0.1); font-size:12px;";
            itemRow.innerHTML = '<input type="text" class="search-input inline-m-input-' + wordNum + '" style="margin:0; flex:1; height:36px;" value="' + m.text + '"><button class="list-action-link" style="background:#EF4444; color:white; border:none; padding:0 10px; height:36px; display:flex; align-items:center;" onclick="window.removeInlineMeaningField(event, \'' + wordNum + '\', ' + index + ')"><i data-lucide="trash-2" size="14"></i></button>';
            listContainer.appendChild(itemRow);
        });
        window.initLucide();
    };

    window.removeInlineMeaningField = function(event, wordNum, index) {
        if (event) event.stopPropagation();
        var wEl = vocabList.find(function(w) { return String(w.num) === String(wordNum); });
        if (wEl && wEl.meanings) {
            wEl.meanings.splice(index, 1);
            window.renderInlineEditFormMeanings(wordNum);
        }
    };

    window.addInlineMeaningField = function(event, wordNum) {
        if (event) event.stopPropagation();
        var wEl = vocabList.find(function(w) { return String(w.num) === String(wordNum); });
        if (wEl) {
            if (!wEl.meanings) wEl.meanings = [];
            wEl.meanings.push({ id: wordNum + '-' + Date.now(), text: "", status: "none", history: [] });
            window.renderInlineEditFormMeanings(wordNum);
        }
    };

    window.saveInlineWordEdit = function(event, wordNum) {
        if (event) event.stopPropagation();
        var wIdx = vocabList.findIndex(function(w) { return String(w.num) === String(wordNum); });
        if (wIdx === -1) return;
        var wordInput = document.getElementById('inlineEditWordInput-' + wordNum);
        var subInput = document.getElementById('inlineEditSubInput-' + wordNum);
        var mInputs = document.querySelectorAll('.inline-m-input-' + wordNum);
        if (wordInput) vocabList[wIdx].word = wordInput.value.trim();
        if (subInput) vocabList[wIdx].sub = subInput.value.trim();
        var updatedMeanings = [];
        mInputs.forEach(function(inp, idx) {
            var txt = inp.value.trim();
            if (txt) {
                var oldM = vocabList[wIdx].meanings[idx];
                updatedMeanings.push({
                    id: oldM ? oldM.id : wordNum + '-' + idx + '-' + Date.now(),
                    text: txt,
                    status: oldM ? oldM.status : "none",
                    history: oldM ? oldM.history : []
                });
            }
        });
        vocabList[wIdx].meanings = updatedMeanings;
        vocabList[wIdx].meaning = updatedMeanings.map(function(m, i) { return (updatedMeanings.length > 1 ? '①②③④⑤⑥⑦⑧⑨⑩' [i] + m.text : m.text); }).join("");
        window.saveVocabToStorage();
        window.renderVocabList();
        alert("単語情報を更新しました！");
    };

    // ================================================================
    // 11. renderVocabList（メイン表示）
    // ================================================================

    window.renderVocabList = function() {
        var container = document.getElementById('vocabListContainer');
        if (!container) return;
        container.innerHTML = "";
        if (vocabList.length === 0) {
            container.innerHTML = "<div style='text-align:center; padding:40px 20px; color:var(--text-sub); font-size:13px;'>現在、この単語帳には単語が登録されていません。<br>管理者からの単語の配信をお待ちください。</div>";
            return;
        }
        var startRange = parseInt(document.getElementById('vocabRangeStart').value) || 0;
        var endRange = parseInt(document.getElementById('vocabRangeEnd').value) || 99999;
        var searchKeyword = document.getElementById('vocabSearchInput').value.toLowerCase().trim();
        var filtered = vocabList.filter(function(w) {
            var n = parseInt(w.num);
            if (!isNaN(n) && (n < startRange || n > endRange)) return false;
            if (vocabFilter !== 'all' && !w.meanings.some(function(m) { return m.status === vocabFilter; })) return false;
            if (searchKeyword && !(w.word.toLowerCase().includes(searchKeyword) || w.meaning.includes(searchKeyword))) return false;
            return true;
        });
        filtered.forEach(function(w) {
            var card = document.createElement('div');
            card.className = "word-row-container";
            card.setAttribute('style', window.getCardStyleByHistory(w));
            card.onclick = function(e) {
                if (e.target.closest('button') || e.target.closest('.word-expand-toggle') || e.target.closest('input') || e.target.closest('textarea')) return;
                window.openWordPopoverFromVocab(e, w, w.word);
            };
            var hasAnyHistory = w.meanings && w.meanings.some(function(m) { return m.history && m.history.length > 0; });
            var dotsHtml = "";
            if (hasAnyHistory) {
                var groupsHtml = [];
                w.meanings.forEach(function(m) {
                    var groupHtml = '<div style="display:flex; gap:2px; align-items:center;">';
                    if (m.history && m.history.length > 0) {
                        m.history.slice(-5).forEach(function(h) {
                            var mark = h === 'ok' ? '◯' : h === 'so' ? '△' : '✕';
                            var bg = h === 'ok' ? '#10B981' : h === 'so' ? '#F59E0B' : '#EF4444';
                            var color = h === 'so' ? '#0F172A' : 'white';
                            groupHtml += '<span style="padding:2px 4px; border-radius:4px; font-size:9px; font-weight:800; background:' + bg + '; color:' + color + ';">' + mark + '</span>';
                        });
                    } else {
                        groupHtml += '<span style="color:var(--text-sub); font-size:10px; padding:0 4px;">-</span>';
                    }
                    groupHtml += '</div>';
                    groupsHtml.push(groupHtml);
                });
                dotsHtml = '<div style="display:flex; flex-wrap:wrap; gap:4px; align-items:center; justify-content:flex-end; margin-top:0;">';
                groupsHtml.forEach(function(gh, i) {
                    dotsHtml += gh;
                    if (i < groupsHtml.length - 1) {
                        if ((i + 1) % 3 === 0) {
                            dotsHtml += '<div style="flex-basis:100%; height:0;"></div>';
                        } else {
                            dotsHtml += '<span style="color:rgba(255,255,255,0.2); font-size:12px; font-weight:bold;">/</span>';
                        }
                    }
                });
                dotsHtml += '</div>';
            }
            var meaningsHtml = '<div style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 6px;">';
            w.meanings.forEach(function(m) {
                meaningsHtml += '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px; border-bottom:1px dashed rgba(255,255,255,0.1); padding-bottom:4px;"><span style="font-size:14px; color:white; font-weight:600; flex:1; line-height:1.4;">' + m.text + '</span><div style="display:flex; gap:4px; flex-shrink:0; margin-left:8px;"><button style="width:24px; height:24px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:' + (m.status === 'ok' ? 'var(--word-ok)' : 'rgba(0,0,0,0.5)') + '; color:' + (m.status === 'ok' ? '#000' : 'white') + '; font-size:10px; font-weight:900; cursor:pointer;" onclick="window.updateMeaningStatus(\'' + w.num + '\', \'' + m.id + '\', \'ok\', event)">⚪︎</button><button style="width:24px; height:24px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:' + (m.status === 'so' ? 'var(--word-so)' : 'rgba(0,0,0,0.5)') + '; color:' + (m.status === 'so' ? '#000' : 'white') + '; font-size:10px; font-weight:900; cursor:pointer;" onclick="window.updateMeaningStatus(\'' + w.num + '\', \'' + m.id + '\', \'so\', event)">△</button><button style="width:24px; height:24px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:' + (m.status === 'bad' ? 'var(--word-bad)' : 'rgba(0,0,0,0.5)') + '; color:' + (m.status === 'bad' ? '#FFF' : 'white') + '; font-size:10px; font-weight:900; cursor:pointer;" onclick="window.updateMeaningStatus(\'' + w.num + '\', \'' + m.id + '\', \'bad\', event)">✕</button><button style="width:24px; height:24px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:' + (m.status === 'none' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.5)') + '; color:white; font-size:10px; font-weight:900; cursor:pointer;" onclick="window.updateMeaningStatus(\'' + w.num + '\', \'' + m.id + '\', \'none\', event)">ー</button></div></div>';
            });
            meaningsHtml += '</div>';
            var adminActionButtons = "";
            if (window.isAdmin) {
                adminActionButtons = '<div style="position:absolute; right:8px; top:8px; display:flex; gap:2px; z-index:100;"><button class="card-edit-btn" style="background:none; border:none; color:var(--text-sub); padding:10px; cursor:pointer;" onclick="window.toggleInlineWordEdit(event, \'' + w.num + '\')"><i data-lucide="edit-3" size="18"></i></button><button class="card-delete-btn" style="background:none; border:none; color:var(--text-sub); padding:10px; cursor:pointer;" onclick="event.stopPropagation(); window.showCustomDeleteConfirm(\'' + w.num + '\')"><i data-lucide="trash-2" size="18"></i></button></div>';
            }
            card.innerHTML = adminActionButtons + '<div id="wordCardBody-' + w.num + '"><div class="word-main-line" style="display:flex; justify-content:space-between; align-items:center; padding-right:76px;"><div style="display:flex; align-items:center; gap:8px;"><span class="word-num-badge" style="background:rgba(255,255,255,0.3); color:white; font-size:11px; font-weight:700; padding:2px 6px; border-radius:4px;">#' + w.num + '</span><span style="font-size:18px; font-weight:800; color:white;">' + w.word + '</span></div></div>' + meaningsHtml + (w.sub ? '<div class="word-static-info" style="margin-top:4px; padding-top:0; border:none;"><button class="word-expand-toggle" style="background:none; border:none; color:#C7D2FE; font-size:11px; font-weight:700; cursor:pointer; padding:4px 0; display:inline-flex; align-items:center; gap:4px; z-index:40;" onclick="window.coreSystemToggleExpand(event, this)">サブ情報を展開 <i data-lucide="chevron-down" size="12"></i></button><div class="word-meaning-extra" style="display:none; font-size:12.5px; color:#FFF; line-height:1.6; margin-top:6px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.25); white-space:pre-line;"><div class="sub-info-block" style="background:rgba(0, 0, 0, 0.45); padding:6px 10px; border-radius:6px; font-size:12px; color:#FFF;">' + w.sub + '</div></div></div>' : '') + '<div style="display:flex; justify-content:flex-end; align-items:center; margin-top:12px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.1);">' + dotsHtml + '</div></div><div id="wordCardForm-' + w.num + '" style="display:none; padding-top:32px;"><div style="margin-bottom:12px;"><label style="font-size:11px; color:var(--cosmic-cyan); font-weight:700; display:block; margin-bottom:4px;">単語</label><input type="text" id="inlineEditWordInput-' + w.num + '" class="search-input" style="margin:0;" value="' + w.word + '"></div><div style="margin-bottom:12px;"><label style="font-size:11px; color:var(--cosmic-purple-light); font-weight:700; display:block; margin-bottom:4px;">意味の編集 (パーツ個別管理)</label><div id="inlineEditMeaningsList-' + w.num + '"></div><button class="list-action-link" style="width:100%; text-align:center; height:32px; border-style:dashed; margin-top:4px;" onclick="window.addInlineMeaningField(event, \'' + w.num + '\')"><i data-lucide="plus" size="12" style="vertical-align:middle;"></i> 意味を追加</button></div><div style="margin-bottom:14px;"><label style="font-size:11px; color:var(--text-sub); font-weight:700; display:block; margin-bottom:4px;">サブ情報</label><textarea id="inlineEditSubInput-' + w.num + '" class="modern-textarea" style="height:60px; margin:0;">' + (w.sub || "") + '</textarea></div><div style="display:flex; gap:8px;"><button class="list-action-link" style="flex:1; text-align:center; height:36px; background:rgba(255,255,255,0.05); border:1px solid var(--border);" onclick="window.toggleInlineWordEdit(event, \'' + w.num + '\')">キャンセル</button><button class="list-action-link" style="flex:1; text-align:center; height:36px; background:var(--accent); color:white; border:none;" onclick="window.saveInlineWordEdit(event, \'' + w.num + '\')">保存する</button></div></div>';
            container.appendChild(card);
        });
        window.initLucide();
    };

    console.log('📚 vocab_ui.js 読み込み完了');
})();