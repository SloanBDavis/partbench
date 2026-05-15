import type {
  GeometryWorkerDiagnostics,
  GeometryWorkerResponse
} from "@web-cad/geometry-worker";
import type { MeshRendererBridgeResult } from "@web-cad/renderer-mesh-bridge";
import type { RenderTransform, RenderTriangleMesh } from "@web-cad/renderer";

export interface DerivedGeometryBoxInput {
  readonly id: string;
  readonly dimensions: {
    readonly width: number;
    readonly height: number;
    readonly depth: number;
  };
  readonly transform: RenderTransform;
}

export interface DerivedGeometryCylinderInput {
  readonly id: string;
  readonly dimensions: {
    readonly radius: number;
    readonly height: number;
  };
  readonly transform: RenderTransform;
}

export interface DerivedGeometryMetrics {
  readonly objectId: string;
  readonly occtLoadMs?: number;
  readonly tessellationMs?: number;
  readonly geometryKernelMs?: number;
  readonly workerExecutionMs?: number;
  readonly roundTripMs: number;
  readonly vertexCount: number;
  readonly triangleCount: number;
}

export interface DerivedGeometryResult {
  readonly mesh: RenderTriangleMesh;
  readonly metrics: DerivedGeometryMetrics;
  readonly message: string;
}

export interface DerivedGeometryErrorDetails {
  readonly code: string;
  readonly stage: string;
  readonly message: string;
  readonly workerStarted: boolean;
  readonly wasmLoadStatus: string;
}

export interface DerivedGeometryRuntime {
  tessellateBox(input: DerivedGeometryBoxInput): Promise<DerivedGeometryResult>;
  tessellateCylinder(
    input: DerivedGeometryCylinderInput
  ): Promise<DerivedGeometryResult>;
  dispose(): void;
}

export class DerivedGeometryRuntimeError extends Error {
  readonly details: DerivedGeometryErrorDetails;

  constructor(details: DerivedGeometryErrorDetails) {
    super(details.message);
    this.name = "DerivedGeometryRuntimeError";
    this.details = details;
  }
}

export function createDerivedGeometryMetrics(input: {
  readonly objectId: string;
  readonly response: GeometryWorkerResponse;
  readonly bridgeResult: MeshRendererBridgeResult;
  readonly roundTripMs: number;
}): DerivedGeometryMetrics {
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

export function createDerivedGeometryErrorFromWorkerResponse(
  response: GeometryWorkerResponse
): DerivedGeometryRuntimeError {
  if (response.response.ok) {
    throw new Error(
      "Cannot create a derived geometry error from a success response."
    );
  }

  return new DerivedGeometryRuntimeError(
    createDerivedGeometryErrorDetailsFromDiagnostics(
      response.diagnostics,
      response.response.error.message
    )
  );
}

export function createDerivedGeometryErrorDetails(
  error: unknown
): DerivedGeometryErrorDetails {
  if (error instanceof DerivedGeometryRuntimeError) {
    return error.details;
  }

  if (hasGeometryWorkerDiagnostics(error)) {
    return createDerivedGeometryErrorDetailsFromDiagnostics(error.diagnostics);
  }

  return {
    code: "UNKNOWN_DERIVED_GEOMETRY_ERROR",
    stage: "unknown",
    message:
      error instanceof Error ? error.message : "Geometry tessellation failed.",
    workerStarted: false,
    wasmLoadStatus: "unknown"
  };
}

export function formatDerivedGeometryError(
  error: DerivedGeometryErrorDetails
): string {
  return `${error.code} at ${error.stage}: ${error.message}`;
}

export function formatMetricMs(value: number | undefined): string {
  if (value === undefined) {
    return "n/a";
  }

  const safeValue = Math.max(0, value);
  return `${safeValue.toFixed(safeValue < 10 ? 2 : 1)} ms`;
}

function createDerivedGeometryErrorDetailsFromDiagnostics(
  diagnostics: GeometryWorkerDiagnostics | undefined,
  fallbackMessage?: string
): DerivedGeometryErrorDetails {
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
): error is { readonly diagnostics: GeometryWorkerDiagnostics } {
  return (
    typeof error === "object" &&
    error !== null &&
    "diagnostics" in error &&
    typeof (error as { readonly diagnostics?: unknown }).diagnostics ===
      "object" &&
    (error as { readonly diagnostics?: unknown }).diagnostics !== null
  );
}
