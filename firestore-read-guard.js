// Back off globally on a confirmed quota error; never fabricate empty snapshots.
(function(){
'use strict';
let until=0;const wrapped=new WeakSet(),documents=new Map();
function documentRead(fn){return function(ref,...args){const viewer=typeof myId==='string'?myId:'',database=ref?.firestore||window.db,path=ref?.path;if(!path||args.length)return fn.call(this,ref,...args);let cache=documents.get(database);if(!cache){cache=new Map();documents.set(database,cache);}const key=viewer+'\n'+path;if(cache.has(key))return cache.get(key);const task=Promise.resolve().then(()=>fn.call(this,ref)).finally(()=>{if(cache.get(key)===task)cache.delete(key);if(!cache.size&&documents.get(database)===cache)documents.delete(database);});cache.set(key,task);return task;};}

function invalidate(ref){const database=ref?.firestore||window.db,cache=documents.get(database);if(cache)for(const key of cache.keys())if(key.endsWith('\n'+ref.path))cache.delete(key);}
function transactionRead(fn){return async function(database,...args){try{return await fn.call(this,database,...args);}finally{documents.delete(database);}};}
function writeInvalidating(fn){return async function(ref,...args){invalidate(ref);try{return await fn.call(this,ref,...args);}finally{invalidate(ref);}};}
function quota(error){return /resource-exhausted|quota.*exceed|429/i.test(String(error?.code||'')+' '+String(error?.message||''));}
function wrap(fn){return async function(...args){if(Date.now()<until){const error=Error('クラウドの利用上限に達したため、端末の保存記録を使います。後で再試行してください。');error.code='resource-exhausted';throw error;}try{return await fn.apply(this,args);}catch(error){if(quota(error)){until=Date.now()+300000;window.dispatchEvent(new CustomEvent('cloud-quota-paused'));}throw error;}};}
window.FirestoreReadGuard={wrap,install(){for(const name of ['fbGetDoc','fbGetDocFromServer','fbGetDocs','fbRunTransaction'])if(typeof window[name]==='function'&&!wrapped.has(window[name])){const guarded=wrap(window[name]);window[name]=name==='fbGetDoc'?documentRead(guarded):name==='fbRunTransaction'?transactionRead(guarded):guarded;wrapped.add(window[name]);}for(const name of ['fbSetDoc','fbDeleteDoc'])if(typeof window[name]==='function'&&!wrapped.has(window[name])){window[name]=writeInvalidating(window[name]);wrapped.add(window[name]);}},paused:()=>Date.now()<until};
})();
