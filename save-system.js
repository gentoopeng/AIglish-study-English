// Learning data backup, restoration and durable save UI. Extracted from the retired battle module.
(function applySaveSystemPatch() {
"use strict";
if (window.__saveSystemApplied) return;
window.__saveSystemApplied = true;

var SAVE_INTERVAL = 3 * 60 * 1000;
var SLOTS = ['slot1', 'slot2', 'auto'];
var SLOT_NAMES = { slot1: 'セーブ1', slot2: 'セーブ2', auto: 'オートセーブ' };

/* ---------- ヘルパー ---------- */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function uid() {
  return (typeof myId !== 'undefined' && myId && myId !== 'GUEST-000') ? myId : null;
}
function nowDisplay() {
  var d = new Date();
  function p(n) { return (n < 10 ? '0' : '') + n; }
  return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
function saveKey(slot) {
  return 'save_studio_' + uid() + '_' + slot;
}
function toast(msg) {
  try { if (window.showToast) { window.showToast(msg, 'ok'); return; } } catch (e) {}
  try { console.log(msg); } catch (e) {}
}

/* ---------- 全データ収集 ---------- */
// クラウド自動保存は行わないが、教材を切り替える前の変更はメモリ上の下書きとして保持する。
// これが無いと、手動セーブ前に別の教材へ移動した時点で直前の単語帳編集が失われる。
window.__manualVocabDrafts = window.__manualVocabDrafts || {};
window.__manualVocabCloudId = function(bookKey){ return encodeURIComponent(String(bookKey||'default')); };
window.__manualVocabLocalKey = function(bookKey){
  var id=(typeof myId!=='undefined'&&myId)?myId:'GUEST-000';
  return 'core_v4_vocab_draft_'+id+'_'+encodeURIComponent(String(bookKey||'default'));
};
window.__vocabSavedAtMs = function(value){
  if(typeof value==='number')return isFinite(value)?value:0;
  return Date.parse(value||'')||0;
};
// 教材の下書きと理解度キャッシュのうち、新しい方を必ず採用する。
// タスクキル直前は理解度キャッシュだけが一瞬先に更新されることがあるため、
// 下書きだけを復元すると最後の操作が巻き戻ってしまう。
window.__mergeNewestLocalVocabProgress = function(bookKey,draft){
  if(!draft||typeof draft!=='object')return draft;
  if(window.LearningData){draft=JSON.parse(JSON.stringify(draft));draft.progress=window.LearningData.restore(bookKey,draft.progress||{});return draft;}
  try{
    var progressKey=window.getVocabProgressStorageKey(bookKey);
    var progressMs=parseInt(localStorage.getItem(progressKey+'__ts')||'0')||0;
    var draftMs=window.__vocabSavedAtMs(draft.savedAt);
    var raw=localStorage.getItem(progressKey);
    if(raw&&progressMs>=draftMs){
      var progress=JSON.parse(raw);
      if(progress&&typeof progress==='object'){
        draft=JSON.parse(JSON.stringify(draft));
        draft.progress=progress;
        draft.savedAt=new Date(progressMs||Date.now()).toISOString();
      }
    }
  }catch(e){}
  return draft;
};
window.__manualVocabChunkSize = 180000;
window.__gameSaveChecksum = window.__gameSaveChecksum || function(text){
  var hash=2166136261;
  text=String(text||'');
  for(var i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16);
};
window.__applyManualVocabDraft = function(bookKey,draft){
  if(!draft||!Array.isArray(draft.master)||(!draft.master.length&&draft.emptyConfirmed!==true))return false;
  vocabList=(typeof window.migrateVocabData==='function')?window.migrateVocabData(draft.master):JSON.parse(JSON.stringify(draft.master));
  if(draft.progress){
    currentUserVocabProgress=JSON.parse(JSON.stringify(draft.progress));
    if(typeof window.applyUserProgressToVocabList==='function')window.applyUserProgressToVocabList();
  }
  window.__manualVocabDrafts[bookKey]=JSON.parse(JSON.stringify(draft));
  if(typeof window.renderVocabList==='function')window.renderVocabList();
  return true;
};
window.__captureManualVocabDraft = function() {
  try {
    var bookKey=(typeof currentTextbook!=='undefined'&&currentTextbook)?currentTextbook:'default';
    if(!currentTextbook&&vocabList.length===0)return;
    if(window.LearningData&&!window.LearningData.canSave(bookKey))return;
    if(window.LibraryState&&window.LibraryState.isDeleted('book',bookKey))return;
    if(window.VocabMaster&&!window.VocabMaster.canCapture(bookKey,vocabList))return;
    var master=(typeof window.stripVocabProgressFromWords==='function')
      ? window.stripVocabProgressFromWords(vocabList)
      : JSON.parse(JSON.stringify(vocabList||[]));
    var progress=(typeof window.extractUserProgressFromVocabList==='function')
      ? window.extractUserProgressFromVocabList()
      : {};
    // The displayed list can lag behind a completed rating or cloud response.
    // Capture the canonical ratings, retaining words not currently rendered.
    var canonical=JSON.parse(localStorage.getItem(window.getVocabProgressStorageKey(bookKey))||'{}');
    progress=Object.assign({},progress,canonical);
    var savedAt=new Date().toISOString();
    var draft={
      master:master,
      emptyConfirmed:master.length===0&&!!window.VocabMaster&&window.VocabMaster.canCapture(bookKey,master),
      progress:progress,
      savedAt:savedAt
    };
    window.__manualVocabDrafts[bookKey]=draft;
    // メモリだけではブラウザを閉じると消える。変更した瞬間に教材単位の完全な
    // スナップショットを端末へ同期保存し、クラウド通信の成否とは切り離す。
    localStorage.setItem(window.__manualVocabLocalKey(bookKey),JSON.stringify(draft));
    window.__manualVocabDraftRevisions=window.__manualVocabDraftRevisions||{};
    window.__manualVocabDraftRevisions[bookKey]=(window.__manualVocabDraftRevisions[bookKey]||0)+1;
    window.__dirtyManualVocabDrafts=window.__dirtyManualVocabDrafts||{};
    window.__dirtyManualVocabDrafts[bookKey]=window.__manualVocabDraftRevisions[bookKey];
    return draft;
  } catch(e) { console.warn('[save] vocab draft capture failed',e); }
};

// 単語帳を閉じる時だけ、変更された教材をクラウドへ確定する。
// 保存完了メタデータは全パーツ送信後に更新するため、途中送信を復元しない。
window.flushManualVocabDraft = async function(bookKey){
  var owner=myId;
  if(window.LearningData&&!window.LearningData.canSave(bookKey))return false;
  var dirty=window.__dirtyManualVocabDrafts&&window.__dirtyManualVocabDrafts[bookKey];
  var draft=window.__manualVocabDrafts&&window.__manualVocabDrafts[bookKey];
  if(!dirty||!draft)return false;
  if(!Array.isArray(draft.master)||(!draft.master.length&&draft.emptyConfirmed!==true))return false;
  if(typeof myId==='undefined'||!myId||myId==='GUEST-000'||!window.db||!window.fbSetDoc||!window.fbGetDoc||!window.fbDoc)return false;
  var raw=JSON.stringify({master:draft.master||[],emptyConfirmed:draft.emptyConfirmed===true,progress:draft.progress||{},savedAt:draft.savedAt||new Date().toISOString()});
  var generation=Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
  var parts=[];
  for(var i=0;i<raw.length;i+=window.__manualVocabChunkSize)parts.push(raw.slice(i,i+window.__manualVocabChunkSize));
  if(!parts.length)parts=[''];
  try{
    var cloudId=window.__manualVocabCloudId(bookKey);
    for(var pi=0;pi<parts.length;pi++){
      await window.fbSetDoc(window.fbDoc(window.db,'users',owner,'vocabBooks',cloudId,'parts',generation+'_p'+pi),{d:parts[pi]},{merge:false});
    }
    var meta={bookKey:bookKey,partCount:parts.length,generation:generation,rawLength:raw.length,checksum:window.__gameSaveChecksum(raw),updatedAt:draft.savedAt||new Date().toISOString()};
    var ref=window.fbDoc(window.db,'users',owner,'vocabBooks',cloudId);
    await window.fbSetDoc(ref,meta,{merge:false});
    var verify=await window.fbGetDoc(ref);
    if(!verify||!verify.exists()||!verify.data()||verify.data().generation!==generation)throw new Error('単語帳保存の完了確認に失敗しました');
    if(!window.LearningData||window.LearningData.hasAnswers(draft.progress))await window.fbSetDoc(window.fbDoc(window.db,'users',owner,'vocabProgress',bookKey),{wordsJson:JSON.stringify(draft.progress||{}),updatedAt:meta.updatedAt},{merge:false});
    if(myId!==owner)return false;
    if(window.__dirtyManualVocabDrafts[bookKey]===dirty)delete window.__dirtyManualVocabDrafts[bookKey];
    return true;
  }catch(error){console.error('単語帳の変更保存に失敗しました:',error);return false;}
};
var __flushDraftWithDeletionTracking=window.flushManualVocabDraft;
window.flushManualVocabDraft=function(bookKey){
  if(window.LibraryState&&window.LibraryState.isDeleted('book',bookKey))return Promise.resolve(false);
  var id=myId;return window.LibraryState?window.LibraryState.track(id,function(){return __flushDraftWithDeletionTracking(bookKey);}):__flushDraftWithDeletionTracking(bookKey);
};
window.flushAllManualVocabDrafts = function(){
  return Promise.all(Object.keys(window.__dirtyManualVocabDrafts||{}).map(function(bookKey){return window.flushManualVocabDraft(bookKey);}));
};
// 手動セーブ前に教材を行き来しても、共有キャッシュではなく編集中の下書きを表示する。
if(!window.__manualDraftBookLoaderApplied&&typeof window.loadCurrentTextbookData==='function'){
  window.__manualDraftBookLoaderApplied=true;
  var __loadBookBeforeManualDraft=window.loadCurrentTextbookData;
  window.loadCurrentTextbookData=async function(){
    var bookKey=(typeof currentTextbook!=='undefined'&&currentTextbook)?currentTextbook:'default';
    var requestUserId=myId;
    if(window.LibraryState&&window.LibraryState.isDeleted('book',bookKey,requestUserId))return;
    function isCurrentRequest(){
      return myId===requestUserId&&(currentTextbook||'default')===bookKey&&!(window.LibraryState&&window.LibraryState.isDeleted('book',bookKey,requestUserId));
    }
    function latestDraft(fallback){
      var latest=window.__manualVocabDrafts&&window.__manualVocabDrafts[bookKey];
      try{
        var stored=JSON.parse(localStorage.getItem(window.__manualVocabLocalKey(bookKey))||'null');
        if(stored&&Array.isArray(stored.master)&&(!latest||window.__vocabSavedAtMs(stored.savedAt)>window.__vocabSavedAtMs(latest.savedAt)))latest=stored;
      }catch(e){}
      if(!latest||window.__vocabSavedAtMs(fallback&&fallback.savedAt)>window.__vocabSavedAtMs(latest.savedAt))latest=fallback;
      latest=window.VocabMaster.resolve(bookKey,latest);
      return window.__mergeNewestLocalVocabProgress(bookKey,latest);
    }
    var draft=window.__manualVocabDrafts&&window.__manualVocabDrafts[bookKey];
    if(!draft){
      try{draft=JSON.parse(localStorage.getItem(window.__manualVocabLocalKey(bookKey))||'null');}catch(e){draft=null;}
      if(draft&&Array.isArray(draft.master))window.__manualVocabDrafts[bookKey]=JSON.parse(JSON.stringify(draft));
    }
    draft=window.VocabMaster.resolve(bookKey,draft);
    draft=window.__mergeNewestLocalVocabProgress(bookKey,draft);
    if(draft&&Array.isArray(draft.master))window.__manualVocabDrafts[bookKey]=JSON.parse(JSON.stringify(draft));
    // 同じ端末では、手動セーブ時に確定済みのローカル教材を最優先する。
    // Firebaseを待たずに初回画面を表示できる。
    if(!draft){
      try{
        var localMaster=JSON.parse(localStorage.getItem('core_v4_custom_words_'+myId+'_'+bookKey)||localStorage.getItem('core_v4_cache_'+bookKey)||'null');
        var localProgressRaw=(typeof window.getVocabProgressStorageKey==='function')?localStorage.getItem(window.getVocabProgressStorageKey(bookKey)):null;
        if(Array.isArray(localMaster)&&localMaster.length){
          draft={
            master:localMaster,
            progress:localProgressRaw?JSON.parse(localProgressRaw):{},
            savedAt:new Date(parseInt((typeof window.getVocabProgressStorageKey==='function'?localStorage.getItem(window.getVocabProgressStorageKey(bookKey)+'__ts'):0)||0)).toISOString()
          };
        }
      }catch(e){}
    }
    // ページを開き直した直後はメモリ下書きが無いため、ユーザー専用の
    // 単語帳ドキュメントを直接取得する。共有教材を復元元にはしない。
    if(!draft&&window.db&&window.fbGetDoc&&window.fbDoc&&typeof myId!=='undefined'&&myId&&myId!=='GUEST-000'){
      try{
        var snap=await window.fbGetDoc(window.fbDoc(window.db,'users',myId,'vocabBooks',window.__manualVocabCloudId(bookKey)));
        if(snap&&snap.exists()&&snap.data()){
          var cloud=snap.data();
          if(cloud.partCount){
            var draftRaw='';
            for(var pi=0;pi<cloud.partCount;pi++){
              var draftPartId=cloud.generation?cloud.generation+'_p'+pi:'p'+pi;
              var part=await window.fbGetDoc(window.fbDoc(window.db,'users',myId,'vocabBooks',window.__manualVocabCloudId(bookKey),'parts',draftPartId));
              if(!part||!part.exists())throw new Error('単語帳データの一部が見つかりません');
              draftRaw+=(part.data()&&part.data().d)||'';
            }
            if(cloud.rawLength!=null&&draftRaw.length!==cloud.rawLength)throw new Error('単語帳データの長さが一致しません');
            if(cloud.checksum&&window.__gameSaveChecksum(draftRaw)!==cloud.checksum)throw new Error('単語帳データの検証に失敗しました');
            draft=JSON.parse(draftRaw);
            draft.savedAt=cloud.updatedAt||'';
          }else{
            draft={master:JSON.parse(cloud.masterJson||'[]'),progress:JSON.parse(cloud.progressJson||'{}'),emptyConfirmed:cloud.emptyConfirmed===true,savedAt:cloud.updatedAt||''};
          }
        }
      }catch(e){console.warn('[save] user vocab book load failed',e);throw e;}
    }
    if(!isCurrentRequest())return;
    draft=latestDraft(draft);
    // 通常ローダーを呼ぶ前にユーザー専用データをキャッシュへ配置する。
    // 以前は共有教材を一度描画してから差し替えていたため、起動直後に旧データが
    // 表示される瞬間や、後続処理が旧データを参照する競合が発生していた。
    if(draft&&Array.isArray(draft.master)){
      try{
        if(typeof textbooksCacheMap!=='undefined')textbooksCacheMap[bookKey]=JSON.parse(JSON.stringify(draft.master));
        localStorage.setItem('core_v4_cache_'+bookKey,JSON.stringify(draft.master));
        localStorage.setItem('core_v4_custom_words_'+myId+'_'+bookKey,JSON.stringify(draft.master));
        if(draft.progress&&typeof window.getVocabProgressStorageKey==='function'){
          if(window.LearningData)draft.progress=window.LearningData.restore(bookKey,draft.progress);
          localStorage.setItem(window.getVocabProgressStorageKey(bookKey),JSON.stringify(draft.progress));
          var draftMs=Date.parse(draft.savedAt||'')||0;
          if(draftMs)localStorage.setItem(window.getVocabProgressStorageKey(bookKey)+'__ts',String(draftMs));
        }
      }catch(e){}
    }
    var displayedSavedAt=draft&&draft.savedAt;
    var hasLocalDraft=draft&&Array.isArray(draft.master)&&draft.progress&&(!window.LearningData||window.LearningData.hasAnswers(draft.progress));
    var result=hasLocalDraft
      ?await __loadBookBeforeManualDraft.call(this,{localProgress:draft.progress})
      :await __loadBookBeforeManualDraft.apply(this,arguments);
    // 通信中の編集を古いスナップショットで巻き戻さず、切替前の結果も適用しない。
    if(!isCurrentRequest())return result;
    draft=latestDraft(draft);
    if(draft&&Array.isArray(draft.master)){
      // 通常ローダーが同じ下書きを描画済みなら、カード一覧を作り直さない。
      if(!hasLocalDraft||draft.savedAt!==displayedSavedAt)window.__applyManualVocabDraft(bookKey,draft);
      else window.__manualVocabDrafts[bookKey]=JSON.parse(JSON.stringify(draft));
    }
    return result;
  };
}
if(window.LearningData){
 const load=window.loadCurrentTextbookData;
 window.loadCurrentTextbookData=async function(){const token=window.LearningData.begin(currentTextbook||'default');try{const result=await load.apply(this,arguments);window.LearningData.finish(token);return result;}catch(error){throw error;}};
}

function collectAllData() {
  if(currentTextbook&&window.VocabMaster&&!window.VocabMaster.canCapture(currentTextbook,vocabList))throw new Error("単語データの読み込み前の保存を中止しました");
  window.__captureManualVocabDraft();
  var lsData = {};
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k) continue;
      if (k.indexOf('save_studio_') === 0 || k === 'aiglish_shared_background_catalog' || k === 'aiglish_profile_shop_catalog' || k === '__aiglish_render_guard') continue;
      // 単語帳本体は memory.vocabBooks に正規化して保存する。同じ内容のキャッシュを
      // 何重にも含めるとセーブ容量と通信回数が数倍になるため、再生成可能な複製は除外する。
      if (k.indexOf('core_v4_cache_') === 0 ||
          k.indexOf('core_v4_custom_words_') === 0 ||
          k.indexOf('core_v4_user_vocab_book_') === 0 ||
          k.indexOf('core_v4_vocab_draft_') === 0) continue;
      try { lsData[k] = localStorage.getItem(k); } catch (e) {}
    }
  } catch (e) {}
  var memData = {};
  try { memData.totalExp = (typeof totalExp !== 'undefined') ? totalExp : 0; } catch (e) {}
  try { memData.myName = (typeof myName !== 'undefined') ? myName : ''; } catch (e) {}
  try { memData.myTarget = (typeof myTarget !== 'undefined') ? myTarget : ''; } catch (e) {}
  try { memData.selectedTitle = (typeof selectedTitle !== 'undefined') ? selectedTitle : ''; } catch (e) {}
  try { memData.myFriendList = (typeof myFriendList !== 'undefined') ? myFriendList : []; } catch (e) {}
  try { memData.userStats = (typeof userStats !== 'undefined') ? userStats : {}; } catch (e) {}
  try { memData.todayStudySeconds = (typeof todayStudySeconds !== 'undefined') ? todayStudySeconds : 0; } catch (e) {}
  try { memData.weeklyStudyMinutesLog = (typeof weeklyStudyMinutesLog !== 'undefined') ? weeklyStudyMinutesLog : [0,0,0,0,0,0,0]; } catch (e) {}
  try { memData.lastAccessDateStr = (typeof lastAccessDateStr !== 'undefined') ? lastAccessDateStr : ''; } catch (e) {}
  // vocabMaster + vocabProgress already preserve the entire displayed list.
  // Avoid serializing its meaning/history objects a second time per autosave.
  // 理解度は単語マスターとは別の専用スナップショットとしても保持する。
  // 起動中に通常の教材ロードが走って vocabList が置き換わっても、これを最後に適用できる。
  try {
    memData.vocabBookKey = (typeof currentTextbook !== 'undefined' && currentTextbook) ? currentTextbook : 'default';
    memData.vocabMaster = (typeof window.stripVocabProgressFromWords === 'function')
      ? window.stripVocabProgressFromWords(vocabList)
      : JSON.parse(JSON.stringify(vocabList || []));
    memData.vocabEmptyConfirmed = !!window.VocabMaster&&window.VocabMaster.canCapture(memData.vocabBookKey,memData.vocabMaster)&&memData.vocabMaster.length===0;
    memData.vocabProgress = (typeof window.extractUserProgressFromVocabList === 'function')
      ? window.extractUserProgressFromVocabList()
      : ((typeof currentUserVocabProgress !== 'undefined' && currentUserVocabProgress) ? currentUserVocabProgress : {});
  } catch (e) {}
  try {
    memData.vocabBooks=JSON.parse(JSON.stringify(window.__manualVocabDrafts||{}));
    var draftPrefix='core_v4_vocab_draft_'+((typeof myId!=='undefined'&&myId)?myId:'GUEST-000')+'_';
    for(var di=0;di<localStorage.length;di++){
      var draftKey=localStorage.key(di);
      if(!draftKey||draftKey.indexOf(draftPrefix)!==0)continue;
      var draftBookKey=decodeURIComponent(draftKey.slice(draftPrefix.length));
      if(!memData.vocabBooks[draftBookKey])memData.vocabBooks[draftBookKey]=JSON.parse(localStorage.getItem(draftKey)||'null');
    }
  } catch(e) {}
  try { memData.wordMemory = (typeof wordMemory !== 'undefined') ? wordMemory : {}; } catch (e) {}
  try { memData.textHistory = (typeof textHistory !== 'undefined') ? textHistory : []; } catch (e) {}
  try { memData.myBookshelf = (typeof myBookshelf !== 'undefined') ? myBookshelf : []; } catch (e) {}
  try { memData.myFolders = (typeof myFolders !== 'undefined') ? myFolders : []; } catch (e) {}
  try { memData.currentTextbook = (typeof currentTextbook !== 'undefined') ? currentTextbook : ''; } catch (e) {}
  try { memData.textbooksPool = (typeof textbooksPool !== 'undefined') ? textbooksPool : []; } catch (e) {}



  try { memData.geminiApiKey = (typeof geminiApiKey !== 'undefined') ? geminiApiKey : ''; } catch (e) {}
  return { localStorage: lsData, memory: memData };
}
window.__collectGameSaveData = collectAllData;

/* ---------- セーブ情報取得 ---------- */
function getSaveInfo(slot) {
  var id = uid(); if (!id) return null;
  var raw = localStorage.getItem(saveKey(slot));
  if (!raw) return null;
  try {
    var s = JSON.parse(raw);
    return { savedAtDisplay: s.savedAtDisplay || '不明' };
  } catch (e) { return null; }
}

/* ---------- セーブ実行 ---------- */
function doSave(slot) {
  var id = uid();
  if (!id) return false;
  var data = collectAllData();
  var save = {
    slot: slot,
    savedAt: new Date().toISOString(),
    savedAtDisplay: nowDisplay(),
    data: data
  };
  var raw;
  try { raw = JSON.stringify(save); } catch (e) { return false; }
  try {
    localStorage.setItem(saveKey(slot), raw);
  } catch (e) {
    console.warn('save localStorage err', e);
    return false;
  }
  saveToFirebase(slot, save);
  return true;
}

function saveToFirebase(slot, save) {
  if (!window.db || !window.fbSetDoc || !window.fbDoc) return;
  var id = uid(); if (!id) return;
  try {
    var ref = window.fbDoc(window.db, 'users', id, 'saves', slot);
    var payload = {
      savedAt: save.savedAt,
      savedAtDisplay: save.savedAtDisplay,
      data: save.data
    };
    if (typeof window.__sanitizeForFirestore === 'function') {
      try { payload = window.__sanitizeForFirestore(payload); } catch (e) {}
    }
    window.fbSetDoc(ref, payload, { merge: true }).catch(function (e) {
      console.warn('save firebase err', e);
    });
  } catch (e) { console.warn('save firebase err', e); }
}

/* ---------- ロード実行 ---------- */
function doLoad(slot) {
  var id = uid();
  if (!id) { toast('先にログインしてください'); return; }
  var raw = localStorage.getItem(saveKey(slot));
  if (!raw) {
    loadFromFirebase(slot, function (save) {
      if (save) applyLoad(save);
      else toast('セーブデータがありません');
    });
    return;
  }
  var save;
  try { save = JSON.parse(raw); } catch (e) { toast('セーブデータが破損しています'); return; }
  applyLoad(save);
}

function loadFromFirebase(slot, cb) {
  if (!window.db || !window.fbGetDoc || !window.fbDoc) { cb(null); return; }
  var id = uid(); if (!id) { cb(null); return; }
  try {
    var ref = window.fbDoc(window.db, 'users', id, 'saves', slot);
    window.fbGetDoc(ref).then(function (snap) {
      if (snap && snap.exists() && snap.data()) cb(snap.data());
      else cb(null);
    }).catch(function () { cb(null); });
  } catch (e) { cb(null); }
}

function applyLoad(save) {
  if (!save || !save.data) { toast('セーブデータが破損しています'); return; }
  var lsData = save.data.localStorage || {};
  var memData = save.data.memory || {};
  for (var k in lsData) {
    if(k==='aiglish_shared_background_catalog')continue;
    if(window.VocabMaster&&!window.VocabMaster.canRestoreStorage(k,lsData[k],memData,uid()))continue;
    try { localStorage.setItem(k, lsData[k]); } catch (e) {}
  }
  if (window.db && window.fbSetDoc && window.fbDoc) {
    try {
      var id = uid();
      if (id) {
        var fbPayload = {
          totalExp: memData.totalExp || 0,
          playerName: memData.myName || '',
          selectedTitle: memData.selectedTitle || '',
          userTarget: memData.myTarget || '',
          userStats: memData.userStats || {},
          friendList: memData.myFriendList || [],
          updatedAt: new Date().toISOString()
        };
        if (typeof window.__sanitizeForFirestore === 'function') {
          try { fbPayload = window.__sanitizeForFirestore(fbPayload); } catch (e) {}
        }
        window.fbSetDoc(window.fbDoc(window.db, 'users', id), fbPayload, { merge: true }).catch(function () {});
      }
    } catch (e) {}
  }
  toast('読み込み中。しばらくお待ちください…');
  setTimeout(function () { location.reload(); }, 600);
}
window.__applyGameSaveData = applyLoad;

/* ---------- UI ---------- */
var __svCurrentTab = 'save';

function closeSavePanel() {
  var m = document.getElementById('svModal');
  if (m && m.parentNode) m.parentNode.removeChild(m);
}
window.closeSavePanel = closeSavePanel;

function openSavePanel() {
  closeSavePanel();
  if (!uid()) { toast('先にログインしてください'); return; }
  var m = document.createElement('div');
  m.id = 'svModal';
  m.className = 'sv-modal';
  m.innerHTML =
    '<div class="sv-card">' +
      '<div class="sv-head">' +
        '<div class="sv-title">💾 データ保存 / 読み込み</div>' +
        '<button class="sv-close" id="svCloseBtn">✕</button>' +
      '</div>' +
      '<div class="sv-tabs">' +
        '<button class="sv-tab on" id="svTabSave">セーブ</button>' +
        '<button class="sv-tab" id="svTabLoad">ロード</button>' +
      '</div>' +
      '<div class="sv-body" id="svBody"></div>' +
      '<div class="sv-note">オートセーブは3分ごと・データ変更時・画面を閉じる時に自動で保存されます。<br>セーブデータは端末とクラウドの両方に保存されるので、機種変更しても引き継げます。</div>' +
    '</div>';
  document.body.appendChild(m);
  m.querySelector('#svCloseBtn').addEventListener('click', closeSavePanel);
  m.querySelector('#svTabSave').addEventListener('click', function () { switchSvTab('save'); });
  m.querySelector('#svTabLoad').addEventListener('click', function () { switchSvTab('load'); });
  m.addEventListener('click', function (e) { if (e.target === m) closeSavePanel(); });
  switchSvTab('save');
}

function switchSvTab(tab) {
  __svCurrentTab = tab;
  var ts = document.getElementById('svTabSave');
  var tl = document.getElementById('svTabLoad');
  if (ts) ts.className = 'sv-tab' + (tab === 'save' ? ' on' : '');
  if (tl) tl.className = 'sv-tab' + (tab === 'load' ? ' on' : '');
  renderSvBody();
}

function renderSvBody() {
  var body = document.getElementById('svBody');
  if (!body) return;
  var html = '';
  SLOTS.forEach(function (slot) {
    var info = getSaveInfo(slot);
    var dateStr = info ? info.savedAtDisplay : '未セーブ';
    if (__svCurrentTab === 'save') {
      html +=
        '<div class="sv-slot">' +
          '<div class="sv-slot-info">' +
            '<div class="sv-slot-name">' + esc(SLOT_NAMES[slot]) + '</div>' +
            '<div class="sv-slot-date">' + esc(dateStr) + '</div>' +
          '</div>' +
          '<button class="sv-btn" data-svsave="' + slot + '">' + (info ? '上書き' : 'セーブ') + '</button>' +
        '</div>';
    } else {
      html +=
        '<div class="sv-slot">' +
          '<div class="sv-slot-info">' +
            '<div class="sv-slot-name">' + esc(SLOT_NAMES[slot]) + '</div>' +
            '<div class="sv-slot-date">' + esc(dateStr) + '</div>' +
          '</div>' +
          (info
            ? '<button class="sv-btn sv-load" data-svload="' + slot + '">ロード</button>'
            : '<button class="sv-btn sv-disabled" disabled>データなし</button>') +
        '</div>';
    }
  });
  body.innerHTML = html;
  body.querySelectorAll('[data-svsave]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var slot = btn.getAttribute('data-svsave');
      var info = getSaveInfo(slot);
      if (info) {
        if (!confirm(SLOT_NAMES[slot] + ' には既にデータがあります（' + info.savedAtDisplay + '）。\n上書きしますか？')) return;
      }
      if (doSave(slot)) {
        toast('💾 保存しました');
        renderSvBody();
      } else {
        toast('保存に失敗しました');
      }
    });
  });
  body.querySelectorAll('[data-svload]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var slot = btn.getAttribute('data-svload');
      if (!confirm(SLOT_NAMES[slot] + ' を読み込みますか？\n現在のセーブしていないデータは失われます。')) return;
      doLoad(slot);
    });
  });
}

/* ---------- 💾ボタン ---------- */
function ensureSaveButton() {
  var btn = document.getElementById('headerSaveBtn');
  if (btn) return btn;
  var header = document.querySelector('.app-header');
  if (!header) return null;
  btn = document.createElement('button');
  btn.id = 'headerSaveBtn';
  btn.innerHTML = '💾';
  btn.style.cssText = 'position:absolute;right:16px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.05);border:1px solid rgba(0,240,255,.4);color:#00F0FF;width:36px;height:36px;border-radius:8px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:1001;box-shadow:0 0 10px rgba(0,240,255,.2);';
  header.appendChild(btn);
  return btn;
}

function bindSaveButton() {
  var btn = ensureSaveButton();
  if (btn) btn.__svBound = true;
}

/* ---------- 保存要求の調停は save-coordinator.js に集約 ---------- */

/* ---------- 読み込み完了後 → ボタン紐付け＋初期オートセーブ ---------- */
window.onAppLoaded(function () {
  setTimeout(function () {
    bindSaveButton();
  }, 1500);
});

/* ---------- CSS ---------- */
function injectSvCss() {
  if (document.getElementById('svCss')) return;
  var s = document.createElement('style');
  s.id = 'svCss';
  s.textContent = [
    '.sv-modal{position:fixed;inset:0;z-index:60050;display:flex;align-items:center;justify-content:center;background:rgba(5,3,12,.8);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding:20px;}',
    '.sv-card{width:min(92vw,400px);max-height:85vh;overflow-y:auto;border-radius:18px;padding:22px 18px;background:linear-gradient(168deg,rgba(46,38,28,.96),rgba(24,18,12,.98));border:1px solid rgba(200,144,42,.4);box-shadow:0 24px 64px rgba(0,0,0,.6),0 0 30px rgba(200,144,42,.15);-webkit-overflow-scrolling:touch;}',
    '.sv-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}',
    '.sv-title{font-family:"Noto Serif JP",serif;font-size:18px;font-weight:900;color:#f3e5c0;letter-spacing:.06em;}',
    '.sv-close{width:32px;height:32px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#a89880;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;}',
    '.sv-close:active{transform:scale(.9);color:#f3e5c0;}',
    '.sv-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;}',
    '.sv-tab{padding:11px;border-radius:10px;border:1.5px solid rgba(255,255,255,.15);background:rgba(0,0,0,.3);color:#a89880;font-family:"Noto Serif JP",serif;font-size:13px;font-weight:900;letter-spacing:.1em;cursor:pointer;transition:all .2s;}',
    '.sv-tab.on{border-color:rgba(245,196,81,.7);background:linear-gradient(180deg,rgba(245,196,81,.15),rgba(200,144,42,.08));color:#fde68a;box-shadow:0 0 14px rgba(245,196,81,.25);}',
    '.sv-body{display:flex;flex-direction:column;gap:10px;}',
    '.sv-slot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.25);transition:border-color .2s;}',
    '.sv-slot:active{border-color:rgba(200,144,42,.4);}',
    '.sv-slot-info{flex:1;min-width:0;}',
    '.sv-slot-name{font-family:"Noto Serif JP",serif;font-size:14px;font-weight:900;color:#f3e5c0;}',
    '.sv-slot-date{font-family:"Chakra Petch",ui-monospace,monospace;font-size:11px;font-weight:600;color:#8a7a5f;margin-top:3px;}',
    '.sv-btn{flex:0 0 auto;padding:9px 18px;border-radius:9px;border:1.5px solid rgba(245,196,81,.5);background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(0,0,0,.15) 45%),linear-gradient(180deg,#4a3b24,#2e2415 55%,#1f1809);color:#fde68a;font-family:"Noto Serif JP",serif;font-size:12px;font-weight:900;letter-spacing:.08em;cursor:pointer;transition:all .15s;text-shadow:0 1px 0 rgba(0,0,0,.9);}',
    '.sv-btn:active{transform:translateY(1px) scale(.97);}',
    '.sv-btn.sv-load{border-color:rgba(52,231,228,.5);background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(0,0,0,.15) 45%),linear-gradient(180deg,#1a3a3a,#0e2424 55%,#081616);color:#9af6f1;}',
    '.sv-btn.sv-disabled{border-color:rgba(255,255,255,.1);background:rgba(0,0,0,.3);color:#5a5040;cursor:not-allowed;text-shadow:none;}',
    '.sv-note{margin-top:14px;padding:10px 12px;border-radius:9px;background:rgba(200,144,42,.06);border:1px dashed rgba(200,144,42,.25);font-family:"Noto Sans JP",sans-serif;font-size:10.5px;font-weight:600;color:#a89880;line-height:1.6;}'
  ].join('\n');
  (document.head || document.documentElement).appendChild(s);
}

/* ---------- 起動 ---------- */
function bootSv() {
  injectSvCss();
  bindSaveButton();
}
if (document.readyState !== 'loading') setTimeout(bootSv, 600);
else document.addEventListener('DOMContentLoaded', function () { setTimeout(bootSv, 600); });

var __svBindInterval = setInterval(function () {
  var btn = document.getElementById('headerSaveBtn');
  if (btn && !btn.__svBound) bindSaveButton();
}, 800);
setTimeout(function () { clearInterval(__svBindInterval); }, 30000);

console.log('💾 セーブ/ロードシステム 適用完了');
})();

(function applyFixPatch3() {
"use strict";
if (window.__fixPatch3Applied) return;
window.__fixPatch3Applied = true;

/* ==================================================================
【1】セーブ失敗の根治
    原因：collectAllData() が localStorage 全キーを収集し、
    容量制限（約5MB）を超えて QuotaExceededError が発生
    対策：巨大キャッシュキーを除外＋サイズチェック＋再試行
================================================================== */
(function fixSaveOverflow() {

/* 収集時に除外する巨大キャッシュキーのプレフィックス */
var EXCLUDE_PREFIXES = [
'aiglish_shared_background_catalog', // Shared photographs are fetched independently of personal backups.
'aiglish_profile_shop_catalog', // Global artwork is fetched separately, never duplicated in personal backups.
'save_studio_',      // セーブデータ本体（自分自身を含めない）
'core_v4_cache_',    // 単語帳キャッシュ（巨大）
'core_v4_user_avatar_' // アバター画像base64（巨大）
];

function isExcludedKey(key) {
for (var i = 0; i < EXCLUDE_PREFIXES.length; i++) {
if (key.indexOf(EXCLUDE_PREFIXES[i]) === 0) return true;
}
return false;
}

/* localStorage サイズ推定（バイト単位） */
function estimateLocalStorageSize() {
var total = 0;
try {
for (var i = 0; i < localStorage.length; i++) {
var k = localStorage.key(i);
if (k && !isExcludedKey(k)) {
total += (localStorage.getItem(k) || '').length * 2;
}
}
} catch (e) {}
return total;
}

/* collectAllData を上書き：巨大キャッシュ除外＋サイズ安全化 */
if (typeof window.collectAllData === 'function' && !window.collectAllData.__fixPatched) {
var origCollect = window.collectAllData;
window.collectAllData = function() {
var lsData = {};
try {
for (var i = 0; i < localStorage.length; i++) {
var k = localStorage.key(i);
if (!k || isExcludedKey(k)) continue;
try { lsData[k] = localStorage.getItem(k); } catch (e) {}
}
} catch (e) {}
var memData = {};
try { memData.totalExp = (typeof totalExp !== 'undefined') ? totalExp : 0; } catch (e) {}
try { memData.myName = (typeof myName !== 'undefined') ? myName : ''; } catch (e) {}
try { memData.myTarget = (typeof myTarget !== 'undefined') ? myTarget : ''; } catch (e) {}
try { memData.selectedTitle = (typeof selectedTitle !== 'undefined') ? selectedTitle : ''; } catch (e) {}
try { memData.myFriendList = (typeof myFriendList !== 'undefined') ? myFriendList : []; } catch (e) {}
try { memData.userStats = (typeof userStats !== 'undefined') ? userStats : {}; } catch (e) {}
try { memData.todayStudySeconds = (typeof todayStudySeconds !== 'undefined') ? todayStudySeconds : 0; } catch (e) {}
try { memData.weeklyStudyMinutesLog = (typeof weeklyStudyMinutesLog !== 'undefined') ? weeklyStudyMinutesLog : [0,0,0,0,0,0,0]; } catch (e) {}
try { memData.lastAccessDateStr = (typeof lastAccessDateStr !== 'undefined') ? lastAccessDateStr : ''; } catch (e) {}
try { memData.wordMemory = (typeof wordMemory !== 'undefined') ? wordMemory : {}; } catch (e) {}
try { memData.textHistory = (typeof textHistory !== 'undefined') ? textHistory : []; } catch (e) {}
try { memData.myBookshelf = (typeof myBookshelf !== 'undefined') ? myBookshelf : []; } catch (e) {}
try { memData.myFolders = (typeof myFolders !== 'undefined') ? myFolders : []; } catch (e) {}
try { memData.currentTextbook = (typeof currentTextbook !== 'undefined') ? currentTextbook : ''; } catch (e) {}
try { memData.textbooksPool = (typeof textbooksPool !== 'undefined') ? textbooksPool : []; } catch (e) {}



try { memData.geminiApiKey = (typeof geminiApiKey !== 'undefined') ? geminiApiKey : ''; } catch (e) {}
return { localStorage: lsData, memory: memData };
};
window.collectAllData.__fixPatched = true;
}

/* doSave を上書き：QuotaExceededError 対策＋インジケーター */
if (typeof window.doSave === 'function' && !window.doSave.__fixPatched) {
var origDoSave = window.doSave;
window.doSave = function(slot) {
/* オートセーブ開始インジケーター */
updateSaveIndicator('saving');
var id = (typeof myId !== 'undefined' && myId && myId !== 'GUEST-000') ? myId : null;
if (!id) {
updateSaveIndicator('idle');
return false;
}
var data = window.collectAllData();
var save = {
slot: slot,
savedAt: new Date().toISOString(),
savedAtDisplay: (function() {
var d = new Date();
function p(n) { return (n < 10 ? '0' : '') + n; }
return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
})(),
data: data
};
var raw;
try { raw = JSON.stringify(save); } catch (e) {
updateSaveIndicator('error');
return false;
}
/* サイズチェック：4MB超なら警告 */
var sizeMB = (raw.length * 2) / (1024 * 1024);
if (sizeMB > 4) {
console.warn('[save] データサイズ ' + sizeMB.toFixed(2) + 'MB - 容量制限に近いです');
}
try {
localStorage.setItem('save_studio_' + id + '_' + slot, raw);
updateSaveIndicator('done');
} catch (e) {
console.error('[save] localStorage 保存失敗:', e);
/* 再試行：テキスト履歴と本棚を除外して軽量化 */
try {
if (save.data.localStorage) {
delete save.data.localStorage['textHistory'];
delete save.data.localStorage['myBookshelf'];
}
var raw2 = JSON.stringify(save);
localStorage.setItem('save_studio_' + id + '_' + slot, raw2);
updateSaveIndicator('done');
} catch (e2) {
console.error('[save] 再試行も失敗:', e2);
updateSaveIndicator('error');
return false;
}
}
/* Firebase保存は非同期で失敗無視（ローカル優先） */
try { saveToFirebase(slot, save); } catch (e) {}
return true;
};
window.doSave.__fixPatched = true;
}

/* saveToFirebase を非同期・失敗無視に（存在すれば上書き） */
if (typeof window.saveToFirebase === 'function' && !window.saveToFirebase.__fixPatched) {
var origFbSave = window.saveToFirebase;
window.saveToFirebase = function(slot, save) {
try {
if (!window.db || !window.fbSetDoc || !window.fbDoc) return;
var id = (typeof myId !== 'undefined' && myId && myId !== 'GUEST-000') ? myId : null;
if (!id) return;
var ref = window.fbDoc(window.db, 'users', id, 'saves', slot);
var payload = {
savedAt: save.savedAt,
savedAtDisplay: save.savedAtDisplay,
data: save.data
};
if (typeof window.__sanitizeForFirestore === 'function') {
try { payload = window.__sanitizeForFirestore(payload); } catch (e) {}
}
/* Promise を返すが、呼び出し側では catch しない（非同期処理） */
window.fbSetDoc(ref, payload, { merge: true }).catch(function(e) {
console.warn('[save] Firebase同期失敗（ローカルには保存済み）:', e);
});
} catch (e) {}
};
window.saveToFirebase.__fixPatched = true;
}

/* --- オートセーブインジケーター --- */
var indicatorEl = null;
function ensureIndicator() {
if (indicatorEl && document.body.contains(indicatorEl)) return indicatorEl;
indicatorEl = document.createElement('div');
indicatorEl.id = 'svAutoIndicator';
indicatorEl.style.cssText = 'position:fixed;top:62px;right:12px;z-index:1002;display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.15);font-size:10px;font-weight:700;color:#a89880;opacity:0;transform:translateY(-4px);transition:opacity .3s,transform .3s;pointer-events:none;backdrop-filter:blur(6px);';
indicatorEl.innerHTML = '<span id="svAutoIcon">💾</span><span id="svAutoText"></span>';
document.body.appendChild(indicatorEl);
return indicatorEl;
}
function updateSaveIndicator(state) {
return;
var el = ensureIndicator();
if (!el) return;
var icon = document.getElementById('svAutoIcon');
var text = document.getElementById('svAutoText');
if (state === 'saving') {
el.style.opacity = '1'; el.style.transform = 'translateY(0)';
el.style.borderColor = 'rgba(52,231,228,.4)';
if (icon) icon.textContent = '🔄';
if (text) text.textContent = '保存中…';
} else if (state === 'done') {
el.style.opacity = '1'; el.style.transform = 'translateY(0)';
el.style.borderColor = 'rgba(74,222,128,.4)';
if (icon) icon.textContent = '✅';
if (text) text.textContent = '保存完了';
setTimeout(function() { el.style.opacity = '0'; el.style.transform = 'translateY(-4px)'; }, 2000);
} else if (state === 'error') {
el.style.opacity = '1'; el.style.transform = 'translateY(0)';
el.style.borderColor = 'rgba(239,68,68,.4)';
if (icon) icon.textContent = '⚠️';
if (text) text.textContent = '保存失敗';
setTimeout(function() { el.style.opacity = '0'; el.style.transform = 'translateY(-4px)'; }, 3000);
} else {
el.style.opacity = '0'; el.style.transform = 'translateY(-4px)';
}
}
window.__updateSaveIndicator = updateSaveIndicator;

/* オートセーブ（3分間隔）のラップ：インジケーター付き */
if (typeof window.markDirty === 'function' && !window.markDirty.__fixPatched) {
/* 既存のオートセーブインターバルはそのまま。doSave上書きでインジケーターが動く */
window.markDirty.__fixPatched = true;
}
})();

console.log('🔧 修正パッチ③（セーブ容量保護）適用完了');
})();

(function applyFirebaseSavePatch() {
"use strict";
if (window.__fbSaveApplied) return;
window.__fbSaveApplied = true;

var SLOT = 'main';
// Firestoreの上限を超えない範囲で1パーツを大きくし、往復回数を抑える。
var CHUNK = 280000;
var lastProgressPercent=0,lastRemainingSeconds=null;
function uid() { return (typeof myId !== 'undefined' && myId && myId !== 'GUEST-000') ? myId : null; }
function loginUid() { var id=uid(); if(id)return id; try{id=localStorage.getItem('core_v4_userId');}catch(e){} return id&&id!=='GUEST-000'?id:null; }
function fbOk() { return !!(window.db && window.fbSetDoc && window.fbGetDoc && window.fbDoc); }
function localKey(id) { return 'save_studio_' + (id||uid()) + '_' + SLOT; }
function localMetaKey(id) { return 'game_save_meta_' + (id||uid()); }
function cloudMetaKey(id) { return 'game_save_cloud_meta_' + (id||uid()); }
function nowDisplay() { var d=new Date(),p=function(n){return n<10?'0'+n:n;}; return d.getFullYear()+'/'+p(d.getMonth()+1)+'/'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes()); }
function saveGeneration(savedAt) { return String(savedAt||Date.now()).replace(/[^0-9A-Za-z]/g,'')+'_'+Math.random().toString(36).slice(2,8); }
function saveChecksum(text) {
  return window.__gameSaveChecksum(text);
}
function closePanel() { var m=document.getElementById('fbsvModal'); if(m&&m.parentNode)m.parentNode.removeChild(m); }
function progress(percent, startedAt, text) {
  var box=document.getElementById('fbsvProgress'),fill=document.getElementById('fbsvProgressFill'),label=document.getElementById('fbsvProgressText');
  if(!box||!fill||!label)return;
  percent=Math.max(lastProgressPercent,Math.max(0,Math.min(100,percent)));lastProgressPercent=percent;
  box.style.display='block'; fill.style.width=percent+'%';
  var elapsed=Math.max(0.1,(Date.now()-startedAt)/1000), estimated=elapsed>=1&&percent>=5&&percent<100?Math.max(1,Math.ceil(elapsed*(100-percent)/percent)):0;
  if(estimated)lastRemainingSeconds=lastRemainingSeconds==null?estimated:Math.min(lastRemainingSeconds,estimated);
  var remaining=percent>=100?0:(lastRemainingSeconds||0);
  label.textContent=text+' '+Math.round(percent)+'%'+(remaining?'（残り約'+remaining+'秒）':'');
}
function collectAll() {
  if(typeof window.__collectGameSaveData==='function') return window.__collectGameSaveData();
  var ls={}; for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k)ls[k]=localStorage.getItem(k);} return {localStorage:ls,memory:{}};
}
var pendingSave=null;
function saveAll() {if(pendingSave)return pendingSave;var task=window.LibraryState?window.LibraryState.track(uid(),saveAllContents):saveAllContents();pendingSave=Promise.resolve(task).finally(function(){pendingSave=null;});return pendingSave;}
window.__backgroundSaveAll=saveAll;
async function saveAllContents() {
  var id=uid(); if(!id)throw new Error('先にログインしてください');
  if(window.LearningData&&!window.LearningData.canSave(currentTextbook||'default'))throw new Error('読み込み中のため保存を保留しました');
  lastProgressPercent=0;lastRemainingSeconds=null;
  var started=Date.now(); progress(2,started,'データを準備中');
  // 手動セーブ自身がメモリと端末の最新値を収集するため、ここで旧個別保存の
  // ネットワーク完了を待たない。二重送信が長時間化の主因だった。
  try { if(typeof window.saveVocabProgressLocally==='function')window.saveVocabProgressLocally(null,true); } catch(e) {}
  // collectAllData captures the draft once; do not allocate it twice per backup.
  progress(8,started,'全データを整理中');
  if(window.syncRankingMetrics)window.syncRankingMetrics();
  var data=collectAll();
  var save={slot:SLOT,savedAt:new Date().toISOString(),savedAtDisplay:nowDisplay(),data:data};
  if(window.LibraryState)window.LibraryState.sanitizeSave(save,id);
  var generation=saveGeneration(save.savedAt);
  // 手動セーブ時点の理解度を、その場で正規のローカル領域にも確定する。
  // 100ms の遅延処理や別の自動保存処理には依存させない。
  try {
    var savedProgress=data.memory&&data.memory.vocabProgress;
    if(savedProgress){var progressBook=data.memory.vocabBookKey||'default';var cachedProgress=JSON.parse(localStorage.getItem(window.getVocabProgressStorageKey(progressBook))||'{}');savedProgress=Object.assign({},savedProgress,cachedProgress);data.memory.vocabProgress=savedProgress;}
    var savedBook=data.memory&&data.memory.vocabBookKey||'default';
    if(savedProgress&&typeof window.getVocabProgressStorageKey==='function'){
      localStorage.setItem(window.getVocabProgressStorageKey(savedBook),JSON.stringify(savedProgress));
      // A backup is not a new rating: keep the actual last-edit timestamp.
    }
  } catch(e) { console.warn('[save] vocab snapshot write failed',e); }
  var raw=JSON.stringify(save);
  var localSaved=false, cloudSaved=false, localError=null, cloudError=null;
  try { localStorage.setItem(localKey(),raw);if(window.AppStorage)await window.AppStorage.flush();localSaved=true; }
  catch(e) { localError=e; console.warn('[save] local save failed',e); }
  if(localSaved){
    try { localStorage.setItem(localMetaKey(id),JSON.stringify({savedAt:save.savedAt,savedAtDisplay:save.savedAtDisplay,source:'local'})); } catch(e) {}
  }
  if(!fbOk()) {
    if(localSaved){progress(100,started,'端末へ保存完了');return {localSaved:true,cloudSaved:false};}
    throw localError||new Error('保存先に接続できません');
  }
  var chunks=[]; for(var i=0;i<raw.length;i+=CHUNK)chunks.push(raw.slice(i,i+CHUNK)); if(!chunks.length)chunks=[''];
  var meta={savedAt:save.savedAt,savedAtDisplay:save.savedAtDisplay,partCount:chunks.length,generation:generation,rawLength:raw.length,checksum:saveChecksum(raw),v:4};
  try {
    // 編集した全教材をユーザー専用ドキュメントへ個別保存する。
    // ページ再起動後の教材切替はこの確定データを直接読むため、巨大な統合セーブや
    // 共有教材キャッシュの状態に左右されない。
    var savedBooks=(data.memory&&data.memory.vocabBooks)||{};
    var dirtyBooks=Object.assign({},window.__dirtyManualVocabDrafts||{});
    var savedBookKeys=Object.keys(savedBooks).filter(function(key){return !!dirtyBooks[key]||key===savedBook;});
    for(var bi=0;bi<savedBookKeys.length;bi++){
      var savedBookKey=savedBookKeys[bi];
      if(window.LibraryState&&window.LibraryState.isDeleted('book',savedBookKey,id))continue;
      var bookDraft=savedBooks[savedBookKey]||{};
      var bookRaw=JSON.stringify({master:bookDraft.master||[],progress:bookDraft.progress||{}});
      var bookGeneration=saveGeneration(save.savedAt+'_'+savedBookKey);
      var bookParts=[];
      for(var bp=0;bp<bookRaw.length;bp+=window.__manualVocabChunkSize)bookParts.push(bookRaw.slice(bp,bp+window.__manualVocabChunkSize));
      if(!bookParts.length)bookParts=[''];
      for(var bpi=0;bpi<bookParts.length;bpi++){
        await window.fbSetDoc(
          window.fbDoc(window.db,'users',id,'vocabBooks',window.__manualVocabCloudId(savedBookKey),'parts',bookGeneration+'_p'+bpi),
          {d:bookParts[bpi]},
          {merge:false}
        );
      }
      await window.fbSetDoc(
        window.fbDoc(window.db,'users',id,'vocabBooks',window.__manualVocabCloudId(savedBookKey)),
        {
          bookKey:savedBookKey,
          partCount:bookParts.length,
          generation:bookGeneration,
          rawLength:bookRaw.length,
          checksum:saveChecksum(bookRaw),
          updatedAt:save.savedAt
        },
        {merge:false}
      );
      if(window.__dirtyManualVocabDrafts&&window.__dirtyManualVocabDrafts[savedBookKey]===dirtyBooks[savedBookKey])delete window.__dirtyManualVocabDrafts[savedBookKey];
      progress(10+((bi+1)/Math.max(1,savedBookKeys.length))*15,started,'単語帳を保存中');
    }
    // アプリ本体が起動時に読む正規の理解度ドキュメントも同じ操作内で更新する。
    // フルセーブだけを更新すると、その後の教材ロードが古い理解度で上書きしてしまう。
    if(savedProgress&&!(window.LibraryState&&window.LibraryState.isDeleted('book',savedBook,id))){
      var progressRef=window.fbDoc(window.db,'users',id,'vocabProgress',savedBook);
      var progressEditedAt=Number(data.localStorage&&data.localStorage[window.getVocabProgressStorageKey(savedBook)+'__ts'])||0;
      if(window.fbRunTransaction)await window.fbRunTransaction(window.db,async function(tx){
        var doc=await tx.get(progressRef),remote=doc.exists()?doc.data():{},remoteWords={};
        try{remoteWords=JSON.parse(remote.wordsJson||'{}');}catch(e){}
        var remoteAt=Number(remote.updatedAtMs)||Date.parse(remote.updatedAt||'')||0;
        var merged=window.LearningData?window.LearningData.merge(savedProgress,remoteWords):(remoteAt>progressEditedAt?Object.assign({},savedProgress,remoteWords):Object.assign({},remoteWords,savedProgress));
        tx.set(progressRef,{wordsJson:JSON.stringify(merged),updatedAt:new Date(Math.max(remoteAt,progressEditedAt)).toISOString(),updatedAtMs:Math.max(remoteAt,progressEditedAt)},{merge:true});
      });
      else if(progressEditedAt&&(!window.LearningData||window.LearningData.hasAnswers(savedProgress)))await window.fbSetDoc(progressRef,{wordsJson:JSON.stringify(savedProgress),updatedAt:new Date(progressEditedAt).toISOString()},{merge:true});
      progress(15,started,'理解度を保存中');
    }
    // 本文を先に保存し、最後にメタデータを更新する。途中で通信が切れても
    // ローダーが未完成の新規セーブを「保存完了」として選ばない。
    for(var n=0;n<chunks.length;n++){
      await window.fbSetDoc(window.fbDoc(window.db,'users',id,'saves',SLOT,'parts',generation+'_p'+n),{d:chunks[n]},{merge:false});
      progress(15+((n+1)/chunks.length)*80,started,'クラウドへ保存中');
    }
    // Full backups and public ranking must commit the same captured learning record.
    if(window.LearningRankingModel&&window.fbRunTransaction){
      var rankingRecord=window.LearningRankingModel.merge(null,data.localStorage&&data.localStorage['core_v4_learning_ranking_v2_'+id]);
      meta.learningRankingV2Json=JSON.stringify(rankingRecord);
      await window.fbRunTransaction(window.db,async function(tx){var ref=window.fbDoc(window.db,'users',id),snap=await tx.get(ref);var merged=window.LearningRankingModel.merge(window.LearningRankingModel.fromProfile(snap.exists()?snap.data():{}),rankingRecord);tx.set(ref,{learningRankingV2Json:JSON.stringify(merged)},{merge:true});});
    }
    if(window.UserProfileModel&&window.fbRunTransaction){
      await window.fbRunTransaction(window.db,async function(tx){
        var ref=window.fbDoc(window.db,'users',id),snap=await tx.get(ref),current=snap.exists()?snap.data():{};
        var profile=window.UserProfileModel.merge(current.profileCustomizationJson,(data.localStorage||{})['core_v4_profile_customization_'+id]);
        tx.set(ref,{profileCustomizationJson:JSON.stringify(profile)},{merge:true});
      });
    }
    await window.fbSetDoc(window.fbDoc(window.db,'users',id,'saves',SLOT),meta,{merge:false});
    var verify=await window.fbGetDoc(window.fbDoc(window.db,'users',id,'saves',SLOT));
    if(!verify||!verify.exists()||!verify.data()||verify.data().generation!==generation)throw new Error('クラウド保存の完了確認に失敗しました');
    cloudSaved=true;
  } catch(e) {
    cloudError=e; console.warn('[save] cloud save failed',e);
  }
  if(cloudSaved){
    try { localStorage.setItem(cloudMetaKey(id),JSON.stringify({savedAt:save.savedAt,savedAtDisplay:save.savedAtDisplay,generation:generation})); } catch(e) {}
    if(!localSaved){try { localStorage.setItem(localMetaKey(id),JSON.stringify({savedAt:save.savedAt,savedAtDisplay:save.savedAtDisplay,source:'cloud'})); } catch(e) {}}
    progress(100,started,'保存完了');return {localSaved:localSaved,cloudSaved:true};
  }
  if(localSaved){progress(100,started,'端末へ保存完了（クラウド未接続）');return {localSaved:true,cloudSaved:false};}
  throw cloudError||localError||new Error('保存に失敗しました');
}
async function fetchCloudSave(id) {
  id=id||loginUid(); if(!id||!fbOk())return null;
  var snap=await window.fbGetDoc(window.fbDoc(window.db,'users',id,'saves',SLOT));
  if(!snap||!snap.exists())return null;
  var meta=snap.data()||{}, raw='';
  for(var i=0;i<(meta.partCount||0);i++){
    var partId=meta.generation?meta.generation+'_p'+i:'p'+i;
    var part=await window.fbGetDoc(window.fbDoc(window.db,'users',id,'saves',SLOT,'parts',partId));
    if(!part||!part.exists()||!part.data())throw new Error('セーブデータの一部が見つかりません');
    raw+=part.data().d||'';
  }
  if(meta.rawLength!=null&&raw.length!==meta.rawLength)throw new Error('セーブデータの長さが一致しません');
  if(meta.checksum&&saveChecksum(raw)!==meta.checksum)throw new Error('セーブデータの検証に失敗しました');
  return raw?JSON.parse(raw):null;
}
window.__readLearningRankingBackup=async function(id){
  var manifest=await window.fbGetDoc(window.fbDoc(window.db,'users',id,'saves',SLOT));
  if(manifest.exists()&&manifest.data().learningRankingV2Json)return window.LearningRankingModel.merge(null,manifest.data().learningRankingV2Json);
  var save=await fetchCloudSave(id),data=save&&save.data||{};
  return window.LearningRankingModel.merge(data.localStorage&&data.localStorage['core_v4_learning_ranking_v2_'+id],data.memory&&data.memory.userStats&&data.memory.userStats.learning_ranking_v2_json);
};
function applySavedMemory(memory,id) {
  if(!memory||typeof memory!=='object')return;
  if(window.LibraryState)window.LibraryState.sanitizeSave({memory:memory},id);
  try{if(memory.totalExp!=null)totalExp=memory.totalExp;}catch(e){}
  try{if(memory.myName!=null)myName=memory.myName;}catch(e){}
  try{if(memory.myTarget!=null)myTarget=memory.myTarget;}catch(e){}
  try{if(memory.selectedTitle!=null)selectedTitle=memory.selectedTitle;}catch(e){}
  try{if(Array.isArray(memory.myFriendList))myFriendList=memory.myFriendList;}catch(e){}
  try{if(memory.userStats){userStats=memory.userStats;if(window.StudyTime&&loginUid()===id&&memory.userStats.study_calendar_v2)window.StudyTime.mergeCloud(memory.userStats.study_calendar_v2);}}catch(e){}
  try{if(memory.todayStudySeconds!=null)todayStudySeconds=memory.todayStudySeconds;}catch(e){}
  try{if(Array.isArray(memory.weeklyStudyMinutesLog))weeklyStudyMinutesLog=memory.weeklyStudyMinutesLog;}catch(e){}
  try{if(memory.lastAccessDateStr!=null)lastAccessDateStr=memory.lastAccessDateStr;}catch(e){}
  try{if(Array.isArray(memory.vocabList))vocabList=memory.vocabList;}catch(e){}
  try{if(memory.wordMemory)wordMemory=memory.wordMemory;}catch(e){}
  try{if(Array.isArray(memory.textHistory))textHistory=memory.textHistory;}catch(e){}
  try{if(Array.isArray(memory.myBookshelf))myBookshelf=memory.myBookshelf;}catch(e){}
  try{if(Array.isArray(memory.myFolders))myFolders=memory.myFolders;}catch(e){}
  try{if(memory.currentTextbook!=null)currentTextbook=memory.currentTextbook;}catch(e){}
  try{if(Array.isArray(memory.textbooksPool))textbooksPool=memory.textbooksPool;}catch(e){}



  try{
    localStorage.setItem('core_v4_totalExp',String(memory.totalExp||0));
    localStorage.setItem('core_v4_userName',memory.myName||'');
    localStorage.setItem('core_v4_userTarget',memory.myTarget||'');
    localStorage.setItem('core_v4_userTitle',memory.selectedTitle||'');
    if(memory.userStats)localStorage.setItem('core_v4_user_stats_'+id,JSON.stringify(memory.userStats));
    if(memory.myFriendList)localStorage.setItem('core_v4_friend_list',JSON.stringify(memory.myFriendList));
  }catch(e){}
}
async function autoLoadOnce() {
  var id=loginUid(); if(!id)return;
  if(window.__gameSaveLoadedFor===id)return;
  window.__gameSaveLoadedFor=id;
  if(window.LibraryState){try{await window.LibraryState.loadCloud(id);if(loginUid()!==id)return;window.LibraryState.cleanLocal(id);}catch(e){console.warn('[save] deletion history sync deferred',e);}}
  var cloudSave=null,localSave=null,save=null,cloudMarker=null;
  try{localSave=JSON.parse(localStorage.getItem(localKey(id))||'null');}catch(e){}
  try{cloudMarker=JSON.parse(localStorage.getItem(cloudMetaKey(id))||'null');}catch(e){}
  if(!cloudMarker){
    try{
      var fallbackMeta=JSON.parse(localStorage.getItem(localMetaKey(id))||'null');
      if(fallbackMeta&&fallbackMeta.source==='cloud')cloudMarker=fallbackMeta;
    }catch(e){}
  }
  var localTime=Date.parse(localSave&&localSave.savedAt||'')||0;
  var markedCloudTime=Date.parse(cloudMarker&&cloudMarker.savedAt||'')||0;
  // 端末保存に失敗してクラウドだけ成功した場合、古い端末セーブを優先しない。
  if(!localSave||markedCloudTime>localTime){
    try{cloudSave=await fetchCloudSave(id);}catch(e){console.warn('[save] cloud load failed',e);}
    save=cloudSave||localSave;
  }else{
    save=localSave;
  }
  if(loginUid()!==id)return;
  if(save&&window.LibraryState)window.LibraryState.sanitizeSave(save,id);
  if(save&&save.data&&save.data.localStorage){
    var stored=save.data.localStorage;
    for(var key in stored){
      if(key==='aiglish_shared_background_catalog')continue;
      if(window.VocabMaster&&!window.VocabMaster.canRestoreStorage(key,stored[key],save.data.memory,id))continue;
      if(key.indexOf('aiglish_learning_recovery_')===0)continue;
      if(key.indexOf('aiglish_app_background_')===0){try{var currentBackground=JSON.parse(localStorage.getItem(key)||'null'),savedBackground=JSON.parse(stored[key]||'null');if(currentBackground&&(Number(currentBackground.updatedAt)||0)>=(Number(savedBackground&&savedBackground.updatedAt)||0))continue;}catch(e){if(localStorage.getItem(key))continue;}}
      if(key==='aiglish_ranking_device')continue; // Device counters must keep this browser's identity.
      if(key==='core_v4_learning_ranking_'+id&&localStorage.getItem(key))continue;
      if(key==='core_v4_learning_ranking_v2_'+id&&window.LearningRankingModel){
        try{localStorage.setItem(key,JSON.stringify(window.LearningRankingModel.merge(JSON.parse(localStorage.getItem(key)||'null'),JSON.parse(stored[key]||'null'))));}catch(e){}
        continue;
      }
      if(window.LibraryState&&key===window.LibraryState.storageKey(id)){localStorage.setItem(key,JSON.stringify(window.LibraryState.merge(window.LibraryState.read(id),JSON.parse(stored[key]))));continue;}
      // 理解度は回答のたびに専用領域へ即時保存される。統合セーブはそれより古い
      // 場合があるため、ここで一括復元するとタスクキル後に回答が消えてしまう。
      if(key.indexOf('core_v4_user_vocab_progress_')===0){
        var ownProgressPrefix='core_v4_user_vocab_progress_'+id+'_';
        if(window.LearningData&&key.indexOf(ownProgressPrefix)===0&&!key.endsWith('__ts')){
          try{window.LearningData.restore(key.slice(ownProgressPrefix.length),JSON.parse(stored[key]||'{}'));}catch(e){console.warn('[save] rating recovery stopped',e);}
        }
        continue;
      }
      if(key.indexOf('aiglish_study_ledger_')===0){
        try{
          var localStudy=JSON.parse(localStorage.getItem(key)||'null');
          var savedStudy=JSON.parse(stored[key]||'null');
          if(localStudy&&(Number(localStudy.updatedAt)||0)>(Number(savedStudy&&savedStudy.updatedAt)||0))continue;
        }catch(e){if(localStorage.getItem(key))continue;}
      }
      if(key.indexOf('vv4_works_')===0){
        var workStampKey=key.endsWith('__ts')?key:key+'__ts';
        var localWorkMs=Number(localStorage.getItem(workStampKey))||0;
        var savedWorkMs=Number(stored[workStampKey])||Date.parse(save.savedAt||'')||0;
        if(localWorkMs>savedWorkMs)continue;
      }
      if(key.indexOf('core_v4_vocab_note_sharing_')===0){
        try{
          var localSharing=JSON.parse(localStorage.getItem(key)||'null');
          var savedSharing=JSON.parse(stored[key]||'null');
          if(localSharing&&(Date.parse(localSharing.savedAt||'')||0)>(Date.parse(savedSharing&&savedSharing.savedAt||save.savedAt||'')||0))continue;
        }catch(e){if(localStorage.getItem(key))continue;}
      }
      if(key.indexOf('core_v4_personal_library_')===0){
        try{
          var localLibrary=JSON.parse(localStorage.getItem(key)||'null');
          var savedLibrary=JSON.parse(stored[key]||'null');
          if(localLibrary&&(Date.parse(localLibrary.savedAt||'')||0)>(Date.parse(savedLibrary&&savedLibrary.savedAt||save.savedAt||'')||0))continue;
        }catch(e){if(localStorage.getItem(key))continue;}
      }
      if(key.indexOf('core_v4_vocab_draft_')===0){
        try{
          var existingDraft=JSON.parse(localStorage.getItem(key)||'null');
          var savedDraft=JSON.parse(stored[key]||'null');
          if(existingDraft&&(Date.parse(existingDraft.savedAt||'')||0)>(Date.parse(savedDraft&&savedDraft.savedAt||'')||0))continue;
        }catch(e){
          // 壊れた統合セーブで、端末に残る下書きを上書きしない。
          if(localStorage.getItem(key))continue;
        }
      }
      try{localStorage.setItem(key,stored[key]);}catch(e){}
    }
  }
  if(save&&save.data&&save.data.memory){
    window.__pendingGameSaveMemory={id:id,savedAt:save.savedAt||'',data:save.data.memory};
    applySavedMemory(save.data.memory,id);
  }
}
function openPanel() {
  closePanel();
  if(!uid())return;
  var m=document.createElement('div');m.id='fbsvModal';m.className='fbsv-modal';
  var last='未セーブ';try{var oldMeta=JSON.parse(localStorage.getItem(localMetaKey())||'null');if(oldMeta)last=oldMeta.savedAtDisplay||last;else{var old=JSON.parse(localStorage.getItem(localKey())||'null');if(old)last=old.savedAtDisplay||last;}}catch(e){}
  m.innerHTML='<div class="fbsv-card"><div class="fbsv-head"><div class="fbsv-title">💾 セーブ</div><button class="fbsv-close" id="fbsvClose">✕</button></div><div class="fbsv-row"><div><div class="fbsv-name">セーブデータ</div><div class="fbsv-date">最終保存: '+last+'</div></div><button class="fbsv-btn" id="fbsvSave">セーブする</button></div><div id="fbsvProgress" style="display:none;margin-top:12px"><div id="fbsvProgressText" style="font-size:11px;color:#fde68a;margin-bottom:6px">準備中 0%</div><div style="height:8px;background:rgba(255,255,255,.12);border-radius:4px;overflow:hidden"><div id="fbsvProgressFill" style="height:100%;width:0;background:linear-gradient(90deg,#00F0FF,#C084FC);transition:width .2s"></div></div></div><div class="fbsv-note">すべてのデータを端末とクラウドへ保存します。ロード操作は不要で、ログイン時に自動で読み込まれます。</div></div>';
  document.body.appendChild(m);m.querySelector('#fbsvClose').onclick=closePanel;m.onclick=function(e){if(e.target===m)closePanel();};
  m.querySelector('#fbsvSave').onclick=async function(){var b=this;b.disabled=true;try{var result=await saveAll();b.textContent=result.cloudSaved?'保存完了':'端末に保存完了';}catch(e){progress(0,Date.now(),'保存失敗');b.textContent='もう一度試す';console.error(e);}finally{b.disabled=false;}};
}
function ensureBtn(){var b=document.getElementById('headerSaveBtn'),h=document.querySelector('.app-header');if(!b&&h){b=document.createElement('button');b.id='headerSaveBtn';b.type='button';b.innerHTML='💾';b.style.cssText='position:absolute;right:16px;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid rgba(0,240,255,.4);color:#00F0FF;font-size:16px;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:1001;';h.appendChild(b);}return b;}
document.addEventListener('click',function(e){var t=e.target;if(t&&t.closest&&t.closest('#headerSaveBtn')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openPanel();}},true);
window.onBeforeAppLoad(autoLoadOnce);
window.onAppLoaded(function(){
  ensureBtn();
  var pending=window.__pendingGameSaveMemory;
  if(!pending)return;
  if(window.LibraryState)window.LibraryState.sanitizeSave({memory:pending.data},pending.id);
  applySavedMemory(pending.data,pending.id);
  var restoredSuccessfully=true;
  try{
    var bookKey=pending.data.vocabBookKey||((typeof currentTextbook!=='undefined'&&currentTextbook)?currentTextbook:'default');
    if(pending.data.vocabBookDeleted)bookKey=null;
    // セーブ時に編集されていた全教材を復元する。現在開いている1冊だけではなく、
    // セーブ前に切り替えた教材の追加・削除・理解度も対象にする。
    if(pending.data.vocabBooks&&typeof pending.data.vocabBooks==='object'){
      window.__manualVocabDrafts=window.__manualVocabDrafts||{};
      Object.keys(pending.data.vocabBooks).forEach(function(savedBookKey){
        var savedBook=pending.data.vocabBooks[savedBookKey]||{};
        var fullSaveMs=window.__vocabSavedAtMs(savedBook.savedAt||pending.savedAt);
        var localDraft=null;
        try{localDraft=JSON.parse(localStorage.getItem(window.__manualVocabLocalKey(savedBookKey))||'null');}catch(e){}
        localDraft=window.__mergeNewestLocalVocabProgress(savedBookKey,localDraft);
        var localMs=window.__vocabSavedAtMs(localDraft&&localDraft.savedAt);
        var chosen=(localDraft&&localMs>fullSaveMs)?localDraft:savedBook;
        chosen=window.VocabMaster.resolve(savedBookKey,chosen)||{progress:chosen.progress,savedAt:chosen.savedAt};
        // 下書き作成の直前にアプリが終了しても、先に同期保存された理解度本体は残る。
        // 下書きの有無にかかわらず、この専用スナップショットを最後に比較する。
        try{
          var directProgressKey=window.getVocabProgressStorageKey(savedBookKey);
          var directProgressMs=parseInt(localStorage.getItem(directProgressKey+'__ts')||'0')||0;
          var chosenMsBeforeDirect=window.__vocabSavedAtMs(chosen&&chosen.savedAt)||fullSaveMs;
          if(directProgressMs>chosenMsBeforeDirect){
            var directProgress=JSON.parse(localStorage.getItem(directProgressKey)||'{}');
            chosen=JSON.parse(JSON.stringify(chosen||{}));
            chosen.progress=directProgress&&typeof directProgress==='object'?directProgress:{};
            chosen.savedAt=new Date(directProgressMs).toISOString();
          }
        }catch(e){}
        window.__manualVocabDrafts[savedBookKey]=JSON.parse(JSON.stringify(chosen));
        if(Array.isArray(chosen.master)){
          if(typeof textbooksCacheMap!=='undefined')textbooksCacheMap[savedBookKey]=chosen.master;
          localStorage.setItem('core_v4_cache_'+savedBookKey,JSON.stringify(chosen.master));
          localStorage.setItem('core_v4_custom_words_'+pending.id+'_'+savedBookKey,JSON.stringify(chosen.master));
        }
        if(chosen.progress&&typeof window.getVocabProgressStorageKey==='function'){
          var chosenMs=window.__vocabSavedAtMs(chosen.savedAt)||fullSaveMs;
          if(window.LearningData)chosen.progress=window.LearningData.restore(savedBookKey,chosen.progress);
          localStorage.setItem(window.getVocabProgressStorageKey(savedBookKey),JSON.stringify(chosen.progress));
          if(chosenMs)localStorage.setItem(window.getVocabProgressStorageKey(savedBookKey)+'__ts',String(chosenMs));
          if(savedBookKey===bookKey)currentUserVocabProgress=JSON.parse(JSON.stringify(chosen.progress));
        }
      });
    }
    // 単語帳本体もユーザー用キャッシュへ戻す。vocabList だけを戻すと、
    // 次の教材ロードで共有キャッシュに置き換わり、追加・編集した単語が消えていた。
    if(bookKey&&Array.isArray(pending.data.vocabMaster)){
      var restoredMaster=pending.data.vocabMaster;
      var currentDraft=window.__manualVocabDrafts&&window.__manualVocabDrafts[bookKey];
      if(currentDraft&&Array.isArray(currentDraft.master)&&window.__vocabSavedAtMs(currentDraft.savedAt)>window.__vocabSavedAtMs(pending.savedAt)){
        restoredMaster=currentDraft.master;
      }
      var safeMaster=window.VocabMaster.resolve(bookKey,{master:restoredMaster,emptyConfirmed:pending.data.vocabEmptyConfirmed===true});
      if(!safeMaster)throw new Error('空の教材バックアップの復元を中止しました');
      restoredMaster=safeMaster.master;
      if(typeof textbooksCacheMap!=='undefined')textbooksCacheMap[bookKey]=restoredMaster;
      localStorage.setItem('core_v4_cache_'+bookKey,JSON.stringify(restoredMaster));
      localStorage.setItem('core_v4_custom_words_'+pending.id+'_'+bookKey,JSON.stringify(restoredMaster));
      vocabList=(typeof window.migrateVocabData==='function')?window.migrateVocabData(restoredMaster):restoredMaster;
    }
    // 保存時に確定した理解度を使う。起動途中で読み込まれた古い vocabList から
    // 再抽出すると巻き戻るため、vocabProgress がある場合は再抽出しない。
    if(bookKey&&pending.data.vocabProgress&&typeof pending.data.vocabProgress==='object'){
      var pendingMs=window.__vocabSavedAtMs(pending.savedAt);
      var currentProgressKey=window.getVocabProgressStorageKey(bookKey);
      var currentLocalMs=parseInt(localStorage.getItem(currentProgressKey+'__ts')||'0')||0;
      if(currentLocalMs<=pendingMs){
        currentUserVocabProgress=window.LearningData?window.LearningData.restore(bookKey,pending.data.vocabProgress):pending.data.vocabProgress;
      }else{
        try{currentUserVocabProgress=JSON.parse(localStorage.getItem(currentProgressKey)||'{}')||{};}catch(e){}
      }
      if(typeof window.applyUserProgressToVocabList==='function')window.applyUserProgressToVocabList();
    }else if(bookKey&&typeof window.extractUserProgressFromVocabList==='function'){
      currentUserVocabProgress=window.extractUserProgressFromVocabList();
    }
    if(bookKey&&typeof window.getVocabProgressStorageKey==='function'){
      var finalProgressKey=window.getVocabProgressStorageKey(bookKey);
      var existingMs=parseInt(localStorage.getItem(finalProgressKey+'__ts')||'0')||0;
      var restoredMs=window.__vocabSavedAtMs(pending.savedAt);
      // 古い統合セーブの日時で、新しい理解度の日時を戻さない。
      if(existingMs<=restoredMs){
        if(window.LearningData)currentUserVocabProgress=window.LearningData.restore(bookKey,currentUserVocabProgress||{});
        localStorage.setItem(finalProgressKey,JSON.stringify(currentUserVocabProgress||{}));
        if(restoredMs)localStorage.setItem(finalProgressKey+'__ts',String(restoredMs));
      }
    }
    if(window.LearningData&&bookKey&&(currentTextbook||'default')===bookKey){currentUserVocabProgress=window.LearningData.read(bookKey);if(typeof window.applyUserProgressToVocabList==='function')window.applyUserProgressToVocabList();}
  }catch(e){restoredSuccessfully=false;console.warn('[save] vocab progress restore failed',e);}
  try{if(typeof window.applyProfileToUi==='function')window.applyProfileToUi();}catch(e){}
  try{if(typeof window.renderVocabList==='function')window.renderVocabList();}catch(e){}
  try{if(typeof window.renderLeaderboard==='function')window.renderLeaderboard();}catch(e){}
  try{if(typeof window.renderBookshelf==='function')window.renderBookshelf();}catch(e){}
  if(restoredSuccessfully&&window.__pendingGameSaveMemory===pending)window.__pendingGameSaveMemory=null;
});
if(document.readyState!=='loading')setTimeout(ensureBtn,400);else document.addEventListener('DOMContentLoaded',function(){setTimeout(ensureBtn,400);});
console.log('☁️ 単一セーブ＋ログイン時自動ロード適用完了');
})();
