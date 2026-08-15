// =====================================================================
// addon.js 現在コード（間違えポップは完全に削除済み／それ以外は全維持）
// 読み込み順: app.js → fix.js → multi.js → addon.js
// =====================================================================

// ============ ① キャラ追加/スキル（安全版） ============
(function applyCharAddPatch(){
"use strict";
if(window.__charAddApplied) return; window.__charAddApplied=true;
var CHSTATS={
tangon:{hp:3500,atk:300,rarity:'SR',img:'tangon.png',name:'タンゴン',s1:'山陰の風',s2:'タンゴフラッシュ'},
kasinhuu:{hp:3000,atk:350,rarity:'SR',img:'kasinhuu.png',name:'カシンフウ',s1:'開花',s2:'花の知らせ',comboCharge:10}
};
window.__charStats=CHSTATS;
window.PARTY_CHARS=[
{id:'tangon',name:'タンゴン',emoji:'🐧',img:'tangon.png',rarity:'SR',hp:3500,atkMul:1.0,comboRate:1.0,skill:'山陰の風',ultimate:'タンゴフラッシュ',desc:'薔薇をくわえてタンゴを踊る伝説の修行者。'},
{id:'kasinhuu',name:'カシンフウ',emoji:'🌸',img:'kasinhuu.png',rarity:'SR',hp:3000,atkMul:1.2,comboRate:1.0,skill:'開花',ultimate:'花の知らせ',desc:'花を操る修行者。与えたダメージの半分を自身へ還元する。'}
];
function activeCharId(){ try{ return (typeof activeCharacter!=='undefined'&&activeCharacter)?activeCharacter:'tangon'; }catch(e){ return 'tangon'; } }
function meMember(){ try{ return multiPartyMembers.find(function(m){return m.isMe;}); }catch(e){ return null; } }
/* タンゴン スキル1：開始時 味方HP+10% */
var __origStart=window.startMultiBattlePlay;
window.startMultiBattlePlay=function(){
var r=__origStart?__origStart.apply(this,arguments):undefined;
window.__enemyStunUntil=0;
try{
if(activeCharId()==='tangon'){
multiPartyMembers.forEach(function(m){ var nh=Math.round(m.maxHp*1.1); m.maxHp=nh; m.hp=nh; });
try{window.renderMultiParty();}catch(e){}
try{window.updateMultiHpBars();}catch(e){}
}
}catch(e){}
return r;
};
/* 攻撃/スキル（元処理の後だけ・判定/進行には触らない） */
var __prevFlick=window.processMultiFlickAnswer;
var __lastFlickAt=0;
window.processMultiFlickAnswer=function(ci){
var now=Date.now();
if(now-__lastFlickAt<600){ return; }
__lastFlickAt=now;
var chId=activeCharId();
var st=CHSTATS[chId]||CHSTATS.tangon;
var M0=window.__multi2||null;
var gBefore=M0?M0.comboGauge:0;
var comboMax=M0?M0.comboMax:100;
var correct=false;
try{ correct=(typeof currentMultiCorrectIndex!=='undefined')&&(ci===currentMultiCorrectIndex); }catch(e){}
var r=__prevFlick?__prevFlick.apply(this,arguments):undefined;
try{
if(correct){
var comboMulti=1+Math.floor(((typeof gameComboCount!=='undefined')?gameComboCount:0)/5)*0.5;
var extra=(st.atk-300)*comboMulti;
if(extra!==0&&typeof multiBossHp==='number'){
multiBossHp=Math.max(0,multiBossHp-extra);
try{ var c=M0?M0.current:null; if(c)c.hp=multiBossHp; }catch(e){}
try{window.updateMultiHpBars();}catch(e){}
}
var me=meMember();
var dealt=st.atk*comboMulti;
if(chId==='kasinhuu'&&me&&me.hp>0){
var heal=Math.round(dealt*0.5);
me.hp=Math.min(me.maxHp,me.hp+heal);
try{window.updateMultiHpBars();}catch(e){}
}
if(chId==='kasinhuu'&&(typeof gameComboCount!=='undefined')&&gameComboCount>=(st.comboCharge||10)){
if(M0&&M0.comboGauge<M0.comboMax){
M0.comboGauge=M0.comboMax;
if(me){ var h3=Math.round(me.hp/3);
try{ multiPartyMembers.forEach(function(m){ if(m.hp>0){ m.hp=Math.min(m.maxHp,m.hp+h3); } }); }catch(e){}
try{window.updateMultiHpBars();}catch(e){}
}
}
}
var gAfter=M0?M0.comboGauge:0;
var burst=(gBefore>=comboMax)&&gAfter===0;
if(burst&&chId==='tangon'){
var want=Math.round(st.atk*3.5);
if(typeof multiBossHp==='number'){
multiBossHp=Math.max(0,multiBossHp+(5000-want));
try{ var cc=M0?M0.current:null; if(cc)cc.hp=multiBossHp; }catch(e){}
try{window.updateMultiHpBars();}catch(e){}
}
window.__enemyStunUntil=Date.now()+3500;
try{ multiEnemyTimeLeft=10; }catch(e){}
}
}
}catch(e){}
return r;
};
/* 敵攻撃：怯え中は攻撃しない */
var __prevTimer=window.handleMultiBattleTimer;
window.handleMultiBattleTimer=function(){
if((window.__enemyStunUntil||0)>Date.now()){
try{
if(typeof multiEnemyTimeLeft==='number'){
multiEnemyTimeLeft-=0.1;
if(multiEnemyTimeLeft<=0){ multiEnemyTimeLeft=10; }
var td=document.getElementById('multiEnemyTimerDisplay');
if(td)td.innerText='行動: '+Math.max(0,multiEnemyTimeLeft).toFixed(1)+'秒';
}
try{window.updateMultiHpBars();}catch(e){}
}catch(e){}
return;
}
return __prevTimer?__prevTimer.apply(this,arguments):undefined;
};
console.log('🌸 キャラ追加パッチ(安全版)適用完了');
})();

// ============ ② 図鑑強化（全キャラ対応） ============
(function applyCharDexPatch2(){
"use strict";
if(window.__charDex2) return; window.__charDex2=true;
var CHMETA={
tangon:{hp:3500,atk:300,comboNeed:10,name:'タンゴン',rarity:'SR',s1:{n:'山陰の風',d:'味方全員のHP上限を10%上昇させる。'},s2:{n:'タンゴフラッシュ',d:'攻撃力の3.5倍のダメージを与え、敵を3.5秒怯ませる。'}},
kasinhuu:{hp:3000,atk:350,comboNeed:10,name:'カシンフウ',rarity:'SR',s1:{n:'開花',d:'与えたダメージの50%分、自身を回復する。'},s2:{n:'花の知らせ',d:'味方全員のHPを自身のHPの1/3分回復する。'}},
ch_r01:{hp:2800,atk:220,comboNeed:9,name:'炎騎士',rarity:'R',s1:{n:'火炎斬り',d:'炎を纏った斬撃で敵を焼く。'},s2:{n:'業火の乱舞',d:'業火の連撃で敵を焼き尽くす。'}},
ch_uc01:{hp:1200,atk:140,comboNeed:9,name:'見習い魔導士',rarity:'UC',s1:{n:'魔力の矢',d:'魔力の矢で敵を貫く。'},s2:{n:'詠唱強化',d:'詠唱を強化し次の攻撃を高める。'}}
};
var RDEF={C:{hp:1000,atk:120},UC:{hp:1200,atk:140},R:{hp:2800,atk:220},SR:{hp:3500,atk:300}};
window.__charMeta=CHMETA;
(function(){if(document.getElementById('chdexCss2'))return;var s=document.createElement('style');s.id='chdexCss2';s.textContent=[
'.gm-cell img{width:74px !important;height:74px !important;object-fit:cover;border-radius:12px;}',
'.pty-card img{width:64px !important;height:64px !important;object-fit:cover;}',
'.ch-skilldetail{margin-top:6px;padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.4);border:1px solid rgba(245,196,81,.4);font-size:11px;color:#fde68a;line-height:1.5;}',
'.pty-skills button,.pty-skills span{cursor:pointer;}'
].join('\n');(document.head||document.documentElement).appendChild(s);})();
function ownedChars(){
var arr=['tangon'];
try{
if(typeof userStats!=='undefined'&&userStats){
var o=userStats.gacha_owned_chars||userStats.gacha_owned||userStats.owned_chars||[];
if(typeof o==='string'){try{o=JSON.parse(o);}catch(e){o=[];}}
if(Array.isArray(o)) o.forEach(function(x){if(arr.indexOf(x)<0)arr.push(x);});
}
}catch(e){}
return arr;
}
function charIdOf(el){
var a=(el.getAttribute&&(el.getAttribute('data-card')||el.getAttribute('data-pcvcard')||el.getAttribute('data-gm')))||'';
if(a&&a.indexOf('char_')===0)return a.slice(5);
return null;
}
function nameToId(){
var map={};
for(var k in CHMETA)map[CHMETA[k].name]=k;
try{(window.PARTY_CHARS||[]).forEach(function(c){map[c.name]=c.id;});}catch(e){}
document.querySelectorAll('[data-card^="char_"],[data-pcvcard^="char_"]').forEach(function(c){
var id=charIdOf(c);if(!id)return;
var nm=c.querySelector('.gm-name,.pty-card-name,.gcx-name');
var t=nm?nm.textContent.trim():((c.textContent||'').trim().split('\n')[0]);
if(t)map[t]=id;
});
return map;
}
function activeId(){
var map=nameToId();
var leaf=document.querySelectorAll('div,span,h1,h2,h3,b');
for(var i=0;i<leaf.length;i++){
var el=leaf[i];if(el.children.length>0)continue;
var t=(el.textContent||'').trim();
if(map[t])return map[t];
}
return null;
}
function readRarity(){
var leaf=document.querySelectorAll('div,span');
for(var i=0;i<leaf.length;i++){
if((leaf[i].textContent||'').trim()==='レアリティ'){
var v=leaf[i].nextElementSibling;if(v)return (v.textContent||'C').trim();
}
}
return 'C';
}
function statsFor(id){
if(CHMETA[id])return CHMETA[id];
if(window.__charStats&&window.__charStats[id])return window.__charStats[id];
var d=RDEF[readRarity()]||RDEF.C;
return {hp:d.hp,atk:d.atk,comboNeed:9,s1:{n:'スキル',d:'スキル。'},s2:{n:'奥義',d:'奥義。'}};
}
function hideUnowned(){
var owned=ownedChars();
document.querySelectorAll('.gm-cell,[data-card^="char_"],[data-pcvcard^="char_"]').forEach(function(c){
var id=charIdOf(c);if(!id)return;
c.style.display=(owned.indexOf(id)>=0)?'':'none';
});
}
function fixStats(m){
document.querySelectorAll('div,span').forEach(function(el){
if(el.children.length>0)return;
var t=(el.textContent||'').trim();
if(t==='攻撃倍率'){el.textContent='攻撃';var v=el.nextElementSibling;if(v)v.textContent=String(m.atk);}
if(t==='コンボ率'){el.textContent='スキルゲージ';var v2=el.nextElementSibling;if(v2)v2.textContent='COMBO '+m.comboNeed;}
});
}
function bindSkills(m){
var sk=document.querySelector('.pty-skills');if(!sk)return;
var btns=sk.querySelectorAll('button,span');
btns.forEach(function(b,idx){
if(b.__sk2)return;b.__sk2=true;
var name=(b.textContent||'').trim();
var skill=(idx===0)?(m.s1||{n:name,d:name}):(m.s2||{n:name,d:name});
b.addEventListener('click',function(e){
e.stopPropagation();
var host=sk.parentNode;
var det=host.querySelector('.ch-skilldetail');
if(!det){det=document.createElement('div');det.className='ch-skilldetail';host.insertBefore(det,sk.nextSibling);}
if(det.dataset.for===skill.n&&det.style.display!=='none'){det.style.display='none';}
else{det.style.display='';det.dataset.for=skill.n;det.innerHTML='<b>'+skill.n+'</b>：'+skill.d;}
});
});
}
function tick(){
hideUnowned();
var id=activeId();if(!id)return;
var m=statsFor(id);
fixStats(m);
bindSkills(m);
}
setInterval(tick,500);
console.log('📚 図鑑強化パッチv2適用完了');
})();

// ============ ③ グリッド修正 ============
(function applyGridFixPatch(){
"use strict";
if(window.__gridFixApplied) return; window.__gridFixApplied=true;
(function(){if(document.getElementById('gridFixCss'))return;var s=document.createElement('style');s.id='gridFixCss';s.textContent=[
'.gm-cell-star{position:static !important;transform:none !important;margin-top:2px;letter-spacing:1px;}',
'.gm-cell{gap:4px !important;}',
'.gm-skill-detail{margin-top:6px;padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.4);border:1px solid rgba(245,196,81,.4);font-size:11px;color:#fde68a;line-height:1.5;}'
].join('\n');(document.head||document.documentElement).appendChild(s);})();
var META={
tangon:{name:'タンゴン',hp:3500,atk:300,def:0,img:'tangon.png',emoji:'🐧'},
kasinhuu:{name:'カシンフウ',hp:3000,atk:350,def:0,img:'kasinhuu.png',emoji:'🌸'},
ch_r01:{name:'炎騎士',hp:2800,atk:220,def:0},
ch_uc01:{name:'見習い魔導士',hp:1200,atk:140,def:0}
};
function statsOf(id){ return META[id]||{hp:0,atk:0,def:0}; }
function findChar(id){
if(META[id]) return META[id];
try{ if(window.PARTY_CHARS){ for(var i=0;i<window.PARTY_CHARS.length;i++){ if(window.PARTY_CHARS[i]&&window.PARTY_CHARS[i].id===id) return window.PARTY_CHARS[i]; } } }catch(e){}
return null;
}
function sortGrid(key){
var grid=document.querySelector('.gm-grid'); if(!grid) return;
var cells=[].slice.call(grid.querySelectorAll('.gm-cell'));
if(!cells.length) return;
cells.sort(function(a,b){
if(key==='no') return (+a.getAttribute('data-gmidx'))-(+b.getAttribute('data-gmidx'));
var sa=statsOf(a.getAttribute('data-gmid')), sb=statsOf(b.getAttribute('data-gmid'));
return (sb[key]||0)-(sa[key]||0);
});
cells.forEach(function(c){ grid.appendChild(c); });
}
document.addEventListener('click',function(e){
var t=e.target; if(!t||!t.closest) return;
var chip=t.closest('[data-uni-sort]')||t.closest('[data-gmsort]');
if(chip){ var key=chip.getAttribute('data-uni-sort')||chip.getAttribute('data-gmsort'); setTimeout(function(){sortGrid(key);},60); setTimeout(function(){sortGrid(key);},220); }
},true);
function fixCharSlot(){
var host=document.getElementById('ptyEquipSlots'); if(!host) return;
var slot=host.querySelector('[data-slot="char"]'); if(!slot) return;
var id=(typeof activeCharacter!=='undefined'&&activeCharacter)?String(activeCharacter):'';
var ch=findChar(id);
var ico=slot.querySelector('.pty-slot-ico'), name=slot.querySelector('.pty-slot-name'), act=slot.querySelector('.pty-slot-act');
if(ch){
if(ico) ico.innerHTML=ch.img?'<img src="'+ch.img+'" alt="" style="width:100%;height:100%;object-fit:cover;">':(ch.emoji||'🐧');
if(name) name.textContent=ch.name||'';
slot.classList.add('filled');
if(act) act.textContent='外す';
}else{
if(ico) ico.innerHTML='🫙';
if(name) name.textContent='未編成';
slot.classList.remove('filled');
}
}
function fixBattleIcon(){
var id=(typeof activeCharacter!=='undefined'&&activeCharacter)?String(activeCharacter):'';
var ch=findChar(id); if(!ch||!ch.img) return;
var me=document.querySelector('.multi-party-member.m2-me .multi-party-icon');
if(me) me.innerHTML='<img src="'+ch.img+'" alt="" style="width:100%;height:100%;object-fit:cover;">';
}
var __origSelChar=window.selectCharacter;
window.selectCharacter=function(){
var r=__origSelChar?__origSelChar.apply(this,arguments):undefined;
setTimeout(fixCharSlot,50);
setTimeout(function(){ if(document.body.classList.contains('in-game-active')){ try{ if(window.renderMultiParty) window.renderMultiParty(); }catch(e){} setTimeout(fixBattleIcon,60); } },80);
return r;
};
var __origRenderParty=window.renderMultiParty;
window.renderMultiParty=function(){
var r=__origRenderParty?__origRenderParty.apply(this,arguments):undefined;
setTimeout(fixBattleIcon,40); setTimeout(fixCharSlot,40);
return r;
};
setInterval(function(){
var v=document.getElementById('view-party');
if(v&&v.classList.contains('active')) fixCharSlot();
},800);
console.log('🎴 グリッド修正パッチ適用完了');
})();

// ============ ④ 名前見切れ修正 ============
(function applyGmCellNameFix(){
"use strict";
if(window.__gmCellNameFix) return; window.__gmCellNameFix=true;
(function(){
if(document.getElementById('gmNameFixCss')) return;
var s=document.createElement('style'); s.id='gmNameFixCss';
s.textContent=[
'.gm-cell{aspect-ratio:auto !important;height:auto !important;min-height:122px;overflow:visible !important;justify-content:center !important;gap:5px !important;padding:10px 6px 8px !important;}',
'.gm-cell-icon{font-size:40px !important;}',
'.gm-cell-icon img{width:58px !important;height:58px !important;}',
'.gm-cell-name{white-space:normal !important;line-height:1.25 !important;overflow:visible !important;margin-top:2px;max-width:100%;}',
'.gm-cell-star{position:static !important;transform:none !important;margin-top:1px;}'
].join('\n');
(document.head||document.documentElement).appendChild(s);
})();
console.log('🔧 名前見切れ修正パッチ適用完了');
})();

// ============ ⑤ セーブ削減 ============
(function applySaveReducePatch(){
"use strict";
if(window.__saveReduceApplied) return; window.__saveReduceApplied=true;
try{ if(window.__autoSaveTimer){ clearInterval(window.__autoSaveTimer); window.__autoSaveTimer=null; } }catch(e){}
var bootAt=Date.now();
var lastStats=0, lastVocab=0;
window.__saveDirty=false;
var origStats=window.saveUserStats;
var origVocab=window.saveVocabToStorage;
function doStats(){ if(origStats){ try{ origStats(); }catch(e){} } }
function doVocab(){ if(origVocab){ try{ origVocab(); }catch(e){} } }
window.saveUserStats=function(){
var now=Date.now();
if(now-bootAt<5000){ window.__saveDirty=true; return; }
if(now-lastStats>20000){ lastStats=now; doStats(); }
else window.__saveDirty=true;
};
window.saveVocabToStorage=function(){
var now=Date.now();
if(now-bootAt<5000){ window.__saveDirty=true; return; }
if(now-lastVocab>20000){ lastVocab=now; doVocab(); }
else window.__saveDirty=true;
};
function flush(){
if(!window.__saveDirty) return;
window.__saveDirty=false;
lastStats=Date.now(); lastVocab=Date.now();
doStats(); doVocab();
}
window.__saveFlush=flush;
['showMultiResult','cancelMultiBattlePlay','endGame'].forEach(function(fn){
var orig=window[fn];
if(typeof orig==='function'){
window[fn]=function(){ var r=orig.apply(this,arguments); setTimeout(flush,100); return r; };
}
});
document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='hidden') flush(); });
window.addEventListener('pagehide',flush);
setInterval(function(){
if(window.__saveDirty && Date.now()-Math.max(lastStats,lastVocab)>60000){ flush(); }
},10000);
console.log('💾 セーブ削減パッチ適用完了');
})();

// ============ ⑦ 回復/スキル2演出＋討伐是正（間違えポップは無し） ============
(function applyBattleFxPatch(){
"use strict";
if(window.__battleFxApplied) return; window.__battleFxApplied=true;
(function(){
if(document.getElementById('bfxCss'))return;
var s=document.createElement('style');s.id='bfxCss';
s.textContent=[
'.bfx-heal{position:fixed;z-index:347;pointer-events:none;font-weight:900;color:#6ee7b7;font-size:20px;text-shadow:0 0 10px rgba(16,185,129,.9);transform:translate(-50%,-50%);animation:bfxHeal 1s ease-out forwards;}',
'@keyframes bfxHeal{0%{transform:translate(-50%,-40%);opacity:0}20%{opacity:1}100%{transform:translate(-50%,-160%);opacity:0}}',
'.bfx-glow{position:fixed;inset:0;z-index:336;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 40%,rgba(255,246,214,.55),rgba(255,214,130,.3) 45%,transparent 75%);animation:bfxGlow .9s ease forwards;}',
'@keyframes bfxGlow{0%{opacity:0}25%{opacity:.6}100%{opacity:0}}',
'.bfx-petal{position:fixed;top:-20px;z-index:345;pointer-events:none;width:12px;height:12px;border-radius:60% 0 60% 0;background:rgba(244,114,182,.85);animation:bfxPetal linear forwards;}',
'@keyframes bfxPetal{0%{transform:translateY(-10px) rotate(0);opacity:0}10%{opacity:.95}100%{transform:translateY(105vh) rotate(340deg);opacity:0}}'
].join('\n');
(document.head||document.documentElement).appendChild(s);
})();
function healNum(memberId,amount){
var mel=document.getElementById('partyMember-'+memberId);
if(!mel||!mel.getBoundingClientRect)return;
var r=mel.getBoundingClientRect();
var p=document.createElement('div');
p.className='bfx-heal';
p.style.left=(r.left+r.width/2)+'px';
p.style.top=(r.top+r.height/2)+'px';
p.textContent='+'+amount;
document.body.appendChild(p);
setTimeout(function(){if(p.parentNode)p.parentNode.removeChild(p);},1000);
}
function glowFx(){
var g=document.createElement('div');g.className='bfx-glow';
document.body.appendChild(g);
setTimeout(function(){if(g.parentNode)g.parentNode.removeChild(g);},900);
}
function petalFx(){
for(var i=0;i<14;i++){
var p=document.createElement('span');p.className='bfx-petal';
p.style.left=(Math.random()*100)+'%';
p.style.animationDuration=(1.4+Math.random()*1.2)+'s';
p.style.animationDelay=(Math.random()*0.4)+'s';
document.body.appendChild(p);
setTimeout(function(){if(p.parentNode)p.parentNode.removeChild(p);},2800);
}
}
/* HP増加を検知して回復演出 */
var lastHp={};
setInterval(function(){
try{
if(typeof multiPartyMembers==='undefined'||!multiPartyMembers)return;
multiPartyMembers.forEach(function(m){
var prev=lastHp[m.id];
if(prev!=null&&m.hp>prev)healNum(m.id,m.hp-prev);
lastHp[m.id]=m.hp;
});
}catch(e){}
},300);
/* ゲージMAXでキャラ別スキル2演出 */
var __prevFlickFx=window.processMultiFlickAnswer;
window.processMultiFlickAnswer=function(ci){
var M=window.__multi2||null;
var gBefore=M?M.comboGauge:0;
var maxG=M?M.comboMax:100;
var r=__prevFlickFx?__prevFlickFx.apply(this,arguments):undefined;
var gAfter=M?M.comboGauge:0;
if(gBefore<maxG&&gAfter>=maxG){
var ch=(typeof activeCharacter!=='undefined'&&activeCharacter)?activeCharacter:'tangon';
if(ch==='kasinhuu')petalFx(); else glowFx();
}
return r;
};
console.log('🎆 回復/スキル2演出パッチ適用完了（間違えポップ無し）');
})();
// =====================================================================
// 🎭 状態異常エフェクトライブラリ（統合版・addon.js末尾追記）
//   回復/痺れ/怯え/強化/弱化/暗闇/覚醒/回避 の定義＋演出＋簡易メカニクス
//   使い方: window.__statusFx.apply(対象,'状態ID',継続ms)
//     対象: 'boss' / 'self' / 味方id
// =====================================================================
(function applyStatusFxLibrary(){
"use strict";
if(window.__statusFxLib) return; window.__statusFxLib=true;
var STATUS={
heal:{name:'回復',icon:'✚',color:'#6ee7b7',desc:'HPを回復する'},
paralyze:{name:'痺れ',icon:'⚡',color:'#9ff3ff',desc:'行動不能。何もできなくなる'},
fear:{name:'怯え',icon:'🌑',color:'#a855f7',desc:'痺れ＋ステータスダウン'},
buff:{name:'強化',icon:'🔥',color:'#fb923c',desc:'ステータス上昇'},
debuff:{name:'弱化',icon:'🌀',color:'#3b82f6',desc:'ステータス下降'},
dark:{name:'暗闇',icon:'🌫',color:'#334155',desc:'攻撃が50%の確率でしか当たらなくなる'},
awake:{name:'覚醒',icon:'✨',color:'#fde047',desc:'攻撃が連続発生(50%→25%→12.5%…)'},
dodge:{name:'回避',icon:'💨',color:'#7dd3fc',desc:'50%の確率で攻撃を避ける'}
};
var state={}; // {target:{status:until}}
/* CSS */
(function(){if(document.getElementById('sfxCss'))return;var s=document.createElement('style');s.id='sfxCss';s.textContent=[
'.sfx-aura{position:absolute;inset:-6px;border-radius:16px;pointer-events:none;z-index:5;}',
'.sfx-aura.boss{inset:-14px;border-radius:50%;}',
'@keyframes sfxPara{0%,100%{box-shadow:0 0 4px 1px rgba(159,243,255,.5)}50%{box-shadow:0 0 16px 5px rgba(159,243,255,.95)}}',
'.sfx-aura.paralyze{animation:sfxPara .45s linear infinite;}',
'@keyframes sfxFear{0%,100%{box-shadow:0 0 10px 3px rgba(168,85,247,.45)}50%{box-shadow:0 0 24px 8px rgba(88,28,135,.85)}}',
'.sfx-aura.fear{animation:sfxFear 1.1s ease-in-out infinite;background:radial-gradient(circle,rgba(30,27,75,.4),transparent 70%);}',
'@keyframes sfxBuff{0%,100%{box-shadow:0 0 8px 2px rgba(251,146,60,.5)}50%{box-shadow:0 -8px 20px 6px rgba(249,115,22,.9)}}',
'.sfx-aura.buff{animation:sfxBuff .7s ease-in-out infinite;}',
'@keyframes sfxDebuff{0%,100%{box-shadow:0 0 8px 2px rgba(59,130,246,.5)}50%{box-shadow:0 8px 18px 6px rgba(37,99,235,.85)}}',
'.sfx-aura.debuff{animation:sfxDebuff .9s ease-in-out infinite;background:radial-gradient(circle,rgba(30,64,175,.35),transparent 70%);}',
'.sfx-aura.dark{background:radial-gradient(circle,rgba(2,6,23,.8),rgba(2,6,23,.35) 60%,transparent 80%);animation:sfxDark 1.3s ease-in-out infinite;}',
'@keyframes sfxDark{0%,100%{opacity:.55}50%{opacity:.9}}',
'@keyframes sfxAwake{0%,100%{box-shadow:0 0 8px 2px rgba(253,224,71,.5)}50%{box-shadow:0 0 26px 9px rgba(250,204,21,.95)}}',
'.sfx-aura.awake{animation:sfxAwake .7s ease-in-out infinite;}',
'@keyframes sfxDodge{0%,100%{box-shadow:0 0 6px 2px rgba(125,211,252,.4)}50%{box-shadow:-8px 0 18px 4px rgba(125,211,252,.85),8px 0 18px 4px rgba(186,230,253,.5)}}',
'.sfx-aura.dodge{animation:sfxDodge .8s ease-in-out infinite;}',
'.sfx-pop{position:fixed;pointer-events:none;z-index:360;font-weight:900;transform:translate(-50%,-50%);animation:sfxPop 1s ease-out forwards;}'
,'@keyframes sfxPop{0%{transform:translate(-50%,-40%) scale(.7);opacity:0}20%{opacity:1}100%{transform:translate(-50%,-160%) scale(1);opacity:0}}'
].join('\n');document.head.appendChild(s);})();
function targetEl(t){
if(t==='boss'){return document.getElementById('multiBossImage')||document.getElementById('m2BossSigil');}
if(t==='self'){var me=(typeof multiPartyMembers!=='undefined')?multiPartyMembers.find(function(m){return m.isMe;}):null;return me?document.getElementById('partyMember-'+me.id):null;}
return document.getElementById('partyMember-'+t);
}
function spawnPop(el,st){
if(!el||!el.getBoundingClientRect)return;
var r=el.getBoundingClientRect(),S=STATUS[st];
var p=document.createElement('div');p.className='sfx-pop';
p.style.left=(r.left+r.width/2)+'px';p.style.top=(r.top+r.height/2)+'px';
p.style.color=S.color;p.style.textShadow='0 0 10px '+S.color;
p.textContent=S.icon+' '+S.name;
document.body.appendChild(p);
setTimeout(function(){if(p.parentNode)p.parentNode.removeChild(p);},1000);
}
function auraOn(el,st){
if(!el)return;
if(getComputedStyle(el).position==='static')el.style.position='relative';
auraOff(el,st);
var a=document.createElement('div');
a.className='sfx-aura '+st+(el.id&&el.id.indexOf('Boss')>=0?' boss':'');
a.dataset.sfx=st;
el.appendChild(a);
}
function auraOff(el,st){
if(!el)return;
el.querySelectorAll('.sfx-aura'+(st?'[data-sfx="'+st+'"]':'')).forEach(function(a){if(a.parentNode)a.parentNode.removeChild(a);});
}
window.__statusFx={
STATUS:STATUS,
apply:function(t,st,dur){
dur=dur||5000;
state[t]=state[t]||{};
state[t][st]=Date.now()+dur;
var el=targetEl(t);
spawnPop(el,st);
if(st!=='heal')auraOn(el,st);
},
has:function(t,st){var s=state[t];return !!(s&&s[st]&&s[st]>Date.now());},
remove:function(t,st){if(state[t])delete state[t][st];auraOff(targetEl(t),st);}
};
/* ---- 簡易メカニクス（敵ターン） ---- */
var __prevTimer=window.handleMultiBattleTimer;
window.handleMultiBattleTimer=function(){
try{
if(window.__statusFx.has('boss','paralyze')||window.__statusFx.has('boss','fear')){
// 行動不能：攻撃しない
try{if(typeof multiEnemyTimeLeft==='number'){multiEnemyTimeLeft-=0.1;if(multiEnemyTimeLeft<=0)multiEnemyTimeLeft=10;var td=document.getElementById('multiEnemyTimerDisplay');if(td)td.innerText='行動: '+Math.max(0,multiEnemyTimeLeft).toFixed(1)+'秒(行動不能)';}}catch(e){}
return;
}
}catch(e){}
return __prevTimer?__prevTimer.apply(this,arguments):undefined;
};
console.log('🎭 状態異常エフェクトライブラリ適用完了');
})();
// =====================================================================
// ⚔️ 判定2回出し根治パッチ（1タップ=1判定を保証）
//   原因①: touchendで答えた後に合成clickが別判定として飛び込む
//   原因②: タップとフリックが同一タップで二重発火
//   対策: (a) 選択肢へのclickは全て遮断（touchend側で既に解答済み）
//         (b) 700msロックで1タップ1判定を保証
//   ※判定ロジック自体は一切変更しない（遮断と間隔制御のみ）
// =====================================================================
(function applyDoubleJudgmentFix() {
  "use strict";
  if (window.__doubleJudgmentFixed) return;
  window.__doubleJudgmentFixed = true;
  
  // (a) 選択肢への合成clickをwindowキャプチャで完全遮断
  //     （windowキャプチャはdocumentキャプチャより先に走る＝multi.jsのclickハンドラより前に止められる）
  window.addEventListener('click', function(e) {
    var t = e.target;
    if (t && t.closest && t.closest('.flick-choice')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
  
  // (b) 1タップ1判定ロック（700ms以内の2回目は無視）
  var LOCK = 700;
  var last = 0;
  var orig = window.processMultiFlickAnswer;
  window.processMultiFlickAnswer = function(ci) {
    var now = Date.now();
    if (now - last < LOCK) { return; } // 2回目の判定を捨てる
    last = now;
    return orig ? orig.apply(this, arguments) : undefined;
  };
  console.log('⚔️ 判定2回出し根治パッチ適用完了');
})();