import {
  executeTimedBrowserGeometryKernelRequest,
  getGeometryResponseTransferables,
  type GeometryKernelErrorResponse,
  type GeometryKernelResponse
} from "@web-cad/geometry-kernel/browser";
import {
  createKernelFailureResponse,
  createWorkerErrorDiagnostics,
  createWorkerSpikeResponse,
  createWorkerSuccessDiagnostics,
  delay,
  type GeometryWorkerSpike,
  type GeometryWorkerSpikeOptions,
  type GeometryWorkerSpikeRequest,
  type GeometryWorkerSpikeResponse
} from "./protocol";

export {
  createBoxTessellationWorkerRequest,
  createWorkerErrorDiagnostics,
  createWorkerSuccessDiagnostics,
  type GeometryWorkerSpike,
  type GeometryWorkerSpikeDiagnostics,
  type GeometryWorkerSpikeErrorCode,
  type GeometryWorkerSpikeErrorDetails,
  type GeometryWorkerSpikeOptions,
  type GeometryWorkerSpikeRequest,
  type GeometryWorkerSpikeRequestKind,
  type GeometryWorkerSpikeResponse,
  type GeometryWorkerSpikeStage,
  type GeometryWorkerSpikeTimings,
  type GeometryWorkerSpikeVersion,
  type GeometryWorkerWasmLoadStatus
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

    const unsupportedMessage = getUnsupportedPrimitiveMessage(request);

    if (unsupportedMessage) {
      return createWorkerSpikeResponse(
        request,
        createKernelFailureResponse(
          request,
          new Error(unsupportedMessage)
        ) as GeometryKernelErrorResponse,
        [],
        undefined,
        createWorkerErrorDiagnostics({
          stage: "requestValidation",
          code: "UNSUPPORTED_PRIMITIVE",
          message: unsupportedMessage
        })
      );
    }

    try {
      const workerExecutionStart = performance.now();
      const { response, timings } =
        await executeTimedBrowserGeometryKernelRequest(request.payload);
      const workerExecutionMs = performance.now() - workerExecutionStart;
      const diagnostics = response.ok
        ? createWorkerSuccessDiagnostics({
            wasmLoadStatus: "loaded"
          })
        : createWorkerErrorDiagnostics({
            stage:
              timings.failureStage === "wasmLoad"
                ? "wasmLoad"
                : timings.failureStage === "tessellation"
                  ? "tessellation"
                  : "requestValidation",
            code:
              timings.failureStage === "wasmLoad"
                ? "WASM_LOAD_FAILED"
                : "KERNEL_TESSELLATION_FAILED",
            message: response.error.message,
            wasmLoadStatus:
              timings.failureStage === "wasmLoad"
                ? "failed"
                : timings.occtLoadMs > 0
                  ? "loaded"
                  : "notRequested"
          });

      return createWorkerSpikeResponse(
        request,
        response as GeometryKernelResponse,
        getGeometryResponseTransferables(response),
        {
          occtLoadMs: timings.occtLoadMs,
          tessellationMs: timings.tessellationMs,
          geometryKernelMs: timings.geometryKernelMs,
          workerExecutionMs
        },
        diagnostics
      );
    } catch (error) {
      return createWorkerSpikeResponse(
        request,
        createKernelFailureResponse(
          request,
          error
        ) as GeometryKernelErrorResponse,
        [],
        undefined,
        createWorkerErrorDiagnostics({
          stage: "worker",
          code: "WORKER_RUNTIME_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "The geometry worker failed before it returned a kernel response."
        })
      );
    }
  }
}

export function createGeometryKernelBrowserWorkerSpike(
  options: GeometryWorkerSpikeOptions = {}
): GeometryKernelBrowserWorkerSpike {
  return new GeometryKernelBrowserWorkerSpike(options);
}

function getUnsupportedPrimitiveMessage(
  request: GeometryWorkerSpikeRequest
): string | undefined {
  if (request.kind !== "geometry-worker-spike.tessellatePrimitive") {
    return `Unsupported geometry worker request kind: ${request.kind}.`;
  }

  if (request.payload.op !== "geometry.tessellateBox") {
    return `Unsupported geometry kernel operation: ${request.payload.op}.`;
  }

  return undefined;
}
