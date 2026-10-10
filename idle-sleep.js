// One idle deadline; no writes or polling until sleep begins.
(function(){
'use strict';
let last=Date.now(),account='',timer=null,sleeping=false,warning=null,overlay=null;
const owner=()=>typeof myId==='string'?myId:'';
function ready(){return window.__learningBootReady===true&&owner();}
function clearWarning(){warning?.remove();warning=null;}
function schedule(){clearTimeout(timer);if(!ready()||sleeping||document.hidden)return;timer=setTimeout(check,Math.max(1,last+(warning?310000:300000)-Date.now()));}
function activity(){if(!ready()||sleeping)return;account=owner();last=Date.now();clearWarning();schedule();}
async function enter(){
 if(sleeping||!ready()||owner()!==account)return;sleeping=true;clearWarning();clearTimeout(timer);window.StudyTime.sleep(last);
 overlay=document.createElement('dialog');overlay.id='idleSleepOverlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','スリープモード');overlay.innerHTML='<div><p>スリープモード</p><small role="status">保存しています…</small><button type="button">タップして再開</button></div>';document.body.append(overlay);overlay.addEventListener('cancel',event=>event.preventDefault());overlay.showModal();
 const view=overlay,button=view.querySelector('button');button.onclick=wake;button.focus();
 try{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));await window.AppStorage?.flush();const result=await window.__backgroundSaveAll?.();if(result?.cloudSaved===false&&owner()!=='GUEST-000')throw Error('offline');if(overlay===view)view.querySelector('small').textContent='計測を停止しました。';}catch{if(overlay===view)view.querySelector('small').textContent='保存を完了できませんでした。再開後に保存を再試行してください。';}
}
function wake(){if(!sleeping)return;sleeping=false;overlay?.remove();overlay=null;window.StudyTime.wake();activity();document.querySelector('.menu-trigger')?.focus();}
function check(){if(!ready()||document.hidden){schedule();return;}if(owner()!==account){activity();return;}const elapsed=Date.now()-last;if(elapsed>=310000){enter();return;}if(elapsed>=300000&&!warning){warning=document.createElement('div');warning.id='idleSleepWarning';warning.setAttribute('popover','manual');warning.setAttribute('role','alert');warning.textContent='操作がありませんでした。あと10秒でスリープモードに入ります。';document.body.append(warning);warning.showPopover?.();}schedule();}
for(const event of ['pointerdown','pointermove','keydown','input','wheel','scroll'])document.addEventListener(event,activity,{passive:true,capture:true});
document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)check();});
window.addEventListener('learning-data-ready',activity);window.onAppLoaded(activity);
window.IdleSleep={check,wake,activity,isSleeping:()=>sleeping};
})();
