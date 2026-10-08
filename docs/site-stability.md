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
