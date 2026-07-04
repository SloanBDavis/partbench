export type GeometryKernelVersion = "geometry-kernel.v1";
export type GeometryKernelExactExportFormat = "step";
export type GeometryKernelExactExportCapabilityStatus =
  | "available"
  | "unavailable";
export type GeometryKernelStepImportCapabilityStatus =
  | "available"
  | "unavailable";

export interface GeometryKernelExactExportCapability {
  readonly format: GeometryKernelExactExportFormat;
  readonly label: "STEP";
  readonly status: GeometryKernelExactExportCapabilityStatus;
  readonly writerAvailable: boolean;
  readonly boundary: "geometry-kernel";
  readonly writerBoundary: "occt-wasm";
  readonly packageName: "opencascade.js";
  readonly packageVersion: string;
  readonly checkedBindings: readonly string[];
  readonly availableBindings: readonly string[];
  readonly missingBindings: readonly string[];
  readonly reason: string;
}

export interface GeometryKernelStepImportCapability {
  readonly format: "step";
  readonly label: "STEP";
  readonly status: GeometryKernelStepImportCapabilityStatus;
  readonly readerAvailable: boolean;
  readonly healingAvailable: boolean;
  readonly checkpointWriterAvailable: boolean;
  readonly boundary: "geometry-kernel";
  readonly readerBoundary: "occt-wasm";
  readonly packageName: "opencascade.js";
  readonly packageVersion: string;
  readonly checkedBindings: readonly string[];
  readonly availableBindings: readonly string[];
  readonly missingBindings: readonly string[];
  readonly reason: string;
}

export type GeometryKernelStepImportCapabilityInput = Pick<
  GeometryKernelStepImportCapability,
  | "status"
  | "readerAvailable"
  | "healingAvailable"
  | "checkpointWriterAvailable"
  | "packageVersion"
  | "checkedBindings"
  | "availableBindings"
  | "missingBindings"
>;

export type GeometryKernelExactExportCapabilityInput = Pick<
  GeometryKernelExactExportCapability,
  | "status"
  | "writerAvailable"
  | "packageVersion"
  | "checkedBindings"
  | "availableBindings"
  | "missingBindings"
>;

export type GeometryKernelOp =
  | "geometry.tessellateBox"
  | "geometry.tessellateCylinder"
  | "geometry.tessellateSphere"
  | "geometry.tessellateCone"
  | "geometry.tessellateTorus"
  | "geometry.tessellateExtrude"
  | "geometry.revolveProfile"
  | "geometry.booleanExtrudes"
  | "geometry.hole"
  | "geometry.edgeFinish"
  | "geometry.exactBodyMetadata"
  | "geometry.exactTopologySnapshot"
  | "geometry.exactTopologyCheckpointPayload"
  | "geometry.importStep"
  | "geometry.exportStep"
  | "geometry.linearPattern"
  | "geometry.circularPattern"
  | "geometry.mirror"
  | "geometry.shell";
export type GeometryKernelPrimitive =
  | "box"
  | "cylinder"
  | "sphere"
  | "cone"
  | "torus"
  | "extrude"
  | "revolve"
  | "boolean"
  | "hole"
  | "edgeFinish";
export type GeometryKernelSketchPlane = "XY" | "XZ" | "YZ";
export type GeometryKernelExtrudeProfileKind = "rectangle" | "circle";
export type GeometryKernelExtrudeSide = "positive" | "negative" | "symmetric";
export type GeometryKernelDocumentUnit = "mm" | "cm" | "m" | "in";
export type GeometryKernelBooleanOperation = "add" | "cut";
export type GeometryKernelHoleDepthMode = "blind" | "throughAll";
export type GeometryKernelHoleDirection = "positive" | "negative";
export type GeometryKernelEdgeFinishOperation = "chamfer" | "fillet";
export type GeometryKernelRectangleEdgeRole =
  | "start:uMin"
  | "start:uMax"
  | "start:vMin"
  | "start:vMax"
  | "end:uMin"
  | "end:uMax"
  | "end:vMin"
  | "end:vMax"
  | "longitudinal:uMin:vMin"
  | "longitudinal:uMin:vMax"
  | "longitudinal:uMax:vMin"
  | "longitudinal:uMax:vMax";
export type GeometryKernelCircularEdgeRole = "start:circular" | "end:circular";
export type GeometryKernelEdgeFinishEdgeRole =
  | GeometryKernelRectangleEdgeRole
  | GeometryKernelCircularEdgeRole;

export interface BoxGeometryDimensions {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
}

export interface CylinderGeometryDimensions {
  readonly radius: number;
  readonly height: number;
}

export interface SphereGeometryDimensions {
  readonly radius: number;
}

export interface ConeGeometryDimensions {
  readonly radius: number;
  readonly height: number;
}

export interface TorusGeometryDimensions {
  readonly majorRadius: number;
  readonly minorRadius: number;
}

export interface RectangleExtrudeProfile {
  readonly kind: "rectangle";
  readonly center: readonly [number, number];
  readonly width: number;
  readonly height: number;
}

export interface CircleExtrudeProfile {
  readonly kind: "circle";
  readonly center: readonly [number, number];
  readonly radius: number;
}

export type ExtrudeGeometryProfile =
  | RectangleExtrudeProfile
  | CircleExtrudeProfile;

export type RevolveGeometryProfile = ExtrudeGeometryProfile;

export interface RevolveGeometryAxis {
  readonly start: readonly [number, number];
  readonly end: readonly [number, number];
}

export type BooleanExtrudeSource =
  | BooleanExtrudePrimitiveSource
  | BooleanExtrudeResultSource;

export interface BooleanExtrudePrimitiveSource {
  readonly sketchPlane: GeometryKernelSketchPlane;
  readonly profile: ExtrudeGeometryProfile;
  readonly depth: number;
  readonly side?: GeometryKernelExtrudeSide;
  readonly placementFrame?: BooleanExtrudePlacementFrame;
}

export interface BooleanExtrudeResultSource {
  readonly kind: "booleanExtrudes";
  readonly operation: GeometryKernelBooleanOperation;
  readonly target: BooleanExtrudeSource;
  readonly tool: BooleanExtrudePrimitiveSource;
}

export interface BooleanExtrudePlacementFrame {
  readonly origin: readonly [number, number, number];
  readonly uAxis: readonly [number, number, number];
  readonly vAxis: readonly [number, number, number];
}

export interface TessellationOptions {
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}

export interface TessellateBoxRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.tessellateBox";
  readonly dimensions: BoxGeometryDimensions;
  readonly tessellation?: TessellationOptions;
}

export interface TessellateCylinderRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.tessellateCylinder";
  readonly dimensions: CylinderGeometryDimensions;
  readonly tessellation?: TessellationOptions;
}

export interface TessellateSphereRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.tessellateSphere";
  readonly dimensions: SphereGeometryDimensions;
  readonly tessellation?: TessellationOptions;
}

export interface TessellateConeRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.tessellateCone";
  readonly dimensions: ConeGeometryDimensions;
  readonly tessellation?: TessellationOptions;
}

export interface TessellateTorusRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.tessellateTorus";
  readonly dimensions: TorusGeometryDimensions;
  readonly tessellation?: TessellationOptions;
}

export interface TessellateExtrudeRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.tessellateExtrude";
  readonly sketchPlane: GeometryKernelSketchPlane;
  readonly profile: ExtrudeGeometryProfile;
  readonly depth: number;
  readonly side?: GeometryKernelExtrudeSide;
  readonly tessellation?: TessellationOptions;
}

export interface RevolveProfileRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.revolveProfile";
  readonly sketchPlane: GeometryKernelSketchPlane;
  readonly profile: RevolveGeometryProfile;
  readonly axis: RevolveGeometryAxis;
  readonly angleDegrees: number;
  readonly tessellation?: TessellationOptions;
}

export interface BooleanExtrudesRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.booleanExtrudes";
  readonly operation: GeometryKernelBooleanOperation;
  readonly target: BooleanExtrudeSource;
  readonly tool: BooleanExtrudePrimitiveSource;
  readonly tessellation?: TessellationOptions;
}

export interface HoleToolSource {
  readonly sketchPlane: GeometryKernelSketchPlane;
  readonly circle: CircleExtrudeProfile;
  readonly depthMode: GeometryKernelHoleDepthMode;
  readonly depth?: number;
  readonly direction?: GeometryKernelHoleDirection;
  readonly placementFrame?: BooleanExtrudePlacementFrame;
}

export interface HoleRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.hole";
  readonly target: BooleanExtrudeSource;
  readonly tool: HoleToolSource;
  readonly tessellation?: TessellationOptions;
}

export type EdgeFinishRequest =
  | ChamferEdgeFinishRequest
  | FilletEdgeFinishRequest;

export interface ChamferEdgeFinishRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.edgeFinish";
  readonly operation: "chamfer";
  readonly target: BooleanExtrudeSource;
  readonly edgeStableId: string;
  readonly distance: number;
  readonly radius?: never;
  readonly tessellation?: TessellationOptions;
}

export interface FilletEdgeFinishRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.edgeFinish";
  readonly operation: "fillet";
  readonly target: BooleanExtrudeSource;
  readonly edgeStableId: string;
  readonly radius: number;
  readonly distance?: never;
  readonly tessellation?: TessellationOptions;
}

export type GeometryKernelPatternAxis = "x" | "y" | "z";

export type PatternSeedSource =
  | PatternSeedExtrudeSource
  | PatternSeedBooleanExtrudesSource;

export interface PatternSeedExtrudeSource extends BooleanExtrudePrimitiveSource {
  readonly kind: "extrude";
}

export interface PatternSeedBooleanExtrudesSource extends BooleanExtrudeResultSource {
  readonly kind: "booleanExtrudes";
}

export interface LinearPatternRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.linearPattern";
  readonly seed: PatternSeedSource;
  readonly axis: GeometryKernelPatternAxis;
  readonly spacing: number;
  readonly instanceCount: number;
  readonly tessellation?: TessellationOptions;
}

export interface CircularPatternRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.circularPattern";
  readonly seed: PatternSeedSource;
  readonly rotationAxis: GeometryKernelPatternAxis;
  readonly totalAngleDegrees: number;
  readonly instanceCount: number;
  readonly tessellation?: TessellationOptions;
}

export type GeometryKernelMirrorPlane = "XY" | "XZ" | "YZ";

export type MirrorSeedSource = PatternSeedSource;

export interface MirrorRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.mirror";
  readonly seed: MirrorSeedSource;
  readonly mirrorPlane: GeometryKernelMirrorPlane;
  readonly includeOriginal: boolean;
  readonly tessellation?: TessellationOptions;
}

export type ShellTargetSource = PatternSeedSource;

export interface ShellRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.shell";
  readonly target: ShellTargetSource;
  readonly wallThickness: number;
  readonly openFaceStableIds: readonly string[];
  readonly tessellation?: TessellationOptions;
}

export type ExactBodyMetadataSource =
  | ExactExtrudeMetadataSource
  | ExactBooleanExtrudesMetadataSource
  | ExactRevolveMetadataSource
  | ExactHoleMetadataSource
  | ExactEdgeFinishMetadataSource;
export type ExactTopologySourceKind =
  | ExactBodyMetadataSource["kind"]
  | "importedBody";

export interface ExactExtrudeMetadataSource extends BooleanExtrudePrimitiveSource {
  readonly kind: "extrude";
}

export interface ExactBooleanExtrudesMetadataSource extends BooleanExtrudeResultSource {
  readonly kind: "booleanExtrudes";
}

export interface ExactRevolveMetadataSource {
  readonly kind: "revolve";
  readonly sketchPlane: GeometryKernelSketchPlane;
  readonly profile: RevolveGeometryProfile;
  readonly axis: RevolveGeometryAxis;
  readonly angleDegrees: number;
  readonly placementFrame?: BooleanExtrudePlacementFrame;
}

export interface ExactHoleMetadataSource {
  readonly kind: "hole";
  readonly target: BooleanExtrudeSource;
  readonly tool: HoleToolSource;
}

export type ExactEdgeFinishMetadataSource =
  | {
      readonly kind: "edgeFinish";
      readonly operation: "chamfer";
      readonly target: BooleanExtrudeSource;
      readonly edgeStableId: string;
      readonly distance: number;
      readonly radius?: never;
    }
  | {
      readonly kind: "edgeFinish";
      readonly operation: "fillet";
      readonly target: BooleanExtrudeSource;
      readonly edgeStableId: string;
      readonly radius: number;
      readonly distance?: never;
    };

export interface ExactBodyMetadataRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.exactBodyMetadata";
  readonly source: ExactBodyMetadataSource;
}

export interface ExactTopologySnapshotRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.exactTopologySnapshot";
  readonly source: ExactBodyMetadataSource;
}

export interface ExactTopologyCheckpointPayloadRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.exactTopologyCheckpointPayload";
  readonly checkpointId: string;
  readonly bodyId: string;
  readonly source: ExactBodyMetadataSource;
}

export interface ExactStepExportBodySource extends BooleanExtrudePrimitiveSource {
  readonly bodyId: string;
  readonly bodyName?: string;
}

export interface ExactStepExportRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.exportStep";
  readonly units: GeometryKernelDocumentUnit;
  readonly bodies: readonly ExactStepExportBodySource[];
}

export interface StepImportRequest {
  readonly id: string;
  readonly version: GeometryKernelVersion;
  readonly op: "geometry.importStep";
  readonly sourceFileName: string;
  readonly bytes: Uint8Array;
  readonly maxBodyCount?: number;
  readonly bodyId?: string;
  readonly checkpointId?: string;
}

export type GeometryKernelRequest =
  | TessellateBoxRequest
  | TessellateCylinderRequest
  | TessellateSphereRequest
  | TessellateConeRequest
  | TessellateTorusRequest
  | TessellateExtrudeRequest
  | RevolveProfileRequest
  | BooleanExtrudesRequest
  | HoleRequest
  | EdgeFinishRequest
  | LinearPatternRequest
  | CircularPatternRequest
  | MirrorRequest
  | ShellRequest
  | ExactBodyMetadataRequest
  | ExactTopologySnapshotRequest
  | ExactTopologyCheckpointPayloadRequest
  | StepImportRequest
  | ExactStepExportRequest;

export type GeometryKernelMeshRequest = Exclude<
  GeometryKernelRequest,
  | ExactBodyMetadataRequest
  | ExactTopologySnapshotRequest
  | ExactTopologyCheckpointPayloadRequest
  | StepImportRequest
  | ExactStepExportRequest
>;

export interface SerializableMeshData {
  readonly primitive: GeometryKernelPrimitive;
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly faceCount: number;
}

export type GeometryKernelResponse =
  | GeometryKernelSuccessResponse
  | GeometryKernelErrorResponse;

export type GeometryKernelSuccessResponse =
  | GeometryKernelMeshSuccessResponse
  | GeometryKernelExactBodyMetadataSuccessResponse
  | GeometryKernelExactTopologySnapshotSuccessResponse
  | GeometryKernelExactTopologyCheckpointPayloadSuccessResponse
  | GeometryKernelStepImportSuccessResponse
  | GeometryKernelExactStepExportSuccessResponse;

export interface GeometryKernelMeshSuccessResponse {
  readonly ok: true;
  readonly id: string;
  readonly op: GeometryKernelMeshRequest["op"];
  readonly mesh: SerializableMeshData;
  readonly warnings: readonly string[];
}

export interface GeometryKernelExactBodyMetadataSuccessResponse {
  readonly ok: true;
  readonly id: string;
  readonly op: "geometry.exactBodyMetadata";
  readonly metadata: GeometryKernelExactBodyMetadata;
  readonly warnings: readonly string[];
}

export interface GeometryKernelExactTopologySnapshotSuccessResponse {
  readonly ok: true;
  readonly id: string;
  readonly op: "geometry.exactTopologySnapshot";
  readonly snapshot: GeometryKernelExactTopologySnapshot;
  readonly warnings: readonly string[];
}

export interface GeometryKernelTopologyCheckpointSignatureEntity {
  readonly localId: string;
  readonly kind: GeometryKernelTopologyEntityKind;
  readonly signature: string;
}

export interface GeometryKernelTopologyCheckpointSignaturePayload {
  readonly checkpointId: string;
  readonly signatureAlgorithm: "partbench-derived-topology-snapshot-v1";
  readonly signature: string;
  readonly entityCount: number;
  readonly entities: readonly GeometryKernelTopologyCheckpointSignatureEntity[];
}

export interface GeometryKernelExactTopologyCheckpointPayload {
  readonly checkpointId: string;
  readonly bodyId: string;
  readonly sourceKind: ExactTopologySourceKind;
  readonly brepFormat: "occt-brep";
  readonly brepWriter: "BRepTools.Write_3";
  readonly brepBytes: Uint8Array;
  readonly brepByteLength: number;
  readonly topologySnapshot: GeometryKernelExactTopologySnapshot;
  readonly signaturePayload: GeometryKernelTopologyCheckpointSignaturePayload;
}

export interface GeometryKernelExactTopologyCheckpointPayloadSuccessResponse {
  readonly ok: true;
  readonly id: string;
  readonly op: "geometry.exactTopologyCheckpointPayload";
  readonly checkpointPayload: GeometryKernelExactTopologyCheckpointPayload;
  readonly warnings: readonly string[];
}

export interface GeometryKernelExactStepExportArtifact {
  readonly format: GeometryKernelExactExportFormat;
  readonly schema: "AP242DIS";
  readonly units: GeometryKernelDocumentUnit;
  readonly bodyCount: number;
  readonly byteLength: number;
  readonly bytes: Uint8Array;
}

export interface GeometryKernelExactStepExportSuccessResponse {
  readonly ok: true;
  readonly id: string;
  readonly op: "geometry.exportStep";
  readonly artifact: GeometryKernelExactStepExportArtifact;
  readonly warnings: readonly string[];
}

export type GeometryKernelStepImportDiagnosticSeverity =
  | "info"
  | "warning"
  | "blocking";
export type GeometryKernelStepImportDiagnosticCode =
  | "STEP_READER_AVAILABLE"
  | "STEP_TRANSFER_COMPLETE"
  | "STEP_HEALING_APPLIED"
  | "STEP_HEALING_NOT_REQUIRED"
  | "STEP_TOPOLOGY_EXTRACTED"
  | "STEP_CHECKPOINT_PAYLOAD_CREATED";

export interface GeometryKernelStepImportDiagnostic {
  readonly code: GeometryKernelStepImportDiagnosticCode;
  readonly severity: GeometryKernelStepImportDiagnosticSeverity;
  readonly message: string;
}

export type GeometryKernelImportedBodyShapeType =
  | "solid"
  | "compound"
  | "assemblyLeaf";

export interface GeometryKernelImportedBodyCheckpointPayload {
  readonly checkpointId: string;
  readonly bodyId: string;
  readonly sourceKind: "importedBody";
  readonly brepFormat: "occt-brep";
  readonly brepWriter: "BRepTools.Write_3";
  readonly brepBytes: Uint8Array;
  readonly brepByteLength: number;
  readonly topologySnapshot: GeometryKernelExactTopologySnapshot;
  readonly signaturePayload: GeometryKernelTopologyCheckpointSignaturePayload;
}

export interface GeometryKernelImportedBodyPayload {
  readonly sourceFormat: "step";
  readonly sourceFileName: string;
  readonly bodyName?: string;
  readonly shapeType: GeometryKernelImportedBodyShapeType;
  readonly bounds: GeometryKernelBounds;
  readonly solidCount: number;
  readonly faceCount: number;
  readonly edgeCount: number;
  readonly vertexCount: number;
  readonly topologySnapshot: GeometryKernelExactTopologySnapshot;
  readonly checkpointPayload: GeometryKernelImportedBodyCheckpointPayload;
  readonly healingApplied: boolean;
  readonly diagnostics: readonly GeometryKernelStepImportDiagnostic[];
}

export interface GeometryKernelStepImportResult {
  readonly sourceFormat: "step";
  readonly sourceFileName: string;
  readonly bodyCount: number;
  readonly bodies: readonly GeometryKernelImportedBodyPayload[];
  readonly diagnostics: readonly GeometryKernelStepImportDiagnostic[];
}

export interface GeometryKernelStepImportSuccessResponse {
  readonly ok: true;
  readonly id: string;
  readonly op: "geometry.importStep";
  readonly sourceFormat: "step";
  readonly sourceFileName: string;
  readonly bodyCount: number;
  readonly bodies: readonly GeometryKernelImportedBodyPayload[];
  readonly diagnostics: readonly GeometryKernelStepImportDiagnostic[];
  readonly warnings: readonly string[];
}

export interface GeometryKernelErrorResponse {
  readonly ok: false;
  readonly id: string;
  readonly op: GeometryKernelOp;
  readonly error: GeometryKernelError;
  readonly warnings: readonly string[];
}

export type GeometryKernelErrorCode =
  | "INVALID_DIMENSIONS"
  | "INVALID_TESSELLATION_OPTIONS"
  | "UNSUPPORTED_PROFILE"
  | "UNSUPPORTED_EDGE"
  | "INVALID_EDGE_ROLE"
  | "EDGE_FINISH_TOO_LARGE"
  | "INVALID_PLACEMENT"
  | "KERNEL_FAILURE"
  | "EMPTY_RESULT"
  | "INVALID_RESULT"
  | "UNAVAILABLE_BINDING";

export interface GeometryKernelError {
  readonly code: GeometryKernelErrorCode;
  readonly message: string;
}

export interface GeometryKernelBounds {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

export type GeometryKernelTopologySurfaceClass =
  | "plane"
  | "cylinder"
  | "cone"
  | "sphere"
  | "torus"
  | "bspline"
  | "unknown";

export type GeometryKernelTopologyCurveClass =
  | "line"
  | "circle"
  | "ellipse"
  | "bspline"
  | "unknown";

export interface GeometryKernelTopologyEntityAdjacencyEvidence {
  readonly available: boolean;
  readonly neighborSignatureHashes: readonly string[];
}

export type GeometryKernelTopologyOrientation =
  | "forward"
  | "reversed"
  | "internal"
  | "external"
  | "unknown";

export type GeometryKernelTopologyLoopRole = "outer" | "inner" | "unknown";

export interface GeometryKernelTopologyEntityRelationshipEvidence {
  readonly parentFaceLocalId?: string;
  readonly parentWireLocalId?: string;
  readonly parentLoopLocalId?: string;
  readonly underlyingWireLocalId?: string;
  readonly underlyingEdgeLocalId?: string;
  readonly startVertexLocalId?: string;
  readonly endVertexLocalId?: string;
  readonly childWireLocalIds?: readonly string[];
  readonly childLoopLocalIds?: readonly string[];
  readonly childCoedgeLocalIds?: readonly string[];
  readonly childEdgeLocalIds?: readonly string[];
  readonly adjacentFaceLocalIds?: readonly string[];
}

export interface GeometryKernelTopologyCounts {
  readonly solidCount: number;
  readonly faceCount: number;
  readonly edgeCount: number;
  readonly vertexCount: number;
}

export type GeometryKernelMeasurementSource = "kernel-derived";
export type GeometryKernelMeasurementConfidence = "kernel-derived";

export interface GeometryKernelExactMetadataDiagnostic {
  readonly code: string;
  readonly message: string;
}

export interface GeometryKernelExactBodyMetadata {
  readonly sourceKind: ExactBodyMetadataSource["kind"];
  readonly bounds: GeometryKernelBounds;
  readonly volume: number;
  readonly surfaceArea: number;
  readonly centroid: readonly [number, number, number];
  readonly topologyCounts: GeometryKernelTopologyCounts;
  readonly measurementSource: GeometryKernelMeasurementSource;
  readonly measurementConfidence: GeometryKernelMeasurementConfidence;
  readonly diagnostics: readonly GeometryKernelExactMetadataDiagnostic[];
}

export type GeometryKernelTopologySnapshotStatus = "ready" | "partial";
export type GeometryKernelTopologyEntityKind =
  | "body"
  | "solid"
  | "face"
  | "wire"
  | "edge"
  | "vertex"
  | "loop"
  | "coedge"
  | "axis";

export type GeometryKernelTopologyDiagnosticCode =
  | "GEOMETRY_TOPOLOGY_SNAPSHOT_EXTRACTED"
  | "GEOMETRY_TOPOLOGY_DESCRIPTOR_EVIDENCE_EXTRACTED"
  | "GEOMETRY_TOPOLOGY_ADJACENCY_EXTRACTED"
  | "GEOMETRY_TOPOLOGY_ENTITY_KIND_UNAVAILABLE"
  | "GEOMETRY_TOPOLOGY_ADJACENCY_UNAVAILABLE"
  | "GEOMETRY_TOPOLOGY_SIGNATURE_LIMITED";

export interface GeometryKernelTopologyDiagnostic {
  readonly code: GeometryKernelTopologyDiagnosticCode;
  readonly severity: "info" | "warning";
  readonly message: string;
  readonly entityKind?: GeometryKernelTopologyEntityKind;
}

export interface GeometryKernelTopologyEntityDescriptor {
  readonly localId: string;
  readonly kind: GeometryKernelTopologyEntityKind;
  readonly source: "kernel-derived";
  readonly signature: string;
  readonly bounds?: GeometryKernelBounds;
  readonly surfaceClass?: GeometryKernelTopologySurfaceClass;
  readonly curveClass?: GeometryKernelTopologyCurveClass;
  readonly point?: readonly [number, number, number];
  readonly midpoint?: readonly [number, number, number];
  readonly normal?: readonly [number, number, number];
  readonly axis?: readonly [number, number, number];
  readonly radius?: number;
  readonly area?: number;
  readonly length?: number;
  readonly adjacency?: GeometryKernelTopologyEntityAdjacencyEvidence;
  readonly orientation?: GeometryKernelTopologyOrientation;
  readonly loopRole?: GeometryKernelTopologyLoopRole;
  readonly relationships?: GeometryKernelTopologyEntityRelationshipEvidence;
}

export interface GeometryKernelTopologyEntityCounts extends GeometryKernelTopologyCounts {
  readonly bodyCount: number;
  readonly wireCount: number;
  readonly loopCount: number;
  readonly coedgeCount: number;
  readonly axisCount: number;
}

export interface GeometryKernelExactTopologySnapshot {
  readonly sourceKind: ExactTopologySourceKind;
  readonly status: GeometryKernelTopologySnapshotStatus;
  readonly entityCounts: GeometryKernelTopologyEntityCounts;
  readonly entityCount: number;
  readonly entities: readonly GeometryKernelTopologyEntityDescriptor[];
  readonly unsupportedEntityKinds: readonly GeometryKernelTopologyEntityKind[];
  readonly adjacencyAvailable: boolean;
  readonly signatureAlgorithm: "partbench-derived-topology-snapshot-v1";
  readonly signature: string;
  readonly source: "kernel-derived";
  readonly diagnostics: readonly GeometryKernelTopologyDiagnostic[];
}

export interface GeometryKernelMeshResult {
  readonly primitive: GeometryKernelPrimitive;
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly faceCount: number;
}

export type GeometryKernelBoxMeshFactory = (
  input: BoxGeometryDimensions & TessellationOptions
) => Promise<GeometryKernelMeshResult>;

export type GeometryKernelCylinderMeshFactory = (
  input: CylinderGeometryDimensions & TessellationOptions
) => Promise<GeometryKernelMeshResult>;

export type GeometryKernelSphereMeshFactory = (
  input: SphereGeometryDimensions & TessellationOptions
) => Promise<GeometryKernelMeshResult>;

export type GeometryKernelConeMeshFactory = (
  input: ConeGeometryDimensions & TessellationOptions
) => Promise<GeometryKernelMeshResult>;

export type GeometryKernelTorusMeshFactory = (
  input: TorusGeometryDimensions & TessellationOptions
) => Promise<GeometryKernelMeshResult>;

export type GeometryKernelBooleanExtrudeMeshFactory = (
  input: Omit<BooleanExtrudesRequest, "id" | "version" | "op"> &
    TessellationOptions
) => Promise<GeometryKernelMeshResult>;

export type GeometryKernelHoleMeshFactory = (
  input: Omit<HoleRequest, "id" | "version" | "op"> & TessellationOptions
) => Promise<GeometryKernelMeshResult>;

export type GeometryKernelEdgeFinishMeshFactoryInput =
  | (Omit<ChamferEdgeFinishRequest, "id" | "version" | "op"> &
      TessellationOptions)
  | (Omit<FilletEdgeFinishRequest, "id" | "version" | "op"> &
      TessellationOptions);

export type GeometryKernelEdgeFinishMeshFactory = (
  input: GeometryKernelEdgeFinishMeshFactoryInput
) => Promise<GeometryKernelMeshResult>;

export type GeometryKernelRevolveProfileMeshFactory = (
  input: Omit<RevolveProfileRequest, "id" | "version" | "op"> &
    TessellationOptions
) => Promise<GeometryKernelMeshResult>;

export type GeometryKernelExactBodyMetadataFactory = (
  input: Omit<ExactBodyMetadataRequest, "id" | "version" | "op">
) => Promise<GeometryKernelExactBodyMetadata>;

export type GeometryKernelExactTopologySnapshotFactory = (
  input: Omit<ExactTopologySnapshotRequest, "id" | "version" | "op">
) => Promise<GeometryKernelExactTopologySnapshot>;

export type GeometryKernelExactTopologyCheckpointPayloadFactory = (
  input: Omit<ExactTopologyCheckpointPayloadRequest, "id" | "version" | "op">
) => Promise<GeometryKernelExactTopologyCheckpointPayload>;

export type GeometryKernelExactStepExportFactory = (
  input: Omit<ExactStepExportRequest, "id" | "version" | "op">
) => Promise<GeometryKernelExactStepExportArtifact>;

export type GeometryKernelStepImportFactory = (
  input: Omit<StepImportRequest, "id" | "version" | "op">
) => Promise<GeometryKernelStepImportResult>;

export type GeometryKernelLinearPatternMeshFactory = (
  input: Omit<LinearPatternRequest, "id" | "version" | "op"> &
    TessellationOptions
) => Promise<GeometryKernelMeshResult>;

export type GeometryKernelCircularPatternMeshFactory = (
  input: Omit<CircularPatternRequest, "id" | "version" | "op"> &
    TessellationOptions
) => Promise<GeometryKernelMeshResult>;

export type GeometryKernelMirrorMeshFactory = (
  input: Omit<MirrorRequest, "id" | "version" | "op"> & TessellationOptions
) => Promise<GeometryKernelMeshResult>;

export type GeometryKernelShellMeshFactory = (
  input: Omit<ShellRequest, "id" | "version" | "op"> & TessellationOptions
) => Promise<GeometryKernelMeshResult>;

export interface GeometryKernelMeshFactories {
  readonly createBoxMesh: GeometryKernelBoxMeshFactory;
  readonly createCylinderMesh: GeometryKernelCylinderMeshFactory;
  readonly createSphereMesh: GeometryKernelSphereMeshFactory;
  readonly createConeMesh: GeometryKernelConeMeshFactory;
  readonly createTorusMesh: GeometryKernelTorusMeshFactory;
  readonly createBooleanExtrudeMesh: GeometryKernelBooleanExtrudeMeshFactory;
  readonly createHoleMesh?: GeometryKernelHoleMeshFactory;
  readonly createEdgeFinishMesh?: GeometryKernelEdgeFinishMeshFactory;
  readonly createRevolveProfileMesh?: GeometryKernelRevolveProfileMeshFactory;
  readonly createExactBodyMetadata?: GeometryKernelExactBodyMetadataFactory;
  readonly createExactTopologySnapshot?: GeometryKernelExactTopologySnapshotFactory;
  readonly createExactTopologyCheckpointPayload?: GeometryKernelExactTopologyCheckpointPayloadFactory;
  readonly createStepImport?: GeometryKernelStepImportFactory;
  readonly createExactStepExport?: GeometryKernelExactStepExportFactory;
  readonly createLinearPatternMesh?: GeometryKernelLinearPatternMeshFactory;
  readonly createCircularPatternMesh?: GeometryKernelCircularPatternMeshFactory;
  readonly createMirrorMesh?: GeometryKernelMirrorMeshFactory;
  readonly createShellMesh?: GeometryKernelShellMeshFactory;
}

export type GeometryKernelResponseForRequest<T extends GeometryKernelRequest> =
  T extends ExactBodyMetadataRequest
    ?
        | GeometryKernelExactBodyMetadataSuccessResponse
        | GeometryKernelErrorResponse
    : T extends ExactTopologySnapshotRequest
      ?
          | GeometryKernelExactTopologySnapshotSuccessResponse
          | GeometryKernelErrorResponse
      : T extends ExactTopologyCheckpointPayloadRequest
        ?
            | GeometryKernelExactTopologyCheckpointPayloadSuccessResponse
            | GeometryKernelErrorResponse
        : T extends StepImportRequest
          ?
              | GeometryKernelStepImportSuccessResponse
              | GeometryKernelErrorResponse
          : T extends ExactStepExportRequest
            ?
                | GeometryKernelExactStepExportSuccessResponse
                | GeometryKernelErrorResponse
            : GeometryKernelMeshSuccessResponse | GeometryKernelErrorResponse;

const STEP_WRITER_CHECKED_BINDINGS = [
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

const STEP_READER_CHECKED_BINDINGS = [
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

const DEFAULT_STEP_WRITER_CAPABILITY: GeometryKernelExactExportCapabilityInput =
  {
    status: "available",
    writerAvailable: true,
    packageVersion: "2.0.0-beta.b5ff984",
    checkedBindings: STEP_WRITER_CHECKED_BINDINGS,
    availableBindings: STEP_WRITER_CHECKED_BINDINGS,
    missingBindings: []
  };

const DEFAULT_STEP_READER_CAPABILITY: GeometryKernelStepImportCapabilityInput =
  {
    status: "available",
    readerAvailable: true,
    healingAvailable: true,
    checkpointWriterAvailable: true,
    packageVersion: "2.0.0-beta.b5ff984",
    checkedBindings: STEP_READER_CHECKED_BINDINGS,
    availableBindings: STEP_READER_CHECKED_BINDINGS,
    missingBindings: []
  };

export function getGeometryKernelExactExportCapabilities(
  stepWriterCapability: GeometryKernelExactExportCapabilityInput = DEFAULT_STEP_WRITER_CAPABILITY
): readonly GeometryKernelExactExportCapability[] {
  return [
    {
      format: "step",
      label: "STEP",
      status: stepWriterCapability.status,
      writerAvailable: stepWriterCapability.writerAvailable,
      boundary: "geometry-kernel",
      writerBoundary: "occt-wasm",
      packageName: "opencascade.js",
      packageVersion: stepWriterCapability.packageVersion,
      checkedBindings: stepWriterCapability.checkedBindings,
      availableBindings: stepWriterCapability.availableBindings,
      missingBindings: stepWriterCapability.missingBindings,
      reason: stepWriterCapability.writerAvailable
        ? "The geometry kernel can route minimal exact STEP export requests to the isolated OpenCascade.js writer boundary."
        : "The geometry kernel cannot route exact STEP export until the isolated OpenCascade.js writer boundary exposes every required binding."
    }
  ];
}

export function getGeometryKernelStepImportCapabilities(
  stepReaderCapability: GeometryKernelStepImportCapabilityInput = DEFAULT_STEP_READER_CAPABILITY
): readonly GeometryKernelStepImportCapability[] {
  return [
    {
      format: "step",
      label: "STEP",
      status: stepReaderCapability.status,
      readerAvailable: stepReaderCapability.readerAvailable,
      healingAvailable: stepReaderCapability.healingAvailable,
      checkpointWriterAvailable: stepReaderCapability.checkpointWriterAvailable,
      boundary: "geometry-kernel",
      readerBoundary: "occt-wasm",
      packageName: "opencascade.js",
      packageVersion: stepReaderCapability.packageVersion,
      checkedBindings: stepReaderCapability.checkedBindings,
      availableBindings: stepReaderCapability.availableBindings,
      missingBindings: stepReaderCapability.missingBindings,
      reason:
        stepReaderCapability.readerAvailable &&
        stepReaderCapability.healingAvailable &&
        stepReaderCapability.checkpointWriterAvailable
          ? "The geometry kernel can route STEP import requests to the isolated OpenCascade.js reader, healing, and BRep checkpoint boundary."
          : "The geometry kernel cannot route STEP import until the isolated OpenCascade.js boundary exposes every required reader, healing, and checkpoint binding."
    }
  ];
}

export async function executeGeometryKernelRequestWithMeshFactory<
  T extends GeometryKernelRequest
>(
  factories: GeometryKernelMeshFactories,
  request: T
): Promise<GeometryKernelResponseForRequest<T>> {
  const validationError = validateRequest(request);

  if (validationError) {
    return errorResponse(
      request,
      validationError
    ) as GeometryKernelResponseForRequest<T>;
  }

  try {
    if (request.op === "geometry.importStep") {
      const importResult = await createStepImport(factories, request);

      if (isInvalidStepImportResult(importResult)) {
        return errorResponse(request, {
          code: "INVALID_RESULT",
          message:
            "The geometry kernel returned STEP import payloads with invalid or inconsistent body, topology, or checkpoint data."
        }) as GeometryKernelResponseForRequest<T>;
      }

      return {
        ok: true,
        id: request.id,
        op: request.op,
        sourceFormat: importResult.sourceFormat,
        sourceFileName: importResult.sourceFileName,
        bodyCount: importResult.bodyCount,
        bodies: importResult.bodies,
        diagnostics: importResult.diagnostics,
        warnings: []
      } as unknown as GeometryKernelResponseForRequest<T>;
    }

    if (request.op === "geometry.exportStep") {
      const artifact = await createExactStepExport(factories, request);

      if (artifact.byteLength <= 0 || artifact.bytes.byteLength <= 0) {
        return errorResponse(request, {
          code: "EMPTY_RESULT",
          message: "The geometry kernel returned an empty STEP artifact."
        }) as GeometryKernelResponseForRequest<T>;
      }

      if (
        artifact.format !== "step" ||
        artifact.byteLength !== artifact.bytes.byteLength
      ) {
        return errorResponse(request, {
          code: "INVALID_RESULT",
          message:
            "The geometry kernel returned STEP artifact metadata that did not match the exported bytes."
        }) as GeometryKernelResponseForRequest<T>;
      }

      return {
        ok: true,
        id: request.id,
        op: request.op,
        artifact,
        warnings: []
      } as unknown as GeometryKernelResponseForRequest<T>;
    }

    if (request.op === "geometry.exactBodyMetadata") {
      const metadata = await createExactBodyMetadata(factories, request);

      if (isInvalidExactBodyMetadata(metadata)) {
        return errorResponse(request, {
          code: "INVALID_RESULT",
          message:
            "The geometry kernel returned exact metadata with invalid or non-finite values."
        }) as GeometryKernelResponseForRequest<T>;
      }

      return {
        ok: true,
        id: request.id,
        op: request.op,
        metadata,
        warnings: []
      } as unknown as GeometryKernelResponseForRequest<T>;
    }

    if (request.op === "geometry.exactTopologySnapshot") {
      const snapshot = await createExactTopologySnapshot(factories, request);

      if (isInvalidExactTopologySnapshot(snapshot)) {
        return errorResponse(request, {
          code: "INVALID_RESULT",
          message:
            "The geometry kernel returned an exact topology snapshot with invalid or inconsistent entity data."
        }) as GeometryKernelResponseForRequest<T>;
      }

      return {
        ok: true,
        id: request.id,
        op: request.op,
        snapshot,
        warnings: []
      } as unknown as GeometryKernelResponseForRequest<T>;
    }

    if (request.op === "geometry.exactTopologyCheckpointPayload") {
      const checkpointPayload = await createExactTopologyCheckpointPayload(
        factories,
        request
      );

      if (isInvalidExactTopologyCheckpointPayload(checkpointPayload)) {
        return errorResponse(request, {
          code: "INVALID_RESULT",
          message:
            "The geometry kernel returned an exact topology checkpoint payload with invalid or inconsistent BRep, topology, or signature data."
        }) as GeometryKernelResponseForRequest<T>;
      }

      return {
        ok: true,
        id: request.id,
        op: request.op,
        checkpointPayload,
        warnings: []
      } as unknown as GeometryKernelResponseForRequest<T>;
    }

    const mesh = await createMesh(factories, request);

    if (isEmptyMesh(mesh)) {
      return errorResponse(request, {
        code: "EMPTY_RESULT",
        message: "The geometry kernel returned an empty or invalid mesh."
      }) as GeometryKernelResponseForRequest<T>;
    }

    if (isInvalidMesh(mesh)) {
      return errorResponse(request, {
        code: "INVALID_RESULT",
        message:
          "The geometry kernel returned mesh data with inconsistent counts or invalid values."
      }) as GeometryKernelResponseForRequest<T>;
    }

    return {
      ok: true,
      id: request.id,
      op: request.op,
      mesh: {
        primitive: mesh.primitive,
        positions: mesh.positions,
        indices: mesh.indices,
        vertexCount: mesh.vertexCount,
        triangleCount: mesh.triangleCount,
        faceCount: mesh.faceCount
      },
      warnings: []
    } as unknown as GeometryKernelResponseForRequest<T>;
  } catch (error) {
    return errorResponse(
      request,
      toGeometryKernelError(error)
    ) as GeometryKernelResponseForRequest<T>;
  }
}

export function getGeometryResponseTransferables(
  response: GeometryKernelResponse
): readonly ArrayBuffer[] {
  if (!response.ok) {
    return [];
  }

  if ("mesh" in response) {
    return [
      response.mesh.positions.buffer as ArrayBuffer,
      response.mesh.indices.buffer as ArrayBuffer
    ];
  }

  if ("artifact" in response) {
    return [response.artifact.bytes.buffer as ArrayBuffer];
  }

  if ("bodies" in response) {
    return response.bodies.map(
      (body) => body.checkpointPayload.brepBytes.buffer as ArrayBuffer
    );
  }

  if ("checkpointPayload" in response) {
    return [response.checkpointPayload.brepBytes.buffer as ArrayBuffer];
  }

  return [];
}

function validateRequest(
  request: GeometryKernelRequest
): GeometryKernelError | undefined {
  if (request.op === "geometry.tessellateBox") {
    if (
      !isPositiveFiniteNumber(request.dimensions.width) ||
      !isPositiveFiniteNumber(request.dimensions.height) ||
      !isPositiveFiniteNumber(request.dimensions.depth)
    ) {
      return {
        code: "INVALID_DIMENSIONS",
        message: "Box dimensions must be finite numbers greater than zero."
      };
    }
  } else if (
    request.op === "geometry.tessellateCylinder" ||
    request.op === "geometry.tessellateCone"
  ) {
    if (
      !isPositiveFiniteNumber(request.dimensions.radius) ||
      !isPositiveFiniteNumber(request.dimensions.height)
    ) {
      return {
        code: "INVALID_DIMENSIONS",
        message: `${formatPrimitiveLabel(request.op)} dimensions must be finite numbers greater than zero.`
      };
    }
  } else if (request.op === "geometry.tessellateSphere") {
    if (!isPositiveFiniteNumber(request.dimensions.radius)) {
      return {
        code: "INVALID_DIMENSIONS",
        message: "Sphere dimensions must be finite numbers greater than zero."
      };
    }
  } else if (request.op === "geometry.tessellateExtrude") {
    if (
      !isSketchPlane(request.sketchPlane) ||
      !isPositiveFiniteNumber(request.depth) ||
      !isExtrudeSide(request.side ?? "positive") ||
      !isValidExtrudeProfile(request.profile)
    ) {
      return {
        code: "INVALID_DIMENSIONS",
        message:
          "Extrude requests require a supported sketch plane, side, rectangle or circle profile, and positive finite depth."
      };
    }
  } else if (request.op === "geometry.revolveProfile") {
    if (
      !isSketchPlane(request.sketchPlane) ||
      !isValidExtrudeProfile(request.profile) ||
      !isValidRevolveAxis(request.axis) ||
      !isPositiveFiniteNumber(request.angleDegrees) ||
      request.angleDegrees > 360
    ) {
      return {
        code: "INVALID_DIMENSIONS",
        message:
          "Revolve profile requests require a supported sketch plane, rectangle or circle profile, non-zero finite axis, and positive finite angle no greater than 360 degrees."
      };
    }
  } else if (request.op === "geometry.booleanExtrudes") {
    if (!isBooleanOperation(request.operation)) {
      return {
        code: "INVALID_DIMENSIONS",
        message: "Boolean extrude requests require operation add or cut."
      };
    }

    if (
      !isValidBooleanExtrudeSource(request.target) ||
      !isValidBooleanExtrudePrimitiveSource(request.tool)
    ) {
      return {
        code: "INVALID_DIMENSIONS",
        message:
          "Boolean extrude requests require target/tool sources with supported sketch plane, side, profile dimensions, and positive finite depth."
      };
    }

    if (!isSupportedBooleanExtrudeProfilePair(request)) {
      return {
        code: "UNSUPPORTED_PROFILE",
        message:
          "Boolean extrude feasibility currently supports rectangle/circle tools on rectangle or circle targets."
      };
    }
  } else if (request.op === "geometry.hole") {
    if (
      !isValidBooleanExtrudeSource(request.target) ||
      !isValidHoleToolSource(request.tool)
    ) {
      return {
        code: "INVALID_DIMENSIONS",
        message:
          "Hole requests require a supported authored extrude target source, circular tool source, valid depth mode, direction, and finite positive blind depth when provided."
      };
    }
  } else if (request.op === "geometry.edgeFinish") {
    const edgeFinishError = validateEdgeFinishRequest(request);

    if (edgeFinishError) {
      return edgeFinishError;
    }
  } else if (request.op === "geometry.exactBodyMetadata") {
    const metadataSourceError = validateExactBodyMetadataSource(request.source);

    if (metadataSourceError) {
      return metadataSourceError;
    }
  } else if (request.op === "geometry.exactTopologySnapshot") {
    const snapshotSourceError = validateExactBodyMetadataSource(request.source);

    if (snapshotSourceError) {
      return snapshotSourceError;
    }
  } else if (request.op === "geometry.exactTopologyCheckpointPayload") {
    const checkpointSourceError = validateExactBodyMetadataSource(
      request.source
    );

    if (checkpointSourceError) {
      return checkpointSourceError;
    }

    if (
      typeof request.checkpointId !== "string" ||
      request.checkpointId.trim().length === 0 ||
      typeof request.bodyId !== "string" ||
      request.bodyId.trim().length === 0
    ) {
      return {
        code: "INVALID_DIMENSIONS",
        message:
          "Exact topology checkpoint payload requests require non-empty checkpoint and body ids."
      };
    }
  } else if (request.op === "geometry.importStep") {
    if (
      typeof request.sourceFileName !== "string" ||
      request.sourceFileName.trim().length === 0 ||
      !(request.bytes instanceof Uint8Array) ||
      request.bytes.byteLength <= 0 ||
      (request.maxBodyCount !== undefined &&
        !isPositiveInteger(request.maxBodyCount)) ||
      (request.bodyId !== undefined && request.bodyId.trim().length === 0) ||
      (request.checkpointId !== undefined &&
        request.checkpointId.trim().length === 0)
    ) {
      return {
        code: "INVALID_DIMENSIONS",
        message:
          "STEP import requests require a non-empty source filename, non-empty byte payload, optional positive max body count, and optional non-empty body/checkpoint ids."
      };
    }
  } else if (request.op === "geometry.exportStep") {
    if (request.bodies.length === 0) {
      return {
        code: "INVALID_DIMENSIONS",
        message: "STEP export requests require at least one exact body source."
      };
    }

    for (const body of request.bodies) {
      if (!body.bodyId || !isValidBooleanExtrudeSource(body)) {
        return {
          code: "INVALID_DIMENSIONS",
          message:
            "STEP export currently supports active rectangle/circle newBody extrude sources with finite positive dimensions."
        };
      }
    }
  } else if (
    request.op === "geometry.linearPattern" ||
    request.op === "geometry.circularPattern" ||
    request.op === "geometry.mirror"
  ) {
    // pattern/mirror requests have no dimension fields to validate here
  } else if (request.op === "geometry.shell") {
    if (!isPositiveFiniteNumber(request.wallThickness)) {
      return {
        code: "INVALID_DIMENSIONS",
        message: "Shell requests require a finite positive wallThickness."
      };
    }
  } else if (
    !isPositiveFiniteNumber(request.dimensions.majorRadius) ||
    !isPositiveFiniteNumber(request.dimensions.minorRadius) ||
    request.dimensions.minorRadius >= request.dimensions.majorRadius
  ) {
    return {
      code: "INVALID_DIMENSIONS",
      message:
        "Torus dimensions must be finite numbers greater than zero with minorRadius smaller than majorRadius."
    };
  }

  if (
    "tessellation" in request &&
    (!isOptionalPositiveFiniteNumber(request.tessellation?.linearDeflection) ||
      !isOptionalPositiveFiniteNumber(request.tessellation?.angularDeflection))
  ) {
    return {
      code: "INVALID_TESSELLATION_OPTIONS",
      message: "Tessellation options must be finite numbers greater than zero."
    };
  }

  return undefined;
}

function createMesh(
  factories: GeometryKernelMeshFactories,
  request: GeometryKernelMeshRequest
): Promise<GeometryKernelMeshResult> {
  switch (request.op) {
    case "geometry.tessellateBox":
      return factories.createBoxMesh({
        ...request.dimensions,
        linearDeflection: request.tessellation?.linearDeflection,
        angularDeflection: request.tessellation?.angularDeflection
      });
    case "geometry.tessellateCylinder":
      return factories.createCylinderMesh({
        ...request.dimensions,
        linearDeflection: request.tessellation?.linearDeflection,
        angularDeflection: request.tessellation?.angularDeflection
      });
    case "geometry.tessellateSphere":
      return factories.createSphereMesh({
        ...request.dimensions,
        linearDeflection: request.tessellation?.linearDeflection,
        angularDeflection: request.tessellation?.angularDeflection
      });
    case "geometry.tessellateCone":
      return factories.createConeMesh({
        ...request.dimensions,
        linearDeflection: request.tessellation?.linearDeflection,
        angularDeflection: request.tessellation?.angularDeflection
      });
    case "geometry.tessellateTorus":
      return factories.createTorusMesh({
        ...request.dimensions,
        linearDeflection: request.tessellation?.linearDeflection,
        angularDeflection: request.tessellation?.angularDeflection
      });
    case "geometry.tessellateExtrude":
      return createExtrudeMesh(factories, request);
    case "geometry.revolveProfile":
      return createRevolveProfileMesh(factories, request);
    case "geometry.booleanExtrudes":
      return factories.createBooleanExtrudeMesh({
        operation: request.operation,
        target: request.target,
        tool: request.tool,
        linearDeflection: request.tessellation?.linearDeflection,
        angularDeflection: request.tessellation?.angularDeflection
      });
    case "geometry.hole":
      return createHoleMesh(factories, request);
    case "geometry.edgeFinish":
      return createEdgeFinishMesh(factories, request);
    case "geometry.linearPattern":
      return createLinearPatternMesh(factories, request);
    case "geometry.circularPattern":
      return createCircularPatternMesh(factories, request);
    case "geometry.mirror":
      return createMirrorMesh(factories, request);
    case "geometry.shell":
      return createShellMesh(factories, request);
  }
}

function createLinearPatternMesh(
  factories: GeometryKernelMeshFactories,
  request: LinearPatternRequest
): Promise<GeometryKernelMeshResult> {
  if (!factories.createLinearPatternMesh) {
    return Promise.reject({
      code: "UNAVAILABLE_BINDING",
      message:
        "Linear pattern tessellation requires an OCCT linear pattern mesh factory."
    } satisfies GeometryKernelError);
  }

  return factories.createLinearPatternMesh({
    seed: request.seed,
    axis: request.axis,
    spacing: request.spacing,
    instanceCount: request.instanceCount,
    linearDeflection: request.tessellation?.linearDeflection,
    angularDeflection: request.tessellation?.angularDeflection
  });
}

function createCircularPatternMesh(
  factories: GeometryKernelMeshFactories,
  request: CircularPatternRequest
): Promise<GeometryKernelMeshResult> {
  if (!factories.createCircularPatternMesh) {
    return Promise.reject({
      code: "UNAVAILABLE_BINDING",
      message:
        "Circular pattern tessellation requires an OCCT circular pattern mesh factory."
    } satisfies GeometryKernelError);
  }

  return factories.createCircularPatternMesh({
    seed: request.seed,
    rotationAxis: request.rotationAxis,
    totalAngleDegrees: request.totalAngleDegrees,
    instanceCount: request.instanceCount,
    linearDeflection: request.tessellation?.linearDeflection,
    angularDeflection: request.tessellation?.angularDeflection
  });
}

function createMirrorMesh(
  factories: GeometryKernelMeshFactories,
  request: MirrorRequest
): Promise<GeometryKernelMeshResult> {
  if (!factories.createMirrorMesh) {
    return Promise.reject({
      code: "UNAVAILABLE_BINDING",
      message: "Mirror tessellation requires an OCCT mirror mesh factory."
    } satisfies GeometryKernelError);
  }

  return factories.createMirrorMesh({
    seed: request.seed,
    mirrorPlane: request.mirrorPlane,
    includeOriginal: request.includeOriginal,
    linearDeflection: request.tessellation?.linearDeflection,
    angularDeflection: request.tessellation?.angularDeflection
  });
}

function createShellMesh(
  factories: GeometryKernelMeshFactories,
  request: ShellRequest
): Promise<GeometryKernelMeshResult> {
  if (!factories.createShellMesh) {
    return Promise.reject({
      code: "UNAVAILABLE_BINDING",
      message: "Shell tessellation requires an OCCT shell mesh factory."
    } satisfies GeometryKernelError);
  }

  return factories.createShellMesh({
    target: request.target,
    wallThickness: request.wallThickness,
    openFaceStableIds: request.openFaceStableIds,
    linearDeflection: request.tessellation?.linearDeflection,
    angularDeflection: request.tessellation?.angularDeflection
  });
}

function createEdgeFinishMesh(
  factories: GeometryKernelMeshFactories,
  request: EdgeFinishRequest
): Promise<GeometryKernelMeshResult> {
  if (!factories.createEdgeFinishMesh) {
    return Promise.reject({
      code: "UNAVAILABLE_BINDING",
      message:
        "Edge finish tessellation requires an OCCT edge-finish mesh factory."
    } satisfies GeometryKernelError);
  }

  if (request.operation === "chamfer") {
    return factories.createEdgeFinishMesh({
      operation: request.operation,
      target: request.target,
      edgeStableId: request.edgeStableId,
      distance: request.distance,
      linearDeflection: request.tessellation?.linearDeflection,
      angularDeflection: request.tessellation?.angularDeflection
    });
  }

  return factories.createEdgeFinishMesh({
    operation: request.operation,
    target: request.target,
    edgeStableId: request.edgeStableId,
    radius: request.radius,
    linearDeflection: request.tessellation?.linearDeflection,
    angularDeflection: request.tessellation?.angularDeflection
  });
}

function createHoleMesh(
  factories: GeometryKernelMeshFactories,
  request: HoleRequest
): Promise<GeometryKernelMeshResult> {
  if (!factories.createHoleMesh) {
    return Promise.reject({
      code: "UNAVAILABLE_BINDING",
      message: "Hole tessellation requires an OCCT hole mesh factory."
    } satisfies GeometryKernelError);
  }

  return factories.createHoleMesh({
    target: request.target,
    tool: request.tool,
    linearDeflection: request.tessellation?.linearDeflection,
    angularDeflection: request.tessellation?.angularDeflection
  });
}

function createRevolveProfileMesh(
  factories: GeometryKernelMeshFactories,
  request: RevolveProfileRequest
): Promise<GeometryKernelMeshResult> {
  if (!factories.createRevolveProfileMesh) {
    return Promise.reject({
      code: "UNAVAILABLE_BINDING",
      message:
        "Revolve profile tessellation requires an OCCT revolve mesh factory."
    } satisfies GeometryKernelError);
  }

  return factories.createRevolveProfileMesh({
    sketchPlane: request.sketchPlane,
    profile: request.profile,
    axis: request.axis,
    angleDegrees: request.angleDegrees,
    linearDeflection: request.tessellation?.linearDeflection,
    angularDeflection: request.tessellation?.angularDeflection
  });
}

function createExactBodyMetadata(
  factories: GeometryKernelMeshFactories,
  request: ExactBodyMetadataRequest
): Promise<GeometryKernelExactBodyMetadata> {
  if (!factories.createExactBodyMetadata) {
    return Promise.reject({
      code: "UNAVAILABLE_BINDING",
      message:
        "Exact body metadata requires an exact metadata factory with OCCT mass-property and bounds bindings."
    } satisfies GeometryKernelError);
  }

  return factories.createExactBodyMetadata({
    source: request.source
  });
}

function createExactTopologySnapshot(
  factories: GeometryKernelMeshFactories,
  request: ExactTopologySnapshotRequest
): Promise<GeometryKernelExactTopologySnapshot> {
  if (!factories.createExactTopologySnapshot) {
    return Promise.reject({
      code: "UNAVAILABLE_BINDING",
      message:
        "Exact topology snapshots require an OCCT topology snapshot factory with subshape traversal bindings."
    } satisfies GeometryKernelError);
  }

  return factories.createExactTopologySnapshot({
    source: request.source
  });
}

function createExactTopologyCheckpointPayload(
  factories: GeometryKernelMeshFactories,
  request: ExactTopologyCheckpointPayloadRequest
): Promise<GeometryKernelExactTopologyCheckpointPayload> {
  if (!factories.createExactTopologyCheckpointPayload) {
    return Promise.reject({
      code: "UNAVAILABLE_BINDING",
      message:
        "Exact topology checkpoint payloads require an OCCT BRep checkpoint writer factory through the geometry boundary."
    } satisfies GeometryKernelError);
  }

  return factories.createExactTopologyCheckpointPayload({
    checkpointId: request.checkpointId,
    bodyId: request.bodyId,
    source: request.source
  });
}

function createStepImport(
  factories: GeometryKernelMeshFactories,
  request: StepImportRequest
): Promise<GeometryKernelStepImportResult> {
  if (!factories.createStepImport) {
    return Promise.reject({
      code: "UNAVAILABLE_BINDING",
      message:
        "STEP import requires an OCCT STEP reader, healing, and BRep checkpoint factory through the geometry boundary."
    } satisfies GeometryKernelError);
  }

  return factories.createStepImport({
    sourceFileName: request.sourceFileName,
    bytes: request.bytes,
    maxBodyCount: request.maxBodyCount,
    bodyId: request.bodyId,
    checkpointId: request.checkpointId
  });
}

function createExactStepExport(
  factories: GeometryKernelMeshFactories,
  request: ExactStepExportRequest
): Promise<GeometryKernelExactStepExportArtifact> {
  if (!factories.createExactStepExport) {
    return Promise.reject({
      code: "UNAVAILABLE_BINDING",
      message:
        "Exact STEP export requires an OCCT STEP writer factory through the geometry boundary."
    } satisfies GeometryKernelError);
  }

  return factories.createExactStepExport({
    units: request.units,
    bodies: request.bodies
  });
}

async function createExtrudeMesh(
  factories: GeometryKernelMeshFactories,
  request: TessellateExtrudeRequest
): Promise<GeometryKernelMeshResult> {
  const mesh =
    request.profile.kind === "rectangle"
      ? await factories.createBoxMesh({
          width: request.profile.width,
          height: request.profile.height,
          depth: request.depth,
          linearDeflection: request.tessellation?.linearDeflection,
          angularDeflection: request.tessellation?.angularDeflection
        })
      : await factories.createCylinderMesh({
          radius: request.profile.radius,
          height: request.depth,
          linearDeflection: request.tessellation?.linearDeflection,
          angularDeflection: request.tessellation?.angularDeflection
        });

  return {
    primitive: "extrude",
    positions: mapExtrudePositions(
      mesh.positions,
      request.sketchPlane,
      request.profile.center,
      request.depth,
      request.side ?? "positive"
    ),
    indices: mesh.indices,
    vertexCount: mesh.vertexCount,
    triangleCount: mesh.triangleCount,
    faceCount: mesh.faceCount
  };
}

function mapExtrudePositions(
  positions: Float32Array,
  sketchPlane: GeometryKernelSketchPlane,
  center: readonly [number, number],
  depth: number,
  side: GeometryKernelExtrudeSide
): Float32Array {
  const mapped = new Float32Array(positions.length);
  const bounds = getPositionBounds(positions);
  const profileCenterX = (bounds.min[0] + bounds.max[0]) / 2;
  const profileCenterY = (bounds.min[1] + bounds.max[1]) / 2;
  const normalOrigin = bounds.min[2];

  for (let index = 0; index < positions.length; index += 3) {
    const profileX = positions[index] - profileCenterX + center[0];
    const profileY = positions[index + 1] - profileCenterY + center[1];
    const normal = mapExtrudeNormal(
      positions[index + 2] - normalOrigin,
      depth,
      side
    );
    const [x, y, z] = mapPlanePoint(sketchPlane, profileX, profileY, normal);

    mapped[index] = x;
    mapped[index + 1] = y;
    mapped[index + 2] = z;
  }

  return mapped;
}

function mapExtrudeNormal(
  positiveNormal: number,
  depth: number,
  side: GeometryKernelExtrudeSide
): number {
  switch (side) {
    case "positive":
      return positiveNormal;
    case "negative":
      return -positiveNormal;
    case "symmetric":
      return positiveNormal - depth / 2;
  }
}

function getPositionBounds(positions: Float32Array): {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
} {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < positions.length; index += 3) {
    minX = Math.min(minX, positions[index]);
    minY = Math.min(minY, positions[index + 1]);
    minZ = Math.min(minZ, positions[index + 2]);
    maxX = Math.max(maxX, positions[index]);
    maxY = Math.max(maxY, positions[index + 1]);
    maxZ = Math.max(maxZ, positions[index + 2]);
  }

  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ]
  };
}

function mapPlanePoint(
  sketchPlane: GeometryKernelSketchPlane,
  profileX: number,
  profileY: number,
  normal: number
): readonly [number, number, number] {
  switch (sketchPlane) {
    case "XY":
      return [profileX, profileY, normal];
    case "XZ":
      return [profileX, normal, profileY];
    case "YZ":
      return [normal, profileX, profileY];
  }
}

function formatPrimitiveLabel(op: GeometryKernelOp): string {
  switch (op) {
    case "geometry.tessellateBox":
      return "Box";
    case "geometry.tessellateCylinder":
      return "Cylinder";
    case "geometry.tessellateSphere":
      return "Sphere";
    case "geometry.tessellateCone":
      return "Cone";
    case "geometry.tessellateTorus":
      return "Torus";
    case "geometry.tessellateExtrude":
      return "Extrude";
    case "geometry.revolveProfile":
      return "Revolve profile";
    case "geometry.booleanExtrudes":
      return "Boolean extrude";
    case "geometry.hole":
      return "Hole";
    case "geometry.edgeFinish":
      return "Edge finish";
    case "geometry.linearPattern":
      return "Linear pattern";
    case "geometry.circularPattern":
      return "Circular pattern";
    case "geometry.mirror":
      return "Mirror feature";
    case "geometry.shell":
      return "Shell feature";
    case "geometry.exactBodyMetadata":
      return "Exact body metadata";
    case "geometry.exactTopologySnapshot":
      return "Exact topology snapshot";
    case "geometry.exactTopologyCheckpointPayload":
      return "Exact topology checkpoint payload";
    case "geometry.importStep":
      return "STEP import";
    case "geometry.exportStep":
      return "STEP export";
  }
}

function errorResponse(
  request: GeometryKernelRequest,
  error: GeometryKernelError
): GeometryKernelErrorResponse {
  return {
    ok: false,
    id: request.id,
    op: request.op,
    error,
    warnings: []
  };
}

function toGeometryKernelError(error: unknown): GeometryKernelError {
  if (isGeometryKernelError(error)) {
    return error;
  }

  return {
    code: "KERNEL_FAILURE",
    message:
      error instanceof Error
        ? error.message
        : "The geometry kernel failed to execute the request."
  };
}

function isGeometryKernelError(error: unknown): error is GeometryKernelError {
  if (
    !error ||
    typeof error !== "object" ||
    !("code" in error) ||
    !("message" in error)
  ) {
    return false;
  }

  const candidate = error as {
    readonly code?: unknown;
    readonly message?: unknown;
  };

  return (
    typeof candidate.message === "string" &&
    isGeometryKernelErrorCode(candidate.code)
  );
}

function isGeometryKernelErrorCode(
  value: unknown
): value is GeometryKernelErrorCode {
  return (
    value === "INVALID_DIMENSIONS" ||
    value === "INVALID_TESSELLATION_OPTIONS" ||
    value === "UNSUPPORTED_PROFILE" ||
    value === "UNSUPPORTED_EDGE" ||
    value === "INVALID_EDGE_ROLE" ||
    value === "EDGE_FINISH_TOO_LARGE" ||
    value === "INVALID_PLACEMENT" ||
    value === "KERNEL_FAILURE" ||
    value === "EMPTY_RESULT" ||
    value === "INVALID_RESULT" ||
    value === "UNAVAILABLE_BINDING"
  );
}

function isOptionalPositiveFiniteNumber(value: number | undefined): boolean {
  return value === undefined || isPositiveFiniteNumber(value);
}

function isPositiveFiniteNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isSketchPlane(value: GeometryKernelSketchPlane): boolean {
  return value === "XY" || value === "XZ" || value === "YZ";
}

function isExtrudeSide(value: unknown): value is GeometryKernelExtrudeSide {
  return value === "positive" || value === "negative" || value === "symmetric";
}

function isBooleanOperation(
  value: unknown
): value is GeometryKernelBooleanOperation {
  return value === "add" || value === "cut";
}

function isHoleDepthMode(value: unknown): value is GeometryKernelHoleDepthMode {
  return value === "blind" || value === "throughAll";
}

function isHoleDirection(value: unknown): value is GeometryKernelHoleDirection {
  return value === "positive" || value === "negative";
}

function isValidEdgeFinishOperation(
  value: unknown
): value is GeometryKernelEdgeFinishOperation {
  return value === "chamfer" || value === "fillet";
}

function isValidExtrudeProfile(profile: ExtrudeGeometryProfile): boolean {
  if (profile.kind === "rectangle") {
    return (
      isVec2(profile.center) &&
      isPositiveFiniteNumber(profile.width) &&
      isPositiveFiniteNumber(profile.height)
    );
  }

  if (profile.kind === "circle") {
    return isVec2(profile.center) && isPositiveFiniteNumber(profile.radius);
  }

  return false;
}

function isValidRevolveAxis(axis: RevolveGeometryAxis): boolean {
  return (
    isVec2(axis.start) &&
    isVec2(axis.end) &&
    Math.hypot(axis.end[0] - axis.start[0], axis.end[1] - axis.start[1]) > 0
  );
}

function isValidBooleanExtrudePrimitiveSource(
  source: BooleanExtrudePrimitiveSource
): boolean {
  return (
    isSketchPlane(source.sketchPlane) &&
    isPositiveFiniteNumber(source.depth) &&
    isExtrudeSide(source.side ?? "positive") &&
    isValidExtrudeProfile(source.profile) &&
    (source.placementFrame === undefined ||
      isValidBooleanExtrudePlacementFrame(source.placementFrame))
  );
}

function isValidBooleanExtrudeSource(source: BooleanExtrudeSource): boolean {
  if (isBooleanExtrudeResultSource(source)) {
    return (
      isBooleanOperation(source.operation) &&
      isValidBooleanExtrudeSource(source.target) &&
      isValidBooleanExtrudePrimitiveSource(source.tool) &&
      isSupportedBooleanExtrudeSourcePair(source)
    );
  }

  return isValidBooleanExtrudePrimitiveSource(source);
}

function isValidHoleToolSource(source: HoleToolSource): boolean {
  return (
    isSketchPlane(source.sketchPlane) &&
    source.circle.kind === "circle" &&
    isValidExtrudeProfile(source.circle) &&
    isHoleDepthMode(source.depthMode) &&
    isHoleDirection(source.direction ?? "positive") &&
    (source.depthMode === "blind"
      ? source.depth !== undefined && isPositiveFiniteNumber(source.depth)
      : source.depth === undefined) &&
    (source.placementFrame === undefined ||
      isValidBooleanExtrudePlacementFrame(source.placementFrame))
  );
}

function isValidEdgeFinishAmount(request: EdgeFinishRequest): boolean {
  if (
    typeof request.edgeStableId !== "string" ||
    request.edgeStableId.trim().length === 0
  ) {
    return false;
  }

  if (request.operation === "chamfer") {
    return (
      isPositiveFiniteNumber(request.distance) &&
      !("radius" in request && request.radius !== undefined)
    );
  }

  if (request.operation === "fillet") {
    return (
      isPositiveFiniteNumber(request.radius) &&
      !("distance" in request && request.distance !== undefined)
    );
  }

  return false;
}

const RECTANGLE_EDGE_FINISH_ROLES = [
  "start:uMin",
  "start:uMax",
  "start:vMin",
  "start:vMax",
  "end:uMin",
  "end:uMax",
  "end:vMin",
  "end:vMax",
  "longitudinal:uMin:vMin",
  "longitudinal:uMin:vMax",
  "longitudinal:uMax:vMin",
  "longitudinal:uMax:vMax"
] satisfies readonly GeometryKernelRectangleEdgeRole[];

const CIRCULAR_EDGE_FINISH_ROLES = [
  "start:circular",
  "end:circular"
] satisfies readonly GeometryKernelCircularEdgeRole[];

function parseEdgeFinishEdgeRole(
  stableId: string
): GeometryKernelEdgeFinishEdgeRole | undefined {
  if (!stableId.startsWith("generated:edge:")) {
    return undefined;
  }

  return [...RECTANGLE_EDGE_FINISH_ROLES, ...CIRCULAR_EDGE_FINISH_ROLES].find(
    (role) => stableId.endsWith(`:${role}`)
  );
}

function isRectangleEdgeFinishRole(
  role: GeometryKernelEdgeFinishEdgeRole
): role is GeometryKernelRectangleEdgeRole {
  return (RECTANGLE_EDGE_FINISH_ROLES as readonly string[]).includes(role);
}

function isEdgeFinishAmountTooLarge(
  request: EdgeFinishRequest,
  role: GeometryKernelRectangleEdgeRole,
  target: BooleanExtrudePrimitiveSource
): boolean {
  const maxAmount = getRectangleEdgeFinishMaximumAmount(target, role);
  const amount =
    request.operation === "chamfer" ? request.distance : request.radius;

  return amount >= maxAmount;
}

function getRectangleEdgeFinishMaximumAmount(
  target: BooleanExtrudePrimitiveSource,
  role: GeometryKernelRectangleEdgeRole
): number {
  if (target.profile.kind !== "rectangle") {
    return 0;
  }

  const profile = target.profile;
  const profileWidth = profile.width;
  const profileHeight = profile.height;
  const depth = target.depth;

  if (role.startsWith("longitudinal:")) {
    return Math.min(profileWidth, profileHeight) / 2;
  }

  const [, profileEdgeRole] = role.split(":") as [
    "start" | "end",
    "uMin" | "uMax" | "vMin" | "vMax"
  ];

  return profileEdgeRole === "uMin" || profileEdgeRole === "uMax"
    ? Math.min(profileWidth, depth) / 2
    : Math.min(profileHeight, depth) / 2;
}

function validateEdgeFinishRequest(
  request: EdgeFinishRequest
): GeometryKernelError | undefined {
  if (
    !isValidBooleanExtrudeSource(request.target) ||
    !isValidEdgeFinishOperation(request.operation) ||
    !isValidEdgeFinishAmount(request)
  ) {
    return {
      code: "INVALID_DIMENSIONS",
      message:
        "Edge finish requests require a supported authored extrude target source, operation chamfer or fillet, one generated edge stable ID, and a positive finite distance or radius."
    };
  }

  const edgeRole = parseEdgeFinishEdgeRole(request.edgeStableId);

  if (!edgeRole) {
    return {
      code: "INVALID_EDGE_ROLE",
      message:
        "Edge finish requests require a generated rectangle edge stable ID with a supported semantic edge role."
    };
  }

  if (!isRectangleEdgeFinishRole(edgeRole)) {
    return {
      code: "UNSUPPORTED_EDGE",
      message:
        "Edge finish feasibility currently supports rectangle source edges and rectangle cut-wall result edges only."
    };
  }

  const edgeSource = getEdgeFinishReferenceSource(request.target, edgeRole);

  if (!edgeSource) {
    return {
      code: "UNSUPPORTED_EDGE",
      message:
        "Edge finish feasibility currently supports rectangle source edges and rectangle cut-wall result edges only."
    };
  }

  if (isEdgeFinishAmountTooLarge(request, edgeRole, edgeSource)) {
    return {
      code: "EDGE_FINISH_TOO_LARGE",
      message:
        "Edge finish distance or radius is too large for the selected rectangle edge in this feasibility path."
    };
  }

  return undefined;
}

function validateExactBodyMetadataSource(
  source: ExactBodyMetadataSource
): GeometryKernelError | undefined {
  if (source.kind === "extrude") {
    return isValidBooleanExtrudeSource(source)
      ? undefined
      : createInvalidExactBodyMetadataSourceError();
  }

  if (source.kind === "booleanExtrudes") {
    const request: BooleanExtrudesRequest = {
      id: "exact-metadata-validation",
      version: "geometry-kernel.v1",
      op: "geometry.booleanExtrudes",
      operation: source.operation,
      target: source.target,
      tool: source.tool
    };

    return isBooleanOperation(source.operation) &&
      isValidBooleanExtrudeSource(source.target) &&
      isValidBooleanExtrudePrimitiveSource(source.tool) &&
      isSupportedBooleanExtrudeProfilePair(request)
      ? undefined
      : createInvalidExactBodyMetadataSourceError();
  }

  if (source.kind === "revolve") {
    return isSketchPlane(source.sketchPlane) &&
      isValidExtrudeProfile(source.profile) &&
      isValidRevolveAxis(source.axis) &&
      isPositiveFiniteNumber(source.angleDegrees) &&
      source.angleDegrees <= 360 &&
      (source.placementFrame === undefined ||
        isValidBooleanExtrudePlacementFrame(source.placementFrame))
      ? undefined
      : createInvalidExactBodyMetadataSourceError();
  }

  if (source.kind === "hole") {
    return isValidBooleanExtrudeSource(source.target) &&
      isValidHoleToolSource(source.tool)
      ? undefined
      : createInvalidExactBodyMetadataSourceError();
  }

  if (source.kind === "edgeFinish") {
    const request: EdgeFinishRequest =
      source.operation === "chamfer"
        ? {
            id: "exact-metadata-validation",
            version: "geometry-kernel.v1",
            op: "geometry.edgeFinish",
            operation: source.operation,
            target: source.target,
            edgeStableId: source.edgeStableId,
            distance: source.distance
          }
        : {
            id: "exact-metadata-validation",
            version: "geometry-kernel.v1",
            op: "geometry.edgeFinish",
            operation: source.operation,
            target: source.target,
            edgeStableId: source.edgeStableId,
            radius: source.radius
          };

    return validateEdgeFinishRequest(request);
  }

  return createInvalidExactBodyMetadataSourceError();
}

function createInvalidExactBodyMetadataSourceError(): GeometryKernelError {
  return {
    code: "INVALID_DIMENSIONS",
    message:
      "Exact body metadata requests require supported extrude, booleanExtrudes, revolve, hole, or edgeFinish source data with finite positive dimensions."
  };
}

function isEmptyMesh(mesh: GeometryKernelMeshResult): boolean {
  return (
    mesh.vertexCount <= 0 ||
    mesh.triangleCount <= 0 ||
    mesh.positions.length === 0 ||
    mesh.indices.length === 0
  );
}

function isInvalidExactBodyMetadata(
  metadata: GeometryKernelExactBodyMetadata
): boolean {
  return (
    (metadata.sourceKind !== "extrude" &&
      metadata.sourceKind !== "booleanExtrudes" &&
      metadata.sourceKind !== "revolve" &&
      metadata.sourceKind !== "hole" &&
      metadata.sourceKind !== "edgeFinish") ||
    !isVec3(metadata.bounds.min) ||
    !isVec3(metadata.bounds.max) ||
    !isVec3(metadata.centroid) ||
    !isFiniteNumber(metadata.volume) ||
    !isFiniteNumber(metadata.surfaceArea) ||
    metadata.volume < 0 ||
    metadata.surfaceArea < 0 ||
    !isNonNegativeInteger(metadata.topologyCounts.solidCount) ||
    !isNonNegativeInteger(metadata.topologyCounts.faceCount) ||
    !isNonNegativeInteger(metadata.topologyCounts.edgeCount) ||
    !isNonNegativeInteger(metadata.topologyCounts.vertexCount) ||
    metadata.measurementSource !== "kernel-derived" ||
    metadata.measurementConfidence !== "kernel-derived" ||
    !Array.isArray(metadata.diagnostics) ||
    metadata.diagnostics.some(
      (diagnostic) =>
        typeof diagnostic.code !== "string" ||
        diagnostic.code.trim().length === 0 ||
        typeof diagnostic.message !== "string" ||
        diagnostic.message.trim().length === 0
    )
  );
}

function isInvalidExactTopologySnapshot(
  snapshot: GeometryKernelExactTopologySnapshot
): boolean {
  const expectedEntityCount =
    snapshot.entityCounts.bodyCount +
    snapshot.entityCounts.solidCount +
    snapshot.entityCounts.faceCount +
    snapshot.entityCounts.wireCount +
    snapshot.entityCounts.edgeCount +
    snapshot.entityCounts.vertexCount +
    snapshot.entityCounts.loopCount +
    snapshot.entityCounts.coedgeCount +
    snapshot.entityCounts.axisCount;

  return (
    !isExactTopologySourceKind(snapshot.sourceKind) ||
    (snapshot.status !== "ready" && snapshot.status !== "partial") ||
    snapshot.source !== "kernel-derived" ||
    snapshot.signatureAlgorithm !== "partbench-derived-topology-snapshot-v1" ||
    typeof snapshot.signature !== "string" ||
    snapshot.signature.trim().length === 0 ||
    !isNonNegativeInteger(snapshot.entityCounts.bodyCount) ||
    !isNonNegativeInteger(snapshot.entityCounts.solidCount) ||
    !isNonNegativeInteger(snapshot.entityCounts.faceCount) ||
    !isNonNegativeInteger(snapshot.entityCounts.wireCount) ||
    !isNonNegativeInteger(snapshot.entityCounts.edgeCount) ||
    !isNonNegativeInteger(snapshot.entityCounts.vertexCount) ||
    !isNonNegativeInteger(snapshot.entityCounts.loopCount) ||
    !isNonNegativeInteger(snapshot.entityCounts.coedgeCount) ||
    !isNonNegativeInteger(snapshot.entityCounts.axisCount) ||
    !isNonNegativeInteger(snapshot.entityCount) ||
    snapshot.entityCount !== snapshot.entities.length ||
    snapshot.entityCount !== expectedEntityCount ||
    snapshot.entities.some(
      (entity) =>
        typeof entity.localId !== "string" ||
        entity.localId.trim().length === 0 ||
        !isTopologyEntityKind(entity.kind) ||
        entity.source !== "kernel-derived" ||
        typeof entity.signature !== "string" ||
        entity.signature.trim().length === 0 ||
        (entity.bounds !== undefined &&
          !isGeometryKernelBounds(entity.bounds)) ||
        (entity.surfaceClass !== undefined &&
          !isTopologySurfaceClass(entity.surfaceClass)) ||
        (entity.curveClass !== undefined &&
          !isTopologyCurveClass(entity.curveClass)) ||
        (entity.point !== undefined && !isVec3(entity.point)) ||
        (entity.midpoint !== undefined && !isVec3(entity.midpoint)) ||
        (entity.normal !== undefined && !isVec3(entity.normal)) ||
        (entity.axis !== undefined && !isVec3(entity.axis)) ||
        (entity.radius !== undefined && !isNonNegativeFinite(entity.radius)) ||
        (entity.area !== undefined && !isNonNegativeFinite(entity.area)) ||
        (entity.length !== undefined && !isNonNegativeFinite(entity.length)) ||
        (entity.adjacency !== undefined &&
          !isTopologyAdjacencyEvidence(entity.adjacency)) ||
        (entity.orientation !== undefined &&
          !isTopologyOrientation(entity.orientation)) ||
        (entity.loopRole !== undefined &&
          !isTopologyLoopRole(entity.loopRole)) ||
        (entity.relationships !== undefined &&
          !isTopologyRelationshipEvidence(entity.relationships)) ||
        !isTopologyDescriptorEvidenceForKind(entity)
    ) ||
    snapshot.unsupportedEntityKinds.some(
      (kind) => !isTopologyEntityKind(kind)
    ) ||
    typeof snapshot.adjacencyAvailable !== "boolean" ||
    !Array.isArray(snapshot.diagnostics) ||
    snapshot.diagnostics.some(
      (diagnostic) =>
        !isTopologyDiagnosticCode(diagnostic.code) ||
        (diagnostic.severity !== "info" && diagnostic.severity !== "warning") ||
        typeof diagnostic.message !== "string" ||
        diagnostic.message.trim().length === 0 ||
        (diagnostic.entityKind !== undefined &&
          !isTopologyEntityKind(diagnostic.entityKind))
    )
  );
}

function isInvalidExactTopologyCheckpointPayload(
  checkpointPayload: GeometryKernelExactTopologyCheckpointPayload
): boolean {
  return (
    typeof checkpointPayload.checkpointId !== "string" ||
    checkpointPayload.checkpointId.trim().length === 0 ||
    typeof checkpointPayload.bodyId !== "string" ||
    checkpointPayload.bodyId.trim().length === 0 ||
    !isExactTopologySourceKind(checkpointPayload.sourceKind) ||
    checkpointPayload.brepFormat !== "occt-brep" ||
    checkpointPayload.brepWriter !== "BRepTools.Write_3" ||
    !(checkpointPayload.brepBytes instanceof Uint8Array) ||
    checkpointPayload.brepBytes.byteLength <= 0 ||
    checkpointPayload.brepByteLength !==
      checkpointPayload.brepBytes.byteLength ||
    isInvalidExactTopologySnapshot(checkpointPayload.topologySnapshot) ||
    isInvalidCheckpointSignaturePayload(
      checkpointPayload.signaturePayload,
      checkpointPayload.checkpointId,
      checkpointPayload.topologySnapshot
    )
  );
}

function isInvalidStepImportResult(
  importResult: GeometryKernelStepImportResult
): boolean {
  return (
    importResult.sourceFormat !== "step" ||
    typeof importResult.sourceFileName !== "string" ||
    importResult.sourceFileName.trim().length === 0 ||
    !isPositiveInteger(importResult.bodyCount) ||
    !Array.isArray(importResult.bodies) ||
    importResult.bodyCount !== importResult.bodies.length ||
    !Array.isArray(importResult.diagnostics) ||
    importResult.diagnostics.some(isInvalidStepImportDiagnostic) ||
    importResult.bodies.some((body) => {
      return (
        body.sourceFormat !== "step" ||
        body.sourceFileName !== importResult.sourceFileName ||
        (body.bodyName !== undefined && body.bodyName.trim().length === 0) ||
        !isImportedBodyShapeType(body.shapeType) ||
        !isGeometryKernelBounds(body.bounds) ||
        !isPositiveInteger(body.solidCount) ||
        !isNonNegativeInteger(body.faceCount) ||
        !isNonNegativeInteger(body.edgeCount) ||
        !isNonNegativeInteger(body.vertexCount) ||
        isInvalidExactTopologySnapshot(body.topologySnapshot) ||
        isInvalidExactTopologyCheckpointPayload(body.checkpointPayload) ||
        body.checkpointPayload.sourceKind !== "importedBody" ||
        body.checkpointPayload.topologySnapshot.signature !==
          body.topologySnapshot.signature ||
        typeof body.healingApplied !== "boolean" ||
        !Array.isArray(body.diagnostics) ||
        body.diagnostics.some(isInvalidStepImportDiagnostic)
      );
    })
  );
}

function isExactTopologySourceKind(
  value: unknown
): value is ExactTopologySourceKind {
  return (
    value === "extrude" ||
    value === "booleanExtrudes" ||
    value === "revolve" ||
    value === "hole" ||
    value === "edgeFinish" ||
    value === "importedBody"
  );
}

function isImportedBodyShapeType(
  value: unknown
): value is GeometryKernelImportedBodyShapeType {
  return value === "solid" || value === "compound" || value === "assemblyLeaf";
}

function isInvalidStepImportDiagnostic(
  diagnostic: GeometryKernelStepImportDiagnostic
): boolean {
  return (
    !isStepImportDiagnosticCode(diagnostic.code) ||
    (diagnostic.severity !== "info" &&
      diagnostic.severity !== "warning" &&
      diagnostic.severity !== "blocking") ||
    typeof diagnostic.message !== "string" ||
    diagnostic.message.trim().length === 0
  );
}

function isStepImportDiagnosticCode(
  code: string
): code is GeometryKernelStepImportDiagnosticCode {
  return (
    code === "STEP_READER_AVAILABLE" ||
    code === "STEP_TRANSFER_COMPLETE" ||
    code === "STEP_HEALING_APPLIED" ||
    code === "STEP_HEALING_NOT_REQUIRED" ||
    code === "STEP_TOPOLOGY_EXTRACTED" ||
    code === "STEP_CHECKPOINT_PAYLOAD_CREATED"
  );
}

function isInvalidCheckpointSignaturePayload(
  signaturePayload: GeometryKernelTopologyCheckpointSignaturePayload,
  checkpointId: string,
  topologySnapshot: GeometryKernelExactTopologySnapshot
): boolean {
  if (
    signaturePayload.checkpointId !== checkpointId ||
    signaturePayload.signatureAlgorithm !==
      "partbench-derived-topology-snapshot-v1" ||
    signaturePayload.signature !== topologySnapshot.signature ||
    signaturePayload.entityCount !== topologySnapshot.entityCount ||
    signaturePayload.entities.length !== topologySnapshot.entityCount
  ) {
    return true;
  }

  const topologyEntitiesById = new Map(
    topologySnapshot.entities.map((entity) => [entity.localId, entity])
  );
  const signatureEntityIds = new Set<string>();

  for (const entity of signaturePayload.entities) {
    const topologyEntity = topologyEntitiesById.get(entity.localId);

    if (
      signatureEntityIds.has(entity.localId) ||
      !topologyEntity ||
      topologyEntity.kind !== entity.kind ||
      topologyEntity.signature !== entity.signature ||
      !isTopologyEntityKind(entity.kind) ||
      typeof entity.signature !== "string" ||
      entity.signature.trim().length === 0
    ) {
      return true;
    }

    signatureEntityIds.add(entity.localId);
  }

  return false;
}

function isGeometryKernelBounds(value: unknown): value is GeometryKernelBounds {
  if (!isRecord(value) || !isVec3(value.min) || !isVec3(value.max)) {
    return false;
  }

  const min = value.min;
  const max = value.max;

  return (
    min.every(isFiniteNumber) &&
    max.every(isFiniteNumber) &&
    min.every((component, index) => component <= max[index])
  );
}

function isTopologyEntityKind(
  kind: string
): kind is GeometryKernelTopologyEntityKind {
  return (
    kind === "body" ||
    kind === "solid" ||
    kind === "face" ||
    kind === "wire" ||
    kind === "edge" ||
    kind === "vertex" ||
    kind === "loop" ||
    kind === "coedge" ||
    kind === "axis"
  );
}

function isTopologySurfaceClass(value: unknown): boolean {
  return (
    value === "plane" ||
    value === "cylinder" ||
    value === "cone" ||
    value === "sphere" ||
    value === "torus" ||
    value === "bspline" ||
    value === "unknown"
  );
}

function isTopologyLoopRole(value: unknown): boolean {
  return value === "outer" || value === "inner" || value === "unknown";
}

function isTopologyDescriptorEvidenceForKind(
  entity: GeometryKernelTopologyEntityDescriptor
): boolean {
  switch (entity.kind) {
    case "loop":
      return (
        entity.surfaceClass === undefined &&
        entity.curveClass === undefined &&
        entity.point === undefined &&
        entity.midpoint === undefined &&
        entity.normal === undefined &&
        entity.axis === undefined &&
        entity.radius === undefined &&
        entity.area === undefined &&
        entity.length === undefined
      );
    case "face":
      return (
        entity.curveClass === undefined &&
        entity.point === undefined &&
        entity.midpoint === undefined &&
        entity.length === undefined &&
        entity.loopRole === undefined
      );
    case "edge":
      return (
        entity.surfaceClass === undefined &&
        entity.point === undefined &&
        entity.normal === undefined &&
        entity.area === undefined &&
        entity.loopRole === undefined
      );
    case "vertex":
      return (
        entity.surfaceClass === undefined &&
        entity.curveClass === undefined &&
        entity.midpoint === undefined &&
        entity.normal === undefined &&
        entity.axis === undefined &&
        entity.radius === undefined &&
        entity.area === undefined &&
        entity.length === undefined &&
        entity.loopRole === undefined
      );
    case "axis":
      return (
        entity.surfaceClass === undefined &&
        entity.curveClass === undefined &&
        entity.midpoint === undefined &&
        entity.normal === undefined &&
        entity.radius === undefined &&
        entity.area === undefined &&
        entity.length === undefined &&
        entity.loopRole === undefined
      );
    default:
      return (
        entity.surfaceClass === undefined &&
        entity.curveClass === undefined &&
        entity.point === undefined &&
        entity.midpoint === undefined &&
        entity.normal === undefined &&
        entity.axis === undefined &&
        entity.radius === undefined &&
        entity.area === undefined &&
        entity.length === undefined &&
        entity.loopRole === undefined
      );
  }
}

function isTopologyCurveClass(value: unknown): boolean {
  return (
    value === "line" ||
    value === "circle" ||
    value === "ellipse" ||
    value === "bspline" ||
    value === "unknown"
  );
}

function isTopologyOrientation(value: unknown): boolean {
  return (
    value === "forward" ||
    value === "reversed" ||
    value === "internal" ||
    value === "external" ||
    value === "unknown"
  );
}

function isTopologyAdjacencyEvidence(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.available === "boolean" &&
    Array.isArray(value.neighborSignatureHashes) &&
    value.neighborSignatureHashes.every(
      (hash) => typeof hash === "string" && hash.trim().length > 0
    )
  );
}

function isTopologyRelationshipEvidence(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isOptionalNonEmptyString(value.parentFaceLocalId) &&
    isOptionalNonEmptyString(value.parentWireLocalId) &&
    isOptionalNonEmptyString(value.parentLoopLocalId) &&
    isOptionalNonEmptyString(value.underlyingWireLocalId) &&
    isOptionalNonEmptyString(value.underlyingEdgeLocalId) &&
    isOptionalNonEmptyString(value.startVertexLocalId) &&
    isOptionalNonEmptyString(value.endVertexLocalId) &&
    isOptionalNonEmptyStringArray(value.childWireLocalIds) &&
    isOptionalNonEmptyStringArray(value.childLoopLocalIds) &&
    isOptionalNonEmptyStringArray(value.childCoedgeLocalIds) &&
    isOptionalNonEmptyStringArray(value.childEdgeLocalIds) &&
    isOptionalNonEmptyStringArray(value.adjacentFaceLocalIds)
  );
}

function isOptionalNonEmptyString(value: unknown): boolean {
  return value === undefined || (typeof value === "string" && value.length > 0);
}

function isOptionalNonEmptyStringArray(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.every((item) => typeof item === "string" && item.length > 0))
  );
}

function isTopologyDiagnosticCode(
  code: string
): code is GeometryKernelTopologyDiagnosticCode {
  return (
    code === "GEOMETRY_TOPOLOGY_SNAPSHOT_EXTRACTED" ||
    code === "GEOMETRY_TOPOLOGY_DESCRIPTOR_EVIDENCE_EXTRACTED" ||
    code === "GEOMETRY_TOPOLOGY_ADJACENCY_EXTRACTED" ||
    code === "GEOMETRY_TOPOLOGY_ENTITY_KIND_UNAVAILABLE" ||
    code === "GEOMETRY_TOPOLOGY_ADJACENCY_UNAVAILABLE" ||
    code === "GEOMETRY_TOPOLOGY_SIGNATURE_LIMITED"
  );
}

function isInvalidMesh(mesh: GeometryKernelMeshResult): boolean {
  return (
    mesh.faceCount < 0 ||
    mesh.positions.length !== mesh.vertexCount * 3 ||
    mesh.indices.length !== mesh.triangleCount * 3 ||
    !Array.from(mesh.positions).every(Number.isFinite) ||
    !Array.from(mesh.indices).every(
      (index) =>
        Number.isInteger(index) && index >= 0 && index < mesh.vertexCount
    )
  );
}

function isSupportedBooleanExtrudeProfilePair(
  request: BooleanExtrudesRequest
): boolean {
  return isSupportedBooleanExtrudeProfileKinds(
    request.operation,
    getBooleanExtrudeSourceProfileKind(request.target)
  );
}

function isSupportedBooleanExtrudeSourcePair(
  source: BooleanExtrudeResultSource
): boolean {
  return isSupportedBooleanExtrudeProfileKinds(
    source.operation,
    getBooleanExtrudeSourceProfileKind(source.target)
  );
}

function isSupportedBooleanExtrudeProfileKinds(
  operation: GeometryKernelBooleanOperation,
  targetProfile: GeometryKernelExtrudeProfileKind
): boolean {
  return (
    (operation === "add" || operation === "cut") &&
    (targetProfile === "rectangle" || targetProfile === "circle")
  );
}

function getBooleanExtrudeSourceProfileKind(
  source: BooleanExtrudeSource
): GeometryKernelExtrudeProfileKind {
  return isBooleanExtrudeResultSource(source)
    ? getBooleanExtrudeSourceProfileKind(source.target)
    : source.profile.kind;
}

function isBooleanExtrudeResultSource(
  source: BooleanExtrudeSource
): source is BooleanExtrudeResultSource {
  return (
    "kind" in source &&
    (source as { readonly kind?: unknown }).kind === "booleanExtrudes"
  );
}

function getEdgeFinishReferenceSource(
  source: BooleanExtrudeSource,
  role: GeometryKernelEdgeFinishEdgeRole
): BooleanExtrudePrimitiveSource | undefined {
  if (!isRectangleEdgeFinishRole(role)) {
    return undefined;
  }

  if (!isBooleanExtrudeResultSource(source)) {
    return source.profile.kind === "rectangle" ? source : undefined;
  }

  if (
    source.operation === "cut" &&
    role.startsWith("longitudinal:") &&
    source.tool.profile.kind === "rectangle"
  ) {
    return source.tool;
  }

  return undefined;
}

function isVec2(value: readonly [number, number]): boolean {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

function isValidBooleanExtrudePlacementFrame(
  frame: BooleanExtrudePlacementFrame
): boolean {
  return (
    isVec3(frame.origin) &&
    isVec3(frame.uAxis) &&
    isVec3(frame.vAxis) &&
    vectorLength(frame.uAxis) > 0 &&
    vectorLength(frame.vAxis) > 0 &&
    vectorLength(crossVec3(frame.uAxis, frame.vAxis)) > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isVec3(value: unknown): value is readonly [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

function vectorLength(vector: readonly [number, number, number]): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function isFiniteNumber(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeFinite(value: number): boolean {
  return isFiniteNumber(value) && value >= 0;
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function crossVec3(
  left: readonly [number, number, number],
  right: readonly [number, number, number]
): readonly [number, number, number] {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0]
  ];
}
