# Geometry Kernel Facade

This package is the typed boundary in front of the isolated OCCT WASM adapter. It is
not imported by `packages/cad-core` or `packages/renderer`.

The goal is to make the future geometry worker contract explicit without moving
document authority out of `cad-core` and without making normal app startup load
Open CASCADE.

## Boundary

Input:

- `GeometryKernelRequest`
- Currently supports `geometry.tessellateBox`,
  `geometry.tessellateCylinder`, `geometry.tessellateSphere`,
  `geometry.tessellateCone`, and `geometry.tessellateTorus`
- Includes dimensions and optional tessellation settings

Output:

- `GeometryKernelResponse`
- Success returns structured mesh data:
  - `Float32Array` positions
  - `Uint32Array` triangle indices
  - face, vertex, and triangle counts
- Failure returns a structured error code and message

Typed arrays are structured-clone compatible, so this response shape can cross a
browser Worker boundary. `getGeometryResponseTransferables()` exposes the mesh
buffers that a later Worker transport can transfer instead of clone.

## Worker Integration

The intended production flow is:

```text
apps/web main thread
  -> browser geometry worker
  -> @web-cad/geometry-kernel request
  -> OCCT-backed implementation
  -> serializable mesh response
  -> renderer bridge
```

`cad-core` remains authoritative for documents, commands, transactions, undo,
redo, and semantic diffs. Geometry output is a derived cache/view and should be
rebuildable from the document and command history.

## Browser And Node Entrypoints

- `@web-cad/geometry-kernel` calls the Node-oriented OCCT loader for package
  tests.
- `@web-cad/geometry-kernel/browser` calls the browser OCCT loader for Vite
  Worker bundles.

The two entrypoints share the same request validation, response shape, and
transferable buffer handling. Neither entrypoint changes document authority or
replaces the current primitive renderer.
