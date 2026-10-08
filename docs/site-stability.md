# Mobile browser stability investigation (4.82)

Reported symptom: repeated automatic reloads ending in a browser “a problem repeatedly occurred” message. The actual affected device and browser version have not yet been provided; no Safari crash log is available. Renderer termination on that device has therefore not been reproduced or conclusively attributed.

A measurable rendering regression was found in the new night photograph: animating `background-position` on a full-screen photograph while multiple overlapping cards, fixed navigation and header applied backdrop blur. This incurred continual full-screen paint work. The photograph now moves with a transform on one bounded pseudo-element; mobile backdrop blur is removed. The photograph and slow movement remain. Background movement pauses while the page is hidden.

Chromium, viewport 390 × 844, device scale 3, guest home, same 12-second idle observation:

| Metric | Before | After |
| --- | ---: | ---: |
| Renderer process CPU seconds | 11.69 | 1.88 |
| Style recalculations | 741 | 371 |
| JS heap used, bytes | 4,528,712 | 4,572,000 |

These single-run measurements include startup and are evidence of reduced load, not proof of Safari crash resolution or a universal performance guarantee.

Additional changes: hidden party/battle update loops skip work, shop images decode lazily, and full backups capture vocabulary once instead of twice. Draft capture no longer serializes and parses freshly constructed master/progress objects again. No learning data is removed and save cadence is unchanged.

Validation: `node --test tests/*.test.cjs`, `node tests/site-stability.smoke.cjs`, and shop/profile/library/flashcard browser regressions. The stability smoke checks 200 tab changes over 40 seconds, browser errors/crashes, post-GC heap growth, one background instance and compositor animation configuration. Shop tests also verify one vocabulary capture per backup and purchase/equipment save/load.

## Follow-up: product management (4.92)

The user narrowed the symptom to opening product management, before choosing any photograph. The previous idle-home test did not cover this path adequately.

The authentication handler was rebuilding the entire hidden vocabulary list before opening administration. This unrelated work is removed from both password-overlay and prompt authentication paths. The admin-specific tests assert zero vocabulary renders on authentication.

Administration also previously rendered every product image and recreated the screen after a fetch, even if there were no catalogue changes. Management and shop views now show at most eight products per page. Previews are generated at 64 pixels and cached in a bounded 24-entry cache, rather than displaying full-size product images. Photo decoding is serialized, uses resized ImageBitmap decoding where supported, avoids a second original-file base64 copy, and releases bitmaps, object URLs and canvas buffers. Stale queued requests are skipped. New products save their small previews alongside the full artwork.

Repeated catalogue reads are coalesced for 60 seconds; changing admin tabs/pages does not refetch all artwork. Fetch completion only redraws the current, unchanged management session when the catalogue changed and no editor is open. Pending updates cannot recreate a screen the user left. Background movement pauses in administration.

`tests/shop-admin-stability.smoke.cjs` exercises 40 distinct 2048-pixel photographs, bounded pagination, 30 editor opens/closes, post-GC JS heap growth and one catalogue fetch. This is synthetic Chromium coverage, not reproduction of the affected browser's termination. At the time of the investigation a read-only query of the live product collection returned zero products, so large live catalogue images alone cannot be established as the cause of this user's report.

## Follow-up: password screen itself (5.02)

The user clarified that the crash occurs every time while the password screen is open, before successful authentication. The earlier management tests primarily passed through this screen quickly and did not model remaining in it.

The password overlay still contained an inline full-screen `backdrop-filter:blur(8px)` and a glowing game card. This overlay was missed by the prior mobile blur selectors. Opening it also immediately focused a 14-pixel password input, which can activate the mobile keyboard and automatic viewport zoom at the same time as the overlay appears. These are concrete rendering hazards; the actual Safari termination has not been reproduced.

The screen is now an opaque, static surface without backdrop filters or game effects. Background panels are hidden and animations pause while it is open. The input is 16 pixels and no longer receives automatic focus. Password input events do not mark learning data dirty, and pending background snapshots defer until the prompt closes; pending learning changes are retained and saving resumes afterward. Closing clears and blurs the password field. The visibility state class does not use an `admin-` prefix, avoiding false matches in legacy role detectors.

Coverage includes 31 password prompt opens, wrong-password/cancel paths, a 10-second dwell, simulated viewport shrink, no automatic focus, paused background movement, and deferred save/resume. Unit tests cover password events not scheduling snapshots. Safari/WebKit installation was attempted, but browser downloads were blocked with HTTP 403 “Domain forbidden”; these checks therefore ran in Chromium and cannot certify real-device Safari behavior.

## Authentication isolation (5.12)

The user reports continued termination while entering the password, so reducing overlay effects has not resolved their case. Authentication is now a standalone static document (`admin-access.html` / `admin-access.js`), reached with `location.replace` so the old application page is not retained as a history entry. It loads none of the main app scripts, Firebase, data collectors, DOM watchers, timers, animated backgrounds or catalogue images.

There are no native input or editable elements on that document. Password entry uses an on-screen keyboard with a masked output and optional physical-keyboard events. This removes the native secure-input/autofill/software-keyboard/viewport-resize path rather than making another rendering adjustment to it. Input is bounded to 64 characters. No password is persisted. Existing administrator passwords are checked in the isolated document as before; the app's existing client-side administrator gate has not been converted to server authentication.

A short-lived, owner-scoped, one-use session ticket returns the user to product management after application reload. Pending saves are recorded locally and rescheduled on return. Learning records and owned products are neither cleared nor reset. The standalone test checks incorrect entry repeatedly, on-screen entry, returning to the management UI, ticket consumption and retention of an actual vocabulary-progress key and owned-product key. Component management tests now exercise ticket restoration independently of standalone keyboard tests.

Actual real-device Safari termination remains unavailable for reproduction in this environment. This design removes both the application's active input-time workload and the native password-field path implicated by the user's latest report; passing Chromium tests does not establish that every possible browser/device crash is eliminated.

## iPhone home-screen app and continuous DOM feedback (5.22)

The user has now identified the affected client as an iPhone 16 running the Safari-installed home-screen app, at `https://gentoopeng.github.io/AIglish-study-English/index.html`. The latest report covers multiple operations since the home redesign, not just authentication. Main already contains the previous 5.12 fixes. The earlier authentication-focused hypothesis does not explain this broader report.

A deterministic bug was reproduced in `applyPartyUnifyPatch`: it observes `#ptyList` recursively, then on every notification deletes/recreates sorting controls, replaces stat markup and appends all cards. Those writes notify the same observer again after 40 ms. With one unchanged card, an isolated browser fixture recorded 250 child-list mutations over two seconds. After the fix, the unchanged fixture records zero mutations during the equivalent idle interval; changing enhancement level still updates the stats. The observer disconnects during its own writes, sorting/stats are idempotent, hidden party views do not render, and the newer catalogue retains ownership of its own controls. Older catalogue renderers no longer compete with the current `gm-active` renderer. Enhancement watchers only respond to catalogue/modal changes, rather than rescanning all app buttons whenever the study timer or home profile changes.

These are reproduced application bugs and unnecessary workload; the isolated feedback loop is **not proof** that it caused this particular device's process termination. The current main renderer can supersede that legacy list, and the pre-fix guest idle profile did not exhibit the same continuous loop.

`rendering-safety.js` runs before styling/application startup and selects a stable rendering mode on iPhone/iPad, including installed home-screen apps. The mode retains the night photograph as a single static background, stops decorative animation/transition effects, removes backdrop captures/filters, and releases permanent `will-change` promotion. Functional flashcard transforms remain enabled. A CSS cascade layer makes these important rules win over later injected legacy styles, including the previously missed full-screen battle background. Locked shop previews remain obscured with a static opaque cover. Other platforms retain the animated night photo. No learning, study, inventory, ownership, deletion, save or cloud storage data is reset or cleared.

Validation:

- All 68 data/model tests pass, including preservation after crashes, stale loads, deletion races and purchase restore.
- `ios-rendering-stability.smoke.cjs` reproduces the original feedback condition, checks that changed stats still render and hidden cards stay idle, then exercises the iOS/PWA feature branch with owned inventory, 144 tab changes, six profile saves and reload. It checks retained learning/owned-product keys, scoped enhancement/modal behavior, bounded post-GC heap growth and no visible animation/filter/backdrop surfaces.
- Standard mobile rendering: 200 tab changes over 40 seconds, no renderer/page errors and 471,784 bytes of post-GC heap growth in this run.
- Product administration: 40 synthetic 2048-pixel photo products, 30 editor opens, pagination, 64-pixel thumbnails, one catalogue read and no renderer/page errors; approximately 1 MB post-GC heap growth in both ordinary and iOS-feature-branch runs (`TEST_IOS=1`).
- Standalone administrator authentication, catalogue creation/purchase/cloud restore, profile photo/settings persistence and flashcard navigation regressions pass.

The iOS user agent and `navigator.standalone` are emulated in Chromium; this is not a Safari-engine or physical-device test. WebKit installation and access to the live Pages URL remain blocked by HTTP 403 domain restrictions in this environment. Real-device termination remains unverified. Avoid reporting these tests as a guarantee that the user's crash is resolved. GitHub API access is also forbidden; the feature branch can be pushed, but opening the review uses the compare URL when PR creation is unavailable.

## Native password keyboard and responsive product editing (5.32)

The user requests the ordinary device keyboard, no login-page transition after authentication, feedback when product saving appears to freeze, and a compact editor with a readable selling checkbox. This revision supersedes the custom keyboard / whole-document navigation described under 5.12.

Authentication still runs in the static `admin-access.html` document, now with a native 16-pixel password input. The main application embeds it in a small opaque modal iframe rather than replacing the page. Completion/cancellation uses same-origin messages checked against the iframe's window and the pending nonce; the existing owner-scoped, one-use ticket is then validated by the shop. Application memory, login state and in-progress learning remain in place. No restart/bootstrap/cloud reload or login screen is involved. A valid ten-minute admin session opens management directly. The iframe URL includes the application version to invalidate cached authentication markup. Background effects pause and pending learning snapshots resume on closing the prompt.

Product submission previously awaited Firestore write and verification without a progress label or wait limit, leaving a disabled button indefinitely when a connection stalled. It now shows saving/verification states immediately. A 12-second deadline exposes a confirmation action while retaining the pending request and submitted fields; confirming waits on the same request rather than submitting another write. A late server-verified success updates the catalogue and closes the current editor. Offline and rejected operations retain input and report the failure. Verification uses `getDocFromServer` when the actual Firebase SDK is present; synthetic test adapters use their mocked read. No cached-only read is used to declare a live product successfully saved. Existing catalogue entries retain their positions, and new saves return to the page containing the saved item.

Photos retain transparent PNG format for frames; backgrounds use JPEG. Artwork exceeding the existing 600,000-character storage limit is resized before submission instead of silently getting stuck behind an invalid save. Product form changes do not trigger unrelated personal-learning backups.

Modals follow Safari VisualViewport resize/scroll events so native keyboard visibility moves the form into the visible area; listeners are released on close. The editor has a compact photo row, two-column kind/price fields, 16-pixel native inputs, an explicitly sized 18-pixel checkbox and a nonwrapping selling label. Management shows four products per page. Tested sizes are 393 × 852, 360 × 640 and 393 × 430 (keyboard-height simulation); the editor has no internal overflow, and the ordinary mobile management page stays above bottom navigation.

Validation: 69 model/data tests; native password typing, wrong/cancel paths, message-source checks, no main-document navigation, retained runtime/learning/purchases; stalled write/deadline/single-write confirmation/late success; permission denial, offline input retention and retry; bounded large PNG import; price/image/publication changes and purchase/cloud restore; 40 photo products and 30 edit-dialog opens; profile and flashcard regressions. Browser coverage uses Chromium with iOS feature detection emulation, not physical-device Safari. No production cloud data was written by these tests.

## Save-time quiz and lower input/rendering workload (5.42)

The latest report is an unresponsive product-save button and renderer termination while typing product names; lower artwork quality is acceptable. A deterministic error was found during retry testing: `showPenguinLoading()` called `__updatePenguinText()` when an overlay was already visible, but that function had no definition anywhere in the application. Consecutive saves could therefore throw before submission. The missing updater now changes the existing label with `textContent`, and loader setup runs inside the submission error handler.

Product saving immediately shows the existing configured loading quiz in a separate native top-layer dialog, above the product editor. The first paint happens before artwork conversion and cloud work. Returning to editing or dismissing with Escape closes the quiz view while the authorized save continues; the existing status/deadline handles the result. Offline errors, denied writes, verified success and the 12-second deadline release this dialog. Confirmation waits on the same operation, including artwork conversion, rather than issuing a second write. Quiz answers use the existing canonical progress-saving path. The shared loading counter is released once, never forcibly reset.

The previous VisualViewport scroll handler measured and repositioned the focused dialog on every keyboard scroll notification. It now ignores scroll notifications, coalesces resize notifications once per animation frame and fixes the modal at a 12-pixel top inset while an input/iframe owns focus, with no geometry reads in that path. The editor hides the underlying application surfaces behind an opaque backdrop. The legacy whole-body contrast scan skips product editing. These remove avoidable input-time work; they do not establish a reproduced real-device Safari crash root cause.

Imported and edited artwork is resized before saving: transparent frame PNGs to 240 pixels (160 if still larger than 175,000 characters), background JPEGs to 400 pixels at quality 0.45, and previews to 48 pixels. Existing unsaved catalogue entries and purchased items are not rewritten or reset. Artwork is processed serially and decoded resources are released as before.

Validation includes 500 synthetic viewport-scroll/composition events and 100 resize events while focused, with zero dialog geometry reads; a visible save-time quiz and retained answer after timeout; one-write confirmation; denied/offline retries; smaller PNG import; late responses not replacing a newer editor; authentication without login/navigation; purchase/ownership restoration; bounded 40-photo catalogue editing; mobile layout; profile and flashcard regressions, plus 69 model/data tests. Browser checks use Chromium with iOS feature detection, not the actual Safari engine. Tests use mocked cloud writes and do not alter production data.
