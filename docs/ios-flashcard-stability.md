# Flashcard rendering on iOS

Safari’s “a problem repeatedly occurred” screen means the page process failed;
it does not identify a JavaScript exception or prove one particular cause.
The native iPhone failure cannot be reproduced or ruled out by Linux WebKit.

The flip path previously kept two scrollable faces inside a rotating
`preserve-3d` subtree. Swipes cloned both faces and could overlap outgoing
ghosts, ripples and particles. Every answer also serialized the entire book
and refreshed hidden UI, despite already committing the individual answer.

On iOS, flips now reveal a single flat face with a short opacity animation.
Only overflowing text scrolls. Outgoing cards copy the visible face only;
old effects are removed before adding the next set. Desktop 3D flips remain.
Per-answer canonical records and resume checkpoints remain immediate local
writes. Full draft capture remains at session end; cloud saving remains at
activity end or sleep, as requested. Swipes no longer rebuild hidden views.

Validation: 2,000-word fixture with 100 flips/swipes on Chromium and WebKit
using an iPhone user agent; one visible face, bounded effects, no whole-book
capture during play, undo and end capture retained. Existing long-text,
settings, animation and loading/save recovery checks also run. Verify on an
actual iPhone PWA after deployment before calling the native crash resolved.
