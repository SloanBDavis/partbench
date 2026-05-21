# Agent Instructions

## Project

This repository is building Partbench, an open-source, browser-native,
AI-native CAD application.

The long-term architecture is in:

- `docs/architecture.md`

The current implementation source of truth is:

- `docs/implementation-plan.md`
- `docs/v1.md` — completed V1 baseline
- `docs/v2.md` — active next target

Do not attempt to build the entire architecture at once. Implement only the milestone requested by the user.

## Core Architectural Rules

1. The command protocol is the center of the system.
2. Human UI, scripts, tests, and future AI/MCP connectors must all use the same command layer.
3. The document model is authoritative. Rendered meshes are derived views/caches.
4. Do not couple the React UI directly to geometry internals.
5. Keep renderer, command engine, protocol, storage, and WASM geometry boundaries separate.
6. Do not introduce Open CASCADE, WASM, MCP, OPFS, STEP import/export, or WebGPU until the requested milestone calls for it.
7. Prefer small, testable packages over one large app.
8. Every implemented command must have tests.
9. Every command should produce a structured semantic diff.
10. Do not add production dependencies without explaining why.

## Expected Repo Shape

The repo has grown beyond the initial four-package foundation. Keep this shape
unless the user instructs otherwise:

- `apps/web` — browser UI
- `packages/cad-protocol` — command schemas and shared types
- `packages/cad-core` — document model, transactions, undo/redo
- `packages/renderer` — rendering abstraction and simple viewport implementation
- `packages/renderer-mesh-bridge` — derived mesh adapter for the renderer
- `packages/geometry-kernel` — typed geometry facade
- `packages/geometry-worker` — async geometry worker boundary
- `packages/occt-wasm` — isolated OCCT/WASM integration
- `packages/agent-adapter` — structured CADOps adapter for external callers
- `packages/mcp-adapter` — MCP tool wrapper over the agent adapter
- `packages/mcp-stdio-server` — local stdio JSON-RPC MCP transport
- `docs` — architecture and implementation docs

## Engineering Preferences

- Use TypeScript.
- Prefer pnpm workspaces.
- Prefer Vite for the web app.
- Prefer Vitest for unit tests.
- Keep public APIs typed and documented.
- Keep package boundaries clean.
- Avoid premature optimization.
- Avoid implementing future milestones early.

## Definition of Done

A task is done only when:

1. The requested milestone or feature is implemented.
2. Relevant tests are added.
3. Tests pass.
4. The code is typed.
5. The implementation follows the architecture docs.
6. The final response explains what changed, how to run it, and any known limitations.

## Planning Rule

For large or ambiguous tasks, first produce a plan and wait for approval unless the user explicitly asks for implementation immediately.
