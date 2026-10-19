const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const type=process.env.BROWSER==='webkit'?webkit:chromium,browser=await type.launch(type===chromium?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{executablePath:process.env.WEBKIT_EXECUTABLE_PATH});try{
const page=await browser.newPage({viewport:{width:402,height:874}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
await page.addInitScript(()=>{if(localStorage.getItem('warmup-seeded'))return;localStorage.setItem('warmup-seeded','1');localStorage.setItem('core_v4_userId','warmup-user');localStorage.setItem('core_v4_userName','検証');localStorage.setItem('core_v4_current_textbook_id','warmup-book');localStorage.setItem('core_v4_cache_warmup-book',JSON.stringify(Array.from({length:30},(_,i)=>({num:i+1,word:'word'+i,meaning:'意味'+i}))));});
await page.goto('http://127.0.0.1:8000');await page.waitForFunction(()=>window.__learningBootReady);await page.locator('.flash-warmup-dialog[open] .warmup-card').waitFor({timeout:30000});await page.waitForTimeout(600);
const count=()=>page.locator('.flash-warmup-dialog[open] .warmup-count').textContent();
const card=async()=>{const b=await page.locator('.flash-warmup-dialog[open] .warmup-card').boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2};};
// One fast pointermove then release: the flick is measured from the pointer-down position.
let before=await count(),c=await card();await page.mouse.move(c.x,c.y);await page.mouse.down();await page.mouse.move(c.x+45,c.y,{steps:1});await page.mouse.up();await page.waitForTimeout(700);
assert.notEqual(await count(),before);
// A slow short drag neither rates nor flips the card.
before=await count();c=await card();await page.mouse.move(c.x,c.y);await page.mouse.down();for(let i=1;i<=8;i++){await page.mouse.move(c.x+i*5,c.y);await page.waitForTimeout(40);}await page.waitForTimeout(150);await page.mouse.up();await page.waitForTimeout(500);
assert.equal(await count(),before);assert.equal(await page.locator('.flash-warmup-dialog[open] .warmup-card.flipped').count(),0);
assert.deepEqual(errors,[]);
console.log('PASS '+type.name()+': warm-up single-move flick rates the card; slow short drag returns without rating or flipping');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
