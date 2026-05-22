# Implementation Plan

This document is the current implementation source of truth. It translates the
long-term architecture in `docs/architecture.md` into the repo state and the
next implementation roadmap.

Last updated: 2026-05-22.

Use this document for day-to-day implementation decisions. Use
`docs/architecture.md` for long-term design, `docs/v2.md` for the completed V2
feature/body foundation, `docs/v3.md` for the active V3 target,
`docs/native-format.md` for project-format direction, and
`docs/occt-wasm-size.md` for OCCT/WASM load-size findings.

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
8. OCCT/WASM, WebGPU, OPFS, STEP, and exact topology are introduced only in
   scoped milestones.
9. V2 is complete. V3 is active and should focus on parametric sketch-driven
   editing, not broad V4 architecture.

## Current Repo State

Partbench is implemented as a TypeScript pnpm workspace with a Vite React app
and focused packages:

- `apps/web` - browser UI, command worker, geometry worker entrypoint,
  derived-geometry orchestration, project panel, batch panel, viewport, and
  focused UI helpers.
- `packages/cad-protocol` - typed CADOps command, batch, query, actor metadata,
  and validation error shapes.
- `packages/cad-core` - authoritative in-memory document model, transactions,
  semantic diffs, undo/redo, queries, measurements/extents, source-of-truth
  sketches, document parameters, driving sketch dimensions, authored
  rectangle/circle extrude features, narrow rectangle-tool add/cut boolean source
  data, named references, and versioned project JSON import/export.
- `packages/renderer` - renderer-facing primitive and mesh types plus the
  current canvas viewport.
- `packages/renderer-mesh-bridge` - adapter from serializable geometry-worker
  mesh data into renderer mesh data.
- `packages/occt-wasm` - isolated OCCT/WASM loading and tessellation boundary.
- `packages/geometry-kernel` - typed primitive, extrude, and narrow boolean
  geometry facade around the isolated OCCT path.
- `packages/geometry-worker` - async geometry worker request/response boundary.
- `packages/agent-adapter` - structured adapter over CADOps batch/query APIs.
- `packages/mcp-adapter` - MCP tool wrapper over the structured adapter.
- `packages/mcp-stdio-server` - minimal stdio JSON-RPC MCP transport.
- `scripts/smoke-occt-browser.mjs` and `scripts/occt-smoke` - non-gating
  browser smoke/metrics runner for the OCCT worker path.

Compatibility identifiers retained during the Partbench rename:

- `@web-cad/*` workspace package names remain stable to avoid broad import and
  lockfile churn.
- `web-cad.project.v1` through `web-cad.project.v7` remain project-format schema
  identifiers. Renaming them would be a storage migration.
- `web-cad.agent-adapter.v1` remains the adapter protocol identifier.

## Completed History

The earlier project history is intentionally condensed here. Keep detailed
historical V2 behavior in `docs/v2.md`; do not recreate long milestone logs in
this implementation plan.

### Initial Foundation

The initial baseline established the pnpm workspace, Vite app, Vitest/lint/format
checks, typed CADOps mutation protocol, in-memory document model, transactions,
semantic diffs, undo/redo, browser command worker, canvas viewport, primitive
scene objects, project JSON import/export, and agent/MCP wrappers.

### V1 Baseline

V1 completed the primitive-scene workflow: box, cylinder, sphere, cone, and torus
creation/editing; transform, dimension, rename, delete, units, measurements,
history, batch operations, and project save/load; viewport fit/reset/selection;
OCCT-derived primitive meshes behind the worker path; and production-facing UI
polish. V1 source details are now summarized here instead of maintained as a
separate doc.

### V2 Feature/Body Foundation

V2 moved Partbench from primitives toward authored feature/body CAD while keeping
V1 compatibility. It added:

- source-of-truth sketches with point, line, rectangle, and circle entities;
- `feature.extrude` for rectangle/circle sketch profiles;
- authored body records, feature delete, depth/side edits, and profile edits;
- sketches attached to generated planar face references;
- generated body/face/edge/rectangle-vertex references, resolver queries,
  labels, eligibility metadata, and source-of-truth named references;
- source-derived measurements, project extents, generated-reference
  measurements, and dependency/health queries;
- narrow rectangle-tool boolean slices:
  - cut rectangle target,
  - cut circle target,
  - add/fuse rectangle target;
- derived geometry rebuilds through `geometry.booleanExtrudes` without making
  meshes or OCCT authoritative;
- UI support for sketches, extrudes, generated references, named references,
  attached sketches, add/cut status, measurements, and project JSON;
- agent-adapter and MCP pass-through coverage for current V2 commands/queries;
- project JSON evolution through `web-cad.project.v6`, with explicit migrations
  from older accepted versions.

V2 is complete. Its detailed target, implemented behavior, and non-goals live in
`docs/v2.md`.

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
  height, and circle radius through CADOps;
- create rectangle/circle extrude features as new bodies;
- edit authored extrude depth and side;
- edit source rectangle/circle profile values through `sketch.updateEntity`;
- delete authored sketch-extrude features;
- name generated references and resolve names later;
- inspect parts, sketches, features, bodies, named references, dependency
  health, history, measurements, extents, and generated-reference measurements;
- perform narrow rectangle-tool add/cut boolean workflows for supported target
  bodies;
- save/load current `web-cad.project.v7` JSON with migrations from older accepted
  schemas;
- expose current commands and queries through agent/MCP wrappers over CADOps.

## Current Limitations

The repo is a completed V2 feature/body foundation, not yet a full CAD system.

Current limitations:

- There is no general sketch solver or constraint system.
- Sketch dimensions currently drive only rectangle width/height and circle radius
  through a direct evaluator path.
- There is no parameter expression language.
- There is no broad feature graph beyond current authored sketch extrudes and
  narrow boolean add/cut result features.
- Generated references exist for simple authored extrude bodies, but boolean
  result bodies do not expose generated topology/reference sets yet.
- There is no authoritative B-rep topology persisted in the document model.
- Measurements are source-derived for current supported shapes and references;
  they are not exact B-rep/kernel measurements.
- There are no fillets, chamfers, revolve, shell, sweep, loft, patterns, direct
  edits, general booleans, STEP import/export, OPFS/File System Access,
  WebGPU, assemblies, hosted collaboration, production MCP auth, or
  natural-language command entry.
- OCCT currently uses the full OpenCascade.js WASM in the main path. Custom
  build findings are documented separately and should not block V3 modeling
  work.

## Active Roadmap: V3 Parametric Sketch Editing

V3 should be a meaningful usefulness jump without starting unrelated V4 systems.
The product target is:

> A user or agent can define and edit source-of-truth sketch dimensions and
> parameters, rebuild downstream sketches/features/bodies/measurements through
> CADOps, and inspect clear dependency health when something becomes invalid.

V3 is agent-first. Parameters, dimensions, solver results, dependency health,
validation failures, and rebuild effects must be typed/queryable through CADOps
and wrapped by agent/MCP adapters. The UI should make the same structure usable
for humans without adding hidden UI-only model state.

### V3 Phase A: Parameter and Driving-Dimension Source Model

Goal: introduce the smallest source-of-truth model for document parameters and
sketch dimensions.

Implemented in Phase A:

- typed parameter records with names, numeric values, optional descriptions, and
  validation;
- typed sketch dimension records for rectangle width, rectangle height, and circle
  radius;
- CADOps commands for creating, updating, renaming, and deleting parameters and
  dimensions;
- semantic diffs, undo/redo, batch dry-run/commit, transaction history,
  adapter/MCP pass-through, and project JSON import/export;
- `web-cad.project.v7` with V1 through V6 import compatibility;
- a direct evaluator path where literal or parameter-bound dimensions update
  supported sketch entity values through CADOps.

Non-goals:

- No full solver yet.
- No arbitrary expressions unless explicitly scoped.
- No dragging solver UX.
- No arbitrary profile recognition.
- No parameter/dimension UI in the first core/source-model slice.

### V3 Phase B: Minimal Constraint/Solver Slice

Goal: broaden the Phase A direct evaluator toward a small sketch
solver/evaluator structure in a controlled, testable way.

Expected deliverables:

- a small internal sketch-solving/evaluation path in the correct package
  boundary;
- support for the next high-value cases only where endpoint/entity behavior is
  explicit, such as line length or horizontal/vertical constraints;
- structured solver status for healthy, under-defined, over-defined,
  unsolved, and unsupported cases where practical;
- no UI-only solver state;
- tests for deterministic inputs/outputs and failure shapes.

Non-goals:

- No general geometric constraint solver.
- No tangent, concentric, equal, symmetry, spline, or complex profile solving
  unless a later prompt scopes them deliberately.

Solver direction guardrails:

- parameters, dimensions, and constraints should be source records with stable
  IDs, not UI-only fields;
- solver/evaluator outputs are deterministic derived data;
- downstream features should consume evaluated sketch geometry once solver
  behavior exists for that path;
- invalid, unsupported, under-defined, or over-defined sketches must report
  structured status/errors instead of silently producing misleading geometry;
- React, renderer, OCCT, MCP, and agent layers must not own separate solver
  authority.

### V3 Phase C: Rebuild Propagation and Health

Goal: make parameter/dimension edits propagate through the existing V2 body
pipeline without breaking architectural boundaries.

Expected deliverables:

- dimension/parameter edits update source sketches through CADOps;
- authored extrudes, attached sketches, narrow boolean add/cut results,
  measurements, extents, generated references, named references, and health
  queries respond coherently;
- derived geometry cache keys and stale async handling include driven sketch
  changes;
- unsupported cases fail clearly and structurally.

Non-goals:

- No exact topology naming for boolean result bodies unless separately scoped.
- No broad boolean expansion.

### V3 Phase D: Human and Agent UX

Goal: make parametric editing understandable in the UI and through structured
agent queries.

Expected deliverables:

- compact UI for parameters, sketch dimensions, solver status, and downstream
  dependency health;
- CADOps query support for parameter/dimension summaries and affected features;
- agent/MCP wrapper coverage as thin pass-throughs;
- UI helper tests for command building, filtering, status formatting, and
  dependency display.

Non-goals:

- No browser E2E expansion unless explicitly scoped.
- No natural-language parser.

### V3 Phase E: Stabilization and Completion

Goal: finish V3 as a coherent, well-tested milestone.

Expected deliverables:

- unit/package-level coverage for command/query contracts, serialization,
  solver/evaluator behavior, rebuild propagation, derived geometry invalidation,
  adapter/MCP wrappers, and UI helpers;
- docs updated to mark V3 complete when acceptance criteria pass;
- implementation-plan updated with the next target after V3.

## V3 Acceptance Criteria

V3 is complete when:

1. Parameters and sketch dimensions are source-of-truth document data.
2. Current supported dimensions drive rectangle/circle sketch geometry through
   CADOps.
3. Editing dimensions/parameters rebuilds downstream authored extrudes,
   attached-sketch extrudes, narrow add/cut results, measurements, extents,
   generated references, named references, and dependency health where
   supported.
4. Unsupported or unsolved sketch states fail with structured errors/status
   instead of silently producing misleading geometry.
5. Project JSON import/export/migration is explicit and tested.
6. Agent/MCP adapters expose V3 commands/queries as wrappers over CADOps.
7. The UI clearly presents parameters, dimensions, solver status, and downstream
   impact without relying on debug text.
8. Unit and package-level tests cover the behavior without depending on brittle
   browser E2E workflows.

## Deferred Beyond V3 Unless Explicitly Scoped

- General sketch constraint solving.
- Full stable topological naming across broad feature edits.
- Generated references for boolean result bodies.
- General booleans/add, fillets, chamfers, shell, patterns, lofts, sweeps,
  revolve, and direct edits.
- STEP import/export.
- OPFS cache implementation and File System Access open/save.
- Native `.wcad` package implementation.
- Local launcher with cross-origin isolation headers.
- WebGPU production renderer.
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
5. Rendered meshes remain derived.
6. Relevant unit tests or focused package-level checks are added.
7. Browser E2E tests are not added unless explicitly scoped.
8. `pnpm test` passes.
9. `pnpm typecheck` passes.
10. Relevant build/lint/format checks pass.
11. Documentation is updated when behavior, scripts, or architecture boundaries
    change.
