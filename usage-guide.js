// The usage guide overlay: its quick start, the sections (from usage-guide-content.js), and the
// sidebar entry. Moved out of app.js, where it was injected by a patch; styles are in usage-guide.css.
window.__USAGE_GUIDE_STEPS = [
    { icon: 'user-check', head: 'アカウントを作る／ログインする', desc: '初めての方は「新規作成」でプレイヤー名・本名・年齢・4桁の暗証番号を登録。発行されたIDはログインに必要なので必ずメモして。2回目以降はID＋暗証番号でログイン。' },
    { icon: 'book-marked', head: '単語帳で単語を覚える', desc: '単語をタップして意味を確認し、右の4つのボタンで理解度をマーク。⚪︎＝定着／△＝曖昧／✕＝不可／ー＝リセット。理解度と復習の記録が保存されます。' },
    { icon: 'zap', head: 'フラッシュ単語で定着させる', desc: '単語帳一覧の「›」からフラッシュ単語を開始できます。' }
];

window.__buildUsageGuideOverlay = function() {
    if (document.getElementById('usageGuideOverlay')) return;

    // クイックスタート
    var stepsHtml = '';
    window.__USAGE_GUIDE_STEPS.forEach(function(s, i) {
        stepsHtml +=
            '<div class="ug-step">' +
            '<div class="ug-step-num">' + (i + 1) + '</div>' +
            '<div class="ug-step-body">' +
            '<div class="ug-step-head"><i data-lucide="' + s.icon + '" size="15"></i>' + s.head + '</div>' +
            '<div class="ug-step-desc">' + s.desc + '</div>' +
            '</div></div>';
    });

    // 機能別アコーディオン
    var accHtml = '';
    window.__USAGE_GUIDE_SECTIONS.forEach(function(sec) {
        accHtml +=
            '<div class="ug-acc">' +
            '<button type="button" class="ug-acc-head">' +
            '<span class="ug-acc-ico"><i data-lucide="' + sec.icon + '" size="16"></i></span>' +
            '<span class="ug-acc-title">' + sec.title + '</span>' +
            '<i data-lucide="chevron-down" size="16" class="ug-chev"></i>' +
            '</button>' +
            '<div class="ug-acc-body">' + sec.html + '</div>' +
            '</div>';
    });

    // Tips
    var tipsHtml = '';
    window.__USAGE_GUIDE_TIPS.forEach(function(t) {
        tipsHtml +=
            '<div class="ug-tip">' +
            '<i data-lucide="lightbulb" size="15" class="ug-tip-ico"></i>' +
            '<div class="ug-tip-text">' + t + '</div>' +
            '</div>';
    });

    var ov = document.createElement('div');
    ov.id = 'usageGuideOverlay';
    ov.innerHTML =
        '<div class="ug-ambient" id="ugAmbient"></div>' +
        '<div class="ug-header">' +
        '<div class="ug-header-icon"><i data-lucide="book-open-check" size="20"></i></div>' +
        '<div class="ug-header-titles">' +
        '<div class="ug-header-title">使い方ガイド</div>' +
        '<div class="ug-header-sub">HOW TO USE · 修行の手引き</div>' +
        '</div>' +
        '<button type="button" class="ug-close" id="ugCloseBtn" aria-label="閉じる"><i data-lucide="x" size="20"></i></button>' +
        '</div>' +
        '<div class="ug-body" id="ugBody">' +
        '<div class="ug-section-title"><i data-lucide="rocket" size="16" style="color:var(--cosmic-cyan);"></i>まずはこの3ステップ</div>' +
        '<div class="ug-steps">' + stepsHtml + '</div>' +
        '<div class="ug-section-title"><i data-lucide="layout-grid" size="16" style="color:var(--cosmic-purple-light);"></i>機能別ガイド</div>' +
        '<div class="ug-acc-list">' + accHtml + '</div>' +
        '<div class="ug-section-title"><i data-lucide="sparkles" size="16" style="color:#FBBF24;"></i>知っておくと得する Tips</div>' +
        '<div class="ug-tips">' + tipsHtml + '</div>' +
        '</div>';

    document.body.appendChild(ov);

    // 微粒子を生成
    var ambient = ov.querySelector('#ugAmbient');
    if (ambient) {
        var sparks = '';
        for (var i = 0; i < 16; i++) {
            var left = Math.round(Math.random() * 100);
            var delay = (Math.random() * 8).toFixed(2);
            var dur = (7 + Math.random() * 8).toFixed(2);
            var size = (2 + Math.round(Math.random() * 3));
            var c = Math.random() < 0.5 ? 'rgba(0,240,255,0.8)' : 'rgba(192,132,252,0.8)';
            sparks += '<span class="ug-spark" style="left:' + left + '%;width:' + size + 'px;height:' + size + 'px;background:' + c + ';animation-delay:' + delay + 's;animation-duration:' + dur + 's;"></span>';
        }
        ambient.innerHTML = sparks;
    }

    // 閉じるボタン
    var closeBtn = ov.querySelector('#ugCloseBtn');
    if (closeBtn) closeBtn.onclick = function() { window.closeUsageGuide(); };

    // 背景タップで閉じる（ヘッダ・本文以外＝オーバーレイ直下のみ）
    ov.addEventListener('click', function(e) {
        if (e.target === ov) window.closeUsageGuide();
    });

    // アコーディオン（イベント委譲）
    var body = ov.querySelector('#ugBody');
    if (body) {
        body.addEventListener('click', function(e) {
            var head = e.target.closest('.ug-acc-head');
            if (!head) return;
            var acc = head.parentElement;
            var accBody = acc.querySelector('.ug-acc-body');
            if (!accBody) return;
            var willOpen = !acc.classList.contains('open');
            acc.classList.toggle('open', willOpen);
            if (willOpen) {
                accBody.style.maxHeight = accBody.scrollHeight + 24 + 'px';
            } else {
                accBody.style.maxHeight = '0px';
            }
        });
    }

    if (typeof window.initLucide === 'function') window.initLucide();
};

window.openUsageGuide = function() {
    window.__buildUsageGuideOverlay();
    var ov = document.getElementById('usageGuideOverlay');
    if (!ov) return;
    // サイドバーは閉じておく
    if (typeof window.toggleSidebar === 'function') window.toggleSidebar(false);
    ov.style.display = 'flex';
    ov.scrollTop = 0;
    var body = ov.querySelector('#ugBody');
    if (body) body.scrollTop = 0;
    // 開いているアコーディオンの高さを再計測（表示後に正しく出す）
    var openAccs = ov.querySelectorAll('.ug-acc.open .ug-acc-body');
    for (var i = 0; i < openAccs.length; i++) {
        openAccs[i].style.maxHeight = openAccs[i].scrollHeight + 24 + 'px';
    }
    requestAnimationFrame(function() {
        requestAnimationFrame(function() { ov.classList.add('ug-visible'); });
    });
};

window.closeUsageGuide = function() {
    var ov = document.getElementById('usageGuideOverlay');
    if (!ov) return;
    ov.classList.remove('ug-visible');
    setTimeout(function() {
        if (!ov.classList.contains('ug-visible')) ov.style.display = 'none';
    }, 320);
};

if (!window.__ugEscBound) {
    window.__ugEscBound = true;
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
            var ov = document.getElementById('usageGuideOverlay');
            if (ov && ov.classList.contains('ug-visible')) window.closeUsageGuide();
        }
    });
}

window.injectUsageGuideButton = function() {
    var sidebar = document.getElementById('sidebarMenu');
    if (!sidebar) return;
    if (document.getElementById('usageGuideEntryBtn')) {
        if (typeof window.initLucide === 'function') window.initLucide();
        return;
    }
    var btn = document.createElement('button');
    btn.id = 'usageGuideEntryBtn';
    btn.type = 'button';
    btn.className = 'sidebar-item';
    btn.innerHTML = '<i data-lucide="book-open-check" size="18"></i><span>使い方ガイド</span>';
    btn.onclick = function() { window.openUsageGuide(); };

    // 「ログアウト」を含む要素の直前に挿入
    var anchor = null;
    var children = sidebar.children;
    for (var i = 0; i < children.length; i++) {
        if ((children[i].textContent || '').indexOf('ログアウト') !== -1) { anchor = children[i]; break; }
    }
    if (anchor) sidebar.insertBefore(btn, anchor);
    else sidebar.appendChild(btn);

    if (typeof window.initLucide === 'function') window.initLucide();
};

window.onAppLoaded(function() {
    window.injectUsageGuideButton();
});

(function initUsageGuidePatch() {
    function boot() { window.injectUsageGuideButton(); }
    if (document.readyState !== 'loading') { setTimeout(boot, 400); }
    else { document.addEventListener('DOMContentLoaded', function() { setTimeout(boot, 400); }); }
})();
