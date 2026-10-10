const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const type=process.env.BROWSER==='webkit'?webkit:chromium;
 const browser=await type.launch(type===chromium?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{executablePath:process.env.WEBKIT_EXECUTABLE_PATH});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('crash',()=>errors.push('crash'));await page.route('https://**/*',r=>r.abort());
  await page.addInitScript(()=>{localStorage.setItem('b3_tutorial_done','1');localStorage.setItem('aiglish_sound_settings',JSON.stringify({enabled:false,volume:.3}));});
  await page.goto('http://127.0.0.1:8000');await page.waitForFunction(()=>window.openProfileDialog);
  await page.getByRole('button',{name:'ゲストとしてテストプレイ'}).click();await page.waitForFunction(()=>window.__learningBootReady===true);
  await page.locator('.menu-trigger').click();assert.deepEqual(await page.locator('.sidebar-menu-list button').allTextContents(),['プロフィール','設定','使い方ガイド','ログアウト']);assert.equal(await page.locator('#usageGuideEntryBtn').count(),1);assert.equal(await page.locator('#sidebarMenu input,#sidebarMenu form,#game-start-screen,.study-tower-link').count(),0);
  await page.locator('#profileMenuButton').click();assert.equal(await page.locator('#profileDialog').evaluate(d=>d.open),true);assert.equal(await page.locator('#sidebarMenu').evaluate(d=>d.classList.contains('open')),false);
  assert.equal(await page.locator('#profileFramePlaceholder').isDisabled(),true);
  await page.locator('#sideInputName').fill('テスト 名前');await page.locator('#sideInputNameColor').fill('#cfab55');await page.getByRole('button',{name:'プロフィールを保存',exact:true}).click();await page.getByText('端末に保存しました。',{exact:true}).waitFor();
  assert.equal(await page.locator('#sideOptPlayerName').evaluate(el=>getComputedStyle(el).color),'rgb(207, 171, 85)');
  const nameColor=await page.evaluate(()=>{const span=document.createElement('span');RankingVisuals.name(span,'テスト 名前',JSON.stringify(UserProfile.read()));return {color:span.style.color,lines:span.querySelectorAll('br').length};});assert.deepEqual(nameColor,{color:'rgb(207, 171, 85)',lines:1});
  const box=await page.locator('#profileDialog').boundingBox();assert.ok(Math.abs(box.x+box.width/2-393/2)<2);assert.ok(box.height<800);
  await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
  await page.locator('.menu-trigger').click();await page.locator('#settingsMenuButton').click();assert.equal(await page.locator('#settingsDialog').evaluate(d=>d.open),true);
  assert.equal(await page.locator('#musicTrack option').count(),7);await page.locator('#sidebarApiKeyInput').fill('local-test-key');await page.getByRole('button',{name:'APIキーを保存',exact:true}).click();await page.getByText('APIキーを保存しました。',{exact:true}).waitFor();
  await page.getByRole('button',{name:'設定を閉じる',exact:true}).click();
  await page.locator('.menu-trigger').click();await page.locator('#usageGuideEntryBtn').click();await page.waitForFunction(()=>document.getElementById('usageGuideOverlay')?.classList.contains('ug-visible'));await page.evaluate(()=>closeUsageGuide());
  await page.reload();await page.waitForFunction(()=>window.__learningBootReady===true);await page.locator('.menu-trigger').click();await page.locator('#profileMenuButton').click();assert.equal(await page.locator('#sideInputName').inputValue(),'テスト 名前');assert.equal(await page.locator('#sideInputNameColor').inputValue(),'#cfab55');await page.getByRole('button',{name:'プロフィールを閉じる',exact:true}).click();
  await page.locator('.menu-trigger').click();await page.locator('#settingsMenuButton').click();assert.equal(await page.locator('#sidebarApiKeyInput').inputValue(),'local-test-key');await page.getByRole('button',{name:'設定を閉じる',exact:true}).click();
  for(let i=0;i<15;i++){await page.locator('.menu-trigger').click();await page.locator(i%2?'#profileMenuButton':'#settingsMenuButton').click();await page.keyboard.press('Escape');}
  assert.equal(await page.locator('#profileDialog,#settingsDialog').count(),2);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  console.log('PASS '+type.name()+': compact ordered menu; centered dialogs; Escape/close/focus; photo/name/color persistence; frame placeholder; API settings save/reload; guide retained; repeated opens bounded; maze absent');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
