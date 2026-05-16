import {
  createOcctBoxMeshWithInstance,
  createOcctCylinderMeshWithInstance,
  createOcctSphereMeshWithInstance,
  loadBrowserOcct
} from "@web-cad/occt-wasm/browser";
import {
  executeGeometryKernelRequestWithMeshFactory,
  getGeometryResponseTransferables,
  type BoxGeometryDimensions,
  type CylinderGeometryDimensions,
  type GeometryKernelError,
  type GeometryKernelErrorCode,
  type GeometryKernelOp,
  type GeometryKernelPrimitive,
  type GeometryKernelRequest,
  type GeometryKernelResponse,
  type GeometryKernelSuccessResponse,
  type GeometryKernelVersion,
  type GeometryKernelErrorResponse,
  type SerializableMeshData,
  type SphereGeometryDimensions,
  type TessellateBoxRequest,
  type TessellateCylinderRequest,
  type TessellateSphereRequest,
  type TessellationOptions
} from "./kernel";

export type {
  BoxGeometryDimensions,
  CylinderGeometryDimensions,
  GeometryKernelError,
  GeometryKernelErrorCode,
  GeometryKernelOp,
  GeometryKernelPrimitive,
  GeometryKernelRequest,
  GeometryKernelResponse,
  GeometryKernelSuccessResponse,
  GeometryKernelVersion,
  GeometryKernelErrorResponse,
  SerializableMeshData,
  SphereGeometryDimensions,
  TessellateBoxRequest,
  TessellateCylinderRequest,
  TessellateSphereRequest,
  TessellationOptions
};
export { getGeometryResponseTransferables };

export interface BrowserGeometryKernelTimings {
  readonly occtLoadMs: number;
  readonly tessellationMs: number;
  readonly geometryKernelMs: number;
  readonly failureStage?: BrowserGeometryKernelFailureStage;
}

export type BrowserGeometryKernelFailureStage = "wasmLoad" | "tessellation";

export interface TimedBrowserGeometryKernelResponse {
  readonly response: GeometryKernelResponse;
  readonly timings: BrowserGeometryKernelTimings;
}

export async function executeGeometryKernelRequest(
  request: GeometryKernelRequest
): Promise<GeometryKernelResponse> {
  return (await executeTimedBrowserGeometryKernelRequest(request)).response;
}

export async function executeTimedBrowserGeometryKernelRequest(
  request: GeometryKernelRequest
): Promise<TimedBrowserGeometryKernelResponse> {
  let occtLoadMs = 0;
  let tessellationMs = 0;
  let failureStage: BrowserGeometryKernelFailureStage | undefined;
  const geometryKernelStart = performance.now();
  const response = await executeGeometryKernelRequestWithMeshFactory(
    {
      createBoxMesh: (input) => createMeshWithBrowserOcct(input, "box"),
      createCylinderMesh: (input) =>
        createMeshWithBrowserOcct(input, "cylinder"),
      createSphereMesh: (input) => createMeshWithBrowserOcct(input, "sphere")
    },
    request
  );

  return {
    response,
    timings: {
      occtLoadMs,
      tessellationMs,
      geometryKernelMs: performance.now() - geometryKernelStart,
      ...(failureStage ? { failureStage } : {})
    }
  };

  async function createMeshWithBrowserOcct(
    input:
      | (BoxGeometryDimensions & TessellationOptions)
      | (CylinderGeometryDimensions & TessellationOptions)
      | (SphereGeometryDimensions & TessellationOptions),
    primitive: GeometryKernelPrimitive
  ) {
    const occtLoadStart = performance.now();
    let oc: Awaited<ReturnType<typeof loadBrowserOcct>>;

    try {
      oc = await loadBrowserOcct();
    } catch (error) {
      occtLoadMs = performance.now() - occtLoadStart;
      failureStage = "wasmLoad";
      throw error;
    }

    occtLoadMs = performance.now() - occtLoadStart;

    const tessellationStart = performance.now();

    try {
      switch (primitive) {
        case "box":
          return createOcctBoxMeshWithInstance(
            oc,
            input as BoxGeometryDimensions & TessellationOptions
          );
        case "cylinder":
          return createOcctCylinderMeshWithInstance(
            oc,
            input as CylinderGeometryDimensions & TessellationOptions
          );
        case "sphere":
          return createOcctSphereMeshWithInstance(
            oc,
            input as SphereGeometryDimensions & TessellationOptions
          );
      }
    } catch (error) {
      failureStage = "tessellation";
      throw error;
    } finally {
      tessellationMs = performance.now() - tessellationStart;
    }
  }
}
