const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const type=process.env.BROWSER==='webkit'?webkit:chromium,browser=await type.launch(type===chromium?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{executablePath:process.env.WEBKIT_EXECUTABLE_PATH});try{
// A script that fails once (stale or interrupted delivery) is retried by one automatic reload.
let page=await browser.newPage();await page.route('https://**/*',r=>r.abort());let failures=0;
await page.route(/workbook\.js/,r=>{if(failures++===0)return r.fulfill({status:404,body:''});return r.continue();});
await page.goto('http://127.0.0.1:8000');await page.waitForFunction(()=>/[?]reload=/.test(location.search)&&typeof window.handleAuthSubmit==='function'&&!document.getElementById('authSubmitBtn').disabled,null,{timeout:30000});
assert.equal(await page.locator('#appStartupStatus').isHidden(),true);await page.close();
// A failure that persists does not reload in a loop; it offers a reload button instead.
page=await browser.newPage();await page.route('https://**/*',r=>r.abort());let loads=0;page.on('framenavigated',f=>{if(f===page.mainFrame())loads++;});
await page.route(/workbook\.js/,r=>r.fulfill({status:404,body:''}));
await page.goto('http://127.0.0.1:8000');await page.locator('#appStartupStatus button',{hasText:'再読み込み'}).waitFor({timeout:30000});await page.waitForTimeout(1500);
assert.equal(loads,2);assert.match(page.url(),/[?]reload=/);assert.match(await page.locator('#appStartupStatus').textContent(),/workbook\.js/);
console.log('PASS '+type.name()+': one failed script load recovers by a single automatic fresh reload; persistent failure shows a reload button without looping');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
