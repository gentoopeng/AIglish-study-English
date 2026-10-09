// Name/photo identity. Existing settings remain opaque backup data, not appearance UI.
(function(){
'use strict';
function decode(raw){try{const data=typeof raw==='string'?JSON.parse(raw):raw;return data&&typeof data==='object'&&!Array.isArray(data)?data:{};}catch(error){return {};}}
function merge(left,right){left=decode(left);right=decode(right);return Number(right.updatedAt||0)>Number(left.updatedAt||0)?{...left,...right}:{...right,...left};}
function safePhoto(value){return typeof value==='string'&&(/^(https?:\/\/|data:image\/(?:png|jpeg|webp);base64,)/i.test(value))?value:'';}
window.UserProfileModel={merge,decode,safePhoto};
const owner=()=>myId||'GUEST-000',key=id=>'core_v4_profile_customization_'+id,pending=new Set(),jobs=new Map();
function read(){return decode(localStorage.getItem(key(owner())));}
function restore(){const data=read();if(typeof data.nickname==='string'&&data.nickname.trim()){myName=data.nickname.slice(0,40);localStorage.setItem('core_v4_userName',myName);}if(typeof data.avatar==='string'){localStorage.setItem('core_v4_user_avatar_'+owner(),safePhoto(data.avatar));}}
function store(data){localStorage.setItem(key(owner()),JSON.stringify(data));pending.add(owner());window.queueBackgroundSave?.();}
async function sync(){
 const id=owner();if(jobs.has(id))return jobs.get(id);if(!pending.has(id)||id==='GUEST-000'||!window.db||!window.fbRunTransaction)return false;
 const local=read(),name=myName,photo=localStorage.getItem('core_v4_user_avatar_'+id)||'';
 const task=(async()=>{try{
  const result=await window.fbRunTransaction(window.db,async tx=>{const ref=window.fbDoc(window.db,'users',id),snap=await tx.get(ref),data=merge(local,snap.exists()?snap.data().profileCustomizationJson:null);const fields={profileCustomizationJson:JSON.stringify(data),playerName:typeof data.nickname==='string'?data.nickname:name,avatar:typeof data.avatar==='string'?safePhoto(data.avatar):photo};tx.set(ref,fields,{merge:true});return data;});
  if(owner()!==id)return false;const current=read();if(current.updatedAt===local.updatedAt)pending.delete(id);localStorage.setItem(key(id),JSON.stringify(merge(current,result)));restore();window.applyProfileToUi();return true;
 }catch(error){console.warn('プロフィールは接続後に再同期します',error);return false;}finally{jobs.delete(id);}})();jobs.set(id,task);return task;
}
let imageRequests=0;
let imageQueue=Promise.resolve();
async function imageFile(file,size=800,format='image/jpeg',isCurrent=()=>true,quality=.65){
 if(!file||!file.type.startsWith('image/'))throw Error('写真を選んでください。');
 imageRequests++;const saveButton=document.querySelector('#sidebarProfileForm button[type=submit]');if(saveButton)saveButton.disabled=true;
 const work=async()=>{if(!isCurrent())throw Error('画像の読み込みを中止しました。');await window.ImageMetadata.inspect(file);if(!isCurrent())throw Error('画像の読み込みを中止しました。');let bitmap=null,url='',canvas=null;try{
   if(window.createImageBitmap){try{bitmap=await createImageBitmap(file,{resizeWidth:size,resizeQuality:'high',imageOrientation:'from-image'});}catch(error){}}
   if(!bitmap){url=URL.createObjectURL(file);bitmap=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('写真を開けませんでした。'));img.src=url;});}
   const scale=Math.min(1,size/Math.max(bitmap.width,bitmap.height));canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);return canvas.toDataURL(format,quality);
 }finally{if(bitmap&&bitmap.close)bitmap.close();if(bitmap&&url)bitmap.src='';if(url)URL.revokeObjectURL(url);if(canvas){canvas.width=0;canvas.height=0;}}};
 const result=imageQueue.then(work,work);imageQueue=result.catch(()=>{});
 return result.finally(()=>{imageRequests--;if(saveButton&&imageRequests===0)saveButton.disabled=false;});
}
window.ProfileImages={imageFile};window.UserProfile={read,store,sync};
const form=document.getElementById('sidebarProfileForm'),status=document.getElementById('sidebarProfileStatus');
let photo=null,photoOwner='',uploadRevision=0;
function populate(){restore();form.elements.sideInputName.value=myName;form.elements.sidebarAvatarFile.value='';photo=null;photoOwner=owner();uploadRevision++;status.textContent='';}
form.elements.sidebarAvatarFile.onchange=async event=>{const id=owner(),revision=++uploadRevision;status.textContent='写真を準備しています…';try{const image=await imageFile(event.target.files[0],240,'image/jpeg',()=>owner()===id&&revision===uploadRevision);if(owner()!==id||revision!==uploadRevision)return;photo=image;photoOwner=id;status.textContent='写真を選びました。保存で確定します。';}catch(error){if(owner()===id&&revision===uploadRevision)status.textContent=error.message;}};
form.onsubmit=async event=>{event.preventDefault();const id=owner(),name=form.elements.sideInputName.value.trim();if(!name){status.textContent='名前を入力してください。';return;}try{const data=read();data.nickname=name.slice(0,40);data.avatar=photo!==null&&photoOwner===id?photo:localStorage.getItem('core_v4_user_avatar_'+id)||'';data.updatedAt=Math.max(Date.now(),Number(data.updatedAt||0)+1);store(data);if(window.AppStorage)await window.AppStorage.flush();if(owner()!==id)return;restore();window.applyProfileToUi();status.textContent='端末に保存しました。';const revision=data.updatedAt;sync().then(saved=>{if(saved&&owner()===id&&read().updatedAt===revision)status.textContent='保存・同期しました。';});}catch(error){status.textContent='保存できませんでした。入力はそのまま残っています。';console.error(error);}};
const oldUi=window.applyProfileToUi;window.applyProfileToUi=function(){restore();return oldUi.apply(this,arguments);};
const oldSidebar=window.toggleSidebar;window.toggleSidebar=function(open){if(open)populate();return oldSidebar.apply(this,arguments);};
window.saveSidebarApiKey=function(){geminiApiKey=document.getElementById('sidebarApiKeyInput').value.trim();localStorage.setItem('core_v4_geminiKey',geminiApiKey);window.queueBackgroundSave?.();};
window.onAppLoaded(async()=>{const id=owner();restore();window.applyProfileToUi();try{if(id!=='GUEST-000'&&window.db&&window.fbGetDoc){const snap=await window.fbGetDoc(window.fbDoc(window.db,'users',id));if(owner()!==id)return;if(snap.exists())localStorage.setItem(key(id),JSON.stringify(merge(read(),snap.data().profileCustomizationJson)));restore();window.applyProfileToUi();pending.add(id);sync();}}catch(error){pending.add(id);console.warn('プロフィールは端末の保存を使います',error);}});
window.addEventListener('storage',event=>{if(event.key===key(owner()))window.applyProfileToUi();});window.addEventListener('online',sync);setInterval(sync,30000);
})();
