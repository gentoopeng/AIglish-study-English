const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const type=process.env.BROWSER==='webkit'?webkit:chromium,browser=await type.launch(type===chromium?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{executablePath:process.env.WEBKIT_EXECUTABLE_PATH});try{
// The full backup after a battle waits for a quiet period with no battle screen; it never overlaps the next match.
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());await page.clock.install();
await page.addInitScript(()=>{localStorage.setItem('core_v4_userId','quiet-user');localStorage.setItem('core_v4_userName','検証');localStorage.setItem('__aiglish_warmup_guard',JSON.stringify({suppressUntil:Date.now()+3600000}));});
await page.goto('http://127.0.0.1:8000');await page.clock.runFor(3000);await page.waitForFunction(()=>window.__learningBootReady);
await page.evaluate(()=>{window.__fullSaves=0;window.__backgroundSaveAll=async()=>{__fullSaves++;return {localSaved:true,cloudSaved:true};};window.__duelFlushes=0;const flush=WordDuelProgress.flush;WordDuelProgress.flush=(...a)=>{__duelFlushes++;return flush(...a);};});
const saves=()=>page.evaluate(()=>__fullSaves);
// Battle ends, the player starts another battle within 20 s: no full backup while the screen is open.
const result=await page.evaluate(()=>window.saveAfterStudy('battle-end'));assert.equal(result.deferred,true);assert.equal(await page.evaluate(()=>__duelFlushes),1);
await page.evaluate(()=>document.body.classList.add('duel-screen-open'));await page.clock.runFor(65000);assert.equal(await saves(),0);
// After the screen closes and 20 s pass quietly, exactly one backup runs.
await page.evaluate(()=>document.body.classList.remove('duel-screen-open'));await page.clock.runFor(21000);assert.equal(await saves(),1);await page.clock.runFor(60000);assert.equal(await saves(),1);
// A backup that runs for another reason (app hidden) replaces the waiting one.
await page.evaluate(()=>window.saveAfterStudy('warmup-end'));await page.evaluate(()=>window.saveAfterStudy('sleep'));await page.clock.runFor(1000);assert.equal(await saves(),2);await page.clock.runFor(30000);assert.equal(await saves(),2);
assert.deepEqual(errors,[]);console.log('PASS '+type.name()+': battle/warm-up backups wait for 20 s without a battle screen, run once, and are replaced by an immediate backup');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
