// Load player records only after the existing administrator password is verified.
(function(){
'use strict';
let dialog, authorized=false, busy=false, generation=0;
// Editing mode for the shared word books: after the password, admin rights stay on outside
// this dialog until 終了 or a reload, and a banner says that changes reach everyone.
const bookEditing=()=>window.__adminBookEditing===true;
function setBookEditing(on){
 window.__adminBookEditing=!!on;window.isAdmin=!!on;
 let banner=document.getElementById('adminBookEditingBanner');
 if(on&&!banner){banner=document.createElement('div');banner.id='adminBookEditingBanner';banner.className='admin-book-editing';banner.setAttribute('role','status');
  const text=document.createElement('span');text.textContent='管理者モード：配信中の単語帳を編集できます（変更は全員に反映）';
  const end=document.createElement('button');end.type='button';end.textContent='終了';end.onclick=()=>setBookEditing(false);
  banner.append(text,end);
  // In the word book screen's flow, so it never covers a button.
  const host=document.getElementById('view-vocab');if(host)host.prepend(banner);else document.body.append(banner);}
 if(!on&&banner)banner.remove();
 document.body.classList.toggle('admin-book-editing-on',!!on);
 if(window.__learningBootReady){window.renderVocabList?.();window.renderVocabLibrarySelection?.();}
}
window.AdminBookEditing=Object.freeze({on:bookEditing,stop:()=>setBookEditing(false)});
function element(tag,text){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;}
function deadline(task){let timer;return Promise.race([task,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('通信に時間がかかっています。接続後に再実行してください。')),15000))]).finally(()=>clearTimeout(timer));}
function message(text){dialog.querySelector('[role=status]').textContent=text;}
function guard(){if(!authorized||!dialog?.open)throw Error('管理者パスワードを入力してください。');if(!window.db||!window.fbRunTransaction)throw Error('接続後にお試しください。');}
function mount(){
 if(dialog)return;
 dialog=element('dialog');dialog.className='menu-dialog admin-players-dialog';dialog.setAttribute('aria-label','管理者ツール');
 dialog.innerHTML='<header class="menu-dialog-heading"><h2>管理者ツール</h2><button type="button" data-close aria-label="管理者ツールを閉じる">×</button></header><div data-body></div><p role="status" aria-live="polite"></p>';
 document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>{generation++;busy=false;authorized=false;window.isAdmin=bookEditing();dialog.close();};
 dialog.addEventListener('close',()=>{if(dialog.open)return;authorized=false;generation++;busy=false;window.isAdmin=bookEditing();dialog.querySelector('[data-body]').replaceChildren();if(window.__learningBootReady){if(currentActiveTabId==='titles')window.renderLeaderboard();else if(currentActiveTabId==='community')window.People.refresh(false);}});
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
}
function lock(value){busy=value;dialog.querySelectorAll('button:not([data-close]),input').forEach(node=>node.disabled=value);}
async function adminRequest(url,options){
 const task=async()=>{const response=await deadline(fetch(url,options)),data=await deadline(response.json());if(!response.ok){const error=Error(data.error?.message||'情報を取得できませんでした。');error.code=response.status===429?'resource-exhausted':data.error?.status;throw error;}return data;};
 return (window.FirestoreReadGuard?.wrap?.(task)||task)();
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
 const request=++generation,body=dialog.querySelector('[data-body]');body.replaceChildren();const refresh=element('button','一覧を更新');refresh.type='button';refresh.disabled=busy;refresh.onclick=()=>refreshList();
 const books=element('button',bookEditing()?'単語帳の編集モードを終了':'配信中の単語帳を編集する');books.type='button';books.className='admin-books-button';books.onclick=()=>{if(bookEditing()){setBookEditing(false);books.textContent='配信中の単語帳を編集する';return;}setBookEditing(true);dialog.close();window.switchTab?.('vocab');window.showToast?.('管理者モードです。配信中の単語帳の単語を編集できます。','info');};
 const notices=element('button','お知らせを配信');notices.type='button';notices.className='admin-notices-button';notices.onclick=compose;
 const sent=element('button','運営からの送信履歴');sent.type='button';sent.className='admin-history-button';sent.onclick=history;
 body.append(refresh,books,notices,sent);message('プレイヤーを読み込み中…');
 try{guard();const players=[];await deadline(playerList((id,data)=>{if(id!=='GUEST-000')players.push({id,name:data.playerName||id,deleted:!!data.deleted});},()=>authorized&&dialog.open&&generation===request));
 if(request!==generation||!authorized)return;
 for(const player of players){const row=element('button');row.type='button';row.className='admin-player-row';row.append(element('strong',player.name),element('small',player.id+(player.deleted?' · 削除済み':'')));row.onclick=()=>edit(player.id);body.append(row);}
 message(players.length?'プレイヤーを選んで編集してください。':'プレイヤーがいません。');
 }catch(error){if(request===generation){generation++;message(error.message);}}
}
// Notices for everyone: write one, or take one down. They show in the bell's box.
async function compose(){
 if(busy)return;generation++;const body=dialog.querySelector('[data-body]'),form=element('form');body.replaceChildren();form.className='admin-notice-form';
 const title=element('input'),text=element('textarea'),titleLabel=element('label','タイトル'),textLabel=element('label','本文');
 title.name='title';title.maxLength=60;title.required=true;text.name='body';text.maxLength=1000;titleLabel.append(title);textLabel.append(text);
 const send=element('button','全員に配信');send.type='submit';const back=element('button','一覧に戻る');back.type='button';back.onclick=refreshList;
 const list=element('ul');list.className='admin-notice-list';list.setAttribute('aria-label','配信中のお知らせ');
 form.append(element('h3','お知らせを配信'),titleLabel,textLabel,send,back);body.append(form,element('h3','配信中'),list);
 const draw=items=>{list.replaceChildren();for(const n of items){const li=element('li'),drop=element('button','取り下げる');drop.type='button';drop.onclick=async()=>{if(busy)return;lock(true);message('取り下げています…');try{guard();draw(await deadline(window.Notices.remove(n.id)));message('取り下げました。');}catch(error){message(error.message);}finally{lock(false);}};li.append(element('span',n.title),drop);list.append(li);}if(!items.length)list.append(element('li','配信中のお知らせはありません。'));};
 form.onsubmit=async event=>{event.preventDefault();if(busy)return;lock(true);message('配信しています…');try{guard();draw(await deadline(window.Notices.post({title:title.value,body:text.value})));title.value='';text.value='';message('配信しました。ベルのお知らせに届きます。');}catch(error){message(error.message);}finally{lock(false);}};
 message('読み込み中…');try{guard();draw(await deadline(window.Notices.load()));message('タイトルと本文を入れて配信してください。');}catch(error){message(error.message);}
}
// Everything the 運営 has given or taken back, for everyone, newest first, with whether each
// player's device has taken it in yet (PointLoans.adminHistory).
async function history(){
 if(busy)return;generation++;const request=generation,body=dialog.querySelector('[data-body]');body.replaceChildren();
 const back=element('button','一覧に戻る');back.type='button';back.onclick=refreshList;
 const list=element('ol');list.className='admin-gift-list admin-history-list';list.setAttribute('aria-label','運営からの送信履歴');
 body.append(element('h3','運営からの送信履歴'),list,back);message('読み込み中…');
 try{guard();const rows=await deadline(window.PointLoans.adminHistory());if(request!==generation)return;
  const when=at=>new Date(at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
  let given=0,taken=0;
  for(const e of rows){if(e.kind==='charge')taken+=e.amount;else given+=e.amount;
   const li=element('li');li.className=(e.kind==='charge'?'is-charge':'is-gift')+(e.taken?' is-taken':'');
   li.append(element('span',e.name+'　'+(e.kind==='charge'?'−':'+')+e.amount.toLocaleString('ja-JP')+'pt'+(e.note?'「'+e.note+'」':'')),element('small',when(e.at)+'　'+(e.taken?'反映済み':'まだ（本人がアプリを開くと反映）')));
   list.append(li);}
  if(!rows.length)list.append(element('li','まだ送信はありません'));
  message(rows.length?rows.length+'件　増やした合計 '+given.toLocaleString('ja-JP')+'pt・減らした合計 '+taken.toLocaleString('ja-JP')+'pt':'');
 }catch(error){if(request===generation)message('読み込めませんでした。'+error.message);}
}
async function refreshList(){if(busy)return;lock(true);try{await refresh();}finally{lock(false);}}
async function playerInfo(id){
 const project=window.db?.app?.options?.projectId;if(!project)return deadline(window.fbGetDoc(window.fbDoc(window.db,'users',id)));
 const fields=['playerName','deleted'],url='https://firestore.googleapis.com/v1/projects/'+project+'/databases/(default)/documents/users/'+encodeURIComponent(id)+'?'+fields.map(name=>'mask.fieldPaths='+name).join('&');
 const data=await adminRequest(url);return {exists:()=>true,data:()=>window.RankingQuery.fields(data.fields)};
}
async function edit(id){
 if(busy)return;const request=++generation;lock(true);message('情報を確認中…');
 try{guard();const snap=await deadline(playerInfo(id));if(request!==generation||!dialog.open)return;guard();if(!snap.exists())throw Error('プレイヤーが見つかりません。');
 const data=snap.data(),body=dialog.querySelector('[data-body]'),form=element('form');body.replaceChildren();form.className='admin-player-form';form.append(element('h3',data.playerName||id),element('p','ID: '+id));
 function field(label,name,value,type='text'){const wrap=element('label',label),input=element('input');input.name=name;input.type=type;input.value=value??'';input.maxLength=40;if(type==='number'){input.min='0';input.max=name==='age'?'150':'100000';input.step='1';}wrap.append(input);form.append(wrap);return input;}
 field('ニックネーム','playerName',data.playerName);
 const save=element('button','変更を保存');save.type='submit';const back=element('button','一覧に戻る');back.type='button';back.onclick=refreshList;
 const remove=element('button',data.deleted?'完全削除を再確認':'プレイヤーを完全削除');remove.type='button';remove.className='admin-player-delete';
 form.append(save,back,remove);if(data.deleted){form.querySelectorAll('label').forEach(node=>node.hidden=true);save.hidden=true;}body.append(form);
 // Points from the 運営: add or take back. The player's own device applies it to their wallet
 // (nobody else ever writes a wallet) the next time the app is open; the list says what that
 // device has taken in yet, from the record between 運営 and the player (PointLoans.grant).
 if(!data.deleted&&window.PointLoans?.grant){const box=element('div');box.className='admin-player-gift';box.append(element('h4','ポイントを操作'));
  const balance=element('p','所持ポイントを確認中…');balance.className='admin-gift-balance';
  const amount=element('input');amount.type='number';amount.min='1';amount.max='100000';amount.step='1';amount.inputMode='numeric';amount.setAttribute('aria-label','操作するポイント');
  const note=element('input');note.type='text';note.maxLength=120;note.placeholder='ひとこと（任意）';note.setAttribute('aria-label','運営からのひとこと');
  const row=element('div');row.className='admin-gift-actions';
  const list=element('ol');list.className='admin-gift-list';list.setAttribute('aria-label','運営からの操作');
  const when=at=>new Date(at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
  async function ledger(){try{const got=await deadline(window.PointLoans.adminLedger(id));balance.textContent=got.balance===null?'所持ポイント：まだ記録がありません':'所持ポイント：'+got.balance.toLocaleString('ja-JP')+'pt（本人の端末が最後に保存した値）';list.replaceChildren();
   for(const e of got.entries.slice().reverse()){const li=element('li');li.className=(e.kind==='charge'?'is-charge':'is-gift')+(e.taken?' is-taken':'');li.append(element('span',(e.kind==='charge'?'−':'+')+e.amount.toLocaleString('ja-JP')+'pt'+(e.note?'「'+e.note+'」':'')),element('small',when(e.at)+'　'+(e.taken?'反映済み':'まだ（本人がアプリを開くと反映）')));list.append(li);}
   if(!got.entries.length)list.append(element('li','まだ操作はありません'));}catch(error){balance.textContent='所持ポイントを読めませんでした。'+error.message;}}
  const act=(kind,label)=>{const b=element('button',label);b.type='button';b.onclick=async()=>{if(busy)return;const n=Math.floor(Number(amount.value));if(!(n>=1&&n<=100000)){message('1〜100,000ptで入れてください。');return;}lock(true);message('送信中…');
   try{guard();await deadline(window.PointLoans.grant(id,data.playerName||id,n,note.value.trim(),kind));amount.value='';note.value='';message((data.playerName||id)+'さんの所持ポイントを '+(kind==='charge'?'−':'+')+n.toLocaleString('ja-JP')+'pt します。本人がアプリを開いたときに反映されます。');await ledger();}
   catch(error){message('送れませんでした。'+error.message);}finally{lock(false);}};return b;};
  row.append(act('gift','増やす'),act('charge','減らす'));
  box.append(balance,amount,note,row,element('p','運営からの操作'),list);body.append(box);ledger();}message(data.deleted?'削除済みです。未完了の完全削除を再実行できます。':'学習記録を保持したまま情報を編集します。');
 form.onsubmit=async event=>{event.preventDefault();if(busy)return;const name=form.elements.playerName.value.trim();if(!name){message('ニックネームを入力してください。');return;}
 await mutate(id,current=>{if(current.deleted)throw Error('削除済みのプレイヤーは編集できません。');const now=Date.now(),profile=window.UserProfileModel.decode(current.profileCustomizationJson);return {playerName:name,profileCustomizationJson:JSON.stringify({...profile,nickname:name,updatedAt:Math.max(now,Number(profile.updatedAt||0)+1)})};});};
 remove.onclick=()=>{if(busy)return;const confirmation=element('div');confirmation.className='admin-player-confirm';confirmation.append(element('p',(data.playerName||id)+'（'+id+'）を完全削除します。学習記録・バックアップ・共有メモ・本人の公開教材も削除され、元に戻せません。'));
 const cancel=element('button','キャンセル');cancel.type='button';cancel.onclick=()=>confirmation.remove();const confirm=element('button','このプレイヤーを削除');confirm.type='button';confirm.onclick=()=>purge(id);confirmation.append(cancel,confirm);remove.after(confirmation);remove.disabled=true;cancel.onclick=()=>{confirmation.remove();remove.disabled=false;};};
 }catch(error){message(error.message);}finally{lock(false);}
}
async function mutate(id,patch){
 if(busy)return;lock(true);message('保存中…');
 let expected;
try{guard();await window.fbRunTransaction(window.db,async tx=>{guard();const ref=window.fbDoc(window.db,'users',id),snap=await tx.get(ref);if(!snap.exists())throw Error('プレイヤーが見つかりません。');const change=patch(snap.data());expected=change;tx.set(ref,change,{merge:true});});
 const check=await deadline((window.fbGetDocFromServer||window.fbGetDoc)(window.fbDoc(window.db,'users',id)));if(!check.exists()||Object.entries(expected).some(([key,value])=>JSON.stringify(check.data()[key])!==JSON.stringify(value)))throw Error('保存内容を確認できませんでした。一覧を更新してください。');
 if(id===myId){const data=check.data();if(!data.deleted){localStorage.setItem('core_v4_profile_customization_'+id,data.profileCustomizationJson);myName=data.playerName;localStorage.setItem('core_v4_userName',myName);window.applyProfileToUi();}}
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
// Each clean-up below runs even when one before it failed; a failed one is named, the account
// stays 'pending' and running the deletion again repeats what is left (every step is safe to
// repeat).
const failed=[];const step=async(name,task)=>{try{guard();await task();}catch(error){if(/管理者パスワード/.test(error.message))throw error;console.warn('[admin] purge',name,error);failed.push(name+'（'+error.message+'）');}};
try{guard();const now=Date.now();await window.fbRunTransaction(window.db,async tx=>{guard();const ref=window.fbDoc(window.db,'users',id),allRef=window.fbDoc(window.db,'shared','all_users'),all=await tx.get(allRef);tx.set(ref,{deleted:true,deletedAt:now,deletionState:'pending'});const current=all.exists()?all.data():{};tx.set(allRef,{users:(Array.isArray(current.users)?current.users:[]).filter(user=>user&&user.id!==id),deletedIds:[...new Set([...(current.deletedIds||[]),id])]},{merge:true});});
// Include orphaned parts from interrupted backups, not just parts with existing metadata.
await step('バックアップの断片',()=>scan(window.fbCollectionGroup(window.db,'parts'),async doc=>{if(doc.ref.path.startsWith('users/'+id+'/'))await window.fbDeleteDoc(doc.ref);},id));
// Groups, including former memberships: retained event owners are indexed without scanning
// unrelated groups. The player's chat lines are found group by group (a query across every
// group's messages needs an index the project does not have).
await step('グループ',async()=>{let groupQuery=window.fbCollection(window.db,'studyGroups');if(window.fbWhere&&window.fbQuery)groupQuery=window.fbQuery(groupQuery,window.fbWhere('retainedMemberIds','array-contains',id));
await scan(groupQuery,async doc=>{let lines=window.fbCollection(window.db,'studyGroups',doc.id,'messages');if(window.fbWhere&&window.fbQuery)lines=window.fbQuery(lines,window.fbWhere('ownerId','==',id));await scan(lines,async line=>{if(line.data().ownerId===id)await window.fbDeleteDoc(line.ref);});
const data=doc.data();if(!data.members?.[id]&&!(data.events||[]).some(event=>event.owner===id||event.reactions?.[id]))return;await window.fbRunTransaction(window.db,async tx=>{const snap=await tx.get(doc.ref);if(!snap.exists())return;const g=snap.data();delete g.members?.[id];delete g.baseline?.[id];delete g.progress?.[id];if(g.goal?.baseline)delete g.goal.baseline[id];g.events=(g.events||[]).filter(event=>event.owner!==id).map(event=>{delete event.reactions?.[id];return event;});if(g.owner===id)g.owner=Object.keys(g.members||{})[0]||'';g.retainedMemberIds=[...new Set([...Object.keys(g.members||{}),...g.events.map(event=>event.owner).filter(Boolean)])];if(!Object.keys(g.members||{}).length)tx.delete(doc.ref);else tx.set(doc.ref,g);});});});
for(const collection of ['vocabProgress','vocabBooks','saves','saveEntries','library','sync','libraryDeletions','studyGroups','learningPoints','reviewPointDays'])await step('記録（'+collection+'）',()=>scan(window.fbCollection(window.db,'users',id,collection),doc=>window.fbDeleteDoc(doc.ref)));
await step('共有メモ',()=>scan(window.fbCollectionGroup(window.db,'notes'),async doc=>{if(/^publicVocabNotes\/[^/]+\/notes\/[^/]+$/.test(doc.ref.path)&&(doc.data().ownerId===id||doc.id===id))await (window.SharedNoteIndex?window.SharedNoteIndex.remove(doc.ref,doc.data().ownerId||doc.id):window.fbDeleteDoc(doc.ref));}));
for(const collection of ['publicTextbooks','publicWorkbooks'])await step('公開教材',async()=>{let ref=window.fbCollection(window.db,collection);if(window.fbWhere&&window.fbQuery)ref=window.fbQuery(ref,window.fbWhere('ownerId','==',id));await scan(ref,async doc=>{if(doc.data().ownerId===id)await window.fbDeleteDoc(doc.ref);});});
await step('公開ワーク',()=>window.fbRunTransaction(window.db,async tx=>{const ref=window.fbDoc(window.db,'public_works','all'),snap=await tx.get(ref);if(!snap.exists()||!snap.data().worksJson)return;const works=JSON.parse(snap.data().worksJson);if(!Array.isArray(works))throw Error('従来の公開ワークを確認できません。');const kept=works.filter(work=>work?.sharedBy!==id);if(kept.length!==works.length)tx.set(ref,{worksJson:JSON.stringify(kept)},{merge:true});}));
// Remove the deleted player's answers/identity from retained match history.
await step('単語バトルの記録',()=>scan(window.fbCollection(window.db,'wordDuelRooms'),async doc=>{if(!doc.data().players?.[id])return;await window.fbRunTransaction(window.db,async tx=>{const snap=await tx.get(doc.ref);if(!snap.exists()||!snap.data().players?.[id])return;const room=snap.data();room.players[id]={name:'削除済み',answers:[],done:true,abandoned:true};if(room.result)for(const [field,value]of [['ratings',1500],['scores',0],['deltas',0]])if(room.result[field]&&typeof room.result[field]==='object'&&!Array.isArray(room.result[field]))room.result[field][id]=value;tx.set(doc.ref,room);});}));
// Talks and lending: the player's own list goes; in each pair kept for the other side their
// lines go, their notes are cleared and their name becomes 削除済み (the money history stays).
await step('トーク・貸し借り',async()=>{await window.fbDeleteDoc(window.fbDoc(window.db,'pointLoanInbox',id));let pairs=window.fbCollection(window.db,'pointLoans');if(window.fbWhere&&window.fbQuery)pairs=window.fbQuery(pairs,window.fbWhere('people','array-contains',id));
 await scan(pairs,async doc=>{if(!(doc.data().people||[]).includes(id))return;await window.fbRunTransaction(window.db,async tx=>{const snap=await tx.get(doc.ref);if(!snap.exists())return;const r=snap.data();r.entries=(r.entries||[]).filter(e=>!(e.kind==='message'&&e.from===id)).map(e=>e.from===id||e.to===id?{...e,note:''}:e);r.names={...(r.names||{}),[id]:'削除済み'};tx.set(doc.ref,r);});});});
// すごろくビンゴ's shared card and the casino's jackpot winners: the player's balls, part, name
// and lines go.
for(const doc of ['sugoroku_live2','sugoroku_live'])await step('すごろくビンゴ',()=>window.fbRunTransaction(window.db,async tx=>{const ref=window.fbDoc(window.db,'shared',doc),snap=await tx.get(ref);if(!snap.exists())return;const c=snap.data();if(Array.isArray(c.owners))c.owners=c.owners.map(o=>o===id?'':o);for(const key of ['people','owed','owedAt'])if(c[key]&&typeof c[key]==='object')delete c[key][id];if(Array.isArray(c.log))c.log=c.log.filter(e=>e?.id!==id);tx.set(ref,c);}));
await step('ジャックポット',()=>window.fbRunTransaction(window.db,async tx=>{const ref=window.fbDoc(window.db,'shared','casino_jackpot'),snap=await tx.get(ref);if(!snap.exists()||!Array.isArray(snap.data().wins))return;tx.set(ref,{wins:snap.data().wins.map(w=>w?.id===id?{...w,id:'',n:'削除済み'}:w)},{merge:true});}));
if(failed.length)throw Error('次の片付けができませんでした：'+failed.join('、'));
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
 const prefixes=['core_v4_group_chat_draft_','core_v4_groups_','core_v4_group_synced_','core_v4_flash_queue_','core_v4_flash_cursor_','core_v4_meaning_history_','aiglish_app_background_','aiglish_app_background_catalog_','aiglish_learning_recovery_','aiglish_study_lease_','aiglish_study_ledger_','core_v4_autosave_pending_','core_v4_custom_words_','core_v4_learning_ranking_','core_v4_learning_ranking_v2_','core_v4_library_deletions_','core_v4_personal_library_','core_v4_profile_customization_','core_v4_profile_shop_owned_','core_v4_ranking_swipes_v2_','core_v4_sync_settings_ts_','core_v4_user_avatar_','core_v4_user_stats_','core_v4_user_vocab_book_','core_v4_user_vocab_progress_','core_v4_vocab_draft_','core_v4_vocab_note_sharing_','core_v4_word_duel_pending_','core_v4_study_points_','core_v4_word_duel_rating_','save_studio_'];
const keys=Array.from({length:localStorage.length},(_,index)=>localStorage.key(index)).filter(Boolean);for(const key of keys)if(prefixes.some(prefix=>key===prefix+id||key.startsWith(prefix+id+'_')))localStorage.removeItem(key);
if(localStorage.getItem('core_v4_userId')===id){for(const key of ['core_v4_userName','core_v4_userTarget','core_v4_current_textbook_id','core_v4_friend_list','wordMemory','textHistory','myBookshelf','myFolders'])localStorage.removeItem(key);for(const key of keys)if(key.startsWith('core_v4_cache_'))localStorage.removeItem(key);}
}
async function canStart(id){
if(id==='GUEST-000')return true;
const key='core_v4_account_deleted_'+id;let blocked=localStorage.getItem(key)==='1';
if(window.db&&window.fbGetDoc){let timeout;try{const snap=await Promise.race([(window.fbGetDocFromServer||window.fbGetDoc)(window.fbDoc(window.db,'users',id)),new Promise((_,reject)=>timeout=setTimeout(()=>reject(Error('アカウント確認のタイムアウト')),4000))]);if(snap.exists()){blocked=!!snap.data().deleted;if(blocked)localStorage.setItem(key,'1');else localStorage.removeItem(key);}}catch(error){/* Retain local learning when disconnected; never infer deletion from a failed read. */}finally{clearTimeout(timeout);}}
if(!blocked)return true;
 const wasActive=window.__learningBootReady&&myId===id;await window.TextbookFiles?.remove(id);purgeLocal(id);
localStorage.removeItem('core_v4_userId');window.__learningBootReady=false;myId='GUEST-000';myName='ゲスト';window.__adminBookEditing=false;window.isAdmin=false;await window.AppStorage?.flush();if(wasActive){location.reload();return false;}const gate=document.getElementById('auth-gate-screen');if(gate)gate.style.display='flex';const error=document.getElementById('authErrorMsg');if(error){error.textContent='このアカウントは管理者により削除されています。';error.style.display='block';}return false;
}
window.AdminPlayers={canStart,open(){mount();if(dialog.open)return;window.toggleSidebar(false);busy=false;authorized=false;window.isAdmin=false;dialog.querySelector('[data-body]').innerHTML='<form data-auth><label>管理者パスワード<input type="password" name="password" autocomplete="current-password" autocapitalize="none" spellcheck="false" required></label><button type="submit">管理者ツールを開く</button></form>';message('');dialog.showModal();dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();const input=event.currentTarget.elements.password;if(!window.verifyAdminPassword(input.value.trim())){message('管理者パスワードが違います。');return;}input.value='';authorized=true;window.isAdmin=true;await refreshList();};}};
})();
