// Restore overflow storage before any application module reads its saved state.
(function(){
'use strict';
const scripts=[...document.querySelectorAll('script[data-app-src]')],status=document.getElementById('appStartupStatus');
const buttons=[...document.querySelectorAll('#auth-gate-screen button')];buttons.forEach(button=>button.disabled=true);
window.appScriptsReady=window.AppStorage.ready.then(()=>Promise.all(scripts.map(placeholder=>new Promise((resolve,reject)=>{const script=document.createElement('script');script.async=false;script.src=placeholder.dataset.appSrc;script.onload=resolve;script.onerror=()=>reject(Error('スクリプトを読み込めませんでした：'+placeholder.dataset.appSrc.split('?')[0]));document.body.append(script);}))));
window.appScriptsReady.then(()=>{status.hidden=true;buttons.forEach(button=>button.disabled=false);}).catch(error=>{status.textContent=error.message+' ページを再読み込みしてください。';console.error('起動を停止しました。保存データは保持されています。',error);});
})();
