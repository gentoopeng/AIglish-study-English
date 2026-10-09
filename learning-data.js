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
function read(book){const id=owner();if(window.LibraryState&&window.LibraryState.isDeleted('book',book,id))return {};const original=parse(localStorage.getItem(key(book,id))),backup=parse(localStorage.getItem(recovery(book,id))),words=merge(backup,original);if(JSON.stringify(words)!==JSON.stringify(original))localStorage.setItem(key(book,id),JSON.stringify(words));if(!Object.keys(backup).length&&Object.values(words).some(meaningful))localStorage.setItem(recovery(book,id),JSON.stringify(words));return words;}
function restore(book,incoming){const words=merge(read(book),incoming);if(Object.values(words).some(meaningful))localStorage.setItem(recovery(book),JSON.stringify(words));localStorage.setItem(key(book),JSON.stringify(words));return words;}
function canSave(book){if(window.__learningBootReady===false)return false;const state=loads.get(owner()+'\n'+(book||'default'));return !state||state.ready;}
function commit(book,rendered,num,validatedAnswer=false){if(window.LibraryState&&window.LibraryState.isDeleted('book',book,owner()))throw Error('削除された単語帳には保存できません。');if(!validatedAnswer&&!canSave(book))throw Error('理解度の読み込み中です。保存を保留しました。');let words=read(book);if(num!==null&&num!==undefined&&rendered[String(num)]){words[String(num)]=Object.assign({},rendered[String(num)],{editedAt:Date.now()});localStorage.setItem(recovery(book),JSON.stringify(words));}localStorage.setItem(key(book),JSON.stringify(words));return words;}
function begin(book){const token={id:owner(),book:book||'default',sequence:++sequence,ready:false};loads.set(token.id+'\n'+token.book,token);return token;}
function finish(token){if(loads.get(token.id+'\n'+token.book)!==token||owner()!==token.id)return;token.ready=true;window.dispatchEvent(new Event('learning-data-ready'));if(window.resumeBackgroundSave)window.resumeBackgroundSave();}
window.LearningData={read,restore,commit,merge,canSave,begin,finish,hasAnswers:words=>Object.values(words||{}).some(meaningful),recoveryKey:recovery};
})();
