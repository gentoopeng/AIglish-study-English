const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){let now=Date.parse('2026-10-13T00:00:00Z');const docs=new Map(),reads=[],queries=[],ctx={myId:'self',console,Date:class extends Date{static now(){return now;}},setTimeout,clearTimeout,db:{},fbDoc:(_, ...parts)=>({path:parts.join('/')}),fbCollectionGroup:()=>'',fbQuery:()=>'',fbDocumentId:()=>'',fbOrderBy:()=>'',fbLimit:()=>'',fbStartAfter:()=>''};ctx.window=ctx;
 ctx.fbGetDoc=async ref=>{reads.push(ref.path);return snapshot(ref.path);};function snapshot(path){return {exists:()=>docs.has(path),data:()=>docs.get(path)};}
 ctx.fbGetDocs=async()=>{queries.push('legacy');return {docs:[...docs].filter(([path])=>path.startsWith('publicVocabNotes/')).map(([path,data])=>({ref:{path},data:()=>data}))};};
 ctx.fbRunTransaction=async(_,fn)=>{const writes=[];const result=await fn({get:async ref=>snapshot(ref.path),set:(ref,data)=>writes.push([ref.path,data]),delete:ref=>writes.push([ref.path,null])});for(const [path,data]of writes)if(data===null)docs.delete(path);else docs.set(path,data);return result;};
 vm.runInNewContext(fs.readFileSync('shared-note-index.js','utf8'),ctx);return {ctx,docs,reads,queries,advance:ms=>now+=ms};
}
test('legacy notes migrate once into text-free presence; repeat checks query no bodies',async()=>{
 const {ctx,docs,reads,queries}=setup();docs.set('publicVocabNotes/a123/notes/other',{ownerId:'other',note:'過去のメモ',updatedAt:'2026-10-12'});
 assert.deepEqual(Array.from(await ctx.SharedNoteIndex.owners('a123')),['other']);assert.equal(queries.length,1);assert.equal(reads.length,1);await ctx.SharedNoteIndex.owners('a123');await ctx.SharedNoteIndex.owners('b123');assert.equal(reads.length,1);assert.equal(queries.length,1);
 for(const [path,data]of docs)if(path.startsWith('shared/'))assert.equal(JSON.stringify(data).includes('過去のメモ'),false);
 assert.equal(docs.get('publicVocabNotes/a123/notes/other').note,'過去のメモ');
});
test('fifteen-minute checks read metadata only; daily repair discovers older-client edits',async()=>{
 const {ctx,docs,reads,queries,advance}=setup();await ctx.SharedNoteIndex.load();advance(300001);await ctx.SharedNoteIndex.load();assert.equal(reads.length,1);advance(600001);await ctx.SharedNoteIndex.load();assert.equal(reads.length,2);assert.equal(queries.length,1);
 docs.set('publicVocabNotes/a123/notes/old-client',{ownerId:'old-client',note:'追加',updatedAt:'2026-10-13'});advance(86400001);assert.deepEqual(Array.from(await ctx.SharedNoteIndex.owners('a123')),['old-client']);assert.equal(queries.length,2);
 docs.delete('publicVocabNotes/a123/notes/old-client');advance(86400001);assert.deepEqual(Array.from(await ctx.SharedNoteIndex.owners('a123')),[]);
});
test('sharing, unsharing and administrator deletion update note and presence atomically',async()=>{
 const {ctx,docs}=setup();await ctx.SharedNoteIndex.load();await ctx.SharedNoteIndex.publish('a123','self','共有する');await ctx.SharedNoteIndex.publish('a123','other','他のメモ');assert.deepEqual(Array.from(await ctx.SharedNoteIndex.owners('a123')).sort(),['other','self']);
 await ctx.SharedNoteIndex.publish('a123','self','');assert.equal(docs.has('publicVocabNotes/a123/notes/self'),false);assert.deepEqual(Array.from(await ctx.SharedNoteIndex.owners('a123')),['other']);
 await ctx.SharedNoteIndex.remove({path:'publicVocabNotes/a123/notes/other'});assert.deepEqual(Array.from(await ctx.SharedNoteIndex.owners('a123')),[]);
});
test('failed publication leaves both cloud note and presence unchanged',async()=>{
 const {ctx,docs}=setup();await ctx.SharedNoteIndex.load();const original=ctx.fbRunTransaction;ctx.fbRunTransaction=async()=>{throw Error('quota');};await assert.rejects(ctx.SharedNoteIndex.publish('a123','self','未送信'),/quota/);assert.equal(docs.has('publicVocabNotes/a123/notes/self'),false);assert.deepEqual(Array.from(await ctx.SharedNoteIndex.owners('a123')),[]);ctx.fbRunTransaction=original;await ctx.SharedNoteIndex.publish('a123','self','再送');assert.deepEqual(Array.from(await ctx.SharedNoteIndex.owners('a123')),['self']);
});
test('migration merges an edit committed after its scan without restoring a removed memo',async()=>{
 const {ctx,docs}=setup();docs.set('publicVocabNotes/a123/notes/self',{ownerId:'self',note:'古い共有',updatedAt:'2026-10-12'});const read=ctx.fbGetDocs;ctx.fbGetDocs=async()=>{const snapshot=await read();await ctx.SharedNoteIndex.publish('a123','self','');return snapshot;};await assert.rejects(ctx.SharedNoteIndex.load(),/状態が変わり/);ctx.fbGetDocs=read;assert.deepEqual(Array.from(await ctx.SharedNoteIndex.owners('a123')),[]);assert.equal(docs.has('publicVocabNotes/a123/notes/self'),false);
});
test('production legacy query requests metadata only and never selects memo bodies',async()=>{
 const {ctx}=setup();ctx.db.app={options:{projectId:'test-project'}};let query;ctx.fetch=async(url,options)=>{query=JSON.parse(options.body).structuredQuery;return {ok:true,json:async()=>[{document:{name:'projects/test-project/databases/(default)/documents/publicVocabNotes/a123/notes/other',fields:{ownerId:{stringValue:'other'},updatedAt:{stringValue:'2026-10-12'}}}}]};};assert.deepEqual(Array.from(await ctx.SharedNoteIndex.owners('a123')),['other']);assert.deepEqual(query.select.fields.map(field=>field.fieldPath),['ownerId','updatedAt']);
});
test('account deletion guard blocks both note and presence publication in the same transaction',async()=>{
 const {ctx,docs}=setup();docs.set('users/self',{deleted:true});ctx.fbSetDoc=async(ref,data)=>docs.set(ref.path,data);vm.runInNewContext(fs.readFileSync('account-write-guard.js','utf8'),ctx);
 await assert.rejects(ctx.SharedNoteIndex.publish('a123','self','復活させない'),/削除済み/);assert.equal(docs.has('publicVocabNotes/a123/notes/self'),false);assert.equal(docs.has('shared/vocab_note_presence_v1_a'),false);
});
test('administrator removal uses the legacy document path and its real author identity',async()=>{
 const {ctx,docs}=setup();docs.set('publicVocabNotes/a123/notes/legacy-random-id',{ownerId:'other',note:'既存メモ',updatedAt:'2026-10-12'});await ctx.SharedNoteIndex.load();await ctx.SharedNoteIndex.remove({path:'publicVocabNotes/a123/notes/legacy-random-id'},'other');assert.equal(docs.has('publicVocabNotes/a123/notes/legacy-random-id'),false);assert.deepEqual(Array.from(await ctx.SharedNoteIndex.owners('a123')),[]);
});
test('a malformed presence document is rebuilt without touching legacy note contents',async()=>{
 const {ctx,docs}=setup();for(let i=0;i<16;i++)docs.set('shared/vocab_note_presence_v1_'+i.toString(16),{complete:true,checkedAt:Date.parse('2026-10-13'),entriesJson:'{}'});docs.set('shared/vocab_note_presence_v1',{complete:true,checkedAt:Date.parse('2026-10-13'),activeShards:[10]});docs.get('shared/vocab_note_presence_v1_a').entriesJson='[]';docs.set('publicVocabNotes/a123/notes/other',{ownerId:'other',note:'残す',updatedAt:'2026-10-12'});assert.deepEqual(Array.from(await ctx.SharedNoteIndex.owners('a123')),['other']);assert.equal(docs.get('publicVocabNotes/a123/notes/other').note,'残す');
});
test('a cold presence check reads only its manifest and occupied shards, without legacy queries',async()=>{
 const {ctx,docs,reads,queries}=setup();docs.set('shared/vocab_note_presence_v1',{complete:true,checkedAt:Date.parse('2026-10-13'),activeShards:[10]});docs.set('shared/vocab_note_presence_v1_a',{complete:true,checkedAt:Date.parse('2026-10-13'),entriesJson:JSON.stringify({a123:{other:1}})});assert.deepEqual(Array.from(await ctx.SharedNoteIndex.owners('a123')),['other']);assert.equal(reads.length,2);assert.equal(queries.length,0);assert.equal(reads.some(path=>path.endsWith('_0')),false);
});
test('migration preserves a new memo shared after the legacy snapshot was taken',async()=>{
 const {ctx,docs}=setup(),read=ctx.fbGetDocs;ctx.fbGetDocs=async()=>{const snapshot=await read();await ctx.SharedNoteIndex.publish('a123','self','新規共有');return snapshot;};await assert.rejects(ctx.SharedNoteIndex.load(),/状態が変わり/);ctx.fbGetDocs=read;assert.deepEqual(Array.from(await ctx.SharedNoteIndex.owners('a123')),['self']);assert.equal(docs.get('publicVocabNotes/a123/notes/self').note,'新規共有');
});
test('legacy REST metadata paging advances the document-name cursor',async()=>{
 const {ctx}=setup();ctx.db.app={options:{projectId:'test-project'}};const requests=[];ctx.fetch=async(_,options)=>{requests.push(JSON.parse(options.body).structuredQuery);return {ok:true,json:async()=>requests.length===1?Array.from({length:100},(_,i)=>({document:{name:'projects/test-project/databases/(default)/documents/publicVocabNotes/a'+i+'/notes/other',fields:{ownerId:{stringValue:'other'},updatedAt:{stringValue:'2026-10-12'}}}})):[]};};await ctx.SharedNoteIndex.load();assert.equal(requests.length,2);assert.equal(requests[1].startAt.values[0].referenceValue,'projects/test-project/databases/(default)/documents/publicVocabNotes/a99/notes/other');assert.deepEqual(Array.from(await ctx.SharedNoteIndex.owners('a99')),['other']);
});
test('a stale legacy header with a future timestamp cannot undo a concurrent removal',async()=>{
 const {ctx,docs}=setup();docs.set('publicVocabNotes/a123/notes/self',{ownerId:'self',note:'旧端末の時刻',updatedAt:'2036-10-12'});const read=ctx.fbGetDocs;ctx.fbGetDocs=async()=>{const snapshot=await read();await ctx.SharedNoteIndex.publish('a123','self','');return snapshot;};await assert.rejects(ctx.SharedNoteIndex.load(),/状態が変わり/);ctx.fbGetDocs=read;assert.deepEqual(Array.from(await ctx.SharedNoteIndex.owners('a123')),[]);assert.equal(docs.has('publicVocabNotes/a123/notes/self'),false);
});
