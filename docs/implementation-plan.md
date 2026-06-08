# Implementation Plan

This document is the current implementation source of truth. It translates the
long-term architecture in `docs/architecture.md` into the repo state and the
active implementation roadmap.

Last updated: 2026-06-08.

Use this document for day-to-day implementation decisions. Use
`docs/architecture.md` for long-term design, `docs/archive/v4.md` for the
archived V4 constrained sketch solving milestone, `docs/archive/v5.md` for the
archived V5 exact geometry/topology foundation milestone, `docs/v6.md` for the
completed V6 practical solid-modeling baseline, `docs/v7.md` for the active V7
major-release draft, `docs/native-format.md` for project-format direction, and
`docs/occt-wasm-size.md` for OCCT/WASM load-size findings.

## Active Rules

These constraints remain active:

1. CADOps is the center of the system.
2. Human UI, scripts, tests, and MCP/agent adapters use the same command layer.
3. `cad-core` owns authoritative document state.
4. Rendered primitives, meshes, topology snapshots, exact metadata, thumbnails,
   and storage caches are derived views or caches unless a scoped tranche
   explicitly adds new source-of-truth data.
5. React UI does not import geometry internals directly.
6. Geometry, renderer, command engine, protocol, storage, and MCP boundaries stay
   separate.
7. MCP wraps CADOps. MCP does not define the internal API.
8. OCCT/WASM, WebGPU, OPFS, STEP, exact topology, assemblies, and hosted
   collaboration are expanded only in scoped tranches.
9. V2, V3, V4, V5, and V6 are complete. V7 is an active major-release planning
   effort, not one narrow implementation milestone.
10. V7 implementation tranches should stay independently testable and should not
    mix unrelated storage, renderer, topology, import/export, or agent-safety
    risks without explicit approval.

## Current Repo State

Partbench is implemented as a TypeScript pnpm workspace with a Vite React app
and focused packages:

- `apps/web` - browser UI, command worker, geometry worker entrypoint,
  derived-geometry orchestration, project panel, batch panel, current canvas
  viewport, first feature tree, improved modeling workflow, and focused UI
  helpers.
- `packages/cad-protocol` - typed CADOps command, batch, query, actor metadata,
  and validation error shapes.
- `packages/cad-core` - authoritative in-memory document model, transactions,
  semantic diffs, undo/redo, queries, measurements/extents, source-of-truth
  sketches, document parameters, driving sketch dimensions, horizontal/vertical
  line constraints, fixed/coincident/midpoint point constraints, parallel and
  perpendicular line constraints, authored rectangle/circle extrude features,
  narrow rectangle-tool add/cut boolean source data, authored revolve, hole,
  chamfer, and fillet source intent, named references, and versioned project
  JSON import/export.
- `packages/renderer` - renderer-facing primitive and mesh types plus the
  current canvas viewport.
- `packages/renderer-mesh-bridge` - adapter from serializable geometry-worker
  mesh data into renderer mesh data.
- `packages/occt-wasm` - isolated OCCT/WASM loading and tessellation boundary.
- `packages/geometry-kernel` - typed primitive, extrude, narrow boolean,
  exact-metadata, revolve, hole, and edge-finish geometry facade around the
  isolated OCCT path.
- `packages/geometry-worker` - async geometry worker request/response boundary.
- `packages/agent-adapter` - structured adapter over CADOps batch/query APIs.
- `packages/mcp-adapter` - MCP tool wrapper over the structured adapter.
- `packages/mcp-stdio-server` - minimal stdio JSON-RPC MCP transport.
- `scripts/smoke-occt-browser.mjs` and `scripts/occt-smoke` - non-gating
  browser smoke/metrics runner for the OCCT worker path.

Compatibility identifiers retained during the Partbench rename:

- `@web-cad/*` workspace package names remain stable to avoid broad import and
  lockfile churn.
- `web-cad.project.v1` through `web-cad.project.v16` remain project-format schema
  identifiers. Renaming them would be a storage migration.
- `web-cad.project.v7` is an older saved-project schema version, not the V7
  release. If the V7 release adds new source-of-truth data, the next saved
  schema should be `web-cad.project.v17`.
- `web-cad.agent-adapter.v1` remains the adapter protocol identifier.

## Current Scripts

Common development:

```sh
pnpm dev
pnpm test
pnpm typecheck
pnpm build
pnpm lint
pnpm format:check
pnpm smoke:feature-delete-ui
```

Derived geometry is enabled by default for local Vite serve:

```sh
pnpm dev
```

Use primitive fallback mode when debugging rendering or geometry-worker issues:

```sh
VITE_DISABLE_DERIVED_GEOMETRY=true pnpm dev
```

Production builds keep derived geometry disabled unless explicitly enabled:

```sh
VITE_ENABLE_DERIVED_GEOMETRY=true pnpm build
```

OCCT browser smoke/metrics:

```sh
pnpm smoke:occt-browser
```

The smoke writes JSONL telemetry to `.metrics/occt-browser.jsonl`. Timing
magnitude is tracked, not used as a pass/fail budget.

## Current Capabilities

Current Partbench can:

- create and edit V1 primitive scene objects;
- create sketches on base planes or eligible generated planar faces;
- add/edit/delete point, line, rectangle, and circle sketch entities;
- create and edit source-of-truth document parameters through CADOps;
- create and edit driving sketch dimensions for rectangle width, rectangle
  height, circle radius, and line length through CADOps;
- create, rename, and delete source-of-truth horizontal/vertical line
  orientation constraints, fixed/coincident/midpoint point constraints, and
  parallel/perpendicular line constraints through CADOps;
- create rectangle/circle extrude features as new bodies;
- edit authored extrude depth and side;
- edit source rectangle/circle profile values through `sketch.updateEntity`;
- delete authored sketch-extrude features;
- create supported authored `feature.revolve`, `feature.hole`,
  `feature.chamfer`, and `feature.fillet` source records;
- name generated references and resolve names later;
- inspect parts, sketches, features, bodies, named references, dependency
  health, history, measurements, extents, topology, exact-metadata health, and
  generated-reference measurements;
- query V7 selection/reference candidates through
  `selection.referenceCandidates` for semantic body, generated-reference, and
  named-reference selections, with structured missing, stale, unsupported,
  ambiguous, consumed, and non-commandable diagnostics;
- surface V7 selection/reference candidate state in the feature tree,
  inspector, and modeling workflow, including command-ready summaries,
  supported command operations, and structured diagnostics for blocked
  reference-consuming affordances;
- surface the same V7 selection/reference candidate state in a unified viewport
  interaction surface for selected bodies, generated references, and named
  references after they resolve to generated references, while keeping viewport
  highlighting derived from source/query state;
- route current canvas body/object clicks through a typed viewport pick-intent
  helper so body-backed renderables consume `selection.referenceCandidates`
  status and diagnostics instead of treating renderer IDs as command authority;
- show grouped and capped viewport generated-reference actions for the selected
  supported body, derived from `selection.referenceCandidates` candidate
  references, operation labels, commandability, and structured diagnostics;
- show transient subordinate viewport hover status for current canvas
  body/object render IDs by resolving them to the same semantic
  body/reference-candidate query summaries used by viewport pick intent, while
  reporting sketch/unknown targets as structured unsupported or missing hover
  diagnostics and suppressing duplicate selected-target hover after clicks;
- attach compact measurement/inspection rows to the selected semantic body or
  generated-reference summary using existing `body.measurements` and
  `body.generatedReferenceMeasurements` query results already surfaced by the
  inspector;
- keep a lightweight deterministic V7 viewport baseline helper/check for a
  rectangle extrude body with generated references and derived geometry status,
  without exposing raw mesh, OCCT, cache, or selection-buffer identifiers;
- perform narrow rectangle-tool add/cut boolean workflows for supported target
  bodies;
- rebuild supported revolve, hole, and rectangle-edge chamfer/fillet result
  bodies through derived geometry meshes while keeping cad-core authoritative;
- query selected body topology status through `body.topology`;
- inspect semantic-source topology counts and source-analytic measurement
  confidence for rectangle/circle newBody extrudes;
- inspect structured ambiguous topology status for current boolean and V6 result
  bodies where stable generated topology cannot be proven yet;
- use matching ready derived exact metadata snapshots for body topology, project
  extents, and project health measurement confidence for supported V6 result
  bodies;
- use compact UI workflows and a first feature-tree/product workflow for
  supported Extrude, Revolve, Hole, Chamfer, and Fillet operations without
  offering known-unsupported targets as valid;
- save/load current `web-cad.project.v16` JSON with migrations from older
  accepted schemas, while the Project panel shows draft source, schema/
  migration status, structured validation issues, replacement/history impact,
  same-current-export detection before import, and app-layer save/open
  capability status for the active JSON fallback versus deferred native storage;
- expose current commands and queries through agent/MCP wrappers over CADOps.

## Current Limitations

The repo is a completed V6 practical solid-modeling baseline entering active V7
release planning. It is not yet a full CAD system.

Current limitations:

- There is no general sketch solver. Current constraints are limited to
  horizontal/vertical line orientation, fixed/coincident/midpoint point
  relationships, and parallel/perpendicular line relationships.
- Sketch dimensions currently drive only rectangle width/height, circle radius,
  and line length through a direct evaluator path.
- There is no parameter expression language.
- There is no broad feature graph beyond current authored extrudes, scoped
  booleans, revolve, hole, and rectangle-edge chamfer/fillet workflows.
- Generated references and healthy semantic topology exist for simple authored
  rectangle/circle newBody extrude bodies, but boolean result bodies expose
  structured ambiguous topology instead of generated topology/reference sets.
  V6 revolve, hole, chamfer, and fillet result bodies also keep generated
  references unsupported unless a future stable topological naming design is
  explicitly implemented.
- Feature tree, inspector, modeling workflow, and viewport status integration
  consume semantic selections that the UI already exposes. The current viewport
  supports body/object-granularity pick intent for current canvas renderables
  and query-derived generated-reference selection only through explicit
  viewport-adjacent candidate actions. Exact face/edge/vertex picking, exact
  reference highlighting, and selection-buffer mapping are not implemented yet.
- The C4 viewport interaction surface consolidates selected status,
  reference-action groups, subordinate hover, and selected-target measurements
  into one compact CAD interaction model. Exact face/edge/vertex picking and
  exact reference highlighting remain future work.
- There is no authoritative B-rep topology persisted in the document model.
- `body.measurements` remains source-derived/source-analytic for simple
  supported shapes and references. V6 exact mass-property health is surfaced
  through derived exact metadata snapshots on `body.topology`, `project.extents`,
  and `project.health`, not through persisted source data.
- Circle target edge finishing, broad exact topology naming, shell, sweep, loft,
  patterns, direct edits, general booleans, STEP import/export, OPFS-backed
  storage, File System Access open/save flows, WebGPU, assemblies, hosted
  collaboration, production MCP auth, and natural-language command entry remain
  unimplemented unless scoped into V7. The web app may report File System
  Access API availability, but it does not call picker APIs or request
  file-handle permissions in D2.
- OCCT currently uses the full OpenCascade.js WASM in the main path. Custom
  build findings are documented separately and should not block V7 modeling,
  topology, storage, or export planning.

## Completed Milestones

The older milestone logs are intentionally condensed here. Do not recreate long
phase logs in this implementation plan.

### Initial Foundation And V1

The initial foundation established the pnpm workspace, Vite app, Vitest/lint/
format checks, typed CADOps mutation protocol, in-memory document model,
transactions, semantic diffs, undo/redo, browser command worker, canvas
viewport, primitive scene objects, project JSON import/export, and agent/MCP
wrappers.

V1 completed the primitive-scene workflow: box, cylinder, sphere, cone, and
torus creation/editing; transform, dimension, rename, delete, units,
measurements, history, batch operations, project save/load, viewport
fit/reset/selection, OCCT-derived primitive meshes behind the worker path, and
production-facing UI polish.

### V2 Feature/Body Foundation

V2 moved Partbench from primitives toward authored feature/body CAD while keeping
V1 compatibility. It added source-of-truth sketches, rectangle/circle extrudes,
authored body records, feature delete/edit behavior, sketches attached to
generated planar faces, generated and named references, source-derived
measurements/extents, dependency health, and narrow rectangle-tool add/cut
boolean workflows. V2 also kept derived geometry behind the geometry-worker
boundary, added UI support for the new model concepts, exposed the behavior
through agent/MCP wrappers, and evolved project JSON through
`web-cad.project.v6`.

### V3 Parametric Sketch Foundation

V3 added source-of-truth document parameters, driving sketch dimensions,
horizontal/vertical line orientation constraints, the first direct
solver/evaluator structure, downstream rebuild propagation, dependency health,
UI support, and agent/MCP pass-through. It introduced `web-cad.project.v7` for
parameters and sketch dimensions and `web-cad.project.v8` for line orientation
constraint source data.

### V4 Constrained Sketch Solving

V4 is archived in `docs/archive/v4.md`. It completed the constrained sketch
solving milestone by adding a clearer solver/evaluator boundary, durable sketch
point/entity targets, fixed/coincident/midpoint point constraints, parallel and
perpendicular line constraints, solver-backed dimensions/orientation behavior,
regeneration/health hardening, UI support, and agent/MCP wrappers. V4 evolved
project JSON through `web-cad.project.v13`.

### V5 Exact Geometry And Topology Foundation

V5 is archived in `docs/archive/v5.md`. It completed the derived exact
geometry/topology foundation for supported authored bodies. It added the
read-only `body.topology` query, structured topology statuses, source identity
and cache-key rules, exact/measurement confidence semantics, source-analytic
simple extrude topology, honest ambiguous topology for current boolean results,
project health/extents integration, UI status display, and agent/MCP
pass-through. V5 did not add new source data and therefore did not introduce a
new saved-project schema.

### V6 Practical Solid Modeling On Exact Geometry

V6 is complete and remains the immediate implementation baseline. Its detailed
scope and completion notes live in `docs/v6.md`.

V6 added practical solid-modeling capability: derived exact-kernel metadata,
authored `feature.revolve`, circular `feature.hole`, command-first
`feature.chamfer` and `feature.fillet`, target-consuming result-body behavior,
derived mesh paths through OCCT for supported V6 result bodies, project
structure/health/topology/extents integration, compact UI workflows, and
agent/MCP pass-through.

Durable V6 decisions:

- new persisted feature records introduced explicit schemas:
  `web-cad.project.v14` for revolve, `web-cad.project.v15` for hole, and
  `web-cad.project.v16` for chamfer/fillet;
- exact-kernel metadata remains derived and should not be persisted as source;
- target-consuming features create result bodies rather than mutating body
  identity in place;
- generated references for V6 result bodies remain unsupported unless a future
  stable topological naming design is explicitly implemented.

## Active Roadmap: V7 Real CAD Alpha

V7 is a major release umbrella, not a single implementation milestone. The
release should turn the V6 modeling baseline into an early usable local CAD
product while preserving the architecture in `docs/architecture.md`.

The V7 release draft lives in `docs/v7.md`. This implementation plan adds the
day-to-day sequencing rules.

### V7 Release Pillars

V7 should be planned around these pillars:

- stable topology, references, and semantic selection;
- production-grade viewport interaction and visual state;
- local project workflow for open/save/save-as and future native package work;
- interop, likely starting with export before broad import;
- product UI hardening on top of the existing feature tree and improved modeling
  workflow;
- agent/MCP productization for larger, auditable workflows;
- release samples, smoke checks, docs, and browser verification.

### Recommended Tranche Order

The recommended starting sequence is:

1. **Reference And Selection Contract** - typed query/protocol support for
   semantic selection candidates, reference eligibility, stale/ambiguous
   diagnostics, and named-reference validation. This should not require WebGPU,
   native storage, or STEP.
2. **Feature Tree And Inspector Integration** - connect the current feature tree
   and modeling workflow to reference and health semantics, with CADOps-backed
   actions only.
3. **Viewport Selection And Visual State** - map viewport interaction to the
   same semantic references and expose active/consumed/pending/failed/selected
   states without making renderer IDs authoritative.
4. **Local Project Workflow** - harden JSON open/save first, then decide whether
   File System Access, OPFS, thumbnails, or `.wcad` package work belongs in V7.
5. **Export And Sharing** - add STEP export for supported exact bodies if scoped
   and if the OCCT exchange boundary is ready; defer broad import unless V7
   explicitly prioritizes interop.
6. **Agent/MCP Release Surface** - shape project summary, dry-run previews,
   audit metadata, and examples around the same reference/tree/health model.
7. **Release Samples And Smokes** - add representative sample projects, smoke
   scripts, manual browser checklist entries, and capability/limitation docs.

### Implemented Tranche A: Reference And Selection Contract

The first V7 tranche added a query-only semantic resolver:

- `selection.referenceCandidates` accepts semantic selections only:
  `{ type: "body", bodyId }`,
  `{ type: "generatedReference", bodyId, stableId, expectedKind? }`, or
  `{ type: "namedReference", name }`;
- supported authored rectangle/circle `newBody` extrude selections return
  command-ready generated-reference targets, command operation eligibility, and
  labels/descriptions derived from source document state;
- stale, ambiguous, missing, unsupported, consumed, kind-mismatched, and
  non-commandable cases return structured diagnostics rather than vague strings
  or renderer-derived IDs;
- agent and MCP wrappers pass the same query result through CADOps/query paths;
- UI helpers consume the query response for current feature-tree/modeling
  workflow integration without owning model authority;
- the query is derived and does not introduce `web-cad.project.v17`.

### Implemented Tranche B: Feature Tree And Inspector Integration

The second V7 tranche connects the upgraded feature tree, inspector, and
modeling workflow to the selection/reference contract:

- the app queries `selection.referenceCandidates` for selected semantic body
  rows, generated-reference rows, selected generated references, and named
  references already exposed by the UI;
- the feature tree and named-reference list display command-ready or diagnostic
  candidate state without exposing renderer, mesh, OCCT, or selection-buffer
  IDs as stable public IDs;
- the inspector displays a reference-contract summary and structured
  diagnostics for selected bodies/generated references and named references;
- modeling actions combine existing command-builder validation with
  query-derived commandability for sketch-on-face, generated-reference naming,
  chamfer, and fillet affordances;
- all authority remains in `cad-core`/CADOps. React formats and routes query
  results only;
- the integration is derived/query-only and does not introduce
  `web-cad.project.v17`, persisted selection state, viewport picking, WebGPU,
  STEP, OPFS, `.wcad`, assemblies, or new modeling commands.

### Implemented Tranche C1: Viewport Semantic Selection Readiness

The first viewport-readiness slice connects viewport-adjacent selection status
to the same semantic contract without adding viewport picking:

- the app derives a typed viewport selection display from selected semantic body
  and generated-reference state plus the current `selection.referenceCandidates`
  response;
- named references participate after the existing UI resolves them to generated
  references;
- the viewport status overlay shows command-ready summaries, supported
  operations, structured diagnostics, consumed-body state, and derived geometry
  ready/pending/failed/fallback state;
- current viewport highlighting remains source body/object ID based. Renderer,
  mesh, OCCT, and future selection-buffer identifiers are not promoted to public
  stable IDs;
- this slice does not add viewport picking, persistent selection state, new
  modeling commands, storage migration, WebGPU, or `web-cad.project.v17`.

### Implemented Tranche C2: Viewport Pick Intent And Reference Selection

The second viewport slice adds narrow current-canvas pick intent while keeping
the renderer derived:

- `apps/web` resolves `pickRenderScene` body/object IDs through a typed helper
  against current project structure and scene objects. Authored body renderables
  select the same semantic body IDs used by the feature tree and inspector.
- primitive object clicks keep the existing object-editing selection while the
  viewport status can still consume the object-backed primitive body candidate
  response and show its structured unsupported-reference diagnostic;
- unsupported sketch-display and stale/unknown render targets become structured
  viewport pick diagnostics. They are not promoted to generated-reference
  selections;
- the viewport body-click path reads `selection.referenceCandidates` and uses
  the query response for resolved, missing, stale, unsupported, ambiguous,
  consumed, and non-commandable status where CADOps can prove it;
- the viewport overlays a compact generated-reference action list for the
  selected supported body. Actions are built from
  `selection.referenceCandidates` candidate references and operation labels,
  can explicitly select a generated reference into the existing UI selection
  state, and show commandability plus the first structured diagnostic for
  blocked candidates;
- renderer, mesh, OCCT, and future selection-buffer IDs remain derived internal
  details. The new helpers do not expose raw renderer/mesh/OCCT/selection-buffer
  IDs as visible UI or stable public IDs;
- this slice remains query-only/derived and does not add exact face/edge/vertex
  picking, persistent selection state, new modeling commands, storage
  migration, WebGPU, or `web-cad.project.v17`.

### Implemented Tranche C3: Viewport Hover And Measurement Overlay

The third viewport slice makes current canvas interaction more inspectable
without broadening renderer authority:

- `apps/web` resolves transient hover render IDs through a typed app-layer
  hover helper that mirrors viewport pick semantics for body/object targets and
  emits structured unsupported or missing diagnostics for sketch/unknown targets;
- hover display shows body/object titles, commandability summaries, supported
  operation labels, and first structured diagnostics from
  `selection.referenceCandidates`, but does not mutate selection or select
  generated references;
- the viewport renders a compact selected-target measurement overlay sourced
  from existing `body.measurements` and
  `body.generatedReferenceMeasurements` query results, including structured
  unsupported, missing, or stale measurement text where those queries report it;
- a small deterministic viewport baseline helper/check covers a rectangle
  extrude body with generated references and ready derived geometry status while
  excluding raw mesh, OCCT, cache, and selection-buffer IDs from visible helper
  output;
- this slice remains query-only/derived. It does not add exact face/edge/vertex
  picking, persistent hover/selection state, new modeling commands, storage
  migration, WebGPU, or `web-cad.project.v17`.

### Implemented Tranche C4: Viewport Interaction Cohesion

The fourth viewport slice consolidates the C1-C3 viewport surfaces into one
compact CAD interaction model without changing modeling, renderer, storage, or
topology authority:

- `apps/web` composes selected status, grouped reference actions, attached
  measurements, subordinate hover, and structured diagnostics through a typed
  app-layer viewport interaction surface helper;
- selected body/generated-reference status remains primary. Hover is transient,
  subordinate, and suppressed when it would duplicate the selected render target
  after a click;
- generated-reference actions are prioritized and capped in compact kind groups
  so supported faces/edges stay reachable without visually swamping the
  viewport. Overflow remains discoverable through the inspector and existing
  generated-reference panels;
- body and generated-reference measurements remain sourced from existing CADOps
  queries and render as rows attached to the selected summary rather than as a
  separate floating overlay;
- unsupported, missing, stale, consumed, and non-commandable states keep
  structured diagnostic code/status metadata in the viewport surface while raw
  mesh, OCCT, cache, and future selection-buffer identifiers stay out of visible
  text;
- this slice remains query-only/derived. It does not add exact face/edge/vertex
  picking, persistent hover/selection state, new modeling commands, storage
  migration, WebGPU, or `web-cad.project.v17`.

Future V7 tranche plans should continue to include these details:

- exact CADOps/query shapes and response examples;
- supported body/reference subset;
- stale, ambiguous, missing, consumed, unsupported, and kernel-failed issue
  shapes;
- package touch list across `cad-protocol`, `cad-core`, app UI helpers,
  adapter/MCP, geometry/worker if needed, and serialization if source data is
  introduced;
- feature tree, inspector, modeling panel, and viewport behavior;
- migration impact. Query-only and derived data should not introduce a saved
  project schema. New source-of-truth data should introduce
  `web-cad.project.v17` with explicit migrations;
- test matrix covering protocol validation, cad-core query behavior,
  named-reference resolution, upstream edit stability, adapter/MCP pass-through,
  UI helpers, and source/derived separation;
- manual browser scenarios for selecting, naming, invalidating, and repairing a
  supported face or edge.

The first tranche should not implement broad arbitrary topology naming. It
should prove the contract on the smallest useful, defensible subset and make all
unsupported cases explicit.

### V7 Scope Guardrails

Do not combine these in a single V7 tranche unless explicitly approved:

- WebGPU renderer replacement and topology/reference model changes;
- native package storage and STEP import/export;
- broad sketch solver expansion and general feature-graph expansion;
- assembly/LOD architecture and local project format migration;
- natural-language command parsing and production MCP auth.

Do not introduce another saved project format unless source-of-truth data
requires it. Query results, topology summaries, derived exact metadata,
selection state, storage capability/status state, thumbnails, mesh caches, and
renderer display state should stay rebuildable by default.

## Deferred Unless Explicitly Scoped Into V7

- Full arbitrary topological naming for every OCCT result shape.
- Full general sketch solving beyond the current V4 constrained-sketch scope.
- Complex constraints such as tangent, concentric, equal, symmetry, spline, and
  curvature constraints.
- Dragging solver UX.
- Arbitrary parameter expressions.
- General boolean trees beyond current add/cut plus scoped V6 hole behavior.
- Shell, patterns, lofts, sweeps, mirror, direct edits, and broad feature
  editing beyond scoped V6 revolve/hole/chamfer/fillet workflows.
- Persistent exact B-rep checkpoints as source truth.
- Broad STEP import with healing and assembly reconstruction.
- OPFS cache implementation and File System Access open/save unless scoped.
- Native `.wcad` package implementation unless scoped.
- Local launcher with cross-origin isolation headers unless scoped.
- WebGPU production renderer unless scoped.
- Assemblies, mates, large-model LOD, and instancing.
- Hosted collaboration.
- Production MCP auth/permission system.
- Natural-language command entry.

## Definition of Done

A future task is done only when:

1. The requested scope is implemented.
2. The implementation respects package boundaries.
3. All CAD mutations go through CADOps.
4. Source-of-truth state remains in `cad-core`.
5. Rendered meshes, exact metadata, topology snapshots, and renderer state remain
   derived unless the task explicitly adds source data.
6. Relevant unit tests or focused package-level checks are added.
7. Browser E2E tests are not added unless explicitly scoped.
8. `pnpm test` passes.
9. `pnpm typecheck` passes.
10. Relevant build/lint/format checks pass.
11. Documentation is updated when behavior, scripts, or architecture boundaries
    change.
