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

## Inactive screen work and large vocabulary books (5.52)

The user reports termination across vocabulary/ranking screens and device heat. Instrumented idle runs reproduced permanent game/UI polling on unrelated screens: the enemy-ring interval ran 50 times in five seconds, the battle optimizer 17 times, the party/modal watchdogs 20 times each, and the legacy bridge 42 times. The whole-body contrast TreeWalker also ran repeatedly. This workload was present even with no active battle and no changing inventory.

`view-work.js` owns presentation intervals by visible tab. Permanent polls in multi/gacha/addon stop their native timers outside party/game (gacha uses party only), on document hiding, and during password/product editing. They resume once on return. The header keeps one slower visible-page poll. Transient restoration watchers, save-button binding, learning/count synchronization and autosaves retain their existing paths. The bridge polls once per second, the login recovery observer is confined to its gate, the obsolete full-body contrast scan is removed, and game-effect observers skip unrelated views before inspecting added nodes.

A 2,000-word book formerly mounted all 2,000 full cards, including hidden editing fields. The list now mounts 40 cards per page (98% fewer cards in this fixture) using a document fragment. Search/range/understanding filtering still examines the complete book. Rating a word retains the current page; changing book/filter resets it. The full in-memory vocabulary and canonical learning storage remain intact.

Ranking avatars and frame artwork use serially generated 64-pixel PNG previews with a bounded 12-entry shared cache. Podium shape comparisons retain references in memory rather than serializing full base64 photos into repeated DOM attributes. Study displays only write changed text; unchanged ledgers skip redundant serialization/local storage writes. Study timing still samples every 500 ms and retains its local persistence/visibility/pagehide and cloud-save behavior. Weekly chart refresh is confined to the study screen and throttled during live counting; explicit edits/week selection still redraw immediately.

Validation: 69 model/data tests; a 2,000-word mobile fixture verifies the 40-card bound, navigation, page-local ratings and full-book search; inactive timers stop/resume, hidden screens suspend presentation work, idle study DOM has zero mutations, and podium photos are 64 pixels. Existing daily/total ranking, study accuracy/pause/calendar edit/reload/multiple-tab ownership, vocabulary/POS/deletion, flashcard, product saving, and 144-tab-change/six-profile-save preservation checks passed. Tests use mocked external services. Real iPhone temperature and WebKit renderer termination cannot be verified with Chromium; these results demonstrate removal of measured workload, not a guarantee against every device crash. No learning, study-time, purchase or catalogue records are reset by this revision.

## Isolated product UI and functional flashcard motion (5.62)

The user still reports termination on entering product management. The product list and editor now live in `product-admin.html`, a minimal same-origin iframe document with inline styles, no scripts, no external fonts, no SDKs and no application/game DOM observers. Parent-owned event handlers retain the existing authentication checks, confirmed cloud writes, purchase state and save-time quiz. This isolates the UI and its input mutations; it does not unload the parent application or create a separate guaranteed WebKit process. Authentication retains the native password field and returns directly without page navigation or a login screen.

Management mounts four text-only product rows per page. Opening existing products does not decode their artwork, including thumbnails. Changing only a name, price or selling flag preserves the image bytes rather than recompressing them. Explicit photo imports still run the bounded serial compression path and show only a small generated preview. Queued home-preview decoding stops during management; unrelated presentation polling stays suspended and the application surfaces are hidden behind an opaque native dialog. Closing releases the iframe and its viewport listeners and resumes pending personal saves. Keyboard resize handling only coalesces viewport-height changes; it never measures the focused editor or handles viewport scroll events. A load label, return button and bounded load error avoid leaving an empty locked screen if the static document cannot load.

Two independent flashcard regressions were reproduced. The iOS stability CSS suppressed both decoration and action feedback. Narrow exceptions now restore float, flip, swipe departure and short disappearance effects, while the photographic background remains static, dragging does not run the float effect, and reduced-motion preferences remain respected. A legacy battle MutationObserver also treated flashcard disappearance particles as unwanted battle explosions and deleted them immediately. That cleanup now runs only during an actually visible multiplayer battle and explicitly excludes the flashcard stage/effects.

Validation: native authentication and failed product-document loading recover without navigating, losing runtime state or losing stored learning/purchases; product saving retains denied/offline inputs, confirms a single pending write, displays the loading quiz, compresses explicit uploads and preserves existing photo bytes on metadata edits; catalogue purchase/cloud restore passes. The iOS-feature stress fixture opens 40 large-photo products and 30 editors with no artwork decoded, no page/renderer errors, bounded heap growth and no leaked viewport listeners. The flashcard fixture verifies interpolated flip motion, swipe transitions, live disappearance particles, effect removal and reduced-motion behavior. Existing 69 data/model tests and large-vocabulary/inactive-polling regressions also pass.

These browser tests run in Chromium, including emulated iOS feature detection, with mocked cloud services. Physical iPhone Safari termination remains unverified; this revision removes measured work and isolates the reported UI without claiming that a device crash has been reproduced or universally eliminated. No learning, study, inventory, purchase or existing catalogue data is reset.

## Remove the home/shop runtime; sidebar identity only (5.72)

The user explicitly requests deleting the home contents and their related code instead of another shop-crash mitigation. The home tab and its startup routes are removed; login and startup now select vocabulary. Home announcements, hero/profile renderers, shop/catalogue/purchases UI, product administration/authentication documents, appearance settings, decorative starfield creation and their styles/listeners are deleted, including the legacy home study-display injection loop. The old shop and appearance scripts are no longer shipped or referenced. Ranking avatars retain ordinary photos, bounded thumbnail generation and multiline names, with no purchased-frame or name-color application. The shared background is a single static night photograph. Flashcard action animation fixes remain.

`profile.js` provides one inline hamburger-menu form with name and photo fields only. Explicit icon imports use the bounded serial 240-pixel JPEG path and release decoded resources. Identity stores locally before displaying success and retries cloud transactions after failures; transaction writes merge into the existing user document. Newer local settings survive older cloud/backup records, and account checks prevent delayed work from updating another account. The vocabulary loading quiz and pin controls move to `loading-quiz.js`, independently of the deleted home UI.

Deleting a feature does not delete stored learning, study, inventory or historical purchase/settings records. Existing appearance values remain archived in backup storage but are neither presented nor rendered. The backup sanitizer retains newer identity records and unions archived ownership IDs; full saves retain their ordinary learning and inventory paths. No production data is reset or cloud documents deleted.

Validation: 64 current model/data tests pass after replacing tests for the removed shop with identity preservation tests. Browser checks cover the absent home/shop/admin documents and requests, startup on vocabulary, sidebar name/photo save and reload, icon compression, older-backup protection, offline profile retry, retained learning/purchases and independent loading quizzes. Existing people, three-metric ranking and retry/profile-detail sync, public vocabulary, workbooks, study timing/calendar, large-vocabulary/polling suspension, iOS rendering/tab-change/identity-save/reload and flashcard motion/settings checks pass. Browser tests use Chromium with mocked cloud services and emulated iOS feature detection; real iPhone Safari termination is not verified.

## Startup script warnings and diagnosable errors (5.82)

The user reports an intermittent script-error warning on opening the application and cannot provide its exact text. A browser-executed external classic script was still fetched from `unpkg.com/lucide@latest`, without a version pin or same-origin delivery. Browser errors from classic cross-origin code can be reduced to the unhelpful `Script error.` message. This is an identified dependency/diagnostic risk, not a reproduced cause of the user's warning.

The ISC-licensed Lucide 0.468.0 UMD bundle and license are now shipped under `vendor/lucide`; the browser no longer requests unpkg or follows a changing latest build. All statically referenced icon names exist in this version. Actual icon creation now runs in the network-blocked smoke fixtures, where earlier tests aborted the external script and consequently skipped that runtime path.

Error collection moves out of late-loaded multiplayer code into `runtime-errors.js`, before application scripts. It captures real script errors with source filename/line and promise rejection locations from browser stacks. A single visible warning surface shows these details. The last eight records remain in memory via `AppErrors.snapshot()`; query parameters and stacks are not retained or sent to a service, and no application/learning records are modified. Errors remain reported, rather than being suppressed.

Validation: startup with a saved session, three reloads and tab navigation work with external networking blocked and the real local icon library active; saved learning records remain unchanged. A real same-origin script that throws before the main app loads produces a warning with its original file and line. A real rejected promise retains its script location. Synthetic repeated errors keep eight records, strip source query parameters and create no duplicate toast/listeners. Sidebar photo/name persistence, flashcard settings/motion, vocabulary/POS/deletion and current 64 model/data tests pass; mobile-workload and iOS rendering/tab/profile preservation regressions also pass. Tests use Chromium with mocked external services, not physical Safari. The user's specific warning remains unreproduced; this revision removes the external unpinned script path and makes a remaining failure attributable.

## Reproduced local-storage quota failure and durable large-value storage (5.92)

The screenshot provides the exact failure: `The quota has been exceeded. (study-time.js:130)`. That line wrote the timer's four display/statistics keys directly to localStorage without handling an exhausted quota. The canonical ledger had its own catch, but this subsequent throw interrupted the interval before the display refreshed. Book masters, duplicate caches, artwork and whole saves also occupied the same small origin-local quota. This identifies a real storage failure; it does not establish that every reported WebKit process termination has the same cause.

`app-storage.js` retains the application's synchronous storage read/key-enumeration interface while moving large values (at least 65,536 characters) and writes that exceed native quota into IndexedDB. Startup first restores these values, then migrates large legacy records in the application's own namespaces. Native copies are removed only after a successful durable transaction, and changed native copies are not removed. No record is pruned; retired catalogue values and old snapshots remain retrievable. Records belonging to other apps on the shared GitHub Pages origin are not migrated. Smaller normal writes stay native; failed native writes are coalesced in a bounded-by-keys pending map and queued to IndexedDB at the end of the current task. On persistence failure the pending data remains in memory, failure is reported once, and retries back off; this is not misrepresented as durable success.

`app-loader.js` restores the storage view before any application module reads startup state, then loads preloaded scripts in their original order. Core initialization waits for every module, avoiding the previous assumption that all deferred scripts precede startup. If storage restoration fails, startup stops with a visible message rather than initializing empty learning records. Buttons remain disabled until the modules are available. Full-save and profile success labels wait for `AppStorage.flush()` to complete. Pagehide/visibility changes also flush pending requests. IndexedDB-backed changes notify other current-version tabs through BroadcastChannel. Fallback study-tab leases use native coordination only; a failed lease cannot grant both tabs ownership. Timer display writes have a catch and do not abort the interval.

Validation uses real browser storage filled to its native quota, with the screenshot's timer-key write failing as `QuotaExceededError` before the adapter loads. After migration a 2,000-word book opens with 40 mounted cards; a new understanding record is saved; forcing continuing quota failures does not stop the live study timer; reload retains understanding, workbook, historical purchase and saved-snapshot values. Latest-write/deletion ordering and cross-tab updates pass. Aborted migration preserves the original native record and blocks unsafe startup. The integrated full-save reports success only after a durable transaction, rejects an aborted write and retains pending data for retry. Another app's native record remains unchanged.

Existing 64 model/data tests, normal startup/error diagnostics, sidebar identity, library/public sharing/POS/deletion, workbooks, shared notes, study accuracy/calendar/multiple-tab ownership, ranking retries, flashcard motion/settings, large-book workload and iOS-feature tab/profile/reload checks pass. External services are mocked; no production cloud records are reset or deleted. Tests run in Chromium, including the iOS feature branch; physical-device Safari process termination remains unverified. IndexedDB uses browser-managed device storage and cannot guarantee persistence when that storage itself is unavailable or the user clears site data.

### 6.02: interrupted rating writes and storage recovery

The 5.92 adapter could read an older IndexedDB value ahead of a newer surviving native value. A browser regression now reproduces this with quota-triggered migration followed by an older app/tab writing native storage: the old adapter returns `bad` and drops the second rated word, while the corrected adapter returns both saved `ok` ratings after reload. Startup reconciles surviving native records before modules read them.

Understanding snapshots retain their synchronous native working copy when capacity allows and also commit an IndexedDB mirror. Native quota fallback queues a progress value and its paired `__ts` together, so a newer edit date cannot precede its overflow data. An aborted mirror transaction leaves the native rating available on restart. Confirmed IndexedDB broadcasts update other tabs' native rating copies; native removal during migration is not treated as a logical deletion. Explicit rating resets remain supported.

Closing flashcards and capturing full drafts preserve canonical saved ratings instead of overwriting them from an older displayed list. Full backups no longer include a second `vocabList` copy alongside `vocabMaster` and `vocabProgress`. Whole-account autosaves coalesce for 15 seconds; local ratings are still written per answer and the IndexedDB queue is explicitly flushed every fifth flashcard swipe. This reduces repeated large serialization without postponing the ordinary synchronous rating write.

Validation: 66 model tests; real Chromium quota/abort/reload/two-tab regressions, startup diagnostics, 2,000-word mobile workload, study calendar/pause/restart, flash animation and library management. Existing saved records, purchases and workbooks are not reset. These checks do not prove that physical iPhone Safari/WebKit renderer termination has ceased, and cannot establish whether records already overwritten on the user's device can be recovered.

### 6.12: block saves during hydration and protect answers from full-save restore

An actual 6.02 browser regression reproduces rated words becoming `none` after startup: a full save created at 2,000 ms contains default/empty progress, while canonical answers were last edited at 1,000 ms. Restoring by the newer full-save timestamp overwrites the answers. The same baseline fails in Chromium and WebKit. This confirms a separate loss path that the 6.02 storage quota tests did not cover.

Startup now awaits the selected textbook before running post-load hooks, invokes pre-load hooks once, and gates autosaves, full saves, draft capture and rating updates during hydration. Book loads use request sequencing and account/book checks before applying a loaded list. A save that cannot proceed does not clear its pending autosave marker or report success.

`learning-data.js` separates explicit answers from snapshot restoration. Explicit answers carry per-word edit timestamps; a legacy full save's newer backup date cannot downgrade existing answers. Explicit user resets remain supported. A separate recovery ledger is updated from actual answers and safely merged recovered ratings, and survives an empty/deleted primary snapshot. Startup also checks canonical understanding archived inside full saves, instead of ignoring that potential recovery source. Empty/default cached drafts now allow a cloud progress read; a newer but empty local timestamp cannot exclude an older nonempty cloud record. Flashcards and loading quizzes update only answered words, retaining words outside the displayed list. Permanent book deletion removes its recovery record too.

Compatibility tradeoff: legacy remote records without per-word edit timestamps can fill missing/default local words but cannot replace established local answers; other devices should use 6.12 for explicit timestamped changes. No learning data reset or browser-storage wipe is performed. Recovery requires some remaining valid record on the device or in an accessible backup; this environment cannot establish whether a particular user's lost records are still available.

Validation: 75 model tests passed. The new empty-save/load-time/repeated-reload/recovery regression passed in both actual Chromium and Playwright WebKit 26.5; the 6.02 baseline failed in both. WebKit quota, library management and study-time tests passed. Chromium storage/recovery/startup, library, flashcards and mobile-workload checks passed. Two additional Chromium-oriented tests did not pass unchanged in WebKit: the flip transform stayed identity in the headless animation check, and a 180 ms presentation-interval assertion failed. These results are not treated as passes or proof of full Safari/iPhone stability. Physical iPhone/PWA testing and production account recovery remain unverified.

### 6.22: responsive ranking loads and quiz feedback

Leaderboard reads no longer wait for the player's cloud synchronization transaction. Production Firestore queries order by document ID and request 50 users per page. Conversion yields to the event loop every eight records and between pages. Cached rows keep only names/counts and podium-candidate photos, dropping obsolete profile appearance payloads and noncandidate photos. This reduces peak snapshot size, retained image data and long uninterrupted parsing work. It does not create a server summary collection or change learning counter semantics.

First loads and manual refreshes use the existing delayed loading quiz. Fast reads complete before its 280 ms display delay; normal background refreshes leave a previously loaded podium visible. Reads have a 15-second deadline, restore the refresh button and remove this request's loader reference on failure, and ignore late results. Navigation releases the loader reference without disturbing other loading operations. Temporary tab listeners are removed on completion. Details open immediately from cached values and refresh in place, with an independent five-second deadline.

Quiz finalization now commits each answered word explicitly; passing a null word number would preserve canonical ratings but omit new quiz answers after 6.12. Quiz source responses also check that their overlay is still current, and answers are not applied to a different account after an identity change.

Validation: 75 model tests; ranking responsiveness/quiz tests in Chromium and actual Playwright WebKit 26.5 with a blocked synchronization transaction, 120 users in three pages, event-loop turns, deferred quiz answers, immediate detail display, stable background refresh, timeout/late response handling and listener cleanup. Existing ranking synchronization, three-metric layout, flashcard settings and empty-save understanding regression checks passed; the understanding regression also passed in WebKit. Tests mock Firestore and do not modify production accounts. Physical iPhone/PWA memory-pressure crashes and production network timings remain unverified.

### 6.32: static photo background in the hamburger menu

The sidebar offers the existing background or an imported photograph, plus a horizontal focus slider for landscape images on portrait phones. One fixed `cover` layer preserves aspect ratio without animation, transforms or filters. Body isolation prevents its negative-z-index layer from disappearing behind the body's solid fill. Imported photos reuse the serialized profile image pipeline, producing a JPEG with its longest side at most 1,280 pixels at 0.65 quality. Input files over 12 MiB and output data URLs over 1,000,000 characters are rejected.

Selection, compressed photo and focus position use a per-account `aiglish_app_background_` record. Save confirmation waits for `AppStorage.flush()`; full backups already include this namespace, and restore now retains newer local background settings. Rapid toggles cannot apply a stale UI selection when persistence completes out of order. The background code does not write learning records. The conversation's classroom photograph was visible but its source file was unavailable in the workspace; it is not bundled as a preset. Users can select that photo from their device using the new menu.

Validation: 75 model/data tests passed. The new background smoke test passed in Chromium and actual Playwright WebKit 26.5: landscape compression/aspect ratio, static cover positioning, repeated and out-of-order toggles, reload persistence, account isolation, retained understanding, no horizontal overflow and no runtime errors. Closed-menu mobile screenshots were inspected. Existing sidebar identity, understanding boot/save/recovery, ranking responsiveness and flashcard settings checks passed in Chromium. External services are mocked; physical iPhone/PWA behavior and the unavailable original classroom file are not directly verified.

### 6.42: bounded directory reads, PWA restart fallback and consistent surfaces

Two remaining user-list paths fetched the whole Firestore `users` collection at once: today's study podium and the people directory. The directory retained complete documents, including obsolete profile appearance payloads, and decoded every listed avatar. This is a concrete source of peak snapshot memory and long-lived unused data; it does not prove the cause of a particular physical iPhone renderer termination. `UserDirectory.scan` now reads ten documents per page, yields after every document, serializes the study/directory scans, checks account/tab/visibility changes, and bounds network reads with a 15-second deadline. The separate total-ranking reader also reduces its pages from 50 to ten. Firestore query helpers are available in production; the unpaged compatibility path is used only when those helpers are unavailable, including older mocks.

Today's podium retains only three candidates with their ledgers/learning counter metadata, and caches successful reads for one minute; explicit refresh bypasses that cache. The directory retains active users and explicit friends with compact names/activity/goals. Current compressed avatars under 48,000 characters remain visible; oversized historical photos use initials in the list and are fetched for a requested detail instead. Detail documents are no longer written back into the directory's long-lived cache. No cloud/user record, learning counter or saved rating is deleted or reset.

The 6.32 body-wide isolation stacking context is removed. The single fixed photo now sits at z-index zero beneath the content container, with one constant dark overlay. Common cards across tabs use the same 0.93-opacity surface, and conflicting inline important backgrounds are removed. A priority cascade layer also covers late styles. Understanding gradients on `.word-row-container` remain unchanged. Background position is committed on slider change rather than repainting the complete photo on every input event.

The background import/focus controls move to a lazily mounted native dialog in the administrator menu. The existing application's password gate and native keyboard are reused; authentication does not navigate to login. The dialog's controls are removed from the document when closed, and upload handlers require the same account's current open administrator session. This is the existing client-side UI password model, not new server role authorization. Normal sidebar controls still switch previously configured backgrounds. Password/admin draft input no longer marks unrelated whole-account backups dirty; a successful setting change still saves and queues its backup.

For iOS/PWA, a small foreground heartbeat identifies a recent unclean restart. That next startup temporarily suppresses photo decoding/rendering through CSS; saved photos and all learning remain untouched. The menu explains the fallback and an explicit background selection can re-enable it. Ordinary visibility changes/pagehide mark a clean suspension. The diagnostic marker is excluded from whole-account backups. This is a conservative fallback that can also activate after a foreground task kill; it cannot detect every platform crash or guarantee against operating-system memory pressure.

Validation: 75 model/data tests passed. Chromium and actual Playwright WebKit 26.5 passed the DPR3 iOS/PWA regression with 65 profiles containing large unused appearance/statistics values, bounded ten-row queries, event-loop turns, correct daily/total podiums and recent-user lists, a 2,000-word paged book, distinct understanding gradients, consistent card surfaces, repeated navigation and simulated unclean-restart photo suppression without losing saved photos/ratings. Both engines passed the administrator password/import/save/reload background test and ten-row ranking/quiz test. Chromium additionally passed understanding boot/save/recovery, study-time/calendar/multiple-tab ownership, people details, ranking sync/details, sidebar identity, flashcard settings and the mobile-workload test. A separate 40-second/200-tab-switch workload reported 318,928 bytes of retained JS heap growth and 0.5 CPU seconds, without renderer failure. External services are mocked; physical iPhone16 installed-PWA crashes and real production snapshot/network costs remain unverified.

### 6.52: retire login popups and reduce cold-start work

Removed all three login-bonus implementations (the gacha implementation and two late patches), their polling/delayed modal paths, bonus configuration and obsolete bonus-dot styles. The first-login three-step tutorial, its generated styles and its separate IndexedDB flag/polling/restoration subsystem are also removed. Old completion/login-history keys remain ordinary preserved data; they are no longer required to suppress a popup. Existing gold, tickets, learning and game inventory are not reset, and login no longer grants new bonus rewards.

Both legacy definitions of `preloadAllTextbooksAndVocab` now synchronize the book index only. Unopened shared book masters are no longer downloaded, parsed and retained at every saved-session startup. Existing selected-book/cloud/local loaders remain responsible for the requested book. After successful full-save restoration, the global transient `__pendingGameSaveMemory` reference is cleared. Persistent backups, canonical ratings and the working drafts stay intact; on a restore failure the transient reference remains available.

Gacha content is built only after opening the party tab; the closed pool does not populate every character's artwork, and closing it or leaving the party tab removes its artwork nodes. Rebuilding its root now installs the delegated click handler once per page, preventing repeated handlers from toggling a pool twice or executing duplicate actions. iOS skips the three external font injection paths and uses existing device fallback fonts; the unconditional CSS font import is removed. Desktop font loading still uses the existing bundled-family stylesheet. This changes iOS typography to the system fallbacks, retaining Japanese/Latin text and existing understanding colors.

The hidden `introVideo` element and unused base video playback path are removed. The actual game runtime already overrides intro playback to start battles directly, so the video was unused while still presenting a browser resource-loading path. WebKit requested it even with the intermediate `preload="none"` mitigation; removing the element avoids that request. Compatibility entry points still start the battle. The old video file remains archived in the repository.

Validation: 75 model/data tests passed. The new Chromium and actual Playwright WebKit 26.5 iOS/PWA startup regression deliberately does not seed a tutorial-completion or bonus-suppression flag. It verifies no bonus/tutorial DOM or flag database/watchers, unchanged 321 gold/4 character tickets/5 item tickets, retained saved understanding, released transient backup, index-only sync with zero master fetches, zero iOS font/video requests, game/pool operation after rebuilding without duplicate toggles, battle-start compatibility, and three reloads preserving the data. Understanding boot/save/recovery checks passed in both engines. Chromium iOS rendering/polling/inventory/144-tab-change regression and flashcard settings passed; the existing mobile-workload and 40-second stability checks were also run. Physical iPhone16/PWA process termination and production network behavior remain unverified; these are concrete removed resource/polling/retention paths, not evidence that every reported physical crash has the same cause.

### 6.62: header background picker with portrait previews

Background selection moves from the hamburger menu to a small picture icon immediately left of the study clock. It opens a centered native dialog with horizontal scroll snapping, phone-viewport-ratio photo crops, selected borders and an explicit close button. Existing common overlay/card contrast and understanding gradients are unchanged. Both picker and admin dialogs mount only on demand; closing the picker removes all thumbnail nodes. No polling, automatic slideshow, backdrop blur or continuous animation is added.

The existing password-gated administrator menu registers named photographs, adjusts horizontal focus and removes artwork. The gate remains the application's existing client-side UI gate, not new server authorization. The gallery extends the existing per-account background feature; it is not a new globally published photo catalogue. Imported images remain bounded to 1,280 pixels/JPEG 0.65; previews are generated from the compressed result at 640 pixels/JPEG 0.55, with lazy decoding. Registration is limited to 12 photos and four million combined data-URL characters. The old single-photo record is read without startup writes and migrates after an explicit selection or edit.

Image catalogue data and small selection preferences are separate `aiglish_app_background_` records, retaining the existing IndexedDB-backed persistence/full-backup namespace and newer-local-record protection on restore. Switching does not serialize/rewrite the image catalogue. Reopening menus reuses normalized settings when stored records have not changed. Success waits for durable flush; stale completion messages cannot supersede newer selections. No understanding, inventory, balance or game record is written by this module.

Validation: 75 model/data tests; Chromium and actual Playwright WebKit 26.5 gallery smoke checks cover two-photo registration, incorrect/correct password paths, bounded image dimensions, portrait crop ratio, horizontal overflow confined to the slider, header controls without overlap at 393/320px, small preference writes, focus adjustment, rapid out-of-order save completion, reload/account isolation, legacy migration, background deletion and released preview nodes. Existing empty-save understanding/recovery and DPR3 iOS/PWA directory/contrast/understanding-gradient regressions pass in both engines. Chromium flashcard settings/version checks pass. External services are mocked; physical iPhone16/PWA behavior and production cloud persistence remain unverified.

### 6.72: explicit registration, bounded photo resources and startup-write ordering

Removed the photograph name field and gallery captions. Administrators choose a file and explicitly press **登録する**. Merely choosing a file does not decode or save it. During processing the button reads **登録中…** and disables duplicate clicks; successful IndexedDB completion reports the registered photo count. Failed confirmation can be retried without creating duplicate entries, and a cancelled upload cannot update a subsequently reopened administrator dialog. Registration adds a photo without repainting the active page background behind the native editor. The picture icon increases from 19px to 24px, retaining non-overlapping controls at 320/393px.

The prior `loading="lazy"` gallery did not bound decoding to visible photos: a controlled 12-photo gallery on a 393×852 viewport decoded 10/13 images in Chromium and 8/13 in WebKit after one second, including the default full-resolution PNG. The picker now assigns sources to at most three visible cards, clears offscreen sources, and revokes photo object URLs on removal/close. The active background also uses one revocable object URL instead of accumulating distinct base64 image URL sources; it releases that URL on switches and page suspension and restores the selected photo on foreground return. Background selection and stored JPEG data remain separate. Newly registered photos are bounded to 960px/JPEG 0.6, with 320px/JPEG 0.5 previews; previously saved photos remain intact and missing legacy previews are generated on demand. The same older-gallery fixture now decodes only three images in both engines. This is evidence of a removed resource path, not direct proof of why a particular physical iPhone process terminated.

Derived assets replace the default background PNG and the two small persistent header badge PNGs at their rendering paths. The default 2,013,396-byte PNG becomes a 61,398-byte WebP with a separate 4,210-byte preview; the header badge derivatives total 6,986 bytes. Original assets remain in the repository. Photo import now checks dimensions from at most 512 KiB of headers before invoking a browser decoder. JPEG, PNG, WebP, GIF and HEIC/AVIF `ispe` properties are inspected; unknown headers and photos above 13 million pixels or an 8,192px side are rejected with actionable feedback. A small compressed file can still expand to hundreds of megabytes, so a file-size check alone was insufficient. Profile icon import uses the same serialized preflight/decoder pipeline.

Full automatic backups defer while a native dialog is open, during five seconds after focusing/typing in a text field, and while the page is hidden. An idle focused field cannot defer backups indefinitely. Canonical understanding writes and `AppStorage` durability on page hide remain active. The existing pending-backup marker is retained; closing/blurring the editor or returning to the foreground schedules a retry. Opening the save panel reads its small metadata first and avoids parsing the complete backup just to display a date. A detected unclean-restart recovery session continues with a solid background across clean reloads until an explicit background choice; it does not overwrite the stored selection, photos or learning records.

The real native-quota regression exposed an additional startup race: an early rendering diagnostic overflow scheduled an IndexedDB write before the database opened, producing a false storage failure. Scheduled writes now wait for opening, explicit early `flush()` waits for hydration, and pending early values are excluded from the older-native-value migration. Dedicated real-browser tests seed conflicting old native/IndexedDB understanding and timestamps, write newer overflowing values immediately after loading the storage module, and verify both durability and reload preservation without false errors. Failed opening/migration still blocks application startup and preserves the original native data.

Validation: 85 model/data tests. Chromium and actual Playwright WebKit 26.5 pass the gallery resource workload at DPR3: explicit registration and pending acknowledgement, oversized-photo rejection before decode, failed-confirmation retry without duplicates, cancelled decode/reopened administrator, 12-photo gallery with 36 switches/12 administrator opens/60 tab changes, at most three preview sources and four live photo object URLs, zero live photo URLs while hidden, durable recovery across two reloads, explicit resumption, and retained understanding. Retained Chromium JS heap growth in the most recent workload was 315,604 bytes; WebKit does not expose the equivalent CDP heap metric. A separate 40-second/200-tab-switch workload measured 235,660 bytes of heap growth and 0.48 CPU seconds with no renderer crash. Both engines pass early-storage writes, normal understanding restore/save-race tests, PWA directory/contrast/understanding-color checks and the updated 320/393px sidebar gallery test. Chromium also passes native-quota/IDB-abort/cross-tab preservation, sidebar identity and flashcard settings. Browser network services are mocked; physical iPhone16/PWA termination, production cloud behavior and operating-system memory pressure remain unverified.

### 6.82: translucent shared surfaces and compact navigation

The common card surface opacity changes from 0.93 to 0.68 so the study-time and long-text reader cards reveal the selected photograph. The same surface rule still applies across tabs; word-row understanding gradients remain separate. No image decoding, animation, timer or persistence path is added. Vocabulary selection's three actions stay in one row with responsive spacing/type at narrow phone widths. Only the party navigation button is hidden; the party view, implementation and saved inventory remain intact.

Validation: existing DPR3 iOS/PWA directory/contrast/2,000-word understanding-color regression passes in Chromium and actual Playwright WebKit 26.5. An additional manual layout probe in both engines at 320px/393px verifies equal button top coordinates, no clipped button content, hidden party navigation and retained party-view content. WebKit screenshots were inspected for the toolbar and translucent study cards. Chromium flashcard settings/version regression passes. No physical-iPhone crash claim is made for this styling-only change.

### 10.10.00.25: durable background metadata and catalogue recovery

Version labels and asset cache keys now use the release time in Asia/Tokyo as `month.day.hour.minute`, replacing the prior decimal increment convention.

The previous storage facade returned after a successful first native write of a small value, without mirroring it to IndexedDB. Background selection preferences and small photo catalogues could therefore lack a confirmed IDB copy even after the background UI awaited `flush()`. The gallery reader also returned an empty gallery whenever its separate preference record was missing, even if the photo catalogue was intact. The extended browser regression fails against the previous storage module with `Missing durable background record: aiglish_app_background_GUEST-000`.

Background preferences now have a synchronous native copy plus an IDB mirror; catalogues of any size are mirrored, while large photo catalogues continue to bypass native storage. Existing native records migrate during hydration. A newer confirmed background record takes precedence over an older surviving native record by `updatedAt`. The gallery can read an orphan catalogue without writing an empty replacement. Catalogue mutations also retain a fallback mode/selection snapshot; switching still writes only the small preference and does not reserialize all photographs. Registration success still waits for confirmed IDB completion, and failure/retry/resource limits are unchanged. Existing full-backup inclusion and newer-local restore guards remain in place.

Validation: 85 model tests; Chromium/WebKit gallery checks confirm IDB copies for actual registration and selection, recovery after removing the native preference, rejection of an older native selection, and visibility/selection from a standalone recovered catalogue. Both engines pass the 12-photo/36-switch/12-admin/60-tab resource workload and early-storage-write preservation. Chromium storage recovery, real quota/aborted migration, understanding load/save race and flashcard/version checks pass. No production user records were accessed; this recovers surviving browser records, not photographs already absent from all local/cloud copies. Physical iPhone termination remains unverified.

### 10.10.10.29: shared application background in flashcards

Flashcard play uses the same selected photo URL, dark overlay, cover crop and horizontal focus as the application background. Its fixed fullscreen surface masks unrelated game content behind it. Settings no longer load the separate `sinkai.png` artwork and inherit their existing dialog surface. The iOS recovery rule suppresses photos on both application and flashcard surfaces. No storage writes, new image URL, polling or animation is introduced; existing swipe/flip feedback is retained.

Validation: Chromium/WebKit phone-sized manual probes select a saved photo, open settings/start flashcards, compare the background URL/overlay/position with the app, verify no `sinkai.png` request, swipe and return with the selection intact. WebKit screenshots were inspected. Chromium flashcard animation and settings/version smoke checks pass; git diff --check passes. External services are blocked for these checks.

### 10.10.10.44: lighter analysis and study surfaces

Shared card opacity decreases from 0.68 to 0.42, keeping the existing uniform surface treatment across tabs and the independent understanding colors. Large reader analysis inputs use a 0.35 dark surface rather than solid navy, allowing the photograph to show through the form. Text colors, photo overlay/crop, storage and animations are unchanged.

Validation: Chromium/WebKit PWA directory/shared-surface/understanding-color regressions pass. WebKit phone screenshots of reader input and study cards were inspected, and typed input remains visible. Chromium flashcard/settings/version check and git diff --check pass.

### 10.10.10.54: readable flashcard settings and colored rims

Flashcard settings stay inside their centered dialog rather than inheriting the fullscreen play geometry. The dialog uses a 0.72 dark surface and its inner card remains transparent, avoiding stacked card opacity. Safari's native textbook select explicitly uses a dark color scheme so its white label remains visible. Both card faces receive a 2px colored outline (cyan front, lilac back); using an outline preserves history-driven backgrounds and works even when an unanswered card's inline style removes its border. No storage or animation logic changes.

Validation: Chromium/WebKit phone probes confirm contained settings geometry, translucent dialog color, both face outline colors/widths, shared selected photo and retained selection after swipe/return. WebKit screenshots of settings and play were inspected. Chromium flashcard settings/version and animation/reduced-motion checks pass; git diff --check passes.

### 10.10.11.09: administrator backgrounds shared across users

A versioned catalogue at Firestore `shared/backgrounds` replaces personal-only publishing. Each committed generation has bounded 280,000-character parts, length/checksum validation and an optimistic transaction on its manifest. Conflicting publishers reread and apply their individual upserts/deletions to the latest catalogue. Registration is acknowledged after reading the committed manifest/content and confirming the local IDB cache. Shared artwork remains limited to 12 photos/four million image characters; existing image compression, lazy previews and object-URL release remain in place.

The common catalogue cache (`aiglish_shared_background_catalog`) is durably mirrored by AppStorage and excluded from both personal backup collection and restore. Small per-user background selections remain separate. Deleted shared IDs are retained in `knownIds`, so an older personal catalogue cannot resurrect a globally deleted photograph. Existing personal photographs remain intact; opening the administrator menu with the existing password publishes previously registered photos. Old single-photo IDs are namespaced by owner to avoid collisions between administrators. Closing/reopening during migration invalidates stale UI callbacks. The existing client-side password gate is unchanged; this does not introduce Firebase Authentication or new server security rules.

Startup shows the local cache and fetches shared metadata asynchronously. Picker opening checks the current manifest; unchanged generations do not download image parts again. Foreground refreshes have a one-minute successful-read throttle and read failures have a 30-second backoff. Failed reads preserve the cache; incomplete generations fail validation without replacing it. Photo choices do not write the shared catalogue or change other users' selection.

Validation: 85 model tests. Chromium and WebKit use three independent browser contexts against an isolated Firestore double to cover password-gated legacy publication, new registration, common visibility/independent choices, permission-denied publication/retry, global deletion without resurrection, offline cache/choice after reload, optimistic concurrent additions, multi-part photos, rejected incomplete parts and exclusion from personal backups. Both engines pass updated sidebar/durability tests and the 12-photo/36-switch/12-admin/60-tab resource workload; Chromium retained heap growth was 334,744 bytes in that workload. PWA directory/understanding-color regressions pass in both engines. Chromium understanding load/save-race and flashcard/version checks pass.

A read-only REST check of the production shared catalogue returned HTTP 429 `RESOURCE_EXHAUSTED` on October 10 (Asia/Tokyo). No production documents were written. Consequently live production publication and server-rule access are unverified, and production sharing needs the existing Firebase quota failure resolved. The UI reports publication failure rather than presenting a local-only registration as shared success.

### 10.10.11.28: vocabulary master recovery and understanding rims

The index-only startup no longer leaves an uncached shared book empty: opening the book fetches its `shared/vocab_<id>` master on demand. A newer empty draft without explicit deletion intent cannot hide a nonempty personal draft, custom/master cache, or full-save snapshot. Empty/corrupt master entries in integrated saves are rejected before replacing local copies. This also protects metadata-only edits of a personal book whose words survive only in its draft.

`vocab-master.js` separates missing/failed loads from deliberate last-word deletion or an explicit empty import. Confirmed empty content is carried through per-book cloud chunks and full saves. Failed cloud reads leave the LearningData loading gate closed; empty transient displays cannot capture or upload a replacement master. The selection screen reports a failed read and allows another attempt. No preload of all books, new animation, polling, or duplicate master backups was added. Deletion tombstones and partial deliberate deletions remain authoritative.

Both flashcard faces now use the same rim color as the selected meaning's understanding/history, including status-only and unrated entries. The active implementation in `vocab_ui.js` previously overrode the meaning-specific implementation in `app.js`; it now honors meaning IDs and word numbers rather than combining unrelated meanings.

Validation: 89 Node tests; Chromium and WebKit vocabulary recovery and loading/save race tests; Chromium flashcard settings and animation tests. The new recovery test fails against the preceding app/multi/vocab_ui sources and passes after the change. Fixtures use Japan-history words and cover cold/empty caches, larger backup recovery, network failure/retry, empty-display save rejection, deliberate deletions and meaning-specific rims. WebKit runs in the cloud, not on the user's physical iPhone. These tests establish recovery behavior for surviving copies; they do not establish that the user's production Japanese-history data has been restored. No production data was changed.

### 10.10.13.52: ship sunset classroom as a static asset

The supplied ZIP's 1672×940 PNG (1,990,919 bytes) is optimized into `assets/background-classroom.webp` (1280×720, 77,434 bytes) and a 320×180 WebP preview (8,700 bytes). The original upload and ZIP metadata are not committed. `bundled-classroom` is included in every account's photo slider alongside the existing default and registered backgrounds. It uses the existing `cover` layout and 30% horizontal focus to retain the sunset on a portrait phone; it remains static and uses the same background across tabs.

The bundled image and preview load directly from GitHub Pages, without data-URL decoding, image blobs, Firestore image documents, or a catalogue-write requirement. Only the user's existing small selected-ID preferences are saved. The initial default remains selected, and legacy selected photos remain authoritative. Static entries are excluded from administrator upload/migration/delete lists and from the 12-upload/4-million-character budget. They survive a shared catalogue refresh without being uploaded back into Firestore. Existing registered photos and choices are retained. Opening the selector respects the catalogue's passive refresh interval.

Validation: 89 Node tests; bundled-background test in Chromium and WebKit with independent browsers, simulated Firestore quota errors, selection/reload, preserved understanding, portrait previews and all-tab rendering. Tests confirm zero shared-image writes and no bundled asset migration. Existing shared-background and sidebar persistence regressions succeed; the resource budget covers the extra static slider entry as well as twelve registered photos. The background does not depend on Firestore quota recovery; it still requires the deployed static asset to be downloadable from GitHub Pages. Physical iPhone and offline-first PWA navigation are not claimed as tested.

### 10.10.14.08: three more bundled backgrounds

The additional ZIP contains three 1448×1086 PNGs: a mountain lake, winter terrace, and nighttime cafe. Their optimized 1280×960 WebP assets total 280,022 bytes (69,982 / 129,318 / 80,722); 320×240 previews total 25,390 bytes. Only these optimized images are committed. All four bundled photos, including the classroom, are available in the existing nameless portrait slider, using static cover rendering with individual horizontal focus. Existing default and user selections are preserved.

The same direct static-asset path avoids Firestore image reads/writes and data-URL/blob decoding. Bundled assets stay excluded from administrator migration and upload limits. Gallery regressions cover all four photos in independent contexts, successful full-image decoding, per-photo persisted selection and unchanged understanding; resource limits include the three additional entries. WebKit testing runs in the cloud rather than on a physical iPhone.

Validation: 89 Node tests; all four bundled-background checks pass in Chromium and WebKit. Chromium shared-catalogue, sidebar persistence and flashcard/version regressions pass. The DPR3 PWA resource workload with seventeen slider entries retains at most three active preview sources; heap growth after collection was 315,176 bytes across 36 selections, 12 administrator openings and 60 tab changes. Its deferred-flush fixture now waits for the asynchronous flush to start before completing it. No production Firebase data was changed.

### 10.10.14.39: retire background administration UI

Remove the sidebar administrator entry, password/register/delete/focus dialog, its application handlers and styles. The bundled gallery and default remain selectable. Existing shared and personal photo catalogues remain readable without deleting any cached photograph or selection, and background choices continue to save small preferences. Background additions now use repository assets. `BackgroundCatalog` compatibility remains for old catalogues; the UI no longer publishes/migrates images. Legacy rendering/resource release and learning-data persistence remain intact.

Validation: 89 Node tests; Chromium/WebKit bundled selection/reload, ratings preservation, existing shared photo and IDB recovery, independent accounts and absent administration UI. Existing catalogue backend coverage is retained using isolated stored-photo fixtures instead of the removed registration UI. Chromium verifies shared deletion history, offline cache, the seventeen-entry rendering resource workload and flashcard/version display. A production read-only request still returns HTTP429 RESOURCE_EXHAUSTED; no production data or settings were changed. PR119's directory read reduction remains a separate unmerged change.

### 10.10.16.02: retire party, character and multiplayer modules

Remove `multi.js`, `gacha.js`, `gacha.css` and `addon.js`, party navigation/content, multiplayer screens and launch handlers, equipment selectors/settings behavior, character/enemy/gacha presentation and their exclusive artwork/video. The guide no longer announces these features. Retired battle/party selectors, input hooks, observers and animation rules are removed. The tower's scenic page and existing stored floor records remain; its old START button called the removed multiplayer flow and is removed with that flow.

Do not discard the learning infrastructure previously mixed into those files: save/restore, latest-local-understanding merges, vocabulary draft recovery, loading gates, backup checksums and cloud chunks move to `save-system.js`; statistics UI refresh, write throttling and save coordination move to `save-coordinator.js`; word-only long press and offline/subtle feedback move to `learning-feedback.js`. Existing local/Firebase keys and generic backup APIs remain compatible; no production records, legacy inventory/purchases, balances, ratings, notes, book/workbook masters or study ledgers are deleted. Deprecated character assignments are no longer executed. The total JavaScript served for the five changed original modules versus their replacements is reduced by 657,173 bytes.

Validation: 89 Node model tests; Chromium and WebKit learning-load/save races, empty-backup rejection, repeated save/reload, Japan-history master recovery and startup with real saved profiles/ratings/balances. Chromium flashcard settings/version/float/flip/swipe animations, workbook operations, public notes, native-quota overflow/recovery, study-time pause/edit/reload and tower-record preservation, ranking sync retries, and iOS/PWA repeated-tab/profile/heap workload pass. WebKit DPR3 PWA large-directory reads with two-thousand-word understanding colors and bounded repeated navigation pass; static bundled photo persistence passes. Source-reading save tests target the extracted save module. Two older reload fixtures now wait for the learning boot gate (or its defined window property), rather than editing test data during asynchronous restoration. The physical iPhone is untested; these checks do not guarantee that every device crash is eliminated.

### 10.10.16.41: supplied UI and flashcard sounds

Add seven user-supplied sounds as static mono MP3s (99,676 bytes total, converted from 154,243 bytes of supplied audio). Event delegation covers ordinary buttons, confirmation/registration, tabs/backgrounds, close/back, menus/details, and pointerdown-only understanding controls without duplicating their click sound. Valid flashcard swipes play distinct left/right sounds; upward skips and card flips also play. Sound calls are optional, synchronous requests and never delay rating updates or saving.

`sound-effects.js` allocates one media element and one AudioContext/GainNode only after interaction; this gain provides software volume where iOS ignores HTMLMediaElement.volume. It fetches only the requested static sound, limits bursts to one per 70ms, interrupts the preceding effect rather than layering/queuing, suspends on end/error/hidden/pagehide, and handles rejected playback without an application warning. Sidebar mute/volume defaults to enabled at 30%, persists in the existing durable storage shim and restores after learning-data boot. Muted startup allocates no player/context. Replace the unused oscillator helpers with aliases to this same bounded player. No cloud audio reads/writes, timers, polling, eager seven-file download, BGM or loops are introduced.

Validation: 89 Node tests; Chromium/WebKit trusted input and actual decode/playing events for all seven MP3s, zero startup audio requests, one player/context through 100-call bursts, software gain, mute/volume reload, left/right/up flashcards with preserved understanding, hidden-page resource release and rejected-play isolation. Chromium flashcard/version/animation, loading-save race and sidebar-profile checks pass. WebKit requires permission to create its GStreamer media temp files under `/var/tmp` in this cloud sandbox; the initial MediaError was that environment restriction rather than an MP3 format failure. Tests use cloud WebKit rather than a physical iPhone, and do not assert hardware speaker/ringer behavior.

### 10.10.17.18: supplied selectable background music and short menu cue

Add all seven audio variants from the four supplied music ZIPs as static stereo 128 kbps MP3s. Sidebar BGM enable, volume and track selection persist through the existing storage/save mechanism; defaults are off and 20%. A saved enabled choice waits for a user gesture after startup. Only the selected track is loaded into one reusable looping media element. Effects and music share one lazy AudioContext, with independent GainNodes and mute settings; an effect ending or being muted cannot suspend playing music. Hidden/pagehide releases sources and suspends both channels. No cloud audio storage, eager track downloads, polling or full-song decoded buffers. The hamburger menu uses a generated 150 ms decaying sine “pon” instead of the longer opening sound.

Validation: 89 Node tests; Chromium and cloud WebKit verify actual decoding/playing of seven tracks, zero startup allocation/requests, two bounded media elements and one context, independent mute/gain, native looping, saved choices restored without autoplay, next-click restart, pagehide suspension and isolated rejected playback. WebKit loop coverage uses byte-range responses to match GitHub Pages; the local Python server does not support MP3 seek ranges. Existing UI sound and flashcard/version regressions pass. No physical iPhone speaker testing or production-data changes.

### 10.10.18.04: compact sidebar and profile/settings dialogs; retire labyrinth

Replace the sidebar's inline editors and labyrinth entry with ordered Profile, Settings, Usage Guide, Logout and Version. Native centered dialogs reuse the existing profile/audio/API controls and IDs instead of duplicating their storage handlers. Profile supports photo, name and safely validated hexadecimal name color; frame is a disabled future placeholder. Color is persisted in the existing profile JSON/transaction and honored by shared ranking/people name presentation. Existing archived frame/purchase/quiz fields are retained. Settings contains BGM, sound effects and API key, with explicit API-key save feedback. Escape, outside-click and close restore focus to the menu trigger. Short entry animation respects reduced motion; no new timers or blur layers.

Remove the labyrinth start screen, link, exclusive title/scroll CSS, obsolete start-screen toggles and 1.55 MB tower image. Remove its guide advertisement; preserve flashcard setup, study animations, swipes, autosave and existing stored historical records. Guide content remains available for future redesign. Version metadata and script/style cache queries are updated together.

Validation: 89 Node tests; Chromium/cloud WebKit compact-menu ordering, centered dialogs, name/color persistence, future frame placeholder, API-key save/reload, guide and 15 repeated open/close cycles. Chromium profile-photo compression/reload, retained learning/purchases, stale backups/offline cloud retry; flashcard settings/version and swipe sounds; books/public deletion, people and ranking sync; study timer/reload and stored historical records. WebKit BGM seven-track decode/play/loop and saved settings after moving controls pass. iOS/PWA Chromium workload verifies 144 tab changes, six profile saves/reload and bounded heap with retained learning/purchases. Browser fixtures target open dialogs now that profile/settings use reusable native dialogs. No production user data was edited; physical iPhone remains untested.

### 10.12.22.35: reduce textbook selection allocation and duplicate work

Opening a saved textbook repeatedly serialized and parsed its entire master when merging progress or caching a draft. Draft envelopes now copy without cloning the read-only master; displayed words remain separate objects. Recovery checks fallback masters lazily, retaining the same preference order, explicit deletion and backup rules. Unchanged drafts render once even when no answers have been recorded. Persistent master/progress backups remain in place.

Selection coalesces duplicate taps, closes the learning save gate before yielding, removes the previous page before processing the next book, and shows loading feedback. A newer loader request supersedes an older request even in an A→B→A sequence. Superseded personal-book reads stop before decoding or fetching subsequent chunks. Failed reads still leave the save gate closed and preserve saved data.

Validation: 133 Node tests; Chromium and cloud WebKit open 3,000-word books repeatedly with 40 displayed cards, preserve ratings/notes/stickies, avoid whole-draft serialization, coalesce duplicate taps, render unanswered drafts once, keep canonical masters separate, and reject stale A→B→A cloud responses. Existing cold/cache/full-backup recovery, failed-load gate, explicit deletion and flashcard rims pass in both engines. Chromium edit/restart/POS, deletion-backup cleanup and flashcard settings/version checks pass. The edit/restart fixture now waits for asynchronous textbook selection and flashcard display completion. No production data writes; the reported physical-device crash was not reproduced, so these checks do not prove every iPhone PWA restart is resolved.

## Battle callouts and feedback (10.21.10.00)

Battle events were easy to miss: a one-line strip announced them, and the only explanation was in the room settings. When an event starts, a callout now appears over the upper middle of the screen. It shows the event name, a one-line headline of what to do (`hint` in `WordDuelModel.eventCatalog`) and the full rule with the room's configured event points substituted. It fades after 2.4 seconds. The strip below the score keeps the name, headline, remaining seconds and a draining bar, colored by event group, and shows `まもなく` before the event starts. The start countdown (3, 2, 1, スタート！), every fifth combo and the last 10 seconds also get short callouts, ordered by priority so an event start is never overwritten. Score changes float up from each player's score (opponents included), wrong answers shake the question card, and the current leader is marked with a crown.

Callouts are `pointer-events: none` and never block answer buttons. They are single short-lived elements animated with the Web Animations API, using transform and opacity only, so they keep working under the iOS stable-rendering layer that switches off CSS animation, without adding filters or long-running effects. Reduced-motion users get a plain fade and no movement. Validation: `tests/word-duel.smoke.cjs` checks the event callout text, the configured points, the strip headline and tone, that the callout does not take pointer input, and the leader mark on another player's screen.

The strip below the score also shows what the running event means for this player: whether a ranking event applies to them (based on the standings just before it started, as scoring does), or their progress in a challenge (for example `連続正解 2 / 3`). It also shows the full rule with points, so no tap is needed. When an event ends, a summary shows the challenge outcome and the points gained during the event. Each player shows a correct-answer badge, and an opponent's icon lights up when they answer correctly. A new sole leader triggers a `逆転！` callout. The combo line changes color at 5, 10 and 20 combos. The end of the time shows `そこまで！`; results appear from last place to first, then the player's own place, a crown for first place, and a short confetti burst of 28 pieces that removes itself. Under reduced motion, score pop-ups only fade, and the confetti and the results sequence are skipped.

The scoreboard is a podium: from the left, second, first, third and fourth place, each on a step whose height and color follow the rank (ties share a step), with the score on the step. When the order changes, players slide to their new places with a small hop (FLIP: measured before and after reordering with CSS `order`), and steps grow or shrink. The event callouts carry the effect, not the event name, as their large text. At an event start, the large line is the effect, or for a ranking event what it means for this player. At the end, it is the challenge outcome or the points gained, and the event name moves to the small label. Correctly answering 「選択肢の中にはない」 when the meaning is missing from the choices now scores double. The doubling applies after the combo calculation (and to 得点固定), with event multipliers on top. Every client and the settlement use the same `WordDuelModel.replay`. The battle smoke test records which answers were none-of-the-above, because room seeds are random.

After a miss (or 「わからない」), the correct meaning appears as a card in the middle of the screen with the 3-second countdown and the next-question button, instead of under the choices. 「わからない」 sits below 「選択肢の中にはない」 and is recorded as choice 10 (`WordDuelModel.pass`). It has no penalty and none of the miss effects of events, but the combo breaks, it counts as not-correct for challenges, the 3-second wait applies, it earns no per-answer bonus (so it cannot be repeated for points), and the word is marked × in the understanding record. Older apps reject choice 10, so new rooms are version 10, and the button appears only in version 10 rooms and in solo play. Older apps refuse version 10 rooms with the existing "update the app" message.

On the results screen, the finished room stays watched. `再戦（ルールそのまま）` creates a version 10 room with the same rules, the same words and a new seed (questions in a different order), sized to the players who stayed. It writes the new room code into the finished room as `rematch` in the same transaction, and joins an existing rematch room instead of making a second one. The other players see an invitation with a join button. `ルールを選んで再戦` opens the settings screen filled from the previous room (`BattleLobby.apply`) and sends the invitation once the room is created. Solo results offer `もう一度（ルールそのまま）`.

## Word pronunciation (10.21.18.00)

`pronounce.js` reads English words with the browser's built-in speech (Web Speech API). It needs no server or API key, and each utterance is a short `SpeechSynthesisUtterance`. A voice for the chosen accent that ships with the device is preferred (`localService`), with any English voice as a fallback. Speaker buttons are `.pronounce-button[data-say]`, handled by one delegated capture-phase listener that stops the event, so a tap never also flips, rates or opens what the button sits on. They appear in these places:
- the flashcard and warm-up screens, beside the card opposite the info button (not on the card, so taps and swipes are untouched)
- every word-list row (also used in the flashcard word details)
- the battle's correct-answer card, which now also shows the English word

Settings live in the settings dialog under 単語の発音: on/off, automatic reading (off by default), speed (0.6–1.2×) and American or British English, stored in `aiglish_pronounce_settings`. With automatic reading on, a card is read when it appears (English first) or when it is turned over (Japanese first), and the battle's correct-answer card is read when it appears. Browsers may require one tap before the first automatic reading (iOS). When the feature is off or unsupported, every speaker button is hidden. Validation: `tests/pronounce.smoke.cjs` stubs the speech engine and checks:
- the flashcard speaker reads without flipping the card
- accent and speed reach the utterance
- automatic reading happens on show and on flip
- the word-list speaker reads an escaped word correctly
- turning the feature off hides the buttons

## Hands-free flashcards (10.21.22.00)

`hands-free.js` adds a headphones button to the flashcard screen.

**While it is on:**
- **Media buttons:** earphone and lock-screen buttons rate the card through the same path as a swipe:
  - one press (play/pause): ○
  - two presses (next track): ×
  - three presses (previous track): △
  
  A second action within 0.6 s is ignored, so one gesture never rates two cards.
- **Reading:** the visible side is read. After the delay set under 単語の発音 → 「ハンズフリーで答えを読む」 (off, or 1–10 s; stored in `aiglish_handsfree_settings`), the card turns and the other side is read in its language (the Japanese meaning uses a ja-JP voice).
- **Holding the media buttons:** browsers deliver media buttons only to a page that is playing audio, so the mode loops a 2-second 8 kHz silent WAV and re-asserts playback after effect sounds.
- **Wake lock:** the screen wake lock is held when available.

**Pocket mode** is a black, touch-proof cover over everything; a 2-second hold removes it.

**Ending:** hands-free mode stops, releasing the buttons, the wake lock and the audio, when the deck ends or the session is paused. It is not shown on the warm-up screen.

**Keyboards and presentation clickers** work on the card screen at any time: → or PageDown ○, ← or PageUp ×, ↑ △, Space or Enter turns the card.

**Limitation:** iOS suspends web pages when the screen is locked, so reading and buttons are not guaranteed with the screen off. The supported use is the screen on, with pocket mode.

**Validation:** `tests/hands-free.smoke.cjs` checks ○/×/△ from media actions, the double-press guard, the answer read after the delay, the wake lock held and released, keyboard shortcuts, and the pocket cover.

The fix for the ten stale smoke tests also found two app issues:
- `onAppLoaded` wrappers now keep the handler's name.
- On iOS, the warm-up START card had stopped playing its opening animation, because the floating-card rule gained specificity when `:not(.is-settling)` was added; the START card is now excluded from the floating rule.

## Battle answers and understanding (10.21.23.00)

A battle can be won by guessing among choices, so it is weaker evidence than a self-rated card. Battle answers now change the understanding record only when a meaning rated ○ is answered wrong: it drops to × (`WordDuelProgress.apply(..., {onlyDowngrade: true})`). Correct answers, and misses on meanings that are not ○, leave the record and its history as they are. The ranking's studied-word count still counts the answer. 「わからない」 is the player's own statement and still records ×. Warm-up and weak review keep recording every rating.

## Word numbers, inserting and units (10.21.30.00)

`num` remains each word's permanent identity. Understanding records, notes, signatures, battle references, study points and flash resume all use it, so it never changes. The number shown and used for ranges is a separate display number, `no`, which defaults to `num` (`vocab-order.js`). Placing a word at a number that is in use moves only the unbroken run of following numbers down by one. A free number absorbs the run, so books whose numbers follow a printed book, gaps included, keep their numbers.

**Adding and moving words**
- The add form's 単語番号 field uses a free number as is.
- A used number is refused unless 「差し込む」 is ticked. Then the word takes that number (2と3の間 → 3) and the following run moves down.
- Changing the number in a word's edit form moves it the same way, after a confirmation when the target number is in use.
- `stripVocabProgressFromWords` keeps `no` (only when it differs from `num`) and `unit`, so both survive every save path. Copying a public book numbers words in display order and keeps their units.

**Units**
- A unit (単元, up to 60 characters) can be set when adding a word or in its edit form, or for a range of numbers from the word list.
- The word list shows a table of contents: one chip per unit, with its number range, size and share of ○. Choosing a chip filters the list.
- The flashcard settings and the battle lobby (with one book selected) can narrow questions to a unit.

**Display numbers everywhere a number is shown or chosen:** the word list (order, badges, range), flashcard ranges and card badges, the battle range, the missing-number search and the bulk-delete list. The bulk-delete list now also escapes the word.

**Validation:** `tests/vocab-order.test.cjs` and the new `tests/vocab-units-order.smoke.cjs` check:
- inserting between #2 and #3, with consent needed for a used number
- records staying with their word
- units by range, and the filtering contents list
- moving by number
- that numbers and units survive a restart
- the flashcard unit filter and display numbers
- the battle unit choice

## Follow-up: 用語・年号モード (10.21.31)

A book can now be switched to 用語・年号モード in the book editor. Each entry (headword plus description lines) then gives several questions:
- the whole description → answer the headword
- each line without its leading year → type the year (digits only; full-width digits and 年 are normalised)
- each line with one 「」 term blanked → answer that term (one question per 「」)

The year is stored as the start of the line text, so no save path changes. Per-question results live in their own store (`core_v4_term_progress_<owner>_<book>`), which is included in book deletion and the full backup, because whole-word saves replace a word's understanding record. Each question also rates the line it came from, so existing word-level understanding, dots and weak review keep working.

The word list shows a light gradient marker on each year and 「」 term, coloured on the same green → yellow → red scale as the card backgrounds; tapping one shows its history. The add form shows the digits-only year box only for books in this mode. Battle support follows separately.

**Validation:** `tests/term-questions.test.cjs` and `tests/term-mode.smoke.cjs` (question generation, digits-only year box, typed years right and wrong, per-question results, line ratings, coloured markers).

## Follow-up: 用語・年号モードのバトル (10.21.32)

Books in 用語・年号モード now give their generated questions in battles:
- **Whole description:** answer the headword. The choices are other headwords.
- **Blank:** answer the 「」 term. The choices are other terms.
- **Year:** typed. Digits only; full-width digits are accepted and leading zeros ignored. 「わからない」 is still available.

Pool items carry a `kind`, and the answer only needs to be distinct within its kind. Year questions are told apart by their prompt, so two events in the same year are both kept. A room needs at least ten distinct answer texts, so distractors always exist; same-kind texts are used first.

Rooms with term questions are version 11. Their answer records hold `typed` digits instead of a `choice` for year questions; validation refuses a choice on a year question and typed text on a choice question. Rooms without term questions stay at version 10, so older apps can still join them.

Results follow the battle rule for words: only a ○ answered wrong drops to ×, and 「わからない」 records ×. This applies both to the question's own record and to the line it came from.

**Validation:** `tests/term-battle.test.cjs` covers pools, same-kind choices, typed scoring and validation, and version 11. `tests/term-battle.smoke.cjs` plays a solo battle on a term-mode book.

## Follow-up: 年代並べ替え (10.21.32)

Books in 用語・年号モード have a 「年代並べ替え」 entry in their study menu. Each line with a year is an event. A round shows three or four events with different years, never already in order. The player taps them oldest first; tapping a numbered event again takes it back, along with every one after it. The result shows the correct order with years, marking each position right or wrong. A session is ten rounds, ending with a score.

It is practice only and writes no understanding record. Events whose year question was answered × (or △) come up more often.

**Validation:** `tests/term-order.test.cjs` covers events, rounds, checking and weighting. `tests/term-order.smoke.cjs` checks the menu entry for term-mode books only, tapping and taking back, judging, and ten rounds with a score.

## Follow-up: flashcard corner buttons (10.21.33)

On iOS, the icons of the hands-free and speaker buttons sat near the top of their circles. The icons in the bottom card buttons are now positioned absolutely at the circle's centre, so they no longer depend on the button's grid centring.

## Follow-up: battle display and event interval (10.21.34)

**Event interval.** Events now come every 30 seconds by default instead of every 15. The interval is a room setting (15, 30, 45 or 60 seconds). Rooms without the setting keep 15 seconds, so older rooms replay the same. A room with any other interval is version 11, because older apps would place the events every 15 seconds.

**Event bar.** The bar shows one line with what the event does, plus a badge with the seconds left (「N秒後」 before it starts). A personal line (whether the player is targeted, challenge progress) appears only when there is one. The event name and the long description are gone from the bar; they remain on the rules screen. The start and end callouts no longer repeat the name.

**Solo result.** The result is a single card with:
- the score
- correct answers
- the answer bonus
- 「もう一度」 and 「閉じる」

The clock row, scoreboard, time bar, combo line and event bar are hidden, so the buttons no longer overlap the clock.

**Correct answer card.** The card is opaque, so the question and combo line behind it no longer show through. Wide buttons (「選択肢の中にはない」 and 「わからない」) no longer shrink when chosen.

## Follow-up: battle speaker button (10.21.36)

In the correct-answer card, the generic card-button rule (11px padding) was more specific than the round speaker button's `padding:0`, so the icon sat off centre. The speaker button now has a more specific rule, and its icon is pinned to the centre.

## Follow-up: menu cleanup and group talk (10.21.37)

**Menu and saving**
- The sidebar no longer links to 起動診断. The page still exists at `startup-diagnostics.html`.
- 「通信量と保存先」 is now 「データとバックアップ」, with:
  - a note that saving is automatic, and the last cloud save
  - the file backup, moved here from the save panel
  - today's traffic estimate, folded away
- The long storage table and notes are gone.
- The header save button is removed. The full save already runs automatically when a study session ends and when the app goes to the background.

**Group talk**
- **Read marks:** the group document keeps `chatRead.{member}`, the newest message time each member has seen with the talk on screen. One merge write happens per new message from others, never for one's own messages. Own messages show 「既読」 (one other member) or 「既読 N」.
- **Unread in the list:** sending stamps every member's group entry with `chatAt`/`chatBy`. The group list compares this with when this device last saw the talk, and shows a green dot and 「新しいメッセージ」 until the talk is opened.
- **Achievements in the talk:** achievements (100語・30分ごと, group goals) are posted in the talk with a 👏 いいね button, instead of under the member list. Achievements from the last seven days are shown, matching the talk's retention.
- **Online:** people active in the last 15 minutes get a small green dot on their avatar, in the users list and the member list.
- **Layout:** the input is one line and as tall as the send button, growing with the text. The talk screen is opaque.

## Follow-up: read-aloud once, icon badge, lock-screen answer (10.21.38)

**Doubled reading.** Each flashcard was drawn twice, so auto-reading cancelled and restarted the same text at once. With hands-free on, it was read four times. On iOS this came out as a half-read, doubled sentence, most noticeable with long Japanese.
- `Pronounce.speak` now lets a request for the same text, made while that text is still being read, join the reading in progress instead of restarting it.
- A reading cut off by a newer one no longer runs the "finished" callback, which hands-free uses to read the answer.
- Auto-reading leaves the card to hands-free mode while that mode is on.
- `tests/pronounce-once.smoke.cjs` counts the readings; it fails on the old code.

**App icon badge.** A new setting, 「アイコンに未読数」, shows the number of group talks with unread messages on the home-screen icon. It uses `navigator.setAppBadge`. Turning it on asks for notification permission, which iOS requires for badges. The number is updated whenever the group list is read and when the app goes to the background; the list is refreshed when the app comes back to the foreground, at most once a minute.

**Lock screen.** In hands-free mode, the now-playing card shows the word, then its answer once the answer is read out.

## Follow-up: study tools in the group talk (10.21.39)

**Word quiz (`talk-tools.js`).** The Q button next to the input sends a quiz from one of the sender's word books.
- The quiz is the word plus four meanings. Weak words (× or △) are picked more often.
- The message keeps `quiz` (word, options, correct choice, and the book entry reference) and `answers.{member}`.
- Members tap an answer and see right or wrong, plus how many answered correctly. The sender sees the tally.
- A member who has the same book gets the answer recorded under the battle rule (only a ○ answered wrong drops). The signature check refuses a changed entry.

**Tappable English words.** English words in messages are underlined. Tapping one opens a sheet that:
- reads the word aloud
- shows meanings from the word books already on the device (no download)
- offers 「トークの単語」に追加, which opens the word book editor with the word filled in, for one tap to save

**Studying now (`group-study.js`).** After 15 s of a flashcard round, a battle or a weak-word review, each of the member's groups gets `studying.{member} = { at, kind }`; it is cleared when the study ends or the page is hidden. The talk shows 「◯◯さんが単語カード中 · N分」 above the messages, for postings within the last 90 minutes. That is two writes per study session per group.

**Everyone's weak words.**
- Each device keeps a short list of words it recently missed, with their book references: flashcards rated × and wrong battle answers.
- At the full save, each member shares their top 8 from the last 30 days as `weak.{member}`; the group publish compares it, so an unchanged list writes nothing.
- The members tab lists the words with how many members miss each one.
- 「苦手単語でグループバトル」 opens the group battle with these words as the pool instead of a book choice. It needs ten different meanings.

## Follow-up: 声で答える (10.21.40)

In hands-free flashcards, the 🎤 button in the hands-free bar turns on voice answers; the setting is remembered. After the card is read, the app listens once (up to 6 s) with the browser's speech recognition, in the answer's language.

**Judging (`voice-answer.js`, tested in `tests/voice-answer.test.cjs`)**
- A meaning such as 「①〜に従う②〜に続く」 is split into its parts. Notes in brackets, the 〜 placeholder and the particle after it are dropped.
- The spoken text and the parts are compared after:
  - NFKC
  - katakana → hiragana
  - removing spaces and punctuation
- Any recognizer alternative may match, by:
  - equality
  - containment
  - another inflected form of the same verb or adjective (従う → 従います, but not 食べる → 食器)
  - close bigram similarity
- English answers also accept a leading to/a/the and near spellings.
- Saying 「わからない」 or 「パス」 counts as a wrong answer.

**Rating**
- **Right:** the card turns over, shows what was heard with ○, and is rated ○.
- **Wrong:** the right answer is read out, then the card is rated ×.
- **Nothing heard:** hands-free falls back to reading the answer after the set delay and waiting for an earphone button.
- A card drawn twice listens once.

**Devices without speech recognition.** The button reads 「🎤 非対応」 and explains on tap. Home-screen apps on iOS may lack speech recognition that Safari has.

`tests/voice-answer.smoke.cjs` replaces speech and recognition with scripts to check right, wrong and silent answers.

## Follow-up: larger word entry form (10.21.41)

The word entry sheet is now:
- wider: up to 560 px, 8 px from the screen edges
- solid, so nothing shows through it
- built from larger fields: 52 px tall, 17 px text

The meaning field takes the full width. The part of speech (or the year, in 用語・年号モード) and the remove button sit on the line under it. Before, they squeezed the meaning to about 170 px, and in term mode the year sat in the wide column.

## Follow-up: long words in the word list (10.21.42)

A word card's title row reserved 76 px on the right, but the sticky-note, edit and delete buttons take about 120 px. A long word such as 「港川人・山下町第一洞人」 wrapped under them, and its speaker button overlapped the sticky note. The row now reserves 128 px when the book is editable (48 px otherwise, for the sticky note alone). The word wraps within that space, and the speaker button stays beside it.

## Follow-up: matching card buttons and years in the inline editor (10.21.43)

**Buttons.** The sticky-note button now matches the edit and delete buttons: 44 × 47 px, with a 24 px icon in the same colour. Before, it was a 32 px circle with a 13 px icon. The title row reserves room for the wider buttons.

**Inline editor.** In 用語・年号モード, the pencil editor shows a digits-only year box before each line, filled from the year at the start of the line. The line's text is shown without the year. Saving puts the year back at the start of the line, as the add form does. `tests/term-mode.smoke.cjs` edits a year this way.

## Follow-up: year answer panel styling (10.21.44)

On the flashcard screen, the year answer panel's grid column took the input's intrinsic width (about 445 px). This pushed the 答える button off the right edge on phones. The panel now:
- sizes its column with `minmax(0,1fr)`, and the input shrinks to fit
- uses the same frosted dark glass as the card screen's round buttons
- shows a 48 px number field and an indigo answer button in one row, under a small centred label

## Follow-up: protecting PINs, names and keys (10.21.45)

See `docs/security.md`.
- PINs are now stored as salted PBKDF2 digests, with a one-time migration of the old list and documents.
- The shared account list carries no real names or ages, and the login confirmation no longer shows them.
- The Gemini key and the cached account list are left out of cloud saves.
- The admin password is checked against digests instead of appearing in the source.
- `tests/login-flow.smoke.cjs` covers digest logins, migration and sign-up. `tests/login-identity.test.cjs` covers the digest functions.

## Follow-up: app-styled messages instead of alert() (10.21.46)

`app-dialog.js`, loaded first, replaces `window.alert` with the app's own dialog:
- dark card, indigo OK button
- line breaks kept
- several messages queue one after another
- Escape closes it

It no longer blocks the page, and it looks like the rest of the app instead of the phone's system popup. All 68 alert() calls get it with no change at their call sites. confirm() still uses the browser's dialog, because its callers wait for the answer. `tests/app-dialog.smoke.cjs` checks it.

## Follow-up: lighter images and proper app icons (10.21.47)

**Background pictures.** The tango, friend, utyuusen, haikei, kekka and stone pictures are now WebP, 0.1–0.2 MB each. As PNGs they were 0.1–3.7 MB each, about 11 MB in all. The images in the repository root went from 18 MB to about 0.8 MB.

**Removed images.** Six root images that nothing used are gone: Header, dojo, gachatike, gold, tyoubun and sinkai.

**App icons.** The icon (`aiglish.png`, 1536 × 1024 and 2.2 MB) was declared as square 192/512 icons. It is replaced by square icons on the app's dark blue: `icon-192.png`, `icon-512.png` and `apple-touch-icon.png`, 12–66 KB each.

**App name.** The page title and home-screen name were 「Core System V4」 / 「Core V4」. They are now 「TangoLabo」, as in the logo and the backup file names.

## Follow-up: 本名・年齢・目標 retired (10.21.48)

These fields did nothing, so they are gone.
- Sign-up no longer asks for a real name or age.
- The admin editor only edits the nickname.
- Profiles no longer show 目標.

The account write guard removes `realName`, `age` and `userTarget` from every write to an account document. On merge writes, it deletes them where they are present (`deleteField`, newly exposed as `window.fbDeleteField`). Existing accounts therefore lose these fields at their next profile save.

## Follow-up: plainer messages (10.21.49)

The look stays as it is. Only messages changed:
- Pop-up messages and login errors no longer start with emoji (🎉 ✅ 💾 ⚠️ 🎴) or end with 「！」; they end with 「。」.
- System words are gone. 「修行者」 is now 「プレイヤー」, 「認証確認」 is 「ログインの確認」, and 「以下のプロファイルで…」 is 「このアカウントで…」.
- Messages that named Firebase now say 「サーバー」 or 「通信」.

Exclamations that belong to the game stay: 「正解！」, 「スタート！」, 「ラスト10秒！」, 「準備完了！」.

## Follow-up: layout guard at 320 px

`tests/layout-overflow.smoke.cjs` opens the main screens on a 320 × 568 phone:
- login and home
- the word book editor, list and entry form
- the study menu, flashcard settings and play
- the reader and users tabs
- the battle entry and settings
- the menu

It fails if any visible element sticks out past the screen's left or right edge. Elements clipped by a scrolling parent, and the closed sidebar, are not counted. All screens pass today.

## Follow-up: bookshelf and English analysis (10.21.50)

- **Folders work.** Saving to the bookshelf now offers the admin shelves, 未分類 and the user's own folders, including a new one. The shelf shows each folder as a 📁 row, and opens it. An empty folder can be deleted. Before, the folder was saved but never shown, so every text landed in 未分類.
- **Opening from history no longer asks the AI again.** History and the shelf reuse the saved analysis. The history 「開く」 button also had a second listener from an old patch that ran the analysis twice; it is marked so the patch skips it.
- **Missing API key is explained.** Without a Gemini key, the result starts with a notice and a button to open the settings, instead of a silent 「和訳未取得」.
- **Model names.** The reader and the workbook explanation call `gemini-flash-latest`, and fall back to `gemini-2.5-flash` when a model returns 404.

`tests/reader-bookshelf.smoke.cjs` covers these steps.

## Follow-up: reader looks like the word book list (10.21.51)

**Bookshelf** (`reader-shelf.js`)
- It uses the word book list's parts: a BOOKSHELF heading with a toolbar (＋ フォルダを作る, 英文を解析する), then rows with a cover, the name and one line about the contents.
- Each folder row shows how many texts it has and the newest title. Inside a folder, each text shows its sentence count, whether the analysis is saved, and the date.
- The whole row opens it. ⋯ opens the actions: rename or delete a folder (its texts move to 未分類); open, move or delete a text. Deleting asks first.
- Saving opens the same dialog style as the word book editor.

**Analysis input**
- Shorter labels, and a larger English box.
- A count of sentences and words under the box, plus 貼り付け and クリア buttons.
- The manual translation is folded away under 「和訳を自分で入れる（任意）」.
- The 和訳 → 意味 relabelling no longer touches the reader.
- History rows use the same list style, and ⋯ saves an entry to the bookshelf.

**Result**
- The summary comes first.
- The title line shows the sentence count and how to open grammar notes. The save button no longer puts the text into an attribute.

**Loading screen during analysis**
- **Real progress.** The analysis streams (`streamGenerateContent?alt=sse`), and the bar follows the sentences translated so far (「和訳と文法を作っています（2 / 4文）」). Before the first one, it creeps up slowly. The timeout is now 45 seconds without any data, rather than 45 seconds in total.
- **The quiz matches the flashcards.** It uses the flashcard's round card and its side labels (覚えていない / 覚えた, 上: あいまい), with the ×△○ buttons of the warm-up. A tap flips the card; a swipe or a button answers. A counter shows how many words were answered and the ○△× totals.

## Follow-up: Gemini errors in plain Japanese (10.21.52)

A user saw 「Gemini APIエラー（503）: This model is currently experiencing high demand…」. 10.21.50 made two changes that led to it:
- It put `gemini-flash-latest` first. That alias points to the newest Flash model, which is often busy.
- It only tried the other model when a model returned 404.

So a busy newest model ended the analysis, even though `gemini-2.5-flash` (used before 10.21.50) would have answered.

Now:
- **Model order.** `gemini-2.5-flash` is tried first, then `gemini-flash-latest`.
- **Busy (500/502/503/504).** The model is asked once more after 2 seconds. If it is still busy, the other model is tried.
- **Used up (429) or retired (404).** The other model is tried.
- **Explaining the failure.** The reader shows what happened in Japanese, with a 「もう一度解析する」 button, instead of a pop-up with Google's English message. `window.describeGeminiError` builds the message:
  - busy: 「AI（Gemini）が混み合っています… アプリやAPIキーの問題ではありません」
  - quota: 「利用回数の上限」
  - key: 「APIキーが使えません」
  - also covered: too long, model missing, timeout, offline, unreadable answer
- **Error code.** It stays in brackets at the end, e.g. （エラーコード 503）.
- **Workbook.** The 解説 button follows the same order and uses the same messages.

`tests/reader-errors.smoke.cjs` covers these cases.

## Follow-up: reader word marks, word details and grammar (10.21.53)

- **Polysemous words.** The request now lists the word-book entries that appear in the text, with their registered meanings. Each sentence returns `vocab`: the entries used there in one of those meanings, and which meaning.
  - Only those words are marked. "like" is plain when the book has only 〜のような and the text means 好む.
  - Without that check (analyses saved earlier, or no key), every match is marked as before.
  - `updateReaderWordColors` skips words left plain (`data-vocab-skip`).
- **Word details.** A marked word opens the same card as the flashcard's ⓘ (`openVocabDetailsSheet`, shared with `openFlashcardWordDetails`). A line on top says which meaning this sentence uses (「この文での意味：①りんご」). Closing the sheet refreshes the reader's colours.
- **Grammar points.** They were being returned but were invisible: an old rule set `.grammar-span { border-bottom: none !important }`, and nothing added the colour classes it expected.
  - They now have a purple underline.
  - A tap on any word inside one opens the explanation (before, word boxes swallowed the tap). The popup's heading shows the point's name (`label`).
  - `findGrammarPhrase` finds the phrase even when the AI writes 〜, ..., S V or different quotes, matching whole words only.
  - The request asks for exact phrases and uses a `responseSchema`. If a model rejects the schema (400), the request is sent again without it.
- **Spacing.** Words were drawn with the space inside each inline-block box, where it was dropped, so the words ran together. The space now sits between the boxes.
- **Inflected forms.** `findVocabByToken` also matches plain inflections the stem rules missed: apples, studies, chatted, making, tried.

`tests/reader-vocab-grammar.smoke.cjs` covers these.

## Follow-up: reader word books, meaning colours, shelf editing (10.21.54)

**Word books for the reader** (`reader-vocab.js`)
- 「参照する単語帳」 in the analysis card picks one or more word books. It is saved per account; when nothing is picked, the open book is used. The open book always comes first.
- The words of these books are read, with this account's understanding merged in, and found with their inflections.
- In the request, each book has a letter, so an entry reads `[A261] ready: ①用意ができた`. The AI's keys are mapped back to `{ book, num, meaning }`, and `vocabBooks` records which books were checked.
- Words of books added later are marked without the check.
- A word from a book that is not open opens its card read-only (no rating or editing), saying which book it belongs to.

**Colours by the meaning used**
- A marked word takes the understanding of the meaning the sentence uses. For example, run used as ②経営する is red when ② is rated ×, even if ① was never answered.
- Without a meaning from the AI, the colour comes from the word as a whole, as before.
- `updateReaderWordColors` repaints from the stored book, number and meaning.

**Bookshelf**
- Each text's ⋯ menu has 「名前・本文を編集」.
- A changed text loses its saved analysis, and the next opening analyses it again. Any shelf text without an analysis keeps the next successful one.
- 「並べ替え」 shows ▲▼ on the rows, for folders on the shelf and for texts in a folder. 「完了」, or leaving the view, ends it.

`tests/reader-books.smoke.cjs` covers these.

## Follow-up: bookshelf texts lost on restart (10.21.55)

Texts saved to the bookshelf could disappear after the app was closed and opened again.
- **The cause.** The bookshelf, folders and history go into device keys right away (`myBookshelf`, `myFolders`, `textHistory`). At startup, though, `applySavedMemory` replaced them with the last full backup. Full backups run only at boundaries, such as closing the result screen or leaving a tab. So a text saved just before the app was closed was gone at the next start.
- **Changes are stamped.** Each change to the bookshelf or history now stamps the device copy for that account (`aiglish_reader_local`).
- **Restore keeps the newer copy.** If that account's stamp is newer than the backup being restored, the restore keeps the device copy. The device keys are shared by every account on the device, so another account's stamp never counts. Restoring a backup file still replaces everything.
- **Backup after changes.** A bookshelf change now starts a backup 1.5 seconds later (`saveAfterStudy("reader-shelf")`).

`tests/reader-save.smoke.cjs` reproduces the loss and covers the fix.

## Follow-up: broken bookshelf entries no longer stop the start (10.21.56)

Some stored bookshelf or history data held entries that could not be used: `null`, a number, or an object where a list was expected. When the shelf or history drew such data, it threw an error. The app then showed the red error notice (e.g. 「Cannot read properties of null (reading 'bookId')（reader-shelf.js:19）」), and `loadLocalState` failed partway through the start.

`reader-shelf.js` now tidies the three lists before every use:
- texts without a string `text` are dropped
- folder names that are not strings are dropped
- a value that is not a list becomes an empty list

`tests/reader-save.smoke.cjs` restarts the app with such entries and checks that no error is shown.

## Follow-up: warm-up opening (10.21.57)

The warm-up now opens with a short scene instead of a card appearing at once. It uses the START card's look: a ring, the number of words in italic Georgia, then 「WORDS」 and 「単語スタート」.
- After 1.5 seconds it fades, and the flashcard screen fades in.
- A tap skips the scene.
- With reduced motion, the scene has no animation and lasts 0.5 seconds.

## Follow-up: editing shared word books (10.21.58)

The words of shared (distributed) books could not be edited at all. Admin rights (`window.isAdmin`) were switched off whenever the admin tools dialog closed, and the edit controls need those rights.

**For everyone: 「自分用にコピーして編集」**
- This new item in a shared book's ⋯ menu copies the book into the user's own books as 「名前（自分用）」. The copy keeps the words and the understanding so far (progress and its recovery copy), and the copy opens editable.
- 「元の単語帳を一覧から外す」 is ticked by default. The original comes back through 「非表示の自分の単語帳」.

**For the administrator: 「配信中の単語帳を編集する」**
- This button in the admin tools keeps admin rights on after the dialog closes. A banner at the top of the word book screen says so (「変更は全員に反映」), and 「終了」 ends it, as does a reload.
- While the mode is on, a word edit to a shared book is published at once (`saveVocabMasterToStorage` → `shared/vocab_<id>`) instead of waiting for the next flush.

`tests/shared-book-editing.smoke.cjs` covers both.

## Follow-up: poker for points (10.21.59)

The battle tab's lower card (ガチ, which had only shown 「準備中」) now opens **ポーカー**: Texas Hold'em played for study points.

**Rules** (`poker-model.js`, no screen or network)
- Covers the deck, the best five of seven cards with Japanese names, and blinds (heads-up: the dealer posts the small blind).
- The action order keeps the big blind's option. A raise reopens the action, and the minimum raise is tracked.
- All-ins create side pots. In a split pot, the odd chip goes to the first winner after the dealer. Leaving folds at once.
- Every function returns a new hand, so all devices reach the same table.
- `tests/poker-model.test.cjs` covers these.

**Table** (`poker.js`, `poker.css`)
- A table is one document, `pokerRooms/{4-digit number}`, found by its number like a battle room.
- Its maker sets the buy-in (20–100,000 pt, at least 10 big blinds), the blinds (1/2 up to 50/100), the seat count (2–6) and the time to act (15–60 s).
- Every move is a transaction through the model.
- The maker's device deals. It shuffles with `crypto.getRandomValues` and seals each player's two cards for that player alone (ECDH P-256 + AES-GCM, one key pair per table and account, kept on the device). It also turns over the board and the showdown, handles running out of time (check if possible, otherwise fold), and starts the next hand 5 seconds after one ends, moving the dealer button.
- Players who join during a hand play from the next one. A player without chips can add the buy-in again.

**Points**
- When a hand ends, each player adds their own result to their wallet (`users/{id}/learningPoints/main`, plus the public `studyPoints`). This happens once per table and hand: the result is keyed and recorded both in the wallet and on the device. The local wallet is then updated through `StudyPoints.restore`.
- An unfinished hand changes nothing.
- Leaving during a hand loses the chips already in the pot. That loss is settled when the player leaves.
- Joining needs at least the buy-in in points.

**Limits**
- The maker's device knows every card it deals, and the table stops if the maker leaves.
- As with the rest of the app, the checks run on the devices (see `docs/security.md`).

`tests/poker.smoke.cjs` plays two hands between two devices; `tests/casual-lobby.smoke.cjs` opens poker from the battle tab.

### Poker practice against the computer, and the how-to (10.21.60.00)

**Practice** (`poker.js`, `poker-bot.js`)
- 「コンピュータと練習」 in the poker lobby starts a table against 1–5 computer players (やさしい / ふつう / つよい). It uses 100 chips and blinds of 1/2.
- No points are staked, so it also works for guests and offline. The table exists only on this device: moves go through the same model as online tables, but they are not written to Firestore and the cards are not sealed.
- The game ends when the player, or every computer, runs out of chips. 「もう一度」 starts again with the same settings.
- A computer acts after a short pause (0.7–1.6 s). It estimates its chance of winning by dealing out the unknown cards many times, then weighs that against the price of calling, with some noise, bluffing and, at つよい, reading a bet against it as strength. If its move fails, it checks or folds.
- Levels were tuned against a simulated casual player heads-up: the player wins about 60% of games against やさしい, 40% against ふつう and 34% against つよい.

**How-to** (`poker-tutorial.js`)
- Seven short animated scenes: the two hole cards, the five board cards, the best five of seven, hand ranks, the four moves, blinds and the dealer, and how a hand is won. It honours reduced motion.
- It opens by itself on the first visit to poker (`aiglish_poker_tutorial_seen`) and from 「遊び方を見る」 in the lobby. Its last button starts practice.

`tests/poker-bot.test.cjs` checks the computer's moves; `tests/poker-practice.smoke.cjs` covers the how-to, a practice game to its end and 「もう一度」.

### Study points: every way of answering a word pays the same (10.21.61.00)

- Answering a word pays **2 points**, whichever way it was answered: a flashcard rating, a correct battle answer (or a talk quiz), or a correct weak-word review. A workbook problem recorded on its own also pays 2. Study time stays at 1 point a minute.
- Before, the rates were 1 (card), 3 (battle) and 10 (weak review), so a weak review earned ten times what a card did for the same step.
- The once-a-day rule is unchanged: one word in one book earns once per Japanese calendar day, whatever the method or the number of meanings.
- Records made at the old rates (1, 3, 10) are still accepted, so answers waiting to sync when the app updates are paid as earned (`StudyPointPolicy.allowed`). Any other amount is refused.
- `tests/study-points.test.cjs` keeps the settlement tests on distinct tiers and adds a test for the even rates and an old pending record.

### Motion on iPhone, the warm-up opening, and poker motion (10.21.61.00)

**iPhone**
- On iPhone and iPad (`html.ios-stable-rendering`), `style.css` turned off every animation and transition page-wide. This is why the warm-up opening and the poker how-to did not move there.
- They are now exempt: `.warmup-intro`, `.poker-screen` and `.pk-tutorial` with their contents. These only animate transform and opacity.
- Blur, filters and backdrop captures stay off everywhere, and motion stays off on the rest of the page.

**Warm-up opening** (`learning-sessions.js`)
- A ring draws itself while the count runs up to the number of words, the letters of WORDS fall in, and sparks burst when the count lands. Then it zooms away to the first card, in about 2.3 s; a tap skips it.
- It waits for frames to be drawn before it starts. The warm-up often opens while the app is still starting, and timers would otherwise run ahead of an animation nobody saw.
- The card screen is hidden at once (no fade-out) while it plays, so the first card no longer shows through first.

**Poker motion** (`poker-fx.js`)
- The table is rebuilt on every change. `PokerFX.decorate` compares the new state with the last one drawn and animates only what changed:
  - cards dealt from the middle;
  - the board turned over;
  - chips thrown in and swept to the pot;
  - a word over each player who moves;
  - folded cards sliding away;
  - the pot flying to the winner, and sparks for the player's win;
  - confetti when a practice game is won.
- Start times are kept, so a redraw mid-animation resumes it with a negative delay instead of cutting it off.
- Lobby panels and action buttons rise in, and the player to act has a pulsing ring.
- Board cards and name plates are slightly smaller, so side seats no longer cover the board at a full table.

### Poker in everyday words, hand help and the ranks sheet (10.21.61.00)

**Words**
- The buttons say what they do: 降りる (fold), 様子見 (check), 同じだけ出す N (call), 上乗せする / 賭ける (raise / bet).
- The log and the words over the seats use the same terms, and "pot" is 場のチップ.
- The how-to gives the poker term in brackets.

**Choosing an amount**
- The player types the number of chips to put in, or nudges it with − / ＋, the slider, or 少しだけ / 場の半分 / 場と同じ / 全部.
- It shows how much of the stack this is and the minimum. The button reads 「N 出す」 (全部賭ける at the maximum).
- The hand help steps aside while it is open, so the buttons stay on screen.

**Hand help** (`poker-hint.js`)
- Under the player's cards: the hand made now, in a name and plain words. The cards that make it glow on the table and in the hand.
- Up to three better hands the next card could bring, each with the cards that do it and the chance of the next card being one of them. This is counted exactly over the unseen cards.
- A pair that lands on the board by itself is not counted, since it is for everyone.
- Before the flop, a tip about the two cards.

**Ranks sheet** (「役の一覧」)
- All hands from strongest to weakest, with an example and plain words.
- The hand held now is marked 今の役, and hands one card away are marked あと1枚.

**Results**
- Each seat shows what that player gained or lost in the hand (+9 / −9), not the pot taken. This matches how points move at a real table.

**Fix**
- The table effects no longer fail while a table waits for its first hand. This failure had stopped the waiting room from drawing.
- `tests/poker-hint.test.cjs` covers the hand help.

### Cleaning out retired and replaced code, a new study tab and users tab (10.21.62.00)

**How the code was chosen** (nothing was removed by guesswork)
- V8 coverage was recorded over all 97 browser tests.
- A JavaScript parser (acorn) found:
  - `window.NAME` functions that a later statement or a later-loaded script replaces before anything stores, passes or calls the old one;
  - functions whose name appears nowhere else (no script, test or `index.html`);
  - local helpers nothing calls.
- Each pass was repeated until nothing more qualified. A parser check also confirms that no identifier is left undefined.
- `app.js` went from 553 KB to about 380 KB; `fix.js` from 113 KB to 28 KB.

**What went**
- Retired titles and their XP bonuses. The old function names stay as no-ops for compatibility, and `totalExp` is still carried in saves.
- `fix.js`'s admin data panel: the title editor, wipe-all and selective-wipe screens. Its entry button had been disabled, but a 0.3 s timer still checked for it. The account sync, study sync and the receivers for old reset flags stay.
- Four to five overwritten versions each of `saveUserStats`, `loadUserStats`, the vocab-progress loaders, the friend list, leaderboards, the loading-quiz functions and the penguin overlay.
- Unreferenced season, leaderboard and admin helpers, and 32 "patch applied" console messages.

**Loading overlay CSS**
- It used to be injected at runtime by patches 4, 5, 6 and 8. It now lives in one block in `style.css`, with rules for markup that no longer exists dropped.
- Screenshots of the overlay with animations frozen were compared before and after: they are pixel-identical apart from the quiz word.

**Study tab** (`study-time.js`)
- Summary tiles under today's time: this week, the daily average, the streak (days in a row with a minute or more) and the total.
- The calendar is a heat map (1, 15, 45 and 90 minutes or more) with "1:05" / "12分" labels and a legend. A detail row shows the selected day.
- The week chart puts each value on its bar, draws a dashed line at the week's average, and shows the range as 「10月19日〜25日」.

**Users tab** (`people.js`)
- A name search and a count.
- Sections for online (active in the last 15 minutes) and recent users.
- Each row shows how long ago the person was active, today's study time and a friend mark.

**Poker**
- The practice test's long waits were the test's own doing: lowering the computer's stack in place could be undone before the next hand, so a game ran past the loop's 100 s budget. The stack is now set again after every hand, and the loop waits by time.
- The dealer loop also gets two safeguards. A step that never finishes is released after 15 s. A computer turn that has not moved for 20 s checks or folds.

**Further cleanup (same release)**
- Removed:
  - the old study-time editor and graph patches (5–10, 15–17). Each returned early when `StudyTime` exists, yet still ran timers every second or every five seconds.
  - the old community-ranking patches (13–14) and two reader patches (vocab trainer, open-button rebinding). The current screens already avoid what they fixed.
  - the retired admin panels for books, shelves, user repair and missing-number search. Their anchors are gone from the page; the six names still called from shared code are no-ops.
  - the intermediate wrappers in the hide-loading chain, which finished the loading quiz up to four times.
- Moved the usage guide overlay from app.js into `usage-guide.js` and `usage-guide.css`. Its sections and tips come from `usage-guide-content.js`, as before.
- app.js no longer injects any CSS. Every injected sheet now sits in a stylesheet in the same cascade position.
- Screenshots of the vocabulary, reader, battle and ranking tabs, the sidebar and the usage guide are pixel-identical before and after.
- app.js is now about 230 KB (from 553 KB).


### A moment for each start and result (10.21.63.00)

**The shared frame** (`ceremony.js`, `ceremony.css`)
- `Ceremony.play` gives every moment the same frame: a number counting up, a word falling in letter by letter, a line under it, and a zoom away.
- Each moment has its own picture (`style`):
  - `ring`: the first ten words. The ring draws itself and sparks burst.
  - `deck`: flashcards. Seven cards fan out and gather into one deck.
  - `stars`: results. Up to three stars light (one per third of the score) and a bar fills to the score.
  - `focus`: weak-word review. Target rings close in on the number, with a crosshair.
  - `flame`: streaks. A flickering flame, and the last seven days light one by one.
  - `trophy`: reached group goals. A cup rises in front of turning rays, with confetti.
  - `chips`: a practice poker win. Chips rain down into stacks.
  - `fold`: a practice poker loss. Two cards turn face down and drift away.
- It never stands in the way: the first touch anywhere ends it and still reaches the screen underneath (a card flips, a button presses).
- It sits in the top open modal dialog (or the page). It waits for frames before it starts, and it is exempt from the iPhone motion kill.

**Where it plays**
- First ten words: `ring`.
- Flashcard start: `deck`. Flashcard end: `stars`, with the words learned out of the total. This replaces the old `alert`.
- Weak-word review start: `focus`. Weak-word review end: `stars`, with the points earned, and PERFECT at full marks.
- Study tab: `flame`. Opening it on a day that extends a streak of two days or more shows the streak, once a day.
- Groups: `trophy`, for a reached goal, once per device.
- Practice poker: `chips` for a win, `fold` for a loss.

`tests/ceremony.smoke.cjs` covers the count, score, touch-through, dialog host, the flashcard ending without an alert, the stars and streak days, every style, and reduced motion.

## A casino tab and plainer words (10.21.64.00)

A seventh tab, カジノ, with a poker-chip icon. It shows the balance as a chip and four tables: poker (moved here from the battle tab), and three house games, blackjack, roulette and dice poker. The rules live in `casino-model.js` with unit tests (`tests/casino-model.test.cjs`); the screen is `casino.js` and `casino.css`.

Money: signed in with the cloud reachable, a round takes its bet when it starts and pays the bet back plus winnings when it ends, each through `Poker.settle` under its own round key, so a round left half way still costs its bet and nothing is paid twice. A bet is at most 1,000pt and never more than the balance. Guests and offline play use 1,000 practice chips kept on the device. Roulette keeps a single-zero wheel's edge (1/37), blackjack pays 3:2 with the dealer standing on 17, dice poker is even money against a dealer who plays a fixed way.

The battle tab lost its two background photographs (`assets/battle/` is gone) and is one plain card. Motion in the casino is one-shot (deal, roll, wheel) and is exempted from the iOS animation kill like the poker table.

Wording: stiff or slogan-like labels were made plain (ログイン, ゲストで試す, 表示名, 要約を作っています…, 全文の和訳, 単語・意味で探す), decorative emoji in dialogs and toasts were dropped, and the usage guide lost sentences that described implementation history rather than use.

Validation: `node --test tests/*.test.cjs`, `node tests/casino.smoke.cjs`, the full smoke suite.

## Rare casino wins and clearer help (10.21.65.00)

A natural blackjack, a single-number roulette hit, and a dice-poker win with four or five of a kind play the chips moment over the game screen; ordinary rounds stay quiet. The points help explains that casino and poker change the balance directly and are not in the earned history. The usage guide's first steps match the current sign-up (a display name and a PIN), and the menu edge is a thin ivory line instead of a cyan glow.

## Today's casino total and a quieter flashcard setup (10.21.66.00)

The casino header shows today's running total (Japan time), kept on the device separately for points and practice chips. The flashcard settings dialog uses the ivory accent for its labels, the selected mode and the start button instead of alternating cyan and purple neon, and the word-book details button lost its chart emoji.

## Help for beginners at the tables (10.21.67.00)

Blackjack suggests a move each turn (the button glows, with one line on why, from a simple basic strategy). Dice poker lights the dice worth keeping and offers one tap to keep them. A win pops with a small burst of chips, and the balance runs to its new value with a short flash. The casino tables rise in one after another when the tab opens. English eyebrow labels over Japanese headings (VOCABULARY, LIBRARY, CASINO, TEXAS HOLD'EM, HOW TO PLAY, HOW TO USE, MY VOCABULARY) are gone.

## Word battle in the users tab; a roulette table like the felt (10.21.68.00)

The 単語バトル tab is gone: word battle is the third segment of the users tab (ユーザー・グループ・単語バトル), so the bar has six tabs. Roulette now fits on one phone screen without scrolling. The wheel sits beside the last result and the last eight numbers, and the table is laid out as on felt: 0 on the left, three rows of twelve with 3 … 36 on top, the row bets (列, pays 3×) on the right, the dozens and the even-money bets underneath, each with what it pays.

## Dice poker against a friend (10.21.69.00)

Dice poker has a second mode, フレンドとタイマン: one player makes a table with a bet and gets a 4-digit number, the friend enters it, and the round starts. Both bets leave the wallets once per round, each player rolls their own dice (two re-rolls, kept on the device so a reload cannot roll again), and the other player's dice stay hidden until both have stood. The better hand's owner pays themselves both bets; a tie gives each their bet back; every wallet is moved only by its owner, once per round key. Both must agree to a rematch. If a player leaves mid-round, the one who stays gets their bet back. The table is stored with the poker tables (marked `kind: "dice"`), so it needs no new cloud rules, and poker refuses a dice table's number.

## Poker settings by tapping, play on after losing, casino at the right (10.21.70.00)

The poker lobby has two tabs, コンピュータと and みんなと, and every setting is a row of buttons instead of a drop-down. Practice can now set the starting chips (50–500) and the blinds (1/2 up to 10/20). Creating a table shows a live check of the entry and blinds, with quick amounts. Running out of chips no longer means setting up again: in practice, チップを足して続ける tops up and plays on against the same computers, and at a real table a rebuy restarts play by itself instead of waiting for the host. The flashcard start no longer plays the deck animation (the end result stays), and the casino tab is the rightmost tab.

## The friend lobby fits the phone (10.21.71.00)

The 4-digit number box's natural width pushed the friend lobby wider than an iPhone screen, which cut off the bet amount, the last chips and the buttons. Bet bars now use a single `minmax(0, 1fr)` column and the box fills its row, and the smoke test checks that nothing in the lobby passes the screen edge. The mode reads フレンドとタイマン.

## Lending points between users (10.21.72.00)

ポイントの貸し借り opens from the points dialog or from another user's profile (貸す / 借りたいと頼む). Per person it shows where the two stand, requests waiting for an answer (貸す・払う / 断る), the actions (貸す, 返す up to what is owed, 借りたいと頼む, 返してと請求 up to what is lent) and the shared history, newest first. The rules are in `point-loans-model.js` with unit tests; `point-loans.js` moves the points inside one transaction with the record and collects anything sent to this account once, when the app starts (one inbox read) and when the screen opens. See docs/security.md for the storage.

## The lending screen in the points dialog's frame (10.21.73.00)

On an iPhone the lending screen showed only its title: its body was a flex item growing from zero inside a dialog without a fixed height, which Safari left at zero. The screen now uses the points dialog's own frame (`.study-points-dialog`): the dialog scrolls as a whole, and its buttons, borders, gold numbers and type match the points screen it opens from. Names in the title keep their case.

## Blackjack and roulette with friends (10.21.74.00)

Blackjack and roulette have a second mode, フレンドと一緒に: up to six people at a 4-digit table, all playing the house rather than each other. Roulette: each places their own chips and confirms (the bet leaves their wallet then), the table's maker spins, and each device pays its own owner what their bets won; the table still fits one screen, with everyone's bets listed beside the wheel. Blackjack: each joins the game with their own amount, the maker deals one shared dealer and a hand per player (`tableDeal` in `casino-model.js`, with unit tests), players act in turn (the maker can skip someone who is away), the dealer draws to 17 last, and each settles their own hand. Every move of points is keyed per table, round and part, so a redraw never pays twice. A player leaving before play gets their bet back; leaving mid-hand drops their hand; the maker leaving closes the table and returns every unsettled bet. The roulette board, chip picker and wheel are now shared helpers used by both modes.

## Together and one-against-one everywhere it makes sense (10.21.75.00)

Each house game's switch now reads ひとりで / 一緒に / タイマン (roulette, which has no opponent, keeps ひとりで / 一緒に; poker is already a friends' table, and two seats under みんなと make it one-against-one). New: dice poker together (kind `dice-together`: each joins with a bet, rolls their own dice, and once all have stood the maker's device rolls for the dealer with `diceDealer`; the maker can go on without someone who is away) and blackjack one-against-one (kind `blackjack-duel`: the maker deals two hands with `duelDeal`, both draw at once, the other's cards past the first stay face down until both stand, `duelCompare` decides, and the winner takes both bets). The dice duel's lobby, rematch and refund are shared with it; a round left open is refunded when the other leaves, using the same per-round keys.

## Making a table: feedback and readable errors (10.21.76.00)

Reported: pressing テーブルを作る seemed to do nothing. Creating a table is a cloud transaction that can take seconds on a phone, the button gave no sign of it, the poker lobby's message sat below the how-to button, cloud errors arrived as English codes, and a failed table listener was silent. Now the create and join buttons in the poker, dice, blackjack and roulette lobbies read 作っています… / 入っています… until the cloud answers; `Poker.message` turns cloud error codes (permission-denied, unavailable, deadline-exceeded, resource-exhausted, aborted) into plain Japanese and keeps an unknown code in brackets; the message sits right under the buttons; a table listener error returns to the lobby with its message; and the friends' tables say which of login, connection or the cloud limit is missing.

## Blackjack like a casino table, with split and double; chinchiro (10.21.77.00)

Blackjack is one table model for alone and together (`tableDeal` … `tableOutcome` in `casino-model.js`; alone is a table with one seat). The dealer, the computer, starts with one card (the European rule) and turns the rest after everyone has played, drawing to 17; cards come out one at a time in dealing order (round the table, the dealer's card between) and the dealer's last. The moves are ヒット・スタンド・ダブル・スプリット, each with a plain sub-label and the usual move marked: double on a hand's first two cards, split a pair of the same value up to four hands, split aces take one card each, and 21 after a split pays even money. Each extra bet (a double, a split) is its own points key — the old solo double reused the round's bet key, so when signed in the extra was ignored by the once-per-key wallet. Chinchiro is new, with all three ways to play: the computer parent rolls first and settles at once on a decisive hand; children roll up to three times; multiples follow the hand (ピンゾロ 5×, ゾロ目 3×, シゴロ 2×, ヒフミ pays 2×; a bigger loss is capped at the balance). One against one is even money, stronger hand wins.

## Chinchiro against the house: about 4 wins in 10 (10.21.78.00)

Players won 47% of rounds against the computer parent (expected value about −0.6% of the bet), which felt too easy. Three house rules used at real tables now apply when playing the computer (alone and together): a child throws at most twice while the parent throws three times, ties go to the parent, and a parent with no hand (目なし) is no longer an automatic loss for the parent. A simulation in the unit tests checks that a child wins about 40% of rounds. One against one stays even between the two players.

## お知らせボックス, daily login bonus, thrown dice (10.21.79.00)

A bell at the top right of the header opens the お知らせボックス: today's login bonus first, then notices from the team, newest first, with 新着 on the ones this device has not seen. The bell's red badge counts unseen notices plus a bonus not yet taken today. Notices live in one document, `shared/notices` (`{ items }`, the latest 30), read when a signed-in account opens the app (at most every 30 minutes, the last copy kept on the device for the badge) and whenever the box opens; the admin tools have お知らせを配信 to post one (title up to 60 characters, body up to 1000) and 取り下げる to take one down, both as transactions on that document.

The login bonus is a wheel of six prizes (10, 50, 100, 200, 500, 1000pt) spun once per day in Japan time, for signed-in accounts. The prize is drawn inside the transaction that reads and writes `users/{id}/learningPoints/bonus` (`{ day, prize, at }`) and adds the prize to the wallet, so a second tap or another device that day gets the earlier result and nothing more. The bonus has its own document because the points sync rewrites the wallet document whole. Odds are 45% / 30% / 15% / 7% / 2.5% / 0.5% from 10 up to 1000 (66pt a day on average); they are shown under the wheel and are set in `notices-model.js`. A 500 or 1000 gets the chip ceremony.

Dice in the casino (dice poker, chinchiro, alone, together and one-against-one) are thrown rather than placed: each tumbles through random faces for about 0.65 s, the chinchiro bowl shakes, and they land one after another with a bounce on the numbers rolled. The hand's name, the hint and the result stay hidden until the dice have landed. With reduced motion the dice show their numbers at once.

Tests: `tests/notices-model.test.cjs` (prize weights, Japan day boundary, wheel stop angle, notice list) and `tests/notices.smoke.cjs` (bell placement, admin post and take-down, badge, wheel pays once into the wallet, second device refused, guest message, dice tumble and land on their numbers).

## The bonus wheel in 50 segments (10.21.80.00)

The login bonus wheel has 50 equal segments instead of six, and how often a prize comes up is how many segments it has: 1000pt 1, 500pt 2, 200pt 4, 100pt 8, 50pt 15, 10pt 20 (2% / 4% / 8% / 16% / 30% / 40%, about 91pt a day on average). Each prize's segments are spread evenly round the wheel, rarest first, so no two of the rare ones sit side by side; each prize has its own colour, brighter the rarer (1000pt red, 500pt gold). The transaction draws a segment, every one equally likely, and records it with the prize in `users/{id}/learningPoints/bonus`; the wheel stops on that segment. The odds under the wheel list the chance and the segment count. The counts are `COUNTS` in `notices-model.js`; the tests check that the slice under the pointer after the spin is the one paid.

## The bonus wheel turns on iPhones (10.21.81.00)

Reported: the login bonus wheel did not turn; it showed the result at once. On iPhones the stable-rendering rule turns off transitions and animations outside a short list of screens built for motion, and the notice box was not on it, so the wheel's CSS transition never ran. The box is now on the list, and the wheel no longer relies on a transition: it is driven frame by frame. It starts turning at the tap, speeds up, keeps running at full speed while the prize is drawn (no stop and restart when the answer arrives), then slows the way a real wheel does (an ease-out that begins at the speed it was turning, at least three more turns) onto the drawn segment. The pointer flicks back as each segment's edge passes, hard when the wheel is slow and only a tremble at speed. With reduced motion it goes straight to the segment. The smoke test spins it on a page marked as an iPhone and checks it turns and stops on the slice that is paid.

## Dice without a throwing animation (10.21.82.00)

On request the dice animation is gone: the tumbling, the shaking bowl and the landing added in 10.21.79.00, and also the earlier drop-in roll. Dice in dice poker and chinchiro (all modes) show their numbers at once, and the hand's name, the hint and the result show with them. The smoke test checks that thrown dice have no animation.

## Poker against the computer for points, one strength (10.21.83.00)

The poker lobby's computer table (now コンピュータと対戦) has no strength to choose: the computer always plays at the old ふつう, which was tuned so a simulated casual player wins about 40% of games heads-up. Signed in and online, the starting chips (50 / 100 / 200 / 500) are points: a game needs that many in the wallet, each finished hand's result is settled into the wallet once (the same `Poker.settle` keys as a real table, `practice:<createdAt>:<hand>`), and チップを足して続ける needs the buy-in again. Leaving in the middle of a hand (やめる, ×, or the screen closing) loses the chips that hand already took, so walking away from a bad hand does not undo it. A guest or an offline device still plays with practice chips. With more computers the table is harder to win outright, as before.

Test: `tests/poker-computer-points.smoke.cjs` (no strength choice, buy-in in points and refused above the balance, each hand settled into the wallet, leaving mid-hand loses the chips in it).

## Bookshelf texts lost at the next start (10.21.84.00)

Reported: texts saved to the bookshelf were gone. At start the app restores the last full backup in two steps: first the device keys stored in the backup (`restoreSaveStorage`), then the in-memory data (`applySavedMemory`). The second step keeps the reader's shelf, folders and history when this device changed them after the backup (the `aiglish_reader_local` mark), but the first step had already written the backup's old `myBookshelf`, `textHistory` and `myFolders` over the device copies, and the backup's old change mark over the new one. So a text saved after the last backup (one that had not been backed up yet, for example when the app was closed within a few seconds, offline, or while a study screen deferred the backup) was dropped at the next start. Now the first step skips those three keys when the device copy is newer, and never restores the change mark, which belongs to the device. Restoring a backup file still replaces the device copies (the mark is cleared before the keys are written). `tests/reader-save.smoke.cjs` now uses a backup that holds the device keys as a real one does; it failed before the fix.

## The warm-up's i, and the sticky note in the word sheet (10.21.85.00)

The first-ten warm-up's i opened a small box with only the word and its extra note. It now opens the same sheet as the regular flashcards' i: the word book's card for that word (meanings, ratings, note, 付箋, pronunciation). The sheet is placed inside the warm-up dialog (`openVocabDetailsSheet` takes `options.host`), since anything outside an open modal dialog sits behind it, and it closes with the warm-up. A word from another book than the open one is shown without its controls.

Reported: after i on a flashcard, the sticky note button did not respond. It changed the word and redrew the word list, but the card in the sheet is not part of the list, so the button never showed the change. The button and the card now show it themselves.

Test: `tests/warmup-details.smoke.cjs`.

## Word card titles split inside the word (10.21.86.00)

Reported: on a phone, a word card in an editable book showed "disregar / d". The title row leaves room on the right for the 付箋, edit and delete buttons, which on a narrow phone left the word about 40px, and the word was allowed to break anywhere (`overflow-wrap: anywhere`). The word and its speaker are now one group (`.word-title`) that breaks only between words, or inside one only when it cannot fit a whole line. On phones (430px wide or less) with the edit buttons, the number sits on the buttons' line and the word with its speaker takes the full next line. Test: `tests/vocab-card-wrap.smoke.cjs` (308, 375 and 430px).

## Sending an admin's own copy back to the distributed book (10.21.87.00)

An administrator can copy a distributed word book for themselves to change it freely or to turn on 用語・年号モード (a setting only own books had a switch for), and now send it back. In the admin editing mode (配信中の単語帳を編集する), an own book's ⋯ menu has 配信中の単語帳に反映: choose the distributed book (the one it was copied from is preselected; copies now record `copiedFrom`, and older copies are matched by name without 「（自分用）」), tick 用語・年号モード or not, and 全員に反映. One transaction replaces the book's words in `shared/vocab_<id>` and sets or clears `termMode` on its entry in `shared/textbooks_index`, which is where everyone's app reads the mode from. Word numbers are kept, so everyone's ratings stay on their words. This device's cache of the distributed book is updated at once. Test: `tests/shared-book-editing.smoke.cjs`.

## Copies follow the distributed book (10.21.88.00)

Every user's own copy of a distributed word book now follows the admin's changes to it, words and 用語・年号モード alike. Whenever the distributed book changes (the admin editing mode's save, or 配信中の単語帳に反映), its entry in `shared/textbooks_index` gets a new `updatedAt` (`window.__touchSharedBook`). Each device reads that index at start anyway; for each own book copied from a distributed one (`copiedFrom`; copies made earlier are matched once by name without 「（自分用）」), it sets the copy's `termMode` to the book's, and when the book's `updatedAt` is newer than the copy's `sourceSyncedAt` it reads `shared/vocab_<id>` once and replaces the copy's words (device caches, the draft that the backup sends, and the open list if the copy is open and no study screen is). Ratings, notes and sticky notes are stored by word number and stay; a word the user changed in their copy takes the distributed version. An unchanged book costs no reads. Test: `tests/shared-book-follow.smoke.cjs`.

## The word stays beside its number (10.21.89.00)

Reported after 10.21.86.00: on a phone the word had moved to its own line under the number. It is back beside the number. On phones (430px wide or less) with the edit buttons, the 付箋, edit and delete buttons are smaller instead (30px wide, 18px icons), which leaves the title row about 50px more; the speaker moves under the word when the row is still short. A word too long for the space beside the number (such as "responsibility" on a 308px-wide screen) moves down whole rather than splitting. `tests/vocab-card-wrap.smoke.cjs` checks this at 308, 375 and 430px.

## Distributing a private book of the admin's own (10.21.90.00)

The admin editing mode's action on an own book is now 全員に配信・反映, and it works for any own book, also one kept 自分だけ that was never copied from a distributed book: its target list ends with ＋ 新しく配信する (preselected when the book is not linked to a distributed one). That adds a new entry (`shared_<uuid>`, the book's name without 「（自分用）」, its cover, 用語・年号モード) to `shared/textbooks_index` and writes its words, in the same transaction as before; the own book is linked to it (`copiedFrom`), so later edits go out with the same action, and the new distributed book stays out of the admin's own list. Everyone else's ratings, notes and sticky notes are kept by word number whenever a distributed book's words are replaced. Test: `tests/shared-book-editing.smoke.cjs`.

Also: closing the warm-up closed the word sheet even when it had been opened afterwards outside the warm-up (the warm-up's close event can come after its exit animation). It now closes the sheet only when the sheet is inside the warm-up.

## Units: separate runs, 目次, editing (10.21.91.00)

Reported: two units with the same name in different places were shown as one unit spanning everything between them. A unit is now an unbroken run of numbers with one name (`VocabOrder.units`); the same name further on, or after a word without a unit, is a separate unit with its own `key` (name and first number). The list's chips, the flashcard settings and the battle's unit choice all pick a run by key and filter by its words, and the choices show each run's range.

目次 (the first chip) opens the units like a book's contents: each with its range, size and share of ○, opening its words. In an editable book each has 編集 for its name and range (`VocabOrder.editUnit`: the unit's words lose it, then the new range gets it, taking those words from any other unit) and 単元を外す. Units are part of the book's words (`unit`, kept by `stripVocabProgressFromWords`), so on a distributed book a changed unit reaches everyone and their copies the same way as changed words. Tests: `tests/vocab-order.test.cjs`, `tests/vocab-units-order.smoke.cjs`, `tests/shared-book-follow.smoke.cjs`.

## Seldom-used meanings (10.21.92.00)

A meaning can be marked あまり使わない意味 (`minor: true` on the meaning): a checkbox under each meaning in the add form and the word's edit form, or 「［まれ］」 at the start of a meaning in a pasted list. On the word card the main meanings come first, then a small heading and the seldom-used ones in smaller text. Each still has its own rating, gets its own flashcard (labelled あまり使わない意味 under the card) and its own questions in battles, like any meaning. The flag is part of the book's words (`stripVocabProgressFromWords` keeps it, and the merges of ratings into words keep it), so it is saved, backed up and reaches everyone with a distributed book; it is not part of the word's signature, so marking a meaning keeps its rating. Test: `tests/minor-meanings.smoke.cjs`.

## 用語・年号モード: no 「」 on cards, questions without odd line breaks (10.21.93.00)

On the word card of a 用語・年号モード book the 「」 around a term are no longer shown: the term is the marker itself (coloured by its results, or a thin gold underline before it has any). The text stays as typed, with the 「」, in the edit form, since they mark the terms.

Question text on flashcards and in battles (`TermQuestions.show`) keeps the headword (when short), a year ("1582年"), the blank "（＿＿）" and "（何年？）" whole on one line, puts each description line of the whole-entry question on its own line, and uses strict line breaking so a line does not start with a closing bracket or small kana. Before, the card text could break anywhere, including inside the year or the blank, and the whole-entry question's lines ran together. Test: `tests/term-mode.smoke.cjs`.

## Ratings kept when a word's meanings change; hidden distributed books come back (10.21.94.00)

A rating record is matched to its word by a signature (number::headword::meanings). Any change to a meaning's text, such as the admin correcting a distributed book or adding 「」, made the record not match, so that word's ratings showed as unrated (notes and sticky notes, kept separately, stayed) and were lost at the next save. Records now stay with a word while its number and headword are the same (`window.sameWordSignature`, used where records are read back: opening a book, the other-book merge, battles, the weak-word review, the reader's colours and the warm-up queue). Ratings are per meaning id, and meaning ids stay when meanings are edited or pushed from a copy. A different word in that number still starts afresh.

A distributed book taken off the list (by default when copying it for oneself) can now be brought back: 非表示の単語帳 (renamed from 非表示の自分の単語帳) lists hidden distributed books, marked 配信中, with 一覧に戻す. Before, the list showed only one's own books, and an unhidden distributed book only reappeared after the index was read again. Tests: `tests/shared-book-follow.smoke.cjs`, `tests/shared-book-editing.smoke.cjs`.

## 用語・年号モード on a distributed book itself (10.21.95.00)

In the admin editing mode, a distributed book's ⋯ menu has 用語・年号モードにする / 用語・年号モードをオフにする: a transaction sets or clears `termMode` on its entry in `shared/textbooks_index` (where everyone's app reads it) and stamps `updatedAt`, so copies follow. Units already worked on the original in this mode (the unit form and 目次 save through the admin's direct publish of the book's words, which also stamps the index); the test now covers both. So the original can be edited with units and 「」 terms without copying it first. Test: `tests/shared-book-editing.smoke.cjs`.

## Devices pick up the admin's changes to a distributed book (10.21.96.00)

Reported (and confirmed): a device that had opened a distributed book once kept reading its own copy (`VocabMaster.resolve` prefers the local draft, the user copy and the cache), so later changes by the admin never reached it; only devices opening the book for the first time read `shared/vocab_<id>`. Now each change to a distributed book stamps its index entry's `updatedAt` (the admin editing mode's save, 全員に配信・反映, the mode switch), and a device compares that with the time it last read the book (`core_v4_shared_synced_<id>`): when the book is newer, opening it (and, at start, the book that is open) reads its words once and replaces the device copy, the cache and the master of the local draft. Ratings, notes and sticky notes are stored apart and stay (with 10.21.94.00, also when meanings changed). An unchanged book costs no read, and the admin's own device is stamped by its own save. Guests get it too. Test: `tests/shared-book-refresh.smoke.cjs`.

## 用語・年号モード flashcards follow the chosen direction (10.21.97.00)

Reported: in an English book with 用語・年号モード, choosing 和訳 (英→日) still showed the Japanese first. The mode forced every card question-first, and the whole-entry card's question is the meanings, so the word came second. The whole-entry card (the word and its meanings) now follows the chosen direction like any card: 英→日 shows the word first, 日→英 the meanings. Blank and year cards are questions with one answer and still show the question first (`questionFirst` on the card). Test: `tests/term-mode.smoke.cjs`.

## Casino tables with friends no longer stall (10.21.98.00)

Reported: at タイマン and 一緒に tables, buttons sometimes did nothing and cards were sometimes never dealt, so the game could not go on. Found and fixed:

- **Blackjack タイマン never dealt the second round.** The deal flag stayed set after the first deal, so after もう一勝負 the table sat on 「カードを配っています…」. The deal now happens once per round, from either player's phone (the cloud keeps only the first), and a 「もう一度配る」 button appears while waiting.
- **Chinchiro tables could never send a hand.** Each throw was stored as a list inside a list, which Firestore refuses, so starting a 一緒に chinchiro table and sending a finished タイマン hand always failed silently. Throws now travel as `"3,5,5"` (`chinUp` / `chinDown`). A finished hand that did not get through is sent again automatically, with a 「結果を送る」 button.
- **Dice 一緒に waited on the maker's screen.** Only the table maker's device rolled for the dealer. Now any device that sees every hand in rolls it (the transaction keeps one roll), and a 「ディーラーを振る」 button is there too. A player passed over by 待たずに進める gets their bet back.
- **Buttons failed silently.** Every table button now goes through `send()`: it shows 「送っています…」, explains a slow answer after 8 seconds, and shows the reason under the button when the cloud refuses, then works again. A bet the table holds is taken from the snapshot too, so a lost answer cannot leave it unpaid.
- **Play waited on the maker.** 「次へ」, 「次のゲーム」 and 「〜さんを飛ばす」 can be pressed by anyone at the table.

The fake clouds in the casino and poker smoke tests now refuse nested lists and `undefined` like Firestore does. New checks: a blackjack duel deals round 2, the group dice dealer is rolled by a non-maker while the maker's phone is quiet, and a chinchiro hand that failed to send is shown and resent.

## Chinchiro less plain, dice still without animation (10.21.99.00)

Reported: チンチロ felt too plain. The dice stay as asked in 10.21.82.00: they show their numbers at once and do not move. The look carries the game instead:

- The table is a lacquered red, and the bowl is deeper, with an indigo rim.
- The three dice lie slightly turned where they fell, not in a neat row.
- The hand is stamped across the bowl, pressed down briefly on a fresh throw. Rarer hands get louder stamps: 役なし and 目なし grey, a point in gold on black, ヒフミ blue, シゴロ red, ゾロ目 and ピンゾロ gold with a glow.
- On シゴロ or better the seat glows once.
- Earlier throws show as small dice instead of text.

The motion is skipped when the device asks for reduced motion. The notices smoke test still checks that thrown dice have no animation.

## 苦手復習 no longer cut short by a word with many meanings (10.22.00.00)

Reported: a word test (苦手復習) showed only about five questions. `reviewPlan` never put the same word twice in a row, and it stopped as soon as only one word had meanings left. That word's other weak meanings were dropped from the round. A word with six weak meanings gave one question, and four on one word plus one on another gave three questions out of five. Now another word still comes between two meanings of one word whenever there is one. Once only one word is left, its remaining meanings come one after another, up to the 20 questions of a round.

Which meanings count is unchanged: those marked × or △ before today. A meaning first marked today comes the next day.

Test: `tests/weak-review-model.test.cjs` (a dominant word keeps all its meanings, a single word gives every meaning oldest first, a round stops at 20).

## 用語・年号モード cards filtered by understanding go by the list's ratings (10.22.01.00)

Reported: with a distributed book in 用語・年号モード, narrowing 単語カード by understanding (for example × only) gave about five cards. In this mode every question keeps its own record. A question not yet answered in the mode counted as 未学習, even when its meaning showed × or △ in the word list. So ratings made before the admin turned the mode on were ignored by the filter, and only the few questions answered since remained. Now a question with no record of its own goes by its meaning's rating (`getFlashcardMeaningStatus`). A question's own record still wins. 単語バトル's status filter applies the same rule.

Test: `tests/term-flashcard-filter.smoke.cjs` (× only: questions without a record follow their meaning's ×, one answered ○ is left out; the old code gave an empty deck).

## 用語・年号モード: one card per meaning (10.22.02.00)

Reported: in 用語・年号モード a word set up with one card per meaning came out as a single card. The whole-entry question joined every line of an entry into one card, which suits a history entry but folded a word's separate meanings together, so a narrowed range gave far fewer cards than in the normal mode. Now each line (meaning) gives its own whole question: that line shown, the headword answered. This is one card per meaning, as in the normal mode. Year and 「」 questions are unchanged. An entry with one line keeps the key `w`, so its record stays. Entries with several lines use `w:<meaning id>`, and until they are answered they follow their meaning's rating (10.22.01.00).

Tests: `tests/term-questions.test.cjs` (one whole question per line, single-line key kept) and `tests/term-flashcard-filter.smoke.cjs` (a two-meaning word gives two cards, each showing its own meaning).

## Meanings can take line breaks (10.22.03.00)

Reported: meanings that put a phrase and its Japanese together (「A be followed by B」Aの次にBが続く) wrapped mid-phrase and were hard to read. A meaning's box, in the add dialog and in the inline editor, is now a text area: Enter adds a line break, and the box grows with its text. Each line is trimmed and empty lines are dropped (`cleanMeaningText`). The word list (`.vocab-meaning-text`) and flashcard faces show the breaks with `white-space: pre-line`. In 用語・年号モード questions already break at a newline (`TermQuestions.show`). The line-based paste import is unchanged: one line is one word.

Test: `tests/term-mode.smoke.cjs` (Enter twice and trailing spaces are saved as one break, the box grows, the list shows two lines).

## 総獲得ポイント and its ranking (10.22.04.00)

Requested: a total of points ever earned, with a ranking. The wallet (`users/{id}/learningPoints/main`) gains `earned`, and the user document gains `earnedPoints`, written in the same transaction as the balance.

What counts:
- Study awards (in `StudyPoints.flush`) and the daily bonus (`notices.js`) add to it.
- Casino and poker results (`Poker.settle`) and point loans do not, so it never goes down and shows how much someone has studied.

The total did not exist before, so `backfillEarned` adds up every study award once from the per-day award records (`reviewPointDays`) before the first flush that counts. Until then the transaction leaves `earned` unset, so nothing is counted twice or lost. A device that finds the wallet already counted takes its total and reads no records. Daily bonuses from before are not in those records and are not included. A guest's total is kept on the device.

The study flush wrote the wallet without merge, which dropped the `poker` map of settled casino and poker keys; that map is now carried over.

Screens:
- The points dialog shows 総獲得ポイント under the balance.
- The ranking's ポイント mode has a second podium, 総獲得ポイント (`earnedPoints` is in the projected fields).
- The detail dialog lists it too.

Tests: `tests/study-points.test.cjs` checks the one-time count from the records, growth with later awards, the poker keys being kept, and a second device taking the cloud total without reading. `tests/notices.smoke.cjs` checks that the bonus adds to the total. The ranking smoke tests check the second podium.

## 「」 cards: the term alone, the rest behind (10.22.05.00)

Requested: a 用語・年号モード card made from a 「」 term shows only the term; turned over, the headword and, on the next line, the rest of that meaning without the term. For 「A be followed by B」 + Aの次にBが続く under follow: front "A be followed by B", back "follow" / "Aの次にBが続く". Blank questions gain `front` and `back`, which 単語カード uses. Other 「」 terms in the line are shown plain, and the year stays with the headword. 単語バトル keeps the blanked sentence and the term as before, so its same-kind choices are unchanged.

Tests: `tests/term-questions.test.cjs` (the user's example; only the asked term is taken out) and `tests/term-mode.smoke.cjs` (card fronts and backs).

## 「」の問題だけ出す, chosen per meaning (10.22.06.00)

Reported: in 用語・年号モード a line such as 「following」 次の under follow gave a "which headword?" card (front: follow, back: 「following」 次の), which is not one-to-one because the 「」 is a different phrase. When adding or editing a word in this mode, each line now has a checkbox, 「」の問題だけ出す, stored as `blankOnly: true` on the meaning:
- With it, the line gives no whole question, only its 「」 cards (and its year card, if any).
- A line without any 「」 is unaffected, so it still gets its whole card.
- Without it, the line works as before, for books where the 「」 is just part of the description.

The flag is kept wherever meanings are copied: the master, progress merges, shared and copied books, and the add form.

Tests: `tests/term-questions.test.cjs` (no whole question for a flagged line that has a term) and `tests/term-mode.smoke.cjs` (checkbox in the editor, the flag kept in the saved words, the questions without the whole card).

## 「」 cards follow the card direction (10.22.07.00)

Reported: with 「」の問題だけ, the cards came out the wrong way round. In 表：英単語を先に the card still started from the 「」 phrase, which is part of the meaning. 「」 cards no longer always show their question first. They follow the chosen direction like the whole-entry card:
- 英単語を先に: the headword and the rest of the line in front, the 「」 term behind.
- 意味を先に: the term alone in front, the headword and the rest behind.

Year cards are typed, so they still show the question first.

Test: `tests/term-mode.smoke.cjs` (a 「」 card's front in each direction).

## 「」 cards: the term on the English side (10.22.08.00)

Reported: 10.22.07.00 had the two sides the wrong way round. The 「」 term is the English, so 英単語を先に now shows it alone in front, with the headword and the rest of the line behind (A be followed by B → follow / Aの次にBが続く). 意味を先に shows the other way round.

Test: `tests/term-mode.smoke.cjs`.

## Part of speech per meaning in every book; links between words (10.22.09.00)

Requested: a part of speech for each meaning, and links to other words (synonyms and the like).

**Part of speech.** Each meaning already had a part-of-speech select, but 用語・年号モード hid it in the add dialog and the editor. It is shown there now; in the editor the description takes its own line. The word list shows a meaning's part of speech as a small label before its text (`.vocab-meaning-pos`, from `getFlashcardPartOfSpeech`).

**Links.**
- A word keeps `links: [{ num, kind }]`, where kind is `syn` (同義語), `ant` (反意語) or `rel` (関連), up to 20.
- **Adding:** in the editor, under 関連する単語, pick the kind and type the other word's headword or number. A word not in the book, or the word itself, is refused in plain words.
- **Both ways:** saving puts the same link on the other word, and taking one off removes it there too.
- **On the card:** links show as buttons grouped by kind; tapping one opens that word's card in the detail sheet, where its own links work the same way.
- **Kept:**
  - Links point at the permanent `num`, so they survive edits and renumbering.
  - `stripVocabProgressFromWords` keeps them.
  - Copying a book (自分用に追加) maps them to the copy's new numbers.
  - They are not part of the word signature, so ratings stay matched.

Test: `tests/word-links.smoke.cjs`.

## Phrase lines: one card each way, no settings (10.22.10.00)

Reported: a 「」 marking one word inside a pattern (consider: + A + 「as」 B / AをBとみなす) became a card showing "as" alone. Setting each meaning by hand (「」の問題だけ出す) was also a chore.

A **phrase line** is now recognised automatically: English with its 「」 on the first line and Japanese on the next, or a leading 「…」 directly followed by Japanese (「following」次の). A line whose 「」 is Japanese, as in history books, is not one. A phrase line gives one card (key `t:<meaning>:0`, so its record stays) and no "which headword?" card:
- **英単語を先に:** the English line in full, with the headword added when the line does not contain it → the Japanese.
- **意味を先に:** the headword, the English with its 「」 blanked (left out when the 「」 is the whole English) and the Japanese → the 「」 and the English line. These are the card's `reverse` fields.

So "as" is never asked alone, and 「following」 / 次の works in both directions. Other 「」 lines keep their earlier behaviour. 単語バトル still uses the blanked sentence and the term.

Test: `tests/term-questions.test.cjs`, with the user's examples.

## A simpler add-word form (10.22.11.00)

Requested: the add form asked for too much setting and too much thinking. Each meaning is now a numbered box, and:
- **Part of speech:** one-tap chips (名 動 形 副 前 接; tap again to clear) instead of a list. The other parts of speech are in the word's editor.
- **あまり使わない:** a まれ chip instead of a checkbox.
- **Year:** written at the start of the line (1192 「鎌倉幕府」を開いた). The separate year box is gone; the line was already stored that way.
- **「」の問題だけ出す:** the checkbox is gone. Phrase lines decide their cards automatically (10.22.10.00), and the editor still has the checkbox for other lines.
- **「」で囲む:** in 用語・年号モード this button wraps the selected words in 「」, or puts 「」 at the cursor.
- **Preview:** under each meaning, the cards it will make are shown as typed (front → back), taken from the same `TermQuestions.questions` as the cards.
- **Duplicates:** a word already in the book is pointed out with its number. Adding it again is still allowed.
- **続けて追加する:** remembered per account.

Tests: `vocab-entry`, `minor-meanings` and `term-mode` smoke tests use the chips, the まれ chip and 「」で囲む, and check the preview.

## メモ and the rating history on one line (10.22.12.00)

Requested: put the rating history to the right of メモ to make cards more compact. The history (`[data-vocab-history]`) now sits in a `.vocab-note-head` row with the メモ button at the foot of each word card. The memo text and its editor still open full width below. The history keeps its element, so updates after a rating work as before. The card loses a separate row and a dashed rule.

## "+" patterns join the headword; the headword in bold (10.22.13.00)

Requested: expect with + to V showed "expect" and "+ to V" on two lines; it should read "expect to V". The headword should also be bold.
- **Joined patterns:** a phrase line whose English starts with "+" now joins onto the headword without the plus signs, on one line. + to V → expect to V; + A + 「as」 B → consider A as B. This applies to both sides of the card and to the blanked form (consider A （＿＿） B).
- **Bold headword:** on 用語・年号モード cards the headword is bold wherever it stands as a whole word (`TermQuestions.show(node, text, head)`), and the rest of the text is normal weight so it stands out.

Test: `tests/term-questions.test.cjs` (consider A as B, expect to V).

## Derived words without the headword above them (10.22.14.00)

Reported: a phrase card for increasingly (under increase) showed "increase" above "increasingly". The headword was added whenever the English line did not contain it exactly. Lines written with "+" now join onto the headword (10.22.13.00), so the 英単語を先に side shows the English line as it is. The 意味を先に side still starts with the headword. Test: `tests/term-questions.test.cjs`.

## English over Japanese is a phrase line even without 「」 (10.22.15.00)

Reported: consider's line "considering / Vしようかと思う" still gave a "which headword?" card (consider → considering Vしようかと思う). That line had no 「」, so it was not a phrase line. A first line of English with no Japanese, above Japanese, is now a phrase line on its own: the whole English line is what is asked (considering ↔ Vしようかと思う), and there is no headword card. 「」 is needed only to ask for part of the English (+ A + 「as」 B). A Japanese-only line such as 〜を考慮する keeps its headword card. Test: `tests/term-questions.test.cjs`.

## A Gemini prompt for English word books, and an import that merges (10.22.16.00)

Requested: a prompt for Gemini that turns a photo of the word book into the format the cards use, since doing it by hand does not scale.

**The prompt.** The word-book editor has a second prompt button: 英単語帳（熟語・派生語・語法を意味ごとのカードに）用. The prompt asks for `{"words":[{num, word, meanings:[{text, pos, minor}], sub}]}`, with these rules:
- One meaning per card. The headword's own meanings are in Japanese only.
- Phrases, derivatives and patterns are English over Japanese.
- 「」 marks only the part to ask; patterns start with "+"; ( ) is written out.
- `pos` is one character per meaning.
- Notes (★ cautions, MINIMAL PHRASES, examples) go to `sub` without repeating the cards.

The prompt ends with a follow / consider example taken from the user's page.

**The import.** `parseVocabImport` accepts that object, even inside a code block, through `importAiWords`:
- Each meaning gets an id (`num-k`), its part of speech, its line breaks and まれ.
- Only the numbers given are added or replaced; a replaced word keeps its unit, display number and links.
- Unreadable JSON is refused in plain words.

A JSON array is still a full replacement (a backup restore).

Test: `tests/ai-import.smoke.cjs`.

## Poker: any buy-in and blinds (10.22.17.00)

Requested: poker stakes should be freely settable.

- Computer table: the buy-in buttons (50–1,000) now have a number box below them for any amount from 20 to 100,000. It must also be at least 10× the big blind. A typed amount matching a button lights that button.
- Blinds on both the computer and friends tables: a 「自由」 choice opens a box for the big blind (2–10,000); the small blind is half of it. The friends table's live check shows any problem before 「テーブルを作る」.
- Points rules are unchanged: a staked buy-in still cannot exceed the balance.

Test: `tests/poker-practice.smoke.cjs` types 333 chips and a 自由 big blind of 8, then checks the table settings are 333 / 4 / 8.

## Casino: すごろくビンゴ (10.22.18.00)

Requested: a long-running medal-game style game with jackpots, played with points (no medals).

- `sugoroku-model.js` holds the rules with no screen, and every number lives in `RULES` so amounts and the line-up can be tuned later.
  - A roll costs 10, 50 or 100. The piece goes round a 24-square ring, the square's number is marked on a 5×5 card (the middle is free), and the square's effect happens: points, a free roll, more squares, or one random number marked.
  - A new line spins a 10-slot roulette. Its prizes are multiples of what was bet since the last line; several lines at once share it.
  - One slot leads to the JACKPOT CHANCE roulette, which has the jackpot and a slot leading to the SUPER JACKPOT CHANCE roulette.
  - The two jackpots are the player's own pools. 3% and 1% of each bet go into them, and a win resets the pool to its seed (100 / 1,000).
  - A full card starts a new one.
- Measured over 2 million rolls: about 92% of the bet comes back.
  - A line comes about every 4.3 rolls and a card is done in about 51 rolls.
  - A jackpot comes about every 360 rolls and a super jackpot about every 4,000.
- `sugoroku.js` draws it in the casino screen and uses the casino wallet (points, or practice chips for guests).
  - A roll is worked out, saved and paid before the board plays it, so closing half way loses nothing.
  - Progress is kept on the device and, with points, in `users/{id}/sync/sugoroku`. The copy with more rolls wins.
  - Tapping the board fast-forwards.

Tests: `tests/sugoroku-model.test.cjs` (moves, squares, laps, line base, jackpot reset, return rate) and `tests/sugoroku.smoke.cjs` (board, rolls pay and save, resume, a line spins the roulette).

## すごろくビンゴ: preview on practice chips only (10.22.19.00)

The game will be shown to everyone as a preview before its design is settled, so it must not change anyone's points. `real()` in casino.js is false while すごろくビンゴ is open. Its bets, payouts, balance and saving then use practice chips on the device, even when signed in; the other casino games are unchanged. `tests/casino.smoke.cjs` rolls while signed in and checks the wallet stays at 240pt.

## すごろくビンゴ, second design, and the casino's shared jackpots (10.22.20.00)

Rebuilt from the agreed design. Every amount is in `RULES` in `sugoroku-model.js`.

**The board** has 50 squares: START, normal, 6 event and 5 accident.
- **Normal:** a 24-slot wheel of ×3 / ×2 / ×1.5 / ×1.25 / ×0.75 / ×0.5 / ×0.25 / ×0.1 / ×0 and ball slots.
  - The die is the same for every bet. A bigger bet only gets a different wheel with more ball slots: 1, 2 or 3 of 24.
- **Event:** blackjack, dice poker, chinchiro or a sure ball.
  - A game is played once for the bet, with the existing CasinoModel rules and small tables on this screen.
  - A win pays bet × (1 + the game's multiple) and gives a ball. A push gives the bet back, and a loss gives half back.
  - A sure ball pays ×1.5.
  - The game's round is saved in `state.pending` after every move, so leaving does not re-deal it.
- **Accident:** lose 0–2× the bet, or go back to START. In the preview it takes at most the chips there are, so there is no debt.

**Laps and the card**
- A lap gives a ball and a prize that does not depend on the bet: min(20, 5 + ⌊√laps / 2⌋).
- A ball opens one closed number on a 7×7 card (48 numbers and FREE, 16 lines).
- A new line spins the bingo wheel (20 slots) on what was bet since the last line.
- Its two JP CHANCE slots lead to the jackpot wheel: 2 JACKPOT, 2 SJP CHANCE, 16 multiples. The SJP wheel has 2 SUPER JACKPOT slots. Every chance is one in ten, as asked.

**Simulation** (1M rolls per bet, event games played the plain way):
- Return about 95.5–96% for each bet.
- Bingo about every 20 / 17 / 14 rolls and a JACKPOT about every 2,100 / 1,700 / 1,350 rolls at 10 / 50 / 100.

**Shared jackpots** (`casino-jackpot.js`)
- Every point bet in the casino goes through `Poker.settle`. Its negative moves are added to `shared/casino_jackpot.bet`.
- Each device sums them and sends about once a minute; the total is read at most once a minute.
- JACKPOT = 1,000 + 3% and SUPER JACKPOT = 10,000 + 1% of the total since each was last won.
- Both are shown at the top of the casino tab and on the game.
- In the preview a jackpot only plays its effect; nothing is paid or reset.

**The screen**
- Calm by default: dark felt, ivory serif figures, one gold line.
- Darker and gold only for BINGO, the jackpot wheels and a jackpot.
- The wheels are round SVG wheels. The track is a strip that keeps the piece in the middle.

Tests:
- `tests/sugoroku-model.test.cjs`: shape, each square, lap, line base, jackpot chain, return under 100%.
- `tests/sugoroku.smoke.cjs`: card, track and jackpots; pay and save; resume; an event game kept and settled; a line spins BINGO.
- `tests/casino.smoke.cjs`: a 60pt blackjack bet adds 60 to the shared total.

## すごろくビンゴ: livelier, one screen, harder laps (10.22.21.00)

Feedback on the second design: the wheels clumped the same values together, the screen was too plain, the die needed a full animation, laps came too easily, and the game did not fit one screen.

- **Wheels.** `spread()` in the model lays every wheel out so the same slot is spread round it instead of side by side; the model test checks no normal slot sits next to its twin.
- **Colour.** Each slot is coloured by worth:
  - gold ×3, champagne ×2, emerald ×1.25–1.5, dark green ×0.5–0.75, charcoal ×0.1–0.25, wine ×0, ivory for a ball
  - each event game has its own colour
  - The rim has 24 lamps that run while the wheel turns and flash on the result.
  - The result pops in its slot's colour.
- **Board.**
  - Card numbers are round chips; opened ones are ivory and a finished line is gold.
  - Squares are tinted by kind (★ event, ! accident).
  - A brass piece hops along the strip.
  - The jackpot plates get a slow shine.
- **Die.** A 3D cube with pips tumbles about two turns, is tossed up and lands on its number.
- **Harder laps.**
  - The ring is now 80 squares (9 events, 7 accidents), about 23 rolls a lap.
  - The accident wheel adds "3マス戻る".
  - The normal wheels were re-tuned so each bet still returns about 96% (1M-roll simulation: 96.2 / 95.8 / 95.6%).
- **One screen.**
  - The card takes the height that is left (100dvh − 350px), the rules moved behind a "?" button, and the counts are one line.
  - The roll button sits inside 375×667, 375×740 and 390×844; the smoke test checks it.
  - The counts line is `.sg-status`, because style.css forces every class containing "info" into a column.

## すごろくビンゴ: START gives only a ball (10.22.22.00)

As asked, the lap prize is gone. Passing START now gives one ball and nothing else, and the "◯周目" count is no longer shown.

Without the lap prize, 10-chip rolls dropped to about 88%. The 10 and 50 normal wheels were re-tuned to make up for it. A 1M-roll simulation now gives 96.5 / 96.7 / 95.1% for 10 / 50 / 100.

## 「」の問題だけ in ordinary word books (10.22.23.00)

Reported: a meaning set to 「」の問題だけ (「consideration」 / 考慮、思いやり under consider) still came up as an ordinary card, with the headword "consider" on the front.

The setting and the 「」 cards were only used in 用語・年号モード. In an ordinary book every meaning became a headword card.

Now `startFlashcardSession` in an ordinary book handles a meaning with `blankOnly` like 用語・年号モード does:
- It gives the same 「」 cards (`TermQuestions.questions`, kind "blank").
- Each card carries `termCard` for the bold-headword display and the 意味を先に side, but no `termKey`, so its ○△× is recorded on that meaning as usual.
- A meaning without the setting, or without a 「」, stays an ordinary card.

Test: `tests/blank-only-flashcard.smoke.cjs`.

## すごろくビンゴ: balls drawn from 1–100 (10.22.24.00)

As asked, a ball no longer always lands on the card.

**The card and the draw**
- The card holds 48 different numbers from 1–100.
- A ball is drawn from 1–100 and rolls in on screen. If its number is on the card and still closed, it flies into that square.
- Otherwise (not on the card, or already open) it greys out and pays 1.5× the bet (`RULES.missPay`), with nothing else.

**Re-tuning**
- With the miss payout the return went to 115–122%. A normal wheel's ball slot now gives only the ball (it no longer pays the bet back too), and the normal wheels were lowered.
- 1M-roll simulation: 97.4 / 96.6 / 95.6% for 10 / 50 / 100.

**Cost of the change:** lines are much rarer, so the jackpot chances are rarer too.
- Bingo comes about every 210 / 170 / 140 rolls and a JACKPOT about every 22,000 / 14,000 / 16,000 rolls.
- `RULES.numbers`, `missPay` and the ball slots are the levers if this is too slow.

**Tests**
- The model tests draw exact numbers: hit, off the card, already open, the 1.5× on a missed event ball.
- The smoke test fixes the next crypto values to check a miss paying 75 on a 50 bet and a hit completing a line.

## English-over-Japanese meanings in ordinary word books (10.22.25.00)

Reported after 10.22.23.00: the card asking "as" for consider's "+ A + 「as」 B / AをBとみなす" did not come up.

In an ordinary book only meanings set to 「」の問題だけ got 「」 cards. A meaning written as an English line over a Japanese line still came up as a headword card ("consider" → the explanation). That is the format the guide says becomes its own card with no setting.

Now `startFlashcardSession` gives such a meaning its card in ordinary books too, exactly as 用語・年号モード does:
- It recognises a `TermQuestions` card that has a `reverse` side.
- 英単語を先に: "consider A as B" → AをBとみなす.
- 意味を先に: "consider A （＿＿） B / AをBとみなす" → as.

Other meanings, including a 「」 inside an ordinary explanation without the setting, stay ordinary cards. Every rating still goes to the meaning.

Test: `tests/blank-only-flashcard.smoke.cjs` now covers these cards and the 意味を先に side.

## 英単語を先に also asks the hidden word (10.22.26.00)

Asked: the hidden-word question (+ A + 「as」 B → as) should also come in 英単語を先に, as well as the plain English card.

When the direction is 英単語を先に, a card whose English line has only part of it in 「」 now comes as two cards:
- The English → the Japanese, as before.
- "consider A （＿＿） B / AをBとみなす" → "as / consider A as B". This is `hiddenTwin` in `startFlashcardSession`, using the card's `reverse` side as a question-first card.

This applies in 用語・年号モード and in ordinary books, and both cards are rated on the same meaning. A whole-line 「」 (「consideration」) or a bare English line still gives one card, and 意味を先に is unchanged.

Test: `tests/blank-only-flashcard.smoke.cjs`.

## すごろくビンゴ: one card for everyone, balls by player (10.22.27.00)

**The shared card.** The bingo card is shared by every signed-in player: `shared/sugoroku_card` = { cells, owners, people }.
- `owners[i]` is the id of whoever's ball opened cell i.
- `people[id]` is that player's name and a 40px icon shrunk from their avatar, kept only for ids still on the card.
- Each roll or event settles inside one Firestore transaction on the card, so two players never take the same cell.
- Other players' balls arrive through `onSnapshot` while the screen is open.
- A guest or a device off the cloud plays on a card of its own. The player's own progress (place, stake, counts) stays per player; an old save keeps its place and counts through `S.upgrade`.

**Balls.** Each ball shows its owner's icon, or their initial on a colour of their own, with the number on a small badge. The player's own balls have a gold ring.

**A line.**
- It pays on the completing player's own stake since their last line.
- n lines at once pay (n + 1)×, and a line made only of the player's own balls pays `soloBonus` (1.5)× more.
- The finished lines' numbers are then drawn afresh and their balls cleared (`reset` event).
- A full card no longer happens.

**Balance.** The bingo wheel was lowered a little for the bonuses. Simulation: about 100% playing alone (every line is your own) and 93–95% with five players.

**Jackpots.** Raised to 5,000 + 5% (JACKPOT) and 50,000 + 2% (SUPER JACKPOT) of the casino's bets since each was last won.

**Tests**
- `tests/sugoroku-model.test.cjs`: shared card, owners, reset, (n + 1)×, solo bonus, several players under 100%.
- `tests/sugoroku.smoke.cjs`: other players' balls by name, own ring, a solo line resets its row.
- `tests/casino.smoke.cjs`: a signed-in ball written to the shared card and seen by another player.

## すごろくビンゴ: one fixed bet (10.22.28.00)

Reported: the bet and the game were not tied together and would skew play.

They were. Money returned the same share at every bet, but the shared jackpots are fixed amounts, while ball slots grew only 1 → 2 → 3 for bets 10 → 50 → 100. Per chip spent, a 10 bet reached bingo and the jackpot chance about 7 times as often as a 100 bet.

As agreed, the bet is now one fixed amount for everybody, 100 (`RULES.costs = [100]`):
- The bet buttons became a "1回 100枚" label, and the 10 and 50 wheels are gone.
- The normal wheel was lowered one slot (×0.75 → ×0.5).
- Simulation: about 99% playing alone and 93% with five players.

With only 10 rolls in 1,000 practice chips, running out now turns the roll button into "練習チップを1,000枚に戻す" (practice chips only; `resetPractice` passed from casino.js).

Since a ball slot now pays ×0 too, the tests pick a ×0 slot that is not a ball.

## すごろくビンゴ: new bingo wheels and mini games (10.22.29.00)

The bingo rewards were rebuilt as specified.

**A line.** It pays the bingo prize (3× the bet = 300) and spins a 10-slot wheel:
- bet × 5 / × 10 / × 20
- the mini games: 10秒ぴったり, 連打, サイコロ, 暗算
- ハズレ (the prize alone), JACKPOT, and SUPER JACKPOT CHANCE

**SUPER JACKPOT CHANCE** is a 5-slot wheel: SUPER JACKPOT, JACKPOT ×2, 連打EX, and もう一回 (the bingo wheel again).

**Bonuses.** n lines at once ×(n + 1) and the solo ×1.5 apply to the prize, the multiples and the mini-game points, not to the jackpots.

**Mini games** (`RULES.games`, `gameScore`) are played over the board:
- 10秒ぴったり: the time hides after 3 s; 1,000 less 5 per 0.01 s off.
- 連打: taps in 10 s × 10 (EX × 50).
- サイコロ: the face × 100.
- 暗算: a middle-school sum (`S.sum`, whole answers, negatives and brackets) on an on-screen keypad in 15 s; 500 if right.
- Each waits in `state.bonus` and blocks rolling. Starting is saved first, so a game left half way scores 0 when reopened.

**Measured.** Fixed bet 100; 2M rolls alone and 400k with five players; mini games played fairly well:

| per roll | alone | 5 players |
|---|---|---|
| a ball | 1 in 5 | 1 in 5 |
| a ball that opens a cell | 1 in 25 | 1 in 25 |
| a bingo | 1 in 179 | 1 in 181 |
| a mini game | 1 in 423 | 1 in 424 |
| SUPER JACKPOT CHANCE | 1 in 1,726 | 1 in 1,674 |
| JACKPOT | 1 in 1,244 | 1 in 1,231 |
| SUPER JACKPOT | 1 in 8,000 | 1 in ~10,000 |
| return without jackpots | 90.8% | 87.6% |

**Before points are used.** The jackpots are now about 10× more frequent than before. Their seeds (5,000 / 50,000) would create points out of nothing at that rate, so they need revisiting before the game moves to real points. In the preview a jackpot is only shown.

## Insert a word between two cards (10.22.30.00)

Asked: in an editable word book, a small add button between word cards that adds a word right there.

Where words can be added (`VocabWordEntry.canAdd()`, the same check as the 「＋ 追加」 button), `renderVocabList` puts a small ＋ (a hairline with a 22px dot) after each word card.

It opens the add form with `openVocabWordEntry({ after: word })`:
- The title reads 単語を差し込む and a line says where the word goes.
- The number is that word's number + 1, with 差し込む already checked and the same unit filled in.
- After adding, the list re-renders in place instead of searching for the new word.
- 続けて追加する goes on inserting right after the word just added.

The existing `VocabOrder.place` moves the later numbers down. Numbers are display numbers, so every record stays with its word.

Test: `tests/vocab-insert.smoke.cjs`.

## 「」 cards: the back reads as a sentence (10.22.31.00)

Reported with a screenshot: in a 用語・年号モード history book, the 「大連」 card of 蘇我馬子 showed "大連" on the front and on the back "大臣の官職につきの官職であった物部守屋を滅ぼした人物".

The back was the line with the asked term cut out. That breaks any sentence whose 「」 sits mid-sentence.

The back now shows the headword and the whole line, with the asked term kept in its place in 「」 and any other terms plain: "蘇我馬子 / 大臣の官職につき「大連」の官職であった物部守屋を滅ぼした人物". The front is unchanged.

Test: `tests/term-questions.test.cjs`.

## 「」 cards in a Japanese line: the question first (10.22.32.00)

The user's answer to 10.22.31.00: "逆！！". Showing "大連" alone on the front asked nothing; the card must be the other way round.

A 「」 in a Japanese line (history terms and so on) now gives its card as the question it always was in battles: the headword, the year and the line with that term blanked on the front ("蘇我馬子　大臣の官職につき（＿＿）の官職であった…"), the term behind. It shows the question first in either direction, like a year card. English phrase lines (English over Japanese) keep their own two-sided cards.

Tests: `tests/term-questions.test.cjs`, `tests/term-mode.smoke.cjs`.

## すごろくビンゴ: balance, sharing, records and safety (10.22.33.00)

Asked for: everything from the improvement list except the "today's total" display, with the balance and the system kept from breaking.

**Balance.** With the jackpots counted, a roll paid back about 104–108% of its bet. Seeds of 5,000 and 50,000 plus 5% and 2% of every bet came to about 17% on their own. Two changes bring it under 100%:

- The shares are now 1% (JACKPOT) and 0.5% (SUPER JACKPOT). The seeds stay.
- One ×1.25 slot of the normal wheel became ×0.25. The wheel still has every multiple from ×3 to ×0.

Simulated with the pot fed only by すごろくビンゴ's bets (scratchpad sim5.cjs, 1–4 million rolls):

| Players | Without jackpots | Jackpots | Total |
| ---: | ---: | ---: | ---: |
| 1 | 87.6% | 10.6% | about 98% |
| 5 | 84.5% | 10.9% | about 95.4% |
| 30 | 84.4% | 11.6% | about 96% |

A JACKPOT comes about once in 1,250–1,300 rolls (typically about 6,000pt). A SUPER JACKPOT comes about once in 8,000–10,000 rolls (typically about 55,000pt). Bets in the other casino games add to the pots on top of this.

**A line is shared.** The bingo prize is split by the balls on the finished lines. Other players' parts wait in `owed` on the shared card and are collected (`SugorokuModel.collect`) the next time they roll, once. The wheel and its mini game stay with the finisher. The total paid is unchanged.

**Tapping.** Taps count up to 120 per game, and only trusted (real) presses count. A tapping tool or a script gains nothing past what a finger can do.

**Jackpot payment.** A jackpot waits in `state.jpWait` until it is paid:

- With points, `CasinoJackpot.win(kind, who)` takes the pot and resets it in one transaction, with this device's unsent bets counted. Two winners at the same moment each get what was there in turn.
- If the network fails, the jackpot stays waiting and is paid the next time the game opens.
- In the preview it is only shown, as before.

**Debt.** With points, an accident that takes more than the wallet holds turns the rest into a debt to the casino (`PointLoans.owe`). This is a loan already spent (it is never added to the wallet) with one 請求 for everything owed. On the casino's page the 請求 can only be paid: there is no decline, lend or 請求 button. On practice chips the take stops at 0, as before.

**Failed writes.** Whether a session uses the shared card is decided when the game opens:

- If a write to the shared card fails, nothing is charged or saved, and the player is asked to roll again. The game no longer quietly falls back to a card of its own.
- If an event game's ending fails to save, the game stays on screen, so つづける can be pressed again.
- Off the cloud, the status line says the card is the player's own.

**Untrusted data.** Everything read back from the shared card is checked:

- Numbers must be 1–100, once each, with 0 in the middle; "*" may appear only in the middle.
- Ids must be a sane length.
- Amounts owed must be whole numbers.
- Names are cut to 24 characters.
- An icon must be a small inline image (before this, an icon string went into a CSS `url()` as it was).
- The log keeps only well-formed entries.

The jackpot totals are read as whole numbers in range. A rules draft and what real protection needs are in docs/casino-firestore-rules.md.

**Reach.** The status line shows the numbers the reach lines wait on. The card glows warmer with more reaches. A ball for a reach number glows and takes its time, and a new reach is called out.

**Records.** The 記録 sheet shows:

- the player's own numbers: rolls, bet, returned, net, balls, lines, best single payout, shares received and jackpots;
- the latest 30 lines and jackpots of everybody, written into the shared card's log with each line.

Another player's line arriving by snapshot is called out on the screen.

**早送り.** A remembered toggle. The die, the steps and the normal, event and accident wheels take a quarter of the time. A reach ball, a line, its wheels and a jackpot keep their full time.

Tests:

- `tests/sugoroku-model.test.cjs`: sharing, collecting, the tap cap, card checks, counters and jackpot waiting.
- `tests/sugoroku-shared.smoke.cjs`: shared card, failed write, collection, log, records, 早送り, script taps and the jackpot win transaction.
- `tests/point-loans.smoke.cjs`: debt to the casino.
- `tests/sugoroku.smoke.cjs` and `tests/casino.smoke.cjs`: updated.

## すごろくビンゴ: おまかせ, old shares, the casino tab notice (10.22.34.00)

These are the follow-ups that can be done without a server.

- **おまかせ.** In a ★ event game, おまかせ plays the round with a plain strategy and presses つづける by itself:
  - blackjack: draw below 17;
  - dice poker: keep what the dealer would (`CasinoModel.dealerKeeps`), at most three throws;
  - chinchiro: throw until done.

  In 早送り it starts on its own. While it plays, the other buttons are off.
- **Old shares go.** A part of someone else's line is stamped when it grows (`owedAt`). A part not collected within 30 days is dropped, and the card keeps at most the 200 newest parts (`SugorokuModel.tidyOwed`, run with every change), so the shared card cannot grow without end. A part on an older card without a stamp starts counting from its first change.
- **Casino tab.** The すごろくビンゴ tile shows 「分け前 N 届いています」 when a part waits for this player. The shared card is read at most every five minutes for this, and the notice is cleared once the part is collected.
- **A crowded card.** A failed write to the shared card is tried once more after a short pause before the player is asked to roll again.
- **Jackpot shares.** Only points bet against the house feed the jackpots. Poker and one-to-one duels between players have no house share to pay for them, so they no longer add to the pots (before, they created points).
- **Mini games.** The 10秒ぴったり button and the 暗算 keypad only take real presses, as the tapping game already did. This stops a script on the page. A player can still play the result in another way, which only a server can prevent.

Tests:

- `tests/sugoroku-model.test.cjs`: stamping, expiry and the cap.
- `tests/sugoroku.smoke.cjs`: おまかせ through a blackjack round, and a script press ignored by the timer.
- `tests/sugoroku-shared.smoke.cjs`: `owedAt` written, and the casino tab notice for the other player.
- `tests/casino.smoke.cjs`: a poker hand does not feed the jackpots.

## すごろくビンゴ: from preview to points (10.22.35.00)

Asked for: the full version, with a check that the balance and the rest hold up.

- **On points.** Signed in and online, すごろくビンゴ now stakes points like the other house games (casino.js `PREVIEW` is empty). A guest, or a device off the cloud, still plays on practice chips and a card of its own, where a jackpot is only shown.
- **A fresh shared card.** The live card is `shared/sugoroku_live`. The preview's `shared/sugoroku_card`, with its practice-chip shares, is left behind, so no practice-chip share is ever paid as points. Saves are separate too: `aiglish_sugoroku_<id>` for points and `…_practice` for chips, so everybody starts the points game fresh.
- **Fewer cloud writes.** A roll used to move the wallet two or three times: the bet, the payout and a collected share. Each move is a wallet transaction with two writes. Now a roll, an event game's end or a mini game is one move: what came back less the bet (`round().net`). The bet is still counted for the jackpots (`Poker.settle(key, delta, feed)`), and a roll that breaks even writes nothing to the wallet.

  The game's own cloud copy is written at once only when an event game, a mini game or a jackpot starts or ends, so none can be played twice from two devices. Otherwise it is written at most every 30 seconds and when the page is hidden.

  A plain roll is now about 2 writes (it was about 5–7).
- **Debt.** An accident that takes more than the wallet holds stops the wallet at 0. The rest goes to `PointLoans.owe` as a 請求 from the casino.
- **Balance.** Unchanged from 10.22.33.00: about 98% back over time for one player and about 95–96% for several, jackpots included.

  For scale, a word earns 2pt a day, so one roll (100pt) is worth about 50 words. A JACKPOT is typically about 6,000pt and a SUPER JACKPOT about 55,000pt.
- **Still open.** Results are worked out on the player's device, as in the casino's other games. The Firestore rules in docs/casino-firestore-rules.md are not applied yet. Both are needed to stop a determined cheat.

Tests:

- `tests/casino.smoke.cjs`: a roll on points is one wallet move, keyed `casino:sugoroku:…:net`, and its bet feeds the jackpots.
- `tests/sugoroku-shared.smoke.cjs`: now on points. It checks the wallet after a collected share, an accident past the wallet becoming a casino debt, and the cloud copy.

## Jackpots sized to what is bet, and won more often (10.22.36.00)

The user found the jackpots too large for what the casino takes in. A word earns 2pt and a roll costs 100pt, but the SUPER JACKPOT stood at 50,000 before anything was bet: about 90% of a typical SUPER JACKPOT was seed. The user also allowed the jackpots to come more often.

- **Pots are mostly real bets.**
  - JACKPOT = 1,000 + 3% of what was bet since it was last won, up to 10,000.
  - SUPER JACKPOT = 5,000 + 2%, up to 100,000.
  - What the JACKPOT would hold past its cap goes to the SUPER JACKPOT. It is kept in `spill` once the JACKPOT is won, until the SUPER JACKPOT is won.
  - `CasinoJackpot.win` keeps all of this in its one transaction.
- **More often.** The bingo wheel's ハズレ became a second JACKPOT slot. The SUPER JACKPOT CHANCE wheel now has the SUPER JACKPOT twice and the JACKPOT once.
- **Balance kept.** The normal wheel's second ×1.25 slot came back (it had been made ×0.25 in 10.22.33.00).

Simulated with the pot fed only by すごろくビンゴ (sim6.cjs, 1.5 million rolls, cap and spill modelled):

| | 1 player | 5 players |
| --- | ---: | ---: |
| Without jackpots | 91% | 87.8% |
| Jackpots | 7.4% | 7.4% |
| Total | about 98.4% | about 95.2% |
| JACKPOT | once in about 800 rolls, typically about 3,350pt | same |
| SUPER JACKPOT | once in about 4,200–4,500 rolls, typically about 14,000pt | same |

Tests:

- `tests/sugoroku-model.test.cjs`: the wheels.
- `tests/sugoroku-shared.smoke.cjs`: the cap, the spill carried into the SUPER JACKPOT, and every pot starting again.
- `tests/casino.smoke.cjs`, `tests/sugoroku.smoke.cjs`: the new amounts.

## すごろくビンゴ: more for the balls on a line, and rolls without waiting (10.22.37.00)

The user asked for a bigger share of a line for the players whose balls filled it. They also found rolling and the other moves slow.

**Sharing.**

- The bingo prize was already split by the balls on the finished lines.
- Now 30% of what the bingo wheel's ×5 / ×10 / ×20 pays is split the same way (`RULES.wheelShare`). The finisher keeps the rest, the mini game and any jackpot.
- The wheel and the message show what went to everybody else (「（みんなに N）」).
- A waiting part is taken as soon as it is seen: on opening the game, or when the shared card changes while it is open. Before, it waited for the player's next ball.
- The total paid out is unchanged, so the balance is too.

**Speed.** Every roll used to wait for a transaction on the shared card (a read and a write over the network) before the die moved.

- The die now shakes from the moment of the press.
- A roll is first worked out on the card as last seen, recording each raw draw. Only a roll that draws a ball, or that finds a part waiting for the player, goes to the cloud. There the same draws are played again on the newest card, so the die and the wheels come out the same (`recorder`/`replay`).
- About four rolls in five draw no ball, so they no longer wait for the network at all. The end of an event game works the same way: a loss or a push needs no round trip.
- With the one-write wallet move from 10.22.35.00, an everyday roll costs about one wallet transaction and nothing else.

Tests:

- `tests/sugoroku-model.test.cjs`: the wheel's share.
- `tests/sugoroku-shared.smoke.cjs`:
  - a part taken on opening;
  - a ball roll refused when the cloud fails;
  - a roll without a ball going through even then;
  - the shares of a line.

## すごろくビンゴ: quick games on normal squares, more for the roller (10.22.38.00)

The user found that the player who rolls gains too rarely, and asked for mini games on normal squares too, to keep it from getting dull.

A simulation (sim7.cjs, 5 players) showed the problem before this change. 34% of rolls came out ahead, but only 25% of players were ahead after 30 rolls and 14% after 100. Most of what pays came in rare big wins, and the shared lines had moved part of the finisher's prize to the other balls.

- **Two quick games on the normal wheel.** These are a STOP slot and an H&L slot among the 24, so about one roll in fifteen. Both are paid in multiples of the bet.
  - ストップ: stop a light running along a bar. The gold middle (±5%) pays ×2.5, the silver (±20%) ×1, outside 0. The position comes from the clock, not the screen, and only a real press counts.
  - ハイ＆ロー: is the next card (A–K) higher or lower? A right guess pays ×1.5, the same card ×1, a wrong one 0.
  - Skill pays: a player who stops in the gold half the time gets more back than one who plays at random.
  - In 早送り they are not played and pay ×0.5. Playing is always worth more on average.
- **The finisher keeps half the bingo prize.** `prizeShare` is 0.5, so half is shared by the balls on the line, the finisher's own included. Before, all of it was shared. The bingo wheel's ×5 / ×10 / ×20 share stays at 30%.
- **The normal wheel.** It now has ×3, ×2, ×1.5, ×1.25 ×2, ×0.75 ×2, ×0.5 ×3, ×0.25 ×5, ×0.1 ×2, ×0 ×2, three ball slots and the two games.
- **soloBonus 1.5 → 1.25.** With the finisher's bigger part, a player alone would otherwise get more than 100% back.

Simulated with the jackpots (sim6.cjs; the quick games are played by an average player who stops in the gold a quarter of the time, and ハイ＆ロー is guessed the sensible way):

| | Before | Now |
| --- | ---: | ---: |
| Return, 1 player | about 98.4% | about 100% |
| Return, 5 players | about 95.2% | about 98.5% |
| Players ahead after 30 rolls | 25% | 30% |
| Players ahead after 100 rolls | 14% | 22% |

Tests:

- `tests/sugoroku-model.test.cjs`: the games on the wheel and their pay, and the prize share.
- `tests/sugoroku.smoke.cjs`: ストップ and ハイ＆ロー played and paid, and 早送り paying ×0.5 without playing.
- `tests/sugoroku-shared.smoke.cjs`: the new shares.

## すごろくビンゴ: opens at once, more games on normal squares, wider swings (10.22.39.00)

The user found three things: opening the game took long, rolling felt like a chore, and the normal wheel leaned so far to the minus side that a roll rarely felt worth it. They asked for more mini games (チンチロ, ブラックジャック and ダイスポーカー among them), and for bigger wins up to ×10 in exchange for bigger losses.

**Opening.** The screen waited for three things before it showed anything:

- the game's cloud copy;
- the shared card;
- the player's icon, loaded and shrunk on every opening (an image that never answered held it up for good).

Now the screen comes up at once from what this device kept: the game, the card as last seen and the icon. The icon is now made once and kept for the picture it came from, and shrinking gives up after 3 seconds. The cloud copies come in behind it:

- The card arrives through its listener, or one read where there is no listener.
- A game played further on another device takes over when nothing is going on.
- Only what this device has never seen is waited for.

**A lost-save bug.** A save whose 戻った合計 (`won`) had gone below 0 failed `SugorokuModel.valid` and was thrown away as if broken. An accident could already do this, and the new minus slots make it common. `won` may now be any finite number.

**The normal wheel** has 40 slots:

| Slots | What they do |
| --- | --- |
| ×10, ×5, ×2, ×1.5, ×1.25 | win |
| ×0.75, ×0.5 ×3, ×0.25 ×3 | part of the bet back |
| ×0 ×15 | nothing back |
| −×0.5 ×2, −×1 ×2 | take that much more than the bet |
| 4 ball slots | a ball |
| ストップ, ハイ＆ロー | the quick games |
| ブラックジャック, ダイスポーカー, チンチロ | played as on an event square (a win pays and gives a ball, a loss gives back half; おまかせ works) |

A ×5 or ×10 lights the room like a jackpot wheel.

Simulated with the jackpots (sim6/sim7.cjs):

| | Before | Now |
| --- | ---: | ---: |
| Return, 1 player | about 100% | about 100% |
| Return, 5 players | about 98.5% | about 98.3% |
| Rolls that come out ahead | 37% | 29% (bigger swings) |
| Players ahead after 30 rolls | 30% | 35% |
| Players ahead after 100 rolls | 22% | 30% |
| Players ahead after 300 rolls | 11% | 20% |

Tests:

- `tests/sugoroku-model.test.cjs`: the wheel, the minus slots, event games from a normal square, and a save with negative returns.
- `tests/sugoroku-shared.smoke.cjs`: opening while every cloud read takes 4 seconds comes up within 2 seconds.
- `tests/sugoroku.smoke.cjs`: plays the normal squares' games when a random roll lands on one.

## Lending: opens at once, interest, a simpler form (10.22.40.00)

The user found the profile and the lending screens slow to open, asked for interest on loans between users, and found the lending screen hard to use.

**Why it was slow.**

- A profile waited for the person's cloud document, and for this player also for a ranking sync, before showing anything.
- The lending list first collected anything sent to this player: one transaction per changed pair. Then it read the list again and each pair's record one after another.
- A person's screen claimed incoming points (a transaction) and then read the record before drawing.

**Now:**

- **Profiles.** A profile comes up at once from the user list's copy, with "…" for what is not known yet. The latest copy and the ranking sync are fetched together and fill it in, if it is still open.
- **The lending list.** It comes up at once from the list kept on this device and the records seen before. The list and every pair's record are read side by side. Collecting runs afterwards, reusing the list just read.
- **A person's screen.** It comes up from the record as last seen, marked 「最新の記録を確かめています…」. It is drawn again with the cloud's copy, and claims only when something is waiting. Every send, request, answer and claim keeps the record it wrote, so the redraw after an action is immediate.
- **Measured.** A test makes every cloud read take 3 seconds. The list, a person and a profile all still come up within 1.5 seconds.

**Interest.**

- A loan can carry one-time interest of 0, 5, 10, 20 or 30% (`PointLoansModel.RATES`). The loan entry keeps `rate`, and `due`: the amount plus its interest, rounded to whole points.
- What is owed counts `due` for a loan, so repayment and 請求 limits include the interest. Older entries without `due` count their amount.
- A borrow request is answered with 「条件を決めて貸す」: the form opens with the amount filled in, so the lender can choose the interest. It shows 「返してもらう額 110pt（利子 10pt）」 before lending.

**The form.**

- One form, with tabs for 貸す / 返す / 借りる / 請求. 返す needs a debt and 請求 needs a loan; the casino only offers 返す.
- The amount field shows its unit, with quick amounts including 全部.
- The interest chips appear for a loan.
- A line under the form says what will happen: what comes back, what is left, or who decides the interest.
- One large button names the action.

Tests:

- `tests/point-loans-model.test.cjs`: interest, rounding, the allowed rates, and older entries.
- `tests/point-loans.smoke.cjs`: the tabs, a loan at 10% against a request and its full repayment, and opening with a slow cloud.

## Study time pays 5pt a minute; bigger bingos (10.22.41.00)

The user found 1pt a minute of study too little, and the bingo payouts too small.

**Study time.** Measured study time now pays 5pt a minute for days from 2026-11-02 (Japan time) on (`StudyPointPolicy.timePoints`).

- Days before keep paying 1pt a minute. A day's time points are a level that is only ever raised, and it is worked out again whenever its records merge on another device. Multiplying every day would have paid all past study time again, five times over.
- `timeRate(day)` decides by the day the time belongs to, everywhere a time amount is worked out: the day's own collection, merging, and the cloud claim.

**Bingo.**

| | Before | Now |
| --- | ---: | ---: |
| Bingo prize | 3× the bet (300) | 10× (1,000) |
| Bingo wheel multiples | ×5 / ×10 / ×20 | ×10 / ×20 / ×50 |
| Bingo wheel mini games | their points | 3× their points (`bingoGameBoost`) |

The shares to the other balls on the line are unchanged in proportion: half the prize, and 30% of the wheel's multiples.

To pay for it, everyday play gives back a little less:

- A ball off the card gives the bet back (`missPay` 1.5 → 1).
- The normal wheel's ×2 slot became ×0.
- A line of only one's own balls pays ×1.1 (was ×1.25). The bigger prizes would otherwise give a lone player more than 100%.

Simulated with the jackpots (sim6/sim7.cjs):

| | Result |
| --- | ---: |
| Return, 1 player | about 98.8% |
| Return, 5 players | about 97.3% |
| Players ahead after 30 rolls | 32% |
| Players ahead after 100 rolls | 30% |
| Players ahead after 300 rolls | 23% |

Tests:

- `tests/study-point-policy.test.cjs`: the rate by day.
- `tests/sugoroku-model.test.cjs`: the new payouts, and the plain-play return test now collecting shares and playing the quick games.
- `tests/sugoroku.smoke.cjs`, `tests/sugoroku-shared.smoke.cjs`: updated amounts.

## すごろくビンゴ: more back from everyday squares, bigger jackpots (10.22.42.00)

The user sent their record after the change above: 154 rolls, 15,150pt bet, 9,261pt back (61%), no line and no share yet. They asked for more back from everyday play and bigger jackpots.

That result is within what the game allows. Most of what pays comes with lines and jackpots, and a run of 154 rolls has, on average, less than one line. But it showed how little the everyday squares gave back on their own.

- **Normal wheel.** One ×0 became ×1, so the bet comes back.
- **Bingo wheel.** Its mini games score 2× their points (was 3×).
- **Jackpots.** The pots start higher and grow from a smaller share:
  - JACKPOT = 3,000 + 1.5% of the bets since it was won, up to 20,000. It was 1,000 + 3%, up to 10,000.
  - SUPER JACKPOT = 12,000 + 1%, up to 150,000. It was 5,000 + 2%, up to 100,000.

Simulated with the jackpots (sim6/sim7.cjs):

| | Result |
| --- | ---: |
| Return, 5 players | about 99.5–100% |
| Return, 1 player | about 101% |
| Typical JACKPOT | about 4,100pt (once in about 770 rolls) |
| Typical SUPER JACKPOT | about 16,000pt (once in about 4,000 rolls) |
| Players ahead after 30 rolls | 33% |
| Players ahead after 100 rolls | 29% |
| Players ahead after 300 rolls | 23% |

The game now pays back about what it takes over time. Raising it further would let points grow without study.

Tests: the wheel and mini-game boost in `tests/sugoroku-model.test.cjs`; the new pots, cap and spill in `tests/sugoroku-shared.smoke.cjs`, `tests/sugoroku.smoke.cjs` and `tests/casino.smoke.cjs`.

## A person opens as a talk; points from the 運営 (10.22.43.00)

The user asked for a LINE-like talk screen when opening a user, and for a way for the 運営 to send points.

**Talk.** Opening another player now opens a talk with them (`PointLoans.person`). This applies from the user list, a study group, or the profile's 「トーク」. It has:

- **A header:** back to the list, their icon and name, 「プロフィール」 (the old profile dialog, now `People.open(id, { profile: true })`), and close.
- **A standing bar:** where the two players stand.
- **The talk:** messages and every loan, repayment, request and gift, oldest first, with a line for each day. Messages are bubbles (mine green on the right). Points and requests are cards, and a request waiting for my answer carries its buttons (払う / 断る / 条件を決めて貸す).
- **The line to talk,** with a ＋ that opens the points form from 10.22.40.00 over it.

The talk follows the record live while it is open (`fbOnSnapshot`, or one read where there is none). This player, a guest, or a profile asked for opens the profile as before. The list of talks shows each one's last line.

**Messages** are entries in the pair's record (`PointLoansModel.say`, kind `message`, up to 500 characters). A record holds up to 400 entries. When it is full, the oldest messages go first (at most 150 are kept), then finished requests. A long talk never pushes a debt out of the record, which would have erased it.

**Points from the 運営.**

- 管理者ツール → a player → ポイントを送る (1–100,000pt, with an optional note).
- This writes a gift (`PointLoansModel.gift`, kind `gift`, owed by nobody) into the record between `ADMIN` (「運営」) and the player, and a line in the player's list of talks (`PointLoans.grant`).
- The player's device collects it into the wallet once, as with any points sent, and says 「運営から 500pt 届きました」.
- The talk with 運営 shows the gift with its note. It has no line to type in and no points form.

Tests:

- `tests/point-loans-model.test.cjs`: messages, gifts, trimming that keeps debts.
- `tests/point-loans.smoke.cjs`:
  - the talk, bubbles and cards in order;
  - the ＋ form;
  - a message seen by the other side and in the list;
  - a gift collected once.
- `tests/admin-players.smoke.cjs`: sending points from the admin tool.

## Fewer cloud writes from すごろくビンゴ; talks and groups open from what was seen (10.22.44.00)

The user found talks and groups very slow to load, and could not create a casino table for friends.

**The likely cause: the cloud's daily limits.**

- On points, every すごろくビンゴ roll was a wallet transaction: two writes (the wallet and the profile's point total). With 早送り a player rolls about 40 times a minute, so an hour of play came to several thousand writes. The free plan allows 20,000 writes a day for the whole app.
- When a limit is hit, every write and read fails with `resource-exhausted`. `FirestoreReadGuard` then pauses all cloud use for five minutes.
- During the pause, loading stalls or fails and new tables cannot be made. The casino says 「クラウドの利用上限に達しています」.

**Fix.**

- すごろくビンゴ's wallet moves are added up on the device and written as one move at most every 20 seconds, and also when the page is hidden, the game closes or the app starts. They are kept in `aiglish_casino_batch_<id>`.
- Each batch keeps its key until the wallet has it (`Poker.settle` now resolves `true`/`false`), so a refused write is retried later and never paid twice.
- The balance shown includes what is waiting.
- A long session now writes about 3 times a minute instead of about 80.

**Opening faster.**

- A group shows its last copy seen on this device (`aiglish_group_seen_…`) while the cloud's copy comes in, marked 「最新の内容を確かめています…」.
- The last 30 talk records are kept on the device too (`aiglish_loans_record_…`), so a talk opened after a restart shows at once.

**Casino tables.**

- A table number can be used again when its casino table was left behind for six hours, for example by players who shut the app without closing it. Before, an abandoned table kept its number for good.
- Poker tables (which have no `kind`) are never reused this way.

Tests:

- `tests/casino.smoke.cjs`: a roll's move waits and is written on closing, as one batch.
- `tests/sugoroku-shared.smoke.cjs`: a batch refused by the cloud stays and is written once later.
- Groups, talks and casino tables: `tests/study-groups-sessions.smoke.cjs`, `tests/point-loans.smoke.cjs`, `tests/casino-group.smoke.cjs`.

## Fix: the list of talks stopped with an error (10.22.45.00)

The user reported 「undefined is not an object (evaluating 'last[key]') (point-loans.js:312)」 in 10.22.43.00.

**Cause.** The list's rows marked a talk 「新着」 by comparing its time with `last`, the times this player last looked. In 10.22.43.00 a variable for each row's last line was also named `last`, inside the loop. It hid the outer one, so `last[key]` read the row's last line instead. The first drawing of the list uses the copy kept on the device. Any pair whose record this device had not read yet (as after a restart) had no last line, and `last[key]` threw.

**Fix.** The row's line has its own name, `line`.

**Check.** `tests/point-loans.smoke.cjs` now opens the list with a kept pair whose record was never read. It fails on 10.22.43.00 and passes now.

Points sent from the 運営 were not affected: they are collected when the app starts, apart from drawing the list.

## Fix: points sent to a player were not collected (10.22.46.00)

The user reported that points sent from the 運営 did not arrive.

**Cause.** Points sent to a player (loans, repayments and gifts from the 運営) were collected once, 1.5 seconds after the app loaded. If the player was still signing in at that moment, the collection saw a guest, did nothing, and never ran again.

- A loan or a repayment still arrived when its talk was opened.
- A gift from the 運営 stayed waiting until the player opened the 運営 talk, which nothing prompts them to do.

**Fix.** Collection now runs:

- as soon as the player is signed in after start (checked every 5 seconds for up to 10 minutes);
- every 10 minutes;
- when the app comes back to the front (at most every 2 minutes).

Each run is one read of the player's list, plus a claim only for pairs that changed. Gifts already sent arrive the next time the player opens the app (10.22.46.00 or later).

**Check.** `tests/point-loans.smoke.cjs` has a player sign in 3 seconds after the app loaded, with a gift already waiting. The gift reaches the wallet on its own. On 10.22.45.00 the wallet stays at 0.

## Casino tables with friends answer at once (10.22.47.00)

The user found the 一緒に (and タイマン) tables laggy.

**Cause.** Every button at a friends' table writes the table in a transaction: one round trip to read it and one to commit. A transaction gets no early local copy the way a plain write does, so the screen then waited for the listener to bring the table back, a third trip. On a phone that is one to two seconds after each press.

**Fix.**

- Every table write counts up a `rev`.
- When a transaction commits, the table is drawn at once from what was written (`showWritten`), unless the listener has already shown a later `rev`.
- The listeners pass over a copy older than the one shown, so a late echo cannot roll the table back.
- Tables written before this have no `rev` and count as 0.

**Check.** `tests/casino-group.smoke.cjs` makes the listener 3 seconds late. A confirmed roulette bet still shows within 1.5 seconds. On 10.22.46.00 it does not.

## The 運営 can add and take back points, and see whether each has arrived (10.22.48.00)

The user said points from the 運営 still had not arrived, and asked to be able to change a player's points.

**Changing points.** 管理者ツール → a player → 「ポイントを操作」.

- 増やす sends a gift. 減らす sends a charge (`PointLoansModel.gift` with kind `charge`).
- Both go into the record between 運営 and the player (`PointLoans.grant`).
- The player's own device applies them when it collects: a gift adds, a charge takes away, never below 0. The player is told (「運営から 100pt 引かれました」) and the 運営 talk keeps the line.
- A wallet is still only ever written by its owner's device. If the administrator wrote it directly, the player's device could later write its own copy over the change.

**Seeing whether it arrived.** The same section shows:

- the player's points as their device last saved them;
- every gift and charge from the 運営, each marked 反映済み (the player's device has taken it in) or まだ (`PointLoans.adminLedger`).

A gift still marked まだ means the player's device has not collected since it was sent. Collection runs on 10.22.46.00 and later, when the player is signed in. A phone that keeps the app open for days without reloading can still be running an older version.

Tests:

- `tests/point-loans-model.test.cjs`: a charge.
- `tests/point-loans.smoke.cjs`: a charge taken once; the administrator's view showing both as taken, with the balance.
- `tests/admin-players.smoke.cjs`: 増やす and 減らす, with the list and its まだ.

## The 運営's send history (10.22.49.00)

管理者ツール now has 「運営からの送信履歴」: everything the 運営 has given or taken back, for every player, newest first. Each line shows:

- the player, the amount (+ or −) and the note;
- the time;
- whether the player's device has taken it in (反映済み / まだ).

The totals given and taken are shown above. It is one query over the 運営's records (`pointLoans` where `people` contains `ADMIN`, at most 100 records; `PointLoans.adminHistory`).

Test: `tests/admin-players.smoke.cjs` opens the history after a gift and a charge.

## Deleting a player: no step blocks the rest, and newer data is cleaned up (10.22.50.00)

The user found that deleting a player did not seem to work.

**Likely cause.** The deletion looked for the player's group chat lines with one query across every group's messages: a collection-group query filtered on `ownerId`. Such a query needs a collection-group index, which has to be created in the Firebase console, and this project has none. Without it the query fails every time. The deletion stopped there as 「完全削除が未完了」, and running it again failed at the same place.

**Fix.**

- The player's chat lines are found group by group, inside the groups that already list the player (`retainedMemberIds`). A query on one group's messages needs no extra index.
- Every clean-up runs as its own step. One that fails no longer stops the others: the deletion goes on, names the failed steps, and leaves the account `pending`. Running it again repeats only what is safe to repeat.

**Newer data now cleaned up too.**

- Talks and lending: the player's list of talks (`pointLoanInbox/<id>`) is deleted.
- In each pair kept for the other side, the player's messages are removed, their notes cleared and their name set to 削除済み. The money history stays for the other player.
- すごろくビンゴ's shared card: the player's balls, part and name, and their lines in its log, are removed.
- The casino's jackpot winners: the player's name is shown as 削除済み.

Test: `tests/admin-players.smoke.cjs` now has data in all of these, and checks each after a deletion that was interrupted once and then run again.

## すごろくビンゴ: the die lands at once when a ball comes out, a missed ball pays 2×, more games on normal squares (10.22.51.00)

The user found that the die kept shaking for a long time whenever a ball came out. They also asked for a missed ball to pay 200, and for more mini games on the normal wheel.

**The die.** A roll that touches the shared card waits for the cloud's answer, and the whole show used to wait with it. Now the roll is worked out on the device first. The die, the walk and the wheel play right away, up to the ball. The ball and what follows play once the cloud has answered. If the cloud fails, nothing is charged and the piece goes back.

**Payouts.**

- A ball that misses the card (or lands on a taken number) pays 2× the bet: 200.
- Event squares: a loss gives back a quarter of the bet, and 確定 gives the bet back with a ball.
- Quick games: ストップ pays 2× (perfect) or 0.75× (good); ハイ＆ロー pays 1.25× on a win.

**More games on the normal wheel.** ストップ and ハイ＆ロー now have two slots each, and ブラックジャック, ダイス and チンチロ also have two each: 10 game slots in all, up from 5. A game started on a normal square is a plain bet: a win pays the bet back plus the win, with no ball, and a loss pays nothing.

**Balance.** The normal wheel is now ×10, ×5, ×1.5, ×1, ×0.25, ×0, −0.5 and −1. In simulation, the return is about 99–101% with the jackpots counted. A bingo comes once in about 225 rolls.

Tests: `tests/sugoroku-model.test.cjs` and `tests/sugoroku.smoke.cjs` check the new payouts, the plain games and the wheel.

## すごろくビンゴ: つづける tapped many times pays a won game once (10.22.52.00)

The user found that after winning a game in すごろくビンゴ (チンチロ and the others), tapping つづける over and over on a slow connection paid the win again and again.

**Cause.** つづける settles the game and then waits for the shared card to be written. While it waited, the game was still marked as waiting to be settled. Each extra tap settled it again from the same state and paid again.

**Fix.** Only one settle runs at a time. The button turns off while it runs, and taps during the wait are ignored. Once the game is settled it is no longer waiting, so a late tap has nothing to pay. If the cloud cannot be reached, the button comes back so the player can try again.

Test: `tests/sugoroku.smoke.cjs` taps つづける six times in a row and checks the chips went up by exactly what the saved record shows. Without the fix it fails.

## すごろくビンゴ: other players' balls no longer go missing during a roll (10.22.53.00)

The user found that balls on the bingo card sometimes did not show, and then appeared later.

**Cause.** The screen listens to the shared card. A change that arrived while a roll or a game was being shown was skipped, so the card would not change under the show. That change was then gone for good. Firestore only sends a card again when it changes, so another player's ball stayed hidden until somebody's next ball. While a player kept rolling, most changes arrived during a show, so this happened often.

The repeated つづける bug fixed in 10.22.52.00 was not the cause. A second settle of the same game drew the same number. It found the player's own ball already there and counted as a miss, so no extra balls were placed.

**Fix.** A change that arrives during a show is marked as waiting. When the screen is free again, the card is read once more and shown. One extra read happens only when a change was skipped.

Test: `tests/sugoroku-shared.smoke.cjs` puts another player's ball on the card while a roll is being shown, and checks that it shows once the roll ends. Without the fix it fails.

## すごろくビンゴ: no つづける, the other side's dice shown throw by throw, fewer throws for the player (10.22.54.00)

The user asked whether the つづける button was needed at all. They also found that チンチロ and ダイスポーカー seemed to give the other side absurdly strong hands. They suggested that both sides roll by plain chance and that the player gets fewer throws than the other side, to keep the balance.

**The dice were not rigged.** Both sides already rolled fair dice (`crypto.getRandomValues`, each face 1 in 6). The strong hands came from the rules:

- In ダイスポーカー the dealer throws up to three times and keeps its pairs. In a simulation of 200,000 rounds, the dealer ended with a フルハウス about 33% of the time, フォーダイス 15% and ファイブダイス 3%.
- In チンチロ the parent throws up to three times. About 10% of the time it makes ゾロ目 or シゴロ and wins at once.
- Only the dealer's final dice were shown, so a strong hand seemed to come from nowhere.

**Changes.**

- **No つづける.** The result of an event game shows for a moment (1.4 seconds; 0.5 in 早送り), then the board goes on by itself. The same goes for the mini games (1.6 seconds). If the cloud cannot be reached, a 「もう一度送る」 button appears. Only one settle runs at a time, as before.
- **The other side's throws are shown one by one.** The dealer's dice-poker throws and the parent's チンチロ throws now appear one at a time, each with its number (「2投目」). A round reopened later shows them all at once.
- **Fewer throws for the player.**
  - ダイスポーカー: the player now has 2 throws in all (one re-roll), the dealer up to 3. The player's chance of winning falls from about 50% to 36%, so a win pays 1.5 times the bet. `CasinoModel.diceStart` takes the number of throws as `most`. The casino's own dice poker still uses 3, and so do rounds saved before this change.
  - チンチロ was already 3 throws for the parent and 2 for the player. The screen now says so.

**Balance.** In simulation (sim6, 400,000 rolls), the whole すごろくビンゴ returns about 98.5–99.4%, jackpots included. It was 99.6% before.

Tests:

- `tests/casino-model.test.cjs`: a round with `most: 2` allows only one re-roll, and an old round keeps three throws.
- `tests/sugoroku.smoke.cjs`: there is no つづける. The dealer's throws show with their number, and a dice-poker win on a 50 bet gives back 125 (the bet plus 1.5 times it). A チンチロ round shows the parent's throws, lets the player throw, and ends by itself. The mini games close by themselves.

## すごろくビンゴ: who else is playing is shown above the card (10.22.55.00)

The user asked what happens when several players play すごろくビンゴ at once, and asked for a sign that others are playing.

**What already happens.** Everyone shares one bingo card. Each player's piece, wallet and wheels are their own. A ball goes onto the shared card in a transaction, so two players never take the same number. Other players' balls come in through the card's listener (since 10.22.53.00 also while a roll is shown). Their BINGOs and jackpots are announced on the screen.

**New.** A small line above the card reads 「いっしょにプレイ中」 and lists, with their icons, the other players who rolled in the last two minutes (up to 5, then 「ほかN人」).

- Kept in a separate document, `shared/sugoroku_here`, as `{ [id]: { n, at } }`. A player is marked when the screen opens, and then with their rolls at most every 45 seconds. That is about 80 writes an hour for one player who keeps rolling, and none while idle.
- Nobody has to write to leave the list: someone who stops rolling drops off after two minutes. The screen redraws the list every 20 seconds.
- Entries older than a day are deleted by whoever writes next.
- Everything read back is checked like the card: ids, names cut to 24 characters, numeric times.

Test: `tests/sugoroku-shared.smoke.cjs` checks:

- opening the screen marks the player;
- a player who rolled just now is listed;
- a player from five minutes ago is not listed;
- the player themself is not listed.

## The points history includes the casino (10.22.56.00)

The user asked for the points history to include the casino.

**Before.** The history listed only points earned by studying. Casino and poker wins and losses changed the balance but appeared nowhere.

**Now.** Every casino and poker result that reaches the wallet (`Poker.settle`) is added to a short record, `casinoLog`, in the wallet document (`users/<id>/learningPoints/main`).

- **Format.** `[{ g, d, n, at }]`: the game, the net points, how many results, and the time.
- **Grouping.** Results of the same game within 30 minutes are added to one line, so a long run of すごろくビンゴ rolls stays one line. The record keeps the newest 100 lines.
- **No extra writes.** It is written inside the same transaction as the wallet move, so it follows the player to other devices.
- **On the device.** It is also kept locally (`aiglish_casino_log_<id>`), and 「クラウドから更新」 reads it again.
- **Not wiped.** StudyPoints' own wallet write (which replaces the document) now keeps `casinoLog`, the same way it keeps `poker`.

**The points screen.**

- The tab 「獲得履歴」 is now 「履歴」.
- The casino lines are mixed in by time, newest first: the game's name, 「カジノ · N回分」, and the net points, with a loss shown in red.
- 総獲得ポイント is unchanged (study only).
- The 「獲得方法」 text now says that the casino appears in the history. It also gives the study-time rate as 5pt per minute (it still said 1pt).

Results from before this change are not in the record.

Test: `tests/casino.smoke.cjs` plays blackjack (−60), two poker hands (−10, +10) and a すごろくビンゴ roll (−100). It checks the wallet's record (three lines; the poker hands make one line of ±0, 2回分) and the rows on the points screen.

## すごろくビンゴ: mini games are not multiplied by the lines, 連打EX 25 a tap (10.22.57.00)

The user asked what a bingo can pay and whether anything breaks the balance. Two things could pay far more than the rest:

- **連打EX.** On the SUPER JACKPOT CHANCE wheel, 120 taps × 50 × 2 = 12,000. It depends only on tapping speed, so a tapping app on a phone or PC, which sends real taps, could take the full amount every time.
- **Line multipliers on mini games.** The line multipliers (two lines 3×, three lines 4×, solo 1.1×) also applied to the mini games. 連打EX on a triple line could pay 48,000.

**Changes (as the user chose).**

- A bingo wheel's mini game is multiplied only by `bingoGameBoost` (2), never by the lines or the solo bonus. The lines still multiply the bingo prize and ×10 / ×20 / ×50. They never multiplied the jackpots.
- 連打EX is now 25 points a tap: at most 120 × 25 × 2 = 6,000.

**Balance.** In simulation (400,000 rolls), すごろくビンゴ returns about 97.5–99.2% with jackpots. It was about 98.5–99.4% before. Simulation noise is about ±1%.

Tests: `tests/sugoroku-model.test.cjs` checks that:

- 70 taps of 連打EX score 1,750;
- the cap is 120 × 25;
- a double line landing on a mini game queues it at 2×, not 6×.

## Casino: points can be bet only after studying, 100pt a minute (10.22.58.00)

The user found that points had become steady enough that the casino was taking the place of studying. They chose this rule: points can be bet only after studying, 100pt for each minute studied today.

**The rule.** Each day, the total a player can bet with points is the minutes measured by the study timer today × 100, less what they have already bet today.

- **What counts as study.** Only time measured by the timer, from all devices in the merged study ledger, counts: the day's `sources`, without the old `legacy` total and without edits typed in. Today's time counts at once, although its points are paid the next day.
- **What uses it up.** Every stake counts:
  - house games (blackjack, roulette, dice poker, chinchiro);
  - すごろくビンゴ rolls (100 each);
  - tables with friends and duels;
  - poker buy-ins and chip top-ups with points.

  A loss beyond the bet (chinchiro's extra, keys ending in `:extra`) does not count, and neither do payouts.
- **Practice chips** (guests, offline) are not limited.
- **The count of today's bets** is kept on the device (`aiglish_casino_staked_<id>`, reset when the date changes). Two devices each keep their own count, so this is a nudge, not a lock.

**On screen.**

- The casino tab shows 「今日あと N pt 賭けられます（今日の勉強 M 分）」.
- At a table, the bet stops at the allowance. Under the bet, either the allowance is shown, or 「あと N 分勉強すると賭けられます」.
- すごろくビンゴ shows how many rolls are left. When less than one roll is left, the button reads 「勉強すると振れます」.
- Duels, friends' tables and poker refuse a stake above the allowance, with the same message.

Tests:

- `tests/casino.smoke.cjs`:
  - with no study, 配る is disabled and the hint asks for 1 minute;
  - with 1 minute, the allowance is 100;
  - a 60 bet comes off the allowance.
- `tests/sugoroku-shared.smoke.cjs`: with less than one roll left, the roll button asks for study.
- The other casino and poker tests now record ten hours of study before betting.

## Casino tab: the study allowance line no longer runs off the card (10.22.59.00)

The user sent a screenshot from an iPhone: the line 「今日あと 0pt 賭けられます（今日の勉強 0分）」 ran off the right edge of the balance card.

**Cause.** In 10.22.58.00 the allowance text was added to the 「今日 ±N」 line. That line sits beside the balance and does not wrap (`white-space: nowrap`).

**Fix.** The allowance now has its own line (`.casino-allow`), across the full width at the bottom of the balance card. It can wrap on narrow screens. When nothing is left to bet, it is shown in gold.

Test: `tests/casino.smoke.cjs` checks the text of the new line and, at 320px wide, that it stays inside the card and does not overflow.

## Users tab: loads fast, shows at once, and never stays stuck (10.22.60.00)

The user found that the users tab was slow to load and asked for other awkward parts of the UI to be fixed.

**Why it was slow.**

1. The list read every user document in full, 10 at a time, one page after another. That included every saved field, even though the tab shows only a name, a photo, when the user was last active and today's study time. It also read players who had not been seen for months.
2. Nothing was kept between launches, so every launch started from 「読み込み中…」 and waited for the whole scan.
3. A bug could stop loading for the rest of the session. If the tab was opened before the cloud was ready (offline, or before sign-in finished), the load ended without waiting. It then cleared its "loading" flag *before* the flag had been set. The flag stayed set, and every later load returned the finished one, including the 更新 button.

**Fixes.**

- **Projected query.** `UserDirectory.recent()` reads players active in the last 7 days with one REST `runQuery`, the same way the ranking does. It filters on `lastActiveAt` and fetches 50 a page. It selects only the fields the list needs: name, photo, profile look, active times, the deleted flag, and the study-time ledger for 「今日 N分」.
- **Quiet friends.** Friends who were quiet for longer come in one `batchGet`, with the same fields.
- **Fallback.** Without the REST endpoint, the old scan is still used.
- **Kept on the device.** The list is saved (`aiglish_people_list_<id>`, photos dropped if the copy grows past 1.5 MB). The tab shows it at once on the next launch, with 「更新しています…」 while the fresh list loads. An admin deletion clears the saved copy.
- **The loading flag** is now cleared when the load has really finished, so a load that ended early no longer blocks the next one.
- **No more endless 「読み込み中…」.** A guest now sees 「ログインすると、ほかのユーザーが表示されます。」. A device off the cloud is told to use 更新 once it is connected.

Test: `tests/people-recent.smoke.cjs` checks:

- a guest is told to sign in;
- after signing in, the list loads with one projected query (the filter, 50 a page, no heavy fields), and the quiet friend comes from one batch read;
- the old scan is not used;
- on the next launch the kept list (2 people) shows while the cloud has not answered yet.

`tests/people.smoke.cjs` (the scan fallback) still passes.

## Points history: every day kept, study time included (10.22.61.00)

The user asked whether points for study time were being paid, and asked for the history to keep everything.

**Study-time points.** They are paid. Measured minutes become points the next day (after 0:06 Japan time), when the app starts, a session ends or a save runs. They pay 5pt a minute from 2026-11-02 and 1pt before that. The trouble was the history:

- It kept only the newest 100 award lines, one per word.
- A day of word cards fills that in a day or two, and older lines drop off.
- The study-time line is dated the day before, so it was usually among the first to go.

The points had been added; only the line had disappeared.

**Now.** The wallet document keeps a per-day record, `daily`: `{ "YYYY-MM-DD": { kind: { n, p } } }`.

- **Kinds.** Word cards, battle answers, weak-word review and workbook are counted by words or problems. Study time is counted in minutes. The login bonus and lending (including gifts from 運営 and charges) are recorded as points.
- **Written with the credit.** Each line is written in the same transaction that credits the points, from the same "credited now" amount, so nothing is counted twice. That transaction is the study award sync, the login-bonus draw, or the lending write.
- **Merging copies.** Two copies of the record are merged by taking the fuller line for each day and kind.
- **Length.** The newest 400 days are kept.
- **Past days.** The record is filled once per account from the award records the cloud already holds (`reviewPointDays`). Those reads are shared with the one-time "total earned" count, and a second device takes the filled record from the cloud. Login bonuses and lending from before this change are not in those records, so they cannot be filled in.

**The points screen.** The history is now one block per day, newest first:

- the date and the day's total;
- then each kind, for example 「勉強時間 120分 +600pt」 or 「単語カード 48語 +96pt」;
- the casino lines for that day.

30 days show at first, and 「もっと前を見る」 adds 30 more. The per-word lines are gone: the day totals replace them, and they no longer push anything out.

Tests:

- `tests/study-points.test.cjs`:
  - today's two words (one answered twice) make 2 words and 4pt;
  - the past card and study-time days are filled in, with one read for both one-time fills;
  - a second sync adds nothing twice;
  - another device reads the filled record instead of the award records;
  - 400 days are kept.
- `tests/weak-review.smoke.cjs` and `tests/casino.smoke.cjs` check the new day blocks.

## Points: giving and receiving, and a talk closer to LINE (10.22.62.00)

**What the user saw.** Points between players could only be lent, repaid, asked for (借りる) or claimed back (請求). There was no way to simply give points, or to ask for them. The points form hid behind text tabs, and there was no sign that the other side had read a line.

**Now.**

- **あげる.** A new entry kind `give`: the points leave the giver's wallet at once, in the same transaction that writes the record, and reach the receiver's wallet once when their device collects them (the same `claimed` mark as a loan). It is owed by nobody: no debt, no interest, and it does not count as a repayment.
- **もらう.** A new request kind `ask-give`. The one asked sees 「あげる」 and 「断る」. 「あげる」 sends a give for exactly the asked amount and closes the request in the same write.
- **Requests are matched to the move that answers them.** Before, any open request id closed with any move. Now a lend answers only an ask-lend, a repay only an ask-repay, a give only an ask-give, between the same two people (a give also for the same amount), otherwise 「この頼みには応えられません。」.
- **Nothing for the casino or the 運営.** A give or ask-give to either is refused (it would never be collected or answered).
- **Full records.** When a record is over its limit, collected gives and gifts go before the rest, and `claimed` is cut to the ids still in the record, so it no longer grows without end.
- **The points menu.** The ＋ opens six icon buttons (貸す 返す あげる 借りる 請求 もらう) like a LINE menu; the form for the chosen one opens under them. 返す and 請求 stay greyed out when there is nothing owed or lent. The profile has あげる and もらいたいと頼む too.
- **Cards.** Points lines are cards with the amount big (the words still read "50pt 貸した" for screen readers).
- **既読.** `record.read[id]` is the time of the newest line from the other side that `id` has seen. A talk that is open writes it with one merged write, only when a newer line has come and the page is visible; the time written is the line's own, not the device's clock. The write that comes back through the live record ends it, so there is no loop. 既読 shows under my newest line the other has seen.
- **The list.** Each person shows the last line, its time (or date), and a count of new lines from the other side.
- **History line.** Gives and receipts are counted in the points history's 「ポイントの貸し借り」 line, as loans and gifts already were.

**Checked, not changed.** `sugoroku.js` and `people.js` do not branch on entry kinds; the admin deletion and the 運営 ledger only read gift/charge in 運営 pairs, so player gives stay out of them.

Tests:

- `tests/point-loans-model.test.cjs`:
  - a give is owed by nobody and collected once; it is not a repayment and takes no interest;
  - an ask-give is answered only by a give of the same amount between the same two (wrong kind, direction, amount and unknown ids refused), and can be declined;
  - a full record keeps debts and drops collected gives first; `claimed` is cut to what remains.
- `tests/point-loans.smoke.cjs`:
  - the six buttons; a give from 貸し借りなし with the preview, note and big amount;
  - the receiver collects it once, and the 既読 mark is written once and not again on a second look;
  - 既読 shows on the giver's side under the give;
  - もらう is asked, answered with あげる, and cannot be answered twice from a stale screen;
  - a give or ask-give to the casino or the 運営 is refused.

## Points: a full record refuses a new transfer instead of dropping uncollected points (10.22.63.00)

**What could happen.** Found by the Codex review of 10.22.62.00. When a pair's record already held 400 entries that were all points waiting to be collected (a give, a loan, a repayment, a gift), adding one more cut the oldest entry off the record. The sender had already paid for it, so the receiver could never collect those points.

**Now.** When making room would drop points the receiver has not collected, the new line is refused with 「記録がいっぱいです。相手が受け取るまで、新しく送れません。」 and nothing is written (the refusal comes before the sender's wallet is touched, inside the same transaction). Once the receiver's device collects, the oldest collected entry goes as before. Messages and finished requests still go first.

Tests:

- `tests/point-loans-model.test.cjs`:
  - 400 uncollected gives: the next give and a message are refused and the oldest stays;
  - after the oldest is collected there is room again, and it is the one that goes;
  - the older cap test now collects each loan as it comes.

## Points: repayments to the casino never count as waiting to be collected (10.22.64.00)

**What could happen.** Found by the Codex review of 10.22.63.00. That version refuses a new line when making room would drop points the receiver has not collected. The casino never collects what a player sends it, so on a casino record with 400 entries a player's repayment looked "waiting" for ever, and the next repayment was refused: the player could not pay down the casino debt.

**Now.** Entries sent to the casino or the 運営 are never counted as waiting to be collected (neither collects anything), so a full record still takes them and drops the oldest as before. Entries sent to a player are guarded as in 10.22.63.00.

Tests:

- `tests/point-loans-model.test.cjs`: 401 repayments to the casino, or to the 運営, are trimmed to the limit without a refusal; the same entries sent to a player are refused.

## Points: what is owed no longer changes when old entries are cut (10.22.65.00)

**What could happen.** Found by the Codex review of 10.22.64.00 (the third finding in a row with the same root). Who owes whom was worked out from the entries still in the record. A record is capped at 400 entries, so when an old loan or repayment had to go, the number changed: dropping a repayment raised the debt (a second repayment was needed), dropping a loan erased it.

**Now.** The record has a `carry` field, `{ id: points that person is owed by the other }` (the two values are opposite). Each time the cap removes a loan or repayment, its worth (a loan with interest counts for what is due) is added to `carry`, so what is owed stays the same. Messages, finished requests and collected gives are not money owed and never touch `carry`.

- `net` and `owedBy` take the record (a bare list of entries still works). `send` (the limit on a repayment), `ask` (the limit on a 請求), the casino's 請求 and the screens all pass the record.
- Only whole numbers in `carry` count, since the database rules are open.
- `carry` is written by the same transactions that write the record, and every one of them keeps the whole record, so it persists.
- Pairs that lost entries before this version cannot be put right: the entries are gone.

Tests:

- `tests/point-loans-model.test.cjs`: a full record with a 1,000pt loan at 10% (1,100 to repay) and 399 repayments; five more repayments push the loan out; the amount owed falls by exactly what was paid; the limits on repaying and on a 請求 follow it; a message does not change `carry`; a tampered `carry` is ignored.

## Word book: reorder by dragging or with ▲▼ (10.22.66.00)

**What the user saw.** The only way to move a word was to open it, type a new number and save, with a confirmation when the number was taken. Moving a word far, or several words, took many steps.

**Now.** The word list has a 「並び替え」 button (for whoever may edit the book). The list becomes one short row per word: a grip, the number, the word and its first meaning, ▲ and ▼.

- **Drag.** The grip is held with a finger or the mouse; a line shows where the word will go, and the list scrolls when the finger is near the top or bottom edge. Dropping where the word already is changes nothing.
- **▲▼ and keys.** One place at a time; ArrowUp and ArrowDown on the grip do the same. The same button keeps the focus for the next move.
- **Undo.** The last move can be undone; each move is saved at once (the same save as the number box).
- **Filters stay.** The range, the unit, the search and the rating filters still apply, and a move jumps over the hidden words.
- **Numbers.** `VocabOrder.move(words, num, toIndex)` hands the display numbers (`no`) on: the words between the old and the new place shift one place and take the numbers next to them. A book whose numbers have gaps (a printed book's numbers) keeps the same set of numbers. The identity number `num`, and so records, notes, ratings, stickies and battle references, never changes.
- The number box in the word's editor still works as before.

Tests:

- `tests/vocab-order.test.cjs`: `move` up, down, to the first place and in place; numbers with gaps; the input is not changed; a default number leaves no field; unknown word or place is refused.
- `tests/vocab-reorder.smoke.cjs`: the mode and the cards coming back; ▲▼ disabled at the ends; one place down and up; focus stays; undo; drag with the mouse; dropping in place; keys; the rating and note on a moved word; the order is still there after a reload.

## お知らせボックス: points that come in from elsewhere are told there (10.22.67.00)

**What the user saw.** A share of someone else's line in すごろくビンゴ was only shown for a moment on the game's screen, and a day's study time (counted after 0:06 the next day) appeared only as a changed number and a line in the points history. Nothing said it had come, or when.

**Now.** The お知らせボックス has a 「あなたへ」 list above 「運営から」 for notices for this player. `personal-notices.js` keeps them in this device's storage per account (`aiglish_personal_notices_<id>`, the read time in `aiglish_personal_notices_seen_<id>`), newest first, at most 50. A notice with an id that is already there replaces it.

- **Bingo shares.** `pay()` in `sugoroku.js`, which every roll and the share taken on opening go through, adds 「ほかの人のビンゴの分け前 +Npt」 when real points (not practice chips) came in from other players' lines.
- **Study time.** `collectTime()` in `study-points.js` adds 「M月D日の勉強時間 +Npt」 (minutes and the rate in the text) when a day's points are counted for the first time or counted again with more. The id is `time:<day>`, so a day is one notice with its latest total.
- **Bell.** The badge counts the new notices with the team's and the login bonus (`personal-notices-changed` makes it redraw at once). Opening the box marks them read; the new ones keep their mark for that look.

**Kept on this device only.** The notices are not in the cloud: a second device does not show them, and they are not backed up. The points themselves are unchanged (wallet, history and ranking work as before).

Tests:

- `tests/personal-notices.test.cjs`: per account, newest first, unread until seen, replace by id, capped at 50, bad input refused, damaged storage read as empty.
- `tests/study-points.test.cjs`: a counted study day adds one notice with the day, minutes and points; counting again adds none; with more minutes it is the same notice with the new total; another account has none.
- `tests/personal-notices.smoke.cjs`: the bell badge, the 「あなたへ」 list with new ones marked, read once opened, a re-counted day shown again as new.
- `tests/sugoroku-shared.smoke.cjs`: the 120pt share taken on opening makes one notice.

## Reorder: undo is only for the same set of words (10.22.68.00)

**What could happen.** Found by the Codex review of 10.22.66.00. After a move, adding a word (with a number of its own) and then pressing 「元に戻す」 restored the numbers from before the move and deleted the number of the word that was not in that snapshot, so the new word could change its shown number, or share one with another.

**Now.** The undo keeps the set of words the book had when the move was made. If a word has been added or taken out since, the 「元に戻す」 button is not shown, and pressing it (from an old screen) says 「単語が追加・削除されたため、元に戻せません。」 without changing anything. Nothing about the other words or the added word's number is touched.

Tests:

- `tests/vocab-reorder.smoke.cjs`: after a move, a word added with its own number removes the undo button and keeps its number.

## 用語・年号モード: centuries and eras at the start of a line (10.22.69.00)

**What the user saw.** A line of a word could start with a year only (1192). History books also use centuries (12世紀, 紀元前3世紀) and eras (平安時代), which could not be asked or put in order.

**Now.** A line may start with one of three "whens"; `TermQuestions.parseLine` returns it as `when` (`year` stays as before, for a year only):

- **Year.** As before: 1582, 1582年, １５８２. A year question (typed digits) and 年代並べ替え.
- **Century.** `12世紀`, `紀元前3世紀` (also `前3世紀`), one or two digits. A question 「（何世紀？）」/「（紀元前何世紀？）」 answered by typing the number (key `c:<meaning id>`, kind `year`, so the typed answer, the word battle and the flashcard box work as for a year). The flashcard box says 「世紀を入力」 and takes two digits; a wrong answer says 「正解は 12 世紀」.
- **Era.** One of 縄文・弥生・古墳・飛鳥・奈良・平安・鎌倉・室町・安土桃山・江戸・明治・大正・昭和・平成・令和 followed by `時代`. A card 「（何時代？）」 → the era (key `e:<meaning id>`, kind `era`, rated by the player, not typed; in the word battle it is an ordinary question). The 時代 is required, so a line that only starts with an era's name (明治維新…) is not taken for an era.
- **Questions.** The whole-entry card shows the line with its "when" in front; a 「」 question shows it after the headword; the question text keeps the "when" and the 「（何…？）」 in one piece.
- **年代並べ替え.** Events are the lines with a "when". A round uses one kind only (years with years, centuries with centuries, eras with eras: a century and a year inside it cannot be told apart). A century or an era is ordered by when it began; a kind needs three different values to be played. The message when nothing can be played now says 「年・世紀・時代の入った説明が足りません」.
- **Word list.** The "when" carries the same light marker as a year, coloured by its question's results (keys `y:`, `c:`, `e:`).
- **Edit box.** The box of a line in the word editor takes 1582, 12世紀 or 平安時代 (「平安」 is said back as 平安時代, 「前3世紀」 as 紀元前3世紀) when it is left; anything else is marked red and the save is refused before anything is changed. It no longer cuts the text to digits as it is typed.
- **Add form.** The hint says a year, a century or an era can start a line; the cards it makes show before the word is added. (Write it at the start of the line, as for a year.)

Stored text is unchanged: the "when" is the start of the line, as a year always was, so old books read the same.

Tests:

- `tests/term-questions.test.cjs`: parsing a year, a century, a BC century, an era, a name that only starts like an era, "0世紀"; the questions and their keys; typed century answers; the box text (`whenText`); the pieces kept whole.
- `tests/term-order.test.cjs`: events of the three kinds with their start values and keys; one kind per round; only kinds with three different values are played; a BC century comes before the others.
- `tests/term-when.smoke.cjs`: the add form's hint and cards; the century card typed (box label, two digits, the right answer shown) and an era card (no box); the word list's markers; the edit box saying 平安 as 平安時代, refusing "abc" without changing anything.
- `tests/term-mode.smoke.cjs`: the edit box takes 「１５８３年」 and leaves it as 1583 on leaving it.

## お知らせボックス: a re-counted study day is labelled as the day's total (10.22.70.00)

**What the user saw.** Found by the Codex review of 10.22.67.00. When a day's study time was counted again with more minutes, its notice was replaced with the new total under the title 「…の勉強時間 +350pt」, as if 350pt had just come in, when only the difference (for example 50pt) had been added.

**Now.** The title is always the day's total: 「M月D日の勉強時間 合計 350pt」. The first time the body says 「勉強時間 70分（1分5pt）。所持ポイントに加わりました。」; when the same day is counted again it says 「…。あとから +50pt 加わりました。」 with the difference that was credited this time. The notice is still one per day.

Tests:

- `tests/study-points.test.cjs`: the first notice says the total and that it was added; counting again with more minutes keeps one notice with the new total and says what was added.
- `tests/personal-notices.smoke.cjs`: the texts shown in the box.

## ランキング: a カジノ sub-tab with lifetime totals per game (10.22.71.00)

**What the user saw.** The ランキング tab had 学習 and ポイント. There was no record of how much a player had bet, won or played in each casino game.

**Now.** A third sub-tab, カジノ, right of ポイント. For each game, one row of podiums that scrolls sideways (the page does not):

- ポーカー, ブラックジャック, ルーレット, ダイスポーカー, チンチロ: 累計賭け額 (points bet), 累計得額 (points back less points bet; below zero too, and ranked as it is), プレイ回数.
- すごろくビンゴ: the same three, and ビンゴ回数 (lines), JP回数, SJP回数, ボール排出回数.
- A player is on a game's podiums once they have played it. Tapping a podium opens that player's totals for the game; under each panel the player's own place is shown (from this device).

**How it is counted** (`casino-stats.js`, pure):

- The five games are counted in `Poker.settle`, inside the wallet transaction and after the key check, so a result is counted once even if it is settled again (retries). `net` adds every amount that reaches the wallet; a stake (not the `:extra` loss past the bet) adds to the bet, and the first stake of a round (key ends `:bet`) is a play. Poker adds the pot it was in (`hand.total`) as the bet and one play per hand (leaving or giving up a hand uses the same key, so it counts once). The group dice table (`dice-together`) is dice; タイマン (duel) and the すごろくビンゴ jackpot payouts are not counted. Practice chips never reach the wallet, so they are not counted.
- すごろくビンゴ keeps its lifetime totals in its own save (bet, won, rolls, balls, bingos, jackpots). `Sugoroku.stats()` reads the save of real play (never the practice one) and the casino passes it to `settle` with each sugoroku batch, and publishes it once at the start when it changed (`Poker.publishStats`); it replaces the entry and never with lower numbers, so an older save cannot take the totals back.
- Kept in `users/{id}/learningPoints/main.casinoStats` (the copy that counts), copied into `users/{id}.casinoStatsV1` for the ranking to read, and on this device (`aiglish_casino_stats_<id>`). The study points' full wallet write keeps `casinoStats` (as it does `poker` and `casinoLog`).
- No past results can be counted for the five games: they start with this version. The screen says so (すごろくビンゴ starts from its saved totals, but only once that device has opened the app or played with this version).

**The ranking** reads one more field only (`casinoStatsV1`; no new index, the same one-month filter). The rules are open, so what is read is checked: only known games, whole numbers, a game needs a play, and a total that cannot be true (lost more than was bet, or won more than 100 times the bet plus 1,000,000) is not shown. Mode switches read nothing; the update button reads, as for the other modes.

Tests:

- `tests/casino-stats.test.cjs`: which key is which game; a round's bet, play and net; すごろくビンゴ totals replacing and never lowering; wrong and made-up numbers; the metrics and labels.
- `tests/casino.smoke.cjs`: a lost blackjack round, the poker lines and すごろくビンゴ in the wallet document, copied to the player's own document and kept on the device; a poker hand settled twice counts once; the group dice table is dice and a duel is not counted.
- `tests/study-points.test.cjs`: the full wallet write keeps `casinoStats`.
- `tests/ranking-query.test.cjs`: the casino group reads only its field.
- `tests/casino-ranking.smoke.cjs`: six games with 3 and 7 panels; the orders (net below zero too); a made-up total not shown; only players who played; own row; detail; sideways scrolling and no sideways scrolling of the page; switching modes does not read.

## Two review fixes: era questions in a duel, and "counted again" for study time (10.22.72.00)

**Found by the Codex reviews of 10.22.69.00 and 10.22.70.00.**

- **Era questions in a word duel.** The new `era` question kind (「平安時代」 as an answer) was not in the duel model's kinds, so an era question was treated as an ordinary one: its prompt was cut at 160 characters instead of 400 (the 「（何時代？）」 at its end could go) and its choices were not taken from other eras first. `era` is now one of the kinds, with the room checks of the others (a room of version 11; older versions refuse it). Only a few eras can be answers, but the choices fall back to other terms when the book has too few, as for a 「」 term.
- **"Counted again" for study time.** The notice for a day's study time said 「あとから +Npt 加わりました」 only when the first notice was still in this device's list. It now follows the credit: counted again exactly when what is added now is less than the day's total (part of it was credited before, on this or another device, and whether or not a notice is still kept).
- **Tests that depended on the date.** Four study-points tests took "two days ago" for a day to count; after 2026-11-02 that day was paid at the new 5pt a minute and they failed on the old amounts. They use a fixed day in October.

Tests:

- `tests/term-battle.test.cjs`: era questions keep their kind in a pool, with the long prompt, with era choices, in a valid room of version 11 and not of version 10.
- `tests/study-points.test.cjs`: with the first notice cleared, a day counted again says what was added; the date-dependent tests use a fixed day.

## 年・世紀の入力: the question stays in view while typing (10.22.73.00)

**What the user saw.** On an iPhone, tapping the box of a year (or century) question opened the keyboard, and the phone moved the whole screen up to keep the box above it. The top of the question (the headword and the start of the sentence) went off the top of the screen, so it could not be read while answering.

**Cause.** The answer panel sat in the lower half of the flashcard screen, under where the keyboard comes up. The keyboard covers the lower half, so the page was moved up to keep the box in view.

**Now.** While the box has focus, the panel moves to the top of the flashcard screen (where nothing has to move) and carries the question in it, as the card shows it, with the headword in bold and the year or blank kept whole. A long question scrolls inside it. The panel goes back to the bottom a moment after the box loses focus (so that a tap on 答える, which takes the focus away first, is not lost to the panel moving under the finger), and at once with the next card. After an answer the question stays in the panel with 「正解！」 or the right answer, until the next card.

Tests:

- `tests/term-when.smoke.cjs`: focusing the box puts the panel at the top with the question in it; leaving it moves the panel back after a moment; the question stays with a wrong answer's text; the next card starts with the panel back. (The phone's keyboard itself cannot be run in the test: what is checked is that the box and the question are above the middle of the screen, where the phone has no need to move the page.)

## ランキング › カジノ: one game at a time, on one screen (10.22.74.00)

**What the user saw.** 10.22.71.00 listed all six games one under the other, each in a row of panels that scrolled sideways, so the ranking had to be scrolled both ways and a game's panels were never seen together.

**Now.** Choosing カジノ shows six buttons (ポーカー, ブラックジャック, ルーレット, ダイスポーカー, チンチロ, すごろくビンゴ) in two rows, and the panels of the chosen game only:

- Five games: the three panels (累計賭け額, 累計得額, プレイ回数) in a column, as the three 学習 panels are, filling the screen.
- すごろくビンゴ: the seven panels in two columns of four rows (the last row has one panel), with smaller podiums.
- Nothing scrolls, in the list or the page, at 393×852 and at 320×668. The game chosen is kept while the screen is open; choosing a game reads nothing (every game's totals come with the one read of the update button).
- The note under the panels is one short line; the hint about sideways scrolling is gone.

Nothing else changes: how the totals are counted, stored and read is as in 10.22.71.00.

Tests:

- `tests/casino-ranking.smoke.cjs`: the six buttons; each game shows 3 (すごろくビンゴ 7) panels; no scroll in the list or the page and every panel inside it, for each game at 393×852 and 320×668; choosing a game does not read; the orders, own row, tampered totals and detail as before.

## Review fixes for the カジノ ranking and the typing panel (10.22.75.00)

**Found by the Codex reviews of 10.22.71.00 and 10.22.73.00.**

- **A loss past the bet is true.** The ranking hid a game's whole record when its net was below minus the bet. But an accident in すごろくビンゴ or the 「:extra」 loss in チンチロ takes more than the stake, so real records were hidden. The bound is now the same both ways: a net further than 100 times the bet plus 1,000,000 from zero is not shown.
- **Jackpots count in すごろくビンゴ's net.** A jackpot is paid on its own (key `casino:sugoroku-jackpot:…:pay`) and is not in the save's `won`. `Poker.settle` adds it to a field `jw` of the すごろくビンゴ entry of `casinoStats`; a snapshot from the save keeps `jw` and never lowers anything; the ranking shows `n + jw` (bounded like the rest). `jw` is not a panel of its own.
- **A zero-net batch still counts.** A batch of すごろくビンゴ rolls that nets to exactly zero was dropped without a write, so its rolls were missing from the ranking until the next one. It now publishes the totals (`Poker.publishStats`, which writes only if something changed).
- **The question stays while an answer is on show.** On a phone a tap on 答える does not focus the button, so the box lost focus with nothing in the panel focused, and 0.4 seconds later the question was hidden and the panel moved back down while the result was still shown. The panel now stays as it is while an answer is on show (`data-result` is set), until the next card.

Tests:

- `tests/casino-stats.test.cjs`: a loss past the bet is shown, a boundless one is not; jackpot payouts add to `jw`, survive a newer snapshot, never go back with an older one, are bounded; the jackpot key.
- `tests/casino.smoke.cjs`: a jackpot paid with its own key goes to `jw`, not to the plays.
- `tests/term-when.smoke.cjs`: with the focus taken out of the panel, the question and the panel stay while the answer is shown.

## Betting allowance: what is not used carries into the next day (10.22.76.00)

**What the user saw.** Points can be bet only after studying: 100pt for each minute measured that day, for all the casino games together. What was not used was gone when the day changed.

**Now.** What is left of a day's allowance carries into the next day and ends there:

- Each day has its own allowance (the minutes measured that day × 100). What carries into today is what was left of **yesterday's own** allowance, after yesterday spent what had carried into it first (so a day's leftover is never carried twice, and the day before yesterday's leftover ends with yesterday).
- Today's allowance is that carry plus today's own, less what was bet today (the carried part is used first). The casino tab says 「今日あと Npt 賭けられます（今日の勉強 M分・昨日の使い残し Kpt を含む）」, with the carried part still unused (the part after 「・」 is left out when there is none). The hint when it is used up says that yesterday's leftover can be used until the end of today.
- Bets are kept per day on this device (`aiglish_casino_staked_<id>`: `{ days: { "YYYY-MM-DD": amount } }`, the last four days); the older form (one day, `{ day, amount }`) is still read. The study minutes of past days come from the study ledger. Looking back is three days at most.
- Practice chips have no allowance, as before. Nothing changes for the amount a game accepts (`stakeRoom`, `allowance` keep their names); only what `allowance()` returns is larger when something carries.

Tests:

- `tests/casino-carryover.smoke.cjs`: the day before yesterday's leftover does not reach today; yesterday's does; yesterday's bets use what had carried into it first; the carried part is used first today; the text with and without 「昨日の使い残し」; used up: no more, and the hint; the older record form; four days kept.

## Settings screens: tidier, and each on one screen (10.22.77.00)

**What the user saw.** The settings were crowded: the app's 設定 dialog was a tall stack of separate cards, with the Gemini key at the bottom, and needed scrolling even on a tall phone (804px for 852px of screen, 854px of content); the card study settings had numbered titles (①②③) and a book picker that repeated the dialog's title; the add-word form grew past a phone screen as soon as its extra settings were opened.

**Now.** On a phone 390×740, none of the three scrolls.

- **設定 (the app's).** Three groups with a small title each: サウンド (BGM and 効果音 in one card, with a line between them; the track beside its label), 単語の読み上げ (the pronunciation switch, 自動で読む, 速さ, 発音 with 試す, ハンズフリー), and AI取り込み (the Gemini key and its save button on one line). 658px, from 804px. Every control keeps its id. The 「アイコンに未読数」 card, which was meant to be hidden where the phone cannot show a badge, is hidden there now (a style was overriding `hidden`).
- **カード学習設定.** No numbering. In a column: 最初に出す面 (two buttons), 出題範囲 (two numbers and 〜), 単元 (when the book has units), 出す理解度 (○△×ー and what is chosen), then カードを開始する and 戻る. The book is the dialog's title, so the 教材 picker is kept for the code but not shown there. 466px, from 587px.
- **単語を追加.** Smaller fields and chips (the parts of speech on one row), tighter spacing, and 単元 beside 単語番号 in the extra settings. 380px from 537px closed; with the extra settings open 633px (from 966px), and with a second meaning open the form is just within the screen.

Tests:

- `tests/settings-fit.smoke.cjs`: at 390×740 the app settings (three groups, every id, the key beside its button), the card study settings (no ①②③, the fields, the book's title, the direction buttons), and the add-word form (also with the extra settings open, 単元 beside 単語番号, and a second meaning) fit without scrolling.

## Two review fixes: a zero-net batch kept until published, and carrying on past three days (10.22.77.00)

**Found by the Codex reviews of 10.22.75.00 and 10.22.76.00.**

- **A zero-net batch is kept until published.** A batch of すごろくビンゴ rolls that nets to exactly zero is removed after its totals are published (`Poker.publishStats`); if that write fails (offline), it stays and is tried again, and its share for the jackpots is added once, after it succeeds. Before, it was removed even when the publish failed, so the rolls stayed out of the ranking until a later write. A batch with no save of すごろくビンゴ to publish is removed as before.
- **The carry-over keeps a run of days whole.** The betting allowance carries what was left of yesterday's own allowance, after yesterday had spent what had carried into it first. A player who studies a minute and bets 100 every day therefore keeps 100 carrying on every day. The calculation looked back only three days and took what carried into the oldest day as zero, which made such a run collapse to nothing. What had carried into a day is now kept on this device when it is worked out (`aiglish_casino_staked_<id>`, `carried`, the last four days), never lowered (the study record can still be arriving from another device), and used as the base of the look back. A run stays whole as long as the app is used on the days; where days were skipped it is rebuilt from what is kept and the study record, never made up.

Tests:

- `tests/casino.smoke.cjs`: a zero-net batch stays while the write fails, and goes once it works.
- `tests/casino-carryover.smoke.cjs`: a run of days each studied 1 minute and bet 100: nothing is made up without what was kept; with the base kept, 100 carries into today (the text says so), today's is kept and not lowered by a later bet.

## Betting allowance: the carry-over fades, and starts from 2026-11-04 (10.22.78.00)

**What the user saw.** With 10.22.76.00 and 10.22.77.00 the casino said 「今日あと 13,700pt 賭けられます（…昨日の使い残し 12,800pt を含む）」. That 12,800pt was yesterday's whole unused allowance: 140 minutes studied × 100pt, less a little bet. It was far more than was meant. (It came from the study done the day before the update.)

**Now.**

- **It fades.** What is not used of a day's allowance (its own minutes × 100) carries on worth less each day: all of it the next day, then half (2 days old), a quarter (3), an eighth (4), a sixteenth (5), and nothing from 6 days on. Whole points, rounded down.
- **The oldest first.** What is bet takes the oldest allowance that is still worth something first (it fades soonest). It is worked out day by day over the last five days from the study record and the bets of each day (kept on this device, the last six days), so no state is kept between days, and the result does not depend on when the app was open.
- **Only from 2026-11-04.** A day's allowance carries only if the day is 2026-11-04 or later. Study done before this began (the day before, with its 140 minutes) is not carried. Today's own allowance is counted every day as before.
- The casino tab says 「今日あと Npt 賭けられます（今日の勉強 M分・持ち越し Kpt を含む）」 (K: the carried part not yet used today), and the hint when it is used up says that what is left carries on and halves from two days on.
- Replaces the carry of 10.22.76.00 (one day) and the kept `carried` values of 10.22.77.00 (which are no longer written or read).

Tests:

- `tests/casino-carryover.smoke.cjs` (the clock is fixed): all of yesterday, half of two days ago, a quarter, a sixteenth, nothing from six days; bets take the oldest first, today's and yesterday's; a run of days each with 1 minute studied and 100 bet; on 2026-11-04 the 140 minutes of the day before carry nothing, on the 5th the 4th carries and the 3rd does not; the older record forms; six days kept.

## Settings on a short phone, with the badge card shown (10.22.78.00)

**Found by the Codex review of 10.22.77.00.** The 「アイコンに未読数」 card is shown where the phone can show an app badge (an installed app). The fit of 10.22.77.00 was checked at 390×740, where the settings with that card are 656px (within 692px), but on a phone 667px high they were 671px against 619px, so they scrolled; the add-word form with its extra settings open was 12px over.

**Now.** Below 700px of height, the app settings (dialog, group titles, cards, rows, the badge note, the key row) and the add-word form (padding, labels, the sub-info box, buttons) are tighter: the settings are 547px at 375×667, and the form with its extra settings open 636px of the 649px there is. (A phone 568px high, the oldest small ones, still scrolls.)

Tests:

- `tests/settings-fit.smoke.cjs`: at 375×667, with the badge card shown (asserted visible), the app settings, the card study settings and the add-word form with its extra settings fit without scrolling.

## The talk: my open request no longer breaks its amount (10.22.79.00)

**What the user saw.** In the points talk, a request of mine that was waiting for an answer (「もらいたいと頼んだ・返事待ち」, 「借りたいと頼んだ」, 「請求した」) showed its amount broken in two lines, "50" and "0pt" for 500pt, with the 「取り消す」 button squeezed to two lines beside it.

**Cause.** The old style of a waiting request of mine (`.loans-request.is-mine`, from before the talk had cards) lays its content out in a row. In a card that put the 取り消す button beside the words, which left too little width, and the amount broke where it could.

**Now.** The card of such a request is a block: the amount and its icon on one line (the amount never breaks), the words under them, and 取り消す under the words at the right (also on one line). The answer buttons of a request waiting for my answer (断る, 貸す, 払う, あげる) stay in their own row and do not break either.

Tests:

- `tests/point-loans.smoke.cjs`: my waiting request is a block, its 取り消す is under the words, and the amount cannot break (no wrapping).

## 10.22.80.00 カジノランキングの「すごろく」を2タブに分けた

**What the user saw.** In the カジノ ranking, すごろくビンゴ showed seven panels on one screen, each too small to read.

**Cause.** One game with seven numbers (賭け額・得額・プレイ回数・ビンゴ・JP・SJP・ボール) was squeezed into a 2-column grid.

**Fix.** The game chips now have two for it: 「すごろく基本」 (賭け額・得額・プレイ回数, three panels like the other games) and 「すごろく記録」 (ビンゴ回数・JP回数・SJP回数・ボール排出回数, a 2x2 grid). Only the view changes; nothing is read again and the stored numbers are the same.

Tests:

- `tests/casino-ranking.smoke.cjs`: seven chips, 3 panels for 基本 and 4 for 記録, both fit on 393x852 and 320x668 without scrolling, and the counts still read from `sugoroku:g/j/s/l`.

## 10.22.81.00 すごろくビンゴ: 1周100マスと「確変」ルーレット

**What the user asked.** Make a lap 100 squares, and, in exchange, add a rare flashy chance to the normal wheel that leads to a 確変 wheel (a run of balls, or the bingo wheels), without breaking the balance. The owner then asked for the flashy chance to come fairly often.

**What changed.**
- The ring is 100 squares (`RULES.board`). A lap ball now comes about every 29 rolls instead of 23; the lap ball was only about 2% of all balls, so this barely moves the game. The positions of the event and accident squares move for an existing save, but the save format (v3, `pos`) is the same and every `pos` of 0–79 is still valid.
- In the normal wheel the four top slots (×10, ×5, ×1.5, ×1) are now four 確変 slots (1 in 10 spins). A 確変 slot spins the 確変 wheel (`RULES.kakuhen`, 12 slots): ×2, ×3, ×4, ×5 (five slots), ×10 (two slots) and 2 balls drawn one after another (two slots). Balls are drawn like any ball, so a line made leads to the bingo wheels as usual.
- The multiples that used to be on the normal wheel moved into the 確変 wheel, so the normal wheel pays what it did: the plain-play return measured by Monte Carlo (3 players, jackpots excluded) is about 0.86 before and after, and the balls drawn per roll are the same (0.146 vs 0.148). A first version with 3 to 10 balls on the 確変 wheel gave the same return but 47% more balls, hence more bingos and jackpot wins (each win puts a fresh seed into the pot), so the 確変 wheel keeps its balls at two, pays more in multiples, and the normal wheel has one ball slot fewer (an Opus review of the balance).

**Screen.** `kakuhen` wheel: the room dims like the bingo wheel, gold/ball colours, labels 確変 and ●×n, 「確変チャンス！」 on the normal wheel and 「ボール n連続！」 on the 確変 wheel.

Tests:

- `tests/sugoroku-model.test.cjs`: 100 squares, four 確変 slots, the 確変 wheel's shape, a ×10 result pays 1,000, a run of two balls draws two balls (and pays 2× for each that misses).
- `tests/sugoroku.smoke.cjs`: 100 squares, the 確変 wheel comes up on a 確変 slot and its ×10 pays 1,000.

**Also in 10.22.81.00 (a Codex finding on #356).** The betting allowance's carry replayed only the last five days, so once the 2026-11-04 start was more than five days back, a bet five days ago was charged to that day's own allowance instead of the older (six-day-old) one it could still have used first, and the carry was half what it should be. The replay now starts `REPLAY_DAYS` (10) back and the bets of the last eleven days are kept (`casino.js`). Test: `tests/casino-carryover.smoke.cjs` (six and five days ago 100 minutes each, 5,000 bet five days ago: 625 carries, not 312).

## 10.22.82.00 すごろくの説明文を確変ルーレットに合わせた（Codexの指摘）

**What the user saw.** The in-game rules (「?」) still said the normal wheel pays ×10 to ×0, though the top slots became 確変 slots and their multiples moved to the 確変 wheel, so the text contradicted the payouts and never said how to reach them.

**Fix.** `RULES_TEXT` in `sugoroku.js` now says ×0.25 to ×0, explains the 確変 slot (about 1 spin in 10) and the 確変 wheel (×2 to ×10, or two balls in a row, then the bingo wheel if a line is made), and that START after a 100-square lap gives a ball.

**Not changed (a Codex finding, kept on purpose).** The betting allowance's carry replays the last 10 days. An allowance 15 days old could in theory still have paid a bet 10 days ago; with, say, 1,440 minutes studied on three separate days and bets of 144,000pt the difference is 35pt. A perfect answer needs the whole history, so the 10-day replay is kept as a close estimate.

Tests: `tests/sugoroku.smoke.cjs` opens the rules and checks they mention 確変.

## 10.22.83.00 用語・年号モード: 1つの問題に○を付けると、同じ行のほかの問題が出なくなる

**What the user saw.** In 用語・年号モード flashcards, the 「」 blank questions did not come up, and the same questions kept coming back. (The lines start with a year.)

**Cause.** One line makes up to three questions (the whole entry, the year, each 「」). A question not answered yet goes by its meaning's rating, but answering any one of them (the year, ○) set that meaning's rating to ○. With ○ left out of the filter, the line's other questions, never answered, were hidden as well, so only the questions answered × (which have their own record) stayed, again and again.

**Fix.** Before the first answer to a meaning in this mode, its rating is kept as `m:<meaning id>` (`{ base }`) in the term progress (`TermProgress.noteBase`, called by the swipe wrapper). A question without a record of its own goes by that kept rating (`TermProgress.fallback`), in 単語カード (`game_core.js`) and in the duel lobby (`duel-lobby.js`). Records made before this change have no kept rating and behave as before. The extra key is not a question, and every reader looks questions up by key.

Tests:

- `tests/term-sibling-status.smoke.cjs` (new): with ○ left out, a ○ on word 1's year question hides only that question; its whole question and 「」 blank are still asked; the kept rating is stored.
- `tests/term-flashcard-filter.smoke.cjs`, `term-mode`, `term-battle`, `term-when` still pass.

## 10.22.84.00 用語・年号モード: 対戦の最初の間違いでも、答える前の理解度を控える（Codexの指摘）

**What the user saw.** Nothing yet; found in review of 10.22.83.00. If a battle was the first thing to touch a meaning rated ○ and the answer was wrong, the battle lowered the meaning to × before any rating was kept, so the line's other (unanswered) questions were counted as × and dropped from a ○ filter.

**Fix.** The battle (`word-duel.js`) keeps the meaning's rating first (`TermProgress.noteBaseFor`, read from the learning data) when an answer can lower it (a wrong or skipped answer).

Tests: `tests/term-sibling-status.smoke.cjs` — a ○ meaning lowered to × by a wrong battle answer keeps `{ base: "ok" }` and the fallback stays ○.

## 10.22.85.00 用語・年号モード: 引き継いだ○の問題を対戦で間違えたら×にする（Codexの指摘）

**What the user saw.** Nothing yet; found in review of 10.22.84.00. A question with no record of its own goes by its meaning's rating (○). A wrong battle answer on it was only recorded when the question had its own ○ record, so it stayed ○ (inherited) and a filter that leaves ○ out hid the question the player had just missed.

**Fix.** `TermProgress.noteBaseFor` returns the rating the question inherits, and `TermProgress.battle` takes it as `inherited` and treats it as the previous rating when the question has no record of its own: a wrong answer then records ×.

Tests: `tests/term-sibling-status.smoke.cjs` — an inherited ○ question answered wrong in a battle becomes ×; `tests/term-battle.smoke.cjs` still passes.

## 10.22.86.00 単語カードは答えるたびにポイント／すごろくの「確変」の表示をやめて ×0 の枠に見せる

**What the owner asked.** (1) Review matters, so a flashcard answer should earn every time, not once per word a day. (2) In すごろくビンゴ, do not write 確変; the bonus slots should read ×0 and play a 激アツ effect when the wheel stops on one.

**Points.** `study-points.js`: for the `card` source only, the first answer of a word in a day keeps its plain token `[day, book, num]` (so a battle or review done before it still blocks nothing, and a card answered first still blocks them, as before); each repeat gets its own token `num#<device>-<k>` (device = first six characters of `aiglish_study_device`, so two devices never claim the same token). Limits, so the day's records stay small and swipe-back-swipe cannot farm: 10 paid answers of one word a day and 500 paid repeats a day in all (over the limit pays 0, no error). Past days' repeat tokens are dropped locally at the next award (the cloud keeps them, and its idempotence is by token). The daily history counts answers, so its label reads 「n回」. Battle, review and work are unchanged (once per word a day). An Opus review of the design found: no double credit in retries/offline/two devices, a device tag needed, and a cap needed (casino bets use the study-time allowance, not points, so betting is not raised; points, earned and the rankings are).

**すごろくビンゴ.** The four hidden slots are drawn and labelled ×0, same colour as a real ×0 slot. When the wheel stops on one, the result reads ×0 for a moment, then the room goes gold and shakes (激アツ！！) and the 激アツルーレット (×2 to ×10, or two balls in a row) spins. The word 確変 no longer appears on screen (the rules text and the usage guide say 激アツ). Odds, pay and balance are unchanged.

Tests:

- `tests/study-points.test.cjs`: a card answer earns every time (10 for one word, then 0); the plain token and `#device-k` tokens; a card after a battle earns, a battle after a card does not; two devices offline each get their repeats credited once; past repeats are dropped; the existing tier / history tests follow the new rule.
- `tests/sugoroku.smoke.cjs`: the title and rules say 激アツ and not 確変.

## 10.22.87.00 すごろくのボーナス枠を 40回に1回ほどにし、「激アツ」の文字をやめた

**What the owner said.** The bonus slot came up too often, and the word 激アツ on screen was uncool.

**Odds.** One hidden slot in 40 (2.5%, about once in 40 normal-square spins) instead of four (10%). To keep the game's balance the 12-slot bonus wheel pays more: ×10, ×12, ×15, ×20, ×25 (two), ×30, ×40 (two), and five balls in a row (three slots). Monte Carlo (3 players, jackpots excluded, 900,000 rolls each): return 0.856–0.859 (before this change 0.86), balls per roll 0.144 (0.146 before), so bingos and jackpots stay at their old rate. The other ×0 slots became 19 plain and 3 "blank" ones (same pay, a second kind so no two equal slots stand side by side).

**Words.** The bonus wheel is titled BONUS and the effect reads CHANCE (the screen's other wheels are in English too: EVENT, ACCIDENT, BINGO). 確変 and 激アツ appear nowhere on screen; the rules text and the usage guide describe it as a ×0 slot that lights the room gold, then the BONUS wheel.

Tests:

- `tests/sugoroku-model.test.cjs`: one bonus slot in the normal wheel, the bonus wheel holds ×10 and ×40 and a five-ball run (five balls are drawn), a ×10 result pays 1,000.
- `tests/sugoroku.smoke.cjs`: the BONUS wheel comes up and pays 1,000; the rules text says BONUS and neither 確変 nor 激アツ.

## 10.22.88.00 単語カードのポイント: 先にバトルで取った単語でも、カードは10回入る（Codexの指摘）

**What the user saw.** Nothing yet; found in review of 10.22.86.00. When a battle or review had already taken a word's plain receipt that day, the card started at the second slot and could pay only 9 times (the cap counted that receipt as a card answer).

**Fix.** The plain receipt counts as one of the card's 10 only if a card answer made it (the points history says which, and a missing record counts as a card); otherwise the card has all 10 of its own (`cardNum` in `study-points.js`). Test: `tests/study-points.test.cjs` (a word taken by a battle first: the card pays 10 times, then 0).

**Not changed (a Codex finding, kept on purpose).** The 500 repeats a day is counted on each device from its own record. It is there to keep a device's storage small (and to stop swipe-back-swipe farming); counting across devices exactly would need a cloud read for every answer. Two devices can therefore pay up to 500 each.

## 10.22.89.00 単語カードのポイント: 履歴から消えた記録でも、カードの回数を少なく数えない（Codexの指摘）

**What the user saw.** Nothing yet; found in review of 10.22.88.00. Whether the plain receipt of a word came from a card answer is read from the points history, which keeps only the latest 100 entries (with heavy card use that is quickly full). A receipt taken by a battle or review that had fallen out of it was counted as a card answer, so the card paid 9 times, not 10.

**Fix.** A receipt counts as a card answer only if the history says so (`cardNum` in `study-points.js`). When it no longer says, the card may get one answer more than the limit, never one less. The limit is a soft one (it is there to keep storage small), so one over is harmless. Test: `tests/study-points.test.cjs` still passes (a battle first, card 10 times; a card first, 10).

## 10.22.90.00 自分用にした単語帳が、原本の変更を単語ごとに自動で取り込む

**What the owner asked.** When the original of a book I made my own (a distributed book, or a public book from みんなの単語帳) changes, the changes should be saved into my copy automatically; replace only the words the original changed and keep the words I changed myself.

**How it works.** `copy-follow.js` (pure) keeps, for each copy, a base: a fingerprint of every word of the original as the copy last caught up (`fp`, by the original's number) and, for a copy that numbers its words afresh, where each sits in the copy (`map`). It is kept in `aiglish_copy_base_<owner>_<book>` (on the device; it goes into the full save like the other keys; deleted with the book). A change of the original is then told word by word: a word the original changed is replaced only if the player has not changed it; a new word is added; a dropped word is dropped only if the player has not changed it. Words the player changed, added or deleted stay theirs. A replaced word keeps its number, so ratings, notes and sticky notes stay.
- Distributed book copies (`library.js` `followSharedBooks`): as before, on the next start after the admin's change (the shared index's `updatedAt`). A copy with no base yet: one behind its original takes the original whole once (as it always did), one up to date gets a base from the original and keeps all its words.
- Copies of a public book (new `followPublicCopies`): the copy remembers the public book (`copiedFromPublic`, `sourceSyncedAt`); at most every 6 hours it reads the public document once and merges the same way. Copies made before this have no link and are not followed.
- New copies get their base when they are made (`copyBook`, "自分用に追加").
- Safety found by an Opus review before shipping: a copy made now carries `followBase: 1` on its catalog record (which does sync across devices), so on another device where the base has not arrived it keeps all its words and starts a new base instead of being replaced whole (only copies made before this, without the mark, are replaced once when behind); what a follow finds out (`sourceSyncedAt`, the mode) is put on the catalog as it is at the end, not the copy read before the network waits (which would overwrite a rename or hide made meanwhile); the open book is skipped while a game is on and captured first otherwise; the words are stored before the base moves on (a full storage retries next time); a new word of the original whose number the player already uses goes to a number of its own; a replaced word keeps the player's order (`no`) and links.

Tests:

- `tests/copy-follow.test.cjs` (new): fingerprints, replace / add / drop, the player's own words stay (changed, deleted, added, a number clash), a copy that numbers afresh, nothing changed.
- `tests/copy-follow.smoke.cjs` (new): a distributed copy and a public copy follow their originals word by word and keep the player's edit; the public book is read once and not again within the hours.
- `tests/shared-book-follow.smoke.cjs`, `shared-book-editing`, `library-management` still pass.

## 10.22.91.00 自分用にした単語帳の追従: 読み込まれていないコピーに触らない／空の公開本／新しい単語へのリンク（Codexの指摘）

**What the user saw.** Nothing yet; found in review of 10.22.90.00.
- A copy synced from another device whose words are not loaded here yet (`copyMaster()` is null) was replaced whole by the original even with `followBase` set, which a later save could use to overwrite the player's edits. Now such a copy is not touched at all (no base, no mark moved) until its words are on this device.
- A public book whose owner replaced its words with an empty list was skipped, so copies kept all their old words. An empty list is now applied: the words the player did not change go, theirs stay.
- A public update that added words linked to other new words lost the links (the numbers were not given out yet). Links of made words are now put on after the merge, from the final map; a word that already has the player's own links keeps them.

Tests: `tests/copy-follow.smoke.cjs` — an unloaded copy is left alone (no words, no base, its time unchanged); a new word's link points at the copy's number; an emptied public book removes only unedited words.

## 10.22.92.00 自分用にした単語帳: 空にされたコピーを「空で確定」にする（Codexの指摘）

**What the user saw.** Nothing yet; found in review of 10.22.91.00. When a public book's owner emptied it and the copy had none of the player's own words left, the merge produced an empty list, but `setCopyMaster` stored it as `emptyConfirmed: false`, which `VocabMaster.resolve` does not take as a valid empty draft. The copy could resolve to an old backup, and the base and `sourceSyncedAt` had already moved on, so it was never retried.

**Fix.** `setCopyMaster` stores an empty list as `emptyConfirmed: true` and tells `VocabMaster.confirmEmpty` (an empty list the original chose, not a failed load). Test: `tests/copy-follow.smoke.cjs` — a second public copy with only unedited words, emptied by its owner, resolves to an empty confirmed list and its `sourceSyncedAt` moves on.

## 10.22.93.00 カジノのランキング: 名前が見えない／選択ボタンを小さく1行に／下の文章を消した

**What the user saw.** In ランキング › カジノ, a player's name under the avatar was invisible; the game buttons were big, in three rows (すごろく基本 and すごろく記録 each wrapped to a row of their own), and two lines of text sat under the podiums.

**Cause.** A name set in a very dark colour (the profile's name colour) was drawn dark on the dark ranking; its text stroke (`.2px` from the page) was too thin to show. Three rows of big buttons also left the podiums little room.

**Fix.**
- `ranking.js` `name()`: a dark colour gets a wider light stroke and a light halo, a light colour a dark shadow, so any name colour reads.
- The game buttons are one slim rounded bar of seven small buttons: ポーカー, BJ, ルーレット, ダイス, チンチロ, and すごろく + 記録 joined as one pair (full names stay in `aria-label`). The gold-lined pill marks the chosen one; the font and paddings scale with the width (also at 320px).
- The footer lines (「表彰台をタップして…」 and the 累計 note) are hidden in カジノ and the note's element is removed; the podiums get the room.

Tests: `tests/casino-ranking.smoke.cjs` — the seven buttons are on one row, none cut off, the bar is under 40px, at 393 and 320px wide; no footer in カジノ (it is back in ポイント); a name in a dark colour carries the halo.

## 10.22.94.00 単語の追加を1つに／「…」メニューを揃える／配信された本にも「編集」

**What the owner asked.** The ＋ at the top right and the ＋ between words looked different; distributed books and added books had different "…" menus and settings; and a plain edit button was wanted so a user can edit a distributed book for themselves. (When both changed the same word, merge them, the distributed one first: see 10.22.95.00.)

**Changes.**
- `vocab-entry.js`: the ＋ at the top is the between-words form with the last word as the one it follows (same title 「単語を差し込む」, the note 「#N「…」の次（#M）に入ります」, 差し込む pre-ticked, unit taken from that word); a word added there still lands at the end and the list still jumps to it. In 続けて追加する the note now names the word just added (it kept the first anchor before).
- `library.js`: one 編集 button for every book in the "…" menu (own book: its editor, as 名前・表紙を編集 / 単語を追加 before; distributed book: edit as your own copy: the copy you already made is opened, else the dialog 「編集」 makes it, the original staying listed unless the box is ticked), then 一覧から外す, 単語帳を完全削除 (one label for both kinds), plus the admin's own buttons. The word list has the same 編集 pill (`#vocabEditBook`, next to ＋ 追加) on a distributed book a user may not change.
- The copy keeps following the original (10.22.90.00): words the user did not change come in on their own.

Tests: `tests/vocab-entry.smoke.cjs` (the top ＋ shows the insert note and 差し込む ticked; unticked, a used number is refused), `tests/shared-book-editing.smoke.cjs` (a distributed book shows 編集 and no ＋ 追加; the menu buttons are the same list; 編集 → 編集する makes the copy), `tests/library-management.smoke.cjs` (the new labels).

## 10.22.95.00 自分用の単語帳: 両方が直した単語は、部分ごとに混ぜる（配信を優先）

**What the owner asked.** When a copy and its original both changed a word, merge them (折衷), the distributed one first. (Before this, the player's word was kept whole, and the original's change was dropped.)

**How.** `copy-follow.js` keeps, besides the fingerprint of each word of the original, a short hash of each part (`pf`: headword, first meaning, sub line, unit, and each meaning row). A word only the original changed is replaced; one only the player changed stays; one both changed is mixed part by part (`mixWords`): a part the original changed is the original's, any other part is the player's, and where both changed the same part the original's wins. A meaning row is matched by its place; a row the original added comes in, a row it dropped goes unless the player changed it, the player's own extra rows stay. The player's order (`no`) and links stay with the word. A base made before this has no parts: a word both changed is then taken whole from the original (it fills the parts in at the same time, so the next time it is mixed by part). `report.mixed` counts them.

Tests: `tests/copy-follow.test.cjs` (a sub line and a meaning row by the player and a meaning by the original are both kept; both changed one row: the original's; a row added by the original comes in; an older base: the original's word whole; the older expectations follow the new rule), `tests/copy-follow.smoke.cjs` (a distributed copy and a public copy: the player's sub line stays beside the original's new meaning; the same meaning changed by both: the original's).

## 10.22.96.00 自分用の単語帳の折衷: 全体の「意味」を行に合わせる／同時に足した行を両方残す（Codexの指摘）

**What the user saw.** Nothing yet; found in review of 10.22.95.00.
- For a word with several meaning rows the word's own `meaning` text is made of its rows (①…②…); the mix copied the original's whole text even when the rows kept the player's edit, so the search (which reads `meaning`) could miss the player's text. The mixed word's `meaning` is now made from the mixed rows the same way the editor makes it.
- When the copy and the original each added a meaning row at the same place, the original's replaced the player's. Both stay now (the original's first; the same row added by both is not doubled), each with an id of its own.

Tests: `tests/copy-follow.test.cjs` — the mixed word's `meaning` follows its rows; both added rows stay with different ids.

## 10.22.97.00 すごろく: 通常ルーレットに「×1以上」の枠を戻した（当たりが見えなくなっていた）

**What the user saw.** 「意味わからんくらい確率減ってない？」 The normal wheel was almost all ×0 (23 of 40 slots read ×0), and no slot that was shown paid the bet back or more.

**Cause.** In 10.22.87.00 (the bonus slot made rarer: 1 in 40) the four top slots (×10, ×5, ×1.5, ×1) were all taken into the one hidden bonus slot. The return and the balls per roll were kept, but 0 of the 40 slots shown paid ×1 or more, and the bonus came about once in 40 spins: the average was right, the chance of a win was not.

**Fix.** ×5, ×1.5 and ×1 are on the normal wheel again (3 slots of 40 that pay the bet back or more, besides the games and events), and the bonus wheel pays less for it: ×5, ×8, ×10, ×12, ×15 (two), ×18, ×20, ×25 and five balls in a row (three slots). The hidden bonus slot is still 1 in 40. Monte Carlo (3 players, jackpots excluded, 900,000 rolls each): return 0.854–0.862 (0.86 at the start), balls per roll 0.144 (0.146).

Tests: `tests/sugoroku-model.test.cjs` — the normal wheel has ×5, ×1.5, ×1 and at least three slots paying ×1 or more beside the hidden one; the bonus wheel holds ×10 and ×25 and a five-ball run.

## 10.22.98.00 チンチロとダイスポーカーを公平なルールに

**What the owner said.** 「ダイス系の確率おかしい」「普通に確率通りにしてほしい」 (the dice themselves are fair: 3,000,000 throws, each face 16.7%, checked; the rules around them were not).

**What was uneven.**
- チンチロ: the parent threw up to 3 times, a child only 2, and ties went to the parent: a child won about 39% and lost 61% (casino and すごろくビンゴ alike).
- ダイスポーカー in すごろくビンゴ: the player threw twice (one re-roll) against the dealer's three, with a win paying 1.5× to make up. (The casino's own ダイスポーカー already gave both sides three throws: the same strategy wins 49.6% and loses 49.7%.)

**Now.**
- `casino-model.js`: `CHILD_THROWS` is 3 (as the parent). A tie (the same point, or no hand against no hand) is a draw; the hands pay the same whichever side makes them. Measured with the shipped rules: a child wins 44.4%, loses 45.2%, draws 10.5% (net −2.5% of the bet: the parent's decisive hand is settled first, as at a real table).
- すごろくビンゴ: its ダイスポーカー gives the player three throws like the dealer and pays the bet (not 1.5×); its チンチロ follows the casino's rule. The 「負けると4分の1が戻る」 on an EVENT square (made to offset the uneven games) is gone: a lost game gives nothing back (`eventPay.lose` 0). Monte Carlo with a sensible strategy for every game (3 players, jackpots excluded, 900,000 rolls each): return 0.920 before, 0.930 now (0.940 if the refund were kept); balls per roll 0.1533 → 0.1554.
- Texts: the rules in the game and the usage guide say the new rules.

Tests: `tests/casino-model.test.cjs` (ties are draws; three child throws; a child wins and loses about as often; dice poker with the same strategy for both sides wins about as often as it loses), `tests/sugoroku-model.test.cjs` (a lost event game pays nothing), `tests/sugoroku.smoke.cjs` (three throws each, no 1.5×).

## 10.22.99.00 チンチロの説明に、古い「親の勝ち」が残っていた（Codexの指摘）

**What the user saw.** Nothing yet; found in review of 10.22.98.00. The casino's チンチロ rules (`CHIN_RULES` in `casino.js`) still said the child throws twice and that the same point goes to the parent, and the usage guide still said 「同じ目は親の勝ちです」 right after saying a tie is a draw.

**Fix.** Both say: parent and child throw up to three times, the same point (or no hand against no hand) is a draw and the bet comes back. Test: `tests/casino.smoke.cjs` reads the open チンチロ screen's rules text.

## 10.23.00.00 すごろく: 「何も戻らない」が増えていたので、×0 を減らして ×0.5 の枠を足した

**What the user saw.** 「体感当たりにくくなった気がする ×0おおすぎん？」

**What the numbers said** (plain play, 3 players, jackpots excluded, 600,000 rolls: the share of rolls that returned nothing at all). Before today's changes (10.22.56-): 58.8% nothing, 10.2% a little back, 31.0% the bet or more. After the even dice rules (no 1/4 refund on a lost event game) and the bonus slot moved out of the wheel: 64.2% nothing, 5.8% a little back, 29.9% the bet or more. The return rate was higher, not lower (0.92 → 0.93): the money had moved into the rare bonus.

**Fix.** On the normal wheel 4 of the ×0 slots became ×0.5 (×0 is 15 of 40 now, 20 of 40 with the hidden bonus slot counted before). To keep the return, the bonus wheel pays less: ×5, ×6, ×8, ×9, ×11, ×13, ×15, ×17, ×19 and five balls in a row (three slots); it is still 1 in 40. Measured now: 56.4% nothing, 13.6% a little back, 29.9% the bet or more; return 0.930 (as before this change), balls per roll 0.155.

Tests: `tests/sugoroku-model.test.cjs` (×0.5 is on the wheel; the bonus wheel holds ×5, ×11, ×19 and a five-ball run; ×11 pays 1,100), `tests/sugoroku.smoke.cjs` (the bonus wheel's ×11 pays 1,100).

## 10.23.01.00 すごろくビンゴのリーチとビンゴを「あなたへ」のお知らせに出す

**What the owner said.** 「リーチやビンゴなどをお知らせに出してください。今何リーチ中とか、〜がビンゴとか」

**Now.** In the shared すごろくビンゴ (`sugoroku.js`, `notify()`), while the card is open or after a roll:
- 「いま N 本リーチ中」 with the numbers still needed. One notice that replaces itself (id `sugoroku:reach`); it is written only when the reach count or the needed numbers change (stamp in localStorage), so it does not repeat.
- Another player's bingo / jackpot in the shared log becomes 「〇〇さんが DOUBLE BINGO」 (at most 5 per time, own entries skipped). The first visit only records the latest log time, so old entries are not replayed.

Tests: `tests/sugoroku-shared.smoke.cjs` (exactly one reach notice; another player's bingo gives one notice).

## 10.23.02.00 使い方ガイドを短く書き直した

**What the owner said.** 「使い方ガイドを読みやすく、簡潔にしてください。全体的にほんとにいらない情報が多すぎる」

**Before.** 18 sections, about 60,000 characters: internal mechanics (storage, sync intervals, cache), repeated points, old-version wording, and one 2,500-character bullet for すごろくビンゴ.

**Now.** `usage-guide-content.js` has 18 short sections (about 9,000 characters): what a player does, in plain words. Sections: 単語帳, 単語カード, ワーク, 長文リーダー, 単語バトル, バトルのイベント (still read from `WordDuelModel.eventCatalog`), 勉強時間, ランキング, ポイント, お知らせ (including the すごろくビンゴ リーチ / ビンゴ notices), ユーザー・グループ, ポーカー, カジノ, すごろくビンゴ, プロフィール・設定, 保存・バックアップ, 管理者ツール. Tips shortened.

Tests: the whole suite (the guide is only checked for opening in `tests/compact-sidebar.smoke.cjs`).

## 10.23.03.00 すごろく: リーチが無くなったあとも「N 本リーチ中」の通知が残っていた（Codexの指摘）

**What the user saw.** Nothing yet; found in review of 10.23.01.00. When a roll completed the last reach, no new notice was written, so the old 「いま N 本リーチ中」 stayed in the お知らせ box.

**Fix.** `notify()` in `sugoroku.js`: when the reaches go from some to none, the same notice (id `sugoroku:reach`) is replaced by 「いまリーチ中のラインはありません」. Nothing is written if there were none before.

## 10.23.04.00 アプリ内の長い説明を短くした／ガイドの単語カードの上限を正した（Codexの指摘）

**What the owner said.** 「AI特有の無駄な文や記述を消してください」「いらない情報が多すぎる」

**Now.**
- すごろくビンゴのルール (`RULES_TEXT` in `sugoroku.js`): 12 long lines became 9 short ones (the ×0〜×5 wheel, ★ and ！ squares, the shared card, how the prize is split). Jackpot formulas, the 120-tap note and the autoplay detail are gone.
- 「編集」ダイアログ (`openCopyBook` in `library.js`): the hint is two sentences (it is a personal copy; the original does not change; words the player did not change follow the original).
- Usage guide: Codex (review of 10.23.02.00) was right that the card reward is also capped at 10 answers per word per day (`CARD_PER_WORD`) besides 500 a day; the guide now says both.

Tests: the whole suite (no test reads these texts).

## 10.23.05.00 ガイド: 単語カードの上限は「この端末で」と書いた（Codexの指摘）

**What the user saw.** Nothing yet; found in review of 10.23.04.00. The guide said a word earns points up to 10 times a day (500 in all), but both limits are counted per device (`StudyPoints.cardNum()` uses the device-local ledger), so another device counts on its own. The cross-device cap was left as it is on purpose (documented under 10.22.x: it protects storage).

**Fix.** `usage-guide-content.js` says 「この端末では、…」. No code change.

## 10.24.00.00 ランキングのタイトルから全順位／貸す利子は自由設定で相手が受けて成立／プロフィールの貸し借りを削除

**What the owner said.** 「ランキングの4位以下も見れるように（タイトルを押したら）」「双六ビンゴ2個目のランキングが2行になってるのも嫌だ」「トークでポイントを貸した時に強制的に利子つけれるとやばくない？」「利子も自由設定できるように」「プロフィール開いた時のポイント貸し借り系は消す」

**Ranking** (`ranking.js`, `style.css`): every podium title (学習 / ポイント / カジノ panels) is a button that opens the whole list, 1st place down, 4th and below too (up to 200); a row opens that person's record. すごろくビンゴの「記録」 shows its four podiums one under another in the scrolling list (like the points ranking) instead of a 2×2 grid.

**Interest** (`point-loans-model.js`, `point-loans.js`):
- Before: a lender picked 5/10/20/30% and the borrower owed it at once, without being asked.
- Now: the lender can type any whole percent 0-100 (quick buttons stay). A loan WITH interest is an offer: a new entry kind `lend-offer` (`status: "open"`), so an old copy of the app, which does not know the kind, never treats it as a loan (found in the Opus review: with the same kind an old app would have let the borrower collect before accepting). The lender's points are taken out at once (held); nothing is owed and the borrower cannot collect. The borrower sees 「貸してくれる（利子…・返す額…）」 with 「断る」 / 「この条件で借りる」. On accept (`accept()`) the offer is `done` and a real `lend` entry (`<id>-ok`, same amount, rate, due) is added, owed and collected like any loan. On decline or when the lender takes it back, the lender's device puts the points back (`unclaimed()` includes a refused offer for the lender; `claimed[id]` makes it once; the lender's own 取り消す takes them back at once; toast 「…戻りました」). A loan without interest is instant as before. Old records (rate/due without an offer) count as before.
- `trim()` / `waiting()` never cut an open offer or an unrefunded refused one off the record. Known, left as is: an old app that trims a full record could drop a refused offer before the lender has the points back (needs 400 entries in one pair).

**Profile** (`people.js`): the 貸す/あげる/トーク buttons are gone from the profile. Tapping a user in the list still opens the talk.

Tests: `tests/point-loans-model.test.cjs` (offer rules, free percent, refund once, trim), `tests/point-loans.smoke.cjs` (offer, free percent, accept, decline and cancel give the points back, no buttons in the profile), `tests/casino-ranking.smoke.cjs` (title opens the full list; 記録 scrolls).

## 10.25.00.00 大富豪を追加した（カジノタブ）

**What the owner said.** 「大富豪を追加したい。賭け額は自由設定で、ルールは日本大富豪連盟のルールブックに基づいて。最初に賭けるのではなく、あとで引き落とす。足りなければカジノからの借金で。UIは凝りまくって」

**Rules** (`daifugo-model.js`, pure; `docs/daifugo-rules.md` lists them): 3-5 players (4 is the official game; 3 and 5 are the 準公式 ones, with 3 suits for 3 players), 革命, 8切り, スペ3返し, 縛り, 階段 (with a joker anywhere, 最強階段), the joker, 反則上がり, 都落ち (an option), and the card exchange (大貧民 ↔ 大富豪 two cards, 貧民 ↔ 富豪 one, the lower gives the strongest cards). A set is 4 games (6/4/2/0 points, +2 for the best of the last game). 11バック is not in the official rules and is not there. Where the rule book is silent: 縛り starts when the same suits come twice in a row (no joker), a single joker is not an 8切り.

**Table** (`daifugo-table.js`): a document `pokerRooms/{4 digits}` with `kind: "daifugo"` (the same numbers and expiry as the other tables; poker refuses a kinded room). The creator's device is the dealer: it keeps every hand in localStorage, applies each player's move (`room.moves[uid]`) and writes only the public state (field, counts, turn, lock, revolution) plus each player's hand sealed for that player (ECDH + AES-GCM, as in poker). A timer plays for a silent player; a computer plays for players who left. A table against the computer runs on the device only, with no points.

**Points** (the owner's rule: settle afterwards): nothing is taken at the start. When the game (or the set) ends, `room.final.pay` says who pays whom: the worst pays the best the stake, the second worst pays the second best half (3 players: only first and last). Each payer's own device calls `PointLoans.pay()` (new): in one transaction it takes the amount from the wallet and, when the wallet is short, borrows the rest from the casino (a loan spent at once, with one 請求 for everything owed, as in すごろくビンゴ); the payment is a `give` in the pair's record with a fixed id, so it happens once; the winner's device collects it like a gift. A list kept on the device (`aiglish_df_due_<uid>`) lets a device settle a finished table after the app was closed. If the dealer leaves in the middle of a game the table is closed and nothing moves. No daily bet allowance is used (nothing is staked).

**Screen** (`daifugo.js`, `daifugo.css`): a felt table with the others' card backs and a timer under the one in turn, the field with the last play thrown to the centre, banners for 革命 / 8切り / スペ3返し / 最強階段 / 上がり / 反則上がり, a red table while a revolution lasts, cards that cannot be played dimmed, one tap on a pair/triple answering a pair/triple, おすすめ, results with rank medals and payouts. Casino tab: a new tile; usage guide: a new section.

Tests: `tests/daifugo-model.test.cjs` (every rule above, the payouts add up to 0, 400 games against the computer for 3-5 players: they end, every card is accounted for), `tests/daifugo.smoke.cjs` (practice game; three players at a table played through the screens: sealed hands, the last pays the first once, the short wallet borrows from the casino, a second payment with the same id does nothing), `tests/point-loans.smoke.cjs` (`pay`).

**Review (Opus) and what was changed because of it.** The settlement does not trust the shared document: each device keeps what it agreed to when it sat down (the stake and when the table was made, in `aiglish_df_due_<uid>`), takes the order the table ended in the first time it sees it, works out who pays whom itself (`DaifugoTable.payments`), makes the payment ids itself, and pays a table only once. The dealer plays by the settings it started with and the public keys it saw then, ignores a move stamped in the future, writes to the table before it saves its own state, and a reloaded dealer is the dealer again. A finished table cannot be taken over for a day.

**Known limits (they are in the guide).** Anyone at the table can still write to the shared document (the Firestore rules are open), so a player who wants to cheat can post moves for another player, and the dealer can fake a result; a player who never opens the app again is never made to pay. Points are not moved when the dealer leaves in the middle of a game. This is a game among friends: like the poker table, it rests on the dealer's device.

## 10.25.01.00 大富豪: 待っている間に抜けた人が名簿に残っていた（Codexの指摘）

**What the user saw.** Nothing yet; found in review of 10.25.00.00. A player who left a waiting table stayed in `room.players` marked `left`; the start button counted only the others, but the seat order (`seatOrder`) included the one who had left, so the dealer played a hand for them and they were ranked and paid.

**Fix.** `leave()` on a waiting table deletes the player's entry; `start()` also drops anyone still marked `left` and closes the seats up (0, 1, 2 …). Test: `tests/daifugo.smoke.cjs` (a player who joins and leaves is gone from the document; the game then starts with the three who stayed).

**Not changed (Codex also said the first deal should start from the spade-3 holder).** The rule book's 「スペードの席」 is the first seat (each seat has a suit), not the holder of the spade 3. The first game starts from the first seat (the player who made the table); later games from the 大貧民 of the game before. The wording in `docs/daifugo-rules.md` is clearer now.

## 10.25.02.00 大富豪: 開始の瞬間に抜けた人が「いる」ままになっていた（Codexの指摘）

**What the user saw.** Nothing yet; found in review of 10.25.01.00. If a player pressed 「テーブルを出る」 at the very moment the host started the table, the leave step (decided from the screen's last copy of the table, which still said waiting) found the table already playing and did nothing, so the player stayed "present" and the dealer waited the full think time on each of their turns.

**Fix.** `leave()` decides inside the transaction: waiting → the seat is given up; playing → the player is marked left (the dealer plays on for them quickly); otherwise nothing.

## 10.26.00.00 大富豪の画面を整え、文言を減らした

**What the owner said.** 「UIが終わってます。おしゃれにしてください。いらない文言が多い」

**Now** (`daifugo.js`, `daifugo.css`; the game and the points are not touched):
- Lobby: a crown mark and the name; 「ひとりで練習」 is one line (3/4/5 and a button); the stake is a large number with − / + and quick values, with the payout shown as two small tags; the options are rows of pill choices (人数 / ゲーム / 時間 / 都落ち); joining is one line with the four digits. The rule list and the long notes are gone from the page: the rules are behind the ? button (six short lines).
- Waiting room: the table number large, the settings as small tags, the seats; no notes.
- Table: the card count is a badge on the fan (no 「13枚」 text), the player's own bar shows only the name and 「あなたの番」, the hints under the hand are gone (only a reason when a play is refused, and the exchange); the field says 「名前　ペア」 and no longer 「1枚」.
- Results: 「結果 1/4」 and the ranking; the final screen lists the payments and says 「支払い済み」; no explanations.

Tests: `tests/daifugo.smoke.cjs` (the same flows through the new screens).

## 10.26.01.00 大富豪のロビーが狭い画面ではみ出していた（Codexの指摘）

**What the user saw.** Nothing yet; found in review of 10.26.00.00. The practice and join rows were set not to wrap, so on a phone narrower than about 340px their buttons ran past the panel.

**Fix.** `daifugo.css`: the rows wrap again (one line when there is room, as on a 393px phone; the button drops below on 320px). Checked on 320x568 and 393x852.

## 10.27.00.00 すごろくビンゴ: カードを2枚にして外れをなくし、当たり外れを大きくした（改良1/3）

**What the owner said.** 「ボールの外れが多すぎる → ビンゴカードを2枚にしてスワイプで切り替え。1〜99を全部埋めるように49+49と、あまりの1は特別な数字（出た瞬間に何か起こる。ルーレットで決めればいい）。すでに出た数字は今までどおり200pt」「当たり外れが地味 → ハイリスクハイリターンにして均衡をとる」「ビンゴしたときの他の人への配当が少なすぎる → 7割」。アイテム（2回目）と賭け額（3回目）はあとの回。

**Why the balls missed.** The card held 48 of 100 numbers, so 52% of balls fell on no cell and only paid twice the bet.

**Now** (`sugoroku-model.js`, `sugoroku.js`, `sugoroku.css`):
- Two 7×7 cards (98 cells, no free cell), numbers 1-99 in random places; the 99th number is the special one (`card.special`, shown as ★ n). Balls draw 1-99: a closed cell opens; a number already open pays 2× the bet; the special number spins the special wheel (×10 … ×50 of the bet, or three more balls) and opens no cell. When a line is made its balls are removed and the numbers stay.
- The shared document is now `shared/sugoroku_live2` = `{ v: 2, cells[98], owners[98], special, owed, owedAt, people, log }`. It is made (in one transaction, when the first player opens the screen or rolls) from the old `shared/sugoroku_live`: new cards, and the old document's sane `owed`/`owedAt` parts, people and log. A new document, not a changed one, because an old copy of the app (a tab opened before the update) would read the new format as invalid and overwrite it with a 49-cell card, losing what is owed (found in the Opus review); old copies keep using the old document and never touch the new one. The admin tool's player deletion clears both documents.
- Screen: both cards side by side (scroll-snap swipe) with tabs that show the reaches on each card, the special number, the view turns to the card a ball lands on; the rules text is shorter.
- High risk, high return: the normal wheel is −5× (4 slots of 40), −2× (3), −1× (2), 0 (7), +0.5 (2), +1 (2), +2 (2), +3, +5 (3), +7.
- Others on the line: 70% of the bingo prize (was 50%) and 50% of the bingo wheel's multiples (was 30%) go to the players whose balls are on the line.
- Re-tuned by Monte Carlo (300,000 rolls, 3 and 5 players; `scratchpad` scripts, not kept in the repo): with two cards a bingo came about every 115 rolls (twice as often), which pushed the return to 0.994. Bingo prize 10→5, bingo wheel ×10/20/50 → ×8/15/25/35 (and one jackpot slot instead of two, so the JP rate stays about 1.0 per 1,000 rolls), special wheel without a jackpot. Return without jackpots 0.90-0.92 (was 0.93); with the jackpots paid from the pots it is about 1.0 as before.

Tests: `tests/sugoroku-model.test.cjs` (cards, special number, line and shares, wheels, validation, 80,000-roll return between 0.8 and 1), `tests/sugoroku.smoke.cjs` (98 cells, two tabs, ★ number, the special wheel pays ×10, an open number pays 2×), `tests/sugoroku-shared.smoke.cjs` (an old 49-cell card is replaced and its owed part collected).

**Known and kept.** A roll on the new normal wheel can lose up to 5 bets on top of the bet (−5× on 4 of 40 slots, as asked). If the wallet is short the rest is a casino loan, as for an accident (the rules text says so). Players still on an old copy of the app share nothing with the new card until they reload; the balls they place there stay on the old document.

## 10.28.00.00 すごろくビンゴ: アイテムを入れた（改良2/3）

**What the owner said.** 「双六が単調すぎる、運依存すぎる → 桃鉄の急行カードみたいに、サイコロが増えたり、ぴったりが出たり、赤マスを無効にしたり。アイテムマスではなく、通常ルーレットの「アイテム」の項目から出たらルーレット。ポイントでも購入できるように」

**Now** (`sugoroku-model.js`, `sugoroku.js`, `sugoroku.css`):
- A player holds up to 3 items (`state.items`, and `state.guard` for ガード). Two of the 40 slots of the normal wheel are 「ITEM」: they spin the item wheel (`RULES.itemWheel`: ダブルダイス ×3, ぴったり ×2, ガード ×2, ボール券 ×1, 倍がけ ×2 of 10 slots). With the bag full, half the item's price is paid in cash instead.
- Items are used before a roll (tap one in the bag; `S.roll(..., use)` with `use = { items, face }`): ダブルダイス throws two dice (two events, the sum moves the piece); ぴったり picks the face 1-6 (the roll button waits for a face); ガード makes accident squares do nothing for this and the next two rolls; ボール券 draws one ball; 倍がけ doubles what the normal wheel pays or takes (kept in the bag when the roll does not land on a normal square). The roll is replayed in the card transaction with the same `use`, so both runs agree.
- Shop (`ショップ` button): ダブルダイス 150, ぴったり 250, ガード 100, ボール券 400, 倍がけ 80 points (chips in the preview). A purchase is one wallet move (`round("sugoroku-shop").net(-price, 0)`: no bet, no allowance, no jackpot feed) and the bag is saved at once (the cloud save gate now includes the items).
- Balance: the two item slots took two ×0 slots of the normal wheel. An item is worth about 60 points on average (a ball ≈ 230, ぴったり ≈ 80, ダブルダイス / ガード ≈ 40-50), about 2.4% of the return; the return without jackpots is 0.89 without counting items and about 0.92 with them. The shop prices are well above what an item is worth, so buying is a cost, not a way to win.

Tests: `tests/sugoroku-model.test.cjs` (the item wheel, a full bag, every item's effect, refused uses, buying, old saves), `tests/sugoroku.smoke.cjs` (three bag slots, the shop buys for 150 and the bag is saved, ダブルダイス moves 3+4, ぴったり waits for a face and moves exactly 5, an ITEM slot fills the bag).

**Review (Opus) and what was changed because of it.** (1) A bought item is not lost when another device takes over: which copy of the game is "further on" is now `revOf(state)` (a counter raised by every roll and every purchase; an old save counts its rolls), not only the number of rolls. (2) Built-in names (`constructor`, `__proto__`…) are no longer accepted as items (`hasOwnProperty`). (3) Two of a kind in the bag: only the first lights up; the shop button is off while a roll runs. **Known limits:** the same item can still be used on two devices that were both open before it was used (the last save wins, as with a game waiting in the same way); a full bag paying half the price adds about 1-2% to the return when players hold items without using them; shop purchases are not bets (no allowance, no jackpot feed).

## 10.29.00.00 すごろくビンゴのアイテム: 絵を付け、トリプルダイスを足し、ボール券をやめた

**What the owner said.** 「この画像を使ってください。ボール確定のアイテムはなしで、ダブルサイコロ、トリプルサイコロはいい感じにサイコロを重ねて」

**Now** (`sugoroku-model.js`, `sugoroku.js`, `sugoroku.css`, `assets/sugoroku/`):
- The four pictures of the owner's image were cut out of the one sheet (transparent, 192px, `die.png`, `die-gold.png`, `shield.png`, `potion.png`): the white die is ダブルダイス (two of them, a little turned and overlapping) and トリプルダイス (three, piled up), the gold die is ぴったり, the shield is ガード, the potion is 倍がけ. They show in the bag, the shop (larger) and nowhere else.
- New item トリプルダイス (three dice, the sum moves the piece; 250). Item wheel: ダブルダイス ×3, トリプルダイス ×1, ぴったり ×2, ガード ×2, 倍がけ ×2 of 10 slots.
- ボール券 is no longer on the item wheel or in the shop (`RULES.items.ball.retired`); one that a player already holds can still be used. Without it an item is worth about 50 points on average (before 59), so the return stays about 0.92.

Tests: `tests/sugoroku-model.test.cjs` (トリプルダイス, the wheel without ボール券, a retired item cannot be bought), `tests/sugoroku.smoke.cjs` (the shop lists five items).

## 10.30.00.00 すごろくビンゴ: 賭け額を50・100・200から選べるようにした（改良3/3）

**What the owner said.** 「100pt固定じゃなくする → バランスがかなり変わりそうだから要検討」（ご提案の方向で、50・100・200にした。500は、ジャックポットの確率との釣り合いが取りにくいので見送り）

**Now** (`sugoroku-model.js`, `sugoroku.js`, `sugoroku.css`):
- `RULES.costs = [50, 100, 200]`; three buttons under the board choose the bet of the next roll (kept in `aiglish_sugoroku_cost`, 100 by default; off while a roll or an event game is going on). The normal wheel and everything else already paid multiples of the bet.
- A line is worth the bets of its balls: the shared card keeps `bets[98]` (the bet of the roll that opened each cell; zero again when the line resets), and the line's base is their average rounded to 50 / 100 / 200 (a ball with no bet counts as 100). So laying cheap balls and finishing with a 200 roll does not pay a 200 prize.
- The bingo wheel is made for that base (`bingoWheel(base)`): the eight other slots twice, and `round(2 × base / 100)` places each for the jackpot and for the super-jackpot chance (1 / 2 / 4). The other slots' multiples and the mini games' boost are scaled by (wheel size / 20), so what a point of bet is worth outside the jackpot is the same at every size.
- Mini games: a game waiting in `state.bonus` carries the bet (`bet`) and its own `mult`; `gameScore(game, done, bet)` scales the points by bet / 100. A game saved before this change has no `bet` and scores as for 100. The bet buttons are off while a game is waiting.
- Monte Carlo (3 players, 300,000 rolls each, same bet for all): return without jackpots 0.916 / 0.918 / 0.914 at 50 / 100 / 200; jackpot rolls per 1,000 rolls 0.54 / 1.05 / 1.78, i.e. about the same per point bet (0.0108 / 0.0105 / 0.0089).

Tests: `tests/sugoroku-model.test.cjs` (every payout scales, the bingo prize follows the balls' bets, mini-game scores, the jackpot share per bet, an old waiting game), `tests/sugoroku.smoke.cjs` (three buttons, 100 by default, a roll at 200 takes 200 and a ×5 slot pays 1,000).

## 10.31.00.00 すごろくビンゴ: クラウドとの照合が終わる前にサイコロを振れないようにした（Codexの指摘）

**What the user saw.** Nothing yet; found by the Codex review of #390. With a local save on this device and an item just bought on another, a roll could start before the cloud copy (`cloudGame`) came back. The takeover was skipped because the screen was busy, and the roll saved a stale state whose `rev` could equal the purchase's, so the bought item was lost.

**Now** (`sugoroku.js`): while the cloud copy is being compared (`view.syncing`), the roll button stays off; it is released as soon as the load ends (also when it fails or returns nothing).

Tests: `tests/sugoroku.smoke.cjs`, `tests/casino.smoke.cjs` (the existing flows still roll after the load).

## 10.32.00.00 すごろくビンゴ: ボールの分け前を、そのボールの賭け額に比例させた

**What the owner said.** 「ラインの賭け額の平均になるなら、他の人が低い賭けでやって自分が100でやっていたら損するだけ」

**Cause.** In 10.30 the line's base was the average bet of its balls, but the shared part of the prize and of the wheel was still split by the number of balls. A player who laid balls at 100 next to someone's balls at 50 got the same share per ball from a smaller prize.

**Now** (`sugoroku-model.js`): the shared parts are split by the bets of the balls (a ball with no bet recorded counts as 100), so a ball earns by its own bet whoever else is on the line. The line's base is the average bet, but never more than the finishing roll's own bet (so cheap balls finished by a big roll do not pay big); the wheel is the one nearest to it (50 / 100 / 200). Monte Carlo (same bet for all, 200,000 rolls): return without jackpots 0.913 / 0.908 at 50 / 200.

Tests: `tests/sugoroku-model.test.cjs` (a line worth the average, cheap balls finished by a bigger roll, bob's share = his balls' bets / all bets).

## 10.33.00.00 すごろくビンゴ: 揃えた人の取り分を、その人のサイコロの賭け額で決めるようにした

**What the owner said.** 「当たりそうなときだけ高くすればよくなるやん」「低い配当でビンゴしまくればルーレット回しまくれるやん」

**Checked.** Raising the bet only when lines are close does not pay (3 players, 900,000 rolls, the others at 100, without jackpots: flat 100 → 0.93, 200 only with 3+ reaches → 0.88). But a player who differs from the table was paid unevenly: in 10.32 the finisher's side of the line was capped at the average of the balls, so a bet above the table's was partly wasted (200 → 0.88 against a table of 100) and a bet below it was not (50 → 0.95).

**Now** (`sugoroku-model.js`, `spinLine`): the part the balls share (`prizeShare` of the prize, `wheelShare` of the wheel's ×) is worth the average bet of the balls and is split by the balls' bets; the part the finisher keeps is worth the finishing roll's own bet; the bingo wheel is the one for that roll's bet. So every payout follows its own bet. Result (same test, others at 100): 50 → 0.96–0.98, 100 → 0.93, 200 → 0.91–0.93. 50 is still a few points ahead when the table bets more; the cause is not found yet (all stay below 1, and a table betting alike is level at about 0.91).

Tests: `tests/sugoroku-model.test.cjs` (balls' part by the average, the finisher's part by her own roll, bob's share by his balls' bets, cheap balls finished by a roll of 200).

## 10.34.00.00 すごろくビンゴ: 賭け額を100だけに戻した

**What the owner said.** 「だったら100のみでいいわ」（賭け額を選べるようにすると、平均や取り分の食い違いが次々に出て、釣り合いを取りきれなかったため）

**Now** (`sugoroku-model.js`, `sugoroku.js`, `sugoroku.css`): `RULES.costs = [100]`; the three buttons and the saved choice (`aiglish_sugoroku_cost`) are gone, and the screen shows the fixed "1回 100" again. The shared card may still carry `bets`, and the shares are still split by them (all 100 now), so nothing needs to be migrated; a game saved with a bet of 50 or 200 can still be settled. The usage guide and the rules text no longer mention a choice.

Tests: `tests/sugoroku-model.test.cjs`, `tests/sugoroku.smoke.cjs` (no bet buttons, "1回 100枚", the line prize on 100).

## 10.35.00.00 すごろくビンゴ: 使われなくなったボール券のコードを消した

**What the owner said.** 「画面の改良といらない文言やコードの削除」（お昼寝前の依頼の続き）

**Now** (`sugoroku-model.js`, `sugoroku.js`): the retired item ボール券 (not on the item wheel or in the shop since 10.29) is removed: its entry in `RULES.items`, its use in `roll()`, its picture/description entry and the `retired` checks. An item id the game does not know is dropped from a bag as before, so a ボール券 still held in a bag from 10.28 simply disappears. The casino rule texts were read and left as they are (short and accurate).

Tests: `tests/sugoroku-model.test.cjs` (the item list without it; unknown ids in a bag), `tests/sugoroku.smoke.cjs`.

## 10.36.00.00 すごろくビンゴ: アイテムを強くして値段を下げ、カードのボールを全部消せるようにした

**What the owner said.** 「アイテムのポイントバランスとか大丈夫か確認してほしい／双六のボールのリセットをできるようにしてほしい／全体的なバランスを確認してほしい／この双六のよくない点を挙げてください」（リセットは「カード全体」、アイテムは「効果を強くする」を選んだ）

**Checked** (Monte Carlo, 100-point bets, a fresh card per roll; a ball is worth about 233 points, almost all of it the 200 a ball on an open cell pays). What one item was worth when used: ダブルダイス +9, トリプルダイス +16, ぴったり +10, ガード (3 rolls) +11.5, 倍がけ +8.5 points, against prices of 150 / 250 / 250 / 100 / 80, and a full bag paid back half the price in cash. So the best play was to keep the bag full and never use anything. The whole game (3 players, 90,000 rolls): about 0.92 back without jackpots (about 1.0 with them); 59% of the balls land on open cells; one line per 144 rolls (all players together); 100-roll sessions swing about ±5,600 points (33% lose more than 2,000).

**Items** (`sugoroku-model.js`): 倍がけ now counts the whole roll's pay or take twice on any square (by at most `x2Cap` = 10 × the bet; not what is owed to others, jackpots, or an event game settled later; an `x2` event shows the extra); ガード lasts `guardRolls` = 5 rolls (a saved state keeps up to 5); prices are 20 / 30 / 25 / 30 / 100 (a full bag pays half). The dice items stay small on purpose: their only value is the squares they move (about 2.3 points a square, a lap's ball).

**Wiping the card** (`resetState`, `resetCard`, `sugoroku.js` `resetBalls`, a panel in 記録): any player can clear every ball of the shared card when it is at least `resetOpen` = 65% full and not within `resetEvery` = 1 hour of the last wipe; the numbers and `owed` stay, nothing is refunded. The time of the last wipe is in its own document `shared/sugoroku_reset` (an old tab that rewrites the card cannot undo the wait), read inside the same transaction that clears the card. Offline and on a card of one's own it is not offered. It is a valve, not a cure: in the simulation, wiping whenever allowed at 50% made lines far rarer (one per 2,500 rolls) and cut the return by about 30 points, because lines and the 200-point misses both come from balls piling up; at 65% it is allowed about 3% of the time. `admin-players.js` also clears a deleted player's `bets` now.

Tests: `tests/sugoroku-model.test.cjs` (x2 on any square and its cap, ガード 5 rolls, prices, the wipe's conditions), `tests/casino.smoke.cjs` (the wipe through the 記録 sheet).

## 10.37.00.00 すごろくビンゴ: ボールのリセットを、プレイヤーのボタンから運営の操作に変えた

**What the owner said.** 「そうじゃなくて運営がリセットできるようにってこと。変更前のやつが残ってるから」

**Cause.** 10.36 gave every player a button in 記録 that wiped the shared card. The owner wanted the operator to clear the balls left over from before the changes, not players.

**Now** (`admin-players.js`): the player's button, `resetBalls`, `shared/sugoroku_reset` and `S.resetState/resetCard` are removed. The admin tools have 「すごろくビンゴのボールをリセット」: two presses clear `owners`, `bets` and `people` of `shared/sugoroku_live2` in one transaction; the numbers, `owed`, and the log stay.

Tests: `tests/admin-players.smoke.cjs` (two presses; owners, bets cleared; cells and owed kept).

## 10.38.00.00 すごろくビンゴ: アクシデントの振れ幅、ビンゴの報酬、アイテムの数え方、ミニゲームを変えた

**What the owner said.** 「アクシデントルーレットの−が弱い、もっと強くする代わりに+も大きくすべき／ビンゴの報酬も弱い／ビンゴルーレットのダイスは3ダイスくらいでいい／計算も難易度選択（3つ）／アイテムルーレットはかなり−よりだから+100ptに加えて／袋が満タンとかじゃなくて×○（個）で表記」

**Now** (`sugoroku-model.js`, `sugoroku.js`, `sugoroku.css`):
- **Accident wheel** (10 slots): −6 / −4 / −3 / −2 times the bet, +1 / +3 / +6 times the bet, 3 squares back, back to START, nothing. The average stays about −50 as before, so only the spread grew. ガード now cancels the bad slots only (the wheel still spins and a + slot pays).
- **Bingo**: the prize is 8 × the bet (was 5); the bingo wheel's multiples are ×12 / ×20 / ×32 / ×50 (were ×8 / ×15 / ×25 / ×35). To keep the whole game at about 0.92 back (3 players, 300,000 rolls, without jackpots): a ball on an open number pays 1.5 × the bet (was 2), the 確変 wheel is ×4 … ×15 (was ×5 … ×19), and one normal-wheel ×5 slot is ×4.
- **Bingo wheel mini games**: サイコロ throws three dice and scores the sum × 50 (3 to 18, so 150 to 900; a saved game with one die scores as the sum it has). 暗算 asks for the level first: かんたん (one step, two-digit numbers, 300 points, 15 s), ふつう (as before, 600, 15 s), むずかしい (bigger numbers, 2–3 steps, 1,200, 20 s); a game saved before the levels, answered right, still pays 500.
- **Items**: kept as a count (×n, `itemMax` = 99), not three slots; every spin of the item wheel pays 100 (`itemCash` × the bet) besides the item; no more "full bag pays half the price" (at the top count the item is skipped and the 100 still pays). The bag shows 「ダブルダイス ×2」; the shop says 「持っているもの N個」.

Measured (3 players, 300,000 rolls, 100 bets): return without jackpots 0.9175 (the accident wheel +0.009, bingo +0.05, the item cash +0.04, offset by the lower miss pay, 確変 and one normal slot).

Tests: `tests/sugoroku-model.test.cjs` (new wheel numbers, guard with a + slot, items ×n and the 100, math levels and the dice sum), `tests/sugoroku.smoke.cjs` (three dice, the math level buttons and a right answer).

## 10.39.00.00 すごろくビンゴ: ビンゴ賞金を700（ボール1個につき100）にし、全額をボールで分けるようにした

**What the owner said.** 「ビンゴ賞金700にすればちょうど1個につき100ptだから良さそう」

**Now** (`sugoroku-model.js`): `bingoPrize` = 7 (was 8) and `prizeShare` = 1 (was 0.7), so the prize of a line (7 balls at 100 each) is 700 and every ball gets 100; the finisher keeps no extra share of the prize (the wheel's × multiples are still shared 50% by the balls, and mini games, jackpots stay with the finisher). Several lines at once still multiply it by (lines + 1), and a line of one's own balls by 1.1. Return without jackpots: 0.9078 (3 players, 300,000 rolls; was 0.9175).

Tests: `tests/sugoroku-model.test.cjs`, `tests/sugoroku.smoke.cjs`, `tests/sugoroku-shared.smoke.cjs` (100 for each ball).

## 10.40.00.00 すごろくビンゴ: イベントゲームの前に「戻る額の一覧」を出し、1個だけのボールの枠を目立たせた

**What the owner said.** 「ブラックジャックとか当てた時に、額が書いてある額と違って混乱する人が出そう。当てた時に専用ポップで、その場合の配分額を分かりやすくリスト化しよう／1個だけのあたりのボールが主張弱いのでなんとかして」

**Cause.** The wheel only says "BJ"; the game then pays by its own results (a win gives the bet back twice, a blackjack 2.5×, a draw the bet, a loss nothing; chinchiro up to 6×), none of it written anywhere. And the normal wheel's single-ball slot read "×0 +0pt BALL" when it stopped, like a blank.

**Now** (`sugoroku-model.js` `payTable`, `sugoroku.js`, `sugoroku.css`):
- Before an event game (from the ★ square or a normal wheel's BJ / DICE / チンチロ slot) a pop-up lists every result with what comes back and the difference to the bet (the bet was taken when the die was rolled): ブラックジャック 250 (+150) / 勝ち 200 (+100) / 引き分け 100 (±0) / 負け 0 (−100); ダイスポーカー: 勝ち / 引き分け / 負け; チンチロ: ピンゾロ 600 / ゾロ目 400 / シゴロ 300 / 勝ち 200 / 引き分け 100 / 負け 0. It also says whether a win gives a ball (the ★ square) or not (a normal square's game). A game already begun, and 早送り, skip it. `payTable` is tested against what `settle` pays.
- The single-ball slot is labelled ●×1 (like ●×5), glows on the wheel, and its result reads 「ボール ●1個ゲット！」 in gold with a pop and the stronger wheel effect, instead of "×0 +0pt".

Tests: `tests/sugoroku-model.test.cjs` (the table and settle agree), `tests/sugoroku.smoke.cjs` (the list before dice poker and chinchiro; the games begin from the button).

## 10.41.00.00 すごろくビンゴ: 「戻る額の一覧」をやめ、ビンゴを当てたときの「分け前の表」に変えた

**What the owner said.** 「そういうポップじゃなくて、当てた時の分配のポップ」

**Cause.** 10.40 answered 「ブラックジャックとか当てた時に額が書いてある額と違って混乱する」 with a list for the event games. The owner meant the bingo: the wheel says "×20 = 2,000" but part of it goes to the other players, so less comes in than is written.

**Now** (`sugoroku-model.js` `bingoSplit`, `sugoroku.js` `splitSheet`, `sugoroku.css`): the list before blackjack / dice poker / chinchiro is removed (`payTable`, its pop-up, its test). After a roll that made a line, when someone besides the finisher had a ball on it, a pop-up 「ビンゴの分け前」 shows the prize and the wheel's multiple and, per player, the balls on the line, the part of the prize, the part of the wheel and the total (あなた first), and notes that the others' parts arrive when they next play and that mini games and jackpots are the finisher's alone. It is skipped in 早送り and when everything was the player's own. The single-ball slot's brighter look from 10.40 stays.

Tests: `tests/sugoroku-model.test.cjs` (`bingoSplit` adds up to prize + wheel), `tests/sugoroku-shared.smoke.cjs` (the pop-up's rows and note), `tests/sugoroku.smoke.cjs` (it comes before the mini game).

## 10.42.00.00 いらない文言を短くした（すごろくビンゴのルール、使い方ガイド、ポイント・ポーカー・ワークなどの説明）

**What the owner said.** 「いらない文言は直しまくってください」

**Now.** Only the wording changed; no rule or number did.
- `sugoroku.js` the rules sheet: 11 items → 10, each shorter, and the numbers brought up to date (1.5× for an open number, the prize 700, items ×n with 100 more, the other players' parts of a bingo kept 30 days — said once). `usage-guide-content.js` the すごろくビンゴ section: 9 items, shorter, with the new bingo split, the math levels and the three dice mentioned once.
- `study-points-ui.js` (the bet limit, the study-time points, the word points), `poker-tutorial.js` (the end of a hand, the blinds, the four moves), `reader.js` (the busy message), `workbook.js` (the line format, the delete note), `save-system.js` (the auto-save note), `usage-guide.js` (the login steps): sentences that said a thing twice or described what the screen already shows are cut.
- `tests/sugoroku.smoke.cjs`: practice chips stop at 0, so the balance is compared with `max(0, …)` (the bigger accident slots can take more than is left).

Tests: the whole suite.

## 10.43.00.00 すごろくビンゴ: マップをスクロールでき、マスを押すと「あと何マス」が出る。周回数をランキングに入れた

**What the owner said.** 「双六のマップをスクロールして他のマスが見れるように／マスを押した時に後何マスかわかるように／周回数を今からカウントでいいのでカウントして、ランキングにも反映させて（双六2の方から）」

**Now** (`sugoroku.js`, `sugoroku.css`, `casino-stats.js`, `ranking.js`):
- The track was `overflow:hidden` and moved only by the game (`place`). It is now `overflow-x:auto` (swipe sideways, no scroll bar); the game still brings the piece back into view after a roll.
- Tapping a square (or Enter) shows a note over it: 「あと7マス」 or 「いまここ」, and the kind (START / 通常 / ★イベント / ！アクシデント). One note at a time, gone after 2.6 s; not during a roll (a tap there still skips it).
- Laps: `state.laps` (every pass over START) already existed in the save, so the count is the lifetime one, not only from now. `Sugoroku.stats` sends it as `r`; `casino-stats.js` has 周回数 as a new metric of すごろくビンゴ; the second ranking tab (「すごろく記録」: ビンゴ回数, JP回数, SJP回数, ボール排出回数) now has 周回数 as a fifth panel (the tab stacks its panels and scrolls inside, so five fit). A player shows up there once their next すごろくビンゴ roll has published the new total.

Tests: `tests/casino-stats.test.cjs` (r is kept, cleaned and flat-listed), `tests/casino-ranking.smoke.cjs` (five panels), `tests/sugoroku.smoke.cjs` (the track scrolls, 「あと7マス」 / 「いまここ」).

## 10.44.00.00 ぴったりとガードの値段を上げ、ぴったりが出る回数を減らした

**What the owner said.** 「ぴったりサイコロ強すぎると思う。25ptは安すぎない？」

**Checked** (Monte Carlo, 100-point bets, a fresh card each roll). In 10.36 ぴったり was valued at +10 points using a poor choice of face. Choosing the best face of six (the average over all 100 squares; ★ event squares are worth the most, ！ accident squares the least): about +42 points counting cash only, about +82 with a ball valued at 120 points and about +119 at 233 points; so 25 points was far too cheap. ガード changed with the new accident wheel (−6 … −2 and +1 … +6): cancelling the bad slots for five rolls is worth about +70 points (it was about 19), against a price of 30.

**Now** (`sugoroku-model.js`): ぴったり costs 120 (was 25) and is 1 slot of 10 on the item wheel (was 2; ダブルダイス has 4); ガード costs 80 (was 30). Prices are now ダブルダイス 20, トリプルダイス 30, ぴったり 120, ガード 80, 倍がけ 100. ダブルダイス / トリプルダイス stay cheap because they are worth about 9 and 16 points.

Tests: `tests/sugoroku-model.test.cjs` (the item wheel's slots).

## 10.45.00.00 CHANCE（確変）を半分の頻度にして、そのぶん当たりを倍にした

**What the owner said.** 「Chanceの確率高すぎん？w」（前の問い合わせ「×0に乗ると確定でチャンスになる」も、頻度の感じ方の話だった）

**Checked.** The hidden 確変 slot is one of 40 on the normal wheel and a normal square is 80% of the board: CHANCE came once in 50 rolls (20 in 1,000), and it carried 0.139 of the 0.908 the game gives back. A plain ×0 slot never starts it (6 slots read ×0, 1 of them is the hidden one, so 1 in 6 of the ×0 landings).

**Now** (`sugoroku-model.js`, `sugoroku.js`): the hidden slot starts the 確変 wheel on a draw of 0 out of `chanceOdds` = 2; otherwise it pays ×0 like the plain ones and the event says `chance: false` (the screen shows no CHANCE then). CHANCE is now once in about 100 rolls. To keep the return, the 確変 wheel pays double: ×8 … ×30 (was ×4 … ×15) and the ball runs are 10 balls (was 5). Return without jackpots: 0.9118 (3 players, 300,000 rolls; was 0.9078).

Tests: `tests/sugoroku-model.test.cjs` (the extra draw; a draw of 1 pays ×0 with `chance: false`; ×20 and ten balls), `tests/sugoroku.smoke.cjs`.

## 10.46.00.00 CHANCE（確変）を、×0に乗ったうち25回に1回くらいにした

**What the owner said.** 「ただ0の時の1/25くらいでいいと思ってる」（隠しの枠が目立ちすぎないように。見分けられるようにするのは面白くないので、見た目は変えない）

**Checked.** After 10.45 the hidden slot started the bonus on 1 draw in 2, so of the landings that read ×0 (6 of 40 slots) it was 1 in 12.

**Now** (`sugoroku-model.js`): `chanceOdds` = 4, so 1 in 24 of the landings that read ×0 (about 1 in 200 rolls). To keep the return, the 確変 wheel pays ×16 … ×60 (was ×8 … ×30) and the ball runs are 15 balls (was 10). Return without jackpots: 0.9116 (3 players, 400,000 rolls). The look of the slot is unchanged.

Tests: `tests/sugoroku-model.test.cjs`, `tests/sugoroku.smoke.cjs` (×40 = 4,000 back; fifteen balls).

## 10.47.00.00 すごろくビンゴを一時的に「調整中」にでき、今日の賭け済み額を運営が0に戻せる

**What the owner said.** 「一回テスト版にしてほしい／変更している時にプレイして異常に−や＋になったプレイヤーがいるので、勉強時間に応じてのカジノ回数をリセットするやつを追加してほしい」（答え：双六ビンゴを一時的に遊べなくする／今日の賭け済み額を0に戻す）

**Now.**
- すごろくビンゴ (`sugoroku.js` `gateOpen`): for points play the game is **closed until the operator opens it**: it shows 「調整中」 instead of the board. The state is `shared/sugoroku_status` `{ open }` (missing or a failed read = closed); an "open" answer is kept on the device for five minutes so opening the game does not wait for the network. Practice chips (guest, offline) are never closed. A device marked as a tester (`aiglish_sugoroku_tester`) plays while it is closed.
- Admin tools (`admin-players.js`): 「すごろくビンゴの公開を切り替える」 (open / close), 「この端末だけ、閉じていても遊べるようにする」 (the tester mark), 「全員の今日の賭け済み額を0に戻す」 and, in a player's page, 「このプレイヤーの今日の賭け済み額を0に戻す」 (two presses each).
- The bets of a day are kept on each player's device (`aiglish_casino_staked_<id>`), so the operator cannot clear them directly: the tool writes `shared/casino_reset` (`all` / `players[id]` = `{ at, day }`) and `casino.js` (`applyAdminReset`, at the most every five minutes, when the casino tab opens) clears that day on the device once for each newer entry. The study allowance of that day comes back; the carry-over of earlier days is not touched.

**After this release the game is closed** (there is no `shared/sugoroku_status` yet): the operator opens it from the admin tools when ready.

Tests: `tests/casino.smoke.cjs` (the notice while closed, then open; the reset is taken once, also for one player), `tests/sugoroku-shared.smoke.cjs` (opened status), `tests/admin-players.smoke.cjs` (the buttons write the documents).

## 10.48.00.00 ポイント履歴のカジノを、ゲームごと・日ごとに1行にまとめた

**What the owner said.** 「ポイントの履歴からカジノの双六ビンゴって項目があるけど、列挙されるのではなく重なって表記されてほしい」

**Cause.** The casino lines of the history were joined only when the same game was played again within 30 minutes of the last line (`Poker.addLog`), so a day of すごろくビンゴ with pauses or other games in between made a long list of lines.

**Now** (`study-points-ui.js`): when the history is drawn, the casino lines of a day are added up per game: one line each, with the plays (「カジノ · N回分」) and the points together (the newest game stays on top). The record itself is unchanged. The explanation in the points dialog says so.

Tests: `tests/casino.smoke.cjs` (すごろくビンゴ lines split by a ルーレット line become one line of 7 plays, −280pt).

## 10.49.00.00 閉じているすごろくビンゴを「テスト版」として遊べるようにした

**What the owner said.** 「テスト版でできるようにしてください」

**Cause.** 10.47 closed the game with only a notice, so nobody could try the changes.

**Now** (`sugoroku.js`, `casino.js`): while the game is not open (`shared/sugoroku_status` missing or `open` not true) it opens as a **test version**: the `PREVIEW` set of `casino.js` (a game in it is on practice chips, so it cannot move points) gets the game through `api.preview(true)`, the screen shows 「テスト版（調整中）　練習チップで遊べます。ポイントは動きません。」, and the bingo card is the device's own (`testMode` makes `shared()` false), so nothing is read from or written to the shared card, the jackpot or the notices. Practice chips are the same 1,000 as the guest's. Opening the game again judges the account afresh; closing it takes the game out of `PREVIEW`. When the operator opens the game, points play as before. The tester mark (「この端末だけ…」) still plays for points while it is closed.

Tests: `tests/casino.smoke.cjs` (the banner, chips, and no change to the wallet or the shared card in the test version; no banner and points once opened).

## 10.50.00.00 アイテムを同時に使うと止まる不具合を直し、アイテムの値段を上げ、通常ルーレットのプラスを下げた

**What the owner said.** 「アイテムを同時に使うと進まなくなります／アイテムの値段が安すぎます（ぴったりとかを使うとほぼ確定で★にいけちゃう）／通常ルーレットの+も高い気がする」

**Cause of the stuck game.** The rules refuse any two of ダブルダイス, トリプルダイス and ぴったり at once (`two kinds of dice`), but the screen only kept ダブルダイス and ぴったり apart. Choosing トリプルダイス with ぴったり (or ダブルとトリプル) made the roll throw after the game had been set busy, and it never came back.

**Now.**
- `sugoroku.js`: choosing one of the three ways of moving lets go of the other two; and a roll that the rules refuse is stopped before anything is spent or locked, with the message 「そのアイテムの組み合わせでは振れません。選び直してください」.
- `sugoroku-model.js` prices: ダブルダイス 40, トリプルダイス 80, ぴったり 300, ガード 150, 倍がけ 200 (were 20 / 30 / 120 / 80 / 100). ★ squares come every 9 squares, so ぴったり reaches one 2 times in 3.
- The normal wheel's good slots are lower: the top is ×5 (the ×7 is gone), ×4 twice, ×3, ×2 twice, ×1 three times, ×0.5 three times; the bad ones are −5 three times (was four), −2 twice (was three), −1 twice; ×0 six times. Return without jackpots: 0.9131 (3 players, 400,000 rolls; was 0.9118).

Tests: `tests/sugoroku-model.test.cjs` (two ways of moving are refused; with ガード and 倍がけ it rolls; the x2 cap on a ×60 bonus), `tests/sugoroku.smoke.cjs` (choosing three ways of moving keeps the last; a roll with ガード and 倍がけ moves).

## 10.51.00.00 アイテムの販売（ショップ）をなくした

**What the owner said.** 「アイテムの販売は無しでいきましょう」

**Now** (`sugoroku.js`, `sugoroku-model.js`, `sugoroku.css`): the ショップ button, the shop sheet, buying (`buyItem`, `S.buy`, the `sugoroku-shop` round that took the price from the wallet), the `price` of every item and the shop's styles are removed. Items come only from the ITEM roulette (one item and 100 points each time). The rules sheet and the usage guide no longer mention buying.

Tests: `tests/sugoroku-model.test.cjs` (the buying checks are gone), `tests/sugoroku.smoke.cjs` (no ショップ button; the bag is given an item by the save instead).
