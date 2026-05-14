import { createOcctBoxMeshSpike } from "@web-cad/occt-spike/browser";
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

export async function executeGeometryKernelRequest(
  request: GeometryKernelRequest
): Promise<GeometryKernelResponse> {
  return executeGeometryKernelRequestWithMeshFactory(
    createOcctBoxMeshSpike,
    request
  );
}
