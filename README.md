# Partbench

Partbench is an open-source, browser-native, AI-native CAD application. The
current app has a typed CADOps command layer, in-memory document model,
viewport, project JSON serialization, structured agent/MCP adapters, and an
isolated OCCT/WASM derived geometry path.

The completed foundation supports primitive scene objects, source-of-truth
sketches, rectangle/circle extrudes, generated and named references, attached
sketches, measurements, dependency health, narrow rectangle-tool add/cut
boolean workflows, document parameters, driving sketch dimensions, and the first
line orientation constraints through the shared command layer. The current V6
baseline also supports scoped revolve, hole, chamfer, and fillet workflows with
derived OCCT meshes and exact-metadata health where available.
The V8/V9 release-candidate surface adds native `.wcad` project workflow, OPFS
derived mesh cache status, exact STEP export for supported active bodies, and
viewport-native body/face/edge semantic selection with contextual
Measure/Inspect.
OCCT-derived meshes are display data only; the source of truth remains the typed
document and transaction history in `cad-core`.

## Requirements

- Node.js 22 or newer
- pnpm 10

## Setup

Install workspace dependencies:

```sh
pnpm install
```

## Development

Run the browser app:

```sh
pnpm dev
```

When running the local Vite server, boxes, cylinders, spheres, cones, and tori
are submitted to the derived geometry service by default and tessellated
asynchronously in the browser Worker. The returned mesh is displayed as derived
renderer data, app status surfaces report derived/cache/export readiness where
appropriate, and the authoritative CAD document is not updated by mesh
generation.

Disable derived geometry for fallback debugging:

```sh
VITE_DISABLE_DERIVED_GEOMETRY=true pnpm dev
```

Production builds keep derived geometry disabled unless explicitly enabled:

```sh
VITE_ENABLE_DERIVED_GEOMETRY=true pnpm build
```

Run the full build:

```sh
pnpm build
```

Run package tests:

```sh
pnpm test
```

Run lint and format checks:

```sh
pnpm lint
pnpm format:check
```

Run TypeScript checks:

```sh
pnpm typecheck
```

Run the isolated geometry-worker bundle check:

```sh
pnpm build:geometry-worker
```

Run the non-gating OCCT browser smoke and append timing metrics:

```sh
pnpm smoke:occt-browser
```

This builds the isolated smoke page, launches a local Chromium-compatible
browser, verifies the OCCT worker tessellation path, and appends JSONL records to
`.metrics/occt-browser.jsonl`. Each record includes the scenario, browser
metadata where available, worker startup/WASM load outcome, timing metrics,
asset-size metrics, Brotli/gzip delivery metrics, and structured error details
on failure. Timing values are recorded for tracking, but the smoke fails only
when the path breaks or required metrics are missing. Set
`PARTBENCH_SMOKE_BROWSER=/path/to/chrome` if the script cannot find a browser.
The older `WEB_CAD_SMOKE_BROWSER` name remains accepted as a compatibility
alias.

Current OCCT/WASM load-size notes live in `docs/occt-wasm-size.md`.

## Documentation

- `docs/architecture.md` - long-term architecture.
- `docs/implementation-plan.md` - current implementation source of truth and
  roadmap.
- `docs/archive/v4.md` - archived V4 constrained sketch solving milestone.
- `docs/v10.md` - completed V10 editable feature history and stable modeling
  references release record.
- `docs/v11.md` - completed V11 full sketch solver and parametric sketch UX
  release record.
- `docs/v12.md` - completed V12 stable boolean topology and result references
  release record.
- `docs/native-format.md` - current JSON format and native project package
  direction.
- `docs/occt-wasm-size.md` - OCCT/WASM size findings and recommendations.

## Workspace Layout

- `apps/web` - Vite browser app and explicit worker entrypoints
- `packages/cad-protocol` - typed CADOps command and query protocol
- `packages/cad-core` - document model, transactions, undo/redo, project JSON
- `packages/renderer` - simple renderer abstraction and canvas viewport support
- `packages/occt-wasm` - isolated OCCT/WASM loading boundary
- `packages/geometry-kernel` - typed primitive, feature, exact-metadata, and
  edge-finish geometry facade
- `packages/geometry-worker` - async worker boundary for derived geometry and
  exact metadata
- `packages/renderer-mesh-bridge` - mesh data adapter for the current renderer
- `packages/agent-adapter` - CADOps adapter for external structured callers
- `packages/mcp-adapter` - MCP tool wrapper over the structured adapter
- `packages/mcp-stdio-server` - local stdio JSON-RPC MCP transport

## Project Format

Current project JSON exports use `web-cad.project.v16`. V1 through V15 project
JSON remain importable through explicit migrations; derived meshes, solver
status, exact metadata, topology snapshots, and geometry status are never saved
as source-of-truth data.

`web-cad.project.*`, `web-cad.agent-adapter.v1`, and the `@web-cad/*`
workspace package scope are retained as compatibility identifiers. They are not
current product branding and should not be changed without a deliberate
protocol/package migration.

## Current Limitations

- The renderer still uses simple primitive drawing as fallback while
  OCCT-derived meshes are loading, disabled, unavailable, or failed.
- OCCT/WASM is intentionally isolated behind geometry-worker/kernel boundaries
  and currently backs primitive tessellation, rectangle/circle extrudes, narrow
  rectangle-tool add/cut derived meshes, supported V6 result meshes, and derived
  exact metadata where available.
- Sketches, rectangle/circle extrude features, sketches attached to supported
  generated planar face references, parameters, driving sketch dimensions,
  supported constraints, editable source-feature history, reference health, and
  stable supported boolean-result references are source-of-truth/model-authority
  data. Arbitrary topology naming, broad result-body topology identity, and
  persistent exact B-rep checkpoints remain deferred.
- V8 completed the local CAD foundation: native `.wcad` package workflow, File
  System Access open/save, OPFS-derived mesh cache, and exact STEP export for
  supported bodies.
- V9 completed the release-candidate viewport-native interaction surface:
  renderer-agnostic hit candidates, semantic selection resolution,
  command-ready viewport selections, contextual tools, and inspect/measure
  workflows for the supported current semantic subset.
- V10 completed editable feature history and stable modeling references:
  feature editability, dependency/rebuild diagnostics, consumed/replacement body
  lifecycle, reference health/repair semantics, and source-semantic topology
  expansion where defensible.
- V11 completed the supported sketch solver and parametric sketch UX release.
- V12 completed stable boolean topology and result references for the supported
  rectangle/circle cut/add subset, with unsupported topology kept as structured
  diagnostics.
- No arbitrary stable topology, STEP import, production WebGPU renderer,
  assemblies, hosted collaboration, production MCP auth, or natural-language
  command parsing is implemented unless scoped into a later release.
