let myId = "";
let myName = "プレイヤー1";
let myTarget = "未設定";
let selectedTitle = "称号なし";
let totalExp = 0;
let vocabList = [];
let vocabFilter = "all";
let geminiApiKey = ""; 

// ゲーム用の追加設定変数
let selectedQuestionMode = 'ja2en'; 
let currentQuestionType = 'ja2en'; 
let currentGameDifficulty = 'normal';
let gameMistakeCount = 0;
let gameComboCount = 0;
let gameComboTotalScore = 0;
let gameHistoryLog = []; 
let gameBestScore = 0;
let activeCharacter = ""; 
let activeWeapon = ""; 
let activeArmor = "";  

const SHARED_DEFAULT_VOCAB_DATA = [];
let dictionaryData = [];
const customSamples = {}; 
for(let i = 1; i <= 100; i++) {
    dictionaryData.push({ num: i, en: customSamples[i] ? customSamples[i].en : `token-${i}`, ja: customSamples[i] ? customSamples[i].ja : `単語インデックス No.${i} に紐付く日本語対訳データ` });
}

let wordMemory = JSON.parse(localStorage.getItem('wordMemory')) || {};
let textHistory = JSON.parse(localStorage.getItem('textHistory')) || [];

let myBookshelf = JSON.parse(localStorage.getItem('myBookshelf')) || [];
let myFolders = JSON.parse(localStorage.getItem('myFolders')) || ['未分類'];

let currentTranslationMode = 'inline';
let currentActiveReaderText = "";
let currentActiveTitle = "";
let currentTargetWordToken = null;
let currentTargetVocabNum = null; 

let gameTimerInterval = null;
let gameRemainingTime = 45; 
let gameScoreCount = 0; 
let gameCurrentWordsQueue = [];
let gameCurrentIndex = 0;
let isGameProcessingAnswer = false;
let isGameTimerPaused = false;

let currentMultiMode = 'coop'; 
let currentStance = 'atk';
let multiBossMaxHp = 100000;
let multiBossHp = 100000;
let multiAllyMaxHp = 3500;
let multiAllyHp = 3500;
let multiEnemyTimeLeft = 10;
let currentMultiCorrectIndex = -1;

let flickStartX = 0;
let flickStartY = 0;
let isFlicking = false;
let currentFlickChoice = -1;

window.addEventListener('DOMContentLoaded', () => {
    initLucide();
    loadLocalState();
    renderActivityChart();
    initHeroSlider();
    window.addEventListener('scroll', () => {
        const topBtn = document.getElementById('scrollToTopBtn');
        if (window.scrollY > 300) topBtn.classList.add('show'); else topBtn.classList.remove('show');
    });
});

function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
function initLucide() { if(window.lucide) { window.lucide.createIcons(); } }
window.initHeroSlider = function() {
    const track = document.getElementById('heroSliderTrack');
    if (!track) return;
    let currentSlide = 0;
    setInterval(() => { currentSlide = (currentSlide + 1) % 5; track.style.transform = `translateX(-${currentSlide * 20}%)`; }, 4000);
}

function migrateVocabData(words) {
    return words.map(w => {
        if (!w.meanings || w.meanings.length === 0) {
            w.meanings = [];
            let mStr = w.meaning || "";
            const hasCircle = /[①-⑳]/.test(mStr);
            if (hasCircle) {
                let parts = mStr.split(/(?=[①-⑳])/).map(p => p.replace(/[①-⑳]/g, '').trim()).filter(p => p);
                w.meanings = parts.map((p, i) => ({ id: `${w.num}-${i}`, text: p, status: w.status || 'none', history: w.history || [] }));
            } else {
                w.meanings.push({ id: `${w.num}-0`, text: mStr.trim(), status: w.status || 'none', history: w.history || [] });
            }
        }
        return w;
    });
}

function saveVocabToStorage() { localStorage.setItem('core_v4_custom_words_' + myId, JSON.stringify(vocabList)); }

function formatWordForDisplay(str) {
    return str.replace(/(動|名|形|副|代|接|前|自動|他動)[:：]\s*/g, '')
              .replace(/〜[をにがとへでや]\s*/g, '')
              .replace(/^[ ,　]+/, '')
              .trim();
}

function loadLocalState() {
    const savedId = localStorage.getItem('core_v4_userId');
    geminiApiKey = localStorage.getItem('core_v4_geminiKey') || "";
    const apiKeyInput = document.getElementById('sidebarApiKeyInput');
    if(apiKeyInput) apiKeyInput.value = geminiApiKey;

    const savedTitleText = localStorage.getItem('core_v4_dashboard_title') || "ダッシュボード";
    const headerTitleEl = document.getElementById('headerTitleText');
    if(headerTitleEl) headerTitleEl.innerText = savedTitleText;
    
    if(savedId) {
        myId = savedId;
        document.getElementById('auth-gate-screen').style.display = 'none';
        myName = localStorage.getItem('core_v4_userName') || "プレイヤー1";
        myTarget = localStorage.getItem('core_v4_userTarget') || "未設定";
        selectedTitle = localStorage.getItem('core_v4_userTitle') || "称号なし";
        totalExp = parseInt(localStorage.getItem('core_v4_totalExp') || "0");
        activeCharacter = localStorage.getItem('core_v4_active_char') || ""; 
        activeWeapon = localStorage.getItem('core_v4_active_weapon') || ""; 
        activeArmor = localStorage.getItem('core_v4_active_armor') || ""; 

        let storedWords = [];
        try { storedWords = JSON.parse(localStorage.getItem('core_v4_custom_words_' + myId) || "[]"); } catch(e) {}
        
        vocabList = migrateVocabData(storedWords); 
        saveVocabToStorage();
        
        applyProfileToUi();
        updatePartySlotsUi(); 
        renderVocabList();
        renderLeaderboard();
        renderHistoryList();
        renderBookshelf(); 
        renderGameLeaderboard('mine');
    } else {
        document.getElementById('auth-gate-screen').style.display = 'flex';
    }
}

window.switchAuthMode = function(mode) {
    const tabLogin = document.getElementById('authTabLogin'), tabReg = document.getElementById('authTabRegister');
    const extra = document.getElementById('registerExtraFields'), btn = document.getElementById('authSubmitBtn');
    if(mode === 'login') {
        tabLogin.classList.add('active'); tabReg.classList.remove('active'); extra.style.display = 'none';
        btn.innerHTML = 'システムへログインする <i data-lucide="arrow-right" size="16"></i>';
    } else {
        tabLogin.classList.remove('active'); tabReg.classList.add('active'); extra.style.display = 'block';
        btn.innerHTML = 'アカウントを作成 <i data-lucide="sparkles" size="16"></i>';
    }
    initLucide();
}

window.handleAuthSubmit = function() {
    const idInput = document.getElementById('gateUserIdInput').value.trim();
    if(!idInput) return alert("ユーザーIDを入力してください。");
    
    localStorage.setItem('core_v4_userId', idInput);
    const isRegister = document.getElementById('authTabRegister').classList.contains('active');
    
    if(isRegister) {
        localStorage.setItem('core_v4_userName', document.getElementById('gateUserNameInput').value.trim() || "プレイヤー1");
        localStorage.setItem('core_v4_userTarget', document.getElementById('gateUserTargetInput').value.trim() || "未設定");
    } else {
        if(!localStorage.getItem('core_v4_userName')) localStorage.setItem('core_v4_userName', "プレイヤー1");
        if(!localStorage.getItem('core_v4_userTarget')) localStorage.setItem('core_v4_userTarget', "未設定");
    }
    if(!localStorage.getItem('core_v4_totalExp')) localStorage.setItem('core_v4_totalExp', "0");
    
    loadLocalState();
}

function applyProfileToUi() {
    document.getElementById('sideOptPlayerName').innerText = myName;
    document.getElementById('sideOptGroupName').innerText = "ID: " + myId;
    document.getElementById('profPlayerName').innerText = myName;
    document.getElementById('profTitleLabel').innerText = selectedTitle + " ⚡";
    document.getElementById('profTargetLabel').innerText = "目標: " + myTarget;
    document.getElementById('profCoinCount').innerText = totalExp;
}

window.toggleSidebar = function(open) {
    document.getElementById('sidebarMenu').classList.toggle('open', open);
    document.getElementById('sidebarOverlay').style.display = open ? 'block' : 'none';
}

window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + tabId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('nav-' + tabId).classList.add('active');
    toggleSidebar(false);
    if(tabId !== 'reader') closeReader();
    if(tabId === 'game') renderGameLeaderboard('mine');
}

window.toggleBulkImportCard = function() {
    const sec = document.getElementById('bulkImportToggleSection');
    sec.style.display = sec.style.display === 'none' ? 'block' : 'none';
    if(sec.style.display === 'block') renderBulkDeleteList();
}

window.handleBulkWordImport = function() {
    const text = document.getElementById('bulkWordInput').value.trim();
    if(!text) return;
    if (text.startsWith("[") && text.endsWith("]")) {
        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].word) {
                if (confirm("バックアップデータで完全に上書きしますか？")) {
                    vocabList = migrateVocabData(parsed);
                    saveVocabToStorage(); renderVocabList(); renderBulkDeleteList();
                    document.getElementById('bulkWordInput').value = ""; alert("統合完了しました！"); return;
                }
            }
        } catch(e) { }
    }
    text.split('\n').forEach(line => {
        const parts = line.split(':');
        if(parts.length >= 3) {
            const num = parts[0].trim(), word = parts[1].trim(), sub = parts[3] ? parts[3].trim() : "";
            let meaning = parts[2].trim().replace(/(動|名|形|副|代|接|前|自動|他動)[:：]\s*/g, '').replace(/^[ ,　]+/, '');
            if(num && word && meaning) {
                const existingIdx = vocabList.findIndex(w => String(w.num) === String(num));
                let newWord = { num, word, meaning, sub, status: "none", history: [] };
                newWord = migrateVocabData([newWord])[0]; 
                if(existingIdx >= 0) vocabList[existingIdx] = newWord;
                else vocabList.push(newWord);
            }
        }
    });
    vocabList.sort((a,b) => parseInt(a.num) - parseInt(b.num));
    saveVocabToStorage(); renderVocabList(); renderBulkDeleteList();
    document.getElementById('bulkWordInput').value = ""; alert("一括インポートが完了しました。");
}

function renderBulkDeleteList() {
    const c = document.getElementById('bulkDeleteListContainer'); c.innerHTML = "";
    vocabList.forEach(w => {
        const row = document.createElement('div'); row.style.cssText = "display:flex; align-items:center; gap:8px; padding:6px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:13px;";
        row.innerHTML = `<input type="checkbox" class="bulk-delete-chk" value="${w.num}"><span style="color:var(--text-sub);">#${w.num}</span><strong>${w.word}</strong>`;
        c.appendChild(row);
    });
}
window.selectAllBulkDelete = function(checked) { document.querySelectorAll('.bulk-delete-chk').forEach(chk => chk.checked = checked); }

window.showCustomBulkDeleteConfirm = function(count, numsToDelete) {
    if(document.getElementById('bulkDelOverlayLayer')) return;
    const overlay = document.createElement('div');
    overlay.id = 'bulkDelOverlayLayer';
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:9999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);";
    const box = document.createElement('div');
    box.style.cssText = "background:var(--card-bg); border:1px solid #EF4444; border-radius:16px; padding:24px; width:85%; max-width:320px; text-align:center; box-shadow: 0 10px 30px rgba(0,0,0,0.6);";
    box.innerHTML = `
        <div style="color:white; font-size:18px; font-weight:800; margin-bottom:12px;">⚠️ 一括削除</div>
        <div style="color:var(--text-sub); font-size:13px; margin-bottom:24px; line-height:1.5;">選択された <strong style="color:white;">${count}</strong> 件の単語を完全に削除しますか？</div>
        <div style="display:flex; gap:12px;">
            <button style="flex:1; padding:12px; border-radius:10px; border:none; background:var(--input-bg); color:var(--text-main); font-weight:700; cursor:pointer;" id="cancelBulkDelBtn">やめる</button>
            <button style="flex:1; padding:12px; border-radius:10px; border:none; background:#EF4444; color:white; font-weight:700; cursor:pointer;" id="confirmBulkDelBtn">削除する</button>
        </div>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    document.getElementById('cancelBulkDelBtn').onclick = () => { document.body.removeChild(overlay); };
    document.getElementById('confirmBulkDelBtn').onclick = () => {
        vocabList = vocabList.filter(w => !numsToDelete.includes(String(w.num)));
        saveVocabToStorage(); renderVocabList(); renderBulkDeleteList();
        document.body.removeChild(overlay);
    };
}
window.handleBulkDeleteExecute = function() {
    const checkedBoxes = document.querySelectorAll('.bulk-delete-chk:checked');
    if(checkedBoxes.length === 0) return alert("削除したい単語にチェックを入れてください。");
    const nums = Array.from(checkedBoxes).map(chk => String(chk.value));
    showCustomBulkDeleteConfirm(checkedBoxes.length, nums);
}

window.showCustomBulkResetConfirm = function(count, numsToReset) {
    if(document.getElementById('bulkResetOverlayLayer')) return;
    const overlay = document.createElement('div');
    overlay.id = 'bulkResetOverlayLayer';
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:9999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);";
    const box = document.createElement('div');
    box.style.cssText = "background:var(--card-bg); border:1px solid #10B981; border-radius:16px; padding:24px; width:85%; max-width:320px; text-align:center; box-shadow: 0 10px 30px rgba(0,0,0,0.6);";
    box.innerHTML = `
        <div style="color:white; font-size:18px; font-weight:800; margin-bottom:12px;">🔄 理解度の一括リセット</div>
        <div style="color:var(--text-sub); font-size:13px; margin-bottom:24px; line-height:1.5;">選択された <strong style="color:white;">${count}</strong> 件の単語の理解度を初期状態に戻しますか？</div>
        <div style="display:flex; gap:12px;">
            <button style="flex:1; padding:12px; border-radius:10px; border:none; background:var(--input-bg); color:var(--text-main); font-weight:700; cursor:pointer;" id="cancelBulkResetBtn">やめる</button>
            <button style="flex:1; padding:12px; border-radius:10px; border:none; background:#10B981; color:white; font-weight:700; cursor:pointer;" id="confirmBulkResetBtn">リセット</button>
        </div>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    document.getElementById('cancelBulkResetBtn').onclick = () => { document.body.removeChild(overlay); };
    document.getElementById('confirmBulkResetBtn').onclick = () => {
        vocabList.forEach(w => {
            if(numsToReset.includes(String(w.num))) {
                w.status = "none"; w.history = [];
                if(w.meanings) w.meanings.forEach(m => { m.status = "none"; m.history = []; });
            }
        });
        saveVocabToStorage(); renderVocabList(); renderBulkDeleteList();
        document.body.removeChild(overlay);
    };
}
window.handleBulkResetExecute = function() {
    const checkedBoxes = document.querySelectorAll('.bulk-delete-chk:checked');
    if(checkedBoxes.length === 0) return alert("リセットしたい単語にチェックを入れてください。");
    const nums = Array.from(checkedBoxes).map(chk => String(chk.value));
    showCustomBulkResetConfirm(checkedBoxes.length, nums);
}

window.setVocabFilter = function(filter) {
    vocabFilter = filter;
    document.querySelectorAll('.filter-scroller .pill-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('filter-' + filter).classList.add('active');
    renderVocabList();
}

window.showCustomDeleteConfirm = function(numStr) {
    if(document.getElementById('delOverlayLayer')) return;
    const overlay = document.createElement('div');
    overlay.id = 'delOverlayLayer';
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:9999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);";
    const box = document.createElement('div');
    box.style.cssText = "background:var(--card-bg); border:1px solid #EF4444; border-radius:16px; padding:24px; width:85%; max-width:320px; text-align:center; box-shadow: 0 10px 30px rgba(0,0,0,0.6);";
    box.innerHTML = `
        <div style="color:white; font-size:18px; font-weight:800; margin-bottom:12px;">⚠️ 単語の削除</div>
        <div style="color:var(--text-sub); font-size:13px; margin-bottom:24px; line-height:1.5;">単語 <strong style="color:white;">#${numStr}</strong> を完全に削除しますか？</div>
        <div style="display:flex; gap:12px;">
            <button style="flex:1; padding:12px; border-radius:10px; border:none; background:var(--input-bg); color:var(--text-main); font-weight:700; cursor:pointer;" id="cancelDelBtn">やめる</button>
            <button style="flex:1; padding:12px; border-radius:10px; border:none; background:#EF4444; color:white; font-weight:700; cursor:pointer;" id="confirmDelBtn">削除する</button>
        </div>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    document.getElementById('cancelDelBtn').onclick = () => { document.body.removeChild(overlay); };
    document.getElementById('confirmDelBtn').onclick = () => {
        vocabList = vocabList.filter(w => String(w.num) !== String(numStr));
        saveVocabToStorage(); renderVocabList(); renderBulkDeleteList();
        document.body.removeChild(overlay);
    };
}

function getCardStyleByHistory(wordObj) {
    const defaultBg = "rgba(30, 41, 59, 0.85)";
    let allHistory = [];
    if (wordObj.meanings && wordObj.meanings.length > 0) {
        wordObj.meanings.forEach(m => {
            if(m.history && m.history.length > 0) allHistory = allHistory.concat(m.history);
        });
    }
    if (allHistory.length === 0) return `background: ${defaultBg};`;

    let totalScore = 0;
    allHistory.forEach(h => {
        if (h === 'ok') totalScore += 1;
        else if (h === 'so') totalScore += 4;
        else if (h === 'bad') totalScore += 9;
    });
    
    const avg = totalScore / allHistory.length;
    const green = [16, 185, 129], yellow = [245, 158, 11], red = [239, 68, 68];
    let r, g, b;
    if (avg <= 5) {
        const ratio = (avg - 1) / (5 - 1);
        r = Math.round(green[0] + (yellow[0] - green[0]) * ratio);
        g = Math.round(green[1] + (yellow[1] - green[1]) * ratio);
        b = Math.round(green[2] + (yellow[2] - green[2]) * ratio);
    } else {
        const ratio = (avg - 5) / (9 - 5);
        r = Math.round(yellow[0] + (red[0] - yellow[0]) * ratio);
        g = Math.round(yellow[1] + (red[1] - yellow[1]) * ratio);
        b = Math.round(yellow[2] + (red[2] - yellow[2]) * ratio);
    }
    return `background: linear-gradient(135deg, rgba(${r}, ${g}, ${b}, 0.22) 0%, rgba(30, 41, 59, 0.9) 75%);`;
}

window.updateMeaningStatus = function(wordNum, meaningId, status, event) {
    if(event) event.stopPropagation();
    const wIdx = vocabList.findIndex(w => String(w.num) === String(wordNum));
    if(wIdx >= 0) {
        const mIdx = vocabList[wIdx].meanings.findIndex(m => String(m.id) === String(meaningId));
        if(mIdx >= 0) {
            if (status === 'none') {
                vocabList[wIdx].meanings[mIdx].status = 'none';
                vocabList[wIdx].meanings[mIdx].history = [];
            } else {
                vocabList[wIdx].meanings[mIdx].status = status;
                if(!vocabList[wIdx].meanings[mIdx].history) vocabList[wIdx].meanings[mIdx].history = [];
                vocabList[wIdx].meanings[mIdx].history.push(status);
                totalExp += 10;
                localStorage.setItem('core_v4_totalExp', totalExp);
                const coinEl = document.getElementById('profCoinCount');
                if(coinEl) coinEl.innerText = totalExp;
            }
            saveVocabToStorage(); 
            renderVocabList();
        }
    }
}

window.coreSystemToggleExpand = function(event, btn) {
    if(event) event.stopPropagation();
    const ex = btn.nextElementSibling;
    if(ex.style.display === 'none' || !ex.style.display) {
        ex.style.display = 'block';
        btn.innerHTML = `閉じる <i data-lucide="chevron-up" size="12"></i>`;
    } else {
        ex.style.display = 'none';
        btn.innerHTML = `サブ情報を展開 <i data-lucide="chevron-down" size="12"></i>`;
    }
    initLucide();
};

window.renderVocabList = function() {
    const container = document.getElementById('vocabListContainer'); 
    container.innerHTML = "";
    
    const startRange = parseInt(document.getElementById('vocabRangeStart').value) || 0;
    const endRange = parseInt(document.getElementById('vocabRangeEnd').value) || 99999;
    const searchKeyword = document.getElementById('vocabSearchInput').value.toLowerCase().trim();
    
    const filtered = vocabList.filter(w => {
        let n = parseInt(w.num);
        if(!isNaN(n) && (n < startRange || n > endRange)) return false;
        if(vocabFilter !== 'all' && !w.meanings.some(m => m.status === vocabFilter)) return false;
        if(searchKeyword && !(w.word.toLowerCase().includes(searchKeyword) || w.meaning.includes(searchKeyword))) return false;
        return true;
    });
    
    filtered.forEach(w => {
        const card = document.createElement('div'); 
        card.className = "word-row-container";
        card.setAttribute('style', getCardStyleByHistory(w));
        
        card.onclick = (e) => {
            if (e.target.closest('button') || e.target.closest('.word-expand-toggle')) return; 
            openWordPopoverFromVocab(e, w, w.word);
        };
        
        let hasAnyHistory = w.meanings && w.meanings.some(m => m.history && m.history.length > 0);
        let dotsHtml = "";
        if (hasAnyHistory) {
            let groupsHtml = [];
            w.meanings.forEach(m => {
                let groupHtml = `<div style="display:flex; gap:2px; align-items:center;">`;
                if (m.history && m.history.length > 0) {
                    m.history.slice(-5).forEach(h => {
                        let mark = h === 'ok' ? '◯' : h === 'so' ? '△' : '✕';
                        let bg = h === 'ok' ? '#10B981' : h === 'so' ? '#F59E0B' : '#EF4444';
                        let color = h === 'so' ? '#0F172A' : 'white';
                        groupHtml += `<span style="padding:2px 4px; border-radius:4px; font-size:9px; font-weight:800; background:${bg}; color:${color};">${mark}</span>`;
                    });
                } else {
                    groupHtml += `<span style="color:var(--text-sub); font-size:10px; padding:0 4px;">-</span>`;
                }
                groupHtml += `</div>`;
                groupsHtml.push(groupHtml);
            });

            dotsHtml = `<div style="display:flex; flex-wrap:wrap; gap:4px; align-items:center; justify-content:flex-end; margin-top:0;">`;
            groupsHtml.forEach((gh, i) => {
                dotsHtml += gh;
                if (i < groupsHtml.length - 1) {
                    if ((i + 1) % 3 === 0) {
                        dotsHtml += `<div style="flex-basis:100%; height:0;"></div>`;
                    } else {
                        dotsHtml += `<span style="color:rgba(255,255,255,0.2); font-size:12px; font-weight:bold;">/</span>`;
                    }
                }
            });
            dotsHtml += `</div>`;
        }
        
        let meaningsHtml = `<div style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 6px;">`;
        w.meanings.forEach(m => {
            meaningsHtml += `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px; border-bottom:1px dashed rgba(255,255,255,0.1); padding-bottom:4px;">
                    <span style="font-size:14px; color:white; font-weight:600; flex:1; line-height:1.4;">${m.text}</span>
                    <div style="display:flex; gap:4px; flex-shrink:0; margin-left:8px;">
                        <button style="width:24px; height:24px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:${m.status==='ok'?'var(--word-ok)':'rgba(0,0,0,0.5)'}; color:${m.status==='ok'?'#000':'white'}; font-size:10px; font-weight:900; cursor:pointer;" onclick="updateMeaningStatus('${w.num}', '${m.id}', 'ok', event)">⚪︎</button>
                        <button style="width:24px; height:24px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:${m.status==='so'?'var(--word-so)':'rgba(0,0,0,0.5)'}; color:${m.status==='so'?'#000':'white'}; font-size:10px; font-weight:900; cursor:pointer;" onclick="updateMeaningStatus('${w.num}', '${m.id}', 'so', event)">△</button>
                        <button style="width:24px; height:24px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:${m.status==='bad'?'var(--word-bad)':'rgba(0,0,0,0.5)'}; color:${m.status==='bad'?'#FFF':'white'}; font-size:10px; font-weight:900; cursor:pointer;" onclick="updateMeaningStatus('${w.num}', '${m.id}', 'bad', event)">✕</button>
                        <button style="width:24px; height:24px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:${m.status==='none'?'rgba(255,255,255,0.3)':'rgba(0,0,0,0.5)'}; color:white; font-size:10px; font-weight:900; cursor:pointer;" onclick="updateMeaningStatus('${w.num}', '${m.id}', 'none', event)">ー</button>
                    </div>
                </div>`;
        });
        meaningsHtml += `</div>`;

        card.innerHTML = `
            <button class="card-delete-btn" style="position:absolute; right:8px; top:8px; background:none; border:none; color:var(--text-sub); padding:10px; cursor:pointer; z-index:100;" onclick="event.stopPropagation(); showCustomDeleteConfirm('${w.num}')">
                <i data-lucide="trash-2" size="18"></i>
            </button>
            <div class="word-main-line" style="display:flex; justify-content:space-between; align-items:center; padding-right:36px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="word-num-badge" style="background:rgba(255,255,255,0.3); color:white; font-size:11px; font-weight:700; padding:2px 6px; border-radius:4px;">#${w.num}</span>
                    <span style="font-size:18px; font-weight:800; color:white;">${w.word}</span>
                </div>
            </div>
            ${meaningsHtml}
            ${w.sub ? `
            <div class="word-static-info" style="margin-top:4px; padding-top:0; border:none;">
                <button class="word-expand-toggle" style="background:none; border:none; color:#C7D2FE; font-size:11px; font-weight:700; cursor:pointer; padding:4px 0; display:inline-flex; align-items:center; gap:4px; z-index:40;" onclick="coreSystemToggleExpand(event, this)">
                    サブ情報を展開 <i data-lucide="chevron-down" size="12"></i>
                </button>
                <div class="word-meaning-extra" style="display:none; font-size:12.5px; color:#FFF; line-height:1.6; margin-top:6px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.25); white-space:pre-line;">
                    <div class="sub-info-block" style="background:rgba(0,0,0,0.45); padding:6px 10px; border-radius:6px; font-size:12px; color:#FFF;">${w.sub}</div>
                </div>
            </div>` : ''}
            <div style="display:flex; justify-content:flex-end; align-items:center; margin-top:12px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.1);">${dotsHtml}</div>
        `;
        container.appendChild(card);
    });
    initLucide();
}

async function callGeminiAnalyzer(rawText) {
    if (!geminiApiKey) return null;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
    const safeText = rawText.replace(/\n/g, ' ');
    const prompt = `以下の英文の「改行」をすべて無視し、ピリオド等で1文ずつに分割してください。各英文と和訳、さらに「大学受験レベルの重要文法・構文（最大3つ）」を抽出しJSONのみ出力。\nテキスト:\n${safeText}\nフォーマット:\n{"sentences":[{"text":"...","translations":"...","grammarHighlights":[{"phrase":"...","meaning":"..."}]}]}`;
    try {
        const response = await fetch(endpoint, { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) 
        });
        if (!response.ok) { if (response.status === 429) alert("API制限に達しました"); return null; }
        const data = await response.json();
        let text = data.candidates[0].content.parts[0].text.trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/); if (jsonMatch) text = jsonMatch[0];
        return JSON.parse(text);
    } catch (e) { return null; }
}

window.startAnalysisWithEmbeddedTitle = async function() {
    const rawText = document.getElementById('englishTextarea').value.trim(); 
    if(!rawText) return;
    const submitBtn = document.getElementById('analysisSubmitBtn'); 
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i data-lucide="loader" class="animate-spin" size="16"></i> 英文解析中...`; 
    initLucide();
    try { await analyzeText(rawText, document.getElementById('customTextTitle').value.trim() || `解析_${new Date().toLocaleDateString()}`); } 
    catch(err) {} 
    finally { submitBtn.disabled = false; submitBtn.innerHTML = `<i data-lucide="wand-2" size="16"></i> 英文解析`; initLucide(); }
}

async function analyzeText(rawText, assignedTitle = null) {
    if(!rawText) return; currentActiveReaderText = rawText; currentActiveTitle = assignedTitle || "無題のテキスト";
    const customJaLines = document.getElementById('customJapanesetextarea').value.trim().split('\n').filter(l => l.trim() !== '');
    if(assignedTitle) {
        textHistory = textHistory.filter(h => h.text !== rawText); 
        textHistory.unshift({ id: Date.now(), title: assignedTitle, text: rawText });
        localStorage.setItem('textHistory', JSON.stringify(textHistory)); renderHistoryList();
    }
    document.getElementById('text-input-view').style.display = 'none'; document.getElementById('text-reader-view').style.display = 'block';
    const englishContainer = document.getElementById('englishContainer'); 
    englishContainer.innerHTML = '<div style="text-align:center; padding: 60px 20px; color: var(--cosmic-cyan); font-weight: bold; font-size: 16px; display:flex; flex-direction:column; align-items:center;"><i data-lucide="loader" class="animate-spin" size="36" style="margin-bottom:16px;"></i><span>🌀 AI構文解析・和訳取得中...</span></div>';
    initLucide();
    
    let aiAnalysisResult = geminiApiKey ? await callGeminiAnalyzer(rawText) : null;
    const safeTextForBtn = rawText.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
    document.getElementById('readerCurrentTitle').innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; width:100%;">
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; max-width:260px;">📖 ${currentActiveTitle}</span>
            <button style="padding:6px 12px; font-size:11px; font-weight:bold; border-radius:6px; background:rgba(255,255,255,0.1); color:#E2E8F0; border:1px solid rgba(255,255,255,0.3); cursor:pointer; white-space:nowrap; transition:all 0.2s;" onclick="showCustomSaveBookshelfPrompt(\`${safeTextForBtn}\`, '${currentActiveTitle}')">
                <i data-lucide="folder-plus" size="12" style="vertical-align:middle; margin-right:2px;"></i> 本棚に保存する
            </button>
        </div>
    `;
    initLucide();

    englishContainer.innerHTML = ''; let totalSummaryJa = "";
    let fallbackSentences = rawText.replace(/\n/g, ' ').match(/[^.?!]+[.?!]+|[^.?!]+$/g) || [rawText];
    let sentencesData = (aiAnalysisResult && aiAnalysisResult.sentences) ? aiAnalysisResult.sentences : fallbackSentences.map(s => ({ text: s.trim(), translations: "（和訳未取得）", grammarHighlights: [] }));

    sentencesData.forEach((sData, sIdx) => {
        let sentenceText = sData.text || ""; if(!sentenceText.trim()) return;
        const block = document.createElement('div'); block.className = 'sentence-container';
        const mainContent = document.createElement('div'); mainContent.style.flex = "1";
        mainContent.innerHTML = `<span class="sentence-num">${sIdx + 1}</span>`;

        let highlights = sData.grammarHighlights || []; highlights.sort((a, b) => b.phrase.length - a.phrase.length);
        let textMarker = sentenceText; let phraseMap = {};
        highlights.forEach((h, hIdx) => {
            let pKey = `___GRAMMAR_${hIdx}___`; 
            let regex = new RegExp(h.phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
            if(textMarker.match(regex)) { textMarker = textMarker.replace(regex, pKey); phraseMap[pKey] = h; }
        });

        textMarker.split(' ').forEach(wStr => {
            if (!wStr) return; let cleanToken = wStr.trim(), isGrammar = false, grammarData = null;
            for(let key in phraseMap) { if(cleanToken.indexOf(key) !== -1) { isGrammar = true; grammarData = phraseMap[key]; wStr = wStr.replace(key, grammarData.phrase); break; } }
            let wordContainer = mainContent;
            if (isGrammar && grammarData) {
                const gSpan = document.createElement('span'); gSpan.className = 'grammar-span'; 
                gSpan.onclick = (e) => { if (e.target.classList.contains('word-span')) return; openGrammarPopover(e, grammarData.phrase, grammarData.meaning); };
                mainContent.appendChild(gSpan); wordContainer = gSpan;
            }
            const subTokens = isGrammar ? wStr.split(' ') : [wStr];
            subTokens.forEach((subToken, index) => {
                if(!subToken) return; const cleanKey = subToken.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]\"']/g,"");
                const span = document.createElement('span'); span.className = 'word-span'; span.innerText = subToken + (index < subTokens.length - 1 ? ' ' : (isGrammar ? ' ' : ' '));
                const vocabMatch = vocabList.find(v => v.word.toLowerCase() === cleanKey);
                if(vocabMatch) {
                    span.classList.add('registered'); let hasOk = false, hasBad = false, hasSo = false, hasAnyHistory = false;
                    vocabMatch.meanings.forEach(m => { if(m.history && m.history.length > 0) hasAnyHistory = true; if(m.status === 'ok') hasOk = true; if(m.status === 'so') hasSo = true; if(m.status === 'bad') hasBad = true; });
                    if(!hasAnyHistory) span.classList.add(`status-none`); else if(hasBad) span.classList.add(`status-bad`); else if(hasSo) span.classList.add(`status-so`); else if(hasOk) span.classList.add(`status-ok`);
                    span.onclick = (e) => openWordPopoverFromVocab(e, vocabMatch, subToken);
                } else {
                    const dictMatch = dictionaryData.find(d => d.en === cleanKey);
                    if(dictMatch) {
                        span.classList.add('registered'); span.classList.add(wordMemory[cleanKey] ? `status-${wordMemory[cleanKey]}` : `status-none`);
                        span.onclick = (e) => openWordPopover(e, cleanKey, subToken);
                    }
                }
                wordContainer.appendChild(span);
            });
        });
        let finalJaText = customJaLines[sIdx] || sData.translations; totalSummaryJa += `${sIdx+1}. ${finalJaText}<br>`;
        const jaSpan = document.createElement('span'); jaSpan.className = 'sentence-ja'; jaSpan.innerText = finalJaText; mainContent.appendChild(jaSpan);
        block.appendChild(mainContent); englishContainer.appendChild(block);
    });
    document.getElementById('summaryJaContainer').innerHTML = totalSummaryJa; setTranslationMode(currentTranslationMode); initLucide();
}

window.showCustomSaveBookshelfPrompt = function(text, title) {
    if(document.getElementById('saveBookshelfOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'saveBookshelfOverlay';
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:9999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);";
    const box = document.createElement('div');
    box.style.cssText = "background:var(--card-bg); border:1px solid var(--cosmic-cyan); border-radius:16px; padding:24px; width:85%; max-width:320px; text-align:center; box-shadow: 0 10px 30px rgba(0,0,0,0.6);";
    let folderOptions = myFolders.map(f => `<option value="${f}">${f}</option>`).join('');
    box.innerHTML = `
        <div style="color:white; font-size:18px; font-weight:800; margin-bottom:12px;">📁 本棚に保存</div>
        <select id="selectBookshelfFolder" class="search-input" style="width:100%; margin-bottom:12px;">${folderOptions}<option value="new_folder">➕ 新しいフォルダを作成</option></select>
        <input type="text" id="newFolderNameInput" class="search-input" placeholder="新しいフォルダ名を入力" style="display:none; width:100%; margin-bottom:16px;">
        <div style="display:flex; gap:12px; margin-top: 12px;">
            <button style="flex:1; padding:12px; border-radius:10px; border:none; background:var(--input-bg); color:var(--text-main); font-weight:700; cursor:pointer;" id="cancelSaveBookshelfBtn">キャンセル</button>
            <button style="flex:1; padding:12px; border-radius:10px; border:none; background:var(--cosmic-cyan); color:#000; font-weight:700; cursor:pointer;" id="confirmSaveBookshelfBtn">保存</button>
        </div>
    `;
    overlay.appendChild(box); document.body.appendChild(overlay);
    const selectEl = document.getElementById('selectBookshelfFolder');
    const newFolderInput = document.getElementById('newFolderNameInput');
    selectEl.onchange = (e) => { if (e.target.value === 'new_folder') { newFolderInput.style.display = 'block'; newFolderInput.focus(); } else { newFolderInput.style.display = 'none'; } };
    document.getElementById('cancelSaveBookshelfBtn').onclick = () => { document.body.removeChild(overlay); };
    document.getElementById('confirmSaveBookshelfBtn').onclick = () => {
        let folder = selectEl.value;
        if (folder === 'new_folder') { folder = newFolderInput.value.trim(); if (!folder) folder = "未分類"; }
        if(!myFolders.includes(folder)) { myFolders.push(folder); localStorage.setItem('myFolders', JSON.stringify(myFolders)); }
        if(myBookshelf.some(item => item.text === text && item.folder === folder)) { alert("すでに保存されています！"); document.body.removeChild(overlay); return; }
        myBookshelf.push({ id: Date.now(), folder: folder, title: title || "無題のテキスト", text: text });
        localStorage.setItem('myBookshelf', JSON.stringify(myBookshelf)); alert(`保存しました！`); renderBookshelf(); document.body.removeChild(overlay);
    };
}

window.renderBookshelf = function() {
    const container = document.getElementById('myBookshelfContainer'); if(!container) return; container.innerHTML = "";
    if(myBookshelf.length === 0) { container.innerHTML = `<div style="text-align:center; color:var(--text-sub); font-size:12px; padding:20px;">本棚は空です。</div>`; return; }
    const foldersData = {};
    myBookshelf.forEach(item => { if(!foldersData[item.folder]) foldersData[item.folder] = []; foldersData[item.folder].push(item); });
    for(let folderName in foldersData) {
        let folderHtml = `<div style="margin-bottom:20px; background:rgba(0,0,0,0.2); border-radius:12px; padding:12px; border:1px solid rgba(255,255,255,0.1);">
            <h3 style="color:var(--cosmic-cyan); font-size:15px; border-bottom:1px dashed rgba(0,240,255,0.3); padding-bottom:6px; margin-top:0; margin-bottom:12px; display:flex; align-items:center; gap:6px;"><i data-lucide="folder" size="16"></i> ${folderName}</h3>`;
        foldersData[folderName].forEach(item => {
            const safeText = item.text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
            folderHtml += `
                <div class="list-item-row" style="background:rgba(255,255,255,0.05); padding:10px 14px; border-radius:8px; margin-bottom:8px;">
                    <div class="list-item-title" style="flex:1;"><span><i data-lucide="file-text" size="12" style="color:var(--text-sub); margin-right:4px;"></i>${item.title}</span></div>
                    <div style="display:flex; gap:8px;">
                        <button class="list-action-link" style="background:var(--accent); border:none;" onclick="analyzeText(\`${safeText}\`, '${item.title}')">開く</button>
                        <button class="word-delete-btn" style="display:flex !important; background:none; border:none; color:#EF4444; padding:4px; cursor:pointer;" onclick="showCustomDeleteBookshelfConfirm(${item.id})"><i data-lucide="trash-2" size="14"></i></button>
                    </div>
                </div>`;
        });
        folderHtml += `</div>`; container.innerHTML += folderHtml;
    }
    initLucide();
}

window.showCustomDeleteBookshelfConfirm = function(id) {
    if(confirm("本棚から削除しますか？")) { myBookshelf = myBookshelf.filter(item => item.id !== id); localStorage.setItem('myBookshelf', JSON.stringify(myBookshelf)); renderBookshelf(); }
}
window.showCustomDeleteHistoryConfirm = function(id) {
    if(confirm("履歴から削除しますか？")) { textHistory = textHistory.filter(h => h.id !== id); localStorage.setItem('textHistory', JSON.stringify(textHistory)); renderHistoryList(); }
}

function renderHistoryList() {
    const container = document.getElementById('historyListContainer');
    if(!container) return; container.innerHTML = '';
    if(textHistory.length === 0) { container.innerHTML = `<div style="color:var(--text-sub); font-size:12px;">ログがありません</div>`; return; }
    textHistory.forEach(h => {
        const row = document.createElement('div'); row.className = 'list-item-row';
        const safeText = h.text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
        row.innerHTML = `<div class="list-item-title"><span>${h.title}</span></div>
            <div style="display:flex; gap:8px;">
                <button class="list-action-link" onclick="analyzeText(\`${safeText}\`, '${h.title}')">開く</button>
                <button class="word-delete-btn" style="display:flex !important; background:none; border:none; color:var(--text-sub);" onclick="showCustomDeleteHistoryConfirm(${h.id})"><i data-lucide="trash-2" size="14"></i></button>
            </div>`;
        container.appendChild(row);
    });
    initLucide();
}

window.openGrammarPopover = function(event, phrase, meaning) {
    if(event) event.stopPropagation(); currentTargetWordToken = null; currentTargetVocabNum = null;
    document.getElementById('popWord').innerText = phrase; document.getElementById('popWordNum').innerText = "💡 文法";
    document.getElementById('popMeaning').innerText = meaning; document.getElementById('popoverStatusBtns').style.display = "none";
    const pop = document.getElementById('wordPopover'); pop.style.display = 'flex'; pop.classList.add('show');
};

window.openWordPopoverFromVocab = function(event, vocabItem, originalText) {
    if(event) event.stopPropagation(); currentTargetWordToken = vocabItem.word.toLowerCase(); currentTargetVocabNum = vocabItem.num;
    document.getElementById('popWord').innerText = originalText; document.getElementById('popWordNum').innerText = `#${vocabItem.num}`;
    let meaningHtml = "";
    vocabItem.meanings.forEach(m => {
        meaningHtml += `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px dashed rgba(255,255,255,0.2); padding-bottom:6px;">
                <span style="font-size:14px; color:white; flex:1; line-height:1.4;">${m.text}</span>
                <div style="display:flex; gap:4px; flex-shrink:0; margin-left:8px;">
                    <button style="width:26px; height:26px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:${m.status==='ok'?'var(--word-ok)':'rgba(0,0,0,0.5)'}; color:${m.status==='ok'?'#000':'white'}; font-size:10px; font-weight:900; cursor:pointer;" onclick="updateMeaningStatusFromPopover('${vocabItem.num}', '${m.id}', 'ok', event)">⚪︎</button>
                    <button style="width:26px; height:26px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:${m.status==='so'?'var(--word-so)':'rgba(0,0,0,0.5)'}; color:${m.status==='so'?'#000':'white'}; font-size:10px; font-weight:900; cursor:pointer;" onclick="updateMeaningStatusFromPopover('${vocabItem.num}', '${m.id}', 'so', event)">△</button>
                    <button style="width:26px; height:26px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:${m.status==='bad'?'var(--word-bad)':'rgba(0,0,0,0.5)'}; color:${m.status==='bad'?'#FFF':'white'}; font-size:10px; font-weight:900; cursor:pointer;" onclick="updateMeaningStatusFromPopover('${vocabItem.num}', '${m.id}', 'bad', event)">✕</button>
                    <button style="width:26px; height:26px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:${m.status==='none'?'rgba(255,255,255,0.3)':'rgba(0,0,0,0.5)'}; color:white; font-size:10px; font-weight:900; cursor:pointer;" onclick="updateMeaningStatusFromPopover('${vocabItem.num}', '${m.id}', 'none', event)">ー</button>
                </div>
            </div>`;
    });
    document.getElementById('popMeaning').innerHTML = meaningHtml; document.getElementById('popoverStatusBtns').style.display = "none"; 
    const pop = document.getElementById('wordPopover'); pop.style.display = 'flex'; pop.classList.add('show');
}

window.updateMeaningStatusFromPopover = function(wordNum, meaningId, status, event) {
    if(event) event.stopPropagation(); window.updateMeaningStatus(wordNum, meaningId, status, null); 
    const vocabItem = vocabList.find(w => String(w.num) === String(wordNum));
    if(vocabItem) { openWordPopoverFromVocab(null, vocabItem, document.getElementById('popWord').innerText); if(currentActiveReaderText) analyzeText(currentActiveReaderText, currentActiveTitle); }
}

window.openWordPopover = function(event, cleanKey, originalText) {
    if(event) event.stopPropagation(); currentTargetWordToken = cleanKey; currentTargetVocabNum = null;
    const match = dictionaryData.find(d => d.en === cleanKey);
    document.getElementById('popWord').innerText = originalText; document.getElementById('popWordNum').innerText = "";
    document.getElementById('popMeaning').innerText = match ? match.ja : '未登録'; document.getElementById('popoverStatusBtns').style.display = "flex"; 
    const pop = document.getElementById('wordPopover'); pop.style.display = 'flex'; pop.classList.add('show');
}

window.setWordStatusFromReader = function(status) {
    if(currentTargetWordToken && !currentTargetVocabNum) {
        wordMemory[currentTargetWordToken] = status; localStorage.setItem('wordMemory', JSON.stringify(wordMemory));
        totalExp += 10; localStorage.setItem('core_v4_totalExp', totalExp);
        const coinEl = document.getElementById('profCoinCount'); if(coinEl) coinEl.innerText = totalExp;
        if(currentActiveReaderText) analyzeText(currentActiveReaderText, currentActiveTitle);
    }
    closeWordPopover();
}

window.closeWordPopover = function() { document.getElementById('wordPopover').classList.remove('show'); document.getElementById('wordPopover').style.display = 'none'; }
window.closeReader = function() { document.getElementById('text-input-view').style.display = 'block'; document.getElementById('text-reader-view').style.display = 'none'; }
window.setTranslationMode = function(mode) {
    currentTranslationMode = mode;
    document.getElementById('toggle-inline').classList.toggle('active', mode === 'inline'); document.getElementById('toggle-bottom').classList.toggle('active', mode === 'bottom');
    document.querySelectorAll('.sentence-ja').forEach(el => el.style.display = mode === 'inline' ? 'block' : 'none');
    document.getElementById('summary-ja-card').style.display = mode === 'bottom' ? 'block' : 'none';
}

function renderLeaderboard() { const container = document.getElementById('leaderboardContainer'); if(container) container.innerHTML = `<div style="padding:10px; font-size:14px; font-weight:700; color:#FFF;">プレイヤー名: ${myName} / 合計スコア: ${totalExp} PTS</div>`; }
function renderActivityChart() {
    const chart = document.getElementById('activityBarChart'); if(!chart) return; chart.innerHTML = "";
    ["月", "火", "水", "木", "金", "土", "日"].forEach(d => {
        const wrap = document.createElement('div'); wrap.className = "bar-wrapper";
        const fill = document.createElement('div'); fill.className = "bar-fill active"; fill.style.height = "50%";
        const lbl = document.createElement('div'); lbl.className = "bar-label"; lbl.innerText = d;
        wrap.appendChild(fill); wrap.appendChild(lbl); chart.appendChild(wrap);
    });
}
window.saveSidebarProfile = function() {
    geminiApiKey = document.getElementById('sidebarApiKeyInput').value.trim(); localStorage.setItem('core_v4_geminiKey', geminiApiKey);
    myName = document.getElementById('sideInputName').value.trim() || myName; myTarget = document.getElementById('sideInputTarget').value.trim() || myTarget;
    selectedTitle = document.getElementById('sideSelectTitle').value; applyProfileToUi(); toggleSidebar(false);
}
window.enterAdminModeDirect = function() { switchTab('admin'); }
window.saveAdminSystemSettings = function() { switchTab('home'); }
window.logoutToGate = function() { localStorage.clear(); location.reload(); }
window.resetLeaderboard = function() { if(confirm("ランキング履歴を一括で削除しますか？")) { ['ja2en', 'en2ja', 'mixed'].forEach(m => { ['normal', 'hard', 'expert', 'endless'].forEach(d => { localStorage.removeItem(`cosmic_score_${m}_${d}`); }); }); renderGameLeaderboard('mine'); } }
window.resetBestScore = function() { if(confirm("ベストスコアを0に戻しますか？")) { ['ja2en', 'en2ja', 'mixed'].forEach(m => { ['normal', 'hard', 'expert', 'endless'].forEach(d => { localStorage.removeItem(`cosmic_best_${m}_${d}`); }); }); } }
function resetScorePopup(popupEl) { popupEl.className = "giant-score-popup"; void popupEl.offsetWidth; }

window.renderGameLeaderboard = function(type = 'mine') {
    const modeEl = document.getElementById('lbModeSelect'), diffEl = document.getElementById('lbDiffSelect');
    const mode = modeEl ? modeEl.value : 'ja2en', diff = diffEl ? diffEl.value : 'normal';
    const container = document.getElementById('leaderboardListContainer'); if(!container) return; container.innerHTML = "";
    if (type === 'mine') {
        let history = JSON.parse(localStorage.getItem(`cosmic_score_${mode}_${diff}`) || "[]");
        if (history.length === 0) { container.innerHTML = `<div style="text-align:center; color:var(--text-sub); font-size:12px; margin-top:20px;">記録はありません</div>`; return; }
        history.forEach((record, index) => {
            container.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 8px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:13px;"><div>#${index+1} <strong>${record.score}</strong></div><div style="color:var(--text-sub); font-size:11px;">${record.date}</div></div>`;
        });
    }
}
window.switchLeaderboard = function(type) { document.getElementById('lbTabMine').classList.toggle('active', type === 'mine'); renderGameLeaderboard(type); }

async function callGeminiGameJudge(questionText, correctAnswer, userInput, qType) {
    const cLow = correctAnswer.toLowerCase().trim(), uLow = userInput.toLowerCase().trim();
    let isLocalMatch = false;
    if (qType === 'en2ja') {
        const cParts = cLow.split(',').map(p => p.trim()).filter(p => p);
        if (cParts.length > 0) isLocalMatch = cParts.some(p => p === uLow || p.includes(uLow) || uLow.includes(p));
        else isLocalMatch = cLow.includes(uLow) || uLow.includes(cLow);
    } else { if (cLow === uLow) isLocalMatch = true; }

    if (isLocalMatch) return { status: "OK", alternatives: "🎯 PERFECT!" };
    if (!geminiApiKey) return { status: "BAD", alternatives: "なし" };
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: `単語「${questionText}」の意味「${correctAnswer}」に対して「${userInput}」が正解か判定。JSON:{"judgment":"OK"または"BAD"}` }] }] })
        });
        const data = await response.json(); let text = data.candidates[0].content.parts[0].text.trim().match(/\{[\s\S]*\}/)[0];
        return { status: JSON.parse(text).judgment === "OK" ? "OK" : "BAD", alternatives: "" };
    } catch (e) { return { status: "BAD", alternatives: "" }; }
}

window.showModeSelectScreen = function() {
    if (vocabList.length === 0) return alert("単語が登録されていません。");
    document.getElementById('gameLeaderboardArea').style.display = 'none'; 
    document.getElementById('game-mode-select-screen').style.display = 'block';
}

window.selectGameMode = function(mode) {
    selectedQuestionMode = mode; 
    ['btnModeJa', 'btnModeEn', 'btnModeMix'].forEach(id => { document.getElementById(id).style.boxShadow = ''; document.getElementById(id).style.background = ''; });
    let targetId = mode === 'ja2en' ? 'btnModeJa' : mode === 'en2ja' ? 'btnModeEn' : 'btnModeMix';
    document.getElementById(targetId).style.background = 'linear-gradient(135deg, rgba(0, 240, 255, 0.4) 0%, rgba(192, 132, 252, 0.4) 100%)';
    document.getElementById('difficulty-section').style.display = 'block';
}

window.startActualGame = function(difficulty) {
    currentGameDifficulty = difficulty; gameScoreCount = 0; gameCurrentIndex = 0; gameMistakeCount = 0; gameComboCount = 0; gameComboTotalScore = 0; gameHistoryLog = []; isGameProcessingAnswer = false; isGameTimerPaused = false;
    gameCurrentWordsQueue = [];
    vocabList.forEach(w => {
        if(w.meanings && w.meanings.length > 0) {
            let qMode = selectedQuestionMode === 'mixed' ? (Math.random() > 0.5 ? 'en2ja' : 'ja2en') : selectedQuestionMode;
            if(qMode === 'en2ja') gameCurrentWordsQueue.push({ type: 'en2ja', wordNum: w.num, word: w.word, meaningId: null, correctAnswers: w.meanings.map(m => formatWordForDisplay(m.text)) });
            else w.meanings.forEach(m => { gameCurrentWordsQueue.push({ type: 'ja2en', wordNum: w.num, word: w.word, meaningId: m.id, display: formatWordForDisplay(m.text) }); });
        }
    });
    gameCurrentWordsQueue.sort(() => Math.random() - 0.5);
    gameRemainingTime = difficulty === 'normal' ? 60 : difficulty === 'hard' ? 180 : 300;

    document.getElementById('game-start-screen').style.display = 'none'; document.getElementById('game-play-screen').style.display = 'block';
    document.getElementById('gameNextBtn').style.display = 'none'; document.getElementById('feedbackContent').style.display = "none";
    document.getElementById('giantJudgmentOverlay').classList.remove('show');
    
    if (activeCharacter === 'tangon') { document.getElementById('gameActiveCharacterContainer').style.display = 'flex'; document.getElementById('gameActiveCharacterImg').src = 'tangon.png'; } 
    else { document.getElementById('gameActiveCharacterContainer').style.display = 'none'; }

    clearInterval(gameTimerInterval);
    if (difficulty !== 'endless') { gameTimerInterval = setInterval(() => { if (isGameTimerPaused) return; gameRemainingTime--; document.getElementById('gameTimerNum').innerText = gameRemainingTime; if (gameRemainingTime <= 0) endGameSession(); }, 1000); }
    showNextGameWord();
}

function showNextGameWord() {
    if (gameCurrentIndex >= gameCurrentWordsQueue.length) { gameCurrentWordsQueue.sort(() => Math.random() - 0.5); gameCurrentIndex = 0; }
    const q = gameCurrentWordsQueue[gameCurrentIndex]; currentQuestionType = q.type;
    const wordEl = document.getElementById('gameWordTarget');
    if (q.type === 'en2ja') { wordEl.innerText = q.word; document.getElementById('gameAnswerInput').placeholder = "和訳を入力..."; } 
    else { wordEl.innerText = q.display; document.getElementById('gameAnswerInput').placeholder = "英単語を入力..."; }
    document.getElementById('gameAnswerInput').value = ""; document.getElementById('gameAnswerInput').focus(); isGameProcessingAnswer = false;
}

window.submitGameAnswer = async function() {
    if (isGameProcessingAnswer) return; if (document.getElementById('gameNextBtn').style.display === 'flex') return goToNextGameWord();
    const userInput = document.getElementById('gameAnswerInput').value.trim(); if (!userInput) return;
    isGameProcessingAnswer = true; isGameTimerPaused = true;
    document.getElementById('gameAnswerInput').blur(); document.getElementById('gameSubmitBtn').style.display = 'none'; document.getElementById('gameJudgingIndicator').style.display = 'flex';

    const q = gameCurrentWordsQueue[gameCurrentIndex]; let isCorrect = false, alternatives = "";
    if (q.type === 'en2ja') {
        isCorrect = q.correctAnswers.some(ans => userInput.includes(ans) || ans.includes(userInput) || userInput === ans);
        if(!isCorrect && geminiApiKey) { const res = await callGeminiGameJudge(q.word, q.correctAnswers.join(' / '), userInput, 'en2ja'); isCorrect = res.status === "OK"; alternatives = res.alternatives; }
    } else {
        isCorrect = (userInput.toLowerCase() === q.word.toLowerCase());
        if(!isCorrect && geminiApiKey) { const res = await callGeminiGameJudge(q.display, q.word, userInput, 'ja2en'); isCorrect = res.status === "OK"; alternatives = res.alternatives; }
    }

    document.getElementById('gameJudgingIndicator').style.display = 'none'; document.getElementById('gameNextBtn').style.display = 'flex';
    const overlay = document.getElementById('giantJudgmentOverlay'), popupEl = document.getElementById('giantScorePopup'), comboContainer = document.getElementById('persistentComboContainer');
    resetScorePopup(popupEl);
    
    let updatedStatus = "bad";
    if (isCorrect) {
        let earned = 100 + (gameComboCount * 5); gameScoreCount += earned; gameComboCount++; gameComboTotalScore += earned;
        overlay.className = "giant-judgment-overlay show correct"; document.getElementById('giantJudgmentMark').innerText = "◎"; document.getElementById('giantJudgmentText').innerText = "正解";
        popupEl.innerText = "+" + gameComboTotalScore; popupEl.className = "giant-score-popup score-anim-plus";
        if(gameComboCount > 1) { document.getElementById('persistentComboText').innerText = `${gameComboCount} COMBO!`; document.getElementById('persistentComboScore').innerText = `+${gameComboTotalScore}`; comboContainer.style.display = "flex"; comboContainer.classList.add('combo-blink'); }
        updatedStatus = "ok";
    } else {
        gameScoreCount = Math.max(0, gameScoreCount - 50); gameComboCount = 0; gameComboTotalScore = 0;
        overlay.className = "giant-judgment-overlay show incorrect"; document.getElementById('giantJudgmentMark').innerText = "✕"; document.getElementById('giantJudgmentText').innerText = "不正解";
        popupEl.innerText = "-50"; popupEl.className = "giant-score-popup score-anim-minus"; comboContainer.style.display = "none"; comboContainer.classList.remove('combo-blink');
        if (currentGameDifficulty === 'endless') { gameMistakeCount++; document.getElementById('gameTimerNum').innerText = "❤️".repeat(5 - gameMistakeCount) + "🖤".repeat(gameMistakeCount); }
    }
    
    document.getElementById('gameScoreNum').innerText = String(gameScoreCount).padStart(4, '0');
    const targetVocab = vocabList.find(w => w.num === q.wordNum);
    if(targetVocab) {
        if(q.type === 'ja2en' && q.meaningId) { const m = targetVocab.meanings.find(x => x.id === q.meaningId); if(m) { m.status = updatedStatus; if(!m.history) m.history=[]; m.history.push(updatedStatus); } }
        else if(targetVocab.meanings.length > 0) { targetVocab.meanings[0].status = updatedStatus; if(!targetVocab.meanings[0].history) targetVocab.meanings[0].history = []; targetVocab.meanings[0].history.push(updatedStatus); }
        targetVocab.status = updatedStatus; if(!targetVocab.history) targetVocab.history = []; targetVocab.history.push(updatedStatus); saveVocabToStorage();
    }

    gameHistoryLog.push({ word: q.type === 'en2ja' ? q.word : q.display, user: userInput, correct: q.type === 'en2ja' ? q.correctAnswers.join(', ') : q.word, isCorrect: isCorrect });
    document.getElementById('feedbackContent').style.display = "block"; document.getElementById('feedbackUserAns').innerText = userInput; document.getElementById('feedbackCorrectAns').innerText = q.type === 'en2ja' ? q.correctAnswers.join(', ') : q.word;
    if (alternatives && alternatives !== "特になし") { document.getElementById('feedbackOtherAns').innerText = alternatives; document.getElementById('feedbackDiffAnswersRow').style.display = "block"; } 
    else { document.getElementById('feedbackDiffAnswersRow').style.display = "none"; }
}

window.goToNextGameWord = function() {
    if (currentGameDifficulty === 'endless' && gameMistakeCount >= 5) return endGameSession();
    document.getElementById('gameNextBtn').style.display = 'none'; document.getElementById('gameSubmitBtn').style.display = 'flex'; document.getElementById('feedbackContent').style.display = "none"; 
    document.getElementById('giantJudgmentOverlay').classList.remove('show'); document.getElementById('persistentComboContainer').style.display = "none"; document.getElementById('persistentComboContainer').classList.remove('combo-blink');
    isGameTimerPaused = false; gameCurrentIndex++; showNextGameWord();
};

window.endGameSession = function() {
    clearInterval(gameTimerInterval); document.getElementById('game-play-screen').style.display = 'none'; document.getElementById('game-result-screen').style.display = 'block';
    if (gameScoreCount > 0) {
        let history = JSON.parse(localStorage.getItem(`cosmic_score_${selectedQuestionMode}_${currentGameDifficulty}`) || "[]");
        history.push({ score: gameScoreCount, date: new Date().toLocaleDateString() }); history.sort((a, b) => b.score - a.score); history = history.slice(0, 5); localStorage.setItem(`cosmic_score_${selectedQuestionMode}_${currentGameDifficulty}`, JSON.stringify(history));
        gameBestScore = parseInt(localStorage.getItem(`cosmic_best_${selectedQuestionMode}_${currentGameDifficulty}`) || "0"); if (gameScoreCount > gameBestScore) { localStorage.setItem(`cosmic_best_${selectedQuestionMode}_${currentGameDifficulty}`, gameScoreCount); gameBestScore = gameScoreCount; }
    }
    const accuracy = gameHistoryLog.length > 0 ? Math.round((gameHistoryLog.filter(h => h.isCorrect).length / gameHistoryLog.length) * 100) : 0;
    document.getElementById('resScore').innerText = gameScoreCount; document.getElementById('resAccuracy').innerText = `${accuracy}%`; document.getElementById('resBestScore').innerText = gameBestScore; document.getElementById('resCommBest').innerText = Math.max(gameBestScore, 2800);
    const listContainer = document.getElementById('gameHistoryListContainer'); listContainer.innerHTML = "";
    if (gameHistoryLog.length === 0) listContainer.innerHTML = `<div style="text-align:center; color:var(--text-sub); padding:12px; font-size:12px;">ログがありません</div>`;
    else gameHistoryLog.forEach(item => { listContainer.innerHTML += `<div class="cosmic-history-item"><span class="cosmic-res-mark ${item.isCorrect ? 'ok' : 'bad'}">${item.isCorrect ? '◎' : '✕'}</span><div style="flex:1;"><div style="font-weight:800; color:white; font-size:13px;">${item.word.replace(/\n/g, ' ')}</div><div style="color:var(--text-sub); margin-top:2px;">あなたの回答: <span style="color:white;">${item.user || '(空欄)'}</span></div><div style="color:var(--word-ok); font-size:11px; margin-top:1px;">正答: ${item.correct}</div></div></div>`; });
    renderVocabList(); initLucide();
}

window.backToGameMenu = function() { document.getElementById('game-mode-select-screen').style.display = 'none'; document.getElementById('game-result-screen').style.display = 'none'; document.getElementById('game-start-screen').style.display = 'flex'; document.getElementById('gameLeaderboardArea').style.display = 'flex'; renderGameLeaderboard('mine'); }

// ==========================================================================
// ⚔️ パーティ・装備編成とマルチバトル
// ==========================================================================
window.switchPartySubCategory = function(category) {
    document.getElementById('partyTabChar').classList.toggle('active', category === 'character'); document.getElementById('partyTabWeapon').classList.toggle('active', category === 'weapon'); document.getElementById('partyTabArmor').classList.toggle('active', category === 'armor');
    document.getElementById('partyBoxCharacter').style.display = category === 'character' ? 'grid' : 'none'; document.getElementById('partyBoxWeapon').style.display = category === 'weapon' ? 'grid' : 'none'; document.getElementById('partyBoxArmor').style.display = category === 'armor' ? 'grid' : 'none';
}
window.selectCharacter = function(charId) { activeCharacter = charId; localStorage.setItem('core_v4_active_char', charId); updatePartySlotsUi(); alert(charId ? 'キャラクターをセットしたよ！' : 'キャラクターの編成を外したよ。'); }
window.selectWeapon = function(weaponId) { activeWeapon = weaponId; localStorage.setItem('core_v4_active_weapon', weaponId); updatePartySlotsUi(); alert(weaponId ? '武器を装備したよ！' : '武器を外したよ。'); }
window.selectArmor = function(armorId) { activeArmor = armorId; localStorage.setItem('core_v4_active_armor', armorId); updatePartySlotsUi(); alert(armorId ? '防具を装備したよ！' : '防具を外したよ。'); }

window.updatePartySlotsUi = function() {
    const charImgFrame = document.getElementById('slotCharImgContainer'), charNameLbl = document.getElementById('slotCharName');
    if (activeCharacter === 'tangon') { charImgFrame.innerHTML = `<img src="tangon.png" alt="tangon" style="width:100%;height:100%;object-fit:cover;">`; charNameLbl.innerText = "タンゴン"; } else { charImgFrame.innerHTML = "🫙"; charNameLbl.innerText = "未編成"; }
    const weaponImgFrame = document.getElementById('slotWeaponImgContainer'), weaponNameLbl = document.getElementById('slotWeaponName');
    if (activeWeapon === 'fire_sword') { weaponImgFrame.innerHTML = "🔥🗡️"; weaponNameLbl.innerText = "業火の大剣"; } else { weaponImgFrame.innerHTML = "🗡️"; weaponNameLbl.innerText = "素手"; }
    const armorImgFrame = document.getElementById('slotArmorImgContainer'), armorNameLbl = document.getElementById('slotArmorName');
    if (activeArmor === 'cosmic_shield') { armorImgFrame.innerHTML = "🔮🛡️"; armorNameLbl.innerText = "星屑の盾"; } else { armorImgFrame.innerHTML = "🛡️"; armorNameLbl.innerText = "布の服"; }
    const battleThumb = document.getElementById('multiAllyCharThumbnail');
    if (battleThumb) { battleThumb.innerHTML = activeCharacter === 'tangon' ? `<img src="tangon.png" alt="thumb">` : "👤"; }
}

window.showMultiBattleSetup = function() { if (vocabList.length === 0) return alert("単語が登録されていません。"); document.getElementById('game-start-screen').style.display = 'none'; document.getElementById('multi-battle-setup-screen').style.display = 'block'; document.getElementById('multi-battle-matching-screen').style.display = 'none'; document.getElementById('multi-battle-play-screen').style.display = 'none'; window.selectMultiMode('coop'); }
window.selectMultiMode = function(mode) { 
    currentMultiMode = mode; 
    document.getElementById('btnMultiCoop').style.background = ''; document.getElementById('btnMultiCoop').style.boxShadow = ''; document.getElementById('btnMultiPvp').style.background = ''; document.getElementById('btnMultiPvp').style.boxShadow = '';
    if (mode === 'coop') { document.getElementById('btnMultiCoop').style.background = 'linear-gradient(135deg, rgba(0, 240, 255, 0.4) 0%, rgba(192, 132, 252, 0.4) 100%)'; document.getElementById('btnMultiCoop').style.boxShadow = '0 0 20px rgba(0, 240, 255, 0.6)'; } 
    else { document.getElementById('btnMultiPvp').style.background = 'linear-gradient(135deg, rgba(236, 72, 153, 0.4) 0%, rgba(244, 63, 94, 0.4) 100%)'; document.getElementById('btnMultiPvp').style.boxShadow = '0 0 20px rgba(236, 72, 153, 0.6)'; }
}
window.cancelMultiBattleSetup = function() { document.getElementById('multi-battle-setup-screen').style.display = 'none'; document.getElementById('game-start-screen').style.display = 'flex'; }
window.startMultiBattleMatching = function() { document.getElementById('multi-battle-setup-screen').style.display = 'none'; document.getElementById('multi-battle-matching-screen').style.display = 'flex'; setTimeout(() => { if (document.getElementById('multi-battle-matching-screen').style.display === 'flex') { startMultiBattlePlay(); } }, 2000); }
window.cancelMultiBattleMatching = function() { document.getElementById('multi-battle-matching-screen').style.display = 'none'; document.getElementById('multi-battle-setup-screen').style.display = 'block'; }

window.startMultiBattlePlay = function() {
    document.getElementById('multi-battle-matching-screen').style.display = 'none'; document.getElementById('multi-battle-play-screen').style.display = 'flex'; window.setMultiStance('atk'); gameComboCount = 0; updatePartySlotsUi();
    const playerCount = parseInt(document.getElementById('multiPlayerCount').value) || 2;
    multiBossMaxHp = 100000 * playerCount; multiBossHp = multiBossMaxHp; multiAllyMaxHp = 3500 * playerCount; multiAllyHp = multiAllyMaxHp; multiEnemyTimeLeft = 10;
    updateMultiHpBars();
    gameCurrentWordsQueue = []; vocabList.forEach(w => { if(w.meanings && w.meanings.length > 0) gameCurrentWordsQueue.push({ wordNum: w.num, word: w.word, meaning: formatWordForDisplay(w.meanings[0].text) }); });
    gameCurrentWordsQueue.sort(() => Math.random() - 0.5); gameCurrentIndex = 0;
    clearInterval(gameTimerInterval); gameTimerInterval = setInterval(handleMultiBattleTimer, 100); showNextMultiWord(); initMultiBattleEvents();
}

function updateMultiHpBars() {
    const ally = document.getElementById('multiAllyHpFill'); if(ally) ally.style.width = Math.max(0, (multiAllyHp / multiAllyMaxHp) * 100) + "%";
    const allyTxt = document.getElementById('multiAllyHpText'); if(allyTxt) allyTxt.innerText = `HP: ${Math.max(0, Math.floor(multiAllyHp))} / ${multiAllyMaxHp}`;
    const boss = document.getElementById('multiBossHpFill'); if(boss) boss.style.width = Math.max(0, (multiBossHp / multiBossMaxHp) * 100) + "%";
    const bossTxt = document.getElementById('multiEnemyHpText'); if(bossTxt) bossTxt.innerText = `HP: ${Math.max(0, Math.floor(multiBossHp))} / ${multiBossMaxHp}`;
}

function handleMultiBattleTimer() {
    multiEnemyTimeLeft -= 0.1;
    if(multiEnemyTimeLeft <= 0) {
        multiEnemyTimeLeft = 10; let damage = currentStance === 'def' ? 400 : 800; multiAllyHp -= damage;
        document.body.classList.add('boss-damage-shake'); setTimeout(() => document.body.classList.remove('boss-damage-shake'), 300);
        if(multiAllyHp <= 0) { clearInterval(gameTimerInterval); alert("全滅しました..."); cancelMultiBattlePlay(true); return; }
    }
    const timerDisplay = document.getElementById('multiEnemyTimerDisplay'); if(timerDisplay) timerDisplay.innerText = `敵の攻撃まで: ${Math.max(0, multiEnemyTimeLeft).toFixed(1)}秒`;
    updateMultiHpBars();
}

function showNextMultiWord() {
    if(gameCurrentIndex >= gameCurrentWordsQueue.length) { gameCurrentWordsQueue.sort(() => Math.random() - 0.5); gameCurrentIndex = 0; }
    const target = gameCurrentWordsQueue[gameCurrentIndex]; document.getElementById('flickTargetWord').innerText = target.word;
    let choices = [target.meaning]; let dummies = [...gameCurrentWordsQueue].filter(w => w.word !== target.word).map(w => w.meaning);
    dummies.sort(() => Math.random() - 0.5); choices = choices.concat(dummies.slice(0, 7)).sort(() => Math.random() - 0.5);
    currentMultiCorrectIndex = choices.indexOf(target.meaning);
    for(let i=0; i<8; i++) { let el = document.getElementById('multiChoice-' + i); if(el) { el.innerText = choices[i]; el.classList.remove('highlight'); } }
    const icon = document.getElementById('flickWeaponIcon'); if(icon) { icon.style.left = '50%'; icon.style.top = '50%'; }
}

window.cancelMultiBattlePlay = function(force = false) { if(force || confirm("バトルから逃走しますか？")) { clearInterval(gameTimerInterval); document.getElementById('multi-battle-play-screen').style.display = 'none'; document.getElementById('game-start-screen').style.display = 'flex'; } }
window.setMultiStance = function(stance) { currentStance = stance; document.getElementById('stanceAtkBtn').classList.toggle('active', stance === 'atk'); document.getElementById('stanceDefBtn').classList.toggle('active', stance === 'def'); }

function initMultiBattleEvents() {
    const pad = document.getElementById('flickPadArea');
    if(pad && !pad.dataset.eventsBound) {
        pad.dataset.eventsBound = "true";
        pad.addEventListener('touchstart', handleFlickStart, {passive: false});
        pad.addEventListener('touchmove', handleFlickMove, {passive: false});
        pad.addEventListener('touchend', handleFlickEnd);
    }
}

function handleFlickStart(e) { e.preventDefault(); const touch = e.touches[0]; const rect = document.getElementById('flickPadArea').getBoundingClientRect(); flickStartX = touch.clientX - rect.left; flickStartY = touch.clientY - rect.top; isFlicking = true; currentFlickChoice = -1; }
function handleFlickMove(e) {
    if(!isFlicking) return; e.preventDefault(); const touch = e.touches[0]; const rect = document.getElementById('flickPadArea').getBoundingClientRect();
    let dx = (touch.clientX - rect.left) - flickStartX, dy = (touch.clientY - rect.top) - flickStartY, distance = Math.sqrt(dx*dx + dy*dy);
    const icon = document.getElementById('flickWeaponIcon'); if(icon) { icon.style.left = `calc(50% + ${dx}px)`; icon.style.top = `calc(50% + ${dy}px)`; }
    for(let i=0; i<8; i++) { let el = document.getElementById('multiChoice-' + i); if(el) el.classList.remove('highlight'); }
    if(distance > 24) {
        let angle = Math.atan2(dy, dx) * 180 / Math.PI; if(angle < 0) angle += 360;
        let sector = Math.round(angle / 45) % 8; let choiceMap = { 0: 4, 1: 7, 2: 6, 3: 5, 4: 3, 5: 0, 6: 1, 7: 2 };
        currentFlickChoice = choiceMap[sector]; let el = document.getElementById('multiChoice-' + currentFlickChoice); if(el) el.classList.add('highlight');
    } else { currentFlickChoice = -1; }
}

function handleFlickEnd(e) {
    if(!isFlicking) return; isFlicking = false;
    for(let i=0; i<8; i++) { let el = document.getElementById('multiChoice-' + i); if(el) el.classList.remove('highlight'); }
    if(currentFlickChoice !== -1) { processMultiFlickAnswer(currentFlickChoice); } 
    else { const icon = document.getElementById('flickWeaponIcon'); if(icon) { icon.style.transition = 'all 0.15s cubic-bezier(0.25, 1, 0.5, 1)'; icon.style.left = '50%'; icon.style.top = '50%'; setTimeout(() => { icon.style.transition = 'none'; }, 150); } }
}

function processMultiFlickAnswer(choiceIndex) {
    if(choiceIndex === currentMultiCorrectIndex) {
        gameComboCount++; createFireballEffect();
        const thumb = document.getElementById('multiAllyCharThumbnail');
        if(thumb) { thumb.classList.remove('companion-attack-active'); void thumb.offsetWidth; thumb.classList.add('companion-attack-active'); setTimeout(() => thumb.classList.remove('companion-attack-active'), 450); }
        
        // 攻撃時の画面の揺れ（boss-damage-shake）をオフにしました。
        // （ダメージを受けた時のみ揺れるようにしています）

        let comboMulti = 1 + Math.floor(gameComboCount / 5) * 0.5;
        if(currentStance === 'atk') multiBossHp -= 400 * comboMulti; else multiAllyHp = Math.min(multiAllyMaxHp, multiAllyHp + 100 * comboMulti); 
        if (multiBossHp <= 0) { clearInterval(gameTimerInterval); alert("🎉 BOSS討伐完了！クエストクリア！"); window.cancelMultiBattlePlay(true); return; }
    } else { gameComboCount = 0; multiEnemyTimeLeft = Math.max(0, multiEnemyTimeLeft - 3); }
    updateMultiHpBars(); gameCurrentIndex++; showNextMultiWord();
}

function createFireballEffect() {
    const layer = document.getElementById('battle-effects-layer'); if(!layer) return;
    const p = document.createElement('div'); p.className = 'fireball-particle';
    const pad = document.getElementById('flickPadArea'); const rect = pad.getBoundingClientRect();
    p.style.left = (rect.left + rect.width/2) + 'px'; p.style.top = (rect.top + rect.height/2) + 'px';
    p.style.setProperty('--tx', (Math.random() * 80 - 40) + 'px'); p.style.setProperty('--ty', '-160px'); 
    layer.appendChild(p); setTimeout(() => { p.remove(); }, 400);
}
