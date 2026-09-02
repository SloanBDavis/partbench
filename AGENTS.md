# Agent instructions

Partbench is an open-source, browser-native, AI-native CAD application.

CADOps is the center. cad-core is the document authority (transactions,
undo/redo, semantic diffs). OCCT/WASM is the geometry authority. Meshes,
picks, and previews are derived display.

- How we work: [docs/how-we-work.md](docs/how-we-work.md)
- Architecture: [docs/architecture.md](docs/architecture.md)
- Skills: [docs/skills/](docs/skills/)
- Last completed user goal: [docs/v25.md](docs/v25.md). V22, V23, V24, and V25 are complete.
  Do not reopen them. Do not invent V26. Next product work is a new user goal.

Do not open [docs/archive/](docs/archive/), docs/implementation-plan.md,
or per-gate markdown unless the current user-goal doc names them.

Land on main as Sloan Davis <sloanbdavis@gmail.com>. Never open pull requests.

## Run the app

Node.js 22 and pnpm 10.

```sh
pnpm install
pnpm dev
```

## Daily scripts

- pnpm dev
- pnpm test
- pnpm typecheck
- pnpm lint
- pnpm smoke:v25-part-toolkit — completed V25 closer
- pnpm smoke:v24-finished-parts — completed V24 closer
- pnpm smoke:v23-promotion-workflow — completed V23 closer
- pnpm verify — typecheck plus CADOps scenarios
- smoke:ui — Chromium workbench loop (filtered on slice close)

Per-save: focused tests and typecheck of the packages you touched. pnpm verify
is typecheck plus the scenarios/ CADOps runner. It does not rerun V7-V24 smokes.
Never rerun V7-V24 gauntlets.

The V25 named closer is `pnpm smoke:v25-part-toolkit` (in-process scenarios, vitest pair, and smoke:ui on V25-added scenarios).

## Slice close

A slice is done when the named closer is green and, when the slice has UI, smoke:ui is green on the new scenarios.
CADOps scenarios are supporting evidence, not a substitute. If you cannot demonstrate it in the running app via smoke:ui, you are not done.
See docs/skills/close-a-slice.md and docs/skills/ui-smoke.md.

## Packages

- apps/web - browser UI
- packages/cad-protocol - command schemas and shared types
- packages/cad-core - document model, transactions, undo/redo
- packages/renderer - rendering abstraction and simple viewport
- packages/renderer-mesh-bridge - derived mesh adapter for the renderer
- packages/geometry-kernel - typed geometry facade
- packages/geometry-worker - async geometry worker boundary
- packages/occt-wasm - isolated OCCT/WASM integration
- packages/sketch-solver - pure TypeScript 2D sketch solver
- packages/agent-adapter - structured CADOps adapter for external callers
- packages/mcp-adapter - MCP tool wrapper over the agent adapter
- packages/mcp-stdio-server - local stdio JSON-RPC MCP transport
