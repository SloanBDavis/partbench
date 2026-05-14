import {
  executeGeometryKernelRequest,
  getGeometryResponseTransferables,
  type GeometryKernelErrorResponse,
  type GeometryKernelResponse
} from "@web-cad/geometry-kernel/browser";
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
  type GeometryWorkerSpikeVersion
} from "./protocol";

export class GeometryKernelBrowserWorkerSpike implements GeometryWorkerSpike {
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
      const response = await executeGeometryKernelRequest(request.payload);

      return createWorkerSpikeResponse(
        request,
        response as GeometryKernelResponse,
        getGeometryResponseTransferables(response)
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

export function createGeometryKernelBrowserWorkerSpike(
  options: GeometryWorkerSpikeOptions = {}
): GeometryKernelBrowserWorkerSpike {
  return new GeometryKernelBrowserWorkerSpike(options);
}
