import type {
  GeometryKernelErrorResponse,
  GeometryKernelResponse
} from "@web-cad/geometry-kernel";
import {
  createKernelFailureResponse,
  createWorkerSpikeResponse,
  delay,
  type GeometryWorkerSpike,
  type GeometryWorkerSpikeOptions,
  type GeometryWorkerSpikeRequest,
  type GeometryWorkerSpikeResponse
} from "./protocol";

export {
  createBoxTessellationWorkerRequest,
  type GeometryWorkerSpike,
  type GeometryWorkerSpikeOptions,
  type GeometryWorkerSpikeRequest,
  type GeometryWorkerSpikeRequestKind,
  type GeometryWorkerSpikeResponse,
  type GeometryWorkerSpikeTimings,
  type GeometryWorkerSpikeVersion
} from "./protocol";

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

      return createWorkerSpikeResponse(
        request,
        response as GeometryKernelResponse,
        geometryKernel.getGeometryResponseTransferables(response)
      );
    } catch (error) {
      return createWorkerSpikeResponse(
        request,
        createKernelFailureResponse(
          request,
          error
        ) as GeometryKernelErrorResponse,
        []
      );
    }
  }
}

export function createGeometryKernelWorkerSpike(
  options: GeometryWorkerSpikeOptions = {}
): GeometryKernelWorkerSpike {
  return new GeometryKernelWorkerSpike(options);
}
