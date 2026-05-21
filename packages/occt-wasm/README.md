# OCCT WASM Adapter

This package is an isolated OCCT/WASM adapter. It loads an Open
CASCADE-compatible WASM package, creates primitive shapes, runs OCCT
tessellation, and returns mesh-like typed arrays.

It is not imported by `packages/cad-core` or `packages/renderer`. Normal app
startup does not depend on this package. The web app can bundle it only through
the explicit geometry-worker smoke entrypoint.

## Dependency

- `opencascade.js@2.0.0-beta.b5ff984`
- License reported by npm package metadata: `LGPL-2.1-only`
- The package wraps Open CASCADE 7.6.2 according to its bundled README.

This adapter uses the direct OpenCascade.js wrapper instead of a higher-level
CAD DSL so the integration risk is visible at the kernel boundary.

## What The Adapter Does

The adapter currently exposes mesh creation for boxes, cylinders, spheres,
cones, tori, and an isolated rectangle-extrude boolean feasibility path:

1. Loads OpenCascade.js WASM.
2. Creates a primitive with `BRepPrimAPI_MakeBox`,
   `BRepPrimAPI_MakeCylinder`, `BRepPrimAPI_MakeSphere`,
   `BRepPrimAPI_MakeCone`, or `BRepPrimAPI_MakeTorus`.
3. Runs `BRepMesh_IncrementalMesh`.
4. Reads face triangulations with `BRep_Tool.Triangulation`.
5. Returns:
   - `Float32Array` positions
   - `Uint32Array` triangle indices
   - face, vertex, and triangle counts

For the default box, the current smoke test observes 6 faces, 24 per-face
vertices, and 12 triangles.

The boolean feasibility path builds source-derived rectangle extrude solids
with `BRepPrimAPI_MakeBox`, circle extrude solids with
`BRepPrimAPI_MakeCylinder`, combines supported pairs with `BRepAlgoAPI_Fuse` or
`BRepAlgoAPI_Cut`, tessellates the result, and returns only serializable mesh
data. The current isolated support covers rectangle add/cut and circle target
cut by rectangle tool. It intentionally does not expose OCCT shape handles,
topology maps, generated-reference updates, or authoritative document changes.
The circle-target feasibility slice has smoke coverage for extrusion sides,
base sketch planes, placement frames, non-overlap, full target removal, and
unsupported source-profile combinations.

## Setup

From the repo root:

```sh
pnpm install
pnpm --filter @web-cad/occt-wasm test
```

The root commands also include this package:

```sh
pnpm test
pnpm typecheck
pnpm build
```

## Browser Worker Bundle Path

The package now exposes two loaders:

- `@web-cad/occt-wasm` uses `opencascade.js/dist/node.js` for Node tests.
- `@web-cad/occt-wasm/browser` uses `opencascade.full.js` plus
  `opencascade.full.wasm?url` so Vite treats the WASM as a browser asset.

The browser path is proven by:

```sh
pnpm build:geometry-worker
```

and by opening `apps/web/geometry-worker-smoke.html` through Vite. The smoke page
starts the browser Worker, loads OCCT WASM, runs a primitive tessellation
request, and adapts the mesh into renderer data.

## Runtime And Bundle Risks

- The full beta OpenCascade.js package is large and should not be added to the
  production web app bundle without a custom build strategy.
- The current browser smoke emits a roughly 50 MB raw WASM asset. The smoke
  server now precompresses and serves that asset as Brotli when supported,
  currently about 11.19 MB served via `br`. A custom OpenCascade.js build is
  still needed for real binary shrinkage before this becomes production startup
  behavior.
- Multi-threaded OCCT/WASM would require worker setup and cross-origin isolation
  headers for `SharedArrayBuffer`.
- Embind objects need explicit `delete()` calls. A production wrapper should own
  lifecycle and cleanup rules instead of leaking raw OCCT handles across package
  boundaries.
- The current mesh is per-face triangulation data, not a renderer-ready shared
  vertex buffer with normals, topology references, or stable face IDs.
- Boolean results introduce additional risks that are not solved in this
  package: empty results, tolerance-sensitive failures, operation performance,
  topological naming, and invalidation of generated references after
  add/cut-style feature edits.

## Integration Concerns

- Keep OCCT behind a geometry-worker boundary. The command engine should remain
  authoritative for document state and should not import OCCT directly.
- Keep the current geometry-kernel facade as the production-facing shape. It
  accepts typed requests and returns serializable mesh/checkpoint data.
- Decide licensing policy before shipping OCCT in distributed builds. Open
  CASCADE and OpenCascade.js are LGPL-family dependencies, which is workable but
  requires deliberate compliance.
- Prefer a custom OpenCascade.js build before shipping to reduce API surface,
  download size, parse cost, and startup time.
