const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../multi.js'),'utf8');
const loader=source.slice(source.indexOf("if(!window.__manualDraftBookLoaderApplied"),source.indexOf('\nfunction collectAllData()',source.indexOf("if(!window.__manualDraftBookLoaderApplied")));
function setup(){
 const values=new Map(); let release;
 const old={master:[{num:1,word:'study'}],progress:{1:{status:'bad',history:['bad'],note:'old'}},savedAt:new Date(1000).toISOString()};
 const ctx={myId:'user-a',currentTextbook:'book-a',textbooksCacheMap:{},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},console};
 ctx.window=ctx;
 ctx.__vocabSavedAtMs=value=>Date.parse(value||'')||0;
 ctx.__manualVocabDrafts={'book-a':old};
 ctx.__manualVocabLocalKey=k=>'draft_'+ctx.myId+'_'+k;
 ctx.getVocabProgressStorageKey=k=>'progress_'+ctx.myId+'_'+k;
 ctx.__mergeNewestLocalVocabProgress=(k,d)=>{
  const raw=values.get(ctx.getVocabProgressStorageKey(k)); const ts=Number(values.get(ctx.getVocabProgressStorageKey(k)+'__ts'));
  return raw&&ts>=Date.parse(d.savedAt)?{...d,progress:JSON.parse(raw),savedAt:new Date(ts).toISOString()}:d;
 };
 ctx.loadCurrentTextbookData=()=>new Promise(r=>{release=r});
 ctx.__applyManualVocabDraft=(k,d)=>{ctx.applied=d};
 vm.runInNewContext(loader,ctx);
 return {ctx,values,release:()=>release()};
}
test('a progress change during a book load survives the delayed response',async()=>{
 const {ctx,values,release}=setup();const pending=ctx.loadCurrentTextbookData();
 const latest={1:{status:'ok',history:['bad','ok'],note:'new note'}};
 values.set('progress_user-a_book-a',JSON.stringify(latest));values.set('progress_user-a_book-a__ts','2000');
 release();await pending;assert.deepEqual(ctx.applied.progress,latest);
});
test('a delayed book load does not replace the selected book',async()=>{
 const {ctx,release}=setup();const pending=ctx.loadCurrentTextbookData();ctx.currentTextbook='book-b';release();await pending;assert.equal(ctx.applied,undefined);
});
test('a delayed book load does not apply another user’s draft',async()=>{
 const {ctx,release}=setup();const pending=ctx.loadCurrentTextbookData();ctx.myId='user-b';release();await pending;assert.equal(ctx.applied,undefined);
});
const autoLoader=source.slice(source.indexOf('async function autoLoadOnce()'),source.indexOf('\nfunction openPanel()',source.indexOf('async function autoLoadOnce()')));
test('restart preserves a newer local textbook draft than the integrated save',async()=>{
 const values=new Map();
 const recent={master:[{num:1,word:'new word'}],progress:{},savedAt:new Date(3000).toISOString()};
 const old={...recent,master:[{num:1,word:'old word'}],savedAt:new Date(1000).toISOString()};
 values.set('core_v4_vocab_draft_user-a_book-a',JSON.stringify(recent));
 values.set('save',JSON.stringify({savedAt:new Date(2000).toISOString(),data:{localStorage:{core_v4_vocab_draft_user_a:'unused','core_v4_vocab_draft_user-a_book-a':JSON.stringify(old)}}}));
 const ctx={loginUid:()=> 'user-a',localKey:()=> 'save',cloudMetaKey:()=> 'cloud-meta',localMetaKey:()=> 'local-meta',console,localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}};
 ctx.window=ctx;vm.runInNewContext(autoLoader,ctx);await ctx.autoLoadOnce();
 assert.deepEqual(JSON.parse(values.get('core_v4_vocab_draft_user-a_book-a')),recent);
});
const appSource=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const progressStart=appSource.lastIndexOf('window.loadUserVocabProgress = async function(bookKey) {');
const progressLoader=appSource.slice(progressStart,appSource.indexOf('\n};',progressStart)+3);
test('a cloud response after account switching cannot write into the new account',async()=>{
 const values=new Map();let release;const writes=[];
 const ctx={myId:'user-a',currentTextbook:'book-a',console,currentUserVocabProgress:{},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},db:{},fbDoc:(...args)=>args,fbGetDoc:()=>new Promise(r=>release=r),fbSetDoc:(...args)=>writes.push(args),getVocabProgressStorageKey:book=>'progress_'+ctx.myId+'_'+book};
 ctx.window=ctx;vm.runInNewContext(progressLoader,ctx);const pending=ctx.loadUserVocabProgress('book-a');ctx.myId='user-b';
 release({exists:()=>true,data:()=>({wordsJson:JSON.stringify({1:{status:'bad'}}),updatedAt:new Date().toISOString()})});await pending;
 assert.equal(values.size,0);assert.equal(writes.length,0);
});
const bookStart=appSource.indexOf('window.loadCurrentTextbookData = async function(options) {');
const bookLoader=appSource.slice(bookStart,appSource.indexOf('\n};',bookStart)+3);
test('a cached textbook displays saved progress without waiting for cloud access',async()=>{
 let reads=0,renders=0;
 const progress={1:{status:'ok'}};
 const ctx={currentTextbook:'book-a',myId:'user-a',textbooksCacheMap:{'book-a':[{num:1,word:'study'}]},textbooksPool:[],userStats:{},document:{getElementById:()=>null},localStorage:{getItem:()=>null},stripVocabProgressFromWords:words=>words,migrateVocabData:words=>words,loadUserVocabProgress:()=>{reads++;return new Promise(()=>{})},applyUserProgressToVocabList:()=>{},updateFlashcardSourceSelectOptions:()=>{},renderVocabList:()=>renders++};
 ctx.window=ctx;vm.runInNewContext(bookLoader,ctx);await ctx.loadCurrentTextbookData({localProgress:progress});
 assert.equal(reads,0);assert.equal(renders,1);assert.equal(ctx.currentUserVocabProgress,progress);
});
test('a cached draft is not applied and rendered twice when unchanged',async()=>{
 const {ctx,release}=setup();const pending=ctx.loadCurrentTextbookData();release();await pending;assert.equal(ctx.applied,undefined);
});
test('restart does not restore a deleted textbook from an older library snapshot',async()=>{
 const values=new Map();const key='core_v4_personal_library_user-a';
 const latest={books:[],hidden:['deleted-book'],savedAt:new Date(3000).toISOString()};
 const old={books:[{id:'deleted-book'}],hidden:[],savedAt:new Date(1000).toISOString()};
 values.set(key,JSON.stringify(latest));values.set('save',JSON.stringify({savedAt:new Date(2000).toISOString(),data:{localStorage:{[key]:JSON.stringify(old)}}}));
 const ctx={loginUid:()=> 'user-a',localKey:()=> 'save',cloudMetaKey:()=> 'cloud-meta',localMetaKey:()=> 'local-meta',console,localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}};ctx.window=ctx;vm.runInNewContext(autoLoader,ctx);await ctx.autoLoadOnce();assert.deepEqual(JSON.parse(values.get(key)),latest);
});
test('restart preserves newer workbook answers and deletions against an older integrated save',async()=>{
 for(const latest of ['[]',JSON.stringify([{id:'new',units:[{status:'ok'}]}])]){
  const values=new Map();const key='vv4_works_user-a';
  values.set(key,latest);values.set(key+'__ts','3000');
  values.set('save',JSON.stringify({savedAt:new Date(2000).toISOString(),data:{localStorage:{[key]:JSON.stringify([{id:'old'}]),[key+'__ts']:'1000'}}}));
  const ctx={loginUid:()=> 'user-a',localKey:()=> 'save',cloudMetaKey:()=> 'cloud-meta',localMetaKey:()=> 'local-meta',console,localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}};ctx.window=ctx;vm.runInNewContext(autoLoader,ctx);await ctx.autoLoadOnce();assert.equal(values.get(key),latest);assert.equal(values.get(key+'__ts'),'3000');
 }
});
test('restart does not re-enable sharing over a newer private-note preference',async()=>{
 const values=new Map();const key='core_v4_vocab_note_sharing_user-a_word';
 const latest={enabled:false,published:false,savedAt:new Date(3000).toISOString()};
 values.set(key,JSON.stringify(latest));values.set('save',JSON.stringify({savedAt:new Date(2000).toISOString(),data:{localStorage:{[key]:JSON.stringify({enabled:true,savedAt:new Date(1000).toISOString()})}}}));
 const ctx={loginUid:()=> 'user-a',localKey:()=> 'save',cloudMetaKey:()=> 'cloud-meta',localMetaKey:()=> 'local-meta',console,localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}};ctx.window=ctx;vm.runInNewContext(autoLoader,ctx);await ctx.autoLoadOnce();assert.deepEqual(JSON.parse(values.get(key)),latest);
});
