const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const type=process.env.BROWSER==='webkit'?webkit:chromium,browser=await type.launch(type===chromium?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{executablePath:process.env.WEBKIT_EXECUTABLE_PATH});try{
// A large selected photo is shown from a screen-sized copy; the next launch reuses it without decoding the original.
const context=await browser.newContext({viewport:{width:402,height:874},deviceScaleFactor:3}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
await page.addInitScript(()=>{window.__bitmaps=0;const create=window.createImageBitmap;window.createImageBitmap=function(...a){__bitmaps++;return create.apply(this,a);};if(localStorage.getItem('s'))return;localStorage.setItem('s','1');localStorage.setItem('core_v4_userId','photo-user');localStorage.setItem('core_v4_userName','検証');localStorage.setItem('core_v4_current_textbook_id','pb');localStorage.setItem('core_v4_cache_pb',JSON.stringify([{num:1,word:'one',meaning:'一'}]));localStorage.setItem('__aiglish_warmup_guard',JSON.stringify({suppressUntil:Date.now()+3600000}));});
await page.goto('http://127.0.0.1:8000');await page.waitForFunction(()=>window.__learningBootReady);
const photo=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=3000;c.height=2000;const g=c.getContext('2d'),grad=g.createLinearGradient(0,0,3000,2000);grad.addColorStop(0,'#123');grad.addColorStop(1,'#9cf');g.fillStyle=grad;g.fillRect(0,0,3000,2000);return c.toDataURL('image/jpeg',.8);});
assert.ok(photo.length<1000000);
await page.evaluate(photo=>{localStorage.setItem('aiglish_app_background_catalog_photo-user',JSON.stringify({backgrounds:[{id:'big',image:photo,position:50}],mode:'photo',selected:'big',updatedAt:1}));localStorage.setItem('aiglish_app_background_photo-user',JSON.stringify({mode:'photo',selected:'big',updatedAt:1}));return AppStorage.flush();},photo);
async function shown(){await page.waitForFunction(()=>/^url\("blob:/.test(getComputedStyle(document.documentElement).getPropertyValue('--app-background-image').trim()),null,{timeout:30000});
 return page.evaluate(async()=>{const url=getComputedStyle(document.documentElement).getPropertyValue('--app-background-image').trim().slice(5,-2);const image=new Image();image.src=url;await image.decode();return {width:image.naturalWidth,height:image.naturalHeight,bitmaps:__bitmaps};});}
await page.reload();await page.waitForFunction(()=>window.__learningBootReady);let first=await shown();
assert.equal(first.height,await page.evaluate(()=>BackgroundRenderCache.longEdge()));assert.ok(first.width<3000&&first.height<2000,JSON.stringify(first));assert.equal(first.bitmaps,1);
await page.reload();await page.waitForFunction(()=>window.__learningBootReady);const second=await shown();
assert.deepEqual([second.width,second.height],[first.width,first.height]);assert.equal(second.bitmaps,0);
// The stored photo itself is unchanged and stays out of the cache's responsibility.
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('aiglish_app_background_catalog_photo-user')).backgrounds[0].image.length),photo.length);
assert.deepEqual(errors,[]);
console.log('PASS '+type.name()+': 3000x2000 photo shown at '+first.width+'x'+first.height+'; next launch reuses the cached copy without decoding the original; stored photo unchanged');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
