// Personal bests have an independent, durable retry journal; never replace learning data.
(function(){
'use strict';
const m=window.WordDuelModel,owner=()=>myId||'GUEST-000',key=id=>'core_v4_word_duel_solo_'+id;
const memory=new Map(),jobs=new Map();
function read(id=owner()){
 let saved=null;try{saved=JSON.parse(localStorage.getItem(key(id))||'null');}catch{}
 const live=memory.get(id);
 if(live&&(!saved||m.bestScore(saved.score)===null||live.score>=saved.score))return live;
 return saved&&m.bestScore(saved.score)!==null?saved:null;
}
function store(id,record){memory.set(id,record);try{localStorage.setItem(key(id),JSON.stringify(record));return true;}catch(error){console.warn('ベストスコアを端末に保存できませんでした',error);return false;}}
function merge(doc,id=owner()){
 const remote=m.bestScore(doc?.wordDuelSoloBest),local=read(id);
 if(remote!==null&&(!local||remote>local.score))store(id,{score:remote,book:String(doc.wordDuelSoloBook||''),at:Number(doc.wordDuelSoloBestAt||0),pending:false});
}
async function sync(id=owner()){
 if(jobs.has(id))return jobs.get(id);
 const record=read(id);if(!record?.pending||id==='GUEST-000'||!window.db||!window.fbRunTransaction||window.FirestoreReadGuard?.paused())return false;
 const task=Promise.resolve().then(async()=>{try{
  const remote=await window.fbRunTransaction(window.db,async tx=>{
   const ref=window.fbDoc(window.db,'users',id),snap=await tx.get(ref);
   if(!snap.exists())throw Error('アカウントを確認できません。');
   const cloud=m.bestScore(snap.data().wordDuelSoloBest);
   if(cloud===null||record.score>cloud)tx.set(ref,{wordDuelSoloBest:record.score,wordDuelSoloBook:record.book,wordDuelSoloBestAt:record.at},{merge:true});
   return cloud!==null&&cloud>record.score?snap.data():{wordDuelSoloBest:record.score,wordDuelSoloBook:record.book,wordDuelSoloBestAt:record.at};
  });
  merge(remote,id);const current=read(id);
  if(current?.score===record.score&&current.at===record.at)store(id,{...current,pending:false});
  return true;
 }catch(error){console.warn('ベストスコアは接続後に再同期します',error);return false;}finally{jobs.delete(id);}});
 jobs.set(id,task);const success=await task;
 if(success&&read(id)?.pending)return sync(id);
 return success;
}
function record(score,book,id=owner()){
 if(m.bestScore(score)===null)throw Error('スコアを確認できません。');
 const previous=read(id);if(previous&&score<=previous.score)return {improved:false,saved:true};
 return {improved:true,saved:store(id,{score,book:String(book||'').slice(0,160),at:Date.now(),pending:id!=='GUEST-000'})};
}
window.WordDuelSolo={read,record,merge,sync,best:()=>read()?.score??null};
window.addEventListener('online',()=>sync());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
window.onAppLoaded(()=>sync());
})();
