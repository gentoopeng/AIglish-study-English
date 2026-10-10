// A finished Japan-time week is sealed once, when an account next opens the app.
// A short shared lease prevents every device from scanning users simultaneously.
(function(){
'use strict';
const model=window.LearningRewardsModel,firstWeek='2026-10-05',collection='learningWeeklyResultsV1',jobs=new Map();
const owner=()=>typeof myId==='string'&&myId?myId:'GUEST-000';
const key=id=>'core_v4_weekly_mail_v1_'+id;
function read(id=owner()){try{return JSON.parse(localStorage.getItem(key(id))||'{}');}catch{return {};}}
function valid(result,week){return result?.version===1&&result.week===week&&result.complete===true&&Array.isArray(result.rows)&&result.rows.length<=9;}
function store(result,id){const cache=read(id);cache[result.week]=result;localStorage.setItem(key(id),JSON.stringify(cache));}
async function getRows(id){
 const rows=[];let cursor=null;const paged=!!(window.fbQuery&&window.fbOrderBy&&window.fbDocumentId&&window.fbLimit&&window.fbStartAfter);
 do{if(owner()!==id)throw Error('アカウントが変更されました。');let ref=window.fbCollection(window.db,'users');if(paged){const parts=[window.fbOrderBy(window.fbDocumentId()),window.fbLimit(20)];if(cursor)parts.push(window.fbStartAfter(cursor));ref=window.fbQuery(ref,...parts);}const snap=await (window.fbGetDocsFromServer||window.fbGetDocs)(ref);if(snap.metadata?.fromCache)throw Error('週間集計にはサーバーへの接続が必要です。');const docs=snap.docs||[];if(!snap.docs)snap.forEach(doc=>docs.push(doc));for(const doc of docs){const data=doc.data();if(!data.deleted&&doc.id!=='GUEST-000')rows.push({id:doc.id,activity:model.mergeActivity(data.learningActivityV1Json),study:window.StudyTimeModel.readStats(data).study_calendar_v2});}cursor=docs.at(-1);if(!paged||docs.length<20)break;await new Promise(resolve=>setTimeout(resolve,0));}while(true);return rows;
}
function scores(rows,week){const end=model.shiftDay(week,6);return rows.map(row=>({id:row.id,time:Math.floor(Object.entries(row.study?.days||{}).reduce((sum,[day,value])=>sum+(day>=week&&day<=end?window.StudyTimeModel.dayMilliseconds(value):0),0)/1000),words:model.count(row.activity,'ratings',week,end),flash:model.count(row.activity,'swipes',week,end)}));}
async function settle(){
 const id=owner();if(window.__learningBootReady===false)return;if(id==='GUEST-000'||!window.db||!window.fbRunTransaction||!window.fbGetDocs)return;
 if(jobs.has(id))return jobs.get(id);
 const work=(async()=>{
  const last=model.shiftDay(model.weekStart(Date.now()),-7),cache=read(id),missing=[];for(let week=firstWeek;week<=last;week=model.shiftDay(week,7))if(!valid(cache[week],week))missing.push(week);if(!missing.length)return;
  const synced=await window.LearningRanking.sync();if(!synced||owner()!==id)return;
  let rows=null;
  for(const week of missing){
   if(owner()!==id)return;const ref=window.fbDoc(window.db,collection,week),token=crypto.randomUUID();
   const reserved=await window.fbRunTransaction(window.db,async tx=>{const snap=await tx.get(ref),result=snap.exists()?snap.data():null;if(valid(result,week))return {result};if(result?.leaseUntil>Date.now())return null;tx.set(ref,{week,token,leaseUntil:Date.now()+60000,complete:false},{merge:false});return {token};});
   if(!reserved)continue;if(reserved.result){store(reserved.result,id);continue;}
   rows=rows||await getRows(id);const measured=scores(rows,week),winners=new Map();for(const metric of ['time','words','flash'])for(const row of model.podium(measured,metric))winners.set(row.id,row);
   const computed={version:1,week,complete:true,rows:Array.from(winners.values()),sealedAt:Date.now()};
   const result=await window.fbRunTransaction(window.db,async tx=>{const snap=await tx.get(ref),current=snap.exists()?snap.data():null;if(valid(current,week))return current;if(current?.token!==token)throw Error('週間集計は他の端末で処理中です。更新で再確認できます。');tx.set(ref,computed,{merge:false});return computed;});store(result,id);
  }
  if(owner()===id)await window.AppStorage?.flush();
 })();jobs.set(id,work);try{return await work;}finally{jobs.delete(id);}
}
function letters(id=owner()){return Object.values(read(id)).filter(result=>valid(result,result.week)&&result.week<model.weekStart(Date.now())).flatMap(result=>model.weeklyMail(result.week,result.rows,id)).sort((a,b)=>b.week.localeCompare(a.week)||a.metric.localeCompare(b.metric));}
async function claim(letter){
 const id=owner();if(id==='GUEST-000')throw Error('週間報酬はログインしたアカウントで受け取れます。');
 if(!letter||!model.validDay(letter.week)||letter.week<firstWeek||model.weekStart(Date.parse(letter.week+'T12:00:00+09:00'))!==letter.week||letter.week>=model.weekStart(Date.now()))throw Error('この週はまだ終了していません。');
 // Re-read the sealed public result in the same transaction as the wallet credit.
 return window.LearningWallet.transaction(async(wallet,doc,tx)=>{const ref=window.fbDoc(window.db,collection,letter.week),snap=await tx.get(ref);if(!snap.exists()||!valid(snap.data(),letter.week))throw Error('週間集計を確認できませんでした。');const actual=model.weeklyMail(letter.week,snap.data().rows,id).find(row=>row.id===letter.id);if(!actual)throw Error('この報酬は受け取れません。');return model.claim(wallet,actual.id,actual.amount);});
}
window.WeeklyRewards={read,settle,letters,claim,scores};
window.addEventListener('learning-data-ready',()=>settle().catch(error=>console.warn('週間郵便は接続後に再確認します',error)));
window.addEventListener('online',()=>settle().catch(()=>{}));
})();
