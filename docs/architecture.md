# Architecture

This document describes the long-term architecture for Partbench, an
open-source, browser-native, AI-native CAD application.

This is not an implementation checklist. Codex should use this as architectural context and should not attempt to implement the entire system at once.

The current implementation source of truth is:

- `docs/implementation-plan.md`
- `docs/v4.md`
- `docs/v5.md`
- `AGENTS.md`

When architecture and implementation-plan conflict, follow the implementation plan for the current milestone.

The short version of the architecture is:

```text
Human UI ───────┐
                │
AI / MCP / SDK ─┼──> Versioned CAD Command API ──> Parametric document graph
                │                                  Exact B-rep geometry kernel
Automation CLI ─┘                                  Constraint solver
                                                   Tessellation + cache
                                                   WebGPU viewport
                                                   OPFS / local files / hosted storage
```

The biggest design decision: do not make “AI support” a chat feature. Make the CAD model itself agent-legible and agent-editable.

## 1. Recommended technology stack

Use TypeScript for the app shell, protocol, UI, and orchestration. Use WebAssembly for the exact CAD kernel and heavy compute. Use WebGPU for rendering. Use a tiny local host process only for packaging, headers, local MCP transport, and launching the browser.

My recommended stack:

| Layer           | Recommendation                                                                         | Reason                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI              | TypeScript, React, Vite                                                                | React is fine for panels, property inspectors, command palettes, history trees, and dialogs. Do not use React for the 3D scene graph.                                                                                                                                                                                                                                                                           |
| Rendering       | Custom WebGPU renderer, with three.js only as an optional prototyping/debug layer      | WebGPU is the correct target for Chrome-first high-performance CAD. three.js now has a WebGPU renderer that uses WebGPU when available and can fall back to WebGL 2, but large-assembly CAD will eventually need tighter control over buffers, culling, picking, instancing, and LOD than a generic scene library gives you. ([Three.js][1])                                                                    |
| Geometry kernel | Open CASCADE Technology compiled to WebAssembly                                        | Do not attempt to write a production B-rep kernel from scratch. OCCT gives you exact geometry, STEP/IGES support, booleans, fillets, sewing/healing tools, mass properties, tessellation, and established CAD interoperability. OCCT’s data exchange module supports STEP AP203/AP214/AP242, IGES, glTF 2.0, OBJ, VRML, STL, and XDE metadata such as colors, layers, names, and materials. ([Open CASCADE][2]) |
| WASM threading  | Emscripten pthreads, workers, SharedArrayBuffer                                        | Geometry and tessellation must not block the UI thread. Emscripten supports pthreads via SharedArrayBuffer and Web Workers; SharedArrayBuffer requires secure context plus cross-origin isolation, so the app must be served with the right headers. ([Emscripten][3])                                                                                                                                          |
| Storage         | OPFS for internal cache; File System Access API for user-visible open/save             | OPFS is good for large private browser-side caches and in-place writes from workers. Chrome’s File System Access API lets web apps read and save directly to user-selected local files and directories. ([MDN Web Docs][4])                                                                                                                                                                                     |
| AI connector    | MCP adapter plus first-party SDK/CLI                                                   | MCP exposes tools, resources, and prompts, and its standard transports include stdio and Streamable HTTP. Use MCP for agent ecosystems, but keep the real internal API as your own compact CAD command protocol. ([Model Context Protocol][5])                                                                                                                                                                  |
| Local package   | Small Rust or Go launcher that serves the same static web bundle on localhost          | This gives the “download and it opens in Chrome” experience while still allowing WASM, workers, cross-origin isolation, service workers, and MCP. Localhost is treated as a potentially trustworthy origin by browsers, which is useful for powerful web APIs. ([MDN Web Docs][6])                                                                                                                              |
| Hosted package  | Same static web bundle behind Caddy/Nginx/CDN, plus optional collaboration/MCP gateway | The hosted version should serve the same files with the same headers. No second app.                                                                                                                                                                                                                                                                                                                            |

Open CASCADE is governed by LGPL 2.1 with an additional exception, so it is a practical open-source CAD kernel choice, but the project should still make an explicit license decision early. ([Open CASCADE][7])

For the sketch solver, I would not immediately import SolveSpace unless you are comfortable with GPL-3.0 implications. SolveSpace is GPL-3.0 licensed. ([GitHub][8]) I would instead start with a small custom 2D constraint solver in Rust or C++ compiled to WASM, then decide later whether to adopt or interoperate with an existing solver.

## 2. Core design principle: exact model first, mesh second

The authoritative model should not be triangles. It should be a parametric CAD document containing sketches, constraints, features, bodies, assemblies, mates, materials, metadata, named references, and command history.

The rendered mesh is only a cache.

Every part should have at least three representations:

```text
Design representation:
  feature graph, sketches, constraints, dimensions, named references

Exact geometry representation:
  B-rep bodies from OCCT

Display representation:
  tessellated LOD meshes, edge curves, BVHs, GPU buffers
```

Measurements, constraints, exports, mass properties, face references, and AI operations should use the exact geometry or semantic model. The viewport uses progressively generated meshes.

This separation is crucial. It lets the app render huge assemblies cheaply while preserving exact CAD behavior.

## 3. Internal project format

Create a native open format, maybe `.wcad`, `.aicad`, or `.cadx`. It should be a documented package format, not a mystery binary blob.

I would make it a ZIP-like package or content-addressed directory:

```text
project.wcad/
  manifest.json
  document.cbor
  commands.cbor
  assemblies/
  parts/
  brep/
  meshes/
  drawings/
  thumbnails/
  ai-summaries/
  metadata/
```

The source of truth should be:

```text
manifest.json
document.cbor
commands.cbor
brep checkpoints
```

Meshes are cache artifacts and may be regenerated.

Use CBOR or FlatBuffers for compact internal data. JSON is fine for debugging and MCP, but internal project storage should not depend on huge JSON documents.

The project format should store:

```ts
Project {
  schemaVersion: string
  kernelVersion: string
  units: "mm" | "cm" | "m" | "in"
  rootAssemblyId: AssemblyId
  parts: Part[]
  assemblies: Assembly[]
  materials: Material[]
  namedViews: ViewState[]
  commandLog: CommandEvent[]
  checkpoints: GeometryCheckpoint[]
}
```

The command log matters because it gives you undo/redo, deterministic rebuilds, AI auditability, branching, macro recording, and collaboration foundations.

## 4. Parametric document model

The app should support both parametric history and direct modeling, but direct modeling operations should still be recorded as explicit features.

Example feature graph:

```ts
Part {
  id: PartId
  name: string
  origin: CoordinateSystem
  sketches: Sketch[]
  features: Feature[]
  bodies: BodyRef[]
  parameters: Parameter[]
}

Feature =
  | ExtrudeFeature
  | RevolveFeature
  | SweepFeature
  | LoftFeature
  | FilletFeature
  | ChamferFeature
  | ShellFeature
  | PatternFeature
  | MirrorFeature
  | BooleanFeature
  | DirectEditFeature
  | ImportedBodyFeature
```

Assemblies should be reference-based:

```ts
PartDefinition {
  id: PartId
  shapeId: ShapeId
  meshCacheKeys: MeshCacheKey[]
}

AssemblyInstance {
  id: InstanceId
  definitionId: PartId | AssemblyId
  transform: Matrix4
  materialOverrides?: MaterialOverride[]
  metadata?: Record<string, unknown>
}
```

This enables massive performance wins because 10,000 bolts should be one part definition and 10,000 transforms, not 10,000 duplicated meshes.

## 5. Solve the topological naming problem early

This is one of the most important CAD-specific issues. AI agents will be useless if faces and edges randomly change IDs after a fillet or boolean.

Do not rely on “face index 17.”

Each generated entity needs a stable semantic reference:

```ts
EntityRef {
  kind: "face" | "edge" | "vertex" | "body" | "sketch" | "feature"
  stableId: string
  ownerPart: PartId
  createdByFeature: FeatureId
  role?: string
  lineage?: EntityRef[]
  geometricSignature?: {
    surfaceType?: "plane" | "cylinder" | "cone" | "sphere" | "nurbs"
    normal?: Vec3
    axis?: Vec3
    area?: number
    center?: Vec3
    adjacentEntityHints?: string[]
  }
}
```

Agents and humans should also be able to name references:

```text
face:mounting_plate_top
axis:left_hinge_pin
sketch:base_profile
plane:gear_midplane
```

When geometry changes, the system should use a combination of feature lineage, generated/modified/deleted maps from the kernel operation, and geometric signatures to preserve identity. When ambiguity remains, the command should fail with a clear diagnostic instead of silently editing the wrong face.

This should be treated as a first-class subsystem, not a later cleanup.

## 6. AI-native command layer

The AI interface should be a compact, deterministic CAD operation protocol. MCP should wrap this protocol; MCP should not define the internal architecture.

Call the internal protocol `CADOps`.

Design goals:

1. Every operation is typed.
2. Every operation is transactional.
3. Every operation can run in dry-run mode.
4. Every operation returns semantic diffs, not giant model dumps.
5. Every object has stable IDs and optional human-readable names.
6. Agents can query the model structurally instead of visually guessing.
7. Agents can inspect exact measurements without parsing meshes.

Example batch command:

```json
{
  "version": "cadops.v1",
  "mode": "dryRun",
  "ops": [
    {
      "op": "sketch.create",
      "id": "sk_base",
      "plane": "XY",
      "name": "base_plate_profile"
    },
    {
      "op": "sketch.rectangle",
      "sketch": "sk_base",
      "center": [0, 0],
      "size": [120, 80],
      "name": "base_plate_rect"
    },
    {
      "op": "feature.extrude",
      "id": "feat_base",
      "profile": "sk_base:base_plate_rect",
      "distance": 10,
      "operation": "newBody",
      "name": "base_plate"
    },
    {
      "op": "feature.holePattern",
      "target": "body:base_plate",
      "face": "face:base_plate_top",
      "holeDiameter": 6,
      "positions": [[-45, -25], [45, -25], [-45, 25], [45, 25]]
    }
  ]
}
```

Dry-run response:

```json
{
  "ok": true,
  "mode": "dryRun",
  "summary": "Creates one extruded base plate with four through holes.",
  "created": [
    {"id": "sk_base", "kind": "sketch"},
    {"id": "feat_base", "kind": "feature"},
    {"id": "body:base_plate", "kind": "body"}
  ],
  "modified": [],
  "warnings": [],
  "estimatedBoundingBox": {
    "min": [-60, -40, 0],
    "max": [60, 40, 10]
  }
}
```

Commit response:

```json
{
  "ok": true,
  "transactionId": "txn_018f...",
  "patch": {
    "created": ["sk_base", "feat_base", "body:base_plate"],
    "modified": [],
    "deleted": []
  },
  "viewHint": {
    "focus": "body:base_plate"
  }
}
```

This gives agents exactly what they need without flooding the context window.

## 7. MCP design

Expose MCP as an adapter over `CADOps`.

MCP resources:

```text
cad://project/current/summary
cad://project/current/tree
cad://project/current/selection
cad://project/current/parameters
cad://project/current/schema/cadops.v1
cad://part/{partId}/summary
cad://assembly/{assemblyId}/summary
cad://view/{viewId}/screenshot
cad://diff/{transactionId}
```

MCP tools:

```text
cad.project_summary
cad.query
cad.batch
cad.measure
cad.validate
cad.preview
cad.commit_preview
cad.export
cad.import
cad.get_selection
cad.set_selection
cad.create_named_reference
cad.render_view
```

The most important tool is `cad.batch`. Do not expose hundreds of tiny MCP tools like `create_line`, `create_arc`, `set_dimension`, `extrude`, `fillet`, etc. That becomes token-expensive and brittle. Use one high-level batch tool with a compact operation schema.

Example MCP `cad.query`:

```json
{
  "selector": "part[name~='bracket'] face[surface='cylinder'][radius=5mm]",
  "fields": ["id", "center", "axis", "radius", "ownerFeature"],
  "limit": 20
}
```

Example response:

```json
{
  "matches": [
    {
      "id": "face:left_mounting_hole_wall",
      "center": [20, 0, 15],
      "axis": [0, 0, 1],
      "radius": 5,
      "ownerFeature": "feat_mounting_holes"
    }
  ]
}
```

Agents should interact through selectors, stable references, measurements, and diffs. They should almost never receive full tessellated meshes.

For local use, the downloaded launcher can expose an MCP stdio or Streamable HTTP endpoint on localhost. The browser app connects to the launcher through WebSocket. For hosted use, the same MCP adapter runs as a server-side gateway. Same protocol, same tools, same command engine.

## 8. Human UI design

The UI should be easy for humans because the model is structured well for agents.

Recommended layout:

```text
┌────────────────────────────────────────────────────────┐
│ Top toolbar: sketch, feature, assembly, inspect, export │
├──────────────┬────────────────────────────┬────────────┤
│ Model tree   │                            │ Inspector  │
│ Feature tree │        WebGPU canvas       │ Parameters │
│ Assemblies   │                            │ Constraints│
├──────────────┴────────────────────────────┴────────────┤
│ Command palette / timeline / agent activity / errors   │
└────────────────────────────────────────────────────────┘
```

Human-first features:

The command palette should understand every operation. A user should be able to type “extrude,” “fillet,” “measure,” “export STEP,” or “show hidden parts,” and get the correct command.

The feature tree should be clean and reversible. Agent actions should appear as grouped transactions, for example “Agent: created motor mounting bracket,” with a diff and rollback button.

Sketching should have strong inference: horizontal, vertical, coincident, midpoint, tangent, concentric, equal, parallel, perpendicular. Human users should not need to micromanage constraints.

Selection should be typed. When a user clicks a face, the inspector should show that it is a planar face, owned by a feature, with area, normal, adjacent edges, material, name, and stable ID. This is also what agents need.

The agent panel should not be a generic chatbot as the primary interface. It should show proposed operations, previews, diffs, validation errors, and approval state.

## 9. Rendering architecture for very large assemblies

The rendering architecture should assume that assemblies can contain far more geometry than the viewport can draw at high resolution.

The renderer should never ask, “What are all triangles in this assembly?” It should ask:

```text
What is visible?
What is large enough on screen to matter?
What is selected or being edited?
What has an available cached LOD?
What needs to be refined after camera movement stops?
```

Use a hierarchical scene structure:

```ts
RenderScene {
  root: RenderNode
  partDefinitions: Map<PartId, RenderPartDefinition>
  instances: InstanceBuffer
  materials: MaterialBuffer
  gpuMeshes: MeshBufferPool
}

RenderNode {
  id: string
  aabb: AABB
  children: RenderNode[]
  instances: InstanceId[]
  visibilityMask: number
}
```

For every part definition, cache multiple tessellation levels:

```text
LOD 0: bounding box or impostor
LOD 1: very coarse mesh
LOD 2: medium mesh
LOD 3: fine mesh
LOD 4: selected/editing mesh
```

Choose LOD using screen-space error. A tiny bolt in the distance should not get the same triangle budget as a selected filleted bracket in the foreground.

Viewport pipeline:

```text
1. Camera changes.
2. Traverse assembly BVH.
3. Frustum cull.
4. Estimate screen-space size per node.
5. Choose LOD.
6. Apply occlusion culling where useful.
7. Build visible instance list.
8. Sort/batch by mesh and material.
9. Upload/update compact GPU instance buffers.
10. Render opaque pass.
11. Render edge/curve overlay.
12. Render selected/highlighted entities.
13. Render low-resolution ID buffer for picking.
14. Refine visible LODs after camera idle.
```

Important performance decisions:

Use instancing aggressively. Repeated parts, fasteners, bearings, holes, and imported subassemblies should reuse one mesh with many transforms.

Use a GPU memory budget. Do not keep every tessellation level of every part on the GPU. Keep visible and recently visible buffers. Evict with LRU.

Use progressive tessellation. On import, create bounding boxes and coarse meshes first. Fine meshes are generated on demand in workers.

Use interaction mode. While the camera is moving, lower quality temporarily: fewer edges, coarser LOD, fewer transparency passes, lower picking resolution. After the camera stops, refine.

Use exact edge curves separately from shaded meshes. CAD readability often comes from crisp edges, not huge triangle counts.

Use multi-stage picking. First render an ID buffer to identify the object or face candidate, then perform exact ray/B-rep or BVH intersection in a worker for precise selection.

Use assembly-level occlusion. Do not test every screw individually if an entire subassembly’s bounding volume is hidden.

## 10. Geometry and tessellation workers

The UI thread should never run heavy geometry operations.

Use workers like this:

```text
Main thread:
  UI, input, command scheduling, lightweight state

Render worker or main render loop:
  WebGPU device, frame scheduling, GPU buffers

Geometry worker pool:
  OCCT operations, booleans, fillets, imports, exports, tessellation

Sketch solver worker:
  Constraint solving, degrees-of-freedom analysis

Storage worker:
  OPFS cache reads/writes, package import/export
```

The geometry worker API should look like:

```ts
type GeometryRequest =
  | { type: "buildFeature"; partId: string; featureId: string }
  | { type: "tessellate"; shapeId: string; lod: LODSpec }
  | { type: "importStep"; fileRef: FileRef }
  | { type: "exportStep"; scope: ScopeRef }
  | { type: "measure"; refs: EntityRef[] }
  | { type: "raycastExact"; ray: Ray; candidates: EntityRef[] }
```

Responses should return handles and cache keys, not huge JS object graphs when avoidable.

```ts
type GeometryResponse =
  | { ok: true; shapeId: string; modifiedEntities: EntityDiff[] }
  | { ok: true; meshId: string; vertexBufferRef: BufferRef; indexBufferRef: BufferRef }
  | { ok: false; error: GeometryError }
```

## 11. File format support

Phase 1 should support:

| Format                   | Import | Export | Purpose                                  |
| ------------------------ | -----: | -----: | ---------------------------------------- |
| Native `.wcad` / `.cadx` |    yes |    yes | Source-of-truth project format           |
| STEP AP203/AP214/AP242   |    yes |    yes | Main exact CAD interchange               |
| IGES                     |    yes |    yes | Legacy exact CAD interchange             |
| OCCT BREP/XBF            |    yes |    yes | Internal/checkpoint/debug exact geometry |
| STL                      |    yes |    yes | 3D printing and mesh interchange         |
| OBJ                      |    yes |    yes | Mesh interchange                         |
| glTF/GLB                 |    yes |    yes | Web visualization and sharing            |
| SVG                      |    yes |    yes | Sketches, drawings, simple 2D export     |
| DXF                      |    yes |    yes | 2D CAD/sketch/drawing interchange        |

glTF/GLB should be treated as a visualization/export format, not as the exact CAD source of truth. Khronos describes glTF as a runtime 3D asset delivery format, and glTF 2.0 is standardized as ISO/IEC 12113:2022. ([The Khronos Group][9])

Phase 2:

```text
3MF
IFC
PDF drawings
PMI/GD&T metadata where possible
```

Proprietary formats should be explicitly non-core unless licensed translators are added:

```text
SolidWorks SLDPRT/SLDASM
CATIA
NX
Creo
Inventor
Parasolid x_t/x_b
ACIS SAT/SAB
DWG
```

For an open-source project, promising high-quality native import/export for those proprietary formats early would be risky. Support STEP extremely well first.

## 12. Local-first and hosted packaging

The same app should run in both modes:

```text
Local mode:
  user downloads app
  tiny launcher starts localhost server
  browser opens http://127.0.0.1:<port>
  same web bundle runs
  files are opened/saved with File System Access API
  caches live in OPFS
  MCP is exposed by local launcher

Hosted mode:
  same web bundle served on domain
  same headers
  same OPFS cache
  optional cloud project storage
  optional hosted MCP gateway
  optional collaboration server
```

Do not make `file://index.html` the primary packaging strategy. You will want service workers, WASM MIME types, cross-origin isolation headers, worker loading, SharedArrayBuffer, and local MCP transport. A localhost server is cleaner and still satisfies “download and it opens in the browser.”

The local server must set headers like:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
Content-Type: application/wasm for .wasm files
```

The hosted server must set the same headers. This keeps the local and hosted paths aligned.

## 13. Suggested repository structure

```text
repo/
  apps/
    web/                  # Browser UI
    launcher/             # Small local host process
    mcp-gateway/          # Hosted/local MCP adapter
    cli/                  # Optional automation CLI

  packages/
    cad-protocol/         # CADOps schemas, selectors, validators
    cad-core/             # Document graph, command engine, transactions
    cad-wasm/             # OCCT WASM bindings
    sketch-solver/        # 2D constraint solver
    renderer-webgpu/      # WebGPU CAD renderer
    storage/              # OPFS, package format, local save/load
    import-export/        # Format orchestration
    ui-kit/               # Panels, inspectors, command palette
    mcp-tools/            # MCP tool definitions over cad-protocol
    test-models/          # Benchmark and regression models

  infra/
    docker/
    caddy/
    nginx/
    benchmarks/

  docs/
    architecture.md
    cadops-schema.md
    native-format.md
    mcp.md
    performance.md
```

## 14. Command/event architecture

All edits should flow through transactions:

```ts
interface Transaction {
  id: TransactionId
  actor: "human" | "agent" | "script"
  actorId?: string
  startedAt: string
  ops: CadOp[]
  status: "preview" | "committed" | "reverted"
  beforeCheckpoint?: CheckpointId
  afterCheckpoint?: CheckpointId
  diff: ModelDiff
}
```

The command engine should support:

```text
preview
commit
rollback
undo
redo
squash
branch
replay
validate
```

This makes AI integration much safer. An agent should be able to propose a batch, get a preview, run validation, then commit only if allowed.

## 15. Validation system

CAD operations should be validated continuously.

Validation checks:

```text
geometry validity
self-intersections
non-manifold edges
zero-thickness geometry
failed fillets/chamfers
unresolved sketch constraints
over-constrained sketches
dangling entity references
broken assembly mates
unit mismatches
export compatibility
minimum wall thickness, if configured
collision/interference, if configured
```

Validation output should be both human-readable and machine-readable:

```json
{
  "severity": "error",
  "code": "FILLET_FAILED_ON_EDGE",
  "message": "The 8 mm fillet failed on edge:left_inner_corner because the adjacent face is too small.",
  "refs": ["edge:left_inner_corner", "feature:fillet_mount"],
  "suggestions": [
    {
      "op": "feature.update",
      "feature": "feature:fillet_mount",
      "params": {"radius": 4}
    }
  ]
}
```

That structure is extremely useful for agents.

## 16. Sketch solver design

Start with a 2D parametric sketch solver.

Supported primitives:

```text
point
line
circle
arc
ellipse, later
spline, later
construction geometry
```

Supported constraints:

```text
coincident
horizontal
vertical
parallel
perpendicular
tangent
concentric
equal length
equal radius
distance
angle
midpoint
symmetry
fix
```

Implementation:

```text
Variables:
  point coordinates, radii, angles, curve params

Constraints:
  residual functions

Solver:
  damped least squares / Levenberg-Marquardt

Diagnostics:
  degrees of freedom
  under-constrained entities
  conflicting constraints
  redundant constraints
```

This gives both humans and agents a predictable way to define design intent.

## 17. Assembly mates

Assembly mates should be expressed as constraints between frames, axes, planes, and surfaces.

Start with:

```text
coincident planes
parallel planes
concentric axes
distance offset
angle offset
rigid group
fixed component
```

Represent every mate as a typed object:

```ts
Mate {
  id: MateId
  type: "coincident" | "concentric" | "parallel" | "distance" | "angle" | "fixed"
  refs: EntityRef[]
  parameters: Record<string, Quantity>
  status: "solved" | "underconstrained" | "conflicting" | "suppressed"
}
```

Agents should be able to ask:

```text
“What parts are underconstrained?”
“What mates reference this face?”
“Find all concentric hole axes in this assembly.”
```

## 18. Performance targets and benchmark models

Set explicit performance budgets early. Suggested initial targets:

```text
First visible frame for imported assembly:
  show assembly tree and bounding boxes before fine tessellation completes

Viewport interaction:
  maintain interactive camera movement by degrading LOD while moving

GPU draw calls:
  keep visible draw calls low through instancing and batching

Memory:
  enforce CPU and GPU cache budgets

AI query:
  structural queries should return summaries, not full model dumps

Undo/redo:
  should operate on command diffs and checkpoints, not full project clones
```

Create benchmark models:

```text
1. Repeated fasteners:
   100,000 instances of 20 unique parts

2. Unique-machined-parts assembly:
   thousands of distinct B-rep bodies

3. Deep nested assembly:
   10+ assembly hierarchy levels

4. Large imported STEP:
   tests import, healing, metadata, tessellation

5. Fillet stress test:
   many edge blends and small features

6. Sketch constraint stress test:
   large sketch with hundreds of constraints

7. Agent edit benchmark:
   MCP batch creates and modifies a model repeatedly
```

Track:

```text
time to first frame
time to full coarse view
time to selected-part fine view
frame time p50/p95
GPU memory
CPU memory
number of visible instances
number of triangles submitted
number of draw calls
mesh cache hit rate
geometry worker latency
MCP tool latency
```

## 19. Security model for AI connectors

AI agents will be first-class actors, so permissions matter.

Use capability-scoped sessions:

```text
read_project
query_geometry
preview_edits
commit_edits
import_files
export_files
write_local_files
run_scripts
access_network
```

Default MCP mode should be read plus preview. Committing destructive changes should require either a configured policy or a human approval flow.

Every agent transaction should be auditable:

```ts
AgentAuditEvent {
  actorId: string
  tool: string
  inputHash: string
  outputHash: string
  affectedRefs: EntityRef[]
  transactionId?: string
  timestamp: string
}
```

The local MCP server should bind to `127.0.0.1`, require a per-session token, enforce origin checks, and never expose arbitrary filesystem access. Hosted MCP should use normal auth and per-project authorization.

## 20. What Codex should build first

The first implementation should not start with a full CAD UI. It should start with the command engine, WASM kernel bridge, and renderer skeleton.

Initial build order:

1. Create monorepo.
2. Define `cad-protocol` schemas.
3. Implement in-memory project document and transaction engine.
4. Compile a minimal OCCT WASM module.
5. Add geometry worker wrapper.
6. Implement primitive commands: box, cylinder, sketch rectangle, extrude, fillet, boolean.
7. Implement tessellation response from OCCT to typed arrays.
8. Implement basic WebGPU viewport with camera controls.
9. Implement object IDs and selection buffer.
10. Implement OPFS mesh cache.
11. Implement local launcher with required headers.
12. Implement MCP `cad.project_summary`, `cad.query`, `cad.batch`, and `cad.measure`.
13. Add STEP import/export.
14. Add feature tree and inspector UI.
15. Add sketch solver.
16. Add LOD and assembly instancing.

The first meaningful demo should be:

```text
Open Chrome through local launcher.
Create a parametric bracket through CADOps.
Render it in WebGPU.
Select faces.
Measure exact distances.
Export STEP and GLB.
Have an MCP client modify the bracket through dry-run + commit.
Undo the agent transaction.
```

## 21. Key design decisions to preserve

These are the decisions I would treat as non-negotiable:

Use an exact B-rep kernel. Mesh-only CAD will not be good enough.

Make the command protocol the center of the system. Human UI and AI agents both use it.

Keep MCP as an adapter. Do not let MCP shape the internal architecture.

Use WebGPU and workers from the start. Performance is architectural, not a late optimization.

Use OPFS and content-addressed caches for large derived data.

Use a localhost launcher for the downloadable version. Do not depend on raw `file://`.

Keep local and hosted deployment as the same static web app with different hosting adapters.

Return semantic diffs to agents, not geometry dumps.

Implement stable entity naming early.

Treat huge assemblies as hierarchical instances with LOD, not as one enormous triangle soup.

Support STEP very well before chasing proprietary formats.

## 22. Biggest technical risks

The hardest parts will be:

Topological naming. If entity references are unstable, both parametric history and AI editing become unreliable.

OCCT WASM size and performance. Mitigate with lazy loading, workers, pthreads, and careful API boundaries.

Large STEP import quality. Real CAD files are messy. Healing, units, assembly metadata, colors, and invalid geometry will need sustained testing.

Sketch solver correctness. Constraint diagnostics matter as much as solving.

Viewport scalability. You need instancing, LOD, culling, and GPU memory budgets early.

AI safety. Agents need preview, validation, permissions, and audit trails.

Human usability. A technically correct CAD tool that is hard to use will fail. The structured command model should make the UI simpler, not more complex.

## 23. Final architecture summary

Build the application as a browser CAD engine with these core packages:

```text
cad-core:
  deterministic document model, command graph, transactions

cad-wasm:
  OCCT bridge, exact geometry, import/export, tessellation

sketch-solver:
  constraints and parametric sketches

renderer-webgpu:
  CAD-specialized large-assembly renderer

cad-protocol:
  compact operation schema for humans, scripts, agents, MCP

mcp-tools:
  MCP adapter exposing query, batch, measure, validate, export

storage:
  native project format, OPFS cache, File System Access integration

launcher:
  serves the same web bundle locally, sets headers, exposes MCP
```

That gives you one elegant solution: a static browser CAD app that runs locally or hosted, with exact geometry, large-assembly rendering, and AI-native control through a deterministic, token-efficient command interface.

[1]: https://threejs.org/docs/pages/WebGPURenderer.html "WebGPURenderer - Three.js Docs"
[2]: https://dev.opencascade.org/doc/overview/html/ "Open CASCADE Technology: Introduction"
[3]: https://emscripten.org/docs/porting/pthreads.html "Pthreads support — Emscripten 5.0.8-git (dev) documentation"
[4]: https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system "Origin private file system - Web APIs | MDN"
[5]: https://modelcontextprotocol.io/specification/2025-11-25 "Specification - Model Context Protocol"
[6]: https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts?utm_source=chatgpt.com "Secure contexts - MDN Web Docs - Mozilla"
[7]: https://dev.opencascade.org/resources/licensing?utm_source=chatgpt.com "Licensing"
[8]: https://github.com/solvespace/solvespace?utm_source=chatgpt.com "solvespace/solvespace: Parametric 2d/3d CAD"
[9]: https://www.khronos.org/gltf/ "glTF - Runtime 3D Asset Delivery"
