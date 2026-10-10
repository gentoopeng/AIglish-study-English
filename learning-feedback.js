// Word long-press preview, subtle feedback and offline notification.
(function applyBatch3Patch() {
"use strict";
if (window.__batch3Applied) return;
window.__batch3Applied = true;

/* ==================================================================
【1】エラー可視化
================================================================== */
// Error diagnostics are installed before startup in runtime-errors.js.

// Keep legacy callers on the same bounded, configurable sound player.
window.__b3SoundOk=()=>window.AppSounds?.play('swipe-right');
window.__b3SoundBad=()=>window.AppSounds?.play('swipe-left');
window.__b3SoundTap=()=>window.AppSounds?.play('tap');

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

// Word-card long-press preview.
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
var card = t.closest('.word-row-container');
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

console.log('🔧 第3回パッチ（エラー可視化＋チュートリアル＋控えめ音＋オフライン＋長押し）適用完了');
})();
