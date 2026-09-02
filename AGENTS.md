# Agent instructions

Partbench is an open-source, browser-native, AI-native CAD application.

CADOps is the center. cad-core is the document authority (transactions, undo/redo, semantic diffs). OCCT/WASM is the geometry authority. Meshes, picks, and previews are derived display.

- How we work: [docs/how-we-work.md](docs/how-we-work.md)
- Proof / close loop: [docs/verification.md](docs/verification.md)
- Architecture: [docs/architecture.md](docs/architecture.md)
- Skills: [docs/skills/](docs/skills/)
- Last completed user goal: [docs/v25.md](docs/v25.md). V22, V23, V24, and V25 are complete. Do not reopen them. Do not invent V26. Next product work is a new user goal.

Do not open [docs/archive/](docs/archive/), docs/implementation-plan.md, or per-gate markdown unless the current user-goal doc names them.

Land on main as Sloan Davis <sloanbdavis@gmail.com>. Never open pull requests.

## Run the app

Node.js 22 and pnpm 10.

## Daily scripts

- pnpm dev / test / typecheck / lint / verify
- pnpm smoke:ui — Chromium engine gate (applyOps)
- pnpm smoke:ui-use — Chromium Use path (clicks)

Per-save: focused tests and typecheck of the packages you touched. No Chromium on every save.
Never rerun V7-V24 gauntlets. Proof: [docs/verification.md](docs/verification.md).

Completed closers: smoke:v25-part-toolkit, smoke:v24-finished-parts, smoke:v23-promotion-workflow.

## Slice close

Named closer + (if UI) `smoke:ui` engine and Use path green. CADOps scenarios are command truth. `applyOps` is not Use. See [docs/verification.md](docs/verification.md).

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
