// Batch edits while keeping catalogue mutations on an earlier save deadline.
(function(){
    let revision=0,saved=0,pending=false,timer=null;
    const id=()=>typeof myId==='string'?myId:'';
    let owner=id();
    function changed(event){if(owner!==id()){owner=id();revision=0;saved=0;}revision++;window.localStorage?.setItem('core_v4_autosave_pending_'+owner,'1');}
    async function save(){
        timer=null;if(pending||revision===saved||!owner||owner==='GUEST-000'||!window.__backgroundSaveAll)return;
        if(window.LearningData&&!window.LearningData.canSave(typeof currentTextbook==='string'?currentTextbook:'default'))return;
        const account=owner,version=revision;pending=true;
        try{const result=await window.__backgroundSaveAll();if(id()===account&&result.cloudSaved){saved=version;if(revision===version)window.localStorage?.removeItem('core_v4_autosave_pending_'+account);}}
        catch(error){console.warn('自動保存は次回に再試行します',error);}finally{pending=false;}
    }
    function idleSave(){if(window.requestIdleCallback)window.requestIdleCallback(save,{timeout:3000});else setTimeout(save,0);}
    window.resumeBackgroundSave=function(){if(revision!==saved)idleSave();};
    window.queueBackgroundSave=function(){changed();if(!timer)timer=setTimeout(idleSave,15000);};
    if(window.onAppLoaded)window.onAppLoaded(()=>{if(window.localStorage?.getItem('core_v4_autosave_pending_'+id()))window.queueBackgroundSave();});
    let flashOwner='',flashSwipes=0;
    window.noteFlashSwipe=function(){if(flashOwner!==id()){flashOwner=id();flashSwipes=0;}flashSwipes++;changed();if(flashSwipes%5===0){if(window.AppStorage)window.AppStorage.flush().catch(error=>console.warn('理解度の端末保存を再試行します',error));window.queueBackgroundSave();}};
    window.flushFlashAutosave=function(){if(flashSwipes)window.queueBackgroundSave();};
    document.addEventListener('input',changed,{passive:true});document.addEventListener('change',changed,{passive:true});
    ['markVocabProgressDirty'].forEach(name=>{const original=window[name];if(typeof original==='function')window[name]=function(){changed();return original.apply(this,arguments);};});
    setInterval(()=>{if(owner!==id()){owner=id();revision=0;saved=0;}if(revision!==saved)idleSave();},60000);
    window.addEventListener('online',()=>{window.queueBackgroundSave();});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&revision!==saved)save();});
})();
