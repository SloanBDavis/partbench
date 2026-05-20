import {
  createOcctBoxMesh,
  createOcctCylinderMesh,
  createOcctSphereMesh,
  createOcctConeMesh,
  createOcctTorusMesh,
  createOcctBooleanExtrudeMesh
} from "@web-cad/occt-wasm";
import {
  executeGeometryKernelRequestWithMeshFactory,
  getGeometryResponseTransferables,
  type BooleanExtrudeSource,
  type BooleanExtrudesRequest,
  type BoxGeometryDimensions,
  type ConeGeometryDimensions,
  type CylinderGeometryDimensions,
  type GeometryKernelBooleanOperation,
  type GeometryKernelError,
  type GeometryKernelErrorCode,
  type GeometryKernelExtrudeSide,
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
  BooleanExtrudeSource,
  BooleanExtrudesRequest,
  BoxGeometryDimensions,
  ConeGeometryDimensions,
  CylinderGeometryDimensions,
  GeometryKernelBooleanOperation,
  GeometryKernelError,
  GeometryKernelErrorCode,
  GeometryKernelExtrudeSide,
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
      createTorusMesh: createOcctTorusMesh,
      createBooleanExtrudeMesh: createOcctBooleanExtrudeMesh
    },
    request
  );
}
