const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){const values=new Map(),ctx={myId:'a',Date,Event:class{},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},dispatchEvent:()=>{}};ctx.window=ctx;vm.runInNewContext(fs.readFileSync('learning-data.js','utf8'),ctx);return {ctx,values,state:ctx.LearningData};}
const saved={1:{status:'ok',history:['bad','ok']},2:{status:'bad'}};
test('a newer full save containing empty/default ratings cannot erase completed answers',()=>{const {state,values}=setup();values.set('core_v4_user_vocab_progress_a_book',JSON.stringify(saved));state.restore('book',{1:{status:'none',history:[]},2:{status:'none'},3:{status:'none'}});assert.equal(state.read('book')[1].status,'ok');assert.equal(state.read('book')[2].status,'bad');});
test('explicit resets remain resets after stale snapshots and recovery replay',()=>{const {state,values}=setup();values.set('core_v4_user_vocab_progress_a_book',JSON.stringify(saved));state.commit('book',{1:{status:'none',history:[]}},1);state.restore('book',saved);assert.equal(state.read('book')[1].status,'none');values.delete('core_v4_user_vocab_progress_a_book');assert.equal(state.read('book')[1].status,'none');assert.equal(state.read('book')[2].status,'bad');});
test('understanding recovers when only the primary record has been overwritten or lost',()=>{const {state,values}=setup();values.set('core_v4_user_vocab_progress_a_book',JSON.stringify(saved));state.read('book');values.set('core_v4_user_vocab_progress_a_book',JSON.stringify({1:{status:'none'},2:{status:'none'}}));assert.equal(state.read('book')[1].status,'ok');values.delete('core_v4_user_vocab_progress_a_book');assert.equal(state.read('book')[2].status,'bad');});
test('loading blocks commits; an older load cannot unlock a newer request',()=>{const {state,values}=setup();const old=state.begin('book'),latest=state.begin('book');state.finish(old);assert.equal(state.canSave('book'),false);assert.throws(()=>state.commit('book',{1:{status:'none'}},1),/読み込み中/);assert.equal(values.size,0);state.finish(latest);assert.equal(state.canSave('book'),true);});
test('boot completion and account identity are prerequisites to saving',()=>{const {ctx,state}=setup();const token=state.begin('book');ctx.myId='b';state.finish(token);ctx.myId='a';assert.equal(state.canSave('book'),false);state.finish(token);ctx.__learningBootReady=false;assert.equal(state.canSave('book'),false);ctx.__learningBootReady=true;assert.equal(state.canSave('book'),true);});
test('invalid saved data stops replacement rather than being interpreted as empty',()=>{const {state,values}=setup();values.set('core_v4_user_vocab_progress_a_book','broken');assert.throws(()=>state.restore('book',{}));assert.equal(values.get('core_v4_user_vocab_progress_a_book'),'broken');});
test('a later explicitly timestamped remote answer is accepted without dropping missing words',()=>{const {state,values}=setup();values.set('core_v4_user_vocab_progress_a_book',JSON.stringify({1:{status:'ok',editedAt:1000},2:{status:'bad'}}));state.restore('book',{1:{status:'bad',editedAt:2000}});assert.equal(state.read('book')[1].status,'bad');assert.equal(state.read('book')[2].status,'bad');});
test('startup restores ratings archived in full-save localStorage before empty memory snapshots',async()=>{
 const {ctx,values,state}=setup();ctx.myId='';values.set('core_v4_userId','a');values.set('save',JSON.stringify({savedAt:new Date(2000).toISOString(),data:{localStorage:{core_v4_user_vocab_progress_a_book:JSON.stringify(saved)},memory:{vocabBookKey:'book',vocabProgress:{}}}}));ctx.console=console;ctx.applySavedMemory=()=>{};ctx.loginUid=()=> 'a';ctx.localKey=()=> 'save';ctx.cloudMetaKey=()=> 'meta-cloud';ctx.localMetaKey=()=> 'meta-local';
 const source=fs.readFileSync('save-system.js','utf8'),start=source.indexOf('function restoreSaveStorage(save,id)');vm.runInNewContext(source.slice(start,source.indexOf('\nfunction openPanel()',start)),ctx);await ctx.autoLoadOnce();assert.equal(state.read('book')[1].status,'ok');assert.equal(state.read('book')[2].status,'bad');assert.equal(values.get('core_v4_user_vocab_progress_GUEST-000_book'),undefined);
});

test('two explicit answers in the same millisecond keep the latest answer through recovery',()=>{
 const {ctx,state,values}=setup();ctx.Date={now:()=>1000};state.commit('book',{1:{status:'bad'}},1);state.commit('book',{1:{status:'ok'}},1);assert.equal(state.read('book')[1].status,'ok');assert.equal(state.read('book')[1].editedAt,1001);values.delete('core_v4_user_vocab_progress_a_book');assert.equal(state.read('book')[1].status,'ok');
});

test('matching working and recovery records need one parse and no full-book comparison strings',()=>{
 const {ctx,state,values}=setup();state.restore('book',saved);
 let parses=0,strings=0,writes=0;
 ctx.JSON={parse:(...args)=>{parses++;return JSON.parse(...args);},stringify:(...args)=>{strings++;return JSON.stringify(...args);}};
 const set=ctx.localStorage.setItem;ctx.localStorage.setItem=(...args)=>{writes++;set(...args);};
 const first=state.read('book');assert.equal(parses,1);assert.equal(strings,0);assert.equal(writes,0);
 first[1].status='bad';first[1].history.push('bad');
 assert.equal(state.read('book')[1].status,'ok');assert.equal(state.read('book')[1].history.length,2);
 parses=strings=writes=0;
 state.commit('book',{1:{status:'so'}},1);
 assert.equal(parses,1);assert.equal(strings,1);assert.equal(writes,2);
 assert.equal(values.get('core_v4_user_vocab_progress_a_book'),values.get('aiglish_learning_recovery_a_book'));
});

test('interruption after writing the recovery mirror repairs the working record on the next read',()=>{
 const {ctx,state,values}=setup();state.restore('book',saved);
 const set=ctx.localStorage.setItem;let writes=0;
 ctx.localStorage.setItem=(...args)=>{if(++writes===2)throw Error('interrupted');set(...args);};
 assert.throws(()=>state.commit('book',{1:{status:'none',history:[]}},1),/interrupted/);
 ctx.localStorage.setItem=set;
 const restored=state.read('book');assert.equal(restored[1].status,'none');assert.equal(restored[2].status,'bad');
 assert.equal(JSON.parse(values.get('core_v4_user_vocab_progress_a_book'))[1].status,'none');
});

test('external changes and another account are always read from the current storage',()=>{
 const {ctx,state,values}=setup();state.restore('book',saved);
 const fresh=JSON.stringify({1:{status:'bad',editedAt:Date.now()+10000}});
 values.set('core_v4_user_vocab_progress_a_book',fresh);
 assert.equal(state.read('book')[1].status,'bad');assert.equal(state.read('book')[2].status,'bad');
 ctx.myId='b';assert.equal(Object.keys(state.read('book')).length,0);
 ctx.myId='a';assert.equal(state.read('book')[1].status,'bad');
});
