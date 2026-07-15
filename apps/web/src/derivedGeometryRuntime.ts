import type {
  GeometryKernelExactTopologyCheckpointPayload,
  GeometryKernelExactBodyMetadata,
  GeometryKernelImportedBodyPayload,
  GeometryKernelStepImportDiagnostic,
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

export interface DerivedGeometrySphereInput {
  readonly id: string;
  readonly dimensions: {
    readonly radius: number;
  };
  readonly transform: RenderTransform;
}

export interface DerivedGeometryConeInput {
  readonly id: string;
  readonly dimensions: {
    readonly radius: number;
    readonly height: number;
  };
  readonly transform: RenderTransform;
}

export interface DerivedGeometryTorusInput {
  readonly id: string;
  readonly dimensions: {
    readonly majorRadius: number;
    readonly minorRadius: number;
  };
  readonly transform: RenderTransform;
}

export interface DerivedGeometryExtrudeInput {
  readonly id: string;
  readonly sketchPlane: "XY" | "XZ" | "YZ";
  readonly profile:
    | {
        readonly kind: "rectangle";
        readonly center: readonly [number, number];
        readonly width: number;
        readonly height: number;
      }
    | {
        readonly kind: "circle";
        readonly center: readonly [number, number];
        readonly radius: number;
      };
  readonly depth: number;
  readonly side: "positive" | "negative" | "symmetric";
  readonly transform: RenderTransform;
}

export interface DerivedGeometryRevolveInput {
  readonly id: string;
  readonly sketchPlane: "XY" | "XZ" | "YZ";
  readonly profile: DerivedGeometryExtrudeInput["profile"];
  readonly axis: {
    readonly start: readonly [number, number];
    readonly end: readonly [number, number];
  };
  readonly angleDegrees: number;
  readonly transform: RenderTransform;
}

export interface DerivedGeometryExtrudePlacementFrame {
  readonly origin: readonly [number, number, number];
  readonly uAxis: readonly [number, number, number];
  readonly vAxis: readonly [number, number, number];
}

export type DerivedGeometryBooleanExtrudeInputSource =
  | DerivedGeometryBooleanExtrudePrimitiveInputSource
  | DerivedGeometryBooleanExtrudeResultInputSource;

export interface DerivedGeometryBooleanExtrudePrimitiveInputSource {
  readonly sketchPlane: "XY" | "XZ" | "YZ";
  readonly profile: DerivedGeometryExtrudeInput["profile"];
  readonly depth: number;
  readonly side: "positive" | "negative" | "symmetric";
  readonly placementFrame?: DerivedGeometryExtrudePlacementFrame;
}

export interface DerivedGeometryBooleanExtrudeResultInputSource {
  readonly kind: "booleanExtrudes";
  readonly operation: "add" | "cut";
  readonly target: DerivedGeometryBooleanExtrudeInputSource;
  readonly tool: DerivedGeometryBooleanExtrudePrimitiveInputSource;
}

export interface DerivedGeometryBooleanExtrudeInput {
  readonly id: string;
  readonly operation: "add" | "cut";
  readonly target: DerivedGeometryBooleanExtrudeInputSource;
  readonly tool: DerivedGeometryBooleanExtrudePrimitiveInputSource;
}

export interface DerivedGeometryHoleInput {
  readonly id: string;
  readonly target: DerivedGeometryBooleanExtrudeInputSource;
  readonly tool: {
    readonly sketchPlane: "XY" | "XZ" | "YZ";
    readonly circle: {
      readonly kind: "circle";
      readonly center: readonly [number, number];
      readonly radius: number;
    };
    readonly depthMode: "blind" | "throughAll";
    readonly depth?: number;
    readonly direction: "positive" | "negative";
    readonly placementFrame?: DerivedGeometryExtrudePlacementFrame;
  };
}

export type DerivedGeometryPatternSeedSource =
  | ({ kind: "extrude" } & DerivedGeometryBooleanExtrudePrimitiveInputSource)
  | DerivedGeometryBooleanExtrudeResultInputSource;

export interface DerivedGeometryLinearPatternInput {
  readonly id: string;
  readonly seed: DerivedGeometryPatternSeedSource;
  readonly direction: readonly [number, number, number];
  readonly spacing: number;
  readonly instanceCount: number;
}

export interface DerivedGeometryCircularPatternInput {
  readonly id: string;
  readonly seed: DerivedGeometryPatternSeedSource;
  readonly axis: {
    readonly origin: readonly [number, number, number];
    readonly direction: readonly [number, number, number];
  };
  readonly totalAngleDegrees: number;
  readonly instanceCount: number;
}

export interface DerivedGeometryMirrorInput {
  readonly id: string;
  readonly seed: DerivedGeometryPatternSeedSource;
  readonly plane: {
    readonly point: readonly [number, number, number];
    readonly normal: readonly [number, number, number];
  };
  readonly includeOriginal: boolean;
}

export type DerivedGeometryShellTargetSource = DerivedGeometryPatternSeedSource;

export interface DerivedGeometryShellInput {
  readonly id: string;
  readonly target: DerivedGeometryShellTargetSource;
  readonly wallThickness: number;
  readonly openFaceStableIds: readonly string[];
}

export interface DerivedGeometrySweepInput {
  readonly id: string;
  readonly profile: {
    readonly sketchPlane: "XY" | "XZ" | "YZ";
    readonly profile: DerivedGeometryExtrudeInput["profile"];
    readonly placementFrame?: DerivedGeometryExtrudePlacementFrame;
  };
  readonly pathSegments: readonly {
    readonly start: readonly [number, number, number];
    readonly end: readonly [number, number, number];
  }[];
}

export interface DerivedGeometryLoftInput {
  readonly id: string;
  readonly sections: readonly DerivedGeometrySweepInput["profile"][];
}

export type DerivedGeometryEdgeFinishInput =
  | {
      readonly id: string;
      readonly operation: "chamfer";
      readonly target: DerivedGeometryBooleanExtrudeInputSource;
      readonly edgeStableId: string;
      readonly distance: number;
    }
  | {
      readonly id: string;
      readonly operation: "fillet";
      readonly target: DerivedGeometryBooleanExtrudeInputSource;
      readonly edgeStableId: string;
      readonly radius: number;
    };

export type DerivedExactBodyMetadata = GeometryKernelExactBodyMetadata;
export type DerivedExactTopologyCheckpointPayload =
  GeometryKernelExactTopologyCheckpointPayload;

export interface DerivedExactMetadataInput {
  readonly id: string;
  readonly source:
    | {
        readonly kind: "extrude";
        readonly sketchPlane: "XY" | "XZ" | "YZ";
        readonly profile: DerivedGeometryExtrudeInput["profile"];
        readonly depth: number;
        readonly side: "positive" | "negative" | "symmetric";
        readonly placementFrame?: DerivedGeometryExtrudePlacementFrame;
      }
    | {
        readonly kind: "booleanExtrudes";
        readonly operation: "add" | "cut";
        readonly target: DerivedGeometryBooleanExtrudeInputSource;
        readonly tool: DerivedGeometryBooleanExtrudePrimitiveInputSource;
      }
    | {
        readonly kind: "revolve";
        readonly sketchPlane: "XY" | "XZ" | "YZ";
        readonly profile: DerivedGeometryExtrudeInput["profile"];
        readonly axis: DerivedGeometryRevolveInput["axis"];
        readonly angleDegrees: number;
        readonly placementFrame?: DerivedGeometryExtrudePlacementFrame;
      }
    | ({ readonly kind: "sweep" } & Omit<DerivedGeometrySweepInput, "id">)
    | ({ readonly kind: "loft" } & Omit<DerivedGeometryLoftInput, "id">)
    | {
        readonly kind: "hole";
        readonly target: DerivedGeometryBooleanExtrudeInputSource;
        readonly tool: DerivedGeometryHoleInput["tool"];
      }
    | {
        readonly kind: "edgeFinish";
        readonly operation: "chamfer";
        readonly target: DerivedGeometryBooleanExtrudeInputSource;
        readonly edgeStableId: string;
        readonly distance: number;
        readonly radius?: never;
      }
    | {
        readonly kind: "edgeFinish";
        readonly operation: "fillet";
        readonly target: DerivedGeometryBooleanExtrudeInputSource;
        readonly edgeStableId: string;
        readonly radius: number;
        readonly distance?: never;
      };
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

export interface DerivedExactMetadataMetrics {
  readonly objectId: string;
  readonly occtLoadMs?: number;
  readonly tessellationMs?: number;
  readonly geometryKernelMs?: number;
  readonly workerExecutionMs?: number;
  readonly roundTripMs: number;
}

export interface DerivedGeometryResult {
  readonly mesh: RenderTriangleMesh;
  readonly metrics: DerivedGeometryMetrics;
  readonly message: string;
  readonly warnings?: readonly string[];
}

export interface DerivedExactMetadataResult {
  readonly metadata: DerivedExactBodyMetadata;
  readonly metrics: DerivedExactMetadataMetrics;
  readonly message: string;
}

export interface DerivedExactTopologyCheckpointPayloadInput extends DerivedExactMetadataInput {
  readonly checkpointId: string;
  readonly bodyId: string;
}

export interface DerivedExactTopologyCheckpointPayloadResult {
  readonly checkpointPayload: DerivedExactTopologyCheckpointPayload;
  readonly metrics: DerivedExactMetadataMetrics;
  readonly message: string;
}

export interface DerivedStepImportInput {
  readonly id: string;
  readonly sourceFileName: string;
  readonly bytes: Uint8Array;
  readonly maxBodyCount?: number;
  readonly bodyId?: string;
  readonly checkpointId?: string;
}

export interface DerivedStepImportResult {
  readonly sourceFormat: "step";
  readonly sourceFileName: string;
  readonly bodyCount: number;
  readonly bodies: readonly GeometryKernelImportedBodyPayload[];
  readonly diagnostics: readonly GeometryKernelStepImportDiagnostic[];
  readonly metrics: DerivedExactMetadataMetrics;
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
  tessellateSphere(
    input: DerivedGeometrySphereInput
  ): Promise<DerivedGeometryResult>;
  tessellateCone(
    input: DerivedGeometryConeInput
  ): Promise<DerivedGeometryResult>;
  tessellateTorus(
    input: DerivedGeometryTorusInput
  ): Promise<DerivedGeometryResult>;
  tessellateExtrude(
    input: DerivedGeometryExtrudeInput
  ): Promise<DerivedGeometryResult>;
  revolveProfile(
    input: DerivedGeometryRevolveInput
  ): Promise<DerivedGeometryResult>;
  booleanExtrudes(
    input: DerivedGeometryBooleanExtrudeInput
  ): Promise<DerivedGeometryResult>;
  hole(input: DerivedGeometryHoleInput): Promise<DerivedGeometryResult>;
  edgeFinish(
    input: DerivedGeometryEdgeFinishInput
  ): Promise<DerivedGeometryResult>;
  linearPattern(
    input: DerivedGeometryLinearPatternInput
  ): Promise<DerivedGeometryResult>;
  circularPattern(
    input: DerivedGeometryCircularPatternInput
  ): Promise<DerivedGeometryResult>;
  mirror(input: DerivedGeometryMirrorInput): Promise<DerivedGeometryResult>;
  shell(input: DerivedGeometryShellInput): Promise<DerivedGeometryResult>;
  sweep(input: DerivedGeometrySweepInput): Promise<DerivedGeometryResult>;
  loft(input: DerivedGeometryLoftInput): Promise<DerivedGeometryResult>;
  exactBodyMetadata(
    input: DerivedExactMetadataInput
  ): Promise<DerivedExactMetadataResult>;
  exactTopologyCheckpointPayload(
    input: DerivedExactTopologyCheckpointPayloadInput
  ): Promise<DerivedExactTopologyCheckpointPayloadResult>;
  importStep(input: DerivedStepImportInput): Promise<DerivedStepImportResult>;
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

export function createDerivedExactMetadataMetrics(input: {
  readonly objectId: string;
  readonly response: GeometryWorkerResponse;
  readonly roundTripMs: number;
}): DerivedExactMetadataMetrics {
  return {
    objectId: input.objectId,
    occtLoadMs: input.response.timings?.occtLoadMs,
    tessellationMs: input.response.timings?.tessellationMs,
    geometryKernelMs: input.response.timings?.geometryKernelMs,
    workerExecutionMs: input.response.timings?.workerExecutionMs,
    roundTripMs: input.roundTripMs
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
