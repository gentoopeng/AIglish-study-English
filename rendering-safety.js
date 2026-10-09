// Keep data intact; recover conservatively from an unclean renderer restart.
(function () {
'use strict';
const root=document.documentElement;
const appleTouch=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
if(appleTouch)root.classList.add('ios-stable-rendering');
if(!appleTouch)return;
const key='__aiglish_render_guard',now=Date.now();
try{
 const previous=JSON.parse(localStorage.getItem(key)||'null');
 const repeated=previous?.active&&now-previous.at>=0&&now-previous.at<120000;
 if(repeated)root.classList.add('pwa-recovery-rendering');
 localStorage.setItem(key,JSON.stringify({active:true,at:now}));
 const finish=()=>localStorage.setItem(key,JSON.stringify({active:false,at:Date.now()}));
 setInterval(()=>{if(!document.hidden){try{localStorage.setItem(key,JSON.stringify({active:true,at:Date.now()}));}catch(error){}}},30000);
 window.addEventListener('pagehide',()=>{try{finish();}catch(error){}});
 document.addEventListener('visibilitychange',()=>{try{if(document.hidden)finish();else localStorage.setItem(key,JSON.stringify({active:true,at:Date.now()}));}catch(error){}});
}catch(error){/* Diagnostics must not block startup when browser storage is unavailable. */}
})();
