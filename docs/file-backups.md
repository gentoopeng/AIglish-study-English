# Files outside Safari/PWA storage

The save panel offers a manual JSON learning backup. Export/restore use the current device's records and make no Firestore queries. The normal cloud retry remains independent.

On platforms with file sharing, export prepares a file and then shows a separate “ファイルに保存・共有” button. Its click invokes the native sharing sheet with an active user gesture, allowing iPhone users to choose Files/iCloud Drive. Other platforms download the JSON directly. The UI asks users to verify the saved file rather than reporting a completed OS save before the destination is chosen.

## Contents and validation

- Account-scoped book masters, meaning ratings, notes and sharing preferences, workbook records, study ledger, profile, reader records and understanding history are included.
- API keys, PIN/password caches, other accounts' settings, device leases, device-only flash positions and server-side group records are excluded.
- Version/schema, account, timestamp, 20 MiB file size and checksum are checked before applying an import. Unknown storage/memory fields are discarded. The checksum detects accidental changes; it is not a server signature.
- Restoration uses the existing recovery path: understanding records merge by edit timestamps, newer draft/workbook records survive, study ledgers merge, and library deletion tombstones remain effective. The file picker shows date/book count before the user confirms.
- A fresh local integrated snapshot is committed after restoration, so the previous integrated backup cannot undo the restored records on the next launch. IndexedDB writes are flushed before reporting success.

This is a manual copy. Users should keep and periodically update the exported file outside the website's storage. Restoring requires the same signed-in account; the file does not authenticate a user. PWA real-device OS share/download behavior remains a deployment verification item.
