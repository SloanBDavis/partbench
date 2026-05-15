# Geometry Worker Spike

This package proves that the existing `@web-cad/geometry-kernel` facade can run
behind a worker-style asynchronous boundary.

It is intentionally isolated:

- `cad-core` does not import this package.
- `apps/web` imports this package only through an explicit dev path and dynamic
  browser-worker request code.
- The current renderer is unchanged.
- OCCT is loaded only when the explicit spike executor runs a request.

## Boundary

```text
caller-owned document data
  -> explicit GeometryWorkerSpikeRequest
    -> @web-cad/geometry-worker-spike
      -> dynamic import("@web-cad/geometry-kernel")
        -> isolated OCCT spike
          -> serializable mesh data
```

`cad-core` remains authoritative for document state, commands, transactions,
undo/redo, and semantic diffs. Meshes returned here are derived view/cache data
that can be rebuilt from authoritative document state.

## Request Shape

```json
{
  "id": "worker_req_box",
  "version": "geometry-worker-spike.v1",
  "kind": "geometry-worker-spike.tessellatePrimitive",
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
spike.

## Response Shape

Success returns the underlying `GeometryKernelResponse`, optional timing data,
and transferables for a real Worker transport:

```ts
{
  id: "worker_req_box",
  version: "geometry-worker-spike.v1",
  kind: "geometry-worker-spike.tessellatePrimitive",
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

`apps/web` now has an explicit browser Worker spike path:

- `apps/web/src/geometryTessellation.worker.ts`
- `apps/web/src/browserGeometryWorker.ts`

The entrypoint is not imported by `main.tsx`, the renderer, or `cad-core`. A
caller must explicitly create `BrowserGeometryWorker` to start the Worker:

```ts
import { BrowserGeometryWorker } from "./browserGeometryWorker";
import { createBoxTessellationWorkerRequest } from "@web-cad/geometry-worker-spike/browser";

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

That keeps normal app startup on the existing primitive renderer path. The web
app exposes the path only when `VITE_ENABLE_OCCT_MESH_DEV=true`; if OCCT or WASM
loading fails, it affects only that explicit dev workflow.

## Production Risks

- The browser Worker path now bundles through Vite and loads
  `opencascade.full.wasm` as a browser asset through the explicit smoke
  entrypoint.
- Browser production integration still needs cross-origin isolation decisions,
  lifecycle cleanup policy, and a smaller custom OCCT build.
- Typed arrays are ready for structured clone/transfer, but no production mesh
  cache or invalidation strategy is implemented here.
- Two primitive paths are proven: box and cylinder tessellation.
- The browser Worker path is still a spike path, not a production geometry
  service.
- Tests cover the browser transport wrapper and an in-process worker-backed
  tessellation path. `pnpm build:geometry-worker` covers the real Vite Worker
  bundle, and `apps/web/geometry-worker-smoke.html` is the browser runtime smoke
  page.
- `pnpm smoke:occt-browser` runs that smoke page in a local browser and appends
  structured timing/asset-size telemetry to `.metrics/occt-browser.jsonl`. Each
  record includes the scenario, browser metadata where available, worker
  startup/WASM load outcome, and structured error details on failure. The smoke
  validates that metrics exist, but it does not fail based on timing magnitude.
