// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/hands-free.smoke.cjs
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
// Speech, media buttons, the wake lock and audio playback are replaced by recorders.
await page.addInitScript(()=>{localStorage.setItem('b3_tutorial_done','1');window.__spoken=[];window.__media={};window.__wake=0;window.__playing=0;
 Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speak:u=>{window.__spoken.push({text:u.text,lang:u.lang});setTimeout(()=>u.onend?.(),20);},cancel(){},getVoices:()=>[{lang:'en-US',name:'US',localService:true},{lang:'ja-JP',name:'JP',localService:true}],addEventListener(){}}});
 window.SpeechSynthesisUtterance=function(text){this.text=text;};window.MediaMetadata=function(data){Object.assign(this,data);};
 Object.defineProperty(navigator,'mediaSession',{configurable:true,value:{metadata:null,playbackState:'none',setActionHandler(action,handler){if(handler)window.__media[action]=handler;else delete window.__media[action];}}});
 Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:async()=>{window.__wake++;return {release:async()=>{window.__wake--;},addEventListener(){}};}}});
 HTMLMediaElement.prototype.play=function(){window.__playing++;Object.defineProperty(this,'paused',{configurable:true,value:false});return Promise.resolve();};
 HTMLMediaElement.prototype.pause=function(){Object.defineProperty(this,'paused',{configurable:true,value:true});};});
await page.goto('http://127.0.0.1:8000',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.openBookFlashcardSettings&&window.__saveCoordinatorApplied&&window.HandsFree);
await page.getByRole('button',{name:'ゲストで試す'}).click();
await page.evaluate(()=>{textbooksPool=[{id:'hf-book',name:'ハンズフリー',cover:'📘'}];textbooksCacheMap['hf-book']=[{num:1,word:'apple',meaning:'りんご',meanings:[{id:'1-0',text:'りんご'}]},{num:2,word:'bread',meaning:'パン',meanings:[{id:'2-0',text:'パン'}]},{num:3,word:'cheese',meaning:'チーズ',meanings:[{id:'3-0',text:'チーズ'}]}];window.switchTab('vocab');window.showVocabLibrarySelection();
 const delay=document.getElementById('handsFreeAnswerDelay');delay.value='1';delay.dispatchEvent(new Event('change'));});
assert.deepEqual(JSON.parse(await page.evaluate(()=>localStorage.getItem('aiglish_handsfree_settings'))),{answerDelay:1});
const open=async()=>{await page.getByRole('button',{name:'ハンズフリーの学習方法を選ぶ'}).click();await page.getByRole('button',{name:'単語カード',exact:true}).click();await page.getByRole('button',{name:'カードを開始する'}).click();await page.waitForFunction(()=>document.getElementById('activeFlashcard'));};
await open();
const state=()=>page.evaluate(()=>({index:flashcardCurrentIndex,active:HandsFree.active(),handlers:Object.keys(window.__media).sort(),wake:window.__wake,spoken:window.__spoken.slice(),bar:!document.getElementById('handsFreeBar').hidden,flipped:!!document.querySelector('#activeFlashcard.flipped')}));
// Turning it on: media buttons are claimed, the screen stays awake, the card is read, then its answer.
await page.locator('#flashcardHandsFreeButton').click();
let s=await state();assert.equal(s.active,true);assert.equal(s.bar,true);assert.deepEqual(s.handlers,['nexttrack','pause','play','previoustrack']);assert.equal(s.wake,1);assert.ok(await page.evaluate(()=>window.__playing)>=1);
const order=await page.evaluate(()=>flashcardOriginQueue.map(w=>({en:w.en,ja:w.ja,num:w.num})));
assert.deepEqual(s.spoken[0],{text:order[0].en,lang:'en-US'});
await page.waitForFunction(()=>window.__spoken.length>=2,null,{timeout:4000});s=await state();
assert.deepEqual(s.spoken[1],{text:order[0].ja,lang:'ja-JP'});assert.equal(s.flipped,true);
assert.equal(await page.evaluate(()=>navigator.mediaSession.metadata.title),order[0].en);
// Once the answer is read, the lock screen shows it under the word.
assert.equal(await page.evaluate(()=>navigator.mediaSession.metadata.artist),order[0].ja);
// One press ○, two presses ×, three presses △ (play/pause, next track, previous track).
const rated=num=>page.evaluate(n=>{const r=LearningData.read('hf-book')[String(n)];return r?.meanings?.[n+'-0']?.status||r?.status||'';},num);
await page.evaluate(()=>{window.__activity=0;const original=IdleSleep.activity;IdleSleep.activity=()=>{window.__activity++;original();};});
await page.evaluate(()=>window.__media.pause());assert.equal((await state()).index,1);
// A rating from the earphones counts as activity, so idle sleep does not cut in during pocket use.
assert.equal(await page.evaluate(()=>window.__activity),1);assert.equal(await rated(order[0].num),'ok');
await page.waitForTimeout(650);await page.evaluate(()=>window.__media.nexttrack());assert.equal((await state()).index,2);assert.equal(await rated(order[1].num),'bad');
// A second press within 0.6 s is ignored, so one gesture never rates two cards.
await page.evaluate(()=>window.__media.nexttrack());assert.equal((await state()).index,2);
await page.waitForTimeout(650);await page.evaluate(()=>window.__media.previoustrack());assert.equal(await rated(order[2].num),'so');
// The deck is done: hands-free mode lets go of the buttons and the wake lock.
await page.waitForFunction(()=>!HandsFree.active());s=await state();assert.deepEqual(s.handlers,[]);assert.equal(s.wake,0);
// Keyboards and presentation clickers: → ○, ← ×, ↑ △, Space turns the card.
await page.waitForFunction(()=>!document.getElementById('activeFlashcard')||getComputedStyle(document.getElementById('flashcard-play-screen')).display==='none');
// Finishing the deck may show a message in the app's dialog; close it as a user would.
await page.evaluate(async()=>{for(let i=0;i<5&&document.querySelector('dialog.app-alert');i++){document.querySelector('dialog.app-alert button').click();await new Promise(r=>setTimeout(r,50));}});
await page.evaluate(()=>{window.switchTab('vocab');window.showVocabLibrarySelection();});await open();
await page.keyboard.press('Space');assert.equal((await state()).flipped,true);
await page.waitForTimeout(650);await page.keyboard.press('ArrowLeft');assert.equal((await state()).index,1);
// Pocket mode: a black cover that ignores taps; holding it for 2 seconds removes it.
await page.locator('#flashcardHandsFreeButton').click();await page.locator('#handsFreePocket').click();
const cover=page.locator('.handsfree-pocket');await cover.waitFor();
await cover.click();assert.equal(await cover.count(),1);assert.equal((await state()).index,1);
await page.mouse.move(195,420);await page.mouse.down();await page.waitForTimeout(2200);await page.mouse.up();
assert.equal(await cover.count(),0);assert.equal((await state()).active,true);
await page.locator('#handsFreeStop').click();s=await state();assert.equal(s.active,false);assert.equal(s.wake,0);assert.equal(s.bar,false);
assert.deepEqual(errors,[]);
console.log('PASS: media buttons rate ○/×/△ with a double-press guard, card then answer read after the set delay, wake lock held and released, keyboard shortcuts, pocket cover with long-press exit');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
