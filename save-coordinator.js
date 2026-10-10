// Shared statistics refresh/throttling and learning-save coordination.
(function retainStatsSaveRefresh(){
var _prevSave = window.saveUserStats;
window.saveUserStats = async function () {
    var r = _prevSave ? await _prevSave.apply(this, arguments) : undefined;
    try { if (typeof window.applyProfileToUi === 'function') window.applyProfileToUi(); } catch (e) {}
    return r;
};

})();
(function retainStatsSaveThrottle(){
window.__fbWriteThrottle = window.__fbWriteThrottle || { last: 0, timer: null, pending: false };
var __origSaveUS2 = window.saveUserStats;
window.saveUserStats = function() {
    var now = Date.now();
    var st = window.__fbWriteThrottle;
    var elapsed = now - st.last;
    if (elapsed < 2500) {
        if (!st.pending) {
            st.pending = true;
            clearTimeout(st.timer);
            st.timer = setTimeout(function() {
                st.pending = false;
                st.last = Date.now();
                try { if (typeof __origSaveUS2 === 'function') __origSaveUS2(); } catch(e){}
                try { if (typeof window.applyProfileToUi === 'function') window.applyProfileToUi(); } catch(e){}
            }, 2500 - elapsed + 100);
        }
        return Promise.resolve();
    }
    st.last = now;
    var r;
    try { r = __origSaveUS2 ? __origSaveUS2.apply(this, arguments) : Promise.resolve(); } catch(e){ r = Promise.resolve(); }
    try { if (typeof window.applyProfileToUi === 'function') window.applyProfileToUi(); } catch(e){}
    return r;
};

})();
(function applySaveCoordinator(){
"use strict";
if(window.__saveCoordinatorApplied) return; window.__saveCoordinatorApplied=true;
try{ if(window.__autoSaveTimer){ clearInterval(window.__autoSaveTimer); window.__autoSaveTimer=null; } }catch(e){}

function coordinate(name){
var original=window[name];
if(typeof original!=='function') return null;
var running=false;
var pending=false;
var latestThis=null;
var latestArgs=[];

function run(){
if(running||!pending) return;
running=true;
pending=false;
var self=latestThis;
var args=latestArgs;
var result;
try{ result=original.apply(self,args); }
catch(error){ finish(error); return; }
Promise.resolve(result).then(function(){ finish(null); },function(error){ finish(error); });
}

function finish(error){
running=false;
if(error) console.error('自動保存に失敗しました:',error);
}

function request(){
latestThis=this;
latestArgs=arguments;
pending=true;
// クラウドへは送らないが、現在の教材をメモリ上の手動セーブ下書きへ退避する。
// 教材切替後に flush しても、変更時点の単語帳を失わないために必要。
if(name==='saveVocabToStorage'&&typeof window.__captureManualVocabDraft==='function'){
try{ window.__captureManualVocabDraft(); }catch(error){ console.error('単語帳の下書き保持に失敗しました:',error); }
}
// 通常操作では保存せず、手動保存・ログアウト時の flush だけで確定する。
return Promise.resolve();
}

window[name]=request;
return { flush:function(){
if(pending) run();
return new Promise(function(resolve){
function check(){
if(!running&&!pending){ resolve(); return; }
if(!running&&pending) run();
setTimeout(check,20);
}
check();
});
} };
}

// 自動保存は行わず、明示的な flush まで変更をまとめる。
var stats=coordinate('saveUserStats');
var vocab=coordinate('saveVocabToStorage');
window.__saveFlush=function(){
var jobs=[];
if(stats) jobs.push(stats.flush());
if(vocab) jobs.push(vocab.flush());
return Promise.all(jobs);
};
console.log('💾 手動セーブ調停処理適用完了');
})();
