import {
  createOcctBoxMeshWithInstance,
  loadBrowserOcct
} from "@web-cad/occt-spike/browser";
import {
  executeGeometryKernelRequestWithMeshFactory,
  getGeometryResponseTransferables,
  type BoxGeometryDimensions,
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
  type TessellateBoxRequest,
  type TessellationOptions
} from "./kernel";

export type {
  BoxGeometryDimensions,
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
  TessellateBoxRequest,
  TessellationOptions
};
export { getGeometryResponseTransferables };

export interface BrowserGeometryKernelTimings {
  readonly occtLoadMs: number;
  readonly tessellationMs: number;
  readonly geometryKernelMs: number;
}

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
  const geometryKernelStart = performance.now();
  const response = await executeGeometryKernelRequestWithMeshFactory(
    async (input) => {
      const occtLoadStart = performance.now();
      const oc = await loadBrowserOcct();
      occtLoadMs = performance.now() - occtLoadStart;

      const tessellationStart = performance.now();

      try {
        return createOcctBoxMeshWithInstance(oc, input);
      } finally {
        tessellationMs = performance.now() - tessellationStart;
      }
    },
    request
  );

  return {
    response,
    timings: {
      occtLoadMs,
      tessellationMs,
      geometryKernelMs: performance.now() - geometryKernelStart
    }
  };
}
