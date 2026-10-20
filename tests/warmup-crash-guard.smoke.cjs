const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const type=process.env.BROWSER==='webkit'?webkit:chromium,browser=await type.launch(type===chromium?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{executablePath:process.env.WEBKIT_EXECUTABLE_PATH});try{
const seed=guard=>{if(localStorage.getItem('s'))return;localStorage.setItem('s','1');localStorage.setItem('core_v4_userId','guard-user');localStorage.setItem('core_v4_userName','検証');localStorage.setItem('core_v4_current_textbook_id','gb');localStorage.setItem('core_v4_cache_gb',JSON.stringify(Array.from({length:30},(_,i)=>({num:i+1,word:'word'+i,meaning:'意味'+i}))));if(guard)localStorage.setItem('__aiglish_warmup_guard',JSON.stringify(guard));};
async function open(guard){const context=await browser.newContext({viewport:{width:402,height:874}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());await page.addInitScript(seed,guard);await page.goto('http://127.0.0.1:8000');await page.waitForFunction(()=>window.__learningBootReady);return {context,page,errors};}
const guard=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('__aiglish_warmup_guard')||'null'));
// While the warm-up is on screen the guard records it; closing it normally clears the mark.
let {context,page,errors}=await open(null);await page.locator('.flash-warmup-dialog[open]').waitFor({timeout:30000});
assert.ok((await guard(page)).shownAt);await page.evaluate(()=>window.closeLibraryDialog());await page.waitForTimeout(300);assert.equal((await guard(page)).shownAt,undefined);assert.deepEqual(errors,[]);await context.close();
// The previous run ended while the warm-up was showing (renderer terminated): skip it for 24 hours.
({context,page,errors}=await open({shownAt:Date.now()-5000}));await page.waitForTimeout(6000);
assert.equal(await page.locator('.flash-warmup-dialog[open]').count(),0);const suppressed=await guard(page);assert.equal(suppressed.shownAt,undefined);assert.ok(suppressed.suppressUntil>Date.now()+23*3600000);assert.deepEqual(errors,[]);await context.close();
// Still suppressed on the next launch within 24 hours.
({context,page,errors}=await open({suppressUntil:Date.now()+3600000}));await page.waitForTimeout(6000);assert.equal(await page.locator('.flash-warmup-dialog[open]').count(),0);await context.close();
// After the period ends the warm-up returns.
({context,page,errors}=await open({suppressUntil:Date.now()-1000}));await page.locator('.flash-warmup-dialog[open]').waitFor({timeout:30000});assert.deepEqual(errors,[]);await context.close();
console.log('PASS '+type.name()+': warm-up marks itself while shown, clears on close; a run that ended during the warm-up suppresses it for 24 hours, then it returns');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
