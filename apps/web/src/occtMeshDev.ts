import type {
  GeometryWorkerSpikeDiagnostics,
  GeometryWorkerSpikeResponse
} from "@web-cad/geometry-worker-spike";
import type { MeshRendererBridgeResult } from "@web-cad/renderer-mesh-bridge";
import type { RenderTransform, RenderTriangleMesh } from "@web-cad/renderer";

export interface OcctMeshDevBoxInput {
  readonly id: string;
  readonly dimensions: {
    readonly width: number;
    readonly height: number;
    readonly depth: number;
  };
  readonly transform: RenderTransform;
}

export interface OcctMeshDevMetrics {
  readonly objectId: string;
  readonly occtLoadMs?: number;
  readonly tessellationMs?: number;
  readonly geometryKernelMs?: number;
  readonly workerExecutionMs?: number;
  readonly roundTripMs: number;
  readonly vertexCount: number;
  readonly triangleCount: number;
}

export interface OcctMeshDevResult {
  readonly mesh: RenderTriangleMesh;
  readonly metrics: OcctMeshDevMetrics;
  readonly message: string;
}

export interface OcctMeshDevErrorDetails {
  readonly code: string;
  readonly stage: string;
  readonly message: string;
  readonly workerStarted: boolean;
  readonly wasmLoadStatus: string;
}

export interface OcctMeshDevRuntime {
  tessellateBox(input: OcctMeshDevBoxInput): Promise<OcctMeshDevResult>;
  dispose(): void;
}

export class OcctMeshDevRuntimeError extends Error {
  readonly details: OcctMeshDevErrorDetails;

  constructor(details: OcctMeshDevErrorDetails) {
    super(details.message);
    this.name = "OcctMeshDevRuntimeError";
    this.details = details;
  }
}

export function createOcctMeshDevMetrics(input: {
  readonly objectId: string;
  readonly response: GeometryWorkerSpikeResponse;
  readonly bridgeResult: MeshRendererBridgeResult;
  readonly roundTripMs: number;
}): OcctMeshDevMetrics {
  return {
    objectId: input.objectId,
    occtLoadMs: input.response.timings?.occtLoadMs,
    tessellationMs: input.response.timings?.tessellationMs,
    geometryKernelMs: input.response.timings?.geometryKernelMs,
    workerExecutionMs: input.response.timings?.workerExecutionMs,
    roundTripMs: input.roundTripMs,
    vertexCount: input.bridgeResult.vertexCount,
    triangleCount: input.bridgeResult.triangleCount
  };
}

export function createOcctMeshDevErrorFromWorkerResponse(
  response: GeometryWorkerSpikeResponse
): OcctMeshDevRuntimeError {
  if (response.response.ok) {
    throw new Error(
      "Cannot create an OCCT mesh error from a success response."
    );
  }

  return new OcctMeshDevRuntimeError(
    createOcctMeshDevErrorDetailsFromDiagnostics(
      response.diagnostics,
      response.response.error.message
    )
  );
}

export function createOcctMeshDevErrorDetails(
  error: unknown
): OcctMeshDevErrorDetails {
  if (error instanceof OcctMeshDevRuntimeError) {
    return error.details;
  }

  if (hasGeometryWorkerDiagnostics(error)) {
    return createOcctMeshDevErrorDetailsFromDiagnostics(error.diagnostics);
  }

  return {
    code: "UNKNOWN_OCCT_MESH_DEV_ERROR",
    stage: "unknown",
    message:
      error instanceof Error ? error.message : "OCCT tessellation failed.",
    workerStarted: false,
    wasmLoadStatus: "unknown"
  };
}

export function formatOcctMeshDevError(error: OcctMeshDevErrorDetails): string {
  return `${error.code} at ${error.stage}: ${error.message}`;
}

export function formatMetricMs(value: number | undefined): string {
  if (value === undefined) {
    return "n/a";
  }

  const safeValue = Math.max(0, value);
  return `${safeValue.toFixed(safeValue < 10 ? 2 : 1)} ms`;
}

function createOcctMeshDevErrorDetailsFromDiagnostics(
  diagnostics: GeometryWorkerSpikeDiagnostics | undefined,
  fallbackMessage?: string
): OcctMeshDevErrorDetails {
  return {
    code: diagnostics?.error?.code ?? "GEOMETRY_WORKER_ERROR",
    stage: diagnostics?.stage ?? "worker",
    message:
      diagnostics?.error?.message ??
      fallbackMessage ??
      "The geometry worker failed.",
    workerStarted: diagnostics?.workerStarted ?? false,
    wasmLoadStatus: diagnostics?.wasmLoadStatus ?? "unknown"
  };
}

function hasGeometryWorkerDiagnostics(
  error: unknown
): error is { readonly diagnostics: GeometryWorkerSpikeDiagnostics } {
  return (
    typeof error === "object" &&
    error !== null &&
    "diagnostics" in error &&
    typeof (error as { readonly diagnostics?: unknown }).diagnostics ===
      "object" &&
    (error as { readonly diagnostics?: unknown }).diagnostics !== null
  );
}
