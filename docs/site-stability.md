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
