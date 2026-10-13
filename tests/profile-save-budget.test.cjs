const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){
 const values=new Map(),cloud={profileCustomizationJson:JSON.stringify({nickname:'利用者',avatar:'',avatarUpdatedAt:10,nameColor:'#f8fafc',updatedAt:20}),playerName:'利用者',avatar:'',avatarUpdatedAt:10};let reads=0,writes=0,loadReads=0,fail=false;const loads=[];
 values.set('core_v4_profile_customization_self',cloud.profileCustomizationJson);
 const ctx={myId:'self',myName:'利用者',console,localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},db:{},fbDoc:()=>({path:'users/self'}),applyProfileToUi:()=>{},fbRunTransaction:async(_,fn)=>{reads++;if(fail)throw Error('offline');return fn({get:async()=>({exists:()=>true,data:()=>cloud}),set:(_,data)=>{writes++;Object.assign(cloud,data);}})}};ctx.window=ctx;ctx.onAppLoaded=fn=>loads.push(fn);ctx.fbGetDoc=async()=>{loadReads++;return {exists:()=>true,data:()=>cloud};};
 const source=fs.readFileSync('profile.js','utf8');vm.runInNewContext(source.split('let imageRequests=')[0]+source.split('\n').find(line=>line.startsWith('window.onAppLoaded(async'))+'window.UserProfile={read,store,sync};})();',ctx);
 return {ctx,cloud,counts:()=>({reads,writes}),fail:value=>fail=value,load:()=>loads[0](),loadReads:()=>loadReads};
}
test('unchanged pending profile does not rewrite identical cloud fields',async()=>{
 const {ctx,counts}=setup();ctx.UserProfile.store(ctx.UserProfile.read());await ctx.UserProfile.sync();await ctx.UserProfile.sync();assert.deepEqual(counts(),{reads:1,writes:0});
});
test('changed profile is retained on disconnection and retried, then stops resending',async()=>{
 const {ctx,cloud,counts,fail}=setup();const data=ctx.UserProfile.read();data.nickname='変更後';data.updatedAt=21;ctx.UserProfile.store(data);fail(true);assert.equal(await ctx.UserProfile.sync(),false);assert.equal(ctx.UserProfile.read().nickname,'変更後');fail(false);assert.equal(await ctx.UserProfile.sync(),true);await ctx.UserProfile.sync();assert.equal(cloud.playerName,'変更後');assert.equal(cloud.avatarUpdatedAt,10);assert.deepEqual(counts(),{reads:2,writes:1});
});
test('startup reads identity once and starts no transaction when cloud already matches',async()=>{
 const {counts,load,loadReads}=setup();await load();await new Promise(setImmediate);assert.equal(loadReads(),1);assert.deepEqual(counts(),{reads:0,writes:0});
});
