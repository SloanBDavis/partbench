# Verification

Proof for a slice. Point here. Never a second bot.

- CADOps `scenarios/` = command truth.
- `pnpm smoke:ui` `applyOps` = engine in the real Vite app.
- `pnpm smoke:ui-use` = a person/agent operating the control (clicks and typed fields).

All three for a UI slice. Injecting `window.__PARTBENCH_UI_SMOKE__.applyOps` is not Use. Never the historical gauntlet. Never Playwright.

## Build

Focused tests and typecheck of the packages you touched. No Chromium. No `smoke:ui` on every save.

## Believe

In-process `scenarios/` plus named closer packages green. You think the Must row is true.

## Use

Required if the slice has UI. Chromium on the real Vite app (bun + chrome force, headless is fine if screenshots are written). Perform the user-visible path for THIS feature: open the command, set the field, Apply or pick, see the solid. Screenshot success to `.metrics/ui-smoke/` (gitignored). Then one break case (illegal value, wrong pick, empty collector). If it fails: fix code, go back to Believe, Use again. Do not declare close until Use has a success screenshot and the break case is a structured fail or a blocked control, not a freeze.

First landing: drive the UI once and write the scenario `use` / `useBreak` arrays from what worked. After that, `pnpm smoke:ui-use` is the hill-climb. Missing `use` on a new UI scenario fails close (`--require-use`, or `smoke:ui-use` filtered to that scenario). Existing V25 scenarios without `use` still pass `smoke:ui`.

## Slice close

Named closer + `smoke:ui` (engine) + Use path green. See [close-a-slice.md](./skills/close-a-slice.md), [use-the-feature.md](./skills/use-the-feature.md), [ui-smoke.md](./skills/ui-smoke.md).

## Passing record

2026-09-02 1:08 AM PT. `pnpm smoke:ui-use -- scenarios/v25-feature-pattern-fillet.json`. chrome /usr/bin/google-chrome. backend HeadlessChrome/151.0.0.0 (not WebKit). Template Use is box Apply (open Box, type width 20, Apply, solid). Break: width 0 -> Apply disabled (blocked control, not a freeze). Screenshot `.metrics/ui-smoke/v25-feature-pattern-fillet-use.png`.
