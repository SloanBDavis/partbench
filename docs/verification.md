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

## Focused regression suite

`pnpm smoke:e2e` runs two assembly journeys in the real Chromium workbench:

- Distance mate: enter a gap, Apply, Undo, Redo; assert the exact instance
  translations and mate counts at each step. An empty distance must block Apply
  and preserve the original pose and mate list.
- Concentric mate: Cancel a valid draft without changing the assembly, then
  reopen and Apply; assert radial alignment while preserving axial position.
  An empty instance collector must block Apply without source mutation.

Requires Bun 1.4.2+ (`curl -fsSL https://bun.sh/install | bash`) and installed
Chrome/Chromium. No new package dependency. The existing `smoke:ui-use` command
still runs all scenarios that define Use paths; `smoke:e2e` selects only these
two. Run the focused command before pushing changes to assembly workflows. It
is deliberately separate from the per-save checks and `pnpm verify`.

The runner uses native, actionable button clicks and numeric typing. Dropdown
selection uses the existing input/change helper, with a visible/enabled
control check; dropdown keyboard navigation is not covered. Each journey and
its break case gets a fresh tab while sharing Chrome and Vite. There are no
scenario/seed retries. Assertions wait for observable document/geometry state;
strict array lengths catch duplicate mates and failed undo. Screenshots are
inspection artifacts, not visual snapshot comparisons. Save/reopen and recovery
remain outside this deliberately small assembly suite. The separate
[agent runtime checks](./agent-runtime-verification.md) cover native save/reopen
through headless sessions and a browser Open/edit journey.

## Passing record

2026-09-02 1:08 AM PT. `pnpm smoke:ui-use -- scenarios/v25-feature-pattern-fillet.json`. chrome /usr/bin/google-chrome. backend HeadlessChrome/151.0.0.0 (not WebKit). Template Use is box Apply (open Box, type width 20, Apply, solid). Break: width 0 -> Apply disabled (blocked control, not a freeze). Screenshot `.metrics/ui-smoke/v25-feature-pattern-fillet-use.png`.

2026-09-04 PT. Fixed mate Apply Use on v26-fixed-root. Chromium not WebKit. Break: empty instance Apply disabled. Success screenshot under ui-smoke for fixed-root-use.

2026-09-07. Bun 1.4.2 / macOS Chrome 152. `pnpm smoke:e2e` passed three
consecutive runs without retries: concentric/cancel 5.0–5.1 s and
distance/history 5.5 s (10.5–10.6 s combined, plus browser/server startup).
All five `smoke:ui-use` workflows passed; the two selected `smoke:ui` engine
scenarios passed; `node scripts/scenarios-run.mjs` passed 25/25 command cases.
Success/break screenshots are in `.metrics/ui-smoke/`. Script ESLint,
Prettier, Node syntax validation, and `git diff --check` passed.


2026-09-07 follow-up: pre-Apply assertions reproduced a real app defect in both
focused journeys: valid assembly mate drafts displayed an unsupported exact
preview error. Preview routing now uses the same feature-kind classification
as Apply, so mates, primitives, datums, sketches, and transforms do not start
solid-feature previews. All four mate Use paths assert no preview/error before
Apply (and before Cancel in the concentric path). The strengthened tests failed
before the fix and all five UI workflows passed afterward. The app typecheck
and 106 focused web tests passed. No geometry or command support changed.
