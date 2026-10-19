const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const type=process.env.BROWSER==='webkit'?webkit:chromium,browser=await type.launch(type===chromium?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{executablePath:process.env.WEBKIT_EXECUTABLE_PATH});try{
const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});page.on('dialog',d=>d.accept());await page.route('https://**/*',r=>r.abort());
await page.goto('http://127.0.0.1:8000');await page.waitForFunction(()=>window.LoginIdentity&&typeof window.handleAuthSubmit==='function'&&!document.getElementById('authSubmitBtn').disabled);
// In-memory Firestore: transactions read and write the same store.
async function reset(docs,options={}){await page.evaluate(([docs,options])=>{const store=new Map(Object.entries(docs).map(([k,v])=>[k,JSON.parse(JSON.stringify(v))]));window.__store=store;const fail=()=>{if(options.fail){const e=Error(options.fail==='resource-exhausted'?'Quota exceeded.':'client is offline');e.code=options.fail;throw e;}};const snap=path=>({exists:()=>store.has(path),data:()=>JSON.parse(JSON.stringify(store.get(path)))});const set=(ref,payload,opts)=>{store.set(ref.path,opts&&opts.merge?{...(store.get(ref.path)||{}),...JSON.parse(JSON.stringify(payload))}:JSON.parse(JSON.stringify(payload)));};
window.db={};window.fbDoc=(db,...parts)=>({path:parts.join('/')});window.fbGetDoc=async ref=>{fail();return snap(ref.path);};window.fbSetDoc=async(ref,payload,opts)=>{fail();if(options.failWrites)throw Error('write failed');set(ref,payload,opts);};window.fbRunTransaction=async(db,callback)=>{fail();if(options.failWrites)throw Error('write failed');const writes=[];const result=await callback({get:async ref=>snap(ref.path),set:(...args)=>{writes.push(args);}});writes.forEach(args=>set(...args));return result;};
localStorage.removeItem('core_v4_userId');localStorage.removeItem('core_v4_users');document.getElementById('loginOverlayLayer')?.remove();document.getElementById('authErrorMsg').style.display='none';},[docs,options]);}
async function login(id,pin){await page.evaluate(()=>window.switchAuthMode('login'));await page.fill('#loginIdInput',id);await page.fill('#loginPinInput',pin);await page.evaluate(()=>window.handleAuthSubmit());}
const error=()=>page.evaluate(()=>{const e=document.getElementById('authErrorMsg');return e.style.display==='block'?e.innerText:'';});
assert.equal(await page.getAttribute('#loginIdInput','autocapitalize'),'characters');
// Lower-case / full-width input reaches the issued upper-case account via users/{id}.
await reset({'users/ABCDEFG123':{pin:'1234',playerName:'検証'},'shared/all_users':{users:[{id:'OTHER00001',pin:'0000'}]}});
await login('abcdefg123','１２３４');assert.equal(await error(),'');assert.equal(await page.locator('#loginOverlayLayer').count(),1);
let all=await page.evaluate(()=>__store.get('shared/all_users').users.map(u=>u.id+':'+u.pin).sort());assert.deepEqual(all,['ABCDEFG123:1234','OTHER00001:0000']);
await page.evaluate(()=>document.getElementById('loginOverlayLayer').remove());
// Wrong PIN, quota and offline are reported separately.
await reset({'users/ABCDEFG123':{pin:'1234'},'shared/all_users':{users:[]}});await login('ABCDEFG123','9999');assert.match(await error(),/違います/);
await reset({'users/ABCDEFG123':{pin:'1234'}},{fail:'resource-exhausted'});await login('ABCDEFG123','1234');assert.match(await error(),/利用上限/);
await reset({'users/ABCDEFG123':{pin:'1234'}},{fail:'unavailable'});await login('ABCDEFG123','1234');assert.match(await error(),/接続できず/);
await reset({'users/ABCDEFG123':{pin:'1234',deleted:true}});await login('ABCDEFG123','1234');assert.match(await error(),/削除/);
// An account whose cloud document lost its PIN logs in via all_users and gets the PIN restored.
await reset({'users/PINLESS001':{playerName:'旧'},'shared/all_users':{users:[{id:'PINLESS001',pin:'5678'}]}});await login('pinless001','5678');assert.equal(await page.locator('#loginOverlayLayer').count(),1);
await page.evaluate(()=>window.repairCloudPin({id:'PINLESS001',pin:'5678'}));assert.equal(await page.evaluate(()=>__store.get('users/PINLESS001').pin),'5678');await page.evaluate(()=>document.getElementById('loginOverlayLayer').remove());
// Repair never replaces a PIN that was reset after the account was read.
await reset({'users/PINLESS001':{pin:'9999'}});assert.equal(await page.evaluate(()=>window.restoreCloudPinIfMissing('PINLESS001','5678')),false);assert.equal(await page.evaluate(()=>__store.get('users/PINLESS001').pin),'9999');
// saveAllUsers merges one entry into the latest list instead of replacing it.
await reset({'shared/all_users':{users:[{id:'A000000001',pin:'1111',playerName:'a'},{id:'B000000002',pin:'2222'}]}});await page.evaluate(()=>window.saveAllUsers([{id:'A000000001',playerName:'改名'}]));
all=await page.evaluate(()=>__store.get('shared/all_users').users);assert.deepEqual(all,[{id:'A000000001',pin:'1111',playerName:'改名'},{id:'B000000002',pin:'2222'}]);
// A failed transaction never writes a stale list.
await reset({'shared/all_users':{users:[{id:'A000000001',pin:'1111'}]}},{failWrites:true});await page.evaluate(()=>window.saveAllUsers([{id:'C000000003',pin:'3333'}]));assert.deepEqual(await page.evaluate(()=>__store.get('shared/all_users').users.map(u=>u.id)),['A000000001']);
// Registration is not reported as successful unless users/{id} was saved.
await reset({'shared/all_users':{users:[]}},{failWrites:true});await page.evaluate(()=>window.switchAuthMode('register'));await page.fill('#regPlayerName','新人');await page.fill('#regRealName','山田');await page.fill('#regAge','15');await page.fill('#regPin','4321');await page.evaluate(()=>window.handleAuthSubmit());
assert.match(await error(),/登録できませんでした/);assert.equal(await page.evaluate(()=>localStorage.getItem('core_v4_userId')),null);
console.log('PASS '+type.name()+': case/full-width login, distinct wrong-PIN/quota/offline/deleted messages, PIN repair, merged all_users writes, registration requires cloud save');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
