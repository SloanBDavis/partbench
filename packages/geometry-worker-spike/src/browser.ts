import {
  executeTimedBrowserGeometryKernelRequest,
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
  type GeometryWorkerSpikeTimings,
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
      const workerExecutionStart = performance.now();
      const { response, timings } =
        await executeTimedBrowserGeometryKernelRequest(request.payload);
      const workerExecutionMs = performance.now() - workerExecutionStart;

      return createWorkerSpikeResponse(
        request,
        response as GeometryKernelResponse,
        getGeometryResponseTransferables(response),
        {
          occtLoadMs: timings.occtLoadMs,
          tessellationMs: timings.tessellationMs,
          geometryKernelMs: timings.geometryKernelMs,
          workerExecutionMs
        }
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
