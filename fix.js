// =====================================================================
// fix.js —— 管理者データ管理パネル ＋ 称号エディタ ＋ 全ユーザー一括消去
//   ・「全部まとめてリセット」＝ 自分＋全ユーザーの“勉強に関係ない派生データ”だけ消去
//     （単語理解度/単語/長文/本棚/名前/目標/APIキー/アイコン/フレンド は全員ぶん完全保持）
//   ・消したのに端末残骸で復活するのを“世代トークン”で根絶
//   ・報酬XP＝レア度共通 ／ 獲得条件＝称号ごと ／ レジェンダリー超え＝必要量×2・XP同額
//   ・データ管理ボタン＝管理者画面のユーザー管理カード直下
//   ・アカウント複製防止 ／ 進捗消失防止 ／ ランキング同期 ／ グラフ番犬 ／ 黄色バナー除去
// app.js は触らない。index.html の </body> 直前に <script src="fix.js" defer></script>
// =====================================================================
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
var DEFAULT_BONUSES = [10, 100, 500, 2500, 7777];
var DEFAULT_STEPS = {
test_count: [10, 100, 500, 2500, 9999], combo_max: [2, 5, 10, 30, 50],
mistake_count: [5, 25, 100, 500, 999], vocab_fixed: [5, 25, 100, 500, 999],
study_burst: [5, 15, 30, 60, 120], reader_open: [3, 10, 25, 50, 99],
flash_count: [10, 100, 500, 2500, 9999], friends_count: [1, 5, 10, 25, 50],
user_level: [5, 10, 25, 50, 99]
};
var RARITY_NAMES = ['コモン', 'アンコモン', 'レア', 'スーパーレア', 'レジェンダリー'];
var RARITY_SHORT = ['コモン', 'アンコモン', 'レア', 'SR', 'レジェ'];
// ---- 派生データ（消す）／保持（残す）の定義 ----
var DERIVED_COUNTERS = ['test_count','combo_max','multi_win','high_score','mistake_count','vocab_reg','vocab_fixed','delete_count','study_burst','reader_open','flash_count','user_level','gold_spent','study_total_secs','study_today_secs','study_week_secs'];

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
function lvOf(exp) {
try { if (typeof window.calculateLevelFromExp === 'function') { var r = window.calculateLevelFromExp(exp || 0); if (r && typeof r.level === 'number' && isFinite(r.level)) return Math.floor(r.level); } } catch (e) {}
return -1;
}
function canReverse() { return lvOf(0) >= 0; }
function expForLevel(L) {
L = Math.floor(L); if (L < 1) return null; if (lvOf(0) < 0) return null; if (lvOf(0) >= L) return 0;
var hi = 1, g = 0; while (lvOf(hi) < L && hi < 2e9 && g < 64) { hi *= 4; g++; }
if (lvOf(hi) < L) return null; var lo = 0;
while (lo < hi) { var mid = Math.floor((lo + hi) / 2); if (lvOf(mid) >= L) hi = mid; else lo = mid + 1; }
return lo;
}

// ---- 称号DB参照 ----
function titleDB() { try { if (typeof TITLE_DATABASE !== 'undefined' && Array.isArray(TITLE_DATABASE)) return TITLE_DATABASE; } catch (e) {} return []; }
function specialDB() { try { if (typeof SPECIAL_TITLES !== 'undefined' && Array.isArray(SPECIAL_TITLES)) return SPECIAL_TITLES; } catch (e) {} return []; }
function rarityMap() { try { if (typeof RARITY_MAP !== 'undefined' && Array.isArray(RARITY_MAP)) return RARITY_MAP; } catch (e) {} return null; }

// ---- 延伸ロジック（レジェンダリー超え：必要量は2の累乗、XPはレジェンダリー同額＝共通テーブル） ----
function bonusesCommon() { var cfg = window.__titleConfig || { steps: {}, bonusesCommon: null }; if (Array.isArray(cfg.bonusesCommon) && cfg.bonusesCommon.length === 5) return cfg.bonusesCommon; return DEFAULT_BONUSES; }
function stepsOf(t) { return (Array.isArray(t.steps) && t.steps.length === 5) ? t.steps : (DEFAULT_STEPS[t.id] || [10, 100, 500, 2500, 9999]); }
function thresholdOfStep(t, step) { var st = stepsOf(t); if (step <= 0) return 0; if (step <= st.length) return st[step - 1]; var base = st[st.length - 1]; return Math.floor(base * Math.pow(2, step - st.length)); }
function reachedStepOf(t, val) { var st = stepsOf(t); var step = 0; for (var i = 0; i < st.length; i++) { if (val >= st[i]) step = i + 1; } if (step >= st.length && st.length > 0) { var base = st[st.length - 1]; if (base > 0 && val >= base) { var k = 1; while (val >= base * Math.pow(2, k)) { step = st.length + k; k++; if (k > 1024) break; } } } return step; }
function bonusForStep(t, step) { var bn = bonusesCommon(); if (step <= 0) return 0; if (step <= bn.length) return bn[step - 1]; return bn[bn.length - 1]; }
function rarityLabelOf(step) { if (step <= 0) return '未解放'; var rm = rarityMap(); if (step <= 5) { if (rm && rm[step - 1]) return rm[step - 1].name; return RARITY_NAMES[step - 1] || ('段階' + step); } return 'レジェンダリー' + plusStr(step - 5); }
function rarityClassOf(step) { if (step <= 0) return 'r0'; if (step <= 5) return 'r' + step; return 'r6'; }
function plusStr(n) { var s = ''; for (var i = 0; i < n; i++) s += '＋'; return s; }
function activeFullTitleOf(t, step) { if (step <= 0) return ''; return '【' + rarityLabelOf(step) + '】' + t.name; }

// ---- 称号設定（shared/title_config） ----
window.__titleConfig = window.__titleConfig || { steps: {}, bonusesCommon: null };
function netReadShared(docId) { if (!window.db || !window.fbGetDoc || !window.fbDoc) return Promise.resolve(null); return window.fbGetDoc(window.fbDoc(window.db, 'shared', docId)).then(function (s) { return s && s.exists() ? s.data() : null; }).catch(function () { return null; }); }
function netWriteShared(docId, payload) { if (!window.db || !window.fbSetDoc || !window.fbDoc) return Promise.resolve(); return window.fbSetDoc(window.fbDoc(window.db, 'shared', docId), payload, { merge: true }).catch(function () {}); }
function applyTitleConfigToDB() { var cfg = window.__titleConfig || { steps: {}, bonusesCommon: null }; if (!cfg.steps) cfg.steps = {}; var bc = (Array.isArray(cfg.bonusesCommon) && cfg.bonusesCommon.length === 5) ? cfg.bonusesCommon : null; titleDB().forEach(function (t) { if (Array.isArray(cfg.steps[t.id]) && cfg.steps[t.id].length === 5) t.steps = cfg.steps[t.id].map(function (x) { return clampInt(x); }); else if (!Array.isArray(t.steps) || t.steps.length !== 5) t.steps = (DEFAULT_STEPS[t.id] || [10, 100, 500, 2500, 9999]).slice(); t.bonuses = bc ? bc.slice() : DEFAULT_BONUSES.slice(); }); }
function loadTitleConfig() { return netReadShared('title_config').then(function (cfg) { window.__titleConfig = (cfg && typeof cfg === 'object') ? cfg : { steps: {}, bonusesCommon: null }; applyTitleConfigToDB(); }); }
function saveTitleConfig() { var cfg = window.__titleConfig || { steps: {}, bonusesCommon: null }; if (!cfg.steps) cfg.steps = {}; return netWriteShared('title_config', cfg); }
function commitTitleSteps(titleId, stepsArr) { var cfg = window.__titleConfig || { steps: {}, bonusesCommon: null }; if (!cfg.steps) cfg.steps = {}; cfg.steps[titleId] = stepsArr; window.__titleConfig = cfg; applyTitleConfigToDB(); return saveTitleConfig().then(function () { try { window.renderTitles(); } catch (e) {} }); }
function resetTitleSteps(titleId) { var cfg = window.__titleConfig || { steps: {}, bonusesCommon: null }; if (cfg.steps) delete cfg.steps[titleId]; window.__titleConfig = cfg; applyTitleConfigToDB(); return saveTitleConfig().then(function () { try { window.renderTitles(); } catch (e) {} }); }
function commitBonusesCommon(arr) { var cfg = window.__titleConfig || { steps: {}, bonusesCommon: null }; cfg.bonusesCommon = arr; window.__titleConfig = cfg; applyTitleConfigToDB(); return saveTitleConfig().then(function () { try { window.renderTitles(); } catch (e) {} }); }
function resetBonusesCommon() { var cfg = window.__titleConfig || { steps: {}, bonusesCommon: null }; delete cfg.bonusesCommon; window.__titleConfig = cfg; applyTitleConfigToDB(); return saveTitleConfig().then(function () { try { window.renderTitles(); } catch (e) {} }); }

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
test_count: 0, combo_max: 0, multi_win: 0, high_score: 0, mistake_count: 0,
vocab_reg: 0, vocab_fixed: 0, delete_count: 0, study_burst: 0, reader_open: 0,
flash_count: 0, user_level: 1, gold_spent: 0,
goal_text: keepGoal, friends_count: keepFc, weekly_rank_first: false,
seasonTitles: [], settledSeasons: [],
study_total_secs: 0, study_today_secs: 0, study_week_secs: 0,
study_today_date: todayStr(), study_week_key: weekKeyOf()
};
}
function fetchAllUserIds() {
var p = (typeof window.getAllUsers === 'function') ? window.getAllUsers() : Promise.resolve([]);
return Promise.resolve(p).then(function (users) {
var ids = []; (users || []).forEach(function (u) { if (u && u.id && u.id !== 'GUEST-000' && ids.indexOf(u.id) < 0) ids.push(u.id); });
var me = gMyIdSelf(); if (me && me !== 'GUEST-000' && ids.indexOf(me) < 0) ids.push(me);
return ids;
}).catch(function () { return []; });
}
function wipeOneUser(uid) {
return netReadOf(uid).then(function (data) {
if (!data) return;
var fresh = resetDerivedStats(data.userStats || {});
var ps = [ fbWriteOf(uid, { totalExp: 0, selectedTitle: '称号なし', userStats: fresh, updatedAt: new Date().toISOString() }) ];
try {
if (window.db && window.fbSetDoc && window.fbDoc) {
ps.push(window.fbSetDoc(window.fbDoc(window.db, 'shared_leaderboard', uid), { exp: 0, level: 1, title: '称号なし', name: data.playerName || '', avatar: data.avatar || '', updatedAt: new Date().toISOString() }, { merge: true }).catch(function(){}));
}
} catch (e) {}
return Promise.all(ps);
});
}
function wipeSharedRankings() {
if (!window.db || !window.fbSetDoc || !window.fbDoc) return Promise.resolve();
var modes = ['ja2en', 'en2ja', 'mixed']; var diffs = ['endless', 'normal', 'hard', 'expert'];
var docs = [];
modes.forEach(function (m) { docs.push('game_hall_' + m); diffs.forEach(function (d) { docs.push('game_hall_' + m + '_' + d); }); });
try {
if (typeof window.getCurrentSeasonNo === 'function') {
var cur = window.getCurrentSeasonNo() || 0;
for (var n = 1; n <= cur; n++) {
var sm = (typeof window.getSeasonMode === 'function') ? window.getSeasonMode(n) : modes[(n - 1) % modes.length];
docs.push('game_season_' + n + '_' + sm);
}
}
} catch (e) {}
var tasks = docs.map(function (d) { return window.fbSetDoc(window.fbDoc(window.db, 'shared', d), { scores: [], updatedAt: new Date().toISOString() }, { merge: true }).catch(function(){}); });
return Promise.all(tasks);
}
function bumpResetGeneration() { return netWriteShared('app_settings', { resetGeneration: Date.now(), resetAt: new Date().toISOString() }); }
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
function runWipeAll(onProgress) {
var me = gMyIdSelf();
return bumpResetGeneration()
.then(function () { return wipeSharedRankings(); })
.then(function () { return fetchAllUserIds(); })
.then(function (ids) {
var total = ids.length; var done = 0;
var chain = Promise.resolve();
ids.forEach(function (uid) {
chain = chain.then(function () {
return wipeOneUser(uid).then(function () {
done++; if (typeof onProgress === 'function') onProgress(done, total, uid);
if (uid === me) { wipeLocalDerived(); try { localStorage.setItem('__ste_reset_gen_' + me, String(Date.now())); } catch (e) {} }
});
});
});
return chain;
});
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
function P(nkeys, bval, parser) { var nv = pickNet(net, nkeys); if (nv !== undefined && nv !== null) return parser ? parser(nv) : nv; if (bval !== null && bval !== undefined) return parser ? parser(bval) : bval; return undefined; }
var nm = P(K.name, bName); if (nm !== undefined) selfS('myName', nm || 'プレイヤー1');
var ex = P(K.exp, bExp, function (x) { return parseInt(x, 10) || 0; }); if (ex !== undefined) selfS('totalExp', ex);
var ti = P(K.title, bTitle); if (ti !== undefined) selfS('selectedTitle', ti || '称号なし');
var tg = P(K.target, bTarget); if (tg !== undefined) selfS('myTarget', tg || '未設定');
var fr = P(K.friends, bFriends, function (x) { var p = parseMaybeJSON(x); return Array.isArray(p) ? p : []; }); if (fr !== undefined) selfS('myFriendList', fr || []);
var st = P(K.stats, null);
if (!isOther()) { var cur = selfG('userStats') || {}; st = mergeStats(cur, (st && typeof st === 'object') ? st : {}); }
if (st !== undefined && typeof st === 'object') selfS('userStats', st || {});
var sc = P(K.secs, bSecs, function (x) { return clampSec(parseInt(x, 10) || 0); });
var dt = P(K.date, bDate);
var wk = P(K.week, bWeek, function (x) { return cleanWeek(parseMaybeJSON(x)); });
if (accountChanged) {
selfS('todayStudySeconds', (sc !== undefined && sc !== null) ? sc : 0);
selfS('lastAccessDateStr', (dt !== undefined && dt !== null && dt !== '') ? dt : todayStr());
selfS('weeklyStudyMinutesLog', (wk !== undefined && wk !== null) ? wk : [0,0,0,0,0,0,0]);
} else {
if (sc !== undefined) selfS('todayStudySeconds', sc);
if (dt !== undefined) selfS('lastAccessDateStr', dt || '');
if (wk !== undefined) selfS('weeklyStudyMinutesLog', wk);
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
return fbWriteOf(id, snapToPayload({ myName: selfG('myName'), totalExp: selfG('totalExp'), selectedTitle: selfG('selectedTitle'), myTarget: selfG('myTarget'), myFriendList: selfG('myFriendList'), userStats: selfG('userStats'), todayStudySeconds: selfG('todayStudySeconds'), weeklyStudyMinutesLog: selfG('weeklyStudyMinutesLog'), lastAccessDateStr: selfG('lastAccessDateStr'), wordMemory: selfG('wordMemory'), textHistory: selfG('textHistory'), myBookshelf: selfG('myBookshelf'), myFolders: selfG('myFolders') })).catch(function () { toast('⚠️ 端末内にだけ保存しました。ネット復帰後に再同期'); });
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
try {
var t = todayStr(); var wk = weekKeyOf();
var count = false;
if (window.currentActiveTabId === 'vocab' || window.currentActiveTabId === 'reader') count = true;
else if (window.currentActiveTabId === 'game') {
var a = document.getElementById('flashcard-play-screen'), b = document.getElementById('game-play-screen'), c = document.getElementById('multi-battle-play-screen');
if ((a && a.style.display === 'flex') || (b && b.style.display === 'block') || (c && c.style.display === 'flex')) count = true;
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
window.checkAndRewardTitleBonusXP = function () {
if (isOther()) return;
var added = false;
titleDB().forEach(function (t) {
var val = userStats[t.id] || 0; var cur = reachedStepOf(t, val);
if (!rewardedTitlesStepsCache[t.id]) rewardedTitlesStepsCache[t.id] = 0;
if (cur > rewardedTitlesStepsCache[t.id]) { for (var s = rewardedTitlesStepsCache[t.id] + 1; s <= cur; s++) { totalExp += bonusForStep(t, s); added = true; } rewardedTitlesStepsCache[t.id] = cur; }
});
specialDB().forEach(function (t) { var unlocked = false; try { unlocked = t.check(); } catch (e) {} if (unlocked && !rewardedTitlesStepsCache[t.id]) { totalExp += 7777; rewardedTitlesStepsCache[t.id] = 1; added = true; } });
if (added) {
try { localStorage.setItem('core_v4_totalExp', totalExp); } catch (e) {}
try { localStorage.setItem('core_v4_rewarded_titles_cache', JSON.stringify(rewardedTitlesStepsCache)); } catch (e) {}
var nd = lvOf(totalExp); if (nd >= 0) userStats.user_level = nd;
window.saveUserStats(); window.applyProfileToUi(); window.renderTitles(); window.renderLeaderboard();
}
};

// ---- 称号コレクション（延伸＋シーズン維持） ----
window.renderTitles = function () {
var listContainer = document.getElementById('titles-list'); var selectEl = document.getElementById('sideSelectTitle');
if (!listContainer) return;
listContainer.innerHTML = ""; if (selectEl) selectEl.innerHTML = '<option value="称号なし">称号なし</option>';
var unlockedCount = 0, totalPossible = 0;
titleDB().forEach(function (title) {
var val = userStats[title.id] || 0; var reachedStep = reachedStepOf(title, val);
unlockedCount += Math.min(reachedStep, 5); totalPossible += 5;
var card = document.createElement('div'); card.className = "word-row-container";
card.style.cssText = "border-radius: 12px; padding: 14px; margin-bottom: 10px; border: 1.5px solid rgba(255,255,255,0.15); background: rgba(30, 41, 59, 0.85); box-sizing: border-box;";
var badgeHTML = '<span class="badge-common" style="padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; border: 1px solid #4b5563;">未解放</span>';
var activeFullTitle = "";
if (reachedStep > 0) {
badgeHTML = '<span class="badge-legendary" style="padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-shadow: 0 0 5px rgba(0,0,0,0.5);">' + esc(rarityLabelOf(reachedStep)) + ' (段階 ' + reachedStep + ')</span>';
activeFullTitle = activeFullTitleOf(title, reachedStep);
if (selectEl) { var opt = document.createElement('option'); opt.value = activeFullTitle; opt.innerText = activeFullTitle; selectEl.appendChild(opt); }
}
var isEquipped = selectedTitle === activeFullTitle && reachedStep > 0;
var st = stepsOf(title); var targetVal = reachedStep > 0 ? thresholdOfStep(title, reachedStep + 1) : st[0];
card.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;"><div style="font-weight:900; font-size:16px; color:#ffffff;">' + esc(title.name) + '</div><div>' + badgeHTML + '</div></div>' +
'<div style="font-size:12.5px; color:#FFFFFF; margin-bottom:8px; font-weight:700;">現在の進捗状況: <span style="color:var(--cosmic-cyan); font-weight:900;">' + val + '</span> / 次の段階目標値: ' + esc(String(targetVal)) + esc(title.unit || '') + '</div>' +
'<div style="font-size:11px; color:rgba(255,255,255,0.85); font-weight:600; margin-bottom:12px; line-height:1.4; background:rgba(0,0,0,0.25); padding:6px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.05);">📊 課題内容: ' + esc(title.desc) + '<br>📈 進化段階ライン: ' + st.join(' ➔ ') + ' ➔ ＋(×2) ➔ (×4)… (' + esc(title.unit || '') + ')</div>' +
(reachedStep > 0 ? '<button class="modern-btn" style="height: 34px; font-size:11px; background:' + (isEquipped ? 'var(--word-ok-bg) !important' : 'rgba(0,0,0,0.3) !important') + '; border-color:' + (isEquipped ? 'var(--word-ok)' : 'var(--border)') + ' !important; color:' + (isEquipped ? 'var(--word-ok)' : 'white') + ' !important; box-shadow: none !important;" onclick="equipTitle(\'' + activeFullTitle.replace(/'/g, "\\'") + '\')">' + (isEquipped ? 'セット中' : '称号をセットする') + '</button>' : '<button class="modern-btn" style="height: 34px; font-size:11px; background: rgba(0,0,0,0.5) !important; color:var(--text-sub) !important; border-color:var(--border) !important; box-shadow: none !important; cursor: not-allowed;" disabled>条件未達成</button>');
listContainer.appendChild(card);
});
specialDB().forEach(function (title) {
var isUnlocked = false; try { isUnlocked = title.check(); } catch (e) {}
totalPossible += 1; if (isUnlocked) unlockedCount += 1;
var card = document.createElement('div'); card.className = "word-row-container";
card.style.cssText = "border-radius: 12px; padding: 14px; margin-bottom: 10px; border: 1.5px solid #F59E0B; background: linear-gradient(135deg, rgba(245,158,11,0.05) 0%, rgba(30,41,59,0.9) 100%); box-sizing: border-box;";
var activeFullTitle = '【特別】' + title.name;
if (isUnlocked) {
var badgeHTML = '<span class="badge-legendary" style="padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">レジェンダリー</span>';
if (selectEl) { var opt = document.createElement('option'); opt.value = activeFullTitle; opt.innerText = activeFullTitle; selectEl.appendChild(opt); }
var isEquipped = selectedTitle === activeFullTitle;
card.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;"><div style="font-weight:900; font-size:16px; color:#f59e0b; text-shadow:0 0 10px rgba(245,158,11,0.4);">' + esc(title.name) + '</div><div>' + badgeHTML + '</div></div><div style="font-size:12.5px; color:#FFFFFF; font-weight:700; margin-bottom:12px; background:rgba(0,0,0,0.25); padding:6px 10px; border-radius:6px; border:1px solid rgba(245,158,11,0.2);">👑 解放達成条件: ' + esc(title.desc) + '</div><button class="modern-btn" style="height: 34px; font-size:11px; background:' + (isEquipped ? 'var(--word-ok-bg) !important' : 'rgba(0,0,0,0.3) !important') + '; border-color:' + (isEquipped ? 'var(--word-ok)' : '#F59E0B') + ' !important; color:' + (isEquipped ? 'var(--word-ok)' : 'white') + ' !important; box-shadow: none !important;" onclick="equipTitle(\'' + activeFullTitle.replace(/'/g, "\\'") + '\')">' + (isEquipped ? 'セット中' : '称号をセットする') + '</button>';
} else {
card.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;"><div style="font-weight:900; font-size:16px; color:rgba(255,255,255,0.25); font-style:italic;">🔒 未知のシークレット称号</div><div><span class="badge-common" style="padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; border: 1px solid #4b5563; background:rgba(0,0,0,0.4);">???</span></div></div><div style="font-size:11.5px; color:rgba(255,255,255,0.4); font-weight:500; line-height:1.4; text-align:center; padding:10px 0;">🕵️‍♂️ 隠された特定のミッションをクリアするとロックが解除されます。</div><button class="modern-btn" style="height: 34px; font-size:11px; background: rgba(0,0,0,0.5) !important; color:var(--text-sub) !important; border-color:var(--border) !important; box-shadow: none !important; cursor: not-allowed;" disabled>🔒 封印中</button>';
}
listContainer.appendChild(card);
});
if (selectEl) selectEl.value = selectedTitle;
var percent = totalPossible > 0 ? Math.round((unlockedCount / totalPossible) * 100) : 0;
var progressTextEl = document.getElementById('title-progress-text'); var progressBarEl = document.getElementById('title-progress-bar');
if (progressTextEl) progressTextEl.innerText = unlockedCount + ' / ' + totalPossible + '個 (' + percent + '%)';
if (progressBarEl) progressBarEl.style.width = percent + '%';
var equippedDisplayEl = document.getElementById('equipped-title-display');
if (equippedDisplayEl) equippedDisplayEl.innerText = selectedTitle ? selectedTitle : "（未装備）";
if (window.initLucide) window.initLucide();
if (typeof window.renderSeasonTitles === 'function') { try { window.renderSeasonTitles(); } catch (e) {} }
};

// ---- 黄色バナー除去 ----
function killResidueBanner() { try { window.__steShowResidueBanner = function () {}; } catch (e) {} try { var b = document.getElementById('steResidueBanner'); if (b && b.parentNode) b.parentNode.removeChild(b); } catch (e) {} }
function installBannerKiller() { killResidueBanner(); try { if (!window.__bannerKillerObs) { window.__bannerKillerObs = new MutationObserver(function (muts) { for (var i = 0; i < muts.length; i++) { var added = muts[i].addedNodes; if (!added) continue; for (var j = 0; j < added.length; j++) { var n = added[j]; if (n.nodeType === 1 && n.id === 'steResidueBanner') { try { n.parentNode.removeChild(n); } catch (e) {} } } } }); window.__bannerKillerObs.observe(document.body, { childList: true }); } } catch (e) {} }

function toast(msg) { var t = document.getElementById('steToast'); if (!t) { t = document.createElement('div'); t.id = 'steToast'; t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:10001;background:#166534;color:#dcfce7;font-size:13px;font-weight:700;padding:10px 18px;border-radius:999px;opacity:0;transition:opacity .25s;pointer-events:none;box-shadow:0 10px 30px rgba(0,0,0,.4);font-family:' + F_BODY + ';'; document.body.appendChild(t); } t.innerText = msg; t.style.opacity = '1'; clearTimeout(t.__t); t.__t = setTimeout(function () { t.style.opacity = '0'; }, 2200); }
window.__steToast = toast;
function isAdmin() { try { if (window.isAdmin === true || window.adminMode === true || window.adminUnlocked === true || window.__adminUnlocked === true || window.adminVerified === true) return true; var us = gStats(); if (us && (us.is_admin || us.isAdmin || us.admin)) return true; var cls = ((document.body ? document.body.className : '') + ' ' + (document.documentElement ? document.documentElement.className : '')); if (/(^|\s)(admin|admin-mode|admin-unlocked|is-admin|admin-verified)(\s|$|[-_])/i.test(cls)) return true; if (document.body && document.body.innerText && document.body.innerText.indexOf('@管理者') >= 0) return true; } catch (e) {} return false; }

// ---- 称号エディタ用ヘルパー ----
function readStats() { if (isOther()) { var s = __snap(); return (s.userStats && typeof s.userStats === 'object') ? s.userStats : {}; } try { if (typeof userStats !== 'undefined' && userStats && typeof userStats === 'object') return userStats; } catch (e) {} return gStats(); }
function editStats(fn) { if (isOther()) { var s = __snap(); if (!s.userStats || typeof s.userStats !== 'object') s.userStats = {}; fn(s.userStats); } else { try { fn(userStats); localStorage.setItem('core_v4_user_stats_' + myId, JSON.stringify(userStats)); sStats(userStats); } catch (e) {} } }
function clearRewarded(id) { if (isOther()) return; try { rewardedTitlesStepsCache[id] = 0; localStorage.setItem('core_v4_rewarded_titles_cache', JSON.stringify(rewardedTitlesStepsCache)); } catch (e) {} }
function maybeResetEquipped(name) { if (!name) return; var cur = isOther() ? (__snap().selectedTitle || '') : (function () { try { return selectedTitle; } catch (e) { return ''; } })(); if (cur && String(cur).indexOf(String(name)) >= 0) { if (isOther()) { __snap().selectedTitle = '称号なし'; } else { try { selectedTitle = '称号なし'; localStorage.setItem('core_v4_userTitle', '称号なし'); } catch (e) {} sTitle('称号なし'); } } }
function isSpecialEarned(sp, stats) { if (sp.id === 'goal_setting') return String(stats.goal_text || '').indexOf('大学合格') >= 0; if (sp.id === 'weekly_rank') return stats.weekly_rank_first === true; return false; }
function expNow() { var exp = gExp(); var s = (exp || 0).toLocaleString() + ' XP'; var lv = lvOf(exp); if (lv >= 0) s += '（Lv ' + lv + '）'; return s; }
function titleNow() { var t = gTitle() || '称号なし'; var DB = titleDB(); var stats = readStats(); var earned = 0; DB.forEach(function (tt) { if (reachedStepOf(tt, stats[tt.id] || 0) > 0) earned++; }); return t + (DB.length ? '　[' + earned + '/' + DB.length + ' 獲得]' : ''); }
function items() { var us = gStats() || {}; return [
{ icon: '⚡', name: '経験値・レベル', desc: 'レベルは経験値から自動で決まります', now: expNow, edit: { type: 'exp', get: function () { return gExp() || 0; }, set: function (v) { sExp(clampInt(v)); } }, reset: function () { sExp(0); } },
{ icon: '🏅', name: '称号', desc: '報酬XP(レア度共通)・獲得条件(称号ごと)・進捗・未取得化', now: titleNow, edit: { type: 'title', get: function () { return gTitle() || ''; }, set: function (v) { sTitle(v || '称号なし'); } }, reset: function () { sTitle('称号なし'); } },
{ icon: '🎯', name: '目標', desc: 'プロフィールの目標を書き換えます', now: function () { return gTarget() || '未設定'; }, edit: { type: 'text', get: function () { return gTarget() || ''; }, set: function (v) { sTarget(v || '未設定'); } }, reset: function () { sTarget('未設定'); } },
{ icon: '🔥', name: '連続学習の最高記録', desc: 'いちばん長く続けた分数の記録', now: function () { return (us.study_burst || 0) + ' 分'; }, edit: { type: 'number', unit: '分', get: function () { return (gStats() && gStats().study_burst) || 0; }, set: function (v) { var s = gStats() || {}; s.study_burst = clampInt(v); sStats(s); } }, reset: function () { var s = gStats() || {}; s.study_burst = 0; sStats(s); } },
{ icon: '⏱️', name: '今日の勉強時間', desc: '今日のカウンター（分単位で指定）', now: function () { var s = gSecs() || 0; return Math.floor(s / 60) + '分' + (s % 60) + '秒'; }, edit: { type: 'number', unit: '分', get: function () { return Math.floor((gSecs() || 0) / 60); }, set: function (v) { sSecs(clampInt(v) * 60); } }, reset: function () { sSecs(0); } },
{ icon: '📊', name: '週間グラフ', desc: '7日ぶんをまとめて編集（月〜日の順・分）', now: function () { var t = 0; (gWeek() || []).forEach(function (x) { t += (x || 0); }); return '合計 ' + Math.floor(t) + ' 分'; }, edit: { type: 'week', get: function () { return (gWeek() || [0,0,0,0,0,0,0]).slice(); }, set: function (a) { sWeek(cleanWeek(a)); } }, reset: function () { sWeek([0,0,0,0,0,0,0]); } },
{ icon: '🧠', name: '単語の記憶', desc: '覚えた判定の記録（編集不可・リセットのみ）', now: function () { return Object.keys(gWord() || {}).length + ' 語'; }, edit: null, reset: function () { sWord({}); } },
{ icon: '📚', name: '本棚・フォルダ', desc: '保存した長文とフォルダ（編集不可・リセットのみ）', now: function () { return (gBook() || []).length + ' 件 / ' + (gFold() || []).length + ' フォルダ'; }, edit: null, reset: function () { sBook([]); sFold(['未分類']); } },
{ icon: '👥', name: 'フレンドリスト', desc: '登録したフレンド（編集不可・リセットのみ）', now: function () { return (gFriends() || []).length + ' 人'; }, edit: null, reset: function () { sFriends([]); } }
]; }
function injectStyle() { if (document.getElementById('admStyle')) return; var s = document.createElement('style'); s.id = 'admStyle'; s.textContent = [
'@keyframes admMesh{0%{transform:translate(0,0) scale(1)}50%{transform:translate(6%,-4%) scale(1.15)}100%{transform:translate(0,0) scale(1)}}',
'@keyframes admMesh2{0%{transform:translate(0,0) scale(1.1)}50%{transform:translate(-5%,5%) scale(1)}100%{transform:translate(0,0) scale(1.1)}}',
'@keyframes admIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}',
'@keyframes admFlash{0%{box-shadow:inset 0 0 0 999px rgba(34,197,94,.28)}100%{box-shadow:inset 0 0 0 999px rgba(34,197,94,0)}}',
'@keyframes admTick{0%{transform:scale(0) rotate(-40deg);opacity:0}60%{transform:scale(1.25) rotate(0);opacity:1}100%{transform:scale(1) rotate(0);opacity:1}}',
'@keyframes admBlink{50%{opacity:.25}}',
'@keyframes stePop{0%{transform:scale(1)}40%{transform:scale(1.06);box-shadow:0 0 0 3px rgba(45,212,191,.35)}100%{transform:scale(1)}}',
'#admScrim{position:fixed;inset:0;z-index:9991;background:rgba(4,8,16,.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);opacity:0;pointer-events:none;transition:opacity .25s;}',
'#admScrim.open{opacity:1;pointer-events:auto;}',
'#admPanel{position:fixed;right:0;top:0;bottom:0;z-index:9992;width:min(430px,100vw);background:#0a1018;border-left:1px solid rgba(34,211,238,.16);box-shadow:-24px 0 70px rgba(0,0,0,.55);transform:translateX(100%);transition:transform .36s cubic-bezier(.2,.85,.25,1);display:flex;flex-direction:column;overflow:hidden;font-family:' + F_BODY + ';will-change:transform;}',
'#admPanel.open{transform:none;}',
'#admPanel .mesh{position:absolute;inset:-30%;z-index:0;pointer-events:none;}',
'#admPanel .mesh i{position:absolute;border-radius:50%;filter:blur(64px);opacity:.4;will-change:transform;}',
'#admPanel .mesh i.a{width:48%;height:40%;top:4%;left:6%;background:radial-gradient(circle,#0e7490,transparent 70%);animation:admMesh 15s ease-in-out infinite;}',
'#admPanel .mesh i.b{width:44%;height:36%;bottom:8%;right:2%;background:radial-gradient(circle,#b45309,transparent 70%);animation:admMesh2 19s ease-in-out infinite;}',
'#admPanel .grid{position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.4;background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.02) 0 1px,transparent 1px 46px),repeating-linear-gradient(90deg,rgba(255,255,255,.02) 0 1px,transparent 1px 46px);mask-image:linear-gradient(180deg,transparent,#000 18%,#000 70%,transparent);-webkit-mask-image:linear-gradient(180deg,transparent,#000 18%,#000 70%,transparent);}',
'#admHead{position:relative;z-index:1;padding:22px 20px 14px;border-bottom:1px solid rgba(255,255,255,.07);}',
'#admHead .kicker{font-family:' + F_MONO + ';font-size:11px;letter-spacing:.24em;color:#22d3ee;font-weight:700;}',
'#admHead h2{margin:7px 0 0;font-family:' + F_DISPLAY + ';font-size:30px;font-weight:900;letter-spacing:-.02em;color:#f8fafc;line-height:1;}',
'#admHead h2 em{font-style:normal;color:#fbbf24;}',
'#admHead p{margin:9px 0 0;font-size:12px;color:#94a3b8;line-height:1.55;}',
'#admMeta{margin-top:11px;display:flex;align-items:center;gap:8px;font-family:' + F_MONO + ';font-size:10.5px;color:#64748b;}',
'#admMeta .live{width:7px;height:7px;border-radius:50%;background:#4ade80;box-shadow:0 0 8px #4ade80;animation:admBlink 1.4s steps(1) infinite;}',
'#admMeta b{color:#94a3b8;font-weight:700;}',
'#admClose{position:absolute;top:18px;right:16px;width:34px;height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#cbd5e1;font-size:18px;cursor:pointer;transition:background .15s,transform .12s;}',
'#admClose:hover{background:rgba(255,255,255,.12);}#admClose:active{transform:scale(.9);}',
'#admTarget{margin-top:13px;padding:11px 12px;border-radius:12px;background:linear-gradient(180deg,rgba(34,211,238,.06),rgba(34,211,238,.02));border:1px solid rgba(34,211,238,.16);}',
'#admTarget.other{background:linear-gradient(180deg,rgba(245,158,11,.08),rgba(245,158,11,.02));border-color:rgba(245,158,11,.3);}',
'.at-row{display:flex;align-items:center;justify-content:space-between;gap:8px;}',
'.at-label{font-family:' + F_MONO + ';font-size:9.5px;letter-spacing:.18em;color:#64748b;font-weight:700;}',
'.at-cur{font-family:' + F_MONO + ';font-size:11.5px;font-weight:800;color:#7dd3fc;max-width:62%;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
'.at-cur.other{color:#fbbf24;}',
'.at-ctrl{display:flex;gap:6px;margin-top:9px;}',
'#atUid{flex:1;min-width:0;padding:8px 10px;border-radius:9px;border:1.5px solid rgba(94,234,212,.28);background:rgba(4,10,16,.6);color:#f0fdfa;font-size:12px;font-weight:700;font-family:' + F_MONO + ';letter-spacing:.03em;outline:none;transition:border-color .18s,box-shadow .2s;}',
'#atUid:focus{border-color:#2dd4bf;box-shadow:0 0 0 3px rgba(45,212,191,.18);}',
'#atLoad{font-family:' + F_BODY + ';font-size:11.5px;font-weight:800;color:#04150b;background:linear-gradient(135deg,#22d3ee,#0e7490);border:none;border-radius:9px;padding:8px 12px;cursor:pointer;transition:transform .12s,filter .15s;white-space:nowrap;}',
'#atLoad:hover{filter:brightness(1.1);}#atLoad:active{transform:scale(.95);}',
'#atSelf{font-family:' + F_BODY + ';font-size:11.5px;font-weight:700;color:#cbd5e1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:9px;padding:8px 11px;cursor:pointer;transition:background .15s,transform .12s;white-space:nowrap;}',
'#atSelf:hover{background:rgba(255,255,255,.12);}#atSelf:active{transform:scale(.95);}',
'.at-note{margin-top:7px;font-size:10px;color:#94a3b8;line-height:1.4;}',
'#admTarget.other .at-note{color:#fcd34d;}',
'#admList{position:relative;z-index:1;flex:1;overflow-y:auto;padding:14px 16px 28px;-webkit-overflow-scrolling:touch;}',
'.admRow{position:relative;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.012));border:1px solid rgba(255,255,255,.07);border-radius:15px;padding:14px 14px 14px 17px;margin-bottom:11px;overflow:hidden;transition:border-color .2s,transform .12s;opacity:0;}',
'.admRow.in{animation:admIn .45s both;}',
'.admRow::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,#22d3ee,#0e7490);transform:scaleY(0);transform-origin:top;transition:transform .25s;}',
'.admRow:hover{border-color:rgba(34,211,238,.35);transform:translateX(2px);}',
'.admRow:hover::before{transform:scaleY(1);}',
'.admRow.flash{animation:admFlash .85s ease-out;}',
'.admTop{display:flex;align-items:flex-start;gap:12px;}',
'.admIco{font-size:22px;line-height:1;flex:0 0 auto;margin-top:1px;}',
'.admBody{flex:1;min-width:0;}',
'.admName{font-size:14px;font-weight:800;color:#f1f5f9;letter-spacing:.01em;}',
'.admNow{font-family:' + F_MONO + ';font-size:11.5px;color:#5eead4;margin-top:4px;font-weight:700;word-break:break-all;display:flex;align-items:center;gap:6px;}',
'.admNow .tick{display:inline-block;width:13px;height:13px;color:#4ade80;font-size:12px;}',
'.admNow .tick.show{animation:admTick .4s ease-out;}',
'.admDesc{font-size:11px;color:#7c8aa0;margin-top:4px;line-height:1.45;}',
'.admActs{flex:0 0 auto;align-self:center;display:flex;flex-direction:column;gap:6px;}',
'.admBtn{font-family:' + F_BODY + ';font-size:11.5px;font-weight:800;border-radius:9px;padding:7px 12px;cursor:pointer;transition:background .15s,transform .1s,border-color .15s;white-space:nowrap;}',
'.admBtn:active{transform:scale(.93);}',
'.admBtn.edit{color:#7dd3fc;background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.32);}',
'.admBtn.edit:hover{background:rgba(56,189,248,.2);}',
'.admBtn.reset{color:#fda4af;background:rgba(251,113,133,.1);border:1px solid rgba(251,113,133,.32);}',
'.admBtn.reset:hover{background:rgba(251,113,133,.2);}',
'.admConfirm,.admEdit{display:none;margin-top:12px;padding-top:12px;border-top:1px dashed rgba(255,255,255,.12);}',
'.admRow.asking .admConfirm{display:flex;align-items:center;gap:8px;}',
'.admRow.asking .admActs{display:none;}',
'.admRow.editing .admEdit{display:block;animation:admIn .25s both;}',
'.admRow.editing .admActs{display:none;}',
'.admConfirm span{flex:1;font-size:12px;font-weight:700;color:#fecaca;}',
'.admYes{font-family:' + F_BODY + ';font-size:12px;font-weight:800;color:#fff;background:linear-gradient(135deg,#ef4444,#b91c1c);border:none;border-radius:9px;padding:8px 14px;cursor:pointer;}',
'.admNo{font-family:' + F_BODY + ';font-size:12px;font-weight:700;color:#cbd5e1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:9px;padding:8px 12px;cursor:pointer;}',
'.admEdit .lab{font-size:10.5px;font-weight:700;color:#94a3b8;margin-bottom:7px;letter-spacing:.03em;display:flex;align-items:center;gap:7px;}',
'.admEdit .line{display:flex;align-items:center;gap:8px;}',
'.admEdit input[type=number],.admEdit input[type=text]{flex:1;min-width:0;padding:10px 12px;border-radius:10px;border:1.5px solid rgba(94,234,212,.3);background:rgba(4,10,16,.6);color:#f0fdfa;font-size:16px;font-weight:700;font-family:' + F_MONO + ';outline:none;transition:border-color .18s,box-shadow .2s;}',
'.admEdit input:focus{border-color:#2dd4bf;box-shadow:0 0 0 3px rgba(45,212,191,.2);}',
'.admEdit input.ste-pop{animation:stePop .4s ease-out;}',
'.admEdit .unit{font-size:12px;color:#94a3b8;font-weight:700;flex:0 0 auto;}',
'.admEdit .saveRow{display:flex;gap:8px;margin-top:10px;}',
'.admEdit .go{flex:1.3;font-family:' + F_BODY + ';font-size:12.5px;font-weight:800;color:#04150b;background:linear-gradient(135deg,#4ade80,#16a34a);border:none;border-radius:9px;padding:9px;cursor:pointer;}',
'.admEdit .back{flex:1;font-family:' + F_BODY + ';font-size:12.5px;font-weight:700;color:#cbd5e1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:9px;padding:9px;cursor:pointer;}',
'.ste-lvbox{margin-top:11px;padding:10px 11px;border-radius:10px;background:rgba(148,163,184,.05);border:1px dashed rgba(148,163,184,.22);}',
'.ste-lvbox.ready{background:rgba(245,158,11,.05);border-color:rgba(245,158,11,.28);}',
'.ste-lvtag{font-family:' + F_MONO + ';font-size:9px;font-weight:700;letter-spacing:.04em;padding:2px 7px;border-radius:999px;color:#cbd5e1;background:rgba(148,163,184,.14);border:1px solid rgba(148,163,184,.22);}',
'.ste-lvtag.ok{color:#04150b;background:#4ade80;border-color:transparent;}',
'.ste-lvtag.soft{color:#fcd34d;background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.3);}',
'.ste-lvcalc{flex:0 0 auto !important;width:auto !important;font-size:11.5px !important;padding:9px 11px !important;background:linear-gradient(135deg,#f59e0b,#b45309) !important;white-space:nowrap;}',
'.ste-lvcalc:disabled{filter:grayscale(.7) brightness(.7);cursor:not-allowed;}',
'.ste-lvhint{margin-top:7px;font-size:10.5px;line-height:1.4;min-height:14px;color:#94a3b8;}',
'.ste-lvhint.ok{color:#86efac;}.ste-lvhint.soft{color:#fcd34d;}',
'.ste-tt-sec{margin-top:13px;padding-top:11px;border-top:1px dashed rgba(255,255,255,.1);}',
'.ste-tt-sec>.lab{margin-bottom:8px;}',
'.ste-tt-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:11px;padding:10px 11px;margin-bottom:8px;transition:border-color .18s,background .18s;}',
'.ste-tt-card:hover{border-color:rgba(34,211,238,.3);background:rgba(34,211,238,.04);}',
'.ste-tt-card.special{border-color:rgba(245,158,11,.22);background:rgba(245,158,11,.04);}',
'.ste-tt-card.special:hover{border-color:rgba(245,158,11,.4);background:rgba(245,158,11,.07);}',
'.ste-tt-card.bonus{border-color:rgba(45,212,191,.22);background:rgba(45,212,191,.04);}',
'.ste-tt-card.bonus:hover{border-color:rgba(45,212,191,.4);background:rgba(45,212,191,.07);}',
'.ste-tt-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;}',
'.ste-tt-name{font-size:12.5px;font-weight:800;color:#f1f5f9;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
'.ste-tt-rarity{flex:0 0 auto;font-size:9.5px;font-weight:800;padding:2px 8px;border-radius:999px;border:1px solid;letter-spacing:.03em;}',
'.ste-tt-rarity.r0{color:#64748b;border-color:rgba(100,116,139,.3);background:rgba(100,116,139,.08);}',
'.ste-tt-rarity.r1{color:#cbd5e1;border-color:rgba(203,213,225,.35);background:rgba(203,213,225,.08);}',
'.ste-tt-rarity.r2{color:#4ade80;border-color:rgba(74,222,128,.35);background:rgba(74,222,128,.08);}',
'.ste-tt-rarity.r3{color:#38bdf8;border-color:rgba(56,189,248,.35);background:rgba(56,189,248,.08);}',
'.ste-tt-rarity.r4{color:#c084fc;border-color:rgba(192,132,252,.4);background:rgba(192,132,252,.1);}',
'.ste-tt-rarity.r5{color:#fbbf24;border-color:rgba(251,191,36,.45);background:rgba(251,191,36,.1);}',
'.ste-tt-rarity.r6{color:#fff;border-color:rgba(251,191,36,.6);background:linear-gradient(135deg,rgba(251,191,36,.25),rgba(192,132,252,.25));box-shadow:0 0 8px rgba(251,191,36,.4);}',
'.ste-tt-rarity.sp-on{color:#fbbf24;border-color:rgba(251,191,36,.45);background:rgba(251,191,36,.1);}',
'.ste-tt-rarity.sp-off{color:#64748b;border-color:rgba(100,116,139,.3);background:rgba(100,116,139,.08);}',
'.ste-tt-prog{font-size:10.5px;color:#94a3b8;line-height:1.45;margin-bottom:8px;}',
'.ste-tt-prog b{color:#5eead4;font-family:' + F_MONO + ';font-weight:800;}',
'.ste-tt-acts{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}',
'.ste-tt-inp{width:74px;padding:6px 8px;border-radius:8px;border:1.5px solid rgba(94,234,212,.28);background:rgba(4,10,16,.6);color:#f0fdfa;font-size:12px;font-weight:700;font-family:' + F_MONO + ';outline:none;transition:border-color .18s;}',
'.ste-tt-inp:focus{border-color:#2dd4bf;}',
'.ste-tt-mini{flex:0 0 auto;font-family:' + F_BODY + ';font-size:10.5px;font-weight:700;color:#fda4af;background:rgba(251,113,133,.1);border:1px solid rgba(251,113,133,.3);border-radius:7px;padding:4px 8px;cursor:pointer;transition:background .15s,transform .1s;}',
'.ste-tt-mini:hover{background:rgba(251,113,133,.2);}.ste-tt-mini:active{transform:scale(.93);}',
'.ste-tt-mini.cyan{color:#7dd3fc;background:rgba(56,189,248,.1);border-color:rgba(56,189,248,.32);}',
'.ste-tt-mini.cyan:hover{background:rgba(56,189,248,.2);}',
'.ste-tt-mini.gold{color:#fbbf24;background:rgba(251,191,36,.1);border-color:rgba(251,191,36,.35);}',
'.ste-tt-mini.gold:hover{background:rgba(251,191,36,.2);}',
'.ste-tt-cfg{display:none;margin-top:9px;padding:9px;border-radius:9px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.08);}',
'.ste-tt-cfg.open{display:block;}',
'.ste-tt-cfg .lab2{font-size:9.5px;font-weight:800;color:#94a3b8;letter-spacing:.04em;margin:8px 0 5px;}',
'.ste-tt-cfg .lab2:first-child{margin-top:0;}',
'.ste-tt-cfg-row{display:flex;align-items:center;gap:6px;margin-bottom:6px;padding:7px 8px;border-radius:8px;background:rgba(255,255,255,.03);flex-wrap:nowrap;}',
'.ste-tt-cfg-row .rk{flex:0 0 auto;min-width:50px;font-size:10px;font-weight:800;color:#e2e8f0;font-family:' + F_MONO + ';}',
'.ste-tt-cfg-inp{flex:0 0 auto;width:62px;padding:6px 6px;border-radius:7px;border:1.5px solid rgba(94,234,212,.25);background:rgba(4,10,16,.6);color:#f0fdfa;font-size:12px;font-weight:700;font-family:' + F_MONO + ';outline:none;text-align:center;}',
'.ste-tt-cfg-inp:focus{border-color:#2dd4bf;}',
'.ste-tt-cfg-unit{flex:0 0 auto;font-size:9px;color:#64748b;}',
'.ste-tt-ext{display:none;margin-top:8px;padding:8px 9px;border-radius:8px;background:rgba(192,132,252,.05);border:1px solid rgba(192,132,252,.18);font-size:9.5px;color:#c4b5fd;line-height:1.55;}',
'.ste-tt-ext.open{display:block;}',
'.ste-tt-ext b{color:#fbbf24;font-family:' + F_MONO + ';}',
'.ste-tt-ext-toggle{margin-top:8px;width:100%;text-align:center;}',
'.ste-tt-ext-note{margin-top:8px;padding:7px 9px;border-radius:8px;background:rgba(45,212,191,.05);border:1px solid rgba(45,212,191,.18);font-size:9.5px;color:#7dd3fc;line-height:1.5;}',
'.ste-tt-row2{display:flex;flex-wrap:wrap;align-items:center;gap:7px;padding:7px 8px;border-radius:9px;background:rgba(255,255,255,.03);margin-bottom:6px;}',
'.ste-tt-row2 .k{font-family:' + F_MONO + ';font-size:11px;color:#cbd5e1;font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
'.ste-tt-row2 button{font-family:' + F_BODY + ';font-size:10.5px;font-weight:700;border-radius:7px;padding:5px 9px;cursor:pointer;border:1px solid rgba(251,113,133,.3);background:rgba(251,113,133,.1);color:#fda4af;transition:background .15s,transform .1s;flex:0 0 auto;}',
'.ste-tt-row2 button:hover{background:rgba(251,113,133,.2);}.ste-tt-row2 button:active{transform:scale(.94);}',
'.ste-tt-note{margin-top:10px;font-size:10px;color:#94a3b8;line-height:1.45;}',
'.ste-tt-emptymsg{font-size:10.5px;color:#64748b;padding:4px 2px;}',
'.ste-tt-clearbtn{flex:0 0 auto !important;width:auto !important;font-size:11.5px !important;padding:9px 11px !important;white-space:nowrap;}',
'.admWeek{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;}',
'.admWeek .cell{display:flex;flex-direction:column;align-items:center;gap:4px;}',
'.admWeek .cell label{font-size:9.5px;color:#7c8aa0;font-weight:700;}',
'.admWeek .cell input{width:100%;padding:8px 2px;border-radius:8px;border:1.5px solid rgba(94,234,212,.28);background:rgba(4,10,16,.6);color:#f0fdfa;font-size:13px;font-weight:700;text-align:center;font-family:' + F_MONO + ';outline:none;}',
'.admWeek .cell input:focus{border-color:#2dd4bf;}',
'.admWeek .cell.today label{color:#4ade80;}',
'.admAll{background:linear-gradient(165deg,rgba(60,8,20,.55),rgba(30,6,16,.6));border-color:rgba(244,63,94,.4);box-shadow:0 0 18px rgba(244,63,94,.18),inset 0 0 22px rgba(244,63,94,.06);}',
'.admAll::before{background:linear-gradient(180deg,#fb7185,#9f1239);}',
'.admAll .admName{color:#ffe4e6;}.admAll .admDesc{color:#fda4af;}',
'.admAll .admBtn.reset{color:#fff;background:linear-gradient(135deg,#f43f5e,#9f1239);border-color:rgba(244,63,94,.6);box-shadow:0 4px 14px rgba(244,63,94,.35);}',
'.admAll .admBtn.reset:hover{filter:brightness(1.12);}',
'#admList::-webkit-scrollbar{width:8px;}#admList::-webkit-scrollbar-thumb{background:rgba(34,211,238,.22);border-radius:8px;}',
// 全ユーザー消去オーバーレイ
'@keyframes waIn{from{opacity:0;transform:scale(.94) translateY(10px)}to{opacity:1;transform:none}}',
'@keyframes waPulse{0%,100%{box-shadow:0 0 0 0 rgba(244,63,94,.5)}50%{box-shadow:0 0 0 14px rgba(244,63,94,0)}}',
'@keyframes waSpin{to{transform:rotate(360deg)}}',
'@keyframes waCheck{0%{transform:scale(0) rotate(-30deg);opacity:0}60%{transform:scale(1.25) rotate(0);opacity:1}100%{transform:scale(1)}}',
'@keyframes waBarGlow{0%,100%{box-shadow:0 0 8px rgba(244,63,94,.4)}50%{box-shadow:0 0 18px rgba(244,63,94,.8)}}',
'#waOverlay{position:fixed;inset:0;z-index:10002;display:none;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 30%,rgba(60,8,20,.78),rgba(8,4,10,.92));backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);opacity:0;transition:opacity .3s;}',
'#waOverlay.open{display:flex;opacity:1;}',
'.wa-card{position:relative;width:min(380px,92vw);border-radius:22px;padding:26px 24px 22px;overflow:hidden;background:linear-gradient(168deg,#2a0e18 0%,#160a12 70%);border:1px solid rgba(244,63,94,.4);box-shadow:0 30px 80px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.06);animation:waIn .4s cubic-bezier(.2,.9,.3,1.2);}',
'.wa-card::before{content:"";position:absolute;inset:-40%;background:radial-gradient(circle at 30% 20%,rgba(244,63,94,.18),transparent 55%),radial-gradient(circle at 80% 80%,rgba(192,132,252,.12),transparent 55%);pointer-events:none;}',
'.wa-ico{position:relative;width:58px;height:58px;margin:0 auto 14px;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:30px;background:linear-gradient(135deg,rgba(244,63,94,.25),rgba(159,18,57,.25));border:1px solid rgba(244,63,94,.5);animation:waPulse 2.4s ease-in-out infinite;}',
'.wa-title{position:relative;text-align:center;font-family:' + F_DISPLAY + ';font-size:21px;font-weight:900;color:#fff;letter-spacing:.3px;text-shadow:0 0 14px rgba(244,63,94,.4);}',
'.wa-sub{position:relative;text-align:center;font-size:12px;color:#fda4af;line-height:1.6;margin:8px 0 16px;font-weight:600;}',
'.wa-keep{position:relative;display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin-bottom:18px;}',
'.wa-keep span{font-size:9.5px;font-weight:800;color:#a7f3d0;background:rgba(16,185,129,.12);border:1px solid rgba(52,211,153,.32);padding:3px 9px;border-radius:999px;}',
'.wa-wipe{position:relative;display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin-bottom:18px;}',
'.wa-wipe span{font-size:9.5px;font-weight:800;color:#fecdd3;background:rgba(244,63,94,.12);border:1px solid rgba(251,113,133,.32);padding:3px 9px;border-radius:999px;}',
'.wa-progress{position:relative;display:none;margin-bottom:16px;}',
'.wa-progress.show{display:block;}',
'.wa-bar{height:10px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;border:1px solid rgba(244,63,94,.25);}',
'.wa-fill{height:100%;width:0;border-radius:999px;background:linear-gradient(90deg,#fb7185,#f43f5e,#9f1239);transition:width .3s ease;animation:waBarGlow 1.6s ease-in-out infinite;}',
'.wa-ptext{display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:11px;font-weight:800;color:#fda4af;font-family:' + F_MONO + ';}',
'.wa-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,.25);border-top-color:#fb7185;border-radius:50%;animation:waSpin .8s linear infinite;}',
'.wa-done{position:relative;display:none;text-align:center;}',
'.wa-done.show{display:block;animation:waIn .4s ease;}',
'.wa-check{width:64px;height:64px;margin:0 auto 12px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:34px;color:#04150b;background:linear-gradient(135deg,#4ade80,#16a34a);box-shadow:0 0 24px rgba(34,197,94,.5);animation:waCheck .5s cubic-bezier(.2,1.4,.4,1);}',
'.wa-done-txt{font-size:15px;font-weight:900;color:#86efac;text-shadow:0 0 10px rgba(34,197,94,.4);}',
'.wa-done-sub{font-size:11px;color:#94a3b8;margin-top:5px;font-weight:600;}',
'.wa-actions{position:relative;display:flex;gap:10px;}',
'.wa-no{flex:1;padding:12px 0;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#e2e8f0;font-family:' + F_BODY + ';font-size:13px;font-weight:700;cursor:pointer;transition:background .15s,transform .1s;}',
'.wa-no:hover{background:rgba(255,255,255,.12);}.wa-no:active{transform:scale(.96);}',
'.wa-yes{flex:1.4;padding:12px 0;border-radius:12px;border:none;background:linear-gradient(135deg,#f43f5e,#9f1239);color:#fff;font-family:' + F_BODY + ';font-size:13px;font-weight:900;cursor:pointer;box-shadow:0 6px 20px rgba(244,63,94,.4);transition:transform .12s,filter .15s;}',
'.wa-yes:hover{filter:brightness(1.1);}.wa-yes:active{transform:scale(.97);}',
'.wa-yes.final{background:linear-gradient(135deg,#fb7185,#be123c);animation:waPulse 1.8s ease-in-out infinite;}'
].join('\n'); document.head.appendChild(s); }
var liveTimer = null;
function buildPanel() {
if (document.getElementById('admPanel')) return; injectStyle();
var scrim = document.createElement('div'); scrim.id = 'admScrim'; scrim.onclick = closePanel; document.body.appendChild(scrim);
var panel = document.createElement('div'); panel.id = 'admPanel';
panel.innerHTML = '<div class="mesh"><i class="a"></i><i class="b"></i></div><div class="grid"></div><div id="admHead"><button id="admClose" type="button">✕</button><div class="kicker">ADMIN · DATA CONTROL</div><h2>データ<em>管理</em></h2><p>項目ごとに「いまの値」を確認してから、編集もリセットもできます。</p><div id="admTarget"><div class="at-row"><span class="at-label">EDIT TARGET</span><span class="at-cur" id="atCur">自分（ログイン中）</span></div><div class="at-ctrl"><input id="atUid" type="text" placeholder="ユーザーID（例 KYPLDVN860）" autocomplete="off" spellcheck="false"><button id="atLoad" type="button">読み込む</button><button id="atSelf" type="button" style="display:none">自分に戻る</button></div><div class="at-note" id="atNote"></div></div><div id="admMeta"><span class="live"></span><span>LIVE</span><span>·</span><b id="admUid">-</b><span>·</span><b id="admClock">--:--:--</b></div></div><div id="admList"></div>';
document.body.appendChild(panel);
document.getElementById('admClose').onclick = closePanel;
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanel(); });
document.getElementById('atLoad').onclick = doLoadOther;
document.getElementById('atSelf').onclick = setSelf;
document.getElementById('atUid').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doLoadOther(); } });
}
function doLoadOther() {
var uidIn = document.getElementById('atUid'); var uid = (uidIn.value || '').trim();
if (!uid) { toast('ユーザーIDを入力してください'); return; }
if (uid === (selfMyId() || '')) { toast('自分自身です。対象を戻します'); setSelf(); return; }
var btn = document.getElementById('atLoad'); btn.disabled = true; btn.textContent = '読込中…';
netReadOf(uid).then(function (net) { btn.disabled = false; btn.textContent = '読み込む'; if (!net) { toast('そのIDのデータが見つかりません（Firestore）'); return; } window.__admTarget = { mode: 'other', uid: uid, snap: mapNetToSnap(net, uid) }; refreshTargetUI(); renderRows(); toast(uid + ' のデータを読み込みました'); });
}
function setSelf() { window.__admTarget = { mode: 'self', uid: null, snap: null }; var uidIn = document.getElementById('atUid'); if (uidIn) uidIn.value = ''; refreshTargetUI(); renderRows(); loadMyData(); }
function refreshTargetUI() {
var box = document.getElementById('admTarget'); if (!box) return;
var cur = document.getElementById('atCur'), self = document.getElementById('atSelf'), note = document.getElementById('atNote');
if (isOther()) { box.classList.add('other'); cur.classList.add('other'); cur.textContent = '編集中：' + T().uid; self.style.display = ''; note.textContent = 'クラウド (users/' + T().uid + ') を直接編集。保存は即反映。ログインし直さなくてOK。'; }
else { box.classList.remove('other'); cur.classList.remove('other'); cur.textContent = '自分（ログイン中）'; self.style.display = 'none'; note.textContent = '他のユーザーを編集するにはIDを入力して「読み込む」。'; }
}
function buildEditForm(it) {
if (!it.edit) return '';
var e = it.edit;
if (e.type === 'exp') {
return '<div class="admEdit"><div class="lab">経験値を直接入力</div><div class="line"><input type="number" inputmode="numeric" min="0" data-val="1"><span class="unit">XP</span></div><div class="ste-lvbox" data-lvbox="1"><div class="lab">レベルから算出 <span class="ste-lvtag" data-lvtag="1"></span></div><div class="line"><input type="number" inputmode="numeric" min="1" max="9999" data-lv="1" placeholder="Lv"><span class="unit">Lv</span><button type="button" class="go ste-lvcalc" data-lvcalc="1">このLvのEXPにする</button></div><div class="ste-lvhint" data-lvhint="1"></div></div><div class="saveRow"><button class="back" type="button">やめる</button><button class="go" type="button">保存</button></div></div>';
}
if (e.type === 'title') {
return '<div class="admEdit">' +
'<div class="lab">表示中の称号</div>' +
'<div class="line"><input type="text" data-val="1" maxlength="40"><button type="button" class="back ste-tt-clearbtn" data-tt-clear="1">称号なし</button></div>' +
'<div class="ste-tt-sec"><div class="lab">🎁 報酬XP — 全称号共通・レア度ごと</div><div data-tt-bonuscommon="1"></div></div>' +
'<div class="ste-tt-sec"><div class="lab">進化称号 — 進捗 / 未取得化 / 獲得条件の編集</div><div data-tt-progress="1"></div></div>' +
'<div class="ste-tt-sec"><div class="lab">特別称号</div><div data-tt-special="1"></div></div>' +
'<div class="ste-tt-sec"><div class="lab">シーズン称号</div><div data-tt-season="1"></div></div>' +
'<div class="ste-tt-note">※「🎁 報酬XP」はレア度ごとに全局所・全ユーザー共通で決まります。各称号の「⚙️ 獲得条件」は必要量のみ（称号ごと）。<br>※「未取得にする」は進捗を0にし獲得フラグも消すので再取得できます。他ユーザー編集中は進捗のみリセット可（獲得フラグは端末ごと）。</div>' +
'<div class="saveRow"><button class="back" type="button">やめる</button><button class="go" type="button">表示称号を保存</button></div></div>';
}
if (e.type === 'week') {
var labels = ['月', '火', '水', '木', '金', '土', '日']; var now = new Date(), cur = now.getDay() - 1; if (cur < 0) cur = 6; var cells = '';
for (var i = 0; i < 7; i++) cells += '<div class="cell' + (i === cur ? ' today' : '') + '"><label>' + labels[i] + '</label><input type="number" inputmode="numeric" min="0" max="1440" data-wi="' + i + '"></div>';
return '<div class="admEdit"><div class="lab">各曜日の勉強時間（分）</div><div class="admWeek">' + cells + '</div><div class="saveRow"><button class="back" type="button">やめる</button><button class="go" type="button">保存</button></div></div>';
}
var inp = e.type === 'number' ? '<input type="number" inputmode="numeric" min="0" data-val="1">' : '<input type="text" data-val="1" maxlength="40">';
return '<div class="admEdit"><div class="lab">新しい値</div><div class="line">' + inp + (e.unit ? '<span class="unit">' + esc(e.unit) + '</span>' : '') + '</div><div class="saveRow"><button class="back" type="button">やめる</button><button class="go" type="button">保存</button></div></div>';
}
function persistRow(row, it, msg) { if (isOther()) saveOther(); else if (window.saveUserStats) window.saveUserStats(); else saveMyData(); flashRow(row); toast(msg); }
function buildBonusCommonEditor(row, it) {
var box = row.querySelector('[data-tt-bonuscommon]'); if (!box) return; box.innerHTML = '';
var bc = bonusesCommon().slice();
var card = document.createElement('div'); card.className = 'ste-tt-card bonus';
var rows = '';
for (var i = 0; i < 5; i++) { rows += '<div class="ste-tt-cfg-row"><span class="rk">' + esc(RARITY_SHORT[i]) + '</span><span style="flex:0 0 auto;font-size:8.5px;font-weight:700;color:#7c8aa0;">報酬</span><input type="number" class="ste-tt-cfg-inp" data-bc="' + i + '" min="0" value="' + esc(String(bc[i])) + '"><span class="ste-tt-cfg-unit">XP</span></div>'; }
card.innerHTML = '<div class="lab2">レア度ごとの報酬XP（すべての称号に適用）</div>' + rows + '<div class="ste-tt-ext-note">※レジェンダリー超え（＋/＋＋/＋＋＋…）の報酬は、ここで設定したレジェンダリーの値と同じになります。必要な量は×2ずつ自動延伸。</div><div class="ste-tt-acts" style="margin-top:8px;"><button type="button" class="ste-tt-mini cyan" data-bc-save="1">配信して保存</button><button type="button" class="ste-tt-mini" data-bc-reset="1">規定値に戻す</button></div>';
function readBc() { var a = []; for (var j = 0; j < 5; j++) a[j] = clampInt(parseInt(card.querySelector('[data-bc="' + j + '"]').value, 10)); return a; }
card.querySelector('[data-bc-save]').onclick = function () { var a = readBc(); commitBonusesCommon(a).then(function () { toast('報酬XP（全称号共通）を配信しました ✓'); buildBonusCommonEditor(row, it); }); };
card.querySelector('[data-bc-reset]').onclick = function () { resetBonusesCommon().then(function () { toast('報酬XPを規定値に戻しました ✓'); buildBonusCommonEditor(row, it); }); };
box.appendChild(card);
}
function buildTitleEditor(row, it) {
var stats = readStats(); var DB = titleDB(); var SP = specialDB();
buildBonusCommonEditor(row, it);
var pbox = row.querySelector('[data-tt-progress]');
if (pbox) {
pbox.innerHTML = '';
if (DB.length === 0) { pbox.innerHTML = '<div class="ste-tt-emptymsg">称号データ（TITLE_DATABASE）が見つかりませんでした。</div>'; }
else {
DB.forEach(function (t) {
var val = stats[t.id] || 0; var step = reachedStepOf(t, val); var rar = rarityLabelOf(step); var st = stepsOf(t); var nextTarget = step > 0 ? thresholdOfStep(t, step + 1) : st[0];
var card = document.createElement('div'); card.className = 'ste-tt-card';
var cfgRows = '';
for (var i = 0; i < 5; i++) { cfgRows += '<div class="ste-tt-cfg-row"><span class="rk">' + esc(RARITY_SHORT[i]) + '</span><span style="flex:0 0 auto;font-size:8.5px;font-weight:700;color:#7c8aa0;">必要</span><input type="number" class="ste-tt-cfg-inp" data-cfg-step="' + i + '" min="0" value="' + esc(String(st[i])) + '">' + (t.unit ? '<span class="ste-tt-cfg-unit">' + esc(t.unit) + '</span>' : '') + '</div>'; }
card.innerHTML = '<div class="ste-tt-card-top"><span class="ste-tt-name">' + esc(t.name) + '</span><span class="ste-tt-rarity ' + rarityClassOf(step) + '">' + esc(rar) + '</span></div>' +
'<div class="ste-tt-prog">進捗 <b>' + esc(String(val)) + '</b> / 次の目標 ' + esc(String(nextTarget)) + esc(t.unit || '') + '</div>' +
'<div class="ste-tt-acts"><input type="number" class="ste-tt-inp" min="0" value="' + esc(String(val)) + '"><button type="button" class="ste-tt-mini cyan">進捗を設定</button><button type="button" class="ste-tt-mini">未取得にする</button><button type="button" class="ste-tt-mini gold" data-cfg-toggle="1">⚙️ 獲得条件</button></div>' +
'<div class="ste-tt-cfg" data-cfg-box="1"><div class="lab2">獲得に必要な量（1行 = 1レアリティ・この称号のみ）</div>' + cfgRows +
'<button type="button" class="ste-tt-mini cyan ste-tt-ext-toggle" data-cfg-exttoggle="1">▶ レジェンダリー超えの必要量を見る</button><div class="ste-tt-ext" data-cfg-ext="1"></div>' +
'<div class="ste-tt-acts" style="margin-top:8px;"><button type="button" class="ste-tt-mini cyan" data-cfg-save="1">配信して保存</button><button type="button" class="ste-tt-mini" data-cfg-reset="1">規定値に戻す</button></div></div>';
var inp = card.querySelector('.ste-tt-inp'); var btns = card.querySelectorAll('.ste-tt-acts > .ste-tt-mini');
btns[0].onclick = function () { var v = clampInt(parseInt(inp.value, 10)); editStats(function (s) { s[t.id] = v; }); if (!isOther() && window.checkAndRewardTitleBonusXP) { try { window.checkAndRewardTitleBonusXP(); } catch (e) {} } persistRow(row, it, t.name + ' の進捗を ' + v + ' に設定 ✓'); buildTitleEditor(row, it); };
btns[1].onclick = function () { editStats(function (s) { s[t.id] = 0; }); clearRewarded(t.id); maybeResetEquipped(t.name); persistRow(row, it, t.name + ' を未取得にしました ✓'); buildTitleEditor(row, it); };
var cfgBox = card.querySelector('[data-cfg-box]');
btns[2].onclick = function () { cfgBox.classList.toggle('open'); };
function readCfgSteps() { var sa = []; for (var j = 0; j < 5; j++) sa[j] = clampInt(parseInt(card.querySelector('[data-cfg-step="' + j + '"]').value, 10)); return sa; }
function paintExt() { var sa = readCfgSteps(); var base = sa[4]; var bxp = bonusesCommon()[4]; var ext = card.querySelector('[data-cfg-ext]'); var lines = ''; for (var k = 1; k <= 3; k++) { var thr = Math.floor(base * Math.pow(2, k)); lines += '【レジェンダリー' + plusStr(k) + '】 必要量 <b>' + thr + '</b>' + (t.unit || '') + ' / ボナス <b>' + bxp + '</b>XP<br>'; } ext.innerHTML = '📈 レジェンダリー超え（必要量は×2ずつ／XPは上の「🎁 報酬XP」のレジェンダリー値と同額）：<br>' + lines + '<span style="opacity:.7;">＋はさらに×2ずつ無限に延伸します。</span>'; }
card.querySelectorAll('[data-cfg-step]').forEach(function (el) { el.addEventListener('input', function () { var ext = card.querySelector('[data-cfg-ext]'); if (ext && ext.classList.contains('open')) paintExt(); }); });
var extToggle = card.querySelector('[data-cfg-exttoggle]'); var extBox = card.querySelector('[data-cfg-ext]');
extToggle.onclick = function () { var open = extBox.classList.toggle('open'); extToggle.innerText = open ? '▼ レジェンダリー超えの必要量を隠す' : '▶ レジェンダリー超えの必要量を見る'; if (open) paintExt(); };
card.querySelector('[data-cfg-save]').onclick = function () { var sa = readCfgSteps(); commitTitleSteps(t.id, sa).then(function () { toast('「' + t.name + '」の獲得条件を全ユーザーに配信しました ✓'); buildTitleEditor(row, it); }); };
card.querySelector('[data-cfg-reset]').onclick = function () { resetTitleSteps(t.id).then(function () { toast('「' + t.name + '」の獲得条件を規定値に戻しました ✓'); buildTitleEditor(row, it); }); };
pbox.appendChild(card);
});
}
}
var ubox = row.querySelector('[data-tt-special]');
if (ubox) {
ubox.innerHTML = '';
if (SP.length === 0) { ubox.innerHTML = '<div class="ste-tt-emptymsg">特別称号が見つかりませんでした。</div>'; }
else { SP.forEach(function (sp) { var earned = isSpecialEarned(sp, stats); var card = document.createElement('div'); card.className = 'ste-tt-card special'; card.innerHTML = '<div class="ste-tt-card-top"><span class="ste-tt-name">【特別】' + esc(sp.name) + '</span><span class="ste-tt-rarity ' + (earned ? 'sp-on' : 'sp-off') + '">' + (earned ? '獲得済み' : '未獲得') + '</span></div><div class="ste-tt-prog">' + esc(sp.desc || '') + '</div><div class="ste-tt-acts"><button type="button" class="ste-tt-mini">未取得にする</button></div>'; card.querySelector('.ste-tt-mini').onclick = function () { clearRewarded(sp.id); if (sp.id === 'weekly_rank') editStats(function (s) { s.weekly_rank_first = false; }); maybeResetEquipped(sp.name); persistRow(row, it, '【特別】' + sp.name + ' を未取得にしました ✓'); buildTitleEditor(row, it); }; ubox.appendChild(card); }); }
}
var sbox = row.querySelector('[data-tt-season]');
if (sbox) {
sbox.innerHTML = ''; var seasonArr = stats.seasonTitles || [];
if (!Array.isArray(seasonArr) || seasonArr.length === 0) { sbox.innerHTML = '<div class="ste-tt-emptymsg">獲得済みのシーズン称号はありません。</div>'; }
else { seasonArr.forEach(function (stName, idx) { var r2 = document.createElement('div'); r2.className = 'ste-tt-row2'; r2.innerHTML = '<span class="k">' + esc(String(stName)) + '</span><button type="button">外す</button>'; r2.querySelector('button').onclick = function () { editStats(function (s) { var arr = Array.isArray(s.seasonTitles) ? s.seasonTitles.slice() : []; arr.splice(idx, 1); s.seasonTitles = arr; }); maybeResetEquipped(String(stName)); persistRow(row, it, 'シーズン称号を外しました ✓'); buildTitleEditor(row, it); }; sbox.appendChild(r2); }); }
}
}
function fillEditInputs(row, it) {
if (!it.edit) return;
if (it.edit.type === 'exp') {
var v = it.edit.get(); var el = row.querySelector('[data-val]'); if (el) el.value = (v == null ? '' : v);
var lvIn = row.querySelector('[data-lv]'); if (lvIn) lvIn.value = '';
var tag = row.querySelector('[data-lvtag]'), hint = row.querySelector('[data-lvhint]'), box = row.querySelector('[data-lvbox]'), calc = row.querySelector('[data-lvcalc]');
var rev = canReverse();
if (rev) { if (box) box.classList.add('ready'); if (tag) { tag.className = 'ste-lvtag ok'; tag.textContent = '本体の式'; } if (calc) calc.disabled = false; if (hint) { hint.className = 'ste-lvhint'; hint.textContent = 'レベルを入れると、アプリ本体の計算でEXPを逆算します。'; } }
else { if (box) box.classList.remove('ready'); if (tag) { tag.className = 'ste-lvtag soft'; tag.textContent = '式未取得'; } if (calc) calc.disabled = true; if (hint) { hint.className = 'ste-lvhint soft'; hint.textContent = '本体の計算式が見つかりません。経験値は直接入力できます。'; } }
setTimeout(function () { try { el && el.focus(); } catch (e) {} }, 30); return;
}
if (it.edit.type === 'title') { var el2 = row.querySelector('[data-val]'); if (el2) el2.value = (it.edit.get() || ''); var clr = row.querySelector('[data-tt-clear]'); if (clr) clr.onclick = function () { if (el2) el2.value = ''; }; buildTitleEditor(row, it); setTimeout(function () { try { el2 && el2.focus(); } catch (e) {} }, 30); return; }
if (it.edit.type === 'week') { var arr = it.edit.get(); var ins = row.querySelectorAll('.admWeek input'); for (var i = 0; i < ins.length; i++) ins[i].value = arr[i] || 0; return; }
var vv = it.edit.get(); var el3 = row.querySelector('[data-val]'); if (el3) { el3.value = (vv == null ? '' : vv); setTimeout(function () { try { el3.focus(); el3.select && el3.select(); } catch (e) {} }, 30); }
}
function readEditInputs(row, it) {
if (it.edit.type === 'exp' || it.edit.type === 'number') { var el = row.querySelector('[data-val]'); return el ? clampInt(parseInt(el.value, 10)) : 0; }
if (it.edit.type === 'week') { var ins = row.querySelectorAll('.admWeek input'), arr = []; for (var i = 0; i < 7; i++) arr[i] = clampMin(parseInt(ins[i].value, 10)); return arr; }
var el3 = row.querySelector('[data-val]'); return el3 ? el3.value : '';
}
var io = null;
function renderRows() {
var list = document.getElementById('admList'); if (!list) return; list.innerHTML = '';
var its = items();
its.forEach(function (it, idx) {
var row = document.createElement('div'); row.className = 'admRow'; row.setAttribute('data-idx', idx);
var nowTxt = ''; try { nowTxt = it.now(); } catch (e) { nowTxt = '-'; }
var acts = '<div class="admActs">'; if (it.edit) acts += '<button class="admBtn edit" type="button">編集</button>'; acts += '<button class="admBtn reset" type="button">リセット</button></div>';
row.innerHTML = '<div class="admTop"><div class="admIco">' + it.icon + '</div><div class="admBody"><div class="admName">' + esc(it.name) + '</div><div class="admNow" data-now="1"><span class="tick"></span><span class="val">' + esc(nowTxt) + '</span></div><div class="admDesc">' + esc(it.desc) + '</div></div>' + acts + '</div>' + buildEditForm(it) + '<div class="admConfirm"><span>本当にリセットしますか？</span><button class="admNo" type="button">やめる</button><button class="admYes" type="button">リセット</button></div>';
var editBtn = row.querySelector('.admBtn.edit'); if (editBtn) editBtn.onclick = function () { row.classList.remove('asking'); row.classList.add('editing'); fillEditInputs(row, it); };
row.querySelector('.admBtn.reset').onclick = function () { row.classList.remove('editing'); row.classList.add('asking'); };
row.querySelector('.admNo').onclick = function () { row.classList.remove('asking'); };
row.querySelector('.admYes').onclick = function () { try { it.reset(); } catch (e) {} afterChange(row, it, it.name + ' をリセットしました ✓'); };
var back = row.querySelector('.admEdit .saveRow .back'); if (back) back.onclick = function () { row.classList.remove('editing'); };
var go = row.querySelector('.admEdit .saveRow .go'); if (go) go.onclick = function () { var val = readEditInputs(row, it); try { it.edit.set(val); } catch (e) {} afterChange(row, it, it.name + ' を更新しました ✓'); };
var numInp = row.querySelector('.admEdit input[type=number][data-val]'); if (numInp) numInp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go && go.click(); } });
var lvCalc = row.querySelector('[data-lvcalc]');
if (lvCalc) lvCalc.onclick = function () { if (lvCalc.disabled) return; var lvIn = row.querySelector('[data-lv]'); var hint = row.querySelector('[data-lvhint]'); var valIn = row.querySelector('[data-val]'); var L = parseInt(lvIn.value, 10); if (!isFinite(L) || L < 1) { hint.className = 'ste-lvhint soft'; hint.textContent = 'レベルを1以上で入力してください。'; return; } var exp = expForLevel(L); if (exp == null) { hint.className = 'ste-lvhint soft'; hint.textContent = 'そのレベルのEXPを求められませんでした（範囲外の可能性）。'; return; } valIn.value = exp; valIn.classList.remove('ste-pop'); void valIn.offsetWidth; valIn.classList.add('ste-pop'); hint.className = 'ste-lvhint ok'; hint.textContent = '✓ Lv ' + L + ' = ' + exp.toLocaleString() + ' XP を入力欄に反映（保存で確定）'; };
var lvIn2 = row.querySelector('[data-lv]'); if (lvIn2) lvIn2.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); lvCalc && lvCalc.click(); } });
list.appendChild(row);
});
// 全部まとめてリセット ＝ 全ユーザー一括消去（自分含む）
var all = document.createElement('div'); all.className = 'admRow admAll'; all.setAttribute('data-idx', 'all');
all.innerHTML = '<div class="admTop"><div class="admIco">☢️</div><div class="admBody"><div class="admName">全ユーザーの履歴を一括消去</div><div class="admNow" data-now="1"><span class="tick"></span><span class="val">自分＋全員</span></div><div class="admDesc">勉強に関係ない派生データを全ユーザーぶん消去します。単語・長文・プロフィールは全員ぶん保持。元に戻せません。</div></div><div class="admActs"><button class="admBtn reset" type="button">一括消去</button></div></div>';
all.querySelector('.admBtn.reset').onclick = function () { openWipeAllOverlay(); };
list.appendChild(all); revealRows();
}
function afterChange(row, it, msg) { row.classList.remove('asking', 'editing'); if (isOther()) saveOther(); else if (window.saveUserStats) window.saveUserStats(); else saveMyData(); refreshDisplay(); if (it) { var nv = ''; try { nv = it.now(); } catch (e) {} var vEl = row.querySelector('.admNow .val'); if (vEl) vEl.innerText = nv; } flashRow(row); toast(msg); }
function flashRow(row) { row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); var tk = row.querySelector('.admNow .tick'); if (tk) { tk.innerText = '✓'; tk.classList.remove('show'); void tk.offsetWidth; tk.classList.add('show'); setTimeout(function () { tk.innerText = ''; }, 1400); } }
function revealRows() { var list = document.getElementById('admList'); if (!list) return; var rows = list.querySelectorAll('.admRow:not(.in)'); if (!('IntersectionObserver' in window)) { rows.forEach(function (r) { r.classList.add('in'); }); return; } if (!io) io = new IntersectionObserver(function (entries) { entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }); }, { root: list, threshold: 0.12 }); rows.forEach(function (r, i) { r.style.animationDelay = (i * 0.04) + 's'; io.observe(r); }); }
function refreshNowValues() {
var list = document.getElementById('admList'); if (!list) return; var its = items();
list.querySelectorAll('.admRow[data-idx]').forEach(function (row) { if (row.classList.contains('asking') || row.classList.contains('editing')) return; var idx = row.getAttribute('data-idx'); if (idx === 'all') return; var it = its[parseInt(idx, 10)]; if (!it) return; var vEl = row.querySelector('.admNow .val'); if (!vEl) return; var nv = ''; try { nv = it.now(); } catch (e) { return; } if (vEl.innerText !== nv) vEl.innerText = nv; });
var c = document.getElementById('admClock'); if (c) { var d = new Date(); c.innerText = [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (n) { return String(n).padStart(2, '0'); }).join(':'); }
var u = document.getElementById('admUid'); if (u) { var id = myId(); u.innerText = id ? ('UID ' + id.slice(0, 6) + '…') : (isOther() ? '他ユーザー編集中' : '未ログイン'); }
}
function openPanel() { buildPanel(); var tg = document.getElementById('admTarget'); if (tg) tg.style.display = isAdmin() ? '' : 'none'; refreshTargetUI(); renderRows(); document.getElementById('admScrim').classList.add('open'); document.getElementById('admPanel').classList.add('open'); refreshNowValues(); if (liveTimer) clearInterval(liveTimer); liveTimer = setInterval(refreshNowValues, 1000); }
function closePanel() { var s = document.getElementById('admScrim'), p = document.getElementById('admPanel'); if (s) s.classList.remove('open'); if (p) p.classList.remove('open'); if (liveTimer) { clearInterval(liveTimer); liveTimer = null; } }

// ---- 全ユーザー消去オーバーレイ ----
function buildWipeAllOverlay() {
if (document.getElementById('waOverlay')) return;
var ov = document.createElement('div'); ov.id = 'waOverlay';
ov.innerHTML = '<div class="wa-card">' +
'<div class="wa-ico">☢️</div>' +
'<div class="wa-title">全ユーザーの履歴を一括消去</div>' +
'<div class="wa-sub">勉強に関係ない派生データを<br><strong style="color:#fff;">自分を含む全ユーザーぶん</strong>消去します。</div>' +
'<div class="wa-keep"><span>単語の理解度</span><span>単語データ</span><span>長文・本棚</span><span>名前</span><span>目標</span><span>APIキー</span><span>アイコン</span><span>フレンド</span></div>' +
'<div class="wa-wipe"><span>経験値・レベル</span><span>称号</span><span>ランキング</span><span>ゲーム履歴</span><span>勉強時間</span></div>' +
'<div class="wa-progress" id="waProgress"><div class="wa-bar"><div class="wa-fill" id="waFill"></div></div><div class="wa-ptext"><span id="waPtext">準備中…</span><span class="wa-spinner"></span></div></div>' +
'<div class="wa-done" id="waDone"><div class="wa-check">✓</div><div class="wa-done-txt">消去しました</div><div class="wa-done-sub" id="waDoneSub"></div></div>' +
'<div class="wa-actions" id="waActions"><button type="button" class="wa-no" id="waNo">やめる</button><button type="button" class="wa-yes" id="waYes">実行する</button></div>' +
'</div>';
document.body.appendChild(ov);
ov.addEventListener('click', function (e) { if (e.target === ov && !ov.dataset.busy) closeWipeAll(); });
document.getElementById('waNo').onclick = function () { if (!ov.dataset.busy) closeWipeAll(); };
document.getElementById('waYes').onclick = function () { startWipeAll(ov); };
}
function openWipeAllOverlay() {
buildWipeAllOverlay();
var ov = document.getElementById('waOverlay');
ov.dataset.step = '1'; delete ov.dataset.busy;
document.getElementById('waProgress').classList.remove('show');
document.getElementById('waDone').classList.remove('show');
document.getElementById('waActions').style.display = 'flex';
var yes = document.getElementById('waYes'); yes.className = 'wa-yes'; yes.textContent = '実行する';
document.getElementById('waFill').style.width = '0%';
document.getElementById('waPtext').textContent = '準備中…';
ov.classList.add('open');
}
function closeWipeAll() { var ov = document.getElementById('waOverlay'); if (ov) ov.classList.remove('open'); }
function startWipeAll(ov) {
if (ov.dataset.step !== '1') { return; }
ov.dataset.step = '2';
var yes = document.getElementById('waYes'); yes.className = 'wa-yes final'; yes.textContent = '本当に実行';
document.getElementById('waNo').textContent = 'やめる';
document.querySelector('.wa-sub').innerHTML = '⚠️ 最終確認：<strong style="color:#fff;">全ユーザー</strong>の派生データが消えます。<br>もう一度「本当に実行」を押してください。';
yes.onclick = function () { runWipeAllFlow(ov); };
}
function runWipeAllFlow(ov) {
ov.dataset.busy = '1';
document.getElementById('waActions').style.display = 'none';
document.querySelector('.wa-sub').style.display = 'none';
var prog = document.getElementById('waProgress'); prog.classList.add('show');
var fill = document.getElementById('waFill'); var ptext = document.getElementById('waPtext');
ptext.textContent = 'ランキング履歴を消去中…'; fill.style.width = '6%';
runWipeAll(function (done, total, uid) {
var pct = Math.round(8 + (done / Math.max(1, total)) * 88);
fill.style.width = pct + '%';
ptext.textContent = '処理中 ' + done + ' / ' + total + ' 人';
}).then(function () {
fill.style.width = '100%'; ptext.textContent = '完了';
setTimeout(function () {
prog.classList.remove('show');
var done = document.getElementById('waDone'); done.classList.add('show');
document.getElementById('waDoneSub').textContent = '全ユーザーの派生データを消去しました。端末残骸も世代トークンで無効化済み。';
setTimeout(function () { closeWipeAll(); try { renderRows(); } catch (e) {} refreshDisplay(); toast('☢️ 全ユーザーの履歴を一括消去しました'); }, 1900);
}, 350);
}).catch(function () {
ptext.textContent = '一部で失敗しました（再試行してください）';
ov.dataset.busy = ''; document.getElementById('waActions').style.display = 'flex';
});
}

// ---- データ管理ボタン注入 ----
function injectAdminDataButton() {
if (document.getElementById('admDataBtnCard')) return;
var anchor = document.getElementById('adminUserListContainer'); var insertAfter = null, parent = null;
if (anchor) { var card = anchor.closest('.card'); if (card && card.parentNode) { insertAfter = card; parent = card.parentNode; } }
if (!parent) { var view = document.getElementById('view-admin'); if (view) { parent = view; insertAfter = null; } }
if (!parent) return;
var btnCard = document.createElement('div'); btnCard.className = 'card'; btnCard.id = 'admDataBtnCard';
btnCard.style.cssText = 'cursor:pointer;border:1px solid rgba(0,240,255,0.35);background:linear-gradient(135deg, rgba(0,240,255,0.08), rgba(192,132,252,0.06));box-shadow:0 0 15px rgba(0,240,255,0.15);transition:all .2s;display:flex;align-items:center;gap:12px;';
btnCard.innerHTML = '<div style="width:42px;height:42px;flex-shrink:0;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;background:rgba(0,240,255,0.12);border:1px solid rgba(0,240,255,0.35);box-shadow:0 0 12px rgba(0,240,255,0.25);">🗄️</div><div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:900;color:#fff;letter-spacing:.5px;">データ管理</div><div style="font-size:10.5px;color:var(--text-sub);margin-top:2px;">称号・経験値・勉強時間などをユーザーごとに編集／リセット</div></div><div style="color:var(--cosmic-cyan);font-weight:900;font-size:18px;">›</div>';
btnCard.onmouseenter = function () { this.style.boxShadow = '0 0 22px rgba(0,240,255,0.35)'; this.style.transform = 'translateY(-1px)'; };
btnCard.onmouseleave = function () { this.style.boxShadow = '0 0 15px rgba(0,240,255,0.15)'; this.style.transform = ''; };
btnCard.onclick = function () { openPanel(); };
parent.insertBefore(btnCard, insertAfter ? insertAfter.nextSibling : parent.firstChild);
}

// ---- patchCore：loadLocalState / saveUserStats ラップ（save 直前に世代トークン確認） ----
function patchCore() {
var origLoad = window.loadLocalState;
window.loadLocalState = function () { var p = origLoad ? origLoad.apply(this, arguments) : Promise.resolve(); return Promise.resolve(p).then(function () { return loadMyData(); }); };
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
injectAdminDataButton(); killResidueBanner();
// 世代トークン定期ポーリング（60秒）
if (!window.__fixGenPollLock) {
window.__fixGenPollLock = true;
netReadShared('app_settings').then(function (cfg) {
var gen = (cfg && cfg.resetGeneration) ? parseInt(cfg.resetGeneration) || 0 : 0;
window.__fixLastGen = gen;
var me = gMyIdSelf();
if (me && me !== 'GUEST-000' && gen > 0) {
var local = 0; try { local = parseInt(localStorage.getItem('__ste_reset_gen_' + me)) || 0; } catch (e) {}
if (gen > local) { wipeLocalDerived(); try { localStorage.setItem('__ste_reset_gen_' + me, String(gen)); } catch (e) {} try { if (window.saveUserStats) window.saveUserStats(); } catch (e) {} refreshDisplay(); toast('🧹 データが管理者によりリセットされました'); }
}
}).catch(function () {}).then(function () { window.__fixGenPollLock = false; });
}
}, 900);

function boot() {
if (typeof window.saveUserStats === 'function' && typeof window.loadLocalState === 'function') {
patchCore(); installBannerKiller();
loadTitleConfig().then(function () {
loadMyData(); injectAdminDataButton(); killResidueBanner(); fixStudySyncStart();
// 起動時に世代トークンを1回読んでキャッシュ
netReadShared('app_settings').then(function (cfg) { window.__fixLastGen = (cfg && cfg.resetGeneration) ? parseInt(cfg.resetGeneration) || 0 : 0; }).catch(function () {});
console.log('✅ fix.js 適用完了 bridge=' + (B() ? 'ON' : 'OFF') + ' lvOf=' + (lvOf(0) >= 0 ? 'ON' : 'OFF') + ' titleCfgSteps=' + Object.keys((window.__titleConfig && window.__titleConfig.steps) || {}).length + ' bonusCommon=' + (Array.isArray(window.__titleConfig && window.__titleConfig.bonusesCommon) ? 'SET' : 'DEFAULT'));
});
} else { setTimeout(boot, 150); }
}
if (document.readyState === 'complete') boot(); else window.addEventListener('load', boot);
})();
