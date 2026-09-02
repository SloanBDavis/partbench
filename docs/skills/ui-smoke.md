# UI smoke

Daily Chromium loop for the real workbench.

The smoke:ui script starts the real app (Vite, same as the dev script).
Bun 1.4 chrome backend replays scenarios through live CadEngine Apply.
If you cannot demonstrate it in the running app via smoke:ui, you are not done.

## When to run

- Filtered slice close: smoke:ui -- scenarios/<new>.json
- Full set at release close: smoke:ui
- V25 closer: V25-added scenarios only (fillet pattern, combine, spline, loft, sweep, draft, align, offset, datum axis). Never zero UI. Wrapper: bun scripts/smoke-ui-v25.mjs (PARTBENCH_SMOKE_UI_PREFIX=v25).
- Per-save: focused tests + typecheck. Chromium is not on every save.
- verify remains typecheck + in-process scenarios.

## Chrome backend

Force chrome. Never the WebKit default. Reuse the OCCT smoke browser finder and PARTBENCH_SMOKE_BROWSER.
Bun is a dev runner, not a production dependency and not the workspace package manager.
Missing bun or Chrome fails the run. Do not pass-skip.
Install bun: curl -fsSL https://bun.sh/install | bash
Chrome: set PARTBENCH_SMOKE_BROWSER to a Chrome/Chromium executable.
Reuse PARTBENCH_SMOKE_BROWSER_NO_SANDBOX from OCCT smokes when Chrome needs it.
PARTBENCH_SMOKE_UI_TIMEOUT_MS defaults to 180000.

## Apply path

Open /?ui-smoke=1. window.__PARTBENCH_UI_SMOKE__.applyOps(ops) calls App commitOps, which builds a commit batch and runs commandExecutor.executeBatch (the same path FeatureEditor Apply uses).
Assert no error toast, workbench finished building (not pending), expected bodies/features from project.structure.
Tiny collector clicks: Apply (Box then Apply), pick, promotion.
Crash-recovery dialogs are skipped under the ui-smoke query flag.

## Failures

PNG under .metrics/ui-smoke/ (gitignored). Print scenario id, screenshot path, and on-screen diagnostic. Non-zero exit.

## Passing record

2026-09-01 10:37 PM PT. bun scripts/smoke-ui-v25.mjs. 12/12 V25 scenarios. chrome /usr/bin/google-chrome. backend HeadlessChrome/151.0.0.0 (not WebKit). Apply collector plus live commitOps replay.
