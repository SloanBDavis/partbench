# MVP

The first MVP is not a full CAD system. The first MVP proves the core architecture:

1. A browser app can create and display simple parametric CAD-like geometry.
2. All edits go through a typed command protocol.
3. Commands are transactional and return semantic diffs.
4. The renderer is separated from the document model.
5. The repo structure supports future WASM geometry, WebGPU rendering, MCP integration, OPFS storage, and STEP import/export.

## MVP Demo Target

The first meaningful demo should allow a user or script to:

1. Open the web app.
2. Create a box through a CADOps command.
3. Create a cylinder through a CADOps command.
4. View the objects in a 3D viewport.
5. Select an object.
6. Inspect its ID, type, transform, and dimensions.
7. Undo and redo the command.
8. Run tests for the command engine.

## Not In MVP

Do not implement these yet:

- Open CASCADE WASM
- STEP import/export
- Real B-rep topology
- Real sketch solver
- Real fillets/chamfers
- MCP server
- OPFS cache
- Full WebGPU renderer
- Large assembly LOD
- Collaboration
- Cloud storage

These are future milestones.