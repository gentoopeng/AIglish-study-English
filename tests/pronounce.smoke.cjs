// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/pronounce.smoke.cjs
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
// The device's speech engine is replaced by a recorder.
await page.addInitScript(()=>{localStorage.setItem('b3_tutorial_done','1');window.__spoken=[];
 const voices=[{lang:'en-US',name:'US voice',localService:true},{lang:'en-GB',name:'UK voice',localService:true},{lang:'ja-JP',name:'JP voice',localService:true}];
 Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speak:u=>window.__spoken.push({text:u.text,lang:u.lang,rate:u.rate,voice:u.voice?.name}),cancel(){},getVoices:()=>voices,addEventListener(){}}});
 window.SpeechSynthesisUtterance=function(text){this.text=text;};});
await page.goto('http://127.0.0.1:8000',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.openBookFlashcardSettings&&window.__saveCoordinatorApplied&&window.Pronounce);
await page.getByRole('button',{name:'ゲストで試す'}).click();
await page.evaluate(()=>{textbooksPool=[{id:'test-book',name:'テスト単語帳',cover:'📘'}];textbooksCacheMap['test-book']=[{num:1,word:'study',meaning:'学ぶ',meanings:[{id:'1-0',text:'学ぶ'}]},{num:2,word:"don't",meaning:'しない',meanings:[{id:'2-0',text:'しない'}]}];window.switchTab('vocab');window.showVocabLibrarySelection();});
await page.getByRole('button',{name:'テスト単語帳の学習方法を選ぶ'}).click();await page.getByRole('button',{name:'単語カード',exact:true}).click();
await page.getByRole('button',{name:'カードを開始する'}).click();await page.waitForFunction(()=>flashcardOriginQueue.length>0&&document.getElementById('activeFlashcard'));
const spoken=()=>page.evaluate(()=>window.__spoken.slice());
// Auto-play is off by default: showing a card says nothing. The speaker beside the card reads the
// English word without flipping or rating the card.
assert.deepEqual(await spoken(),[]);
const current=await page.evaluate(()=>flashcardOriginQueue[flashcardCurrentIndex].en);
await page.locator('#flashcardSpeakButton').click();
assert.deepEqual(await spoken(),[{text:current,lang:'en-US',rate:0.9,voice:'US voice'}]);
assert.equal(await page.locator('#activeFlashcard.flipped').count(),0);
assert.equal(await page.evaluate(()=>flashcardOriginQueue[flashcardCurrentIndex].en),current);
// Settings: accent, speed and automatic reading when a card appears.
await page.evaluate(()=>{const set=(id,value)=>{const n=document.getElementById(id);if(n.type==='checkbox')n.checked=value;else n.value=value;n.dispatchEvent(new Event('change'));};set('pronounceAccent','en-GB');set('pronounceRate','1.1');set('pronounceAuto',true);});
assert.deepEqual(JSON.parse(await page.evaluate(()=>localStorage.getItem('aiglish_pronounce_settings'))),{enabled:true,auto:true,rate:1.1,accent:'en-GB'});
await page.evaluate(()=>window.renderFlashcardDeck());
assert.deepEqual((await spoken()).at(-1),{text:current,lang:'en-GB',rate:1.1,voice:'UK voice'});
// Japanese first: the English is read when the card is turned over, not when it appears.
const before=(await spoken()).length;
await page.evaluate(()=>{flashcardDirectionMode='ja2en';window.renderFlashcardDeck();});
assert.equal((await spoken()).length,before);
// The card floats continuously, so skip Playwright's wait for it to stop moving.
await page.locator('#activeFlashcard').click({force:true});await page.waitForFunction(()=>document.getElementById('activeFlashcard').classList.contains('flipped'));
await page.waitForFunction(n=>window.__spoken.length===n+1,before);
assert.equal((await spoken()).at(-1).text,current);
// Word list: each row has a speaker; apostrophes survive the HTML escaping.
await page.evaluate(()=>{flashcardDirectionMode='en2ja';window.renderVocabList();});
const row=page.locator('.word-speak-button[data-say="don\'t"]');await row.waitFor({state:'attached'});
await row.evaluate(button=>button.click());
assert.equal((await spoken()).at(-1).text,"don't");
// Turning pronunciation off hides every speaker button and stops reading.
await page.evaluate(()=>{const n=document.getElementById('pronounceEnabled');n.checked=false;n.dispatchEvent(new Event('change'));});
assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('pronounce-off')),true);
assert.equal(await page.evaluate(()=>getComputedStyle(document.getElementById('flashcardSpeakButton')).display),'none');
assert.equal(await page.evaluate(()=>window.Pronounce.speak('study')),false);
assert.deepEqual(errors,[]);
console.log('PASS: flashcard speaker reads without flipping, settings (accent, speed, auto on show and on flip), word-list speakers, off hides buttons');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
