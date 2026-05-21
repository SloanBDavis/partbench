export type GeometryKernelVersion = "geometry-kernel.v1";
export type GeometryKernelOp =
  | "geometry.tessellateBox"
  | "geometry.tessellateCylinder"
  | "geometry.tessellateSphere"
  | "geometry.tessellateCone"
  | "geometry.tessellateTorus"
  | "geometry.tessellateExtrude"
  | "geometry.booleanExtrudes";
export type GeometryKernelPrimitive =
  | "box"
  | "cylinder"
  | "sphere"
  | "cone"
  | "torus"
  | "extrude"
  | "boolean";
export type GeometryKernelSketchPlane = "XY" | "XZ" | "YZ";
export type GeometryKernelExtrudeProfileKind = "rectangle" | "circle";
export type GeometryKernelExtrudeSide = "positive" | "negative" | "symmetric";
export type GeometryKernelBooleanOperation = "add" | "cut";

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

export interface BooleanExtrudeSource {
  readonly sketchPlane: GeometryKernelSketchPlane;
  readonly profile: ExtrudeGeometryProfile;
  readonly depth: number;
  readonly side?: GeometryKernelExtrudeSide;
  readonly placementFrame?: BooleanExtrudePlacementFrame;
}

export interface BooleanExtrudePlacementFrame {
  readonly origin: readonly [number, number, number];
  readonly uAxis: readonly [number, number, number];
  readonly vAxis: readonly [number, number, number];
}

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
  readonly side?: GeometryKernelExtrudeSide;
  readonly tessellation?: TessellationOptions;
}

export interface BooleanExtrudesRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.booleanExtrudes";
  readonly operation: GeometryKernelBooleanOperation;
  readonly target: BooleanExtrudeSource;
  readonly tool: BooleanExtrudeSource;
  readonly tessellation?: TessellationOptions;
}

export type GeometryKernelRequest =
  | TessellateBoxRequest
  | TessellateCylinderRequest
  | TessellateSphereRequest
  | TessellateConeRequest
  | TessellateTorusRequest
  | TessellateExtrudeRequest
  | BooleanExtrudesRequest;

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
  | "UNSUPPORTED_PROFILE"
  | "KERNEL_FAILURE"
  | "EMPTY_RESULT"
  | "INVALID_RESULT";

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

export type GeometryKernelBooleanExtrudeMeshFactory = (
  input: Omit<BooleanExtrudesRequest, "id" | "version" | "op"> &
    TessellationOptions
) => Promise<GeometryKernelMeshResult>;

export interface GeometryKernelMeshFactories {
  readonly createBoxMesh: GeometryKernelBoxMeshFactory;
  readonly createCylinderMesh: GeometryKernelCylinderMeshFactory;
  readonly createSphereMesh: GeometryKernelSphereMeshFactory;
  readonly createConeMesh: GeometryKernelConeMeshFactory;
  readonly createTorusMesh: GeometryKernelTorusMeshFactory;
  readonly createBooleanExtrudeMesh: GeometryKernelBooleanExtrudeMeshFactory;
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

    if (isEmptyMesh(mesh)) {
      return errorResponse(request, {
        code: "EMPTY_RESULT",
        message: "The geometry kernel returned an empty or invalid mesh."
      });
    }

    if (isInvalidMesh(mesh)) {
      return errorResponse(request, {
        code: "INVALID_RESULT",
        message:
          "The geometry kernel returned mesh data with inconsistent counts or invalid values."
      });
    }

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
      !isExtrudeSide(request.side ?? "positive") ||
      !isValidExtrudeProfile(request.profile)
    ) {
      return {
        code: "INVALID_DIMENSIONS",
        message:
          "Extrude requests require a supported sketch plane, side, rectangle or circle profile, and positive finite depth."
      };
    }
  } else if (request.op === "geometry.booleanExtrudes") {
    if (!isBooleanOperation(request.operation)) {
      return {
        code: "INVALID_DIMENSIONS",
        message: "Boolean extrude requests require operation add or cut."
      };
    }

    if (
      !isValidBooleanExtrudeSource(request.target) ||
      !isValidBooleanExtrudeSource(request.tool)
    ) {
      return {
        code: "INVALID_DIMENSIONS",
        message:
          "Boolean extrude requests require target/tool sources with supported sketch plane, side, profile dimensions, and positive finite depth."
      };
    }

    if (!isSupportedBooleanExtrudeProfilePair(request)) {
      return {
        code: "UNSUPPORTED_PROFILE",
        message:
          "Boolean extrude feasibility currently supports rectangle add/cut and circle-target cut by rectangle tool."
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
    case "geometry.booleanExtrudes":
      return factories.createBooleanExtrudeMesh({
        operation: request.operation,
        target: request.target,
        tool: request.tool,
        linearDeflection: request.tessellation?.linearDeflection,
        angularDeflection: request.tessellation?.angularDeflection
      });
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
      request.profile.center,
      request.depth,
      request.side ?? "positive"
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
  center: readonly [number, number],
  depth: number,
  side: GeometryKernelExtrudeSide
): Float32Array {
  const mapped = new Float32Array(positions.length);
  const bounds = getPositionBounds(positions);
  const profileCenterX = (bounds.min[0] + bounds.max[0]) / 2;
  const profileCenterY = (bounds.min[1] + bounds.max[1]) / 2;
  const normalOrigin = bounds.min[2];

  for (let index = 0; index < positions.length; index += 3) {
    const profileX = positions[index] - profileCenterX + center[0];
    const profileY = positions[index + 1] - profileCenterY + center[1];
    const normal = mapExtrudeNormal(
      positions[index + 2] - normalOrigin,
      depth,
      side
    );
    const [x, y, z] = mapPlanePoint(sketchPlane, profileX, profileY, normal);

    mapped[index] = x;
    mapped[index + 1] = y;
    mapped[index + 2] = z;
  }

  return mapped;
}

function mapExtrudeNormal(
  positiveNormal: number,
  depth: number,
  side: GeometryKernelExtrudeSide
): number {
  switch (side) {
    case "positive":
      return positiveNormal;
    case "negative":
      return -positiveNormal;
    case "symmetric":
      return positiveNormal - depth / 2;
  }
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
    case "geometry.booleanExtrudes":
      return "Boolean extrude";
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

function isExtrudeSide(value: unknown): value is GeometryKernelExtrudeSide {
  return value === "positive" || value === "negative" || value === "symmetric";
}

function isBooleanOperation(
  value: unknown
): value is GeometryKernelBooleanOperation {
  return value === "add" || value === "cut";
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

function isValidBooleanExtrudeSource(source: BooleanExtrudeSource): boolean {
  return (
    isSketchPlane(source.sketchPlane) &&
    isPositiveFiniteNumber(source.depth) &&
    isExtrudeSide(source.side ?? "positive") &&
    isValidExtrudeProfile(source.profile) &&
    (source.placementFrame === undefined ||
      isValidBooleanExtrudePlacementFrame(source.placementFrame))
  );
}

function isEmptyMesh(mesh: GeometryKernelMeshResult): boolean {
  return (
    mesh.vertexCount <= 0 ||
    mesh.triangleCount <= 0 ||
    mesh.positions.length === 0 ||
    mesh.indices.length === 0
  );
}

function isInvalidMesh(mesh: GeometryKernelMeshResult): boolean {
  return (
    mesh.faceCount < 0 ||
    mesh.positions.length !== mesh.vertexCount * 3 ||
    mesh.indices.length !== mesh.triangleCount * 3 ||
    !Array.from(mesh.positions).every(Number.isFinite) ||
    !Array.from(mesh.indices).every(
      (index) =>
        Number.isInteger(index) && index >= 0 && index < mesh.vertexCount
    )
  );
}

function isSupportedBooleanExtrudeProfilePair(
  request: BooleanExtrudesRequest
): boolean {
  const targetProfile = request.target.profile.kind;
  const toolProfile = request.tool.profile.kind;

  if (targetProfile === "rectangle" && toolProfile === "rectangle") {
    return true;
  }

  return (
    request.operation === "cut" &&
    targetProfile === "circle" &&
    toolProfile === "rectangle"
  );
}

function isVec2(value: readonly [number, number]): boolean {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

function isValidBooleanExtrudePlacementFrame(
  frame: BooleanExtrudePlacementFrame
): boolean {
  return (
    isVec3(frame.origin) &&
    isVec3(frame.uAxis) &&
    isVec3(frame.vAxis) &&
    vectorLength(frame.uAxis) > 0 &&
    vectorLength(frame.vAxis) > 0 &&
    vectorLength(crossVec3(frame.uAxis, frame.vAxis)) > 0
  );
}

function isVec3(value: readonly [number, number, number]): boolean {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

function vectorLength(vector: readonly [number, number, number]): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function crossVec3(
  left: readonly [number, number, number],
  right: readonly [number, number, number]
): readonly [number, number, number] {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0]
  ];
}
