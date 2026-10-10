// Isolated Firestore double: no production application data is read or written.
module.exports=async function install(page){
 const records=new Map();
 await page.exposeFunction('testBackgroundRead',path=>structuredClone(records.get(path)||null));
 await page.exposeFunction('testBackgroundWrite',(path,value)=>records.set(path,structuredClone(value))&&true);
 await page.exposeFunction('testBackgroundCommit',(generation,value)=>{if((records.get('shared/backgrounds')?.generation||'')!==generation)return false;records.set('shared/backgrounds',structuredClone(value));return true;});
 await page.addInitScript(()=>{window.__installBackgroundBackend=()=>{window.db={};window.fbDoc=(db,...path)=>path.join('/');const snap=value=>({exists:()=>value!==null,data:()=>value});window.fbGetDocFromServer=window.fbGetDoc=async path=>snap(await testBackgroundRead(path));window.fbSetDoc=async(path,value)=>{await testBackgroundWrite(path,value);};window.fbRunTransaction=async(db,fn)=>{let generation='',value;const result=await fn({get:async path=>{const record=await testBackgroundRead(path);generation=record?.generation||'';return snap(record);},set:(path,next)=>value=next});return result?testBackgroundCommit(generation,value):false;};};});
 // addInitScript applies on subsequent navigations; initialize this already-open page too.
 await page.evaluate(()=>{window.db={};window.fbDoc=(db,...path)=>path.join('/');const snap=value=>({exists:()=>value!==null,data:()=>value});window.fbGetDocFromServer=window.fbGetDoc=async path=>snap(await testBackgroundRead(path));window.fbSetDoc=async(path,value)=>{await testBackgroundWrite(path,value);};window.fbRunTransaction=async(db,fn)=>{let generation='',value;const result=await fn({get:async path=>{const record=await testBackgroundRead(path);generation=record?.generation||'';return snap(record);},set:(path,next)=>value=next});return result?testBackgroundCommit(generation,value):false;};});
 return records;
};
