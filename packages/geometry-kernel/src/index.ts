import {
  createOcctBoxMesh,
  createOcctCylinderMesh,
  createOcctSphereMesh,
  createOcctConeMesh,
  createOcctTorusMesh
} from "@web-cad/occt-wasm";
import {
  executeGeometryKernelRequestWithMeshFactory,
  getGeometryResponseTransferables,
  type BoxGeometryDimensions,
  type ConeGeometryDimensions,
  type CylinderGeometryDimensions,
  type GeometryKernelError,
  type GeometryKernelErrorCode,
  type GeometryKernelExtrudeProfileKind,
  type GeometryKernelOp,
  type GeometryKernelPrimitive,
  type GeometryKernelSketchPlane,
  type GeometryKernelRequest,
  type GeometryKernelResponse,
  type GeometryKernelSuccessResponse,
  type GeometryKernelVersion,
  type GeometryKernelErrorResponse,
  type ExtrudeGeometryProfile,
  type RectangleExtrudeProfile,
  type CircleExtrudeProfile,
  type SerializableMeshData,
  type SphereGeometryDimensions,
  type TessellateBoxRequest,
  type TessellateConeRequest,
  type TessellateCylinderRequest,
  type TessellateExtrudeRequest,
  type TessellateSphereRequest,
  type TessellateTorusRequest,
  type TorusGeometryDimensions,
  type TessellationOptions
} from "./kernel";

export type {
  BoxGeometryDimensions,
  ConeGeometryDimensions,
  CylinderGeometryDimensions,
  GeometryKernelError,
  GeometryKernelErrorCode,
  GeometryKernelExtrudeProfileKind,
  GeometryKernelOp,
  GeometryKernelPrimitive,
  GeometryKernelSketchPlane,
  GeometryKernelRequest,
  GeometryKernelResponse,
  GeometryKernelSuccessResponse,
  GeometryKernelVersion,
  GeometryKernelErrorResponse,
  ExtrudeGeometryProfile,
  RectangleExtrudeProfile,
  CircleExtrudeProfile,
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

export async function executeGeometryKernelRequest(
  request: GeometryKernelRequest
): Promise<GeometryKernelResponse> {
  return executeGeometryKernelRequestWithMeshFactory(
    {
      createBoxMesh: createOcctBoxMesh,
      createCylinderMesh: createOcctCylinderMesh,
      createSphereMesh: createOcctSphereMesh,
      createConeMesh: createOcctConeMesh,
      createTorusMesh: createOcctTorusMesh
    },
    request
  );
}
