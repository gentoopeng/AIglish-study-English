// Static backgrounds: a bounded, per-account gallery; dialogs and previews are mounted on demand.
(function(){
'use strict';
const owner=()=>typeof myId==='string'&&myId?myId:'GUEST-000',key=id=>'aiglish_app_background_'+id,catalogKey=id=>'aiglish_app_background_catalog_'+id;
const admin=document.getElementById('backgroundAdminTemplate').content.firstElementChild;
const picker=document.getElementById('backgroundPickerTemplate').content.firstElementChild;
const file=admin.querySelector('#sidebarBackgroundFile'),position=admin.querySelector('#sidebarBackgroundPosition');
const auth=admin.querySelector('#backgroundAdminAuth'),controls=admin.querySelector('#backgroundAdminControls');
const selection=admin.querySelector('#backgroundAdminSelection'),register=admin.querySelector('#backgroundAdminRegister');
const slides=picker.querySelector('#backgroundPickerSlides');
const empty=()=>({mode:'default',selected:'',backgrounds:[],updatedAt:0});
const validImage=value=>typeof value==='string'&&value.length<=1000000&&/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(value);
const focus=value=>Math.max(0,Math.min(100,Number.isFinite(Number(value))?Number(value):30));
let account='',settings=empty(),adminOwner=null,revision=0,saveRevision=0,loadedPreferences,loadedCatalog,stagedFile=null,stagedItem=null;
let backgroundUrl='',backgroundSource='',previewFrame=0;
const previews=new Map(),previewCache=new Map();
const label=item=>item.id==='default'?'いつもの背景':'背景 '+(settings.backgrounds.indexOf(item)+1);
const isAdmin=()=>adminOwner===owner()&&admin.open;
const selected=()=>settings.backgrounds.find(item=>item.id===settings.selected);
function message(text){picker.querySelector('#backgroundPickerStatus').textContent=text;admin.querySelector('#backgroundAdminSaveStatus').textContent=text;}
function read(id){
 try{
  const preferences=JSON.parse(localStorage.getItem(key(id))||'null');
  const catalog=JSON.parse(localStorage.getItem(catalogKey(id))||'null');
  // A missing preference must not hide the independently durable photo catalogue.
  const value=preferences||catalog||{};
  const entries=catalog&&Array.isArray(catalog.backgrounds)?catalog.backgrounds:value.backgrounds;
  const backgrounds=[],ids=new Set();
  for(const item of Array.isArray(entries)?entries.slice(0,12):[]){
   if(!item||typeof item.id!=='string'||ids.has(item.id)||!validImage(item.image))continue;
   ids.add(item.id);backgrounds.push({id:item.id,name:String(item.name||'背景').slice(0,24),image:item.image,preview:validImage(item.preview)?item.preview:'',position:focus(item.position)});
  }
  // Keep the previously registered photo without writing or resetting anything during startup.
  if(!backgrounds.length&&validImage(value.image))backgrounds.push({id:'legacy-photo',name:'選んだ写真',image:value.image,preview:'',position:focus(value.position)});
  const chosen=backgrounds.find(item=>item.id===value.selected)||backgrounds[0];
  return {mode:value.mode==='photo'&&chosen?'photo':'default',selected:chosen?.id||'',backgrounds,updatedAt:Number(value.updatedAt)||0};
 }catch(error){message('背景設定を読み取れませんでした。');return empty();}
}
// Revocable URLs release obsolete photo resources on switches and suspension.
function photoUrl(data){const binary=atob(data.slice(data.indexOf(',')+1)),bytes=new Uint8Array(binary.length);for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);return URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'}));}
function releaseBackground(){document.documentElement.style.setProperty('--app-background-image','none');if(backgroundUrl)URL.revokeObjectURL(backgroundUrl);backgroundUrl='';backgroundSource='';}
function renderBackground(item){
 if(document.hidden||document.documentElement.classList.contains('pwa-recovery-rendering')){releaseBackground();return;}
 const source=item?item.image:'default';if(source===backgroundSource)return;
 const previous=backgroundUrl;
 backgroundUrl=item?photoUrl(item.image):'';backgroundSource=source;
 document.documentElement.style.setProperty('--app-background-image',item?'url("'+backgroundUrl+'")':'url("assets/background-night.webp")');
 if(previous)URL.revokeObjectURL(previous);
}
function apply(){
 const item=settings.mode==='photo'?selected():null;renderBackground(item);
 document.documentElement.style.setProperty('--app-background-position',item?item.position+'% center':'center');
 slides.querySelectorAll('[data-background]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.background===(item?item.id:'default'))));
 document.getElementById('headerBackgroundButton').setAttribute('aria-label','背景を選ぶ：'+(item?label(item):'いつもの背景'));
}
function load(){
 const next=owner();if(account!==next){account=next;adminOwner=null;revision++;saveRevision++;if(picker.open)picker.close();if(admin.open)admin.close();loadedPreferences=undefined;loadedCatalog=undefined;previewCache.clear();message('');}
 const preferences=localStorage.getItem(key(account)),catalog=localStorage.getItem(catalogKey(account));
 if(preferences!==loadedPreferences||catalog!==loadedCatalog){settings=read(account);loadedPreferences=preferences;loadedCatalog=catalog;}apply();
 if(document.documentElement.classList.contains('pwa-recovery-rendering'))message('前回の終了を確認できなかったため、背景を一時停止しています。選び直すと再表示します。');
}
async function save(next,success='背景を保存しました。'){
 const id=account,token=++saveRevision;next.updatedAt=Math.max(Date.now(),settings.updatedAt+1);message('保存しています…');
 try{
  // Selecting a photo writes only small preferences, not the entire image gallery.
  if(next.backgrounds!==settings.backgrounds||!localStorage.getItem(catalogKey(id)))localStorage.setItem(catalogKey(id),JSON.stringify({backgrounds:next.backgrounds,mode:next.mode,selected:next.selected,updatedAt:next.updatedAt}));
  localStorage.setItem(key(id),JSON.stringify({mode:next.mode,selected:next.selected,updatedAt:next.updatedAt}));settings=next;loadedPreferences=localStorage.getItem(key(id));loadedCatalog=localStorage.getItem(catalogKey(id));apply();
  if(window.AppStorage)await window.AppStorage.flush();
  if(owner()!==id||token!==saveRevision)return false;
  message(success);window.queueBackgroundSave?.();return true;
 }catch(error){if(owner()===id&&token===saveRevision)message('保存できませんでした。もう一度お試しください。');console.warn('背景設定の保存に失敗しました',error);return false;}
}
function adminList(id=settings.selected){
 selection.replaceChildren(...settings.backgrounds.map(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=label(item);return option;}));
 selection.value=id;position.value=String(settings.backgrounds.find(item=>item.id===selection.value)?.position??30);
 selection.disabled=!settings.backgrounds.length;admin.querySelector('#backgroundAdminDelete').disabled=!settings.backgrounds.length;
 admin.querySelector('#sidebarBackgroundFocus').hidden=!settings.backgrounds.length;
}
function releasePreview(button){
 const resource=previews.get(button);if(!resource)return;
 previews.delete(button);button.querySelector('img').removeAttribute('src');if(resource.url)URL.revokeObjectURL(resource.url);
}
function releasePreviews(){
 if(previewFrame){cancelAnimationFrame(previewFrame);previewFrame=0;}
 for(const button of [...previews.keys()])releasePreview(button);
}
async function showPreview(button){
 if(previews.has(button))return;
 const resource={url:''};previews.set(button,resource);
 const current=()=>picker.open&&previews.get(button)===resource;
 try{
  const item=button._backgroundItem;let source=item.preview;
  if(item.id==='default'){if(current())button.querySelector('img').src='assets/background-night-preview.webp';return;}
  if(!source){
   source=previewCache.get(item.image);
   if(!source){const blob=await (await fetch(item.image)).blob();if(!current())return;source=await window.ProfileImages.imageFile(blob,320,'image/jpeg',current,.5);if(!current())return;previewCache.set(item.image,source);}
  }
  if(!current())return;resource.url=photoUrl(source);button.querySelector('img').src=resource.url;
 }catch(error){if(current())message('プレビューを表示できませんでした。背景は削除していません。');}
}
function visiblePreviews(){
 if(!picker.open||document.hidden)return;
 const viewport=slides.getBoundingClientRect(),center=(viewport.left+viewport.right)/2;
 const candidates=[...slides.children].map(button=>({button,rect:button.getBoundingClientRect()})).filter(({rect})=>rect.right>viewport.left&&rect.left<viewport.right).sort((a,b)=>Math.abs((a.rect.left+a.rect.right)/2-center)-Math.abs((b.rect.left+b.rect.right)/2-center));
 const visible=new Set(candidates.slice(0,3).map(item=>item.button));
 for(const button of [...previews.keys()])if(!visible.has(button))releasePreview(button);
 for(const button of visible)showPreview(button);
}
slides.addEventListener('scroll',()=>{if(!previewFrame)previewFrame=requestAnimationFrame(()=>{previewFrame=0;visiblePreviews();});},{passive:true});
function card(item){
 const button=document.createElement('button');button.type='button';button.className='background-preview';button.dataset.background=item.id;button.setAttribute('aria-label',label(item));button._backgroundItem=item;
 const image=document.createElement('img');image.alt='';image.decoding='async';image.style.objectPosition=item.position+'% center';button.append(image);return button;
}
document.getElementById('headerBackgroundButton').onclick=()=>{
 load();releasePreviews();slides.replaceChildren(card({id:'default',position:50}),...settings.backgrounds.map(card));
 // Portrait previews match the current phone viewport rather than stretching landscape photos.
 picker.style.setProperty('--preview-ratio',innerWidth+'/'+innerHeight);document.body.append(picker);picker.showModal();apply();
 const current=slides.querySelector('[aria-pressed="true"]');if(current)slides.scrollLeft+=current.getBoundingClientRect().left-slides.getBoundingClientRect().left-(slides.clientWidth-current.offsetWidth)/2;visiblePreviews();
};
slides.onclick=event=>{
 const button=event.target.closest('[data-background]');if(!button||!slides.contains(button))return;
 if(owner()!==account){load();return;}
 document.documentElement.classList.remove('pwa-recovery-rendering');window.RenderSafety?.resumePhoto();
 save({...settings,mode:button.dataset.background==='default'?'default':'photo',selected:button.dataset.background==='default'?settings.selected:button.dataset.background});
};
picker.querySelector('#backgroundPickerClose').onclick=()=>picker.close();
picker.addEventListener('close',()=>{releasePreviews();slides.replaceChildren();picker.remove();});
file.onchange=()=>{
 stagedFile=isAdmin()?file.files[0]||null:null;stagedItem=null;register.disabled=!stagedFile;
 if(stagedFile)message('写真を選択しました。「登録する」で保存します。');
};
register.onclick=async()=>{
 if(!isAdmin()||!stagedFile)return;
 const id=account,token=++revision,source=stagedFile;
 file.disabled=true;register.disabled=true;register.textContent='登録中…';message('写真を準備しています…');
 try{
  if(settings.backgrounds.length>=12&&!stagedItem)throw Error('背景は12枚まで登録できます。使わない背景を削除してください。');
  if(source.size>12*1024*1024)throw Error('12MB以下の写真を選んでください。');
  const current=()=>isAdmin()&&owner()===id&&revision===token;
  if(!stagedItem){
   const image=await window.ProfileImages.imageFile(source,960,'image/jpeg',current,.6);if(!current())return;
   // Decode only the compressed image for a smaller slider thumbnail, never the source twice.
   const blob=await (await fetch(image)).blob();
   const preview=await window.ProfileImages.imageFile(blob,320,'image/jpeg',current,.5);if(!current())return;
   if(image.length>1000000||settings.backgrounds.reduce((size,item)=>size+item.image.length+item.preview.length,0)+image.length+preview.length>4000000)throw Error('画像の容量が大きいため、使わない背景を削除してから追加してください。');
   stagedItem={id:'photo-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),image,preview,position:30};
  }
  const item=stagedItem,backgrounds=settings.backgrounds.some(existing=>existing.id===item.id)?settings.backgrounds:[...settings.backgrounds,item];
  if(await save({...settings,backgrounds,selected:settings.selected||item.id},'写真を登録しました（合計'+backgrounds.length+'枚）。')&&current()){stagedFile=null;stagedItem=null;file.value='';adminList(item.id);}
 }catch(error){if(owner()===id&&revision===token)message(error.message);}finally{if(revision===token){file.disabled=false;register.disabled=!isAdmin()||!stagedFile;register.textContent='登録する';}}
};
selection.onchange=()=>{if(isAdmin())position.value=String(settings.backgrounds.find(item=>item.id===selection.value)?.position??30);};
position.onchange=async()=>{if(isAdmin())await save({...settings,backgrounds:settings.backgrounds.map(item=>item.id===selection.value?{...item,position:Number(position.value)}:item)});};
admin.querySelector('#backgroundAdminDelete').onclick=async()=>{
 if(!isAdmin())return;const backgrounds=settings.backgrounds.filter(item=>item.id!==selection.value);
 const removedCurrent=settings.selected===selection.value;
 const next={...settings,backgrounds,selected:removedCurrent?(backgrounds[0]?.id||''):settings.selected,mode:removedCurrent?'default':settings.mode};
 if(await save(next)){previewCache.clear();adminList();}
};
document.getElementById('sidebarBackgroundAdmin').onclick=()=>{
 load();adminOwner=null;auth.hidden=false;controls.hidden=true;auth.reset();admin.querySelector('#backgroundAdminAuthStatus').textContent='';
 window.toggleSidebar(false);document.body.append(admin);admin.showModal();
};
// Existing application's password gate; server authorization is separate.
auth.onsubmit=event=>{
 event.preventDefault();const password=auth.elements.backgroundAdminPassword.value.trim();auth.reset();
 if(password!=='tukinokopanda'&&password!=='tutinokopanda'){admin.querySelector('#backgroundAdminAuthStatus').textContent='パスワードが違います。';return;}
 adminOwner=owner();auth.hidden=true;controls.hidden=false;message('');adminList();
};
admin.querySelector('#backgroundAdminClose').onclick=()=>admin.close();
admin.addEventListener('close',()=>{adminOwner=null;revision++;file.value='';file.disabled=false;stagedFile=null;stagedItem=null;register.disabled=true;register.textContent='登録する';auth.reset();auth.hidden=false;controls.hidden=true;admin.remove();});
window.onAppLoaded(load);const toggle=window.toggleSidebar;window.toggleSidebar=function(open){if(open)load();return toggle.apply(this,arguments);};
window.addEventListener('pagehide',()=>{releasePreviews();releaseBackground();});
window.addEventListener('pageshow',()=>{apply();visiblePreviews();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){releasePreviews();releaseBackground();}else{apply();visiblePreviews();}});
window.addEventListener('storage',event=>{if(event.key===key(owner())||event.key===catalogKey(owner()))load();});load();
})();
