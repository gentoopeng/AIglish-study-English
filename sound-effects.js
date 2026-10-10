// One lazy media element and gain graph; no autoplay, preload sweep or cloud reads.
(function(){
'use strict';
const key='aiglish_sound_settings',files={tap:'tap',confirm:'confirm',back:'back',navigate:'navigate',open:'open','swipe-right':'swipe-right','swipe-left':'swipe-left'};
let settings={enabled:true,volume:.3},player=null,context=null,gain=null,last=-Infinity;
function suspend(){if(context?.state==='running')context.suspend().catch(()=>{});}
function setVolume(){if(gain)gain.gain.value=settings.volume;else if(player)player.volume=settings.volume;}
function initialize(){
 player=new Audio();player.preload='none';player.loop=false;
 // iOS ignores HTMLMediaElement.volume; a single GainNode applies the slider.
 const AudioContext=window.AudioContext||window.webkitAudioContext;
 if(AudioContext)try{context=new AudioContext();gain=context.createGain();context.createMediaElementSource(player).connect(gain);gain.connect(context.destination);player.volume=1;}catch{gain=null;if(context)context.close().catch(()=>{});context=null;}
 player.addEventListener('ended',()=>{if(player.ended)suspend();});
 player.addEventListener('error',()=>{if(player.error)suspend();});
}
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
 if(button.matches('.menu-trigger,.vocab-library-flash-button,.flashcard-info-button,.learning-podium-place,.podium-place,.people-row,.ranking-mini-self'))return 'open';
 const text=(button.getAttribute('aria-label')||button.textContent||'').trim();
 if(/閉じる|戻る|キャンセル|前の単語|ひとつ前/.test(text)||/Close$/.test(button.id))return 'back';
 if(/保存|登録|追加|適用|開始|決定/.test(text))return 'confirm';
 if(/詳細|メモ|すべて表示/.test(text))return 'open';
 return 'tap';
}
document.addEventListener('click',event=>{
 const target=event.target instanceof Element?event.target.closest('button,[role=button],a[href],.textbook-list-item'):null;
 if(!target||target.matches(':disabled,[aria-disabled=true],[data-sound=none]')||target.closest('#activeFlashcard')||target.hasAttribute('onpointerdown')&&/updateMeaningStatus/.test(target.getAttribute('onpointerdown')))return;
 play(kindFor(target));
},{capture:true});
document.addEventListener('pointerdown',event=>{
 const button=event.target instanceof Element?event.target.closest('button[onpointerdown]'):null;
 if(button&&!button.disabled&&/updateMeaningStatus/.test(button.getAttribute('onpointerdown')))play('tap');
},{capture:true,passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop(true);});
window.addEventListener('pagehide',()=>stop(true));
window.addEventListener('storage',event=>{if(event.key===key){read();if(!settings.enabled||settings.volume===0)stop(true);}});
window.AppSounds=Object.freeze({play,stop});read();window.onAppLoaded?.(read);
})();
