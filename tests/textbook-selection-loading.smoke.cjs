const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const type=process.env.BROWSER==='webkit'?webkit:chromium,browser=await type.launch(type===chromium?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{executablePath:process.env.WEBKIT_EXECUTABLE_PATH});try{
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());await page.goto('http://127.0.0.1:8000');await page.getByRole('button',{name:'ゲストとしてテストプレイ'}).click();await page.waitForFunction(()=>window.__learningBootReady);
const result=await page.evaluate(async()=>{
 const words=Array.from({length:3000},(_,i)=>({num:i+1,word:'word'+i,meaning:'意味'+i,sub:'補足説明'.repeat(20)}));
 const progress={'1':{sig:'1::word0::意味0',status:'ok',history:['ok'],meanings:{'1-0':{status:'ok',history:['ok']}},note:'消えないメモ',sticky:true,editedAt:Date.now()}};
 textbooksPool=['large-a','large-b'].map(id=>({id,name:id}));
 for(const book of textbooksPool)localStorage.setItem(__manualVocabLocalKey(book.id),JSON.stringify({master:words,progress,savedAt:new Date().toISOString()}));
 switchTab('vocab');let renders=0,fullCopies=0,progressReads=0;const render=window.renderVocabList,stringify=JSON.stringify;
 window.renderVocabList=function(){renders++;return render.apply(this,arguments);};JSON.stringify=function(value){if(value?.master?.length===3000)fullCopies++;return stringify.apply(this,arguments);};
 window.loadUserVocabProgress=async book=>{progressReads++;currentUserVocabProgress=LearningData.read(book);};
 try{
 const first=selectVocabLibraryBook('large-a'),same=selectVocabLibraryBook('large-a');const coalesced=first===same,blocked=!LearningData.canSave('large-a');await first;
 const initialRenders=renders;let retained=true,maxCards=0;
 for(let i=0;i<10;i++){await selectVocabLibraryBook(i%2?'large-a':'large-b');maxCards=Math.max(maxCards,document.querySelectorAll('#vocabListContainer .word-row-container').length);retained=retained&&vocabList.length===3000&&vocabList[0].meanings[0].status==='ok'&&vocabList[0].note==='消えないメモ'&&vocabList[0].sticky;}
 localStorage.setItem(__manualVocabLocalKey('large-empty'),stringify({master:words,progress:{},savedAt:new Date().toISOString()}));const beforeEmpty=renders;await selectVocabLibraryBook('large-empty');const emptyRenderedOnce=renders-beforeEmpty===1;await selectVocabLibraryBook('large-a');
 const canonical=__manualVocabDrafts[currentTextbook].master[0];vocabList[0].word='表示だけ変更';const isolated=canonical.word==='word0';
 // A request superseded before its work starts must not fetch or render.
 const before=renders,stale=selectVocabLibraryBook('large-b'),latest=selectVocabLibraryBook('large-a');await Promise.all([stale,latest]);
 return {emptyRenderedOnce,coalesced,blocked,initialRenders,renders,fullCopies,progressReads,retained,maxCards,isolated,canceledBeforeWork:renders-before===1,ready:LearningData.canSave('large-a'),selected:currentTextbook};
 }finally{JSON.stringify=stringify;}
});assert.equal(result.emptyRenderedOnce,true);assert.equal(result.coalesced,true);assert.equal(result.blocked,true);assert.equal(result.initialRenders,1);assert.equal(result.retained,true);assert.equal(result.maxCards,40);assert.equal(result.isolated,true);assert.equal(result.canceledBeforeWork,true);assert.equal(result.ready,true);assert.equal(result.selected,'large-a');assert.equal(result.fullCopies,0);const race=await page.evaluate(async()=>{
 myId='selection-race';window.__manualVocabDrafts={};window.db={};window.fbDoc=(_, ...parts)=>parts.join('/');const waiting=[];
 const word=name=>({num:1,word:name,meaning:'意味'}),progress=name=>({'1':{sig:'1::'+name+'::意味',status:'ok',history:['ok'],editedAt:Date.now(),meanings:{'1-0':{status:'ok',history:['ok']}}}});
 localStorage.setItem(__manualVocabLocalKey('race-b'),JSON.stringify({master:[word('bridge')],progress:progress('bridge'),savedAt:new Date().toISOString()}));
 window.fbGetDoc=ref=>ref.endsWith('/race-a')?new Promise(resolve=>waiting.push(resolve)):Promise.resolve({exists:()=>false});
 const pause=()=>new Promise(resolve=>setTimeout(resolve,5));
 const old=selectVocabLibraryBook('race-a');while(waiting.length<1)await pause();await selectVocabLibraryBook('race-b');const latest=selectVocabLibraryBook('race-a');while(waiting.length<2)await pause();
 const snap=name=>({exists:()=>true,data:()=>({masterJson:JSON.stringify([word(name)]),progressJson:JSON.stringify(progress(name)),updatedAt:new Date().toISOString()})});
 waiting[0](snap('stale'));await old;const ignored=vocabList[0].word==='bridge'&&!LearningData.canSave('race-a');waiting[1](snap('newest'));await latest;
 return {ignored,word:vocabList[0].word,ready:LearningData.canSave('race-a'),status:vocabList[0].meanings[0].status};
});assert.equal(race.ignored,true);assert.equal(race.word,'newest');assert.equal(race.ready,true);assert.equal(race.status,'ok');assert.deepEqual(errors,[]);console.log('PASS',type.name(),'3000-word repeated selection, one render per load, duplicate coalescing, early save gate, no whole-draft serialization, immutable masters and retained ratings/notes');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
