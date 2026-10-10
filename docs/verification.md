# Verification

## Current policy — 2026-10-10

Only end-to-end tests. Never add unit, component, isolated integration, mocked,
or snapshot suites. Vitest and all 363 test files have been removed. Extend an
existing workflow before creating another. Typecheck and lint remain static
checks. Historical passing records below describe the tooling at that time and
are not current commands or evidence for the new suite.

`pnpm test` (also `pnpm smoke:e2e`) runs one consolidated suite:

| Journey                   | User-visible coverage                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Assembly distance         | Apply gap, exact pose, Undo/Redo, invalid distance                                                                                          |
| Assembly concentric       | Cancel, reopen/Apply, radial/axial placement, empty collector                                                                               |
| Editable interchange      | STEP cancel/retry/import, independent occurrence, face pick/offset, sibling volume, Undo/Redo, native save/reload/reopen/edit, invalid STEP |
| Public MCP mounting plate | Real stdio process, author/exact inspect, atomic rejection, dry run, revise, WCAD save/reopen, STEP export/readback                         |

Browser cases share one Vite/Chrome startup and use fresh tabs for isolation.
No retries or silent missing-tool skips. The STEP fixture is generated from real
CAD operations by `scripts/prepare-interchange.mjs`, independently of any tests.
The MCP executable is built once for its journey. Reports go to
`.metrics/e2e/report.json`; browser screenshots go to `.metrics/ui-smoke/`.

Use `pnpm test:e2e -- assembly`, `interchange`, or `agent` while editing (multiple
names accepted). `pnpm verify` runs typecheck and this suite before landing.
Per-save: affected package typecheck. No browser on every save.

Requires Node 22, pnpm 10, Bun 1.4.2+ with `Bun.WebView`, and Chrome/Chromium.
Set `PARTBENCH_SMOKE_BROWSER` if Chrome is not detected. Missing dependencies
fail; they never turn into a passing result.

Only real controls count for UI acceptance. CADOps scenarios remain reusable setup; `smoke:ui` applyOps replay is optional
browser diagnosis, not a required extra gate. The isolated scenario test runner
and historical versioned runners have been removed. Geometry, persistence and rejection assertions belong inside E2E
journeys. File-picker fixtures exercise product readers/writers but not OS dialogs.
Screenshots are inspection artifacts, not pixel snapshot tests.

## Targeted larger workflows

Keep expensive coverage outside the default loop. When changing these workflows,
run the relevant existing headless/browser pair, not every pair:

- `smoke:robot-arm` then `smoke:robot-arm:browser`.
- `smoke:gearbox` then `smoke:gearbox:browser`.
- `smoke:engine-interchange` then `smoke:engine-interchange:browser`
  (requires the pinned external engine fixture; see its example README).
- `smoke:agent-runtime` runs both full MCP examples; the default suite selects
  mounting-plate. `smoke:agent-runtime:browser` uses its generated native fixture.

Recovery after a crash, broad DXF/SVG fidelity, all feature combinations, and
hardware GPU performance are not established by this small default suite. Add
needed assertions to the nearest journey as the roadmap reaches those features.

## Current performance slice

See [import and editing performance](import-performance.md) for exact baseline
comparison, full engine E2E results, and measured latency limits.

## Consolidation validation — 2026-10-10

The new `pnpm test` passed on Linux with Node 22, pnpm 10.14.0,
Bun 1.4.2 and Chromium 154 (SwiftShader). Three browser journeys and their break
cases passed, followed by the public MCP mounting-plate journey. Stage timings:
fixture preparation 15.0 s, shared browser run 62.8 s, MCP build 23.8 s, MCP
journey 20.5 s (about 122 s total). This first checkout run overlapped static
checks; it is not a controlled performance benchmark or a warm-run speed claim.
The native-reopened edited-assembly screenshot was visually inspected.

All 13 workspace packages pass `pnpm typecheck`. Changed scripts pass ESLint
and Prettier; `git diff --check` passes. No test/spec
files or Vitest dependencies remain. Root package commands shrink from 97 to 24.
Explicit root Node type definitions replace the transitive types lost with Vitest.

Repository-wide lint is not green: seven existing errors remain in unchanged
`ViewportFeatureGrips`, `SketchIntentEditor`, `SketchModeDock`,
`SolidPreviewCoordinator`, and `solidDraftValidation` source. They concern React
ref/effect usage and a NaN comparison. This cleanup does not suppress those rules.
Lint remains a separate command; `verify` retains typechecking and now runs E2E
instead of the removed isolated scenario suite.

## Historical evidence (before E2E consolidation)

## Passing record

The [gearbox workflow record](./gearbox-workflow.md#verification-record) covers
native parametric gears, coherent spacing/ratio changes and motion continuity.
Run `pnpm smoke:gearbox`, then `pnpm smoke:ui -- scenarios/gearbox-parametric-revision.json`
and `pnpm smoke:gearbox:browser`. The last command opens the native file produced
by the closer, selects a gear, edits ratio/angle through controls, uses Undo/Redo
and checks an empty-input break case. Frame sampling checks that motion never
drops ready exact results or rendered mesh identities. This is one fuller journey;
the two fast `smoke:e2e` cases remain unchanged in scope.

2026-09-12: gearbox headless closer, command scenario, engine (22.8 s), native
Use (70.1 s; 24 motion frames, zero drops), and both fast assembly journeys passed.
The runner uses monotonic wait deadlines and bounded failure capture without
retries. Engine scenarios execute their declared read-only query, including
bounded pose projections, instead of substituting the full structure response.

The [robot arm fixes record](./robot-arm-fixes.md#verification-record) documents
the connected assembly closer, focused CADOps scenario, browser controls and
native/STEP evidence. Run `pnpm smoke:robot-arm` before
`pnpm smoke:robot-arm:browser`; the browser command uses the generated WCAD.
The two fast journeys in `smoke:e2e` remain separate from this fuller closer.

Robot-arm browser assertions require a ready exact result for every active
body and ready display entries. Consumed intermediate bodies are excluded.
Pose comparisons allow `1e-7` numeric tolerance; expected arrays retain strict
length checks. `expectViewport` checks the rendered mesh identities, so extra
definition meshes cannot pass merely because the document is correct.

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

## Editable interchange

`pnpm smoke:interchange` is the small default closer. It runs the two focused
shared-runtime test files, writes its STEP/native fixtures under
`.metrics/editable-interchange/`, and executes `scenarios/editable-interchange.json`.
Then run `pnpm smoke:ui -- scenarios/editable-interchange.json` and
`pnpm smoke:interchange:browser` for the command engine and real UI journeys.
The `useSeed` override lets this scenario keep its authored command fixture while
the Use path starts empty and imports the generated STEP file through Import.

The Use journey imports a nested assembly, makes one occurrence independent,
selects a real face in the viewport, offsets it, checks changed and unchanged
body volumes, uses Undo/Redo, saves a native file, reloads the app, opens that
file, and edits the saved feature again. An invalid STEP is the one break case.
Native Open/Save use file-picker fixtures while exercising the real product
reader/writer and controls. They do not test OS dialogs or filesystem permissions.
Canvas selection uses native coordinates; orbit uses native Chromium mouse input
through the existing Bun.WebView CDP connection. No browser API applies modeling
commands during these interactions.

The separate, deliberately slower `pnpm smoke:engine-interchange` uses the pinned
public 13.4 MB engine. It checks import, an independent occurrence, a bore change,
sketch cuts, movement, native reopen and parameter/history editing, STEP export
and reimport, then further bore and sketch edits. Its checked report is
[`engine-evidence.json`](../examples/editable-interchange/engine-evidence.json).
Run `pnpm smoke:engine-interchange:browser` afterward for full-engine rendering,
Fit, orbit and selection. Avoid concurrent large geometry runs when collecting
performance evidence.

The shared renderer uses WebGL2 when available. Chromium smoke explicitly uses
SwiftShader software WebGL to make this path available in headless environments;
these timings are not hardware-GPU benchmarks. `expectGpu` checks definitions
and placed instance counts. Orbit checks that mesh buffers are reused and records
requestAnimationFrame intervals. `submitMs` measures CPU draw submission only;
it is not frame rate. Screenshots still require visual inspection.

2026-09-13: the isolated full engine passed all 18 headless stages. Cold STEP
import took 49.75 s and exact readiness another 0.48 s. STEP export took 11.36 s;
reimport took 48.24 s plus 0.50 s readiness. All 246 part occurrences and 266
solids survive; making one bushing independent changes 51 unique definitions
to 52. The small browser import/edit/history/native-reopen journey and invalid
file break passed in 10.3 s. The command-engine gate passed in 2.2 s; the
two existing assembly regressions passed in 5.6 s and 6.2 s. The 10-second
cold engine target remains unmet.

The full-engine Chromium Use journey passed in 72.4 s, with 59.6 s for import
through readiness. It rendered 51 shared mesh definitions as 246 occurrences
(461,173 placed triangles), passed Fit/orbit/component selection, and reported
the invalid-file failure without freezing. The 18-step native orbit produced
54 requestAnimationFrame samples with median 16.7 ms and p95 116.6 ms intervals;
mesh uploads stayed at 52. These are software-WebGL measurements, with visible
frame-time spikes; they do not establish sustained 60-fps hardware rendering.
Isometric, orbit, front, and selection screenshots were inspected. The compact
[`browser-evidence.json`](../examples/editable-interchange/browser-evidence.json)
records the command, fixture identity, checks, and timing limits.

Final review added focused regression checks for checkpoint-ID reuse after Undo
and native Save/Open/Redo when the imported geometry exists only in redo history.
The importer, exact metadata, and display paths also prove strict evidence-cache
reuse without repeated topology/property extraction, rejecting forged evidence.
The final small UI journey passed in 9.8 s. Live reload and source watching are
disabled in the smoke server, preventing concurrent file edits from resetting
a running journey. No scenario retries are used.
