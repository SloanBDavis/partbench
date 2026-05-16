import {
  createOcctBoxMesh,
  createOcctCylinderMesh,
  createOcctSphereMesh
} from "@web-cad/occt-wasm";
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

export async function executeGeometryKernelRequest(
  request: GeometryKernelRequest
): Promise<GeometryKernelResponse> {
  return executeGeometryKernelRequestWithMeshFactory(
    {
      createBoxMesh: createOcctBoxMesh,
      createCylinderMesh: createOcctCylinderMesh,
      createSphereMesh: createOcctSphereMesh
    },
    request
  );
}
