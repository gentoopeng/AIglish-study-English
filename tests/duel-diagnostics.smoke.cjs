const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const type=process.env.BROWSER==='webkit'?webkit:chromium,browser=await type.launch(type===chromium?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{executablePath:process.env.WEBKIT_EXECUTABLE_PATH});try{
// Battle and full-save boundaries reach the persisted diagnostic with a size snapshot; answers are only counted.
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
await page.addInitScript(()=>{localStorage.setItem('core_v4_userId','diag-user');localStorage.setItem('core_v4_userName','検証');localStorage.setItem('__aiglish_warmup_guard',JSON.stringify({suppressUntil:Date.now()+3600000}));});
await page.goto('http://127.0.0.1:8000');await page.waitForFunction(()=>window.__learningBootReady);
const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('__aiglish_startup_diagnostic')));
await page.evaluate(()=>StartupMonitor.event('duel:shown'));assert.ok((await stored()).events.some(e=>e.label==='duel:shown'));
await page.evaluate(()=>{StartupMonitor.event('duel:start');for(let i=0;i<7;i++)StartupMonitor.event('duel:answer');});
let s=await stored();assert.ok(s.events.some(e=>e.label==='duel:start'));assert.ok(s.runtime&&s.runtime.storage);assert.equal(s.events.some(e=>e.label==='duel:answer'),false);
await page.evaluate(()=>StartupMonitor.event('duel:closed'));s=await stored();assert.equal(s.duelAnswers,7);assert.ok(s.events.some(e=>e.label==='duel:closed'));
await page.evaluate(()=>window.__backgroundSaveAll().catch(()=>{}));await page.waitForFunction(()=>JSON.parse(localStorage.getItem('__aiglish_startup_diagnostic')).events.some(e=>/^save:(done|error)$/.test(e.label)));
s=await stored();assert.ok(s.events.some(e=>e.label==='save:start'));
await page.evaluate(()=>StartupMonitor.event('duel:'+'word-text'));assert.equal((await stored()).events.some(e=>e.label.includes('word-text')),false);
assert.deepEqual(errors,[]);console.log('PASS '+type.name()+': duel start/close and full-save boundaries persisted with size snapshot; answers counted, not logged; free-form labels rejected');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
