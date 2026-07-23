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
// 👤 ユーザー別理解度パッチ（テキスト38.txt の末尾に追記）
// ==========================================================================

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

  return [
    String(w.num || ""),
    String(w.word || "").trim().toLowerCase(),
    texts
  ].join("::");
};

window.stripVocabProgressFromWords = function(words) {
  return (words || []).map(function(w) {
    var clean = {
      num: w.num,
      word: w.word,
      meaning: w.meaning || "",
      sub: w.sub || ""
    };

    if (Array.isArray(w.meanings) && w.meanings.length > 0) {
      clean.meanings = w.meanings.map(function(m, i) {
        return {
          id: m.id || (String(w.num) + "-" + i),
          text: m.text || ""
        };
      });
    }

    return clean;
  });
};

window.migrateVocabData = function(words) {
  return (words || []).map(function(w) {
    if (!w.meanings || !Array.isArray(w.meanings) || w.meanings.length === 0) {
      w.meanings = [];
      let mStr = w.meaning || "";
      const hasCircle = /[①-⑳]/.test(mStr);

      if (hasCircle) {
        let parts = mStr.split(/(?=[①-⑳])/).map(p => p.replace(/[①-⑳]/g, "").trim()).filter(p => p);
        w.meanings = parts.map((p, i) => ({
          id: `${w.num}-${i}`,
          text: p,
          status: "none",
          history: []
        }));
      } else {
        w.meanings.push({
          id: `${w.num}-0`,
          text: mStr.trim(),
          status: "none",
          history: []
        });
      }
    } else {
      w.meanings = w.meanings.map(function(m, i) {
        return {
          id: m.id || `${w.num}-${i}`,
          text: m.text || "",
          status: "none",
          history: []
        };
      });
    }

    if (!w.status) w.status = "none";
    if (!w.history) w.history = [];

    return w;
  });
};

window.wordOverallStatus = function(w) {
  if (!w.meanings || w.meanings.length === 0) return "none";

  const sts = w.meanings.map(m => m.status || "none");

  if (sts.every(s => s === "ok")) return "ok";
  if (sts.some(s => s === "bad")) return "bad";
  if (sts.some(s => s === "so")) return "so";
  if (sts.some(s => s === "ok")) return "ok";

  return "none";
};

window.extractUserProgressFromVocabList = function() {
  var progress = {};

  vocabList.forEach(function(w) {
    var key = String(w.num);

    var wordProgress = {
      sig: window.buildWordSignature(w),
      status: w.status || "none",
      history: Array.isArray(w.history) ? w.history.slice(-20) : [],
      meanings: {}
    };

    (w.meanings || []).forEach(function(m) {
      wordProgress.meanings[m.id] = {
        status: m.status || "none",
        history: Array.isArray(m.history) ? m.history.slice(-20) : []
      };
    });

    progress[key] = wordProgress;
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
      return {
        id: m.id,
        text: m.text,
        status: "none",
        history: []
      };
    });

    if (p && p.sig === window.buildWordSignature(w)) {
      w.status = p.status || "none";
      w.history = Array.isArray(p.history) ? p.history.slice(-20) : [];

      w.meanings = w.meanings.map(function(m) {
        var mp = p.meanings ? p.meanings[m.id] : null;

        if (mp) {
          return {
            id: m.id,
            text: m.text,
            status: mp.status || "none",
            history: Array.isArray(mp.history) ? mp.history.slice(-20) : []
          };
        }

        return m;
      });
    }

    return w;
  });

  if (typeof window.rebuildVocabStemIndex === "function") {
    window.rebuildVocabStemIndex();
  }

  userStats.vocab_fixed = vocabList.filter(function(w) {
    return w.meanings && w.meanings.some(function(m) {
      return m.status === "ok";
    });
  }).length;
};

window.loadUserVocabProgress = async function(bookKey) {
  bookKey = bookKey || currentTextbook || "default";
  currentUserVocabProgress = {};

  if (typeof myId === "undefined" || !myId) return;

  if (myId === "GUEST-000" || !window.db || !window.fbGetDoc || !window.fbDoc) {
    try {
      var raw = localStorage.getItem(window.getVocabProgressStorageKey(bookKey));
      if (raw) currentUserVocabProgress = JSON.parse(raw) || {};
    } catch (e) {}
    return;
  }

  try {
    const ref = window.fbDoc(window.db, "users", myId, "vocabProgress", bookKey);
    const snap = await window.fbGetDoc(ref);

    if (snap.exists() && snap.data() && snap.data().words) {
      currentUserVocabProgress = snap.data().words;
    } else {
      currentUserVocabProgress = {};
    }
  } catch (e) {
    console.error("ユーザー単語進捗の読み込みエラー:", e);

    try {
      var raw = localStorage.getItem(window.getVocabProgressStorageKey(bookKey));
      if (raw) currentUserVocabProgress = JSON.parse(raw) || {};
    } catch (err) {}
  }
};

window.saveUserVocabProgress = async function() {
  if (typeof window.rebuildVocabStemIndex === "function") {
    window.rebuildVocabStemIndex();
  }

  if (typeof myId === "undefined" || !myId) return;

  const bookKey = currentTextbook || "default";

  currentUserVocabProgress = window.extractUserProgressFromVocabList();

  const payload = {
    words: currentUserVocabProgress,
    updatedAt: new Date().toISOString()
  };

  try {
    localStorage.setItem(window.getVocabProgressStorageKey(bookKey), JSON.stringify(currentUserVocabProgress));
  } catch (e) {}

  if (window.db && window.fbSetDoc && window.fbDoc && myId && myId !== "GUEST-000") {
    try {
      const ref = window.fbDoc(window.db, "users", myId, "vocabProgress", bookKey);
      await window.fbSetDoc(ref, payload);
    } catch (e) {
      console.error("ユーザー単語進捗の保存エラー:", e);
    }
  }

  userStats.vocab_fixed = vocabList.filter(function(w) {
    return w.meanings && w.meanings.some(function(m) {
      return m.status === "ok";
    });
  }).length;
};

window.saveVocabMasterToStorage = async function() {
  if (typeof window.rebuildVocabStemIndex === "function") {
    window.rebuildVocabStemIndex();
  }

  const bookKey = currentTextbook || "default";
  const uid = (typeof myId !== "undefined" && myId) ? myId : "GUEST-000";
  const masterWords = window.stripVocabProgressFromWords(vocabList);

  textbooksCacheMap[bookKey] = masterWords;

  try {
    localStorage.setItem(`core_v4_cache_${bookKey}`, JSON.stringify(masterWords));
    localStorage.setItem(`core_v4_custom_words_${uid}_${bookKey}`, JSON.stringify(masterWords));
  } catch (e) {}

  if (window.db && window.fbSetDoc && window.fbDoc) {
    try {
      const docName = currentTextbook ? `vocab_${currentTextbook}` : "vocab";
      const sharedRef = window.fbDoc(window.db, "shared", docName);

      await window.fbSetDoc(sharedRef, {
        custom_words: masterWords,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.error("Firebaseの単語マスタ保存に失敗しました:", e);
    }
  }
};

window.saveVocabToStorage = async function() {
  if (typeof window.rebuildVocabStemIndex === "function") {
    window.rebuildVocabStemIndex();
  }

  await window.saveUserVocabProgress();

  if (window.isAdmin) {
    await window.saveVocabMasterToStorage();
  }
};

window.preloadAllTextbooksAndVocab = async function() {
  await window.syncTextbooksIndexFromFirestore();

  if (window.db && window.fbGetDoc && window.fbDoc) {
    for (const book of textbooksPool) {
      try {
        const docName = `vocab_${book.id}`;
        const sharedRef = window.fbDoc(window.db, "shared", docName);
        const sharedSnap = await window.fbGetDoc(sharedRef);

        if (sharedSnap.exists() && sharedSnap.data().custom_words) {
          const masterWords = window.stripVocabProgressFromWords(sharedSnap.data().custom_words);
          textbooksCacheMap[book.id] = masterWords;
          localStorage.setItem(`core_v4_cache_${book.id}`, JSON.stringify(masterWords));
        }
      } catch (e) {}
    }
  }
};

window.loadCurrentTextbookData = async function() {
  let storedWords = [];
  const bookKey = currentTextbook || "default";
  const uid = (typeof myId !== "undefined" && myId) ? myId : "GUEST-000";
  const currentLocalKey = `core_v4_custom_words_${uid}_${bookKey}`;

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

  storedWords = window.stripVocabProgressFromWords(storedWords);
  vocabList = window.migrateVocabData(storedWords);

  await window.loadUserVocabProgress(bookKey);
  window.applyUserProgressToVocabList();

  if (typeof window.rebuildVocabStemIndex === "function") {
    window.rebuildVocabStemIndex();
  }

  userStats.vocab_reg = vocabList.length;

  window.updateFlashcardSourceSelectOptions();
  window.renderVocabList();

  const currentBook = textbooksPool.find(b => b.id === currentTextbook);
  const coverContainer = document.getElementById("vocabCoverContainer");
  const titleContainer = document.getElementById("vocabBookTitle");

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

  if (typeof window.applyVocabMaxRange === "function") {
    window.applyVocabMaxRange();
  }

  if (typeof window.injectVocabStatsButton === "function") {
    window.injectVocabStatsButton();
  }
};
window.updateMeaningStatus = function(wordNum, meaningId, status, event) {
  if (event) event.stopPropagation();

  const wIdx = vocabList.findIndex(w => String(w.num) === String(wordNum));
  if (wIdx < 0) return;

  const mIdx = vocabList[wIdx].meanings.findIndex(m => String(m.id) === String(meaningId));
  if (mIdx < 0) return;

  if (status === "none") {
    vocabList[wIdx].meanings[mIdx].status = "none";
    vocabList[wIdx].meanings[mIdx].history = [];
  } else {
    vocabList[wIdx].meanings[mIdx].status = status;

    if (!vocabList[wIdx].meanings[mIdx].history) {
      vocabList[wIdx].meanings[mIdx].history = [];
    }

    vocabList[wIdx].meanings[mIdx].history.push(status);
    totalExp += 1;
  }

  let aggregatedHistory = [];

  vocabList[wIdx].meanings.forEach(function(m) {
    if (m.history && m.history.length > 0) {
      aggregatedHistory = aggregatedHistory.concat(m.history);
    }
  });

  vocabList[wIdx].history = aggregatedHistory.slice(-20);
  vocabList[wIdx].status = window.wordOverallStatus(vocabList[wIdx]);

  userStats.vocab_fixed = vocabList.filter(function(w) {
    return w.meanings && w.meanings.some(function(m) {
      return m.status === "ok";
    });
  }).length;

  window.saveUserStats();
  window.checkAndRewardTitleBonusXP();
  window.saveUserVocabProgress();
  window.renderVocabList();
  window.applyProfileToUi();
  window.renderLeaderboard();
};

window.handleBulkWordImport = function() {
  const input = document.getElementById("bulkWordInput");
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  if (text.startsWith("[") && text.endsWith("]")) {
    try {
      const parsed = JSON.parse(text);

      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].word) {
        if (confirm("バックアップデータで完全に上書きしますか？")) {
          vocabList = window.migrateVocabData(window.stripVocabProgressFromWords(parsed));

          userStats.vocab_reg = vocabList.length;
          window.saveUserStats();

          window.saveVocabMasterToStorage();
          window.saveUserVocabProgress();

          window.renderVocabList();
          window.renderBulkDeleteList();

          input.value = "";
          alert("統合完了しました！");
          return;
        }
      }
    } catch (e) {}
  }

  text.split("\n").forEach(line => {
    const parts = line.split(":");

    if (parts.length >= 3) {
      const num = parts[0].trim();
      const word = parts[1].trim();
      const sub = parts[3] ? parts[3].trim() : "";

      let meaning = parts[2]
        .trim()
        .replace(/(動|名|形|副|代|接|前|自動|他動)[:：]\s*/g, "")
        .replace(/^[ ,　]+/, "");

      if (num && word && meaning) {
        const existingIdx = vocabList.findIndex(w => String(w.num) === String(num));

        let newWord = {
          num,
          word,
          meaning,
          sub,
          status: "none",
          history: []
        };

        newWord = window.migrateVocabData([newWord])[0];

        if (existingIdx >= 0) {
          vocabList[existingIdx] = newWord;
        } else {
          vocabList.push(newWord);
        }
      }
    }
  });

  vocabList.sort((a, b) => parseInt(a.num) - parseInt(b.num));

  userStats.vocab_reg = vocabList.length;
  window.saveUserStats();

  window.saveVocabMasterToStorage();
  window.saveUserVocabProgress();

  window.renderVocabList();
  window.renderBulkDeleteList();

  input.value = "";
  alert("一括インポートが完了しました。");
};

window.showCustomBulkDeleteConfirm = function(count, numsToDelete) {
  if (document.getElementById("bulkDelOverlayLayer")) return;

  const overlay = document.createElement("div");
  overlay.id = "bulkDelOverlayLayer";
  overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);";

  const box = document.createElement("div");
  box.style.cssText = "background:var(--card-bg); border:1px solid #EF4444; border-radius:16px; padding:24px; width:85%; max-width:320px; text-align:center; box-shadow: 0 10px 30px rgba(0,0,0,0.6);";

  box.innerHTML = `
    <div style="color:white; font-size:18px; font-weight:800; margin-bottom:12px;">⚠️ 一括削除</div>
    <div style="color:var(--text-sub); font-size:13px; margin-bottom:24px; line-height:1.5;">選択された <strong style="color:white;">${count}</strong> 件の単語を完全に削除しますか？</div>
    <div style="display:flex; gap:12px;">
      <button style="flex:1; padding:12px; border-radius:10px; border:none; background:var(--input-bg); color:var(--text-main); font-weight:700; cursor:pointer;" id="cancelBulkDelBtn">キャンセル</button>
      <button style="flex:1; padding:12px; border-radius:10px; border:none; background:#EF4444; color:white; font-weight:700; cursor:pointer;" id="confirmBulkDelBtn">削除する</button>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  document.getElementById("cancelBulkDelBtn").onclick = () => {
    document.body.removeChild(overlay);
  };

  document.getElementById("confirmBulkDelBtn").onclick = () => {
    vocabList = vocabList.filter(w => !numsToDelete.includes(String(w.num)));

    userStats.delete_count += numsToDelete.length;
    userStats.vocab_reg = vocabList.length;

    window.saveUserStats();

    window.saveVocabMasterToStorage();
    window.saveUserVocabProgress();

    window.renderVocabList();
    window.renderBulkDeleteList();

    document.body.removeChild(overlay);
  };
};

window.showCustomDeleteConfirm = function(numStr) {
  if (document.getElementById("delOverlayLayer")) return;

  const overlay = document.createElement("div");
  overlay.id = "delOverlayLayer";
  overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);";

  const box = document.createElement("div");
  box.style.cssText = "background:var(--card-bg); border:1px solid #EF4444; border-radius:16px; padding:24px; width:85%; max-width:320px; text-align:center; box-shadow: 0 10px 30px rgba(0,0,0,0.6);";

  box.innerHTML = `
    <div style="color:white; font-size:18px; font-weight:800; margin-bottom:12px;">⚠️ 単語の削除</div>
    <div style="color:white; font-size:13px; margin-bottom:24px; line-height:1.5;">単語 <strong style="color:white;">#${numStr}</strong> を完全に削除しますか？</div>
    <div style="display:flex; gap:12px;">
      <button style="flex:1; padding:12px; border-radius:10px; border:none; background:var(--input-bg); color:var(--text-main); font-weight:700; cursor:pointer;" id="cancelDelBtn">やめる</button>
      <button style="flex:1; padding:12px; border-radius:10px; border:none; background:#EF4444; color:white; font-weight:700; cursor:pointer;" id="confirmDelBtn">削除する</button>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  document.getElementById("cancelDelBtn").onclick = () => {
    document.body.removeChild(overlay);
  };

  document.getElementById("confirmDelBtn").onclick = () => {
    vocabList = vocabList.filter(w => String(w.num) !== String(numStr));

    userStats.delete_count++;
    userStats.vocab_reg = vocabList.length;

    window.saveUserStats();

    window.saveVocabMasterToStorage();
    window.saveUserVocabProgress();

    window.renderVocabList();
    window.renderBulkDeleteList();

    document.body.removeChild(overlay);
  };
};

window.showCustomBulkResetConfirm = function(count, numsToReset) {
  if (document.getElementById("bulkResetOverlayLayer")) return;

  const overlay = document.createElement("div");
  overlay.id = "bulkResetOverlayLayer";
  overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);";

  const box = document.createElement("div");
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

  document.getElementById("cancelBulkResetBtn").onclick = () => {
    document.body.removeChild(overlay);
  };

  document.getElementById("confirmBulkResetBtn").onclick = () => {
    vocabList.forEach(w => {
      if (numsToReset.includes(String(w.num))) {
        w.status = "none";
        w.history = [];

        if (w.meanings) {
          w.meanings.forEach(m => {
            m.status = "none";
            m.history = [];
          });
        }
      }
    });

    userStats.vocab_fixed = vocabList.filter(function(w) {
      return w.meanings && w.meanings.some(function(m) {
        return m.status === "ok";
      });
    }).length;

    window.saveUserStats();
    window.saveUserVocabProgress();

    window.renderVocabList();
    window.renderBulkDeleteList();

    document.body.removeChild(overlay);
  };
};

window.saveInlineWordEdit = function(event, wordNum) {
  if (event) event.stopPropagation();

  const wIdx = vocabList.findIndex(w => String(w.num) === String(wordNum));
  if (wIdx === -1) return;

  const wordInput = document.getElementById(`inlineEditWordInput-${wordNum}`);
  const subInput = document.getElementById(`inlineEditSubInput-${wordNum}`);
  const mInputs = document.querySelectorAll(`.inline-m-input-${wordNum}`);

  if (wordInput) vocabList[wIdx].word = wordInput.value.trim();
  if (subInput) vocabList[wIdx].sub = subInput.value.trim();

  const oldMeanings = vocabList[wIdx].meanings || [];
  const updatedMeanings = [];
  const circles = "①②③④⑤⑥⑦⑧⑨⑩";

  mInputs.forEach((inp, idx) => {
    const txt = inp.value.trim();

    if (txt) {
      const oldM = oldMeanings[idx];

      updatedMeanings.push({
        id: oldM ? oldM.id : `${wordNum}-${idx}-${Date.now()}`,
        text: txt,
        status: "none",
        history: []
      });
    }
  });

  vocabList[wIdx].meanings = updatedMeanings;

  vocabList[wIdx].meaning = updatedMeanings.map((m, i) => {
    return updatedMeanings.length > 1 ? (circles[i] || "") + m.text : m.text;
  }).join("");

  vocabList[wIdx].status = "none";
  vocabList[wIdx].history = [];

  window.saveVocabMasterToStorage();
  window.saveUserVocabProgress();

  window.renderVocabList();

  alert("単語情報を更新しました！");
};

window.renderFlashcardHistoryBubbles = function(wordData) {
  const container = document.getElementById("fcHistoryContainer");
  if (!container) return;

  container.innerHTML = "";

  const cleanKey = String(wordData.en || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  const vocabMatch = vocabList.find(v => v.word.toLowerCase() === cleanKey);

  let targetHistory = [];

  if (vocabMatch) {
    if (vocabMatch.history && vocabMatch.history.length > 0) {
      targetHistory = targetHistory.concat(vocabMatch.history);
    }

    if (targetHistory.length === 0 && vocabMatch.meanings) {
      vocabMatch.meanings.forEach(m => {
        if (m.history && m.history.length > 0) {
          targetHistory = targetHistory.concat(m.history);
        }
      });
    }

    if (targetHistory.length === 0 && vocabMatch.status && vocabMatch.status !== "none") {
      targetHistory.push(vocabMatch.status);
    }
  } else {
    const memStatus = wordMemory[cleanKey];
    if (memStatus && memStatus !== "none") {
      targetHistory.push(memStatus);
    }
  }

  let displayList = targetHistory.slice(-5);

  while (displayList.length < 5) {
    displayList.unshift("none");
  }

  displayList.forEach(status => {
    const bubble = document.createElement("div");
    bubble.className = "fc-history-bubble";

    if (status !== "none") {
      bubble.classList.add(status);
    }

    container.appendChild(bubble);
  });
};

// ==========================================================================
// 画面起動時にパッチ済み読み込みを反映
// ==========================================================================
if (document.readyState !== "loading") {
  setTimeout(function() {
    if (typeof myId !== "undefined" && myId) {
      window.preloadAllTextbooksAndVocab()
        .then(function() {
          return window.loadCurrentTextbookData();
        })
        .catch(function() {});
    }
  }, 150);
}
// ==========================================================================
// ⚡ 軽量化＆フラッシュテンポ改善パッチ
// ==========================================================================

window.__vocabSaveTimer = null;
window.__userStatsTimer = null;
window.__vocabRenderTimer = null;
window.__flashcardSessionActive = false;
window.__flashcardNextDelay = 150;

window.scheduleVocabProgressSave = function(delay) {
  delay = delay || 500;

  if (window.__vocabSaveTimer) {
    clearTimeout(window.__vocabSaveTimer);
  }

  window.__vocabSaveTimer = setTimeout(async function() {
    window.__vocabSaveTimer = null;

    try {
      if (typeof window.saveUserVocabProgress === "function") {
        await window.saveUserVocabProgress();
      } else if (typeof window.saveVocabToStorage === "function") {
        await window.saveVocabToStorage();
      }
    } catch (e) {
      console.error("単語進捗の遅延保存エラー:", e);
    }
  }, delay);
};

window.flushVocabProgressSave = async function() {
  if (window.__vocabSaveTimer) {
    clearTimeout(window.__vocabSaveTimer);
    window.__vocabSaveTimer = null;
  }

  try {
    if (typeof window.saveUserVocabProgress === "function") {
      await window.saveUserVocabProgress();
    } else if (typeof window.saveVocabToStorage === "function") {
      await window.saveVocabToStorage();
    }
  } catch (e) {
    console.error("単語進捗の即時保存エラー:", e);
  }
};

window.scheduleUserStatsRefresh = function(delay) {
  delay = delay || 500;

  if (window.__userStatsTimer) {
    clearTimeout(window.__userStatsTimer);
  }

  window.__userStatsTimer = setTimeout(function() {
    window.__userStatsTimer = null;

    userStats.vocab_fixed = vocabList.filter(function(w) {
      return w.meanings && w.meanings.some(function(m) {
        return m.status === "ok";
      });
    }).length;

    window.saveUserStats();
    window.checkAndRewardTitleBonusXP();
    window.applyProfileToUi();
    window.renderLeaderboard();
  }, delay);
};

window.flushUserStatsRefresh = function() {
  if (window.__userStatsTimer) {
    clearTimeout(window.__userStatsTimer);
    window.__userStatsTimer = null;
  }

  userStats.vocab_fixed = vocabList.filter(function(w) {
    return w.meanings && w.meanings.some(function(m) {
      return m.status === "ok";
    });
  }).length;

  window.saveUserStats();
  window.checkAndRewardTitleBonusXP();
  window.applyProfileToUi();
  window.renderLeaderboard();
};

window.scheduleVocabListRender = function(delay) {
  delay = delay || 600;

  if (window.__vocabRenderTimer) {
    clearTimeout(window.__vocabRenderTimer);
  }

  window.__vocabRenderTimer = setTimeout(function() {
    window.__vocabRenderTimer = null;

    if (typeof window.renderVocabList === "function") {
      window.renderVocabList();
    }
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
    var hasFilterStatus = (w.meanings || []).some(function(m) {
      return m.status === vocabFilter;
    });

    if (!hasFilterStatus) return false;
  }

  if (searchKeyword) {
    var inWord = String(w.word || "").toLowerCase().includes(searchKeyword);
    var inMeaning = String(w.meaning || "").includes(searchKeyword);

    if (!inWord && !inMeaning) return false;
  }

  return true;
};

window.buildVocabDotsHtml = function(w) {
  var hasAnyHistory = w.meanings && w.meanings.some(function(m) {
    return m.history && m.history.length > 0;
  });

  var dotsHtml = "";

  if (hasAnyHistory) {
    var groupsHtml = [];

    w.meanings.forEach(function(m) {
      var groupHtml = '<div style="display:flex; gap:2px; align-items:center;">';

      if (m.history && m.history.length > 0) {
        m.history.slice(-5).forEach(function(h) {
          var mark = h === "ok" ? "◯" : h === "so" ? "△" : "✕";
          var bg = h === "ok" ? "#10B981" : h === "so" ? "#F59E0B" : "#EF4444";
          var color = h === "so" ? "#0F172A" : "white";

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

  return '<div style="display:flex; justify-content:flex-end; align-items:center; margin-top:12px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.1);">' + dotsHtml + '</div>';
};

window.updateVocabCardUi = function(wordNum) {
  var w = vocabList.find(function(item) {
    return String(item.num) === String(wordNum);
  });

  if (!w) return;

  var body = document.getElementById("wordCardBody-" + wordNum);

  if (!body) {
    if (window.vocabCardMatchesFilter(w)) {
      window.scheduleVocabListRender(600);
    }
    return;
  }

  var card = body.closest(".word-row-container");
  if (!card) return;

  if (!window.vocabCardMatchesFilter(w)) {
    card.style.transition = "opacity 0.35s ease, transform 0.35s ease";
    card.style.opacity = "0";
    card.style.transform = "scale(0.97)";

    setTimeout(function() {
      if (!window.vocabCardMatchesFilter(w)) {
        card.remove();
      }
    }, 350);

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

window.getFlashcardStyleByHistory = function(wordData) {
  var cleanKey = String(wordData.en || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  var vocabMatch = vocabList.find(function(v) {
    return v.word.toLowerCase() === cleanKey;
  });

  var allHistory = [];

  if (vocabMatch) {
    if (vocabMatch.history && vocabMatch.history.length > 0) {
      allHistory = allHistory.concat(vocabMatch.history);
    }

    if (vocabMatch.meanings) {
      vocabMatch.meanings.forEach(function(m) {
        if (m.history && m.history.length > 0) {
          allHistory = allHistory.concat(m.history);
        }
      });
    }
  } else {
    var memStatus = wordMemory[cleanKey];

    if (memStatus && memStatus !== "none") {
      allHistory.push(memStatus);
    }
  }

  if (allHistory.length === 0) {
    return "background: radial-gradient(circle at center, rgba(255, 255, 255, 0.04) 0%, #130a24 75%, #090514 100%) !important; border: none !important; box-shadow: none !important;";
  }

  var totalScore = 0;

  allHistory.forEach(function(h) {
    if (h === "ok") totalScore += 1;
    else if (h === "so") totalScore += 4;
    else if (h === "bad") totalScore += 9;
  });

  var avg = totalScore / allHistory.length;

  var green = [16, 185, 129];
  var yellow = [245, 158, 11];
  var red = [239, 68, 68];

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

  if (type === "right") {
    p.classList.add("ok");
  } else if (type === "left") {
    p.classList.add("bad");
  } else if (type === "up") {
    p.classList.add("so");
  } else {
    p.style.borderColor = "rgba(255,255,255,0.6)";
  }

  document.body.appendChild(p);

  setTimeout(function() {
    var dx = (Math.random() - 0.5) * 40;
    var dy = -60 - Math.random() * 40;

    p.style.transform = "translate(calc(-50% + " + dx + "px), calc(-50% + " + dy + "px)) scale(0)";
    p.style.opacity = "0";
  }, 10);

  setTimeout(function() {
    p.remove();
  }, 850);
};

window.updateMeaningStatus = function(wordNum, meaningId, status, event) {
  if (event) event.stopPropagation();

  var wIdx = vocabList.findIndex(function(w) {
    return String(w.num) === String(wordNum);
  });

  if (wIdx < 0) return;

  var mIdx = vocabList[wIdx].meanings.findIndex(function(m) {
    return String(m.id) === String(meaningId);
  });

  if (mIdx < 0) return;

  if (status === "none") {
    vocabList[wIdx].meanings[mIdx].status = "none";
    vocabList[wIdx].meanings[mIdx].history = [];
  } else {
    vocabList[wIdx].meanings[mIdx].status = status;

    if (!vocabList[wIdx].meanings[mIdx].history) {
      vocabList[wIdx].meanings[mIdx].history = [];
    }

    vocabList[wIdx].meanings[mIdx].history.push(status);
    totalExp += 1;
  }

  var aggregatedHistory = [];

  vocabList[wIdx].meanings.forEach(function(m) {
    if (m.history && m.history.length > 0) {
      aggregatedHistory = aggregatedHistory.concat(m.history);
    }
  });

  vocabList[wIdx].history = aggregatedHistory.slice(-20);
  vocabList[wIdx].status = window.wordOverallStatus(vocabList[wIdx]);

  userStats.vocab_fixed = vocabList.filter(function(w) {
    return w.meanings && w.meanings.some(function(m) {
      return m.status === "ok";
    });
  }).length;

  window.updateVocabCardUi(wordNum);

  window.scheduleVocabProgressSave(450);
  window.scheduleUserStatsRefresh(600);
};

window.swipeFlashcard = function(direction, finalDx = 0, finalDy = 0) {
  var card = document.getElementById("activeFlashcard");
  if (!card || card.dataset.swiped === "1") return;

  card.dataset.swiped = "1";

  var currentWord = flashcardOriginQueue[flashcardCurrentIndex];
  if (!currentWord) return;

  var cleanKey = String(currentWord.en || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  var status = "none";

  var rect = card.getBoundingClientRect();
  var releaseX = rect.left + rect.width / 2;
  var releaseY = rect.top + rect.height / 2;

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

  setTimeout(function() {
    ghost.remove();
  }, 850);

  for (var i = 0; i < 15; i++) {
    setTimeout(function() {
      window.createFlickTrailParticle(
        releaseX + (Math.random() - 0.5) * 80,
        releaseY + (Math.random() - 0.5) * 80,
        direction
      );
    }, i * 15);
  }

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

  setTimeout(function() {
    ripple.remove();
  }, 800);

  card.remove();

  if (direction === "right") {
    status = "ok";
    flashcardLearnedCount++;
  } else if (direction === "left") {
    status = "bad";
  } else if (direction === "up") {
    status = "so";
  }

  totalExp += 1;

  wordMemory[cleanKey] = status;
  localStorage.setItem("wordMemory", JSON.stringify(wordMemory));

  var vocabMatch = vocabList.find(function(v) {
    return v.word.toLowerCase() === cleanKey;
  });

  if (vocabMatch) {
    vocabMatch.status = status;

    if (vocabMatch.meanings && vocabMatch.meanings.length > 0) {
      vocabMatch.meanings[0].status = status;

      if (!vocabMatch.meanings[0].history) {
        vocabMatch.meanings[0].history = [];
      }

      vocabMatch.meanings[0].history.push(status);
    }

    if (!vocabMatch.history) {
      vocabMatch.history = [];
    }

    vocabMatch.history.push(status);
  }

  userStats.flash_count++;

  userStats.vocab_fixed = vocabList.filter(function(w) {
    return w.meanings && w.meanings.some(function(m) {
      return m.status === "ok";
    });
  }).length;

  window.scheduleVocabProgressSave(700);
  window.scheduleUserStatsRefresh(700);

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

const __originalStartFlashcardSession = window.startFlashcardSession;

window.startFlashcardSession = function() {
  window.__flashcardSessionActive = true;

  if (typeof __originalStartFlashcardSession === "function") {
    __originalStartFlashcardSession();
  }
};

const __originalFinishFlashcardSession = window.finishFlashcardSession;

window.finishFlashcardSession = function() {
  window.__flashcardSessionActive = false;

  window.flushVocabProgressSave();
  window.flushUserStatsRefresh();

  if (typeof __originalFinishFlashcardSession === "function") {
    __originalFinishFlashcardSession();
  }
};

window.quitFlashcardSession = window.finishFlashcardSession;

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
