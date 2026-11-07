# Casino: Firestore rules for the shared documents (draft)

The casino keeps two documents that every player writes:

- `shared/casino_jackpot`: `{ bet, jpFrom, sjpFrom, wins[], updatedAt }`
- `shared/sugoroku_live2`: `{ v: 2, cells[98], owners[98], special, owed{}, owedAt{}, people{}, log[], updatedAt }` (the two-card game; `shared/sugoroku_live` with 49 cells is the game before, read once to make it)
- `shared/sugoroku_here`: `{ [playerId]: { n, at } }`, who is playing すごろくビンゴ right now

The project's rules are currently open, so any client can write anything there. The app now checks everything it reads back from these documents (`SugorokuModel.validCard`, `cleanPeople`/`cleanLog` in sugoroku.js, `num` in casino-jackpot.js). Bad data is ignored rather than shown, and icons are only accepted as small inline images.

That stops broken or hostile data from breaking the screen. It does not stop a player from faking a result: rolls, wheels and mini games are worked out on the player's device.

すごろくビンゴ moves real points since 10.22.35.00. Still to do:

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
match /shared/sugoroku_here {
  allow read: if true;
  allow write: if request.resource.data.size() <= 200;
}
match /shared/sugoroku_live2 {
  allow read: if true;
  allow write: if request.resource.data.v == 2
    && request.resource.data.cells is list && request.resource.data.cells.size() == 98
    && request.resource.data.owners is list && request.resource.data.owners.size() == 98
    && request.resource.data.special is int
    && (!('owed' in request.resource.data) || (request.resource.data.owed is map && request.resource.data.owed.size() <= 200))
    && (!('people' in request.resource.data) || (request.resource.data.people is map && request.resource.data.people.size() <= 100))
    && (!('log' in request.resource.data) || (request.resource.data.log is list && request.resource.data.log.size() <= 30));
}
```

## shared/sugoroku_status

`{ open, at }`: whether すごろくビンゴ may be played for points (`open: true`). Missing or false: a notice 「調整中」 is shown instead of the board (practice chips are not affected). Every signed-in player reads it; the operator's tools write it.

## shared/casino_reset

`{ all: { at, day }, players: { <id>: { at, day } } }`: the operator's "put the bets of a day back to 0". A device that has not taken an entry yet (its `at` is newer than the last one taken) clears that day (`day`, the study day as `YYYY-MM-DD`) from the bets it keeps for the study allowance. Every signed-in player reads it; the operator's tools write it.
