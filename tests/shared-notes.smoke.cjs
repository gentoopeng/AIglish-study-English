const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',route=>route.abort());await page.addInitScript(()=>localStorage.setItem('b3_tutorial_done','1'));
  await page.goto('http://127.0.0.1:8000',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.getSharedVocabNoteTopic);await page.getByRole('button',{name:'ゲストとしてテストプレイ'}).click();
  await page.evaluate(async()=>{
   window.__gcLoginShown=true;myId='note-user';window.db={};currentTextbook='note-book';vocabList=window.migrateVocabData([{num:1,word:'study',meaning:'学ぶ',note:'自分だけのメモ',status:'ok',history:['ok']}]);
   window.__noteWrites=[];window.__noteCloud=new Map();window.fbDoc=(_, ...path)=>path.join('/');window.fbCollection=window.fbDoc;
   const topic=await window.getSharedVocabNoteTopic(vocabList[0]);window.__notePrefix='publicVocabNotes/'+topic+'/notes';
   window.__longNote='長いメモの全文です。'.repeat(30)+'<script>危険なタグも文字として表示</script>';
   window.__noteCloud.set(window.__notePrefix+'/other-a',{ownerId:'other-a',note:'短いメモ',updatedAt:'2026-10-01'});
   window.__noteCloud.set(window.__notePrefix+'/other-b',{ownerId:'other-b',note:window.__longNote,updatedAt:'2026-10-02'});
   window.fbGetDocs=async prefix=>({forEach:cb=>{for(const [path,data] of window.__noteCloud)if(path.startsWith(prefix+'/'))cb({id:path.split('/').pop(),data:()=>data});}});
   window.fbSetDoc=async(path,data)=>{window.__noteWrites.push([path,data]);window.__noteCloud.set(path,data);};window.fbDeleteDoc=async path=>{window.__noteWrites.push(['delete',path]);window.__noteCloud.delete(path);};
   window.switchTab('vocab');document.getElementById('vocabLibrarySelection').hidden=true;document.getElementById('vocabBookContents').hidden=false;window.renderVocabList();
  });
  const note=page.locator('#vocabListContainer .vocab-note-section').first();await note.locator('.vocab-note-toggle').click();await note.getByText('短いメモ',{exact:true}).waitFor();assert.equal(await note.locator('.vocab-note-input').inputValue(),'自分だけのメモ');assert.equal(await page.evaluate(()=>window.__noteWrites.length),0);
  assert.equal(await note.locator('.shared-vocab-note-row').count(),2);const short=note.locator('.shared-vocab-note-row').filter({hasText:'短いメモ'});assert.equal(await short.locator('.shared-vocab-note-more').isVisible(),false);
  const long=note.locator('.shared-vocab-note-row').filter({hasText:'長いメモの全文です。'});await long.getByRole('button',{name:'すべて表示',exact:true}).waitFor();assert.equal(await long.locator('.shared-vocab-note-preview').evaluate(el=>getComputedStyle(el).whiteSpace),'nowrap');await long.getByRole('button',{name:'すべて表示',exact:true}).click();assert.equal(await long.locator('.shared-vocab-note-preview').textContent(),await page.evaluate(()=>window.__longNote));assert.equal(await long.locator('script').count(),0);await long.getByRole('button',{name:'折りたたむ',exact:true}).click();await page.screenshot({path:'/tmp/shared-vocab-notes.png'});
  await note.locator('.vocab-note-input').fill('明示的に共有したメモ');await note.getByRole('button',{name:'共有する',exact:true}).click();await note.getByRole('button',{name:'共有を更新',exact:true}).waitFor();const payload=await page.evaluate(()=>window.__noteWrites[0][1]);assert.equal(payload.note,'明示的に共有したメモ');assert.equal(payload.ownerId,'note-user');assert.equal(payload.history,undefined);assert.equal(payload.status,undefined);assert.equal(await note.locator('.vocab-note-input').inputValue(),'明示的に共有したメモ');
  await note.getByRole('button',{name:'共有を取り消す',exact:true}).click();await note.getByRole('button',{name:'共有する',exact:true}).waitFor();assert.equal(await page.evaluate(()=>vocabList[0].note),'明示的に共有したメモ');assert.equal(await page.evaluate(()=>window.__noteWrites[1][0]),'delete');
  const keys=await page.evaluate(async()=>[await getSharedVocabNoteTopic({num:1,word:'study',meaning:'学ぶ'}),await getSharedVocabNoteTopic({num:99,word:'study',meaning:'学ぶ'}),await getSharedVocabNoteTopic({num:1,word:'study',meaning:'研究室'})]);assert.equal(keys[0],keys[1]);assert.notEqual(keys[0],keys[2]);
  // Failed publishing keeps the unsent input and never changes the saved private note.
  await page.evaluate(()=>{window.fbSetDoc=async()=>{throw new Error('テスト用の接続失敗');};});await note.locator('.vocab-note-input').fill('まだ共有できていない入力');await note.getByRole('button',{name:'共有する',exact:true}).click();await note.getByText('テスト用の接続失敗',{exact:true}).waitFor();assert.equal(await note.locator('.vocab-note-input').inputValue(),'まだ共有できていない入力');assert.equal(await page.evaluate(()=>vocabList[0].note),'明示的に共有したメモ');
  // A pending response after switching books must not populate the old card.
  await page.evaluate(()=>{window.fbGetDocs=()=>new Promise(resolve=>window.__releaseNotes=resolve);window.renderVocabList();});const fresh=page.locator('#vocabListContainer .vocab-note-section').first();await fresh.locator('.vocab-note-toggle').click();await page.waitForFunction(()=>window.__releaseNotes);await page.evaluate(()=>{currentTextbook='different-book';window.__releaseNotes({forEach:cb=>cb({data:()=>({ownerId:'late',note:'遅れた別のメモ'})})});});assert.equal(await page.getByText('遅れた別のメモ',{exact:true}).count(),0);
  await page.evaluate(()=>{myId='GUEST-000';currentTextbook='note-book';window.fbGetDocs=async()=>({forEach:()=>{}});window.renderVocabList();});const guest=page.locator('#vocabListContainer .vocab-note-section').first();await guest.locator('.vocab-note-toggle').click();await guest.locator('.vocab-note-input').fill('ゲストのメモ');await guest.getByRole('button',{name:'共有する',exact:true}).click();await guest.getByText('メモを共有するにはログインしてください。',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.__noteWrites.length),2);
  assert.deepEqual(errors,[]);console.log('PASS: private by default, other notes under input, one-line previews, conditional expand, text escaping, explicit share/unshare, preserved personal notes, copied-word identity and stale response guard');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
