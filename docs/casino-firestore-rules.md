# Casino: Firestore rules for the shared documents (draft)

The casino keeps two documents that every player writes:

- `shared/casino_jackpot`: `{ bet, jpFrom, sjpFrom, wins[], updatedAt }`
- `shared/sugoroku_card`: `{ cells[49], owners[49], owed{}, people{}, log[], updatedAt }`

The project's rules are currently open, so any client can write anything there. The app now checks everything it reads back from these documents (`SugorokuModel.validCard`, `cleanPeople`/`cleanLog` in sugoroku.js, `num` in casino-jackpot.js). Bad data is ignored rather than shown, and icons are only accepted as small inline images.

That stops broken or hostile data from breaking the screen. It does not stop a player from faking a result: rolls, wheels and mini games are worked out on the player's device.

Before すごろくビンゴ moves real points:

1. Merge rules like the ones below into the project's existing ruleset in the Firebase console. **Do not replace the ruleset with this file**: it covers only these two documents. The app does not use Firebase Authentication, so rules can check the shape and size of a write but not who made it.
2. For real protection, move the roll itself to a server. That means a Cloud Function, or a Vercel function with a service account, that draws the numbers, writes the card and pays the wallet. The app then only shows the result.

```
match /shared/casino_jackpot {
  allow read: if true;
  allow write: if request.resource.data.bet is int
    && (resource == null || (
         request.resource.data.bet >= resource.data.bet
         && request.resource.data.bet - resource.data.bet <= 1000000
         && request.resource.data.jpFrom in [resource.data.jpFrom, request.resource.data.bet]
         && request.resource.data.sjpFrom in [resource.data.sjpFrom, request.resource.data.bet]))
    && (!('wins' in request.resource.data) || request.resource.data.wins.size() <= 20);
}
match /shared/sugoroku_card {
  allow read: if true;
  allow write: if request.resource.data.cells is list && request.resource.data.cells.size() == 49
    && request.resource.data.owners is list && request.resource.data.owners.size() == 49
    && (!('owed' in request.resource.data) || (request.resource.data.owed is map && request.resource.data.owed.size() <= 200))
    && (!('people' in request.resource.data) || (request.resource.data.people is map && request.resource.data.people.size() <= 100))
    && (!('log' in request.resource.data) || (request.resource.data.log is list && request.resource.data.log.size() <= 30));
}
```
