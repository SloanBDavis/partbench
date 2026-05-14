# MVP Status

Status: complete.

The first MVP proved the core architecture. This document is now a completion
record, not the active forward target. The active product target is
`docs/v1.md`.

## Original MVP Target

The first MVP was not intended to be a full CAD system. It was intended to prove
that:

1. A browser app can create and display simple parametric CAD-like geometry.
2. All edits go through a typed command protocol.
3. Commands are transactional and return semantic diffs.
4. The renderer is separated from the document model.
5. The repo structure supports future WASM geometry, WebGPU rendering, MCP
   integration, OPFS storage, and STEP import/export.

## Completion Checklist

Completed:

- Open the web app.
- Create a box through a CADOps command.
- Create a cylinder through a CADOps command.
- View objects in a 3D viewport.
- Select an object.
- Inspect object ID, type, transform, and dimensions.
- Update transform through CADOps.
- Delete objects through CADOps.
- Undo and redo commands.
- Execute batches through CADOps.
- Dry-run and commit batches.
- Run tests for the command engine.
- Keep rendering separate from `cad-core`.

## Work Completed Beyond MVP

The repo now also includes scoped spikes and infrastructure that were originally
listed as post-MVP:

- Project JSON export/import for the current document model.
- CADOps query/read interface.
- Agent adapter over CADOps.
- Minimal MCP adapter and stdio JSON-RPC server.
- Browser command worker transport.
- Isolated OCCT/WASM spike.
- Geometry-kernel facade.
- Browser geometry worker entrypoint.
- Renderer mesh bridge.
- Feature-flagged OCCT mesh dev UI.
- Non-gating OCCT browser smoke/metrics command.

These additions remain bounded by the architecture rules:

- `cad-core` is still authoritative.
- OCCT is not in normal startup.
- Meshes are derived views.
- MCP wraps CADOps rather than defining the core architecture.

## Still Not Complete

The first MVP is complete, but the project is not yet a real CAD system.

Still not complete:

- Real B-rep topology in the document model.
- Stable topological naming.
- Sketch solver.
- Feature graph.
- Exact measurement API.
- Production mesh cache/invalidation.
- STEP import/export.
- OPFS or File System Access persistence.
- WebGPU renderer.
- Large-assembly instancing and LOD.
- Production MCP permissions/audit system.

## Why Keep This File

Keeping `docs/mvp.md` is useful because it marks the first architecture proof as
complete. Future planning should use:

- `docs/implementation-plan.md` for the current implementation roadmap.
- `docs/v1.md` for the next product target.
- `docs/architecture.md` for long-term architecture.
