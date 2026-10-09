// Apply before styles and app startup: iOS home-screen apps share WebKit's renderer.
// Keep learning, purchases and game state intact; reduce decorative GPU surfaces only.
(function () {
    'use strict';
    var appleTouch = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (appleTouch) document.documentElement.classList.add('ios-stable-rendering');
})();
