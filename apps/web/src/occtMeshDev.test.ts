import type { GeometryWorkerSpikeResponse } from "@web-cad/geometry-worker-spike";
import type { MeshRendererBridgeResult } from "@web-cad/renderer-mesh-bridge";
import { describe, expect, it } from "vitest";
import {
  createOcctMeshDevErrorDetails,
  createOcctMeshDevErrorFromWorkerResponse,
  createOcctMeshDevMetrics,
  formatMetricMs,
  formatOcctMeshDevError
} from "./occtMeshDev";

describe("occtMeshDev", () => {
  it("creates display metrics from a geometry worker response", () => {
    const response: GeometryWorkerSpikeResponse = {
      id: "worker_req_1",
      version: "geometry-worker-spike.v1",
      kind: "geometry-worker-spike.tessellatePrimitive",
      payloadId: "kernel_req_1",
      response: {
        ok: true,
        id: "kernel_req_1",
        op: "geometry.tessellateBox",
        mesh: {
          primitive: "box",
          positions: new Float32Array([0, 0, 0]),
          indices: new Uint32Array(),
          vertexCount: 1,
          triangleCount: 0,
          faceCount: 0
        },
        warnings: []
      },
      transferables: [],
      timings: {
        occtLoadMs: 1200.4,
        tessellationMs: 6.23,
        geometryKernelMs: 1208.1,
        workerExecutionMs: 1210.7
      }
    };
    const bridgeResult: MeshRendererBridgeResult = {
      version: "renderer-mesh-bridge.v1",
      mesh: {
        id: "obj_1",
        kind: "mesh",
        vertices: [[0, 0, 0]],
        indices: [],
        transform: {
          translation: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        }
      },
      bounds: {
        min: [0, 0, 0],
        max: [0, 0, 0]
      },
      vertexCount: 24,
      triangleCount: 12
    };

    expect(
      createOcctMeshDevMetrics({
        objectId: "obj_1",
        response,
        bridgeResult,
        roundTripMs: 1225.9
      })
    ).toEqual({
      objectId: "obj_1",
      occtLoadMs: 1200.4,
      tessellationMs: 6.23,
      geometryKernelMs: 1208.1,
      workerExecutionMs: 1210.7,
      roundTripMs: 1225.9,
      vertexCount: 24,
      triangleCount: 12
    });
  });

  it("formats missing and measured millisecond values", () => {
    expect(formatMetricMs(undefined)).toBe("n/a");
    expect(formatMetricMs(7.1234)).toBe("7.12 ms");
    expect(formatMetricMs(12.34)).toBe("12.3 ms");
  });

  it("creates structured UI errors from failed worker responses", () => {
    const response: GeometryWorkerSpikeResponse = {
      id: "worker_req_failure",
      version: "geometry-worker-spike.v1",
      kind: "geometry-worker-spike.tessellatePrimitive",
      payloadId: "kernel_req_failure",
      response: {
        ok: false,
        id: "kernel_req_failure",
        op: "geometry.tessellateBox",
        error: {
          code: "KERNEL_FAILURE",
          message: "Failed to load OCCT WASM."
        },
        warnings: []
      },
      transferables: [],
      diagnostics: {
        ok: false,
        stage: "wasmLoad",
        workerStarted: true,
        wasmLoadStatus: "failed",
        error: {
          code: "WASM_LOAD_FAILED",
          message: "Failed to load OCCT WASM."
        }
      }
    };

    const error = createOcctMeshDevErrorFromWorkerResponse(response);

    expect(error.details).toEqual({
      code: "WASM_LOAD_FAILED",
      stage: "wasmLoad",
      message: "Failed to load OCCT WASM.",
      workerStarted: true,
      wasmLoadStatus: "failed"
    });
    expect(formatOcctMeshDevError(error.details)).toBe(
      "WASM_LOAD_FAILED at wasmLoad: Failed to load OCCT WASM."
    );
  });

  it("creates structured UI errors from transport diagnostics", () => {
    expect(
      createOcctMeshDevErrorDetails({
        diagnostics: {
          ok: false,
          stage: "transport",
          workerStarted: false,
          wasmLoadStatus: "notRequested",
          error: {
            code: "WORKER_TRANSPORT_FAILED",
            message: "Worker postMessage failed."
          }
        }
      })
    ).toEqual({
      code: "WORKER_TRANSPORT_FAILED",
      stage: "transport",
      message: "Worker postMessage failed.",
      workerStarted: false,
      wasmLoadStatus: "notRequested"
    });
  });
});
