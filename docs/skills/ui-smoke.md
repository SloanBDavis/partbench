# UI smoke

Daily Chromium loop for the real workbench.

The script starts the real app (Vite, same as the dev script). Bun 1.4 chrome backend.

- `pnpm smoke:ui` — engine gate: `window.__PARTBENCH_UI_SMOKE__.applyOps` through live CadEngine Apply.
- `pnpm smoke:ui-use` — Use path: clicks and typed fields from the scenario `use` array. Not applyOps.

If you cannot demonstrate it in the running app, you are not done. See [verification.md](../verification.md).

## When to run

- Filtered slice close, engine: `pnpm smoke:ui -- scenarios/<new>.json`
- Filtered slice close, Use: `pnpm smoke:ui-use -- scenarios/<new>.json`
- New UI scenario without `use` fails `smoke:ui-use` / `--require-use`. Existing V25 scenarios without `use` still pass `smoke:ui`.
- Full engine set at release close: `smoke:ui`
- V25 closer: V25-added scenarios only (engine). Wrapper: `bun scripts/smoke-ui-v25.mjs`.
- Per-save: focused tests + typecheck. Chromium is not on every save.
- `verify` remains typecheck + in-process scenarios.

## Chrome backend

Force chrome. Never the WebKit default. Reuse the OCCT smoke browser finder and PARTBENCH_SMOKE_BROWSER.
Bun is a dev runner, not a production dependency and not the workspace package manager.
Missing bun or Chrome fails the run. Do not pass-skip.
Install bun: curl -fsSL https://bun.sh/install | bash
Chrome: set PARTBENCH_SMOKE_BROWSER to a Chrome/Chromium executable.
Reuse PARTBENCH_SMOKE_BROWSER_NO_SANDBOX from OCCT smokes when Chrome needs it.
PARTBENCH_SMOKE_UI_TIMEOUT_MS defaults to 180000.

## Engine path (`smoke:ui`)

Open /?ui-smoke=1. `applyOps(ops)` calls App commitOps (the same path FeatureEditor Apply uses).
Assert no error toast, workbench finished building, expected bodies/features from project.structure.
Tiny collector clicks remain: Apply (Box then Apply), pick, promotion.
Crash-recovery dialogs are skipped under the ui-smoke query flag.

## Use path (`smoke:ui-use`)

A scenario may include `use` and `useBreak`: selectors + click/type/apply + wait-for-ready + screenshot name, then a break case.
First landing: drive the UI once and write that block from what worked. After that, the script is the hill-climb.
Template: `scenarios/v25-feature-pattern-fillet.json`. Seed `applyOps` is setup so Use can operate the claimed feature; Use is the clicks that follow.

## Failures

PNG under `.metrics/ui-smoke/` (gitignored). Print scenario id, screenshot path, and on-screen diagnostic. Non-zero exit.

## Passing record

2026-09-01 10:37 PM PT. bun scripts/smoke-ui-v25.mjs. 12/12 V25 scenarios. chrome /usr/bin/google-chrome. backend HeadlessChrome/151.0.0.0 (not WebKit). Apply collector plus live commitOps replay.

2026-09-02 1:08 AM PT. `pnpm smoke:ui-use -- scenarios/v25-feature-pattern-fillet.json`. chrome /usr/bin/google-chrome. backend HeadlessChrome/151.0.0.0 (not WebKit). Use: Box command, type width 20, Apply, solid. Break: width 0 -> Apply disabled. Screenshot `.metrics/ui-smoke/v25-feature-pattern-fillet-use.png`.
