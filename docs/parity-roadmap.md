# Fastest path to professional CAD parity

Updated 2026-10-12. This is the current user goal, replacing version-number gates.

A user can import a customer's drawing or mechanical assembly, make precise
changes, produce a dimensioned deliverable, and return usable files without
switching CAD applications. Humans and agents operate the same document and
geometry authority. The immediate delivery target is a dependable daily-use CAD
workflow; full AutoCAD and mechanical-CAD breadth remains a longer program.

## Completion authority and hill climbing

The [professional CAD feature matrix](cad-feature-matrix.md) is the feature
completion authority. Its [JSON source](cad-feature-matrix.json) holds stable
IDs, boolean completion, acceptance contracts, dependencies and dated E2E
references. There are no partial states. Existing implementation without the
whole required workflow and proof is **Not done**.

The initial inventory covers 339 contracts in 27 areas: drafting, annotation,
sheets, sketches, solids, direct editing, surfaces, meshes, assemblies, sheet
metal, tooling, routing/electrical, inspection, exchange, rendering, automation,
collaboration/PDM, CAM, additive, CAE, BIM, civil and platform/performance needs.
It includes specialist workflows even when they are later priorities. It is an
extensible union of professional product capabilities, not a claim that every
product edition contains every row or that the list can never grow.

Use `pnpm cad:matrix --next` to select the next contract. Fix regressions first,
then follow the dependency-aware frontier toward complete customer deliverables.
Prefer changes that remove a bottleneck or unlock several contracts. Row counts
are an inventory, not a percentage of parity: a missing DWG or drawing workflow
can outweigh dozens of small completed features. The matrix's full completion
criteria govern its rows; the estimates below do not override them.

A slice ends with a real browser/public MCP success, the applicable rejection
and persistence/history checks, a dated result, and the binary status update.
Extend existing E2E journeys; do not create one independent test per matrix row.
Run `pnpm cad:matrix` after editing the JSON and `pnpm verify` before landing.
A recorded regression returns a row to Not done. Never lower a performance
budget, split a completed row or remove an unmet requirement to improve counts.

## What exists, and what parity means

AutoCAD emphasizes general 2D drafting, annotation, layouts and DWG exchange.
Fusion, SolidWorks and Onshape emphasize parametric parts, assemblies and
manufacturing workflows. Partbench already has much more of the latter's core
than the former's drawing-production surface. Treat these as two explicit
acceptance tracks rather than calling additional 3D primitives AutoCAD parity.

Repository baseline: `185c614`. Evidence is existing implementation and recorded
runs, not a new competitor benchmark or a claim that every feature is production
ready. The architecture is CADOps → cad-core / OCCT → derived display; preserve it.

| Area                   | Existing foundation                                                                                                                                         | Gap to professional daily use                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parts                  | Parametric sketches, dimensions/constraints, extrude/revolve, sweep/loft, hole, fillet/chamfer, shell, booleans, patterns, datums, draft/offset, spur gears | Broader real-part robustness, reference survival after edits, sketch ergonomics and solver diagnostics, difficult surface operations                     |
| Assemblies             | Nested definitions/occurrences, independent copies, fixed/coincident/concentric/distance/revolute mates, parameter-driven robot/gear motion                 | Large-assembly interaction, broader constraint behavior, interference/clearance tools, BOM and drawings                                                  |
| Exchange               | Editable STEP assemblies, WCAD history, bounded DXF/SVG analytic sketch curves                                                                              | DWG is absent; DXF is a curve subset, not full drafting-document fidelity; drawings, text/styles, blocks, hatches and references need explicit semantics |
| Document / agents      | Transactions, semantic diffs, Undo/Redo, native save/open, recovery implementation, shared headless runtime and public MCP                                  | Extend complete workflows, including recovery, file fidelity and long-operation cancellation; do not build another agent geometry engine                 |
| Viewport / performance | WebGL2 shared meshes and instancing, exact picking, measurement and section tools                                                                           | Import latency, frame spikes, memory bounds, representative hardware measurements                                                                        |
| Production drawings    | Sketch dimension annotations and inspection                                                                                                                 | No established sheet/layout production system with associative views, dimension styles, title blocks, scale-correct PDF/plot or DWG round trip           |

The measured 13.4 MB engine has 246 occurrences / 266 solids. The recorded
headless cold import is 49.75 s; browser import through readiness is 59.6 s.
Browser orbit p95 is 116.6 ms under software WebGL, not hardware GPU proof.
Native headless open + exact evaluation is about 2.79 s; typical recorded edits
are about 0.5–0.6 s. These are September baselines from
[editable interchange](editable-interchange.md), not measurements of this cleanup.

## Sequence and exit criteria

The week ranges below are planning estimates for a small experienced CAD team
(roughly four engineers), not commitments or a full-parity forecast. They assume
access to representative customer files and suitable exchange-library licensing.
One developer should keep the order and re-estimate elapsed time. Workstreams may
overlap only where their document contracts are settled.

| Priority / window                  | Deliverable and implementation focus                                                                                                                                                                                                                                                                                                                                                                    | Exit evidence                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — first 2 days                   | Establish a compact parity corpus: one dimensioned mechanical drawing, one architectural/general drafting sheet, one authored part/assembly and the existing engine. Record task completion, fidelity, latency, memory and unsupported entities. Choose supported drawing entities and file versions explicitly. Investigate DWG libraries immediately.                                                 | A checked-in capability matrix with expected deliverables and measured baselines; no silent loss on import/export. This is the scope of the first useful parity claim.                                                                                                                                                                                     |
| 1 — weeks 1–3                      | Make existing CAD dependable and responsive. Profile STEP read/transfer/heal/metadata/mesh separately; reuse shared definitions, defer detailed topology, make long operations cancellable, bound caches, show staged readiness. Fix reference/history/recovery defects exposed by complete workflows.                                                                                                  | Existing engine: usable cold view ≤10 s, selection ≤20 s, cached reopen ≤2 s, typical single-part edit ≤1 s on a declared reference machine. Hardware orbit p95 ≤20 ms with no unnecessary mesh uploads. Explicitly report misses; do not satisfy a usable-view target with a blank/loading screen. Cancel and failed imports preserve the prior document. |
| 2 — weeks 2–6                      | Build a coherent precision-drafting workspace on CADOps: object snaps/tracking, coordinate entry/UCS, selection/window/crossing and grips, trim/extend/offset, polylines/arcs/splines, layers and styles, reusable blocks, text, associative dimensions and hatches. Reuse existing sketch/curve machinery where semantics match; general drafting must not inherit inappropriate sketch-solver limits. | Complete and revise both corpus drawings through actual controls; measured lengths/angles and units match expected values, repeated objects remain editable, Undo/Redo and native reopen preserve the drawing. Keyboard operation is practical without routing routine work through panels.                                                                |
| 3 — weeks 4–9                      | Turn geometry into deliverables: sheet/paper space, scaled viewports, title blocks, lineweights/linetypes, dimension/text styles, PDF/print, associative orthographic/section/detail views for parts. Extend DXF document exchange; integrate an established DWG reader/writer if viable.                                                                                                               | Open an external drawing, edit it, save/reopen in Partbench and the reference CAD tool; independently compare supported geometry, text, dimensions, styles and units. Plot at known scale. Unsupported data gets a clear report and defined preservation/rejection behavior. Revisions update dependent views/dimensions.                                  |
| 4 — weeks 7–12                     | Close mechanical production workflows: robust sketch feedback and topology repair, difficult fillets/shells/lofts from the corpus, assembly placement/mates, interference/clearance, BOM/balloons and assembly drawings. Prioritize failures blocking real parts over adding feature names.                                                                                                             | Author and revise a representative enclosure/bracket and the existing robot/gearbox, check exact volume and clearances, reopen, export STEP plus a dimensioned drawing/BOM, and validate results outside Partbench. Human and MCP paths agree on the resulting document.                                                                                   |
| 5 — after first production release | Expand breadth from measured demand: xrefs and large drawing sets, advanced block behavior, sheet metal, surfacing, standards libraries, collaboration/versioning, automation compatibility and deployment needs. CAM/CAE/BIM and specialized vertical toolsets are separate scope decisions.                                                                                                           | Each addition unlocks a customer workflow that cannot be completed in the shipped scope. Full parity requires a published capability/compatibility matrix across the chosen competitors, not simply the completion of weeks 1–12.                                                                                                                          |

Critical path: drawing/document semantics → editing UX → layouts/annotation →
exchange fidelity → external-tool validation. Performance work and DWG feasibility
start immediately alongside that path. A credible first production subset could
fit the estimated 8–12 week window; broad AutoCAD plus modern mechanical-CAD
parity cannot responsibly be promised on that schedule from this evidence.

## Buy or reuse where it saves the most time

- Keep OCCT/WASM, cad-runtime, CADOps, native storage and the existing renderer.
  Profile the bottleneck before replacing a subsystem. Do not start with a
  WebGPU rewrite, a new kernel, or another UI framework.
- Evaluate established DWG SDKs (for example ODA Drawings SDK or Autodesk
  RealDWG) for license/distribution terms, supported versions, browser/WASM vs
  service deployment, offline/privacy needs and round-trip fidelity. These are
  candidates, not verified available dependencies. Decide in the first week;
  if browser use is infeasible, choose an explicit conversion-service product
  boundary or report a DXF-only limitation. A DXF bridge is not DWG parity.
- Use existing OCCT geometry/projection capabilities behind the established
  facade; use mature PDF/font tooling where it meets deployment/licensing needs.
  A thin feasibility spike should precede each dependency choice.
- Every new modeling or drafting operation stays available through the shared
  command system. Agent-assisted repetitive modeling is an existing advantage;
  a second MCP-only implementation would slow parity.

This goal authorizes designing the drafting/drawing document extensions above.
The matrix also records later specialist work; catalog inclusion alone does not
authorize purchasing SDKs, adding services or implementing every vertical now.
Add a dependency, workspace package or native schema change only when a concrete
slice demonstrates the need, records its compatibility/migration decision, and
updates the format contract. Do not prebuild infrastructure for later phases.

## Development loop after deleting unit tests

`pnpm test` is the consolidated E2E suite: three browser journeys sharing one
startup and one public MCP journey. `pnpm verify` checks matrix integrity and
typechecks as well; lint the changed source files separately.
Never write or restore unit/component/isolated integration tests. Extend existing
journeys with geometry, persistence and rejection assertions; add a separate
journey only for a distinct user workflow, such as producing a drawing.

Keep the default suite small and target a sub-two-minute warm run on a declared
runner; this is a budget to measure, not a claimed result. Large-engine timing,
full robot/gearbox work and cross-tool file fidelity run only when those areas
change or before release. Do not replace every deleted unit case with an E2E
case, combine everything into one unlocalizable scenario, or hide failures with
retries. Record stage timings and the failing user step.

Deleting tests reduces maintenance and removes fast local regression diagnosis.
It does not itself prove higher delivery speed. Track median time from change
to verified workflow, E2E duration, failure diagnosis time and escaped defects.
Improve journey design and diagnostics within the E2E-only policy if those
metrics regress. Recovery and DXF/SVG completeness are explicit coverage gaps in
the initial small suite, not implied by a green run.

## Current implementation

[Import and editing performance](import-performance.md) records **PERF-001 and
PERF-003 Done**: the pinned engine is visibly orbitable in 4.11–8.77 s across five
consecutive isolated production runs. Real OCCT display geometry arrives in
batches before exact checkpoints finish. Import opens the viewport, explains
viewing versus editing readiness, preserves navigation through completion and
restores the prior model and camera on Cancel. Exact checkpoint bytes match the
native baselines; the full headless editing/round-trip journey passes.

The exact-import follow-up uses a shared native pipeline for viewing and editing,
with balanced worker batches, a smaller browser kernel and verified display/checkpoint
reuse. The best observed exact-selection run is 22.9 s, down from the earlier
69.62–89.23 s implementation. The two final integrated runs measured 31.2–31.8 s;
full timing and validation evidence is in [import performance](import-performance.md). Native checkpoint bytes and document
semantics are preserved. The user accepted this milestone on 2026-10-12 and asked
to stop speculative optimization.

## Next implementation slice

`PERF-002` remains **Not done**: its contract still requires every occurrence to
be selectable with exact identity within 20 s in each of five isolated production
runs. The accepted performance milestone does not change that contract. Resume
this work when another measured improvement warrants it. `PERF-012` still needs
the broader repeatable benchmark corpus and budgets in its own acceptance contract.

`DRAW-001` is now Done; its [independent drawing workspace](drawing-workspace.md)
was integrated alongside this import work. The next deliverable path is
`ORG-001` layers and `ANN-002` dimensions → `SHEET-001` layouts → `SHEET-004`
associative views and `SHEET-010` scale-correct PDF. Resolve `IO-005` DWG SDK
feasibility alongside this path; it stays Not done until a verified round trip exists.
Then prioritize `ASM-011` interference and `ASM-013` BOM over another primitive.
The matrix frontier encodes this order and exposes unmet prerequisites.

The original PERF-001 `occt-import-js@0.0.23` display worker remains the fallback
for unsupported native partition layouts. Supported large solid assemblies use
full-quality meshes from the exact OCCT pipeline. Both native runtimes retain
their LGPL-2.1 licenses and OCCT notices. No native format, document schema,
service or geometry-authority change is made.
