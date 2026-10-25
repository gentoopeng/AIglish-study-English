window.endOnlyCloudSaves = true;
//==========================================================================
// 🌟 1. 関数のマウント定義・グローバル状態
// ==========================================================================
// バージョンは index.html の meta を唯一の基準にする。
// 過去のパッチやキャッシュが追加した古い表示は削除し、常に1件だけ表示する。
window.syncDisplayedAppVersion = function() {
const meta = document.querySelector('meta[name="application-version"]');
const version = meta ? String(meta.getAttribute('content') || '').trim() : '';
const canonical = document.getElementById('appVersionDisplay');
document.querySelectorAll('.sidebar-version').forEach(function(element) {
if (element !== canonical) element.remove();
});
if (canonical) canonical.textContent = version ? 'Version ' + version : '';
};
if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', window.syncDisplayedAppVersion, { once: true });
} else {
window.syncDisplayedAppVersion();
}
// 管理者権限フラグ
window.isAdmin = false;
// 🌟 経験値・レベル・ユーザー統計・プロフィールおよびフレンドリストの包括的保存（Firebase即時同期＆ローカル保存）
// 🌟 累計XPからレベル、次への必要XP、および現在のレベル内進捗%を計算する関数
// Compatibility for older save and tower code; player levels are retired.
window.calculateLevelFromExp = function() {
    return {level:1,nextLevelRequiredExp:0,progressPercent:0};
};
// アプリのコアライフサイクル読み込み
window.__beforeAppLoadHandlers = window.__beforeAppLoadHandlers || [];
window.__afterAppLoadHandlers = window.__afterAppLoadHandlers || [];
window.onBeforeAppLoad = function(handler) { if(typeof handler === 'function') window.__beforeAppLoadHandlers.push(handler); };
window.onAppLoaded = function(handler) {
    if(typeof handler !== 'function')return;
    // Fixed source file + registration index only; no account/input contents.
    const file=(document.currentScript?.src||'').split('/').pop().split('?')[0];
    const label='hook:'+window.__afterAppLoadHandlers.length+':'+file;
    const wrapped=function(){
        window.StartupMonitor?.event?.(label+':start');
        try {
            const result=handler.apply(this,arguments);
            if(result&&typeof result.then==='function')return Promise.resolve(result).then(function(value){window.StartupMonitor?.event?.(label+':done');return value;},function(error){window.StartupMonitor?.event?.(label+':error');throw error;});
            window.StartupMonitor?.event?.(label+':done');return result;
        } catch(error){window.StartupMonitor?.event?.(label+':error');throw error;}
    };
    // Keep the handler's own name so it can still be identified (diagnostics, tests).
    try{Object.defineProperty(wrapped,'name',{value:handler.name});}catch(error){}
    window.__afterAppLoadHandlers.push(wrapped);
};
window.loadLocalState = async function() {
window.StartupMonitor?.mark?.('account-restore');
window.__learningBootReady=false;
const accountToStart = localStorage.getItem('core_v4_userId');
if (accountToStart && window.AdminPlayers && !await window.AdminPlayers.canStart(accountToStart)) return;
for (var beforeIndex = 0; beforeIndex < window.__beforeAppLoadHandlers.length; beforeIndex++) {
    try { await window.__beforeAppLoadHandlers[beforeIndex](); }
    catch (e) { console.error('起動前の準備に失敗しました:', e); }
}
const savedId = localStorage.getItem('core_v4_userId');
// ログイン済みなら通信処理より先に認証画面を閉じる。
// 起動前フックのFirebase通信が遅くても、画面遷移を妨げない。
if (savedId) {
    const gateScreen = document.getElementById('auth-gate-screen');
    if (gateScreen) gateScreen.style.display = 'none';
}
geminiApiKey = localStorage.getItem('core_v4_geminiKey') || "";
const apiKeyInput = document.getElementById('sidebarApiKeyInput');
if(apiKeyInput) apiKeyInput.value = geminiApiKey;
 if(savedId) {
     myId = savedId;
     const gateScreen = document.getElementById('auth-gate-screen');
     if(gateScreen) gateScreen.style.display = 'none';
     myName = localStorage.getItem('core_v4_userName') || "プレイヤー1";
     myTarget = localStorage.getItem('core_v4_userTarget') || "未設定";
     selectedTitle = localStorage.getItem('core_v4_userTitle') || "称号なし";
     totalExp = parseInt(localStorage.getItem('core_v4_totalExp') || "0");



     currentTextbook = localStorage.getItem('core_v4_current_textbook_id') || "";
     // 教材一覧の同期は画面表示を止めずバックグラウンドで行う。
     // 現在の教材はこの後、端末キャッシュから先に読み込まれる。
     window.StartupMonitor?.event?.('textbook-index:start');
     Promise.resolve(window.preloadAllTextbooksAndVocab()).then(function() {
         window.StartupMonitor?.event?.('textbook-index:done');
         if(typeof window.updateAdminEditBookSelectOptions === 'function') window.updateAdminEditBookSelectOptions();
     }).catch(function(e) { window.StartupMonitor?.event?.('textbook-index:error');console.warn('教材のバックグラウンド同期に失敗しました:', e); });
     window.StartupMonitor?.event?.('user-stats:start');
     Promise.resolve(window.loadUserStats()).then(function() {
         window.StartupMonitor?.event?.('user-stats:done');
         window.applyProfileToUi();
         window.renderLeaderboard();
     }).catch(function(e) { window.StartupMonitor?.event?.('user-stats:error');console.warn('ユーザー情報のバックグラウンド同期に失敗しました:', e); });
     userStats.goal_text = myTarget; 
     userStats.friends_count = myFriendList.length; 
     window.StartupMonitor?.mark?.('active-book');
     await window.loadCurrentTextbookData();
     window.applyProfileToUi();

     window.renderLeaderboard();
     if(typeof window.renderHistoryList === 'function') window.renderHistoryList();
     if(typeof window.renderBookshelf === 'function') window.renderBookshelf();
     window.renderAdminUserList(); 
     ;
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
for (var afterIndex = 0; afterIndex < window.__afterAppLoadHandlers.length; afterIndex++) {
    try {
        var afterResult = window.__afterAppLoadHandlers[afterIndex]();
        if (afterResult && typeof afterResult.catch === 'function') {
            afterResult.catch(function(e) { console.error('起動後の追加読み込みに失敗しました:', e); });
        }
    }
    catch (e) { console.error('起動後の追加読み込みに失敗しました:', e); }
}
window.__learningBootReady=true;
window.StartupMonitor?.mark?.('ready');
window.dispatchEvent(new Event('learning-data-ready'));
if(window.resumeBackgroundSave)window.resumeBackgroundSave();
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
let flashcardDataSourceMode = '';
let flashcardDirectionMode = 'en2ja';
let flashcardOriginQueue = [];
let flashcardCurrentIndex = 0;
let flashcardLearnedCount = 0;
let cardTouchStartX = 0;
let cardTouchStartY = 0;
let isCardFlicking = false;
let flashcardSessionHistory = [];
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
let currentActiveTabId = "vocab";
let todayStudySeconds = parseInt(localStorage.getItem('core_v4_study_today_secs') || "0");
let lastAccessDateStr = localStorage.getItem('core_v4_study_last_date') || "";
let weeklyStudyMinutesLog = JSON.parse(localStorage.getItem('core_v4_study_weekly_log') || "[0, 0, 0, 0, 0, 0, 0]");
let myFriendList = JSON.parse(localStorage.getItem('core_v4_friend_list') || "[]");
let userStats = {
test_count: 0,
combo_max: 0,
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
// Titles and their XP bonuses are retired; old callers find no-ops (ranking.js keeps the same names).
['renderTitles','renderSeasonTitles','equipTitle','unequipTitle','checkAndRewardTitleBonusXP','updateTitleProgressUI'].forEach(name=>{window[name]=function(){};});
let rewardedTitlesStepsCache = JSON.parse(localStorage.getItem('core_v4_rewarded_titles_cache') || "{}");
// ==========================================================================
// 🌟 3. 各種機能の定義
// ==========================================================================

window.initLucide = function() {
if(window.lucide) { window.lucide.createIcons(); }
};
window.scrollToTop = function() {
window.scrollTo({ top: 0, behavior: 'smooth' });
};
// 教材一覧だけ同期する。本体は開いた教材のローダーに任せる。
// 🌟 単語帳データをFirebase (Firestore) と同期・保存処理
// The book, shelf and user administration panels are retired (their screens are gone); the calls left in
// shared code find no-ops.
['updateAdminEditBookSelectOptions','updateAdminEditShelfSelectOptions','injectShelfAdminPanel','renderAdminUserList','injectAdminUserRepairBox','injectMissingNumberSearchPanel'].forEach(name=>{window[name]=function(){};});
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
// 🌟 キャッシュ優先で単語帳データを爆速ロードする関数
window.createTextbookListItem = function(book, index, onSelect) {
     const row = document.createElement('button');
     row.type = 'button';
     row.dataset.bookId=book.id;
     row.className = 'textbook-list-item' + (book.id === currentTextbook ? ' is-current' : '');
     row.style.setProperty('--textbook-index', index);
     row.onclick = () => onSelect(book.id);

     const cover = document.createElement('span');
     cover.className = 'textbook-list-cover';
     if (book.coverType === "image" && book.cover) {
         const image = document.createElement('img');
         image.src = book.cover;
         image.alt = '';
         image.loading = 'lazy';
         cover.appendChild(image);
     } else {
         cover.textContent = book.cover || "📔";
     }

     const details = document.createElement('span');
     details.className = 'textbook-list-details';
     const heading = document.createElement('span');
     heading.className = 'textbook-list-heading';
     const name = document.createElement('span');
     name.className = 'textbook-list-name';
     name.textContent = book.name || '名称未設定の単語帳';
     heading.appendChild(name);
     if (book.personal) {
         const visibility = document.createElement('span');
         visibility.className = 'textbook-list-visibility';
         visibility.textContent = book.visibility === 'public' ? '公開' : '自分だけ';
         heading.appendChild(visibility);
     }
     if (book.id === currentTextbook) {
         const current = document.createElement('span');
         current.className = 'textbook-list-current';
         current.textContent = '使用中';
         heading.appendChild(current);
     }

     const stats = window.getTextbookMasteryStats(book.id);
     const progress = document.createElement('span');
     progress.className = 'textbook-list-progress';
     const track = document.createElement('span');
     track.className = 'textbook-list-progress-track';
     [
         { key: 'ok', className: 'is-ok' },
         { key: 'so', className: 'is-so' },
         { key: 'bad', className: 'is-bad' },
         { key: 'none', className: 'is-none' }
     ].forEach(function(segment) {
         const fill = document.createElement('span');
         fill.className = 'textbook-list-progress-fill ' + segment.className;
         fill.style.width = (stats.total ? stats[segment.key] / stats.total * 100 : (segment.key === 'none' ? 100 : 0)) + '%';
         track.appendChild(fill);
     });
     track.setAttribute('aria-label', '定着' + stats.ok + '、曖昧' + stats.so + '、未定着' + stats.bad + '、未学習' + stats.none);
     const progressText = document.createElement('span');
     progressText.className = 'textbook-list-progress-text';
     progressText.textContent = '○' + stats.ok + '  △' + stats.so + '  ×' + stats.bad + '  ー' + stats.none;
     progress.appendChild(track);
     progress.appendChild(progressText);
     details.appendChild(heading);
     details.appendChild(progress);

     const arrow = document.createElement('span');
     arrow.className = 'textbook-list-arrow';
     arrow.setAttribute('aria-hidden', 'true');
     arrow.textContent = '›';
     row.appendChild(cover);
     row.appendChild(details);
     row.appendChild(arrow);
     return row;
};


window.renderVocabLibrarySelection = function() {
  var selection = document.getElementById('vocabLibrarySelection');
  if (!selection) return;
  var books = document.getElementById('vocabLibraryBooks');
  var works = document.getElementById('vocabLibraryWorks');
  var workSection = document.getElementById('vocabLibraryWorkSection');
  if (!books || !works || !workSection) return;
  books.replaceChildren();
  works.replaceChildren();
  if (!textbooksPool.length) {
    var empty = document.createElement('div');
    empty.className = 'vocab-library-empty';
    empty.textContent = '現在、利用できる単語帳はありません。';
    books.appendChild(empty);
  }
  textbooksPool.forEach(function(book, index) {
    var row = window.createTextbookListItem(book, index, window.selectVocabLibraryBook);
    row.querySelector('.textbook-list-arrow').remove();
    var entry = document.createElement('div');
    entry.className = 'vocab-library-book-entry';
    var flash = document.createElement('button');
    flash.type = 'button';
    flash.className = 'vocab-library-flash-button';
    flash.textContent = '›';
    flash.setAttribute('aria-label', book.name + 'の学習方法を選ぶ');
    flash.title = '単語カード・苦手復習';
    flash.onclick = function() { window.openBookStudyMenu(book.id); };
    var manage = document.createElement('button');
    manage.type = 'button';
    manage.className = 'vocab-library-manage-button';
    manage.textContent = '⋯';
    manage.setAttribute('aria-label', book.name + 'の管理');
    manage.onclick = function() { window.openLibraryBookActions(book.id); };
    entry.append(row, flash, manage);
    books.appendChild(entry);
  });
  var workCount = typeof window.renderWorkbookLibraryItems === 'function'
    ? window.renderWorkbookLibraryItems(works, textbooksPool.length)
    : 0;
  workSection.hidden = !workCount;
};

window.showVocabLibrarySelection = function() {
  var selection = document.getElementById('vocabLibrarySelection');
  var contents = document.getElementById('vocabBookContents');
  if (selection) selection.hidden = false;
  if (contents) contents.hidden = true;
  window.renderVocabLibrarySelection();
};

window.selectVocabLibraryBook = function(bookId) {
  var owner=myId;
  var pending=window.__vocabSelectionRequest;
  if(pending&&pending.bookId===bookId&&pending.owner===owner&&currentTextbook===bookId)return pending.task;
  var request={bookId:bookId,owner:owner};window.__vocabSelectionRequest=request;
  request.task=(async function(){
  currentTextbook = bookId;
  if(window.LearningData)window.LearningData.begin(bookId);
  localStorage.setItem('core_v4_current_textbook_id', bookId);
  var selection = document.getElementById('vocabLibrarySelection');
  var contents = document.getElementById('vocabBookContents');
  if (selection) selection.hidden = true;
  if (contents) contents.hidden = false;
  var container=document.getElementById('vocabListContainer');
  if(container){container.replaceChildren();container.textContent='単語を読み込んでいます…';}
  // Release the previous page and paint feedback before parsing the next book.
  await new Promise(function(resolve){setTimeout(resolve,0);});
  if(window.__vocabSelectionRequest!==request||myId!==owner)return false;
  try{await window.loadCurrentTextbookData();}
  catch(error){
    if(window.__vocabSelectionRequest===request&&myId===owner&&currentTextbook===bookId){
      if(selection)selection.hidden=false;if(contents)contents.hidden=true;
      if(window.showToast)window.showToast("単語を読み込めませんでした。接続後にもう一度開いてください。保存データは変更していません。","err");
    }
    console.warn("[vocab] book load failed",error);
    return false;
  }
  return true;
  })().finally(function(){if(window.__vocabSelectionRequest===request)window.__vocabSelectionRequest=null;});
  return request.task;
};
// 教材選択画面のゲージは、その教材自身の保存済み理解度から計算する。
// 現在開いている vocabList や全教材共通の統計を流用しない。
window.getTextbookMasteryStats = function(bookId) {
  var words = [];
  if (bookId === currentTextbook && Array.isArray(vocabList) && vocabList.length) {
    words = vocabList;
  } else {
    try {
      var uid = (typeof myId !== 'undefined' && myId) ? myId : 'GUEST-000';
      var rawWords = localStorage.getItem('core_v4_user_vocab_book_' + uid + '_' + bookId) ||
        localStorage.getItem('core_v4_custom_words_' + uid + '_' + bookId) ||
        localStorage.getItem('core_v4_cache_' + bookId);
      if (rawWords) words = JSON.parse(rawWords) || [];
    } catch (e) { words = []; }
    if (!words.length && textbooksCacheMap && Array.isArray(textbooksCacheMap[bookId])) {
      words = textbooksCacheMap[bookId];
    }
  }

  var progress = {};
  try {
    var progressKey = typeof window.getVocabProgressStorageKey === 'function'
      ? window.getVocabProgressStorageKey(bookId)
      : 'core_v4_user_vocab_progress_' + ((typeof myId !== 'undefined' && myId) ? myId : 'GUEST-000') + '_' + bookId;
    progress = JSON.parse(localStorage.getItem(progressKey) || '{}') || {};
  } catch (e) { progress = {}; }

  var counts = { ok: 0, so: 0, bad: 0, none: 0 };
  words.forEach(function(word) {
    var meanings = Array.isArray(word.meanings) ? word.meanings : [];
    var saved = progress[String(word.num)] || null;
    var savedMeanings = saved && saved.meanings ? saved.meanings : {};
    var statuses = meanings.map(function(meaning) {
      var savedMeaning = savedMeanings[meaning.id];
      return (savedMeaning ? savedMeaning.status : meaning.status) || 'none';
    });
    if (!statuses.length) statuses = [(saved ? saved.status : word.status) || 'none'];
    statuses.forEach(function(status) { counts[Object.prototype.hasOwnProperty.call(counts,status) ? status : 'none']++; });
  });
  var total = counts.ok + counts.so + counts.bad + counts.none;
  return {
    total: total,
    mastered: counts.ok,
    percent: total ? Math.round(counts.ok / total * 100) : 0,
    ok: counts.ok,
    so: counts.so,
    bad: counts.bad,
    none: counts.none
  };
};
window.switchTextbookContext = async function(bookId) {
currentTextbook = bookId;
localStorage.setItem('core_v4_current_textbook_id', bookId);
const popup = document.getElementById('textbookSelectPopupFrame');
if (popup) { popup.classList.remove('show'); popup.style.display = 'none'; }
await window.loadCurrentTextbookData();
};
// ==========================================================================
// 🌟 活用形マッチング（語幹化＋インデックス＋照合）
// ==========================================================================
// 🌟 UIラベル書き換え（和訳→意味 / 英訳→単語 / 範囲補足）
// ==========================================================================
// 🌟 出題範囲を 1〜登録最大番号 に合わせる
// ==========================================================================
// 🌟 単語帳詳細ポップアップ（登録数・⚪︎△✕未学習・ドーナツグラフ）
// ==========================================================================
// 単語帳の切り替えボタンの右に「📊 詳細」ボタンを注入（1回だけ）
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
    if(btn) btn.innerHTML = 'ログイン <i data-lucide="arrow-right" size="16"></i>';
} else {
    if(tabLogin) tabLogin.classList.remove('active'); 
    if(tabReg) tabReg.classList.add('active');
    if (loginFields) loginFields.style.display = 'none';
    if (regFields) regFields.style.display = 'block';
    if(btn) btn.innerHTML = 'アカウントを作成 <i data-lucide="sparkles" size="16"></i>';
}
window.initLucide();
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
// 🌟 管理者ユーザーリストレンダリング（安全な読み込み＆描画）
window.applyProfileToUi = function() {
const pNameEl = document.getElementById('sideOptPlayerName');
if(pNameEl) pNameEl.innerText = myName;
const gNameEl = document.getElementById('sideOptGroupName');
if(gNameEl) gNameEl.innerText = "ID: " + myId;
 const mySavedAvatar = localStorage.getItem('core_v4_user_avatar_' + myId) || "";
 const sideAvatarFrame = document.getElementById('profileAvatarPreview');
 if(sideAvatarFrame) {
     if(mySavedAvatar) {
         const image=document.createElement('img');image.src=mySavedAvatar;image.alt=myName+'のアイコン';image.style.cssText='width:100%;height:100%;border-radius:50%;object-fit:cover';sideAvatarFrame.replaceChildren(image);
     } else {
         sideAvatarFrame.innerText = myName.trim().slice(0,1);
     }
 }
};
window.toggleSidebar = function(open) {
const menu = document.getElementById('sidebarMenu');
const overlay = document.getElementById('sidebarOverlay');
if(menu) menu.classList.toggle('open', open);
if(overlay) overlay.style.display = open ? 'block' : 'none';
};
window.__tabChangeHandlers = window.__tabChangeHandlers || [];
window.onTabChange = function(handler) {
if(typeof handler === 'function') window.__tabChangeHandlers.push(handler);
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

// Retired book administration panels must not block navigation.
if(tabId === 'titles') window.renderTitles(); 
currentActiveTabId = tabId;
if(tabId === 'community') window.sortAndRenderFriendList();
window.__tabChangeHandlers.slice().forEach(function(handler) {
    try { handler(tabId); } catch (e) { console.error('画面切り替え後の更新に失敗しました:', e); }
});
};
// onTabChange の定義後に登録する。定義前に呼ぶと app.js の実行が停止し、
// その後に定義されるログイン処理まで読み込まれなくなる。
window.onTabChange(function(tabId) {
if(tabId === 'vocab') window.showVocabLibrarySelection();
});
// ==========================================================================
// 📖 単語帳関連
// ==========================================================================
// 🌟 単語ステータス更新（獲得EXPのリアルタイム反映処理）
window.analyzeText = async function(rawText, assignedTitle = null, preParsedData = null) {
if(!rawText) return; currentActiveReaderText = rawText; currentActiveTitle = assignedTitle || "無題のテキスト";
const customJaEl = document.getElementById('customJapanesetextarea');
const customJaLines = customJaEl ? customJaEl.value.trim().split('\n').filter(l => l.trim() !== '') : [];
textHistory = textHistory.filter(h => h.text !== rawText); 
 textHistory.unshift({ id: Date.now(), title: currentActiveTitle, text: rawText });
 localStorage.setItem('textHistory', JSON.stringify(textHistory)); window.markReaderDataChanged?.(); window.renderHistoryList();
 document.getElementById('text-input-view').style.display = 'none'; document.getElementById('text-reader-view').style.display = 'block';
 const englishContainer = document.getElementById('englishContainer'); 
 englishContainer.innerHTML = '<div class="reader-analyzing" role="status"><i data-lucide="loader" class="animate-spin" size="28"></i><span>英文を解析しています…</span></div>';
 const abstractCard = document.getElementById('summary-abstract-card');
 const abstractContainer = document.getElementById('summaryAbstractContainer');
 if (abstractCard) abstractCard.style.display = 'none';
 if (abstractContainer) abstractContainer.innerText = "要約を作っています…";
 window.initLucide();
 let aiAnalysisResult = null;
 // The key may have been saved after this page loaded.
 if (!geminiApiKey) geminiApiKey = localStorage.getItem('core_v4_geminiKey') || "";
 // The words of the books chosen for the reader, for the AI check and the colours.
 if (window.ReaderVocab) { try { await window.ReaderVocab.load(); } catch (e) { console.warn('[reader] word books', e); } }
 if (preParsedData) {
     aiAnalysisResult = preParsedData;
 } else if (geminiApiKey) {
     // The loading screen shows how far the analysis has come.
     const progress = typeof window.setLoadingProgress === 'function' ? window.setLoadingProgress : function() {};
     progress(1, '英文を送っています');
     try {
         aiAnalysisResult = await window.callGeminiAnalyzer(rawText, progress);
         progress(100, '表示しています');
     } finally {
         setTimeout(function() { progress(null); }, 600);
     }
 }
 // Keep the analysis with the history entry, so opening it again does not ask the AI again.
 if (aiAnalysisResult && !aiAnalysisResult.analysisError) {
     const entry = textHistory.find(h => h.text === rawText);
     if (entry) {
         entry.aiAnalysisData = aiAnalysisResult;
         textHistory = textHistory.slice(0, 30);
         try { localStorage.setItem('textHistory', JSON.stringify(textHistory)); } catch (e) { entry.aiAnalysisData = null; }
         window.markReaderDataChanged?.();
     }
     // A bookshelf text without an analysis (new, edited or failed before) keeps this one.
     if (!preParsedData && Array.isArray(myBookshelf)) {
         let kept = false;
         myBookshelf.forEach(item => { if (item.text === rawText && (!item.aiAnalysisData || item.aiAnalysisData.analysisError)) { item.aiAnalysisData = JSON.parse(JSON.stringify(aiAnalysisResult)); kept = true; } });
         if (kept) { try { localStorage.setItem('myBookshelf', JSON.stringify(myBookshelf)); } catch (e) {} window.markReaderDataChanged?.(); }
     }
 }
 if (geminiApiKey && !aiAnalysisResult) {
     window.closeReader();
     return;
 }
 currentActiveAiAnalysisCache = aiAnalysisResult;
 // The title, and a save button wired directly (the text is never put into an attribute).
 const titleBox = document.getElementById('readerCurrentTitle');
 titleBox.replaceChildren();
 const titleRow = document.createElement('div'); titleRow.className = 'reader-title-row';
 const titleText = document.createElement('span'); titleText.className = 'reader-title-text'; titleText.textContent = currentActiveTitle;
 const saveButton = document.createElement('button'); saveButton.type = 'button'; saveButton.className = 'reader-save-button';
 saveButton.dataset.saveRebound = '1';
 saveButton.innerHTML = '<i data-lucide="folder-plus" size="13"></i> 本棚に保存';
 const titleForSave = currentActiveTitle;
 saveButton.onclick = () => window.showCustomSaveBookshelfPrompt(rawText, titleForSave);
 const analysedSentences = (aiAnalysisResult && Array.isArray(aiAnalysisResult.sentences)) ? aiAnalysisResult.sentences : null;
 const sentenceTotal = analysedSentences ? analysedSentences.length : (window.ReaderShelf ? window.ReaderShelf.sentenceCount(rawText) : 0);
 const hasGrammar = !!analysedSentences && analysedSentences.some(x => x && Array.isArray(x.grammarHighlights) && x.grammarHighlights.length);
 const titleMeta = document.createElement('small'); titleMeta.className = 'reader-title-meta'; titleMeta.textContent = sentenceTotal + '文' + (hasGrammar ? ' · 紫の下線の表現をタップで文法の解説' : '');
 titleRow.append(titleText, saveButton); titleBox.append(titleRow, titleMeta);
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
     // Grammar points: each phrase is found in the sentence (tolerating ~, quotes and spacing);
     // the words it covers go into one marked span that opens the explanation.
     const ranges = [];
     (Array.isArray(sData.grammarHighlights) ? sData.grammarHighlights : [])
         .filter(h => h && h.phrase)
         .sort((a, b) => String(b.phrase).length - String(a.phrase).length)
         .forEach(h => {
             const at = typeof window.findGrammarPhrase === 'function' ? window.findGrammarPhrase(sentenceText, h.phrase, ranges) : null;
             if (at) ranges.push(Object.assign(at, { h }));
         });
     // Word-book words the AI found used in a registered meaning ({ book, num, meaning }). Books the
     // AI did not check (picked later) are marked without the check. Older analyses had no book.
     const usedVocab = (Array.isArray(sData.vocab) ? sData.vocab : []).filter(v => v && v.num !== undefined);
     const checkedBooks = Array.isArray(aiAnalysisResult && aiAnalysisResult.vocabBooks) ? aiAnalysisResult.vocabBooks : [typeof currentTextbook === 'string' ? currentTextbook : ''];
     const vocabChecked = !!(aiAnalysisResult && aiAnalysisResult.vocabChecked);
     let currentRange = null, gSpan = null;
     for (const token of sentenceText.matchAll(/\S+/g)) {
         const range = ranges.find(r => token.index >= r.start && token.index < r.end) || null;
         if (range !== currentRange) {
             currentRange = range; gSpan = null;
             if (range) {
                 const h = range.h;
                 gSpan = document.createElement('span'); gSpan.className = 'grammar-span';
                 gSpan.onclick = (e) => window.openGrammarPopover(e, h.phrase, h.meaning, h.label);
                 mainContent.append(' ', gSpan);
             }
         }
         const subToken = token[0];
         const cleanKey = typeof window.readerCleanToken === 'function' ? window.readerCleanToken(subToken) : subToken.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]\"']/g,"");
         // The space goes between the boxes: a space at the end of an inline-block is dropped.
         const span = document.createElement('span'); span.className = 'word-span'; span.innerText = subToken;
         // Which word-book entry this is: the one the AI said carries a registered meaning here
         // (a word used in another meaning stays plain), or the first match when unchecked.
         const matches = window.ReaderVocab ? window.ReaderVocab.find(cleanKey) : [];
         let pick = null, sense = 0;
         for (const entry of matches) {
             if (vocabChecked && checkedBooks.includes(entry.book)) {
                 const used = usedVocab.find(v => String(v.num) === entry.num && (v.book ? v.book === entry.book : entry.book === checkedBooks[0]));
                 if (used) { pick = entry; sense = Number(used.meaning) || 0; break; }
             } else if (!pick) pick = entry;
         }
         if (!pick && matches.length) span.dataset.vocabSkip = '1';
         if (pick) {
             span.dataset.vocabBook = pick.book; span.dataset.vocabNum = pick.num; span.dataset.sense = String(sense);
             window.ReaderVocab.paint(span);
             const chosen = pick, chosenSense = sense;
             span.onclick = (e) => window.openReaderVocabDetails(e, chosen, chosenSense);
         } else if (!span.dataset.vocabSkip) {
             const dictMatch = dictionaryData.find(d => d.en === cleanKey);
             if(dictMatch) {
                 span.classList.add('registered'); span.classList.add(wordMemory[cleanKey] ? `status-${wordMemory[cleanKey]}` : `status-none`);
                 span.onclick = (e) => window.openWordPopover(e, cleanKey, subToken);
             }
         }
         if (gSpan) { if (gSpan.firstChild) gSpan.append(' '); gSpan.append(span); }
         else mainContent.append(' ', span);
     }
     let finalJaText = customJaLines[sIdx] || sData.translation || sData.translations || "（和訳未取得）"; 
     totalSummaryJa += `${sIdx+1}. ${finalJaText}<br>`;
     const jaSpan = document.createElement('span'); jaSpan.className = 'sentence-ja'; jaSpan.innerText = finalJaText; mainContent.appendChild(jaSpan);
     block.appendChild(mainContent); englishContainer.appendChild(block);
 });
 document.getElementById('summaryJaContainer').innerHTML = totalSummaryJa; window.setTranslationMode(currentTranslationMode);
 // When the AI failed: what happened, and a button to try again.
 if (aiAnalysisResult && aiAnalysisResult.analysisError) {
     const notice = document.createElement('div');
     notice.className = 'reader-key-notice reader-error-notice';
     notice.setAttribute('role', 'alert');
     const heading = document.createElement('strong'); heading.textContent = aiAnalysisResult.errorTitle || 'AIの解析に失敗しました';
     const detail = document.createElement('span'); detail.textContent = aiAnalysisResult.errorDetail || aiAnalysisResult.fullSummaryAbstract || '少し待ってから、もう一度お試しください。';
     const again = document.createElement('button'); again.type = 'button'; again.textContent = 'もう一度解析する';
     const retryTitle = currentActiveTitle;
     again.onclick = () => window.analyzeText(rawText, retryTitle);
     notice.append(heading, detail, again);
     englishContainer.prepend(notice);
 }
 // Without a key there is no translation or grammar: say so, instead of a silent 「和訳未取得」.
 if (!aiAnalysisResult) {
     const notice = document.createElement('div');
     notice.className = 'reader-key-notice';
     notice.innerHTML = '<strong>AIの和訳・文法解析にはGemini APIキーが必要です</strong><span>メニューの「設定」でAPIキーを入力して保存すると、和訳と文法の解説が付きます。</span>';
     const open = document.createElement('button');
     open.type = 'button';
     open.textContent = '設定を開く';
     open.onclick = () => { window.toggleSidebar?.(true); document.getElementById('sidebarApiKeyInput')?.scrollIntoView({ block: 'center' }); };
     notice.appendChild(open);
     englishContainer.prepend(notice);
 }
 window.initLucide();
};
// showCustomSaveBookshelfPrompt is in reader-shelf.js.
window.closeWordPopover = function() { document.getElementById('wordPopover').classList.remove('show'); document.getElementById('wordPopover').style.display = 'none'; };
window.closeReader = function() { document.getElementById('text-input-view').style.display = 'block'; document.getElementById('text-reader-view').style.display = 'none'; currentActiveAiAnalysisCache = null; };
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
     alert("このフレンドはすでに登録されています。");
     return;
 }
 if (window.db && window.fbGetDoc && window.fbDoc) {
     try {
         const targetUserRef = window.fbDoc(window.db, "users", targetCode);
         const targetUserSnap = await window.fbGetDoc(targetUserRef);
         // 存在しないアカウントは確実に拒否
         if (!targetUserSnap.exists()) {
             alert("このIDのユーザーは見つかりません。");
             return;
         }
         const tData = targetUserSnap.data();
         if (tData.deleted) {
             alert("このIDのユーザーは見つかりません。");
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
             alert("このIDのユーザーは見つかりません。");
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
         localStorage.setItem('core_v4_friend_list',JSON.stringify(myFriendList));
         window.queueBackgroundSave?.();
         userStats.friends_count = myFriendList.length;
         await window.saveUserStats();
         window.checkAndRewardTitleBonusXP();
         alert(`フレンド「${newFriend.name}」を追加しました。`);
         inputEl.value = "";
         window.sortAndRenderFriendList();
     } catch(e) {
         console.error("フレンド検索通信エラー:", e);
         alert("通信エラーが発生しました。時間を置いて再度お試しください。");
     }
 } else {
     alert("サーバーに接続できないため、ユーザーを検索できません。");
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

                 </div>
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
localStorage.setItem('core_v4_friend_list',JSON.stringify(myFriendList));
window.queueBackgroundSave?.();
userStats.friends_count = myFriendList.length;
await window.saveUserStats();
    window.checkAndRewardTitleBonusXP();
    window.sortAndRenderFriendList();
    window.applyProfileToUi();
}
};
// 🌟 プロフィール保存処理（Firebaseへ即時リアルタイム反映）
// ==========================================================================
// 🎮 フラッシュカード（単語フラッシュ）制御モジュール
// ==========================================================================
// 🚀 完全同期ライフサイクルブートストラップ初期化
// ==========================================================================
// defer スクリプト実行中は readyState が interactive になるが、後続の
// reader.js 等はまだ未実行である。complete になる前に起動すると
// renderHistoryList / renderBookshelf が未定義のまま呼ばれるため、
// 保存データの復元と全スクリプトの読み込み完了を待ってから起動する。
function bootApplicationAfterScripts() {
Promise.resolve(window.loadLocalState()).catch(function(error) {
console.error('アプリ初期化に失敗しました:', error);
});
window.initLucide();

if(typeof window.renderActivityChart === 'function') window.renderActivityChart();
}
if(window.appScriptsReady){
window.appScriptsReady.then(bootApplicationAfterScripts).catch(function(error){console.error("アプリを開始できませんでした",error);});
} else if (document.readyState !== "complete") {
document.addEventListener("DOMContentLoaded", bootApplicationAfterScripts, { once: true });
} else {
setTimeout(bootApplicationAfterScripts, 0);
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
const headerLevelTextEl = document.getElementById('headerLevelTextSlot');
if(headerLevelTextEl) headerLevelTextEl.innerText = `Lv.${lvlData.level} [Next:${lvlData.nextLevelRequiredExp}]`;
}
};
// コミュニティ・ランキング表示の修正
// Rankings live in the titles tab; friends no longer have horizontal sub-pages.
var titlesPages=document.getElementById('titlesPages');
if(titlesPages)titlesPages.addEventListener('scroll',function(){var index=Math.round(titlesPages.scrollLeft/Math.max(1,titlesPages.clientWidth));document.querySelectorAll('.titles-page-nav button').forEach(function(button,i){button.setAttribute('aria-pressed',String(i===index));});},{passive:true});
window.onTabChange(function(tabId){if(tabId==='titles')window.renderLeaderboard();});
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
    if(w.partOfSpeech||w.pos)clean.partOfSpeech=String(w.partOfSpeech||w.pos);
    // Display number (when it differs from the identity number) and unit belong to the book itself.
    var shown=Number(w.no);if(Number.isSafeInteger(shown)&&shown>0&&shown!==Number(w.num))clean.no=shown;
    if(w.unit&&String(w.unit).trim())clean.unit=String(w.unit).replace(/\s+/g,' ').trim().slice(0,60);
    if (Array.isArray(w.meanings) && w.meanings.length > 0) {
      clean.meanings = w.meanings.map(function(m, i) {
        var meaning={ id: m.id || (String(w.num) + "-" + i), text: m.text || "" };
        if(m.partOfSpeech||m.pos)meaning.partOfSpeech=String(m.partOfSpeech||m.pos);
        return meaning;
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
      note: String(w.note || ""), sticky: !!w.sticky,
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
    w.note = p && typeof p.note === "string" ? p.note : String(w.note || ""); w.sticky = !!(p && p.sticky);
    w.status = "none";
    w.history = [];
    w.meanings = (w.meanings || []).map(function(m) {
      return { id: m.id, text: m.text, partOfSpeech: m.partOfSpeech || m.pos || '', status: "none", history: [] };
    });
    if (p && p.sig === window.buildWordSignature(w)) {
      w.status = p.status || "none";
      w.history = Array.isArray(p.history) ? p.history.slice(-20) : [];
      w.meanings = w.meanings.map(function(m) {
        var mp = p.meanings ? p.meanings[m.id] : null;
        if (mp) {
          return { id: m.id, text: m.text, partOfSpeech: m.partOfSpeech || m.pos || '', status: mp.status || "none", history: Array.isArray(mp.history) ? mp.history.slice(-20) : [] };
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
window.saveVocabMasterToStorage = async function() {
  if (typeof window.rebuildVocabStemIndex === "function") window.rebuildVocabStemIndex();
  const bookKey = currentTextbook || "default";
  const uid = (typeof myId !== "undefined" && myId) ? myId : "GUEST-000";
  if(window.VocabMaster&&!window.VocabMaster.canCapture(bookKey,vocabList))return false;
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
      await window.fbSetDoc(sharedRef, { custom_words: masterWords, emptyConfirmed:masterWords.length===0, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {}
  }
};

// ------------------------------------------------------------------
// 2. 軽量化（デバウンス保存・部分更新）
// ------------------------------------------------------------------
window.__vocabSaveTimer = null;
window.__userStatsTimer = null;
window.__vocabRenderTimer = null;

// 理解度は通信を待たず、先に端末へ保存する。
window.saveVocabProgressLocally = function(wordNum, skipDirtyMark) {
  if(window.LibraryState&&window.LibraryState.isDeleted('book',currentTextbook||'default'))return;
  if (typeof myId === "undefined" || !myId || typeof window.extractUserProgressFromVocabList !== "function") return;
  var bookKey = currentTextbook || "default";
  if(window.LearningData&&!window.LearningData.canSave(bookKey))return;
  var rendered = window.extractUserProgressFromVocabList(), stored = {};
  try { stored = JSON.parse(localStorage.getItem(window.getVocabProgressStorageKey(bookKey)) || '{}'); } catch(e) {}
  var progress = Object.assign({}, stored);
  if(wordNum !== null && wordNum !== undefined){if(rendered[String(wordNum)])progress[String(wordNum)]=rendered[String(wordNum)];}
  else Object.keys(rendered).forEach(function(key){if(!progress[key])progress[key]=rendered[key];});
  var now = skipDirtyMark && JSON.stringify(progress) === JSON.stringify(stored) ? Number(localStorage.getItem(window.getVocabProgressStorageKey(bookKey) + '__ts')) || 0 : Date.now();
  if(window.LearningData){progress=window.LearningData.commit(bookKey,rendered,wordNum);now=wordNum!==null&&wordNum!==undefined&&progress[String(wordNum)]?Number(progress[String(wordNum)].editedAt)||0:Number(localStorage.getItem(window.getVocabProgressStorageKey(bookKey)+"__ts"))||0;}
  currentUserVocabProgress = progress;
  try {
    localStorage.setItem(window.getVocabProgressStorageKey(bookKey), JSON.stringify(progress));
    localStorage.setItem(window.getVocabProgressStorageKey(bookKey) + "__ts", String(now));
  } catch (e) {
    console.error("理解度の端末保存に失敗しました:", e);
  }
  if (!skipDirtyMark && typeof window.markVocabProgressDirty === "function") window.markVocabProgressDirty(bookKey, wordNum);
};

// 変更のあった教材・単語だけを記録し、単語帳を閉じる時にクラウドへ確定する。
window.__dirtyVocabProgress = window.__dirtyVocabProgress || {};
window.markVocabProgressDirty = function(bookKey, wordNum) {
  bookKey = bookKey || currentTextbook || "default";
  var entry = window.__dirtyVocabProgress[bookKey] || { revision: 0, words: {} };
  entry.revision++;
  entry.words[wordNum === undefined || wordNum === null ? "*" : String(wordNum)] = true;
  window.__dirtyVocabProgress[bookKey] = entry;
};

window.flushDirtyVocabBook = async function(bookKey) {
  var entry = window.__dirtyVocabProgress[bookKey];
  if (!entry) return false;
  if (typeof myId === "undefined" || !myId || myId === "GUEST-000" || !window.db || !window.fbDoc || !window.fbGetDoc || !window.fbSetDoc) return false;
  var revision = entry.revision;
  var changedKeys = Object.keys(entry.words);
  var progressKey = window.getVocabProgressStorageKey(bookKey);
  var localProgress = {};
  try { localProgress = JSON.parse(localStorage.getItem(progressKey) || "{}") || {}; } catch (e) {}
  try {
    var ref = window.fbDoc(window.db, "users", myId, "vocabProgress", bookKey);
    var snap = await window.fbGetDoc(ref);
    var cloudProgress = {};
    if (snap.exists() && snap.data()) {
      var data = snap.data();
      try { cloudProgress = data.wordsJson ? JSON.parse(data.wordsJson) : (data.words || {}); } catch (e) { cloudProgress = {}; }
    }
    var merged = Object.assign({}, cloudProgress);
    if (entry.words["*"]) {
      Object.keys(localProgress).forEach(function(key) { merged[key] = localProgress[key]; });
    } else {
      changedKeys.forEach(function(key) { if (localProgress[key]) merged[key] = localProgress[key]; });
    }
    var savedAt = Date.now();
    await window.fbSetDoc(ref, { wordsJson: JSON.stringify(merged), updatedAt: new Date(savedAt).toISOString(), updatedAtMs: savedAt }, { merge: true });
    var latestLocal = {};
    var latestLocalTs = 0;
    try { latestLocal = JSON.parse(localStorage.getItem(progressKey) || "{}") || {}; } catch (e) {}
    try { latestLocalTs = parseInt(localStorage.getItem(progressKey + "__ts") || "0") || 0; } catch (e) {}
    var safeLocal = Object.assign({}, merged, latestLocal);
    localStorage.setItem(progressKey, JSON.stringify(safeLocal));
    localStorage.setItem(progressKey + "__ts", String(Math.max(savedAt, latestLocalTs)));
    if (window.__dirtyVocabProgress[bookKey] && window.__dirtyVocabProgress[bookKey].revision === revision) delete window.__dirtyVocabProgress[bookKey];
    return true;
  } catch (error) {
    console.error("単語帳の変更保存に失敗しました:", error);
    return false;
  }
};

window.flushAllDirtyVocabBooks = function() {
  return Promise.all(Object.keys(window.__dirtyVocabProgress).map(function(bookKey) {
    return window.flushDirtyVocabBook(bookKey);
  }));
};

window.flushChangedVocabData = function() {
  // Tab changes and suspension may fire together. Keep a durable local draft,
  // then let the shared background queue perform a single cloud backup.
  if(Object.keys(window.__dirtyVocabProgress||{}).length||Object.keys(window.__dirtyManualVocabDrafts||{}).length){
    if((window.__dirtyVocabProgress?.[currentTextbook]||window.__dirtyManualVocabDrafts?.[currentTextbook])&&window.__captureManualVocabDraft)window.__captureManualVocabDraft();
    window.queueBackgroundSave?.();
  }
  return window.AppStorage?window.AppStorage.flush():Promise.resolve();
};

window.onTabChange(function(tabId) {
  if (tabId !== "vocab") {
    window.flushChangedVocabData();
  }
});
document.addEventListener("visibilitychange", function() {
  if (document.visibilityState === "hidden") {
    window.flushChangedVocabData();
  }
});
window.addEventListener("pagehide", function() {
  window.flushChangedVocabData();
});


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
    if (!String(w.word || "").toLowerCase().includes(searchKeyword) && !String(w.meaning || "").includes(searchKeyword) && !String(w.note || "").toLowerCase().includes(searchKeyword)) return false;
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
  var bodies = document.querySelectorAll('[id="wordCardBody-' + CSS.escape(String(wordNum)) + '"]');
  if (!bodies.length) {
    if (window.vocabCardMatchesFilter(w)) window.scheduleVocabListRender(600);
    return;
  }
  bodies.forEach(function(body) {
    var card = body.closest(".word-row-container");
    if (!card) return;
    // List filters never dismiss the independent flashcard detail card.
    if (card.closest("#vocabListContainer") && !window.vocabCardMatchesFilter(w)) {
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
  });
};

// ------------------------------------------------------------------
// 3. 上書き: saveVocabToStorage / loadCurrentTextbookData / preload
// ------------------------------------------------------------------
window.saveVocabToStorage = async function() {
  if (typeof window.rebuildVocabStemIndex === "function") window.rebuildVocabStemIndex();
  await window.saveUserVocabProgress();
  if (window.isAdmin) await window.saveVocabMasterToStorage();
};

// Startup needs book metadata, not every book's master word list.
window.preloadAllTextbooksAndVocab = async function() {
  await window.syncTextbooksIndexFromFirestore();
};

window.loadCurrentTextbookData = async function(options) {
  let storedWords = [];
  const request=window.__vocabMasterLoadSequence=(window.__vocabMasterLoadSequence||0)+1;
  const bookKey = currentTextbook || "default";
  const uid = (typeof myId !== "undefined" && myId) ? myId : "GUEST-000";
  if(window.LibraryState&&window.LibraryState.isDeleted('book',bookKey,uid))return;
  const currentLocalKey = "core_v4_custom_words_" + uid + "_" + bookKey;
  const localDraft=window.VocabMaster.resolve(bookKey);
  if(localDraft)storedWords=localDraft.master;
  else if(currentTextbook){
    // Fetch only the book being opened. Index-only startup does not contain its words.
    if(!window.db||!window.fbGetDoc||!window.fbDoc)throw new Error("単語データを取得できません。接続後に開き直してください（保存内容は変更していません）。");
    const snap=await window.fbGetDoc(window.fbDoc(window.db,"shared","vocab_"+bookKey));
    if(myId!==uid||(currentTextbook||"default")!==bookKey||window.__vocabMasterLoadSequence!==request)return;
    const data=snap&&snap.exists()&&snap.data();
    if(!data||!Array.isArray(data.custom_words)||(!data.custom_words.length&&data.emptyConfirmed!==true))throw new Error("単語データを確認できません。接続後に開き直してください（保存内容は変更していません）。");
    storedWords=data.custom_words;
    if(!storedWords.length)window.VocabMaster.confirmEmpty(bookKey);
    textbooksCacheMap[bookKey]=window.stripVocabProgressFromWords(storedWords);
    try{localStorage.setItem("core_v4_cache_"+bookKey,JSON.stringify(textbooksCacheMap[bookKey]));}catch(e){}
  }
  storedWords = window.stripVocabProgressFromWords(storedWords);
  const loadedWords = window.migrateVocabData(storedWords);
  // 保存済み教材のローカル理解度がある時は、表示前の通信を不要にする。
  if (options && options.localProgress) {
    currentUserVocabProgress = options.localProgress;
  } else {
    await window.loadUserVocabProgress(bookKey);
  }
  if(myId!==uid||(currentTextbook||"default")!==bookKey||window.__vocabMasterLoadSequence!==request)return;
  vocabList=loadedWords;
  if(window.LearningData)currentUserVocabProgress=window.LearningData.restore(bookKey,currentUserVocabProgress);
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

// ------------------------------------------------------------------
// 5. フラッシュカード テンポ改善
// ------------------------------------------------------------------
window.__flashcardSessionActive = false;
window.__flashcardNextDelay = 150;
// ------------------------------------------------------------------
// 6. シーズンランキング
// ------------------------------------------------------------------
window.__seasonRankingAnchor = window.__seasonRankingAnchor || new Date(2026, 6, 27, 0, 0, 0);

window.ensureSeasonUserStats = function() {
  if (!userStats) return;
  if (!Array.isArray(userStats.seasonTitles)) userStats.seasonTitles = [];
  if (!Array.isArray(userStats.settledSeasons)) userStats.settledSeasons = [];
};







// ------------------------------------------------------------------
// 7. ゲームランキングUI（殿堂/シーズン切替）
// ------------------------------------------------------------------





// ------------------------------------------------------------------
// 8. endGameSession上書き（殿堂＋シーズン保存）
// ------------------------------------------------------------------



// ------------------------------------------------------------------
// 9. シーズン称号表示
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 10. EXP全ユーザーランキング
// ------------------------------------------------------------------
window.__leaderboardCache = null;
window.__leaderboardCacheAt = 0;
window.__leaderboardLoadingPromise = null;




// ------------------------------------------------------------------
// 11. フレンド最新化
// ------------------------------------------------------------------
window.__friendRefreshLastAt = 0;
window.__friendRefreshButtonInjected = false;


window.injectFriendRefreshButton = function() {}; // Replaced by the compact users toolbar.



// ------------------------------------------------------------------
// 12. 欠番検索パネル
// ------------------------------------------------------------------



// ------------------------------------------------------------------
// 13. 管理画面: 教材選択で単語帳切替
// ------------------------------------------------------------------



// ------------------------------------------------------------------
// 14. アカウント安定化
// ------------------------------------------------------------------
window.__authProcessing = false;
window.__allUsersExactWrite = false;
window.__lastLoginRecorded = false;






window.recordLastLoginOnce = async function() {
  if (typeof myId === "undefined" || !myId || myId === "GUEST-000") return;
  if (window.__lastLoginRecorded) return;
  window.__lastLoginRecorded = true;
  try { userStats.lastLoginAt = new Date().toISOString(); await window.saveUserStats(); } catch (e) {}
};

// ------------------------------------------------------------------
// 15. 管理者: ユーザーID復旧ボックス
// ------------------------------------------------------------------


// ------------------------------------------------------------------
// 16. switchTab上書き（全機能のUI注入）
// ------------------------------------------------------------------
window.onTabChange(function(tabId) {
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
    ;
  }
});

// ------------------------------------------------------------------
// 17. loadLocalState上書き（全初期化）
// ------------------------------------------------------------------
window.onAppLoaded(async function() {
  if (myId && myId !== "GUEST-000") {
    window.ensureSeasonUserStats();

    await window.recordLastLoginOnce();

    if (typeof window.renderLeaderboard === "function") window.renderLeaderboard(false);
  }
});

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

// 保存は右上のセーブボタンから行う。ページ離脱時の自動保存は行わない。

// ------------------------------------------------------------------
// 20. シーズンランキング定期チェック（60秒間隔）
// ------------------------------------------------------------------


// ==========================================================================
// 🔐 ログイン安定化＆自動復旧パッチ
// ==========================================================================

// ------------------------------------------------------------------
// 1. getAllUsers: 端末キャッシュを優先し、通信不良でログインを止めない
// ------------------------------------------------------------------
window.getAllUsers = async function() {
  let localUsers = [];
  try {
    const parsed = JSON.parse(localStorage.getItem("core_v4_users") || "[]");
    if (Array.isArray(parsed)) localUsers = parsed;
  } catch (e) {}

  if (!window.db || !window.fbGetDoc || !window.fbDoc) return localUsers;

  const fetchCloudUsers = async function() {
    const ref = window.fbDoc(window.db, "shared", "all_users");
    const snap = await window.fbGetDoc(ref);
    if (!snap.exists() || !snap.data() || !Array.isArray(snap.data().users)) return [];
    const cloudUsers = snap.data().users;
    // This device keeps the list without real names or ages.
    try { localStorage.setItem("core_v4_users", JSON.stringify(cloudUsers.map(function(u) { return u && u.id ? window.LoginIdentity.publicEntry(u) : u; }))); } catch (e) {}
    window.__scheduleAccountListMigration?.(cloudUsers);
    return cloudUsers;
  };

  // キャッシュがあれば即座に返し、クラウド更新は裏で行う。
  if (localUsers.length > 0) {
    fetchCloudUsers().catch(function(e) { console.warn("ユーザー一覧のバックグラウンド更新に失敗しました:", e); });
    return localUsers;
  }

  // 初回端末でも通信を最大4秒で打ち切り、ログイン画面を固めない。
  try {
    return await Promise.race([
      fetchCloudUsers(),
      new Promise(function(resolve) { setTimeout(function() { resolve([]); }, 4000); })
    ]);
  } catch (e) {
    console.warn("ユーザー一覧を取得できませんでした:", e);
    return [];
  }
};

// ------------------------------------------------------------------
// 2. saveAllUsers: ID単位マージで他のユーザーを消さない
// ------------------------------------------------------------------
window.saveAllUsers = async function(incomingUsers, knownDigests) {
  // The shared list keeps only what login needs (no real name or age), and PINs only as digests.
  // Digests are worked out before the transaction, which must stay short.
  const digests = knownDigests instanceof Map ? knownDigests : new Map();
  const prepare = async function(list) {
    for (const u of list || []) {
      const pin = u && u.id ? window.LoginIdentity.storedPin(u) : "";
      if (pin && !window.LoginIdentity.isDigest(pin) && !digests.has(u.id + "\n" + pin))
        digests.set(u.id + "\n" + pin, await window.LoginIdentity.digest(u.id, pin));
    }
  };
  const clean = function(u) {
    const entry = window.LoginIdentity.publicEntry(u);
    const pin = window.LoginIdentity.storedPin(entry);
    if (pin && !window.LoginIdentity.isDigest(pin) && digests.has(entry.id + "\n" + pin))
      entry.pin = digests.get(entry.id + "\n" + pin);
    return entry;
  };
  const mergeInto = function(baseUsers) {
    const userMap = new Map();
    (baseUsers || []).forEach(function(u) { if (u && u.id) userMap.set(u.id, u); });
    (incomingUsers || []).forEach(function(u) {
      if (u && u.id) userMap.set(u.id, Object.assign({}, userMap.get(u.id) || {}, u));
    });
    return Array.from(userMap.values()).map(clean);
  };
  const rememberLocally = function(users) {
    try { localStorage.setItem("core_v4_users", JSON.stringify(users)); } catch (e) {}
  };
  const cachedUsers = function() {
    try {
      const parsed = JSON.parse(localStorage.getItem("core_v4_users") || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  };

  try { await prepare(incomingUsers); await prepare(cachedUsers()); } catch (e) { console.warn("PINの保護を準備できませんでした:", e); }
  // 読み込みと書き込みを同じトランザクションで行い、同時登録・PIN再設定を古い一覧で上書きしない。
  if (window.db && window.fbRunTransaction && window.fbDoc) {
    try {
      const ref = window.fbDoc(window.db, "shared", "all_users");
      let mergedUsers = [];
      await window.fbRunTransaction(window.db, async function(tx) {
        const snap = await tx.get(ref);
        mergedUsers = mergeInto(snap.exists() && Array.isArray(snap.data().users) ? snap.data().users : []);
        tx.set(ref, { users: mergedUsers }, { merge: true });
      });
      rememberLocally(mergedUsers);
      return mergedUsers;
    } catch (e) {
      // 最新の一覧を読めないまま書き戻すと他のユーザーを消すため、端末にだけ反映する。
      console.error("saveAllUsers Firebase error:", e);
      const localUsers = mergeInto(cachedUsers());
      rememberLocally(localUsers);
      return localUsers;
    }
  }

  const localUsers = mergeInto(cachedUsers());
  rememberLocally(localUsers);
  return localUsers;
};

// ------------------------------------------------------------------
// 2b. 旧形式の一覧の移行: PINをダイジェストに、本名・年齢は一覧から外す
// ------------------------------------------------------------------
// The first device that reads a list with digits or real names rewrites it once, then gives each
// still-legacy users/{id} the same digest (only where the document still holds those digits).
window.__scheduleAccountListMigration = function(users) {
  if (window.__accountListMigration || !Array.isArray(users)) return;
  const L = window.LoginIdentity;
  const legacy = users.filter(function(u) {
    const pin = u && u.id ? L.storedPin(u) : "";
    return u && u.id && (u.realName !== undefined || u.age !== undefined || (pin && !L.isDigest(pin)));
  });
  if (!legacy.length) return;
  window.__accountListMigration = (async function() {
    await new Promise(function(resolve) { setTimeout(resolve, 2500); });
    const digests = new Map();
    for (const u of legacy) {
      const pin = L.storedPin(u);
      if (pin && !L.isDigest(pin)) digests.set(u.id + "\n" + pin, await L.digest(u.id, pin));
    }
    await window.saveAllUsers([], digests);
    if (!window.db || !window.fbRunTransaction || !window.fbDoc) return;
    for (const [key, value] of digests) {
      const parts = key.split("\n"), ref = window.fbDoc(window.db, "users", parts[0]);
      try {
        await window.fbRunTransaction(window.db, async function(tx) {
          const snap = await tx.get(ref);
          if (snap.exists() && String(snap.data().pin) === parts[1]) tx.set(ref, { pin: value }, { merge: true });
        });
      } catch (e) {
        console.warn("PINの移行は次回に再試行します:", e);
        break;
      }
    }
  })().catch(function(e) { console.warn("ユーザー一覧の移行は次回に再試行します:", e); });
};

// ------------------------------------------------------------------
// 3. ユーザーをall_usersに自動復旧（PINが空の登録も補完）
// ------------------------------------------------------------------
window.recoverUserToAllUsers = async function(userData) {
  if (!userData || !userData.id) return;

  try {
    const users = await window.getAllUsers();
    const existing = users.find(function(u) {
      return u && u.id === userData.id;
    });
    const pin = window.LoginIdentity.storedPin(userData);

    if (!existing) {
      await window.saveAllUsers([{
        id: userData.id,
        playerName: userData.playerName || "プレイヤー",
        realName: userData.realName || "一般",
        age: userData.age || "18",
        pin: pin
      }]);
      console.log("ユーザー " + userData.id + " をall_usersに自動復旧");
    } else if (pin && !window.LoginIdentity.storedPin(existing)) {
      await window.saveAllUsers([Object.assign({}, existing, { pin: pin })]);
    }
  } catch (e) {
    console.error("ユーザー自動復旧エラー:", e);
  }
};

// ------------------------------------------------------------------
// 4. Firebaseのusers/{id}を確認（通信不良と「見つからない」を区別する）
// ------------------------------------------------------------------
window.lookupCloudAccount = async function(userId) {
  if (!window.db || !window.fbGetDoc || !window.fbDoc) return { state: "unavailable", reason: "network" };
  let timer;
  try {
    const snap = await Promise.race([
      window.fbGetDoc(window.fbDoc(window.db, "users", userId)),
      new Promise(function(resolve, reject) { timer = setTimeout(function() { reject(Error("login timeout")); }, 10000); })
    ]);
    if (!snap.exists()) return { state: "missing" };
    return { state: "found", data: snap.data() };
  } catch (e) {
    console.warn("ログイン時のアカウント確認に失敗しました:", e);
    return { state: "unavailable", reason: window.LoginIdentity.unavailableReason(e) };
  } finally {
    clearTimeout(timer);
  }
};


// 他端末でのログインに必要なPINがusers/{id}に無い場合だけ補完する。
// 確認と書き込みを同じトランザクションで行い、直前のPIN再設定を古いPINで戻さない。
window.restoreCloudPinIfMissing = async function(userId, pin) {
  if (!userId || !pin || !window.db || !window.fbRunTransaction || !window.fbDoc) return false;
  pin = await window.LoginIdentity.protect(userId, pin);
  const ref = window.fbDoc(window.db, "users", userId);
  return window.fbRunTransaction(window.db, async function(tx) {
    const snap = await tx.get(ref);
    if (!snap.exists() || snap.data().deleted || window.LoginIdentity.storedPin(snap.data())) return false;
    tx.set(ref, { pin: pin }, { merge: true });
    return true;
  });
};

window.repairCloudPin = async function(user) {
  const pin = window.LoginIdentity.storedPin(user);
  if (!user || !user.id || !pin) return;
  await window.restoreCloudPinIfMissing(user.id, pin);
};

// ------------------------------------------------------------------
// 5. handleAuthSubmit: 3段階ログイン戦略＋自動復旧
// ------------------------------------------------------------------
window.handleAuthSubmit = async function() {
  if (window.__authProcessing) return;
  window.__authProcessing = true;
  const submitBtn = document.getElementById("authSubmitBtn");
  if (submitBtn) submitBtn.disabled = true;
  try {
    await window.__submitAuthForm();
  } finally {
    window.__authProcessing = false;
    if (submitBtn) submitBtn.disabled = false;
  }
};

window.__submitAuthForm = async function() {
  const authReg = document.getElementById("authTabRegister");
  const isRegister = authReg ? authReg.classList.contains("active") : false;
  const errorMsg = document.getElementById("authErrorMsg");
  const showError = function(text) {
    if (errorMsg) { errorMsg.innerText = text; errorMsg.style.display = "block"; }
  };
  if (errorMsg) errorMsg.style.display = "none";

  if (isRegister) {
    const pName = document.getElementById("regPlayerName").value.trim();
    const pin = window.LoginIdentity.pin(document.getElementById("regPin").value);

    if (!pName || !pin) {
      showError("すべての項目を入力してください。");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      showError("暗証番号は4桁の数字で設定してください。");
      return;
    }
    if (!window.db || !window.fbSetDoc || !window.fbDoc) {
      showError("サーバーに接続できないため登録できません。\n通信環境を確認して再度お試しください。");
      return;
    }

    const newId = window.generateUserId();
    // Only the digest of the PIN is stored; the shared list gets no real name or age.
    const pinDigest = await window.LoginIdentity.digest(newId, pin);
    const newUserObj = { id: newId, playerName: pName, pin: pinDigest };

    // users/{id} が無いと他の端末からログインできないため、保存できた場合だけ登録完了にする。
    try {
      const userRef = window.fbDoc(window.db, "users", newId);
      await window.fbSetDoc(userRef, {
        id: newId,
        playerName: pName,
        pin: pinDigest,
        selectedTitle: "称号なし",
        totalExp: 0,
        avatar: "",
        userStats: { user_level: 1, study_burst: 0 }
      }, { merge: true });
    } catch (e) {
      console.error("Firebase新規登録エラー:", e);
      const reason = window.LoginIdentity.unavailableReason(e);
      showError(reason === "quota"
        ? "サーバーの利用上限に達しているため登録できませんでした。\n時間をおいて再度お試しください。"
        : "サーバーに保存できなかったため登録できませんでした。\n通信環境を確認して再度お試しください。");
      return;
    }

    try { await window.saveAllUsers([newUserObj]); } catch (e) { console.error("all_users登録エラー:", e); }

    alert("アカウントを作成しました。\nあなたのログインIDは【 " + newId + " 】です。\nログインに必要なので、必ずメモしてください。");
    localStorage.setItem("core_v4_userId", newId);
    localStorage.setItem("core_v4_userName", pName);
    localStorage.setItem("core_v4_userTarget", "未設定");
    localStorage.setItem("core_v4_totalExp", "0");
    window.loadLocalState();

  } else {
    const ids = window.LoginIdentity.idCandidates(document.getElementById("loginIdInput").value);
    const pinInput = window.LoginIdentity.pin(document.getElementById("loginPinInput").value);

    if (!ids.length || !pinInput) {
      showError("IDと暗証番号を入力してください。");
      return;
    }

    let user = null;
    let loginMethod = "";
    let unavailable = "";
    let deleted = false;

    // 戦略1: all_users から検索
    try {
      user = await window.LoginIdentity.findVerified(await window.getAllUsers(), ids, pinInput);
      if (user) loginMethod = "all_users";
    } catch (e) {
      console.error("戦略1 all_users検索エラー:", e);
    }

    // 戦略2: Firebase users/{id} から直接検索
    for (let i = 0; !user && i < ids.length; i++) {
      const result = await window.lookupCloudAccount(ids[i]);
      if (result.state === "unavailable") { unavailable = unavailable || result.reason; continue; }
      if (result.state !== "found") continue;
      if (result.data.deleted) { deleted = true; continue; }
      if (await window.LoginIdentity.verify(Object.assign({}, result.data, { id: ids[i] }), ids, pinInput)) {
        user = { id: ids[i], playerName: result.data.playerName || "プレイヤー", realName: result.data.realName || "一般", age: result.data.age || "18", pin: String(result.data.pin) };
        loginMethod = "firebase_direct";
      }
    }

    // 戦略3: ローカルキャッシュから検索
    if (!user && !deleted) {
      try {
        user = await window.LoginIdentity.findVerified(JSON.parse(localStorage.getItem("core_v4_users") || "[]"), ids, pinInput);
        if (user) loginMethod = "local_cache";
      } catch (e) {}
    }

    if (user) {
      // A PIN still stored as digits is replaced by its digest, in users/{id} and the shared list.
      if (!window.LoginIdentity.isDigest(window.LoginIdentity.storedPin(user))) {
        const plain = window.LoginIdentity.storedPin(user);
        user = Object.assign({}, user, { pin: await window.LoginIdentity.digest(user.id, pinInput) });
        try {
          if (window.db && window.fbRunTransaction && window.fbDoc) {
            const ref = window.fbDoc(window.db, "users", user.id);
            await window.fbRunTransaction(window.db, async function(tx) {
              const snap = await tx.get(ref);
              if (snap.exists() && String(snap.data().pin) === plain) tx.set(ref, { pin: user.pin }, { merge: true });
            });
          }
          await window.saveAllUsers([{ id: user.id, pin: user.pin }]);
        } catch (e) {
          console.warn("PINの保護は次回のログインで再試行します:", e);
        }
      }
      // all_users以外から見つかった場合は自動復旧
      if (loginMethod !== "all_users") {
        try {
          await window.recoverUserToAllUsers(user);
        } catch (e) {
          console.error("ログイン時自動復旧エラー:", e);
        }
      }
      window.showLoginConfirmPopup(user);
    } else if (deleted) {
      showError("このアカウントは管理者により削除されています。");
    } else if (unavailable === "quota") {
      showError("サーバーの利用上限に達しているため、アカウントを確認できませんでした。\n時間をおいて再度お試しください。");
    } else if (unavailable) {
      showError("サーバーに接続できず、アカウントを確認できませんでした。\n通信環境を確認して再度お試しください。");
    } else {
      showError("IDまたは暗証番号が違います。\nIDは発行された英字（大文字・小文字どちらでも可）と数字です。");
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
    '<div style="color:white; font-size:18px; font-weight:800; margin-bottom:8px;">ログインの確認</div>' +
    '<div style="color:var(--text-sub); font-size:13px; margin-bottom:16px; line-height:1.6;">' +
    "このアカウントでログインしますか？<br>" +
    '<div style="background:rgba(0,0,0,0.4); padding:10px; border-radius:8px; margin-top:8px; text-align:left;">' +
    "<strong>プレイヤー名:</strong> <span style=\"color:white;\">" + String(user.playerName || "プレイヤー").replace(/[&<>"']/g, function(c) { return "&#" + c.charCodeAt(0) + ";"; }) + "</span><br>" +
    "<strong>ID:</strong> <span style=\"color:white;\">" + String(user.id).replace(/[&<>"']/g, function(c) { return "&#" + c.charCodeAt(0) + ";"; }) + "</span>" +
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

  document.getElementById("confirmLoginBtn").onclick = function() {
    // ログイン確定は端末へ即時反映する。クラウド復旧を待たせない。
    localStorage.setItem("core_v4_userId", user.id);
    localStorage.setItem("core_v4_userName", user.playerName || "プレイヤー");
    if (!localStorage.getItem("core_v4_userTarget")) localStorage.setItem("core_v4_userTarget", "未設定");
    if (!localStorage.getItem("core_v4_totalExp")) localStorage.setItem("core_v4_totalExp", "0");

    document.body.removeChild(overlay);
    const gateScreen = document.getElementById("auth-gate-screen");
    if (gateScreen) gateScreen.style.display = "none";
    if (typeof window.forceHidePenguinLoading === "function") window.forceHidePenguinLoading();
    window.loadLocalState();
    Promise.resolve(window.recoverUserToAllUsers(user)).catch(function(e) {
      console.error("ログイン確定時自動復旧エラー:", e);
    });
    Promise.resolve(window.repairCloudPin(user)).catch(function(e) {
      console.error("ログイン確定時PIN補完エラー:", e);
    });
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
            playerName: data.playerName || localStorage.getItem("core_v4_userName") || "プレイヤー",
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
window.onAppLoaded(async function() {
  await window.autoRecoverCurrentUser();
  // 登録時にPINがクラウドへ保存されなかったアカウントを、端末に残るPINで一度だけ補完する。
  const savedId = localStorage.getItem("core_v4_userId");
  const checkedKey = "core_v4_cloud_pin_checked_" + savedId;
  if (!savedId || savedId === "GUEST-000" || localStorage.getItem(checkedKey)) return;
  try {
    const cached = JSON.parse(localStorage.getItem("core_v4_users") || "[]");
    const entry = (Array.isArray(cached) ? cached : []).find(function(u) { return u && u.id === savedId; });
    if (entry && window.LoginIdentity.storedPin(entry)) {
      await window.restoreCloudPinIfMissing(savedId, window.LoginIdentity.storedPin(entry));
    }
    localStorage.setItem(checkedKey, "1");
  } catch (e) {
    console.warn("PIN補完を確認できませんでした:", e);
  }
});

// ------------------------------------------------------------------
// 9. 管理者用: 指定ユーザーをall_usersに強制復旧
// ------------------------------------------------------------------

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

      if (!window.verifyAdminPassword(adminPass)) {
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

        const newPinDigest = await window.LoginIdentity.digest(userId, newPin);
        if (window.db && window.fbSetDoc && window.fbDoc) {
          const userRef = window.fbDoc(window.db, "users", userId);
          await window.fbSetDoc(userRef, {
            pin: newPinDigest
          }, { merge: true });
        }

        try {
          let allUsers = await window.getAllUsers();
          const idx = allUsers.findIndex(function(u) { return u.id === userId; });
          if (idx !== -1) {
            // 他のユーザーの古い端末キャッシュを書き戻さないよう、対象者だけを更新する。
            await window.saveAllUsers([Object.assign({}, allUsers[idx], { pin: newPinDigest })]);
          } else {
            await window.saveAllUsers([{
              id: userId,
              playerName: userData.playerName || "プレイヤー",
              pin: newPinDigest
            }]);
          }
        } catch (e) {
          console.error("all_users更新エラー:", e);
        }

        document.body.removeChild(overlay);

        alert("PINを再設定しました。\n新しいPINでログインしてください。\n\nID: " + userId + "\n新PIN: " + newPin);

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
    var gate = document.getElementById("auth-gate-screen");
    if(gate) observer.observe(gate, { childList: true, subtree: true, attributes: true, attributeFilter:["style","class"] });
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
        // 自分の項目だけを最新の一覧へ反映する（古い一覧で他人の登録を消さない）。
        await window.saveAllUsers([{ id: myId, playerName: myName }]);
    } catch (e) {
        console.error("syncMyEntryToAllUsers エラー:", e);
    }
};


// ------------------------------------------------------------------
// Phase 1-B：loadUserStats を上書き
//   ・totalExp は「ローカルとクラウドの大きい方」を採用（古いデータで上書きされて消えるのを防止）
//   ・読み込み後にレベルを再計算
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Phase 2-A：EXP全ユーザーランキングのレベル優先順を修正
//   （古い user_level を信じず、必ず totalExp から計算する）
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Phase 2-B：フレンド最新化のレベル優先順を修正
//   （古い user_level を信じず、必ず totalExp から計算する）
// ------------------------------------------------------------------

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

window.__updatePenguinText = function(message) {
  var overlay = window.__pgLoad && window.__pgLoad.overlay;
  var label = overlay && overlay.querySelector('.penguin-loading-text');
  if (label) label.textContent = message || '読み込み中';
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
window.forceHidePenguinLoading = function() {
  var st = window.__pgLoad;
  if (!st) return;
  st.count = 0;
  if (st.pendingTimer) { clearTimeout(st.pendingTimer); st.pendingTimer = null; }
  window.__actuallyHidePenguin();
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
  'switchTextbookContext',        // 単語帳を切り替えた時
  'refreshFriendListFromFirebase',// フレンドリスト更新時
  'handleAuthSubmit',             // ログイン処理
  'startFlashcardSession',        // フラッシュカード開始時
  'analyzeText',                  // 長文解析時
  'searchAndAddFriend'            // フレンド追加時
].forEach(function(fn){ window.__wrapWithPenguin(fn); });

// ------------------------------------------------------------------
// Phase 4：単語帳詳細ボタン（📊）修正
//   ・単語帳切り替え時に必ず再バインド（古いデータを参照しないように）
//   ・ポップアップに「現在の単語帳名」を表示（全体ではなく今の単語帳であることが分かる）
// ------------------------------------------------------------------


// ==========================================================================
// 🐧 ペンギン差し替えパッチ：リアル版（アデリー/コウテイペンギン風）
//    ※このファイルの末尾にそのまま貼り付けてください。
//    ※第2回パッチの __renderPenguinOverlay を自動で上書きします。
// ==========================================================================
// ==========================================================================
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
  // Saving is automatic (study end, going to the background); the header has no save button.
  var stale = document.getElementById('headerSaveBtn');
  if (stale) stale.remove();
  return;
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
    window.showToast('保存しました', 'ok');
    if (btn) { btn.classList.add('header-save-done'); setTimeout(function() { btn.classList.remove('header-save-done'); }, 700); }
  } catch (e) {
    console.error('manualSaveAll error:', e);
    window.showToast('保存に失敗しました', 'err');
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


// 終了時に必ず復元（finish / quit 両方をカバー）
var __prevFinishFlashcardSessionForBookFix = window.finishFlashcardSession;
window.finishFlashcardSession = function() {
  if (typeof window.flushAllDirtyVocabBooks === 'function') window.flushAllDirtyVocabBooks();
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

// ------------------------------------------------------------------
// E. switchTab 上書き：コミュニティ切替後の transform/opacity 残留を解消
//    ＋ 保存ボタンの表示状態を同期
// ------------------------------------------------------------------
window.onTabChange(function(tabId) {
  if (tabId === 'community') {
    var ra = document.getElementById('leaderboardSection') || (document.getElementById('leaderboardContainer') ? document.getElementById('leaderboardContainer').parentElement : null);
    var fa = document.getElementById('friendSection') || (document.getElementById('friendListContainer') ? document.getElementById('friendListContainer').parentElement : null);
    [ra, fa].forEach(function(el) {
      if (el) { el.style.transform = ''; el.style.opacity = ''; el.style.transition = ''; el.classList.remove('slide-from-right', 'slide-from-left'); }
    });
  }
  window.injectHeaderSaveButton();
});

// ------------------------------------------------------------------
// F. loadLocalState 上書き：起動／ログイン後に保存ボタンを注入
// ------------------------------------------------------------------
window.onAppLoaded(function() {
  window.injectHeaderSaveButton();
});

// ------------------------------------------------------------------
// G. 起動時注入
// ------------------------------------------------------------------
(function initSaveButtonPatch() {
  function boot() { window.injectHeaderSaveButton(); }
  if (document.readyState !== 'loading') { setTimeout(boot, 300); }
  else { document.addEventListener('DOMContentLoaded', function() { setTimeout(boot, 300); }); }
})();

// ==========================================================================
// 🎴 第4回パッチ：ロード画面を単語テストに（タンゴン削除）
//    ＋ 理解度保存の確実化 ＋ 勉強時間の安定化 ＋ フレンド勉強時間「総計」化
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
// ==========================================================================

// ------------------------------------------------------------------
// 【0】パッチ専用スタイルの注入（1回だけ）
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【1】ロード画面の単語テスト（タンゴン削除）
// ------------------------------------------------------------------
window.__loadQuiz = window.__loadQuiz || { active:false, words:[], index:0, answers:[], ok:0, bad:0, so:0, bookId:null };







// ロード完了時：退避していた答えを単語帳へ反映して保存


// ------------------------------------------------------------------
// 【2】理解度保存の確実化（ローカル常時ベース＋Firebaseリトライ）
// ------------------------------------------------------------------


// ------------------------------------------------------------------
// 【3】勉強時間の安定化（二重起動防止・毎秒表示・継続保存・総計記録）
// ------------------------------------------------------------------
window.__studyTimerIntervalId = null;
// ログアウトしても勉強時間データは消さない
window.logoutToGate = async function() {
  if (window.__logoutInProgress) return;
  window.__logoutInProgress = true;
  try {
    if (typeof window.__saveFlush === 'function') {
      await Promise.race([
        window.__saveFlush(),
        new Promise(function(resolve) { setTimeout(resolve, 3000); })
      ]);
    }
    if(myId&&myId!=='GUEST-000'&&localStorage.getItem('core_v4_autosave_pending_'+myId)&&window.__backgroundSaveAll){
      await Promise.race([window.__backgroundSaveAll(),new Promise(resolve=>setTimeout(resolve,3000))]);
    }
  } catch (e) {
    console.error('ログアウト前の保存に失敗しました:', e);
  }
  try {
    var exactKeys = [
      'core_v4_userId', 'core_v4_userName', 'core_v4_userTarget', 'core_v4_userTitle',
      'core_v4_totalExp', 'core_v4_friend_list', 'core_v4_rewarded_titles_cache',
      'core_v4_active_char', 'core_v4_active_weapon', 'core_v4_active_armor',
      'core_v4_current_textbook_id'
    ];
    exactKeys.forEach(function(key) {
      try { localStorage.removeItem(key); } catch (e) { console.error('ログアウト情報を削除できませんでした:', key, e); }
    });
    var keysToRemove = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key) continue;
      if (key.indexOf('core_v4_study_') === 0) continue;
      if (key.indexOf('core_v4_user_stats_') === 0 || key.indexOf('core_v4_user_avatar_') === 0 ||
          key.indexOf('core_v4_user_vocab_progress_') === 0) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(function(key) {
      try { localStorage.removeItem(key); } catch (e) { console.error('ユーザー別情報を削除できませんでした:', key, e); }
    });
  } catch (e) {
    console.error('ログアウト情報の削除に失敗しました:', e);
  }
  location.reload();
};

// ------------------------------------------------------------------
// 【4】フレンド勉強時間を「全期間総計」に
// ------------------------------------------------------------------



// ==========================================================================
// 🎴 第5回パッチ：ロード画面クイズ改善
//    ① カードの「#31」などの番号表示を削除
//    ② 設定画面に「出題元の単語帳」選択を追加（答えは選んだ単語帳に保存）
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
// ==========================================================================

// ------------------------------------------------------------------
// 【0】パッチ専用スタイルの注入（1回だけ）
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【1】指定教材のマスター単語を取得（キャッシュ→ローカル→Firebase）
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【2】出題元単語帳ラベルの表示ヘルパー
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【3】クイズ初期化の上書き（出題元単語帳の選択に対応）
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【4】カード描画の上書き（番号表示を削除）
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【5】別教材の理解度へ答えを反映して保存
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【6】クイズ終了処理の上書き（選んだ単語帳へ保存）
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【7】非表示時に答えを確定する処理を確実に呼び出す
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【8】設定画面に「出題元の単語帳」セクションを注入
// ------------------------------------------------------------------


// ==========================================================================
// 🎴 第6回パッチ：ロード画面クイズ 完全修正版（自己完結）
//    ① 耳の増殖バグ根絶（1カード=1リスナー） ② スコアバー削除 ③ 番号削除
//    ④ 記録B（⚪︎△✕全部） ⑤ 出題元単語帳選択＋別教材へ正しく保存
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
// ==========================================================================

// ------------------------------------------------------------------
// 【0】スタイル補完（出題元ラベル。主要スタイルは既存パッチで定義済み）
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【1】共有状態
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【2】ローディング描画（スコアバー無し・クイズ枠＋ヒントのみ）
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【3】出題元ラベル
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【4】クイズ初期化（出題元選択込み・スコアバー参照なし）
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【5】スコア表示更新（表示要素が無いので無害なno-op）
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【6】カード描画（番号なし・現在の単語を共有状態へ）
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【7】スワイプ判定（★増殖防止：カード枠に1組だけ固定）
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【8】回答処理（記録B：⚪︎△✕全部を退避）
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【9】指定教材のマスター単語取得
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【10】別教材の理解度へ反映して保存
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【11】クイズ終了：退避した答えを選んだ単語帳へ反映
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【12】ロード終了時に答えを確定
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【13】設定画面：出題元の単語帳を選択
// ------------------------------------------------------------------


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

// ------------------------------------------------------------------
// 【2】理解度保存を上書き（パス安全化＋掃除＋リトライ）
// ------------------------------------------------------------------

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

// ------------------------------------------------------------------
// 【1】共有状態（今のカード／退避した答え／出題元）
// ------------------------------------------------------------------
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
  // The quiz uses the flashcard's card, side labels and ×△○ buttons.
  ov.innerHTML =
    sparks +
    '<div class="lq-area">' +
      '<div class="lq-progress" id="lqProgress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden>' +
        '<div class="lq-progress-head"><span id="lqProgressLabel"></span><strong id="lqProgressValue">0%</strong></div>' +
        '<div class="lq-progress-track"><span id="lqProgressFill"></span></div>' +
      '</div>' +
      '<div class="lq-quiz" id="lqQuiz" hidden>' +
        '<div class="lq-quiz-head"><span class="lq-book-label" id="lqBookLabel"></span><span class="lq-score" id="lqScore">回答 0</span></div>' +
        '<div class="lq-up"><i data-lucide="arrow-up" size="12"></i><span>上: あいまい</span></div>' +
        '<div class="lq-stage">' +
          '<div class="lq-side is-bad"><i data-lucide="x-circle" size="16"></i><span>覚えていない</span></div>' +
          '<div class="lq-card-wrap" id="lqCardWrap"></div>' +
          '<div class="lq-side is-ok"><i data-lucide="check-circle" size="16"></i><span>覚えた</span></div>' +
        '</div>' +
        '<div class="warmup-ratings lq-ratings"><button type="button" data-lq="bad" aria-label="覚えていない">×</button><button type="button" data-lq="so" aria-label="あいまい">△</button><button type="button" data-lq="ok" aria-label="覚えた">○</button></div>' +
        '<div class="lq-hint" id="lqHint">タップでめくる ／ スワイプかボタンで答える</div>' +
      '</div>' +
    '</div>' +
    '<div class="penguin-loading-text">🐧 ' + (message || '読み込み中') +
      '<span class="pg-dot">.</span><span class="pg-dot">.</span><span class="pg-dot">.</span></div>';
  document.body.appendChild(ov);
  window.__pgLoad.overlay = ov;
  ov.querySelectorAll('[data-lq]').forEach(function(button) {
    button.onclick = function() {
      var cur = window.__lqCurrent, wrap = ov.querySelector('#lqCardWrap'), status = button.dataset.lq;
      if (!cur || !wrap) return;
      window.__answerLoadQuiz(ov, wrap, cur.word, status, status === 'ok' ? 90 : status === 'bad' ? -90 : 0, status === 'so' ? -90 : 0);
    };
  });
  window.__applyLoadingProgress(ov);
  requestAnimationFrame(function(){ ov.classList.add('penguin-visible'); });
  window.__initLoadQuiz(ov);
  if (typeof window.initLucide === 'function') window.initLucide();
};

// How far a long task has come (the English analysis): percent 0-100 and a label; null hides it.
// Kept while the overlay is not shown yet, so an overlay that appears later starts at the right place.
window.setLoadingProgress = function(percent, label) {
  var st = window.__pgLoad;
  st.progress = percent === null || percent === undefined ? null : { percent: Math.max(0, Math.min(100, Math.round(percent))), label: label || (st.progress && st.progress.label) || '' };
  if (st.overlay) window.__applyLoadingProgress(st.overlay);
};
window.__applyLoadingProgress = function(ov) {
  var p = window.__pgLoad.progress, box = ov.querySelector('#lqProgress');
  if (!box) return;
  box.hidden = !p;
  ov.classList.toggle('has-progress', !!p);
  if (!p) return;
  box.setAttribute('aria-valuenow', String(p.percent));
  box.setAttribute('aria-valuetext', p.label + ' ' + p.percent + '%');
  ov.querySelector('#lqProgressLabel').textContent = p.label;
  ov.querySelector('#lqProgressValue').textContent = p.percent + '%';
  ov.querySelector('#lqProgressFill').style.width = p.percent + '%';
};

// ------------------------------------------------------------------
// 【3】出題元ラベル表示
// ------------------------------------------------------------------
window.__setLoadQuizBookLabel = function(ov, name, show) {
  var label = ov.querySelector('#lqBookLabel');
  if (label) label.textContent = show && name ? '📔 ' + name : '';
};

// ------------------------------------------------------------------
// 【4】クイズ初期化（出題元選択込み）
// ------------------------------------------------------------------
window.__initLoadQuiz = function(ov) {
  var q = window.__loadQuiz;
  q.owner=(typeof myId!=='undefined'&&myId)||'GUEST-000';
  q.answers = []; q.ok = 0; q.bad = 0; q.so = 0; q.index = 0; q.words = []; q.active = false; q.bookId = null;
  window.__lqCurrent = null;
  var quizEl = ov.querySelector('#lqQuiz');
  var wrapEl = ov.querySelector('#lqCardWrap');
  var hideAll = function() {
    q.active = false;
    if (quizEl) quizEl.hidden = true;
    window.__setLoadQuizBookLabel(ov, '', false);
  };
  var setup = function(words, bookId, name) {
    if(!ov.isConnected||window.__pgLoad.overlay!==ov)return;
    if (!words || words.length === 0) { hideAll(); return; }
    if(window.filterLoadingQuizWords)words=window.filterLoadingQuizWords(words,bookId);
    if(!words.length){hideAll();return;}
    q.words = words.slice().sort(function(){ return Math.random() - 0.5; }).slice(0, 20);
    q.active = true;
    q.bookId = bookId;
    if (quizEl) quizEl.hidden = false;
    if (wrapEl) window.__bindLoadQuizCardOnce(wrapEl);
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
// 【5】カード描画（単語カードと同じ面・同じ大きさ）
// ------------------------------------------------------------------
window.__renderLoadQuizCard = function(ov) {
  var q = window.__loadQuiz;
  if (!q.active || q.words.length === 0) return;
  if (q.index >= q.words.length) {
    q.words = q.words.sort(function(){ return Math.random() - 0.5; });
    q.index = 0;
  }
  var w = q.words[q.index];
  var first = w.meanings && w.meanings[0];
  var meaning = first ? first.text : (w.meaning || '');
  var wrap = ov.querySelector('#lqCardWrap');
  if (!wrap) return;
  wrap.className = 'lq-card-wrap';
  wrap.replaceChildren();
  var card = document.createElement('div');
  card.className = 'flashcard-wrapper-3d lq-flashcard';
  var style = '';
  try { if (typeof window.getFlashcardStyleByHistory === 'function') style = window.getFlashcardStyleByHistory({ num: w.num, en: w.word, meaningId: first && first.id, meaningIndex: 0, sourceWord: w }) || ''; } catch (e) {}
  window.fillFlashcardFaces(card, w.word, meaning, w.num, style);
  wrap.appendChild(card);
  var stage = ov.querySelector('.lq-stage');
  if (typeof window.sizeFlashcardFaces === 'function' && stage) {
    window.sizeFlashcardFaces(card, stage, null);
    var size = parseFloat(card.style.width) || 240;
    wrap.style.width = wrap.style.height = size + 'px';
  }
  var score = ov.querySelector('#lqScore');
  if (score) score.textContent = '回答 ' + q.answers.length + (q.answers.length ? '　○' + q.ok + ' △' + q.so + ' ×' + q.bad : '');
  window.__lqCurrent = { word: w, ov: ov };
};

// ------------------------------------------------------------------
// 【6】枠に“生涯1組だけ”リスナーを貼る（委譲方式）。タップでめくり、スワイプで答える。
//     現在の単語は window.__lqCurrent から参照する
// ------------------------------------------------------------------
window.__bindLoadQuizCardOnce = function(wrap) {
  if (!wrap || wrap.dataset.lqBound === '1') return;
  wrap.dataset.lqBound = '1';
  var pointer = null, moving = false;
  var cardOf = function() { return wrap.querySelector('.lq-flashcard'); };
  var glow = function(dx, dy) {
    wrap.classList.remove('glow-ok','glow-bad','glow-so');
    if (dy < -15 && Math.abs(dy) > Math.abs(dx)) wrap.classList.add('glow-so');
    else if (dx > 15) wrap.classList.add('glow-ok');
    else if (dx < -15) wrap.classList.add('glow-bad');
  };
  var settle = function(card) {
    wrap.classList.remove('glow-ok','glow-bad','glow-so');
    if (!card) return;
    card.classList.remove('is-dragging');
    if (moving) { card.classList.add('is-settling'); setTimeout(function(){ card.classList.remove('is-settling'); }, 260); }
    card.style.removeProperty('transform');
    moving = false;
  };
  wrap.addEventListener('pointerdown', function(e) {
    if (!window.__lqCurrent || !e.isPrimary) return;
    try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
    pointer = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    moving = false;
  });
  wrap.addEventListener('pointermove', function(e) {
    var card = cardOf();
    if (!pointer || !card) return;
    var dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
    if (!moving) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      moving = true;
      card.classList.remove('is-settling');
      card.classList.add('is-dragging');
    }
    card.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (dx * 0.06) + 'deg)';
    glow(dx, dy);
  });
  wrap.addEventListener('pointerup', function(e) {
    var card = cardOf(), cur = window.__lqCurrent;
    if (!pointer || !card || !cur) { pointer = null; return settle(card); }
    var dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
    var elapsed = Math.max(1, e.timeStamp - pointer.t);
    pointer = null;
    if (!moving) { card.classList.toggle('flipped'); return; }
    var direction = window.flashcardSwipeDirection ? window.flashcardSwipeDirection(dx, dy, dx / elapsed, dy / elapsed)
      : (dx > 60 ? 'right' : dx < -60 ? 'left' : dy < -60 ? 'up' : null);
    if (!direction) return settle(card);
    moving = false;
    window.__answerLoadQuiz(cur.ov, wrap, cur.word, direction === 'right' ? 'ok' : direction === 'left' ? 'bad' : 'so', dx, dy);
  });
  wrap.addEventListener('pointercancel', function() { pointer = null; settle(cardOf()); });
};

// ------------------------------------------------------------------
// 【7】回答処理（記録B：⚪︎△×全部を退避）
// ------------------------------------------------------------------
window.__answerLoadQuiz = function(ov, wrap, w, status, dx, dy) {
  var q = window.__loadQuiz;
  if (!window.__lqCurrent || window.__lqCurrent.word !== w) return;
  q.answers.push({ num: w.num, word: w.word, status: status });
  if (status === 'ok') q.ok++;
  else if (status === 'bad') q.bad++;
  else if (status === 'so') q.so++;
  window.__lqCurrent = null; // 二重反応を物理的に遮断
  if (window.AppSounds && window.AppSounds.play) window.AppSounds.play(status === 'ok' ? 'swipe-right' : status === 'bad' ? 'swipe-left' : 'navigate');
  wrap.classList.remove('glow-ok','glow-bad','glow-so');
  var card = wrap.querySelector('.lq-flashcard');
  if (card) {
    card.classList.remove('is-dragging', 'is-settling');
    card.style.animation = 'none';
    card.style.transition = 'transform .35s cubic-bezier(.1,.8,.25,1), opacity .35s ease';
    card.style.transform = 'translate(' + (dx * 2.2) + 'px,' + (dy * 2.2 - 40) + 'px) scale(.5) rotate(' + (dx * 0.08) + 'deg)';
    card.style.opacity = '0';
  }
  q.index++;
  setTimeout(function() {
    if (window.__pgLoad.overlay === ov) window.__renderLoadQuizCard(ov);
  }, 220);
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

// ------------------------------------------------------------------
// 【10】クイズ終了：退避した答えを選んだ単語帳へ反映（記録B）
// ------------------------------------------------------------------
window.__finalizeLoadQuiz = function() {
  var q = window.__loadQuiz;
  if (!q) return;
  if(q.owner&&q.owner!==((typeof myId!=='undefined'&&myId)||'GUEST-000')){q.answers=[];q.active=false;return;}
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
        // ロード画面を閉じる前に、回答を端末の正規理解度と手動セーブ用下書きへ確定する。
        if (typeof window.saveVocabProgressLocally === 'function') answers.forEach(function(answer){window.saveVocabProgressLocally(answer.num,true);});
        if (typeof window.markVocabProgressDirty === 'function') {
          answers.forEach(function(answer) { window.markVocabProgressDirty(bookId, answer.num); });
        }
        if (typeof window.__captureManualVocabDraft === 'function') window.__captureManualVocabDraft();
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
  if (window.__pgLoad && window.__pgLoad.count <= 0) window.__pgLoad.progress = null;
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


window.onAppLoaded(function() {
  window.injectLoadQuizSettings();
});

// ==========================================================================
// 🗜️ 第9回パッチ：Firestore index entry 上限エラー根絶
//    vocabProgress を JSON 文字列で保存（index entry 数を激減）
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
// ==========================================================================

// ------------------------------------------------------------------
// 【1】saveUserVocabProgress 上書き（wordsJson 形式で保存）
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【2】loadUserVocabProgress 上書き（新形式 wordsJson 優先、旧形式 words も対応）
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【3】__applyQuizAnswersToBook 上書き（ロードクイズの別教材保存も wordsJson に）
// ------------------------------------------------------------------
window.__applyQuizAnswersToBook = async function(bookId, answers) {
  var answerOwner=myId;
  var master = await window.__getBookMasterWords(bookId);
  if(myId!==answerOwner)return 0;
  if (!master || master.length === 0) return 0;
  var words = (typeof window.migrateVocabData === 'function') ? window.migrateVocabData(master.map(function(w) { return Object.assign({}, w); })) : master.map(function(w) { return Object.assign({}, w); });
  var progress = {};
  var pkey = (typeof window.getVocabProgressStorageKey === 'function') ? window.getVocabProgressStorageKey(bookId) : ('core_v4_user_vocab_progress_' + myId + '_' + bookId);
  try { progress = JSON.parse(localStorage.getItem(pkey)) || {}; } catch (e) {}
  // クイズ中に端末で更新された理解度を、古いクラウド値で上書きしない。
  // クラウドへの確定は右上の手動セーブで行う。
  var sig = (typeof window.buildWordSignature === 'function') ? window.buildWordSignature : function(w) { return String(w.num) + '::' + String(w.word || '').toLowerCase(); };
  words.forEach(function(w) {
    var key = String(w.num);
    var p = progress[key];
    w.note = p && typeof p.note === 'string' ? p.note : String(w.note || ''); w.sticky = !!(p && p.sticky);
    w.status = 'none';
    w.history = [];
    w.meanings = (w.meanings || []).map(function(m) { return { id: m.id, text: m.text, partOfSpeech: m.partOfSpeech || m.pos || '', status: 'none', history: [] }; });
    if (p && p.sig === sig(w)) {
      w.status = p.status || 'none';
      w.history = Array.isArray(p.history) ? p.history.slice(-20) : [];
      w.meanings = w.meanings.map(function(m) {
        var mp = p.meanings ? p.meanings[m.id] : null;
        if (mp) return { id: m.id, text: m.text, partOfSpeech: m.partOfSpeech || m.pos || '', status: mp.status || 'none', history: Array.isArray(mp.history) ? mp.history.slice(-20) : [] };
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
    var wp = { sig: sig(w), status: w.status || 'none', history: Array.isArray(w.history) ? w.history.slice(-20) : [], note: String(w.note || ''), sticky: !!w.sticky, meanings: {} };
    (w.meanings || []).forEach(function(m) { wp.meanings[m.id] = { status: m.status || 'none', history: Array.isArray(m.history) ? m.history.slice(-20) : [] }; });
    newProgress[key] = wp;
  });
  if(window.LearningData){
    var answered=newProgress;newProgress=window.LearningData.read(bookId);
    answers.forEach(function(answer){if(answered[String(answer.num)]&&words.some(w=>String(w.num)===String(answer.num)&&String(w.word)===String(answer.word)))newProgress=window.LearningData.commit(bookId,answered,answer.num,true);});
  }
  try { localStorage.setItem(pkey, JSON.stringify(newProgress)); } catch (e) {}
  try { localStorage.setItem(pkey + '__ts', String(Date.now())); } catch (e) {}
  if (typeof window.markVocabProgressDirty === 'function') {
    answers.forEach(function(answer) { window.markVocabProgressDirty(bookId, answer.num); });
  }
  window.__manualVocabDrafts = window.__manualVocabDrafts || {};
  window.__manualVocabDrafts[bookId] = {
    master: typeof window.stripVocabProgressFromWords === 'function' ? window.stripVocabProgressFromWords(words) : words,
    progress: newProgress
  };
  return applied;
};

// ==========================================================================
// 📚 本棚タブパッチ：スワイプ切替（解析 ⇔ 本棚）＋ 教材本棚システム
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
//    ※index.html / style.css の編集は不要です（DOMを自動で組み替えます）
// ==========================================================================

// ------------------------------------------------------------------
// 【0】パッチ専用スタイルの注入（タブボタン＋スライドアニメーション）
// ------------------------------------------------------------------

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


// ------------------------------------------------------------------
// 【2】管理者画面：本棚教材の管理配信パネル（自動注入）
// ------------------------------------------------------------------






// ------------------------------------------------------------------
// 【3】保存ポップアップ上書き（フォルダ選択 → 教材選択）
// ------------------------------------------------------------------
// 【4】本棚の描画は reader-shelf.js（単語帳一覧と同じ並び）
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
  if (bc) shelfCard = bc.closest('.card, .reader-shelf');
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
window.onAppLoaded(function() {
  try {
    window.initReaderSubTabStructure();
    window.injectShelfAdminPanel();
    window.updateAdminEditShelfSelectOptions();
    window.renderBookshelf();
    // 本棚のクラウド索引は初期画面を止めず、一度だけバックグラウンド更新する。
    if (!window.__bookshelfIndexSyncPromise) {
      window.__bookshelfIndexSyncPromise = Promise.resolve(window.syncBookshelfIndexFromFirestore()).then(function() {
        window.updateAdminEditShelfSelectOptions();
        window.renderBookshelf();
      }).catch(function(e) {
        console.warn('本棚のバックグラウンド同期に失敗しました:', e);
      });
    }
  } catch (e) {
    console.error("本棚タブパッチ初期化エラー:", e);
  }
});

// ------------------------------------------------------------------
// 【8】起動時注入
// ------------------------------------------------------------------
(function initShelfTabPatch() {
  function boot() {
    window.initReaderSubTabStructure();
    window.injectShelfAdminPanel();
    window.updateAdminEditShelfSelectOptions();
    window.renderBookshelf();
  }
  if (document.readyState !== 'loading') {
    setTimeout(boot, 400);
  } else {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(boot, 400); });
  }
})();
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
    'test_count', 'combo_max', 'high_score', 'mistake_count',
    'vocab_reg', 'vocab_fixed', 'delete_count', 'reader_open',
    'flash_count', 'friends_count', 'user_level', 'gold_spent'
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
                if(window.StudyTimeModel)data.userStats=window.StudyTimeModel.readStats(data);
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


// ------------------------------------------------------------------
// 【D】loadUserVocabProgress 上書き：タイムスタンプで「最新」を採用
//     （古いクラウドによる理解度の巻き戻りを防止＋クラウドへ書き戻し）
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 【E】saveUserVocabProgress 上書き：タイムスタンプ付きで保存
// ------------------------------------------------------------------

// ==========================================================================
// 🔄 同期修正パッチ③：設定まるごと同期 ＋ 表示強化
//    【個人ごと同期】APIキー／ロード時単語帳／選択中教材／
//                    称号解除進捗（XP二重付与根絶）／リーダー単語メモリ
//    【全員で共有】  ダッシュボードタイトル／配信アナウンス
//    【表示強化】    フレンドログイン履歴を分単位まで／自分の総勉強時間
//    【保護】        totalExp・総勉強時間の巻き戻り防止／理解度リセット防止
//    ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
// ==========================================================================

// ------------------------------------------------------------------
// 【A】全員共有設定（ダッシュボードタイトル／配信アナウンス）
// ------------------------------------------------------------------
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
        // The Gemini API key stays on this device; it is not uploaded with the cloud save.
        geminiKey: "",
        loadQuizBook: localStorage.getItem('core_v4_loadquiz_book') || "auto",
        currentTextbook: localStorage.getItem('core_v4_current_textbook_id') || "",
        wordMemory: wm,
        titlesCache: tc
    };
};

window.__mergeSettings = function(local, cloud, localIsNewer) {
    var merged = {};
    var scalarKeys = ['geminiKey', 'loadQuizBook', 'currentTextbook'];
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
        // Older cloud saves carried the key; a save without one never clears the key on this device.
        if (typeof s.geminiKey === "string" && s.geminiKey) {
            localStorage.setItem('core_v4_geminiKey', s.geminiKey);
            geminiApiKey = s.geminiKey;
            var aki = document.getElementById('sidebarApiKeyInput');
            if (aki) aki.value = s.geminiKey;
        }
        if (typeof s.loadQuizBook === "string") localStorage.setItem('core_v4_loadquiz_book', s.loadQuizBook || "auto");



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
    window.__settingsSyncLoopStarted = true;
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
        if (!window.StudyTime && localStudyBefore > (userStats.study_total_secs || 0)) { userStats.study_total_secs = localStudyBefore; needWriteBack = true; }
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
    if(window.LearningData&&!window.LearningData.canSave(bookKey))throw new Error("読み込み中のため保存を保留しました");
    window.saveVocabProgressLocally(null, true);
    currentUserVocabProgress = JSON.parse(localStorage.getItem(window.getVocabProgressStorageKey(bookKey)) || "{}");
    var nowMs = Number(localStorage.getItem(window.getVocabProgressStorageKey(bookKey) + "__ts")) || Date.now();
    var nowIso = new Date(nowMs).toISOString();
    try {
        localStorage.setItem(window.getVocabProgressStorageKey(bookKey), JSON.stringify(currentUserVocabProgress));
        localStorage.setItem(window.getVocabProgressStorageKey(bookKey) + "__ts", String(nowMs));
    } catch (e) {}
    if (window.AppStorage) await window.AppStorage.flush();
    // Rating events persist locally immediately; one background backup owns cloud sync.
    if(window.__dirtyVocabProgress?.[bookKey]||window.__dirtyManualVocabDrafts?.[bookKey])window.queueBackgroundSave?.();
    userStats.vocab_fixed = vocabList.filter(function(w) {
        return w.meanings && w.meanings.some(function(m) { return m.status === "ok"; });
    }).length;
};

window.loadUserVocabProgress = async function(bookKey) {
    bookKey = bookKey || (typeof currentTextbook !== "undefined" ? currentTextbook : "default");
    if (typeof myId === "undefined" || !myId) return;
    var requestUserId = myId;
    var progressKey = window.getVocabProgressStorageKey(bookKey);
    window.__vocabProgressRevisionByBook = window.__vocabProgressRevisionByBook || {};
    var requestRevision = window.__vocabProgressRevisionByBook[bookKey] || 0;
    var localProgress = {};
    var localTs = 0;
    try {
        var raw = localStorage.getItem(window.getVocabProgressStorageKey(bookKey));
        if (raw) localProgress = JSON.parse(raw) || {};
        localTs = parseInt(localStorage.getItem(window.getVocabProgressStorageKey(bookKey) + "__ts") || "0");
    } catch (e) {}
    if(window.LearningData)localProgress=window.LearningData.read(bookKey);
    if ((currentTextbook || "default") === bookKey) currentUserVocabProgress = localProgress;
    if (myId === "GUEST-000" || !window.db || !window.fbGetDoc || !window.fbDoc) return;
    window.__vocabProgressCloudChecks=window.__vocabProgressCloudChecks||{};
    var checkKey=requestUserId+'\n'+bookKey;
    if(Object.hasOwn(window.__vocabProgressCloudChecks,checkKey)&&Date.now()-window.__vocabProgressCloudChecks[checkKey]<300000)return;
    if(window.FirestoreReadGuard?.paused?.())return;
    try {
        var ref = window.fbDoc(window.db, "users", myId, "vocabProgress", bookKey);
        var snap = await window.fbGetDoc(ref);
        // ログアウト・別ユーザーへのログイン後に旧ユーザーの応答を保存しない。
        if (myId !== requestUserId || (window.LibraryState&&window.LibraryState.isDeleted('book',bookKey,requestUserId))) return;
        window.__vocabProgressCloudChecks[checkKey]=Date.now();
        // 通信待ちの間に理解度が変更された可能性があるため、必ず最新の端末値を再取得する。
        var latestLocalProgress = localProgress;
        var latestLocalTs = localTs;
        try {
            var latestRaw = localStorage.getItem(progressKey);
            if (latestRaw) latestLocalProgress = JSON.parse(latestRaw) || {};
            latestLocalTs = parseInt(localStorage.getItem(progressKey + "__ts") || "0");
        } catch (e) {}
        var changedWhileLoading = (window.__vocabProgressRevisionByBook[bookKey] || 0) !== requestRevision;
        if (snap.exists() && snap.data()) {
            var data = snap.data();
            var cloudProgress = null;
            if (data.wordsJson) { try { cloudProgress = JSON.parse(data.wordsJson); } catch (e) { cloudProgress = null; } }
            else if (data.words) cloudProgress = data.words;
            var cloudTs = data.updatedAt ? (new Date(data.updatedAt).getTime() || 0) : 0;
            if (cloudProgress && typeof cloudProgress === "object") {
                if (!changedWhileLoading && (cloudTs > latestLocalTs || (window.LearningData&&!window.LearningData.hasAnswers(latestLocalProgress)))) {
                    if(window.LearningData)cloudProgress=window.LearningData.restore(bookKey,cloudProgress);
                    // クラウドが新しい → 採用
                    if ((currentTextbook || "default") === bookKey) currentUserVocabProgress = Object.assign({}, latestLocalProgress, cloudProgress);
                    try {
                        localStorage.setItem(window.getVocabProgressStorageKey(bookKey), JSON.stringify(Object.assign({}, latestLocalProgress, cloudProgress)));
                        localStorage.setItem(window.getVocabProgressStorageKey(bookKey) + "__ts", String(cloudTs));
                    } catch (e) {}
                } else {
                    // ローカルが新しい → 維持してクラウドへ書き戻し
                    if ((currentTextbook || "default") === bookKey) currentUserVocabProgress = latestLocalProgress;
                    // Reading must not promote stale snapshots into newer cloud writes.

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

// ------------------------------------------------------------------
// 【H】loadLocalState につなげて全体を起動
// ------------------------------------------------------------------
window.onAppLoaded(async function() {
    try {
        await window.__loadUserSettings();
        window.__startSettingsSyncLoop();
    } catch (e) {
        console.error("sync3 loadLocalState error:", e);
    }
});

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
// ==========================================================================
// Flashcard text sizing is maintained in game_core.js.
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


// ------------------------------------------------------------------
// 【1】ガイドの中身データ（クイックスタート／機能別／Tips）
// ------------------------------------------------------------------


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
// ==========================================================================
// 📊 第5回パッチ：勉強時間グラフ安定化 ＋ 日付跨ぎ修正
// ※このファイルの末尾にそのまま貼り付けてください（既存コードは変更不要）
// ==========================================================================

// ------------------------------------------------------------------
// A. 時間表示の更新を分離（毎秒呼んでも軽量なテキスト更新のみ）
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// B. グラフ描画の完全上書き
//    ・整数分に切り捨て（小数チラつき防止）
//    ・既存DOMがある場合は値だけ更新（全消去→再構築しない）
// ------------------------------------------------------------------
// ------------------------------------------------------------------
// C. タイマー＆日付ローテーションの完全上書き
//    ・setInterval 内に毎秒の日付チェックを追加（0時跨ぎ対応）
//    ・グラフ更新は10秒に1回に間引き
//    ・二重起動防止ガード付き
// ------------------------------------------------------------------

// ==========================================================================
// ✏️ 第6回パッチ：勉強時間の手動編集（今日 ＋ 過去7日分）
//    ・グラフのバーをクリック → その日の時間を編集するモーダルが開く
//    ・今日 → todayStudySeconds を書き換え（以降もタイマーが加算を継続）
//    ・過去 → weeklyStudyMinutesLog を書き換え
//    ※必ず第5回パッチより後に貼り付けてください
// ==========================================================================

// ---------- 1. エディタのDOM／CSSを1回だけ注入 ----------

// ---------- 2. エディタの状態と操作 ----------




// ---------- 3. モーダルを開く（dayIdx: 0=月 〜 6=日） ----------


// ---------- 4. 保存 ----------

// ---------- 5. トースト ----------

// ==========================================================================
// 📅 第7回パッチ：グラフの右端を常に最新（今日）にするローリング表示
//    ・左端 = 6日前 … 右端 = 今日（日付が変わると自動で並び替え）
//    ・各バー下に「曜日 + 日付」ラベルを表示、今日は「今日」と強調
//    ※第6回パッチ（編集機能）より後に貼り付けてください
// ==========================================================================

// ---------- 0. ローリング表示用の追加スタイル ----------

// ---------- 2. 保存後のパルスを正しいバーに出す（第6回パッチ補正） ----------

// ==========================================================================
// 🔒 第8回パッチ：高さの正規化 ＋ 注釈削除 ＋ 編集を管理者限定に
//    ・バー高さを「7日中の最大値=100%」の比率スケールに変更（値と一致）
//    ・グラフ下のヒント注釈を撤去
//    ・バーのタップ編集を管理者ツール開放時のみ許可（単語帳編集と同じ方式）
//    ※必ず 第5→6→7回 の後に貼り付けてください
// ==========================================================================

// ---------- 0. バーの見た目（不透明グラデ＋発光＋遷移） ----------

// ---------- 1. 管理者判定（単語帳編集と同じ権限を参照） ----------


// 権限状態が変わったらグラフの見た目（カーソル等）を即時同期
 // グローバル変数の変化はポーリングで拾う

// ---------- 2. renderActivityChart 差し替え（比率スケール＋注釈なし） ----------

// ---------- 3. 編集モーダルを管理者ガードでラップ ----------

// ---------- 4. 初期反映 ----------

// ==========================================================================
// ✍️ 第9回パッチ：コントラスト改善 ＋ 1分単位の直接入力
//    ・「総勉強時間」ラベルとグラフ下の日付／曜日を背景透過に負けない濃さへ
//    ・編集モーダルに number 入力欄を追加（1分単位・0〜23:59 クランプ）
//    ・入力中はリアルタイムで「○時間○分」プレビューが追従
//    ※必ず 第5→6→7→8回 の後に貼り付けてください
// ==========================================================================

// ---------- 0. スタイル：コントラスト ＋ 直接入力欄のデザイン ----------

// ---------- 1. 総勉強時間ラベルのコントラスト修正 ----------

// ---------- 2. 編集モーダルへ直接入力欄を注入 ----------

// __injectStudyTimeEditor をラップして、DOM生成後に必ず入力欄を差し込む

// ---------- 3. プレビュー更新 ----------

// ---------- 4. __steRenderValues をラップ（input／preview 同期） ----------

// ---------- 5. モーダルを開いた直後にも入力欄の存在を保証 ----------

// ---------- 6. 初期反映 ----------

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

   // 今日の秒数の上限（24h）
        // 1日の分数上限

// ---------- 1. クランプ補助 ----------

// ---------- 2. データ浄化（変化があれば保存＋報告） ----------

// 起動時に即浄化

// ---------- 4. __steSave ラップ：保存時に today と log今日slot を同時書き ----------

// ---------- 5. 日付跨ぎ時の浄化（initStudyTimer 内 setInterval を補強） ----------
// 既存の日付跨ぎ処理の“後”に浄化を挟むため、renderActivityChart 経由で既に是正される。
// さらに安全網として、定期的にも浄化（重い処理は変化時のみ保存）。

// ---------- 6. 管理者用リセットUIをモーダルに注入 ----------

// 管理者判定に応じてパネル表示/非表示を同期

// inject / open をラップして注入＋同期

// ---------- 7. リセット系コマンド ----------



// 最終手段：ローカルの勉強時間データを根こそぎ消して再読込

// ---------- 8. 初期反映 ----------

// ==========================================================================
// Study time now uses explicit account keys in study-time.js.
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
    }, 1000);
})();
// ==========================================================================
//  app.js 末尾パッチ：データリセット後の“復活”を根治（理解度は残す）
//    症状：管理者リセット後も各端末のローカル旧値が残り、ログイン時の
//          「大きい方を採用＋クラウドへ書き戻し」で0が旧値に巻き戻っていた。
//    根治：読み込みの“先頭”でリセット世代を比較し、世代より古いローカル派生を
//          先に0へ落としてから本来の読み込みへ進む＝0 vs 0 で復活不能。
//    保持：理解度(core_v4_user_vocab_progress_*)・wordMemory・単語/長文/本棚/
//          フレンド/目標 は一切触らない（＝理解度は残る）。
//    ※ fix.js / save-system.js / style.css / index.html は不変更
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
test_count: 0, combo_max: 0, high_score: 0, mistake_count: 0,
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

window.onBeforeAppLoad(async function () {
try {
var id = (typeof myId !== 'undefined' && myId && myId !== 'GUEST-000') ? myId : localStorage.getItem('core_v4_userId');
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
});
})();

// Keep one verifier for the existing administrator password and PIN recovery.
// The admin password is checked against its SHA-256 digest, so the page source no longer shows it.
// (It is still checked on this device; changing the password means replacing these digests.)
window.__sha256Hex = function(text) {
  const bytes = new TextEncoder().encode(String(text)), K = [], H = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
  for (let n = 2, found = 0; found < 64; n++) {
    let prime = true;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) { prime = false; break; }
    if (prime) K[found++] = (Math.pow(n, 1 / 3) % 1) * 4294967296 | 0;
  }
  const length = bytes.length, padded = new Uint8Array(((length + 9 + 63) >> 6) << 6);
  padded.set(bytes); padded[length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, length * 8);
  view.setUint32(padded.length - 8, Math.floor(length / 536870912));
  const w = new Int32Array(64), rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getInt32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0,
        t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
};
window.verifyAdminPassword = value => [
  "3e43d648d8d03a05389ee2375d99d8026aba3d63178992cf2312ce8aa7525feb",
  "c1fe08f08e728acf949cf8eb6f073a557964c9d7580585642b013bc89a689c3c",
].includes(window.__sha256Hex("aiglish-admin:" + String(value || "")));
