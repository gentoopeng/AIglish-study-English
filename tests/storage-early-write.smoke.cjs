const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const type=process.env.BROWSER==='webkit'?webkit:chromium,browser=await type.launch(type===chromium?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{executablePath:process.env.WEBKIT_EXECUTABLE_PATH});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:8000/manifest.json');
 await page.evaluate(async()=>{
  const key='core_v4_user_vocab_progress_early_book';window.__earlyProgressKey=key;window.__nativeStore=localStorage;
  localStorage.setItem(key,JSON.stringify({1:{status:'bad',note:'古い端末'}}));localStorage.setItem(key+'__ts','10');localStorage.setItem('core_v4_early_large','O'.repeat(70000));
  const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('aiglish-local-values',1);request.onupgradeneeded=()=>request.result.createObjectStore('values');request.onerror=()=>reject(request.error);request.onsuccess=()=>resolve(request.result);});
  await new Promise((resolve,reject)=>{const tx=db.transaction('values','readwrite'),store=tx.objectStore('values');store.put(JSON.stringify({1:{status:'so',note:'古い保存先'}}),key);store.put('5',key+'__ts');store.put('I'.repeat(70000),'core_v4_early_large');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
  const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(window.__forceEarlyQuota)throw new DOMException('quota','QuotaExceededError');return set.call(this,key,value);};
  window.__storageAlerts=[];addEventListener('app-storage-error',event=>__storageAlerts.push(event.detail));
 });
 const source=fs.readFileSync('app-storage.js','utf8');
 await page.evaluate(source=>{
  (0,eval)(source);window.__forceEarlyQuota=true;
  localStorage.setItem(__earlyProgressKey,JSON.stringify({1:{status:'ok',note:'N'.repeat(80000)}}));localStorage.setItem(__earlyProgressKey+'__ts','60');localStorage.setItem('core_v4_early_large','N'.repeat(70000));
  // Explicit flush, as well as scheduled writes, must wait rather than rejecting before open.
  window.__earlyFlush=AppStorage.flush();
 },source);
 await page.evaluate(async()=>{await AppStorage.ready;await __earlyFlush;});assert.equal(await page.evaluate(()=>AppStorage.error),null);assert.deepEqual(await page.evaluate(()=>__storageAlerts),[]);
 const saved=await page.evaluate(()=>({progress:JSON.parse(localStorage.getItem(__earlyProgressKey)),stamp:localStorage.getItem(__earlyProgressKey+'__ts'),large:localStorage.getItem('core_v4_early_large')}));assert.equal(saved.progress[1].status,'ok');assert.equal(saved.progress[1].note.length,80000);assert.equal(saved.stamp,'60');assert.equal(saved.large[0],'N');
 await page.reload();await page.addScriptTag({content:source});await page.evaluate(()=>AppStorage.ready);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('core_v4_user_vocab_progress_early_book'))[1].status),'ok');assert.equal(await page.evaluate(()=>localStorage.getItem('core_v4_user_vocab_progress_early_book__ts')),'60');assert.equal(await page.evaluate(()=>localStorage.getItem('core_v4_early_large')[0]),'N');assert.deepEqual(errors,[]);
 console.log('PASS '+type.name()+': early quota writes and flush wait for IndexedDB; older native/IDB values cannot overwrite new understanding or timestamp; durable reload; no false storage error');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exit(1);});
