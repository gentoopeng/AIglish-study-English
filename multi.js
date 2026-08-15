// =====================================================================
// multi.js —— 協力バトル 実装レイヤー（最終版・構文ノイズ完全除去）
//   触るのは multi.js のみ。app.js / style.css / index.html / fix.js は不変更。
//   読み込み順: app.js → fix.js → multi.js
//   確定仕様: 上段1行[逃げる|敵名|行動]／ボスHP全幅／横2カラム(味方|敵 上揃い対峙)
//   味方縦・自キャラ末尾&一段大きい・自HP&COMBO全幅独立段・COMBOゲージ棒のみ
//   敵名バー直上／AAA帯&ANCIENT ONE&円形タイマー無力化／灰色バー根絶／動画スキップ
//   攻撃=敵へ飛翔・被ダメ=ボスから味方へ◀︎／下パッド枠を伸ばす／回答四角を大きく
//   画面高さ=100dvh(ツールバー追従=下見切れ根治)
// =====================================================================
(function () {
"use strict";
if (window.__multi2LayerApplied) return;
window.__multi2LayerApplied = true;
var F_DISP = "'Noto Serif JP','Yu Mincho',serif";
var F_BODY = "'Noto Sans JP',system-ui,-apple-system,'Hiragino Sans','Segoe UI',sans-serif";
var F_NUM  = "ui-monospace,'SF Mono','JetBrains Mono',monospace";
var F_EMO  = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";

(function injectMulti2Css() {
if (document.getElementById('multi2LayerCss')) return;
var s = document.createElement('style');
s.id = 'multi2LayerCss';
s.textContent = [
'body.in-game-active #multi-battle-play-screen{position:fixed !important;top:0 !important;left:0 !important;right:0 !important;width:100% !important;height:100vh !important;height:100dvh !important;margin:0 !important;padding:0 !important;overflow:hidden !important;display:flex !important;flex-direction:column !important;align-items:stretch !important;justify-content:flex-start !important;z-index:30 !important;box-sizing:border-box !important;}',
'body.in-game-active #multi-battle-play-screen > #m2Arena{flex:1 1 auto;min-height:0;width:100%;}',
'#multi-battle-play-bg{filter:blur(2px) brightness(0.5) saturate(1.1) !important;opacity:1 !important;}',
'#m2Arena{display:flex;flex-direction:column;width:100%;gap:2px;padding:3px 8px calc(3px + env(safe-area-inset-bottom));box-sizing:border-box;}',
'#m2ArenaTop{flex:0 0 auto;width:100%;display:flex;flex-direction:column;gap:3px;}',
'.m2-top-row{display:flex;justify-content:space-between;align-items:center;gap:6px;width:100%;}',
'.m2-top-row #multiEscapeOrSurrenderBtn{position:static !important;flex:0 0 auto;}',
'.m2-top-row #multiEnemyTimerDisplay{position:static !important;flex:0 0 auto;}',
'.m2-top-row #m2EnemyNameWrap{flex:1 1 auto;min-width:0;margin:0 !important;gap:0 !important;justify-content:center;}',
'.m2-top-row #m2EnemyName{font-size:clamp(13px,4vw,19px) !important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}',
'#m2ArenaTop #multiBossHpBarContainer{display:block !important;visibility:visible !important;width:100% !important;}',
'#m2ArenaTop #multiBossHpBarContainer .multi-boss-full-bar{display:block !important;visibility:visible !important;}',
'#m2ArenaMid{flex:0 0 auto;display:flex;flex-direction:row;align-items:flex-start;gap:6px;min-height:0;}',
'#m2ArenaLeft{flex:0 0 50%;max-width:52%;display:flex;flex-direction:column;justify-content:flex-start;gap:5px;min-height:0;}',
'#m2ArenaRight{flex:1 1 auto;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:4px;min-height:0;}',
'#m2ArenaMeGauge{flex:0 0 auto;width:100%;display:flex;flex-direction:column;gap:3px;padding:0;margin-top:2px;}',
'.m2-me-hpbar-full{width:100% !important;height:12px !important;border-radius:7px !important;margin:0 !important;}',
'.m2-me-combo-full{width:100%;}',
'.m2-me-combo-full #m2ComboGaugeWrap{margin:0 !important;max-width:none !important;width:100%;display:block !important;}',
'.m2-me-combo-full #m2ComboGaugeBar{height:11px;}',
'#m2ArenaBottom{flex:1 1 auto;width:100%;min-height:0;display:flex;}',
'#m2ArenaBottom .multi-flick-area{flex:1 1 auto;display:flex !important;flex-direction:column !important;justify-content:flex-start !important;padding-top:8px !important;padding-bottom:10px !important;}',
'#m2Arena > *:not(#m2ArenaTop):not(#m2ArenaMid):not(#m2ArenaMeGauge):not(#m2ArenaBottom){display:none !important;}',
'#multiPlayerOwnHpFrame,#multiBattleLog,#multiLimitGaugeBar,#multiLimitGaugeFill,#multiLimitGaugeText{display:none !important;visibility:hidden !important;height:0 !important;margin:0 !important;padding:0 !important;}',
'#m2ComboGaugeWrap{display:none !important;}',
'#m2ArenaTop #m2ComboGaugeWrap,#m2ArenaMid #m2ComboGaugeWrap,#m2ArenaLeft #m2ComboGaugeWrap,#m2Arena > #m2ComboGaugeWrap,#multiBossHpBarContainer ~ #m2ComboGaugeWrap,#multiBossHpBarContainer + #m2ComboGaugeWrap{display:none !important;}',
'#m2ArenaMeGauge #m2ComboGaugeWrap{display:block !important;}',
'#aaaEnemyNameWrap,#aaaRarityBadge,#aaaEnemyName,#aaaTimerRing,.aaa-timer-ring,.aaa-enemy-stage-decor,.aaa-boss-badge,.aaa-enemy-title{display:none !important;visibility:hidden !important;}',
'#aaaEnemyStage,.aaa-enemy-stage{display:contents !important;}',
'#m2ArenaRight > *:not(#multiBossImage):not(#m2BossSigil):not(#aaaEnemyStage){display:none !important;}',
'#m2ArenaTop > *:not(#m2EnemyNameWrap):not(#multiBossHpBarContainer):not(.m2-top-row){display:none !important;}',
'#m2ArenaLeft > *:not(.multi-party-status-area):not(#multiPartyContainer){display:none !important;}',
'.multi-party-status-area > *:not(#multiPartyContainer):not(.multi-party-grid-horizontal){display:none !important;}',
'.multi-quest-lbl{display:none !important;}',
'#m2ArenaLeft .multi-party-status-area{background:transparent !important;border:none !important;box-shadow:none !important;padding:0 !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;width:100%;}',
'#m2ArenaLeft .multi-party-grid-horizontal,#m2ArenaLeft #multiPartyContainer{display:flex !important;flex-direction:column !important;align-items:stretch !important;justify-content:flex-start !important;gap:5px !important;width:100%;}',
'.multi-party-member.m2-ally{flex-direction:row !important;align-items:center !important;gap:6px !important;max-width:none !important;width:100%;}',
'.m2-ally .m2-ally-icon{width:30px !important;height:30px !important;font-size:15px !important;flex:0 0 auto;margin:0 !important;}',
'.m2-ally-info{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px;}',
'.m2-ally-name{font-size:9px;font-weight:800;color:var(--cosmic-cyan,#34e7e4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 0 5px rgba(52,231,228,.4);line-height:1;}',
'.m2-ally .multi-party-hp-bar{width:100% !important;height:6px !important;margin:0 !important;}',
'.multi-party-member.m2-me{max-width:none !important;width:100%;flex-direction:row !important;align-items:center !important;gap:0 !important;margin:0 !important;padding:0 !important;}',
'.multi-party-member.m2-me > *:not(.m2-me-head){display:none !important;}',
'.m2-me-head{display:flex !important;flex-direction:row !important;align-items:center !important;gap:8px !important;width:100% !important;}',
'.m2-me .m2-me-icon{width:80px !important;height:80px !important;font-size:40px !important;margin:0 !important;flex:0 0 auto !important;}',
'.m2-me-name{flex:1 1 auto !important;min-width:0 !important;font-size:11px !important;font-weight:800 !important;color:var(--cosmic-purple-light,#C084FC) !important;line-height:1.15 !important;text-align:left !important;text-shadow:0 0 6px rgba(192,132,252,.5) !important;display:-webkit-box !important;-webkit-box-orient:vertical !important;-webkit-line-clamp:2 !important;overflow:hidden !important;word-break:break-word !important;}',
'.m2-me-equip{display:flex !important;gap:5px !important;font-size:15px !important;flex:0 0 auto !important;align-self:center !important;}',
'.m2-me-equip span{font-family:' + F_EMO + ';background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.18);border-radius:5px;padding:1px 6px;line-height:1;min-width:20px;text-align:center;}',
'#m2ArenaRight #multiBossImage{max-width:44vw;max-height:min(34vh,40vw);width:auto;height:auto;object-fit:contain;display:block;}',
'#m2ArenaRight .m2-sigil{width:120px;height:120px;font-size:56px;}',
'#m2Ambient{position:fixed;inset:0;z-index:4;pointer-events:none;overflow:hidden;}',
'#m2Ambient .m2-fog{position:absolute;inset:-25%;opacity:.5;mix-blend-mode:screen;filter:blur(10px);background:radial-gradient(38% 30% at 22% 28%, rgba(139,0,0,.34), transparent 70%),radial-gradient(34% 26% at 80% 70%, rgba(168,85,247,.22), transparent 72%);animation:m2Fog 24s ease-in-out infinite alternate;}',
'@keyframes m2Fog{0%{transform:translate3d(-3%,-2%,0) scale(1.06)}100%{transform:translate3d(4%,3%,0) scale(1.16)}}',
'#m2Ambient .m2-ember{position:absolute;bottom:-12px;border-radius:50%;pointer-events:none;opacity:0;animation:m2Ember linear infinite;}',
'@keyframes m2Ember{0%{transform:translateY(0) scale(.5);opacity:0}18%{opacity:.9}82%{opacity:.5}100%{transform:translateY(-104vh) scale(1.1);opacity:0}}',
'#m2EnemyNameWrap{position:relative;z-index:6;display:flex;flex-direction:column;align-items:center;gap:2px;margin:0 0 2px;pointer-events:none;}',
'#m2EnemyName{font-family:' + F_DISP + ';font-weight:900;font-size:clamp(18px,5.6vw,26px);letter-spacing:.06em;line-height:1.05;text-align:center;word-break:break-word;}',
'#m2EnemyName.r-C{color:#e2e8f0;text-shadow:0 0 12px rgba(148,163,184,.55),0 2px 5px #000;}',
'#m2EnemyName.r-UC{color:#a5f3fc;text-shadow:0 0 16px rgba(34,211,238,.8),0 0 5px #000,0 2px 5px #000;}',
'#m2EnemyName.r-R{color:#fdba74;text-shadow:0 0 18px rgba(249,115,22,.9),0 0 6px #000,0 2px 5px #000;}',
'#m2EnemyName.r-SR{color:#fde68a;text-shadow:0 0 24px rgba(251,191,36,1),0 0 10px rgba(244,63,94,.7),0 2px 6px #000;animation:m2SrName 2.4s ease-in-out infinite;}',
'@keyframes m2SrName{0%,100%{filter:brightness(1)}50%{filter:brightness(1.3)}}',
'.multi-boss-full-bar{height:24px !important;border-radius:8px !important;overflow:hidden !important;position:relative;background:linear-gradient(180deg,#1a0c12,#0a0509) !important;border:1.5px solid transparent !important;box-shadow:0 0 0 1.5px var(--m2-rarity-glow,rgba(245,196,81,.5)),0 0 22px var(--m2-rarity-glow,rgba(255,84,104,.35)),inset 0 2px 6px rgba(0,0,0,.85) !important;}',
'.multi-boss-hp-fill{background:linear-gradient(90deg,#7f1d1d,#ef4444 60%,#f87171) !important;position:relative;overflow:hidden;transition:width .4s cubic-bezier(.22,1,.36,1) !important;}',
'.multi-boss-hp-fill::after{content:"";position:absolute;top:0;left:-60%;width:48%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.6),transparent);transform:skewX(-18deg);animation:m2Sheen 2.4s ease-in-out infinite;}',
'@keyframes m2Sheen{0%{left:-60%}55%,100%{left:130%}}',
'.multi-boss-hp-text-layer{z-index:5 !important;}',
'#multiEnemyHpText{font-family:' + F_NUM + ' !important;font-weight:800 !important;letter-spacing:.04em;}',
'#multiBossImage{transition:filter .25s ease,transform .15s ease;animation:m2BossFloat 5s ease-in-out infinite;}',
'@keyframes m2BossFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}',
'#multiBossImage.m2-hit{animation:m2Hit .4s cubic-bezier(.36,.07,.19,.97) !important;}',
'@keyframes m2Hit{0%{transform:translateX(0)}15%{transform:translateX(-8px)}30%{transform:translateX(7px)}45%{transform:translateX(-5px)}60%{transform:translateX(4px)}100%{transform:translateX(0)}}',
'#multiBossImage.m2-die{animation:m2Die .7s cubic-bezier(.4,0,.2,1) forwards !important;}',
'@keyframes m2Die{0%{filter:brightness(1)}30%{filter:brightness(2.6) saturate(0)}100%{filter:brightness(0) blur(7px);transform:scale(.55) translateY(24px);opacity:0}}',
'.m2-sigil{width:150px;height:150px;display:flex;align-items:center;justify-content:center;font-size:74px;border-radius:50%;background:radial-gradient(circle at 35% 30%, rgba(255,255,255,.12), rgba(0,0,0,.5));border:2px solid var(--m2-rarity-glow,#fbbf24);box-shadow:0 0 30px var(--m2-rarity-glow,#fbbf24),inset 0 0 24px rgba(0,0,0,.6);animation:m2BossFloat 5s ease-in-out infinite;}',
'.multi-party-icon{width:52px !important;height:52px !important;border-radius:14px !important;overflow:hidden !important;background:radial-gradient(circle at 50% 35%, rgba(192,132,252,.28), rgba(8,5,18,.85)) !important;border:1.5px solid rgba(192,132,252,.5) !important;box-shadow:0 0 0 2px rgba(8,5,18,.9),0 0 14px rgba(192,132,252,.4),inset 0 2px 6px rgba(0,0,0,.7) !important;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%) !important;display:flex;align-items:center;justify-content:center;font-size:26px;}',
'.multi-party-icon img{width:100%;height:100%;object-fit:cover;}',
'#m2ComboGaugeBar{height:9px;border-radius:999px;background:rgba(0,0,0,.6);border:1px solid rgba(251,191,36,.3);overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,.8);}',
'#m2ComboGaugeFill{height:100%;width:0;border-radius:999px;background:linear-gradient(90deg,#f59e0b,#fbbf24 50%,#fff7d6);box-shadow:0 0 12px rgba(251,191,36,.7);transition:width .3s cubic-bezier(.22,1,.36,1);position:relative;overflow:hidden;}',
'#m2ComboGaugeFill::after{content:"";position:absolute;top:0;left:-60%;width:50%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.7),transparent);transform:skewX(-18deg);animation:m2Sheen 1.6s linear infinite;}',
'#m2ComboGaugeFill.max{animation:m2ComboMax 1.2s linear infinite;box-shadow:0 0 20px rgba(255,255,255,.85);}',
'@keyframes m2ComboMax{0%{filter:hue-rotate(0)}100%{filter:hue-rotate(360deg)}}',
'.multi-question-header-panel{margin:0 0 2px !important;}',
'#flickTargetWord{font-size:clamp(20px,6vw,28px) !important;line-height:1.12 !important;word-break:break-word !important;padding:9px 20px !important;margin:2px 0 6px !important;}',
'.multi-grid-3x3{gap:7px !important;max-width:360px !important;}',
'.flick-choice{min-height:60px !important;font-size:13.5px !important;padding:8px 6px !important;word-break:break-word !important;overflow-wrap:anywhere !important;transition:transform .12s ease,box-shadow .2s ease,border-color .2s ease,background .2s ease !important;}',
'.flick-choice:active{transform:scale(.96) !important;}',
'#multiEscapeOrSurrenderBtn{white-space:nowrap !important;min-width:64px;text-align:center;}',
'.m2-smoke{position:fixed;border-radius:50%;pointer-events:none;z-index:320;mix-blend-mode:screen;}',
'#m2RewardLayer{position:fixed;inset:0;z-index:330;pointer-events:none;overflow:hidden;}',
'.m2-reward{position:absolute;left:50%;font-family:' + F_NUM + ';font-weight:900;white-space:nowrap;text-shadow:0 2px 6px #000,0 0 12px currentColor;animation:m2RewardPop 1.5s cubic-bezier(.2,.8,.3,1) forwards;}',
'.m2-reward .ic{font-family:' + F_BODY + ';margin-right:5px;}',
'.m2-reward.xp{color:#67e8f9;font-size:22px;}.m2-reward.gold{color:#fbbf24;font-size:24px;}.m2-reward.ticket{color:#f0abfc;font-size:20px;}',
'@keyframes m2RewardPop{0%{transform:translate(-50%,30px) scale(.5);opacity:0}18%{transform:translate(-50%,-10px) scale(1.2);opacity:1}30%{transform:translate(-50%,0) scale(1)}75%{opacity:1}100%{transform:translate(-50%,-90px) scale(.95);opacity:0}}',
'#m2Entrance{position:fixed;inset:0;z-index:9200;display:none;align-items:center;justify-content:center;pointer-events:none;}',
'#m2Entrance.show{display:flex;}',
'.m2-entrance-vignette{position:absolute;inset:0;opacity:0;transition:opacity .3s ease;}',
'.m2-entrance-vignette.sr{background:radial-gradient(circle at 50% 45%,transparent 16%,rgba(80,0,0,.6) 58%,rgba(20,0,0,.94) 100%);}',
'.m2-entrance-vignette.r{background:radial-gradient(circle at 50% 45%,transparent 30%,rgba(60,25,0,.42) 70%,rgba(20,8,0,.82) 100%);}',
'#m2Entrance.show .m2-entrance-vignette{opacity:1;}',
'.m2-entrance-core{position:relative;z-index:2;text-align:center;transform:scale(.4);opacity:0;}',
'#m2Entrance.show .m2-entrance-core{animation:m2PopIn .62s cubic-bezier(.18,1.5,.3,1) forwards;}',
'@keyframes m2PopIn{0%{transform:scale(.4) rotate(-6deg);opacity:0}55%{transform:scale(1.12) rotate(2deg);opacity:1}100%{transform:scale(1) rotate(0);opacity:1}}',
'.m2-entrance-kicker{font-family:' + F_NUM + ';font-size:13px;font-weight:800;letter-spacing:8px;margin-bottom:6px;}',
'.m2-entrance-title{font-family:' + F_DISP + ';font-weight:900;letter-spacing:4px;line-height:.95;word-break:break-word;}',
'.m2-entrance-title.sr{font-size:clamp(54px,16vw,108px);background:linear-gradient(180deg,#fff7d6,#fbbf24 45%,#b91c1c);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 0 26px rgba(251,191,36,.7)) drop-shadow(0 4px 10px #000);}',
'.m2-entrance-title.r{font-size:clamp(40px,12vw,76px);color:#fff;text-shadow:0 0 24px rgba(249,115,22,.8),0 4px 10px #000;}',
'.m2-entrance-name{font-family:' + F_DISP + ';font-size:clamp(20px,6vw,34px);font-weight:900;color:#fff;margin-top:10px;letter-spacing:2px;text-shadow:0 2px 8px #000;}',
'.m2-slash{position:absolute;top:50%;height:3px;width:140%;left:-20%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.9),transparent);opacity:0;}',
'#m2Entrance.show .m2-slash{animation:m2Slash .5s ease forwards;}',
'.m2-slash:nth-child(1){transform:rotate(8deg);animation-delay:.05s}.m2-slash:nth-child(2){transform:rotate(-6deg);animation-delay:.14s}.m2-slash:nth-child(3){transform:rotate(3deg);animation-delay:.22s}',
'@keyframes m2Slash{0%{opacity:0;transform:translateX(-30%) rotate(var(--rot,0))}40%{opacity:1}100%{opacity:0;transform:translateX(30%) rotate(var(--rot,0))}}',
'body.m2-quake{animation:m2Quake .5s ease;}',
'@keyframes m2Quake{0%,100%{transform:translate(0,0)}10%{transform:translate(-7px,4px)}20%{transform:translate(8px,-5px)}30%{transform:translate(-6px,-4px)}40%{transform:translate(6px,5px)}50%{transform:translate(-4px,3px)}60%{transform:translate(4px,-3px)}70%{transform:translate(-3px,2px)}80%{transform:translate(3px,-2px)}}',
'#m2Result{position:fixed;inset:0;z-index:9300;display:none;flex-direction:column;align-items:center;overflow-y:auto;-webkit-overflow-scrolling:touch;}',
'#m2Result.show{display:flex;}',
'.m2-result-bg{position:fixed;inset:0;background:radial-gradient(circle at 50% 0%,rgba(60,8,20,.97),rgba(7,4,12,.99) 70%);z-index:0;}',
'.m2-result-ambient{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;}',
'.m2-result-spark{position:absolute;bottom:-10px;border-radius:50%;opacity:0;animation:m2RSpark linear infinite;}',
'@keyframes m2RSpark{0%{transform:translateY(0) scale(.5);opacity:0}15%{opacity:.8}85%{opacity:.4}100%{transform:translateY(-100vh) scale(1);opacity:0}}',
'.m2-result-card{position:relative;z-index:2;width:min(440px,92vw);margin:48px 0 48px;border-radius:24px;padding:30px 24px 26px;background:linear-gradient(168deg,rgba(40,12,22,.92),rgba(12,6,16,.95));border:1px solid rgba(251,191,36,.3);box-shadow:0 30px 80px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.07);opacity:0;transform:translateY(24px) scale(.96);}',
'#m2Result.show .m2-result-card{animation:m2CardIn .6s cubic-bezier(.2,.9,.3,1.1) .1s forwards;}',
'@keyframes m2CardIn{to{opacity:1;transform:none}}',
'.m2-result-crown{font-size:46px;text-align:center;filter:drop-shadow(0 0 18px rgba(251,191,36,.6));animation:m2CrownBob 2.6s ease-in-out infinite;}',
'@keyframes m2CrownBob{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-6px) rotate(3deg)}}',
'.m2-result-head{font-family:' + F_DISP + ';font-size:30px;font-weight:900;text-align:center;letter-spacing:3px;margin:6px 0 2px;background:linear-gradient(180deg,#fff,#fbbf24);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 2px 8px rgba(0,0,0,.5));}',
'.m2-result-sub{font-family:' + F_NUM + ';font-size:10px;font-weight:700;letter-spacing:4px;text-align:center;color:#fda4af;margin-bottom:20px;}',
'.m2-stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;}',
'.m2-stat{position:relative;border-radius:14px;padding:13px 14px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);overflow:hidden;opacity:0;transform:translateY(12px);}',
'#m2Result.show .m2-stat{animation:m2StatIn .45s ease forwards;}',
'@keyframes m2StatIn{to{opacity:1;transform:none}}',
'.m2-stat::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--ac,#22d3ee);}',
'.m2-stat-lbl{font-size:9.5px;font-weight:800;letter-spacing:1px;color:#94a3b8;display:flex;align-items:center;gap:5px;}',
'.m2-stat-val{font-family:' + F_NUM + ';font-size:25px;font-weight:900;color:#fff;line-height:1.1;margin-top:5px;text-shadow:0 0 12px var(--ac,#22d3ee);}',
'.m2-stat-val small{font-size:12px;color:var(--ac,#22d3ee);font-weight:800;margin-left:3px;}',
'.m2-result-btn{width:100%;height:52px;border:none;border-radius:14px;font-family:' + F_DISP + ';font-size:17px;font-weight:900;letter-spacing:3px;color:#06121f;background:linear-gradient(135deg,#fde68a,#fbbf24 50%,#f59e0b);cursor:pointer;box-shadow:0 10px 28px rgba(245,158,11,.4);transition:transform .12s,filter .15s,box-shadow .15s;}',
'.m2-result-btn:hover{filter:brightness(1.07);transform:translateY(-2px);box-shadow:0 14px 34px rgba(245,158,11,.5);}',
'.m2-result-btn:active{transform:scale(.97);}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();

var RARITY_GLOW = { C: 'rgba(148,163,184,.55)', UC: 'rgba(34,211,238,.6)', R: 'rgba(249,115,22,.65)', SR: 'rgba(251,191,36,.75)' };
var ENEMY_SIGIL = { C: '👹', UC: '🕷️', R: '🐲', SR: '💀' };
var ENEMIES = {
C: [
{ id: 'goblin', name: 'ゴブリン歩兵', emoji: '👺', baseHp: 2400, atk: 220, skills: ['time'], comboTh: 999 },
{ id: 'slime',  name: '酸性スライム', emoji: '🟢', baseHp: 2000, atk: 180, skills: ['time'], comboTh: 999 },
{ id: 'bat',    name: '洞窟コウモリ', emoji: '🦇', baseHp: 1800, atk: 240, skills: ['time'], comboTh: 999 }
],
UC: [
{ id: 'orc',    name: 'オーク戦士',   emoji: '👹', baseHp: 4200, atk: 340, skills: ['time'], comboTh: 999 },
{ id: 'spider', name: '毒針アラクネ', emoji: '🕷️', baseHp: 3800, atk: 380, skills: ['time', 'combo'], comboTh: 6 },
{ id: 'wraith', name: '彷徨う亡霊',   emoji: '👻', baseHp: 3600, atk: 400, skills: ['time'], comboTh: 999 }
],
R: [
{ id: 'drake',  name: '炎翼ドレイク', emoji: '🐲', baseHp: 8200, atk: 560, skills: ['time', 'combo'], comboTh: 5 },
{ id: 'golem',  name: '魔導ゴーレム', emoji: '🗿', baseHp: 9600, atk: 480, skills: ['time', 'combo'], comboTh: 7 }
],
SR: [
{ id: 'lich',   name: '氷獄のリッチ',     emoji: '🧙', baseHp: 16000, atk: 720, skills: ['time', 'combo', 'special'], comboTh: 4, special: 'barrier' },
{ id: 'bahamut',name: '終焉竜バハムート', emoji: '🐉', baseHp: 20000, atk: 820, skills: ['time', 'combo', 'special'], comboTh: 4, special: 'barrier' }
]
};
var CHARS = {
tangon: { name: 'タンゴン', hp: 3500, atk: 1.0, comboRate: 1.0, img: 'tangon.png', skill: '味方HP上限増加', ultimate: 'タンゴフラッシュ' }
};
function charOf(id) { return CHARS[id] || { name: '修行者', hp: 3500, atk: 1.0, comboRate: 1.0, img: '', skill: '', ultimate: '' }; }

window.__multi2 = window.__multi2 || { current: null, session: null, comboGauge: 0, comboMax: 100 };
function M2() { return window.__multi2; }
function freshSession() { return { kills: 0, xp: 0, gold: 0, tickets: 0, maxCombo: 0, dmgTaken: 0, startedAt: Date.now() }; }
function partyCount() { try { return (Array.isArray(multiPartyMembers) && multiPartyMembers.length) ? multiPartyMembers.length : 1; } catch (e) { return 1; } }

function pickRarity() {
var r = Math.random() * 100;
if (r < 75) return 'C';
if (r < 95) return 'UC';
if (r < 99) return 'R';
return 'SR';
}
function pickEnemy() {
var rar = pickRarity();
var pool = ENEMIES[rar];
var base = pool[Math.floor(Math.random() * pool.length)];
return Object.assign({}, base, { rarity: rar });
}
function enemyImgSrc(e) { return 'multi/enemy_' + e.rarity.toLowerCase() + '_' + e.id + '.png'; }
function applyRarityTheme(e) {
var glow = RARITY_GLOW[e.rarity] || RARITY_GLOW.C;
document.documentElement.style.setProperty('--m2-rarity-glow', glow);
var bar = document.getElementById('multiBossHpBarContainer');
if (bar) bar.style.setProperty('--m2-rarity-glow', glow);
}
function spawnEnemy() {
var base = pickEnemy();
var scale = Math.max(1, partyCount());
var hp = Math.round(base.baseHp * scale);
var cur = Object.assign({}, base, { hp: hp, maxHp: hp, barrier: (base.special === 'barrier' ? Math.round(hp * 0.25) : 0) });
M2().current = cur;
try { multiBossMaxHp = hp; multiBossHp = hp; } catch (e) {}
try { multiEnemyTimeLeft = 10; } catch (e) {}
applyRarityTheme(cur);
syncBossVisual(cur);
try { if (typeof window.updateMultiHpBars === 'function') window.updateMultiHpBars(); } catch (e) {}
if (cur.rarity === 'R' || cur.rarity === 'SR') showEntrance(cur);
}
function syncBossVisual(e) {
var img = document.getElementById('multiBossImage');
if (!img) return;
img.style.display = 'block';
img.className = 'multi-boss-image';
img.setAttribute('alt', e.name);
img.onerror = function () {
img.onerror = null;
img.removeAttribute('src');
img.style.display = 'none';
var sig = document.getElementById('m2BossSigil');
if (!sig) {
sig = document.createElement('div');
sig.id = 'm2BossSigil';
sig.className = 'm2-sigil';
img.parentNode.insertBefore(sig, img.nextSibling);
}
sig.textContent = e.emoji || ENEMY_SIGIL[e.rarity] || '👹';
sig.style.display = 'flex';
};
img.src = enemyImgSrc(e);
var sig2 = document.getElementById('m2BossSigil');
if (sig2) sig2.style.display = 'none';
injectEnemyName(e);
}
function injectEnemyName(e) {
var host = document.querySelector('#m2ArenaTop .m2-top-row') || document.getElementById('m2ArenaTop');
var bar = document.getElementById('multiBossHpBarContainer');
if (!host) host = bar ? bar.parentNode : null;
if (!host) return;
var wrap = document.getElementById('m2EnemyNameWrap');
if (!wrap) {
wrap = document.createElement('div');
wrap.id = 'm2EnemyNameWrap';
}
if (wrap.parentNode !== host) {
var timer = document.getElementById('multiEnemyTimerDisplay');
if (timer && timer.parentNode === host) host.insertBefore(wrap, timer);
else host.appendChild(wrap);
}
wrap.innerHTML = '<div id="m2EnemyName" class="r-' + e.rarity + '">' + esc(e.name) + '</div>';
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

function buildBattleArena() {
var screen = document.getElementById('multi-battle-play-screen');
if (!screen) return;
if (document.getElementById('m2Arena')) {
cleanBossDecor();
ensurePartyInLeft();
ensureArenaHidden();
return;
}
var arena = document.createElement('div'); arena.id = 'm2Arena';
var top = document.createElement('div'); top.id = 'm2ArenaTop';
var topRow = document.createElement('div'); topRow.className = 'm2-top-row';
var mid = document.createElement('div'); mid.id = 'm2ArenaMid';
var left = document.createElement('div'); left.id = 'm2ArenaLeft';
var right = document.createElement('div'); right.id = 'm2ArenaRight';
var meGauge = document.createElement('div'); meGauge.id = 'm2ArenaMeGauge';
var bottom = document.createElement('div'); bottom.id = 'm2ArenaBottom';
while (screen.firstChild) { arena.appendChild(screen.firstChild); }
screen.appendChild(arena);
var escBtn = document.getElementById('multiEscapeOrSurrenderBtn');
var timer = document.getElementById('multiEnemyTimerDisplay');
var ename = document.getElementById('m2EnemyNameWrap');
if (escBtn) topRow.appendChild(escBtn);
if (ename) topRow.appendChild(ename);
if (timer) topRow.appendChild(timer);
if (topRow.childNodes.length) top.appendChild(topRow);
var bossBar = document.getElementById('multiBossHpBarContainer');
if (bossBar) { top.appendChild(bossBar); try { bossBar.style.setProperty('display', 'block', 'important'); } catch (e) {} }
var partyArea = arena.querySelector('.multi-party-status-area');
if (partyArea) left.appendChild(partyArea);
ensurePartyInLeft();
var bossImg = document.getElementById('multiBossImage');
if (bossImg) right.appendChild(bossImg);
var sig = document.getElementById('m2BossSigil');
if (sig) right.appendChild(sig);
var flick = arena.querySelector('.multi-flick-area');
if (flick) bottom.appendChild(flick);
mid.appendChild(left); mid.appendChild(right);
arena.appendChild(top); arena.appendChild(mid); arena.appendChild(meGauge); arena.appendChild(bottom);
cleanBossDecor();
ensureArenaHidden();
observeAaaDecor();
}
function ensurePartyInLeft() {
var left = document.getElementById('m2ArenaLeft');
var partyCont = document.getElementById('multiPartyContainer');
if (!left || !partyCont) return;
if (left.contains(partyCont)) return;
var partyArea = left.querySelector('.multi-party-status-area');
if (partyArea) partyArea.appendChild(partyCont);
else left.appendChild(partyCont);
}
var __cleaning = false;
function cleanBossDecor() {
if (__cleaning) return;
__cleaning = true;
try {
var right = document.getElementById('m2ArenaRight');
if (right) {
Array.prototype.slice.call(right.children).forEach(function (c) {
if (c.id === 'multiBossImage' || c.id === 'm2BossSigil' || c.id === 'aaaEnemyStage') return;
try { c.style.setProperty('display', 'none', 'important'); } catch (e) {}
});
}
var top = document.getElementById('m2ArenaTop');
if (top) {
var keepTop = { m2EnemyNameWrap: 1, multiBossHpBarContainer: 1 };
Array.prototype.slice.call(top.children).forEach(function (c) {
if (keepTop[c.id]) return;
if (c.classList && c.classList.contains('m2-top-row')) return;
try { c.style.setProperty('display', 'none', 'important'); } catch (e) {}
});
}
var left = document.getElementById('m2ArenaLeft');
if (left) {
Array.prototype.slice.call(left.children).forEach(function (c) {
if (c.classList && c.classList.contains('multi-party-status-area')) return;
if (c.id === 'multiPartyContainer') return;
try { c.style.setProperty('display', 'none', 'important'); } catch (e) {}
});
}
var pa = left ? left.querySelector('.multi-party-status-area') : null;
if (pa) {
Array.prototype.slice.call(pa.children).forEach(function (c) {
if (c.id === 'multiPartyContainer') return;
if (c.classList && c.classList.contains('multi-party-grid-horizontal')) return;
try { c.style.setProperty('display', 'none', 'important'); } catch (e) {}
});
}
var meGauge = document.getElementById('m2ArenaMeGauge');
var wraps = document.querySelectorAll('#m2ComboGaugeWrap');
Array.prototype.slice.call(wraps).forEach(function (w) {
if (meGauge && meGauge.contains(w)) return;
try { if (w.parentNode) w.parentNode.removeChild(w); } catch (e) {}
});
} finally {
__cleaning = false;
}
}
function ensureArenaHidden() {
var ids = ['multiPlayerOwnHpFrame', 'multiBattleLog', 'multiPvpOpponentHpFrame', 'multiPvpOpponentVisualContainer', 'combo-sparkle-border', 'multiLimitGaugeBar', 'multiLimitGaugeFill', 'multiLimitGaugeText'];
ids.forEach(function (id) {
var el = document.getElementById(id);
if (el) { try { el.style.setProperty('display', 'none', 'important'); } catch (e) {} }
});
}
function observeAaaDecor() {
if (window.__m2Observer) return;
if (typeof MutationObserver === 'undefined') return;
var mo = new MutationObserver(function () { cleanBossDecor(); ensurePartyInLeft(); ensureArenaHidden(); });
var right = document.getElementById('m2ArenaRight');
var top = document.getElementById('m2ArenaTop');
var left = document.getElementById('m2ArenaLeft');
if (right) mo.observe(right, { childList: true, subtree: true });
if (top) mo.observe(top, { childList: true, subtree: true });
if (left) mo.observe(left, { childList: true, subtree: true });
window.__m2Observer = mo;
}

function ensureAmbient() {
if (document.getElementById('m2Ambient')) return;
var a = document.createElement('div');
a.id = 'm2Ambient';
var html = '<div class="m2-fog"></div>';
for (var i = 0; i < 18; i++) {
var left = Math.round(Math.random() * 100);
var delay = (Math.random() * 7).toFixed(2);
var dur = (5 + Math.random() * 7).toFixed(2);
var size = (2 + Math.round(Math.random() * 4));
var c = Math.random() < 0.5 ? 'rgba(249,115,22,.85)' : 'rgba(251,191,36,.8)';
html += '<span class="m2-ember" style="left:' + left + '%;width:' + size + 'px;height:' + size + 'px;background:' + c + ';animation-delay:' + delay + 's;animation-duration:' + dur + 's;"></span>';
}
a.innerHTML = html;
document.body.appendChild(a);
}

function showEntrance(e) {
var ov = document.getElementById('m2Entrance');
if (!ov) { ov = document.createElement('div'); ov.id = 'm2Entrance'; document.body.appendChild(ov); }
var isSr = e.rarity === 'SR';
ov.innerHTML =
'<div class="m2-entrance-vignette ' + (isSr ? 'sr' : 'r') + '"></div>' +
'<div style="position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden;">' +
'<span class="m2-slash" style="--rot:8deg"></span><span class="m2-slash" style="--rot:-6deg"></span><span class="m2-slash" style="--rot:3deg"></span></div>' +
'<div class="m2-entrance-core">' +
'<div class="m2-entrance-kicker" style="color:' + (isSr ? '#fbbf24' : '#fb923c') + '">' + (isSr ? '⚠ WARNING ' : '★ RARE ENCOUNTER ★') + '</div>' +
'<div class="m2-entrance-title ' + (isSr ? 'sr' : 'r') + '">' + (isSr ? 'BOSS' : 'RARE') + '</div>' +
'<div class="m2-entrance-name">' + esc(e.name) + '</div>' +
'</div>';
ov.classList.remove('show'); void ov.offsetWidth; ov.classList.add('show');
if (isSr) { document.body.classList.add('m2-quake'); setTimeout(function () { document.body.classList.remove('m2-quake'); }, 520); }
setTimeout(function () { ov.classList.remove('show'); }, isSr ? 1500 : 1150);
}

function bossRect() {
var el = document.getElementById('multiBossImage');
if (el && el.getBoundingClientRect && el.style.display !== 'none') { var r = el.getBoundingClientRect(); if (r.width) return r; }
var sig = document.getElementById('m2BossSigil');
if (sig && sig.getBoundingClientRect) { var r2 = sig.getBoundingClientRect(); if (r2.width) return r2; }
return { left: window.innerWidth / 2 - 60, top: window.innerHeight / 3, width: 120, height: 120 };
}
function memberRect(memberId) {
var el = document.getElementById('partyMember-' + memberId);
if (el && el.getBoundingClientRect) { var r = el.getBoundingClientRect(); if (r.width) return r; }
return { left: window.innerWidth / 4, top: window.innerHeight / 2, width: 0, height: 0 };
}
function showSmoke() {
var r = bossRect();
var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
var colors = ['rgba(251,191,36,.9)', 'rgba(244,63,94,.8)', 'rgba(255,255,255,.85)', 'rgba(168,85,247,.8)'];
for (var i = 0; i < 24; i++) {
(function (i) {
var p = document.createElement('div');
p.className = 'm2-smoke';
var size = 10 + Math.random() * 28;
var ang = Math.random() * Math.PI * 2;
var dist = 40 + Math.random() * 130;
var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 30;
p.style.width = size + 'px'; p.style.height = size + 'px';
p.style.left = cx + 'px'; p.style.top = cy + 'px';
p.style.background = 'radial-gradient(circle,' + colors[i % colors.length] + ',transparent 70%)';
p.style.transform = 'translate(-50%,-50%)';
p.style.transition = 'transform .8s cubic-bezier(.2,.7,.3,1),opacity .8s ease';
document.body.appendChild(p);
requestAnimationFrame(function () {
p.style.transform = 'translate(calc(-50% + ' + dx + 'px),calc(-50% + ' + dy + 'px)) scale(' + (1.4 + Math.random()) + ')';
p.style.opacity = '0';
});
setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 850);
})(i);
}
}
function showRewardBurst(reward) {
var layer = document.getElementById('m2RewardLayer');
if (!layer) { layer = document.createElement('div'); layer.id = 'm2RewardLayer'; document.body.appendChild(layer); }
var r = bossRect();
var baseY = r.top + r.height / 2;
var items = [];
items.push({ cls: 'xp', ic: '✦', txt: '+' + reward.xp + ' XP', delay: 0 });
items.push({ cls: 'gold', ic: '🪙', txt: '+' + reward.gold, delay: 120 });
if (reward.ticketGot) items.push({ cls: 'ticket', ic: '🎟️', txt: 'チケット GET!', delay: 260 });
items.forEach(function (it) {
setTimeout(function () {
var el = document.createElement('div');
el.className = 'm2-reward ' + it.cls;
el.style.top = baseY + 'px';
el.style.marginLeft = (Math.random() * 80 - 40) + 'px';
el.innerHTML = '<span class="ic">' + it.ic + '</span>' + esc(it.txt);
layer.appendChild(el);
setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1550);
}, it.delay);
});
}

function rewardForRarity(rar) {
var baseXp = { C: 30, UC: 85, R: 260, SR: 850 }[rar] || 30;
var gold = { C: 6, UC: 18, R: 65, SR: 220 }[rar] || 6;
var ticketRate = { C: 0.02, UC: 0.07, R: 0.22, SR: 0.65 }[rar] || 0.02;
try {
if (typeof window.bonusesCommon === 'function') {
var bc = window.bonusesCommon();
if (Array.isArray(bc) && bc.length === 5) {
var map = { C: 0, UC: 1, R: 2, SR: 4 };
var idx = map[rar];
if (idx !== undefined && typeof bc[idx] === 'number') baseXp = bc[idx];
}
}
} catch (e) {}
return { xp: baseXp, gold: gold, ticketRate: ticketRate };
}
function applyKillReward() {
var cur = M2().current;
if (!cur) return;
var rw = rewardForRarity(cur.rarity);
var ticketGot = Math.random() < rw.ticketRate;
var reward = { xp: rw.xp, gold: rw.gold, ticketGot: ticketGot };
var s = M2().session;
if (!s) s = M2().session = freshSession();
s.kills++; s.xp += reward.xp; s.gold += reward.gold;
if (ticketGot) s.tickets++;
try { totalExp = (parseInt(totalExp) || 0) + reward.xp; } catch (e) {}
try {
if (typeof userStats === 'object' && userStats) {
userStats.gold = (parseInt(userStats.gold) || 0) + reward.gold;
if (ticketGot) userStats.gacha_tickets = (parseInt(userStats.gacha_tickets) || 0) + 1;
}
} catch (e) {}
try { if (typeof window.saveUserStats === 'function') window.saveUserStats(); } catch (e) {}
try { if (typeof window.checkAndRewardTitleBonusXP === 'function') window.checkAndRewardTitleBonusXP(); } catch (e) {}
showRewardBurst(reward);
}

function renderComboGauge() {
var fill = document.getElementById('m2ComboGaugeFill');
if (!fill) return;
var pct = Math.max(0, Math.min(100, Math.round((M2().comboGauge / M2().comboMax) * 100)));
fill.style.width = pct + '%';
fill.classList.toggle('max', pct >= 100);
}

function showMultiResult() {
try { clearInterval(gameTimerInterval); } catch (e) {}
var s = M2().session || freshSession();
var ov = document.getElementById('m2Result');
if (!ov) { ov = document.createElement('div'); ov.id = 'm2Result'; document.body.appendChild(ov); }
var sparks = '';
for (var i = 0; i < 20; i++) {
var left = Math.round(Math.random() * 100);
var dl = (Math.random() * 7).toFixed(2);
var du = (6 + Math.random() * 7).toFixed(2);
var sz = (2 + Math.round(Math.random() * 3));
var c = Math.random() < 0.5 ? 'rgba(251,191,36,.8)' : 'rgba(168,85,247,.8)';
sparks += '<span class="m2-result-spark" style="left:' + left + '%;width:' + sz + 'px;height:' + sz + 'px;background:' + c + ';animation-delay:' + dl + 's;animation-duration:' + du + 's;"></span>';
}
var stats = [
{ lbl: '⚔️ 討伐数', val: s.kills, suf: '体', ac: '#f43f5e' },
{ lbl: '✦ 獲得XP', val: s.xp, suf: '', ac: '#22d3ee' },
{ lbl: '🪙 獲得ゴールド', val: s.gold, suf: '', ac: '#fbbf24' },
{ lbl: '🎟️ ガチャチケット', val: s.tickets, suf: '枚', ac: '#e879f9' },
{ lbl: '🔥 最大コンボ', val: s.maxCombo, suf: 'COMBO', ac: '#fb923c' },
{ lbl: '💢 被ダメージ', val: s.dmgTaken, suf: '', ac: '#f87171' }
];
var statHtml = '';
stats.forEach(function (st, idx) {
statHtml += '<div class="m2-stat" style="--ac:' + st.ac + ';animation-delay:' + (0.25 + idx * 0.07) + 's">' +
'<div class="m2-stat-lbl">' + st.lbl + '</div>' +
'<div class="m2-stat-val">' + st.val + (st.suf ? '<small>' + st.suf + '</small>' : '') + '</div></div>';
});
ov.innerHTML =
'<div class="m2-result-bg"></div>' +
'<div class="m2-result-ambient">' + sparks + '</div>' +
'<div class="m2-result-card">' +
'<div class="m2-result-crown">👑</div>' +
'<div class="m2-result-head">BATTLE RESULT</div>' +
'<div class="m2-result-sub">QUEST COMPLETE</div>' +
'<div class="m2-stat-grid">' + statHtml + '</div>' +
'<button type="button" class="m2-result-btn" id="m2ResultClose">戻る</button>' +
'</div>';
ov.classList.remove('show'); void ov.offsetWidth; ov.classList.add('show');
document.getElementById('m2ResultClose').onclick = closeMultiResult;
}
function closeMultiResult() {
var ov = document.getElementById('m2Result');
if (ov) ov.classList.remove('show');
M2().session = null; M2().current = null; M2().comboGauge = 0;
try { document.body.classList.remove('in-game-active'); } catch (e) {}
try {
var play = document.getElementById('multi-battle-play-screen'); if (play) play.style.display = 'none';
var start = document.getElementById('game-start-screen'); if (start) start.style.display = 'flex';
var lb = document.getElementById('gameLeaderboardArea'); if (lb) lb.style.display = 'flex';
var choice = document.getElementById('multi-battle-choice-screen'); if (choice) choice.style.display = 'none';
} catch (e) {}
}

var __origStartMulti = window.startMultiBattlePlay;
window.startMultiBattlePlay = function () {
if (typeof __origStartMulti === 'function') __origStartMulti.apply(this, arguments);
try { document.body.classList.add('in-game-active'); } catch (e) {}
buildBattleArena();
try { if (typeof window.renderMultiParty === 'function') window.renderMultiParty(); } catch (e) {}
ensureArenaHidden();
try {
if (currentMultiMode === 'coop') {
['multiPvpOpponentHpFrame', 'multiPvpOpponentVisualContainer'].forEach(function (id) {
var el = document.getElementById(id); if (el) el.style.display = 'none';
});
var r1 = document.getElementById('multiPvpOpponentCharImg1'); if (r1) r1.style.display = 'none';
var r2 = document.getElementById('multiPvpOpponentCharImg2'); if (r2) r2.style.display = 'none';
}
} catch (e) {}
ensureAmbient();
M2().session = freshSession();
M2().comboGauge = 0;
renderComboGauge();
try { var td0 = document.getElementById('multiEnemyTimerDisplay'); if (td0) td0.innerText = '行動: 10.0秒'; } catch (e) {}
spawnEnemy();
try { if (typeof window.showNextMultiWord === 'function') window.showNextMultiWord(); } catch (e) {}
setTimeout(function () { cleanBossDecor(); ensurePartyInLeft(); ensureArenaHidden(); try { if (typeof window.renderMultiParty === 'function') window.renderMultiParty(); } catch (e) {} renderComboGauge(); }, 120);
setTimeout(function () { cleanBossDecor(); ensurePartyInLeft(); ensureArenaHidden(); try { if (typeof window.renderMultiParty === 'function') window.renderMultiParty(); } catch (e) {} renderComboGauge(); }, 320);
setTimeout(function () { cleanBossDecor(); ensurePartyInLeft(); ensureArenaHidden(); }, 600);
};

window.playIntroVideoBeforeBattle = function () {
try {
var ov = document.getElementById('video-overlay');
if (ov) ov.style.display = 'none';
var v = document.getElementById('introVideo');
if (v) { try { v.pause(); } catch (e) {} }
} catch (e) {}
try { window.startMultiBattlePlay(); } catch (e) {}
};

var __origRenderParty = window.renderMultiParty;
window.renderMultiParty = function () {
var container = document.getElementById('multiPartyContainer');
if (!container) { if (typeof __origRenderParty === 'function') return __origRenderParty.apply(this, arguments); return; }
container.innerHTML = "";
var meGauge = document.getElementById('m2ArenaMeGauge');
if (meGauge) meGauge.innerHTML = "";
var allies = multiPartyMembers.filter(function (m) { return !m.isMe; });
var me = multiPartyMembers.filter(function (m) { return m.isMe; })[0] || null;
var order = allies.concat(me ? [me] : []);
order.forEach(function (m) {
var ch = charOf(m.char || (m.isMe ? activeCharacter : ''));
var charImg;
if (ch.img) {
charImg = '<img src="' + ch.img + '" alt="' + esc(ch.name) + '" onerror="this.style.display=\'none\';this.parentNode.textContent=\'' + (ch.name.charAt(0) || '⚔') + '\';">';
} else {
charImg = (ch.name.charAt(0) || '⚔');
}
var hpPercent = Math.max(0, (m.hp / m.maxHp) * 100);
if (m.isMe) {
var headHtml =
'<div class="multi-party-member m2-me" id="partyMember-' + m.id + '">' +
'<div class="m2-me-head">' +
'<div class="multi-party-icon m2-me-icon">' + charImg + '</div>' +
'<div class="m2-me-name">' + esc(m.name) + '</div>' +
'<div class="m2-me-equip">' +
'<span title="Weapon">' + (activeWeapon === 'fire_sword' ? '🔥' : '🗡️') + '</span>' +
'<span title="Armor">' + (activeArmor === 'cosmic_shield' ? '🔮' : '🛡️') + '</span>' +
'</div>' +
'</div>' +
'</div>';
container.innerHTML += headHtml;
if (meGauge) {
var gaugeHtml =
'<div class="multi-party-hp-bar m2-me-hpbar-full" style="border:1px solid ' + m.borderColor + ';box-shadow:0 0 5px ' + m.shadowColor + ';overflow:hidden;display:flex;justify-content:flex-start;">' +
'<div class="multi-party-hp-fill" id="partyMemberHpFill-' + m.id + '" style="width:' + hpPercent + '%;height:100%;background:linear-gradient(90deg,#10B981,#34D399);transform-origin:left !important;"></div>' +
'</div>' +
'<div class="m2-me-combo-full"><div id="m2ComboGaugeWrap"><div id="m2ComboGaugeBar"><div id="m2ComboGaugeFill"></div></div></div></div>';
meGauge.innerHTML = gaugeHtml;
}
} else {
var ahtml =
'<div class="multi-party-member m2-ally" id="partyMember-' + m.id + '">' +
'<div class="multi-party-icon m2-ally-icon">' + charImg + '</div>' +
'<div class="m2-ally-info">' +
'<div class="m2-ally-name">' + esc(m.name) + '</div>' +
'<div class="multi-party-hp-bar" style="border:1px solid ' + m.borderColor + ';box-shadow:0 0 5px ' + m.shadowColor + ';overflow:hidden;display:flex;justify-content:flex-start;">' +
'<div class="multi-party-hp-fill" id="partyMemberHpFill-' + m.id + '" style="width:' + hpPercent + '%;height:100%;background:linear-gradient(90deg,#10B981,#34D399);transform-origin:left !important;"></div>' +
'</div>' +
'</div>' +
'</div>';
container.innerHTML += ahtml;
}
});
renderComboGauge();
};

var __origProcessFlick = window.processMultiFlickAnswer;
window.processMultiFlickAnswer = function (choiceIndex) {
var me = multiPartyMembers.find(function (m) { return m.isMe; });
var q = gameCurrentWordsQueue[gameCurrentIndex];
var updatedStatus = "bad";
var ch = charOf(me ? (me.char || activeCharacter) : activeCharacter);
var comboRate = ch.comboRate || 1.0;
var s = M2().session; if (!s) s = M2().session = freshSession();
if (choiceIndex === currentMultiCorrectIndex) {
updatedStatus = "ok";
gameComboCount++;
if (gameComboCount > s.maxCombo) s.maxCombo = gameComboCount;
try { if (typeof window.createFireballEffect === 'function') window.createFireballEffect(); } catch (e) {}
var comboMulti = 1 + Math.floor(gameComboCount / 5) * 0.5;
var damage = Math.round(400 * comboMulti * (ch.atk || 1.0));
try { document.getElementById('multiComboCountText').innerText = gameComboCount; } catch (e) {}
M2().comboGauge = Math.min(M2().comboMax, M2().comboGauge + 12 * comboRate);
renderComboGauge();
var cur = M2().current;
if (cur && cur.barrier > 0) {
var tb = Math.min(cur.barrier, damage); cur.barrier -= tb; damage -= tb;
}
multiBossHp = Math.max(0, (multiBossHp || 0) - damage);
if (cur) cur.hp = multiBossHp;
if (me) try { window.showCharacterPopup(me.id, '💥 ' + damage, 'attack'); } catch (e) {}
var bimg = document.getElementById('multiBossImage');
if (bimg && bimg.style.display !== 'none') { bimg.classList.remove('m2-hit'); void bimg.offsetWidth; bimg.classList.add('m2-hit'); }
if (M2().comboGauge >= M2().comboMax) {
setTimeout(function () {
var burst = 5000;
var c2 = M2().current;
if (c2 && c2.barrier > 0) { var tb2 = Math.min(c2.barrier, burst); c2.barrier -= tb2; burst -= tb2; }
multiBossHp = Math.max(0, multiBossHp - burst); if (c2) c2.hp = multiBossHp;
M2().comboGauge = 0; renderComboGauge();
try { window.updateMultiHpBars(); } catch (e) {}
checkEnemyDefeated();
}, 200);
} else {
try { window.updateMultiHpBars(); } catch (e) {}
}
var curE = M2().current;
if (curE && curE.skills && curE.skills.indexOf('combo') >= 0 && gameComboCount >= (curE.comboTh || 999)) {
triggerEnemyAoE(curE, true);
}
} else {
gameComboCount = 0;
M2().comboGauge = Math.max(0, M2().comboGauge - 20);
renderComboGauge();
try { document.getElementById('multiComboCountText').innerText = gameComboCount; } catch (e) {}
if (me && me.hp > 0) {
me.hp = Math.max(0, me.hp - 300);
s.dmgTaken += 300;
try { window.showCharacterPopup(me.id, 300, 'damage'); } catch (e) {}
}
}
if (q) {
var targetVocab = vocabList.find(function (w) { return w.num === q.wordNum; });
if (targetVocab) {
if (targetVocab.meanings.length > 0) {
targetVocab.meanings[0].status = updatedStatus;
if (!targetVocab.meanings[0].history) targetVocab.meanings[0].history = [];
targetVocab.meanings[0].history.push(updatedStatus);
}
targetVocab.status = updatedStatus;
if (!targetVocab.history) targetVocab.history = [];
targetVocab.history.push(updatedStatus);
try { if (typeof window.saveVocabToStorage === 'function') window.saveVocabToStorage(); } catch (e) {}
}
}
if (checkEnemyDefeated()) return;
if (multiPartyMembers.every(function (m) { return m.hp <= 0; })) {
showMultiResult();
return;
}
try { window.updateMultiHpBars(); } catch (e) {}
gameCurrentIndex++;
try { if (typeof window.showNextMultiWord === 'function') window.showNextMultiWord(); } catch (e) {}
};
function checkEnemyDefeated() {
if (multiBossHp > 0) return false;
var cur = M2().current;
if (cur) {
var bimg = document.getElementById('multiBossImage');
if (bimg) bimg.classList.add('m2-die');
var sig = document.getElementById('m2BossSigil');
if (sig) { sig.style.transition = 'transform .7s, opacity .7s, filter .7s'; sig.style.transform = 'scale(.55)'; sig.style.opacity = '0'; sig.style.filter = 'blur(7px)'; }
}
applyKillReward();
showSmoke();
try { window.updateMultiHpBars(); } catch (e) {}
setTimeout(function () {
var bimg2 = document.getElementById('multiBossImage');
if (bimg2) bimg2.classList.remove('m2-die');
spawnEnemy();
try { if (typeof window.showNextMultiWord === 'function') window.showNextMultiWord(); } catch (e) {}
}, 1000);
return true;
}

function triggerEnemyAoE(e, isRage) {
if (!e) return;
var dmg = Math.round(e.atk * (isRage ? 1.4 : 1.0));
multiPartyMembers.forEach(function (m) {
if (m.hp > 0) {
m.hp = Math.max(0, m.hp - dmg);
try { window.showCharacterPopup(m.id, dmg, 'damage'); } catch (e2) {}
}
});
var s = M2().session; if (s) s.dmgTaken += dmg * multiPartyMembers.filter(function (m) { return m.hp >= 0; }).length;
try { document.body.classList.add('boss-damage-shake'); setTimeout(function () { document.body.classList.remove('boss-damage-shake'); }, 300); } catch (e3) {}
if (multiPartyMembers.every(function (m) { return m.hp <= 0; })) {
try { clearInterval(gameTimerInterval); } catch (e4) {}
setTimeout(showMultiResult, 500);
}
}

var __origHandleTimer = window.handleMultiBattleTimer;
window.handleMultiBattleTimer = function () {
if (currentMultiMode === 'pvp') { if (typeof __origHandleTimer === 'function') return __origHandleTimer.apply(this, arguments); return; }
multiEnemyTimeLeft -= 0.1;
var cur = M2().current;
if (multiEnemyTimeLeft <= 0) {
multiEnemyTimeLeft = 10;
if (cur && cur.skills && cur.skills.indexOf('time') >= 0) {
triggerEnemyAoE(cur, false);
} else {
var base = cur ? cur.atk : 400;
multiPartyMembers.forEach(function (m) { if (m.hp > 0) { m.hp = Math.max(0, m.hp - base); try { window.showCharacterPopup(m.id, base, 'damage'); } catch (e) {} } });
var s = M2().session; if (s) s.dmgTaken += base;
if (multiPartyMembers.every(function (m) { return m.hp <= 0; })) { try { clearInterval(gameTimerInterval); } catch (e) {} setTimeout(showMultiResult, 500); return; }
}
}
try {
var td = document.getElementById('multiEnemyTimerDisplay');
if (td) td.innerText = '行動: ' + Math.max(0, multiEnemyTimeLeft).toFixed(1) + '秒';
} catch (e) {}
try { window.updateMultiHpBars(); } catch (e) {}
};

var __origCancelMulti = window.cancelMultiBattlePlay;
window.cancelMultiBattlePlay = function (force) {
if (force) { showMultiResult(); return; }
if (!confirm("バトルから撤退しますか？\nここまでの戦績をリザルトで確認できます。")) return;
showMultiResult();
};

window.showCharacterPopup = function (memberId, amount, type) {
var match = multiPartyMembers.find(function (m) { return m.id === memberId; });
var border = match ? match.borderColor : '#ffffff';
var shadow = match ? match.shadowColor : 'rgba(255,255,255,.5)';
if (type === 'attack') {
var sr = memberRect(memberId);
var tr = bossRect();
var b = document.createElement('div');
b.className = 'popup-bubble-flying-atk';
b.textContent = amount;
b.style.borderColor = border;
b.style.boxShadow = '0 4px 12px ' + shadow;
b.style.left = (sr.left + sr.width / 2) + 'px';
b.style.top = (sr.top + sr.height / 2) + 'px';
b.style.setProperty('--start-x', (sr.left + sr.width / 2) + 'px');
b.style.setProperty('--start-y', (sr.top + sr.height / 2) + 'px');
b.style.setProperty('--target-x', (tr.left + tr.width / 2) + 'px');
b.style.setProperty('--target-y', (tr.top + tr.height / 2) + 'px');
document.body.appendChild(b);
setTimeout(function () {
if (b.parentNode) b.parentNode.removeChild(b);
var ex = document.createElement('div');
ex.className = 'popup-hit-explosion';
ex.style.left = (tr.left + tr.width / 2) + 'px';
ex.style.top = (tr.top + tr.height / 2) + 'px';
document.body.appendChild(ex);
setTimeout(function () { if (ex.parentNode) ex.parentNode.removeChild(ex); }, 400);
}, 600);
var bimg = document.getElementById('multiBossImage');
if (bimg) { bimg.classList.remove('m2-hit'); void bimg.offsetWidth; bimg.classList.add('m2-hit'); }
} else {
var tr2 = memberRect(memberId);
var sr2 = bossRect();
var b2 = document.createElement('div');
b2.className = 'popup-bubble-flying-atk';
b2.textContent = '◀︎ ' + amount;
b2.style.borderColor = '#ff5468';
b2.style.boxShadow = '0 4px 12px rgba(255,84,104,.6)';
b2.style.background = 'linear-gradient(180deg,#fff,#ffd2d8)';
b2.style.color = '#7a0612';
b2.style.left = (sr2.left + sr2.width / 2) + 'px';
b2.style.top = (sr2.top + sr2.height / 2) + 'px';
b2.style.setProperty('--start-x', (sr2.left + sr2.width / 2) + 'px');
b2.style.setProperty('--start-y', (sr2.top + sr2.height / 2) + 'px');
b2.style.setProperty('--target-x', (tr2.left + tr2.width / 2) + 'px');
b2.style.setProperty('--target-y', (tr2.top + tr2.height / 2) + 'px');
document.body.appendChild(b2);
setTimeout(function () { if (b2.parentNode) b2.parentNode.removeChild(b2); }, 600);
var mel = document.getElementById('partyMember-' + memberId);
if (mel) { var ic = mel.querySelector('.multi-party-icon'); if (ic) { ic.classList.remove('player-damage-flash'); void ic.offsetWidth; ic.classList.add('player-damage-flash'); } }
}
};

(function initMulti2Layer() {
function boot() {
ensureAmbient();
try {
if (typeof currentMultiMode === 'undefined' || currentMultiMode === 'coop') {
['multiPvpOpponentHpFrame', 'multiPvpOpponentVisualContainer'].forEach(function (id) {
var el = document.getElementById(id); if (el) el.style.display = 'none';
});
}
} catch (e) {}
}
if (document.readyState !== 'loading') setTimeout(boot, 400);
else document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 400); });
})();
console.log('⚔️ multi.js 適用完了');
})();
// ==========================================================================
// ⚔️ multi.js 最終パッチ（末尾追記・本体不変更）
//    ① 余白だけ詰めて下パッドの見切れを解消（ゲージ・敵画像サイズは不変）
//    ② 敵を囲む黒円盤＋足元の光る輪を消去（敵画像だけ cleanly）
//    ③ 選択肢を「タップでも」選べるように（フリックはそのまま両対応）
//       ＋ タップ/フリックの二重発火をガードで吸収
//    ④ 死んでいたAAA演出を復活（敵ヒット aaa-hit / CRIT / 選択肢の正誤 /
//       コンボバナー / 敵攻撃時の画面揺れ）
//    ⑤ HPバーを緑→黄→赤の色相に戻す（multi.js の赤固定 !important を上書き）
//    ※ app.js / fix.js / style.css / index.html は不変更
// ==========================================================================
(function applyM2FinalPatch() {
  "use strict";
  if (window.__m2FinalPatchApplied) return;
  window.__m2FinalPatchApplied = true;

  // ------------------------------------------------------------------
  // 【1】スタイル注入（末尾＝後勝ち。詳細度は body.in-game-active で底上げ）
  // ------------------------------------------------------------------
  (function injectM2FinalCss() {
    if (document.getElementById('m2FinalPatchCss')) return;
    var s = document.createElement('style');
    s.id = 'm2FinalPatchCss';
    s.textContent = [
      /* ===== ① 余白詰め（ゲージ・敵画像は触らない） ===== */
      'body.in-game-active #m2Arena{gap:1px !important;padding:2px 8px calc(2px + env(safe-area-inset-bottom)) !important;}',
      'body.in-game-active #m2ArenaTop{gap:2px !important;}',
      'body.in-game-active #m2ArenaMid{gap:4px !important;}',
      'body.in-game-active #m2ArenaMeGauge{gap:2px !important;margin-top:1px !important;}',
      'body.in-game-active #m2ArenaBottom .multi-flick-area{padding-top:3px !important;padding-bottom:6px !important;justify-content:flex-start !important;}',
      'body.in-game-active .multi-question-header-panel{margin:0 0 1px !important;}',
      'body.in-game-active #flickTargetWord{padding:6px 16px !important;margin:1px 0 3px !important;}',
      'body.in-game-active .multi-grid-3x3{gap:6px !important;}',
      /* ===== ② 円盤＋足元輪を消去（敵画像はクリーンな影だけ） ===== */
      '#aaaEnemyStage,#aaaEnemyStage::before,#aaaEnemyStage::after{background:none !important;box-shadow:none !important;}',
      '#aaaEnemyStage::before,#aaaEnemyStage::after{content:none !important;display:none !important;}',
      '#multiBossImage,.multi-boss-image{filter:drop-shadow(0 6px 14px rgba(0,0,0,.5)) !important;animation:m2BossFloat 5s ease-in-out infinite !important;}',
      /* ===== ④ 敵ヒット aaa-hit を m2-hit より優先 ===== */
      'body.in-game-active #multiBossImage.aaa-hit{animation:aaaBossHit .42s cubic-bezier(.36,.07,.19,.97) !important;}',
      /* ===== ⑤ HPバーの色相（緑→黄→赤）を復活 ===== */
      'body.in-game-active .multi-boss-hp-fill{background:linear-gradient(180deg,hsl(calc(var(--hp-ratio,1)*120),92%,66%) 0%,hsl(calc(var(--hp-ratio,1)*120),88%,48%) 48%,hsl(calc(var(--hp-ratio,1)*120),82%,34%) 100%) !important;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  })();

  // ------------------------------------------------------------------
  // 【2】AAAコンボバナー制御（fix.js 内ローカル関数の代替・自前実装）
  // ------------------------------------------------------------------
  var __cbHideT = null;
  function cbTier(c) { return c >= 20 ? 4 : c >= 10 ? 3 : c >= 5 ? 2 : 1; }
  function cbWord(t) { return ['', 'COMBO', 'GREAT', 'EXCELLENT', 'UNSTOPPABLE'][t] || 'COMBO'; }
  function showCombo(c) {
    var b = document.getElementById('aaaComboBanner');
    var f = document.getElementById('aaaComboFlash');
    if (!b) return;
    var t = cbTier(c);
    b.className = 'show tier-' + t;
    var w = b.querySelector('.aaa-cb-word');
    var n = b.querySelector('.aaa-cb-num');
    if (w) w.textContent = cbWord(t);
    if (n) n.textContent = c + ' HITS';
    if (f) f.className = 'tier-' + t;
    clearTimeout(__cbHideT);
    __cbHideT = setTimeout(hideCombo, 1400);
  }
  function hideCombo() {
    var b = document.getElementById('aaaComboBanner');
    var f = document.getElementById('aaaComboFlash');
    if (b) b.classList.remove('show');
    if (f) f.className = '';
  }

  // ------------------------------------------------------------------
  // 【3】processMultiFlickAnswer ラップ
  //     ・二重発火ガード（タップとフリックが万が一重なっても1回だけ）
  //     ・押した選択肢に aaa-correct / aaa-wrong を一時付与
  //     ・コンボ変化でバナー表示
  // ------------------------------------------------------------------
  var __origFlick = window.processMultiFlickAnswer;
  window.processMultiFlickAnswer = function (choiceIndex) {
    if (window.__m2Processing) return;          // ★ガード
    window.__m2Processing = true;
    setTimeout(function () { window.__m2Processing = false; }, 350);
    try {
      var el = document.getElementById('multiChoice-' + choiceIndex);
      if (el) {
        var ok = (typeof currentMultiCorrectIndex !== 'undefined') && (choiceIndex === currentMultiCorrectIndex);
        el.classList.add(ok ? 'aaa-correct' : 'aaa-wrong');
        setTimeout(function () { el.classList.remove('aaa-correct', 'aaa-wrong'); }, 460);
      }
    } catch (e) {}
    var before = (typeof gameComboCount !== 'undefined') ? gameComboCount : 0;
    var r = __origFlick ? __origFlick.apply(this, arguments) : undefined;
    var after = (typeof gameComboCount !== 'undefined') ? gameComboCount : 0;
    try {
      if (after > before && after >= 2) showCombo(after);
      else if (after === 0 && before >= 2) hideCombo();
    } catch (e) {}
    return r;
  };

  // ------------------------------------------------------------------
  // 【4】showCharacterPopup ラップ
  //     ・attack → 敵に aaa-hit ＋ コンボ5以上でバブルを CRIT 化
  //     ・damage → 敵攻撃時の画面揺れ(boss-damage-shake)を復活
  // ------------------------------------------------------------------
  var __origPopup = window.showCharacterPopup;
  window.showCharacterPopup = function (memberId, amount, type) {
    var r = __origPopup ? __origPopup.apply(this, arguments) : undefined;
    try {
      if (type === 'attack') {
        var img = document.getElementById('multiBossImage');
        if (img) { img.classList.remove('aaa-hit'); void img.offsetWidth; img.classList.add('aaa-hit'); }
        var crit = (typeof gameComboCount !== 'undefined' && gameComboCount >= 5);
        if (crit) {
          var bs = document.querySelectorAll('.popup-bubble-flying-atk:not(.aaa-crit)');
          var last = bs[bs.length - 1];
          if (last) { last.classList.add('aaa-crit'); last.textContent = 'CRIT ' + (last.textContent || amount); }
        }
      } else if (type === 'damage') {
        document.body.classList.add('boss-damage-shake');
        setTimeout(function () { document.body.classList.remove('boss-damage-shake'); }, 300);
      }
    } catch (e) {}
    return r;
  };

  // ------------------------------------------------------------------
  // 【5】タップ接続（イベント委譲＝DOM生成タイミングに依存しない）
  //     ・.flick-choice（#multiChoice-0〜7）をタップで解答
  //     ・フリックパッド(#flickPadArea)は別コンテナなので従来通り動作
  //     ・touchend と click の二重は【3】のガードが吸収
  // ------------------------------------------------------------------
  function choiceIndexOf(node) {
    var c = (node && node.closest) ? node.closest('.flick-choice') : null;
    if (!c || !c.id) return -1;
    var m = /multiChoice-(\d+)/.exec(c.id);
    return m ? parseInt(m[1], 10) : -1;
  }
  document.addEventListener('touchend', function (e) {
    var idx = choiceIndexOf(e.target);
    if (idx < 0) return;            // 選択肢以外（フリックパッド等）は何もしない
    e.preventDefault();             // 後続 click を抑制
    window.processMultiFlickAnswer(idx);
  }, { passive: false, capture: true });
  document.addEventListener('click', function (e) {
    var idx = choiceIndexOf(e.target);
    if (idx < 0) return;
    window.processMultiFlickAnswer(idx);
  }, true);

  console.log('⚔️ multi.js 最終パッチ（余白詰め＋円消去＋タップ両対応＋AAA演出復活＋HP色相）適用完了');
})();
// ==========================================================================
// ⚔️ multi.js 第2パッチ（末尾追記・本体＆前回パッチ 不変更）
//    ① 敵HPバー＝黒っぽい赤で“横うねり＋光沢”で蠢かせる（緑を根絶）
//    ② 余白詰め＝下パッドを敵・味方の直下まで上げ、見切れを解消
//       （ゲージ類は一切消さない。足りない分は画面最下部へ逃がすだけ）
//    ③ 自キャラのニックネーム見切れ＝ヘッドを2行グリッド化して解消
//       （敵画像のサイズには触れない）
//    ④ 味方ダメージ演出＝赤フラッシュ＋その場の▼数値＋HPバー赤点滅＋画面揺れ
//    ※ app.js / fix.js / style.css / index.html は不変更
//    ※ 前回パッチ（__m2FinalPatchApplied）適用済みが前提。上から詳細度で上書き
// ==========================================================================
(function applyM2FinalPatch2() {
  "use strict";
  if (window.__m2FinalPatch2Applied) return;
  window.__m2FinalPatch2Applied = true;

  // ------------------------------------------------------------------
  // 【1】スタイル注入（末尾＝後勝ち。詳細度を body.in-game-active で底上げ）
  // ------------------------------------------------------------------
  (function injectM2FinalCss2() {
    if (document.getElementById('m2FinalPatchCss2')) return;
    var s = document.createElement('style');
    s.id = 'm2FinalPatchCss2';
    s.textContent = [
      /* ===== ① 敵HPバー：黒っぽい赤で蠢かせる（緑＝hsl色相版を完全上書き） ===== */
      'body.in-game-active .multi-boss-hp-fill{',
      '  background:linear-gradient(90deg,#2a0608 0%,#5c0d12 20%,#7a1218 42%,#9c1a22 55%,#5c0d12 74%,#2a0608 100%) !important;',
      '  background-size:220% 100% !important;',
      '  background-position:0% 50% !important;',
      '  animation:m2HpWrithe 3.4s ease-in-out infinite !important;',
      '  box-shadow:0 0 14px rgba(122,18,24,.65),inset 0 1px 0 rgba(255,120,120,.28),inset 0 -3px 7px rgba(0,0,0,.6) !important;',
      '  transition:width .45s cubic-bezier(.22,1,.36,1) !important;',
      '  border-radius:5px !important;',
      '}',
      '/* 既存の光沢シマー(::after)は生きたまま、背景だけが横にうねる＝“蠢く” */',
      '@keyframes m2HpWrithe{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}',
      /* バー枠も暗赤寄りに沈める（発光だけ赤く残す） */
      'body.in-game-active .multi-boss-full-bar{background:linear-gradient(180deg,#160407,#0a0204) !important;box-shadow:0 0 0 1.5px rgba(122,18,24,.55),0 0 20px rgba(120,12,18,.45),inset 0 2px 6px rgba(0,0,0,.88) !important;}',

      /* ===== ② 余白詰め：下パッドを自然高にして敵・味方の直下へ（見切れ解消） ===== */
      'body.in-game-active #m2Arena{justify-content:flex-start !important;}',
      'body.in-game-active #m2ArenaBottom{flex:0 0 auto !important;}',
      'body.in-game-active #m2ArenaBottom .multi-flick-area{flex:0 0 auto !important;padding-top:2px !important;padding-bottom:4px !important;justify-content:flex-start !important;}',
      'body.in-game-active .multi-question-header-panel{margin:0 !important;}',
      'body.in-game-active #flickTargetWord{margin:0 0 2px !important;padding:5px 16px !important;}',
      'body.in-game-active .multi-grid-3x3{gap:6px !important;}',

      /* ===== ③ ニックネーム見切れ：自キャラヘッドを2行グリッド化 ===== */
      '/* 1行目=[アイコン|名前(全幅)] ／ 2行目=[(アイコン跨ぎ)|装備(右端)] */',
      'body.in-game-active .m2-me-head{display:grid !important;grid-template-columns:auto 1fr !important;grid-template-rows:auto auto !important;column-gap:8px !important;row-gap:1px !important;align-items:center !important;width:100% !important;}',
      'body.in-game-active .m2-me .m2-me-icon{grid-row:1 / 3 !important;grid-column:1 !important;align-self:center !important;}',
      'body.in-game-active .m2-me-name{grid-row:1 !important;grid-column:2 !important;width:100% !important;min-width:0 !important;flex:none !important;}',
      'body.in-game-active .m2-me-equip{grid-row:2 !important;grid-column:2 !important;justify-self:end !important;}',

      /* ===== ④ 味方ダメージ演出：赤フラッシュ＋HPバー赤点滅 ===== */
      'body.in-game-active .multi-party-icon.player-damage-flash{animation:m2AllyFlash .42s ease-out !important;}',
      '@keyframes m2AllyFlash{0%{filter:brightness(.5) sepia(1) hue-rotate(-50deg) saturate(5);transform:scale(1.14)}100%{filter:none;transform:scale(1)}}',
      'body.in-game-active .multi-party-hp-fill.m2-hitbar{background:linear-gradient(90deg,#ff3b3b,#ff7a7a) !important;box-shadow:0 0 10px rgba(255,60,60,.85) !important;transition:background .12s ease !important;}',
      '/* その場▼ポップがはみ出さないよう味方カードを相対基準に */',
      'body.in-game-active .multi-party-member{position:relative !important;overflow:visible !important;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  })();

  // ------------------------------------------------------------------
  // 【2】showCharacterPopup を“もう一段”ラップ（damage 側の味方反応を補完）
  //     ・元（本体→AAA→前回パッチ の連鎖）を必ず呼ぶ＝飛翔演出はそのまま
  //     ・damage 時にだけ ①赤フラッシュ ②その場▼数値 ③HPバー赤点滅 を付与
  //     ・画面揺れ(boss-damage-shake)は前回パッチが担当＝ここでは二重付与しない
  // ------------------------------------------------------------------
  var __prevPopup2 = window.showCharacterPopup;
  window.showCharacterPopup = function (memberId, amount, type) {
    var r = __prevPopup2 ? __prevPopup2.apply(this, arguments) : undefined;
    if (type === 'damage') {
      try {
        var mel = document.getElementById('partyMember-' + memberId);
        if (mel) {
          // ① 味方アイコンを赤くフラッシュ
          var ic = mel.querySelector('.multi-party-icon');
          if (ic) { ic.classList.remove('player-damage-flash'); void ic.offsetWidth; ic.classList.add('player-damage-flash'); }
          // ② 味方のその場に ▼ 数値ポップ（style.css の smashDownV が動く）
          var pop = document.createElement('div');
          pop.className = 'popup-v-dmg';
          pop.innerHTML = '<div class="v-mark"></div><div class="v-dmg-text">' + amount + '</div>';
          mel.appendChild(pop);
          setTimeout(function () { if (pop.parentNode) pop.parentNode.removeChild(pop); }, 1500);
          // ③ 味方HPバーを一瞬だけ赤点滅
          var fill = document.getElementById('partyMemberHpFill-' + memberId);
          if (fill) { fill.classList.add('m2-hitbar'); setTimeout(function () { fill.classList.remove('m2-hitbar'); }, 420); }
        }
      } catch (e) {}
    }
    return r;
  };

  console.log('⚔️ multi.js 第2パッチ（敵HP暗赤蠢き＋余白詰め＋ニックネーム2行＋味方ダメ演出）適用完了');
})();
// ==========================================================================
// ⚔️ multi.js 第3パッチ（末尾追記・本体＆第1/2パッチ 不変更）
//    下パッドの「3行目見切れ」を根治する
//    ─ 犯人は下パッドを囲う発光枠 .multi-flick-area の overflow:hidden。
//      枠が“中身よりわずかに小さい高さ”で確定し、3行目の下が切れていた。
//      （黒い余白＝スペースは下に残っている＝画面の高さ不足ではない。
//        だから“削らない”。枠を「中身を全部包む器」に戻すだけで済む。）
//    ① 発光枠を overflow:visible に＝中身が枠より大きくても切らない
//       （角丸は ::before に border-radius:inherit を足して維持）
//    ② 枠とそれを包む #m2ArenaBottom を「中身で高さを決める・縮めない」
//       （min-height:0 → auto で flex の縮みを無効化＝見切れの遠因を断つ）
//    ③ 3×3グリッドも overflow:visible に＝最後の行をはみ出させない
//    ※ 敵画像・ゲージ類は一切不変更。削りもしない。
//    ※ 余ったスペースは画面最下部へ逃げる＝プレイエリアは完全表示。
// ==========================================================================
(function applyM2FinalPatch3() {
  "use strict";
  if (window.__m2FinalPatch3Applied) return;
  window.__m2FinalPatch3Applied = true;

  (function injectM2FinalCss3() {
    if (document.getElementById('m2FinalPatchCss3')) return;
    var s = document.createElement('style');
    s.id = 'm2FinalPatchCss3';
    s.textContent = [
      /* ===== ② 下パッドを包む段：中身で高さを決め・縮めない ===== */
      'body.in-game-active #m2ArenaBottom{',
      '  flex:0 0 auto !important;',
      '  height:auto !important;',
      '  min-height:auto !important;',   /* 本体の min-height:0（縮みの元）を上書き */
      '  overflow:visible !important;',
      '}',
      /* ===== ① 発光枠：中身を全部包む器に戻す（切らない） ===== */
      'body.in-game-active #m2ArenaBottom .multi-flick-area{',
      '  flex:0 0 auto !important;',     /* 親の中で伸び縮みさせない＝中身そのまま */
      '  height:auto !important;',
      '  min-height:auto !important;',
      '  overflow:visible !important;',  /* ★3行目を切らない本命 */
      '}',
      /* overflow:visible でも角丸を維持（背景グリッドを角でクリップ） */
      'body.in-game-active #m2ArenaBottom .multi-flick-area::before{',
      '  border-radius:inherit !important;',
      '}',
      /* ===== ③ 3×3グリッド：最後の行をはみ出させない ===== */
      'body.in-game-active .multi-grid-3x3{',
      '  overflow:visible !important;',
      '  height:auto !important;',
      '}',
      'body.in-game-active .multi-grid-3x3 .flick-choice{',
      '  overflow:visible !important;',
      '}',
      /* 念のため：アリーナレベルでも切らない（画面外には #multi-battle-play-screen が止める） */
      'body.in-game-active #m2Arena{overflow:visible !important;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  })();

  console.log('⚔️ multi.js 第3パッチ（下パッド3行目見切れ根治：発光枠を“包む器”に戻す）適用完了');
})();
// ==========================================================================
// ⚔️ multi.js 第4パッチ（末尾追記・本体＆第1/2/3パッチ 不変更）
//    「ボスバーより下」だけを少しずつ下へずらす＝上のギチギチを緩和＋下の余白を削減
//    ・上段（逃げる／敵名／行動）とボスバー自体は触らない
//    ・敵画像・ボスゲージ・自HP/COMBOゲージ も不変更（サイズもそのまま）
//    ・各段に数pxずつ margin-top を足して“呼吸”を作る＝急激な押し出しにならない
//      → 3行目見切れを再発させにくい（余白がある前提で下にずらすだけ）
//    ・下パッドは第3パッチの overflow:visible を維持＝万の際はみ出しでも切らない
//    ※ app.js / fix.js / style.css / index.html は不変更
// ==========================================================================
(function applyM2FinalPatch4() {
  "use strict";
  if (window.__m2FinalPatch4Applied) return;
  window.__m2FinalPatch4Applied = true;

  (function injectM2FinalCss4() {
    if (document.getElementById('m2FinalPatchCss4')) return;
    var s = document.createElement('style');
    s.id = 'm2FinalPatchCss4';
    s.textContent = [
      /* ===== ボスバーより下を“少しずつ”下へ（上から順に隙間を作る） ===== */
      /* ① 敵・味方エリア：ボスバーとの密着を解く＝上のギチギチの主因を緩和 */
      'body.in-game-active #m2ArenaMid{margin-top:8px !important;}',
      /* ② 自HP/COMBOゲージ段：味方〜自ゲージに呼吸 */
      'body.in-game-active #m2ArenaMeGauge{margin-top:5px !important;}',
      /* ③ 下パッド段：自ゲージ〜問題エリアに呼吸（＝下の黒帯を“意図した間隔”へ） */
      'body.in-game-active #m2ArenaBottom{margin-top:7px !important;}',
      /* ④ 問題エリア内・見出しパネル：内部もわずかに下へ */
      'body.in-game-active #m2ArenaBottom .multi-question-header-panel{margin-top:3px !important;}',
      /* ⑤ 問題エリア内・TARGET WORD：単語表示にも少し余白 */
      'body.in-game-active #m2ArenaBottom #flickTargetWord{margin-top:3px !important;}',
      /* 念のため：アリーナは上詰め固定（margin-top がそのまま効く前提を保証） */
      'body.in-game-active #m2Arena{justify-content:flex-start !important;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  })();

  console.log('⚔️ multi.js 第4パッチ（ボスバーより下を少しずつ下へ：上ギチギチ緩和＋下余白削減）適用完了');
})();
// ==========================================================================
// ⚔️ multi.js 第5パッチ（末尾追記・本体＆第1/2/3/4パッチ 不変更）
//    ① 味方ダメージ演出の根治
//       ─ 内部的にはHPは減っている（＝シナリオA）。問題は“演出が見えていない”。
//         第2パッチのカード内 absolute 演出は overflow で切れていた疑い。
//         → 画面固定(position:fixed)の大きな▼数値＋アイコン赤フラッシュ＋
//           画面端の赤ビネット＋画面揺れ を“座標直打ち”で出す＝切れない・確実に見える。
//       ─ 不正解ペナルティは「自分だけ」のまま（仕様は変えない）。
//         敵の全体攻撃(time/combo)の演出だけを派手にして“狙われている実感”を作る。
//    ② 命中爆発の作り直し
//       ─ style.css のキーフレーム名typo(iitExplosionBurst≠hitExplosionBurst)で
//         本体の .popup-hit-explosion は“膨らまず光らず弾けない赤い円”になっていた。
//         → 本体円はCSSで非表示にし、自前で3層爆発
//           (放射する火花＋広がるリング＋中心の残光)を敵座標に同期生成。
//    ※ app.js / fix.js / style.css / index.html は不変更
//    ※ showCharacterPopup を“もう一段”ラップ（元を必ず呼ぶ＝飛翔バブル等はそのまま）
// ==========================================================================
(function applyM2FinalPatch5() {
  "use strict";
  if (window.__m2FinalPatch5Applied) return;
  window.__m2FinalPatch5Applied = true;

  // ------------------------------------------------------------------
  // 【1】スタイル注入（末尾＝後勝ち。詳細度を body.in-game-active で底上げ）
  // ------------------------------------------------------------------
  (function injectM2FinalCss5() {
    if (document.getElementById('m2FinalPatchCss5')) return;
    var s = document.createElement('style');
    s.id = 'm2FinalPatchCss5';
    s.textContent = [
      /* ===== ② 本体の“動かない赤い円”爆発を非表示（自前3層に置き換え） ===== */
      'body.in-game-active .popup-hit-explosion{display:none !important;}',

      /* ===== ② 自前3層爆発コンテナ ===== */
      '.m2-explosion{position:fixed;z-index:340;pointer-events:none;}',
      /* 層1：広がるリング */
      '.m2-exp-ring{position:absolute;left:0;top:0;width:64px;height:64px;border-radius:50%;',
      'border:3px solid rgba(255,210,120,.95);box-shadow:0 0 18px rgba(255,138,61,.8),inset 0 0 14px rgba(255,84,104,.6);',
      'transform:translate(-50%,-50%) scale(.2);opacity:.95;animation:m2ExpRing .52s cubic-bezier(.2,.7,.3,1) forwards;}',
      '.m2-exp-ring.two{width:40px;height:40px;border-color:rgba(255,255,255,.9);animation-duration:.42s;animation-delay:.04s;}',
      '@keyframes m2ExpRing{0%{transform:translate(-50%,-50%) scale(.2);opacity:.95}70%{opacity:.5}100%{transform:translate(-50%,-50%) scale(2.6);opacity:0}}',
      /* 層2：中心の残光（白→金→赤で閃いて消える） */
      '.m2-exp-core{position:absolute;left:0;top:0;width:46px;height:46px;border-radius:50%;',
      'background:radial-gradient(circle,#fff 0%,#ffe9a8 26%,#ff8a3d 54%,rgba(255,84,104,.0) 74%);',
      'transform:translate(-50%,-50%) scale(.4);filter:brightness(2.4);mix-blend-mode:screen;',
      'animation:m2ExpCore .5s ease-out forwards;}',
      '@keyframes m2ExpCore{0%{transform:translate(-50%,-50%) scale(.4);opacity:1;filter:brightness(2.6)}40%{transform:translate(-50%,-50%) scale(1.25);opacity:.95;filter:brightness(1.6)}100%{transform:translate(-50%,-50%) scale(1.7);opacity:0;filter:brightness(1)}}',
      /* 層3：放射する火花（JSが各角度へ飛ばす） */
      '.m2-exp-spark{position:absolute;left:0;top:0;width:5px;height:5px;border-radius:50%;',
      'background:radial-gradient(circle,#fff,#f5c451 60%,rgba(255,84,104,0));box-shadow:0 0 8px rgba(255,196,81,.9);',
      'transform:translate(-50%,-50%);transition:transform .5s cubic-bezier(.15,.7,.3,1),opacity .5s ease;}',

      /* ===== ① 味方ダメージ：画面固定の大きな▼数値（切れない） ===== */
      '.m2-ally-hit-num{position:fixed;z-index:345;pointer-events:none;display:flex;flex-direction:column;align-items:center;',
      'transform:translate(-50%,-50%);animation:m2AllyHitDrop 1.15s cubic-bezier(.2,.85,.3,1) forwards;}',
      '.m2-ally-hit-num .m2-ahn-mark{width:0;height:0;border-left:11px solid transparent;border-right:11px solid transparent;',
      'border-top:16px solid #ff5468;filter:drop-shadow(0 0 8px rgba(255,84,104,.95));margin-bottom:1px;}',
      '.m2-ally-hit-num .m2-ahn-text{font-family:ui-monospace,monospace;font-size:22px;font-weight:900;color:#ff5468;letter-spacing:.02em;',
      'text-shadow:0 0 14px rgba(255,84,104,.9),2px 2px 0 #fff,-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff;}',
      '@keyframes m2AllyHitDrop{0%{transform:translate(-50%,-90%) scale(1.5);opacity:0}14%{transform:translate(-50%,-50%) scale(1);opacity:1}68%{opacity:1}100%{transform:translate(-50%,-150%) scale(.82);opacity:0}}',

      /* ===== ① 味方アイコンの赤フラッシュ（既存より派手・確実） ===== */
      'body.in-game-active .multi-party-icon.m2-ally-hit{animation:m2AllyIconHit .46s ease-out !important;}',
      '@keyframes m2AllyIconHit{0%{filter:brightness(.35) sepia(1) hue-rotate(-50deg) saturate(6);transform:scale(1.28)}50%{filter:brightness(1.4) sepia(.4) hue-rotate(-30deg) saturate(3)}100%{filter:none;transform:scale(1)}}',

      /* ===== ① 画面端の赤ビネット（“喰らった”を画面全体で伝える） ===== */
      '#m2DamageVignette{position:fixed;inset:0;z-index:338;pointer-events:none;opacity:0;',
      'box-shadow:inset 0 0 120px rgba(255,40,60,.0);transition:opacity .12s ease,box-shadow .12s ease;}',
      '#m2DamageVignette.m2-dv-on{opacity:1;box-shadow:inset 0 0 140px rgba(255,40,60,.55),inset 0 0 40px rgba(255,84,104,.4);}',

      /* ===== ① 画面揺れ（既存 boss-damage-shake が効かない時の保険） ===== */
      'body.m2-screen-shake{animation:m2ScreenShake .34s ease;}',
      '@keyframes m2ScreenShake{0%,100%{transform:translate(0,0)}15%{transform:translate(-6px,3px)}30%{transform:translate(7px,-4px)}45%{transform:translate(-5px,-3px)}60%{transform:translate(5px,4px)}80%{transform:translate(-3px,2px)}}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  })();

  // ------------------------------------------------------------------
  // 【2】画面端ビネット要素を1つだけ用意（reuse）
  // ------------------------------------------------------------------
  function ensureVignette() {
    var v = document.getElementById('m2DamageVignette');
    if (!v) { v = document.createElement('div'); v.id = 'm2DamageVignette'; document.body.appendChild(v); }
    return v;
  }
  var __dvTimer = null;
  function flashVignette() {
    var v = ensureVignette();
    v.classList.add('m2-dv-on');
    clearTimeout(__dvTimer);
    __dvTimer = setTimeout(function () { v.classList.remove('m2-dv-on'); }, 300);
  }

  // ------------------------------------------------------------------
  // 【3】敵（または対人相手）の現在座標を取得（到達時に再計測＝揺れ/浮遊に追従）
  // ------------------------------------------------------------------
  function m2TargetRect() {
    var el = document.getElementById('multiBossImage');
    if (el && el.style.display !== 'none' && el.getBoundingClientRect) {
      var r = el.getBoundingClientRect(); if (r.width) return r;
    }
    var sig = document.getElementById('m2BossSigil');
    if (sig && sig.getBoundingClientRect) { var r2 = sig.getBoundingClientRect(); if (r2.width) return r2; }
    var pvp = document.getElementById('multiPvpOpponentVisualContainer');
    if (pvp && pvp.style.display !== 'none' && pvp.getBoundingClientRect) { var r3 = pvp.getBoundingClientRect(); if (r3.width) return r3; }
    return { left: window.innerWidth / 2 - 60, top: window.innerHeight / 3, width: 120, height: 120 };
  }

  // ------------------------------------------------------------------
  // 【4】3層爆発を生成（放射火花＋リング＋残光）
  // ------------------------------------------------------------------
  function spawnExplosion(cx, cy) {
    var box = document.createElement('div');
    box.className = 'm2-explosion';
    box.style.left = cx + 'px';
    box.style.top = cy + 'px';
    var core = document.createElement('div'); core.className = 'm2-exp-core';
    var ring1 = document.createElement('div'); ring1.className = 'm2-exp-ring';
    var ring2 = document.createElement('div'); ring2.className = 'm2-exp-ring two';
    box.appendChild(ring1); box.appendChild(ring2); box.appendChild(core);
    // 放射火花：12本を等角度で外側へ飛ばす
    var SPARKS = 12;
    var sparks = [];
    for (var i = 0; i < SPARKS; i++) {
      var sp = document.createElement('div'); sp.className = 'm2-exp-spark';
      var size = 4 + Math.round(Math.random() * 4);
      sp.style.width = size + 'px'; sp.style.height = size + 'px';
      box.appendChild(sp); sparks.push(sp);
    }
    document.body.appendChild(box);
    // 次フレームで火花を各角度へ（距離もばらつかせて“生きた”爆発に）
    requestAnimationFrame(function () {
      for (var j = 0; j < sparks.length; j++) {
        var ang = (Math.PI * 2 * j / SPARKS) + (Math.random() * 0.5 - 0.25);
        var dist = 34 + Math.random() * 40;
        var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
        sparks[j].style.transform = 'translate(calc(-50% + ' + dx.toFixed(1) + 'px),calc(-50% + ' + dy.toFixed(1) + 'px)) scale(.3)';
        sparks[j].style.opacity = '0';
      }
    });
    setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 620);
  }

  // ------------------------------------------------------------------
  // 【5】味方座標に fixed の▼数値を出す（overflow で切れない）
  // ------------------------------------------------------------------
  function spawnAllyHitNum(memberId, amount) {
    var mel = document.getElementById('partyMember-' + memberId);
    if (!mel || !mel.getBoundingClientRect) return;
    var r = mel.getBoundingClientRect();
    if (!r.width) return;
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var n = document.createElement('div');
    n.className = 'm2-ally-hit-num';
    n.style.left = cx + 'px';
    n.style.top = cy + 'px';
    n.innerHTML = '<div class="m2-ahn-mark"></div><div class="m2-ahn-text">' + amount + '</div>';
    document.body.appendChild(n);
    setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 1200);
  }

  // ------------------------------------------------------------------
  // 【6】showCharacterPopup を“もう一段”ラップ
  //     ・元（本体→AAA→第1→第2 の連鎖）を必ず呼ぶ＝飛翔バブル等はそのまま
  //     ・attack → バブル到達(600ms)に合わせて敵座標へ3層爆発
  //     ・damage → fixed▼数値＋アイコン赤フラッシュ＋赤ビネット＋画面揺れ
  // ------------------------------------------------------------------
  var __prevPopup5 = window.showCharacterPopup;
  window.showCharacterPopup = function (memberId, amount, type) {
    var r = __prevPopup5 ? __prevPopup5.apply(this, arguments) : undefined;
    try {
      if (type === 'attack') {
        // 飛翔バブルが敵に届く 600ms 後に、再計測した敵座標へ3層爆発
        setTimeout(function () {
          try {
            var tr = m2TargetRect();
            spawnExplosion(tr.left + tr.width / 2, tr.top + tr.height / 2);
          } catch (e) {}
        }, 600);
      } else if (type === 'damage') {
        // ① 画面固定の大きな▼数値
        spawnAllyHitNum(memberId, amount);
        // ② アイコン赤フラッシュ
        var mel = document.getElementById('partyMember-' + memberId);
        if (mel) {
          var ic = mel.querySelector('.multi-party-icon');
          if (ic) { ic.classList.remove('m2-ally-hit'); void ic.offsetWidth; ic.classList.add('m2-ally-hit'); }
        }
        // ③ 画面端の赤ビネット
        flashVignette();
        // ④ 画面揺れ（既存と併用＝どちらか効けば揺れる）
        document.body.classList.add('m2-screen-shake');
        try { document.body.classList.add('boss-damage-shake'); } catch (e) {}
        setTimeout(function () {
          document.body.classList.remove('m2-screen-shake');
          try { document.body.classList.remove('boss-damage-shake'); } catch (e) {}
        }, 340);
      }
    } catch (e) {}
    return r;
  };

  console.log('⚔️ multi.js 第5パッチ（味方ダメ演出根治：fixed▼＋赤フラッシュ＋ビネット＋揺れ／3層爆発）適用完了');
})();
// ==========================================================================
// ⚔️ multi.js 第6パッチ（末尾追記・本体＆既存末尾パッチ 不変更）
//    ① 操作パネル（下パッド）の“左ずれ”を中央固定で根治
//       ─ 犯人は .multi-flick-area の align-items 未指定（縦flexの横軸が競合で
//         左詰めになる）＋グリッドが shrink して左に寄る構造。
//         → align-items:center ＋ グリッドを margin:auto ＋ 1fr 等幅固定で、
//           文字数に一切左右されない“中央固定”にする。
//    ② 自分へのダメージ（＋味方も）を確実に反映
//       ─ 「バーが減らない」も「演出が出ない」も両方潰す設計：
//         ・updateMultiHpBars をラップ＝自分のm2バー(partyMemberHpFill-0)と
//           旧来バー(multiPlayerOwnHpFill)を“自前で”毎描画更新（経路依存を断つ）
//         ・showCharacterPopup(damage) をラップ＝fixed座標直打ちの▼数値＋
//           アイコン赤フラッシュ＋HPバー赤点滅＋画面端ビネット＋画面揺れ
//           （overflow/座標取りこぼしに影響されない＝確実に見える）
//    ※ app.js / fix.js / style.css / index.html は不変更
//    ※ 既存末尾パッチ群は消さない（ラップ方式で後勝ち＋元を必ず呼ぶ）
// ==========================================================================
(function applyM2FinalPatch6() {
  "use strict";
  if (window.__m2FinalPatch6Applied) return;
  window.__m2FinalPatch6Applied = true;

  // ------------------------------------------------------------------
  // 【1】スタイル注入（末尾＝後勝ち。詳細度を body.in-game-active で底上げ）
  // ------------------------------------------------------------------
  (function injectM2FinalCss6() {
    if (document.getElementById('m2FinalPatchCss6')) return;
    var s = document.createElement('style');
    s.id = 'm2FinalPatchCss6';
    s.textContent = [
      /* ===== ① 操作パネルを“中央固定”（文字数に左右されない） ===== */
      /* 下パッド枠：縦flexの横軸を中央揃えに固定 */
      'body.in-game-active #m2ArenaBottom .multi-flick-area{align-items:center !important;}',
      /* 3x3グリッド：左右autoで中央へ＋1fr等幅固定（セル幅が文字数で変わらない） */
      'body.in-game-active .multi-grid-3x3{',
      '  margin-left:auto !important;margin-right:auto !important;',
      '  width:100% !important;max-width:360px !important;',
      '  grid-template-columns:repeat(3,1fr) !important;',
      '}',
      /* 各選択肢：等幅保証＋はみ出し防止 */
      'body.in-game-active .multi-grid-3x3 .flick-choice{min-width:0 !important;width:100% !important;}',
      /* 見出しパネル：全幅＋中央 */
      'body.in-game-active .multi-question-header-panel{',
      '  width:100% !important;text-align:center !important;',
      '  display:flex !important;flex-direction:column !important;align-items:center !important;justify-content:center !important;',
      '}',
      /* TARGET WORD：中央寄せ */
      'body.in-game-active #flickTargetWord{margin-left:auto !important;margin-right:auto !important;display:inline-block !important;}',

      /* ===== ② 自分/味方ダメージ演出 ===== */
      /* アイコン赤フラッシュ（自分m2-me-icon も 味方m2-ally-icon も同一クラスで発火） */
      'body.in-game-active .multi-party-icon.m2-ic-hit{animation:m2IcHit6 .5s ease-out !important;}',
      '@keyframes m2IcHit6{0%{filter:brightness(.4) sepia(1) hue-rotate(-50deg) saturate(6);transform:scale(1.28)}50%{filter:brightness(1.4) sepia(.4) hue-rotate(-30deg) saturate(3)}100%{filter:none;transform:scale(1)}}',
      /* HPバーの赤点滅（自分・味方共通） */
      'body.in-game-active .multi-party-hp-fill.m2-bar-hit{background:linear-gradient(90deg,#ff3b3b,#ff7a7a) !important;box-shadow:0 0 12px rgba(255,60,60,.9) !important;transition:background .12s ease !important;}',
      /* fixed座標直打ちの▼数値（overflow/親レイアウトに影響されない） */
      '.m2-dmgnum{position:fixed;z-index:346;pointer-events:none;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);animation:m2DmgDrop6 1.15s cubic-bezier(.2,.85,.3,1) forwards;}',
      '.m2-dn-mark{width:0;height:0;border-left:11px solid transparent;border-right:11px solid transparent;border-top:16px solid #ff5468;filter:drop-shadow(0 0 8px rgba(255,84,104,.95));margin-bottom:1px;}',
      '.m2-dn-text{font-family:ui-monospace,monospace;font-size:22px;font-weight:900;color:#ff5468;letter-spacing:.02em;text-shadow:0 0 14px rgba(255,84,104,.9),2px 2px 0 #fff,-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff;}',
      '@keyframes m2DmgDrop6{0%{transform:translate(-50%,-90%) scale(1.5);opacity:0}14%{transform:translate(-50%,-50%) scale(1);opacity:1}68%{opacity:1}100%{transform:translate(-50%,-150%) scale(.82);opacity:0}}',
      /* 画面端の赤ビネット（喰らった瞬間を画面全体で伝える） */
      '#m2DamageVignette{position:fixed;inset:0;z-index:338;pointer-events:none;opacity:0;box-shadow:inset 0 0 120px rgba(255,40,60,0);transition:opacity .12s ease,box-shadow .12s ease;}',
      '#m2DamageVignette.m2-dv-on{opacity:1;box-shadow:inset 0 0 140px rgba(255,40,60,.55),inset 0 0 40px rgba(255,84,104,.4);}',
      /* 画面揺れ */
      'body.m2-screen-shake{animation:m2ScreenShake6 .34s ease;}',
      '@keyframes m2ScreenShake6{0%,100%{transform:translate(0,0)}15%{transform:translate(-6px,3px)}30%{transform:translate(7px,-4px)}45%{transform:translate(-5px,-3px)}60%{transform:translate(5px,4px)}80%{transform:translate(-3px,2px)}}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  })();

  // ------------------------------------------------------------------
  // 【2】画面端ビネット要素を1つだけ用意（reuse）
  // ------------------------------------------------------------------
  function ensureVignette6() {
    var v = document.getElementById('m2DamageVignette');
    if (!v) { v = document.createElement('div'); v.id = 'm2DamageVignette'; document.body.appendChild(v); }
    return v;
  }
  function flashVignette6() {
    var v = ensureVignette6();
    v.classList.add('m2-dv-on');
    clearTimeout(window.__m2dvT6);
    window.__m2dvT6 = setTimeout(function () { v.classList.remove('m2-dv-on'); }, 300);
  }

  // ------------------------------------------------------------------
  // 【3】fixed座標直打ちの▼数値をメンバー座標に出す
  // ------------------------------------------------------------------
  function spawnDmgNum6(memberId, amount) {
    var mel = document.getElementById('partyMember-' + memberId);
    if (!mel || !mel.getBoundingClientRect) return;
    var r = mel.getBoundingClientRect();
    if (!r.width) return;
    var n = document.createElement('div');
    n.className = 'm2-dmgnum';
    n.style.left = (r.left + r.width / 2) + 'px';
    n.style.top = (r.top + r.height / 2) + 'px';
    n.innerHTML = '<div class="m2-dn-mark"></div><div class="m2-dn-text">' + amount + '</div>';
    document.body.appendChild(n);
    setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 1200);
  }

  // ------------------------------------------------------------------
  // 【4】updateMultiHpBars ラップ
  //     元を呼んだ“後”に、自分＋味方のバーを“自前で”毎描画更新
  //     ＝「数値は減るがバーが動かない」「更新経路が取りこぼす」を両方根絶
  // ------------------------------------------------------------------
  var __prevUpd6 = window.updateMultiHpBars;
  window.updateMultiHpBars = function () {
    var r = __prevUpd6 ? __prevUpd6.apply(this, arguments) : undefined;
    try {
      if (typeof multiPartyMembers !== 'undefined' && multiPartyMembers) {
        multiPartyMembers.forEach(function (m) {
          if (!m || !m.maxHp) return;
          var pct = Math.max(0, (m.hp / m.maxHp) * 100);
          var f = document.getElementById('partyMemberHpFill-' + m.id);
          if (f) f.style.width = pct + '%';
        });
        var me = multiPartyMembers.find(function (m) { return m && m.isMe; });
        if (me && me.maxHp) {
          var pct2 = Math.max(0, (me.hp / me.maxHp) * 100);
          // m2レイアウトの自分バー（partyMemberHpFill-me.id）はforEachで済むが念のため
          var fm = document.getElementById('partyMemberHpFill-' + me.id);
          if (fm) fm.style.width = pct2 + '%';
          // 旧来の自分バーにも保険書き（表示されていなければ無害）
          var fo = document.getElementById('multiPlayerOwnHpFill');
          if (fo) { fo.style.width = pct2 + '%'; try { fo.parentElement.style.justifyContent = 'flex-start'; } catch (e) {} }
          var to = document.getElementById('multiPlayerOwnHpText');
          if (to) to.innerText = Math.max(0, Math.floor(me.hp)) + ' / ' + me.maxHp;
        }
      }
    } catch (e) {}
    return r;
  };

  // ------------------------------------------------------------------
  // 【5】showCharacterPopup ラップ
  //     damage 時＝自分・味方問わず fixed▼＋アイコン赤フラッシュ＋バー赤点滅
  //     ＋画面端ビネット＋画面揺れ を確実に発火（attack 側は既存に任せる）
  // ------------------------------------------------------------------
  var __prevPop6 = window.showCharacterPopup;
  window.showCharacterPopup = function (memberId, amount, type) {
    var r = __prevPop6 ? __prevPop6.apply(this, arguments) : undefined;
    if (type === 'damage') {
      try {
        // ① fixed▼数値
        spawnDmgNum6(memberId, amount);
        var mel = document.getElementById('partyMember-' + memberId);
        if (mel) {
          // ② アイコン赤フラッシュ
          var ic = mel.querySelector('.multi-party-icon');
          if (ic) { ic.classList.remove('m2-ic-hit'); void ic.offsetWidth; ic.classList.add('m2-ic-hit'); }
          // ③ HPバー赤点滅
          var fill = document.getElementById('partyMemberHpFill-' + memberId);
          if (fill) { fill.classList.add('m2-bar-hit'); setTimeout(function () { fill.classList.remove('m2-bar-hit'); }, 420); }
        }
        // ④ 画面端ビネット ＋ ⑤ 画面揺れ
        flashVignette6();
        document.body.classList.add('m2-screen-shake');
        setTimeout(function () { document.body.classList.remove('m2-screen-shake'); }, 340);
      } catch (e) {}
    }
    return r;
  };

  console.log('⚔️ multi.js 第6パッチ（操作パネル中央固定＋自分/味方ダメージ根治：自前バー更新＋fixed演出）適用完了');
})();
// ==========================================================================
// ⚔️ multi.js 第7パッチ（末尾追記・本体＆既存末尾パッチ 不変更）
//    ① 選択肢9マス（8選択肢＋中央🔥）を“完全均一”に固定
//       ─ 行ごとの高さブレ（2行テキストの行だけ伸びる）を構造的に不可能にする。
//         全セルを 76px 固定高＋2行clamp に統一。長い意味もはみ出さず、
//         右端セルの画面端切れも 100%＋余白で解消。
//    ② 4人パーティの味方行（ALLY 1/2/3）が描画競合で消える問題を根治
//       ─ 犯人は renderMultiParty の innerHTML 全消去方式と、
//         MutationObserver(observeAaaDecor) の常時監視が噛み合う“窓”。
//         → 描画後に「味方行が3個揃っているか」を検証し、不足なら即再描画。
//         → observer が空フレームを拾っても復元が勝つようガードを張る。
//    ※ app.js / fix.js / style.css / index.html は不変更
//    ※ 既存末尾パッチ群は消さない（ラップ方式で後勝ち＋元を必ず呼ぶ）
// ==========================================================================
(function applyM2FinalPatch7() {
  "use strict";
  if (window.__m2FinalPatch7Applied) return;
  window.__m2FinalPatch7Applied = true;

  // ------------------------------------------------------------------
  // 【1】スタイル注入（末尾＝後勝ち。詳細度を body.in-game-active で底上げ）
  // ------------------------------------------------------------------
  (function injectM2FinalCss7() {
    if (document.getElementById('m2FinalPatchCss7')) return;
    var s = document.createElement('style');
    s.id = 'm2FinalPatchCss7';
    s.textContent = [
      /* =====  選択肢9マスを“完全均一”（76px固定高＋2行clamp） ===== */
      'body.in-game-active .multi-grid-3x3{',
      '  display:grid !important;',
      '  grid-template-columns:repeat(3,1fr) !important;',
      '  grid-template-rows:repeat(3,76px) !important;', /* ★3行とも76px固定＝行ブレ根絶 */
      '  gap:6px !important;',
      '  width:100% !important;max-width:360px !important;',
      '  margin-left:auto !important;margin-right:auto !important;',
      '}',
      /* 各セル：76pxに収める（はみ出し禁止＋2行clamp） */
      'body.in-game-active .multi-grid-3x3 .flick-choice{',
      '  height:76px !important;min-height:76px !important;max-height:76px !important;',
      '  display:flex !important;align-items:center !important;justify-content:center !important;',
      '  padding:4px 6px !important;box-sizing:border-box !important;',
      '  overflow:hidden !important;',
      '  text-align:center !important;',
      '}',
      'body.in-game-active .multi-grid-3x3 .flick-choice .flick-choice-text{',
      '  display:-webkit-box !important;-webkit-line-clamp:2 !important;-webkit-box-orient:vertical !important;',
      '  overflow:hidden !important;line-height:1.25 !important;font-size:13px !important;',
      '  max-height:calc(1.25em * 2) !important;',
      '}',
      /* 中央🔥マスも同じ76pxに揃える */
      'body.in-game-active .multi-grid-3x3 .flick-choice.flick-center-spark{',
      '  height:76px !important;min-height:76px !important;max-height:76px !important;',
      '}',

      /* ===== ② 味方行の描画競合ガード用（存在しない時のみ表示する保険クラス） ===== */
      'body.in-game-active .m2-ally{display:flex !important;align-items:center !important;gap:8px !important;padding:4px 0 !important;}',
      'body.in-game-active .m2-ally .multi-party-icon{width:32px !important;height:32px !important;}',
      'body.in-game-active .m2-ally .multi-party-hp-bar{flex:1 !important;height:8px !important;background:rgba(255,255,255,.1) !important;border-radius:4px !important;overflow:hidden !important;}',
      'body.in-game-active .m2-ally .multi-party-hp-fill{height:100% !important;background:linear-gradient(90deg,#34d399,#6ee7b7) !important;border-radius:4px !important;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  })();

  // ------------------------------------------------------------------
  // 【2】renderMultiParty ラップ（描画後に味方行の存在を検証＋不足なら再描画）
  // ------------------------------------------------------------------
  var __prevRender7 = window.renderMultiParty;
  window.renderMultiParty = function () {
    var r = __prevRender7 ? __prevRender7.apply(this, arguments) : undefined;
    try {
      // 描画直後に味方行が3個（ALLY 1/2/3）揃っているか検証
      var container = document.getElementById('multiPartyContainer');
      if (container) {
        var allyRows = container.querySelectorAll('.m2-ally');
        // 4人パーティ（自分＋味方3）なのに味方行が3個未満＝描画漏れ
        if (allyRows.length < 3) {
          // 即再描画（1回だけ）
          setTimeout(function () {
            try {
              if (typeof __prevRender7 === 'function') __prevRender7();
            } catch (e) {}
          }, 50);
        }
      }
    } catch (e) {}
    return r;
  };

  // ------------------------------------------------------------------
  // 【3】cleanBossDecor / ensurePartyInLeft 直後の味方行復元ガード
  //     observer が空フレームを拾っても、味方行を即復元する
  // ------------------------------------------------------------------
  function restoreAllyRowsIfMissing() {
    try {
      var container = document.getElementById('multiPartyContainer');
      if (!container) return;
      var allyRows = container.querySelectorAll('.m2-ally');
      if (allyRows.length < 3 && typeof multiPartyMembers !== 'undefined' && multiPartyMembers) {
        // 味方メンバーが存在するのに描画されていない＝強制復元
        multiPartyMembers.forEach(function (m) {
          if (!m || m.isMe) return; // 自分は除外
          var existing = document.getElementById('partyMember-' + m.id);
          if (!existing) {
            // 行を再構築（簡易版：アイコン＋HPバー）
            var row = document.createElement('div');
            row.className = 'm2-ally';
            row.id = 'partyMember-' + m.id;
            row.innerHTML = '<div class="multi-party-icon" style="background:#6b21a8;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;">修</div>' +
                            '<div class="multi-party-hp-bar"><div class="multi-party-hp-fill" id="partyMemberHpFill-' + m.id + '" style="width:100%;"></div></div>';
            container.appendChild(row);
          }
        });
      }
    } catch (e) {}
  }

  // cleanBossDecor / ensurePartyInLeft をラップし、実行後に味方行を検証
  var __prevClean7 = window.cleanBossDecor;
  window.cleanBossDecor = function () {
    var r = __prevClean7 ? __prevClean7.apply(this, arguments) : undefined;
    setTimeout(restoreAllyRowsIfMissing, 10);
    return r;
  };
  var __prevEnsure7 = window.ensurePartyInLeft;
  window.ensurePartyInLeft = function () {
    var r = __prevEnsure7 ? __prevEnsure7.apply(this, arguments) : undefined;
    setTimeout(restoreAllyRowsIfMissing, 10);
    return r;
  };

  console.log('⚔️ multi.js 第7パッチ（選択肢9マス完全均一＋味方行描画競合根治）適用完了');
})();
// ==========================================================================
// 🏰 マルチプレイUI刷新パッチ：ダンジョン風モード選択 ＋ 単語帳選択
//    ① チーム結成/参加画面・バトル設定画面をダンジョン風にフルリニューアル
//       （スワイプ廃止＝直感的タップ。協力戦/対人戦は「扉」、形式は「ルーン石版」、
//         人数は「石板トークン」、ボタンは彫り込み石版＋火花シーン）
//    ② 単語帳選択をフラッシュ単語と同じ方式（textbooksPool から select 生成）に変更
//       「英語：マイ単語帳/全範囲ランダム」＋範囲指定は撤廃。範囲＝選んだ単語帳の全単語。
//    ③ バトル開始時に選択教材へ差し替え、終了後に元教材へ自動復元（理解度も個別保存）
//    ※ app.js / fix.js / style.css / index.html は不変更。multi.js 末尾に追記するだけ
// ==========================================================================
(function applyMultiDungeonUiPatch() {
"use strict";
if (window.__multiDungeonUiApplied) return;
window.__multiDungeonUiApplied = true;

/* ---------- 0. 状態 ---------- */
var __savedBookState = null;   // バトル中の教材差し替え退避
var __lastCoopCount = 4;       // 協力戦パーティ人数の記憶
var __restoreWatcher = null;

/* ---------- 1. フォント確保（AAAパッチ未適用でも動くよう自己完結） ---------- */
(function ensureFonts() {
if (document.getElementById('mduFontLink') || document.getElementById('aaaFontLink')) return;
var l = document.createElement('link');
l.id = 'mduFontLink'; l.rel = 'stylesheet';
l.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=Noto+Serif+JP:wght@700;900&family=Noto+Sans+JP:wght@500;700;900&display=swap';
document.head.appendChild(l);
})();

/* ---------- 2. スタイル注入 ---------- */
(function injectMduCss() {
if (document.getElementById('mduCss')) return;
var s = document.createElement('style');
s.id = 'mduCss';
s.textContent = [
/* ===== 画面ベース：石壁の洞窟 ===== */
'#multi-battle-choice-screen,#multi-battle-setup-screen{',
'  position:fixed !important;top:0 !important;left:0 !important;right:0 !important;bottom:0 !important;',
'  width:100% !important;height:100% !important;margin:0 !important;overflow:hidden !important;z-index:40;',
'  background:',
'    radial-gradient(140% 120% at 50% 0%, rgba(90,70,50,.30) 0%, transparent 55%),',
'    radial-gradient(120% 100% at 50% 100%, rgba(0,0,0,.68) 0%, transparent 62%),',
'    repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 1px, transparent 1px 44px),',
'    repeating-linear-gradient(90deg, rgba(0,0,0,.16) 0 1px, transparent 1px 72px),',
'    linear-gradient(165deg, #3a2f22 0%, #2a2117 38%, #1e1811 68%, #14100a 100%);',
'}',
/* ===== アンビエント（光だまり/霧/火の粉） ===== */
'.mdu-ambient{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;}',
'.mdu-lightpool{position:absolute;width:340px;height:340px;border-radius:50%;filter:blur(10px);mix-blend-mode:screen;opacity:.5;}',
'.mdu-lightpool.tl{top:-90px;left:-70px;background:radial-gradient(circle, rgba(251,146,60,.36), transparent 70%);animation:mduPool 3.4s ease-in-out infinite alternate;}',
'.mdu-lightpool.tr{top:-90px;right:-70px;background:radial-gradient(circle, rgba(251,146,60,.36), transparent 70%);animation:mduPool 3.4s ease-in-out infinite alternate-reverse;}',
'.mdu-lightpool.floor{bottom:-130px;left:50%;transform:translateX(-50%);width:540px;height:300px;background:radial-gradient(ellipse, rgba(91,45,168,.30), transparent 70%);animation:mduPool 4.6s ease-in-out infinite alternate;}',
'@keyframes mduPool{from{opacity:.32}to{opacity:.6}}',
'.mdu-fog{position:absolute;inset:-20%;mix-blend-mode:screen;filter:blur(12px);opacity:.4;',
'  background:radial-gradient(38% 30% at 24% 30%, rgba(120,90,60,.5), transparent 70%),radial-gradient(34% 26% at 78% 68%, rgba(91,45,168,.35), transparent 72%);',
'  animation:mduFog 26s ease-in-out infinite alternate;}',
'.mdu-fog.two{animation-duration:34s;animation-direction:alternate-reverse;opacity:.26;background:radial-gradient(42% 30% at 65% 22%, rgba(251,146,60,.22), transparent 70%);}',
'@keyframes mduFog{0%{transform:translate3d(-4%,-2%,0) scale(1.05)}100%{transform:translate3d(4%,3%,0) scale(1.16)}}',
'.mdu-ember{position:absolute;bottom:-10px;border-radius:50%;pointer-events:none;opacity:0;animation:mduEmber linear infinite;}',
'@keyframes mduEmber{0%{transform:translateY(0) translateX(0) scale(.5);opacity:0}15%{opacity:.9}70%{opacity:.5}100%{transform:translateY(-105vh) translateX(var(--mx,18px)) scale(1);opacity:0}}',
/* ===== スクロール本文 ===== */
'.mdu-scroll{position:relative;z-index:2;height:100%;overflow-y:auto;-webkit-overflow-scrolling:touch;box-sizing:border-box;',
'  padding:calc(70px + env(safe-area-inset-top)) 18px calc(96px + env(safe-area-inset-bottom));',
'  display:flex;flex-direction:column;}',
/* ===== ヘッダー（松明＋タイトル） ===== */
'.mdu-header{display:flex;align-items:flex-end;justify-content:center;gap:16px;margin:4px 0 20px;}',
'.mdu-title-block{text-align:center;flex:1;min-width:0;}',
'.mdu-kicker{font-family:"Cinzel",serif;font-size:10px;font-weight:700;letter-spacing:.42em;color:#c8902a;text-transform:uppercase;text-shadow:0 0 10px rgba(200,144,42,.5);margin-bottom:7px;}',
'.mdu-title{font-family:"Noto Serif JP",serif;font-size:30px;font-weight:900;letter-spacing:.14em;line-height:1.1;margin:0;color:#f3e5c0;text-shadow:0 0 18px rgba(245,196,81,.35),0 2px 4px rgba(0,0,0,.9);}',
'.mdu-title-slim{font-size:24px;}',
'.mdu-sub{font-family:"Noto Sans JP",sans-serif;font-size:11px;font-weight:600;color:#a89880;letter-spacing:.14em;margin-top:8px;}',
/* 松明 */
'.mdu-torch{position:relative;display:flex;flex-direction:column;align-items:center;flex:0 0 auto;padding-bottom:6px;}',
'.mdu-torch-glow{position:absolute;top:-26px;left:50%;transform:translateX(-50%);width:92px;height:92px;border-radius:50%;background:radial-gradient(circle, rgba(251,146,60,.4), transparent 70%);filter:blur(6px);animation:mduPool 2.2s ease-in-out infinite alternate;pointer-events:none;}',
'.mdu-flame{position:relative;width:20px;height:28px;transform-origin:50% 100%;',
'  background:radial-gradient(ellipse at 50% 78%, #fffbe8 0%, #fde68a 28%, #fbbf24 46%, #f97316 66%, rgba(239,68,68,.9) 82%, rgba(239,68,68,0) 100%);',
'  border-radius:50% 50% 46% 54%/62% 62% 38% 38%;',
'  filter:drop-shadow(0 0 10px rgba(251,146,60,.9)) drop-shadow(0 -4px 18px rgba(251,191,36,.5));',
'  animation:mduFlicker 1.15s ease-in-out infinite alternate;}',
'.mdu-flame::before{content:"";position:absolute;left:50%;bottom:3px;width:9px;height:13px;transform:translateX(-50%);',
'  background:radial-gradient(ellipse at 50% 80%, #fff 0%, #fef3c7 55%, rgba(254,243,199,0) 100%);border-radius:50% 50% 45% 55%/60% 60% 40% 40%;}',
'@keyframes mduFlicker{0%{transform:scaleY(1) scaleX(1) rotate(-1.5deg)}35%{transform:scaleY(1.12) scaleX(.92) rotate(1deg)}70%{transform:scaleY(.94) scaleX(1.05) rotate(-1deg);filter:drop-shadow(0 0 13px rgba(251,146,60,1)) brightness(1.18)}100%{transform:scaleY(1.06) scaleX(.97) rotate(1.5deg)}}',
'.mdu-torch-stick{width:7px;height:30px;margin-top:-3px;border-radius:2px 2px 3px 3px;background:linear-gradient(180deg,#8a6a48,#5d452e 55%,#3e2d1d);box-shadow:inset 0 1px 0 rgba(255,255,255,.15),0 3px 6px rgba(0,0,0,.5);}',
/* ===== セクション見出し ===== */
'.mdu-section{margin:0 0 20px;}',
'.mdu-sec-head{display:flex;align-items:baseline;gap:9px;max-width:380px;margin:0 auto 11px;width:100%;}',
'.mdu-sec-num{font-family:"Cinzel",serif;font-weight:900;color:#c8902a;font-size:13px;}',
'.mdu-sec-ja{font-family:"Noto Serif JP",serif;font-size:14px;font-weight:900;letter-spacing:.1em;color:#f3e5c0;text-shadow:0 1px 2px #000;}',
'.mdu-sec-rule{flex:1;height:1px;background:linear-gradient(90deg,rgba(200,144,42,.5),transparent);align-self:center;}',
'.mdu-sec-en{font-family:"Cinzel",serif;font-size:8.5px;font-weight:700;letter-spacing:.3em;color:#8a7a5f;}',
/* ===== 選択画面：ゲート（結成/参加） ===== */
'.mdu-gates{display:flex;flex-direction:column;gap:14px;max-width:380px;width:100%;margin:0 auto;}',
'.mdu-gate{position:relative;display:flex;align-items:center;gap:14px;width:100%;padding:20px 18px;cursor:pointer;text-align:left;',
'  border-radius:16px;border:1.5px solid rgba(200,144,42,.35);user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;',
'  background:linear-gradient(165deg, rgba(255,255,255,.05), rgba(0,0,0,.2) 40%),repeating-linear-gradient(0deg, rgba(255,255,255,.02) 0 2px, transparent 2px 7px),linear-gradient(180deg,#3b3126,#262019 55%,#1b1510);',
'  box-shadow:inset 0 1px 0 rgba(255,255,255,.09),inset 0 -8px 16px rgba(0,0,0,.45),0 10px 24px rgba(0,0,0,.5);',
'  transition:transform .16s cubic-bezier(.2,.9,.3,1.3),box-shadow .2s ease,border-color .2s ease;}',
'.mdu-gate:active{transform:translateY(2px) scale(.985);box-shadow:inset 0 2px 10px rgba(0,0,0,.6),0 4px 10px rgba(0,0,0,.5);}',
'.mdu-gate-ico{flex:0 0 auto;width:56px;height:64px;display:flex;align-items:center;justify-content:center;font-size:30px;border-radius:28px 28px 10px 10px;background:radial-gradient(circle at 50% 30%, rgba(255,255,255,.08), rgba(0,0,0,.4));border:1px solid rgba(255,255,255,.14);box-shadow:inset 0 0 14px rgba(0,0,0,.6);}',
'.mdu-gate-body{flex:1;min-width:0;}',
'.mdu-gate-name{display:block;font-family:"Noto Serif JP",serif;font-size:19px;font-weight:900;letter-spacing:.08em;color:#f3e5c0;text-shadow:0 1px 3px rgba(0,0,0,.9);}',
'.mdu-gate-en{display:block;font-family:"Cinzel",serif;font-size:9px;font-weight:700;letter-spacing:.34em;color:#c8902a;margin-top:3px;}',
'.mdu-gate-desc{display:block;font-family:"Noto Sans JP",sans-serif;font-size:10.5px;font-weight:600;color:#a89880;margin-top:6px;line-height:1.5;}',
'.mdu-gate-arrow{flex:0 0 auto;font-size:17px;color:#c8902a;transition:transform .2s ease;}',
'.mdu-gate:active .mdu-gate-arrow{transform:translateX(5px);}',
'.gate-coop:active{border-color:rgba(52,231,228,.7);box-shadow:0 0 22px rgba(52,231,228,.35),inset 0 0 24px rgba(52,231,228,.12),inset 0 1px 0 rgba(255,255,255,.09);}',
'.gate-join:active{border-color:rgba(251,146,60,.7);box-shadow:0 0 22px rgba(251,146,60,.35),inset 0 0 24px rgba(251,146,60,.12),inset 0 1px 0 rgba(255,255,255,.09);}',
'@media (hover:hover){.mdu-gate:hover{transform:translateY(-2px);}.gate-coop:hover{border-color:rgba(52,231,228,.6);}.gate-join:hover{border-color:rgba(251,146,60,.6);}}',
/* ===== 設定画面：モードの扉（協力/対人） ===== */
'.mdu-doors{display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:380px;margin:0 auto;width:100%;}',
'.mdu-door{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:46px 10px 18px;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;',
'  border-radius:78px 78px 12px 12px;border:1.5px solid rgba(255,255,255,.14);',
'  background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(0,0,0,.18) 38%),repeating-linear-gradient(0deg, rgba(255,255,255,.02) 0 2px, transparent 2px 7px),linear-gradient(180deg,#38302a,#221c17 58%,#171209);',
'  box-shadow:inset 0 1px 0 rgba(255,255,255,.08),inset 0 -10px 18px rgba(0,0,0,.5),0 10px 22px rgba(0,0,0,.5);',
'  transition:transform .16s cubic-bezier(.2,.9,.3,1.3),box-shadow .22s ease,border-color .22s ease;}',
'.mdu-door::before{content:"";position:absolute;inset:7px 7px 42px;border-radius:70px 70px 8px 8px;border:1px solid rgba(255,255,255,.07);pointer-events:none;}',
'.mdu-door:active{transform:translateY(2px) scale(.98);}',
'.mdu-door-ico{font-size:34px;filter:drop-shadow(0 3px 6px rgba(0,0,0,.7));}',
'.mdu-door-name{font-family:"Noto Serif JP",serif;font-size:17px;font-weight:900;letter-spacing:.1em;color:#e8dcc0;text-shadow:0 1px 3px #000;}',
'.mdu-door-en{font-family:"Cinzel",serif;font-size:8.5px;font-weight:700;letter-spacing:.3em;color:#9c8b70;}',
'.mdu-door-flame{position:absolute;top:15px;left:50%;transform:translateX(-50%) scale(.6);width:16px;height:22px;opacity:0;border-radius:50% 50% 46% 54%/62% 62% 38% 38%;transform-origin:50% 100%;transition:opacity .25s ease;}',
'.mdu-door-badge{position:absolute;top:10px;right:10px;font-family:"Noto Sans JP",sans-serif;font-size:9px;font-weight:800;letter-spacing:.08em;padding:3px 8px;border-radius:999px;opacity:0;transform:scale(.7);transition:all .22s cubic-bezier(.2,.9,.3,1.4);}',
'.mdu-door.selected{transform:translateY(-2px);}',
'.door-coop.selected{border-color:rgba(52,231,228,.75);box-shadow:0 0 26px rgba(52,231,228,.4),inset 0 0 30px rgba(52,231,228,.14),inset 0 1px 0 rgba(255,255,255,.1),0 12px 24px rgba(0,0,0,.5);}',
'.door-coop.selected .mdu-door-flame{opacity:1;animation:mduFlicker 1.15s ease-in-out infinite alternate;background:radial-gradient(ellipse at 50% 78%, #ecfeff 0%, #a5f3fc 30%, #34e7e4 55%, rgba(14,143,140,.9) 78%, rgba(52,231,228,0) 100%);filter:drop-shadow(0 0 10px rgba(52,231,228,.9));}',
'.door-coop.selected .mdu-door-badge{opacity:1;transform:scale(1);color:#04201f;background:linear-gradient(135deg,#9af6f1,#34e7e4);box-shadow:0 0 10px rgba(52,231,228,.6);}',
'.door-coop.selected .mdu-door-name{color:#c8fffb;text-shadow:0 0 12px rgba(52,231,228,.6),0 1px 3px #000;}',
'.door-pvp.selected{border-color:rgba(255,84,110,.75);box-shadow:0 0 26px rgba(255,84,110,.4),inset 0 0 30px rgba(255,84,110,.14),inset 0 1px 0 rgba(255,255,255,.1),0 12px 24px rgba(0,0,0,.5);}',
'.door-pvp.selected .mdu-door-flame{opacity:1;animation:mduFlicker 1s ease-in-out infinite alternate;background:radial-gradient(ellipse at 50% 78%, #fff1f2 0%, #fda4af 30%, #ff5468 55%, rgba(190,18,60,.9) 78%, rgba(255,84,104,0) 100%);filter:drop-shadow(0 0 10px rgba(255,84,104,.9));}',
'.door-pvp.selected .mdu-door-badge{opacity:1;transform:scale(1);color:#2a0508;background:linear-gradient(135deg,#fda4af,#ff5468);box-shadow:0 0 10px rgba(255,84,104,.6);}',
'.door-pvp.selected .mdu-door-name{color:#ffd2d8;text-shadow:0 0 12px rgba(255,84,104,.6),0 1px 3px #000;}',
/* ===== 対人戦形式：ルーン石版 ===== */
'.mdu-runes{display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:380px;margin:0 auto;width:100%;}',
'.mdu-rune{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;padding:16px 10px 14px;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;border:none;',
'  clip-path:polygon(12px 0,calc(100% - 12px) 0,100% 12px,100% calc(100% - 12px),calc(100% - 12px) 100%,12px 100%,0 calc(100% - 12px),0 12px);',
'  background:linear-gradient(180deg,#3d342b,#241d16 60%,#191309);',
'  box-shadow:inset 0 0 0 1.5px rgba(200,144,42,.28),inset 0 1px 0 rgba(255,255,255,.08),inset 0 -6px 12px rgba(0,0,0,.5);',
'  transition:transform .15s ease,box-shadow .2s ease,filter .2s ease;}',
'.mdu-rune:active{transform:scale(.97);}',
'.mdu-rune-glyph{font-family:"Cinzel",serif;font-size:20px;font-weight:900;color:#c8902a;text-shadow:0 0 8px rgba(200,144,42,.4);line-height:1;}',
'.mdu-rune-name{font-family:"Cinzel","Noto Serif JP",serif;font-size:16px;font-weight:900;letter-spacing:.12em;color:#e8dcc0;}',
'.mdu-rune-desc{font-family:"Noto Sans JP",sans-serif;font-size:10px;font-weight:600;color:#9c8b70;letter-spacing:.06em;}',
'.mdu-rune.selected{box-shadow:inset 0 0 0 2px rgba(245,196,81,.85),inset 0 0 22px rgba(245,196,81,.22),inset 0 1px 0 rgba(255,255,255,.1);filter:drop-shadow(0 0 14px rgba(245,196,81,.5));}',
'.mdu-rune.selected .mdu-rune-glyph{color:#fde68a;text-shadow:0 0 12px rgba(251,191,36,.8);}',
'.mdu-rune.selected .mdu-rune-name{color:#fde68a;text-shadow:0 0 10px rgba(251,191,36,.5);}',
'.mdu-rune.selected .mdu-rune-desc{color:#d6b96a;}',
/* ===== パーティ人数：石板トークン ===== */
'.mdu-counts{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:380px;margin:0 auto;width:100%;}',
'.mdu-count{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:15px 6px;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;',
'  border-radius:14px;border:1.5px solid rgba(255,255,255,.13);background:linear-gradient(180deg,#38302a,#221c17 60%,#171209);',
'  box-shadow:inset 0 1px 0 rgba(255,255,255,.08),inset 0 -6px 12px rgba(0,0,0,.5),0 6px 14px rgba(0,0,0,.4);',
'  transition:transform .15s cubic-bezier(.2,.9,.3,1.3),box-shadow .2s ease,border-color .2s ease;}',
'.mdu-count:active{transform:scale(.95);}',
'.mdu-count-num{font-family:"Cinzel",serif;font-size:24px;font-weight:900;color:#e8dcc0;line-height:1;text-shadow:0 1px 3px #000;}',
'.mdu-count-label{font-family:"Noto Sans JP",sans-serif;font-size:10px;font-weight:700;color:#9c8b70;letter-spacing:.08em;}',
'.mdu-count.selected{border-color:rgba(52,231,228,.7);transform:translateY(-2px);box-shadow:0 0 18px rgba(52,231,228,.35),inset 0 0 18px rgba(52,231,228,.12),inset 0 1px 0 rgba(255,255,255,.1);}',
'.mdu-count.selected .mdu-count-num{color:#9af6f1;text-shadow:0 0 12px rgba(52,231,228,.7);}',
'.mdu-count.selected .mdu-count-label{color:#67d8d2;}',
'.mdu-count.selected::after{content:"✓";position:absolute;top:-7px;right:-7px;width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#9af6f1,#34e7e4);color:#04201f;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px rgba(52,231,228,.7);}',
/* ===== 単語帳セレクト（石枠） ===== */
'.mdu-select-wrap{position:relative;max-width:380px;margin:0 auto;width:100%;display:flex;align-items:center;border-radius:12px;border:1.5px solid rgba(200,144,42,.4);background:linear-gradient(180deg,#2c241c,#1c1610);box-shadow:inset 0 2px 6px rgba(0,0,0,.6),0 4px 12px rgba(0,0,0,.4);transition:border-color .2s ease,box-shadow .2s ease;}',
'.mdu-select-wrap:focus-within{border-color:rgba(245,196,81,.8);box-shadow:inset 0 2px 6px rgba(0,0,0,.6),0 0 16px rgba(245,196,81,.3);}',
'.mdu-select-ico{flex:0 0 auto;padding:0 4px 0 14px;font-size:18px;}',
'.mdu-select{flex:1;appearance:none;-webkit-appearance:none;background:transparent;border:none;outline:none;cursor:pointer;padding:14px 34px 14px 8px;color:#f3e5c0;font-family:"Noto Sans JP",sans-serif;font-size:14px;font-weight:700;letter-spacing:.02em;}',
'.mdu-select option{background:#1c1610;color:#f3e5c0;}',
'.mdu-select-arrow{position:absolute;right:14px;top:50%;transform:translateY(-50%);color:#c8902a;font-size:11px;pointer-events:none;}',
'.mdu-note{max-width:380px;margin:9px auto 0;width:100%;font-family:"Noto Sans JP",sans-serif;font-size:10.5px;font-weight:600;color:#8a7a5f;letter-spacing:.04em;text-align:center;}',
/* ===== 主ボタン（彫り込み石版＋火花シーン） ===== */
'.mdu-primary-btn{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:10px;width:100%;max-width:380px;margin:8px auto 12px;padding:17px 16px;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;',
'  font-family:"Noto Serif JP",serif;font-size:17px;font-weight:900;letter-spacing:.18em;color:#fde68a;',
'  text-shadow:0 1px 0 rgba(0,0,0,.9),0 0 14px rgba(251,191,36,.4);',
'  border-radius:14px;border:1.5px solid rgba(245,196,81,.55);',
'  background:linear-gradient(180deg, rgba(255,255,255,.07), rgba(0,0,0,.15) 45%),repeating-linear-gradient(0deg, rgba(255,255,255,.02) 0 2px, transparent 2px 6px),linear-gradient(180deg,#4a3b24,#2e2415 55%,#1f1809);',
'  box-shadow:inset 0 1px 0 rgba(255,255,255,.12),inset 0 -8px 14px rgba(0,0,0,.5),0 0 18px rgba(245,196,81,.22),0 10px 22px rgba(0,0,0,.5);',
'  transition:transform .14s ease,box-shadow .2s ease,filter .2s ease;}',
'.mdu-primary-btn::after{content:"";position:absolute;top:0;left:-70%;width:45%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,233,168,.16),transparent);transform:skewX(-18deg);animation:mduSheen 3.2s ease-in-out infinite;}',
'@keyframes mduSheen{0%{left:-70%}55%,100%{left:130%}}',
'.mdu-primary-btn:active{transform:translateY(2px) scale(.985);box-shadow:inset 0 3px 10px rgba(0,0,0,.6),0 0 24px rgba(245,196,81,.35);}',
/* ===== 戻るボタン ===== */
'.mdu-back-btn{display:block;width:100%;max-width:380px;margin:0 auto;padding:13px;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;',
'  font-family:"Noto Sans JP",sans-serif;font-size:12.5px;font-weight:700;letter-spacing:.14em;color:#a89880;',
'  border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.28);transition:all .18s ease;}',
'.mdu-back-btn:active{transform:scale(.98);color:#f3e5c0;border-color:rgba(200,144,42,.5);}',
/* ===== 出現アニメ ===== */
'.mdu-scroll > *{animation:mduRise .5s cubic-bezier(.2,.9,.3,1) both;}',
'.mdu-scroll > *:nth-child(2){animation-delay:.05s}.mdu-scroll > *:nth-child(3){animation-delay:.1s}.mdu-scroll > *:nth-child(4){animation-delay:.15s}.mdu-scroll > *:nth-child(5){animation-delay:.2s}.mdu-scroll > *:nth-child(6){animation-delay:.25s}.mdu-scroll > *:nth-child(7){animation-delay:.3s}',
'@keyframes mduRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}',
'@media (prefers-reduced-motion:reduce){.mdu-ambient *,.mdu-flame,.mdu-door-flame,.mdu-primary-btn::after,.mdu-scroll > *{animation:none !important;}}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();

/* ---------- 3. HTML ビルダー ---------- */
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function emberHtml(n){
var h = '';
for (var i = 0; i < n; i++) {
var left = Math.round(Math.random() * 100);
var delay = (Math.random() * 8).toFixed(2);
var dur = (6 + Math.random() * 8).toFixed(2);
var size = 2 + Math.round(Math.random() * 3);
var mx = Math.round(Math.random() * 50 - 25);
var c = Math.random() < 0.6 ? 'rgba(251,146,60,.85)' : 'rgba(251,191,36,.8)';
h += '<span class="mdu-ember" style="left:' + left + '%;width:' + size + 'px;height:' + size + 'px;background:' + c + ';box-shadow:0 0 6px ' + c + ';animation-delay:' + delay + 's;animation-duration:' + dur + 's;--mx:' + mx + 'px;"></span>';
}
return h;
}
function ambientHtml(){
return '<div class="mdu-ambient">' +
'<div class="mdu-lightpool tl"></div><div class="mdu-lightpool tr"></div><div class="mdu-lightpool floor"></div>' +
'<div class="mdu-fog"></div><div class="mdu-fog two"></div>' + emberHtml(16) + '</div>';
}
function torchHtml(){
return '<div class="mdu-torch"><div class="mdu-torch-glow"></div><div class="mdu-flame"></div><div class="mdu-torch-stick"></div></div>';
}
function secHead(num, ja, en){
return '<div class="mdu-sec-head"><span class="mdu-sec-num">' + num + '</span><span class="mdu-sec-ja">' + ja + '</span><span class="mdu-sec-rule"></span><span class="mdu-sec-en">' + en + '</span></div>';
}
function countBtn(n){
return '<button type="button" class="mdu-count" data-count="' + n + '" onclick="window.__mduSetPartyCount(' + n + ')"><span class="mdu-count-num">' + n + '</span><span class="mdu-count-label">人パーティ</span></button>';
}
function choiceHtml(){
return ambientHtml() +
'<div class="mdu-scroll">' +
'<div class="mdu-header">' + torchHtml() +
'<div class="mdu-title-block"><div class="mdu-kicker">Multiplayer Dungeon</div><h2 class="mdu-title">マルチプレイ</h2><div class="mdu-sub">進む道を選んでください</div></div>' +
torchHtml() + '</div>' +
'<div class="mdu-gates">' +
'<button type="button" class="mdu-gate gate-coop" onclick="window.showMultiSetup()"><span class="mdu-gate-ico">🤝</span><span class="mdu-gate-body"><span class="mdu-gate-name">チームを結成する</span><span class="mdu-gate-en">CREATE PARTY</span><span class="mdu-gate-desc">モードと単語帳を設定して仲間を募る</span></span><span class="mdu-gate-arrow">➤</span></button>' +
'<button type="button" class="mdu-gate gate-join" onclick="window.showMultiTeamList()"><span class="mdu-gate-ico">🚪</span><span class="mdu-gate-body"><span class="mdu-gate-name">チームに参加する</span><span class="mdu-gate-en">JOIN PARTY</span><span class="mdu-gate-desc">募集中のチーム一覧から参加する</span></span><span class="mdu-gate-arrow">➤</span></button>' +
'</div>' +
'<div style="flex:1;min-height:20px;"></div>' +
'<button type="button" class="mdu-back-btn" onclick="window.cancelMultiBattleChoice()">← 前のフロアへ戻る</button>' +
'</div>';
}
function setupHtml(){
return ambientHtml() +
'<div class="mdu-scroll">' +
'<div class="mdu-header">' + torchHtml() +
'<div class="mdu-title-block"><div class="mdu-kicker">Battle Setup</div><h2 class="mdu-title mdu-title-slim">バトル設定</h2></div>' +
torchHtml() + '</div>' +
'<div class="mdu-section">' + secHead('①', 'モード選択', 'SELECT MODE') +
'<div class="mdu-doors">' +
'<button type="button" id="mduDoorCoop" class="mdu-door door-coop" onclick="window.selectMultiMode(\'coop\')"><span class="mdu-door-flame"></span><span class="mdu-door-badge">選択中</span><span class="mdu-door-ico">🤝</span><span class="mdu-door-name">協力戦</span><span class="mdu-door-en">CO-OP</span></button>' +
'<button type="button" id="mduDoorPvp" class="mdu-door door-pvp" onclick="window.selectMultiMode(\'pvp\')"><span class="mdu-door-flame"></span><span class="mdu-door-badge">選択中</span><span class="mdu-door-ico">⚔️</span><span class="mdu-door-name">対人戦</span><span class="mdu-door-en">PVP</span></button>' +
'</div></div>' +
'<div class="mdu-section" id="mduPvpFormatFrame" style="display:none;">' + secHead('◆', '対人戦形式', 'PVP FORMAT') +
'<div class="mdu-runes">' +
'<button type="button" id="mduRune1v1" class="mdu-rune" onclick="window.handlePvpFormatChange(\'1v1\')"><span class="mdu-rune-glyph">Ⅰ</span><span class="mdu-rune-name">1v1</span><span class="mdu-rune-desc">シングルスバトル</span></button>' +
'<button type="button" id="mduRune2v2" class="mdu-rune" onclick="window.handlePvpFormatChange(\'2v2\')"><span class="mdu-rune-glyph">Ⅱ</span><span class="mdu-rune-name">2v2</span><span class="mdu-rune-desc">タッグチームバトル</span></button>' +
'</div></div>' +
'<div class="mdu-section" id="mduPartyCountFrame">' + secHead('◆', 'パーティ人数', 'PARTY SIZE') +
'<div class="mdu-counts">' + countBtn(2) + countBtn(3) + countBtn(4) + '</div></div>' +
'<div class="mdu-section">' + secHead('②', '単語帳', 'WORD BOOK') +
'<div class="mdu-select-wrap"><span class="mdu-select-ico">📔</span><select id="multiBookSelect" class="mdu-select"></select><span class="mdu-select-arrow">▼</span></div>' +
'<div class="mdu-note">選択した単語帳の全単語から出題されます</div></div>' +
'<select id="multiPvpTypeSelect" style="display:none;"><option value="1v1">1v1</option><option value="2v2">2v2</option></select>' +
'<select id="multiPlayerCount" style="display:none;"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select>' +
'<button type="button" class="mdu-primary-btn" onclick="window.startMultiBattleMatching()">⚔️ チームを結成して進む</button>' +
'<button type="button" class="mdu-back-btn" onclick="window.backToMultiChoiceFromSetup()">← 前のフロアへ戻る</button>' +
'</div>';
}

/* ---------- 4. UI 更新ヘルパー ---------- */
function updateDoorsUI(){
var coop = document.getElementById('mduDoorCoop'), pvp = document.getElementById('mduDoorPvp');
if (!coop || !pvp) return;
if (currentMultiMode === 'coop') { coop.classList.add('selected'); pvp.classList.remove('selected'); }
else { pvp.classList.add('selected'); coop.classList.remove('selected'); }
}
function updateRunesUI(){
var sel = document.getElementById('multiPvpTypeSelect');
var v = sel ? sel.value : '1v1';
var r1 = document.getElementById('mduRune1v1'), r2 = document.getElementById('mduRune2v2');
if (r1) r1.classList.toggle('selected', v === '1v1');
if (r2) r2.classList.toggle('selected', v === '2v2');
}
function updateCountsUI(){
var sel = document.getElementById('multiPlayerCount');
var v = sel ? sel.value : '4';
var btns = document.querySelectorAll('.mdu-count');
for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('selected', btns[i].getAttribute('data-count') === v);
}
function populateMultiBookSelect(){
var sel = document.getElementById('multiBookSelect');
if (!sel) return;
sel.innerHTML = '';
var pool = (typeof textbooksPool !== 'undefined' && textbooksPool && textbooksPool.length) ? textbooksPool : [];
if (pool.length === 0) { sel.innerHTML = '<option value="">配信中の教材なし</option>'; return; }
pool.forEach(function(book){
var opt = document.createElement('option');
opt.value = book.id;
opt.textContent = book.name;
if (book.id === currentTextbook) opt.selected = true;
sel.appendChild(opt);
});
}

/* ---------- 5. 画面関数の上書き ---------- */
window.showMultiBattleChoice = function(){
if (typeof vocabList === 'undefined' || vocabList.length === 0) {
alert('⚠️ 学習用単語がまだ配信されていません。\n管理者の単語追加をお待ちください。');
return;
}
var lbArea = document.getElementById('gameLeaderboardArea'); if (lbArea) lbArea.style.display = 'none';
var startScreen = document.getElementById('game-start-screen'); if (startScreen) startScreen.style.display = 'none';
var choice = document.getElementById('multi-battle-choice-screen');
choice.style.display = 'block';
['multi-battle-team-list-screen','multi-battle-setup-screen','multi-battle-matching-screen','multi-battle-play-screen'].forEach(function(id){
var el = document.getElementById(id); if (el) el.style.display = 'none';
});
choice.innerHTML = choiceHtml();
};
window.showMultiSetup = function(){
document.getElementById('multi-battle-choice-screen').style.display = 'none';
var setup = document.getElementById('multi-battle-setup-screen');
setup.style.display = 'block';
setup.innerHTML = setupHtml();
populateMultiBookSelect();
window.selectMultiMode('coop');
};
window.selectMultiMode = function(mode){
var countSel = document.getElementById('multiPlayerCount');
// 協力戦を離れる直前に人数を記憶
if (currentMultiMode === 'coop' && countSel && countSel.value !== '1') {
__lastCoopCount = parseInt(countSel.value) || 4;
}
currentMultiMode = mode;
var pvpFrame = document.getElementById('mduPvpFormatFrame');
var countFrame = document.getElementById('mduPartyCountFrame');
var pvpSel = document.getElementById('multiPvpTypeSelect');
if (mode === 'coop') {
if (pvpFrame) pvpFrame.style.display = 'none';
if (countFrame) countFrame.style.display = 'block';
if (countSel && (countSel.value === '1' || countSel.value === '2')) countSel.value = String(__lastCoopCount || 4);
updateCountsUI();
} else {
if (pvpFrame) pvpFrame.style.display = 'block';
if (countFrame) countFrame.style.display = 'none';
if (pvpSel) window.handlePvpFormatChange(pvpSel.value);
}
updateDoorsUI();
};
window.handlePvpFormatChange = function(format){
var countSel = document.getElementById('multiPlayerCount');
var pvpSel = document.getElementById('multiPvpTypeSelect');
if (pvpSel) pvpSel.value = format;
if (countSel) countSel.value = (format === '1v1') ? '1' : '2';
updateRunesUI();
};
window.__mduSetPartyCount = function(n){
var sel = document.getElementById('multiPlayerCount');
if (sel) sel.value = String(n);
__lastCoopCount = n;
updateCountsUI();
};

/* ---------- 6. 単語帳の取得 / 差し替え / 復元 ---------- */
function fetchBookWords(bookKey){
var master = null;
try { if (typeof textbooksCacheMap !== 'undefined' && textbooksCacheMap && textbooksCacheMap[bookKey]) master = textbooksCacheMap[bookKey]; } catch(e){}
if (!master) { try { var lc = localStorage.getItem('core_v4_cache_' + bookKey); if (lc) master = JSON.parse(lc); } catch(e){} }
var p = master ? Promise.resolve(master) : (function(){
if (window.db && window.fbGetDoc && window.fbDoc) {
var ref = window.fbDoc(window.db, 'shared', 'vocab_' + bookKey);
return window.fbGetDoc(ref).then(function(snap){
return (snap.exists() && snap.data() && snap.data().custom_words) ? snap.data().custom_words : [];
}).catch(function(){ return []; });
}
return Promise.resolve([]);
})();
return p.then(function(m){
m = m || [];
if (typeof window.stripVocabProgressFromWords === 'function') m = window.stripVocabProgressFromWords(m);
return m;
});
}
function restoreBook(){
if (__restoreWatcher) { clearInterval(__restoreWatcher); __restoreWatcher = null; }
if (!__savedBookState) return;
try { vocabList = __savedBookState.vocabList; } catch(e){}
try { currentTextbook = __savedBookState.currentTextbook; } catch(e){}
try { currentUserVocabProgress = __savedBookState.progress; } catch(e){}
__savedBookState = null;
if (typeof window.rebuildVocabStemIndex === 'function') { try { window.rebuildVocabStemIndex(); } catch(e){} }
}
function applyMultiBook(){
if (__savedBookState) restoreBook(); // 前回セッションの残りを防御的に復元
var sel = document.getElementById('multiBookSelect');
if (!sel || !sel.value) return Promise.resolve();
var bookKey = sel.value;
if (bookKey === currentTextbook) return Promise.resolve(); // 同じ教材なら何もしない
__savedBookState = {
vocabList: vocabList,
currentTextbook: currentTextbook,
progress: (typeof currentUserVocabProgress !== 'undefined') ? currentUserVocabProgress : {}
};
return fetchBookWords(bookKey).then(function(master){
if (!master || master.length === 0) {
restoreBook();
alert('選択した単語帳には単語が登録されていません。\n元の単語帳でバトルを続行します。');
return;
}
vocabList = window.migrateVocabData(master.map(function(w){ return Object.assign({}, w); }));
currentTextbook = bookKey;
if (typeof window.loadUserVocabProgress === 'function') {
return window.loadUserVocabProgress(bookKey).then(function(){
if (typeof window.applyUserProgressToVocabList === 'function') window.applyUserProgressToVocabList();
if (typeof window.rebuildVocabStemIndex === 'function') window.rebuildVocabStemIndex();
});
}
if (typeof window.rebuildVocabStemIndex === 'function') window.rebuildVocabStemIndex();
}).catch(function(e){
console.error('multi book apply error:', e);
restoreBook();
});
}
function startRestoreWatcher(){
if (__restoreWatcher) return;
if (!__savedBookState) return;
var tries = 0;
__restoreWatcher = setInterval(function(){
tries++;
var play = document.getElementById('multi-battle-play-screen');
var result = document.getElementById('m2Result');
var playHidden = !play || play.style.display === 'none';
var resultHidden = !result || !result.classList.contains('show');
if ((playHidden && resultHidden) || tries > 300) {
clearInterval(__restoreWatcher); __restoreWatcher = null;
restoreBook();
}
}, 1000);
}

/* ---------- 7. バトル開始/終了のラップ（教材差し替え） ---------- */
var __origStartPlay = window.startMultiBattlePlay;
window.startMultiBattlePlay = function(){
var args = arguments, self = this;
applyMultiBook().then(function(){
if (typeof __origStartPlay === 'function') __origStartPlay.apply(self, args);
startRestoreWatcher();
});
};
var __origCancelPlay = window.cancelMultiBattlePlay;
window.cancelMultiBattlePlay = function(){
var r = __origCancelPlay ? __origCancelPlay.apply(this, arguments) : undefined;
startRestoreWatcher();
return r;
};

console.log('🏰 マルチプレイUI刷新パッチ（ダンジョン風モード選択＋単語帳選択）適用完了');
})();
// ==========================================================================
// 🏰 マルチプレイUI刷新パッチ2：縦スクロール限定 ＋ マッチング画面ダンジョン化
//    ＋ 戦闘画面クオリティアップ（ダンジョンの空気重ねがけ・全要素・動きは控えめ）
//    ① 選択画面（結成/設定）の横方向の動きを完全封印＝縦スクロールのみ
//    ② マッチング画面（モード選択〜戦闘の間）をダンジョン風に
//       （回転ルーン陣＋松明ローディング＋火の粉・霧・光だまり）
//    ③ 戦闘画面：既存ネオンの上に「石壁＋松明の暖色」を重ねる
//       背景アンビエント／逃げる・降参ボタン／ボスHP枠／パーティ枠／
//       下パッド／選択肢タイル／TARGET WORD をダンジョン質感に
//       ※画面が動きすぎるのは集中できない＝演出はすべて低速・控えめ
//    ※ app.js / fix.js / style.css / index.html は不変更。multi.js 末尾に追記するだけ
// ==========================================================================
(function applyMultiDungeonUiPatch2() {
"use strict";
if (window.__multiDungeonUi2Applied) return;
window.__multiDungeonUi2Applied = true;

/* ==================================================================
   【1】選択画面：縦スクロールのみに限定（横移動の封印）
   ================================================================== */
(function injectVerticalOnlyCss() {
if (document.getElementById('md2VerticalCss')) return;
var s = document.createElement('style');
s.id = 'md2VerticalCss';
s.textContent = [
/* 画面全体：縦方向のジェスチャーのみ許可・横の行き過ぎ（ラバーバンド）も禁止 */
'#multi-battle-choice-screen,',
'#multi-battle-setup-screen,',
'#multi-battle-matching-screen{',
'  touch-action:pan-y !important;',
'  overscroll-behavior:contain !important;',
'  -webkit-overflow-scrolling:touch;',
'}',
/* 中身のスクロール容器：横は完全カット */
'#multi-battle-choice-screen .mdu-scroll,',
'#multi-battle-setup-screen .mdu-scroll{',
'  overflow-x:hidden !important;',
'  overscroll-behavior-x:none !important;',
'}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();

/* ==================================================================
   【2】共有アンビエント素材（松明の光だまり／霧／火の粉／石壁）
   ================================================================== */
(function injectSharedAmbientCss() {
if (document.getElementById('md2AmbientCss')) return;
var s = document.createElement('style');
s.id = 'md2AmbientCss';
s.textContent = [
/* --- 松明の光だまり（暖色・低速呼吸） --- */
'.md2-lightpool{position:absolute;width:340px;height:340px;border-radius:50%;filter:blur(10px);mix-blend-mode:screen;opacity:.5;pointer-events:none;}',
'.md2-lightpool.tl{top:-90px;left:-70px;background:radial-gradient(circle, rgba(251,146,60,.36), transparent 70%);animation:md2Pool 3.6s ease-in-out infinite alternate;}',
'.md2-lightpool.tr{top:-90px;right:-70px;background:radial-gradient(circle, rgba(251,146,60,.36), transparent 70%);animation:md2Pool 3.6s ease-in-out infinite alternate-reverse;}',
'.md2-lightpool.floor{bottom:-130px;left:50%;transform:translateX(-50%);width:540px;height:300px;background:radial-gradient(ellipse, rgba(91,45,168,.30), transparent 70%);animation:md2Pool 4.8s ease-in-out infinite alternate;}',
'@keyframes md2Pool{from{opacity:.30}to{opacity:.58}}',
/* --- 霧（低速で漂う） --- */
'.md2-fog{position:absolute;inset:-20%;mix-blend-mode:screen;filter:blur(12px);opacity:.4;pointer-events:none;',
'  background:radial-gradient(38% 30% at 24% 30%, rgba(120,90,60,.5), transparent 70%),radial-gradient(34% 26% at 78% 68%, rgba(91,45,168,.35), transparent 72%);',
'  animation:md2Fog 26s ease-in-out infinite alternate;}',
'.md2-fog.two{animation-duration:34s;animation-direction:alternate-reverse;opacity:.26;',
'  background:radial-gradient(42% 30% at 65% 22%, rgba(251,146,60,.22), transparent 70%);}',
'@keyframes md2Fog{0%{transform:translate3d(-4%,-2%,0) scale(1.05)}100%{transform:translate3d(4%,3%,0) scale(1.16)}}',
/* --- 火の粉（ゆっくり上昇） --- */
'.md2-ember{position:absolute;bottom:-10px;border-radius:50%;pointer-events:none;opacity:0;animation:md2Ember linear infinite;}',
'@keyframes md2Ember{0%{transform:translateY(0) translateX(0) scale(.5);opacity:0}15%{opacity:.9}70%{opacity:.5}100%{transform:translateY(-105vh) translateX(var(--mx,18px)) scale(1);opacity:0}}',
/* --- 石壁の質感（共通背景） --- */
'.md2-stonewall-bg{',
'  background:',
'    radial-gradient(140% 120% at 50% 0%, rgba(90,70,50,.30) 0%, transparent 55%),',
'    radial-gradient(120% 100% at 50% 100%, rgba(0,0,0,.68) 0%, transparent 62%),',
'    repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 1px, transparent 1px 44px),',
'    repeating-linear-gradient(90deg, rgba(0,0,0,.16) 0 1px, transparent 1px 72px),',
'    linear-gradient(165deg, #3a2f22 0%, #2a2117 38%, #1e1811 68%, #14100a 100%);',
'}',
/* --- アンビエントをまとめる層 --- */
'.md2-ambient-layer{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();

function md2EmberHtml(n) {
var h = '';
for (var i = 0; i < n; i++) {
var left = Math.round(Math.random() * 100);
var delay = (Math.random() * 8).toFixed(2);
var dur = (7 + Math.random() * 8).toFixed(2);
var size = 2 + Math.round(Math.random() * 3);
var mx = Math.round(Math.random() * 50 - 25);
var c = Math.random() < 0.6 ? 'rgba(251,146,60,.85)' : 'rgba(251,191,36,.8)';
h += '<span class="md2-ember" style="left:' + left + '%;width:' + size + 'px;height:' + size + 'px;background:' + c + ';box-shadow:0 0 6px ' + c + ';animation-delay:' + delay + 's;animation-duration:' + dur + 's;--mx:' + mx + 'px;"></span>';
}
return h;
}

/* ==================================================================
   【3】マッチング画面：ダンジョンの召喚陣で仲間を待つ
   ================================================================== */
(function injectMatchingCss() {
if (document.getElementById('md2MatchingCss')) return;
var s = document.createElement('style');
s.id = 'md2MatchingCss';
s.textContent = [
/* 画面をダンジョンの間に（既存の表示/非表示ロジックはそのまま） */
'#multi-battle-matching-screen{',
'  position:fixed !important;inset:0 !important;z-index:45 !important;',
'  overflow:hidden !important;align-items:center;justify-content:center;',
'}',
/* 中央のステージ */
'.mdm-stage{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:26px;padding:24px;text-align:center;max-width:420px;width:100%;}',
/* 召喚陣（回転するルーンの二重輪） */
'.mdm-gate{position:relative;width:158px;height:158px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
'.mdm-ring{position:absolute;border-radius:50%;}',
'.mdm-ring-outer{inset:0;border:2px dashed rgba(245,196,81,.55);animation:mdmSpin 22s linear infinite;',
'  box-shadow:0 0 26px rgba(245,196,81,.28), inset 0 0 26px rgba(245,196,81,.12);}',
'.mdm-ring-inner{inset:20px;border:2px solid transparent;border-top-color:#34e7e4;border-right-color:rgba(52,231,228,.35);',
'  animation:mdmSpin 7s linear infinite reverse;filter:drop-shadow(0 0 8px rgba(52,231,228,.6));}',
'@keyframes mdmSpin{to{transform:rotate(360deg)}}',
'.mdm-gate-core{font-size:54px;filter:drop-shadow(0 0 20px rgba(245,196,81,.75));animation:mdmCorePulse 2.8s ease-in-out infinite;}',
'@keyframes mdmCorePulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}',
/* タイトル・状態テキスト */
'.mdm-title{font-family:"Noto Serif JP",serif;font-size:22px;font-weight:900;color:#f3e5c0;letter-spacing:.14em;line-height:1.3;',
'  text-shadow:0 0 16px rgba(245,196,81,.4), 0 2px 4px rgba(0,0,0,.9);}',
'.mdm-status{font-family:"Noto Sans JP",sans-serif;font-size:13px;font-weight:700;color:#a9a4d6;letter-spacing:.06em;}',
/* 松明の三連フレーム（ローディングの点滅代わり・低速） */
'.mdm-torches{display:flex;gap:16px;align-items:flex-end;}',
'.mdm-flame{width:14px;height:20px;transform-origin:50% 100%;border-radius:50% 50% 46% 54%/62% 62% 38% 38%;',
'  background:radial-gradient(ellipse at 50% 78%, #fffbe8 0%, #fde68a 30%, #fbbf24 50%, #f97316 70%, rgba(239,68,68,0) 100%);',
'  filter:drop-shadow(0 0 8px rgba(251,146,60,.85));animation:mdmFlamePulse 1.3s ease-in-out infinite;}',
'.mdm-flame:nth-child(2){animation-delay:.22s;}',
'.mdm-flame:nth-child(3){animation-delay:.44s;}',
'@keyframes mdmFlamePulse{0%,100%{transform:scaleY(1);opacity:.65}50%{transform:scaleY(1.28);opacity:1}}',
/* キャンセル＝石版ボタン */
'.mdm-cancel{margin-top:4px;padding:13px 40px;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;',
'  font-family:"Noto Serif JP",serif;font-size:14px;font-weight:900;letter-spacing:.16em;color:#e8d5a3;',
'  border-radius:12px;border:1.5px solid rgba(200,144,42,.5);',
'  background:linear-gradient(180deg, rgba(255,255,255,.06), rgba(0,0,0,.2) 45%),linear-gradient(180deg,#4a3b28,#2e2416 55%,#1f1809);',
'  text-shadow:0 1px 0 rgba(0,0,0,.9), 0 0 10px rgba(245,196,81,.35);',
'  box-shadow:inset 0 1px 0 rgba(255,255,255,.1), inset 0 -5px 10px rgba(0,0,0,.5), 0 6px 16px rgba(0,0,0,.45);',
'  transition:transform .14s ease, box-shadow .2s ease;}',
'.mdm-cancel:active{transform:translateY(2px) scale(.98);box-shadow:inset 0 3px 8px rgba(0,0,0,.6), 0 0 18px rgba(245,196,81,.3);}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();

function matchingHtml() {
return '<div class="md2-ambient-layer">' +
'<div class="md2-lightpool tl"></div>' +
'<div class="md2-lightpool tr"></div>' +
'<div class="md2-lightpool floor"></div>' +
'<div class="md2-fog"></div>' +
'<div class="md2-fog two"></div>' +
md2EmberHtml(14) +
'</div>' +
'<div class="mdm-stage">' +
'<div class="mdm-gate">' +
'<div class="mdm-ring mdm-ring-outer"></div>' +
'<div class="mdm-ring mdm-ring-inner"></div>' +
'<div class="mdm-gate-core">⚔️</div>' +
'</div>' +
'<div class="mdm-title">他のプレイヤーの参加を<br>待っています</div>' +
'<div class="mdm-status" id="waitingRoomText">サーバーとの通信を待機しています</div>' +
'<div class="mdm-torches"><span class="mdm-flame"></span><span class="mdm-flame"></span><span class="mdm-flame"></span></div>' +
'<button type="button" class="mdm-cancel" onclick="window.cancelMultiBattleMatching()">キャンセル</button>' +
'</div>';
}

function rebuildMatchingScreen() {
var screen = document.getElementById('multi-battle-matching-screen');
if (!screen) return;
screen.classList.add('md2-stonewall-bg');
screen.innerHTML = matchingHtml();
}

/* 表示の直前に中身をダンジョン化（waitingRoomText は元関数が上書きするので両立） */
var __origStartMatching = window.startMultiBattleMatching;
if (typeof __origStartMatching === 'function') {
window.startMultiBattleMatching = function() {
rebuildMatchingScreen();
return __origStartMatching.apply(this, arguments);
};
}
var __origJoinTeam = window.joinMultiTeam;
if (typeof __origJoinTeam === 'function') {
window.joinMultiTeam = function() {
rebuildMatchingScreen();
return __origJoinTeam.apply(this, arguments);
};
}

/* ==================================================================
   【4】戦闘画面：既存ネオンの上にダンジョンの空気を重ねる
   ================================================================== */
(function injectBattleCss() {
if (document.getElementById('md2BattleCss')) return;
var s = document.createElement('style');
s.id = 'md2BattleCss';
s.textContent = [
/* --- アンビエント層（アリーナの背後・コンテンツの手前） --- */
'#m2DungeonAmbient{position:absolute !important;inset:0 !important;z-index:1 !important;pointer-events:none !important;overflow:hidden !important;}',
/* 石壁の質感を半透明で重ねる（既存の暗色グラデの上に乗る） */
'#m2DungeonAmbient .md2-stonewall-overlay{position:absolute;inset:0;opacity:.65;',
'  background:',
'    repeating-linear-gradient(0deg, rgba(0,0,0,.18) 0 1px, transparent 1px 44px),',
'    repeating-linear-gradient(90deg, rgba(0,0,0,.12) 0 1px, transparent 1px 72px),',
'    radial-gradient(120% 90% at 50% 0%, rgba(96,64,32,.30) 0%, transparent 55%),',
'    linear-gradient(180deg, rgba(46,34,22,.38) 0%, rgba(22,16,9,.22) 50%, rgba(10,7,4,.5) 100%);}',
/* 上部の松明の光だまり（戦闘画面はやや抑えめ） */
'#m2DungeonAmbient .md2-lightpool{opacity:.42;}',
/* ビネット（四隅を締めて没入感） */
'#m2DungeonAmbient .md2-vignette{position:absolute;inset:0;',
'  background:radial-gradient(140% 120% at 50% 30%, transparent 42%, rgba(8,5,2,.48) 82%, rgba(5,3,1,.72) 100%);}',
'',
/* --- 逃げる／降参ボタン → 石版 --- */
'body.in-game-active #multiEscapeOrSurrenderBtn{',
'  font-family:"Noto Serif JP",serif !important;font-weight:900 !important;letter-spacing:.12em !important;',
'  background:linear-gradient(180deg, rgba(255,255,255,.06), rgba(0,0,0,.2) 45%),linear-gradient(180deg,#4a3b28,#2e2416 55%,#1f1809) !important;',
'  border:1.5px solid rgba(200,144,42,.55) !important;color:#fde68a !important;border-radius:10px !important;',
'  text-shadow:0 1px 0 rgba(0,0,0,.9), 0 0 10px rgba(245,196,81,.4) !important;',
'  box-shadow:inset 0 1px 0 rgba(255,255,255,.1), inset 0 -4px 8px rgba(0,0,0,.5), 0 4px 12px rgba(0,0,0,.4) !important;',
'}',
'body.in-game-active #multiEscapeOrSurrenderBtn:active{transform:scale(.95);box-shadow:inset 0 3px 8px rgba(0,0,0,.6), 0 0 16px rgba(245,196,81,.35) !important;}',
'',
/* --- ボスHPバーの枠 → 暖色の石枠（中身の赤い蠢きはそのまま） --- */
'body.in-game-active .multi-boss-full-bar{',
'  box-shadow:0 0 0 1.5px rgba(200,144,42,.5), 0 0 20px rgba(255,84,104,.3), inset 0 2px 6px rgba(0,0,0,.85) !important;',
'  border-radius:8px !important;',
'}',
'',
/* --- パーティ（味方）エリア → 石のパネル --- */
'body.in-game-active .multi-party-status-area{',
'  background:linear-gradient(180deg, rgba(58,47,34,.55), rgba(30,24,16,.5)) !important;',
'  border:1px solid rgba(200,144,42,.35) !important;',
'  box-shadow:0 8px 24px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.07) !important;',
'}',
'',
/* --- 下パッド（問題エリア）→ 石のパネル --- */
'body.in-game-active #m2ArenaBottom .multi-flick-area{',
'  background:linear-gradient(180deg, rgba(48,38,26,.62), rgba(24,18,11,.7)) !important;',
'  border:1px solid rgba(200,144,42,.4) !important;',
'  box-shadow:0 10px 30px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.06), inset 0 0 30px rgba(200,144,42,.08) !important;',
'}',
'',
/* --- 選択肢タイル → 石板（ハイライト/正誤の色は上書きしない） --- */
'body.in-game-active .multi-grid-3x3 .flick-choice:not(.highlight):not(.aaa-correct):not(.aaa-wrong){',
'  background:linear-gradient(180deg, rgba(64,50,34,.72), rgba(34,26,16,.82)) !important;',
'  border:1px solid rgba(200,144,42,.3) !important;color:#f3e5c0 !important;',
'  box-shadow:0 4px 12px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.08) !important;',
'  text-shadow:0 1px 3px rgba(0,0,0,.8) !important;',
'}',
'',
/* --- TARGET WORD → 暖色の縁取りと glow --- */
'body.in-game-active #flickTargetWord{',
'  border-color:rgba(200,144,42,.5) !important;',
'  text-shadow:0 0 20px rgba(245,196,81,.5), 0 2px 4px rgba(0,0,0,.85) !important;',
'}',
'',
/* --- 味方アイコンの枠に暖色をひとさじ --- */
'body.in-game-active .multi-party-icon{',
'  box-shadow:0 0 0 2px rgba(8,5,18,.9), 0 0 14px rgba(200,144,42,.35), inset 0 2px 6px rgba(0,0,0,.7) !important;',
'}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();

function battleAmbientHtml() {
return '<div class="md2-stonewall-overlay"></div>' +
'<div class="md2-lightpool tl"></div>' +
'<div class="md2-lightpool tr"></div>' +
'<div class="md2-fog"></div>' +
'<div class="md2-fog two"></div>' +
md2EmberHtml(12) +
'<div class="md2-vignette"></div>';
}

/* アリーナが構築された“後”にアンビエントを差し込む
   （前パッチの単語帳差し替えが非同期でも確実にアリーナ完成を待つ） */
function ensureBattleAmbientWhenReady() {
var tries = 0;
var iv = setInterval(function() {
tries++;
var screen = document.getElementById('multi-battle-play-screen');
var arena = document.getElementById('m2Arena');
if (screen && arena) {
clearInterval(iv);
if (!document.getElementById('m2DungeonAmbient')) {
var amb = document.createElement('div');
amb.id = 'm2DungeonAmbient';
amb.innerHTML = battleAmbientHtml();
screen.insertBefore(amb, arena);
}
} else if (tries > 40) {
clearInterval(iv);
}
}, 50);
}

var __origStartBattle = window.startMultiBattlePlay;
if (typeof __origStartBattle === 'function') {
window.startMultiBattlePlay = function() {
var r = __origStartBattle.apply(this, arguments);
ensureBattleAmbientWhenReady();
return r;
};
}

console.log('🏰 マルチプレイUI刷新パッチ2（縦スクロール限定＋マッチングダンジョン化＋戦闘画面クオリティアップ）適用完了');
})();
// ==========================================================================
// 🍺 マルチプレイUI刷新パッチ3：チーム参加画面（募集中パーティー一覧）ダンジョン化
//    「チームに参加する」→ 募集中チーム一覧 を、酒場のパーティー募集掲示板風に
//    ・石壁＋松明＋火の粉＋霧のアンビエント（選択/設定/マッチング画面と統一）
//    ・チーム行を「募集の石板」としてデザイン（金ノッチ＋紋章＋人数バー）
//    ・参加ボタンは石版風、満員時は自動で無効化
//    ・部屋情報更新ボタン（回転アイコン付き）／縦スクロールのみ
//    ※ app.js / fix.js / style.css / index.html は不変更。multi.js 末尾に追記するだけ
//    ※パッチ1(mdu-*)・パッチ2(md2-*)の装飾クラスを再利用
// ==========================================================================
(function applyMultiDungeonTeamListPatch() {
"use strict";
if (window.__multiDungeonTeamListApplied) return;
window.__multiDungeonTeamListApplied = true;

/* ---------- チームデータ（既存のモックと同一） ---------- */
var MDT_TEAMS = [
{ name: 'チーム・タンゴン', icon: '🐧', members: 2, max: 4 },
{ name: 'コズミック部屋',   icon: '🌌', members: 1, max: 2 }
];

/* ---------- スタイル注入 ---------- */
(function injectMdtCss() {
if (document.getElementById('mdtTeamListCss')) return;
var s = document.createElement('style');
s.id = 'mdtTeamListCss';
s.textContent = [
/* ===== 画面ベース：石壁の洞窟 ===== */
'#multi-battle-team-list-screen{',
'  position:fixed !important;inset:0 !important;z-index:45 !important;',
'  overflow:hidden !important;touch-action:pan-y;overscroll-behavior:contain;',
'  background:',
'    radial-gradient(140% 120% at 50% 0%, rgba(90,70,50,.30) 0%, transparent 55%),',
'    radial-gradient(120% 100% at 50% 100%, rgba(0,0,0,.68) 0%, transparent 62%),',
'    repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 1px, transparent 1px 44px),',
'    repeating-linear-gradient(90deg, rgba(0,0,0,.16) 0 1px, transparent 1px 72px),',
'    linear-gradient(165deg, #3a2f22 0%, #2a2117 38%, #1e1811 68%, #14100a 100%);',
'}',
/* ===== スクロール本文 ===== */
'.mdt-scroll{',
'  position:relative;z-index:2;height:100%;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;',
'  box-sizing:border-box;display:flex;flex-direction:column;',
'  padding:calc(70px + env(safe-area-inset-top)) 18px calc(90px + env(safe-area-inset-bottom));',
'}',
/* ===== ヘッダー ===== */
'.mdt-header{display:flex;align-items:flex-end;justify-content:center;gap:16px;margin:4px 0 20px;}',
'.mdt-title-block{text-align:center;flex:1;min-width:0;}',
'.mdt-kicker{font-family:"Cinzel",serif;font-size:10px;font-weight:700;letter-spacing:.42em;color:#c8902a;text-transform:uppercase;text-shadow:0 0 10px rgba(200,144,42,.5);margin-bottom:7px;}',
'.mdt-title{font-family:"Noto Serif JP",serif;font-size:26px;font-weight:900;letter-spacing:.12em;line-height:1.1;margin:0;color:#f3e5c0;text-shadow:0 0 18px rgba(245,196,81,.35),0 2px 4px rgba(0,0,0,.9);}',
'.mdt-sub{font-family:"Noto Sans JP",sans-serif;font-size:11px;font-weight:600;color:#a89880;letter-spacing:.12em;margin-top:8px;}',
/* ===== 部屋情報更新ボタン ===== */
'.mdt-refresh{',
'  display:flex;align-items:center;justify-content:center;gap:8px;',
'  width:100%;max-width:380px;margin:0 auto 16px;padding:12px;cursor:pointer;',
'  font-family:"Noto Sans JP",sans-serif;font-size:12.5px;font-weight:800;letter-spacing:.1em;',
'  color:#9af6f1;background:rgba(52,231,228,.08);',
'  border:1px solid rgba(52,231,228,.35);border-radius:10px;',
'  transition:all .2s ease;-webkit-tap-highlight-color:transparent;',
'}',
'.mdt-refresh:active{transform:scale(.97);background:rgba(52,231,228,.16);}',
'.mdt-refresh-ico{display:inline-block;font-size:15px;transition:transform .5s cubic-bezier(.2,.9,.3,1);}',
'.mdt-refresh.spinning .mdt-refresh-ico{transform:rotate(360deg);}',
/* ===== チーム一覧 ===== */
'.mdt-teams{display:flex;flex-direction:column;gap:12px;max-width:380px;width:100%;margin:0 auto;}',
/* チーム行＝募集の石板 */
'.mdt-team{',
'  position:relative;display:flex;align-items:center;gap:14px;',
'  padding:16px 14px 16px 18px;border-radius:14px;',
'  border:1.5px solid rgba(200,144,42,.3);',
'  background:',
'    linear-gradient(165deg, rgba(255,255,255,.05), rgba(0,0,0,.2) 40%),',
'    repeating-linear-gradient(0deg, rgba(255,255,255,.02) 0 2px, transparent 2px 7px),',
'    linear-gradient(180deg,#3b3126,#262019 55%,#1b1510);',
'  box-shadow:inset 0 1px 0 rgba(255,255,255,.09),inset 0 -8px 16px rgba(0,0,0,.45),0 8px 20px rgba(0,0,0,.5);',
'  transition:transform .16s cubic-bezier(.2,.9,.3,1.3),box-shadow .2s ease,border-color .2s ease;',
'  animation:mdtRowIn .45s cubic-bezier(.2,.9,.3,1) backwards;',
'}',
'@keyframes mdtRowIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}',
'.mdt-team:active{transform:translateY(2px) scale(.99);}',
/* 左端の金ノッチ（掲示板に留められた募集札） */
'.mdt-team::before{',
'  content:"";position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:0 3px 3px 0;',
'  background:linear-gradient(180deg,#f5c451,#c8902a);',
'  box-shadow:0 0 8px rgba(245,196,81,.5);',
'}',
/* 紋章 */
'.mdt-team-emblem{',
'  flex:0 0 auto;width:52px;height:52px;display:flex;align-items:center;justify-content:center;',
'  font-size:26px;border-radius:50%;',
'  background:radial-gradient(circle at 35% 30%, rgba(255,255,255,.12), rgba(0,0,0,.5));',
'  border:1.5px solid rgba(155,107,255,.45);',
'  box-shadow:0 0 0 2px rgba(8,5,18,.9),0 0 14px rgba(155,107,255,.35),inset 0 2px 6px rgba(0,0,0,.7);',
'}',
'.mdt-team-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:7px;}',
'.mdt-team-name{',
'  font-family:"Noto Serif JP",serif;font-size:16px;font-weight:900;letter-spacing:.05em;',
'  color:#f3e5c0;text-shadow:0 1px 3px rgba(0,0,0,.9);',
'  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
'}',
/* 人数バー */
'.mdt-team-count{display:flex;align-items:center;gap:8px;}',
'.mdt-count-bar{',
'  flex:1;height:6px;border-radius:3px;background:rgba(0,0,0,.6);',
'  border:1px solid rgba(255,255,255,.12);overflow:hidden;',
'  box-shadow:inset 0 1px 3px rgba(0,0,0,.8);',
'}',
'.mdt-count-fill{',
'  height:100%;border-radius:3px;',
'  background:linear-gradient(90deg,#0e8f8c,#34e7e4);',
'  box-shadow:0 0 8px rgba(52,231,228,.6);',
'  transition:width .4s cubic-bezier(.22,1,.36,1);',
'}',
'.mdt-team.mdt-full .mdt-count-fill{background:linear-gradient(90deg,#b8480f,#ff8a3d);box-shadow:0 0 8px rgba(255,138,61,.6);}',
'.mdt-count-text{',
'  font-family:ui-monospace,"SF Mono",monospace;font-size:11px;font-weight:700;color:#a9a4d6;',
'  white-space:nowrap;letter-spacing:.03em;',
'}',
/* 参加ボタン（石版） */
'.mdt-join{',
'  flex:0 0 auto;padding:11px 20px;cursor:pointer;',
'  font-family:"Noto Serif JP",serif;font-size:14px;font-weight:900;letter-spacing:.15em;',
'  color:#fde68a;border-radius:10px;',
'  border:1.5px solid rgba(245,196,81,.55);',
'  background:',
'    linear-gradient(180deg, rgba(255,255,255,.07), rgba(0,0,0,.15) 45%),',
'    linear-gradient(180deg,#4a3b24,#2e2415 55%,#1f1809);',
'  text-shadow:0 1px 0 rgba(0,0,0,.9),0 0 10px rgba(245,196,81,.4);',
'  box-shadow:inset 0 1px 0 rgba(255,255,255,.12),inset 0 -5px 10px rgba(0,0,0,.5),0 0 14px rgba(245,196,81,.25),0 6px 14px rgba(0,0,0,.4);',
'  transition:transform .14s ease,box-shadow .2s ease;-webkit-tap-highlight-color:transparent;',
'}',
'.mdt-join:active{transform:translateY(2px) scale(.96);box-shadow:inset 0 3px 8px rgba(0,0,0,.6),0 0 20px rgba(245,196,81,.4);}',
'.mdt-join-full{',
'  color:#8a7a5f;border-color:rgba(255,255,255,.15);',
'  background:linear-gradient(180deg,#2a241c,#1a1610);',
'  text-shadow:none;box-shadow:inset 0 2px 6px rgba(0,0,0,.6);',
'  cursor:not-allowed;',
'}',
/* 空状態 */
'.mdt-empty{',
'  max-width:380px;width:100%;margin:24px auto;text-align:center;',
'  font-family:"Noto Sans JP",sans-serif;font-size:13px;font-weight:600;color:#8a7a5f;',
'  padding:28px 16px;border:1px dashed rgba(200,144,42,.3);border-radius:12px;',
'  background:rgba(0,0,0,.25);',
'}',
/* 戻るボタン */
'.mdt-back{',
'  display:block;width:100%;max-width:380px;margin:18px auto 0;padding:13px;cursor:pointer;',
'  font-family:"Noto Sans JP",sans-serif;font-size:12.5px;font-weight:700;letter-spacing:.14em;color:#a89880;',
'  border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.28);',
'  transition:all .18s ease;-webkit-tap-highlight-color:transparent;',
'}',
'.mdt-back:active{transform:scale(.98);color:#f3e5c0;border-color:rgba(200,144,42,.5);}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();

/* ---------- HTML ビルダー ---------- */
function mdtEmberHtml(n) {
var h = '';
for (var i = 0; i < n; i++) {
var left = Math.round(Math.random() * 100);
var delay = (Math.random() * 8).toFixed(2);
var dur = (7 + Math.random() * 8).toFixed(2);
var size = 2 + Math.round(Math.random() * 3);
var mx = Math.round(Math.random() * 50 - 25);
var c = Math.random() < 0.6 ? 'rgba(251,146,60,.85)' : 'rgba(251,191,36,.8)';
h += '<span class="md2-ember" style="left:' + left + '%;width:' + size + 'px;height:' + size + 'px;background:' + c + ';box-shadow:0 0 6px ' + c + ';animation-delay:' + delay + 's;animation-duration:' + dur + 's;--mx:' + mx + 'px;"></span>';
}
return h;
}
function mdtTorchHtml() {
return '<div class="mdu-torch"><div class="mdu-torch-glow"></div><div class="mdu-flame"></div><div class="mdu-torch-stick"></div></div>';
}
function mdtTeamRowHtml(t, i) {
var pct = Math.min(100, Math.round((t.members / t.max) * 100));
var full = t.members >= t.max;
var escName = t.name.replace(/'/g, "\\'");
return '<div class="mdt-team' + (full ? ' mdt-full' : '') + '" style="animation-delay:' + (i * 0.07) + 's">' +
'<div class="mdt-team-emblem">' + t.icon + '</div>' +
'<div class="mdt-team-info">' +
'<div class="mdt-team-name">' + t.name + '</div>' +
'<div class="mdt-team-count">' +
'<div class="mdt-count-bar"><div class="mdt-count-fill" style="width:' + pct + '%"></div></div>' +
'<span class="mdt-count-text">' + t.members + ' / ' + t.max + '人</span>' +
'</div>' +
'</div>' +
(full
? '<button type="button" class="mdt-join mdt-join-full" disabled>満員</button>'
: '<button type="button" class="mdt-join" onclick="window.joinMultiTeam(\'' + escName + '\')">参加</button>') +
'</div>';
}
function mdtScreenHtml() {
var rows = MDT_TEAMS.map(function(t, i) { return mdtTeamRowHtml(t, i); }).join('');
return '<div class="md2-ambient-layer">' +
'<div class="md2-lightpool tl"></div>' +
'<div class="md2-lightpool tr"></div>' +
'<div class="md2-lightpool floor"></div>' +
'<div class="md2-fog"></div>' +
'<div class="md2-fog two"></div>' +
mdtEmberHtml(14) +
'</div>' +
'<div class="mdt-scroll">' +
'<div class="mdt-header">' +
mdtTorchHtml() +
'<div class="mdt-title-block">' +
'<div class="mdt-kicker">PARTY RECRUITMENT BOARD</div>' +
'<h2 class="mdt-title">募集中のパーティー</h2>' +
'<div class="mdt-sub">仲間を求めて掲げられた参加募集の石板</div>' +
'</div>' +
mdtTorchHtml() +
'</div>' +
'<button type="button" class="mdt-refresh" onclick="window.__mdtRefreshTeams()">' +
'<span class="mdt-refresh-ico">⟳</span>部屋情報を更新する' +
'</button>' +
'<div class="mdt-teams" id="mdtTeamRows">' +
(rows || '<div class="mdt-empty">現在、募集中のパーティーはありません。<br>しばらくしてから再度ご確認ください。</div>') +
'</div>' +
'<button type="button" class="mdt-back" onclick="window.backToMultiChoiceFromList()">← 前のフロアへ戻る</button>' +
'</div>';
}

/* ---------- 部屋情報更新（モック：再描画＋回転演出） ---------- */
window.__mdtRefreshTeams = function() {
var btn = document.querySelector('.mdt-refresh');
if (btn) {
btn.classList.add('spinning');
setTimeout(function() { btn.classList.remove('spinning'); }, 550);
}
var rows = document.getElementById('mdtTeamRows');
if (rows) {
rows.innerHTML = MDT_TEAMS.map(function(t, i) { return mdtTeamRowHtml(t, i); }).join('') ||
'<div class="mdt-empty">現在、募集中のパーティーはありません。</div>';
}
};

/* ---------- showMultiTeamList 上書き（ダンジョン化） ---------- */
window.showMultiTeamList = function() {
document.getElementById('multi-battle-choice-screen').style.display = 'none';
var list = document.getElementById('multi-battle-team-list-screen');
list.style.display = 'block';
list.innerHTML = mdtScreenHtml();
};

console.log('🍺 マルチプレイUI刷新パッチ3（チーム参加画面ダンジョン化）適用完了');
})();
// ==========================================================================
// ⚔️ multi.js 第8パッチ（末尾追記・本体＆既存末尾パッチ 不変更）
//    「敵の攻撃エフェクトは出るのに HP ゲージが減らない」を根治
//    ─ 内部的には m.hp は減っている（＝ダメージ自体は入っている）。
//      しかしゲージの幅を更新する処理が、以下の理由で“見た目に反映されない”
//      ケースがあった：
//        ① 第7パッチの restoreAllyRowsIfMissing が partyMemberHpFill-{id} を
//           追加生成し得る → ID重複で getElementById が“先頭の1個”しか
//           捕まえず、それが隠れ/別ノードだと幅が更新されない
//        ② 描画(renderMultiParty)がゲージを再生成するタイミングと、
//           幅更新のタイミングが競合して古い値で上書きされ得る
//        ③ CSS の width:100% 指定に対して、更新側の優先度が足りない可能性
//    ─ 対策：multiPartyMembers の“今の値”で全ゲージを強制同期する関数を
//      新設し、ダメージが発生しうる全経路の直後に呼び出す。
//        ・[id="..."] 属性セレクタ → ID重複でも全ノードを捕捉
//        ・setProperty(...,'important') → CSS/インラインの上から確実に反映
//    ─ 既存関数はすべて「ラップして元を必ず呼ぶ」方式＝挙動を壊さない
//    ※ app.js / fix.js / style.css / index.html は不変更
// ==========================================================================
(function applyM2HpGaugeFix() {
"use strict";
if (window.__m2HpGaugeFixApplied) return;
window.__m2HpGaugeFixApplied = true;
// ------------------------------------------------------------------
// 全パーティメンバーの HP バーを「今の multiPartyMembers の値」で強制同期
// ------------------------------------------------------------------
function syncPartyHpBars() {
try {
if (typeof multiPartyMembers === 'undefined' || !multiPartyMembers || !multiPartyMembers.length) return;
for (var i = 0; i < multiPartyMembers.length; i++) {
var m = multiPartyMembers[i];
if (!m || !m.maxHp) continue;
var pct = Math.max(0, Math.min(100, (m.hp / m.maxHp) * 100));
// ID重複でも全ノードを捕捉（getElementById は先頭1個しか返さないため）
var fills = document.querySelectorAll('[id="partyMemberHpFill-' + m.id + '"]');
for (var j = 0; j < fills.length; j++) {
fills[j].style.setProperty('width', pct + '%', 'important');
}
}
// 自分専用バー（旧来レイアウトへの保険）
var me = null;
for (var k = 0; k < multiPartyMembers.length; k++) {
if (multiPartyMembers[k] && multiPartyMembers[k].isMe) { me = multiPartyMembers[k]; break; }
}
if (me && me.maxHp) {
var pct2 = Math.max(0, Math.min(100, (me.hp / me.maxHp) * 100));
var own = document.getElementById('multiPlayerOwnHpFill');
if (own) own.style.setProperty('width', pct2 + '%', 'important');
var ownTxt = document.getElementById('multiPlayerOwnHpText');
if (ownTxt) ownTxt.innerText = Math.max(0, Math.floor(me.hp)) + ' / ' + me.maxHp;
}
} catch (e) {}
}
// ------------------------------------------------------------------
// ① バトルタイマー（敵の攻撃処理）の直後に強制同期
//    triggerEnemyAoE / 直接ダメージの両経路をこれでカバー
// ------------------------------------------------------------------
var __prevTimerForHpFix = window.handleMultiBattleTimer;
window.handleMultiBattleTimer = function () {
var r = __prevTimerForHpFix ? __prevTimerForHpFix.apply(this, arguments) : undefined;
syncPartyHpBars();
return r;
};
// ------------------------------------------------------------------
// ② updateMultiHpBars の直後にも強制同期（二重保険）
// ------------------------------------------------------------------
var __prevUpdForHpFix = window.updateMultiHpBars;
window.updateMultiHpBars = function () {
var r = __prevUpdForHpFix ? __prevUpdForHpFix.apply(this, arguments) : undefined;
syncPartyHpBars();
return r;
};
// ------------------------------------------------------------------
// ③ ダメージポップアップ表示の直後にも強制同期
//    （m.hp は showCharacterPopup 呼び出し前に減算済みなので即反映できる）
// ------------------------------------------------------------------
var __prevPopForHpFix = window.showCharacterPopup;
window.showCharacterPopup = function (memberId, amount, type) {
var r = __prevPopForHpFix ? __prevPopForHpFix.apply(this, arguments) : undefined;
if (type === 'damage') {
syncPartyHpBars();
if (typeof requestAnimationFrame === 'function') requestAnimationFrame(syncPartyHpBars);
}
return r;
};
// ------------------------------------------------------------------
// ④ パーティ再描画の直後にも強制同期
//    （描画がゲージを再生成した際、古い幅で残るのを防ぐ）
// ------------------------------------------------------------------
var __prevRenderForHpFix = window.renderMultiParty;
window.renderMultiParty = function () {
var r = __prevRenderForHpFix ? __prevRenderForHpFix.apply(this, arguments) : undefined;
syncPartyHpBars();
return r;
};
console.log('⚔️ multi.js 第8パッチ（HPゲージ減少の根治：全経路で強制同期）適用完了');
})();
// ==========================================================================
// ⚔️ multi.js 第8パッチ（末尾追記・本体＆既存末尾パッチ 不変更）
//    ① 操作エリア（下パッド）の枠を“画面幅いっぱい＆下まで”に固定
//       ─ 発光枠が中身依存で左に寄り・下が黒余白になっていたのを根治。
//         下パッド段が残りの縦を全部吸収＝黒余白が消え、枠が固定サイズに。
//         3×3は上から整列（76px均等は既存維持）＝はみ出し・重なりを発生させない。
//    ② 味方エリアの“人数変動縮み”を解消
//       ─ 味方が減ると左カラムが上に詰まり敵との対峙が崩れていた。
//         4人パーティ時を下限高さとして固定＝足りない分だけ下に空間ができ、
//         人数が変わっても敵円盤とのバランスが保たれる（理解度には無影響）。
//    ※ app.js / fix.js / style.css / index.html は不変更
// ==========================================================================
(function applyM2FinalPatch8() {
"use strict";
if (window.__m2FinalPatch8Applied) return;
window.__m2FinalPatch8Applied = true;
(function injectM2FinalCss8() {
if (document.getElementById('m2FinalPatchCss8')) return;
var s = document.createElement('style');
s.id = 'm2FinalPatchCss8';
s.textContent = [
/* ===== ① 下パッド段：残りの縦を全部吸収（黒余白を消す） ===== */
'body.in-game-active #m2ArenaBottom{flex:1 1 auto !important;width:100% !important;min-height:0 !important;display:flex !important;flex-direction:column !important;}',
/* ===== ① 発光枠：画面幅いっぱい＆縦いっぱいに固定（左ずれ・圧縮を根治） ===== */
'body.in-game-active #m2ArenaBottom .multi-flick-area{flex:1 1 auto !important;width:100% !important;box-sizing:border-box !important;display:flex !important;flex-direction:column !important;align-items:center !important;justify-content:flex-start !important;overflow:visible !important;position:relative !important;}',
/* 固定された枠の“床”に松明の暖色をひとさじ（下の空間を意図した余白へ） */
'body.in-game-active #m2ArenaBottom .multi-flick-area::after{content:"";position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:82%;height:42%;background:radial-gradient(ellipse at 50% 100%, rgba(200,144,42,.14), rgba(120,60,20,.06) 45%, transparent 72%);pointer-events:none;z-index:0;border-radius:inherit;}',
/* 発光枠の内側発光を暖色で強化（既存石壁に重ねる） */
'body.in-game-active #m2ArenaBottom .multi-flick-area{box-shadow:0 10px 30px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.06),inset 0 0 40px rgba(200,144,42,.10),inset 0 0 90px rgba(120,60,20,.08) !important;}',
/* 3×3・見出し・TARGET WORD を枠内で中央揃え（76px均等は既存維持） */
'body.in-game-active .multi-grid-3x3{margin-left:auto !important;margin-right:auto !important;width:100% !important;max-width:360px !important;}',
'body.in-game-active .multi-question-header-panel{width:100% !important;display:flex !important;flex-direction:column !important;align-items:center !important;}',
'body.in-game-active #flickTargetWord{margin-left:auto !important;margin-right:auto !important;}',
/* ===== ② 味方エリア：人数が減っても縮まない下限高さ ===== */
'body.in-game-active #multiPartyContainer{min-height:235px !important;}',
'body.in-game-active .multi-party-member.m2-ally{min-height:44px !important;}',
'body.in-game-active .multi-party-member.m2-me{min-height:88px !important;}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();
console.log('⚔️ multi.js 第8パッチ（操作エリア枠固定均一＋味方エリア人数変動スペース）適用完了');
})();
// ==========================================================================
// ⚔️ multi.js 第9パッチ（末尾追記・本体＆既存末尾パッチ 不変更）
//    味方（＋自分）のHPゲージに「現在 / 最大」の数字 ＋ 味方COMBOの“器”を実装
//    ① 味方HP数字：各HPバーの“右端”に極小テキスト（例 2800 / 3500）
//       ─ バー自体の高さ・色・幅の割合は一切触らない（右に数字ぶんだけ
//         自然に譲るだけ）。自分(m2-me)の全幅バーにも同様に数字を付与。
//    ② 味方COMBO：【器だけ先に作る】方式（＝リアルタイム通信の土台は“次タスク”）
//       ─ 表示UI（名前の右の極小バッジ 🔥N）＋ 更新フック window.__setAllyCombo(id,n)
//         を今回実装。値は“今は”0＝バッジ非表示。将来 Firestore 同期が
//         __setAllyCombo を呼ぶだけで、そのまま動き出す（ロジック差し替え不要）。
//       ─ 自分のCOMBOは既存のコンボゲージが担うため、ここでは出さない。
//    ※ 行の高さ・アイコンサイズは増やさない＝UI崩れ防止
//    ※ app.js / fix.js / style.css / index.html は不変更
// ==========================================================================
(function applyM2AllyHpComboPatch() {
"use strict";
if (window.__m2AllyHpComboApplied) return;
window.__m2AllyHpComboApplied = true;

// 味方COMBOの現在値を保持する“器”（通信がここへ書き込む）
window.__m2AllyCombo = window.__m2AllyCombo || {};

// ------------------------------------------------------------------
// 【1】スタイル注入（末尾＝後勝ち。詳細度を body.in-game-active で底上げ）
//     バーの width:100% !important を“同じバーを包む行内だけ”で上書き
// ------------------------------------------------------------------
(function injectM2AllyHpComboCss() {
if (document.getElementById('m2AllyHpComboCss')) return;
var s = document.createElement('style');
s.id = 'm2AllyHpComboCss';
s.textContent = [
/* ===== 味方行：名前行（名前＋COMBOバッジを横並び） ===== */
'body.in-game-active .m2-ally-namerow{display:flex !important;align-items:center !important;gap:5px !important;width:100% !important;min-width:0 !important;}',
'body.in-game-active .m2-ally-namerow .m2-ally-name{flex:1 1 auto !important;min-width:0 !important;}',
/* COMBOバッジ：2以上でだけ点灯（器＝初期は非表示） */
'.m2-ally-combo{flex:0 0 auto;font-size:9px;font-weight:900;color:#fbbf24;letter-spacing:.02em;white-space:nowrap;text-shadow:0 0 6px rgba(245,158,11,.75),0 1px 2px #000;display:none;}',
'.m2-ally-combo.m2-combo-on{display:inline-block;animation:m2ComboPop .3s cubic-bezier(.2,1.4,.4,1);}',
'@keyframes m2ComboPop{0%{transform:scale(.6)}60%{transform:scale(1.18)}100%{transform:scale(1)}}',
/* ===== 味方行：バー行（バー＋HP数字を横並び） ===== */
'body.in-game-active .m2-ally-barrow{display:flex !important;align-items:center !important;gap:5px !important;width:100% !important;}',
/* バーの width:100%!important をこの行内だけ auto＋flex:1 に上書き（詳細度で勝利） */
'body.in-game-active .m2-ally-barrow .multi-party-hp-bar{width:auto !important;flex:1 1 auto !important;min-width:0 !important;}',
'.m2-ally-hpnum{flex:0 0 auto;font-family:ui-monospace,"SF Mono",monospace;font-size:8px;font-weight:800;color:rgba(226,232,240,.88);white-space:nowrap;letter-spacing:.02em;text-shadow:0 1px 2px #000;line-height:1;}',
/* ===== 自分行：全幅バーの右端にHP数字 ===== */
'body.in-game-active .m2-me-barrow{display:flex !important;align-items:center !important;gap:6px !important;width:100% !important;}',
'body.in-game-active .m2-me-barrow .m2-me-hpbar-full{width:auto !important;flex:1 1 auto !important;min-width:0 !important;}',
'.m2-me-hpnum{flex:0 0 auto;font-family:ui-monospace,"SF Mono",monospace;font-size:9px;font-weight:800;color:rgba(226,232,240,.92);white-space:nowrap;letter-spacing:.02em;text-shadow:0 1px 2px #000;line-height:1;}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();

// ------------------------------------------------------------------
// 【2】DOMヘルパー：要素をラッパーで包む（親の中での位置は維持）
// ------------------------------------------------------------------
function wrapWith(child, wrapper) {
var p = child.parentNode;
if (!p) return;
p.insertBefore(wrapper, child);
wrapper.appendChild(child);
}
function memberById(id) {
if (typeof multiPartyMembers === 'undefined' || !multiPartyMembers) return null;
for (var i = 0; i < multiPartyMembers.length; i++) {
if (String(multiPartyMembers[i].id) === String(id)) return multiPartyMembers[i];
}
return null;
}
function hpText(m) {
if (!m || !m.maxHp) return '';
return Math.max(0, Math.floor(m.hp)) + ' / ' + m.maxHp;
}

// ------------------------------------------------------------------
// 【3】描画後に“数字テキスト”と“COMBOバッジの器”を注入
//     renderMultiParty は innerHTML 全構築なので毎回新しく注入し直す
// ------------------------------------------------------------------
function injectAllyExtras() {
try {
// ---- 味方行（!isMe） ----
var container = document.getElementById('multiPartyContainer');
if (container) {
var allies = container.querySelectorAll('.m2-ally');
for (var a = 0; a < allies.length; a++) {
var row = allies[a];
var id = (row.id || '').replace('partyMember-', '');
// 名前行：名前＋COMBOバッジ
var nameEl = row.querySelector('.m2-ally-name');
if (nameEl && nameEl.parentNode && !nameEl.parentNode.classList.contains('m2-ally-namerow')) {
var nr = document.createElement('div');
nr.className = 'm2-ally-namerow';
wrapWith(nameEl, nr);
var cb = document.createElement('span');
cb.className = 'm2-ally-combo';
cb.id = 'm2AllyCombo-' + id;
nr.appendChild(cb);
}
// バー行：バー＋HP数字
var barEl = row.querySelector('.multi-party-hp-bar');
if (barEl && barEl.parentNode && !barEl.parentNode.classList.contains('m2-ally-barrow')) {
var br = document.createElement('div');
br.className = 'm2-ally-barrow';
wrapWith(barEl, br);
var hn = document.createElement('span');
hn.className = 'm2-ally-hpnum';
hn.id = 'm2AllyHpNum-' + id;
br.appendChild(hn);
}
// COMBOバッジに“器”の値を反映（今は0＝非表示）
var cbEl = document.getElementById('m2AllyCombo-' + id);
if (cbEl) {
var cv = window.__m2AllyCombo[id];
if (typeof cv === 'number' && isFinite(cv) && cv >= 2) {
cbEl.textContent = '🔥' + cv;
cbEl.classList.add('m2-combo-on');
} else {
cbEl.classList.remove('m2-combo-on');
}
}
// HP数字の初期テキスト
var hnEl = document.getElementById('m2AllyHpNum-' + id);
if (hnEl) hnEl.textContent = hpText(memberById(id));
}
}
// ---- 自分行（全幅バーの右端に数字） ----
var meGauge = document.getElementById('m2ArenaMeGauge');
if (meGauge) {
var meBar = meGauge.querySelector('.m2-me-hpbar-full');
if (meBar && meBar.parentNode && !meBar.parentNode.classList.contains('m2-me-barrow')) {
var mbr = document.createElement('div');
mbr.className = 'm2-me-barrow';
wrapWith(meBar, mbr);
var mhn = document.createElement('span');
mhn.className = 'm2-me-hpnum';
mhn.id = 'm2MeHpNum';
mbr.appendChild(mhn);
}
var me = null;
if (typeof multiPartyMembers !== 'undefined' && multiPartyMembers) {
for (var k = 0; k < multiPartyMembers.length; k++) {
if (multiPartyMembers[k] && multiPartyMembers[k].isMe) { me = multiPartyMembers[k]; break; }
}
}
var mhnEl = document.getElementById('m2MeHpNum');
if (mhnEl) mhnEl.textContent = hpText(me);
}
} catch (e) {}
}

// ------------------------------------------------------------------
// 【4】公開フック：味方COMBOの“器”へ値を流し込む
//     将来のリアルタイム同期は、この関数を呼ぶだけで表示が追従する
//     例：window.__setAllyCombo(1, 7)  → 味方id=1 のバッジに 🔥7
//         window.__setAllyCombo(1, 0)  → 非表示
// ------------------------------------------------------------------
window.__setAllyCombo = function (memberId, n) {
try {
var v = (typeof n === 'number' && isFinite(n)) ? Math.max(0, Math.floor(n)) : 0;
window.__m2AllyCombo[memberId] = v;
var el = document.getElementById('m2AllyCombo-' + memberId);
if (el) {
if (v >= 2) {
el.textContent = '🔥' + v;
el.classList.add('m2-combo-on');
} else {
el.classList.remove('m2-combo-on');
}
}
} catch (e) {}
};

// ------------------------------------------------------------------
// 【5】renderMultiParty ラップ：描画後に器＆数字を注入
// ------------------------------------------------------------------
var __prevRenderAlly = window.renderMultiParty;
window.renderMultiParty = function () {
var r = __prevRenderAlly ? __prevRenderAlly.apply(this, arguments) : undefined;
injectAllyExtras();
return r;
};

// ------------------------------------------------------------------
// 【6】updateMultiHpBars ラップ：毎描画HP数字を追従（バー減衰と完全同期）
// ------------------------------------------------------------------
var __prevUpdAlly = window.updateMultiHpBars;
window.updateMultiHpBars = function () {
var r = __prevUpdAlly ? __prevUpdAlly.apply(this, arguments) : undefined;
try {
if (typeof multiPartyMembers !== 'undefined' && multiPartyMembers) {
for (var i = 0; i < multiPartyMembers.length; i++) {
var m = multiPartyMembers[i];
if (!m) continue;
var el = m.isMe
? document.getElementById('m2MeHpNum')
: document.getElementById('m2AllyHpNum-' + m.id);
if (el) el.textContent = hpText(m);
}
}
} catch (e) {}
return r;
};

console.log('⚔️ multi.js 第9パッチ（味方/自分HP数字＋味方COMBOの器：__setAllyCombo フック公開）適用完了');
})();
// ==========================================================================
// 🏰 編成タブ全面リニューアルパッチ（ダンジョン風・マルチのモード選択と統一）
//    ① #view-party を覆う「🚀 Coming Soon」を“パッチCSSだけで”無効化＝公開
//       （style.css は不変更。::after を content:none で上書き）
//    ② 3カテゴリを石板ピルで切替：キャラ一覧 ／ 敵図鑑 ／ 装備一覧
//       ・キャラ＝タンゴンのみ（HP/攻撃倍率/コンボ率/スキル/奥義）
//       ・装備＝素手／業火の大剣(+150)／布の服／星屑の盾(+80)
//       ・敵図鑑＝既存10体をフル活用（C3/UC3/R2/SR2・レア別発光・スキル・
//         コンボ閾値・バリア有無）＋レアリティフィルタ＋名前検索
//    ③ 現在の編成パネル：キャラ/武器/防具の石板スロット＝ワンタップで外す
//    ④ 選択機能を同じ石板UIに統一：selectCharacter/Weapon/Armor をラップ
//       （既存副作用＝activeXxx＋localStorage＋戦闘スロット非表示 はそのまま。
//         alert だけ無音化し、トースト＋火花＋即再描画に差し替え）
//    ⑤ 見た目＝マルチと完全統一：松明ヘッダー・石壁・火の粉・霧・Cinzel＋
//       Noto Serif JP 見出し・石版ボタン・出現アニメ・編成変更の火花
//    ※ 敵/キャラ/装備の表示メタデータは本パッチ内に定義
//       （multi 2.js の ENEMIES/CHARS はIIFE内ローカルで参照不可のため。
//         将来 multi 2.js 側の敵テーブル等を変えたら本パッチも同じ内容に揃える）
//    ※ app.js / fix.js / style.css / index.html は不変更
// ==========================================================================
(function applyPartyDungeonPatch() {
"use strict";
if (window.__partyDungeonApplied) return;
window.__partyDungeonApplied = true;

/* ---------- 0. フォント確保（パッチ1未適用でも動くよう自己完結） ---------- */
(function ensurePtyFonts() {
if (document.getElementById('ptyFontLink') || document.getElementById('mduFontLink') || document.getElementById('aaaFontLink')) return;
var l = document.createElement('link');
l.id = 'ptyFontLink'; l.rel = 'stylesheet';
l.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=Noto+Serif+JP:wght@700;900&family=Noto+Sans+JP:wght@500;700;900&display=swap';
document.head.appendChild(l);
})();

/* ---------- 1. 表示用メタデータ ---------- */
var RAR = {
C:  { label: 'コモン',     glow: '148,163,184', chip: '#94a3b8', ink: '#0b0e14' },
UC: { label: 'アンコモン', glow: '34,211,238',  chip: '#22d3ee', ink: '#04201f' },
R:  { label: 'レア',       glow: '249,115,22',  chip: '#fb923c', ink: '#2a0f02' },
SR: { label: 'スーパーレア', glow: '251,191,36', chip: '#fbbf24', ink: '#1a1206' }
};
var PARTY_CHARS = [
{ id: 'tangon', name: 'タンゴン', emoji: '🐧', img: 'tangon.png', rarity: 'SR',
  hp: 3500, atkMul: 1.0, comboRate: 1.0,
  skill: '味方HP上限増加', ultimate: 'タンゴフラッシュ',
  desc: '薔薇をくわえてタンゴを踊る伝説の修行者。パーティのHP上限を引き上げ、奥義「タンゴフラッシュ」で敵を一閃する。' }
];
var PARTY_WEAPONS = [
{ id: '',           name: '素手',       emoji: '🗡️', atk: 0,   desc: '何も持たない既定の状態。まずはここから。' },
{ id: 'fire_sword', name: '業火の大剣', emoji: '🔥🗡️', atk: 150, desc: '炎を纏った大剣。攻撃力を +150 底上げし、一撃の重さを増す。' }
];
var PARTY_ARMORS = [
{ id: '',            name: '布の服',   emoji: '🛡️', def: 0,  desc: '軽装の既定防具。守りはまだこれからの領域。' },
{ id: 'cosmic_shield', name: '星屑の盾', emoji: '🔮🛡️', def: 80, desc: '星の欠片を鍛えた盾。防御力を +80 高め、敵の攻撃をいなしやすくする。' }
];
var PARTY_ENEMIES = [
{ id: 'goblin',  name: 'ゴブリン歩兵',     emoji: '👺', rarity: 'C',  baseHp: 2400,  atk: 220, skills: ['time'],            comboTh: 999, special: null },
{ id: 'slime',   name: '酸性スライム',     emoji: '🟢', rarity: 'C',  baseHp: 2000,  atk: 180, skills: ['time'],            comboTh: 999, special: null },
{ id: 'bat',     name: '洞窟コウモリ',     emoji: '🦇', rarity: 'C',  baseHp: 1800,  atk: 240, skills: ['time'],            comboTh: 999, special: null },
{ id: 'orc',     name: 'オーク戦士',       emoji: '👹', rarity: 'UC', baseHp: 4200,  atk: 340, skills: ['time'],            comboTh: 999, special: null },
{ id: 'spider',  name: '毒針アラクネ',     emoji: '🕷️', rarity: 'UC', baseHp: 3800,  atk: 380, skills: ['time', 'combo'],   comboTh: 6,   special: null },
{ id: 'wraith',  name: '彷徨う亡霊',       emoji: '👻', rarity: 'UC', baseHp: 3600,  atk: 400, skills: ['time'],            comboTh: 999, special: null },
{ id: 'drake',   name: '炎翼ドレイク',     emoji: '🐲', rarity: 'R',  baseHp: 8200,  atk: 560, skills: ['time', 'combo'],   comboTh: 5,   special: null },
{ id: 'golem',   name: '魔導ゴーレム',     emoji: '🗿', rarity: 'R',  baseHp: 9600,  atk: 480, skills: ['time', 'combo'],   comboTh: 7,   special: null },
{ id: 'lich',    name: '氷獄のリッチ',     emoji: '🧙', rarity: 'SR', baseHp: 16000, atk: 720, skills: ['time', 'combo', 'special'], comboTh: 4, special: 'barrier' },
{ id: 'bahamut', name: '終焉竜バハムート', emoji: '🐉', rarity: 'SR', baseHp: 20000, atk: 820, skills: ['time', 'combo', 'special'], comboTh: 4, special: 'barrier' }
];

/* ---------- 2. 状態 ---------- */
window.__partyUi = window.__partyUi || { cat: 'char', search: '', rarity: 'ALL', expanded: {} };
function PU() { return window.__partyUi; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function curChar()   { var v = (typeof activeCharacter !== 'undefined') ? activeCharacter : ''; return (v && String(v).trim()) ? String(v).trim() : ''; }
function curWeapon() { var v = (typeof activeWeapon !== 'undefined') ? activeWeapon : ''; return (v && String(v).trim()) ? String(v).trim() : ''; }
function curArmor()  { var v = (typeof activeArmor !== 'undefined') ? activeArmor : ''; return (v && String(v).trim()) ? String(v).trim() : ''; }

/* ---------- 3. スタイル注入 ---------- */
(function injectPtyCss() {
if (document.getElementById('ptyDungeonCss')) return;
var s = document.createElement('style');
s.id = 'ptyDungeonCss';
s.textContent = [
/* ===== Coming Soon 無効化（style.css 不変更・::after を消す） ===== */
'#view-party::after{content:none !important;display:none !important;pointer-events:none !important;}',
/* ===== 編成タブを洞窟の間に（石壁＋高さ確保） ===== */
'#view-party{position:relative !important;min-height:calc(100dvh - 136px);overflow:hidden !important;}',
'#view-party::before{background-image:none !important;opacity:1 !important;filter:none !important;animation:none !important;',
'  background:',
'    radial-gradient(140% 120% at 50% 0%, rgba(90,70,50,.30) 0%, transparent 55%),',
'    radial-gradient(120% 100% at 50% 100%, rgba(0,0,0,.68) 0%, transparent 62%),',
'    repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 1px, transparent 1px 44px),',
'    repeating-linear-gradient(90deg, rgba(0,0,0,.16) 0 1px, transparent 1px 72px),',
'    linear-gradient(165deg, #3a2f22 0%, #2a2117 38%, #1e1811 68%, #14100a 100%) !important;}',
/* ===== アンビエント層 ===== */
'.pty-ambient{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;}',
'.pty-lightpool{position:absolute;width:340px;height:340px;border-radius:50%;filter:blur(10px);mix-blend-mode:screen;opacity:.5;}',
'.pty-lightpool.tl{top:-90px;left:-70px;background:radial-gradient(circle, rgba(251,146,60,.36), transparent 70%);animation:ptyPool 3.6s ease-in-out infinite alternate;}',
'.pty-lightpool.tr{top:-90px;right:-70px;background:radial-gradient(circle, rgba(251,146,60,.36), transparent 70%);animation:ptyPool 3.6s ease-in-out infinite alternate-reverse;}',
'.pty-lightpool.floor{bottom:-130px;left:50%;transform:translateX(-50%);width:540px;height:300px;background:radial-gradient(ellipse, rgba(91,45,168,.30), transparent 70%);animation:ptyPool 4.8s ease-in-out infinite alternate;}',
'@keyframes ptyPool{from{opacity:.30}to{opacity:.58}}',
'.pty-fog{position:absolute;inset:-20%;mix-blend-mode:screen;filter:blur(12px);opacity:.4;',
'  background:radial-gradient(38% 30% at 24% 30%, rgba(120,90,60,.5), transparent 70%),radial-gradient(34% 26% at 78% 68%, rgba(91,45,168,.35), transparent 72%);',
'  animation:ptyFog 26s ease-in-out infinite alternate;}',
'.pty-fog.two{animation-duration:34s;animation-direction:alternate-reverse;opacity:.26;background:radial-gradient(42% 30% at 65% 22%, rgba(251,146,60,.22), transparent 70%);}',
'@keyframes ptyFog{0%{transform:translate3d(-4%,-2%,0) scale(1.05)}100%{transform:translate3d(4%,3%,0) scale(1.16)}}',
'.pty-ember{position:absolute;bottom:-10px;border-radius:50%;pointer-events:none;opacity:0;animation:ptyEmber linear infinite;}',
'@keyframes ptyEmber{0%{transform:translateY(0) translateX(0) scale(.5);opacity:0}15%{opacity:.9}70%{opacity:.5}100%{transform:translateY(-105vh) translateX(var(--mx,18px)) scale(1);opacity:0}}',
/* ===== スクロール本文 ===== */
'.pty-scroll{position:relative;z-index:2;}',
'.pty-scroll > *{animation:ptyRise .5s cubic-bezier(.2,.9,.3,1) both;}',
'.pty-scroll > *:nth-child(2){animation-delay:.05s}.pty-scroll > *:nth-child(3){animation-delay:.1s}.pty-scroll > *:nth-child(4){animation-delay:.15s}.pty-scroll > *:nth-child(5){animation-delay:.2s}',
'@keyframes ptyRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}',
/* ===== ヘッダー ===== */
'.pty-header{display:flex;align-items:flex-end;justify-content:center;gap:16px;margin:4px 0 22px;}',
'.pty-title-block{text-align:center;flex:1;min-width:0;}',
'.pty-kicker{font-family:"Cinzel",serif;font-size:10px;font-weight:700;letter-spacing:.42em;color:#c8902a;text-transform:uppercase;text-shadow:0 0 10px rgba(200,144,42,.5);margin-bottom:7px;}',
'.pty-title{font-family:"Noto Serif JP",serif;font-size:30px;font-weight:900;letter-spacing:.14em;line-height:1.1;margin:0;color:#f3e5c0;text-shadow:0 0 18px rgba(245,196,81,.35),0 2px 4px rgba(0,0,0,.9);}',
'.pty-sub{font-family:"Noto Sans JP",sans-serif;font-size:11px;font-weight:600;color:#a89880;letter-spacing:.14em;margin-top:8px;}',
/* ===== セクション見出し ===== */
'.pty-section{margin:0 0 22px;}',
'.pty-sec-head{display:flex;align-items:baseline;gap:9px;max-width:420px;margin:0 auto 12px;width:100%;}',
'.pty-sec-num{font-family:"Cinzel",serif;font-weight:900;color:#c8902a;font-size:13px;}',
'.pty-sec-ja{font-family:"Noto Serif JP",serif;font-size:14px;font-weight:900;letter-spacing:.1em;color:#f3e5c0;text-shadow:0 1px 2px #000;}',
'.pty-sec-rule{flex:1;height:1px;background:linear-gradient(90deg,rgba(200,144,42,.5),transparent);align-self:center;}',
'.pty-sec-en{font-family:"Cinzel",serif;font-size:8.5px;font-weight:700;letter-spacing:.3em;color:#8a7a5f;}',
/* ===== 現在の編成スロット ===== */
'.pty-equip-slots{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:420px;margin:0 auto;width:100%;}',
'.pty-slot{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 8px 12px;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;',
'  border-radius:14px;border:1.5px solid rgba(255,255,255,.13);',
'  background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(0,0,0,.18) 40%),repeating-linear-gradient(0deg, rgba(255,255,255,.02) 0 2px, transparent 2px 7px),linear-gradient(180deg,#38302a,#221c17 58%,#171209);',
'  box-shadow:inset 0 1px 0 rgba(255,255,255,.08),inset 0 -8px 16px rgba(0,0,0,.45),0 8px 18px rgba(0,0,0,.45);',
'  transition:transform .15s cubic-bezier(.2,.9,.3,1.3),box-shadow .2s ease,border-color .2s ease;}',
'.pty-slot:active{transform:translateY(2px) scale(.97);}',
'.pty-slot.filled{border-color:rgba(52,231,228,.55);box-shadow:0 0 18px rgba(52,231,228,.28),inset 0 0 18px rgba(52,231,228,.10),inset 0 1px 0 rgba(255,255,255,.09);}',
'.pty-slot-lbl{font-family:"Cinzel",serif;font-size:8px;font-weight:700;letter-spacing:.22em;color:#8a7a5f;text-transform:uppercase;}',
'.pty-slot-ico{width:46px;height:46px;display:flex;align-items:center;justify-content:center;font-size:24px;border-radius:12px;overflow:hidden;',
'  background:radial-gradient(circle at 50% 35%, rgba(155,107,255,.22), rgba(8,5,18,.7));border:1px solid rgba(255,255,255,.14);box-shadow:inset 0 2px 6px rgba(0,0,0,.6);}',
'.pty-slot-ico img{width:100%;height:100%;object-fit:cover;}',
'.pty-slot-name{font-family:"Noto Serif JP",serif;font-size:11px;font-weight:900;color:#f3e5c0;text-align:center;line-height:1.2;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 1px 2px #000;}',
'.pty-slot-eff{font-family:ui-monospace,monospace;font-size:9px;font-weight:800;color:#67d8d2;text-shadow:0 0 6px rgba(52,231,228,.4);}',
'.pty-slot-act{font-family:"Noto Sans JP",sans-serif;font-size:9px;font-weight:800;letter-spacing:.06em;padding:3px 9px;border-radius:999px;margin-top:1px;}',
'.pty-slot-act.unequip{color:#fda4af;background:rgba(255,84,104,.12);border:1px solid rgba(255,84,104,.35);}',
'.pty-slot-act.equip{color:#9af6f1;background:rgba(52,231,228,.12);border:1px solid rgba(52,231,228,.35);}',
/* ===== カテゴリピル ===== */
'.pty-pills{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;max-width:420px;margin:0 auto 12px;width:100%;}',
'.pty-pill{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;padding:12px 6px;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;border:none;',
'  clip-path:polygon(10px 0,calc(100% - 10px) 0,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0 calc(100% - 10px),0 10px);',
'  background:linear-gradient(180deg,#3d342b,#241d16 60%,#191309);',
'  box-shadow:inset 0 0 0 1.5px rgba(200,144,42,.26),inset 0 1px 0 rgba(255,255,255,.07),inset 0 -6px 12px rgba(0,0,0,.5);',
'  transition:transform .14s ease,box-shadow .2s ease,filter .2s ease;}',
'.pty-pill:active{transform:scale(.96);}',
'.pty-pill-ico{font-size:18px;}',
'.pty-pill-name{font-family:"Noto Serif JP",serif;font-size:12px;font-weight:900;letter-spacing:.06em;color:#cdbfa6;}',
'.pty-pill.active{box-shadow:inset 0 0 0 2px rgba(245,196,81,.85),inset 0 0 22px rgba(245,196,81,.22),inset 0 1px 0 rgba(255,255,255,.1);filter:drop-shadow(0 0 12px rgba(245,196,81,.45));}',
'.pty-pill.active .pty-pill-name{color:#fde68a;text-shadow:0 0 10px rgba(251,191,36,.5);}',
/* ===== 検索バー（石枠） ===== */
'.pty-search-wrap{position:relative;max-width:420px;margin:0 auto 12px;width:100%;display:flex;align-items:center;border-radius:12px;border:1.5px solid rgba(200,144,42,.4);background:linear-gradient(180deg,#2c241c,#1c1610);box-shadow:inset 0 2px 6px rgba(0,0,0,.6),0 4px 12px rgba(0,0,0,.4);transition:border-color .2s ease,box-shadow .2s ease;}',
'.pty-search-wrap:focus-within{border-color:rgba(245,196,81,.8);box-shadow:inset 0 2px 6px rgba(0,0,0,.6),0 0 16px rgba(245,196,81,.3);}',
'.pty-search-ico{flex:0 0 auto;padding:0 4px 0 14px;font-size:15px;}',
'.pty-search{flex:1;background:transparent;border:none;outline:none;padding:12px 14px 12px 8px;color:#f3e5c0;font-family:"Noto Sans JP",sans-serif;font-size:13px;font-weight:700;}',
'.pty-search::placeholder{color:#7a6c54;}',
/* ===== レアリティフィルタ ===== */
'.pty-rarity{display:none;flex-wrap:wrap;gap:6px;justify-content:center;max-width:420px;margin:0 auto 12px;width:100%;}',
'.pty-rarity.show{display:flex;}',
'.pty-rchip{font-family:"Cinzel","Noto Sans JP",sans-serif;font-size:10px;font-weight:800;letter-spacing:.06em;padding:5px 12px;border-radius:999px;cursor:pointer;border:1px solid rgba(255,255,255,.16);background:rgba(0,0,0,.3);color:#a89880;transition:all .18s ease;-webkit-tap-highlight-color:transparent;}',
'.pty-rchip:active{transform:scale(.93);}',
'.pty-rchip.active{color:#1a1206;background:linear-gradient(180deg,#ffe9a8,#f5c451);border-color:rgba(255,233,168,.85);box-shadow:0 0 12px rgba(245,196,81,.5);}',
/* ===== 一覧コンテナ ===== */
'.pty-list{display:flex;flex-direction:column;gap:12px;max-width:420px;margin:0 auto;width:100%;}',
'.pty-empty{max-width:420px;margin:8px auto;width:100%;text-align:center;font-family:"Noto Sans JP",sans-serif;font-size:12px;font-weight:600;color:#8a7a5f;padding:24px 16px;border:1px dashed rgba(200,144,42,.3);border-radius:12px;background:rgba(0,0,0,.25);}',
/* ===== 石板カード ===== */
'.pty-card{position:relative;display:flex;gap:13px;padding:15px 14px 15px 18px;border-radius:15px;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;',
'  border:1.5px solid rgba(200,144,42,.28);',
'  background:linear-gradient(165deg, rgba(255,255,255,.05), rgba(0,0,0,.2) 40%),repeating-linear-gradient(0deg, rgba(255,255,255,.02) 0 2px, transparent 2px 7px),linear-gradient(180deg,#3b3126,#262019 55%,#1b1510);',
'  box-shadow:inset 0 1px 0 rgba(255,255,255,.09),inset 0 -8px 16px rgba(0,0,0,.45),0 8px 20px rgba(0,0,0,.5);',
'  transition:transform .16s cubic-bezier(.2,.9,.3,1.3),box-shadow .2s ease,border-color .2s ease;animation:ptyRise .45s cubic-bezier(.2,.9,.3,1) both;}',
'.pty-card:active{transform:translateY(2px) scale(.99);}',
'.pty-card::before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:0 3px 3px 0;background:linear-gradient(180deg,var(--pty-glow,#f5c451),rgba(200,144,42,.4));box-shadow:0 0 8px var(--pty-glow,#f5c451);}',
'.pty-card.is-active{border-color:rgba(52,231,228,.6);box-shadow:0 0 20px rgba(52,231,228,.3),inset 0 0 22px rgba(52,231,228,.10),inset 0 1px 0 rgba(255,255,255,.09);}',
'.pty-card-emblem{flex:0 0 auto;width:54px;height:54px;display:flex;align-items:center;justify-content:center;font-size:28px;border-radius:14px;overflow:hidden;',
'  background:radial-gradient(circle at 35% 30%, rgba(255,255,255,.12), rgba(0,0,0,.5));border:1.5px solid var(--pty-glow,#fbbf24);box-shadow:0 0 14px var(--pty-glow,#fbbf24),inset 0 2px 6px rgba(0,0,0,.7);}',
'.pty-card-emblem img{width:100%;height:100%;object-fit:cover;}',
'.pty-card-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;}',
'.pty-card-top{display:flex;align-items:center;gap:8px;}',
'.pty-card-name{font-family:"Noto Serif JP",serif;font-size:16px;font-weight:900;letter-spacing:.04em;color:#f3e5c0;text-shadow:0 1px 3px rgba(0,0,0,.9);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
'.pty-rbadge{flex:0 0 auto;font-family:"Cinzel","Noto Sans JP",sans-serif;font-size:9px;font-weight:800;letter-spacing:.04em;padding:3px 9px;border-radius:999px;white-space:nowrap;}',
'.pty-equipped{flex:0 0 auto;font-family:"Noto Sans JP",sans-serif;font-size:9px;font-weight:800;letter-spacing:.06em;padding:3px 9px;border-radius:999px;color:#04201f;background:linear-gradient(135deg,#9af6f1,#34e7e4);box-shadow:0 0 10px rgba(52,231,228,.6);white-space:nowrap;}',
'.pty-stats{display:flex;flex-wrap:wrap;gap:5px 12px;}',
'.pty-stat{font-family:"Noto Sans JP",sans-serif;font-size:10.5px;font-weight:700;color:#c8bca6;display:flex;align-items:center;gap:4px;}',
'.pty-stat b{font-family:ui-monospace,monospace;color:#f3e5c0;font-weight:800;}',
'.pty-stat .up{color:#67d8d2;}',
'.pty-skills{display:flex;flex-wrap:wrap;gap:5px;}',
'.pty-skill{font-family:"Noto Sans JP",sans-serif;font-size:9.5px;font-weight:700;color:#d6b96a;background:rgba(200,144,42,.12);border:1px solid rgba(200,144,42,.3);padding:3px 8px;border-radius:7px;}',
'.pty-detail{max-height:0;overflow:hidden;transition:max-height .35s cubic-bezier(.25,1,.5,1);}',
'.pty-card.open .pty-detail{max-height:240px;}',
'.pty-detail-inner{font-family:"Noto Sans JP",sans-serif;font-size:11px;font-weight:600;color:#b6a98f;line-height:1.6;margin-top:8px;padding-top:8px;border-top:1px dashed rgba(200,144,42,.25);}',
'.pty-card-actions{display:flex;gap:8px;margin-top:9px;}',
'.pty-btn{flex:1;font-family:"Noto Serif JP",serif;font-size:12px;font-weight:900;letter-spacing:.1em;padding:9px 8px;border-radius:10px;cursor:pointer;border:1.5px solid rgba(245,196,81,.5);-webkit-tap-highlight-color:transparent;',
'  background:linear-gradient(180deg, rgba(255,255,255,.07), rgba(0,0,0,.15) 45%),linear-gradient(180deg,#4a3b24,#2e2415 55%,#1f1809);',
'  color:#fde68a;text-shadow:0 1px 0 rgba(0,0,0,.9),0 0 10px rgba(251,191,36,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.1),inset 0 -4px 9px rgba(0,0,0,.5);transition:transform .13s ease,box-shadow .18s ease;}',
'.pty-btn:active{transform:translateY(2px) scale(.97);box-shadow:inset 0 3px 8px rgba(0,0,0,.6);}',
'.pty-btn.ghost{color:#a89880;border-color:rgba(255,255,255,.16);background:rgba(0,0,0,.3);text-shadow:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.06);}',
'.pty-btn.on{color:#04201f;border-color:rgba(52,231,228,.6);background:linear-gradient(135deg,#9af6f1,#34e7e4);text-shadow:none;box-shadow:0 0 14px rgba(52,231,228,.5);}',
'.pty-card-chev{position:absolute;top:12px;right:12px;font-size:11px;color:#8a7a5f;transition:transform .3s ease;}',
'.pty-card.open .pty-card-chev{transform:rotate(180deg);color:#c8902a;}',
/* ===== ガシャ導線 ===== */
'.pty-gasha{position:relative;max-width:420px;margin:6px auto 4px;width:100%;display:flex;align-items:center;gap:13px;padding:16px 16px;border-radius:15px;cursor:pointer;-webkit-tap-highlight-color:transparent;overflow:hidden;',
'  border:1.5px solid rgba(155,107,255,.4);',
'  background:linear-gradient(165deg, rgba(155,107,255,.10), rgba(0,0,0,.2) 45%),linear-gradient(180deg,#2c2438,#1c1626 55%,#14101c);',
'  box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 0 20px rgba(155,107,255,.22),0 8px 20px rgba(0,0,0,.5);transition:transform .15s ease,box-shadow .2s ease;}',
'.pty-gasha:active{transform:translateY(2px) scale(.99);box-shadow:inset 0 3px 10px rgba(0,0,0,.6),0 0 26px rgba(155,107,255,.35);}',
'.pty-gasha::after{content:"";position:absolute;top:0;left:-70%;width:45%;height:100%;background:linear-gradient(100deg,transparent,rgba(217,192,255,.16),transparent);transform:skewX(-18deg);animation:ptySheen 3.4s ease-in-out infinite;}',
'@keyframes ptySheen{0%{left:-70%}55%,100%{left:130%}}',
'.pty-gasha-ico{flex:0 0 auto;width:46px;height:46px;display:flex;align-items:center;justify-content:center;font-size:24px;border-radius:12px;background:radial-gradient(circle at 35% 30%, rgba(192,132,252,.3), rgba(8,5,18,.7));border:1px solid rgba(192,132,252,.5);box-shadow:0 0 14px rgba(192,132,252,.4);}',
'.pty-gasha-body{flex:1;min-width:0;}',
'.pty-gasha-name{font-family:"Noto Serif JP",serif;font-size:15px;font-weight:900;color:#e9d9ff;text-shadow:0 0 10px rgba(192,132,252,.4);}',
'.pty-gasha-desc{font-family:"Noto Sans JP",sans-serif;font-size:10px;font-weight:600;color:#a99bc4;margin-top:3px;}',
'.pty-gasha-lock{flex:0 0 auto;font-family:"Noto Sans JP",sans-serif;font-size:9px;font-weight:800;color:#d9c2ff;background:rgba(155,107,255,.16);border:1px solid rgba(155,107,255,.4);padding:4px 10px;border-radius:999px;}',
/* ===== 編成変更の火花 ===== */
'.pty-spark{position:fixed;border-radius:50%;pointer-events:none;z-index:9999;mix-blend-mode:screen;}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();

/* ---------- 4. アンビエント／松明／見出し HTML ---------- */
function ptyEmberHtml(n) {
var h = '';
for (var i = 0; i < n; i++) {
var left = Math.round(Math.random() * 100);
var delay = (Math.random() * 8).toFixed(2);
var dur = (7 + Math.random() * 8).toFixed(2);
var size = 2 + Math.round(Math.random() * 3);
var mx = Math.round(Math.random() * 50 - 25);
var c = Math.random() < 0.6 ? 'rgba(251,146,60,.85)' : 'rgba(251,191,36,.8)';
h += '<span class="pty-ember" style="left:' + left + '%;width:' + size + 'px;height:' + size + 'px;background:' + c + ';box-shadow:0 0 6px ' + c + ';animation-delay:' + delay + 's;animation-duration:' + dur + 's;--mx:' + mx + 'px;"></span>';
}
return h;
}
function ptyAmbientHtml() {
return '<div class="pty-ambient"><div class="pty-lightpool tl"></div><div class="pty-lightpool tr"></div><div class="pty-lightpool floor"></div><div class="pty-fog"></div><div class="pty-fog two"></div>' + ptyEmberHtml(16) + '</div>';
}
function ptyTorchHtml() {
return '<div class="mdu-torch"><div class="mdu-torch-glow"></div><div class="mdu-flame"></div><div class="mdu-torch-stick"></div></div>';
}
function ptySecHead(num, ja, en) {
return '<div class="pty-sec-head"><span class="pty-sec-num">' + num + '</span><span class="pty-sec-ja">' + ja + '</span><span class="pty-sec-rule"></span><span class="pty-sec-en">' + en + '</span></div>';
}

/* ---------- 5. 編成変更の火花 ---------- */
function ptySparkBurst() {
var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
var cols = ['rgba(251,191,36,.95)', 'rgba(52,231,228,.9)', 'rgba(255,255,255,.9)', 'rgba(249,115,22,.9)'];
for (var i = 0; i < 20; i++) {
(function (i) {
var p = document.createElement('div');
p.className = 'pty-spark';
var size = 5 + Math.round(Math.random() * 7);
var ang = Math.random() * Math.PI * 2;
var dist = 50 + Math.random() * 120;
var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
p.style.width = size + 'px'; p.style.height = size + 'px';
p.style.left = cx + 'px'; p.style.top = cy + 'px';
p.style.background = 'radial-gradient(circle,' + cols[i % cols.length] + ',transparent 70%)';
p.style.boxShadow = '0 0 8px ' + cols[i % cols.length];
p.style.transform = 'translate(-50%,-50%)';
p.style.transition = 'transform .7s cubic-bezier(.2,.7,.3,1),opacity .7s ease';
document.body.appendChild(p);
requestAnimationFrame(function () {
p.style.transform = 'translate(calc(-50% + ' + dx.toFixed(1) + 'px),calc(-50% + ' + dy.toFixed(1) + 'px)) scale(.3)';
p.style.opacity = '0';
});
setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 760);
})(i);
}
}
function ptyToast(msg, type) {
if (typeof window.showToast === 'function') { window.showToast(msg, type || 'ok'); return; }
try { console.log('[party] ' + msg); } catch (e) {}
}

/* ---------- 6. alert 無音化ラップ（既存 selectXxx の alert だけ消す） ---------- */
function silentCall(fn) {
var a = window.alert;
window.alert = function () {};
try { fn(); } finally { window.alert = a; }
}

/* ---------- 7. スロット描画（現在の編成） ---------- */
function slotHtml(type) {
var lbl, ico, name, eff, actCls, actTxt, filled;
if (type === 'char') {
var cc = curChar();
var ch = PARTY_CHARS.filter(function (c) { return c.id === cc; })[0];
lbl = 'CHARACTER';
if (ch) {
ico = ch.img ? '<img src="' + esc(ch.img) + '" alt="' + esc(ch.name) + '" onerror="this.style.display=\'none\';this.parentNode.textContent=\'' + esc(ch.emoji) + '\';">' : esc(ch.emoji);
name = esc(ch.name); eff = ''; actCls = 'unequip'; actTxt = '外す'; filled = true;
} else {
ico = '🫙'; name = '未編成'; eff = ''; actCls = 'equip'; actTxt = '編成'; filled = false;
}
} else if (type === 'weapon') {
var cw = curWeapon();
var wp = PARTY_WEAPONS.filter(function (w) { return w.id === cw; })[0] || PARTY_WEAPONS[0];
lbl = 'WEAPON'; ico = esc(wp.emoji); name = esc(wp.name);
eff = wp.atk > 0 ? '攻撃 +' + wp.atk : ''; actCls = wp.id ? 'unequip' : 'equip'; actTxt = wp.id ? '外す' : '既定'; filled = !!wp.id;
} else {
var ca = curArmor();
var ar = PARTY_ARMORS.filter(function (a) { return a.id === ca; })[0] || PARTY_ARMORS[0];
lbl = 'ARMOR'; ico = esc(ar.emoji); name = esc(ar.name);
eff = ar.def > 0 ? '防御 +' + ar.def : ''; actCls = ar.id ? 'unequip' : 'equip'; actTxt = ar.id ? '外す' : '既定'; filled = !!ar.id;
}
return '<div class="pty-slot' + (filled ? ' filled' : '') + '" data-slot="' + type + '">' +
'<span class="pty-slot-lbl">' + lbl + '</span>' +
'<span class="pty-slot-ico">' + ico + '</span>' +
'<span class="pty-slot-name">' + name + '</span>' +
(eff ? '<span class="pty-slot-eff">' + eff + '</span>' : '') +
'<span class="pty-slot-act ' + actCls + '">' + actTxt + '</span>' +
'</div>';
}
function renderEquipSlots() {
var host = document.getElementById('ptyEquipSlots');
if (!host) return;
host.innerHTML = slotHtml('char') + slotHtml('weapon') + slotHtml('armor');
}

/* ---------- 8. カード描画 ---------- */
function charCard(c) {
var r = RAR[c.rarity] || RAR.C;
var active = curChar() === c.id;
var open = !!PU().expanded['char_' + c.id];
var emblem = c.img ? '<img src="' + esc(c.img) + '" alt="' + esc(c.name) + '" onerror="this.style.display=\'none\';this.parentNode.textContent=\'' + esc(c.emoji) + '\';">' : esc(c.emoji);
return '<div class="pty-card' + (active ? ' is-active' : '') + (open ? ' open' : '') + '" style="--pty-glow:rgba(' + r.glow + ',.7)" data-card="char_' + c.id + '">' +
'<span class="pty-card-chev">▼</span>' +
'<div class="pty-card-emblem" style="--pty-glow:rgba(' + r.glow + ',.8)">' + emblem + '</div>' +
'<div class="pty-card-body">' +
'<div class="pty-card-top"><span class="pty-card-name">' + esc(c.name) + '</span>' +
'<span class="pty-rbadge" style="color:' + r.ink + ';background:linear-gradient(180deg,rgba(' + r.glow + ',.95),rgba(' + r.glow + ',.7))">' + esc(r.label) + '</span>' +
(active ? '<span class="pty-equipped">編成中</span>' : '') + '</div>' +
'<div class="pty-stats">' +
'<span class="pty-stat">❤️ HP <b>' + c.hp + '</b></span>' +
'<span class="pty-stat">⚔️ 攻撃 <b>×' + c.atkMul.toFixed(1) + '</b></span>' +
'<span class="pty-stat">🔥 コンボ率 <b>×' + c.comboRate.toFixed(1) + '</b></span>' +
'</div>' +
'<div class="pty-skills"><span class="pty-skill">✦ ' + esc(c.skill) + '</span><span class="pty-skill">💥 ' + esc(c.ultimate) + '</span></div>' +
'<div class="pty-detail"><div class="pty-detail-inner">' + esc(c.desc) + '</div></div>' +
'<div class="pty-card-actions">' +
(active
? '<button type="button" class="pty-btn on" data-act="unequip-char">編成を外す</button>'
: '<button type="button" class="pty-btn" data-act="equip-char" data-id="' + esc(c.id) + '">編成する</button>') +
'</div></div></div>';
}
function weaponCard(w) {
var active = curWeapon() === w.id;
var open = !!PU().expanded['weapon_' + (w.id || 'none')];
var isDefault = !w.id;
return '<div class="pty-card' + (active ? ' is-active' : '') + (open ? ' open' : '') + '" style="--pty-glow:rgba(245,196,81,.6)" data-card="weapon_' + (w.id || 'none') + '">' +
'<span class="pty-card-chev">▼</span>' +
'<div class="pty-card-emblem" style="--pty-glow:rgba(245,196,81,.7)">' + esc(w.emoji) + '</div>' +
'<div class="pty-card-body">' +
'<div class="pty-card-top"><span class="pty-card-name">' + esc(w.name) + '</span>' +
(w.atk > 0 ? '<span class="pty-rbadge" style="color:#2a0f02;background:linear-gradient(180deg,#fdba74,#fb923c)">攻撃 +' + w.atk + '</span>' : '<span class="pty-rbadge" style="color:#0b0e14;background:linear-gradient(180deg,#e8ecf5,#aab2c5)">既定</span>') +
(active ? '<span class="pty-equipped">装備中</span>' : '') + '</div>' +
'<div class="pty-detail"><div class="pty-detail-inner">' + esc(w.desc) + '</div></div>' +
'<div class="pty-card-actions">' +
(active
? (isDefault ? '<button type="button" class="pty-btn on" disabled style="opacity:.7;cursor:default">既定装備</button>' : '<button type="button" class="pty-btn on" data-act="unequip-weapon">装備を外す</button>')
: '<button type="button" class="pty-btn" data-act="equip-weapon" data-id="' + esc(w.id) + '">装備する</button>') +
'</div></div></div>';
}
function armorCard(a) {
var active = curArmor() === a.id;
var open = !!PU().expanded['armor_' + (a.id || 'none')];
var isDefault = !a.id;
return '<div class="pty-card' + (active ? ' is-active' : '') + (open ? ' open' : '') + '" style="--pty-glow:rgba(52,231,228,.55)" data-card="armor_' + (a.id || 'none') + '">' +
'<span class="pty-card-chev">▼</span>' +
'<div class="pty-card-emblem" style="--pty-glow:rgba(52,231,228,.65)">' + esc(a.emoji) + '</div>' +
'<div class="pty-card-body">' +
'<div class="pty-card-top"><span class="pty-card-name">' + esc(a.name) + '</span>' +
(a.def > 0 ? '<span class="pty-rbadge" style="color:#04201f;background:linear-gradient(180deg,#9af6f1,#34e7e4)">防御 +' + a.def + '</span>' : '<span class="pty-rbadge" style="color:#0b0e14;background:linear-gradient(180deg,#e8ecf5,#aab2c5)">既定</span>') +
(active ? '<span class="pty-equipped">装備中</span>' : '') + '</div>' +
'<div class="pty-detail"><div class="pty-detail-inner">' + esc(a.desc) + '</div></div>' +
'<div class="pty-card-actions">' +
(active
? (isDefault ? '<button type="button" class="pty-btn on" disabled style="opacity:.7;cursor:default">既定装備</button>' : '<button type="button" class="pty-btn on" data-act="unequip-armor">装備を外す</button>')
: '<button type="button" class="pty-btn" data-act="equip-armor" data-id="' + esc(a.id) + '">装備する</button>') +
'</div></div></div>';
}
function enemySkillLabels(e) {
var out = [];
(e.skills || []).forEach(function (sk) {
if (sk === 'time') out.push('⏱️ 行動時 全体攻撃');
else if (sk === 'combo') out.push('🔥 コンボ反撃（' + (e.comboTh || '—') + '以上）');
else if (sk === 'special') out.push('✨ 特殊行動');
});
if (e.special === 'barrier') out.push('🛡️ バリア展開（HP25%）');
return out;
}
function enemyCard(e) {
var r = RAR[e.rarity] || RAR.C;
var open = !!PU().expanded['enemy_' + e.id];
var skills = enemySkillLabels(e);
var skillHtml = skills.map(function (s) { return '<span class="pty-skill">' + esc(s) + '</span>'; }).join('');
return '<div class="pty-card' + (open ? ' open' : '') + '" style="--pty-glow:rgba(' + r.glow + ',.7)" data-card="enemy_' + e.id + '">' +
'<span class="pty-card-chev">▼</span>' +
'<div class="pty-card-emblem" style="--pty-glow:rgba(' + r.glow + ',.85)">' + esc(e.emoji) + '</div>' +
'<div class="pty-card-body">' +
'<div class="pty-card-top"><span class="pty-card-name">' + esc(e.name) + '</span>' +
'<span class="pty-rbadge" style="color:' + r.ink + ';background:linear-gradient(180deg,rgba(' + r.glow + ',.95),rgba(' + r.glow + ',.7))">' + esc(r.label) + '</span></div>' +
'<div class="pty-stats">' +
'<span class="pty-stat">❤️ HP <b>' + e.baseHp.toLocaleString() + '</b></span>' +
'<span class="pty-stat">⚔️ 攻撃 <b>' + e.atk + '</b></span>' +
(e.special === 'barrier' ? '<span class="pty-stat"><span class="up">🛡️ バリア有</span></span>' : '') +
'</div>' +
'<div class="pty-skills">' + skillHtml + '</div>' +
'<div class="pty-detail"><div class="pty-detail-inner">出現時のHPはパーティ人数に応じて増加する。コンボ反応を持つ敵は、こちらのコンボが閾値を超えると反撃してくるため注意が必要。</div></div>' +
'</div>';
}

/* ---------- 9. 一覧描画（ピル/検索/レアリティでフィルタ） ---------- */
function renderPartyList() {
var list = document.getElementById('ptyList');
var rarBar = document.getElementById('ptyRarity');
if (!list) return;
var cat = PU().cat;
var q = (PU().search || '').toLowerCase().trim();
// レアリティフィルタは敵のときだけ表示
if (rarBar) rarBar.classList.toggle('show', cat === 'enemy');
var html = '';
if (cat === 'char') {
var items = PARTY_CHARS.filter(function (c) { return !q || c.name.toLowerCase().indexOf(q) >= 0; });
html = items.length ? items.map(charCard).join('') : '<div class="pty-empty">該当するキャラクターがありません。</div>';
} else if (cat === 'weapon') {
var witems = PARTY_WEAPONS.filter(function (w) { return !q || w.name.toLowerCase().indexOf(q) >= 0; });
html = witems.length ? witems.map(weaponCard).join('') : '<div class="pty-empty">該当する武器がありません。</div>';
} else if (cat === 'armor') {
var aitems = PARTY_ARMORS.filter(function (a) { return !q || a.name.toLowerCase().indexOf(q) >= 0; });
html = aitems.length ? aitems.map(armorCard).join('') : '<div class="pty-empty">該当する防具がありません。</div>';
} else {
var eitems = PARTY_ENEMIES.filter(function (e) {
if (PU().rarity !== 'ALL' && e.rarity !== PU().rarity) return false;
if (q && e.name.toLowerCase().indexOf(q) < 0) return false;
return true;
});
html = eitems.length ? eitems.map(enemyCard).join('') : '<div class="pty-empty">該当する敵がいません。</div>';
}
list.innerHTML = html;
}

/* ---------- 10. 全体描画 ---------- */
function renderPartyTab() {
var view = document.getElementById('view-party');
if (!view) return;
var pu = PU();
var pill = function (key, ico, name) {
return '<button type="button" class="pty-pill' + (pu.cat === key ? ' active' : '') + '" data-pill="' + key + '"><span class="pty-pill-ico">' + ico + '</span><span class="pty-pill-name">' + name + '</span></button>';
};
var rchip = function (key, name) {
return '<span class="pty-rchip' + (pu.rarity === key ? ' active' : '') + '" data-rarity="' + key + '">' + name + '</span>';
};
view.innerHTML = ptyAmbientHtml() +
'<div class="pty-scroll">' +
'<div class="pty-header">' + ptyTorchHtml() +
'<div class="pty-title-block"><div class="pty-kicker">Loadout Forge</div><h2 class="pty-title">編成</h2><div class="pty-sub">仲間と装備を整え、次の戦いに備えよ</div></div>' +
ptyTorchHtml() + '</div>' +
'<div class="pty-section">' + ptySecHead('①', '現在の編成', 'CURRENT LOADOUT') +
'<div class="pty-equip-slots" id="ptyEquipSlots"></div></div>' +
'<div class="pty-section">' + ptySecHead('②', '一覧', 'BROWSE') +
'<div class="pty-pills">' + pill('char', '🐧', 'キャラ') + pill('enemy', '💀', '敵図鑑') + pill('armor', '🛡️', '装備') + '</div>' +
'<div class="pty-search-wrap"><span class="pty-search-ico">🔍</span><input type="text" id="ptySearch" class="pty-search" placeholder="名前で検索…" value="' + esc(pu.search) + '"></div>' +
'<div class="pty-rarity' + (pu.cat === 'enemy' ? ' show' : '') + '" id="ptyRarity">' + rchip('ALL', 'ALL') + rchip('C', 'C') + rchip('UC', 'UC') + rchip('R', 'R') + rchip('SR', 'SR') + '</div>' +
'<div class="pty-list" id="ptyList"></div></div>' +
'<div class="pty-gasha" id="ptyGasha"><span class="pty-gasha-ico">🎰</span><span class="pty-gasha-body"><span class="pty-gasha-name">キャラクター＆武器ガシャ</span><span class="pty-gasha-desc">学習で溜めたEXPを使って新しい力を手に入れよう</span></span><span class="pty-gasha-lock">🔒 準備中</span></div>' +
'</div>';
renderEquipSlots();
renderPartyList();
bindPartyEvents(view);
}

/* ---------- 11. イベント束ね（委譲＋1回ガード） ---------- */
function bindPartyEvents(view) {
if (view.dataset.ptyBound === '1') return;
view.dataset.ptyBound = '1';
// ピル
view.addEventListener('click', function (e) {
var pillEl = e.target.closest('[data-pill]');
if (pillEl) {
PU().cat = pillEl.getAttribute('data-pill');
var pills = view.querySelectorAll('[data-pill]');
for (var i = 0; i < pills.length; i++) pills[i].classList.toggle('active', pills[i] === pillEl);
renderPartyList();
return;
}
var rchipEl = e.target.closest('[data-rarity]');
if (rchipEl) {
PU().rarity = rchipEl.getAttribute('data-rarity');
var chips = view.querySelectorAll('[data-rarity]');
for (var j = 0; j < chips.length; j++) chips[j].classList.toggle('active', chips[j] === rchipEl);
renderPartyList();
return;
}
var actBtn = e.target.closest('[data-act]');
if (actBtn) { e.stopPropagation(); doAction(actBtn.getAttribute('data-act'), actBtn.getAttribute('data-id')); return; }
var slot = e.target.closest('[data-slot]');
if (slot) { doSlotTap(slot.getAttribute('data-slot')); return; }
if (e.target.closest('#ptyGasha')) { ptyToast('🎰 ガシャはただいま準備中です', 'warn'); return; }
var card = e.target.closest('[data-card]');
if (card) {
var key = card.getAttribute('data-card');
PU().expanded[key] = !PU().expanded[key];
card.classList.toggle('open', !!PU().expanded[key]);
}
});
// 検索
var searchEl = view.querySelector('#ptySearch');
if (searchEl) searchEl.addEventListener('input', function () { PU().search = searchEl.value; renderPartyList(); });
}

/* ---------- 12. 編成アクション（既存 selectXxx を alert 無音で呼ぶ） ---------- */
function doAction(act, id) {
if (act === 'equip-char')   silentCall(function () { if (typeof window.selectCharacter === 'function') window.selectCharacter(id); });
else if (act === 'unequip-char')   silentCall(function () { if (typeof window.selectCharacter === 'function') window.selectCharacter(''); });
else if (act === 'equip-weapon')   silentCall(function () { if (typeof window.selectWeapon === 'function') window.selectWeapon(id); });
else if (act === 'unequip-weapon') silentCall(function () { if (typeof window.selectWeapon === 'function') window.selectWeapon(''); });
else if (act === 'equip-armor')    silentCall(function () { if (typeof window.selectArmor === 'function') window.selectArmor(id); });
else if (act === 'unequip-armor')  silentCall(function () { if (typeof window.selectArmor === 'function') window.selectArmor(''); });
else return;
afterEquipChange(act);
}
function doSlotTap(type) {
if (type === 'char') {
if (curChar()) silentCall(function () { window.selectCharacter(''); });
else silentCall(function () { window.selectCharacter(PARTY_CHARS[0].id); });
} else if (type === 'weapon') {
if (curWeapon()) silentCall(function () { window.selectWeapon(''); });
else silentCall(function () { window.selectWeapon(PARTY_WEAPONS[1].id); });
} else {
if (curArmor()) silentCall(function () { window.selectArmor(''); });
else silentCall(function () { window.selectArmor(PARTY_ARMORS[1].id); });
}
afterEquipChange(type);
}
function afterEquipChange(act) {
renderEquipSlots();
renderPartyList();
ptySparkBurst();
var msg = '編成を更新しました';
if (act.indexOf('unequip') === 0) msg = '編成を外しました';
else if (act === 'char' || act === 'weapon' || act === 'armor') msg = '編成を切り替えました';
ptyToast('⚔️ ' + msg, 'ok');
}

/* ---------- 13. 既存関数の上書き／ラップ ---------- */
// 13-a switchPartySubCategory：新ピル構造に合わせる（旧DOMのIDはもう使わない）
window.switchPartySubCategory = function (category) {
var map = { character: 'char', char: 'char', weapon: 'armor', armor: 'armor', enemy: 'enemy' };
PU().cat = map[category] || 'char';
renderPartyTab();
};
// 13-b updatePartySlotsUi：新スロットを更新＋戦闘画面側の3行はnullガードで維持
var __origUpdateSlots = window.updatePartySlotsUi;
window.updatePartySlotsUi = function () {
renderEquipSlots();
// 戦闘画面側の装備アイコン非表示ロジックを維持（新編成DOMには無いID＝nullガード）
try {
var bChar = document.getElementById('multiEquipCharIcon'); if (bChar) bChar.style.display = 'none';
var bWep = document.getElementById('multiEquipWeaponIcon'); if (bWep) bWep.style.display = 'none';
var bArm = document.getElementById('multiEquipArmorIcon'); if (bArm) bArm.style.display = 'none';
} catch (e) {}
if (typeof __origUpdateSlots === 'function' && !__origUpdateSlots.__ptySkip) {
// 旧関数は slotCharImgContainer 等を参照するが新DOMには無い＝null でこける可能性。
// 安全のため try で包んで呼ぶ（戦闘画面側の処理は上で済ませ済み）
try { __origUpdateSlots(); } catch (e) {}
}
};
// 13-c selectCharacter/Weapon/Armor：alert をトースト＋火花＋再描画に差し替え
var __origSelChar = window.selectCharacter;
window.selectCharacter = function (charId) {
silentCall(function () { if (typeof __origSelChar === 'function') __origSelChar(charId); });
renderEquipSlots(); renderPartyList(); ptySparkBurst();
ptyToast(charId ? '🐧 キャラクターを編成しました' : '🐧 キャラクターの編成を外しました', 'ok');
};
var __origSelWep = window.selectWeapon;
window.selectWeapon = function (weaponId) {
silentCall(function () { if (typeof __origSelWep === 'function') __origSelWep(weaponId); });
renderEquipSlots(); renderPartyList(); ptySparkBurst();
ptyToast(weaponId ? '🗡️ 武器を装備しました' : '🗡️ 武器を外しました', 'ok');
};
var __origSelArm = window.selectArmor;
window.selectArmor = function (armorId) {
silentCall(function () { if (typeof __origSelArm === 'function') __origSelArm(armorId); });
renderEquipSlots(); renderPartyList(); ptySparkBurst();
ptyToast(armorId ? '🛡️ 防具を装備しました' : '🛡️ 防具を外しました', 'ok');
};

/* ---------- 14. switchTab ラップ：編成タブ表示時に再描画 ---------- */
var __prevSwitchTabPty = window.switchTab;
window.switchTab = function (tabId) {
var r = __prevSwitchTabPty ? __prevSwitchTabPty.apply(this, arguments) : undefined;
if (tabId === 'party') { setTimeout(renderPartyTab, 30); }
return r;
};

/* ---------- 15. 起動時注入 ---------- */
(function initPartyPatch() {
function boot() {
var view = document.getElementById('view-party');
if (view) renderPartyTab();
}
if (document.readyState !== 'loading') setTimeout(boot, 400);
else document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 400); });
})();
console.log('🏰 編成タブ全面リニューアルパッチ（ダンジョン風・3カテゴリ＋敵図鑑＋石板UI統一）適用完了');
})();
// ==========================================================================
// 🛡️ 編成タブ修正パッチ：敵図鑑カードの横ずれ・縦書き潰れを根治
//    症状：敵カードが縦に積まれず横へずれて重なり、❤️HP／⚔️攻撃／スキル等の
//          テキストが1文字ずつ縦に積まれて読めなくなっていた。
//    原因：.pty-list の「縦1列」指定と .pty-card の「横並び」指定が、
//          中身の多い敵カード（stats行＋スキルチップを複数持つ）で競合し、
//          本文(.pty-card-body)が幅0まで shrink → テキストが1文字ずつ折り返し、
//          さらにカード同士も横方向へ流れていた。
//    根治：構造を「カードは縦1列／1カード内はアイコン左・本文右／テキストは横書き」
//          で !important 固定。中身の量に一切左右されなくなる。
//    ※同じ .pty-card クラスを使うため全カテゴリに効くが、キャラ・装備は
//      中身が少なく元々潰れていない＝頑健化されるだけで壊れません。
//    ※ app.js / fix.js / style.css / index.html は不変更
// ==========================================================================
(function applyPartyEnemyLayoutFixPatch() {
"use strict";
if (window.__partyEnemyLayoutFixApplied) return;
window.__partyEnemyLayoutFixApplied = true;

(function injectPartyEnemyLayoutCss() {
if (document.getElementById('ptyEnemyLayoutCss')) return;
var s = document.createElement('style');
s.id = 'ptyEnemyLayoutCss';
s.textContent = [
/* ===== 編成タブ全体：横はみ出し自体を遮断 ===== */
'#view-party{overflow-x:hidden !important;}',
'#view-party .pty-scroll{overflow-x:hidden !important;}',

/* ===== 一覧コンテナ：縦1列を強制（横流れを根絶） ===== */
'#view-party .pty-list{',
'  display:flex !important;',
'  flex-direction:column !important;',
'  flex-wrap:nowrap !important;',
'  align-items:stretch !important;',
'  width:100% !important;',
'  max-width:420px !important;',
'  margin-left:auto !important;',
'  margin-right:auto !important;',
'  box-sizing:border-box !important;',
'}',

/* ===== カード：縦積みの中の“1行”＝全幅・横並びレイアウトを固定 ===== */
'#view-party .pty-card{',
'  position:relative !important;',
'  display:flex !important;',
'  flex-direction:row !important;',
'  flex-wrap:nowrap !important;',
'  align-items:flex-start !important;',
'  width:100% !important;',
'  max-width:100% !important;',
'  flex:0 0 auto !important;',
'  box-sizing:border-box !important;',
'  float:none !important;',
'  transform:none !important;',           /* 出現アニメ由来の残transformを除去 */
'}',
'#view-party .pty-card:active{transform:translateY(2px) scale(.99) !important;}',

/* ===== 紋章：固定幅で潰れない ===== */
'#view-party .pty-card-emblem{',
'  flex:0 0 auto !important;',
'  width:54px !important;',
'  min-width:54px !important;',
'}',

/* ===== 本文：残りの幅を全部取り、幅0へ潰れない ===== */
'#view-party .pty-card-body{',
'  flex:1 1 auto !important;',
'  min-width:0 !important;',
'  width:auto !important;',
'  display:flex !important;',
'  flex-direction:column !important;',
'  align-items:stretch !important;',
'}',

/* ===== 本文内の全テキスト：横書きを強制＝1文字縦積みを根絶 ===== */
'#view-party .pty-card-body,',
'#view-party .pty-card-body *,',
'#view-party .pty-card-top,',
'#view-party .pty-card-name,',
'#view-party .pty-rbadge,',
'#view-party .pty-equipped,',
'#view-party .pty-stats,',
'#view-party .pty-stat,',
'#view-party .pty-skills,',
'#view-party .pty-skill,',
'#view-party .pty-detail,',
'#view-party .pty-detail-inner{',
'  writing-mode:horizontal-tb !important;',
'  -webkit-writing-mode:horizontal-tb !important;',
'  text-orientation:mixed !important;',
'  white-space:normal !important;',
'}',

/* ===== 名前＋バッジ行：横並び＋折り返し制御 ===== */
'#view-party .pty-card-top{',
'  display:flex !important;',
'  flex-direction:row !important;',
'  flex-wrap:wrap !important;',
'  align-items:center !important;',
'  gap:8px !important;',
'  width:100% !important;',
'}',
'#view-party .pty-card-name{',
'  flex:1 1 auto !important;',
'  min-width:0 !important;',
'  white-space:nowrap !important;',
'  overflow:hidden !important;',
'  text-overflow:ellipsis !important;',
'}',
'#view-party .pty-rbadge,',
'#view-party .pty-equipped{',
'  flex:0 0 auto !important;',
'  white-space:nowrap !important;',
'}',

/* ===== ステータス行：横並び＋折り返し ===== */
'#view-party .pty-stats{',
'  display:flex !important;',
'  flex-direction:row !important;',
'  flex-wrap:wrap !important;',
'  gap:5px 12px !important;',
'  width:100% !important;',
'}',
'#view-party .pty-stat{',
'  flex:0 0 auto !important;',
'  white-space:nowrap !important;',
'}',

/* ===== スキルチップ：横並び＋折り返し（敵カードで複数並ぶ箇所） ===== */
'#view-party .pty-skills{',
'  display:flex !important;',
'  flex-direction:row !important;',
'  flex-wrap:wrap !important;',
'  gap:5px !important;',
'  width:100% !important;',
'}',
'#view-party .pty-skill{',
'  flex:0 0 auto !important;',
'  max-width:100% !important;',
'  white-space:normal !important;',
'  word-break:break-word !important;',
'}',

/* ===== アクションボタン行 ===== */
'#view-party .pty-card-actions{',
'  display:flex !important;',
'  flex-direction:row !important;',
'  flex-wrap:wrap !important;',
'  gap:8px !important;',
'  width:100% !important;',
'}',

/* ===== 展開矢印：絶対配置で右上固定（本文を圧迫しない） ===== */
'#view-party .pty-card-chev{',
'  position:absolute !important;',
'  top:12px !important;',
'  right:12px !important;',
'}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();

console.log('🛡️ 編成タブ修正パッチ（敵図鑑カード横ずれ・縦書き潰れ根治：縦1列＋横書き強制）適用完了');
})();
// ==========================================================================
// 🎰 編成⇄ガシャ 最終パッチ（上部切替ボタン＋スワイプ＋下バナー削除＋装備ポップ削除）
//    ① 編成タブ最上部に「⚔️編成 / 🎰ガシャ」ボタン＝タップ＆スワイプ両対応
//       （スワイプは長文読解と同じ：追従→画面幅15%でスライド切替）
//    ② 編成下部のガシャバナー(#ptyGasha)＝完全に削除
//    ③ 装備/キャラ切替時に出るポップ(トースト)＝抑制（💾保存などは残す）
//    ④ ガシャは独立ページ化（召喚陣＋チケット数・ダンジョン統一デザイン）
//    ※ app.js / fix.js / style.css / index.html は不変更
// ==========================================================================
(function applyPartyGashaFinalPatch() {
"use strict";
if (window.__partyGashaFinalApplied) return;
window.__partyGashaFinalApplied = true;

/* ---------- 0. 装備切替ポップの抑制（編成系トーストだけ消す） ---------- */
(function muteEquipToast() {
var prev = window.showToast;
var MUTE = ['⚔️', '🐧', '🗡️', '🛡️', '🎰'];
window.showToast = function (msg, type) {
try {
var s = String(msg == null ? '' : msg);
for (var i = 0; i < MUTE.length; i++) { if (s.indexOf(MUTE[i]) === 0) return; }
} catch (e) {}
if (typeof prev === 'function') return prev.apply(this, arguments);
};
})();

/* ---------- 1. スタイル注入 ---------- */
(function injectPgfCss() {
if (document.getElementById('pgfCss')) return;
var s = document.createElement('style');
s.id = 'pgfCss';
s.textContent = [
'#view-party #ptyGasha{display:none !important;}',
'#view-party .pty-scroll{overflow-x:hidden !important;}',
/* ===== 上部切替ボタン ===== */
'.pgf-bar{display:grid;grid-template-columns:1fr 1fr;gap:9px;max-width:420px;margin:0 auto 14px;width:100%;}',
'.pgf-btn{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;padding:11px 6px 9px;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;border:none;font-size:17px;',
'  clip-path:polygon(10px 0,calc(100% - 10px) 0,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0 calc(100% - 10px),0 10px);',
'  background:linear-gradient(180deg,#3d342b,#241d16 60%,#191309);',
'  box-shadow:inset 0 0 0 1.5px rgba(200,144,42,.26),inset 0 1px 0 rgba(255,255,255,.07),inset 0 -6px 12px rgba(0,0,0,.5);',
'  transition:transform .14s ease,box-shadow .2s ease,filter .2s ease;}',
'.pgf-btn span{font-family:"Noto Serif JP",serif;font-size:12px;font-weight:900;letter-spacing:.08em;color:#cdbfa6;}',
'.pgf-btn:active{transform:scale(.96);}',
'.pgf-btn.on-gold{box-shadow:inset 0 0 0 2px rgba(245,196,81,.85),inset 0 0 22px rgba(245,196,81,.22),inset 0 1px 0 rgba(255,255,255,.1);filter:drop-shadow(0 0 12px rgba(245,196,81,.45));}',
'.pgf-btn.on-gold span{color:#fde68a;text-shadow:0 0 10px rgba(251,191,36,.5);}',
'.pgf-btn.on-purple{box-shadow:inset 0 0 0 2px rgba(155,107,255,.8),inset 0 0 22px rgba(155,107,255,.2),inset 0 1px 0 rgba(255,255,255,.1);filter:drop-shadow(0 0 12px rgba(155,107,255,.45));}',
'.pgf-btn.on-purple span{color:#e9d9ff;text-shadow:0 0 10px rgba(192,132,252,.5);}',
/* ===== スライドアニメ ===== */
'@keyframes pgfSlideR{0%{opacity:0;transform:translateX(60px);}100%{opacity:1;transform:translateX(0);}}',
'@keyframes pgfSlideL{0%{opacity:0;transform:translateX(-60px);}100%{opacity:1;transform:translateX(0);}}',
'.pgf-slide-right{animation:pgfSlideR .3s cubic-bezier(.25,1,.5,1) forwards;}',
'.pgf-slide-left{animation:pgfSlideL .3s cubic-bezier(.25,1,.5,1) forwards;}',
/* ===== ガシャページ ===== */
'.pgf-gate{position:relative;width:170px;height:170px;margin:6px auto 18px;display:flex;align-items:center;justify-content:center;}',
'.pgf-ring{position:absolute;border-radius:50%;}',
'.pgf-ring-outer{inset:0;border:2px dashed rgba(155,107,255,.55);animation:pgfSpin 22s linear infinite;box-shadow:0 0 26px rgba(155,107,255,.28),inset 0 0 26px rgba(155,107,255,.12);}',
'.pgf-ring-inner{inset:20px;border:2px solid transparent;border-top-color:#f5c451;border-right-color:rgba(245,196,81,.35);animation:pgfSpin 7s linear infinite reverse;filter:drop-shadow(0 0 8px rgba(245,196,81,.6));}',
'@keyframes pgfSpin{to{transform:rotate(360deg)}}',
'.pgf-core{font-size:56px;filter:drop-shadow(0 0 20px rgba(155,107,255,.75));animation:pgfCore 2.8s ease-in-out infinite;}',
'@keyframes pgfCore{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}',
'.pgf-ticket{display:flex;align-items:center;justify-content:center;gap:8px;width:max-content;max-width:90%;margin:0 auto 14px;padding:10px 18px;border-radius:999px;background:rgba(155,107,255,.10);border:1px solid rgba(155,107,255,.4);box-shadow:0 0 14px rgba(155,107,255,.22);font-family:"Noto Sans JP",sans-serif;font-size:12px;font-weight:800;color:#d9c2ff;}',
'.pgf-ticket b{font-family:ui-monospace,monospace;font-size:16px;color:#fff;text-shadow:0 0 8px rgba(192,132,252,.7);}',
'.pgf-name{font-family:"Noto Serif JP",serif;font-size:20px;font-weight:900;letter-spacing:.08em;color:#e9d9ff;text-align:center;text-shadow:0 0 12px rgba(192,132,252,.45),0 1px 3px #000;}',
'.pgf-desc{font-family:"Noto Sans JP",sans-serif;font-size:11px;font-weight:600;color:#a99bc4;text-align:center;margin-top:6px;line-height:1.6;}',
'.pgf-lock{width:max-content;margin:14px auto 0;padding:5px 14px;border-radius:999px;font-family:"Noto Sans JP",sans-serif;font-size:10px;font-weight:800;letter-spacing:.08em;color:#8a7a5f;background:rgba(0,0,0,.3);border:1px dashed rgba(200,144,42,.4);}',
'.pgf-back{display:block;width:100%;max-width:380px;margin:22px auto 0;padding:13px;cursor:pointer;font-family:"Noto Sans JP",sans-serif;font-size:12.5px;font-weight:700;letter-spacing:.14em;color:#a89880;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.28);}',
'.pgf-back:active{transform:scale(.98);color:#f3e5c0;}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();

/* ---------- 2. ガシャページ本体 ---------- */
function pgfTorch() { return '<div class="mdu-torch"><div class="mdu-torch-glow"></div><div class="mdu-flame"></div><div class="mdu-torch-stick"></div></div>'; }
function gashaPageHtml() {
return '<div class="pty-header">' + pgfTorch() +
'<div class="pty-title-block"><div class="pty-kicker">Summon Gate</div><h2 class="pty-title">ガシャ</h2><div class="pty-sub">右へスワイプで編成に戻る</div></div>' +
pgfTorch() + '</div>' +
'<div class="pgf-gate"><div class="pgf-ring pgf-ring-outer"></div><div class="pgf-ring pgf-ring-inner"></div><div class="pgf-core">🎰</div></div>' +
'<div class="pgf-ticket">🎟️ 所持チケット <b id="pgfTickets">0</b></div>' +
'<div class="pgf-name">キャラクター＆武器ガシャ</div>' +
'<div class="pgf-desc">学習で溜めたEXPを使って新しい力を手に入れよう</div>' +
'<div class="pgf-lock">🔒 準備中</div>' +
'<button type="button" class="pgf-back" id="pgfBack">← 編成に戻る</button>';
}

/* ---------- 3. ページ切替 ---------- */
window.__pgfPage = window.__pgfPage || 'party';
function applyState(anim) {
var a = document.getElementById('pgPageParty'), b = document.getElementById('pgPageGasha');
if (!a || !b) return;
[a, b].forEach(function (p) { p.style.transform = ''; p.style.opacity = ''; p.style.transition = ''; p.classList.remove('pgf-slide-right', 'pgf-slide-left'); });
var cur = window.__pgfPage;
if (cur === 'gasha') {
a.style.display = 'none'; b.style.display = 'block';
if (anim) { void b.offsetWidth; b.classList.add(anim === 'right' ? 'pgf-slide-right' : 'pgf-slide-left'); }
var t = document.getElementById('pgfTickets');
if (t) { try { t.textContent = String((typeof userStats !== 'undefined' && userStats && userStats.gacha_tickets) || 0); } catch (e) {} }
} else {
b.style.display = 'none'; a.style.display = 'block';
if (anim) { void a.offsetWidth; a.classList.add(anim === 'right' ? 'pgf-slide-right' : 'pgf-slide-left'); }
}
var bp = document.getElementById('pgfBtnParty'), bg = document.getElementById('pgfBtnGasha');
if (bp) bp.classList.toggle('on-gold', cur === 'party');
if (bg) bg.classList.toggle('on-purple', cur === 'gasha');
}
function showPage(name, anim) { window.__pgfPage = name; applyState(anim); window.scrollTo(0, 0); }

/* ---------- 4. 構造組み立て（再描画後も自動で組み直す） ---------- */
function rebuild() {
var view = document.getElementById('view-party');
if (!view) return;
var scroll = view.querySelector('.pty-scroll');
if (!scroll || scroll.querySelector('#pgfBar')) return;
var bar = document.createElement('div');
bar.id = 'pgfBar'; bar.className = 'pgf-bar';
bar.innerHTML = '<button type="button" class="pgf-btn" id="pgfBtnParty">⚔️<span>編成</span></button>' +
'<button type="button" class="pgf-btn" id="pgfBtnGasha">🎰<span>ガシャ</span></button>';
scroll.insertBefore(bar, scroll.firstChild);
var pageA = document.createElement('div');
pageA.id = 'pgPageParty'; pageA.className = 'pgf-page';
while (bar.nextSibling) pageA.appendChild(bar.nextSibling);
scroll.appendChild(pageA);
var g = pageA.querySelector('#ptyGasha');           // ★下のガシャバナー削除
if (g && g.parentNode) g.parentNode.removeChild(g);
var pageB = document.createElement('div');
pageB.id = 'pgPageGasha'; pageB.className = 'pgf-page';
pageB.innerHTML = gashaPageHtml();
scroll.appendChild(pageB);
bar.addEventListener('click', function (e) {
var b = e.target.closest('.pgf-btn'); if (!b) return;
if (b.id === 'pgfBtnParty') showPage('party', 'left');
else showPage('gasha', 'right');
});
var back = pageB.querySelector('#pgfBack');
if (back) back.addEventListener('click', function () { showPage('party', 'left'); });
applyState('');
}

/* ---------- 5. スワイプ（長文読解と同一ロジック） ---------- */
function bindSwipe(view) {
if (!view || view.dataset.pgfSwipe) return;
view.dataset.pgfSwipe = '1';
var sX = 0, sY = 0, cX = 0, drag = false, hori = null;
function activePage() { return window.__pgfPage === 'gasha' ? document.getElementById('pgPageGasha') : document.getElementById('pgPageParty'); }
view.addEventListener('touchstart', function (e) {
if (!document.getElementById('pgfBar')) { drag = false; return; }
if (e.target.closest('button, select, input, textarea, a')) { drag = false; return; }
sX = e.touches[0].clientX; sY = e.touches[0].clientY; cX = sX; drag = true; hori = null;
var a = activePage(); if (a) a.style.transition = 'none';
}, { passive: true });
view.addEventListener('touchmove', function (e) {
if (!drag) return;
var dx = e.touches[0].clientX - sX, dy = e.touches[0].clientY - sY;
if (hori === null) { if (Math.abs(dx) > Math.abs(dy)) hori = true; else { hori = false; drag = false; return; } }
if (!hori) return;
var a = activePage(); if (!a) return;
var cur = window.__pgfPage;
if ((cur === 'party' && dx > 0) || (cur === 'gasha' && dx < 0)) dx = dx * 0.2;
a.style.transform = 'translateX(' + dx + 'px)';
a.style.opacity = 1 - (Math.abs(dx) / window.innerWidth) * 1.5;
cX = e.touches[0].clientX;
}, { passive: true });
view.addEventListener('touchend', function () {
if (!drag) { hori = null; return; }
drag = false; hori = null;
var dx = cX - sX, th = window.innerWidth * 0.15;
var a = activePage();
if (a) a.style.transition = 'all .25s cubic-bezier(.25,1,.5,1)';
var cur = window.__pgfPage;
if (cur === 'party' && dx < -th) {
if (a) { a.style.transform = 'translateX(-50px)'; a.style.opacity = '0'; }
setTimeout(function () { showPage('gasha', 'right'); }, 100);
} else if (cur === 'gasha' && dx > th) {
if (a) { a.style.transform = 'translateX(50px)'; a.style.opacity = '0'; }
setTimeout(function () { showPage('party', 'left'); }, 100);
} else {
if (a) { a.style.transform = 'translateX(0)'; a.style.opacity = '1'; }
}
}, { passive: true });
view.addEventListener('touchcancel', function () { drag = false; hori = null; }, { passive: true });
}

/* ---------- 6. 監視＋起動 ---------- */
function attachObserver() {
var view = document.getElementById('view-party');
if (!view || view.__pgfObs) return;
view.__pgfObs = true;
if (typeof MutationObserver === 'undefined') return;
new MutationObserver(function () {
if (view.querySelector('.pty-scroll') && !view.querySelector('#pgfBar')) requestAnimationFrame(rebuild);
}).observe(view, { childList: true });
}
var __prevSwitchTabPgf = window.switchTab;
window.switchTab = function (tabId) {
var r = __prevSwitchTabPgf ? __prevSwitchTabPgf.apply(this, arguments) : undefined;
if (tabId === 'party') {
window.__pgfPage = 'party';
setTimeout(function () { var v = document.getElementById('view-party'); attachObserver(); bindSwipe(v); rebuild(); }, 40);
setTimeout(rebuild, 140);
}
return r;
};
(function bootPgf() {
function run() {
var view = document.getElementById('view-party');
attachObserver();
if (view) bindSwipe(view);
rebuild();
}
if (document.readyState !== 'loading') setTimeout(run, 500);
else document.addEventListener('DOMContentLoaded', function () { setTimeout(run, 500); });
})();
console.log('🎰 編成⇄ガシャ 最終パッチ（上部ボタン＋スワイプ＋下バナー削除＋装備ポップ削除）適用完了');
})();
// ==========================================================================
// 🐧 編成統一パッチ：並び替え全タブ統一＋Lv連動ステータス＋攻撃を実数値化
//    ① 並び替えボタンを全タブ「図鑑順/HP順/攻撃順/防御順」で統一
//    ② 強化Lvが上がるとHP/攻撃が連動して上がる（+1%/Lv）
//    ③ 攻撃は×1.0でなく実数値表示（タンゴン基準300）
//    ※ app.js/fix.js/style.css/index.html は不変更。multi.js末尾追記
// ==========================================================================
(function applyPartyUnifyPatch() {
"use strict";
if (window.__partyUnifyApplied) return;
window.__partyUnifyApplied = true;

var ENH_PCT = 1; // +1%/Lv
var CHAR_BASE = { tangon: { hp: 3500, atk: 300 } };
var CHAR_DEF = { hp: 3500, atk: 300 };
var ENEMY_BASE = {
goblin:{hp:2400,atk:220,def:0}, slime:{hp:2000,atk:180,def:0}, bat:{hp:1800,atk:240,def:0},
orc:{hp:4200,atk:340,def:0}, spider:{hp:3800,atk:380,def:0}, wraith:{hp:3600,atk:400,def:0},
drake:{hp:8200,atk:560,def:0}, golem:{hp:9600,atk:480,def:0},
lich:{hp:16000,atk:720,def:0}, bahamut:{hp:20000,atk:820,def:0}
};
var GEAR_BASE = {
fire_sword:{hp:0,atk:150,def:0}, cosmic_shield:{hp:0,atk:0,def:80}, '':{hp:0,atk:0,def:0},
none:{hp:0,atk:0,def:0}
};
var UNI = [['no','図鑑順'],['hp','HP順'],['atk','攻撃順'],['def','防御順']];

window.__uniSort = window.__uniSort || { char:'no', enemy:'no', armor:'no' };

function st(){ return (typeof userStats!=='undefined'&&userStats&&typeof userStats==='object')?userStats:{}; }
function enhLv(id){ var o=st().gacha_enhance||{}; return o[id]||0; }
function scaled(b,lv){ return Math.round(b*(1+lv*ENH_PCT/100)); }
function curCat(){ var pu=window.__partyUi; return (pu&&pu.cat)||'char'; }

function charStats(id){ var b=CHAR_BASE[id]||CHAR_DEF; var lv=enhLv(id); return {hp:scaled(b.hp,lv), atk:scaled(b.atk,lv), def:0, lv:lv}; }
function valFor(card){
var d = card.getAttribute('data-card')||card.getAttribute('data-dx2card')||'';
if (card.classList.contains('dx2-card')) return ENEMY_BASE[card.getAttribute('data-dx2card')]||{hp:0,atk:0,def:0};
if (d.indexOf('char_')===0) return charStats(d.slice(5));
if (d.indexOf('weapon_')===0) return GEAR_BASE[d.slice(7)]||GEAR_BASE[''];
if (d.indexOf('armor_')===0) return GEAR_BASE[d.slice(6)]||GEAR_BASE[''];
return {hp:0,atk:0,def:0};
}

/* ---------- ② キャラカードのステータスを実数値＋Lv連動で書き換え ---------- */
function fixCharStats(){
var list=document.getElementById('ptyList'); if(!list) return;
list.querySelectorAll('.pty-card[data-card^="char_"]').forEach(function(card){
var id=card.getAttribute('data-card').slice(5);
var c=charStats(id);
var body=card.querySelector('.pty-card-body'); if(!body) return;
var stats=body.querySelector('.pty-stats');
if(!stats){ stats=document.createElement('div'); stats.className='pty-stats';
var top=body.querySelector('.pty-card-top');
if(top&&top.nextSibling) body.insertBefore(stats,top.nextSibling); else body.appendChild(stats); }
stats.innerHTML='<span class="pty-stat">❤️ HP <b>'+c.hp+'</b></span>'+
'<span class="pty-stat">⚔️ 攻撃 <b>'+c.atk+'</b></span>'+
'<span class="pty-stat up">Lv.'+c.lv+'</span>';
});
}

/* ---------- ① 並び替えボタンを統一 ---------- */
function renderUniChips(list){
var cat=curCat();
// 既存のバラバラな並び替えボタンを除去
list.querySelectorAll('.dx2-sort').forEach(function(el){ el.remove(); });
var old=list.querySelector('[data-uni-row]'); if(old) old.remove();
var row=document.createElement('div');
row.setAttribute('data-uni-row','1');
row.className='dx2-sort';
row.style.cssText='display:flex;gap:6px;justify-content:center;margin:6px 0;flex-wrap:wrap;';
row.innerHTML=UNI.map(function(u){
var on=(window.__uniSort[cat]===u[0]);
return '<span class="dx2-sortchip'+(on?' on':'')+'" data-uni-sort="'+u[0]+'">'+u[1]+'</span>';
}).join('');
list.insertBefore(row, list.firstChild);
}

/* ---------- ① カードを並び替え ---------- */
function reorder(list){
var cat=curCat();
var key=window.__uniSort[cat]||'no';
var sel = (cat==='enemy') ? '.dx2-card' : '.pty-card';
var cards=Array.prototype.slice.call(list.querySelectorAll(sel));
if(!cards.length) return;
cards.forEach(function(c,i){ if(c.dataset.uniOrig===undefined) c.dataset.uniOrig=i; });
cards.sort(function(a,b){
if(key==='no') return (+a.dataset.uniOrig)-(+b.dataset.uniOrig);
var va=valFor(a), vb=valFor(b);
return (vb[key]||0)-(va[key]||0);
});
cards.forEach(function(c){ list.appendChild(c); });
}

function refresh(){
var list=document.getElementById('ptyList'); if(!list) return;
renderUniChips(list);
fixCharStats();
reorder(list);
}

/* ---------- 並び替えクリック ---------- */
document.addEventListener('click', function(e){
var t=e.target; if(!t||!t.closest) return;
var chip=t.closest('[data-uni-sort]'); if(!chip) return;
e.stopPropagation(); e.preventDefault();
var cat=curCat();
window.__uniSort[cat]=chip.getAttribute('data-uni-sort');
refresh();
}, true);

/* ---------- 描画のたびに自動追従 ---------- */
var tm=null;
function queue(){ clearTimeout(tm); tm=setTimeout(refresh,40); }
if (typeof MutationObserver!=='undefined') {
var mo=new MutationObserver(queue);
var boot=function(){ var l=document.getElementById('ptyList'); if(l) mo.observe(l,{childList:true,subtree:true}); };
if(document.readyState!=='loading') setTimeout(boot,400);
else document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,400);});
}
var __prevTab=window.switchTab;
window.switchTab=function(tabId){
var r=__prevTab?__prevTab.apply(this,arguments):undefined;
if(tabId==='party') setTimeout(refresh,60);
return r;
};
setInterval(refresh, 800);
console.log('🐧 編成統一パッチ（並び替え統一＋Lv連動＋攻撃実数値）適用完了');
})();
// ==========================================================================
// 📚 統合図鑑パッチ（旧3パッチの代わり・これ1本）
//    ① ガシャのプールと図鑑を完全連結＝入手したキャラ/武器/防具だけが図鑑に出る
//    ② 攻撃/防御/HPを「数値」で表示（×1.0廃止）
//    ③ 強化Lvと数値を連結（Lv×1%で数値が伸びる）
//    ④ 敵は遭遇後のみ記録・表示
//    ⑤ 切替は同期描画＝敵図鑑が一瞬出て消える現象を根治
//    ※ app.js / fix.js / style.css / index.html は不変更
// ==========================================================================
(function applyUnifiedDexPatch() {
"use strict";
if (window.__unifiedDexApplied) return;
window.__unifiedDexApplied = true;

var RAR = {
C:{label:'コモン',glow:'148,163,184',ink:'#0b0e14'},
UC:{label:'アンコモン',glow:'34,211,238',ink:'#04201f'},
R:{label:'レア',glow:'249,115,22',ink:'#2a0f02'},
SR:{label:'スーパーレア',glow:'251,191,36',ink:'#1a1206'}
};
/* ガシャのプールと完全一致させる＝入手した物が必ず図鑑に出る */
var CHARS = [
{id:'tangon',name:'タンゴン',emoji:'🐧',img:'tangon.png',rarity:'SR',hp:3500,atk:300,skill:'味方HP上限増加',ultimate:'タンゴフラッシュ',desc:'薔薇をくわえてタンゴを踊る伝説の修行者。'},
{id:'ch_r01',name:'炎騎士',emoji:'🔥',rarity:'R',hp:2800,atk:220,skill:'火炎斬り',ultimate:'業火の乱舞',desc:'炎を纏う騎士。'},
{id:'ch_uc01',name:'見習い魔導士',emoji:'🧙',rarity:'UC',hp:1200,atk:140,skill:'魔力の矢',ultimate:'詠唱加速',desc:'見習いの魔導士。'},
{id:'ch_c01',name:'門番',emoji:'💂',rarity:'C',hp:800,atk:90,skill:'堅守',ultimate:'体当たり',desc:'頑丈な門番。'}
];
var WEAPONS = [
{id:'fire_sword',name:'業火の大剣',emoji:'🔥🗡️',rarity:'R',atk:150,desc:'炎を纏う大剣。'},
{id:'wp_uc01',name:'短剣',emoji:'🗡️',rarity:'UC',atk:80,desc:'扱いやすい短剣。'},
{id:'wp_c01',name:'棍棒',emoji:'🏏',rarity:'C',atk:40,desc:'素朴な棍棒。'}
];
var ARMORS = [
{id:'cosmic_shield',name:'星屑の盾',emoji:'🔮🛡️',rarity:'R',def:80,desc:'星の欠片の盾。'},
{id:'ar_uc01',name:'軽鎧',emoji:'🥋',rarity:'UC',def:45,desc:'動きやすい軽鎧。'},
{id:'ar_c01',name:'布盾',emoji:'🛡️',rarity:'C',def:20,desc:'布の盾。'}
];
var ENEMIES = [
{id:'goblin',name:'ゴブリン歩兵',emoji:'👺',rarity:'C',hp:2400,atk:220},
{id:'slime',name:'酸性スライム',emoji:'🟢',rarity:'C',hp:2000,atk:180},
{id:'bat',name:'洞窟コウモリ',emoji:'🦇',rarity:'C',hp:1800,atk:240},
{id:'orc',name:'オーク戦士',emoji:'👹',rarity:'UC',hp:4200,atk:340},
{id:'spider',name:'毒針アラクネ',emoji:'🕷️',rarity:'UC',hp:3800,atk:380},
{id:'wraith',name:'彷徨う亡霊',emoji:'👻',rarity:'UC',hp:3600,atk:400},
{id:'drake',name:'炎翼ドレイク',emoji:'🐲',rarity:'R',hp:8200,atk:560},
{id:'golem',name:'魔導ゴーレム',emoji:'🗿',rarity:'R',hp:9600,atk:480},
{id:'lich',name:'氷獄のリッチ',emoji:'🧙',rarity:'SR',hp:16000,atk:720},
{id:'bahamut',name:'終焉竜バハムート',emoji:'🐉',rarity:'SR',hp:20000,atk:820}
];

function st(){return (typeof userStats!=='undefined'&&userStats&&typeof userStats==='object')?userStats:{};}
function owned(k){var a=st()['gacha_inv_'+k];return Array.isArray(a)?a:[];}
function dexEnemy(){var a=st().dex_enemy;return Array.isArray(a)?a:[];}
function enhLv(id){var o=st().gacha_enhance||{};return o[id]||0;}
function PU(){return window.__partyUi||(window.__partyUi={cat:'char',search:'',rarity:'ALL',sort:'no'});}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
/* 強化Lvで数値を伸ばす（Lv×1%） */
function boost(v,lv){return Math.round(v*(1+lv/100));}

function charCard(c){
var r=RAR[c.rarity]||RAR.C, lv=enhLv(c.id);
var hp=boost(c.hp,lv), atk=boost(c.atk,lv);
var active=(typeof activeCharacter!=='undefined'&&activeCharacter===c.id);
return '<div class="pty-card'+(active?' is-active':'')+'" style="--pty-glow:rgba('+r.glow+',.7)" data-card="char_'+c.id+'">'+
'<span class="pty-card-chev">▼</span>'+
'<div class="pty-card-emblem">'+(c.img?'<img src="'+esc(c.img)+'" onerror="this.style.display=\'none\';this.parentNode.textContent=\''+c.emoji+'\';">':c.emoji)+'</div>'+
'<div class="pty-card-body">'+
'<div class="pty-card-top"><span class="pty-card-name">'+esc(c.name)+'</span><span class="pty-rbadge" style="color:'+r.ink+';background:linear-gradient(180deg,rgba('+r.glow+',.95),rgba('+r.glow+',.7))">'+esc(r.label)+'</span>'+(active?'<span class="pty-equipped">編成中</span>':'')+'</div>'+
'<div class="pty-stats"><span class="pty-stat">❤️ HP <b>'+hp+'</b></span><span class="pty-stat">⚔️ 攻撃 <b>'+atk+'</b></span><span class="pty-stat up">Lv.'+lv+'</span></div>'+
'<div class="pty-detail"><div class="pty-detail-inner">'+esc(c.desc)+'</div></div>'+
'<div class="pty-card-actions"><button type="button" class="pty-btn" data-pcxenh="'+esc(c.id)+'">⚒️ 強化する</button></div>'+
'</div></div>';
}
function weaponCard(w){
var r=RAR[w.rarity]||RAR.C;
var active=(typeof activeWeapon!=='undefined'&&activeWeapon===w.id);
return '<div class="pty-card'+(active?' is-active':'')+'" style="--pty-glow:rgba('+r.glow+',.6)" data-card="weapon_'+w.id+'">'+
'<div class="pty-card-emblem">'+w.emoji+'</div>'+
'<div class="pty-card-body"><div class="pty-card-top"><span class="pty-card-name">'+esc(w.name)+'</span><span class="pty-rbadge" style="color:'+r.ink+';background:rgba('+r.glow+',.8)">'+esc(r.label)+'</span>'+(active?'<span class="pty-equipped">装備中</span>':'')+'</div>'+
'<div class="pty-stats"><span class="pty-stat">⚔️ 攻撃 <b>+'+w.atk+'</b></span></div>'+
'<div class="pty-detail"><div class="pty-detail-inner">'+esc(w.desc)+'</div></div></div></div>';
}
function armorCard(a){
var r=RAR[a.rarity]||RAR.C;
var active=(typeof activeArmor!=='undefined'&&activeArmor===a.id);
return '<div class="pty-card'+(active?' is-active':'')+'" style="--pty-glow:rgba('+r.glow+',.55)" data-card="armor_'+a.id+'">'+
'<div class="pty-card-emblem">'+a.emoji+'</div>'+
'<div class="pty-card-body"><div class="pty-card-top"><span class="pty-card-name">'+esc(a.name)+'</span><span class="pty-rbadge" style="color:'+r.ink+';background:rgba('+r.glow+',.8)">'+esc(r.label)+'</span>'+(active?'<span class="pty-equipped">装備中</span>':'')+'</div>'+
'<div class="pty-stats"><span class="pty-stat">🛡️ 防御 <b>+'+a.def+'</b></span></div>'+
'<div class="pty-detail"><div class="pty-detail-inner">'+esc(a.desc)+'</div></div></div></div>';
}
function enemyCard(e){
var r=RAR[e.rarity]||RAR.C;
return '<div class="pty-card" style="--pty-glow:rgba('+r.glow+',.7)" data-card="enemy_'+e.id+'">'+
'<div class="pty-card-emblem">'+e.emoji+'</div>'+
'<div class="pty-card-body"><div class="pty-card-top"><span class="pty-card-name">'+esc(e.name)+'</span><span class="pty-rbadge" style="color:'+r.ink+';background:rgba('+r.glow+',.8)">'+esc(r.label)+'</span></div>'+
'<div class="pty-stats"><span class="pty-stat">❤️ HP <b>'+e.hp.toLocaleString()+'</b></span><span class="pty-stat">⚔️ 攻撃 <b>'+e.atk+'</b></span></div></div></div>';
}

/* ---------- 描画（同期＝切替時に他が出ない） ---------- */
function renderDex(){
var list=document.getElementById('ptyList'); if(!list) return;
var pu=PU(), q=(pu.search||'').toLowerCase(), html='';
if(pu.cat==='char'){
html=CHARS.filter(function(c){return owned('char').indexOf(c.id)>=0&&(!q||c.name.toLowerCase().indexOf(q)>=0);}).map(charCard).join('')||'<div class="pty-empty">ガシャでキャラを入手すると記録される。</div>';
}else if(pu.cat==='weapon'){
html=WEAPONS.filter(function(w){return owned('weapon').indexOf(w.id)>=0&&(!q||w.name.toLowerCase().indexOf(q)>=0);}).map(weaponCard).join('')||'<div class="pty-empty">ガシャで武器を入手すると記録される。</div>';
}else if(pu.cat==='armor'){
html=ARMORS.filter(function(a){return owned('armor').indexOf(a.id)>=0&&(!q||a.name.toLowerCase().indexOf(q)>=0);}).map(armorCard).join('')||'<div class="pty-empty">ガシャで防具を入手すると記録される。</div>';
}else{
var de=dexEnemy();
html=ENEMIES.filter(function(e){return de.indexOf(e.id)>=0&&(pu.rarity==='ALL'||e.rarity===pu.rarity)&&(!q||e.name.toLowerCase().indexOf(q)>=0);}).map(enemyCard).join('')||'<div class="pty-empty">バトルで遭遇した敵のみ記録される。</div>';
}
list.classList.remove('dx2-active');
list.innerHTML=html;
}

/* ---------- 旧ハンドラを止めつつ同期で切替 ---------- */
document.addEventListener('click',function(e){
var t=e.target; if(!t||!t.closest)return;
var pill=t.closest('[data-pill]');
if(pill){ e.stopPropagation(); e.preventDefault(); PU().cat=pill.getAttribute('data-pill'); renderDex(); return; }
var rar=t.closest('[data-rarity]');
if(rar){ e.stopPropagation(); e.preventDefault(); PU().rarity=rar.getAttribute('data-rarity'); renderDex(); return; }
var enh=t.closest('[data-pcxenh]');
if(enh){ e.stopPropagation(); var id=enh.getAttribute('data-pcxenh');
  var b=enhLv(id); try{ if(window.gachaEnhance)window.gachaEnhance(id);}catch(e2){}
  if(enhLv(id)>b)sparkAt(enh); else shakeAt(enh);
  renderDex(); return; }
var card=t.closest('[data-card]');
if(card){ card.classList.toggle('open'); }
},true);
var searchEl=null;
function bindSearch(){
var inp=document.getElementById('ptySearch');
if(inp&&inp!==searchEl){ searchEl=inp;
inp.addEventListener('input',function(){ PU().search=inp.value; renderDex(); },true);
}
}

/* ---------- 火花/シェイク ---------- */
function sparkAt(el){
if(!el||!el.getBoundingClientRect)return;
var r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
var cols=['rgba(251,191,36,.95)','rgba(52,231,228,.9)','rgba(255,255,255,.9)'];
for(var i=0;i<14;i++){(function(i){
var p=document.createElement('div');var sz=4+Math.round(Math.random()*5);
var a=Math.random()*Math.PI*2,d=30+Math.random()*70;
p.style.cssText='position:fixed;border-radius:50%;z-index:9999;pointer-events:none;mix-blend-mode:screen;width:'+sz+'px;height:'+sz+'px;left:'+cx+'px;top:'+cy+'px;background:radial-gradient(circle,'+cols[i%3]+',transparent 70%);transform:translate(-50%,-50%);transition:transform .6s,opacity .6s;';
document.body.appendChild(p);
requestAnimationFrame(function(){p.style.transform='translate(calc(-50% + '+(Math.cos(a)*d)+'px),calc(-50% + '+(Math.sin(a)*d)+'px)) scale(.3)';p.style.opacity='0';});
setTimeout(function(){if(p.parentNode)p.parentNode.removeChild(p);},650);
})(i);}
}
function shakeAt(el){var c=(el.closest&&el.closest('.pty-card'))||el;if(!c)return;c.style.animation='pcxShake .4s ease';setTimeout(function(){c.style.animation='';},420);}

/* ---------- 遭遇記録（協力バトル中） ---------- */
function recordEncounter(){
try{
if(typeof currentMultiMode!=='undefined'&&currentMultiMode!=='coop')return;
var play=document.getElementById('multi-battle-play-screen');
if(!play||play.style.display==='none')return;
var m2=window.__multi2; if(!m2||!m2.current||!m2.current.id)return;
var id=m2.current.id,s=st();
var arr=Array.isArray(s.dex_enemy)?s.dex_enemy:(s.dex_enemy=[]);
if(arr.indexOf(id)<0){arr.push(id);try{if(window.saveUserStats)window.saveUserStats();}catch(e){}}
}catch(e){}
}

/* ---------- 起動/監視 ---------- */
function tick(){ recordEncounter(); bindSearch();
var list=document.getElementById('ptyList');
if(list&&!list.querySelector('.pcv-lock')){ /* 旧パッチが残っていても上書きで正す */ }
}
setInterval(tick,400);
var __prevTab=window.switchTab;
window.switchTab=function(t){var r=__prevTab?__prevTab.apply(this,arguments):undefined; if(t==='party')setTimeout(function(){bindSearch();renderDex();},40); return r;};
(function(){function run(){bindSearch(); if(PU().cat)renderDex();}
if(document.readyState!=='loading')setTimeout(run,450); else document.addEventListener('DOMContentLoaded',function(){setTimeout(run,450);});})();
console.log('📚 統合図鑑パッチ適用完了');
})();
// ==========================================================================
// 💾 理解度復元＆再消失防止パッチ（multi.js 末尾追記）
//    原因:単語テキスト/意味の更新で保存時sigが合わず⚪︎△✕が全「-」表示
//         （データはローカル/Firebaseに生存）
//    ① sig不一致でも意味ID/順序で復元（寛容apply）
//    ② 進捗が空なら旧マスター(ステータス付き)から救出
//    ③ 復元後すぐ新sigで保存→次回から消えない
//    ④ applyUserProgressToVocabList を恒久的に寛容版へ
// ==========================================================================
(function applyVocabProgressRestorePatch(){
"use strict";
if (window.__pcvRestoreApplied) return;
window.__pcvRestoreApplied = true;

function bkNow(){ return (typeof currentTextbook!=='undefined' && currentTextbook)? currentTextbook : 'default'; }
function uidNow(){ return (typeof myId!=='undefined' && myId && myId!=='GUEST-000')? myId : null; }

function progHasStatus(prog){
  if(!prog) return false;
  for(var k in prog){
    var p=prog[k]; if(!p) continue;
    if(p.status && p.status!=='none') return true;
    if(p.meanings){ for(var m in p.meanings){ if(p.meanings[m]&&p.meanings[m].status&&p.meanings[m].status!=='none') return true; } }
  }
  return false;
}
function wordsHasStatus(words){
  return (words||[]).some(function(w){
    return w && ((w.status&&w.status!=='none') || (w.meanings||[]).some(function(m){return m.status&&m.status!=='none';}));
  });
}

/* ---- 寛容apply:sig不一致でも意味ID/順序で復元 ---- */
function lenientApply(){
  if (typeof vocabList==='undefined' || !vocabList) return;
  var prog = (typeof currentUserVocabProgress!=='undefined' && currentUserVocabProgress)? currentUserVocabProgress : {};
  vocabList.forEach(function(w){
    if(!w) return;
    var p = prog[String(w.num)];
    if(!p) return;
    var keys = p.meanings? Object.keys(p.meanings):[];
    (w.meanings||[]).forEach(function(m, idx){
      var mp = (p.meanings && (p.meanings[m.id] || (keys[idx]? p.meanings[keys[idx]]:null))) || null;
      if(mp){
        if(mp.status) m.status = mp.status;
        if(Array.isArray(mp.history)&&mp.history.length) m.history = mp.history.slice(-20);
      }
    });
    if(typeof window.wordOverallStatus==='function'){ w.status = window.wordOverallStatus(w); }
    else if(p.status){ w.status = p.status; }
    if(Array.isArray(p.history)&&p.history.length) w.history = p.history.slice(-20);
  });
  try{ if(typeof window.rebuildVocabStemIndex==='function') window.rebuildVocabStemIndex(); }catch(e){}
  try{
    if(typeof userStats==='object'&&userStats){
      userStats.vocab_fixed = vocabList.filter(function(w){ return w.meanings && w.meanings.some(function(m){return m.status==='ok';}); }).length;
    }
  }catch(e){}
}

/* ---- 救出:進捗が空なら旧マスター(ステータス付き)から復元 ---- */
function buildProg(words){
  var prog={};
  (words||[]).forEach(function(w){
    if(!w) return;
    var meanings={};
    (w.meanings||[]).forEach(function(m){ meanings[m.id]={status:(m.status||'none'), history:Array.isArray(m.history)?m.history.slice(-20):[]}; });
    prog[String(w.num)]={
      sig:(typeof window.buildWordSignature==='function')?window.buildWordSignature(w):String(w.num),
      status:(w.status||'none'),
      history:Array.isArray(w.history)?w.history.slice(-20):[],
      meanings:meanings
    };
  });
  return prog;
}
function recoverLocal(){
  var uid=uidNow(); if(!uid) return false;
  var bk=bkNow(); var raw=null;
  try{ raw=localStorage.getItem('core_v4_custom_words_'+uid+'_'+bk); }catch(e){}
  if(!raw){ try{ raw=localStorage.getItem('core_v4_cache_'+bk); }catch(e){} }
  if(!raw) return false;
  var words=null; try{ words=JSON.parse(raw); }catch(e){ return false; }
  if(!wordsHasStatus(words)) return false;
  currentUserVocabProgress = buildProg(words);
  return true;
}
function recoverCloud(cb){
  var uid=uidNow();
  if(!uid || !window.db || !window.fbGetDoc || !window.fbDoc){ cb(false); return; }
  try{
    window.fbGetDoc(window.fbDoc(window.db,'shared','vocab_'+bkNow())).then(function(snap){
      var words=(snap&&snap.exists()&&snap.data()&&snap.data().custom_words)?snap.data().custom_words:null;
      if(wordsHasStatus(words)){ currentUserVocabProgress=buildProg(words); cb(true); } else cb(false);
    }).catch(function(){ cb(false); });
  }catch(e){ cb(false); }
}

/* ---- 恒久:applyを寛容版へ（今後の再消失を防止） ---- */
window.applyUserProgressToVocabList = function(){ lenientApply(); };

function finish(){
  try{ if(typeof window.renderVocabList==='function') window.renderVocabList(); }catch(e){}
  try{ if(typeof window.updateReaderWordColors==='function') window.updateReaderWordColors(); }catch(e){}
  try{ if(typeof window.saveUserVocabProgress==='function') window.saveUserVocabProgress(); }catch(e){}
}
function doRestore(){
  if(progHasStatus(currentUserVocabProgress)){ lenientApply(); finish(); }
  else if(recoverLocal()){ lenientApply(); finish(); }
  else recoverCloud(function(ok){ if(ok){ lenientApply(); finish(); } });
}

/* ---- 起動/タブ切替/教材切替の全てで復元を保証 ---- */
var __origLoadBook = window.loadCurrentTextbookData;
if (typeof __origLoadBook==='function'){
  window.loadCurrentTextbookData = function(){
    var r = __origLoadBook.apply(this, arguments);
    if(r && r.then){ r.then(function(){ if(progHasStatus(currentUserVocabProgress)){ lenientApply(); } }).catch(function(){}); }
    return r;
  };
}
var __prevTab = window.switchTab;
window.switchTab = function(tabId){
  var r = __prevTab ? __prevTab.apply(this, arguments) : undefined;
  if(tabId==='vocab'){ setTimeout(doRestore, 150); }
  return r;
};
(function boot(){
  function run(){ doRestore(); }
  if(document.readyState!=='loading') setTimeout(run, 1200);
  else document.addEventListener('DOMContentLoaded', function(){ setTimeout(run, 1200); });
})();
console.log('💾 理解度復元＆再消失防止パッチ 適用完了');
})();
// ==========================================================================
// 📚 理解度「‑」根治パッチ（署名ズレでも復元して正しく保存し直す）
//    ・sig が合わなくても 意味ID 単位で ⚪︎/△/✕ を復元
//    ・復元後に正しい sig を付けて保存（次回からズレない）
//    ・読込完了後と教材切替後に自動で再適用＋再描画
//    ※ app.js/fix.js/style.css/index.html は不変更／末尾追記のみ
// ==========================================================================
(function () {
"use strict";
if (window.__vocabSigFallbackApplied) return;
window.__vocabSigFallbackApplied = true;

// ---- applyUserProgressToVocabList を「署名ズレ許容」で上書き ----
window.applyUserProgressToVocabList = function () {
var progress = (typeof currentUserVocabProgress !== 'undefined' && currentUserVocabProgress) ? currentUserVocabProgress : {};
var changed = false;
vocabList = vocabList.map(function (w) {
w = window.migrateVocabData([w])[0];
var key = String(w.num);
var p = progress[key];
w.status = "none";
w.history = [];
w.meanings = (w.meanings || []).map(function (m) {
return { id: m.id, text: m.text, status: "none", history: [] };
});
if (p) {
// 署名に関係なく「意味ID」で状態を復元
w.meanings = w.meanings.map(function (m, idx) {
var mp = null;
if (p.meanings) mp = p.meanings[m.id] || p.meanings[String(w.num) + '-' + idx];
if (!mp && Array.isArray(p.meaningsList)) mp = p.meaningsList[idx];
if (mp) return { id: m.id, text: m.text, status: (mp.status || "none"), history: Array.isArray(mp.history) ? mp.history.slice(-20) : [] };
return m;
});
w.history = Array.isArray(p.history) ? p.history.slice(-20) : [];
w.status = window.wordOverallStatus(w);
p.sig = window.buildWordSignature(w); // 次回ズレないよう更新
changed = true;
}
return w;
});
if (typeof userStats !== 'undefined' && userStats) {
userStats.vocab_fixed = vocabList.filter(function (w) {
return w.meanings && w.meanings.some(function (m) { return m.status === 'ok'; });
}).length;
}
if (typeof window.rebuildVocabStemIndex === 'function') window.rebuildVocabStemIndex();
if (changed) {
clearTimeout(window.__sigSaveT);
window.__sigSaveT = setTimeout(function () {
try { if (typeof window.saveUserVocabProgress === 'function') window.saveUserVocabProgress(); } catch (e) {}
}, 800);
}
};

// ---- 読込後・教材切替後に自動で再適用＋再描画 ----
function reapply() {
try {
if (typeof window.loadUserVocabProgress === 'function' && typeof currentTextbook !== 'undefined') {
window.loadUserVocabProgress(currentTextbook).then(function () {
window.applyUserProgressToVocabList();
if (typeof window.renderVocabList === 'function') window.renderVocabList();
if (typeof window.updateReaderWordColors === 'function') window.updateReaderWordColors();
}).catch(function () {});
} else {
window.applyUserProgressToVocabList();
if (typeof window.renderVocabList === 'function') window.renderVocabList();
if (typeof window.updateReaderWordColors === 'function') window.updateReaderWordColors();
}
} catch (e) {}
}
setTimeout(reapply, 600);
setTimeout(reapply, 1800);
var prevSwitch = window.switchTextbookContext;
if (typeof prevSwitch === 'function' && !prevSwitch.__sigHook) {
window.switchTextbookContext = function () {
var r = prevSwitch.apply(this, arguments);
setTimeout(reapply, 300);
return r;
};
window.switchTextbookContext.__sigHook = true;
}
console.log('📚 理解度「‑」根治パッチ（署名ズレ復元）適用完了');
})();
// ==========================================================================
// 📚 理解度復元パッチ（統合パッチで消えた⚪︎△✕を古い保存先から非破壊復元）
//    ・古い保存先(custom_words_…/Firebase共有)に残る⚪︎△✕を
//      新しい保存先(user_vocab_progress_…)へ「無い語だけ」埋める
//    ・今のデータを上書きしない／1冊ずつ1回だけ実行（ガード付き）
//    ※ app.js/fix.js/style.css/index.html は不変更。multi.js末尾に追記
// ==========================================================================
(function applyProgressRecoveryPatch() {
"use strict";
if (window.__progressRecoveryApplied) return;
window.__progressRecoveryApplied = true;

function loggedIn() { return (typeof myId !== 'undefined') && myId && myId !== 'GUEST-000'; }
function bookKeyNow() { return (typeof currentTextbook !== 'undefined' && currentTextbook) ? currentTextbook : 'default'; }

function hasStatus(w) {
if (!w) return false;
if (w.status && w.status !== 'none') return true;
if (Array.isArray(w.history) && w.history.length) return true;
if (Array.isArray(w.meanings)) {
for (var i = 0; i < w.meanings.length; i++) {
var m = w.meanings[i];
if (m && ((m.status && m.status !== 'none') || (Array.isArray(m.history) && m.history.length))) return true;
}
}
return false;
}

function readOldLocal(bookKey) {
var uid = (typeof myId !== 'undefined' && myId) ? myId : 'GUEST-000';
var keys = ['core_v4_custom_words_' + uid + '_' + bookKey, 'core_v4_cache_' + bookKey];
for (var i = 0; i < keys.length; i++) {
try {
var raw = localStorage.getItem(keys[i]);
if (raw) { var w = JSON.parse(raw); if (Array.isArray(w) && w.length) return w; }
} catch (e) {}
}
return null;
}

function doRecover(oldWords, bookKey) {
var byNum = {};
oldWords.forEach(function (w) { if (w && hasStatus(w)) byNum[String(w.num)] = w; });
if (!Object.keys(byNum).length) return 0;

var cur = (typeof currentUserVocabProgress !== 'undefined' && currentUserVocabProgress) ? currentUserVocabProgress : {};
var changed = 0;
var list = (typeof vocabList !== 'undefined' && vocabList) ? vocabList : [];
list.forEach(function (w) {
var key = String(w.num);
var old = byNum[key];
if (!old) return;
var curP = cur[key];
var curHas = curP && ((curP.status && curP.status !== 'none') ||
(curP.meanings && Object.keys(curP.meanings).some(function (k) { var m = curP.meanings[k]; return m && m.status && m.status !== 'none'; })));
if (curHas) return; // 今のデータを絶対に上書きしない
var meanings = {};
(w.meanings || []).forEach(function (m, i) {
var om = null;
if (Array.isArray(old.meanings)) {
om = old.meanings.filter(function (m2) { return m2 && m.id && m2.id === m.id; })[0] || old.meanings[i];
}
meanings[m.id] = {
status: om ? (om.status || 'none') : 'none',
history: (om && Array.isArray(om.history)) ? om.history : (Array.isArray(old.history) ? old.history : [])
};
});
cur[key] = {
sig: (typeof window.buildWordSignature === 'function') ? window.buildWordSignature(w) : String(w.num),
status: old.status || 'none',
history: Array.isArray(old.history) ? old.history : [],
meanings: meanings
};
changed++;
});
if (!changed) return 0;

currentUserVocabProgress = cur;
try { localStorage.setItem(window.getVocabProgressStorageKey(bookKey), JSON.stringify(cur)); } catch (e) {}
if (window.db && window.fbSetDoc && window.fbDoc && loggedIn()) {
try {
window.fbSetDoc(window.fbDoc(window.db, 'users', myId, 'vocabProgress', bookKey),
{ words: cur, wordsJson: JSON.stringify(cur), updatedAt: new Date().toISOString() }, { merge: true })
.catch(function () {});
} catch (e) {}
}
if (typeof window.applyUserProgressToVocabList === 'function') window.applyUserProgressToVocabList();
if (typeof window.renderVocabList === 'function') window.renderVocabList();
return changed;
}

function recover(bookKey) {
if (!loggedIn()) return;
var guard = '__progRecovered_' + bookKey;
try { if (localStorage.getItem(guard)) return; } catch (e) {}
var old = readOldLocal(bookKey);
if (old) {
var n = doRecover(old, bookKey);
try { localStorage.setItem(guard, '1'); } catch (e) {}
if (n && window.showToast) window.showToast('📚 理解度を ' + n + ' 語復元しました', 'ok');
return;
}
if (window.db && window.fbGetDoc && window.fbDoc) {
window.fbGetDoc(window.fbDoc(window.db, 'shared', 'vocab_' + bookKey)).then(function (snap) {
var cw = (snap && snap.exists() && snap.data()) ? snap.data().custom_words : null;
var n = cw ? doRecover(cw, bookKey) : 0;
try { localStorage.setItem(guard, '1'); } catch (e) {}
if (n && window.showToast) window.showToast('📚 理解度を ' + n + ' 語復元しました', 'ok');
}).catch(function () {});
}
}

/* 起動時・教材切替時に復元を試行 */
var __prevLoad = window.loadCurrentTextbookData;
if (typeof __prevLoad === 'function' && !__prevLoad.__recoveryWrapped) {
window.loadCurrentTextbookData = function () {
var r = __prevLoad.apply(this, arguments);
if (r && r.then) r.then(function () { setTimeout(function () { recover(bookKeyNow()); }, 120); });
else setTimeout(function () { recover(bookKeyNow()); }, 120);
return r;
};
window.loadCurrentTextbookData.__recoveryWrapped = true;
}
var __prevSwitch = window.switchTextbookContext;
if (typeof __prevSwitch === 'function' && !__prevSwitch.__recoveryWrapped) {
window.switchTextbookContext = function () {
var r = __prevSwitch.apply(this, arguments);
setTimeout(function () { recover(bookKeyNow()); }, 150);
return r;
};
window.switchTextbookContext.__recoveryWrapped = true;
}
if (document.readyState !== 'loading') setTimeout(function () { recover(bookKeyNow()); }, 900);
else document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { recover(bookKeyNow()); }, 900); });

console.log('📚 理解度復元パッチ適用完了');
})();
// ==========================================================================
// 📚 理解度・署名ズレ根治＆復元パッチ（推測排除・保存場所を全走査）
//    ・理解度は user_vocab_progress(ローカル+Firebase) にのみ存在
//    ・読込時の sig 一致必須仕様を無視し「単語番号+意味ID/順番」で復元
//    ・復元後、正しい sig で保存し直し→次回以降ズレない
//    ・復元件数をトースト+コンソールに報告（0件=データ無し確定）
//    ※ app.js / fix.js / style.css / index.html は不変更
// ==========================================================================
(function applyVocabRestoreRobust() {
"use strict";
if (window.__vocabRestoreRobust) return;
window.__vocabRestoreRobust = true;

function bookKey() { return (typeof currentTextbook !== 'undefined' && currentTextbook) ? currentTextbook : 'default'; }
function uid() { return (typeof myId !== 'undefined' && myId) ? myId : 'GUEST-000'; }

/* ---------- バックアップ全箇所を収集 ---------- */
function gather(cb) {
var key = bookKey(), id = uid(), out = [], pend = 0;
function push(n, w) { out.push({ n: n, w: w }); if (--pend <= 0) cb(out); }
pend++; try { push('local_progress', JSON.parse(localStorage.getItem('core_v4_user_vocab_progress_' + id + '_' + key) || 'null')); } catch (e) { push('local_progress', null); }
pend++; try { push('local_custom', JSON.parse(localStorage.getItem('core_v4_custom_words_' + id + '_' + key) || 'null')); } catch (e) { push('local_custom', null); }
pend++; try { push('local_cache', JSON.parse(localStorage.getItem('core_v4_cache_' + key) || 'null')); } catch (e) { push('local_cache', null); }
pend++;
if (window.db && window.fbGetDoc && window.fbDoc) {
window.fbGetDoc(window.fbDoc(window.db, 'shared', 'vocab_' + key)).then(function (s) {
push('fb_shared', (s && s.exists() && s.data() && s.data().custom_words) ? s.data().custom_words : null);
}).catch(function () { push('fb_shared', null); });
} else push('fb_shared', null);
pend++;
if (window.db && window.fbGetDoc && window.fbDoc && id !== 'GUEST-000') {
window.fbGetDoc(window.fbDoc(window.db, 'users', id, 'vocabProgress', key)).then(function (s) {
var w = null;
if (s && s.exists() && s.data()) { var d = s.data(); if (d.wordsJson) { try { w = JSON.parse(d.wordsJson); } catch (e) {} } else if (d.words) w = d.words; }
push('fb_progress', w);
}).catch(function () { push('fb_progress', null); });
} else push('fb_progress', null);
}

/* ---------- 状態あり件数を数える ---------- */
function countStat(w) {
if (!w) return 0; var c = 0;
if (Array.isArray(w)) { w.forEach(function (x) { if (!x) return; if (x.status && x.status !== 'none') c++; (x.meanings || []).forEach(function (m) { if (m && m.status && m.status !== 'none') c++; }); }); }
else if (typeof w === 'object') { Object.keys(w).forEach(function (k) { var p = w[k]; if (!p) return; if (p.status && p.status !== 'none') c++; if (p.meanings) Object.keys(p.meanings).forEach(function (mid) { var m = p.meanings[mid]; if (m && m.status && m.status !== 'none') c++; }); }); }
return c;
}
/* ---------- num→{意味ID/順番別status}マップ ---------- */
function buildMap(src) {
var map = {}; if (!src) return map;
if (Array.isArray(src)) {
src.forEach(function (w) { if (!w) return; var mb = {}, mi = [];
(w.meanings || []).forEach(function (m) { if (!m) return; mb[String(m.id)] = { s: m.status || 'none', h: m.history || [] }; mi.push({ s: m.status || 'none', h: m.history || [] }); });
map[String(w.num)] = { s: w.status || 'none', mb: mb, mi: mi }; });
} else if (typeof src === 'object') {
Object.keys(src).forEach(function (k) { var p = src[k]; if (!p) return; var mb = {}, mi = [];
if (p.meanings) Object.keys(p.meanings).forEach(function (mid) { var m = p.meanings[mid]; mb[String(mid)] = { s: m.status || 'none', h: m.history || [] }; mi.push({ s: m.status || 'none', h: m.history || [] }); });
map[String(k)] = { s: p.status || 'none', mb: mb, mi: mi }; });
}
return map;
}

function restore() {
try {
if (typeof vocabList === 'undefined' || !vocabList || !vocabList.length) return;
gather(function (sources) {
var best = null, bc = -1;
sources.forEach(function (s) { var c = countStat(s.w); if (c > bc) { bc = c; best = s; } console.log('[復元] ' + s.n + ': 状態あり ' + c + '件'); });
if (!best || bc <= 0) { console.warn('[復元] バックアップに理解度が見つかりません（データ消失確定）'); return; }
var map = buildMap(best.w), changed = 0;
vocabList.forEach(function (w) {
if (!w) return; var src = map[String(w.num)]; if (!src) return;
(w.meanings || []).forEach(function (m, idx) {
if (!m) return;
var sm = src.mb[String(m.id)] || src.mi[idx] || null;
if (sm && sm.s && sm.s !== 'none' && (!m.status || m.status === 'none')) { m.status = sm.s; if (sm.h && sm.h.length) m.history = sm.h; changed++; }
});
if (src.s && src.s !== 'none' && (!w.status || w.status === 'none')) w.status = src.s;
});
if (changed > 0) {
try { if (window.saveVocabToStorage) window.saveVocabToStorage(); } catch (e) {}
try { if (window.saveUserVocabProgress) window.saveUserVocabProgress(); } catch (e) {}
try { if (window.renderVocabList) window.renderVocabList(); } catch (e) {}
try { if (window.showToast) window.showToast('📚 理解度を ' + changed + ' 件復元しました', 'ok'); } catch (e) {}
console.log('[復元] ' + best.n + ' から ' + changed + ' 件復元しました');
}
});
} catch (e) { console.error('[復元] error', e); }
}

/* 読込完了後と教材切替後に実行 */
var prev = window.loadCurrentTextbookData;
if (typeof prev === 'function' && !prev.__restoreWrapped) {
window.loadCurrentTextbookData = function () {
var r = prev.apply(this, arguments);
if (r && r.then) r.then(function () { setTimeout(restore, 100); }); else setTimeout(restore, 200);
return r;
};
prev.__restoreWrapped = true;
}
if (document.readyState !== 'loading') setTimeout(restore, 800);
else document.addEventListener('DOMContentLoaded', function () { setTimeout(restore, 800); });
console.log('📚 理解度・署名ズレ根治＆復元パッチ 適用完了');
})();
// ==========================================================================
// 🔧 並び替えボタン統一修正パッチ（末尾追記・既存不変更）
//    ① キャラ/敵/装備すべての並び替えチップを統一data属性で再バインド
//    ② チップの見た目（石版風・発光・押下フィードバック）を統一
//    ③ 並び替え結果の即時再描画を保証
//    ④ その他違和感（チップの文字色・サイズ・余白）を修正
// ==========================================================================
(function applySortFixPatch() {
"use strict";
if (window.__sortFixApplied) return;
window.__sortFixApplied = true;

/* ---------- 0. CSS：並び替えチップの統一スタイル ---------- */
(function injectSortFixCss() {
if (document.getElementById('sortFixCss')) return;
var s = document.createElement('style');
s.id = 'sortFixCss';
s.textContent = [
/* 並び替え行のレイアウト修正 */
'#view-party .dx2-sort,#view-party .dx2-sort[style]{display:flex !important;flex-wrap:wrap !important;gap:6px !important;align-items:center !important;justify-content:flex-start !important;margin:4px 0 !important;padding:0 !important;}',
/* チップ本体：石版風の統一デザイン */
'#view-party .dx2-sortchip,#view-party [data-uni-sort],#view-party [data-pcvsort],#view-party [data-dx2sort]{',
'  display:inline-flex !important;align-items:center !important;justify-content:center !important;',
'  font-family:"Noto Sans JP",system-ui,sans-serif !important;',
'  font-size:10px !important;font-weight:800 !important;letter-spacing:.04em !important;',
'  color:#a89880 !important;',
'  background:rgba(0,0,0,.35) !important;',
'  border:1px solid rgba(255,255,255,.18) !important;',
'  border-radius:999px !important;',
'  padding:5px 12px !important;',
'  cursor:pointer !important;',
'  user-select:none !important;-webkit-user-select:none !important;',
'  -webkit-tap-highlight-color:transparent !important;',
'  transition:all .18s ease !important;',
'  white-space:nowrap !important;',
'  line-height:1.2 !important;',
'  text-decoration:none !important;',
'}',
/* ホバー */
'#view-party .dx2-sortchip:hover,#view-party [data-uni-sort]:hover,#view-party [data-pcvsort]:hover,#view-party [data-dx2sort]:hover{',
'  background:rgba(255,255,255,.10) !important;',
'  border-color:rgba(200,144,42,.4) !important;',
'  color:#e8dcc0 !important;',
'}',
/* 押下 */
'#view-party .dx2-sortchip:active,#view-party [data-uni-sort]:active,#view-party [data-pcvsort]:active,#view-party [data-dx2sort]:active{',
'  transform:scale(.93) !important;',
'}',
/* 選択中：金箔の石版 */
'#view-party .dx2-sortchip.on,#view-party [data-uni-sort].on,#view-party [data-pcvsort].on,#view-party [data-dx2sort].on{',
'  color:#1a1206 !important;',
'  background:linear-gradient(180deg,#ffe9a8,#f5c451) !important;',
'  border-color:rgba(255,233,168,.85) !important;',
'  box-shadow:0 0 10px rgba(245,196,81,.45) !important;',
'  text-shadow:none !important;',
'}',
/* インデックス見出し行の整備 */
'#view-party .dx2-index{display:flex !important;align-items:baseline !important;justify-content:space-between !important;gap:8px !important;flex-wrap:wrap !important;padding:2px 2px 0 !important;margin-bottom:6px !important;}',
'#view-party .dx2-index-title{font-family:"Cinzel","Noto Serif JP",serif !important;font-size:11px !important;font-weight:700 !important;letter-spacing:.32em !important;color:#c8902a !important;text-transform:uppercase !important;text-shadow:0 0 10px rgba(200,144,42,.4) !important;}',
'#view-party .dx2-index-count{font-family:"Chakra Petch",ui-monospace,monospace !important;font-size:11px !important;font-weight:600 !important;color:#a89880 !important;}',
'#view-party .dx2-index-count b{color:#f3e5c0 !important;}',
/* 空表示テキスト */
'#view-party .dx2-empty,#view-party .pty-empty,#view-party .gcx-empty{',
'  width:100% !important;text-align:center !important;',
'  font-family:"Noto Sans JP",system-ui,sans-serif !important;',
'  font-size:12px !important;font-weight:600 !important;color:#8a7a5f !important;',
'  padding:28px 16px !important;',
'  border:1px dashed rgba(200,144,42,.3) !important;',
'  border-radius:14px !important;background:rgba(0,0,0,.25) !important;',
'  box-sizing:border-box !important;',
'}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();

/* ---------- 1. 並び替えチップの統一クリックハンドラ ---------- */
function getSortState() {
if (window.__dx2) return window.__dx2;
if (window.__pcv) return window.__pcv;
return (window.__dx2 = { sort: 'no', expanded: {} });
}

function doSort(key) {
var st = getSortState();
st.sort = key;
// 全パッチのソート状態を同期
if (window.__pcv) window.__pcv.sortChar = key;
if (window.__pcv) window.__pcv.sortGear = key;
if (window.__dx2) window.__dx2.sort = key;
if (window.__uniSort) window.__uniSort[charCat()] = key;
refreshCurrentList();
}

function charCat() {
var pu = window.__partyUi;
return (pu && pu.cat) ? pu.cat : 'char';
}

function refreshCurrentList() {
var list = document.getElementById('ptyList');
if (!list) return;
var cat = charCat();
// 各パッチの描画関数を試行
if (cat === 'enemy') {
// 敵図鑑
try { if (window.__dx2Applied) { triggerDx2Render(list); return; } } catch (e) {}
}
// 味方・装備
try { triggerAllyGearRender(list); } catch (e) {}
}

function triggerDx2Render(list) {
// dx2パッチのfiltered2/card2/renderDx2はIIFE内だが、
// 再描画は innerHTML の書き換えトリガーで発火させる
// → 一度 dx2-active を外して再付与で MutationObserver が拾う
list.classList.remove('dx2-active');
void list.offsetWidth;
setTimeout(function() { list.classList.add('dx2-active'); }, 20);
}

function triggerAllyGearRender(list) {
// pcv パッチの onMut が MutationObserver で動く想定
// リストにダミー変化を入れてトリガー
var marker = document.createComment('sort-refresh');
list.appendChild(marker);
setTimeout(function() { if (marker.parentNode) marker.parentNode.removeChild(marker); }, 30);
}

/* ---------- 2. 全チップのクリックをキャプチャで拾う ---------- */
document.addEventListener('click', function(e) {
var t = e.target;
if (!t || !t.closest) return;
// 全パッチの並び替え属性を網羅
var chip = t.closest('[data-uni-sort]') || t.closest('[data-pcvsort]') || t.closest('[data-dx2sort]') || t.closest('.dx2-sortchip[data-dx2sort]');
if (!chip) return;
e.stopPropagation();
e.preventDefault();
var key = chip.getAttribute('data-uni-sort') || chip.getAttribute('data-pcvsort') || chip.getAttribute('data-dx2sort');
if (!key) return;
doSort(key);
// チップの選択状態を即時更新
updateChipVisuals();
}, true);

/* ---------- 3. チップの選択状態を即時同期 ---------- */
function updateChipVisuals() {
var st = getSortState();
var cur = st.sort || 'no';
var allChips = document.querySelectorAll('#view-party [data-uni-sort],#view-party [data-pcvsort],#view-party [data-dx2sort],#view-party .dx2-sortchip');
for (var i = 0; i < allChips.length; i++) {
var c = allChips[i];
var k = c.getAttribute('data-uni-sort') || c.getAttribute('data-pcvsort') || c.getAttribute('data-dx2sort');
if (k === cur) c.classList.add('on');
else c.classList.remove('on');
}
}

/* ---------- 4. 描画後のチップ状態同期（ウォッチドッグ） ---------- */
setInterval(function() {
updateChipVisuals();
// チップがテキストノードだけで span になっていたら button 相当のスタイルを強制付与
var chips = document.querySelectorAll('#view-party .dx2-sortchip,#view-party [data-uni-sort],#view-party [data-pcvsort],#view-party [data-dx2sort]');
for (var i = 0; i < chips.length; i++) {
var c = chips[i];
if (c.tagName !== 'BUTTON' && c.tagName !== 'SPAN') {
c.style.cursor = 'pointer';
}
// role 付与でアクセシビリティも担保
if (!c.getAttribute('role')) c.setAttribute('role', 'button');
}
}, 400);

/* ---------- 5. switchTab ラップ：タブ切替時にチップ状態を再同期 ---------- */
var __prevTabSortFix = window.switchTab;
window.switchTab = function(tabId) {
var r = __prevTabSortFix ? __prevTabSortFix.apply(this, arguments) : undefined;
if (tabId === 'party') {
setTimeout(updateChipVisuals, 80);
setTimeout(updateChipVisuals, 300);
}
return r;
};

/* ---------- 6. 起動時 ---------- */
(function bootSortFix() {
function run() {
updateChipVisuals();
}
if (document.readyState !== 'loading') setTimeout(run, 600);
else document.addEventListener('DOMContentLoaded', function() { setTimeout(run, 600); });
})();

console.log('🔧 並び替えボタン統一修正パッチ適用完了');
})();
// ==========================================================================
// 💾 セーブ/ロードシステム（multi.js 末尾に追記・本体不変更）
//    ・ヘッダーの💾ボタンをタップ → セーブ/ロードのパネルが開く
//    ・セーブ: スロット1 / スロット2 / オートセーブ の3枠
//    ・ロード: 各スロットの日時を確認して復元
//    ・保存対象: 全データ（理解度・ステータス・インベントリ・通貨・設定など全て）
//    ・オートセーブ: 3分ごと＋データ変更後＋ページを閉じる時
//    ・localStorage＋Firebase の二重保存で絶対に消えない
//    ※ app.js / fix.js / style.css / index.html は不変更
// ==========================================================================
(function applySaveSystemPatch() {
"use strict";
if (window.__saveSystemApplied) return;
window.__saveSystemApplied = true;

var SAVE_INTERVAL = 3 * 60 * 1000;
var SLOTS = ['slot1', 'slot2', 'auto'];
var SLOT_NAMES = { slot1: 'セーブ1', slot2: 'セーブ2', auto: 'オートセーブ' };

/* ---------- ヘルパー ---------- */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function uid() {
  return (typeof myId !== 'undefined' && myId && myId !== 'GUEST-000') ? myId : null;
}
function nowDisplay() {
  var d = new Date();
  function p(n) { return (n < 10 ? '0' : '') + n; }
  return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
function saveKey(slot) {
  return 'save_studio_' + uid() + '_' + slot;
}
function toast(msg) {
  try { if (window.showToast) { window.showToast(msg, 'ok'); return; } } catch (e) {}
  try { console.log(msg); } catch (e) {}
}

/* ---------- 全データ収集 ---------- */
function collectAllData() {
  var lsData = {};
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k) continue;
      if (k.indexOf('save_studio_') === 0) continue;
      try { lsData[k] = localStorage.getItem(k); } catch (e) {}
    }
  } catch (e) {}
  var memData = {};
  try { memData.totalExp = (typeof totalExp !== 'undefined') ? totalExp : 0; } catch (e) {}
  try { memData.myName = (typeof myName !== 'undefined') ? myName : ''; } catch (e) {}
  try { memData.myTarget = (typeof myTarget !== 'undefined') ? myTarget : ''; } catch (e) {}
  try { memData.selectedTitle = (typeof selectedTitle !== 'undefined') ? selectedTitle : ''; } catch (e) {}
  try { memData.myFriendList = (typeof myFriendList !== 'undefined') ? myFriendList : []; } catch (e) {}
  try { memData.userStats = (typeof userStats !== 'undefined') ? userStats : {}; } catch (e) {}
  try { memData.todayStudySeconds = (typeof todayStudySeconds !== 'undefined') ? todayStudySeconds : 0; } catch (e) {}
  try { memData.weeklyStudyMinutesLog = (typeof weeklyStudyMinutesLog !== 'undefined') ? weeklyStudyMinutesLog : [0,0,0,0,0,0,0]; } catch (e) {}
  try { memData.lastAccessDateStr = (typeof lastAccessDateStr !== 'undefined') ? lastAccessDateStr : ''; } catch (e) {}
  try { memData.vocabList = (typeof vocabList !== 'undefined') ? vocabList : []; } catch (e) {}
  try { memData.wordMemory = (typeof wordMemory !== 'undefined') ? wordMemory : {}; } catch (e) {}
  try { memData.textHistory = (typeof textHistory !== 'undefined') ? textHistory : []; } catch (e) {}
  try { memData.myBookshelf = (typeof myBookshelf !== 'undefined') ? myBookshelf : []; } catch (e) {}
  try { memData.myFolders = (typeof myFolders !== 'undefined') ? myFolders : []; } catch (e) {}
  try { memData.currentTextbook = (typeof currentTextbook !== 'undefined') ? currentTextbook : ''; } catch (e) {}
  try { memData.textbooksPool = (typeof textbooksPool !== 'undefined') ? textbooksPool : []; } catch (e) {}
  try { memData.activeCharacter = (typeof activeCharacter !== 'undefined') ? activeCharacter : ''; } catch (e) {}
  try { memData.activeWeapon = (typeof activeWeapon !== 'undefined') ? activeWeapon : ''; } catch (e) {}
  try { memData.activeArmor = (typeof activeArmor !== 'undefined') ? activeArmor : ''; } catch (e) {}
  try { memData.geminiApiKey = (typeof geminiApiKey !== 'undefined') ? geminiApiKey : ''; } catch (e) {}
  return { localStorage: lsData, memory: memData };
}

/* ---------- セーブ情報取得 ---------- */
function getSaveInfo(slot) {
  var id = uid(); if (!id) return null;
  var raw = localStorage.getItem(saveKey(slot));
  if (!raw) return null;
  try {
    var s = JSON.parse(raw);
    return { savedAtDisplay: s.savedAtDisplay || '不明' };
  } catch (e) { return null; }
}

/* ---------- セーブ実行 ---------- */
function doSave(slot) {
  var id = uid();
  if (!id) return false;
  var data = collectAllData();
  var save = {
    slot: slot,
    savedAt: new Date().toISOString(),
    savedAtDisplay: nowDisplay(),
    data: data
  };
  var raw;
  try { raw = JSON.stringify(save); } catch (e) { return false; }
  try {
    localStorage.setItem(saveKey(slot), raw);
  } catch (e) {
    console.warn('save localStorage err', e);
    return false;
  }
  saveToFirebase(slot, save);
  return true;
}

function saveToFirebase(slot, save) {
  if (!window.db || !window.fbSetDoc || !window.fbDoc) return;
  var id = uid(); if (!id) return;
  try {
    var ref = window.fbDoc(window.db, 'users', id, 'saves', slot);
    var payload = {
      savedAt: save.savedAt,
      savedAtDisplay: save.savedAtDisplay,
      data: save.data
    };
    if (typeof window.__sanitizeForFirestore === 'function') {
      try { payload = window.__sanitizeForFirestore(payload); } catch (e) {}
    }
    window.fbSetDoc(ref, payload, { merge: true }).catch(function (e) {
      console.warn('save firebase err', e);
    });
  } catch (e) { console.warn('save firebase err', e); }
}

/* ---------- ロード実行 ---------- */
function doLoad(slot) {
  var id = uid();
  if (!id) { toast('先にログインしてください'); return; }
  var raw = localStorage.getItem(saveKey(slot));
  if (!raw) {
    loadFromFirebase(slot, function (save) {
      if (save) applyLoad(save);
      else toast('セーブデータがありません');
    });
    return;
  }
  var save;
  try { save = JSON.parse(raw); } catch (e) { toast('セーブデータが破損しています'); return; }
  applyLoad(save);
}

function loadFromFirebase(slot, cb) {
  if (!window.db || !window.fbGetDoc || !window.fbDoc) { cb(null); return; }
  var id = uid(); if (!id) { cb(null); return; }
  try {
    var ref = window.fbDoc(window.db, 'users', id, 'saves', slot);
    window.fbGetDoc(ref).then(function (snap) {
      if (snap && snap.exists() && snap.data()) cb(snap.data());
      else cb(null);
    }).catch(function () { cb(null); });
  } catch (e) { cb(null); }
}

function applyLoad(save) {
  if (!save || !save.data) { toast('セーブデータが破損しています'); return; }
  var lsData = save.data.localStorage || {};
  var memData = save.data.memory || {};
  for (var k in lsData) {
    try { localStorage.setItem(k, lsData[k]); } catch (e) {}
  }
  if (window.db && window.fbSetDoc && window.fbDoc) {
    try {
      var id = uid();
      if (id) {
        var fbPayload = {
          totalExp: memData.totalExp || 0,
          playerName: memData.myName || '',
          selectedTitle: memData.selectedTitle || '',
          userTarget: memData.myTarget || '',
          userStats: memData.userStats || {},
          friendList: memData.myFriendList || [],
          updatedAt: new Date().toISOString()
        };
        if (typeof window.__sanitizeForFirestore === 'function') {
          try { fbPayload = window.__sanitizeForFirestore(fbPayload); } catch (e) {}
        }
        window.fbSetDoc(window.fbDoc(window.db, 'users', id), fbPayload, { merge: true }).catch(function () {});
      }
    } catch (e) {}
  }
  toast('読み込み中。しばらくお待ちください…');
  setTimeout(function () { location.reload(); }, 600);
}

/* ---------- UI ---------- */
var __svCurrentTab = 'save';

function closeSavePanel() {
  var m = document.getElementById('svModal');
  if (m && m.parentNode) m.parentNode.removeChild(m);
}
window.closeSavePanel = closeSavePanel;

function openSavePanel() {
  closeSavePanel();
  if (!uid()) { toast('先にログインしてください'); return; }
  var m = document.createElement('div');
  m.id = 'svModal';
  m.className = 'sv-modal';
  m.innerHTML =
    '<div class="sv-card">' +
      '<div class="sv-head">' +
        '<div class="sv-title">💾 データ保存 / 読み込み</div>' +
        '<button class="sv-close" id="svCloseBtn">✕</button>' +
      '</div>' +
      '<div class="sv-tabs">' +
        '<button class="sv-tab on" id="svTabSave">セーブ</button>' +
        '<button class="sv-tab" id="svTabLoad">ロード</button>' +
      '</div>' +
      '<div class="sv-body" id="svBody"></div>' +
      '<div class="sv-note">オートセーブは3分ごと・データ変更時・画面を閉じる時に自動で保存されます。<br>セーブデータは端末とクラウドの両方に保存されるので、機種変更しても引き継げます。</div>' +
    '</div>';
  document.body.appendChild(m);
  m.querySelector('#svCloseBtn').addEventListener('click', closeSavePanel);
  m.querySelector('#svTabSave').addEventListener('click', function () { switchSvTab('save'); });
  m.querySelector('#svTabLoad').addEventListener('click', function () { switchSvTab('load'); });
  m.addEventListener('click', function (e) { if (e.target === m) closeSavePanel(); });
  switchSvTab('save');
}

function switchSvTab(tab) {
  __svCurrentTab = tab;
  var ts = document.getElementById('svTabSave');
  var tl = document.getElementById('svTabLoad');
  if (ts) ts.className = 'sv-tab' + (tab === 'save' ? ' on' : '');
  if (tl) tl.className = 'sv-tab' + (tab === 'load' ? ' on' : '');
  renderSvBody();
}

function renderSvBody() {
  var body = document.getElementById('svBody');
  if (!body) return;
  var html = '';
  SLOTS.forEach(function (slot) {
    var info = getSaveInfo(slot);
    var dateStr = info ? info.savedAtDisplay : '未セーブ';
    if (__svCurrentTab === 'save') {
      html +=
        '<div class="sv-slot">' +
          '<div class="sv-slot-info">' +
            '<div class="sv-slot-name">' + esc(SLOT_NAMES[slot]) + '</div>' +
            '<div class="sv-slot-date">' + esc(dateStr) + '</div>' +
          '</div>' +
          '<button class="sv-btn" data-svsave="' + slot + '">' + (info ? '上書き' : 'セーブ') + '</button>' +
        '</div>';
    } else {
      html +=
        '<div class="sv-slot">' +
          '<div class="sv-slot-info">' +
            '<div class="sv-slot-name">' + esc(SLOT_NAMES[slot]) + '</div>' +
            '<div class="sv-slot-date">' + esc(dateStr) + '</div>' +
          '</div>' +
          (info
            ? '<button class="sv-btn sv-load" data-svload="' + slot + '">ロード</button>'
            : '<button class="sv-btn sv-disabled" disabled>データなし</button>') +
        '</div>';
    }
  });
  body.innerHTML = html;
  body.querySelectorAll('[data-svsave]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var slot = btn.getAttribute('data-svsave');
      var info = getSaveInfo(slot);
      if (info) {
        if (!confirm(SLOT_NAMES[slot] + ' には既にデータがあります（' + info.savedAtDisplay + '）。\n上書きしますか？')) return;
      }
      if (doSave(slot)) {
        toast('💾 保存しました');
        renderSvBody();
      } else {
        toast('保存に失敗しました');
      }
    });
  });
  body.querySelectorAll('[data-svload]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var slot = btn.getAttribute('data-svload');
      if (!confirm(SLOT_NAMES[slot] + ' を読み込みますか？\n現在のセーブしていないデータは失われます。')) return;
      doLoad(slot);
    });
  });
}

/* ---------- 💾ボタン ---------- */
function ensureSaveButton() {
  var btn = document.getElementById('headerSaveBtn');
  if (btn) return btn;
  var header = document.querySelector('.app-header');
  if (!header) return null;
  btn = document.createElement('button');
  btn.id = 'headerSaveBtn';
  btn.innerHTML = '💾';
  btn.style.cssText = 'position:absolute;right:16px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.05);border:1px solid rgba(0,240,255,.4);color:#00F0FF;width:36px;height:36px;border-radius:8px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:1001;box-shadow:0 0 10px rgba(0,240,255,.2);';
  header.appendChild(btn);
  return btn;
}

function bindSaveButton() {
  var btn = ensureSaveButton();
  if (!btn || btn.__svBound) return;
  btn.__svBound = true;
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    e.preventDefault();
    e.stopImmediatePropagation();
    openSavePanel();
  }, true);
}

/* ---------- オートセーブ ---------- */
var __svDirty = false;
var __svDebounce = null;

function markDirty() {
  __svDirty = true;
  clearTimeout(__svDebounce);
  __svDebounce = setTimeout(function () {
    if (__svDirty && uid()) {
      doSave('auto');
      __svDirty = false;
    }
  }, 3000);
}

setInterval(function () {
  if (uid() && __svDirty) {
    doSave('auto');
    __svDirty = false;
  }
}, SAVE_INTERVAL);

window.addEventListener('pagehide', function () {
  if (uid()) { try { doSave('auto'); } catch (e) {} }
});
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'hidden' && uid()) {
    try { doSave('auto'); } catch (e) {}
  }
});

/* ---------- saveUserStats ラップ → 変更マーク ---------- */
var __origSaveUserStats = window.saveUserStats;
if (typeof __origSaveUserStats === 'function' && !__origSaveUserStats.__svWrapped) {
  var wrappedSave = function () {
    var r = __origSaveUserStats.apply(this, arguments);
    markDirty();
    return r;
  };
  wrappedSave.__svWrapped = true;
  window.saveUserStats = wrappedSave;
}

/* ---------- loadLocalState ラップ → ボタン紐付け＋初期オートセーブ ---------- */
var __origLoadLocalState = window.loadLocalState;
if (typeof __origLoadLocalState === 'function' && !__origLoadLocalState.__svWrapped) {
  var wrappedLoad = function () {
    var p = __origLoadLocalState.apply(this, arguments);
    return Promise.resolve(p).then(function (r) {
      setTimeout(function () {
        bindSaveButton();
        if (uid()) { doSave('auto'); }
      }, 1500);
      return r;
    });
  };
  wrappedLoad.__svWrapped = true;
  window.loadLocalState = wrappedLoad;
}

/* ---------- CSS ---------- */
function injectSvCss() {
  if (document.getElementById('svCss')) return;
  var s = document.createElement('style');
  s.id = 'svCss';
  s.textContent = [
    '.sv-modal{position:fixed;inset:0;z-index:60050;display:flex;align-items:center;justify-content:center;background:rgba(5,3,12,.8);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding:20px;}',
    '.sv-card{width:min(92vw,400px);max-height:85vh;overflow-y:auto;border-radius:18px;padding:22px 18px;background:linear-gradient(168deg,rgba(46,38,28,.96),rgba(24,18,12,.98));border:1px solid rgba(200,144,42,.4);box-shadow:0 24px 64px rgba(0,0,0,.6),0 0 30px rgba(200,144,42,.15);-webkit-overflow-scrolling:touch;}',
    '.sv-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}',
    '.sv-title{font-family:"Noto Serif JP",serif;font-size:18px;font-weight:900;color:#f3e5c0;letter-spacing:.06em;}',
    '.sv-close{width:32px;height:32px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#a89880;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;}',
    '.sv-close:active{transform:scale(.9);color:#f3e5c0;}',
    '.sv-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;}',
    '.sv-tab{padding:11px;border-radius:10px;border:1.5px solid rgba(255,255,255,.15);background:rgba(0,0,0,.3);color:#a89880;font-family:"Noto Serif JP",serif;font-size:13px;font-weight:900;letter-spacing:.1em;cursor:pointer;transition:all .2s;}',
    '.sv-tab.on{border-color:rgba(245,196,81,.7);background:linear-gradient(180deg,rgba(245,196,81,.15),rgba(200,144,42,.08));color:#fde68a;box-shadow:0 0 14px rgba(245,196,81,.25);}',
    '.sv-body{display:flex;flex-direction:column;gap:10px;}',
    '.sv-slot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.25);transition:border-color .2s;}',
    '.sv-slot:active{border-color:rgba(200,144,42,.4);}',
    '.sv-slot-info{flex:1;min-width:0;}',
    '.sv-slot-name{font-family:"Noto Serif JP",serif;font-size:14px;font-weight:900;color:#f3e5c0;}',
    '.sv-slot-date{font-family:"Chakra Petch",ui-monospace,monospace;font-size:11px;font-weight:600;color:#8a7a5f;margin-top:3px;}',
    '.sv-btn{flex:0 0 auto;padding:9px 18px;border-radius:9px;border:1.5px solid rgba(245,196,81,.5);background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(0,0,0,.15) 45%),linear-gradient(180deg,#4a3b24,#2e2415 55%,#1f1809);color:#fde68a;font-family:"Noto Serif JP",serif;font-size:12px;font-weight:900;letter-spacing:.08em;cursor:pointer;transition:all .15s;text-shadow:0 1px 0 rgba(0,0,0,.9);}',
    '.sv-btn:active{transform:translateY(1px) scale(.97);}',
    '.sv-btn.sv-load{border-color:rgba(52,231,228,.5);background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(0,0,0,.15) 45%),linear-gradient(180deg,#1a3a3a,#0e2424 55%,#081616);color:#9af6f1;}',
    '.sv-btn.sv-disabled{border-color:rgba(255,255,255,.1);background:rgba(0,0,0,.3);color:#5a5040;cursor:not-allowed;text-shadow:none;}',
    '.sv-note{margin-top:14px;padding:10px 12px;border-radius:9px;background:rgba(200,144,42,.06);border:1px dashed rgba(200,144,42,.25);font-family:"Noto Sans JP",sans-serif;font-size:10.5px;font-weight:600;color:#a89880;line-height:1.6;}'
  ].join('\n');
  (document.head || document.documentElement).appendChild(s);
}

/* ---------- 起動 ---------- */
function bootSv() {
  injectSvCss();
  bindSaveButton();
}
if (document.readyState !== 'loading') setTimeout(bootSv, 600);
else document.addEventListener('DOMContentLoaded', function () { setTimeout(bootSv, 600); });

var __svBindInterval = setInterval(function () {
  var btn = document.getElementById('headerSaveBtn');
  if (btn && !btn.__svBound) bindSaveButton();
}, 800);
setTimeout(function () { clearInterval(__svBindInterval); }, 30000);

console.log('💾 セーブ/ロードシステム 適用完了');
})();
// ==========================================================================
// 🎴 第2回：3×アイコングリッド＋モーダル詳細＋ALLIES文字削除＋並び替え機能化
//    ① キャラ・敵・装備すべて3列の大きなアイコンのみに変更
//    ② アイコンタップ→全情報モーダル表示
//    ③ 「Allies · 味方図鑑」「Gear · 装備図鑑」等の見出し文字を削除
//    ④ 並び替えチップ（図鑑順/HP順/攻撃順/防御順）を機能化
//    ※ app.js / fix.js / style.css / index.html は不変更
// ==========================================================================
(function applyGridModalPatch() {
"use strict";
if (window.__gridModalApplied) return;
window.__gridModalApplied = true;

/* ---------- 0. スタイル注入 ---------- */
(function injectGridCss() {
if (document.getElementById('gmGridCss')) return;
var s = document.createElement('style');
s.id = 'gmGridCss';
s.textContent = [
/* ===== 見出し文字・旧リスト・旧並び替えを完全非表示 ===== */
'#ptyList .dx2-index-title,',
'#ptyList .dx2-index,',
'#ptyList .dx2-sort,',
'#ptyList .dx2-sortchip,',
'#ptyList .pty-card,',
'#ptyList .pty-empty,',
'#ptyList .gcx-list,',
'#ptyList .gcx-card,',
'#ptyList .gcx-empty,',
'#ptyList .pcv-card,',
'#ptyList .dx2-card{display:none !important;}',
/* ===== 3×グリッド ===== */
'.gm-grid{display:grid !important;grid-template-columns:repeat(3,1fr) !important;gap:14px !important;width:100% !important;max-width:420px !important;margin:0 auto !important;padding:4px 0 !important;}',
'.gm-cell{position:relative;aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;border-radius:16px;border:1.5px solid rgba(200,144,42,.28);background:linear-gradient(168deg,rgba(46,38,28,.92),rgba(28,22,15,.95));box-shadow:0 6px 18px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.06);transition:transform .15s cubic-bezier(.2,.9,.3,1.3),box-shadow .2s ease,border-color .2s ease;overflow:hidden;}',
'.gm-cell:active{transform:scale(.93);border-color:rgba(245,196,81,.7);box-shadow:0 0 18px rgba(245,196,81,.35);}',
'.gm-cell-icon{font-size:42px;line-height:1;filter:drop-shadow(0 3px 8px rgba(0,0,0,.5));}',
'.gm-cell-icon img{width:56px;height:56px;object-fit:cover;border-radius:10px;}',
'.gm-cell-name{font-family:"Noto Sans JP",sans-serif;font-size:9px;font-weight:800;color:#cbbfa6;text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 4px;}',
'.gm-cell-rar{position:absolute;top:5px;right:5px;width:8px;height:8px;border-radius:50%;}',
'.gm-cell-star{position:absolute;bottom:4px;left:50%;transform:translateX(-50%);font-size:7px;letter-spacing:1px;color:rgba(245,196,81,.8);text-shadow:0 0 4px rgba(245,196,81,.5);}',
'.gm-cell-equipped{position:absolute;top:4px;left:4px;font-size:10px;}',
'.gm-empty{grid-column:1/-1;text-align:center;font-family:"Noto Sans JP",sans-serif;font-size:12px;font-weight:600;color:#8a7a5f;padding:28px 16px;border:1px dashed rgba(200,144,42,.3);border-radius:14px;background:rgba(0,0,0,.25);}',
/* ===== 並び替えチップ（グリッド上部に固定表示） ===== */
'.gm-sort-bar{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-width:420px;margin:0 auto 10px;width:100%;}',
'.gm-sort-chip{font-family:"Noto Sans JP",sans-serif;font-size:10px;font-weight:800;color:#a89880;border:1px solid rgba(255,255,255,.16);background:rgba(0,0,0,.3);border-radius:999px;padding:5px 12px;cursor:pointer;transition:all .18s ease;-webkit-tap-highlight-color:transparent;}',
'.gm-sort-chip:active{transform:scale(.93);}',
'.gm-sort-chip.on{color:#1a1206;background:linear-gradient(180deg,#ffe9a8,#f5c451);border-color:rgba(255,233,168,.85);box-shadow:0 0 10px rgba(245,196,81,.45);}',
/* ===== モーダル ===== */
'.gm-modal{position:fixed;inset:0;z-index:60100;display:flex;align-items:center;justify-content:center;background:rgba(5,3,12,.82);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding:20px;}',
'.gm-modal-card{width:min(92vw,380px);max-height:82vh;overflow-y:auto;-webkit-overflow-scrolling:touch;border-radius:18px;padding:24px 20px;background:linear-gradient(168deg,rgba(46,38,28,.96),rgba(24,18,12,.98));border:1px solid rgba(200,144,42,.4);box-shadow:0 24px 64px rgba(0,0,0,.6),0 0 30px rgba(200,144,42,.15);}',
'.gm-modal-close{position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#a89880;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;}',
'.gm-modal-close:active{transform:scale(.9);color:#f3e5c0;}',
'.gm-modal-icon{font-size:64px;text-align:center;margin:8px 0 14px;filter:drop-shadow(0 4px 12px rgba(0,0,0,.5));}',
'.gm-modal-icon img{width:80px;height:80px;object-fit:cover;border-radius:14px;}',
'.gm-modal-name{font-family:"Noto Serif JP",serif;font-size:20px;font-weight:900;color:#f3e5c0;text-align:center;text-shadow:0 1px 3px rgba(0,0,0,.8);}',
'.gm-modal-sub{font-family:"Cinzel",serif;font-size:9px;font-weight:700;letter-spacing:.25em;color:#c8902a;text-align:center;text-transform:uppercase;margin-top:4px;}',
'.gm-modal-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px;}',
'.gm-modal-stat{background:rgba(0,0,0,.32);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:8px 10px;display:flex;flex-direction:column;gap:2px;}',
'.gm-modal-stat-k{font-family:"Noto Sans JP",sans-serif;font-size:9px;font-weight:700;color:#9a8c72;letter-spacing:.06em;}',
'.gm-modal-stat-v{font-family:"Chakra Petch",ui-monospace,monospace;font-size:15px;font-weight:700;color:#f3e5c0;line-height:1.1;}',
'.gm-modal-skills{display:flex;flex-wrap:wrap;gap:5px;margin-top:12px;}',
'.gm-modal-skill{display:inline-flex;align-items:center;gap:4px;font-family:"Noto Sans JP",sans-serif;font-size:10px;font-weight:700;color:#e6d3a3;background:rgba(200,144,42,.10);border:1px solid rgba(200,144,42,.28);padding:4px 9px;border-radius:7px;white-space:nowrap;}',
'.gm-modal-desc{margin-top:14px;padding-top:12px;border-top:1px dashed rgba(200,144,42,.28);font-family:"Noto Sans JP",sans-serif;font-size:11.5px;font-weight:500;line-height:1.85;color:#cbb994;}',
'.gm-modal-actions{display:flex;gap:8px;margin-top:16px;}',
'.gm-modal-btn{flex:1;font-family:"Noto Serif JP",serif;font-size:12px;font-weight:900;letter-spacing:.08em;padding:11px 8px;border-radius:10px;cursor:pointer;border:1.5px solid rgba(245,196,81,.5);background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(0,0,0,.15) 45%),linear-gradient(180deg,#4a3b24,#2e2415 55%,#1f1809);color:#fde68a;text-shadow:0 1px 0 rgba(0,0,0,.9);transition:transform .13s ease;}',
'.gm-modal-btn:active{transform:translateY(2px) scale(.97);}',
'.gm-modal-btn.on{color:#04201f;border-color:rgba(52,231,228,.6);background:linear-gradient(135deg,#9af6f1,#34e7e4);text-shadow:none;}',
'.gm-modal-btn.off{color:#fda4af;border-color:rgba(255,84,104,.5);background:rgba(255,84,104,.12);text-shadow:none;}',
'.gm-modal-btn.ghost{color:#a89880;border-color:rgba(255,255,255,.16);background:rgba(0,0,0,.3);text-shadow:none;}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();

/* ---------- 1. データ収集 ---------- */
var GM_RAR = {
C:{line:'148,163,184',star:1},UC:{line:'34,211,238',star:2},
R:{line:'249,115,22',star:3},SR:{line:'251,191,36',star:4}
};
function gmChars(){
try{if(window.PARTY_CHARS)return window.PARTY_CHARS;}catch(e){}
return[{id:'tangon',name:'タンゴン',emoji:'🐧',img:'tangon.png',rarity:'SR',hp:3500,atkMul:1.0,comboRate:1.0,skill:'味方HP上限増加',ultimate:'タンゴフラッシュ',desc:'薔薇をくわえてタンゴを踊る伝説の修行者。パーティのHP上限を引き上げ、奥義「タンゴフラッシュ」で敵を一閃する。'}];
}
function gmEnemies(){
try{if(window.PARTY_ENEMIES)return window.PARTY_ENEMIES;}catch(e){}
try{if(typeof DX2_ENEMIES!=='undefined')return DX2_ENEMIES;}catch(e){}
return[];
}
function gmGear(){
var w=[{id:'',name:'素手',emoji:'🗡️',atk:0,def:0,kind:'weapon',rarity:'C',desc:'何も持たない既定の状態。まずはここから。'},
{id:'fire_sword',name:'業火の大剣',emoji:'🔥',atk:150,def:0,kind:'weapon',rarity:'R',desc:'炎を纏った大剣。攻撃力を +150 底上げし、一撃の重さを増す。'}];
var a=[{id:'',name:'布の服',emoji:'🛡️',atk:0,def:0,kind:'armor',rarity:'C',desc:'軽装の既定防具。守りはまだこれからの領域。'},
{id:'cosmic_shield',name:'星屑の盾',emoji:'🔮',atk:0,def:80,kind:'armor',rarity:'R',desc:'星の欠片を鍛えた盾。防御力を +80 高め、敵の攻撃をいなしやすくする。'}];
return w.concat(a);
}
function gmSortState(){
window.__gmSort=window.__gmSort||{char:'no',enemy:'no',gear:'no'};
return window.__gmSort;
}
function gmPU(){return window.__partyUi||(window.__partyUi={cat:'char',search:'',rarity:'ALL',expanded:{}});}

/* ---------- 2. アイコンHTML ---------- */
function gmCellHtml(item,cat,idx){
var r=GM_RAR[item.rarity||'C']||GM_RAR.C;
var icon=item.img?'<img src="'+item.img+'" onerror="this.outerHTML=\''+item.emoji+'\'">':item.emoji;
var equipped='';
if(cat==='char'){try{if(typeof activeCharacter!=='undefined'&&activeCharacter===item.id)equipped='⚔️';}catch(e){}}
else if(cat==='gear'){try{
if(item.kind==='weapon'&&typeof activeWeapon!=='undefined'&&activeWeapon===item.id)equipped='⚔️';
if(item.kind==='armor'&&typeof activeArmor!=='undefined'&&activeArmor===item.id)equipped='⚔️';
}catch(e){}}
return '<div class="gm-cell" data-gmcat="'+cat+'" data-gmid="'+(item.id||idx)+'" data-gmidx="'+idx+'" style="animation-delay:'+Math.min(idx*0.03,0.3)+'s">'
+'<span class="gm-cell-rar" style="background:rgba('+r.line+',.9);box-shadow:0 0 6px rgba('+r.line+',.6)"></span>'
+(equipped?'<span class="gm-cell-equipped">'+equipped+'</span>':'')
+'<span class="gm-cell-icon">'+icon+'</span>'
+'<span class="gm-cell-name">'+item.name+'</span>'
+'<span class="gm-cell-star">'+'★'.repeat(r.star)+'</span>'
+'</div>';
}

/* ---------- 3. 並び替えチップ ---------- */
function gmSortChips(cat){
var st=gmSortState()[cat]||'no';
var chips=cat==='char'?[['no','図鑑順'],['hp','HP順'],['atk','攻撃順'],['def','防御順']]
:cat==='enemy'?[['no','図鑑順'],['hp','HP順'],['atk','攻撃順'],['def','防御順']]
:[['no','図鑑順'],['atk','攻撃順'],['def','防御順']];
return '<div class="gm-sort-bar">'+chips.map(function(c){
return '<span class="gm-sort-chip'+(st===c[0]?' on':'')+'" data-gmsort="'+c[0]+'">'+c[1]+'</span>';
}).join('')+'</div>';
}
function gmSortItems(items,cat){
var st=gmSortState()[cat]||'no';
if(st==='hp')return items.slice().sort(function(a,b){return(b.hp||0)-(a.hp||0);});
if(st==='atk')return items.slice().sort(function(a,b){return(b.atk||b.atkMul||0)-(a.atk||a.atkMul||0);});
if(st==='def')return items.slice().sort(function(a,b){return(b.def||0)-(a.def||0);});
return items;
}

/* ---------- 4. グリッド描画 ---------- */
function gmRender(){
var list=document.getElementById('ptyList');
var pu=gmPU();
if(!list||!pu)return;
var cat=pu.cat;
var q=(pu.search||'').toLowerCase().trim();
var rar=pu.rarity||'ALL';
var items,html='';
if(cat==='char'){
items=gmChars().filter(function(c){return !q||c.name.toLowerCase().indexOf(q)>=0;});
items=gmSortItems(items,'char');
html=gmSortChips('char');
html+=items.length?'<div class="gm-grid">'+items.map(function(c,i){return gmCellHtml(c,'char',i);}).join('')+'</div>'
:'<div class="gm-grid"><div class="gm-empty">該当するキャラクターがいません。</div></div>';
}else if(cat==='enemy'){
items=gmEnemies().filter(function(e){
if(rar!=='ALL'&&e.rarity!==rar)return false;
if(q&&e.name.toLowerCase().indexOf(q)<0)return false;
return true;
});
items=gmSortItems(items,'enemy');
html=gmSortChips('enemy');
html+=items.length?'<div class="gm-grid">'+items.map(function(e,i){return gmCellHtml(e,'enemy',i);}).join('')+'</div>'
:'<div class="gm-grid"><div class="gm-empty">条件に合う魔物は記録されていません。</div></div>';
}else{
items=gmGear().filter(function(g){
if(q&&g.name.toLowerCase().indexOf(q)<0)return false;
return true;
});
items=gmSortItems(items,'gear');
html=gmSortChips('gear');
html+=items.length?'<div class="gm-grid">'+items.map(function(g,i){return gmCellHtml(g,'gear',i);}).join('')+'</div>'
:'<div class="gm-grid"><div class="gm-empty">装備がありません。</div></div>';
}
list.classList.add('gm-active');
list.innerHTML=html;
}

/* ---------- 5. モーダル ---------- */
function gmOpenModal(cat,id,idx){
var item;
if(cat==='char')item=gmChars()[idx];
else if(cat==='enemy')item=gmEnemies()[idx];
else item=gmGear()[idx];
if(!item)return;
var r=GM_RAR[item.rarity||'C']||GM_RAR.C;
var icon=item.img?'<img src="'+item.img+'" onerror="this.outerHTML=\''+item.emoji+'\'">':item.emoji;
var statsHtml='';
if(cat==='char'){
statsHtml='<div class="gm-modal-stat"><span class="gm-modal-stat-k">HP</span><span class="gm-modal-stat-v">'+item.hp+'</span></div>'
+'<div class="gm-modal-stat"><span class="gm-modal-stat-k">攻撃倍率</span><span class="gm-modal-stat-v">×'+(item.atkMul||1).toFixed(1)+'</span></div>'
+'<div class="gm-modal-stat"><span class="gm-modal-stat-k">コンボ率</span><span class="gm-modal-stat-v">×'+(item.comboRate||1).toFixed(1)+'</span></div>'
+'<div class="gm-modal-stat"><span class="gm-modal-stat-k">レアリティ</span><span class="gm-modal-stat-v">'+(item.rarity||'C')+'</span></div>';
}else if(cat==='enemy'){
statsHtml='<div class="gm-modal-stat"><span class="gm-modal-stat-k">HP</span><span class="gm-modal-stat-v">'+(item.hp||item.baseHp||0).toLocaleString()+'</span></div>'
+'<div class="gm-modal-stat"><span class="gm-modal-stat-k">ATK</span><span class="gm-modal-stat-v">'+(item.atk||0)+'</span></div>'
+'<div class="gm-modal-stat"><span class="gm-modal-stat-k">GUARD</span><span class="gm-modal-stat-v">'+(item.barrier?'🛡 有':'— 無')+'</span></div>'
+'<div class="gm-modal-stat"><span class="gm-modal-stat-k">レアリティ</span><span class="gm-modal-stat-v">'+(item.rarity||'C')+'</span></div>';
}else{
statsHtml='<div class="gm-modal-stat"><span class="gm-modal-stat-k">攻撃</span><span class="gm-modal-stat-v">'+(item.atk>0?'+'+item.atk:'—')+'</span></div>'
+'<div class="gm-modal-stat"><span class="gm-modal-stat-k">防御</span><span class="gm-modal-stat-v">'+(item.def>0?'+'+item.def:'—')+'</span></div>'
+'<div class="gm-modal-stat"><span class="gm-modal-stat-k">種別</span><span class="gm-modal-stat-v">'+(item.kind==='weapon'?'武器':'防具')+'</span></div>'
+'<div class="gm-modal-stat"><span class="gm-modal-stat-k">レアリティ</span><span class="gm-modal-stat-v">'+(item.rarity||'C')+'</span></div>';
}
var skillsHtml='';
if(cat==='char'&&item.skill){
skillsHtml='<div class="gm-modal-skills"><span class="gm-modal-skill">✦ '+item.skill+'</span>'
+(item.ultimate?'<span class="gm-modal-skill">💥 '+item.ultimate+'</span>':'')+'</div>';
}
if(cat==='enemy'){
var sk=[];
if(item.skills)item.skills.forEach(function(s){
if(s==='time')sk.push('⏱ 行動時 全体攻撃');
else if(s==='combo')sk.push('🔥 コンボ反撃 '+(item.comboTh||'')+'+');
else if(s==='special')sk.push('✦ 特殊行動');
});
if(item.barrier)sk.push('🛡 障壁展開 HP25%');
if(sk.length)skillsHtml='<div class="gm-modal-skills">'+sk.map(function(s){return '<span class="gm-modal-skill">'+s+'</span>';}).join('')+'</div>';
}
var actionsHtml='';
if(cat==='char'){
var isActive=false;
try{isActive=(typeof activeCharacter!=='undefined'&&activeCharacter===item.id);}catch(e){}
actionsHtml=isActive
?'<div class="gm-modal-actions"><button class="gm-modal-btn off" data-gmeq="char:">編成を外す</button></div>'
:'<div class="gm-modal-actions"><button class="gm-modal-btn" data-gmeq="char:'+item.id+'">編成する</button></div>';
}else if(cat==='gear'){
var isEq=false;
try{
if(item.kind==='weapon')isEq=(typeof activeWeapon!=='undefined'&&activeWeapon===item.id);
else isEq=(typeof activeArmor!=='undefined'&&activeArmor===item.id);
}catch(e){}
actionsHtml=isEq
?'<div class="gm-modal-actions"><button class="gm-modal-btn off" data-gmeq="'+item.kind+':">装備を外す</button></div>'
:'<div class="gm-modal-actions"><button class="gm-modal-btn" data-gmeq="'+item.kind+':'+item.id+'">装備する</button></div>';
}
var m=document.createElement('div');
m.className='gm-modal';
m.innerHTML='<div class="gm-modal-card" style="position:relative">'
+'<button class="gm-modal-close" data-gmclose>✕</button>'
+'<div class="gm-modal-icon">'+icon+'</div>'
+'<div class="gm-modal-name">'+item.name+'</div>'
+'<div class="gm-modal-sub">'+(item.en||item.rarity||'')+'</div>'
+'<div class="gm-modal-stats">'+statsHtml+'</div>'
+skillsHtml
+(item.desc?'<div class="gm-modal-desc">'+item.desc+'</div>':'')
+actionsHtml
+'</div>';
document.body.appendChild(m);
m.addEventListener('click',function(e){
if(e.target===m){m.remove();return;}
if(e.target.closest('[data-gmclose]')){m.remove();return;}
var eq=e.target.closest('[data-gmeq]');
if(eq){
var spec=eq.getAttribute('data-gmeq');
var kind=spec.split(':')[0],eid=spec.split(':')[1]||'';
try{
if(kind==='char'&&typeof window.selectCharacter==='function')window.selectCharacter(eid);
else if(kind==='weapon'&&typeof window.selectWeapon==='function')window.selectWeapon(eid);
else if(kind==='armor'&&typeof window.selectArmor==='function')window.selectArmor(eid);
}catch(e2){}
m.remove();
gmRender();
}
});
}

/* ---------- 6. イベント ---------- */
document.addEventListener('click',function(e){
var t=e.target;
if(!t||!t.closest)return;
var sortChip=t.closest('[data-gmsort]');
if(sortChip){
var cat=gmPU().cat;
gmSortState()[cat]=sortChip.getAttribute('data-gmsort');
gmRender();
return;
}
var cell=t.closest('[data-gmcat]');
if(cell){
gmOpenModal(cell.getAttribute('data-gmcat'),cell.getAttribute('data-gmid'),parseInt(cell.getAttribute('data-gmidx'),10));
}
},true);

/* ---------- 7. 描画トリガー ---------- */
function gmReplace(){
var list=document.getElementById('ptyList');
var pu=gmPU();
if(!list||!pu)return;
gmRender();
}
function gmWatch(){
var list=document.getElementById('ptyList');
if(!list)return;
if(!list.querySelector('.gm-grid')&&!list.querySelector('.gm-empty'))gmRender();
else if(!list.classList.contains('gm-active'))gmRender();
}
setInterval(gmWatch,250);
var __prevTabGM=window.switchTab;
window.switchTab=function(tabId){
var r=__prevTabGM?__prevTabGM.apply(this,arguments):undefined;
if(tabId==='party'){setTimeout(gmReplace,50);setTimeout(gmReplace,200);}
return r;
};
var __prevLoadGM=window.loadLocalState;
window.loadLocalState=function(){
var r=__prevLoadGM?__prevLoadGM.apply(this,arguments):undefined;
if(r&&r.then)r.then(function(){setTimeout(gmReplace,100);});
else setTimeout(gmReplace,100);
return r;
};
(function bootGM(){
function run(){gmReplace();}
if(document.readyState!=='loading')setTimeout(run,500);
else document.addEventListener('DOMContentLoaded',function(){setTimeout(run,500);});
})();
console.log('🎴 第2回：3×アイコングリッド＋モーダル＋並び替え機能化 適用完了');
})();
// ==========================================================================
// 🔧 第3回パッチ（末尾追記・本体不変更）
//    ① エラー可視化（グローバルエラー捕捉＋コンソール警告）
//    ② 初回チュートリアル（3ステップ・初回ログイン時のみ表示）
//    ③ 控えめ音・振動（Web Audio API・勉強を邪魔しない音量）
//    ④ オフラインバナー（ネット断線時に上部に警告表示）
//    ⑤ ガチャ履歴（localStorage保存＋モーダル表示）
//    ⑥ 長押しプレビュー（単語カード・編成カード 500ms）
//    ※ app.js / fix.js / style.css / index.html は不変更
// ==========================================================================
(function applyBatch3Patch() {
"use strict";
if (window.__batch3Applied) return;
window.__batch3Applied = true;

/* ==================================================================
【1】エラー可視化
================================================================== */
(function initErrorVisualizer() {
var style = document.createElement('style');
style.id = 'b3ErrCss';
style.textContent = [
'.b3-err-toast{position:fixed;top:60px;left:50%;transform:translateX(-50%) translateY(-10px);',
'z-index:100000;max-width:90vw;padding:10px 16px;border-radius:10px;',
'background:rgba(239,68,68,.92);color:#fff;font-size:12px;font-weight:700;',
'box-shadow:0 4px 16px rgba(239,68,68,.4);opacity:0;transition:all .3s ease;',
'pointer-events:none;font-family:"Noto Sans JP",sans-serif;}',
'.b3-err-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}'
].join('\n');
(document.head || document.documentElement).appendChild(style);

var toast = document.createElement('div');
toast.className = 'b3-err-toast';
toast.id = 'b3ErrToast';
document.body.appendChild(toast);
var timer = null;

function showErr(msg) {
toast.textContent = '⚠️ ' + msg;
toast.classList.add('show');
clearTimeout(timer);
timer = setTimeout(function () { toast.classList.remove('show'); }, 4000);
}

window.addEventListener('error', function (e) {
try {
var msg = e.message || '不明なエラー';
var src = (e.filename || '').split('/').pop();
console.warn('[エラー]', msg, src + ':' + e.lineno);
showErr(msg);
} catch (ex) {}
});

window.addEventListener('unhandledrejection', function (e) {
try {
var msg = e.reason ? (e.reason.message || String(e.reason)) : '非同期エラー';
console.warn('[非同期エラー]', msg);
} catch (ex) {}
});
})();

/* ==================================================================
【2】初回チュートリアル（3ステップ）
================================================================== */
(function initTutorial() {
if (localStorage.getItem('b3_tutorial_done')) return;

var style = document.createElement('style');
style.id = 'b3TutCss';
style.textContent = [
'.b3-tut-overlay{position:fixed;inset:0;z-index:99990;background:rgba(5,3,12,.88);',
'backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:24px;}',
'.b3-tut-card{width:min(92vw,360px);border-radius:20px;padding:28px 24px;',
'background:linear-gradient(168deg,#2a2138,#171022);border:1px solid rgba(155,107,255,.4);',
'box-shadow:0 24px 64px rgba(0,0,0,.6);text-align:center;position:relative;}',
'.b3-tut-step{font-family:"Cinzel",serif;font-size:10px;font-weight:700;letter-spacing:.3em;color:#c8902a;margin-bottom:10px;}',
'.b3-tut-title{font-family:"Noto Serif JP",serif;font-size:22px;font-weight:900;color:#f3e5c0;margin-bottom:14px;}',
'.b3-tut-desc{font-family:"Noto Sans JP",sans-serif;font-size:13px;font-weight:600;color:#b6a98f;line-height:1.8;margin-bottom:20px;}',
'.b3-tut-icon{font-size:48px;margin-bottom:16px;}',
'.b3-tut-dots{display:flex;justify-content:center;gap:8px;margin-bottom:18px;}',
'.b3-tut-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.2);transition:all .3s;}',
'.b3-tut-dot.on{background:#f5c451;box-shadow:0 0 8px rgba(245,196,81,.6);}',
'.b3-tut-btn{width:100%;padding:13px;border-radius:12px;border:1.5px solid rgba(245,196,81,.6);',
'background:linear-gradient(180deg,#4a3b24,#2e2415);color:#fde68a;',
'font-family:"Noto Serif JP",serif;font-size:15px;font-weight:900;cursor:pointer;',
'letter-spacing:.1em;transition:transform .13s;}',
'.b3-tut-btn:active{transform:scale(.97);}',
'.b3-tut-skip{position:absolute;top:14px;right:14px;width:30px;height:30px;border-radius:8px;',
'border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#a89880;',
'font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;}'
].join('\n');
(document.head || document.documentElement).appendChild(style);

var steps = [
{ icon: '📚', title: '単語を覚える', desc: '「単語帳」タブで単語をタップし、⚪︎△✕で理解度を記録しよう。覚えるほどレベルが上がる！' },
{ icon: '⚔️', title: 'バトルに挑む', desc: '「ゲーム」タブでバトル！単語を答えて敵にダメージ。コンボをつなげて大ダメージを与えよう。' },
{ icon: '🎰', title: 'ガチャで仲間を増やす', desc: 'バトルで手に入れたゴールドでガチャ！新しいキャラや武器を手に入れてパーティを強化しよう。' }
];
var cur = 0;

function buildCard() {
var s = steps[cur];
return '<div class="b3-tut-card">' +
'<button class="b3-tut-skip" id="b3TutSkip">✕</button>' +
'<div class="b3-tut-icon">' + s.icon + '</div>' +
'<div class="b3-tut-step">STEP ' + (cur + 1) + ' / ' + steps.length + '</div>' +
'<div class="b3-tut-title">' + s.title + '</div>' +
'<div class="b3-tut-desc">' + s.desc + '</div>' +
'<div class="b3-tut-dots">' + steps.map(function (_, i) {
return '<span class="b3-tut-dot' + (i === cur ? ' on' : '') + '"></span>';
}).join('') + '</div>' +
'<button class="b3-tut-btn" id="b3TutBtn">' + (cur < steps.length - 1 ? '次へ' : 'はじめる！') + '</button>' +
'</div>';
}

function show() {
var ov = document.getElementById('b3TutOverlay');
if (ov) ov.remove();
ov = document.createElement('div');
ov.className = 'b3-tut-overlay';
ov.id = 'b3TutOverlay';
ov.innerHTML = buildCard();
document.body.appendChild(ov);
ov.querySelector('#b3TutBtn').addEventListener('click', function () {
cur++;
if (cur >= steps.length) { done(); return; }
ov.innerHTML = buildCard();
bind();
});
ov.querySelector('#b3TutSkip').addEventListener('click', done);
}

function bind() {
var ov = document.getElementById('b3TutOverlay');
if (!ov) return;
var btn = ov.querySelector('#b3TutBtn');
var skip = ov.querySelector('#b3TutSkip');
if (btn) btn.addEventListener('click', function () {
cur++;
if (cur >= steps.length) { done(); return; }
ov.innerHTML = buildCard();
bind();
});
if (skip) skip.addEventListener('click', done);
}

function done() {
var ov = document.getElementById('b3TutOverlay');
if (ov) ov.remove();
localStorage.setItem('b3_tutorial_done', '1');
}

setTimeout(show, 1500);
})();

/* ==================================================================
【3】控えめ音・振動（Web Audio API）
================================================================== */
(function initSubtleSound() {
if (localStorage.getItem('b3_sound_off') === '1') return;
var ctx = null;
function getCtx() {
if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
return ctx;
}
function play(freq, dur, vol) {
var c = getCtx(); if (!c) return;
try {
var o = c.createOscillator();
var g = c.createGain();
o.connect(g); g.connect(c.destination);
o.frequency.value = freq;
o.type = 'sine';
g.gain.value = vol || 0.03;
g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
o.start(c.currentTime);
o.stop(c.currentTime + dur);
} catch (e) {}
}
// 正解：やさしい高音ピン
window.__b3SoundOk = function () { play(880, 0.12, 0.025); };
// 不正解：低めのやわらかい音
window.__b3SoundBad = function () { play(220, 0.15, 0.025); };
// タップ：ごく控えめ
window.__b3SoundTap = function () { play(660, 0.06, 0.015); };
// ガチャ：少しだけ存在感
window.__b3SoundGacha = function () { play(523, 0.2, 0.03); setTimeout(function () { play(659, 0.2, 0.03); }, 100); };

// ゲーム正解/不正解にフック
var prevFlick = window.processMultiFlickAnswer;
if (typeof prevFlick === 'function' && !prevFlick.__b3Sound) {
var wrapped = function () {
var before = (typeof gameComboCount !== 'undefined') ? gameComboCount : 0;
var r = prevFlick.apply(this, arguments);
var after = (typeof gameComboCount !== 'undefined') ? gameComboCount : 0;
if (after > before) window.__b3SoundOk();
else if (after === 0 && before > 0) window.__b3SoundBad();
return r;
};
wrapped.__b3Sound = true;
window.processMultiFlickAnswer = wrapped;
}
})();

/* ==================================================================
【4】オフラインバナー
================================================================== */
(function initOfflineBanner() {
var style = document.createElement('style');
style.id = 'b3OffCss';
style.textContent = [
'.b3-off-banner{position:fixed;top:0;left:0;right:0;z-index:99999;',
'padding:8px 16px;background:rgba(245,158,11,.92);color:#1a1206;',
'font-family:"Noto Sans JP",sans-serif;font-size:12px;font-weight:800;',
'text-align:center;transform:translateY(-100%);transition:transform .3s ease;}',
'.b3-off-banner.show{transform:translateY(0);}'
].join('\n');
(document.head || document.documentElement).appendChild(style);

var banner = document.createElement('div');
banner.className = 'b3-off-banner';
banner.id = 'b3OffBanner';
banner.textContent = '📡 オフラインです。データは保存されません。';
document.body.appendChild(banner);

function update() {
if (navigator.onLine) banner.classList.remove('show');
else banner.classList.add('show');
}
window.addEventListener('online', update);
window.addEventListener('offline', update);
update();
})();

/* ==================================================================
【5】ガチャ履歴
================================================================== */
(function initGachaHistory() {
window.__b3GachaLog = JSON.parse(localStorage.getItem('b3_gacha_log') || '[]');

window.__b3AddGachaLog = function (items) {
var log = window.__b3GachaLog;
var now = new Date();
var entry = {
time: now.getFullYear() + '/' + (now.getMonth() + 1) + '/' + now.getDate() + ' ' +
now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0'),
items: items.map(function (i) { return { name: i.name, rarity: i.rarity }; })
};
log.unshift(entry);
if (log.length > 50) log = log.slice(0, 50);
window.__b3GachaLog = log;
localStorage.setItem('b3_gacha_log', JSON.stringify(log));
};

window.__b3ShowGachaHistory = function () {
var ov = document.getElementById('b3GachaHistOverlay');
if (ov) ov.remove();
var log = window.__b3GachaLog || [];
var html = '<div class="b3-gh-card">' +
'<button class="b3-gh-close" id="b3GhClose">✕</button>' +
'<div class="b3-gh-title">🎰 ガチャ履歴</div>' +
'<div class="b3-gh-list">';
if (log.length === 0) {
html += '<div class="b3-gh-empty">まだ履歴がありません。</div>';
} else {
log.forEach(function (entry) {
html += '<div class="b3-gh-entry">' +
'<div class="b3-gh-time">' + entry.time + '</div>' +
'<div class="b3-gh-items">' + entry.items.map(function (i) {
var rc = { C: '#94A3B8', UC: '#22D3EE', R: '#FB923C', SR: '#FBBF24' }[i.rarity] || '#94A3B8';
return '<span class="b3-gh-item" style="border-color:' + rc + '33;color:' + rc + ';">' + i.name + '</span>';
}).join('') + '</div></div>';
});
}
html += '</div></div>';
ov = document.createElement('div');
ov.id = 'b3GachaHistOverlay';
ov.style.cssText = 'position:fixed;inset:0;z-index:60020;display:flex;align-items:center;justify-content:center;background:rgba(5,3,12,.78);backdrop-filter:blur(6px);padding:20px;';
ov.innerHTML = html;
document.body.appendChild(ov);
ov.querySelector('#b3GhClose').addEventListener('click', function () { ov.remove(); });
ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
};

// スタイル
var style = document.createElement('style');
style.id = 'b3GhCss';
style.textContent = [
'.b3-gh-card{width:min(92vw,380px);max-height:80vh;overflow-y:auto;border-radius:18px;padding:22px 18px;',
'background:linear-gradient(168deg,#2a2138,#171022);border:1px solid rgba(155,107,255,.4);position:relative;}',
'.b3-gh-close{position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:8px;',
'border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#a89880;font-size:15px;cursor:pointer;}',
'.b3-gh-title{font-family:"Noto Serif JP",serif;font-size:19px;font-weight:900;color:#f3e5c0;text-align:center;margin-bottom:16px;}',
'.b3-gh-empty{text-align:center;color:#8a7a5f;font-size:12px;padding:20px;}',
'.b3-gh-entry{margin-bottom:12px;padding-bottom:12px;border-bottom:1px dashed rgba(200,144,42,.2);}',
'.b3-gh-time{font-size:10px;color:#8a7a5f;margin-bottom:6px;font-family:monospace;}',
'.b3-gh-items{display:flex;flex-wrap:wrap;gap:5px;}',
'.b3-gh-item{font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;border:1px solid;background:rgba(0,0,0,.3);}'
].join('\n');
(document.head || document.documentElement).appendChild(style);
})();

/* ==================================================================
【6】長押しプレビュー（単語カード・編成カード）
================================================================== */
(function initLongPress() {
var style = document.createElement('style');
style.id = 'b3LpCss';
style.textContent = [
'.b3-lp-overlay{position:fixed;inset:0;z-index:60010;display:flex;align-items:center;justify-content:center;',
'background:rgba(5,3,12,.75);backdrop-filter:blur(4px);padding:20px;}',
'.b3-lp-card{width:min(88vw,320px);max-height:70vh;overflow-y:auto;border-radius:16px;padding:20px;',
'background:linear-gradient(168deg,#2a2138,#171022);border:1px solid rgba(155,107,255,.35);',
'box-shadow:0 20px 50px rgba(0,0,0,.5);}',
'.b3-lp-close{position:absolute;top:10px;right:10px;width:28px;height:28px;border-radius:7px;',
'border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#a89880;font-size:14px;cursor:pointer;}',
'.b3-lp-title{font-family:"Noto Serif JP",serif;font-size:17px;font-weight:900;color:#f3e5c0;margin-bottom:10px;}',
'.b3-lp-body{font-family:"Noto Sans JP",sans-serif;font-size:12px;color:#b6a98f;line-height:1.7;}'
].join('\n');
(document.head || document.documentElement).appendChild(style);

var pressTimer = null;
var pressTarget = null;

function showPreview(el) {
var ov = document.getElementById('b3LpOverlay');
if (ov) ov.remove();
var title = '', body = '';
// 単語カード
var wordEl = el.querySelector('.word-main-line');
if (wordEl) {
title = wordEl.textContent.trim();
var meaningEl = el.querySelector('.word-meaning-extra');
body = meaningEl ? meaningEl.textContent.trim() : '意味データなし';
}
// 編成カード
var ptyEl = el.querySelector('.pty-card-name');
if (ptyEl) {
title = ptyEl.textContent.trim();
var detailEl = el.querySelector('.pty-detail-inner');
body = detailEl ? detailEl.textContent.trim() : '詳細データなし';
}
// 敵カード
var dx2El = el.querySelector('.dx2-ja');
if (dx2El) {
title = dx2El.textContent.trim();
var dx2Detail = el.querySelector('.dx2-detail-inner');
body = dx2Detail ? dx2Detail.textContent.trim() : '詳細データなし';
}
if (!title) return;
ov = document.createElement('div');
ov.className = 'b3-lp-overlay';
ov.id = 'b3LpOverlay';
ov.style.position = 'fixed';
ov.innerHTML = '<div class="b3-lp-card" style="position:relative;">' +
'<button class="b3-lp-close" id="b3LpClose">✕</button>' +
'<div class="b3-lp-title">' + title + '</div>' +
'<div class="b3-lp-body">' + body + '</div></div>';
document.body.appendChild(ov);
ov.querySelector('#b3LpClose').addEventListener('click', function () { ov.remove(); });
ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
}

document.addEventListener('touchstart', function (e) {
var t = e.target;
if (!t || !t.closest) return;
var card = t.closest('.word-row-container') || t.closest('.pty-card') || t.closest('.dx2-card');
if (!card) return;
pressTarget = card;
pressTimer = setTimeout(function () {
showPreview(pressTarget);
pressTimer = null;
}, 500);
}, { passive: true });

document.addEventListener('touchend', function () {
if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
}, { passive: true });

document.addEventListener('touchmove', function () {
if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
}, { passive: true });
})();

console.log('🔧 第3回パッチ（エラー可視化＋チュートリアル＋控えめ音＋オフライン＋ガチャ履歴＋長押し）適用完了');
})();
// ==========================================================================
// 🔧 修正パッチ③：セーブ失敗根治＋長押しリング＋チュートリアル初回限定
//    ① セーブ失敗の根治（容量オーバー対策＋オートセーブインジケーター）
//    ② 長押しでiPhone画像判定が出る問題をリングUIで置換
//    ③ チュートリアルを「端末初回の1回だけ」に限定
//    ※ multi.js の末尾に貼り付け。app.js / fix.js / style.css / index.html は不変更
// ==========================================================================
(function applyFixPatch3() {
"use strict";
if (window.__fixPatch3Applied) return;
window.__fixPatch3Applied = true;

/* ==================================================================
【1】セーブ失敗の根治
    原因：collectAllData() が localStorage 全キーを収集し、
    容量制限（約5MB）を超えて QuotaExceededError が発生
    対策：巨大キャッシュキーを除外＋サイズチェック＋再試行
================================================================== */
(function fixSaveOverflow() {

/* 収集時に除外する巨大キャッシュキーのプレフィックス */
var EXCLUDE_PREFIXES = [
'save_studio_',      // セーブデータ本体（自分自身を含めない）
'core_v4_cache_',    // 単語帳キャッシュ（巨大）
'core_v4_user_avatar_' // アバター画像base64（巨大）
];

function isExcludedKey(key) {
for (var i = 0; i < EXCLUDE_PREFIXES.length; i++) {
if (key.indexOf(EXCLUDE_PREFIXES[i]) === 0) return true;
}
return false;
}

/* localStorage サイズ推定（バイト単位） */
function estimateLocalStorageSize() {
var total = 0;
try {
for (var i = 0; i < localStorage.length; i++) {
var k = localStorage.key(i);
if (k && !isExcludedKey(k)) {
total += (localStorage.getItem(k) || '').length * 2;
}
}
} catch (e) {}
return total;
}

/* collectAllData を上書き：巨大キャッシュ除外＋サイズ安全化 */
if (typeof window.collectAllData === 'function' && !window.collectAllData.__fixPatched) {
var origCollect = window.collectAllData;
window.collectAllData = function() {
var lsData = {};
try {
for (var i = 0; i < localStorage.length; i++) {
var k = localStorage.key(i);
if (!k || isExcludedKey(k)) continue;
try { lsData[k] = localStorage.getItem(k); } catch (e) {}
}
} catch (e) {}
var memData = {};
try { memData.totalExp = (typeof totalExp !== 'undefined') ? totalExp : 0; } catch (e) {}
try { memData.myName = (typeof myName !== 'undefined') ? myName : ''; } catch (e) {}
try { memData.myTarget = (typeof myTarget !== 'undefined') ? myTarget : ''; } catch (e) {}
try { memData.selectedTitle = (typeof selectedTitle !== 'undefined') ? selectedTitle : ''; } catch (e) {}
try { memData.myFriendList = (typeof myFriendList !== 'undefined') ? myFriendList : []; } catch (e) {}
try { memData.userStats = (typeof userStats !== 'undefined') ? userStats : {}; } catch (e) {}
try { memData.todayStudySeconds = (typeof todayStudySeconds !== 'undefined') ? todayStudySeconds : 0; } catch (e) {}
try { memData.weeklyStudyMinutesLog = (typeof weeklyStudyMinutesLog !== 'undefined') ? weeklyStudyMinutesLog : [0,0,0,0,0,0,0]; } catch (e) {}
try { memData.lastAccessDateStr = (typeof lastAccessDateStr !== 'undefined') ? lastAccessDateStr : ''; } catch (e) {}
try { memData.wordMemory = (typeof wordMemory !== 'undefined') ? wordMemory : {}; } catch (e) {}
try { memData.textHistory = (typeof textHistory !== 'undefined') ? textHistory : []; } catch (e) {}
try { memData.myBookshelf = (typeof myBookshelf !== 'undefined') ? myBookshelf : []; } catch (e) {}
try { memData.myFolders = (typeof myFolders !== 'undefined') ? myFolders : []; } catch (e) {}
try { memData.currentTextbook = (typeof currentTextbook !== 'undefined') ? currentTextbook : ''; } catch (e) {}
try { memData.textbooksPool = (typeof textbooksPool !== 'undefined') ? textbooksPool : []; } catch (e) {}
try { memData.activeCharacter = (typeof activeCharacter !== 'undefined') ? activeCharacter : ''; } catch (e) {}
try { memData.activeWeapon = (typeof activeWeapon !== 'undefined') ? activeWeapon : ''; } catch (e) {}
try { memData.activeArmor = (typeof activeArmor !== 'undefined') ? activeArmor : ''; } catch (e) {}
try { memData.geminiApiKey = (typeof geminiApiKey !== 'undefined') ? geminiApiKey : ''; } catch (e) {}
return { localStorage: lsData, memory: memData };
};
window.collectAllData.__fixPatched = true;
}

/* doSave を上書き：QuotaExceededError 対策＋インジケーター */
if (typeof window.doSave === 'function' && !window.doSave.__fixPatched) {
var origDoSave = window.doSave;
window.doSave = function(slot) {
/* オートセーブ開始インジケーター */
updateSaveIndicator('saving');
var id = (typeof myId !== 'undefined' && myId && myId !== 'GUEST-000') ? myId : null;
if (!id) {
updateSaveIndicator('idle');
return false;
}
var data = window.collectAllData();
var save = {
slot: slot,
savedAt: new Date().toISOString(),
savedAtDisplay: (function() {
var d = new Date();
function p(n) { return (n < 10 ? '0' : '') + n; }
return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
})(),
data: data
};
var raw;
try { raw = JSON.stringify(save); } catch (e) {
updateSaveIndicator('error');
return false;
}
/* サイズチェック：4MB超なら警告 */
var sizeMB = (raw.length * 2) / (1024 * 1024);
if (sizeMB > 4) {
console.warn('[save] データサイズ ' + sizeMB.toFixed(2) + 'MB - 容量制限に近いです');
}
try {
localStorage.setItem('save_studio_' + id + '_' + slot, raw);
updateSaveIndicator('done');
} catch (e) {
console.error('[save] localStorage 保存失敗:', e);
/* 再試行：テキスト履歴と本棚を除外して軽量化 */
try {
if (save.data.localStorage) {
delete save.data.localStorage['textHistory'];
delete save.data.localStorage['myBookshelf'];
}
var raw2 = JSON.stringify(save);
localStorage.setItem('save_studio_' + id + '_' + slot, raw2);
updateSaveIndicator('done');
} catch (e2) {
console.error('[save] 再試行も失敗:', e2);
updateSaveIndicator('error');
return false;
}
}
/* Firebase保存は非同期で失敗無視（ローカル優先） */
try { saveToFirebase(slot, save); } catch (e) {}
return true;
};
window.doSave.__fixPatched = true;
}

/* saveToFirebase を非同期・失敗無視に（存在すれば上書き） */
if (typeof window.saveToFirebase === 'function' && !window.saveToFirebase.__fixPatched) {
var origFbSave = window.saveToFirebase;
window.saveToFirebase = function(slot, save) {
try {
if (!window.db || !window.fbSetDoc || !window.fbDoc) return;
var id = (typeof myId !== 'undefined' && myId && myId !== 'GUEST-000') ? myId : null;
if (!id) return;
var ref = window.fbDoc(window.db, 'users', id, 'saves', slot);
var payload = {
savedAt: save.savedAt,
savedAtDisplay: save.savedAtDisplay,
data: save.data
};
if (typeof window.__sanitizeForFirestore === 'function') {
try { payload = window.__sanitizeForFirestore(payload); } catch (e) {}
}
/* Promise を返すが、呼び出し側では catch しない（非同期処理） */
window.fbSetDoc(ref, payload, { merge: true }).catch(function(e) {
console.warn('[save] Firebase同期失敗（ローカルには保存済み）:', e);
});
} catch (e) {}
};
window.saveToFirebase.__fixPatched = true;
}

/* --- オートセーブインジケーター --- */
var indicatorEl = null;
function ensureIndicator() {
if (indicatorEl && document.body.contains(indicatorEl)) return indicatorEl;
indicatorEl = document.createElement('div');
indicatorEl.id = 'svAutoIndicator';
indicatorEl.style.cssText = 'position:fixed;top:62px;right:12px;z-index:1002;display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.15);font-size:10px;font-weight:700;color:#a89880;opacity:0;transform:translateY(-4px);transition:opacity .3s,transform .3s;pointer-events:none;backdrop-filter:blur(6px);';
indicatorEl.innerHTML = '<span id="svAutoIcon">💾</span><span id="svAutoText"></span>';
document.body.appendChild(indicatorEl);
return indicatorEl;
}
function updateSaveIndicator(state) {
var el = ensureIndicator();
if (!el) return;
var icon = document.getElementById('svAutoIcon');
var text = document.getElementById('svAutoText');
if (state === 'saving') {
el.style.opacity = '1'; el.style.transform = 'translateY(0)';
el.style.borderColor = 'rgba(52,231,228,.4)';
if (icon) icon.textContent = '🔄';
if (text) text.textContent = '保存中…';
} else if (state === 'done') {
el.style.opacity = '1'; el.style.transform = 'translateY(0)';
el.style.borderColor = 'rgba(74,222,128,.4)';
if (icon) icon.textContent = '✅';
if (text) text.textContent = '保存完了';
setTimeout(function() { el.style.opacity = '0'; el.style.transform = 'translateY(-4px)'; }, 2000);
} else if (state === 'error') {
el.style.opacity = '1'; el.style.transform = 'translateY(0)';
el.style.borderColor = 'rgba(239,68,68,.4)';
if (icon) icon.textContent = '⚠️';
if (text) text.textContent = '保存失敗';
setTimeout(function() { el.style.opacity = '0'; el.style.transform = 'translateY(-4px)'; }, 3000);
} else {
el.style.opacity = '0'; el.style.transform = 'translateY(-4px)';
}
}
window.__updateSaveIndicator = updateSaveIndicator;

/* オートセーブ（3分間隔）のラップ：インジケーター付き */
if (typeof window.markDirty === 'function' && !window.markDirty.__fixPatched) {
/* 既存のオートセーブインターバルはそのまま。doSave上書きでインジケーターが動く */
window.markDirty.__fixPatched = true;
}
})();

/* ==================================================================
【2】長押しリングUI（iPhone画像判定の抑制＋明確な長押しフィードバック）
    ・編成カード・ガチャカードの画像に -webkit-touch-callout 禁止
    ・長押し時に円形プログレスリングを表示（500msで一周→詳細モーダル）
    ・既存の長押し処理をリングUIに置換
================================================================== */
(function fixLongPressRing() {

/* --- CSS --- */
(function() {
if (document.getElementById('fixLpRingCss')) return;
var s = document.createElement('style');
s.id = 'fixLpRingCss';
s.textContent = [
/* iPhone画像判定の抑制 */
'#view-party .pty-card,',
'#view-party .pty-card *,',
'#view-party .gcx-card,',
'#view-party .gcx-card *,',
'#view-party .pty-card-emblem,',
'#view-party .pty-card-emblem img,',
'#view-party .pty-slot-ico,',
'#view-party .pty-slot-ico img{',
'  -webkit-touch-callout:none !important;',
'  -webkit-user-select:none !important;',
'  user-select:none !important;',
'  -webkit-user-drag:none !important;',
'}',
/* 長押しリング */
'.lpRing{position:fixed;z-index:9999;pointer-events:none;width:56px;height:56px;border-radius:50%;border:3px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;}',
'.lpRingCircle{position:absolute;inset:-3px;border-radius:50%;}',
'.lpRingCircle svg{width:100%;height:100%;transform:rotate(-90deg);}',
'.lpRingCircle svg circle{fill:none;stroke:rgba(245,196,81,.9);stroke-width:3;stroke-linecap:round;stroke-dasharray:157;stroke-dashoffset:157;transition:stroke-dashoffset .05s linear;}',
'.lpRingIcon{font-size:20px;filter:drop-shadow(0 1px 3px rgba(0,0,0,.5));}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();

/* --- リング要素の生成 --- */
var ringEl = null;
var ringTimer = null;
var ringStartX = 0, ringStartY = 0;
var ringTarget = null;
var ringProgress = 0;
var RING_DURATION = 500; // ms
var ringAnimId = null;
var ringStartTime = 0;

function createRing(x, y, iconText) {
removeRing();
ringEl = document.createElement('div');
ringEl.className = 'lpRing';
ringEl.style.left = (x - 28) + 'px';
ringEl.style.top = (y - 28) + 'px';
ringEl.innerHTML = '<div class="lpRingCircle"><svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="25"/></svg></div><span class="lpRingIcon">' + (iconText || '🔍') + '</span>';
document.body.appendChild(ringEl);
}

function updateRing(progress) {
if (!ringEl) return;
var circle = ringEl.querySelector('circle');
if (circle) {
var offset = 157 * (1 - progress);
circle.style.strokeDashoffset = offset;
}
}

function removeRing() {
if (ringEl && ringEl.parentNode) ringEl.parentNode.removeChild(ringEl);
ringEl = null;
if (ringAnimId) { cancelAnimationFrame(ringAnimId); ringAnimId = null; }
}

function startRingAnim() {
ringStartTime = Date.now();
function tick() {
var elapsed = Date.now() - ringStartTime;
var progress = Math.min(elapsed / RING_DURATION, 1);
updateRing(progress);
if (progress >= 1) {
/* 長押し完了：詳細モーダルを開く */
removeRing();
if (ringTarget) {
openDetailFor(ringTarget);
ringTarget = null;
}
return;
}
ringAnimId = requestAnimationFrame(tick);
}
ringAnimId = requestAnimationFrame(tick);
}

/* --- カードから詳細を開く --- */
function openDetailFor(el) {
/* カードのクリックイベントをシミュレートして展開 */
if (el && el.dispatchEvent) {
try {
var clickEv = new MouseEvent('click', { bubbles: true, cancelable: true });
el.dispatchEvent(clickEv);
} catch (e) {
try { el.click(); } catch (e2) {}
}
}
}

/* --- タッチイベントの監視 --- */
function isCardElement(el) {
if (!el || !el.closest) return false;
return !!(el.closest('.pty-card') || el.closest('.gcx-card') || el.closest('.dx2-card'));
}

function getCardIconText(el) {
if (!el) return '🔍';
var emblem = el.querySelector('.pty-card-emblem, .gcx-card em, .dx2-plate');
if (emblem) {
var img = emblem.querySelector('img');
if (img) return '🖼️';
return emblem.textContent.trim().charAt(0) || '🔍';
}
return '🔍';
}

document.addEventListener('touchstart', function(e) {
var t = e.target;
if (!t || !isCardElement(t)) return;
var touch = e.touches[0];
ringStartX = touch.clientX;
ringStartY = touch.clientY;
ringTarget = t.closest('.pty-card') || t.closest('.gcx-card') || t.closest('.dx2-card');
var iconText = getCardIconText(ringTarget);
/* リングを少し遅延で開始（タップとの区別） */
ringTimer = setTimeout(function() {
createRing(ringStartX, ringStartY, iconText);
startRingAnim();
}, 150);
}, { passive: true });

document.addEventListener('touchmove', function(e) {
if (!ringTimer && !ringEl) return;
var touch = e.touches[0];
var dx = touch.clientX - ringStartX;
var dy = touch.clientY - ringStartY;
var dist = Math.sqrt(dx * dx + dy * dy);
/* 10px以上動いたらキャンセル */
if (dist > 10) {
if (ringTimer) { clearTimeout(ringTimer); ringTimer = null; }
removeRing();
ringTarget = null;
}
}, { passive: true });

document.addEventListener('touchend', function() {
if (ringTimer) { clearTimeout(ringTimer); ringTimer = null; }
/* リングが完了していない場合はキャンセル */
if (ringEl) {
removeRing();
/* 短時間タップなら通常のクリック処理に任せる（何もしない） */
ringTarget = null;
}
}, { passive: true });

document.addEventListener('touchcancel', function() {
if (ringTimer) { clearTimeout(ringTimer); ringTimer = null; }
removeRing();
ringTarget = null;
}, { passive: true });

})();

/* ==================================================================
【3】チュートリアル初回限定（ログアウトしても再表示しない）
    logoutToGate が localStorage.clear() を呼ぶため、
    チュートリアル完了フラグを退避・復元する
================================================================== */
(function fixTutorialOnce() {

var TUTORIAL_KEY = 'b3_tutorial_done';

/* logoutToGate をラップ：チュートリアルフラグを退避・復元 */
if (typeof window.logoutToGate === 'function' && !window.logoutToGate.__fixPatched) {
var origLogout = window.logoutToGate;
window.logoutToGate = function() {
/* フラグ退避 */
var tutorialDone = null;
try { tutorialDone = localStorage.getItem(TUTORIAL_KEY); } catch (e) {}
/* 元の処理を実行（localStorage.clear() が呼ばれる） */
origLogout.apply(this, arguments);
/* clear() 後に復元（ただし location.reload() が呼ばれるので復元は次セッション用） */
/* 実際には reload されるので、localStorage 復元は意味がない。 */
/* 代わりに、別キーに永続フラグを保存する方式を使う */
};
window.logoutToGate.__fixPatched = true;
}

/* 別の永続化方式：IndexedDB にチュートリアル完了フラグを保存 */
function saveTutorialFlagDB(callback) {
try {
if (!window.indexedDB) { if (callback) callback(false); return; }
var request = window.indexedDB.open('aiglish_flags', 1);
request.onupgradeneeded = function(e) {
var db = e.target.result;
if (!db.objectStoreNames.contains('flags')) {
db.createObjectStore('flags', { keyPath: 'key' });
}
};
request.onsuccess = function(e) {
var db = e.target.result;
var tx = db.transaction('flags', 'readwrite');
var store = tx.objectStore('flags');
store.put({ key: TUTORIAL_KEY, value: '1' });
tx.oncomplete = function() { db.close(); if (callback) callback(true); };
tx.onerror = function() { db.close(); if (callback) callback(false); };
};
request.onerror = function() { if (callback) callback(false); };
} catch (e) { if (callback) callback(false); }
}

function loadTutorialFlagDB(callback) {
try {
if (!window.indexedDB) { if (callback) callback(false); return; }
var request = window.indexedDB.open('aiglish_flags', 1);
request.onupgradeneeded = function(e) {
var db = e.target.result;
if (!db.objectStoreNames.contains('flags')) {
db.createObjectStore('flags', { keyPath: 'key' });
}
};
request.onsuccess = function(e) {
var db = e.target.result;
var tx = db.transaction('flags', 'readonly');
var store = tx.objectStore('flags');
var getReq = store.get(TUTORIAL_KEY);
getReq.onsuccess = function() {
var val = getReq.result ? getReq.result.value : null;
db.close();
if (callback) callback(val === '1');
};
getReq.onerror = function() { db.close(); if (callback) callback(false); };
};
request.onerror = function() { if (callback) callback(false); };
} catch (e) { if (callback) callback(false); }
}

/* チュートリアル完了時に IndexedDB にも保存する */
/* 既存のチュートリアル done() 関数をフック */
var checkInterval = setInterval(function() {
/* b3_tutorial_done が localStorage に書かれたら IndexedDB にも同期 */
try {
if (localStorage.getItem(TUTORIAL_KEY) === '1') {
saveTutorialFlagDB(null);
clearInterval(checkInterval);
}
} catch (e) {}
}, 1000);

/* ページ読み込み時に IndexedDB のフラグを localStorage に復元 */
/* （logoutToGate の localStorage.clear() 後に再ログインしたとき用） */
(function restoreTutorialFlag() {
loadTutorialFlagDB(function(done) {
if (done) {
try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch (e) {}
}
});
/* 起動後少し待ってから（loadLocalState完了後） */
setTimeout(function() {
loadTutorialFlagDB(function(done) {
if (done) {
try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch (e) {}
}
});
}, 2000);
})();

/* loadLocalState をラップ：完了後に IndexedDB から復元 */
if (typeof window.loadLocalState === 'function' && !window.loadLocalState.__fixTutPatched) {
var origLoad = window.loadLocalState;
window.loadLocalState = function() {
var result = origLoad.apply(this, arguments);
if (result && typeof result.then === 'function') {
return result.then(function(r) {
/* IndexedDB からチュートリアルフラグを復元 */
loadTutorialFlagDB(function(done) {
if (done) {
try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch (e) {}
}
});
return r;
});
}
/* IndexedDB からチュートリアルフラグを復元 */
loadTutorialFlagDB(function(done) {
if (done) {
try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch (e) {}
}
});
return result;
};
window.loadLocalState.__fixTutPatched = true;
}
})();

console.log('🔧 修正パッチ③（セーブ根治＋長押しリング＋チュートリアル初回限定）適用完了');
})();
// ==========================================================================
// ☁️ セーブFirebase一本化パッチ（末尾追記・既存コードは不変更）
//    ・保存先はクラウド(Firebase)のみ。ローカルには保存しない
//    ・保存／読み込みの失敗は必ずトースト＋インジケータで通知（黙らない）
//    ・自動セーブ：3分ごと＋データ変更後＋画面を閉じる時
//    ・自動セーブの結果もインジケータで表示（失敗時も出す・連発は抑制）
//    ・大容量データは分割保存（Firestore 1MB制限対策）
//    ・💾ボタンはこのパッチのクラウド専用パネルを開く（旧パネルは無効化）
// ==========================================================================
(function applyFirebaseSavePatch() {
"use strict";
if (window.__fbSaveApplied) return;
window.__fbSaveApplied = true;

var SLOTS = ['slot1', 'slot2', 'auto'];
var SLOT_NAMES = { slot1: 'セーブ1', slot2: 'セーブ2', auto: 'オートセーブ' };
var CHUNK = 200000; // 分割サイズ（文字数）

/* ---------- ヘルパー ---------- */
function uid() { return (typeof myId !== 'undefined' && myId && myId !== 'GUEST-000') ? myId : null; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function nowDisplay() {
var d = new Date();
function p(n) { return (n < 10 ? '0' : '') + n; }
return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
function toast(msg, type) { try { if (window.showToast) window.showToast(msg, type || 'ok'); } catch (e) {} }
function fbOk() { return !!(window.db && window.fbSetDoc && window.fbGetDoc && window.fbDoc); }

/* ---------- スタイル ---------- */
(function injectFbsvCss() {
if (document.getElementById('fbsvCss')) return;
var s = document.createElement('style');
s.id = 'fbsvCss';
s.textContent = [
'.fbsv-modal{position:fixed;inset:0;z-index:60060;display:flex;align-items:center;justify-content:center;background:rgba(5,3,12,.82);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding:20px;}',
'.fbsv-card{width:min(92vw,400px);max-height:85vh;overflow-y:auto;-webkit-overflow-scrolling:touch;border-radius:18px;padding:22px 18px;background:linear-gradient(168deg,rgba(46,38,28,.96),rgba(24,18,12,.98));border:1px solid rgba(200,144,42,.4);box-shadow:0 24px 64px rgba(0,0,0,.6);}',
'.fbsv-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}',
'.fbsv-title{font-family:"Noto Serif JP",serif;font-size:18px;font-weight:900;color:#f3e5c0;}',
'.fbsv-close{width:32px;height:32px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#a89880;font-size:16px;cursor:pointer;}',
'.fbsv-offline{display:none;margin:6px 0 10px;padding:8px 12px;border-radius:10px;background:rgba(245,158,11,.10);border:1px solid rgba(245,158,11,.4);color:#fcd34d;font-size:11px;font-weight:700;}',
'.fbsv-offline.show{display:block;}',
'.fbsv-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 14px;}',
'.fbsv-tab{padding:11px;border-radius:10px;border:1.5px solid rgba(255,255,255,.15);background:rgba(0,0,0,.3);color:#a89880;font-family:"Noto Serif JP",serif;font-size:13px;font-weight:900;cursor:pointer;}',
'.fbsv-tab.on{border-color:rgba(245,196,81,.7);background:rgba(245,196,81,.12);color:#fde68a;}',
'.fbsv-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.25);margin-bottom:10px;}',
'.fbsv-name{font-family:"Noto Serif JP",serif;font-size:14px;font-weight:900;color:#f3e5c0;}',
'.fbsv-date{font-family:ui-monospace,monospace;font-size:11px;color:#8a7a5f;margin-top:3px;}',
'.fbsv-btn{padding:9px 18px;border-radius:9px;border:1.5px solid rgba(245,196,81,.5);background:linear-gradient(180deg,#4a3b24,#2e2415 55%,#1f1809);color:#fde68a;font-family:"Noto Serif JP",serif;font-size:12px;font-weight:900;cursor:pointer;}',
'.fbsv-btn:active{transform:scale(.96);}',
'.fbsv-btn.load{border-color:rgba(52,231,228,.5);background:linear-gradient(180deg,#1a3a3a,#0e2424 55%,#081616);color:#9af6f1;}',
'.fbsv-btn.dis{opacity:.45;cursor:not-allowed;}',
'.fbsv-note{margin-top:10px;padding:10px 12px;border-radius:9px;border:1px dashed rgba(200,144,42,.25);font-size:10.5px;font-weight:600;color:#a89880;line-height:1.6;}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();

/* ---------- インジケータ（保存中/成功/失敗） ---------- */
var indEl = null, indTimer = null;
function ensureInd() {
if (indEl && document.body.contains(indEl)) return indEl;
indEl = document.createElement('div');
indEl.id = 'fbSaveInd';
indEl.style.cssText = 'position:fixed;top:64px;right:10px;z-index:1002;padding:5px 12px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.05em;pointer-events:none;opacity:0;transform:translateY(-6px);transition:all .3s ease;background:rgba(0,0,0,.7);border:1px solid rgba(255,255,255,.2);color:#e2e8f0;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);font-family:"Noto Sans JP",sans-serif;';
document.body.appendChild(indEl);
return indEl;
}
function ind(state, text) {
var el = ensureInd();
el.textContent = (state === 'saving' ? '🔄 ' : state === 'ok' ? '✅ ' : '⚠️ ') + text;
el.style.borderColor = state === 'ok' ? 'rgba(74,222,128,.6)' : state === 'err' ? 'rgba(248,113,113,.6)' : 'rgba(52,231,228,.5)';
el.style.opacity = '1'; el.style.transform = 'translateY(0)';
clearTimeout(indTimer);
if (state !== 'saving') indTimer = setTimeout(function () { el.style.opacity = '0'; el.style.transform = 'translateY(-6px)'; }, state === 'err' ? 4000 : 2500);
}

/* ---------- データ収集（ローカル全キーのスナップショット） ---------- */
function collect() {
var ls = {};
try {
for (var i = 0; i < localStorage.length; i++) {
var k = localStorage.key(i);
if (!k || k.indexOf('save_studio_') === 0 || k.indexOf('fbsave_meta_') === 0) continue;
try { ls[k] = localStorage.getItem(k); } catch (e) {}
}
} catch (e) {}
return ls;
}

/* ---------- メタ（日時）キャッシュ ---------- */
var cloudMetaCache = {};
function metaKey(slot) { return 'fbsave_meta_' + uid() + '_' + slot; }
function localMeta(slot) { try { return JSON.parse(localStorage.getItem(metaKey(slot)) || 'null'); } catch (e) { return null; } }
function setLocalMeta(slot, m) { try { localStorage.setItem(metaKey(slot), JSON.stringify(m)); } catch (e) {} }
function metaFor(slot) { return cloudMetaCache[slot] || localMeta(slot); }

/* ---------- 失敗通知（自動セーブの連発は抑制） ---------- */
var lastAutoErr = 0;
function failNotify(msg, manual) {
ind('err', manual ? '保存失敗' : '自動セーブ失敗');
if (manual) { toast(msg, 'err'); return; }
var now = Date.now();
if (now - lastAutoErr > 60000) { lastAutoErr = now; toast(msg, 'err'); }
}

/* ---------- クラウドへ保存 ---------- */
function cloudSave(slot, manual) {
var id = uid();
if (!id) { if (manual) { toast('先にログインしてください', 'err'); } return Promise.reject(new Error('no login')); }
if (!fbOk()) { failNotify('保存に失敗しました：通信未接続', manual); return Promise.reject(new Error('no fb')); }
ind('saving', '保存中…');
var raw;
try { raw = JSON.stringify(collect()); } catch (e) { failNotify('保存に失敗しました：データ処理エラー', manual); return Promise.reject(e); }
var chunks = [];
for (var i = 0; i < raw.length; i += CHUNK) chunks.push(raw.substr(i, CHUNK));
if (!chunks.length) chunks = [''];
var meta = { savedAt: new Date().toISOString(), savedAtDisplay: nowDisplay(), partCount: chunks.length, v: 2 };
return window.fbSetDoc(window.fbDoc(window.db, 'users', id, 'saves', slot), meta, { merge: false }).then(function () {
var chain = Promise.resolve();
chunks.forEach(function (c, idx) {
chain = chain.then(function () {
return window.fbSetDoc(window.fbDoc(window.db, 'users', id, 'saves', slot, 'parts', 'p' + idx), { d: c }, { merge: false });
});
});
return chain;
}).then(function () {
var old = localMeta(slot);
if (old && old.partCount > chunks.length && typeof window.fbDeleteDoc === 'function') {
for (var x = chunks.length; x < old.partCount; x++) {
try { window.fbDeleteDoc(window.fbDoc(window.db, 'users', id, 'saves', slot, 'parts', 'p' + x)).catch(function () {}); } catch (e) {}
}
}
cloudMetaCache[slot] = meta;
setLocalMeta(slot, { savedAtDisplay: meta.savedAtDisplay, partCount: chunks.length });
ind('ok', manual ? '保存しました' : '自動セーブしました');
if (manual) toast('💾 クラウドに保存しました', 'ok');
}).catch(function (e) {
console.error('[fbSave] save error:', e);
failNotify('保存に失敗しました。通信状態を確認してください', manual);
});
}

/* ---------- クラウドから読み込み ---------- */
function cloudLoad(slot) {
var id = uid();
if (!id) { toast('先にログインしてください', 'err'); return; }
if (!fbOk()) { toast('通信できません。電波の良い場所でやり直してください', 'err'); return; }
ind('saving', '読み込み中…');
window.fbGetDoc(window.fbDoc(window.db, 'users', id, 'saves', slot)).then(function (snap) {
if (!snap || !snap.exists()) { ind('err', 'データなし'); toast('セーブデータがありません', 'warn'); return; }
var meta = snap.data() || {};
var count = meta.partCount || 0;
var chain = Promise.resolve('');
for (var i = 0; i < count; i++) {
chain = (function (c, idx) {
return c.then(function (acc) {
return window.fbGetDoc(window.fbDoc(window.db, 'users', id, 'saves', slot, 'parts', 'p' + idx)).then(function (s2) {
return acc + ((s2 && s2.exists() && s2.data()) ? (s2.data().d || '') : '');
});
});
})(chain, i);
}
chain.then(function (raw) {
var ls;
try { ls = JSON.parse(raw); } catch (e) { ind('err', '破損'); toast('セーブデータが破損しています', 'err'); return; }
for (var k in ls) { try { localStorage.setItem(k, ls[k]); } catch (e) {} }
setLocalMeta(slot, { savedAtDisplay: meta.savedAtDisplay, partCount: count });
toast('✅ 読み込みました。再起動します…', 'ok');
setTimeout(function () { location.reload(); }, 700);
});
}).catch(function (e) {
console.error('[fbSave] load error:', e);
ind('err', '読み込み失敗');
toast('読み込みに失敗しました。通信状態を確認してください', 'err');
});
}

/* ---------- パネル ---------- */
var curTab = 'save';
function closePanel() { var m = document.getElementById('fbsvModal'); if (m && m.parentNode) m.parentNode.removeChild(m); }
function renderRows() {
var body = document.getElementById('fbsvBody');
if (!body) return;
var html = '';
SLOTS.forEach(function (slot) {
var meta = metaFor(slot);
var dateStr = meta ? meta.savedAtDisplay : '未セーブ';
var btn;
if (curTab === 'save') btn = '<button type="button" class="fbsv-btn" data-fbsave="' + slot + '">' + (meta ? '上書き' : 'セーブ') + '</button>';
else btn = meta ? '<button type="button" class="fbsv-btn load" data-fbload="' + slot + '">ロード</button>' : '<button type="button" class="fbsv-btn dis" disabled>データなし</button>';
html += '<div class="fbsv-row"><div><div class="fbsv-name">' + SLOT_NAMES[slot] + '</div><div class="fbsv-date">' + esc(dateStr) + '</div></div>' + btn + '</div>';
});
body.innerHTML = html;
}
function refreshMetaFromCloud() {
var note = document.getElementById('fbsvOffline');
var id = uid();
if (!id || !fbOk()) { if (note) note.classList.add('show'); renderRows(); return; }
var pend = 0;
SLOTS.forEach(function (slot) {
pend++;
window.fbGetDoc(window.fbDoc(window.db, id && window.db ? 'users' : 'users', id, 'saves', slot)).then(function (s) {
if (s && s.exists()) { var d = s.data() || {}; cloudMetaCache[slot] = { savedAtDisplay: d.savedAtDisplay, partCount: d.partCount }; setLocalMeta(slot, cloudMetaCache[slot]); }
}).catch(function () { if (note) note.classList.add('show'); }).then(function () { if (--pend === 0) renderRows(); });
});
}
function openPanel() {
closePanel();
if (!uid()) { toast('先にログインしてください', 'err'); return; }
curTab = 'save';
var m = document.createElement('div');
m.id = 'fbsvModal'; m.className = 'fbsv-modal';
m.innerHTML = '<div class="fbsv-card">' +
'<div class="fbsv-head"><div class="fbsv-title">💾 データ保存 / 読み込み</div><button type="button" class="fbsv-close" id="fbsvClose">✕</button></div>' +
'<div class="fbsv-offline" id="fbsvOffline">⚠️ 通信につながりません。表示は古い可能性があります。</div>' +
'<div class="fbsv-tabs"><button type="button" class="fbsv-tab on" id="fbsvTabSave">セーブ</button><button type="button" class="fbsv-tab" id="fbsvTabLoad">ロード</button></div>' +
'<div id="fbsvBody"></div>' +
'<div class="fbsv-note">データはクラウドに保存されます。<br>機種変更しても、同じIDでログインすれば引き継げます。</div>' +
'</div>';
document.body.appendChild(m);
m.querySelector('#fbsvClose').onclick = closePanel;
m.addEventListener('click', function (e) { if (e.target === m) closePanel(); });
m.querySelector('#fbsvTabSave').onclick = function () { curTab = 'save'; m.querySelector('#fbsvTabSave').classList.add('on'); m.querySelector('#fbsvTabLoad').classList.remove('on'); renderRows(); };
m.querySelector('#fbsvTabLoad').onclick = function () { curTab = 'load'; m.querySelector('#fbsvTabLoad').classList.add('on'); m.querySelector('#fbsvTabSave').classList.remove('on'); renderRows(); };
m.querySelector('#fbsvBody').addEventListener('click', function (e) {
var t = e.target; if (!t || !t.closest) return;
var sv = t.closest('[data-fbsave]');
if (sv) {
var slot = sv.getAttribute('data-fbsave');
var meta = metaFor(slot);
if (meta && !confirm(SLOT_NAMES[slot] + ' には既にデータがあります（' + meta.savedAtDisplay + '）。\n上書きしますか？')) return;
cloudSave(slot, true).then(function () { refreshMetaFromCloud(); });
return;
}
var ld = t.closest('[data-fbload]');
if (ld) {
var slot2 = ld.getAttribute('data-fbload');
if (!confirm(SLOT_NAMES[slot2] + ' を読み込みますか？\n今の端末のデータは上書きされます。')) return;
cloudLoad(slot2);
}
});
renderRows();
refreshMetaFromCloud();
}

/* ---------- 💾ボタン乗っ取り（旧パネルは開かない） ---------- */
function ensureBtn() {
var b = document.getElementById('headerSaveBtn');
if (b) return;
var h = document.querySelector('.app-header');
if (!h) return;
b = document.createElement('button');
b.id = 'headerSaveBtn'; b.type = 'button'; b.innerHTML = '💾';
b.style.cssText = 'position:absolute;right:16px;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid rgba(0,240,255,.4);color:#00F0FF;font-size:16px;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:1001;';
h.appendChild(b);
}
document.addEventListener('click', function (e) {
var t = e.target; if (!t || !t.closest) return;
if (t.closest('#headerSaveBtn')) { e.preventDefault(); e.stopPropagation(); openPanel(); }
}, true);

/* ---------- 自動セーブ ---------- */
var dirty = false, dbT = null;
function markDirty() {
dirty = true;
clearTimeout(dbT);
dbT = setTimeout(function () { if (dirty && uid()) { dirty = false; cloudSave('auto', false); } }, 3000);
}
if (typeof window.saveUserStats === 'function' && !window.saveUserStats.__fbsWrapped) {
var origSave = window.saveUserStats;
window.saveUserStats = function () { var r = origSave.apply(this, arguments); markDirty(); return r; };
window.saveUserStats.__fbsWrapped = true;
}
setInterval(function () { if (dirty && uid()) { dirty = false; cloudSave('auto', false); } }, 180000);
window.addEventListener('pagehide', function () { if (dirty && uid()) { dirty = false; cloudSave('auto', false); } });
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && dirty && uid()) { dirty = false; cloudSave('auto', false); } });

/* ---------- ログイン後：ボタン確保＋初回バックアップ ---------- */
var bootedOnce = false;
if (typeof window.loadLocalState === 'function' && !window.loadLocalState.__fbsWrapped) {
var origLoad = window.loadLocalState;
window.loadLocalState = function () {
var r = origLoad.apply(this, arguments);
return Promise.resolve(r).then(function (v) {
ensureBtn();
if (!bootedOnce) {
bootedOnce = true;
setTimeout(function () { if (uid()) cloudSave('auto', false); }, 4000);
}
return v;
});
};
window.loadLocalState.__fbsWrapped = true;
}
(function bootFbsv() {
function run() { ensureBtn(); }
if (document.readyState !== 'loading') setTimeout(run, 400);
else document.addEventListener('DOMContentLoaded', function () { setTimeout(run, 400); });
})();
console.log('☁️ セーブFirebase一本化パッチ適用完了（失敗時通知＋自動セーブ表示）');
})();
// ==========================================================================
// 💾 保存プログレスゲージパッチ（末尾追記・既存コード不変更）
//    ・保存（手動/オート）中に「💾 保存中 NN%」ゲージを表示
//    ・完了で「✅ 保存完了 100%」→1.6秒で消灯
//    ・失敗で「⚠️ 保存失敗」→3.2秒で消灯
//    ・仕組み：window.fbSetDoc をラップし、
//      users/{id}/saves/{slot}（メタ）と .../parts/pN（分割データ）の
//      書き込み回数から進捗%を計算（既存パッチには一切触れない）
//    ・25秒無反応ウォッチドッグ＝詰まりでも必ず結果表示
//    ※ app.js / fix.js / style.css / index.html は不変更
// ==========================================================================
(function applySaveProgressGaugePatch() {
"use strict";
if (window.__saveGaugeApplied) return;
window.__saveGaugeApplied = true;

/* ---------- スタイル ---------- */
(function injectGaugeCss() {
if (document.getElementById('svGaugeCss')) return;
var s = document.createElement('style');
s.id = 'svGaugeCss';
s.textContent = [
'#svGauge{position:fixed;top:calc(56px + env(safe-area-inset-top));left:50%;transform:translateX(-50%) translateY(-8px);z-index:99995;',
'  display:flex;align-items:center;gap:8px;padding:7px 14px;border-radius:999px;',
'  background:rgba(7,11,25,.80);border:1px solid rgba(0,240,255,.35);',
'  box-shadow:0 0 14px rgba(0,240,255,.25),0 6px 18px rgba(0,0,0,.5);',
'  backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);',
'  opacity:0;transition:opacity .25s ease,transform .25s ease;pointer-events:none;}',
'#svGauge.show{opacity:1;transform:translateX(-50%) translateY(0);}',
'#svGauge .sg-ico{font-size:13px;line-height:1;}',
'#svGauge .sg-bar{width:110px;height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden;flex:0 0 auto;}',
'#svGauge .sg-fill{height:100%;width:0%;border-radius:3px;background:linear-gradient(90deg,#00F0FF,#C084FC);box-shadow:0 0 8px rgba(0,240,255,.7);transition:width .18s ease;}',
'#svGauge .sg-txt{font-family:ui-monospace,monospace;font-size:10px;font-weight:800;color:#E2E8F0;letter-spacing:.05em;min-width:74px;text-align:right;white-space:nowrap;}',
'#svGauge.ok{border-color:rgba(16,185,129,.6);box-shadow:0 0 14px rgba(16,185,129,.35),0 6px 18px rgba(0,0,0,.5);}',
'#svGauge.ok .sg-fill{background:linear-gradient(90deg,#34D399,#10B981);box-shadow:0 0 8px rgba(16,185,129,.7);}',
'#svGauge.err{border-color:rgba(239,68,68,.6);box-shadow:0 0 14px rgba(239,68,68,.4),0 6px 18px rgba(0,0,0,.5);}',
'#svGauge.err .sg-fill{background:linear-gradient(90deg,#F87171,#EF4444);box-shadow:0 0 8px rgba(239,68,68,.7);}'
].join('\n');
(document.head || document.documentElement).appendChild(s);
})();

/* ---------- ゲージDOM ---------- */
var gEl = null, gFill = null, gTxt = null, gIco = null;
var hideT = null, dogT = null;
var st = { active: false, partTotal: 1, done: 0 };

function ensureGauge() {
if (gEl && document.body.contains(gEl)) return;
gEl = document.createElement('div');
gEl.id = 'svGauge';
gEl.innerHTML = '<span class="sg-ico">💾</span><span class="sg-bar"><span class="sg-fill"></span></span><span class="sg-txt">保存中 0%</span>';
document.body.appendChild(gEl);
gFill = gEl.querySelector('.sg-fill');
gTxt = gEl.querySelector('.sg-txt');
gIco = gEl.querySelector('.sg-ico');
}
function paint(pct) {
if (!gEl) return;
if (gFill) gFill.style.width = Math.max(0, Math.min(100, pct)) + '%';
if (gTxt) gTxt.textContent = '保存中 ' + Math.max(0, Math.min(100, pct)) + '%';
}
function kickDog() {
clearTimeout(dogT);
dogT = setTimeout(function () { if (st.active) fail(); }, 25000);
}
function show() {
ensureGauge();
gEl.classList.remove('ok', 'err');
gEl.classList.add('show');
if (gIco) gIco.textContent = '💾';
kickDog();
}
function done() {
clearTimeout(dogT);
st.active = false;
ensureGauge();
gEl.classList.remove('err');
gEl.classList.add('ok', 'show');
if (gFill) gFill.style.width = '100%';
if (gTxt) gTxt.textContent = '保存完了 100%';
if (gIco) gIco.textContent = '✅';
clearTimeout(hideT);
hideT = setTimeout(function () { if (gEl) gEl.classList.remove('show'); }, 1600);
}
function fail() {
clearTimeout(dogT);
st.active = false;
ensureGauge();
gEl.classList.remove('ok');
gEl.classList.add('err', 'show');
if (gTxt) gTxt.textContent = '保存失敗';
if (gIco) gIco.textContent = '⚠️';
clearTimeout(hideT);
hideT = setTimeout(function () { if (gEl) gEl.classList.remove('show'); }, 3200);
}

/* ---------- fbSetDoc ラップ（進捗計測） ---------- */
function refPath(ref) {
try { if (ref && typeof ref.path === 'string') return ref.path; } catch (e) {}
try { if (ref && ref._key && typeof ref._key.path === 'string') return ref._key.path; } catch (e) {}
return '';
}
function partCountOf(data) {
if (!data || typeof data !== 'object') return 0;
var n = data.partCount || data.parts || data.totalParts || 0;
n = parseInt(n, 10);
return (isFinite(n) && n > 0) ? n : 0;
}
function hook() {
if (typeof window.fbSetDoc !== 'function' || window.fbSetDoc.__gaugeWrapped) return true;
var prev = window.fbSetDoc;
var wrapped = function (ref, data, opts) {
var path = refPath(ref);
var mMeta = /\/saves\/([^\/]+)$/.exec(path);
var mPart = /\/saves\/([^\/]+)\/parts\/p(\d+)$/.exec(path);
var p = prev.apply(this, arguments);
try {
if (mMeta) {
st.active = true;
st.partTotal = Math.max(1, partCountOf(data));
st.done = 0;
clearTimeout(hideT);
show();
paint(st.partTotal > 1 ? 2 : 30);
if (st.partTotal <= 1) {
p.then(function () { if (st.active) done(); }, function () { fail(); });
}
} else if (mPart) {
if (!st.active) { st.active = true; st.partTotal = Math.max(st.partTotal, 1); st.done = 0; clearTimeout(hideT); show(); }
var idx = parseInt(mPart[2], 10) || 0;
st.done = Math.max(st.done, idx + 1);
kickDog();
paint(Math.round((st.done / st.partTotal) * 96));
p.then(function () {
if (st.active && st.done >= st.partTotal) done();
}, function () { fail(); });
}
} catch (e) {}
return p;
};
wrapped.__gaugeWrapped = true;
window.fbSetDoc = wrapped;
return true;
}
if (!hook()) {
var tries = 0;
var iv = setInterval(function () {
tries++;
if (hook() || tries > 20) clearInterval(iv);
}, 300);
}
console.log('💾 保存プログレスゲージパッチ適用完了');
})();
// ==========================================================================
// 🛠️ 最終修正パッチ（gacha.js末尾追記・既存コード不変更）
//    ① セーブ：保存後にヘッダーゲージを即再描画
//    ② ログインボーナス：初回ログイン時に即発火（60秒待ちを解消）
//    ③ 攻撃表示：倍率→実数値（強化Lv連動）
//    ④ キャラ強化ボタン復旧
//    ⑤ 進捗ゲージ：実際の値に同期
// ==========================================================================
(function applyFinalFixPatch() {
"use strict";
if (window.__finalFixApplied) return;
window.__finalFixApplied = true;

/* ===== 共通ヘルパー ===== */
function _st() { return (typeof userStats !== 'undefined' && userStats && typeof userStats === 'object') ? userStats : null; }
function _dateKey() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function _loggedIn() { return (typeof myId !== 'undefined') && myId && myId !== 'GUEST-000'; }

/* ===== 強化Lv・実数値計算 ===== */
var CHAR_BASE_ATK = 300;
function _enhLv(id) { var s = _st(); if (!s) return 0; var o = s.gacha_enhance || {}; return o[id] || 0; }
function _calcAtk(id) { return Math.round(CHAR_BASE_ATK * (1 + _enhLv(id) / 100)); }
function _calcHp(id) { return Math.round(3500 * (1 + _enhLv(id) / 100)); }

/* ===== ① セーブ後にゲージ再描画 ===== */
var _prevSave = window.saveUserStats;
window.saveUserStats = async function () {
    var r = _prevSave ? await _prevSave.apply(this, arguments) : undefined;
    try { if (typeof window.applyProfileToUi === 'function') window.applyProfileToUi(); } catch (e) {}
    return r;
};

/* ===== ② ログインボーナス即時発火 ===== */
var _lbChecked = false;
function _triggerLoginBonus() {
    if (_lbChecked) return;
    if (!_loggedIn()) return;
    var s = _st();
    if (!s) return;
    if (s.gacha_login_date === _dateKey()) return;
    if (window.__gcLoginShown) return;
    window.__gcLoginShown = true;
    _lbChecked = true;

    var today = _dateKey();
    var yest = (function () { var d = new Date(Date.now() - 86400000); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); })();
    var last = s.gacha_login_date || '';
    var streak = (last === yest) ? (parseInt(s.gacha_login_streak) || 0) + 1 : 1;
    var dow = new Date().getDay();
    var rw = { gold: 0, tChar: 0, tItem: 0 };
    if (dow === 6) { rw.tChar += 1; rw.tItem += 1; } else { rw.gold += 50; }
    if (streak > 0 && streak % 7 === 0) { rw.tChar += 1; rw.tItem += 1; }

    var dots = ''; var pos = ((streak - 1) % 7) + 1;
    for (var i = 1; i <= 7; i++) dots += '<span class="gcLoginDot' + (i <= pos ? ' on' : '') + '"></span>';
    var rows = '';
    if (rw.gold > 0) rows += '<div class="gcRewardRow">🪙 ゴールド <b>+' + rw.gold + '</b></div>';
    if (rw.tChar > 0) rows += '<div class="gcRewardRow">🎟️ キャラチケット <b>+' + rw.tChar + '</b></div>';
    if (rw.tItem > 0) rows += '<div class="gcRewardRow">🎟️ アイテムチケット <b>+' + rw.tItem + '</b></div>';
    if (streak % 7 === 0) rows += '<div class="gcRewardRow">🎉 連続 ' + streak + ' 日ボーナス込み！</div>';

    var old = document.querySelector('.gcModal');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var m = document.createElement('div');
    m.className = 'gcModal';
    m.innerHTML = '<div class="gcModalCard"><div class="gcModalTitle">📅 ログインボーナス</div><div class="gcModalSub">連続 ' + streak + ' 日目' + (dow === 6 ? '（土曜特典）' : '') + '</div><div class="gcLoginDots">' + dots + '</div>' + rows + '<button type="button" class="gcBtnGold" id="gcLoginClaim">受け取る</button></div>';
    document.body.appendChild(m);
    m.querySelector('#gcLoginClaim').addEventListener('click', function () {
        var s2 = _st();
        if (s2 && s2.gacha_login_date !== today) {
            s2.gold = (parseInt(s2.gold) || 0) + rw.gold;
            s2.gacha_ticket_char = (parseInt(s2.gacha_ticket_char) || 0) + rw.tChar;
            s2.gacha_ticket_item = (parseInt(s2.gacha_ticket_item) || 0) + rw.tItem;
            s2.gacha_login_date = today;
            s2.gacha_login_streak = streak;
            try { if (typeof window.saveUserStats === 'function') window.saveUserStats(); } catch (e) {}
        }
        if (m.parentNode) m.parentNode.removeChild(m);
        try { if (typeof window.showToast === 'function') window.showToast('📅 ログインボーナスを受け取りました！', 'ok'); } catch (e) {}
    });
}
(function _lbWatch() {
    var n = 0;
    var iv = setInterval(function () {
        n++;
        if (_loggedIn()) { clearInterval(iv); setTimeout(_triggerLoginBonus, 400); }
        else if (n > 90) clearInterval(iv);
    }, 1000);
})();

/* ===== ③ 攻撃実数値＋④ 強化ボタン＋⑤ 進捗同期 ===== */
function _fixPartyCards() {
    var cards = document.querySelectorAll('.pty-card[data-pcvcard^="char_"], .pcv-card[data-pcvcard^="char_"], .pty-card[data-card^="char_"]');
    for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var id = '';
        var dc = card.getAttribute('data-pcvcard') || card.getAttribute('data-card') || '';
        if (dc.indexOf('char_') === 0) id = dc.slice(5);
        if (!id) continue;
        var lv = _enhLv(id);
        var stats = card.querySelectorAll('.pty-stat');
        for (var j = 0; j < stats.length; j++) {
            var t = stats[j].textContent || '';
            if (t.indexOf('×') !== -1 && t.indexOf('攻撃') !== -1) {
                var b = stats[j].querySelector('b');
                if (b) b.textContent = _calcAtk(id);
            }
            if (t.indexOf('HP') !== -1 && t.indexOf('強化') === -1) {
                var b2 = stats[j].querySelector('b');
                if (b2) b2.textContent = _calcHp(id);
            }
            if (t.indexOf('強化') !== -1) {
                var b3 = stats[j].querySelector('b');
                if (b3) b3.textContent = 'Lv.' + lv;
            }
        }
        if (!card.querySelector('[data-ffenh]') && id === 'tangon') {
            var acts = card.querySelector('.pty-card-actions');
            if (acts) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'pty-btn';
                btn.setAttribute('data-ffenh', id);
                btn.textContent = '⚒️ 強化する';
                acts.appendChild(btn);
            }
        }
    }
}
document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var btn = t.closest('[data-ffenh]');
    if (btn) {
        e.stopPropagation();
        var id = btn.getAttribute('data-ffenh');
        try { if (typeof window.gachaEnhance === 'function') window.gachaEnhance(id); } catch (e2) {}
        setTimeout(_fixPartyCards, 120);
    }
}, true);

/* ===== ⑤ 進捗ゲージ同期 ===== */
function _syncPity() {
    var s = _st();
    if (!s) return;
    var banner = window.__gcBanner || 'char';
    ['gold', 'ticket'].forEach(function (lane) {
        var key = 'gacha_pity_' + banner + ' ' + lane;
        var v = parseInt(s[key]) || 0;
        var pct = Math.min(100, v / 100 * 100);
        var rows = document.querySelectorAll('.gcPityRow');
        for (var i = 0; i < rows.length; i++) {
            var lbl = rows[i].querySelector('.gcPityLbl');
            if (!lbl) continue;
            var isGold = lbl.textContent.indexOf('ゴールド') !== -1;
            if ((lane === 'gold' && isGold) || (lane === 'ticket' && !isGold)) {
                var fill = rows[i].querySelector('.gcPityFill');
                if (fill) fill.style.width = pct + '%';
                var num = rows[i].querySelector('.gcPityNum');
                if (num) num.textContent = Math.min(v, 100) + '/100';
            }
        }
    });
}

/* ===== タブ切替・定期監視 ===== */
var _prevTabFF = window.switchTab;
window.switchTab = function (tabId) {
    var r = _prevTabFF ? _prevTabFF.apply(this, arguments) : undefined;
    if (tabId === 'party') setTimeout(_fixPartyCards, 120);
    return r;
};
setInterval(function () {
    _fixPartyCards();
    _syncPity();
}, 700);

console.log('🛠️ 最終修正パッチ（セーブ即時反映＋ログインボーナス即発火＋攻撃実数値＋強化復旧＋進捗同期）適用完了');
})();
// ==========================================================================
// 🔧 最終修正パッチ v2（末尾追記・既存コード不変更）
//    ① Firestore書き込みスロットリング（resource-exhausted対策）
//    ② 保存後にヘッダーLvゲージ即時更新
//    ③ ログインボーナス即時発火（500msポーリング）
//    ④ 攻撃倍率→実数値表示
//    ⑤ キャラ強化ボタン復旧
//    ⑥ 進捗ゲージ（pity）同期
// ==========================================================================
(function applyFinalFixPatch2() {
"use strict";
if (window.__finalFix2Applied) return;
window.__finalFix2Applied = true;

/* ===== ① Firestore書き込みスロットリング ===== */
window.__fbWriteThrottle = window.__fbWriteThrottle || { last: 0, timer: null, pending: false };
var __origSaveUS2 = window.saveUserStats;
window.saveUserStats = function() {
    var now = Date.now();
    var st = window.__fbWriteThrottle;
    var elapsed = now - st.last;
    if (elapsed < 2500) {
        if (!st.pending) {
            st.pending = true;
            clearTimeout(st.timer);
            st.timer = setTimeout(function() {
                st.pending = false;
                st.last = Date.now();
                try { if (typeof __origSaveUS2 === 'function') __origSaveUS2(); } catch(e){}
                try { if (typeof window.applyProfileToUi === 'function') window.applyProfileToUi(); } catch(e){}
            }, 2500 - elapsed + 100);
        }
        return Promise.resolve();
    }
    st.last = now;
    var r;
    try { r = __origSaveUS2 ? __origSaveUS2.apply(this, arguments) : Promise.resolve(); } catch(e){ r = Promise.resolve(); }
    try { if (typeof window.applyProfileToUi === 'function') window.applyProfileToUi(); } catch(e){}
    return r;
};

/* ===== ③ ログインボーナス即時発火 ===== */
function triggerLoginBonusNow() {
    try {
        if (typeof myId === 'undefined' || !myId || myId === 'GUEST-000') return;
        if (typeof userStats === 'undefined' || !userStats) return;
        var today = new Date();
        var dk = today.getFullYear() + '-' + (today.getMonth()+1) + '-' + today.getDate();
        if (userStats.gacha_login_date === dk) return;
        if (window.__gcLoginShown) return;
        window.__gcLoginShown = true;
        var yesterday = new Date(Date.now() - 86400000);
        var yk = yesterday.getFullYear() + '-' + (yesterday.getMonth()+1) + '-' + yesterday.getDate();
        var last = userStats.gacha_login_date || '';
        var streak = (last === yk) ? (parseInt(userStats.gacha_login_streak) || 0) + 1 : 1;
        var dow = today.getDay();
        var gold = 0, tChar = 0, tItem = 0;
        if (dow === 6) { tChar += 1; tItem += 1; } else { gold += 50; }
        if (streak > 0 && streak % 7 === 0) { tChar += 1; tItem += 1; }
        var old = document.querySelector('.gcModal');
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var m = document.createElement('div');
        m.className = 'gcModal';
        var dots = '';
        var pos = ((streak - 1) % 7) + 1;
        for (var i = 1; i <= 7; i++) dots += '<span class="gcLoginDot' + (i <= pos ? ' on' : '') + '"></span>';
        var rows = '';
        if (gold > 0) rows += '<div class="gcRewardRow">🪙 ゴールド <b>+' + gold + '</b></div>';
        if (tChar > 0) rows += '<div class="gcRewardRow">🎟️ キャラチケット <b>+' + tChar + '</b></div>';
        if (tItem > 0) rows += '<div class="gcRewardRow">🎟️ アイテムチケット <b>+' + tItem + '</b></div>';
        if (streak % 7 === 0) rows += '<div class="gcRewardRow">🎉 連続 ' + streak + ' 日ボーナス込み！</div>';
        m.innerHTML = '<div class="gcModalCard"><div class="gcModalTitle">📅 ログインボーナス</div><div class="gcModalSub">連続 ' + streak + ' 日目' + (dow === 6 ? '（土曜特典）' : '') + '</div><div class="gcLoginDots">' + dots + '</div>' + rows + '<button type="button" class="gcBtnGold" id="gcLoginClaim2">受け取る</button></div>';
        document.body.appendChild(m);
        m.querySelector('#gcLoginClaim2').addEventListener('click', function() {
            if (userStats.gacha_login_date === dk) { if (m.parentNode) m.parentNode.removeChild(m); return; }
            userStats.gold = (parseInt(userStats.gold) || 0) + gold;
            userStats.gacha_ticket_char = (parseInt(userStats.gacha_ticket_char) || 0) + tChar;
            userStats.gacha_ticket_item = (parseInt(userStats.gacha_ticket_item) || 0) + tItem;
            userStats.gacha_login_date = dk;
            userStats.gacha_login_streak = streak;
            try { if (typeof window.saveUserStats === 'function') window.saveUserStats(); } catch(e){}
            if (m.parentNode) m.parentNode.removeChild(m);
            try { if (typeof window.showToast === 'function') window.showToast('📅 ログインボーナスを受け取りました！', 'ok'); } catch(e){}
        });
    } catch(e){}
}
(function loginBonusWatch() {
    var fired = false;
    var tries = 0;
    var iv = setInterval(function() {
        tries++;
        if (tries > 120) { clearInterval(iv); return; }
        if (fired) return;
        try {
            if (typeof myId === 'undefined' || !myId || myId === 'GUEST-000') return;
            if (typeof userStats === 'undefined' || !userStats) return;
            var today = new Date();
            var dk = today.getFullYear() + '-' + (today.getMonth()+1) + '-' + today.getDate();
            if (userStats.gacha_login_date === dk) return;
            if (window.__gcLoginShown) return;
            fired = true;
            clearInterval(iv);
            setTimeout(triggerLoginBonusNow, 300);
        } catch(e){}
    }, 500);
})();

/* ===== ④ 攻撃倍率→実数値 + ⑤ 強化ボタン復旧 ===== */
function fixPartyCards() {
    try {
        var cards = document.querySelectorAll('.pty-card[data-pcvcard^="char_"], .pcv-card[data-pcvcard^="char_"]');
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            var dc = card.getAttribute('data-pcvcard') || '';
            if (dc.indexOf('char_') !== 0) continue;
            var id = dc.slice(5);
            var lv = 0;
            try {
                if (typeof userStats !== 'undefined' && userStats && userStats.gacha_enhance) {
                    lv = userStats.gacha_enhance[id] || 0;
                }
            } catch(e){}
            var stats = card.querySelectorAll('.pty-stat');
            for (var j = 0; j < stats.length; j++) {
                var txt = stats[j].textContent || '';
                if (txt.indexOf('×') !== -1 && txt.indexOf('攻撃') !== -1) {
                    var b = stats[j].querySelector('b');
                    if (b) {
                        var base = 300;
                        var val = Math.round(base * (1 + lv / 100));
                        b.textContent = String(val);
                    }
                }
            }
            if (!card.querySelector('[data-ffenh]') && id === 'tangon') {
                var acts = card.querySelector('.pty-card-actions');
                if (acts) {
                    var btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'pty-btn';
                    btn.setAttribute('data-ffenh', id);
                    btn.textContent = '⚒️ 強化する';
                    acts.appendChild(btn);
                }
            }
        }
    } catch(e){}
}
document.addEventListener('click', function(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var btn = t.closest('[data-ffenh]');
    if (btn) {
        e.stopPropagation();
        var id = btn.getAttribute('data-ffenh');
        try {
            if (typeof window.gachaOpenEnhance === 'function') window.gachaOpenEnhance(id);
            else if (typeof window.gachaEnhance === 'function') window.gachaEnhance(id);
        } catch(e2){}
        setTimeout(fixPartyCards, 150);
    }
}, true);

/* ===== ⑥ 進捗ゲージ（pity）同期 ===== */
function syncPityGauge() {
    try {
        if (typeof userStats === 'undefined' || !userStats) return;
        var banner = window.__gcBanner || 'char';
        ['gold', 'ticket'].forEach(function(lane) {
            var key = 'gacha_pity_' + banner + ' ' + lane;
            var v = parseInt(userStats[key]) || 0;
            var pct = Math.min(100, v);
            var rows = document.querySelectorAll('.gcPityRow');
            for (var i = 0; i < rows.length; i++) {
                var lbl = rows[i].querySelector('.gcPityLbl');
                if (!lbl) continue;
                var isGold = lbl.textContent.indexOf('ゴールド') !== -1;
                if ((lane === 'gold' && isGold) || (lane === 'ticket' && !isGold)) {
                    var fill = rows[i].querySelector('.gcPityFill');
                    if (fill) fill.style.width = pct + '%';
                    var num = rows[i].querySelector('.gcPityNum');
                    if (num) num.textContent = Math.min(v, 100) + '/100';
                }
            }
        });
    } catch(e){}
}

/* ===== タブ切替・定期監視 ===== */
var __prevTabFF2 = window.switchTab;
window.switchTab = function(tabId) {
    var r = __prevTabFF2 ? __prevTabFF2.apply(this, arguments) : undefined;
    if (tabId === 'party') setTimeout(fixPartyCards, 150);
    return r;
};
setInterval(function() {
    fixPartyCards();
    syncPityGauge();
}, 800);

console.log('🔧 最終修正パッチv2（セーブ/ログインボーナス/攻撃実数値/強化復旧/進捗同期/Firestore負荷軽減）適用完了');
})();
// =====================================================================
// 💀 マルチプレイ 死亡/魂/蘇生/敗北 パッチ＋近日公開解除（multi.js末尾追記）
// ① 「近日公開」ロックを解除（該当ラベル非表示＋ボタン有効化）
// ② HP0で死亡演出＋アイコンが「👻魂」に（浮遊アニメ）
// ③ 死亡中は正解3回で蘇生（HP50%で復帰）
// ④ プレイヤー全滅で敗北演出→結果画面へ
// ※ 既存コード不変更（ラップ方式）
// =====================================================================
(function applyMultiDeathPatch(){
"use strict";
if(window.__multiDeathApplied) return; window.__multiDeathApplied=true;
var REVIVE_NEED=3;

(function(){if(document.getElementById('mdeathCss'))return;var s=document.createElement('style');s.id='mdeathCss';s.textContent=[
'.multi-party-icon{position:relative;}',
'.multi-party-icon.m2-soul{filter:grayscale(1) brightness(.55);opacity:.45;}',
'.multi-party-icon.m2-soul::after{content:"👻";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:22px;animation:m2SoulFloat 2s ease-in-out infinite;}',
'@keyframes m2SoulFloat{0%,100%{transform:translateY(1px)}50%{transform:translateY(-4px)}}',
'.m2-big-overlay{position:fixed;inset:0;z-index:99990;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.72);backdrop-filter:blur(2px);}',
'.m2-big-box{text-align:center;}',
'.m2-big-box .big{font-size:34px;font-weight:900;color:#fca5a5;text-shadow:0 0 20px rgba(239,68,68,.6);}',
'.m2-big-box .sub{font-size:13px;color:#e2e8f0;margin-top:10px;}',
'#m2ReviveHud{position:fixed;left:50%;bottom:120px;transform:translateX(-50%);z-index:99989;background:rgba(0,0,0,.7);border:1px solid rgba(252,165,165,.5);color:#fca5a5;border-radius:999px;padding:6px 14px;font-size:12px;font-weight:800;display:none;}'
].join('\n');(document.head||document.documentElement).appendChild(s);})();

/* ---- 近日公開解除 ---- */
function unlockSoon(){
var scope=document.getElementById('view-party')||document.body;
var all=scope.querySelectorAll('*');
for(var i=0;i<all.length;i++){
var el=all[i];
if(el.children.length===0 && (el.textContent||'').trim().indexOf('近日公開')>=0){
el.style.display='none';
var host=el.closest('[class*=door],[data-mode],button,.mdu-card,.mdu-mode')||el.parentElement;
if(host){ host.classList.remove('locked','soon','disabled'); host.removeAttribute('disabled'); host.style.opacity=''; host.style.pointerEvents=''; }
}
}
}

/* ---- 死亡/魂 ---- */
function setSoul(m,on){
var el=document.getElementById('partyMember-'+m.id);
if(!el)return;
var ic=el.querySelector('.multi-party-icon');
if(ic){ if(on)ic.classList.add('m2-soul'); else ic.classList.remove('m2-soul'); }
}
function onDeath(m){
m.dead=true; m.reviveProgress=0;
setSoul(m,true);
try{ window.showCharacterPopup(m.id,'👻','damage'); }catch(e){}
if(m.isMe) showBig('あなたは魂になった…','正解 '+REVIVE_NEED+' 回で蘇生できます');
}
function showBig(big,sub){
var o=document.createElement('div');o.className='m2-big-overlay';
o.innerHTML='<div class="m2-big-box"><div class="big">'+big+'</div><div class="sub">'+sub+'</div></div>';
document.body.appendChild(o);
setTimeout(function(){o.remove();},1600);
}
function revive(me){
me.dead=false; me.reviveProgress=0;
me.hp=Math.max(1,Math.round((me.maxHp||1)*0.5));
setSoul(me,false); hideReviveHud();
try{ window.showCharacterPopup(me.id,'✨ 蘇生','attack'); }catch(e){}
try{ window.updateMultiHpBars(); }catch(e){}
}
function hud(){var h=document.getElementById('m2ReviveHud');if(!h){h=document.createElement('div');h.id='m2ReviveHud';document.body.appendChild(h);}return h;}
function showReviveHud(me){var h=hud();h.style.display='block';h.textContent='👻 蘇生まであと '+Math.max(0,REVIVE_NEED-(me.reviveProgress||0))+' 正解';}
function hideReviveHud(){var h=document.getElementById('m2ReviveHud');if(h)h.style.display='none';}

function checkDeaths(){
if(typeof multiPartyMembers==='undefined'||!multiPartyMembers)return;
multiPartyMembers.forEach(function(m){ if(!m.dead && m.hp<=0) onDeath(m); });
checkAllDead();
}
function goResult(){
try{ if(typeof window.cancelMultiBattlePlay==='function'){ window.cancelMultiBattlePlay(true); return; } }catch(e){}
try{ showMultiResult(); }catch(e){}
}
function checkAllDead(){
if(typeof multiPartyMembers==='undefined'||!multiPartyMembers||!multiPartyMembers.length)return;
var all=multiPartyMembers.every(function(m){return m.dead||m.hp<=0;});
if(all && !window.__defeatShown){
window.__defeatShown=true;
try{ clearInterval(gameTimerInterval); }catch(e){}
showBig('敗北…','全滅してしまった');
setTimeout(goResult,1400);
}
}

/* ---- HP更新のたびに死亡判定 ---- */
var __prevUpd=window.updateMultiHpBars;
window.updateMultiHpBars=function(){var r=__prevUpd?__prevUpd.apply(this,arguments):undefined;checkDeaths();return r;};

/* ---- 正解時の蘇生カウント ---- */
var __prevFlick=window.processMultiFlickAnswer;
window.processMultiFlickAnswer=function(ci){
var wasCorrect=(ci===currentMultiCorrectIndex);
var me=(typeof multiPartyMembers!=='undefined')?multiPartyMembers.find(function(m){return m.isMe;}):null;
var r=__prevFlick?__prevFlick.apply(this,arguments):undefined;
if(me&&me.dead&&wasCorrect){
me.reviveProgress=(me.reviveProgress||0)+1;
if(me.reviveProgress>=REVIVE_NEED){ revive(me); } else { showReviveHud(me); }
}
checkDeaths();
return r;
};

/* ---- バトル開始時にリセット ---- */
var __prevStart=window.startMultiBattlePlay;
window.startMultiBattlePlay=function(){
window.__defeatShown=false;
if(typeof multiPartyMembers!=='undefined'&&multiPartyMembers)multiPartyMembers.forEach(function(m){m.dead=false;m.reviveProgress=0;setSoul(m,false);});
hideReviveHud();
var r=__prevStart?__prevStart.apply(this,arguments):undefined;
return r;
};

setInterval(unlockSoon,700);
console.log('💀 死亡/魂/蘇生/敗北パッチ＋近日公開解除 適用完了');
})();
// =====================================================================
// ⚔️ マルチ 戦闘ループ強化パッチ（multi.js末尾追記・既存不変更）
// ① 攻撃時の「真ん中の円」を撤去（敵被ダメ演出は維持）
// ② 選択肢を「カードの上で離したら発動」＋角度自由化
// ③ 近日公開の確実な解除
// ④ 敵撃破でドロップが散らばる演出（敵IDで決まる＝全員同じ・×人数分）
// ⑤ 撃破後に「侵攻/撤退」選択（侵攻で次へ・撤退で結果画面）
// ⑥ 勝利連勝で敵レア度上昇（WIN_RARITY を自分で編集可能）
// ⑦ 結果画面のテイスト分離（勝利=金／敗北=暗赤）＋全滅時報酬半減
// =====================================================================
(function applyMultiLoopPatch(){
"use strict";
if(window.__multiLoopApplied) return; window.__multiLoopApplied=true;

/* ===== 自分で編集できる設定 ===== */
var WIN_RARITY=['C','C','UC','UC','R','R','SR','SR']; // 連勝数→敵レア度
var DROP_COIN={C:20,UC:35,R:60,SR:120};               // 敵レア度→ドロップ枚数(1人分)

var winStreak=0;

/* ===== CSS ===== */
(function(){if(document.getElementById('mloopCss'))return;var s=document.createElement('style');s.id='mloopCss';s.textContent=[
/* ① 真ん中の円を消す */
'.popup-hit-explosion{display:none !important;}',
'#m2CenterCircle,.m2-center-ring{display:none !important;}',
/* ④ ドロップ散らばり */
'.mloop-drop{position:fixed;z-index:340;pointer-events:none;font-size:16px;animation:mloopDrop 1.1s cubic-bezier(.2,.8,.3,1) forwards;}',
'@keyframes mloopDrop{0%{transform:translate(0,0) scale(.6);opacity:0}15%{opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(1);opacity:0}}',
/* ⑤ 侵攻/撤退オーバーレイ */
'.mloop-choice{position:fixed;inset:0;z-index:99988;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);backdrop-filter:blur(2px);}',
'.mloop-choice .box{display:flex;gap:12px;}',
'.mloop-choice button{padding:14px 26px;border-radius:14px;font-size:15px;font-weight:900;cursor:pointer;}',
'.mloop-advance{border:1px solid rgba(239,68,68,.6);background:rgba(239,68,68,.15);color:#fca5a5;}',
'.mloop-retreat{border:1px solid rgba(148,163,184,.5);background:rgba(148,163,184,.12);color:#cbd5e1;}',
/* ⑦ 結果画面テイスト */
'#game-result-screen.mloop-defeat{filter:saturate(.6) brightness(.8);}',
'#game-result-screen.mloop-defeat .game-result-card{border-color:rgba(239,68,68,.5) !important;}',
'#game-result-screen.mloop-victory .game-result-card{border-color:rgba(245,196,81,.6) !important;}'
].join('\n');(document.head||document.documentElement).appendChild(s);})();

/* ===== ① 真ん中の円はCSSで消去済み ===== */

/* ===== ② カードの上で離したら発動（角度自由） ===== */
document.addEventListener('pointerup',function(e){
var grid=e.target.closest?e.target.closest('.multi-grid-3x3'):null;
if(!grid) return;
var cell=e.target.closest('.multi-grid-3x3 > *');
if(!cell) return;
var idx=Array.prototype.indexOf.call(grid.children,cell);
if(idx>=0&&typeof window.processMultiFlickAnswer==='function'){
window.processMultiFlickAnswer(idx);
}
},true);

/* ===== ③ 近日公開解除（強化版） ===== */
function unlockSoon(){
var scope=document.getElementById('view-party')||document.body;
var all=scope.querySelectorAll('*');
for(var i=0;i<all.length;i++){
var el=all[i];
if(el.children.length===0&&(el.textContent||'').trim().indexOf('近日公開')>=0){
el.style.display='none';
var host=el.closest('[class*=door],[class*=mode],[data-mode],button,.mdu-card')||el.parentElement;
if(host){host.classList.remove('locked','soon','disabled');host.removeAttribute('disabled');host.style.opacity='';host.style.pointerEvents='';}
}
}
}
setInterval(unlockSoon,700);

/* ===== ④ ドロップ散らばり（敵IDで決定的＝全員同じ・×人数） ===== */
function hashStr(s){var h=0;for(var i=0;i<s.length;i++){h=(h*31+s.charCodeAt(i))|0;}return Math.abs(h);}
function scatterDrops(enemy){
var rar=(enemy&&enemy.rarity)||'C';
var per=DROP_COIN[rar]||20;
var members=(typeof multiPartyMembers!=='undefined'&&multiPartyMembers)?multiPartyMembers.length:1;
var seed=hashStr((enemy&&enemy.id)||('e'+Date.now()));
for(var m=0;m<members;m++){
for(var d=0;d<6;d++){
var el=document.createElement('span');el.className='mloop-drop';el.textContent='🪙';
var cx=innerWidth/2,cy=innerHeight/2;
var ang=((seed+d*57+m*13)%360)*Math.PI/180;
var dist=60+((seed>>(d%8))%90);
el.style.left=cx+'px';el.style.top=cy+'px';
el.style.setProperty('--dx',Math.cos(ang)*dist+'px');
el.style.setProperty('--dy',Math.sin(ang)*dist+40+'px');
document.body.appendChild(el);
setTimeout(function(x){return function(){x.remove();};}(el),1200);
}
}
try{ if(typeof applyKillReward==='function') applyKillReward(per*members); }catch(e){}
}

/* ===== ⑤⑥ 撃破フック：連勝++/ドロップ/侵攻撤退 ===== */
if(typeof checkEnemyDefeated==='function'&&!checkEnemyDefeated.__mloop){
var __origDefeated=checkEnemyDefeated;
checkEnemyDefeated=function(){
var enemy=(typeof M2==='function'&&M2())?M2().current:null;
winStreak++;
scatterDrops(enemy);
var r=__origDefeated.apply(this,arguments);
setTimeout(showChoice,900);
return r;
};
checkEnemyDefeated.__mloop=true;
}
function showChoice(){
if(document.querySelector('.mloop-choice'))return;
var next=WIN_RARITY[Math.min(winStreak,WIN_RARITY.length-1)];
var o=document.createElement('div');o.className='mloop-choice';
o.innerHTML='<div class="box"><button type="button" class="mloop-advance">⚔️ 侵攻（次:'+next+'）</button><button type="button" class="mloop-retreat">🏳️ 撤退</button></div>';
document.body.appendChild(o);
o.querySelector('.mloop-advance').onclick=function(){o.remove();try{spawnEnemy();if(window.showNextMultiWord)window.showNextMultiWord();}catch(e){}};
o.querySelector('.mloop-retreat').onclick=function(){o.remove();window.__halfReward=false;try{window.cancelMultiBattlePlay(true);}catch(e){}};
}

/* ===== ⑥ 敵レア度強制（spawnEnemyラップ） ===== */
if(typeof spawnEnemy==='function'&&!spawnEnemy.__mloop){
var __origSpawn=spawnEnemy;
spawnEnemy=function(){
try{ window.__forceRarity=WIN_RARITY[Math.min(winStreak,WIN_RARITY.length-1)]; }catch(e){}
return __origSpawn.apply(this,arguments);
};
spawnEnemy.__mloop=true;
}

/* ===== ⑦ 結果画面テイスト＋全滅半減 ===== */
function styleResult(){
var rs=document.getElementById('game-result-screen');if(!rs)return;
var defeat=!!window.__defeatShown;
rs.classList.toggle('mloop-defeat',defeat);
rs.classList.toggle('mloop-victory',!defeat);
if(defeat&&!rs.__halved){
rs.__halved=true;
rs.querySelectorAll('b,span,div').forEach(function(el){
if(el.children.length===0){
var t=(el.textContent||'').trim();
var mnum=t.match(/^([0-9]+)$/);
if(mnum){el.textContent=String(Math.floor(+mnum[1]/2));}
}
});
}
}
setInterval(styleResult,800);

console.log('⚔️ 戦闘ループ強化パッチ適用完了');
})();
// =====================================================================
// ⚡ 戦闘 最適化＋操作改版パッチ（multi.js末尾追記・既存不変更）
// ① ラグ軽減：重い演出(光の粒/シーン/揺れ)を戦闘中OFF＋ループ統合
// ② 操作を「8方向固定」→「自由ドラッグ」に変更＝枠に乗せて離すと正誤判定
// ③ 蘇生HPを 1/2 → 1/8 に変更
// ④ 「行動: X秒」→ 溜まりゲージ表示に変更
// ⑤ 近日公開の確実な解除（間引き実行）
// ⑥ セーブ間引き（5秒に1回まで＝「保存中」連発を解消）
// =====================================================================
(function applyBattleOptimizePatch(){
"use strict";
if(window.__battleOptApplied) return; window.__battleOptApplied=true;

/* ===== ① ラグ軽減CSS ===== */
(function(){if(document.getElementById('boptCss'))return;var s=document.createElement('style');s.id='boptCss';s.textContent=[
'body.in-game-active .aaa-mote,body.in-game-active [class*="mote"]{display:none !important;}',
'.multi-boss-hp-fill::after{animation:none !important;}',
'body.m2-screen-shake{animation:none !important;}',
'#m2DamageVignette{transition:none !important;}',
'body.in-game-active #multiBossImage{animation:none !important;}',
'#flickTargetWord{touch-action:none;user-select:none;-webkit-user-select:none;position:relative;z-index:60;cursor:grab;}',
'#flickTargetWord.bopt-drag{cursor:grabbing;}',
'#m2ActionGauge{height:8px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden;margin:2px 8px;}',
'#m2ActionGauge i{display:block;height:100%;background:linear-gradient(90deg,#f59e0b,#ef4444);width:100%;}'
].join('\n');(document.head||document.documentElement).appendChild(s);})();

/* ===== ⑥ セーブ間引き ===== */
(function(){
var orig=window.saveUserStats; if(!orig||orig.__bopt)return;
var last=0,timer=null;
var wrapped=function(){
var now=Date.now();
if(now-last>5000){last=now;return orig.apply(this,arguments);}
if(!timer){timer=setTimeout(function(){timer=null;last=Date.now();orig.call(window);},5000);}
};
wrapped.__bopt=true;
window.saveUserStats=wrapped;
})();

/* ===== ② 自由ドラッグ＋③蘇生1/8＋回答ロック ===== */
var drag=null;
function lockAnswer(){window.__ansLock=true;}
function unlockAnswer(){window.__ansLock=false;}
var __prevFlick=window.processMultiFlickAnswer;
window.processMultiFlickAnswer=function(ci){
if(window.__ansLock) return undefined;
var me=(typeof multiPartyMembers!=='undefined')?multiPartyMembers.find(function(m){return m.isMe;}):null;
var wasDead=me?me.dead:false;
lockAnswer();
var r=__prevFlick?__prevFlick.apply(this,arguments):undefined;
/* ③ 蘇生HPを1/8へ上書き */
if(me&&wasDead&&!me.dead){
me.hp=Math.max(1,Math.round((me.maxHp||1)/8));
try{window.updateMultiHpBars();}catch(e){}
}
return r;
};
var __prevNext=window.showNextMultiWord;
window.showNextMultiWord=function(){unlockAnswer();return __prevNext?__prevNext.apply(this,arguments):undefined;};

function bindDrag(){
var word=document.getElementById('flickTargetWord');
if(!word||word.__boptDrag)return; word.__boptDrag=true;
word.addEventListener('pointerdown',function(e){
drag={sx:e.clientX,sy:e.clientY,dx:0,dy:0};
word.classList.add('bopt-drag');
try{word.setPointerCapture(e.pointerId);}catch(err){}
e.preventDefault();
});
word.addEventListener('pointermove',function(e){
if(!drag)return;
drag.dx=e.clientX-drag.sx; drag.dy=e.clientY-drag.sy;
word.style.transform='translate('+drag.dx+'px,'+drag.dy+'px)';
});
word.addEventListener('pointerup',function(e){
if(!drag)return;
word.classList.remove('bopt-drag');
var x=e.clientX,y=e.clientY;
drag=null;
word.style.transform='';
var el=document.elementFromPoint(x,y);
var cell=el?el.closest('.flick-choice'):null;
if(cell&&!cell.classList.contains('flick-center-spark')){
var grid=cell.closest('.multi-grid-3x3');
if(grid){var idx=Array.prototype.indexOf.call(grid.children,cell);
if(idx>=0){unlockAnswer();window.processMultiFlickAnswer(idx);} }
}
});
word.addEventListener('pointercancel',function(){drag=null;word.classList.remove('bopt-drag');word.style.transform='';});
}

/* ===== ④ 行動ゲージ ===== */
function ensureGauge(){
var t=document.getElementById('multiEnemyTimerDisplay');
if(!t)return null;
t.style.display='none';
var g=document.getElementById('m2ActionGauge');
if(!g){g=document.createElement('div');g.id='m2ActionGauge';g.innerHTML='<i></i>';t.parentNode.insertBefore(g,t);}
return g;
}
function updateGauge(){
var g=ensureGauge(); if(!g)return;
var left=(typeof multiEnemyTimeLeft==='number')?multiEnemyTimeLeft:10;
var ratio=Math.max(0,Math.min(1,left/10));
g.firstChild.style.width=(ratio*100)+'%';
}

/* ===== ⑤ 近日公開解除（強化・間引き） ===== */
function unlockSoon(){
var scope=document.getElementById('view-party')||document.body;
var all=scope.querySelectorAll('*');
for(var i=0;i<all.length;i++){
var el=all[i];
if((el.textContent||'').indexOf('近日公開')>=0&&el.children.length===0){
el.style.display='none';
var p=el;
for(var up=0;up<4&&p;up++){
p=p.parentElement; if(!p)break;
p.classList.remove('locked','soon','disabled');
p.removeAttribute('disabled');
p.style.pointerEvents='';p.style.opacity='';
}
}
}
}

/* ===== 統合ループ（300ms・軽量） ===== */
var tick=0;
setInterval(function(){
tick++;
bindDrag();
updateGauge();
if(tick%5===0)unlockSoon();
},300);

console.log('⚡ 戦闘最適化＋操作改版パッチ適用完了');
})();
// =====================================================================
// 🎮 操作修正パッチ（multi.js末尾追記・既存不変更）
// ① 選択肢は id(multiChoice-N) から直接読む＝中央マスによるズレ根絶
// ② ドロップ検知の瞬間だけ単語カードをヒットテスト除外＝確実に枠を認識
// ③ 「意図した選択」のみ受付。旧8方向フリック/二重発火は全て無視
//    → 正しい答えが不正解になるのを防ぐ
// =====================================================================
(function applyControlFixPatch(){
"use strict";
if(window.__controlFixApplied) return; window.__controlFixApplied=true;

/* ③ 意図した選択だけ通す（それ以外は捨てる） */
var __inner=window.processMultiFlickAnswer;
window.processMultiFlickAnswer=function(ci){
if(window.__intendedChoice!=null){
var idx=window.__intendedChoice; window.__intendedChoice=null;
return __inner?__inner.call(this,idx):undefined;
}
return undefined; // 旧フリック/二重発火は無視
};
var __prevNext=window.showNextMultiWord;
window.showNextMultiWord=function(){window.__intendedChoice=null;return __prevNext?__prevNext.apply(this,arguments):undefined;};

/* ① idから正確なインデックス */
function idxOf(c){ if(!c||!c.id)return -1; var n=parseInt(c.id.replace('multiChoice-',''),10); return isFinite(n)?n:-1; }
function selectAt(x,y){
var el=document.elementFromPoint(x,y); if(!el)return false;
var c=el.closest('[id^=multiChoice-]'); var idx=idxOf(c);
if(idx>=0){ window.__intendedChoice=idx; window.processMultiFlickAnswer(idx); return true; }
return false;
}

/* ② 単語カードを自由ドラッグ＋確実なドロップ検知 */
function bindWord(){
var word=document.getElementById('flickTargetWord');
if(!word||word.__cfDrag)return; word.__cfDrag=true;
var drag=null;
word.addEventListener('pointerdown',function(e){
drag={sx:e.clientX,sy:e.clientY};
try{word.setPointerCapture(e.pointerId);}catch(_){}
word.style.transition='none';
e.preventDefault();
});
word.addEventListener('pointermove',function(e){
if(!drag)return;
word.style.transform='translate('+(e.clientX-drag.sx)+'px,'+(e.clientY-drag.sy)+'px)';
});
word.addEventListener('pointerup',function(e){
if(!drag)return; drag=null;
word.style.pointerEvents='none';      // ★検知瞬間だけカードを除外
selectAt(e.clientX,e.clientY);
word.style.pointerEvents='';
word.style.transform='';
});
word.addEventListener('pointercancel',function(){drag=null;word.style.transform='';});
}

/* 選択肢を直接タップしても選べる */
document.addEventListener('pointerup',function(e){
var t=e.target; if(!t||!t.closest)return;
var grid=t.closest('.multi-grid-3x3'); if(!grid)return;
selectAt(e.clientX,e.clientY);
},true);

setInterval(bindWord,700);
console.log('🎮 操作修正パッチ適用完了');
})();
// =====================================================================
// 🎮 操作修正パッチ（multi.js末尾追記・既存不変更）
// ① 選択肢は id(multiChoice-N) から直接読む＝中央マスによるズレ根絶
// ② ドロップ検知の瞬間だけ単語カードをヒットテスト除外＝確実に枠を認識
// ③ 「意図した選択」のみ受付。旧8方向フリック/二重発火は全て無視
//    → 正しい答えが不正解になるのを防ぐ
// =====================================================================
(function applyControlFixPatch(){
"use strict";
if(window.__controlFixApplied) return; window.__controlFixApplied=true;

/* ③ 意図した選択だけ通す（それ以外は捨てる） */
var __inner=window.processMultiFlickAnswer;
window.processMultiFlickAnswer=function(ci){
if(window.__intendedChoice!=null){
var idx=window.__intendedChoice; window.__intendedChoice=null;
return __inner?__inner.call(this,idx):undefined;
}
return undefined; // 旧フリック/二重発火は無視
};
var __prevNext=window.showNextMultiWord;
window.showNextMultiWord=function(){window.__intendedChoice=null;return __prevNext?__prevNext.apply(this,arguments):undefined;};

/* ① idから正確なインデックス */
function idxOf(c){ if(!c||!c.id)return -1; var n=parseInt(c.id.replace('multiChoice-',''),10); return isFinite(n)?n:-1; }
function selectAt(x,y){
var el=document.elementFromPoint(x,y); if(!el)return false;
var c=el.closest('[id^=multiChoice-]'); var idx=idxOf(c);
if(idx>=0){ window.__intendedChoice=idx; window.processMultiFlickAnswer(idx); return true; }
return false;
}

/* ② 単語カードを自由ドラッグ＋確実なドロップ検知 */
function bindWord(){
var word=document.getElementById('flickTargetWord');
if(!word||word.__cfDrag)return; word.__cfDrag=true;
var drag=null;
word.addEventListener('pointerdown',function(e){
drag={sx:e.clientX,sy:e.clientY};
try{word.setPointerCapture(e.pointerId);}catch(_){}
word.style.transition='none';
e.preventDefault();
});
word.addEventListener('pointermove',function(e){
if(!drag)return;
word.style.transform='translate('+(e.clientX-drag.sx)+'px,'+(e.clientY-drag.sy)+'px)';
});
word.addEventListener('pointerup',function(e){
if(!drag)return; drag=null;
word.style.pointerEvents='none';      // ★検知瞬間だけカードを除外
selectAt(e.clientX,e.clientY);
word.style.pointerEvents='';
word.style.transform='';
});
word.addEventListener('pointercancel',function(){drag=null;word.style.transform='';});
}

/* 選択肢を直接タップしても選べる */
document.addEventListener('pointerup',function(e){
var t=e.target; if(!t||!t.closest)return;
var grid=t.closest('.multi-grid-3x3'); if(!grid)return;
selectAt(e.clientX,e.clientY);
},true);

setInterval(bindWord,700);
console.log('🎮 操作修正パッチ適用完了');
})();
// =====================================================================
// 🎯 フリック平滑化パッチ（8方向スナップ廃止＝自由追従＋誤爆防止）
// ① 🔥武器アイコンが自由角度で指に滑らかに追従（カクつき解消）
// ② 移動中に選択予定マスをライブハイライト
// ③ 離す距離が短いと無効（デッドゾーン＝誤爆防止）
// ④ 選択は実マス位置に最も近い角度を採用（マッピングズレ根絶）
// ※ multi.js末尾に追記・既存コード不変更（window関数を上書くだけ）
// =====================================================================
(function applyFlickSmoothPatch(){
"use strict";
if(window.__flickSmoothApplied) return; window.__flickSmoothApplied=true;

var my=null; // {sx,sy,active,dist,choice}

function pad(){ return document.getElementById('flickPadArea'); }
function icon(){ return document.getElementById('flickWeaponIcon'); }

/* 実マスの中心角度と比較して最も近い選択肢を返す */
function cellByAngle(dx,dy,dist){
if(dist<8) return -1;
var ang=Math.atan2(dy,dx)*180/Math.PI;
var grid=document.querySelector('.multi-grid-3x3'); if(!grid) return -1;
var gr=grid.getBoundingClientRect();
var cx=gr.left+gr.width/2, cy=gr.top+gr.height/2;
var best=-1,bd=999;
for(var i=0;i<8;i++){
var el=document.getElementById('multiChoice-'+i); if(!el)continue;
var r=el.getBoundingClientRect();
var ex=r.left+r.width/2-cx, ey=r.top+r.height/2-cy;
if(ex===0&&ey===0)continue;
var ea=Math.atan2(ey,ex)*180/Math.PI;
var diff=Math.abs(((ang-ea+540)%360)-180);
if(diff<bd){bd=diff;best=i;}
}
return best;
}
function highlight(idx){
for(var i=0;i<8;i++){
var el=document.getElementById('multiChoice-'+i); if(!el)continue;
if(i===idx) el.classList.add('highlight'); else el.classList.remove('highlight');
}
}
function resetIcon(){
var ic=icon(); if(!ic)return;
ic.style.left='50%'; ic.style.top='50%';
}

/* capture で既存リスナーより先に奪う */
document.addEventListener('touchstart',function(e){
var t=e.target; if(!t||!t.closest)return;
if(!t.closest('#flickPadArea'))return;
e.stopPropagation();
var touch=e.touches[0];
my={sx:touch.clientX,sy:touch.clientY,active:true,dist:0,choice:-1};
},true);

document.addEventListener('touchmove',function(e){
if(!my||!my.active)return;
var t=e.target; if(!t||!t.closest||!t.closest('#flickPadArea'))return;
e.preventDefault(); e.stopPropagation();
var touch=e.touches[0];
var p=pad(); if(!p)return;
var rect=p.getBoundingClientRect();
var dx=touch.clientX-my.sx, dy=touch.clientY-my.sy;
var dist=Math.sqrt(dx*dx+dy*dy);
my.dist=dist;
/* ① 自由追従（半径クランプ） */
var ic=icon();
if(ic){
var maxR=Math.min(rect.width,rect.height)*0.42;
var cl=Math.min(dist,maxR);
var ang=Math.atan2(dy,dx);
ic.style.left=(rect.width/2+Math.cos(ang)*cl)+'px';
ic.style.top=(rect.height/2+Math.sin(ang)*cl)+'px';
ic.style.transform='translate(-50%,-50%)';
}
/* ② ライブハイライト */
my.choice=cellByAngle(dx,dy,dist);
highlight(my.choice);
},{capture:true,passive:false});

document.addEventListener('touchend',function(e){
if(!my||!my.active)return;
e.stopPropagation();
var dist=my.dist, choice=my.choice;
resetIcon(); highlight(-1);
my.active=false;
/* ③ デッドゾーン＋④ 実マス採用 */
if(dist>18 && choice>=0){
window.__intendedChoice=choice;   // 既存ガード経由で確実に1回だけ回答
window.processMultiFlickAnswer(choice);
}
},true);

console.log('🎯 フリック平滑化パッチ適用完了');
})();
// =====================================================================
// ⚔️ 2回目以降の攻撃が出ない問題 修正パッチ（multi.js末尾追記）
// 原因：回答ロック(__ansLock)が「次の単語時」しか解除されず残っていた
// 対策：新しいジェスチャー開始時にロック解除＝2回目以降も必ず攻撃
//      （同一タップ内の二重発火は従来通り防止）
// =====================================================================
(function applyAtkRepeatFix() {
    "use strict";
    if (window.__atkRepeatFixed) return;
    window.__atkRepeatFixed = true;
    
    /* 新しい操作が始まったらロック解除 */
    document.addEventListener('touchstart', function() { window.__ansLock = false; }, true);
    document.addEventListener('pointerdown', function() { window.__ansLock = false; }, true);
    
    /* 単語が進んだ時も確実に解除＋意図選択クリア */
    var __p = window.showNextMultiWord;
    window.showNextMultiWord = function() {
        window.__ansLock = false;
        window.__intendedChoice = null;
        return __p ? __p.apply(this, arguments) : undefined;
    };
    
    /* 保険：長時間ロックが残らないよう定期解除 */
    setInterval(function() { window.__ansLock = false; }, 800);
    
    console.log('⚔️ 2回目以降の攻撃修正 適用完了');
})();
// =====================================================================
// ⚔️ 二重攻撃＋中央円 修正パッチ（multi.js末尾追記・既存不変更）
// ① 敵の一斉攻撃が2重に見える問題＝メンバー毎600ms内の重複発火を間引き
//    → 1回の攻撃につきダメージ/演出は1回だけ（HPの二重減少も防ぐ）
// ② 自分の攻撃時に出る「真ん中の円」を完全非表示
//    （敵位置の3層爆発・飛翔バブル・ダメ数値は維持）
// =====================================================================
(function applyBattleDedupePatch(){
"use strict";
if(window.__battleDedupeApplied) return; window.__battleDedupeApplied=true;

/* ② 真ん中の円（壊れた命中円）を非表示 */
(function(){if(document.getElementById('bdCss'))return;var s=document.createElement('style');s.id='bdCss';s.textContent=[
'.popup-hit-explosion{display:none !important;}',
'.popup-hit-explosion *{display:none !important;}'
].join('\n');(document.head||document.documentElement).appendChild(s);})();

/* ① ダメージ発火の間引き（同一メンバー600ms以内は2回目を捨てる） */
var lastDmg={};
var __sp=window.showCharacterPopup;
window.showCharacterPopup=function(memberId,amount,type){
if(type==='damage'){
var now=Date.now();
if(lastDmg[memberId] && (now-lastDmg[memberId])<600) return undefined;
lastDmg[memberId]=now;
}
return __sp?__sp.apply(this,arguments):undefined;
};

/* ① 保険：全体攻撃自体も1.2秒に1回まで */
if(typeof window.triggerEnemyAoE==='function' && !window.triggerEnemyAoE.__bd){
var __ta=window.triggerEnemyAoE;
window.triggerEnemyAoE=function(){
var now=Date.now();
if(window.__lastAoE && (now-window.__lastAoE)<1200) return undefined;
window.__lastAoE=now;
return __ta.apply(this,arguments);
};
window.triggerEnemyAoE.__bd=true;
}

console.log('⚔️ 二重攻撃/中央円 修正パッチ適用完了');
})();
// =====================================================================
// 💰 実画像ドロップパッチ（絵文字版破棄・これ1本）
// ・gold.png 必ず3〜5個 ／ gachatike.png 確率で1枚
// ・カケラ＝敵レア度別 kakerac/r/sr/uc.png 確率で1個（所持カケラも+1）
// ・EXP＝薄い緑の円＋ゴシック緑文字「EXP」で表現
// ・RPG風物理（バースト→重力→回転→消滅）
// =====================================================================
(function applyRealDropPatch(){
"use strict";
if(window.__realDropApplied) return; window.__realDropApplied=true;

/* 旧絵文字ドロップを非表示 */
(function(){if(document.getElementById('rdCss'))return;var s=document.createElement('style');s.id='rdCss';s.textContent=[
'.mloop-drop,.acd-item{display:none !important;}',
'.mdrop{position:fixed;z-index:346;pointer-events:none;will-change:transform,opacity;}',
'.mdrop img{width:100%;height:100%;object-fit:contain;display:block;}',
'.mdrop-gold{width:24px;height:24px;}',
'.mdrop-ticket{width:26px;height:26px;}',
'.mdrop-shard{width:26px;height:26px;}',
'.mdrop-exp{width:36px;height:36px;border-radius:50%;background:rgba(110,231,183,.16);border:1px solid rgba(110,231,183,.55);',
'display:flex;align-items:center;justify-content:center;color:#6ee7b7;',
'font-family:"Noto Sans JP","Hiragino Kaku Gothic ProN",sans-serif;font-weight:700;font-size:9px;letter-spacing:.5px;}'
].join('\n');(document.head||document.documentElement).appendChild(s);})();

var SHARD_IMG={C:'kakerac.png',R:'kakerar.png',SR:'kakerasr.png',UC:'kakerauc.png'};
var SHARD_RATE={C:0.25,UC:0.4,R:0.55,SR:0.8};

function targetRect(){
try{ if(typeof m2TargetRect==='function'){var r=m2TargetRect(); if(r)return r;} }catch(e){}
var b=document.getElementById('multiBossImage');
if(b){var r2=b.getBoundingClientRect(); if(r2.width)return r2;}
return {left:innerWidth/2-60,top:innerHeight/2-60,width:120,height:120};
}
function physics(el,cx,cy){
el.style.left=cx+'px'; el.style.top=cy+'px';
document.body.appendChild(el);
var ang=Math.random()*Math.PI*2;
var sp=110+Math.random()*170;
var vx=Math.cos(ang)*sp, vy=Math.sin(ang)*sp-170;
var rot=(Math.random()*2-1)*420, g=980, t0=performance.now();
function step(t){
var dt=(t-t0)/1000;
el.style.transform='translate('+(vx*dt)+'px,'+(vy*dt+0.5*g*dt*dt)+'px) rotate('+(rot*dt)+'deg)';
el.style.opacity= dt>1.1? String(Math.max(0,1-(dt-1.1)/0.7)):'1';
if(dt<1.8) requestAnimationFrame(step); else el.remove();
}
requestAnimationFrame(step);
}
function imgDrop(src,cls,cx,cy,fb){
var el=document.createElement('span'); el.className='mdrop '+cls;
var im=document.createElement('img'); im.src=src; im.onerror=function(){el.textContent=fb;};
el.appendChild(im);
physics(el,cx,cy);
}
function expDrop(cx,cy){
var el=document.createElement('span'); el.className='mdrop mdrop-exp'; el.textContent='EXP';
physics(el,cx,cy);
}

function scatterRealDrops(enemy){
var tr=targetRect(); var cx=tr.left+tr.width/2, cy=tr.top+tr.height/2;
var rar=(enemy&&enemy.rarity)||'C';
/* ゴールド必ず3〜5（付与は既存applyKillReward側） */
var g=3+Math.floor(Math.random()*3);
for(var i=0;i<g;i++) imgDrop('gold.png','mdrop-gold',cx,cy,'🪙');
/* チケット確率（付与は既存側） */
var rate=0.02; try{ if(typeof rewardForRarity==='function') rate=rewardForRarity(rar).ticketRate; }catch(e){}
if(Math.random()<rate) imgDrop('gachatike.png','mdrop-ticket',cx,cy,'🎟️');
/* カケラ確率（ここで実際に+1付与） */
if(Math.random()<(SHARD_RATE[rar]||0.25)){
imgDrop(SHARD_IMG[rar]||'kakerac.png','mdrop-shard',cx,cy,'💎');
try{ if(typeof userStats==='object'&&userStats){ var k='gacha_shard_'+rar; userStats[k]=(parseInt(userStats[k])||0)+1; if(typeof window.saveUserStats==='function')window.saveUserStats(); } }catch(e){}
}
/* EXP（見た目のみ・付与は既存側） */
var ex=1+(Math.random()<0.4?1:0);
for(var j=0;j<ex;j++) expDrop(cx,cy);
}

/* 敵が倒れた瞬間(m2-die)に発火 */
function bindBoss(){
var b=document.getElementById('multiBossImage');
if(!b||b.__rdObs)return; b.__rdObs=true;
var mo=new MutationObserver(function(){
if(b.classList.contains('m2-die')){ var cur=null; try{cur=M2().current;}catch(e){} scatterRealDrops(cur); }
});
mo.observe(b,{attributes:true,attributeFilter:['class']});
}
setInterval(bindBoss,800);
console.log('💰 実画像ドロップパッチ適用完了');
})();
// =====================================================================
// ⚔️ 攻撃力 実値同期パッチ【個人キャラ版】（multi.js末尾・旧同期パッチは削除）
// ・与ダメ＝「自分のキャラ1体の実攻撃力×コンボ倍率」（パーティ合計しない）
// ・オンラインで個々にプレイする想定＝本人キャラのみ反映
// ・飛ぶ💥数値も自分の実値に統一／強化Lvで自動上昇
// =====================================================================
(function applyAtkSyncSelfPatch(){
"use strict";
if(window.__atkSyncSelfApplied) return; window.__atkSyncSelfApplied=true;

/* 基礎値（図鑑表示と同じテーブル） */
var BASE={tangon:{hp:3500,atk:300}};
var RBASE={SR:{hp:1000,atk:100},R:{hp:850,atk:85},UC:{hp:700,atk:70},C:{hp:500,atk:50}};
function rarityOf(id){ if(id==='tangon')return 'SR'; if(id.indexOf('r0')>=0||id.indexOf('_r')>=0)return 'R'; if(id.indexOf('uc')>=0)return 'UC'; return 'C'; }
function enhLv(id){ try{ if(typeof userStats!=='undefined'&&userStats&&userStats.gacha_enhance) return userStats.gacha_enhance[id]||0; }catch(e){} return 0; }
function charAtk(id){ var b=BASE[id]||RBASE[rarityOf(id)]||{atk:100}; return Math.round(b.atk*(1+enhLv(id)/100)); }

/* 自分のキャラ1体分の実攻撃力 */
function myAtk(){
var id='tangon';
try{
var me=null;
if(typeof multiPartyMembers!=='undefined'&&multiPartyMembers){
for(var i=0;i<multiPartyMembers.length;i++){ if(multiPartyMembers[i]&&multiPartyMembers[i].isMe){me=multiPartyMembers[i];break;} }
}
var cid=(me&&me.char)?me.char:((typeof activeCharacter!=='undefined'&&activeCharacter)?activeCharacter:'tangon');
id=String(cid||'tangon').replace('char_','');
}catch(e){}
return charAtk(id);
}
function comboMulti(){ return 1+Math.floor(((typeof gameComboCount!=='undefined')?gameComboCount:0)/5)*0.5; }

/* 与ダメを「自分の実攻撃力」に同期（固定400との差分補正） */
var __prev=window.processMultiFlickAnswer;
window.processMultiFlickAnswer=function(ci){
var correct=(typeof currentMultiCorrectIndex!=='undefined')&&(ci===currentMultiCorrectIndex);
var r=__prev?__prev.apply(this,arguments):undefined;
if(correct){
var fixed=400*comboMulti();
var real=myAtk()*comboMulti();
var diff=real-fixed;
if(diff!==0&&typeof multiBossHp==='number'){
multiBossHp=Math.max(0,multiBossHp-diff);
try{ var c=(typeof M2==='function')?M2().current:null; if(c)c.hp=multiBossHp; }catch(e){}
try{ window.updateMultiHpBars(); }catch(e){}
try{ if(multiBossHp<=0&&typeof checkEnemyDefeated==='function')checkEnemyDefeated(); }catch(e){}
}
}
return r;
};

/* 飛ぶ💥数値も自分の実値に */
var __sp=window.showCharacterPopup;
window.showCharacterPopup=function(id,amount,type){
if(type==='attack'&&typeof amount==='string'&&amount.indexOf('💥')===0){
amount='💥 '+Math.round(myAtk()*comboMulti());
return __sp?__sp.call(this,id,amount,type):undefined;
}
return __sp?__sp.apply(this,arguments):undefined;
};

console.log('⚔️ 攻撃力実値同期【個人キャラ版】適用完了（与ダメ=自分のキャラ実攻撃力×コンボ）');
})();
// =====================================================================
// ⭕ 中央円除去パッチv2（app.js不変更・multi.js末尾追記）
// ・.popup-hit-explosion はCSSで隠す
// ・それ以外の「円っぽい演出」も、敵位置から離れた中央付近なら生成瞬間に削除
// ・敵位置の3層爆発/飛翔バブル/ダメ数値/AAA演出は維持
// =====================================================================
(function applyCenterCircleKiller2(){
"use strict";
if(window.__ccKiller2) return; window.__ccKiller2=true;

/* ① 元の壊れた円をCSSで隠す */
(function(){if(document.getElementById('cck2Css'))return;var s=document.createElement('style');s.id='cck2Css';s.textContent='.popup-hit-explosion{display:none !important;opacity:0 !important;}';(document.head||document.documentElement).appendChild(s);})();

function bossRect(){
var b=document.getElementById('multiBossImage');
if(b){var r=b.getBoundingClientRect(); if(r&&r.width>0) return r;}
return null;
}
function isNearBoss(el){
var br=bossRect(); if(!br) return false;
var r=el.getBoundingClientRect();
var cx=r.left+r.width/2, cy=r.top+r.height/2;
var bx=br.left+br.width/2, by=br.top+br.height/2;
return Math.abs(cx-bx)<(br.width/2+90) && Math.abs(cy-by)<(br.height/2+90);
}
function killCenter(el){
if(!el||el.nodeType!==1) return;
var cls=(typeof el.className==='string')?el.className:'';
/* 元の円は無条件削除 */
if(cls.indexOf('popup-hit-explosion')>=0){ if(el.parentNode)el.parentNode.removeChild(el); return; }
/* 円っぽい演出は「敵から離れたら」削除 */
if(/explosion|burst|hit-exp|exp-core|exp-ring|exp-spark|spark|ring/i.test(cls)){
if(!isNearBoss(el)){ if(el.parentNode)el.parentNode.removeChild(el); }
return;
}
/* 子に元の円が含まれていればそれだけ削除 */
if(el.querySelectorAll){
var inner=el.querySelectorAll('.popup-hit-explosion');
for(var i=0;i<inner.length;i++){ if(inner[i].parentNode)inner[i].parentNode.removeChild(inner[i]); }
}
}
var mo=new MutationObserver(function(muts){
for(var i=0;i<muts.length;i++){
var added=muts[i].addedNodes; if(!added)continue;
for(var j=0;j<added.length;j++) killCenter(added[j]);
}
});
if(document.body) mo.observe(document.body,{childList:true,subtree:true});
console.log('⭕ 中央円除去パッチv2 適用完了');
})();
// =====================================================================
// 🔥 中央武器アイコン⇄装備同期 v2（画像対応＋ガチャ武器対応）
// ・装備中武器を PARTY_WEAPONS＋WEAPONS(ガチャ)＋図鑑DOMキャッシュ から検索
// ・武器に img があれば【画像】を表示、無ければ絵文字、それも無ければ🗡️
// ・ガチャで引いた新武器を装備すれば中央アイコンが自動でその武器になる
// ・モック(絵文字)→本番(画像)移行後もそのまま動く
// =====================================================================
(function applyFlickWeaponSyncV2(){
"use strict";
if(window.__flickWeaponSyncV2) return; window.__flickWeaponSyncV2=true;
var FALLBACK={fire_sword:'🔥'};

/* 武器プールを全ソースから収集 */
function poolWeapons(){
var arr=[];
try{ if(typeof PARTY_WEAPONS!=='undefined'&&Array.isArray(PARTY_WEAPONS)) arr=arr.concat(PARTY_WEAPONS); }catch(e){}
try{ if(typeof WEAPONS!=='undefined'&&Array.isArray(WEAPONS)) arr=arr.concat(WEAPONS); }catch(e){}
try{ if(window.PARTY_WEAPONS&&Array.isArray(window.PARTY_WEAPONS)) arr=arr.concat(window.PARTY_WEAPONS); }catch(e){}
try{ if(window.WEAPONS&&Array.isArray(window.WEAPONS)) arr=arr.concat(window.WEAPONS); }catch(e){}
return arr;
}
/* 図鑑DOMから img/emoji をキャッシュ（プールが見えなくても拾える） */
var WCACHE={};
function buildCache(){
try{
var cards=document.querySelectorAll('[data-card^="weapon_"],[data-pcvcard^="weapon_"],[data-gm^="weapon_"]');
for(var i=0;i<cards.length;i++){
var c=cards[i];
var a=c.getAttribute('data-card')||c.getAttribute('data-pcvcard')||c.getAttribute('data-gm')||'';
var id=a.replace('weapon_','');
if(!id) continue;
var img=c.querySelector('img');
var emo=c.querySelector('.pty-card-emoji,.gm-emoji,.pty-card-ico');
WCACHE[id]={ img: img?(img.getAttribute('src')||img.src):'', emoji: emo?emo.textContent.trim():'' };
}
}catch(e){}
}
function findWeapon(id){
var list=poolWeapons();
for(var i=0;i<list.length;i++){ if(list[i]&&list[i].id===id) return list[i]; }
return null;
}
function apply(el,html,key){
if(el.getAttribute('data-wskey')===key) return;
el.setAttribute('data-wskey',key);
el.innerHTML=html;
}
function setEmoji(el,emo){ apply(el, emo, 't:'+emo); }
function setImg(el,w){
var fb=(w.emoji||FALLBACK[w.id]||'🗡️');
apply(el,'<img src="'+w.img+'" alt="" style="width:1.7em;height:1.7em;object-fit:contain;vertical-align:middle;" onerror="this.outerHTML=\''+fb+'\'">', 'i:'+w.img);
}
function sync(){
var el=document.getElementById('flickWeaponIcon'); if(!el) return;
buildCache();
var id='';
try{ id=(typeof activeWeapon!=='undefined'&&activeWeapon)?String(activeWeapon):''; }catch(e){}
if(!id){ setEmoji(el,'🗡️'); return; }   // 素手
var w=findWeapon(id);
if(w&&w.img){ setImg(el,w); return; }
if(w&&w.emoji){ setEmoji(el,w.emoji); return; }
var c=WCACHE[id];
if(c&&c.img){ setImg(el,{img:c.img,emoji:c.emoji}); return; }
if(c&&c.emoji){ setEmoji(el,c.emoji); return; }
setEmoji(el, FALLBACK[id]||'🗡️');
}
/* 装備変更/バトル開始/常時 で同期 */
var __sw=window.selectWeapon;
window.selectWeapon=function(){ var r=__sw?__sw.apply(this,arguments):undefined; setTimeout(sync,60); return r; };
var __sb=window.startMultiBattlePlay;
window.startMultiBattlePlay=function(){ var r=__sb?__sb.apply(this,arguments):undefined; setTimeout(sync,60); return r; };
setInterval(sync,800);
console.log('🔥 中央武器アイコン同期v2(画像+ガチャ対応)適用完了');
})();
// =====================================================================
// 🧹 味方/自キャラの「謎の六角形枠＋紫背景」除去パッチ（multi.js末尾追記）
//   ・.multi-party-icon の 六角形clip-path／紫border／紫background／box-shadow を除去
//   ・キャラ画像自体はそのまま表示（見やすさのため角丸＋薄い影だけ付与）
//   ※ 既存CSSより後に読むので !important で上勝ちします
// =====================================================================
(function applyPartyIconCleanPatch() {
    "use strict";
    if (window.__partyIconCleanApplied) return;
    window.__partyIconCleanApplied = true;
    (function() {
        if (document.getElementById('picCleanCss')) return;
        var s = document.createElement('style');
        s.id = 'picCleanCss';
        s.textContent = [
            'body.in-game-active .multi-party-icon,',
            'body.in-game-active .m2-ally-icon,',
            'body.in-game-active .m2-me-icon{',
            '  clip-path:none !important;',
            '  -webkit-clip-path:none !important;',
            '  border:none !important;',
            '  background:transparent !important;',
            '  box-shadow:none !important;',
            '}',
            /* 画像はそのままで見やすさだけ最低限 */
            'body.in-game-active .multi-party-icon img{border-radius:10px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.6));}',
            /* 「修」などの文字フォールバックも見やすく */
            'body.in-game-active .multi-party-icon{color:#e2e8f0;}'
        ].join('\n');
        (document.head || document.documentElement).appendChild(s);
    })();
    console.log('🧹 味方/自キャラの六角形枠＋紫背景 除去パッチ適用完了');
})();
// =====================================================================
// ⏱️ 敵行動 円形ゲージ v3（#multiBossHpFill のバー枠へ直接差し込み）
//   ・DOM組み替えなし＝バー枠(container)の内側・右端に絶対配置
//   ・バー枠に padding-right を確保し、ゲージとバーが“完全にくっつく”
//   ・満タン(100%)＝敵の攻撃／色変化＋攻撃瞬間の赤フラッシュ
//   ・旧「行動: X.X秒」テキストと旧ゲージは非表示
//   ※ 旧リングパッチ(v1/v2)は削除してから追記
// =====================================================================
(function applyEnemyRingGaugePatch3(){
"use strict";
if(window.__enemyRing3) return; window.__enemyRing3=true;

/* 旧v2のラッパーが残っていれば元に戻す */
(function(){
var oldRow=document.getElementById('m2BarRow');
if(oldRow&&oldRow.parentNode){
var bar=oldRow.firstElementChild;
if(bar) oldRow.parentNode.insertBefore(bar, oldRow);
oldRow.parentNode.removeChild(oldRow);
}
})();

(function injectCss(){
if(document.getElementById('m2RingCss3')) return;
var s=document.createElement('style'); s.id='m2RingCss3';
s.textContent=[
'#multiEnemyTimerDisplay,#m2ActionGauge{display:none !important;}',
'#m2AtkRing{pointer-events:none;}',
'#m2AtkRing svg{display:block;width:40px;height:40px;}',
'#m2AtkRingNum{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:ui-monospace,monospace;font-size:11px;font-weight:800;color:#fff;text-shadow:0 1px 2px #000;}',
'#m2AtkRing.m2-ring-flash{animation:m2RingFlash3 .4s ease;}',
'#m2AtkRing.m2-ring-flash #m2AtkRingFg{stroke:#ff2d4c !important;filter:drop-shadow(0 0 10px rgba(255,45,76,.95));}',
'@keyframes m2RingFlash3{0%{transform:translateY(-50%) scale(1)}30%{transform:translateY(-50%) scale(1.18)}100%{transform:translateY(-50%) scale(1)}}'
].join('\n');
(document.head||document.documentElement).appendChild(s);
})();

var C=100.53;
/* #multiBossHpFill からバー枠(container)を辿る */
function host(){
var fill=document.getElementById('multiBossHpFill')||document.querySelector('.multi-boss-hp-fill');
if(!fill) return null;
var c=fill.closest('#multiBossHpBarContainer');
if(!c){ var fb=fill.closest('.multi-boss-full-bar'); c=fb?fb.parentElement:null; }
if(!c) c=fill.parentElement?fill.parentElement.parentElement:null;
return c;
}
function makeRing(){
var ring=document.createElement('div'); ring.id='m2AtkRing';
ring.innerHTML='<svg viewBox="0 0 40 40">'
+'<circle cx="20" cy="20" r="16" fill="rgba(0,0,0,.55)" stroke="rgba(255,255,255,.12)" stroke-width="4"></circle>'
+'<circle id="m2AtkRingFg" cx="20" cy="20" r="16" fill="none" stroke="#f5c451" stroke-width="4" stroke-linecap="round" stroke-dasharray="'+C+'" stroke-dashoffset="'+C+'" transform="rotate(-90 20 20)"></circle>'
+'</svg><div id="m2AtkRingNum">10</div>';
return ring;
}
function ensure(){
var c=host(); if(!c) return;
var ring=document.getElementById('m2AtkRing');
if(!ring){ ring=makeRing(); c.appendChild(ring); }
if(ring.parentNode!==c) c.appendChild(ring);
/* レイアウト固定＝バーと完全にくっつける */
var cs=getComputedStyle(c);
if(cs.position==='static') c.style.position='relative';
c.style.paddingRight='46px';
ring.style.position='absolute';
ring.style.right='0';
ring.style.top='50%';
ring.style.transform='translateY(-50%)';
ring.style.zIndex='30';
}
var prevLeft=10;
function update(){
var ring=document.getElementById('m2AtkRing');
var fg=document.getElementById('m2AtkRingFg');
var num=document.getElementById('m2AtkRingNum');
if(!ring||!fg) return;
try{ if(typeof currentMultiMode!=='undefined'&&currentMultiMode==='pvp'){ring.style.display='none';return;} else ring.style.display=''; }catch(e){}
var total=10;
var left=(typeof multiEnemyTimeLeft==='number')?multiEnemyTimeLeft:total;
left=Math.max(0,Math.min(total,left));
var p=(total-left)/total;
fg.style.strokeDashoffset=String(C*(1-p));
fg.style.stroke = p>0.75?'#ff5468':(p>0.5?'#ff8a3d':'#f5c451');
if(num) num.textContent=String(Math.ceil(left));
if(left>prevLeft+0.5){ ring.classList.remove('m2-ring-flash'); void ring.offsetWidth; ring.classList.add('m2-ring-flash'); setTimeout(function(){ring.classList.remove('m2-ring-flash');},420); }
prevLeft=left;
}
setInterval(function(){ ensure(); update(); },100);
console.log('⏱️ 敵行動 円形ゲージv3適用完了');
})();
// =====================================================================
// ⏱️ 円ゲージ はみ出し修正パッチ（multi.js末尾追記・既存不変更）
// 原因：バー枠 width:100% ＋ 右パディング46px ＝ 100%+46px で右切れ
// 対策：box-sizing:border-box にして「パディング込み100%」へ
//      → バーがゲージ分だけ縮み、ゲージは画面内に収まる
// =====================================================================
(function applyRingFitPatch(){
"use strict";
if(window.__ringFitApplied) return; window.__ringFitApplied=true;

function host(){
var fill=document.getElementById('multiBossHpFill')||document.querySelector('.multi-boss-hp-fill');
if(!fill) return null;
var c=fill.closest('#multiBossHpBarContainer');
if(!c){ var fb=fill.closest('.multi-boss-full-bar'); c=fb?fb.parentElement:null; }
if(!c) c=fill.parentElement?fill.parentElement.parentElement:null;
return c;
}
function fix(){
var c=host(); if(!c) return;
/* ★ここが核心：パディング込みで100%にする */
c.style.boxSizing='border-box';
c.style.width='100%';
c.style.maxWidth='100%';
c.style.paddingRight='46px';
c.style.position='relative';
/* ゲージは枠の内側・右端に固定 */
var ring=document.getElementById('m2AtkRing');
if(ring){
ring.style.position='absolute';
ring.style.right='0';
ring.style.top='50%';
ring.style.transform='translateY(-50%)';
ring.style.zIndex='30';
}
/* 親(アリーナ上部)もはみ出さないよう保険 */
var p=c.parentElement;
if(p){ p.style.maxWidth='100%'; }
}
setInterval(fix,120);
fix();
console.log('⏱️ 円ゲージはみ出し修正パッチ適用完了');
})();
// =====================================================================
// ⏱️ 円ゲージ 最前面＋見切れ/文字重なり解消パッチ（multi.js末尾追記）
// ① 円ゲージを z-index 最前面 に（バーや文字の手前に表示）
// ② 上下の見切れを解消＝コンテナ/アリーナの overflow を visible（はみ出しOK）
// ③ バーのHP文字をゲージの左側へ退避（重ならない）
// =====================================================================
(function applyRingFrontPatch(){
"use strict";
if(window.__ringFrontApplied) return; window.__ringFrontApplied=true;

(function(){if(document.getElementById('m2RingCss5'))return;var s=document.createElement('style');s.id='m2RingCss5';s.textContent=[
/* ② はみ出し許可（上下見切れ解消） */
'#m2ArenaTop{overflow:visible !important;}',
'#m2ArenaTop #multiBossHpBarContainer{overflow:visible !important;position:relative !important;}',
/* ① 円ゲージ最前面 */
'#m2AtkRing{z-index:80 !important;overflow:visible !important;}',
/* ③ HP文字をゲージ左へ退避 */
'.multi-boss-hp-text-layer{right:48px !important;}',
'#multiEnemyHpText{right:48px !important;}'
].join('\n');(document.head||document.documentElement).appendChild(s);})();

function fix(){
var ring=document.getElementById('m2AtkRing');
if(ring){ ring.style.zIndex='80'; ring.style.overflow='visible'; }
var c=document.getElementById('multiBossHpBarContainer');
if(c){ c.style.overflow='visible'; }
var at=document.getElementById('m2ArenaTop');
if(at){ at.style.overflow='visible'; }
/* ③ 文字退避（インラインでも念押し） */
var tl=document.querySelector('.multi-boss-hp-text-layer');
if(tl){ tl.style.right='60px'; }
var ht=document.getElementById('multiEnemyHpText');
if(ht&&!tl){ ht.style.marginRight='60px'; }
}
setInterval(fix,150);
fix();
console.log('⏱️ 円ゲージ最前面＋見切れ/文字重なり解消 適用完了');
})();
// =====================================================================
// 🔧 ボスHP文字 左寄せ修正パッチ（multi.js末尾追記・既存不変更）
// ・ボスバー内の「数値 / 数値」または「数値」テキストを自動検出
// ・円ゲージ(#m2AtkRing)の中身は除外
// ・絶対配置なら right:52px、そうでなければ margin-right:52px で
//   ゲージの左側へ退避＝重なりを根治
// =====================================================================
(function applyBossHpTextLeftPatch(){
"use strict";
if(window.__bossHpTextLeft) return; window.__bossHpTextLeft=true;

function host(){
var fill=document.getElementById('multiBossHpFill')||document.querySelector('.multi-boss-hp-fill');
if(!fill) return null;
var c=fill.closest('#multiBossHpBarContainer');
if(!c){ var fb=fill.closest('.multi-boss-full-bar'); c=fb?fb.parentElement:null; }
if(!c) c=fill.parentElement?fill.parentElement.parentElement:null;
return c;
}
function fix(){
var c=host(); if(!c) return;
var all=c.querySelectorAll('*');
for(var i=0;i<all.length;i++){
var el=all[i];
if(el.children&&el.children.length>0) continue;          // 葉のみ
if(el.closest('#m2AtkRing')) continue;                    // ゲージ内は除外
var t=(el.textContent||'').trim();
if(!/^\d[\d,]*(\s*\/\s*\d[\d,]*)?$/.test(t)) continue;    // HP数値のみ
var cs=getComputedStyle(el);
if(cs.position==='absolute'||cs.position==='fixed'){
el.style.right='52px';
el.style.left='auto';
}else{
el.style.marginRight='52px';
}
el.style.zIndex='31';
}
}
setInterval(fix,150);
fix();
console.log('🔧 ボスHP文字左寄せ修正 適用完了');
})();
// =====================================================================
// 👤 1人(ソロ)マルチ対応 v2（レイアウト自動修正つき・multi.js末尾追記）
// ・人数選択の先頭に「1人パーティ」を追加
// ・追加と同時にコンテナを 4列グリッドへ自動修正＝2/3/4と揃って表示
// ・「1」選択→バトル開始時に味方を除外＝自分だけで戦闘
// ・2/3/4を選び直せば今まで通り味方あり
// =====================================================================
(function applySoloModePatch2(){
"use strict";
if(window.__soloMode2) return; window.__soloMode2=true;

/* 4列レイアウトCSS（崩れ防止） */
(function(){if(document.getElementById('soloCss2'))return;var s=document.createElement('style');s.id='soloCss2';s.textContent=[
'.mdu-4col{display:grid !important;grid-template-columns:repeat(4,1fr) !important;gap:8px !important;}',
'.mdu-4col > *{min-width:0 !important;margin:0 !important;box-sizing:border-box !important;}',
'.mdu-4col .mdu-count-num{font-size:22px !important;}',
'.mdu-4col > * [class*="label"],.mdu-4col > * div{font-size:10px !important;}'
].join('\n');(document.head||document.documentElement).appendChild(s);})();

function addOneOption(){
var nums=document.querySelectorAll('.mdu-count-num');
if(!nums.length) return;
var opt=nums[0].closest('button,[data-count],.mdu-count,.mdu-opt')||nums[0].parentElement;
var list=opt.parentElement; if(!list) return;
list.classList.add('mdu-4col');           // ★常に4列へ整える
if(list.querySelector('[data-oneopt]')) return;
var clone=opt.cloneNode(true);
clone.setAttribute('data-oneopt','1');
if(clone.hasAttribute('data-count')) clone.setAttribute('data-count','1');
var sp=clone.querySelector('.mdu-count-num'); if(sp) sp.textContent='1';
list.insertBefore(clone,list.firstChild);
/* 1を選択 */
clone.addEventListener('click',function(){
window.__multiPartySize=1;
markSel(list,clone);
});
/* 他を選び直したらソロ解除 */
for(var i=0;i<list.children.length;i++){
(function(o){
if(o===clone)return;
o.addEventListener('click',function(){
var n=o.querySelector('.mdu-count-num');
window.__multiPartySize=n?parseInt(n.textContent,10)||0:0;
});
})(list.children[i]);
}
}
function markSel(list,sel){
for(var i=0;i<list.children.length;i++){
var o=list.children[i]; if(!o||!o.classList)continue;
o.classList.remove('on','selected','active');
}
sel.classList.add('on','selected','active');
}

/* 1人選択時は味方を除外して開始 */
var __sb=window.startMultiBattlePlay;
window.startMultiBattlePlay=function(){
if(window.__multiPartySize===1&&typeof multiPartyMembers!=='undefined'&&multiPartyMembers){
multiPartyMembers=multiPartyMembers.filter(function(m){return m&&m.isMe;});
try{ if(window.renderMultiParty)window.renderMultiParty(); }catch(e){}
}
return __sb?__sb.apply(this,arguments):undefined;
};

setInterval(addOneOption,800);
console.log('👤 1人(ソロ)マルチv2(4列レイアウト修正)適用完了');
})();
// =====================================================================
// 👤 ソロ時 ALLY表示根治 v3（multi.js末尾追記・既存不変更）
// 原因：①再代入だと元の束( binding )に効かない ②結成が後で味方を再構築
// 対策：①splice で「その場」削り ②renderMultiParty 前でトリム
//      ③戦闘中は .m2-ally 行をDOMから強制除去（表示レベルでも根治）
// =====================================================================
(function applySoloFix3(){
"use strict";
if(window.__soloFix3) return; window.__soloFix3=true;

/* 自分だけ残してその場で削る（const束でも効く） */
function truncateToSelf(){
if(window.__multiPartySize!==1) return;
if(typeof multiPartyMembers==='undefined'||!multiPartyMembers) return;
for(var i=multiPartyMembers.length-1;i>=0;i--){
if(!multiPartyMembers[i]||!multiPartyMembers[i].isMe) multiPartyMembers.splice(i,1);
}
}

/* 描画の「前」に必ずトリム */
var __rm=window.renderMultiParty;
window.renderMultiParty=function(){ truncateToSelf(); return __rm?__rm.apply(this,arguments):undefined; };

/* 開始時もトリム＋再描画 */
var __sb=window.startMultiBattlePlay;
window.startMultiBattlePlay=function(){
truncateToSelf();
var r=__sb?__sb.apply(this,arguments):undefined;
try{ if(window.renderMultiParty)window.renderMultiParty(); }catch(e){}
return r;
};

/* 戦闘中：表示レベルでもALLY行を除去（ソロ時のみ） */
function cleanDom(){
if(window.__multiPartySize!==1) return;
if(!document.body.classList.contains('in-game-active')) return;
var rows=document.querySelectorAll('.multi-party-member.m2-ally');
for(var i=0;i<rows.length;i++){ if(rows[i].parentNode) rows[i].parentNode.removeChild(rows[i]); }
}
setInterval(function(){ truncateToSelf(); cleanDom(); },400);
console.log('👤 ソロ時ALLY表示根治v3適用完了');
})();
// =====================================================================
// 🐧 ソロ時 自キャラ縦中央パッチ（multi.js末尾追記・既存不変更）
// ・#m2ArenaMid の「左カラム(味方/自キャラ)」だけを縦中央に配置
//   → 上の詰まりを解いてキャラを下へ（下のスカスカを吸収）
// ・敵画像(右カラム)は動かさない
// ・4人パーティ時(左が高い)はほぼ影響なし
// =====================================================================
(function applySoloCenterPatch(){
"use strict";
if(window.__soloCenterApplied) return; window.__soloCenterApplied=true;
(function(){
if(document.getElementById('soloCenterCss')) return;
var s=document.createElement('style'); s.id='soloCenterCss';
s.textContent=[
'body.in-game-active #m2ArenaMid{align-items:stretch !important;}',
/* 左カラム(=最初の子)だけを縦中央へ */
'body.in-game-active #m2ArenaMid > *:first-child{',
'  display:flex !important;flex-direction:column !important;',
'  justify-content:center !important;',
'}'
].join('\n');
(document.head||document.documentElement).appendChild(s);
})();
console.log('🐧 ソロ時自キャラ縦中央パッチ適用完了');
})();
// =====================================================================
// ⚔️ 対人戦(PVP)カスタマイズ（モック版・オンラインは後で接続）
// ・敵→相手キャラ表示（画像/名前/装備/COMBOゲージ＝自分と同じ）
// ・2v2＝相手を縦積み ／ 上段バー＝ターゲット相手のHP/名前
// ・正解→相手へダメージ／ミス→自分が被ダメ(相手atk依存)
// ・相手COMBOは攻撃ごとに+、満タンで大技／ドロップ・報酬無し
// ・後で window.__pvpOpponents に実データを入れればオンライン化
// =====================================================================
(function applyPvpCustomPatch(){
"use strict";
if(window.__pvpCustomApplied) return; window.__pvpCustomApplied=true;
var COMBO_MAX=10;

var MOCK_CHARS=[{id:'tangon',name:'タンゴン',img:'tangon.png'}];
var MOCK_WEAPONS=[{id:'fire_sword',e:'🔥',n:'業火の大剣'},{id:'',e:'🗡️',n:'素手'}];
var MOCK_ARMORS=[{id:'cosmic_shield',e:'🛡️',n:'星屑の盾'},{id:'',e:'🛡️',n:'布の服'}];

function isPvp(){ try{ return (typeof currentMultiMode!=='undefined'&&currentMultiMode==='pvp'); }catch(e){ return false; } }
function fmt(){ try{ return (typeof window.__pvpFormat!=='undefined')?window.__pvpFormat:'1v1'; }catch(e){ return '1v1'; } }

function buildOpponents(){
if(window.__pvpOpponents&&window.__pvpOpponents.length) return window.__pvpOpponents;
var n=(fmt()==='2v2')?2:1; var arr=[];
for(var i=0;i<n;i++){
var c=MOCK_CHARS[i%MOCK_CHARS.length];
var w=MOCK_WEAPONS[Math.floor(Math.random()*MOCK_WEAPONS.length)];
var a=MOCK_ARMORS[Math.floor(Math.random()*MOCK_ARMORS.length)];
arr.push({id:'opp'+i,charId:c.id,name:c.name,img:c.img,weapon:w,armor:a,hp:3500,maxHp:3500,atk:300,combo:0});
}
window.__pvpOpponents=arr; return arr;
}
function targetOpp(){
var o=window.__pvpOpponents||[]; 
for(var i=0;i<o.length;i++){ if(o[i].hp>0) return o[i]; }
return o[0]||null;
}

/* ===== CSS ===== */
(function(){if(document.getElementById('pvpCss'))return;var s=document.createElement('style');s.id='pvpCss';s.textContent=[
'#pvpOppWrap{display:flex;flex-direction:column;gap:8px;align-items:center;width:100%;}',
'.pvp-opp-card{width:min(46vw,190px);border-radius:14px;padding:8px;background:linear-gradient(180deg,rgba(58,47,34,.6),rgba(30,24,16,.6));border:1px solid rgba(200,144,42,.4);box-shadow:0 6px 18px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:5px;}',
'.pvp-opp-top{display:flex;align-items:center;gap:8px;}',
'.pvp-opp-img{width:44px;height:44px;border-radius:10px;object-fit:cover;background:rgba(0,0,0,.4);}',
'.pvp-opp-name{font-size:12px;font-weight:900;color:#ffd2d8;text-shadow:0 0 10px rgba(255,84,104,.5);}',
'.pvp-opp-equip{font-size:11px;color:#e2e8f0;}',
'.pvp-opp-hp{height:8px;border-radius:4px;background:rgba(0,0,0,.5);overflow:hidden;}',
'.pvp-opp-hp i{display:block;height:100%;background:linear-gradient(90deg,#ff5468,#ff8a3d);width:100%;}',
'.pvp-combo{display:flex;align-items:center;gap:6px;}',
'.pvp-combo .lab{font-size:9px;font-weight:800;color:#f5c451;}',
'.pvp-combo .bar{flex:1;height:6px;border-radius:3px;background:rgba(0,0,0,.5);overflow:hidden;}',
'.pvp-combo .bar i{display:block;height:100%;background:linear-gradient(90deg,#f5c451,#ff8a3d);width:0%;}',
'.pvp-combo .num{font-size:10px;font-weight:900;color:#fff;}'
].join('\n');(document.head||document.documentElement).appendChild(s);})();

/* ===== 描画 ===== */
function rightCol(){ return document.querySelector('#m2ArenaMid > *:last-child'); }
function renderOpponents(){
var right=rightCol(); if(!right) return;
var boss=document.getElementById('multiBossImage'); if(boss) boss.style.display=isPvp()?'none':'';
var sig=document.getElementById('m2BossSigil'); if(sig) sig.style.display=isPvp()?'none':'';
var wrap=document.getElementById('pvpOppWrap');
if(!isPvp()){ if(wrap)wrap.style.display='none'; return; }
if(!wrap){ wrap=document.createElement('div'); wrap.id='pvpOppWrap'; right.appendChild(wrap); }
wrap.style.display='';
var opps=buildOpponents();
if(wrap.childElementCount!==opps.length){
wrap.innerHTML='';
opps.forEach(function(o,i){
var c=document.createElement('div'); c.className='pvp-opp-card'; c.id='pvpOpp-'+i;
c.innerHTML='<div class="pvp-opp-top"><img class="pvp-opp-img" src="'+(o.img||'')+'" onerror="this.style.display=\'none\'"><div><div class="pvp-opp-name"></div><div class="pvp-opp-equip"></div></div></div>'
+'<div class="pvp-opp-hp"><i></i></div>'
+'<div class="pvp-combo"><span class="lab">COMBO</span><span class="bar"><i></i></span><span class="num">0</span></div>';
wrap.appendChild(c);
});
}
updateOpponents();
}
function updateOpponents(){
if(!isPvp())return;
var opps=window.__pvpOpponents||[];
opps.forEach(function(o,i){
var c=document.getElementById('pvpOpp-'+i); if(!c)return;
c.querySelector('.pvp-opp-name').textContent=o.name;
c.querySelector('.pvp-opp-equip').textContent=(o.weapon?o.weapon.e:'🗡️')+' '+(o.armor?o.armor.e:'🛡️');
c.querySelector('.pvp-opp-hp i').style.width=Math.max(0,(o.hp/o.maxHp)*100)+'%';
c.querySelector('.pvp-combo .bar i').style.width=Math.min(100,(o.combo/COMBO_MAX)*100)+'%';
c.querySelector('.pvp-combo .num').textContent=String(o.combo);
});
/* 上段バーをターゲット相手に同期 */
var t=targetOpp(); if(!t)return;
var nameEl=document.querySelector('#multiBossName,#multiEnemyName,.multi-boss-name');
if(nameEl) nameEl.textContent=t.name;
var fill=document.getElementById('multiBossHpFill');
if(fill){ var r=Math.max(0,t.hp/t.maxHp); fill.style.width=(r*100)+'%'; fill.style.setProperty('--hp-ratio',r.toFixed(3)); }
var ht=document.getElementById('multiEnemyHpText'); if(ht) ht.textContent=Math.max(0,Math.round(t.hp))+' / '+t.maxHp;
}

/* ===== 正解→相手へダメージ ===== */
var __pf=window.processMultiFlickAnswer;
window.processMultiFlickAnswer=function(ci){
var correct=(typeof currentMultiCorrectIndex!=='undefined')&&(ci===currentMultiCorrectIndex);
var r=__pf?__pf.apply(this,arguments):undefined;
if(isPvp()&&correct){
var t=targetOpp();
if(t){
var comboMulti=1+Math.floor(((typeof gameComboCount!=='undefined')?gameComboCount:0)/5)*0.5;
var dmg=Math.round(300*comboMulti);
t.hp=Math.max(0,t.hp-dmg);
try{ window.showCharacterPopup?null:null; }catch(e){}
if(t.hp<=0&&window.__pvpOpponents.every(function(o){return o.hp<=0;})){
try{ clearInterval(gameTimerInterval); }catch(e){}
setTimeout(function(){ alert('🎉 ライバルチームに勝利！'); try{window.cancelMultiBattlePlay(true);}catch(e){} },500);
}
updateOpponents();
}
}
return r;
};

/* ===== 相手攻撃（ミス時自分は被ダメ／相手COMBO増加） ===== */
var __pt=window.handleMultiBattleTimer;
window.handleMultiBattleTimer=function(){
if(isPvp()){
if(typeof multiEnemyTimeLeft==='number'){ multiEnemyTimeLeft-=0.1;
if(multiEnemyTimeLeft<=0){ multiEnemyTimeLeft=10;
var me=(typeof multiPartyMembers!=='undefined')?multiPartyMembers.find(function(m){return m.isMe;}):null;
(window.__pvpOpponents||[]).forEach(function(o){
if(o.hp<=0)return;
o.combo=Math.min(COMBO_MAX,o.combo+1);
var big=(o.combo>=COMBO_MAX); if(big)o.combo=0;
var dmg=Math.round(o.atk*(big?2:1));
if(me&&me.hp>0){ me.hp=Math.max(0,me.hp-dmg); try{window.showCharacterPopup(me.id,dmg,'damage');}catch(e){} }
});
try{window.updateMultiHpBars();}catch(e){}
updateOpponents();
}
var td=document.getElementById('multiEnemyTimerDisplay');
if(td)td.innerText='行動: '+Math.max(0,multiEnemyTimeLeft).toFixed(1)+'秒';
}
return;
}
return __pt?__pt.apply(this,arguments):undefined;
};

setInterval(function(){ renderOpponents(); },500);
console.log('⚔️ 対人戦カスタマイズ(モック)適用完了');
})();
// =====================================================================
// ️ 対人戦レイアウトパッチ（スケッチ準拠・1v1/2v2縦積み・モック相手）
// Ⅰ=1v1:相手1体 ／ Ⅱ=2v2:相手2体を縦積み
// 各相手カード=キャラ画像+名前+装備+COMBOゲージ+HPバー
// 相手はタイマー攻撃(コンボで大技)／ミス=自分が被ダメ／報酬なし
// =====================================================================
(function applyPvpLayoutPatch(){
"use strict";
if(window.__pvpLayoutApplied) return; window.__pvpLayoutApplied=true;

(function(){if(document.getElementById('pvpLayoutCss'))return;var s=document.createElement('style');s.id='pvpLayoutCss';s.textContent=[
'body.pvp-mode #multiBossImage,body.pvp-mode #m2BossSigil{display:none !important;}',
'#pvpOppWrap{display:flex;flex-direction:column;gap:8px;width:100%;align-items:stretch;}',
'.pvp-opp-card{display:flex;align-items:center;gap:8px;padding:8px;border-radius:12px;',
' background:linear-gradient(180deg,rgba(58,47,34,.6),rgba(30,24,16,.6));border:1px solid rgba(255,84,110,.35);',
' box-shadow:0 6px 18px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.06);}',
'.pvp-opp-card.dead{opacity:.4;filter:grayscale(1);}',
'.pvp-opp-img{width:44px;height:44px;border-radius:10px;object-fit:cover;flex:0 0 auto;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:24px;}',
'.pvp-opp-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;}',
'.pvp-opp-namerow{display:flex;align-items:center;gap:6px;}',
'.pvp-opp-name{font-size:11px;font-weight:900;color:#ffd2d8;text-shadow:0 0 6px rgba(255,84,104,.5);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
'.pvp-opp-equip{font-size:12px;display:flex;gap:3px;}',
'.pvp-opp-hp{height:7px;border-radius:4px;background:rgba(0,0,0,.55);overflow:hidden;}',
'.pvp-opp-hp i{display:block;height:100%;background:linear-gradient(90deg,#ff5468,#ff8a3d);width:100%;}',
'.pvp-opp-combo{display:flex;align-items:center;gap:5px;}',
'.pvp-opp-combo .lab{font-size:8px;font-weight:900;color:#fbbf24;}',
'.pvp-opp-combo .bar{flex:1;height:5px;border-radius:3px;background:rgba(0,0,0,.55);overflow:hidden;}',
'.pvp-opp-combo .bar i{display:block;height:100%;background:linear-gradient(90deg,#f59e0b,#ff8a3d);width:0%;}'
].join('\n');(document.head||document.documentElement).appendChild(s);})();

var RIVALS=[
 {id:'r1',name:'ライバル修行者',img:'',emoji:'🧑🎓',atk:300},
 {id:'r2',name:'炎の使い手',img:'',emoji:'🔥',atk:340},
 {id:'r3',name:'蒼の剣士',img:'',emoji:'️',atk:320},
 {id:'r4',name:'星読み',img:'',emoji:'🔮',atk:360}
];
function isPvp(){ try{return currentMultiMode==='pvp';}catch(e){return false;} }
function makeOpponents(){
 var fmt='1v1'; try{fmt=document.getElementById('multiPvpTypeSelect')?document.getElementById('multiPvpTypeSelect').value:'1v1';}catch(e){}
 var n=(fmt==='2v2')?2:1;
 var pool=RIVALS.slice().sort(function(){return Math.random()-0.5;});
 var arr=[];
 for(var i=0;i<n;i++){
  var b=pool[i%pool.length];
  arr.push({id:b.id+i,name:b.name,img:b.img,emoji:b.emoji,atk:b.atk,
   weapon:{e:Math.random()<0.5?'🔥':'️'},armor:{e:Math.random()<0.5?'🔮':'️'},
   hp:3500,maxHp:3500,combo:0});
 }
 window.__pvpOpponents=arr;
 return arr;
}
function targetOpp(){ var a=window.__pvpOpponents||[]; for(var i=0;i<a.length;i++){if(a[i].hp>0)return a[i];} return a[0]||null; }

function buildOppPanel(){
 var host=document.getElementById('m2ArenaRight'); if(!host)return;
 var old=document.getElementById('pvpOppWrap'); if(old)old.remove();
 var wrap=document.createElement('div'); wrap.id='pvpOppWrap';
 var opps=window.__pvpOpponents||makeOpponents();
 opps.forEach(function(o,i){
  var c=document.createElement('div'); c.className='pvp-opp-card'; c.id='pvpOpp-'+i;
  c.innerHTML='<div class="pvp-opp-img">'+(o.img?'<img src="'+o.img+'" onerror="this.outerHTML=\''+o.emoji+'\'">':o.emoji)+'</div>'+
   '<div class="pvp-opp-body">'+
   '<div class="pvp-opp-namerow"><span class="pvp-opp-name">'+o.name+'</span><span class="pvp-opp-equip">'+o.weapon.e+' '+o.armor.e+'</span></div>'+
   '<div class="pvp-opp-hp"><i></i></div>'+
   '<div class="pvp-opp-combo"><span class="lab">COMBO</span><span class="bar"><i></i></span></span></div>'+
   '</div>';
  wrap.appendChild(c);
 });
 host.appendChild(wrap);
 updateOppPanel();
}
function updateOppPanel(){
 var opps=window.__pvpOpponents||[];
 opps.forEach(function(o,i){
  var c=document.getElementById('pvpOpp-'+i); if(!c)return;
  c.classList.toggle('dead',o.hp<=0);
  var hp=c.querySelector('.pvp-opp-hp i'); if(hp)hp.style.width=Math.max(0,(o.hp/o.maxHp)*100)+'%';
  var cb=c.querySelector('.pvp-opp-combo .bar i'); if(cb)cb.style.width=Math.min(100,(o.combo/10)*100)+'%';
 });
 var t=targetOpp();
 if(t){
  var nm=document.getElementById('m2EnemyName'); if(nm)nm.textContent=t.name;
  var fill=document.getElementById('multiBossHpFill'); if(fill)fill.style.width=Math.max(0,(t.hp/t.maxHp)*100)+'%';
  var ht=document.getElementById('multiEnemyHpText'); if(ht)ht.textContent=Math.max(0,Math.round(t.hp))+' / '+t.maxHp;
 }
}

/* 開始時にモード付与＋相手生成 */
var __origStart=window.startMultiBattlePlay;
window.startMultiBattlePlay=function(){
 var r=__origStart?__origStart.apply(this,arguments):undefined;
 try{
  if(isPvp()){ document.body.classList.add('pvp-mode'); makeOpponents(); buildOppPanel(); }
  else document.body.classList.remove('pvp-mode');
 }catch(e){}
 return r;
};

/* 正解=ターゲット相手にダメージ */
var __origFlick=window.processMultiFlickAnswer;
window.processMultiFlickAnswer=function(ci){
 var correct=(typeof currentMultiCorrectIndex!=='undefined')&&(ci===currentMultiCorrectIndex);
 if(isPvp()&&correct){
  var t=targetOpp();
  if(t){
   var comboMulti=1+Math.floor(((typeof gameComboCount!=='undefined')?gameComboCount:0)/5)*0.5;
   var dmg=Math.round(300*comboMulti);
   t.hp=Math.max(0,t.hp-dmg);
   updateOppPanel();
   if(window.__pvpOpponents.every(function(o){return o.hp<=0;})){
    try{clearInterval(gameTimerInterval);}catch(e){}
    setTimeout(function(){ alert('🎉 ライバルに勝利！'); try{window.cancelMultiBattlePlay(true);}catch(e){} },400);
    return r;
   }
  }
 }
 var r=__origFlick?__origFlick.apply(this,arguments):undefined;
 return r;
};

/* 相手タイマー攻撃（コンボで大技）／報酬なし */
var __origTimer=window.handleMultiBattleTimer;
window.handleMultiBattleTimer=function(){
 if(isPvp()){
  if(typeof multiEnemyTimeLeft==='number'){
   multiEnemyTimeLeft-=0.1;
   if(multiEnemyTimeLeft<=0){
    multiEnemyTimeLeft=10;
    var me=(typeof multiPartyMembers!=='undefined')?multiPartyMembers.find(function(m){return m.isMe;}):null;
    (window.__pvpOpponents||[]).forEach(function(o){
     if(o.hp<=0)return;
     o.combo=Math.min(10,o.combo+1);
     var big=(o.combo>=10); if(big)o.combo=0;
     var dmg=Math.round(o.atk*(big?2:1));
     if(me&&me.hp>0){ me.hp=Math.max(0,me.hp-dmg); try{window.showCharacterPopup(me.id,dmg,'damage');}catch(e){} }
    });
    try{window.updateMultiHpBars();}catch(e){}
    updateOppPanel();
    if(typeof multiPartyMembers!=='undefined'&&multiPartyMembers.every(function(m){return m.hp<=0;})){
     try{clearInterval(gameTimerInterval);}catch(e){}
     setTimeout(function(){ alert('💀 敗北…'); try{window.cancelMultiBattlePlay(true);}catch(e){} },400);
    }
   }
   var td=document.getElementById('multiEnemyTimerDisplay'); if(td)td.innerText='行動: '+Math.max(0,multiEnemyTimeLeft).toFixed(1)+'秒';
  }
  return;
 }
 return __origTimer?__origTimer.apply(this,arguments):undefined;
};
console.log('⚔️ 対人戦レイアウトパッチ適用完了');
})();
// =====================================================================
// ️ 対人戦ビジュアル修正パッチ（相手画像表示＋攻撃飛翔先修正＋自キャラ下寄せ）
// ① 右カラムで #pvpOppWrap を表示許可（相手カードが見えるようになる）
// ② 攻撃の飛翔先を相手カードに合わせる（見えない照準オーバーレイを相手に重ねる）
// ③ 左カラムを下寄せ＝自キャラが下に来る
// ※ app.js / fix.js / style.css / index.html は不変更
// =====================================================================
(function applyPvpVisualFixPatch(){
"use strict";
if(window.__pvpVisualFixApplied) return; window.__pvpVisualFixApplied=true;

(function injectCss(){
if(document.getElementById('pvpVisFixCss'))return;
var s=document.createElement('style');s.id='pvpVisFixCss';s.textContent=[
/* ① 右カラムで相手カードを表示許可（ここが非表示の原因だった） */
'#m2ArenaRight > #pvpOppWrap{display:flex !important;}',
'#pvpOppWrap{display:flex;flex-direction:column;gap:8px;align-items:center;width:100%;}',
'.pvp-opp-card{display:flex;gap:8px;align-items:center;width:100%;padding:8px;border-radius:12px;',
' background:rgba(0,0,0,.35);border:1px solid rgba(255,84,110,.4);box-shadow:0 4px 14px rgba(0,0,0,.4);}',
'.pvp-opp-imgwrap{width:56px;height:56px;flex:0 0 auto;border-radius:12px;overflow:hidden;background:rgba(0,0,0,.4);',
' display:flex;align-items:center;justify-content:center;font-size:30px;}',
'.pvp-opp-imgwrap img{width:100%;height:100%;object-fit:cover;}',
'.pvp-opp-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;}',
'.pvp-opp-name{font-size:11px;font-weight:800;color:#ffd2d8;text-shadow:0 1px 2px #000;}',
'.pvp-opp-equip{font-size:12px;}',
'.pvp-opp-hp{height:7px;border-radius:4px;background:rgba(0,0,0,.6);overflow:hidden;}',
'.pvp-opp-hp i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#ff5468,#ff8a3d);}',
'.pvp-opp-combo{display:flex;align-items:center;gap:5px;}',
'.pvp-opp-combo .lab{font-size:8px;font-weight:800;color:#fbbf24;}',
'.pvp-opp-combo .bar{flex:1;height:5px;border-radius:3px;background:rgba(0,0,0,.6);overflow:hidden;}',
'.pvp-opp-combo .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#f59e0b,#ff8a3d);}',
/* ③ 左カラム下寄せ＝自キャラを下へ */
'body.in-game-active #m2ArenaLeft{justify-content:flex-end !important;}'
].join('\n');(document.head||document.documentElement).appendChild(s);
})();

function isPvp(){ try{ return currentMultiMode==='pvp'; }catch(e){ return false; } }
function opps(){
var list=window.__pvpOpponents;
if(!list||!list.length){
var fmt='1v1'; try{ var sel=document.getElementById('multiPvpTypeSelect'); if(sel)fmt=sel.value; }catch(e){}
var n=(fmt==='2v2')?2:1; list=[];
for(var i=0;i<n;i++) list.push({id:'opp'+i,name:'ライバル修行者'+(n>1?' '+(i+1):''),img:'tangon.png',emoji:'🐧',weapon:{e:'🗡️'},armor:{e:'🛡️'},hp:3500,maxHp:3500,combo:0});
window.__pvpOpponents=list;
}
list.forEach(function(o){ if(!o.img)o.img='tangon.png'; if(!o.emoji)o.emoji='🐧'; });
return list;
}
function buildWrap(){
var right=document.getElementById('m2ArenaRight'); if(!right)return;
var wrap=document.getElementById('pvpOppWrap');
if(wrap&&wrap.parentNode!==right) right.appendChild(wrap);
if(!wrap){ wrap=document.createElement('div'); wrap.id='pvpOppWrap'; right.appendChild(wrap); }
var list=opps();
if(wrap.childElementCount!==list.length){
wrap.innerHTML='';
list.forEach(function(o,i){
var c=document.createElement('div'); c.className='pvp-opp-card'; c.id='pvpOppCard'+i;
c.innerHTML='<div class="pvp-opp-imgwrap"><img src="'+o.img+'" alt="" onerror="this.style.display=\'none\';this.parentNode.textContent=\''+o.emoji+'\';"></div>'+
'<div class="pvp-opp-info"><div class="pvp-opp-name"></div><div class="pvp-opp-equip"></div>'+
'<div class="pvp-opp-hp"><i></i></div><div class="pvp-opp-combo"><span class="lab">COMBO</span><span class="bar"><i></i></span></div></div>';
wrap.appendChild(c);
});
}
list.forEach(function(o,i){
var c=document.getElementById('pvpOppCard'+i); if(!c)return;
c.querySelector('.pvp-opp-name').textContent=o.name;
c.querySelector('.pvp-opp-equip').textContent=(o.weapon?o.weapon.e:'🗡️')+' '+(o.armor?o.armor.e:'🛡️');
c.querySelector('.pvp-opp-hp i').style.width=Math.max(0,(o.hp/o.maxHp)*100)+'%';
c.querySelector('.pvp-opp-combo .bar i').style.width=Math.min(100,(o.combo||0)*10)+'%';
});
return wrap;
}
function tick(){
var pvp=isPvp();
var wrap=document.getElementById('pvpOppWrap');
var vis=document.getElementById('multiPvpOpponentVisualContainer');
if(!pvp){ if(wrap)wrap.style.display='none'; if(vis)vis.style.display='none'; return; }
var b=document.getElementById('multiBossImage'); if(b)b.style.display='none';
var sig=document.getElementById('m2BossSigil'); if(sig)sig.style.display='none';
wrap=buildWrap();
/* ② 見えない照準を相手カードに重ねる＝攻撃の飛翔先が相手になる */
if(vis&&wrap){
var r=wrap.getBoundingClientRect();
vis.style.display='block';
vis.style.position='fixed';
vis.style.left=r.left+'px'; vis.style.top=r.top+'px';
vis.style.width=r.width+'px'; vis.style.height=r.height+'px';
vis.style.opacity='0'; vis.style.pointerEvents='none';
}
}
setInterval(tick,300);
console.log('⚔️ 対人戦ビジュアル修正パッチ適用完了');
})();
