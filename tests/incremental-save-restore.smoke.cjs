const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const type=process.env.BROWSER==='webkit'?webkit:chromium,browser=await type.launch(type===chromium?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{executablePath:process.env.WEBKIT_EXECUTABLE_PATH});try{
// Device A writes an itemized backup; a fresh device B logs in and restores it through the normal startup path.
const store=new Map(),errors=[];
async function device(seed){
 const context=await browser.newContext({viewport:{width:402,height:874}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
 await page.exposeFunction('__fsGet',path=>store.has(path)?JSON.parse(JSON.stringify(store.get(path))):null);
 await page.exposeFunction('__fsSet',(path,data,merge)=>{store.set(path,merge?{...(store.get(path)||{}),...data}:data);});
 await page.exposeFunction('__fsDel',path=>{store.delete(path);});
 await page.exposeFunction('__fsList',prefix=>[...store.keys()].filter(path=>path.startsWith(prefix+'/')&&!path.slice(prefix.length+1).includes('/')).map(path=>[path,store.get(path)]));
 await page.addInitScript(()=>{
  const snap=(path,value)=>({id:path.split('/').pop(),ref:{path},exists:()=>value!==null&&value!==undefined,data:()=>value,metadata:{fromCache:false}});
  const clean=v=>JSON.parse(JSON.stringify(v,(k,x)=>x===undefined?null:x));
  window.db={};window.fbDoc=(_, ...p)=>({path:p.join('/')});window.fbCollection=(_, ...p)=>({path:p.join('/')});window.fbCollectionGroup=(_,name)=>({path:'__group__/'+name});
  window.fbQuery=ref=>ref;window.fbWhere=()=>null;window.fbOrderBy=()=>null;window.fbLimit=()=>null;window.fbStartAfter=()=>null;window.fbDocumentId=()=>'__id__';window.fbServerTimestamp=()=>Date.now();
  window.fbGetDoc=async ref=>snap(ref.path,await window.__fsGet(ref.path));window.fbGetDocFromServer=window.fbGetDoc;
  window.fbGetDocs=async ref=>{const rows=(await window.__fsList(ref.path)).map(([p,v])=>snap(p,v));return {docs:rows,size:rows.length,empty:!rows.length,forEach:f=>rows.forEach(f)};};
  window.fbSetDoc=async(ref,data,options)=>window.__fsSet(ref.path,clean(data),!!options?.merge||!!options?.mergeFields);window.fbDeleteDoc=async ref=>window.__fsDel(ref.path);
  window.fbRunTransaction=async(_,fn)=>{const writes=[];const tx={get:async ref=>snap(ref.path,await window.__fsGet(ref.path)),set:(ref,data,options)=>{writes.push([ref.path,clean(data),!!options?.merge||!!options?.mergeFields]);return tx;},update:(ref,data)=>{writes.push([ref.path,clean(data),true]);return tx;},delete:ref=>{writes.push([ref.path,null]);return tx;}};const out=await fn(tx);for(const [p,d,m] of writes){if(d===null)await window.__fsDel(p);else await window.__fsSet(p,d,m);}return out;};
  window.fbOnSnapshot=()=>()=>{};
 });
 await page.addInitScript(seed);
 await page.goto('http://127.0.0.1:8000');await page.waitForFunction(()=>window.__learningBootReady,null,{timeout:60000});return {context,page};
}
// Device A: a logged-in account with a large understanding record and a large custom setting.
let a=await device(()=>{if(localStorage.getItem('seeded'))return;localStorage.setItem('seeded','1');localStorage.setItem('core_v4_userId','xdev');localStorage.setItem('core_v4_userName','検証');localStorage.setItem('core_v4_current_textbook_id','xbook');localStorage.setItem('__aiglish_warmup_guard',JSON.stringify({suppressUntil:Date.now()+3600000}));
 const words=Array.from({length:1500},(_,i)=>({num:i+1,word:'word'+i,meaning:'意味'+i}));localStorage.setItem('core_v4_cache_xbook',JSON.stringify(words));
 const progress=Object.fromEntries(words.map(w=>[w.num,{status:w.num%2?'ok':'bad',history:['ok','bad'],editedAt:1000}]));localStorage.setItem('core_v4_user_vocab_progress_xdev_xbook',JSON.stringify(progress));localStorage.setItem('core_v4_user_vocab_progress_xdev_xbook__ts','1000');
 localStorage.setItem('aiglish_large_setting_check','L'.repeat(50000));});
const saved=await a.page.evaluate(()=>window.__backgroundSaveAll());assert.equal(saved.cloudSaved,true,JSON.stringify(saved));
const manifest=store.get('users/xdev/saves/main');assert.equal(manifest.v,6);assert.ok(manifest.entries.some(e=>e.k==='ls:aiglish_large_setting_check'));
// A second save after one answer resends far less than the first.
const before=[...store.keys()].filter(p=>p.startsWith('users/xdev/saveEntries/')).length;
await a.page.evaluate(()=>{const key='core_v4_user_vocab_progress_xdev_xbook',p=JSON.parse(localStorage.getItem(key));p[2]={...p[2],status:'ok',editedAt:2000};localStorage.setItem(key,JSON.stringify(p));});
const second=await a.page.evaluate(()=>window.__backgroundSaveAll());assert.equal(second.cloudSaved,true);
const manifest2=store.get('users/xdev/saves/main');const reused=manifest2.entries.filter(e=>manifest.entries.some(o=>o.k===e.k&&o.g===e.g)).length;assert.ok(reused>=1,'some items reused');
assert.equal(manifest2.entries.find(e=>e.k==='ls:aiglish_large_setting_check').g,manifest.entries.find(e=>e.k==='ls:aiglish_large_setting_check').g);
await a.context.close();
// Device B: only the login; restore comes from the itemized cloud backup.
let b=await device(()=>{if(localStorage.getItem('seeded'))return;localStorage.setItem('seeded','1');localStorage.setItem('core_v4_userId','xdev');localStorage.setItem('__aiglish_warmup_guard',JSON.stringify({suppressUntil:Date.now()+3600000}));});
const restored=await b.page.evaluate(()=>({large:(localStorage.getItem('aiglish_large_setting_check')||'').length,progress2:LearningData.read('xbook')[2]?.status,progress1:LearningData.read('xbook')[1]?.status,name:localStorage.getItem('core_v4_userName')}));
assert.equal(restored.large,50000,JSON.stringify(restored));assert.equal(restored.progress1,'ok');assert.equal(restored.progress2,'ok');
await b.context.close();
assert.deepEqual(errors.filter(m=>!/Failed to fetch|NetworkError|net::/.test(m)),[]);
console.log('PASS '+type.name()+': itemized backup restored on a fresh device ('+manifest.entries.length+' items, '+reused+' reused after one answer)');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
