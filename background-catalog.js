// One shared, versioned photo catalogue; user selections remain separate.
(function(){
'use strict';
const cacheKey='aiglish_shared_background_catalog',chunk=280000;
let inFlight=null,lastRead=0,retryAfter=0,lastError=null,cachedRaw,cached;
const image=value=>typeof value==='string'&&value.length<=1000000&&/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(value);
function normalize(value){
 if(!value||!Array.isArray(value.backgrounds)||value.backgrounds.length>12)throw Error('共有背景の一覧を読み取れませんでした。');
 const ids=new Set();let size=0;
 const backgrounds=value.backgrounds.map(item=>{if(!item||typeof item.id!=='string'||ids.has(item.id)||!image(item.image))throw Error('共有背景の写真を読み取れませんでした。');ids.add(item.id);const preview=image(item.preview)?item.preview:'';size+=item.image.length+preview.length;return {id:item.id,image:item.image,preview,position:Math.max(0,Math.min(100,Number(item.position)||0))};});
 if(size>4000000)throw Error('共有背景の容量が上限を超えています。');
 return {...value,backgrounds,knownIds:[...new Set([...(Array.isArray(value.knownIds)?value.knownIds:[]),...ids])]};
}
function readCache(){const raw=localStorage.getItem(cacheKey);if(raw===cachedRaw)return cached;cachedRaw=raw;try{cached=raw?normalize(JSON.parse(raw)):null;}catch(error){cached=null;}return cached;}
function checksum(raw){let result=2166136261;for(let i=0;i<raw.length;i++){result^=raw.charCodeAt(i);result=Math.imul(result,16777619);}return (result>>>0).toString(16);}
function ref(...path){return window.fbDoc(window.db,'shared','backgrounds',...path);}
function available(){return window.db&&window.fbDoc&&window.fbGetDoc;}
function deadline(task){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('共有背景の通信が完了しませんでした。接続後に再試行してください。')),12000);Promise.resolve(task).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});}
async function get(reference){try{return await deadline((window.fbGetDocFromServer||window.fbGetDoc)(reference));}catch(error){if(String(error.code||'').includes('resource-exhausted')){const failure=Error('共有先（Firestore）の利用上限に達しているため、ほかのユーザーに背景を配信できません。Firebaseの利用状況を確認し、上限の回復後に再試行してください。');failure.code='resource-exhausted';throw failure;}throw error;}}
async function fetchCatalog(){
 const snap=await get(ref());if(!snap.exists())return null;const meta=snap.data();
 if(typeof meta.generation!=='string'||!Number.isInteger(meta.partCount)||meta.partCount<1||meta.partCount>16||meta.rawLength>4500000)throw Error('共有背景の保存情報が不正です。');
 const local=readCache();if(local?.generation===meta.generation)return local;
 const parts=[];for(let i=0;i<meta.partCount;i++){const part=await get(ref('parts',meta.generation+'_p'+i));if(!part.exists()||typeof part.data().d!=='string'||part.data().d.length>chunk)throw Error('共有背景の一部を読み取れませんでした。');parts.push(part.data().d);}
 const raw=parts.join('');if(raw.length!==meta.rawLength||checksum(raw)!==meta.checksum)throw Error('共有背景の保存内容が一致しません。');
 return normalize({...JSON.parse(raw),generation:meta.generation,updatedAt:meta.updatedAt});
}
async function install(value){localStorage.setItem(cacheKey,JSON.stringify(value));if(window.AppStorage)await AppStorage.flush();window.dispatchEvent(new Event('background-catalog-changed'));return value;}
function refresh(force=false){
 if(inFlight)return inFlight;if(!force&&Date.now()<retryAfter)return Promise.reject(lastError);if(!available())return Promise.reject(Error('共有先にまだ接続できていません。接続後に再試行してください。'));if(!force&&Date.now()-lastRead<60000)return Promise.resolve(readCache());
 inFlight=(async()=>{const value=await fetchCatalog();if(value&&value.generation!==readCache()?.generation)await install(value);lastRead=Date.now();retryAfter=0;lastError=null;return value||readCache();})().catch(error=>{lastError=error;retryAfter=Date.now()+30000;throw error;}).finally(()=>inFlight=null);return inFlight;
}
async function publish({upserts=[],remove=[]}={}){
 if(!available()||!window.fbSetDoc||!window.fbRunTransaction)throw Error('共有先に接続できません。写真は登録できていません。接続後に再試行してください。');
 if(inFlight)await inFlight;
 for(let attempt=0;attempt<3;attempt++){
  const current=await fetchCatalog()||{backgrounds:[],knownIds:[],generation:''};
  const entries=new Map(current.backgrounds.map(item=>[item.id,item]));for(const id of remove)entries.delete(id);for(const item of upserts)entries.set(item.id,item);
  const next=normalize({backgrounds:[...entries.values()],knownIds:[...new Set([...current.knownIds,...remove,...upserts.map(item=>item.id)])],updatedAt:Date.now()});
  const raw=JSON.stringify(next),generation=Date.now().toString(36)+'_'+Math.random().toString(36).slice(2),partCount=Math.ceil(raw.length/chunk);
  for(let i=0;i<partCount;i++)await deadline(window.fbSetDoc(ref('parts',generation+'_p'+i),{d:raw.slice(i*chunk,(i+1)*chunk)},{merge:false}));
  const committed=await deadline(window.fbRunTransaction(window.db,async tx=>{const snap=await tx.get(ref());if((snap.exists()?snap.data().generation:'')!==current.generation)return false;tx.set(ref(),{generation,partCount,rawLength:raw.length,checksum:checksum(raw),updatedAt:next.updatedAt},{merge:false});return true;}));
  if(!committed)continue;
  // Read the committed manifest/content before announcing registration to the administrator.
  const confirmed=await fetchCatalog();if(!confirmed)throw Error('共有背景の保存を確認できませんでした。');await install(confirmed);retryAfter=0;lastError=null;return confirmed;
 }
 throw Error('ほかの管理者が更新しました。もう一度お試しください。');
}
window.BackgroundCatalog={cacheKey,readCache,refresh,publish};
})();
