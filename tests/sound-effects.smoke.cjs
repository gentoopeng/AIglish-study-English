const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const type=process.env.BROWSER==='webkit'?webkit:chromium;
 const browser=await type.launch(type===chromium?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{executablePath:process.env.WEBKIT_EXECUTABLE_PATH});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('crash',()=>errors.push('crash'));page.on('request',r=>{if(r.url().includes('/sounds/'))requests.push(r.url());});await page.route('https://**/*',r=>r.abort());
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
  await page.locator('.menu-trigger').click();await page.waitForFunction(()=>__players[0]?.readyState>=2);assert.equal(await page.evaluate(()=>__players.length),1);assert.equal(await page.evaluate(()=>__contexts.length),1);assert.equal(await page.evaluate(()=>__gains[0].gain.value.toFixed(1)),'0.3');
  await page.locator('#soundEnabled').uncheck();const muted=await page.evaluate(()=>__plays.length);await page.evaluate(()=>AppSounds.play('confirm'));assert.equal(await page.evaluate(()=>__plays.length),muted);assert.equal(await page.locator('#soundVolume').isDisabled(),true);assert.equal(await page.evaluate(()=>__players[0].paused),true);
  await page.reload();await page.waitForFunction(()=>window.__learningBootReady===true);await page.locator('.menu-trigger').click();assert.equal(await page.locator('#soundEnabled').isChecked(),false);assert.equal(await page.evaluate(()=>__players.length),0,'muted reload has no audio');
  await page.locator('#soundEnabled').check();await page.locator('#soundVolume').evaluate(el=>{el.value='20';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});assert.equal(await page.evaluate(()=>__gains[0].gain.value.toFixed(1)),'0.2');await page.evaluate(async()=>{await AppStorage.flush();toggleSidebar(false);});
  // Real MP3 decoding and every supplied sound, through trusted button clicks.
  await page.evaluate(()=>{const host=document.createElement('div');host.id='sound-fixture';host.style='position:fixed;inset:120px 20px auto;z-index:99999;background:#111';for(const kind of ['tap','confirm','back','navigate','open','swipe-right','swipe-left']){const b=document.createElement('button');b.dataset.sound=kind;b.textContent=kind;host.append(b);}document.body.append(host);});
  for(const kind of ['tap','confirm','back','navigate','open','swipe-right','swipe-left']){await page.waitForTimeout(90);await page.locator('#sound-fixture [data-sound="'+kind+'"]').click();await page.waitForFunction(kind=>__decoded.some(entry=>entry.src.endsWith('/'+kind+'.mp3')&&Number.isFinite(entry.duration))&&__started.some(src=>src.endsWith('/'+kind+'.mp3')),kind);}
  await page.waitForTimeout(90);const burst=await page.evaluate(()=>{const before=__plays.length;for(let i=0;i<100;i++)AppSounds.play('tap');return __plays.length-before;});assert.equal(burst,1);assert.equal(await page.evaluate(()=>__players.length),1);assert.equal(await page.evaluate(()=>__contexts.length),1);
  await page.evaluate(()=>{document.getElementById('sound-fixture').remove();currentTextbook='sound-book';vocabList=[{num:1,word:'study',meanings:[{id:'one',text:'学ぶ',status:'none'}]},{num:2,word:'learn',meanings:[{id:'two',text:'習う',status:'none'}]},{num:3,word:'read',meanings:[{id:'three',text:'読む',status:'none'}]}];switchTab('game');document.getElementById('game-start-screen').style.display='none';document.getElementById('flashcard-play-screen').style.display='flex';document.body.classList.add('in-game-active');flashcardOriginQueue=vocabList.map(w=>({num:w.num,en:w.word,ja:w.meanings[0].text,meaningId:w.meanings[0].id}));flashcardCurrentIndex=0;flashcardSessionHistory=[];renderFlashcardDeck();});
  await page.waitForTimeout(90);await page.evaluate(()=>swipeFlashcard('right',100,0));assert.ok((await page.evaluate(()=>__plays.at(-1))).endsWith('/swipe-right.mp3'));await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>vocabList[0].meanings[0].status),'ok');
  await page.evaluate(()=>swipeFlashcard('left',-100,0));assert.ok((await page.evaluate(()=>__plays.at(-1))).endsWith('/swipe-left.mp3'));await page.waitForTimeout(1000);
  await page.evaluate(()=>swipeFlashcard('up',0,-100));assert.ok((await page.evaluate(()=>__plays.at(-1))).endsWith('/navigate.mp3'));await page.waitForTimeout(1000);
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.equal(await page.evaluate(()=>__players[0].paused),true);await page.waitForFunction(()=>__contexts[0].state==='suspended');assert.equal(await page.evaluate(()=>__players[0].hasAttribute('src')),false);
  await page.reload();await page.waitForFunction(()=>window.__learningBootReady===true);await page.locator('.menu-trigger').click();assert.equal(await page.locator('#soundVolume').inputValue(),'20');
  await page.evaluate(()=>toggleSidebar(false));
  // Playback failures never throw into application input handlers.
  await page.evaluate(()=>{HTMLMediaElement.prototype.play=()=>Promise.reject(Error('blocked autoplay'));});await page.waitForTimeout(90);await page.locator('#headerBackgroundButton').click();await page.waitForTimeout(100);assert.deepEqual(errors,[]);
  console.log('PASS '+type.name()+': no startup sound reads; seven MP3s decode/play; one media element/context; software gain; muted and volume reload; bounded burst; flash swipes preserve ratings; background suspension; rejected playback isolated');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
