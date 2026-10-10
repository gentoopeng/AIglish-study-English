// Static backgrounds: a bounded, shared gallery; dialogs and previews are mounted on demand.
(function(){
'use strict';
const owner=()=>typeof myId==='string'&&myId?myId:'GUEST-000',key=id=>'aiglish_app_background_'+id,catalogKey=id=>'aiglish_app_background_catalog_'+id;
const picker=document.getElementById('backgroundPickerTemplate').content.firstElementChild;
const slides=picker.querySelector('#backgroundPickerSlides');
// Static assets are available to every account without a Firestore image read.
const bundled=[
 {id:'bundled-classroom',image:'assets/background-classroom.webp',preview:'assets/background-classroom-preview.webp',position:30,bundled:true},
 {id:'bundled-mountain-lake',image:'assets/background-mountain-lake.webp',preview:'assets/background-mountain-lake-preview.webp',position:50,bundled:true},
 {id:'bundled-winter-terrace',image:'assets/background-winter-terrace.webp',preview:'assets/background-winter-terrace-preview.webp',position:60,bundled:true},
 {id:'bundled-night-cafe',image:'assets/background-night-cafe.webp',preview:'assets/background-night-cafe-preview.webp',position:40,bundled:true}
].map(Object.freeze);
const empty=()=>({mode:'default',selected:'',backgrounds:[],updatedAt:0});
const validImage=value=>typeof value==='string'&&value.length<=1000000&&/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(value);
const focus=value=>Math.max(0,Math.min(100,Number.isFinite(Number(value))?Number(value):30));
let account='',settings=empty(),saveRevision=0,loadedPreferences,loadedCatalog,loadedShared;
let backgroundUrl='',backgroundSource='',previewFrame=0;
const previews=new Map(),previewCache=new Map();
const label=item=>item.id==='default'?'いつもの背景':'背景 '+(settings.backgrounds.indexOf(item)+1);
const selected=()=>settings.backgrounds.find(item=>item.id===settings.selected);
function message(text){picker.querySelector('#backgroundPickerStatus').textContent=text;}
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
   ids.add(item.id);backgrounds.push({id:item.id==='legacy-photo'?'legacy-photo-'+encodeURIComponent(id):item.id,name:String(item.name||'背景').slice(0,24),image:item.image,preview:validImage(item.preview)?item.preview:'',position:focus(item.position)});
  }
  // Keep the previously registered photo without writing or resetting anything during startup.
  if(!backgrounds.length&&validImage(value.image))backgrounds.push({id:'legacy-photo-'+encodeURIComponent(id),name:'選んだ写真',image:value.image,preview:'',position:focus(value.position)});
  const shared=window.BackgroundCatalog?.readCache();
  if(shared){const privateItems=backgrounds.filter(item=>!shared.knownIds.includes(item.id));backgrounds.splice(0,backgrounds.length,...shared.backgrounds,...privateItems);}
  const dynamic=backgrounds.filter(item=>!bundled.some(asset=>asset.id===item.id));
  backgrounds.splice(0,backgrounds.length,...bundled,...dynamic);
  const wanted=value.selected==='legacy-photo'?'legacy-photo-'+encodeURIComponent(id):value.selected;
  const chosen=backgrounds.find(item=>item.id===wanted)||(!wanted?dynamic[0]:null);
  return {mode:value.mode==='photo'&&chosen?'photo':'default',selected:chosen?.id||value.selected||'',backgrounds,updatedAt:Number(value.updatedAt)||0};
 }catch(error){message('背景設定を読み取れませんでした。');return {...empty(),backgrounds:[...bundled]};}
}
// Revocable URLs release obsolete photo resources on switches and suspension.
function photoUrl(data){const binary=atob(data.slice(data.indexOf(',')+1)),bytes=new Uint8Array(binary.length);for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);return URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'}));}
function releaseBackground(){document.documentElement.style.setProperty('--app-background-image','none');if(backgroundUrl)URL.revokeObjectURL(backgroundUrl);backgroundUrl='';backgroundSource='';}
function renderBackground(item){
 if(document.hidden||document.documentElement.classList.contains('pwa-recovery-rendering')){releaseBackground();return;}
 const source=item?item.image:'default';if(source===backgroundSource)return;
 const previous=backgroundUrl;
 backgroundUrl=item&&!item.bundled?photoUrl(item.image):'';backgroundSource=source;
 document.documentElement.style.setProperty('--app-background-image',item?'url("'+(item.bundled?item.image:backgroundUrl)+'")':'url("assets/background-night.webp")');
 if(previous)URL.revokeObjectURL(previous);
}
function apply(){
 const item=settings.mode==='photo'?selected():null;renderBackground(item);
 document.documentElement.style.setProperty('--app-background-position',item?item.position+'% center':'center');
 slides.querySelectorAll('[data-background]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.background===(item?item.id:'default'))));
 document.getElementById('headerBackgroundButton').setAttribute('aria-label','背景を選ぶ：'+(item?label(item):'いつもの背景'));
}
function load(){
 const next=owner();if(account!==next){account=next;saveRevision++;if(picker.open)picker.close();loadedPreferences=undefined;loadedCatalog=undefined;loadedShared=undefined;previewCache.clear();message('');}
 const preferences=localStorage.getItem(key(account)),catalog=localStorage.getItem(catalogKey(account));
 const shared=localStorage.getItem(window.BackgroundCatalog.cacheKey);
 if(preferences!==loadedPreferences||catalog!==loadedCatalog||shared!==loadedShared){if(shared!==loadedShared)previewCache.clear();settings=read(account);loadedPreferences=preferences;loadedCatalog=catalog;loadedShared=shared;}apply();
 if(document.documentElement.classList.contains('pwa-recovery-rendering'))message('前回の終了を確認できなかったため、背景を一時停止しています。選び直すと再表示します。');
}
async function save(next,success='背景を保存しました。'){
 const id=account,token=++saveRevision;next.updatedAt=Math.max(Date.now(),settings.updatedAt+1);message('保存しています…');
 try{
  // Selecting a photo writes only small preferences, not the entire image gallery.
  if(!window.BackgroundCatalog.readCache()&&!localStorage.getItem(catalogKey(id)))localStorage.setItem(catalogKey(id),JSON.stringify({backgrounds:next.backgrounds.filter(item=>!item.bundled),mode:next.mode,selected:next.selected,updatedAt:next.updatedAt}));
  localStorage.setItem(key(id),JSON.stringify({mode:next.mode,selected:next.selected,updatedAt:next.updatedAt}));settings=next;loadedPreferences=localStorage.getItem(key(id));loadedCatalog=localStorage.getItem(catalogKey(id));apply();
  if(window.AppStorage)await window.AppStorage.flush();
  if(owner()!==id||token!==saveRevision)return false;
  message(success);window.queueBackgroundSave?.();return true;
 }catch(error){if(owner()===id&&token===saveRevision)message('保存できませんでした。'+error.message);console.warn('背景設定の保存に失敗しました',error);return false;}
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
  if(item.bundled){if(current())button.querySelector('img').src=item.preview;return;}
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
 refreshShared();
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
function redraw(){load();if(picker.open){releasePreviews();slides.replaceChildren(card({id:'default',position:50}),...settings.backgrounds.map(card));apply();visiblePreviews();}}
async function refreshShared(force=false){try{await window.BackgroundCatalog.refresh(force);}catch(error){message('共有背景を更新できませんでした。保存済みの背景を表示しています。');}}
window.addEventListener('background-catalog-changed',redraw);
window.onAppLoaded(()=>{load();refreshShared();});const toggle=window.toggleSidebar;window.toggleSidebar=function(open){if(open)load();return toggle.apply(this,arguments);};
window.addEventListener('pagehide',()=>{releasePreviews();releaseBackground();});
window.addEventListener('pageshow',()=>{apply();visiblePreviews();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){releasePreviews();releaseBackground();}else{apply();visiblePreviews();refreshShared();}});
window.addEventListener('storage',event=>{if(event.key===key(owner())||event.key===catalogKey(owner())||event.key===window.BackgroundCatalog.cacheKey)redraw();});load();
})();
