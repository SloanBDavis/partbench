import {
  createOcctBoxMeshWithInstance,
  createOcctConeMeshWithInstance,
  createOcctCylinderMeshWithInstance,
  createOcctSphereMeshWithInstance,
  createOcctTorusMeshWithInstance,
  loadBrowserOcct
} from "@web-cad/occt-wasm/browser";
import {
  executeGeometryKernelRequestWithMeshFactory,
  getGeometryResponseTransferables,
  type BoxGeometryDimensions,
  type ConeGeometryDimensions,
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
  type GeometryKernelExtrudeProfileKind,
  type SerializableMeshData,
  type SphereGeometryDimensions,
  type TessellateExtrudeRequest,
  type TessellateBoxRequest,
  type TessellateConeRequest,
  type TessellateCylinderRequest,
  type TessellateSphereRequest,
  type TessellateTorusRequest,
  type TorusGeometryDimensions,
  type TessellationOptions
} from "./kernel";

type BrowserOcctPrimitive = Exclude<GeometryKernelPrimitive, "extrude">;

export type {
  BoxGeometryDimensions,
  ConeGeometryDimensions,
  CylinderGeometryDimensions,
  GeometryKernelError,
  GeometryKernelErrorCode,
  GeometryKernelExtrudeProfileKind,
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
  TessellateConeRequest,
  TessellateCylinderRequest,
  TessellateExtrudeRequest,
  TessellateSphereRequest,
  TessellateTorusRequest,
  TorusGeometryDimensions,
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
      createSphereMesh: (input) => createMeshWithBrowserOcct(input, "sphere"),
      createConeMesh: (input) => createMeshWithBrowserOcct(input, "cone"),
      createTorusMesh: (input) => createMeshWithBrowserOcct(input, "torus")
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
      | (SphereGeometryDimensions & TessellationOptions)
      | (ConeGeometryDimensions & TessellationOptions)
      | (TorusGeometryDimensions & TessellationOptions),
    primitive: BrowserOcctPrimitive
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
        case "cone":
          return createOcctConeMeshWithInstance(
            oc,
            input as ConeGeometryDimensions & TessellationOptions
          );
        case "torus":
          return createOcctTorusMeshWithInstance(
            oc,
            input as TorusGeometryDimensions & TessellationOptions
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
