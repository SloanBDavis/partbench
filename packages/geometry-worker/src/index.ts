import type {
  GeometryKernelErrorResponse,
  GeometryKernelResponse
} from "@web-cad/geometry-kernel";
import {
  createKernelFailureResponse,
  createGeometryWorkerResponse,
  delay,
  type GeometryWorker,
  type GeometryWorkerOptions,
  type GeometryWorkerRequest,
  type GeometryWorkerResponse
} from "./protocol";

export {
  createBoxTessellationWorkerRequest,
  createCylinderTessellationWorkerRequest,
  createWorkerErrorDiagnostics,
  createWorkerSuccessDiagnostics,
  type GeometryWorker,
  type GeometryWorkerDiagnostics,
  type GeometryWorkerErrorCode,
  type GeometryWorkerErrorDetails,
  type GeometryWorkerOptions,
  type GeometryWorkerRequest,
  type GeometryWorkerRequestKind,
  type GeometryWorkerResponse,
  type GeometryWorkerStage,
  type GeometryWorkerTimings,
  type GeometryWorkerVersion,
  type GeometryWorkerWasmLoadStatus
} from "./protocol";

export class GeometryKernelWorker implements GeometryWorker {
  readonly #delayMs: number;

  constructor(options: GeometryWorkerOptions = {}) {
    this.#delayMs = options.delayMs ?? 0;
  }

  async execute(
    request: GeometryWorkerRequest
  ): Promise<GeometryWorkerResponse> {
    if (this.#delayMs > 0) {
      await delay(this.#delayMs);
    }

    try {
      const geometryKernel = await import("@web-cad/geometry-kernel");
      const response = await geometryKernel.executeGeometryKernelRequest(
        request.payload
      );

      return createGeometryWorkerResponse(
        request,
        response as GeometryKernelResponse,
        geometryKernel.getGeometryResponseTransferables(response)
      );
    } catch (error) {
      return createGeometryWorkerResponse(
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

export function createGeometryKernelWorker(
  options: GeometryWorkerOptions = {}
): GeometryKernelWorker {
  return new GeometryKernelWorker(options);
}
