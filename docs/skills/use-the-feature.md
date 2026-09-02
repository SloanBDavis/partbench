# Use the feature

Close-time recipe. Do not skip. `applyOps` is the engine gate, not Use.

1. Chromium on the real Vite app (`pnpm smoke:ui-use`, bun chrome backend). Force chrome. Fail if bun or Chrome is missing.
2. Perform the user-visible path for THIS feature: open the command, set the field, Apply or pick, see the solid.
3. Screenshot success to `.metrics/ui-smoke/`.
4. One break case: illegal value, wrong pick, or empty collector. Structured fail or blocked control, not a freeze.
5. First landing: write `use` and `useBreak` on the scenario from what worked. Forever after, the script is the hill-climb. Missing `use` on a new UI scenario fails close. Do not skip.
6. If Use fails: fix code, return to Believe, Use again. Do not close.

Template: `scenarios/v25-feature-pattern-fillet.json` (`use` + `useBreak`). Box Apply is the smallest honest path.

Never Playwright. Never a second bot. Never the V7 gauntlet.
