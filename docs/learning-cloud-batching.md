# End-only learning cloud saves

Canonical answers and recovery records are written to the device synchronously. Word-card buttons use `LearningData.commit`: their previous path wrote no per-word edit timestamp, allowing recovery reads to prefer an old answer. Explicit edit timestamps increase even for two answers in the same millisecond. Notes and sticky markers remain attached to the word.

## When cloud backups run

- Flashcard completion, quit and pause.
- Battle completion/abandonment, login-quiz completion/close.
- Returning from a word book or workbook to its selection screen, closing a reader, or leaving a study tab with pending changes.
- Entering sleep mode (even during a paused or unfinished study session).
- Explicit manual save and logout.

`queueBackgroundSave`, rating changes and swipe checkpoints now only record a durable pending marker. There are no timed backup retries, cloud saves every five answers, automatic resume/online saves, or focus/dialog-close backup deadlines. A failed save stays on the device until the next completion or explicit save. Sleep still deducts idle time and saves once through the existing sleep handler. Closing an app can interrupt networking; local canonical records and flash checkpoints remain important.

The end-save coordinator coalesces overlapping finish/close/tab events, refuses a normal completion backup while active play continues, flushes local storage, merges any pending battle answers, and invokes the complete backup. An answer added during a save retains its pending state. Guest records remain local. The manual save UI is unchanged.

## Other cloud writers

Periodic ranking/study-statistic publication, group milestone publication, profile retry publication and a legacy statistics writer are held back under this policy. Completed saves publish the latest ranking/profile/group state. Explicit profile save and group refresh still work. Real-time battle-room communication and shared-content publication required by explicit user actions are unchanged; these are not periodic learning backups.

Cloud progress payloads are acknowledged per session so an identical background payload skips a redundant progress transaction. Manual save bypasses this suppression. Successful understanding reads are cached for five minutes per account/book; latest local canonical values are applied before returning a cache hit. Failed/quota-blocked reads are never cached as empty records.

A full save merges every captured dirty book, not just the displayed book. Only captured revisions are acknowledged, so concurrent edits remain pending. Existing complete local snapshots and immutable textbook files are retained. The feature does not reset exhausted Firebase quotas, and other-device learning/ranking updates now generally appear after a completion save.

## Validation

Unit coverage exercises no timer registration or cloud calls during repeated changes/swipes, one coalesced completion save, failed-save retention, account switches, quota/loading guards, active-play protection, sleep override, next-completion retries, canonical recovery and same-millisecond answers.

`tests/end-only-save.smoke.cjs` uses the actual application and a virtual clock: 100 ratings plus three minutes of play have zero cloud writes (including legacy statistics/ranking/profile paths), completion performs one backup, no periodic backup follows, and sleep performs one save containing the newest answer. Firestore is mocked. Chromium/WebKit verification is distinct from actual iPhone and production usage observation.
