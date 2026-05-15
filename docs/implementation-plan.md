# Implementation Plan

This document is the current implementation source of truth. It translates the
long-term architecture in `docs/architecture.md` into the actual repo state and a
near-term roadmap.

Last updated: 2026-05-15.

The project should continue to move in small, testable milestones. Do not skip
ahead to a future architecture layer unless the requested milestone calls for it.

## Architectural Constraints

These constraints remain active:

1. CADOps is the center of the system.
2. Human UI, scripts, tests, and MCP/agent adapters use the same command layer.
3. `cad-core` owns authoritative document state.
4. Rendered primitives and meshes are derived views or caches.
5. React UI does not import geometry internals directly.
6. Geometry, renderer, command engine, protocol, storage, and MCP boundaries stay
   separate.
7. MCP wraps CADOps. MCP does not define the internal API.
8. OCCT/WASM, WebGPU, OPFS, STEP, and real topology are introduced only in scoped
   milestones.

## Current Repo State

The current repo is a TypeScript pnpm workspace with a Vite React app and focused
packages:

- `apps/web` - browser UI, command-worker entrypoint, geometry-worker entrypoint,
  development-default derived mesh service for OCCT box and cylinder meshes,
  primitive-rendering fallback, and smoke page.
- `packages/cad-protocol` - typed CADOps command, batch, and query shapes.
- `packages/cad-core` - in-memory document model, command application,
  transactions, semantic diffs, undo/redo, CADOps query path, and project JSON
  serialization.
- `packages/renderer` - simple renderer-facing primitive and mesh types plus
  canvas viewport rendering.
- `packages/renderer-mesh-bridge` - adapter from serializable geometry-worker
  mesh data into renderer mesh data.
- `packages/occt-spike` - isolated OCCT/WASM primitive tessellation spike.
- `packages/geometry-kernel` - typed primitive tessellation facade around the
  isolated OCCT path.
- `packages/geometry-worker-spike` - async geometry worker request/response
  boundary for primitive tessellation.
- `packages/agent-adapter` - structured adapter over CADOps batch/query APIs.
- `packages/mcp-adapter` - tool wrapper exposing CADOps-oriented MCP tools.
- `packages/mcp-stdio-server` - minimal stdio JSON-RPC MCP transport.
- `scripts/smoke-occt-browser.mjs` - non-gating browser smoke/metrics runner for
  the OCCT worker path, including structured success/failure diagnostics.
- `scripts/occt-smoke` - helper modules for OCCT smoke browser/server plumbing,
  asset metrics, and structured result records.
- `docs/occt-wasm-size.md` - current OCCT/WASM load-size findings,
  tradeoffs, and recommendation.

## Completed Milestones

### Milestone 0: Repo Foundation

Status: complete.

Delivered:

- pnpm workspace monorepo.
- `apps/web`.
- `packages/cad-protocol`.
- `packages/cad-core`.
- `packages/renderer`.
- Shared TypeScript configuration.
- Vite web app.
- Vitest package tests.
- Root scripts for dev, build, test, typecheck, lint, and format.

### Milestone 1: CADOps Protocol and Command Engine

Status: complete.

Delivered:

- Typed command schemas for:
  - `scene.createBox`
  - `scene.createCylinder`
  - `scene.deleteObject`
  - `scene.updateTransform`
- In-memory document model.
- Object IDs.
- Command application.
- Transactions.
- Semantic diffs.
- Undo/redo.
- Tests for command behavior, undo/redo, and transaction diff contents.

### Milestone 1.5: CADOps Batch Interface

Status: complete.

Delivered:

- `CadBatch`.
- Dry-run mode.
- Commit mode.
- Batch validation.
- Structured response with created, modified, deleted, warnings, errors, and
  transaction IDs.
- Undo of committed batches.
- Tests for dry-run, commit, validation failure, mixed batches, and undo.

### Milestone 2: Basic Viewport

Status: complete.

Delivered:

- Web app connected to `CadEngine`.
- UI controls for create box, create cylinder, update transform, delete, undo,
  redo, and CADOps batch execution.
- Simple 3D canvas viewport.
- Boxes and cylinders rendered as simple derived primitives.
- Orbit, pan, and zoom controls.
- Object selection.
- Inspector panel with ID, type, dimensions, transform, transform update, and
  delete controls.
- Renderer kept separate from `cad-core`.

### Milestone 2.5: Project JSON Serialization

Status: complete.

Delivered:

- Minimal JSON project format for the current MVP document model.
- Export/import for objects, transforms, dimensions, and practical transaction
  history.
- UI buttons for export/import JSON.
- Round-trip tests.

This is intentionally not OPFS and not the final native `.wcad` project package.

### Milestone 3: Worker Boundary

Status: complete.

Delivered:

- Worker-facing command execution interface.
- Async command execution path from `apps/web`.
- Browser Worker transport for command execution.
- `cad-core` remains authoritative; command workers do not own the document.
- Tests proving the async path.

### Milestone 4: OCCT/WASM Kernel Spike

Status: complete as an isolated spike.

Delivered:

- Isolated OCCT/WASM package.
- One primitive shape path: box.
- Tessellation to serializable mesh-like typed arrays.
- Geometry-kernel facade around the OCCT spike.
- Browser geometry worker entrypoint.
- Renderer mesh bridge.
- App UI path for deriving box meshes asynchronously through the browser Worker
  and displaying returned meshes as derived overlays.
- Lightweight instrumentation for:
  - OCCT/WASM first-load time.
  - Tessellation request time.
  - Geometry kernel total time.
  - Worker total time.
  - Main-thread round-trip time.
  - Vertex and triangle counts.
- `pnpm smoke:occt-browser` for non-gating timing telemetry.
- Structured worker diagnostics for WASM load failure, unsupported primitive
  requests, kernel/tessellation failure, worker runtime failure, and transport
  failure.
- Geometry UI surfacing for OCCT worker error code, stage, worker startup, and
  WASM load status.

Current measured smoke example:

```text
scenario: box-and-cylinder
OCCT load: ~1.2-1.4 s on the current local machine
tessellation: ~15-20 ms
round trip: ~1.3-1.4 s on first load
meshes: box 24 vertices / 12 triangles, cylinder ~100 vertices / ~100 triangles
OCCT WASM: ~50.31 MB raw, ~13.96 MB gzip, ~11.19 MB Brotli
served OCCT WASM in smoke: ~11.19 MB via br
```

Timing magnitude is tracked, not used as a pass/fail budget.

The current load-size investigation is documented in
`docs/occt-wasm-size.md`. The immediate low-risk improvement is Brotli serving
for the smoke/hosting path. Real binary shrinkage still requires a custom
OpenCascade.js build experiment; the installed package only ships the full
prebuilt WASM.

### Milestone 5: AI/MCP Adapter Spike

Status: complete as a structured transport spike.

Delivered:

- CADOps batch exposed through `packages/agent-adapter`.
- Dry-run and commit supported.
- Structured responses preserved.
- CADOps read/query path for project summary and object lookup.
- MCP adapter package exposing:
  - `cad.project_summary`
  - `cad.batch`
- Minimal stdio JSON-RPC MCP transport.
- Tests for adapter and transport behavior.

No natural-language parsing has been added. Agents interact through structured
CADOps requests.

## Current Scripts

Common development:

```sh
pnpm dev
pnpm test
pnpm typecheck
pnpm build
pnpm lint
pnpm format:check
```

Derived geometry development path:

```sh
pnpm dev
```

Development builds enable derived OCCT geometry by default. Use the fallback
escape hatch when debugging primitive rendering or worker failures:

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

This writes JSONL telemetry to:

```text
.metrics/occt-browser.jsonl
```

Each smoke record includes the scenario name, browser metadata where available,
worker startup/WASM load outcome, timing metrics, asset-size metrics, and
structured error details on failure. The metrics file is intentionally ignored
by git.

## Current Limitations

The project is past the first MVP, but it is not yet a real CAD system.

Current limitations:

- `cad-core` stores scene objects, not a true feature graph.
- There is no real B-rep topology in the authoritative document.
- OCCT currently proves box and cylinder tessellation.
- Primitive rendering remains the fallback when derived geometry is unavailable,
  loading, or failed.
- The Geometry panel reports whether each object is using an OCCT-derived mesh,
  is still deriving one, or is on primitive fallback.
- The viewport uses ready derived meshes as the preferred display input and keeps
  primitive rendering as fallback instead of drawing both for the same object.
- Derived geometry is default-enabled for development builds and still disabled
  by default for production builds, so there is no full production geometry cache
  yet.
- No stable topological naming system exists yet.
- No sketch solver exists yet.
- No exact measurement API exists yet.
- No OPFS storage exists yet.
- No File System Access API integration exists yet.
- No STEP import/export exists yet.
- No WebGPU renderer exists yet.
- No large-assembly LOD or instancing pipeline exists yet.
- MCP is local structured tooling only; no permissions/audit system exists yet.

## Roadmap

### Phase A: Harden the OCCT Worker Path

Goal: turn the current OCCT browser-worker path from a successful spike into a
reliable development subsystem.

Deliverables:

- Keep `pnpm smoke:occt-browser` as a regular validation command.
- Append timing and asset-size telemetry for every smoke run.
- Add more smoke scenarios as geometry coverage grows.
- Improve worker error reporting and lifecycle handling. The current diagnostic
  shape covers WASM load, unsupported primitive, kernel/tessellation, worker
  runtime, and transport failures.
- Make WASM loading diagnostics visible in the UI. The current Geometry panel
  shows error code, stage, worker startup, and WASM load status when derived
  geometry fails.
- Track OCCT asset size over time.
- Keep Brotli/gzip delivery metrics in the smoke pipeline.
- Investigate a smaller custom OCCT build as the next meaningful binary-size
  reduction. App-layer compression now reduces delivered bytes, but it does not
  shrink the underlying full WASM module.
- Decide whether the first V1 geometry path can use the current full OCCT build
  lazily with Brotli delivery, or whether a custom build is required before
  broader geometry work.

Exit criteria:

- A developer can run the real browser-worker OCCT path repeatedly.
- Metrics are recorded in structured form.
- Failures are actionable.
- Default production app startup remains independent from OCCT.

### Phase B: Production Derived Geometry Pipeline

Goal: replace manual tessellation checks with a real derived mesh pipeline while
keeping `cad-core` authoritative.

Deliverables:

- Define object revision/cache keys in `cad-core` or a boundary package.
- Add a mesh derivation service that consumes document objects and returns
  renderer meshes.
- Keep mesh generation asynchronous.
- Add cache invalidation for create, update transform, update dimensions, delete,
  undo, redo, import, and load project.
- Keep derived mesh state outside the authoritative document.
- Continue rendering simple primitives as fallback while geometry is loading or
  unavailable.

Current slice delivered:

- A development-default app-layer derived geometry service consumes current
  document objects and derives renderer meshes for boxes through the existing
  browser geometry worker path. Production builds remain opt-in.
- Per-object derived geometry status is tracked as unsupported, pending, ready,
  or error.
- Cache keys include current MVP dimensions and transforms, and stale async
  worker results are ignored after invalidation.
- Derived mesh entries are reconciled after create, transform update, delete,
  undo, redo, and project import/load because those paths update the current
  document snapshot.
- Cylinder tessellation now runs through the same OCCT spike, geometry-kernel
  facade, browser worker, renderer mesh bridge, and derived geometry status path
  as box tessellation.
- The app-layer render scene preparation prefers ready derived meshes and omits
  duplicate primitive fallback for those objects, while pending, failed,
  unsupported, or disabled derived geometry still displays primitives.

Exit criteria:

- A box can be created through CADOps and automatically get a derived OCCT mesh.
- Stale meshes are not displayed after document changes.
- The renderer accepts derived meshes without importing `cad-core` or OCCT.

### Phase C: Expand Kernel-Backed Primitive Coverage

Goal: make the geometry-kernel facade useful for the current scene command set.

Deliverables:

- Add typed tessellation request/response for cylinders. Current implementation
  supports this through `geometry.tessellateCylinder`.
- Tessellate cylinders through the worker. Current implementation supports this
  through the same browser-worker path as boxes.
- Route boxes and cylinders through the same derived geometry service. Current
  implementation keeps both as derived views/caches, default-enabled in
  development and opt-in for production builds.
- Add tests and browser smoke scenarios for box and cylinder. Current
  implementation adds focused package/app tests for the cylinder request,
  kernel, worker, mesh bridge, and derived service paths; the browser smoke runs
  box and cylinder requests in the same worker session.
- Keep command semantics unchanged while mesh derivation improves.

Exit criteria:

- Existing CADOps scene commands produce consistent document diffs.
- Box and cylinder display can use worker-derived meshes when the geometry path
  is enabled.
- Primitive rendering remains available as fallback.
- Ready derived meshes are displayed instead of duplicate primitives for the
  same object.

### Phase D: V1 Document and Command Model

Goal: evolve from scene primitives toward a minimal CAD-like feature model
without jumping to the full architecture.

Deliverables:

- Introduce a first feature-oriented object model only where needed.
- Preserve compatibility or migration from current scene objects.
- Add explicit feature/shape/body concepts when they become necessary.
- Add units to the project model.
- Add structured validation responses.
- Add exact or kernel-backed measurement commands for supported primitives.
- Keep every mutation as a CADOps transaction with semantic diffs.

Exit criteria:

- Agents and UI can query the model structurally before submitting changes.
- Commands remain deterministic and transaction-backed.
- Geometry-derived results are not the source of truth.

### Phase E: Project Format and Local Persistence

Goal: move beyond debug JSON toward a real project format while avoiding OPFS
prematurely.

Deliverables:

- Define a versioned native project package target in `docs/native-format.md`.
- Keep JSON export/import as a debug/interchange path.
- Decide package shape for source document, command log, derived mesh cache, and
  metadata.
- Add import/export tests.
- Add migration/versioning rules.

Exit criteria:

- The project can save and load a versioned source-of-truth document.
- Derived geometry remains rebuildable and optional.
- Future OPFS and File System Access work has a clear storage contract.

### Phase F: MCP and Agent Safety

Goal: keep MCP useful without letting it shape the core architecture.

Deliverables:

- Keep `cad.batch` as the main write tool.
- Add `cad.query` or expand structured query only after the internal query API is
  ready.
- Add tool-level validation and clearer error responses.
- Add actor metadata to transactions.
- Add audit records for agent-originated commits.
- Add permission defaults: read/query plus dry-run before commit.

Exit criteria:

- An external agent can inspect, dry-run, commit, and undo structured changes.
- Human UI and MCP continue to use the same CADOps layer.
- No natural-language parsing is required.

### Phase G: Renderer Upgrade Path

Goal: improve visual correctness and performance without prematurely replacing
the current renderer.

Deliverables:

- Improve current canvas mesh display while geometry is still simple.
- Add renderer-facing selection IDs for mesh overlays.
- Add edge display and highlight behavior that works for derived meshes.
- Define WebGPU renderer requirements and benchmark scenes before implementing
  WebGPU.

Exit criteria:

- Current renderer can support V1 geometry demos.
- WebGPU work begins only with clear performance and feature requirements.

### Phase H: Later Architecture Milestones

These remain future work and should not be implemented casually:

- Stable topological naming.
- Sketch solver.
- Feature extrude/revolve/sweep/loft.
- Fillet/chamfer/boolean features.
- STEP import/export.
- OPFS cache.
- File System Access API.
- Local launcher with cross-origin isolation headers.
- WebGPU renderer.
- Assemblies, instancing, LOD, and large-model benchmarks.
- Hosted collaboration.
- MCP permissions and hosted gateway.

## Definition of Done for Future Work

A future task is done only when:

1. The requested scope is implemented.
2. The implementation respects the package boundaries above.
3. Relevant unit tests, smoke checks, or browser checks are added.
4. `pnpm test` passes.
5. `pnpm typecheck` passes.
6. Relevant build/lint/format checks pass.
7. Documentation is updated when behavior, scripts, or architecture boundaries
   change.

## Current Target

The first MVP is complete. The active product target is now `docs/v1.md`.
