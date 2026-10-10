// Preserve synchronous reads, keeping large/overflow values durably in IndexedDB.
(function(){
'use strict';
const native=window.localStorage,large=65536,values=new Map(),pending=new Map(),originals=new Map(),nativeWrites=new Map();
const rawGet=native.getItem.bind(native),rawSet=native.setItem.bind(native),rawRemove=native.removeItem.bind(native);
let database=null,running=null,retry=null,scheduled=false,lastFailure=null,revision=0,keysRevision=-1,keyCache=[],channel=null;
const nativeKeys=()=>Object.keys(native);
const owned=key=>/^(core_v4_|aiglish_|save_studio_|vv4_|b3_|__ste_reset_gen_)/.test(key)||['wordMemory','textHistory','myBookshelf','myFolders'].includes(key);
// Ratings keep a synchronous working copy; IndexedDB is also a durable mirror.
const critical=key=>key.startsWith('core_v4_user_vocab_progress_')||key.startsWith('aiglish_learning_recovery_')||(key.startsWith('aiglish_app_background_')&&!key.startsWith('aiglish_app_background_catalog_'));
// Mirror small catalogues too, without pushing large photographs into native storage.
const mirrored=key=>critical(key)||key.startsWith('aiglish_app_background_catalog_')||key==='aiglish_shared_background_catalog'||key.startsWith('core_v4_word_duel_pending_');
function keys(){if(keysRevision!==revision){const names=new Set(nativeKeys());for(const [key,value] of values){if(value===null)names.delete(key);else names.add(key);}keyCache=[...names];keysRevision=revision;}return keyCache;}
function get(key){key=String(key);return values.has(key)?values.get(key):rawGet(key);}
function failure(error){const changed=!lastFailure;lastFailure=error;if(changed){console.warn('端末の保存先を利用できません。保存データは消していません。',error);window.dispatchEvent(new CustomEvent('app-storage-error',{detail:'端末への保存を確認できません。空き容量・ブラウザー設定を確認してください。'}));}}
function transaction(rows){return new Promise((resolve,reject)=>{if(!database){reject(Error('端末の保存先を開けませんでした。'));return;}const tx=database.transaction('values','readwrite'),store=tx.objectStore('values');for(const [key,value] of rows){if(value===null)store.delete(key);else store.put(value,key);}tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('端末への保存に失敗しました。'));tx.onerror=()=>{};});}
async function flush(){
 // Early rendering/diagnostic writes may overflow before IndexedDB has opened.
 // Queue them until hydration succeeds; never report a missing database as a write failure.
 if(!database)await ready;
 if(retry){clearTimeout(retry);retry=null;}
 if(running){await running;if(pending.size)return flush();return;}
 if(!pending.size)return;
 const rows=[...pending];running=transaction(rows);
 try{await running;lastFailure=null;const committed=[];for(const [key,value] of rows){if(pending.get(key)===value){pending.delete(key);if(nativeWrites.get(key)!==value&&(rawGet(key)===originals.get(key)||rawGet(key)===value))rawRemove(key);nativeWrites.delete(key);originals.delete(key);if(value===null)values.delete(key);committed.push(key);}}revision++;if(channel&&committed.length)channel.postMessage(committed);}
 catch(error){failure(error);throw error;}finally{running=null;}
 if(pending.size)return flush();
}
function schedule(){if(!database||running||retry||scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;flush().catch(()=>{if(!retry)retry=setTimeout(()=>{retry=null;schedule();},10000);});});}
function write(key,value){key=String(key);value=String(value);if(get(key)===value)return;
 const prior=rawGet(key);let synchronous=false;
 // A paired timestamp must not commit before its overflow snapshot.
 const overflowStamp=key.endsWith('__ts')&&pending.has(key.slice(0,-4))&&nativeWrites.get(key.slice(0,-4))!==pending.get(key.slice(0,-4));
 if(!overflowStamp&&(critical(key)||value.length<large)){try{rawSet(key,value);synchronous=true;revision++;if(!values.has(key)&&!mirrored(key))return;}catch(error){if(error.name!=='QuotaExceededError'&&error.code!==22&&error.code!==1014)throw error;}}
 if(!originals.has(key))originals.set(key,prior);
 if(synchronous)nativeWrites.set(key,value);else nativeWrites.delete(key);
 values.set(key,value);pending.set(key,value);revision++;schedule();
}
function remove(key){key=String(key);if(!values.has(key)){rawRemove(key);revision++;return;}if(!originals.has(key))originals.set(key,rawGet(key));nativeWrites.delete(key);rawRemove(key);values.set(key,null);pending.set(key,null);revision++;schedule();}
const facade=new Proxy(native,{
 get(target,property){if(property==='getItem')return get;if(property==='setItem')return write;if(property==='removeItem')return remove;if(property==='key')return index=>keys()[Number(index)]??null;if(property==='length')return keys().length;if(property==='clear')return ()=>{for(const key of keys().slice())remove(key);};if(typeof property==='string'&&values.has(property))return get(property);const value=Reflect.get(target,property,target);return typeof value==='function'?value.bind(target):value;},
 set(target,property,value){write(property,value);return true;},deleteProperty(target,property){remove(property);return true;},
 ownKeys:()=>keys().slice(),getOwnPropertyDescriptor(target,property){if(values.has(property)){const value=get(property);return value===null?undefined:{configurable:true,enumerable:true,writable:true,value};}return Reflect.getOwnPropertyDescriptor(target,property);}
});
Object.defineProperty(window,'localStorage',{configurable:true,value:facade});
const ready=(async()=>{
 database=await new Promise((resolve,reject)=>{
  const request=indexedDB.open('aiglish-local-values',1);let settled=false;
  const timer=setTimeout(()=>fail(Error('保存データの読み込みが完了しませんでした。')),12000);
  function fail(error){if(settled)return;settled=true;clearTimeout(timer);reject(error);}
  request.onupgradeneeded=()=>{if(settled){request.transaction.abort();return;}request.result.createObjectStore('values');};
  request.onsuccess=()=>{if(settled){request.result.close();return;}settled=true;clearTimeout(timer);resolve(request.result);};
  request.onerror=()=>fail(request.error);request.onblocked=()=>fail(Error('保存データを開けません。ほかのタブを閉じてください。'));
 });
 database.onversionchange=()=>database.close();
 if(window.BroadcastChannel){channel=new BroadcastChannel('aiglish-local-values');channel.onmessage=async event=>{if(!Array.isArray(event.data))return;const tx=database.transaction('values','readonly');for(const key of event.data){if(typeof key!=='string')continue;const request=tx.objectStore('values').get(key);request.onsuccess=()=>{if(pending.has(key))return;const oldValue=get(key),value=request.result===undefined?null:request.result;if(value===null){values.delete(key);rawRemove(key);}else{values.set(key,value);if(critical(key)){try{rawSet(key,value);}catch(error){rawRemove(key);}}else if(rawGet(key)!==null&&rawGet(key)!==value)rawRemove(key);}revision++;window.dispatchEvent(new StorageEvent('storage',{key,oldValue,newValue:value,storageArea:native,url:location.href}));};}};}
 await new Promise((resolve,reject)=>{const tx=database.transaction('values','readonly'),request=tx.objectStore('values').openCursor();request.onsuccess=()=>{const cursor=request.result;if(cursor){if(!pending.has(cursor.key))values.set(cursor.key,cursor.value);cursor.continue();}};tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
 // Legacy large values move only after a successful transaction. No records are pruned.
 for(const key of nativeKeys()){const value=rawGet(key);if(!owned(key)||value===null||pending.has(key))continue;
  // A surviving native value may have been written by an older open app/tab.
  // Never hide it behind an older IndexedDB snapshot.
  if(values.has(key)||value.length>=large||mirrored(key)){
   // Background metadata can survive in native storage with an older timestamp.
   // Prefer the confirmed IndexedDB copy when it is newer.
   if((key.startsWith('aiglish_app_background_')||key==='aiglish_shared_background_catalog')&&values.has(key)){try{if((JSON.parse(values.get(key)).updatedAt||0)>(JSON.parse(value).updatedAt||0)){try{if(!critical(key)&&values.get(key).length>=large)rawRemove(key);else rawSet(key,values.get(key));}catch(error){rawRemove(key);}continue;}}catch(error){}}
   const differs=values.get(key)!==value;values.set(key,value);
   if(differs){originals.set(key,value);pending.set(key,value);}
   if(critical(key))nativeWrites.set(key,value);
  }}
 revision++;await flush();

})();
ready.catch(failure);
window.AppStorage={ready,flush,get pending(){return pending.size;},get error(){return lastFailure;},setCoordination(key,value){try{rawSet(key,value);revision++;return true;}catch(error){return false;}}};
window.addEventListener('storage',event=>{revision++;if(event.isTrusted&&event.storageArea===native&&event.newValue!==null&&values.has(event.key)&&!pending.has(event.key)){
 // Native removal also occurs after overflow migration; only IDB broadcasts
 // represent a confirmed logical deletion.
 if(values.get(event.key)!==event.newValue){originals.set(event.key,event.newValue);values.set(event.key,event.newValue);pending.set(event.key,event.newValue);if(critical(event.key))nativeWrites.set(event.key,event.newValue);schedule();}
}});
window.addEventListener('pagehide',()=>flush().catch(()=>{}));document.addEventListener('visibilitychange',()=>{if(document.hidden)flush().catch(()=>{});});
})();
