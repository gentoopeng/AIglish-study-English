// Load player records only after the existing administrator password is verified.
(function(){
'use strict';
let dialog, authorized=false, busy=false, generation=0;
function element(tag,text){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;}
function deadline(task){let timer;return Promise.race([task,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('通信に時間がかかっています。接続後に再実行してください。')),15000))]).finally(()=>clearTimeout(timer));}
function message(text){dialog.querySelector('[role=status]').textContent=text;}
function guard(){if(!authorized||!dialog?.open)throw Error('管理者パスワードを入力してください。');if(!window.db||!window.fbRunTransaction)throw Error('接続後にお試しください。');}
function mount(){
 if(dialog)return;
 dialog=element('dialog');dialog.className='menu-dialog admin-players-dialog';dialog.setAttribute('aria-label','管理者ツール');
 dialog.innerHTML='<header class="menu-dialog-heading"><h2>管理者ツール</h2><button type="button" data-close aria-label="管理者ツールを閉じる">×</button></header><div data-body></div><p role="status" aria-live="polite"></p>';
 document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>{generation++;busy=false;authorized=false;window.isAdmin=false;dialog.close();};
 dialog.addEventListener('close',()=>{if(dialog.open)return;authorized=false;generation++;busy=false;window.isAdmin=false;dialog.querySelector('[data-body]').replaceChildren();if(window.__learningBootReady){if(currentActiveTabId==='titles')window.renderLeaderboard();else if(currentActiveTabId==='community')window.People.refresh(false);}});
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
}
function lock(value){busy=value;dialog.querySelectorAll('button:not([data-close]),input').forEach(node=>node.disabled=value);}
async function adminRequest(url,options){
 const task=async()=>{const response=await deadline(fetch(url,options)),data=await deadline(response.json());if(!response.ok){const error=Error(data.error?.message||'情報を取得できませんでした。');error.code=response.status===429?'resource-exhausted':data.error?.status;throw error;}return data;};
 return (window.FirestoreReadGuard?.wrap(task)||task)();
}
async function playerList(visit,isCurrent){
 const project=window.db?.app?.options?.projectId;
 if(!project)return deadline(window.UserDirectory.scan(visit,isCurrent));
 let cursor;const base='https://firestore.googleapis.com/v1/projects/'+project+'/databases/(default)/documents';
 do{if(!isCurrent())return;const query={from:[{collectionId:'users'}],select:{fields:['playerName','deleted'].map(fieldPath=>({fieldPath}))},orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],limit:25};if(cursor)query.startAt={values:[{referenceValue:cursor}],before:false};
 const rows=await adminRequest(base+':runQuery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({structuredQuery:query})});if(!Array.isArray(rows))throw Error('一覧を取得できませんでした。');const docs=rows.filter(row=>row.document).map(row=>row.document);for(const doc of docs){if(!isCurrent())return;visit(doc.name.split('/').pop(),window.RankingQuery.fields(doc.fields));}if(docs.length<25)return;cursor=docs.at(-1).name;
 }while(isCurrent());
}
async function refresh(){
 const request=++generation,body=dialog.querySelector('[data-body]');body.replaceChildren();const refresh=element('button','一覧を更新');refresh.type='button';refresh.disabled=busy;refresh.onclick=()=>refreshList();body.append(refresh);message('プレイヤーを読み込み中…');
 try{guard();const players=[];await deadline(playerList((id,data)=>{if(id!=='GUEST-000')players.push({id,name:data.playerName||id,deleted:!!data.deleted});},()=>authorized&&dialog.open&&generation===request));
 if(request!==generation||!authorized)return;
 for(const player of players){const row=element('button');row.type='button';row.className='admin-player-row';row.append(element('strong',player.name),element('small',player.id+(player.deleted?' · 削除済み':'')));row.onclick=()=>edit(player.id);body.append(row);}
 message(players.length?'プレイヤーを選んで編集してください。':'プレイヤーがいません。');
 }catch(error){if(request===generation){generation++;message(error.message);}}
}
async function refreshList(){if(busy)return;lock(true);try{await refresh();}finally{lock(false);}}
async function playerInfo(id){
 const project=window.db?.app?.options?.projectId;if(!project)return deadline(window.fbGetDoc(window.fbDoc(window.db,'users',id)));
 const fields=['playerName','realName','age','wordDuelRating','deleted'],url='https://firestore.googleapis.com/v1/projects/'+project+'/databases/(default)/documents/users/'+encodeURIComponent(id)+'?'+fields.map(name=>'mask.fieldPaths='+name).join('&');
 const data=await adminRequest(url);return {exists:()=>true,data:()=>window.RankingQuery.fields(data.fields)};
}
async function edit(id){
 if(busy)return;const request=++generation;lock(true);message('情報を確認中…');
 try{guard();const snap=await deadline(playerInfo(id));if(request!==generation||!dialog.open)return;guard();if(!snap.exists())throw Error('プレイヤーが見つかりません。');
 const data=snap.data(),body=dialog.querySelector('[data-body]'),form=element('form');body.replaceChildren();form.className='admin-player-form';form.append(element('h3',data.playerName||id),element('p','ID: '+id));
 function field(label,name,value,type='text'){const wrap=element('label',label),input=element('input');input.name=name;input.type=type;input.value=value??'';input.maxLength=40;if(type==='number'){input.min='0';input.max=name==='age'?'150':'100000';input.step='1';}wrap.append(input);form.append(wrap);return input;}
 field('ニックネーム','playerName',data.playerName);field('登録名','realName',data.realName);field('年齢','age',data.age,'number');const rating=field('対戦レート','rating',window.WordDuelModel.rating(data.wordDuelRating),'number');
 const reset=element('button','レートを1500に戻す');reset.type='button';reset.onclick=()=>{rating.value='1500';message('「変更を保存」でリセットを確定します。');};
 const save=element('button','変更を保存');save.type='submit';const back=element('button','一覧に戻る');back.type='button';back.onclick=refreshList;
 const remove=element('button',data.deleted?'完全削除を再確認':'プレイヤーを完全削除');remove.type='button';remove.className='admin-player-delete';
 form.append(reset,save,back,remove);if(data.deleted){form.querySelectorAll('label').forEach(node=>node.hidden=true);reset.hidden=true;save.hidden=true;}body.append(form);message(data.deleted?'削除済みです。未完了の完全削除を再実行できます。':'学習記録を保持したまま情報を編集します。');
 form.onsubmit=async event=>{event.preventDefault();if(busy)return;const name=form.elements.playerName.value.trim(),age=Number(form.elements.age.value),value=Number(rating.value);if(!name||!Number.isInteger(age)||age<0||age>150||!Number.isInteger(value)||value<0||value>100000){message('名前・年齢・レートを確認してください。');return;}
 await mutate(id,current=>{if(current.deleted)throw Error('削除済みのプレイヤーは編集できません。');const now=Date.now(),profile=window.UserProfileModel.decode(current.profileCustomizationJson);return {playerName:name,realName:form.elements.realName.value.trim(),age:String(age),wordDuelRating:value,wordDuelRatingUpdatedAt:now,profileCustomizationJson:JSON.stringify({...profile,nickname:name,updatedAt:Math.max(now,Number(profile.updatedAt||0)+1)})};});};
 remove.onclick=()=>{if(busy)return;const confirmation=element('div');confirmation.className='admin-player-confirm';confirmation.append(element('p',(data.playerName||id)+'（'+id+'）を完全削除します。学習記録・バックアップ・共有メモ・本人の公開教材も削除され、元に戻せません。'));
 const cancel=element('button','キャンセル');cancel.type='button';cancel.onclick=()=>confirmation.remove();const confirm=element('button','このプレイヤーを削除');confirm.type='button';confirm.onclick=()=>purge(id);confirmation.append(cancel,confirm);remove.after(confirmation);remove.disabled=true;cancel.onclick=()=>{confirmation.remove();remove.disabled=false;};};
 }catch(error){message(error.message);}finally{lock(false);}
}
async function mutate(id,patch){
 if(busy)return;lock(true);message('保存中…');
 let expected;
try{guard();await window.fbRunTransaction(window.db,async tx=>{guard();const ref=window.fbDoc(window.db,'users',id),snap=await tx.get(ref);if(!snap.exists())throw Error('プレイヤーが見つかりません。');const change=patch(snap.data());expected=change;tx.set(ref,change,{merge:true});});
 const check=await deadline((window.fbGetDocFromServer||window.fbGetDoc)(window.fbDoc(window.db,'users',id)));if(!check.exists()||Object.entries(expected).some(([key,value])=>JSON.stringify(check.data()[key])!==JSON.stringify(value)))throw Error('保存内容を確認できませんでした。一覧を更新してください。');
 if(id===myId){const data=check.data();window.WordDuel?.mergeRating(data);if(!data.deleted){localStorage.setItem('core_v4_profile_customization_'+id,data.profileCustomizationJson);myName=data.playerName;localStorage.setItem('core_v4_userName',myName);window.applyProfileToUi();}}
 window.LearningRanking?.invalidate();window.People?.invalidate();await refresh();message('保存しました。');
 }catch(error){message('保存できませんでした。'+error.message);}finally{lock(false);}
}
async function scan(ref,visit,owner){
if(owner&&window.fbWhere&&window.fbQuery)ref=window.fbQuery(ref,window.fbWhere(window.fbDocumentId(),'>=',window.fbDoc(window.db,'users',owner)),window.fbWhere(window.fbDocumentId(),'<',window.fbDoc(window.db,'users',owner,'\uf8ff','\uf8ff')));
const paged=['fbQuery','fbOrderBy','fbDocumentId','fbLimit','fbStartAfter'].every(key=>typeof window[key]==='function');let cursor;
do{guard();let query=ref;if(paged){const clauses=[window.fbOrderBy(window.fbDocumentId()),window.fbLimit(25)];if(cursor)clauses.push(window.fbStartAfter(cursor));query=window.fbQuery(ref,...clauses);}const snap=await deadline(window.fbGetDocs(query)),docs=snap.docs||[];if(!snap.docs)snap.forEach(doc=>docs.push(doc));for(const doc of docs){await visit(doc);await new Promise(resolve=>setTimeout(resolve,0));}cursor=docs.at(-1);if(!paged||docs.length<25)break;}while(cursor);
}
async function purge(id){
if(busy)return;lock(true);message('完全削除中…');
try{guard();const now=Date.now();await window.fbRunTransaction(window.db,async tx=>{guard();const ref=window.fbDoc(window.db,'users',id),allRef=window.fbDoc(window.db,'shared','all_users'),all=await tx.get(allRef);tx.set(ref,{deleted:true,deletedAt:now,deletionState:'pending'});const current=all.exists()?all.data():{};tx.set(allRef,{users:(Array.isArray(current.users)?current.users:[]).filter(user=>user&&user.id!==id),deletedIds:[...new Set([...(current.deletedIds||[]),id])]},{merge:true});});
// Include orphaned parts from interrupted backups, not just parts with existing metadata.
await scan(window.fbCollectionGroup(window.db,'parts'),async doc=>{if(doc.ref.path.startsWith('users/'+id+'/'))await window.fbDeleteDoc(doc.ref);},id);
await scan(window.fbQuery(window.fbCollectionGroup(window.db,'messages'),window.fbWhere('ownerId','==',id)),async doc=>{if(/^studyGroups\/[^/]+\/messages\//.test(doc.ref.path))await window.fbDeleteDoc(doc.ref);});
// Include former memberships: retained event owners are indexed without scanning unrelated groups.
let groupQuery=window.fbCollection(window.db,'studyGroups');if(window.fbWhere&&window.fbQuery)groupQuery=window.fbQuery(groupQuery,window.fbWhere('retainedMemberIds','array-contains',id));
await scan(groupQuery,async doc=>{const data=doc.data();if(!data.members?.[id]&&!(data.events||[]).some(event=>event.owner===id||event.reactions?.[id]))return;await window.fbRunTransaction(window.db,async tx=>{const snap=await tx.get(doc.ref);if(!snap.exists())return;const g=snap.data();delete g.members?.[id];delete g.baseline?.[id];delete g.progress?.[id];if(g.goal?.baseline)delete g.goal.baseline[id];g.events=(g.events||[]).filter(event=>event.owner!==id).map(event=>{delete event.reactions?.[id];return event;});if(g.owner===id)g.owner=Object.keys(g.members||{})[0]||'';g.retainedMemberIds=[...new Set([...Object.keys(g.members||{}),...g.events.map(event=>event.owner).filter(Boolean)])];if(!Object.keys(g.members||{}).length)tx.delete(doc.ref);else tx.set(doc.ref,g);});});
for(const collection of ['vocabProgress','vocabBooks','saves','library','sync','libraryDeletions','studyGroups','learningPoints','reviewPointDays'])await scan(window.fbCollection(window.db,'users',id,collection),doc=>window.fbDeleteDoc(doc.ref));
await scan(window.fbCollectionGroup(window.db,'notes'),async doc=>{if(/^publicVocabNotes\/[^/]+\/notes\/[^/]+$/.test(doc.ref.path)&&(doc.data().ownerId===id||doc.id===id))await (window.SharedNoteIndex?window.SharedNoteIndex.remove(doc.ref,doc.data().ownerId||doc.id):window.fbDeleteDoc(doc.ref));});
for(const collection of ['publicTextbooks','publicWorkbooks']){let ref=window.fbCollection(window.db,collection);if(window.fbWhere&&window.fbQuery)ref=window.fbQuery(ref,window.fbWhere('ownerId','==',id));await scan(ref,async doc=>{if(doc.data().ownerId===id)await window.fbDeleteDoc(doc.ref);});}
await window.fbRunTransaction(window.db,async tx=>{const ref=window.fbDoc(window.db,'public_works','all'),snap=await tx.get(ref);if(!snap.exists()||!snap.data().worksJson)return;const works=JSON.parse(snap.data().worksJson);if(!Array.isArray(works))throw Error('従来の公開ワークを確認できません。');const kept=works.filter(work=>work?.sharedBy!==id);if(kept.length!==works.length)tx.set(ref,{worksJson:JSON.stringify(kept)},{merge:true});});
// Remove the deleted player's answers/identity from retained match history.
await scan(window.fbCollection(window.db,'wordDuelRooms'),async doc=>{if(!doc.data().players?.[id])return;await window.fbRunTransaction(window.db,async tx=>{const snap=await tx.get(doc.ref);if(!snap.exists()||!snap.data().players?.[id])return;const room=snap.data();room.players[id]={name:'削除済み',answers:[],done:true,abandoned:true};if(room.result)for(const [field,value]of [['ratings',1500],['scores',0],['deltas',0]])if(room.result[field]&&typeof room.result[field]==='object'&&!Array.isArray(room.result[field]))room.result[field][id]=value;tx.set(doc.ref,room);});});
await window.fbSetDoc(window.fbDoc(window.db,'users',id),{deleted:true,deletedAt:now,deletionState:'complete'});
await window.TextbookFiles?.remove(id);
const cache=cachedUsers();localStorage.setItem('core_v4_users',JSON.stringify(cache.filter(user=>user.id!==id)));window.SharedVocabNotes?.invalidate();window.LearningRanking?.invalidate();window.People?.invalidate();
if(id===myId){purgeLocal(id);localStorage.setItem('core_v4_account_deleted_'+id,'1');localStorage.removeItem('core_v4_userId');await window.AppStorage?.flush();location.reload();return;}
await refresh();message('学習記録・バックアップ・共有メモを完全削除しました。');
}catch(error){message('完全削除が未完了です。もう一度開いて再実行してください。'+error.message);}finally{lock(false);}
}
function cachedUsers(){try{const users=JSON.parse(localStorage.getItem('core_v4_users')||'[]');return Array.isArray(users)?users:[];}catch(error){return [];}}
function purgeLocal(id){
const cached=cachedUsers();localStorage.setItem('core_v4_users',JSON.stringify(cached.filter(user=>user.id!==id)));
 const prefixes=['core_v4_group_chat_draft_','core_v4_groups_','core_v4_group_synced_','core_v4_flash_queue_','core_v4_flash_cursor_','core_v4_meaning_history_','aiglish_app_background_','aiglish_app_background_catalog_','aiglish_learning_recovery_','aiglish_study_lease_','aiglish_study_ledger_','core_v4_autosave_pending_','core_v4_custom_words_','core_v4_learning_ranking_','core_v4_learning_ranking_v2_','core_v4_library_deletions_','core_v4_personal_library_','core_v4_profile_customization_','core_v4_profile_shop_owned_','core_v4_ranking_swipes_v2_','core_v4_sync_settings_ts_','core_v4_user_avatar_','core_v4_user_stats_','core_v4_user_vocab_book_','core_v4_user_vocab_progress_','core_v4_vocab_draft_','core_v4_vocab_note_sharing_','core_v4_word_duel_pending_','core_v4_word_duel_rating_','save_studio_'];
const keys=Array.from({length:localStorage.length},(_,index)=>localStorage.key(index)).filter(Boolean);for(const key of keys)if(prefixes.some(prefix=>key===prefix+id||key.startsWith(prefix+id+'_')))localStorage.removeItem(key);
if(localStorage.getItem('core_v4_userId')===id){for(const key of ['core_v4_userName','core_v4_userTarget','core_v4_current_textbook_id','core_v4_friend_list','wordMemory','textHistory','myBookshelf','myFolders'])localStorage.removeItem(key);for(const key of keys)if(key.startsWith('core_v4_cache_'))localStorage.removeItem(key);}
}
async function canStart(id){
if(id==='GUEST-000')return true;
const key='core_v4_account_deleted_'+id;let blocked=localStorage.getItem(key)==='1';
if(window.db&&window.fbGetDoc){let timeout;try{const snap=await Promise.race([(window.fbGetDocFromServer||window.fbGetDoc)(window.fbDoc(window.db,'users',id)),new Promise((_,reject)=>timeout=setTimeout(()=>reject(Error('アカウント確認のタイムアウト')),4000))]);if(snap.exists()){blocked=!!snap.data().deleted;if(blocked)localStorage.setItem(key,'1');else localStorage.removeItem(key);}}catch(error){/* Retain local learning when disconnected; never infer deletion from a failed read. */}finally{clearTimeout(timeout);}}
if(!blocked)return true;
 const wasActive=window.__learningBootReady&&myId===id;await window.TextbookFiles?.remove(id);purgeLocal(id);
localStorage.removeItem('core_v4_userId');window.__learningBootReady=false;myId='GUEST-000';myName='ゲスト';window.isAdmin=false;await window.AppStorage?.flush();if(wasActive){location.reload();return false;}const gate=document.getElementById('auth-gate-screen');if(gate)gate.style.display='flex';const error=document.getElementById('authErrorMsg');if(error){error.textContent='このアカウントは管理者により削除されています。';error.style.display='block';}return false;
}
window.AdminPlayers={canStart,open(){mount();if(dialog.open)return;window.toggleSidebar(false);busy=false;authorized=false;window.isAdmin=false;dialog.querySelector('[data-body]').innerHTML='<form data-auth><label>管理者パスワード<input type="password" name="password" autocomplete="current-password" autocapitalize="none" spellcheck="false" required></label><button type="submit">管理者ツールを開く</button></form>';message('');dialog.showModal();dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();const input=event.currentTarget.elements.password;if(!window.verifyAdminPassword(input.value.trim())){message('管理者パスワードが違います。');return;}input.value='';authorized=true;window.isAdmin=true;await refreshList();};}};
})();
