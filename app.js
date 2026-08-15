//==========================================================================
// 🌟 1. 関数のマウント定義・グローバル状態
// ==========================================================================
// 管理者権限フラグ
window.isAdmin = false;
// 🌟 経験値・レベル・ユーザー統計・プロフィールおよびフレンドリストの包括的保存（Firebase即時同期＆ローカル保存）
window.saveUserStats = async function() {
try {
localStorage.setItem('core_v4_user_stats_' + myId, JSON.stringify(userStats));
localStorage.setItem('core_v4_friend_list', JSON.stringify(myFriendList));
localStorage.setItem('core_v4_totalExp', String(totalExp));
localStorage.setItem('core_v4_userName', myName);
localStorage.setItem('core_v4_userTarget', myTarget);
localStorage.setItem('core_v4_userTitle', selectedTitle);
} catch(e) {}
if (window.db && window.fbSetDoc && window.fbDoc && myId && myId !== "GUEST-000") {
     try {
         const userRef = window.fbDoc(window.db, "users", myId);
         const mySavedAvatar = localStorage.getItem('core_v4_user_avatar_' + myId) || "";
         await window.fbSetDoc(userRef, { 
             id: myId,
             userStats: userStats,
             friendList: myFriendList,
             playerName: myName,
             selectedTitle: selectedTitle,
             userTarget: myTarget,
             totalExp: totalExp,
             avatar: mySavedAvatar,
             updatedAt: new Date().toISOString()
         }, { merge: true });
         // 共有ランキングノードへも反映
         const lbRef = window.fbDoc(window.db, "shared_leaderboard", myId);
         let lvlData = window.calculateLevelFromExp(totalExp);
         await window.fbSetDoc(lbRef, {
             id: myId,
             name: myName,
             title: selectedTitle,
             exp: totalExp,
             level: lvlData.level,
             avatar: mySavedAvatar,
             updatedAt: new Date().toISOString()
         }, { merge: true });
     } catch (e) {
         console.error("Firebaseへのユーザーデータ即時保存エラー:", e);
     }
 }
};
window.loadUserStats = async function() {
try {
const storedStats = localStorage.getItem('core_v4_user_stats_' + myId);
if (storedStats) userStats = JSON.parse(storedStats);
    const storedFriends = localStorage.getItem('core_v4_friend_list');
     if (storedFriends) myFriendList = JSON.parse(storedFriends);
     if (window.db && window.fbGetDoc && window.fbDoc && myId && myId !== "GUEST-000") {
         const userRef = window.fbDoc(window.db, "users", myId);
         const snap = await window.fbGetDoc(userRef);
         if (snap.exists()) {
             const data = snap.data();
             if (data.userStats) {
                 userStats = data.userStats;
                 localStorage.setItem('core_v4_user_stats_' + myId, JSON.stringify(userStats));
             }
             if (data.friendList) {
                 myFriendList = data.friendList;
                 localStorage.setItem('core_v4_friend_list', JSON.stringify(myFriendList));
             }
             if (data.totalExp !== undefined && data.totalExp !== null) {
                 totalExp = parseInt(data.totalExp) || totalExp;
                 localStorage.setItem('core_v4_totalExp', String(totalExp));
             }
             if (data.playerName) {
                 myName = data.playerName;
                 localStorage.setItem('core_v4_userName', myName);
             }
             if (data.selectedTitle) {
                 selectedTitle = data.selectedTitle;
                 localStorage.setItem('core_v4_userTitle', selectedTitle);
             }
             if (data.userTarget) {
                 myTarget = data.userTarget;
                 localStorage.setItem('core_v4_userTarget', myTarget);
             }
             if (data.avatar) {
                 localStorage.setItem('core_v4_user_avatar_' + myId, data.avatar);
             }
         }
     }
 } catch (e) {
     console.error("Error loading user stats:", e);
 }
};
// 🌟 累計XPからレベル、次への必要XP、および現在のレベル内進捗%を計算する関数
window.calculateLevelFromExp = function(exp) {
if (exp <= 0) {
return { level: 1, nextLevelRequiredExp: 26, progressPercent: 0 };
}
let a = 6;
 let b = 20;
 let c = -exp;
 let discriminant = (b * b) - (4 * a * c);
 let exactLevel = (-b + Math.sqrt(discriminant)) / (2 * a);
 let level = Math.floor(exactLevel);
 if (level < 1) level = 1;
 let currentLevelBaseExp = (6 * level * level) + (20 * level);
 let nextLevel = level + 1;
 let nextLevelBaseExp = (6 * nextLevel * nextLevel) + (20 * nextLevel);
 let nextLevelRequiredExp = nextLevelBaseExp - exp;
 let levelRangeRange = nextLevelBaseExp - currentLevelBaseExp;
 let levelGainedProgress = exp - currentLevelBaseExp;
 let progressPercent = Math.min(100, Math.max(0, Math.round((levelGainedProgress / levelRangeRange) * 100)));
 return {
     level: level,
     nextLevelRequiredExp: nextLevelRequiredExp,
     progressPercent: progressPercent
 };
};
// 🌟 アバター画像のCanvas圧縮登録処理（Firebaseへ即時同期）
window.handleAvatarImageUpload = function(event) {
const file = event.target.files[0];
if (!file) return;
if (!file.type.startsWith('image/')) {
     alert("画像ファイルを選択してください。");
     return;
 }
 const reader = new FileReader();
 reader.onload = function(e) {
     const img = new Image();
     img.onload = async function() {
         const canvas = document.createElement('canvas');
         const ctx = canvas.getContext('2d');
         const maxDimension = 200;
         let width = img.width;
         let height = img.height;
         if (width > height) {
             if (width > maxDimension) {
                 height = Math.round((height * maxDimension) / width);
                 width = maxDimension;
             }
         } else {
             if (height > maxDimension) {
                 width = Math.round((width * maxDimension) / height);
                 height = maxDimension;
             }
         }
         canvas.width = width;
         canvas.height = height;
         ctx.drawImage(img, 0, 0, width, height);
         const compressedBase64Data = canvas.toDataURL('image/jpeg', 0.7);
         try {
             localStorage.setItem('core_v4_user_avatar_' + myId, compressedBase64Data);
             await window.saveUserStats();
             window.applyProfileToUi();
             window.renderLeaderboard();
             window.sortAndRenderFriendList();
             alert("アバター写真を安全に圧縮・登録し、クラウドに同期しました！");
         } catch(error) {
             console.error("Avatar save error:", error);
             alert("画像の保存に失敗しました。お手数ですが別の画像でお試しください。");
         }
     };
     img.src = e.target.result;
 };
 reader.readAsDataURL(file);
};
// アプリのコアライフサイクル読み込み
window.loadLocalState = async function() {
const savedId = localStorage.getItem('core_v4_userId');
geminiApiKey = localStorage.getItem('core_v4_geminiKey') || "";
const apiKeyInput = document.getElementById('sidebarApiKeyInput');
if(apiKeyInput) apiKeyInput.value = geminiApiKey;
const savedTitleText = localStorage.getItem('core_v4_dashboard_title') || "ダッシュボード";
 const headerTitleEl = document.getElementById('headerTitleText');
 if(headerTitleEl) headerTitleEl.innerText = savedTitleText;
 const savedNotice = localStorage.getItem('core_v4_admin_notice') || "";
 const noticeFrame = document.getElementById('adminNoticeDisplayFrame');
 const noticeBody = document.getElementById('adminNoticeTextContent');
 if (noticeFrame && noticeBody) {
     if (savedNotice.trim() !== "") {
         noticeBody.innerText = savedNotice;
         noticeFrame.style.display = 'block';
     } else {
         noticeFrame.style.display = 'none';
     }
 }
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
     currentTextbook = localStorage.getItem('core_v4_current_textbook_id') || "";
     // 🌟 起動時に全教材・全単語データをダウンロード＆キャッシュ化
     await window.preloadAllTextbooksAndVocab();
     await window.loadUserStats();
     userStats.goal_text = myTarget; 
     userStats.friends_count = myFriendList.length; 
     await window.loadCurrentTextbookData();
     window.applyProfileToUi();
     if(typeof window.updatePartySlotsUi === 'function') window.updatePartySlotsUi(); 
     window.renderLeaderboard();
     window.renderHistoryList();
     window.renderBookshelf(); 
     window.renderAdminUserList(); 
     window.renderGameLeaderboard('mine');
     window.renderTitles();
     window.initStudyTimerAndDataRotation();
     const codeBadge = document.getElementById('myFriendCodeDisplay');
     if(codeBadge) codeBadge.innerText = myId;
     // 🌟 UIラベル書き換え（和訳→意味 / 英訳→単語）＆単語帳詳細ボタン注入
     window.relabelUiText();
     window.injectVocabStatsButton();
 } else {
     const gateScreen = document.getElementById('auth-gate-screen');
     if(gateScreen) gateScreen.style.display = 'flex';
 }
};
// ==========================================================================
// 🌟 2. グローバル変数（システム全体で使うデータ）
// ==========================================================================
let myId = "";
let myName = "プレイヤー1";
let myTarget = "未設定";
let selectedTitle = "称号なし";
let totalExp = 0;
let vocabList = [];
let vocabFilter = "all";
let geminiApiKey = "";
let currentTextbook = "";
let textbooksPool = [];
let textbooksCacheMap = {}; // 単語データキャッシュ用のマップオブジェクト
let adminUploadedBookCoverBase64 = "";
let isLevelRankExpanded = false;
let isGameTargetExpanded = false;
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
let flashcardDataSourceMode = '';
let flashcardDirectionMode = 'en2ja';
let flashcardOriginQueue = [];
let flashcardCurrentIndex = 0;
let flashcardLearnedCount = 0;
let cardTouchStartX = 0;
let cardTouchStartY = 0;
let isCardFlicking = false;
let flashcardSessionHistory = [];
let currentLbMode = 'ja2en';
let currentLbDiff = 'endless';
let currentLbType = 'mine';
const SHARED_DEFAULT_VOCAB_DATA = [];
let dictionaryData = [];
let wordMemory = JSON.parse(localStorage.getItem('wordMemory')) || {};
let textHistory = JSON.parse(localStorage.getItem('textHistory')) || [];
let myBookshelf = JSON.parse(localStorage.getItem('myBookshelf')) || [];
let myBookshelfContainer = document.getElementById('myBookshelfContainer');
let myFolders = JSON.parse(localStorage.getItem('myFolders')) || ['未分類'];
let currentTranslationMode = 'inline';
let currentActiveReaderText = "";
let currentActiveTitle = "";
let currentTargetWordToken = null;
let currentActiveTitleVocabNum = null;
let currentActiveAiAnalysisCache = null;
let gameTimerInterval = null;
let gameRemainingTime = 45;
let gameScoreCount = 0;
let gameCurrentWordsQueue = [];
let gameCurrentIndex = 0;
let isGameProcessingAnswer = false;
let isGameTimerPaused = false;
let currentMultiMode = 'coop';
let multiBossMaxHp = 100000;
let multiBossHp = 100000;
let multiPartyMembers = [];
let multiEnemyTimeLeft = 10;
let currentMultiCorrectIndex = -1;
let multiLimitAmount = 0;
const multiLimitMax = 100;
let flickStartX = 0;
let flickStartY = 0;
let isFlicking = false;
let currentFlickChoice = -1;
let modeSwipeStartX = 0;
let currentActiveTabId = "home";
let todayStudySeconds = parseInt(localStorage.getItem('core_v4_study_today_secs') || "0");
let lastAccessDateStr = localStorage.getItem('core_v4_study_last_date') || "";
let weeklyStudyMinutesLog = JSON.parse(localStorage.getItem('core_v4_study_weekly_log') || "[0, 0, 0, 0, 0, 0, 0]");
let myFriendList = JSON.parse(localStorage.getItem('core_v4_friend_list') || "[]");
let userStats = {
test_count: 0,
combo_max: 0,
multi_win: 0,
high_score: 0,
mistake_count: 0,
vocab_reg: 0,
vocab_fixed: 0,
delete_count: 0,
study_burst: 0,
reader_open: 0,
flash_count: 0,
friends_count: 0,
user_level: 1,
gold_spent: 0,
goal_text: "",
weekly_rank_first: false
};
const TITLE_DATABASE = [
{ id: 'test_count', name: '試練 of 挑戦者', steps: [10, 100, 500, 2500, 9999], desc: '単語テストの総解答問題数', unit: '問' },
{ id: 'combo_max', name: 'コンボマスター', steps: [2, 5, 10, 30, 50], desc: '単語テストでの連続正解コンボ記録', unit: '連' },
{ id: 'mistake_count', name: '不撓不屈', steps: [5, 25, 100, 500, 999], desc: '単語テストで間違えて学んだ総誤答数', unit: '回' },
{ id: 'vocab_fixed', name: '記憶 of 定着者', steps: [5, 25, 100, 500, 999], desc: '単語帳コレクションで「定着 ⚪︎」を達成した総語数', unit: '語' },
{ id: 'study_burst', name: '集中バースト', steps: [5, 15, 30, 60, 120], desc: '1日の最大総勉強時間記録', unit: '分' },
{ id: 'reader_open', name: '読解 of 旅人', steps: [3, 10, 25, 50, 99], desc: 'スマート長文リーダーを起動して解析した総回数', unit: '回' },
{ id: 'flash_count', name: '手のひら返し', steps: [10, 100, 500, 2500, 9999], desc: 'フラッシュカード単語をめくって学習した総回数', unit: '回' },
{ id: 'friends_count', name: 'friends', steps: [1, 5, 10, 25, 50], desc: '追加して登録を完了したフレンドの総人数', unit: '人' },
{ id: 'user_level', name: 'ガチ勢', steps: [5, 10, 25, 50, 99], desc: '自身の現在の総合プレイヤーレベル到達値', unit: 'Lvl' }
];
const SPECIAL_TITLES = [
{ id: 'goal_setting', name: '必勝', desc: 'プロフィール目標に「大学合格」の文字を入れる', check: () => userStats.goal_text.includes('大学合格') },
{ id: 'weekly_rank', name: 'ランキング王者', desc: 'ソロ/ハイスコアランキングで自分が1位を獲得する', check: () => userStats.weekly_rank_first === true }
];
let rewardedTitlesStepsCache = JSON.parse(localStorage.getItem('core_v4_rewarded_titles_cache') || "{}");
window.checkAndRewardTitleBonusXP = function() {
let xpAddedFlag = false;
TITLE_DATABASE.forEach(title => {
     const val = userStats[title.id] || 0;
     let currentStepReached = 0;
     title.steps.forEach((target, idx) => {
         if (val >= target) {
             currentStepReached = idx + 1;
         }
     });
     if (!rewardedTitlesStepsCache[title.id]) {
         rewardedTitlesStepsCache[title.id] = 0;
     }
     if (currentStepReached > rewardedTitlesStepsCache[title.id]) {
         for (let step = rewardedTitlesStepsCache[title.id] + 1; step <= currentStepReached; step++) {
             let bonus = 10; 
             if (step === 2) bonus = 100; 
             if (step === 3) bonus = 500; 
             if (step === 4) bonus = 2500; 
             if (step === 5) bonus = 7777; 
             totalExp += bonus;
             xpAddedFlag = true;
         }
         rewardedTitlesStepsCache[title.id] = currentStepReached;
     }
 });
 SPECIAL_TITLES.forEach(title => {
     const isUnlocked = title.check();
     if (isUnlocked && !rewardedTitlesStepsCache[title.id]) {
         totalExp += 7777; 
         rewardedTitlesStepsCache[title.id] = 1;
         xpAddedFlag = true;
     }
 });
 if (xpAddedFlag) {
     localStorage.setItem('core_v4_totalExp', totalExp);
     localStorage.setItem('core_v4_rewarded_titles_cache', JSON.stringify(rewardedTitlesStepsCache));
     let newLvlData = window.calculateLevelFromExp(totalExp);
     userStats.user_level = newLvlData.level;
     window.saveUserStats();
     window.applyProfileToUi();
     window.renderTitles();
     window.renderLeaderboard();
 }
};
const RARITY_MAP = [
{ name: 'コモン', class: 'badge-common' },
{ name: 'アンコモン', class: 'badge-uncommon' },
{ name: 'レア', class: 'badge-rare' },
{ name: 'スーパーレア', class: 'badge-epic' },
{ name: 'レジェンダリー', class: 'badge-legendary' }
];
// ==========================================================================
// 🌟 3. 各種機能の定義
// ==========================================================================
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
alert( "【デバッグ情報】\nAPIキーが設定されていないため、AI通信をスキップしました。 ");
return null;
}
try {
const url =  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}` ;
const prompt =  "以下の英文をパースし、指定 of JSONスキーマ形式のみで返答してください。\n\n英文:\n " + text +  "\n\n出力JSON形式:\n{\n   \"fullSummaryAbstract\": \"英文全体のシンプルな日本語要約(3文以内)\",\n   \"sentences\": [\n    {\n       \"text\": \"元の英語の1文\",\n       \"translation\": \"その文の正確な日本語訳\",\n       \"grammarHighlights\": [\n        {\n           \"phrase\": \"フレーズ\",\n           \"meaning\": \"意味\"\n        }\n      ]\n    }\n  ]\n}";
    const response = await fetch(url, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
     });
     if (!response.ok) {
         const errorData = await response.text();
         console.error("Gemini API Error details:", errorData);
         return null;
     }
     const data = await response.json();
     const responseText = data.candidates[0].content.parts[0].text.trim();
     const cleanJsonText = responseText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
     return JSON.parse(cleanJsonText);
 } catch (e) {
     console.error("Gemini Analyzer Error:", e);
     return null;
 }
};
window.callGeminiGameJudge = async function(question, correctAnswer, userAns, mode) {
if (!geminiApiKey) return { status:  "NG", alternatives:  "特になし" };
try {
const url =  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}` ;
const prompt =  "採点AIです。JSONフォーマットで返してください。\n問題: " + question +  "\n模範解答: " + correctAnswer +  "\nユーザー解答: " + userAns +  "\n出力形式: {\"status\": \"OK/SO/NG\", \"alternatives\": \"別解\"}";
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
window.renderLeaderboard = function() {
const container = document.getElementById('leaderboardContainer');
if(!container) return;
let users = [];
 const mySavedAvatar = localStorage.getItem('core_v4_user_avatar_' + myId) || "";
 let lvlData = window.calculateLevelFromExp(totalExp);
 let calculatedLvl = lvlData.level;
 userStats.user_level = calculatedLvl; 
 users.push({
     name: `${myName} (あなた)`,
     title: selectedTitle,
     exp: totalExp,
     lvl: calculatedLvl,
     icon: "👤",
     customAvatar: mySavedAvatar,
     isMe: true
 });
 users.sort((a, b) => b.exp - a.exp);
 let html = "";
 users.forEach((u, idx) => {
     let rankColor = idx === 0 ? "#FBBF24" : idx === 1 ? "#94A3B8" : idx === 2 ? "#D97706" : "#FFFFFF";
     let bgStyle = u.isMe ? "background: linear-gradient(90deg, rgba(0, 240, 255, 0.15) 0%, rgba(15, 23, 42, 0.6) 100%); border: 1px solid var(--cosmic-cyan);" : "background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);";
     let avatarUiNodeStr = `<span style="font-size:16px;">${u.icon}</span>`;
     if (u.customAvatar) {
         avatarUiNodeStr = `<img src="${u.customAvatar}" style="width:24px; height:24px; border-radius:50%; object-fit:cover; border:1px solid var(--cosmic-cyan);">`;
     }
     html += `
         <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; border-radius:8px; margin-bottom:4px; ${bgStyle} font-size:12px;">
             <div style="display:flex; align-items:center; gap:10px;">
                 <span style="color:${rankColor}; font-weight:900; font-size:14px; width:18px; text-align:center;">${idx + 1}</span>
                 <div style="width:24px; height:24px; display:flex; align-items:center; justify-content:center;">${avatarUiNodeStr}</div>
                 <div>
                     <div style="font-weight:bold; color:white;">${u.name} <span style="font-size:9px; color:var(--cosmic-cyan); font-weight:normal; margin-left:4px;">LV.${u.lvl}</span></div>
                     <div style="font-size:9px; color:var(--text-sub); margin-top:1px;">${u.title}</div>
                 </div>
             </div>
             <div style="text-align:right; font-weight:900; color:var(--word-so); font-family:monospace;">${u.exp} <span style="font-size:8px; color:var(--text-sub); font-weight:normal;">EXP</span></div>
         </div>`;
 });
 container.innerHTML = html;
 window.saveUserStats();
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
// 🌟 全単語データ・教材の一括読み込み（爆速化キャッシュ）
window.preloadAllTextbooksAndVocab = async function() {
await window.syncTextbooksIndexFromFirestore();
if (window.db && window.fbGetDoc && window.fbDoc) {
    for (const book of textbooksPool) {
        try {
            const docName = `vocab_${book.id}`;
            const sharedRef = window.fbDoc(window.db, "shared", docName);
            const sharedSnap = await window.fbGetDoc(sharedRef);
            if (sharedSnap.exists() && sharedSnap.data().custom_words) {
                textbooksCacheMap[book.id] = sharedSnap.data().custom_words;
                localStorage.setItem(`core_v4_cache_${book.id}`, JSON.stringify(sharedSnap.data().custom_words));
            }
        } catch(e) {}
    }
}
};
// 🌟 単語帳データをFirebase (Firestore) と同期・保存処理
window.saveVocabToStorage = async function() {
// 🌟 単語変更のたびに語幹インデックスを再構築（活用形マッチング用）
window.rebuildVocabStemIndex();
const bookKey = currentTextbook || "default";
localStorage.setItem(`core_v4_custom_words_${myId}_${bookKey}`, JSON.stringify(vocabList));
textbooksCacheMap[bookKey] = vocabList;
if (window.db && window.fbSetDoc && window.fbDoc) {
    try {
        const docName = currentTextbook ? `vocab_${currentTextbook}` : "vocab";
        const sharedRef = window.fbDoc(window.db, "shared", docName);
        await window.fbSetDoc(sharedRef, { 
            custom_words: vocabList,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    } catch (error) {
        console.error("Firebaseの保存に失敗しました:", error);
    }
}
};
window.syncTextbooksIndexFromFirestore = async function() {
if (window.db && window.fbGetDoc && window.fbDoc) {
try {
const indexRef = window.fbDoc(window.db, "shared", "textbooks_index");
const snap = await window.fbGetDoc(indexRef);
if (snap.exists() && snap.data().textbooks) {
textbooksPool = snap.data().textbooks;
if (!currentTextbook && textbooksPool.length > 0) {
currentTextbook = textbooksPool[0].id;
localStorage.setItem('core_v4_current_textbook_id', currentTextbook);
}
}
} catch(e) {
console.error("教材インデックスの同期エラー:", e);
}
}
window.updateAdminEditBookSelectOptions();
};
window.updateAdminEditBookSelectOptions = function() {
const adminSelect = document.getElementById('adminEditBookSelect');
if (!adminSelect) return;
const currentVal = adminSelect.value;
adminSelect.innerHTML = `<option value="">➕ 新規教材として一斉配信登録</option>`;
textbooksPool.forEach(book => {
const opt = document.createElement('option');
opt.value = book.id;
opt.innerText = book.name;
adminSelect.appendChild(opt);
});
adminSelect.value = currentVal;
};
// 🌟 キャッシュ優先で単語帳データを爆速ロードする関数
window.loadCurrentTextbookData = async function() {
let storedWords = [];
const bookKey = currentTextbook || "default";
const currentLocalKey = `core_v4_custom_words_${myId}_${bookKey}`;
if (textbooksCacheMap[bookKey]) {
     storedWords = textbooksCacheMap[bookKey];
 } else {
     const localCache = localStorage.getItem(`core_v4_cache_${bookKey}`);
     if (localCache) {
         storedWords = JSON.parse(localCache);
     } else {
         storedWords = JSON.parse(localStorage.getItem(currentLocalKey) || "[]");
     }
 }
 vocabList = window.migrateVocabData(storedWords);
 window.rebuildVocabStemIndex();
 userStats.vocab_reg = vocabList.length;
 window.updateFlashcardSourceSelectOptions();
 window.renderVocabList();
 const currentBook = textbooksPool.find(b => b.id === currentTextbook);
 const coverContainer = document.getElementById('vocabCoverContainer');
 const titleContainer = document.getElementById('vocabBookTitle');
 if (currentBook) {
     if (coverContainer) {
         if (currentBook.coverType === "image" && currentBook.cover) {
             coverContainer.innerHTML = `<img src="${currentBook.cover}" style="width:100%; height:100%; object-fit:cover; border-radius:50%; border:1px solid rgba(255,255,255,0.2);">`;
         } else {
             coverContainer.innerText = currentBook.cover || "📔";
         }
     }
     if (titleContainer) titleContainer.innerText = currentBook.name;
 } else {
     if (coverContainer) coverContainer.innerText = "📔";
     if (titleContainer) titleContainer.innerText = "共通単語帳";
 }
 window.applyVocabMaxRange();
 window.injectVocabStatsButton();
};
window.openTextbookSelectPopup = function() {
const container = document.getElementById('textbookListSelectContainer');
if(!container) return;
container.innerHTML = "";
if(textbooksPool.length === 0) {
     container.innerHTML = "<div style='color:var(--text-sub); font-size:12px; text-align:center; padding:10px;'>現在、配信中の教材はありません。<br>管理者の配信をお待ちください。</div>";
 }
 textbooksPool.forEach(book => {
     const row = document.createElement('div');
     let activeStyle = book.id === currentTextbook ? "border: 1.5px solid var(--cosmic-cyan); background:rgba(0,240,255,0.1);" : "border: 1px solid rgba(255,255,255,0.1);";
     row.style.cssText = `display:flex; align-items:center; gap:12px; padding:10px 14px; border-radius:10px; cursor:pointer; ${activeStyle}`;
     row.onclick = () => window.switchTextbookContext(book.id);
     let coverHtmlStr = `<span style="font-size:22px;">${book.cover || "📔"}</span>`;
     if (book.coverType === "image" && book.cover) {
         coverHtmlStr = `<img src="${book.cover}" style="width:32px; height:36px; object-fit:cover; border-radius:4px;">`;
     }
     row.innerHTML = `${coverHtmlStr}<span style="font-size:13.5px; font-weight:bold; color:white;">${book.name}</span>`;
     container.appendChild(row);
 });
 window.updateAdminEditBookSelectOptions();
 const popup = document.getElementById('textbookSelectPopupFrame');
 if(popup) { popup.style.display = 'flex'; popup.classList.add('show'); }
};
window.switchTextbookContext = async function(bookId) {
currentTextbook = bookId;
localStorage.setItem('core_v4_current_textbook_id', bookId);
const popup = document.getElementById('textbookSelectPopupFrame');
if (popup) { popup.classList.remove('show'); popup.style.display = 'none'; }
await window.loadCurrentTextbookData();
};
window.handleAdminBookCoverUpload = function(event) {
const file = event.target.files[0];
if (!file || !file.type.startsWith('image/')) return;
const reader = new FileReader();
reader.onload = function(e) {
const img = new Image();
img.onload = function() {
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const maxDimension = 120;
let width = img.width, height = img.height;
if (width > height) {
if (width > maxDimension) { height = Math.round((height * maxDimension) / width); width = maxDimension; }
} else {
if (height > maxDimension) { width = Math.round((width * maxDimension) / height); height = maxDimension; }
}
canvas.width = width; canvas.height = height;
ctx.drawImage(img, 0, 0, width, height);
adminUploadedBookCoverBase64 = canvas.toDataURL('image/jpeg', 0.7);
alert("教材用のアイコン画像ファイルを受け付けました！");
};
img.src = e.target.result;
};
reader.readAsDataURL(file);
};
window.saveOrUpdateTextbookFromAdmin = async function() {
const adminSelect = document.getElementById('adminEditBookSelect');
const titleInput = document.getElementById('adminNewBookTitle');
if(!titleInput || !adminSelect) return;
const selectedBookId = adminSelect.value;
 const title = titleInput.value.trim();
 if(!title) return alert("教材の名前を入力してください！");
 await window.syncTextbooksIndexFromFirestore();
 let finalCover = adminUploadedBookCoverBase64;
 let finalType = "image";
 if (selectedBookId) {
     const targetIdx = textbooksPool.findIndex(b => b.id === selectedBookId);
     if (targetIdx !== -1) {
         textbooksPool[targetIdx].name = title;
         if (adminUploadedBookCoverBase64) {
             textbooksPool[targetIdx].cover = finalCover;
             textbooksPool[targetIdx].coverType = finalType;
         }
     }
 } else {
     if(!adminUploadedBookCoverBase64) {
         finalCover = "📔";
         finalType = "text";
     }
     const newBookId = "textbook_" + Date.now();
     textbooksPool.push({ id: newBookId, name: title, cover: finalCover, coverType: finalType });
     currentTextbook = newBookId;
     localStorage.setItem('core_v4_current_textbook_id', newBookId);
 }
 if (window.db && window.fbSetDoc && window.fbDoc) {
     try {
         const indexRef = window.fbDoc(window.db, "shared", "textbooks_index");
         await window.fbSetDoc(indexRef, { textbooks: textbooksPool }, { merge: true });
         alert(`🎉 教材リストデータ『${title}』を配信・適用完了しました！`);
         titleInput.value = "";
         adminSelect.value = "";
         adminUploadedBookCoverBase64 = "";
         const fileInput = document.getElementById('adminBookCoverFileUploader');
         if(fileInput) fileInput.value = "";
         window.updateFlashcardSourceSelectOptions();
         window.updateAdminEditBookSelectOptions();
         await window.loadCurrentTextbookData();
         window.switchTab('home');
     } catch(e) {
         alert("Firebaseとの通信に失敗しました。");
     }
 }
};
window.deleteTextbookFromAdmin = async function() {
const adminSelect = document.getElementById('adminEditBookSelect');
if(!adminSelect) return;
const selectedBookId = adminSelect.value;
if(!selectedBookId) return alert("削除したい既存の教材をセレクトボックスから選択してください！");
const targetBook = textbooksPool.find(b => b.id === selectedBookId);
 if(!confirm(`⚠️ 警告: 教材『${targetBook.name}』を完全に削除しますか？\nこの操作は取り消せません。`)) return;
 textbooksPool = textbooksPool.filter(b => b.id !== selectedBookId);
 if (window.db && window.fbSetDoc && window.fbDoc) {
     try {
         const indexRef = window.fbDoc(window.db, "shared", "textbooks_index");
         await window.fbSetDoc(indexRef, { textbooks: textbooksPool }, { merge: true });
         alert("🎉 指定された教材を完全にシステムから削除・同期しました。");
         const titleInput = document.getElementById('adminNewBookTitle');
         if(titleInput) titleInput.value = "";
         adminSelect.value = "";
         currentTextbook = textbooksPool.length > 0 ? textbooksPool[0].id : "";
         localStorage.setItem('core_v4_current_textbook_id', currentTextbook);
         window.updateFlashcardSourceSelectOptions();
         window.updateAdminEditBookSelectOptions();
         await window.loadCurrentTextbookData();
     } catch(e) {
         alert("Firebaseとの通信に失敗しました。");
     }
 }
};
window.handleAdminEditSelectChange = function(val) {
const titleInput = document.getElementById('adminNewBookTitle');
const submitBtn = document.getElementById('adminBookSubmitBtn');
if(!titleInput || !submitBtn) return;
if(val) {
    const match = textbooksPool.find(b => b.id === val);
    if(match) titleInput.value = match.name;
    submitBtn.innerText = "選択中の教材データを修正・上書き保存";
} else {
    titleInput.value = "";
    submitBtn.innerText = "新規教材として一斉配信登録";
}
};
window.migrateVocabData = function(words) {
return words.map(w => {
if (!w.meanings || w.meanings.length === 0) {
w.meanings = [];
let mStr = w.meaning || "";
const hasCircle = /[①-⑳]/.test(mStr);
if (hasCircle) {
let parts = mStr.split(/(?=[①-⑳])/).map(p => p.replace(/[①-⑳]/g, '').trim()).filter(p => p);
w.meanings = parts.map((p, i) => ({ id: `${w.num}-${i}`, text: p, status: 'none', history: [] }));
} else {
w.meanings.push({ id: `${w.num}-0`, text: mStr.trim(), status: 'none', history: [] });
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
// ==========================================================================
// 🌟 活用形マッチング（語幹化＋インデックス＋照合）
// ==========================================================================
// 英単語の活用を落として語幹にする（規則活用対応。不規則動詞の過去形は非対応）
window.stemWord = function(word) {
let w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
if (w.length < 4) return w;
if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
if (w.length > 5 && w.endsWith('ing')) {
    let s = w.slice(0, -3);
    if (s.length >= 3 && s[s.length - 1] === s[s.length - 2] && !/[aeiou]/.test(s[s.length - 1])) s = s.slice(0, -1);
    if (s.length >= 3) return s;
}
if (w.length > 4 && w.endsWith('ed')) {
    let s = w.slice(0, -2);
    if (s.length >= 3 && s[s.length - 1] === s[s.length - 2] && !/[aeiou]/.test(s[s.length - 1])) s = s.slice(0, -1);
    if (s.length >= 3) return s;
}
if (w.length > 5 && w.endsWith('est')) return w.slice(0, -3);
if (w.length > 4 && w.endsWith('er')) return w.slice(0, -2);
if (w.length > 4 && w.endsWith('ly')) return w.slice(0, -2);
if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
return w;
};
// 登録語の語幹インデックスを再構築（完全一致＋語幹一致の両方を高速化）
window.rebuildVocabStemIndex = function() {
window._vocabStemIndex = {};
if (!Array.isArray(vocabList)) return;
vocabList.forEach(v => {
    const sk = window.stemWord(v.word);
    if (sk && sk.length >= 4 && !window._vocabStemIndex[sk]) window._vocabStemIndex[sk] = v;
});
};
// 完全一致を先に試し、ダメなら語幹一致で登録語を探す（活用形対応）
window.findVocabByToken = function(cleanKey) {
if (!cleanKey) return null;
let m = vocabList.find(v => v.word.toLowerCase() === cleanKey);
if (m) return m;
const sk = window.stemWord(cleanKey);
if (sk && sk.length >= 4 && window._vocabStemIndex && window._vocabStemIndex[sk]) return window._vocabStemIndex[sk];
return null;
};
// ==========================================================================
// 🌟 UIラベル書き換え（和訳→意味 / 英訳→単語 / 範囲補足）
// ==========================================================================
window.relabelUiText = function() {
const pairs = [['和訳', '意味'], ['英訳', '単語'], ['(1〜100)', '(1〜)'], ['（1〜100）', '(1〜)']];
const protect = ['和訳未取得', '総和訳'];
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: function(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        const tag = p.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'INPUT') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
    }
});
const targets = [];
let n;
while ((n = walker.nextNode())) targets.push(n);
targets.forEach(node => {
    let t = node.nodeValue;
    protect.forEach((p, i) => { if (t.indexOf(p) !== -1) t = t.split(p).join('�P' + i + '�'); });
    let changed = false;
    pairs.forEach(pair => { if (t.indexOf(pair[0]) !== -1) { t = t.split(pair[0]).join(pair[1]); changed = true; } });
    protect.forEach((p, i) => { const tok = '�P' + i + '�'; if (t.indexOf(tok) !== -1) { t = t.split(tok).join(p); changed = true; } });
    if (changed) node.nodeValue = t;
});
};
// ==========================================================================
// 🌟 出題範囲を 1〜登録最大番号 に合わせる
// ==========================================================================
window.applyVocabMaxRange = function() {
const maxNum = vocabList.reduce((m, w) => { const n = parseInt(w.num); return isNaN(n) ? m : Math.max(m, n); }, 0);
if (maxNum <= 0) return;
['flashcardRangeEnd', 'vocabRangeEnd'].forEach(id => { const el = document.getElementById(id); if (el) el.value = maxNum; });
};
// ==========================================================================
// 🌟 単語帳詳細ポップアップ（登録数・⚪︎△✕未学習・ドーナツグラフ）
// ==========================================================================
window.wordOverallStatus = function(w) {
if (!w.meanings || w.meanings.length === 0) return 'none';
const sts = w.meanings.map(m => m.status || 'none');
if (sts.every(s => s === 'ok')) return 'ok';
if (sts.some(s => s === 'bad')) return 'bad';
if (sts.some(s => s === 'so')) return 'so';
if (sts.some(s => s === 'ok')) return 'ok';
return 'none';
};
window.showVocabStatsPopup = function() {
let old = document.getElementById('vocabStatsOverlay'); if (old) old.remove();
const total = vocabList.length;
let ok = 0, so = 0, bad = 0, none = 0;
vocabList.forEach(w => { const s = window.wordOverallStatus(w); if (s === 'ok') ok++; else if (s === 'so') so++; else if (s === 'bad') bad++; else none++; });
const denom = total || 1;
const pct = v => total ? Math.round(v / denom * 100) : 0;
const segs = [
    { value: ok, color: '#10B981', label: '⚪︎ 定着' },
    { value: so, color: '#F59E0B', label: '△ 曖昧' },
    { value: bad, color: '#EF4444', label: '✕ 不可' },
    { value: none, color: '#64748B', label: '未学習' }
];
const r = 42, c = 2 * Math.PI * r; let offset = 0; let circles = '';
segs.forEach(seg => {
    const frac = seg.value / denom; const len = frac * c;
    if (len > 0) circles += `<circle r="${r}" cx="60" cy="60" fill="none" stroke="${seg.color}" stroke-width="14" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)"/>`;
    offset += len;
});
if (total === 0) circles = `<circle r="${r}" cx="60" cy="60" fill="none" stroke="#334155" stroke-width="14"/>`;
let listHtml = '';
segs.forEach(seg => {
    listHtml += `<div style="display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.08); font-size:13px;">
        <span style="display:flex; align-items:center; gap:8px;"><span style="width:12px; height:12px; border-radius:3px; background:${seg.color}; display:inline-block;"></span>${seg.label}</span>
        <span style="font-weight:800;">${seg.value}語 <span style="color:var(--text-sub); font-weight:600;">(${pct(seg.value)}%)</span></span>
    </div>`;
});
const ov = document.createElement('div');
ov.id = 'vocabStatsOverlay';
ov.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px);";
const box = document.createElement('div');
box.style.cssText = "background:var(--card-bg); border:1px solid var(--cosmic-cyan); border-radius:16px; padding:20px; width:88%; max-width:340px; color:#fff; box-shadow:0 10px 30px rgba(0,0,0,0.6);";
box.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <div style="font-size:16px; font-weight:900;">📊 単語帳の詳細</div>
        <button id="vocabStatsClose" style="background:none; border:none; color:var(--text-sub); font-size:20px; cursor:pointer; line-height:1;">×</button>
    </div>
    <div style="text-align:center; font-size:13px; margin-bottom:12px;">登録単語数: <strong style="color:var(--cosmic-cyan); font-size:18px;">${total}</strong> 語</div>
    <div style="display:flex; justify-content:center; margin-bottom:14px;">
        <svg width="120" height="120" viewBox="0 0 120 120">${circles}<text x="60" y="64" text-anchor="middle" fill="#fff" font-size="16" font-weight="900">${total}</text></svg>
    </div>
    ${listHtml}
`;
ov.appendChild(box);
document.body.appendChild(ov);
ov.querySelector('#vocabStatsClose').onclick = () => ov.remove();
ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
};
// 単語帳の切り替えボタンの右に「📊 詳細」ボタンを注入（1回だけ）
window.injectVocabStatsButton = function() {
if (document.getElementById('vocabStatsBtn')) return;
const titleEl = document.getElementById('vocabBookTitle');
if (!titleEl) return;
const parent = titleEl.parentElement;
if (!parent) return;
const btn = document.createElement('button');
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
window.getAllUsers = async function() {
let users = [];
if (window.db && window.fbGetDoc && window.fbDoc) {
try {
const ref = window.fbDoc(window.db, "shared", "all_users");
const snap = await window.fbGetDoc(ref);
if (snap.exists() && snap.data().users) {
users = snap.data().users;
}
} catch (e) {
console.error("Error fetching all users from Firebase:", e);
}
}
if (users.length === 0) {
users = JSON.parse(localStorage.getItem('core_v4_users') || "[]");
}
return users;
};
window.saveAllUsers = async function(users) {
localStorage.setItem('core_v4_users', JSON.stringify(users));
if (window.db && window.fbSetDoc && window.fbDoc) {
try {
const ref = window.fbDoc(window.db, "shared", "all_users");
await window.fbSetDoc(ref, { users: users }, { merge: true });
} catch (e) {
console.error("Error saving all users to Firebase:", e);
}
}
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
window.handleAuthSubmit = async function() {
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
     const users = await window.getAllUsers();
     const newUserObj = { id: newId, playerName: pName, realName: rName, age: age, pin: pin };
     users.push(newUserObj);
     await window.saveAllUsers(users);
     // Firebase usersコレクションに即時保存
     if (window.db && window.fbSetDoc && window.fbDoc) {
         try {
             const userRef = window.fbDoc(window.db, "users", newId);
             await window.fbSetDoc(userRef, {
                 id: newId,
                 playerName: pName,
                 realName: rName,
                 age: age,
                 pin: pin,
                 selectedTitle: "称号なし",
                 userTarget: "未設定",
                 totalExp: 0,
                 avatar: "",
                 userStats: { user_level: 1, study_burst: 0 }
             }, { merge: true });
         } catch(e) {
             console.error("Firebaseへの新規ユーザー個別登録エラー:", e);
         }
     }
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
     const users = await window.getAllUsers();
     let user = users.find(u => u.id === idInput && u.pin === pinInput);
     // クラウド側からの救済取得
     if(!user && window.db && window.fbGetDoc && window.fbDoc) {
         try {
             const userRef = window.fbDoc(window.db, "users", idInput);
             const snap = await window.fbGetDoc(userRef);
             if(snap.exists()) {
                 const data = snap.data();
                 if(data.pin === pinInput) {
                     user = { id: idInput, playerName: data.playerName || "修行者", realName: data.realName || "一般", age: data.age || "18", pin: data.pin };
                 }
             }
         } catch(e){}
     }
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
window.showCustomDeleteAdminUserConfirm = function(targetUserId) {
if(document.getElementById('adminUserDelOverlayLayer')) return;
const overlay = document.createElement('div');
overlay.id = 'adminUserDelOverlayLayer';
overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);";
const box = document.createElement('div');
box.style.cssText = "background:var(--card-bg); border:1px solid #EF4444; border-radius:16px; padding:24px; width:85%; max-width:320px; text-align:center; box-shadow: 0 10px 30px rgba(0,0,0,0.6);";
box.innerHTML = `<div style="color:white; font-size:18px; font-weight:800; margin-bottom:12px;">⚠️ ユーザーの完全削除</div> <div style="color:white; font-size:13px; margin-bottom:24px; line-height:1.5;">ユーザー ID <strong style="color:var(--cosmic-cyan);">${targetUserId}</strong> を完全に削除しますか？<br><span style="font-size:11px; color:var(--text-sub);">※この操作は取り消せません。</span></div> <div style="display:flex; gap:12px;"> <button style="flex:1; padding:12px; border-radius:10px; border:none; background:var(--input-bg); color:var(--text-main); font-weight:700; cursor:pointer;" id="cancelAdminUserDelBtn">やめる</button> <button style="flex:1; padding:12px; border-radius:10px; border:none; background:#EF4444; color:white; font-weight:700; cursor:pointer;" id="confirmAdminUserDelBtn">削除する</button> </div>`;
overlay.appendChild(box);
document.body.appendChild(overlay);
document.getElementById('cancelAdminUserDelBtn').onclick = () => { document.body.removeChild(overlay); };
 document.getElementById('confirmAdminUserDelBtn').onclick = async () => {
     document.body.removeChild(overlay);
     let users = await window.getAllUsers();
     users = users.filter(u => u.id !== targetUserId);
     await window.saveAllUsers(users);
     if (window.db && window.fbDoc) {
         try {
             const userRef = window.fbDoc(window.db, "users", targetUserId);
             if (window.fbDeleteDoc) {
                 await window.fbDeleteDoc(userRef);
             } else if (window.fbSetDoc) {
                 await window.fbSetDoc(userRef, { deleted: true }, { merge: false });
             }
         } catch(e) {
             console.error("Firebaseからのユーザーデータ削除エラー:", e);
         }
     }
     alert(`ユーザー [ ${targetUserId} ] の全情報を消去・削除しました！`);
     window.renderAdminUserList();
 };
};
window.deleteUserByAdmin = function(targetUserId) {
window.showCustomDeleteAdminUserConfirm(targetUserId);
};
// 🌟 管理者ユーザーリストレンダリング（安全な読み込み＆描画）
window.renderAdminUserList = async function() {
const container = document.getElementById('adminUserListContainer');
if(!container) return;
container.innerHTML = "<div style='color:var(--text-sub); font-size:12px; text-align:center; padding: 10px;'>ユーザー一覧を取得中...</div>";
try {
     const users = await window.getAllUsers();
     container.innerHTML = "";
     if(!users || users.length === 0) {
         container.innerHTML = "<div style='color:var(--text-sub); font-size:12px; text-align:center; padding: 10px;'>ユーザーが登録されていません。</div>";
         return;
     }
     users.forEach(u => {
         const div = document.createElement('div');
         div.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid rgba(255,255,255,0.1); font-size:12px;";
         div.innerHTML = `
             <div style="flex:1;">
                 <div style="color:var(--cosmic-cyan); font-family:monospace; font-weight:bold; letter-spacing:1px;">ID: ${u.id}</div>
                 <div style="color:white; font-weight:bold; margin-top:2px;">${u.playerName || '修行者'} <span style="color:var(--text-sub); font-weight:normal; font-size:10px;">(${u.realName || '-'} / ${u.age || '-'}歳)</span></div>
             </div>
             <button class="list-action-link" style="background:rgba(239,68,68,0.2); color:#EF4444; border-color:#EF4444; height:28px; padding:0 8px; font-size:11px;" onclick="window.deleteUserByAdmin('${u.id}')">削除</button>
         `;
         container.appendChild(div);
     });
 } catch(e) {
     container.innerHTML = "<div style='color:var(--text-sub); font-size:12px; text-align:center; padding: 10px;'>ユーザー情報の取得に失敗しました。</div>";
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
 let lvlData = window.calculateLevelFromExp(totalExp);
 const headerBarFillEl = document.getElementById('header-level-bar-fill');
 if(headerBarFillEl) {
     headerBarFillEl.style.width = `${lvlData.progressPercent}%`;
 }
 const headerLevelTextEl = document.getElementById('headerLevelTextSlot');
 if(headerLevelTextEl) {
     headerLevelTextEl.innerText = `Lv.${lvlData.level} [Next:${lvlData.nextLevelRequiredExp}]`;
 }
 const mySavedAvatar = localStorage.getItem('core_v4_user_avatar_' + myId) || "";
 const sideAvatarFrame = document.querySelector('.sidebar-header .avatar-glow');
 if(sideAvatarFrame) {
     if(mySavedAvatar) {
         sideAvatarFrame.innerHTML = `<img src="${mySavedAvatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
     } else {
         sideAvatarFrame.innerText = "RANK";
     }
 }
 const profAvatarFrame = document.getElementById('profAvatarText');
 if(profAvatarFrame) {
     if(mySavedAvatar) {
         profAvatarFrame.parentNode.innerHTML = `<img src="${mySavedAvatar}" id="profAvatarText" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
         window.initLucide();
     } else {
         profAvatarFrame.innerText = (myName && myName.length > 0) ? myName.charAt(0).toUpperCase() : "U";
     }
 }
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
document.querySelectorAll('.nav-bar .nav-item').forEach(n => n.classList.remove('active'));
const nav = document.getElementById('nav-' + tabId);
if(nav) nav.classList.add('active');
window.toggleSidebar(false);
if(tabId !== 'reader' && typeof window.closeReader === 'function') window.closeReader();
if(tabId === 'game') window.renderGameLeaderboard('mine');
if(tabId === 'admin') {
    window.renderAdminUserList();
    window.updateAdminEditBookSelectOptions();
}
if(tabId === 'titles') window.renderTitles(); 
currentActiveTabId = tabId;
if(tabId === 'community') window.sortAndRenderFriendList();
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
userStats.vocab_reg = vocabList.length;
window.saveUserStats();
window.saveVocabToStorage(); window.renderVocabList(); window.renderBulkDeleteList();
input.value = ""; alert("一括インポートが完了しました。");
};
window.openWordPopoverFromVocab = function(event, vocabItem, originalText) {
if(!vocabItem) return;
if(event) event.stopPropagation(); currentTargetWordToken = vocabItem.word.toLowerCase(); currentTargetVocabNum = vocabItem.num;
document.getElementById('popWord').innerText = originalText; document.getElementById('popWordNum').innerText = `#${vocabItem.num}`;
let meaningHtml = "";
vocabItem.meanings.forEach(m => {
meaningHtml += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:6px;"> <span style="font-size:14px; color:white; flex:1; line-height:1.4;">${m.text}</span> <div style="display:flex; gap:4px; flex-shrink:0; margin-left:8px;"> <button style="width:26px; height:26px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:${m.status==='ok'?'var(--word-ok)':'rgba(0,0,0,0.5)'}; color:${m.status==='ok'?'#000':'white'}; font-size:10px; font-weight:900; cursor:pointer;" onclick="window.updateMeaningStatusFromPopover('${vocabItem.num}', '${m.id}', 'ok', event)">⚪︎</button> <button style="width:26px; height:26px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:${m.status==='so'?'var(--word-so)':'rgba(0,0,0,0.5)'}; color:${m.status==='so'?'#000':'white'}; font-size:10px; font-weight:900; cursor:pointer;" onclick="window.updateMeaningStatusFromPopover('${vocabItem.num}', '${m.id}', 'so', event)">△</button> <button style="width:26px; height:26px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); background:${m.status==='bad'?'var(--word-bad)':'rgba(0,0,0,0.5)'}; color:${m.status==='bad'?'#FFF':'white'}; font-size:10px; font-weight:900; cursor:pointer;" onclick="window.updateMeaningStatusFromPopover('${vocabItem.num}', '${m.id}', 'bad', event)">✕</button> <button style="width:26px; height:26px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); color:white; font-size:10px; font-weight:900; cursor:pointer;" onclick="window.updateMeaningStatusFromPopover('${vocabItem.num}', '${m.id}', 'none', event)">ー</button> </div> </div>`;
});
document.getElementById('popMeaning').innerHTML = meaningHtml; document.getElementById('popoverStatusBtns').style.display = "none";
const pop = document.getElementById('wordPopover'); pop.style.display = 'flex'; pop.classList.add('show');
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
document.querySelectorAll('.bulk-delete-chk').forEach(chk => { chk.checked = checked; });
};
window.showCustomBulkDeleteConfirm = function(count, numsToDelete) {
if(document.getElementById('bulkDelOverlayLayer')) return;
const overlay = document.createElement('div');
overlay.id = 'bulkDelOverlayLayer';
overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);";
const box = document.createElement('div');
box.style.cssText = "background:var(--card-bg); border:1px solid #EF4444; border-radius:16px; padding:24px; width:85%; max-width:320px; text-align:center; box-shadow: 0 10px 30px rgba(0,0,0,0.6);";
box.innerHTML = `<div style="color:white; font-size:18px; font-weight:800; margin-bottom:12px;">⚠️ 一括削除</div> <div style="color:var(--text-sub); font-size:13px; margin-bottom:24px; line-height:1.5;">選択された <strong style="color:white;">${count}</strong> 件の単語を完全に削除しますか？</div> <div style="display:flex; gap:12px;"> <button style="flex:1; padding:12px; border-radius:10px; border:none; background:var(--input-bg); color:var(--text-main); font-weight:700; cursor:pointer;" id="cancelBulkDelBtn">キャンセル</button> <button style="flex:1; padding:12px; border-radius:10px; border:none; background:#EF4444; color:white; font-weight:700; cursor:pointer;" id="confirmBulkDelBtn">削除する</button> </div>`;
overlay.appendChild(box);
document.body.appendChild(overlay);
document.getElementById('cancelBulkDelBtn').onclick = () => { document.body.removeChild(overlay); };
document.getElementById('confirmBulkDelBtn').onclick = () => {
vocabList = vocabList.filter(w => !numsToDelete.includes(String(w.num)));
userStats.delete_count += numsToDelete.length;
userStats.vocab_reg = vocabList.length;
window.saveUserStats();
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
box.innerHTML = `<div style="color:white; font-size:18px; font-weight:800; margin-bottom:12px;">🔄 理解度の一括リセット</div> <div style="color:var(--text-sub); font-size:13px; margin-bottom:24px; line-height:1.5;">選択された <strong style="color:white;">${count}</strong> 件の単語の理解度を初期状態に戻しますか？</div> <div style="display:flex; gap:12px;"> <button style="flex:1; padding:12px; border-radius:10px; border:none; background:var(--input-bg); color:var(--text-main); font-weight:700; cursor:pointer;" id="cancelBulkResetBtn">やめる</button> <button style="flex:1; padding:12px; border-radius:10px; border:none; background:#10B981; color:white; font-weight:700; cursor:pointer;" id="confirmBulkResetBtn">リセット</button> </div>`;
overlay.appendChild(box); document.body.appendChild(overlay);
document.getElementById('cancelBulkResetBtn').onclick = () => { document.body.removeChild(overlay); };
document.getElementById('confirmBulkResetBtn').onclick = () => {
vocabList.forEach(w => {
if(numsToReset.includes(String(w.num))) {
w.status = "none"; w.history = [];
if(w.meanings) w.meanings.forEach(m => { m.status = "none"; m.history = []; });
}
});
    userStats.vocab_fixed = vocabList.filter(w => w.meanings && w.meanings.some(m => m.status === 'ok')).length;
    window.saveUserStats();
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
box.innerHTML = `<div style="color:white; font-size:18px; font-weight:800; margin-bottom:12px;">⚠️ 単語の削除</div> <div style="color:white; font-size:13px; margin-bottom:24px; line-height:1.5;">単語 <strong style="color:white;">#${numStr}</strong> を完全に削除しますか？</div> <div style="display:flex; gap:12px;"> <button style="flex:1; padding:12px; border-radius:10px; border:none; background:var(--input-bg); color:var(--text-main); font-weight:700; cursor:pointer;" id="cancelDelBtn">やめる</button> <button style="flex:1; padding:12px; border-radius:10px; border:none; background:#EF4444; color:white; font-weight:700; cursor:pointer;" id="confirmDelBtn">削除する</button> </div>`;
overlay.appendChild(box);
document.body.appendChild(overlay);
document.getElementById('cancelDelBtn').onclick = () => { document.body.removeChild(overlay); };
document.getElementById('confirmDelBtn').onclick = () => {
vocabList = vocabList.filter(w => String(w.num) !== String(numStr));
userStats.delete_count++;
userStats.vocab_reg = vocabList.length;
window.saveUserStats();
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
window.getFlashcardStyleByHistory = function(wordData) {
const cleanKey = wordData.en.toLowerCase().replace(/[.,/#!$%^&*;:{}=-_`~()[]"']/g,"");
const vocabMatch = vocabList.find(v => v.word.toLowerCase() === cleanKey);
let allHistory = [];
 if (vocabMatch) {
     if (vocabMatch.history && vocabMatch.history.length > 0) {
         allHistory = allHistory.concat(vocabMatch.history);
     }
     if (vocabMatch.meanings) {
         vocabMatch.meanings.forEach(m => {
             if(m.history && m.history.length > 0) allHistory = allHistory.concat(m.history);
         });
     }
 } else {
     const memStatus = wordMemory[cleanKey];
     if (memStatus && memStatus !== 'none') {
         allHistory.push(memStatus);
     }
 }
 if (allHistory.length === 0) {
     return "background: radial-gradient(circle at center, rgba(255, 255, 255, 0.04) 0%, #130a24 75%, #090514 100%) !important; border: none !important; box-shadow: none !important;";
 }
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
 return `background: radial-gradient(circle at center, rgba(${r}, ${g}, ${b}, 0.22) 0%, rgba(${r}, ${g}, ${b}, 0.12) 50%, rgba(${r}, ${g}, ${b}, 0) 100%);`;
};
// 🌟 単語ステータス更新（獲得EXPのリアルタイム反映処理）
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
totalExp += 1;
}
        userStats.vocab_fixed = vocabList.filter(w => w.meanings && w.meanings.some(m => m.status === 'ok')).length;
        window.saveUserStats();
        window.checkAndRewardTitleBonusXP();
        window.saveVocabToStorage(); 
        window.renderVocabList();
        window.applyProfileToUi();
        window.renderLeaderboard();
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
window.coreSystemStaticGuideToggle = function(event, btn) {
if(event) event.stopPropagation();
const contentBox = btn.nextElementSibling;
const stateTextLabel = btn.querySelector('.guide-toggle-state-text');
if(contentBox.style.display === 'none' || !contentBox.style.display) {
    contentBox.style.display = 'block';
    if(stateTextLabel) {
        stateTextLabel.innerHTML = `閉じる <i data-lucide="chevron-up" size="12"></i>`;
    }
} else {
    contentBox.style.display = 'none';
    if(stateTextLabel) {
        stateTextLabel.innerHTML = `開く <i data-lucide="chevron-down" size="12"></i>`;
    }
}
window.initLucide();
};
window.toggleInlineWordEdit = function(event, wordNum) {
if(!window.isAdmin) return;
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
window.renderInlineEditFormMeanings = function(wordNum) {
const listContainer = document.getElementById(`inlineEditMeaningsList-${wordNum}`);
if(!listContainer) return;
listContainer.innerHTML = "";
const wEl = vocabList.find(w => String(w.num) === String(wordNum));
if(!wEl || !wEl.meanings) return;
wEl.meanings.forEach((m, index) => {
    const itemRow = document.createElement('div');
    itemRow.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid rgba(255,255,255,0.1); font-size:12px;";
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
window.removeInlineMeaningField = function(event, wordNum, index) {
if(event) event.stopPropagation();
const wEl = vocabList.find(w => String(w.num) === String(wordNum));
if(wEl && wEl.meanings) {
wEl.meanings.splice(index, 1);
window.renderInlineEditFormMeanings(wordNum);
}
};
window.addInlineMeaningField = function(event, wordNum) {
if(event) event.stopPropagation();
const wEl = vocabList.find(w => String(w.num) === String(wordNum));
if(wEl) {
if(!wEl.meanings) wEl.meanings = [];
wEl.meanings.push({ id: `${wordNum}-${Date.now()}`, text: "", status: "none", history: [] });
window.renderInlineEditFormMeanings(wordNum);
}
};
window.saveInlineWordEdit = function(event, wordNum) {
if(event) event.stopPropagation();
const wIdx = vocabList.findIndex(w => String(w.num) === String(wordNum));
if(wIdx === -1) return;
const wordInput = document.getElementById(`inlineEditWordInput-${wordNum}`);
 const subInput = document.getElementById(`inlineEditSubInput-${wordNum}`);
 const mInputs = document.querySelectorAll(`.inline-m-input-${wordNum}`);
 if(wordInput) vocabList[wIdx].word = wordInput.value.trim();
 if(subInput) vocabList[wIdx].sub = subInput.value.trim();
 const updatedMeanings = [];
 mInputs.forEach((inp, idx) => {
     const txt = inp.value.trim();
     if(txt) {
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
 vocabList[wIdx].meaning = updatedMeanings.map((m, i) => updatedMeanings.length > 1 ? `①②③④⑤⑥⑦⑧⑨⑩`[i] + m.text : m.text).join("");
 window.saveVocabToStorage();
 window.renderVocabList();
 alert("単語情報を更新しました！");
};
window.renderVocabList = function() {
const container = document.getElementById('vocabListContainer');
if(!container) return;
container.innerHTML = "";
if(vocabList.length === 0) {
     container.innerHTML = "<div style='text-align:center; padding:40px 20px; color:var(--text-sub); font-size:13px;'>現在、この単語帳には単語が登録されていません。<br>管理者からの単語の配信をお待ちください。</div>";
     return;
 }
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
     let adminActionButtons = "";
     if (window.isAdmin) {
         adminActionButtons = `
             <div style="position:absolute; right:8px; top:8px; display:flex; gap:2px; z-index:100;">
                 <button class="card-edit-btn" style="background:none; border:none; color:var(--text-sub); padding:10px; cursor:pointer;" onclick="window.toggleInlineWordEdit(event, '${w.num}')">
                     <i data-lucide="edit-3" size="18"></i>
                 </button>
                 <button class="card-delete-btn" style="background:none; border:none; color:var(--text-sub); padding:10px; cursor:pointer;" onclick="event.stopPropagation(); window.showCustomDeleteConfirm('${w.num}')">
                     <i data-lucide="trash-2" size="18"></i>
                 </button>
             </div>`;
     }
     card.innerHTML = `
         ${adminActionButtons}
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
                     <div class="sub-info-block" style="background:rgba(0, 0, 0, 0.45); padding:6px 10px; border-radius:6px; font-size:12px; color:#FFF;">${w.sub}</div>
                 </div>
             </div>` : ''}
             <div style="display:flex; justify-content:flex-end; align-items:center; margin-top:12px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.1);">${dotsHtml}</div>
         </div>
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
window.analyzeText = async function(rawText, assignedTitle = null, preParsedData = null) {
if(!rawText) return; currentActiveReaderText = rawText; currentActiveTitle = assignedTitle || "無題のテキスト";
const customJaEl = document.getElementById('customJapanesetextarea');
const customJaLines = customJaEl ? customJaEl.value.trim().split('\n').filter(l => l.trim() !== '') : [];
textHistory = textHistory.filter(h => h.text !== rawText); 
 textHistory.unshift({ id: Date.now(), title: currentActiveTitle, text: rawText });
 localStorage.setItem('textHistory', JSON.stringify(textHistory)); window.renderHistoryList();
 document.getElementById('text-input-view').style.display = 'none'; document.getElementById('text-reader-view').style.display = 'block';
 const englishContainer = document.getElementById('englishContainer'); 
 englishContainer.innerHTML = '<div style="text-align:center; padding: 60px 20px; color: var(--cosmic-cyan); font-weight: bold; font-size: 16px; display:flex; flex-direction:column; align-items:center;"><i data-lucide="loader" class="animate-spin" size="36" style="margin-bottom:16px;"></i><span>🌀 AI構文解析・全文要約取得中...</span></div>';
 const abstractCard = document.getElementById('summary-abstract-card');
 const abstractContainer = document.getElementById('summaryAbstractContainer');
 if (abstractCard) abstractCard.style.display = 'none';
 if (abstractContainer) abstractContainer.innerText = "要約データを生成しています...";
 window.initLucide();
 let aiAnalysisResult = null;
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
 const safeTextForBtn = rawText.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
 const safeTitleForBtn = currentActiveTitle ? currentActiveTitle.replace(/'/g, "\\'").replace(/"/g, "&quot;") : "無題";
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
 if (aiAnalysisResult && aiAnalysisResult.fullSummaryAbstract) {
     if (abstractContainer) abstractContainer.innerText = aiAnalysisResult.fullSummaryAbstract;
     if (abstractCard) abstractCard.style.display = 'block';
 }
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
             const vocabMatch = window.findVocabByToken(cleanKey);
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
window.showCustomSaveBookshelfPrompt = function(text, title) {
if(document.getElementById('saveBookshelfOverlay')) return;
const overlay = document.createElement('div');
overlay.id = 'saveBookshelfOverlay';
overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);";
const box = document.createElement('div');
box.style.cssText = "background:var(--card-bg); border:1px solid var(--cosmic-cyan); border-radius:16px; padding:24px; width:85%; max-width:320px; text-align:center; box-shadow: 0 10px 30px rgba(0,0,0,0.6);";
let folderOptions = myFolders.map(f => `<option value="${f}">${f}</option>`).join('');
box.innerHTML = `<div style="color:white; font-size:18px; font-weight:800; margin-bottom:12px;">📁 本棚に保存</div> <select id="selectBookshelfFolder" class="search-input" style="width:100%; margin-bottom:12px;">${folderOptions}<option value="new_folder">➕ 新しいフォルダを作成</option></select> <input type="text" id="newFolderNameInput" class="search-input" placeholder="新しいフォルダ名を入力" style="display:none; width:100%; margin-bottom:16px;"> <div style="display:flex; gap:12px; margin-top: 12px;"> <button style="flex:1; padding:12px; border-radius:10px; border:none; background:var(--input-bg); color:var(--text-main); font-weight:700; cursor:pointer;" id="cancelSaveBookshelfBtn">キャンセル</button> <button style="flex:1; padding:12px; border-radius:10px; border:none; background:var(--cosmic-cyan); color:#000; font-weight:700; cursor:pointer;" id="confirmSaveBookshelfBtn">保存</button> </div>`;
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
    myBookshelf.push({ 
        id: Date.now(), 
        folder: folder, 
        title: title || "無題", 
        text: text,
        aiAnalysisData: currentActiveAiAnalysisCache ? JSON.parse(JSON.stringify(currentActiveAiAnalysisCache)) : null
    });
    localStorage.setItem('myBookshelf', JSON.stringify(myBookshelf)); alert(`保存しました！`); window.renderBookshelf(); document.body.removeChild(overlay);
};
};
window.renderBookshelf = function() {
const container = document.getElementById('myBookshelfContainer'); if(!container) return; container.innerHTML = "";
if(myBookshelf.length === 0) { container.innerHTML = `<div style="text-align:center; color:var(--text-sub); font-size:12px; padding:20px;">本棚は空です。</div>`; return; }
const foldersData = {};
myBookshelf.forEach(item => { if(!foldersData[item.folder]) foldersData[item.folder] = []; foldersData[item.folder].push(item); });
for(let folderName in foldersData) {
let folderHtml = `<div style="margin-bottom:20px; background:rgba(0,0,0,0.2); border-radius:12px; padding:12px; border:1px solid rgba(255,255,255,0.15);"> <h3 style="color:var(--cosmic-cyan); font-size:15px; border-bottom:1px dashed rgba(0,240,255,0.3); padding-bottom:6px; margin-top:0; margin-bottom:12px; display:flex; align-items:center; gap:6px;"><i data-lucide="folder" size="16"></i> ${folderName}</h3>`;
foldersData[folderName].forEach(item => {
const safeText = item.text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
const safeTitle = item.title ? item.title.replace(/'/g, "\\'").replace(/"/g, "&quot;") : "無題";
        let itemIndex = myBookshelf.findIndex(b => b.id === item.id);
        let parseCallParam = item.aiAnalysisData ? `myBookshelf[${itemIndex}].aiAnalysisData` : 'null';
        folderHtml += `
            <div class="list-item-row" style="background:rgba(255,255,255,0.05); padding:10px 14px; border-radius:8px; margin-bottom:8px;">
                <div class="list-item-title" style="flex:1;"><span><i data-lucide="file-text" size="12" style="color:var(--text-sub); margin-right:4px;"></i>${item.title}</span></div>
                <div style="display:flex; gap:8px;">
                    <button class="list-action-link" onclick="window.analyzeText(\`${safeText}\`, '${safeTitle}', ${parseCallParam})">開く</button>
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
row.innerHTML = `<div class="list-item-title"><span>${h.title}</span></div> <div style="display:flex; gap:8px;"> <button class="list-action-link" onclick="window.analyzeText(\`${safeText}\`, '${safeTitle}')">開く</button> <button class="word-delete-btn" style="display:flex !important; background:none; border:none; color:var(--text-sub); padding:4px; cursor:pointer;" onclick="event.stopPropagation(); event.preventDefault(); window.showCustomDeleteHistoryConfirm('${h.id}')"><i data-lucide="trash-2" size="14"></i></button> </div>`;
container.appendChild(row);
});
window.initLucide();
};
window.updateReaderWordColors = function() {
document.querySelectorAll('.word-span').forEach(span => {
let text = span.innerText.trim();
let cleanKey = text.toLowerCase().replace(/[.,/#!$%^&*;:{}=-_`~()[]"']/g,"");
if(!cleanKey) return;
    span.classList.remove('status-ok', 'status-so', 'status-bad', 'status-none');
     const vocabMatch = window.findVocabByToken(cleanKey);
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
    totalExp += 1;
    window.saveUserStats();
    window.updateReaderWordColors(); 
}
window.checkAndRewardTitleBonusXP();
window.applyProfileToUi();
window.renderLeaderboard();
window.closeWordPopover();
};
window.closeWordPopover = function() { document.getElementById('wordPopover').classList.remove('show'); document.getElementById('wordPopover').style.display = 'none'; };
window.closeReader = function() { document.getElementById('text-input-view').style.display = 'block'; document.getElementById('text-reader-view').style.display = 'none'; currentActiveAiAnalysisCache = null; };
window.setTranslationMode = function(mode) {
currentTranslationMode = mode;
document.getElementById('toggle-inline').classList.toggle('active', mode === 'inline'); document.getElementById('toggle-bottom').classList.toggle('active', mode === 'bottom');
document.querySelectorAll('.sentence-ja').forEach(el => el.style.display = mode === 'inline' ? 'block' : 'none');
document.getElementById('summary-ja-card').style.display = mode === 'bottom' ? 'block' : 'none';
const abstractCard = document.getElementById('summary-abstract-card');
if (abstractCard && document.getElementById('summaryAbstractContainer').innerText !== "要約データを生成しています...") {
abstractCard.style.display = 'block';
}
};
window.renderActivityChart = function() {
const chart = document.getElementById('activityBarChart');
if(!chart) return;
chart.innerHTML = "";
const now = new Date();
 let currentDayIdx = now.getDay() - 1; 
 if(currentDayIdx < 0) currentDayIdx = 6; 
 const currentTodayMinutes = todayStudySeconds / 60;
 weeklyStudyMinutesLog[currentDayIdx] = currentTodayMinutes;
 const daysLabels = ["月", "火", "水", "木", "金", "土", "日"];
 daysLabels.forEach((d, idx) => {
     const wrap = document.createElement('div'); 
     wrap.className = "bar-wrapper";
     wrap.style.cssText = "display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; flex: 1; min-width: 0;";
     let rawMin = weeklyStudyMinutesLog[idx] || 0;
     let fillHeightPercent = Math.min(100, Math.max(4, Math.round((rawMin / 60) * 100)));
     const fill = document.createElement('div'); 
     fill.className = "bar-fill active"; 
     fill.style.height = `${fillHeightPercent}%`;
     const valLbl = document.createElement('div'); 
     valLbl.style.cssText = "font-size: 8px; font-weight: 700; color: #FFFFFF; margin-bottom: 2px; white-space: nowrap;";
     valLbl.innerText = `${Math.floor(rawMin)}分`;
     const lbl = document.createElement('div'); 
     lbl.style.cssText = "font-size: 10px; color: var(--text-sub); margin-top: 4px; font-weight: bold;";
     lbl.innerText = d;
     wrap.appendChild(valLbl);
     wrap.appendChild(fill); 
     wrap.appendChild(lbl); 
     chart.appendChild(wrap);
 });
};
window.initStudyTimerAndDataRotation = function() {
const now = new Date();
const todayStr = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`;
if (lastAccessDateStr && lastAccessDateStr !== todayStr) {
     let oldDate = new Date(lastAccessDateStr);
     let oldDayIdx = oldDate.getDay() - 1;
     if(oldDayIdx < 0) oldDayIdx = 6;
     weeklyStudyMinutesLog[oldDayIdx] = todayStudySeconds / 60;
     localStorage.setItem('core_v4_study_weekly_log', JSON.stringify(weeklyStudyMinutesLog));
     todayStudySeconds = 0;
     localStorage.setItem('core_v4_study_today_secs', "0");
 }
 lastAccessDateStr = todayStr;
 localStorage.setItem('core_v4_study_last_date', todayStr);
 setInterval(() => {
     let shouldCount = false;
     if (currentActiveTabId === "vocab" || currentActiveTabId === "reader") {
         shouldCount = true;
     }
     else if (currentActiveTabId === "game") {
         const isFcardPlay = (document.getElementById('flashcard-play-screen') && document.getElementById('flashcard-play-screen').style.display === 'flex');
         const isSoloPlay = (document.getElementById('game-play-screen') && document.getElementById('game-play-screen').style.display === 'block');
         const isMultiPlay = (document.getElementById('multi-battle-play-screen') && document.getElementById('multi-battle-play-screen').style.display === 'flex');
         if (isFcardPlay || isSoloPlay || isMultiPlay) {
             shouldCount = true;
         }
     }
     if (shouldCount) {
         todayStudySeconds++;
         localStorage.setItem('core_v4_study_today_secs', String(todayStudySeconds));
         const currentMin = Math.floor(todayStudySeconds / 60);
         if (currentMin > userStats.study_burst) {
             userStats.study_burst = currentMin; 
             window.saveUserStats();
             window.checkAndRewardTitleBonusXP();
         }
         const minStr = String(currentMin).padStart(2, '0');
         const secStr = String(todayStudySeconds % 60).padStart(2, '0');
         const timeDisplayEl = document.getElementById('todayStudyTimeDisplay');
         if (timeDisplayEl) {
             timeDisplayEl.innerText = `${minStr}分${secStr}秒`;
         }
         window.renderActivityChart();
     }
 }, 1000);
 const minStr = String(Math.floor(todayStudySeconds / 60)).padStart(2, '0');
 const secStr = String(todayStudySeconds % 60).padStart(2, '0');
 const timeDisplayEl = document.getElementById('todayStudyTimeDisplay');
 if (timeDisplayEl) {
     timeDisplayEl.innerText = `${minStr}分${secStr}秒`;
 }
 window.renderActivityChart();
};
// 🌟 修正：実在ユーザー厳格判定＆本物プロフィール・アイコン取得フレンド追加処理
window.searchAndAddFriend = async function() {
const inputEl = document.getElementById('friendSearchInput');
if (!inputEl) return;
const targetCode = inputEl.value.trim().toUpperCase();
if (!targetCode) {
     alert("追加したい相手のIDコードを入力してください。");
     return;
 }
 if (targetCode === myId) {
     alert("自分自身のコードを追加することはできません。");
     return;
 }
 if (myFriendList.some(f => f.code === targetCode)) {
     alert("このフレンドは既に登録されています！");
     return;
 }
 if (window.db && window.fbGetDoc && window.fbDoc) {
     try {
         const targetUserRef = window.fbDoc(window.db, "users", targetCode);
         const targetUserSnap = await window.fbGetDoc(targetUserRef);
         // 存在しないアカウントは確実に拒否
         if (!targetUserSnap.exists()) {
             alert("指定されたIDコードを持つ修行者はシステム上に存在しません！");
             return;
         }
         const tData = targetUserSnap.data();
         if (tData.deleted) {
             alert("指定されたIDコードを持つ修行者はシステム上に存在しません！");
             return;
         }
         let remoteLvl = 1;
         let remoteStats = tData.userStats || {};
         if (remoteStats.user_level) {
             remoteLvl = remoteStats.user_level;
         } else if (tData.totalExp) {
             let calculated = window.calculateLevelFromExp(tData.totalExp);
             remoteLvl = calculated.level;
         }
         const now = new Date();
         const y = now.getFullYear();
         const m = String(now.getMonth() + 1).padStart(2, '0');
         const d = String(now.getDate()).padStart(2, '0');
         const hh = String(now.getHours()).padStart(2, '0');
         const mm = String(now.getMinutes()).padStart(2, '0');
         const loginStr = `${y}/${m}/${d} ${hh}:${mm}`;
         let realPlayerName = tData.playerName || tData.realName || null;
         if (!realPlayerName) {
             const allUsers = await window.getAllUsers();
             const matchedUser = allUsers.find(u => u.id === targetCode);
             if (matchedUser) {
                 realPlayerName = matchedUser.playerName || matchedUser.realName || null;
             }
         }
         if (!realPlayerName || realPlayerName === targetCode) {
             alert("指定されたIDコードを持つ修行者はシステム上に存在しません！");
             return;
         }
         const newFriend = {
             code: targetCode,
             name: realPlayerName,
             title: tData.selectedTitle || "称号なし",
             avatar: "👤",
             customAvatar: tData.avatar || "", 
             level: remoteLvl,
             studyTime: remoteStats.study_burst || 0,
             lastLoginStr: loginStr,
             timestamp: now.getTime() 
         };
         myFriendList.push(newFriend);
         userStats.friends_count = myFriendList.length;
         await window.saveUserStats();
         window.checkAndRewardTitleBonusXP();
         alert(`🎉 フレンド「${newFriend.name}」の追加に成功しました！`);
         inputEl.value = "";
         window.sortAndRenderFriendList();
     } catch(e) {
         console.error("フレンド検索通信エラー:", e);
         alert("通信エラーが発生しました。時間を置いて再度お試しください。");
     }
 } else {
     alert("Firebaseが接続されていないため、ユーザーの検索ができません。");
 }
};
window.sortAndRenderFriendList = function() {
const container = document.getElementById('friendListContainer');
if (!container) return;
container.innerHTML = "";
if (myFriendList.length === 0) {
     container.innerHTML = `
         <div style="text-align:center; padding:30px; color:var(--text-sub); font-size:12px;">
             <i data-lucide="user-plus" size="24" style="margin-bottom:6px; opacity:0.5;"></i><br>
             まだフレンドが登録されていません。<br>上部からIDで検索して追加してみましょう！
         </div>`;
     window.initLucide();
     return;
 }
 const sortType = document.getElementById('friendSortSelect').value;
 let sortedList = [...myFriendList];
 if (sortType === "login") {
     sortedList.sort((a, b) => b.timestamp - a.timestamp); 
 } else if (sortType === "level") {
     sortedList.sort((a, b) => b.level - a.level); 
 } else if (sortType === "studyTime") {
     sortedList.sort((a, b) => b.studyTime - a.studyTime); 
 }
 sortedList.forEach(f => {
     const item = document.createElement('div');
     item.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:var(--card-bg); border:1px solid var(--border); border-radius:12px; padding:10px 14px; box-shadow:0 4px 10px rgba(0,0,0,0.2);";
     let avatarContentStr = `<span style="font-size:24px; flex-shrink:0;">${f.avatar || "👤"}</span>`;
     if (f.customAvatar) {
         avatarContentStr = `<img src="${f.customAvatar}" style="width:36px; height:36px; border-radius:50%; object-fit:cover; border:1px solid var(--cosmic-purple-light);">`;
     }
     item.innerHTML = `
         <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
             <div style="width:36px; height:36px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${avatarContentStr}</div>
             <div style="flex:1; min-width:0;">
                 <div style="display:flex; align-items:baseline; gap:6px;">
                     <span style="font-weight:bold; color:white; font-size:13.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${f.name}</span>
                     <span style="font-size:10px; font-weight:900; color:var(--cosmic-cyan); flex-shrink:0;">LV.${f.level}</span>
                 </div>
                 <div style="font-size:10px; color:var(--text-sub); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:1px;">${f.title}</div>
                 <div style="font-size:9px; color:rgba(255,255,255,0.4); margin-top:3px; display:flex; gap:10px;">
                     <span>⏱️ 勉強時間: <strong style="color:white;">${f.studyTime}分</strong></span>
                     <span>🔑 ID: ${f.code}</span>
                 </div>
             </div>
         </div>
         <div style="text-align:right; flex-shrink:0; margin-left:8px; display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
             <div style="font-size:9px; color:var(--text-sub); margin-top:0;">ログイン:<br><span style="color:#FFF; font-weight:600;">${f.lastLoginStr ? f.lastLoginStr.split(' ')[0] : '-'}</span></div>
             <button style="background:none; border:none; color:var(--word-bad); padding:2px; cursor:pointer;" onclick="window.removeFriendDirect('${f.code}', event)"><i data-lucide="user-x" size="14"></i></button>
         </div>`;
     container.appendChild(item);
 });
 window.initLucide();
};
window.removeFriendDirect = async function(code, event) {
if(event) event.stopPropagation();
if (confirm("このフレンドをリストから削除しますか？")) {
myFriendList = myFriendList.filter(f => f.code !== code);
userStats.friends_count = myFriendList.length;
await window.saveUserStats();
    window.checkAndRewardTitleBonusXP();
    window.sortAndRenderFriendList();
    window.applyProfileToUi();
}
};
// 🌟 プロフィール保存処理（Firebaseへ即時リアルタイム反映）
window.saveSidebarProfile = async function() {
geminiApiKey = document.getElementById('sidebarApiKeyInput').value.trim(); localStorage.setItem('core_v4_geminiKey', geminiApiKey);
myName = document.getElementById('sideInputName').value.trim() || myName; myTarget = document.getElementById('sideInputTarget').value.trim() || myTarget;
selectedTitle = document.getElementById('sideSelectTitle').value;
localStorage.setItem('core_v4_userName', myName);
 localStorage.setItem('core_v4_userTarget', myTarget);
 localStorage.setItem('core_v4_userTitle', selectedTitle);
 const noticeInput = document.getElementById('adminNoticeInput');
 if (noticeInput) {
     const noticeMsg = noticeInput.value.trim();
     localStorage.setItem('core_v4_admin_notice', noticeMsg);
     const noticeFrame = document.getElementById('adminNoticeDisplayFrame');
     const noticeBody = document.getElementById('adminNoticeTextContent');
     if (noticeFrame && noticeBody) {
         if (noticeMsg !== "") {
             noticeBody.innerText = noticeMsg;
             noticeFrame.style.display = 'block';
         } else {
             noticeFrame.style.display = 'none';
         }
     }
 }
 userStats.goal_text = myTarget;
 await window.saveUserStats();
 window.applyProfileToUi(); 
 window.toggleSidebar(false);
 window.checkAndRewardTitleBonusXP();
 window.renderLeaderboard(); 
 alert("プロフィールを最新状態に同期・保存しました！");
};
window.renderTitles = function() {
const listContainer = document.getElementById('titles-list');
const selectEl = document.getElementById('sideSelectTitle');
if (!listContainer) return;
listContainer.innerHTML = "";
 if (selectEl) {
     selectEl.innerHTML = `<option value="称号なし">称号なし</option>`;
 }
 let unlockedCount = 0;
 let totalPossible = 0;
 TITLE_DATABASE.forEach(title => {
     const val = userStats[title.id] || 0;
     let reachedStep = 0;
     title.steps.forEach((target, idx) => {
         if (val >= target) {
             reachedStep = idx + 1;
         }
     });
     unlockedCount += reachedStep;
     totalPossible += 5;
     const card = document.createElement('div');
     card.className = "word-row-container";
     card.style.cssText = "border-radius: 12px; padding: 14px; margin-bottom: 10px; border: 1.5px solid rgba(255,255,255,0.15); background: rgba(30, 41, 59, 0.85); box-sizing: border-box;";
     let badgeHTML = `<span class="badge-common" style="padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; border: 1px solid #4b5563;">未解放</span>`;
     let activeFullTitle = "";
     if (reachedStep > 0) {
         const rarity = RARITY_MAP[reachedStep - 1];
         badgeHTML = `<span class="${rarity.class}" style="padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-shadow: 0 0 5px rgba(0,0,0,0.5);">${rarity.name} (段階 ${reachedStep})</span>`;
         activeFullTitle = `【${rarity.name}】${title.name}`;
         if (selectEl) {
             const opt = document.createElement('option');
             opt.value = activeFullTitle;
             opt.innerText = activeFullTitle;
             selectEl.appendChild(opt);
         }
     }
     const isEquipped = selectedTitle === activeFullTitle && reachedStep > 0;
     const targetVal = reachedStep === 5 ? "MAX" : title.steps[reachedStep];
     card.innerHTML = `
         <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
             <div style="font-weight:900; font-size:16px; color:#ffffff;">${title.name}</div>
             <div>${badgeHTML}</div>
         </div>
         <div style="font-size:12.5px; color:#FFFFFF; margin-bottom:8px; font-weight:700;">
             現在の進捗状況: <span style="color:var(--cosmic-cyan); font-weight:900;">${val}</span> / 次の段階目標値: ${targetVal}${title.unit}
         </div>
         <div style="font-size:11px; color:rgba(255,255,255,0.85); font-weight:600; margin-bottom:12px; line-height:1.4; background:rgba(0,0,0,0.25); padding:6px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.05);">
             📊 課題内容: ${title.desc}<br>
             📈 進化段階ライン: ${title.steps.join(' ➔ ')} (${title.unit})
         </div>
         ${reachedStep > 0 ? 
             `<button class="modern-btn" style="height: 34px; font-size:11px; background:${isEquipped ? 'var(--word-ok-bg) !important' : 'rgba(0,0,0,0.3) !important'}; border-color:${isEquipped ? 'var(--word-ok)' : 'var(--border)'} !important; color:${isEquipped ? 'var(--word-ok)' : 'white'} !important; box-shadow: none !important;" onclick="equipTitle('${activeFullTitle}')">
                 ${isEquipped ? 'セット中' : '称号をセットする'}
             </button>` : 
             `<button class="modern-btn" style="height: 34px; font-size:11px; background: rgba(0,0,0,0.5) !important; color:var(--text-sub) !important; border-color:var(--border) !important; box-shadow: none !important; cursor: not-allowed;" disabled>条件未達成</button>`
         }
     `;
     listContainer.appendChild(card);
 });
 SPECIAL_TITLES.forEach(title => {
     const isUnlocked = title.check();
     totalPossible += 1;
     if (isUnlocked) unlockedCount += 1;
     const card = document.createElement('div');
     card.className = "word-row-container";
     card.style.cssText = "border-radius: 12px; padding: 14px; margin-bottom: 10px; border: 1.5px solid #F59E0B; background: linear-gradient(135deg, rgba(245,158,11,0.05) 0%, rgba(30,41,59,0.9) 100%); box-sizing: border-box;";
     const activeFullTitle = `【特別】${title.name}`;
     if (isUnlocked) {
         let badgeHTML = `<span class="badge-legendary" style="padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">レジェンダリー</span>`;
         if (selectEl) {
             const opt = document.createElement('option');
             opt.value = activeFullTitle;
             opt.innerText = activeFullTitle;
             selectEl.appendChild(opt);
         }
         const isEquipped = selectedTitle === activeFullTitle;
         card.innerHTML = `
             <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                 <div style="font-weight:900; font-size:16px; color:#f59e0b; text-shadow:0 0 10px rgba(245,158,11,0.4);"><i data-lucide="sparkles" size="14" style="vertical-align:middle; margin-right:4px;"></i>${title.name}</div>
                 <div>${badgeHTML}</div>
             </div>
             <div style="font-size:12.5px; color:#FFFFFF; font-weight:700; margin-bottom:12px; background:rgba(0,0,0,0.25); padding:6px 10px; border-radius:6px; border:1px solid rgba(245,158,11,0.2);">
                 👑 解放達成条件: ${title.desc}
             </div>
             <button class="modern-btn" style="height: 34px; font-size:11px; background:${isEquipped ? 'var(--word-ok-bg) !important' : 'rgba(0,0,0,0.3) !important'}; border-color:${isEquipped ? 'var(--word-ok)' : '#F59E0B'} !important; color:${isEquipped ? 'var(--word-ok)' : 'white'} !important; box-shadow: none !important;" onclick="equipTitle('${activeFullTitle}')">
                 ${isEquipped ? 'セット中' : '称号をセットする'}
             </button>
         `;
     } else {
         card.innerHTML = `
             <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                 <div style="font-weight:900; font-size:16px; color:rgba(255,255,255,0.25); font-style:italic;">🔒 未知のシークレット称号</div>
                 <div><span class="badge-common" style="padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; border: 1px solid #4b5563; background:rgba(0,0,0,0.4);">???</span></div>
             </div>
             <div style="font-size:11.5px; color:rgba(255,255,255,0.4); font-weight:500; line-height:1.4; text-align:center; padding:10px 0;">
                 🕵️‍♂️ 隠された特定のミッションをクリアするとロックが解除されます。
             </div>
             <button class="modern-btn" style="height: 34px; font-size:11px; background: rgba(0,0,0,0.5) !important; color:var(--text-sub) !important; border-color:var(--border) !important; box-shadow: none !important; cursor: not-allowed;" disabled>🔒 封印中</button>
         `;
     }
     listContainer.appendChild(card);
 });
 if (selectEl) {
     selectEl.value = selectedTitle;
 }
 const percent = totalPossible > 0 ? Math.round((unlockedCount / totalPossible) * 100) : 0;
 const progressTextEl = document.getElementById('title-progress-text');
 const progressBarEl = document.getElementById('title-progress-bar');
 if (progressTextEl) progressTextEl.innerText = `${unlockedCount} / ${totalPossible}個 (${percent}%)`;
 if (progressBarEl) progressBarEl.style.width = `${percent}%`;
 const equippedDisplayEl = document.getElementById('equipped-title-display');
 if (equippedDisplayEl) {
     equippedDisplayEl.innerText = selectedTitle ? selectedTitle : "（未装備）";
 }
 window.initLucide();
};
window.equipTitle = function(titleName) {
selectedTitle = titleName;
localStorage.setItem('core_v4_userTitle', titleName);
window.saveUserStats();
window.applyProfileToUi();
window.renderTitles();
alert(`称号「${titleName}」を装備しました！`);
};
window.unequipTitle = function() {
selectedTitle = "称号なし";
localStorage.setItem('core_v4_userTitle', "称号なし");
window.saveUserStats();
window.applyProfileToUi();
window.renderTitles();
};
window.enterAdminModeDirect = function() {
const overlay = document.getElementById('adminPassOverlay');
const input = document.getElementById('adminPassInput');
if (overlay && input) {
input.value = ""; overlay.style.display = 'flex'; input.focus();
} else {
const pass = prompt("管理者専用アクセスです。\nパスワードを入力してください。");
if (pass === "tukinokopanda" || pass === "tutinokopanda") {
window.isAdmin = true;
window.renderVocabList();
window.switchTab('admin');
}
else if (pass !== null) { alert("⚠️ パスワードが違います。アクセスが拒否されました。"); }
}
};
window.checkAdminPassword = function() {
const input = document.getElementById('adminPassInput');
const overlay = document.getElementById('adminPassOverlay');
if (input && (input.value === "tukinokopanda" || input.value === "tutinokopanda")) {
window.isAdmin = true;
overlay.style.display = 'none';
window.renderVocabList();
window.switchTab('admin');
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
window.logoutToGate = function() { localStorage.clear(); location.reload(); };
window.resetLeaderboard = function() { if(confirm("ランキング履歴を一括で削除しますか？")) { ['ja2en', 'en2ja', 'mixed'].forEach(m => { ['endless'].forEach(d => { localStorage.removeItem(`cosmic_score_${m}_${d}`); }); }); window.renderGameLeaderboard('mine'); } };
window.resetBestScore = function() { if(confirm("ベストスコアを0に戻しますか？")) { ['ja2en', 'en2ja', 'mixed'].forEach(m => { ['endless'].forEach(d => { localStorage.removeItem(`cosmic_best_${m}_${d}`); }); }); } };
window.resetScorePopup = function(popupEl) { popupEl.className = "giant-score-popup"; void popupEl.offsetWidth; };
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
window.renderGameLeaderboard = function() {
const container = document.getElementById('leaderboardListContainer'); if(!container) return; container.innerHTML = "";
const keyHistory = `cosmic_score_${currentLbMode}_endless`; 
 let history = JSON.parse(localStorage.getItem(keyHistory) || "[]");
 let myBestScoreCurrent = history.length > 0 ? history[0].score : 0;
 let gameRankings = [];
 if (myBestScoreCurrent > 0) {
     gameRankings.push({
         name: `${myName} (あなた)`,
         score: myBestScoreCurrent,
         date: history.length > 0 ? history[0].date : "記録なし",
         isMe: true
     });
 }
 gameRankings.sort((a, b) => b.score - a.score);
 const rankColors = ["#FBBF24", "#94A3B8", "#D97706", "white", "white", "white"];
 gameRankings.forEach((record, index) => {
     const row = document.createElement('div');
     let bgStyle = record.isMe ? "background: linear-gradient(135deg, rgba(192, 132, 252, 0.15) 0%, rgba(15, 23, 42, 0.6) 100%); border-left: 3px solid var(--cosmic-purple-light);" : "border-bottom:1px solid rgba(255,255,255,0.05);";
     row.style.cssText = `display:flex; justify-content:space-between; align-items:center; padding:6px 8px; ${bgStyle}`;
     row.innerHTML = `
         <div style="display:flex; gap:12px; align-items:center;">
             <span style="color:${rankColors[index] || 'white'}; font-weight:900; font-size:14px; width:18px; text-align:center;">${index + 1}</span>
             <span style="color:white; font-weight:800; letter-spacing:0.5px;">${record.name}</span>
         </div>
         <div style="text-align:right;">
             <span style="color:var(--cosmic-cyan); font-weight:900; font-family:monospace; font-size:13px; margin-right:8px;">${record.score} <span style="font-size:8px; font-weight:normal; color:var(--text-sub);">PTS</span></span>
             <span style="color:var(--text-sub); font-size:9px; display:block; margin-top:1px;">${record.date}</span>
         </div>`;
     container.appendChild(row);
 });
};
// ==========================================================================
// 🎮 フラッシュカード（単語フラッシュ）制御モジュール
// ==========================================================================
window.updateFlashcardSourceSelectOptions = function() {
const select = document.getElementById('flashcardSourceSelect');
if (!select) return;
select.innerHTML = "";
if(textbooksPool.length === 0) {
select.innerHTML = "<option value=''>配信中の教材なし</option>";
return;
}
textbooksPool.forEach(book => {
const opt = document.createElement('option');
opt.value = book.id;
opt.innerText = book.name;
if (book.id === currentTextbook) {
opt.selected = true;
}
select.appendChild(opt);
});
};
window.showFlashcardSetupScreen = function() {
const startScreen = document.getElementById('game-start-screen'); if (startScreen) startScreen.style.display = 'none';
const lbArea = document.getElementById('gameLeaderboardArea'); if (lbArea) lbArea.style.display = 'none';
document.getElementById('flashcard-setup-screen').style.display = 'block';
window.updateFlashcardSourceSelectOptions();
window.setFlashcardDirection('en2ja');
window.applyVocabMaxRange();
};
window.setFlashcardDirection = function(mode) {
flashcardDirectionMode = mode;
document.getElementById('btnCardEn2Ja').classList.toggle('active', mode === 'en2ja');
document.getElementById('btnCardJa2en').classList.toggle('active', mode === 'ja2en');
};
window.backToGameMenuFromCardSetup = function() {
document.getElementById('flashcard-setup-screen').style.display = 'none';
const startScreen = document.getElementById('game-start-screen'); if (startScreen) startScreen.style.display = 'flex';
const lbArea = document.getElementById('gameLeaderboardArea'); if (lbArea) lbArea.style.display = 'flex';
};
window.startFlashcardSession = function() {
const startNum = parseInt(document.getElementById('flashcardRangeStart').value) || 1;
const endNum = parseInt(document.getElementById('flashcardRangeEnd').value) || 100;
const sourceSelector = document.getElementById('flashcardSourceSelect');
 if (sourceSelector) {
     flashcardDataSourceMode = sourceSelector.value;
 }
 let pool = [];
 pool = vocabList.filter(w => {
     let n = parseInt(w.num);
     return n >= startNum && n <= endNum;
 }).map(w => ({ num: w.num, en: w.word, ja: w.meanings && w.meanings[0] ? w.meanings[0].text : w.meaning }));
 if (pool.length === 0) {
     alert("指定された範囲または教材にデータが存在しません。単語登録を確認してください。");
     return;
 }
 flashcardOriginQueue = [...pool].sort(() => Math.random() - 0.5);
 flashcardCurrentIndex = 0;
 flashcardLearnedCount = 0;
 flashcardSessionHistory = [];
 document.getElementById('flashcard-setup-screen').style.display = 'none';
 document.getElementById('flashcard-play-screen').style.display = 'flex';
 document.body.classList.add('in-game-active');
 let rightEdge = document.getElementById('fcEdgeRippleRight');
 if(!rightEdge) {
     rightEdge = document.createElement('div'); rightEdge.id = 'fcEdgeRippleRight'; rightEdge.className = 'flashcard-edge-ripple edge-right';
     document.body.appendChild(rightEdge);
 }
 let leftEdge = document.getElementById('fcEdgeRippleLeft');
 if(!leftEdge) {
     leftEdge = document.createElement('div'); leftEdge.id = 'fcEdgeRippleLeft'; leftEdge.className = 'flashcard-edge-ripple edge-left';
     document.body.appendChild(leftEdge);
 }
 let topEdge = document.getElementById('fcEdgeRippleTop');
 if(!topEdge) {
     topEdge = document.createElement('div'); topEdge.id = 'fcEdgeRippleTop'; topEdge.className = 'flashcard-edge-ripple edge-top';
     document.body.appendChild(topEdge);
 }
 window.renderFlashcardDeck();
};
window.renderFlashcardHistoryBubbles = function(wordData) {
const container = document.getElementById('fcHistoryContainer');
if (!container) return;
container.innerHTML = "";
const cleanKey = wordData.en.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]\"']/g,"");
 const vocabMatch = vocabList.find(v => v.word.toLowerCase() === cleanKey);
 let targetHistory = [];
 if (vocabMatch) {
     if (vocabMatch.history && vocabMatch.history.length > 0) {
         targetHistory = targetHistory.concat(vocabMatch.history);
     } else if (vocabMatch.status && vocabMatch.status !== 'none') {
         targetHistory.push(vocabMatch.status);
     }
 } else {
     const memStatus = wordMemory[cleanKey];
     if (memStatus && memStatus !== 'none') {
         targetHistory.push(memStatus);
     }
 }
 let displayList = targetHistory.slice(-5);
 while (displayList.length < 5) {
     displayList.unshift('none');
 }
 displayList.forEach(status => {
     const bubble = document.createElement('div');
     bubble.className = "fc-history-bubble";
     if (status !== 'none') {
         bubble.classList.add(status);
     }
     container.appendChild(bubble);
 });
};
window.createFlickTrailParticle = function(x, y, type) {
const stage = document.getElementById('flashcard-play-screen');
if (!stage) return;
const p = document.createElement('div');
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
 setTimeout(() => {
     p.style.transform = "translate(" + ((Math.random() - 0.5) * 40) + "px, " + (-60 - Math.random() * 40) + "px) scale(0)";
     p.style.opacity = '0';
 }, 10);
 setTimeout(() => { p.remove(); }, 850);
};
window.renderFlashcardDeck = function() {
const stage = document.getElementById('flashcardDeckStage');
if (!stage) return;
stage.innerHTML = "";
const remaining = flashcardOriginQueue.length - flashcardCurrentIndex;
 document.getElementById('flashcardRemainingBadge').innerText = `残り ${remaining}枚`;
 let progressPercent = flashcardOriginQueue.length > 0 ? Math.round((flashcardLearnedCount / flashcardOriginQueue.length) * 100) : 0;
 document.getElementById('flashcardProgressText').innerText = `表示中の覚えた単語: ${progressPercent}%`;
 if (remaining <= 0) {
     alert(`🎉 カードの試練達成！\n習得単語数: ${flashcardLearnedCount} / ${flashcardOriginQueue.length}`);
     window.quitFlashcardSession();
     return;
 }
 const wordData = flashcardOriginQueue[flashcardCurrentIndex];
 window.renderFlashcardHistoryBubbles(wordData);
 const cardWrap = document.createElement('div');
 cardWrap.className = "flashcard-wrapper-3d";
 cardWrap.id = "activeFlashcard";
 const customStyle = window.getFlashcardStyleByHistory(wordData);
 const liveRipple = document.createElement('div');
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
 }, {passive: true});
 cardWrap.addEventListener('touchmove', function(e) {
     if (!isCardFlicking) return;
     let dx = e.touches[0].clientX - cardTouchStartX;
     let dy = e.touches[0].clientY - cardTouchStartY;
     cardWrap.style.transform = "translate3d(" + dx + "px, " + dy + "px, 0) rotate(" + (dx * 0.05) + "deg)";
     let distance = Math.sqrt(dx * dx + dy * dy);
     let ratio = Math.min(distance / 130, 1); 
     let fluidOpacity = Math.pow(ratio, 2.2) * 0.45;
     if (Math.random() < 0.35) {
         window.createFlickTrailParticle(e.touches[0].clientX, e.touches[0].clientY, 'trail');
     }
     const rightEdge = document.getElementById('fcEdgeRippleRight');
     const leftEdge = document.getElementById('fcEdgeRippleLeft');
     const topEdge = document.getElementById('fcEdgeRippleTop');
     if (distance > 10) {
         if (dy < -15 && Math.abs(dy) > Math.abs(dx)) {
             liveRipple.style.background = "radial-gradient(circle, rgba(245, 158, 11, 0.4) 0%, rgba(245, 158, 11, 0) 75%)";
             liveRipple.style.opacity = fluidOpacity;
             if(topEdge) {
                 topEdge.style.opacity = ratio;
                 topEdge.style.transform = "scaleY(" + (1 + ratio * 0.35) + ")";
             }
             if(rightEdge) rightEdge.style.opacity = 0;
             if(leftEdge) leftEdge.style.opacity = 0;
         } else if (dx > 15) {
             liveRipple.style.background = "radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, rgba(16, 185, 129, 0) 75%)";
             liveRipple.style.opacity = fluidOpacity;
             if(rightEdge) {
                 rightEdge.style.opacity = ratio;
                 rightEdge.style.transform = "scaleX(" + (1 + ratio * 0.35) + ")";
             }
             if(leftEdge) leftEdge.style.opacity = 0;
             if(topEdge) topEdge.style.opacity = 0;
         } else if (dx < -15) {
             liveRipple.style.background = "radial-gradient(circle, rgba(239, 68, 68, 0.4) 0%, rgba(239, 68, 68, 0) 75%)";
             liveRipple.style.opacity = fluidOpacity;
             if(leftEdge) {
                 leftEdge.style.opacity = ratio;
                 leftEdge.style.transform = "scaleX(" + (1 + ratio * 0.35) + ")";
             }
             if(rightEdge) rightEdge.style.opacity = 0;
             if(topEdge) topEdge.style.opacity = 0;
         }
     } else {
         liveRipple.style.opacity = 0;
         if(rightEdge) rightEdge.style.opacity = 0;
         if(leftEdge) leftEdge.style.opacity = 0;
         if(topEdge) topEdge.style.opacity = 0;
     }
 }, {passive: true});
 cardWrap.addEventListener('touchend', function(e) {
     if (!isCardFlicking) return;
     isCardFlicking = false;
     let dx = e.changedTouches[0].clientX - cardTouchStartX;
     let dy = e.changedTouches[0].clientY - cardTouchStartY;
     liveRipple.style.opacity = 0; 
     if (dx > 65) {
         window.swipeFlashcard('right', dx, dy);
     } else if (dx < -65) {
         window.swipeFlashcard('left', dx, dy);
     } else if (dy < -65) {
         window.swipeFlashcard('up', dx, dy);
     } else {
         cardWrap.style.transform = "";
         const rightEdge = document.getElementById('fcEdgeRippleRight');
         const leftEdge = document.getElementById('fcEdgeRippleLeft');
         const topEdge = document.getElementById('fcEdgeRippleTop');
         if(rightEdge) rightEdge.style.opacity = 0;
         if(leftEdge) leftEdge.style.opacity = 0;
         if(topEdge) topEdge.style.opacity = 0;
     }
 });
 let frontText = flashcardDirectionMode === 'en2ja' ? wordData.en : wordData.ja;
 let backText = flashcardDirectionMode === 'en2ja' ? wordData.ja : wordData.en;
 cardWrap.innerHTML += `
     <div class="flashcard-inner-rotator" style="z-index:2;">
         <div class="flashcard-face-front" style="${customStyle}">
             <span style="font-size:11px; color:var(--text-sub); position:absolute; top:24px; font-weight:800;">#${wordData.num}</span>
             <div style="font-size:24px; font-weight:900; font-family:'Times New Roman', serif; word-break:break-word; text-align:center; padding:0 15px; color:#FFFFFF;">${frontText}</div>
         </div>
         <div class="flashcard-face-back" style="${customStyle}">
             <div style="font-size:16px; font-weight:700; word-break:break-word; text-align:center; color:#FFFFFF; padding:0 15px; line-height:1.5;">${backText}</div>
         </div>
     </div>
 `;
 stage.appendChild(cardWrap);
 window.initLucide();
};
window.swipeFlashcard = function(direction, finalDx = 0, finalDy = 0) {
const card = document.getElementById('activeFlashcard');
if (!card) return;
let currentWord = flashcardOriginQueue[flashcardCurrentIndex];
 let cleanKey = currentWord.en.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]\"']/g,"");
 let status = 'none';
 const stage = document.getElementById('flashcardDeckStage');
 let baseLeft = window.innerWidth / 2;
 let baseTop = window.innerHeight / 2.2;
 if (stage) {
     const rect = stage.getBoundingClientRect();
     baseLeft = rect.left + rect.width / 2;
     baseTop = rect.top + rect.height / 2;
 }
 let releaseX = baseLeft + finalDx;
 let releaseY = baseTop + finalDy;
 for (let i = 0; i < 15; i++) {
     setTimeout(() => {
         window.createFlickTrailParticle(releaseX + (Math.random() - 0.5) * 80, releaseY + (Math.random() - 0.5) * 80, direction);
     }, i * 15);
 }
 card.style.animation = "none"; 
 card.style.transition = "transform 0.8s cubic-bezier(0.1, 0.8, 0.25, 1), opacity 0.8s ease";
 card.style.transform = `translate3d(${finalDx}px, ${finalDy}px, 0) scale(0) rotate(${finalDx * 0.05}deg)`;
 card.style.opacity = "0";
 if (direction === 'right') {
     status = 'ok';
     flashcardLearnedCount++;
 } else if (direction === 'left') {
     status = 'bad';
 } else if (direction === 'up') {
     status = 'so';
 }
 totalExp += 1;
 wordMemory[cleanKey] = status;
 localStorage.setItem('wordMemory', JSON.stringify(wordMemory));
 const vocabMatch = vocabList.find(v => v.word.toLowerCase() === cleanKey);
 if (vocabMatch) {
     vocabMatch.status = status;
     if (vocabMatch.meanings && vocabMatch.meanings.length > 0) {
         vocabMatch.meanings[0].status = status;
         if (!vocabMatch.meanings[0].history) vocabMatch.meanings[0].history = [];
         vocabMatch.meanings[0].history.push(status);
     }
     if (!vocabMatch.history) vocabMatch.history = [];
     vocabMatch.history.push(status);
     window.saveVocabToStorage();
 }
 userStats.flash_count++; 
 userStats.vocab_fixed = vocabList.filter(w => w.meanings && w.meanings.some(m => m.status === 'ok')).length;
 window.saveUserStats();
 window.checkAndRewardTitleBonusXP();
 window.renderFlashcardHistoryBubbles(currentWord);
 if (stage) {
     const ripple = document.createElement('div');
     ripple.className = `flashcard-post-ripple firework-余韻-${direction}`;
     ripple.style.animationDuration = "0.8s";
     ripple.style.left = `calc(50% + ${finalDx}px)`;
     ripple.style.top = `calc(50% + ${finalDy}px)`;
     stage.appendChild(ripple);
     setTimeout(() => { ripple.remove(); }, 800);
 }
 window.applyProfileToUi();
 window.updateReaderWordColors();
 window.renderVocabList();
 window.renderLeaderboard(); 
 setTimeout(() => {
     flashcardCurrentIndex++;
     window.renderFlashcardDeck();
     const rightEdge = document.getElementById('fcEdgeRippleRight');
     const leftEdge = document.getElementById('fcEdgeRippleLeft');
     const topEdge = document.getElementById('fcEdgeRippleTop');
     if(rightEdge) rightEdge.style.opacity = 0;
     if(leftEdge) leftEdge.style.opacity = 0;
     if(topEdge) topEdge.style.opacity = 0;
 }, 800);
};
window.quitFlashcardSession = function() {
document.body.classList.remove('in-game-active');
document.getElementById('flashcard-play-screen').style.display = 'none';
const startScreen = document.getElementById('game-start-screen'); if (startScreen) startScreen.style.display = 'flex';
const lbArea = document.getElementById('gameLeaderboardArea'); if (lbArea) lbArea.style.display = 'flex';
const rightEdge = document.getElementById('fcEdgeRippleRight');
const leftEdge = document.getElementById('fcEdgeRippleLeft');
const topEdge = document.getElementById('fcEdgeRippleTop');
if(rightEdge) rightEdge.remove();
if(leftEdge) leftEdge.remove();
if(topEdge) topEdge.remove();
window.renderGameLeaderboard();
};
window.showModeSelectScreen = function() {
const startScreen = document.getElementById('game-start-screen');
const lbArea = document.getElementById('gameLeaderboardArea');
const modeSelectScreen = document.getElementById('game-mode-select-screen');
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
document.getElementById('game-mode-select-screen').style.display = 'none';
document.getElementById('game-play-screen').style.display = 'none';
const startScreen = document.getElementById('game-start-screen');
const lbArea = document.getElementById('gameLeaderboardArea');
if (startScreen) startScreen.style.display = 'flex';
if (lbArea) lbArea.style.display = 'flex';
};
window.backToModeSelect = function() {
document.getElementById('game-difficulty-select-screen').style.display = 'none';
document.getElementById('game-mode-select-screen').style.display = 'block';
};
// 🌟 シングルプレイ開始処理（選択中の単語帳と連携）
window.startActualGame = function(difficulty) {
currentGameDifficulty = difficulty;
document.getElementById('game-difficulty-select-screen').style.display = 'none';
document.getElementById('game-play-screen').style.display = 'block';
document.body.classList.add('in-game-active');
gameScoreCount = 0;
 gameMistakeCount = 0;
 gameComboCount = 0;
 document.getElementById('gameScoreNum').innerText = "0000";
 if(difficulty === 'normal') {
     gameRemainingTime = 180;
     document.getElementById('gameTimerNum').innerText = gameRemainingTime;
 } else if(difficulty === 'hard') {
     gameRemainingTime = 420;
     document.getElementById('gameTimerNum').innerText = gameRemainingTime;
 } else if(difficulty === 'expert') {
     gameRemainingTime = 900;
     document.getElementById('gameTimerNum').innerText = gameRemainingTime;
 } else {
     gameRemainingTime = 9999;
     document.getElementById('gameTimerNum').innerText = "❤️×5";
 }
 gameCurrentWordsQueue = [];
 vocabList.forEach(w => {
     if(w.meanings && w.meanings.length > 0) {
         gameCurrentWordsQueue.push({
             wordNum: w.num,
             word: w.word,
             meaning: window.formatWordForDisplay(w.meanings[0].text)
         });
     }
 });
 if(gameCurrentWordsQueue.length === 0) {
     alert("学習用単語が存在しません。管理者による単語の配信をお待ちください。");
     window.backToGameMenu();
     return;
 }
 gameCurrentWordsQueue.sort(() => Math.random() - 0.5);
 gameCurrentIndex = 0;
 gameHistoryLog = [];
 isGameProcessingAnswer = false;
 clearInterval(gameTimerInterval);
 gameTimerInterval = setInterval(() => {
     if(difficulty !== 'endless') {
         gameRemainingTime--;
         document.getElementById('gameTimerNum').innerText = gameRemainingTime;
         if(gameRemainingTime <= 0) {
             endGameSession();
         }
     } else {
         // エンドレスモードのハートリアルタイム更新
         let remainingHearts = Math.max(0, 5 - gameMistakeCount);
         document.getElementById('gameTimerNum').innerText = "❤️×" + remainingHearts;
     }
 }, 1000);
 showNextGameQuestion();
};
window.showNextGameQuestion = function() {
if(gameCurrentIndex >= gameCurrentWordsQueue.length) {
gameCurrentWordsQueue.sort(() => Math.random() - 0.5);
gameCurrentIndex = 0;
}
const currentQ = gameCurrentWordsQueue[gameCurrentIndex];
 let type = selectedQuestionMode;
 if(type === 'mixed') {
     type = Math.random() < 0.5 ? 'ja2en' : 'en2ja';
 }
 currentQuestionType = type;
 const targetDisplay = document.getElementById('gameWordTarget');
 if(type === 'ja2en') {
     targetDisplay.innerText = currentQ.meaning;
 } else {
     targetDisplay.innerText = currentQ.word;
 }
 const inputEl = document.getElementById('gameAnswerInput');
 inputEl.value = "";
 inputEl.focus();
 document.getElementById('giantJudgmentOverlay').classList.remove('show');
 document.getElementById('feedbackContent').style.display = 'none';
 document.getElementById('gameNextBtn').style.display = 'none';
 isGameProcessingAnswer = false;
};
window.submitGameAnswer = function() {
if(isGameProcessingAnswer) return;
if(document.getElementById('feedbackContent').style.display === 'block') return;
const inputEl = document.getElementById('gameAnswerInput');
 const userAns = inputEl.value.trim();
 if(!userAns) return;
 isGameProcessingAnswer = true;
 const currentQ = gameCurrentWordsQueue[gameCurrentIndex];
 let correctTarget = currentQuestionType === 'ja2en' ? currentQ.word : currentQ.meaning;
 let isDirectMatch = userAns.toLowerCase() === correctTarget.toLowerCase();
 if(isDirectMatch) {
     processJudgmentResult("OK", correctTarget, userAns);
 } else {
     document.getElementById('gameJudgingIndicator').style.display = 'flex';
     window.callGeminiGameJudge(document.getElementById('gameWordTarget').innerText, correctTarget, userAns, currentQuestionType)
     .then(result => {
         document.getElementById('gameJudgingIndicator').style.display = 'none';
         processJudgmentResult(result.status, correctTarget, userAns, result.alternatives);
     })
     .catch(() => {
         document.getElementById('gameJudgingIndicator').style.display = 'none';
         processJudgmentResult("NG", correctTarget, userAns);
     });
 }
};
window.skipGameWordWithPass = function() {
if(isGameProcessingAnswer) return;
if(document.getElementById('feedbackContent').style.display === 'block') return;
isGameProcessingAnswer = true;
const currentQ = gameCurrentWordsQueue[gameCurrentIndex];
let correctTarget = currentQuestionType === 'ja2en' ? currentQ.word : currentQ.meaning;
processJudgmentResult("NG", correctTarget, "（パス）", "", true);
};
// 🌟 修正：正誤判定処理（獲得EXP保存・ヘッダーゲージ反映・エンドレスライフ減少）
function processJudgmentResult(status, correctTarget, userAns, alternatives = "", isPass = false) {
const overlay = document.getElementById('giantJudgmentOverlay');
const mark = document.getElementById('giantJudgmentMark');
const txt = document.getElementById('giantJudgmentText');
const scorePopup = document.getElementById('giantScorePopup');
overlay.className = "giant-judgment-overlay";
 scorePopup.className = "giant-score-popup";
 let addedPoints = 0;
 let isCorrect = status === 'OK' || status === 'SO';
 let earnedExpThisTurn = 2;
 if(isCorrect) {
     if(status === 'OK') {
         overlay.classList.add('correct');
         mark.innerText = "◎";
         txt.innerText = "正解！";
         gameComboCount++;
         addedPoints = 100 + Math.min(gameComboCount * 10, 200);
         gameScoreCount += addedPoints;
         scorePopup.innerText = `+${addedPoints}`;
         scorePopup.classList.add('score-anim-plus');
     } else if(status === 'SO') {
         overlay.classList.add('correct');
         mark.innerText = "○";
         txt.innerText = "おまけ正解！";
         gameComboCount++;
         addedPoints = 50;
         gameScoreCount += addedPoints;
         scorePopup.innerText = `+${addedPoints}`;
         scorePopup.classList.add('score-anim-plus');
     }
     earnedExpThisTurn += 1;
     if (gameComboCount > userStats.combo_max) {
         userStats.combo_max = gameComboCount;
     }
 } else {
     overlay.classList.add('incorrect');
     mark.innerText = "✕";
     txt.innerText = "不正解...";
     gameComboCount = 0;
     gameMistakeCount++;
     scorePopup.innerText = "MISS";
     scorePopup.classList.add('score-anim-minus');
     userStats.mistake_count++;
     // エンドレスモード時、ハート（ライフ）を即座に減少
     if(currentGameDifficulty === 'endless') {
         let remainingHearts = Math.max(0, 5 - gameMistakeCount);
         document.getElementById('gameTimerNum').innerText = "❤️×" + remainingHearts;
     }
 }
 totalExp += earnedExpThisTurn;
 document.getElementById('gameScoreNum').innerText = String(gameScoreCount).padStart(4, '0');
 const comboContainer = document.getElementById('persistentComboContainer');
 if(gameComboCount >= 2) {
     comboContainer.style.display = 'flex';
     document.getElementById('persistentComboText').innerText = `${gameComboCount} COMBO!`;
 } else {
     comboContainer.style.display = 'none';
 }
 if (!isPass) {
     overlay.classList.add('show');
 }
 document.getElementById('feedbackUserAns').innerText = userAns;
 document.getElementById('feedbackCorrectAns').innerText = correctTarget;
 if(alternatives) {
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
 // 解答結果を単語帳（vocabList）とFirebaseへ即時反映
 const currentQ = gameCurrentWordsQueue[gameCurrentIndex];
 if(currentQ) {
     const targetVocab = vocabList.find(w => String(w.num) === String(currentQ.wordNum));
     if(targetVocab) {
         let wordStatus = isCorrect ? 'ok' : 'bad';
         if(targetVocab.meanings && targetVocab.meanings.length > 0) {
             targetVocab.meanings[0].status = wordStatus;
             if(!targetVocab.meanings[0].history) targetVocab.meanings[0].history = [];
             targetVocab.meanings[0].history.push(wordStatus);
         }
         targetVocab.status = wordStatus;
         if(!targetVocab.history) targetVocab.history = [];
         targetVocab.history.push(wordStatus);
         window.saveVocabToStorage();
     }
 }
 window.saveUserStats();
 window.checkAndRewardTitleBonusXP();
 window.applyProfileToUi();
 window.renderLeaderboard();
 let feedbackDelay = isPass ? 10 : 800;
 setTimeout(() => {
     // エンドレスモードでハートが0になったらリザルト画面へ
     if(currentGameDifficulty === 'endless' && gameMistakeCount >= 5) {
         endGameSession();
         return;
     }
     document.getElementById('feedbackContent').style.display = 'block';
     document.getElementById('gameNextBtn').style.display = 'block';
 }, feedbackDelay);
}
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
 let totalQ = gameHistoryLog.length;
 let correctQ = gameHistoryLog.filter(h => h.status === 'OK' || h.status === 'SO').length;
 let accuracy = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0;
 document.getElementById('resAccuracy').innerText = `${accuracy}%`;
 let keyBest = `cosmic_best_${selectedQuestionMode}_${currentGameDifficulty}`;
 let oldBest = parseInt(localStorage.getItem(keyBest) || "0");
 if(gameScoreCount > oldBest) {
     localStorage.setItem(keyBest, gameScoreCount);
     oldBest = gameScoreCount;
 }
 document.getElementById('resBestScore').innerText = oldBest;
 let logKey = `cosmic_score_${selectedQuestionMode}_${currentGameDifficulty}`;
 let history = JSON.parse(localStorage.getItem(logKey) || "[]");
 const now = new Date();
 const dateStr = `${now.getMonth()+1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
 history.push({ score: gameScoreCount, date: dateStr });
 history.sort((a, b) => b.score - a.score);
 localStorage.setItem(logKey, JSON.stringify(history.slice(0, 5)));
 if (window.db && window.fbSetDoc && window.fbDoc && gameScoreCount > 0) {
     try {
         const scoresRef = window.fbDoc(window.db, "shared", "game_scores_" + selectedQuestionMode);
         const snap = await window.fbGetDoc(scoresRef);
         let remoteScores = snap.exists() && snap.data().scores ? snap.data().scores : [];
         remoteScores = remoteScores.filter(s => s.id !== myId);
         remoteScores.push({ id: myId, name: myName, score: gameScoreCount, date: dateStr });
         remoteScores.sort((a,b) => b.score - a.score);
         await window.fbSetDoc(scoresRef, { scores: remoteScores.slice(0, 20) }, { merge: true });
     } catch(e) {
         console.error("Firebaseへのスコア同期エラー:", e);
     }
 }
 const container = document.getElementById('gameHistoryListContainer');
 container.innerHTML = "";
 gameHistoryLog.forEach(h => {
     const item = document.createElement('div');
     item.style.cssText = "display:flex; justify-content:space-between; padding:6px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:12px;";
     let mark = (h.status === 'OK' || h.status === 'SO') ? "⚪︎" : "✕";
     item.innerHTML = `<div><strong>${h.question}</strong> -> ${h.userAns}</div><div style="color:${mark==='⚪︎'?'var(--word-ok)':'var(--word-bad)'}">${mark} (正解: ${h.correctAns})</div>`;
     container.appendChild(item);
 });
 if (gameComboCount > userStats.combo_max) {
     userStats.combo_max = gameComboCount;
 }
 if (userStats.combo_max > 0) {
     totalExp += userStats.combo_max;
 }
 userStats.test_count += totalQ; 
 if (gameScoreCount > userStats.high_score) {
     userStats.high_score = gameScoreCount; 
 }
 await window.saveUserStats();
 window.checkAndRewardTitleBonusXP();
 window.applyProfileToUi();
 window.renderLeaderboard(); 
 window.renderGameLeaderboard(); 
};
// ==========================================================================
// ⚔️ パーティ・マルチプレイ関連
// ==========================================================================
window.switchPartySubCategory = function(category) {
document.getElementById('partyTabChar').classList.toggle('active', category === 'character');
document.getElementById('partyTabWeapon').classList.toggle('active', category === 'weapon');
document.getElementById('partyTabArmor').classList.toggle('active', category === 'armor');
document.getElementById('partyBoxCharacter').style.display = category === 'character' ? 'grid' : 'none';
document.getElementById('partyBoxWeapon').style.display = category === 'weapon' ? 'grid' : 'none';
document.getElementById('partyBoxArmor').style.display = category === 'armor' ? 'grid' : 'none';
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
const bChar = document.getElementById('multiEquipCharIcon'); if(bChar) bChar.style.display = 'none';
const bWep = document.getElementById('multiEquipWeaponIcon'); if(bWep) bWep.style.display = 'none';
const bArm = document.getElementById('multiEquipArmorIcon'); if(bArm) bArm.style.display = 'none';
};
window.initMultiParty = function(playerCount) {
multiPartyMembers = [];
const borderColors = ['var(--cosmic-purple-light)', 'var(--cosmic-cyan)', 'var(--cosmic-cyan)', 'var(--cosmic-cyan)'];
const shadows = ['rgba(192, 132, 252, 0.5)', 'rgba(0, 240, 255, 0.5)', 'rgba(0, 240, 255, 0.5)', 'rgba(0, 240, 255, 0.5)'];
const mySavedAvatar = localStorage.getItem('core_v4_user_avatar_' + myId) || "";
for(let i = 0; i < playerCount; i++) {
    let isMe = (i === 0);
    multiPartyMembers.push({ 
        id: i, 
        name: isMe ? myName : `ALLY ${i}`, 
        char: isMe ? activeCharacter : '', 
        customAvatar: isMe ? mySavedAvatar : "", 
        maxHp: 3500, 
        hp: 3500, 
        isMe: isMe, 
        borderColor: borderColors[i], 
        shadowColor: shadows[i] 
    });
}
};
window.renderMultiParty = function() {
const container = document.getElementById('multiPartyContainer'); if(!container) return; container.innerHTML = "";
multiPartyMembers.forEach(m => {
let charImg = m.char === 'tangon' ? `<img src="tangon.png" alt="tangon" style="width:100%; height:100%; object-fit:cover;">` : `👤`;
if (m.isMe && m.customAvatar) {
charImg = `<img src="${m.customAvatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
}
    let hpPercent = Math.max(0, (m.hp / m.maxHp) * 100);
     let color = m.isMe ? "var(--cosmic-purple-light)" : "var(--cosmic-cyan)";
     let comboText = (m.isMe && gameComboCount >= 2) ? `${gameComboCount} COMBO!` : "";
     let html = `
         <div class="multi-party-member" id="partyMember-${m.id}" style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
             <div class="multi-party-combo" id="multiPartyCombo-${m.id}" style="font-size: 9px; font-weight: 900; color: #FBBF24; text-shadow: 0 0 4px #F59E0B; min-height: 12px; text-align: center;">
                 ${comboText}
             </div>
             <div class="multi-party-icon" style="width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: none !important; border: none !important; box-shadow: none !important;">${charImg}</div>
             <div class="multi-party-equip-display" style="display: flex; gap: 2px; font-size: 10px; background: rgba(0,0,0,0.4); padding: 1px 4px; border-radius: 4px;">
                 <span title="Weapon">${m.isMe && activeWeapon === 'fire_sword' ? '🔥' : '🗡️'}</span>
                 <span title="Armor">${m.isMe && activeArmor === 'cosmic_shield' ? '🔮' : '🛡️'}</span>
             </div>
             <div style="font-size:8px; color:${color}; font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:64px; text-align:center;">${m.name}</div>
             <div class="multi-party-hp-bar" style="width: 100%; height: 5px; background: rgba(0,0,0,0.8); border: 1px solid ${m.borderColor}; box-shadow: 0 0 5px ${m.shadowColor}; border-radius: 4px; overflow: hidden; display: flex; justify-content: flex-start;">
                 <div class="multi-party-hp-fill" id="partyMemberHpFill-${m.id}" style="width:${hpPercent}%; height: 100%; background: linear-gradient(90deg, #10B981, #34D399); transform-origin:left !important;"></div>
             </div>
         </div>`;
     container.innerHTML += html;
 });
};
window.showCharacterPopup = function(memberId, amount, type) {
const memberEl = document.getElementById('partyMember-' + memberId); if(!memberEl) return;
if(type === 'attack') {
const flyingBubble = document.createElement('div'); flyingBubble.className = 'popup-bubble-flying-atk'; flyingBubble.innerText = amount;
const charRect = memberEl.getBoundingClientRect();
    let targetEl = document.getElementById('multiBossImage');
     if (currentMultiMode === 'pvp') {
         targetEl = document.getElementById('multiPvpOpponentVisualContainer');
     }
     const bossRect = targetEl ? targetEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 3, width: 0, height: 0 };
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
alert("⚠️ 学習用単語がまだ配信されていません。管理者の単語追加をお待ちください。");
return;
}
const lbArea = document.getElementById('gameLeaderboardArea'); if (lbArea) lbArea.style.display = 'none';
const startScreen = document.getElementById('game-start-screen'); if (startScreen) startScreen.style.display = 'none';
document.getElementById('multi-battle-choice-screen').style.display = 'block';
document.getElementById('multi-battle-team-list-screen').style.display = 'none';
document.getElementById('multi-battle-setup-screen').style.display = 'none';
document.getElementById('multi-battle-matching-screen').style.display = 'none';
document.getElementById('multi-battle-play-screen').style.display = 'none';
window.initMultiModeSwipe(); 
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
window.applyVocabMaxRange();
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
area.addEventListener('touchstart', function(e) {
    modeSwipeStartX = e.touches[0].clientX;
}, {passive: true});
area.addEventListener('touchend', function(e) {
    let endX = e.changedTouches[0].clientX;
    let diff = modeSwipeStartX - endX;
    if (diff > 30) {
        window.selectMultiMode('pvp');
    } else if (diff < -30) {
        window.selectMultiMode('coop');
    }
});
};
window.selectMultiMode = function(mode) {
currentMultiMode = mode;
const imgEl = document.getElementById('multiModeDisplayImage');
const swipeArea = document.getElementById('multiModeSwipeArea');
const coopBadge = document.getElementById('multiCoopActiveBadge');
const pvpBadge = document.getElementById('multiPvpActiveBadge');
const btnCoop = document.getElementById('btnMultiCoop');
const btnPvp = document.getElementById('btnMultiPvp');
const pvpTypeFrame = document.getElementById('multiPvpTypeSelectionFrame');
const normalCountFrame = document.getElementById('multiPlayerCountSelectionFrame');
if(!imgEl || !swipeArea) return;
 if(btnCoop) btnCoop.classList.remove('active');
 if(btnPvp) btnPvp.classList.remove('active');
 if (mode === 'coop') { 
     imgEl.src = 'kyouryoku.png';
     imgEl.alt = '協力戦';
     swipeArea.style.borderColor = 'var(--cosmic-cyan)'; 
     swipeArea.style.boxShadow = '0 0 15px rgba(0, 240, 255, 0.5)'; 
     if(btnCoop) btnCoop.classList.add('active');
     if(coopBadge) coopBadge.style.display = 'block';
     if(pvpBadge) pvpBadge.style.display = 'none';
     if(pvpTypeFrame) pvpTypeFrame.style.display = 'none';
     if(normalCountFrame) normalCountFrame.style.display = 'block';
     const selectCount = document.getElementById('multiPlayerCount');
     if(selectCount && (selectCount.value === "1" || selectCount.value === "2")) {
         selectCount.value = "4";
     }
 } else { 
     imgEl.src = 'taizin.png';
     imgEl.alt = '対人戦';
     swipeArea.style.borderColor = 'var(--admin-accent)'; 
     swipeArea.style.boxShadow = '0 0 15px rgba(236, 72, 153, 0.5)'; 
     if(btnPvp) btnPvp.classList.add('active');
     if(pvpBadge) pvpBadge.style.display = 'block';
     if(coopBadge) coopBadge.style.display = 'none';
     if(pvpTypeFrame) pvpTypeFrame.style.display = 'block';
     if(normalCountFrame) normalCountFrame.style.display = 'none';
     const pvpTypeSelect = document.getElementById('multiPvpTypeSelect');
     if(pvpTypeSelect) window.handlePvpFormatChange(pvpTypeSelect.value);
 }
};
window.handlePvpFormatChange = function(format) {
const mockCountSelect = document.getElementById('multiPlayerCount');
if(!mockCountSelect) return;
if (format === '1v1') {
mockCountSelect.value = "1";
} else {
mockCountSelect.value = "2";
}
};
window.playIntroVideoBeforeBattle = function() {
if (currentMultiMode === 'pvp') {
window.startMultiBattlePlay();
return;
}
document.getElementById('multi-battle-matching-screen').style.display = 'none'; 
const overlay = document.getElementById('video-overlay'), video = document.getElementById('introVideo');
if (overlay && video) { overlay.style.display = 'flex'; video.currentTime = 0; video.play().catch(e => { window.skipIntroVideo(); }); video.onended = window.skipIntroVideo; } 
else { window.startMultiBattlePlay(); }
};
window.skipIntroVideo = function() {
const overlay = document.getElementById('video-overlay'), video = document.getElementById('introVideo');
if(video) video.pause(); if(overlay) overlay.style.display = 'none'; window.startMultiBattlePlay();
};
window.startMultiBattlePlay = function() {
const matchingScreen = document.getElementById('multi-battle-matching-screen');
if(matchingScreen) matchingScreen.style.display = 'none';
document.body.classList.add('in-game-active'); document.getElementById('multi-battle-play-screen').style.display = 'flex'; gameComboCount = 0; multiLimitAmount = 0; 
 document.getElementById('multiComboCountText').innerText = "0"; document.getElementById('multiDamagePopupText').innerText = "";
 const multiComboParent = document.getElementById('multiComboCountText') ? document.getElementById('multiComboCountText').parentElement : null;
 if(multiComboParent) document.getElementById('multiComboCountText').parentElement.style.display = 'none';
 const sparkleBorder = document.getElementById('combo-sparkle-border'); if(sparkleBorder) sparkleBorder.classList.remove('active');
 const ownHpFrame = document.getElementById('multiPlayerOwnHpFrame'); if(ownHpFrame) ownHpFrame.style.display = 'block';
 const logContainer = document.getElementById('multiDamagePopupText') ? document.getElementById('multiBattleLog') : null; if(logContainer) logContainer.innerHTML = "";
 window.updatePartySlotsUi(); 
 const pvpFormat = document.getElementById('multiPvpTypeSelect') ? document.getElementById('multiPvpTypeSelect').value : '1v1';
 const normalCount = parseInt(document.getElementById('multiPlayerCount').value) || 2;
 const bossBar = document.getElementById('multiBossHpBarContainer');
 const pvpOpponentBar = document.getElementById('multiPvpOpponentHpFrame');
 const bossImg = document.getElementById('multiBossImage');
 const pvpVisualContainer = document.getElementById('multiPvpOpponentVisualContainer');
 const rImg1 = document.getElementById('multiPvpOpponentCharImg1');
 const rImg2 = document.getElementById('multiPvpOpponentCharImg2');
 const opponentNameLabel = document.getElementById('multiPvpOpponentName');
 const escapeBtn = document.getElementById('multiEscapeOrSurrenderBtn');
 const globalPlayBgLayer = document.getElementById('multi-battle-play-bg');
 if (currentMultiMode === 'coop') {
     if(bossBar) bossBar.style.display = 'block';
     if(pvpOpponentBar) pvpOpponentBar.style.display = 'none';
     if(bossImg) bossImg.style.display = 'block';
     if(pvpVisualContainer) pvpVisualContainer.style.display = 'none';
     if(escapeBtn) escapeBtn.innerText = "逃げる";
     if(globalPlayBgLayer) {
         globalPlayBgLayer.style.backgroundImage = "url('sentou.png')";
     }
     window.initMultiParty(normalCount);
     multiBossMaxHp = 100000 * normalCount;
 } else {
     if(bossBar) bossBar.style.display = 'none';
     if(pvpOpponentBar) pvpOpponentBar.style.display = 'block';
     if(bossImg) bossImg.style.display = 'none';
     if(pvpVisualContainer) pvpVisualContainer.style.display = 'flex';
     if(escapeBtn) escapeBtn.innerText = "降参";
     if(globalPlayBgLayer) {
         globalPlayBgLayer.style.backgroundImage = "url('dojo.png')";
     }
     if (pvpFormat === '1v1') {
         window.initMultiParty(1);
         multiBossMaxHp = 3500;
         if(rImg1) rImg1.style.display = 'block';
         if(rImg2) rImg2.style.display = 'none';
         if(opponentNameLabel) opponentNameLabel.innerText = "ライバル修行者";
     } else {
         window.initMultiParty(2);
         multiBossMaxHp = 7000;
         if(rImg1) rImg1.style.display = 'block';
         if(rImg2) rImg2.style.display = 'block'; 
         if(opponentNameLabel) opponentNameLabel.innerText = "修行者タッグチーム";
     }
 }
 multiBossHp = multiBossMaxHp; 
 multiEnemyTimeLeft = 10; 
 window.updateMultiHpBars();
 gameCurrentWordsQueue = []; vocabList.forEach(w => { if(w.meanings && w.meanings.length > 0) gameCurrentWordsQueue.push({ wordNum: w.num, word: w.word, meaning: window.formatWordForDisplay(w.meanings[0].text) }); });
 gameCurrentWordsQueue.sort(() => Math.random() - 0.5); gameCurrentIndex = 0;
 clearInterval(gameTimerInterval); 
 gameTimerInterval = setInterval(window.handleMultiBattleTimer, 100); 
 window.showNextMultiWord(); 
 window.initMultiPartyEvents();
};
window.updateMultiHpBars = function() {
const boss = document.getElementById('multiBossHpFill'); if(boss) boss.style.width = Math.max(0, (multiBossHp / multiBossMaxHp) * 100) + "%";
const bossTxt = document.getElementById('multiEnemyHpText'); if(bossTxt) { bossTxt.innerText = `${Math.max(0, Math.floor(multiBossHp))}`; }
const pvpOpponentHpFill = document.getElementById('multiPvpOpponentHpFill');
 const pvpOpponentHpText = document.getElementById('multiPvpOpponentHpText');
 if(pvpOpponentHpFill) pvpOpponentHpFill.style.width = Math.max(0, (multiBossHp / multiBossMaxHp) * 100) + "%";
 if(pvpOpponentHpText) pvpOpponentHpText.innerText = `${Math.max(0, Math.floor(multiBossHp))} / ${multiBossMaxHp}`;
 multiPartyMembers.forEach(m => {
     let fill = document.getElementById(`partyMemberHpFill-${m.id}`); 
     if (fill) {
         fill.style.width = Math.max(0, (m.hp / m.maxHp) * 100) + "%";
     }
 });
 let me = multiPartyMembers.find(m => m.isMe);
 if (me) {
     const ownHpFill = document.getElementById('multiPlayerOwnHpFill'), ownHpText = document.getElementById('multiPlayerOwnHpText');
     if (ownHpFill) {
         ownHpFill.style.width = Math.max(0, (me.hp / me.maxHp) * 100) + "%"; 
         ownHpFill.parentElement.style.justifyContent = 'flex-start'; 
     }
     if (ownHpText) ownHpText.innerText = `${Math.max(0, Math.floor(me.hp))} / ${me.maxHp}`;
 }
 const limitFill = document.getElementById('multiLimitGaugeFill'), limitText = document.getElementById('multiLimitGaugeText'), limitPercentNum = Math.floor(Math.max(0, (multiLimitAmount / multiLimitMax) * 100));
 if (limitFill) { 
     limitFill.style.width = limitPercentNum + "%"; 
     if (multiLimitAmount >= multiLimitMax) limitFill.classList.add('max'); else limitFill.classList.remove('max'); 
     limitFill.parentElement.style.justifyContent = 'flex-start'; 
 }
 if (limitText) { limitText.innerText = ""; }
 const multiComboParent = document.getElementById('multiComboCountText') ? document.getElementById('multiComboCountText').parentElement : null;
 if(multiComboParent) document.getElementById('multiComboCountText').parentElement.style.display = 'none';
 const sparkleBorder = document.getElementById('combo-sparkle-border');
 if(sparkleBorder) { if(gameComboCount >= 2) sparkleBorder.classList.add('active'); else sparkleBorder.classList.remove('active'); } 
};
window.handleMultiBattleTimer = function() {
if (currentMultiMode === 'pvp') return;
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
if(gameCurrentWordsQueue.length === 0) return;
if(gameCurrentIndex >= gameCurrentWordsQueue.length) { gameCurrentWordsQueue.sort(() => Math.random() - 0.5); gameCurrentIndex = 0; }
const target = gameCurrentWordsQueue[gameCurrentIndex]; document.getElementById('flickTargetWord').innerText = target.word;
let choices = [target.meaning]; let dummies = [...gameCurrentWordsQueue].filter(w => w.word !== target.word).map(w => w.meaning);
dummies.sort(() => Math.random() - 0.5); choices = choices.concat(dummies.slice(0, 7)).sort(() => Math.random() - 0.5);
currentMultiCorrectIndex = choices.indexOf(target.meaning);
for(let i=0; i<8; i++) { let el = document.getElementById('multiChoice-' + i); if(el) { el.innerText = choices[i] || "---"; el.classList.remove('highlight'); } }
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
window.handleFlickMove = function(e) {
if(!isFlicking) return; e.preventDefault(); const touch = e.touches[0]; const rect = document.getElementById('flickPadArea').getBoundingClientRect();
let dx = (touch.clientX - rect.left) - flickStartX, dy = (touch.clientY - rect.top) - flickStartY, distance = Math.sqrt(dx * dx + dy * dy);
const icon = document.getElementById('flickWeaponIcon'); 
 if(icon) { 
     if (distance > 5) {
         let angle = Math.atan2(dy, dx);
         let degree = angle * 180 / Math.PI; if(degree < 0) degree += 360;
         let sector = Math.round(degree / 45) % 8;
         let snapAngle = (sector * 45) * Math.PI / 180;
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
             if (multiBossHp <= 0) { 
                 clearInterval(gameTimerInterval); 
                 const winMsg = currentMultiMode === 'coop' ? "🎉 BOSS討伐完了！クエストクリア！" : "🎉 ライバルチームに勝利！バトルクリア！";
                 userStats.multi_win++;
                 window.saveUserStats();
                 window.checkAndRewardTitleBonusXP();
                 setTimeout(() => { alert(winMsg); window.cancelMultiBattlePlay(true); }, 500); 
             }
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
 if(q) {
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
 }
 if (multiBossHp <= 0) { 
     clearInterval(gameTimerInterval); 
     const winMsg = currentMultiMode === 'coop' ? "🎉 BOSS討伐完了！クエストクリア！" : "🎉 ライバルチームに勝利！バトルクリア！";
     userStats.multi_win++;
     window.saveUserStats();
     window.checkAndRewardTitleBonusXP();
     setTimeout(() => { alert(winMsg); window.cancelMultiBattlePlay(true); }, 500); 
     return; 
 }
 if(multiPartyMembers.every(m => m.hp <= 0)) { clearInterval(gameTimerInterval); setTimeout(() => { alert("全滅しました..."); window.cancelMultiBattlePlay(true); }, 500); return; }
 window.updateMultiHpBars(); gameCurrentIndex++; window.showNextMultiWord();
};
window.createFireballEffect = function() {
const layer = document.getElementById('battle-effects-layer'); if(!layer) return; const p = document.createElement('div'); p.className = 'fireball-particle';
const pad = document.getElementById('flickPadArea'); const rect = pad.getBoundingClientRect();
p.style.left = (rect.left + rect.width/2) + 'px'; p.style.top = (rect.top + rect.height/2) + 'px';
p.style.setProperty('--tx', (Math.random() * 80 - 40) + 'px'); p.style.setProperty('--ty', '-160px'); layer.appendChild(p); setTimeout(() => { p.remove(); }, 400);
};
window.saveAdminSystemSettings = function() {
const noticeInput = document.getElementById('adminNoticeInput');
if (noticeInput) {
const noticeMsg = noticeInput.value.trim();
localStorage.setItem('core_v4_admin_notice', noticeMsg);
    const noticeFrame = document.getElementById('adminNoticeDisplayFrame');
    const noticeBody = document.getElementById('adminNoticeTextContent');
    if (noticeFrame && noticeBody) {
        if (noticeMsg !== "") {
            noticeBody.innerText = noticeMsg;
            noticeFrame.style.display = 'block';
        } else {
            noticeFrame.style.display = 'none';
        }
    }
    alert("システム配信アナウンスをリアルタイムに適用・同期しました！");
}
window.switchTab('home'); 
};
// ==========================================================================
// 🚀 完全同期ライフサイクルブートストラップ初期化
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
// ==========================================================================
// 🔌 拡張プラグイン・補正処理
// ==========================================================================
const originalApplyProfileToUi = window.applyProfileToUi;
window.applyProfileToUi = function() {
if(typeof originalApplyProfileToUi === 'function') originalApplyProfileToUi();
if(typeof window.calculateLevelFromExp === 'function') {
let lvlData = window.calculateLevelFromExp(totalExp);
const profTitleEl = document.getElementById('profTitleLabel');
if(profTitleEl) profTitleEl.innerText = `${selectedTitle} ⚡ (あと ${lvlData.nextLevelRequiredExp} XPで Lvl.Up)`;
const headerLevelTextEl = document.getElementById('headerLevelTextSlot');
if(headerLevelTextEl) headerLevelTextEl.innerText = `Lv.${lvlData.level} [Next:${lvlData.nextLevelRequiredExp}]`;
}
};
window.handleTextbookChange = function(value) {
const coverContainer = document.getElementById('vocabCoverContainer');
if (!coverContainer) return;
const match = textbooksPool.find(b => b.id === value);
if(match) {
if(match.coverType === "image" && match.cover) {
coverContainer.innerHTML = `<img src="${match.cover}" style="width:100%; height:100%; object-fit:cover;">`;
} else {
coverContainer.innerText = match.cover || "📔";
}
}
if(typeof window.renderVocabList === 'function') window.renderVocabList();
};
window.finishFlashcardSession = function() {
document.body.classList.remove('in-game-active');
const playScreen = document.getElementById('flashcard-play-screen');
if (playScreen) playScreen.style.display = 'none';
const resultScreen = document.getElementById('game-result-screen');
if (resultScreen) resultScreen.style.display = 'block';
let totalQ = typeof flashcardCurrentIndex !== 'undefined' ? flashcardCurrentIndex : 0;
 let accuracy = totalQ > 0 ? Math.round((flashcardLearnedCount / totalQ) * 100) : 0;
 if (document.getElementById('resLblScore')) document.getElementById('resLblScore').innerText = "学習カード数";
 if (document.getElementById('resScore')) document.getElementById('resScore').innerText = totalQ;
 if (document.getElementById('resAccuracy')) document.getElementById('resAccuracy').innerText = `${accuracy}%`;
 if (document.getElementById('resBoxBest')) document.getElementById('resBoxBest').style.display = 'none';
 if (document.getElementById('resBoxHigh')) document.getElementById('resBoxHigh').style.display = 'none';
 const histTitle = document.querySelector('#game-result-screen h3.cosmic-list-title');
 if (histTitle) histTitle.style.display = 'none';
 if (document.getElementById('gameHistoryListContainer')) document.getElementById('gameHistoryListContainer').style.display = 'none';
 ['fcEdgeRippleRight', 'fcEdgeRippleLeft', 'fcEdgeRippleTop'].forEach(id => {
     const el = document.getElementById(id);
     if (el) el.remove();
 });
 if(typeof window.renderGameLeaderboard === 'function') window.renderGameLeaderboard();
 if(typeof window.saveVocabToStorage === 'function') window.saveVocabToStorage();
};
window.quitFlashcardSession = window.finishFlashcardSession;
const originalEndGameSession = window.endGameSession;
window.endGameSession = function() {
if (document.getElementById('resLblScore')) document.getElementById('resLblScore').innerText = "SCORE";
if (document.getElementById('resBoxBest')) document.getElementById('resBoxBest').style.display = 'flex';
if (document.getElementById('resBoxHigh')) document.getElementById('resBoxHigh').style.display = 'flex';
const histTitle = document.querySelector('#game-result-screen h3.cosmic-list-title');
if (histTitle) histTitle.style.display = 'block';
if (document.getElementById('gameHistoryListContainer')) document.getElementById('gameHistoryListContainer').style.display = 'block';
if(typeof originalEndGameSession === 'function') originalEndGameSession();
};
window.backToGameMenu = function() {
document.body.classList.remove('in-game-active');
['game-mode-select-screen', 'game-difficulty-select-screen', 'game-play-screen', 'game-result-screen', 'flashcard-setup-screen', 'flashcard-play-screen'].forEach(id => {
const el = document.getElementById(id);
if (el) el.style.display = 'none';
});
const startScreen = document.getElementById('game-start-screen');
if (startScreen) startScreen.style.display = 'flex';
const lbArea = document.getElementById('gameLeaderboardArea');
if (lbArea) lbArea.style.display = 'flex';
};
window.closeWordPopover = function() {
const pop = document.getElementById('wordPopover');
if (pop) { pop.classList.remove('show'); pop.style.display = 'none'; }
};
window.closeReader = function() {
const inputView = document.getElementById('text-input-view');
const readerView = document.getElementById('text-reader-view');
if (inputView) inputView.style.display = 'block';
if (readerView) readerView.style.display = 'none';
if (typeof currentActiveAiAnalysisCache !== 'undefined') currentActiveAiAnalysisCache = null;
};
// コミュニティ・ランキング表示の修正
(function initCommunityAndBlockMock() {
let startX = 0, startY = 0, currentX = 0, isDragging = false, isHorizontal = null, currentCommunityTab = 'ranking';
const communityView = document.getElementById('view-community');
function getAreas() {
return {
rankArea: document.getElementById('leaderboardSection') || document.getElementById('leaderboardContainer')?.parentElement,
friendArea: document.getElementById('friendSection') || document.getElementById('friendListContainer')?.parentElement,
tabRank: document.getElementById('tabBtnRank') || document.getElementById('btnCommunityRank'),
tabFriend: document.getElementById('tabBtnFriend') || document.getElementById('btnCommunityFriend')
};
}
if (communityView) {
const style = document.createElement('style');
style.innerHTML = `@keyframes slideInFromRight { 0% { opacity: 0; transform: translateX(50px); } 100% { opacity: 1; transform: translateX(0); } } @keyframes slideInFromLeft { 0% { opacity: 0; transform: translateX(-50px); } 100% { opacity: 1; transform: translateX(0); } } .slide-from-right { animation: slideInFromRight 0.3s cubic-bezier(0.25, 1, 0.5, 1) forwards; } .slide-from-left { animation: slideInFromLeft 0.3s cubic-bezier(0.25, 1, 0.5, 1) forwards; }`;
document.head.appendChild(style);
    communityView.addEventListener('touchstart', e => {
         if (e.target.closest('#gameLeaderboardArea button') || e.target.closest('#lbBtnModeJa') || e.target.closest('#lbBtnModeEn') || e.target.closest('#lbBtnModeMix')) {
             isDragging = false;
             return;
         }
         startX = e.touches[0].clientX; startY = e.touches[0].clientY;
         isDragging = true; isHorizontal = null;
         const { rankArea, friendArea } = getAreas();
         if (rankArea) rankArea.style.transition = 'none';
         if (friendArea) friendArea.style.transition = 'none';
     }, { passive: true });
     communityView.addEventListener('touchmove', e => {
         if (!isDragging) return;
         currentX = e.touches[0].clientX; let currentY = e.touches[0].clientY;
         let diffX = currentX - startX, diffY = currentY - startY;
         if (isHorizontal === null) {
             if (Math.abs(diffX) > Math.abs(diffY)) isHorizontal = true; 
             else { isHorizontal = false; isDragging = false; return; }
         }
         if (!isHorizontal) return;
         const { rankArea, friendArea } = getAreas();
         const activeArea = currentCommunityTab === 'ranking' ? rankArea : friendArea;
         if ((currentCommunityTab === 'ranking' && diffX < 0) || (currentCommunityTab === 'friend' && diffX > 0)) diffX = diffX * 0.2; 
         if (activeArea) {
             activeArea.style.transform = `translateX(${diffX}px)`;
             activeArea.style.opacity = 1 - (Math.abs(diffX) / window.innerWidth) * 1.5;
         }
     }, { passive: true });
     communityView.addEventListener('touchend', e => {
         if (!isDragging) { isHorizontal = null; return; }
         isDragging = false; isHorizontal = null;
         let diffX = currentX - startX;
         const threshold = window.innerWidth * 0.15; 
         const { rankArea, friendArea } = getAreas();
         const activeArea = currentCommunityTab === 'ranking' ? rankArea : friendArea;
         if (activeArea) activeArea.style.transition = 'all 0.25s cubic-bezier(0.25, 1, 0.5, 1)'; 
         if (diffX > threshold && currentCommunityTab === 'ranking') {
             if (activeArea) { activeArea.style.transform = `translateX(50px)`; activeArea.style.opacity = 0; }
             setTimeout(() => window.switchCommunitySubTab('friend', 'left'), 100);
         } else if (diffX < -threshold && currentCommunityTab === 'friend') {
             if (activeArea) { activeArea.style.transform = `translateX(-50px)`; activeArea.style.opacity = 0; }
             setTimeout(() => window.switchCommunitySubTab('ranking', 'right'), 100);
         } else {
             if (activeArea) { activeArea.style.transform = `translateX(0px)`; activeArea.style.opacity = 1; }
         }
     }, { passive: true });
 }
 window.switchCommunitySubTab = function(tabName, animDir = 'none') {
     currentCommunityTab = tabName;
     const { rankArea, friendArea, tabRank, tabFriend } = getAreas();
     if (rankArea) { rankArea.style.transition = 'none'; rankArea.style.transform = 'translateX(0)'; rankArea.style.opacity = '1'; rankArea.classList.remove('slide-from-right', 'slide-from-left'); void rankArea.offsetWidth; }
     if (friendArea) { friendArea.style.transition = 'none'; friendArea.style.transform = 'translateX(0)'; friendArea.style.opacity = '1'; friendArea.classList.remove('slide-from-right', 'slide-from-left'); void friendArea.offsetWidth; }
     let animClass = animDir === 'right' ? 'slide-from-right' : animDir === 'left' ? 'slide-from-left' : '';
     if (tabName === 'ranking') {
         if (rankArea) { rankArea.style.display = 'block'; if (animClass) rankArea.classList.add(animClass); }
         if (friendArea) friendArea.style.display = 'none';
         if (tabRank) tabRank.classList.add('active');
         if (tabFriend) tabFriend.classList.remove('active');
         if(typeof window.renderLeaderboard === 'function') window.renderLeaderboard();
     } else if (tabName === 'friend') {
         if (rankArea) { rankArea.style.display = 'none'; }
         if (friendArea) { friendArea.style.display = 'block'; if (animClass) friendArea.classList.add(animClass); }
         if (tabRank) tabRank.classList.remove('active');
         if (tabFriend) tabFriend.classList.add('active');
         if(typeof window.sortAndRenderFriendList === 'function') window.sortAndRenderFriendList();
     }
 };
})();
// ==========================================================================
// 📦 統合機能パッチ（アプリ内完結版）
// ==========================================================================

// ------------------------------------------------------------------
// 1. ユーザー別理解度管理
// ------------------------------------------------------------------
var currentUserVocabProgress = {};
var currentTargetVocabNum = null;

window.getVocabProgressStorageKey = function(bookKey) {
  var uid = (typeof myId !== "undefined" && myId) ? myId : "GUEST-000";
  return "core_v4_user_vocab_progress_" + uid + "_" + (bookKey || "default");
};

window.buildWordSignature = function(w) {
  var texts = (w.meanings || []).map(function(m) {
    return String(m.text || "").trim();
  }).join("|");
  return [String(w.num || ""), String(w.word || "").trim().toLowerCase(), texts].join("::");
};

window.stripVocabProgressFromWords = function(words) {
  return (words || []).map(function(w) {
    var clean = { num: w.num, word: w.word, meaning: w.meaning || "", sub: w.sub || "" };
    if (Array.isArray(w.meanings) && w.meanings.length > 0) {
      clean.meanings = w.meanings.map(function(m, i) {
        return { id: m.id || (String(w.num) + "-" + i), text: m.text || "" };
      });
    }
    return clean;
  });
};

window.extractUserProgressFromVocabList = function() {
  var progress = {};
  vocabList.forEach(function(w) {
    var key = String(w.num);
    var wp = {
      sig: window.buildWordSignature(w),
      status: w.status || "none",
      history: Array.isArray(w.history) ? w.history.slice(-20) : [],
      meanings: {}
    };
    (w.meanings || []).forEach(function(m) {
      wp.meanings[m.id] = {
        status: m.status || "none",
        history: Array.isArray(m.history) ? m.history.slice(-20) : []
      };
    });
    progress[key] = wp;
  });
  return progress;
};

window.applyUserProgressToVocabList = function() {
  var progress = currentUserVocabProgress || {};
  vocabList = vocabList.map(function(w) {
    w = window.migrateVocabData([w])[0];
    var key = String(w.num);
    var p = progress[key];
    w.status = "none";
    w.history = [];
    w.meanings = (w.meanings || []).map(function(m) {
      return { id: m.id, text: m.text, status: "none", history: [] };
    });
    if (p && p.sig === window.buildWordSignature(w)) {
      w.status = p.status || "none";
      w.history = Array.isArray(p.history) ? p.history.slice(-20) : [];
      w.meanings = w.meanings.map(function(m) {
        var mp = p.meanings ? p.meanings[m.id] : null;
        if (mp) {
          return { id: m.id, text: m.text, status: mp.status || "none", history: Array.isArray(mp.history) ? mp.history.slice(-20) : [] };
        }
        return m;
      });
    }
    return w;
  });
  if (typeof window.rebuildVocabStemIndex === "function") window.rebuildVocabStemIndex();
  userStats.vocab_fixed = vocabList.filter(function(w) {
    return w.meanings && w.meanings.some(function(m) { return m.status === "ok"; });
  }).length;
};
window.loadUserVocabProgress = async function(bookKey) {
bookKey = bookKey || currentTextbook || "default";
currentUserVocabProgress = {};
if (typeof myId === "undefined" || !myId) return;
// ✅ 常に localStorage を先に読み込んでベースにする（Firebase失敗時の保険）
try {
var raw = localStorage.getItem(window.getVocabProgressStorageKey(bookKey));
if (raw) currentUserVocabProgress = JSON.parse(raw) || {};
} catch (e) {}
// ゲスト、または Firebase 未接続ならローカルのみで終了
if (myId === "GUEST-000" || !window.db || !window.fbGetDoc || !window.fbDoc) {
return;
}
// Firebase にデータがあれば、それで上書き（クラウド優先）
try {
const ref = window.fbDoc(window.db, "users", myId, "vocabProgress", bookKey);
const snap = await window.fbGetDoc(ref);
if (snap.exists() && snap.data() && snap.data().words) {
currentUserVocabProgress = snap.data().words;
}
// ※ Firebase が空でも、上で読み込んだ localStorage のデータを維持する
} catch (e) {
// ※ 例外時も、上で読み込んだ localStorage のデータを維持する
console.error("loadUserVocabProgress Firebase読み込みエラー（ローカルデータで継続）:", e);
}
};
window.saveUserVocabProgress = async function() {
if (typeof window.rebuildVocabStemIndex === "function") window.rebuildVocabStemIndex();
if (typeof myId === "undefined" || !myId) return;
const bookKey = currentTextbook || "default";
currentUserVocabProgress = window.extractUserProgressFromVocabList();
const payload = { words: currentUserVocabProgress, updatedAt: new Date().toISOString() };
// ✅ ローカル保存（最優先・確実に）
try {
localStorage.setItem(window.getVocabProgressStorageKey(bookKey), JSON.stringify(currentUserVocabProgress));
} catch (e) {
console.error("saveUserVocabProgress ローカル保存エラー:", e);
}
// ✅ Firebase保存（リトライ付き・エラー可視化）
if (window.db && window.fbSetDoc && window.fbDoc && myId && myId !== "GUEST-000") {
try {
const ref = window.fbDoc(window.db, "users", myId, "vocabProgress", bookKey);
if (typeof window.fbSetDocWithRetry === "function") {
await window.fbSetDocWithRetry(ref, payload);
} else {
await window.fbSetDoc(ref, payload);
}
} catch (e) {
console.error("saveUserVocabProgress Firebase保存エラー（ローカルには保存済み）:", e);
}
}
userStats.vocab_fixed = vocabList.filter(function(w) {
return w.meanings && w.meanings.some(function(m) { return m.status === "ok"; });
}).length;
};
window.saveVocabMasterToStorage = async function() {
  if (typeof window.rebuildVocabStemIndex === "function") window.rebuildVocabStemIndex();
  const bookKey = currentTextbook || "default";
  const uid = (typeof myId !== "undefined" && myId) ? myId : "GUEST-000";
  const masterWords = window.stripVocabProgressFromWords(vocabList);
  textbooksCacheMap[bookKey] = masterWords;
  try {
    localStorage.setItem("core_v4_cache_" + bookKey, JSON.stringify(masterWords));
    localStorage.setItem("core_v4_custom_words_" + uid + "_" + bookKey, JSON.stringify(masterWords));
  } catch (e) {}
  if (window.db && window.fbSetDoc && window.fbDoc) {
    try {
      const docName = currentTextbook ? "vocab_" + currentTextbook : "vocab";
      const sharedRef = window.fbDoc(window.db, "shared", docName);
      await window.fbSetDoc(sharedRef, { custom_words: masterWords, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {}
  }
};

// ------------------------------------------------------------------
// 2. 軽量化（デバウンス保存・部分更新）
// ------------------------------------------------------------------
window.__vocabSaveTimer = null;
window.__userStatsTimer = null;
window.__vocabRenderTimer = null;

window.scheduleVocabProgressSave = function(delay) {
  delay = delay || 500;
  if (window.__vocabSaveTimer) clearTimeout(window.__vocabSaveTimer);
  window.__vocabSaveTimer = setTimeout(async function() {
    window.__vocabSaveTimer = null;
    try { await window.saveUserVocabProgress(); } catch (e) {}
  }, delay);
};

window.flushVocabProgressSave = async function() {
  if (window.__vocabSaveTimer) { clearTimeout(window.__vocabSaveTimer); window.__vocabSaveTimer = null; }
  try { await window.saveUserVocabProgress(); } catch (e) {}
};

window.scheduleUserStatsRefresh = function(delay) {
  delay = delay || 500;
  if (window.__userStatsTimer) clearTimeout(window.__userStatsTimer);
  window.__userStatsTimer = setTimeout(function() {
    window.__userStatsTimer = null;
    userStats.vocab_fixed = vocabList.filter(function(w) {
      return w.meanings && w.meanings.some(function(m) { return m.status === "ok"; });
    }).length;
    window.saveUserStats();
    window.checkAndRewardTitleBonusXP();
    window.applyProfileToUi();
    window.renderLeaderboard();
  }, delay);
};

window.flushUserStatsRefresh = function() {
  if (window.__userStatsTimer) { clearTimeout(window.__userStatsTimer); window.__userStatsTimer = null; }
  userStats.vocab_fixed = vocabList.filter(function(w) {
    return w.meanings && w.meanings.some(function(m) { return m.status === "ok"; });
  }).length;
  window.saveUserStats();
  window.checkAndRewardTitleBonusXP();
  window.applyProfileToUi();
  window.renderLeaderboard();
};

window.scheduleVocabListRender = function(delay) {
  delay = delay || 600;
  if (window.__vocabRenderTimer) clearTimeout(window.__vocabRenderTimer);
  window.__vocabRenderTimer = setTimeout(function() {
    window.__vocabRenderTimer = null;
    if (typeof window.renderVocabList === "function") window.renderVocabList();
  }, delay);
};

window.vocabCardMatchesFilter = function(w) {
  var startEl = document.getElementById("vocabRangeStart");
  var endEl = document.getElementById("vocabRangeEnd");
  var searchEl = document.getElementById("vocabSearchInput");
  var startRange = startEl ? (parseInt(startEl.value) || 0) : 0;
  var endRange = endEl ? (parseInt(endEl.value) || 99999) : 99999;
  var searchKeyword = searchEl ? searchEl.value.toLowerCase().trim() : "";
  var n = parseInt(w.num);
  if (!isNaN(n) && (n < startRange || n > endRange)) return false;
  if (vocabFilter !== "all") {
    if (!(w.meanings || []).some(function(m) { return m.status === vocabFilter; })) return false;
  }
  if (searchKeyword) {
    if (!String(w.word || "").toLowerCase().includes(searchKeyword) && !String(w.meaning || "").includes(searchKeyword)) return false;
  }
  return true;
};

window.buildVocabDotsHtml = function(w) {
  var hasAnyHistory = w.meanings && w.meanings.some(function(m) { return m.history && m.history.length > 0; });
  var dotsHtml = "";
  if (hasAnyHistory) {
    var groupsHtml = [];
    w.meanings.forEach(function(m) {
      var gh = '<div style="display:flex; gap:2px; align-items:center;">';
      if (m.history && m.history.length > 0) {
        m.history.slice(-5).forEach(function(h) {
          var mark = h === "ok" ? "◯" : h === "so" ? "△" : "✕";
          var bg = h === "ok" ? "#10B981" : h === "so" ? "#F59E0B" : "#EF4444";
          var color = h === "so" ? "#0F172A" : "white";
          gh += '<span style="padding:2px 4px; border-radius:4px; font-size:9px; font-weight:800; background:' + bg + '; color:' + color + ';">' + mark + '</span>';
        });
      } else {
        gh += '<span style="color:var(--text-sub); font-size:10px; padding:0 4px;">-</span>';
      }
      gh += '</div>';
      groupsHtml.push(gh);
    });
    dotsHtml = '<div style="display:flex; flex-wrap:wrap; gap:4px; align-items:center; justify-content:flex-end; margin-top:0;">';
    groupsHtml.forEach(function(g, i) {
      dotsHtml += g;
      if (i < groupsHtml.length - 1) {
        if ((i + 1) % 3 === 0) dotsHtml += '<div style="flex-basis:100%; height:0;"></div>';
        else dotsHtml += '<span style="color:rgba(255,255,255,0.2); font-size:12px; font-weight:bold;">/</span>';
      }
    });
    dotsHtml += '</div>';
  }
  return '<div style="display:flex; justify-content:flex-end; align-items:center; margin-top:12px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.1);">' + dotsHtml + '</div>';
};

window.updateVocabCardUi = function(wordNum) {
  var w = vocabList.find(function(item) { return String(item.num) === String(wordNum); });
  if (!w) return;
  var body = document.getElementById("wordCardBody-" + wordNum);
  if (!body) {
    if (window.vocabCardMatchesFilter(w)) window.scheduleVocabListRender(600);
    return;
  }
  var card = body.closest(".word-row-container");
  if (!card) return;
  if (!window.vocabCardMatchesFilter(w)) {
    card.style.transition = "opacity 0.35s ease, transform 0.35s ease";
    card.style.opacity = "0";
    card.style.transform = "scale(0.97)";
    setTimeout(function() { if (!window.vocabCardMatchesFilter(w)) card.remove(); }, 350);
    return;
  }
  card.setAttribute("style", window.getCardStyleByHistory(w));
  card.style.opacity = "";
  card.style.transform = "";
  var meaningsContainer = body.children[1];
  if (meaningsContainer && meaningsContainer.children) {
    var rows = meaningsContainer.children;
    (w.meanings || []).forEach(function(m, idx) {
      var row = rows[idx];
      if (!row) return;
      var btns = row.querySelectorAll("button");
      if (!btns || btns.length < 4) return;
      btns[0].style.background = m.status === "ok" ? "var(--word-ok)" : "rgba(0,0,0,0.5)";
      btns[0].style.color = m.status === "ok" ? "#000" : "white";
      btns[1].style.background = m.status === "so" ? "var(--word-so)" : "rgba(0,0,0,0.5)";
      btns[1].style.color = m.status === "so" ? "#000" : "white";
      btns[2].style.background = m.status === "bad" ? "var(--word-bad)" : "rgba(0,0,0,0.5)";
      btns[2].style.color = m.status === "bad" ? "#FFF" : "white";
      btns[3].style.background = m.status === "none" ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.5)";
      btns[3].style.color = "white";
    });
  }
  var lastChild = body.lastElementChild;
  if (lastChild && lastChild.style && lastChild.style.justifyContent === "flex-end") {
    lastChild.outerHTML = window.buildVocabDotsHtml(w);
  }
};

// ------------------------------------------------------------------
// 3. 上書き: saveVocabToStorage / loadCurrentTextbookData / preload
// ------------------------------------------------------------------
window.saveVocabToStorage = async function() {
  if (typeof window.rebuildVocabStemIndex === "function") window.rebuildVocabStemIndex();
  await window.saveUserVocabProgress();
  if (window.isAdmin) await window.saveVocabMasterToStorage();
};

window.preloadAllTextbooksAndVocab = async function() {
  await window.syncTextbooksIndexFromFirestore();
  if (window.db && window.fbGetDoc && window.fbDoc) {
    for (const book of textbooksPool) {
      try {
        const docName = "vocab_" + book.id;
        const sharedRef = window.fbDoc(window.db, "shared", docName);
        const sharedSnap = await window.fbGetDoc(sharedRef);
        if (sharedSnap.exists() && sharedSnap.data().custom_words) {
          const masterWords = window.stripVocabProgressFromWords(sharedSnap.data().custom_words);
          textbooksCacheMap[book.id] = masterWords;
          localStorage.setItem("core_v4_cache_" + book.id, JSON.stringify(masterWords));
        }
      } catch (e) {}
    }
  }
};

window.loadCurrentTextbookData = async function() {
  let storedWords = [];
  const bookKey = currentTextbook || "default";
  const uid = (typeof myId !== "undefined" && myId) ? myId : "GUEST-000";
  const currentLocalKey = "core_v4_custom_words_" + uid + "_" + bookKey;
  if (textbooksCacheMap[bookKey]) {
    storedWords = textbooksCacheMap[bookKey];
  } else {
    const localCache = localStorage.getItem("core_v4_cache_" + bookKey);
    if (localCache) storedWords = JSON.parse(localCache);
    else storedWords = JSON.parse(localStorage.getItem(currentLocalKey) || "[]");
  }
  storedWords = window.stripVocabProgressFromWords(storedWords);
  vocabList = window.migrateVocabData(storedWords);
  await window.loadUserVocabProgress(bookKey);
  window.applyUserProgressToVocabList();
  if (typeof window.rebuildVocabStemIndex === "function") window.rebuildVocabStemIndex();
  userStats.vocab_reg = vocabList.length;
  window.updateFlashcardSourceSelectOptions();
  window.renderVocabList();
  const currentBook = textbooksPool.find(b => b.id === currentTextbook);
  const coverContainer = document.getElementById("vocabCoverContainer");
  const titleContainer = document.getElementById("vocabBookTitle");
  if (currentBook) {
    if (coverContainer) {
      if (currentBook.coverType === "image" && currentBook.cover) {
        coverContainer.innerHTML = '<img src="' + currentBook.cover + '" style="width:100%; height:100%; object-fit:cover; border-radius:50%; border:1px solid rgba(255,255,255,0.2);">';
      } else {
        coverContainer.innerText = currentBook.cover || "📔";
      }
    }
    if (titleContainer) titleContainer.innerText = currentBook.name;
  } else {
    if (coverContainer) coverContainer.innerText = "📔";
    if (titleContainer) titleContainer.innerText = "共通単語帳";
  }
  if (typeof window.applyVocabMaxRange === "function") window.applyVocabMaxRange();
  if (typeof window.injectVocabStatsButton === "function") window.injectVocabStatsButton();
};

// ------------------------------------------------------------------
// 4. 上書き: updateMeaningStatus（部分更新＋デバウンス）
// ------------------------------------------------------------------
window.updateMeaningStatus = function(wordNum, meaningId, status, event) {
  if (event) event.stopPropagation();
  var wIdx = vocabList.findIndex(function(w) { return String(w.num) === String(wordNum); });
  if (wIdx < 0) return;
  var mIdx = vocabList[wIdx].meanings.findIndex(function(m) { return String(m.id) === String(meaningId); });
  if (mIdx < 0) return;
  if (status === "none") {
    vocabList[wIdx].meanings[mIdx].status = "none";
    vocabList[wIdx].meanings[mIdx].history = [];
  } else {
    vocabList[wIdx].meanings[mIdx].status = status;
    if (!vocabList[wIdx].meanings[mIdx].history) vocabList[wIdx].meanings[mIdx].history = [];
    vocabList[wIdx].meanings[mIdx].history.push(status);
    totalExp += 1;
  }
  var agg = [];
  vocabList[wIdx].meanings.forEach(function(m) {
    if (m.history && m.history.length > 0) agg = agg.concat(m.history);
  });
  vocabList[wIdx].history = agg.slice(-20);
  vocabList[wIdx].status = window.wordOverallStatus(vocabList[wIdx]);
  userStats.vocab_fixed = vocabList.filter(function(w) {
    return w.meanings && w.meanings.some(function(m) { return m.status === "ok"; });
  }).length;
  window.updateVocabCardUi(wordNum);
  window.scheduleVocabProgressSave(450);
  window.scheduleUserStatsRefresh(600);
};

// ------------------------------------------------------------------
// 5. フラッシュカード テンポ改善
// ------------------------------------------------------------------
window.__flashcardSessionActive = false;
window.__flashcardNextDelay = 150;

window.createFlickTrailParticle = function(x, y, type) {
  var p = document.createElement("div");
  p.className = "fc-history-bubble";
  p.style.position = "fixed";
  p.style.left = x + "px";
  p.style.top = y + "px";
  p.style.width = (Math.random() * 8 + 6) + "px";
  p.style.height = p.style.width;
  p.style.pointerEvents = "none";
  p.style.zIndex = "5000";
  p.style.opacity = "0.85";
  p.style.transform = "translate(-50%, -50%)";
  p.style.transition = "all 0.8s cubic-bezier(0.1, 0.8, 0.25, 1)";
  if (type === "right") p.classList.add("ok");
  else if (type === "left") p.classList.add("bad");
  else if (type === "up") p.classList.add("so");
  else p.style.borderColor = "rgba(255,255,255,0.6)";
  document.body.appendChild(p);
  setTimeout(function() {
    var dx = (Math.random() - 0.5) * 40;
    var dy = -60 - Math.random() * 40;
    p.style.transform = "translate(calc(-50% + " + dx + "px), calc(-50% + " + dy + "px)) scale(0)";
    p.style.opacity = "0";
  }, 10);
  setTimeout(function() { p.remove(); }, 850);
};

window.swipeFlashcard = function(direction, finalDx, finalDy) {
  finalDx = finalDx || 0;
  finalDy = finalDy || 0;
  var card = document.getElementById("activeFlashcard");
  if (!card || card.dataset.swiped === "1") return;
  card.dataset.swiped = "1";
  var currentWord = flashcardOriginQueue[flashcardCurrentIndex];
  if (!currentWord) return;
  var cleanKey = String(currentWord.en || "").toLowerCase().replace(/[^a-z0-9\u0080-\uffff]/g, "");
  var status = "none";
  var rect = card.getBoundingClientRect();
  var releaseX = rect.left + rect.width / 2;
  var releaseY = rect.top + rect.height / 2;
  // ゴーストカード（エフェクト継続用）
  var ghost = card.cloneNode(true);
  ghost.id = "flashcardGhost";
  ghost.style.position = "fixed";
  ghost.style.left = (rect.left - finalDx) + "px";
  ghost.style.top = (rect.top - finalDy) + "px";
  ghost.style.width = rect.width + "px";
  ghost.style.height = rect.height + "px";
  ghost.style.margin = "0";
  ghost.style.zIndex = "5000";
  ghost.style.pointerEvents = "none";
  ghost.style.animation = "none";
  ghost.style.transform = "translate3d(" + finalDx + "px, " + finalDy + "px, 0) rotate(" + (finalDx * 0.05) + "deg)";
  ghost.style.opacity = "1";
  document.body.appendChild(ghost);
  requestAnimationFrame(function() {
    ghost.style.transition = "transform 0.8s cubic-bezier(0.1, 0.8, 0.25, 1), opacity 0.8s ease";
    ghost.style.transform = "translate3d(" + finalDx + "px, " + finalDy + "px, 0) scale(0) rotate(" + (finalDx * 0.05) + "deg)";
    ghost.style.opacity = "0";
  });
  setTimeout(function() { ghost.remove(); }, 850);
  // パーティクル
  for (var i = 0; i < 15; i++) {
    setTimeout(function() {
      window.createFlickTrailParticle(releaseX + (Math.random() - 0.5) * 80, releaseY + (Math.random() - 0.5) * 80, direction);
    }, i * 15);
  }
  // 残像リップル
  var ripple = document.createElement("div");
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
  // ステータス判定
  if (direction === "right") { status = "ok"; flashcardLearnedCount++; }
  else if (direction === "left") { status = "bad"; }
  else if (direction === "up") { status = "so"; }
  totalExp += 1;
  wordMemory[cleanKey] = status;
  localStorage.setItem("wordMemory", JSON.stringify(wordMemory));
  var vocabMatch = vocabList.find(function(v) { return String(v.num) === String(currentWord.num); });
if (!vocabMatch) {
vocabMatch = vocabList.find(function(v) { return v.word.toLowerCase() === cleanKey; });
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
  }
  userStats.flash_count++;
  userStats.vocab_fixed = vocabList.filter(function(w) {
    return w.meanings && w.meanings.some(function(m) { return m.status === "ok"; });
  }).length;
  window.scheduleVocabProgressSave(700);
  window.scheduleUserStatsRefresh(700);
  // テンポ改善: 150ms後に次のカード
  setTimeout(function() {
    flashcardCurrentIndex++;
    window.renderFlashcardDeck();
    var rightEdge = document.getElementById("fcEdgeRippleRight");
    var leftEdge = document.getElementById("fcEdgeRippleLeft");
    var topEdge = document.getElementById("fcEdgeRippleTop");
    if (rightEdge) rightEdge.style.opacity = 0;
    if (leftEdge) leftEdge.style.opacity = 0;
    if (topEdge) topEdge.style.opacity = 0;
  }, window.__flashcardNextDelay);
};

// ------------------------------------------------------------------
// 6. シーズンランキング
// ------------------------------------------------------------------
window.__gameLbTab = window.__gameLbTab || "hall";
window.__seasonLbView = window.__seasonLbView || "current";
window.__seasonRankingAnchor = window.__seasonRankingAnchor || new Date(2026, 6, 27, 0, 0, 0);

window.getSeasonModeOrder = function() { return ["ja2en", "en2ja", "mixed"]; };
window.getSeasonModeLabel = function(mode) {
  if (mode === "ja2en") return "英訳";
  if (mode === "en2ja") return "和訳";
  return "まぜ";
};
window.getCurrentSeasonNo = function() {
  const now = new Date();
  const anchor = window.__seasonRankingAnchor;
  if (now < anchor) return 0;
  const diffDays = Math.floor((now.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
};
window.getSeasonStart = function(seasonNo) {
  return new Date(window.__seasonRankingAnchor.getTime() + (seasonNo - 1) * 7 * 24 * 60 * 60 * 1000);
};
window.getSeasonEnd = function(seasonNo) {
  return new Date(window.__seasonRankingAnchor.getTime() + seasonNo * 7 * 24 * 60 * 60 * 1000 - 1000);
};
window.getSeasonMode = function(seasonNo) {
  const modes = window.getSeasonModeOrder();
  if (seasonNo <= 0) return modes[0];
  return modes[(seasonNo - 1) % modes.length];
};
window.formatSeasonDate = function(d) {
  return d.getFullYear() + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + String(d.getDate()).padStart(2, "0");
};
window.getSeasonRemainingText = function(seasonNo) {
  const end = window.getSeasonEnd(seasonNo);
  const diff = end.getTime() - Date.now();
  if (diff <= 0) return "終了";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return "残り " + days + "日" + hours + "時間";
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return "残り " + hours + "時間" + minutes + "分";
};
window.getSeasonStartCountdownText = function() {
  const start = window.getSeasonStart(1);
  const diff = start.getTime() - Date.now();
  if (diff <= 0) return "シーズン開始済み";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return "第1シーズン開始まで あと " + days + "日" + hours + "時間";
  return "第1シーズン開始まで あと " + hours + "時間";
};
window.ensureSeasonUserStats = function() {
  if (!userStats) return;
  if (!Array.isArray(userStats.seasonTitles)) userStats.seasonTitles = [];
  if (!Array.isArray(userStats.settledSeasons)) userStats.settledSeasons = [];
};
window.sortRankingScores = function(scores) {
  return (scores || []).slice().sort(function(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return (a.timestamp || 0) - (b.timestamp || 0);
  });
};
window.makeRankingDateStr = function(d) {
  return (d.getMonth() + 1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
};

window.submitHallScore = async function(mode, score, oldBest) {
  if (!mode || score <= 0 || !myId || myId === "GUEST-000") return;
  const bestKey = "cosmic_best_" + mode + "_endless";
  if (!window.db || !window.fbSetDoc || !window.fbDoc || !window.fbGetDoc) {
    if (score > oldBest) localStorage.setItem(bestKey, String(score));
    return;
  }
  try {
    const ref = window.fbDoc(window.db, "shared", "game_hall_" + mode);
    const snap = await window.fbGetDoc(ref);
    let scores = snap.exists() && snap.data().scores ? snap.data().scores : [];
    const existing = scores.find(function(s) { return s.id === myId; });
    const currentBest = existing ? Math.max(existing.score, oldBest) : oldBest;
    if (score <= currentBest) {
      if (existing) localStorage.setItem(bestKey, String(existing.score));
      return;
    }
    localStorage.setItem(bestKey, String(score));
    const now = new Date();
    scores = scores.filter(function(s) { return s.id !== myId; });
    scores.push({ id: myId, name: myName, score: score, timestamp: now.getTime(), date: window.makeRankingDateStr(now) });
    scores = window.sortRankingScores(scores).slice(0, 20);
    await window.fbSetDoc(ref, { scores: scores, updatedAt: now.toISOString() }, { merge: true });
  } catch (e) {}
};

window.submitSeasonScore = async function(mode, score) {
  if (!mode || score <= 0 || !myId || myId === "GUEST-000") return;
  const seasonNo = window.getCurrentSeasonNo();
  if (seasonNo <= 0) return;
  const seasonMode = window.getSeasonMode(seasonNo);
  if (mode !== seasonMode) return;
  const bestKey = "season_best_" + seasonNo + "_" + mode + "_" + myId;
  const oldBest = parseInt(localStorage.getItem(bestKey) || "0");
  if (!window.db || !window.fbSetDoc || !window.fbDoc || !window.fbGetDoc) {
    if (score > oldBest) localStorage.setItem(bestKey, String(score));
    return;
  }
  try {
    const docName = "game_season_" + seasonNo + "_" + mode;
    const ref = window.fbDoc(window.db, "shared", docName);
    const snap = await window.fbGetDoc(ref);
    let scores = snap.exists() && snap.data().scores ? snap.data().scores : [];
    const existing = scores.find(function(s) { return s.id === myId; });
    const currentBest = existing ? Math.max(existing.score, oldBest) : oldBest;
    if (score <= currentBest) {
      if (existing) localStorage.setItem(bestKey, String(existing.score));
      return;
    }
    localStorage.setItem(bestKey, String(score));
    const now = new Date();
    scores = scores.filter(function(s) { return s.id !== myId; });
    scores.push({ id: myId, name: myName, score: score, timestamp: now.getTime(), date: window.makeRankingDateStr(now) });
    scores = window.sortRankingScores(scores).slice(0, 20);
    await window.fbSetDoc(ref, { seasonNo: seasonNo, mode: mode, scores: scores, updatedAt: now.toISOString() }, { merge: true });
  } catch (e) {}
};

window.checkAndSettleSeasonTitles = async function() {
  if (!myId || myId === "GUEST-000") return;
  window.ensureSeasonUserStats();
  const currentSeasonNo = window.getCurrentSeasonNo();
  if (currentSeasonNo <= 1) return;
  let changed = false;
  for (let seasonNo = 1; seasonNo < currentSeasonNo; seasonNo++) {
    if (userStats.settledSeasons.includes(seasonNo)) continue;
    const mode = window.getSeasonMode(seasonNo);
    try {
      if (window.db && window.fbGetDoc && window.fbDoc) {
        const ref = window.fbDoc(window.db, "shared", "game_season_" + seasonNo + "_" + mode);
        const snap = await window.fbGetDoc(ref);
        if (snap.exists() && snap.data().scores) {
          const scores = window.sortRankingScores(snap.data().scores);
          const myIndex = scores.findIndex(function(s) { return s.id === myId; });
          if (myIndex >= 0 && myIndex < 3) {
            const rank = myIndex + 1;
            const modeLabel = window.getSeasonModeLabel(mode);
            const titleName = "第" + seasonNo + "シーズン" + modeLabel + "ランキング" + rank + "位";
            if (!userStats.seasonTitles.includes(titleName)) {
              userStats.seasonTitles.push(titleName);
              changed = true;
            }
          }
        }
      }
    } catch (e) {}
    userStats.settledSeasons.push(seasonNo);
    changed = true;
  }
  if (changed) {
    await window.saveUserStats();
    if (typeof window.renderTitles === "function") window.renderTitles();
  }
};

// ------------------------------------------------------------------
// 7. ゲームランキングUI（殿堂/シーズン切替）
// ------------------------------------------------------------------
window.setGameLbTab = function(tab) { window.__gameLbTab = tab; window.renderGameLeaderboard(); };
window.setSeasonLbView = function(view) { window.__seasonLbView = view; window.renderGameLeaderboard(); };

window.injectGameLbControls = function() {
  const container = document.getElementById("leaderboardListContainer");
  if (!container || !container.parentNode) return;
  let ctrl = document.getElementById("gameLbTabControl");
  if (!ctrl) {
    ctrl = document.createElement("div");
    ctrl.id = "gameLbTabControl";
    container.parentNode.insertBefore(ctrl, container);
  }
  const seasonNo = window.getCurrentSeasonNo();
  const tabBtn = function(active) {
    return "flex:1; padding:8px 10px; border-radius:8px; border:1px solid " + (active ? "var(--cosmic-cyan)" : "rgba(255,255,255,0.15)") + "; background:" + (active ? "linear-gradient(135deg, rgba(0,240,255,0.25) 0%, rgba(192,132,252,0.25) 100%)" : "rgba(7,11,25,0.6)") + "; color:" + (active ? "#FFFFFF" : "var(--text-sub)") + "; font-size:12px; font-weight:900; cursor:pointer;";
  };
  const subBtn = function(active) {
    return "flex:1; padding:6px 8px; border-radius:8px; border:1px solid " + (active ? "var(--cosmic-purple-light)" : "rgba(255,255,255,0.12)") + "; background:" + (active ? "rgba(192,132,252,0.22)" : "rgba(0,0,0,0.35)") + "; color:" + (active ? "#FFFFFF" : "var(--text-sub)") + "; font-size:11px; font-weight:800; cursor:pointer;";
  };
  let seasonControls = "";
  if (window.__gameLbTab === "season") {
    const curActive = window.__seasonLbView === "current";
    const prevActive = window.__seasonLbView === "previous";
    let infoHtml = "";
    if (seasonNo <= 0) {
      infoHtml = '<div style="margin-top:8px; font-size:11px; color:var(--cosmic-cyan); font-weight:800;">' + window.getSeasonStartCountdownText() + '</div>';
    } else {
      const viewNo = curActive ? seasonNo : seasonNo - 1;
      if (viewNo <= 0) {
        infoHtml = '<div style="margin-top:8px; font-size:11px; color:var(--text-sub); font-weight:700;">前シーズンはありません。</div>';
      } else {
        const mode = window.getSeasonMode(viewNo);
        const modeLabel = window.getSeasonModeLabel(mode);
        const start = window.getSeasonStart(viewNo);
        const end = window.getSeasonEnd(viewNo);
        const statusText = curActive ? window.getSeasonRemainingText(viewNo) : "終了";
        infoHtml = '<div style="margin-top:8px; font-size:11px; color:var(--text-sub); line-height:1.5;">' +
          '<div style="color:var(--cosmic-cyan); font-weight:900;">第' + viewNo + 'シーズン（' + modeLabel + '）</div>' +
          '<div>' + window.formatSeasonDate(start) + ' 〜 ' + window.formatSeasonDate(end) + '</div>' +
          '<div style="color:#FFFFFF; font-weight:800;">' + statusText + '</div></div>';
      }
    }
    seasonControls = '<div style="display:flex; gap:8px; margin-top:8px;">' +
      '<button style="' + subBtn(curActive) + '" onclick="window.setSeasonLbView(\'current\')">現在のシーズン</button>' +
      '<button style="' + subBtn(prevActive) + '" onclick="window.setSeasonLbView(\'previous\')">前シーズン</button></div>' + infoHtml;
  }
  ctrl.innerHTML = '<div style="display:flex; gap:8px; margin-bottom:10px;">' +
    '<button style="' + tabBtn(window.__gameLbTab === "hall") + '" onclick="window.setGameLbTab(\'hall\')">殿堂</button>' +
    '<button style="' + tabBtn(window.__gameLbTab === "season") + '" onclick="window.setGameLbTab(\'season\')">シーズン</button></div>' + seasonControls;
};

window.buildRankingRowHtml = function(record, index) {
  const rankColors = ["#FBBF24", "#94A3B8", "#D97706", "white", "white", "white"];
  const rankColor = rankColors[index] || "white";
  const isMe = record.id === myId;
  const bgStyle = isMe ? "background: linear-gradient(135deg, rgba(192, 132, 252, 0.15) 0%, rgba(15, 23, 42, 0.6) 100%); border-left: 3px solid var(--cosmic-purple-light);" : "border-bottom:1px solid rgba(255,255,255,0.05);";
  const displayName = isMe ? record.name + " (あなた)" : record.name;
  return '<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 8px; ' + bgStyle + '">' +
    '<div style="display:flex; gap:12px; align-items:center;">' +
    '<span style="color:' + rankColor + '; font-weight:900; font-size:14px; width:18px; text-align:center;">' + (index + 1) + '</span>' +
    '<span style="color:white; font-weight:800; letter-spacing:0.5px;">' + displayName + '</span></div>' +
    '<div style="text-align:right;"><span style="color:var(--cosmic-cyan); font-weight:900; font-family:monospace; font-size:13px; margin-right:8px;">' +
    record.score + ' <span style="font-size:8px; font-weight:normal; color:var(--text-sub);">PTS</span></span>' +
    '<span style="color:var(--text-sub); font-size:9px; display:block; margin-top:1px;">' + (record.date || "") + '</span></div></div>';
};

window.renderGameLeaderboard = async function() {
  const container = document.getElementById("leaderboardListContainer");
  if (!container) return;
  window.injectGameLbControls();
  if (myId === "GUEST-000") {
    container.innerHTML = '<div style="color:var(--text-sub); font-size:12px; text-align:center; padding:12px;">ゲストはランキング対象外です。</div>';
    return;
  }
  container.innerHTML = '<div style="color:var(--text-sub); font-size:12px; text-align:center; padding:12px;">ランキングを読み込み中...</div>';
  if (window.__gameLbTab === "season") {
    const seasonNo = window.getCurrentSeasonNo();
    if (seasonNo <= 0) {
      container.innerHTML = '<div style="color:var(--text-sub); font-size:12px; text-align:center; padding:12px;">' + window.getSeasonStartCountdownText() + '</div>';
      return;
    }
    const viewNo = window.__seasonLbView === "previous" ? seasonNo - 1 : seasonNo;
    if (viewNo <= 0) {
      container.innerHTML = '<div style="color:var(--text-sub); font-size:12px; text-align:center; padding:12px;">前シーズンはありません。</div>';
      return;
    }
    const mode = window.getSeasonMode(viewNo);
    let scores = [];
    if (window.db && window.fbGetDoc && window.fbDoc) {
      try {
        const ref = window.fbDoc(window.db, "shared", "game_season_" + viewNo + "_" + mode);
        const snap = await window.fbGetDoc(ref);
        if (snap.exists() && snap.data().scores) scores = window.sortRankingScores(snap.data().scores);
      } catch (e) {}
    }
    if (scores.length === 0) {
      container.innerHTML = '<div style="color:var(--text-sub); font-size:12px; text-align:center; padding:12px;">第' + viewNo + 'シーズン（' + window.getSeasonModeLabel(mode) + '）のランキングはまだありません。</div>';
      return;
    }
    container.innerHTML = "";
    scores.forEach(function(record, index) { container.innerHTML += window.buildRankingRowHtml(record, index); });
  } else {
    const mode = currentLbMode || "ja2en";
    let scores = [];
    if (window.db && window.fbGetDoc && window.fbDoc) {
      try {
        const ref = window.fbDoc(window.db, "shared", "game_hall_" + mode);
        const snap = await window.fbGetDoc(ref);
        if (snap.exists() && snap.data().scores) scores = window.sortRankingScores(snap.data().scores);
      } catch (e) {}
    }
    if (scores.length === 0) {
      const localBest = parseInt(localStorage.getItem("cosmic_best_" + mode + "_endless") || "0");
      if (localBest > 0 && myId && myId !== "GUEST-000") {
        scores = [{ id: myId, name: myName, score: localBest, date: "ローカル記録", timestamp: 0 }];
      }
    }
    if (scores.length === 0) {
      container.innerHTML = '<div style="color:var(--text-sub); font-size:12px; text-align:center; padding:12px;">まだランキング記録がありません。</div>';
      return;
    }
    container.innerHTML = "";
    scores.forEach(function(record, index) { container.innerHTML += window.buildRankingRowHtml(record, index); });
  }
};

// ------------------------------------------------------------------
// 8. endGameSession上書き（殿堂＋シーズン保存）
// ------------------------------------------------------------------
const __originalEndGameSessionForPatch = window.endGameSession;
window.endGameSession = async function() {
  const mode = selectedQuestionMode;
  const score = gameScoreCount;
  const isEndless = currentGameDifficulty === "endless";
  const oldBest = parseInt(localStorage.getItem("cosmic_best_" + mode + "_endless") || "0");
  if (typeof __originalEndGameSessionForPatch === "function") {
    __originalEndGameSessionForPatch.apply(this, arguments);
  }
  if (isEndless && score > 0 && myId && myId !== "GUEST-000") {
    await window.submitHallScore(mode, score, oldBest);
    await window.submitSeasonScore(mode, score);
    if (typeof window.renderGameLeaderboard === "function") window.renderGameLeaderboard();
  }
};

// ------------------------------------------------------------------
// 9. シーズン称号表示
// ------------------------------------------------------------------
const __originalRenderTitlesForPatch = window.renderTitles;
window.renderTitles = function() {
  if (typeof __originalRenderTitlesForPatch === "function") __originalRenderTitlesForPatch();
  window.renderSeasonTitles();
};
window.renderSeasonTitles = function() {
  const listContainer = document.getElementById("titles-list");
  const selectEl = document.getElementById("sideSelectTitle");
  if (!listContainer) return;
  window.ensureSeasonUserStats();
  const oldSection = document.getElementById("seasonTitlesSection");
  if (oldSection) oldSection.remove();
  if (!userStats.seasonTitles || userStats.seasonTitles.length === 0) return;
  const section = document.createElement("div");
  section.id = "seasonTitlesSection";
  let html = '<div style="margin:18px 0 10px 0; font-size:14px; font-weight:900; color:var(--cosmic-cyan);">🏆 シーズン称号</div>';
  userStats.seasonTitles.forEach(function(titleName) {
    if (selectEl) {
      const exists = Array.from(selectEl.options).some(function(opt) { return opt.value === titleName; });
      if (!exists) {
        const opt = document.createElement("option");
        opt.value = titleName;
        opt.innerText = titleName;
        selectEl.appendChild(opt);
      }
    }
    const isEquipped = selectedTitle === titleName;
    html += '<div class="word-row-container" style="border-radius:12px; padding:14px; margin-bottom:10px; border:1.5px solid #FBBF24; background:linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(30,41,59,0.9) 100%); box-sizing:border-box;">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">' +
      '<div style="font-weight:900; font-size:15px; color:#FBBF24;">' + titleName + '</div>' +
      '<span class="badge-legendary" style="padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold;">シーズン</span></div>' +
      '<button class="modern-btn" style="height:34px; font-size:11px; background:' + (isEquipped ? "var(--word-ok-bg)" : "rgba(0,0,0,0.3)") + '; border-color:' + (isEquipped ? "var(--word-ok)" : "#FBBF24") + '; color:' + (isEquipped ? "var(--word-ok)" : "white") + '; box-shadow:none;" onclick="window.equipTitle(\'' + titleName + '\')">' +
      (isEquipped ? "セット中" : "称号をセットする") + '</button></div>';
  });
  section.innerHTML = html;
  listContainer.appendChild(section);
  if (selectEl) selectEl.value = selectedTitle;
};

// ------------------------------------------------------------------
// 10. EXP全ユーザーランキング
// ------------------------------------------------------------------
window.__leaderboardCache = null;
window.__leaderboardCacheAt = 0;
window.__leaderboardLoadingPromise = null;

window.fetchAllExpLeaderboardUsers = async function() {
  const users = [];
  if (!window.db || !window.fbGetDoc || !window.fbDoc) return users;
  let allUsers = [];
  try { allUsers = await window.getAllUsers(); } catch (e) {}
  const ids = [];
  (allUsers || []).forEach(function(u) {
    if (u && u.id && u.id !== "GUEST-000" && ids.indexOf(u.id) === -1) ids.push(u.id);
  });
  if (typeof myId !== "undefined" && myId && myId !== "GUEST-000" && ids.indexOf(myId) === -1) ids.push(myId);
  for (const id of ids) {
    try {
      const ref = window.fbDoc(window.db, "users", id);
      const snap = await window.fbGetDoc(ref);
      if (!snap.exists()) continue;
      const d = snap.data();
      if (d.deleted) continue;
      const stats = d.userStats || {};
      let exp = parseInt(d.totalExp) || 0;
      let level = stats.user_level ? (parseInt(stats.user_level) || 1) : window.calculateLevelFromExp(exp).level;
      let name = d.playerName || "";
      if (!name) {
        const basic = (allUsers || []).find(function(u) { return u.id === id; });
        name = basic ? (basic.playerName || basic.realName || "修行者") : "修行者";
      }
      users.push({
        id: id, name: name, title: d.selectedTitle || "称号なし",
        exp: exp, lvl: level, icon: "👤",
        customAvatar: (typeof d.avatar === "string") ? d.avatar : "",
        isMe: id === myId
      });
    } catch (e) {}
  }
  return users;
};

window.drawExpLeaderboard = function(container, users) {
  let html = "";
  users.forEach(function(u, idx) {
    const rankColor = idx === 0 ? "#FBBF24" : idx === 1 ? "#94A3B8" : idx === 2 ? "#D97706" : "#FFFFFF";
    const bgStyle = u.isMe ? "background: linear-gradient(90deg, rgba(0, 240, 255, 0.15) 0%, rgba(15, 23, 42, 0.6) 100%); border: 1px solid var(--cosmic-cyan);" : "background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);";
    let avatarStr = '<span style="font-size:16px;">' + (u.icon || "👤") + '</span>';
    if (u.customAvatar) avatarStr = '<img src="' + u.customAvatar + '" style="width:24px; height:24px; border-radius:50%; object-fit:cover; border:1px solid var(--cosmic-cyan);">';
    html += '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; border-radius:8px; margin-bottom:4px; ' + bgStyle + ' font-size:12px;">' +
      '<div style="display:flex; align-items:center; gap:10px;">' +
      '<span style="color:' + rankColor + '; font-weight:900; font-size:14px; width:18px; text-align:center;">' + (idx + 1) + '</span>' +
      '<div style="width:24px; height:24px; display:flex; align-items:center; justify-content:center;">' + avatarStr + '</div>' +
      '<div><div style="font-weight:bold; color:white;">' + u.name + ' <span style="font-size:9px; color:var(--cosmic-cyan); font-weight:normal; margin-left:4px;">LV.' + u.lvl + '</span></div>' +
      '<div style="font-size:9px; color:var(--text-sub); margin-top:1px;">' + u.title + '</div></div></div>' +
      '<div style="text-align:right; font-weight:900; color:var(--word-so); font-family:monospace;">' + u.exp + ' <span style="font-size:8px; color:var(--text-sub); font-weight:normal;">EXP</span></div></div>';
  });
  container.innerHTML = html;
};

window.renderLeaderboard = async function(force) {
  const container = document.getElementById("leaderboardContainer");
  if (!container) return;
  if (typeof myId === "undefined" || myId === "GUEST-000") {
    container.innerHTML = '<div style="color:var(--text-sub); font-size:12px; text-align:center; padding:12px;">ゲストはランキング対象外です。</div>';
    return;
  }
  let lvlData = window.calculateLevelFromExp(totalExp);
  userStats.user_level = lvlData.level;
  const selfAvatar = localStorage.getItem("core_v4_user_avatar_" + myId) || "";
  const selfUser = { id: myId, name: myName + " (あなた)", title: selectedTitle, exp: totalExp, lvl: lvlData.level, icon: "👤", customAvatar: selfAvatar, isMe: true };
  const now = Date.now();
  const cacheValid = window.__leaderboardCache && (now - window.__leaderboardCacheAt < 60000);
  if (cacheValid && !force) {
    let users = window.__leaderboardCache.filter(function(u) { return u.id !== myId; }).map(function(u) { return Object.assign({}, u); });
    users.push(selfUser);
    users.sort(function(a, b) { return b.exp - a.exp; });
    window.drawExpLeaderboard(container, users.slice(0, 50));
    return;
  }
  container.innerHTML = '<div style="color:var(--text-sub); font-size:12px; text-align:center; padding:12px;">ランキングを取得中...</div>';
  try {
    if (!window.__leaderboardLoadingPromise) {
      window.__leaderboardLoadingPromise = window.fetchAllExpLeaderboardUsers()
        .then(function(users) { window.__leaderboardCache = users; window.__leaderboardCacheAt = Date.now(); return users; })
        .finally(function() { window.__leaderboardLoadingPromise = null; });
    }
    const remoteUsers = await window.__leaderboardLoadingPromise;
    let users = (remoteUsers || []).filter(function(u) { return u.id !== myId; }).map(function(u) { return Object.assign({}, u); });
    users.push(selfUser);
    users.sort(function(a, b) { return b.exp - a.exp; });
    window.drawExpLeaderboard(container, users.slice(0, 50));
  } catch (e) {
    window.drawExpLeaderboard(container, [selfUser]);
  }
};

// ------------------------------------------------------------------
// 11. フレンド最新化
// ------------------------------------------------------------------
window.__friendRefreshLastAt = 0;
window.__friendRefreshButtonInjected = false;

window.formatFriendLastLogin = function(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.getFullYear() + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + String(d.getDate()).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
};

window.injectFriendRefreshButton = function() {
  if (window.__friendRefreshButtonInjected) return;
  const container = document.getElementById("friendListContainer");
  if (!container || !container.parentNode) return;
  if (document.getElementById("friendRefreshButton")) { window.__friendRefreshButtonInjected = true; return; }
  const btn = document.createElement("button");
  btn.id = "friendRefreshButton";
  btn.type = "button";
  btn.textContent = "🔄 最新情報に更新";
  btn.style.cssText = "width:100%; height:38px; margin:8px 0 12px 0; background:rgba(0,240,255,0.12); color:var(--cosmic-cyan); border:1px solid var(--cosmic-cyan); border-radius:10px; font-weight:800; font-size:12px; cursor:pointer;";
  btn.onclick = function() { window.manualRefreshFriendList(); };
  container.parentNode.insertBefore(btn, container);
  window.__friendRefreshButtonInjected = true;
};

window.refreshFriendListFromFirebase = async function(force) {
  if (typeof myId === "undefined" || !myId || myId === "GUEST-000") return;
  if (!window.db || !window.fbGetDoc || !window.fbDoc) return;
  if (!Array.isArray(myFriendList) || myFriendList.length === 0) return;
  const now = Date.now();
  if (!force && window.__friendRefreshLastAt && now - window.__friendRefreshLastAt < 60000) return;
  window.__friendRefreshLastAt = now;
  let changed = false;
  for (let i = 0; i < myFriendList.length; i++) {
    const f = myFriendList[i];
    try {
      const ref = window.fbDoc(window.db, "users", f.code);
      const snap = await window.fbGetDoc(ref);
      if (!snap.exists()) continue;
      const d = snap.data();
      if (d.deleted) continue;
      const stats = d.userStats || {};
      let remoteLevel = f.level || 1;
      if (stats.user_level) remoteLevel = parseInt(stats.user_level) || remoteLevel;
      else if (d.totalExp !== undefined && d.totalExp !== null) remoteLevel = window.calculateLevelFromExp(parseInt(d.totalExp) || 0).level;
      const remoteName = d.playerName || f.name;
      const remoteTitle = d.selectedTitle || f.title || "称号なし";
      const remoteAvatar = (typeof d.avatar === "string") ? d.avatar : (f.customAvatar || "");
      const remoteStudyTime = parseInt(stats.study_burst) || 0;
      let remoteLastLoginStr = f.lastLoginStr || "";
      const lastIso = stats.lastLoginAt || d.updatedAt || "";
      if (lastIso) { const formatted = window.formatFriendLastLogin(lastIso); if (formatted) remoteLastLoginStr = formatted; }
      let remoteTimestamp = f.timestamp || now;
      if (lastIso) { const t = new Date(lastIso).getTime(); if (!isNaN(t)) remoteTimestamp = t; }
      if (f.name !== remoteName || f.title !== remoteTitle || f.customAvatar !== remoteAvatar || f.level !== remoteLevel || f.studyTime !== remoteStudyTime || f.lastLoginStr !== remoteLastLoginStr || f.timestamp !== remoteTimestamp) {
        f.name = remoteName; f.title = remoteTitle; f.customAvatar = remoteAvatar;
        f.level = remoteLevel; f.studyTime = remoteStudyTime; f.lastLoginStr = remoteLastLoginStr; f.timestamp = remoteTimestamp;
        changed = true;
      }
    } catch (e) {}
  }
  if (changed) { try { await window.saveUserStats(); } catch (e) {} }
  if (typeof window.sortAndRenderFriendList === "function") window.sortAndRenderFriendList();
};

window.manualRefreshFriendList = async function() {
  const btn = document.getElementById("friendRefreshButton");
  if (btn) { btn.disabled = true; btn.textContent = "更新中..."; }
  try { await window.refreshFriendListFromFirebase(true); }
  catch (e) { alert("フレンド情報の更新に失敗しました。"); }
  finally { if (btn) { btn.disabled = false; btn.textContent = "🔄 最新情報に更新"; } }
};

// ------------------------------------------------------------------
// 12. 欠番検索パネル
// ------------------------------------------------------------------
window.injectMissingNumberSearchPanel = function() {
  if (document.getElementById("missingNumberSearchPanel")) return;
  const anchor = document.getElementById("bulkWordInput");
  if (!anchor || !anchor.parentNode) return;
  const panel = document.createElement("div");
  panel.id = "missingNumberSearchPanel";
  panel.style.cssText = "margin:12px 0; padding:12px; border:1px dashed rgba(0,240,255,0.35); border-radius:12px; background:rgba(0,0,0,0.25);";
  panel.innerHTML = '<div style="font-size:12px; font-weight:800; color:var(--cosmic-cyan); margin-bottom:8px;">🔢 欠番検索</div>' +
    '<div style="display:flex; gap:8px; align-items:center; margin-bottom:8px; flex-wrap:wrap;">' +
    '<input type="number" id="missingRangeStart" class="search-input" placeholder="開始" style="width:90px; height:36px; margin:0;">' +
    '<span style="color:var(--text-sub); font-size:12px;">〜</span>' +
    '<input type="number" id="missingRangeEnd" class="search-input" placeholder="終了" style="width:90px; height:36px; margin:0;">' +
    '<button class="list-action-link" style="height:36px;" onclick="window.runMissingNumberSearch()">検索</button></div>' +
    '<div style="font-size:11px; color:var(--text-sub); margin-bottom:8px;">空欄の場合は 1〜登録最大番号 で検索します。</div>' +
    '<div id="missingNumberResultSummary" style="font-size:12px; color:#fff; margin-bottom:8px;"></div>' +
    '<textarea id="missingNumberCopyText" class="modern-textarea" readonly style="height:80px; margin:0 0 8px 0; font-size:12px;"></textarea>' +
    '<button class="list-action-link" style="height:36px; width:100%; text-align:center;" onclick="window.copyMissingNumberText()">欠番をコピー</button>';
  anchor.parentNode.insertBefore(panel, anchor.nextSibling);
};

window.runMissingNumberSearch = function() {
  const summary = document.getElementById("missingNumberResultSummary");
  const copyArea = document.getElementById("missingNumberCopyText");
  if (!summary || !copyArea) return;
  const maxNum = (vocabList || []).reduce(function(max, w) { const n = parseInt(w.num); return isNaN(n) ? max : Math.max(max, n); }, 0);
  const startEl = document.getElementById("missingRangeStart");
  const endEl = document.getElementById("missingRangeEnd");
  const startIsBlank = !startEl || startEl.value.trim() === "";
  const endIsBlank = !endEl || endEl.value.trim() === "";
  let start = startIsBlank ? 1 : parseInt(startEl.value);
  let end = endIsBlank ? maxNum : parseInt(endEl.value);
  if (endIsBlank && maxNum <= 0) { summary.innerText = "単語が登録されていないため、欠番を検索できません。"; copyArea.value = ""; return; }
  if (isNaN(start) || isNaN(end)) { summary.innerText = "開始番号と終了番号を正しく入力してください。"; copyArea.value = ""; return; }
  if (start > end) { const tmp = start; start = end; end = tmp; }
  if (end - start > 100000) { summary.innerText = "検索範囲が広すぎます。100000件以内にしてください。"; copyArea.value = ""; return; }
  const existingNums = new Set();
  (vocabList || []).forEach(function(w) { const n = parseInt(w.num); if (!isNaN(n)) existingNums.add(n); });
  const missing = [];
  for (let n = start; n <= end; n++) { if (!existingNums.has(n)) missing.push(n); }
  if (missing.length === 0) { summary.innerText = "欠番はありません（" + start + "〜" + end + "）"; copyArea.value = ""; return; }
  const preview = missing.slice(0, 200).join(", ") + (missing.length > 200 ? " ..." : "");
  summary.innerHTML = '欠番: <strong style="color:var(--cosmic-cyan);">' + missing.length + '件</strong>（' + start + '〜' + end + '）<br><span style="color:var(--text-sub); font-size:11px;">' + preview + '</span>';
  copyArea.value = missing.join("\n");
};

window.copyMissingNumberText = async function() {
  const copyArea = document.getElementById("missingNumberCopyText");
  if (!copyArea || !copyArea.value) { alert("コピーする欠番がありません。先に検索してください。"); return; }
  try { await navigator.clipboard.writeText(copyArea.value); alert("欠番をコピーしました。"); }
  catch (e) {
    copyArea.removeAttribute("readonly"); copyArea.select(); document.execCommand("copy"); copyArea.setAttribute("readonly", "");
    alert("欠番をコピーしました。");
  }
};

// ------------------------------------------------------------------
// 13. 管理画面: 教材選択で単語帳切替
// ------------------------------------------------------------------
window.setCurrentTextbookAndReload = async function(bookId) {
  if (!bookId) return;
  if (typeof textbooksPool === "undefined" || !Array.isArray(textbooksPool)) return;
  const book = textbooksPool.find(function(b) { return b.id === bookId; });
  if (!book) return;
  currentTextbook = bookId;
  try { localStorage.setItem("core_v4_current_textbook_id", currentTextbook); } catch (e) {}
  if (typeof window.loadCurrentTextbookData === "function") await window.loadCurrentTextbookData();
  if (typeof window.updateFlashcardSourceSelectOptions === "function") window.updateFlashcardSourceSelectOptions();
};

const __prevHandleAdminEditSelectChangeForPatch = window.handleAdminEditSelectChange;
window.handleAdminEditSelectChange = async function(val) {
  if (typeof __prevHandleAdminEditSelectChangeForPatch === "function") __prevHandleAdminEditSelectChangeForPatch(val);
  if (!val) return;
  await window.setCurrentTextbookAndReload(val);
};

const __prevSaveOrUpdateTextbookFromAdminForPatch = window.saveOrUpdateTextbookFromAdmin;
window.saveOrUpdateTextbookFromAdmin = async function() {
  const selectEl = document.getElementById("adminEditBookSelect");
  const selectedBefore = selectEl ? selectEl.value : "";
  const wasExisting = selectedBefore && Array.isArray(textbooksPool) && textbooksPool.some(function(b) { return b.id === selectedBefore; });
  if (typeof __prevSaveOrUpdateTextbookFromAdminForPatch === "function") await __prevSaveOrUpdateTextbookFromAdminForPatch.apply(this, arguments);
  if (wasExisting && selectedBefore) await window.setCurrentTextbookAndReload(selectedBefore);
};

// ------------------------------------------------------------------
// 14. アカウント安定化
// ------------------------------------------------------------------
window.__authProcessing = false;
window.__allUsersExactWrite = false;
window.__lastLoginRecorded = false;

window.mergeAllUsersSafe = async function(incomingUsers, exactWrite) {
  let baseUsers = [];
  if (window.db && window.fbGetDoc && window.fbDoc) {
    try {
      const ref = window.fbDoc(window.db, "shared", "all_users");
      const snap = await window.fbGetDoc(ref);
      if (snap.exists() && snap.data().users) baseUsers = snap.data().users;
    } catch (e) {}
  }
  if (exactWrite) return incomingUsers || [];
  const userMap = new Map();
  (baseUsers || []).forEach(function(u) { if (u && u.id) userMap.set(u.id, u); });
  (incomingUsers || []).forEach(function(u) {
    if (u && u.id) { const old = userMap.get(u.id) || {}; userMap.set(u.id, Object.assign({}, old, u)); }
  });
  return Array.from(userMap.values());
};

const __prevSaveAllUsersForPatch = window.saveAllUsers;
window.saveAllUsers = async function(users) {
  const exactWrite = window.__allUsersExactWrite === true;
  window.__allUsersExactWrite = false;
  let finalUsers = users || [];
  try { finalUsers = await window.mergeAllUsersSafe(users, exactWrite); } catch (e) {}
  try { localStorage.setItem("core_v4_users", JSON.stringify(finalUsers)); } catch (e) {}
  if (window.db && window.fbSetDoc && window.fbDoc) {
    try {
      const ref = window.fbDoc(window.db, "shared", "all_users");
      await window.fbSetDoc(ref, { users: finalUsers }, { merge: true });
    } catch (e) {}
  }
};

window.ensureUserInAllUsers = async function(user) {
  if (!user || !user.id || user.id === "GUEST-000") return;
  let users = [];
  try { users = await window.getAllUsers(); } catch (e) {}
  if ((users || []).some(function(u) { return u && u.id === user.id; })) return;
  users.push({ id: user.id, playerName: user.playerName || "修行者", realName: user.realName || "一般", age: user.age || "18", pin: user.pin || "" });
  await window.saveAllUsers(users);
};

const __prevShowLoginConfirmPopupForPatch = window.showLoginConfirmPopup;
window.showLoginConfirmPopup = function(user) {
  const res = __prevShowLoginConfirmPopupForPatch ? __prevShowLoginConfirmPopupForPatch.apply(this, arguments) : undefined;
  setTimeout(function() {
    const confirmBtn = document.getElementById("confirmLoginBtn");
    if (confirmBtn && !confirmBtn.dataset.accountPatchWrapped) {
      confirmBtn.dataset.accountPatchWrapped = "1";
      const oldOnClick = confirmBtn.onclick;
      confirmBtn.onclick = async function() {
        try { await window.ensureUserInAllUsers(user); } catch (e) {}
        if (typeof oldOnClick === "function") oldOnClick();
      };
    }
  }, 0);
  return res;
};

const __prevHandleAuthSubmitForPatch = window.handleAuthSubmit;
window.handleAuthSubmit = async function() {
  if (window.__authProcessing) return;
  const btn = document.getElementById("authSubmitBtn");
  window.__authProcessing = true;
  if (btn) btn.disabled = true;
  try {
    if (typeof __prevHandleAuthSubmitForPatch === "function") await __prevHandleAuthSubmitForPatch.apply(this, arguments);
  } finally {
    window.__authProcessing = false;
    if (btn) btn.disabled = false;
  }
};

window.recordLastLoginOnce = async function() {
  if (typeof myId === "undefined" || !myId || myId === "GUEST-000") return;
  if (window.__lastLoginRecorded) return;
  window.__lastLoginRecorded = true;
  try { userStats.lastLoginAt = new Date().toISOString(); await window.saveUserStats(); } catch (e) {}
};

window.logoutToGate = function() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key === "core_v4_userId" || key === "core_v4_userName" || key === "core_v4_userTarget" || key === "core_v4_userTitle" ||
          key === "core_v4_totalExp" || key === "core_v4_friend_list" || key === "core_v4_rewarded_titles_cache" ||
          key === "core_v4_active_char" || key === "core_v4_active_weapon" || key === "core_v4_active_armor" ||
          key === "core_v4_current_textbook_id" || key.indexOf("core_v4_user_stats_") === 0 ||
          key.indexOf("core_v4_user_avatar_") === 0 || key.indexOf("core_v4_user_vocab_progress_") === 0 ||
          key.indexOf("core_v4_study_") === 0) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(function(key) { localStorage.removeItem(key); });
  } catch (e) { localStorage.clear(); }
  location.reload();
};

// ------------------------------------------------------------------
// 15. 管理者: ユーザーID復旧ボックス
// ------------------------------------------------------------------
window.injectAdminUserRepairBox = function() {
  if (document.getElementById("adminUserRepairBox")) return;
  const container = document.getElementById("adminUserListContainer");
  if (!container || !container.parentNode) return;
  const box = document.createElement("div");
  box.id = "adminUserRepairBox";
  box.style.cssText = "margin-bottom:12px; padding:12px; border:1px dashed rgba(0,240,255,0.35); border-radius:12px; background:rgba(0,0,0,0.25);";
  box.innerHTML = '<div style="font-size:12px; font-weight:800; color:var(--cosmic-cyan); margin-bottom:8px;">🧩 ユーザー一覧復旧</div>' +
    '<input type="text" id="adminRepairUserIdInput" class="search-input" placeholder="復旧したいユーザーID" style="margin-bottom:8px;">' +
    '<button class="list-action-link" style="width:100%; height:36px; text-align:center;" onclick="window.repairUserIntoAllUsers()">ユーザー一覧に復旧</button>';
  container.parentNode.insertBefore(box, container);
};

window.repairUserIntoAllUsers = async function() {
  const input = document.getElementById("adminRepairUserIdInput");
  if (!input) return;
  const targetId = input.value.trim().toUpperCase();
  if (!targetId) { alert("復旧したいユーザーIDを入力してください。"); return; }
  if (!window.db || !window.fbGetDoc || !window.fbDoc) { alert("Firebaseに接続されていないため復旧できません。"); return; }
  try {
    const ref = window.fbDoc(window.db, "users", targetId);
    const snap = await window.fbGetDoc(ref);
    if (!snap.exists()) { alert("指定されたIDのユーザーは Firebase 上に見つかりません。"); return; }
    const d = snap.data();
    if (d.deleted) { alert("指定されたユーザーは削除済みです。"); return; }
    let users = await window.getAllUsers();
    if ((users || []).some(function(u) { return u && u.id === targetId; })) { alert("そのユーザーは既にユーザー一覧に登録されています。"); input.value = ""; return; }
    users.push({ id: targetId, playerName: d.playerName || "修行者", realName: d.realName || "一般", age: d.age || "18", pin: d.pin || "" });
    await window.saveAllUsers(users);
    alert("ユーザー一覧に復旧しました。");
    input.value = "";
    window.renderAdminUserList();
  } catch (e) { alert("ユーザー復旧に失敗しました。"); }
};

// ------------------------------------------------------------------
// 16. switchTab上書き（全機能のUI注入）
// ------------------------------------------------------------------
const __prevSwitchTabForAllPatch = window.switchTab;
window.switchTab = function(tabId) {
  const res = __prevSwitchTabForAllPatch ? __prevSwitchTabForAllPatch.apply(this, arguments) : undefined;
  if (tabId === "community") {
    window.injectFriendRefreshButton();
    window.refreshFriendListFromFirebase(false);
    window.renderLeaderboard(false);
  }
  if (tabId === "admin") {
    window.injectMissingNumberSearchPanel();
    window.injectAdminUserRepairBox();
    if (typeof window.updateAdminEditBookSelectOptions === "function") window.updateAdminEditBookSelectOptions(currentTextbook || "");
  }
  if (tabId === "game") {
    window.renderGameLeaderboard();
  }
  return res;
};

// ------------------------------------------------------------------
// 17. loadLocalState上書き（全初期化）
// ------------------------------------------------------------------
const __prevLoadLocalStateForAllPatch = window.loadLocalState;
window.loadLocalState = async function() {
  const result = __prevLoadLocalStateForAllPatch ? await __prevLoadLocalStateForAllPatch.apply(this, arguments) : undefined;
  if (myId && myId !== "GUEST-000") {
    window.ensureSeasonUserStats();
    await window.checkAndSettleSeasonTitles();
    await window.recordLastLoginOnce();
    if (typeof window.renderGameLeaderboard === "function") window.renderGameLeaderboard();
    if (typeof window.renderLeaderboard === "function") window.renderLeaderboard(false);
  }
  return result;
};

// ------------------------------------------------------------------
// 18. 起動時注入
// ------------------------------------------------------------------
(function initAllPatches() {
  function boot() {
    window.injectFriendRefreshButton();
    window.injectAdminUserRepairBox();
    window.injectMissingNumberSearchPanel();
    window.recordLastLoginOnce();
  }
  if (document.readyState !== "loading") {
    setTimeout(boot, 300);
  } else {
    document.addEventListener("DOMContentLoaded", function() { setTimeout(boot, 300); });
  }
})();

// ------------------------------------------------------------------
// 19. ページ離脱時のフラッシュ保存
// ------------------------------------------------------------------
window.addEventListener("pagehide", function() {
  if (window.__vocabSaveTimer || window.__userStatsTimer || window.__flashcardSessionActive) {
    window.flushVocabProgressSave();
    window.flushUserStatsRefresh();
  }
});
document.addEventListener("visibilitychange", function() {
  if (document.visibilityState === "hidden") {
    if (window.__vocabSaveTimer || window.__userStatsTimer || window.__flashcardSessionActive) {
      window.flushVocabProgressSave();
      window.flushUserStatsRefresh();
    }
  }
});

// ------------------------------------------------------------------
// 20. シーズンランキング定期チェック（60秒間隔）
// ------------------------------------------------------------------
if (!window.__seasonRankingIntervalStarted) {
  window.__seasonRankingIntervalStarted = true;
  setInterval(function() {
    if (myId && myId !== "GUEST-000") {
      window.checkAndSettleSeasonTitles();
      if (window.__gameLbTab === "season" && typeof window.renderGameLeaderboard === "function") {
        window.renderGameLeaderboard();
      }
    }
  }, 60000);
}

console.log("📦 統合機能パッチ（アプリ内完結版）適用完了");
// ==========================================================================
// 🔐 ログイン安定化＆自動復旧パッチ
// ==========================================================================

// ------------------------------------------------------------------
// 1. getAllUsers: リトライ付きで確実に取得
// ------------------------------------------------------------------
window.getAllUsers = async function() {
  let users = [];

  if (window.db && window.fbGetDoc && window.fbDoc) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const ref = window.fbDoc(window.db, "shared", "all_users");
        const snap = await window.fbGetDoc(ref);
        if (snap.exists() && snap.data().users && Array.isArray(snap.data().users)) {
          users = snap.data().users;
          break;
        }
      } catch (e) {
        console.error("getAllUsers attempt " + (attempt + 1) + " failed:", e);
        if (attempt < 2) {
          await new Promise(function(r) { setTimeout(r, 600); });
        }
      }
    }
  }

  if (users.length === 0) {
    try {
      users = JSON.parse(localStorage.getItem("core_v4_users") || "[]");
    } catch (e) {
      users = [];
    }
  }

  return users;
};

// ------------------------------------------------------------------
// 2. saveAllUsers: ID単位マージで他のユーザーを消さない
// ------------------------------------------------------------------
window.saveAllUsers = async function(incomingUsers) {
  let existingUsers = [];

  if (window.db && window.fbGetDoc && window.fbDoc) {
    try {
      const ref = window.fbDoc(window.db, "shared", "all_users");
      const snap = await window.fbGetDoc(ref);
      if (snap.exists() && snap.data().users && Array.isArray(snap.data().users)) {
        existingUsers = snap.data().users;
      }
    } catch (e) {
      console.error("saveAllUsers merge fetch error:", e);
    }
  }

  var userMap = new Map();
  existingUsers.forEach(function(u) {
    if (u && u.id) userMap.set(u.id, u);
  });
  (incomingUsers || []).forEach(function(u) {
    if (u && u.id) userMap.set(u.id, u);
  });

  var mergedUsers = Array.from(userMap.values());

  try {
    localStorage.setItem("core_v4_users", JSON.stringify(mergedUsers));
  } catch (e) {}

  if (window.db && window.fbSetDoc && window.fbDoc) {
    try {
      const ref = window.fbDoc(window.db, "shared", "all_users");
      await window.fbSetDoc(ref, { users: mergedUsers }, { merge: true });
    } catch (e) {
      console.error("saveAllUsers Firebase error:", e);
    }
  }

  return mergedUsers;
};

// ------------------------------------------------------------------
// 3. ユーザーをall_usersに自動復旧
// ------------------------------------------------------------------
window.recoverUserToAllUsers = async function(userData) {
  if (!userData || !userData.id) return;

  try {
    const users = await window.getAllUsers();
    const exists = users.some(function(u) {
      return u && u.id === userData.id;
    });

    if (!exists) {
      users.push({
        id: userData.id,
        playerName: userData.playerName || "修行者",
        realName: userData.realName || "一般",
        age: userData.age || "18",
        pin: userData.pin || ""
      });
      await window.saveAllUsers(users);
      console.log("✅ ユーザー " + userData.id + " をall_usersに自動復旧");
    }
  } catch (e) {
    console.error("ユーザー自動復旧エラー:", e);
  }
};

// ------------------------------------------------------------------
// 4. Firebaseからユーザーを直接検索
// ------------------------------------------------------------------
window.findUserInFirebase = async function(userId, pin) {
  if (!window.db || !window.fbGetDoc || !window.fbDoc) return null;

  try {
    const userRef = window.fbDoc(window.db, "users", userId);
    const snap = await window.fbGetDoc(userRef);

    if (snap.exists()) {
      const data = snap.data();
      if (data.deleted) return null;
      if (data.pin === pin) {
        return {
          id: userId,
          playerName: data.playerName || "修行者",
          realName: data.realName || "一般",
          age: data.age || "18",
          pin: data.pin
        };
      }
    }
  } catch (e) {
    console.error("Firebase直接検索エラー:", e);
  }

  return null;
};

// ------------------------------------------------------------------
// 5. handleAuthSubmit: 3段階ログイン戦略＋自動復旧
// ------------------------------------------------------------------
window.handleAuthSubmit = async function() {
  const authReg = document.getElementById("authTabRegister");
  const isRegister = authReg ? authReg.classList.contains("active") : false;
  const errorMsg = document.getElementById("authErrorMsg");
  if (errorMsg) errorMsg.style.display = "none";

  if (isRegister) {
    const pName = document.getElementById("regPlayerName").value.trim();
    const rName = document.getElementById("regRealName").value.trim();
    const age = document.getElementById("regAge").value.trim();
    const pin = document.getElementById("regPin").value.trim();

    if (!pName || !rName || !age || !pin) {
      if (errorMsg) { errorMsg.innerText = "すべての項目を入力してください！"; errorMsg.style.display = "block"; }
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      if (errorMsg) { errorMsg.innerText = "暗証番号は4桁の数字で設定してください！"; errorMsg.style.display = "block"; }
      return;
    }

    const newId = window.generateUserId();
    const newUserObj = { id: newId, playerName: pName, realName: rName, age: age, pin: pin };

    const users = await window.getAllUsers();
    users.push(newUserObj);
    await window.saveAllUsers(users);

    if (window.db && window.fbSetDoc && window.fbDoc) {
      try {
        const userRef = window.fbDoc(window.db, "users", newId);
        await window.fbSetDoc(userRef, {
          id: newId,
          playerName: pName,
          realName: rName,
          age: age,
          pin: pin,
          selectedTitle: "称号なし",
          userTarget: "未設定",
          totalExp: 0,
          avatar: "",
          userStats: { user_level: 1, study_burst: 0 }
        }, { merge: true });
      } catch (e) {
        console.error("Firebase新規登録エラー:", e);
      }
    }

    alert("🎉 アカウント作成成功！\nあなたのログインIDは【 " + newId + " 】です。\nログインに必要なので必ずメモしてください！");
    localStorage.setItem("core_v4_userId", newId);
    localStorage.setItem("core_v4_userName", pName);
    localStorage.setItem("core_v4_userTarget", "未設定");
    localStorage.setItem("core_v4_totalExp", "0");
    window.loadLocalState();

  } else {
    const idInput = document.getElementById("loginIdInput").value.trim();
    const pinInput = document.getElementById("loginPinInput").value.trim();

    if (!idInput || !pinInput) {
      if (errorMsg) { errorMsg.innerText = "IDと暗証番号を入力してください！"; errorMsg.style.display = "block"; }
      return;
    }

    let user = null;
    let loginMethod = "";

    // 戦略1: all_users から検索
    try {
      const users = await window.getAllUsers();
      user = users.find(function(u) {
        return u && u.id === idInput && u.pin === pinInput;
      });
      if (user) loginMethod = "all_users";
    } catch (e) {
      console.error("戦略1 all_users検索エラー:", e);
    }

    // 戦略2: Firebase users/{id} から直接検索
    if (!user) {
      try {
        user = await window.findUserInFirebase(idInput, pinInput);
        if (user) loginMethod = "firebase_direct";
      } catch (e) {
        console.error("戦略2 Firebase直接検索エラー:", e);
      }
    }

    // 戦略3: ローカルキャッシュから検索
    if (!user) {
      try {
        const localUsers = JSON.parse(localStorage.getItem("core_v4_users") || "[]");
        user = localUsers.find(function(u) {
          return u && u.id === idInput && u.pin === pinInput;
        });
        if (user) loginMethod = "local_cache";
      } catch (e) {}
    }

    if (user) {
      // all_users以外から見つかった場合は自動復旧
      if (loginMethod !== "all_users") {
        try {
          await window.recoverUserToAllUsers(user);
        } catch (e) {
          console.error("ログイン時自動復旧エラー:", e);
        }
      }
      window.showLoginConfirmPopup(user);
    } else {
      if (errorMsg) {
        errorMsg.innerText = "IDまたは暗証番号が違います。\nネットワーク接続も確認してください。";
        errorMsg.style.display = "block";
      }
    }
  }
};

// ------------------------------------------------------------------
// 6. showLoginConfirmPopup: ログイン確定時に自動復旧
// ------------------------------------------------------------------
window.showLoginConfirmPopup = function(user) {
  if (document.getElementById("loginOverlayLayer")) return;

  const overlay = document.createElement("div");
  overlay.id = "loginOverlayLayer";
  overlay.className = "login-confirm-overlay";

  const box = document.createElement("div");
  box.className = "login-confirm-card";
  box.innerHTML =
    '<div class="login-confirm-avatar"><i data-lucide="user" size="32"></i></div>' +
    '<div style="color:white; font-size:18px; font-weight:800; margin-bottom:8px;">認証確認</div>' +
    '<div style="color:var(--text-sub); font-size:13px; margin-bottom:16px; line-height:1.6;">' +
    "以下のプロファイルでログインしますか？<br>" +
    '<div style="background:rgba(0,0,0,0.4); padding:10px; border-radius:8px; margin-top:8px; text-align:left;">' +
    "<strong>プレイヤー名:</strong> <span style=\"color:white;\">" + (user.playerName || "修行者") + "</span><br>" +
    "<strong>本名:</strong> <span style=\"color:white;\">" + (user.realName || "一般") + "</span><br>" +
    "<strong>年齢:</strong> <span style=\"color:white;\">" + (user.age || "18") + "歳</span>" +
    "</div></div>" +
    '<div style="display:flex; gap:12px;">' +
    '<button style="flex:1; padding:12px; border-radius:10px; border:none; background:var(--input-bg); color:var(--text-main); font-weight:700; cursor:pointer;" id="cancelLoginBtn">キャンセル</button>' +
    '<button style="flex:1; padding:12px; border-radius:10px; border:none; background:var(--cosmic-cyan); color:#000; font-weight:700; cursor:pointer;" id="confirmLoginBtn">ログイン</button>' +
    "</div>";

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  window.initLucide();

  document.getElementById("cancelLoginBtn").onclick = function() {
    document.body.removeChild(overlay);
  };

  document.getElementById("confirmLoginBtn").onclick = async function() {
    // ログイン確定時にall_usersへ自動復旧
    try {
      await window.recoverUserToAllUsers(user);
    } catch (e) {
      console.error("ログイン確定時自動復旧エラー:", e);
    }

    localStorage.setItem("core_v4_userId", user.id);
    localStorage.setItem("core_v4_userName", user.playerName || "修行者");
    if (!localStorage.getItem("core_v4_userTarget")) localStorage.setItem("core_v4_userTarget", "未設定");
    if (!localStorage.getItem("core_v4_totalExp")) localStorage.setItem("core_v4_totalExp", "0");

    document.body.removeChild(overlay);
    window.loadLocalState();
  };
};

// ------------------------------------------------------------------
// 7. 起動時にログインユーザーの存在確認＆自動復旧
// ------------------------------------------------------------------
window.autoRecoverCurrentUser = async function() {
  const savedId = localStorage.getItem("core_v4_userId");
  if (!savedId || savedId === "GUEST-000") return;

  try {
    const users = await window.getAllUsers();
    const exists = users.some(function(u) {
      return u && u.id === savedId;
    });

    if (!exists && window.db && window.fbGetDoc && window.fbDoc) {
      const userRef = window.fbDoc(window.db, "users", savedId);
      const snap = await window.fbGetDoc(userRef);

      if (snap.exists()) {
        const data = snap.data();
        if (!data.deleted) {
          await window.recoverUserToAllUsers({
            id: savedId,
            playerName: data.playerName || localStorage.getItem("core_v4_userName") || "修行者",
            realName: data.realName || "一般",
            age: data.age || "18",
            pin: data.pin || ""
          });
        }
      }
    }
  } catch (e) {
    console.error("起動時自動復旧エラー:", e);
  }
};

// ------------------------------------------------------------------
// 8. loadLocalState に自動復旧を組み込み
// ------------------------------------------------------------------
const __prevLoadLocalStateForLoginRecovery = window.loadLocalState;
window.loadLocalState = async function() {
  const result = __prevLoadLocalStateForLoginRecovery
    ? await __prevLoadLocalStateForLoginRecovery.apply(this, arguments)
    : undefined;

  await window.autoRecoverCurrentUser();

  return result;
};

// ------------------------------------------------------------------
// 9. 管理者用: 指定ユーザーをall_usersに強制復旧
// ------------------------------------------------------------------
window.forceRecoverUser = async function(targetUserId) {
  if (!targetUserId) {
    alert("復旧したいユーザーIDを入力してください。");
    return;
  }

  targetUserId = targetUserId.trim().toUpperCase();

  if (!window.db || !window.fbGetDoc || !window.fbDoc) {
    alert("Firebaseに接続されていません。");
    return;
  }

  try {
    const userRef = window.fbDoc(window.db, "users", targetUserId);
    const snap = await window.fbGetDoc(userRef);

    if (!snap.exists()) {
      alert("ユーザー " + targetUserId + " はFirebase上に見つかりません。");
      return;
    }

    const data = snap.data();
    if (data.deleted) {
      alert("ユーザー " + targetUserId + " は削除済みです。");
      return;
    }

    await window.recoverUserToAllUsers({
      id: targetUserId,
      playerName: data.playerName || "修行者",
      realName: data.realName || "一般",
      age: data.age || "18",
      pin: data.pin || ""
    });

    alert("✅ ユーザー " + targetUserId + " を復旧しました！");
    window.renderAdminUserList();
  } catch (e) {
    console.error("強制復旧エラー:", e);
    alert("復旧に失敗しました: " + e.message);
  }
};

console.log("🔐 ログイン安定化＆自動復旧パッチ 適用完了");
// ==========================================================================
// 🔑 PIN再設定（ログイン画面に「PINを忘れた場合」を追加）
// ==========================================================================
(function initPinRecovery() {

  function injectRecoveryButton() {
    if (document.getElementById("pinRecoveryBtn")) return;

    const loginFields = document.getElementById("authLoginFields");
    if (!loginFields) return;

    const btn = document.createElement("button");
    btn.id = "pinRecoveryBtn";
    btn.type = "button";
    btn.textContent = "🔑 PINを忘れた場合（再設定）";
    btn.style.cssText = "width:100%; margin-top:12px; padding:10px; background:none; border:1px dashed rgba(255,255,255,0.3); border-radius:8px; color:var(--text-sub); font-size:12px; font-weight:700; cursor:pointer;";
    btn.onclick = function() {
      openPinRecoveryDialog();
    };

    loginFields.appendChild(btn);
  }

  function openPinRecoveryDialog() {
    if (document.getElementById("pinRecoveryOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "pinRecoveryOverlay";
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px);";

    const box = document.createElement("div");
    box.style.cssText = "background:var(--card-bg); border:1px solid var(--cosmic-cyan); border-radius:16px; padding:24px; width:88%; max-width:340px; box-shadow:0 10px 40px rgba(0,240,255,0.3);";

    box.innerHTML = `
      <div style="color:white; font-size:18px; font-weight:800; margin-bottom:6px;">🔑 PIN再設定</div>
      <div style="color:var(--text-sub); font-size:12px; margin-bottom:16px; line-height:1.5;">
        管理者パスワードで本人確認を行い、<br>PINを再設定します。<br>
        <span style="color:var(--cosmic-cyan); font-size:11px;">※データは消えません。PINだけ変わります。</span>
      </div>

      <label style="font-size:11px; color:var(--cosmic-cyan); font-weight:700; display:block; margin-bottom:4px;">あなたのユーザーID</label>
      <input type="text" id="recoveryUserId" class="search-input" placeholder="例: ABCDEFG123" style="margin-bottom:12px;">

      <label style="font-size:11px; color:var(--cosmic-cyan); font-weight:700; display:block; margin-bottom:4px;">管理者パスワード</label>
      <input type="password" id="recoveryAdminPass" class="search-input" placeholder="管理者パスワード" style="margin-bottom:12px;">

      <label style="font-size:11px; color:var(--cosmic-cyan); font-weight:700; display:block; margin-bottom:4px;">新しいPIN（4桁の数字）</label>
      <input type="password" id="recoveryNewPin" class="search-input" placeholder="例: 1234" maxlength="4" style="margin-bottom:16px;">

      <div id="recoveryErrorMsg" style="color:#F87171; font-size:12px; font-weight:700; margin-bottom:12px; display:none; background:rgba(239,68,68,0.1); padding:8px 12px; border-radius:8px;"></div>

      <div style="display:flex; gap:12px;">
        <button id="recoveryCancelBtn" style="flex:1; padding:12px; border-radius:10px; border:none; background:var(--input-bg); color:var(--text-main); font-weight:700; cursor:pointer;">キャンセル</button>
        <button id="recoveryConfirmBtn" style="flex:1; padding:12px; border-radius:10px; border:none; background:var(--cosmic-cyan); color:#000; font-weight:700; cursor:pointer;">再設定する</button>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    document.getElementById("recoveryCancelBtn").onclick = function() {
      document.body.removeChild(overlay);
    };

    document.getElementById("recoveryConfirmBtn").onclick = async function() {
      const userId = document.getElementById("recoveryUserId").value.trim().toUpperCase();
      const adminPass = document.getElementById("recoveryAdminPass").value.trim();
      const newPin = document.getElementById("recoveryNewPin").value.trim();
      const errorMsg = document.getElementById("recoveryErrorMsg");

      errorMsg.style.display = "none";

      if (!userId || !adminPass || !newPin) {
        errorMsg.innerText = "すべての項目を入力してください。";
        errorMsg.style.display = "block";
        return;
      }

      if (!/^\d{4}$/.test(newPin)) {
        errorMsg.innerText = "PINは4桁の数字で入力してください。";
        errorMsg.style.display = "block";
        return;
      }

      if (adminPass !== "tukinokopanda" && adminPass !== "tutinokopanda") {
        errorMsg.innerText = "管理者パスワードが違います。";
        errorMsg.style.display = "block";
        return;
      }

      const confirmBtn = document.getElementById("recoveryConfirmBtn");
      confirmBtn.disabled = true;
      confirmBtn.innerText = "確認中...";

      try {
        let userFound = false;
        let userData = null;

        if (window.db && window.fbGetDoc && window.fbDoc) {
          const userRef = window.fbDoc(window.db, "users", userId);
          const snap = await window.fbGetDoc(userRef);

          if (snap.exists()) {
            userData = snap.data();
            if (userData.deleted) {
              errorMsg.innerText = "このユーザーは削除されています。";
              errorMsg.style.display = "block";
              confirmBtn.disabled = false;
              confirmBtn.innerText = "再設定する";
              return;
            }
            userFound = true;
          }
        }

        if (!userFound) {
          const allUsers = await window.getAllUsers();
          const matched = allUsers.find(function(u) { return u.id === userId; });
          if (matched) {
            userFound = true;
            userData = matched;
          }
        }

        if (!userFound) {
          errorMsg.innerText = "指定されたIDのユーザーが見つかりません。IDを確認してください。";
          errorMsg.style.display = "block";
          confirmBtn.disabled = false;
          confirmBtn.innerText = "再設定する";
          return;
        }

        if (window.db && window.fbSetDoc && window.fbDoc) {
          const userRef = window.fbDoc(window.db, "users", userId);
          await window.fbSetDoc(userRef, {
            pin: newPin
          }, { merge: true });
        }

        try {
          let allUsers = await window.getAllUsers();
          const idx = allUsers.findIndex(function(u) { return u.id === userId; });
          if (idx !== -1) {
            allUsers[idx].pin = newPin;
            await window.saveAllUsers(allUsers);
          } else {
            allUsers.push({
              id: userId,
              playerName: userData.playerName || "修行者",
              realName: userData.realName || "一般",
              age: userData.age || "18",
              pin: newPin
            });
            await window.saveAllUsers(allUsers);
          }
        } catch (e) {
          console.error("all_users更新エラー:", e);
        }

        document.body.removeChild(overlay);

        alert("✅ PINを再設定しました！\n新しいPINでログインしてください。\n\nID: " + userId + "\n新PIN: " + newPin);

        const loginIdInput = document.getElementById("loginIdInput");
        const loginPinInput = document.getElementById("loginPinInput");
        if (loginIdInput) loginIdInput.value = userId;
        if (loginPinInput) loginPinInput.value = newPin;

      } catch (e) {
        console.error("PIN再設定エラー:", e);
        errorMsg.innerText = "再設定に失敗しました。通信エラーの可能性があります。";
        errorMsg.style.display = "block";
        confirmBtn.disabled = false;
        confirmBtn.innerText = "再設定する";
      }
    };
  }

  function tryInject() {
    injectRecoveryButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      setTimeout(tryInject, 500);
    });
  } else {
    setTimeout(tryInject, 500);
  }

  const observer = new MutationObserver(function() {
    const gate = document.getElementById("auth-gate-screen");
    if (gate && gate.style.display !== "none") {
      injectRecoveryButton();
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  }

})();
// ==========================================================================
// 🔄 第1回パッチ：同期ズレ解消 ＋ レベル1バグ修正 ＋ データ保存の確実性向上
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
// ==========================================================================

// ------------------------------------------------------------------
// ヘルパー①：Firebase書き込みを3回リトライ（通信失敗しても諦めない）
// ------------------------------------------------------------------
window.fbSetDocWithRetry = async function(ref, data, options, retries) {
    retries = retries || 3;
    let lastError = null;
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            await window.fbSetDoc(ref, data, options);
            return true;
        } catch (e) {
            lastError = e;
            console.error("fbSetDoc 試行 " + (attempt + 1) + " 回目失敗:", e);
            if (attempt < retries - 1) {
                await new Promise(function(r) { setTimeout(r, 500 * (attempt + 1)); });
            }
        }
    }
    throw lastError;
};

// ------------------------------------------------------------------
// ヘルパー②：totalExp からレベルを安全に計算（単一の信頼できる情報源）
// ------------------------------------------------------------------
window.computeLevelSafe = function(exp) {
    try {
        return window.calculateLevelFromExp(parseInt(exp) || 0).level;
    } catch (e) {
        return 1;
    }
};

// ------------------------------------------------------------------
// Phase 1-A：saveUserStats を上書き
//   ・保存前に totalExp から user_level を必ず再計算（古いレベル1を防止）
//   ・users/{id} と shared_leaderboard/{id} へリトライ付き書き込み
//   ・自分のプレイヤー名を all_users へ60秒スロットルで同期
// ------------------------------------------------------------------
window.__lastAllUsersSyncAt = 0;

window.syncMyEntryToAllUsers = async function(force) {
    if (typeof myId === "undefined" || !myId || myId === "GUEST-000") return;
    if (!window.db || !window.fbGetDoc || !window.fbSetDoc || !window.fbDoc) return;
    const now = Date.now();
    if (!force && window.__lastAllUsersSyncAt && (now - window.__lastAllUsersSyncAt) < 60000) return;
    window.__lastAllUsersSyncAt = now;
    try {
        const ref = window.fbDoc(window.db, "shared", "all_users");
        const snap = await window.fbGetDoc(ref);
        let users = (snap.exists() && snap.data().users && Array.isArray(snap.data().users)) ? snap.data().users : [];
        const idx = users.findIndex(function(u) { return u && u.id === myId; });
        if (idx === -1) return; // 未登録の場合は既存の復旧パッチに任せる
        if (users[idx].playerName === myName) return; // 変更なしなら書かない
        users[idx].playerName = myName;
        await window.fbSetDocWithRetry(ref, { users: users }, { merge: true });
    } catch (e) {
        console.error("syncMyEntryToAllUsers エラー:", e);
    }
};

window.saveUserStats = async function() {
    // ✅ 保存前に必ず totalExp からレベルを再計算（古い user_level を上書き）
    try {
        let lvlData = window.calculateLevelFromExp(totalExp);
        userStats.user_level = lvlData.level;
    } catch (e) {}

    try {
        localStorage.setItem('core_v4_user_stats_' + myId, JSON.stringify(userStats));
        localStorage.setItem('core_v4_friend_list', JSON.stringify(myFriendList));
        localStorage.setItem('core_v4_totalExp', String(totalExp));
        localStorage.setItem('core_v4_userName', myName);
        localStorage.setItem('core_v4_userTarget', myTarget);
        localStorage.setItem('core_v4_userTitle', selectedTitle);
    } catch(e) {}

    if (window.db && window.fbSetDoc && window.fbDoc && myId && myId !== "GUEST-000") {
        try {
            const userRef = window.fbDoc(window.db, "users", myId);
            const mySavedAvatar = localStorage.getItem('core_v4_user_avatar_' + myId) || "";
            let lvlData = window.calculateLevelFromExp(totalExp);
            await window.fbSetDocWithRetry(userRef, {
                id: myId,
                userStats: userStats,
                friendList: myFriendList,
                playerName: myName,
                selectedTitle: selectedTitle,
                userTarget: myTarget,
                totalExp: totalExp,
                avatar: mySavedAvatar,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            const lbRef = window.fbDoc(window.db, "shared_leaderboard", myId);
            await window.fbSetDocWithRetry(lbRef, {
                id: myId,
                name: myName,
                title: selectedTitle,
                exp: totalExp,
                level: lvlData.level,
                avatar: mySavedAvatar,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            // プレイヤー名を all_users へバックグラウンド同期（60秒スロットル）
            window.syncMyEntryToAllUsers(false);
        } catch (e) {
            console.error("Firebaseユーザーデータ保存エラー（リトライ後）:", e);
        }
    }
};

// ------------------------------------------------------------------
// Phase 1-B：loadUserStats を上書き
//   ・totalExp は「ローカルとクラウドの大きい方」を採用（古いデータで上書きされて消えるのを防止）
//   ・読み込み後にレベルを再計算
// ------------------------------------------------------------------
window.loadUserStats = async function() {
    try {
        const storedStats = localStorage.getItem('core_v4_user_stats_' + myId);
        if (storedStats) userStats = JSON.parse(storedStats);
        const storedFriends = localStorage.getItem('core_v4_friend_list');
        if (storedFriends) myFriendList = JSON.parse(storedFriends);
        if (window.db && window.fbGetDoc && window.fbDoc && myId && myId !== "GUEST-000") {
            const userRef = window.fbDoc(window.db, "users", myId);
            const snap = await window.fbGetDoc(userRef);
            if (snap.exists()) {
                const data = snap.data();
                if (data.userStats) {
                    userStats = data.userStats;
                    localStorage.setItem('core_v4_user_stats_' + myId, JSON.stringify(userStats));
                }
                if (data.friendList) {
                    myFriendList = data.friendList;
                    localStorage.setItem('core_v4_friend_list', JSON.stringify(myFriendList));
                }
                // ✅ totalExp はローカルとクラウドの大きい方を採用（データ消失防止）
                if (data.totalExp !== undefined && data.totalExp !== null) {
                    const cloudExp = parseInt(data.totalExp) || 0;
                    const localExp = totalExp || 0;
                    totalExp = Math.max(cloudExp, localExp);
                    localStorage.setItem('core_v4_totalExp', String(totalExp));
                }
                if (data.playerName) {
                    myName = data.playerName;
                    localStorage.setItem('core_v4_userName', myName);
                }
                if (data.selectedTitle) {
                    selectedTitle = data.selectedTitle;
                    localStorage.setItem('core_v4_userTitle', selectedTitle);
                }
                if (data.userTarget) {
                    myTarget = data.userTarget;
                    localStorage.setItem('core_v4_userTarget', myTarget);
                }
                if (data.avatar) {
                    localStorage.setItem('core_v4_user_avatar_' + myId, data.avatar);
                }
                // ✅ 統合後の totalExp からレベルを再計算
                userStats.user_level = window.computeLevelSafe(totalExp);
            }
        }
    } catch (e) {
        console.error("Error loading user stats:", e);
    }
};

// ------------------------------------------------------------------
// Phase 2-A：EXP全ユーザーランキングのレベル優先順を修正
//   （古い user_level を信じず、必ず totalExp から計算する）
// ------------------------------------------------------------------
window.fetchAllExpLeaderboardUsers = async function() {
    const users = [];
    if (!window.db || !window.fbGetDoc || !window.fbDoc) return users;
    let allUsers = [];
    try { allUsers = await window.getAllUsers(); } catch (e) {}
    const ids = [];
    (allUsers || []).forEach(function(u) {
        if (u && u.id && u.id !== "GUEST-000" && ids.indexOf(u.id) === -1) ids.push(u.id);
    });
    if (typeof myId !== "undefined" && myId && myId !== "GUEST-000" && ids.indexOf(myId) === -1) ids.push(myId);
    for (const id of ids) {
        try {
            const ref = window.fbDoc(window.db, "users", id);
            const snap = await window.fbGetDoc(ref);
            if (!snap.exists()) continue;
            const d = snap.data();
            if (d.deleted) continue;
            let exp = parseInt(d.totalExp) || 0;
            // ✅ 修正：totalExp からレベルを計算（古い user_level を使わない）
            let level = window.computeLevelSafe(exp);
            let name = d.playerName || "";
            if (!name) {
                const basic = (allUsers || []).find(function(u) { return u.id === id; });
                name = basic ? (basic.playerName || basic.realName || "修行者") : "修行者";
            }
            users.push({
                id: id, name: name, title: d.selectedTitle || "称号なし",
                exp: exp, lvl: level, icon: "👤",
                customAvatar: (typeof d.avatar === "string") ? d.avatar : "",
                isMe: id === myId
            });
        } catch (e) {}
    }
    return users;
};

// ------------------------------------------------------------------
// Phase 2-B：フレンド最新化のレベル優先順を修正
//   （古い user_level を信じず、必ず totalExp から計算する）
// ------------------------------------------------------------------
window.refreshFriendListFromFirebase = async function(force) {
    if (typeof myId === "undefined" || !myId || myId === "GUEST-000") return;
    if (!window.db || !window.fbGetDoc || !window.fbDoc) return;
    if (!Array.isArray(myFriendList) || myFriendList.length === 0) return;
    const now = Date.now();
    if (!force && window.__friendRefreshLastAt && now - window.__friendRefreshLastAt < 60000) return;
    window.__friendRefreshLastAt = now;
    let changed = false;
    for (let i = 0; i < myFriendList.length; i++) {
        const f = myFriendList[i];
        try {
            const ref = window.fbDoc(window.db, "users", f.code);
            const snap = await window.fbGetDoc(ref);
            if (!snap.exists()) continue;
            const d = snap.data();
            if (d.deleted) continue;
            const stats = d.userStats || {};
            // ✅ 修正：totalExp からレベルを計算（古い user_level を使わない）
            let remoteLevel = f.level || 1;
            if (d.totalExp !== undefined && d.totalExp !== null) {
                remoteLevel = window.computeLevelSafe(d.totalExp);
            } else if (stats.user_level) {
                remoteLevel = parseInt(stats.user_level) || remoteLevel;
            }
            const remoteName = d.playerName || f.name;
            const remoteTitle = d.selectedTitle || f.title || "称号なし";
            const remoteAvatar = (typeof d.avatar === "string") ? d.avatar : (f.customAvatar || "");
            const remoteStudyTime = parseInt(stats.study_burst) || 0;
            let remoteLastLoginStr = f.lastLoginStr || "";
            const lastIso = stats.lastLoginAt || d.updatedAt || "";
            if (lastIso) { const formatted = window.formatFriendLastLogin(lastIso); if (formatted) remoteLastLoginStr = formatted; }
            let remoteTimestamp = f.timestamp || now;
            if (lastIso) { const t = new Date(lastIso).getTime(); if (!isNaN(t)) remoteTimestamp = t; }
            if (f.name !== remoteName || f.title !== remoteTitle || f.customAvatar !== remoteAvatar || f.level !== remoteLevel || f.studyTime !== remoteStudyTime || f.lastLoginStr !== remoteLastLoginStr || f.timestamp !== remoteTimestamp) {
                f.name = remoteName; f.title = remoteTitle; f.customAvatar = remoteAvatar;
                f.level = remoteLevel; f.studyTime = remoteStudyTime; f.lastLoginStr = remoteLastLoginStr; f.timestamp = remoteTimestamp;
                changed = true;
            }
        } catch (e) {}
    }
    if (changed) { try { await window.saveUserStats(); } catch (e) {} }
    if (typeof window.sortAndRenderFriendList === "function") window.sortAndRenderFriendList();
};

console.log("🔄 第1回パッチ（同期ズレ解消＋レベル1バグ修正＋保存信頼性向上）適用完了");
// ==========================================================================
// 🐧 第2回パッチ：ペンギンローディング ＋ 単語帳詳細ボタン修正
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
// ==========================================================================

// ------------------------------------------------------------------
// Phase 3-A：ローディングオーバーレイ本体（表示/非表示マネージャー）
//   ・280ms以上かかる処理だけ表示（チラつき防止）
//   ・一度出たら最低450ms表示（チラつき防止）
//   ・複数処理が重なっても正しく動く（カウンター管理）
// ------------------------------------------------------------------
window.__pgLoad = window.__pgLoad || {
  count: 0,
  pendingTimer: null,
  visible: false,
  shownAt: 0,
  overlay: null,
  message: '読み込み中'
};

window.__renderPenguinOverlay = function(message) {
  if (window.__pgLoad.overlay) return;
  var ov = document.createElement('div');
  ov.id = 'penguinLoadingOverlay';
  var penguinSvg =
    '<svg viewBox="0 0 120 122" width="88" height="90" xmlns="http://www.w3.org/2000/svg">' +
      '<ellipse class="pg-wing-l" cx="24" cy="66" rx="10" ry="22" fill="#16213E"/>' +
      '<ellipse class="pg-wing-r" cx="96" cy="66" rx="10" ry="22" fill="#16213E"/>' +
      '<path d="M60 12 C 35 12, 22 33, 22 58 C 22 89, 37 112, 60 112 C 83 112, 98 89, 98 58 C 98 33, 85 12, 60 12 Z" fill="#1B2A4A"/>' +
      '<ellipse cx="60" cy="75" rx="26" ry="31" fill="#F1F5F9"/>' +
      '<ellipse cx="47" cy="41" rx="11" ry="13" fill="#F1F5F9"/>' +
      '<ellipse cx="73" cy="41" rx="11" ry="13" fill="#F1F5F9"/>' +
      '<circle cx="48" cy="41" r="3.2" fill="#0F172A"/>' +
      '<circle cx="72" cy="41" r="3.2" fill="#0F172A"/>' +
      '<circle cx="49" cy="40" r="1.1" fill="#FFFFFF"/>' +
      '<circle cx="73" cy="40" r="1.1" fill="#FFFFFF"/>' +
      '<circle cx="39" cy="50" r="4.5" fill="rgba(236,72,153,0.4)"/>' +
      '<circle cx="81" cy="50" r="4.5" fill="rgba(236,72,153,0.4)"/>' +
      '<path d="M53 49 L67 49 L60 58 Z" fill="#F59E0B"/>' +
      '<ellipse class="pg-foot-l" cx="45" cy="113" rx="13" ry="5.5" fill="#F59E0B"/>' +
      '<ellipse class="pg-foot-r" cx="75" cy="113" rx="13" ry="5.5" fill="#F59E0B"/>' +
    '</svg>';
  ov.innerHTML =
    '<div class="penguin-loader-stage">' +
      '<div class="penguin-ice-ground"></div>' +
      '<div class="penguin-walk-track">' +
        '<div class="penguin-waddle">' + penguinSvg + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="penguin-loading-text">🐧 ' + (message || '読み込み中') +
      '<span class="pg-dot">.</span><span class="pg-dot">.</span><span class="pg-dot">.</span></div>';
  document.body.appendChild(ov);
  window.__pgLoad.overlay = ov;
  requestAnimationFrame(function(){ ov.classList.add('penguin-visible'); });
};

window.__updatePenguinText = function(message) {
  var st = window.__pgLoad;
  if (!st.overlay) return;
  var txt = st.overlay.querySelector('.penguin-loading-text');
  if (txt) {
    txt.innerHTML = '🐧 ' + (message || '読み込み中') +
      '<span class="pg-dot">.</span><span class="pg-dot">.</span><span class="pg-dot">.</span>';
  }
};

window.showPenguinLoading = function(message) {
  var st = window.__pgLoad;
  st.count++;
  if (message) st.message = message;
  if (st.visible) {
    window.__updatePenguinText(st.message);
    return;
  }
  if (st.pendingTimer) return;
  // 280ms以内に終わる高速処理は表示しない（チラつき防止）
  st.pendingTimer = setTimeout(function() {
    st.pendingTimer = null;
    if (st.count > 0 && !st.visible) {
      window.__renderPenguinOverlay(st.message);
      st.visible = true;
      st.shownAt = Date.now();
    }
  }, 280);
};

window.__actuallyHidePenguin = function() {
  var st = window.__pgLoad;
  if (st.count > 0) return;
  st.visible = false;
  if (st.overlay) {
    var ov = st.overlay;
    st.overlay = null;
    ov.classList.add('penguin-fade-out');
    ov.classList.remove('penguin-visible');
    setTimeout(function(){ if (ov.parentNode) ov.parentNode.removeChild(ov); }, 300);
  }
};

window.hidePenguinLoading = function() {
  var st = window.__pgLoad;
  if (st.count > 0) st.count--;
  if (st.count > 0) return; // まだ他の処理が動いている
  if (st.pendingTimer) { clearTimeout(st.pendingTimer); st.pendingTimer = null; }
  if (!st.visible) return;
  // 一度表示したら最低450msは出す（チラつき防止）
  var elapsed = Date.now() - st.shownAt;
  var minDisplay = 450;
  if (elapsed < minDisplay) {
    setTimeout(function(){ window.__actuallyHidePenguin(); }, minDisplay - elapsed);
  } else {
    window.__actuallyHidePenguin();
  }
};

// ------------------------------------------------------------------
// Phase 3-B：時間がかかる処理をペンギンローディングで包むヘルパー
// ------------------------------------------------------------------
window.__wrapWithPenguin = function(fnName) {
  var prev = window[fnName];
  if (typeof prev !== 'function') return;
  if (prev.__penguinWrapped) return; // 二重ラップ防止
  var wrapped = async function() {
    window.showPenguinLoading();
    try {
      return await prev.apply(this, arguments);
    } finally {
      window.hidePenguinLoading();
    }
  };
  wrapped.__penguinWrapped = true;
  window[fnName] = wrapped;
};

// ローディングを適用する関数一覧（既存の機能を上書きせず包むだけ）
[
  'loadLocalState',               // 起動時の初回読み込み
  'switchTextbookContext',        // 単語帳を切り替えた時
  'loadCurrentTextbookData',      // 単語帳データ読み込み
  'refreshFriendListFromFirebase',// フレンドリスト更新時
  'handleAuthSubmit',             // ログイン処理
  'startActualGame',              // ゲーム開始時
  'startFlashcardSession',        // フラッシュカード開始時
  'analyzeText',                  // 長文解析時
  'endGameSession',               // ゲーム終了時
  'saveSidebarProfile',           // プロフィール保存時
  'searchAndAddFriend'            // フレンド追加時
].forEach(function(fn){ window.__wrapWithPenguin(fn); });

// ------------------------------------------------------------------
// Phase 4：単語帳詳細ボタン（📊）修正
//   ・単語帳切り替え時に必ず再バインド（古いデータを参照しないように）
//   ・ポップアップに「現在の単語帳名」を表示（全体ではなく今の単語帳であることが分かる）
// ------------------------------------------------------------------
window.injectVocabStatsButton = function() {
  var titleEl = document.getElementById('vocabBookTitle');
  if (!titleEl) return;
  var parent = titleEl.parentElement;
  if (!parent) return;
  var btn = document.getElementById('vocabStatsBtn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'vocabStatsBtn';
    btn.type = 'button';
    btn.style.cssText = "margin-left:auto; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.25); color:#fff; font-size:11px; font-weight:700; padding:6px 10px; border-radius:20px; cursor:pointer; white-space:nowrap; flex-shrink:0;";
    if (getComputedStyle(parent).display === 'block') {
      parent.style.display = 'flex';
      parent.style.alignItems = 'center';
      parent.style.gap = '8px';
    }
    parent.appendChild(btn);
  }
  // クリック時に最新の vocabList（現在の単語帳）を読むように毎回再バインド
  btn.textContent = '📊 詳細';
  btn.onclick = function(e) { e.stopPropagation(); window.showVocabStatsPopup(); };
};

window.showVocabStatsPopup = function() {
  var old = document.getElementById('vocabStatsOverlay'); if (old) old.remove();
  // ✅ 現在の単語帳名を取得
  var currentBook = (typeof textbooksPool !== 'undefined' && Array.isArray(textbooksPool))
    ? textbooksPool.find(function(b){ return b.id === currentTextbook; })
    : null;
  var bookName = currentBook ? currentBook.name : '共通単語帳';
  // ✅ 現在の単語帳（vocabList）のみを集計
  var total = vocabList.length;
  var ok = 0, so = 0, bad = 0, none = 0;
  vocabList.forEach(function(w){
    var s = window.wordOverallStatus(w);
    if (s === 'ok') ok++; else if (s === 'so') so++; else if (s === 'bad') bad++; else none++;
  });
  var denom = total || 1;
  var pct = function(v){ return total ? Math.round(v / denom * 100) : 0; };
  var segs = [
    { value: ok, color: '#10B981', label: '⚪︎ 定着' },
    { value: so, color: '#F59E0B', label: '△ 曖昧' },
    { value: bad, color: '#EF4444', label: '✕ 不可' },
    { value: none, color: '#64748B', label: '未学習' }
  ];
  var r = 42, c = 2 * Math.PI * r, offset = 0, circles = '';
  segs.forEach(function(seg){
    var frac = seg.value / denom; var len = frac * c;
    if (len > 0) circles += '<circle r="' + r + '" cx="60" cy="60" fill="none" stroke="' + seg.color + '" stroke-width="14" stroke-dasharray="' + len + ' ' + (c - len) + '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 60 60)"/>';
    offset += len;
  });
  if (total === 0) circles = '<circle r="' + r + '" cx="60" cy="60" fill="none" stroke="#334155" stroke-width="14"/>';
  var listHtml = '';
  segs.forEach(function(seg){
    listHtml += '<div style="display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.08); font-size:13px;">' +
      '<span style="display:flex; align-items:center; gap:8px;"><span style="width:12px; height:12px; border-radius:3px; background:' + seg.color + '; display:inline-block;"></span>' + seg.label + '</span>' +
      '<span style="font-weight:800;">' + seg.value + '語 <span style="color:var(--text-sub); font-weight:600;">(' + pct(seg.value) + '%)</span></span></div>';
  });
  var ov = document.createElement('div');
  ov.id = 'vocabStatsOverlay';
  ov.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px);";
  var box = document.createElement('div');
  box.style.cssText = "background:var(--card-bg); border:1px solid var(--cosmic-cyan); border-radius:16px; padding:20px; width:88%; max-width:340px; color:#fff; box-shadow:0 10px 30px rgba(0,0,0,0.6);";
  box.innerHTML =
    '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">' +
      '<div style="font-size:16px; font-weight:900;">📊 単語帳の詳細</div>' +
      '<button id="vocabStatsClose" style="background:none; border:none; color:var(--text-sub); font-size:20px; cursor:pointer; line-height:1;">×</button>' +
    '</div>' +
    '<div style="text-align:center; font-size:12px; color:var(--cosmic-purple-light); font-weight:800; margin-bottom:8px;">📔 ' + bookName + '</div>' +
    '<div style="text-align:center; font-size:13px; margin-bottom:12px;">登録単語数: <strong style="color:var(--cosmic-cyan); font-size:18px;">' + total + '</strong> 語</div>' +
    '<div style="display:flex; justify-content:center; margin-bottom:14px;">' +
      '<svg width="120" height="120" viewBox="0 0 120 120">' + circles + '<text x="60" y="64" text-anchor="middle" fill="#fff" font-size="16" font-weight="900">' + total + '</text></svg>' +
    '</div>' + listHtml;
  ov.appendChild(box);
  document.body.appendChild(ov);
  ov.querySelector('#vocabStatsClose').onclick = function(){ ov.remove(); };
  ov.onclick = function(e){ if (e.target === ov) ov.remove(); };
};

console.log("🐧 第2回パッチ（ペンギンローディング＋単語帳詳細ボタン修正）適用完了");
// ==========================================================================
// 🐧 ペンギン差し替えパッチ：リアル版（アデリー/コウテイペンギン風）
//    ※このファイルの末尾にそのまま貼り付けてください。
//    ※第2回パッチの __renderPenguinOverlay を自動で上書きします。
// ==========================================================================
window.__renderPenguinOverlay = function(message) {
  if (window.__pgLoad.overlay) return;
  var ov = document.createElement('div');
  ov.id = 'penguinLoadingOverlay';
  var penguinSvg =
    '<svg viewBox="0 0 120 132" width="92" height="101" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' +
        '<linearGradient id="rpgBodyGrad" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#2d3b52"/>' +
          '<stop offset="1" stop-color="#1a2333"/>' +
        '</linearGradient>' +
        '<linearGradient id="rpgBellyGrad" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#f7f9fb"/>' +
          '<stop offset="1" stop-color="#dde4ea"/>' +
        '</linearGradient>' +
        '<radialGradient id="rpgChestGrad" cx="0.5" cy="0.35" r="0.75">' +
          '<stop offset="0" stop-color="rgba(251,191,36,0.32)"/>' +
          '<stop offset="1" stop-color="rgba(251,191,36,0)"/>' +
        '</radialGradient>' +
      '</defs>' +
      '<path class="rpg-flipper-l" d="M27 56 C 18 64, 15 84, 22 98 C 27 102, 32 94, 31 80 C 30 68, 29 60, 27 56 Z" fill="#1c2534"/>' +
      '<path class="rpg-flipper-r" d="M93 56 C 102 64, 105 84, 98 98 C 93 102, 88 94, 89 80 C 90 68, 91 60, 93 56 Z" fill="#1c2534"/>' +
      '<path d="M60 12 C 38 12, 26 32, 25 55 C 24 86, 36 114, 60 114 C 84 114, 96 86, 95 55 C 94 32, 82 12, 60 12 Z" fill="url(#rpgBodyGrad)"/>' +
      '<path d="M60 32 C 50 32, 44 36, 42 44 C 38 48, 36 56, 37 66 C 36 88, 44 108, 60 112 C 76 108, 84 88, 83 66 C 84 56, 82 48, 78 44 C 76 36, 70 32, 60 32 Z" fill="url(#rpgBellyGrad)"/>' +
      '<ellipse cx="60" cy="58" rx="19" ry="14" fill="url(#rpgChestGrad)"/>' +
      '<circle cx="47" cy="42" r="3.2" fill="#0d1220"/>' +
      '<circle cx="73" cy="42" r="3.2" fill="#0d1220"/>' +
      '<circle cx="48" cy="41" r="1.1" fill="#ffffff"/>' +
      '<circle cx="74" cy="41" r="1.1" fill="#ffffff"/>' +
      '<path d="M55 46 L65 46 L60 58 Z" fill="#2e3a4f"/>' +
      '<path d="M57 46 L63 46 L60 52 Z" fill="#3d4a61"/>' +
      '<path class="rpg-foot-l" d="M38 112 C 36 119, 40 124, 46 124 C 52 124, 54 118, 52 112 Z" fill="#46536b"/>' +
      '<path class="rpg-foot-r" d="M68 112 C 66 118, 68 124, 74 124 C 80 124, 84 119, 82 112 Z" fill="#46536b"/>' +
    '</svg>';
  ov.innerHTML =
    '<div class="penguin-loader-stage">' +
      '<div class="penguin-ice-ground"></div>' +
      '<div class="penguin-walk-track">' +
        '<div class="penguin-waddle">' + penguinSvg + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="penguin-loading-text">🐧 ' + (message || '読み込み中') +
      '<span class="pg-dot">.</span><span class="pg-dot">.</span><span class="pg-dot">.</span></div>';
  document.body.appendChild(ov);
  window.__pgLoad.overlay = ov;
  requestAnimationFrame(function(){ ov.classList.add('penguin-visible'); });
};
console.log("🐧 リアルペンギン差し替えパッチ 適用完了");
// ==========================================================================
// 🎩 タンゴン差し替えパッチ：本物のタンゴンがタンゴを踊るローディング
//    ※このファイルの末尾にそのまま貼り付けてください。
//    ※第2回パッチ／リアル差し替えパッチの __renderPenguinOverlay を自動上書き。
//    ※表示の安定ロジック（カウンター・チラつき防止・280ms/450ms閾値）は
//      そのまま流用するので、__wrapWithPenguin 等の適用範囲は不変。
// ==========================================================================

// ------------------------------------------------------------------
// ヘルパー：アプリ内で実際に読めている tangon.png のパスをDOMから検出
//   見つからなければ既定候補を返し、さらに img.onerror で連鎖フォールバック
// ------------------------------------------------------------------
window.__tangonSrcCache = null;
window.__detectTangonSrc = function() {
  if (window.__tangonSrcCache) return window.__tangonSrcCache;
  try {
    var imgs = document.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var s = (imgs[i].getAttribute('src') || imgs[i].src || '');
      if (/tangon/i.test(s)) { window.__tangonSrcCache = s; return s; }
    }
  } catch (e) {}
  window.__tangonSrcCache = 'tangon.png';
  return 'tangon.png';
};

// ------------------------------------------------------------------
// メイン：ローディングオーバーレイを「踊るタンゴン」に差し替え
// ------------------------------------------------------------------
window.__renderPenguinOverlay = function(message) {
  if (window.__pgLoad.overlay) return;
  var ov = document.createElement('div');
  ov.id = 'penguinLoadingOverlay';

  // 画像パス候補（重複除去）。DOM検出値を先頭に。
  var base = window.__detectTangonSrc();
  var raw = [base, 'tangon.png', './tangon.png', 'assets/tangon.png', '../tangon.png', 'img/tangon.png'];
  var seen = {}, chain = [];
  raw.forEach(function(p) { if (p && !seen[p]) { seen[p] = 1; chain.push(p); } });

  // 舞うバラの花びら（タンゴンのくわえたバラに呼应）
  var petals = '';
  for (var p = 0; p < 8; p++) {
    var left = Math.round(Math.random() * 100);
    var delay = (Math.random() * 4).toFixed(2);
    var dur = (4 + Math.random() * 4).toFixed(2);
    var size = (7 + Math.round(Math.random() * 9));
    var hue = Math.random() < 0.5 ? 'rgba(225,29,72,0.85)' : 'rgba(244,114,182,0.78)';
    petals += '<span class="tangon-petal" style="left:' + left + '%; width:' + size + 'px; height:' + size + 'px; background:' + hue + '; animation-delay:' + delay + 's; animation-duration:' + dur + 's;"></span>';
  }
  // 上昇するネオンの光の粒
  var sparks = '';
  for (var s2 = 0; s2 < 12; s2++) {
    var l2 = Math.round(Math.random() * 100);
    var d2 = (Math.random() * 5).toFixed(2);
    var du2 = (2.5 + Math.random() * 3.5).toFixed(2);
    var c2 = Math.random() < 0.5 ? 'rgba(0,240,255,0.9)' : 'rgba(192,132,252,0.9)';
    sparks += '<span class="tangon-spark" style="left:' + l2 + '%; background:' + c2 + '; animation-delay:' + d2 + 's; animation-duration:' + du2 + 's;"></span>';
  }

  ov.innerHTML =
    '<div class="tangon-stage">' +
      '<div class="tangon-spotlight"></div>' +
      '<div class="tangon-spotlight tangon-spotlight-2"></div>' +
      '<div class="tangon-petals">' + petals + '</div>' +
      '<div class="tangon-sparks">' + sparks + '</div>' +
      '<div class="tangon-dancer">' +
        '<img class="tangon-img" alt="タンゴン" />' +
        '<div class="tangon-shadow"></div>' +
      '</div>' +
    '</div>' +
    '<div class="penguin-loading-text">🐧 ' + (message || '読み込み中') +
      '<span class="pg-dot">.</span><span class="pg-dot">.</span><span class="pg-dot">.</span></div>';

  document.body.appendChild(ov);

  // 画像に src と onerror 連鎖をセット（全部失敗したら画像だけ隠す）
  var img = ov.querySelector('.tangon-img');
  var idx = 0;
  function tryNext() {
    if (idx >= chain.length) { img.style.display = 'none'; return; }
    img.src = chain[idx++];
  }
  img.onerror = function() { tryNext(); };
  tryNext();

  window.__pgLoad.overlay = ov;
  requestAnimationFrame(function() { ov.classList.add('penguin-visible'); });
};
// ※ __updatePenguinText は .penguin-loading-text を探すのでそのまま互換（再定義不要）

console.log("🎩 タンゴン差し替えパッチ（踊るタンゴンローディング）適用完了");
// ==========================================================================
// 🎯 第3回パッチ：別教材フラッシュカードの理解度反映 ＋ ランキング非消失
//                ＋ ヘッダー保存ボタン ＋ 画面上部トースト
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
// ==========================================================================

// ------------------------------------------------------------------
// A. 画面上部トースト通知（保存結果などのフィードバック）
// ------------------------------------------------------------------
window.showToast = function(msg, type) {
  var host = document.getElementById('toastHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toastHost';
    host.style.cssText = "position:fixed; top:64px; left:50%; transform:translateX(-50%); z-index:99997; display:flex; flex-direction:column; gap:8px; align-items:center; pointer-events:none; width:90%; max-width:340px;";
    document.body.appendChild(host);
  }
  var t = document.createElement('div');
  var bg = type === 'err' ? 'rgba(239,68,68,0.96)' : type === 'warn' ? 'rgba(245,158,11,0.96)' : 'rgba(16,185,129,0.96)';
  var bd = type === 'err' ? '#EF4444' : type === 'warn' ? '#F59E0B' : '#10B981';
  t.style.cssText = "background:" + bg + "; color:#fff; font-size:13px; font-weight:800; padding:10px 18px; border-radius:12px; border:1px solid " + bd + "; box-shadow:0 6px 20px rgba(0,0,0,0.5), 0 0 14px " + bd + "66; opacity:0; transform:translateY(-12px); transition:all 0.3s cubic-bezier(0.25,1,0.5,1); pointer-events:auto; text-align:center; letter-spacing:0.3px;";
  t.textContent = msg;
  host.appendChild(t);
  requestAnimationFrame(function() { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
  setTimeout(function() {
    t.style.opacity = '0';
    t.style.transform = 'translateY(-12px)';
    setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
  }, 2200);
};

// ------------------------------------------------------------------
// B. ヘッダー右上の保存ボタン（ログイン中のみ表示）
// ------------------------------------------------------------------
window.injectHeaderSaveButton = function() {
  var header = document.querySelector('.app-header');
  if (!header) return;
  var btn = document.getElementById('headerSaveBtn');
  var isLoggedIn = (typeof myId !== 'undefined' && myId && myId !== 'GUEST-000');
  if (!isLoggedIn) { if (btn) btn.style.display = 'none'; return; }
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'headerSaveBtn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'データを保存');
    btn.innerHTML = '💾';
    btn.style.cssText = "position:absolute; right:16px; top:50%; transform:translateY(-50%); width:36px; height:36px; border-radius:8px; background:rgba(255,255,255,0.05); border:1px solid rgba(0,240,255,0.4); color:var(--cosmic-cyan); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:16px; box-shadow:0 0 10px rgba(0,240,255,0.2); transition:background 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s; z-index:1001; line-height:1;";
    btn.onclick = function() { window.manualSaveAll(); };
    header.appendChild(btn);
  }
  btn.style.display = 'flex';
};

// 手動保存：デバウンス待ちをすべてフラッシュ＋明示保存＋フィードバック
window.manualSaveAll = async function() {
  var btn = document.getElementById('headerSaveBtn');
  if (btn) { btn.classList.add('header-save-spin'); btn.disabled = true; }
  if (typeof window.showPenguinLoading === 'function') window.showPenguinLoading('保存中');
  try {
    if (typeof window.flushVocabProgressSave === 'function') { try { await window.flushVocabProgressSave(); } catch (e) {} }
    if (typeof window.flushUserStatsRefresh === 'function') { try { window.flushUserStatsRefresh(); } catch (e) {} }
    if (typeof window.saveUserVocabProgress === 'function') { try { await window.saveUserVocabProgress(); } catch (e) {} }
    if (typeof window.saveUserStats === 'function') { try { await window.saveUserStats(); } catch (e) {} }
    window.showToast('💾 保存しました', 'ok');
    if (btn) { btn.classList.add('header-save-done'); setTimeout(function() { btn.classList.remove('header-save-done'); }, 700); }
  } catch (e) {
    console.error('manualSaveAll error:', e);
    window.showToast('⚠️ 保存に失敗しました', 'err');
  } finally {
    if (typeof window.hidePenguinLoading === 'function') window.hidePenguinLoading();
    if (btn) { btn.disabled = false; setTimeout(function() { btn.classList.remove('header-save-spin'); }, 300); }
  }
};

// ------------------------------------------------------------------
// C. 別教材フラッシュカード：開始時に教材を差し替え、終了時に復元
//    （スワイプ書き込み・履歴・色付けが全部その教材に正しく向く）
// ------------------------------------------------------------------
window.__fcSessionActive = false;
window.__fcSaved = null;

// 指定教材のマスター単語をキャッシュ→ローカル→Firebaseの順で取得
window.__fetchMasterWordsForBook = async function(bookKey) {
  var master = null;
  try { if (textbooksCacheMap && textbooksCacheMap[bookKey]) master = textbooksCacheMap[bookKey]; } catch (e) {}
  if (!master) {
    try {
      var localCache = localStorage.getItem('core_v4_cache_' + bookKey);
      if (localCache) master = JSON.parse(localCache);
    } catch (e) {}
  }
  if (!master && window.db && window.fbGetDoc && window.fbDoc) {
    try {
      var ref = window.fbDoc(window.db, 'shared', 'vocab_' + bookKey);
      var snap = await window.fbGetDoc(ref);
      if (snap.exists() && snap.data() && snap.data().custom_words) {
        master = snap.data().custom_words;
        try { textbooksCacheMap[bookKey] = window.stripVocabProgressFromWords ? window.stripVocabProgressFromWords(master) : master; } catch (e) {}
        try { localStorage.setItem('core_v4_cache_' + bookKey, JSON.stringify(master)); } catch (e) {}
      }
    } catch (e) {}
  }
  if (!master) master = [];
  if (window.stripVocabProgressFromWords) master = window.stripVocabProgressFromWords(master);
  return master;
};

// セッション教材へ差し替えた後、範囲内に単語があるか事前チェック用のプール
window.__buildFlashcardPool = function() {
  var startEl = document.getElementById('flashcardRangeStart');
  var endEl = document.getElementById('flashcardRangeEnd');
  var startNum = startEl ? (parseInt(startEl.value) || 1) : 1;
  var endNum = endEl ? (parseInt(endEl.value) || 100) : 100;
  return vocabList.filter(function(w) {
    var n = parseInt(w.num);
    return n >= startNum && n <= endNum;
  });
};

// 退避した状態を元へ戻す
window.__restoreFlashcardSession = function() {
  if (window.__fcSaved) {
    try { vocabList = window.__fcSaved.vocabList; } catch (e) {}
    try { currentTextbook = window.__fcSaved.bookKey; } catch (e) {}
    try { currentUserVocabProgress = window.__fcSaved.progress; } catch (e) {}
    if (typeof window.rebuildVocabStemIndex === 'function') window.rebuildVocabStemIndex();
    window.__fcSaved = null;
  }
  window.__fcSessionActive = false;
};

var __prevStartFlashcardSessionForBookFix = window.startFlashcardSession;
window.startFlashcardSession = async function() {
  var sourceSelector = document.getElementById('flashcardSourceSelect');
  var chosenBookKey = sourceSelector ? (sourceSelector.value || currentTextbook || 'default') : (currentTextbook || 'default');
  var currentBookKey = currentTextbook || 'default';
  var isCurrent = (chosenBookKey === currentBookKey);

  if (!isCurrent) {
    // 現在の状態を退避
    window.__fcSaved = {
      vocabList: vocabList,
      bookKey: currentTextbook,
      progress: (typeof currentUserVocabProgress !== 'undefined') ? currentUserVocabProgress : {}
    };
    window.__fcSessionActive = true;

    // セッション教材のマスター単語を取得して vocabList にセット
    var master = await window.__fetchMasterWordsForBook(chosenBookKey);
    vocabList = window.migrateVocabData ? window.migrateVocabData(master) : master;
    currentTextbook = chosenBookKey;

    // その教材の“自分の理解度”を読み込んで適用
    if (typeof window.loadUserVocabProgress === 'function') {
      try { await window.loadUserVocabProgress(chosenBookKey); } catch (e) {}
    }
    if (typeof window.applyUserProgressToVocabList === 'function') {
      try { window.applyUserProgressToVocabList(); } catch (e) {}
    } else if (typeof window.rebuildVocabStemIndex === 'function') {
      window.rebuildVocabStemIndex();
    }

    // 範囲内に単語が無ければ復元して終了（元の関数のalertと二重にしない）
    if (window.__buildFlashcardPool().length === 0) {
      window.__restoreFlashcardSession();
      alert('指定された範囲または教材にデータが存在しません。単語登録を確認してください。');
      return;
    }
  } else {
    window.__fcSessionActive = false;
    window.__fcSaved = null;
  }

  // 元の実行（pool は差し替え後の vocabList から作られる＝選択教材で出題＆保存）
  return __prevStartFlashcardSessionForBookFix.apply(this, arguments);
};

// 終了時に必ず復元（finish / quit 両方をカバー）
var __prevFinishFlashcardSessionForBookFix = window.finishFlashcardSession;
window.finishFlashcardSession = function() {
  if (window.__fcSessionActive || window.__fcSaved) {
    window.__restoreFlashcardSession();
  }
  if (typeof __prevFinishFlashcardSessionForBookFix === 'function') {
    return __prevFinishFlashcardSessionForBookFix.apply(this, arguments);
  }
};
window.quitFlashcardSession = window.finishFlashcardSession;

// ------------------------------------------------------------------
// D. ランキングを“消さない”描画に上書き
//    （取得中は既存の中身を保持。初回だけ「取得中」。失敗時も自分だけは残す）
// ------------------------------------------------------------------
window.renderLeaderboard = async function(force) {
  var container = document.getElementById('leaderboardContainer');
  if (!container) return;
  if (typeof myId === 'undefined' || myId === 'GUEST-000') {
    container.innerHTML = '<div style="color:var(--text-sub); font-size:12px; text-align:center; padding:12px;">ゲストはランキング対象外です。</div>';
    return;
  }
  var lvlData = window.calculateLevelFromExp(totalExp);
  userStats.user_level = lvlData.level;
  var selfAvatar = localStorage.getItem('core_v4_user_avatar_' + myId) || '';
  var selfUser = { id: myId, name: myName + ' (あなた)', title: selectedTitle, exp: totalExp, lvl: lvlData.level, icon: '👤', customAvatar: selfAvatar, isMe: true };

  var drawWithSelf = function(remoteUsers) {
    var users = (remoteUsers || []).filter(function(u) { return u.id !== myId; }).map(function(u) { return Object.assign({}, u); });
    users.push(selfUser);
    users.sort(function(a, b) { return b.exp - a.exp; });
    window.drawExpLeaderboard(container, users.slice(0, 50));
  };

  var now = Date.now();
  var cacheValid = window.__leaderboardCache && (now - window.__leaderboardCacheAt < 60000);
  if (cacheValid && !force) {
    delete container.dataset.lbLoading;
    drawWithSelf(window.__leaderboardCache);
    return;
  }

  // 既にランキングが描画済みなら、取得中も消さない
  var hasExisting = container.children.length > 0 && !container.dataset.lbLoading;
  if (!hasExisting) {
    container.dataset.lbLoading = '1';
    container.innerHTML = '<div class="__lb_loading" style="color:var(--text-sub); font-size:12px; text-align:center; padding:12px;">ランキングを取得中...</div>';
  }
  try {
    if (!window.__leaderboardLoadingPromise) {
      window.__leaderboardLoadingPromise = window.fetchAllExpLeaderboardUsers()
        .then(function(users) { window.__leaderboardCache = users; window.__leaderboardCacheAt = Date.now(); return users; })
        .finally(function() { window.__leaderboardLoadingPromise = null; });
    }
    var remoteUsers = await window.__leaderboardLoadingPromise;
    delete container.dataset.lbLoading;
    drawWithSelf(remoteUsers);
  } catch (e) {
    delete container.dataset.lbLoading;
    if (!hasExisting) drawWithSelf([]); // 既存が無い時だけ自分を描画（既存は消さない）
  }
};

// ------------------------------------------------------------------
// E. switchTab 上書き：コミュニティ切替後の transform/opacity 残留を解消
//    ＋ 保存ボタンの表示状態を同期
// ------------------------------------------------------------------
var __prevSwitchTabForRankReset = window.switchTab;
window.switchTab = function(tabId) {
  var res = __prevSwitchTabForRankReset ? __prevSwitchTabForRankReset.apply(this, arguments) : undefined;
  if (tabId === 'community') {
    var ra = document.getElementById('leaderboardSection') || (document.getElementById('leaderboardContainer') ? document.getElementById('leaderboardContainer').parentElement : null);
    var fa = document.getElementById('friendSection') || (document.getElementById('friendListContainer') ? document.getElementById('friendListContainer').parentElement : null);
    [ra, fa].forEach(function(el) {
      if (el) { el.style.transform = ''; el.style.opacity = ''; el.style.transition = ''; el.classList.remove('slide-from-right', 'slide-from-left'); }
    });
  }
  window.injectHeaderSaveButton();
  return res;
};

// ------------------------------------------------------------------
// F. loadLocalState 上書き：起動／ログイン後に保存ボタンを注入
// ------------------------------------------------------------------
var __prevLoadLocalStateForSaveBtn = window.loadLocalState;
window.loadLocalState = async function() {
  var r = __prevLoadLocalStateForSaveBtn ? await __prevLoadLocalStateForSaveBtn.apply(this, arguments) : undefined;
  window.injectHeaderSaveButton();
  return r;
};

// ------------------------------------------------------------------
// G. 起動時注入
// ------------------------------------------------------------------
(function initSaveButtonPatch() {
  function boot() { window.injectHeaderSaveButton(); }
  if (document.readyState !== 'loading') { setTimeout(boot, 300); }
  else { document.addEventListener('DOMContentLoaded', function() { setTimeout(boot, 300); }); }
})();

console.log('🎯 第3回パッチ（別教材FC理解度＋ランキング非消失＋保存ボタン＋トースト）適用完了');
// ==========================================================================
// 🎴 第4回パッチ：ロード画面を単語テストに（タンゴン削除）
//    ＋ 理解度保存の確実化 ＋ 勉強時間の安定化 ＋ フレンド勉強時間「総計」化
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
// ==========================================================================

// ------------------------------------------------------------------
// 【0】パッチ専用スタイルの注入（1回だけ）
// ------------------------------------------------------------------
(function injectPatch4Css() {
  if (document.getElementById('patch4Css')) return;
  var st = document.createElement('style');
  st.id = 'patch4Css';
  st.textContent = [
    '#penguinLoadingOverlay{position:fixed;top:0;left:0;width:100%;height:100%;',
    'background:radial-gradient(circle at 50% 38%, rgba(30,27,75,0.97) 0%, rgba(15,23,42,0.985) 72%);',
    'z-index:99998;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;',
    'opacity:0;transition:opacity .25s ease;overflow:hidden;}',
    '#penguinLoadingOverlay.penguin-visible{opacity:1;}',
    '#penguinLoadingOverlay.penguin-fade-out{opacity:0;}',
    '.lq-spark{position:absolute;width:4px;height:4px;border-radius:50%;pointer-events:none;opacity:0;animation:lqSparkFloat linear infinite;}',
    '@keyframes lqSparkFloat{0%{transform:translateY(20px) scale(.6);opacity:0;}20%{opacity:.9;}80%{opacity:.6;}100%{transform:translateY(-90vh) scale(1);opacity:0;}}',
    '.lq-area{display:flex;flex-direction:column;align-items:center;gap:14px;z-index:2;}',
    '.lq-score{font-size:13px;font-weight:800;color:#E2E8F0;letter-spacing:.5px;display:flex;gap:10px;align-items:center;',
    'background:rgba(7,11,25,.55);border:1px solid rgba(0,240,255,.35);padding:6px 14px;border-radius:20px;box-shadow:0 0 12px rgba(0,240,255,.25);}',
    '.lq-score .lq-ok{color:#34D399;}.lq-score .lq-bad{color:#F87171;}.lq-score .lq-so{color:#FBBF24;}',
    '.lq-card-wrap{position:relative;width:230px;height:230px;perspective:1000px;touch-action:none;}',
    '.lq-card{position:absolute;width:100%;height:100%;transform-style:preserve-3d;transition:transform .4s cubic-bezier(.25,1,.5,1);}',
    '.lq-card.flipped{transform:rotateY(180deg);}',
    '.lq-face{position:absolute;width:100%;height:100%;backface-visibility:hidden;-webkit-backface-visibility:hidden;',
    'border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:26px;box-sizing:border-box;',
    'color:#fff;text-align:center;border:2px solid rgba(255,255,255,.4);',
    'background:radial-gradient(circle at 30% 28%, rgba(255,255,255,.14) 0%, rgba(0,240,255,.06) 55%, rgba(192,132,252,.08) 88%);',
    'box-shadow:inset 0 12px 22px rgba(255,255,255,.28), inset 0 -10px 18px rgba(0,0,0,.25), 0 8px 24px rgba(0,0,0,.5), 0 0 22px rgba(0,240,255,.22);}',
    '.lq-face.back{transform:rotateY(180deg);}',
    '.lq-word{font-size:24px;font-weight:900;font-family:"Times New Roman",serif;word-break:break-word;line-height:1.25;text-shadow:0 1px 4px rgba(0,0,0,.8);}',
    '.lq-meaning{font-size:15px;font-weight:700;line-height:1.5;word-break:break-word;color:#F1F5F9;text-shadow:0 1px 3px rgba(0,0,0,.8);}',
    '.lq-num{position:absolute;top:22px;font-size:10px;font-weight:800;color:rgba(255,255,255,.55);}',
    '.lq-hint{font-size:10px;color:rgba(255,255,255,.5);font-weight:700;letter-spacing:.5px;z-index:2;}',
    '.lq-card-wrap.glow-ok .lq-face{border-color:#10B981;box-shadow:0 0 30px rgba(16,185,129,.6), inset 0 0 20px rgba(16,185,129,.3);}',
    '.lq-card-wrap.glow-bad .lq-face{border-color:#EF4444;box-shadow:0 0 30px rgba(239,68,68,.6), inset 0 0 20px rgba(239,68,68,.3);}',
    '.lq-card-wrap.glow-so .lq-face{border-color:#F59E0B;box-shadow:0 0 30px rgba(245,158,11,.6), inset 0 0 20px rgba(245,158,11,.3);}',
    '.penguin-loading-text{font-size:13px;font-weight:800;color:#00F0FF;letter-spacing:1px;z-index:2;text-shadow:0 0 10px rgba(0,240,255,.5);display:flex;align-items:center;gap:2px;}',
    '.pg-dot{animation:lqDotBlink 1.2s infinite;}',
    '.pg-dot:nth-of-type(2){animation-delay:.2s;}.pg-dot:nth-of-type(3){animation-delay:.4s;}',
    '@keyframes lqDotBlink{0%,80%,100%{opacity:.2;}40%{opacity:1;}}'
  ].join('\n');
  document.head.appendChild(st);
})();

// ------------------------------------------------------------------
// 【1】ロード画面の単語テスト（タンゴン削除）
// ------------------------------------------------------------------
window.__loadQuiz = window.__loadQuiz || { active:false, words:[], index:0, answers:[], ok:0, bad:0, so:0 };

window.__renderPenguinOverlay = function(message) {
  if (window.__pgLoad.overlay) return;
  var ov = document.createElement('div');
  ov.id = 'penguinLoadingOverlay';
  var sparks = '';
  for (var i = 0; i < 14; i++) {
    var left = Math.round(Math.random() * 100);
    var delay = (Math.random() * 6).toFixed(2);
    var dur = (5 + Math.random() * 6).toFixed(2);
    var c = Math.random() < 0.5 ? 'rgba(0,240,255,.8)' : 'rgba(192,132,252,.8)';
    sparks += '<span class="lq-spark" style="left:' + left + '%;bottom:-10px;background:' + c + ';animation-delay:' + delay + 's;animation-duration:' + dur + 's;"></span>';
  }
  ov.innerHTML =
    sparks +
    '<div class="lq-area">' +
      '<div class="lq-score" id="lqScore" style="display:none;">' +
        '<span id="lqCount">0問</span>' +
        '<span class="lq-ok" id="lqOk">⚪︎0</span>' +
        '<span class="lq-so" id="lqSo">△0</span>' +
        '<span class="lq-bad" id="lqBad">✕0</span>' +
      '</div>' +
      '<div class="lq-card-wrap" id="lqCardWrap" style="display:none;"></div>' +
      '<div class="lq-hint" id="lqHint" style="display:none;">タップでめくる ／ 右⚪︎ ・ 左✕ ・ 上△</div>' +
    '</div>' +
    '<div class="penguin-loading-text">🐧 ' + (message || '読み込み中') +
      '<span class="pg-dot">.</span><span class="pg-dot">.</span><span class="pg-dot">.</span></div>';
  document.body.appendChild(ov);
  window.__pgLoad.overlay = ov;
  requestAnimationFrame(function(){ ov.classList.add('penguin-visible'); });
  window.__initLoadQuiz(ov);
};

window.__initLoadQuiz = function(ov) {
  var q = window.__loadQuiz;
  q.answers = []; q.ok = 0; q.bad = 0; q.so = 0; q.index = 0; q.words = []; q.active = false;
  if (typeof vocabList !== 'undefined' && vocabList.length > 0) {
    q.words = vocabList.slice().sort(function(){ return Math.random() - 0.5; }).slice(0, 20);
    q.active = q.words.length > 0;
  }
  var scoreEl = ov.querySelector('#lqScore');
  var wrapEl = ov.querySelector('#lqCardWrap');
  var hintEl = ov.querySelector('#lqHint');
  if (q.active) {
    if (scoreEl) scoreEl.style.display = 'flex';
    if (wrapEl) wrapEl.style.display = 'block';
    if (hintEl) hintEl.style.display = 'block';
    window.__renderLoadQuizCard(ov);
    window.__updateLoadQuizScore(ov);
  } else {
    if (scoreEl) scoreEl.style.display = 'none';
    if (wrapEl) wrapEl.style.display = 'none';
    if (hintEl) hintEl.style.display = 'none';
  }
};

window.__updateLoadQuizScore = function(ov) {
  var q = window.__loadQuiz;
  var total = q.ok + q.bad + q.so;
  var c = ov.querySelector('#lqCount'); if (c) c.textContent = total + '問';
  var o = ov.querySelector('#lqOk'); if (o) o.textContent = '⚪︎' + q.ok;
  var s = ov.querySelector('#lqSo'); if (s) s.textContent = '△' + q.so;
  var b = ov.querySelector('#lqBad'); if (b) b.textContent = '✕' + q.bad;
};

window.__renderLoadQuizCard = function(ov) {
  var q = window.__loadQuiz;
  if (!q.active || q.words.length === 0) return;
  if (q.index >= q.words.length) {
    q.words = q.words.sort(function(){ return Math.random() - 0.5; });
    q.index = 0;
  }
  var w = q.words[q.index];
  var meaning = (w.meanings && w.meanings[0]) ? w.meanings[0].text : (w.meaning || '');
  var wrap = ov.querySelector('#lqCardWrap');
  if (!wrap) return;
  wrap.className = 'lq-card-wrap';
  wrap.style.display = 'block';
  wrap.style.transform = '';
  wrap.style.opacity = '1';
  wrap.style.transition = '';
  wrap.innerHTML =
    '<div class="lq-card" id="lqCard">' +
      '<div class="lq-face front"><span class="lq-num">#' + w.num + '</span><div class="lq-word">' + w.word + '</div></div>' +
      '<div class="lq-face back"><span class="lq-num">#' + w.num + '</span><div class="lq-meaning">' + meaning + '</div></div>' +
    '</div>';
  window.__bindLoadQuizCard(ov, wrap, w);
};

window.__bindLoadQuizCard = function(ov, wrap, w) {
  var card = wrap.querySelector('#lqCard');
  var startX = 0, startY = 0, dragging = false;
  wrap.addEventListener('touchstart', function(e) {
    startX = e.touches[0].clientX; startY = e.touches[0].clientY; dragging = true;
    wrap.style.transition = 'none';
  }, { passive: true });
  wrap.addEventListener('touchmove', function(e) {
    if (!dragging) return;
    var dx = e.touches[0].clientX - startX;
    var dy = e.touches[0].clientY - startY;
    wrap.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (dx * 0.05) + 'deg)';
    wrap.classList.remove('glow-ok','glow-bad','glow-so');
    if (dy < -15 && Math.abs(dy) > Math.abs(dx)) wrap.classList.add('glow-so');
    else if (dx > 15) wrap.classList.add('glow-ok');
    else if (dx < -15) wrap.classList.add('glow-bad');
  }, { passive: true });
  wrap.addEventListener('touchend', function(e) {
    if (!dragging) return; dragging = false;
    var dx = e.changedTouches[0].clientX - startX;
    var dy = e.changedTouches[0].clientY - startY;
    wrap.classList.remove('glow-ok','glow-bad','glow-so');
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      wrap.style.transition = 'transform .2s ease';
      wrap.style.transform = '';
      if (card) card.classList.toggle('flipped');
    } else if (dx > 60) {
      window.__answerLoadQuiz(ov, wrap, w, 'ok', dx, dy);
    } else if (dx < -60) {
      window.__answerLoadQuiz(ov, wrap, w, 'bad', dx, dy);
    } else if (dy < -60) {
      window.__answerLoadQuiz(ov, wrap, w, 'so', dx, dy);
    } else {
      wrap.style.transition = 'transform .25s ease';
      wrap.style.transform = '';
    }
  });
};

window.__answerLoadQuiz = function(ov, wrap, w, status, dx, dy) {
  var q = window.__loadQuiz;
  q.answers.push({ num: w.num, word: w.word, status: status });
  if (status === 'ok') q.ok++;
  else if (status === 'bad') q.bad++;
  else if (status === 'so') q.so++;
  window.__updateLoadQuizScore(ov);
  wrap.style.transition = 'transform .35s cubic-bezier(.1,.8,.25,1), opacity .35s ease';
  wrap.style.transform = 'translate(' + (dx * 2.2) + 'px,' + (dy * 2.2 - 40) + 'px) scale(.5) rotate(' + (dx * 0.08) + 'deg)';
  wrap.style.opacity = '0';
  q.index++;
  setTimeout(function() {
    if (window.__pgLoad.overlay === ov) window.__renderLoadQuizCard(ov);
  }, 200);
};

// ロード完了時：退避していた答えを単語帳へ反映して保存
window.__finalizeLoadQuiz = function() {
  var q = window.__loadQuiz;
  if (!q) return;
  if (q.answers && q.answers.length > 0 && typeof vocabList !== 'undefined') {
    var applied = 0;
    q.answers.forEach(function(ans) {
      var w = vocabList.find(function(v){ return String(v.num) === String(ans.num); });
      if (w && String(w.word) === String(ans.word)) {
        w.status = ans.status;
        if (w.meanings && w.meanings.length > 0) {
          w.meanings[0].status = ans.status;
          if (!w.meanings[0].history) w.meanings[0].history = [];
          w.meanings[0].history.push(ans.status);
        }
        if (!w.history) w.history = [];
        w.history.push(ans.status);
        applied++;
      }
    });
    if (applied > 0) {
      if (typeof window.scheduleVocabProgressSave === 'function') window.scheduleVocabProgressSave(300);
      if (typeof window.scheduleUserStatsRefresh === 'function') window.scheduleUserStatsRefresh(300);
    }
  }
  q.answers = [];
  q.active = false;
};

var __prevActuallyHidePenguinForQuiz = window.__actuallyHidePenguin;
window.__actuallyHidePenguin = function() {
  window.__finalizeLoadQuiz();
  if (typeof __prevActuallyHidePenguinForQuiz === 'function') __prevActuallyHidePenguinForQuiz();
};

// ------------------------------------------------------------------
// 【2】理解度保存の確実化（ローカル常時ベース＋Firebaseリトライ）
// ------------------------------------------------------------------
window.loadUserVocabProgress = async function(bookKey) {
  bookKey = bookKey || currentTextbook || 'default';
  currentUserVocabProgress = {};
  if (typeof myId === 'undefined' || !myId) return;
  try {
    var raw = localStorage.getItem(window.getVocabProgressStorageKey(bookKey));
    if (raw) currentUserVocabProgress = JSON.parse(raw) || {};
  } catch (e) {}
  if (myId === 'GUEST-000' || !window.db || !window.fbGetDoc || !window.fbDoc) return;
  try {
    const ref = window.fbDoc(window.db, 'users', myId, 'vocabProgress', bookKey);
    const snap = await window.fbGetDoc(ref);
    if (snap.exists() && snap.data() && snap.data().words) {
      currentUserVocabProgress = snap.data().words;
    }
  } catch (e) {
    console.error('loadUserVocabProgress Firebase読み込みエラー（ローカルデータで継続）:', e);
  }
};

window.saveUserVocabProgress = async function() {
  if (typeof window.rebuildVocabStemIndex === 'function') window.rebuildVocabStemIndex();
  if (typeof myId === 'undefined' || !myId) return;
  const bookKey = currentTextbook || 'default';
  currentUserVocabProgress = window.extractUserProgressFromVocabList();
  const payload = { words: currentUserVocabProgress, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(window.getVocabProgressStorageKey(bookKey), JSON.stringify(currentUserVocabProgress));
  } catch (e) {
    console.error('saveUserVocabProgress ローカル保存エラー:', e);
  }
  if (window.db && window.fbSetDoc && window.fbDoc && myId && myId !== 'GUEST-000') {
    try {
      const ref = window.fbDoc(window.db, 'users', myId, 'vocabProgress', bookKey);
      if (typeof window.fbSetDocWithRetry === 'function') {
        await window.fbSetDocWithRetry(ref, payload);
      } else {
        await window.fbSetDoc(ref, payload);
      }
    } catch (e) {
      console.error('saveUserVocabProgress Firebase保存エラー（ローカルには保存済み）:', e);
    }
  }
  userStats.vocab_fixed = vocabList.filter(function(w) {
    return w.meanings && w.meanings.some(function(m) { return m.status === 'ok'; });
  }).length;
};

// ------------------------------------------------------------------
// 【3】勉強時間の安定化（二重起動防止・毎秒表示・継続保存・総計記録）
// ------------------------------------------------------------------
window.__studyTimerIntervalId = null;
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
    localStorage.setItem('core_v4_study_today_secs', '0');
  }
  lastAccessDateStr = todayStr;
  localStorage.setItem('core_v4_study_last_date', todayStr);
  var localTotal = parseInt(localStorage.getItem('core_v4_study_total_secs') || '0');
  if (typeof userStats.study_total_secs === 'undefined' || userStats.study_total_secs === null || localTotal > userStats.study_total_secs) {
    userStats.study_total_secs = localTotal;
  }
  var updateDisplay = function() {
    var minStr = String(Math.floor(todayStudySeconds / 60)).padStart(2, '0');
    var secStr = String(todayStudySeconds % 60).padStart(2, '0');
    var el = document.getElementById('todayStudyTimeDisplay');
    if (el) el.innerText = minStr + '分' + secStr + '秒';
  };
  window.__studyTimerIntervalId = setInterval(function() {
    var shouldCount = false;
    if (currentActiveTabId === 'vocab' || currentActiveTabId === 'reader') {
      shouldCount = true;
    } else if (currentActiveTabId === 'game') {
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
    updateDisplay();
    if (shouldCount) window.renderActivityChart();
  }, 1000);
  updateDisplay();
  window.renderActivityChart();
};

// ログアウトしても勉強時間データは消さない
window.logoutToGate = function() {
  try {
    var keysToRemove = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key) continue;
      if (key.indexOf('core_v4_study_') === 0) continue;
      if (key === 'core_v4_userId' || key === 'core_v4_userName' || key === 'core_v4_userTarget' || key === 'core_v4_userTitle' ||
          key === 'core_v4_totalExp' || key === 'core_v4_friend_list' || key === 'core_v4_rewarded_titles_cache' ||
          key === 'core_v4_active_char' || key === 'core_v4_active_weapon' || key === 'core_v4_active_armor' ||
          key === 'core_v4_current_textbook_id' || key.indexOf('core_v4_user_stats_') === 0 ||
          key.indexOf('core_v4_user_avatar_') === 0 || key.indexOf('core_v4_user_vocab_progress_') === 0) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(function(key) { localStorage.removeItem(key); });
  } catch (e) { localStorage.clear(); }
  location.reload();
};

// ------------------------------------------------------------------
// 【4】フレンド勉強時間を「全期間総計」に
// ------------------------------------------------------------------
window.__formatStudyTotal = function(secs) {
  var totalMin = Math.floor((secs || 0) / 60);
  if (totalMin >= 60) {
    var h = Math.floor(totalMin / 60);
    var m = totalMin % 60;
    return h + '時間' + (m > 0 ? m + '分' : '');
  }
  return totalMin + '分';
};

window.refreshFriendListFromFirebase = async function(force) {
  if (typeof myId === 'undefined' || !myId || myId === 'GUEST-000') return;
  if (!window.db || !window.fbGetDoc || !window.fbDoc) return;
  if (!Array.isArray(myFriendList) || myFriendList.length === 0) return;
  var now = Date.now();
  if (!force && window.__friendRefreshLastAt && now - window.__friendRefreshLastAt < 60000) return;
  window.__friendRefreshLastAt = now;
  var changed = false;
  for (var i = 0; i < myFriendList.length; i++) {
    var f = myFriendList[i];
    try {
      var ref = window.fbDoc(window.db, 'users', f.code);
      var snap = await window.fbGetDoc(ref);
      if (!snap.exists()) continue;
      var d = snap.data();
      if (d.deleted) continue;
      var stats = d.userStats || {};
      var remoteLevel = f.level || 1;
      if (d.totalExp !== undefined && d.totalExp !== null) {
        remoteLevel = window.computeLevelSafe(d.totalExp);
      } else if (stats.user_level) {
        remoteLevel = parseInt(stats.user_level) || remoteLevel;
      }
      var remoteName = d.playerName || f.name;
      var remoteTitle = d.selectedTitle || f.title || '称号なし';
      var remoteAvatar = (typeof d.avatar === 'string') ? d.avatar : (f.customAvatar || '');
      var remoteTotalSecs = parseInt(stats.study_total_secs) || 0;
      var remoteLastLoginStr = f.lastLoginStr || '';
      var lastIso = stats.lastLoginAt || d.updatedAt || '';
      if (lastIso) { var formatted = window.formatFriendLastLogin(lastIso); if (formatted) remoteLastLoginStr = formatted; }
      var remoteTimestamp = f.timestamp || now;
      if (lastIso) { var t = new Date(lastIso).getTime(); if (!isNaN(t)) remoteTimestamp = t; }
      if (f.name !== remoteName || f.title !== remoteTitle || f.customAvatar !== remoteAvatar ||
          f.level !== remoteLevel || f.studyTotalSecs !== remoteTotalSecs ||
          f.lastLoginStr !== remoteLastLoginStr || f.timestamp !== remoteTimestamp) {
        f.name = remoteName; f.title = remoteTitle; f.customAvatar = remoteAvatar;
        f.level = remoteLevel; f.studyTotalSecs = remoteTotalSecs;
        f.lastLoginStr = remoteLastLoginStr; f.timestamp = remoteTimestamp;
        changed = true;
      }
    } catch (e) {}
  }
  if (changed) { try { await window.saveUserStats(); } catch (e) {} }
  if (typeof window.sortAndRenderFriendList === 'function') window.sortAndRenderFriendList();
};

window.sortAndRenderFriendList = function() {
  var container = document.getElementById('friendListContainer');
  if (!container) return;
  container.innerHTML = '';
  if (myFriendList.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-sub); font-size:12px;"> <i data-lucide="user-plus" size="24" style="margin-bottom:6px; opacity:0.5;"></i><br> まだフレンドが登録されていません。<br>上部からIDで検索して追加してみましょう！ </div>';
    window.initLucide();
    return;
  }
  var sortType = document.getElementById('friendSortSelect').value;
  var sortedList = myFriendList.slice();
  if (sortType === 'login') {
    sortedList.sort(function(a,b){ return b.timestamp - a.timestamp; });
  } else if (sortType === 'level') {
    sortedList.sort(function(a,b){ return b.level - a.level; });
  } else if (sortType === 'studyTime') {
    sortedList.sort(function(a,b){ return (b.studyTotalSecs||0) - (a.studyTotalSecs||0); });
  }
  sortedList.forEach(function(f) {
    var item = document.createElement('div');
    item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:var(--card-bg); border:1px solid var(--border); border-radius:12px; padding:10px 14px; box-shadow:0 4px 10px rgba(0,0,0,0.2);';
    var avatarContentStr = '<span style="font-size:24px; flex-shrink:0;">' + (f.avatar || '👤') + '</span>';
    if (f.customAvatar) {
      avatarContentStr = '<img src="' + f.customAvatar + '" style="width:36px; height:36px; border-radius:50%; object-fit:cover; border:1px solid var(--cosmic-purple-light);">';
    }
    var studyLabel = window.__formatStudyTotal(f.studyTotalSecs);
    item.innerHTML =
      '<div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">' +
        '<div style="width:36px; height:36px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">' + avatarContentStr + '</div>' +
        '<div style="flex:1; min-width:0;">' +
          '<div style="display:flex; align-items:baseline; gap:6px;">' +
            '<span style="font-weight:bold; color:white; font-size:13.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + f.name + '</span>' +
            '<span style="font-size:10px; font-weight:900; color:var(--cosmic-cyan); flex-shrink:0;">LV.' + f.level + '</span>' +
          '</div>' +
          '<div style="font-size:10px; color:var(--text-sub); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:1px;">' + f.title + '</div>' +
          '<div style="font-size:9px; color:rgba(255,255,255,0.4); margin-top:3px; display:flex; gap:10px;">' +
            '<span>⏱️ 総勉強: <strong style="color:white;">' + studyLabel + '</strong></span>' +
            '<span>🔑 ID: ' + f.code + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div style="text-align:right; flex-shrink:0; margin-left:8px; display:flex; flex-direction:column; align-items:flex-end; gap:6px;">' +
        '<div style="font-size:9px; color:var(--text-sub); margin-top:0;">ログイン:<br><span style="color:#FFF; font-weight:600;">' + (f.lastLoginStr ? f.lastLoginStr.split(' ')[0] : '-') + '</span></div>' +
        '<button style="background:none; border:none; color:var(--word-bad); padding:2px; cursor:pointer;" onclick="window.removeFriendDirect(\'' + f.code + '\', event)"><i data-lucide="user-x" size="14"></i></button>' +
      '</div>';
    container.appendChild(item);
  });
  window.initLucide();
};

console.log('🎴 第4回パッチ（ロード画面単語テスト＋理解度保存＋勉強時間安定化＋フレンド総計）適用完了');
// ==========================================================================
// 🎴 第5回パッチ：ロード画面クイズ改善
//    ① カードの「#31」などの番号表示を削除
//    ② 設定画面に「出題元の単語帳」選択を追加（答えは選んだ単語帳に保存）
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
// ==========================================================================

// ------------------------------------------------------------------
// 【0】パッチ専用スタイルの注入（1回だけ）
// ------------------------------------------------------------------
(function injectPatch5Css() {
  if (document.getElementById('patch5Css')) return;
  var st = document.createElement('style');
  st.id = 'patch5Css';
  st.textContent = [
    '.lq-book-label{font-size:10px;font-weight:800;color:var(--cosmic-purple-light);background:rgba(192,132,252,0.1);border:1px solid rgba(192,132,252,0.3);padding:3px 10px;border-radius:12px;letter-spacing:0.5px;margin-top:2px;box-shadow:0 0 8px rgba(192,132,252,0.2);text-shadow:0 0 6px rgba(192,132,252,0.4);}'
  ].join('\n');
  document.head.appendChild(st);
})();

// ------------------------------------------------------------------
// 【1】指定教材のマスター単語を取得（キャッシュ→ローカル→Firebase）
// ------------------------------------------------------------------
window.__getBookMasterWords = async function(bookId) {
  if (typeof window.__fetchMasterWordsForBook === 'function') {
    try { return await window.__fetchMasterWordsForBook(bookId); } catch(e){}
  }
  var master = null;
  try { if (typeof textbooksCacheMap !== 'undefined' && textbooksCacheMap && textbooksCacheMap[bookId]) master = textbooksCacheMap[bookId]; } catch(e){}
  if (!master) {
    try { var lc = localStorage.getItem('core_v4_cache_' + bookId); if (lc) master = JSON.parse(lc); } catch(e){}
  }
  if (!master && window.db && window.fbGetDoc && window.fbDoc) {
    try {
      var ref = window.fbDoc(window.db, 'shared', 'vocab_' + bookId);
      var snap = await window.fbGetDoc(ref);
      if (snap.exists() && snap.data() && snap.data().custom_words) master = snap.data().custom_words;
    } catch(e){}
  }
  return master || [];
};

// ------------------------------------------------------------------
// 【2】出題元単語帳ラベルの表示ヘルパー
// ------------------------------------------------------------------
window.__setLoadQuizBookLabel = function(ov, name, show) {
  var label = document.getElementById('lqBookLabel');
  if (!label) {
    label = document.createElement('div');
    label.id = 'lqBookLabel';
    label.className = 'lq-book-label';
    var area = ov.querySelector('.lq-area');
    if (!area) return;
    area.appendChild(label);
  }
  if (show && name) {
    label.textContent = '📔 ' + name;
    label.style.display = 'block';
  } else {
    label.style.display = 'none';
  }
};

// ------------------------------------------------------------------
// 【3】クイズ初期化の上書き（出題元単語帳の選択に対応）
// ------------------------------------------------------------------
window.__initLoadQuiz = function(ov) {
  var q = window.__loadQuiz;
  q.answers = []; q.ok = 0; q.bad = 0; q.so = 0; q.index = 0; q.words = []; q.active = false; q.bookId = null;
  var scoreEl = ov.querySelector('#lqScore');
  var wrapEl = ov.querySelector('#lqCardWrap');
  var hintEl = ov.querySelector('#lqHint');
  var hideAll = function() {
    q.active = false;
    if (scoreEl) scoreEl.style.display = 'none';
    if (wrapEl) wrapEl.style.display = 'none';
    if (hintEl) hintEl.style.display = 'none';
    window.__setLoadQuizBookLabel(ov, '', false);
  };
  var setup = function(words, bookId, name) {
    if (!words || words.length === 0) { hideAll(); return; }
    q.words = words.slice().sort(function(){ return Math.random() - 0.5; }).slice(0, 20);
    q.active = true;
    q.bookId = bookId;
    if (scoreEl) scoreEl.style.display = 'flex';
    if (wrapEl) wrapEl.style.display = 'block';
    if (hintEl) hintEl.style.display = 'block';
    window.__setLoadQuizBookLabel(ov, name, true);
    window.__renderLoadQuizCard(ov);
    window.__updateLoadQuizScore(ov);
  };
  var sel = localStorage.getItem('core_v4_loadquiz_book') || 'auto';
  var curBook = (typeof currentTextbook !== 'undefined') ? currentTextbook : 'default';
  var useCurrent = (sel === 'auto' || sel === '' || sel === curBook);
  if (useCurrent) {
    var name = '今の単語帳';
    if (typeof textbooksPool !== 'undefined' && textbooksPool) {
      var cb = textbooksPool.find(function(b){ return b.id === curBook; });
      if (cb) name = cb.name;
    }
    setup(vocabList, curBook, name);
  } else {
    var book = null;
    if (typeof textbooksPool !== 'undefined' && textbooksPool) {
      book = textbooksPool.find(function(b){ return b.id === sel; });
    }
    var bname = book ? book.name : sel;
    window.__getBookMasterWords(sel).then(function(master){
      if (window.__pgLoad.overlay !== ov) return;
      var words = window.migrateVocabData((master || []).map(function(w){ return Object.assign({}, w); }));
      setup(words, sel, bname);
    }).catch(function(){
      if (window.__pgLoad.overlay === ov) hideAll();
    });
  }
};

// ------------------------------------------------------------------
// 【4】カード描画の上書き（番号表示を削除）
// ------------------------------------------------------------------
window.__renderLoadQuizCard = function(ov) {
  var q = window.__loadQuiz;
  if (!q.active || q.words.length === 0) return;
  if (q.index >= q.words.length) {
    q.words = q.words.sort(function(){ return Math.random() - 0.5; });
    q.index = 0;
  }
  var w = q.words[q.index];
  var meaning = (w.meanings && w.meanings[0]) ? w.meanings[0].text : (w.meaning || '');
  var wrap = ov.querySelector('#lqCardWrap');
  if (!wrap) return;
  wrap.className = 'lq-card-wrap';
  wrap.style.display = 'block';
  wrap.style.transform = '';
  wrap.style.opacity = '1';
  wrap.style.transition = '';
  wrap.innerHTML =
    '<div class="lq-card" id="lqCard">' +
      '<div class="lq-face front"><div class="lq-word">' + w.word + '</div></div>' +
      '<div class="lq-face back"><div class="lq-meaning">' + meaning + '</div></div>' +
    '</div>';
  window.__bindLoadQuizCard(ov, wrap, w);
};

// ------------------------------------------------------------------
// 【5】別教材の理解度へ答えを反映して保存
// ------------------------------------------------------------------
window.__applyQuizAnswersToBook = async function(bookId, answers) {
  var master = await window.__getBookMasterWords(bookId);
  if (!master || master.length === 0) return 0;
  var words = window.migrateVocabData(master.map(function(w){ return Object.assign({}, w); }));
  var progress = {};
  var pkey = window.getVocabProgressStorageKey(bookId);
  try { progress = JSON.parse(localStorage.getItem(pkey)) || {}; } catch(e){}
  if (window.db && window.fbGetDoc && window.fbDoc && myId && myId !== 'GUEST-000') {
    try {
      var pref = window.fbDoc(window.db, 'users', myId, 'vocabProgress', bookId);
      var psnap = await window.fbGetDoc(pref);
      if (psnap.exists() && psnap.data() && psnap.data().words) progress = psnap.data().words;
    } catch(e){}
  }
  words.forEach(function(w){
    var key = String(w.num);
    var p = progress[key];
    w.status = 'none'; w.history = [];
    w.meanings = (w.meanings||[]).map(function(m){ return {id:m.id, text:m.text, status:'none', history:[]}; });
    if (p && p.sig === window.buildWordSignature(w)) {
      w.status = p.status || 'none';
      w.history = Array.isArray(p.history) ? p.history.slice(-20) : [];
      w.meanings = w.meanings.map(function(m){
        var mp = p.meanings ? p.meanings[m.id] : null;
        if (mp) return {id:m.id, text:m.text, status:mp.status||'none', history:Array.isArray(mp.history)?mp.history.slice(-20):[]};
        return m;
      });
    }
  });
  var applied = 0;
  answers.forEach(function(ans){
    var w = words.find(function(v){ return String(v.num) === String(ans.num); });
    if (w && String(w.word) === String(ans.word)) {
      w.status = ans.status;
      if (w.meanings && w.meanings.length > 0) {
        w.meanings[0].status = ans.status;
        if (!w.meanings[0].history) w.meanings[0].history = [];
        w.meanings[0].history.push(ans.status);
      }
      if (!w.history) w.history = [];
      w.history.push(ans.status);
      applied++;
    }
  });
  if (applied === 0) return 0;
  var newProgress = {};
  words.forEach(function(w){
    var key = String(w.num);
    var wp = {
      sig: window.buildWordSignature(w),
      status: w.status || 'none',
      history: Array.isArray(w.history) ? w.history.slice(-20) : [],
      meanings: {}
    };
    (w.meanings||[]).forEach(function(m){
      wp.meanings[m.id] = { status: m.status||'none', history: Array.isArray(m.history)?m.history.slice(-20):[] };
    });
    newProgress[key] = wp;
  });
  try { localStorage.setItem(pkey, JSON.stringify(newProgress)); } catch(e){}
  if (window.db && window.fbSetDoc && window.fbDoc && myId && myId !== 'GUEST-000') {
    try {
      var sref = window.fbDoc(window.db, 'users', myId, 'vocabProgress', bookId);
      var payload = { words: newProgress, updatedAt: new Date().toISOString() };
      if (typeof window.fbSetDocWithRetry === 'function') await window.fbSetDocWithRetry(sref, payload);
      else await window.fbSetDoc(sref, payload);
    } catch(e){}
  }
  return applied;
};

// ------------------------------------------------------------------
// 【6】クイズ終了処理の上書き（選んだ単語帳へ保存）
// ------------------------------------------------------------------
window.__finalizeLoadQuiz = function() {
  var q = window.__loadQuiz;
  if (!q) return;
  var answers = (q.answers || []).slice();
  q.answers = [];
  q.active = false;
  if (answers.length > 0) {
    var curBook = (typeof currentTextbook !== 'undefined') ? currentTextbook : 'default';
    var bookId = q.bookId || curBook;
    if (bookId === curBook) {
      var applied = 0;
      answers.forEach(function(ans){
        var w = vocabList.find(function(v){ return String(v.num) === String(ans.num); });
        if (w && String(w.word) === String(ans.word)) {
          w.status = ans.status;
          if (w.meanings && w.meanings.length > 0) {
            w.meanings[0].status = ans.status;
            if (!w.meanings[0].history) w.meanings[0].history = [];
            w.meanings[0].history.push(ans.status);
          }
          if (!w.history) w.history = [];
          w.history.push(ans.status);
          applied++;
        }
      });
      if (applied > 0) {
        if (typeof window.scheduleVocabProgressSave === 'function') window.scheduleVocabProgressSave(300);
        if (typeof window.scheduleUserStatsRefresh === 'function') window.scheduleUserStatsRefresh(300);
      }
    } else {
      window.__applyQuizAnswersToBook(bookId, answers);
    }
  }
};

// ------------------------------------------------------------------
// 【7】非表示時に答えを確定する処理を確実に呼び出す
// ------------------------------------------------------------------
var __prevActuallyHidePenguinForQuiz5 = window.__actuallyHidePenguin;
window.__actuallyHidePenguin = function() {
  window.__finalizeLoadQuiz();
  if (typeof __prevActuallyHidePenguinForQuiz5 === 'function') __prevActuallyHidePenguinForQuiz5();
};

// ------------------------------------------------------------------
// 【8】設定画面に「出題元の単語帳」セクションを注入
// ------------------------------------------------------------------
window.injectLoadQuizSettings = function() {
  var sidebar = document.getElementById('sidebarMenu');
  if (!sidebar) return;
  if (!document.getElementById('loadQuizSettingsSection')) {
    var section = document.createElement('div');
    section.id = 'loadQuizSettingsSection';
    section.style.cssText = "margin:8px 16px;padding:12px;background:rgba(0,240,255,0.06);border:1px solid rgba(0,240,255,0.25);border-radius:10px;box-shadow:0 0 10px rgba(0,240,255,0.1);";
    section.innerHTML =
      '<div style="font-size:11px;font-weight:800;color:var(--cosmic-cyan);margin-bottom:8px;letter-spacing:0.5px;">🎴 ロード画面クイズ設定</div>' +
      '<div style="font-size:10px;color:var(--text-sub);margin-bottom:6px;">出題元の単語帳</div>' +
      '<select id="loadQuizBookSelect" class="search-input" style="width:100%;margin:0;height:36px;"></select>' +
      '<div style="font-size:9px;color:rgba(255,255,255,0.4);margin-top:6px;line-height:1.4;">ロード中の単語クイズが、選んだ単語帳から出題されます。答えはその単語帳の理解度に保存されます。</div>';
    var anchor = null;
    var children = sidebar.children;
    for (var i = 0; i < children.length; i++) {
      if ((children[i].textContent || '').indexOf('ログアウト') !== -1) { anchor = children[i]; break; }
    }
    if (anchor) sidebar.insertBefore(section, anchor);
    else sidebar.appendChild(section);
  }
  window.updateLoadQuizBookSelect();
};

window.updateLoadQuizBookSelect = function() {
  var sel = document.getElementById('loadQuizBookSelect');
  if (!sel) return;
  var current = localStorage.getItem('core_v4_loadquiz_book') || 'auto';
  var html = '<option value="auto">自動（今の単語帳）</option>';
  var pool = (typeof textbooksPool !== 'undefined' && textbooksPool) ? textbooksPool : [];
  pool.forEach(function(b){
    html += '<option value="' + b.id + '">' + b.name + '</option>';
  });
  sel.innerHTML = html;
  sel.value = current;
  sel.onchange = function() {
    localStorage.setItem('core_v4_loadquiz_book', sel.value);
    if (typeof window.showToast === 'function') window.showToast('🎴 ロードクイズの出題元を設定しました', 'ok');
  };
};

// ------------------------------------------------------------------
// 【9】loadLocalState 上書き（設定セクションの注入）
// ------------------------------------------------------------------
var __prevLoadLocalStateForQuizSettings = window.loadLocalState;
window.loadLocalState = async function() {
  var r = __prevLoadLocalStateForQuizSettings ? await __prevLoadLocalStateForQuizSettings.apply(this, arguments) : undefined;
  window.injectLoadQuizSettings();
  return r;
};

// ------------------------------------------------------------------
// 【10】起動時注入
// ------------------------------------------------------------------
(function initLoadQuizSettingsPatch() {
  function boot() { window.injectLoadQuizSettings(); }
  if (document.readyState !== 'loading') { setTimeout(boot, 400); }
  else { document.addEventListener('DOMContentLoaded', function(){ setTimeout(boot, 400); }); }
})();

console.log('🎴 第5回パッチ（ロードクイズ番号削除＋出題元単語帳選択）適用完了');
// ==========================================================================
// 🎴 第6回パッチ：ロード画面クイズ 完全修正版（自己完結）
//    ① 耳の増殖バグ根絶（1カード=1リスナー） ② スコアバー削除 ③ 番号削除
//    ④ 記録B（⚪︎△✕全部） ⑤ 出題元単語帳選択＋別教材へ正しく保存
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
// ==========================================================================

// ------------------------------------------------------------------
// 【0】スタイル補完（出題元ラベル。主要スタイルは既存パッチで定義済み）
// ------------------------------------------------------------------
(function injectPatch6Css() {
  if (document.getElementById('patch6Css')) return;
  var st = document.createElement('style');
  st.id = 'patch6Css';
  st.textContent = '.lq-book-label{font-size:10px;font-weight:800;color:var(--cosmic-purple-light);background:rgba(192,132,252,0.1);border:1px solid rgba(192,132,252,0.3);padding:3px 10px;border-radius:12px;letter-spacing:0.5px;margin-top:2px;box-shadow:0 0 8px rgba(192,132,252,0.2);text-shadow:0 0 6px rgba(192,132,252,0.4);}';
  document.head.appendChild(st);
})();

// ------------------------------------------------------------------
// 【1】共有状態
// ------------------------------------------------------------------
window.__loadQuiz = window.__loadQuiz || { active:false, words:[], index:0, answers:[], ok:0, bad:0, so:0, bookId:null };
window.__lqCurrent = window.__lqCurrent || null;

// ------------------------------------------------------------------
// 【2】ローディング描画（スコアバー無し・クイズ枠＋ヒントのみ）
// ------------------------------------------------------------------
window.__renderPenguinOverlay = function(message) {
  if (window.__pgLoad.overlay) return;
  var ov = document.createElement('div');
  ov.id = 'penguinLoadingOverlay';
  var sparks = '';
  for (var i = 0; i < 14; i++) {
    var left = Math.round(Math.random() * 100);
    var delay = (Math.random() * 6).toFixed(2);
    var dur = (5 + Math.random() * 6).toFixed(2);
    var c = Math.random() < 0.5 ? 'rgba(0,240,255,.8)' : 'rgba(192,132,252,.8)';
    sparks += '<span class="lq-spark" style="left:' + left + '%;bottom:-10px;background:' + c + ';animation-delay:' + delay + 's;animation-duration:' + dur + 's;"></span>';
  }
  ov.innerHTML =
    sparks +
    '<div class="lq-area">' +
      '<div class="lq-card-wrap" id="lqCardWrap" style="display:none;"></div>' +
      '<div class="lq-hint" id="lqHint" style="display:none;">タップでめくる ／ 右⚪︎ ・ 左✕ ・ 上△</div>' +
    '</div>' +
    '<div class="penguin-loading-text">🐧 ' + (message || '読み込み中') +
      '<span class="pg-dot">.</span><span class="pg-dot">.</span><span class="pg-dot">.</span></div>';
  document.body.appendChild(ov);
  window.__pgLoad.overlay = ov;
  requestAnimationFrame(function(){ ov.classList.add('penguin-visible'); });
  window.__initLoadQuiz(ov);
};

// ------------------------------------------------------------------
// 【3】出題元ラベル
// ------------------------------------------------------------------
window.__setLoadQuizBookLabel = function(ov, name, show) {
  var label = document.getElementById('lqBookLabel');
  if (!label) {
    label = document.createElement('div');
    label.id = 'lqBookLabel';
    label.className = 'lq-book-label';
    var area = ov.querySelector('.lq-area');
    if (!area) return;
    area.appendChild(label);
  }
  if (show && name) { label.textContent = '📔 ' + name; label.style.display = 'block'; }
  else { label.style.display = 'none'; }
};

// ------------------------------------------------------------------
// 【4】クイズ初期化（出題元選択込み・スコアバー参照なし）
// ------------------------------------------------------------------
window.__initLoadQuiz = function(ov) {
  var q = window.__loadQuiz;
  q.answers = []; q.ok = 0; q.bad = 0; q.so = 0; q.index = 0; q.words = []; q.active = false; q.bookId = null;
  var wrapEl = ov.querySelector('#lqCardWrap');
  var hintEl = ov.querySelector('#lqHint');
  var hideAll = function() {
    q.active = false;
    if (wrapEl) wrapEl.style.display = 'none';
    if (hintEl) hintEl.style.display = 'none';
    window.__setLoadQuizBookLabel(ov, '', false);
  };
  var setup = function(words, bookId, name) {
    if (!words || words.length === 0) { hideAll(); return; }
    q.words = words.slice().sort(function(){ return Math.random() - 0.5; }).slice(0, 20);
    q.active = true;
    q.bookId = bookId;
    if (wrapEl) wrapEl.style.display = 'block';
    if (hintEl) hintEl.style.display = 'block';
    window.__setLoadQuizBookLabel(ov, name, true);
    window.__renderLoadQuizCard(ov);
  };
  var sel = localStorage.getItem('core_v4_loadquiz_book') || 'auto';
  var curBook = (typeof currentTextbook !== 'undefined') ? currentTextbook : 'default';
  var useCurrent = (sel === 'auto' || sel === '' || sel === curBook);
  if (useCurrent) {
    var name = '今の単語帳';
    if (typeof textbooksPool !== 'undefined' && textbooksPool) {
      var cb = textbooksPool.find(function(b){ return b.id === curBook; });
      if (cb) name = cb.name;
    }
    setup((typeof vocabList !== 'undefined' ? vocabList : []), curBook, name);
  } else {
    var book = null;
    if (typeof textbooksPool !== 'undefined' && textbooksPool) {
      book = textbooksPool.find(function(b){ return b.id === sel; });
    }
    var bname = book ? book.name : sel;
    window.__getBookMasterWords(sel).then(function(master){
      if (window.__pgLoad.overlay !== ov) return;
      var words = (typeof window.migrateVocabData === 'function') ? window.migrateVocabData((master || []).map(function(w){ return Object.assign({}, w); })) : (master || []);
      setup(words, sel, bname);
    }).catch(function(){
      if (window.__pgLoad.overlay === ov) hideAll();
    });
  }
};

// ------------------------------------------------------------------
// 【5】スコア表示更新（表示要素が無いので無害なno-op）
// ------------------------------------------------------------------
window.__updateLoadQuizScore = function() { /* スコアバーは表示しない */ };

// ------------------------------------------------------------------
// 【6】カード描画（番号なし・現在の単語を共有状態へ）
// ------------------------------------------------------------------
window.__renderLoadQuizCard = function(ov) {
  var q = window.__loadQuiz;
  if (!q.active || q.words.length === 0) return;
  if (q.index >= q.words.length) {
    q.words = q.words.sort(function(){ return Math.random() - 0.5; });
    q.index = 0;
  }
  var w = q.words[q.index];
  var meaning = (w.meanings && w.meanings[0]) ? w.meanings[0].text : (w.meaning || '');
  var wrap = ov.querySelector('#lqCardWrap');
  if (!wrap) return;
  wrap.className = 'lq-card-wrap';
  wrap.style.display = 'block';
  wrap.style.transform = '';
  wrap.style.opacity = '1';
  wrap.style.transition = '';
  wrap.innerHTML =
    '<div class="lq-card" id="lqCard">' +
      '<div class="lq-face front"><div class="lq-word">' + w.word + '</div></div>' +
      '<div class="lq-face back"><div class="lq-meaning">' + meaning + '</div></div>' +
    '</div>';
  window.__lqCurrent = { word: w, ov: ov };
  window.__bindLoadQuizCard(ov, wrap);
};

// ------------------------------------------------------------------
// 【7】スワイプ判定（★増殖防止：カード枠に1組だけ固定）
// ------------------------------------------------------------------
window.__bindLoadQuizCard = function(ov, wrap) {
  if (wrap.dataset.lqBound === '1') return;
  wrap.dataset.lqBound = '1';
  var startX = 0, startY = 0, dragging = false;
  wrap.addEventListener('touchstart', function(e) {
    startX = e.touches[0].clientX; startY = e.touches[0].clientY; dragging = true;
    wrap.style.transition = 'none';
  }, { passive: true });
  wrap.addEventListener('touchmove', function(e) {
    if (!dragging) return;
    var dx = e.touches[0].clientX - startX;
    var dy = e.touches[0].clientY - startY;
    wrap.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (dx * 0.05) + 'deg)';
    wrap.classList.remove('glow-ok','glow-bad','glow-so');
    if (dy < -15 && Math.abs(dy) > Math.abs(dx)) wrap.classList.add('glow-so');
    else if (dx > 15) wrap.classList.add('glow-ok');
    else if (dx < -15) wrap.classList.add('glow-bad');
  }, { passive: true });
  wrap.addEventListener('touchend', function(e) {
    if (!dragging) return; dragging = false;
    var dx = e.changedTouches[0].clientX - startX;
    var dy = e.changedTouches[0].clientY - startY;
    wrap.classList.remove('glow-ok','glow-bad','glow-so');
    var cur = window.__lqCurrent;
    if (!cur || !cur.word) return;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      wrap.style.transition = 'transform .2s ease';
      wrap.style.transform = '';
      var card = wrap.querySelector('#lqCard');
      if (card) card.classList.toggle('flipped');
    } else if (dx > 60) {
      window.__answerLoadQuiz(ov, wrap, cur.word, 'ok', dx, dy);
    } else if (dx < -60) {
      window.__answerLoadQuiz(ov, wrap, cur.word, 'bad', dx, dy);
    } else if (dy < -60) {
      window.__answerLoadQuiz(ov, wrap, cur.word, 'so', dx, dy);
    } else {
      wrap.style.transition = 'transform .25s ease';
      wrap.style.transform = '';
    }
  });
};

// ------------------------------------------------------------------
// 【8】回答処理（記録B：⚪︎△✕全部を退避）
// ------------------------------------------------------------------
window.__answerLoadQuiz = function(ov, wrap, w, status, dx, dy) {
  var q = window.__loadQuiz;
  q.answers.push({ num: w.num, word: w.word, status: status });
  if (status === 'ok') q.ok++;
  else if (status === 'bad') q.bad++;
  else if (status === 'so') q.so++;
  wrap.style.transition = 'transform .35s cubic-bezier(.1,.8,.25,1), opacity .35s ease';
  wrap.style.transform = 'translate(' + (dx * 2.2) + 'px,' + (dy * 2.2 - 40) + 'px) scale(.5) rotate(' + (dx * 0.08) + 'deg)';
  wrap.style.opacity = '0';
  q.index++;
  setTimeout(function() {
    if (window.__pgLoad.overlay === ov) window.__renderLoadQuizCard(ov);
  }, 200);
};

// ------------------------------------------------------------------
// 【9】指定教材のマスター単語取得
// ------------------------------------------------------------------
window.__getBookMasterWords = async function(bookId) {
  var master = null;
  try { if (typeof textbooksCacheMap !== 'undefined' && textbooksCacheMap && textbooksCacheMap[bookId]) master = textbooksCacheMap[bookId]; } catch(e){}
  if (!master) {
    try { var lc = localStorage.getItem('core_v4_cache_' + bookId); if (lc) master = JSON.parse(lc); } catch(e){}
  }
  if (!master && window.db && window.fbGetDoc && window.fbDoc) {
    try {
      var ref = window.fbDoc(window.db, 'shared', 'vocab_' + bookId);
      var snap = await window.fbGetDoc(ref);
      if (snap.exists() && snap.data() && snap.data().custom_words) master = snap.data().custom_words;
    } catch(e){}
  }
  return master || [];
};

// ------------------------------------------------------------------
// 【10】別教材の理解度へ反映して保存
// ------------------------------------------------------------------
window.__applyQuizAnswersToBook = async function(bookId, answers) {
  var master = await window.__getBookMasterWords(bookId);
  if (!master || master.length === 0) return 0;
  var words = (typeof window.migrateVocabData === 'function') ? window.migrateVocabData(master.map(function(w){ return Object.assign({}, w); })) : master.map(function(w){ return Object.assign({}, w); });
  var progress = {};
  var pkey = window.getVocabProgressStorageKey(bookId);
  try { progress = JSON.parse(localStorage.getItem(pkey)) || {}; } catch(e){}
  if (window.db && window.fbGetDoc && window.fbDoc && myId && myId !== 'GUEST-000') {
    try {
      var pref = window.fbDoc(window.db, 'users', myId, 'vocabProgress', bookId);
      var psnap = await window.fbGetDoc(pref);
      if (psnap.exists() && psnap.data() && psnap.data().words) progress = psnap.data().words;
    } catch(e){}
  }
  words.forEach(function(w){
    var key = String(w.num);
    var p = progress[key];
    w.status = 'none'; w.history = [];
    w.meanings = (w.meanings || []).map(function(m){ return { id:m.id, text:m.text, status:'none', history:[] }; });
    if (p && p.sig === window.buildWordSignature(w)) {
      w.status = p.status || 'none';
      w.history = Array.isArray(p.history) ? p.history.slice(-20) : [];
      w.meanings = w.meanings.map(function(m){
        var mp = p.meanings ? p.meanings[m.id] : null;
        if (mp) return { id:m.id, text:m.text, status:mp.status||'none', history:Array.isArray(mp.history)?mp.history.slice(-20):[] };
        return m;
      });
    }
  });
  var applied = 0;
  answers.forEach(function(ans){
    var w = words.find(function(v){ return String(v.num) === String(ans.num); });
    if (w && String(w.word) === String(ans.word)) {
      w.status = ans.status;
      if (w.meanings && w.meanings.length > 0) {
        w.meanings[0].status = ans.status;
        if (!w.meanings[0].history) w.meanings[0].history = [];
        w.meanings[0].history.push(ans.status);
      }
      if (!w.history) w.history = [];
      w.history.push(ans.status);
      applied++;
    }
  });
  if (applied === 0) return 0;
  var newProgress = {};
  words.forEach(function(w){
    var key = String(w.num);
    var wp = { sig: window.buildWordSignature(w), status: w.status || 'none', history: Array.isArray(w.history) ? w.history.slice(-20) : [], meanings: {} };
    (w.meanings || []).forEach(function(m){ wp.meanings[m.id] = { status: m.status || 'none', history: Array.isArray(m.history) ? m.history.slice(-20) : [] }; });
    newProgress[key] = wp;
  });
  try { localStorage.setItem(pkey, JSON.stringify(newProgress)); } catch(e){}
  if (window.db && window.fbSetDoc && window.fbDoc && myId && myId !== 'GUEST-000') {
    try {
      var sref = window.fbDoc(window.db, 'users', myId, 'vocabProgress', bookId);
      var payload = { words: newProgress, updatedAt: new Date().toISOString() };
      if (typeof window.fbSetDocWithRetry === 'function') await window.fbSetDocWithRetry(sref, payload);
      else await window.fbSetDoc(sref, payload);
    } catch(e){}
  }
  return applied;
};

// ------------------------------------------------------------------
// 【11】クイズ終了：退避した答えを選んだ単語帳へ反映
// ------------------------------------------------------------------
window.__finalizeLoadQuiz = function() {
  var q = window.__loadQuiz;
  if (!q) return;
  var answers = (q.answers || []).slice();
  q.answers = [];
  q.active = false;
  if (answers.length > 0) {
    var curBook = (typeof currentTextbook !== 'undefined') ? currentTextbook : 'default';
    var bookId = q.bookId || curBook;
    if (bookId === curBook) {
      var applied = 0;
      answers.forEach(function(ans){
        var w = (typeof vocabList !== 'undefined' ? vocabList : []).find(function(v){ return String(v.num) === String(ans.num); });
        if (w && String(w.word) === String(ans.word)) {
          w.status = ans.status;
          if (w.meanings && w.meanings.length > 0) {
            w.meanings[0].status = ans.status;
            if (!w.meanings[0].history) w.meanings[0].history = [];
            w.meanings[0].history.push(ans.status);
          }
          if (!w.history) w.history = [];
          w.history.push(ans.status);
          applied++;
        }
      });
      if (applied > 0) {
        if (typeof window.scheduleVocabProgressSave === 'function') window.scheduleVocabProgressSave(300);
        if (typeof window.scheduleUserStatsRefresh === 'function') window.scheduleUserStatsRefresh(300);
      }
    } else {
      window.__applyQuizAnswersToBook(bookId, answers);
    }
  }
};

// ------------------------------------------------------------------
// 【12】ロード終了時に答えを確定
// ------------------------------------------------------------------
var __prevActuallyHidePenguinForQuiz6 = window.__actuallyHidePenguin;
window.__actuallyHidePenguin = function() {
  window.__finalizeLoadQuiz();
  if (typeof __prevActuallyHidePenguinForQuiz6 === 'function') __prevActuallyHidePenguinForQuiz6();
};

// ------------------------------------------------------------------
// 【13】設定画面：出題元の単語帳を選択
// ------------------------------------------------------------------
window.injectLoadQuizSettings = function() {
  var sidebar = document.getElementById('sidebarMenu');
  if (!sidebar) return;
  if (!document.getElementById('loadQuizSettingsSection')) {
    var section = document.createElement('div');
    section.id = 'loadQuizSettingsSection';
    section.style.cssText = "margin:8px 16px;padding:12px;background:rgba(0,240,255,0.06);border:1px solid rgba(0,240,255,0.25);border-radius:10px;box-shadow:0 0 10px rgba(0,240,255,0.1);";
    section.innerHTML =
      '<div style="font-size:11px;font-weight:800;color:var(--cosmic-cyan);margin-bottom:8px;letter-spacing:0.5px;">🎴 ロード画面クイズ設定</div>' +
      '<div style="font-size:10px;color:var(--text-sub);margin-bottom:6px;">出題元の単語帳</div>' +
      '<select id="loadQuizBookSelect" class="search-input" style="width:100%;margin:0;height:36px;"></select>' +
      '<div style="font-size:9px;color:rgba(255,255,255,0.4);margin-top:6px;line-height:1.4;">ロード中の単語クイズが、選んだ単語帳から出題されます。答えはその単語帳の理解度に保存されます。</div>';
    var anchor = null;
    var children = sidebar.children;
    for (var i = 0; i < children.length; i++) {
      if ((children[i].textContent || '').indexOf('ログアウト') !== -1) { anchor = children[i]; break; }
    }
    if (anchor) sidebar.insertBefore(section, anchor);
    else sidebar.appendChild(section);
  }
  window.updateLoadQuizBookSelect();
};

window.updateLoadQuizBookSelect = function() {
  var sel = document.getElementById('loadQuizBookSelect');
  if (!sel) return;
  var current = localStorage.getItem('core_v4_loadquiz_book') || 'auto';
  var html = '<option value="auto">自動（今の単語帳）</option>';
  var pool = (typeof textbooksPool !== 'undefined' && textbooksPool) ? textbooksPool : [];
  pool.forEach(function(b){ html += '<option value="' + b.id + '">' + b.name + '</option>'; });
  sel.innerHTML = html;
  sel.value = current;
  sel.onchange = function() {
    localStorage.setItem('core_v4_loadquiz_book', sel.value);
    if (typeof window.showToast === 'function') window.showToast('🎴 ロードクイズの出題元を設定しました', 'ok');
  };
};

var __prevLoadLocalStateForQuiz6 = window.loadLocalState;
window.loadLocalState = async function() {
  var r = __prevLoadLocalStateForQuiz6 ? await __prevLoadLocalStateForQuiz6.apply(this, arguments) : undefined;
  window.injectLoadQuizSettings();
  return r;
};

(function initPatch6() {
  function boot() { window.injectLoadQuizSettings(); }
  if (document.readyState !== 'loading') { setTimeout(boot, 400); }
  else { document.addEventListener('DOMContentLoaded', function(){ setTimeout(boot, 400); }); }
})();

console.log('🎴 第6回パッチ（ロードクイズ完全修正：増殖根絶＋スコアバー削除＋番号削除＋出題元選択）適用完了');
// ==========================================================================
// 🛡️ 第7回パッチ：Firestore invalid-argument 根絶
//    ・保存データから undefined / NaN / Infinity / 関数 / 循環参照 を自動除去
//    ・生 Date を ISO 文字列へ正規化
//    ・理解度保存の教材キー(パス)を安全化
//    ・window.fbSetDoc を横断ラップし、全保存を自動で掃除
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
// ==========================================================================

// ------------------------------------------------------------------
// 【0】Firestore 用に値を掃除する（再帰・循環参照対応）
// ------------------------------------------------------------------
window.__sanitizeForFirestore = function sanitize(val, seen) {
  if (val === null) return null;
  if (val === undefined) return undefined;
  var t = typeof val;
  if (t === "function" || t === "symbol") return undefined;
  if (t === "number") {
    if (isNaN(val) || !isFinite(val)) return null;
    return val;
  }
  if (t === "string" || t === "boolean") return val;
  if (val instanceof Date) {
    var iso = val.toISOString();
    return isNaN(val.getTime()) ? null : iso;
  }
  if (t === "object") {
    if (!seen) { try { seen = new WeakSet(); } catch (e) { seen = null; } }
    if (seen) {
      try { if (seen.has(val)) return Array.isArray(val) ? [] : null; } catch (e) {}
      try { seen.add(val); } catch (e) {}
    }
    if (Array.isArray(val)) {
      var arr = [];
      for (var i = 0; i < val.length; i++) {
        var av = sanitize(val[i], seen);
        arr.push(av === undefined ? null : av);
      }
      return arr;
    }
    var obj = {};
    var keys = Object.keys(val);
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      var cv = sanitize(val[key], seen);
      if (cv !== undefined) obj[key] = cv;
    }
    return obj;
  }
  return undefined;
};

// ------------------------------------------------------------------
// 【1】教材キー(パス)を安全化するヘルパー
// ------------------------------------------------------------------
window.__safeBookKey = function(raw) {
  var key = (typeof raw === "string") ? raw.trim() : "";
  if (!key) key = "default";
  if (key.indexOf("/") !== -1) key = key.replace(/\//g, "_");
  return key;
};

// ------------------------------------------------------------------
// 【2】理解度保存を上書き（パス安全化＋掃除＋リトライ）
// ------------------------------------------------------------------
window.saveUserVocabProgress = async function() {
  if (typeof window.rebuildVocabStemIndex === "function") window.rebuildVocabStemIndex();
  if (typeof myId === "undefined" || !myId) return;
  var bookKey = window.__safeBookKey(currentTextbook || "default");
  currentUserVocabProgress = window.extractUserProgressFromVocabList();
  var payload = { words: currentUserVocabProgress, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(window.getVocabProgressStorageKey(bookKey), JSON.stringify(currentUserVocabProgress));
  } catch (e) {
    console.error("saveUserVocabProgress ローカル保存エラー:", e);
  }
  if (window.db && window.fbSetDoc && window.fbDoc && myId && myId !== "GUEST-000") {
    try {
      var ref = window.fbDoc(window.db, "users", myId, "vocabProgress", bookKey);
      var safe = window.__sanitizeForFirestore ? window.__sanitizeForFirestore(payload) : payload;
      if (typeof window.fbSetDocWithRetry === "function") {
        await window.fbSetDocWithRetry(ref, safe);
      } else {
        await window.fbSetDoc(ref, safe);
      }
    } catch (e) {
      console.error("saveUserVocabProgress Firebase保存エラー（ローカルには保存済み）:", e);
    }
  }
  userStats.vocab_fixed = vocabList.filter(function(w) {
    return w.meanings && w.meanings.some(function(m) { return m.status === "ok"; });
  }).length;
};

// ------------------------------------------------------------------
// 【3】window.fbSetDoc を横断ラップ（全保存を自動で掃除）
//     ※Firebase 初期化のタイミングに左右されず、複数回試行して確実にフック
// ------------------------------------------------------------------
window.__installFbSetDocSanitize = function() {
  if (window.__fbSetDocSanitized) return;
  if (typeof window.fbSetDoc !== "function") return;
  var orig = window.fbSetDoc;
  if (orig && orig.__sanitizedWrap) return;
  var wrapped = function(ref, data, options) {
    var safe = data;
    try {
      if (window.__sanitizeForFirestore) safe = window.__sanitizeForFirestore(data);
    } catch (e) {}
    return orig.call(this, ref, safe, options);
  };
  wrapped.__sanitizedWrap = true;
  window.fbSetDoc = wrapped;
  window.__fbSetDocSanitized = true;
  console.log("🛡️ fbSetDoc 掃除ラップを装着しました");
};

window.__installFbSetDocSanitize();
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function() { window.__installFbSetDocSanitize(); });
} else {
  setTimeout(window.__installFbSetDocSanitize, 0);
}
setTimeout(window.__installFbSetDocSanitize, 800);
setTimeout(window.__installFbSetDocSanitize, 2500);

console.log("🛡️ 第7回パッチ（Firestore invalid-argument 根絶：undefined/NaN 除去＋パス安全化＋横断ラップ）適用完了");
// ==========================================================================
// 🎴 第8回パッチ：ロード画面クイズ 完全自己完結版
//    ① 耳の増殖を根絶（枠に生涯1リスナー＝委譲方式）→ 1スワイプ=1回答
//    ② スコアバー削除 ③ カード番号削除
//    ④ 出題元の単語帳を選択（設定画面） ⑤ 記録B（⚪︎△✕全部をその単語帳へ）
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
// ==========================================================================

// ------------------------------------------------------------------
// 【0】スタイル注入（自己完結：主要スタイルをここで確定）
// ------------------------------------------------------------------
(function injectPatch8Css() {
  if (document.getElementById('patch8Css')) return;
  var st = document.createElement('style');
  st.id = 'patch8Css';
  st.textContent = [
    '#penguinLoadingOverlay{position:fixed;top:0;left:0;width:100%;height:100%;',
    'background:radial-gradient(circle at 50% 38%, rgba(30,27,75,0.97) 0%, rgba(15,23,42,0.985) 72%);',
    'z-index:99998;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;',
    'opacity:0;transition:opacity .25s ease;overflow:hidden;}',
    '#penguinLoadingOverlay.penguin-visible{opacity:1;}',
    '#penguinLoadingOverlay.penguin-fade-out{opacity:0;}',
    '.lq-spark{position:absolute;width:4px;height:4px;border-radius:50%;pointer-events:none;opacity:0;animation:lqSparkFloat linear infinite;}',
    '@keyframes lqSparkFloat{0%{transform:translateY(20px) scale(.6);opacity:0;}20%{opacity:.9;}80%{opacity:.6;}100%{transform:translateY(-90vh) scale(1);opacity:0;}}',
    '.lq-area{display:flex;flex-direction:column;align-items:center;gap:14px;z-index:2;}',
    '.lq-card-wrap{position:relative;width:230px;height:230px;perspective:1000px;touch-action:none;-webkit-tap-highlight-color:transparent;}',
    '.lq-card{position:absolute;width:100%;height:100%;transform-style:preserve-3d;transition:transform .4s cubic-bezier(.25,1,.5,1);}',
    '.lq-card.flipped{transform:rotateY(180deg);}',
    '.lq-face{position:absolute;width:100%;height:100%;backface-visibility:hidden;-webkit-backface-visibility:hidden;',
    'border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:26px;box-sizing:border-box;',
    'color:#fff;text-align:center;border:2px solid rgba(255,255,255,.4);',
    'background:radial-gradient(circle at 30% 28%, rgba(255,255,255,.14) 0%, rgba(0,240,255,.06) 55%, rgba(192,132,252,.08) 88%);',
    'box-shadow:inset 0 12px 22px rgba(255,255,255,.28), inset 0 -10px 18px rgba(0,0,0,.25), 0 8px 24px rgba(0,0,0,.5), 0 0 22px rgba(0,240,255,.22);',
    'transition:border-color .15s ease, box-shadow .15s ease;}',
    '.lq-face.back{transform:rotateY(180deg);}',
    '.lq-word{font-size:24px;font-weight:900;font-family:"Times New Roman",serif;word-break:break-word;line-height:1.25;text-shadow:0 1px 4px rgba(0,0,0,.8);}',
    '.lq-meaning{font-size:15px;font-weight:700;line-height:1.5;word-break:break-word;color:#F1F5F9;text-shadow:0 1px 3px rgba(0,0,0,.8);}',
    '.lq-hint{font-size:10px;color:rgba(255,255,255,.5);font-weight:700;letter-spacing:.5px;z-index:2;}',
    '.lq-card-wrap.glow-ok .lq-face{border-color:#10B981;box-shadow:0 0 30px rgba(16,185,129,.6), inset 0 0 20px rgba(16,185,129,.3);}',
    '.lq-card-wrap.glow-bad .lq-face{border-color:#EF4444;box-shadow:0 0 30px rgba(239,68,68,.6), inset 0 0 20px rgba(239,68,68,.3);}',
    '.lq-card-wrap.glow-so .lq-face{border-color:#F59E0B;box-shadow:0 0 30px rgba(245,158,11,.6), inset 0 0 20px rgba(245,158,11,.3);}',
    '.lq-book-label{font-size:10px;font-weight:800;color:var(--cosmic-purple-light);background:rgba(192,132,252,0.1);border:1px solid rgba(192,132,252,0.3);padding:3px 10px;border-radius:12px;letter-spacing:0.5px;margin-top:2px;box-shadow:0 0 8px rgba(192,132,252,0.2);text-shadow:0 0 6px rgba(192,132,252,0.4);}',
    '.penguin-loading-text{font-size:13px;font-weight:800;color:#00F0FF;letter-spacing:1px;z-index:2;text-shadow:0 0 10px rgba(0,240,255,.5);display:flex;align-items:center;gap:2px;}',
    '.pg-dot{animation:lqDotBlink 1.2s infinite;}',
    '.pg-dot:nth-of-type(2){animation-delay:.2s;}.pg-dot:nth-of-type(3){animation-delay:.4s;}',
    '@keyframes lqDotBlink{0%,80%,100%{opacity:.2;}40%{opacity:1;}}'
  ].join('\n');
  document.head.appendChild(st);
})();

// ------------------------------------------------------------------
// 【1】共有状態（今のカード／退避した答え／出題元）
// ------------------------------------------------------------------
window.__loadQuiz = window.__loadQuiz || { active:false, words:[], index:0, answers:[], ok:0, bad:0, so:0, bookId:null };
window.__lqCurrent = window.__lqCurrent || null; // { word, ov }

// ------------------------------------------------------------------
// 【2】ローディング描画（★スコアバー無し／クイズ枠＋ヒント＋出題元ラベルのみ）
// ------------------------------------------------------------------
window.__renderPenguinOverlay = function(message) {
  if (window.__pgLoad.overlay) return;
  var ov = document.createElement('div');
  ov.id = 'penguinLoadingOverlay';
  var sparks = '';
  for (var i = 0; i < 14; i++) {
    var left = Math.round(Math.random() * 100);
    var delay = (Math.random() * 6).toFixed(2);
    var dur = (5 + Math.random() * 6).toFixed(2);
    var c = Math.random() < 0.5 ? 'rgba(0,240,255,.8)' : 'rgba(192,132,252,.8)';
    sparks += '<span class="lq-spark" style="left:' + left + '%;bottom:-10px;background:' + c + ';animation-delay:' + delay + 's;animation-duration:' + dur + 's;"></span>';
  }
  ov.innerHTML =
    sparks +
    '<div class="lq-area">' +
      '<div class="lq-card-wrap" id="lqCardWrap" style="display:none;"></div>' +
      '<div class="lq-hint" id="lqHint" style="display:none;">タップでめくる ／ 右⚪︎ ・ 左✕ ・ 上△</div>' +
    '</div>' +
    '<div class="penguin-loading-text">🐧 ' + (message || '読み込み中') +
      '<span class="pg-dot">.</span><span class="pg-dot">.</span><span class="pg-dot">.</span></div>';
  document.body.appendChild(ov);
  window.__pgLoad.overlay = ov;
  requestAnimationFrame(function(){ ov.classList.add('penguin-visible'); });
  window.__initLoadQuiz(ov);
};

// ------------------------------------------------------------------
// 【3】出題元ラベル表示
// ------------------------------------------------------------------
window.__setLoadQuizBookLabel = function(ov, name, show) {
  var label = document.getElementById('lqBookLabel');
  if (!label) {
    label = document.createElement('div');
    label.id = 'lqBookLabel';
    label.className = 'lq-book-label';
    var area = ov.querySelector('.lq-area');
    if (!area) return;
    area.appendChild(label);
  }
  if (show && name) { label.textContent = '📔 ' + name; label.style.display = 'block'; }
  else { label.style.display = 'none'; }
};

// ------------------------------------------------------------------
// 【4】クイズ初期化（出題元選択込み）
// ------------------------------------------------------------------
window.__initLoadQuiz = function(ov) {
  var q = window.__loadQuiz;
  q.answers = []; q.ok = 0; q.bad = 0; q.so = 0; q.index = 0; q.words = []; q.active = false; q.bookId = null;
  window.__lqCurrent = null;
  var wrapEl = ov.querySelector('#lqCardWrap');
  var hintEl = ov.querySelector('#lqHint');
  var hideAll = function() {
    q.active = false;
    if (wrapEl) wrapEl.style.display = 'none';
    if (hintEl) hintEl.style.display = 'none';
    window.__setLoadQuizBookLabel(ov, '', false);
  };
  var setup = function(words, bookId, name) {
    if (!words || words.length === 0) { hideAll(); return; }
    q.words = words.slice().sort(function(){ return Math.random() - 0.5; }).slice(0, 20);
    q.active = true;
    q.bookId = bookId;
    if (wrapEl) { wrapEl.style.display = 'block'; window.__bindLoadQuizCardOnce(wrapEl); }
    if (hintEl) hintEl.style.display = 'block';
    window.__setLoadQuizBookLabel(ov, name, true);
    window.__renderLoadQuizCard(ov);
  };
  var sel = localStorage.getItem('core_v4_loadquiz_book') || 'auto';
  var curBook = (typeof currentTextbook !== 'undefined') ? currentTextbook : 'default';
  var useCurrent = (sel === 'auto' || sel === '' || sel === curBook);
  if (useCurrent) {
    var name = '今の単語帳';
    if (typeof textbooksPool !== 'undefined' && textbooksPool) {
      var cb = textbooksPool.find(function(b){ return b.id === curBook; });
      if (cb) name = cb.name;
    }
    setup((typeof vocabList !== 'undefined' ? vocabList : []), curBook, name);
  } else {
    var book = null;
    if (typeof textbooksPool !== 'undefined' && textbooksPool) {
      book = textbooksPool.find(function(b){ return b.id === sel; });
    }
    var bname = book ? book.name : sel;
    window.__getBookMasterWords(sel).then(function(master){
      if (window.__pgLoad.overlay !== ov) return;
      var words = (typeof window.migrateVocabData === 'function') ? window.migrateVocabData((master || []).map(function(w){ return Object.assign({}, w); })) : (master || []);
      setup(words, sel, bname);
    }).catch(function(){
      if (window.__pgLoad.overlay === ov) hideAll();
    });
  }
};

// ------------------------------------------------------------------
// 【5】カード描画（★番号なし・現在の単語を共有状態へ）
// ------------------------------------------------------------------
window.__renderLoadQuizCard = function(ov) {
  var q = window.__loadQuiz;
  if (!q.active || q.words.length === 0) return;
  if (q.index >= q.words.length) {
    q.words = q.words.sort(function(){ return Math.random() - 0.5; });
    q.index = 0;
  }
  var w = q.words[q.index];
  var meaning = (w.meanings && w.meanings[0]) ? w.meanings[0].text : (w.meaning || '');
  var wrap = ov.querySelector('#lqCardWrap');
  if (!wrap) return;
  wrap.className = 'lq-card-wrap';
  wrap.style.display = 'block';
  wrap.style.transform = '';
  wrap.style.opacity = '1';
  wrap.style.transition = '';
  wrap.innerHTML =
    '<div class="lq-card" id="lqCard">' +
      '<div class="lq-face front"><div class="lq-word">' + w.word + '</div></div>' +
      '<div class="lq-face back"><div class="lq-meaning">' + meaning + '</div></div>' +
    '</div>';
  window.__lqCurrent = { word: w, ov: ov };
  window.__bindLoadQuizCardOnce(wrap);
};

// ------------------------------------------------------------------
// 【6】★増殖根絶：枠に“生涯1組だけ”リスナーを貼る（委譲方式）
//     現在の単語は window.__lqCurrent から参照する
// ------------------------------------------------------------------
window.__bindLoadQuizCardOnce = function(wrap) {
  if (!wrap || wrap.dataset.lqBound === '1') return;
  wrap.dataset.lqBound = '1';
  var startX = 0, startY = 0, dragging = false;
  wrap.addEventListener('touchstart', function(e) {
    if (!window.__lqCurrent) return;
    startX = e.touches[0].clientX; startY = e.touches[0].clientY; dragging = true;
    wrap.style.transition = 'none';
  }, { passive: true });
  wrap.addEventListener('touchmove', function(e) {
    if (!dragging || !window.__lqCurrent) return;
    var dx = e.touches[0].clientX - startX;
    var dy = e.touches[0].clientY - startY;
    wrap.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (dx * 0.05) + 'deg)';
    wrap.classList.remove('glow-ok','glow-bad','glow-so');
    if (dy < -15 && Math.abs(dy) > Math.abs(dx)) wrap.classList.add('glow-so');
    else if (dx > 15) wrap.classList.add('glow-ok');
    else if (dx < -15) wrap.classList.add('glow-bad');
  }, { passive: true });
  wrap.addEventListener('touchend', function(e) {
    if (!dragging) return; dragging = false;
    var dx = e.changedTouches[0].clientX - startX;
    var dy = e.changedTouches[0].clientY - startY;
    wrap.classList.remove('glow-ok','glow-bad','glow-so');
    var cur = window.__lqCurrent;
    if (!cur || !cur.word) return;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      wrap.style.transition = 'transform .2s ease';
      wrap.style.transform = '';
      var card = wrap.querySelector('#lqCard');
      if (card) card.classList.toggle('flipped');
    } else if (dx > 60) {
      window.__answerLoadQuiz(cur.ov, wrap, cur.word, 'ok', dx, dy);
    } else if (dx < -60) {
      window.__answerLoadQuiz(cur.ov, wrap, cur.word, 'bad', dx, dy);
    } else if (dy < -60) {
      window.__answerLoadQuiz(cur.ov, wrap, cur.word, 'so', dx, dy);
    } else {
      wrap.style.transition = 'transform .25s ease';
      wrap.style.transform = '';
    }
  });
};

// ------------------------------------------------------------------
// 【7】回答処理（記録B：⚪︎△全部を退避）
// ------------------------------------------------------------------
window.__answerLoadQuiz = function(ov, wrap, w, status, dx, dy) {
  var q = window.__loadQuiz;
  q.answers.push({ num: w.num, word: w.word, status: status });
  if (status === 'ok') q.ok++;
  else if (status === 'bad') q.bad++;
  else if (status === 'so') q.so++;
  window.__lqCurrent = null; // 二重反応を物理的に遮断
  wrap.style.transition = 'transform .35s cubic-bezier(.1,.8,.25,1), opacity .35s ease';
  wrap.style.transform = 'translate(' + (dx * 2.2) + 'px,' + (dy * 2.2 - 40) + 'px) scale(.5) rotate(' + (dx * 0.08) + 'deg)';
  wrap.style.opacity = '0';
  q.index++;
  setTimeout(function() {
    if (window.__pgLoad.overlay === ov) window.__renderLoadQuizCard(ov);
  }, 200);
};

// ------------------------------------------------------------------
// 【8】指定教材のマスター単語取得（キャッシュ→ローカル→Firebase）
// ------------------------------------------------------------------
window.__getBookMasterWords = async function(bookId) {
  var master = null;
  try { if (typeof textbooksCacheMap !== 'undefined' && textbooksCacheMap && textbooksCacheMap[bookId]) master = textbooksCacheMap[bookId]; } catch(e){}
  if (!master) {
    try { var lc = localStorage.getItem('core_v4_cache_' + bookId); if (lc) master = JSON.parse(lc); } catch(e){}
  }
  if (!master && window.db && window.fbGetDoc && window.fbDoc) {
    try {
      var ref = window.fbDoc(window.db, 'shared', 'vocab_' + bookId);
      var snap = await window.fbGetDoc(ref);
      if (snap.exists() && snap.data() && snap.data().custom_words) master = snap.data().custom_words;
    } catch(e){}
  }
  if (!master) master = [];
  if (typeof window.stripVocabProgressFromWords === 'function') master = window.stripVocabProgressFromWords(master);
  return master;
};

// ------------------------------------------------------------------
// 【9】別教材の理解度へ反映して保存（記録B）
// ------------------------------------------------------------------
window.__applyQuizAnswersToBook = async function(bookId, answers) {
  var master = await window.__getBookMasterWords(bookId);
  if (!master || master.length === 0) return 0;
  var words = (typeof window.migrateVocabData === 'function') ? window.migrateVocabData(master.map(function(w){ return Object.assign({}, w); })) : master.map(function(w){ return Object.assign({}, w); });
  var progress = {};
  var pkey = (typeof window.getVocabProgressStorageKey === 'function') ? window.getVocabProgressStorageKey(bookId) : ('core_v4_user_vocab_progress_' + myId + '_' + bookId);
  try { progress = JSON.parse(localStorage.getItem(pkey)) || {}; } catch(e){}
  if (window.db && window.fbGetDoc && window.fbDoc && myId && myId !== 'GUEST-000') {
    try {
      var pref = window.fbDoc(window.db, 'users', myId, 'vocabProgress', bookId);
      var psnap = await window.fbGetDoc(pref);
      if (psnap.exists() && psnap.data() && psnap.data().words) progress = psnap.data().words;
    } catch(e){}
  }
  var sig = (typeof window.buildWordSignature === 'function') ? window.buildWordSignature : function(w){ return String(w.num)+'::'+String(w.word||'').toLowerCase(); };
  words.forEach(function(w){
    var key = String(w.num);
    var p = progress[key];
    w.status = 'none'; w.history = [];
    w.meanings = (w.meanings || []).map(function(m){ return { id:m.id, text:m.text, status:'none', history:[] }; });
    if (p && p.sig === sig(w)) {
      w.status = p.status || 'none';
      w.history = Array.isArray(p.history) ? p.history.slice(-20) : [];
      w.meanings = w.meanings.map(function(m){
        var mp = p.meanings ? p.meanings[m.id] : null;
        if (mp) return { id:m.id, text:m.text, status:mp.status||'none', history:Array.isArray(mp.history)?mp.history.slice(-20):[] };
        return m;
      });
    }
  });
  var applied = 0;
  answers.forEach(function(ans){
    var w = words.find(function(v){ return String(v.num) === String(ans.num); });
    if (w && String(w.word) === String(ans.word)) {
      w.status = ans.status;
      if (w.meanings && w.meanings.length > 0) {
        w.meanings[0].status = ans.status;
        if (!w.meanings[0].history) w.meanings[0].history = [];
        w.meanings[0].history.push(ans.status);
      }
      if (!w.history) w.history = [];
      w.history.push(ans.status);
      applied++;
    }
  });
  if (applied === 0) return 0;
  var newProgress = {};
  words.forEach(function(w){
    var key = String(w.num);
    var wp = { sig: sig(w), status: w.status || 'none', history: Array.isArray(w.history) ? w.history.slice(-20) : [], meanings: {} };
    (w.meanings || []).forEach(function(m){ wp.meanings[m.id] = { status: m.status || 'none', history: Array.isArray(m.history) ? m.history.slice(-20) : [] }; });
    newProgress[key] = wp;
  });
  try { localStorage.setItem(pkey, JSON.stringify(newProgress)); } catch(e){}
  if (window.db && window.fbSetDoc && window.fbDoc && myId && myId !== 'GUEST-000') {
    try {
      var sref = window.fbDoc(window.db, 'users', myId, 'vocabProgress', bookId);
      var payload = { words: newProgress, updatedAt: new Date().toISOString() };
      if (typeof window.fbSetDocWithRetry === 'function') await window.fbSetDocWithRetry(sref, payload);
      else await window.fbSetDoc(sref, payload);
    } catch(e){}
  }
  return applied;
};

// ------------------------------------------------------------------
// 【10】クイズ終了：退避した答えを選んだ単語帳へ反映（記録B）
// ------------------------------------------------------------------
window.__finalizeLoadQuiz = function() {
  var q = window.__loadQuiz;
  if (!q) return;
  var answers = (q.answers || []).slice();
  q.answers = [];
  q.active = false;
  window.__lqCurrent = null;
  if (answers.length > 0) {
    var curBook = (typeof currentTextbook !== 'undefined') ? currentTextbook : 'default';
    var bookId = q.bookId || curBook;
    if (bookId === curBook) {
      var applied = 0;
      answers.forEach(function(ans){
        var w = (typeof vocabList !== 'undefined' ? vocabList : []).find(function(v){ return String(v.num) === String(ans.num); });
        if (w && String(w.word) === String(ans.word)) {
          w.status = ans.status;
          if (w.meanings && w.meanings.length > 0) {
            w.meanings[0].status = ans.status;
            if (!w.meanings[0].history) w.meanings[0].history = [];
            w.meanings[0].history.push(ans.status);
          }
          if (!w.history) w.history = [];
          w.history.push(ans.status);
          applied++;
        }
      });
      if (applied > 0) {
        if (typeof window.scheduleVocabProgressSave === 'function') window.scheduleVocabProgressSave(300);
        if (typeof window.scheduleUserStatsRefresh === 'function') window.scheduleUserStatsRefresh(300);
      }
    } else {
      window.__applyQuizAnswersToBook(bookId, answers);
    }
  }
};

// ------------------------------------------------------------------
// 【11】ロード終了時に答えを確定（二重呼び出し防止ガード付き）
// ------------------------------------------------------------------
var __prevActuallyHidePenguinForQuiz8 = window.__actuallyHidePenguin;
window.__actuallyHidePenguin = function() {
  if (!window.__lqFinalized) {
    window.__lqFinalized = true;
    try { window.__finalizeLoadQuiz(); } catch(e){}
    setTimeout(function(){ window.__lqFinalized = false; }, 50);
  }
  if (typeof __prevActuallyHidePenguinForQuiz8 === 'function') __prevActuallyHidePenguinForQuiz8();
};

// ------------------------------------------------------------------
// 【12】設定画面：出題元の単語帳を選択
// ------------------------------------------------------------------
window.injectLoadQuizSettings = function() {
  var sidebar = document.getElementById('sidebarMenu');
  if (!sidebar) return;
  if (!document.getElementById('loadQuizSettingsSection')) {
    var section = document.createElement('div');
    section.id = 'loadQuizSettingsSection';
    section.style.cssText = "margin:8px 16px;padding:12px;background:rgba(0,240,255,0.06);border:1px solid rgba(0,240,255,0.25);border-radius:10px;box-shadow:0 0 10px rgba(0,240,255,0.1);";
    section.innerHTML =
      '<div style="font-size:11px;font-weight:800;color:var(--cosmic-cyan);margin-bottom:8px;letter-spacing:0.5px;">🎴 ロード画面クイズ設定</div>' +
      '<div style="font-size:10px;color:var(--text-sub);margin-bottom:6px;">出題元の単語帳</div>' +
      '<select id="loadQuizBookSelect" class="search-input" style="width:100%;margin:0;height:36px;"></select>' +
      '<div style="font-size:9px;color:rgba(255,255,255,0.4);margin-top:6px;line-height:1.4;">ロード中の単語クイズが、選んだ単語帳から出題されます。答えはその単語帳の理解度に保存されます。</div>';
    var anchor = null;
    var children = sidebar.children;
    for (var i = 0; i < children.length; i++) {
      if ((children[i].textContent || '').indexOf('ログアウト') !== -1) { anchor = children[i]; break; }
    }
    if (anchor) sidebar.insertBefore(section, anchor);
    else sidebar.appendChild(section);
  }
  window.updateLoadQuizBookSelect();
};

window.updateLoadQuizBookSelect = function() {
  var sel = document.getElementById('loadQuizBookSelect');
  if (!sel) return;
  var current = localStorage.getItem('core_v4_loadquiz_book') || 'auto';
  var html = '<option value="auto">自動（今の単語帳）</option>';
  var pool = (typeof textbooksPool !== 'undefined' && textbooksPool) ? textbooksPool : [];
  pool.forEach(function(b){ html += '<option value="' + b.id + '">' + b.name + '</option>'; });
  sel.innerHTML = html;
  sel.value = current;
  sel.onchange = function() {
    localStorage.setItem('core_v4_loadquiz_book', sel.value);
    if (typeof window.showToast === 'function') window.showToast('🎴 ロードクイズの出題元を設定しました', 'ok');
  };
};

var __prevLoadLocalStateForQuiz8 = window.loadLocalState;
window.loadLocalState = async function() {
  var r = __prevLoadLocalStateForQuiz8 ? await __prevLoadLocalStateForQuiz8.apply(this, arguments) : undefined;
  window.injectLoadQuizSettings();
  return r;
};

(function initPatch8() {
  function boot() { window.injectLoadQuizSettings(); }
  if (document.readyState !== 'loading') { setTimeout(boot, 400); }
  else { document.addEventListener('DOMContentLoaded', function(){ setTimeout(boot, 400); }); }
})();

console.log('🎴 第8回パッチ（ロードクイズ完全版：増殖根絶＋スコアバー削除＋番号削除＋出題元選択＋記録B）適用完了');
// ==========================================================================
// 🗜️ 第9回パッチ：Firestore index entry 上限エラー根絶
//    vocabProgress を JSON 文字列で保存（index entry 数を激減）
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
// ==========================================================================

// ------------------------------------------------------------------
// 【1】saveUserVocabProgress 上書き（wordsJson 形式で保存）
// ------------------------------------------------------------------
window.saveUserVocabProgress = async function() {
  if (typeof window.rebuildVocabStemIndex === "function") window.rebuildVocabStemIndex();
  if (typeof myId === "undefined" || !myId) return;
  var bookKey = (typeof currentTextbook !== 'undefined' && currentTextbook) ? currentTextbook : "default";
  currentUserVocabProgress = window.extractUserProgressFromVocabList();
  
  // ローカル保存（従来通りオブジェクト形式）
  try {
    localStorage.setItem(window.getVocabProgressStorageKey(bookKey), JSON.stringify(currentUserVocabProgress));
  } catch (e) {}
  
  // Firebase保存（JSON文字列化して index entry を激減）
  if (window.db && window.fbSetDoc && window.fbDoc && myId && myId !== "GUEST-000") {
    try {
      var ref = window.fbDoc(window.db, "users", myId, "vocabProgress", bookKey);
      var payload = {
        wordsJson: JSON.stringify(currentUserVocabProgress),
        updatedAt: new Date().toISOString()
      };
      if (typeof window.fbSetDocWithRetry === "function") {
        await window.fbSetDocWithRetry(ref, payload);
      } else {
        await window.fbSetDoc(ref, payload);
      }
    } catch (e) {
      console.error("saveUserVocabProgress Firebase保存エラー（ローカルには保存済み）:", e);
    }
  }
  
  userStats.vocab_fixed = vocabList.filter(function(w) {
    return w.meanings && w.meanings.some(function(m) { return m.status === "ok"; });
  }).length;
};

// ------------------------------------------------------------------
// 【2】loadUserVocabProgress 上書き（新形式 wordsJson 優先、旧形式 words も対応）
// ------------------------------------------------------------------
window.loadUserVocabProgress = async function(bookKey) {
  bookKey = bookKey || (typeof currentTextbook !== 'undefined' ? currentTextbook : "default");
  currentUserVocabProgress = {};
  if (typeof myId === "undefined" || !myId) return;
  
  // ローカルをベースに読み込み
  try {
    var raw = localStorage.getItem(window.getVocabProgressStorageKey(bookKey));
    if (raw) currentUserVocabProgress = JSON.parse(raw) || {};
  } catch (e) {}
  
  if (myId === "GUEST-000" || !window.db || !window.fbGetDoc || !window.fbDoc) return;
  
  // Firebase から読み込み（新形式 wordsJson 優先、旧形式 words も後方互換）
  try {
    var ref = window.fbDoc(window.db, "users", myId, "vocabProgress", bookKey);
    var snap = await window.fbGetDoc(ref);
    if (snap.exists() && snap.data()) {
      var data = snap.data();
      if (data.wordsJson) {
        currentUserVocabProgress = JSON.parse(data.wordsJson);
      } else if (data.words) {
        currentUserVocabProgress = data.words;
      }
    }
  } catch (e) {
    // Firebase 読み込み失敗時はローカルデータで継続
  }
};

// ------------------------------------------------------------------
// 【3】__applyQuizAnswersToBook 上書き（ロードクイズの別教材保存も wordsJson に）
// ------------------------------------------------------------------
window.__applyQuizAnswersToBook = async function(bookId, answers) {
  var master = await window.__getBookMasterWords(bookId);
  if (!master || master.length === 0) return 0;
  var words = (typeof window.migrateVocabData === 'function') ? window.migrateVocabData(master.map(function(w) { return Object.assign({}, w); })) : master.map(function(w) { return Object.assign({}, w); });
  var progress = {};
  var pkey = (typeof window.getVocabProgressStorageKey === 'function') ? window.getVocabProgressStorageKey(bookId) : ('core_v4_user_vocab_progress_' + myId + '_' + bookId);
  try { progress = JSON.parse(localStorage.getItem(pkey)) || {}; } catch (e) {}
  if (window.db && window.fbGetDoc && window.fbDoc && myId && myId !== 'GUEST-000') {
    try {
      var pref = window.fbDoc(window.db, 'users', myId, 'vocabProgress', bookId);
      var psnap = await window.fbGetDoc(pref);
      if (psnap.exists() && psnap.data()) {
        var pdata = psnap.data();
        if (pdata.wordsJson) { progress = JSON.parse(pdata.wordsJson); }
        else if (pdata.words) { progress = pdata.words; }
      }
    } catch (e) {}
  }
  var sig = (typeof window.buildWordSignature === 'function') ? window.buildWordSignature : function(w) { return String(w.num) + '::' + String(w.word || '').toLowerCase(); };
  words.forEach(function(w) {
    var key = String(w.num);
    var p = progress[key];
    w.status = 'none';
    w.history = [];
    w.meanings = (w.meanings || []).map(function(m) { return { id: m.id, text: m.text, status: 'none', history: [] }; });
    if (p && p.sig === sig(w)) {
      w.status = p.status || 'none';
      w.history = Array.isArray(p.history) ? p.history.slice(-20) : [];
      w.meanings = w.meanings.map(function(m) {
        var mp = p.meanings ? p.meanings[m.id] : null;
        if (mp) return { id: m.id, text: m.text, status: mp.status || 'none', history: Array.isArray(mp.history) ? mp.history.slice(-20) : [] };
        return m;
      });
    }
  });
  var applied = 0;
  answers.forEach(function(ans) {
    var w = words.find(function(v) { return String(v.num) === String(ans.num); });
    if (w && String(w.word) === String(ans.word)) {
      w.status = ans.status;
      if (w.meanings && w.meanings.length > 0) {
        w.meanings[0].status = ans.status;
        if (!w.meanings[0].history) w.meanings[0].history = [];
        w.meanings[0].history.push(ans.status);
      }
      if (!w.history) w.history = [];
      w.history.push(ans.status);
      applied++;
    }
  });
  if (applied === 0) return 0;
  var newProgress = {};
  words.forEach(function(w) {
    var key = String(w.num);
    var wp = { sig: sig(w), status: w.status || 'none', history: Array.isArray(w.history) ? w.history.slice(-20) : [], meanings: {} };
    (w.meanings || []).forEach(function(m) { wp.meanings[m.id] = { status: m.status || 'none', history: Array.isArray(m.history) ? m.history.slice(-20) : [] }; });
    newProgress[key] = wp;
  });
  try { localStorage.setItem(pkey, JSON.stringify(newProgress)); } catch (e) {}
  if (window.db && window.fbSetDoc && window.fbDoc && myId && myId !== 'GUEST-000') {
    try {
      var sref = window.fbDoc(window.db, 'users', myId, 'vocabProgress', bookId);
      var payload = { wordsJson: JSON.stringify(newProgress), updatedAt: new Date().toISOString() };
      if (typeof window.fbSetDocWithRetry === 'function') await window.fbSetDocWithRetry(sref, payload);
      else await window.fbSetDoc(sref, payload);
    } catch (e) {}
  }
  return applied;
};

console.log('🗜️ 第9回パッチ（Firestore index entry 上限エラー根絶：wordsJson 形式）適用完了');
// ==========================================================================
// 📚 本棚タブパッチ：スワイプ切替（解析 ⇔ 本棚）＋ 教材本棚システム
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
//    ※index.html / style.css の編集は不要です（DOMを自動で組み替えます）
// ==========================================================================

// ------------------------------------------------------------------
// 【0】パッチ専用スタイルの注入（タブボタン＋スライドアニメーション）
// ------------------------------------------------------------------
(function injectShelfTabPatchCss() {
  if (document.getElementById('shelfTabPatchCss')) return;
  var st = document.createElement('style');
  st.id = 'shelfTabPatchCss';
  st.textContent = [
    '.reader-subtab-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 0;border-radius:10px;font-size:12px;font-weight:900;letter-spacing:1px;cursor:pointer;transition:all 0.25s ease;border:1px solid rgba(255,255,255,0.15);background:rgba(7,11,25,0.6);color:var(--text-sub);-webkit-tap-highlight-color:transparent;}',
    '.reader-subtab-btn.reader-subtab-active{border-color:var(--cosmic-cyan);background:linear-gradient(135deg, rgba(0,240,255,0.25) 0%, rgba(192,132,252,0.25) 100%);color:#FFFFFF;box-shadow:0 0 15px rgba(0,240,255,0.35);text-shadow:0 0 8px rgba(0,240,255,0.5);}',
    '.shelf-book-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);margin-bottom:8px;cursor:pointer;transition:all 0.2s ease;}',
    '.shelf-book-row:active{transform:scale(0.98);border-color:var(--cosmic-cyan);background:rgba(0,240,255,0.08);}',
    '.shelf-item-row{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.05);padding:10px 14px;border-radius:8px;margin-bottom:8px;}',
    '@keyframes shelfSlideInFromRight{0%{opacity:0;transform:translateX(50px);}100%{opacity:1;transform:translateX(0);}}',
    '@keyframes shelfSlideInFromLeft{0%{opacity:0;transform:translateX(-50px);}100%{opacity:1;transform:translateX(0);}}',
    '.shelf-slide-from-right{animation:shelfSlideInFromRight 0.3s cubic-bezier(0.25,1,0.5,1) forwards;}',
    '.shelf-slide-from-left{animation:shelfSlideInFromLeft 0.3s cubic-bezier(0.25,1,0.5,1) forwards;}'
  ].join('\n');
  document.head.appendChild(st);
})();

// ------------------------------------------------------------------
// 【1】本棚教材データ（単語帳の textbooksPool とは完全独立）
// ------------------------------------------------------------------
let bookshelfBooks = [];
try { bookshelfBooks = JSON.parse(localStorage.getItem('core_v4_bookshelf_books') || "[]"); } catch (e) { bookshelfBooks = []; }
let adminUploadedShelfCoverBase64 = "";
let currentShelfView = 'list'; // 'list' or 教材id or 'unclassified'
let currentReaderSubTab = 'analysis'; // 'analysis' or 'bookshelf'

window.syncBookshelfIndexFromFirestore = async function() {
  try {
    var c = localStorage.getItem('core_v4_bookshelf_books');
    if (c) bookshelfBooks = JSON.parse(c) || [];
  } catch (e) {}
  if (window.db && window.fbGetDoc && window.fbDoc) {
    try {
      var ref = window.fbDoc(window.db, "shared", "bookshelf_index");
      var snap = await window.fbGetDoc(ref);
      if (snap.exists() && snap.data().books) {
        bookshelfBooks = snap.data().books;
        localStorage.setItem('core_v4_bookshelf_books', JSON.stringify(bookshelfBooks));
      }
    } catch (e) {
      console.error("本棚教材インデックスの同期エラー:", e);
    }
  }
  window.updateAdminEditShelfSelectOptions();
};

window.saveBookshelfIndexToFirestore = async function() {
  try { localStorage.setItem('core_v4_bookshelf_books', JSON.stringify(bookshelfBooks)); } catch (e) {}
  if (window.db && window.fbSetDoc && window.fbDoc) {
    var ref = window.fbDoc(window.db, "shared", "bookshelf_index");
    await window.fbSetDoc(ref, { books: bookshelfBooks, updatedAt: new Date().toISOString() }, { merge: true });
  }
};

// ------------------------------------------------------------------
// 【2】管理者画面：本棚教材の管理配信パネル（自動注入）
// ------------------------------------------------------------------
window.handleAdminShelfCoverUpload = function(event) {
  var file = event.target.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      var maxDimension = 120;
      var width = img.width, height = img.height;
      if (width > height) {
        if (width > maxDimension) { height = Math.round((height * maxDimension) / width); width = maxDimension; }
      } else {
        if (height > maxDimension) { width = Math.round((width * maxDimension) / height); height = maxDimension; }
      }
      canvas.width = width; canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      adminUploadedShelfCoverBase64 = canvas.toDataURL('image/jpeg', 0.7);
      alert("本棚教材用の表紙画像ファイルを受け付けました！");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
};

window.updateAdminEditShelfSelectOptions = function() {
  var sel = document.getElementById('adminEditShelfSelect');
  if (!sel) return;
  var cur = sel.value;
  sel.innerHTML = '<option value="">➕ 新規教材として登録</option>';
  bookshelfBooks.forEach(function(b) {
    var o = document.createElement('option');
    o.value = b.id;
    o.innerText = b.name;
    sel.appendChild(o);
  });
  sel.value = cur;
};

window.handleAdminShelfEditSelectChange = function(val) {
  var titleInput = document.getElementById('adminNewShelfTitle');
  var submitBtn = document.getElementById('adminShelfSubmitBtn');
  if (!titleInput || !submitBtn) return;
  if (val) {
    var match = bookshelfBooks.find(function(b) { return b.id === val; });
    if (match) titleInput.value = match.name;
    submitBtn.innerText = "選択中の教材データを修正・上書き保存";
  } else {
    titleInput.value = "";
    submitBtn.innerText = "新規教材として登録";
  }
};

window.saveOrUpdateShelfBookFromAdmin = async function() {
  var sel = document.getElementById('adminEditShelfSelect');
  var titleInput = document.getElementById('adminNewShelfTitle');
  if (!sel || !titleInput) return;
  var title = titleInput.value.trim();
  if (!title) return alert("教材の名前を入力してください！");
  var selectedId = sel.value;
  var finalCover = adminUploadedShelfCoverBase64;
  var finalType = "image";
  if (selectedId) {
    var idx = bookshelfBooks.findIndex(function(b) { return b.id === selectedId; });
    if (idx !== -1) {
      bookshelfBooks[idx].name = title;
      if (adminUploadedShelfCoverBase64) {
        bookshelfBooks[idx].cover = finalCover;
        bookshelfBooks[idx].coverType = finalType;
      }
    }
  } else {
    if (!adminUploadedShelfCoverBase64) {
      finalCover = "📚";
      finalType = "text";
    }
    bookshelfBooks.push({ id: "shelfbook_" + Date.now(), name: title, cover: finalCover, coverType: finalType });
  }
  try {
    await window.saveBookshelfIndexToFirestore();
    alert("🎉 本棚教材『" + title + "』を配信・適用完了しました！");
    titleInput.value = "";
    sel.value = "";
    adminUploadedShelfCoverBase64 = "";
    var fi = document.getElementById('adminShelfCoverFileUploader');
    if (fi) fi.value = "";
    window.updateAdminEditShelfSelectOptions();
    window.renderBookshelf();
  } catch (e) {
    alert("Firebaseとの通信に失敗しました。");
  }
};

window.deleteShelfBookFromAdmin = async function() {
  var sel = document.getElementById('adminEditShelfSelect');
  if (!sel) return;
  var selectedId = sel.value;
  if (!selectedId) return alert("削除したい既存の本棚教材をセレクトボックスから選択してください！");
  var target = bookshelfBooks.find(function(b) { return b.id === selectedId; });
  if (!target) return;
  if (!confirm("⚠️ 警告: 本棚教材『" + target.name + "』を削除しますか？\n※保存済みの長文は「未分類」に移動します。")) return;
  bookshelfBooks = bookshelfBooks.filter(function(b) { return b.id !== selectedId; });
  try {
    await window.saveBookshelfIndexToFirestore();
    alert("🎉 指定された本棚教材を削除・同期しました。");
    var titleInput = document.getElementById('adminNewShelfTitle');
    if (titleInput) titleInput.value = "";
    sel.value = "";
    window.updateAdminEditShelfSelectOptions();
    window.renderBookshelf();
  } catch (e) {
    alert("Firebaseとの通信に失敗しました。");
  }
};

window.injectShelfAdminPanel = function() {
  if (document.getElementById('shelfAdminPanelCard')) return;
  var anchor = document.getElementById('adminEditBookSelect');
  if (!anchor) return;
  var card = anchor.closest('.card');
  if (!card || !card.parentNode) return;
  var panel = document.createElement('div');
  panel.id = 'shelfAdminPanelCard';
  panel.className = 'card';
  panel.style.cssText = "border:1px solid rgba(0,240,255,0.35);box-shadow:0 0 15px rgba(0,240,255,0.15);";
  panel.innerHTML =
    '<h2 style="color:var(--cosmic-cyan);">📚 本棚教材の管理配信システム</h2>' +
    '<div style="font-size:11px;color:var(--text-sub);margin-bottom:10px;">リーダータブの「本棚」に表示される教材（表紙付き）を登録します。単語帳の教材とは別の独立システムです。</div>' +
    '<label style="font-size:11px;color:var(--cosmic-cyan);font-weight:700;display:block;margin-bottom:4px;">対象の本棚教材を指定（新規 or 既存編集）</label>' +
    '<select id="adminEditShelfSelect" class="search-input" onchange="window.handleAdminShelfEditSelectChange(this.value)"></select>' +
    '<label style="font-size:11px;color:var(--cosmic-cyan);font-weight:700;display:block;margin-bottom:4px;">教材の名前</label>' +
    '<input type="text" id="adminNewShelfTitle" class="search-input" placeholder="例: 長文問題集 Vol.1">' +
    '<label style="font-size:11px;color:var(--cosmic-cyan);font-weight:700;display:block;margin-bottom:4px;">教材の表紙アイコン画像 (Canvas高圧縮変換)</label>' +
    '<input type="file" id="adminShelfCoverFileUploader" accept="image/*" onchange="window.handleAdminShelfCoverUpload(event)" class="search-input" style="padding:8px 12px;height:auto;">' +
    '<button id="adminShelfSubmitBtn" class="modern-btn" onclick="window.saveOrUpdateShelfBookFromAdmin()">新規教材として登録</button>' +
    '<button class="modern-btn" style="margin-top:8px;background:rgba(239,68,68,0.12);color:#EF4444;border:1px solid #EF4444;" onclick="window.deleteShelfBookFromAdmin()">選択中の教材を削除</button>';
  card.parentNode.insertBefore(panel, card.nextSibling);
  window.updateAdminEditShelfSelectOptions();
};

// ------------------------------------------------------------------
// 【3】保存ポップアップ上書き（フォルダ選択 → 教材選択）
// ------------------------------------------------------------------
window.showCustomSaveBookshelfPrompt = function(text, title) {
  if (document.getElementById('saveBookshelfOverlay')) return;
  var overlay = document.createElement('div');
  overlay.id = 'saveBookshelfOverlay';
  overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);";
  var box = document.createElement('div');
  box.style.cssText = "background:var(--card-bg);border:1px solid var(--cosmic-cyan);border-radius:16px;padding:24px;width:85%;max-width:320px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,0.6);";
  var optionsHtml = '';
  bookshelfBooks.forEach(function(b) {
    optionsHtml += '<option value="' + b.id + '">📖 ' + b.name + '</option>';
  });
  optionsHtml += '<option value="">🗂️ 未分類</option>';
  box.innerHTML =
    '<div style="color:white;font-size:18px;font-weight:800;margin-bottom:12px;">📚 本棚に保存</div>' +
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

// ------------------------------------------------------------------
// 【4】本棚描画上書き（2階層：教材リスト → 長文タイトルリスト）
// ------------------------------------------------------------------
window.renderBookshelf = function() {
  var container = document.getElementById('myBookshelfContainer');
  if (!container) return;
  container.innerHTML = "";
  // 旧フォルダデータ・削除済み教材のデータは「未分類」扱い
  var isOrphan = function(item) {
    return !item.bookId || !bookshelfBooks.some(function(b) { return b.id === item.bookId; });
  };
  // 表示状態のガード
  if (currentShelfView !== 'list' && currentShelfView !== 'unclassified') {
    if (!bookshelfBooks.some(function(b) { return b.id === currentShelfView; })) currentShelfView = 'list';
  }

  // ---------------- 1階層目：教材リスト ----------------
  if (currentShelfView === 'list') {
    if (bookshelfBooks.length === 0 && myBookshelf.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:var(--text-sub);font-size:12px;padding:20px;">本棚は空です。<br>管理者が配信した教材がここに表示されます。</div>';
      return;
    }
    bookshelfBooks.forEach(function(book) {
      var count = myBookshelf.filter(function(i) { return i.bookId === book.id; }).length;
      var row = document.createElement('div');
      row.className = 'shelf-book-row';
      var coverWrap = document.createElement('div');
      coverWrap.style.cssText = "width:42px;height:56px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border-radius:6px;background:linear-gradient(160deg, rgba(0,240,255,0.15), rgba(192,132,252,0.15));border:1px solid rgba(255,255,255,0.25);overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.4);";
      if (book.coverType === 'image' && book.cover) {
        coverWrap.innerHTML = '<img src="' + book.cover + '" style="width:100%;height:100%;object-fit:cover;">';
      } else {
        coverWrap.innerHTML = '<span style="font-size:22px;">' + (book.cover || '📚') + '</span>';
      }
      var nameWrap = document.createElement('div');
      nameWrap.style.cssText = "flex:1;min-width:0;";
      nameWrap.innerHTML = '<div style="font-size:14px;font-weight:800;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + book.name + '</div>' +
        '<div style="font-size:10px;color:var(--text-sub);margin-top:2px;">' + count + ' 本の長文を保存済み</div>';
      var arrow = document.createElement('div');
      arrow.style.cssText = "color:var(--cosmic-cyan);flex-shrink:0;";
      arrow.innerHTML = '<i data-lucide="chevron-right" size="18"></i>';
      row.appendChild(coverWrap);
      row.appendChild(nameWrap);
      row.appendChild(arrow);
      row.onclick = function() { currentShelfView = book.id; window.renderBookshelf(); };
      container.appendChild(row);
    });
    var uncount = myBookshelf.filter(isOrphan).length;
    if (uncount > 0) {
      var urow = document.createElement('div');
      urow.className = 'shelf-book-row';
      urow.innerHTML =
        '<div style="width:42px;height:56px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border-radius:6px;background:rgba(255,255,255,0.06);border:1px dashed rgba(255,255,255,0.3);font-size:22px;">🗂️</div>' +
        '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:800;color:#fff;">未分類</div>' +
        '<div style="font-size:10px;color:var(--text-sub);margin-top:2px;">' + uncount + ' 本の長文を保存済み</div></div>' +
        '<div style="color:var(--cosmic-cyan);flex-shrink:0;"><i data-lucide="chevron-right" size="18"></i></div>';
      urow.onclick = function() { currentShelfView = 'unclassified'; window.renderBookshelf(); };
      container.appendChild(urow);
    }
    window.initLucide();
    return;
  }

  // ---------------- 2階層目：長文タイトルリスト ----------------
  var isUnclassified = (currentShelfView === 'unclassified');
  var book = isUnclassified ? null : bookshelfBooks.find(function(b) { return b.id === currentShelfView; });
  var items = myBookshelf.filter(function(i) {
    return isUnclassified ? isOrphan(i) : (i.bookId === currentShelfView);
  });
  var header = document.createElement('div');
  header.style.cssText = "display:flex;align-items:center;gap:10px;margin-bottom:12px;";
  var backBtn = document.createElement('button');
  backBtn.className = 'list-action-link';
  backBtn.style.cssText = "height:32px;padding:0 10px;font-size:11px;flex-shrink:0;";
  backBtn.innerHTML = '<i data-lucide="arrow-left" size="13" style="vertical-align:middle;margin-right:2px;"></i>戻る';
  backBtn.onclick = function() { currentShelfView = 'list'; window.renderBookshelf(); };
  var titleEl = document.createElement('div');
  titleEl.style.cssText = "flex:1;min-width:0;font-size:15px;font-weight:900;color:var(--cosmic-cyan);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
  titleEl.innerText = isUnclassified ? '🗂️ 未分類' : ('📖 ' + (book ? book.name : ''));
  header.appendChild(backBtn);
  header.appendChild(titleEl);
  container.appendChild(header);
  if (items.length === 0) {
    var empty = document.createElement('div');
    empty.style.cssText = "text-align:center;color:var(--text-sub);font-size:12px;padding:20px;";
    empty.innerText = '保存された長文はありません。';
    container.appendChild(empty);
    window.initLucide();
    return;
  }
  items.forEach(function(item) {
    var row = document.createElement('div');
    row.className = 'shelf-item-row';
    var titleWrap = document.createElement('div');
    titleWrap.style.cssText = "flex:1;min-width:0;font-size:13px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
    titleWrap.innerHTML = '<i data-lucide="file-text" size="12" style="color:var(--text-sub);margin-right:4px;vertical-align:middle;"></i>';
    titleWrap.appendChild(document.createTextNode(item.title || '無題'));
    var openBtn = document.createElement('button');
    openBtn.className = 'list-action-link';
    openBtn.innerText = '開く';
    openBtn.onclick = function() {
      window.switchReaderSubTab('analysis', 'none');
      window.analyzeText(item.text, item.title || '無題', item.aiAnalysisData ? JSON.parse(JSON.stringify(item.aiAnalysisData)) : null);
    };
    var delBtn = document.createElement('button');
    delBtn.className = 'word-delete-btn';
    delBtn.style.cssText = "display:flex !important;background:none;border:none;color:#EF4444;padding:4px;cursor:pointer;";
    delBtn.innerHTML = '<i data-lucide="trash-2" size="14"></i>';
    delBtn.onclick = function(e) {
      e.stopPropagation();
      myBookshelf = myBookshelf.filter(function(b) { return b.id !== item.id; });
      localStorage.setItem('myBookshelf', JSON.stringify(myBookshelf));
      window.renderBookshelf();
    };
    row.appendChild(titleWrap);
    row.appendChild(openBtn);
    row.appendChild(delBtn);
    container.appendChild(row);
  });
  window.initLucide();
};

// ------------------------------------------------------------------
// 【5】リーダータブの構造組み替え＋サブタブボタン（解析 / 本棚）
// ------------------------------------------------------------------
window.initReaderSubTabStructure = function() {
  var view = document.getElementById('view-reader');
  var inputView = document.getElementById('text-input-view');
  if (!view || document.getElementById('readerSubTabBar')) return;
  var analysisCard = null, historyCard = null, shelfCard = null;
  var ta = document.getElementById('englishTextarea');
  if (ta) analysisCard = ta.closest('.card');
  var hl = document.getElementById('historyListContainer');
  if (hl) historyCard = hl.closest('.card');
  var bc = document.getElementById('myBookshelfContainer');
  if (bc) shelfCard = bc.closest('.card');
  if (!analysisCard || !shelfCard) return;
  var host = (inputView && inputView.contains(analysisCard) && inputView.contains(shelfCard)) ? inputView : view;

  // サブタブボタンバー
  var bar = document.createElement('div');
  bar.id = 'readerSubTabBar';
  bar.style.cssText = "display:flex;gap:8px;margin-bottom:14px;";
  var btnA = document.createElement('button');
  btnA.id = 'readerTabBtnAnalysis';
  btnA.className = 'reader-subtab-btn reader-subtab-active';
  btnA.innerHTML = '<i data-lucide="scan-text" size="14"></i> 解析';
  var btnB = document.createElement('button');
  btnB.id = 'readerTabBtnBookshelf';
  btnB.className = 'reader-subtab-btn';
  btnB.innerHTML = '<i data-lucide="library" size="14"></i> 本棚';
  btnA.onclick = function() { window.switchReaderSubTab('analysis', 'left'); };
  btnB.onclick = function() { window.switchReaderSubTab('bookshelf', 'right'); };
  bar.appendChild(btnA);
  bar.appendChild(btnB);
  host.insertBefore(bar, host.firstChild);

  // セクションラップ（解析側：新規解析＋履歴ログ / 本棚側：本棚カード）
  var aSec = document.createElement('div');
  aSec.id = 'readerAnalysisSection';
  var bSec = document.createElement('div');
  bSec.id = 'readerBookshelfSection';
  bSec.style.display = 'none';
  analysisCard.parentNode.insertBefore(aSec, analysisCard);
  aSec.appendChild(analysisCard);
  if (historyCard && historyCard.parentNode) aSec.appendChild(historyCard);
  aSec.parentNode.insertBefore(bSec, aSec.nextSibling);
  if (shelfCard && shelfCard.parentNode) bSec.appendChild(shelfCard);

  // 説明文の「フォルダ」→「教材」更新
  try {
    var walker = document.createTreeWalker(bSec, NodeFilter.SHOW_TEXT, null);
    var n, targets = [];
    while ((n = walker.nextNode())) {
      if (n.nodeValue.indexOf('フォルダ') !== -1) targets.push(n);
    }
    targets.forEach(function(t) { t.nodeValue = t.nodeValue.split('フォルダ').join('教材'); });
  } catch (e) {}
  window.initLucide();
};

window.switchReaderSubTab = function(tabName, animDir) {
  animDir = animDir || 'none';
  var aSec = document.getElementById('readerAnalysisSection');
  var bSec = document.getElementById('readerBookshelfSection');
  var btnA = document.getElementById('readerTabBtnAnalysis');
  var btnB = document.getElementById('readerTabBtnBookshelf');
  if (!aSec || !bSec) return;
  currentReaderSubTab = tabName;
  [aSec, bSec].forEach(function(s) {
    s.style.transition = 'none';
    s.style.transform = 'translateX(0)';
    s.style.opacity = '1';
    s.classList.remove('shelf-slide-from-right', 'shelf-slide-from-left');
    void s.offsetWidth;
  });
  var animClass = animDir === 'right' ? 'shelf-slide-from-right' : (animDir === 'left' ? 'shelf-slide-from-left' : '');
  var setActive = function(btn, on) {
    if (btn) {
      if (on) btn.classList.add('reader-subtab-active');
      else btn.classList.remove('reader-subtab-active');
    }
  };
  if (tabName === 'analysis') {
    aSec.style.display = 'block';
    if (animClass) aSec.classList.add(animClass);
    bSec.style.display = 'none';
    setActive(btnA, true);
    setActive(btnB, false);
  } else {
    aSec.style.display = 'none';
    bSec.style.display = 'block';
    if (animClass) bSec.classList.add(animClass);
    setActive(btnA, false);
    setActive(btnB, true);
    window.renderBookshelf();
  }
};

// ------------------------------------------------------------------
// 【6】スワイプ処理（フレンドタブと同一挙動・リーダー画面表示中は無効）
// ------------------------------------------------------------------
(function initReaderSubTabSwipe() {
  var rStartX = 0, rStartY = 0, rCurrentX = 0, rDragging = false, rIsHorizontal = null;
  function attach() {
    var view = document.getElementById('view-reader');
    if (!view || view.dataset.shelfSwipeBound) return;
    view.dataset.shelfSwipeBound = "true";
    view.addEventListener('touchstart', function(e) {
      if (!document.getElementById('readerSubTabBar')) window.initReaderSubTabStructure();
      var readerView = document.getElementById('text-reader-view');
      if (readerView && readerView.style.display === 'block') { rDragging = false; return; }
      if (e.target.closest('button, select, input, textarea, a, .word-span, .grammar-span')) { rDragging = false; return; }
      rStartX = e.touches[0].clientX;
      rStartY = e.touches[0].clientY;
      rCurrentX = rStartX;
      rDragging = true;
      rIsHorizontal = null;
      var aSec = document.getElementById('readerAnalysisSection');
      var bSec = document.getElementById('readerBookshelfSection');
      if (aSec) aSec.style.transition = 'none';
      if (bSec) bSec.style.transition = 'none';
    }, { passive: true });
    view.addEventListener('touchmove', function(e) {
      if (!rDragging) return;
      rCurrentX = e.touches[0].clientX;
      var diffX = rCurrentX - rStartX;
      var diffY = e.touches[0].clientY - rStartY;
      if (rIsHorizontal === null) {
        if (Math.abs(diffX) > Math.abs(diffY)) rIsHorizontal = true;
        else { rIsHorizontal = false; rDragging = false; return; }
      }
      if (!rIsHorizontal) return;
      var activeSec = document.getElementById(currentReaderSubTab === 'analysis' ? 'readerAnalysisSection' : 'readerBookshelfSection');
      if (!activeSec) return;
      if ((currentReaderSubTab === 'analysis' && diffX < 0) || (currentReaderSubTab === 'bookshelf' && diffX > 0)) diffX = diffX * 0.2;
      activeSec.style.transform = 'translateX(' + diffX + 'px)';
      activeSec.style.opacity = 1 - (Math.abs(diffX) / window.innerWidth) * 1.5;
    }, { passive: true });
    view.addEventListener('touchend', function() {
      if (!rDragging) { rIsHorizontal = null; return; }
      rDragging = false;
      rIsHorizontal = null;
      var diffX = rCurrentX - rStartX;
      var threshold = window.innerWidth * 0.15;
      var activeSec = document.getElementById(currentReaderSubTab === 'analysis' ? 'readerAnalysisSection' : 'readerBookshelfSection');
      if (activeSec) activeSec.style.transition = 'all 0.25s cubic-bezier(0.25, 1, 0.5, 1)';
      if (diffX < -threshold && currentReaderSubTab === 'analysis') {
        if (activeSec) { activeSec.style.transform = 'translateX(-50px)'; activeSec.style.opacity = 0; }
        setTimeout(function() { window.switchReaderSubTab('bookshelf', 'right'); }, 100);
      } else if (diffX > threshold && currentReaderSubTab === 'bookshelf') {
        if (activeSec) { activeSec.style.transform = 'translateX(50px)'; activeSec.style.opacity = 0; }
        setTimeout(function() { window.switchReaderSubTab('analysis', 'left'); }, 100);
      } else {
        if (activeSec) { activeSec.style.transform = 'translateX(0px)'; activeSec.style.opacity = 1; }
      }
    }, { passive: true });
    view.addEventListener('touchcancel', function() {
      rDragging = false;
      rIsHorizontal = null;
    }, { passive: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(attach, 300); });
  } else {
    setTimeout(attach, 300);
  }
})();

// ------------------------------------------------------------------
// 【7】loadLocalState 上書き（教材同期＋構造初期化）
// ------------------------------------------------------------------
var __prevLoadLocalStateForShelfTabPatch = window.loadLocalState;
window.loadLocalState = async function() {
  var r = __prevLoadLocalStateForShelfTabPatch ? await __prevLoadLocalStateForShelfTabPatch.apply(this, arguments) : undefined;
  try {
    window.initReaderSubTabStructure();
    window.injectShelfAdminPanel();
    await window.syncBookshelfIndexFromFirestore();
    window.updateAdminEditShelfSelectOptions();
    window.renderBookshelf();
  } catch (e) {
    console.error("本棚タブパッチ初期化エラー:", e);
  }
  return r;
};

// ------------------------------------------------------------------
// 【8】起動時注入
// ------------------------------------------------------------------
(function initShelfTabPatch() {
  function boot() {
    window.initReaderSubTabStructure();
    window.injectShelfAdminPanel();
    window.syncBookshelfIndexFromFirestore().then(function() {
      window.updateAdminEditShelfSelectOptions();
      window.renderBookshelf();
    }).catch(function() {});
  }
  if (document.readyState !== 'loading') {
    setTimeout(boot, 400);
  } else {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(boot, 400); });
  }
})();
console.log("📚 本棚タブパッチ（スワイプ切替＋教材本棚システム＋管理パネル）適用完了");
// ==========================================================================
// 🔄 同期修正パッチ②：レベルバラバラ＆理解度リセット 根本修正
//    ① saveUserStats：書き込み前にクラウドと照合して「大きい方」を採用
//       → 古い環境がクラウドを引き下げるのを防止（レベルが二度と下がらない）
//    ② loadUserStats：起動時にローカルとクラウドをマージし、
//       ローカルが新しければ即クラウドへ書き戻す → 全環境が最高値に収束
//    ③ vocabProgress：タイムスタンプ方式で「最新のスナップショット」を採用
//       → 古いクラウドデータによる理解度の巻き戻り（リセット）を防止
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
// ==========================================================================

// ------------------------------------------------------------------
// 共通：ユーザー統計の「数値カウンタ」キー一覧（マージ対象）
// ------------------------------------------------------------------
window.__STATS_COUNTER_KEYS = [
    'test_count', 'combo_max', 'multi_win', 'high_score', 'mistake_count',
    'vocab_reg', 'vocab_fixed', 'delete_count', 'study_burst', 'reader_open',
    'flash_count', 'friends_count', 'user_level', 'gold_spent', 'study_total_secs'
];

// ------------------------------------------------------------------
// 【A】saveUserStats 上書き：書き込み前にクラウドの値で引き上げる
//     （8秒スロットル付きでクラウドを参照し、古い値での巻き戻りを防止）
// ------------------------------------------------------------------
window.__statsCloudMergeAllowed = function() {
    const now = Date.now();
    if (!window.__statsMergeCache || window.__statsMergeCache.id !== myId) {
        window.__statsMergeCache = { id: myId, at: 0 };
    }
    if (now - window.__statsMergeCache.at < 8000) return false;
    window.__statsMergeCache.at = now;
    return true;
};

window.__statsMergeCloudFloor = async function() {
    if (!window.db || !window.fbGetDoc || !window.fbDoc || !myId || myId === "GUEST-000") return;
    if (!window.__statsCloudMergeAllowed()) return;
    try {
        const ref = window.fbDoc(window.db, "users", myId);
        const snap = await window.fbGetDoc(ref);
        if (snap.exists()) {
            const d = snap.data() || {};
            const cloudExp = parseInt(d.totalExp) || 0;
            if (cloudExp > totalExp) {
                totalExp = cloudExp;
                try { localStorage.setItem('core_v4_totalExp', String(totalExp)); } catch (e) {}
            }
            if (d.userStats && typeof d.userStats === 'object') {
                window.__STATS_COUNTER_KEYS.forEach(function(k) {
                    const cv = parseInt(d.userStats[k]) || 0;
                    const lv = parseInt(userStats[k]) || 0;
                    if (cv > lv) userStats[k] = cv;
                });
            }
            try { userStats.user_level = window.computeLevelSafe(totalExp); } catch (e) {}
        }
    } catch (e) {
        console.error("stats cloud floor merge error:", e);
    }
};

window.saveUserStats = async function() {
    // 保存前に totalExp からレベルを再計算
    try { userStats.user_level = window.calculateLevelFromExp(totalExp).level; } catch (e) {}
    // ★ クラウドの値で引き上げてから保存（巻き戻り防止）
    try { await window.__statsMergeCloudFloor(); } catch (e) {}
    try { userStats.user_level = window.calculateLevelFromExp(totalExp).level; } catch (e) {}
    // ローカル保存
    try {
        localStorage.setItem('core_v4_user_stats_' + myId, JSON.stringify(userStats));
        localStorage.setItem('core_v4_friend_list', JSON.stringify(myFriendList));
        localStorage.setItem('core_v4_totalExp', String(totalExp));
        localStorage.setItem('core_v4_userName', myName);
        localStorage.setItem('core_v4_userTarget', myTarget);
        localStorage.setItem('core_v4_userTitle', selectedTitle);
    } catch (e) {}
    // Firebase保存
    if (window.db && window.fbSetDoc && window.fbDoc && myId && myId !== "GUEST-000") {
        try {
            const userRef = window.fbDoc(window.db, "users", myId);
            const mySavedAvatar = localStorage.getItem('core_v4_user_avatar_' + myId) || "";
            const lvlData = window.calculateLevelFromExp(totalExp);
            await window.fbSetDocWithRetry(userRef, {
                id: myId,
                userStats: userStats,
                friendList: myFriendList,
                playerName: myName,
                selectedTitle: selectedTitle,
                userTarget: myTarget,
                totalExp: totalExp,
                avatar: mySavedAvatar,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            const lbRef = window.fbDoc(window.db, "shared_leaderboard", myId);
            await window.fbSetDocWithRetry(lbRef, {
                id: myId,
                name: myName,
                title: selectedTitle,
                exp: totalExp,
                level: lvlData.level,
                avatar: mySavedAvatar,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            if (typeof window.syncMyEntryToAllUsers === 'function') window.syncMyEntryToAllUsers(false);
        } catch (e) {
            console.error("Firebaseユーザーデータ保存エラー（リトライ後）:", e);
        }
    }
};

// ------------------------------------------------------------------
// 【B】loadUserStats 上書き：マージ＋クラウドへの書き戻し（全環境収束）
// ------------------------------------------------------------------
window.loadUserStats = async function() {
    let needWriteBack = false;
    try {
        const storedStats = localStorage.getItem('core_v4_user_stats_' + myId);
        if (storedStats) userStats = JSON.parse(storedStats);
        const storedFriends = localStorage.getItem('core_v4_friend_list');
        if (storedFriends) myFriendList = JSON.parse(storedFriends);
        if (window.db && window.fbGetDoc && window.fbDoc && myId && myId !== "GUEST-000") {
            const userRef = window.fbDoc(window.db, "users", myId);
            const snap = await window.fbGetDoc(userRef);
            if (snap.exists()) {
                const data = snap.data();
                if (data.userStats) {
                    // ★ カウンタは「ローカルとクラウドの大きい方」を採用
                    const merged = data.userStats;
                    window.__STATS_COUNTER_KEYS.forEach(function(k) {
                        const cv = parseInt(merged[k]) || 0;
                        const lv = parseInt(userStats[k]) || 0;
                        if (lv > cv) needWriteBack = true;
                        merged[k] = Math.max(cv, lv);
                    });
                    if (!merged.goal_text && userStats.goal_text) {
                        merged.goal_text = userStats.goal_text;
                        needWriteBack = true;
                    }
                    if (userStats.weekly_rank_first === true && merged.weekly_rank_first !== true) {
                        merged.weekly_rank_first = true;
                        needWriteBack = true;
                    }
                    // シーズン称号・確定済みシーズンの統合（消えないように）
                    ['seasonTitles', 'settledSeasons'].forEach(function(arrKey) {
                        const cloudArr = Array.isArray(merged[arrKey]) ? merged[arrKey] : [];
                        const localArr = Array.isArray(userStats[arrKey]) ? userStats[arrKey] : [];
                        const union = cloudArr.slice();
                        localArr.forEach(function(item) {
                            if (union.indexOf(item) === -1) { union.push(item); needWriteBack = true; }
                        });
                        merged[arrKey] = union;
                    });
                    userStats = merged;
                    localStorage.setItem('core_v4_user_stats_' + myId, JSON.stringify(userStats));
                }
                if (data.friendList) {
                    myFriendList = data.friendList;
                    localStorage.setItem('core_v4_friend_list', JSON.stringify(myFriendList));
                }
                // ★ totalExp は大きい方を採用
                if (data.totalExp !== undefined && data.totalExp !== null) {
                    const cloudExp = parseInt(data.totalExp) || 0;
                    const localExp = totalExp || 0;
                    totalExp = Math.max(cloudExp, localExp);
                    if (localExp > cloudExp) needWriteBack = true;
                    localStorage.setItem('core_v4_totalExp', String(totalExp));
                }
                if (data.playerName) { myName = data.playerName; localStorage.setItem('core_v4_userName', myName); }
                if (data.selectedTitle) { selectedTitle = data.selectedTitle; localStorage.setItem('core_v4_userTitle', selectedTitle); }
                if (data.userTarget) { myTarget = data.userTarget; localStorage.setItem('core_v4_userTarget', myTarget); }
                if (data.avatar) { localStorage.setItem('core_v4_user_avatar_' + myId, data.avatar); }
                userStats.user_level = window.computeLevelSafe(totalExp);
            }
        }
    } catch (e) {
        console.error("Error loading user stats:", e);
    }
    // ★ 書き戻し：ローカルの方が新しい/多い場合、クラウドに反映して全環境を収束させる
    if (needWriteBack) {
        try { window.saveUserStats(); } catch (e) {}
    }
};

// ------------------------------------------------------------------
// 【C】理解度（vocabProgress）のローカルスナップショット読み書きヘルパー
//     ※本体データは従来どおりの形式で保存し、タイムスタンプだけ別キーに保存
//       （ロードクイズの別教材保存処理との互換性を保つため）
// ------------------------------------------------------------------
window.__readLocalVocabSnapshot = function(bookKey) {
    let words = {};
    let ts = 0;
    try {
        const raw = localStorage.getItem(window.getVocabProgressStorageKey(bookKey));
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') words = parsed;
        }
    } catch (e) {}
    try {
        const t = localStorage.getItem(window.getVocabProgressStorageKey(bookKey) + '__ts');
        if (t) ts = parseInt(t) || 0;
    } catch (e) {}
    return { words: words, updatedAt: ts };
};

window.__writeLocalVocabSnapshot = function(bookKey, words, ms) {
    try { localStorage.setItem(window.getVocabProgressStorageKey(bookKey), JSON.stringify(words)); } catch (e) {}
    try { localStorage.setItem(window.getVocabProgressStorageKey(bookKey) + '__ts', String(ms)); } catch (e) {}
};

// ------------------------------------------------------------------
// 【D】loadUserVocabProgress 上書き：タイムスタンプで「最新」を採用
//     （古いクラウドによる理解度の巻き戻りを防止＋クラウドへ書き戻し）
// ------------------------------------------------------------------
window.loadUserVocabProgress = async function(bookKey) {
    bookKey = bookKey || (typeof currentTextbook !== 'undefined' ? currentTextbook : "default");
    currentUserVocabProgress = {};
    if (typeof myId === "undefined" || !myId) return;
    const localSnap = window.__readLocalVocabSnapshot(bookKey);
    let bestWords = localSnap.words || {};
    let bestMs = localSnap.updatedAt || 0;
    let localIsNewest = true;
    let cloudExisted = false;
    if (myId !== "GUEST-000" && window.db && window.fbGetDoc && window.fbDoc) {
        try {
            const ref = window.fbDoc(window.db, "users", myId, "vocabProgress", bookKey);
            const snap = await window.fbGetDoc(ref);
            if (snap.exists() && snap.data()) {
                cloudExisted = true;
                const data = snap.data();
                let cloudWords = null;
                if (data.wordsJson) {
                    try { cloudWords = JSON.parse(data.wordsJson); } catch (e) { cloudWords = null; }
                } else if (data.words) {
                    cloudWords = data.words;
                }
                if (cloudWords && typeof cloudWords === 'object') {
                    const cloudMs = data.updatedAt ? (new Date(data.updatedAt).getTime() || 0) : 0;
                    if (cloudMs >= bestMs) {
                        bestWords = cloudWords;
                        bestMs = cloudMs;
                        localIsNewest = false;
                    }
                }
            }
        } catch (e) {
            console.error("loadUserVocabProgress Firebase読み込みエラー（ローカルデータで継続）:", e);
        }
    }
    currentUserVocabProgress = bestWords || {};
    // 採用したスナップショットでローカルキャッシュを揃える
    window.__writeLocalVocabSnapshot(bookKey, currentUserVocabProgress, bestMs);
    // ★ 書き戻し：ローカルが新しい（またはクラウドが空）ならクラウドへ反映
    const hasData = currentUserVocabProgress && Object.keys(currentUserVocabProgress).length > 0;
    if (hasData && (localIsNewest || !cloudExisted) && myId !== "GUEST-000" && window.db && window.fbSetDoc && window.fbDoc) {
        try {
            const wref = window.fbDoc(window.db, "users", myId, "vocabProgress", bookKey);
            const wpayload = { wordsJson: JSON.stringify(currentUserVocabProgress), updatedAt: new Date().toISOString() };
            if (typeof window.fbSetDocWithRetry === "function") window.fbSetDocWithRetry(wref, wpayload);
            else window.fbSetDoc(wref, wpayload);
        } catch (e) {}
    }
};

// ------------------------------------------------------------------
// 【E】saveUserVocabProgress 上書き：タイムスタンプ付きで保存
// ------------------------------------------------------------------
window.saveUserVocabProgress = async function() {
    if (typeof window.rebuildVocabStemIndex === "function") window.rebuildVocabStemIndex();
    if (typeof myId === "undefined" || !myId) return;
    const bookKey = (typeof currentTextbook !== 'undefined' && currentTextbook) ? currentTextbook : "default";
    currentUserVocabProgress = window.extractUserProgressFromVocabList();
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    // ローカル保存（タイムスタンプ付き）
    window.__writeLocalVocabSnapshot(bookKey, currentUserVocabProgress, nowMs);
    // Firebase保存
    if (window.db && window.fbSetDoc && window.fbDoc && myId && myId !== "GUEST-000") {
        try {
            const ref = window.fbDoc(window.db, "users", myId, "vocabProgress", bookKey);
            const payload = { wordsJson: JSON.stringify(currentUserVocabProgress), updatedAt: nowIso };
            if (typeof window.fbSetDocWithRetry === "function") await window.fbSetDocWithRetry(ref, payload);
            else await window.fbSetDoc(ref, payload);
        } catch (e) {
            console.error("saveUserVocabProgress Firebase保存エラー（ローカルには保存済み）:", e);
        }
    }
    userStats.vocab_fixed = vocabList.filter(function(w) {
        return w.meanings && w.meanings.some(function(m) { return m.status === "ok"; });
    }).length;
};

console.log("🔄 同期修正パッチ②（レベル収束＋理解度リセット防止＋書き戻し）適用完了");
// ==========================================================================
// 🔄 同期修正パッチ③：設定まるごと同期 ＋ 表示強化
//    【個人ごと同期】APIキー／ロード時単語帳／パーティ編成／選択中教材／
//                    称号解除進捗（XP二重付与根絶）／リーダー単語メモリ
//    【全員で共有】  ダッシュボードタイトル／配信アナウンス
//    【表示強化】    フレンドログイン履歴を分単位まで／自分の総勉強時間
//    【保護】        totalExp・総勉強時間の巻き戻り防止／理解度リセット防止
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
// ==========================================================================

// ------------------------------------------------------------------
// 【A】全員共有設定（ダッシュボードタイトル／配信アナウンス）
// ------------------------------------------------------------------
window.__loadGlobalSettings = async function() {
    if (!window.db || !window.fbGetDoc || !window.fbDoc) return;
    try {
        var ref = window.fbDoc(window.db, "shared", "app_settings");
        var snap = await window.fbGetDoc(ref);
        if (snap.exists() && snap.data()) {
            var d = snap.data();
            if (typeof d.dashboardTitle === "string" && d.dashboardTitle !== "") {
                localStorage.setItem('core_v4_dashboard_title', d.dashboardTitle);
                var el = document.getElementById('headerTitleText');
                if (el) el.innerText = d.dashboardTitle;
            }
            if (typeof d.adminNotice === "string") {
                localStorage.setItem('core_v4_admin_notice', d.adminNotice);
                var frame = document.getElementById('adminNoticeDisplayFrame');
                var body = document.getElementById('adminNoticeTextContent');
                if (frame && body) {
                    if (d.adminNotice.trim() !== "") { body.innerText = d.adminNotice; frame.style.display = 'block'; }
                    else { frame.style.display = 'none'; }
                }
            }
        }
    } catch (e) {
        console.error("global settings load error:", e);
    }
};

window.__pushGlobalSettings = async function() {
    if (!window.db || !window.fbSetDoc || !window.fbDoc) return;
    try {
        var title = localStorage.getItem('core_v4_dashboard_title') || "ダッシュボード";
        var notice = localStorage.getItem('core_v4_admin_notice') || "";
        var ref = window.fbDoc(window.db, "shared", "app_settings");
        var payload = { dashboardTitle: title, adminNotice: notice, updatedAt: new Date().toISOString() };
        var safe = window.__sanitizeForFirestore ? window.__sanitizeForFirestore(payload) : payload;
        if (typeof window.fbSetDocWithRetry === "function") await window.fbSetDocWithRetry(ref, safe, { merge: true });
        else await window.fbSetDoc(ref, safe, { merge: true });
    } catch (e) {
        console.error("global settings push error:", e);
    }
};

// 管理者がタイトル／アナウンスを変えたら全員共有へ即反映
var __prevSaveAdminDashboardTitleForSync3 = window.saveAdminDashboardTitle;
window.saveAdminDashboardTitle = async function() {
    var r = __prevSaveAdminDashboardTitleForSync3 ? __prevSaveAdminDashboardTitleForSync3.apply(this, arguments) : undefined;
    try { await window.__pushGlobalSettings(); } catch (e) {}
    return r;
};
var __prevSaveAdminSystemSettingsForSync3 = window.saveAdminSystemSettings;
window.saveAdminSystemSettings = async function() {
    var r = __prevSaveAdminSystemSettingsForSync3 ? __prevSaveAdminSystemSettingsForSync3.apply(this, arguments) : undefined;
    try { await window.__pushGlobalSettings(); } catch (e) {}
    return r;
};
var __prevSaveSidebarProfileForSync3 = window.saveSidebarProfile;
window.saveSidebarProfile = async function() {
    var r = __prevSaveSidebarProfileForSync3 ? await __prevSaveSidebarProfileForSync3.apply(this, arguments) : undefined;
    try { await window.__pushGlobalSettings(); } catch (e) {}
    return r;
};

// ------------------------------------------------------------------
// 【B】個人ごとの設定まとまり（収集／マージ／適用／保存）
// ------------------------------------------------------------------
window.__collectLocalSettings = function() {
    var wm = {};
    try {
        wm = (typeof wordMemory !== "undefined" && wordMemory) ? wordMemory : (JSON.parse(localStorage.getItem('wordMemory') || "{}"));
    } catch (e) {}
    var tc = {};
    try {
        tc = (typeof rewardedTitlesStepsCache !== "undefined" && rewardedTitlesStepsCache) ? rewardedTitlesStepsCache : (JSON.parse(localStorage.getItem('core_v4_rewarded_titles_cache') || "{}"));
    } catch (e) {}
    return {
        geminiKey: localStorage.getItem('core_v4_geminiKey') || "",
        loadQuizBook: localStorage.getItem('core_v4_loadquiz_book') || "auto",
        activeChar: localStorage.getItem('core_v4_active_char') || "",
        activeWeapon: localStorage.getItem('core_v4_active_weapon') || "",
        activeArmor: localStorage.getItem('core_v4_active_armor') || "",
        currentTextbook: localStorage.getItem('core_v4_current_textbook_id') || "",
        wordMemory: wm,
        titlesCache: tc
    };
};

window.__mergeSettings = function(local, cloud, localIsNewer) {
    var merged = {};
    var scalarKeys = ['geminiKey', 'loadQuizBook', 'activeChar', 'activeWeapon', 'activeArmor', 'currentTextbook'];
    var src = localIsNewer ? local : cloud;   // 新しい方のスナップショットを優先
    var alt = localIsNewer ? cloud : local;   // 空欄はもう一方で補完
    scalarKeys.forEach(function(k) {
        merged[k] = (src[k] !== undefined && src[k] !== "") ? src[k] : (alt[k] || "");
    });
    // 単語メモリ：合体（進捗が深い方を採用。ok > so > bad > none）
    var rank = { 'ok': 3, 'so': 2, 'bad': 1, 'none': 0 };
    merged.wordMemory = {};
    var wKeys = {};
    Object.keys(local.wordMemory || {}).forEach(function(k) { wKeys[k] = true; });
    Object.keys(cloud.wordMemory || {}).forEach(function(k) { wKeys[k] = true; });
    Object.keys(wKeys).forEach(function(k) {
        var lv = (local.wordMemory || {})[k];
        var cv = (cloud.wordMemory || {})[k];
        var lr = (lv && rank[lv] !== undefined) ? rank[lv] : -1;
        var cr = (cv && rank[cv] !== undefined) ? rank[cv] : -1;
        merged.wordMemory[k] = (lr >= cr) ? lv : cv;
    });
    // 称号解除進捗：各称号の「より高い段階」を採用（XP二重付与を根絶）
    merged.titlesCache = {};
    var tKeys = {};
    Object.keys(local.titlesCache || {}).forEach(function(k) { tKeys[k] = true; });
    Object.keys(cloud.titlesCache || {}).forEach(function(k) { tKeys[k] = true; });
    Object.keys(tKeys).forEach(function(k) {
        var lv = parseInt((local.titlesCache || {})[k]) || 0;
        var cv = parseInt((cloud.titlesCache || {})[k]) || 0;
        merged.titlesCache[k] = Math.max(lv, cv);
    });
    return merged;
};

window.__applySettingsToLocal = function(s) {
    var changedTextbook = false;
    try {
        if (typeof s.geminiKey === "string") {
            localStorage.setItem('core_v4_geminiKey', s.geminiKey);
            geminiApiKey = s.geminiKey;
            var aki = document.getElementById('sidebarApiKeyInput');
            if (aki) aki.value = s.geminiKey;
        }
        if (typeof s.loadQuizBook === "string") localStorage.setItem('core_v4_loadquiz_book', s.loadQuizBook || "auto");
        if (typeof s.activeChar === "string") { localStorage.setItem('core_v4_active_char', s.activeChar); activeCharacter = s.activeChar; }
        if (typeof s.activeWeapon === "string") { localStorage.setItem('core_v4_active_weapon', s.activeWeapon); activeWeapon = s.activeWeapon; }
        if (typeof s.activeArmor === "string") { localStorage.setItem('core_v4_active_armor', s.activeArmor); activeArmor = s.activeArmor; }
        if (typeof s.currentTextbook === "string" && s.currentTextbook !== "") {
            if (currentTextbook !== s.currentTextbook) changedTextbook = true;
            localStorage.setItem('core_v4_current_textbook_id', s.currentTextbook);
            currentTextbook = s.currentTextbook;
        }
        if (s.wordMemory && typeof s.wordMemory === "object") {
            wordMemory = s.wordMemory;
            try { localStorage.setItem('wordMemory', JSON.stringify(wordMemory)); } catch (e) {}
            if (typeof window.updateReaderWordColors === "function") { try { window.updateReaderWordColors(); } catch (e) {} }
        }
        if (s.titlesCache && typeof s.titlesCache === "object") {
            rewardedTitlesStepsCache = s.titlesCache;
            try { localStorage.setItem('core_v4_rewarded_titles_cache', JSON.stringify(rewardedTitlesStepsCache)); } catch (e) {}
        }
        if (typeof window.updatePartySlotsUi === "function") { try { window.updatePartySlotsUi(); } catch (e) {} }
    } catch (e) {
        console.error("applySettingsToLocal error:", e);
    }
    return changedTextbook;
};

window.__saveUserSettings = async function(settings) {
    if (typeof myId === "undefined" || !myId || myId === "GUEST-000") return;
    var s = settings || window.__collectLocalSettings();
    var nowMs = Date.now();
    var nowIso = new Date(nowMs).toISOString();
    try { localStorage.setItem('core_v4_sync_settings_ts_' + myId, String(nowMs)); } catch (e) {}
    window.__lastSavedSettingsJson = JSON.stringify(s);
    if (window.db && window.fbSetDoc && window.fbDoc) {
        try {
            var ref = window.fbDoc(window.db, "users", myId, "sync", "settings");
            var payload = { settingsJson: JSON.stringify(s), updatedAt: nowIso };
            var safe = window.__sanitizeForFirestore ? window.__sanitizeForFirestore(payload) : payload;
            if (typeof window.fbSetDocWithRetry === "function") await window.fbSetDocWithRetry(ref, safe);
            else await window.fbSetDoc(ref, safe);
        } catch (e) {
            console.error("saveUserSettings cloud write error:", e);
        }
    }
};

window.__loadUserSettings = async function() {
    if (typeof myId === "undefined" || !myId || myId === "GUEST-000") return;
    window.__lastSavedSettingsJson = null;   // ログイン直後の誤保存を防ぐ
    var local = window.__collectLocalSettings();
    var localTs = parseInt(localStorage.getItem('core_v4_sync_settings_ts_' + myId) || "0");
    var cloud = null;
    var cloudTs = 0;
    if (window.db && window.fbGetDoc && window.fbDoc) {
        try {
            var ref = window.fbDoc(window.db, "users", myId, "sync", "settings");
            var snap = await window.fbGetDoc(ref);
            if (snap.exists() && snap.data() && snap.data().settingsJson) {
                cloud = JSON.parse(snap.data().settingsJson);
                cloudTs = snap.data().updatedAt ? (new Date(snap.data().updatedAt).getTime() || 0) : 0;
            }
        } catch (e) {
            console.error("loadUserSettings cloud read error:", e);
        }
    }
    if (!cloud) {
        // クラウドにまだ無い → ローカルを初回アップロード
        try { await window.__saveUserSettings(local); } catch (e) {}
        return;
    }
    var localIsNewer = localTs >= cloudTs;
    var merged = window.__mergeSettings(local, cloud, localIsNewer);
    var changedTextbook = window.__applySettingsToLocal(merged);
    try { await window.__saveUserSettings(merged); } catch (e) {}
    if (changedTextbook && typeof window.loadCurrentTextbookData === "function") {
        try { window.loadCurrentTextbookData(); } catch (e) {}
    }
};

// ------------------------------------------------------------------
// 【C】変更の自動検知（20秒ごと＋画面を閉じる時）→ クラウドへ保存
// ------------------------------------------------------------------
window.__startSettingsSyncLoop = function() {
    if (window.__settingsSyncLoopStarted) return;
    window.__settingsSyncLoopStarted = true;
    setInterval(function() {
        if (typeof myId === "undefined" || !myId || myId === "GUEST-000") return;
        if (window.__lastSavedSettingsJson === null) return;
        try {
            var cur = JSON.stringify(window.__collectLocalSettings());
            if (cur !== window.__lastSavedSettingsJson) window.__saveUserSettings();
        } catch (e) {}
    }, 20000);
    var flush = function() {
        if (typeof myId === "undefined" || !myId || myId === "GUEST-000") return;
        if (window.__lastSavedSettingsJson === null) return;
        try {
            var cur = JSON.stringify(window.__collectLocalSettings());
            if (cur !== window.__lastSavedSettingsJson) window.__saveUserSettings();
        } catch (e) {}
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'hidden') flush(); });
};

// ------------------------------------------------------------------
// 【D】loadUserStats 保護：totalExp と総勉強時間が「減る」のを防ぐ
// ------------------------------------------------------------------
var __prevLoadUserStatsForSync3 = window.loadUserStats;
window.loadUserStats = async function() {
    var localExpBefore = parseInt(localStorage.getItem('core_v4_totalExp') || "0");
    var localStudyBefore = parseInt(localStorage.getItem('core_v4_study_total_secs') || "0");
    var r = __prevLoadUserStatsForSync3 ? await __prevLoadUserStatsForSync3.apply(this, arguments) : undefined;
    try {
        var needWriteBack = false;
        if (localExpBefore > totalExp) { totalExp = localExpBefore; needWriteBack = true; }
        if (localStudyBefore > (userStats.study_total_secs || 0)) { userStats.study_total_secs = localStudyBefore; needWriteBack = true; }
        try { localStorage.setItem('core_v4_totalExp', String(totalExp)); } catch (e) {}
        if (typeof window.computeLevelSafe === "function") userStats.user_level = window.computeLevelSafe(totalExp);
        else userStats.user_level = window.calculateLevelFromExp(totalExp).level;
        if (needWriteBack && myId && myId !== "GUEST-000") { try { window.saveUserStats(); } catch (e) {} }
    } catch (e) {
        console.error("loadUserStats sync3 protection error:", e);
    }
    return r;
};

// ------------------------------------------------------------------
// 【E】理解度リセット防止：タイムスタンプで「新しい方」を採用
// ------------------------------------------------------------------
window.saveUserVocabProgress = async function() {
    if (typeof window.rebuildVocabStemIndex === "function") window.rebuildVocabStemIndex();
    if (typeof myId === "undefined" || !myId) return;
    var bookKey = (typeof currentTextbook !== "undefined" && currentTextbook) ? currentTextbook : "default";
    currentUserVocabProgress = window.extractUserProgressFromVocabList();
    var nowMs = Date.now();
    var nowIso = new Date(nowMs).toISOString();
    try {
        localStorage.setItem(window.getVocabProgressStorageKey(bookKey), JSON.stringify(currentUserVocabProgress));
        localStorage.setItem(window.getVocabProgressStorageKey(bookKey) + "__ts", String(nowMs));
    } catch (e) {}
    if (window.db && window.fbSetDoc && window.fbDoc && myId && myId !== "GUEST-000") {
        try {
            var ref = window.fbDoc(window.db, "users", myId, "vocabProgress", bookKey);
            var payload = { wordsJson: JSON.stringify(currentUserVocabProgress), updatedAt: nowIso };
            var safe = window.__sanitizeForFirestore ? window.__sanitizeForFirestore(payload) : payload;
            if (typeof window.fbSetDocWithRetry === "function") await window.fbSetDocWithRetry(ref, safe);
            else await window.fbSetDoc(ref, safe);
        } catch (e) {
            console.error("saveUserVocabProgress error:", e);
        }
    }
    userStats.vocab_fixed = vocabList.filter(function(w) {
        return w.meanings && w.meanings.some(function(m) { return m.status === "ok"; });
    }).length;
};

window.loadUserVocabProgress = async function(bookKey) {
    bookKey = bookKey || (typeof currentTextbook !== "undefined" ? currentTextbook : "default");
    currentUserVocabProgress = {};
    if (typeof myId === "undefined" || !myId) return;
    var localTs = 0;
    try {
        var raw = localStorage.getItem(window.getVocabProgressStorageKey(bookKey));
        if (raw) currentUserVocabProgress = JSON.parse(raw) || {};
        localTs = parseInt(localStorage.getItem(window.getVocabProgressStorageKey(bookKey) + "__ts") || "0");
    } catch (e) {}
    if (myId === "GUEST-000" || !window.db || !window.fbGetDoc || !window.fbDoc) return;
    try {
        var ref = window.fbDoc(window.db, "users", myId, "vocabProgress", bookKey);
        var snap = await window.fbGetDoc(ref);
        if (snap.exists() && snap.data()) {
            var data = snap.data();
            var cloudProgress = null;
            if (data.wordsJson) { try { cloudProgress = JSON.parse(data.wordsJson); } catch (e) { cloudProgress = null; } }
            else if (data.words) cloudProgress = data.words;
            var cloudTs = data.updatedAt ? (new Date(data.updatedAt).getTime() || 0) : 0;
            if (cloudProgress && typeof cloudProgress === "object") {
                if (cloudTs >= localTs) {
                    // クラウドが新しい → 採用
                    currentUserVocabProgress = cloudProgress;
                    try {
                        localStorage.setItem(window.getVocabProgressStorageKey(bookKey), JSON.stringify(cloudProgress));
                        localStorage.setItem(window.getVocabProgressStorageKey(bookKey) + "__ts", String(cloudTs));
                    } catch (e) {}
                } else {
                    // ローカルが新しい → 維持してクラウドへ書き戻し
                    try {
                        var wref = window.fbDoc(window.db, "users", myId, "vocabProgress", bookKey);
                        var wpayload = { wordsJson: JSON.stringify(currentUserVocabProgress), updatedAt: new Date().toISOString() };
                        var wsafe = window.__sanitizeForFirestore ? window.__sanitizeForFirestore(wpayload) : wpayload;
                        if (typeof window.fbSetDocWithRetry === "function") window.fbSetDocWithRetry(wref, wsafe);
                        else window.fbSetDoc(wref, wsafe);
                    } catch (e) {}
                }
            }
        }
    } catch (e) {
        console.error("loadUserVocabProgress error:", e);
    }
};

// ------------------------------------------------------------------
// 【F】フレンドのログイン履歴を「分」単位まで表示
// ------------------------------------------------------------------
window.sortAndRenderFriendList = function() {
    var container = document.getElementById('friendListContainer');
    if (!container) return;
    container.innerHTML = "";
    if (myFriendList.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-sub); font-size:12px;"> <i data-lucide="user-plus" size="24" style="margin-bottom:6px; opacity:0.5;"></i><br> まだフレンドが登録されていません。<br>上部からIDで検索して追加してみましょう！ </div>';
        window.initLucide();
        return;
    }
    var sortType = document.getElementById('friendSortSelect').value;
    var sortedList = myFriendList.slice();
    if (sortType === "login") {
        sortedList.sort(function(a, b) { return b.timestamp - a.timestamp; });
    } else if (sortType === "level") {
        sortedList.sort(function(a, b) { return b.level - a.level; });
    } else if (sortType === "studyTime") {
        sortedList.sort(function(a, b) { return (b.studyTotalSecs || 0) - (a.studyTotalSecs || 0); });
    }
    sortedList.forEach(function(f) {
        var item = document.createElement('div');
        item.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:var(--card-bg); border:1px solid var(--border); border-radius:12px; padding:10px 14px; box-shadow:0 4px 10px rgba(0,0,0,0.2);";
        var avatarContentStr = '<span style="font-size:24px; flex-shrink:0;">' + (f.avatar || "👤") + '</span>';
        if (f.customAvatar) {
            avatarContentStr = '<img src="' + f.customAvatar + '" style="width:36px; height:36px; border-radius:50%; object-fit:cover; border:1px solid var(--cosmic-purple-light);">';
        }
        var studyLabel = (typeof window.__formatStudyTotal === "function") ? window.__formatStudyTotal(f.studyTotalSecs) : ((f.studyTotalSecs || 0) + "分");
        var loginParts = (f.lastLoginStr || "").split(' ');
        var loginDate = loginParts[0] || "-";
        var loginTime = loginParts[1] || "";
        var loginHtml = 'ログイン:<br><span style="color:#FFF; font-weight:600;">' + loginDate + '</span>';
        if (loginTime) loginHtml += '<br><span style="color:var(--cosmic-cyan); font-weight:700;">' + loginTime + '</span>';
        item.innerHTML =
            '<div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">' +
            '<div style="width:36px; height:36px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">' + avatarContentStr + '</div>' +
            '<div style="flex:1; min-width:0;">' +
            '<div style="display:flex; align-items:baseline; gap:6px;">' +
            '<span style="font-weight:bold; color:white; font-size:13.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + f.name + '</span>' +
            '<span style="font-size:10px; font-weight:900; color:var(--cosmic-cyan); flex-shrink:0;">LV.' + f.level + '</span>' +
            '</div>' +
            '<div style="font-size:10px; color:var(--text-sub); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:1px;">' + f.title + '</div>' +
            '<div style="font-size:9px; color:rgba(255,255,255,0.4); margin-top:3px; display:flex; gap:10px;">' +
            '<span>⏱️ 総勉強: <strong style="color:white;">' + studyLabel + '</strong></span>' +
            '<span>🔑 ID: ' + f.code + '</span>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '<div style="text-align:right; flex-shrink:0; margin-left:8px; display:flex; flex-direction:column; align-items:flex-end; gap:6px;">' +
            '<div style="font-size:9px; color:var(--text-sub); margin-top:0; line-height:1.5;">' + loginHtml + '</div>' +
            '<button style="background:none; border:none; color:var(--word-bad); padding:2px; cursor:pointer;" onclick="window.removeFriendDirect(\'' + f.code + '\', event)"><i data-lucide="user-x" size="14"></i></button>' +
            '</div>';
        container.appendChild(item);
    });
    window.initLucide();
};

// ------------------------------------------------------------------
// 【G】ホームに「自分の総勉強時間」を表示
// ------------------------------------------------------------------
window.__formatTotalStudy3 = function(secs) {
    var totalMin = Math.floor((secs || 0) / 60);
    if (totalMin >= 60) {
        var h = Math.floor(totalMin / 60);
        var m = totalMin % 60;
        return h + "時間" + (m > 0 ? m + "分" : "");
    }
    return totalMin + "分";
};
window.__updateTotalStudyDisplay = function() {
    var el = document.getElementById('totalStudyTimeValue');
    if (!el) return;
    var secs = (typeof userStats !== "undefined" && userStats.study_total_secs) ? userStats.study_total_secs : (parseInt(localStorage.getItem('core_v4_study_total_secs') || "0"));
    el.innerText = window.__formatTotalStudy3(secs);
};
window.__injectTotalStudyDisplay = function() {
    if (document.getElementById('totalStudyTimeRow')) { window.__updateTotalStudyDisplay(); return; }
    var anchor = document.getElementById('todayStudyTimeDisplay');
    if (!anchor) return;
    var row = document.createElement('div');
    row.id = 'totalStudyTimeRow';
    row.style.cssText = "margin-top:6px; font-size:12px; color:var(--text-sub); display:flex; align-items:center; gap:6px;";
    row.innerHTML = '⏱️ 総勉強時間 (全期間): <strong id="totalStudyTimeValue" style="color:var(--cosmic-cyan); font-size:14px;">--</strong>';
    var target = anchor.closest('div') || anchor.parentElement;
    if (target && target.parentElement) target.parentElement.insertBefore(row, target.nextSibling);
    else if (anchor.parentElement) anchor.parentElement.appendChild(row);
    window.__updateTotalStudyDisplay();
};
window.__startTotalStudyDisplayLoop = function() {
    if (window.__totalStudyLoopStarted) return;
    window.__totalStudyLoopStarted = true;
    setInterval(function() { window.__updateTotalStudyDisplay(); }, 1000);
};

// ------------------------------------------------------------------
// 【H】loadLocalState につなげて全体を起動
// ------------------------------------------------------------------
var __prevLoadLocalStateForSync3 = window.loadLocalState;
window.loadLocalState = async function() {
    var r = __prevLoadLocalStateForSync3 ? await __prevLoadLocalStateForSync3.apply(this, arguments) : undefined;
    try {
        await window.__loadGlobalSettings();
        await window.__loadUserSettings();
        window.__startSettingsSyncLoop();
        window.__injectTotalStudyDisplay();
        window.__startTotalStudyDisplayLoop();
    } catch (e) {
        console.error("sync3 loadLocalState error:", e);
    }
    return r;
};

// ------------------------------------------------------------------
// 【I】起動時注入（loadLocalState の保険）
// ------------------------------------------------------------------
(function initSync3Patch() {
    function boot() {
        window.__injectTotalStudyDisplay();
        window.__startTotalStudyDisplayLoop();
    }
    if (document.readyState !== "loading") { setTimeout(boot, 400); }
    else { document.addEventListener("DOMContentLoaded", function() { setTimeout(boot, 400); }); }
})();

console.log("🔄 同期修正パッチ③（設定まるごと同期＋全員共有＋分単位ログイン履歴＋総勉強時間表示）適用完了");
// ==========================================================================
// 🔧 修正パッチ：管理者メニューが押せない問題（サイドバー圧迫＆下部隠れ）
//    原因: サイドバーに「🎴 ロード画面クイズ設定」パネルが追加されたことで
//          中身が100vhを超え、flexがボタンを圧縮。最下部の「🛠️ 管理者メニュー」が
//          画面外（下部ナビの裏）に押し出されてタップできなくなっていた
//    修正: ① サイドバーを指でスクロール可能にする
//          ② 中身ボタン類の圧縮（flex-shrink）を禁止して元の高さを確保
//          ③ 下部ナビバー(60px)に隠れないよう底に余白を確保
//    使い方: このブロックを app.js の末尾にそのまま貼り付けてください
// ==========================================================================
(function fixSidebarAdminMenuPatch() {
    if (document.getElementById('sidebarAdminFixCss')) return;
    var st = document.createElement('style');
    st.id = 'sidebarAdminFixCss';
    st.textContent = [
        /* サイドバー本体：縦スクロールを許可＋下部ナビぶんの余白 */
        '#sidebarMenu{overflow-y:auto !important;-webkit-overflow-scrolling:touch;box-sizing:border-box;padding-bottom:96px !important;}',
        /* 中身（ボタン・パネル類）が縦に潰れるのを防ぐ */
        '#sidebarMenu > *{flex-shrink:0 !important;}',
        /* スクロールバーを細く目立たなく（コズミックシアン） */
        '#sidebarMenu::-webkit-scrollbar{width:4px;}',
        '#sidebarMenu::-webkit-scrollbar-track{background:transparent;}',
        '#sidebarMenu::-webkit-scrollbar-thumb{background:rgba(0,240,255,0.35);border-radius:2px;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(st);
})();
console.log('🔧 サイドバー管理者メニュー修正パッチ（スクロール化＋圧縮防止＋下部余白）適用完了');
// ==========================================================================
// 🔤 第11回パッチ：フラッシュ単語の文字読みやすさ改善（オートフィット）
//    ・泡（円）の形は一切変えない
//    ・中身の文字だけを整える：
//      ① オートフィット：長い文ほど自動で文字を縮小（短い文は大きめのまま）
//      ② 円に内接する安全領域へテキストを自動制限（円弧はみ出し＆縦長折り返しを解消）
//      ③ 内側余白を少し圧縮＋行間・字間を整備
//    ・英語面(.flashcard-face-front)・日本語面(.flashcard-face-back)の両方に同一ルール
//    ・既存 renderFlashcardDeck を「描画後に整える」方式で安全に拡張（ロジックは不変）
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
// ==========================================================================

// ------------------------------------------------------------------
// 【0】スタイル注入（1回だけ。円の外観＝border/shadow/background は不変）
// ------------------------------------------------------------------
(function injectFlashcardReadabilityCss() {
    if (document.getElementById('fcReadabilityCss')) return;
    var st = document.createElement('style');
    st.id = 'fcReadabilityCss';
    st.textContent = [
        /* 内側の余白を少しだけ圧縮（円の外観は変えない＝paddingのみ） */
        '.flashcard-face-front,.flashcard-face-back{padding:18px !important;}',
        /* テキストdivを「円に内接する安全な領域」に制限（番号spanはdivでないので対象外） */
        '.flashcard-face-front div,.flashcard-face-back div{',
        '  max-width:132px !important;',
        '  margin:0 auto !important;',
        '  padding-left:0 !important;',
        '  padding-right:0 !important;',
        '  box-sizing:border-box !important;',
        '  display:block !important;',
        '  overflow:hidden !important;',
        '  /* 縮小時のなめらかさ */',
        '  transition:font-size .12s ease;',
        '}',
        /* 英語面：字間をわずかに広げ、行間を整える */
        '.flashcard-face-front div{',
        '  line-height:1.2 !important;',
        '  letter-spacing:0.3px !important;',
        '  word-break:break-word !important;',
        '  overflow-wrap:anywhere !important;',
        '}',
        /* 日本語面：折り返しの詰まりを解消し、確実に折る */
        '.flashcard-face-back div{',
        '  line-height:1.42 !important;',
        '  letter-spacing:0.02em !important;',
        '  overflow-wrap:anywhere !important;',
        '  word-break:break-word !important;',
        '}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(st);
})();

// ------------------------------------------------------------------
// 【1】円に内接する安全領域の高さ（px）
//     円240 / padding18×2 → 内側204 → 内接正方形≒144 → 安全マージン込み130
// ------------------------------------------------------------------
window.__FC_FIT_AVAIL = 130;

// ------------------------------------------------------------------
// 【2】オートフィット：要素が安全領域に収まるまで文字を縮小
//     短い文は初期サイズのまま＝大きめのまま表示される
// ------------------------------------------------------------------
window.__autoFitFlashText = function(el, maxFs, minFs, availH) {
    if (!el) return;
    var fs = maxFs;
    el.style.fontSize = fs + 'px';
    var guard = 0;
    while (fs > minFs && guard < 80) {
        guard++;
        if (el.scrollHeight <= availH + 1) break;
        fs -= 0.5;
        el.style.fontSize = fs + 'px';
    }
    // 最終確認：まだ溢れていれば下限まで一気に落とす
    if (el.scrollHeight > availH + 1) {
        el.style.fontSize = minFs + 'px';
    }
};

// 1枚のカード（front/back両面）にオートフィットを適用
window.__autoFitFlashcardCard = function(card) {
    if (!card) return;
    var availH = window.__FC_FIT_AVAIL;
    // 英語面：番号spanはspanなので querySelector('div') はテキストdivを返す
    var front = card.querySelector('.flashcard-face-front');
    if (front) window.__autoFitFlashText(front.querySelector('div'), 22, 12, availH);
    // 日本語面：同様にテキストdivを取得
    var back = card.querySelector('.flashcard-face-back');
    if (back) window.__autoFitFlashText(back.querySelector('div'), 16, 10, availH);
};

// ------------------------------------------------------------------
// 【3】renderFlashcardDeck を安全に拡張
//     既存ロジック（タッチ／パーティクル／エッジリップル等）は一切触らず、
//     描画が終わった“後”にだけオートフィットを差し込む
// ------------------------------------------------------------------
(function wrapRenderFlashcardDeckForFit() {
    if (window.renderFlashcardDeck && window.renderFlashcardDeck.__fcFitWrapped) return;
    var prev = window.renderFlashcardDeck;
    if (typeof prev !== 'function') return;
    var wrapped = function() {
        var r = prev.apply(this, arguments);
        // レイアウト確定を待ってから計測（英語面・日本語面の両方）
        var runFit = function() {
            var card = document.getElementById('activeFlashcard');
            window.__autoFitFlashcardCard(card);
        };
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(function() { requestAnimationFrame(runFit); });
        } else {
            setTimeout(runFit, 30);
        }
        return r;
    };
    wrapped.__fcFitWrapped = true;
    window.renderFlashcardDeck = wrapped;
})();

console.log('🔤 第11回パッチ（フラッシュ単語文字読みやすさ：オートフィット＋安全領域＋余白圧縮＋行間整備）適用完了');
// ==========================================================================
// 🔤 第12回パッチ：フラッシュ単語のテキストを「横に伸ばす」
//    ・泡（正円）の形は一切変えない
//    ・テキスト枠を 132px → 170px に拡張（1行の文字数を増やす）
//    ・縦を 106px の帯に制限（その高さでの円の横幅≈174px 内に必ず収まる）
//    ・長い文ほど自動で縮むオートフィットを再適用（下限もさらに低く）
//    ・内側余白 padding を 18px に統一（円の幾何学を安定させる）
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
//    ※自己完結：第11回パッチの有無に関わらず正しく動作します
// ==========================================================================

// ------------------------------------------------------------------
// 【0】スタイル上書き（詳細度を上げて !important 同士でも確実に勝つ）
//     正円の border / shadow / background には触れない＝padding とテキスト枠のみ
// ------------------------------------------------------------------
(function injectFlashcardWidenCss() {
    if (document.getElementById('fcWidenCss')) return;
    var st = document.createElement('style');
    st.id = 'fcWidenCss';
    st.textContent = [
        /* 内側余白を 18px に統一（円の幾何学を安定＝横170が収まる前提を作る） */
        '.flashcard-inner-rotator .flashcard-face-front,',
        '.flashcard-inner-rotator .flashcard-face-back{padding:18px !important;}',
        /* テキストdiv（番号spanは span なので対象外）を横広＋縦帯に制限 */
        '.flashcard-inner-rotator .flashcard-face-front > div,',
        '.flashcard-inner-rotator .flashcard-face-back > div{',
        '  max-width:170px !important;',
        '  max-height:106px !important;',
        '  width:auto !important;',
        '  margin:0 auto !important;',
        '  padding-left:0 !important;',
        '  padding-right:0 !important;',
        '  box-sizing:border-box !important;',
        '  display:block !important;',
        '  overflow:hidden !important;',
        '  transition:font-size .12s ease;',
        '}',
        /* 英語面：字間をわずかに広げ、行間を整える */
        '.flashcard-inner-rotator .flashcard-face-front > div{',
        '  line-height:1.2 !important;',
        '  letter-spacing:0.3px !important;',
        '  word-break:break-word !important;',
        '  overflow-wrap:anywhere !important;',
        '}',
        /* 日本語面：折り返しの詰まりを解消し、確実に折る */
        '.flashcard-inner-rotator .flashcard-face-back > div{',
        '  line-height:1.42 !important;',
        '  letter-spacing:0.02em !important;',
        '  overflow-wrap:anywhere !important;',
        '  word-break:break-word !important;',
        '}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(st);
})();

// ------------------------------------------------------------------
// 【1】円に内接する安全領域の高さ（px）を 106 に確定
//     縦をこの帯に収める＝その帯での円の横幅(≈174)内に必ず収まる
// ------------------------------------------------------------------
window.__FC_FIT_AVAIL = 106;

// ------------------------------------------------------------------
// 【2】オートフィット本体（要素が安全領域に収まるまで 0.5px 刻みで縮小）
//     短い文は初期サイズのまま＝大きめのまま表示される
// ------------------------------------------------------------------
window.__autoFitFlashText = function(el, maxFs, minFs, availH) {
    if (!el) return;
    var fs = maxFs;
    el.style.fontSize = fs + 'px';
    var guard = 0;
    while (fs > minFs && guard < 100) {
        guard++;
        if (el.scrollHeight <= availH + 1) break;
        fs -= 0.5;
        el.style.fontSize = fs + 'px';
    }
    // 最終確認：まだ溢れていれば下限まで一気に落とす
    if (el.scrollHeight > availH + 1) {
        el.style.fontSize = minFs + 'px';
    }
};

// 1枚のカード（front/back 両面）にオートフィットを適用
window.__autoFitFlashcardCard = function(card) {
    if (!card) return;
    var availH = window.__FC_FIT_AVAIL; // 106
    // 英語面：番号spanは span なので querySelector('div') はテキストdivを返す
    var front = card.querySelector('.flashcard-face-front');
    if (front) window.__autoFitFlashText(front.querySelector('div'), 22, 11, availH);
    // 日本語面：同様にテキストdivを取得（下限を 9 まで低く＝長い文はしっかり小さく）
    var back = card.querySelector('.flashcard-face-back');
    if (back) window.__autoFitFlashText(back.querySelector('div'), 16, 9, availH);
};

// ------------------------------------------------------------------
// 【3】renderFlashcardDeck を安全に拡張（自己完結・増殖防止）
//     既存ロジック（スワイプ／パーティクル／エッジリップル等）は一切触らず、
//     描画が終わった“後”にだけオートフィットを差し込む
//     ※第11回パッチのラップが既に巻かれていても二重ガードで無害
// ------------------------------------------------------------------
(function wrapRenderFlashcardDeckForWiden() {
    if (window.renderFlashcardDeck && window.renderFlashcardDeck.__fcFitWrapped12) return;
    var prev = window.renderFlashcardDeck;
    if (typeof prev !== 'function') return;
    var wrapped = function() {
        var r = prev.apply(this, arguments);
        var runFit = function() {
            var card = document.getElementById('activeFlashcard');
            window.__autoFitFlashcardCard(card);
        };
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(function() { requestAnimationFrame(runFit); });
        } else {
            setTimeout(runFit, 30);
        }
        return r;
    };
    wrapped.__fcFitWrapped12 = true;
    window.renderFlashcardDeck = wrapped;
})();

console.log('🔤 第12回パッチ（フラッシュ単語テキスト横拡張：170px＋縦帯106＋オートフィット再適用）適用完了');
// ==========================================================================
// 📖 使い方ガイドパッチ：ハンバーガーメニューの「ログアウト」直上に入口を追加
//    ・フルスクリーンの読むだけガイド（アコーディオン式）
//    ・クイックスタート／機能別ガイド／Tips／近日公開 の4ブロック
//    ・明朝見出し＋ゴシック本文、コズミック発光、微粒子アンビエント、開閉モーション
//    ・✕ボタン／背景タップ／Escキー で閉じる（元の画面へ戻る安心設計）
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
//    ※index.html / style.css の編集は不要です（DOM・CSSを自動注入します）
// ==========================================================================

// ------------------------------------------------------------------
// 【0】パッチ専用スタイルの注入（1回だけ）
// ------------------------------------------------------------------
(function injectUsageGuideCss() {
    if (document.getElementById('usageGuideCss')) return;
    var st = document.createElement('style');
    st.id = 'usageGuideCss';
    st.textContent = [
        /* ---- オーバーレイ本体 ---- */
        '#usageGuideOverlay{position:fixed;inset:0;z-index:100000;display:none;flex-direction:column;',
        'background:radial-gradient(circle at 50% 0%, rgba(30,27,75,0.98) 0%, rgba(15,23,42,0.99) 60%, rgba(7,11,25,0.995) 100%);',
        'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);',
        'opacity:0;transition:opacity .32s cubic-bezier(0.25,1,0.5,1);overflow:hidden;}',
        '#usageGuideOverlay.ug-visible{opacity:1;}',
        /* ---- 微粒子アンビエント ---- */
        '.ug-ambient{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;}',
        '.ug-ambient::before{content:"";position:absolute;inset:0;',
        'background:radial-gradient(circle at 20% 15%, rgba(0,240,255,0.10) 0%, transparent 42%),',
        'radial-gradient(circle at 82% 78%, rgba(192,132,252,0.10) 0%, transparent 45%);}',
        '.ug-spark{position:absolute;bottom:-12px;border-radius:50%;pointer-events:none;opacity:0;',
        'animation:ugFloat linear infinite;}',
        '@keyframes ugFloat{0%{transform:translateY(0) scale(.5);opacity:0;}15%{opacity:.85;}85%{opacity:.5;}100%{transform:translateY(-102vh) scale(1);opacity:0;}}',
        /* ---- ヘッダー帯 ---- */
        '.ug-header{position:relative;z-index:2;flex-shrink:0;display:flex;align-items:center;gap:12px;',
        'padding:18px 18px 16px 18px;border-bottom:1px solid rgba(0,240,255,0.22);',
        'background:linear-gradient(180deg, rgba(7,11,25,0.55) 0%, rgba(7,11,25,0) 100%);}',
        '.ug-header-icon{width:40px;height:40px;flex-shrink:0;border-radius:12px;display:flex;align-items:center;justify-content:center;',
        'background:linear-gradient(135deg, rgba(0,240,255,0.22), rgba(192,132,252,0.22));',
        'border:1px solid rgba(0,240,255,0.4);box-shadow:0 0 14px rgba(0,240,255,0.3);color:var(--cosmic-cyan);}',
        '.ug-header-titles{flex:1;min-width:0;}',
        '.ug-header-title{font-family:"Noto Serif JP",serif;font-size:19px;font-weight:900;color:#fff;letter-spacing:1px;',
        'text-shadow:0 0 12px rgba(0,240,255,0.45);line-height:1.2;}',
        '.ug-header-sub{font-size:10.5px;font-weight:700;color:var(--cosmic-purple-light);letter-spacing:1.5px;margin-top:3px;',
        'text-shadow:0 0 8px rgba(192,132,252,0.4);}',
        '.ug-close{width:38px;height:38px;flex-shrink:0;border-radius:10px;border:1px solid rgba(255,255,255,0.22);',
        'background:rgba(255,255,255,0.05);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;',
        'transition:all .2s ease;-webkit-tap-highlight-color:transparent;}',
        '.ug-close:active{transform:scale(0.9);background:rgba(239,68,68,0.18);border-color:#EF4444;color:#FCA5A5;}',
        /* ---- 本文スクロール領域 ---- */
        '.ug-body{position:relative;z-index:2;flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;',
        'padding:20px 18px calc(28px + env(safe-area-inset-bottom)) 18px;}',
        '.ug-body::-webkit-scrollbar{width:4px;}',
        '.ug-body::-webkit-scrollbar-thumb{background:rgba(0,240,255,0.3);border-radius:2px;}',
        /* ---- セクション見出し ---- */
        '.ug-section-title{font-family:"Noto Serif JP",serif;font-size:15px;font-weight:900;color:#fff;',
        'letter-spacing:1px;margin:26px 0 12px 0;display:flex;align-items:center;gap:8px;',
        'text-shadow:0 0 10px rgba(0,240,255,0.35);}',
        '.ug-section-title:first-child{margin-top:4px;}',
        '.ug-section-title::after{content:"";flex:1;height:1px;',
        'background:linear-gradient(90deg, rgba(0,240,255,0.5), transparent);}',
        /* ---- クイックスタート ---- */
        '.ug-steps{display:flex;flex-direction:column;gap:10px;}',
        '.ug-step{display:flex;gap:12px;align-items:flex-start;padding:13px 14px;border-radius:14px;',
        'background:linear-gradient(135deg, rgba(0,240,255,0.06), rgba(192,132,252,0.05));',
        'border:1px solid rgba(255,255,255,0.12);box-shadow:0 4px 14px rgba(0,0,0,0.25);}',
        '.ug-step-num{width:30px;height:30px;flex-shrink:0;border-radius:50%;display:flex;align-items:center;justify-content:center;',
        'font-family:"Noto Serif JP",serif;font-size:15px;font-weight:900;color:#06121f;',
        'background:linear-gradient(135deg, var(--cosmic-cyan), var(--cosmic-purple-light));',
        'box-shadow:0 0 12px rgba(0,240,255,0.5);}',
        '.ug-step-body{flex:1;min-width:0;}',
        '.ug-step-head{font-size:13.5px;font-weight:800;color:#fff;margin-bottom:3px;display:flex;align-items:center;gap:6px;}',
        '.ug-step-head i{color:var(--cosmic-cyan);flex-shrink:0;}',
        '.ug-step-desc{font-size:11.5px;color:rgba(226,232,240,0.82);line-height:1.6;font-weight:500;}',
        /* ---- アコーディオン ---- */
        '.ug-acc{border-radius:13px;margin-bottom:9px;overflow:hidden;',
        'border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.035);',
        'transition:border-color .25s ease, box-shadow .25s ease;}',
        '.ug-acc.open{border-color:rgba(0,240,255,0.4);box-shadow:0 0 14px rgba(0,240,255,0.16);}',
        '.ug-acc-head{width:100%;display:flex;align-items:center;gap:10px;padding:13px 14px;',
        'background:none;border:none;cursor:pointer;text-align:left;color:#fff;',
        '-webkit-tap-highlight-color:transparent;transition:background .2s ease;}',
        '.ug-acc-head:active{background:rgba(0,240,255,0.07);}',
        '.ug-acc-ico{width:30px;height:30px;flex-shrink:0;border-radius:9px;display:flex;align-items:center;justify-content:center;',
        'background:rgba(0,240,255,0.12);border:1px solid rgba(0,240,255,0.3);color:var(--cosmic-cyan);}',
        '.ug-acc-title{flex:1;min-width:0;font-size:13px;font-weight:800;color:#fff;letter-spacing:0.3px;}',
        '.ug-chev{flex-shrink:0;color:var(--text-sub);transition:transform .3s cubic-bezier(0.25,1,0.5,1);}',
        '.ug-acc.open .ug-chev{transform:rotate(180deg);color:var(--cosmic-cyan);}',
        '.ug-acc-body{max-height:0;overflow:hidden;box-sizing:border-box;padding:0 16px;',
        'transition:max-height .38s cubic-bezier(0.25,1,0.5,1);}',
        '.ug-acc.open .ug-acc-body{padding:2px 16px 15px 16px;}',
        '.ug-acc-body p{font-size:12px;color:rgba(226,232,240,0.86);line-height:1.75;margin:0 0 9px 0;font-weight:500;}',
        '.ug-acc-body p:last-child{margin-bottom:0;}',
        '.ug-acc-body strong{color:var(--cosmic-cyan);font-weight:800;}',
        '.ug-acc-body em{color:var(--cosmic-purple-light);font-style:normal;font-weight:800;}',
        '.ug-acc-body ul{margin:0 0 9px 0;padding:0;list-style:none;}',
        '.ug-acc-body li{position:relative;padding:5px 0 5px 18px;font-size:11.5px;color:rgba(226,232,240,0.84);line-height:1.6;}',
        '.ug-acc-body li::before{content:"";position:absolute;left:2px;top:11px;width:6px;height:6px;border-radius:50%;',
        'background:var(--cosmic-cyan);box-shadow:0 0 7px rgba(0,240,255,0.7);}',
        /* ---- 理解度マークのミニ凡例 ---- */
        '.ug-marks{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 4px 0;}',
        '.ug-mark{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;',
        'padding:3px 9px;border-radius:20px;border:1px solid rgba(255,255,255,0.18);background:rgba(0,0,0,0.25);}',
        '.ug-mark b{width:13px;height:13px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:900;}',
        /* ---- Tips ---- */
        '.ug-tips{display:flex;flex-direction:column;gap:8px;}',
        '.ug-tip{display:flex;gap:10px;align-items:flex-start;padding:11px 13px;border-radius:12px;',
        'background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.22);}',
        '.ug-tip-ico{flex-shrink:0;color:#FBBF24;margin-top:1px;filter:drop-shadow(0 0 5px rgba(245,158,11,0.5));}',
        '.ug-tip-text{font-size:11.5px;color:rgba(254,243,199,0.92);line-height:1.65;font-weight:600;}',
        /* ---- 近日公開 ---- */
        '.ug-soon{margin-top:6px;padding:13px 15px;border-radius:13px;text-align:center;',
        'background:rgba(236,72,153,0.06);border:1px dashed rgba(236,72,153,0.35);}',
        '.ug-soon-title{font-size:12px;font-weight:900;color:var(--admin-accent);letter-spacing:1px;margin-bottom:5px;',
        'text-shadow:0 0 8px rgba(236,72,153,0.4);}',
        '.ug-soon-desc{font-size:11px;color:rgba(255,255,255,0.55);line-height:1.6;font-weight:500;}',
        /* ---- 入口ボタン（サイドバー内） ---- */
        '#usageGuideEntryBtn{color:var(--cosmic-cyan) !important;}',
        '#usageGuideEntryBtn i{color:var(--cosmic-cyan);filter:drop-shadow(0 0 5px rgba(0,240,255,0.5));}',
        '#usageGuideEntryBtn:active{background:rgba(0,240,255,0.12) !important;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(st);
})();

// ------------------------------------------------------------------
// 【1】ガイドの中身データ（クイックスタート／機能別／Tips）
// ------------------------------------------------------------------
window.__USAGE_GUIDE_STEPS = [
    { icon: 'user-check', head: 'アカウントを作る／ログインする', desc: '初めての方は「新規作成」でプレイヤー名・本名・年齢・4桁の暗証番号を登録。発行されたIDはログインに必要なので必ずメモして。2回目以降はID＋暗証番号でログイン。' },
    { icon: 'book-marked', head: '単語帳で単語を覚える', desc: '単語をタップして意味を確認し、右の4つのボタンで理解度をマーク。⚪︎＝定着／△＝曖昧／✕＝不可／ー＝リセット。覚えるほど経験値(XP)が溜まってレベルが上がります。' },
    { icon: 'zap', head: 'フラッシュ＆ゲームで定着させる', desc: 'ゲームタブの「フラッシュ単語」でめくり学習、「単語の試練」でタイピングテスト。苦手な単語ほど繰り返し出るので、自然と記憶に定着します。' }
];

window.__USAGE_GUIDE_SECTIONS = [
    {
        icon: 'home', title: '🏠 ホーム',
        html: '<p>あなたの<strong>司令部</strong>。プロフィールカードにレベル・装備中の称号・学習目標が表示されます。</p>' +
              '<ul><li><strong>本日の総勉強時間</strong>はリアルタイムでカウント（単語帳・リーダー・プレイ中に増えます）。</li>' +
              '<li><strong>最近7日間のアクティビティ</strong>グラフで、勉強の習慣をひと目で確認。</li>' +
              '<li>右上の <strong>💾 ボタン</strong>で、いつでもデータを明示保存できます。</li></ul>'
    },
    {
        icon: 'book-open', title: '📔 単語帳',
        html: '<p>登録単語を一覧し、<em>理解度</em>を4段階で管理する中心画面です。</p>' +
              '<div class="ug-marks">' +
              '<span class="ug-mark"><b style="background:#10B981;color:#000;">⚪︎</b>定着</span>' +
              '<span class="ug-mark"><b style="background:#F59E0B;color:#000;">△</b>曖昧</span>' +
              '<span class="ug-mark"><b style="background:#EF4444;color:#fff;">✕</b>不可</span>' +
              '<span class="ug-mark"><b style="background:rgba(255,255,255,0.3);color:#fff;">ー</b>リセット</span>' +
              '</div>' +
              '<ul><li>単語をタップすると意味ポップアップが開き、その場でマークを変更できます。</li>' +
              '<li>上部の<strong>表紙をタップ</strong>して教材を切り替え。範囲指定・検索・フィルタも利用可能。</li>' +
              '<li>タイトル横の <strong>📊 詳細</strong>で、定着率のドーナツグラフを確認。</li></ul>'
    },
    {
        icon: 'scan-text', title: '📖 スマート長文リーダー',
        html: '<p>英文を貼り付けて「解析」すると、AIが<strong>全文要約・文ごとの和訳・文法ハイライト</strong>を自動生成します。</p>' +
              '<ul><li>文中の単語をタップすると、登録語や内蔵辞書の意味をその場で確認。</li>' +
              '<li>和訳は<strong>インライン表示</strong>と<strong>下部にまとめて表示</strong>を切り替え可能。</li>' +
              '<li>読み終えた長文は<strong>本棚に保存</strong>して、あとから何度でも再開できます。</li></ul>'
    },
    {
        icon: 'users', title: '👥 フレンド',
        html: '<p>相手の<strong>IDコード</strong>で検索・追加して、修行仲間とつながります。</p>' +
              '<ul><li>並び替えは「最終ログイン順／レベル順／勉強時間順」。</li>' +
              '<li>画面を<strong>左右スワイプ</strong>すると、フレンド一覧とランキングが切り替わります。</li>' +
              '<li><strong>🔄 最新情報に更新</strong>で、相手のレベルやログイン時刻をクラウドから再取得。</li></ul>'
    },
    {
        icon: 'swords', title: '🎮 単語テスト（単語の試練）',
        html: '<p>制限時間内に英訳・和訳・まぜまぜで答えるタイピングバトル。</p>' +
              '<ul><li>難易度は <strong>ノーマル(3分)／ハード(7分)／エキスパート(15分)</strong>。</li>' +
              '<li><strong>エンドレス</strong>は時間無制限・ハート5個。5回ミスで終了。</li>' +
              '<li>正解はAIが採点（◎正解／○おまけ正解）。連続正解で<strong>コンボボーナス</strong>が乗ります。</li></ul>'
    },
    {
        icon: 'layers', title: '🃏 フラッシュ単語',
        html: '<p>泡カードをめくって、直感で仕分ける学習モード。</p>' +
              '<ul><li>カードを<strong>タップ</strong>で裏返して答えを確認。</li>' +
              '<li><strong>右スワイプ＝⚪︎覚えた</strong>／<strong>左スワイプ＝✕覚えてない</strong>／<strong>上スワイプ＝△スキップ</strong>。</li>' +
              '<li>設定で<strong>出題する教材</strong>と<strong>方向（英→和／和→英）</strong>を選べます。</li></ul>'
    },
    {
        icon: 'award', title: '🏅 称号コレクション',
        html: '<p>さまざまな課題を達成して称号を解放し、プロフィールに<strong>装備</strong>できます。</p>' +
              '<ul><li>進化称号は<strong>5段階</strong>。達成するほどレアリティが上がります。</li>' +
              '<li>条件を満たすと<strong>特別称号</strong>や<strong>シーズン称号</strong>も解放。</li>' +
              '<li>段階が進むごとに<strong>ボーナスXP</strong>が貰えて、レベル上げにも貢献。</li></ul>'
    },
    {
        icon: 'cloud', title: '💾 保存と同期',
        html: '<p>あなたのデータは<strong>端末</strong>と<strong>クラウド</strong>の両方に保存されます。</p>' +
              '<ul><li>同じIDでログインすれば、<strong>別の端末でも続きから</strong>再開できます。</li>' +
              '<li>右上の <strong>💾 ボタン</strong>で手動保存。大事な進捗はこまめに保存を。</li>' +
              '<li>理解度・レベル・称号・設定類は、できるだけ<strong>新しい方が優先</strong>されるよう同期されます。</li></ul>'
    }
];

window.__USAGE_GUIDE_TIPS = [
    '読み込みを待つ間、<strong>ミニ単語クイズ</strong>が自動で表示されます。右⚪︎・左✕・上△で答えれば、選んだ教材の理解度にちゃんと保存されます。',
    '理解度は<strong>4段階</strong>。間違えて付けたマークは <strong>ー（リセット）</strong>で元に戻せます。',
    'リーダーで読んだ長文は<strong>本棚に保存</strong>しておくと、解析結果ごとあとから再開できて便利です。',
    '単語帳の <strong>📊 詳細</strong>をこまめにチェック。定着率の推移がモチベーションになります。',
    'アプリを閉じる前・端末を変える前は、右上の <strong>💾</strong>をひと押ししておくと安心です。'
];

// ------------------------------------------------------------------
// 【2】オーバーレイのDOMを構築（1回だけ生成して再利用）
// ------------------------------------------------------------------
window.__buildUsageGuideOverlay = function() {
    if (document.getElementById('usageGuideOverlay')) return;

    // クイックスタート
    var stepsHtml = '';
    window.__USAGE_GUIDE_STEPS.forEach(function(s, i) {
        stepsHtml +=
            '<div class="ug-step">' +
            '<div class="ug-step-num">' + (i + 1) + '</div>' +
            '<div class="ug-step-body">' +
            '<div class="ug-step-head"><i data-lucide="' + s.icon + '" size="15"></i>' + s.head + '</div>' +
            '<div class="ug-step-desc">' + s.desc + '</div>' +
            '</div></div>';
    });

    // 機能別アコーディオン
    var accHtml = '';
    window.__USAGE_GUIDE_SECTIONS.forEach(function(sec) {
        accHtml +=
            '<div class="ug-acc">' +
            '<button type="button" class="ug-acc-head">' +
            '<span class="ug-acc-ico"><i data-lucide="' + sec.icon + '" size="16"></i></span>' +
            '<span class="ug-acc-title">' + sec.title + '</span>' +
            '<i data-lucide="chevron-down" size="16" class="ug-chev"></i>' +
            '</button>' +
            '<div class="ug-acc-body">' + sec.html + '</div>' +
            '</div>';
    });

    // Tips
    var tipsHtml = '';
    window.__USAGE_GUIDE_TIPS.forEach(function(t) {
        tipsHtml +=
            '<div class="ug-tip">' +
            '<i data-lucide="lightbulb" size="15" class="ug-tip-ico"></i>' +
            '<div class="ug-tip-text">' + t + '</div>' +
            '</div>';
    });

    var ov = document.createElement('div');
    ov.id = 'usageGuideOverlay';
    ov.innerHTML =
        '<div class="ug-ambient" id="ugAmbient"></div>' +
        '<div class="ug-header">' +
        '<div class="ug-header-icon"><i data-lucide="book-open-check" size="20"></i></div>' +
        '<div class="ug-header-titles">' +
        '<div class="ug-header-title">使い方ガイド</div>' +
        '<div class="ug-header-sub">HOW TO USE · 修行の手引き</div>' +
        '</div>' +
        '<button type="button" class="ug-close" id="ugCloseBtn" aria-label="閉じる"><i data-lucide="x" size="20"></i></button>' +
        '</div>' +
        '<div class="ug-body" id="ugBody">' +
        '<div class="ug-section-title"><i data-lucide="rocket" size="16" style="color:var(--cosmic-cyan);"></i>まずはこの3ステップ</div>' +
        '<div class="ug-steps">' + stepsHtml + '</div>' +
        '<div class="ug-section-title"><i data-lucide="layout-grid" size="16" style="color:var(--cosmic-purple-light);"></i>機能別ガイド</div>' +
        '<div class="ug-acc-list">' + accHtml + '</div>' +
        '<div class="ug-section-title"><i data-lucide="sparkles" size="16" style="color:#FBBF24;"></i>知っておくと得する Tips</div>' +
        '<div class="ug-tips">' + tipsHtml + '</div>' +
        '<div class="ug-section-title"><i data-lucide="telescope" size="16" style="color:var(--admin-accent);"></i>近日公開</div>' +
        '<div class="ug-soon">' +
        '<div class="ug-soon-title">⚔️ マルチバトル ／ 🛡️ パーティ編成</div>' +
        '<div class="ug-soon-desc">仲間と協力してボスを討伐するマルチプレイと、キャラクター・武器・防具の編成機能はただいま準備中。公開までもうしばらくお待ちください。</div>' +
        '</div>' +
        '</div>';

    document.body.appendChild(ov);

    // 微粒子を生成
    var ambient = ov.querySelector('#ugAmbient');
    if (ambient) {
        var sparks = '';
        for (var i = 0; i < 16; i++) {
            var left = Math.round(Math.random() * 100);
            var delay = (Math.random() * 8).toFixed(2);
            var dur = (7 + Math.random() * 8).toFixed(2);
            var size = (2 + Math.round(Math.random() * 3));
            var c = Math.random() < 0.5 ? 'rgba(0,240,255,0.8)' : 'rgba(192,132,252,0.8)';
            sparks += '<span class="ug-spark" style="left:' + left + '%;width:' + size + 'px;height:' + size + 'px;background:' + c + ';animation-delay:' + delay + 's;animation-duration:' + dur + 's;"></span>';
        }
        ambient.innerHTML = sparks;
    }

    // 閉じるボタン
    var closeBtn = ov.querySelector('#ugCloseBtn');
    if (closeBtn) closeBtn.onclick = function() { window.closeUsageGuide(); };

    // 背景タップで閉じる（ヘッダ・本文以外＝オーバーレイ直下のみ）
    ov.addEventListener('click', function(e) {
        if (e.target === ov) window.closeUsageGuide();
    });

    // アコーディオン（イベント委譲）
    var body = ov.querySelector('#ugBody');
    if (body) {
        body.addEventListener('click', function(e) {
            var head = e.target.closest('.ug-acc-head');
            if (!head) return;
            var acc = head.parentElement;
            var accBody = acc.querySelector('.ug-acc-body');
            if (!accBody) return;
            var willOpen = !acc.classList.contains('open');
            acc.classList.toggle('open', willOpen);
            if (willOpen) {
                accBody.style.maxHeight = accBody.scrollHeight + 24 + 'px';
            } else {
                accBody.style.maxHeight = '0px';
            }
        });
    }

    if (typeof window.initLucide === 'function') window.initLucide();
};

// ------------------------------------------------------------------
// 【3】開く／閉じる
// ------------------------------------------------------------------
window.openUsageGuide = function() {
    window.__buildUsageGuideOverlay();
    var ov = document.getElementById('usageGuideOverlay');
    if (!ov) return;
    // サイドバーは閉じておく
    if (typeof window.toggleSidebar === 'function') window.toggleSidebar(false);
    ov.style.display = 'flex';
    ov.scrollTop = 0;
    var body = ov.querySelector('#ugBody');
    if (body) body.scrollTop = 0;
    // 開いているアコーディオンの高さを再計測（表示後に正しく出す）
    var openAccs = ov.querySelectorAll('.ug-acc.open .ug-acc-body');
    for (var i = 0; i < openAccs.length; i++) {
        openAccs[i].style.maxHeight = openAccs[i].scrollHeight + 24 + 'px';
    }
    requestAnimationFrame(function() {
        requestAnimationFrame(function() { ov.classList.add('ug-visible'); });
    });
};

window.closeUsageGuide = function() {
    var ov = document.getElementById('usageGuideOverlay');
    if (!ov) return;
    ov.classList.remove('ug-visible');
    setTimeout(function() {
        if (!ov.classList.contains('ug-visible')) ov.style.display = 'none';
    }, 320);
};

// Escキーで閉じる（1回だけ登録）
if (!window.__ugEscBound) {
    window.__ugEscBound = true;
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
            var ov = document.getElementById('usageGuideOverlay');
            if (ov && ov.classList.contains('ug-visible')) window.closeUsageGuide();
        }
    });
}

// ------------------------------------------------------------------
// 【4】サイドバーへ入口ボタンを注入（ログアウトの直上）
// ------------------------------------------------------------------
window.injectUsageGuideButton = function() {
    var sidebar = document.getElementById('sidebarMenu');
    if (!sidebar) return;
    if (document.getElementById('usageGuideEntryBtn')) {
        if (typeof window.initLucide === 'function') window.initLucide();
        return;
    }
    var btn = document.createElement('button');
    btn.id = 'usageGuideEntryBtn';
    btn.type = 'button';
    btn.className = 'sidebar-item';
    btn.innerHTML = '<i data-lucide="book-open-check" size="18"></i><span>使い方ガイド</span>';
    btn.onclick = function() { window.openUsageGuide(); };

    // 「ログアウト」を含む要素の直前に挿入
    var anchor = null;
    var children = sidebar.children;
    for (var i = 0; i < children.length; i++) {
        if ((children[i].textContent || '').indexOf('ログアウト') !== -1) { anchor = children[i]; break; }
    }
    if (anchor) sidebar.insertBefore(btn, anchor);
    else sidebar.appendChild(btn);

    if (typeof window.initLucide === 'function') window.initLucide();
};

// ------------------------------------------------------------------
// 【5】loadLocalState に接続 ＋ 起動時注入
// ------------------------------------------------------------------
var __prevLoadLocalStateForUsageGuide = window.loadLocalState;
window.loadLocalState = async function() {
    var r = __prevLoadLocalStateForUsageGuide ? await __prevLoadLocalStateForUsageGuide.apply(this, arguments) : undefined;
    window.injectUsageGuideButton();
    return r;
};

(function initUsageGuidePatch() {
    function boot() { window.injectUsageGuideButton(); }
    if (document.readyState !== 'loading') { setTimeout(boot, 400); }
    else { document.addEventListener('DOMContentLoaded', function() { setTimeout(boot, 400); }); }
})();

console.log('📖 使い方ガイドパッチ（サイドバー入口＋フルスクリーンアコーディオンガイド）適用完了');
// ==========================================================================
// 🎴 第13回パッチ：フラッシュ単語の意味別出題
//    ① 複数の意味を持つ単語を「意味ごとの別カード」として出題（同じ単語が意味の数だけ出る）
//    ② 「覚えた/覚えていない」を意味ごとに個別記録（常に meanings[0] が更新されるバグを修正）
//    ③ カード背景色・履歴バブルを、その意味自身の状態に合わせて表示
//    ④ 意味が2つ以上ある単語は「意味 ①/②」バッジを表示
//    ⑤ 単語全体の状態は全意味から自動集計（updateMeaningStatus と同じ方式）
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
//    ※教材切替・ペンギンローディング・ゴーストエフェクト・テンポ等はすべてそのまま継承
// ==========================================================================
(function applyFlashcardMeaningPatch() {
    if (window.__flashcardMeaningPatchApplied) return;
    window.__flashcardMeaningPatchApplied = true;

    var MEANING_CLEAN_REGEX = /[.,\/#!$%\^&\*;:{}=\-_`~()\[\]\"']/g;
    var CIRCLED_NUMS = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';

    // ------------------------------------------------------------------
    // ヘルパー①：カードから vocabList 内の単語を探す（num優先・wordフォールバック）
    // ------------------------------------------------------------------
    function findVocabForCard(wordData) {
        if (!wordData) return null;
        var match = null;
        if (wordData.num !== undefined && wordData.num !== null) {
            match = vocabList.find(function(v) { return String(v.num) === String(wordData.num); });
        }
        if (!match && wordData.en) {
            var cleanKey = String(wordData.en).toLowerCase().replace(MEANING_CLEAN_REGEX, "");
            match = vocabList.find(function(v) { return v.word.toLowerCase() === cleanKey; });
        }
        return match;
    }

    // ヘルパー②：カードが指す「狙った意味」を探す
    function findTargetMeaning(vocabMatch, wordData) {
        if (!vocabMatch || !vocabMatch.meanings) return null;
        if (wordData.meaningId === undefined || wordData.meaningId === null) return null;
        return vocabMatch.meanings.find(function(m) { return String(m.id) === String(wordData.meaningId); }) || null;
    }

    // ------------------------------------------------------------------
    // ① startFlashcardSession 上書き：既存処理の実行後にキューを意味ごとに展開
    //    （教材切替・ペンギンローディング等はそのまま実行される）
    // ------------------------------------------------------------------
    var __prevStartFlashcardSessionForMeaningPatch = window.startFlashcardSession;
    window.startFlashcardSession = async function() {
        await __prevStartFlashcardSessionForMeaningPatch.apply(this, arguments);

        // セッションが始まっていない場合（プールが空で早期リターンした等）は何もしない
        var playScreen = document.getElementById('flashcard-play-screen');
        if (!playScreen || playScreen.style.display !== 'flex') return;
        if (!flashcardOriginQueue || flashcardOriginQueue.length === 0) return;

        // 各単語カードを「意味ごとのカード」へ展開
        var expanded = [];
        flashcardOriginQueue.forEach(function(card) {
            var vocabMatch = findVocabForCard(card);
            if (vocabMatch && vocabMatch.meanings && vocabMatch.meanings.length > 0) {
                var valid = vocabMatch.meanings.filter(function(m) { return m.text && String(m.text).trim() !== ''; });
                if (valid.length === 0) valid = [vocabMatch.meanings[0]];
                valid.forEach(function(m, badgeIdx) {
                    expanded.push({
                        num: card.num,
                        en: card.en,
                        ja: m.text,
                        meaningId: m.id,
                        meaningBadgeIndex: badgeIdx,
                        totalMeanings: valid.length
                    });
                });
            } else {
                // 意味が取得できない場合の保険：そのまま維持（既存挙動）
                expanded.push({ num: card.num, en: card.en, ja: card.ja });
            }
        });

        flashcardOriginQueue = expanded.sort(function() { return Math.random() - 0.5; });
        flashcardCurrentIndex = 0;
        flashcardLearnedCount = 0;
        flashcardSessionHistory = [];
        window.renderFlashcardDeck();
    };

    // ------------------------------------------------------------------
    // ② getFlashcardStyleByHistory 上書き：その意味自身の履歴で背景色を決定
    //    （意味IDが無いカードは従来の単語全体挙動をそのまま再現）
    // ------------------------------------------------------------------
    window.getFlashcardStyleByHistory = function(wordData) {
        var vocabMatch = findVocabForCard(wordData);
        var allHistory = [];

        var targetMeaning = findTargetMeaning(vocabMatch, wordData);
        if (targetMeaning) {
            // ✅ 意味別：この意味の履歴だけを読む
            if (targetMeaning.history && targetMeaning.history.length > 0) {
                allHistory = allHistory.concat(targetMeaning.history);
            }
        } else if (vocabMatch) {
            // フォールバック：従来の単語全体挙動
            if (vocabMatch.history && vocabMatch.history.length > 0) {
                allHistory = allHistory.concat(vocabMatch.history);
            }
            if (vocabMatch.meanings) {
                vocabMatch.meanings.forEach(function(m) {
                    if (m.history && m.history.length > 0) allHistory = allHistory.concat(m.history);
                });
            }
        } else {
            var cleanKey = String(wordData.en || '').toLowerCase().replace(MEANING_CLEAN_REGEX, "");
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
        var green = [16, 185, 129], yellow = [245, 158, 11], red = [239, 68, 68];
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
        return "background: radial-gradient(circle at center, rgba(" + r + ", " + g + ", " + b + ", 0.22) 0%, rgba(" + r + ", " + g + ", " + b + ", 0.12) 50%, rgba(" + r + ", " + g + ", " + b + ", 0) 100%);";
    };

    // ------------------------------------------------------------------
    // ③ renderFlashcardHistoryBubbles 上書き：その意味自身の直近5回を表示
    // ------------------------------------------------------------------
    window.renderFlashcardHistoryBubbles = function(wordData) {
        var container = document.getElementById('fcHistoryContainer');
        if (!container) return;
        container.innerHTML = "";

        var vocabMatch = findVocabForCard(wordData);
        var targetHistory = [];

        var targetMeaning = findTargetMeaning(vocabMatch, wordData);
        if (targetMeaning) {
            // ✅ 意味別
            if (targetMeaning.history && targetMeaning.history.length > 0) {
                targetHistory = targetHistory.concat(targetMeaning.history);
            } else if (targetMeaning.status && targetMeaning.status !== 'none') {
                targetHistory.push(targetMeaning.status);
            }
        } else if (vocabMatch) {
            // フォールバック：従来の単語全体挙動
            if (vocabMatch.history && vocabMatch.history.length > 0) {
                targetHistory = targetHistory.concat(vocabMatch.history);
            } else if (vocabMatch.status && vocabMatch.status !== 'none') {
                targetHistory.push(vocabMatch.status);
            }
        } else {
            var cleanKey = String(wordData.en || '').toLowerCase().replace(MEANING_CLEAN_REGEX, "");
            var memStatus = wordMemory[cleanKey];
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

    // ------------------------------------------------------------------
    // ④ swipeFlashcard 上書き：スワイプした「その意味」だけを更新
    //    仕組み：既存処理の実行直前だけ狙った意味を先頭へ移動し、
    //           try/finally で必ず元の順番へ戻す（エフェクト・テンポは完全維持）
    // ------------------------------------------------------------------
    var __prevSwipeFlashcardForMeaningPatch = window.swipeFlashcard;
    window.swipeFlashcard = function(direction, finalDx, finalDy) {
        var currentWord = flashcardOriginQueue[flashcardCurrentIndex];
        var vocabMatch = findVocabForCard(currentWord);
        var originalIndex = -1;

        if (vocabMatch && vocabMatch.meanings && currentWord &&
            currentWord.meaningId !== undefined && currentWord.meaningId !== null) {
            originalIndex = vocabMatch.meanings.findIndex(function(m) { return String(m.id) === String(currentWord.meaningId); });
        }

        var needRestore = false;
        if (vocabMatch && vocabMatch.meanings && originalIndex > 0) {
            var target = vocabMatch.meanings.splice(originalIndex, 1)[0];
            vocabMatch.meanings.unshift(target);
            needRestore = true;
        }

        try {
            return __prevSwipeFlashcardForMeaningPatch.apply(this, arguments);
        } finally {
            // 意味の順番を必ず元に戻す
            if (needRestore && vocabMatch && vocabMatch.meanings) {
                var moved = vocabMatch.meanings.shift();
                vocabMatch.meanings.splice(originalIndex, 0, moved);
            }
            // 単語全体の状態を全意味から集計（updateMeaningStatus と同じ方式）
            if (vocabMatch && vocabMatch.meanings && vocabMatch.meanings.length > 0 &&
                typeof window.wordOverallStatus === 'function') {
                var agg = [];
                vocabMatch.meanings.forEach(function(m) {
                    if (m.history && m.history.length > 0) agg = agg.concat(m.history);
                });
                vocabMatch.history = agg.slice(-20);
                vocabMatch.status = window.wordOverallStatus(vocabMatch);
            }
        }
    };

    // ------------------------------------------------------------------
    // ⑤ renderFlashcardDeck 上書き：意味が2つ以上ある単語に「意味 ①/②」バッジを注入
    //    （既存の描画・オートフィット処理は一切触らず、描画後に追加だけ行う）
    // ------------------------------------------------------------------
    var __prevRenderFlashcardDeckForMeaningPatch = window.renderFlashcardDeck;
    window.renderFlashcardDeck = function() {
        var r = __prevRenderFlashcardDeckForMeaningPatch.apply(this, arguments);
        try {
            var wordData = flashcardOriginQueue[flashcardCurrentIndex];
            if (wordData && wordData.totalMeanings && wordData.totalMeanings > 1) {
                var card = document.getElementById('activeFlashcard');
                if (card) {
                    var idxChar = CIRCLED_NUMS[wordData.meaningBadgeIndex] || String(wordData.meaningBadgeIndex + 1);
                    var totalChar = CIRCLED_NUMS[wordData.totalMeanings - 1] || String(wordData.totalMeanings);
                    var faces = card.querySelectorAll('.flashcard-face-front, .flashcard-face-back');
                    for (var i = 0; i < faces.length; i++) {
                        var face = faces[i];
                        if (face.querySelector('.fc-meaning-badge')) continue;
                        var badge = document.createElement('span');
                        badge.className = 'fc-meaning-badge';
                        badge.style.cssText = "position:absolute; bottom:26px; left:50%; transform:translateX(-50%); font-size:10px; font-weight:800; color:var(--cosmic-purple-light); background:rgba(0,0,0,0.45); border:1px solid rgba(192,132,252,0.5); padding:2px 8px; border-radius:10px; letter-spacing:0.5px; pointer-events:none; text-shadow:0 0 6px rgba(192,132,252,0.6); white-space:nowrap; z-index:10;";
                        badge.innerText = '意味 ' + idxChar + ' / ' + totalChar;
                        face.appendChild(badge);
                    }
                }
            }
        } catch (e) {}
        return r;
    };

    console.log('🎴 第13回パッチ（フラッシュ単語の意味別出題）適用完了');
})();
// ==========================================================================
// 🏆 第13回パッチ：フレンド欄ランキング強化（コミュニティランキングシステム）
//    ① ランキング画面の上部にスワイプ式ランキングセレクターを新設
//       （レベル / シングルスコア / プレイ時間 / フラッシュ）
//    ② レベルランキング：Lvを大きく＋EXPを小さく表示（Lv優先でソート）
//    ③ シングルスコア：英訳/和訳/まぜ × エンドレス/ノーマル/ハード/エキスパート
//       （エンドレスは既存データ、他難易度は新たにクラウドへ送信）
//    ④ プレイ時間：総計/週間/1日を切替（週間・1日は新たにクラウド同期）
//    ⑤ フラッシュ：flash_count（スワイプ総回数）でランキング
//    ⑥ ゲーム終了時に難易度別スコアを自動送信＋起動時に既存ローカルベストを
//       一度だけクラウドへ反映（自分の過去分もランキングに載る）
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
// ==========================================================================
(function applyCommunityRankingPatch() {
    if (window.__communityRankingPatchApplied) return;
    window.__communityRankingPatchApplied = true;

    // ------------------------------------------------------------------
    // 【0】パッチ専用スタイル（スワイプ式ピル・発光・ランキング数値）
    // ------------------------------------------------------------------
    (function injectCommunityRankCss() {
        if (document.getElementById('communityRankCss')) return;
        var st = document.createElement('style');
        st.id = 'communityRankCss';
        st.textContent = [
            '.community-rank-scroller{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 8px 2px;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;scrollbar-width:none;}',
            '.community-rank-scroller::-webkit-scrollbar{display:none;}',
            '.community-rank-pill{flex-shrink:0;scroll-snap-align:start;padding:9px 16px;border-radius:20px;border:1px solid rgba(255,255,255,0.18);background:rgba(7,11,25,0.7);color:var(--text-sub);font-size:12px;font-weight:900;letter-spacing:0.5px;cursor:pointer;white-space:nowrap;transition:all 0.25s cubic-bezier(0.25,1,0.5,1);-webkit-tap-highlight-color:transparent;}',
            '.community-rank-pill:active{transform:scale(0.95);}',
            '.community-rank-pill-active{border-color:var(--cosmic-cyan);background:linear-gradient(135deg, rgba(0,240,255,0.28) 0%, rgba(192,132,252,0.28) 100%);color:#FFFFFF;box-shadow:0 0 16px rgba(0,240,255,0.45);text-shadow:0 0 8px rgba(0,240,255,0.6);}',
            '.community-rank-subrow{display:flex;gap:6px;overflow-x:auto;padding:2px 2px 6px 2px;-webkit-overflow-scrolling:touch;scrollbar-width:none;}',
            '.community-rank-subrow::-webkit-scrollbar{display:none;}',
            '.community-rank-subpill{flex-shrink:0;padding:6px 13px;border-radius:16px;border:1px solid rgba(255,255,255,0.14);background:rgba(0,0,0,0.4);color:var(--text-sub);font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap;transition:all 0.2s ease;-webkit-tap-highlight-color:transparent;}',
            '.community-rank-subpill:active{transform:scale(0.94);}',
            '.community-rank-subpill-active{border-color:var(--cosmic-purple-light);background:rgba(192,132,252,0.24);color:#FFFFFF;box-shadow:0 0 10px rgba(192,132,252,0.4);}',
            '.community-rank-value-big{font-size:17px;font-weight:900;font-family:monospace;color:var(--cosmic-cyan);text-shadow:0 0 8px rgba(0,240,255,0.5);line-height:1.1;}',
            '.community-rank-value-sub{font-size:8px;font-weight:normal;color:var(--text-sub);margin-top:2px;display:block;}'
        ].join('\n');
        (document.head || document.documentElement).appendChild(st);
    })();

    // ------------------------------------------------------------------
    // 【1】状態変数と日付・時間ヘルパー
    // ------------------------------------------------------------------
    window.__communityRankType = window.__communityRankType || 'level';   // level|score|time|flash
    window.__communityScoreMode = window.__communityScoreMode || 'ja2en'; // ja2en|en2ja|mixed
    window.__communityScoreDiff = window.__communityScoreDiff || 'endless'; // endless|normal|hard|expert
    window.__communityTimeRange = window.__communityTimeRange || 'total'; // total|weekly|daily

    window.__getTodayKey = function() {
        var d = new Date();
        return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    };
    window.__getWeekKey = function() {
        var d = new Date();
        var day = d.getDay();
        var diffToMonday = (day === 0 ? -6 : 1 - day);
        var monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday);
        return monday.getFullYear() + '-' + (monday.getMonth() + 1) + '-' + monday.getDate();
    };
    window.__formatStudyTime = function(secs) {
        var totalMin = Math.floor((secs || 0) / 60);
        if (totalMin >= 60) {
            var h = Math.floor(totalMin / 60);
            var m = totalMin % 60;
            return h + '時間' + (m > 0 ? m + '分' : '');
        }
        return totalMin + '分';
    };

    // ------------------------------------------------------------------
    // 【2】週間・1日プレイ時間のクラウド同期
    //     （勉強タイマーと同一の判定ロジックをミラーして毎秒加算）
    // ------------------------------------------------------------------
    window.__startCommunityStudyTimeSync = function() {
        if (window.__communityStudyTimeSyncStarted) return;
        window.__communityStudyTimeSyncStarted = true;
        setInterval(function() {
            var shouldCount = false;
            if (currentActiveTabId === 'vocab' || currentActiveTabId === 'reader') {
                shouldCount = true;
            } else if (currentActiveTabId === 'game') {
                var isFcardPlay = (document.getElementById('flashcard-play-screen') && document.getElementById('flashcard-play-screen').style.display === 'flex');
                var isSoloPlay = (document.getElementById('game-play-screen') && document.getElementById('game-play-screen').style.display === 'block');
                var isMultiPlay = (document.getElementById('multi-battle-play-screen') && document.getElementById('multi-battle-play-screen').style.display === 'flex');
                if (isFcardPlay || isSoloPlay || isMultiPlay) shouldCount = true;
            }
            if (window.__loadQuiz && window.__loadQuiz.active) shouldCount = true;

            var todayKey = window.__getTodayKey();
            if (userStats.study_today_date !== todayKey) {
                userStats.study_today_date = todayKey;
                userStats.study_today_secs = 0;
            }
            var weekKey = window.__getWeekKey();
            if (userStats.study_week_key !== weekKey) {
                userStats.study_week_key = weekKey;
                userStats.study_week_secs = 0;
            }
            if (shouldCount) {
                userStats.study_today_secs = (userStats.study_today_secs || 0) + 1;
                userStats.study_week_secs = (userStats.study_week_secs || 0) + 1;
            }
        }, 1000);
    };

    // ------------------------------------------------------------------
    // 【3】難易度別スコアのクラウド送信（エンドレスは既存の殿堂を使用）
    // ------------------------------------------------------------------
    window.submitDifficultyScore = async function(mode, difficulty, score) {
        if (!mode || !difficulty || difficulty === 'endless' || score <= 0) return;
        if (!myId || myId === 'GUEST-000') return;
        if (!window.db || !window.fbSetDoc || !window.fbDoc || !window.fbGetDoc) return;
        try {
            var ref = window.fbDoc(window.db, 'shared', 'game_hall_' + mode + '_' + difficulty);
            var snap = await window.fbGetDoc(ref);
            var scores = (snap.exists() && snap.data().scores) ? snap.data().scores : [];
            var existing = scores.find(function(s) { return s.id === myId; });
            var currentBest = existing ? existing.score : 0;
            if (score <= currentBest) return;
            var now = new Date();
            scores = scores.filter(function(s) { return s.id !== myId; });
            scores.push({ id: myId, name: myName, score: score, timestamp: now.getTime(), date: window.makeRankingDateStr(now) });
            scores = window.sortRankingScores(scores).slice(0, 20);
            await window.fbSetDoc(ref, { scores: scores, updatedAt: now.toISOString() }, { merge: true });
        } catch (e) {
            console.error('submitDifficultyScore error:', e);
        }
    };

    // ゲーム終了時にノーマル〜エキスパートのスコアも自動送信
    var __prevEndGameSessionForCommunityRank = window.endGameSession;
    window.endGameSession = async function() {
        var mode = selectedQuestionMode;
        var diff = currentGameDifficulty;
        var score = gameScoreCount;
        var r = __prevEndGameSessionForCommunityRank ? await __prevEndGameSessionForCommunityRank.apply(this, arguments) : undefined;
        if (diff !== 'endless' && score > 0) {
            try { await window.submitDifficultyScore(mode, diff, score); } catch (e) {}
        }
        return r;
    };

    // 起動時に既存のローカルベストを一度だけクラウドへ反映（自分の過去分も載る）
    window.__uploadMyLocalBestsOnce = async function() {
        if (!myId || myId === 'GUEST-000') return;
        try { if (localStorage.getItem('core_v4_local_bests_uploaded_' + myId)) return; } catch (e) {}
        var modes = ['ja2en', 'en2ja', 'mixed'];
        var diffs = ['normal', 'hard', 'expert'];
        for (var mi = 0; mi < modes.length; mi++) {
            for (var di = 0; di < diffs.length; di++) {
                var best = parseInt(localStorage.getItem('cosmic_best_' + modes[mi] + '_' + diffs[di]) || '0');
                if (best > 0) {
                    try { await window.submitDifficultyScore(modes[mi], diffs[di], best); } catch (e) {}
                }
            }
        }
        try { localStorage.setItem('core_v4_local_bests_uploaded_' + myId, '1'); } catch (e) {}
    };

    // ------------------------------------------------------------------
    // 【4】全ユーザー取得（レベルEXP・プレイ時間・フラッシュ回数つき）
    // ------------------------------------------------------------------
    window.__communityUsersCache = null;
    window.__communityUsersCacheAt = 0;
    window.__communityUsersLoadingPromise = null;
    window.fetchAllCommunityRankingUsers = async function() {
        var users = [];
        if (!window.db || !window.fbGetDoc || !window.fbDoc) return users;
        var allUsers = [];
        try { allUsers = await window.getAllUsers(); } catch (e) {}
        var ids = [];
        (allUsers || []).forEach(function(u) {
            if (u && u.id && u.id !== 'GUEST-000' && ids.indexOf(u.id) === -1) ids.push(u.id);
        });
        if (myId && myId !== 'GUEST-000' && ids.indexOf(myId) === -1) ids.push(myId);
        for (var i = 0; i < ids.length; i++) {
            var id = ids[i];
            try {
                var ref = window.fbDoc(window.db, 'users', id);
                var snap = await window.fbGetDoc(ref);
                if (!snap.exists()) continue;
                var d = snap.data();
                if (d.deleted) continue;
                var stats = d.userStats || {};
                var exp = parseInt(d.totalExp) || 0;
                var name = d.playerName || '';
                if (!name) {
                    var basic = (allUsers || []).find(function(u) { return u.id === id; });
                    name = basic ? (basic.playerName || basic.realName || '修行者') : '修行者';
                }
                users.push({
                    id: id, name: name, title: d.selectedTitle || '称号なし',
                    exp: exp, lvl: window.computeLevelSafe(exp),
                    customAvatar: (typeof d.avatar === 'string') ? d.avatar : '',
                    isMe: id === myId,
                    flash_count: parseInt(stats.flash_count) || 0,
                    study_total_secs: parseInt(stats.study_total_secs) || 0,
                    study_today_secs: parseInt(stats.study_today_secs) || 0,
                    study_today_date: stats.study_today_date || '',
                    study_week_secs: parseInt(stats.study_week_secs) || 0,
                    study_week_key: stats.study_week_key || ''
                });
            } catch (e) {}
        }
        return users;
    };

    // ------------------------------------------------------------------
    // 【5】ランキング行の共通ビルダー（順位色・アバター・名前・称号・右側数値）
    // ------------------------------------------------------------------
    window.__buildCommunityRankRow = function(u, idx, valueHtml) {
        var rankColor = idx === 0 ? '#FBBF24' : idx === 1 ? '#94A3B8' : idx === 2 ? '#D97706' : '#FFFFFF';
        var bgStyle = u.isMe ? 'background: linear-gradient(90deg, rgba(0, 240, 255, 0.15) 0%, rgba(15, 23, 42, 0.6) 100%); border: 1px solid var(--cosmic-cyan);' : 'background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);';
        var avatarStr = '<span style="font-size:16px;">👤</span>';
        if (u.customAvatar) avatarStr = '<img src="' + u.customAvatar + '" style="width:24px; height:24px; border-radius:50%; object-fit:cover; border:1px solid var(--cosmic-cyan);">';
        return '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; border-radius:8px; margin-bottom:4px; ' + bgStyle + ' font-size:12px;">' +
            '<div style="display:flex; align-items:center; gap:10px;">' +
            '<span style="color:' + rankColor + '; font-weight:900; font-size:14px; width:18px; text-align:center;">' + (idx + 1) + '</span>' +
            '<div style="width:24px; height:24px; display:flex; align-items:center; justify-content:center;">' + avatarStr + '</div>' +
            '<div><div style="font-weight:bold; color:white;">' + u.name + '</div>' +
            '<div style="font-size:9px; color:var(--text-sub); margin-top:1px;">' + u.title + '</div></div>' +
            '</div>' +
            '<div style="text-align:right;">' + valueHtml + '</div></div>';
    };

    // ------------------------------------------------------------------
    // 【6】各ランキングの描画
    // ------------------------------------------------------------------
    window.drawCommunityLevelRanking = function(container, users) {
        users.sort(function(a, b) {
            if (b.lvl !== a.lvl) return b.lvl - a.lvl;
            return b.exp - a.exp;
        });
        var html = '';
        users.slice(0, 50).forEach(function(u, idx) {
            html += window.__buildCommunityRankRow(u, idx,
                '<div class="community-rank-value-big">Lv.' + u.lvl + '</div>' +
                '<span class="community-rank-value-sub">' + u.exp + ' EXP</span>');
        });
        container.innerHTML = html;
    };

    window.drawCommunityTimeRanking = function(container, users) {
        var range = window.__communityTimeRange;
        var todayKey = window.__getTodayKey();
        var weekKey = window.__getWeekKey();
        var getValue = function(u) {
            if (range === 'total') return u.study_total_secs || 0;
            if (range === 'daily') return (u.study_today_date === todayKey) ? (u.study_today_secs || 0) : 0;
            if (range === 'weekly') return (u.study_week_key === weekKey) ? (u.study_week_secs || 0) : 0;
            return 0;
        };
        var rows = users.map(function(u) { return { u: u, val: getValue(u) }; });
        rows.sort(function(a, b) { return b.val - a.val; });
        var html = '';
        rows.slice(0, 50).forEach(function(row, idx) {
            html += window.__buildCommunityRankRow(row.u, idx,
                '<div class="community-rank-value-big">' + window.__formatStudyTime(row.val) + '</div>');
        });
        container.innerHTML = html;
    };

    window.drawCommunityFlashRanking = function(container, users) {
        users.sort(function(a, b) { return (b.flash_count || 0) - (a.flash_count || 0); });
        var html = '';
        users.slice(0, 50).forEach(function(u, idx) {
            html += window.__buildCommunityRankRow(u, idx,
                '<div class="community-rank-value-big">' + (u.flash_count || 0) + '<span style="font-size:9px; color:var(--text-sub); font-weight:normal;"> 回</span></div>');
        });
        container.innerHTML = html;
    };

    window.__communityScoreCache = {};
    window.__communityScoreCacheAt = {};
    window.drawCommunityScoreRanking = async function(container) {
        var mode = window.__communityScoreMode;
        var diff = window.__communityScoreDiff;
        var docName = (diff === 'endless') ? ('game_hall_' + mode) : ('game_hall_' + mode + '_' + diff);
        var cacheKey = mode + '_' + diff;
        var now = Date.now();

        var scores = null;
        if (window.__communityScoreCache[cacheKey] && (now - window.__communityScoreCacheAt[cacheKey] < 30000)) {
            scores = window.__communityScoreCache[cacheKey];
        } else {
            container.innerHTML = '<div style="color:var(--text-sub); font-size:12px; text-align:center; padding:12px;">ランキングを取得中...</div>';
            scores = [];
            if (window.db && window.fbGetDoc && window.fbDoc) {
                try {
                    var ref = window.fbDoc(window.db, 'shared', docName);
                    var snap = await window.fbGetDoc(ref);
                    if (snap.exists() && snap.data().scores) scores = window.sortRankingScores(snap.data().scores);
                } catch (e) {}
            }
            if (scores.length === 0) {
                var localBest = parseInt(localStorage.getItem('cosmic_best_' + mode + '_' + diff) || '0');
                if (localBest > 0 && myId && myId !== 'GUEST-000') {
                    scores = [{ id: myId, name: myName, score: localBest, date: 'ローカル記録', timestamp: 0 }];
                }
            }
            window.__communityScoreCache[cacheKey] = scores;
            window.__communityScoreCacheAt[cacheKey] = now;
        }

        if (scores.length === 0) {
            var modeLabel = (mode === 'ja2en') ? '和訳' : (mode === 'en2ja') ? '英訳' : 'まぜ';
            var diffLabel = (diff === 'endless') ? 'エンドレス' : (diff === 'normal') ? 'ノーマル' : (diff === 'hard') ? 'ハード' : 'エキスパート';
            container.innerHTML = '<div style="color:var(--text-sub); font-size:12px; text-align:center; padding:12px;">' + modeLabel + '・' + diffLabel + ' のランキングはまだありません。</div>';
            return;
        }
        var html = '';
        scores.forEach(function(record, index) {
            html += window.buildRankingRowHtml(record, index);
        });
        container.innerHTML = html;
    };

    // ------------------------------------------------------------------
    // 【7】セレクターUI（スワイプ式ピル）
    // ------------------------------------------------------------------
    window.__findCommunityRankHeading = function() {
        var section = document.getElementById('leaderboardSection');
        if (!section) return null;
        var candidates = section.querySelectorAll('h1, h2, h3, h4, div, span, p');
        for (var i = 0; i < candidates.length; i++) {
            var el = candidates[i];
            var txt = el.textContent || '';
            if (txt.indexOf('EXPランキング') !== -1) {
                var children = el.querySelectorAll('h1,h2,h3,h4,div,span,p');
                var hasChildWithText = false;
                for (var j = 0; j < children.length; j++) {
                    if ((children[j].textContent || '').indexOf('EXPランキング') !== -1) { hasChildWithText = true; break; }
                }
                if (!hasChildWithText) return el;
            }
        }
        return null;
    };

    window.injectCommunityRankingUI = function() {
        var container = document.getElementById('leaderboardContainer');
        if (!container || !container.parentNode) return;
        if (document.getElementById('communityRankingControls')) {
            if (!window.__communityRankHeadingEl) window.__communityRankHeadingEl = window.__findCommunityRankHeading();
            return;
        }
        var ctrl = document.createElement('div');
        ctrl.id = 'communityRankingControls';
        ctrl.style.cssText = 'margin-bottom:10px;';
        var mainScroller = document.createElement('div');
        mainScroller.id = 'communityRankMainScroller';
        mainScroller.className = 'community-rank-scroller';
        ctrl.appendChild(mainScroller);
        var subContainer = document.createElement('div');
        subContainer.id = 'communityRankSubContainer';
        ctrl.appendChild(subContainer);
        container.parentNode.insertBefore(ctrl, container);

        // タッチ分離：ピル上のスワイプをコミュニティ画面の左右タブ切替に伝えない
        ['touchstart', 'touchmove'].forEach(function(evt) {
            ctrl.addEventListener(evt, function(e) { e.stopPropagation(); }, { passive: true });
        });

        window.__communityRankHeadingEl = window.__findCommunityRankHeading();
        window.renderCommunityRankPills();
    };

    window.renderCommunityRankPills = function() {
        var scroller = document.getElementById('communityRankMainScroller');
        if (!scroller) return;
        var types = [
            { key: 'level', label: '🏆 レベル' },
            { key: 'score', label: '🎯 シングルスコア' },
            { key: 'time', label: '⏱️ プレイ時間' },
            { key: 'flash', label: '🃏 フラッシュ' }
        ];
        var html = '';
        types.forEach(function(t) {
            var active = (window.__communityRankType === t.key);
            html += '<button type="button" class="community-rank-pill' + (active ? ' community-rank-pill-active' : '') + '" data-rank-type="' + t.key + '">' + t.label + '</button>';
        });
        scroller.innerHTML = html;
        var pills = scroller.querySelectorAll('.community-rank-pill');
        for (var i = 0; i < pills.length; i++) {
            pills[i].onclick = function() {
                window.__communityRankType = this.getAttribute('data-rank-type');
                window.renderCommunityRankPills();
                window.renderCommunityRankSubPills();
                window.renderLeaderboard(false);
            };
        }
        var headingTexts = {
            level: '🏆 レベルランキング（自分と全ユーザー）',
            score: '🎯 シングルプレイスコアランキング',
            time: '⏱️ プレイ時間ランキング',
            flash: '🃏 フラッシュスワイプ回数ランキング'
        };
        if (window.__communityRankHeadingEl) {
            window.__communityRankHeadingEl.textContent = headingTexts[window.__communityRankType] || '修行者ランキング';
        }
        window.renderCommunityRankSubPills();
    };

    window.renderCommunityRankSubPills = function() {
        var subContainer = document.getElementById('communityRankSubContainer');
        if (!subContainer) return;
        var type = window.__communityRankType;
        var html = '';
        if (type === 'score') {
            var modes = [
                { key: 'ja2en', label: '和訳' },
                { key: 'en2ja', label: '英訳' },
                { key: 'mixed', label: 'まぜ' }
            ];
            html += '<div class="community-rank-subrow">';
            modes.forEach(function(m) {
                var active = (window.__communityScoreMode === m.key);
                html += '<button type="button" class="community-rank-subpill' + (active ? ' community-rank-subpill-active' : '') + '" data-score-mode="' + m.key + '">' + m.label + '</button>';
            });
            html += '</div>';
            var diffs = [
                { key: 'endless', label: 'エンドレス' },
                { key: 'normal', label: 'ノーマル' },
                { key: 'hard', label: 'ハード' },
                { key: 'expert', label: 'エキスパート' }
            ];
            html += '<div class="community-rank-subrow">';
            diffs.forEach(function(d) {
                var active = (window.__communityScoreDiff === d.key);
                html += '<button type="button" class="community-rank-subpill' + (active ? ' community-rank-subpill-active' : '') + '" data-score-diff="' + d.key + '">' + d.label + '</button>';
            });
            html += '</div>';
        } else if (type === 'time') {
            var ranges = [
                { key: 'total', label: '総計' },
                { key: 'weekly', label: '週間' },
                { key: 'daily', label: '1日' }
            ];
            html += '<div class="community-rank-subrow">';
            ranges.forEach(function(r) {
                var active = (window.__communityTimeRange === r.key);
                html += '<button type="button" class="community-rank-subpill' + (active ? ' community-rank-subpill-active' : '') + '" data-time-range="' + r.key + '">' + r.label + '</button>';
            });
            html += '</div>';
        }
        subContainer.innerHTML = html;

        var bind = function(selector, attr, stateKey) {
            var els = subContainer.querySelectorAll(selector);
            for (var i = 0; i < els.length; i++) {
                els[i].onclick = function() {
                    window[stateKey] = this.getAttribute(attr);
                    window.renderCommunityRankSubPills();
                    window.renderLeaderboard(false);
                };
            }
        };
        bind('[data-score-mode]', 'data-score-mode', '__communityScoreMode');
        bind('[data-score-diff]', 'data-score-diff', '__communityScoreDiff');
        bind('[data-time-range]', 'data-time-range', '__communityTimeRange');
    };

    // ------------------------------------------------------------------
    // 【8】renderLeaderboard 上書き（新ランキングUI）
    // ------------------------------------------------------------------
    window.renderLeaderboard = async function(force) {
        var container = document.getElementById('leaderboardContainer');
        if (!container) return;
        if (typeof myId === 'undefined' || myId === 'GUEST-000') {
            container.innerHTML = '<div style="color:var(--text-sub); font-size:12px; text-align:center; padding:12px;">ゲストはランキング対象外です。</div>';
            return;
        }
        var lvlData = window.calculateLevelFromExp(totalExp);
        userStats.user_level = lvlData.level;
        window.injectCommunityRankingUI();

        var type = window.__communityRankType;
        if (type === 'score') {
            await window.drawCommunityScoreRanking(container);
            return;
        }

        var selfAvatar = localStorage.getItem('core_v4_user_avatar_' + myId) || '';
        var selfUser = {
            id: myId, name: myName + ' (あなた)', title: selectedTitle,
            exp: totalExp, lvl: lvlData.level, customAvatar: selfAvatar, isMe: true,
            flash_count: userStats.flash_count || 0,
            study_total_secs: userStats.study_total_secs || 0,
            study_today_secs: userStats.study_today_secs || 0,
            study_today_date: window.__getTodayKey(),
            study_week_secs: userStats.study_week_secs || 0,
            study_week_key: window.__getWeekKey()
        };

        var now = Date.now();
        var cacheValid = window.__communityUsersCache && (now - window.__communityUsersCacheAt < 60000);
        var remoteUsers;
        if (cacheValid && !force) {
            remoteUsers = window.__communityUsersCache;
        } else {
            container.innerHTML = '<div style="color:var(--text-sub); font-size:12px; text-align:center; padding:12px;">ランキングを取得中...</div>';
            try {
                if (!window.__communityUsersLoadingPromise) {
                    window.__communityUsersLoadingPromise = window.fetchAllCommunityRankingUsers()
                        .then(function(users) { window.__communityUsersCache = users; window.__communityUsersCacheAt = Date.now(); return users; })
                        .finally(function() { window.__communityUsersLoadingPromise = null; });
                }
                remoteUsers = await window.__communityUsersLoadingPromise;
            } catch (e) {
                remoteUsers = [];
            }
        }

        var users = (remoteUsers || []).filter(function(u) { return u.id !== myId; }).map(function(u) { return Object.assign({}, u); });
        users.push(selfUser);

        if (type === 'level') window.drawCommunityLevelRanking(container, users);
        else if (type === 'time') window.drawCommunityTimeRanking(container, users);
        else if (type === 'flash') window.drawCommunityFlashRanking(container, users);
    };

    // ------------------------------------------------------------------
    // 【9】loadLocalState 接続
    // ------------------------------------------------------------------
    var __prevLoadLocalStateForCommunityRank = window.loadLocalState;
    window.loadLocalState = async function() {
        var r = __prevLoadLocalStateForCommunityRank ? await __prevLoadLocalStateForCommunityRank.apply(this, arguments) : undefined;
        try {
            window.__startCommunityStudyTimeSync();
            window.__uploadMyLocalBestsOnce();
            window.injectCommunityRankingUI();
        } catch (e) {
            console.error('コミュニティランキングパッチ初期化エラー:', e);
        }
        return r;
    };

    // ------------------------------------------------------------------
    // 【10】起動時注入
    // ------------------------------------------------------------------
    (function initCommunityRankingPatch() {
        function boot() {
            window.__startCommunityStudyTimeSync();
            window.injectCommunityRankingUI();
        }
        if (document.readyState !== 'loading') {
            setTimeout(boot, 400);
        } else {
            document.addEventListener('DOMContentLoaded', function() { setTimeout(boot, 400); });
        }
    })();

    console.log('🏆 第13回パッチ（フレンド欄ランキング強化：スワイプ式セレクター＋4種ランキング＋クラウド送信）適用完了');
})();
// ==========================================================================
// 🎨 第14回パッチ：フレンド欄ランキング 仕上げ
//    ① 下の重複カード（単語テスト ハイスコアランキング）をコミュニティ画面から削除
//       ※ゲームタブ側には一切触れない（#view-community 内に限定）
//    ② 「選択エリア」と「ランキングエリア」を別々の枠に分離
//    ③ ランキング枠を縦に拡張（スクロール付きで件数を多く表示）
//    ④ サブピル（意味/単語/まぜ ・ エンドレス/…/エキスパート）を中央揃え＝左右対称
//    ⑤ メインピルはスワイプ式を維持しつつ、選択中を中央へスッと寄せる
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
//    ※🏆 第13回パッチ適用済みが前提（未適用時は何もしません）
// ==========================================================================
(function applyCommunityRankFinishPatch() {
    if (window.__communityRankFinishApplied) return;
    window.__communityRankFinishApplied = true;

    // ------------------------------------------------------------------
    // 【0】パッチ専用スタイル（枠分離・左右対称・ランキング枠拡張・重複削除）
    // ------------------------------------------------------------------
    (function injectCommunityRankFinishCss() {
        if (document.getElementById('communityRankFinishCss')) return;
        var st = document.createElement('style');
        st.id = 'communityRankFinishCss';
        st.textContent = [
            // 外側の元カードを“器”だけにして透明化（内側の2枠を目立たせる）
            '#view-community .cr-outer-shell{background:transparent !important;border:none !important;box-shadow:none !important;padding:0 !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;}',
            // 選択エリアの枠（シアン発光）
            '#crSelectShell{border:1px solid rgba(0,240,255,0.32);background:rgba(7,11,25,0.5);border-radius:14px;padding:12px 12px 10px;margin-bottom:12px;box-shadow:0 0 16px rgba(0,240,255,0.12), inset 0 0 18px rgba(0,240,255,0.06);}',
            '#crSelectShell > *{margin-top:0;}',
            '#crSelectShell .community-rank-scroller{margin-top:8px;}',
            // ランキングエリアの枠（パープル発光）
            '#crRankShell{border:1px solid rgba(192,132,252,0.32);background:rgba(15,10,30,0.45);border-radius:14px;padding:8px;box-shadow:0 0 16px rgba(192,132,252,0.10), inset 0 0 18px rgba(192,132,252,0.05);}',
            // ランキングリストを縦に拡張＋スクロール
            '#crRankShell #leaderboardContainer{min-height:340px;max-height:62vh;overflow-y:auto;padding:2px 4px;-webkit-overflow-scrolling:touch;}',
            '#crRankShell #leaderboardContainer::-webkit-scrollbar{width:4px;}',
            '#crRankShell #leaderboardContainer::-webkit-scrollbar-track{background:transparent;}',
            '#crRankShell #leaderboardContainer::-webkit-scrollbar-thumb{background:rgba(192,132,252,0.4);border-radius:2px;}',
            // サブピルを中央揃え＝左右対称（詳細度を上げて確実に上書き）
            '#communityRankSubContainer .community-rank-subrow{justify-content:center;flex-wrap:wrap;}',
            // 下の重複カードをコミュニティ画面からのみ削除（:has 対応ブラウザ用）
            '#view-community .card:has(#leaderboardListContainer){display:none !important;}'
        ].join('\n');
        (document.head || document.documentElement).appendChild(st);
    })();

    // ------------------------------------------------------------------
    // 【1】見出し要素の取得（前回パッチの保持値 → 無ければ再探索）
    // ------------------------------------------------------------------
    function getHeadingEl() {
        if (window.__communityRankHeadingEl && document.body.contains(window.__communityRankHeadingEl)) {
            return window.__communityRankHeadingEl;
        }
        if (typeof window.__findCommunityRankHeading === 'function') {
            var h = window.__findCommunityRankHeading();
            if (h) { window.__communityRankHeadingEl = h; return h; }
        }
        return null;
    }

    // ------------------------------------------------------------------
    // 【2】選択エリア／ランキングエリアを別枠に分離（冪等）
    // ------------------------------------------------------------------
    window.__restructureCommunityRankLayout = function() {
        var ctrl = document.getElementById('communityRankingControls');
        var list = document.getElementById('leaderboardContainer');
        if (!ctrl || !list) return; // 第13回パッチ未適用なら何もしない
        if (document.getElementById('crSelectShell')) return; // 組替済み

        var heading = getHeadingEl();

        // 外側の元カードを透明な“器”にする
        var outerCard = (heading && heading.closest ? heading.closest('.card') : null) || (list.closest ? list.closest('.card') : null);
        if (outerCard) outerCard.classList.add('cr-outer-shell');

        // 選択枠・ランキング枠を作成
        var selectShell = document.createElement('div');
        selectShell.id = 'crSelectShell';
        var rankShell = document.createElement('div');
        rankShell.id = 'crRankShell';

        // 見出しがある場合：見出しの前に選択枠を挿入し、見出しとコントロールを収める
        if (heading && heading.parentNode) {
            heading.parentNode.insertBefore(selectShell, heading);
            selectShell.appendChild(heading);
        } else {
            // 見出しが取れなければコントロールの前に選択枠を挿入
            ctrl.parentNode.insertBefore(selectShell, ctrl);
        }
        if (ctrl.parentNode) selectShell.appendChild(ctrl);

        // リストをランキング枠で包む
        if (list.parentNode) {
            list.parentNode.insertBefore(rankShell, list);
            rankShell.appendChild(list);
        }
    };

    // ------------------------------------------------------------------
    // 【3】下の重複カードを非表示（:has 非対応ブラウザ用のJS保険）
    //     ※#view-community 内にあるものだけ＝ゲームタブには触れない
    // ------------------------------------------------------------------
    window.__hideDuplicateGameRankCard = function() {
        var lc = document.getElementById('leaderboardListContainer');
        if (!lc) return;
        var community = document.getElementById('view-community');
        if (!community) return;
        var card = lc.closest ? lc.closest('.card') : null;
        if (card && community.contains(card)) card.style.display = 'none';
    };

    // 両方をまとめて実行するヘルパー
    function applyFinishLayout() {
        try { window.__restructureCommunityRankLayout(); } catch (e) {}
        try { window.__hideDuplicateGameRankCard(); } catch (e) {}
    }

    // ------------------------------------------------------------------
    // 【4】renderLeaderboard 上書き：描画後に枠分離＋重複削除＋見出し再取得
    // ------------------------------------------------------------------
    var __prevRenderLeaderboardForFinish = window.renderLeaderboard;
    window.renderLeaderboard = async function() {
        var r = __prevRenderLeaderboardForFinish ? await __prevRenderLeaderboardForFinish.apply(this, arguments) : undefined;
        applyFinishLayout();
        return r;
    };

    // ------------------------------------------------------------------
    // 【5】renderCommunityRankPills 上書き：選択中のメインピルを中央へ寄せる
    //     （スワイプ式はそのまま。タップで選んだピルがスッと中央に）
    // ------------------------------------------------------------------
    var __prevRenderCommunityRankPillsForFinish = window.renderCommunityRankPills;
    if (typeof __prevRenderCommunityRankPillsForFinish === 'function') {
        window.renderCommunityRankPills = function() {
            var r = __prevRenderCommunityRankPillsForFinish.apply(this, arguments);
            setTimeout(function() {
                var sc = document.getElementById('communityRankMainScroller');
                if (!sc) return;
                var act = sc.querySelector('.community-rank-pill-active');
                if (act && typeof act.scrollIntoView === 'function') {
                    act.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
                }
            }, 60);
            return r;
        };
    }

    // ------------------------------------------------------------------
    // 【6】switchTab 上書き：コミュニティ切替時に確実にレイアウトを適用
    // ------------------------------------------------------------------
    var __prevSwitchTabForFinish = window.switchTab;
    window.switchTab = function(tabId) {
        var r = __prevSwitchTabForFinish ? __prevSwitchTabForFinish.apply(this, arguments) : undefined;
        if (tabId === 'community') {
            setTimeout(applyFinishLayout, 80);
            setTimeout(applyFinishLayout, 350);
        }
        return r;
    };

    // ------------------------------------------------------------------
    // 【7】起動時注入（第13回パッチのDOM生成を待つため遅延＋再試行）
    // ------------------------------------------------------------------
    (function initCommunityRankFinishPatch() {
        function boot() {
            applyFinishLayout();
            // 第13回パッチの描画より後にDOMが揃う場合の保険
            setTimeout(applyFinishLayout, 300);
            setTimeout(applyFinishLayout, 900);
        }
        if (document.readyState !== 'loading') {
            setTimeout(boot, 450);
        } else {
            document.addEventListener('DOMContentLoaded', function() { setTimeout(boot, 450); });
        }
    })();

    console.log('🎨 第14回パッチ（フレンド欄ランキング仕上げ：枠分離＋左右対称＋重複削除＋選択中央寄せ）適用完了');
})();
// ==========================================================================
// 📊 第15回パッチ：勉強時間グラフのログイン後“0分”現象を根治
//    ① 週間ログ(weeklyStudyMinutesLog)＋本日秒数(todayStudySeconds)を
//       クラウド(userStats)へ自動ミラー → ログインし直してもグラフが消えない
//    ② ログイン時にクラウドからグラフを復元（ローカルとクラウドを“大きい方”で
//       マージ＝巻き戻りしない／既存の曜日固定挙動は壊さない）
//    ③ 1分未満の勉強を「○秒」で表示（45秒が「0分」にならず「45秒」と出る）
//    ④ 棒の高さを“その週の最大値”基準に（ちょっと勉強した日でも棒がニョキッと立つ）
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
//    ※既存の勉強タイマーには一切触れません（別ミラーで値を写すだけ）
// ==========================================================================
(function applyStudyGraphSyncPatch() {
    if (window.__studyGraphSyncPatchApplied) return;
    window.__studyGraphSyncPatchApplied = true;
    
    // ------------------------------------------------------------------
    // ヘルパー①：今日の日付文字列（既存の生成規則 "Y-M-D" に完全一致）
    // ------------------------------------------------------------------
    function sgTodayStr() {
        var d = new Date();
        return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    }
    
    // ヘルパー②：日付文字列 "Y-M-D" → 曜日インデックス（0=月 … 6=日）
    //          既存 renderActivityChart の (getDay()-1, <0なら6) と同一
    // ------------------------------------------------------------------
    function sgDateToIdx(dateStr) {
        if (!dateStr) return -1;
        var p = String(dateStr).split('-');
        if (p.length < 3) return -1;
        var dt = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
        if (isNaN(dt.getTime())) return -1;
        var idx = dt.getDay() - 1;
        if (idx < 0) idx = 6;
        return idx;
    }
    
    // ヘルパー③：2つの日付文字列の日数差（b - a）。不正なら -1
    // ------------------------------------------------------------------
    function sgDaysBetween(aStr, bStr) {
        if (!aStr || !bStr) return -1;
        var pa = String(aStr).split('-'),
            pb = String(bStr).split('-');
        if (pa.length < 3 || pb.length < 3) return -1;
        var da = new Date(parseInt(pa[0], 10), parseInt(pa[1], 10) - 1, parseInt(pa[2], 10));
        var db = new Date(parseInt(pb[0], 10), parseInt(pb[1], 10) - 1, parseInt(pb[2], 10));
        if (isNaN(da.getTime()) || isNaN(db.getTime())) return -1;
        var ms = db.getTime() - da.getTime();
        return Math.round(ms / (1000 * 60 * 60 * 24));
    }
    
    function sgIsLoggedIn() {
        return (typeof myId !== 'undefined' && myId && myId !== 'GUEST-000');
    }
    
    // ------------------------------------------------------------------
    // 【1】ミラー：メモリ上のグラフデータを userStats へ写す
    //     （saveUserStats が userStats ごとクラウドへ運ぶ＝既存経路に乗せる）
    //     既存タイマーには触れない＝代入だけの軽量処理
    // ------------------------------------------------------------------
    window.__sgDirty = false;
    window.__sgMirrorToUserStats = function() {
        if (typeof userStats === 'undefined' || !userStats) return;
        try {
            var log = (typeof weeklyStudyMinutesLog !== 'undefined' && Array.isArray(weeklyStudyMinutesLog)) ?
                weeklyStudyMinutesLog.slice(0, 7) : [0, 0, 0, 0, 0, 0, 0];
            while (log.length < 7) log.push(0);
            userStats.study_weekly_log = log;
            userStats.study_today_secs = (typeof todayStudySeconds !== 'undefined') ? (parseInt(todayStudySeconds) || 0) : 0;
            userStats.study_last_date = (typeof lastAccessDateStr !== 'undefined') ? (lastAccessDateStr || '') : '';
            userStats.study_weekly_log_today_date = userStats.study_last_date;
            window.__sgDirty = true;
        } catch (e) {}
    };
    
    // ------------------------------------------------------------------
    // 【2】復元：クラウド(userStats)からグラフをメモリへ戻す
    //     ・ローカルとクラウドを“枠ごとに大きい方”でマージ（巻き戻り防止）
    //     ・7日以上前のクラウドログは“古い週の残骸”とみなし採用しない
    //     ・既存の曜日固定挙動は壊さない（週リセットは導入しない）
    // ------------------------------------------------------------------
    window.__sgRestoreFromCloud = function() {
        if (typeof userStats === 'undefined' || !userStats) return;
        var s = userStats;
        var todayStr = sgTodayStr();
        
        // 本日秒数：クラウドの最終日が“今日”なら大きい方を採用
        var cloudLastDate = s.study_last_date || s.study_weekly_log_today_date || '';
        var cloudTodaySecs = parseInt(s.study_today_secs) || 0;
        if (cloudLastDate === todayStr) {
            if (cloudTodaySecs > (parseInt(todayStudySeconds) || 0)) {
                todayStudySeconds = cloudTodaySecs;
            }
        }
        
        var cloudLog = Array.isArray(s.study_weekly_log) ? s.study_weekly_log : null;
        var cloudValid = cloudLog && cloudLog.length === 7 &&
            (cloudLastDate === '' || sgDaysBetween(cloudLastDate, todayStr) < 7);
        
        var localLog = (typeof weeklyStudyMinutesLog !== 'undefined' && Array.isArray(weeklyStudyMinutesLog)) ?
            weeklyStudyMinutesLog : [0, 0, 0, 0, 0, 0, 0];
        while (localLog.length < 7) localLog.push(0);
        
        var merged = localLog.slice(0, 7);
        if (cloudValid) {
            for (var i = 0; i < 7; i++) {
                var cv = parseFloat(cloudLog[i]) || 0;
                var lv = parseFloat(merged[i]) || 0;
                merged[i] = Math.max(lv, cv);
            }
            // クラウドの“最終日”が今日でない過去日で、その日の秒が残っている場合もその枠へ反映
            if (cloudLastDate && cloudLastDate !== todayStr && cloudTodaySecs > 0) {
                var cIdx = sgDateToIdx(cloudLastDate);
                if (cIdx >= 0 && sgDaysBetween(cloudLastDate, todayStr) < 7) {
                    merged[cIdx] = Math.max(merged[cIdx] || 0, cloudTodaySecs / 60);
                }
            }
        }
        
        // 今日の枠には“いまの本日秒数”を必ず反映（描画と整合）
        var todayIdx = sgDateToIdx(todayStr);
        if (todayIdx >= 0) {
            merged[todayIdx] = Math.max(merged[todayIdx] || 0, (parseInt(todayStudySeconds) || 0) / 60);
        }
        
        weeklyStudyMinutesLog = merged;
        
        // ローカルキャッシュも復元値で揃える
        try { localStorage.setItem('core_v4_study_weekly_log', JSON.stringify(weeklyStudyMinutesLog)); } catch (e) {}
        try { localStorage.setItem('core_v4_study_today_secs', String(parseInt(todayStudySeconds) || 0)); } catch (e) {}
        try { localStorage.setItem('core_v4_study_last_date', todayStr); } catch (e) {}
        
        // 復元直後に描画を更新（DOMが無ければ関数側でガードされる）
        try { if (typeof window.renderActivityChart === 'function') window.renderActivityChart(); } catch (e) {}
    };
    
    // ------------------------------------------------------------------
    // 【3】loadUserStats をラップ：クラウド読み込み“後”に復元
    //     （既存の全 loadUserStats 上書きが走り終わった後に実行される）
    // ------------------------------------------------------------------
    var __prevLoadUserStatsForStudyGraph = window.loadUserStats;
    window.loadUserStats = async function() {
        var r = __prevLoadUserStatsForStudyGraph ? await __prevLoadUserStatsForStudyGraph.apply(this, arguments) : undefined;
        try { window.__sgRestoreFromCloud(); } catch (e) { console.error('study graph restore error:', e); }
        return r;
    };
    
    // ------------------------------------------------------------------
    // 【4】renderActivityChart を上書き
    //     ・1分未満は「○秒」表示（0は「0分」）
    //     ・棒の高さは“その週の最大値”基準（少しの勉強でも棒が立つ）
    //     ・DOM構造は既存と完全同一（class/id 不変＝CSSそのまま）
    // ------------------------------------------------------------------
    window.renderActivityChart = function() {
        var chart = document.getElementById('activityBarChart');
        if (!chart) return;
        chart.innerHTML = "";
        
        var now = new Date();
        var currentDayIdx = now.getDay() - 1;
        if (currentDayIdx < 0) currentDayIdx = 6;
        
        var currentTodayMinutes = (parseInt(todayStudySeconds) || 0) / 60;
        if (Array.isArray(weeklyStudyMinutesLog)) {
            weeklyStudyMinutesLog[currentDayIdx] = currentTodayMinutes;
        }
        
        // その週の最大値を算出（0除算防止＆“少しでも立つ”ための下限 0.1）
        var maxMin = 0.1;
        for (var m = 0; m < 7; m++) {
            var v = parseFloat(weeklyStudyMinutesLog[m]) || 0;
            if (v > maxMin) maxMin = v;
        }
        
        var daysLabels = ["月", "火", "水", "木", "金", "土", "日"];
        daysLabels.forEach(function(d, idx) {
            var wrap = document.createElement('div');
            wrap.className = "bar-wrapper";
            wrap.style.cssText = "display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; flex: 1; min-width: 0;";
            
            var rawMin = parseFloat(weeklyStudyMinutesLog[idx]) || 0;
            
            // 棒の高さ：週最大値基準。勉強ゼロの日は既存踏襲の薄い4%、それ以外は相対
            var fillHeightPercent;
            if (rawMin <= 0) {
                fillHeightPercent = 4;
            } else {
                fillHeightPercent = Math.min(100, Math.max(4, Math.round((rawMin / maxMin) * 100)));
            }
            
            var fill = document.createElement('div');
            fill.className = "bar-fill active";
            fill.style.height = fillHeightPercent + "%";
            
            // ラベル：1分未満は秒、1分以上は分、0は0分
            var valLbl = document.createElement('div');
            valLbl.style.cssText = "font-size: 8px; font-weight: 700; color: #FFFFFF; margin-bottom: 2px; white-space: nowrap;";
            if (rawMin <= 0) {
                valLbl.innerText = "0分";
            } else if (rawMin < 1) {
                valLbl.innerText = Math.max(1, Math.round(rawMin * 60)) + "秒";
            } else {
                valLbl.innerText = Math.floor(rawMin) + "分";
            }
            
            var lbl = document.createElement('div');
            lbl.style.cssText = "font-size: 10px; color: var(--text-sub); margin-top: 4px; font-weight: bold;";
            lbl.innerText = d;
            
            wrap.appendChild(valLbl);
            wrap.appendChild(fill);
            wrap.appendChild(lbl);
            chart.appendChild(wrap);
        });
    };
    
    // ------------------------------------------------------------------
    // 【5】ミラーの定期実行＋ページ離脱時のフラッシュ保存
    //     ・5秒ごとにメモリ→userStats へ写す（軽い代入のみ）
    //     ・クラウド書き込みは既存の saveUserStats 経路に任せる＋
    //       ページ離脱時に dirty なら明示保存（勉強中に閉じても残る）
    // ------------------------------------------------------------------
    function sgStartMirrorLoop() {
        if (window.__sgMirrorLoopStarted) return;
        window.__sgMirrorLoopStarted = true;
        
        setInterval(function() {
            try { window.__sgMirrorToUserStats(); } catch (e) {}
        }, 5000);
        
        var flush = function() {
            if (!sgIsLoggedIn()) return;
            if (!window.__sgDirty) return;
            try { window.__sgMirrorToUserStats(); } catch (e) {}
            if (typeof window.saveUserStats === 'function') {
                try { window.saveUserStats(); } catch (e) {}
            }
            window.__sgDirty = false;
        };
        window.addEventListener('pagehide', flush);
        document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'hidden') flush();
        });
    }
    
    // ------------------------------------------------------------------
    // 【6】起動時接続
    // ------------------------------------------------------------------
    (function initStudyGraphSyncPatch() {
        function boot() {
            try { window.__sgMirrorToUserStats(); } catch (e) {}
            sgStartMirrorLoop();
            // ログイン済みなら念のため一度復元＋描画
            if (sgIsLoggedIn()) {
                try { window.__sgRestoreFromCloud(); } catch (e) {}
            }
        }
        if (document.readyState !== 'loading') {
            setTimeout(boot, 400);
        } else {
            document.addEventListener('DOMContentLoaded', function() { setTimeout(boot, 400); });
        }
    })();
    
    console.log('📊 第15回パッチ（勉強時間グラフ同期＋復元＋秒表示＋週最大値基準）適用完了');
})();
// ==========================================================================
// 📊 第16回パッチ：勉強時間グラフ“描画トリガー”根治
//    第15回パッチの取りこぼし2点を、既存コード0行変更で是正する
//    ① ホーム画面でもグラフを毎秒再描画（shouldCount 非依存ウォッチドッグ）
//       → 本日表示は育つのにグラフが全0で張り付く現象を解消
//    ② 日跨ぎリセットがクラウド復元値を潰すのを防止
//       → initStudyTimerAndDataRotation 実行“後”に復元を再実行
//    ③ ログイン直後の描画ズレを遅延キックで確実に上書き
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
//    ※第15回パッチ（__sgRestoreFromCloud / 上書き済み renderActivityChart）が
//      前提。無ければ各所で typeof ガードが効き、安全に何もしません
// ==========================================================================
(function applyStudyGraphTriggerPatch() {
    if (window.__studyGraphTriggerPatchApplied) return;
    window.__studyGraphTriggerPatchApplied = true;
    
    // ------------------------------------------------------------------
    // ヘルパー：今日の曜日インデックス（0=月 … 6=日／既存規則と同一）
    // ------------------------------------------------------------------
    function sgtTodayIdx() {
        var i = new Date().getDay() - 1;
        return i < 0 ? 6 : i;
    }
    
    // ヘルパー：メモリ上の“今日分”を週間ログへ反映してから描画
    //   （renderActivityChart 自身も今日分を代入するが、復元直後など
    //     値が揃う前に呼ばれても確実に反映させるための二重保険）
    function sgtReflectAndDraw() {
        try {
            var todayMin = (parseInt(todayStudySeconds) || 0) / 60;
            if (typeof weeklyStudyMinutesLog !== 'undefined' && Array.isArray(weeklyStudyMinutesLog)) {
                var idx = sgtTodayIdx();
                var cur = parseFloat(weeklyStudyMinutesLog[idx]) || 0;
                if (todayMin > cur) weeklyStudyMinutesLog[idx] = todayMin;
            }
        } catch (e) {}
        try {
            if (document.getElementById('activityBarChart') &&
                typeof window.renderActivityChart === 'function') {
                window.renderActivityChart();
            }
        } catch (e) {}
    }
    
    // ヘルパー：クラウド復元（第15回）が居れば叩く
    function sgtRestore() {
        try {
            if (typeof window.__sgRestoreFromCloud === 'function') {
                window.__sgRestoreFromCloud();
            }
        } catch (e) {}
    }
    
    // ------------------------------------------------------------------
    // 【1】initStudyTimerAndDataRotation をラップ
    //     既存処理（日跨ぎリセット含む）が走り終わった“後”に
    //     復元を再実行 → リセットに潰された todayStudySeconds を復活
    // ------------------------------------------------------------------
    var __prevInitStudyTimerForTrigger = window.initStudyTimerAndDataRotation;
    if (typeof __prevInitStudyTimerForTrigger === 'function') {
        window.initStudyTimerAndDataRotation = function() {
            var r = __prevInitStudyTimerForTrigger.apply(this, arguments);
            // 日跨ぎリセットが復元値を0に潰した可能性があるので再復元
            sgtRestore();
            sgtReflectAndDraw();
            return r;
        };
    }
    
    // ------------------------------------------------------------------
    // 【2】shouldCount 非依存ウォッチドッグ（1秒間隔）
    //     ホーム画面に居ても、毎秒“今日分を反映＋描画”を行う
    //     → 本日表示とグラフが常に同期し、棒がリアルタイムに立つ
    //     描画は7要素の軽い全置換＝既存の勉強中描画と競合しても
    //     同じ値を描くだけなのでチラつかない
    // ------------------------------------------------------------------
    if (!window.__sgtWatchdogStarted) {
        window.__sgtWatchdogStarted = true;
        setInterval(function() {
            // ログイン済み・ゲスト問わず描画してズレを防ぐ
            sgtReflectAndDraw();
        }, 1000);
    }
    
    // ------------------------------------------------------------------
    // 【3】loadLocalState をラップ：完了後に遅延キック
    //     ブートストラップ末尾の renderActivityChart は復元“前”に走るため
    //     全0を描いてしまう。復元“後”に遅延で上書きし直す
    // ------------------------------------------------------------------
    var __prevLoadLocalStateForTrigger = window.loadLocalState;
    if (typeof __prevLoadLocalStateForTrigger === 'function') {
        window.loadLocalState = async function() {
            var r = await __prevLoadLocalStateForTrigger.apply(this, arguments);
            var kick = function() { sgtRestore();
                sgtReflectAndDraw(); };
            setTimeout(kick, 300);
            setTimeout(kick, 900);
            setTimeout(kick, 1800);
            return r;
        };
    }
    
    // ------------------------------------------------------------------
    // 【4】起動時：DOM揃い次第すぐに1回描画（保険）
    // ------------------------------------------------------------------
    (function initStudyGraphTriggerPatch() {
        function boot() {
            sgtRestore();
            sgtReflectAndDraw();
        }
        if (document.readyState !== 'loading') {
            setTimeout(boot, 500);
        } else {
            document.addEventListener('DOMContentLoaded', function() { setTimeout(boot, 500); });
        }
    })();
    
    console.log('📊 第16回パッチ（勉強時間グラフ描画トリガー根治：ホーム毎秒描画＋復元再実行＋遅延キック）適用完了');
})();
// ==========================================================================
// ⏱️ 第17回パッチ：プレイ時間ランキングの整合性根治（週間 < 今日 の矛盾を撲滅）
//    症状：ランキングの「1日」が「週間」より大きい（論理上ありえない逆転）
//    原因：study_today_secs と study_week_secs が別経路で刻まれ、ズレたまま
//          クラウドへ保存／復元されるため、週間カウンタが今日の分を含まない
//    根治：① 描画時に全ユーザー分を「週間＝max(週間, 今日)」「総計＝max(総計, 週間)」
//             で強制補正 → 逆転を物理的に不可能化
//          ② 毎秒ウォッチドッグで“自分”の userStats を同じルールで整合＋
//             古い週キーの残骸を今週へ正規化 → 次回保存でクラウドも整合
//          ③ ログイン復元直後にも整合を1回実行
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
//    ※🏆 第13回(コミュニティランキング)・📊 第15回(グラフ同期) 適用済みが前提。
//      未適用の関数は typeof ガードで安全にスキップします
// ==========================================================================
(function applyPlayTimeConsistencyPatch() {
    if (window.__playTimeConsistencyApplied) return;
    window.__playTimeConsistencyApplied = true;

    // ------------------------------------------------------------------
    // ヘルパー：日付キー／週キー／時間フォーマット（第13回があればそれを使い、
    //          無ければ同一ロジックのフォールバックを使う＝自己完結）
    // ------------------------------------------------------------------
    function ptcTodayKey() {
        if (typeof window.__getTodayKey === 'function') return window.__getTodayKey();
        var d = new Date();
        return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    }
    function ptcWeekKey() {
        if (typeof window.__getWeekKey === 'function') return window.__getWeekKey();
        var d = new Date();
        var day = d.getDay();
        var diff = (day === 0 ? -6 : 1 - day);
        var m = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
        return m.getFullYear() + '-' + (m.getMonth() + 1) + '-' + m.getDate();
    }
    function ptcFmt(secs) {
        if (typeof window.__formatStudyTime === 'function') return window.__formatStudyTime(secs);
        var t = Math.floor((secs || 0) / 60);
        if (t >= 60) { var h = Math.floor(t / 60); var mm = t % 60; return h + '時間' + (mm > 0 ? mm + '分' : ''); }
        return t + '分';
    }
    function ptcIsSelf(u) { return !!(u && u.isMe === true); }

    // ------------------------------------------------------------------
    // 核心：1ユーザーの range 別値を“矛盾なく”算出
    //   ・daily  = 今日キー一致なら today_secs（自分はグローバル実測も取り込む）
    //   ・weekly = 今週キー一致なら week_secs をベースにし、必ず daily 以上にする
    //              今週キー不一致（前週の残骸）ならベース0 → daily だけ採用
    //   ・total  = 必ず weekly 以上にする
    //   → これで weekly < daily は構造的に発生しない
    // ------------------------------------------------------------------
    function ptcValue(u, range) {
        var todayKey = ptcTodayKey();
        var weekKey = ptcWeekKey();
        var todaySecs = parseInt(u.study_today_secs) || 0;
        // 自分はメモリ上の実測 todayStudySeconds も加味（復元ズレを吸収）
        if (ptcIsSelf(u) && typeof todayStudySeconds !== 'undefined') {
            var live = parseInt(todayStudySeconds) || 0;
            if ((u.study_today_date || '') === todayKey || !u.study_today_date) {
                if (live > todaySecs) todaySecs = live;
            }
        }
        var daily = ((u.study_today_date || '') === todayKey) ? todaySecs : 0;
        var weeklyBase = ((u.study_week_key || '') === weekKey) ? (parseInt(u.study_week_secs) || 0) : 0;
        var weekly = Math.max(weeklyBase, daily);   // ★ 週間は今日を必ず内包
        var total = Math.max(parseInt(u.study_total_secs) || 0, weekly); // ★ 総計は週間を必ず内包
        if (range === 'daily') return daily;
        if (range === 'weekly') return weekly;
        return total;
    }

    // ------------------------------------------------------------------
    // 自分自身の userStats を同じルールで整合（毎秒）
    //   ・古い週キーの残骸を今週へ正規化（study_week_key を今週に上書き）
    //   ・グローバル todayStudySeconds も整合値に揃えて表示の一貫性を確保
    // ------------------------------------------------------------------
    function ptcEnforceSelf() {
        if (typeof userStats === 'undefined' || !userStats) return;
        var todayKey = ptcTodayKey();
        var weekKey = ptcWeekKey();
        var live = (typeof todayStudySeconds !== 'undefined') ? (parseInt(todayStudySeconds) || 0) : 0;

        var ts = parseInt(userStats.study_today_secs) || 0;
        if ((userStats.study_today_date || '') === todayKey || !userStats.study_today_date) {
            if (live > ts) ts = live;
        }
        var daily = ((userStats.study_today_date || '') === todayKey) ? ts : 0;

        var weeklyBase = ((userStats.study_week_key || '') === weekKey) ? (parseInt(userStats.study_week_secs) || 0) : 0;
        var weekly = Math.max(weeklyBase, daily);   // 前週残骸は base0 → 今週は daily から再出発

        var total = Math.max(parseInt(userStats.study_total_secs) || 0, weekly);

        userStats.study_today_secs = ts;
        userStats.study_week_secs = weekly;
        userStats.study_total_secs = total;
        if (!userStats.study_today_date) userStats.study_today_date = todayKey;
        userStats.study_week_key = weekKey; // ★ 今週へ正規化（残骸を消す）

        if (typeof todayStudySeconds !== 'undefined' && ts > todayStudySeconds) {
            todayStudySeconds = ts;
        }
    }

    // ------------------------------------------------------------------
    // drawCommunityTimeRanking 上書き：補正済み値で描画（自分も他者も）
    // ------------------------------------------------------------------
    window.drawCommunityTimeRanking = function(container, users) {
        if (!container) return;
        // 第13回の行ビルダーが無い環境では安全に終了（描画は第13回に依存）
        if (typeof window.__buildCommunityRankRow !== 'function') return;
        var range = window.__communityTimeRange || 'total';
        var rows = (users || []).map(function(u) { return { u: u, val: ptcValue(u, range) }; });
        rows.sort(function(a, b) { return b.val - a.val; });
        var html = '';
        rows.slice(0, 50).forEach(function(row, idx) {
            html += window.__buildCommunityRankRow(row.u, idx,
                '<div class="community-rank-value-big">' + ptcFmt(row.val) + '</div>');
        });
        container.innerHTML = html;
    };

    // ------------------------------------------------------------------
    // 毎秒ウォッチドッグ（自分の整合。増やす方向の単調補正なので
    //   第13回の sync ループ／第15回のミラーと競合しない）
    // ------------------------------------------------------------------
    if (!window.__ptcWatchdogStarted) {
        window.__ptcWatchdogStarted = true;
        setInterval(function() {
            try { ptcEnforceSelf(); } catch (e) {}
        }, 1000);
    }

    // ------------------------------------------------------------------
    // loadUserStats ラップ：クラウド復元“後”に整合を1回実行
    // ------------------------------------------------------------------
    var __prevLoadUserStatsForPtc = window.loadUserStats;
    window.loadUserStats = async function() {
        var r = __prevLoadUserStatsForPtc ? await __prevLoadUserStatsForPtc.apply(this, arguments) : undefined;
        try { ptcEnforceSelf(); } catch (e) {}
        return r;
    };

    // ------------------------------------------------------------------
    // 起動時：DOM／変数揃い次第1回整合
    // ------------------------------------------------------------------
    (function initPlayTimeConsistencyPatch() {
        function boot() { try { ptcEnforceSelf(); } catch (e) {} }
        if (document.readyState !== 'loading') {
            setTimeout(boot, 500);
        } else {
            document.addEventListener('DOMContentLoaded', function() { setTimeout(boot, 500); });
        }
    })();

    console.log('⏱️ 第17回パッチ（プレイ時間整合：週間≧今日・総計≧週間 を構造で保証）適用完了');
})();
    // ==========================================================================
// 📋 第16回パッチ：長文リーダー「登録単語トレー」
//    英文を解析した瞬間、その長文に含まれる“単語帳登録済みの語”を自動で拾い、
//    英文の直下に「📋 この長文の登録単語」トレーを生成する。
//    ・登場順・同一語は1行に集約
//    ・各語の意味ごとに ⚪︎/△/✕/ー をその場でチェック（単語帳と完全同期）
//    ・チェックすれば英文内の語の色もリアルタイムで追従
//    ・登録語が0語ならトレー自体を出さない／1語以上なら最初から展開
//    ・見出しタップで開閉（なめらかに伸縮）
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
//    ※analyzeText をラップするだけ＝既存の解析・和訳・本棚保存は一切不変
// ==========================================================================
(function applyReaderVocabTrainerPatch() {
    if (window.__readerVocabTrainerApplied) return;
    window.__readerVocabTrainerApplied = true;

    // ------------------------------------------------------------------
    // 【0】パッチ専用スタイル（コズミック発光・出現モーション・生きたフィードバック）
    // ------------------------------------------------------------------
    (function injectReaderTrainerCss() {
        if (document.getElementById('readerTrainerCss')) return;
        var st = document.createElement('style');
        st.id = 'readerTrainerCss';
        st.textContent = [
            /* トレー外枠 */
            '#readerVocabTrainerCard{margin:18px 0 4px 0;border:1px solid rgba(0,240,255,0.30);border-radius:14px;background:linear-gradient(160deg, rgba(7,11,25,0.55) 0%, rgba(20,15,45,0.45) 100%);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 6px 22px rgba(0,0,0,0.35), inset 0 0 22px rgba(0,240,255,0.05);overflow:hidden;}',
            /* 見出し（タップで開閉） */
            '.rvt-head{display:flex;align-items:center;gap:10px;padding:13px 15px;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;background:linear-gradient(90deg, rgba(0,240,255,0.10), rgba(192,132,252,0.06));transition:background .2s ease;}',
            '.rvt-head:active{background:linear-gradient(90deg, rgba(0,240,255,0.20), rgba(192,132,252,0.12));}',
            '.rvt-head-ico{width:30px;height:30px;flex-shrink:0;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:15px;background:rgba(0,240,255,0.12);border:1px solid rgba(0,240,255,0.35);box-shadow:0 0 10px rgba(0,240,255,0.25);}',
            '.rvt-head-title{flex:1;min-width:0;font-size:13px;font-weight:900;color:#fff;letter-spacing:.4px;text-shadow:0 0 8px rgba(0,240,255,0.35);}',
            '.rvt-head-sub{display:block;font-size:9.5px;font-weight:700;color:var(--text-sub);letter-spacing:.3px;margin-top:2px;text-shadow:none;}',
            '.rvt-count{flex-shrink:0;font-size:11px;font-weight:900;color:#06121f;background:linear-gradient(135deg, var(--cosmic-cyan), var(--cosmic-purple-light));padding:3px 10px;border-radius:20px;box-shadow:0 0 10px rgba(0,240,255,0.45);}',
            '.rvt-chev{flex-shrink:0;color:var(--cosmic-cyan);font-size:12px;font-weight:900;transition:transform .3s cubic-bezier(0.25,1,0.5,1);}',
            '#readerVocabTrainerCard.rvt-open .rvt-chev{transform:rotate(180deg);}',
            /* 本文（伸縮） */
            '.rvt-body{max-height:0;overflow:hidden;transition:max-height .4s cubic-bezier(0.25,1,0.5,1);}',
            '#readerVocabTrainerCard.rvt-open .rvt-body{max-height:4000px;}',
            '.rvt-body-inner{padding:6px 12px 14px 12px;display:flex;flex-direction:column;gap:9px;}',
            /* 1語カード */
            '.rvt-word{border:1px solid rgba(255,255,255,0.12);border-radius:11px;background:rgba(255,255,255,0.04);padding:10px 12px;transition:border-color .2s ease, box-shadow .2s ease, transform .2s ease;animation:rvtRowIn .4s cubic-bezier(0.25,1,0.5,1) both;}',
            '.rvt-word:hover{border-color:rgba(0,240,255,0.4);box-shadow:0 0 12px rgba(0,240,255,0.18);}',
            '@keyframes rvtRowIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}',
            '.rvt-word-head{display:flex;align-items:center;gap:8px;margin-bottom:8px;}',
            '.rvt-word-num{font-size:10px;font-weight:800;color:var(--text-sub);background:rgba(255,255,255,0.08);padding:2px 7px;border-radius:5px;flex-shrink:0;}',
            '.rvt-word-en{font-family:"Times New Roman",serif;font-size:17px;font-weight:800;color:#fff;text-shadow:0 0 8px rgba(0,240,255,0.3);word-break:break-word;}',
            /* 意味行 */
            '.rvt-meaning-row{display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px dashed rgba(255,255,255,0.10);}',
            '.rvt-meaning-row:first-of-type{border-top:none;}',
            '.rvt-meaning-text{flex:1;min-width:0;font-size:12.5px;color:rgba(226,232,240,0.92);line-height:1.45;word-break:break-word;}',
            '.rvt-btns{display:flex;gap:4px;flex-shrink:0;}',
            '.rvt-btn{width:25px;height:25px;border-radius:50%;border:1px solid rgba(255,255,255,0.3);background:rgba(0,0,0,0.5);color:#fff;font-size:10px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .12s ease, box-shadow .15s ease, background .15s ease;-webkit-tap-highlight-color:transparent;}',
            '.rvt-btn:active{transform:scale(0.82);}',
            '.rvt-btn.rvt-on{animation:rvtPop .3s cubic-bezier(0.25,1.4,0.5,1);}',
            '@keyframes rvtPop{0%{transform:scale(0.7);}60%{transform:scale(1.18);}100%{transform:scale(1);}}',
            '.rvt-btn[data-st="ok"].rvt-active{background:var(--word-ok);color:#000;box-shadow:0 0 9px rgba(16,185,129,0.6);border-color:var(--word-ok);}',
            '.rvt-btn[data-st="so"].rvt-active{background:var(--word-so);color:#000;box-shadow:0 0 9px rgba(245,158,11,0.6);border-color:var(--word-so);}',
            '.rvt-btn[data-st="bad"].rvt-active{background:var(--word-bad);color:#fff;box-shadow:0 0 9px rgba(239,68,68,0.6);border-color:var(--word-bad);}',
            '.rvt-btn[data-st="none"].rvt-active{background:rgba(255,255,255,0.32);color:#fff;box-shadow:0 0 7px rgba(255,255,255,0.3);}'
        ].join('\n');
        (document.head || document.documentElement).appendChild(st);
    })();

    // 登録語抽出に使うクリーン正規表現（既存 analyzeText と同一ルール）
    var RVT_CLEAN = /[.,\/#!$%\^&\*;:{}=\-_`~()\[\]\"']/g;

    // ------------------------------------------------------------------
    // 【1】生テキストから“登録語”を登場順・重複排除で収集
    //     （辞書語は除外＝findVocabByToken にヒットする語のみ）
    // ------------------------------------------------------------------
    window.__collectRegisteredWordsInText = function(text) {
        var collected = [];
        var seen = {};
        if (!text || typeof window.findVocabByToken !== 'function') return collected;
        var tokens = String(text).split(/\s+/);
        for (var i = 0; i < tokens.length; i++) {
            var raw = tokens[i];
            if (!raw) continue;
            var clean = raw.toLowerCase().replace(RVT_CLEAN, '');
            if (!clean) continue;
            var v = window.findVocabByToken(clean);
            if (v && !seen[String(v.num)]) {
                seen[String(v.num)] = true;
                collected.push(v);
            }
        }
        return collected;
    };

    // ------------------------------------------------------------------
    // 【2】意味行の4ボタンを、現在の status に合わせて塗り直す
    // ------------------------------------------------------------------
    window.__paintTrainerMeaningRow = function(rowEl, vocabItem) {
        if (!rowEl || !vocabItem) return;
        var mid = rowEl.getAttribute('data-mid');
        var m = null;
        for (var i = 0; i < (vocabItem.meanings || []).length; i++) {
            if (String(vocabItem.meanings[i].id) === String(mid)) { m = vocabItem.meanings[i]; break; }
        }
        var st = m ? (m.status || 'none') : 'none';
        var btns = rowEl.querySelectorAll('.rvt-btn');
        for (var b = 0; b < btns.length; b++) {
            var bst = btns[b].getAttribute('data-st');
            if (bst === st) btns[b].classList.add('rvt-active');
            else btns[b].classList.remove('rvt-active');
        }
    };

    // ------------------------------------------------------------------
    // 【3】マーク変更ハンドラ（単語帳と完全同期＋英文の色も追従）
    // ------------------------------------------------------------------
    window.__trainerMark = function(num, meaningId, status, btnEl) {
        // 既存の更新処理を流用（vocabList・EXP・保存・単語帳再描画を全部こなす）
        if (typeof window.updateMeaningStatus === 'function') {
            window.updateMeaningStatus(num, meaningId, status, null);
        }
        // 押したボタンをぽんとはねさせる
        if (btnEl) {
            btnEl.classList.remove('rvt-on');
            void btnEl.offsetWidth;
            btnEl.classList.add('rvt-on');
        }
        // 該当語を vocabList から引き直して行を再塗装
        var v = null;
        for (var i = 0; i < vocabList.length; i++) {
            if (String(vocabList[i].num) === String(num)) { v = vocabList[i]; break; }
        }
        if (v && btnEl) {
            var row = btnEl.closest('.rvt-meaning-row');
            window.__paintTrainerMeaningRow(row, v);
        }
        // 英文内の語の色も即時追従
        if (typeof window.updateReaderWordColors === 'function') {
            try { window.updateReaderWordColors(); } catch (e) {}
        }
    };

    // ------------------------------------------------------------------
    // 【4】トレーDOMを構築して英文の直下へ挿入（0語なら非表示）
    // ------------------------------------------------------------------
    window.__buildReaderVocabTrainer = function() {
        var eng = document.getElementById('englishContainer');
        if (!eng || !eng.parentNode) return;

        // 古いトレーがあれば除去
        var old = document.getElementById('readerVocabTrainerCard');
        if (old && old.parentNode) old.parentNode.removeChild(old);

        var words = window.__collectRegisteredWordsInText(currentActiveReaderText || '');
        if (!words || words.length === 0) return; // 登録語なし＝トレー不出

        var card = document.createElement('div');
        card.id = 'readerVocabTrainerCard';
        card.className = 'rvt-open'; // 1語以上＝最初から展開

        // ---- 見出し ----
        var head = document.createElement('div');
        head.className = 'rvt-head';
        head.innerHTML =
            '<span class="rvt-head-ico">📋</span>' +
            '<span class="rvt-head-title">この長文の登録単語' +
            '<span class="rvt-head-sub">タップで開閉 ／ 意味ごとに理解度をチェック</span></span>' +
            '<span class="rvt-count">' + words.length + '語</span>' +
            '<span class="rvt-chev">▾</span>';
        head.onclick = function() { card.classList.toggle('rvt-open'); };
        card.appendChild(head);

        // ---- 本文 ----
        var body = document.createElement('div');
        body.className = 'rvt-body';
        var inner = document.createElement('div');
        inner.className = 'rvt-body-inner';

        words.forEach(function(v, wIdx) {
            var wCard = document.createElement('div');
            wCard.className = 'rvt-word';
            wCard.style.animationDelay = Math.min(wIdx * 0.04, 0.6) + 's';

            var wHead = document.createElement('div');
            wHead.className = 'rvt-word-head';
            wHead.innerHTML =
                '<span class="rvt-word-num">#' + v.num + '</span>' +
                '<span class="rvt-word-en">' + (v.word || '') + '</span>';
            wCard.appendChild(wHead);

            (v.meanings || []).forEach(function(m) {
                var row = document.createElement('div');
                row.className = 'rvt-meaning-row';
                row.setAttribute('data-mid', String(m.id));

                var txt = document.createElement('span');
                txt.className = 'rvt-meaning-text';
                txt.textContent = m.text || '';
                row.appendChild(txt);

                var btns = document.createElement('div');
                btns.className = 'rvt-btns';
                var defs = [
                    { st: 'ok',   label: '⚪︎' },
                    { st: 'so',   label: '△' },
                    { st: 'bad',  label: '✕' },
                    { st: 'none', label: 'ー' }
                ];
                defs.forEach(function(d) {
                    var b = document.createElement('button');
                    b.type = 'button';
                    b.className = 'rvt-btn';
                    b.setAttribute('data-st', d.st);
                    b.textContent = d.label;
                    b.onclick = function(ev) {
                        if (ev) ev.stopPropagation();
                        window.__trainerMark(v.num, m.id, d.st, b);
                    };
                    btns.appendChild(b);
                });
                row.appendChild(btns);

                // 初期塗装
                window.__paintTrainerMeaningRow(row, v);
                wCard.appendChild(row);
            });

            inner.appendChild(wCard);
        });

        body.appendChild(inner);
        card.appendChild(body);

        // 英文コンテナの“直後”に挿入
        if (eng.nextSibling) eng.parentNode.insertBefore(card, eng.nextSibling);
        else eng.parentNode.appendChild(card);
    };

    // ------------------------------------------------------------------
    // 【5】analyzeText をラップ：解析完了“後”にトレーを組み立てる
    //     （既存の解析・和訳・要約・本棚保存ロジックは一切不変）
    // ------------------------------------------------------------------
    var __prevAnalyzeTextForTrainer = window.analyzeText;
    window.analyzeText = async function() {
        var r = __prevAnalyzeTextForTrainer ? await __prevAnalyzeTextForTrainer.apply(this, arguments) : undefined;
        try { window.__buildReaderVocabTrainer(); } catch (e) { console.error('reader trainer build error:', e); }
        return r;
    };

    // ------------------------------------------------------------------
    // 【6】リーダーを閉じた時はトレーも消す（既存 closeReader を拡張）
    // ------------------------------------------------------------------
    var __prevCloseReaderForTrainer = window.closeReader;
    window.closeReader = function() {
        var r = __prevCloseReaderForTrainer ? __prevCloseReaderForTrainer.apply(this, arguments) : undefined;
        var t = document.getElementById('readerVocabTrainerCard');
        if (t && t.parentNode) t.parentNode.removeChild(t);
        return r;
    };

    console.log('📋 第16回パッチ（長文リーダー登録単語トレー：自動抽出＋意味別チェック＋英文色追従）適用完了');
})();
// ==========================================================================
// 🔧 修正パッチ：長文リーダーの「開く」「本棚に保存する」ボタンが
//    英文中のダブルクォート " で壊れて押せなくなる問題を根治
//    原因: onclick="..." 属性内に英文を埋めているが " をエスケープしていない
//          → 英文に " が混ざると属性が途中で切れ、ボタンが無効化される
//    修正: 既存関数の中身には一切触れず、実行“後”にボタンを走査して
//          壊れた onclick 属性を除去＋安全な addEventListener に付け替える
//          （テキストはグローバル変数から直接渡す＝エスケープ地獄を回避）
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
//    ※analyzeText / renderHistoryList をラップするだけ＝解析・和訳・本棚保存ロジックは不変
// ==========================================================================
(function applyReaderOpenButtonFixPatch() {
    if (window.__readerOpenButtonFixApplied) return;
    window.__readerOpenButtonFixApplied = true;

    // ------------------------------------------------------------------
    // 【1】履歴ログの「開く」ボタンを安全なリスナに付け替え
    //     ・.list-item-row の出現順＝textHistory の順（forEach で append されるため）
    //     ・壊れた onclick 属性を removeAttribute してからリスナを貼る
    //     ・削除ボタン(.word-delete-btn)には触れない
    // ------------------------------------------------------------------
    window.__rebindHistoryOpenButtons = function() {
        var container = document.getElementById('historyListContainer');
        if (!container) return;
        var rows = container.querySelectorAll('.list-item-row');
        for (var i = 0; i < rows.length; i++) {
            (function(idx) {
                var row = rows[idx];
                if (!row) return;
                var openBtn = row.querySelector('.list-action-link');
                if (!openBtn) return;
                // 毎回 innerHTML で作り直されるので要素は新しい＝ガードは念のため
                if (openBtn.dataset.openRebound === '1') return;
                openBtn.removeAttribute('onclick');
                openBtn.dataset.openRebound = '1';
                openBtn.addEventListener('click', function(ev) {
                    if (ev) ev.stopPropagation();
                    var entry = (typeof textHistory !== 'undefined' && textHistory) ? textHistory[idx] : null;
                    if (!entry) return;
                    window.analyzeText(entry.text, entry.title || '無題');
                });
            })(i);
        }
    };

    // ------------------------------------------------------------------
    // 【2】解析画面の「本棚に保存する」ボタンを安全なリスナに付け替え
    //     ・readerCurrentTitle 内の button が対象
    //     ・テキストはグローバル変数 currentActiveReaderText / currentActiveTitle
    //       を直接渡す（属性埋め込みをしないので " があっても壊れない）
    // ------------------------------------------------------------------
    window.__rebindSaveBookshelfButton = function() {
        var titleBox = document.getElementById('readerCurrentTitle');
        if (!titleBox) return;
        var btn = titleBox.querySelector('button');
        if (!btn) return;
        if (btn.dataset.saveRebound === '1') return;
        btn.removeAttribute('onclick');
        btn.dataset.saveRebound = '1';
        btn.addEventListener('click', function(ev) {
            if (ev) ev.stopPropagation();
            var txt = (typeof currentActiveReaderText !== 'undefined') ? currentActiveReaderText : '';
            var ttl = (typeof currentActiveTitle !== 'undefined' && currentActiveTitle) ? currentActiveTitle : '無題';
            if (typeof window.showCustomSaveBookshelfPrompt === 'function') {
                window.showCustomSaveBookshelfPrompt(txt, ttl);
            }
        });
    };

    // 両方をまとめて実行するヘルパー
    function rebindAll() {
        try { window.__rebindHistoryOpenButtons(); } catch (e) {}
        try { window.__rebindSaveBookshelfButton(); } catch (e) {}
    }

    // ------------------------------------------------------------------
    // 【3】renderHistoryList をラップ：描画後に「開く」を付け替え
    // ------------------------------------------------------------------
    var __prevRenderHistoryListForOpenFix = window.renderHistoryList;
    if (typeof __prevRenderHistoryListForOpenFix === 'function') {
        window.renderHistoryList = function() {
            var r = __prevRenderHistoryListForOpenFix.apply(this, arguments);
            window.__rebindHistoryOpenButtons();
            return r;
        };
    }

    // ------------------------------------------------------------------
    // 【4】analyzeText をラップ：描画後に「保存する」＋「開く」を付け替え
    //     ・async 関数なので Promise 解決を待つ（readerCurrentTitle は await 後に設定される）
    //     ・解析失敗で closeReader された場合もガード済み（要素が無ければ何もしない）
    // ------------------------------------------------------------------
    var __prevAnalyzeTextForOpenFix = window.analyzeText;
    if (typeof __prevAnalyzeTextForOpenFix === 'function') {
        window.analyzeText = function() {
            var r = __prevAnalyzeTextForOpenFix.apply(this, arguments);
            if (r && typeof r.then === 'function') {
                r.then(function() { rebindAll(); }, function() { rebindAll(); });
            } else {
                rebindAll();
            }
            return r;
        };
    }

    // ------------------------------------------------------------------
    // 【5】起動時注入（履歴が初期描画された後の保険）
    // ------------------------------------------------------------------
    (function initReaderOpenButtonFixPatch() {
        function boot() { rebindAll(); }
        if (document.readyState !== 'loading') {
            setTimeout(boot, 500);
        } else {
            document.addEventListener('DOMContentLoaded', function() { setTimeout(boot, 500); });
        }
    })();

    console.log('🔧 長文リーダー開く/保存ボタン修正パッチ（" エスケープ欠落の根治：リスナ付け替え方式）適用完了');
})();
// ==========================================================================
// 📊 第5回パッチ：勉強時間グラフ安定化 ＋ 日付跨ぎ修正
// ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
// ==========================================================================

// ------------------------------------------------------------------
// A. 時間表示の更新を分離（毎秒呼んでも軽量なテキスト更新のみ）
// ------------------------------------------------------------------
window.__updateStudyTimeDisplay = function() {
    var minStr = String(Math.floor(todayStudySeconds / 60)).padStart(2, '0');
    var secStr = String(todayStudySeconds % 60).padStart(2, '0');
    var el = document.getElementById('todayStudyTimeDisplay');
    if (el) el.innerText = minStr + '分' + secStr + '秒';
};

// ------------------------------------------------------------------
// B. グラフ描画の完全上書き
//    ・整数分に切り捨て（小数チラつき防止）
//    ・既存DOMがある場合は値だけ更新（全消去→再構築しない）
// ------------------------------------------------------------------
window.renderActivityChart = function() {
    var chart = document.getElementById('activityBarChart');
    if (!chart) return;

    var now = new Date();
    var currentDayIdx = now.getDay() - 1;
    if (currentDayIdx < 0) currentDayIdx = 6;

    // ✅ 整数分に切り捨て
    var currentTodayMinutes = Math.floor(todayStudySeconds / 60);
    weeklyStudyMinutesLog[currentDayIdx] = currentTodayMinutes;

    var daysLabels = ['月', '火', '水', '木', '金', '土', '日'];

    // ✅ 既存バーがある場合は値だけ更新して return（DOM全消去しない）
    if (chart.children.length === daysLabels.length) {
        for (var i = 0; i < daysLabels.length; i++) {
            var wrap = chart.children[i];
            if (!wrap) continue;
            var rawMin = weeklyStudyMinutesLog[i] || 0;
            var pct = Math.min(100, Math.max(4, Math.round((rawMin / 60) * 100)));
            var fill = wrap.querySelector('.bar-fill');
            if (fill) fill.style.height = pct + '%';
            var valLbl = wrap.children[0];
            if (valLbl) valLbl.innerText = Math.floor(rawMin) + '分';
        }
        return;
    }

    // 初回のみDOM構築
    chart.innerHTML = '';
    for (var j = 0; j < daysLabels.length; j++) {
        var w = document.createElement('div');
        w.className = 'bar-wrapper';
        w.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;flex:1;min-width:0;';

        var raw = weeklyStudyMinutesLog[j] || 0;
        var h = Math.min(100, Math.max(4, Math.round((raw / 60) * 100)));

        var vl = document.createElement('div');
        vl.style.cssText = 'font-size:8px;font-weight:700;color:#FFFFFF;margin-bottom:2px;white-space:nowrap;';
        vl.innerText = Math.floor(raw) + '分';

        var f = document.createElement('div');
        f.className = 'bar-fill active';
        f.style.height = h + '%';

        var lb = document.createElement('div');
        lb.style.cssText = 'font-size:10px;color:var(--text-sub);margin-top:4px;font-weight:bold;';
        lb.innerText = daysLabels[j];

        w.appendChild(vl);
        w.appendChild(f);
        w.appendChild(lb);
        chart.appendChild(w);
    }
};

// ------------------------------------------------------------------
// C. タイマー＆日付ローテーションの完全上書き
//    ・setInterval 内に毎秒の日付チェックを追加（0時跨ぎ対応）
//    ・グラフ更新は10秒に1回に間引き
//    ・二重起動防止ガード付き
// ------------------------------------------------------------------
window.initStudyTimerAndDataRotation = function() {
    // 二重起動防止（旧intervalが残っていれば停止）
    if (window.__studyTimerIntervalId) {
        clearInterval(window.__studyTimerIntervalId);
        window.__studyTimerIntervalId = null;
    }

    var now = new Date();
    var todayStr = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();

    // 起動時の日付チェック（前日データ確定）
    if (lastAccessDateStr && lastAccessDateStr !== todayStr) {
        var oldDate = new Date(lastAccessDateStr);
        var oldDayIdx = oldDate.getDay() - 1;
        if (oldDayIdx < 0) oldDayIdx = 6;
        weeklyStudyMinutesLog[oldDayIdx] = todayStudySeconds / 60;
        localStorage.setItem('core_v4_study_weekly_log', JSON.stringify(weeklyStudyMinutesLog));
        todayStudySeconds = 0;
        localStorage.setItem('core_v4_study_today_secs', '0');
    }

    lastAccessDateStr = todayStr;
    localStorage.setItem('core_v4_study_last_date', todayStr);

    window.__updateStudyTimeDisplay();
    window.renderActivityChart();

    window.__studyTimerIntervalId = setInterval(function() {
        // ✅ 毎秒日付チェック（日付跨ぎ対応）
        var checkNow = new Date();
        var checkTodayStr = checkNow.getFullYear() + '-' + (checkNow.getMonth() + 1) + '-' + checkNow.getDate();

        if (checkTodayStr !== lastAccessDateStr) {
            var od = new Date(lastAccessDateStr);
            var odIdx = od.getDay() - 1;
            if (odIdx < 0) odIdx = 6;
            weeklyStudyMinutesLog[odIdx] = todayStudySeconds / 60;
            localStorage.setItem('core_v4_study_weekly_log', JSON.stringify(weeklyStudyMinutesLog));

            todayStudySeconds = 0;
            localStorage.setItem('core_v4_study_today_secs', '0');
            lastAccessDateStr = checkTodayStr;
            localStorage.setItem('core_v4_study_last_date', checkTodayStr);

            window.renderActivityChart();
            console.log('📅 日付が変わりました。勉強時間をリセットしました。');
        }

        // 勉強時間の計測判定
        var shouldCount = false;
        if (currentActiveTabId === 'vocab' || currentActiveTabId === 'reader') {
            shouldCount = true;
        } else if (currentActiveTabId === 'game') {
            var isFcardPlay = (document.getElementById('flashcard-play-screen') && document.getElementById('flashcard-play-screen').style.display === 'flex');
            var isSoloPlay = (document.getElementById('game-play-screen') && document.getElementById('game-play-screen').style.display === 'block');
            var isMultiPlay = (document.getElementById('multi-battle-play-screen') && document.getElementById('multi-battle-play-screen').style.display === 'flex');
            if (isFcardPlay || isSoloPlay || isMultiPlay) shouldCount = true;
        }

        if (shouldCount) {
            todayStudySeconds++;
            localStorage.setItem('core_v4_study_today_secs', String(todayStudySeconds));

            var currentMin = Math.floor(todayStudySeconds / 60);
            if (currentMin > userStats.study_burst) {
                userStats.study_burst = currentMin;
                window.saveUserStats();
                window.checkAndRewardTitleBonusXP();
            }

            window.__updateStudyTimeDisplay();

            // ✅ グラフは10秒に1回だけ更新（チラつき防止）
            if (todayStudySeconds % 10 === 0) {
                window.renderActivityChart();
            }
        }
    }, 1000);
};

console.log('📊 第5回パッチ（勉強時間グラフ安定化＋日付跨ぎ修正）適用完了');
// ==========================================================================
// ✏️ 第6回パッチ：勉強時間の手動編集（今日 ＋ 過去7日分）
//    ・グラフのバーをクリック → その日の時間を編集するモーダルが開く
//    ・今日 → todayStudySeconds を書き換え（以降もタイマーが加算を継続）
//    ・過去 → weeklyStudyMinutesLog を書き換え
//    ※必ず第5回パッチより後に貼り付けてください
// ==========================================================================

// ---------- 1. エディタのDOM／CSSを1回だけ注入 ----------
window.__injectStudyTimeEditor = function() {
    if (document.getElementById('studyTimeEditorOverlay')) return;

    var style = document.createElement('style');
    style.textContent = [
        '#studyTimeEditorOverlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(7,10,18,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .22s ease;}',
        '#studyTimeEditorOverlay.open{opacity:1;pointer-events:auto;}',
        '.ste-card{width:min(340px,calc(100vw - 40px));background:linear-gradient(168deg,#242c42 0%,#161c2d 70%);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:22px 22px 18px;box-shadow:0 24px 64px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.06);color:#fff;transform:translateY(16px) scale(.95);transition:transform .28s cubic-bezier(.2,.9,.3,1.25);font-family:inherit;}',
        '#studyTimeEditorOverlay.open .ste-card{transform:none;}',
        '.ste-eyebrow{font-size:11px;font-weight:700;letter-spacing:.08em;color:#8b93a7;margin-bottom:6px;}',
        '.ste-date-row{display:flex;align-items:center;gap:8px;margin-bottom:18px;}',
        '#steDateLabel{font-size:22px;font-weight:800;letter-spacing:.01em;}',
        '#steTodayBadge{font-size:10px;font-weight:800;color:#052e16;background:linear-gradient(135deg,#4ade80,#22c55e);padding:3px 8px;border-radius:999px;}',
        '.ste-steppers{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:16px;}',
        '.ste-group{display:flex;align-items:center;gap:8px;}',
        '.ste-btn{width:42px;height:42px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;font-size:20px;font-weight:700;cursor:pointer;transition:background .15s,transform .1s,border-color .15s;line-height:1;}',
        '.ste-btn:hover{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.28);}',
        '.ste-btn:active{transform:scale(.9);}',
        '.ste-val{min-width:56px;text-align:center;}',
        '.ste-val span{display:block;font-size:30px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.05;}',
        '.ste-val em{display:block;font-style:normal;font-size:10px;color:#8b93a7;font-weight:700;margin-top:2px;}',
        '.ste-colon{font-size:24px;font-weight:800;color:#5b6478;padding-bottom:12px;}',
        '.ste-chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:18px;}',
        '.ste-chips button{font-size:11px;font-weight:700;color:#cdd3e1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:6px 11px;cursor:pointer;transition:transform .12s,background .15s;font-family:inherit;}',
        '.ste-chips button:hover{background:rgba(255,255,255,.14);transform:translateY(-1px);}',
        '.ste-chips .ste-reset{color:#fda4af;border-color:rgba(251,113,133,.35);background:rgba(251,113,133,.08);}',
        '.ste-chips .ste-reset:hover{background:rgba(251,113,133,.18);}',
        '.ste-footer{display:flex;gap:10px;}',
        '.ste-cancel{flex:1;padding:11px 0;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:transparent;color:#cdd3e1;font-size:13px;font-weight:700;cursor:pointer;transition:background .15s;font-family:inherit;}',
        '.ste-cancel:hover{background:rgba(255,255,255,.07);}',
        '.ste-save{flex:1.4;padding:11px 0;border-radius:12px;border:none;background:linear-gradient(135deg,#4ade80,#16a34a);color:#04150b;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 6px 18px rgba(34,197,94,.35);transition:transform .12s,box-shadow .15s,filter .15s;font-family:inherit;}',
        '.ste-save:hover{transform:translateY(-1px);filter:brightness(1.08);box-shadow:0 9px 24px rgba(34,197,94,.45);}',
        '.ste-save:active{transform:scale(.97);}',
        '#activityBarChart.editable .bar-wrapper{cursor:pointer;}',
        '#activityBarChart.editable .bar-wrapper .bar-fill{transition:filter .15s, height .3s ease;}',
        '#activityBarChart.editable .bar-wrapper:hover .bar-fill{filter:brightness(1.3) saturate(1.1);}',
        '#steHint{text-align:center;font-size:10px;color:var(--text-sub,#8b93a7);margin-top:8px;opacity:.85;}',
        '#steToast{position:fixed;bottom:28px;left:50%;transform:translate(-50%,14px);z-index:10000;background:linear-gradient(135deg,#14532d,#166534);color:#dcfce7;font-size:13px;font-weight:700;padding:10px 20px;border-radius:999px;border:1px solid rgba(74,222,128,.4);box-shadow:0 10px 30px rgba(0,0,0,.4);opacity:0;pointer-events:none;transition:opacity .25s,transform .25s;}',
        '#steToast.show{opacity:1;transform:translate(-50%,0);}',
        '@keyframes stePulse{0%{box-shadow:0 0 0 0 rgba(74,222,128,.6)}100%{box-shadow:0 0 0 16px rgba(74,222,128,0)}}',
        '.bar-fill.ste-saved{animation:stePulse .65s ease-out;}'
    ].join('\n');
    document.head.appendChild(style);

    var overlay = document.createElement('div');
    overlay.id = 'studyTimeEditorOverlay';
    overlay.innerHTML =
        '<div class="ste-card">' +
            '<div class="ste-eyebrow">✏️ 勉強時間を編集</div>' +
            '<div class="ste-date-row">' +
                '<span id="steDateLabel"></span>' +
                '<span id="steTodayBadge">今日</span>' +
            '</div>' +
            '<div class="ste-steppers">' +
                '<div class="ste-group">' +
                    '<button type="button" class="ste-btn" onclick="__steAdjust(-60)">−</button>' +
                    '<div class="ste-val"><span id="steHours">00</span><em>時間</em></div>' +
                    '<button type="button" class="ste-btn" onclick="__steAdjust(60)">＋</button>' +
                '</div>' +
                '<div class="ste-colon">:</div>' +
                '<div class="ste-group">' +
                    '<button type="button" class="ste-btn" onclick="__steAdjust(-5)">−</button>' +
                    '<div class="ste-val"><span id="steMins">00</span><em>分</em></div>' +
                    '<button type="button" class="ste-btn" onclick="__steAdjust(5)">＋</button>' +
                '</div>' +
            '</div>' +
            '<div class="ste-chips">' +
                '<button type="button" onclick="__steAdjust(15)">+15分</button>' +
                '<button type="button" onclick="__steAdjust(30)">+30分</button>' +
                '<button type="button" onclick="__steAdjust(60)">+1時間</button>' +
                '<button type="button" class="ste-reset" onclick="__steReset()">0に戻す</button>' +
            '</div>' +
            '<div class="ste-footer">' +
                '<button type="button" class="ste-cancel" onclick="__steClose()">キャンセル</button>' +
                '<button type="button" class="ste-save" onclick="__steSave()">保存する</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);

    // 背景クリック／Escで閉じる
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) window.__steClose();
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') window.__steClose();
    });
};

// ---------- 2. エディタの状態と操作 ----------
window.__steState = { dayIdx: 0, minutes: 0, isToday: false };

window.__steRenderValues = function() {
    document.getElementById('steHours').textContent = String(Math.floor(window.__steState.minutes / 60)).padStart(2, '0');
    document.getElementById('steMins').textContent = String(window.__steState.minutes % 60).padStart(2, '0');
};

window.__steAdjust = function(delta) {
    window.__steState.minutes = Math.max(0, Math.min(24 * 60 - 5, window.__steState.minutes + delta));
    window.__steState.minutes = Math.round(window.__steState.minutes / 5) * 5; // 5分単位にスナップ
    window.__steRenderValues();
};

window.__steReset = function() {
    window.__steState.minutes = 0;
    window.__steRenderValues();
};

// ---------- 3. モーダルを開く（dayIdx: 0=月 〜 6=日） ----------
window.__openStudyTimeEditor = function(dayIdx) {
    window.__injectStudyTimeEditor();

    var now = new Date();
    var cur = now.getDay() - 1;
    if (cur < 0) cur = 6;

    // その曜日の直近の日付を計算
    var diff = cur - dayIdx;
    if (diff < 0) diff += 7;
    var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);

    var isToday = (dayIdx === cur);
    var totalMin = isToday
        ? Math.floor(todayStudySeconds / 60)
        : Math.floor(weeklyStudyMinutesLog[dayIdx] || 0);

    window.__steState = { dayIdx: dayIdx, minutes: totalMin, isToday: isToday };

    var dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    document.getElementById('steDateLabel').textContent = (d.getMonth() + 1) + '月' + d.getDate() + '日（' + dow + '）';
    document.getElementById('steTodayBadge').style.display = isToday ? 'inline-block' : 'none';
    window.__steRenderValues();

    document.getElementById('studyTimeEditorOverlay').classList.add('open');
};

window.__steClose = function() {
    var ov = document.getElementById('studyTimeEditorOverlay');
    if (ov) ov.classList.remove('open');
};

// ---------- 4. 保存 ----------
window.__steSave = function() {
    var st = window.__steState;

    if (st.isToday) {
        // 今日：秒数に換算して書き換え（以降もタイマーがここから加算）
        todayStudySeconds = st.minutes * 60;
        localStorage.setItem('core_v4_study_today_secs', String(todayStudySeconds));
        if (window.__updateStudyTimeDisplay) window.__updateStudyTimeDisplay();

        // 連続学習記録もついでに更新
        if (st.minutes > userStats.study_burst && window.saveUserStats) {
            userStats.study_burst = st.minutes;
            window.saveUserStats();
        }
    } else {
        // 過去：週間ログを直接書き換え
        weeklyStudyMinutesLog[st.dayIdx] = st.minutes;
        localStorage.setItem('core_v4_study_weekly_log', JSON.stringify(weeklyStudyMinutesLog));
    }

    window.__steClose();
    window.renderActivityChart();

    // 編集したバーをパルス表示
    var chart = document.getElementById('activityBarChart');
    if (chart && chart.children[st.dayIdx]) {
        var fill = chart.children[st.dayIdx].querySelector('.bar-fill');
        if (fill) {
            fill.classList.remove('ste-saved');
            void fill.offsetWidth; // アニメーション再トリガー
            fill.classList.add('ste-saved');
        }
    }

    window.__steToast(st.isToday ? '今日の勉強時間を保存しました ✓' : '勉強時間を保存しました ✓');
};

// ---------- 5. トースト ----------
window.__steToast = function(msg) {
    var t = document.getElementById('steToast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'steToast';
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t.__hideTimer);
    t.__hideTimer = setTimeout(function() { t.classList.remove('show'); }, 2200);
};

// ---------- 6. renderActivityChart をラップしてクリック binding ----------
var __prevRenderForEditor = window.renderActivityChart;
window.renderActivityChart = function() {
    var r = __prevRenderForEditor ? __prevRenderForEditor.apply(this, arguments) : undefined;

    var chart = document.getElementById('activityBarChart');
    if (chart && !chart.__steBound) {
        chart.__steBound = true;
        chart.classList.add('editable');

        // イベント移譲：DOM再構築されても1回のbindingで永久に動作
        chart.addEventListener('click', function(e) {
            var wrap = e.target.closest('.bar-wrapper');
            if (!wrap) return;
            var idx = Array.prototype.indexOf.call(chart.children, wrap);
            if (idx >= 0) window.__openStudyTimeEditor(idx);
        });

        // ヒント表示
        if (!document.getElementById('steHint')) {
            var hint = document.createElement('div');
            hint.id = 'steHint';
            hint.textContent = '💡 バーをタップすると、その日の勉強時間を編集できます';
            chart.insertAdjacentElement('afterend', hint);
        }
    }
    return r;
};

console.log('✏️ 第6回パッチ（勉強時間の手動編集）適用完了');
// ==========================================================================
// 📅 第7回パッチ：グラフの右端を常に最新（今日）にするローリング表示
//    ・左端 = 6日前 … 右端 = 今日（日付が変わると自動で並び替え）
//    ・各バー下に「曜日 + 日付」ラベルを表示、今日は「今日」と強調
//    ※第6回パッチ（編集機能）より後に貼り付けてください
// ==========================================================================

// ---------- 0. ローリング表示用の追加スタイル ----------
(function() {
    if (document.getElementById('steRollingStyle')) return;
    var s = document.createElement('style');
    s.id = 'steRollingStyle';
    s.textContent = [
        '.ste-day-lbl{font-size:10px;font-weight:bold;color:var(--text-sub,#8b93a7);margin-top:4px;line-height:1;}',
        '.ste-date-lbl{font-size:8px;color:var(--text-sub,#8b93a7);opacity:.75;margin-top:2px;line-height:1;font-variant-numeric:tabular-nums;}',
        '.bar-wrapper.ste-today .ste-day-lbl{color:#4ade80;}',
        '.bar-wrapper.ste-today .ste-date-lbl{color:#4ade80;opacity:1;font-weight:800;}',
        '.bar-wrapper.ste-today .bar-fill{box-shadow:0 0 12px rgba(74,222,128,.35);}'
    ].join('\n');
    document.head.appendChild(s);
})();

// ---------- 1. renderActivityChart 差し替え（ローリング順序） ----------
window.renderActivityChart = function() {
    var chart = document.getElementById('activityBarChart');
    if (!chart) return;

    var now = new Date();
    var currentDayIdx = now.getDay() - 1;
    if (currentDayIdx < 0) currentDayIdx = 6;

    // 今日の分数（整数）をログに反映
    weeklyStudyMinutesLog[currentDayIdx] = Math.floor(todayStudySeconds / 60);

    var daysLabels = ['月', '火', '水', '木', '金', '土', '日'];

    // 位置 p（0=左端 〜 6=右端）→ 曜日インデックス・日付
    // 右端が常に今日、左へ1つずつ過去に遡る
    function dayIdxAtPos(p) { return (currentDayIdx + p + 1) % 7; }
    function dateAtPos(p) { return new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - p)); }
    function subLabelFor(p) {
        var di = dayIdxAtPos(p);
        if (di === currentDayIdx) return '今日';
        var d = dateAtPos(p);
        return (d.getMonth() + 1) + '/' + d.getDate();
    }

    if (chart.children.length === 7 && chart.__steRolling) {
        // ---- 既存DOMあり：値だけ更新（全消去しない → チラつかない） ----
        for (var p = 0; p < 7; p++) {
            var wrapU = chart.children[p];
            var diU = dayIdxAtPos(p);
            wrapU.dataset.dayIdx = diU;
            wrapU.classList.toggle('ste-today', diU === currentDayIdx);
            var rawU = weeklyStudyMinutesLog[diU] || 0;
            var fillU = wrapU.querySelector('.bar-fill');
            if (fillU) fillU.style.height = Math.min(100, Math.max(4, Math.round((rawU / 60) * 100))) + '%';
            if (wrapU.children[0]) wrapU.children[0].innerText = Math.floor(rawU) + '分';
            if (wrapU.children[2]) wrapU.children[2].innerText = daysLabels[diU];
            if (wrapU.children[3]) wrapU.children[3].innerText = subLabelFor(p);
        }
    } else {
        // ---- 初回：DOM構築 ----
        chart.innerHTML = '';
        chart.__steRolling = true;
        for (var p2 = 0; p2 < 7; p2++) {
            var di2 = dayIdxAtPos(p2);
            var isToday2 = (di2 === currentDayIdx);
            var raw2 = weeklyStudyMinutesLog[di2] || 0;

            var wrap2 = document.createElement('div');
            wrap2.className = 'bar-wrapper' + (isToday2 ? ' ste-today' : '');
            wrap2.dataset.dayIdx = di2;
            wrap2.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;flex:1;min-width:0;';

            var vl2 = document.createElement('div');
            vl2.style.cssText = 'font-size:8px;font-weight:700;color:#FFFFFF;margin-bottom:2px;white-space:nowrap;';
            vl2.innerText = Math.floor(raw2) + '分';

            var f2 = document.createElement('div');
            f2.className = 'bar-fill active';
            f2.style.height = Math.min(100, Math.max(4, Math.round((raw2 / 60) * 100))) + '%';

            var dl2 = document.createElement('div');
            dl2.className = 'ste-day-lbl';
            dl2.innerText = daysLabels[di2];

            var dt2 = document.createElement('div');
            dt2.className = 'ste-date-lbl';
            dt2.innerText = subLabelFor(p2);

            wrap2.appendChild(vl2);
            wrap2.appendChild(f2);
            wrap2.appendChild(dl2);
            wrap2.appendChild(dt2);
            chart.appendChild(wrap2);
        }
    }

    // ---------- エディタのバインド（第6回パッチ連携） ----------
    if (!chart.__steBoundV2 && window.__openStudyTimeEditor) {
        chart.__steBoundV2 = true;
        chart.classList.add('editable');
        // 位置ではなく data-day-idx から曜日を取得 → ローリング後も正確
        chart.addEventListener('click', function(e) {
            var wrap = e.target.closest('.bar-wrapper');
            if (!wrap || wrap.dataset.dayIdx === undefined) return;
            window.__openStudyTimeEditor(parseInt(wrap.dataset.dayIdx, 10));
        });
    }
    var hint = document.getElementById('steHint');
    if (!hint) {
        hint = document.createElement('div');
        hint.id = 'steHint';
        chart.insertAdjacentElement('afterend', hint);
    }
    hint.textContent = '💡 右端が今日です。バーをタップすると勉強時間を編集できます';
};

// ---------- 2. 保存後のパルスを正しいバーに出す（第6回パッチ補正） ----------
if (window.__steSave) {
    var __prevSteSaveForRolling = window.__steSave;
    window.__steSave = function() {
        var dayIdx = window.__steState.dayIdx;
        __prevSteSaveForRolling.apply(this, arguments);
        var chart = document.getElementById('activityBarChart');
        if (!chart) return;
        var fills = chart.querySelectorAll('.bar-fill');
        for (var i = 0; i < fills.length; i++) fills[i].classList.remove('ste-saved');
        var target = chart.querySelector('[data-day-idx="' + dayIdx + '"] .bar-fill');
        if (target) {
            void target.offsetWidth;
            target.classList.add('ste-saved');
        }
    };
}

console.log('📅 第7回パッチ（右端が最新・ローリング表示）適用完了');
// ==========================================================================
// 🔒 第8回パッチ：高さの正規化 ＋ 注釈削除 ＋ 編集を管理者限定に
//    ・バー高さを「7日中の最大値=100%」の比率スケールに変更（値と一致）
//    ・グラフ下のヒント注釈を撤去
//    ・バーのタップ編集を管理者ツール開放時のみ許可（単語帳編集と同じ方式）
//    ※必ず 第5→6→7回 の後に貼り付けてください
// ==========================================================================

// ---------- 0. バーの見た目（不透明グラデ＋発光＋遷移） ----------
(function() {
    if (document.getElementById('steV8Style')) return;
    var s = document.createElement('style');
    s.id = 'steV8Style';
    s.textContent = [
        // 値に比例して初めて意味を持つよう、バーを不透明な実体にする
        '#activityBarChart .bar-fill{',
        '  background:linear-gradient(180deg,#a5f3fc 0%,#22d3ee 42%,#0e7490 100%) !important;',
        '  opacity:1 !important;border-radius:7px 7px 3px 3px;',
        '  box-shadow:0 3px 12px rgba(34,211,238,.28),inset 0 1px 0 rgba(255,255,255,.35);',
        '  transition:height .5s cubic-bezier(.2,.85,.25,1), filter .18s, box-shadow .25s;',
        '}',
        // 今日のバーは緑＋常時やわらかく脈動
        '#activityBarChart .bar-wrapper.ste-today .bar-fill{',
        '  background:linear-gradient(180deg,#bbf7d0 0%,#22c55e 48%,#15803d 100%) !important;',
        '  box-shadow:0 0 16px rgba(34,197,94,.5),inset 0 1px 0 rgba(255,255,255,.4);',
        '  animation:steTodayGlow 2.6s ease-in-out infinite;',
        '}',
        '@keyframes steTodayGlow{0%,100%{box-shadow:0 0 12px rgba(34,197,94,.35),inset 0 1px 0 rgba(255,255,255,.4)}50%{box-shadow:0 0 22px rgba(34,197,94,.65),inset 0 1px 0 rgba(255,255,255,.5)}}',
        // 編集権限がある時だけ「押せる」見た目
        '#activityBarChart.editable .bar-wrapper{cursor:pointer;}',
        '#activityBarChart.editable .bar-wrapper:hover .bar-fill{filter:brightness(1.2) saturate(1.15);transform:translateY(-1px);}',
        '#activityBarChart.editable .bar-wrapper:active .bar-fill{filter:brightness(.92);}',
        '#activityBarChart:not(.editable) .bar-wrapper{cursor:default;}',
        // 0分のバーは完全に消す（値=0 を正しく表現）
        '#activityBarChart .bar-fill[data-zero="1"]{box-shadow:none;background:transparent !important;}'
    ].join('\n');
    document.head.appendChild(s);
})();

// ---------- 1. 管理者判定（単語帳編集と同じ権限を参照） ----------
window.__steAdminGranted = window.__steAdminGranted || false;

window.__steIsAdmin = function() {
    // ─────────────────────────────────────────────────────────────
    // ★ カスタマイズ箇所：お使いのアプリの管理者フラグ変数名が
    //   下記のいずれにも無い場合、この1行だけを
    //       return window.あなたのフラグ名 === true;
    //   に書き換えてください（単語帳編集を制御している変数と同じもの）。
    // ─────────────────────────────────────────────────────────────
    try {
        if (window.__steAdminGranted) return true;
        if (window.isAdmin        === true) return true;
        if (window.adminMode      === true) return true;
        if (window.adminUnlocked  === true) return true;
        if (window.__adminUnlocked=== true) return true;
        if (window.adminVerified  === true) return true;
        if (window.adminAuth      === true) return true;
        if (window.userStats && (userStats.is_admin || userStats.isAdmin || userStats.admin)) return true;

        var cls = ((document.body ? document.body.className : '') + ' ' +
                   (document.documentElement ? document.documentElement.className : ''));
        if (/(^|\s)(admin|admin-mode|admin-unlocked|is-admin|admin-verified|admin-auth)(\s|$|[-_])/i.test(cls)) return true;

        // 管理者ツール／パネルが「開いている」間も編集可
        var openSels = [
            '#adminPanel.open', '#adminModal.open', '#adminTools.open',
            '#admin-panel.open', '#admin-modal.open', '#adminToolsModal.open',
            '.admin-panel.open', '.admin-modal.open', '.admin-tools.open',
            '#adminPanel[style*="flex"]', '#adminPanel[style*="block"]',
            '#adminModal[style*="flex"]', '#adminTools[style*="flex"]'
        ];
        for (var i = 0; i < openSels.length; i++) {
            try { if (document.querySelector(openSels[i])) return true; } catch (e) {}
        }
    } catch (e) {}
    return false;
};

// 権限状態が変わったらグラフの見た目（カーソル等）を即時同期
var __steLastAdmin = null;
function __steSyncAdminUI() {
    var a = window.__steIsAdmin();
    if (a !== __steLastAdmin) {
        __steLastAdmin = a;
        if (window.renderActivityChart) window.renderActivityChart();
    }
}
try {
    var __steMO = new MutationObserver(__steSyncAdminUI);
    __steMO.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-admin', 'data-mode'] });
    __steMO.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-admin'] });
} catch (e) {}
setInterval(__steSyncAdminUI, 800); // グローバル変数の変化はポーリングで拾う

// ---------- 2. renderActivityChart 差し替え（比率スケール＋注釈なし） ----------
window.renderActivityChart = function() {
    var chart = document.getElementById('activityBarChart');
    if (!chart) return;

    var now = new Date();
    var currentDayIdx = now.getDay() - 1;
    if (currentDayIdx < 0) currentDayIdx = 6;

    weeklyStudyMinutesLog[currentDayIdx] = Math.floor(todayStudySeconds / 60);

    var daysLabels = ['月', '火', '水', '木', '金', '土', '日'];

    // ✅ 7日中の最大値を100%とする比率スケール（値と高さを一致させる）
    var maxVal = 0;
    for (var m = 0; m < 7; m++) maxVal = Math.max(maxVal, weeklyStudyMinutesLog[m] || 0);
    var scaleMax = maxVal > 0 ? maxVal : 1;
    function pctFor(raw) {
        if (raw <= 0) return 0;                                   // 0分は本当に0
        return Math.max(8, Math.round((raw / scaleMax) * 100));   // 最小8%〜最大100%
    }

    function dayIdxAtPos(p) { return (currentDayIdx + p + 1) % 7; }
    function dateAtPos(p) { return new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - p)); }
    function subLabelFor(p) {
        if (dayIdxAtPos(p) === currentDayIdx) return '今日';
        var d = dateAtPos(p);
        return (d.getMonth() + 1) + '/' + d.getDate();
    }

    function paintBar(wrap, p) {
        var di = dayIdxAtPos(p);
        var raw = weeklyStudyMinutesLog[di] || 0;
        var pct = pctFor(raw);
        wrap.dataset.dayIdx = di;
        wrap.classList.toggle('ste-today', di === currentDayIdx);
        var fill = wrap.querySelector('.bar-fill');
        if (fill) { fill.style.height = pct + '%'; fill.dataset.zero = raw <= 0 ? '1' : '0'; }
        if (wrap.children[0]) wrap.children[0].innerText = Math.floor(raw) + '分';
        if (wrap.children[2]) wrap.children[2].innerText = daysLabels[di];
        if (wrap.children[3]) wrap.children[3].innerText = subLabelFor(p);
    }

    if (chart.children.length === 7 && chart.__steRolling) {
        for (var p = 0; p < 7; p++) paintBar(chart.children[p], p);
    } else {
        chart.innerHTML = '';
        chart.__steRolling = true;
        for (var p2 = 0; p2 < 7; p2++) {
            var di2 = dayIdxAtPos(p2);
            var raw2 = weeklyStudyMinutesLog[di2] || 0;
            var wrap2 = document.createElement('div');
            wrap2.className = 'bar-wrapper' + (di2 === currentDayIdx ? ' ste-today' : '');
            wrap2.dataset.dayIdx = di2;
            wrap2.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;flex:1;min-width:0;';

            var vl = document.createElement('div');
            vl.style.cssText = 'font-size:8px;font-weight:700;color:#FFFFFF;margin-bottom:2px;white-space:nowrap;';
            vl.innerText = Math.floor(raw2) + '分';

            var f = document.createElement('div');
            f.className = 'bar-fill active';
            f.style.height = pctFor(raw2) + '%';
            f.dataset.zero = raw2 <= 0 ? '1' : '0';

            var dl = document.createElement('div');
            dl.className = 'ste-day-lbl';
            dl.innerText = daysLabels[di2];

            var dt = document.createElement('div');
            dt.className = 'ste-date-lbl';
            dt.innerText = subLabelFor(p2);

            wrap2.appendChild(vl); wrap2.appendChild(f);
            wrap2.appendChild(dl); wrap2.appendChild(dt);
            chart.appendChild(wrap2);
        }
    }

    // 編集権限がある時だけ「押せる」クラスを付与
    if (window.__steIsAdmin()) chart.classList.add('editable');
    else chart.classList.remove('editable');

    // クリックバインド（1回だけ。dataset.dayIdx から曜日判定→ローリング後も正確）
    if (!chart.__steBoundV8) {
        chart.__steBoundV8 = true;
        chart.addEventListener('click', function(e) {
            var wrap = e.target.closest('.bar-wrapper');
            if (!wrap || wrap.dataset.dayIdx === undefined) return;
            window.__openStudyTimeEditor(parseInt(wrap.dataset.dayIdx, 10));
        });
    }

    // ✅ 注釈は出さない（既存があれば撤去）
    var oldHint = document.getElementById('steHint');
    if (oldHint) oldHint.remove();
};

// ---------- 3. 編集モーダルを管理者ガードでラップ ----------
var __origOpenEditor = window.__openStudyTimeEditor;
window.__openStudyTimeEditor = function(dayIdx) {
    if (!window.__steIsAdmin()) {
        if (window.__steToast) window.__steToast('🔒 編集は管理者ツール開放後に可能です');
        return;
    }
    return __origOpenEditor ? __origOpenEditor.call(this, dayIdx) : undefined;
};

// ---------- 4. 初期反映 ----------
__steSyncAdminUI();
if (window.renderActivityChart) window.renderActivityChart();

console.log('🔒 第8回パッチ（高さ正規化＋注釈削除＋編集を管理者限定）適用完了');
// ==========================================================================
// ✍️ 第9回パッチ：コントラスト改善 ＋ 1分単位の直接入力
//    ・「総勉強時間」ラベルとグラフ下の日付／曜日を背景透過に負けない濃さへ
//    ・編集モーダルに number 入力欄を追加（1分単位・0〜23:59 クランプ）
//    ・入力中はリアルタイムで「○時間○分」プレビューが追従
//    ※必ず 第5→6→7→8回 の後に貼り付けてください
// ==========================================================================

// ---------- 0. スタイル：コントラスト ＋ 直接入力欄のデザイン ----------
(function() {
    if (document.getElementById('steV9Style')) return;
    var s = document.createElement('style');
    s.id = 'steV9Style';
    s.textContent = [
        // ── グラフ下の曜日／日付ラベルを濃く（今日の緑強調は維持） ──
        '#activityBarChart .ste-day-lbl{color:#eef3fb !important;text-shadow:0 1px 2px rgba(0,0,0,.62);letter-spacing:.02em;}',
        '#activityBarChart .ste-date-lbl{color:#dbe4f0 !important;opacity:1 !important;font-weight:700 !important;text-shadow:0 1px 2px rgba(0,0,0,.62);}',
        '#activityBarChart .bar-wrapper.ste-today .ste-day-lbl{color:#4ade80 !important;text-shadow:0 0 8px rgba(34,197,94,.55),0 1px 2px rgba(0,0,0,.5);}',
        '#activityBarChart .bar-wrapper.ste-today .ste-date-lbl{color:#86efac !important;text-shadow:0 0 8px rgba(34,197,94,.5),0 1px 2px rgba(0,0,0,.5);}',

        // ── 総勉強時間ラベルの強制コントラスト（JSで data-ste-fixed を付与） ──
        '[data-ste-fixed="1"]{color:#eaf0fa !important;text-shadow:0 1px 3px rgba(0,0,0,.6),0 0 1px rgba(0,0,0,.4);font-weight:800 !important;}',

        // ── 直接入力ブロック ──
        '.ste-direct{margin:2px 0 16px;padding:13px 14px;border-radius:14px;background:rgba(8,12,22,.42);border:1px solid rgba(255,255,255,.09);box-shadow:inset 0 1px 0 rgba(255,255,255,.04);}',
        '.ste-direct-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px;}',
        '.ste-direct-title{font-size:11px;font-weight:800;letter-spacing:.04em;color:#aeb6c8;}',
        '.ste-direct-title b{color:#5eead4;font-weight:800;}',
        '#stePreview{font-size:12px;font-weight:800;color:#bbf7d0;font-variant-numeric:tabular-nums;background:rgba(34,197,94,.12);border:1px solid rgba(74,222,128,.3);padding:3px 9px;border-radius:999px;transition:transform .18s cubic-bezier(.2,.9,.3,1.3),background .2s,color .2s;}',
        '#stePreview.bump{transform:scale(1.08);background:rgba(34,197,94,.22);}',
        '.ste-direct-row{display:flex;align-items:center;gap:9px;}',
        '#steDirectInput{-webkit-appearance:none;-moz-appearance:textfield;appearance:textfield;flex:0 0 auto;width:92px;padding:10px 12px;border-radius:11px;border:1.5px solid rgba(94,234,212,.32);background:rgba(4,10,16,.6);color:#f0fdfa;font-size:20px;font-weight:800;font-variant-numeric:tabular-nums;text-align:right;outline:none;transition:border-color .18s,box-shadow .2s,background .2s;font-family:inherit;}',
        '#steDirectInput::-webkit-outer-spin-button,#steDirectInput::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}',
        '#steDirectInput:focus{border-color:#2dd4bf;box-shadow:0 0 0 3px rgba(45,212,191,.22),0 0 18px rgba(45,212,191,.25);background:rgba(4,14,18,.85);}',
        '#steDirectInput:hover{border-color:rgba(94,234,212,.55);}',
        '.ste-direct-unit{font-size:13px;font-weight:700;color:#9aa3b6;}',
        '.ste-direct-hint{margin-top:8px;font-size:10px;color:#7e879b;line-height:1.4;}',
        '.ste-divider{display:flex;align-items:center;gap:8px;margin:0 0 12px;color:#6b7488;font-size:10px;font-weight:700;letter-spacing:.08em;}',
        '.ste-divider::before,.ste-divider::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.14),transparent);}'
    ].join('\n');
    document.head.appendChild(s);
})();

// ---------- 1. 総勉強時間ラベルのコントラスト修正 ----------
window.__steFixContrast = function() {
    if (!document.body) return;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: function(n) {
            if (!n.nodeValue || n.nodeValue.indexOf('総勉強時間') < 0) return NodeFilter.FILTER_REJECT;
            var p = n.parentNode;
            if (!p || p.nodeType !== 1) return NodeFilter.FILTER_REJECT;
            if (p.getAttribute('data-ste-fixed') === '1') return NodeFilter.FILTER_REJECT;
            // 入力欄など編集UIの中は対象外
            if (p.closest && p.closest('#studyTimeEditorOverlay')) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        }
    });
    var node;
    while ((node = walker.nextNode())) {
        var el = node.parentNode;
        el.setAttribute('data-ste-fixed', '1');
    }
};
// 初回＋軽い間隔で再適用（タブ切替後のDOM差し替えにも追従）
window.__steFixContrast();
setInterval(window.__steFixContrast, 1500);

// ---------- 2. 編集モーダルへ直接入力欄を注入 ----------
window.__steInjectDirectInput = function() {
    if (document.getElementById('steDirectInputRow')) return;
    var steppers = document.querySelector('#studyTimeEditorOverlay .ste-steppers');
    if (!steppers) return;

    var block = document.createElement('div');
    block.className = 'ste-direct';
    block.id = 'steDirectInputRow';
    block.innerHTML =
        '<div class="ste-direct-head">' +
            '<span class="ste-direct-title">✍️ <b>分</b>を直接入力</span>' +
            '<span id="stePreview">0分</span>' +
        '</div>' +
        '<div class="ste-direct-row">' +
            '<input id="steDirectInput" type="number" inputmode="numeric" min="0" max="1439" step="1" placeholder="0" autocomplete="off">' +
            '<span class="ste-direct-unit">分</span>' +
        '</div>' +
        '<div class="ste-direct-hint">1分単位で入力できます（例：135 → 2時間15分）。±ボタンはクイック調整用。</div>';

    // ステッパーの下に「または」区切り＋入力欄を挿入
    var divider = document.createElement('div');
    divider.className = 'ste-divider';
    divider.textContent = 'または';
    steppers.insertAdjacentElement('afterend', divider);
    divider.insertAdjacentElement('afterend', block);

    var input = document.getElementById('steDirectInput');
    input.addEventListener('input', function() {
        var v = parseInt(input.value, 10);
        if (isNaN(v)) v = 0;
        v = Math.max(0, Math.min(1439, v));
        window.__steState.minutes = v;
        window.__steUpdatePreview(true);
    });
    // blur時にクランプ値へ整形
    input.addEventListener('blur', function() {
        if (window.__steRenderValues) window.__steRenderValues();
    });
    // Enterで保存
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); if (window.__steSave) window.__steSave(); }
    });
};

// __injectStudyTimeEditor をラップして、DOM生成後に必ず入力欄を差し込む
if (window.__injectStudyTimeEditor) {
    var __origInjectV9 = window.__injectStudyTimeEditor;
    window.__injectStudyTimeEditor = function() {
        var r = __origInjectV9.apply(this, arguments);
        window.__steInjectDirectInput();
        return r;
    };
}

// ---------- 3. プレビュー更新 ----------
window.__steUpdatePreview = function(bump) {
    var pv = document.getElementById('stePreview');
    if (!pv) return;
    var t = window.__steState.minutes || 0;
    var h = Math.floor(t / 60), m = t % 60;
    pv.textContent = h > 0 ? (h + '時間' + (m > 0 ? m + '分' : '')) : (m + '分');
    if (bump) {
        pv.classList.remove('bump'); void pv.offsetWidth; pv.classList.add('bump');
        setTimeout(function() { pv.classList.remove('bump'); }, 200);
    }
};

// ---------- 4. __steRenderValues をラップ（input／preview 同期） ----------
if (window.__steRenderValues) {
    var __origRenderValsV9 = window.__steRenderValues;
    window.__steRenderValues = function() {
        var r = __origRenderValsV9.apply(this, arguments);
        // inputにフォーカス中はカーソル飛び防止のため値を書き戻さない
        var input = document.getElementById('steDirectInput');
        if (input && document.activeElement !== input) {
            input.value = String(window.__steState.minutes || 0);
        }
        window.__steUpdatePreview(false);
        return r;
    };
}

// ---------- 5. モーダルを開いた直後にも入力欄の存在を保証 ----------
if (window.__openStudyTimeEditor) {
    var __origOpenV9 = window.__openStudyTimeEditor;
    window.__openStudyTimeEditor = function(dayIdx) {
        var r = __origOpenV9.apply(this, arguments);
        window.__steInjectDirectInput();
        // 開いた時の値を入力欄へ反映
        var input = document.getElementById('steDirectInput');
        if (input && document.activeElement !== input) input.value = String(window.__steState.minutes || 0);
        window.__steUpdatePreview(false);
        return r;
    };
}

// ---------- 6. 初期反映 ----------
window.__steFixContrast();
if (window.renderActivityChart) window.renderActivityChart();

console.log('✍️ 第9回パッチ（コントラスト改善＋1分単位直接入力）適用完了');
// ==========================================================================
// 🧹 第10回パッチ：壊れた勉強時間データの浄化 ＋ 不整合修正 ＋ 管理者リセット
//    ・読み込み/保存/日付跨ぎ時に today秒数・週間ログ を正規化
//      （NaN/負/非数値/24h超/配列崩れ → 自動修復。正当な値は温存）
//    ・保存時に「today秒数」と「週間ログの今日slot」を必ず同時書き
//      → 片方だけ直って145が居座る不整合を根絶
//    ・管理者用：①壊れた値だけ修復 ②今日を0に ③全ログを0に
//               ④ローカルデータを完全消去して再読込（最終手段）
//    ※必ず 第5→6→7→8→9回 の後に貼り付けてください
// ==========================================================================

var STE_DAY_SECS_MAX = 24 * 3600;   // 今日の秒数の上限（24h）
var STE_DAY_MIN_MAX  = 1440;        // 1日の分数上限

// ---------- 1. クランプ補助 ----------
function __steClampSecs(x) {
    var n = Number(x);
    if (!isFinite(n) || isNaN(n)) return 0;
    n = Math.floor(n);
    if (n < 0) return 0;
    if (n > STE_DAY_SECS_MAX) return STE_DAY_SECS_MAX;
    return n;
}
function __steClampMin(x) {
    var n = Number(x);
    if (!isFinite(n) || isNaN(n)) return 0;
    n = Math.floor(n);
    if (n < 0) return 0;
    if (n > STE_DAY_MIN_MAX) return STE_DAY_MIN_MAX;
    return n;
}

// ---------- 2. データ浄化（変化があれば保存＋報告） ----------
window.__steSanitizeStudyData = function(verbose) {
    var changed = false;

    // today 秒数
    var oldSecs = todayStudySeconds;
    var newSecs = __steClampSecs(todayStudySeconds);
    if (newSecs !== oldSecs) { todayStudySeconds = newSecs; changed = true; }

    // 週間ログ：配列保証＋長さ7＋各要素正規化
    if (!Array.isArray(weeklyStudyMinutesLog)) {
        weeklyStudyMinutesLog = [0,0,0,0,0,0,0]; changed = true;
    }
    if (weeklyStudyMinutesLog.length !== 7) {
        var fixed = [];
        for (var i = 0; i < 7; i++) fixed[i] = __steClampMin(weeklyStudyMinutesLog[i]);
        weeklyStudyMinutesLog = fixed; changed = true;
    } else {
        for (var j = 0; j < 7; j++) {
            var om = weeklyStudyMinutesLog[j];
            var nm = __steClampMin(om);
            if (nm !== om) { weeklyStudyMinutesLog[j] = nm; changed = true; }
        }
    }

    if (changed) {
        try {
            localStorage.setItem('core_v4_study_today_secs', String(todayStudySeconds));
            localStorage.setItem('core_v4_study_weekly_log', JSON.stringify(weeklyStudyMinutesLog));
        } catch (e) {}
        if (verbose) {
            console.warn('🧹 勉強時間データを修復しました',
                { todaySecs: [oldSecs, '→', todayStudySeconds],
                  weekly: weeklyStudyMinutesLog.slice() });
        }
    }
    return changed;
};

// 起動時に即浄化
window.__steSanitizeStudyData(true);

// ---------- 3. renderActivityChart ラップ：今日のslot不整合を毎描画で是正 ----------
if (window.renderActivityChart) {
    var __prevRenderV10 = window.renderActivityChart;
    window.renderActivityChart = function() {
        // 描画前に軽量ガード（NaN/負を0に。正当値は触らない）
        if (!isFinite(Number(todayStudySeconds)) || todayStudySeconds < 0) todayStudySeconds = 0;

        var r = __prevRenderV10.apply(this, arguments);

        // ✅ 核心：今日のslotを「today秒数由来」で必ず再確定
        //    → 他経路(Firebase同期/元コード描画)が古い145を戻しても、ここで是正
        var chart = document.getElementById('activityBarChart');
        if (chart) {
            var now = new Date();
            var cur = now.getDay() - 1; if (cur < 0) cur = 6;
            var correctMin = Math.floor(__steClampSecs(todayStudySeconds) / 60);
            // グローバルの log も直す
            if (weeklyStudyMinutesLog[cur] !== correctMin) {
                weeklyStudyMinutesLog[cur] = correctMin;
            }
            // 表示DOMも、今日のバーだけ値/高さを是正（ローリング位置を特定）
            var wraps = chart.querySelectorAll('.bar-wrapper');
            for (var i = 0; i < wraps.length; i++) {
                if (wraps[i].classList.contains('ste-today')) {
                    var fill = wraps[i].querySelector('.bar-fill');
                    var maxV = 0;
                    for (var k = 0; k < 7; k++) maxV = Math.max(maxV, weeklyStudyMinutesLog[k] || 0);
                    var scale = maxV > 0 ? maxV : 1;
                    var pct = correctMin <= 0 ? 0 : Math.max(8, Math.round((correctMin / scale) * 100));
                    if (fill) { fill.style.height = pct + '%'; fill.dataset.zero = correctMin <= 0 ? '1' : '0'; }
                    if (wraps[i].children[0]) wraps[i].children[0].innerText = correctMin + '分';
                    break;
                }
            }
        }
        return r;
    };
}

// ---------- 4. __steSave ラップ：保存時に today と log今日slot を同時書き ----------
if (window.__steSave) {
    var __prevSaveV10 = window.__steSave;
    window.__steSave = function() {
        // 書き込み値を必ずクランプ
        window.__steState.minutes = __steClampMin(window.__steState.minutes);

        var wasToday = window.__steState.isToday;
        var setMin   = window.__steState.minutes;

        var r = __prevSaveV10.apply(this, arguments);

        if (wasToday) {
            // ✅ 不整合根絶：today秒数 と log今日slot を同時に確定
            todayStudySeconds = __steClampSecs(setMin * 60);
            var now = new Date();
            var cur = now.getDay() - 1; if (cur < 0) cur = 6;
            weeklyStudyMinutesLog[cur] = setMin;
            try {
                localStorage.setItem('core_v4_study_today_secs', String(todayStudySeconds));
                localStorage.setItem('core_v4_study_weekly_log', JSON.stringify(weeklyStudyMinutesLog));
            } catch (e) {}
            if (window.__updateStudyTimeDisplay) window.__updateStudyTimeDisplay();
        } else {
            // 過去も念のため正規化して保存
            weeklyStudyMinutesLog[window.__steState.dayIdx] = setMin;
            try { localStorage.setItem('core_v4_study_weekly_log', JSON.stringify(weeklyStudyMinutesLog)); } catch (e) {}
        }
        if (window.renderActivityChart) window.renderActivityChart();
        return r;
    };
}

// ---------- 5. 日付跨ぎ時の浄化（initStudyTimer 内 setInterval を補強） ----------
// 既存の日付跨ぎ処理の“後”に浄化を挟むため、renderActivityChart 経由で既に是正される。
// さらに安全網として、定期的にも浄化（重い処理は変化時のみ保存）。
setInterval(function() { window.__steSanitizeStudyData(false); }, 5000);

// ---------- 6. 管理者用リセットUIをモーダルに注入 ----------
window.__steInjectAdminReset = function() {
    if (document.getElementById('steAdminResetPanel')) return;
    var card = document.querySelector('#studyTimeEditorOverlay .ste-card');
    if (!card) return;
    var footer = card.querySelector('.ste-footer');
    if (!footer) return;

    var panel = document.createElement('div');
    panel.id = 'steAdminResetPanel';
    panel.style.cssText = 'margin-top:14px;padding-top:12px;border-top:1px dashed rgba(255,255,255,.14);display:none;';
    panel.innerHTML =
        '<div style="font-size:10px;font-weight:800;letter-spacing:.06em;color:#fca5a5;margin-bottom:8px;">🛠 管理者：データ修復・リセット</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
            '<button type="button" class="ste-btn-txt" data-act="repair">壊れた値だけ修復</button>' +
            '<button type="button" class="ste-btn-txt" data-act="today0">今日を0に</button>' +
            '<button type="button" class="ste-btn-txt" data-act="week0">全ログを0に</button>' +
            '<button type="button" class="ste-btn-txt ste-danger" data-act="nuke">ローカル完全消去＆再読込</button>' +
        '</div>';
    footer.insertAdjacentElement('afterend', panel);

    // ボタン用ミニスタイル
    if (!document.getElementById('steV10BtnStyle')) {
        var s = document.createElement('style');
        s.id = 'steV10BtnStyle';
        s.textContent =
            '.ste-btn-txt{font-size:11px;font-weight:700;color:#e2e8f0;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:9px;padding:7px 10px;cursor:pointer;font-family:inherit;transition:background .15s,transform .1s;}' +
            '.ste-btn-txt:hover{background:rgba(255,255,255,.14);}' +
            '.ste-btn-txt:active{transform:scale(.95);}' +
            '.ste-btn-txt.ste-danger{color:#fecaca;border-color:rgba(248,113,113,.4);background:rgba(248,113,113,.1);}' +
            '.ste-btn-txt.ste-danger:hover{background:rgba(248,113,113,.2);}';
        document.head.appendChild(s);
    }

    panel.addEventListener('click', function(e) {
        var b = e.target.closest('[data-act]'); if (!b) return;
        var act = b.getAttribute('data-act');
        if (act === 'repair') window.__steRepairData();
        else if (act === 'today0') window.__steResetToday();
        else if (act === 'week0') window.__steResetWeek();
        else if (act === 'nuke') window.__steNukeStudyStorage();
    });
};

// 管理者判定に応じてパネル表示/非表示を同期
window.__steSyncAdminResetPanel = function() {
    var panel = document.getElementById('steAdminResetPanel');
    if (!panel) return;
    panel.style.display = (window.__steIsAdmin && window.__steIsAdmin()) ? 'block' : 'none';
};

// inject / open をラップして注入＋同期
if (window.__injectStudyTimeEditor) {
    var __origInjV10 = window.__injectStudyTimeEditor;
    window.__injectStudyTimeEditor = function() {
        var r = __origInjV10.apply(this, arguments);
        window.__steInjectAdminReset();
        window.__steSyncAdminResetPanel();
        return r;
    };
}
if (window.__openStudyTimeEditor) {
    var __origOpenV10 = window.__openStudyTimeEditor;
    window.__openStudyTimeEditor = function(dayIdx) {
        var r = __origOpenV10.apply(this, arguments);
        window.__steInjectAdminReset();
        window.__steSyncAdminResetPanel();
        return r;
    };
}

// ---------- 7. リセット系コマンド ----------
window.__steRepairData = function() {
    var before = JSON.stringify({ s: todayStudySeconds, w: weeklyStudyMinutesLog });
    window.__steSanitizeStudyData(true);
    var after = JSON.stringify({ s: todayStudySeconds, w: weeklyStudyMinutesLog });
    if (window.renderActivityChart) window.renderActivityChart();
    if (window.__updateStudyTimeDisplay) window.__updateStudyTimeDisplay();
    if (window.__steToast) window.__steToast(before === after ? '壊れた値はありませんでした ✓' : '壊れた値を修復しました 🧹');
};

window.__steResetToday = function() {
    if (!confirm('今日の勉強時間を 0分 にリセットしますか？\n（過去のログは維持されます）')) return;
    todayStudySeconds = 0;
    var now = new Date(); var cur = now.getDay() - 1; if (cur < 0) cur = 6;
    weeklyStudyMinutesLog[cur] = 0;
    try {
        localStorage.setItem('core_v4_study_today_secs', '0');
        localStorage.setItem('core_v4_study_weekly_log', JSON.stringify(weeklyStudyMinutesLog));
    } catch (e) {}
    if (window.__updateStudyTimeDisplay) window.__updateStudyTimeDisplay();
    if (window.renderActivityChart) window.renderActivityChart();
    if (window.__steToast) window.__steToast('今日を 0分 にリセットしました ✓');
};

window.__steResetWeek = function() {
    if (!confirm('最近7日間のログをすべて 0分 にリセットしますか？\n（今日も含みます。元に戻せません）')) return;
    todayStudySeconds = 0;
    weeklyStudyMinutesLog = [0,0,0,0,0,0,0];
    try {
        localStorage.setItem('core_v4_study_today_secs', '0');
        localStorage.setItem('core_v4_study_weekly_log', JSON.stringify(weeklyStudyMinutesLog));
    } catch (e) {}
    if (window.__updateStudyTimeDisplay) window.__updateStudyTimeDisplay();
    if (window.renderActivityChart) window.renderActivityChart();
    if (window.__steToast) window.__steToast('7日間のログをリセットしました ✓');
};

// 最終手段：ローカルの勉強時間データを根こそぎ消して再読込
window.__steNukeStudyStorage = function() {
    if (!confirm('⚠️ 最終手段：ローカルに保存された勉強時間データを完全に消去して再読み込みします。\n\n壊れた値が居座る場合に使います。よろしいですか？')) return;
    if (!confirm('本当に消去して再読み込みしますか？（この操作は取り消せません）')) return;
    try {
        localStorage.removeItem('core_v4_study_today_secs');
        localStorage.removeItem('core_v4_study_weekly_log');
        localStorage.removeItem('core_v4_study_last_date');
    } catch (e) {}
    location.reload();
};

// ---------- 8. 初期反映 ----------
window.__steSanitizeStudyData(true);
if (window.renderActivityChart) window.renderActivityChart();

console.log('🧹 第10回パッチ（データ浄化＋不整合修正＋管理者リセット）適用完了');
// ==========================================================================
// 🧬 第11回パッチ：ローカル汚染の根絶 ＋ Firebase 単一ソース化
//    ・localStorage を乗っ取り、アプリ独自キーを「アカウント(UID)単位」に隔離
//      → ログインを変えても別アカウントの残骸は見えない（汚染の根絶）
//    ・ログイン切り替えを検知 → メモリ残骸をリセット → Firebase 値で再ロード
//    ・読み込みは Firebase 優先（ローカルはオフライン用キャッシュに格下げ）
//    ・モードN で勉強時間キーのローカル書き込みを完全無効化（Firebase 一本）
//    ・起動時に旧設計の残骸を自己診断して可視化
//    ※必ず 第5→6→7→8→9→10回 の後に貼り付けてください
// ==========================================================================

// ===================== 0. 設定 =====================
// モードS=UID隔離(既定) / モードN=ローカル完全無効
window.__STE_LOCAL_MODE = (window.__STE_LOCAL_MODE === 'N') ? 'N' : 'S';
// 攻撃的モード：true にすると除外リスト以外「全部」のキーをUID隔離
// （自分のアプリのキー構成が core_v4_ 以外も混ざる場合にON）
window.__STE_NAMESPACE_ALL = !!window.__STE_NAMESPACE_ALL;

// 乗っ取り対象にする「アプリ独自キー」のプレフィックス（攻撃的モードOFF時）
var STE_APP_PREFIXES = ['core_v4_', 'aiglish_', 'study_', 'user_stats', 'userStats'];
// 絶対に乗っ取らないキー（Firebase/認証/サードパーティ/一時キー）
var STE_PASSTHROUGH = [
    'firebase:', 'firebase_', 'IndexedDB', 'amplitude', 'sentry', 'gtag', 'ga_',
    '_ga', 'fbq', 'csrf', 'token', 'auth', 'session', 'refresh', 'idb-',
    'workbox', 'precache', '__ste_'
];
// 勉強時間まわりのキー（モードN で書き込み無効にする対象）
var STE_STUDY_KEYS = ['core_v4_study_today_secs', 'core_v4_study_weekly_log', 'core_v4_study_last_date'];

// ===================== 1. 状態 =====================
var __steUid = null;                 // 現在ログイン中のUID（null=未確定/未ログイン）
var __steLastSeenUid = null;         // 切り替え検知用
var __steAnonBucket = '__anon__';
var __steNsPrefix = '__ste_ns::';

function __steIsPassthrough(key) {
    if (typeof key !== 'string') return true;
    var k = key.toLowerCase();
    for (var i = 0; i < STE_PASSTHROUGH.length; i++) {
        if (k.indexOf(STE_PASSTHROUGH[i].toLowerCase()) >= 0) return true;
    }
    return false;
}
function __steIsAppKey(key) {
    if (typeof key !== 'string') return false;
    if (window.__STE_NAMESPACE_ALL) return true;
    for (var i = 0; i < STE_APP_PREFIXES.length; i++) {
        if (key.indexOf(STE_APP_PREFIXES[i]) === 0) return true;
    }
    return false;
}
function __steIsStudyKey(key) {
    return STE_STUDY_KEYS.indexOf(key) >= 0;
}
function __steBucket() { return __steUid || __steAnonBucket; }
function __steNsKey(key) { return __steNsPrefix + __steBucket() + '::' + key; }
function __steShouldNamespace(key) {
    if (__steIsPassthrough(key)) return false;
    return __steIsAppKey(key);
}
// モードN：勉強時間キーの「書き込み」だけ無効化（読みは隔離バケットを返す）
function __steBlockWrite(key) {
    return (window.__STE_LOCAL_MODE === 'N') && __steIsStudyKey(key);
}

// ===================== 2. localStorage 乗っ取り =====================
(function __steHijackStorage() {
    if (window.__steStorageHijacked) return;
    var ls = window.localStorage;
    if (!ls) return;
    var _set = ls.setItem.bind(ls);
    var _get = ls.getItem.bind(ls);
    var _rem = ls.removeItem.bind(ls);

    try {
        ls.setItem = function(key, val) {
            try {
                if (__steShouldNamespace(key)) {
                    if (__steBlockWrite(key)) return;            // モードN：勉強時間はローカルへ書かない
                    return _set(__steNsKey(key), val);
                }
            } catch (e) {}
            return _set(key, val);
        };
        ls.getItem = function(key) {
            try {
                if (__steShouldNamespace(key)) {
                    if (__steBlockWrite(key)) return null;       // モードN：勉強時間はローカルから読まない
                    return _get(__steNsKey(key));
                }
            } catch (e) {}
            return _get(key);
        };
        ls.removeItem = function(key) {
            try {
                if (__steShouldNamespace(key)) return _rem(__steNsKey(key));
            } catch (e) {}
            return _rem(key);
        };
        window.__steStorageHijacked = true;
        window.__steRawGet = _get;   // 自己診断用に素のgetItemを退避
    } catch (e) {
        console.warn('🧬 localStorage 乗っ取りに失敗しました', e);
    }
})();

// ===================== 3. UID 監視（Firebase v8/v9 両対応） =====================
function __steGetAuth() {
    try {
        // v9 modular がグローバルに展開されている場合
        if (window.firebase && firebase.auth) return firebase.auth();
        if (window.getAuth) return window.getAuth();
        if (window.firebase && firebase.auth && firebase.auth()) return firebase.auth();
    } catch (e) {}
    return null;
}
function __steAttachAuth() {
    var auth = __steGetAuth();
    if (!auth || !auth.onAuthStateChanged) {
        // 認証準備を待つ（既存コードの初期化待ち）
        setTimeout(__steAttachAuth, 600);
        return;
    }
    auth.onAuthStateChanged(function(user) {
        var newUid = user ? (user.uid || null) : null;
        __steOnUidChange(newUid);
    });
    // 既にログイン済みの場合も即時反映
    try {
        var cu = auth.currentUser;
        if (cu && cu.uid) __steOnUidChange(cu.uid);
    } catch (e) {}
}

// ===================== 4. UID 切り替え時の処理 =====================
function __steOnUidChange(newUid) {
    if (newUid === __steLastSeenUid) return;   // 変化なし
    var prev = __steLastSeenUid;
    __steUid = newUid;
    __steLastSeenUid = newUid;

    // (a) メモリ残骸を一旦リセット（旧ユーザーの値が画面に残るのを防ぐ）
    try { todayStudySeconds = 0; } catch (e) {}
    try { weeklyStudyMinutesLog = [0,0,0,0,0,0,0]; } catch (e) {}

    // (b) Firebase を正として再ロード（既存 load 関数を総当たり）
    var loaders = ['loadLocalState','loadFromFirebase','loadUserData','syncFromFirebase',
                   'fetchUserData','__loadState','loadState','refreshUserData'];
    var called = false;
    for (var i = 0; i < loaders.length; i++) {
        if (typeof window[loaders[i]] === 'function') {
            try { window[loaders[i]](); called = true; break; } catch (e) {}
        }
    }
    // (c) 表示を即時更新
    try { if (window.__updateStudyTimeDisplay) window.__updateStudyTimeDisplay(); } catch (e) {}
    try { if (window.renderActivityChart) window.renderActivityChart(); } catch (e) {}

    console.log('🧬 ログインUID切り替え', { from: prev, to: newUid, firebaseReload: called });
    if (!called) {
        console.warn('🧬 Firebase再ロード関数が見つかりませんでした。' +
            '★ カスタマイズ：window.__STE_RELOAD_FN = "あなたのload関数名" を設定すると確実です。');
    }
    // (d) 状態UI・診断を同期
    __steSyncModeUI();
    __steSelfDiagnose();
}
// 明示指定があればそれを最優先
if (window.__STE_RELOAD_FN && typeof window[window.__STE_RELOAD_FN] === 'function') {
    var __origOnUid = __steOnUidChange;
    __steOnUidChange = function(uid) {
        __origOnUid(uid);
        try { window[window.__STE_RELOAD_FN](); } catch (e) {}
    };
}

// ===================== 5. 自己診断（旧設計の残骸を可視化） =====================
window.__steSelfDiagnose = function() {
    if (!window.__steRawGet) return;
    var residue = [];
    for (var i = 0; i < STE_STUDY_KEYS.length; i++) {
        var raw = window.__steRawGet(STE_STUDY_KEYS[i]);   // 素のキー（旧設計の書き込み先）
        if (raw !== null && raw !== undefined && raw !== '') residue.push(STE_STUDY_KEYS[i]);
    }
    if (residue.length > 0) {
        console.warn('🧬 旧設計のローカル残骸を検出（アカウント非紐づけのゴミ）:', residue,
            '→ 現在はUIDバケット[' + __steBucket() + ']のみ参照するため混入しません。' +
            '完全に消したい場合は管理者リセット「ローカル完全消去」を実行。');
        __steShowResidueBanner(residue.length);
    }
};

var __steBannerShown = false;
function __steShowResidueBanner(n) {
    if (__steBannerShown) return;
    __steBannerShown = true;
    var b = document.createElement('div');
    b.id = 'steResidueBanner';
    b.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%) translateY(-12px);' +
        'z-index:10001;max-width:calc(100vw - 24px);background:linear-gradient(135deg,#3b2f08,#5a3d0a);' +
        'color:#fde68a;font-size:12px;font-weight:700;padding:10px 16px;border-radius:12px;' +
        'border:1px solid rgba(251,191,36,.45);box-shadow:0 12px 32px rgba(0,0,0,.45);' +
        'opacity:0;transition:opacity .3s,transform .3s;line-height:1.4;pointer-events:auto;';
    b.innerHTML = '⚠️ ブラウザに旧形式の残骸(' + n + '件)を検出。今は隔離済みで混入しません。' +
        '<span id="steResidueClose" style="margin-left:10px;cursor:pointer;opacity:.8;text-decoration:underline;">閉じる</span>';
    document.body.appendChild(b);
    requestAnimationFrame(function() { b.style.opacity = '1'; b.style.transform = 'translateX(-50%) translateY(0)'; });
    var hide = function() { b.style.opacity = '0'; b.style.transform = 'translateX(-50%) translateY(-12px)'; setTimeout(function(){ b.remove(); }, 320); };
    b.querySelector('#steResidueClose').addEventListener('click', hide);
    setTimeout(hide, 9000);
}

// ===================== 6. モード切替UI（管理者パネル内） =====================
(function __steModeStyle() {
    if (document.getElementById('steV11Style')) return;
    var s = document.createElement('style');
    s.id = 'steV11Style';
    s.textContent = [
        '.ste-mode-panel{margin-top:12px;padding-top:12px;border-top:1px dashed rgba(255,255,255,.14);display:none;}',
        '.ste-mode-title{font-size:10px;font-weight:800;letter-spacing:.06em;color:#67e8f9;margin-bottom:9px;display:flex;align-items:center;gap:6px;}',
        '.ste-mode-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px;}',
        '.ste-mode-label{font-size:11px;font-weight:700;color:#dbe4f0;line-height:1.3;}',
        '.ste-mode-label small{display:block;color:#8b93a7;font-weight:600;font-size:9.5px;margin-top:2px;}',
        // トグル
        '.ste-toggle{position:relative;flex:0 0 auto;width:46px;height:26px;border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.16);cursor:pointer;transition:background .25s,border-color .25s;}',
        '.ste-toggle::after{content:"";position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#e2e8f0;box-shadow:0 2px 6px rgba(0,0,0,.4);transition:transform .28s cubic-bezier(.2,.9,.3,1.3),background .25s;}',
        '.ste-toggle.on{background:linear-gradient(135deg,#22d3ee,#0e7490);border-color:rgba(34,211,238,.5);}',
        '.ste-toggle.on::after{transform:translateX(20px);background:#ecfeff;}',
        '.ste-toggle.warn.on{background:linear-gradient(135deg,#f59e0b,#b45309);border-color:rgba(245,158,11,.5);}',
        // 保存先インジケータ
        '.ste-sink{display:inline-flex;align-items:center;gap:7px;font-size:10px;font-weight:800;color:#bbf7d0;background:rgba(34,197,94,.12);border:1px solid rgba(74,222,128,.3);padding:5px 10px;border-radius:999px;margin-top:2px;}',
        '.ste-sink .dot{width:7px;height:7px;border-radius:50%;background:#4ade80;box-shadow:0 0 0 0 rgba(74,222,128,.6);animation:steSinkPulse 1.8s ease-out infinite;}',
        '@keyframes steSinkPulse{0%{box-shadow:0 0 0 0 rgba(74,222,128,.55)}100%{box-shadow:0 0 0 8px rgba(74,222,128,0)}}',
        '.ste-sink.n{color:#fde68a;background:rgba(245,158,11,.12);border-color:rgba(251,191,36,.32);}',
        '.ste-sink.n .dot{background:#fbbf24;animation-name:steSinkPulseN;}',
        '@keyframes steSinkPulseN{0%{box-shadow:0 0 0 0 rgba(251,191,36,.55)}100%{box-shadow:0 0 0 8px rgba(251,191,36,0)}}'
    ].join('\n');
    document.head.appendChild(s);
})();

window.__steInjectModePanel = function() {
    if (document.getElementById('steModePanel')) return;
    var card = document.querySelector('#studyTimeEditorOverlay .ste-card');
    if (!card) return;
    var footer = card.querySelector('.ste-footer');
    if (!footer) return;

    var panel = document.createElement('div');
    panel.id = 'steModePanel';
    panel.className = 'ste-mode-panel';
    panel.innerHTML =
        '<div class="ste-mode-title">🧬 保存先の制御（アカウント汚染対策）</div>' +
        '<div class="ste-mode-row">' +
            '<div class="ste-mode-label">ローカル完全無効（Firebase 一本）' +
                '<small>ON=勉強時間をローカルへ書かない／ズレ根絶・オフライン非対応</small></div>' +
            '<div class="ste-toggle warn" id="steToggleN" role="switch"></div>' +
        '</div>' +
        '<div class="ste-mode-row">' +
            '<div class="ste-mode-label">全キーをアカウント隔離' +
                '<small>ON=勉強時間以外もUID隔離（混ざる範囲が広い時に）</small></div>' +
            '<div class="ste-toggle" id="steToggleAll" role="switch"></div>' +
        '</div>' +
        '<div class="ste-sink" id="steSinkBadge"><span class="dot"></span><span id="steSinkText"></span></div>';
    footer.insertAdjacentElement('afterend', panel);

    document.getElementById('steToggleN').addEventListener('click', function() {
        window.__STE_LOCAL_MODE = (window.__STE_LOCAL_MODE === 'N') ? 'S' : 'N';
        try { localStorage.setItem('__ste_pref_mode', window.__STE_LOCAL_MODE); } catch (e) {}
        __steSyncModeUI();
        if (window.__steToast) window.__steToast(window.__STE_LOCAL_MODE === 'N' ? '🧬 ローカル無効化（Firebase 一本）' : '🧬 UID隔離モードに戻しました');
    });
    document.getElementById('steToggleAll').addEventListener('click', function() {
        window.__STE_NAMESPACE_ALL = !window.__STE_NAMESPACE_ALL;
        try { localStorage.setItem('__ste_pref_all', window.__STE_NAMESPACE_ALL ? '1' : '0'); } catch (e) {}
        __steSyncModeUI();
        if (window.__steToast) window.__steToast(window.__STE_NAMESPACE_ALL ? '🧬 全キー隔離 ON' : '🧬 全キー隔離 OFF');
    });
};

window.__steSyncModeUI = function() {
    var panel = document.getElementById('steModePanel');
    if (!panel) return;
    var admin = (window.__steIsAdmin && window.__steIsAdmin());
    panel.style.display = admin ? 'block' : 'none';

    var tN = document.getElementById('steToggleN');
    var tAll = document.getElementById('steToggleAll');
    if (tN) tN.classList.toggle('on', window.__STE_LOCAL_MODE === 'N');
    if (tAll) tAll.classList.toggle('on', !!window.__STE_NAMESPACE_ALL);

    var badge = document.getElementById('steSinkBadge');
    var txt = document.getElementById('steSinkText');
    if (badge && txt) {
        if (window.__STE_LOCAL_MODE === 'N') {
            badge.className = 'ste-sink n';
            txt.textContent = '保存先：Firebase のみ（ローカル無効）／UID=' + (__steUid ? __steUid.slice(0,6)+'…' : '未ログイン');
        } else {
            badge.className = 'ste-sink';
            txt.textContent = '保存先：Firebase ＋ ローカル(UID隔離) ／UID=' + (__steUid ? __steUid.slice(0,6)+'…' : '未ログイン');
        }
    }
};

// 設定の永続化（この2つだけはUID非依存で素のキーに覚えておく＝乗っ取り対象外プレフィックス）
try {
    var pm = window.__steRawGet ? window.__steRawGet('__ste_pref_mode') : null;
    if (pm === 'N' || pm === 'S') window.__STE_LOCAL_MODE = pm;
    var pa = window.__steRawGet ? window.__steRawGet('__ste_pref_all') : null;
    if (pa === '1') window.__STE_NAMESPACE_ALL = true;
    if (pa === '0') window.__STE_NAMESPACE_ALL = false;
} catch (e) {}

// inject / open をラップ
if (window.__injectStudyTimeEditor) {
    var __oiV11 = window.__injectStudyTimeEditor;
    window.__injectStudyTimeEditor = function() {
        var r = __oiV11.apply(this, arguments);
        window.__steInjectModePanel(); window.__steSyncModeUI(); return r;
    };
}
if (window.__openStudyTimeEditor) {
    var __ooV11 = window.__openStudyTimeEditor;
    window.__openStudyTimeEditor = function(dayIdx) {
        var r = __ooV11.apply(this, arguments);
        window.__steInjectModePanel(); window.__steSyncModeUI(); return r;
    };
}

// ===================== 7. 起動 =====================
__steAttachAuth();
setTimeout(__steSelfDiagnose, 1200);   // 既存初期化が落ち着いた頃に診断
setInterval(__steSyncModeUI, 1000);     // 管理者状態・UID表示を同期

console.log('🧬 第11回パッチ適用完了',
    { mode: window.__STE_LOCAL_MODE, namespaceAll: window.__STE_NAMESPACE_ALL,
      hijacked: window.__steStorageHijacked });
// ===== 窓（fix.js 用ブリッジ・差し替え版）：app.js の一番下に1回だけ =====
(function() {
    function snap() {
        return {
            myId: (typeof myId !== "undefined") ? myId : null,
            totalExp: (typeof totalExp !== "undefined") ? totalExp : null,
            myName: (typeof myName !== "undefined") ? myName : null,
            selectedTitle: (typeof selectedTitle !== "undefined") ? selectedTitle : null,
            myTarget: (typeof myTarget !== "undefined") ? myTarget : null,
            myFriendList: (typeof myFriendList !== "undefined") ? myFriendList : null,
            userStats: (typeof userStats !== "undefined") ? userStats : null,
            todayStudySeconds: (typeof todayStudySeconds !== "undefined") ? todayStudySeconds : null,
            weeklyStudyMinutesLog: (typeof weeklyStudyMinutesLog !== "undefined") ? weeklyStudyMinutesLog : null,
            lastAccessDateStr: (typeof lastAccessDateStr !== "undefined") ? lastAccessDateStr : null,
            wordMemory: (typeof wordMemory !== "undefined") ? wordMemory : null,
            textHistory: (typeof textHistory !== "undefined") ? textHistory : null,
            myBookshelf: (typeof myBookshelf !== "undefined") ? myBookshelf : null,
            myFolders: (typeof myFolders !== "undefined") ? myFolders : null
        };
    }
    // レベル計算関数を検出（exp→level。引数を見て単調に変わるものだけ採用＝でっち上げ防止）
    var _lv = null;
    var _names = ['getLevelFromExp', 'calcLevelFromExp', 'levelFromExp', 'calculateLevel', 'getLevelByExp', 'expToLevel', 'getLevel', 'levelOf', 'calcLevel', 'getLvFromExp', 'getLv', 'levelFromTotalExp', 'getLevelByTotalExp'];
    for (var i = 0; i < _names.length; i++) {
        try {
            var fn = eval(_names[i]);
            if (typeof fn === 'function') {
                var t0 = fn(0),
                    t1 = fn(1000000);
                if (typeof t0 === 'number' && typeof t1 === 'number' && isFinite(t0) && isFinite(t1) && t1 > t0) { _lv = fn; break; }
            }
        } catch (e) {}
    }
    setInterval(function() {
        var s = snap();
        s.levelFromExp = _lv; // 本体のレベル計算式を fix.js へ橋渡し
        window.__bridge = s;
        var w = window.__bridgeWrite; // fix.js → 本体 へ
        if (w) { window.__bridgeWrite = null; for (var k in w) { try { if (typeof eval(k) !== "undefined") eval(k + " = w[k]"); } catch (e) {} } }
    }, 120);
})();
// ==========================================================================
//  app.js 末尾パッチ：データリセット後の“復活”を根治（理解度は残す）
//    症状：管理者リセット後も各端末のローカル旧値が残り、ログイン時の
//          「大きい方を採用＋クラウドへ書き戻し」で0が旧値に巻き戻っていた。
//    根治：読み込みの“先頭”でリセット世代を比較し、世代より古いローカル派生を
//          先に0へ落としてから本来の読み込みへ進む＝0 vs 0 で復活不能。
//    保持：理解度(core_v4_user_vocab_progress_*)・wordMemory・単語/長文/本棚/
//          フレンド/目標 は一切触らない（＝理解度は残る）。
//    ※ fix.js / multi.js / style.css / index.html は不変更
// ==========================================================================
(function applyResetResurrectionFix() {
"use strict";
if (window.__resetResurrectionFixApplied) return;
window.__resetResurrectionFixApplied = true;

function rrToday() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function rrLocalGen(id) { try { return parseInt(localStorage.getItem('__ste_reset_gen_' + id)) || 0; } catch (e) { return 0; } }
function rrSetLocalGen(id, g) { try { localStorage.setItem('__ste_reset_gen_' + id, String(g)); } catch (e) {} }
function rrFetchCloudGen() {
if (!window.db || !window.fbGetDoc || !window.fbDoc) return Promise.resolve(0);
try {
return Promise.resolve(window.fbGetDoc(window.fbDoc(window.db, 'shared', 'app_settings')))
.then(function (s) { return (s && s.exists() && s.data() && s.data().resetGeneration) ? (parseInt(s.data().resetGeneration) || 0) : 0; })
.catch(function () { return 0; });
} catch (e) { return Promise.resolve(0); }
}
function rrResetDerived(stats) {
stats = stats || {};
return {
test_count: 0, combo_max: 0, multi_win: 0, high_score: 0, mistake_count: 0,
vocab_reg: 0, vocab_fixed: 0, delete_count: 0, study_burst: 0, reader_open: 0,
flash_count: 0, user_level: 1, gold_spent: 0,
goal_text: stats.goal_text || '',
friends_count: (typeof stats.friends_count === 'number') ? stats.friends_count : 0,
weekly_rank_first: false,
seasonTitles: Array.isArray(stats.seasonTitles) ? stats.seasonTitles : [],
settledSeasons: Array.isArray(stats.settledSeasons) ? stats.settledSeasons : [],
study_total_secs: 0, study_today_secs: 0, study_week_secs: 0,
study_today_date: rrToday(), study_week_key: ''
};
}
function rrWipeKeepProgress() {
try { totalExp = 0; } catch (e) {}
try { selectedTitle = '称号なし'; } catch (e) {}
try { userStats = rrResetDerived(userStats); } catch (e) {}
try { todayStudySeconds = 0; } catch (e) {}
try { weeklyStudyMinutesLog = [0, 0, 0, 0, 0, 0, 0]; } catch (e) {}
try { rewardedTitlesStepsCache = {}; } catch (e) {}
var id = (typeof myId !== 'undefined' && myId) ? myId : '';
try {
localStorage.setItem('core_v4_totalExp', '0');
localStorage.setItem('core_v4_userTitle', '称号なし');
localStorage.setItem('core_v4_rewarded_titles_cache', '{}');
localStorage.setItem('core_v4_study_today_secs', '0');
localStorage.setItem('core_v4_study_weekly_log', '[0,0,0,0,0,0,0]');
localStorage.setItem('core_v4_study_last_date', rrToday());
localStorage.setItem('core_v4_study_total_secs', '0');
if (id) localStorage.setItem('core_v4_user_stats_' + id, JSON.stringify(userStats));
var rm = [];
for (var i = 0; i < localStorage.length; i++) {
var k = localStorage.key(i); if (!k) continue;
if (k.indexOf('cosmic_score_') === 0 || k.indexOf('cosmic_best_') === 0 || k.indexOf('season_best_') === 0) rm.push(k);
}
rm.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
// 理解度 / wordMemory / 単語 / 長文 / 本棚 / フレンド / 目標 は意図的に触らない
} catch (e) {}
}

var __prevLoadLocalStateForRR = window.loadLocalState;
window.loadLocalState = async function () {
try {
var id = (typeof myId !== 'undefined' && myId && myId !== 'GUEST-000') ? myId : null;
if (id) {
var cloudGen = await rrFetchCloudGen();
var lgen = rrLocalGen(id);
if (cloudGen > 0 && cloudGen > lgen) {
rrWipeKeepProgress();
rrSetLocalGen(id, cloudGen);
try { window.__fixLastGen = cloudGen; } catch (e) {}
}
}
} catch (e) {}
return __prevLoadLocalStateForRR ? __prevLoadLocalStateForRR.apply(this, arguments) : undefined;
};
console.log('🧹 app.js 末尾パッチ（リセット復活根治：理解度保持のまま派生データのみ無効化）適用完了');
})();
