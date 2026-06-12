export type GeometryKernelVersion = "geometry-kernel.v1";
export type GeometryKernelExactExportFormat = "step";
export type GeometryKernelExactExportCapabilityStatus = "unavailable";

export interface GeometryKernelExactExportCapability {
  readonly format: GeometryKernelExactExportFormat;
  readonly label: "STEP";
  readonly status: GeometryKernelExactExportCapabilityStatus;
  readonly writerAvailable: false;
  readonly boundary: "geometry-kernel";
  readonly reason: string;
}

export type GeometryKernelOp =
  | "geometry.tessellateBox"
  | "geometry.tessellateCylinder"
  | "geometry.tessellateSphere"
  | "geometry.tessellateCone"
  | "geometry.tessellateTorus"
  | "geometry.tessellateExtrude"
  | "geometry.revolveProfile"
  | "geometry.booleanExtrudes"
  | "geometry.hole"
  | "geometry.edgeFinish"
  | "geometry.exactBodyMetadata";
export type GeometryKernelPrimitive =
  | "box"
  | "cylinder"
  | "sphere"
  | "cone"
  | "torus"
  | "extrude"
  | "revolve"
  | "boolean"
  | "hole"
  | "edgeFinish";
export type GeometryKernelSketchPlane = "XY" | "XZ" | "YZ";
export type GeometryKernelExtrudeProfileKind = "rectangle" | "circle";
export type GeometryKernelExtrudeSide = "positive" | "negative" | "symmetric";
export type GeometryKernelBooleanOperation = "add" | "cut";
export type GeometryKernelHoleDepthMode = "blind" | "throughAll";
export type GeometryKernelHoleDirection = "positive" | "negative";
export type GeometryKernelEdgeFinishOperation = "chamfer" | "fillet";
export type GeometryKernelRectangleEdgeRole =
  | "start:uMin"
  | "start:uMax"
  | "start:vMin"
  | "start:vMax"
  | "end:uMin"
  | "end:uMax"
  | "end:vMin"
  | "end:vMax"
  | "longitudinal:uMin:vMin"
  | "longitudinal:uMin:vMax"
  | "longitudinal:uMax:vMin"
  | "longitudinal:uMax:vMax";
export type GeometryKernelCircularEdgeRole = "start:circular" | "end:circular";
export type GeometryKernelEdgeFinishEdgeRole =
  | GeometryKernelRectangleEdgeRole
  | GeometryKernelCircularEdgeRole;

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

export type RevolveGeometryProfile = ExtrudeGeometryProfile;

export interface RevolveGeometryAxis {
  readonly start: readonly [number, number];
  readonly end: readonly [number, number];
}

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

export interface RevolveProfileRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.revolveProfile";
  readonly sketchPlane: GeometryKernelSketchPlane;
  readonly profile: RevolveGeometryProfile;
  readonly axis: RevolveGeometryAxis;
  readonly angleDegrees: number;
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

export interface HoleToolSource {
  readonly sketchPlane: GeometryKernelSketchPlane;
  readonly circle: CircleExtrudeProfile;
  readonly depthMode: GeometryKernelHoleDepthMode;
  readonly depth?: number;
  readonly direction?: GeometryKernelHoleDirection;
  readonly placementFrame?: BooleanExtrudePlacementFrame;
}

export interface HoleRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.hole";
  readonly target: BooleanExtrudeSource;
  readonly tool: HoleToolSource;
  readonly tessellation?: TessellationOptions;
}

export type EdgeFinishRequest =
  | ChamferEdgeFinishRequest
  | FilletEdgeFinishRequest;

export interface ChamferEdgeFinishRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.edgeFinish";
  readonly operation: "chamfer";
  readonly target: BooleanExtrudeSource;
  readonly edgeStableId: string;
  readonly distance: number;
  readonly radius?: never;
  readonly tessellation?: TessellationOptions;
}

export interface FilletEdgeFinishRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.edgeFinish";
  readonly operation: "fillet";
  readonly target: BooleanExtrudeSource;
  readonly edgeStableId: string;
  readonly radius: number;
  readonly distance?: never;
  readonly tessellation?: TessellationOptions;
}

export type ExactBodyMetadataSource =
  | ExactExtrudeMetadataSource
  | ExactBooleanExtrudesMetadataSource
  | ExactRevolveMetadataSource
  | ExactHoleMetadataSource
  | ExactEdgeFinishMetadataSource;

export interface ExactExtrudeMetadataSource extends BooleanExtrudeSource {
  readonly kind: "extrude";
}

export interface ExactBooleanExtrudesMetadataSource {
  readonly kind: "booleanExtrudes";
  readonly operation: GeometryKernelBooleanOperation;
  readonly target: BooleanExtrudeSource;
  readonly tool: BooleanExtrudeSource;
}

export interface ExactRevolveMetadataSource {
  readonly kind: "revolve";
  readonly sketchPlane: GeometryKernelSketchPlane;
  readonly profile: RevolveGeometryProfile;
  readonly axis: RevolveGeometryAxis;
  readonly angleDegrees: number;
  readonly placementFrame?: BooleanExtrudePlacementFrame;
}

export interface ExactHoleMetadataSource {
  readonly kind: "hole";
  readonly target: BooleanExtrudeSource;
  readonly tool: HoleToolSource;
}

export type ExactEdgeFinishMetadataSource =
  | {
      readonly kind: "edgeFinish";
      readonly operation: "chamfer";
      readonly target: BooleanExtrudeSource;
      readonly edgeStableId: string;
      readonly distance: number;
      readonly radius?: never;
    }
  | {
      readonly kind: "edgeFinish";
      readonly operation: "fillet";
      readonly target: BooleanExtrudeSource;
      readonly edgeStableId: string;
      readonly radius: number;
      readonly distance?: never;
    };

export interface ExactBodyMetadataRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.exactBodyMetadata";
  readonly source: ExactBodyMetadataSource;
}

export type GeometryKernelRequest =
  | TessellateBoxRequest
  | TessellateCylinderRequest
  | TessellateSphereRequest
  | TessellateConeRequest
  | TessellateTorusRequest
  | TessellateExtrudeRequest
  | RevolveProfileRequest
  | BooleanExtrudesRequest
  | HoleRequest
  | EdgeFinishRequest
  | ExactBodyMetadataRequest;

export type GeometryKernelMeshRequest = Exclude<
  GeometryKernelRequest,
  ExactBodyMetadataRequest
>;

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

export type GeometryKernelSuccessResponse =
  | GeometryKernelMeshSuccessResponse
  | GeometryKernelExactBodyMetadataSuccessResponse;

export interface GeometryKernelMeshSuccessResponse {
  readonly ok: true;
  readonly id: string;
  readonly op: GeometryKernelMeshRequest["op"];
  readonly mesh: SerializableMeshData;
  readonly warnings: readonly string[];
}

export interface GeometryKernelExactBodyMetadataSuccessResponse {
  readonly ok: true;
  readonly id: string;
  readonly op: "geometry.exactBodyMetadata";
  readonly metadata: GeometryKernelExactBodyMetadata;
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
  | "UNSUPPORTED_EDGE"
  | "INVALID_EDGE_ROLE"
  | "EDGE_FINISH_TOO_LARGE"
  | "INVALID_PLACEMENT"
  | "KERNEL_FAILURE"
  | "EMPTY_RESULT"
  | "INVALID_RESULT"
  | "UNAVAILABLE_BINDING";

export interface GeometryKernelError {
  readonly code: GeometryKernelErrorCode;
  readonly message: string;
}

export interface GeometryKernelBounds {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

export interface GeometryKernelTopologyCounts {
  readonly solidCount: number;
  readonly faceCount: number;
  readonly edgeCount: number;
  readonly vertexCount: number;
}

export type GeometryKernelMeasurementSource = "kernel-derived";
export type GeometryKernelMeasurementConfidence = "kernel-derived";

export interface GeometryKernelExactMetadataDiagnostic {
  readonly code: string;
  readonly message: string;
}

export interface GeometryKernelExactBodyMetadata {
  readonly sourceKind: ExactBodyMetadataSource["kind"];
  readonly bounds: GeometryKernelBounds;
  readonly volume: number;
  readonly surfaceArea: number;
  readonly centroid: readonly [number, number, number];
  readonly topologyCounts: GeometryKernelTopologyCounts;
  readonly measurementSource: GeometryKernelMeasurementSource;
  readonly measurementConfidence: GeometryKernelMeasurementConfidence;
  readonly diagnostics: readonly GeometryKernelExactMetadataDiagnostic[];
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

export type GeometryKernelHoleMeshFactory = (
  input: Omit<HoleRequest, "id" | "version" | "op"> & TessellationOptions
) => Promise<GeometryKernelMeshResult>;

export type GeometryKernelEdgeFinishMeshFactoryInput =
  | (Omit<ChamferEdgeFinishRequest, "id" | "version" | "op"> &
      TessellationOptions)
  | (Omit<FilletEdgeFinishRequest, "id" | "version" | "op"> &
      TessellationOptions);

export type GeometryKernelEdgeFinishMeshFactory = (
  input: GeometryKernelEdgeFinishMeshFactoryInput
) => Promise<GeometryKernelMeshResult>;

export type GeometryKernelRevolveProfileMeshFactory = (
  input: Omit<RevolveProfileRequest, "id" | "version" | "op"> &
    TessellationOptions
) => Promise<GeometryKernelMeshResult>;

export type GeometryKernelExactBodyMetadataFactory = (
  input: Omit<ExactBodyMetadataRequest, "id" | "version" | "op">
) => Promise<GeometryKernelExactBodyMetadata>;

export interface GeometryKernelMeshFactories {
  readonly createBoxMesh: GeometryKernelBoxMeshFactory;
  readonly createCylinderMesh: GeometryKernelCylinderMeshFactory;
  readonly createSphereMesh: GeometryKernelSphereMeshFactory;
  readonly createConeMesh: GeometryKernelConeMeshFactory;
  readonly createTorusMesh: GeometryKernelTorusMeshFactory;
  readonly createBooleanExtrudeMesh: GeometryKernelBooleanExtrudeMeshFactory;
  readonly createHoleMesh?: GeometryKernelHoleMeshFactory;
  readonly createEdgeFinishMesh?: GeometryKernelEdgeFinishMeshFactory;
  readonly createRevolveProfileMesh?: GeometryKernelRevolveProfileMeshFactory;
  readonly createExactBodyMetadata?: GeometryKernelExactBodyMetadataFactory;
}

export type GeometryKernelResponseForRequest<T extends GeometryKernelRequest> =
  T extends ExactBodyMetadataRequest
    ?
        | GeometryKernelExactBodyMetadataSuccessResponse
        | GeometryKernelErrorResponse
    : GeometryKernelMeshSuccessResponse | GeometryKernelErrorResponse;

export function getGeometryKernelExactExportCapabilities(): readonly GeometryKernelExactExportCapability[] {
  return [
    {
      format: "step",
      label: "STEP",
      status: "unavailable",
      writerAvailable: false,
      boundary: "geometry-kernel",
      reason:
        "No STEP exchange writer binding is exposed through the geometry kernel boundary yet."
    }
  ];
}

export async function executeGeometryKernelRequestWithMeshFactory<
  T extends GeometryKernelRequest
>(
  factories: GeometryKernelMeshFactories,
  request: T
): Promise<GeometryKernelResponseForRequest<T>> {
  const validationError = validateRequest(request);

  if (validationError) {
    return errorResponse(
      request,
      validationError
    ) as GeometryKernelResponseForRequest<T>;
  }

  try {
    if (request.op === "geometry.exactBodyMetadata") {
      const metadata = await createExactBodyMetadata(factories, request);

      if (isInvalidExactBodyMetadata(metadata)) {
        return errorResponse(request, {
          code: "INVALID_RESULT",
          message:
            "The geometry kernel returned exact metadata with invalid or non-finite values."
        }) as GeometryKernelResponseForRequest<T>;
      }

      return {
        ok: true,
        id: request.id,
        op: request.op,
        metadata,
        warnings: []
      } as unknown as GeometryKernelResponseForRequest<T>;
    }

    const mesh = await createMesh(factories, request);

    if (isEmptyMesh(mesh)) {
      return errorResponse(request, {
        code: "EMPTY_RESULT",
        message: "The geometry kernel returned an empty or invalid mesh."
      }) as GeometryKernelResponseForRequest<T>;
    }

    if (isInvalidMesh(mesh)) {
      return errorResponse(request, {
        code: "INVALID_RESULT",
        message:
          "The geometry kernel returned mesh data with inconsistent counts or invalid values."
      }) as GeometryKernelResponseForRequest<T>;
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
    } as unknown as GeometryKernelResponseForRequest<T>;
  } catch (error) {
    return errorResponse(
      request,
      toGeometryKernelError(error)
    ) as GeometryKernelResponseForRequest<T>;
  }
}

export function getGeometryResponseTransferables(
  response: GeometryKernelResponse
): readonly ArrayBuffer[] {
  if (!response.ok || !("mesh" in response)) {
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
  } else if (request.op === "geometry.revolveProfile") {
    if (
      !isSketchPlane(request.sketchPlane) ||
      !isValidExtrudeProfile(request.profile) ||
      !isValidRevolveAxis(request.axis) ||
      !isPositiveFiniteNumber(request.angleDegrees) ||
      request.angleDegrees > 360
    ) {
      return {
        code: "INVALID_DIMENSIONS",
        message:
          "Revolve profile requests require a supported sketch plane, rectangle or circle profile, non-zero finite axis, and positive finite angle no greater than 360 degrees."
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
  } else if (request.op === "geometry.hole") {
    if (
      !isValidBooleanExtrudeSource(request.target) ||
      !isValidHoleToolSource(request.tool)
    ) {
      return {
        code: "INVALID_DIMENSIONS",
        message:
          "Hole requests require a supported authored extrude target source, circular tool source, valid depth mode, direction, and finite positive blind depth when provided."
      };
    }
  } else if (request.op === "geometry.edgeFinish") {
    const edgeFinishError = validateEdgeFinishRequest(request);

    if (edgeFinishError) {
      return edgeFinishError;
    }
  } else if (request.op === "geometry.exactBodyMetadata") {
    const metadataSourceError = validateExactBodyMetadataSource(request.source);

    if (metadataSourceError) {
      return metadataSourceError;
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
    "tessellation" in request &&
    (!isOptionalPositiveFiniteNumber(request.tessellation?.linearDeflection) ||
      !isOptionalPositiveFiniteNumber(request.tessellation?.angularDeflection))
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
  request: GeometryKernelMeshRequest
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
    case "geometry.revolveProfile":
      return createRevolveProfileMesh(factories, request);
    case "geometry.booleanExtrudes":
      return factories.createBooleanExtrudeMesh({
        operation: request.operation,
        target: request.target,
        tool: request.tool,
        linearDeflection: request.tessellation?.linearDeflection,
        angularDeflection: request.tessellation?.angularDeflection
      });
    case "geometry.hole":
      return createHoleMesh(factories, request);
    case "geometry.edgeFinish":
      return createEdgeFinishMesh(factories, request);
  }
}

function createEdgeFinishMesh(
  factories: GeometryKernelMeshFactories,
  request: EdgeFinishRequest
): Promise<GeometryKernelMeshResult> {
  if (!factories.createEdgeFinishMesh) {
    return Promise.reject({
      code: "UNAVAILABLE_BINDING",
      message:
        "Edge finish tessellation requires an OCCT edge-finish mesh factory."
    } satisfies GeometryKernelError);
  }

  if (request.operation === "chamfer") {
    return factories.createEdgeFinishMesh({
      operation: request.operation,
      target: request.target,
      edgeStableId: request.edgeStableId,
      distance: request.distance,
      linearDeflection: request.tessellation?.linearDeflection,
      angularDeflection: request.tessellation?.angularDeflection
    });
  }

  return factories.createEdgeFinishMesh({
    operation: request.operation,
    target: request.target,
    edgeStableId: request.edgeStableId,
    radius: request.radius,
    linearDeflection: request.tessellation?.linearDeflection,
    angularDeflection: request.tessellation?.angularDeflection
  });
}

function createHoleMesh(
  factories: GeometryKernelMeshFactories,
  request: HoleRequest
): Promise<GeometryKernelMeshResult> {
  if (!factories.createHoleMesh) {
    return Promise.reject({
      code: "UNAVAILABLE_BINDING",
      message: "Hole tessellation requires an OCCT hole mesh factory."
    } satisfies GeometryKernelError);
  }

  return factories.createHoleMesh({
    target: request.target,
    tool: request.tool,
    linearDeflection: request.tessellation?.linearDeflection,
    angularDeflection: request.tessellation?.angularDeflection
  });
}

function createRevolveProfileMesh(
  factories: GeometryKernelMeshFactories,
  request: RevolveProfileRequest
): Promise<GeometryKernelMeshResult> {
  if (!factories.createRevolveProfileMesh) {
    return Promise.reject({
      code: "UNAVAILABLE_BINDING",
      message:
        "Revolve profile tessellation requires an OCCT revolve mesh factory."
    } satisfies GeometryKernelError);
  }

  return factories.createRevolveProfileMesh({
    sketchPlane: request.sketchPlane,
    profile: request.profile,
    axis: request.axis,
    angleDegrees: request.angleDegrees,
    linearDeflection: request.tessellation?.linearDeflection,
    angularDeflection: request.tessellation?.angularDeflection
  });
}

function createExactBodyMetadata(
  factories: GeometryKernelMeshFactories,
  request: ExactBodyMetadataRequest
): Promise<GeometryKernelExactBodyMetadata> {
  if (!factories.createExactBodyMetadata) {
    return Promise.reject({
      code: "UNAVAILABLE_BINDING",
      message:
        "Exact body metadata requires an exact metadata factory with OCCT mass-property and bounds bindings."
    } satisfies GeometryKernelError);
  }

  return factories.createExactBodyMetadata({
    source: request.source
  });
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
    case "geometry.revolveProfile":
      return "Revolve profile";
    case "geometry.booleanExtrudes":
      return "Boolean extrude";
    case "geometry.hole":
      return "Hole";
    case "geometry.edgeFinish":
      return "Edge finish";
    case "geometry.exactBodyMetadata":
      return "Exact body metadata";
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

function toGeometryKernelError(error: unknown): GeometryKernelError {
  if (isGeometryKernelError(error)) {
    return error;
  }

  return {
    code: "KERNEL_FAILURE",
    message:
      error instanceof Error
        ? error.message
        : "The geometry kernel failed to execute the request."
  };
}

function isGeometryKernelError(error: unknown): error is GeometryKernelError {
  if (
    !error ||
    typeof error !== "object" ||
    !("code" in error) ||
    !("message" in error)
  ) {
    return false;
  }

  const candidate = error as {
    readonly code?: unknown;
    readonly message?: unknown;
  };

  return (
    typeof candidate.message === "string" &&
    isGeometryKernelErrorCode(candidate.code)
  );
}

function isGeometryKernelErrorCode(
  value: unknown
): value is GeometryKernelErrorCode {
  return (
    value === "INVALID_DIMENSIONS" ||
    value === "INVALID_TESSELLATION_OPTIONS" ||
    value === "UNSUPPORTED_PROFILE" ||
    value === "UNSUPPORTED_EDGE" ||
    value === "INVALID_EDGE_ROLE" ||
    value === "EDGE_FINISH_TOO_LARGE" ||
    value === "INVALID_PLACEMENT" ||
    value === "KERNEL_FAILURE" ||
    value === "EMPTY_RESULT" ||
    value === "INVALID_RESULT" ||
    value === "UNAVAILABLE_BINDING"
  );
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

function isHoleDepthMode(value: unknown): value is GeometryKernelHoleDepthMode {
  return value === "blind" || value === "throughAll";
}

function isHoleDirection(value: unknown): value is GeometryKernelHoleDirection {
  return value === "positive" || value === "negative";
}

function isValidEdgeFinishOperation(
  value: unknown
): value is GeometryKernelEdgeFinishOperation {
  return value === "chamfer" || value === "fillet";
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

function isValidRevolveAxis(axis: RevolveGeometryAxis): boolean {
  return (
    isVec2(axis.start) &&
    isVec2(axis.end) &&
    Math.hypot(axis.end[0] - axis.start[0], axis.end[1] - axis.start[1]) > 0
  );
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

function isValidHoleToolSource(source: HoleToolSource): boolean {
  return (
    isSketchPlane(source.sketchPlane) &&
    source.circle.kind === "circle" &&
    isValidExtrudeProfile(source.circle) &&
    isHoleDepthMode(source.depthMode) &&
    isHoleDirection(source.direction ?? "positive") &&
    (source.depthMode === "blind"
      ? source.depth !== undefined && isPositiveFiniteNumber(source.depth)
      : source.depth === undefined) &&
    (source.placementFrame === undefined ||
      isValidBooleanExtrudePlacementFrame(source.placementFrame))
  );
}

function isValidEdgeFinishAmount(request: EdgeFinishRequest): boolean {
  if (
    typeof request.edgeStableId !== "string" ||
    request.edgeStableId.trim().length === 0
  ) {
    return false;
  }

  if (request.operation === "chamfer") {
    return (
      isPositiveFiniteNumber(request.distance) &&
      !("radius" in request && request.radius !== undefined)
    );
  }

  if (request.operation === "fillet") {
    return (
      isPositiveFiniteNumber(request.radius) &&
      !("distance" in request && request.distance !== undefined)
    );
  }

  return false;
}

const RECTANGLE_EDGE_FINISH_ROLES = [
  "start:uMin",
  "start:uMax",
  "start:vMin",
  "start:vMax",
  "end:uMin",
  "end:uMax",
  "end:vMin",
  "end:vMax",
  "longitudinal:uMin:vMin",
  "longitudinal:uMin:vMax",
  "longitudinal:uMax:vMin",
  "longitudinal:uMax:vMax"
] satisfies readonly GeometryKernelRectangleEdgeRole[];

const CIRCULAR_EDGE_FINISH_ROLES = [
  "start:circular",
  "end:circular"
] satisfies readonly GeometryKernelCircularEdgeRole[];

function parseEdgeFinishEdgeRole(
  stableId: string
): GeometryKernelEdgeFinishEdgeRole | undefined {
  if (!stableId.startsWith("generated:edge:")) {
    return undefined;
  }

  return [...RECTANGLE_EDGE_FINISH_ROLES, ...CIRCULAR_EDGE_FINISH_ROLES].find(
    (role) => stableId.endsWith(`:${role}`)
  );
}

function isRectangleEdgeFinishRole(
  role: GeometryKernelEdgeFinishEdgeRole
): role is GeometryKernelRectangleEdgeRole {
  return (RECTANGLE_EDGE_FINISH_ROLES as readonly string[]).includes(role);
}

function isEdgeFinishAmountTooLarge(
  request: EdgeFinishRequest,
  role: GeometryKernelRectangleEdgeRole
): boolean {
  const maxAmount = getRectangleEdgeFinishMaximumAmount(request.target, role);
  const amount =
    request.operation === "chamfer" ? request.distance : request.radius;

  return amount >= maxAmount;
}

function getRectangleEdgeFinishMaximumAmount(
  target: BooleanExtrudeSource,
  role: GeometryKernelRectangleEdgeRole
): number {
  if (target.profile.kind !== "rectangle") {
    return 0;
  }

  const profile = target.profile;
  const profileWidth = profile.width;
  const profileHeight = profile.height;
  const depth = target.depth;

  if (role.startsWith("longitudinal:")) {
    return Math.min(profileWidth, profileHeight) / 2;
  }

  const [, profileEdgeRole] = role.split(":") as [
    "start" | "end",
    "uMin" | "uMax" | "vMin" | "vMax"
  ];

  return profileEdgeRole === "uMin" || profileEdgeRole === "uMax"
    ? Math.min(profileWidth, depth) / 2
    : Math.min(profileHeight, depth) / 2;
}

function validateEdgeFinishRequest(
  request: EdgeFinishRequest
): GeometryKernelError | undefined {
  if (
    !isValidBooleanExtrudeSource(request.target) ||
    !isValidEdgeFinishOperation(request.operation) ||
    !isValidEdgeFinishAmount(request)
  ) {
    return {
      code: "INVALID_DIMENSIONS",
      message:
        "Edge finish requests require a supported authored extrude target source, operation chamfer or fillet, one generated edge stable ID, and a positive finite distance or radius."
    };
  }

  if (request.target.profile.kind !== "rectangle") {
    return {
      code: "UNSUPPORTED_PROFILE",
      message:
        "Edge finish feasibility currently supports rectangle extrude targets only."
    };
  }

  const edgeRole = parseEdgeFinishEdgeRole(request.edgeStableId);

  if (!edgeRole) {
    return {
      code: "INVALID_EDGE_ROLE",
      message:
        "Edge finish requests require a generated rectangle edge stable ID with a supported semantic edge role."
    };
  }

  if (!isRectangleEdgeFinishRole(edgeRole)) {
    return {
      code: "UNSUPPORTED_EDGE",
      message:
        "Edge finish feasibility currently supports generated rectangle extrude edges only."
    };
  }

  if (isEdgeFinishAmountTooLarge(request, edgeRole)) {
    return {
      code: "EDGE_FINISH_TOO_LARGE",
      message:
        "Edge finish distance or radius is too large for the selected rectangle edge in this feasibility path."
    };
  }

  return undefined;
}

function validateExactBodyMetadataSource(
  source: ExactBodyMetadataSource
): GeometryKernelError | undefined {
  if (source.kind === "extrude") {
    return isValidBooleanExtrudeSource(source)
      ? undefined
      : createInvalidExactBodyMetadataSourceError();
  }

  if (source.kind === "booleanExtrudes") {
    const request: BooleanExtrudesRequest = {
      id: "exact-metadata-validation",
      version: "geometry-kernel.v1",
      op: "geometry.booleanExtrudes",
      operation: source.operation,
      target: source.target,
      tool: source.tool
    };

    return isBooleanOperation(source.operation) &&
      isValidBooleanExtrudeSource(source.target) &&
      isValidBooleanExtrudeSource(source.tool) &&
      isSupportedBooleanExtrudeProfilePair(request)
      ? undefined
      : createInvalidExactBodyMetadataSourceError();
  }

  if (source.kind === "revolve") {
    return isSketchPlane(source.sketchPlane) &&
      isValidExtrudeProfile(source.profile) &&
      isValidRevolveAxis(source.axis) &&
      isPositiveFiniteNumber(source.angleDegrees) &&
      source.angleDegrees <= 360 &&
      (source.placementFrame === undefined ||
        isValidBooleanExtrudePlacementFrame(source.placementFrame))
      ? undefined
      : createInvalidExactBodyMetadataSourceError();
  }

  if (source.kind === "hole") {
    return isValidBooleanExtrudeSource(source.target) &&
      isValidHoleToolSource(source.tool)
      ? undefined
      : createInvalidExactBodyMetadataSourceError();
  }

  if (source.kind === "edgeFinish") {
    const request: EdgeFinishRequest =
      source.operation === "chamfer"
        ? {
            id: "exact-metadata-validation",
            version: "geometry-kernel.v1",
            op: "geometry.edgeFinish",
            operation: source.operation,
            target: source.target,
            edgeStableId: source.edgeStableId,
            distance: source.distance
          }
        : {
            id: "exact-metadata-validation",
            version: "geometry-kernel.v1",
            op: "geometry.edgeFinish",
            operation: source.operation,
            target: source.target,
            edgeStableId: source.edgeStableId,
            radius: source.radius
          };

    return validateEdgeFinishRequest(request);
  }

  return createInvalidExactBodyMetadataSourceError();
}

function createInvalidExactBodyMetadataSourceError(): GeometryKernelError {
  return {
    code: "INVALID_DIMENSIONS",
    message:
      "Exact body metadata requests require supported extrude, booleanExtrudes, revolve, hole, or edgeFinish source data with finite positive dimensions."
  };
}

function isEmptyMesh(mesh: GeometryKernelMeshResult): boolean {
  return (
    mesh.vertexCount <= 0 ||
    mesh.triangleCount <= 0 ||
    mesh.positions.length === 0 ||
    mesh.indices.length === 0
  );
}

function isInvalidExactBodyMetadata(
  metadata: GeometryKernelExactBodyMetadata
): boolean {
  return (
    (metadata.sourceKind !== "extrude" &&
      metadata.sourceKind !== "booleanExtrudes" &&
      metadata.sourceKind !== "revolve" &&
      metadata.sourceKind !== "hole" &&
      metadata.sourceKind !== "edgeFinish") ||
    !isVec3(metadata.bounds.min) ||
    !isVec3(metadata.bounds.max) ||
    !isVec3(metadata.centroid) ||
    !isFiniteNumber(metadata.volume) ||
    !isFiniteNumber(metadata.surfaceArea) ||
    metadata.volume < 0 ||
    metadata.surfaceArea < 0 ||
    !isNonNegativeInteger(metadata.topologyCounts.solidCount) ||
    !isNonNegativeInteger(metadata.topologyCounts.faceCount) ||
    !isNonNegativeInteger(metadata.topologyCounts.edgeCount) ||
    !isNonNegativeInteger(metadata.topologyCounts.vertexCount) ||
    metadata.measurementSource !== "kernel-derived" ||
    metadata.measurementConfidence !== "kernel-derived" ||
    !Array.isArray(metadata.diagnostics) ||
    metadata.diagnostics.some(
      (diagnostic) =>
        typeof diagnostic.code !== "string" ||
        diagnostic.code.trim().length === 0 ||
        typeof diagnostic.message !== "string" ||
        diagnostic.message.trim().length === 0
    )
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

function isFiniteNumber(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
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
