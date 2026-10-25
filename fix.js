(function () {
    "use strict";
    // ★app.js 第13回パッチの独自カウントを停止（fix.js の同期を単一ソースにする＝二重加算防止）
    //   defer 順序: app.js IIFE → fix.js IIFE → DOMContentLoaded なので、
    //   第13回が loadLocalState 経由で走る頃には既に true。
    window.__communityStudyTimeSyncStarted = true;
    
    var F_BODY = "'Noto Sans JP',system-ui,-apple-system,'Hiragino Sans','Segoe UI',sans-serif";
    var F_MONO = "ui-monospace,'SF Mono','JetBrains Mono','Cascadia Code',monospace";
    var F_DISPLAY = "'Noto Sans JP',system-ui,sans-serif";
    
    // ---- 規定値 ----
    // ---- 派生データ（消す）／保持（残す）の定義 ----
    var DERIVED_COUNTERS = ['test_count','combo_max','high_score','mistake_count','vocab_reg','vocab_fixed','delete_count','study_burst','reader_open','flash_count','user_level','gold_spent','study_total_secs','study_today_secs','study_week_secs'];
    
    window.__admTarget = window.__admTarget || { mode: 'self', uid: null, snap: null };
    function T() { return window.__admTarget; }
    function isOther() { var t = T(); return !!(t && t.mode === 'other'); }
    function __snap() { var t = T(); if (!t.snap) t.snap = {}; return t.snap; }
    function B() { return window.__bridge || null; }
    function gv(key, fb) { if (isOther()) { var s = __snap(); var v = s[key]; return v == null ? fb : v; } var b = B(); var w = b ? b[key] : window[key]; return w == null ? fb : w; }
    function sv(key, val) { if (isOther()) { __snap()[key] = val; return; } var o = {}; o[key] = val; window.__bridgeWrite = Object.assign(window.__bridgeWrite || {}, o); window[key] = val; }
    function gExp() { return gv('totalExp', 0) || 0; }
    function gTitle() { return gv('selectedTitle', ''); }
    function gTarget() { return gv('myTarget', ''); }
    function gFriends() { return gv('myFriendList', []); }
    function gStats() { var s = gv('userStats', {}); return (s && typeof s === 'object') ? s : {}; }
    function gSecs() { return clampSec(gv('todayStudySeconds', 0)); }
    function gWeek() { return cleanWeek(gv('weeklyStudyMinutesLog', [0,0,0,0,0,0,0])); }
    function sExp(v){sv('totalExp',v);} function sTitle(v){sv('selectedTitle',v);} function sTarget(v){sv('myTarget',v);} function sFriends(v){sv('myFriendList',v);}
    function sStats(v){ sv('userStats', (v && typeof v === 'object') ? v : {}); }
    function sSecs(v){sv('todayStudySeconds',clampSec(v));} function sWeek(v){sv('weeklyStudyMinutesLog',cleanWeek(v));}
    function selfMyId() { var b = B(); return b ? b.myId : window.myId; }
    function selfG(k) { var b = B(); return b ? b[k] : window[k]; }
    function selfS(k, v) { var o = {}; o[k] = v; window.__bridgeWrite = Object.assign(window.__bridgeWrite || {}, o); window[k] = v; }
    function myId() { var id = isOther() ? (T().uid || null) : gMyIdSelf(); return (id && id !== 'GUEST-000') ? id : null; }
    function gMyIdSelf() { var b = B(); return b ? b.myId : window.myId; }
    function box(name) { var id = myId(); return id ? (name + 'for' + id) : null; }
    function get(name) { var b = box(name); if (!b) return null; try { return localStorage.getItem(b); } catch (e) { return null; } }
    function set(name, v) { var b = box(name); if (!b) return; try { localStorage.setItem(b, v); } catch (e) {} }
    function clampSec(x){var n=Math.floor(Number(x));if(!isFinite(n)||n<0)return 0;return n>86400?86400:n;}
    function clampMin(x){var n=Math.floor(Number(x));if(!isFinite(n)||n<0)return 0;return n>1440?1440:n;}
    function clampInt(x){var n=Math.floor(Number(x));if(!isFinite(n)||n<0)return 0;return n;}
    function cleanWeek(w){var a=Array.isArray(w)?w:[],o=[];for(var i=0;i<7;i++)o[i]=clampMin(a[i]);return o;}
    function todayStr(){var d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
    function dayIdxOf(s){var d=new Date(s),i=d.getDay()-1;return i<0?6:i;}
    function weekKeyOf(){var d=new Date();var day=d.getDay();var diff=(day===0?-6:1-day);var m=new Date(d.getFullYear(),d.getMonth(),d.getDate()+diff);return m.getFullYear()+'-'+(m.getMonth()+1)+'-'+m.getDate();}
    function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
    
    // ---- レベル計算：本体 calculateLevelFromExp を直接使用 ----
    
    // ---- 称号DB参照 ----
    
    // ---- 延伸ロジック（レジェンダリー超え：必要量は2の累乗、XPはレジェンダリー同額＝共通テーブル） ----
    
    // ---- 称号設定（shared/title_config） ----
    function netReadShared(docId) { if (!window.db || !window.fbGetDoc || !window.fbDoc) return Promise.resolve(null); return window.fbGetDoc(window.fbDoc(window.db, 'shared', docId)).then(function (s) { return s && s.exists() ? s.data() : null; }).catch(function () { return null; }); }
    function netWriteShared(docId, payload) { if (!window.db || !window.fbSetDoc || !window.fbDoc) return Promise.resolve(); return window.fbSetDoc(window.fbDoc(window.db, 'shared', docId), payload, { merge: true }).catch(function () {}); }
    
    // ---- Firebase users 読み書き ----
    function netReadOf(uid) { if (!uid || !window.db || !window.fbGetDoc || !window.fbDoc) return Promise.resolve(null); return window.fbGetDoc(window.fbDoc(window.db, 'users/' + uid)).then(function (s) { return s && s.exists() ? s.data() : null; }).catch(function () { return null; }); }
    function fbWriteOf(uid, payload) { if (!uid || !window.db || !window.fbSetDoc || !window.fbDoc) return Promise.resolve(); return window.fbSetDoc(window.fbDoc(window.db, 'users/' + uid), payload, { merge: true }); }
    function pickNet(net, keys) { if (!net) return undefined; for (var i = 0; i < keys.length; i++) { var k = keys[i]; if (net[k] !== undefined && net[k] !== null) return net[k]; } return undefined; }
    function parseMaybeJSON(x) { if (x == null) return undefined; if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }
    var K = {
    name: ['name','userName','user_name','displayName','nickName','nickname'],
    exp: ['totalExp','exp','total_exp','experience','xp','totalXp','totalXP','userExp'],
    title: ['title','userTitle','selectedTitle','badge','userBadge','user_title'],
    target: ['target','userTarget','goal','userGoal','user_target'],
    friends: ['friends','friendList','myFriendList','friend_list','userFriends'],
    stats: ['stats','userStats','user_stats','statistics'],
    secs: ['todayStudySeconds','study_today_secs','studySecs','todaySecs','study_secs'],
    week: ['weeklyStudyMinutesLog','study_weekly_log','weeklyLog','weekLog','study_week'],
    date: ['lastAccessDateStr','study_last_date','lastDate','study_date'],
    word: ['wordMemory','word_memory'], text: ['textHistory','text_history'],
    book: ['myBookshelf','bookshelf','my_bookshelf'], fold: ['myFolders','folders','my_folders']
    };
    function mapNetToSnap(net, uid) {
    var fr = parseMaybeJSON(pickNet(net, K.friends)); var st = pickNet(net, K.stats);
    var wk = parseMaybeJSON(pickNet(net, K.week)); var wo = parseMaybeJSON(pickNet(net, K.word));
    var tx = parseMaybeJSON(pickNet(net, K.text)); var bk = parseMaybeJSON(pickNet(net, K.book)); var fd = parseMaybeJSON(pickNet(net, K.fold));
    return { myId: uid, myName: pickNet(net, K.name),
    totalExp: (function(){ var e = pickNet(net, K.exp); var n = parseInt(e, 10); return isFinite(n) ? n : e; })(),
    selectedTitle: pickNet(net, K.title), myTarget: pickNet(net, K.target),
    myFriendList: Array.isArray(fr) ? fr : (fr || []), userStats: (st && typeof st === 'object') ? st : {},
    todayStudySeconds: pickNet(net, K.secs), weeklyStudyMinutesLog: Array.isArray(wk) ? wk : null,
    lastAccessDateStr: pickNet(net, K.date),
    wordMemory: (wo && typeof wo === 'object') ? wo : {}, textHistory: Array.isArray(tx) ? tx : [],
    myBookshelf: Array.isArray(bk) ? bk : [], myFolders: Array.isArray(fd) ? fd : null };
    }
    function snapToPayload(snap, extra) {
    return Object.assign({
    name: snap.myName, userName: snap.myName, totalExp: snap.totalExp, exp: snap.totalExp,
    title: snap.selectedTitle, userTitle: snap.selectedTitle, selectedTitle: snap.selectedTitle,
    target: snap.myTarget, userTarget: snap.myTarget,
    friends: snap.myFriendList, friendList: snap.myFriendList, myFriendList: snap.myFriendList,
    stats: snap.userStats, userStats: snap.userStats,
    todayStudySeconds: snap.todayStudySeconds, weeklyStudyMinutesLog: snap.weeklyStudyMinutesLog,
    lastAccessDateStr: snap.lastAccessDateStr, wordMemory: snap.wordMemory, textHistory: snap.textHistory,
    myBookshelf: snap.myBookshelf, myFolders: snap.myFolders, updatedAt: Date.now()
    }, extra || {});
    }
    function mergeStats(local, cloud) {
    var m = {}; var keys = {};
    Object.keys(local || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(cloud || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) {
    var lv = local ? local[k] : undefined, cv = cloud ? cloud[k] : undefined;
    if (typeof lv === 'number' && typeof cv === 'number' && isFinite(lv) && isFinite(cv)) m[k] = Math.max(lv, cv);
    else if (Array.isArray(lv) && Array.isArray(cv)) { var u = cv.slice(); lv.forEach(function (x) { if (u.indexOf(x) < 0) u.push(x); }); m[k] = u; }
    else m[k] = (cv !== undefined ? cv : lv);
    });
    return m;
    }
    
    // =====================================================================
    // 全ユーザー一括消去：派生データだけ0／保持項目は触らない／世代トークンで復活根絶
    // =====================================================================
    function resetDerivedStats(stats) {
    var keepGoal = (stats && stats.goal_text) ? stats.goal_text : '';
    var keepFc = (stats && typeof stats.friends_count === 'number') ? stats.friends_count : 0;
    return {
    test_count: 0, combo_max: 0, high_score: 0, mistake_count: 0,
    vocab_reg: 0, vocab_fixed: 0, delete_count: 0, study_burst: 0, reader_open: 0,
    flash_count: 0, user_level: 1, gold_spent: 0,
    goal_text: keepGoal, friends_count: keepFc, weekly_rank_first: false,
    seasonTitles: [], settledSeasons: [],
    study_total_secs: 0, study_today_secs: 0, study_week_secs: 0,
    study_today_date: todayStr(), study_week_key: weekKeyOf()
    };
    }
    function wipeLocalDerived() {
    try { totalExp = 0; } catch (e) {}
    try { selectedTitle = '称号なし'; } catch (e) {}
    try { userStats = resetDerivedStats(userStats || {}); } catch (e) {}
    try { todayStudySeconds = 0; } catch (e) {}
    try { weeklyStudyMinutesLog = [0,0,0,0,0,0,0]; } catch (e) {}
    try { rewardedTitlesStepsCache = {}; } catch (e) {}
    try {
    localStorage.setItem('core_v4_totalExp', '0');
    localStorage.setItem('core_v4_userTitle', '称号なし');
    localStorage.setItem('core_v4_rewarded_titles_cache', '{}');
    localStorage.setItem('core_v4_study_today_secs', '0');
    localStorage.setItem('core_v4_study_weekly_log', '[0,0,0,0,0,0,0]');
    localStorage.setItem('core_v4_study_last_date', todayStr());
    localStorage.setItem('core_v4_study_total_secs', '0');
    localStorage.setItem('core_v4_user_stats_' + gMyIdSelf(), JSON.stringify(userStats));
    } catch (e) {}
    try {
    var rm = [];
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (!k) continue; if (k.indexOf('cosmic_score_') === 0 || k.indexOf('cosmic_best_') === 0 || k.indexOf('season_best_') === 0) rm.push(k); }
    rm.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    } catch (e) {}
    }
    function checkResetGeneration() {
    var me = gMyIdSelf(); if (!me || me === 'GUEST-000') return Promise.resolve();
    return netReadShared('app_settings').then(function (cfg) {
    var gen = (cfg && cfg.resetGeneration) ? parseInt(cfg.resetGeneration) || 0 : 0;
    if (gen <= 0) return;
    var local = 0; try { local = parseInt(localStorage.getItem('__ste_reset_gen_' + me)) || 0; } catch (e) {}
    if (gen > local) {
    wipeLocalDerived();
    try { localStorage.setItem('__ste_reset_gen_' + me, String(gen)); } catch (e) {}
    try { if (window.saveUserStats) window.saveUserStats(); } catch (e) {}
    try { if (window.applyProfileToUi) window.applyProfileToUi(); } catch (e) {}
    try { if (window.renderTitles) window.renderTitles(); } catch (e) {}
    try { if (window.renderLeaderboard) window.renderLeaderboard(); } catch (e) {}
    refreshDisplay();
    toast(' データが管理者によりリセットされました');
    }
    }).catch(function () {});
    }
    
    // ---- 通常読み書き ----
    var __studyLoadedForId = null;
    function loadMyData() {
    var id = selfMyId(); if (!id || id === 'GUEST-000') return Promise.resolve();
    var accountChanged = (__studyLoadedForId !== id);
    var bName = get('name'), bExp = get('exp'), bTitle = get('title'), bTarget = get('target'), bFriends = get('friends');
    var bSecs = get('study_secs'), bDate = get('study_date'), bWeek = get('study_week');
    var bWord = get('wordMemory'), bText = get('textHistory'), bBook = get('myBookshelf'), bFold = get('myFolders');
    return netReadOf(id).then(function (net) {
    if(selfMyId()!==id)return;
    if(window.StudyTime&&window.StudyTimeModel&&net){var ledger=window.StudyTimeModel.readStats(net).study_calendar_v2;if(ledger)window.StudyTime.mergeCloud(ledger);}
    function P(nkeys, bval, parser) { var nv = pickNet(net, nkeys); if (nv !== undefined && nv !== null) return parser ? parser(nv) : nv; if (bval !== null && bval !== undefined) return parser ? parser(bval) : bval; return undefined; }
    var nm = P(K.name, bName); if (nm !== undefined) selfS('myName', nm || 'プレイヤー1');
    var ex = P(K.exp, bExp, function (x) { return parseInt(x, 10) || 0; }); if (ex !== undefined) selfS('totalExp', ex);
    var ti = P(K.title, bTitle); if (ti !== undefined) selfS('selectedTitle', ti || '称号なし');
    var tg = P(K.target, bTarget); if (tg !== undefined) selfS('myTarget', tg || '未設定');
    var fr = P(K.friends, bFriends, function (x) { var p = parseMaybeJSON(x); return Array.isArray(p) ? p : []; }); if (fr !== undefined) selfS('myFriendList', fr || []);
    var st = P(K.stats, null);
    if (!isOther()) { var cur = selfG('userStats') || {}; st = mergeStats(cur, (st && typeof st === 'object') ? st : {}); }
    if (!window.StudyTime && st !== undefined && typeof st === 'object') selfS('userStats', st || {});
    var sc = P(K.secs, bSecs, function (x) { return clampSec(parseInt(x, 10) || 0); });
    var dt = P(K.date, bDate);
    var wk = P(K.week, bWeek, function (x) { return cleanWeek(parseMaybeJSON(x)); });
    if (!window.StudyTime) {
    if (accountChanged) {
    selfS('todayStudySeconds', (sc !== undefined && sc !== null) ? sc : 0);
    selfS('lastAccessDateStr', (dt !== undefined && dt !== null && dt !== '') ? dt : todayStr());
    selfS('weeklyStudyMinutesLog', (wk !== undefined && wk !== null) ? wk : [0,0,0,0,0,0,0]);
    } else {
    if (sc !== undefined) selfS('todayStudySeconds', sc);
    if (dt !== undefined) selfS('lastAccessDateStr', dt || '');
    if (wk !== undefined) selfS('weeklyStudyMinutesLog', wk);
    }
    }
    var wo = P(K.word, bWord, function (x) { var p = parseMaybeJSON(x); return (p && typeof p === 'object') ? p : {}; }); if (wo !== undefined) selfS('wordMemory', wo || {});
    var tx = P(K.text, bText, function (x) { var p = parseMaybeJSON(x); return Array.isArray(p) ? p : []; }); if (tx !== undefined) selfS('textHistory', tx || []);
    var bk = P(K.book, bBook, function (x) { var p = parseMaybeJSON(x); return Array.isArray(p) ? p : []; }); if (bk !== undefined) selfS('myBookshelf', bk || []);
    var fd = P(K.fold, bFold, function (x) { var p = parseMaybeJSON(x); return (Array.isArray(p) && p.length) ? p : ['未分類']; }); if (fd !== undefined) selfS('myFolders', fd);
    if (bName === null) { set('name', selfG('myName') || ''); set('exp', String(selfG('totalExp') || 0)); set('title', selfG('selectedTitle') || ''); set('target', selfG('myTarget') || ''); set('friends', JSON.stringify(selfG('myFriendList') || [])); }
    if (bSecs === null) { set('study_secs', String(selfG('todayStudySeconds') || 0)); set('study_date', selfG('lastAccessDateStr') || todayStr()); set('study_week', JSON.stringify(selfG('weeklyStudyMinutesLog') || [0,0,0,0,0,0,0])); }
    if (bWord === null) set('wordMemory', JSON.stringify(selfG('wordMemory') || {}));
    if (bText === null) set('textHistory', JSON.stringify(selfG('textHistory') || []));
    if (bBook === null) set('myBookshelf', JSON.stringify(selfG('myBookshelf') || []));
    if (bFold === null) set('myFolders', JSON.stringify(selfG('myFolders') || ['未分類']));
    __studyLoadedForId = id;
    refreshDisplay();
    checkResetGeneration();
    });
    }
    function saveMyData() {
    var id = selfMyId(); if (!id || id === 'GUEST-000') return Promise.resolve();
    set('name', selfG('myName') || ''); set('exp', String(selfG('totalExp') || 0)); set('title', selfG('selectedTitle') || ''); set('target', selfG('myTarget') || ''); set('friends', JSON.stringify(selfG('myFriendList') || []));
    set('study_secs', String(selfG('todayStudySeconds') || 0)); set('study_date', selfG('lastAccessDateStr') || todayStr()); set('study_week', JSON.stringify(selfG('weeklyStudyMinutesLog') || [0,0,0,0,0,0,0]));
    set('wordMemory', JSON.stringify(selfG('wordMemory') || {})); set('textHistory', JSON.stringify(selfG('textHistory') || [])); set('myBookshelf', JSON.stringify(selfG('myBookshelf') || [])); set('myFolders', JSON.stringify(selfG('myFolders') || ['未分類']));
    if(window.endOnlyCloudSaves)return Promise.resolve();
    var payload=snapToPayload({ myName: selfG('myName'), totalExp: selfG('totalExp'), selectedTitle: selfG('selectedTitle'), myTarget: selfG('myTarget'), myFriendList: selfG('myFriendList'), userStats: selfG('userStats'), todayStudySeconds: selfG('todayStudySeconds'), weeklyStudyMinutesLog: selfG('weeklyStudyMinutesLog'), lastAccessDateStr: selfG('lastAccessDateStr'), wordMemory: selfG('wordMemory'), textHistory: selfG('textHistory'), myBookshelf: selfG('myBookshelf'), myFolders: selfG('myFolders') });if(window.StudyTime){delete payload.stats;delete payload.userStats;delete payload.todayStudySeconds;delete payload.weeklyStudyMinutesLog;delete payload.lastAccessDateStr;}return fbWriteOf(id,payload).catch(function () { toast('⚠️ 端末内にだけ保存しました。ネット復帰後に再同期'); });
    }
    function saveOther() { var t = T(); if (!t || t.mode !== 'other' || !t.uid) return Promise.resolve(); return fbWriteOf(t.uid, snapToPayload(t.snap || {}, { _editedByAdmin: true })).catch(function () { toast('⚠️ 保存に失敗しました'); }); }
    function refreshDisplay() { try { if (window.__updateStudyTimeDisplay) window.__updateStudyTimeDisplay(); } catch (e) {} try { if (window.renderActivityChart) window.renderActivityChart(); } catch (e) {} }
    
    // ---- 今週の勉強秒数（ランキング用・絶対値＝二重加算なし） ----
    function computeWeekSecs() {
    var now = new Date(); var cur = now.getDay() - 1; if (cur < 0) cur = 6;
    var log = (typeof weeklyStudyMinutesLog !== 'undefined' && Array.isArray(weeklyStudyMinutesLog)) ? weeklyStudyMinutesLog : [0,0,0,0,0,0,0];
    var s = 0; for (var i = 0; i < 7; i++) { if (i === cur) s += (parseInt(todayStudySeconds) || 0); else s += (Math.floor(parseFloat(log[i]) || 0)) * 60; }
    return s;
    }
    // ---- 勉強時間同期（initStudyTimerAndDataRotation は上書きしない＝app.js の加算に任せる） ----
    //   fix.js は“加算しない”。today/week は絶対値代入、total だけ自前で積算（app.js 側が積算していないため）。
    function fixStudySyncStart() {
    if (window.__fixStudySyncId) return;
    window.__fixStudySyncId = setInterval(function () {
    if(window.StudyTime)return;
    try {
    var t = todayStr(); var wk = weekKeyOf();
    var count = false;
    if (window.currentActiveTabId === 'vocab' || window.currentActiveTabId === 'reader') count = true;
    else if (window.currentActiveTabId === 'game') {
    var a = document.getElementById('flashcard-play-screen'), b = document.getElementById('game-play-screen');
    if ((a && a.style.display === 'flex') || (b && b.style.display === 'block')) count = true;
    }
    try {
    if (userStats.study_today_date !== t) { userStats.study_today_date = t; userStats.study_today_secs = 0; }
    if (userStats.study_week_key !== wk) { userStats.study_week_key = wk; userStats.study_week_secs = 0; }
    userStats.study_today_secs = (parseInt(todayStudySeconds) || 0);
    userStats.study_week_secs = computeWeekSecs();
    if (count) userStats.study_total_secs = (parseInt(userStats.study_total_secs) || 0) + 1;
    var m = Math.floor((parseInt(todayStudySeconds) || 0) / 60);
    if (m > (userStats.study_burst || 0)) { userStats.study_burst = m; if (window.saveUserStats) window.saveUserStats(); if (window.checkAndRewardTitleBonusXP) window.checkAndRewardTitleBonusXP(); }
    } catch (e) {}
    try { if (window.__updateStudyTimeDisplay) window.__updateStudyTimeDisplay(); } catch (e) {}
    if ((parseInt(todayStudySeconds) || 0) % 10 === 0) { try { if (window.renderActivityChart) window.renderActivityChart(); } catch (e) {} }
    if ((parseInt(todayStudySeconds) || 0) % 30 === 0) saveMyData();
    } catch (e) {}
    }, 1000);
    }
    
    // ---- 称号ボーナス（延伸＋共通） ----
    
    // ---- 称号コレクション（延伸＋シーズン維持） ----
    
    // ---- 黄色バナー除去 ----
    function killResidueBanner() { try { window.__steShowResidueBanner = function () {}; } catch (e) {} try { var b = document.getElementById('steResidueBanner'); if (b && b.parentNode) b.parentNode.removeChild(b); } catch (e) {} }
    function installBannerKiller() { killResidueBanner(); try { if (!window.__bannerKillerObs) { window.__bannerKillerObs = new MutationObserver(function (muts) { for (var i = 0; i < muts.length; i++) { var added = muts[i].addedNodes; if (!added) continue; for (var j = 0; j < added.length; j++) { var n = added[j]; if (n.nodeType === 1 && n.id === 'steResidueBanner') { try { n.parentNode.removeChild(n); } catch (e) {} } } } }); window.__bannerKillerObs.observe(document.body, { childList: true }); } } catch (e) {} }
    
    function toast(msg) { var t = document.getElementById('steToast'); if (!t) { t = document.createElement('div'); t.id = 'steToast'; t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:10001;background:#166534;color:#dcfce7;font-size:13px;font-weight:700;padding:10px 18px;border-radius:999px;opacity:0;transition:opacity .25s;pointer-events:none;box-shadow:0 10px 30px rgba(0,0,0,.4);font-family:' + F_BODY + ';'; document.body.appendChild(t); } t.innerText = msg; t.style.opacity = '1'; clearTimeout(t.__t); t.__t = setTimeout(function () { t.style.opacity = '0'; }, 2200); }
    window.__steToast = toast;
    
    // ---- 称号エディタ用ヘルパー ----
    
    // ---- 全ユーザー消去オーバーレイ ----
    
    // ---- データ管理ボタン注入 ----
    
    // ---- patchCore：loadLocalState / saveUserStats ラップ（save 直前に世代トークン確認） ----
    function patchCore() {
    window.onAppLoaded(function () { return loadMyData(); });
    var origSave = window.saveUserStats;
    window.saveUserStats = function () {
    // save 直前：世代トークンが新しければローカル派生を潰してから0を書く（復活根絶）
    try {
    var me = gMyIdSelf();
    if (me && me !== 'GUEST-000') {
    var gen = 0; try { gen = parseInt(localStorage.getItem('__ste_reset_gen_' + me)) || 0; } catch (e) {}
    // 簡易キャッシュ比較（重い読み込みは boot/定期ポーリングに任せる）
    if (window.__fixLastGen && window.__fixLastGen > gen) {
    wipeLocalDerived();
    try { localStorage.setItem('__ste_reset_gen_' + me, String(window.__fixLastGen)); } catch (e) {}
    }
    }
    } catch (e) {}
    var r = origSave ? origSave.apply(this, arguments) : Promise.resolve(); saveMyData(); return r;
    };
    }
    var lastSeenId = myId();
    setInterval(function () {
    var id = myId(); if (id !== lastSeenId) { lastSeenId = id; if (!isOther()) loadMyData(); }
    killResidueBanner();
    // Retired administrator reset controls do not poll Firestore.
    }, 30000);
    
    function boot() {
    if (typeof window.saveUserStats === 'function' && typeof window.loadLocalState === 'function') {
    patchCore(); installBannerKiller();
    Promise.resolve().then(function () {
    loadMyData(); killResidueBanner(); fixStudySyncStart();
    // 起動時に世代トークンを1回読んでキャッシュ
    netReadShared('app_settings').then(function (cfg) { window.__fixLastGen = (cfg && cfg.resetGeneration) ? parseInt(cfg.resetGeneration) || 0 : 0; }).catch(function () {});
    });
    } else { setTimeout(boot, 150); }
    }
    if (document.readyState === 'complete') boot(); else window.addEventListener('load', boot);
    })();

(function applyWipeSelectMergePatch(){
"use strict";
if (window.__wipeSelectMerged) return;
window.__wipeSelectMerged = true;

var CATS = [
 {id:'study', label:'勉強時間'},
 {id:'vocab', label:'単語理解度'},
 {id:'game',  label:'ゲーム/ランキング'},
 {id:'friend',label:'フレンド'}
];
function has(cats,id){ return cats.indexOf(id)>=0; }

/* ---------- 既存ダイアログへ選択チェックを注入 ---------- */

/* ---------- 2段階→選択式消去 ---------- */

/* ---------- 共有(ランキング等) ---------- */
/* ---------- 全ユーザー(クラウド) ---------- */
/* ---------- 自分(ローカル) ---------- */
function wipeLocalSelective(cats){
 if(has(cats,'exp')){ try{ totalExp=0; localStorage.setItem('core_v4_totalExp','0'); userStats.user_level=1; }catch(e){} }
 if(has(cats,'title')){ try{ selectedTitle='称号なし'; localStorage.setItem('core_v4_userTitle','称号なし'); userStats.seasonTitles=[]; userStats.settledSeasons=[]; rewardedTitlesStepsCache={}; localStorage.setItem('core_v4_rewarded_titles_cache','{}'); }catch(e){} }
 if(has(cats,'study')){ try{ todayStudySeconds=0; localStorage.setItem('core_v4_study_today_secs','0'); weeklyStudyMinutesLog=[0,0,0,0,0,0,0]; localStorage.setItem('core_v4_study_weekly_log','[0,0,0,0,0,0,0]'); userStats.study_total_secs=0; userStats.study_burst=0; }catch(e){} }
 if(has(cats,'vocab')){ try{ wordMemory={}; localStorage.setItem('wordMemory','{}'); }catch(e){} }
 if(has(cats,'game')){ try{ ['ja2en','en2ja','mixed'].forEach(function(m){ ['endless','normal','hard','expert'].forEach(function(d){ localStorage.removeItem('cosmic_score_'+m+'_'+d); localStorage.removeItem('cosmic_best_'+m+'_'+d); }); }); }catch(e){} }

 if(has(cats,'friend')){ try{ myFriendList=[]; localStorage.setItem('core_v4_friend_list','[]'); userStats.friends_count=0; }catch(e){} }
 try{ localStorage.setItem('core_v4_user_stats_'+myId, JSON.stringify(userStats)); }catch(e){}
 try{ if(window.saveUserStats) window.saveUserStats(); }catch(e){}
 try{ if(window.renderLeaderboard) window.renderLeaderboard(); }catch(e){}
 try{ if(window.renderActivityChart) window.renderActivityChart(); }catch(e){}
}
/* ---------- 他端末(次回起動時)に選択分だけ消させる ---------- */
function applySelResetOnLoad(){
 if(!window.db||!window.fbGetDoc||!window.fbDoc) return;
 if(typeof myId==='undefined'||!myId||myId==='GUEST-000') return;
 window.fbGetDoc(window.fbDoc(window.db,'shared','app_settings')).then(function(snap){
   if(!snap||!snap.exists()) return;
   var d=snap.data()||{}; var gen=parseInt(d.selResetGen)||0; var cats=d.selResetCats||[];
   if(!gen||!cats.length) return;
   var key='__sel_reset_gen_'+myId; var local=parseInt(localStorage.getItem(key))||0;
   if(gen>local){ wipeLocalSelective(cats); try{ localStorage.setItem(key,String(gen)); }catch(e){} }
 }).catch(function(){});
}
/* ---------- 起動フック ---------- */
window.onAppLoaded(function(){ setTimeout(applySelResetOnLoad,800); });
/* ---------- ダイアログが開いたら選択を注入 ---------- */
setTimeout(applySelResetOnLoad,1200);
})();
