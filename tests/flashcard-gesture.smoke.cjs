const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const type=process.env.BROWSER==='webkit'?webkit:chromium,browser=await type.launch(type===chromium?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{executablePath:process.env.WEBKIT_EXECUTABLE_PATH});try{
const page=await browser.newPage({viewport:{width:402,height:874},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
await page.addInitScript(()=>localStorage.setItem('b3_tutorial_done','1'));await page.goto('http://127.0.0.1:8000');await page.getByRole('button',{name:'ゲストとしてテストプレイ'}).click();await page.waitForFunction(()=>window.__learningBootReady);
const long='とても長い意味の説明が続きます。'.repeat(60);
await page.evaluate(long=>{textbooksPool=[{id:'gesture-book',name:'操作確認'}];textbooksCacheMap['gesture-book']=Array.from({length:20},(_,i)=>({num:i+1,word:'word'+i,meaning:'意味'+i}));switchTab('vocab');showVocabLibrarySelection();},long);
await page.getByRole('button',{name:'操作確認の学習方法を選ぶ'}).click();await page.getByRole('button',{name:'単語カード',exact:true}).click();await page.getByRole('button',{name:'カードを開始する'}).click();await page.locator('#activeFlashcard').waitFor({state:'visible'});
const center=async()=>{const b=await page.locator('#activeFlashcard').boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2};};
const state=()=>page.evaluate(()=>{const c=document.getElementById('activeFlashcard');return {index:flashcardCurrentIndex,flipped:c.classList.contains('flipped'),dragging:c.classList.contains('is-dragging'),settling:c.classList.contains('is-settling'),inline:c.style.transform};});
// Finger tremor while tapping never starts a drag; the tap flips once.
let c=await center();await page.mouse.move(c.x,c.y);await page.mouse.down();await page.mouse.move(c.x+3,c.y+2);let s=await state();assert.equal(s.dragging,false);assert.equal(s.inline,'');await page.mouse.up();await page.waitForTimeout(600);s=await state();assert.equal(s.flipped,true);assert.equal(s.index,0);
// A slow short drag returns smoothly (settling) without swiping or flipping.
c=await center();await page.mouse.move(c.x,c.y);await page.mouse.down();for(let i=1;i<=8;i++){await page.mouse.move(c.x+i*5,c.y);await page.waitForTimeout(40);}assert.equal((await state()).dragging,true);await page.mouse.up();s=await state();assert.equal(s.settling,true);assert.equal(s.index,0);assert.equal(s.flipped,true);await page.waitForTimeout(400);s=await state();assert.equal(s.settling,false);assert.equal(s.flipped,true);
// A quick short flick counts as a swipe.
c=await center();await page.mouse.move(c.x,c.y);await page.mouse.down();await page.mouse.move(c.x+20,c.y,{steps:1});await page.mouse.move(c.x+45,c.y,{steps:1});await page.mouse.up();await page.waitForTimeout(500);assert.equal((await state()).index,1);
// The same distance moved slowly is not a swipe.
c=await center();await page.mouse.move(c.x,c.y);await page.mouse.down();for(let i=1;i<=9;i++){await page.mouse.move(c.x-i*5,c.y);await page.waitForTimeout(40);}await page.waitForTimeout(150);await page.mouse.up();await page.waitForTimeout(400);assert.equal((await state()).index,1);
// A long swipe works as before.
c=await center();await page.mouse.move(c.x,c.y);await page.mouse.down();await page.mouse.move(c.x-120,c.y,{steps:8});await page.mouse.up();await page.waitForTimeout(500);assert.equal((await state()).index,2);
await page.evaluate(long=>{const next=flashcardOriginQueue[flashcardCurrentIndex+1];next.en=next.ja=long;},long);
c=await center();await page.mouse.move(c.x,c.y);await page.mouse.down();await page.mouse.move(c.x,c.y-120,{steps:8});await page.mouse.up();await page.waitForTimeout(500);assert.equal((await state()).index,3);
// A swipe that starts on scrollable long text still reaches the card.
assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#activeFlashcard .flashcard-face-front > div')].some(t=>t.style.overflowY==='auto')),true);
const text=await page.locator('#activeFlashcard .flashcard-face-front > div').first().boundingBox();await page.mouse.move(text.x+text.width/2,text.y+text.height/2);await page.mouse.down();await page.mouse.move(text.x+text.width/2+130,text.y+text.height/2,{steps:8});await page.mouse.up();await page.waitForTimeout(500);assert.equal((await state()).index,4);
assert.deepEqual(errors,[]);
console.log('PASS '+type.name()+': tremor-free taps, smooth return from short drags, quick flicks, unchanged long swipes, swipes from scrollable text');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
