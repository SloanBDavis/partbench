# OCCT/WASM Load-Size Investigation

Last updated: 2026-05-20.

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

The same boundary now contains an isolated boolean feasibility request for
source-derived extrude-like solids. That path proves OCCT can combine two
simple solids and return mesh data for rectangle add/cut plus circle target cut
by rectangle tool. The narrow rectangle-tool add/cut slices now use this
derived-geometry path where enabled, while `cad-core` still stores only source
feature intent and no B-rep/mesh result. Boolean result bodies still do not
provide generated-reference topology.

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

For the current box/cylinder/sphere/cone/torus tessellation path, the
custom-build candidate bindings should start from the symbols used by:

```text
BRepPrimAPI_MakeBox
BRepPrimAPI_MakeCylinder
BRepPrimAPI_MakeSphere
BRepPrimAPI_MakeCone
BRepPrimAPI_MakeTorus
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
box/cylinder/sphere/cone/torus smoke correctness
```

That experiment should stay behind the existing geometry-worker boundary until
it proves smaller, stable, and compatible with the current smoke path.

## V6 API Surface Watchlist

V6 is expected to exercise more of OCCT than V5. The current full
OpenCascade.js package is still acceptable for development while these paths are
being proven, but any future custom build experiment must account for the V6
modeling surface before it can replace the full package.

V6 candidate bindings include:

- exact metadata and mass properties:
  - shape bounds APIs such as `BRepBndLib`,
  - mass-property APIs such as `BRepGProp` / `GProp_GProps`,
  - unique topology counts through `TopExp.MapShapes_1` and
    `TopTools_IndexedMapOfShape`,
  - shape validity/checking APIs where available;
- revolve:
  - profile face construction,
  - axis construction,
  - revolve/make-revolution APIs;
- hole:
  - cylinder/tool construction,
  - cut APIs,
  - through-all depth calculation from exact or reliable derived bounds;
- chamfer and fillet:
  - edge lookup/traversal,
  - `BRepFilletAPI_MakeChamfer`,
  - `BRepFilletAPI_MakeFillet`,
  - failure/status inspection.

Do not shrink or swap the OCCT package during V6 feature implementation unless
that work is explicitly scoped. The safer path is to prove modeling behavior
against the full package first, then run a dedicated custom-build experiment
once the required symbol set is known.

## V6 Phase A Exact Metadata Findings

The installed full OpenCascade.js package exposes the exact metadata APIs needed
for the first V6 geometry-only boundary:

- `BRepBndLib.AddOptimal` with `Bnd_Box.CornerMin/CornerMax` for exact-kernel
  bounds;
- `BRepGProp.VolumeProperties_1` and `GProp_GProps.Mass/CentreOfMass` for
  volume and centroid;
- `BRepGProp.SurfaceProperties_1` and `GProp_GProps.Mass` for surface area;
- `TopExp.MapShapes_1` with `TopTools_IndexedMapOfShape` for unique solid,
  face, edge, and vertex counts.

`geometry.exactBodyMetadata` now uses these APIs for rectangle/circle extrude
sources and current narrow boolean-extrude sources. Results are derived
geometry metadata only. They are not persisted, do not change project schema,
and do not expose raw OCCT topology indexes as stable generated references.
If any required binding is missing at runtime, the geometry-kernel response uses
structured `UNAVAILABLE_BINDING` diagnostics instead of falling back to mesh
triangle measurements.

## V6 Phase B Revolve Findings

The installed full OpenCascade.js package exposes the bindings needed for the
first geometry-only revolve feasibility path:

- profile face construction through `BRepBuilderAPI_MakePolygon`,
  `BRepBuilderAPI_MakeEdge`, `BRepBuilderAPI_MakeWire`, and
  `BRepBuilderAPI_MakeFace`;
- sketch-plane axis construction through `gp_Pnt`, `gp_Dir`, `gp_Ax1`, and
  `gp_Ax2`;
- solid revolution through `BRepPrimAPI_MakeRevol`;
- mesh generation and extraction through the existing `BRepMesh_IncrementalMesh`
  and triangulation reader path.

`geometry.revolveProfile` now uses those APIs for rectangle and circle sketch
profiles revolved around a non-zero same-sketch line axis. Results are
serializable mesh data only. They are derived geometry, are not persisted, do
not change project schema, and do not expose raw OCCT topology indexes as stable
generated references. The geometry-kernel validation path rejects invalid
profiles, zero-length axes, and angles that are not positive finite values less
than or equal to 360 degrees before invoking OCCT. If a revolve factory is not
available, the response uses structured `UNAVAILABLE_BINDING` diagnostics.

The same revolve shape construction now feeds `geometry.exactBodyMetadata` for
authored rectangle/circle revolve sources. Exact revolve metadata uses the
existing OCCT bounds, mass-property, centroid, and topology-count bindings and
remains derived query/cache data only. If the revolve construction bindings are
not available, the geometry response reports structured `UNAVAILABLE_BINDING`
diagnostics rather than estimating metadata from tessellated mesh triangles.

## V6 Phase D Hole Findings

The installed full OpenCascade.js package exposes the bindings needed for the
first geometry-only circular hole feasibility path:

- target solid construction through the existing rectangle/circle extrude shape
  builders;
- circular tool construction through `BRepPrimAPI_MakeCylinder_3`;
- through-all depth estimation from target bounds through `BRepBndLib.AddOptimal`
  and `Bnd_Box`;
- boolean execution through `BRepAlgoAPI_Cut_3`;
- mesh generation and extraction through the existing
  `BRepMesh_IncrementalMesh_2` and triangulation reader path.

`geometry.hole` now uses those APIs for circular tools cutting current
source-derived rectangle and circle extrude targets. The request supports blind
depth and through-all depth when the target bounds can be projected along the
hole direction. Results are serializable mesh data only. They are derived
geometry, are not persisted, do not change project schema, and do not expose
raw OCCT topology indexes as stable generated references. The app derived
geometry layer can now request and render supported hole result meshes from
this path while keeping the source document in cad-core authoritative.

The same hole cut construction now feeds `geometry.exactBodyMetadata` for
supported authored hole result bodies. Exact hole metadata uses the existing
OCCT bounds, mass-property, centroid, and topology-count bindings after the
`BRepAlgoAPI_Cut` result is built. Results remain derived read-only cache/query
data: no B-rep checkpoint, mesh measurement fallback, project schema field, raw
OCCT topology ID, or generated reference for hole result bodies is introduced.
If required hole or exact metadata bindings are unavailable, the response uses
structured `UNAVAILABLE_BINDING` diagnostics.

The geometry-kernel validation path rejects invalid target/tool dimensions,
invalid depth modes, non-positive blind depths, and malformed placement frames
before invoking OCCT. Runtime placement failures, empty/full-removal results,
missing bindings, kernel failures, and invalid mesh results are returned as
structured diagnostics.

## Boolean Feasibility Risks

The extrude boolean path does not change the binary-size recommendation, but it
does make the OCCT API surface broader than primitive tessellation alone. The
current geometry-only feasibility coverage now includes:

- rectangle extrude add/fuse with rectangle extrude;
- rectangle extrude cut by rectangle extrude; and
- circle extrude target cut by rectangle extrude tool.

The circle-target cut worked through the same geometry-kernel/worker boundary
by constructing the target with `BRepPrimAPI_MakeCylinder` and the tool with
`BRepPrimAPI_MakeBox`, then using `BRepAlgoAPI_Cut`. The rectangle add/fuse
path uses `BRepAlgoAPI_Fuse` for the geometry-only feasibility mesh. Circle
target cut has been promoted into the narrow authoritative CADOps cut contract
for a rectangle tool cutting one active authored circle `newBody` target.
Rectangle add/fuse has been promoted into the authoritative command model and
derived-geometry/UI path for a rectangle tool fusing with one active authored
rectangle `newBody` target. Generated references for boolean result bodies and
broader boolean/topology behavior remain deliberately unsupported.

Current geometry-only support matrix:

| Operation | Target profile | Tool profile | Status |
| --------- | -------------- | ------------ | ------ |
| add       | rectangle      | rectangle    | Promoted for the narrow CADOps add slice |
| cut       | rectangle      | rectangle    | Promoted for the first narrow CADOps cut slice |
| cut       | circle         | rectangle    | Promoted for the narrow CADOps circle-target cut slice |
| add       | circle         | rectangle    | Unsupported |
| add/cut   | rectangle      | circle       | Unsupported |
| add/cut   | circle         | circle       | Unsupported |

Circle-target cut has focused coverage for:

- positive, negative, and symmetric extrusion sides;
- XY, XZ, and YZ sketch planes;
- placement-frame sources used by attached-sketch-style display;
- non-overlapping tools, which preserve the target mesh result;
- tool fully removing the target, which returns structured `EMPTY_RESULT`; and
- invalid mesh or invalid placement-frame failures through structured geometry
  errors.

Before expanding beyond the narrow rectangle-tool boolean slices in `cad-core`,
project still needs explicit handling for:

- topological naming and generated-reference invalidation after boolean edits;
- empty or invalid results, such as cutting away an entire target body;
- tolerance-sensitive failures and near-coplanar/intersecting solids;
- operation performance on real feature/body workloads;
- exact source/body checkpoint strategy if boolean results become persisted or
  replay-critical; and
- custom OCCT build symbol coverage for `BRepAlgoAPI_Fuse`,
  `BRepAlgoAPI_Cut`, `BRepPrimAPI_MakeBox`, `BRepPrimAPI_MakeCylinder`,
  tessellation, and shape traversal.
