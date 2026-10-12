// Check account tombstones in the same transaction as every personal cloud write.
(function(){
'use strict';
const wrapped=new WeakSet();
function install(){
 if(!window.fbRunTransaction||!window.fbSetDoc||wrapped.has(window.fbRunTransaction))return;
 const transaction=window.fbRunTransaction,set=window.fbSetDoc;
 function root(ref){const path=ref.path||'',match=/^users\/([^/]+)(?:\/|$)/.exec(path)||/^publicVocabNotes\/[^/]+\/notes\/([^/]+)$/.exec(path);return match&&match[1];}
 async function guarded(db,callback,...options){return transaction(db,async tx=>{
  const reads=new Map(),writes=[];
  const proxy={get:async ref=>{const snap=await tx.get(ref);reads.set(ref.path,snap);return snap;},set:(...args)=>{writes.push(['set',args]);return proxy;},update:(...args)=>{writes.push(['update',args]);return proxy;},delete:(...args)=>{writes.push(['delete',args]);return proxy;}};
  const result=await callback(proxy);
  for(const [operation,args] of writes){if(operation==='delete')continue;const [ref,payload]=args,owner=root(ref);let ids=owner?[owner]:[];if(!owner&&/^public(?:Textbooks|Workbooks)\//.test(ref.path||'')&&typeof payload.ownerId==='string')ids=[payload.ownerId];
  if(!owner&&(ref.path||'').startsWith('wordDuelRooms/')&&payload.players){let snap=reads.get(ref.path);if(!snap){snap=await tx.get(ref);reads.set(ref.path,snap);}const previous=snap.exists()?snap.data().players||{}:{};ids=Object.keys(payload.players).filter(id=>JSON.stringify(payload.players[id])!==JSON.stringify(previous[id]));}
  for(const id of ids){const path='users/'+id;let snap=reads.get(path);if(!snap){snap=await tx.get(window.fbDoc(db,'users',id));reads.set(path,snap);}
   const deletion=window.isAdmin===true&&((ref.path===path&&payload.deleted===true&&Object.keys(payload).every(key=>['deleted','deletedAt','deletionState'].includes(key)))||((ref.path||'').startsWith('wordDuelRooms/')&&payload.players?.[id]?.name==='削除済み'&&payload.players[id].answers.length===0&&payload.players[id].abandoned===true));
   if(snap.exists()&&snap.data().deleted&&!deletion)throw Error('削除済みアカウントへの保存を停止しました。');
   if(ref.path===path&&typeof payload.playerName==='string'&&window.UserProfileModel){const profile=window.UserProfileModel.merge(snap.exists()?snap.data().profileCustomizationJson:null,payload.profileCustomizationJson);if(typeof profile.nickname==='string')args[1]={...payload,playerName:profile.nickname};}
   }
  }
  for(const [operation,args]of writes){
   if(operation==='set'&&args[0].path==='shared/all_users'&&Array.isArray(args[1].users)){
    let snap=reads.get(args[0].path);if(!snap){snap=await tx.get(args[0]);reads.set(args[0].path,snap);}
    const deleted=new Set([...(snap.exists()?snap.data().deletedIds||[]:[]),...(args[1].deletedIds||[])]);args[1]={...args[1],deletedIds:[...deleted],users:args[1].users.filter(user=>!deleted.has(user.id))};
   }
  }
  for(const [operation,args]of writes)tx[operation](...args);
  return result;
 },...options);}
 window.fbRunTransaction=guarded;wrapped.add(guarded);
 window.fbSetDoc=function(ref,payload,options){if(root(ref)||ref.path==='shared/all_users'||/^public(?:Textbooks|Workbooks)\//.test(ref.path||'')||(ref.path||'').startsWith('wordDuelRooms/'))return guarded(window.db,tx=>tx.set(ref,window.__sanitizeForFirestore?window.__sanitizeForFirestore(payload):payload,options));return set(ref,payload,options);};
}
window.AccountWriteGuard={install};install();window.onAppLoaded?.(install);
})();
