import {
  executeTimedBrowserGeometryKernelRequest,
  getGeometryResponseTransferables,
  type GeometryKernelErrorResponse,
  type GeometryKernelRequest,
  type GeometryKernelResponse
} from "@web-cad/geometry-kernel/browser";
import {
  createKernelFailureResponse,
  createWorkerErrorDiagnostics,
  createGeometryWorkerResponse,
  createWorkerSuccessDiagnostics,
  delay,
  type GeometryWorker,
  type GeometryWorkerOptions,
  type GeometryWorkerRequest,
  type GeometryWorkerResponse
} from "./protocol";

export {
  createBoxTessellationWorkerRequest,
  createConeTessellationWorkerRequest,
  createCylinderTessellationWorkerRequest,
  createEdgeFinishWorkerRequest,
  createExactBodyMetadataWorkerRequest,
  createExactTopologyCheckpointPayloadWorkerRequest,
  createExactTopologySnapshotWorkerRequest,
  createExactStepExportWorkerRequest,
  createExtrudeBooleanWorkerRequest,
  createExtrudeTessellationWorkerRequest,
  createHoleWorkerRequest,
  createRevolveProfileWorkerRequest,
  createSphereTessellationWorkerRequest,
  createTorusTessellationWorkerRequest,
  createWorkerErrorDiagnostics,
  createWorkerSuccessDiagnostics,
  type GeometryWorker,
  type GeometryWorkerDiagnostics,
  type GeometryWorkerErrorCode,
  type GeometryWorkerErrorDetails,
  type GeometryKernelExactTopologyCheckpointPayload,
  type GeometryWorkerOptions,
  type GeometryWorkerRequest,
  type GeometryWorkerRequestKind,
  type GeometryWorkerResponse,
  type GeometryWorkerStage,
  type GeometryWorkerTimings,
  type GeometryWorkerVersion,
  type GeometryWorkerWasmLoadStatus
} from "./protocol";

export class GeometryKernelBrowserWorker implements GeometryWorker {
  readonly #delayMs: number;

  constructor(options: GeometryWorkerOptions = {}) {
    this.#delayMs = options.delayMs ?? 0;
  }

  async execute<TPayload extends GeometryKernelRequest>(
    request: GeometryWorkerRequest<TPayload>
  ): Promise<GeometryWorkerResponse<TPayload>> {
    if (this.#delayMs > 0) {
      await delay(this.#delayMs);
    }

    const unsupportedMessage = getUnsupportedPrimitiveMessage(request);

    if (unsupportedMessage) {
      return createGeometryWorkerResponse(
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
      ) as GeometryWorkerResponse<TPayload>;
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

      return createGeometryWorkerResponse(
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
      ) as GeometryWorkerResponse<TPayload>;
    } catch (error) {
      return createGeometryWorkerResponse(
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
      ) as GeometryWorkerResponse<TPayload>;
    }
  }
}

export function createGeometryKernelBrowserWorker(
  options: GeometryWorkerOptions = {}
): GeometryKernelBrowserWorker {
  return new GeometryKernelBrowserWorker(options);
}

function getUnsupportedPrimitiveMessage(
  request: GeometryWorkerRequest
): string | undefined {
  const kind = request.kind as string;
  const op = request.payload.op as string;

  if (
    kind !== "geometry-worker.tessellatePrimitive" &&
    kind !== "geometry-worker.tessellateFeature" &&
    kind !== "geometry-worker.booleanFeature" &&
    kind !== "geometry-worker.edgeFinishFeature" &&
    kind !== "geometry-worker.exactMetadata" &&
    kind !== "geometry-worker.exactTopologySnapshot" &&
    kind !== "geometry-worker.exactTopologyCheckpointPayload" &&
    kind !== "geometry-worker.exactExport"
  ) {
    return `Unsupported geometry worker request kind: ${kind}.`;
  }

  if (
    op !== "geometry.tessellateBox" &&
    op !== "geometry.tessellateCylinder" &&
    op !== "geometry.tessellateSphere" &&
    op !== "geometry.tessellateCone" &&
    op !== "geometry.tessellateTorus" &&
    op !== "geometry.tessellateExtrude" &&
    op !== "geometry.revolveProfile" &&
    op !== "geometry.booleanExtrudes" &&
    op !== "geometry.hole" &&
    op !== "geometry.edgeFinish" &&
    op !== "geometry.exactBodyMetadata" &&
    op !== "geometry.exactTopologySnapshot" &&
    op !== "geometry.exactTopologyCheckpointPayload" &&
    op !== "geometry.exportStep"
  ) {
    return `Unsupported geometry kernel operation: ${op}.`;
  }

  return undefined;
}
