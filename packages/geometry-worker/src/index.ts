import type {
  GeometryKernelErrorResponse,
  GeometryKernelRequest,
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
  createConeTessellationWorkerRequest,
  createCylinderTessellationWorkerRequest,
  createEdgeFinishWorkerRequest,
  createExactBodyMetadataWorkerRequest,
  createExactTopologySnapshotWorkerRequest,
  createExactTopologyCheckpointPayloadWorkerRequest,
  createExtrudeBooleanWorkerRequest,
  createExactStepExportWorkerRequest,
  createStepImportWorkerRequest,
  createExtrudeTessellationWorkerRequest,
  createHoleWorkerRequest,
  createRevolveProfileWorkerRequest,
  createSphereTessellationWorkerRequest,
  createTorusTessellationWorkerRequest,
  createMirrorWorkerRequest,
  getGeometryWorkerExactExportCapabilities,
  getGeometryWorkerStepImportCapabilities,
  createWorkerErrorDiagnostics,
  createWorkerSuccessDiagnostics,
  type GeometryWorker,
  type GeometryWorkerDiagnostics,
  type GeometryWorkerErrorCode,
  type GeometryWorkerErrorDetails,
  type GeometryKernelExactBodyMetadata,
  type GeometryKernelExactTopologySnapshot,
  type GeometryKernelExactTopologyCheckpointPayload,
  type GeometryKernelTopologyCheckpointSignaturePayload,
  type GeometryKernelExactExportFormat,
  type GeometryKernelExactStepExportArtifact,
  type GeometryKernelImportedBodyCheckpointPayload,
  type GeometryKernelImportedBodyPayload,
  type GeometryKernelImportedBodyShapeType,
  type GeometryKernelStepImportDiagnostic,
  type GeometryKernelStepImportResult,
  type GeometryWorkerExactExportCapability,
  type GeometryWorkerStepImportCapability,
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

  async execute<TPayload extends GeometryKernelRequest>(
    request: GeometryWorkerRequest<TPayload>
  ): Promise<GeometryWorkerResponse<TPayload>> {
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
      ) as GeometryWorkerResponse<TPayload>;
    } catch (error) {
      return createGeometryWorkerResponse(
        request,
        createKernelFailureResponse(
          request,
          error
        ) as GeometryKernelErrorResponse,
        []
      ) as GeometryWorkerResponse<TPayload>;
    }
  }
}

export function createGeometryKernelWorker(
  options: GeometryWorkerOptions = {}
): GeometryKernelWorker {
  return new GeometryKernelWorker(options);
}
