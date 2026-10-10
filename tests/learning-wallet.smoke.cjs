const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const type=process.env.BROWSER==='webkit'?webkit:chromium,browser=await type.launch(type===chromium?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{executablePath:process.env.WEBKIT_EXECUTABLE_PATH});try{
 const page=await browser.newPage({viewport:{width:393,height:852}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());await page.addInitScript(()=>localStorage.setItem('aiglish_sound_settings',JSON.stringify({enabled:false})));
 await page.goto('http://127.0.0.1:8000');await page.waitForFunction(()=>window.LearningWallet);await page.getByRole('button',{name:'ゲストとしてテストプレイ'}).click();await page.waitForFunction(()=>window.__learningBootReady===true);
 const result=await page.evaluate(async()=>{
  const m=LearningRewardsModel;myId='coins-test';userStats={gold:321};const day=m.shiftDay(m.dateKey(Date.now()),-1);let activity=m.activity();for(let i=0;i<5;i++)activity=m.add(activity,'ratings','phone',Date.parse(day+'T12:00:00+09:00'));
  const study={version:1,epoch:'study-reset-2.62',days:{[day]:{sources:{phone:125000}}},offset:0};
  window.__coinCloud={userStats:{gold:321},studyLedgerJson:JSON.stringify(study),learningActivityV1Json:JSON.stringify(activity)};window.db={};window.fbDoc=(db,...path)=>path.join('/');window.fbGetDoc=async()=>({exists:()=>true,data:()=>__coinCloud});let commits=0;
  window.fbRunTransaction=async(_,fn)=>fn({get:async()=>({exists:()=>true,data:()=>__coinCloud}),set:(ref,fields)=>{if(Object.keys(fields).some(key=>!['learningWalletV1Json','profileCustomizationJson'].includes(key)))throw Error('Coin transaction must not rewrite learning data');Object.assign(__coinCloud,fields);commits++;}});
  await LearningWallet.claimDaily(day);const first=m.balance(LearningWallet.read());await LearningWallet.claimDaily(day);const second=m.balance(LearningWallet.read());
  window.IconFrameCatalog=[{id:'wood'},{id:'silver'}];await LearningWallet.purchase('wood');const bought=m.balance(LearningWallet.read());await LearningWallet.purchase('wood');const duplicate=m.balance(LearningWallet.read());
  let insufficient=false;try{await LearningWallet.purchase('silver');}catch{insufficient=true;}
  const owned=m.owned(LearningWallet.read(),'wood'),raw=__coinCloud.learningWalletV1Json;
  // A new device has stats.gold reflecting current balance; it must not turn that balance into a second baseline.
  localStorage.removeItem(LearningWallet.key(myId));localStorage.removeItem(LearningWallet.key(myId)+'_backup');userStats.gold=bought;LearningWallet.mergeCloud(raw);const newDevice=m.balance(LearningWallet.read());
  const stale={localStorage:{[LearningWallet.key(myId)]:JSON.stringify(m.wallet(321)),[LearningActivity.key(myId)]:JSON.stringify(m.activity())}};LibraryState.sanitizeSave({data:stale},myId);const restored=m.balance(JSON.parse(stale.localStorage[LearningWallet.key(myId)]));
  return {day,first,second,bought,duplicate,insufficient,owned,newDevice,restored,commits};
 });
 assert.equal(result.first,346);assert.equal(result.second,346);assert.equal(result.bought,246);assert.equal(result.duplicate,246);assert.equal(result.insufficient,true);assert.equal(result.owned,true);assert.equal(result.newDevice,246);assert.equal(result.restored,246);
 await page.locator('.menu-trigger').click();await page.locator('#mailboxMenuButton').click();await page.getByRole('button',{name:'受取済み',exact:true}).waitFor();assert.match(await page.locator('.mailbox-balance').textContent(),/246/);await page.getByRole('button',{name:'閉じる',exact:true}).click();
 await page.evaluate(()=>{window.fbRunTransaction=async()=>{throw Error('offline');};});const unchanged=await page.evaluate(async()=>{const before=LearningRewardsModel.balance(LearningWallet.read());try{await LearningWallet.purchase('silver');}catch{}return before===LearningRewardsModel.balance(LearningWallet.read());});assert.equal(unchanged,true);
 assert.deepEqual(errors,[]);console.log('PASS '+type.name()+': legacy balance migration; minutes/answers; idempotent claims/purchases; insufficient/offline isolation; new-device baseline; stale backups; mailbox receipts');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
