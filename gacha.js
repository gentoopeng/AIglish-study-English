// =====================================================================
// gacha.js —— 完全統合版（三門の神託＋派手演出＋管理者ツール＋バトル演出）
//   読込順: app.js → fix.js → multi.js → gacha.js（最後に）
//   これ1本で完結。gacha.css / gacha-admin.js / fx2.js は不要。
// =====================================================================
(function () {
"use strict";
if (window.__gachaAllApplied) return;
window.__gachaAllApplied = true;

/* =====================================================================
★★★ 1.【ここを編集】設定 ★★★
===================================================================== */
var CONFIG = {
  charGold1: 300, charGold10: 2700,
  itemGold1: 200, itemGold10: 1800,
  ticket10: 9,
  pityMax: 100,
  ratesGold:   { C: 60, UC: 30, R: 9,  SR: 1  },
  ratesTicket: { C: 30, UC: 40, R: 20, SR: 10 },
  shardDupe: { C: 1, UC: 3, R: 10, SR: 50 },
  enhanceCostBase: 1,
  enhanceStatPerLevel: 1,
  loginGold: 50,
  loginSaturdayTickets: 1,
  streakDay: 7,
  streakTickets: 1,
  teaseRate: 0.3
};

/* =====================================================================
★★★ 2.【ここを編集】アイテムプール ★★★
===================================================================== */
var POOL = {
  chars: [
    { id: 'tangon',  name: 'タンゴン',           rarity: 'SR', icon: 'img:tangon.png', stat: { label: 'HP上限', value: 3500 }, desc: '伝説のダンサー。' },
    { id: 'ch_r01',  name: 'Placeholder・炎騎士', rarity: 'R',  icon: '🔥', stat: { label: '攻撃力', value: 220 }, desc: '※仮キャラ' },
    { id: 'ch_uc01', name: 'Placeholder・見習い', rarity: 'UC', icon: '🧙', stat: { label: 'HP上限', value: 1200 }, desc: '※仮キャラ' },
    { id: 'ch_c01',  name: 'Placeholder・門番',   rarity: 'C',  icon: '💂', stat: { label: 'HP上限', value: 800 },  desc: '※仮キャラ' }
  ],
  weapons: [
    { id: 'fire_sword', name: '業火の大剣',        rarity: 'R',  icon: '🔥️', stat: { label: '攻撃力', value: 150 }, desc: '炎を纏う大剣。' },
    { id: 'wp_uc01',    name: 'Placeholder・短剣', rarity: 'UC', icon: '🗡️',  stat: { label: '攻撃力', value: 80 },  desc: '※仮武器' },
    { id: 'wp_c01',     name: 'Placeholder・棍棒', rarity: 'C',  icon: '🏏',  stat: { label: '攻撃力', value: 40 },  desc: '※仮武器' }
  ],
  armors: [
    { id: 'cosmic_shield', name: '星屑の盾',        rarity: 'R',  icon: '🔮️', stat: { label: '防御力', value: 80 }, desc: '星の欠片の盾。' },
    { id: 'ar_uc01',       name: 'Placeholder・軽鎧', rarity: 'UC', icon: '🥋',  stat: { label: '防御力', value: 45 }, desc: '※仮防具' },
    { id: 'ar_c01',        name: 'Placeholder・布盾', rarity: 'C',  icon: '🛡️',  stat: { label: '防御力', value: 20 }, desc: '※仮防具' }
  ]
};
var RAR = {
  C:  { name: 'コモン', full: 'COMMON', rgb: '148,163,184', hex: '#94A3B8' },
  UC: { name: 'アンコモン', full: 'UNCOMMON', rgb: '0,240,255', hex: '#00F0FF' },
  R:  { name: 'レア', full: 'RARE', rgb: '249,115,22', hex: '#FB923C' },
  SR: { name: 'スーパーレア', full: 'SUPER RARE', rgb: '251,191,36', hex: '#FBBF24' }
};
var RAR_ORDER = ['C', 'UC', 'R', 'SR'];
POOL.chars.forEach(function (i) { i.kind = 'char'; });
POOL.weapons.forEach(function (i) { i.kind = 'weapon'; });
POOL.armors.forEach(function (i) { i.kind = 'armor'; });

/* =====================================================================
3. ヘルパー
===================================================================== */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function gs() { return (typeof userStats !== 'undefined' && userStats && typeof userStats === 'object') ? userStats : null; }
function gget(k, d) { var s = gs(); if (!s) return d; var v = s[k]; return (v === undefined || v === null) ? d : v; }
function gset(k, v) { var s = gs(); if (!s) return; s[k] = v; }
function saveAll() { try { if (window.saveUserStats) window.saveUserStats(); } catch (e) {} }
function loggedIn() { return (typeof myId !== 'undefined') && myId && myId !== 'GUEST-000'; }
function dateKey(d) { d = d || new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function toast(msg) { try { if (window.showToast) { window.showToast(msg, 'ok'); return; } } catch (e) {} }
function goldOf() { return parseInt(gget('gold', 0)) || 0; }
function tCharOf() { return parseInt(gget('gacha_ticket_char', 0)) || 0; }
function tItemOf() { return parseInt(gget('gacha_ticket_item', 0)) || 0; }
function tCommonOf() { return parseInt(gget('gacha_tickets', 0)) || 0; }
function shardOf(r) { return parseInt(gget('gacha_shard_' + r, 0)) || 0; }
function addShard(r, n) { gset('gacha_shard_' + r, Math.max(0, shardOf(r) + n)); }
function pityOf(b, l) { return parseInt(gget('gacha_pity_' + b + '_' + l, 0)) || 0; }
function setPity(b, l, v) { gset('gacha_pity_' + b + '_' + l, Math.max(0, v)); }
function invOf(k) { var a = gget('gacha_inv_' + k, []); return Array.isArray(a) ? a : []; }
function bannerPool(b) { return b === 'char' ? POOL.chars : POOL.weapons.concat(POOL.armors); }
function findItem(id) { if (!id) return null; var all = POOL.chars.concat(POOL.weapons).concat(POOL.armors); for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; }
function rollRarity(rates) { var r = Math.random() * 100, acc = 0; for (var i = 0; i < RAR_ORDER.length; i++) { acc += rates[RAR_ORDER[i]] || 0; if (r < acc) return RAR_ORDER[i]; } return 'C'; }
function pickItem(banner, rarity) {
  var pool = bannerPool(banner); var start = RAR_ORDER.indexOf(rarity);
  for (var i = start; i < RAR_ORDER.length; i++) { var c = pool.filter(function (p) { return p.rarity === RAR_ORDER[i]; }); if (c.length) return c[Math.floor(Math.random() * c.length)]; }
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}
function grantItem(item) {
  var res = { isNew: false, shardGain: 0 }; if (!item) return res;
  var inv = invOf(item.kind);
  if (inv.indexOf(item.id) < 0) { inv.push(item.id); res.isNew = true; }
  else { res.shardGain = CONFIG.shardDupe[item.rarity] || 0; addShard(item.rarity, res.shardGain); }
  gset('gacha_inv_' + item.kind, inv);
  return res;
}
function enhLevelOf(id) { var o = gget('gacha_enhance', {}); return (o && o[id]) ? o[id] : 0; }
function enhCost(item) { return (enhLevelOf(item.id) + 1) * CONFIG.enhanceCostBase; }
function goldSvg(sz) {
  return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" style="flex-shrink:0;vertical-align:-2px">' +
    '<defs><radialGradient id="gcGoldG" cx="35%" cy="30%" r="85%"><stop offset="0%" stop-color="#FEF3C7"/><stop offset="45%" stop-color="#FBBF24"/><stop offset="100%" stop-color="#B45309"/></radialGradient></defs>' +
    '<circle cx="12" cy="12" r="10.5" fill="url(#gcGoldG)" stroke="#78350F" stroke-width="1"/>' +
    '<circle cx="12" cy="12" r="7.2" fill="none" stroke="rgba(120,53,15,.5)" stroke-width="1.1"/>' +
    '<path d="M12 7.2l1.35 2.9 3.15.4-2.3 2.15.6 3.15L12 14.2l-2.8 1.6.6-3.15-2.3-2.15 3.15-.4z" fill="rgba(120,53,15,.85)"/></svg>';
}
function shardSvg(rarity, sz) {
  var c = RAR[rarity] || RAR.C; var id = 'gcShG_' + rarity;
  return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" style="flex-shrink:0;vertical-align:-2px">' +
    '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="rgba(255,255,255,.95)"/><stop offset="45%" stop-color="rgb(' + c.rgb + ')"/><stop offset="100%" stop-color="rgba(' + c.rgb + ',.55)"/></linearGradient></defs>' +
    '<path d="M12 1.5 L20 9 L12 22.5 L4 9 Z" fill="url(#' + id + ')" stroke="rgba(255,255,255,.5)" stroke-width="1"/>' +
    '<path d="M4 9 H20 M12 1.5 V22.5" stroke="rgba(255,255,255,.35)" stroke-width=".8" fill="none"/></svg>';
}
function iconHtml(item) {
  if (!item) return '⭐';
  if (item.icon && item.icon.indexOf('img:') === 0) return '<img src="' + esc(item.icon.slice(4)) + '" onerror="this.parentNode.innerHTML=\'⭐\'">';
  return esc(item.icon || '⭐');
}

/* =====================================================================
4. CSS 自動注入（ガチャUI＋派手演出＋管理者）
===================================================================== */
(function injectAllCss() {
  if (document.getElementById('gachaAllCss')) return;
  var s = document.createElement('style');
  s.id = 'gachaAllCss';
  s.textContent = [
    /* ヘッダーゴールド */
    '.gcHeaderGold{display:inline-flex;align-items:center;gap:4px;margin-left:8px;padding:2px 9px;border-radius:12px;background:rgba(0,0,0,.4);border:1px solid rgba(251,191,36,.5);box-shadow:0 0 8px rgba(251,191,36,.28);}',
    '.gcHeaderGold span{font-size:10px;font-weight:900;color:#fde68a;font-family:ui-monospace,monospace;}',
    /* ガシャページ */
    '.gcRoot{position:relative;z-index:2;}',
    '.gcHead{display:flex;align-items:flex-end;justify-content:center;gap:16px;margin:4px 0 18px;}',
    '.gcHeadTitle{text-align:center;flex:1;min-width:0;}',
    '.gcKicker{font-size:10px;font-weight:700;letter-spacing:.42em;color:#c8902a;text-transform:uppercase;text-shadow:0 0 10px rgba(200,144,42,.5);margin-bottom:7px;}',
    '.gcTitle{font-family:"Noto Serif JP",serif;font-size:30px;font-weight:900;letter-spacing:.14em;color:#f3e5c0;text-shadow:0 0 18px rgba(245,196,81,.35),0 2px 4px rgba(0,0,0,.9);}',
    '.gcSub{font-size:11px;font-weight:600;color:#a89880;letter-spacing:.14em;margin-top:8px;}',
    '.gcWalletWrap{max-width:420px;margin:0 auto 14px;}',
    '.gcWallet{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;}',
    '.gcWalItem{display:inline-flex;align-items:center;gap:5px;padding:6px 11px;border-radius:999px;font-size:11px;font-weight:800;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.14);color:#cbbfa6;}',
    '.gcWalItem b{font-family:ui-monospace,monospace;color:#fff;}',
    '.gcWalGold{border-color:rgba(251,191,36,.5);box-shadow:0 0 10px rgba(251,191,36,.2);}',
    '.gcWalGold b{color:#fde68a;}',
    '.gcBannerTabs{display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:420px;margin:0 auto 12px;}',
    '.gcTab{padding:13px 6px;border:none;cursor:pointer;font-family:"Noto Serif JP",serif;font-size:14px;font-weight:900;color:#cdbfa6;clip-path:polygon(10px 0,calc(100% - 10px) 0,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0 calc(100% - 10px),0 10px);background:linear-gradient(180deg,#3d342b,#241d16 60%,#191309);box-shadow:inset 0 0 0 1.5px rgba(200,144,42,.26),inset 0 -6px 12px rgba(0,0,0,.5);}',
    '.gcTabOn{box-shadow:inset 0 0 0 2px rgba(245,196,81,.85),inset 0 0 22px rgba(245,196,81,.22);color:#fde68a;text-shadow:0 0 10px rgba(251,191,36,.5);}',
    '.gcBannerCard{max-width:420px;margin:0 auto 16px;padding:16px 14px;border-radius:16px;border:1px solid rgba(200,144,42,.3);background:linear-gradient(168deg,rgba(46,38,28,.92),rgba(28,22,15,.95));box-shadow:0 10px 26px rgba(0,0,0,.5);}',
    '.gcBannerName{font-family:"Noto Serif JP",serif;font-size:18px;font-weight:900;color:#f3e5c0;}',
    '.gcBannerDesc{font-size:11px;color:#a89880;margin:4px 0 10px;}',
    '.gcPityRow{display:flex;align-items:center;gap:8px;margin-bottom:8px;}',
    '.gcPityLbl{flex:0 0 92px;font-size:10px;font-weight:800;color:#9a8c72;}',
    '.gcPityBar{flex:1;height:9px;border-radius:5px;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.1);overflow:hidden;}',
    '.gcPityFill{height:100%;background:linear-gradient(90deg,#c8902a,#f5c451);box-shadow:0 0 8px rgba(245,196,81,.5);transition:width .3s;}',
    '.gcPityNum{font-family:ui-monospace,monospace;font-size:10px;font-weight:800;color:#e8dcc0;}',
    '.gcPityBtn{padding:6px 12px;border-radius:9px;border:1.5px solid rgba(245,196,81,.7);background:linear-gradient(180deg,#4a3b24,#2e2415);color:#fde68a;font-size:11px;font-weight:900;cursor:pointer;animation:gcPityGlow 1.2s infinite;}',
    '@keyframes gcPityGlow{0%,100%{filter:brightness(1)}50%{filter:brightness(1.5)}}',
    '.gcDrawBtns{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px;}',
    '.gcDrawBtn{display:flex;flex-direction:column;align-items:center;gap:3px;padding:12px 8px;border-radius:12px;cursor:pointer;border:1.5px solid rgba(245,196,81,.5);background:linear-gradient(180deg,#4a3b24,#2e2415 55%,#1f1809);}',
    '.gcDrawBtn:active{transform:scale(.96);}',
    '.gcDbMain{font-family:"Noto Serif JP",serif;font-size:14px;font-weight:900;color:#fde68a;}',
    '.gcDbCost{display:flex;align-items:center;gap:4px;font-size:11px;font-weight:800;color:#d6b96a;font-family:ui-monospace,monospace;}',
    '.gcDrawBtn10{border-color:rgba(155,107,255,.6);}',
    '.gcDrawBtn10 .gcDbMain{color:#e9d9ff;}',
    '.gcPoolToggle{text-align:center;font-size:11px;font-weight:800;color:#9a8c72;padding:8px;cursor:pointer;}',
    '.gcPoolList{display:flex;flex-direction:column;gap:6px;max-height:210px;overflow-y:auto;}',
    '.gcPoolItem{display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:9px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.08);}',
    '.gcPoolIco{font-size:17px;width:24px;text-align:center;}',
    '.gcPoolName{flex:1;font-size:12px;font-weight:700;color:#e8dcc0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.gcPoolRar{font-size:9.5px;font-weight:800;}',
    '.gcRatesHead,.gcRatesRow{display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr 1fr;padding:7px 8px;font-size:10.5px;font-weight:800;text-align:center;}',
    '.gcRatesHead{background:rgba(0,0,0,.5);color:#9a8c72;}',
    '.gcRatesRow{background:rgba(255,255,255,.03);color:#cbbfa6;}',
    '.gcRar-C-txt{color:#94A3B8;}.gcRar-UC-txt{color:#00F0FF;}.gcRar-R-txt{color:#FB923C;}.gcRar-SR-txt{color:#FBBF24;}',
    /* 強化/インベントリ（右ページ→編成側へ移動可・ここでは所持表示） */
    '.gcSectionTitle{font-family:"Noto Serif JP",serif;font-size:15px;font-weight:900;color:#f3e5c0;margin:18px 0 10px;}',
    '.gcShardBar{display:flex;flex-wrap:wrap;gap:6px;}',
    '.gcShardItem{display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:999px;font-size:10px;font-weight:800;color:#cbbfa6;background:rgba(0,0,0,.3);}',
    '.gcShardItem b{font-family:ui-monospace,monospace;color:#fff;}',
    '.gcEnhCard{display:flex;align-items:center;gap:11px;padding:12px;margin-bottom:9px;border-radius:13px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.3);}',
    '.gcEnhIcon{width:48px;height:48px;display:flex;align-items:center;justify-content:center;font-size:26px;border-radius:11px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.2);}',
    '.gcEnhBody{flex:1;min-width:0;}',
    '.gcEnhName{font-size:13px;font-weight:900;color:#f3e5c0;}',
    '.gcEnhLv{font-size:10px;color:#fbbf24;font-weight:800;margin-top:2px;}',
    '.gcEnhBonus{color:#67d8d2;}',
    '.gcEnhCost{font-size:10px;color:#9a8c72;margin-top:2px;display:flex;align-items:center;gap:4px;}',
    '.gcHaveOk{color:#6EE7B7;}.gcHaveNo{color:#FCA5A5;}',
    '.gcEnhBtn{padding:9px 15px;border-radius:10px;border:1.5px solid rgba(245,196,81,.5);background:linear-gradient(180deg,#4a3b24,#2e2415);color:#fde68a;font-size:12px;font-weight:900;cursor:pointer;}',
    '.gcEnhBtn.gcOff{opacity:.4;cursor:default;}',
    '.gcInvGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}',
    '.gcInvCard{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 6px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.3);}',
    '.gcInvIcon{font-size:26px;}',
    '.gcInvName{font-size:10px;font-weight:800;color:#e8dcc0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.gcInvRar{font-size:8.5px;font-weight:800;}',
    '.gcInvStat{font-size:9px;color:#9a8c72;}',
    '.gcEquipBtn{margin-top:3px;padding:6px 10px;border-radius:8px;border:1px solid rgba(52,231,228,.5);background:rgba(52,231,228,.12);color:#9af6f1;font-size:10px;font-weight:800;cursor:pointer;}',
    '.gcEqOn{border-color:rgba(255,84,104,.5);background:rgba(255,84,104,.12);color:#fda4af;}',
    '.gcEmpty{text-align:center;font-size:12px;color:#8a7a5f;padding:20px;border:1px dashed rgba(200,144,42,.3);border-radius:12px;}',
    /* オーバーレイ（三門） */
    '.gcOverlay{position:fixed;inset:0;z-index:60000;display:flex;flex-direction:column;align-items:center;overflow-y:auto;background:radial-gradient(130% 100% at 50% 0%,rgba(90,70,50,.32),transparent 55%),linear-gradient(165deg,#3a2f22,#14100a);}',
    '.gcOvTop{text-align:center;margin-top:20px;}',
    '.gcOvKick{font-size:10px;letter-spacing:.4em;color:#c8902a;}',
    '.gcOvTitle{font-family:"Noto Serif JP",serif;font-size:22px;font-weight:900;color:#f3e5c0;}',
    '.gcStage{flex:1;display:flex;align-items:center;justify-content:center;width:100%;}',
    '.gcGates{display:flex;gap:4.5vw;align-items:flex-end;}',
    '.gcGate{width:26vw;max-width:116px;cursor:pointer;transition:transform .3s,opacity .5s,filter .5s;animation:gcGateIn .5s both;}',
    '@keyframes gcGateIn{from{opacity:0;transform:translateY(30px) scale(.85)}to{opacity:1;transform:none}}',
    '.gcGateArch{position:relative;width:100%;padding-top:132%;border-radius:999px 999px 10px 10px;overflow:hidden;background:linear-gradient(180deg,#43382a,#191309);border:2px solid rgba(200,144,42,.42);}',
    '.gcGateGlow{position:absolute;inset:9% 13%;border-radius:999px 999px 6px 6px;background:radial-gradient(ellipse at 50% 62%,rgba(var(--gc-rl),.9),rgba(var(--gc-rl),.3) 48%,transparent 76%);transition:opacity .35s;animation:gcGlowPulse 2.4s infinite;}',
    '@keyframes gcGlowPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}',
    '.gcRar-C{--gc-rl:148,163,184;}.gcRar-UC{--gc-rl:0,240,255;}.gcRar-R{--gc-rl:249,115,22;}.gcRar-SR{--gc-rl:251,191,36;}',
    '.gcDim.gcRar-C .gcGateGlow{opacity:.10}.gcDim.gcRar-UC .gcGateGlow{opacity:.17}.gcDim.gcRar-R .gcGateGlow{opacity:.26}.gcDim.gcRar-SR .gcGateGlow{opacity:.42}',
    '.gcDoorL,.gcDoorR{position:absolute;top:6%;bottom:4%;width:43%;z-index:2;background:linear-gradient(180deg,#3c3122,#15100a);transition:transform .65s,opacity .65s;}',
    '.gcDoorL{left:6.5%;border-radius:999px 0 0 8px;}.gcDoorR{right:6.5%;border-radius:0 999px 8px 0;}',
    '.gcGateCore{position:absolute;left:20%;right:20%;top:12%;bottom:6%;z-index:1;background:linear-gradient(180deg,rgba(var(--gc-rl),0),rgba(var(--gc-rl),.6));opacity:0;transition:opacity .4s;}',
    '.gcGate.gcChosen{transform:scale(1.1);z-index:5;}',
    '.gcGate.gcSink{opacity:0;transform:translateY(48%) scale(.9);filter:blur(3px);pointer-events:none;}',
    '.gcGate.gcSink .gcGateGlow{opacity:.9;}',
    '.gcGate.gcOpen .gcDoorL{transform:translateX(-114%);opacity:.2;}',
    '.gcGate.gcOpen .gcDoorR{transform:translateX(114%);opacity:.2;}',
    '.gcGate.gcOpen .gcGateCore{opacity:1;}',
    '.gcGate.gcOpen .gcGateGlow{opacity:1;}',
    '.gcRing{position:absolute;left:50%;top:52%;width:20px;height:20px;margin:-10px;border-radius:50%;border:2px solid rgba(var(--gc-rl),.9);z-index:6;animation:gcRingOut .6s forwards;}',
    '@keyframes gcRingOut{to{transform:scale(6.5);opacity:0}}',
    '.gcHint{margin:14px 0 26px;font-size:12px;font-weight:800;letter-spacing:.2em;color:rgba(233,217,255,.85);animation:gcBlink 2s infinite;}',
    '@keyframes gcBlink{0%,100%{opacity:.45}50%{opacity:.95}}',
    '.gcSkipBtn{position:absolute;top:14px;right:14px;z-index:12;padding:7px 16px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.4);color:#cbd5e1;font-size:11px;font-weight:800;cursor:pointer;}',
    '.gcFxLayer{position:absolute;inset:0;z-index:7;pointer-events:none;overflow:hidden;}',
    '.gcFlash{position:absolute;inset:0;z-index:8;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 55%,rgba(var(--gc-fl,255,255,255),.85),transparent 62%);}',
    '.gcFlashOn{animation:gcFlashA .45s ease-out;}',
    '@keyframes gcFlashA{0%{opacity:.95}100%{opacity:0}}',
    '.gcShake{animation:gcQuake .5s ease;}',
    '@keyframes gcQuake{0%,100%{transform:translate(0,0)}15%{transform:translate(-6px,4px)}30%{transform:translate(7px,-5px)}45%{transform:translate(-5px,-4px)}60%{transform:translate(5px,4px)}80%{transform:translate(-3px,2px)}}',
    /* 派手演出パーツ */
    '.gcFxPhoenix{position:absolute;top:30%;left:0;width:100%;height:36%;}',
    '.gcFxPhoenixBody{position:absolute;font-size:64px;filter:sepia(1) saturate(7) hue-rotate(-28deg) brightness(1.35) drop-shadow(0 0 16px rgba(249,115,22,.95));animation:gcPhoenixFly 1.4s forwards;}',
    '@keyframes gcPhoenixFly{0%{transform:translate(-14vw,44px) scale(.6);opacity:0}12%{opacity:1}55%{transform:translate(46vw,-18px) scale(1.15)}100%{transform:translate(108vw,10px);opacity:0}}',
    '.gcFxPhoenixSpark{position:absolute;width:8px;height:8px;border-radius:50%;background:radial-gradient(circle,#fff,#fbbf24 55%,transparent);opacity:0;animation:gcSparkTrail .9s forwards;}',
    '@keyframes gcSparkTrail{0%{opacity:0}20%{opacity:1}100%{opacity:0;transform:translateX(-90px) translateY(16px)}}',
    '.gcFxDragon{position:absolute;left:50%;top:42%;font-size:min(44vw,185px);transform:translate(-50%,-50%);filter:brightness(0) drop-shadow(0 0 30px rgba(244,63,94,.8));animation:gcDragonA 1.5s forwards;}',
    '@keyframes gcDragonA{0%{opacity:0;transform:translate(-50%,-46%) scale(.6)}30%{opacity:1;transform:translate(-50%,-50%) scale(1.06)}55%{filter:brightness(1.25) drop-shadow(0 0 60px rgba(251,191,36,.95))}100%{opacity:0;transform:translate(-50%,-52%) scale(1.12)}}',
    '.gcFxMeteor{position:absolute;font-size:58px;left:72%;top:-10%;filter:drop-shadow(0 0 14px rgba(251,146,60,.9));animation:gcMeteorFall .75s forwards;}',
    '@keyframes gcMeteorFall{to{transform:translate(-26vw,62vh) rotate(-12deg);opacity:.9}}',
    '.gcFxImpact{position:absolute;left:50%;top:56%;width:30px;height:30px;margin:-15px;border-radius:50%;border:3px solid rgba(251,191,36,.95);opacity:0;animation:gcImpactA .6s .55s forwards;}',
    '@keyframes gcImpactA{0%{opacity:.95;transform:scale(.4)}100%{opacity:0;transform:scale(6)}}',
    '.gcFxWhite{position:absolute;inset:0;background:#eaf6ff;opacity:0;animation:gcWhiteA .5s;}',
    '@keyframes gcWhiteA{0%{opacity:.85}100%{opacity:0}}',
    '.gcFxLightningBolt{position:absolute;left:50%;top:5%;font-size:88px;margin-left:-34px;filter:drop-shadow(0 0 18px rgba(199,242,255,.95));transform-origin:top;animation:gcBolt .65s forwards;}',
    '@keyframes gcBolt{0%{transform:scaleY(0);opacity:0}30%{transform:scaleY(1.15);opacity:1}100%{opacity:0}}',
    '.gcFxAurora{position:absolute;inset:-20%;background:linear-gradient(115deg,transparent 20%,rgba(0,240,255,.22) 38%,rgba(192,132,252,.25) 52%,rgba(16,185,129,.18) 66%,transparent 80%);filter:blur(14px);animation:gcAuroraA 1.6s forwards;}',
    '@keyframes gcAuroraA{0%{opacity:0;transform:translateX(-6%)}30%{opacity:1}100%{opacity:0;transform:translateX(6%)}}',
    '.gcFxPetal{position:absolute;top:-24px;width:12px;height:12px;border-radius:60% 0 60% 0;background:rgba(244,114,182,.85);animation:gcPetalFall linear forwards;}',
    '@keyframes gcPetalFall{0%{transform:translate(0,-20px);opacity:0}10%{opacity:.95}100%{transform:translate(-46px,104vh) rotate(340deg);opacity:0}}',
    '.gcFxPuff{position:absolute;left:50%;top:60%;width:60px;height:60px;margin:-30px;border-radius:50%;background:radial-gradient(circle,rgba(148,163,184,.5),transparent 70%);animation:gcPuffA .5s forwards;}',
    '@keyframes gcPuffA{0%{transform:scale(.4);opacity:.9}100%{transform:scale(1.9);opacity:0}}',
    /* 結果カード */
    '.gcResultWrap{position:absolute;inset:0;z-index:9;display:flex;align-items:center;justify-content:center;padding:20px;}',
    '.gcCard{position:relative;width:min(74vw,300px);padding:26px 20px 18px;border-radius:18px;text-align:center;background:linear-gradient(170deg,rgba(30,24,44,.96),rgba(12,9,20,.97));border:2px solid rgba(var(--gc-rl),.75);box-shadow:0 0 34px rgba(var(--gc-rl),.4);animation:gcCardPop .55s cubic-bezier(.18,1.4,.35,1) both;cursor:pointer;}',
    '@keyframes gcCardPop{0%{transform:scale(.25) translateY(60px);opacity:0}100%{transform:none;opacity:1}}',
    '.gcCard.gcRar-SR{animation:gcCardPop .55s both,gcSrPulse 1.6s .6s infinite;}',
    '@keyframes gcSrPulse{0%,100%{box-shadow:0 0 30px rgba(251,191,36,.4)}50%{box-shadow:0 0 56px rgba(251,191,36,.75)}}',
    '.gcCardIcon{font-size:74px;margin:8px 0 12px;filter:drop-shadow(0 0 18px rgba(var(--gc-rl),.55));}',
    '.gcCardName{font-family:"Noto Serif JP",serif;font-size:21px;font-weight:900;color:#fff;}',
    '.gcCardRar{display:inline-block;margin-top:8px;padding:4px 14px;border-radius:999px;font-size:10px;font-weight:900;letter-spacing:.16em;color:#0b0b12;background:rgba(var(--gc-rl),1);}',
    '.gcCardStat{margin-top:8px;font-size:12px;color:#cfd6e4;font-weight:700;}',
    '.gcCardNote{margin-top:10px;font-size:12.5px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:5px;}',
    '.gcNewBadge{color:#6EE7B7;text-shadow:0 0 10px rgba(110,231,183,.7);}',
    '.gcDupeNote{color:#c4b5fd;display:flex;align-items:center;gap:4px;}',
    '.gcCardTap{margin-top:14px;font-size:10px;color:rgba(255,255,255,.5);letter-spacing:.24em;animation:gcBlink 1.6s infinite;}',
    '.gcGrid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;width:min(94vw,430px);}',
    '.gcGridCard{position:relative;aspect-ratio:3/4;border-radius:10px;background:rgba(12,9,20,.96);border:1.5px solid rgba(var(--gc-rl),.7);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;animation:gcFlipIn .45s both;}',
    '@keyframes gcFlipIn{0%{transform:rotateY(90deg) scale(.8);opacity:0}100%{transform:none;opacity:1}}',
    '.gcGcIcon{font-size:24px;}',
    '.gcGcName{font-size:8px;color:#e8dcc0;font-weight:700;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.gcGcNew{position:absolute;top:3px;right:3px;font-size:7.5px;font-weight:900;color:#052e16;background:#4ade80;padding:1px 4px;border-radius:6px;}',
    '.gcGcShard{position:absolute;bottom:3px;right:3px;font-size:8px;color:#c4b5fd;}',
    '.gcGridTap{grid-column:1/-1;text-align:center;margin-top:12px;font-size:11px;color:rgba(255,255,255,.55);letter-spacing:.24em;animation:gcBlink 1.6s infinite;}',
    /* モーダル */
    '.gcModal{position:fixed;inset:0;z-index:60010;display:flex;align-items:center;justify-content:center;background:rgba(5,3,12,.78);backdrop-filter:blur(6px);padding:20px;}',
    '.gcModalCard{width:min(92vw,380px);max-height:82vh;overflow-y:auto;border-radius:18px;padding:22px 18px;background:linear-gradient(168deg,#2a2138,#171022);border:1px solid rgba(155,107,255,.4);}',
    '.gcModalTitle{font-family:"Noto Serif JP",serif;font-size:19px;font-weight:900;color:#f3e5c0;text-align:center;}',
    '.gcModalSub{text-align:center;font-size:11px;color:#a99bc4;margin:6px 0 12px;}',
    '.gcPityChoice{display:flex;flex-direction:column;gap:10px;}',
    '.gcPityOpt{padding:15px 14px;border-radius:13px;border:1.5px solid rgba(245,196,81,.45);background:rgba(245,196,81,.06);cursor:pointer;}',
    '.gcPityOpt b{display:block;font-size:14px;color:#fde68a;}',
    '.gcPityOpt span{display:block;font-size:11px;color:#b6a98f;margin-top:4px;}',
    '.gcPityOptB{border-color:rgba(52,231,228,.45);background:rgba(52,231,228,.06);}',
    '.gcPityOptB b{color:#9af6f1;}',
    '.gcPickList{display:flex;flex-direction:column;gap:8px;margin-top:12px;max-height:44vh;overflow-y:auto;}',
    '.gcPickItem{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:11px;border:1px solid rgba(255,255,255,.12);cursor:pointer;}',
    '.gcPickItem.sel{border-color:rgba(245,196,81,.85);box-shadow:0 0 14px rgba(245,196,81,.3);}',
    '.gcBtnGold{width:100%;margin-top:14px;padding:13px;border-radius:12px;border:1.5px solid rgba(245,196,81,.6);background:linear-gradient(180deg,#4a3b24,#2e2415);color:#fde68a;font-size:15px;font-weight:900;cursor:pointer;}',
    '.gcBtnGhost{width:100%;margin-top:8px;padding:11px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(0,0,0,.3);color:#a89880;font-size:12px;cursor:pointer;}',
    '.gcLoginDots{display:flex;justify-content:center;gap:7px;margin:12px 0;}',
    '.gcLoginDot{width:11px;height:11px;border-radius:50%;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.2);}',
    '.gcLoginDot.on{background:linear-gradient(135deg,#9af6f1,#34e7e4);border-color:transparent;}',
    '.gcRewardRow{display:flex;align-items:center;gap:10px;padding:10px 12px;margin-top:8px;border-radius:11px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.1);font-size:13px;font-weight:800;color:#efe9dc;}',
    '.gcRewardRow b{margin-left:auto;color:#fde68a;}',
    /* 管理者 */
    '.gcAdminCard{max-width:420px;margin:20px auto;padding:16px;border-radius:14px;border:1px solid rgba(236,72,153,.4);background:rgba(236,72,153,.06);}',
    '.gcAdminTitle{font-size:13px;font-weight:900;color:#f9a8d4;margin-bottom:12px;}',
    '.gcAdminRow{display:flex;align-items:center;gap:8px;margin-bottom:8px;}',
    '.gcAdminRow label{flex:1;font-size:11px;color:#e8dcc0;}',
    '.gcAdminRow input{width:90px;padding:7px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.4);color:#fff;font-size:12px;text-align:right;}',
    '.gcAdminApply{width:100%;margin-top:10px;padding:11px;border-radius:10px;border:1px solid rgba(236,72,153,.5);background:rgba(236,72,153,.15);color:#f9a8d4;font-size:12px;font-weight:800;cursor:pointer;}'
  ].join('\n');
  (document.head || document.documentElement).appendChild(s);
})();

/* =====================================================================
5. ヘッダーゴールド
===================================================================== */
function injectHeaderGold() {
  if (!loggedIn()) return;
  var el = document.getElementById('gcHeaderGold');
  var host = document.querySelector('.profile-exp-badge-zone') || document.querySelector('.app-header');
  if (!el) {
    if (!host) return;
    el = document.createElement('div'); el.id = 'gcHeaderGold'; el.className = 'gcHeaderGold';
    el.innerHTML = goldSvg(14) + '<span id="gcHeaderGoldNum">0</span>';
    host.appendChild(el);
  }
  var num = document.getElementById('gcHeaderGoldNum');
  if (num) num.textContent = goldOf().toLocaleString();
}

/* =====================================================================
6. ガシャページ（右ページ＝召喚＋チケット枚数）
===================================================================== */
window.__gcBanner = window.__gcBanner || 'char';
function buildGashaPage() {
  var page = document.getElementById('pgPageGasha');
  if (!page) return;
  if (page.querySelector('.gcRoot')) return;
  page.innerHTML =
    '<div class="gcRoot">' +
    '<div class="gcHead"><div class="gcHeadTitle"><div class="gcKicker">TRINITY GATE · 三門の神託</div><div class="gcTitle">召喚の間</div><div class="gcSub">門を選び、運命を掴め</div></div></div>' +
    '<div class="gcGuest" style="display:none">🔒 ゲストはガシャを利用できません。</div>' +
    '<div class="gcWalletWrap"><div class="gcWallet" id="gcWallet"></div></div>' +
    '<div class="gcBannerTabs"><button type="button" class="gcTab" data-banner="char">🐧 キャラガシャ</button><button type="button" class="gcTab" data-banner="item">⚔️ アイテムガシャ</button></div>' +
    '<div class="gcBannerCard"><div class="gcBannerName" id="gcBannerName"></div><div class="gcBannerDesc" id="gcBannerDesc"></div>' +
    '<div id="gcPityArea"></div><div class="gcDrawBtns" id="gcDrawBtns"></div>' +
    '<div class="gcPoolToggle" id="gcPoolToggle">▾ アイテム一覧と確率</div>' +
    '<div id="gcPoolBox" style="display:none"><div class="gcPoolList" id="gcPoolList"></div><div id="gcRatesTable"></div></div></div>' +
    '</div>';
  page.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var tab = t.closest('[data-banner]'); if (tab) { window.__gcBanner = tab.getAttribute('data-banner'); refreshGashaPage(); return; }
    var draw = t.closest('[data-draw]'); if (draw) { var p = draw.getAttribute('data-draw').split('_'); doDraw(p[0], p[1], parseInt(p[2], 10)); return; }
    var pb = t.closest('[data-pity]'); if (pb) { var q = pb.getAttribute('data-pity').split('_'); openPityModal(q[0], q[1]); return; }
    if (t.closest('#gcPoolToggle')) { var box = document.getElementById('gcPoolBox'); if (box) box.style.display = (box.style.display === 'none') ? 'block' : 'none'; return; }
  });
  refreshGashaPage();
}
function refreshGashaPage() {
  var page = document.getElementById('pgPageGasha'); if (!page) return;
  var root = page.querySelector('.gcRoot'); if (!root) { buildGashaPage(); return; }
  var ok = loggedIn();
  root.querySelector('.gcGuest').style.display = ok ? 'none' : 'block';
  injectHeaderGold();
  if (!ok) return;
  var b = window.__gcBanner;
  var w = document.getElementById('gcWallet');
  if (w) w.innerHTML =
    '<span class="gcWalItem gcWalGold">' + goldSvg(14) + '<b>' + goldOf().toLocaleString() + '</b></span>' +
    '<span class="gcWalItem">🎟️ キャラ <b>' + tCharOf() + '</b></span>' +
    '<span class="gcWalItem">🎟️ アイテム <b>' + tItemOf() + '</b></span>' +
    '<span class="gcWalItem">🎟️ 共通 <b>' + tCommonOf() + '</b></span>';
  var tabs = root.querySelectorAll('[data-banner]');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('gcTabOn', tabs[i].getAttribute('data-banner') === b);
  document.getElementById('gcBannerName').textContent = b === 'char' ? 'キャラガシャ' : 'アイテムガシャ';
  document.getElementById('gcBannerDesc').textContent = b === 'char' ? '共に戦う仲間を召喚する門' : '武器と防具を得る門';
  document.getElementById('gcPityArea').innerHTML = pityRow(b, 'gold', 'ゴールド天井') + pityRow(b, 'ticket', 'チケット天井');
  document.getElementById('gcDrawBtns').innerHTML = drawBtnsHtml(b);
  document.getElementById('gcPoolList').innerHTML = poolHtml(b);
  document.getElementById('gcRatesTable').innerHTML = ratesHtml();
}
function pityRow(banner, lane, label) {
  var v = pityOf(banner, lane); var pct = Math.min(100, v / CONFIG.pityMax * 100); var full = v >= CONFIG.pityMax;
  return '<div class="gcPityRow"><span class="gcPityLbl">' + label + '</span><div class="gcPityBar"><div class="gcPityFill" style="width:' + pct + '%"></div></div><span class="gcPityNum">' + Math.min(v, CONFIG.pityMax) + '/' + CONFIG.pityMax + '</span>' + (full ? '<button type="button" class="gcPityBtn" data-pity="' + banner + '_' + lane + '">神託選択</button>' : '') + '</div>';
}
function drawBtnsHtml(banner) {
  var g1 = banner === 'char' ? CONFIG.charGold1 : CONFIG.itemGold1;
  var g10 = banner === 'char' ? CONFIG.charGold10 : CONFIG.itemGold10;
  return '<button type="button" class="gcDrawBtn" data-draw="' + banner + '_gold_1"><span class="gcDbMain">1回引く</span><span class="gcDbCost">' + goldSvg(12) + g1 + '</span></button>' +
    '<button type="button" class="gcDrawBtn gcDrawBtn10" data-draw="' + banner + '_gold_10"><span class="gcDbMain">10連！</span><span class="gcDbCost">' + goldSvg(12) + g10 + '</span></button>' +
    '<button type="button" class="gcDrawBtn" data-draw="' + banner + '_ticket_1"><span class="gcDbMain">1回引く</span><span class="gcDbCost">🎟️ ×1</span></button>' +
    '<button type="button" class="gcDrawBtn gcDrawBtn10" data-draw="' + banner + '_ticket_10"><span class="gcDbMain">10連！</span><span class="gcDbCost">🎟️ ×' + CONFIG.ticket10 + '</span></button>';
}
function poolHtml(banner) {
  var pool = bannerPool(banner).slice().sort(function (a, b2) { return RAR_ORDER.indexOf(b2.rarity) - RAR_ORDER.indexOf(a.rarity); });
  return pool.map(function (i) { return '<div class="gcPoolItem"><span class="gcPoolIco">' + iconHtml(i) + '</span><span class="gcPoolName">' + esc(i.name) + '</span><span class="gcPoolRar gcRar-' + i.rarity + '-txt">' + i.rarity + '</span></div>'; }).join('');
}
function ratesHtml() {
  var rows = [['ゴールド', CONFIG.ratesGold], ['チケット', CONFIG.ratesTicket]];
  var h = '<div class="gcRatesHead"><span>通貨</span><span>C</span><span>UC</span><span>R</span><span>SR</span></div>';
  rows.forEach(function (r) { h += '<div class="gcRatesRow"><span>' + r[0] + '</span>' + RAR_ORDER.map(function (k) { return '<span class="gcRar-' + k + '-txt">' + r[1][k] + '%</span>'; }).join('') + '</div>'; });
  return h;
}

/* =====================================================================
7. 引く処理
===================================================================== */
function goldCost(b, c) { return b === 'char' ? (c === 1 ? CONFIG.charGold1 : CONFIG.charGold10) : (c === 1 ? CONFIG.itemGold1 : CONFIG.itemGold10); }
function ticketNeed(c) { return c === 1 ? 1 : CONFIG.ticket10; }
function ticketAvail(b) { return (b === 'char' ? tCharOf() : tItemOf()) + tCommonOf(); }
function payTickets(b, n) {
  var key = b === 'char' ? 'gacha_ticket_char' : 'gacha_ticket_item';
  var spec = parseInt(gget(key, 0)) || 0; var use = Math.min(spec, n);
  gset(key, spec - use);
  var rest = n - use; if (rest > 0) gset('gacha_tickets', Math.max(0, tCommonOf() - rest));
}
function doDraw(banner, currency, count) {
  if (!loggedIn()) { toast('ゲストはガシャを引けません'); return; }
  if (currency === 'gold') { var cost = goldCost(banner, count); if (goldOf() < cost) { toast('ゴールドが足りません'); return; } gset('gold', goldOf() - cost); }
  else { var need = ticketNeed(count); if (ticketAvail(banner) < need) { toast('チケットが足りません'); return; } payTickets(banner, need); }
  var lane = currency === 'gold' ? 'gold' : 'ticket';
  var before = pityOf(banner, lane); setPity(banner, lane, before + count);
  var justReached = before < CONFIG.pityMax && pityOf(banner, lane) >= CONFIG.pityMax;
  var rates = currency === 'ticket' ? CONFIG.ratesTicket : CONFIG.ratesGold;
  if (count === 1) {
    var rolls = [pickItem(banner, rollRarity(rates)), pickItem(banner, rollRarity(rates)), pickItem(banner, rollRarity(rates))];
    saveAll();
    ceremonySingle(rolls, banner, function (idx) { var res = grantItem(rolls[idx]); saveAll(); refreshGashaPage(); return res; }, justReached ? banner : null);
  } else {
    var items = []; for (var i = 0; i < 10; i++) items.push(pickItem(banner, rollRarity(rates)));
    var granted = items.map(function (it) { return grantItem(it); });
    saveAll(); refreshGashaPage();
    ceremonyTen(items, granted, banner, justReached ? banner : null);
  }
}

/* =====================================================================
8. 三門の神託＋派手演出
===================================================================== */
function makeOverlay(banner, sub) {
  var ov = document.createElement('div'); ov.className = 'gcOverlay'; ov.dataset.phase = 'pick';
  ov.innerHTML = '<div class="gcOvTop"><div class="gcOvKick">TRINITY GATE</div><div class="gcOvTitle">' + (banner === 'char' ? 'キャラガシャ' : 'アイテムガシャ') + '</div>' + (sub ? '<div style="font-size:11px;color:#a89880">' + esc(sub) + '</div>' : '') + '</div>' +
    '<div class="gcStage"></div><div class="gcHint"></div><button type="button" class="gcSkipBtn" style="visibility:hidden">SKIP</button><div class="gcFxLayer"></div><div class="gcFlash"></div>';
  document.body.appendChild(ov);
  return ov;
}
function setHint(ov, t) { var h = ov.querySelector('.gcHint'); if (h) h.textContent = t; }
function showSkip(ov) { var s = ov.querySelector('.gcSkipBtn'); if (s) s.style.visibility = 'visible'; }
function hideSkip(ov) { var s = ov.querySelector('.gcSkipBtn'); if (s) s.style.visibility = 'hidden'; }
function closeOv(ov) { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); }
function setGateRarity(g, r) { RAR_ORDER.forEach(function (k) { g.classList.remove('gcRar-' + k); }); g.classList.add('gcRar-' + r); }
function buildGates(ov, rars, dim) {
  var stage = ov.querySelector('.gcStage'); var wrap = document.createElement('div'); wrap.className = 'gcGates';
  rars.forEach(function (r) {
    var g = document.createElement('div'); g.className = 'gcGate gcRar-' + r + (dim ? ' gcDim' : '');
    g.innerHTML = '<div class="gcGateArch"><div class="gcGateGlow"></div><div class="gcGateCore"></div><div class="gcDoorL"></div><div class="gcDoorR"></div></div>';
    wrap.appendChild(g);
  });
  stage.innerHTML = ''; stage.appendChild(wrap);
  return Array.prototype.slice.call(wrap.children);
}
function gatePulse(gate) { var r = document.createElement('span'); r.className = 'gcRing'; gate.querySelector('.gcGateArch').appendChild(r); setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 650); }
function flashOv(ov, rarity) { var f = ov.querySelector('.gcFlash'); if (!f) return; f.style.setProperty('--gc-fl', (RAR[rarity] || RAR.C).rgb); f.classList.remove('gcFlashOn'); void f.offsetWidth; f.classList.add('gcFlashOn'); }
function ceremonySingle(rolls, banner, onPicked, pityBanner) {
  var ov = makeOverlay(banner, '三門の神託');
  var gates = buildGates(ov, rolls.map(function (i) { return i ? i.rarity : 'C'; }), true);
  setHint(ov, '門を一つ選べ…');
  var pickedRes = null, pickedItem = null;
  function finish() { closeOv(ov); if (pityBanner) toast('🌟 天井到達！神託選択が可能になりました'); }
  function doOpen() {
    var gate = gates[ov.__pickIdx]; gate.classList.add('gcOpen'); hideSkip(ov);
    setTimeout(function () {
      ov.dataset.phase = 'card';
      var wrap = document.createElement('div'); wrap.className = 'gcResultWrap';
      wrap.innerHTML = resultCardHtml(pickedItem, pickedRes);
      ov.appendChild(wrap);
      wrap.querySelector('.gcCard').addEventListener('click', finish);
    }, 430);
  }
  ov.querySelector('.gcSkipBtn').addEventListener('click', function () {
    if (ov.dataset.phase === 'card') { finish(); return; }
    if (ov.dataset.phase === 'rise' || ov.dataset.phase === 'fx') { ov.dataset.phase = 'open'; doOpen(); }
  });
  gates.forEach(function (g, i) {
    g.addEventListener('click', function () {
      if (ov.dataset.phase !== 'pick') return;
      ov.dataset.phase = 'rise'; ov.__pickIdx = i;
      gates.forEach(function (gg, j) { if (j !== i) { gg.classList.remove('gcDim'); gg.classList.add('gcSink'); } });
      g.classList.add('gcChosen'); showSkip(ov); setHint(ov, '');
      pickedItem = rolls[i]; pickedRes = onPicked(i);
      setTimeout(function () { riseSequence(ov, g, pickedItem, doOpen); }, 620);
    });
  });
}
function riseSequence(ov, gate, item, done) {
  var steps = RAR_ORDER; var target = steps.indexOf(item ? item.rarity : 'C');
  gate.classList.remove('gcDim'); var i = 0;
  function land() {
    if (ov.dataset.phase !== 'rise') return;
    ov.dataset.phase = 'fx'; flashOv(ov, item.rarity);
    playFx(ov, item.rarity, function () { if (ov.dataset.phase !== 'fx') return; ov.dataset.phase = 'open'; done(); });
  }
  function next() {
    if (ov.dataset.phase !== 'rise') return;
    setGateRarity(gate, steps[i]); gatePulse(gate); flashOv(ov, steps[i]);
    if (i >= target) {
      if (item.rarity === 'R' && Math.random() < CONFIG.teaseRate) {
        setTimeout(function () { if (ov.dataset.phase !== 'rise') return; setGateRarity(gate, 'SR'); flashOv(ov, 'SR'); }, 280);
        setTimeout(function () { if (ov.dataset.phase !== 'rise') return; setGateRarity(gate, 'R'); land(); }, 600);
      } else land();
      return;
    }
    i++; setTimeout(next, 470);
  }
  next();
}
function playFx(ov, rarity, done) {
  var fx = ov.querySelector('.gcFxLayer'); var dur = 500; var p = Math.random();
  if (rarity === 'SR') { dur = 1550; if (p < 0.5) fxPhoenix(fx); else fxDragon(fx, ov); }
  else if (rarity === 'R') { dur = 1150; if (p < 0.5) fxMeteor(fx); else fxLightning(fx, ov); }
  else if (rarity === 'UC') { dur = 950; if (p < 0.5) fxAurora(fx); else fxPetals(fx); }
  else fxPuff(fx);
  setTimeout(done, dur);
}
function fxPhoenix(l) { var el = document.createElement('div'); el.className = 'gcFxPhoenix'; el.innerHTML = '<span class="gcFxPhoenixBody">🦅</span>'; for (var i = 0; i < 10; i++) { var s = document.createElement('i'); s.className = 'gcFxPhoenixSpark'; s.style.animationDelay = (i * 0.08) + 's'; s.style.top = (30 + Math.random() * 40) + '%'; s.style.left = (10 + Math.random() * 80) + '%'; el.appendChild(s); } l.appendChild(el); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1700); }
function fxDragon(l, ov) { var el = document.createElement('div'); el.className = 'gcFxDragon'; el.textContent = '🐉'; l.appendChild(el); ov.classList.add('gcShake'); setTimeout(function () { ov.classList.remove('gcShake'); }, 700); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1700); }
function fxMeteor(l) { var m = document.createElement('div'); m.className = 'gcFxMeteor'; m.textContent = '☄️'; l.appendChild(m); var im = document.createElement('div'); im.className = 'gcFxImpact'; l.appendChild(im); setTimeout(function () { if (m.parentNode) m.parentNode.removeChild(m); if (im.parentNode) im.parentNode.removeChild(im); }, 1500); }
function fxLightning(l, ov) { var w = document.createElement('div'); w.className = 'gcFxWhite'; l.appendChild(w); var b = document.createElement('div'); b.className = 'gcFxLightningBolt'; b.textContent = '⚡'; l.appendChild(b); ov.classList.add('gcShake'); setTimeout(function () { ov.classList.remove('gcShake'); }, 500); setTimeout(function () { if (w.parentNode) w.parentNode.removeChild(w); if (b.parentNode) b.parentNode.removeChild(b); }, 900); }
function fxAurora(l) { var a = document.createElement('div'); a.className = 'gcFxAurora'; l.appendChild(a); setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 1700); }
function fxPetals(l) { for (var i = 0; i < 12; i++) { var p = document.createElement('span'); p.className = 'gcFxPetal'; p.style.left = Math.round(Math.random() * 100) + '%'; p.style.animationDuration = (1.2 + Math.random() * 1.4).toFixed(2) + 's'; p.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's'; l.appendChild(p); (function (pp) { setTimeout(function () { if (pp.parentNode) pp.parentNode.removeChild(pp); }, 3000); })(p); } }
function fxPuff(l) { var p = document.createElement('div'); p.className = 'gcFxPuff'; l.appendChild(p); setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 600); }
function resultCardHtml(item, res) {
  if (!item) return '';
  var note = res && res.isNew ? '<span class="gcNewBadge">NEW!</span>' : '<span class="gcDupeNote">ダブり → ' + shardSvg(item.rarity, 12) + ' カケラ +' + (res ? res.shardGain : 0) + '</span>';
  return '<div class="gcCard gcRar-' + item.rarity + '"><div class="gcCardIcon">' + iconHtml(item) + '</div><div class="gcCardName">' + esc(item.name) + '</div><div class="gcCardRar">' + RAR[item.rarity].full + '</div>' + (item.stat ? '<div class="gcCardStat">' + esc(item.stat.label) + ' +' + item.stat.value + '</div>' : '') + '<div class="gcCardNote">' + note + '</div><div class="gcCardTap">タップで続ける</div></div>';
}
/* ---- 10連用CSS（1回だけ注入） ---- */
(function () {
if (document.getElementById('gcTenCss')) return;
var s = document.createElement('style');
s.id = 'gcTenCss';
s.textContent = [
'.gcTenCount{position:absolute;bottom:calc(16px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);z-index:9;display:flex;flex-direction:column;align-items:center;gap:3px;font-family:ui-monospace,monospace;font-size:14px;font-weight:800;color:#f3e5c0;letter-spacing:.12em;text-shadow:0 1px 3px #000;}',
'.gcTenHint{font-size:9px;color:rgba(255,255,255,.55);letter-spacing:.16em;}',
/* ピカーン！閃光 */
'.gcPika{position:absolute;inset:0;pointer-events:none;z-index:8;opacity:0;animation:gcPikaA .6s ease-out;background:radial-gradient(circle at 50% 45%, rgba(255,255,255,.95), rgba(255,240,200,.55) 30%, transparent 65%);}',
'.gcPika.sr{background:radial-gradient(circle at 50% 45%, rgba(255,255,255,1), rgba(255,214,110,.75) 32%, transparent 70%);}',
'@keyframes gcPikaA{0%{opacity:1}100%{opacity:0}}',
/* 放射する星の光線 */
'.gcPikaStar{position:absolute;left:50%;top:45%;width:5px;height:5px;border-radius:50%;background:#fff;box-shadow:0 0 10px #fff,0 0 22px #ffd76a;pointer-events:none;z-index:8;animation:gcPikaStar .8s cubic-bezier(.2,.7,.3,1) forwards;}',
'@keyframes gcPikaStar{0%{transform:rotate(var(--ang)) translateX(0);opacity:1}100%{transform:rotate(var(--ang)) translateX(48vw);opacity:0}}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();

/* ---- スワイプで次へ ---- */
function bindSwipeNext(el, onNext) {
var sx = 0, sy = 0, dragging = false;
el.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; dragging = true; }, { passive: true });
el.addEventListener('touchend', function (e) {
if (!dragging) return; dragging = false;
var dx = e.changedTouches[0].clientX - sx;
var dy = e.changedTouches[0].clientY - sy;
if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) onNext();
}, { passive: true });
}

/* ---- ピカーン！演出（R/SR） ---- */
function pikaFlash(ov, rar) {
var isSR = (rar === 'SR');
var p = document.createElement('div');
p.className = 'gcPika' + (isSR ? ' sr' : '');
ov.appendChild(p);
setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 700);
var n = isSR ? 12 : 7;
for (var i = 0; i < n; i++) {
var s = document.createElement('span');
s.className = 'gcPikaStar';
s.style.setProperty('--ang', (i * (360 / n)) + 'deg');
s.style.animationDelay = (i * 0.03) + 's';
ov.appendChild(s);
(function (ss) { setTimeout(function () { if (ss.parentNode) ss.parentNode.removeChild(ss); }, 900); })(s);
}
}

/* ---- 10連＝1枚ずつスワイプ ---- */
function ceremonyTen(items, granted, banner, pityBanner) {
var ov = makeOverlay(banner, '10連召喚');
var finished = false;
function finish() {
if (finished) return;
finished = true;
closeOv(ov);
if (pityBanner) toast('🌟 天井到達！神託選択が可能になりました');
}
function showCard(i) {
if (i >= items.length) { finish(); return; }
var item = items[i];
var res = granted[i];
var rar = item ? item.rarity : 'C';
var stage = ov.querySelector('.gcStage');
stage.innerHTML = '';
var wrap = document.createElement('div');
wrap.className = 'gcResultWrap';
wrap.innerHTML = resultCardHtml(item, res) +
'<div class="gcTenCount">' + (i + 1) + ' / ' + items.length + '<span class="gcTenHint">スワイプ / タップで次へ</span></div>';
stage.appendChild(wrap);
/* レアならピカーン！ */
if (rar === 'SR') { pikaFlash(ov, 'SR'); flashOv(ov, 'SR'); playFx(ov, 'SR', function () {}); }
else if (rar === 'R') { pikaFlash(ov, 'R'); flashOv(ov, 'R'); playFx(ov, 'R', function () {}); }
else if (rar === 'UC') { flashOv(ov, 'UC'); }
var card = wrap.querySelector('.gcCard');
var adv = function () { showCard(i + 1); };
if (card) card.addEventListener('click', adv);
bindSwipeNext(wrap, adv);
}
showSkip(ov);
ov.querySelector('.gcSkipBtn').addEventListener('click', finish);
showCard(0);
}

/* =====================================================================
9. 天井「神託選択」
===================================================================== */
function makeModal() { closeModal(); var m = document.createElement('div'); m.className = 'gcModal'; document.body.appendChild(m); return m; }
function closeModal() { var o = document.querySelector('.gcModal'); if (o && o.parentNode) o.parentNode.removeChild(o); }
function openPityModal(banner, lane) {
  var m = makeModal();
  m.innerHTML = '<div class="gcModalCard"><div class="gcModalTitle">🌟 神託到達</div><div class="gcModalSub">' + CONFIG.pityMax + '回召喚の節目。二つの運命から選べ。</div><div class="gcPityChoice"><div class="gcPityOpt" id="gcPityOptA"><b>A：SR以上確定の神託</b><span>プールから SR が1つランダムで降臨</span></div><div class="gcPityOpt gcPityOptB" id="gcPityOptB"><b>B：R以下を指名する</b><span>R / UC / C から好きな1つ</span></div></div><div id="gcPickArea"></div><button type="button" class="gcBtnGhost" id="gcPityClose">閉じる</button></div>';
  m.querySelector('#gcPityClose').addEventListener('click', closeModal);
  m.querySelector('#gcPityOptA').addEventListener('click', function () {
    var item = pickItem(banner, 'SR'); if (!item) { toast('プールにアイテムがありません'); return; }
    var res = grantItem(item); setPity(banner, lane, pityOf(banner, lane) - CONFIG.pityMax); saveAll(); closeModal(); refreshGashaPage(); ceremonyReward(item, res, banner);
  });
  m.querySelector('#gcPityOptB').addEventListener('click', function () { renderPickList(banner, lane); });
}
function renderPickList(banner, lane) {
  var area = document.getElementById('gcPickArea'); if (!area) return;
  var pool = bannerPool(banner).filter(function (i) { return i.rarity !== 'SR'; });
  var selected = null;
  area.innerHTML = '<div class="gcPickList">' + pool.map(function (i) { return '<div class="gcPickItem" data-pickid="' + i.id + '"><span>' + iconHtml(i) + '</span><span style="flex:1">' + esc(i.name) + '</span><span class="gcRar-' + i.rarity + '-txt">' + i.rarity + '</span></div>'; }).join('') + '</div><button type="button" class="gcBtnGold" id="gcPickConfirm" style="opacity:.5">この子に決めた</button>';
  area.querySelectorAll('[data-pickid]').forEach(function (r) {
    r.addEventListener('click', function () { area.querySelectorAll('.gcPickItem').forEach(function (x) { x.classList.remove('sel'); }); r.classList.add('sel'); selected = r.getAttribute('data-pickid'); var b = document.getElementById('gcPickConfirm'); if (b) b.style.opacity = '1'; });
  });
  var cf = document.getElementById('gcPickConfirm');
  if (cf) cf.addEventListener('click', function () {
    if (!selected) { toast('アイテムを選んでください'); return; }
    var item = findItem(selected); var res = grantItem(item); setPity(banner, lane, pityOf(banner, lane) - CONFIG.pityMax); saveAll(); closeModal(); refreshGashaPage(); ceremonyReward(item, res, banner);
  });
}
function ceremonyReward(item, res, banner) {
  var ov = makeOverlay(banner, '神託の降臨'); ov.dataset.phase = 'card';
  ov.querySelector('.gcStage').innerHTML = ''; setHint(ov, ''); flashOv(ov, item.rarity);
  if (item.rarity === 'SR') playFx(ov, 'SR', function () {});
  setTimeout(function () {
    var wrap = document.createElement('div'); wrap.className = 'gcResultWrap';
    wrap.innerHTML = resultCardHtml(item, res); ov.appendChild(wrap);
    wrap.querySelector('.gcCard').addEventListener('click', function () { closeOv(ov); });
  }, 420);
}

/* =====================================================================
10. ログインボーナス
===================================================================== */
function checkLoginBonus() {
  if (!loggedIn()) return;
  if (gget('gacha_login_date', '') === dateKey()) return;
  if (window.__gcLoginShown) return;
  window.__gcLoginShown = true;
  setTimeout(showLoginBonusModal, 700);
}
function showLoginBonusModal() {
  if (gget('gacha_login_date', '') === dateKey()) return;
  var today = dateKey(); var yest = dateKey(new Date(Date.now() - 86400000));
  var last = gget('gacha_login_date', '');
  var streak = (last === yest) ? (parseInt(gget('gacha_login_streak', 0)) || 0) + 1 : 1;
  var dow = new Date().getDay();
  var rw = { gold: 0, tChar: 0, tItem: 0 };
  if (dow === 6) { rw.tChar += CONFIG.loginSaturdayTickets; rw.tItem += CONFIG.loginSaturdayTickets; } else rw.gold += CONFIG.loginGold;
  if (streak > 0 && streak % CONFIG.streakDay === 0) { rw.tChar += CONFIG.streakTickets; rw.tItem += CONFIG.streakTickets; }
  var dots = ''; var pos = ((streak - 1) % CONFIG.streakDay) + 1;
  for (var i = 1; i <= CONFIG.streakDay; i++) dots += '<span class="gcLoginDot' + (i <= pos ? ' on' : '') + '"></span>';
  var rows = '';
  if (rw.gold > 0) rows += '<div class="gcRewardRow">' + goldSvg(16) + ' ゴールド <b>+' + rw.gold + '</b></div>';
  if (rw.tChar > 0) rows += '<div class="gcRewardRow">🎟️ キャラチケット <b>+' + rw.tChar + '</b></div>';
  if (rw.tItem > 0) rows += '<div class="gcRewardRow">🎟️ アイテムチケット <b>+' + rw.tItem + '</b></div>';
  if (streak % CONFIG.streakDay === 0) rows += '<div class="gcRewardRow">🎉 連続 ' + streak + ' 日ボーナス込み！</div>';
  var m = makeModal();
  m.innerHTML = '<div class="gcModalCard"><div class="gcModalTitle">📅 ログインボーナス</div><div class="gcModalSub">連続 ' + streak + ' 日目' + (dow === 6 ? '（土曜特典）' : '') + '</div><div class="gcLoginDots">' + dots + '</div>' + rows + '<button type="button" class="gcBtnGold" id="gcLoginClaim">受け取る</button></div>';
  m.querySelector('#gcLoginClaim').addEventListener('click', function () {
    if (gget('gacha_login_date', '') === today) { closeModal(); return; }
    gset('gold', goldOf() + rw.gold); gset('gacha_ticket_char', tCharOf() + rw.tChar); gset('gacha_ticket_item', tItemOf() + rw.tItem);
    gset('gacha_login_date', today); gset('gacha_login_streak', streak);
    saveAll(); closeModal(); refreshGashaPage();
    toast('📅 ログインボーナスを受け取りました！');
  });
}

/* =====================================================================
11. 強化・装備（編成側・図鑑内からも呼べる公開API）
===================================================================== */
window.gachaEnhance = function (charId) {
  var item = findItem(charId); if (!item) return;
  var cost = enhCost(item);
  if (shardOf(item.rarity) < cost) { toast(RAR[item.rarity].name + 'カケラが足りません'); return; }
  addShard(item.rarity, -cost);
  var o = gget('gacha_enhance', {}) || {}; o[charId] = enhLevelOf(charId) + 1; gset('gacha_enhance', o);
  saveAll(); refreshGashaPage();
  toast('⚒️ ' + item.name + ' を強化！ Lv.' + o[charId]);
};
window.gachaOpenEnhance = function (charId) {
  var item = findItem(charId); if (!item) return;
  var lv = enhLevelOf(charId); var cost = enhCost(item); var have = shardOf(item.rarity);
  var m = makeModal();
  m.innerHTML = '<div class="gcModalCard"><div class="gcModalTitle">⚒️ ' + esc(item.name) + '</div><div class="gcModalSub">強化 Lv.' + lv + '（ステータス +' + (lv * CONFIG.enhanceStatPerLevel) + '%）</div><div class="gcRewardRow">' + shardSvg(item.rarity, 16) + ' 所持 ' + have + ' ／ 必要 ' + cost + '</div><button type="button" class="gcBtnGold" id="gcEnhDo">強化する</button><button type="button" class="gcBtnGhost" id="gcEnhClose">閉じる</button></div>';
  m.querySelector('#gcEnhClose').addEventListener('click', closeModal);
  m.querySelector('#gcEnhDo').addEventListener('click', function () { closeModal(); window.gachaEnhance(charId); });
};

/* =====================================================================
12. 管理者ツール（fix.js データ管理パネルへ自動注入）
===================================================================== */
function isAdmin() {
  try {
    if (window.isAdmin === true || window.adminMode === true || window.__adminUnlocked === true || window.adminVerified === true) return true;
    var s = gs(); if (s && (s.is_admin || s.isAdmin || s.admin)) return true;
  } catch (e) {}
  return false;
}
function injectAdmin() { return; // Management is centralized in the shop hub.
  if (!isAdmin()) return;
  if (document.getElementById('gcAdminCard')) return;
  var host = document.getElementById('admList') || document.querySelector('.admin-panel') || document.querySelector('[class*="admin"]');
  if (!host) return;
  var card = document.createElement('div');
  card.id = 'gcAdminCard'; card.className = 'gcAdminCard';
  card.innerHTML = '<div class="gcAdminTitle">🛠️ ガチャデータ管理（管理者用）</div>' +
    '<div class="gcAdminRow"><label>ゴールド</label><input type="number" id="gcAdm_gold" value="' + goldOf() + '"></div>' +
    '<div class="gcAdminRow"><label>共通チケット</label><input type="number" id="gcAdm_tc" value="' + tCommonOf() + '"></div>' +
    '<div class="gcAdminRow"><label>キャラチケット</label><input type="number" id="gcAdm_tchar" value="' + tCharOf() + '"></div>' +
    '<div class="gcAdminRow"><label>アイテムチケット</label><input type="number" id="gcAdm_titem" value="' + tItemOf() + '"></div>' +
    '<div class="gcAdminRow"><label>カケラC</label><input type="number" id="gcAdm_shC" value="' + shardOf('C') + '"></div>' +
    '<div class="gcAdminRow"><label>カケラUC</label><input type="number" id="gcAdm_shUC" value="' + shardOf('UC') + '"></div>' +
    '<div class="gcAdminRow"><label>カケラR</label><input type="number" id="gcAdm_shR" value="' + shardOf('R') + '"></div>' +
    '<div class="gcAdminRow"><label>カケラSR</label><input type="number" id="gcAdm_shSR" value="' + shardOf('SR') + '"></div>' +
    '<button type="button" class="gcAdminApply" id="gcAdmApply">適用する</button>';
  host.appendChild(card);
  card.querySelector('#gcAdmApply').addEventListener('click', function () {
    function num(id) { var el = document.getElementById(id); return el ? (parseInt(el.value, 10) || 0) : 0; }
    gset('gold', num('gcAdm_gold')); gset('gacha_tickets', num('gcAdm_tc'));
    gset('gacha_ticket_char', num('gcAdm_tchar')); gset('gacha_ticket_item', num('gcAdm_titem'));
    gset('gacha_shard_C', num('gcAdm_shC')); gset('gacha_shard_UC', num('gcAdm_shUC'));
    gset('gacha_shard_R', num('gcAdm_shR')); gset('gacha_shard_SR', num('gcAdm_shSR'));
    saveAll(); refreshGashaPage();
    toast('🛠️ ガチャデータを更新しました');
  });
}

/* =====================================================================
13. バトル演出（fx2統合・multi.js をラップ）
===================================================================== */
(function battleFx() {
  var prevPopup = window.showCharacterPopup;
  if (typeof prevPopup === 'function' && !prevPopup.__gcfWrapped) {
    var wrapped = function (memberId, amount, type) {
      var r = prevPopup.apply(this, arguments);
      try {
        if (type === 'attack') {
          setTimeout(function () {
            var el = document.getElementById('multiBossImage');
            var rect = el && el.getBoundingClientRect && el.style.display !== 'none' ? el.getBoundingClientRect() : { left: innerWidth / 2 - 60, top: innerHeight / 3, width: 120, height: 120 };
            spawnExplosion(rect.left + rect.width / 2, rect.top + rect.height / 2);
          }, 600);
        } else {
          document.body.classList.add('gcShake');
          setTimeout(function () { document.body.classList.remove('gcShake'); }, 340);
        }
      } catch (e) {}
      return r;
    };
    wrapped.__gcfWrapped = true;
    window.showCharacterPopup = wrapped;
  }
  function spawnExplosion(cx, cy) {
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:' + cx + 'px;top:' + cy + 'px;z-index:340;pointer-events:none;';
    var core = document.createElement('div');
    core.style.cssText = 'position:absolute;left:0;top:0;width:46px;height:46px;margin:-23px;border-radius:50%;background:radial-gradient(circle,#fff,#ffe9a8 26%,#ff8a3d 54%,transparent 74%);mix-blend-mode:screen;animation:gcPuffA .5s forwards;';
    box.appendChild(core);
    var ring = document.createElement('div');
    ring.style.cssText = 'position:absolute;left:0;top:0;width:64px;height:64px;margin:-32px;border-radius:50%;border:3px solid rgba(255,210,120,.95);animation:gcRingOut .52s forwards;';
    box.appendChild(ring);
    document.body.appendChild(box);
    setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 620);
  }
})();

/* =====================================================================
14. 起動・フック
===================================================================== */
function gachaTick() { injectHeaderGold(); buildGashaPage(); injectAdmin(); }
function gachaAfterLogin() { injectHeaderGold(); buildGashaPage(); refreshGashaPage(); checkLoginBonus(); injectAdmin(); }
window.onAppLoaded(function () { gachaAfterLogin(); });
(function attachWatchers() {
  var obs = null;
  function observe() {
    var view = document.getElementById('view-party');
    if (!view || obs) return;
    if (typeof MutationObserver === 'undefined') return;
    obs = new MutationObserver(function () {
      var page = document.getElementById('pgPageGasha');
      if (page && !page.querySelector('.gcRoot')) requestAnimationFrame(buildGashaPage);
    });
    obs.observe(view, { childList: true, subtree: true });
  }
  function boot() { observe(); gachaTick(); setInterval(gachaTick, 900); setInterval(function () { if (loggedIn()) checkLoginBonus(); }, 60000); }
  if (document.readyState !== 'loading') setTimeout(boot, 450);
  else document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 450); });
})();
console.log('🎰 gacha.js 完全統合版 適用完了（三門の神託＋派手演出＋管理者ツール＋バトル演出）');
})();
// ==========================================================================
// 🎰 gacha.js 修正パッチ（末尾追記・新規ファイル不要）
//   ① ヘッダー通貨をXP(Lvバッジ)と同じスタイルに統一＋ヘッダー文字消去
//   ② 「ダブり」→「↓変換」
//   ③ 上部に ゴールド/チケット/カケラ をXP風に表示
//   ④ 図鑑(キャラ)から強化可能に
//   ※ app.js / fix.js / multi.js / style.css / index.html は不変更
// ==========================================================================
(function applyGachaFixPatch() {
"use strict";
if (window.__gachaFixApplied) return;
window.__gachaFixApplied = true;

/* ---------- 0. スタイル ---------- */
(function injectFixCss() {
if (document.getElementById('gcFixCss')) return;
var s = document.createElement('style');
s.id = 'gcFixCss';
s.textContent = [
/* 旧・浮いていたゴールドピルとヘッダー文字を消す */
'#gcHeaderGold{display:none !important;}',
'#headerTitleText{display:none !important;}',
/* XP(Lvバッジ)と同一スタイルの通貨バッジ */
'.gch-badges{display:inline-flex;gap:4px;align-items:center;margin-left:6px;flex-wrap:nowrap;}',
'.gch-badge{font-size:11px !important;font-weight:900 !important;font-family:monospace !important;',
'  padding:1px 6px !important;border-radius:4px !important;text-shadow:none !important;white-space:nowrap;}',
'.gch-badge.gold{color:var(--word-so);background:rgba(245,158,11,0.1);border:1px solid var(--word-so);box-shadow:0 0 8px rgba(245,158,11,0.4);}',
'.gch-badge.ticket{color:var(--cosmic-cyan);background:rgba(0,240,255,0.1);border:1px solid var(--cosmic-cyan);box-shadow:0 0 8px rgba(0,240,255,0.4);}',
'.gch-badge.shard{color:var(--cosmic-purple-light);background:rgba(192,132,252,0.1);border:1px solid var(--cosmic-purple-light);box-shadow:0 0 8px rgba(192,132,252,0.4);}',
/* 図鑑(キャラ)カード */
'#ptyList.gcx-active > .pty-card,#ptyList.gcx-active > .pty-empty{display:none !important;}',
'.gcx-list{display:flex;flex-direction:column;gap:12px;max-width:420px;margin:0 auto;width:100%;}',
'.gcx-card{position:relative;display:flex;gap:13px;padding:15px 14px 15px 18px;border-radius:15px;border:1.5px solid rgba(200,144,42,.28);',
'  background:linear-gradient(165deg, rgba(255,255,255,.05), rgba(0,0,0,.2) 40%),linear-gradient(180deg,#3b3126,#262019 55%,#1b1510);',
'  box-shadow:0 8px 20px rgba(0,0,0,.5);}',
'.gcx-card::before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:0 3px 3px 0;background:linear-gradient(180deg,var(--g),rgba(200,144,42,.4));box-shadow:0 0 8px var(--g);}',
'.gcx-emblem{flex:0 0 auto;width:54px;height:54px;display:flex;align-items:center;justify-content:center;font-size:28px;border-radius:14px;overflow:hidden;',
'  background:radial-gradient(circle at 35% 30%, rgba(255,255,255,.12), rgba(0,0,0,.5));border:1.5px solid var(--g);box-shadow:0 0 14px var(--g);}',
'.gcx-emblem img{width:100%;height:100%;object-fit:cover;}',
'.gcx-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;}',
'.gcx-name{font-family:"Noto Serif JP",serif;font-size:16px;font-weight:900;color:#f3e5c0;}',
'.gcx-lv{font-family:monospace;font-size:11px;font-weight:800;color:#67d8d2;}',
'.gcx-actions{display:flex;gap:8px;margin-top:6px;}',
'.gcx-btn{flex:1;font-family:"Noto Serif JP",serif;font-size:12px;font-weight:900;padding:9px 8px;border-radius:10px;cursor:pointer;border:1.5px solid rgba(245,196,81,.5);',
'  background:linear-gradient(180deg,#4a3b24,#2e2415 55%,#1f1809);color:#fde68a;}',
'.gcx-btn:active{transform:scale(.97);}',
'.gcx-btn.off{opacity:.45;cursor:default;}',
'.gcx-empty{width:100%;text-align:center;font-size:12px;color:#8a7a5f;padding:24px 16px;border:1px dashed rgba(200,144,42,.3);border-radius:12px;background:rgba(0,0,0,.25);}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();

function escF(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function stF() { return (typeof userStats !== 'undefined' && userStats && typeof userStats === 'object') ? userStats : null; }
function toastF(m) { try { if (window.showToast) window.showToast(m, 'ok'); } catch (e) {} }

/* 図鑑用キャラ定義（gacha.js の POOL と同じ内容に揃えてください） */
var GCX_CHARS = [
{ id: 'tangon',  name: 'タンゴン',           rarity: 'SR', icon: 'img:tangon.png', glow: '251,191,36' },
{ id: 'ch_r01',  name: 'Placeholder・炎騎士', rarity: 'R',  icon: '🔥', glow: '249,115,22' },
{ id: 'ch_uc01', name: 'Placeholder・見習い', rarity: 'UC', icon: '🧙', glow: '0,240,255' },
{ id: 'ch_c01',  name: 'Placeholder・門番',   rarity: 'C',  icon: '💂', glow: '148,163,184' }
];

/* ---------- ①③ ヘッダー通貨バッジ（XPと同じスタイル） ---------- */
function renderHeaderBadges() {
var slot = document.getElementById('headerLevelTextSlot');
if (!slot || !slot.parentElement) return;
var wrap = document.getElementById('gchBadges');
if (!wrap) {
wrap = document.createElement('span');
wrap.id = 'gchBadges';
wrap.className = 'gch-badges';
slot.parentElement.insertBefore(wrap, slot.nextSibling);
}
var s = stF(); if (!s) return;
var gold = s.gold || 0;
var tk = (s.gacha_tickets || 0) + (s.gacha_ticket_char || 0) + (s.gacha_ticket_item || 0);
var sh = (s.gacha_shard_C || 0) + (s.gacha_shard_UC || 0) + (s.gacha_shard_R || 0) + (s.gacha_shard_SR || 0);
wrap.innerHTML =
'<span class="gch-badge gold">G ' + gold.toLocaleString() + '</span>' +
'<span class="gch-badge ticket">券 ' + tk + '</span>' +
'<span class="gch-badge shard">欠 ' + sh + '</span>';
}

/* ---------- ② 「ダブり」→「↓変換」 ---------- */
function fixDupeText() {
var notes = document.querySelectorAll('.gcDupeNote');
for (var i = 0; i < notes.length; i++) {
var n = notes[i];
if (n.innerHTML.indexOf('ダブり') !== -1) {
n.innerHTML = n.innerHTML.replace('ダブり', '↓変換').replace('↓変換 →', '↓変換');
}
}
}

/* ---------- ④ 図鑑(キャラ)から強化 ---------- */
function enhCostF(lv) { return (lv + 1) * 1; }
function doEnhanceF(charId) {
var s = stF(); if (!s) return;
var ch = null;
for (var i = 0; i < GCX_CHARS.length; i++) if (GCX_CHARS[i].id === charId) ch = GCX_CHARS[i];
if (!ch) return;
var owned = s['gacha_inv_' + 'char'] || [];
if (owned.indexOf(charId) < 0) { toastF('まだ所持していません'); return; }
var lv = ((s.gacha_enhance || {})[charId]) || 0;
var cost = enhCostF(lv);
var have = (s['gacha_shard_' + ch.rarity]) || 0;
if (have < cost) { toastF(ch.rarity + 'のカケラが足りません（' + have + '/' + cost + '）'); return; }
s['gacha_shard_' + ch.rarity] = have - cost;
var e = s.gacha_enhance || {}; e[charId] = lv + 1; s.gacha_enhance = e;
try { window.saveUserStats(); } catch (e2) {}
toastF('⚒️ ' + ch.name + ' を強化 → Lv.' + (lv + 1));
renderCharDex();
renderHeaderBadges();
}
function renderCharDex() {
var list = document.getElementById('ptyList');
var pu = window.__partyUi;
if (!list || !pu) return;
if(document.hidden||!document.getElementById('view-party')?.classList.contains('active')||list.classList.contains('gm-active')) return;
if (pu.cat !== 'char') { list.classList.remove('gcx-active'); return; }
var s = stF();
var owned = (s && (s.gacha_inv_char || [])) || [];
var e = (s && (s.gacha_enhance || {})) || {};
list.classList.add('gcx-active');
var html = '<div class="gcx-list">';
var any = false;
GCX_CHARS.forEach(function (c) {
var has = owned.indexOf(c.id) >= 0;
if (!has) return;
any = true;
var lv = e[c.id] || 0;
var cost = enhCostF(lv);
var have = (s['gacha_shard_' + c.rarity]) || 0;
var can = have >= cost;
var emb = (c.icon && c.icon.indexOf('img:') === 0)
? '<img src="' + escF(c.icon.slice(4)) + '" onerror="this.style.display=\'none\';this.parentNode.textContent=\'🐧\';">'
: escF(c.icon);
html += '<div class="gcx-card" style="--g:rgba(' + c.glow + ',.7)">' +
'<div class="gcx-emblem">' + emb + '</div>' +
'<div class="gcx-body">' +
'<div class="gcx-name">' + escF(c.name) + '</div>' +
'<div class="gcx-lv">強化 Lv.' + lv + ' ／ ' + c.rarity + 'カケラ ' + have + '/' + cost + '</div>' +
'<div class="gcx-actions">' +
'<button type="button" class="gcx-btn' + (can ? '' : ' off') + '" data-gcxenh="' + c.id + '">⚒️ 強化する</button>' +
'</div></div></div>';
});
if (!any) html += '<div class="gcx-empty">キャラをまだ所持していません。ガシャで仲間にしましょう。</div>';
html += '</div>';
list.innerHTML = html;
}

/* ---------- イベント（委譲・1回ガード） ---------- */
document.addEventListener('click', function (e) {
var t = e.target; if (!t || !t.closest) return;
var b = t.closest('[data-gcxenh]');
if (b) { e.stopPropagation(); doEnhanceF(b.getAttribute('data-gcxenh')); }
}, true);

/* ---------- 監視 ---------- */
function tick() {
renderHeaderBadges();
fixDupeText();
var pu = window.__partyUi;
if (pu && pu.cat === 'char') renderCharDex();
}
setInterval(tick, 500);
window.onTabChange(function (tabId) {
if (tabId === 'party') setTimeout(function () { renderCharDex(); renderHeaderBadges(); }, 60);
});
(function bootF() {
function run() { renderHeaderBadges(); fixDupeText(); }
if (document.readyState !== 'loading') setTimeout(run, 400);
else document.addEventListener('DOMContentLoaded', function () { setTimeout(run, 400); });
})();
console.log('🎰 gacha修正パッチ（ヘッダーXP統一＋↓変換＋図鑑強化）適用完了');
})();
// =====================================================================
// 🎰 ガチャデータ管理（管理者ツール「データ管理」内へ自動注入）
//   ・gacha.js の「末尾」にそのまま追記（新規ファイル不要）
//   ・fix.js の #admList に .admRow.in 形式で行を差し込む＝ネイティブ同様式
//   ・renderRows() の全消去にも MutationObserver で自動追従
//   ・「自分」も「他ユーザー(読み込み)」も編集可（他はクラウド直書き）
// =====================================================================
(function () {
"use strict";
return; // Retired duplicate gacha administration UI.
if (window.__gachaAdminV3) return;
window.__gachaAdminV3 = true;

/* ---------- 自己完結ヘルパー ---------- */
function isOther() { try { return !!(window.__admTarget && window.__admTarget.mode === 'other'); } catch (e) { return false; } }
function stats() {
  if (isOther()) {
    var s = window.__admTarget.snap || (window.__admTarget.snap = {});
    if (!s.userStats || typeof s.userStats !== 'object') s.userStats = {};
    return s.userStats;
  }
  return (typeof userStats !== 'undefined' && userStats && typeof userStats === 'object') ? userStats : {};
}
function persist() {
  if (isOther()) {
    try {
      if (window.fbSetDoc && window.fbDoc && window.db && window.__admTarget && window.__admTarget.uid) {
        window.fbSetDoc(window.fbDoc(window.db, 'users/' + window.__admTarget.uid),
          { userStats: stats(), updatedAt: new Date().toISOString() }, { merge: true });
      }
    } catch (e) {}
    toastA('他ユーザーのガチャデータを保存しました');
  } else {
    try { window.saveUserStats(); } catch (e) {}
    toastA('ガチャデータを保存しました');
  }
}
function toastA(m) { try { if (window.showToast) window.showToast(m, 'ok'); } catch (e) {} }
function num(v) { v = parseInt(v, 10); return isFinite(v) ? Math.max(0, v) : 0; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

/* プール（本体と同期したい場合は本体側で window.__gachaPOOL = POOL; を1行足すだけ） */
var POOL_A = (window.__gachaPOOL && window.__gachaPOOL.chars) ? window.__gachaPOOL : {
  chars: [
    { id: 'tangon', name: 'タンゴン', rarity: 'SR' },
    { id: 'ch_r01', name: 'Placeholder・炎騎士', rarity: 'R' },
    { id: 'ch_uc01', name: 'Placeholder・見習い', rarity: 'UC' },
    { id: 'ch_c01', name: 'Placeholder・門番', rarity: 'C' }
  ],
  weapons: [
    { id: 'fire_sword', name: '業火の大剣', rarity: 'R' },
    { id: 'wp_uc01', name: 'Placeholder・短剣', rarity: 'UC' },
    { id: 'wp_c01', name: 'Placeholder・棍棒', rarity: 'C' }
  ],
  armors: [
    { id: 'cosmic_shield', name: '星屑の盾', rarity: 'R' },
    { id: 'ar_uc01', name: 'Placeholder・軽鎧', rarity: 'UC' },
    { id: 'ar_c01', name: 'Placeholder・布盾', rarity: 'C' }
  ]
};

/* ---------- 現在値テキスト ---------- */
function nowGold(st) { return String(st.gold || 0); }
function nowTickets(st) { return '共' + (st.gacha_tickets || 0) + ' / キャラ' + (st.gacha_ticket_char || 0) + ' / アイテム' + (st.gacha_ticket_item || 0); }
function nowShards(st) { return 'C' + (st.gacha_shard_C || 0) + ' UC' + (st.gacha_shard_UC || 0) + ' R' + (st.gacha_shard_R || 0) + ' SR' + (st.gacha_shard_SR || 0); }
function nowChars(st) { return '所持' + ((st.gacha_inv_char || []).length) + '体'; }
function nowItems(st) { return '武器' + ((st.gacha_inv_weapon || []).length) + ' / 防具' + ((st.gacha_inv_armor || []).length); }

/* ---------- 行ビルダー（★必ず class="admRow in"＝表示保証） ---------- */
function line(k, label, val) {
  return '<div class="line"><input type="number" min="0" data-k="' + k + '" value="' + val + '"><span class="unit">' + esc(label) + '</span></div>';
}
function admRow(id, ico, name, desc, nowTxt, editHtml) {
  return '<div class="admRow in" data-gcrow="' + id + '">' +
    '<div class="admTop"><div class="admIco">' + ico + '</div><div class="admBody">' +
    '<div class="admName">' + esc(name) + '</div>' +
    '<div class="admNow"><span class="tick"></span><span class="val">' + esc(nowTxt) + '</span></div>' +
    '<div class="admDesc">' + esc(desc) + '</div></div>' +
    '<div class="admActs"><button class="admBtn edit" type="button">編集</button><button class="admBtn reset" type="button">リセット</button></div></div>' +
    '<div class="admEdit"><div class="lab">新しい値</div>' + editHtml +
    '<div class="saveRow"><button class="back" type="button">やめる</button><button class="go" type="button">保存</button></div></div>' +
    '<div class="admConfirm"><span>本当にリセットしますか？</span><button class="admNo" type="button">やめる</button><button class="admYes" type="button">リセット</button></div></div>';
}
function buildRows() {
  var st = stats();
  var h = '<div class="admRow in" style="opacity:1;animation:none;"><div class="admTop"><div class="admIco">🎰</div><div class="admBody"><div class="admName">ガチャデータ</div><div class="admDesc">ゴールド／チケット／カケラ／所持／強化Lv／天井</div></div></div></div>';
  h += admRow('gold', '🪙', 'ゴールド', 'ガシャで使う通貨', nowGold(st), line('gold', 'ゴールド', st.gold || 0));
  h += admRow('tickets', '🎟️', 'ガチャチケット', '共通／キャラ／アイテム', nowTickets(st),
    line('tc', '共通', st.gacha_tickets || 0) + line('tch', 'キャラ', st.gacha_ticket_char || 0) + line('ti', 'アイテム', st.gacha_ticket_item || 0));
  h += admRow('shards', '💎', 'カケラ', '強化素材（レア度別）', nowShards(st),
    line('sc', 'C', st.gacha_shard_C || 0) + line('suc', 'UC', st.gacha_shard_UC || 0) + line('sr', 'R', st.gacha_shard_R || 0) + line('ssr', 'SR', st.gacha_shard_SR || 0));
  var chEd = '';
  POOL_A.chars.forEach(function (c) {
    var owned = (st.gacha_inv_char || []).indexOf(c.id) >= 0;
    var lv = ((st.gacha_enhance || {})[c.id]) || 0;
    chEd += '<div class="line" style="margin-bottom:6px;"><span style="flex:1;display:flex;align-items:center;gap:6px;"><input type="checkbox" data-chown="' + c.id + '"' + (owned ? ' checked' : '') + ' style="width:auto;flex:0 0 auto;">' + esc(c.name) + ' <span style="font-size:9px;color:#8a7a5f;">' + c.rarity + '</span></span><input type="number" min="0" data-chlv="' + c.id + '" value="' + lv + '" style="max-width:70px;"><span class="unit">Lv</span></div>';
  });
  h += admRow('chars', '🐧', 'キャラ（所持と強化Lv）', 'チェック＝所持／数値＝強化Lv', nowChars(st), chEd);
  var itEd = '';
  POOL_A.weapons.concat(POOL_A.armors).forEach(function (it) {
    var arr = it.id && (POOL_A.weapons.indexOf(it) >= 0) ? (st.gacha_inv_weapon || []) : (st.gacha_inv_armor || []);
    var kind = (POOL_A.weapons.indexOf(it) >= 0) ? 'weapon' : 'armor';
    var owned = arr.indexOf(it.id) >= 0;
    itEd += '<div class="line" style="margin-bottom:6px;"><span style="flex:1;display:flex;align-items:center;gap:6px;"><input type="checkbox" data-itown="' + it.id + '" data-itkind="' + kind + '"' + (owned ? ' checked' : '') + ' style="width:auto;flex:0 0 auto;">' + esc(it.name) + ' <span style="font-size:9px;color:#8a7a5f;">' + it.rarity + '</span></span></div>';
  });
  h += admRow('items', '🗡️', 'アイテム（武器・防具の所持）', 'チェック＝所持', nowItems(st), itEd);
  return h;
}

/* ---------- 保存 / リセット ---------- */
function updateRowNow(row) {
  var st = stats();
  var id = row.getAttribute('data-gcrow');
  var val = row.querySelector('.admNow .val');
  if (!val) return;
  var map = { gold: nowGold(st), tickets: nowTickets(st), shards: nowShards(st), chars: nowChars(st), items: nowItems(st) };
  if (map[id] !== undefined) val.textContent = map[id];
}
function saveRow(row) {
  var st = stats();
  var id = row.getAttribute('data-gcrow');
  if (id === 'gold') st.gold = num(row.querySelector('[data-k="gold"]').value);
  else if (id === 'tickets') { st.gacha_tickets = num(row.querySelector('[data-k="tc"]').value); st.gacha_ticket_char = num(row.querySelector('[data-k="tch"]').value); st.gacha_ticket_item = num(row.querySelector('[data-k="ti"]').value); }
  else if (id === 'shards') { st.gacha_shard_C = num(row.querySelector('[data-k="sc"]').value); st.gacha_shard_UC = num(row.querySelector('[data-k="suc"]').value); st.gacha_shard_R = num(row.querySelector('[data-k="sr"]').value); st.gacha_shard_SR = num(row.querySelector('[data-k="ssr"]').value); }
  else if (id === 'chars') {
    var inv = []; var enh = st.gacha_enhance || (st.gacha_enhance = {});
    row.querySelectorAll('[data-chown]').forEach(function (cb) { if (cb.checked) inv.push(cb.getAttribute('data-chown')); });
    row.querySelectorAll('[data-chlv]').forEach(function (inp) { enh[inp.getAttribute('data-chlv')] = num(inp.value); });
    st.gacha_inv_char = inv;
  }
  else if (id === 'items') {
    var w = [], a = [];
    row.querySelectorAll('[data-itown]').forEach(function (cb) { if (cb.checked) { var k = cb.getAttribute('data-itkind'); if (k === 'weapon') w.push(cb.getAttribute('data-itown')); else a.push(cb.getAttribute('data-itown')); } });
    st.gacha_inv_weapon = w; st.gacha_inv_armor = a;
  }
  persist();
  updateRowNow(row);
  row.classList.remove('editing');
}
function resetRow(row) {
  var st = stats();
  var id = row.getAttribute('data-gcrow');
  if (id === 'gold') st.gold = 0;
  else if (id === 'tickets') { st.gacha_tickets = 0; st.gacha_ticket_char = 0; st.gacha_ticket_item = 0; }
  else if (id === 'shards') { st.gacha_shard_C = 0; st.gacha_shard_UC = 0; st.gacha_shard_R = 0; st.gacha_shard_SR = 0; }
  else if (id === 'chars') { st.gacha_inv_char = []; st.gacha_enhance = {}; }
  else if (id === 'items') { st.gacha_inv_weapon = []; st.gacha_inv_armor = []; }
  persist();
  updateRowNow(row);
  row.classList.remove('asking');
}

/* ---------- イベント ---------- */
function bind(block) {
  block.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var row = t.closest('[data-gcrow]'); if (!row) return;
    if (t.classList.contains('admBtn') && t.classList.contains('edit')) { row.classList.remove('asking'); row.classList.add('editing'); return; }
    if (t.classList.contains('admBtn') && t.classList.contains('reset')) { row.classList.remove('editing'); row.classList.add('asking'); return; }
    if (t.classList.contains('back')) { row.classList.remove('editing'); return; }
    if (t.classList.contains('admNo')) { row.classList.remove('asking'); return; }
    if (t.classList.contains('go')) { saveRow(row); return; }
    if (t.classList.contains('admYes')) { resetRow(row); return; }
  });
}

/* ---------- 注入（renderRows の全消去に自動追従） ---------- */
function ensure() {
  var list = document.getElementById('admList');
  if (!list) return;
  if (document.getElementById('gcAdmBlock')) return;
  var div = document.createElement('div');
  div.id = 'gcAdmBlock';
  div.innerHTML = buildRows();
  list.appendChild(div);
  bind(div);
}
function attach() {
  var list = document.getElementById('admList');
  if (list && !list.__gcObs) {
    list.__gcObs = true;
    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver(function () { setTimeout(ensure, 30); }).observe(list, { childList: true });
    }
  }
}
setInterval(function () {
  attach();
  if (document.getElementById('admPanel')) ensure();
}, 700);
console.log('🎰 ガチャ管理V3（.in 表示保証＋全消去追従）適用完了');
})();
// =====================================================================
// 🎰 10連 完全修正 v2（自己完結・プール内蔵・これ1本だけ貼る）
// =====================================================================
(function () {
"use strict";
if (window.__gacha10V2) return;
window.__gacha10V2 = true;
var POOL = {
chars: [
{id:'tangon',name:'タンゴン',rarity:'SR',icon:'img:tangon.png',stat:{label:'HP上限',value:3500}},
{id:'ch_r01',name:'炎騎士',rarity:'R',icon:'🔥',stat:{label:'攻撃力',value:220}},
{id:'ch_uc01',name:'見習い魔導士',rarity:'UC',icon:'🧙',stat:{label:'HP上限',value:1200}},
{id:'ch_c01',name:'門番',rarity:'C',icon:'💂',stat:{label:'HP上限',value:800}}],
weapons: [
{id:'fire_sword',name:'業火の大剣',rarity:'R',icon:'🔥🗡️',stat:{label:'攻撃力',value:150}},
{id:'wp_uc01',name:'短剣',rarity:'UC',icon:'🗡️',stat:{label:'攻撃力',value:80}},
{id:'wp_c01',name:'棍棒',rarity:'C',icon:'🏏',stat:{label:'攻撃力',value:40}}],
armors: [
{id:'cosmic_shield',name:'星屑の盾',rarity:'R',icon:'🔮️',stat:{label:'防御力',value:80}},
{id:'ar_uc01',name:'軽鎧',rarity:'UC',icon:'🥋',stat:{label:'防御力',value:45}},
{id:'ar_c01',name:'布盾',rarity:'C',icon:'🛡️',stat:{label:'防御力',value:20}}]};
POOL.chars.forEach(function(i){i.kind='char';});POOL.weapons.forEach(function(i){i.kind='weapon';});POOL.armors.forEach(function(i){i.kind='armor';});
var RAR={C:{full:'COMMON',rgb:'148,163,184'},UC:{full:'UNCOMMON',rgb:'0,240,255'},R:{full:'RARE',rgb:'249,115,22'},SR:{full:'SUPER RARE',rgb:'251,191,36'}};
var ORDER=['C','UC','R','SR'];
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function gs(){return (typeof userStats!=='undefined'&&userStats&&typeof userStats==='object')?userStats:null;}
function gget(k,d){var s=gs();if(!s)return d;var v=s[k];return(v===undefined||v===null)?d:v;}
function gset(k,v){var s=gs();if(!s)return;s[k]=v;}
function saveAll(){try{if(window.saveUserStats)window.saveUserStats();}catch(e){}}
function toast(m){try{if(window.showToast)window.showToast(m,'ok');}catch(e){}}
function iconHtml(it){if(!it)return '❓';if(it.icon&&String(it.icon).indexOf('img:')===0)return '<img src="'+esc(it.icon.slice(4))+'" style="width:56px;height:56px;object-fit:cover;border-radius:10px;" onerror="this.outerHTML=\'❓\'">';return esc(it.icon||'❓');}
function pool(b){return b==='char'?POOL.chars:POOL.weapons.concat(POOL.armors);}
function roll(rates){var r=Math.random()*100,a=0;for(var i=0;i<ORDER.length;i++){a+=(rates[ORDER[i]]||0);if(r<a)return ORDER[i];}return 'C';}
function pick(b,r){var p=pool(b),st=ORDER.indexOf(r);for(var i=st;i<ORDER.length;i++){var c=p.filter(function(x){return x.rarity===ORDER[i];});if(c.length)return c[Math.floor(Math.random()*c.length)];}return p.length?p[Math.floor(Math.random()*p.length)]:null;}
function grant(it){var res={isNew:false,shard:0};if(!it)return res;var inv=gget('gacha_inv_'+it.kind,[]);if(!Array.isArray(inv))inv=[];if(inv.indexOf(it.id)<0){inv.push(it.id);res.isNew=true;}else{res.shard={C:1,UC:3,R:10,SR:50}[it.rarity]||0;gset('gacha_shard_'+it.rarity,gget('gacha_shard_'+it.rarity,0)+res.shard);}gset('gacha_inv_'+it.kind,inv);return res;}
/* CSS */
(function(){if(document.getElementById('g10v2Css'))return;var s=document.createElement('style');s.id='g10v2Css';s.textContent=[
'.g10v2-ov{position:fixed;inset:0;z-index:60000;overflow-y:auto;-webkit-overflow-scrolling:touch;background:radial-gradient(130% 100% at 50% 0%,rgba(90,70,50,.32),transparent 55%),linear-gradient(165deg,#3a2f22,#14100a);display:flex;flex-direction:column;align-items:center;}',
'.g10v2-top{text-align:center;margin:20px 0 8px;}',
'.g10v2-title{font-size:22px;font-weight:900;color:#f3e5c0;}',
'.g10v2-stage{flex:1 0 auto;width:100%;display:flex;align-items:center;justify-content:center;padding:10px 16px;box-sizing:border-box;}',
'.g10v2-gates{display:flex;gap:4.5vw;align-items:flex-end;}',
'.g10v2-gate{width:26vw;max-width:116px;cursor:pointer;}',
'.g10v2-arch{position:relative;width:100%;padding-top:132%;border-radius:999px 999px 10px 10px;overflow:hidden;border:2px solid rgba(var(--rl),.5);background:linear-gradient(180deg,#43382a,#191309);}',
'.g10v2-glow{position:absolute;inset:9% 13%;border-radius:999px 999px 6px 6px;background:radial-gradient(ellipse at 50% 62%,rgba(var(--rl),.9),rgba(var(--rl),.3) 48%,transparent 76%);}',
'.g10v2-r-C{--rl:148,163,184;}.g10v2-r-UC{--rl:0,240,255;}.g10v2-r-R{--rl:249,115,22;}.g10v2-r-SR{--rl:251,191,36;}',
'.g10v2-card{width:min(74vw,300px);border-radius:18px;padding:26px 20px;text-align:center;border:2px solid rgba(var(--rl),.75);box-shadow:0 0 34px rgba(var(--rl),.4);background:linear-gradient(170deg,rgba(30,24,44,.96),rgba(12,9,20,.97));}',
'.g10v2-ico{font-size:64px;margin:8px 0 12px;}',
'.g10v2-name{font-size:20px;font-weight:900;color:#fff;}',
'.g10v2-rar{display:inline-block;margin-top:8px;padding:4px 14px;border-radius:999px;font-size:10px;font-weight:900;color:#0b0b12;background:rgba(var(--rl),1);}',
'.g10v2-note{margin-top:10px;font-size:12px;font-weight:800;color:#c4b5fd;}',
'.g10v2-hint{margin:12px 0 24px;font-size:11px;color:rgba(255,255,255,.55);letter-spacing:.2em;}',
'.g10v2-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:min(94vw,430px);box-sizing:border-box;}',
'.g10v2-cell{border-radius:12px;padding:12px 6px;text-align:center;border:1.5px solid rgba(var(--rl),.7);background:rgba(12,9,20,.96);box-sizing:border-box;}',
'.g10v2-cico{font-size:40px;}',
'.g10v2-cname{font-size:11px;font-weight:800;color:#e8dcc0;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
'.g10v2-cnote{font-size:9px;font-weight:800;color:#c4b5fd;margin-top:4px;}',
'.g10v2-tap{grid-column:1/-1;text-align:center;margin-top:12px;font-size:11px;color:rgba(255,255,255,.55);}'
].join('\n');document.head.appendChild(s);})();
/* 10連を横取り（capture+stop で他パッチより優先） */
document.addEventListener('click',function(e){
var b=e.target&&e.target.closest?e.target.closest('[data-draw]'):null;
if(!b)return;
var p=(b.getAttribute('data-draw')||'').split('_');
if(p[2]!=='10')return;
e.stopImmediatePropagation();e.preventDefault();e.stopPropagation();
run10(p[0],p[1]);
},true);
function run10(banner,currency){
var rates=currency==='ticket'?{C:30,UC:40,R:20,SR:10}:{C:60,UC:30,R:9,SR:1};
if(currency==='gold'){var cost=banner==='char'?2700:1800;if(gget('gold',0)<cost){toast('ゴールドが足りません');return;}gset('gold',gget('gold',0)-cost);}
else{var need=9;var key=banner==='char'?'gacha_ticket_char':'gacha_ticket_item';var spec=gget(key,0)+gget('gacha_tickets',0);if(spec<need){toast('チケットが足りません');return;}var use=Math.min(gget(key,0),need);gset(key,gget(key,0)-use);if(need-use>0)gset('gacha_tickets',gget('gacha_tickets',0)-(need-use));}
var items=[],granted=[];for(var i=0;i<10;i++){var it=pick(banner,roll(rates));items.push(it);granted.push(grant(it));}
saveAll();
var maxR='C';items.forEach(function(it){if(it&&ORDER.indexOf(it.rarity)>ORDER.indexOf(maxR))maxR=it.rarity;});
var ov=document.createElement('div');ov.className='g10v2-ov';
ov.innerHTML='<div class="g10v2-top"><div class="g10v2-title">'+(banner==='char'?'キャラガシャ':'アイテムガシャ')+'・10連</div></div><div class="g10v2-stage"></div><div class="g10v2-hint">門を選べ…</div>';
document.body.appendChild(ov);
var stage=ov.querySelector('.g10v2-stage');
var gates=['C','UC','R'];
stage.innerHTML='<div class="g10v2-gates">'+gates.map(function(r){return '<div class="g10v2-gate g10v2-r-'+maxR+'" data-g="'+r+'"><div class="g10v2-arch"><div class="g10v2-glow"></div></div></div>';}).join('')+'</div>';
stage.querySelectorAll('.g10v2-gate').forEach(function(g){g.addEventListener('click',function(){startReveal();});});
var idx=0;
function startReveal(){idx=0;showOne();}
function showOne(){
var it=items[idx],res=granted[idx];var r=it?it.rarity:'C';
stage.innerHTML='<div class="g10v2-card g10v2-r-'+r+'"><div class="g10v2-ico">'+iconHtml(it)+'</div><div class="g10v2-name">'+esc(it?it.name:'???')+'</div><div class="g10v2-rar">'+(RAR[r]?RAR[r].full:'')+'</div><div class="g10v2-note">'+(res.isNew?'NEW!':'↓変換 +'+res.shard+' カケラ')+'</div></div>';
ov.querySelector('.g10v2-hint').textContent=(idx+1)+' / 10 ／ タップで次へ';
stage.onclick=function(){idx++;if(idx>=10)showSum();else showOne();};
}
function showSum(){
stage.onclick=null;
ov.querySelector('.g10v2-hint').textContent='タップで閉じる';
stage.innerHTML='<div class="g10v2-grid">'+items.map(function(it,i){var res=granted[i];var r=it?it.rarity:'C';return '<div class="g10v2-cell g10v2-r-'+r+'"><div class="g10v2-cico">'+iconHtml(it)+'</div><div class="g10v2-cname">'+esc(it?it.name:'???')+'</div><div class="g10v2-cnote">'+(res.isNew?'NEW':'+'+res.shard)+'</div></div>';}).join('')+'<div class="g10v2-tap">タップで閉じる</div></div>';
stage.onclick=function(){ov.parentNode&&ov.parentNode.removeChild(ov);};
}
}
console.log('🎰 10連完全修正v2（自己完結）適用完了');
})();
// ==========================================================================
// 🎰 10連グリッド「スクロールなし＋アイコン拡大」修正パッチ
//    ・2列×5段をスマホ画面内に完全収容（スクロール不要）
//    ・アイコンを大きく、余白を詰める
//    ※前のパッチより後に読み込まれることで上書き生效
// ==========================================================================
(function applyTenGridFitPatch() {
"use strict";
if (window.__tenGridFitApplied) return;
window.__tenGridFitApplied = true;

(function injectCss() {
if (document.getElementById('tsgFitCss')) return;
var s = document.createElement('style');
s.id = 'tsgFitCss';
s.textContent = [
/* オーバーレイ：スクロール禁止 */
'.tsg-ov{overflow:hidden;}',
/* 上部タイトルを詰める */
'.tsg-top{margin:10px 0 4px;}',
'.tsg-title{font-size:18px;}',
/* ステージ：残り高さいっぱいに使う */
'.tsg-stage{flex:1 1 0;min-height:0;padding:4px 12px;}',
/* 下部ヒントを詰める */
'.tsg-hint{margin:4px 0 10px;font-size:10px;}',
/* グリッド：5行固定で高さいっぱいに敷く */
'.tsg-grid{grid-template-rows:repeat(5,1fr);height:100%;max-height:100%;gap:6px;}',
/* セル：縦横比固定を解除→行の高さに合わせる */
'.tsg-cell{aspect-ratio:auto;border-radius:10px;padding:2px 4px;gap:2px;}',
/* アイコン：大きく（画面高さ連動） */
'.tsg-cico{font-size:min(7vh,52px);line-height:1.1;}',
'.tsg-cico img{width:min(7vh,52px);height:min(7vh,52px);border-radius:8px;}',
/* 名前・メモも画面高さ連動で読みやすく */
'.tsg-cname{font-size:min(2.2vh,12px);}',
'.tsg-cnote{font-size:min(1.8vh,10px);}',
/* 「タップで閉じる」は下部ヒントに統合（行の無駄を削除） */
'.tsg-tap{display:none;}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();

console.log('🎰 10連グリッド ノースクロールfit パッチ適用完了');
})();
// ==========================================================================
// 🎆 10連演出復活パッチ（gacha.js末尾に追記／既存コード不変更）
//    ・10連の各結果カード出現時に単発同等の演出を再生
//      閃光(gcFlash)＋ピカーン(R/SR)＋レアリティ別大演出＋画面揺れ
//      SR:鳳/竜 R:隕石/雷 UC:オーロラ/花びら C:煙
//    ・最後の5×2グリッドは時間差でフリップイン
//    ・門のグローも単発同様パルス点滅
//    ・10連DOM（g10v2-* / tsg-*）の両方に自動対応
// ==========================================================================
(function applyTenEffectsPatch() {
"use strict";
if (window.__tenFxApplied) return;
window.__tenFxApplied = true;

var RGB = { C: '148,163,184', UC: '0,240,255', R: '249,115,22', SR: '251,191,36' };

/* ---------- CSS補強（既存キーフレームを流用） ---------- */
(function injectCss() {
if (document.getElementById('tenFxCss')) return;
var s = document.createElement('style');
s.id = 'tenFxCss';
s.textContent = [
'.g10v2-glow,.tsg-glow{animation:gcGlowPulse 2.4s infinite;}',
'.tenfx-layer{position:absolute;inset:0;z-index:7;pointer-events:none;overflow:hidden;}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();

/* ---------- 演出ヘルパー（単発と同じDOM/クラスを生成） ---------- */
function ovOf(el) { return el.closest('.g10v2-ov') || el.closest('.tsg-ov'); }
function rarOf(el) { var m = (el.className || '').match(/(?:g10v2|tsg)-r-(SR|R|UC|C)/); return m ? m[1] : 'C'; }
function fxLayer(ov) {
var l = ov.querySelector('.tenfx-layer');
if (!l) { l = document.createElement('div'); l.className = 'tenfx-layer'; ov.appendChild(l); }
return l;
}
function flash(ov, rar) {
var f = ov.querySelector('.gcFlash');
if (!f) { f = document.createElement('div'); f.className = 'gcFlash'; ov.appendChild(f); }
f.style.setProperty('--gc-fl', RGB[rar] || RGB.C);
f.classList.remove('gcFlashOn'); void f.offsetWidth; f.classList.add('gcFlashOn');
}
function shake(ov) { ov.classList.add('gcShake'); setTimeout(function () { ov.classList.remove('gcShake'); }, 500); }
function pika(ov, rar) {
var p = document.createElement('div');
p.className = 'gcPika' + (rar === 'SR' ? ' sr' : '');
ov.appendChild(p);
setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 700);
var n = rar === 'SR' ? 12 : 7;
for (var i = 0; i < n; i++) {
var s = document.createElement('span');
s.className = 'gcPikaStar';
s.style.setProperty('--ang', (i * (360 / n)) + 'deg');
s.style.animationDelay = (i * 0.03) + 's';
ov.appendChild(s);
(function (ss) { setTimeout(function () { if (ss.parentNode) ss.parentNode.removeChild(ss); }, 900); })(s);
}
}
function fxPhoenix(l) {
var el = document.createElement('div'); el.className = 'gcFxPhoenix';
el.innerHTML = '<span class="gcFxPhoenixBody">🦅</span>';
for (var i = 0; i < 10; i++) {
var s = document.createElement('i'); s.className = 'gcFxPhoenixSpark';
s.style.animationDelay = (i * 0.08) + 's';
s.style.top = (30 + Math.random() * 40) + '%';
s.style.left = (10 + Math.random() * 80) + '%';
el.appendChild(s);
}
l.appendChild(el);
setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1700);
}
function fxDragon(l, ov) {
var el = document.createElement('div'); el.className = 'gcFxDragon'; el.textContent = '🐉';
l.appendChild(el); shake(ov);
setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1700);
}
function fxMeteor(l) {
var m = document.createElement('div'); m.className = 'gcFxMeteor'; m.textContent = '☄️'; l.appendChild(m);
var im = document.createElement('div'); im.className = 'gcFxImpact'; l.appendChild(im);
setTimeout(function () { if (m.parentNode) m.parentNode.removeChild(m); if (im.parentNode) im.parentNode.removeChild(im); }, 1500);
}
function fxLightning(l, ov) {
var w = document.createElement('div'); w.className = 'gcFxWhite'; l.appendChild(w);
var b = document.createElement('div'); b.className = 'gcFxLightningBolt'; b.textContent = '⚡'; l.appendChild(b);
shake(ov);
setTimeout(function () { if (w.parentNode) w.parentNode.removeChild(w); if (b.parentNode) b.parentNode.removeChild(b); }, 900);
}
function fxAurora(l) {
var a = document.createElement('div'); a.className = 'gcFxAurora'; l.appendChild(a);
setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 1700);
}
function fxPetals(l) {
for (var i = 0; i < 12; i++) {
var p = document.createElement('span'); p.className = 'gcFxPetal';
p.style.left = Math.round(Math.random() * 100) + '%';
p.style.animationDuration = (1.2 + Math.random() * 1.4).toFixed(2) + 's';
p.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's';
l.appendChild(p);
(function (pp) { setTimeout(function () { if (pp.parentNode) pp.parentNode.removeChild(pp); }, 3000); })(p);
}
}
function fxPuff(l) {
var p = document.createElement('div'); p.className = 'gcFxPuff'; l.appendChild(p);
setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 600);
}
function playFx(ov, rar) {
var l = fxLayer(ov); var p = Math.random();
if (rar === 'SR') { if (p < 0.5) fxPhoenix(l); else fxDragon(l, ov); }
else if (rar === 'R') { if (p < 0.5) fxMeteor(l); else fxLightning(l, ov); }
else if (rar === 'UC') { if (p < 0.5) fxAurora(l); else fxPetals(l); }
else fxPuff(l);
}

/* ---------- カード出現を検知して演出を再生 ---------- */
function handleCard(card) {
if (card.__tenFxDone) return; card.__tenFxDone = true;
var ov = ovOf(card); if (!ov) return;
var rar = rarOf(card);
flash(ov, rar);
if (rar === 'SR' || rar === 'R') pika(ov, rar);
playFx(ov, rar);
}
function handleGrid(grid) {
if (grid.__tenFxDone) return; grid.__tenFxDone = true;
var cells = grid.querySelectorAll('.g10v2-cell,.tsg-cell');
for (var i = 0; i < cells.length; i++) {
cells[i].style.animation = 'gcFlipIn .45s both';
cells[i].style.animationDelay = (i * 0.06) + 's';
}
}
function scanNode(n) {
if (!n || n.nodeType !== 1) return;
if (n.matches && (n.matches('.g10v2-card') || n.matches('.tsg-card'))) { handleCard(n); return; }
if (n.matches && (n.matches('.g10v2-grid') || n.matches('.tsg-grid'))) { handleGrid(n); return; }
if (n.querySelector) {
var c = n.querySelector('.g10v2-card,.tsg-card');
if (c) { handleCard(c); return; }
var g = n.querySelector('.g10v2-grid,.tsg-grid');
if (g) handleGrid(g);
}
}
if (typeof MutationObserver !== 'undefined') {
var mo = new MutationObserver(function (muts) {
for (var i = 0; i < muts.length; i++) {
var added = muts[i].addedNodes;
if (!added) continue;
for (var j = 0; j < added.length; j++) scanNode(added[j]);
}
});
mo.observe(document.body, { childList: true, subtree: true });
}

/* ---------- 門タップ時の閃光 ---------- */
document.addEventListener('click', function (e) {
var g = e.target && e.target.closest ? e.target.closest('.g10v2-gate,.tsg-gate') : null;
if (!g) return;
var ov = ovOf(g); if (!ov) return;
flash(ov, rarOf(g));
}, true);

console.log('🎆 10連演出復活パッチ適用完了');
})();
// ==========================================================================
// 🎨 ガチャ演出・絵文字撤去パッチ（末尾追記／基盤コード不変更）
//    鳳／竜／隕石／雷 の4演出を絵文字→SVG/CSS描画へ置き換え
//    ・動きは既存キーフレーム(gcPhoenixFly/gcDragonA/gcMeteorFall/gcBolt)を流用
//    ・見た目だけ差し替えるのでタイミング・演出フローは1行も変更しない
//    ※アイテムアイコン(🔥️等)は「アイテム絵の仮置き」なのでそのまま維持
// ==========================================================================
(function applyGachaFxDeEmojiPatch() {
"use strict";
if (window.__gcFxDeEmojiApplied) return;
window.__gcFxDeEmojiApplied = true;

function enc(svg) { return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")'; }

/* ---- 炎の不死鳥（金色グラデ） ---- */
var PHOENIX_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><defs><linearGradient id="p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff7d6"/><stop offset=".5" stop-color="#fbbf24"/><stop offset="1" stop-color="#f97316"/></linearGradient></defs><path fill="url(#p)" d="M60 88 C52 78 50 68 54 58 C40 62 28 58 20 48 C30 50 38 48 44 42 C34 38 28 30 26 20 C36 28 46 32 54 32 C50 24 52 16 60 10 C68 16 70 24 66 32 C74 32 84 28 94 20 C92 30 86 38 76 42 C82 48 90 50 100 48 C92 58 80 62 66 58 C70 68 68 78 60 88 Z"/></svg>';

/* ---- 竜の頭部シルエット（角×3・開口した顎・頸のスパイク） ---- */
var DRAGON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="#140a10" d="M12 32 L2 38 L12 42 L4 52 L18 48 C24 52 30 54 36 54 C34 64 36 74 44 82 L52 74 L50 86 L60 78 C70 84 82 84 92 78 C84 70 80 62 80 54 C80 44 74 36 64 32 L70 18 L58 26 L54 12 L48 24 L40 16 L40 28 C30 26 20 28 12 32 Z"/></svg>';

(function injectCss() {
if (document.getElementById('gcFxDeEmojiCss')) return;
var s = document.createElement('style');
s.id = 'gcFxDeEmojiCss';
var css = '';

/* 鳳：絵文字を消してSVG炎鳥に（火花トレイルは既存のまま） */
css += '.gcFxPhoenixBody{font-size:0 !important;width:120px;height:90px;background:' + enc(PHOENIX_SVG) + ' center/contain no-repeat;filter:drop-shadow(0 0 14px rgba(249,115,22,.9)) drop-shadow(0 0 30px rgba(251,191,36,.55));}';

/* 竜：黒シルエット＋赤/金のリム光（出現時の金フラッシュも既存通り乗る） */
css += '.gcFxDragon{font-size:0 !important;width:min(52vw,230px);height:min(52vw,230px);background:' + enc(DRAGON_SVG) + ' center/contain no-repeat;filter:drop-shadow(0 0 26px rgba(244,63,94,.85)) drop-shadow(0 0 60px rgba(251,191,36,.45));}';

/* 隕石：岩塊＋炎の尾（CSS描画） */
css += '.gcFxMeteor{font-size:0 !important;width:46px;height:46px;}';
css += '.gcFxMeteor::before{content:"";position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 32% 32%,#ffe4c0 0%,#fb923c 35%,#7c2d12 70%,#431407 100%);box-shadow:0 0 16px rgba(251,146,60,.95),0 0 42px rgba(255,84,68,.55);}';
css += '.gcFxMeteor::after{content:"";position:absolute;left:50%;top:50%;width:150px;height:12px;border-radius:999px;transform-origin:0 50%;transform:rotate(-42deg) translateX(6px);background:linear-gradient(90deg,rgba(255,224,170,.95),rgba(251,146,60,.5) 45%,transparent 80%);filter:blur(1.5px);}';

/* 雷：白→氷青のグラデをclip-pathで切った鋭いボルト */
css += '.gcFxLightningBolt{font-size:0 !important;width:74px;height:150px;margin-left:-37px;background:linear-gradient(180deg,#ffffff 0%,#bae6fd 45%,#38bdf8 100%);clip-path:polygon(58% 0,20% 46%,42% 46%,30% 100%,80% 38%,55% 38%,70% 0);filter:drop-shadow(0 0 18px rgba(125,211,252,.95));}';

s.textContent = css;
(document.head || document.documentElement).appendChild(s);
})();

console.log('🎨 ガチャ演出・絵文字撤去パッチ（SVG/CSS化）適用完了');
})();
// ==========================================================================
// 🎰 10連「単発風オープニング」パッチ（末尾追記／基盤コード不変更）
//    ① 最初の門選択時に単発同款の開幕演出を発火：
//       レアリティ昇格(C→UC→R→SR パルス＋閃光) → 両扉開放 → コア発光 →
//       ピカーン(R/SR)＋画面揺れ → その後カード開始
//    ② 1枚ずつの切り替えを明確化：新カード毎にポップイン＋カウントヒント脈動
//    ※ g10v2 / tsg 両方の10連画面で動作。app.js 等は不変更
// ==========================================================================
(function applyTenGateCeremonyPatch() {
"use strict";
if (window.__tenGateCeremonyApplied) return;
window.__tenGateCeremonyApplied = true;

/* ---------- 0. CSS ---------- */
(function injectTenGateCss() {
if (document.getElementById('tenGateCss')) return;
var s = document.createElement('style');
s.id = 'tenGateCss';
s.textContent = [
/* 10連門の --rl を単発FX変数(--gc-rl)へマップ */
'.g10v2-gate,.tsg-gate{--gc-rl:var(--rl);transition:transform .3s,opacity .5s,filter .5s;}',
/* 非選択の門を沈ませる */
'.g10v2-gate.ten-sink,.tsg-gate.ten-sink{opacity:0;transform:translateY(48%) scale(.9);filter:blur(3px);pointer-events:none;}',
'.g10v2-gate.ten-chosen,.tsg-gate.ten-chosen{transform:scale(1.1);z-index:5;}',
/* 扉開放 */
'.ten-open .gcDoorL{transform:translateX(-114%);opacity:.2;}',
'.ten-open .gcDoorR{transform:translateX(114%);opacity:.2;}',
'.ten-open .gcGateCore{opacity:1;}',
'.ten-open .g10v2-glow,.ten-open .tsg-glow{opacity:1;}',
/* ② カード切替を分かりやすく（新しいカード毎にポップイン） */
'.g10v2-card{animation:gcCardPop .5s cubic-bezier(.18,1.4,.35,1) both;}',
/* カウントヒントの脈動 */
'.g10v2-hint.ten-bump,.tsg-hint.ten-bump{animation:tenHintBump .3s ease;}',
'@keyframes tenHintBump{0%{transform:scale(1)}40%{transform:scale(1.18)}100%{transform:scale(1)}}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();

var ORDER = ['C','UC','R','SR'];
var RGB = { C:'148,163,184', UC:'0,240,255', R:'249,115,22', SR:'251,191,36' };

function famOf(g){ return g.classList.contains('tsg-gate') ? 'tsg' : 'g10v2'; }
function setRar(g, r){ var f = famOf(g); ORDER.forEach(function(k){ g.classList.remove(f + '-r-' + k); }); g.classList.add(f + '-r-' + r); }
function flash(ov, r){
var f = ov.querySelector('.gcFlash');
if (!f) { f = document.createElement('div'); f.className = 'gcFlash'; ov.appendChild(f); }
f.style.setProperty('--gc-fl', RGB[r] || RGB.C);
f.classList.remove('gcFlashOn'); void f.offsetWidth; f.classList.add('gcFlashOn');
}
function ring(g){
var a = g.querySelector('.g10v2-arch,.tsg-arch'); if (!a) return;
var r = document.createElement('span'); r.className = 'gcRing'; a.appendChild(r);
setTimeout(function(){ if (r.parentNode) r.parentNode.removeChild(r); }, 650);
}
function pika(ov, r){
var p = document.createElement('div'); p.className = 'gcPika' + (r === 'SR' ? ' sr' : '');
ov.appendChild(p); setTimeout(function(){ if (p.parentNode) p.parentNode.removeChild(p); }, 700);
var n = r === 'SR' ? 12 : 7;
for (var i = 0; i < n; i++) {
var s = document.createElement('span'); s.className = 'gcPikaStar';
s.style.setProperty('--ang', (i * (360 / n)) + 'deg'); s.style.animationDelay = (i * 0.03) + 's';
ov.appendChild(s);
(function (ss) { setTimeout(function(){ if (ss.parentNode) ss.parentNode.removeChild(ss); }, 900); })(s);
}
}
function injectDoors(g){
var a = g.querySelector('.g10v2-arch,.tsg-arch'); if (!a || a.querySelector('.gcDoorL')) return;
var c = document.createElement('div'); c.className = 'gcGateCore';
var d1 = document.createElement('div'); d1.className = 'gcDoorL';
var d2 = document.createElement('div'); d2.className = 'gcDoorR';
a.appendChild(c); a.appendChild(d1); a.appendChild(d2);
}

/* ---------- ① 門タップをキャプチャで受け、開幕を挟んでから元処理へ ---------- */
document.addEventListener('click', function (e) {
var g = e.target && e.target.closest ? e.target.closest('.g10v2-gate,.tsg-gate') : null;
if (!g || g.__tenDone) return;
var ov = g.closest('.g10v2-ov,.tsg-ov'); if (!ov || ov.__tenBusy) return;
e.stopPropagation(); e.preventDefault();
ov.__tenBusy = true;

var m = g.className.match(/(?:g10v2|tsg)-r-(SR|R|UC|C)/);
var target = m ? m[1] : 'C';
var wrap = g.parentNode;
for (var i = 0; i < wrap.children.length; i++) {
if (wrap.children[i] !== g) wrap.children[i].classList.add('ten-sink');
}
g.classList.add('ten-chosen');
var hint = ov.querySelector('.g10v2-hint,.tsg-hint'); if (hint) hint.textContent = '';

var idx = 0, ti = ORDER.indexOf(target);
function step(){
setRar(g, ORDER[idx]); ring(g); flash(ov, ORDER[idx]);
if (idx >= ti) { land(); return; }
idx++; setTimeout(step, 470);
}
function land(){
injectDoors(g);
setTimeout(function () {
g.classList.add('ten-open');
flash(ov, target);
if (target === 'SR' || target === 'R') pika(ov, target);
ov.classList.add('gcShake'); setTimeout(function(){ ov.classList.remove('gcShake'); }, 500);
setTimeout(function () {
g.__tenDone = true; ov.__tenBusy = false;
var ev;
try { ev = new MouseEvent('click', { bubbles: true, cancelable: true }); }
catch (err) { ev = document.createEvent('MouseEvents'); ev.initMouseEvent('click', true, true, window); }
g.dispatchEvent(ev); /* 元の startReveal へ引き渡す */
}, 430);
}, 250);
}
step();
}, true);

/* ---------- ② カード切替時にヒントを脈動 ---------- */
if (typeof MutationObserver !== 'undefined') {
var mo = new MutationObserver(function (muts) {
for (var i = 0; i < muts.length; i++) {
var t = muts[i].target;
if (t && t.classList && (t.classList.contains('g10v2-hint') || t.classList.contains('tsg-hint'))) {
t.classList.remove('ten-bump'); void t.offsetWidth; t.classList.add('ten-bump');
}
}
});
mo.observe(document.body, { childList: true, subtree: true });
}

console.log('🎰 10連単発風オープニングパッチ（門セレモニー＋切替明確化）適用完了');
})();
// ==========================================================================
// 🎨 演出調整パッチ：隕石撤去＋フェニックス元に戻す
//    ・隕石エフェクトは完全削除（衝撃リングも）
//      → そのままだとRの時に見せ場が無いので、隕石が出ようとした時は
//        雷エフェクトに差し替えて再生（Rの見せ場は維持）
//    ・フェニックスは絵文字除去パッチ以前（🦅絵文字版）へ復元
//    ※ gacha.js の末尾にそのまま貼り付けてください。既存コードは不変更
// ==========================================================================
(function applyFxTweakPatch() {
"use strict";
if (window.__fxTweakApplied) return;
window.__fxTweakApplied = true;

/* ---------- 0. CSS：フェニックス復元＋隕石を隠す ---------- */
(function injectFxTweakCss() {
if (document.getElementById('fxTweakCss')) return;
var s = document.createElement('style');
s.id = 'fxTweakCss';
s.textContent = [
/* フェニックスを元の絵文字版へ（絵文字除去パッチを上書き） */
'.gcFxPhoenixBody{',
'  font-size:64px !important;',
'  width:auto !important;height:auto !important;',
'  background:none !important;',
'  filter:sepia(1) saturate(7) hue-rotate(-28deg) brightness(1.35) drop-shadow(0 0 16px rgba(249,115,22,.95)) !important;',
'}',
/* 隕石：万が一生成されても絶対に表示しない（JS除去と二重保険） */
'.gcFxMeteor,.gcFxImpact{display:none !important;}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();

/* ---------- 1. 隕石を除去し、雷へ差し替え ---------- */
function spawnLightning(layer) {
var ov = (layer.closest) ? layer.closest('.gcOverlay,.g10v2-ov,.tsg-ov') : null;
var w = document.createElement('div'); w.className = 'gcFxWhite';
var b = document.createElement('div'); b.className = 'gcFxLightningBolt'; b.textContent = '⚡';
layer.appendChild(w); layer.appendChild(b);
if (ov) { ov.classList.add('gcShake'); setTimeout(function () { ov.classList.remove('gcShake'); }, 500); }
setTimeout(function () {
if (w.parentNode) w.parentNode.removeChild(w);
if (b.parentNode) b.parentNode.removeChild(b);
}, 900);
}

if (typeof MutationObserver !== 'undefined') {
var mo = new MutationObserver(function (muts) {
for (var i = 0; i < muts.length; i++) {
var added = muts[i].addedNodes;
if (!added) continue;
for (var j = 0; j < added.length; j++) {
var n = added[j];
if (!n || n.nodeType !== 1) continue;
if (n.classList && n.classList.contains('gcFxMeteor')) {
var layer = n.parentNode;
if (n.parentNode) n.parentNode.removeChild(n);
if (layer) spawnLightning(layer);
} else if (n.classList && n.classList.contains('gcFxImpact')) {
if (n.parentNode) n.parentNode.removeChild(n);
}
}
}
});
mo.observe(document.body, { childList: true, subtree: true });
}

console.log('🎨 演出調整パッチ（隕石撤去→雷へ差し替え／フェニックス復元）適用完了');
})();
// ==========================================================================
// 🐧 味方/装備図鑑パッチ（点滅根治＋並び替え追加・末尾追記・既存不変更）
//    ① 味方図鑑のステータス点滅を根治（500ms毎のgcx上書きを描画前に無効化）
//    ② 敵図鑑と同様の並び替えチップを味方と装備にも追加
//       味方＝図鑑順/HP/攻撃/強化 装備＝図鑑順/攻撃/防御
//    ※ 強化ボタン・装備ボタン・ステータス詳細はこのリスト内に統合
//    ※ app.js / fix.js / multi.js / style.css / index.html は不変更
// ==========================================================================
(function applyAllyGearSortPatch() {
"use strict";
if (window.__allyGearSortApplied) return;
window.__allyGearSortApplied = true;

var RAR = {
C: { label: 'コモン', glow: '148,163,184', ink: '#0b0e14' },
UC: { label: 'アンコモン', glow: '34,211,238', ink: '#04201f' },
R: { label: 'レア', glow: '249,115,22', ink: '#2a0f02' },
SR: { label: 'スーパーレア', glow: '251,191,36', ink: '#1a1206' }
};
var CHARS = [
{ id: 'tangon', name: 'タンゴン', emoji: '🐧', img: 'tangon.png', rarity: 'SR', hp: 3500, atkMul: 1.0, comboRate: 1.0, skill: '味方HP上限増加', ultimate: 'タンゴフラッシュ', desc: '薔薇をくわえてタンゴを踊る伝説の修行者。パーティのHP上限を引き上げ、奥義「タンゴフラッシュ」で敵を一閃する。' }
];
var WEAPONS = [
{ id: '', name: '素手', emoji: '🗡️', atk: 0, rarity: 'C', desc: '何も持たない既定の状態。まずはここから。' },
{ id: 'fire_sword', name: '業火の大剣', emoji: '🔥️', atk: 150, rarity: 'R', desc: '炎を纏った大剣。攻撃力を +150 底上げし、一撃の重みを増す。' }
];
var ARMORS = [
{ id: '', name: '布の服', emoji: '🛡️', def: 0, rarity: 'C', desc: '軽装の既定防具。守りはまだこれからの領域。' },
{ id: 'cosmic_shield', name: '星屑の盾', emoji: '🔮🛡️', def: 80, rarity: 'R', desc: '星の欠片を鍛えた盾。防御力を +80 高め、敵の攻撃をいなしやすくする。' }
];

window.__pcv = window.__pcv || { sortChar: 'no', sortGear: 'no' };
function S() { return window.__pcv; }
function PU() { return window.__partyUi || (window.__partyUi = { cat: 'char', search: '', rarity: 'ALL', expanded: {} }); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function st() { return (typeof userStats !== 'undefined' && userStats && typeof userStats === 'object') ? userStats : {}; }
function ownedArr(k) { var a = st()['gacha_inv_' + k]; return Array.isArray(a) ? a : []; }
function enhLv(id) { var o = st().gacha_enhance || {}; return o[id] || 0; }
function shardOf(r) { return st()['gacha_shard_' + r] || 0; }
function curChar() { var v = (typeof activeCharacter !== 'undefined') ? activeCharacter : ''; return (v && String(v).trim()) ? String(v).trim() : ''; }
function curWeapon() { var v = (typeof activeWeapon !== 'undefined') ? activeWeapon : ''; return (v && String(v).trim()) ? String(v).trim() : ''; }
function curArmor() { var v = (typeof activeArmor !== 'undefined') ? activeArmor : ''; return (v && String(v).trim()) ? String(v).trim() : ''; }
function silent(fn) { var a = window.alert; window.alert = function () {}; try { fn(); } finally { window.alert = a; } }

/* ---------- 小エフェクト ---------- */
function sparkAt(el) {
if (!el || !el.getBoundingClientRect) return;
var r = el.getBoundingClientRect();
var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
var cols = ['rgba(251,191,36,.95)', 'rgba(52,231,228,.9)', 'rgba(255,255,255,.9)'];
for (var i = 0; i < 14; i++) {
(function (i) {
var p = document.createElement('div');
p.style.cssText = 'position:fixed;border-radius:50%;pointer-events:none;z-index:9999;mix-blend-mode:screen;';
var size = 4 + Math.round(Math.random() * 6);
var ang = Math.random() * Math.PI * 2, dist = 30 + Math.random() * 70;
var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
p.style.width = size + 'px'; p.style.height = size + 'px';
p.style.left = cx + 'px'; p.style.top = cy + 'px';
p.style.background = 'radial-gradient(circle,' + cols[i % 3] + ',transparent 70%)';
p.style.boxShadow = '0 0 8px ' + cols[i % 3];
p.style.transform = 'translate(-50%,-50%)';
p.style.transition = 'transform .6s cubic-bezier(.2,.7,.3,1),opacity .6s ease';
document.body.appendChild(p);
requestAnimationFrame(function () {
p.style.transform = 'translate(calc(-50% + ' + dx.toFixed(1) + 'px),calc(-50% + ' + dy.toFixed(1) + 'px)) scale(.3)';
p.style.opacity = '0';
});
setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 650);
})(i);
}
}
function shakeAt(el) {
if (!el) return;
el.style.transition = 'transform .08s ease 4';
el.style.transform = 'translateX(-4px)';
setTimeout(function () { el.style.transform = 'translateX(4px)'; }, 80);
setTimeout(function () { el.style.transform = ''; el.style.transition = ''; }, 240);
}

/* ---------- カードHTML ---------- */
function charCard(c) {
var r = RAR[c.rarity] || RAR.C;
var active = curChar() === c.id;
var open = !!PU().expanded['pcv_char_' + c.id];
var lv = enhLv(c.id), cost = lv + 1, have = shardOf(c.rarity);
var emblem = c.img ? '<img src="' + esc(c.img) + '" alt="' + esc(c.name) + '" onerror="this.style.display=\'none\';this.parentNode.textContent=\'' + esc(c.emoji) + '\';">' : esc(c.emoji);
return '<div class="pty-card pcv-card' + (active ? ' is-active' : '') + (open ? ' open' : '') + '" style="--pty-glow:rgba(' + r.glow + ',.7)" data-pcvcard="char_' + c.id + '">' +
'<span class="pty-card-chev">▼</span>' +
'<div class="pty-card-emblem">' + emblem + '</div>' +
'<div class="pty-card-body">' +
'<div class="pty-card-top"><span class="pty-card-name">' + esc(c.name) + '</span>' +
'<span class="pty-rbadge" style="color:' + r.ink + ';background:linear-gradient(180deg,rgba(' + r.glow + ',.95),rgba(' + r.glow + ',.7))">' + esc(r.label) + '</span>' +
(active ? '<span class="pty-equipped">編成中</span>' : '') + '</div>' +
'<div class="pty-stats"><span class="pty-stat">❤️ HP <b>' + c.hp + '</b></span><span class="pty-stat">⚔️ 攻撃 <b>×' + c.atkMul.toFixed(1) + '</b></span><span class="pty-stat">🔥 コンボ率 <b>×' + c.comboRate.toFixed(1) + '</b></span></div>' +
'<div class="pty-stats"><span class="pty-stat">⚒️ 強化 <b>Lv.' + lv + '</b></span><span class="pty-stat">💎 カケラ <b>' + have + '/' + cost + '</b></span></div>' +
'<div class="pty-skills"><span class="pty-skill">✦ ' + esc(c.skill) + '</span><span class="pty-skill">💥 ' + esc(c.ultimate) + '</span></div>' +
'<div class="pty-detail"><div class="pty-detail-inner">' + esc(c.desc) + '</div></div>' +
'<div class="pty-card-actions">' +
'<button type="button" class="pty-btn" data-pcvenh="' + esc(c.id) + '">⚒️ 強化する</button>' +
(active ? '<button type="button" class="pty-btn on" data-pcveq="char:">編成を外す</button>' : '<button type="button" class="pty-btn" data-pcveq="char:' + esc(c.id) + '">編成する</button>') +
'</div></div></div>';
}
function gearCard(g) {
var active = g.kind === 'weapon' ? curWeapon() === g.id : curArmor() === g.id;
var open = !!PU().expanded['pcv_' + g.kind + '_' + (g.id || 'none')];
var glow = g.def > 0 ? '52,231,228' : (g.atk > 0 ? '249,115,22' : '245,196,81');
var badge = g.id ? (g.atk > 0 ? '攻撃 +' + g.atk : '防御 +' + g.def) : '既定';
var bbg = g.id ? (g.atk > 0 ? 'linear-gradient(180deg,#fdba74,#fb923c)' : 'linear-gradient(180deg,#9af6f1,#34e7e4)') : 'linear-gradient(180deg,#e8ecf5,#aab2c5)';
var bink = g.id ? (g.atk > 0 ? '#2a0f02' : '#04201f') : '#0b0e14';
return '<div class="pty-card pcv-card' + (active ? ' is-active' : '') + (open ? ' open' : '') + '" style="--pty-glow:rgba(' + glow + ',.6)" data-pcvcard="' + g.kind + '_' + (g.id || 'none') + '">' +
'<span class="pty-card-chev">▼</span>' +
'<div class="pty-card-emblem" style="--pty-glow:rgba(' + glow + ',.7)">' + esc(g.emoji) + '</div>' +
'<div class="pty-card-body">' +
'<div class="pty-card-top"><span class="pty-card-name">' + esc(g.name) + '</span>' +
'<span class="pty-rbadge" style="color:' + bink + ';background:' + bbg + '">' + (g.kind === 'weapon' ? '🗡 ' : '🛡 ') + badge + '</span>' +
(active ? '<span class="pty-equipped">装備中</span>' : '') + '</div>' +
'<div class="pty-stats">' + (g.atk > 0 ? '<span class="pty-stat">⚔️ 攻撃 <b>+' + g.atk + '</b></span>' : g.def > 0 ? '<span class="pty-stat">🛡️ 防御 <b>+' + g.def + '</b></span>' : '<span class="pty-stat">— 既定装備</span>') + '</div>' +
'<div class="pty-detail"><div class="pty-detail-inner">' + esc(g.desc) + '</div></div>' +
'<div class="pty-card-actions">' +
(active
? (g.id ? '<button type="button" class="pty-btn on" data-pcveq="' + g.kind + ':">装備を外す</button>' : '<button type="button" class="pty-btn on" disabled style="opacity:.7;cursor:default">既定装備</button>')
: '<button type="button" class="pty-btn" data-pcveq="' + g.kind + ':' + esc(g.id) + '">装備する</button>') +
'</div></div></div>';
}
function chipsHtml(cat, count) {
var chips = cat === 'char'
? [['no', '図鑑順'], ['hp', 'HP順'], ['atk', '攻撃順'], ['enh', '強化順']]
: [['no', '図鑑順'], ['atk', '攻撃順'], ['def', '防御順']];
var cur = cat === 'char' ? S().sortChar : S().sortGear;
return '<div class="dx2-index">' +
'<span class="dx2-index-title">' + (cat === 'char' ? 'Allies · 味方図鑑' : 'Gear · 装備図鑑') + '</span>' +
'<span class="dx2-sort">' + chips.map(function (c) { return '<span class="dx2-sortchip' + (cur === c[0] ? ' on' : '') + '" data-pcvsort="' + c[0] + '">' + c[1] + '</span>'; }).join('') + '</span>' +
'<span class="dx2-index-count"><b>' + count + '</b> 件</span></div>';
}

/* ---------- 描画 ---------- */
function desiredSig() { var pu = PU(); return pu.cat + '|' + (pu.search || '') + '|' + (pu.cat === 'char' ? S().sortChar : S().sortGear); }
function renderOwn(list) {
var pu = PU(), cat = pu.cat;
var q = (pu.search || '').toLowerCase().trim();
var html = '';
if (cat === 'char') {
var items = CHARS.filter(function (c) { return !q || c.name.toLowerCase().indexOf(q) >= 0; });
var s = S().sortChar;
if (s === 'hp') items = items.slice().sort(function (a, b) { return b.hp - a.hp; });
else if (s === 'atk') items = items.slice().sort(function (a, b) { return b.atkMul - a.atkMul; });
else if (s === 'enh') items = items.slice().sort(function (a, b) { return enhLv(b.id) - enhLv(a.id); });
html = chipsHtml(cat, items.length) + (items.length ? items.map(charCard).join('') : '<div class="pty-empty">該当する味方がいません。</div>');
} else {
var gear = [];
WEAPONS.forEach(function (w) { gear.push({ kind: 'weapon', id: w.id, name: w.name, emoji: w.emoji, atk: w.atk || 0, def: 0, desc: w.desc }); });
ARMORS.forEach(function (a) { gear.push({ kind: 'armor', id: a.id, name: a.name, emoji: a.emoji, atk: 0, def: a.def || 0, desc: a.desc }); });
gear = gear.filter(function (g) {
if (q && g.name.toLowerCase().indexOf(q) < 0) return false;
if (g.id) return ownedArr(g.kind).indexOf(g.id) >= 0;
return true;
});
var s2 = S().sortGear;
if (s2 === 'atk') gear = gear.slice().sort(function (a, b) { return b.atk - a.atk; });
else if (s2 === 'def') gear = gear.slice().sort(function (a, b) { return b.def - a.def; });
html = chipsHtml(cat, gear.length) + (gear.length ? gear.map(gearCard).join('') : '<div class="pty-empty">装備はまだ記録されていない。ガシャで入手しよう。</div>');
}
list.classList.remove('gcx-active');
list.classList.add('pcv-active');
list.dataset.pcvSig = desiredSig();
list.innerHTML = html;
}

/* ---------- 上書き検知（描画前に自リストへ差し替え＝点滅根絶） ---------- */
function onMut() {
var list = document.getElementById('ptyList');
if (!list || !list.__pcvBound) return;
if(document.hidden||!document.getElementById('view-party')?.classList.contains('active')||list.classList.contains('gm-active')) return;
var pu = PU(); if (!pu || pu.cat === 'enemy') return;
if (list.querySelector('.gcx-list,.gcx-card') || list.querySelector('.pty-card:not(.pcv-card)')) { renderOwn(list); return; }
if (!(list.classList.contains('pcv-active') && list.dataset.pcvSig === desiredSig())) renderOwn(list);
}

/* ---------- イベント ---------- */
function bindList(list) {
if (list.__pcvBound) return;
list.__pcvBound = true;
if (typeof MutationObserver !== 'undefined') new MutationObserver(onMut).observe(list, { childList: true, subtree: true });
list.addEventListener('click', function (e) {
var t = e.target; if (!t || !t.closest) return;
var sc = t.closest('[data-pcvsort]');
if (sc) { var k = sc.getAttribute('data-pcvsort'); var pu = PU(); if (pu.cat === 'char') S().sortChar = k; else S().sortGear = k; renderOwn(list); return; }
var enh = t.closest('[data-pcvenh]');
if (enh) {
e.stopPropagation();
var id = enh.getAttribute('data-pcvenh');
var before = enhLv(id);
try { if (typeof window.gachaEnhance === 'function') window.gachaEnhance(id); } catch (er) {}
if (enhLv(id) > before) sparkAt(enh); else shakeAt(enh);
renderOwn(list);
return;
}
var eq = t.closest('[data-pcveq]');
if (eq) {
e.stopPropagation();
var spec = eq.getAttribute('data-pcveq');
var kind = spec.split(':')[0], eid = spec.split(':')[1] || '';
silent(function () {
if (kind === 'char' && typeof window.selectCharacter === 'function') window.selectCharacter(eid);
else if (kind === 'weapon' && typeof window.selectWeapon === 'function') window.selectWeapon(eid);
else if (kind === 'armor' && typeof window.selectArmor === 'function') window.selectArmor(eid);
});
sparkAt(eq);
renderOwn(list);
return;
}
var card = t.closest('.pcv-card');
if (card) {
var key = card.getAttribute('data-pcvcard');
PU().expanded[key] = !PU().expanded[key];
card.classList.toggle('open', !!PU().expanded[key]);
}
});
}

/* ---------- 起動・監視 ---------- */
setInterval(function () {
var list = document.getElementById('ptyList');
if (!list) return;
bindList(list);
onMut();
}, 250);
console.log('🐧 味方/装備図鑑パッチ（点滅根治＋並び替え追加）適用完了');
})();
// ==========================================================================
// 🛡️ 点滅根治パッチv2：gcx書込を吸収して「書換戦争」を停止
//    ・gacha修正パッチの renderCharDex が500ms毎に #ptyList を gcx で
//      書き換える → 味方側パッチが書き戻す ＝ 書換戦争 ＝ 点滅、が根本原因
//    ・#ptyList.innerHTML への「gcx」書込だけを吸収（それ以外の書込は全て通す）
//    ・タブ切替で要素が再生成されても自動で再適用
//    ・カードの再アニメによるチラつきも同時に停止
//    ※ 既存コードは一切変更しない（末尾追記のみ）
// ==========================================================================
(function applyBlinkStopPatch() {
"use strict";
if (window.__blinkStopApplied) return;
window.__blinkStopApplied = true;

/* ---------- CSS：再挿入時の再アニメ（チラつき）を停止 ---------- */
(function () {
if (document.getElementById('blinkStopCss')) return;
var s = document.createElement('style');
s.id = 'blinkStopCss';
s.textContent = [
'.pcv-card,.pty-card{animation:none !important;}',
'.pcv-card *,.pty-card *{animation:none !important;}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();

function isGcxHtml(v) {
return typeof v === 'string' && (v.indexOf('gcx-list') !== -1 || v.indexOf('gcx-card') !== -1);
}

/* ---------- #ptyList.innerHTML への gcx 書込だけを吸収 ---------- */
function seal(list) {
if (!list || list.__sealed) return;
try {
var desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
if (!desc || !desc.set || !desc.get) return;
Object.defineProperty(list, 'innerHTML', {
get: function () { return desc.get.call(this); },
set: function (v) {
if (isGcxHtml(v)) { this.classList.remove('gcx-active'); return; } // gcxだけ捨てる
desc.set.call(this, v); // それ以外は全て通常通り
},
configurable: true
});
list.__sealed = true;
} catch (e) {}
}

function reseal() {
var list = document.getElementById('ptyList');
if (!list) return;
if (!list.__sealed) seal(list);
list.classList.remove('gcx-active'); // 残った gcx-active を剥がす
}
setInterval(reseal, 300);
reseal();

console.log('🛡️ 点滅根治v2（gcx書込吸収＝書換戦争停止）適用完了');
})();
// ==========================================================================
//  統合安定化パッチ（これ1本。旧カケラ系パッチは全て削除済みであること）
//    ① カケラタブ（安定・1回だけ描画・アニメ再再生なし）
//    ② 他タブへの切替が確実に動く（表示制御を1箇所に集約）
//    ③ 攻撃力を実数値化 ④ ピル色 ⑤ gold.png/gachatike.png ⑥ セーブ連打防止
// ==========================================================================
(function applyUnifiedStablePatch(){
"use strict";
if (window.__unifiedStableApplied) return;
window.__unifiedStableApplied = true;

function st(){ return (typeof userStats!=='undefined'&&userStats&&typeof userStats==='object')?userStats:null; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
function PU(){ return window.__partyUi||(window.__partyUi={cat:'char',search:'',rarity:'ALL',expanded:{}}); }

/* ---------- スタイル ---------- */
(function(){
if(document.getElementById('usCss'))return;
var s=document.createElement('style');s.id='usCss';
s.textContent=[
'.pty-pills{grid-template-columns:repeat(4,1fr)!important;}',
'.pty-pill[data-pill="char"].active{box-shadow:inset 0 0 0 2px rgba(52,231,228,.9),inset 0 0 24px rgba(52,231,228,.28)!important;filter:drop-shadow(0 0 12px rgba(52,231,228,.55))!important;}',
'.pty-pill[data-pill="enemy"].active{box-shadow:inset 0 0 0 2px rgba(249,115,22,.9),inset 0 0 24px rgba(249,115,22,.28)!important;filter:drop-shadow(0 0 12px rgba(249,115,22,.55))!important;}',
'.pty-pill[data-pill="armor"].active{box-shadow:inset 0 0 0 2px rgba(245,196,81,.9),inset 0 0 24px rgba(245,196,81,.28)!important;filter:drop-shadow(0 0 12px rgba(245,196,81,.55))!important;}',
'.pty-pill[data-pill="kakera"].active{box-shadow:inset 0 0 0 2px rgba(192,132,252,.9),inset 0 0 24px rgba(192,132,252,.28)!important;filter:drop-shadow(0 0 12px rgba(192,132,252,.55))!important;}',
'.gch-badge.gold,.gch-badge.ticket{background:transparent!important;border:none!important;box-shadow:none!important;}',
'.us-gimg,.us-timg{width:20px;height:20px;object-fit:contain;vertical-align:-4px;}',
/* カケラ領域：アニメ再再生を完全に止める */
'#usKakera *{animation:none!important;transition:none!important;}',
'#usKakera{max-width:420px;margin:0 auto;width:100%;display:none;}',
'body.us-kakera #usKakera{display:block;}',
'body.us-kakera #ptyList{display:none!important;}',
'.us-k{position:relative;display:grid;grid-template-columns:64px 1fr;gap:0 14px;padding:15px 15px 15px 19px;border-radius:15px;border:1px solid rgba(200,144,42,.28);background:linear-gradient(165deg,rgba(255,255,255,.05),rgba(0,0,0,.2) 40%),linear-gradient(180deg,#3b3126,#262019 55%,#1b1510);box-shadow:inset 0 1px 0 rgba(255,255,255,.09),inset 0 -8px 16px rgba(0,0,0,.45),0 8px 20px rgba(0,0,0,.5);margin-bottom:12px;}',
'.us-k-ico{width:64px;height:64px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.12),rgba(0,0,0,.5));border:1.5px solid rgba(var(--l),.7);box-shadow:0 0 14px rgba(var(--l),.4);}',
'.us-k-ico img{width:80%;height:80%;object-fit:contain;}',
'.us-k-name{font-family:"Noto Serif JP",serif;font-size:15px;font-weight:900;color:#f3e5c0;}',
'.us-k-num{font-family:ui-monospace,monospace;font-size:21px;font-weight:900;color:#f3e5c0;}'
].join('\n');
document.head.appendChild(s);
})();

/* ---------- カケラ定義 ---------- */
var KS=[
{k:'C', n:'Cのカケラ', img:'kakerac.png', l:'148,163,184'},
{k:'UC',n:'UCのカケラ',img:'kakerauc.png',l:'34,211,238'},
{k:'R', n:'Rのカケラ', img:'kakerar.png', l:'249,115,22'},
{k:'SR',n:'SRのカケラ',img:'kakerasr.png',l:'251,191,36'}
];

/* ---------- カケラ領域を「1回だけ」作る ---------- */
var area=null;
function buildArea(){
if(area&&area.parentNode)return area;
area=document.createElement('div');area.id='usKakera';
var h='';
for(var i=0;i<KS.length;i++){var r=KS[i];
h+='<div class="us-k" style="--l:'+r.l+'"><div class="us-k-ico"><img src="'+r.img+'" onerror="this.style.display=\'none\'"></div><div><div class="us-k-name">'+esc(r.n)+'</div><div><span class="us-k-num" id="usNum_'+r.k+'">0</span> 個</div></div></div>';}
area.innerHTML=h;
var list=document.getElementById('ptyList');
if(list&&list.parentNode)list.parentNode.insertBefore(area,list);
return area;
}
/* 数字だけ更新（innerHTMLは触らない＝チカつかない） */
function updateNums(){
for(var i=0;i<KS.length;i++){var r=KS[i];
var el=document.getElementById('usNum_'+r.k);
if(el){var v=(st()&&st()['gacha_shard_'+r.k])||0;if(el.textContent!=String(v))el.textContent=v;}}
}

/* ---------- ピル注入 ---------- */
function ensurePill(){
var pills=document.querySelector('.pty-pills');if(!pills)return;
if(!pills.querySelector('[data-pill="kakera"]')){
var b=document.createElement('button');b.type='button';b.className='pty-pill';
b.setAttribute('data-pill','kakera');
b.innerHTML='<span class="pty-pill-ico">💎</span><span class="pty-pill-name">カケラ</span>';
pills.appendChild(b);
}
}

/* ---------- 表示制御（1箇所だけ・200ms） ---------- */
function sync(){
if(document.hidden||!document.getElementById('view-party')?.classList.contains('active')) return;
var pu=PU();
ensurePill();
var on=(pu.cat==='kakera');
document.body.classList.toggle('us-kakera',on);
if(on){buildArea();updateNums();}
/* ピルのactive同期 */
var pills=document.querySelectorAll('.pty-pills .pty-pill');
for(var i=0;i<pills.length;i++)pills[i].classList.toggle('active',pills[i].getAttribute('data-pill')===pu.cat);
}
setInterval(sync,200);

/* ---------- ピルクリック（stopPropagationしない＝他を壊さない） ---------- */
document.addEventListener('click',function(e){
var t=e.target;if(!t||!t.closest)return;
var p=t.closest('.pty-pill');if(!p)return;
PU().cat=p.getAttribute('data-pill');
sync();
},true);

/* ---------- ③ 攻撃力実数値 ---------- */
var BASE={SR:{hp:1000,atk:100},R:{hp:850,atk:85},UC:{hp:700,atk:70},C:{hp:500,atk:50}};
function fixCards(){
if(document.hidden||!document.getElementById('view-party')?.classList.contains('active')) return;
var cards=document.querySelectorAll('.pcv-card[data-pcvcard^="char_"],.pty-card[data-pcvcard^="char_"]');
for(var i=0;i<cards.length;i++){
var id=(cards[i].getAttribute('data-pcvcard')||'').replace('char_','');
var rar=(id==='tangon')?'SR':(id.indexOf('r01')>=0?'R':id.indexOf('uc')>=0?'UC':'C');
var lv=(st()&&st().gacha_enhance&&st().gacha_enhance[id])||0;
var b=(id==='tangon')?{hp:1000,atk:125}:BASE[rar];
var hp=Math.round(b.hp*(1+lv/100)),atk=Math.round(b.atk*(1+lv/100));
var sts=cards[i].querySelectorAll('.pty-stat');
for(var j=0;j<sts.length;j++){var t=sts[j].textContent||'';var bb=sts[j].querySelector('b');if(!bb)continue;
if(t.indexOf('HP')>=0&&t.indexOf('強化')<0&&bb.textContent!==String(hp))bb.textContent=hp;
else if(t.indexOf('攻撃')>=0&&bb.textContent!==String(atk))bb.textContent=atk;}
}
}
setInterval(fixCards,400);

/* ---------- ⑤ gold/ticket アイコン ---------- */
function fixBadges(){
var g=document.querySelector('.gch-badge.gold');
if(g&&!g.querySelector('.us-gimg')){var n=(g.textContent||'').replace(/[^0-9,]/g,'');g.innerHTML='<img src="gold.png" class="us-gimg" onerror="this.style.display=\'none\'"><span>'+n+'</span>';}
var t=document.querySelector('.gch-badge.ticket');
if(t&&!t.querySelector('.us-timg')){var m=(t.textContent||'').replace(/[^0-9,]/g,'');t.innerHTML='<img src="gachatike.png" class="us-timg" onerror="this.style.display=\'none\'"><span>'+m+'</span>';}
}
setInterval(fixBadges,500);

console.log('🎯 統合安定化パッチ適用完了');
})();
// ==========================================================================
// 🧹 ヘッダー安定化＋旧ガチャ管理カード削除パッチ（末尾追記・既存不変更）
//    ① ヘッダーの「欠」バッジを廃止＋ゴールド/チケットを
//      「数値だけ更新する安定版バッジ」へ差し替え＝点滅を根絶（EXPは不変更）
//    ② 管理者パネル内の旧「ガチャデータ管理（管理者用）」カードを
//      注入ブロック＋非表示で完全に除去（データ管理本体はそのまま）
// ==========================================================================
(function applyHeaderCleanPatch(){
"use strict";
if (window.__headerCleanApplied) return;
window.__headerCleanApplied = true;

/* ---------- スタイル ---------- */
(function(){
if (document.getElementById('hfCleanCss')) return;
var s = document.createElement('style');
s.id = 'hfCleanCss';
s.textContent = [
/* 元のバッジ群（G/券/欠）は完全に隠す＝点滅の源を遮断 */
'#gchBadges{display:none !important;}',
/* 旧ガチャ管理カードは非表示 */
'#gcAdminCard{display:none !important;}',
/* 安定版バッジ（枠なし・アイコン大きめ・EXPは触らない） */
'.hf-stable{display:inline-flex;gap:8px;align-items:center;margin-left:6px;}',
'.hf-badge{display:inline-flex;align-items:center;gap:4px;}',
'.hf-img{width:22px;height:22px;object-fit:contain;filter:drop-shadow(0 0 4px rgba(251,191,36,.4));}',
'.hf-badge span{font-family:ui-monospace,monospace;font-size:12px;font-weight:900;color:#f3e5c0;}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();

function st(){ return (typeof userStats!=='undefined' && userStats && typeof userStats==='object') ? userStats : null; }

/* ---------- 旧ガチャ管理カードの注入をブロック ---------- */
function blockOldAdmin(){
var el = document.getElementById('gcAdminCard');
if (!el) {
// ダミーを先に置く＝本体のinjectAdminは早期returnして二度と注入しない
var d = document.createElement('div');
d.id = 'gcAdminCard';
d.style.display = 'none';
document.body.appendChild(d);
} else {
el.style.display = 'none';
}
}

/* ---------- 安定版ヘッダーバッジ（数値だけ更新＝再描画なし） ---------- */
function ensureStableBadges(){
var slot = document.getElementById('headerLevelTextSlot');
var host = slot ? slot.parentElement : document.querySelector('.app-header');
if (!host) return;
var box = document.getElementById('hfStableBox');
if (!box) {
box = document.createElement('span');
box.id = 'hfStableBox';
box.className = 'hf-stable';
box.innerHTML =
'<span class="hf-badge"><img src="gold.png" class="hf-img" alt=""><span id="hfGoldNum">0</span></span>' +
'<span class="hf-badge"><img src="gachatike.png" class="hf-img" alt=""><span id="hfTickNum">0</span></span>';
if (slot) host.insertBefore(box, slot.nextSibling);
else host.appendChild(box);
}
var s = st();
if (s) {
var g = document.getElementById('hfGoldNum');
var t = document.getElementById('hfTickNum');
var gold = String(parseInt(s.gold) || 0);
var tick = String((parseInt(s.gacha_tickets)||0) + (parseInt(s.gacha_ticket_char)||0) + (parseInt(s.gacha_ticket_item)||0));
if (g && g.textContent !== gold) g.textContent = gold;   // 変化した時だけ書く
if (t && t.textContent !== tick) t.textContent = tick;
}
// 元バッジは常に隠し続ける
var orig = document.getElementById('gchBadges');
if (orig) orig.style.display = 'none';
}

function tick(){
blockOldAdmin();
ensureStableBadges();
}
setInterval(tick, 250);
tick();
console.log('🧹 ヘッダー安定化＋旧ガチャ管理カード削除パッチ適用完了');
})();
// =====================================================================
/* 後付け画面の再描画を1つの監視で検知する */
(function setupGachaDomWatcher(){
if(window.onGachaDomChange)return;
var handlers=[],pending=false;
function run(){pending=false;handlers.slice().forEach(function(handler){try{handler();}catch(e){console.error('[gacha DOM]',e);}});}
function schedule(){if(!pending){pending=true;requestAnimationFrame(run);}}
window.onGachaDomChange=function(handler){if(typeof handler!=='function')return;handlers.push(handler);schedule();};
function relevant(node){return node&&node.nodeType===1&&node.closest('#view-party,.gm-modal,.pcv-modal');}
// A study timer or home/profile update is unrelated to catalogue enhancement.
// Do not scan every button in the app on those mutations.
if(typeof MutationObserver!=='undefined')new MutationObserver(function(records){
if(records.some(function(record){return relevant(record.target)||Array.prototype.some.call(record.addedNodes,relevant);}))schedule();
}).observe(document.body,{childList:true,subtree:true});
else setInterval(schedule,700);
})();
// =====================================================================
// 💎 図鑑カケラ強化 確定版（gm-cell＋詳細モーダル両対応）
// ・gacha.js末尾にこれ1本（旧 dexEnhance 系は全削除）
// ・名前→IDマップ（タンゴン等）＋data属性自動走査の二重解決
// ・①図鑑キャラセル ②詳細モーダル(編成する/外すの上) にボタン設置
// =====================================================================
(function(){
"use strict";
if(window.__dexEnhanceFinal2) return; window.__dexEnhanceFinal2=true;

/* 名前→ID（既知＋実行時に自動拡張） */
var NAME2ID={'タンゴン':'tangon'};

function idFromAttrs(el){
if(!el||!el.attributes) return null;
for(var i=0;i<el.attributes.length;i++){
var v=el.attributes[i].value||'';
var m=v.match(/(?:char_)?([a-z][a-z0-9_\-]{2,})$/);
if(v.indexOf('char_')===0) return v.slice(5);
}
return null;
}
function cellName(cell){
var nm=cell.querySelector('.gm-name,.gcx-name,.pty-card-name');
if(nm) return nm.textContent.trim();
var t=(cell.textContent||'').trim().split(/\n/);
return (t[0]||'').trim();
}
function makeBtn(id,small){
var b=document.createElement('button');
b.type='button';
b.setAttribute('data-dxenh2',id);
b.textContent='⚒️ 強化';
b.style.cssText=small
?'position:absolute;bottom:4px;right:4px;z-index:3;padding:3px 7px;border-radius:8px;border:1px solid rgba(245,196,81,.6);background:rgba(245,196,81,.15);color:#f5c451;font-size:9px;font-weight:800;cursor:pointer;'
:'display:block;width:100%;margin:0 0 10px;padding:13px;border-radius:12px;border:1px solid rgba(245,196,81,.55);background:rgba(245,196,81,.12);color:#f5c451;font-size:13px;font-weight:800;cursor:pointer;';
return b;
}
function doEnhance(id){
try{ if(typeof window.gachaOpenEnhance==='function') window.gachaOpenEnhance(id);
else if(typeof window.gachaEnhance==='function') window.gachaEnhance(id); }catch(e){}
}

/* ① 図鑑セル */
function injectDex(){
var pu=window.__partyUi; if(!pu||pu.cat!=='char') return;
var list=document.getElementById('ptyList'); if(!list) return;
var cells=list.querySelectorAll('.gm-cell,.gcx-card,.pty-card');
for(var i=0;i<cells.length;i++){
var cell=cells[i];
if(cell.querySelector('[data-dxenh2]')) continue;
var id=idFromAttrs(cell);
if(!id){ var nm=cellName(cell); if(nm&&NAME2ID[nm]) id=NAME2ID[nm]; }
if(!id) continue;
if(getComputedStyle(cell).position==='static') cell.style.position='relative';
cell.appendChild(makeBtn(id,true));
}
}

/* ② 詳細モーダル */
function injectModal(){
var btns=document.querySelectorAll('button');
for(var j=0;j<btns.length;j++){
var t=(btns[j].textContent||'').replace(/\s/g,'');
if(t!=='編成する'&&t!=='編成を外す') continue;
var parent=btns[j].parentNode;
if(!parent||parent.querySelector('[data-dxenh2]')) continue;
/* モダル内のキャラ名を探す */
var scope=btns[j], id=null;
for(var up=0; up<8 && scope; up++){
scope=scope.parentElement; if(!scope) break;
var cands=scope.querySelectorAll('div,span,b,strong,h1,h2,h3');
for(var k=0;k<cands.length;k++){
var tx=(cands[k].textContent||'').trim();
if(tx&&tx.length<=20&&NAME2ID[tx]){id=NAME2ID[tx];break;}
}
if(id) break;
}
if(!id) continue;
parent.insertBefore(makeBtn(id,false), btns[j]);
}
}

/* クリック委譲 */
document.addEventListener('click',function(e){
var b=e.target.closest('[data-dxenh2]'); if(!b) return;
e.stopPropagation(); e.preventDefault();
doEnhance(b.getAttribute('data-dxenh2'));
},true);

window.onGachaDomChange(function(){injectDex();injectModal();});
console.log('💎 図鑑カケラ強化(確定版)適用完了');
})();
// =====================================================================
// 💎 図鑑モーダル 瞬き根治（旧データの一時表示を解消）
// ・補正を「600msタイマー」→「描画検知 즉시反映」に変更
// ・MutationObserver+rAF で画面に乗る“前”に書き換える＝チラつき無し
// ※gacha.js末尾に追記（既存パッチは消さない・これが勝つ）
// =====================================================================
(function(){
"use strict";
if(window.__dexModalInstant) return; window.__dexModalInstant=true;
var NAME2ID={'タンゴン':'tangon'};
var BASE_ATK={tangon:300};
var RAR_ATK={SR:300,R:255,UC:210,C:150};
function enhLv(id){try{var s=(typeof userStats!=='undefined'&&userStats)?userStats:{};var g=s.gacha_enhance||{};return g[id]||0;}catch(e){return 0;}}

function fixModal(modal){
/* ボタン小型・横並び */
var b=modal.querySelector('[data-dxenh2]');
if(b){
var parent=b.parentNode;
parent.style.display='flex';parent.style.gap='10px';parent.style.alignItems='stretch';
b.style.cssText='flex:1;width:auto;margin:0;padding:12px;border-radius:12px;border:1px solid rgba(245,196,81,.55);background:rgba(245,196,81,.12);color:#f5c451;font-size:12px;font-weight:800;cursor:pointer;';
for(var c=0;c<parent.children.length;c++){var ch=parent.children[c];if(ch.tagName==='BUTTON'){ch.style.flex='1';ch.style.width='auto';}}
}
/* 攻撃倍率→実数値 */
var name='',rar='SR';
var nodes=modal.querySelectorAll('div,span');
for(var i=0;i<nodes.length;i++){var tx=(nodes[i].textContent||'').trim();if(tx&&NAME2ID[tx])name=tx;}
for(var j=0;j<nodes.length;j++){if((nodes[j].textContent||'').trim()==='レアリティ'){var rv=nodes[j].nextElementSibling;if(rv)rar=(rv.textContent||'SR').trim();}}
var id=NAME2ID[name]||null;
for(var k=0;k<nodes.length;k++){
if((nodes[k].textContent||'').trim()==='攻撃倍率'){
nodes[k].textContent='攻撃';
var val=nodes[k].nextElementSibling;
if(val&&id){var lv=enhLv(id);var base=BASE_ATK[id]||RAR_ATK[rar]||300;val.textContent=String(Math.round(base*(1+lv/100)));}
}
}
}

function scanNow(){
document.querySelectorAll('[data-dxenh2]').forEach(function(b){
var m=b;
for(var up=0;up<8&&m;up++){m=m.parentElement;if(m&&(m.textContent.indexOf('攻撃倍率')>=0||m.textContent.indexOf('レアリティ')>=0))break;}
if(m)fixModal(m);
});
}

/* 共通の再描画監視から、表示直後に補正する */
window.onGachaDomChange(scanNow);
console.log('💎 図鑑モーダル瞬き根治 適用完了');
})();
