// Bound each Firestore snapshot and release the event loop between documents.
(function(){
'use strict';
const TTL=300000;
let queue=Promise.resolve(),cache=null,cacheAt=0,cacheDay='',retryAfter=0,lastError=null;
const day=()=>window.StudyTimeModel?.dateKey(Date.now())||new Date().toDateString();
function compact(doc,budget){
 const stats=window.StudyTimeModel.readStats(doc),metrics=window.LearningRankingModel.fromProfile(doc);
 let avatar=typeof doc.avatar==='string'&&doc.avatar.length<=48000?doc.avatar:'';
 if(avatar.length>budget.remaining)avatar='';budget.remaining-=avatar.length;
 const timestamp=value=>value&&typeof value.toMillis==='function'?value.toMillis():value&&typeof value.seconds==='number'?value.seconds*1000:value;
 return {deleted:!!doc.deleted,playerName:doc.playerName||doc.userName||doc.name,avatar,userTarget:doc.userTarget||doc.target,
 lastActiveAt:timestamp(doc.lastActiveAt||stats.lastLoginAt||doc.lastLoginAt||doc.updatedAt),
 __directorySummary:{date:day(),totalSeconds:window.StudyTimeModel.rankingSeconds(stats,'total',Date.now()),dailySeconds:window.StudyTimeModel.rankingSeconds(stats,'daily',Date.now()),words:window.LearningRankingModel.wordCount(metrics),flash:window.LearningRankingModel.flashCount(metrics)}};
}
function scan(visit,isCurrent=()=>true,options={}){
 const task=queue.then(async()=>{
  if(!isCurrent())throw Error('読み込みを中止しました。');
  const deliver=async rows=>{for(const row of rows){if(!isCurrent())throw Error('読み込みを中止しました。');await visit(row.id,row.data);await new Promise(resolve=>setTimeout(resolve,0));}};
  if(!options.force&&cache&&cacheDay===day()&&Date.now()-cacheAt<TTL)return deliver(cache);
  if(!options.force&&Date.now()<retryAfter)throw lastError;
  const expires=Date.now()+15000;
  const rows=[],budget={remaining:4000000};
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
   for(const doc of docs){if(!active())throw Error('読み込みを中止しました。');rows.push({id:doc.id,data:compact(doc.data(),budget)});await new Promise(resolve=>setTimeout(resolve,0));}
   cursor=docs[docs.length-1];if(!paged||docs.length<10)break;
  }while(active());
  if(!active())throw Error('通信が完了しませんでした。');
  cache=rows;cacheAt=Date.now();cacheDay=day();retryAfter=0;lastError=null;
  return deliver(cache);
 }).catch(error=>{if(!String(error.message).includes('中止')){lastError=error;retryAfter=Date.now()+60000;}throw error;});
 queue=task.catch(()=>{});return task;
}
window.UserDirectory={scan,get(id){return cache&&cacheDay===day()&&Date.now()-cacheAt<TTL?cache.find(row=>row.id===id)?.data:null;}};
})();
