# Geometry Worker Spike

This package proves that the existing `@web-cad/geometry-kernel` facade can run
behind a worker-style asynchronous boundary.

It is intentionally isolated:

- `cad-core` does not import this package.
- `apps/web` does not import this package during normal startup.
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

`createBoxTessellationWorkerRequest()` builds this shape for the current spike.

## Response Shape

Success returns the underlying `GeometryKernelResponse` and transferables for a
future real Worker transport:

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
  transferables: [positions.buffer, indices.buffer]
}
```

Validation and kernel failures return structured errors and no transferables.

## Production Risks

- This is a transport-independent worker boundary, not a packaged browser Worker
  entrypoint yet.
- The underlying OCCT path still uses the current `opencascade.js` spike.
- Browser production integration still needs bundling validation, WASM asset
  loading, cross-origin isolation decisions, and worker error reporting.
- Typed arrays are ready for structured clone/transfer, but no mesh cache,
  invalidation strategy, or renderer bridge is implemented here.
- Only one primitive path is proven: box tessellation.
