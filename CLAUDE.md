# CLAUDE.md

## Roles: Sonnet builds, Haiku explores, Opus reviews

- **The session (Sonnet 5.5) leads.** It plans the work, writes the code, runs the tests and ships.
- **Haiku explores.** Send file and documentation searches to subagents started with `model: "haiku"` (the `Explore` type where it fits). Run independent searches in parallel, and ask each for a short answer with `file:line` references, not file dumps.
- **Opus is the advisor.** Start a subagent with `model: "opus"` only for these:
  1. reviewing a plan before a large or risky change (data formats, money or points, security, deleting data);
  2. the same error or test failure coming back after two fixes;
  3. a final check before finishing a large change: what was missed, which tests are missing, what the docs left out.

  Give it only what it needs: the goal, the diff or plan, and the error. Do not use it for searching, small edits or routine work, so its context is kept for decisions.

## Shipping a change

1. **Bump the version.**
   - Replace the version (for example `10.22.61.00`) with the next one in `index.html`, `startup-diagnostics.html` and `tests/flashcard-settings.smoke.cjs`, using `sed -i 's/OLD/NEW/g'` on all three.
   - Step the third number by one (`10.22.61.00` → `10.22.62.00`).
2. **Update the docs.**
   - Add an entry at the end of `docs/site-stability.md`: what the user saw, the cause, the fix, and the tests.
   - Update `usage-guide-content.js` when a player can see the change.
3. **Test.**
   - Start the local server if it is not running: `(setsid nohup python3 -m http.server 8000 >/dev/null 2>&1 < /dev/null &)`.
   - Run every smoke test (`tests/*.smoke.cjs`, about 6 at a time) and `node --test tests/*.test.cjs`.
   - Run any test that fails again on its own. A few are known to fail only under load.
   - Do not push until everything passes.
4. **Commit, open a pull request into `main`, and merge it.** The owner has said merges need no confirmation.
5. **Reset the working branch to `main`:**
   `git fetch -q origin main && git checkout -q -B <branch> origin/main && git push -q -f origin <branch>`.
6. **Check the Codex review.** About 20 minutes after merging, look for its comments on the pull request and fix any that are valid.

## Talking to the owner

Reply in Japanese, in plain words a beginner can follow, without sounding like an AI. Do not read production Firestore data: that was refused, and only the owner can allow it.
