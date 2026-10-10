const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const type=process.env.BROWSER==='webkit'?webkit:chromium;
 const browser=await type.launch(type===chromium?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{executablePath:process.env.WEBKIT_EXECUTABLE_PATH});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('crash',()=>errors.push('crash'));page.on('request',r=>{if(/\/(sounds|music)\//.test(r.url()))requests.push(r.url());});await page.route('https://**/*',r=>r.abort());
  // Match GitHub Pages byte-range support; Python's local server cannot seek MP3s in WebKit.
  await page.route('http://127.0.0.1:8000/assets/**/*.mp3',async route=>{
   const request=route.request(),path=require('node:path').join(__dirname,'..',new URL(request.url()).pathname),data=require('node:fs').readFileSync(path),range=/bytes=(\d+)-(\d*)/.exec(request.headers().range||'');
   if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),data.length-1):data.length-1;await route.fulfill({status:206,headers:{'content-type':'audio/mpeg','accept-ranges':'bytes','content-range':`bytes ${start}-${end}/${data.length}`},body:data.subarray(start,end+1)});}
   else await route.fulfill({status:200,headers:{'content-type':'audio/mpeg','accept-ranges':'bytes'},body:data});
  });
  await page.addInitScript(()=>{
   window.__players=[];window.__plays=[];window.__decoded=[];window.__started=[];window.__contexts=[];window.__gains=[];
   const Audio=window.Audio;window.Audio=new Proxy(Audio,{construct(target,args){const player=new target(...args);for(const event of ['loadedmetadata','durationchange'])player.addEventListener(event,()=>__decoded.push({src:player.src,duration:player.duration}));player.addEventListener('playing',()=>__started.push(player.src));__players.push(player);return player;}});
   const name=window.AudioContext?'AudioContext':'webkitAudioContext',Context=window[name];if(Context)window[name]=new Proxy(Context,{construct(target,args){const context=new target(...args),create=context.createGain.bind(context);context.createGain=()=>{const node=create();__gains.push(node);return node;};__contexts.push(context);return context;}});
   const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){__plays.push(this.src);return play.call(this);};
   localStorage.setItem('b3_tutorial_done','1');
  });
  await page.goto('http://127.0.0.1:8000');await page.waitForFunction(()=>window.AppSounds);
  assert.equal(requests.length,0);assert.equal(await page.evaluate(()=>__players.length+__contexts.length),0,'no startup audio allocation');
  await page.getByRole('button',{name:'ゲストとしてテストプレイ'}).click();await page.waitForFunction(()=>window.__learningBootReady===true);
  await page.locator('.menu-trigger').click();await page.waitForFunction(()=>__started.some(src=>src.endsWith('/menu.mp3')));
  assert.equal(await page.locator('#musicEnabled').isChecked(),false);assert.equal(requests.filter(url=>url.includes('/music/')).length,0);
  await page.locator('#musicEnabled').check();await page.waitForFunction(()=>__started.some(src=>src.endsWith('/hitohira.mp3')));
  assert.equal(await page.evaluate(()=>__players.length),2);assert.equal(await page.evaluate(()=>__contexts.length),1);assert.equal(await page.evaluate(()=>__players.find(p=>p.loop).paused),false);
  await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>__contexts[0].state),'running','ending an effect must not suspend BGM');
  await page.locator('#soundEnabled').uncheck();assert.equal(await page.evaluate(()=>__players.find(p=>p.loop).paused),false,'muting effects preserves music');
  await page.locator('#musicVolume').evaluate(el=>{el.value='35';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
  assert.equal(await page.evaluate(()=>__gains[1].gain.value.toFixed(2)),'0.35');
  for(const track of ['in-that-mood','in-that-mood-narr','let-it-happen','let-it-happen-narr','haru-slow','haru-fast']){
   await page.locator('#musicTrack').selectOption(track);await page.waitForFunction(track=>__started.some(src=>src.endsWith('/'+track+'.mp3'))&&__decoded.some(d=>d.src.endsWith('/'+track+'.mp3')&&d.duration>100),track);
  }
  assert.equal(await page.evaluate(()=>__players.length),2);assert.equal(await page.evaluate(()=>__contexts.length),1);
  // Native media loop boundary: ensure it wraps and keeps playing.
  await page.evaluate(()=>{const m=__players.find(p=>p.loop);m.currentTime=m.duration-.3;});await page.waitForFunction(()=>{const m=__players.find(p=>p.loop);return !m.paused&&m.currentTime<3;});
  await page.evaluate(async()=>{await AppStorage.flush();window.dispatchEvent(new Event('pagehide'));});
  assert.equal(await page.evaluate(()=>__players.every(p=>p.paused&&!p.hasAttribute('src'))),true);await page.waitForFunction(()=>__contexts[0].state==='suspended');
  await page.reload();await page.waitForFunction(()=>window.__learningBootReady===true);
  assert.equal(await page.evaluate(()=>__players.length),0,'saved enabled BGM cannot autoplay or allocate on reload');
  await page.locator('.menu-trigger').click();await page.waitForFunction(()=>__started.some(src=>src.endsWith('/haru-fast.mp3')));
  assert.equal(await page.locator('#musicEnabled').isChecked(),true);assert.equal(await page.locator('#musicTrack').inputValue(),'haru-fast');assert.equal(await page.locator('#musicVolume').inputValue(),'35');
  await page.locator('#musicEnabled').uncheck();await page.waitForFunction(()=>__contexts[0].state==='suspended');
  assert.equal(await page.evaluate(()=>__players.find(p=>p.loop).paused),true);
  await page.evaluate(()=>{HTMLMediaElement.prototype.play=()=>Promise.reject(Error('blocked autoplay'));});await page.locator('#musicEnabled').check();await page.waitForTimeout(100);assert.deepEqual(errors,[]);
  console.log('PASS '+type.name()+': seven tracks decode and play; lazy loading; separate mute/gain; one shared context; loop; saved controls; user gesture restart; pagehide suspension; playback failure isolated');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
