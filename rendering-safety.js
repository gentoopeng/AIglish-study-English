// Apply before styles and app startup: iOS home-screen apps share WebKit's renderer.
// Keep learning, purchases and game state intact; reduce decorative GPU surfaces only.
(function () {
    'use strict';
    var appleTouch = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (appleTouch) document.documentElement.classList.add('ios-stable-rendering');
    // Safari's keyboard changes the visual viewport without necessarily changing
    // svh/dvh. Keep the active product/auth modal inside the visible area.
    window.fitNativeModal = function (dialog) {
        var viewport = window.visualViewport;
        var frame = null;
        function fit() {
            frame = null;
            if (!dialog.isConnected || !dialog.open) return;
            var height = viewport ? viewport.height : window.innerHeight;
            var active = document.activeElement;
            var typing = active && dialog.contains(active) &&
                active.matches('iframe,textarea,input:not([type=checkbox]):not([type=file])');
            dialog.classList.toggle('compact-native-modal', height < 600);
            dialog.style.maxHeight = Math.max(1, height - 24) + 'px';
            dialog.style.margin = '0 auto';
            dialog.style.bottom = 'auto';
            // No layout reads or scroll-offset feedback while the keyboard/IME
            // owns focus. Repositioning the focused field can trigger more scroll.
            dialog.style.top = (typing ? 12 : Math.max(12,
                (height - dialog.getBoundingClientRect().height) / 2)) + 'px';
        }
        function schedule() {
            if (frame === null) frame = requestAnimationFrame(fit);
        }
        function release() {
            window.removeEventListener('resize', schedule);
            if (frame !== null) cancelAnimationFrame(frame);
            dialog.removeEventListener('focusin', schedule);
            dialog.removeEventListener('focusout', schedule);
            if (viewport) {
                viewport.removeEventListener('resize', schedule);
            }
            dialog.removeEventListener('close', release);
        }
        window.addEventListener('resize', schedule);
        dialog.addEventListener('focusin', schedule);
        dialog.addEventListener('focusout', schedule);
        if (viewport) {
            viewport.addEventListener('resize', schedule);
        }
        dialog.addEventListener('close', release);
        fit();
        return release;
    };
})();
