import type {
  BooleanExtrudePrimitiveSource,
  BooleanExtrudeSource,
  BooleanExtrudesRequest,
  EdgeFinishRequest,
  ExactBodyMetadataRequest,
  ExactTopologyCheckpointPayloadRequest,
  ExactTopologySnapshotRequest,
  ExactStepExportBodySource,
  ExactStepExportRequest,
  GeometryKernelErrorResponse,
  GeometryKernelRequest,
  GeometryKernelResponseForRequest,
  GeometryKernelResponse,
  GeometryKernelBooleanOperation,
  GeometryKernelDocumentUnit,
  GeometryKernelExtrudeSide,
  ExtrudeGeometryProfile,
  GeometryKernelExactExportCapability,
  GeometryKernelExactExportFormat,
  GeometryKernelStepImportCapability,
  HoleRequest,
  HoleToolSource,
  GeometryKernelSketchPlane,
  RevolveProfileRequest,
  StepImportRequest,
  TessellateBoxRequest,
  TessellateConeRequest,
  TessellateCylinderRequest,
  TessellateExtrudeRequest,
  TessellateSphereRequest,
  TessellateTorusRequest,
  LinearPatternRequest,
  CircularPatternRequest,
  PatternSeedSource,
  GeometryKernelDirection,
  GeometryKernelAxisFrame,
  MirrorRequest,
  MirrorSeedSource,
  GeometryKernelPlaneFrame,
  ShellRequest,
  ShellTargetSource,
  SweepRequest,
  SweepProfileSource,
  SweepPathSegment,
  LoftRequest,
  LoftSectionSource
} from "@web-cad/geometry-kernel";

export type {
  GeometryKernelExactBodyMetadata,
  GeometryKernelExactTopologySnapshot,
  GeometryKernelExactTopologyCheckpointPayload,
  GeometryKernelTopologyCheckpointSignaturePayload,
  GeometryKernelExactExportFormat,
  GeometryKernelExactStepExportArtifact,
  GeometryKernelImportedBodyCheckpointPayload,
  GeometryKernelImportedBodyPayload,
  GeometryKernelImportedBodyShapeType,
  GeometryKernelStepImportDiagnostic,
  GeometryKernelStepImportResult,
  StepImportRequest,
  ResolvedPlanarWireProfile,
  GeometryKernelGeneratedReferences
} from "@web-cad/geometry-kernel";

export type GeometryWorkerVersion = "geometry-worker.v1";
export type GeometryWorkerRequestKind =
  | "geometry-worker.tessellatePrimitive"
  | "geometry-worker.tessellateFeature"
  | "geometry-worker.booleanFeature"
  | "geometry-worker.edgeFinishFeature"
  | "geometry-worker.linearPatternFeature"
  | "geometry-worker.circularPatternFeature"
  | "geometry-worker.mirrorFeature"
  | "geometry-worker.shellFeature"
  | "geometry-worker.sweepFeature"
  | "geometry-worker.loftFeature"
  | "geometry-worker.exactMetadata"
  | "geometry-worker.exactTopologySnapshot"
  | "geometry-worker.exactTopologyCheckpointPayload"
  | "geometry-worker.importStep"
  | "geometry-worker.exactExport";

export interface GeometryWorkerRequest<
  TPayload extends GeometryKernelRequest = GeometryKernelRequest
> {
  readonly id: string;
  readonly version: GeometryWorkerVersion;
  readonly kind: GeometryWorkerRequestKind;
  readonly payload: TPayload;
}

export interface GeometryWorkerResponse<
  TPayload extends GeometryKernelRequest = GeometryKernelRequest
> {
  readonly id: string;
  readonly version: GeometryWorkerVersion;
  readonly kind: GeometryWorkerRequestKind;
  readonly payloadId: string;
  readonly response: GeometryKernelResponseForRequest<TPayload>;
  readonly transferables: readonly ArrayBuffer[];
  readonly timings?: GeometryWorkerTimings;
  readonly diagnostics?: GeometryWorkerDiagnostics;
}

export interface GeometryWorkerTimings {
  readonly occtLoadMs?: number;
  readonly tessellationMs?: number;
  readonly workerExecutionMs?: number;
  readonly geometryKernelMs?: number;
}

export type GeometryWorkerStage =
  | "requestValidation"
  | "wasmLoad"
  | "tessellation"
  | "worker"
  | "transport"
  | "complete";

export type GeometryWorkerErrorCode =
  | "WASM_LOAD_FAILED"
  | "UNSUPPORTED_PRIMITIVE"
  | "KERNEL_TESSELLATION_FAILED"
  | "WORKER_TRANSPORT_FAILED"
  | "WORKER_RUNTIME_FAILED";

export type GeometryWorkerWasmLoadStatus = "notRequested" | "loaded" | "failed";

export interface GeometryWorkerErrorDetails {
  readonly code: GeometryWorkerErrorCode;
  readonly message: string;
  readonly cause?: string;
}

export interface GeometryWorkerDiagnostics {
  readonly ok: boolean;
  readonly stage: GeometryWorkerStage;
  readonly workerStarted: boolean;
  readonly wasmLoadStatus: GeometryWorkerWasmLoadStatus;
  readonly error?: GeometryWorkerErrorDetails;
}

export interface GeometryWorker {
  execute<TPayload extends GeometryKernelRequest>(
    request: GeometryWorkerRequest<TPayload>
  ): Promise<GeometryWorkerResponse<TPayload>>;
}

export interface GeometryWorkerOptions {
  readonly delayMs?: number;
}

export interface GeometryWorkerExactExportCapability {
  readonly format: GeometryKernelExactExportFormat;
  readonly label: "STEP";
  readonly status: "available" | "unavailable";
  readonly writerAvailable: boolean;
  readonly boundary: "geometry-worker";
  readonly kernelBoundary: "geometry-kernel";
  readonly writerBoundary: "occt-wasm";
  readonly packageName: "opencascade.js";
  readonly packageVersion: string;
  readonly checkedBindings: readonly string[];
  readonly availableBindings: readonly string[];
  readonly missingBindings: readonly string[];
  readonly reason: string;
}

export interface GeometryWorkerStepImportCapability {
  readonly format: "step";
  readonly label: "STEP";
  readonly status: "available" | "unavailable";
  readonly readerAvailable: boolean;
  readonly healingAvailable: boolean;
  readonly checkpointWriterAvailable: boolean;
  readonly boundary: "geometry-worker";
  readonly kernelBoundary: "geometry-kernel";
  readonly readerBoundary: "occt-wasm";
  readonly packageName: "opencascade.js";
  readonly packageVersion: string;
  readonly checkedBindings: readonly string[];
  readonly availableBindings: readonly string[];
  readonly missingBindings: readonly string[];
  readonly reason: string;
}

const GEOMETRY_WORKER_STEP_WRITER_CHECKED_BINDINGS = [
  "STEPControl_Writer_1",
  "STEPControl_StepModelType.STEPControl_AsIs",
  "IFSelect_ReturnStatus.IFSelect_RetDone",
  "Interface_Static.SetCVal",
  "Message_ProgressRange_1",
  "FS.readFile",
  "FS.unlink",
  "BRepPrimAPI_MakeBox_5",
  "BRepPrimAPI_MakeCylinder_3"
] as const;

const GEOMETRY_WORKER_STEP_READER_CHECKED_BINDINGS = [
  "STEPControl_Reader_1",
  "STEPControl_Reader.ReadFile",
  "STEPControl_Reader.TransferRoots",
  "STEPControl_Reader.OneShape",
  "IFSelect_ReturnStatus.IFSelect_RetDone",
  "Message_ProgressRange_1",
  "ShapeFix_Shape_1",
  "ShapeFix_Shape.Init",
  "ShapeFix_Shape.Perform",
  "ShapeFix_Shape.Shape",
  "BRepTools.Write_3",
  "FS.writeFile",
  "FS.readFile",
  "FS.unlink",
  "TopExp.MapShapes_1"
] as const;

const DEFAULT_GEOMETRY_WORKER_KERNEL_CAPABILITIES: readonly GeometryKernelExactExportCapability[] =
  [
    {
      format: "step",
      label: "STEP",
      status: "available",
      writerAvailable: true,
      boundary: "geometry-kernel",
      writerBoundary: "occt-wasm",
      packageName: "opencascade.js",
      packageVersion: "2.0.0-beta.b5ff984",
      checkedBindings: GEOMETRY_WORKER_STEP_WRITER_CHECKED_BINDINGS,
      availableBindings: GEOMETRY_WORKER_STEP_WRITER_CHECKED_BINDINGS,
      missingBindings: [],
      reason:
        "The geometry kernel can route minimal exact STEP export requests to the isolated OpenCascade.js writer boundary."
    }
  ];

const DEFAULT_GEOMETRY_WORKER_STEP_IMPORT_KERNEL_CAPABILITIES: readonly GeometryKernelStepImportCapability[] =
  [
    {
      format: "step",
      label: "STEP",
      status: "available",
      readerAvailable: true,
      healingAvailable: true,
      checkpointWriterAvailable: true,
      boundary: "geometry-kernel",
      readerBoundary: "occt-wasm",
      packageName: "opencascade.js",
      packageVersion: "2.0.0-beta.b5ff984",
      checkedBindings: GEOMETRY_WORKER_STEP_READER_CHECKED_BINDINGS,
      availableBindings: GEOMETRY_WORKER_STEP_READER_CHECKED_BINDINGS,
      missingBindings: [],
      reason:
        "The geometry kernel can route STEP import requests to the isolated OpenCascade.js reader, healing, and BRep checkpoint boundary."
    }
  ];

export function getGeometryWorkerExactExportCapabilities(
  kernelCapabilities: readonly GeometryKernelExactExportCapability[] = DEFAULT_GEOMETRY_WORKER_KERNEL_CAPABILITIES
): readonly GeometryWorkerExactExportCapability[] {
  return kernelCapabilities.map((capability) => ({
    format: capability.format,
    label: capability.label,
    status: capability.status,
    writerAvailable: capability.writerAvailable,
    boundary: "geometry-worker",
    kernelBoundary: capability.boundary,
    writerBoundary: capability.writerBoundary,
    packageName: capability.packageName,
    packageVersion: capability.packageVersion,
    checkedBindings: capability.checkedBindings,
    availableBindings: capability.availableBindings,
    missingBindings: capability.missingBindings,
    reason: capability.writerAvailable
      ? "The geometry worker can execute minimal exact STEP export through the geometry kernel and isolated OpenCascade.js writer boundary."
      : "The geometry worker cannot execute exact STEP export until the geometry kernel reports every required writer binding."
  }));
}

export function getGeometryWorkerStepImportCapabilities(
  kernelCapabilities: readonly GeometryKernelStepImportCapability[] = DEFAULT_GEOMETRY_WORKER_STEP_IMPORT_KERNEL_CAPABILITIES
): readonly GeometryWorkerStepImportCapability[] {
  return kernelCapabilities.map((capability) => ({
    format: capability.format,
    label: capability.label,
    status: capability.status,
    readerAvailable: capability.readerAvailable,
    healingAvailable: capability.healingAvailable,
    checkpointWriterAvailable: capability.checkpointWriterAvailable,
    boundary: "geometry-worker",
    kernelBoundary: capability.boundary,
    readerBoundary: capability.readerBoundary,
    packageName: capability.packageName,
    packageVersion: capability.packageVersion,
    checkedBindings: capability.checkedBindings,
    availableBindings: capability.availableBindings,
    missingBindings: capability.missingBindings,
    reason:
      capability.readerAvailable &&
      capability.healingAvailable &&
      capability.checkpointWriterAvailable
        ? "The geometry worker can execute STEP import through the geometry kernel and isolated OpenCascade.js reader, healing, and BRep checkpoint boundary."
        : "The geometry worker cannot execute STEP import until the geometry kernel reports every required reader, healing, and checkpoint binding."
  }));
}

export function createGeometryWorkerResponse(
  request: GeometryWorkerRequest,
  response: GeometryKernelResponse,
  transferables: readonly ArrayBuffer[],
  timings?: GeometryWorkerTimings,
  diagnostics?: GeometryWorkerDiagnostics
): GeometryWorkerResponse {
  return {
    id: request.id,
    version: request.version,
    kind: request.kind,
    payloadId: request.payload.id,
    response,
    transferables,
    ...(timings ? { timings } : {}),
    ...(diagnostics ? { diagnostics } : {})
  };
}

export function createWorkerSuccessDiagnostics(input: {
  readonly wasmLoadStatus: GeometryWorkerWasmLoadStatus;
}): GeometryWorkerDiagnostics {
  return {
    ok: true,
    stage: "complete",
    workerStarted: true,
    wasmLoadStatus: input.wasmLoadStatus
  };
}

export function createWorkerErrorDiagnostics(input: {
  readonly stage: GeometryWorkerStage;
  readonly code: GeometryWorkerErrorCode;
  readonly message: string;
  readonly wasmLoadStatus?: GeometryWorkerWasmLoadStatus;
  readonly workerStarted?: boolean;
  readonly cause?: string;
}): GeometryWorkerDiagnostics {
  return {
    ok: false,
    stage: input.stage,
    workerStarted: input.workerStarted ?? true,
    wasmLoadStatus: input.wasmLoadStatus ?? "notRequested",
    error: {
      code: input.code,
      message: input.message,
      ...(input.cause ? { cause: input.cause } : {})
    }
  };
}

export function createBoxTessellationWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}): GeometryWorkerRequest<TessellateBoxRequest> {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.tessellatePrimitive",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.tessellateBox",
      dimensions: {
        width: input.width,
        height: input.height,
        depth: input.depth
      },
      ...(tessellation ? { tessellation } : {})
    }
  };
}

export function createCylinderTessellationWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly radius: number;
  readonly height: number;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}): GeometryWorkerRequest<TessellateCylinderRequest> {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.tessellatePrimitive",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.tessellateCylinder",
      dimensions: {
        radius: input.radius,
        height: input.height
      },
      ...(tessellation ? { tessellation } : {})
    }
  };
}

export function createSphereTessellationWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly radius: number;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}): GeometryWorkerRequest<TessellateSphereRequest> {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.tessellatePrimitive",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.tessellateSphere",
      dimensions: {
        radius: input.radius
      },
      ...(tessellation ? { tessellation } : {})
    }
  };
}

export function createConeTessellationWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly radius: number;
  readonly height: number;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}): GeometryWorkerRequest<TessellateConeRequest> {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.tessellatePrimitive",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.tessellateCone",
      dimensions: {
        radius: input.radius,
        height: input.height
      },
      ...(tessellation ? { tessellation } : {})
    }
  };
}

export function createTorusTessellationWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly majorRadius: number;
  readonly minorRadius: number;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}): GeometryWorkerRequest<TessellateTorusRequest> {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.tessellatePrimitive",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.tessellateTorus",
      dimensions: {
        majorRadius: input.majorRadius,
        minorRadius: input.minorRadius
      },
      ...(tessellation ? { tessellation } : {})
    }
  };
}

export function createExtrudeTessellationWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly sketchPlane: GeometryKernelSketchPlane;
  readonly profile: ExtrudeGeometryProfile;
  readonly depth: number;
  readonly side?: GeometryKernelExtrudeSide;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}): GeometryWorkerRequest<TessellateExtrudeRequest> {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.tessellateFeature",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.tessellateExtrude",
      sketchPlane: input.sketchPlane,
      profile: input.profile,
      depth: input.depth,
      side: input.side,
      ...(tessellation ? { tessellation } : {})
    }
  };
}

export function createRevolveProfileWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly sketchPlane: GeometryKernelSketchPlane;
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
  readonly axis: {
    readonly start: readonly [number, number];
    readonly end: readonly [number, number];
  };
  readonly angleDegrees: number;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}): GeometryWorkerRequest<RevolveProfileRequest> {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.tessellateFeature",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.revolveProfile",
      sketchPlane: input.sketchPlane,
      profile: input.profile,
      axis: input.axis,
      angleDegrees: input.angleDegrees,
      ...(tessellation ? { tessellation } : {})
    }
  };
}

export function createExtrudeBooleanWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly operation: GeometryKernelBooleanOperation;
  readonly target: BooleanExtrudeSource;
  readonly tool: BooleanExtrudePrimitiveSource;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}): GeometryWorkerRequest<BooleanExtrudesRequest> {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.booleanFeature",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.booleanExtrudes",
      operation: input.operation,
      target: input.target,
      tool: input.tool,
      ...(tessellation ? { tessellation } : {})
    }
  };
}

export function createHoleWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly target: BooleanExtrudeSource;
  readonly tool: HoleToolSource;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}): GeometryWorkerRequest<HoleRequest> {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.booleanFeature",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.hole",
      target: input.target,
      tool: input.tool,
      ...(tessellation ? { tessellation } : {})
    }
  };
}

export function createEdgeFinishWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly target: EdgeFinishRequest["target"];
  readonly edgeStableId: string;
  readonly operation: EdgeFinishRequest["operation"];
  readonly distance?: number;
  readonly radius?: number;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}): GeometryWorkerRequest<EdgeFinishRequest> {
  const tessellation = createTessellationOptions(input);
  const payloadBase = {
    id: input.payloadId ?? `${input.id}:payload`,
    version: "geometry-kernel.v1" as const,
    op: "geometry.edgeFinish" as const,
    target: input.target,
    edgeStableId: input.edgeStableId,
    ...(tessellation ? { tessellation } : {})
  };

  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.edgeFinishFeature",
    payload:
      input.operation === "chamfer"
        ? {
            ...payloadBase,
            operation: input.operation,
            distance: input.distance ?? Number.NaN
          }
        : {
            ...payloadBase,
            operation: input.operation,
            radius: input.radius ?? Number.NaN
          }
  };
}

export function createExactBodyMetadataWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly source: ExactBodyMetadataRequest["source"];
}): GeometryWorkerRequest<ExactBodyMetadataRequest> {
  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.exactMetadata",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.exactBodyMetadata",
      source: input.source
    }
  };
}

export function createExactTopologySnapshotWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly source: ExactTopologySnapshotRequest["source"];
}): GeometryWorkerRequest<ExactTopologySnapshotRequest> {
  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.exactTopologySnapshot",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.exactTopologySnapshot",
      source: input.source
    }
  };
}

export function createExactTopologyCheckpointPayloadWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly checkpointId: string;
  readonly bodyId: string;
  readonly source: ExactTopologyCheckpointPayloadRequest["source"];
}): GeometryWorkerRequest<ExactTopologyCheckpointPayloadRequest> {
  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.exactTopologyCheckpointPayload",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.exactTopologyCheckpointPayload",
      checkpointId: input.checkpointId,
      bodyId: input.bodyId,
      source: input.source
    }
  };
}

export function createExactStepExportWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly units: GeometryKernelDocumentUnit;
  readonly bodies: readonly ExactStepExportBodySource[];
}): GeometryWorkerRequest<ExactStepExportRequest> {
  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.exactExport",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.exportStep",
      units: input.units,
      bodies: input.bodies
    }
  };
}

export function createStepImportWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly sourceFileName: string;
  readonly bytes: Uint8Array;
  readonly maxBodyCount?: number;
  readonly bodyId?: string;
  readonly checkpointId?: string;
}): GeometryWorkerRequest<StepImportRequest> {
  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.importStep",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.importStep",
      sourceFileName: input.sourceFileName,
      bytes: input.bytes,
      maxBodyCount: input.maxBodyCount,
      bodyId: input.bodyId,
      checkpointId: input.checkpointId
    }
  };
}

export function createKernelFailureResponse(
  request: GeometryWorkerRequest,
  error: unknown
): GeometryKernelErrorResponse {
  return {
    ok: false,
    id: request.payload.id,
    op: request.payload.op,
    error: {
      code: "KERNEL_FAILURE",
      message:
        error instanceof Error
          ? error.message
          : "The geometry worker failed to execute the kernel request."
    },
    warnings: []
  };
}

export function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function createTessellationOptions(input: {
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}):
  | {
      readonly linearDeflection?: number;
      readonly angularDeflection?: number;
    }
  | undefined {
  if (
    input.linearDeflection === undefined &&
    input.angularDeflection === undefined
  ) {
    return undefined;
  }

  return {
    ...(input.linearDeflection !== undefined
      ? { linearDeflection: input.linearDeflection }
      : {}),
    ...(input.angularDeflection !== undefined
      ? { angularDeflection: input.angularDeflection }
      : {})
  };
}

export type {
  PatternSeedSource,
  GeometryKernelDirection,
  GeometryKernelAxisFrame,
  MirrorSeedSource,
  GeometryKernelPlaneFrame,
  ShellTargetSource
};

export function createSweepWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly profile: SweepProfileSource;
  readonly pathSegments: readonly SweepPathSegment[];
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}): GeometryWorkerRequest<SweepRequest> {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.sweepFeature",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.sweep",
      profile: input.profile,
      pathSegments: input.pathSegments,
      ...(tessellation ? { tessellation } : {})
    }
  };
}

export function createLoftWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly sections: readonly LoftSectionSource[];
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}): GeometryWorkerRequest<LoftRequest> {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.loftFeature",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.loft",
      sections: input.sections,
      ...(tessellation ? { tessellation } : {})
    }
  };
}

export function createLinearPatternWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly seed: PatternSeedSource;
  readonly direction: GeometryKernelDirection;
  readonly spacing: number;
  readonly instanceCount: number;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}): GeometryWorkerRequest<LinearPatternRequest> {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.linearPatternFeature",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.linearPattern",
      seed: input.seed,
      direction: input.direction,
      spacing: input.spacing,
      instanceCount: input.instanceCount,
      ...(tessellation ? { tessellation } : {})
    }
  };
}

export function createCircularPatternWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly seed: PatternSeedSource;
  readonly axis: GeometryKernelAxisFrame;
  readonly totalAngleDegrees: number;
  readonly instanceCount: number;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}): GeometryWorkerRequest<CircularPatternRequest> {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.circularPatternFeature",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.circularPattern",
      seed: input.seed,
      axis: input.axis,
      totalAngleDegrees: input.totalAngleDegrees,
      instanceCount: input.instanceCount,
      ...(tessellation ? { tessellation } : {})
    }
  };
}

export function createMirrorWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly seed: MirrorSeedSource;
  readonly plane: GeometryKernelPlaneFrame;
  readonly includeOriginal: boolean;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}): GeometryWorkerRequest<MirrorRequest> {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.mirrorFeature",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.mirror",
      seed: input.seed,
      plane: input.plane,
      includeOriginal: input.includeOriginal,
      ...(tessellation ? { tessellation } : {})
    }
  };
}

export function createShellWorkerRequest(input: {
  readonly id: string;
  readonly payloadId?: string;
  readonly target: ShellTargetSource;
  readonly wallThickness: number;
  readonly openFaceStableIds: readonly string[];
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}): GeometryWorkerRequest<ShellRequest> {
  const tessellation = createTessellationOptions(input);

  return {
    id: input.id,
    version: "geometry-worker.v1",
    kind: "geometry-worker.shellFeature",
    payload: {
      id: input.payloadId ?? `${input.id}:payload`,
      version: "geometry-kernel.v1",
      op: "geometry.shell",
      target: input.target,
      wallThickness: input.wallThickness,
      openFaceStableIds: input.openFaceStableIds,
      ...(tessellation ? { tessellation } : {})
    }
  };
}
