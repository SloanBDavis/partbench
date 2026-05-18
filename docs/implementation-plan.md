# Implementation Plan

This document is the current implementation source of truth. It translates the
long-term architecture in `docs/architecture.md` into the actual repo state and
the next implementation roadmap.

Last updated: 2026-05-17.

Use this document for day-to-day implementation decisions. Use
`docs/architecture.md` for the long-term design, `docs/v1.md` for the completed
V1 baseline, `docs/v2.md` for the next product target, `docs/native-format.md`
for project-format direction, and `docs/occt-wasm-size.md` for OCCT/WASM
load-size findings.

## Active Rules

These constraints remain active:

1. CADOps is the center of the system.
2. Human UI, scripts, tests, and MCP/agent adapters use the same command layer.
3. `cad-core` owns authoritative document state.
4. Rendered primitives and meshes are derived views or caches.
5. React UI does not import geometry internals directly.
6. Geometry, renderer, command engine, protocol, storage, and MCP boundaries stay
   separate.
7. MCP wraps CADOps. MCP does not define the internal API.
8. OCCT/WASM, WebGPU, OPFS, STEP, and real topology are introduced only in
   scoped milestones.
9. Do not keep expanding V1 with unrelated surface area. Future feature work
   should move toward the V2 target.

## Current Repo State

The repo is a TypeScript pnpm workspace with a Vite React app and focused
packages:

- `apps/web` - browser UI, command worker, geometry worker entrypoint,
  derived-geometry orchestration, project panel, batch panel, viewport, and
  smoke page.
- `packages/cad-protocol` - typed CADOps command, batch, query, actor metadata,
  and validation error shapes.
- `packages/cad-core` - authoritative in-memory document model, transactions,
  semantic diffs, undo/redo, queries, measurements/extents, derived
  part/feature/body structure summaries for the current scene primitives,
  source-of-truth sketches, authored rectangle/circle extrude features, and
  versioned project JSON import/export.
- `packages/renderer` - renderer-facing primitive and mesh types plus the
  current canvas viewport.
- `packages/renderer-mesh-bridge` - adapter from serializable geometry-worker
  mesh data into renderer mesh data.
- `packages/occt-wasm` - isolated OCCT/WASM primitive tessellation adapter.
- `packages/geometry-kernel` - typed primitive and sketch-extrude tessellation
  facade around the isolated OCCT path.
- `packages/geometry-worker` - async geometry worker request/response boundary
  for primitive and sketch-extrude tessellation.
- `packages/agent-adapter` - structured adapter over CADOps batch/query APIs.
- `packages/mcp-adapter` - MCP tool wrapper over the structured adapter.
- `packages/mcp-stdio-server` - minimal stdio JSON-RPC MCP transport.
- `scripts/smoke-occt-browser.mjs` and `scripts/occt-smoke` - non-gating
  browser smoke/metrics runner for the OCCT worker path.

## Completed Baseline

V1 is complete. The historical MVP doc has been removed because the relevant
baseline is now `docs/v1.md`.

Completed foundations:

- pnpm workspace, Vite app, shared TypeScript config, Vitest, lint, and format
  scripts.
- Typed CADOps mutation protocol.
- In-memory authoritative document model.
- Transactions, semantic diffs, undo, redo, actor metadata, and audit metadata.
- CADOps batch dry-run and commit.
- CADOps read/query path for project summary, object lookup, measurements,
  project extents, primitive feature summaries, and transaction history.
- Structured validation and import errors.
- Canvas viewport with orbit, pan, zoom, fit all, fit selected, reset view,
  selection, primitive fallback display, and mesh-backed display.
- Five supported primitive scene objects: box, cylinder, sphere, cone, and
  torus.
- Dimension, transform, rename, delete, unit metadata change, and
  preserve-physical-size unit conversion commands.
- Versioned source-of-truth JSON project import/export. V1 completed with
  `web-cad.project.v1`; sketches introduced `web-cad.project.v2`; authored
  sketch extrudes introduced `web-cad.project.v3`; V1 and V2 projects still
  import through migration.
- Browser command worker transport.
- Isolated OCCT/WASM adapter, geometry-kernel facade, browser geometry worker,
  derived geometry service, renderer mesh bridge, and OCCT browser smoke.
- Agent adapter, MCP adapter, and stdio MCP server over CADOps.
- V1 UI polish for object list, inspector, geometry status, measurements,
  history, batch operations, project import/export, and narrow viewport layout.

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

Feature deletion UI smoke:

```sh
pnpm smoke:feature-delete-ui
```

This builds the web app, serves the static bundle locally, drives a
Chromium-compatible browser through the authored sketch rectangle -> extrude ->
feature delete -> undo -> redo workflow, and fails only on functional workflow
breakage.

## Current Limitations

The repo is ready as a V1 foundation, but it is not yet a full CAD system.

Current limitations:

- `cad-core` stores V1 scene primitives plus the first authored sketch/extrude
  feature records. It is not yet a full part/feature/body graph.
- There is no authoritative B-rep topology in the document model.
- The derived OCCT path tessellates current primitives and rectangle/circle
  sketch extrudes, but exact B-rep geometry is not persisted as source of truth.
- Measurements are primitive-derived bounds and approximate volumes, not exact
  kernel/B-rep measurements for feature bodies.
- Document units are explicit but not a full unit system.
- Object display names are optional and not unique.
- The first sketch and extrude slices exist, but there is no sketch solver,
  constraint system, automatic profile recognition, broad feature edit command,
  or broad feature graph yet. `feature.delete` exists only for authored
  sketch-extrude features, `feature.updateExtrude` supports authored extrude
  depth and side edits, and rectangle/circle source profile values are edited
  through `sketch.updateEntity`.
- There is a first read-only semantic generated-reference query for authored
  rectangle/circle extrude bodies, but there is no broad stable topological
  naming system yet.
- There are no revolve, boolean, fillet, chamfer, shell, loft, pattern, or
  direct modeling features.
- There is no OPFS storage, File System Access integration, native `.wcad`
  package, STEP import/export, WebGPU renderer, large-assembly pipeline, hosted
  collaboration, or production MCP auth system.
- OCCT currently uses the full OpenCascade.js WASM in the main path. Brotli
  delivery is measured in smoke, and custom-build work is documented separately.

## Active Roadmap

The active next target is `docs/v2.md`: a feature/body CAD foundation. V2 should
move the app from primitive scene objects toward a real CAD document model while
preserving the V1 command, transaction, worker, renderer, storage, and agent
boundaries.

### Phase 1: V2 Document Model Foundation

Goal: introduce the smallest useful part/feature/body structure without
replacing working V1 behavior in one jump.

Current status: started. The current implementation exposes a derived default
part/primitive feature/solid body structure through CADOps queries while keeping
V1 scene primitives as the saved source of truth. This is a compatibility bridge,
not a persisted V2 feature graph.

Deliverables:

- Define typed CADOps-compatible IDs and snapshots for project, part, feature,
  body, and body-instance concepts.
- Preserve V1 scene primitives through compatibility or migration.
- Decide whether existing box/cylinder/sphere/cone/torus commands create
  primitive features, primitive bodies, or migrated scene objects during the
  transition.
- Add read-only queries for feature tree, parts, bodies, and feature/source
  metadata.
- Keep rendered meshes derived and rebuildable.
- Add project format version/migration tests.

Implemented first slice:

- `project.features` now includes default part and body IDs for each current
  primitive feature.
- `project.structure` returns the derived default part, primitive features,
  solid bodies, and object-to-source mappings.
- `cad.project_structure` exposes the same read model through the MCP wrapper.
- No body instances are introduced yet because there is no assembly or instancing
  caller.
- No project format version change is required yet because this first slice is
  derived from existing V1 source-of-truth data.

Exit criteria:

- V1 projects still load.
- New model structures are current-useful, tested, and visible through queries.
- No dead feature graph exists only as speculative architecture.

### Phase 2: Native Project Package and Local Save/Open Direction

Goal: turn the current JSON interchange into a deliberate path toward a native
project package without losing debuggability.

Current status: storage decision implemented and evolved. The V2 structural
bridge is still derived, the sketch slice added authored source data in
`web-cad.project.v2`, and the first extrude slice added authored feature/body
source data in `web-cad.project.v3`. V1 and V2 project JSON remain importable
through migration.

Deliverables:

- Update `docs/native-format.md` for the next project format version and package
  layout.
- Decide the first `.wcad` package shape: manifest, source document, command
  log, optional caches, and metadata.
- Add a migration path from `web-cad.project.v1`.
- Scope File System Access API and OPFS separately:
  - File System Access for user-visible open/save.
  - OPFS for private rebuildable caches.
- Keep derived meshes optional and rebuildable.

Implemented decision:

- Continue deriving `part:default`, `feature:<objectId>`, and
  `body:<objectId>` rather than persisting duplicate part/feature/body records.
- Export `web-cad.project.v3` with source-of-truth sketches, authored extrude
  features, sketch counters, feature counters, and body counters.
- Accept `web-cad.project.v1` through migration with empty sketches/features.
- Accept `web-cad.project.v2` through migration with sketches and empty
  features.
- Introduce a later project format only when source-of-truth data cannot be
  represented cleanly in the current V3 shape, such as constraints, explicit
  profiles, explicit authored parts, additional feature inputs, exact body
  checkpoints, topology references, or assemblies.
- Keep `.wcad`, OPFS, and File System Access as future scoped milestones.

Exit criteria:

- The source-of-truth storage contract is clear before OPFS or File System
  Access code is added.
- Older JSON versions remain supported imports while the active source format
  evolves deliberately.

### Phase 3: Sketch Model First Slice

Goal: add a minimal parametric sketch model that can support the first real
feature operation.

Current status: first source-of-truth slice implemented.

Implemented:

- Sketch containers on `XY`, `XZ`, and `YZ` planes.
- Point, line, rectangle, and circle sketch entities.
- CADOps commands for sketch create/rename/delete and entity
  add/update/delete.
- Validation for sketch names, planes, entity existence, coordinates, rectangle
  sizes, and circle radius.
- Semantic diffs, undo/redo, batch dry-run/commit, transaction history, and
  project JSON round trip for sketches.
- `project.sketches` and `sketch.get` queries through `cad-core`,
  `agent-adapter`, and MCP wrappers.
- Compact web UI panel for sketch creation and entity editing.
- Current exports use `web-cad.project.v3`; V1 and V2 imports remain compatible.

Exit criteria:

- A user or agent can create and inspect a simple sketch through CADOps.
- The sketch model is source-of-truth data, not renderer geometry.
- No full constraint solver is introduced until the scoped solver milestone.

### Phase 4: First Real Feature Operation

Goal: create the first exact kernel-backed body from source-of-truth feature
data.

Current status: first source-of-truth feature/body slice implemented.

Implemented:

- `feature.extrude` CADOps command for rectangle and circle sketch entities.
- Authored extrude feature records in `cad-core` with source sketch/entity,
  profile kind, depth, side (`positive`, `negative`, or `symmetric`),
  generated feature ID, and generated body ID.
- Validation for source sketch/entity, supported profile, positive finite
  depth, supported side, and unique feature/body IDs.
- Semantic diffs, undo/redo, batch dry-run/commit, transaction summaries, and
  project round trip.
- `web-cad.project.v3` source-of-truth export with V1/V2 import migration.
- `project.structure` and `project.features` show primitive-derived and
  sketch-extrude features/bodies.
- Geometry-kernel and geometry-worker rectangle/circle extrude tessellation
  behind the existing worker boundary.
- Derived renderer meshes remain rebuildable; simple primitive fallback remains
  available while geometry is disabled, pending, or unavailable.
- UI support for selecting a rectangle/circle sketch entity, entering extrusion
  depth, creating the feature through CADOps, and selecting the resulting body.

Exit criteria:

- A sketch-derived feature can produce a body and derived mesh without making
  OCCT authoritative inside `cad-core`.
- Existing primitive workflows remain usable or are explicitly migrated.

### Phase 5: Topological Reference and Naming First Slice

Goal: prevent future feature work from depending on unstable face/edge indexes.

Current status: first read-only body/face/edge reference slices implemented for
authored sketch-extrude bodies, with rectangle vertex references implemented for
simple authored rectangle extrudes.

Implemented:

- CADOps query `body.generatedReferences` returns semantic generated references
  for authored sketch-extrude bodies.
- CADOps query `body.resolveGeneratedReference` resolves one generated stable
  ID on an authored sketch-extrude body to the current body, face, edge, or
  vertex reference object.
- Rectangle extrudes expose stable generated face roles for start cap, end cap,
  and four profile-edge side faces: `side:uMin`, `side:uMax`, `side:vMin`, and
  `side:vMax`.
- Circle extrudes expose start cap, end cap, and `side:circular`.
- Rectangle extrudes expose stable generated edge roles for start-cap profile
  edges, end-cap profile edges, and four longitudinal corner edges.
- Circle extrudes expose start and end circular edge roles.
- Rectangle extrudes expose eight semantic generated vertex roles:
  `start:uMin:vMin`, `start:uMin:vMax`, `start:uMax:vMin`,
  `start:uMax:vMax`, `end:uMin:vMin`, `end:uMin:vMax`, `end:uMax:vMin`, and
  `end:uMax:vMax`.
- Circle extrudes intentionally return an empty vertex set because there are no
  stable discrete semantic vertices on a circular profile in this first slice.
- Reference metadata includes owning body ID, source feature ID, source sketch
  ID, source sketch entity ID, face/edge/vertex role, adjacent face roles for
  edges and vertices, adjacent edge roles for vertices, sketch plane, extrude
  side, profile kind, depth, current source profile signature, and simple
  normal/axis/profile-point roles where practical.
- Generated references include deterministic read-only labels and descriptions
  for human, script, and agent inspection. These labels are derived readability
  metadata, not persisted user names.
- Agent adapter and MCP wrapper expose the same read path without defining new
  internal architecture.
- Missing/stale generated reference IDs fail with a structured
  `GENERATED_REFERENCE_NOT_FOUND` query error instead of falling back to raw
  kernel or mesh indexes.
- References are derived from source data and update across depth edits, side
  edits, rectangle/circle profile edits, feature delete, undo/redo, and project
  import/export.

Deliverables:

- Add typed entity references for generated faces, edges, vertices, bodies,
  sketches, and features.
- Track feature lineage and lightweight geometric signatures where practical.
- Add user/agent-readable named references.
- Make ambiguous references fail clearly instead of silently editing the wrong
  geometry.

Exit criteria:

- First feature outputs have stable-enough references for subsequent scoped
  operations.
- The system does not expose raw kernel indexes as durable user/agent APIs.

### Phase 6: Exact Measurements and Kernel Queries

Goal: replace primitive-derived measurement approximations with kernel-backed
queries where exact bodies exist.

Deliverables:

- Add kernel-backed bounding boxes, volume, surface area, and centroid where
  practical.
- Keep read/query separate from mutation.
- Preserve primitive-derived measurements as fallback for V1 objects or
  migrated objects without exact bodies.
- Expose through CADOps, agent adapter, and MCP wrappers.

Exit criteria:

- Measurements use authoritative semantic/exact geometry when available, not
  renderer meshes.

### Phase 7: Renderer and Performance Upgrade Path

Goal: improve visual correctness and performance based on actual V2 workloads.

Deliverables:

- Add better edge display, normals, face highlighting, and body/feature
  selection feedback in the current renderer where practical.
- Define benchmark scenes before starting WebGPU.
- Introduce WebGPU only with clear requirements for buffers, picking, culling,
  instancing, and LOD.

Exit criteria:

- Renderer work follows measured needs from real geometry and assemblies.
- WebGPU is not started as a cosmetic rewrite.

### Phase 8: Interoperability and Larger CAD Features

These should wait until feature/body and topology foundations exist:

- STEP import/export.
- Fillets, chamfers, booleans, shell, patterns, lofts, sweeps, and direct edits.
- Assemblies, instancing, mates, LOD, and large-model benchmarks.
- Production MCP auth/approval flows and hosted collaboration.
- Natural-language command entry, if added at all, after structured operations
  remain solid.

## OCCT/WASM Size Track

The full OpenCascade.js WASM is acceptable for current local development and V1
foundation work. It should not block the V2 document/modeling roadmap.

Use `docs/occt-wasm-size.md` for current findings. Custom OCCT builds should
remain behind the geometry-worker boundary and should be evaluated when:

- hosted startup/download experience becomes a priority,
- the supported kernel API surface stabilizes enough to build a smaller binding
  set, or
- CI/smoke metrics show the full build is blocking development.

## Definition of Done

A future task is done only when:

1. The requested scope is implemented.
2. The implementation respects the package boundaries above.
3. All CAD mutations go through CADOps.
4. Source-of-truth state remains in `cad-core`.
5. Rendered meshes remain derived.
6. Relevant unit tests, smoke checks, or browser checks are added.
7. `pnpm test` passes.
8. `pnpm typecheck` passes.
9. Relevant build/lint/format checks pass.
10. Documentation is updated when behavior, scripts, or architecture boundaries
    change.
