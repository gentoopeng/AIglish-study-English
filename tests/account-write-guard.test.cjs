const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){
 const docs=new Map(),trace=[];
 const window={db:{},isAdmin:false,fbDoc:(_, ...parts)=>({path:parts.join('/')})};
 window.fbRunTransaction=async(db,callback)=>{let written=false;const updates=[];const result=await callback({get:async ref=>{assert.equal(written,false,'all reads precede writes');trace.push(['get',ref.path]);const value=docs.get(ref.path);return {exists:()=>value!==undefined,data:()=>value};},set:(ref,data,options)=>{written=true;updates.push([ref.path,data,options]);},delete:ref=>updates.push([ref.path,null])});for(const [path,data,options]of updates){trace.push(['write',path]);if(data===null)docs.delete(path);else docs.set(path,options?.merge?{...docs.get(path),...data}:data);}return result;};
 window.fbSetDoc=async(ref,data)=>docs.set(ref.path,data);
 vm.runInNewContext(fs.readFileSync(require.resolve('../account-write-guard.js'),'utf8'),{window,myId:'self'});
 return {window,docs,trace,ref:path=>({path})};
}
test('deleted accounts reject profile, chunk, progress and shared-note writes without partial commits',async()=>{
 const {window,docs,ref}=setup();docs.set('users/erased',{deleted:true});
 for(const path of ['users/erased','users/erased/saves/slot/parts/p0','users/erased/vocabProgress/book','publicVocabNotes/topic/notes/erased'])await assert.rejects(window.fbSetDoc(ref(path),{old:'snapshot'}),/削除済み/);
 assert.equal(docs.size,1);await assert.rejects(window.fbRunTransaction(window.db,async tx=>{tx.set(ref('users/other'),{new:'data'});tx.set(ref('users/erased/vocabProgress/book'),{old:'snapshot'});}),/削除済み/);assert.equal(docs.has('users/other'),false);
});
test('guard reuses account reads, preserves transaction results and queues every write after reads',async()=>{
 const {window,docs,ref,trace}=setup();docs.set('users/self',{name:'self'});
 const result=await window.fbRunTransaction(window.db,async tx=>{await tx.get(ref('users/self'));tx.set(ref('users/self/vocabProgress/book'),{status:'ok'});tx.set(ref('users/self/saves/slot'),{saved:true});return 'committed';});
 assert.equal(result,'committed');assert.equal(trace.filter(([kind,path])=>kind==='get'&&path==='users/self').length,1);assert.equal(docs.get('users/self/vocabProgress/book').status,'ok');
});
test('administrator can complete a tombstone, but cannot republish erased learning fields',async()=>{
 const {window,docs,ref}=setup();docs.set('users/self',{deleted:true,deletionState:'pending'});window.isAdmin=true;
 await window.fbSetDoc(ref('users/self'),{deleted:true,deletionState:'complete'});assert.equal(docs.get('users/self').deletionState,'complete');
 await assert.rejects(window.fbSetDoc(ref('users/self'),{deleted:true,learning:'old'}),/削除済み/);
});
test('stale all_users replacements cannot restore erased users or remove deletion IDs',async()=>{
 const {window,docs,ref}=setup();docs.set('shared/all_users',{users:[],deletedIds:['erased']});
 await window.fbSetDoc(ref('shared/all_users'),{users:[{id:'erased'},{id:'other'}]});assert.deepEqual(Array.from(docs.get('shared/all_users').deletedIds),['erased']);assert.equal(docs.get('shared/all_users').users.length,1);assert.equal(docs.get('shared/all_users').users[0].id,'other');
});
test('deleted players cannot republish match answers while other participants can save',async()=>{
 const {window,docs,ref}=setup();docs.set('users/self',{deleted:true});
 await assert.rejects(window.fbSetDoc(ref('wordDuelRooms/123456'),{players:{self:{answers:[{choice:1}]}}}),/削除済み/);
 await window.fbSetDoc(ref('wordDuelRooms/123456'),{players:{other:{answers:[]}}});assert.ok(docs.has('wordDuelRooms/123456'));
});
test('room updates check changed participants only, including a previous login captured by a pending save',async()=>{
 const {window,docs,ref,trace}=setup();docs.set('users/self',{});docs.set('users/other',{});docs.set('users/erased',{deleted:true});
 docs.set('wordDuelRooms/123456',{players:{self:{answers:[]},other:{answers:[]},erased:{name:'削除済み',answers:[]}}});
 await window.fbRunTransaction(window.db,async tx=>{const room=(await tx.get(ref('wordDuelRooms/123456'))).data();tx.set(ref('wordDuelRooms/123456'),{players:{...room.players,self:{answers:[{choice:1}]}}});});
 assert.equal(trace.filter(([kind,path])=>kind==='get'&&path==='users/self').length,1);assert.equal(trace.filter(([kind,path])=>kind==='get'&&path==='users/other').length,0);assert.equal(trace.filter(([kind,path])=>kind==='get'&&path==='users/erased').length,0);
 await assert.rejects(window.fbSetDoc(ref('wordDuelRooms/123456'),{players:{erased:{name:'旧アカウント',answers:[{choice:1}]}}}),/削除済み/);
});
test('old statistics snapshots cannot undo an administrator nickname edit',async()=>{
 const {window,docs,ref}=setup(),source=fs.readFileSync(require.resolve('../profile.js'),'utf8');vm.runInNewContext(source.split('const owner=')[0]+'})();',{window});
 docs.set('users/self',{profileCustomizationJson:JSON.stringify({nickname:'管理者の編集',updatedAt:10})});
 await window.fbSetDoc(ref('users/self'),{playerName:'古い端末の名前'},{merge:true});assert.equal(docs.get('users/self').playerName,'管理者の編集');
 await window.fbSetDoc(ref('users/self'),{playerName:'新しい本人の編集',profileCustomizationJson:JSON.stringify({nickname:'新しい本人の編集',updatedAt:20})},{merge:true});assert.equal(docs.get('users/self').playerName,'新しい本人の編集');
});
test('protected setDoc retains existing Firestore sanitization',async()=>{
 const {window,docs,ref}=setup();window.__sanitizeForFirestore=value=>({safe:value.unsafe});
 await window.fbSetDoc(ref('users/self'),{unsafe:42});assert.equal(docs.get('users/self').safe,42);assert.equal(docs.get('users/self').unsafe,undefined);
});
test('unified verifier accepts the existing administrator passwords and rejects unrelated input',()=>{
 const source=fs.readFileSync(require.resolve('../app.js'),'utf8'),line=source.split('\n').find(line=>line.startsWith('window.verifyAdminPassword ='));
 const window={};vm.runInNewContext(line,{window});const accepted=[...line.matchAll(/(['"])(.*?)\1/g)].map(match=>match[2]);assert.equal(accepted.length,2);for(const value of accepted)assert.equal(window.verifyAdminPassword(value),true);assert.equal(window.verifyAdminPassword('not-the-admin-password'),false);assert.equal(window.verifyAdminPassword(''),false);
});
test('generation parts share one account read per four writes without dropping any part',async()=>{
 const {window,docs,ref,trace}=setup();docs.set('users/self',{});
 const entries=Array.from({length:12},(_,i)=>[ref('users/self/saves/slot/parts/g_p'+i),{d:'part '+i},{merge:false}]);
 await window.fbSetDocsProtected(entries);
 assert.equal(trace.filter(([kind,path])=>kind==='get'&&path==='users/self').length,3);
 for(let i=0;i<12;i++)assert.equal(docs.get(entries[i][0].path).d,'part '+i);
});
test('deletion between part groups rejects remaining parts and never publishes metadata',async()=>{
 const {window,docs,ref}=setup();docs.set('users/self',{});const transaction=window.fbRunTransaction;let groups=0;
 window.fbRunTransaction=async(...args)=>{const result=await transaction(...args);if(++groups===1)docs.set('users/self',{deleted:true});return result;};
 const entries=Array.from({length:8},(_,i)=>[ref('users/self/saves/slot/parts/g_p'+i),{d:'part '+i}]);entries.push([ref('users/self/saves/slot'),{generation:'g'}]);
 await assert.rejects(window.fbSetDocsProtected(entries),/削除済み/);
 assert.equal(docs.has('users/self/saves/slot/parts/g_p3'),true);assert.equal(docs.has('users/self/saves/slot/parts/g_p4'),false);assert.equal(docs.has('users/self/saves/slot'),false);
});
