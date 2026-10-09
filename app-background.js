// Static backgrounds: a bounded, per-account gallery; dialogs and previews are mounted on demand.
(function(){
'use strict';
const owner=()=>typeof myId==='string'&&myId?myId:'GUEST-000',key=id=>'aiglish_app_background_'+id,catalogKey=id=>'aiglish_app_background_catalog_'+id;
const admin=document.getElementById('backgroundAdminTemplate').content.firstElementChild;
const picker=document.getElementById('backgroundPickerTemplate').content.firstElementChild;
const file=admin.querySelector('#sidebarBackgroundFile'),position=admin.querySelector('#sidebarBackgroundPosition');
const auth=admin.querySelector('#backgroundAdminAuth'),controls=admin.querySelector('#backgroundAdminControls');
const selection=admin.querySelector('#backgroundAdminSelection'),name=admin.querySelector('#backgroundAdminName');
const slides=picker.querySelector('#backgroundPickerSlides');
const empty=()=>({mode:'default',selected:'',backgrounds:[],updatedAt:0});
const validImage=value=>typeof value==='string'&&value.length<=1000000&&/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(value);
const focus=value=>Math.max(0,Math.min(100,Number.isFinite(Number(value))?Number(value):30));
let account='',settings=empty(),adminOwner=null,revision=0,saveRevision=0,loadedPreferences,loadedCatalog;
const isAdmin=()=>adminOwner===owner()&&admin.open;
const selected=()=>settings.backgrounds.find(item=>item.id===settings.selected);
function message(text){picker.querySelector('#backgroundPickerStatus').textContent=text;admin.querySelector('#backgroundAdminSaveStatus').textContent=text;}
function read(id){
 try{
  const value=JSON.parse(localStorage.getItem(key(id))||'null');if(!value)return empty();
  const catalog=JSON.parse(localStorage.getItem(catalogKey(id))||'null');
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
function apply(){
 const item=settings.mode==='photo'?selected():null,source=item?'url("'+item.image+'")':'url("tango.png")';
 if(document.documentElement.style.getPropertyValue('--app-background-image')!==source)document.documentElement.style.setProperty('--app-background-image',source);
 document.documentElement.style.setProperty('--app-background-position',item?item.position+'% center':'center');
 slides.querySelectorAll('[data-background]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.background===(item?item.id:'default'))));
 document.getElementById('headerBackgroundButton').setAttribute('aria-label','背景を選ぶ：'+(item?item.name:'いつもの背景'));
}
function load(){
 const next=owner();if(account!==next){account=next;adminOwner=null;revision++;saveRevision++;if(picker.open)picker.close();if(admin.open)admin.close();loadedPreferences=undefined;loadedCatalog=undefined;message('');}
 const preferences=localStorage.getItem(key(account)),catalog=localStorage.getItem(catalogKey(account));
 if(preferences!==loadedPreferences||catalog!==loadedCatalog){settings=read(account);loadedPreferences=preferences;loadedCatalog=catalog;}apply();
 if(document.documentElement.classList.contains('pwa-recovery-rendering'))message('再起動後は背景を一時停止しています。選び直すと再表示します。');
}
async function save(next){
 const id=account,token=++saveRevision;next.updatedAt=Math.max(Date.now(),settings.updatedAt+1);message('保存しています…');
 try{
  // Selecting a photo writes only small preferences, not the entire image gallery.
  if(next.backgrounds!==settings.backgrounds||!localStorage.getItem(catalogKey(id)))localStorage.setItem(catalogKey(id),JSON.stringify({backgrounds:next.backgrounds,updatedAt:next.updatedAt}));
  localStorage.setItem(key(id),JSON.stringify({mode:next.mode,selected:next.selected,updatedAt:next.updatedAt}));settings=next;loadedPreferences=localStorage.getItem(key(id));loadedCatalog=localStorage.getItem(catalogKey(id));apply();
  if(window.AppStorage)await window.AppStorage.flush();
  if(owner()!==id||token!==saveRevision)return false;
  message('背景を保存しました。');window.queueBackgroundSave?.();return true;
 }catch(error){if(owner()===id&&token===saveRevision)message('保存できませんでした。もう一度お試しください。');console.warn('背景設定の保存に失敗しました',error);return false;}
}
function adminList(){
 selection.replaceChildren(...settings.backgrounds.map(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=item.name;return option;}));
 selection.value=settings.selected;position.value=String(selected()?.position??30);
 selection.disabled=!settings.backgrounds.length;admin.querySelector('#backgroundAdminDelete').disabled=!settings.backgrounds.length;
 admin.querySelector('#sidebarBackgroundFocus').hidden=!selected();
}
function card(item){
 const button=document.createElement('button');button.type='button';button.className='background-preview';button.dataset.background=item.id;button.setAttribute('aria-label',item.name);
 const image=document.createElement('img');image.alt='';image.loading='lazy';image.decoding='async';image.src=item.preview||item.image;image.style.objectPosition=item.position+'% center';
 const caption=document.createElement('span');caption.textContent=item.name;button.append(image,caption);return button;
}
document.getElementById('headerBackgroundButton').onclick=()=>{
 load();slides.replaceChildren(card({id:'default',name:'いつもの背景',image:'tango.png',position:50}),...settings.backgrounds.map(card));
 // Portrait previews match the current phone viewport rather than stretching landscape photos.
 picker.style.setProperty('--preview-ratio',innerWidth+'/'+innerHeight);document.body.append(picker);picker.showModal();apply();
 const current=slides.querySelector('[aria-pressed="true"]');if(current)slides.scrollLeft+=current.getBoundingClientRect().left-slides.getBoundingClientRect().left-(slides.clientWidth-current.offsetWidth)/2;
};
slides.onclick=event=>{
 const button=event.target.closest('[data-background]');if(!button||!slides.contains(button))return;
 if(owner()!==account){load();return;}
 document.documentElement.classList.remove('pwa-recovery-rendering');
 save({...settings,mode:button.dataset.background==='default'?'default':'photo',selected:button.dataset.background==='default'?settings.selected:button.dataset.background});
};
picker.querySelector('#backgroundPickerClose').onclick=()=>picker.close();
picker.addEventListener('close',()=>{slides.replaceChildren();picker.remove();});
file.onchange=async()=>{
 if(!isAdmin()){file.value='';return;}
 const id=account,token=++revision,source=file.files[0];if(!source)return;
 file.disabled=true;message('写真を準備しています…');
 try{
  if(settings.backgrounds.length>=12)throw Error('背景は12枚まで登録できます。使わない背景を削除してください。');
  if(source.size>12*1024*1024)throw Error('12MB以下の写真を選んでください。');
  const current=()=>isAdmin()&&owner()===id&&revision===token;
  const image=await window.ProfileImages.imageFile(source,1280,'image/jpeg',current,.65);if(!current())return;
  // Decode only the compressed image for a smaller slider thumbnail, never the source twice.
  const blob=await (await fetch(image)).blob();
  const preview=await window.ProfileImages.imageFile(blob,640,'image/jpeg',current,.55);if(!current())return;
  if(image.length>1000000||settings.backgrounds.reduce((size,item)=>size+item.image.length+item.preview.length,0)+image.length+preview.length>4000000)throw Error('画像の容量が大きいため、使わない背景を削除してから追加してください。');
  const item={id:'photo-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),name:name.value.trim()||'背景 '+(settings.backgrounds.length+1),image,preview,position:30};
  if(await save({...settings,backgrounds:[...settings.backgrounds,item],selected:item.id,mode:'photo'})&&current()){name.value='';adminList();}
 }catch(error){if(owner()===id&&revision===token)message(error.message);}finally{file.value='';file.disabled=false;}
};
selection.onchange=()=>{if(isAdmin())position.value=String(settings.backgrounds.find(item=>item.id===selection.value)?.position??30);};
position.onchange=async()=>{if(isAdmin())await save({...settings,backgrounds:settings.backgrounds.map(item=>item.id===selection.value?{...item,position:Number(position.value)}:item)});};
admin.querySelector('#backgroundAdminDelete').onclick=async()=>{
 if(!isAdmin())return;const backgrounds=settings.backgrounds.filter(item=>item.id!==selection.value);
 const removedCurrent=settings.selected===selection.value;
 const next={...settings,backgrounds,selected:removedCurrent?(backgrounds[0]?.id||''):settings.selected,mode:removedCurrent?'default':settings.mode};
 if(await save(next))adminList();
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
admin.addEventListener('close',()=>{adminOwner=null;revision++;file.value='';name.value='';auth.reset();auth.hidden=false;controls.hidden=true;admin.remove();});
window.onAppLoaded(load);const toggle=window.toggleSidebar;window.toggleSidebar=function(open){if(open)load();return toggle.apply(this,arguments);};
window.addEventListener('storage',event=>{if(event.key===key(owner())||event.key===catalogKey(owner()))load();});load();
})();
