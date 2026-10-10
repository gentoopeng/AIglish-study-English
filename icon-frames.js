// Material frames fit the same circular photo in profiles, friends and podiums.
(function(){
'use strict';
const names=['木','石','銅','銀','金','ダイヤ','プラチナ','ブラックダイヤ'];
const ids=['wood','stone','copper','silver','gold','diamond','platinum','black-diamond'];
const photoSizes=[91,77,78,81,76,64,66,68];
const catalog=ids.map((id,index)=>Object.freeze({id,name:names[index],price:window.LearningRewardsModel.price(index)}));
window.IconFrameCatalog=Object.freeze(catalog);
function decorate(element,id){element.querySelector(':scope > .icon-frame-art')?.remove();element.classList.remove('icon-framed');element.style.removeProperty('--frame-photo-size');if(!ids.includes(id))return;element.style.setProperty('--frame-photo-size',photoSizes[ids.indexOf(id)]+'%');const art=document.createElement('span');art.className='icon-frame-art frame-'+id;art.setAttribute('aria-hidden','true');element.classList.add('icon-framed');element.append(art);}
function fromAppearance(appearance){try{const profile=typeof appearance==='string'?JSON.parse(appearance):appearance;return profile?.frame||'';}catch{return '';}}
let preview='';
const host=document.getElementById('profileFrameSelector'),status=document.getElementById('profileFrameStatus');
function render(){
 const wallet=window.LearningWallet.read(),model=window.LearningRewardsModel,current=wallet.equipped.id;
 if(!preview||!ids.includes(preview))preview=current||catalog.find(frame=>!model.owned(wallet,frame.id))?.id||ids[0];
 host.replaceChildren();
 for(const frame of catalog){const owned=model.owned(wallet,frame.id),button=document.createElement('button');button.type='button';button.className='frame-option'+(preview===frame.id?' selected':'');button.setAttribute('aria-pressed',String(preview===frame.id));button.setAttribute('aria-label',frame.name+'のフレーム'+(owned?'（購入済み）':' '+frame.price.toLocaleString('ja-JP')+'コイン'));const example=document.createElement('span');example.className='frame-example';example.textContent=typeof myName==='string'?myName.trim().slice(0,1):'人';decorate(example,frame.id);const label=document.createElement('span');label.textContent=frame.name;const amount=document.createElement('small');amount.textContent=owned?(current===frame.id?'装備中':'購入済み'):frame.price.toLocaleString('ja-JP');button.append(example,label,amount);button.onclick=()=>{preview=frame.id;status.textContent='';render();};host.append(button);}
 const selected=catalog.find(frame=>frame.id===preview),index=catalog.indexOf(selected),owned=model.owned(wallet,preview),allowed=index===0||model.owned(wallet,catalog[index-1].id);
 const action=document.getElementById('profileFrameAction');action.textContent=owned?(current===preview?'装備中':selected.name+'を装備'):(allowed?selected.name+'を '+selected.price.toLocaleString('ja-JP')+' コインで購入':catalog[index-1].name+'の購入後にアップグレード');action.disabled=owned?current===preview:!allowed||model.balance(wallet)<selected.price;
 action.onclick=async()=>{action.disabled=true;status.textContent='保存しています…';try{if(owned)await window.LearningWallet.equip(preview);else await window.LearningWallet.purchase(preview);status.textContent=owned?'フレームを装備しました。':'購入して装備しました。';window.applyProfileToUi();render();}catch(error){status.textContent=error.message;render();}};
 // Preview is local to this popup. Shared appearance only changes after purchase/equip commits.
 decorate(document.getElementById('profileAvatarPreview'),preview);
}
const originalAvatar=window.RankingVisuals.avatar;window.RankingVisuals.avatar=function(value,label,appearance){const element=originalAvatar(value,label,appearance);decorate(element,fromAppearance(appearance));return element;};
const oldUi=window.applyProfileToUi;window.applyProfileToUi=function(){const result=oldUi.apply(this,arguments);decorate(document.getElementById('profileAvatarPreview'),window.LearningWallet.read().equipped.id);return result;};
const oldOpen=window.openProfileDialog;window.openProfileDialog=function(){preview='';const result=oldOpen.apply(this,arguments);status.textContent='';render();return result;};
window.IconFrames={catalog,decorate,render};
})();
