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

// ==========================================================================
// 📦 配布用・固定マスター単語データ
// ==========================================================================
const SHARED_DEFAULT_VOCAB_DATA = [];

let dictionaryData = [];
const customSamples = {}; 

for(let i = 1; i <= 100; i++) {
    dictionaryData.push({
        num: i,
        en: customSamples[i] ? customSamples[i].en : `token-${i}`,
        ja: customSamples[i] ? customSamples[i].ja : `単語インデックス No.${i} に紐付く日本語対訳データ`,
        detail: customSamples[i] ? customSamples[i].detail : `インデックス No.${i} に関する構造化解説および定義ログです。`
    });
}

let wordMemory = JSON.parse(localStorage.getItem('wordMemory')) || {};
let savedSentences = JSON.parse(localStorage.getItem('savedSentences')) || [];
let textHistory = JSON.parse(localStorage.getItem('textHistory')) || [];
let currentTranslationMode = 'inline';
let currentActiveReaderText = "";
let currentTargetWordToken = null;
let currentTargetVocabNum = null; 

let gameTimerInterval = null;
let gameRemainingTime = 45; 
let gameScoreCount = 0; 
let gameCurrentWordsQueue = [];
let gameCurrentIndex = 0;
let isGameProcessingAnswer = false;
let isGameTimerPaused = false;

window.addEventListener('DOMContentLoaded', () => {
    initLucide();
    loadLocalState();
    renderActivityChart();
    initHeroSlider();

    window.addEventListener('scroll', () => {
        const topBtn = document.getElementById('scrollToTopBtn');
        if (window.scrollY > 300) {
            topBtn.classList.add('show');
        } else {
            topBtn.classList.remove('show');
        }
    });
});

function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
function initLucide() { if(window.lucide) { window.lucide.createIcons(); } }

window.initHeroSlider = function() {
    const track = document.getElementById('heroSliderTrack');
    if (!track) return;
    let currentSlide = 0;
    const totalSlides = 5; 
    
    setInterval(() => {
        currentSlide = (currentSlide + 1) % totalSlides;
        track.style.transform = `translateX(-${currentSlide * 20}%)`;
    }, 4000);
}

function loadLocalState() {
    const savedId = localStorage.getItem('core_v4_userId');
    geminiApiKey = localStorage.getItem('core_v4_geminiKey') || "";
    
    const apiKeyInput = document.getElementById('sidebarApiKeyInput');
    if(apiKeyInput) apiKeyInput.value = geminiApiKey;

    const savedTitleText = localStorage.getItem('core_v4_dashboard_title') || "ダッシュボード";
    const headerTitleEl = document.getElementById('headerTitleText');
    if (headerTitleEl) headerTitleEl.innerText = savedTitleText;
    const adminTitleInput = document.getElementById('adminDashboardTitleInput');
    if (adminTitleInput) adminTitleInput.value = savedTitleText;

    if(savedId) {
        myId = savedId;
        document.getElementById('auth-gate-screen').style.display = 'none';
        myName = localStorage.getItem('core_v4_userName') || "プレイヤー1";
        myTarget = localStorage.getItem('core_v4_userTarget') || "未設定";
        selectedTitle = localStorage.getItem('core_v4_userTitle') || "称号なし";
        totalExp = parseInt(localStorage.getItem('core_v4_totalExp') || "0");

        let storedWords = [];
        try {
            storedWords = JSON.parse(localStorage.getItem('core_v4_custom_words_' + myId) || "[]");
        } catch(e) { storedWords = []; }

        if (storedWords.length === 0) {
            storedWords = SHARED_DEFAULT_VOCAB_DATA.map(w => ({
                num: w.num,
                word: w.word,
                meaning: w.meaning,
                sub: w.sub,
                status: "none",
                history: []
            }));
            localStorage.setItem('core_v4_custom_words_' + myId, JSON.stringify(storedWords));
        }
        
        vocabList = storedWords;
        applyProfileToUi();
        renderVocabList();
        renderLeaderboard();
        renderHistoryList();
        renderSavedSentences();
        
        renderGameLeaderboard('mine');
    } else {
        document.getElementById('auth-gate-screen').style.display = 'flex';
    }
}

window.switchAuthMode = function(mode) {
    const tabLogin = document.getElementById('authTabLogin');
    const tabRegister = document.getElementById('authTabRegister');
    const extraFields = document.getElementById('registerExtraFields');
    const submitBtn = document.getElementById('authSubmitBtn');

    if(mode === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        extraFields.style.display = 'none';
        submitBtn.innerHTML = 'システムへログインする <i data-lucide="arrow-right" size="16"></i>';
    } else {
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
        extraFields.style.display = 'block';
        submitBtn.innerHTML = 'アカウントを作成 <i data-lucide="sparkles" size="16"></i>';
    }
    initLucide();
}

window.handleAuthSubmit = function() {
    const idInput = document.getElementById('gateUserIdInput').value.trim();
    if(!idInput) return alert("ユーザーIDを入力してください。");

    const isRegister = document.getElementById('authTabRegister').classList.contains('active');
    if(isRegister) {
        const nameInput = document.getElementById('gateUserNameInput').value.trim();
        const targetInput = document.getElementById('gateUserTargetInput').value.trim();
        localStorage.setItem('core_v4_userId', idInput);
        localStorage.setItem('core_v4_userName', nameInput || "プレイヤー1");
        localStorage.setItem('core_v4_userTarget', targetInput || "未設定");
        localStorage.setItem('core_v4_totalExp', "0");
    } else {
        localStorage.setItem('core_v4_userId', idInput);
    }
    loadLocalState();
}

function applyProfileToUi() {
    document.getElementById('sideOptPlayerName').innerText = myName;
    document.getElementById('sideOptGroupName').innerText = "ID: " + myId;
    document.getElementById('sideInputName').value = myName;
    document.getElementById('sideInputTarget').value = myTarget;
    document.getElementById('sideSelectTitle').value = selectedTitle;
    document.getElementById('profPlayerName').innerText = myName;
    document.getElementById('profTitleLabel').innerText = selectedTitle + " ⚡";
    document.getElementById('profTargetLabel').innerText = "目標: " + myTarget;
    document.getElementById('profCoinCount').innerText = totalExp;
}

window.toggleSidebar = function(open) {
    const menu = document.getElementById('sidebarMenu');
    const overlay = document.getElementById('sidebarOverlay');
    if(menu) menu.classList.toggle('open', open);
    if(overlay) overlay.style.display = open ? 'block' : 'none';
}

window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
    const targetView = document.getElementById('view-' + tabId);
    if(targetView) targetView.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const activeNav = document.getElementById('nav-' + tabId);
    if(activeNav) activeNav.classList.add('active');

    toggleSidebar(false);
    if(tabId !== 'reader') closeReader();
    
    if(tabId === 'game') {
        renderGameLeaderboard('mine');
    }
}

window.toggleBulkImportCard = function() {
    const section = document.getElementById('bulkImportToggleSection');
    const isOpen = section.style.display === 'none';
    section.style.display = isOpen ? 'block' : 'none';
    if(isOpen) { renderBulkDeleteList(); }
}

window.handleBulkWordImport = function() {
    const text = document.getElementById('bulkWordInput').value.trim();
    if(!text) return;
    
    if (text.startsWith("[") && text.endsWith("]")) {
        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].word) {
                if (confirm(`バックアップデータから ${parsed.length} 件の単語を完全に上書きインポートしますか？`)) {
                    vocabList = parsed;
                    saveVocabToStorage();
                    renderVocabList();
                    document.getElementById('bulkWordInput').value = "";
                    renderBulkDeleteList();
                    alert("単語帳データを正常に復元・統合しました！");
                    return;
                }
            }
        } catch(e) { }
    }

    const lines = text.split('\n');
    lines.forEach(line => {
        const parts = line.split(':');
        if(parts.length >= 3) {
            const num = parts[0].trim();
            const word = parts[1].trim();
            
            let meaning = parts[2].trim();
            meaning = meaning.replace(/(動|名|形|副|代|接|前|接続|間投|助動|自動|他動)[:：]\s*/g, '');
            meaning = meaning.replace(/〜[をにがとへでや]\s*/g, '');
            meaning = meaning.replace(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/g, ' ,   ');
            meaning = meaning.replace(/^[ ,　]+/, '').trim();
            meaning = meaning.replace(/\n/g, ' ');
            
            const sub = parts[3] ? parts[3].trim() : "";
            
            if(num && word && meaning) {
                const existingIdx = vocabList.findIndex(w => String(w.num) === String(num));
                const wordObj = { num: num, word: word, meaning: meaning, sub: sub, status: "none", history: [] };
                if(existingIdx >= 0) {
                    vocabList[existingIdx].word = word;
                    vocabList[existingIdx].meaning = meaning;
                    vocabList[existingIdx].sub = sub;
                } else {
                    vocabList.push(wordObj);
                }
            }
        }
    });
    
    vocabList.sort((a,b) => parseInt(a.num) - parseInt(b.num));
    saveVocabToStorage();
    renderVocabList();
    document.getElementById('bulkWordInput').value = "";
    renderBulkDeleteList();
    alert("一括インポートが完了しました。");
}

function exportVocabToClipboard() {
    if (vocabList.length === 0) return alert("エクスポートする単語がありません。");
    const jsonStr = JSON.stringify(vocabList);
    navigator.clipboard.writeText(jsonStr).then(() => {
        alert("単語帳の全データをクリップボードにまとめコピーしました！");
    }).catch(err => {
        alert("コピーに失敗しました。");
    });
}

function exportVocabToFile() {
    if (vocabList.length === 0) return alert("エクスポートする単語がありません。");
    const jsonStr = JSON.stringify(vocabList, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `core_vocab_backup_${myId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function renderBulkDeleteList() {
    const container = document.getElementById('bulkDeleteListContainer');
    if(!container) return; container.innerHTML = "";
    if(vocabList.length === 0) {
        container.innerHTML = `<div style="font-size:12px; color:var(--text-sub); text-align:center; padding:10px;">登録された単語はありません</div>`;
        return;
    }
    vocabList.forEach(w => {
        const row = document.createElement('div');
        row.style.cssText = "display:flex; align-items:center; gap:8px; padding:6px 4px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:13px;";
        const flatMeaning = w.meaning.replace(/\n/g, " ");
        row.innerHTML = `
            <input type="checkbox" class="bulk-delete-chk" value="${w.num}" style="width:16px; height:16px; cursor:pointer;">
            <span style="color:var(--text-sub); font-family:monospace; font-size:11px;">#${w.num}</span>
            <strong style="color:white;">${w.word}</strong>
            <span style="color:var(--text-sub); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:150px;">(${flatMeaning})</span>
        `;
        container.appendChild(row);
    });
}

window.selectAllBulkDelete = function(checked) {
    document.querySelectorAll('.bulk-delete-chk').forEach(chk => chk.checked = checked);
}

window.showCustomBulkDeleteConfirm = function(count, numsToDelete) {
    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:9999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);";
    
    const box = document.createElement('div');
    box.style.cssText = "background:var(--card-bg); border:1px solid #EF4444; border-radius:16px; padding:24px; width:85%; max-width:320px; text-align:center; box-shadow: 0 10px 30px rgba(0,0,0,0.6);";
    
    box.innerHTML = `
        <div style="color:white; font-size:18px; font-weight:800; margin-bottom:12px;">
            ⚠️ 一括削除
        </div>
        <div style="color:var(--text-sub); font-size:13px; margin-bottom:24px; line-height:1.5;">
            選択された <strong style="color:white;">${count}</strong> 件の単語を完全に削除しますか？<br>この操作は元に戻せません。
        </div>
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
        saveVocabToStorage();
        renderVocabList();
        renderBulkDeleteList();
        document.body.removeChild(overlay);
    };
}

window.handleBulkDeleteExecute = function() {
    const checkedBoxes = document.querySelectorAll('.bulk-delete-chk:checked');
    if(checkedBoxes.length === 0) return alert("削除したい単語にチェックを入れてください。");
    const numsToDelete = Array.from(checkedBoxes).map(chk => String(chk.value));
    showCustomBulkDeleteConfirm(checkedBoxes.length, numsToDelete);
}

window.showCustomBulkResetConfirm = function(count, numsToReset) {
    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:9999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);";
    
    const box = document.createElement('div');
    box.style.cssText = "background:var(--card-bg); border:1px solid #10B981; border-radius:16px; padding:24px; width:85%; max-width:320px; text-align:center; box-shadow: 0 10px 30px rgba(0,0,0,0.6);";
    
    box.innerHTML = `
        <div style="color:white; font-size:18px; font-weight:800; margin-bottom:12px;">
            🔄 理解度の一括リセット
        </div>
        <div style="color:var(--text-sub); font-size:13px; margin-bottom:24px; line-height:1.5;">
            選択された <strong style="color:white;">${count}</strong> 件の単語の理解度（ステータスや履歴）を初期状態に戻しますか？
        </div>
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
                w.status = "none";
                w.history = [];
            }
        });
        saveVocabToStorage();
        renderVocabList();
        renderBulkDeleteList();
        document.body.removeChild(overlay);
        alert(`${count}件の単語の理解度をリセットしました。`);
    };
}

window.handleBulkResetExecute = function() {
    const checkedBoxes = document.querySelectorAll('.bulk-delete-chk:checked');
    if(checkedBoxes.length === 0) return alert("理解度をリセットしたい単語にチェックを入れてください。");
    const numsToReset = Array.from(checkedBoxes).map(chk => String(chk.value));
    showCustomBulkResetConfirm(checkedBoxes.length, numsToReset);
}

function saveVocabToStorage() {
    localStorage.setItem('core_v4_custom_words_' + myId, JSON.stringify(vocabList));
}

window.setVocabFilter = function(filter) {
    vocabFilter = filter;
    document.querySelectorAll('.filter-scroller .pill-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('filter-' + filter).classList.add('active');
    renderVocabList();
}

function getCardStyleByHistory(history) {
    if (!history || history.length === 0) return `background: rgba(15, 23, 42, 0.45);`;
    const recent = history.slice(-5);
    let totalScore = 0;
    recent.forEach(h => {
        if (h === 'ok') totalScore += 1;
        else if (h === 'so') totalScore += 4;
        else if (h === 'bad') totalScore += 9;
    });
    const avg = totalScore / recent.length;
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
    return `background: linear-gradient(135deg, rgba(${r}, ${g}, ${b}, 0.25) 0%, rgba(15, 23, 42, 0.5) 75%);`;
}

window.showCustomDeleteConfirm = function(numStr) {
    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:9999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);";
    
    const box = document.createElement('div');
    box.style.cssText = "background:var(--card-bg); border:1px solid #EF4444; border-radius:16px; padding:24px; width:85%; max-width:320px; text-align:center; box-shadow: 0 10px 30px rgba(0,0,0,0.6);";
    
    box.innerHTML = `
        <div style="color:white; font-size:18px; font-weight:800; margin-bottom:12px;">
            ⚠️ 単語の削除
        </div>
        <div style="color:var(--text-sub); font-size:13px; margin-bottom:24px; line-height:1.5;">
            単語 <strong style="color:white;">#${numStr}</strong> を完全に削除しますか？<br>この操作は元に戻せません。
        </div>
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
        saveVocabToStorage();
        renderVocabList();
        renderBulkDeleteList();
        document.body.removeChild(overlay);
    };
}

window.coreSystemToggleExpand = function(event, btn) {
    if(event) event.stopPropagation();
    const extraDiv = btn.nextElementSibling;
    const isClosed = extraDiv.style.display === '' || extraDiv.style.display === 'none';
    if(isClosed) {
        extraDiv.style.display = 'block';
        btn.innerHTML = `閉じる <i data-lucide="chevron-up" size="12"></i>`;
    } else {
        extraDiv.style.display = 'none';
        btn.innerHTML = `詳細を展開 <i data-lucide="chevron-down" size="12"></i>`;
    }
    initLucide();
};

window.coreSystemUpdateStatus = function(event, numStr, status) {
    if(event) event.stopPropagation();
    
    const idx = vocabList.findIndex(w => String(w.num) === String(numStr));
    if(idx >= 0) {
        vocabList[idx].status = status;
        
        if (status === 'none') {
            vocabList[idx].history = []; 
        } else {
            if(!vocabList[idx].history) vocabList[idx].history = [];
            vocabList[idx].history.push(status);
            totalExp += 10;
            localStorage.setItem('core_v4_totalExp', totalExp);
            const coinEl = document.getElementById('profCoinCount');
            if(coinEl) coinEl.innerText = totalExp;
        }

        saveVocabToStorage();
        renderVocabList(); 
    }
};

window.saveAdminDashboardTitle = function() {
    const titleInput = document.getElementById('adminDashboardTitleInput');
    if (!titleInput) return;
    
    const newTitle = titleInput.value.trim() || "ダッシュボード";
    localStorage.setItem('core_v4_dashboard_title', newTitle);
    
    const headerTitleEl = document.getElementById('headerTitleText');
    if (headerTitleEl) headerTitleEl.innerText = newTitle;
    
    alert("ダッシュボードのタイトルを更新しました！");
};

window.renderVocabList = function() {
    const container = document.getElementById('vocabListContainer');
    if(!container) return; container.innerHTML = "";

    const startRange = parseInt(document.getElementById('vocabRangeStart').value) || 0;
    const endRange = parseInt(document.getElementById('vocabRangeEnd').value) || 99999;
    const searchKeyword = document.getElementById('vocabSearchInput').value.toLowerCase().trim();
    
    const filtered = vocabList.filter(w => {
        let n = parseInt(w.num);
        if(!isNaN(n) && (n < startRange || n > endRange)) return false;
        if(vocabFilter !== 'all' && (w.status || 'none') !== vocabFilter) return false;
        if(searchKeyword) {
            return w.word.toLowerCase().includes(searchKeyword) || w.meaning.includes(searchKeyword);
        }
        return true;
    });
    
    filtered.forEach(w => {
        const card = document.createElement('div');
        card.className = "word-row-container";
        card.setAttribute('style', getCardStyleByHistory(w.history));
        card.onclick = (e) => {
            if (e.target.closest('.status-select-btn') || e.target.closest('.card-delete-btn') || e.target.closest('.word-expand-toggle')) return; 
            openWordPopoverFromVocab(e, w, w.word);
        };
        
        let dotsHtml = "";
        if(w.history && w.history.length > 0) {
            dotsHtml = `<div class="history-dots-wrapper">`;
            w.history.slice(-5).forEach(h => {
                let mark = h === 'ok' ? '◯' : h === 'so' ? '△' : '✕';
                dotsHtml += `<span class="history-dot ${h}">${mark}</span>`;
            });
            dotsHtml += `</div>`;
        }

        let meaningParts = w.meaning.split(/[;；\n]/).map(s => s.trim()).filter(s => s !== "");
        let mainMeaning = meaningParts.length > 0 ? meaningParts[0] : w.meaning;
        let extraMeaning = meaningParts.length > 1 ? meaningParts.slice(1).join('\n') : "";
        let hasExtra = extraMeaning || w.sub;
        
        let status = w.status || 'none';

        card.innerHTML = `
            <button class="card-delete-btn" onclick="event.stopPropagation(); showCustomDeleteConfirm('${w.num}')" title="単語を削除">
                <i data-lucide="trash-2" size="14"></i>
            </button>
            <div class="word-main-line">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="word-num-badge">#${w.num}</span>
                    <span style="font-size:18px; font-weight:800; color:white;">${w.word}</span>
                </div>
            </div>
            <div class="word-static-info">
                <div class="word-meaning-main">${mainMeaning}</div>
                ${hasExtra ? `
                    <button class="word-expand-toggle" onclick="coreSystemToggleExpand(event, this)">
                        詳細を展開 <i data-lucide="chevron-down" size="12"></i>
                    </button>
                    <div class="word-meaning-extra">
                        ${extraMeaning ? `<div>${extraMeaning}</div>` : ''}
                        ${w.sub ? `<div class="sub-info-block">${w.sub}</div>` : ''}
                    </div>
                ` : ''}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:12px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.05);">
                <div class="status-control-group">
                    <button class="status-select-btn ${status === 'ok' ? 'active' : ''}" onclick="coreSystemUpdateStatus(event, '${w.num}', 'ok')">◯ 定着</button>
                    <button class="status-select-btn ${status === 'so' ? 'active' : ''}" onclick="coreSystemUpdateStatus(event, '${w.num}', 'so')">△ 曖昧</button>
                    <button class="status-select-btn ${status === 'bad' ? 'active' : ''}" onclick="coreSystemUpdateStatus(event, '${w.num}', 'bad')">✕ 不可</button>
                    <button class="status-select-btn ${status === 'none' ? 'active' : ''}" onclick="coreSystemUpdateStatus(event, '${w.num}', 'none')">ー リセット</button>
                </div>
                ${dotsHtml}
            </div>
        `;
        container.appendChild(card);
    });
    initLucide();
}

// 🌟 長文リーダーの英文解析（429エラー通知 ＆ JSON強靭化対応）
async function callGeminiAnalyzer(rawText) {
    if (!geminiApiKey) return null;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
    const safeText = rawText.replace(/\n/g, ' ');

    const prompt = `以下の英文の「改行」をすべて無視し、ピリオド(.)、疑問符(?)、感嘆符(!)を基準に1文ずつに分割してください。
そして、分割した各英文と、その正確な和訳、さらにその1文の中に含まれる重要な文法事項や構文・熟語（最大3つ程度）を抽出して解説を施し、厳密に以下のJSONフォーマットのみを出力してください。マークダウンタグや説明文は一切含めないでください。

テキスト:
${safeText}

フォーマット:
{
  "sentences": [
    {
      "text": "英文の1節",
      "translations": "その文の和訳",
      "grammarHighlights": [
        { "phrase": "抽出した熟語や構文・重要文法フレーズ", "meaning": "その文法に関する分かりやすい日本語解説" }
      ]
    }
  ]
}`;
    
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        
        if (!response.ok) {
            if (response.status === 429) {
                alert("⚠️ AI APIの利用制限（リクエスト頻度超過または無料枠上限）に達しました。\n数分〜数十分ほど待ってから再度お試しください。");
            }
            return null;
        }

        const data = await response.json();
        let text = data.candidates[0].content.parts[0].text.trim();
        
        // JSON部分だけを強引に抽出
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            text = jsonMatch[0];
        }
        
        return JSON.parse(text);
    } catch (e) { 
        return null; 
    }
}

window.startAnalysisWithEmbeddedTitle = async function() {
    const rawText = document.getElementById('englishTextarea').value.trim();
    if(!rawText) return;
    const titleInput = document.getElementById('customTextTitle');
    let inputtedTitle = titleInput.value.trim() || `解析アーカイブ_${new Date().toLocaleDateString()}`;

    const submitBtn = document.getElementById('analysisSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i data-lucide="loader" class="animate-spin" size="16"></i> 英文解析中...`;
    initLucide();

    try { await analyzeText(rawText, inputtedTitle);
    } catch(err) {} 
    finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i data-lucide="wand-2" size="16"></i> 英文解析`;
        titleInput.value = "";
        initLucide();
    }
}

async function analyzeText(rawText, assignedTitle = null) {
    if(!rawText) return;
    currentActiveReaderText = rawText;
    
    const customJaInput = document.getElementById('customJapanesetextarea').value.trim();
    const customJaLines = customJaInput ? customJaInput.split('\n').filter(l => l.trim() !== '') : [];

    if(assignedTitle) {
        textHistory = textHistory.filter(h => h.text !== rawText);
        textHistory.unshift({ id: Date.now(), title: assignedTitle, text: rawText });
        localStorage.setItem('textHistory', JSON.stringify(textHistory));
        renderHistoryList();
        document.getElementById('readerCurrentTitle').innerText = `📖 ${assignedTitle}`;
    }

    let aiAnalysisResult = geminiApiKey ? await callGeminiAnalyzer(rawText) : null;
    document.getElementById('text-input-view').style.display = 'none';
    document.getElementById('text-reader-view').style.display = 'block';
    const englishContainer = document.getElementById('englishContainer');
    englishContainer.innerHTML = '';
    let totalSummaryJa = "";

    let fallbackSentences = rawText.replace(/\n/g, ' ').match(/[^.?!]+[.?!]+|[^.?!]+$/g) || [rawText];
    fallbackSentences = fallbackSentences.map(s => s.trim()).filter(s => s.length > 0);

    let sentencesData = [];
    if (aiAnalysisResult && aiAnalysisResult.sentences && aiAnalysisResult.sentences.length > 0) {
        sentencesData = aiAnalysisResult.sentences;
    } else {
        sentencesData = fallbackSentences.map(s => ({ text: s, translations: "（和訳データ未取得・API設定や制限を確認してください）", grammarHighlights: [] }));
    }

    sentencesData.forEach((sData, sIdx) => {
        let sentenceText = sData.text || "";
        if(!sentenceText.trim()) return;
        
        const block = document.createElement('div');
        block.className = 'sentence-container';
        const mainContent = document.createElement('div');
        mainContent.style.flex = "1";
        mainContent.innerHTML = `<span class="sentence-num">${sIdx + 1}</span>`;

        let highlights = sData.grammarHighlights || [];
        highlights.sort((a, b) => b.phrase.length - a.phrase.length);

        let textMarker = sentenceText;
        let phraseMap = {};
        
        highlights.forEach((h, hIdx) => {
            let pKey = `___GRAMMAR_MARKER_${hIdx}___`;
            let regex = new RegExp(h.phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
            if(textMarker.match(regex)) {
                textMarker = textMarker.replace(regex, pKey);
                phraseMap[pKey] = h;
            }
        });

        textMarker.split(' ').forEach(wStr => {
            if (!wStr) return;
            
            let cleanToken = wStr.trim();
            let isGrammar = false;
            let grammarData = null;
            
            for(let key in phraseMap) {
                if(cleanToken.indexOf(key) !== -1) {
                    isGrammar = true;
                    grammarData = phraseMap[key];
                    wStr = wStr.replace(key, grammarData.phrase);
                    break;
                }
            }

            if (isGrammar && grammarData) {
                const gSpan = document.createElement('span');
                gSpan.className = 'grammar-span';
                gSpan.innerText = wStr + ' ';
                gSpan.onclick = (e) => openGrammarPopover(e, grammarData.phrase, grammarData.meaning);
                mainContent.appendChild(gSpan);
            } else {
                const cleanKey = wStr.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]\"']/g,"");
                const span = document.createElement('span');
                span.className = 'word-span';
                span.innerText = wStr + ' ';

                const vocabMatch = vocabList.find(v => v.word.toLowerCase() === cleanKey);
                const dictMatch = dictionaryData.find(d => d.en === cleanKey);
                
                if(vocabMatch) {
                    span.classList.add('registered');
                    if(vocabMatch.status && vocabMatch.status !== 'none') span.classList.add(`status-${vocabMatch.status}`);
                    span.onclick = (e) => openWordPopoverFromVocab(e, vocabMatch, wStr);
                } else if(dictMatch) {
                    span.classList.add('registered');
                    if(wordMemory[cleanKey]) span.classList.add(`status-${wordMemory[cleanKey]}`);
                    span.onclick = (e) => openWordPopover(e, targetLookupKey, wStr);
                }
                mainContent.appendChild(span);
            }
        });

        let finalJaText = customJaLines[sIdx] || sData.translations;
        totalSummaryJa += `${sIdx+1}. ${finalJaText}<br>`;

        const jaSpan = document.createElement('span');
        jaSpan.className = 'sentence-ja';
        jaSpan.innerText = finalJaText;
        mainContent.appendChild(jaSpan);
        block.appendChild(mainContent);

        const isPinned = savedSentences.some(s => (s.text ? s.text : s) === sentenceText.trim());
        const pinBtn = document.createElement('button');
        pinBtn.className = isPinned ? 'sentence-pin-btn pinned' : 'sentence-pin-btn';
        pinBtn.innerHTML = isPinned ? `<i data-lucide="bookmark-check" size="16"></i>` : `<i data-lucide="bookmark" size="16"></i>`;
        pinBtn.onclick = () => {
            togglePinSentence(sentenceText.trim());
            analyzeText(currentActiveReaderText, null);
        };
        block.appendChild(pinBtn);
        englishContainer.appendChild(block);
    });

    document.getElementById('summaryJaContainer').innerHTML = totalSummaryJa;
    setTranslationMode(currentTranslationMode);
    initLucide();
}

window.openGrammarPopover = function(event, phrase, meaning) {
    if(event) event.stopPropagation();
    currentTargetWordToken = null;
    currentTargetVocabNum = null;
    
    document.getElementById('popWord').innerText = phrase;
    document.getElementById('popWordNum').innerText = "💡 文法・構文解説";
    document.getElementById('popMeaning').innerText = meaning;
    
    document.getElementById('popoverStatusBtns').style.display = "none";
    
    const pop = document.getElementById('wordPopover');
    pop.style.display = 'flex';
    pop.classList.add('show');
};

function openWordPopoverFromVocab(event, vocabItem, originalText) {
    if(event) event.stopPropagation();
    currentTargetWordToken = vocabItem.word.toLowerCase();
    currentTargetVocabNum = vocabItem.num;
    document.getElementById('popWord').innerText = originalText;
    document.getElementById('popWordNum').innerText = `#${vocabItem.num}`;
    document.getElementById('popMeaning').innerText = vocabItem.meaning;
    
    document.getElementById('popoverStatusBtns').style.display = "flex";
    
    const pop = document.getElementById('wordPopover');
    pop.style.display = 'flex';
    pop.classList.add('show');
}

function openWordPopover(event, cleanKey, originalText) {
    if(event) event.stopPropagation();
    currentTargetWordToken = cleanKey;
    currentTargetVocabNum = null;
    const match = dictionaryData.find(d => d.en === cleanKey);
    document.getElementById('popWord').innerText = originalText;
    document.getElementById('popWordNum').innerText = "";
    document.getElementById('popMeaning').innerText = match ? match.ja : '未登録';
    
    document.getElementById('popoverStatusBtns').style.display = "flex";
    
    const pop = document.getElementById('wordPopover');
    pop.style.display = 'flex';
    pop.classList.add('show');
}

window.togglePinSentence = function(sentenceText) {
    const index = savedSentences.findIndex(s => (s.text ? s.text : s) === sentenceText);
    if(index > -1) savedSentences.splice(index, 1);
    else savedSentences.push({ text: sentenceText, from: document.getElementById('readerCurrentTitle').innerText.replace("📖 ", "") });
    localStorage.setItem('savedSentences', JSON.stringify(savedSentences));
    renderSavedSentences();
}

window.deleteHistoryItem = function(id, event) {
    event.stopPropagation();
    textHistory = textHistory.filter(h => h.id !== id);
    localStorage.setItem('textHistory', JSON.stringify(textHistory));
    renderHistoryList();
}

function renderHistoryList() {
    const container = document.getElementById('historyListContainer');
    if(!container) return; container.innerHTML = '';
    if(textHistory.length === 0) {
        container.innerHTML = `<div style="color:var(--text-sub); font-size:12px;">ログがありません</div>`;
        return;
    }
    textHistory.forEach(h => {
        const row = document.createElement('div'); row.className = 'list-item-row';
        const safeText = h.text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
        row.innerHTML = `
            <div class="list-item-title"><span>${h.title}</span></div>
            <div style="display:flex; gap:8px;">
                <button class="list-action-link" onclick="analyzeText(\`${safeText}\`, null)">開く</button>
                <button class="word-delete-btn" style="display:flex !important;" onclick="deleteHistoryItem(${h.id}, event)"><i data-lucide="trash-2" size="14"></i></button>
            </div>`;
        container.appendChild(row);
    });
    initLucide();
}

function renderSavedSentences() {
    const container = document.getElementById('savedSentencesContainer');
    if(!container) return; container.innerHTML = '';
    savedSentences.forEach(s => {
        const row = document.createElement('div'); row.className = 'list-item-row';
        const safeText = (s.text || s).replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
        row.innerHTML = `<div class="list-item-title"><span>${s.text || s}</span></div>
            <button class="list-action-link" onclick="analyzeText(\`${safeText}\`, null)">開く</button>`;
        container.appendChild(row);
    });
}

window.setTranslationMode = function(mode) {
    currentTranslationMode = mode;
    document.getElementById('toggle-inline').classList.toggle('active', mode === 'inline');
    document.getElementById('toggle-bottom').classList.toggle('active', mode === 'bottom');
    document.querySelectorAll('.sentence-ja').forEach(el => el.style.display = mode === 'inline' ? 'block' : 'none');
    document.getElementById('summary-ja-card').style.display = mode === 'bottom' ? 'block' : 'none';
}

window.closeReader = function() {
    document.getElementById('text-input-view').style.display = 'block';
    document.getElementById('text-reader-view').style.display = 'none';
}

window.setWordStatusFromReader = function(status) {
    if(!currentTargetWordToken) return;
    if(currentTargetVocabNum !== null) {
        const idx = vocabList.findIndex(w => String(w.num) === String(currentTargetVocabNum));
        if(idx >= 0) {
            vocabList[idx].status = status;
            if(!vocabList[idx].history) vocabList[idx].history = [];
            vocabList[idx].history.push(status);
        }
    }
    wordMemory[currentTargetWordToken] = status;
    localStorage.setItem('wordMemory', JSON.stringify(wordMemory));
    totalExp += 10;
    localStorage.setItem('core_v4_totalExp', totalExp);
    
    const coinEl = document.getElementById('profCoinCount');
    if(coinEl) coinEl.innerText = totalExp;
    
    saveVocabToStorage();
    renderVocabList();
    if(currentActiveReaderText) analyzeText(currentActiveReaderText, null);
    closeWordPopover();
}

window.closeWordPopover = function() {
    document.getElementById('wordPopover').classList.remove('show');
    document.getElementById('wordPopover').style.display = 'none';
}

document.addEventListener('click', (e) => {
    if(!e.target.closest('#wordPopover')) closeWordPopover();
});

window.setSocialTab = function(mode) { renderLeaderboard(); }
window.logoutToGate = function() { localStorage.clear(); location.reload(); }
window.enterAdminModeDirect = function() { switchTab('admin'); }
window.saveAdminSystemSettings = function() { switchTab('home'); }

function renderLeaderboard() {
    const container = document.getElementById('leaderboardContainer');
    if(!container) return;
    container.innerHTML = `<div style="padding:10px; font-size:14px; font-weight:700; color:#FFF; text-shadow:0 1px 3px #000;">プレイヤー名: ${myName} / 合計スコア: ${totalExp} PTS</div>`;
}
function renderActivityChart() {
    const chart = document.getElementById('activityBarChart');
    if(!chart) return; chart.innerHTML = "";
    ["月", "火", "水", "木", "金", "土", "日"].forEach(d => {
        const wrap = document.createElement('div'); wrap.className = "bar-wrapper";
        const fill = document.createElement('div'); fill.className = "bar-fill active"; fill.style.height = "50%";
        const lbl = document.createElement('div'); lbl.className = "bar-label"; lbl.innerText = d;
        wrap.appendChild(fill); wrap.appendChild(lbl); chart.appendChild(wrap);
    });
}
window.saveSidebarProfile = function() {
    geminiApiKey = document.getElementById('sidebarApiKeyInput').value.trim();
    localStorage.setItem('core_v4_geminiKey', geminiApiKey);
    myName = document.getElementById('sideInputName').value.trim() || myName;
    myTarget = document.getElementById('sideInputTarget').value.trim() || myTarget;
    selectedTitle = document.getElementById('sideSelectTitle').value;
    applyProfileToUi();
    toggleSidebar(false);
}

/* ==========================================================================
   🎮 クイズゲームロジック（エラー・フリーズ対策強化版）
   ========================================================================= */
window.resetLeaderboard = function() {
    if(confirm("本当にすべてのランキング履歴を一括で削除しますか？\n（この操作は元に戻せません）")) {
        const modes = ['ja2en', 'en2ja', 'mixed'];
        const diffs = ['normal', 'hard', 'expert', 'endless'];
        modes.forEach(m => {
            diffs.forEach(d => {
                localStorage.removeItem(`cosmic_score_${m}_${d}`);
            });
        });
        alert("すべてのランキング履歴をリセットしました。");
        renderGameLeaderboard('mine'); 
    }
}

window.resetBestScore = function() {
    if(confirm("本当にすべてのベストスコアを0に戻しますか？")) {
        const modes = ['ja2en', 'en2ja', 'mixed'];
        const diffs = ['normal', 'hard', 'expert', 'endless'];
        modes.forEach(m => {
            diffs.forEach(d => {
                localStorage.removeItem(`cosmic_best_${m}_${d}`);
            });
        });
        alert("すべてのベストスコアをリセットしました。");
    }
}

function formatWordForDisplay(str) {
    if(!str) return "";
    let formatted = str;
    formatted = formatted.replace(/(動|名|形|副|代|接|前|接続|間投|助動|自動|他動)[:：]\s*/g, '');
    formatted = formatted.replace(/〜[をにがとへでや]\s*/g, '');
    formatted = formatted.replace(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/g, ' ,   ');
    formatted = formatted.replace(/^[ ,　]+/, '').trim();
    formatted = formatted.replace(/\n/g, ' ');
    return formatted;
}

function resetScorePopup(popupEl) {
    popupEl.className = "giant-score-popup";
    void popupEl.offsetWidth; 
}

window.renderGameLeaderboard = function(type = 'mine') {
    const modeEl = document.getElementById('lbModeSelect');
    const diffEl = document.getElementById('lbDiffSelect');
    
    const mode = modeEl ? modeEl.value : 'ja2en';
    const diff = diffEl ? diffEl.value : 'normal';

    const container = document.getElementById('leaderboardListContainer');
    if(!container) return;
    container.innerHTML = "";
    
    if (type === 'mine') {
        const keyHistory = `cosmic_score_${mode}_${diff}`;
        let history = JSON.parse(localStorage.getItem(keyHistory) || "[]");

        if (history.length === 0) {
            container.innerHTML = `<div style="text-align:center; color:var(--text-sub); font-size:12px; margin-top:20px;">このモードの記録はありません</div>`;
            return;
        }
        
        const rankColors = ["#FBBF24", "#94A3B8", "#D97706", "var(--cosmic-cyan)", "var(--cosmic-cyan)"];
        
        history.forEach((record, index) => {
            const row = document.createElement('div');
            row.style.cssText = `display:flex; justify-content:space-between; align-items:center; padding:6px 8px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:13px;`;
            row.innerHTML = `
                <div style="display:flex; gap:12px; align-items:center;">
                    <span style="color:${rankColors[index] || 'white'}; font-weight:900; font-size:15px; width:20px; text-align:center;">${index + 1}</span>
                    <span style="color:white; font-weight:800; letter-spacing:1px;">${record.score}</span>
                </div>
                <div style="color:var(--text-sub); font-size:11px;">${record.date}</div>
            `;
            container.appendChild(row);
        });
    } else {
        container.innerHTML = `<div style="text-align:center; color:var(--text-sub); font-size:12px; margin-top:20px;"><i data-lucide="server-off" size="16" style="margin-bottom:4px;"></i><br>コミュニティデータ準備中...</div>`;
        initLucide();
    }
}

window.switchLeaderboard = function(type) {
    document.getElementById('lbTabMine').classList.toggle('active', type === 'mine');
    document.getElementById('lbTabComm').classList.toggle('active', type === 'comm');
    renderGameLeaderboard(type);
}

// 🌟 AI判定処理（429エラー通知 ＆ JSON強靭化対応）
async function callGeminiGameJudge(questionText, correctAnswer, userInput, qType) {
    const cLow = correctAnswer.toLowerCase().trim();
    const uLow = userInput.toLowerCase().trim();
    
    let isLocalMatch = false;
    if (qType === 'en2ja') {
        const cParts = cLow.split(',').map(p => p.trim()).filter(p => p);
        if (cParts.length > 0) {
            isLocalMatch = cParts.some(p => p === uLow || p.includes(uLow) || uLow.includes(p));
        } else {
            isLocalMatch = cLow.includes(uLow) || uLow.includes(cLow);
        }
    } else {
        if (cLow === uLow) isLocalMatch = true; 
    }

    if (isLocalMatch) {
        return { status: "OK", alternatives: "🎯 PERFECT! (AI解析スキップ)" };
    }

    if (!geminiApiKey) {
        return { status: "BAD", alternatives: "なし(APIキー未登録のためローカル判定のみ)" };
    }
    
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
    
    let prompt = "";
    if (qType === 'en2ja') {
        prompt = `英単語「${questionText}」の主な訳「${correctAnswer}」に照らし、ユーザー解答「${userInput}」がニュアンス的に正解か（OKかBADか）判定し、別解をリストアップしてください。\n\n必ず以下のJSONフォーマットのみを返してください（Markdownブロックも不要です）：\n{"judgment": "OK", "alternatives": "補足内容"}`;
    } else {
        prompt = `日本語の意味「${questionText}」に対する英単語として、ユーザー解答「${userInput}」が正解か（OKかBADか）判定してください。模範解答は「${correctAnswer}」です。スペルミスは厳しくBADにしてください。\n\n必ず以下のJSONフォーマットのみを返してください（Markdownブロックも不要です）：\n{"judgment": "BAD", "alternatives": "補足内容"}`;
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        
        if (!response.ok) {
            if (response.status === 429) {
                alert("⚠️ AI APIの利用制限（リクエスト頻度超過または無料枠上限）に達しました。\n数分〜数十分ほど待ってから再度お試しください。");
                return { status: "BAD", alternatives: "API制限エラー（しばらくお待ちください）" };
            }
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();
        let text = data.candidates[0].content.parts[0].text.trim();
        
        // JSON部分だけを強引に抽出（AIのおしゃべりを排除）
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            text = jsonMatch[0];
        }
        
        const cleanJson = JSON.parse(text);
        return { status: cleanJson.judgment === "OK" ? "OK" : "BAD", alternatives: cleanJson.alternatives || "特になし" };
    } catch (e) {
        return { status: "BAD", alternatives: "自動判定エラー (AIからのJSON解釈または通信エラー)" };
    }
}

window.showModeSelectScreen = function() {
    if (vocabList.length === 0) {
        return alert("単語帳に単語が登録されていません。「単語帳」タブから追加してください。");
    }
    document.getElementById('game-start-screen').style.display = 'none';
    document.getElementById('game-mode-select-screen').style.display = 'block';
    document.getElementById('game-play-screen').style.display = 'none';
    document.getElementById('game-result-screen').style.display = 'none';
    
    document.getElementById('difficulty-section').style.display = 'none';
    ['btnModeJa', 'btnModeEn', 'btnModeMix'].forEach(id => {
        document.getElementById(id).style.boxShadow = '';
        document.getElementById(id).style.background = '';
    });
}

window.selectGameMode = function(mode) {
    selectedQuestionMode = mode;
    ['btnModeJa', 'btnModeEn', 'btnModeMix'].forEach(id => {
        document.getElementById(id).style.boxShadow = '';
        document.getElementById(id).style.background = '';
    });
    
    let targetId = mode === 'ja2en' ? 'btnModeJa' : mode === 'en2ja' ? 'btnModeEn' : 'btnModeMix';
    document.getElementById(targetId).style.background = 'linear-gradient(135deg, rgba(0, 240, 255, 0.4) 0%, rgba(192, 132, 252, 0.4) 100%)';
    document.getElementById(targetId).style.boxShadow = '0 0 20px rgba(0, 240, 255, 0.6)';
    
    document.getElementById('difficulty-section').style.display = 'block';
}

window.startActualGame = function(difficulty) {
    currentGameDifficulty = difficulty;
    gameCurrentWordsQueue = [...vocabList].sort(() => Math.random() - 0.5);
    gameScoreCount = 0; 
    gameCurrentIndex = 0;
    gameMistakeCount = 0;
    gameComboCount = 0;
    gameComboTotalScore = 0;
    isGameProcessingAnswer = false;
    isGameTimerPaused = false;
    gameHistoryLog = []; 

    if (difficulty === 'normal') gameRemainingTime = 60;
    else if (difficulty === 'hard') gameRemainingTime = 180;
    else if (difficulty === 'expert') gameRemainingTime = 300;
    else if (difficulty === 'endless') gameRemainingTime = '∞';

    updateScoreDisplay();
    
    const timerEl = document.getElementById('gameTimerNum');
    timerEl.style.fontSize = ''; 
    timerEl.innerText = gameRemainingTime;

    document.getElementById('gameAnswerInput').value = "";
    
    document.getElementById('gameSubmitBtn').style.display = 'flex';
    document.getElementById('gameSubmitBtn').disabled = false;
    document.getElementById('gameNextBtn').style.display = 'none';

    document.getElementById('feedbackWaiting').style.display = "block";
    document.getElementById('feedbackContent').style.display = "none";
    document.getElementById('giantJudgmentOverlay').className = "giant-judgment-overlay";
    document.getElementById('giantScorePopup').className = "giant-score-popup";
    
    document.getElementById('persistentComboContainer').style.display = "none";
    
    document.getElementById('game-mode-select-screen').style.display = 'none';
    document.getElementById('game-play-screen').style.display = 'block';

    window.scrollTo(0, 0);

    clearInterval(gameTimerInterval);
    if (difficulty !== 'endless') {
        gameTimerInterval = setInterval(() => {
            if (isGameTimerPaused) return;
            gameRemainingTime--;
            document.getElementById('gameTimerNum').innerText = gameRemainingTime;
            if (gameRemainingTime <= 0) {
                endGameSession();
            }
        }, 1000);
    } else {
        timerEl.innerText = '❤️❤️❤️❤️❤️';
        timerEl.style.fontSize = '14px';
    }
    
    showNextGameWord();
}

function updateScoreDisplay() {
    const formattedScore = String(gameScoreCount).padStart(4, '0');
    document.getElementById('gameScoreNum').innerText = formattedScore;
}

function showNextGameWord() {
    if (gameCurrentIndex >= gameCurrentWordsQueue.length) {
        gameCurrentWordsQueue = [...vocabList].sort(() => Math.random() - 0.5);
        gameCurrentIndex = 0;
    }
    const currentWordObj = gameCurrentWordsQueue[gameCurrentIndex];
    
    if (selectedQuestionMode === 'mixed') {
        currentQuestionType = Math.random() > 0.5 ? 'en2ja' : 'ja2en';
    } else {
        currentQuestionType = selectedQuestionMode;
    }

    let displayWord = "";
    if (currentQuestionType === 'en2ja') {
        displayWord = currentWordObj.word;
        document.getElementById('gameAnswerInput').placeholder = "和訳を入力...";
    } else {
        displayWord = formatWordForDisplay(currentWordObj.meaning); 
        document.getElementById('gameAnswerInput').placeholder = "英単語を入力...";
    }

    const wordEl = document.getElementById('gameWordTarget');
    wordEl.innerText = displayWord;
    
    if (displayWord.length > 30) {
        wordEl.style.fontSize = '14px';
    } else if (displayWord.length > 15) {
        wordEl.style.fontSize = '18px';
    } else {
        wordEl.style.fontSize = '28px'; 
    }
    
    document.getElementById('gameAnswerInput').value = "";
    document.getElementById('giantJudgmentOverlay').classList.remove('show');
    
    const inputEl = document.getElementById('gameAnswerInput');
    if (inputEl) {
        inputEl.focus();
    }
    
    window.scrollTo(0, 0);
    isGameProcessingAnswer = false;
}

window.submitGameAnswer = async function() {
    if (isGameProcessingAnswer) return;

    const nextBtn = document.getElementById('gameNextBtn');
    if (nextBtn && (nextBtn.style.display === 'flex' || nextBtn.style.display === 'block')) {
        goToNextGameWord();
        return;
    }
    
    const rawInput = document.getElementById('gameAnswerInput').value;
    const userInput = rawInput.trim();

    if (!userInput) return;

    isGameProcessingAnswer = true;
    isGameTimerPaused = true;
    
    const inputEl = document.getElementById('gameAnswerInput');
    if (inputEl) inputEl.blur();

    document.getElementById('gameSubmitBtn').style.display = 'none'; 
    document.getElementById('gameJudgingIndicator').style.display = 'flex';

    const currentWordObj = gameCurrentWordsQueue[gameCurrentIndex];
    
    let questionText = currentQuestionType === 'en2ja' ? currentWordObj.word : formatWordForDisplay(currentWordObj.meaning);
    let correctAnswer = currentQuestionType === 'en2ja' ? formatWordForDisplay(currentWordObj.meaning) : currentWordObj.word;

    let resultObj = await callGeminiGameJudge(questionText, correctAnswer, userInput, currentQuestionType);

    document.getElementById('gameJudgingIndicator').style.display = 'none';
    document.getElementById('gameNextBtn').style.display = 'flex';

    const overlay = document.getElementById('giantJudgmentOverlay');
    const markEl = document.getElementById('giantJudgmentMark');
    const textEl = document.getElementById('giantJudgmentText');
    const popupEl = document.getElementById('giantScorePopup');
    
    const comboContainer = document.getElementById('persistentComboContainer');
    const comboTextEl = document.getElementById('persistentComboText');
    const comboScoreEl = document.getElementById('persistentComboScore');
    
    resetScorePopup(popupEl); 

    let updatedStatus = "bad";
    let isCorrect = false;

    if (resultObj.status === "OK") {
        let earnedScore = 100 + (gameComboCount * 5);
        gameScoreCount += earnedScore;
        gameComboCount++;
        gameComboTotalScore += earnedScore;

        markEl.innerText = "◎";
        textEl.innerText = "正解";
        overlay.className = "giant-judgment-overlay show correct";
        
        popupEl.innerText = "+" + gameComboTotalScore;
        popupEl.className = "giant-score-popup score-anim-plus";
        
        if(gameComboCount > 1) {
            comboTextEl.innerText = `${gameComboCount} COMBO!`;
            comboScoreEl.innerText = `+${gameComboTotalScore}`;
            comboContainer.style.display = "flex";
            comboContainer.classList.add('combo-blink');
        } else {
            comboContainer.style.display = "none";
            comboContainer.classList.remove('combo-blink');
        }

        updatedStatus = "ok";
        isCorrect = true;
    } else {
        gameScoreCount -= 50; 
        if (gameScoreCount < 0) gameScoreCount = 0;
        gameComboCount = 0;
        gameComboTotalScore = 0;

        markEl.innerText = "✕";
        textEl.innerText = "不正解";
        overlay.className = "giant-judgment-overlay show incorrect";
        
        popupEl.innerText = "-50";
        popupEl.className = "giant-score-popup score-anim-minus";
        
        comboContainer.style.display = "none";
        comboContainer.classList.remove('combo-blink');

        updatedStatus = "bad";
        
        if (currentGameDifficulty === 'endless') {
            gameMistakeCount++;
            let hearts = "";
            for(let i=0; i<5; i++){
                hearts += (i < (5 - gameMistakeCount)) ? "❤️" : "🖤";
            }
            document.getElementById('gameTimerNum').innerText = hearts;
        }
    }

    gameHistoryLog.push({
        word: questionText,
        user: userInput,
        correct: correctAnswer,
        isCorrect: isCorrect
    });
    
    updateScoreDisplay();

    const targetVocabIdx = vocabList.findIndex(w => String(w.num) === String(currentWordObj.num));
    if (targetVocabIdx >= 0) {
        vocabList[targetVocabIdx].status = updatedStatus;
        if (!vocabList[targetVocabIdx].history) vocabList[targetVocabIdx].history = [];
        vocabList[targetVocabIdx].history.push(updatedStatus);
        saveVocabToStorage();
    }

    document.getElementById('feedbackWaiting').style.display = "none";
    document.getElementById('feedbackContent').style.display = "block";
    document.getElementById('feedbackUserAns').innerText = userInput;
    document.getElementById('feedbackCorrectAns').innerText = correctAnswer; 
    
    const diffRow = document.getElementById('feedbackDiffAnswersRow');
    const otherAnsEl = document.getElementById('feedbackOtherAns');
    
    if (resultObj.alternatives && resultObj.alternatives !== "特になし") {
        otherAnsEl.innerText = resultObj.alternatives;
        if (resultObj.alternatives.length > 50) {
            otherAnsEl.style.fontSize = "10px";
        } else {
            otherAnsEl.style.fontSize = "11.5px";
        }
        diffRow.style.display = "block";
    } else {
        diffRow.style.display = "none";
    }

    window.scrollTo(0, 0);
}

window.goToNextGameWord = function() {
    if (currentGameDifficulty === 'endless' && gameMistakeCount >= 5) {
        endGameSession();
        return;
    }

    document.getElementById('gameNextBtn').style.display = 'none';
    document.getElementById('gameSubmitBtn').style.display = 'flex';
    document.getElementById('gameSubmitBtn').disabled = false;

    document.getElementById('feedbackContent').style.display = "none";
    document.getElementById('feedbackWaiting').style.display = "block";
    document.getElementById('giantJudgmentOverlay').classList.remove('show');
    document.getElementById('persistentComboContainer').style.display = "none";
    document.getElementById('persistentComboContainer').classList.remove('combo-blink');
    
    isGameTimerPaused = false; 
    
    gameCurrentIndex++;
    showNextGameWord();
};

window.endGameSession = function() {
    clearInterval(gameTimerInterval);
    document.getElementById('game-play-screen').style.display = 'none';
    document.getElementById('game-result-screen').style.display = 'block';
    
    document.getElementById('persistentComboContainer').style.display = "none";
    document.getElementById('persistentComboContainer').classList.remove('combo-blink');
    
    const timerEl = document.getElementById('gameTimerNum');
    timerEl.style.fontSize = ''; 
    
    if (gameScoreCount > 0) {
        const keyHistory = `cosmic_score_${selectedQuestionMode}_${currentGameDifficulty}`;
        const keyBest = `cosmic_best_${selectedQuestionMode}_${currentGameDifficulty}`;
        
        let history = JSON.parse(localStorage.getItem(keyHistory) || "[]");
        history.push({
            score: gameScoreCount,
            date: new Date().toLocaleDateString()
        });
        history.sort((a, b) => b.score - a.score);
        history = history.slice(0, 5);
        localStorage.setItem(keyHistory, JSON.stringify(history));
        
        gameBestScore = parseInt(localStorage.getItem(keyBest) || "0");
        if (gameScoreCount > gameBestScore) {
            localStorage.setItem(keyBest, gameScoreCount);
            gameBestScore = gameScoreCount;
        }
    }
    
    const totalQuestions = gameHistoryLog.length;
    const correctCount = gameHistoryLog.filter(h => h.isCorrect).length;
    const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const communityBest = Math.max(gameBestScore, 2800);
    
    document.getElementById('resScore').innerText = gameScoreCount;
    document.getElementById('resAccuracy').innerText = `${accuracy}%`;
    document.getElementById('resBestScore').innerText = gameBestScore;
    document.getElementById('resCommBest').innerText = communityBest;

    const listContainer = document.getElementById('gameHistoryListContainer');
    listContainer.innerHTML = "";
    
    if (gameHistoryLog.length === 0) {
        listContainer.innerHTML = `<div style="text-align:center; color:var(--text-sub); padding:12px; font-size:12px;">ログがありません</div>`;
    } else {
        gameHistoryLog.forEach(item => {
            const row = document.createElement('div');
            row.className = "cosmic-history-item";
            row.innerHTML = `
                <span class="cosmic-res-mark ${item.isCorrect ? 'ok' : 'bad'}">${item.isCorrect ? '◎' : '✕'}</span>
                <div style="flex:1;">
                    <div style="font-weight:800; color:white; font-size:13px;">${item.word.replace(/\n/g, ' ')}</div>
                    <div style="color:var(--text-sub); margin-top:2px;">あなたの回答: <span style="color:white;">${item.user || '(空欄)'}</span></div>
                    <div style="color:var(--word-ok); font-size:11px; margin-top:1px;">正答: ${item.correct}</div>
                </div>
            `;
            listContainer.appendChild(row);
        });
    }

    renderVocabList();
    initLucide();
}

window.backToGameMenu = function() {
    document.getElementById('game-start-screen').style.display = 'flex';
    document.getElementById('game-mode-select-screen').style.display = 'none';
    document.getElementById('game-play-screen').style.display = 'none';
    document.getElementById('game-result-screen').style.display = 'none';
    
    renderGameLeaderboard('mine');
    window.scrollTo(0, 0);
}
