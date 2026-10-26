# Security status

Last updated for version 10.21.45.

## What the app does now

**PINs are stored as digests.** A PIN is stored as `p1$…`: PBKDF2-SHA-256 with 120,000 rounds, salted by the account ID. The digits are never stored. This applies to `users/{id}.pin`, the shared list `shared/all_users`, and the device cache `core_v4_users`.
- Login checks the typed PIN against the digest. Older digit PINs still work.
- A successful login replaces digits with the digest.
- The first device that reads an old shared list rewrites it once, then updates each `users/{id}` that still holds the same digits.

**No real names or ages in the shared list.** `shared/all_users` and the device cache keep only `id`, `playerName` and `pin`. The login confirmation shows the player name and the ID instead of the real name and age.

**The API key stays on the device.** The Gemini API key, and the cached account list, are left out of the cloud save. A save restored without a key never clears the key on the device.

**The admin password is not in the page source.** It is checked against salted SHA-256 digests.

## What still needs work (cannot be fixed in the page alone)

1. **Firestore rules are open.** Anyone who knows the project can read and write every document, including `users/{id}` (real name, age, PIN digest), groups, rooms and points.
2. **A 4-digit PIN digest can be brute-forced.** There are only 10,000 PINs, so a slow digest delays an attacker but does not stop one. Only a server-side check with rate limiting stops this.
3. **Real names and ages are still in `users/{id}`.** The users list downloads these documents when it scans users.
4. **Poker trusts the table's maker.** The device that deals knows every card, and the points each player adds after a hand are computed on their own device. This is fine for friendly games, but it is not protected against cheating.
5. **Point lending trusts each device.** `pointLoans/{a__b}` holds a pair's history and which transfers the receiver has added to their wallet; `pointLoanInbox/{id}` lists a person's pairs. Each move runs in one transaction with the record, so in normal use nothing is paid twice and each wallet is written only by its owner's device. With the rules open, someone could still write these documents directly, just as they can already write their own wallet.
6. **Admin checks run on the device.** Anyone can skip them by editing the page in their own browser.
7. **The old admin password is in the git history.** Change it: replace the two digests in `window.verifyAdminPassword` (app.js) with `sha256("aiglish-admin:" + newPassword)`.

## Recommended next step: Firebase Authentication

The lasting fix is to let Firebase check the PIN on its servers, and to lock the database to signed-in users.

1. In the Firebase console, go to Authentication → Sign-in method and enable **Email/Password**.
2. In the app, sign each account in as `<id>@accounts.aiglish.invalid`, with a password derived from the PIN (for example `aiglish:` + id + `:` + PIN). Firebase then:
   - rate-limits wrong attempts
   - never exposes the password
3. Migration: on a successful login with today's PIN check, create the Firebase account once, using the same derived password.
4. Then deploy rules such as:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function signedIn() { return request.auth != null; }
    function owner(id) { return signedIn() && request.auth.token.email == id.lower() + '@accounts.aiglish.invalid'; }
    match /users/{id} {
      allow read: if signedIn();
      allow write: if owner(id);
      match /{rest=**} { allow read, write: if owner(id); }
    }
    match /studyGroups/{group} {
      allow read, write: if signedIn() && request.auth.token.email.split('@')[0].upper() in resource.data.members;
      allow create: if signedIn();
      match /{rest=**} { allow read, write: if signedIn(); }
    }
    match /{document=**} { allow read, write: if signedIn(); }
  }
}
```

The rules above are a starting point. Test them in the Rules Playground before deploying, because a mistake there can lock every user out.
