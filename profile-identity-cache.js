// Shared, bounded public name/photo cache. Only changed photos need a second download.
(function(root){
'use strict';
const TTL=300000,MAX=32,entries=new Map(),jobs=new Map(),storageJobs=new Set();let database;
const viewer=()=>typeof myId==='string'&&myId?myId:'GUEST-000';
const project=()=>root.db?.app?.options?.projectId||'';
const scope=()=>project()+'\n'+viewer()+'\n';
function compact(id,data){let profile={};try{profile=typeof data.profileCustomizationJson==='string'?JSON.parse(data.profileCustomizationJson):data.profileCustomizationJson||{};}catch{}const avatar=data.deleted?'':String(data.avatar??profile?.avatar??'');return {id,name:data.deleted?id:String(data.playerName||data.name||profile?.nickname||id),avatar:avatar.length<=48000&&/^(https?:\/\/|data:image\/(png|jpeg|webp);base64,)/i.test(avatar)?avatar:'',deleted:!!data.deleted,revision:data.avatarUpdatedAt==null?null:String(data.avatarUpdatedAt),checkedAt:Date.now()};}
function db(){if(database)return database;database=new Promise(resolve=>{if(!root.indexedDB)return resolve(null);const request=indexedDB.open('aiglish-public-identities',1);request.onupgradeneeded=()=>request.result.createObjectStore('identities',{keyPath:'key'}).createIndex('checkedAt','entry.checkedAt');request.onsuccess=()=>resolve(request.result);request.onerror=request.onblocked=()=>resolve(null);});return database;}
async function disk(key){try{const store=await db();if(!store)return null;return await new Promise(resolve=>{const req=store.transaction('identities').objectStore('identities').get(key);req.onsuccess=()=>resolve(req.result?.entry||null);req.onerror=()=>resolve(null);});}catch{return null;}}
async function persist(key,entry){try{const store=await db();if(!store)return;await new Promise(resolve=>{const tx=store.transaction('identities','readwrite'),items=tx.objectStore('identities');items.put({key,entry});const request=items.count();request.onsuccess=()=>{let remove=request.result-MAX;if(remove>0){const cursor=items.index('checkedAt').openKeyCursor();cursor.onsuccess=()=>{if(cursor.result&&remove>0){items.delete(cursor.result.primaryKey);remove--;if(remove>0)cursor.result.continue();}}}};tx.oncomplete=tx.onerror=tx.onabort=resolve;});}catch{/* Memory cache still works when persistence is unavailable. */}}
function remember(id,data){const key=scope()+id,entry=compact(id,data);entries.delete(key);entries.set(key,entry);while(entries.size>MAX)entries.delete(entries.keys().next().value);const job=persist(key,entry);storageJobs.add(job);job.finally(()=>storageJobs.delete(job));return entry;}
async function fetchFields(id,fields){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const url=new URL('https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(project())+'/databases/(default)/documents/users/'+encodeURIComponent(id));fields.forEach(field=>url.searchParams.append('mask.fieldPaths',field));const response=await fetch(url,{signal:controller.signal});if(response.status===404)return {deleted:true};const body=await response.json();if(!response.ok){const error=Error(body.error?.message||'プロフィールを取得できません。');error.code=response.status===429?'resource-exhausted':body.error?.status;throw error;}return Object.fromEntries(Object.entries(body.fields||{}).map(([key,value])=>[key,value.stringValue??value.integerValue??value.doubleValue??value.booleanValue??null]));}finally{clearTimeout(timer);}}
async function get(id){
 const key=scope()+id,accountScope=scope();if(jobs.has(key))return jobs.get(key);
 const task=(async()=>{let cached=entries.get(key)||await disk(key);if(scope()!==accountScope)return {id,name:id,avatar:''};if(cached){entries.set(key,cached);while(entries.size>MAX)entries.delete(entries.keys().next().value);if(Date.now()-cached.checkedAt>=0&&Date.now()-cached.checkedAt<TTL)return cached;}
  if(!project()||root.FirestoreReadGuard?.paused())return cached||{id,name:id,avatar:''};
  const read=root.FirestoreReadGuard?.wrap?.(fetchFields)||fetchFields;
  try{let data;
   if(cached){data=await read(id,['playerName','avatarUpdatedAt','deleted']);if(scope()!==accountScope)return {id,name:id,avatar:''};if(data.deleted)return remember(id,data);
    if(cached.revision!==null&&data.avatarUpdatedAt!=null&&cached.revision===String(data.avatarUpdatedAt))return remember(id,{...data,playerName:data.playerName??cached.name,avatar:cached.avatar});}
   data=await read(id,['playerName','avatar','avatarUpdatedAt','deleted']);return scope()===accountScope?remember(id,data):{id,name:id,avatar:''};
  }catch{return cached||{id,name:id,avatar:''};}
 })();jobs.set(key,task);try{return await task;}finally{if(jobs.get(key)===task)jobs.delete(key);}
}
root.ProfileIdentityCache={get,remember,compact,flush:async()=>{await Promise.all([...storageJobs]);},ttl:TTL};
if(typeof module!=='undefined')module.exports={compact};
})(typeof window==='undefined'?globalThis:window);
