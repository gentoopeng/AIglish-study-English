const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const model=require('../word-duel-model.js'),source=fs.readFileSync(require.resolve('../word-duel-solo.js'),'utf8');
function setup(storage=new Map(),docs=new Map([['users/a',{understanding:'preserved'}],['users/b',{understanding:'also preserved'}]])){
 const ctx={WordDuelModel:model,myId:'a',console:{warn(){}},Date,db:{},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},addEventListener(){},document:{addEventListener(){}},onAppLoaded(){},fbDoc:(_, ...parts)=>parts.join('/')};
 ctx.window=ctx;ctx.writes=0;ctx.fbRunTransaction=async(_,fn)=>fn({get:async path=>({exists:()=>docs.has(path),data:()=>docs.get(path)}),set:(path,value)=>{ctx.writes++;docs.set(path,{...docs.get(path),...value});}});
 vm.runInNewContext(source,ctx);return {ctx,storage,docs,api:ctx.WordDuelSolo};
}
test('completed personal bests survive restart and lower scores do not overwrite or write again',async()=>{
 const {ctx,storage,docs,api}=setup();assert.equal(api.best(),null);assert.equal(api.record(380,'book').improved,true);assert.equal(api.best(),380);await api.sync();assert.equal(docs.get('users/a').wordDuelSoloBest,380);assert.equal(docs.get('users/a').understanding,'preserved');assert.equal(ctx.writes,1);
 assert.equal(api.record(50,'book').improved,false);await api.sync();assert.equal(ctx.writes,1);assert.equal(setup(storage,docs).api.best(),380);
});
test('offline best retains a retry journal across restart and merges a greater cloud score',async()=>{
 const first=setup();first.ctx.fbRunTransaction=async()=>{throw Error('offline');};first.api.record(500,'book');assert.equal(await first.api.sync(),false);assert.equal(first.api.read().pending,true);
 first.docs.get('users/a').wordDuelSoloBest=900;const next=setup(first.storage,first.docs);assert.equal(next.api.best(),500);assert.equal(await next.api.sync(),true);assert.equal(next.api.best(),900);assert.equal(next.api.read().pending,false);assert.equal(next.ctx.writes,0);
});
test('account changes during upload cannot replace another account’s best or learning data',async()=>{
 const {ctx,api,docs}=setup();api.record(600,'book');const transaction=ctx.fbRunTransaction;let release;ctx.fbRunTransaction=async(...args)=>{await new Promise(resolve=>release=resolve);return transaction(...args);};
 const syncing=api.sync();await Promise.resolve();ctx.myId='b';api.record(100,'other');release();await syncing;assert.equal(api.best(),100);assert.equal(docs.get('users/a').wordDuelSoloBest,600);assert.equal(docs.get('users/b').wordDuelSoloBest,undefined);assert.equal(docs.get('users/b').understanding,'also preserved');
});
test('new best during an upload remains queued and guests do not write to Firestore',async()=>{
 const {ctx,api,docs}=setup();api.record(100,'book');const transaction=ctx.fbRunTransaction;let release,calls=0;ctx.fbRunTransaction=async(...args)=>{if(calls++===0)await new Promise(resolve=>release=resolve);return transaction(...args);};const syncing=api.sync();await Promise.resolve();api.record(300,'book');release();await syncing;assert.equal(docs.get('users/a').wordDuelSoloBest,300);assert.equal(api.read().pending,false);
 ctx.myId='GUEST-000';api.record(0,'book');assert.equal(await api.sync(),false);assert.equal(api.best(),0);assert.equal(docs.has('users/GUEST-000'),false);
});
test('a synchronous SDK failure does not trap future retries behind a completed job',async()=>{const {ctx,api,docs}=setup(),transaction=ctx.fbRunTransaction;api.record(120,'book');ctx.fbRunTransaction=()=>{throw Error('SDK unavailable');};assert.equal(await api.sync(),false);ctx.fbRunTransaction=transaction;assert.equal(await api.sync(),true);assert.equal(docs.get('users/a').wordDuelSoloBest,120);});
