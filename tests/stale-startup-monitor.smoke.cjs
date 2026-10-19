const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const type=process.env.BROWSER==='webkit'?webkit:chromium,browser=await type.launch(type===chromium?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{executablePath:process.env.WEBKIT_EXECUTABLE_PATH});try{
// A cached pre-10.19.09.58 monitor exposes mark() only; newer scripts must still boot and log in.
const page=await browser.newPage({viewport:{width:402,height:874},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.route('https://**/*',r=>r.abort());
await page.route(/startup-monitor\.js/,r=>r.fulfill({contentType:'text/javascript',body:'window.StartupMonitor={mark(){}};'}));
await page.addInitScript(()=>{if(localStorage.getItem('stale-seeded'))return;localStorage.setItem('stale-seeded','1');localStorage.setItem('core_v4_userId','STALEMON01');localStorage.setItem('core_v4_userName','検証');});
await page.goto('http://127.0.0.1:8000');await page.waitForFunction(()=>window.__learningBootReady===true,null,{timeout:30000});
assert.equal(await page.evaluate(()=>document.getElementById('auth-gate-screen').style.display),'none');
await page.reload();await page.waitForFunction(()=>window.__learningBootReady===true,null,{timeout:30000});
assert.deepEqual(errors.filter(m=>/StartupMonitor|is not a function/.test(m)),[]);
console.log('PASS '+type.name()+': stale startup monitor without event() does not stop saved-login startup; reload');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
