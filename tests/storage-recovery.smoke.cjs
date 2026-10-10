const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const context=await browser.newContext();const source=fs.readFileSync(process.env.STORAGE_SOURCE||'app-storage.js','utf8');await context.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(...args){if(window.forceQuota)throw new DOMException('full','QuotaExceededError');return original.apply(this,args);};});
 await context.route('**/storage-fixture',route=>route.fulfill({contentType:'text/html',body:'<script>window.nativeStorage=localStorage;</script><script>'+source+'</script>'}));
 const page=await context.newPage();await page.goto('http://127.0.0.1:8000/storage-fixture');await page.evaluate(()=>AppStorage.ready);
 const key='core_v4_user_vocab_progress_user_book';
 // An old app tab can still write native storage after migration.
 await page.evaluate(async key=>{window.forceQuota=true;localStorage.setItem(key,JSON.stringify({1:{status:'bad'}}));await AppStorage.flush();window.forceQuota=false;nativeStorage.setItem(key,JSON.stringify({1:{status:'ok'},2:{status:'ok'}}));},key);
 await page.reload();await page.evaluate(()=>AppStorage.ready);assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key),{1:{status:'ok'},2:{status:'ok'}});
 // Simulate termination before any IDB write can complete. Native ratings survive.
 await page.evaluate(key=>{const original=IDBDatabase.prototype.transaction;window.restoreTransaction=()=>IDBDatabase.prototype.transaction=original;IDBDatabase.prototype.transaction=function(store,mode,...rest){const tx=original.call(this,store,mode,...rest);if(this.name==='aiglish-local-values'&&mode==='readwrite')tx.abort();return tx;};localStorage.setItem(key,JSON.stringify({1:{status:'none'},2:{status:'ok'},3:{status:'ok'}}));localStorage.setItem(key+'__ts','3000');},key);
 await page.waitForFunction(()=>AppStorage.error!==null);assert.equal(await page.evaluate(key=>JSON.parse(nativeStorage.getItem(key))[3].status,key),'ok');
 await page.reload();await page.evaluate(()=>AppStorage.ready);assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key),{1:{status:'none'},2:{status:'ok'},3:{status:'ok'}});
 const peer=await context.newPage();await peer.goto('http://127.0.0.1:8000/storage-fixture');await peer.evaluate(()=>AppStorage.ready);
 await page.evaluate(async key=>{localStorage.setItem(key,JSON.stringify({4:{status:'bad'}}));await AppStorage.flush();},key);await peer.waitForFunction(key=>JSON.parse(localStorage.getItem(key))[4]?.status==='bad',key);
 await peer.reload();await peer.evaluate(()=>AppStorage.ready);assert.equal(await peer.evaluate(key=>JSON.parse(localStorage.getItem(key))[4].status,key),'bad');
 // At quota, the timestamp and its data must both wait for the same IDB transaction.
 await page.evaluate(async key=>{window.forceQuota=true;const ts=nativeStorage.getItem(key+'__ts');localStorage.setItem(key,JSON.stringify({5:{status:'ok'}}));localStorage.setItem(key+'__ts','5000');assertTimestamp=nativeStorage.getItem(key+'__ts')===ts;await AppStorage.flush();window.forceQuota=false;},key);assert.equal(await page.evaluate(()=>assertTimestamp),true);
 await page.reload();await page.evaluate(()=>AppStorage.ready);assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key))[5].status,key),'ok');assert.equal(await page.evaluate(key=>localStorage.getItem(key+'__ts'),key),'5000');
 // A pending single-player best has an IDB mirror even while native storage is available.
 await page.evaluate(async()=>{const key='core_v4_word_duel_solo_a';localStorage.setItem(key,JSON.stringify({score:380,book:'test',at:123,pending:true}));await AppStorage.flush();nativeStorage.removeItem(key);});
 await page.reload();await page.evaluate(()=>AppStorage.ready);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('core_v4_word_duel_solo_a')).score),380);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('core_v4_word_duel_solo_a')).pending),true);
 console.log('PASS: newer native recovery, interrupted writes, explicit reset, peer reload, quota data/timestamp consistency and personal-best retry mirror');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
