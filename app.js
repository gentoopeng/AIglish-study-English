// ==========================================================================
// 🌟 グローバル変数（システム全体で使うデータ）
// ==========================================================================
let myId = "";
let myName = "プレイヤー1";
let myTarget = "未設定";
let selectedTitle = "称号なし";
let totalExp = 0;
let vocabList = [];
let vocabFilter = "all";
let geminiApiKey = ""; 

// ゲーム用のステータス変数
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

// リーダーボード専用のステータス変数
let currentLbMode = 'ja2en';
let currentLbDiff = 'endless';
let currentLbType = 'mine';

const SHARED_DEFAULT_VOCAB_DATA = [];
let dictionaryData = [];
const customSamples = {}; 
for(let i = 1; i <= 100; i++) {
    dictionaryData.push({ num: String(i), en: customSamples[i] ? customSamples[i].en : `token-${i}`, ja: customSamples[i] ? customSamples[i].ja : `単語インデックス No.${i} に紐付く日本語対訳データ` });
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

// 🌟 マルチバトル用変数
let currentMultiMode = 'coop'; 
let multiBossMaxHp = 100000;
let multiBossHp = 100000;
let multiPartyMembers = []; 
let multiEnemyTimeLeft = 10;
let currentMultiCorrectIndex = -1;

// 🌟 LIMIT BREAK (必殺技) ゲージ用変数
let multiLimitAmount = 0;
const multiLimitMax = 100;

let flickStartX = 0;
let flickStartY = 0;
let isFlicking = false;
let currentFlickChoice = -1;

// 🌟 モードスワイプ用の変数
let modeSwipeStartX = 0;

// ==========================================================================
// 🌟 魔法（関数）の完全グローバル登録
// ==========================================================================

// 新設：英文解析ボタン押下時に呼び出されるメイン処理関数
window.startAnalysisWithEmbeddedTitle = function() {
    const textareaEl = document.getElementById('englishTextarea');
    if (!textareaEl) return;
    
    const rawText = textareaEl.value.trim();
    if (!rawText) {
        alert("英文を入力してください");
        return;
    }
    
    const titleInputEl = document.getElementById('customTextTitle');
    let assignedTitle = titleInputEl ? titleInputEl.value.trim() : "";
    
    if (!assignedTitle) {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        assignedTitle = `${yyyy}/${mm}/${dd} ${hh}:${min}:${ss}`;
    }
    
    window.analyzeText(rawText, assignedTitle);
};

// 新設：Gemini AIにリクエストを送信して英文・和訳・重要文法をJSONで解析する関数
window.callGeminiAnalyzer = async function(text) {
    if (!geminiApiKey) {
        alert("【デバッグ情報】\nAPIキーが設定されていないため、AI通信をスキップしました。");
        return null;
    }
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
        const prompt = `以下の英文をパースし、指定のJSONスキーマ形式のみで返答してください。余計な説明文やマークダウンの\`\`\`jsonタグは一切含めず、純粋なJSON文字列オブジェクトとして出力してください。

英文:
${text}

出力JSON形式:
{
  "sentences": [
    {
      "text": "元の英語の1文（ピリオドまで。前後の空白は詰める）",
      "translation": "その文の正確な日本語訳",
      "grammarHighlights": [
        {
          "phrase": "文の中で重要、または初心者が躓きやすい実在する単語・熟語・文法フレーズ（正確に一致するもの）",
          "meaning": "そのフレーズの簡潔な日本語解説・意味"
        }
      ]
    }
  ]
}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error("Gemini API Error details:", errorData);
            
            if (response.status === 429) {
                alert("本日のAI利用回数の上限に達しました。時間を置いて再度お試しいただくか、手動入力をご利用ください。");
            } else {
                alert(`【Gemini API エラー】\nステータスコード: ${response.status}\n\n詳細な理由:\n${errorData}`);
            }
            return null;
        }
        const data = await response.json();
        const responseText = data.candidates[0].content.parts[0].text.trim();
        
        const cleanJsonText = responseText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        return JSON.parse(cleanJsonText);
    } catch (e) {
        console.error("Gemini Analyzer Error:", e);
        alert(`【プログラム エラー】\nAIとの通信中、または解析結果の処理中にエラーが発生しました。\n\n詳細:\n${e.message}`);
        return null;
    }
};

// 🌟 新設・改良：ソロゲーム内でのAI判定関数（スペルミス1文字などを許容し △ を返す）
window.callGeminiGameJudge = async function(question, correctAnswer, userAns, mode) {
    if (!geminiApiKey) return { status: "NG", alternatives: "特になし" };
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
        const prompt = `あなたは語学学習アプリの採点AIです。
ユーザーの回答を評価し、以下のJSONフォーマットで返してください。余計なテキストは含めないでください。

【問題（${mode === 'en2ja' ? '英語' : '日本語'}）】: ${question}
【模範解答】: ${correctAnswer}
【ユーザーの回答】: ${userAns}

【判定基準】
- "OK": 完全に正解、または意味が完全に一致している場合。
- "SO": スペルミスやタイプミスが1文字だけの場合、または意味は通じるが惜しい・少し不自然な場合。
- "NG": 全く違う、または意味が通じない場合。

出力JSON形式:
{
  "status": "OK", "SO", または "NG",
  "alternatives": "ユーザーの回答以外に正解となる別解があれば1〜2個提示（なければ「特になし」）"
}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!response.ok) return { status: "NG", alternatives: "特になし" };
        const data = await response.json();
        const cleanJsonText = data.candidates[0].content.parts[0].text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        return JSON.parse(cleanJsonText);
    } catch (e) {
        console.error("Gemini Judge Error:", e);
        return { status: "NG", alternatives: "特になし" };
    }
};

// 🌟 安全対策：起動時の未定義クラッシュを根絶するため、描画関数を最上部で強固に事前ロード
window.renderLeaderboard = function() { 
    const container = document.getElementById('leaderboardContainer'); 
    if(container) container.innerHTML = `<div style="padding:10px; font-size:14px; font-weight:700; color:#FFF;">プレイヤー名: ${myName} / 合計スコア: ${totalExp} PTS</div>`; 
};

window.initLucide = function() { 
    if(window.lucide) { window.lucide.createIcons(); } 
};

window.scrollToTop = function() { 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
};

window.initHeroSlider = function() {
    const track = document.getElementById('heroSliderTrack');
    if (!track) return;
    let currentSlide = 0;
    setInterval(() => { 
        currentSlide = (currentSlide + 1) % 5; 
        track.style.transform = `translateX(-${currentSlide * 20}%)`; 
    }, 4000);
};

window.saveVocabToStorage = function() { 
    localStorage.setItem('core_v4_custom_words_' + myId, JSON.stringify(vocabList)); 
};

window.migrateVocabData = function(words) {
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
};

window.formatWordForDisplay = function(str) {
    return str.replace(/[;；].*/g, '')
              .replace(/\([^)]*\)/g, '')
              .replace(/（[^）]*）/g, '')
              .replace(/(動|名|形|副|代|接|前|自動|他動)[:：]\s*/g, '')
              .replace(/〜[をにがとへでや]\s*/g, '')
              .replace(/^[ ,　]+/, '')
              .trim();
};

window.getAllUsers = function() {
    return JSON.parse(localStorage.getItem('core_v4_users') || "[]");
};

window.saveAllUsers = function(users) {
    localStorage.setItem('core_v4_users', JSON.stringify(users));
};

window.generateUserId = function() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let id = "";
    for(let i=0; i<7; i++) id += letters.charAt(Math.floor(Math.random() * letters.length));
    for(let i=0; i<3; i++) id += Math.floor(Math.random() * 10);
    return id;
};

window.switchAuthMode = function(mode) {
    const tabLogin = document.getElementById('authTabLogin');
    const tabReg = document.getElementById('authTabRegister');
    const loginFields = document.getElementById('authLoginFields');
    const regFields = document.getElementById('authRegisterFields');
    const btn = document.getElementById('authSubmitBtn');
    const errorMsg = document.getElementById('authErrorMsg');
    
    if (errorMsg) errorMsg.style.display = 'none';

    if(mode === 'login') {
        if(tabLogin) tabLogin.classList.add('active'); 
        if(tabReg) tabReg.classList.remove('active');
        if (loginFields) loginFields.style.display = 'block';
        if (regFields) regFields.style.display = 'none';
        if(btn) btn.innerHTML = 'システムへログイン <i data-lucide="arrow-right" size="16"></i>';
    } else {
        if(tabLogin) tabLogin.classList.remove('active'); 
        if(tabReg) tabReg.classList.add('active');
        if (loginFields) loginFields.style.display = 'none';
        if (regFields) regFields.style.display = 'block';
        if(btn) btn.innerHTML = 'アカウントを作成 <i data-lucide="sparkles" size="16"></i>';
    }
    window.initLucide();
};

window.handleAuthSubmit = function() {
    const authReg = document.getElementById('authTabRegister');
    const isRegister = authReg ? authReg.classList.contains('active') : false;
    const errorMsg = document.getElementById('authErrorMsg');
    if (errorMsg) errorMsg.style.display = 'none';
    
    if(isRegister) {
        const pName = document.getElementById('regPlayerName').value.trim();
        const rName = document.getElementById('regRealName').value.trim();
        const age = document.getElementById('regAge').value.trim();
        const pin = document.getElementById('regPin').value.trim();
        
        if(!pName || !rName || !age || !pin) {
            if(errorMsg) { errorMsg.innerText = "すべての項目を入力してください！"; errorMsg.style.display = 'block'; }
            return;
        }
        if(!/^\d{4}$/.test(pin)) {
            if(errorMsg) { errorMsg.innerText = "暗証番号は4桁の数字で設定してください！"; errorMsg.style.display = 'block'; }
            return;
        }
        
        const newId = window.generateUserId();
        const users = window.getAllUsers();
        users.push({ id: newId, playerName: pName, realName: rName, age: age, pin: pin });
        window.saveAllUsers(users);
        
        alert(`🎉 アカウント作成成功！\nあなたのログインIDは【 ${newId} 】です。\nログインに必要なので必ずメモしてください！`);
        
        localStorage.setItem('core_v4_userId', newId);
        localStorage.setItem('core_v4_userName', pName);
        localStorage.setItem('core_v4_userTarget', "未設定");
        localStorage.setItem('core_v4_totalExp', "0");
        window.loadLocalState();
        
    } else {
        const idInput = document.getElementById('loginIdInput').value.trim();
        const pinInput = document.getElementById('loginPinInput').value.trim();
        
        if(!idInput || !pinInput) {
            if(errorMsg) { errorMsg.innerText = "IDと暗証番号を入力してください！"; errorMsg.style.display = 'block'; }
            return;
        }
        
        const users = window.getAllUsers();
        const user = users.find(u => u.id === idInput && u.pin === pinInput);
        
        if(user) {
            window.showLoginConfirmPopup(user);
        } else {
            if(errorMsg) { errorMsg.innerText = "IDまたは暗証番号が間違っています！"; errorMsg.style.display = 'block'; }
        }
    }
};

window.handleGuestLogin = function() {
    const errorMsg = document.getElementById('authErrorMsg');
    if (errorMsg) errorMsg.style.display = 'none';
    
    const guestId = "GUEST-000";
    localStorage.setItem('core_v4_userId', guestId);
    localStorage.setItem('core_v4_userName', "ゲストプレイヤー");
    localStorage.setItem('core_v4_userTarget', "テストプレイ中");
    if(!localStorage.getItem('core_v4_totalExp')) localStorage.setItem('core_v4_totalExp', "0");
    
    window.loadLocalState();
};

window.showLoginConfirmPopup = function(user) {
    if(document.getElementById('loginOverlayLayer')) return;
    const overlay = document.createElement('div');
    overlay.id = 'loginOverlayLayer';
    overlay.className = 'login-confirm-overlay';
    
    const box = document.createElement('div');
    box.className = 'login-confirm-card';
    
    box.innerHTML = `
        <div class="login-confirm-avatar"><i data-lucide="user" size="32"></i></div>
        <div style="color:white; font-size:18px; font-weight:800; margin-bottom:8px;">認証確認</div>
        <div style="color:var(--text-sub); font-size:13px; margin-bottom:16px; line-height:1.6;">
            以下のプロファイルでログインしますか？<br>
            <div style="background:rgba(0,0,0,0.4); padding:10px; border-radius:8px; margin-top:8px; text-align:left;">
                <strong>プレイヤー名:</strong> <span style="color:white;">${user.playerName}</span><br>
                <strong>本名:</strong> <span style="color:white;">${user.realName}</span><br>
                <strong>年齢:</strong> <span style="color:white;">${user.age}歳</span>
            </div>
        </div>
        <div style="display:flex; gap:12px;">
            <button style="flex:1; padding:12px; border-radius:10px; border:none; background:var(--input-bg); color:var(--text-main); font-weight:700; cursor:pointer;" id="cancelLoginBtn">キャンセル</button>
            <button style="flex:1; padding:12px; border-radius:10px; border:none; background:var(--cosmic-cyan); color:#000; font-weight:700; cursor:pointer;" id="confirmLoginBtn">ログイン</button>
        </div>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    window.initLucide();
    
    document.getElementById('cancelLoginBtn').onclick = () => { document.body.removeChild(overlay); };
    document.getElementById('confirmLoginBtn').onclick = () => {
        localStorage.setItem('core_v4_userId', user.id);
        localStorage.setItem('core_v4_userName', user.playerName);
        if(!localStorage.getItem('core_v4_userTarget')) localStorage.setItem('core_v4_userTarget', "未設定");
        if(!localStorage.getItem('core_v4_totalExp')) localStorage.setItem('core_v4_totalExp', "0");
        document.body.removeChild(overlay);
        window.loadLocalState();
    };
};

window.renderAdminUserList = function() {
    const container = document.getElementById('adminUserListContainer');
    if(!container) return;
    container.innerHTML = "";
    const users = window.getAllUsers();
    
    if(users.length === 0) {
        container.innerHTML = "<div style='color:var(--text-sub); font-size:12px; text-align:center; padding: 10px;'>ユーザーが登録されていません。</div>";
        return;
    }
    
    users.forEach(u => {
        const div = document.createElement('div');
        div.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid rgba(255,255,255,0.1); font-size:12px;";
        div.innerHTML = `
            <div style="flex:1;">
                <div style="color:var(--cosmic-cyan); font-family:monospace; font-weight:bold; letter-spacing:1px;">ID: ${u.id}</div>
                <div style="color:white; font-weight:bold; margin-top:2px;">${u.playerName} <span style="color:var(--text-sub); font-weight:normal; font-size:10px;">(${u.realName} / ${u.age}歳)</span></div>
            </div>
        `;
        container.appendChild(div);
    });
};

window.loadLocalState = function() {
    const savedId = localStorage.getItem('core_v4_userId');
    geminiApiKey = localStorage.getItem('core_v4_geminiKey') || "";
    const apiKeyInput = document.getElementById('sidebarApiKeyInput');
    if(apiKeyInput) apiKeyInput.value = geminiApiKey;

    const savedTitleText = localStorage.getItem('core_v4_dashboard_title') || "ダッシュボード";
    const headerTitleEl = document.getElementById('headerTitleText');
    if(headerTitleEl) headerTitleEl.innerText = savedTitleText;
    
    if(savedId) {
        myId = savedId;
        const gateScreen = document.getElementById('auth-gate-screen');
        if(gateScreen) gateScreen.style.display = 'none';
        
        myName = localStorage.getItem('core_v4_userName') || "プレイヤー1";
        myTarget = localStorage.getItem('core_v4_userTarget') || "未設定";
        selectedTitle = localStorage.getItem('core_v4_userTitle') || "称号なし";
        totalExp = parseInt(localStorage.getItem('core_v4_totalExp') || "0");
        activeCharacter = localStorage.getItem('core_v4_active_char') || ""; 
        activeWeapon = localStorage.getItem('core_v4_active_weapon') || ""; 
        activeArmor = localStorage.getItem('core_v4_active_armor') || ""; 

        let storedWords = [];
        try { storedWords = JSON.parse(localStorage.getItem('core_v4_custom_words_' + myId) || "[]"); } catch(e) {}
        
        vocabList = window.migrateVocabData(storedWords); 
        window.saveVocabToStorage();
        
        window.applyProfileToUi();
        if(typeof window.updatePartySlotsUi === 'function') window.updatePartySlotsUi(); 
        window.renderVocabList();
        window.renderLeaderboard();
        window.renderHistoryList();
        window.renderBookshelf(); 
        window.renderAdminUserList(); 
        window.renderGameLeaderboard('mine');
    } else {
        const gateScreen = document.getElementById('auth-gate-screen');
        if(gateScreen) gateScreen.style.display = 'flex';
    }
};

window.applyProfileToUi = function() {
    const pNameEl = document.getElementById('sideOptPlayerName');
    if(pNameEl) pNameEl.innerText = myName;
    const gNameEl = document.getElementById('sideOptGroupName');
    if(gNameEl) gNameEl.innerText = "ID: " + myId;
    const profNameEl = document.getElementById('profPlayerName');
    if(profNameEl) profNameEl.innerText = myName;
    const profTitleEl = document.getElementById('profTitleLabel');
    if(profTitleEl) profTitleEl.innerText = selectedTitle + " ⚡";
    const profTargetEl = document.getElementById('profTargetLabel');
    if(profTargetEl) profTargetEl.innerText = "目標: " + myTarget;
    const profCoinEl = document.getElementById('profCoinCount');
    if(profCoinEl) profCoinEl.innerText = totalExp;
};

window.toggleSidebar = function(open) {
    const menu = document.getElementById('sidebarMenu');
    const overlay = document.getElementById('sidebarOverlay');
    if(menu) menu.classList.toggle('open', open);
    if(overlay) overlay.style.display = open ? 'block' : 'none';
};

window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById('view-' + tabId);
    if(view) view.classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const nav = document.getElementById('nav-' + tabId);
    if(nav) nav.classList.add('active');
    
    window.toggleSidebar(false);
    if(tabId !== 'reader' && typeof window.closeReader === 'function') window.closeReader();
    if(tabId === 'game') window.renderGameLeaderboard('mine');
    if(tabId === 'admin') window.renderAdminUserList(); 
};

// ==========================================================================
// 📖 単語帳関連
// ==========================================================================
window.toggleBulkImportCard = function() {
    const sec = document.getElementById('bulkImportToggleSection');
    if(!sec) return;
    sec.style.display = sec.style.display === 'none' ? 'block' : 'none';
    if(sec.style.display === 'block') window.renderBulkDeleteList();
};

window.handleBulkWordImport = function() {
    const input = document.getElementById('bulkWordInput');
    if(!input) return;
    const text = input.value.trim();
    if(!text) return;
    if (text.startsWith("[") && text.endsWith("]")) {
        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].word) {
                if (confirm("バックアップデータで完全に上書きしますか？")) {
                    vocabList = window.migrateVocabData(parsed);
                    window.saveVocabToStorage(); window.renderVocabList(); window.renderBulkDeleteList();
                    input.value = ""; alert("統合完了しました！"); return;
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
                newWord = window.migrateVocabData([newWord])[0]; 
                if(existingIdx >= 0) vocabList[existingIdx] = newWord;
                else vocabList.push(newWord);
            }
        }
    });
    vocabList.sort((a,b) => parseInt(a.num) - parseInt(b.num));
    window.saveVocabToStorage(); window.renderVocabList(); window.renderBulkDeleteList();
    input.value = ""; alert("一括インポートが完了しました。");
};

window.renderBulkDeleteList = function() {
    const c = document.getElementById('bulkDeleteListContainer'); 
    if(!c) return;
    c.innerHTML = "";
    vocabList.forEach(w => {
        const row = document.createElement('div'); row.style.cssText = "display:flex; align-items:center; gap:8px; padding:6px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:13px;";
        row.innerHTML = `<input type="checkbox" class="bulk-delete-chk" value="${w.num}"><span style="color:var(--text-sub);">#${w.num}</span><strong>${w.word}</strong>`;
        c.appendChild(row);
    });
};

window.selectAllBulkDelete = function(checked) { 
    document.querySelectorAll('.bulk-delete-chk').forEach(chk => chk.checked = checked); 
};

window.showCustomBulkDeleteConfirm = function(count, numsToDelete) {
    if(document.getElementById('bulkDelOverlayLayer')) return;
    const overlay = document.createElement('div');
    overlay.id = 'bulkDelOverlayLayer';
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);";
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
        window.saveVocabToStorage(); window.renderVocabList(); window.renderBulkDeleteList();
        document.body.removeChild(overlay);
    };
};

window.handleBulkDeleteExecute = function() {
    const checkedBoxes = document.querySelectorAll('.bulk-delete-chk:checked');
    if(checkedBoxes.length === 0) return alert("削除したい単語にチェックを入れてください。");
    const nums = Array.from(checkedBoxes).map(chk => String(chk.value));
    window.showCustomBulkDeleteConfirm(checkedBoxes.length, nums);
};

window.showCustomBulkResetConfirm = function(count, numsToReset) {
    if(document.getElementById('bulkResetOverlayLayer')) return;
    const overlay = document.createElement('div');
    overlay.id = 'bulkResetOverlayLayer';
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);";
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
        window.saveVocabToStorage(); window.renderVocabList(); window.renderBulkDeleteList();
        document.body.removeChild(overlay);
    };
};

window.handleBulkResetExecute = function() {
    const checkedBoxes = document.querySelectorAll('.bulk-delete-chk:checked');
    if(checkedBoxes.length === 0) return alert("リセットしたい単語にチェックを入れてください。");
    const nums = Array.from(checkedBoxes).map(chk => String(chk.value));
    window.showCustomBulkResetConfirm(checkedBoxes.length, nums);
};

window.setVocabFilter = function(filter) {
    vocabFilter = filter;
    document.querySelectorAll('.filter-scroller .pill-btn').forEach(b => b.classList.remove('active'));
    const fBtn = document.getElementById('filter-' + filter);
    if(fBtn) fBtn.classList.add('active');
    window.renderVocabList();
};

window.showCustomDeleteConfirm = function(numStr) {
    if(document.getElementById('delOverlayLayer')) return;
    const overlay = document.createElement('div');
    overlay.id = 'delOverlayLayer';
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);";
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
        window.saveVocabToStorage(); window.renderVocabList(); window.renderBulkDeleteList();
        document.body.removeChild(overlay);
    };
};

window.getCardStyleByHistory = function(wordObj) {
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
};

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
            window.saveVocabToStorage(); 
            window.renderVocabList();
        }
    }
};

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
    window.initLucide();
};

// 🌟 単語帳インライン編集モード制御関数
window.toggleInlineWordEdit = function(event, wordNum) {
    if(event) event.stopPropagation();
    const cardBody = document.getElementById(`wordCardBody-${wordNum}`);
    const cardForm = document.getElementById(`wordCardForm-${wordNum}`);
    if(cardBody && cardForm) {
        if(cardForm.style.display === 'none' || !cardForm.style.display) {
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

// 🌟 編集フォーム内の意味リスト(案B：独立入力欄パーツ化)の描画関数
window.renderInlineEditFormMeanings = function(wordNum) {
    const listContainer = document.getElementById(`inlineEditMeaningsList-${wordNum}`);
    if(!listContainer) return;
    listContainer.innerHTML = "";
    
    const wEl = vocabList.find(w => String(w.num) === String(wordNum));
    if(!wEl || !wEl.meanings) return;
    
    wEl.meanings.forEach((m, index) => {
        const itemRow = document.createElement('div');
        itemRow.style.cssText = "display:flex; align-items:center; gap:8px; margin-bottom:8px;";
        itemRow.innerHTML = `
            <input type="text" class="search-input inline-m-input-${wordNum}" style="margin:0; flex:1; height:36px;" value="${m.text}">
            <button class="list-action-link" style="background:#EF4444; color:white; border:none; padding:0 10px; height:36px; display:flex; align-items:center;" onclick="window.removeInlineMeaningField(event, '${wordNum}', ${index})">
                <i data-lucide="trash-2" size="14"></i>
            </button>
        `;
        listContainer.appendChild(itemRow);
    });
    window.initLucide();
};

// 🌟 フォーム内の特定の意味フィールド削除
window.removeInlineMeaningField = function(event, wordNum, index) {
    if(event) event.stopPropagation();
    const wEl = vocabList.find(w => String(w.num) === String(wordNum));
    if(wEl && wEl.meanings) {
        wEl.meanings.splice(index, 1);
        window.renderInlineEditFormMeanings(wordNum);
    }
};

// 🌟 フォーム内への新規意味フィールド追加
window.addInlineMeaningField = function(event, wordNum) {
    if(event) event.stopPropagation();
    const wEl = vocabList.find(w => String(w.num) === String(wordNum));
    if(wEl) {
        if(!wEl.meanings) wEl.meanings = [];
        wEl.meanings.push({ id: `${wordNum}-${Date.now()}`, text: "", status: "none", history: [] });
        window.renderInlineEditFormMeanings(wordNum);
    }
};

// 🌟 編集内容の保存処理
window.saveInlineWordEdit = function(event, wordNum) {
    if(event) event.stopPropagation();
    const wIdx = vocabList.findIndex(w => String(w.num) === String(wordNum));
    if(wIdx === -1) return;
    
    const wordInput = document.getElementById(`inlineEditWordInput-${wordNum}`);
    const subInput = document.getElementById(`inlineEditSubInput-${wordNum}`);
    const mInputs = document.querySelectorAll(`.inline-m-input-${wordNum}`);
    
    if(wordInput) vocabList[wIdx].word = wordInput.value.trim();
    if(subInput) vocabList[wIdx].sub = subInput.value.trim();
    
    // パーツ化された各入力欄の値を再回収
    const updatedMeanings = [];
    mInputs.forEach((inp, idx) => {
        const txt = inp.value.trim();
        if(txt) {
            // 既存のステータス等を引き継ぐか新規作成
            const oldM = vocabList[wIdx].meanings[idx];
            updatedMeanings.push({
                id: oldM ? oldM.id : `${wordNum}-${idx}-${Date.now()}`,
                text: txt,
                status: oldM ? oldM.status : "none",
                history: oldM ? oldM.history : []
            });
        }
    });
    
    vocabList[wIdx].meanings = updatedMeanings;
    
    // 後方互換性用の単一文字列フィールドも再構成して合成
    vocabList[wIdx].meaning = updatedMeanings.map((m, i) => updatedMeanings.length > 1 ? `①②③④⑤⑥⑦⑧⑨⑩`[i] + m.text : m.text).join("");
    
    window.saveVocabToStorage();
    window.renderVocabList();
    alert("単語情報を更新しました！");
};

window.renderVocabList = function() {
    const container = document.getElementById('vocabListContainer'); 
    if(!container) return;
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
        card.setAttribute('style', window.getCardStyleByHistory(w));
        
        card.onclick = (e) => {
            if (e.target.closest('button') || e.target.closest('.word-expand-toggle') || e.target.closest('input') || e.target.closest('textarea')) return; 
            window.openWordPopoverFromVocab(e, w, w.word);
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
                        <button style="width:24px; height:24px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:${m.status==='ok'?'var(--word-ok)':'rgba(0,0,0,0.5)'}; color:${m.status==='ok'?'#000':'white'}; font-size:10px; font-weight:900; cursor:pointer;" onclick="window.updateMeaningStatus('${w.num}', '${m.id}', 'ok', event)">⚪︎</button>
                        <button style="width:24px; height:24px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:${m.status==='so'?'var(--word-so)':'rgba(0,0,0,0.5)'}; color:${m.status==='so'?'#000':'white'}; font-size:10px; font-weight:900; cursor:pointer;" onclick="window.updateMeaningStatus('${w.num}', '${m.id}', 'so', event)">△</button>
                        <button style="width:24px; height:24px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:${m.status==='bad'?'var(--word-bad)':'rgba(0,0,0,0.5)'}; color:${m.status==='bad'?'#FFF':'white'}; font-size:10px; font-weight:900; cursor:pointer;" onclick="window.updateMeaningStatus('${w.num}', '${m.id}', 'bad', event)">✕</button>
                        <button style="width:24px; height:24px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:${m.status==='none'?'rgba(255,255,255,0.3)':'rgba(0,0,0,0.5)'}; color:white; font-size:10px; font-weight:900; cursor:pointer;" onclick="window.updateMeaningStatus('${w.num}', '${m.id}', 'none', event)">ー</button>
                    </div>
                </div>`;
        });
        meaningsHtml += `</div>`;

        card.innerHTML = `
            <div style="position:absolute; right:8px; top:8px; display:flex; gap:2px; z-index:100;">
                <button class="card-edit-btn" style="background:none; border:none; color:var(--text-sub); padding:10px; cursor:pointer;" onclick="window.toggleInlineWordEdit(event, '${w.num}')">
                    <i data-lucide="edit-3" size="18"></i>
                </button>
                <button class="card-delete-btn" style="background:none; border:none; color:var(--text-sub); padding:10px; cursor:pointer;" onclick="event.stopPropagation(); window.showCustomDeleteConfirm('${w.num}')">
                    <i data-lucide="trash-2" size="18"></i>
                </button>
            </div>
            
            <!-- 🌟 通常カードボディ表示領域 -->
            <div id="wordCardBody-${w.num}">
                <div class="word-main-line" style="display:flex; justify-content:space-between; align-items:center; padding-right:76px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="word-num-badge" style="background:rgba(255,255,255,0.3); color:white; font-size:11px; font-weight:700; padding:2px 6px; border-radius:4px;">#${w.num}</span>
                        <span style="font-size:18px; font-weight:800; color:white;">${w.word}</span>
                    </div>
                </div>
                ${meaningsHtml}
                ${w.sub ? `
                <div class="word-static-info" style="margin-top:4px; padding-top:0; border:none;">
                    <button class="word-expand-toggle" style="background:none; border:none; color:#C7D2FE; font-size:11px; font-weight:700; cursor:pointer; padding:4px 0; display:inline-flex; align-items:center; gap:4px; z-index:40;" onclick="window.coreSystemToggleExpand(event, this)">
                        サブ情報を展開 <i data-lucide="chevron-down" size="12"></i>
                    </button>
                    <div class="word-meaning-extra" style="display:none; font-size:12.5px; color:#FFF; line-height:1.6; margin-top:6px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.25); white-space:pre-line;">
                        <div class="sub-info-block" style="background:rgba(0,0,0,0.45); padding:6px 10px; border-radius:6px; font-size:12px; color:#FFF;">${w.sub}</div>
                    </div>
                </div>` : ''}
                <div style="display:flex; justify-content:flex-end; align-items:center; margin-top:12px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.1);">${dotsHtml}</div>
            </div>

            <!-- 🌟 新設：パッと切り替わるインライン高速編集フォームエリア -->
            <div id="wordCardForm-${w.num}" style="display:none; padding-top:32px;">
                <div style="margin-bottom:12px;">
                    <label style="font-size:11px; color:var(--cosmic-cyan); font-weight:700; display:block; margin-bottom:4px;">単語</label>
                    <input type="text" id="inlineEditWordInput-${w.num}" class="search-input" style="margin:0;" value="${w.word}">
                </div>
                
                <div style="margin-bottom:12px;">
                    <label style="font-size:11px; color:var(--cosmic-purple-light); font-weight:700; display:block; margin-bottom:4px;">意味の編集 (パーツ個別管理)</label>
                    <div id="inlineEditMeaningsList-${w.num}"></div>
                    <button class="list-action-link" style="width:100%; text-align:center; height:32px; border-style:dashed; margin-top:4px;" onclick="window.addInlineMeaningField(event, '${w.num}')">
                        <i data-lucide="plus" size="12" style="vertical-align:middle;"></i> 意味を追加
                    </button>
                </div>

                <div style="margin-bottom:14px;">
                    <label style="font-size:11px; color:var(--text-sub); font-weight:700; display:block; margin-bottom:4px;">サブ情報</label>
                    <textarea id="inlineEditSubInput-${w.num}" class="modern-textarea" style="height:60px; margin:0;">${w.sub || ""}</textarea>
                </div>

                <div style="display:flex; gap:8px;">
                    <button class="list-action-link" style="flex:1; text-align:center; height:36px; background:rgba(255,255,255,0.05); border:1px solid var(--border);" onclick="window.toggleInlineWordEdit(event, '${w.num}')">
                        キャンセル
                    </button>
                    <button class="list-action-link" style="flex:1; text-align:center; height:36px; background:var(--accent); color:white; border:none;" onclick="window.saveInlineWordEdit(event, '${w.num}')">
                        保存する
                    </button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
    window.initLucide();
};

// ==========================================================================
// 📖 リーダー＆AI解析処理
// ==========================================================================
window.analyzeText = async function(rawText, assignedTitle = null) {
    if(!rawText) return; currentActiveReaderText = rawText; currentActiveTitle = assignedTitle || "無題のテキスト";
    const customJaEl = document.getElementById('customJapanesetextarea');
    const customJaLines = customJaEl ? customJaEl.value.trim().split('\n').filter(l => l.trim() !== '') : [];
    if(assignedTitle) {
        textHistory = textHistory.filter(h => h.text !== rawText); 
        textHistory.unshift({ id: Date.now(), title: assignedTitle, text: rawText });
        localStorage.setItem('textHistory', JSON.stringify(textHistory)); window.renderHistoryList();
    }
    document.getElementById('text-input-view').style.display = 'none'; document.getElementById('text-reader-view').style.display = 'block';
    const englishContainer = document.getElementById('englishContainer'); 
    englishContainer.innerHTML = '<div style="text-align:center; padding: 60px 20px; color: var(--cosmic-cyan); font-weight: bold; font-size: 16px; display:flex; flex-direction:column; align-items:center;"><i data-lucide="loader" class="animate-spin" size="36" style="margin-bottom:16px;"></i><span>🌀 AI構文解析・和訳取得中...</span></div>';
    window.initLucide();
    
    let aiAnalysisResult = geminiApiKey ? await window.callGeminiAnalyzer(rawText) : null;
    
    if (geminiApiKey && !aiAnalysisResult) {
        window.closeReader();
        return;
    }

    const safeTextForBtn = rawText.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
    const safeTitleForBtn = currentActiveTitle.replace(/'/g, "\\'").replace(/"/g, "&quot;");

    document.getElementById('readerCurrentTitle').innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; width:100%;">
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; max-width:260px;">📖 ${currentActiveTitle}</span>
            <button style="padding:6px 12px; font-size:11px; font-weight:bold; border-radius:6px; background:rgba(255,255,255,0.1); color:#E2E8F0; border:1px solid rgba(255,255,255,0.3); cursor:pointer; white-space:nowrap; transition:all 0.2s;" onclick="window.showCustomSaveBookshelfPrompt(\`${safeTextForBtn}\`, '${safeTitleForBtn}')">
                <i data-lucide="folder-plus" size="12" style="vertical-align:middle; margin-right:2px;"></i> 本棚に保存する
            </button>
        </div>
    `;
    window.initLucide();

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
                gSpan.onclick = (e) => { if (e.target.classList.contains('word-span')) return; window.openGrammarPopover(e, grammarData.phrase, grammarData.meaning); };
                mainContent.appendChild(gSpan); wordContainer = gSpan;
            }
            const subTokens = isGrammar ? wStr.split(' ') : [wStr];
            subTokens.forEach((subToken, index) => {
                if(!subToken) return; const cleanKey = subToken.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]\"']/g,"");
                const span = document.createElement('span'); span.className = 'word-span'; span.innerText = subToken + (index < subTokens.length - 1 ? ' ' : (isGrammar ? ' ' : ' '));
                const vocabMatch = vocabList.find(v => v.word.toLowerCase() === cleanKey);
                if(vocabMatch) {
                    span.classList.add('registered'); let hasOk = false; let hasBad = false; let hasSo = false; let hasAnyHistory = false;
                    vocabMatch.meanings.forEach(m => { if(m.history && m.history.length > 0) hasAnyHistory = true; if(m.status === 'ok') hasOk = true; if(m.status === 'so') hasSo = true; if(m.status === 'bad') hasBad = true; });
                    if(!hasAnyHistory) span.classList.add(`status-none`); else if(hasBad) span.classList.add(`status-bad`); else if(hasSo) span.classList.add(`status-so`); else if(hasOk) span.classList.add(`status-ok`);
                    span.onclick = (e) => window.openWordPopoverFromVocab(e, vocabMatch, subToken);
                } else {
                    const dictMatch = dictionaryData.find(d => d.en === cleanKey);
                    if(dictMatch) {
                        span.classList.add('registered'); span.classList.add(wordMemory[cleanKey] ? `status-${wordMemory[cleanKey]}` : `status-none`);
                        span.onclick = (e) => window.openWordPopover(e, cleanKey, subToken);
                    }
                }
                wordContainer.appendChild(span);
            });
        });
        
        let finalJaText = customJaLines[sIdx] || sData.translation || sData.translations || "（和訳未取得）"; 
        totalSummaryJa += `${sIdx+1}. ${finalJaText}<br>`;
        const jaSpan = document.createElement('span'); jaSpan.className = 'sentence-ja'; jaSpan.innerText = finalJaText; mainContent.appendChild(jaSpan);
        block.appendChild(mainContent); englishContainer.appendChild(block);
    });
    document.getElementById('summaryJaContainer').innerHTML = totalSummaryJa; window.setTranslationMode(currentTranslationMode); window.initLucide();
};
// ==========================================================================
// 📖 リーダーの残り・本棚保存・ポップオーバー関連 ロジック
// ==========================================================================

window.showCustomSaveBookshelfPrompt = function(text, title) {
    if(document.getElementById('saveBookshelfOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'saveBookshelfOverlay';
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);";
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
        myBookshelf.push({ id: Date.now(), folder: folder, title: title || "無題 Graves", text: text });
        localStorage.setItem('myBookshelf', JSON.stringify(myBookshelf)); alert(`保存しました！`); window.renderBookshelf(); document.body.removeChild(overlay);
    };
};

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
            const safeTitle = item.title ? item.title.replace(/'/g, "\\'").replace(/"/g, "&quot;") : "無題";
            folderHtml += `
                <div class="list-item-row" style="background:rgba(255,255,255,0.05); padding:10px 14px; border-radius:8px; margin-bottom:8px;">
                    <div class="list-item-title" style="flex:1;"><span><i data-lucide="file-text" size="12" style="color:var(--text-sub); margin-right:4px;"></i>${item.title}</span></div>
                    <div style="display:flex; gap:8px;">
                        <button class="list-action-link" style="background:var(--accent); border:none;" onclick="window.analyzeText(\`${safeText}\`, '${safeTitle}')">開く</button>
                        <button class="word-delete-btn" style="display:flex !important; background:none; border:none; color:#EF4444; padding:4px; cursor:pointer;" onclick="event.stopPropagation(); event.preventDefault(); window.showCustomDeleteBookshelfConfirm('${item.id}')"><i data-lucide="trash-2" size="14"></i></button>
                    </div>
                </div>`;
        });
        folderHtml += `</div>`; container.innerHTML += folderHtml;
    }
    window.initLucide();
};

window.showCustomDeleteBookshelfConfirm = function(idString) {
    myBookshelf = myBookshelf.filter(item => String(item.id) !== String(idString)); 
    localStorage.setItem('myBookshelf', JSON.stringify(myBookshelf)); 
    window.renderBookshelf(); 
};

// 🌟 不具合修正：長文履歴をダイアログ確認付きでローカルストレージから完全消去する高速関数
window.showCustomDeleteHistoryConfirm = function(idString) {
    textHistory = textHistory.filter(h => String(h.id) !== String(idString)); 
    localStorage.setItem('textHistory', JSON.stringify(textHistory)); 
    window.renderHistoryList(); 
};

window.renderHistoryList = function() {
    const container = document.getElementById('historyListContainer');
    if(!container) return; container.innerHTML = '';
    if(textHistory.length === 0) { container.innerHTML = `<div style="color:var(--text-sub); font-size:12px;">ログがありません</div>`; return; }
    textHistory.forEach(h => {
        const safeText = h.text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
        const safeTitle = h.title ? h.title.replace(/'/g, "\\'").replace(/"/g, "&quot;") : "無題";
        const row = document.createElement('div'); row.className = 'list-item-row';
        row.innerHTML = `<div class="list-item-title"><span>${h.title}</span></div>
            <div style="display:flex; gap:8px;">
                <button class="list-action-link" onclick="window.analyzeText(\`${safeText}\`, '${safeTitle}')">開く</button>
                <button class="word-delete-btn" style="display:flex !important; background:none; border:none; color:var(--text-sub); padding:4px; cursor:pointer;" onclick="event.stopPropagation(); event.preventDefault(); window.showCustomDeleteHistoryConfirm('${h.id}')"><i data-lucide="trash-2" size="14"></i></button>
            </div>`;
        container.appendChild(row);
    });
    window.initLucide();
};

window.updateReaderWordColors = function() {
    document.querySelectorAll('.word-span').forEach(span => {
        let text = span.innerText.trim();
        let cleanKey = text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]\"']/g,"");
        if(!cleanKey) return;
        
        span.classList.remove('status-ok', 'status-so', 'status-bad', 'status-none');
        
        const vocabMatch = vocabList.find(v => v.word.toLowerCase() === cleanKey);
        if(vocabMatch) {
            span.classList.add('registered'); 
            let hasOk = false; let hasBad = false; let hasSo = false; let hasAnyHistory = false;
            vocabMatch.meanings.forEach(m => { 
                if(m.history && m.history.length > 0) hasAnyHistory = true; 
                if(m.status === 'ok') hasOk = true; 
                if(m.status === 'so') hasSo = true; 
                if(m.status === 'bad') hasBad = true; 
            });
            if(!hasAnyHistory) span.classList.add(`status-none`); 
            else if(hasBad) span.classList.add(`status-bad`); 
            else if(hasSo) span.classList.add(`status-so`); 
            else if(hasOk) span.classList.add(`status-ok`);
        } else {
            const dictMatch = dictionaryData.find(d => d.en === cleanKey);
            if(dictMatch) {
                span.classList.add('registered'); 
                span.classList.add(wordMemory[cleanKey] ? `status-${wordMemory[cleanKey]}` : `status-none`);
            }
        }
    });
};

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
                    <button style="width:26px; height:26px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:${m.status==='ok'?'var(--word-ok)':'rgba(0,0,0,0.5)'}; color:${m.status==='ok'?'#000':'white'}; font-size:10px; font-weight:900; cursor:pointer;" onclick="window.updateMeaningStatusFromPopover('${vocabItem.num}', '${m.id}', 'ok', event)">⚪︎</button>
                    <button style="width:26px; height:26px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:${m.status==='so'?'var(--word-so)':'rgba(0,0,0,0.5)'}; color:${m.status==='so'?'#000':'white'}; font-size:10px; font-weight:900; cursor:pointer;" onclick="window.updateMeaningStatusFromPopover('${vocabItem.num}', '${m.id}', 'so', event)">△</button>
                    <button style="width:26px; height:26px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:${m.status==='bad'?'var(--word-bad)':'rgba(0,0,0,0.5)'}; color:${m.status==='bad'?'#FFF':'white'}; font-size:10px; font-weight:900; cursor:pointer;" onclick="window.updateMeaningStatusFromPopover('${vocabItem.num}', '${m.id}', 'bad', event)">✕</button>
                    <button style="width:26px; height:26px; border-radius:50%; border:1px solid rgba(255,255,255,0.3)':'rgba(0,0,0,0.5)'}; color:white; font-size:10px; font-weight:900; cursor:pointer;" onclick="window.updateMeaningStatusFromPopover('${vocabItem.num}', '${m.id}', 'none', event)">ー</button>
                </div>
            </div>`;
    });
    document.getElementById('popMeaning').innerHTML = meaningHtml; document.getElementById('popoverStatusBtns').style.display = "none"; 
    const pop = document.getElementById('wordPopover'); pop.style.display = 'flex'; pop.classList.add('show');
};

window.updateMeaningStatusFromPopover = function(wordNum, meaningId, status, event) {
    if(event) event.stopPropagation(); window.updateMeaningStatus(wordNum, meaningId, status, null); 
    const vocabItem = vocabList.find(w => String(w.num) === String(wordNum));
    if(vocabItem) { 
        window.openWordPopoverFromVocab(null, vocabItem, document.getElementById('popWord').innerText); 
        window.updateReaderWordColors(); 
    }
};

window.openWordPopover = function(event, cleanKey, originalText) {
    if(event) event.stopPropagation(); currentTargetWordToken = cleanKey; currentTargetVocabNum = null;
    const match = dictionaryData.find(d => d.en === cleanKey);
    document.getElementById('popWord').innerText = originalText; document.getElementById('popWordNum').innerText = "";
    document.getElementById('popMeaning').innerText = match ? match.ja : '未登録'; document.getElementById('popoverStatusBtns').style.display = "flex"; 
    const pop = document.getElementById('wordPopover'); pop.style.display = 'flex'; pop.classList.add('show');
};

window.setWordStatusFromReader = function(status) {
    if(currentTargetWordToken && !currentTargetVocabNum) {
        wordMemory[currentTargetWordToken] = status; localStorage.setItem('wordMemory', JSON.stringify(wordMemory));
        totalExp += 10; localStorage.setItem('core_v4_totalExp', totalExp);
        const coinEl = document.getElementById('profCoinCount'); if(coinEl) coinEl.innerText = totalExp;
        window.updateReaderWordColors(); 
    }
    window.closeWordPopover();
};

window.closeWordPopover = function() { document.getElementById('wordPopover').classList.remove('show'); document.getElementById('wordPopover').style.display = 'none'; };
window.closeReader = function() { document.getElementById('text-input-view').style.display = 'block'; document.getElementById('text-reader-view').style.display = 'none'; };
window.setTranslationMode = function(mode) {
    currentTranslationMode = mode;
    document.getElementById('toggle-inline').classList.toggle('active', mode === 'inline'); document.getElementById('toggle-bottom').classList.toggle('active', mode === 'bottom');
    document.querySelectorAll('.sentence-ja').forEach(el => el.style.display = mode === 'inline' ? 'block' : 'none');
    document.getElementById('summary-ja-card').style.display = mode === 'bottom' ? 'block' : 'none';
};

// ==========================================================================
// 📊 アクティビティログ・チャートモジュール
// ==========================================================================

window.renderActivityChart = function() {
    const chart = document.getElementById('activityBarChart'); if(!chart) return; chart.innerHTML = "";
    ["月", "火", "水", "木", "金", "土", "日"].forEach(d => {
        const wrap = document.createElement('div'); wrap.className = "bar-wrapper";
        const fill = document.createElement('div'); fill.className = "bar-fill active"; fill.style.height = "50%";
        const lbl = document.createElement('div'); lbl.className = "bar-label"; lbl.innerText = d;
        wrap.appendChild(fill); wrap.appendChild(lbl); chart.appendChild(wrap);
    });
};

window.saveSidebarProfile = function() {
    geminiApiKey = document.getElementById('sidebarApiKeyInput').value.trim(); localStorage.setItem('core_v4_geminiKey', geminiApiKey);
    myName = document.getElementById('sideInputName').value.trim() || myName; myTarget = document.getElementById('sideInputTarget').value.trim() || myTarget;
    selectedTitle = document.getElementById('sideSelectTitle').value; window.applyProfileToUi(); window.toggleSidebar(false);
};

// ==========================================================================
// 🛠️ 管理者メニュー / 配信アナウンス関連 ロジック
// ==========================================================================

window.enterAdminModeDirect = function() { 
    const overlay = document.getElementById('adminPassOverlay');
    const input = document.getElementById('adminPassInput');
    if (overlay && input) {
        input.value = ""; overlay.style.display = 'flex'; input.focus();
    } else {
        const pass = prompt("管理者専用アクセスです。\nパスワードを入力してください。");
        if (pass === "tutinokopanda") { window.switchTab('admin'); } 
        else if (pass !== null) { alert("⚠️ パスワードが違います。アクセスが拒否されました。"); }
    }
};

window.checkAdminPassword = function() {
    const input = document.getElementById('adminPassInput');
    const overlay = document.getElementById('adminPassOverlay');
    if (input && input.value === "tutinokopanda") {
        overlay.style.display = 'none'; window.switchTab('admin');
    } else {
        alert("⚠️ パスワードが違います。アクセスが拒否されました。"); if(input) input.value = "";
    }
};

window.saveAdminDashboardTitle = function() {
    const input = document.getElementById('adminDashboardTitleInput'); if(!input) return;
    const txt = input.value.trim() || "ダッシュボード"; localStorage.setItem('core_v4_dashboard_title', txt);
    const headerTitleEl = document.getElementById('headerTitleText'); if(headerTitleEl) headerTitleEl.innerText = txt;
    alert("ダッシュボードのタイトルを更新しました！");
};

window.saveAdminSystemSettings = function() { window.switchTab('home'); };
window.logoutToGate = function() { localStorage.clear(); location.reload(); };
window.resetLeaderboard = function() { if(confirm("ランキング履歴を一括で削除しますか？")) { ['ja2en', 'en2ja', 'mixed'].forEach(m => { ['endless'].forEach(d => { localStorage.removeItem(`cosmic_score_${m}_${d}`); }); }); window.renderGameLeaderboard('mine'); } };
window.resetBestScore = function() { if(confirm("ベストスコアを0に戻しますか？")) { ['ja2en', 'en2ja', 'mixed'].forEach(m => { ['endless'].forEach(d => { localStorage.removeItem(`cosmic_best_${m}_${d}`); }); }); } };
window.resetScorePopup = function(popupEl) { popupEl.className = "giant-score-popup"; void popupEl.offsetWidth; };

// ==========================================================================
// 🏆 ゲーム用リーダーボード制御 ロジック
// ==========================================================================

window.setLbMode = function(mode) {
    currentLbMode = mode;
    ['lbBtnModeJa', 'lbBtnModeEn', 'lbBtnModeMix'].forEach(id => {
        let el = document.getElementById(id); if(el) { el.style.background = 'rgba(7, 11, 25, 0.85)'; el.style.boxShadow = '0 0 12px rgba(0, 240, 255, 0.2)'; }
    });
    let targetId = mode === 'ja2en' ? 'lbBtnModeJa' : mode === 'en2ja' ? 'lbBtnModeEn' : 'lbBtnModeMix';
    let targetEl = document.getElementById(targetId);
    if(targetEl) { targetEl.style.background = 'linear-gradient(135deg, rgba(0, 240, 255, 0.4) 0%, rgba(192, 132, 252, 0.4) 100%)'; targetEl.style.boxShadow = '0 0 15px rgba(0, 240, 255, 0.6)'; }
    window.renderGameLeaderboard();
};

window.setLbDiff = function(diff) {
    currentLbDiff = diff;
    ['lbBtnDiffNormal', 'lbBtnDiffHard', 'lbBtnDiffExpert', 'lbBtnDiffEndless'].forEach(id => {
        let el = document.getElementById(id); if(el) { el.style.background = 'rgba(7, 11, 25, 0.85)'; el.style.boxShadow = '0 0 12px rgba(0, 240, 255, 0.2)'; }
    });
    let targetId = diff === 'normal' ? 'lbBtnDiffNormal' : diff === 'hard' ? 'lbBtnDiffHard' : diff === 'expert' ? 'lbBtnDiffExpert' : diff === 'endless' ? 'lbBtnDiffEndless' : '';
    let targetEl = document.getElementById(targetId);
    if(targetEl) { targetEl.style.background = 'linear-gradient(135deg, rgba(0, 240, 255, 0.4) 0%, rgba(192, 132, 252, 0.4) 100%)'; targetEl.style.boxShadow = '0 0 15px rgba(0, 240, 255, 0.6)'; }
    window.renderGameLeaderboard();
};

window.renderGameLeaderboard = function(type = currentLbType) {
    currentLbType = type;
    const container = document.getElementById('leaderboardListContainer'); if(!container) return; container.innerHTML = "";
    if (type === 'mine') {
        const keyHistory = `cosmic_score_${currentLbMode}_endless`; let history = JSON.parse(localStorage.getItem(keyHistory) || "[]");
        if (history.length === 0) { container.innerHTML = `<div style="text-align:center; color:var(--text-sub); font-size:12px; margin-top:20px;">このモードの記録はありません</div>`; return; }
        const rankColors = ["#FBBF24", "#94A3B8", "#D97706", "var(--cosmic-cyan)", "var(--cosmic-cyan)"];
        history.forEach((record, index) => {
            const row = document.createElement('div'); row.style.cssText = `display:flex; justify-content:space-between; align-items:center; padding:6px 8px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:13px;`;
            row.innerHTML = `<div style="display:flex; gap:12px; align-items:center;"><span style="color:${rankColors[index] || 'white'}; font-weight:900; font-size:15px; width:20px; text-align:center;">${index + 1}</span><span style="color:white; font-weight:800; letter-spacing:1px;">${record.score}</span></div><div style="color:var(--text-sub); font-size:11px;">${record.date}</div>`;
            container.appendChild(row);
        });
    } else {
        container.innerHTML = `<div style="text-align:center; color:var(--text-sub); font-size:12px; margin-top:20px;"><i data-lucide="server-off" size="16" style="margin-bottom:4px;"></i><br>コミュニティデータ準備中...</div>`; window.initLucide();
    }
};

window.switchLeaderboard = function(type) {
    document.getElementById('lbTabMine').classList.toggle('active', type === 'mine');
    if(document.getElementById('lbTabComm')) document.getElementById('lbTabComm').classList.toggle('active', type === 'comm');
    window.renderGameLeaderboard(type);
};

// ==========================================================================
// 🎮 ソロ学習テストゲームプレイ制御 ロジック
// ==========================================================================

window.showModeSelectScreen = function() {
    if (vocabList.length === 0) {
        alert("⚠️ 単語帳が空のため、テスト用の単語を自動追加してテスト画面を開きます！");
        vocabList.push({num: "1", word: "apple", meanings: [{id: "1-0", text: "りんご", status: "none", history: []}], sub: "", status: "none", history: []});
        window.saveVocabToStorage(); window.renderVocabList();
    }
    const startScreen = document.getElementById('game-start-screen'); if (startScreen) startScreen.style.display = 'none';
    const diffScreen = document.getElementById('game-difficulty-select-screen'); if (diffScreen) diffScreen.style.display = 'none';
    const modeScreen = document.getElementById('game-mode-select-screen'); if (modeScreen) modeScreen.style.display = 'block';
};

window.goToDifficultySelect = function(mode) {
    selectedQuestionMode = mode; document.getElementById('game-mode-select-screen').style.display = 'none'; document.getElementById('game-difficulty-select-screen').style.display = 'block';
};

window.backToModeSelect = function() {
    document.getElementById('game-difficulty-select-screen').style.display = 'none'; document.getElementById('game-mode-select-screen').style.display = 'block';
};

window.startActualGame = function(difficulty) {
    document.body.classList.add('in-game-active'); currentGameDifficulty = difficulty; document.getElementById('game-difficulty-select-screen').style.display = 'none';
    gameScoreCount = 0; gameCurrentIndex = 0; gameMistakeCount = 0; gameComboCount = 0; gameComboTotalScore = 0; gameHistoryLog = []; isGameProcessingAnswer = false; isGameTimerPaused = false;
    gameCurrentWordsQueue = [];
    vocabList.forEach(w => {
        if(w.meanings && w.meanings.length > 0) {
            let qMode = selectedQuestionMode === 'mixed' ? (Math.random() > 0.5 ? 'en2ja' : 'ja2en') : selectedQuestionMode;
            if(qMode === 'en2ja') gameCurrentWordsQueue.push({ type: 'en2ja', wordNum: w.num, word: w.word, meaningId: null, correctAnswers: w.meanings.map(m => window.formatWordForDisplay(m.text)) });
            else w.meanings.forEach(m => { gameCurrentWordsQueue.push({ type: 'ja2en', wordNum: w.num, word: w.word, meaningId: m.id, display: window.formatWordForDisplay(m.text) }); });
        }
    });
    gameCurrentWordsQueue.sort(() => Math.random() - 0.5); 
    gameRemainingTime = difficulty === 'normal' ? 180 : difficulty === 'hard' ? 420 : 900;
    document.getElementById('game-start-screen').style.display = 'none'; document.getElementById('game-play-screen').style.display = 'block';
    document.getElementById('gameNextBtn').style.display = 'none'; document.getElementById('feedbackContent').style.display = "none"; document.getElementById('giantJudgmentOverlay').classList.remove('show');
    if (activeCharacter === 'tangon') { document.getElementById('gameActiveCharacterContainer').style.display = 'flex'; document.getElementById('gameActiveCharacterImg').src = 'tangon.png'; } else { document.getElementById('gameActiveCharacterContainer').style.display = 'none'; }
    clearInterval(gameTimerInterval);
    if (difficulty !== 'endless') { gameTimerInterval = setInterval(() => { if (isGameTimerPaused) return; gameRemainingTime--; document.getElementById('gameTimerNum').innerText = gameRemainingTime; if (gameRemainingTime <= 0) window.endGameSession(); }, 1000); }
    window.showNextGameWord();
};

window.showNextGameWord = function() {
    if (gameCurrentIndex >= gameCurrentWordsQueue.length) { gameCurrentWordsQueue.sort(() => Math.random() - 0.5); gameCurrentIndex = 0; }
    const q = gameCurrentWordsQueue[gameCurrentIndex]; currentQuestionType = q.type; const wordEl = document.getElementById('gameWordTarget');
    if (q.type === 'en2ja') { wordEl.innerText = q.word; document.getElementById('gameAnswerInput').placeholder = "和訳を入力..."; }
    else { wordEl.innerText = q.display; document.getElementById('gameAnswerInput').placeholder = "英単語を入力..."; }
    if (wordEl.innerText.length > 30) wordEl.style.fontSize = '11px'; else if (wordEl.innerText.length > 15) wordEl.style.fontSize = '15px'; else wordEl.style.fontSize = '20px'; 
    document.getElementById('gameAnswerInput').value = ""; document.getElementById('gameAnswerInput').focus(); isGameProcessingAnswer = false;
};

// 🌟 改良：AI判定を組み込み、△(SO)の場合はスコア+50＆コンボ継続＆単語帳に△を記録する処理を追加
window.submitGameAnswer = async function() {
    if (isGameProcessingAnswer) return; if (document.getElementById('gameNextBtn').style.display === 'flex') return window.goToNextGameWord();
    const userInput = document.getElementById('gameAnswerInput').value.trim(); if (!userInput) return;
    isGameProcessingAnswer = true; isGameTimerPaused = true;
    document.getElementById('gameAnswerInput').blur(); document.getElementById('gameSubmitBtn').style.display = 'none'; document.getElementById('gameJudgingIndicator').style.display = 'flex';
    const q = gameCurrentWordsQueue[gameCurrentIndex]; let isCorrect = false, isSo = false, alternatives = "";
    
    if (q.type === 'en2ja') {
        isCorrect = q.correctAnswers.some(ans => userInput.includes(ans) || ans.includes(userInput) || userInput === ans);
        if(!isCorrect && geminiApiKey) { 
            const res = await window.callGeminiGameJudge(q.word, q.correctAnswers.join(' / '), userInput, 'en2ja'); 
            if(res.status === "OK") isCorrect = true;
            else if(res.status === "SO") isSo = true;
            alternatives = res.alternatives; 
        }
    } else {
        isCorrect = (userInput.toLowerCase() === q.word.toLowerCase());
        if(!isCorrect && geminiApiKey) { 
            const res = await window.callGeminiGameJudge(q.display, q.word, userInput, 'ja2en'); 
            if(res.status === "OK") isCorrect = true;
            else if(res.status === "SO") isSo = true;
            alternatives = res.alternatives; 
        }
    }
    
    document.getElementById('gameJudgingIndicator').style.display = 'none'; document.getElementById('gameNextBtn').style.display = 'flex';
    const overlay = document.getElementById('giantJudgmentOverlay'), popupEl = document.getElementById('giantScorePopup'), comboContainer = document.getElementById('persistentComboContainer');
    window.resetScorePopup(popupEl); let updatedStatus = "bad";
    
    // 🌟 表示リセット（前回のSOのオレンジ色などをクリアしておく）
    document.getElementById('giantJudgmentMark').style.color = "";
    document.getElementById('giantJudgmentMark').style.textShadow = "";
    document.getElementById('giantJudgmentText').style.color = "";

    if (isCorrect) {
        let earned = 100 + (gameComboCount * 5); gameScoreCount += earned; gameComboCount++; gameComboTotalScore += earned;
        overlay.className = "giant-judgment-overlay show correct"; document.getElementById('giantJudgmentMark').innerText = "◎"; document.getElementById('giantJudgmentText').innerText = "正解";
        popupEl.innerText = "+" + gameComboTotalScore; popupEl.className = "giant-score-popup score-anim-plus";
        if(gameComboCount > 1) { document.getElementById('persistentComboText').innerText = `${gameComboCount} COMBO!`; document.getElementById('persistentComboScore').innerText = `+${gameComboTotalScore}`; comboContainer.style.display = "flex"; comboContainer.classList.add('combo-blink'); }
        updatedStatus = "ok";
    } else if (isSo) {
        let earned = 50; gameScoreCount += earned; // コンボは増やさずリセットもせず維持
        overlay.className = "giant-judgment-overlay show"; 
        document.getElementById('giantJudgmentMark').innerText = "△"; 
        document.getElementById('giantJudgmentText').innerText = "おしい";
        // △専用のオレンジ色を指定
        document.getElementById('giantJudgmentMark').style.color = "#F59E0B"; 
        document.getElementById('giantJudgmentMark').style.textShadow = "0 0 20px rgba(245, 158, 11, 0.8), 2px 2px 4px #000000";
        document.getElementById('giantJudgmentText').style.color = "#F59E0B";
        
        popupEl.innerText = "+" + earned; popupEl.className = "giant-score-popup score-anim-plus";
        // コンボが2以上続いていれば表示は維持
        if(gameComboCount > 1) { document.getElementById('persistentComboText').innerText = `${gameComboCount} COMBO!`; document.getElementById('persistentComboScore').innerText = `+${gameComboTotalScore}`; comboContainer.style.display = "flex"; comboContainer.classList.add('combo-blink'); } else { comboContainer.style.display = "none"; }
        updatedStatus = "so";
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
        targetVocab.status = updatedStatus; if(!targetVocab.history) targetVocab.history = []; targetVocab.history.push(updatedStatus); window.saveVocabToStorage();
    }
    gameHistoryLog.push({ word: q.type === 'en2ja' ? q.word : q.display, user: userInput, correct: q.type === 'en2ja' ? q.correctAnswers.join(', ') : q.word, isCorrect: isCorrect || isSo });
    document.getElementById('feedbackContent').style.display = "block"; document.getElementById('feedbackUserAns').innerText = userInput; document.getElementById('feedbackCorrectAns').innerText = q.type === 'en2ja' ? q.correctAnswers.join(', ') : q.word;
    if (alternatives && alternatives !== "特になし") { document.getElementById('feedbackOtherAns').innerText = alternatives; document.getElementById('feedbackDiffAnswersRow').style.display = "block"; } else { document.getElementById('feedbackDiffAnswersRow').style.display = "none"; }
    window.scrollTo(0, 0);
};

// 🌟 改良：次の問題へ行く際に、△用に書き換えたインラインスタイルをリセット
window.goToNextGameWord = function() {
    if (currentGameDifficulty === 'endless' && gameMistakeCount >= 5) return window.endGameSession();
    document.getElementById('gameNextBtn').style.display = 'none'; document.getElementById('gameSubmitBtn').style.display = 'flex'; document.getElementById('feedbackContent').style.display = "none"; 
    document.getElementById('giantJudgmentOverlay').classList.remove('show'); document.getElementById('persistentComboContainer').style.display = "none"; document.getElementById('persistentComboContainer').classList.remove('combo-blink');
    
    document.getElementById('giantJudgmentMark').style.color = "";
    document.getElementById('giantJudgmentMark').style.textShadow = "";
    document.getElementById('giantJudgmentText').style.color = "";
    
    isGameTimerPaused = false; gameCurrentIndex++; window.showNextGameWord();
};

window.endGameSession = function() {
    document.body.classList.remove('in-game-active'); clearInterval(gameTimerInterval); document.getElementById('game-play-screen').style.display = 'none'; document.getElementById('game-result-screen').style.display = 'block';
    
    gameBestScore = 0;
    if (gameScoreCount > 0 && currentGameDifficulty === 'endless') {
        let history = JSON.parse(localStorage.getItem(`cosmic_score_${selectedQuestionMode}_endless`) || "[]");
        history.push({ score: gameScoreCount, date: new Date().toLocaleDateString() }); history.sort((a, b) => b.score - a.score); history = history.slice(0, 5); localStorage.setItem(`cosmic_score_${selectedQuestionMode}_endless`, JSON.stringify(history));
        gameBestScore = parseInt(localStorage.getItem(`cosmic_best_${selectedQuestionMode}_endless`) || "0"); if (gameScoreCount > gameBestScore) { localStorage.setItem(`cosmic_best_${selectedQuestionMode}_endless`, gameScoreCount); gameBestScore = gameScoreCount; }
    }
    
    const accuracy = gameHistoryLog.length > 0 ? Math.round((gameHistoryLog.filter(h => h.isCorrect).length / gameHistoryLog.length) * 100) : 0;
    document.getElementById('resScore').innerText = gameScoreCount; document.getElementById('resAccuracy').innerText = `${accuracy}%`; document.getElementById('resBestScore').innerText = gameBestScore; document.getElementById('resCommBest').innerText = Math.max(gameBestScore, 2800);
    const listContainer = document.getElementById('gameHistoryListContainer'); listContainer.innerHTML = "";
    if (gameHistoryLog.length === 0) listContainer.innerHTML = `<div style="text-align:center; color:var(--text-sub); padding:12px; font-size:12px;">ログがありません</div>`;
    else gameHistoryLog.forEach(item => { listContainer.innerHTML += `<div class="cosmic-history-item"><span class="cosmic-res-mark ${item.isCorrect ? 'ok' : 'bad'}">${item.isCorrect ? '◎' : '✕'}</span><div style="flex:1;"><div style="font-weight:800; color:white; font-size:13px;">${item.word.replace(/\n/g, ' ')}</div><div style="color:var(--text-sub); margin-top:2px;">あなたの回答: <span style="color:white;">${item.user || '(空欄)'}</span></div><div style="color:var(--word-ok); font-size:11px; margin-top:1px;">正答: ${item.correct}</div></div></div>`; });
    window.renderVocabList(); window.initLucide();
};

window.backToGameMenu = function() { 
    document.body.classList.remove('in-game-active'); document.getElementById('game-mode-select-screen').style.display = 'none'; document.getElementById('game-difficulty-select-screen').style.display = 'none'; document.getElementById('game-result-screen').style.display = 'none'; 
    const startScreen = document.getElementById('game-start-screen'); if (startScreen) startScreen.style.display = 'flex'; 
    const lbArea = document.getElementById('gameLeaderboardArea'); if (lbArea) lbArea.style.display = 'flex';
    window.renderGameLeaderboard(); 
};

// ==========================================================================
// ⚔️ パーティ・装備編成と新マルチプレイバトル 拡張制御ロジック
// ==========================================================================

window.switchPartySubCategory = function(category) {
    document.getElementById('partyTabChar').classList.toggle('active', category === 'character'); document.getElementById('partyTabWeapon').classList.toggle('active', category === 'weapon'); document.getElementById('partyTabArmor').classList.toggle('active', category === 'armor');
    document.getElementById('partyBoxCharacter').style.display = category === 'character' ? 'grid' : 'none'; document.getElementById('partyBoxWeapon').style.display = category === 'weapon' ? 'grid' : 'none'; document.getElementById('partyBoxArmor').style.display = category === 'armor' ? 'grid' : 'none';
};

window.selectCharacter = function(charId) { activeCharacter = charId; localStorage.setItem('core_v4_active_char', charId); window.updatePartySlotsUi(); alert(charId ? 'キャラクターをセットしたよ！' : 'キャラクターの編成を外したよ。'); };
window.selectWeapon = function(weaponId) { activeWeapon = weaponId; localStorage.setItem('core_v4_active_weapon', weaponId); window.updatePartySlotsUi(); alert(weaponId ? '武器を装備したよ！' : '武器を外したよ。'); };
window.selectArmor = function(armorId) { activeArmor = armorId; localStorage.setItem('core_v4_active_armor', armorId); window.updatePartySlotsUi(); alert(armorId ? '防具を装備したよ！' : '防具を外したよ。'); };

window.updatePartySlotsUi = function() {
    const charImgFrame = document.getElementById('slotCharImgContainer'), charNameLbl = document.getElementById('slotCharName');
    if (activeCharacter === 'tangon') { charImgFrame.innerHTML = `<img src="tangon.png" alt="tangon" style="width:100%;height:100%;object-fit:cover;">`; charNameLbl.innerText = "タンゴン"; } else { charImgFrame.innerHTML = "🫙"; charNameLbl.innerText = "未編成"; }
    const weaponImgFrame = document.getElementById('slotWeaponImgContainer'), weaponNameLbl = document.getElementById('slotWeaponName');
    if (activeWeapon === 'fire_sword') { weaponImgFrame.innerHTML = "🔥🗡️"; weaponNameLbl.innerText = "業火の大剣"; } else { weaponImgFrame.innerHTML = "🗡️"; weaponNameLbl.innerText = "素手"; }
    const armorImgFrame = document.getElementById('slotArmorImgContainer'), armorNameLbl = document.getElementById('slotArmorName');
    if (activeArmor === 'cosmic_shield') { armorImgFrame.innerHTML = "🔮🛡️"; armorNameLbl.innerText = "星屑の盾"; } else { armorImgFrame.innerHTML = "🛡️"; armorNameLbl.innerText = "布の服"; }
    
    // 🌟 自分の装備・キャラアイコン枠エリアを非表示化
    const bChar = document.getElementById('multiEquipCharIcon'); if(bChar) bChar.style.display = 'none';
    const bWep = document.getElementById('multiEquipWeaponIcon'); if(bWep) bWep.style.display = 'none';
    const bArm = document.getElementById('multiEquipArmorIcon'); if(bArm) bArm.style.display = 'none';
};

window.initMultiParty = function(playerCount) {
    multiPartyMembers = [];
    const borderColors = ['var(--cosmic-purple-light)', 'var(--cosmic-cyan)', 'var(--cosmic-cyan)', 'var(--cosmic-cyan)'];
    const shadows = ['rgba(192, 132, 252, 0.5)', 'rgba(0, 240, 255, 0.5)', 'rgba(0, 240, 255, 0.5)', 'rgba(0, 240, 255, 0.5)'];
    for(let i = 0; i < playerCount; i++) {
        let isMe = (i === 0);
        multiPartyMembers.push({ id: i, name: isMe ? myName : `ALLY ${i}`, char: isMe ? activeCharacter : '', maxHp: 3500, hp: 3500, isMe: isMe, borderColor: borderColors[i], shadowColor: shadows[i] });
    }
    window.openMultiParty();
};

window.renderMultiParty = function() {
    const container = document.getElementById('multiPartyContainer'); if(!container) return; container.innerHTML = "";
    multiPartyMembers.forEach(m => {
        let charImg = m.char === 'tangon' ? `<img src="tangon.png" alt="tangon" style="width:100%;height:100%;object-fit:cover;">` : `👤`;
        let hpPercent = Math.max(0, (m.hp / m.maxHp) * 100);
        let color = m.isMe ? "var(--cosmic-purple-light)" : "var(--cosmic-cyan)";
        
        // 🌟 combo欄の表示判定：自分がかつ2コンボ以上続いている時のみテキストをセット
        let comboText = "";
        if (m.isMe && gameComboCount >= 2) {
            comboText = `${gameComboCount} COMBO!`;
        }

        // 🌟 flex-direction: column に修正し、上からコンボ・キャラ・装備・名前・HPの順に配置
        let html = `
            <div class="multi-party-member" id="partyMember-${m.id}" style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                <!-- 1. combo -->
                <div class="multi-party-combo" id="multiPartyCombo-${m.id}" style="font-size: 9px; font-weight: 900; color: #FBBF24; text-shadow: 0 0 4px #F59E0B; min-height: 12px; text-align: center;">
                    ${comboText}
                </div>
                <!-- 2. キャラ -->
                <div class="multi-party-icon" style="width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: none !important; border: none !important; box-shadow: none !important;">${charImg}</div>
                <!-- 3. 装備 -->
                <div class="multi-party-equip-display" style="display: flex; gap: 2px; font-size: 10px; background: rgba(0,0,0,0.4); padding: 1px 4px; border-radius: 4px;">
                    <span title="Weapon">${m.isMe && activeWeapon === 'fire_sword' ? '🔥' : '🗡️'}</span>
                    <span title="Armor">${m.isMe && activeArmor === 'cosmic_shield' ? '🔮' : '🛡️'}</span>
                </div>
                <!-- 4. 名前 -->
                <div style="font-size:8px; color:${color}; font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:64px; text-align:center;">${m.name}</div>
                <!-- 5. HP -->
                <div class="multi-party-hp-bar" style="width: 100%; height: 5px; background: rgba(0,0,0,0.8); border: 1px solid ${m.borderColor}; box-shadow: 0 0 5px ${m.shadowColor}; border-radius: 4px; overflow: hidden; display: flex; justify-content: flex-start;">
                    <div class="multi-party-hp-fill" id="partyMemberHpFill-${m.id}" style="width:${hpPercent}%; height: 100%; background: linear-gradient(90deg, #10B981, #34D399); transform-origin:left !important;"></div>
                </div>
            </div>`;
        container.innerHTML += html;
    });
};

// 🌟 キャラ固有カラーネオンと完全同期して飛んでいく吹き出し＆ボス位置大爆発エフェクト
window.showCharacterPopup = function(memberId, amount, type) {
    const memberEl = document.getElementById('partyMember-' + memberId); if(!memberEl) return;
    if(type === 'attack') {
        const flyingBubble = document.createElement('div'); flyingBubble.className = 'popup-bubble-flying-atk'; flyingBubble.innerText = amount;
        const charRect = memberEl.getBoundingClientRect(), bossEl = document.getElementById('multiBossImage');
        const bossRect = bossEl ? bossEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 3, width: 0, height: 0 };
        const startX = charRect.left + charRect.width / 2, startY = charRect.top;
        const targetX = bossRect.left + bossRect.width / 2, targetY = bossRect.top + bossRect.height / 2;
        const matchMember = multiPartyMembers.find(m => m.id === memberId);
        if(matchMember) { flyingBubble.style.borderColor = matchMember.borderColor; flyingBubble.style.boxShadow = `0 4px 12px ${matchMember.shadowColor}`; }
        flyingBubble.style.setProperty('--start-x', `${startX}px`); flyingBubble.style.setProperty('--start-y', `${startY}px`);
        flyingBubble.style.setProperty('--target-x', `${targetX}px`); flyingBubble.style.setProperty('--target-y', `${targetY}px`);
        document.body.appendChild(flyingBubble);
        setTimeout(() => {
            if(flyingBubble.parentNode) flyingBubble.remove();
            const explosion = document.createElement('div'); explosion.className = 'popup-hit-explosion'; explosion.style.left = `${targetX}px`; explosion.style.top = `${targetY}px`; document.body.appendChild(explosion);
            setTimeout(() => { if(explosion.parentNode) explosion.remove(); }, 400);
        }, 600);
    } else if(type === 'damage') {
        const popup = document.createElement('div'); popup.className = 'popup-v-dmg'; popup.innerHTML = `<div class="v-mark"></div><div class="v-dmg-text">${amount}</div>`; memberEl.appendChild(popup);
        setTimeout(() => { if(popup.parentNode) popup.remove(); }, 1500);
    }
};

window.showMultiBattleChoice = function() { 
    if (vocabList.length === 0) {
        alert("⚠️ 単語帳が空のため、お試し用の単語を自動追加してバトル画面を開きます！");
        vocabList.push({num: "1", word: "apple", meanings: [{id: "1-0", text: "りんご", status: "none", history: []}], sub: "", status: "none", history: []});
        window.saveVocabToStorage(); window.renderVocabList();
    }
    const lbArea = document.getElementById('gameLeaderboardArea'); if (lbArea) lbArea.style.display = 'none';
    const startScreen = document.getElementById('game-start-screen'); if (startScreen) startScreen.style.display = 'none';
    
    document.getElementById('multi-battle-choice-screen').style.display = 'block';
    document.getElementById('multi-battle-team-list-screen').style.display = 'none';
    document.getElementById('multi-battle-setup-screen').style.display = 'none';
    document.getElementById('multi-battle-matching-screen').style.display = 'none';
    document.getElementById('multi-battle-play-screen').style.display = 'none';

    window.initMultiModeSwipe(); // 🌟 モード切り替え選択画面が開いた瞬間にスワイプイベントを初期化・紐付け！
};

window.cancelMultiBattleChoice = function() {
    document.getElementById('multi-battle-choice-screen').style.display = 'none';
    const startScreen = document.getElementById('game-start-screen'); if (startScreen) startScreen.style.display = 'flex'; 
    const lbArea = document.getElementById('gameLeaderboardArea'); if (lbArea) lbArea.style.display = 'flex';
};

window.showMultiTeamList = function() {
    document.getElementById('multi-battle-choice-screen').style.display = 'none';
    document.getElementById('multi-battle-team-list-screen').style.display = 'block';
};

window.backToMultiChoiceFromList = function() {
    document.getElementById('multi-battle-team-list-screen').style.display = 'none';
    document.getElementById('multi-battle-choice-screen').style.display = 'block';
};

window.showMultiSetup = function() {
    document.getElementById('multi-battle-choice-screen').style.display = 'none';
    document.getElementById('multi-battle-setup-screen').style.display = 'block';
    window.selectMultiMode('coop');
};

window.backToMultiChoiceFromSetup = function() {
    document.getElementById('multi-battle-setup-screen').style.display = 'none';
    document.getElementById('multi-battle-choice-screen').style.display = 'block';
};

window.joinMultiTeam = function(teamName) {
    document.getElementById('multi-battle-team-list-screen').style.display = 'none';
    document.getElementById('multi-battle-matching-screen').style.display = 'flex';
    document.getElementById('waitingRoomText').innerText = `${teamName} に参加中...`;
    setTimeout(() => { if (document.getElementById('multi-battle-matching-screen').style.display === 'flex') { window.playIntroVideoBeforeBattle(); } }, 2000); 
};

window.startMultiBattleMatching = function() { 
    document.getElementById('multi-battle-setup-screen').style.display = 'none'; 
    document.getElementById('multi-battle-matching-screen').style.display = 'flex'; 
    document.getElementById('waitingRoomText').innerText = `他のプレイヤーの参加を待っています`;
    setTimeout(() => { if (document.getElementById('multi-battle-matching-screen').style.display === 'flex') { window.playIntroVideoBeforeBattle(); } }, 2000); 
};

window.cancelMultiBattleMatching = function() { 
    document.getElementById('multi-battle-matching-screen').style.display = 'none'; 
    document.getElementById('multi-battle-choice-screen').style.display = 'block'; 
};

window.initMultiModeSwipe = function() {
    const area = document.getElementById('multiModeSwipeArea');
    if(!area || area.dataset.eventsBound) return;
    area.dataset.eventsBound = "true";
    
    // 🌟 画像やテキストエリアどこを触っても確実に指の動きを検出する処理
    area.addEventListener('touchstart', function(e) {
        modeSwipeStartX = e.touches[0].clientX;
    }, {passive: true});
    
    area.addEventListener('touchend', function(e) {
        let endX = e.changedTouches[0].clientX;
        let diff = modeSwipeStartX - endX;
        
        if (diff > 30) {
            // 左に引っ張る -> 次のモード（対人戦）
            window.selectMultiMode('pvp');
        } else if (diff < -30) {
            // 右に引っ張る -> 前のモード（協力戦）
            window.selectMultiMode('coop');
        }
    });
};

window.selectMultiMode = function(mode) { 
    currentMultiMode = mode; 
    const imgEl = document.getElementById('multiModeDisplayImage');
    const swipeArea = document.getElementById('multiModeSwipeArea');
    if(!imgEl || !swipeArea) return;
    
    if (mode === 'coop') { 
        imgEl.src = 'kyouryoku.png';
        imgEl.alt = '協力戦';
        swipeArea.style.borderColor = 'var(--cosmic-cyan)'; 
        swipeArea.style.boxShadow = '0 0 15px rgba(0, 240, 255, 0.5)'; 
    } else { 
        imgEl.src = 'taizin.png';
        imgEl.alt = '対人戦';
        swipeArea.style.borderColor = 'var(--admin-accent)'; 
        swipeArea.style.boxShadow = '0 0 15px rgba(236, 72, 153, 0.5)'; 
    }
};

window.playIntroVideoBeforeBattle = function() {
    document.getElementById('multi-battle-matching-screen').style.display = 'none'; const overlay = document.getElementById('video-overlay'), video = document.getElementById('introVideo');
    if (overlay && video) { overlay.style.display = 'flex'; video.currentTime = 0; video.play().catch(e => { window.skipIntroVideo(); }); video.onended = window.skipIntroVideo; } 
    else { window.startMultiBattlePlay(); }
};

window.skipIntroVideo = function() {
    const overlay = document.getElementById('video-overlay'), video = document.getElementById('introVideo');
    if(video) video.pause(); if(overlay) overlay.style.display = 'none'; window.startMultiBattlePlay();
};

window.startMultiBattlePlay = function() {
    document.body.classList.add('in-game-active'); document.getElementById('multi-battle-play-screen').style.display = 'flex'; gameComboCount = 0; multiLimitAmount = 0; 
    document.getElementById('multiComboCountText').innerText = "0"; document.getElementById('multiDamagePopupText').innerText = "";
    
    // 自画面ステータスコンポーネント消去用
    const multiComboParent = document.getElementById('multiComboCountText') ? document.getElementById('multiComboCountText').parentElement : null;
    if(multiComboParent) multiComboParent.style.display = 'none';
    
    const sparkleBorder = document.getElementById('combo-sparkle-border'); if(sparkleBorder) sparkleBorder.classList.remove('active');
    const ownHpFrame = document.getElementById('multiPlayerOwnHpFrame'); if(ownHpFrame) ownHpFrame.style.display = 'block';
    const logContainer = document.getElementById('multiBattleLog'); if(logContainer) logContainer.innerHTML = "";
    window.updatePartySlotsUi(); const playerCount = parseInt(document.getElementById('multiPlayerCount').value) || 2; window.initMultiParty(playerCount);
    multiBossMaxHp = 100000 * playerCount; multiBossHp = multiBossMaxHp; multiEnemyTimeLeft = 10; window.updateMultiHpBars();
    gameCurrentWordsQueue = []; vocabList.forEach(w => { if(w.meanings && w.meanings.length > 0) gameCurrentWordsQueue.push({ wordNum: w.num, word: w.word, meaning: window.formatWordForDisplay(w.meanings[0].text) }); });
    gameCurrentWordsQueue.sort(() => Math.random() - 0.5); gameCurrentIndex = 0;
    clearInterval(gameTimerInterval); gameTimerInterval = setInterval(window.handleMultiBattleTimer, 100); window.showNextMultiWord(); window.initMultiPartyEvents();
};

// 🌟 操作者の自操作HPとLIMITゲージを強固に「左詰め起算」同期、2コンボ以上連動の全画面金色ネオン外枠駆動
window.updateMultiHpBars = function() {
    const boss = document.getElementById('multiBossHpFill'); if(boss) boss.style.width = Math.max(0, (multiBossHp / multiBossMaxHp) * 100) + "%";
    const bossTxt = document.getElementById('multiEnemyHpText'); if(bossTxt) { bossTxt.innerText = `${Math.max(0, Math.floor(multiBossHp))}`; }
    
    multiPartyMembers.forEach(m => {
        let fill = document.getElementById(`partyMemberHpFill-${m.id}`); 
        if (fill) {
            fill.style.width = Math.max(0, (m.hp / m.maxHp) * 100) + "%";
        }
        
        // 各メンバーのコンボ表示枠を更新（自分がかつ2コンボ以上のときのみテキストを表示、それ以外は空に）
        let comboEl = document.getElementById(`multiPartyCombo-${m.id}`);
        if (comboEl) {
            comboEl.innerText = (m.isMe && gameComboCount >= 2) ? `${gameComboCount} COMBO!` : "";
        }
    });
    
    let me = multiPartyMembers.find(m => m.isMe);
    if (me) {
        const ownHpFill = document.getElementById('multiPlayerOwnHpFill'), ownHpText = document.getElementById('multiPlayerOwnHpText');
        if (ownHpFill) {
            ownHpFill.style.width = Math.max(0, (me.hp / me.maxHp) * 100) + "%"; /* 左端起算の減少同期 */
            ownHpFill.parentElement.style.justifyContent = 'flex-start'; /* 🌟 強制左詰めアンカー */
        }
        if (ownHpText) ownHpText.innerText = `${Math.max(0, Math.floor(me.hp))} / ${me.maxHp}`;
    }
    
    const limitFill = document.getElementById('multiLimitGaugeFill'), limitText = document.getElementById('multiLimitGaugeText'), limitPercentNum = Math.floor(Math.max(0, (multiLimitAmount / multiLimitMax) * 100));
    if (limitFill) { 
        limitFill.style.width = limitPercentNum + "%"; 
        if (multiLimitAmount >= multiLimitMax) limitFill.classList.add('max'); else limitFill.classList.remove('max'); 
        limitFill.parentElement.style.justifyContent = 'flex-start'; /* 🌟 強制左詰めアンカー */
    }
    
    // 🌟 パーメント表示を消去
    if (limitText) { limitText.innerText = ""; }
    
    // 🌟 COMBOコンポーネントエリア消去
    const multiComboParent = document.getElementById('multiComboCountText') ? document.getElementById('multiComboCountText').parentElement : null;
    if(multiComboParent) multiComboParent.style.display = 'none';

    const sparkleBorder = document.getElementById('combo-sparkle-border');
    if(sparkleBorder) { if(gameComboCount >= 2) sparkleBorder.classList.add('active'); else sparkleBorder.classList.remove('active'); } /* 金色ネオン外枠連動 */
};
window.handleMultiBattleTimer = function() {
    multiEnemyTimeLeft -= 0.1;
    if(multiEnemyTimeLeft <= 0) {
        multiEnemyTimeLeft = 10; let baseDamage = 400; 
        multiPartyMembers.forEach(m => { if (m.hp > 0) { m.hp -= baseDamage; if (m.hp < 0) m.hp = 0; window.showCharacterPopup(m.id, baseDamage, 'damage'); } });
        document.body.classList.add('boss-damage-shake'); setTimeout(() => document.body.classList.remove('boss-damage-shake'), 300);
        if(multiPartyMembers.every(m => m.hp <= 0)) { clearInterval(gameTimerInterval); setTimeout(() => { alert("全滅しました..."); window.cancelMultiBattlePlay(true); }, 500); return; }
    }
    const timerDisplay = document.getElementById('multiEnemyTimerDisplay'); if(timerDisplay) timerDisplay.innerText = `行動: ${Math.max(0, multiEnemyTimeLeft).toFixed(1)}秒`;
    window.updateMultiHpBars();
};

window.showNextMultiWord = function() {
    if(gameCurrentIndex >= gameCurrentWordsQueue.length) { gameCurrentWordsQueue.sort(() => Math.random() - 0.5); gameCurrentIndex = 0; }
    const target = gameCurrentWordsQueue[gameCurrentIndex]; document.getElementById('flickTargetWord').innerText = target.word;
    let choices = [target.meaning]; let dummies = [...gameCurrentWordsQueue].filter(w => w.word !== target.word).map(w => w.meaning);
    dummies.sort(() => Math.random() - 0.5); choices = choices.concat(dummies.slice(0, 7)).sort(() => Math.random() - 0.5);
    currentMultiCorrectIndex = choices.indexOf(target.meaning);
    for(let i=0; i<8; i++) { let el = document.getElementById('multiChoice-' + i); if(el) { el.innerText = choices[i]; el.classList.remove('highlight'); } }
    // 🌟 フリックアタック終了ごとにフリックマークを中央（50%, 50%）に強制即時リセット連動
    const icon = document.getElementById('flickWeaponIcon'); if(icon) { icon.style.left = '50%'; icon.style.top = '50%'; }
};

window.cancelMultiBattlePlay = function(force = false) { 
    if(force || confirm("バトルから逃走しますか？")) { 
        document.body.classList.remove('in-game-active'); const sparkleBorder = document.getElementById('combo-sparkle-border'); if(sparkleBorder) sparkleBorder.classList.remove('active');
        clearInterval(gameTimerInterval); document.getElementById('multi-battle-play-screen').style.display = 'none';
        const startScreen = document.getElementById('game-start-screen'); if (startScreen) startScreen.style.display = 'flex'; 
        const lbArea = document.getElementById('gameLeaderboardArea'); if (lbArea) lbArea.style.display = 'flex';
    } 
};

window.initMultiPartyEvents = function() {
    const pad = document.getElementById('flickPadArea');
    if(pad && !pad.dataset.eventsBound) {
        pad.dataset.eventsBound = "true"; pad.addEventListener('touchstart', window.handleFlickStart, {passive: false});
        pad.addEventListener('touchmove', window.handleFlickMove, {passive: false}); pad.addEventListener('touchend', window.handleFlickEnd);
    }
};

window.handleFlickStart = function(e) { e.preventDefault(); const touch = e.touches[0]; const rect = document.getElementById('flickPadArea').getBoundingClientRect(); flickStartX = touch.clientX - rect.left; flickStartY = touch.clientY - rect.top; isFlicking = true; currentFlickChoice = -1; };

// 🌟 改良要件：上下左右・斜め45度の完全な8方向の直線上のみしかフリックマーク（アイコン）が物理的に移動しないよう厳格ロック
window.handleFlickMove = function(e) {
    if(!isFlicking) return; e.preventDefault(); const touch = e.touches[0]; const rect = document.getElementById('flickPadArea').getBoundingClientRect();
    let dx = (touch.clientX - rect.left) - flickStartX, dy = (touch.clientY - rect.top) - flickStartY, distance = Math.sqrt(dx*dx + dy*dy);
    
    const icon = document.getElementById('flickWeaponIcon'); 
    if(icon) { 
        if (distance > 5) {
            // 角度(0-360)を算出して正確な45度区切りのスナップ角を算出
            let angle = Math.atan2(dy, dx);
            let degree = angle * 180 / Math.PI; if(degree < 0) degree += 360;
            let sector = Math.round(degree / 45) % 8;
            let snapAngle = (sector * 45) * Math.PI / 180;
            
            // 算出した直線ベクトル方向にのみ、実際の指の移動距離をスライド投影固定
            let constrainedDx = distance * Math.cos(snapAngle);
            let constrainedDy = distance * Math.sin(snapAngle);
            icon.style.left = `calc(50% + ${constrainedDx}px)`; 
            icon.style.top = `calc(50% + ${constrainedDy}px)`; 
        } else {
            icon.style.left = '50%'; icon.style.top = '50%';
        }
    }
    
    for(let i=0; i<8; i++) { let el = document.getElementById('multiChoice-' + i); if(el) el.classList.remove('highlight'); }
    if(distance > 24) {
        let angle = Math.atan2(dy, dx) * 180 / Math.PI; if(angle < 0) angle += 360;
        let sector = Math.round(angle / 45) % 8; let choiceMap = { 0: 4, 1: 7, 2: 6, 3: 5, 4: 3, 5: 0, 6: 1, 7: 2 };
        currentFlickChoice = choiceMap[sector]; let el = document.getElementById('multiChoice-' + currentFlickChoice); if(el) el.classList.add('highlight');
    } else { currentFlickChoice = -1; }
};

window.handleFlickEnd = function(e) {
    if(!isFlicking) return; isFlicking = false;
    for(let i=0; i<8; i++) { let el = document.getElementById('multiChoice-' + i); if(el) el.classList.remove('highlight'); }
    if(currentFlickChoice !== -1) { window.processMultiFlickAnswer(currentFlickChoice); } 
    else { const icon = document.getElementById('flickWeaponIcon'); if(icon) { icon.style.left = '50%'; icon.style.top = '50%'; } }
};

window.processMultiFlickAnswer = function(choiceIndex) {
    let me = multiPartyMembers.find(m => m.isMe);
    let q = gameCurrentWordsQueue[gameCurrentIndex];
    let updatedStatus = "bad";

    if(choiceIndex === currentMultiCorrectIndex) {
        updatedStatus = "ok";
        gameComboCount++; window.createFireballEffect();
        const myThumb = document.querySelector('.multi-party-member:first-child .multi-party-icon');
        if(myThumb) { myThumb.classList.remove('companion-attack-active'); void myThumb.offsetWidth; myThumb.classList.add('companion-attack-active'); setTimeout(() => myThumb.classList.remove('companion-attack-active'), 500); }
        let comboMulti = 1 + Math.floor(gameComboCount / 5) * 0.5; let damage = 400 * comboMulti;
        document.getElementById('multiComboCountText').innerText = gameComboCount; multiBossHp -= damage; 
        if(me) window.showCharacterPopup(me.id, `💥 ${damage}`, 'attack');
        multiLimitAmount = Math.min(multiLimitMax, multiLimitAmount + 15); window.updateMultiHpBars();
        
        if(multiLimitAmount >= multiLimitMax) {
            setTimeout(() => {
                multiBossHp -= 5000; multiLimitAmount = 0; window.updateMultiHpBars();
                if (multiBossHp <= 0) { clearInterval(gameTimerInterval); setTimeout(() => { alert("🎉 BOSS討伐完了！クエストクリア！"); window.cancelMultiBattlePlay(true); }, 500); }
            }, 500);
        }
    } else { 
        gameComboCount = 0; document.getElementById('multiComboCountText').innerText = gameComboCount;
        if (me && me.hp > 0) {
            me.hp -= 300; if (me.hp < 0) me.hp = 0;
            let myEl = document.getElementById('partyMember-' + me.id);
            if(myEl) { let iconEl = myEl.querySelector('.multi-party-icon'); if(iconEl) { iconEl.classList.remove('player-damage-flash'); void iconEl.offsetWidth; iconEl.classList.add('player-damage-flash'); } }
            window.showCharacterPopup(me.id, 300, 'damage');
        }
    }

    // 🌟 単語帳の理解度ステータスを更新・保存
    const targetVocab = vocabList.find(w => w.num === q.wordNum);
    if(targetVocab) {
        if(targetVocab.meanings.length > 0) {
            targetVocab.meanings[0].status = updatedStatus;
            if(!targetVocab.meanings[0].history) targetVocab.meanings[0].history = [];
            targetVocab.meanings[0].history.push(updatedStatus);
        }
        targetVocab.status = updatedStatus;
        if(!targetVocab.history) targetVocab.history = [];
        targetVocab.history.push(updatedStatus);
        window.saveVocabToStorage();
    }

    if (multiBossHp <= 0) { clearInterval(gameTimerInterval); setTimeout(() => { alert("🎉 BOSS討伐完了！クエストクリア！"); window.cancelMultiBattlePlay(true); }, 500); return; }
    if(multiPartyMembers.every(m => m.hp <= 0)) { clearInterval(gameTimerInterval); setTimeout(() => { alert("全滅しました..."); window.cancelMultiBattlePlay(true); }, 500); return; }

    window.updateMultiHpBars(); gameCurrentIndex++; window.showNextMultiWord();
};

window.createFireballEffect = function() {
    const layer = document.getElementById('battle-effects-layer'); if(!layer) return; const p = document.createElement('div'); p.className = 'fireball-particle';
    const pad = document.getElementById('flickPadArea'); const rect = pad.getBoundingClientRect();
    p.style.left = (rect.left + rect.width/2) + 'px'; p.style.top = (rect.top + rect.height/2) + 'px';
    p.style.setProperty('--tx', (Math.random() * 80 - 40) + 'px'); p.style.setProperty('--ty', '-160px'); layer.appendChild(p); setTimeout(() => { p.remove(); }, 400);
};

// ==========================================================================
// 🚀 完全同期ライフサイクルブートストラップ初期化 (フライング実行事故を完全防止)
// ==========================================================================

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        window.loadLocalState(); window.initLucide(); window.initHeroSlider(); window.renderActivityChart();
    });
} else {
    window.loadLocalState(); window.initLucide(); window.initHeroSlider(); window.renderActivityChart();
}

window.addEventListener("scroll", () => {
    const btn = document.getElementById("scrollToTopBtn");
    if(btn) { if(window.scrollY > 300) btn.classList.add("show"); else btn.classList.remove("show"); }
});
