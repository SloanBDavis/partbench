export type GeometryKernelVersion = "geometry-kernel.v1";
export type GeometryKernelOp =
  | "geometry.tessellateBox"
  | "geometry.tessellateCylinder"
  | "geometry.tessellateSphere"
  | "geometry.tessellateCone"
  | "geometry.tessellateTorus"
  | "geometry.tessellateExtrude";
export type GeometryKernelPrimitive =
  | "box"
  | "cylinder"
  | "sphere"
  | "cone"
  | "torus"
  | "extrude";
export type GeometryKernelSketchPlane = "XY" | "XZ" | "YZ";
export type GeometryKernelExtrudeProfileKind = "rectangle" | "circle";

export interface BoxGeometryDimensions {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
}

export interface CylinderGeometryDimensions {
  readonly radius: number;
  readonly height: number;
}

export interface SphereGeometryDimensions {
  readonly radius: number;
}

export interface ConeGeometryDimensions {
  readonly radius: number;
  readonly height: number;
}

export interface TorusGeometryDimensions {
  readonly majorRadius: number;
  readonly minorRadius: number;
}

export interface RectangleExtrudeProfile {
  readonly kind: "rectangle";
  readonly center: readonly [number, number];
  readonly width: number;
  readonly height: number;
}

export interface CircleExtrudeProfile {
  readonly kind: "circle";
  readonly center: readonly [number, number];
  readonly radius: number;
}

export type ExtrudeGeometryProfile =
  | RectangleExtrudeProfile
  | CircleExtrudeProfile;

export interface TessellationOptions {
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}

export interface TessellateBoxRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.tessellateBox";
  readonly dimensions: BoxGeometryDimensions;
  readonly tessellation?: TessellationOptions;
}

export interface TessellateCylinderRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.tessellateCylinder";
  readonly dimensions: CylinderGeometryDimensions;
  readonly tessellation?: TessellationOptions;
}

export interface TessellateSphereRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.tessellateSphere";
  readonly dimensions: SphereGeometryDimensions;
  readonly tessellation?: TessellationOptions;
}

export interface TessellateConeRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.tessellateCone";
  readonly dimensions: ConeGeometryDimensions;
  readonly tessellation?: TessellationOptions;
}

export interface TessellateTorusRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.tessellateTorus";
  readonly dimensions: TorusGeometryDimensions;
  readonly tessellation?: TessellationOptions;
}

export interface TessellateExtrudeRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.tessellateExtrude";
  readonly sketchPlane: GeometryKernelSketchPlane;
  readonly profile: ExtrudeGeometryProfile;
  readonly depth: number;
  readonly tessellation?: TessellationOptions;
}

export type GeometryKernelRequest =
  | TessellateBoxRequest
  | TessellateCylinderRequest
  | TessellateSphereRequest
  | TessellateConeRequest
  | TessellateTorusRequest
  | TessellateExtrudeRequest;

export interface SerializableMeshData {
  readonly primitive: GeometryKernelPrimitive;
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly faceCount: number;
}

export type GeometryKernelResponse =
  | GeometryKernelSuccessResponse
  | GeometryKernelErrorResponse;

export interface GeometryKernelSuccessResponse {
  readonly ok: true;
  readonly id: string;
  readonly op: GeometryKernelOp;
  readonly mesh: SerializableMeshData;
  readonly warnings: readonly string[];
}

export interface GeometryKernelErrorResponse {
  readonly ok: false;
  readonly id: string;
  readonly op: GeometryKernelOp;
  readonly error: GeometryKernelError;
  readonly warnings: readonly string[];
}

export type GeometryKernelErrorCode =
  | "INVALID_DIMENSIONS"
  | "INVALID_TESSELLATION_OPTIONS"
  | "KERNEL_FAILURE";

export interface GeometryKernelError {
  readonly code: GeometryKernelErrorCode;
  readonly message: string;
}

export interface GeometryKernelMeshResult {
  readonly primitive: GeometryKernelPrimitive;
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly faceCount: number;
}

export type GeometryKernelBoxMeshFactory = (
  input: BoxGeometryDimensions & TessellationOptions
) => Promise<GeometryKernelMeshResult>;

export type GeometryKernelCylinderMeshFactory = (
  input: CylinderGeometryDimensions & TessellationOptions
) => Promise<GeometryKernelMeshResult>;

export type GeometryKernelSphereMeshFactory = (
  input: SphereGeometryDimensions & TessellationOptions
) => Promise<GeometryKernelMeshResult>;

export type GeometryKernelConeMeshFactory = (
  input: ConeGeometryDimensions & TessellationOptions
) => Promise<GeometryKernelMeshResult>;

export type GeometryKernelTorusMeshFactory = (
  input: TorusGeometryDimensions & TessellationOptions
) => Promise<GeometryKernelMeshResult>;

export interface GeometryKernelMeshFactories {
  readonly createBoxMesh: GeometryKernelBoxMeshFactory;
  readonly createCylinderMesh: GeometryKernelCylinderMeshFactory;
  readonly createSphereMesh: GeometryKernelSphereMeshFactory;
  readonly createConeMesh: GeometryKernelConeMeshFactory;
  readonly createTorusMesh: GeometryKernelTorusMeshFactory;
}

export async function executeGeometryKernelRequestWithMeshFactory(
  factories: GeometryKernelMeshFactories,
  request: GeometryKernelRequest
): Promise<GeometryKernelResponse> {
  const validationError = validateRequest(request);

  if (validationError) {
    return errorResponse(request, validationError);
  }

  try {
    const mesh = await createMesh(factories, request);

    return {
      ok: true,
      id: request.id,
      op: request.op,
      mesh: {
        primitive: mesh.primitive,
        positions: mesh.positions,
        indices: mesh.indices,
        vertexCount: mesh.vertexCount,
        triangleCount: mesh.triangleCount,
        faceCount: mesh.faceCount
      },
      warnings: []
    };
  } catch (error) {
    return errorResponse(request, {
      code: "KERNEL_FAILURE",
      message:
        error instanceof Error
          ? error.message
          : "The geometry kernel failed to tessellate the request."
    });
  }
}

export function getGeometryResponseTransferables(
  response: GeometryKernelResponse
): readonly ArrayBuffer[] {
  if (!response.ok) {
    return [];
  }

  return [
    response.mesh.positions.buffer as ArrayBuffer,
    response.mesh.indices.buffer as ArrayBuffer
  ];
}

function validateRequest(
  request: GeometryKernelRequest
): GeometryKernelError | undefined {
  if (request.op === "geometry.tessellateBox") {
    if (
      !isPositiveFiniteNumber(request.dimensions.width) ||
      !isPositiveFiniteNumber(request.dimensions.height) ||
      !isPositiveFiniteNumber(request.dimensions.depth)
    ) {
      return {
        code: "INVALID_DIMENSIONS",
        message: "Box dimensions must be finite numbers greater than zero."
      };
    }
  } else if (
    request.op === "geometry.tessellateCylinder" ||
    request.op === "geometry.tessellateCone"
  ) {
    if (
      !isPositiveFiniteNumber(request.dimensions.radius) ||
      !isPositiveFiniteNumber(request.dimensions.height)
    ) {
      return {
        code: "INVALID_DIMENSIONS",
        message: `${formatPrimitiveLabel(request.op)} dimensions must be finite numbers greater than zero.`
      };
    }
  } else if (request.op === "geometry.tessellateSphere") {
    if (!isPositiveFiniteNumber(request.dimensions.radius)) {
      return {
        code: "INVALID_DIMENSIONS",
        message: "Sphere dimensions must be finite numbers greater than zero."
      };
    }
  } else if (request.op === "geometry.tessellateExtrude") {
    if (
      !isSketchPlane(request.sketchPlane) ||
      !isPositiveFiniteNumber(request.depth) ||
      !isValidExtrudeProfile(request.profile)
    ) {
      return {
        code: "INVALID_DIMENSIONS",
        message:
          "Extrude requests require a supported sketch plane, rectangle or circle profile, and positive finite depth."
      };
    }
  } else if (
    !isPositiveFiniteNumber(request.dimensions.majorRadius) ||
    !isPositiveFiniteNumber(request.dimensions.minorRadius) ||
    request.dimensions.minorRadius >= request.dimensions.majorRadius
  ) {
    return {
      code: "INVALID_DIMENSIONS",
      message:
        "Torus dimensions must be finite numbers greater than zero with minorRadius smaller than majorRadius."
    };
  }

  if (
    !isOptionalPositiveFiniteNumber(request.tessellation?.linearDeflection) ||
    !isOptionalPositiveFiniteNumber(request.tessellation?.angularDeflection)
  ) {
    return {
      code: "INVALID_TESSELLATION_OPTIONS",
      message: "Tessellation options must be finite numbers greater than zero."
    };
  }

  return undefined;
}

function createMesh(
  factories: GeometryKernelMeshFactories,
  request: GeometryKernelRequest
): Promise<GeometryKernelMeshResult> {
  switch (request.op) {
    case "geometry.tessellateBox":
      return factories.createBoxMesh({
        ...request.dimensions,
        linearDeflection: request.tessellation?.linearDeflection,
        angularDeflection: request.tessellation?.angularDeflection
      });
    case "geometry.tessellateCylinder":
      return factories.createCylinderMesh({
        ...request.dimensions,
        linearDeflection: request.tessellation?.linearDeflection,
        angularDeflection: request.tessellation?.angularDeflection
      });
    case "geometry.tessellateSphere":
      return factories.createSphereMesh({
        ...request.dimensions,
        linearDeflection: request.tessellation?.linearDeflection,
        angularDeflection: request.tessellation?.angularDeflection
      });
    case "geometry.tessellateCone":
      return factories.createConeMesh({
        ...request.dimensions,
        linearDeflection: request.tessellation?.linearDeflection,
        angularDeflection: request.tessellation?.angularDeflection
      });
    case "geometry.tessellateTorus":
      return factories.createTorusMesh({
        ...request.dimensions,
        linearDeflection: request.tessellation?.linearDeflection,
        angularDeflection: request.tessellation?.angularDeflection
      });
    case "geometry.tessellateExtrude":
      return createExtrudeMesh(factories, request);
  }
}

async function createExtrudeMesh(
  factories: GeometryKernelMeshFactories,
  request: TessellateExtrudeRequest
): Promise<GeometryKernelMeshResult> {
  const mesh =
    request.profile.kind === "rectangle"
      ? await factories.createBoxMesh({
          width: request.profile.width,
          height: request.profile.height,
          depth: request.depth,
          linearDeflection: request.tessellation?.linearDeflection,
          angularDeflection: request.tessellation?.angularDeflection
        })
      : await factories.createCylinderMesh({
          radius: request.profile.radius,
          height: request.depth,
          linearDeflection: request.tessellation?.linearDeflection,
          angularDeflection: request.tessellation?.angularDeflection
        });

  return {
    primitive: "extrude",
    positions: mapExtrudePositions(
      mesh.positions,
      request.sketchPlane,
      request.profile.center
    ),
    indices: mesh.indices,
    vertexCount: mesh.vertexCount,
    triangleCount: mesh.triangleCount,
    faceCount: mesh.faceCount
  };
}

function mapExtrudePositions(
  positions: Float32Array,
  sketchPlane: GeometryKernelSketchPlane,
  center: readonly [number, number]
): Float32Array {
  const mapped = new Float32Array(positions.length);
  const bounds = getPositionBounds(positions);
  const profileCenterX = (bounds.min[0] + bounds.max[0]) / 2;
  const profileCenterY = (bounds.min[1] + bounds.max[1]) / 2;
  const normalOrigin = bounds.min[2];

  for (let index = 0; index < positions.length; index += 3) {
    const profileX = positions[index] - profileCenterX + center[0];
    const profileY = positions[index + 1] - profileCenterY + center[1];
    const normal = positions[index + 2] - normalOrigin;
    const [x, y, z] = mapPlanePoint(sketchPlane, profileX, profileY, normal);

    mapped[index] = x;
    mapped[index + 1] = y;
    mapped[index + 2] = z;
  }

  return mapped;
}

function getPositionBounds(positions: Float32Array): {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
} {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < positions.length; index += 3) {
    minX = Math.min(minX, positions[index]);
    minY = Math.min(minY, positions[index + 1]);
    minZ = Math.min(minZ, positions[index + 2]);
    maxX = Math.max(maxX, positions[index]);
    maxY = Math.max(maxY, positions[index + 1]);
    maxZ = Math.max(maxZ, positions[index + 2]);
  }

  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ]
  };
}

function mapPlanePoint(
  sketchPlane: GeometryKernelSketchPlane,
  profileX: number,
  profileY: number,
  normal: number
): readonly [number, number, number] {
  switch (sketchPlane) {
    case "XY":
      return [profileX, profileY, normal];
    case "XZ":
      return [profileX, normal, profileY];
    case "YZ":
      return [normal, profileX, profileY];
  }
}

function formatPrimitiveLabel(op: GeometryKernelOp): string {
  switch (op) {
    case "geometry.tessellateBox":
      return "Box";
    case "geometry.tessellateCylinder":
      return "Cylinder";
    case "geometry.tessellateSphere":
      return "Sphere";
    case "geometry.tessellateCone":
      return "Cone";
    case "geometry.tessellateTorus":
      return "Torus";
    case "geometry.tessellateExtrude":
      return "Extrude";
  }
}

function errorResponse(
  request: GeometryKernelRequest,
  error: GeometryKernelError
): GeometryKernelErrorResponse {
  return {
    ok: false,
    id: request.id,
    op: request.op,
    error,
    warnings: []
  };
}

function isOptionalPositiveFiniteNumber(value: number | undefined): boolean {
  return value === undefined || isPositiveFiniteNumber(value);
}

function isPositiveFiniteNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isSketchPlane(value: GeometryKernelSketchPlane): boolean {
  return value === "XY" || value === "XZ" || value === "YZ";
}

function isValidExtrudeProfile(profile: ExtrudeGeometryProfile): boolean {
  if (profile.kind === "rectangle") {
    return (
      isVec2(profile.center) &&
      isPositiveFiniteNumber(profile.width) &&
      isPositiveFiniteNumber(profile.height)
    );
  }

  if (profile.kind === "circle") {
    return isVec2(profile.center) && isPositiveFiniteNumber(profile.radius);
  }

  return false;
}

function isVec2(value: readonly [number, number]): boolean {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}
