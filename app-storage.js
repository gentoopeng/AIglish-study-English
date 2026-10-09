// Preserve synchronous reads, keeping large/overflow values durably in IndexedDB.
(function(){
'use strict';
const native=window.localStorage,large=65536,values=new Map(),pending=new Map(),originals=new Map();
const rawGet=native.getItem.bind(native),rawSet=native.setItem.bind(native),rawRemove=native.removeItem.bind(native);
let database=null,running=null,retry=null,scheduled=false,lastFailure=null,revision=0,keysRevision=-1,keyCache=[],channel=null;
const nativeKeys=()=>Object.keys(native);
const owned=key=>/^(core_v4_|aiglish_|save_studio_|vv4_|b3_|__ste_reset_gen_)/.test(key)||['wordMemory','textHistory','myBookshelf','myFolders'].includes(key);
function keys(){if(keysRevision!==revision){const names=new Set(nativeKeys());for(const [key,value] of values){if(value===null)names.delete(key);else names.add(key);}keyCache=[...names];keysRevision=revision;}return keyCache;}
function get(key){key=String(key);return values.has(key)?values.get(key):rawGet(key);}
function failure(error){const changed=!lastFailure;lastFailure=error;if(changed){console.warn('端末の保存先を利用できません。保存データは消していません。',error);window.dispatchEvent(new CustomEvent('app-storage-error',{detail:'端末への保存を確認できません。空き容量・ブラウザー設定を確認してください。'}));}}
function transaction(rows){return new Promise((resolve,reject)=>{if(!database){reject(Error('端末の保存先を開けませんでした。'));return;}const tx=database.transaction('values','readwrite'),store=tx.objectStore('values');for(const [key,value] of rows){if(value===null)store.delete(key);else store.put(value,key);}tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('端末への保存に失敗しました。'));tx.onerror=()=>{};});}
async function flush(){
 if(retry){clearTimeout(retry);retry=null;}
 if(running){await running;if(pending.size)return flush();return;}
 if(!pending.size)return;
 const rows=[...pending];running=transaction(rows);
 try{await running;lastFailure=null;const committed=[];for(const [key,value] of rows){if(pending.get(key)===value){pending.delete(key);if(rawGet(key)===originals.get(key)||rawGet(key)===value)rawRemove(key);originals.delete(key);if(value===null)values.delete(key);committed.push(key);}}revision++;if(channel&&committed.length)channel.postMessage(committed);}
 catch(error){failure(error);throw error;}finally{running=null;}
 if(pending.size)return flush();
}
function schedule(){if(running||retry||scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;flush().catch(()=>{if(!retry)retry=setTimeout(()=>{retry=null;schedule();},10000);});});}
function write(key,value){key=String(key);value=String(value);if(get(key)===value)return;
 if(!values.has(key)&&value.length<large){try{rawSet(key,value);revision++;return;}catch(error){if(error.name!=='QuotaExceededError'&&error.code!==22&&error.code!==1014)throw error;}}
 if(!values.has(key))originals.set(key,rawGet(key));values.set(key,value);pending.set(key,value);revision++;schedule();
}
function remove(key){key=String(key);if(!values.has(key)){rawRemove(key);revision++;return;}if(!originals.has(key))originals.set(key,rawGet(key));values.set(key,null);pending.set(key,null);revision++;schedule();}
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
 if(window.BroadcastChannel){channel=new BroadcastChannel('aiglish-local-values');channel.onmessage=async event=>{if(!Array.isArray(event.data))return;const tx=database.transaction('values','readonly');for(const key of event.data){if(typeof key!=='string')continue;const request=tx.objectStore('values').get(key);request.onsuccess=()=>{if(pending.has(key))return;const oldValue=get(key),value=request.result===undefined?null:request.result;if(value===null)values.delete(key);else values.set(key,value);revision++;window.dispatchEvent(new StorageEvent('storage',{key,oldValue,newValue:value,storageArea:native,url:location.href}));};}};}
 await new Promise((resolve,reject)=>{const tx=database.transaction('values','readonly'),request=tx.objectStore('values').openCursor();request.onsuccess=()=>{const cursor=request.result;if(cursor){if(!pending.has(cursor.key))values.set(cursor.key,cursor.value);cursor.continue();}};tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
 // Legacy large values move only after a successful transaction. No records are pruned.
 for(const key of nativeKeys()){const value=rawGet(key);if(owned(key)&&value!==null&&value.length>=large&&!values.has(key)){originals.set(key,value);values.set(key,value);pending.set(key,value);}}
 revision++;await flush();

})();
ready.catch(failure);
window.AppStorage={ready,flush,get pending(){return pending.size;},get error(){return lastFailure;},setCoordination(key,value){try{rawSet(key,value);revision++;return true;}catch(error){return false;}}};
window.addEventListener('storage',event=>{revision++;if(event.storageArea===native&&event.newValue!==null&&values.has(event.key))write(event.key,event.newValue);});
window.addEventListener('pagehide',()=>flush().catch(()=>{}));document.addEventListener('visibilitychange',()=>{if(document.hidden)flush().catch(()=>{});});
})();
