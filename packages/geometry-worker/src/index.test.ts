import { describe, expect, it } from "vitest";
import {
  GeometryKernelWorker,
  createBoxTessellationWorkerRequest,
  createCylinderTessellationWorkerRequest,
  createSphereTessellationWorkerRequest,
  createWorkerErrorDiagnostics,
  createWorkerSuccessDiagnostics,
  createGeometryKernelWorker
} from "./index";

describe("geometry-worker", () => {
  it("creates a typed box tessellation worker request", () => {
    const request = createBoxTessellationWorkerRequest({
      id: "worker_req_1",
      width: 10,
      height: 20,
      depth: 30,
      linearDeflection: 0.25
    });

    expect(request).toEqual({
      id: "worker_req_1",
      version: "geometry-worker.v1",
      kind: "geometry-worker.tessellatePrimitive",
      payload: {
        id: "worker_req_1:payload",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateBox",
        dimensions: {
          width: 10,
          height: 20,
          depth: 30
        },
        tessellation: {
          linearDeflection: 0.25
        }
      }
    });
  });

  it("creates a typed sphere tessellation worker request", () => {
    const request = createSphereTessellationWorkerRequest({
      id: "worker_req_sphere",
      radius: 10,
      angularDeflection: 0.5
    });

    expect(request).toEqual({
      id: "worker_req_sphere",
      version: "geometry-worker.v1",
      kind: "geometry-worker.tessellatePrimitive",
      payload: {
        id: "worker_req_sphere:payload",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateSphere",
        dimensions: {
          radius: 10
        },
        tessellation: {
          angularDeflection: 0.5
        }
      }
    });
  });

  it("creates a typed cylinder tessellation worker request", () => {
    const request = createCylinderTessellationWorkerRequest({
      id: "worker_req_cylinder",
      radius: 10,
      height: 30,
      angularDeflection: 0.5
    });

    expect(request).toEqual({
      id: "worker_req_cylinder",
      version: "geometry-worker.v1",
      kind: "geometry-worker.tessellatePrimitive",
      payload: {
        id: "worker_req_cylinder:payload",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateCylinder",
        dimensions: {
          radius: 10,
          height: 30
        },
        tessellation: {
          angularDeflection: 0.5
        }
      }
    });
  });

  it("tessellates one box asynchronously through the geometry kernel facade", async () => {
    const worker = createGeometryKernelWorker({ delayMs: 1 });
    const responsePromise = worker.execute(
      createBoxTessellationWorkerRequest({
        id: "worker_req_box",
        payloadId: "geometry_req_box",
        width: 10,
        height: 20,
        depth: 30
      })
    );
    let isSettled = false;
    void responsePromise.then(() => {
      isSettled = true;
    });

    expect(isSettled).toBe(false);

    const response = await responsePromise;

    expect(response).toMatchObject({
      id: "worker_req_box",
      version: "geometry-worker.v1",
      kind: "geometry-worker.tessellatePrimitive",
      payloadId: "geometry_req_box",
      response: {
        ok: true,
        id: "geometry_req_box",
        op: "geometry.tessellateBox",
        warnings: []
      }
    });

    if (!response.response.ok) {
      throw new Error(response.response.error.message);
    }

    expect(response.response.mesh.primitive).toBe("box");
    expect(response.response.mesh.faceCount).toBe(6);
    expect(response.response.mesh.vertexCount).toBe(24);
    expect(response.response.mesh.triangleCount).toBe(12);
    expect(response.response.mesh.positions).toBeInstanceOf(Float32Array);
    expect(response.response.mesh.indices).toBeInstanceOf(Uint32Array);
    expect(response.transferables).toEqual([
      response.response.mesh.positions.buffer,
      response.response.mesh.indices.buffer
    ]);
  });

  it("tessellates one cylinder asynchronously through the geometry kernel facade", async () => {
    const worker = createGeometryKernelWorker({ delayMs: 1 });
    const response = await worker.execute(
      createCylinderTessellationWorkerRequest({
        id: "worker_req_cylinder",
        payloadId: "geometry_req_cylinder",
        radius: 10,
        height: 30
      })
    );

    expect(response).toMatchObject({
      id: "worker_req_cylinder",
      version: "geometry-worker.v1",
      kind: "geometry-worker.tessellatePrimitive",
      payloadId: "geometry_req_cylinder",
      response: {
        ok: true,
        id: "geometry_req_cylinder",
        op: "geometry.tessellateCylinder",
        warnings: []
      }
    });

    if (!response.response.ok) {
      throw new Error(response.response.error.message);
    }

    expect(response.response.mesh.primitive).toBe("cylinder");
    expect(response.response.mesh.vertexCount).toBeGreaterThan(0);
    expect(response.response.mesh.triangleCount).toBeGreaterThan(0);
    expect(response.transferables).toEqual([
      response.response.mesh.positions.buffer,
      response.response.mesh.indices.buffer
    ]);
  });

  it("tessellates one sphere asynchronously through the geometry kernel facade", async () => {
    const worker = createGeometryKernelWorker({ delayMs: 1 });
    const response = await worker.execute(
      createSphereTessellationWorkerRequest({
        id: "worker_req_sphere",
        payloadId: "geometry_req_sphere",
        radius: 10
      })
    );

    expect(response).toMatchObject({
      id: "worker_req_sphere",
      version: "geometry-worker.v1",
      kind: "geometry-worker.tessellatePrimitive",
      payloadId: "geometry_req_sphere",
      response: {
        ok: true,
        id: "geometry_req_sphere",
        op: "geometry.tessellateSphere",
        warnings: []
      }
    });

    if (!response.response.ok) {
      throw new Error(response.response.error.message);
    }

    expect(response.response.mesh.primitive).toBe("sphere");
    expect(response.response.mesh.vertexCount).toBeGreaterThan(0);
    expect(response.response.mesh.triangleCount).toBeGreaterThan(0);
    expect(response.transferables).toEqual([
      response.response.mesh.positions.buffer,
      response.response.mesh.indices.buffer
    ]);
  });

  it("returns structured kernel validation errors without transferables", async () => {
    const worker = new GeometryKernelWorker();

    const response = await worker.execute(
      createBoxTessellationWorkerRequest({
        id: "worker_req_bad_dimensions",
        width: 0,
        height: 20,
        depth: 30
      })
    );

    expect(response).toEqual({
      id: "worker_req_bad_dimensions",
      version: "geometry-worker.v1",
      kind: "geometry-worker.tessellatePrimitive",
      payloadId: "worker_req_bad_dimensions:payload",
      response: {
        ok: false,
        id: "worker_req_bad_dimensions:payload",
        op: "geometry.tessellateBox",
        error: {
          code: "INVALID_DIMENSIONS",
          message: "Box dimensions must be finite numbers greater than zero."
        },
        warnings: []
      },
      transferables: []
    });
  });

  it("creates structured worker diagnostics for success and failure", () => {
    expect(
      createWorkerSuccessDiagnostics({
        wasmLoadStatus: "loaded"
      })
    ).toEqual({
      ok: true,
      stage: "complete",
      workerStarted: true,
      wasmLoadStatus: "loaded"
    });

    expect(
      createWorkerErrorDiagnostics({
        stage: "wasmLoad",
        code: "WASM_LOAD_FAILED",
        message: "OCCT WASM could not be loaded.",
        cause: "network error"
      })
    ).toEqual({
      ok: false,
      stage: "wasmLoad",
      workerStarted: true,
      wasmLoadStatus: "notRequested",
      error: {
        code: "WASM_LOAD_FAILED",
        message: "OCCT WASM could not be loaded.",
        cause: "network error"
      }
    });
  });
});
