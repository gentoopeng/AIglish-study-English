// Two lazy media channels share one context; no autoplay, preload sweep or cloud reads.
(function(){
'use strict';
const key='aiglish_sound_settings',files={menu:'menu',tap:'tap',confirm:'confirm',back:'back',navigate:'navigate',open:'open','swipe-right':'swipe-right','swipe-left':'swipe-left'};
const musicKey='aiglish_music_settings',tracks=['hitohira','in-that-mood','in-that-mood-narr','let-it-happen','let-it-happen-narr','haru-slow','haru-fast'];
let settings={enabled:true,volume:.3},musicSettings={enabled:false,volume:.2,track:tracks[0]},player=null,music=null,context=null,gain=null,musicGain=null,last=-Infinity,unlocked=false;
function suspend(){if((player&&!player.paused)||(music&&!music.paused))return;if(context?.state==='running')context.suspend().catch(()=>{});}
function setVolume(){if(gain)gain.gain.value=settings.volume;else if(player)player.volume=settings.volume;}
function createPlayer(volume,loop){
 const media=new Audio();media.preload='none';media.loop=loop;
 let node=null;
 const AudioContext=window.AudioContext||window.webkitAudioContext;
 // Both channels share one lazy context; iOS volume uses separate GainNodes.
 try{if(!context&&AudioContext)context=new AudioContext();if(context){node=context.createGain();context.createMediaElementSource(media).connect(node);node.connect(context.destination);node.gain.value=volume;media.volume=1;}else media.volume=volume;}catch{media.volume=volume;}
 media.addEventListener('ended',()=>{if(media.ended)suspend();});
 media.addEventListener('error',()=>{if(media.error){media.pause();suspend();}});
 return {media,node};
}
function initialize(){const channel=createPlayer(settings.volume,false);player=channel.media;gain=channel.node;}
function stopMusic(release=false){if(!music)return;music.pause();if(release){music.removeAttribute('src');music.load();}suspend();}
function playMusic(){
 if(!unlocked||!musicSettings.enabled||musicSettings.volume===0||document.hidden)return;
 try{
  if(!music){const channel=createPlayer(musicSettings.volume,true);music=channel.media;musicGain=channel.node;}
  if(musicGain)musicGain.gain.value=musicSettings.volume;else music.volume=musicSettings.volume;
  const url=new URL('assets/music/'+musicSettings.track+'.mp3',document.baseURI).href;
  if(music.src!==url){music.pause();music.src=url;}
  if(context?.state==='suspended')context.resume().catch(()=>{});
  if(music.paused){const pending=music.play();pending?.catch(()=>{if(music.paused)suspend();});}
 }catch{stopMusic();}
}
function renderMusic(){
 const enabled=document.getElementById('musicEnabled'),volume=document.getElementById('musicVolume'),track=document.getElementById('musicTrack');
 enabled.checked=musicSettings.enabled;volume.value=String(Math.round(musicSettings.volume*100));volume.disabled=!musicSettings.enabled;track.value=musicSettings.track;
 document.getElementById('musicVolumeValue').textContent=volume.value+'%';
}
function readMusic(){try{const saved=JSON.parse(localStorage.getItem(musicKey)||'null');musicSettings={enabled:saved?.enabled===true,volume:Number.isFinite(saved?.volume)?Math.max(0,Math.min(1,saved.volume)):.2,track:tracks.includes(saved?.track)?saved.track:tracks[0]};}catch{}renderMusic();if(!musicSettings.enabled||musicSettings.volume===0)stopMusic(true);else if(music&& !music.src.endsWith('/'+musicSettings.track+'.mp3'))stopMusic(true);}
function saveMusic(){try{localStorage.setItem(musicKey,JSON.stringify(musicSettings));}catch{}renderMusic();if(!musicSettings.enabled||musicSettings.volume===0)stopMusic(true);else playMusic();}
const musicEnabled=document.getElementById('musicEnabled'),musicVolume=document.getElementById('musicVolume'),musicTrack=document.getElementById('musicTrack');
musicEnabled.addEventListener('change',event=>{if(event.isTrusted)unlocked=true;musicSettings.enabled=musicEnabled.checked;saveMusic();});
musicTrack.addEventListener('change',event=>{if(event.isTrusted)unlocked=true;musicSettings.track=tracks.includes(musicTrack.value)?musicTrack.value:tracks[0];saveMusic();});
musicVolume.addEventListener('input',()=>{musicSettings.volume=Number(musicVolume.value)/100;if(musicGain)musicGain.gain.value=musicSettings.volume;else if(music)music.volume=musicSettings.volume;document.getElementById('musicVolumeValue').textContent=musicVolume.value+'%';if(musicSettings.volume===0)stopMusic(true);});
musicVolume.addEventListener('change',saveMusic);
function read(){try{const saved=JSON.parse(localStorage.getItem(key)||'null');settings={enabled:saved?.enabled!==false,volume:Number.isFinite(saved?.volume)?Math.max(0,Math.min(1,saved.volume)):.3};}catch{}render();}
function stop(release=false){if(!player)return;try{player.pause();if(player.readyState)player.currentTime=0;}catch{}if(release){try{player.removeAttribute('src');player.load();}catch{}suspend();}}
function play(kind='tap'){
 if(!settings.enabled||settings.volume===0||document.hidden||!Object.hasOwn(files,kind))return false;
 const now=performance.now();if(now-last<70)return false;
 try{
  if(!player)initialize();
  stop();setVolume();if(context?.state==='suspended')context.resume().catch(()=>{});
  const url=new URL('assets/sounds/'+files[kind]+'.mp3',document.baseURI).href;
  if(player.src!==url)player.src=url;
  last=now;
  // Called directly in the input event. Safari rejection never blocks studying.
  const pending=player.play();if(pending?.catch)pending.catch(()=>{if(player.paused)suspend();});
  return true;
 }catch{return false;}
}
function render(){const enabled=document.getElementById('soundEnabled'),volume=document.getElementById('soundVolume'),label=document.getElementById('soundVolumeValue');if(enabled)enabled.checked=settings.enabled;if(volume){volume.value=String(Math.round(settings.volume*100));volume.disabled=!settings.enabled;}if(label)label.textContent=Math.round(settings.volume*100)+'%';}
function save(){try{localStorage.setItem(key,JSON.stringify(settings));}catch{}render();if(!settings.enabled||settings.volume===0)stop(true);}
const enabled=document.getElementById('soundEnabled'),volume=document.getElementById('soundVolume');
enabled.addEventListener('change',()=>{settings.enabled=enabled.checked;save();if(settings.enabled)play('tap');});
volume.addEventListener('input',()=>{settings.volume=Number(volume.value)/100;setVolume();document.getElementById('soundVolumeValue').textContent=volume.value+'%';if(settings.volume===0)stop(true);});
volume.addEventListener('change',()=>{save();play('tap');});
function kindFor(button){
 if(button.dataset.sound)return button.dataset.sound;
 if(button.matches('.nav-item,.auth-tab-btn,[data-background]'))return 'navigate';
 if(button.matches('#headerSaveBtn,button[type=submit]'))return 'confirm';
 if(button.matches('.menu-trigger'))return 'menu';
 if(button.matches('.vocab-library-flash-button,.flashcard-info-button,.learning-podium-place,.podium-place,.people-row,.ranking-mini-self'))return 'open';
 const text=(button.getAttribute('aria-label')||button.textContent||'').trim();
 if(/閉じる|戻る|キャンセル|前の単語|ひとつ前/.test(text)||/Close$/.test(button.id))return 'back';
 if(/保存|登録|追加|適用|開始|決定/.test(text))return 'confirm';
 if(/詳細|メモ|すべて表示/.test(text))return 'open';
 return 'tap';
}
document.addEventListener('click',event=>{
 if(event.isTrusted){unlocked=true;if(!event.target.closest?.('#musicEnabled'))playMusic();}
 const target=event.target instanceof Element?event.target.closest('button,[role=button],a[href],.textbook-list-item'):null;
 if(!target||target.matches(':disabled,[aria-disabled=true],[data-sound=none]')||target.closest('#activeFlashcard')||target.hasAttribute('onpointerdown')&&/updateMeaningStatus/.test(target.getAttribute('onpointerdown')))return;
 play(kindFor(target));
},{capture:true});
document.addEventListener('pointerdown',event=>{
 const button=event.target instanceof Element?event.target.closest('button[onpointerdown]'):null;
 if(button&&!button.disabled&&/updateMeaningStatus/.test(button.getAttribute('onpointerdown')))play('tap');
},{capture:true,passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop(true);stopMusic(true);}});
window.addEventListener('pagehide',()=>{stop(true);stopMusic(true);});
window.addEventListener('storage',event=>{if(event.key===key){read();if(!settings.enabled||settings.volume===0)stop(true);}if(event.key===musicKey)readMusic();});
window.AppSounds=Object.freeze({play,stop});read();readMusic();window.onAppLoaded?.(()=>{read();readMusic();});
})();
