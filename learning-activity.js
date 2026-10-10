// Small per-day counters, synchronized beside the existing ranking transaction.
(function(){
'use strict';
const model=window.LearningRewardsModel,source=crypto.randomUUID();
const owner=()=>typeof myId==='string'&&myId?myId:'GUEST-000';
const key=id=>'core_v4_learning_activity_v1_'+id;
function read(id=owner()){return model.mergeActivity(localStorage.getItem(key(id)),localStorage.getItem(key(id)+'_backup'));}
function persist(record,id=owner()){const merged=model.mergeActivity(read(id),record),raw=JSON.stringify(merged);for(const suffix of ['_backup',''])if(localStorage.getItem(key(id)+suffix)!==raw)localStorage.setItem(key(id)+suffix,raw);return merged;}
function note(kind){if(window.__learningBootReady===false)return;try{persist(model.add(read(),kind,source,Date.now()));window.queueBackgroundSave?.();}catch(error){console.warn('学習回数は保存を再試行します',error);}}
window.LearningActivity={key,read,note,persist,fromDoc:doc=>model.mergeActivity(doc?.learningActivityV1Json),mergeCloud:(record,id=owner())=>{if(owner()===id)return persist(record,id);}};
})();
