# Automatic textbook downloads

Word-book bodies are immutable versioned JSON files. Learning progress remains in the ordinary cloud save and canonical `vocabProgress` documents. Workbook problem/answer/supplement bodies use the same immutable-file mechanism. Workbook understanding, personal notes and review schedules stay in the normal cloud save. Reader, profile, sharing, ranking and group behavior is unchanged.

## Storage and migration

- Opening a word book copies its master into the dedicated IndexedDB database `aiglish-textbook-files`. The browser stores the file persistently across ordinary reloads and tab closures. The existing local draft and full-save recovery copies remain available.
- The SHA-256 of the progress-free body identifies its version. On the first cloud save of that version, immutable parts are written to the existing `users/{owner}/vocabBooks/{encodedBook}/parts/m_{hash}_p{n}` path. The ordinary cloud save then contains the reference and learning records instead of another copy of the body.
- All immutable parts must commit before any save containing their reference can be published. The main manifest is still published last. Interrupted migration leaves the previous cloud generation and full local snapshot intact. No old saves are deleted by migration.
- Identical bodies are not uploaded on later progress saves. Actual textbook edits create a new version; old versions remain valid for existing save references. The original cloud copy remains necessary for recovery on another device.
- Old full-master saves continue to load. Migration happens on opening/saving, without resetting book IDs, word IDs, ratings or ranking epochs.

## Reading and recovery

Opening a previously downloaded book uses the existing local draft/cache and the file cache without cloud body reads. When restoring a compact cloud save, only the active word-book body is downloaded; other word-book references are retained and resolved when selected. Workbooks currently have a synchronous list model, so their content files are downloaded once during cloud recovery and reused locally thereafter. Newer local workbook snapshots are preserved without downloading older cloud bodies. Downloads verify length and SHA-256 before publishing the local file. Missing or corrupt bodies are errors, never empty textbooks. Canonical timestamp-aware progress recovery remains in charge of ratings and notes.

This does not add polling of all shared textbooks. Existing publishing/import/edit operations are unchanged. This also does not promise automatic detection of arbitrary edits by another user to a copied public textbook; that needs an explicit version-update policy rather than overwriting a user's local edits.

Files are scoped to account and book. Permanent book deletion removes its local files and existing cloud-parts cleanup includes immutable files. Administrative account deletion clears the new cache as well. File backup export is self-contained and uses no Firestore reads: if a referenced body has not been downloaded, it asks the user to open that book first.

## Save UI

Normal save remains one button. Optional file backup/restore is collapsed under “ファイルにバックアップ・復元（任意）”. It is a manual external backup, separate from automatic textbook storage. Browser storage can still be lost through clearing site data, private browsing, storage pressure or OS policy. Unsynced data must not be treated as safely stored in the cloud.

## Validation

`node tests/textbook-files.smoke.cjs` (also `BROWSER=webkit`) covers first migration, unchanged-body upload reuse, progress edits, changed versions, lazy body download, cache eviction/recovery, actual reload persistence, interrupted upload preserving the last complete cloud generation, missing-part rejection, and account/deletion guards. Fixtures use mocked Firestore and never touch production accounts.

The 1,500-word fixture reduces the recurring integrated-save JSON from about 450 KB to roughly 1–2 KB; this is a fixture measurement, not a forecast of total Firebase operations. Initial migration still uploads the original once, and ranking/shared-note/group reads are unaffected by this change.
