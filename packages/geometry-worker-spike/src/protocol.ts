import type {
  GeometryKernelErrorResponse,
  GeometryKernelRequest,
  GeometryKernelResponse
} from "@web-cad/geometry-kernel";

export type GeometryWorkerSpikeVersion = "geometry-worker-spike.v1";
export type GeometryWorkerSpikeRequestKind =
  "geometry-worker-spike.tessellatePrimitive";

export interface GeometryWorkerSpikeRequest {
  readonly id: string;
  readonly version: GeometryWorkerSpikeVersion;
  readonly kind: GeometryWorkerSpikeRequestKind;
  readonly payload: GeometryKernelRequest;
}

export interface GeometryWorkerSpikeResponse {
  readonly id: string;
  readonly version: GeometryWorkerSpikeVersion;
  readonly kind: GeometryWorkerSpikeRequestKind;
  readonly payloadId: string;
  readonly response: GeometryKernelResponse;
  readonly transferables: readonly ArrayBuffer[];
  readonly timings?: GeometryWorkerSpikeTimings;
  readonly diagnostics?: GeometryWorkerSpikeDiagnostics;
}

export interface GeometryWorkerSpikeTimings {
  readonly occtLoadMs?: number;
  readonly tessellationMs?: number;
  readonly workerExecutionMs?: number;
  readonly geometryKernelMs?: number;
}

export type GeometryWorkerSpikeStage =
  | "requestValidation"
  | "wasmLoad"
  | "tessellation"
  | "worker"
  | "transport"
  | "complete";

export type GeometryWorkerSpikeErrorCode =
  | "WASM_LOAD_FAILED"
  | "UNSUPPORTED_PRIMITIVE"
  | "KERNEL_TESSELLATION_FAILED"
  | "WORKER_TRANSPORT_FAILED"
  | "WORKER_RUNTIME_FAILED";

export type GeometryWorkerWasmLoadStatus = "notRequested" | "loaded" | "failed";

export interface GeometryWorkerSpikeErrorDetails {
  readonly code: GeometryWorkerSpikeErrorCode;
  readonly message: string;
  readonly cause?: string;
}

export interface GeometryWorkerSpikeDiagnostics {
  readonly ok: boolean;
  readonly stage: GeometryWorkerSpikeStage;
  readonly workerStarted: boolean;
  readonly wasmLoadStatus: GeometryWorkerWasmLoadStatus;
  readonly error?: GeometryWorkerSpikeErrorDetails;
}

export interface GeometryWorkerSpike {
  execute(
    request: GeometryWorkerSpikeRequest
  ): Promise<GeometryWorkerSpikeResponse>;
}

export interface GeometryWorkerSpikeOptions {
  readonly delayMs?: number;
}

export function createWorkerSpikeResponse(
  request: GeometryWorkerSpikeRequest,
  response: GeometryKernelResponse,
  transferables: readonly ArrayBuffer[],
  timings?: GeometryWorkerSpikeTimings,
  diagnostics?: GeometryWorkerSpikeDiagnostics
): GeometryWorkerSpikeResponse {
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
}): GeometryWorkerSpikeDiagnostics {
  return {
    ok: true,
    stage: "complete",
    workerStarted: true,
    wasmLoadStatus: input.wasmLoadStatus
  };
}

export function createWorkerErrorDiagnostics(input: {
  readonly stage: GeometryWorkerSpikeStage;
  readonly code: GeometryWorkerSpikeErrorCode;
  readonly message: string;
  readonly wasmLoadStatus?: GeometryWorkerWasmLoadStatus;
  readonly workerStarted?: boolean;
  readonly cause?: string;
}): GeometryWorkerSpikeDiagnostics {
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
}): GeometryWorkerSpikeRequest {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker-spike.v1",
    kind: "geometry-worker-spike.tessellatePrimitive",
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
}): GeometryWorkerSpikeRequest {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker-spike.v1",
    kind: "geometry-worker-spike.tessellatePrimitive",
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

export function createKernelFailureResponse(
  request: GeometryWorkerSpikeRequest,
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
          : "The geometry worker spike failed to execute the kernel request."
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
