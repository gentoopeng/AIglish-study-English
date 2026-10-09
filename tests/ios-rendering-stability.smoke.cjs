const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const appleUA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  // Regression: this exact legacy observer previously regenerated its own subtree
  // forever, even without changes to enhancement level, inventory or sort order.
  const fixture=await browser.newPage();
  await fixture.setContent('<div id="view-party" class="active"><div id="ptyList"><div class="pty-card" data-card="char_tangon"><div class="pty-card-body"></div></div></div></div>');
  await fixture.evaluate(()=>{window.userStats={gacha_enhance:{}};window.__tabHandlers=[];window.onTabChange=fn=>__tabHandlers.push(fn);window.__writes=0;new MutationObserver(rs=>__writes+=rs.length).observe(document.getElementById('ptyList'),{childList:true,subtree:true});});
  const src=fs.readFileSync('multi.js','utf8'),start=src.indexOf('(function applyPartyUnifyPatch()'),end=src.indexOf("console.log('🐧 編成統一パッチ",start);
  await fixture.addScriptTag({content:src.slice(start,src.indexOf('})();',end)+5)});
  await fixture.waitForTimeout(1100);
  await fixture.evaluate(()=>__writes=0);
  await fixture.waitForTimeout(1700);
  assert.equal(await fixture.evaluate(()=>__writes),0,'unchanged cards must not trigger an observer feedback loop');
  await fixture.evaluate(()=>{userStats.gacha_enhance.tangon=2;});
  await fixture.waitForTimeout(900);
  assert.match(await fixture.locator('.pty-stats').textContent(),/Lv\.2/);
  await fixture.evaluate(()=>{document.getElementById('view-party').classList.remove('active');__tabHandlers.forEach(fn=>fn('reader'));__writes=0;userStats.gacha_enhance.tangon=3;});
  await fixture.waitForTimeout(900);
  assert.equal(await fixture.evaluate(()=>__writes),0,'hidden party must not rewrite cards');
  await fixture.evaluate(()=>{document.getElementById('view-party').classList.add('active');__tabHandlers.forEach(fn=>fn('party'));});
  await fixture.waitForTimeout(100);
  assert.match(await fixture.locator('.pty-stats').textContent(),/Lv\.3/);
  await fixture.close();

  // Chromium emulates iOS/PWA feature detection, not the WebKit engine itself.
  const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:3,userAgent:appleUA,isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('crash',()=>errors.push('renderer crashed'));
  await page.route('https://**/*',r=>r.abort());
  await page.addInitScript(()=>{Object.defineProperty(navigator,'standalone',{get:()=>true});localStorage.setItem('b3_tutorial_done','1');});
  await page.goto('http://127.0.0.1:8000');await page.getByRole('button',{name:'ゲストとしてテストプレイ'}).click();
  assert.equal(await page.locator('html').evaluate(el=>el.classList.contains('ios-stable-rendering')),true);
  assert.equal(await page.locator('.app-starfield').count(),0);
  assert.match(await page.locator('body').evaluate(el=>getComputedStyle(el,'::after').backgroundImage),/tango\.png/);
  await page.evaluate(()=>{Object.assign(userStats,{gacha_inv_char:['tangon','ch_r01','ch_uc01','ch_c01'],gacha_enhance:{tangon:20},gacha_inv_weapon:['fire_sword'],gacha_inv_armor:['cosmic_shield']});saveUserStats();localStorage.setItem('core_v4_profile_shop_owned_'+myId,JSON.stringify(['wood','retained-frame']));const key=getVocabProgressStorageKey('retained-book');localStorage.setItem(key,JSON.stringify({'1':{status:'ok',memo:'保存済みの記録'}}));window.__retainedKey=key;});
  const retained=await page.evaluate(()=>({key:__retainedKey,value:localStorage.getItem(__retainedKey),ownedKey:'core_v4_profile_shop_owned_'+myId,owned:localStorage.getItem('core_v4_profile_shop_owned_'+myId)}));
  await page.evaluate(()=>switchTab('party'));
  await page.locator('.gm-cell[data-gmid=tangon] .gm-cell-icon').click();
  await page.locator('.gm-modal [data-dxenh2=tangon]').waitFor({state:'visible'});
  assert.equal(await page.locator('.gm-modal').getByText('攻撃',{exact:true}).count(),1,'scoped watcher still fixes newly opened catalogue modals');
  await page.locator('.gm-modal [data-gmclose]').click();
  await page.locator('[data-gmsort=atk]').click();
  assert.equal(await page.locator('[data-gmsort=atk]').evaluate(el=>el.classList.contains('on')),true);
  await page.evaluate(()=>{switchTab('reader');window.__gachaScans=0;onGachaDomChange(()=>__gachaScans++);});
  await page.waitForTimeout(1600);await page.evaluate(()=>__gachaScans=0);await page.waitForTimeout(3000);
  assert.equal(await page.evaluate(()=>__gachaScans),0,'home timer updates must not scan game DOM');
  const session=await page.context().newCDPSession(page);await session.send('Performance.enable');await session.send('HeapProfiler.collectGarbage');
  const metrics=async()=>Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));const before=await metrics();
  for(let round=0;round<6;round++){
   for(let i=0;i<8;i++)await page.evaluate(()=>{switchTab('party');switchTab('vocab');switchTab('reader');});
   await page.locator('.menu-trigger').click();await page.locator('#sideInputName').fill('保存テスト '+round);await page.getByRole('button',{name:'プロフィールを保存',exact:true}).click();await page.locator('#sidebarOverlay').click({position:{x:370,y:400}});
   await page.waitForTimeout(5000);await session.send('HeapProfiler.collectGarbage');
   assert.ok((await metrics()).JSHeapUsedSize-before.JSHeapUsedSize<12*1024*1024,'PWA heap grows without bound');
  }
  const surfaces=await page.evaluate(()=>Array.from(document.querySelectorAll('body,body *')).filter(el=>el.getClientRects().length).filter(el=>{const s=getComputedStyle(el);return s.animationName!=='none'||s.backdropFilter!=='none'||s.filter!=='none';}).map(el=>el.id||el.className));
  assert.deepEqual(surfaces,[],'visible iOS surfaces must not animate or filter');
  await page.reload();await page.waitForFunction(()=>window.UserProfile);assert.equal(await page.locator('#sideOptPlayerName').textContent(),'保存テスト 5');
  assert.deepEqual(await page.evaluate(r=>({value:localStorage.getItem(r.key),owned:localStorage.getItem(r.ownedKey)}),retained),{value:retained.value,owned:retained.owned});
  assert.deepEqual(errors,[]);
  console.log('PASS: observer feedback stops; hidden party is idle; iOS/PWA rendering branch, owned inventory, 144 tab changes, six profile saves and reload preserve learning/purchases without errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
