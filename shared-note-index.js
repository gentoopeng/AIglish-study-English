// Presence metadata contains no note text or avatars. Bodies stay in their existing paths.
(function(root){
'use strict';
const SHARDS=16,TTL=300000,REPAIR=86400000;
const owner=()=>typeof myId==='string'?myId:'GUEST-000';
let account='',cached=null,loadedAt=0,job=null,version=0;
const shard=topic=>/^[0-9a-f]/i.test(topic)?parseInt(topic[0],16):0;
const manifestRef=()=>root.fbDoc(root.db,'shared','vocab_note_presence_v1');
const ref=i=>root.fbDoc(root.db,'shared','vocab_note_presence_v1_'+i.toString(16));
function decode(doc){const entries=Object.create(null);let valid=true;try{const raw=JSON.parse(doc?.entriesJson||'{}');if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('index');for(const [topic,owners]of Object.entries(raw)){if(!owners||typeof owners!=='object'||Array.isArray(owners))throw Error('owners');entries[topic]=Object.create(null);for(const [id,stamp]of Object.entries(owners)){if(typeof stamp!=='number'||!Number.isFinite(stamp))throw Error('stamp');entries[topic][id]=stamp;}}}catch{valid=false;}return {entries,checkedAt:Number(doc?.checkedAt)||0,complete:valid&&doc?.complete===true};}
function current(){if(account!==owner()){account=owner();version++;cached=null;loadedAt=0;job=null;}}
function deadline(task){let timer;return Promise.race([task,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('共有メモの確認が完了しませんでした。')),15000))]).finally(()=>clearTimeout(timer));}
async function legacy(){
 const result=Array.from({length:SHARDS},()=>Object.create(null));let cursor;
 for(let page=0;page<100;page++){
  let docs;
  const project=root.db?.app?.options?.projectId;
  if(project){
   const query={from:[{collectionId:'notes',allDescendants:true}],select:{fields:['ownerId','updatedAt'].map(fieldPath=>({fieldPath}))},orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],limit:100};if(cursor)query.startAt={values:[{referenceValue:cursor}],before:false};
   const request=async()=>{const response=await deadline(fetch('https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(project)+'/databases/(default)/documents:runQuery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({structuredQuery:query})}));const data=await response.json();if(!response.ok||!Array.isArray(data)){const error=Error(data.error?.message||'既存メモを確認できません。');error.code=response.status===429?'resource-exhausted':data.error?.status;throw error;}return data;};
   const rows=await (root.FirestoreReadGuard?.wrap(request)||request)();docs=rows.filter(row=>row.document).map(({document:d})=>({path:d.name.split('/documents/')[1],name:d.name,data:{ownerId:d.fields?.ownerId?.stringValue,updatedAt:d.fields?.updatedAt?.stringValue}}));
  }else{
   if(!root.fbCollectionGroup||!root.fbQuery||!root.fbDocumentId||!root.fbOrderBy||!root.fbLimit)throw Error('共有メモの索引に接続できません。');
   const clauses=[root.fbOrderBy(root.fbDocumentId()),root.fbLimit(100)];if(cursor)clauses.push(root.fbStartAfter(cursor));const snap=await deadline(root.fbGetDocs(root.fbQuery(root.fbCollectionGroup(root.db,'notes'),...clauses)));docs=(snap.docs||[]).map(doc=>({path:doc.ref.path,name:doc,data:doc.data()}));
  }
  for(const doc of docs){const match=/^publicVocabNotes\/([^/]+)\/notes\/[^/]+$/.exec(doc.path||''),id=doc.data.ownerId;if(!match||typeof id!=='string')continue;const topic=match[1],bucket=result[shard(topic)];bucket[topic]??=Object.create(null);bucket[topic][id]=Math.max(1,Date.parse(doc.data.updatedAt||'')||1);}
  if(docs.length<100)return result;cursor=docs.at(-1).name;
 }
 throw Error('共有メモの確認が多いため、時間を置いて再試行してください。');
}
async function repair(){
 const started=Date.now(),found=await legacy();
 if(!root.fbRunTransaction)throw Error('共有メモの索引を保存できません。');
 return deadline(root.fbRunTransaction(root.db,async tx=>{
  const snapshots=await Promise.all(Array.from({length:SHARDS},(_,i)=>tx.get(ref(i))));
  const result=snapshots.map((snap,i)=>{
   const previous=decode(snap.exists()?snap.data():{}),entries=previous.entries;
   for(const [topic,owners]of Object.entries(entries))for(const [id,stamp]of Object.entries(owners)){
    if(Math.abs(stamp)>started)continue;
    const seen=found[i][topic]?.[id];if(seen){if(seen>Math.abs(stamp))owners[id]=seen;}else if(stamp>0)owners[id]=-started;
   }
   for(const [topic,owners]of Object.entries(found[i])){entries[topic]??=Object.create(null);for(const [id,stamp]of Object.entries(owners))if(!(id in entries[topic])||(Math.abs(entries[topic][id])<=started&&stamp>Math.abs(entries[topic][id])))entries[topic][id]=stamp;}
   const value={entries,checkedAt:started,complete:true};tx.set(ref(i),{entriesJson:JSON.stringify(entries),checkedAt:started,complete:true},{merge:true});return value;
  });const activeShards=result.flatMap((value,i)=>Object.keys(value.entries).length?[i]:[]);tx.set(manifestRef(),{activeShards,complete:true,checkedAt:started},{merge:true});return result;
 }));
}
async function load(force=false){
 current();if(!force&&cached&&Date.now()-loadedAt<TTL)return cached;if(job)return job;
 if(!root.db||!root.fbGetDoc||!root.fbDoc)throw Error('共有メモに接続できません。');
 const user=account,generation=version;
 const task=(async()=>{const snap=await deadline(root.fbGetDoc(manifestRef())),manifest=snap.exists()?snap.data():{};
  const active=manifest.activeShards,valid=manifest.complete===true&&Number.isFinite(Number(manifest.checkedAt))&&Number(manifest.checkedAt)>0&&Array.isArray(active)&&active.every(i=>Number.isInteger(i)&&i>=0&&i<SHARDS);
  let result;
  if(!valid||Date.now()-Number(manifest.checkedAt||0)>=REPAIR)result=await repair();
  else{result=Array.from({length:SHARDS},()=>decode({entriesJson:'{}',complete:true,checkedAt:manifest.checkedAt}));const needed=[...new Set(active)];let next=0;await Promise.all(Array.from({length:Math.min(4,needed.length)},async()=>{while(next<needed.length){const i=needed[next++],snap=await deadline(root.fbGetDoc(ref(i)));result[i]=decode(snap.exists()?snap.data():{});}}));if(result.some(value=>!value.complete))result=await repair();}
  if(user!==owner()||generation!==version)throw Error('共有メモの確認中に状態が変わりました。開き直してください。');cached=result;loadedAt=Date.now();return result;
 })();job=task;try{return await task;}finally{if(job===task)job=null;}
}
async function owners(topic){const values=await load();return Object.entries(values[shard(topic)].entries[topic]||{}).filter(([,stamp])=>stamp>0).map(([id])=>id);}
async function publish(topic,id,note,reference){
 current();if(!root.fbRunTransaction)throw Error('共有メモの保存に接続できません。');const user=account;
 const result=await deadline(root.fbRunTransaction(root.db,async tx=>{
  const indexRef=ref(shard(topic)),snap=await tx.get(indexRef),value=decode(snap.exists()?snap.data():{}),entries=value.entries;entries[topic]??=Object.create(null);const stamp=Math.max(Date.now()+1,Math.abs(entries[topic][id]||0)+1);entries[topic][id]=note?stamp:-stamp;
  let registry=null;if(!cached||!Object.keys(cached[shard(topic)].entries).length){const snap=await tx.get(manifestRef());registry=snap.exists()?snap.data():{};}
  const noteRef=reference||root.fbDoc(root.db,'publicVocabNotes',topic,'notes',encodeURIComponent(id));if(note)tx.set(noteRef,{ownerId:id,note,updatedAt:new Date(stamp).toISOString()},{merge:false});else tx.delete(noteRef);
  tx.set(indexRef,{entriesJson:JSON.stringify(entries),complete:value.complete,checkedAt:value.checkedAt},{merge:true});if(registry){const active=new Set((Array.isArray(registry.activeShards)?registry.activeShards:[]).filter(i=>Number.isInteger(i)&&i>=0&&i<SHARDS));active.add(shard(topic));tx.set(manifestRef(),{activeShards:[...active].sort((a,b)=>a-b),complete:registry.complete===true,checkedAt:Number(registry.checkedAt)||0},{merge:true});}return value;
 }));
 if(user===owner()){version++;if(cached)cached[shard(topic)]=result;}return result;
}
root.SharedNoteIndex={load,owners,publish,remove:(reference,id)=>{const match=/^publicVocabNotes\/([^/]+)\/notes\/([^/]+)$/.exec(reference.path||'');if(!match)throw Error('共有メモの保存先が不正です。');return publish(match[1],id||decodeURIComponent(match[2]),'',reference);},invalidate:()=>{version++;cached=null;loadedAt=0;job=null;}};
})(window);
