# Agent Instructions

## Project

This repository is building Partbench, an open-source, browser-native,
AI-native CAD application.

The long-term architecture is in:

- `docs/architecture.md`

The current implementation source of truth is:

- `docs/implementation-plan.md`
- `docs/v12.md` — completed V12 stable boolean topology and result references release record
- `docs/v13.md` — completed V13 general topology identity and B-rep checkpoint foundation release record
- `docs/v14.md` — completed V14 topology-backed downstream modeling release record
- `docs/v15.md` — completed V15 STEP import, expanded feature families, and parameter expressions release record
- `docs/v16.md` — completed V16 sweep, loft, pattern depth, expression extensions, and mass properties release record
- `docs/v17.md` — completed V17 composite sketch profiles, arcs, and curved sweep paths release record
- `docs/v18.md` — completed V18 frontend-only Precision CAD UI overhaul release record
- `docs/v19.md` — reviewed proposed V19 production sketching and multi-region profiles specification; not implemented

Do not attempt to build the entire architecture at once. Implement only the milestone requested by the user. V17 is complete; follow `docs/v16.md` and `docs/v17.md` as compatibility and support-matrix records. Do not weaken a completed V17 Must row or expand beyond its documented matrix without an explicitly approved later milestone.
The six `pnpm smoke:v17-*` commands recorded in `docs/v17.md` are the named V17 release workflows; V21 remains minimum-triggered rather than the default for every save.

V18 is complete. Follow `docs/v18.md` as its UI compatibility and performance
record. Its reference images define visual direction, not new CAD capability:
production changes stay in `apps/web`, and maintenance must not add commands,
queries, source records, geometry/renderer contracts, schemas, file formats, or
adapter behavior without an explicitly approved later milestone.

V19 is proposed, not implemented. `docs/v19.md` defines the reviewed planning
boundary for a future production-sketching and multi-region-profiles release.
Do not claim its commands, queries, consumer rows, named scripts, or planned
`web-cad.project.v22` schema as current behavior. V21 remains the latest
implemented project schema until an explicitly requested V19 implementation
slice lands with its complete vertical proof.

## Core Architectural Rules

1. The command protocol is the center of the system.
2. Human UI, scripts, tests, and future AI/MCP connectors must all use the same command layer.
3. The document model is authoritative. Rendered meshes are derived views/caches.
4. Do not couple the React UI directly to geometry internals.
5. Keep renderer, command engine, protocol, storage, and WASM geometry boundaries separate.
6. Do not expand OCCT/WASM, MCP, OPFS, STEP import/export, WebGPU, assemblies, hosted collaboration, or native storage beyond the requested release tranche.
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
- `packages/sketch-solver` — pure TypeScript 2D sketch solver
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
