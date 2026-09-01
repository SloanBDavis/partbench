# Agent instructions

Partbench is an open-source, browser-native, AI-native CAD application.

CADOps in `cad-core` is the document authority. OCCT/WASM exact B-rep is the
geometry authority. Meshes, picks, and previews are derived display.

Do not invent a parallel architecture. Do not implement the whole architecture
at once.

- Architecture: [`docs/architecture.md`](docs/architecture.md)
- How we work: [`docs/how-we-work.md`](docs/how-we-work.md)
- Current user goal: [`docs/v23.md`](docs/v23.md). V23 is complete.

## Run the app

Node.js 22 and pnpm 10.

```sh
pnpm install
pnpm dev
```

A task is done when the current user goal is true in that running app. Tests
and named smokes are supporting evidence, not a substitute. If you cannot
demonstrate the user goal in `pnpm dev`, you are not done.

## Packages

- `apps/web` - browser UI
- `packages/cad-protocol` - command schemas and shared types
- `packages/cad-core` - document model, transactions, undo/redo
- `packages/renderer` - rendering abstraction and simple viewport
- `packages/renderer-mesh-bridge` - derived mesh adapter for the renderer
- `packages/geometry-kernel` - typed geometry facade
- `packages/geometry-worker` - async geometry worker boundary
- `packages/occt-wasm` - isolated OCCT/WASM integration
- `packages/sketch-solver` - pure TypeScript 2D sketch solver
- `packages/agent-adapter` - structured CADOps adapter for external callers
- `packages/mcp-adapter` - MCP tool wrapper over the agent adapter
- `packages/mcp-stdio-server` - local stdio JSON-RPC MCP transport
- `docs` - architecture and implementation docs

## Architecture rules

1. The command protocol is the center of the system.
2. Human UI, scripts, tests, and AI/MCP connectors must all use the same
   command layer.
3. The document model is authoritative. Rendered meshes are derived
   views/caches.
4. Do not couple the React UI directly to geometry internals.
5. Keep renderer, command engine, protocol, storage, and WASM geometry
   boundaries separate.
6. Do not expand OCCT/WASM, MCP, OPFS, STEP import/export, WebGPU, assemblies,
   hosted collaboration, or native storage beyond the requested release
   tranche.
7. Prefer small, testable packages over one large app.
8. Every implemented command must have tests.
9. Every command should produce a structured semantic diff.
10. Do not add production dependencies without explaining why.

Release history, compatibility matrices, and named smoke commands live in
[`docs/implementation-plan.md`](docs/implementation-plan.md) and the
per-release records it lists. They are not the daily loop.
