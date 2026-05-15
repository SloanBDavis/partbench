# OCCT/WASM Load-Size Investigation

Last updated: 2026-05-15.

This note tracks the current OCCT/WASM load-size position and the near-term
recommendation. It does not change the production app architecture.

## Current Architecture Boundary

The OCCT path remains isolated:

- default production app startup does not load OCCT;
- local Vite serve enables the derived geometry path by default, but the worker
  still loads OCCT lazily only when tessellation is requested;
- `VITE_DISABLE_DERIVED_GEOMETRY=true pnpm dev` keeps local serve on primitive
  fallback for debugging;
- `cad-core` remains authoritative;
- meshes remain derived renderer data;
- the current app still falls back to primitive rendering.

## Baseline

The current dependency is `opencascade.js@2.0.0-beta.b5ff984`, using the full
browser asset:

```text
opencascade.js/dist/opencascade.full.wasm
```

Baseline smoke metrics before precompressed serving:

```text
raw WASM: 50.31 MB
gzip WASM: 13.96 MB
```

The full package is useful for development because it exposes broad OCCT API
surface. The OpenCascade.js docs explicitly describe the NPM full build as a
developer-focused starting point and state that WebAssembly cannot be tree-shaken
by normal JavaScript bundlers. They recommend custom builds for production:

- https://ocjs.org/docs/getting-started/file-size
- https://ocjs.org/docs/app-dev-workflow/workflow
- https://ocjs.org/docs/app-dev-workflow/custom-builds

## Implemented Low-Risk Improvement

The smoke pipeline now precompresses the generated OCCT WASM asset and serves it
with Brotli when the browser advertises support.

Current measured smoke metrics:

```text
raw WASM: 50.31 MB
gzip WASM: 13.96 MB
brotli WASM: 11.19 MB
served WASM: 11.19 MB via br
```

This reduces the measured delivered OCCT WASM payload by about 78% versus raw
serving and about 20% versus gzip, without changing the OCCT package, worker
boundary, command engine, renderer, or default production startup behavior.

The smoke record now includes:

```text
occtWasmBytes
occtWasmGzipBytes
occtWasmBrotliBytes
occtWasmBrotliQuality
occtWasmServedBytes
occtWasmServedEncoding
```

Timing metrics remain non-gating.

## Options Investigated

### Lazy Loading

Status: already in the right shape.

OCCT is imported only through the derived-geometry runtime and browser geometry
worker path. Production startup remains independent from OCCT by default. In
local Vite serve, the runtime path is enabled by default, but the worker and WASM
load remain lazy and occur only when a supported object needs tessellation.

### Hosting And Caching

Status: low-risk improvement implemented for the smoke path.

Production hosting should serve the WASM with long-lived immutable cache headers
and Brotli or gzip precompression. The smoke server now proves Brotli delivery
for the same generated Vite asset.

### Smaller Prebuilt Package

Status: no smaller prebuilt variant exists in the installed package.

The installed package only contains `opencascade.full.js` and
`opencascade.full.wasm`. There is no alternate smaller prebuilt WASM in the
current dependency.

### Custom OpenCascade.js Build

Status: recommended next step for real binary shrinkage.

The OpenCascade.js docs describe YAML-defined custom builds through the project
Docker image. A custom build lets us expose only the bindings required by the app
and choose compiler flags such as `-O3` and exception settings. The docs note
that disabling exception catching can greatly reduce size for full builds.

For the current box/cylinder tessellation path, the custom-build candidate
bindings should start from the symbols used by:

```text
BRepPrimAPI_MakeBox
BRepPrimAPI_MakeCylinder
BRepMesh_IncrementalMesh
TopExp_Explorer
TopoDS
Poly_Triangulation
TopLoc_Location
```

The exact symbol list should be validated by building in a separate experiment,
not by changing the production app path.

## Recommendation

Keep the Brotli smoke/hosting improvement. It is immediate, measurable, and
low-risk.

Do not spend more app-layer effort trying to shrink `opencascade.full.wasm`.
Tree-shaking cannot remove unused WebAssembly code from this full binary. The
next meaningful size reduction should be a dedicated custom OpenCascade.js build
experiment that produces a smaller JS/WASM pair for the current primitive
tessellation API, then compares:

```text
raw bytes
gzip bytes
brotli bytes
OCCT load time
tessellation time
worker round-trip time
box/cylinder smoke correctness
```

That experiment should stay behind the existing geometry-worker boundary until
it proves smaller, stable, and compatible with the current smoke path.
