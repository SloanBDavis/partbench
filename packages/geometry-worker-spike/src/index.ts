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
}

export interface GeometryWorkerSpike {
  execute(
    request: GeometryWorkerSpikeRequest
  ): Promise<GeometryWorkerSpikeResponse>;
}

export interface GeometryWorkerSpikeOptions {
  readonly delayMs?: number;
}

export class GeometryKernelWorkerSpike implements GeometryWorkerSpike {
  readonly #delayMs: number;

  constructor(options: GeometryWorkerSpikeOptions = {}) {
    this.#delayMs = options.delayMs ?? 0;
  }

  async execute(
    request: GeometryWorkerSpikeRequest
  ): Promise<GeometryWorkerSpikeResponse> {
    if (this.#delayMs > 0) {
      await delay(this.#delayMs);
    }

    try {
      const geometryKernel = await import("@web-cad/geometry-kernel");
      const response = await geometryKernel.executeGeometryKernelRequest(
        request.payload
      );

      return {
        id: request.id,
        version: request.version,
        kind: request.kind,
        payloadId: request.payload.id,
        response,
        transferables: geometryKernel.getGeometryResponseTransferables(response)
      };
    } catch (error) {
      return {
        id: request.id,
        version: request.version,
        kind: request.kind,
        payloadId: request.payload.id,
        response: createKernelFailureResponse(request, error),
        transferables: []
      };
    }
  }
}

export function createGeometryKernelWorkerSpike(
  options: GeometryWorkerSpikeOptions = {}
): GeometryKernelWorkerSpike {
  return new GeometryKernelWorkerSpike(options);
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

function createKernelFailureResponse(
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

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
