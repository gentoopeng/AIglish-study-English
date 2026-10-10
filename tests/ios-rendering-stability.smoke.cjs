const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const appleUA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  // Chromium emulates iOS/PWA feature detection, not the WebKit engine itself.
  const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:3,userAgent:appleUA,isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('crash',()=>errors.push('renderer crashed'));
  await page.route('https://**/*',r=>r.abort());
  await page.addInitScript(()=>{Object.defineProperty(navigator,'standalone',{get:()=>true});localStorage.setItem('b3_tutorial_done','1');});
  await page.goto('http://127.0.0.1:8000');await page.getByRole('button',{name:'ゲストとしてテストプレイ'}).click();
  assert.equal(await page.locator('html').evaluate(el=>el.classList.contains('ios-stable-rendering')),true);
  assert.equal(await page.locator('.app-starfield').count(),0);
  assert.match(await page.locator('body').evaluate(el=>getComputedStyle(el,'::after').backgroundImage),/background-night\.webp/);
  await page.evaluate(()=>{Object.assign(userStats,{gacha_inv_char:['tangon','ch_r01','ch_uc01','ch_c01'],gacha_enhance:{tangon:20},gacha_inv_weapon:['fire_sword'],gacha_inv_armor:['cosmic_shield']});saveUserStats();localStorage.setItem('core_v4_profile_shop_owned_'+myId,JSON.stringify(['wood','retained-frame']));const key=getVocabProgressStorageKey('retained-book');localStorage.setItem(key,JSON.stringify({'1':{status:'ok',memo:'保存済みの記録'}}));window.__retainedKey=key;});
  const retained=await page.evaluate(()=>({key:__retainedKey,value:localStorage.getItem(__retainedKey),ownedKey:'core_v4_profile_shop_owned_'+myId,owned:localStorage.getItem('core_v4_profile_shop_owned_'+myId)}));
  assert.equal(await page.locator('#view-party, #nav-party, [id^=multi-battle-]').count(),0);
  assert.equal(await page.evaluate(()=>typeof window.startMultiBattlePlay),'undefined');
  const session=await page.context().newCDPSession(page);await session.send('Performance.enable');await session.send('HeapProfiler.collectGarbage');
  const metrics=async()=>Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));const before=await metrics();
  for(let round=0;round<6;round++){
   for(let i=0;i<8;i++)await page.evaluate(()=>{switchTab('study');switchTab('vocab');switchTab('reader');});
   await page.locator('.menu-trigger').click();await page.locator('#sideInputName').fill('保存テスト '+round);await page.getByRole('button',{name:'プロフィールを保存',exact:true}).click();await page.locator('#sidebarOverlay').click({position:{x:370,y:400}});
   await page.waitForTimeout(5000);await session.send('HeapProfiler.collectGarbage');
   assert.ok((await metrics()).JSHeapUsedSize-before.JSHeapUsedSize<12*1024*1024,'PWA heap grows without bound');
  }
  const surfaces=await page.evaluate(()=>Array.from(document.querySelectorAll('body,body *')).filter(el=>el.getClientRects().length).filter(el=>{const s=getComputedStyle(el);return s.animationName!=='none'||s.backdropFilter!=='none'||s.filter!=='none';}).map(el=>el.id||el.className));
  assert.deepEqual(surfaces,[],'visible iOS surfaces must not animate or filter');
  await page.reload();await page.waitForFunction(()=>window.UserProfile);assert.equal(await page.locator('#sideOptPlayerName').textContent(),'保存テスト 5');
  assert.deepEqual(await page.evaluate(r=>({value:localStorage.getItem(r.key),owned:localStorage.getItem(r.ownedKey)}),retained),{value:retained.value,owned:retained.owned});
  assert.deepEqual(errors,[]);
  console.log('PASS: retired battle/party UI absent; iOS/PWA rendering branch, owned inventory, 144 tab changes, six profile saves and reload preserve learning/purchases without errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
