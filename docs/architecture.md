# Architecture

Partbench is a browser-native CAD application. This document names sticky
constraints only. It is not an implementation checklist and is not a source
for inventing a next release.

## Authorities

CADOps is the center. cad-core is the document authority. OCCT/WASM is the
geometry authority. Meshes, picks, and previews are derived display.

```text
Human UI ────────┐
Scripts / tests ─┼──> CADOps ──> cad-core document
MCP / agent ─────┘              OCCT/WASM exact B-rep
                                derived mesh / pick / preview
```

Do not invent a parallel architecture. Do not implement the whole
architecture at once.

These authorities do not move. Display code may cache; it may not author.

## Command and adapter boundaries

Human UI, scripts, tests, and AI/MCP connectors must all use the same
command layer.

MCP is an adapter over CADOps. It is not a second API. Do not add an MCP
tool unless a user-goal doc names it.

Approval modes stay `manualApproval` and `approveAll`. No third mode.

Universal selection is not universal commandability. An inspectable pick
is not automatically a command target.

React does not invent topology. The browser UI submits CADOps; cad-core
owns eligibility, transactions, and semantic diffs.

A batch is transactional. Dry-run and commit use the same ops. Every
committed command returns a structured semantic diff.

## Document and format

The native project format remains `web-cad.project.v22`. The native file
format remains `partbench.wcad.v2`. Do not add a schema or `.wcad`
version unless a user-goal doc says so.

The document model is authoritative. Rendered meshes are derived
views/caches.

Raw exact local IDs and signatures never enter commands, diffs, JSON,
`.wcad`, agents/MCP, or visible text. Durable identity is the public
topology-anchor ID after promotion.

Do not add a workspace package or production dependency unless a
user-goal doc says so.

## Geometry and display

OCCT/WASM owns exact B-rep. The current viewport is Canvas 2D.

Assemblies are allowed because [`docs/v26.md`](./v26.md) names them. Do not implement WebGPU or drawings unless a user-goal doc
says so.

Do not couple the React UI directly to geometry internals. Keep renderer,
command engine, protocol, storage, and WASM geometry boundaries separate.

Picks and previews are derived from exact geometry. They are display
evidence, not a second source of truth.

Selection, hover, and measurement submit no CADOps. Promotion is the
existing checkpoint plus anchor path, then the consuming feature op.

## Real packages

- apps/web — browser UI
- packages/cad-protocol — command schemas and shared types
- packages/cad-core — document model, transactions, undo/redo
- packages/renderer — rendering abstraction and simple viewport
- packages/renderer-mesh-bridge — derived mesh adapter for the renderer
- packages/geometry-kernel — typed geometry facade
- packages/geometry-worker — async geometry worker boundary
- packages/occt-wasm — isolated OCCT/WASM integration
- packages/sketch-solver — pure TypeScript 2D sketch solver
- packages/agent-adapter — structured CADOps adapter for external callers
- packages/mcp-adapter — MCP tool wrapper over the agent adapter
- packages/mcp-stdio-server — local stdio JSON-RPC MCP transport

## Invariants for changes

1. The command protocol is the center of the system.
2. Every implemented command has tests and a structured semantic diff.
3. Do not add a production dependency, workspace package, schema, or
   `.wcad` version unless a user-goal doc says so.
4. Do not expand OCCT/WASM, MCP, OPFS, STEP, WebGPU, hosted
   collaboration, or native storage beyond the requested release tranche.
5. Prefer small, testable packages over one large app.

Keep renderer, command engine, protocol, storage, and WASM geometry
boundaries separate. Do not couple the React UI to geometry internals.

Do not implement the whole architecture at once.

V22-V25 are complete. Current user goal is assemblies in [`docs/v26.md`](./v26.md). Do not invent V27. This document names sticky constraints only.
It is not a source for inventing a next release.
