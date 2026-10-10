// Explicit answers use the canonical recovery journal; cloud writes are batched by book.
(function(){
'use strict';
const owner=()=>myId||'GUEST-000',pendingKey=id=>'core_v4_word_duel_pending_'+id,queues=new Map();
function pending(id){return JSON.parse(localStorage.getItem(pendingKey(id))||'{}');}
function overall(meanings,count){const statuses=Object.values(meanings).map(item=>item.status||'none');while(statuses.length<count)statuses.push('none');return statuses.includes('bad')?'bad':statuses.length&&statuses.every(value=>value==='ok')?'ok':statuses.includes('so')||statuses.includes('ok')?'so':'none';}
function apply(book,ref,right,id){
 if(id!==owner()||window.__learningBootReady===false)throw Error('理解度の読み込みが完了していません。');
 if(!book||!ref||typeof ref.num!=='string'||typeof ref.mid!=='string'||!ref.sig)throw Error('単語の保存先を確認できません。');
 const before=window.LearningData.read(book)[ref.num]||{};
 if(before.sig&&before.sig!==ref.sig)throw Error('単語帳が変更されているため、この回答の理解度は上書きしません。');
 const status=right?'ok':'bad',previous=before.meanings?.[ref.mid]||{},meanings={...before.meanings,[ref.mid]:{...previous,status,history:[...(previous.history||[]),status].slice(-20)}},word={...before,sig:ref.sig,note:before.note||'',meanings,status:overall(meanings,ref.count),history:[...(before.history||[]),status].slice(-20)};
 // Write the retry intent first; interruption at any point keeps a recoverable record.
 const jobs=pending(id),job=jobs[book]||(jobs[book]={});job[ref.num]={revision:(job[ref.num]?.revision||0)+1,mids:[...new Set([...(job[ref.num]?.mids||[]),ref.mid])],count:ref.count};localStorage.setItem(pendingKey(id),JSON.stringify(jobs));
 const words=window.LearningData.commit(book,{[ref.num]:word},ref.num,true);
 localStorage.setItem('core_v4_user_vocab_progress_'+id+'_'+book+'__ts',String(words[ref.num].editedAt));
 if(typeof currentTextbook==='string'&&currentTextbook===book&&window.LearningData.canSave(book)){
  currentUserVocabProgress=words;
  const item=typeof vocabList!=='undefined'&&vocabList.find(item=>String(item.num)===ref.num);
  if(item&&window.buildWordSignature(item)===ref.sig){item.status=word.status;item.history=word.history;for(const meaning of item.meanings||[]){const value=word.meanings[String(meaning.id)];if(value){meaning.status=value.status;meaning.history=value.history;}}}
 }
 window.recordRankedWord?.(book,ref.num);return words[ref.num];
}
async function flush(id=owner()){
 if(id!==owner()||id==='GUEST-000'||!window.db||!window.fbRunTransaction)return false;
 if(queues.has(id))return queues.get(id);
 const execute=async()=>{let saved=true;const jobs=pending(id);for(const [book,changes]of Object.entries(jobs)){
  if(id!==owner())return false;
  if(window.LibraryState?.isDeleted('book',book,id))continue;
  const local=window.LearningData.read(book),version=JSON.stringify(changes);
  try{
   const merged=await window.fbRunTransaction(window.db,async tx=>{
    if(id!==owner()||window.LibraryState?.isDeleted('book',book,id))return null;
    const ref=window.fbDoc(window.db,'users',id,'vocabProgress',book),snap=await tx.get(ref),data=snap.exists()?snap.data():{},remote=data.wordsJson?JSON.parse(data.wordsJson):(data.words||{});
    if(id!==owner()||window.LibraryState?.isDeleted('book',book,id))return null;
    if(!remote||typeof remote!=='object'||Array.isArray(remote))throw Error('クラウドの理解度を読み取れません。上書きを停止しました。');
    const result={...remote};
    for(const [num,change]of Object.entries(changes)){
     const value=local[num],old=remote[num];if(!value||old&&((old.sig&&old.sig!==value.sig)||(old.editedAt||0)>value.editedAt))continue;
     const meanings={...value.meanings,...old?.meanings};for(const mid of change.mids)if(value.meanings?.[mid])meanings[mid]=value.meanings[mid];
     const combined={...old,...value,note:value.note||old?.note||'',meanings};combined.status=overall(meanings,change.count);result[num]=combined;
    }
    tx.set(ref,{wordsJson:JSON.stringify(result),updatedAtMs:Date.now(),updatedAt:new Date().toISOString()},{merge:true});return result;
   });
   if(id!==owner())return false;
   if(!merged||window.LibraryState?.isDeleted('book',book,id))continue;
   window.LearningData.restore(book,merged);
   for(const num of Object.keys(changes)){const current=window.LearningData.read(book)[num];if(current&&merged[num]&&JSON.stringify(current)===JSON.stringify(local[num])&&JSON.stringify(current)!==JSON.stringify(merged[num]))window.LearningData.commit(book,{[num]:merged[num]},num,true);}
   const latest=pending(id);if(JSON.stringify(latest[book])===version){delete latest[book];localStorage.setItem(pendingKey(id),JSON.stringify(latest));}
  }catch(error){saved=false;console.warn('バトルの理解度は端末に保持し、接続後に再同期します',error);}
 }return saved;};
 const task=(window.LibraryState?.track?window.LibraryState.track(id,execute):execute()).finally(()=>queues.delete(id));queues.set(id,task);return task;
}
window.WordDuelProgress={apply,flush};
window.onAppLoaded(()=>flush().catch(()=>{}));window.addEventListener('online',()=>flush().catch(()=>{}));
setInterval(()=>{if(document.visibilityState==='visible')flush().catch(()=>{});},60000);
})();
