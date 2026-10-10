// Back off globally on a confirmed quota error; never fabricate empty snapshots.
(function(){
'use strict';
let until=0;
function quota(error){return /resource-exhausted|quota.*exceed|429/i.test(String(error?.code||'')+' '+String(error?.message||''));}
function wrap(fn){return async function(...args){if(Date.now()<until){const error=Error('クラウドの利用上限に達したため、端末の保存記録を使います。後で再試行してください。');error.code='resource-exhausted';throw error;}try{return await fn.apply(this,args);}catch(error){if(quota(error)){until=Date.now()+300000;window.dispatchEvent(new CustomEvent('cloud-quota-paused'));}throw error;}};}
window.FirestoreReadGuard={wrap,install(){for(const name of ['fbGetDoc','fbGetDocFromServer','fbGetDocs','fbRunTransaction'])if(typeof window[name]==='function')window[name]=wrap(window[name]);},paused:()=>Date.now()<until};
})();
