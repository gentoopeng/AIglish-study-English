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
 // A clean reload of a recovery session must not automatically restore the expensive surface.
 if(repeated||previous?.recovery)root.classList.add('pwa-recovery-rendering');
 const mark=active=>localStorage.setItem(key,JSON.stringify({active,at:Date.now(),recovery:root.classList.contains('pwa-recovery-rendering')}));
 mark(!document.hidden);
 window.RenderSafety={resumePhoto(){root.classList.remove('pwa-recovery-rendering');try{mark(!document.hidden);}catch(error){}}};
 setInterval(()=>{if(!document.hidden){try{mark(true);}catch(error){}}},30000);
 window.addEventListener('pagehide',()=>{try{mark(false);}catch(error){}});
 document.addEventListener('visibilitychange',()=>{try{mark(!document.hidden);}catch(error){}});
}catch(error){/* Diagnostics must not block startup when browser storage is unavailable. */}
})();
