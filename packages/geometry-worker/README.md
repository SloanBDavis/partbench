# Geometry Worker

This package runs the existing `@web-cad/geometry-kernel` facade behind a typed,
asynchronous worker boundary.

It is intentionally isolated:

- `cad-core` does not import this package.
- `apps/web` imports this package only through the derived geometry runtime and dynamic
  browser-worker request code.
- The current renderer is unchanged.
- OCCT is loaded only when the derived geometry runtime executes a request.

## Boundary

```text
caller-owned document data
  -> explicit GeometryWorkerRequest
    -> @web-cad/geometry-worker
      -> dynamic import("@web-cad/geometry-kernel")
        -> isolated OCCT WASM adapter
          -> serializable mesh data
```

`cad-core` remains authoritative for document state, commands, transactions,
undo/redo, and semantic diffs. Meshes returned here are derived view/cache data
that can be rebuilt from authoritative document state.

## Request Shape

```json
{
  "id": "worker_req_box",
  "version": "geometry-worker.v1",
  "kind": "geometry-worker.tessellatePrimitive",
  "payload": {
    "id": "geometry_req_box",
    "version": "geometry-kernel.v1",
    "op": "geometry.tessellateBox",
    "dimensions": {
      "width": 10,
      "height": 20,
      "depth": 30
    }
  }
}
```

`createBoxTessellationWorkerRequest()` and
`createCylinderTessellationWorkerRequest()` build these shapes for the current
box and cylinder tessellation path.

## Response Shape

Success returns the underlying `GeometryKernelResponse`, optional timing data,
and transferables for a real Worker transport:

```ts
{
  id: "worker_req_box",
  version: "geometry-worker.v1",
  kind: "geometry-worker.tessellatePrimitive",
  payloadId: "geometry_req_box",
  response: {
    ok: true,
    mesh: {
      primitive: "box",
      positions: Float32Array,
      indices: Uint32Array,
      vertexCount: number,
      triangleCount: number,
      faceCount: number
    }
  },
  timings: {
    occtLoadMs: number,
    tessellationMs: number,
    geometryKernelMs: number,
    workerExecutionMs: number
  },
  transferables: [positions.buffer, indices.buffer]
}
```

Validation and kernel failures return structured errors and no transferables.
Timing fields are best-effort browser-worker measurements for diagnostics, not
part of the authoritative document model. Browser-worker responses may also
include diagnostics with a stage, worker startup status, WASM load status, and a
structured error code/message. The current browser path uses those diagnostics
for WASM load failure, unsupported primitive requests, kernel/tessellation
failure, worker runtime failure, and worker transport failure.

## Browser Worker Entry Point

`apps/web` owns the browser Worker entrypoint:

- `apps/web/src/geometryTessellation.worker.ts`
- `apps/web/src/browserGeometryWorker.ts`

The entrypoint is not imported by `main.tsx`, the renderer, or `cad-core`. A
caller must explicitly create `BrowserGeometryWorker` to start the Worker:

```ts
import { BrowserGeometryWorker } from "./browserGeometryWorker";
import { createBoxTessellationWorkerRequest } from "@web-cad/geometry-worker/browser";

const worker = new BrowserGeometryWorker();
const response = await worker.execute(
  createBoxTessellationWorkerRequest({
    id: "browser_geometry_req_box",
    width: 10,
    height: 20,
    depth: 30
  })
);
```

That keeps default production app startup on the existing primitive renderer
path. The web app enables derived geometry by default for local Vite serve and
keeps `VITE_DISABLE_DERIVED_GEOMETRY=true pnpm dev` as the primitive fallback
escape hatch; if OCCT or WASM loading fails, the authoritative document still
uses `cad-core` and the renderer can keep showing primitives.

## Production Risks

- The browser Worker path now bundles through Vite and loads
  `opencascade.full.wasm` as a browser asset through the explicit smoke
  entrypoint.
- Browser production integration still needs cross-origin isolation decisions,
  lifecycle cleanup policy, and a smaller custom OCCT build.
- Typed arrays are ready for structured clone/transfer, but no production mesh
  cache or invalidation strategy is implemented here.
- Two primitive paths are proven: box and cylinder tessellation.
- This package is the typed geometry worker boundary; production mesh cache
  ownership remains in the app-layer derived geometry service.
- Tests cover the browser transport wrapper and an in-process worker-backed
  tessellation path. `pnpm build:geometry-worker` covers the real Vite Worker
  bundle, and `apps/web/geometry-worker-smoke.html` is the browser runtime smoke
  page.
- `pnpm smoke:occt-browser` runs that smoke page in a local browser and appends
  structured timing/asset-size telemetry to `.metrics/occt-browser.jsonl`. Each
  record includes the scenario, browser metadata where available, worker
  startup/WASM load outcome, raw/gzip/Brotli WASM size, served WASM encoding and
  byte count, and structured error details on failure. The smoke validates that
  metrics exist, but it does not fail based on timing magnitude.
