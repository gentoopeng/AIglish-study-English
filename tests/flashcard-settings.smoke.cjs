// Requires Playwright, Chromium and a running local HTTP server.
// Run: node tests/flashcard-settings.smoke.cjs
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.setDefaultTimeout(10000);page.on('dialog',async d=>{if(d.message().includes('カードの試練達成')){await d.accept();return;}await d.dismiss();throw Error('Unexpected dialog: '+d.message())});page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
await page.addInitScript(()=>localStorage.setItem('b3_tutorial_done','1'));
await page.goto(process.env.FLASHCARD_TEST_URL || 'http://127.0.0.1:8000',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.openBookFlashcardSettings&&window.__saveCoordinatorApplied);
await page.getByRole('button',{name:'ゲストとしてテストプレイ'}).click();
await page.evaluate(()=>{textbooksPool=[{id:'test-book',name:'テスト単語帳',cover:'📘'}];textbooksCacheMap['test-book']=[{num:1,word:'study',meaning:'学ぶ',meanings:[{id:'1-0',text:'学ぶ'}]},{num:2,word:'read',meaning:'読む',meanings:[{id:'2-0',text:'読む',partOfSpeech:'動'}]}];const words=window.migrateVocabData(textbooksCacheMap['test-book']);localStorage.setItem('core_v4_user_vocab_progress_GUEST-000_test-book',JSON.stringify({'2':{sig:window.buildWordSignature(words[1]),status:'ok',history:['ok'],meanings:{'2-0':{status:'ok',history:['ok']}}}}));window.switchTab('vocab');window.showVocabLibrarySelection();});
await page.getByRole('button',{name:'テスト単語帳のフラッシュ単語設定'}).click();await page.locator('dialog').waitFor();assert.equal(await page.locator('#flashcardRangeEnd').inputValue(),'2');
await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').count(),0);
await page.getByRole('button',{name:'テスト単語帳のフラッシュ単語設定'}).click();
await page.locator('#flashcardRangeStart').fill('2');await page.locator('#flashcardRangeEnd').fill('2');
for(const status of ['so','bad','none'])await page.locator('dialog [data-status="'+status+'"]').click();
await page.locator('#btnCardJa2en').click();await page.getByRole('button',{name:'カードを開始する'}).click();
await page.waitForFunction(()=>flashcardOriginQueue.length>0&&currentTextbook==='test-book');
const result=await page.evaluate(()=>({queue:flashcardOriginQueue,mode:flashcardDirectionMode,version:document.getElementById('appVersionDisplay').textContent}));
assert.equal(await page.locator('#flashcardPartOfSpeech').textContent(),'動');assert.equal(await page.locator('#flashcardPartOfSpeech').isVisible(),true);assert.equal(result.queue.length,1);assert.equal(result.queue[0].num,2);assert.equal(result.mode,'ja2en');assert.equal(result.version,'Version 6.52');assert.equal(await page.locator('dialog').count(),0);
const beforeSwipe=await page.evaluate(()=>userStats.flash_count);await page.evaluate(()=>window.swipeFlashcard('right',100,0));assert.equal(await page.evaluate(()=>userStats.flash_count),beforeSwipe+1);assert.ok(await page.evaluate(()=>userStats.vocab_rated_count)>=1);await page.evaluate(()=>window.finishFlashcardSession());assert.equal(await page.locator('#view-vocab').evaluate(el=>el.classList.contains('active')),true);assert.equal(await page.locator('#nav-vocab').evaluate(el=>el.classList.contains('active')),true);await page.evaluate(()=>window.switchTab('game'));
assert.deepEqual(await page.locator('#game-start-screen .tower-title-text').allTextContents(),['単語の迷宮']);
assert.equal(await page.locator('#game-mode-select-screen, #game-difficulty-select-screen, #game-play-screen, #game-result-screen, #gameLeaderboardArea').count(),0);
assert.equal(await page.evaluate(()=>typeof window.startActualGame),'undefined');
await page.locator('#game-start-screen button').click();
await page.locator('#multi-battle-choice-screen').waitFor({state:'visible'});
await page.evaluate(()=>window.cancelMultiBattleChoice());
assert.deepEqual(errors,[]);
console.log('PASS: labyrinth-only game menu and mobile popup, Escape, selected book, range, understanding filter, reverse side and version 6.52');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
