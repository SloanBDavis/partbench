# OCCT WASM Spike

This package is an isolated Milestone 4 spike. It proves that the repo can load
an Open CASCADE-compatible WASM package, create one primitive shape, run OCCT
tessellation, and return mesh-like typed arrays.

It is not imported by `apps/web`, `packages/cad-core`, or `packages/renderer`.
Normal app startup does not depend on this package.

## Dependency

- `opencascade.js@2.0.0-beta.b5ff984`
- License reported by npm package metadata: `LGPL-2.1-only`
- The package wraps Open CASCADE 7.6.2 according to its bundled README.

This spike uses the direct OpenCascade.js wrapper instead of a higher-level CAD
DSL so the integration risk is visible at the kernel boundary.

## What The Spike Does

`createOcctBoxMeshSpike()`:

1. Loads OpenCascade.js WASM.
2. Creates a `BRepPrimAPI_MakeBox`.
3. Runs `BRepMesh_IncrementalMesh`.
4. Reads face triangulations with `BRep_Tool.Triangulation`.
5. Returns:
   - `Float32Array` positions
   - `Uint32Array` triangle indices
   - face, vertex, and triangle counts

For the default box, the current smoke test observes 6 faces, 24 per-face
vertices, and 12 triangles.

## Setup

From the repo root:

```sh
pnpm install
pnpm --filter @web-cad/occt-spike test
```

The root commands also include this package:

```sh
pnpm test
pnpm typecheck
pnpm build
```

## Runtime And Bundle Risks

- The full beta OpenCascade.js package is large and should not be added to the
  production web app bundle without a custom build strategy.
- The Node smoke path uses `opencascade.js/dist/node.js`; a browser integration
  will need explicit WASM asset handling through Vite or a worker bundle.
- Multi-threaded OCCT/WASM would require worker setup and cross-origin isolation
  headers for `SharedArrayBuffer`.
- Embind objects need explicit `delete()` calls. A production wrapper should own
  lifecycle and cleanup rules instead of leaking raw OCCT handles across package
  boundaries.
- The current mesh is per-face triangulation data, not a renderer-ready shared
  vertex buffer with normals, topology references, or stable face IDs.

## Integration Concerns

- Keep OCCT behind a geometry-worker boundary. The command engine should remain
  authoritative for document state and should not import OCCT directly.
- Add a small geometry-kernel facade before production use. It should accept
  typed requests and return serializable mesh/checkpoint data.
- Decide licensing policy before shipping OCCT in distributed builds. Open
  CASCADE and OpenCascade.js are LGPL-family dependencies, which is workable but
  requires deliberate compliance.
- Prefer a custom OpenCascade.js build before shipping to reduce API surface,
  download size, parse cost, and startup time.
