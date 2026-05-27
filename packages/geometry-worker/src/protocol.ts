import type {
  BooleanExtrudeSource,
  BooleanExtrudesRequest,
  ExactBodyMetadataRequest,
  GeometryKernelErrorResponse,
  GeometryKernelRequest,
  GeometryKernelResponseForRequest,
  GeometryKernelResponse,
  GeometryKernelBooleanOperation,
  GeometryKernelExtrudeSide,
  GeometryKernelSketchPlane,
  RevolveProfileRequest,
  TessellateBoxRequest,
  TessellateConeRequest,
  TessellateCylinderRequest,
  TessellateExtrudeRequest,
  TessellateSphereRequest,
  TessellateTorusRequest
} from "@web-cad/geometry-kernel";

export type { GeometryKernelExactBodyMetadata } from "@web-cad/geometry-kernel";

export type GeometryWorkerVersion = "geometry-worker.v1";
export type GeometryWorkerRequestKind =
  | "geometry-worker.tessellatePrimitive"
  | "geometry-worker.tessellateFeature"
  | "geometry-worker.booleanFeature"
  | "geometry-worker.exactMetadata";

export interface GeometryWorkerRequest<
  TPayload extends GeometryKernelRequest = GeometryKernelRequest
> {
  readonly id: string;
  readonly version: GeometryWorkerVersion;
  readonly kind: GeometryWorkerRequestKind;
  readonly payload: TPayload;
}

export interface GeometryWorkerResponse<
  TPayload extends GeometryKernelRequest = GeometryKernelRequest
> {
  readonly id: string;
  readonly version: GeometryWorkerVersion;
  readonly kind: GeometryWorkerRequestKind;
  readonly payloadId: string;
  readonly response: GeometryKernelResponseForRequest<TPayload>;
  readonly transferables: readonly ArrayBuffer[];
  readonly timings?: GeometryWorkerTimings;
  readonly diagnostics?: GeometryWorkerDiagnostics;
}

export interface GeometryWorkerTimings {
  readonly occtLoadMs?: number;
  readonly tessellationMs?: number;
  readonly workerExecutionMs?: number;
  readonly geometryKernelMs?: number;
}

export type GeometryWorkerStage =
  | "requestValidation"
  | "wasmLoad"
  | "tessellation"
  | "worker"
  | "transport"
  | "complete";

export type GeometryWorkerErrorCode =
  | "WASM_LOAD_FAILED"
  | "UNSUPPORTED_PRIMITIVE"
  | "KERNEL_TESSELLATION_FAILED"
  | "WORKER_TRANSPORT_FAILED"
  | "WORKER_RUNTIME_FAILED";

export type GeometryWorkerWasmLoadStatus = "notRequested" | "loaded" | "failed";

export interface GeometryWorkerErrorDetails {
  readonly code: GeometryWorkerErrorCode;
  readonly message: string;
  readonly cause?: string;
}

export interface GeometryWorkerDiagnostics {
  readonly ok: boolean;
  readonly stage: GeometryWorkerStage;
  readonly workerStarted: boolean;
  readonly wasmLoadStatus: GeometryWorkerWasmLoadStatus;
  readonly error?: GeometryWorkerErrorDetails;
}

export interface GeometryWorker {
  execute<TPayload extends GeometryKernelRequest>(
    request: GeometryWorkerRequest<TPayload>
  ): Promise<GeometryWorkerResponse<TPayload>>;
}

export interface GeometryWorkerOptions {
  readonly delayMs?: number;
}

export function createGeometryWorkerResponse(
  request: GeometryWorkerRequest,
  response: GeometryKernelResponse,
  transferables: readonly ArrayBuffer[],
  timings?: GeometryWorkerTimings,
  diagnostics?: GeometryWorkerDiagnostics
): GeometryWorkerResponse {
  return {
    id: request.id,
    version: request.version,
    kind: request.kind,
    payloadId: request.payload.id,
    response,
    transferables,
    ...(timings ? { timings } : {}),
    ...(diagnostics ? { diagnostics } : {})
  };
}

export function createWorkerSuccessDiagnostics(input: {
  readonly wasmLoadStatus: GeometryWorkerWasmLoadStatus;
}): GeometryWorkerDiagnostics {
  return {
    ok: true,
    stage: "complete",
    workerStarted: true,
    wasmLoadStatus: input.wasmLoadStatus
  };
}

export function createWorkerErrorDiagnostics(input: {
  readonly stage: GeometryWorkerStage;
  readonly code: GeometryWorkerErrorCode;
  readonly message: string;
  readonly wasmLoadStatus?: GeometryWorkerWasmLoadStatus;
  readonly workerStarted?: boolean;
  readonly cause?: string;
}): GeometryWorkerDiagnostics {
  return {
    ok: false,
    stage: input.stage,
    workerStarted: input.workerStarted ?? true,
    wasmLoadStatus: input.wasmLoadStatus ?? "notRequested",
    error: {
      code: input.code,
      message: input.message,
      ...(input.cause ? { cause: input.cause } : {})
    }
  };
}

export function createBoxTessellationWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}): GeometryWorkerRequest<TessellateBoxRequest> {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.tessellatePrimitive",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.tessellateBox",
      dimensions: {
        width: input.width,
        height: input.height,
        depth: input.depth
      },
      ...(tessellation ? { tessellation } : {})
    }
  };
}

export function createCylinderTessellationWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly radius: number;
  readonly height: number;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}): GeometryWorkerRequest<TessellateCylinderRequest> {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.tessellatePrimitive",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.tessellateCylinder",
      dimensions: {
        radius: input.radius,
        height: input.height
      },
      ...(tessellation ? { tessellation } : {})
    }
  };
}

export function createSphereTessellationWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly radius: number;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}): GeometryWorkerRequest<TessellateSphereRequest> {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.tessellatePrimitive",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.tessellateSphere",
      dimensions: {
        radius: input.radius
      },
      ...(tessellation ? { tessellation } : {})
    }
  };
}

export function createConeTessellationWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly radius: number;
  readonly height: number;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}): GeometryWorkerRequest<TessellateConeRequest> {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.tessellatePrimitive",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.tessellateCone",
      dimensions: {
        radius: input.radius,
        height: input.height
      },
      ...(tessellation ? { tessellation } : {})
    }
  };
}

export function createTorusTessellationWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly majorRadius: number;
  readonly minorRadius: number;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}): GeometryWorkerRequest<TessellateTorusRequest> {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.tessellatePrimitive",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.tessellateTorus",
      dimensions: {
        majorRadius: input.majorRadius,
        minorRadius: input.minorRadius
      },
      ...(tessellation ? { tessellation } : {})
    }
  };
}

export function createExtrudeTessellationWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly sketchPlane: GeometryKernelSketchPlane;
  readonly profile:
    | {
        readonly kind: "rectangle";
        readonly center: readonly [number, number];
        readonly width: number;
        readonly height: number;
      }
    | {
        readonly kind: "circle";
        readonly center: readonly [number, number];
        readonly radius: number;
      };
  readonly depth: number;
  readonly side?: GeometryKernelExtrudeSide;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}): GeometryWorkerRequest<TessellateExtrudeRequest> {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.tessellateFeature",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.tessellateExtrude",
      sketchPlane: input.sketchPlane,
      profile: input.profile,
      depth: input.depth,
      side: input.side,
      ...(tessellation ? { tessellation } : {})
    }
  };
}

export function createRevolveProfileWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly sketchPlane: GeometryKernelSketchPlane;
  readonly profile:
    | {
        readonly kind: "rectangle";
        readonly center: readonly [number, number];
        readonly width: number;
        readonly height: number;
      }
    | {
        readonly kind: "circle";
        readonly center: readonly [number, number];
        readonly radius: number;
      };
  readonly axis: {
    readonly start: readonly [number, number];
    readonly end: readonly [number, number];
  };
  readonly angleDegrees: number;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}): GeometryWorkerRequest<RevolveProfileRequest> {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.tessellateFeature",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.revolveProfile",
      sketchPlane: input.sketchPlane,
      profile: input.profile,
      axis: input.axis,
      angleDegrees: input.angleDegrees,
      ...(tessellation ? { tessellation } : {})
    }
  };
}

export function createExtrudeBooleanWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly operation: GeometryKernelBooleanOperation;
  readonly target: BooleanExtrudeSource;
  readonly tool: BooleanExtrudeSource;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}): GeometryWorkerRequest<BooleanExtrudesRequest> {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.booleanFeature",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.booleanExtrudes",
      operation: input.operation,
      target: input.target,
      tool: input.tool,
      ...(tessellation ? { tessellation } : {})
    }
  };
}

export function createExactBodyMetadataWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly source: ExactBodyMetadataRequest["source"];
}): GeometryWorkerRequest<ExactBodyMetadataRequest> {
  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.exactMetadata",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.exactBodyMetadata",
      source: input.source
    }
  };
}

export function createKernelFailureResponse(
  request: GeometryWorkerRequest,
  error: unknown
): GeometryKernelErrorResponse {
  return {
    ok: false,
    id: request.payload.id,
    op: request.payload.op,
    error: {
      code: "KERNEL_FAILURE",
      message:
        error instanceof Error
          ? error.message
          : "The geometry worker failed to execute the kernel request."
    },
    warnings: []
  };
}

export function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function createTessellationOptions(input: {
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}):
  | {
      readonly linearDeflection?: number;
      readonly angularDeflection?: number;
    }
  | undefined {
  if (
    input.linearDeflection === undefined &&
    input.angularDeflection === undefined
  ) {
    return undefined;
  }

  return {
    ...(input.linearDeflection !== undefined
      ? { linearDeflection: input.linearDeflection }
      : {}),
    ...(input.angularDeflection !== undefined
      ? { angularDeflection: input.angularDeflection }
      : {})
  };
}
