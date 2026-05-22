# Partbench

Partbench is an open-source, browser-native, AI-native CAD application. The
current app has a typed CADOps command layer, in-memory document model,
viewport, project JSON serialization, structured agent/MCP adapters, and an
isolated OCCT/WASM derived geometry path.

The completed V2 foundation supports primitive scene objects, source-of-truth
sketches, rectangle/circle extrudes, generated and named references, attached
sketches, measurements, dependency health, and narrow rectangle-tool add/cut
boolean workflows through the shared command layer.
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
renderer data, the Geometry panel shows per-object status, and the authoritative
CAD document is not updated by mesh generation.

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
- `docs/v2.md` - completed V2 feature/body foundation.
- `docs/v3.md` - active V3 parametric sketch editing target.
- `docs/native-format.md` - current JSON format and native project package
  direction.
- `docs/occt-wasm-size.md` - OCCT/WASM size findings and recommendations.

## Workspace Layout

- `apps/web` - Vite browser app and explicit worker entrypoints
- `packages/cad-protocol` - typed CADOps command and query protocol
- `packages/cad-core` - document model, transactions, undo/redo, project JSON
- `packages/renderer` - simple renderer abstraction and canvas viewport support
- `packages/occt-wasm` - isolated OCCT/WASM loading boundary
- `packages/geometry-kernel` - isolated primitive tessellation facade
- `packages/geometry-worker` - async worker boundary for tessellation
- `packages/renderer-mesh-bridge` - mesh data adapter for the current renderer
- `packages/agent-adapter` - CADOps adapter for external structured callers
- `packages/mcp-adapter` - MCP tool wrapper over the structured adapter
- `packages/mcp-stdio-server` - local stdio JSON-RPC MCP transport

## Project Format

Current project JSON exports use `web-cad.project.v6`. V1, V2, V3, V4, and V5
project JSON remain importable through explicit migrations; derived meshes and
geometry status are never saved as source-of-truth data.

`web-cad.project.*`, `web-cad.agent-adapter.v1`, and the `@web-cad/*`
workspace package scope are retained as compatibility identifiers. They are not
current product branding and should not be changed without a deliberate
protocol/package migration.

## Current Limitations

- The renderer still uses simple primitive drawing as fallback while OCCT-derived
  meshes are loading, disabled, unavailable, or failed.
- OCCT/WASM is intentionally off the default production startup path and
  currently backs primitive tessellation, rectangle/circle extrudes, and narrow
  rectangle-tool add/cut derived meshes.
- Sketches, rectangle/circle extrude features, and sketches attached to
  generated planar face references are source-of-truth V2 data, but there is no
  sketch solver, automatic profile recognition, broad feature editing, or full
  topology naming yet.
- V3 planning is focused on source-of-truth parameters, sketch dimensions, and a
  minimal sketch solver/evaluator slice before broader CAD features.
- No real CAD topology, STEP import/export, OPFS persistence, WebGPU renderer, or
  natural-language command parsing is implemented.
