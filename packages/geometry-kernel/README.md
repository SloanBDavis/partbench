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
  `geometry.tessellateCone`, `geometry.tessellateTorus`,
  `geometry.tessellateExtrude`, and the isolated feasibility request
  `geometry.booleanExtrudes`, plus the V6 feasibility request `geometry.hole`
- Includes dimensions/source profiles and optional tessellation settings

Output:

- `GeometryKernelResponse`
- Success returns structured mesh data:
  - `Float32Array` positions
  - `Uint32Array` triangle indices
  - face, vertex, and triangle counts
- Failure returns a structured error code and message

`geometry.booleanExtrudes` is intentionally geometry-only. It accepts two
source-derived rectangle/circle extrude inputs plus `operation: "add" | "cut"`.
The current OCCT-backed implementation supports rectangle extrude add,
rectangle extrude cut, and the next feasibility case: a circle target cut by a
rectangle tool. It returns mesh data for feasibility tests, not document
mutations, topology maps, stable generated references, or project source data.
The circle-target cut feasibility path is covered for positive, negative, and
symmetric sides; XY, XZ, and YZ sketch planes; placement-frame inputs;
non-overlapping tools; fully removed targets; and unsupported profile
combinations.

`geometry.hole` is also intentionally geometry-only. It accepts a
source-derived rectangle/circle extrude target plus a circular sketch tool with
blind or through-all depth intent. It returns mesh data for feasibility tests,
not document mutations, topology maps, stable generated references, or project
source data.

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
