// Durable, idempotent coin receipts. Account purchases/claims commit in one Firestore transaction.
(function(){
'use strict';
const model=window.LearningRewardsModel,cutoff='2026-10-09';
const owner=()=>typeof myId==='string'&&myId?myId:'GUEST-000';
const key=id=>'core_v4_learning_wallet_v1_'+id;
let pending=null;
function read(id=owner()){const raw=localStorage.getItem(key(id)),backup=localStorage.getItem(key(id)+'_backup');if(!raw&&!backup)return model.wallet(typeof userStats==='object'?userStats.gold:0,model.dateKey(Date.now()));return model.mergeWallet(raw,backup);}
function store(wallet,id=owner()){const persisted=localStorage.getItem(key(id))||localStorage.getItem(key(id)+'_backup'),value=persisted?model.mergeWallet(read(id),wallet):model.mergeWallet(wallet),raw=JSON.stringify(value);for(const suffix of ['_backup',''])localStorage.setItem(key(id)+suffix,raw);if(owner()===id){if(typeof userStats==='object')userStats.gold=model.balance(value);render();}return value;}
function render(){const amount=model.balance(read());document.querySelectorAll('[data-wallet-balance]').forEach(el=>{const text=amount.toLocaleString('ja-JP');if(el.textContent!==text)el.textContent=text;});}
function mergeCloud(raw,id=owner()){if(raw&&!model.validWallet(raw))throw Error('コインの保存記録を確認できませんでした。残高は変更していません。');if(raw&&id===owner())return store(model.mergeWallet(raw),id);render();}
function deadline(promise){let timer;return Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('通信が完了しませんでした。接続後に再試行してください。')),12000))]).finally(()=>clearTimeout(timer));}
async function transaction(action){
 const id=owner();if(window.__learningBootReady===false)throw Error('保存データの読み込みが終わるまでお待ちください。');if(pending)throw Error('保存中です。少しお待ちください。');
 const task=(async()=>{
  const raw=localStorage.getItem(key(id)),backup=localStorage.getItem(key(id)+'_backup');if(id==='GUEST-000'&&(raw||backup)&&!model.validWallet(raw)&&!model.validWallet(backup))throw Error('コインの保存記録を確認できませんでした。残高は変更していません。');
  const local=read(id),activity=window.LearningActivity.read(id),study=window.StudyTime.snapshot();
  let next,profile=null;
  if(id==='GUEST-000')next=await action(local,{learningActivityV1Json:JSON.stringify(activity),studyLedgerJson:JSON.stringify(study)});
  else{
   if(!window.db||!window.fbRunTransaction)throw Error('コインの受け取り・購入には接続が必要です。');
   next=await window.fbRunTransaction(window.db,async tx=>{
    const ref=window.fbDoc(window.db,'users',id),snapshot=await tx.get(ref);if(owner()!==id)throw Error('アカウントが変更されました。');if(!snapshot.exists())throw Error('アカウントを確認できませんでした。');
    const doc=snapshot.data(),remote=doc.learningWalletV1Json;if(remote&&!model.validWallet(remote))throw Error('コインの保存記録を確認できませんでした。');
    // Once migrated, the dedicated wallet is authoritative; old gold snapshots never become fresh grants.
    const saved=localStorage.getItem(key(id))||localStorage.getItem(key(id)+'_backup');
    const base=remote?(saved?model.mergeWallet(local,remote):model.mergeWallet(remote)):model.wallet(window.StudyTimeModel.readStats(doc).gold??local.base,local.createdDay);
    const dated=model.mergeActivity(activity,doc.learningActivityV1Json),ledger=window.StudyTimeModel.mergeCurrent(study,window.StudyTimeModel.readStats(doc).study_calendar_v2);
    const combined={...doc,learningActivityV1Json:JSON.stringify(dated),studyLedgerJson:JSON.stringify(ledger)};
    const result=await action(base,combined,tx),fields={learningWalletV1Json:JSON.stringify(result)};
    profile=null;if(result.equipped.id!==base.equipped.id||result.equipped.at!==base.equipped.at){profile=window.UserProfileModel.merge(doc.profileCustomizationJson,localStorage.getItem('core_v4_profile_customization_'+id));profile.frame=result.equipped.id;profile.updatedAt=Math.max(Date.now(),Number(profile.updatedAt||0)+1);fields.profileCustomizationJson=JSON.stringify(profile);}
    tx.set(ref,fields,{merge:true});return result;
   });
  }
  if(owner()===id){store(next,id);if(id==='GUEST-000'&&next.equipped.id!==local.equipped.id){profile={...window.UserProfile.read(),frame:next.equipped.id,updatedAt:Date.now()};}if(profile){window.UserProfile.store(profile);window.applyProfileToUi();}await window.AppStorage?.flush();window.queueBackgroundSave?.();}return next;
 })();pending=task;try{return await deadline(task);}finally{task.finally(()=>{if(pending===task)pending=null;}).catch(()=>{});}
}
function dailyLetters(wallet,doc){
 const study=window.StudyTimeModel.readStats(doc).study_calendar_v2,dated=model.mergeActivity(doc.learningActivityV1Json),today=model.dateKey(Date.now()),days=new Set([...Object.keys(study?.days||{}),...Object.keys(dated.days)]);
 return Array.from(days).filter(day=>model.validDay(day)&&day>=cutoff&&day<today).sort().reverse().map(day=>model.dailyMail(day,window.StudyTimeModel.dayMilliseconds(study?.days?.[day]),model.count(dated,'ratings',day))).filter(letter=>letter.amount>0);
}
function localDoc(){return {studyLedgerJson:JSON.stringify(window.StudyTime.snapshot()),learningActivityV1Json:JSON.stringify(window.LearningActivity.read())};}
function claimDaily(day){if(!model.validDay(day)||day<cutoff||day>=model.dateKey(Date.now()))return Promise.reject(Error('この日の報酬はまだ受け取れません。'));return transaction((wallet,doc)=>{const letter=dailyLetters(wallet,doc).find(letter=>letter.day===day);if(!letter)throw Error('受け取れる報酬がありません。');return model.claim(wallet,letter.id,letter.amount);});}
async function refresh(){const id=owner();if(id==='GUEST-000'){render();return localDoc();}if(!window.db||!window.fbGetDoc)throw Error('接続後に更新してください。');const snap=await deadline(window.fbGetDoc(window.fbDoc(window.db,'users',id)));if(owner()!==id)throw Error('アカウントが変更されました。');if(!snap.exists())throw Error('アカウントを確認できませんでした。');const doc=snap.data();mergeCloud(doc.learningWalletV1Json,id);window.LearningActivity.mergeCloud(doc.learningActivityV1Json,id);if(doc.studyLedgerJson)window.StudyTime.mergeCloud(JSON.parse(doc.studyLedgerJson));return {...doc,...localDoc()};}
window.openMailbox=async function(){
 window.toggleSidebar(false);const id=owner(),dialog=window.openLibraryDialog('郵便ポスト','<div class="mailbox-balance"><i data-lucide="coins" aria-hidden="true"></i><span data-wallet-balance></span> コイン</div><p class="mailbox-status" role="status"></p><div class="mailbox-letters"></div><div class="library-editor-actions"><button type="button" data-library-close>閉じる</button></div>');
 const status=dialog.querySelector('.mailbox-status'),host=dialog.querySelector('.mailbox-letters');let page=0;render();
 function show(doc){host.replaceChildren();const wallet=read(),letters=[...window.WeeklyRewards?.letters()||[],...dailyLetters(wallet,doc)];if(!letters.length){status.textContent='前日までの学習報酬がここに届きます。';return;}status.textContent='';page=Math.min(page,Math.floor((letters.length-1)/30));for(const letter of letters.slice(page*30,(page+1)*30)){const item=document.createElement('section');item.className='mailbox-letter';const heading=document.createElement('h3');heading.textContent=letter.kind==='weekly'?letter.week+' 〜 の週間表彰':letter.day+' の学習';const detail=document.createElement('p');detail.textContent=letter.kind==='weekly'?{time:'勉強時間',words:'理解度を付けた回数',flash:'フラッシュのスワイプ数'}[letter.metric]+' · '+letter.place+'位':letter.minutes+'分 × 10 ＋ 理解度 '+letter.ratings+'回 × 1';const button=document.createElement('button');button.type='button';const difference=Math.max(0,letter.amount-(wallet.credits[letter.id]||0));button.textContent=difference?difference.toLocaleString('ja-JP')+' コインを受け取る':'受取済み';button.disabled=!difference;button.onclick=async()=>{button.disabled=true;status.textContent='保存しています…';try{if(letter.kind==='weekly')await window.WeeklyRewards.claim(letter);else await claimDaily(letter.day);if(owner()===id&&dialog.isConnected){show(await refresh());status.textContent='コインを受け取りました。';}}catch(error){if(dialog.isConnected){status.textContent=error.message;button.disabled=false;}}};item.append(heading,detail,button);host.append(item);}if(letters.length>30){const pager=document.createElement('div');pager.className='mailbox-pages';for(const [label,delta] of [['前へ',-1],['次へ',1]]){const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=delta<0?page===0:(page+1)*30>=letters.length;button.onclick=()=>{page+=delta;show(doc);};pager.append(button);}host.append(pager);}}
 show(localDoc());status.textContent='郵便を確認しています…';try{const doc=await refresh();await deadline(window.WeeklyRewards?.settle());if(dialog.isConnected&&owner()===id)show(doc);}catch(error){if(dialog.isConnected)status.textContent=error.message;}
};
window.LearningWallet={key,read,render,mergeCloud,refresh,claimDaily,transaction,dailyLetters,purchase:id=>transaction(wallet=>model.purchase(wallet,id,window.IconFrameCatalog||[],Date.now())),equip:id=>transaction(wallet=>model.equip(wallet,id,Date.now()))};
window.onAppLoaded(render);window.addEventListener('storage',event=>{if(event.key===key(owner()))render();});
})();
