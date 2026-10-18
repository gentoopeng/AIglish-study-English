// Only an explicit answer can replace an existing understanding record.
(function(){
'use strict';
const loads=new Map();let sequence=0;
const owner=()=>typeof myId==='string'&&myId?myId:(localStorage.getItem('core_v4_userId')||'GUEST-000');
const key=(book,id=owner())=>'core_v4_user_vocab_progress_'+id+'_'+(book||'default');
const recovery=(book,id=owner())=>'aiglish_learning_recovery_'+id+'_'+(book||'default');
function parse(raw){if(!raw)return {};const value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw Error('理解度の保存データを読み取れません。上書きを停止しました。');return value;}
function meaningful(word){return word&&((Number(word.editedAt)||0)>0||(word.status&&word.status!=='none')||(word.history||[]).length||Object.values(word.meanings||{}).some(m=>m&&(m.status&&m.status!=='none'||(m.history||[]).length)));}
function merge(existing,incoming){const result=Object.assign({},existing);Object.entries(incoming||{}).forEach(([num,word])=>{if(!word||typeof word!=='object')return;const previous=result[num];if(!previous||(Number(word.editedAt)||0)>(Number(previous.editedAt)||0)||(!meaningful(previous)&&meaningful(word)))result[num]=word;});return result;}
function read(book){
 const id=owner();if(window.LibraryState&&window.LibraryState.isDeleted('book',book,id))return {};
 const primaryRaw=localStorage.getItem(key(book,id)),backupRaw=localStorage.getItem(recovery(book,id));
 window.StartupMonitor?.progress?.(primaryRaw?.length||0,backupRaw?.length||0);
 const original=parse(primaryRaw);
 // The working record and recovery mirror normally contain exactly the same
 // text. Parse it once; keep returning a fresh object so callers cannot mutate
 // persisted understanding through an in-memory cache.
 if(primaryRaw===backupRaw)return original;
 const backup=parse(backupRaw),words=merge(backup,original);
 // merge keeps the selected word object. Compare membership/identity rather
 // than serializing the entire book twice just to check whether it changed.
 const changed=Object.keys(words).length!==Object.keys(original).length||Object.keys(words).some(num=>words[num]!==original[num]);
 const needsBackup=!Object.keys(backup).length&&Object.values(words).some(meaningful);
 if(changed||needsBackup){const raw=JSON.stringify(words);if(changed)localStorage.setItem(key(book,id),raw);if(needsBackup)localStorage.setItem(recovery(book,id),raw);}
 return words;
}
function restore(book,incoming){const words=merge(read(book),incoming),raw=JSON.stringify(words);if(Object.values(words).some(meaningful))localStorage.setItem(recovery(book),raw);localStorage.setItem(key(book),raw);return words;}
function canSave(book){if(window.__learningBootReady===false)return false;const state=loads.get(owner()+'\n'+(book||'default'));return !state||state.ready;}
function commit(book,rendered,num,validatedAnswer=false){
 if(window.LibraryState&&window.LibraryState.isDeleted('book',book,owner()))throw Error('削除された単語帳には保存できません。');
 if(!validatedAnswer&&!canSave(book))throw Error('理解度の読み込み中です。保存を保留しました。');
 const words=read(book),answered=num!==null&&num!==undefined&&rendered[String(num)];
 if(answered)words[String(num)]=Object.assign({},window.WeakReviewModel?window.WeakReviewModel.stampWord(words[String(num)],rendered[String(num)],Date.now()):rendered[String(num)],{editedAt:Math.max(Date.now(),(Number(words[String(num)]?.editedAt)||0)+1)});
 const raw=JSON.stringify(words);
 if(answered)localStorage.setItem(recovery(book),raw);
 localStorage.setItem(key(book),raw);return words;
}

function begin(book){const token={id:owner(),book:book||'default',sequence:++sequence,ready:false};loads.set(token.id+'\n'+token.book,token);return token;}
function finish(token){if(loads.get(token.id+'\n'+token.book)!==token||owner()!==token.id)return;token.ready=true;window.dispatchEvent(new Event('learning-data-ready'));if(window.resumeBackgroundSave)window.resumeBackgroundSave();}
window.LearningData={read,restore,commit,merge,canSave,begin,finish,hasAnswers:words=>Object.values(words||{}).some(meaningful),recoveryKey:recovery};
})();
