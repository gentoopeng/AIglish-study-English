const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const type=process.env.BROWSER==='webkit'?webkit:chromium,browser=await type.launch(type===chromium?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{executablePath:process.env.WEBKIT_EXECUTABLE_PATH});try{
const seed=guard=>{if(localStorage.getItem('s'))return;localStorage.setItem('s','1');localStorage.setItem('core_v4_userId','del-user');localStorage.setItem('core_v4_userName','検証');localStorage.setItem('core_v4_current_textbook_id','keep-book');localStorage.setItem('core_v4_cache_keep-book',JSON.stringify([{num:1,word:'keep',meaning:'残す'}]));
 localStorage.setItem('save_studio_del-user_main',JSON.stringify({savedAt:'x',data:{localStorage:{},memory:{vocabBooks:{'keep-book':{master:[{num:1,word:'keep'}]}}}}}));
 localStorage.setItem('save_studio_del-user_slot2',JSON.stringify({savedAt:'x',data:{localStorage:{},memory:{vocabBooks:{'gone-book':{master:[{num:1,word:'gone'}]},'keep-book':{master:[]}}}}}));
 if(guard)localStorage.setItem('__aiglish_deletion_guard',JSON.stringify(guard));
 localStorage.setItem('core_v4_library_deletions_del-user',JSON.stringify({'book:gone-book':{kind:'book',id:'gone-book',metadata:{id:'gone-book'},deletedAt:1,updatedAt:1,pending:true}}));};
// In-memory Firestore with two multi-part cloud saves; only one mentions the deleted book.
const backend=()=>{const store=new Map(),writes=[];window.__writes=writes;window.__store=store;const clone=v=>JSON.parse(JSON.stringify(v));const snap=(path,v)=>({id:path.split('/').pop(),ref:{path},exists:()=>v!==undefined,data:()=>clone(v)});
 const put=(path,v)=>store.set(path,clone(v));const save=(name,raw)=>{put('users/del-user/saves/'+name,{partCount:1,generation:'g1',rawLength:raw.length,checksum:window.__gameSaveChecksum?window.__gameSaveChecksum(raw):undefined});put('users/del-user/saves/'+name+'/parts/g1_p0',{d:raw});};
 window.__seedCloud=()=>{save('main',JSON.stringify({data:{memory:{vocabBooks:{'keep-book':{master:[{num:1}]}}}}}));save('slot2',JSON.stringify({data:{memory:{vocabBooks:{'gone-book':{master:[{num:1}]}}}}}));};
 window.db={};window.fbDoc=(_,...p)=>({path:p.join('/')});window.fbCollection=(_,...p)=>({path:p.join('/')});
 window.fbGetDoc=async r=>snap(r.path,store.get(r.path));window.fbGetDocFromServer=window.fbGetDoc;
 window.fbGetDocs=async r=>{const docs=[...store.entries()].filter(([k])=>k.startsWith(r.path+'/')&&!k.slice(r.path.length+1).includes('/')).map(([k,v])=>snap(k,v));return {docs,size:docs.length,empty:!docs.length,forEach:f=>docs.forEach(f)};};
 window.fbSetDoc=async(r,v,o)=>{writes.push(r.path);put(r.path,o&&o.merge?{...(store.get(r.path)||{}),...v}:v);};window.fbDeleteDoc=async r=>{writes.push('DEL '+r.path);store.delete(r.path);};
 window.fbRunTransaction=async(_,fn)=>{const w=[];const out=await fn({get:async r=>snap(r.path,store.get(r.path)),set:(r,v,o)=>w.push([r,v,o]),update:(r,v)=>w.push([r,v,{merge:true}]),delete:r=>w.push([r,null])});for(const [r,v,o] of w){if(v===null){store.delete(r.path);writes.push('DEL '+r.path);}else{writes.push(r.path);put(r.path,o&&o.merge?{...(store.get(r.path)||{}),...v}:v);}}return out;};};
async function open(guard,clock){const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());if(clock)await page.clock.install();
 await page.route('**/library.js?*',async route=>{const res=await route.fetch();await route.fulfill({response:res,body:'('+backend+')();'+(await res.text())});});
 await page.addInitScript(seed,guard);await page.goto('http://127.0.0.1:8000');if(clock)await page.clock.runFor(3000);await page.waitForFunction(()=>window.__learningBootReady);await page.evaluate(()=>__seedCloud());return {context,page,errors};}
// Pending deletions are not processed at launch; after the delay only the save that mentions the book is rewritten.
let {context,page,errors}=await open(null,true);await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.clock.runFor(20000);
assert.equal(await page.evaluate(()=>__writes.filter(p=>p.includes('/saves/')).length),0,'nothing rewritten at launch, even after reconnecting');
await page.clock.runFor(60000);await page.waitForFunction(()=>JSON.parse(localStorage.getItem('core_v4_library_deletions_del-user'))['book:gone-book'].pending===false,null,{timeout:20000});
const writes=await page.evaluate(()=>__writes.filter(p=>p.includes('/saves/')));
assert.ok(writes.some(p=>p.startsWith('users/del-user/saves/slot2')),JSON.stringify(writes));assert.ok(!writes.some(p=>p.includes('/saves/main')),JSON.stringify(writes));
assert.equal(await page.evaluate(()=>'gone-book' in JSON.parse(localStorage.getItem('save_studio_del-user_slot2')).data.memory.vocabBooks),false);assert.equal(await page.evaluate(()=>localStorage.getItem('save_studio_del-user_main').includes('keep-book')),true);
assert.equal(await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('__aiglish_deletion_guard')))),'{}');assert.deepEqual(errors,[]);await context.close();
// The previous run ended while deletions were processing: automatic processing pauses for 24 hours.
({context,page,errors}=await open({startedAt:Date.now()-5000},true));await page.clock.runFor(10*60000);
assert.equal(await page.evaluate(()=>__writes.filter(p=>/saves\/slot2|libraryDeletions|gone-book/.test(p)).length),0);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('core_v4_library_deletions_del-user'))['book:gone-book'].pending),true);
assert.ok((await page.evaluate(()=>JSON.parse(localStorage.getItem('__aiglish_deletion_guard')).suppressUntil))>Date.now()+23*3600000);
await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.clock.runFor(2000);assert.equal(await page.evaluate(()=>__writes.filter(p=>/saves\/slot2|libraryDeletions|gone-book/.test(p)).length),0);assert.deepEqual(errors,[]);await context.close();
console.log('PASS '+type.name()+': no deletion processing at launch; only the save mentioning the book is rewritten; a run that ended mid-processing pauses automatic processing for 24 hours');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
