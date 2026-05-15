# Web CAD

An open-source, browser-native, AI-native CAD application. The current MVP
prototype has a typed CADOps command layer, in-memory document model, primitive
viewport, project JSON serialization, agent/MCP adapter spikes, and isolated
OCCT/WASM geometry experiments.

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

Run the app with the explicit OCCT mesh dev path enabled:

```sh
VITE_ENABLE_OCCT_MESH_DEV=true pnpm dev
```

With that flag enabled, boxes and cylinders are automatically submitted to the
derived mesh service and tessellated asynchronously in the browser Worker. The
returned mesh is displayed as a derived renderer overlay, the panel shows
per-object geometry status, and the authoritative CAD document is not updated by
mesh generation.

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
`WEB_CAD_SMOKE_BROWSER=/path/to/chrome` if the script cannot find a browser.

Current OCCT/WASM load-size notes live in `docs/occt-wasm-size.md`.

## Workspace Layout

- `apps/web` - Vite browser app and explicit worker entrypoints
- `packages/cad-protocol` - typed CADOps command and query protocol
- `packages/cad-core` - document model, transactions, undo/redo, project JSON
- `packages/renderer` - simple renderer abstraction and canvas viewport support
- `packages/geometry-kernel` - isolated primitive tessellation facade
- `packages/geometry-worker-spike` - async worker boundary for tessellation
- `packages/renderer-mesh-bridge` - mesh data adapter for the current renderer
- `packages/agent-adapter` - CADOps adapter for external structured callers
- `packages/mcp-adapter` - MCP tool wrapper over the structured adapter

## Current Limitations

- The production renderer still uses simple primitive drawing as fallback; OCCT
  mesh display is feature-flagged for boxes and cylinders.
- OCCT/WASM is intentionally off the normal startup path and currently proves
  primitive tessellation only.
- No real CAD topology, STEP import/export, OPFS persistence, WebGPU renderer, or
  natural-language command parsing is implemented.
