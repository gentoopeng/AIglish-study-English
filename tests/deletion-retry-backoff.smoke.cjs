const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const type=process.env.BROWSER==='webkit'?webkit:chromium,browser=await type.launch(type===chromium?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{executablePath:process.env.WEBKIT_EXECUTABLE_PATH});try{
// A deletion that cannot finish (here: no cloud connection) must not re-read every save every 30 seconds.
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
await page.clock.install();
await page.addInitScript(()=>{if(localStorage.getItem('s'))return;localStorage.setItem('s','1');localStorage.setItem('core_v4_userId','retry-user');localStorage.setItem('core_v4_userName','検証');localStorage.setItem('core_v4_current_textbook_id','keep');localStorage.setItem('core_v4_cache_keep',JSON.stringify([{num:1,word:'keep',meaning:'残す'}]));
localStorage.setItem('core_v4_library_deletions_retry-user',JSON.stringify({'book:gone':{kind:'book',id:'gone',metadata:{id:'gone'},deletedAt:1,updatedAt:1,pending:true}}));});
await page.goto('http://127.0.0.1:8000');await page.clock.runFor(5000);await page.waitForFunction(()=>window.__learningBootReady);
assert.equal(await page.evaluate(()=>LibraryState.storageKey('retry-user')),'core_v4_library_deletions_retry-user');
await page.evaluate(()=>{window.__cleanRuns=0;const clean=LibraryState.cleanLocal;LibraryState.cleanLocal=function(...a){__cleanRuns++;return clean.apply(this,a);};});
const runs=()=>page.evaluate(()=>__cleanRuns);
// Old behaviour: one full pass every 30 s (20 passes in 10 minutes). Now 1, 2, 4 ... minutes apart.
await page.clock.runFor(10*60000);const tenMinutes=await runs();
assert.ok(tenMinutes>=2&&tenMinutes<=4,'passes in 10 minutes: '+tenMinutes);
// Coming back online retries immediately.
const before=await runs();await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.clock.runFor(1000);assert.equal(await runs(),before+1);
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('core_v4_library_deletions_retry-user'))['book:gone'].pending),true);
assert.deepEqual(errors,[]);
console.log('PASS '+type.name()+': failing deletion sync backs off (passes in 10 min: '+tenMinutes+'), retries at once when online, stays pending');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
