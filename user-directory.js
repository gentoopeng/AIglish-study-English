// Bound each Firestore snapshot and release the event loop between documents.
(function(){
'use strict';
let queue=Promise.resolve();
function scan(visit,isCurrent=()=>true){
 const task=queue.then(async()=>{
  const expires=Date.now()+15000;
  const active=()=>isCurrent()&&Date.now()<expires;
  if(!window.db||!window.fbGetDocs||!window.fbCollection)throw Error('接続後に更新してください。');
  const paged=['fbQuery','fbOrderBy','fbDocumentId','fbLimit','fbStartAfter'].every(key=>typeof window[key]==='function');
  let cursor=null;
  do{
   if(!active())throw Error('読み込みを中止しました。');
   let ref=window.fbCollection(window.db,'users');
   if(paged){const parts=[window.fbOrderBy(window.fbDocumentId()),window.fbLimit(10)];if(cursor)parts.push(window.fbStartAfter(cursor));ref=window.fbQuery(ref,...parts);}
   let timer;const snapshot=await Promise.race([window.fbGetDocs(ref),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('通信が完了しませんでした。')),Math.max(1,expires-Date.now())))]).finally(()=>clearTimeout(timer));
   if(!active())throw Error('読み込みを中止しました。');
   const docs=snapshot.docs||[];if(!snapshot.docs)snapshot.forEach(doc=>docs.push(doc));
   for(const doc of docs){if(!active())throw Error('読み込みを中止しました。');await visit(doc.id,doc.data());await new Promise(resolve=>setTimeout(resolve,0));}
   cursor=docs[docs.length-1];if(!paged||docs.length<10)break;
  }while(active());
  if(!active())throw Error('通信が完了しませんでした。');
 });
 queue=task.catch(()=>{});return task;
}
window.UserDirectory={scan};
})();
