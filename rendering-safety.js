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
        function fit() {
            if (!dialog.isConnected || !dialog.open) return;
            var height = viewport ? viewport.height : window.innerHeight;
            dialog.classList.toggle('compact-native-modal', height < 600);
            dialog.style.maxHeight = Math.max(1, height - 24) + 'px';
            dialog.style.margin = '0 auto';
            dialog.style.bottom = 'auto';
            dialog.style.top = ((viewport ? viewport.offsetTop : 0) +
                Math.max(12, (height - dialog.getBoundingClientRect().height) / 2)) + 'px';
        }
        function release() {
            window.removeEventListener('resize', fit);
            if (viewport) {
                viewport.removeEventListener('resize', fit);
                viewport.removeEventListener('scroll', fit);
            }
            dialog.removeEventListener('close', release);
        }
        window.addEventListener('resize', fit);
        if (viewport) {
            viewport.addEventListener('resize', fit);
            viewport.addEventListener('scroll', fit);
        }
        dialog.addEventListener('close', release);
        fit();
        return release;
    };
})();
