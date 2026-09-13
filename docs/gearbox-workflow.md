# Seamless gearbox workflow for agents

Status: complete, September 12, 2026. User goal, September 11. Baseline `94a2aefa`.

An agent can discover the exact commands it needs, create real parametric spur
gears and a connected gearbox with a small set of requests, change tooth count
and its dependent spacing/ratio coherently, and move the assembly without
rebuilding unchanged solids. Exact solid operations work consistently across
primitive, wire and region source profiles. Inspection is bounded and concise,
and health feedback distinguishes editable source warnings from unavailable
finished geometry. Native save/reopen, Undo/Redo and STEP preserve the workflow.

This goal implements the seven application pain points in the
[gearbox trial](gearbox-trial.md). It does not undertake load/force simulation,
manufacturing certification or redesign the trial's physical retention hardware.

## Authorized changes

- Dependency-correct geometry invalidation/caches and motion transactions in
  cad-core/cad-runtime/browser; preserve exact results when only poses change.
- Spatial pruning of detailed region validation, retaining complexity guards and
  exact validation; consistent boolean extrusion target support through OCCT.
- Native parametric spur-gear authoring via CADOps with bounded involute sampling,
  parameter bindings, deterministic regenerated profiles, atomic updates and
  persistence. New gear source metadata/commands may extend the existing project
  and WCAD formats compatibly; no version bump, dependency or package is needed.
- Complete discoverability of supported operations, field-level invalid-request
  diagnostics, and compact filtered structure/pose inspection. A dedicated
  `cad.operation_schema` discovery tool is allowed if needed to keep tools/list
  compact. All writes still use ordinary CADOps through the existing adapters.
- Truthful source-health and exact-result status; no hiding genuine unsupported
  source, under-definition or failed geometry.
- One documented gearbox example with coherent geometry/spacing/ratio parameters,
  and a small focused regression set plus named headless closer and existing
  Chromium engine/Use paths. No GitHub CI and no historical gauntlets.

## Completion evidence

Every trial pain point gets an explicit before/after result. Prove gear creation
and tooth-count revision, actual instance motion without exact reevaluation,
small pose responses, structured invalid input with unchanged source identity,
consistent bore/add paths, complex valid regions, native fresh reopen and STEP
readback. Browser evidence must include actual controls, Undo/Redo and a break
case with no lost gear display. Preserve historical trial evidence unchanged.

The [representative gearbox](../examples/gearbox-workflow/README.md) contains
eight finished definitions and 15 connected instances. Its source is 159 public
CADOps, including two gear commands. The ratio revision is one operation.

## Trial pain points and fixes

| Original pain point | Result and evidence |
| --- | --- |
| Slow motion and disappearing ready solids | Validation forks reuse already validated history. Exact artifacts retain their meshes when body/dependency identity and units match. On the original trial files, sequential warmed headless medians changed from 975 → 153 ms at 2:1 and 1,936 → 219 ms at 3:1. These are local observations, not latency guarantees. The new complete model also asserts zero exact builds across both angle sweeps. Browser evidence is recorded below. |
| Missing command contracts | `cad.operation_schema` lists all 94 supported operations and returns one complete nested schema on demand. Invalid structural requests identify the field/path; geometry and dependencies remain CADOps checks. Expression help distinguishes parameter names from IDs. |
| Detailed region with bore rejected by work limit | Spatial pruning visits relevant curve bounds before analytic intersection predicates. The original 620-edge 20T region plus bore uses 5,400 visits; the 1,740-edge 60T uses 14,610. The 100,000-visit and 4,096-entity limits remain unchanged. Valid regions succeed; pathological/invalid ones still reject. |
| Solid composition depends on how the source was drawn | Rectangle, circle, wire and region extrusions accept equivalent Add/Cut workflows, including supported result chains. Exact empty cuts/disjoint additions reject atomically. The example bolt starts from a circular region shank and adds a rectangular head. Focused tests verify kernel volumes and fresh native reopening. |
| External tooth generator and coordinated revision scripts | `feature.spurGear` and `feature.updateSpurGear` own parameter-bound ordinary sketch regions/extrusions. Changing output teeth 40 → 60 regenerates actual teeth, shifts shaft centers 45 → 60 mm, updates support geometry and changes the output ratio. Native bindings and source-linked joint frames propagate the change. |
| Huge inspection responses | A bounded pose projection avoids constructing definition/sketch data. The complete two-shaft MCP result is 2,300 bytes; the one-op revision summary is 8,832 bytes. `cad.batch` summary responses retain warnings, audit, change counts and bounded ID samples with explicit totals; full semantic diffs remain available. Compact generated gear topology IDs prevent quadratic repetition of outlines inside native history. |
| Unsupported health obscures valid solids | Generated gear sketches are recipe-defined and checked as a complete region. Editable supports have actual dimensions/constraints. Missing independent correspondence on consumed intermediate blanks no longer makes valid source geometry unsupported. Real source, solver and kernel failures remain visible. The complete model reports `healthy`, zero issues. |

The same-case motion measurement is retained in
[motion-profile.json](../examples/gearbox-workflow/motion-profile.json).
The headless baseline already reused its exact shapes; its measured speedup is
from avoiding history replay. Browser artifact retention is a separate fix and
requires actual display-continuity evidence.

## Failures caught during implementation

A fresh agent received a mechanical brief, the public usage guide and generic
stdio client, with no source, development conversation or prior trial findings.
In about 7½ minutes it built a separate 20/40 gearbox with support and shafts,
revised it to 20/60 with one operation, checked three poses and exported four
STEP definitions. Its unchanged [report](../examples/gearbox-workflow/independent-trial/observed-report.md)
records what failed at that point; it is not presented as a successful native
handoff.

That attempt exposed two additional defects. A revised native file failed
transaction replay because CBOR object-key ordering made the unchanged input
gear appear modified. Semantic recipe comparisons now ignore key order. Both
live and reopened generated entities use the same explicit field ordering where
legacy source signatures depend on it. Native replay validation remains strict;
the fix does not accept fabricated or inconsistent saved diffs.

Generated region references also repeated the complete wire in every face,
edge and vertex ID. A single revision returned 130.9 MB and produced a 65.36 MB
native file. Generated gears now hash the complete semantic loop key into a
bounded ID; existing editable-region identities are unchanged. The independent
requests now produce a revised file of about 1.42 MB and reopen correctly.
The CBOR writer also uses typed chunks rather than a JavaScript number array,
preserving canonical bytes while avoiding the array-allocation crash exposed
by repeated revisions.

The agent's unchanged requests are checked through three fresh real MCP
processes by [replay.mjs](../examples/gearbox-workflow/independent-trial/replay.mjs).
Regression tests additionally cover post-open motion without fake body changes,
revision/save/reopen, Undo/Redo, and reverse revision with real OCCT validation.
The trial also found missing expression-language help and a mass-tool description
that incorrectly promised bounds; public discovery now describes the actual
supported language and returned measurements.

Browser verification caught obsolete wire-target restrictions in the shared
display/metadata services and a false cycle during boolean source reconstruction.
Both are fixed; source and kernel validation remain in place. The cycle tests
still reject a real cycle and retain the original expected geometry profiles.

It also exposed synchronous UI work unrelated to modeling: Shell choices
queried every reference on every body even when the tool was closed. A 40T gear
has 2,886 generated references, and each query rebuilt the reference set.
Choices now query eligible reference kinds when the relevant editor needs them,
share authoritative results within the source revision, and measure only the
selected reference. Edit and Undo invalidate the cache. The browser seed's
Apply time fell from 107.4 s to 1.156 s; exact construction then completed
normally. A regression asserts zero modeling queries for correspondence-only
gear references rather than relying on a fragile timing threshold.

Native Open exposed a separate cross-runtime case: Node saved a generated tooth
coordinate as `-12.10752147353831`, while Chrome replayed it as
`-12.10752147353832`. Replay comparison now permits only tiny floating roundoff
in recipe-generated entities, with identical recipe and sketch metadata.
Authored sketch values remain strict. Import retains the saved coordinate bits
in the current document and matching generated profiles in history snapshots,
so motion Undo/Redo does not change shape identities. Tests cover unchanged
native identity, coordinate retention, rejection of larger generated drift and
rejection of even a tiny unrelated authored edit.

## Verification record

Local headless and engine checks passed on September 12, 2026:

- `pnpm smoke:gearbox`: 159-op creation, one-op revision, both six-angle sweeps
  with unchanged exact-build counters, all 15 poses, zero health issues,
  structured rejection with unchanged identity, fresh native reopening and
  reverse revision, independent gear-area/volume checks and eight-solid STEP
  readback. Complete result: [verification.json](../examples/gearbox-workflow/verification.json).
- `node examples/gearbox-workflow/independent-trial/replay.mjs`: the independent
  agent's unchanged operations pass through three fresh MCP processes.
  [After-fix result](../examples/gearbox-workflow/independent-trial/replay-verification.json).
- `node scripts/scenarios-run.mjs scenarios/gearbox-parametric-revision.json`:
  1/1, including native history round-trip and the declared pose projection.
- `pnpm smoke:ui -- scenarios/gearbox-parametric-revision.json`: 1/1 in 22.8 s.
  Creation was ready at 14.079 s; ratio revision was ready in 7.770 s and
  angle motion in 864 ms, with no geometry jobs during motion. All eight active
  exact/display results were ready. These are local observations with the
  existing Chrome runner, not a performance service-level promise.
- Focused regressions cover 87 core, 12 runtime, 58 web cache/pipeline/command,
  123 display/metadata, 118 MCP, 2 protocol and 31 solver tests; additional
  summary-transport and reference-query tests cover the bugs found in final use.
  Eight touched packages pass typecheck, including schema freshness.

- `pnpm smoke:gearbox:browser`: native Open, actual Output gear tree selection,
  restored assembly view, ratio edit, Undo/Redo, input-angle edit and an empty
  input that blocks Apply. Passed in 70.1 s. The motion monitor sampled 24 rendered
  frames with zero missing exact results or mesh identities. Success and break
  screenshots were visually inspected.
- `pnpm smoke:e2e`: both existing distance/history and concentric/cancel journeys
  plus their break cases passed. These fast tests remain separate from the
  fuller gearbox journey. No GitHub CI or historical gauntlet was run.

[Browser evidence and artifact hashes](../examples/gearbox-workflow/browser-verification.json)
record the logs and screenshots under `.metrics/`. The existing runner uses
monotonic deadlines, bounded evaluation/failure capture and actual declared
read-only queries. It has no scenario retries or raised timeout budgets.

## Generated geometry and sketch health

Native spur-gear sketches are defined by their gear recipe and parameter
bindings. They are edited through `feature.updateSpurGear` or bound parameters;
their generated entities are not independent numerical sketch variables.
`sketch.solverStatus` reports `solver.definitionMode: "generated-spur-gear"`,
`fully-defined` source and `ready` readiness after verifying the recipe against
the resolved values and complete entity set. The numerical solver remains
`not-run`, with `modelBuilt: false` and `solverRan: false`; this is recipe
validation, not a claim of numerical convergence.

`profileValidity.generatedProfiles` describes the complete gear region,
including its optional bore. Generated regions contribute to `profileCount`
and `validProfileCount`; `profiles` continues to describe direct entity
candidates. A valid gear produces one generated region instead of hundreds of
open-profile warnings for individual tooth edges.

Missing parameters, inconsistent stored dimensions, altered entities and extra
solver dimensions/constraints retain blocking diagnostics and cannot report a
ready generated profile. These checks also run for standalone solver callers;
metadata alone is not accepted as proof. Other editable sketches retain their
normal constraint and under-definition reporting.

Physical unit conversion scales generated gear lengths, assembly translations,
joint frame positions and literal joint distances/offsets. Known tooth-count
and angle parameters retain their values; dependent expressions are reevaluated.
Conversion checks that every bound gear dimension and known joint value still
represents the same physical design before committing. Ambiguous parameter roles
or expression chains return `INVALID_UNITS` with unchanged source and history,
instead of saving inconsistent gear metadata or silently changing the mechanism.
