// Project only visible ranking fields. A page is bounded; leaving the view aborts the read.
(function(root){
'use strict';
const identity=['playerName','name','avatar','profileCustomizationJson','deleted','lastActiveAt','lastLoginAt'];
const legacy=['learningRankingV2Json','studyLedgerJson','userStatsJson','statistics','user_stats','stats','userStats'];
function monthAgo(now){const shifted=new Date(now+9*3600000),day=shifted.getUTCDate();shifted.setUTCDate(1);shifted.setUTCMonth(shifted.getUTCMonth()-1);const end=new Date(shifted);end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0);shifted.setUTCDate(Math.min(day,end.getUTCDate()));return shifted.getTime()-9*3600000;}
function timestamp(value){return typeof value==='number'?value:Date.parse(value||'');}
function eligible(doc,now){const at=timestamp(doc.lastLoginAt??doc.lastActiveAt);return !doc.deleted&&Number.isFinite(at)&&at>=monthAgo(now)&&at<=now;}
function summary(doc){const v=doc.rankingLearningSummaryV1;return v?.epoch==='learning-reset-3.52'&&v.studyEpoch==='study-reset-2.62'&&['time','words','flash'].every(key=>Number.isFinite(v[key])&&v[key]>=0)?v:null;}
function decode(value){if(!value)return null;if('stringValue'in value)return value.stringValue;if('integerValue'in value)return Number(value.integerValue);if('doubleValue'in value)return value.doubleValue;if('booleanValue'in value)return value.booleanValue;if('timestampValue'in value)return value.timestampValue;if('mapValue'in value)return fields(value.mapValue.fields);if('arrayValue'in value)return (value.arrayValue.values||[]).map(decode);return null;}
function fields(values){return Object.fromEntries(Object.entries(values||{}).map(([key,value])=>[key,decode(value)]));}
function query(group,now,cursor){const result={from:[{collectionId:'users'}],select:{fields:[...identity,...(group==='battle'?['wordDuelRating']:['rankingLearningSummaryV1'])].map(fieldPath=>({fieldPath}))},where:{fieldFilter:{field:{fieldPath:'lastActiveAt'},op:'GREATER_THAN_OR_EQUAL',value:{stringValue:new Date(monthAgo(now)).toISOString()}}},orderBy:[{field:{fieldPath:'lastActiveAt'},direction:'ASCENDING'},{field:{fieldPath:'__name__'},direction:'ASCENDING'}],limit:20};if(cursor)result.startAt={values:[cursor.fields.lastActiveAt,{referenceValue:cursor.name}],before:false};return result;}
async function load(group,{signal,now=Date.now()}={}){
 const project=root.db?.app?.options?.projectId;if(!/^[a-z0-9-]+$/.test(project||''))throw Error('ランキングの接続先を確認できません。');
 const base='https://firestore.googleapis.com/v1/projects/'+project+'/databases/(default)/documents';
 const request=async(path,body)=>{const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});const data=await response.json();if(!response.ok||!Array.isArray(data)){const error=Error(data.error?.message||'記録を取得できませんでした。');error.code=response.status===429?'resource-exhausted':data.error?.status;throw error;}return data;};
 const read=root.FirestoreReadGuard?.wrap(request)||request;
 const result=[];let cursor;
 do{
  const page=(await read(':runQuery',{structuredQuery:query(group,now,cursor)})).filter(item=>item.document).map(item=>item.document);
  if(signal?.aborted)throw new DOMException('中止しました','AbortError');
  const recent=page.map(document=>({document,id:document.name.split('/').pop(),data:fields(document.fields)})).filter(item=>item.id!=='GUEST-000'&&eligible(item.data,now));
  if(group==='learning'){
   const missing=recent.filter(item=>!summary(item.data));
   if(missing.length){const extras=await read(':batchGet',{documents:missing.map(item=>item.document.name),mask:{fieldPaths:legacy}});const byName=new Map(extras.filter(item=>item.found).map(item=>[item.found.name,fields(item.found.fields)]));for(const item of missing)Object.assign(item.data,byName.get(item.document.name)||{});}
  }
  result.push(...recent.map(({id,data})=>({id,data})));cursor=page[page.length-1];
  if(page.length<20)break;
  await new Promise(resolve=>setTimeout(resolve,0));
 }while(!signal?.aborted);
 if(signal?.aborted)throw new DOMException('中止しました','AbortError');return [...new Map(result.map(item=>[item.id,item])).values()];
}
const model={monthAgo,eligible,summary,decode,fields,query,legacy};root.RankingQuery={...model,fetch:load};if(typeof module!=='undefined')module.exports=model;
})(typeof window==='undefined'?globalThis:window);
