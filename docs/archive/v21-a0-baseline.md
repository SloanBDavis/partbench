# V21 A0 Baseline

Recorded: 2026-08-01  
Baseline commit: `a40d3b7f2ed491a0d8f6aa3c6fe7394fd4dea8bd`  
Runtime: Node `v22.22.1`, pnpm `10.14.0`, Chrome for Testing `151.0.7922.71`

This is the frozen clean V20 compatibility baseline for V21. Generated
`.metrics` files remain ignored; this committed ledger records the release
evidence that V21 must retain.

## Repository gates

| Command | Result |
| --- | --- |
| `pnpm test` | 2,861 passed; one documented skip |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed with the six existing `react-refresh/only-export-components` warnings |
| `pnpm format:check` | Passed |
| `pnpm build` | Passed |

The full test rerun used loopback permission required by the V20 launcher
tests. The six lint warnings are in `SketchModeDock.tsx` (1),
`NumericInput.tsx` (1), `ContextualActionStrip.tsx` (1), `ModeRibbon.tsx` (2),
and `WorkbenchShell.tsx` (1).

## V19 compatibility gates

All eight named V19 commands passed sequentially:

- `pnpm smoke:v19-release-samples`
- `pnpm smoke:v19-curve-edit-workflow`
- `pnpm smoke:v19-dimensions-constraints-workflow`
- `pnpm smoke:v19-profile-regions-workflow`
- `pnpm smoke:v19-storage-migration-workflow`
- `pnpm smoke:v19-browser-workflow` — 36/36 checks
- `pnpm check:v19-bundle`
- `pnpm smoke:v19-performance`

The browser command used `PARTBENCH_SMOKE_BROWSER_NO_SANDBOX=1` in this
container. Performance evidence passed with shell median `1,996.9 ms`, command
search p95 `42.2 ms`, warm action p95 `66.3 ms`, frame p95 `17 ms`, and no long
task. The near-limit case used 512 candidates and recorded frame p95 `17.6 ms`
and feedback latency `23.3 ms`.

## V20 release gates

All three named V20 commands passed sequentially:

- `pnpm smoke:v20-live-agent-workflow` — 7 checks; `.wcad` output 2,192 bytes
- `pnpm smoke:v20-local-security` — 4/4 checks
- `pnpm check:v20-bundle`

## Frozen bundle measurements

`check:v19-bundle` and `check:v20-bundle` produced the same passing values.

| Asset boundary | Raw bytes | Gzip bytes | Cap |
| --- | ---: | ---: | ---: |
| Critical UI JavaScript | 1,734,391 | 409,368 | 409,600 gzip |
| UI CSS | 37,839 | 6,709 | 20,480 gzip |
| All UI | 2,216,884 | 539,331 | 563,200 gzip |
| Command worker | 1,198,487 | 256,960 | 262,144 gzip |
| Geometry worker | 368,519 | 84,725 | 122,880 gzip |
| OCCT WASM | 50,305,130 | 13,808,536 | 13,808,536 gzip |

## Existing exact-export evidence

The existing V17 geometry-worker workflows all passed and produced real OCCT
AP242 STEP artifacts:

| Existing sample | STEP bytes |
| --- | ---: |
| Arc-profile extrude | 9,615 |
| Composite revolve/extrude sample | 98,181 |
| Curved sweep | 21,625 |

The production browser's V17 authored-workflow slice passed 13/13 checks after
fixing its stale case-sensitive ribbon locator. The current V18 browser smoke
does not exercise the STEP download path; A1 therefore owns the first real
browser XDE name/unit round-trip proof rather than treating a STEP text header
or Node-only writer result as sufficient.

## Classified baseline issue

The first V17 browser run failed because the smoke locator expected title-case
ribbon labels while the completed V18 UI uses sentence case. Commit
`a40d3b7f2ed491a0d8f6aa3c6fe7394fd4dea8bd` fixes the shared locator with a
case-insensitive comparison; its focused 20-test suite and the 13/13 browser
slice pass. No product behavior changed.

