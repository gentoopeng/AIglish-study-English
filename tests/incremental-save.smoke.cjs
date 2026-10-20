const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const type=process.env.BROWSER==='webkit'?webkit:chromium,browser=await type.launch(type===chromium?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{executablePath:process.env.WEBKIT_EXECUTABLE_PATH});try{
// Itemized (v6) backups: only changed items are sent, the manifest is replaced last, legacy backups stay readable.
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());await page.goto('http://127.0.0.1:8000');await page.getByRole('button',{name:'ゲストとしてテストプレイ'}).click();await page.waitForFunction(()=>window.__learningBootReady);
const r=await page.evaluate(async()=>{
 myId='inc-user';window.db={};currentTextbook='inc-book';window.LearningData.canSave=()=>true;
 const docs=new Map([['users/inc-user',{}]]),writes=[],deletes=[];let fail=false;
 const snap=path=>({exists:()=>docs.has(path),data:()=>docs.get(path),ref:{path}});
 window.fbDoc=(_, ...parts)=>({path:parts.join('/')});window.fbCollection=(_, ...parts)=>({path:parts.join('/')});
 window.fbSetDoc=async(ref,data,options)=>{writes.push(ref.path);docs.set(ref.path,options?.merge?{...docs.get(ref.path),...data}:data);};window.fbGetDoc=async ref=>snap(ref.path);window.fbDeleteDoc=async ref=>{deletes.push(ref.path);docs.delete(ref.path);};
 window.fbGetDocs=async ref=>{const rows=[...docs.keys()].filter(path=>path.startsWith(ref.path+'/')&&!path.slice(ref.path.length+1).includes('/')).map(snap);return {docs:rows,forEach:f=>rows.forEach(f),size:rows.length,empty:!rows.length};};
 window.fbRunTransaction=async(_,fn)=>{const w=[];const out=await fn({get:async ref=>snap(ref.path),set:(ref,data,options)=>w.push([ref.path,data,options])});if(fail&&w.some(([path])=>path.includes('/saveEntries/')))throw Error('offline');for(const [path,data,options]of w){writes.push(path);docs.set(path,options?.merge?{...docs.get(path),...data}:data);}return out;};AccountWriteGuard.install();
 const master=[{num:1,word:'save',meaning:'保存する'}],progress={1:{status:'ok',history:['ok'],updatedAt:1000}};
 let state={big:'a'.repeat(700000),other:'o'.repeat(30000),tiny:'t'};
 const bigMaster=Array.from({length:3000},(_,i)=>({num:i+1,word:'w'+i,meaning:'意味'+i}));let memProgress={1:{status:'ok'}};const otherBook={master:bigMaster,progress:Object.fromEntries(bigMaster.map(w=>[w.num,{status:'ok',history:['ok','ok']}]))};
 window.__collectGameSaveData=()=>({localStorage:{...state},memory:{vocabBookKey:currentTextbook,vocabMaster:bigMaster,vocabProgress:{...progress,...memProgress},vocabBooks:{'other-book':otherBook}}});
 const entryWrites=()=>writes.filter(path=>path.includes('/saveEntries/'));
 const manifest=()=>docs.get('users/inc-user/saves/main');
 // A legacy whole-text backup is readable and is removed after the first itemized save.
 const legacy=JSON.stringify({slot:'main',savedAt:'2026-01-01T00:00:00Z',data:{localStorage:{legacyKey:'kept'},memory:{}}});
 docs.set('users/inc-user/saves/main',{v:5,generation:'old',partCount:1,rawLength:legacy.length,checksum:__gameSaveChecksum(legacy)});docs.set('users/inc-user/saves/main/parts/old_p0',{d:legacy});
 const legacyRead=(await __fetchCloudSave('inc-user')).data.localStorage.legacyKey;
 // First itemized save sends every item.
 await __backgroundSaveAll();const first=entryWrites().length,firstManifest=manifest();
 const legacyRemoved=!docs.has('users/inc-user/saves/main/parts/old_p0');
 const restored=await __fetchCloudSave('inc-user');
 // Nothing large changed: only the small bundle / memory items may be resent; the 700k item is reused.
 writes.length=0;state={...state,tiny:'t2'};await __backgroundSaveAll();const unchangedLarge=entryWrites().filter(path=>docs.get(path)?.k==='ls:big').length;const second=entryWrites().length;
 const bigGenSame=manifest().entries.find(e=>e.k==='ls:big').g===firstManifest.entries.find(e=>e.k==='ls:big').g;
 // Only the current book's understanding changes: the other large book item is reused.
 writes.length=0;memProgress={1:{status:'bad'}};await __backgroundSaveAll();const masterResent=entryWrites().filter(path=>docs.get(path)?.k==='book:other-book').length;const after=(await __fetchCloudSave('inc-user')).data.memory;const masterRestored=Object.keys(after.vocabBooks['other-book'].progress||{}).length;
 // Change only the large item: only it is resent (3 parts of 280k).
 writes.length=0;state={...state,big:'b'.repeat(700000)};await __backgroundSaveAll();const changedBig=entryWrites().filter(path=>docs.get(path)?.k==='ls:big').length,changedOther=entryWrites().filter(path=>docs.get(path)?.k==='ls:other').length;
 const afterChange=await __fetchCloudSave('inc-user');
 // An interrupted save keeps the previous manifest and its items readable.
 const before=manifest().generation;fail=true;state={...state,big:'c'.repeat(700000)};const interrupted=await __backgroundSaveAll();fail=false;const generationKept=manifest().generation===before;
 const stillReadable=(await __fetchCloudSave('inc-user')).data.localStorage.big[0];
 // Daily cleanup deletes only unreferenced items older than an hour.
 const oldGen=(Date.now()-7200000).toString(36)+'_stale',freshGen=Date.now().toString(36)+'_fresh';
 docs.set('users/inc-user/saveEntries/'+oldGen+'_0',{k:'ls:big',g:oldGen,i:0,n:1,d:'x'});docs.set('users/inc-user/saveEntries/'+freshGen+'_0',{k:'ls:big',g:freshGen,i:0,n:1,d:'y'});
 localStorage.removeItem('save_studio_entries_gc_inc-user');state={...state,tiny:'t3'};await __backgroundSaveAll();
 const referenced=manifest().entries.every(e=>docs.has('users/inc-user/saveEntries/'+e.g+'_0'));
 return {masterResent,masterRestored,legacyRead,first,legacyRemoved,restoredBig:restored.data.localStorage.big.length,restoredTiny:restored.data.localStorage.tiny,restoredProgress:restored.data.memory.vocabProgress[1].status,second,unchangedLarge,bigGenSame,changedBig,changedOther,afterChange:afterChange.data.localStorage.big[0],interrupted,generationKept,stillReadable,staleRemoved:!docs.has('users/inc-user/saveEntries/'+oldGen+'_0'),freshKept:docs.has('users/inc-user/saveEntries/'+freshGen+'_0'),referenced,v:manifest().v};
});
assert.equal(r.masterResent,0,JSON.stringify(r));assert.equal(r.masterRestored,3000);assert.equal(r.legacyRead,'kept');assert.equal(r.legacyRemoved,true);assert.equal(r.v,6);
assert.ok(r.first>=5,JSON.stringify(r));assert.equal(r.restoredBig,700000);assert.equal(r.restoredTiny,'t');assert.equal(r.restoredProgress,'ok');
assert.equal(r.unchangedLarge,0);assert.equal(r.bigGenSame,true);assert.ok(r.second<r.first,JSON.stringify(r));
assert.equal(r.changedBig,3);assert.equal(r.changedOther,0);assert.equal(r.afterChange,'b');
assert.equal(r.interrupted.cloudSaved,false);assert.equal(r.generationKept,true);assert.equal(r.stillReadable,'b');
assert.equal(r.staleRemoved,true);assert.equal(r.freshKept,true);assert.equal(r.referenced,true);assert.deepEqual(errors,[]);
console.log('PASS '+type.name()+': itemized backup '+JSON.stringify({first:r.first,second:r.second,changedBig:r.changedBig}));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
