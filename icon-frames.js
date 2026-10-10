// Material frames fit the same circular photo in profiles, friends and podiums.
(function(){
'use strict';
const names=['木','石','銅','銀','金','ダイヤ','プラチナ','ブラックダイヤ'];
const ids=['wood','stone','copper','silver','gold','diamond','platinum','black-diamond'];
const photoSizes=[91,77,78,81,76,64,66,68];
const minutes=[10,60,300,1200,3000,6000,15000,30000];
const catalog=ids.map((id,index)=>Object.freeze({id,name:names[index],seconds:minutes[index]*60,label:index===0?'10分':minutes[index]/60+'時間'}));
function totalSeconds(){const stats=typeof userStats==='object'?userStats:{};const snapshot=window.StudyTime.snapshot();return window.StudyTimeModel.rankingSeconds({...stats,study_calendar_v2:snapshot||stats.study_calendar_v2},'total',Date.now());}
function unlocked(id,seconds=totalSeconds()){const frame=catalog.find(frame=>frame.id===id);return !!frame&&seconds>=frame.seconds;}
function equipped(){const id=window.UserProfile.read().frame;return unlocked(id)?id:'';}
window.IconFrameCatalog=Object.freeze(catalog);
function decorate(element,id){element.querySelector(':scope > .icon-frame-art')?.remove();element.classList.remove('icon-framed');element.style.removeProperty('--frame-photo-size');if(!ids.includes(id))return;element.style.setProperty('--frame-photo-size',photoSizes[ids.indexOf(id)]+'%');const art=document.createElement('span');art.className='icon-frame-art frame-'+id;art.setAttribute('aria-hidden','true');element.classList.add('icon-framed');element.append(art);}
function fromAppearance(appearance){try{const profile=typeof appearance==='string'?JSON.parse(appearance):appearance;return profile?.frame||'';}catch{return '';}}
let preview='';
function photo(){return localStorage.getItem('core_v4_user_avatar_'+myId)||'';}
function identity(){const host=document.getElementById('sidebarIdentityAvatar'),name=document.getElementById('sidebarIdentityName');if(!host)return;const avatar=window.RankingVisuals.avatar(photo(),myName,JSON.stringify({frame:equipped()}));host.replaceChildren(...avatar.childNodes);decorate(host,equipped());window.RankingVisuals.name(name,myName,JSON.stringify(window.UserProfile.read()));}
const host=document.getElementById('profileFrameSelector'),status=document.getElementById('profileFrameStatus');
function render(){
 const seconds=totalSeconds(),current=equipped();
 if(!preview||!ids.includes(preview))preview=current||ids[0];
 host.replaceChildren();
 for(const frame of catalog){const available=unlocked(frame.id,seconds),button=document.createElement('button');button.type='button';button.className='frame-option'+(preview===frame.id?' selected':'');button.setAttribute('aria-pressed',String(preview===frame.id));button.setAttribute('aria-label',frame.name+'のフレーム（'+(available?'解放済み':frame.label+'で解放')+'）');const example=window.RankingVisuals.avatar(photo(),myName,JSON.stringify({frame:frame.id}));example.classList.add('frame-example');const label=document.createElement('span');label.textContent=frame.name;const amount=document.createElement('small');amount.textContent=current===frame.id?'装備中':available?'解放済み':frame.label;button.append(example,label,amount);button.onclick=()=>{preview=frame.id;status.textContent='';render();};host.append(button);}
 const selected=catalog.find(frame=>frame.id===preview),available=unlocked(preview,seconds);
 const action=document.getElementById('profileFrameAction');action.textContent=available?(current===preview?'装備中':selected.name+'を装備'):'合計 '+selected.label+' で解放';action.disabled=!available||current===preview;
 action.onclick=async()=>{if(!unlocked(preview))return;action.disabled=true;status.textContent='保存しています…';try{const profile={...window.UserProfile.read(),frame:preview};profile.updatedAt=Math.max(Date.now(),Number(profile.updatedAt||0)+1);window.UserProfile.store(profile);await window.AppStorage?.flush();window.applyProfileToUi();status.textContent='フレームを装備しました。';render();window.UserProfile.sync();}catch(error){status.textContent='保存できませんでした。もう一度お試しください。';render();}};
 // Preview is local to this popup. Shared appearance only changes after equipping.
 decorate(document.getElementById('profileAvatarPreview'),preview);
}
const originalAvatar=window.RankingVisuals.avatar;window.RankingVisuals.avatar=function(value,label,appearance){const element=originalAvatar(value,label,appearance);decorate(element,fromAppearance(appearance));return element;};
const oldUi=window.applyProfileToUi;window.applyProfileToUi=function(){const result=oldUi.apply(this,arguments);decorate(document.getElementById('profileAvatarPreview'),equipped());identity();if(document.getElementById('profileDialog').open&&host.childElementCount)render();return result;};
const oldOpen=window.openProfileDialog;window.openProfileDialog=function(){preview='';const result=oldOpen.apply(this,arguments);status.textContent='';render();return result;};
const oldSidebar=window.toggleSidebar;window.toggleSidebar=function(open){if(open)identity();return oldSidebar.apply(this,arguments);};
window.IconFrames={catalog,decorate,render,totalSeconds,unlocked,equipped};
})();
