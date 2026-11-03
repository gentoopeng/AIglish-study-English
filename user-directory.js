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
   for(const doc of docs){if(!active())throw Error('読み込みを中止しました。');const data=doc.data();window.ProfileIdentityCache?.remember(doc.id,data);await visit(doc.id,data);await new Promise(resolve=>setTimeout(resolve,0));}
   cursor=docs[docs.length-1];if(!paged||docs.length<10)break;
  }while(active());
  if(!active())throw Error('通信が完了しませんでした。');
 });
 queue=task.catch(()=>{});return task;
}
// Players active since `since` (ms), read with only the fields a list needs, plus the given
// ids (friends) that were quiet longer. One query per 50 players instead of every whole user
// document; null when the project's REST endpoint is not known (then use scan).
const LIST_FIELDS=['playerName','userName','name','avatar','profileCustomizationJson','deleted','lastActiveAt','lastLoginAt','updatedAt','learningRankingV2Json','studyLedgerJson','userStatsJson','statistics','user_stats','stats','userStats'];
async function recent(since,ids=[],{signal}={}){
 const project=window.db?.app?.options?.projectId,decode=window.RankingQuery?.fields;
 if(!/^[a-z0-9-]+$/.test(project||'')||!decode||typeof fetch!=='function')return null;
 const base='https://firestore.googleapis.com/v1/projects/'+project+'/databases/(default)/documents';
 const request=async(path,body)=>{const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});const data=await response.json();if(!response.ok||!Array.isArray(data)){const error=Error(data.error?.message||'ユーザーを取得できませんでした。');error.code=response.status===429?'resource-exhausted':data.error?.status;throw error;}return data;};
 const read=window.FirestoreReadGuard?.wrap?.(request)||request;
 const select={fields:LIST_FIELDS.map(fieldPath=>({fieldPath}))},from=new Date(since).toISOString(),found=new Map();
 let cursor;
 do{
  const structuredQuery={from:[{collectionId:'users'}],select,where:{fieldFilter:{field:{fieldPath:'lastActiveAt'},op:'GREATER_THAN_OR_EQUAL',value:{stringValue:from}}},orderBy:[{field:{fieldPath:'lastActiveAt'},direction:'ASCENDING'},{field:{fieldPath:'__name__'},direction:'ASCENDING'}],limit:50};
  if(cursor)structuredQuery.startAt={values:[cursor.fields.lastActiveAt,{referenceValue:cursor.name}],before:false};
  const page=(await read(':runQuery',{structuredQuery})).filter(item=>item.document).map(item=>item.document);
  for(const document of page){const id=document.name.split('/').pop(),data=decode(document.fields);window.ProfileIdentityCache?.remember(id,data);found.set(id,data);}
  cursor=page[page.length-1];
  if(page.length<50)break;
 }while(!signal?.aborted);
 const missing=[...new Set(ids)].filter(id=>id&&!found.has(id)&&/^[^/]{1,128}$/.test(id));
 if(missing.length&&!signal?.aborted){
  const root='projects/'+project+'/databases/(default)/documents/users/';
  const extras=await read(':batchGet',{documents:missing.map(id=>root+encodeURIComponent(id)),mask:{fieldPaths:LIST_FIELDS}});
  for(const item of extras)if(item.found){const id=decodeURIComponent(item.found.name.split('/').pop()),data=decode(item.found.fields);window.ProfileIdentityCache?.remember(id,data);found.set(id,data);}
 }
 if(signal?.aborted)throw new DOMException('中止しました','AbortError');
 return [...found].map(([id,data])=>({id,data}));
}
window.UserDirectory={scan,recent};
})();
