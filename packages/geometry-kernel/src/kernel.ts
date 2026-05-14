export type GeometryKernelVersion = "geometry-kernel.v1";
export type GeometryKernelOp = "geometry.tessellateBox";
export type GeometryKernelPrimitive = "box";

export interface BoxGeometryDimensions {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
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

export type GeometryKernelRequest = TessellateBoxRequest;

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

export type GeometryKernelMeshFactory = (
  input: BoxGeometryDimensions & TessellationOptions
) => Promise<GeometryKernelMeshResult>;

export async function executeGeometryKernelRequestWithMeshFactory(
  createBoxMesh: GeometryKernelMeshFactory,
  request: GeometryKernelRequest
): Promise<GeometryKernelResponse> {
  const validationError = validateRequest(request);

  if (validationError) {
    return errorResponse(request, validationError);
  }

  try {
    const mesh = await createBoxMesh({
      ...request.dimensions,
      linearDeflection: request.tessellation?.linearDeflection,
      angularDeflection: request.tessellation?.angularDeflection
    });

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
