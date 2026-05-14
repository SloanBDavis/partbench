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
}

export interface GeometryWorkerSpikeTimings {
  readonly occtLoadMs?: number;
  readonly tessellationMs?: number;
  readonly workerExecutionMs?: number;
  readonly geometryKernelMs?: number;
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
  timings?: GeometryWorkerSpikeTimings
): GeometryWorkerSpikeResponse {
  return {
    id: request.id,
    version: request.version,
    kind: request.kind,
    payloadId: request.payload.id,
    response,
    transferables,
    ...(timings ? { timings } : {})
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
