// Restore overflow storage before any application module reads its saved state.
(function(){
'use strict';
const scripts=[...document.querySelectorAll('script[data-app-src]')],status=document.getElementById('appStartupStatus');
const buttons=[...document.querySelectorAll('#auth-gate-screen button')];buttons.forEach(button=>button.disabled=true);
window.appScriptsReady=window.AppStorage.ready.then(()=>{window.StartupMonitor?.mark?.('scripts-loading');return Promise.all(scripts.map(placeholder=>new Promise((resolve,reject)=>{const script=document.createElement('script');script.async=false;script.src=placeholder.dataset.appSrc;script.onload=resolve;script.onerror=()=>reject(Error('スクリプトを読み込めませんでした：'+placeholder.dataset.appSrc.split('?')[0]));document.body.append(script);})));});
// Home-screen apps have no reload control. Retry once automatically with a fresh
// document URL (a stale cached file is the usual cause), then offer a button.
function reload(){window.AppStorage.flush().catch(()=>{}).finally(()=>location.replace(location.pathname+'?reload='+Date.now()));}
const retryKey='aiglish_loader_retried';
window.appScriptsReady.then(()=>{try{sessionStorage.removeItem(retryKey);}catch{}window.StartupMonitor?.mark?.('scripts-ready');status.hidden=true;buttons.forEach(button=>button.disabled=false);}).catch(error=>{console.error('起動を停止しました。保存データは保持されています。',error);
 // The marker survives failed startups however slowly they fail; only success clears it.
 let retried=true;try{retried=sessionStorage.getItem(retryKey)==='1';if(!retried)sessionStorage.setItem(retryKey,'1');}catch{}
 if(!retried){status.textContent='最新のファイルを読み込み直しています…';reload();return;}
 status.textContent=error.message+' ';const button=document.createElement('button');button.type='button';button.textContent='再読み込み';button.onclick=reload;status.append(button);});
})();
