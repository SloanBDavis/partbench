import {
  CAD_TOPOLOGY_IDENTITY_CONTRACT_VERSION,
  CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION,
  WCAD_COMMANDS_ENTRY_PATH,
  WCAD_DOCUMENT_ENTRY_PATH,
  WCAD_MANIFEST_ENTRY_PATH,
  WCAD_PACKAGE_VERSION,
  WCAD_SOURCE_IDENTITY_ALGORITHM,
  type WcadManifestV1,
  type WcadManifestV2,
  type CadBodyExactTopologyEntityDescriptor,
  type CadBodyExactTopologySnapshot,
  type WcadTopologyCheckpointKernelMetadata,
  type WcadTopologyCheckpointManifestEntry,
  type WcadTopologyCheckpointPayloadEntry,
  type WcadTopologyCheckpointSignaturePayload,
  type WcadTopologyCheckpointToleranceMetadata,
  type WcadPackageEntryMetadata,
  type WcadPackageValidationIssue,
  type WcadSourceIdentity,
  type WcadPackageEntryRole
} from "@web-cad/cad-protocol";
import type {
  CadActorMetadata,
  BoxDimensions,
  CadBatch,
  CadBatchResponse,
  CadBatchValidationError,
  CadBatchValidationResult,
  CadAxisAlignedBounds,
  BodyExtentSnapshot,
  CadBodyDerivedExactMetadataSnapshot,
  CadBodyExactMetadataSnapshot,
  CadBodyLifecycleEffectSummary,
  CadBodyLifecycleState,
  CadBodyTopologySnapshot,
  CadBodyRef,
  CadBodySnapshot,
  CadFeatureEditDiagnosticCode,
  CadFeatureRef,
  CadFeatureSummary,
  CadFeatureReferenceChangeSummary,
  CadGeneratedExtrudeFaceRole,
  CadGeneratedEdgeReference,
  CadGeneratedFaceReference,
  CadGeneratedEntityKind,
  CadGeneratedReference,
  CadGeneratedReferenceEligibleOperation,
  CadNamedReferenceRepairRef,
  CadNamedReferenceRef,
  CadObjectSnapshot,
  CadObjectRef,
  CadOp,
  CadObjectModelSource,
  CadParameterRef,
  CadParameterSnapshot,
  CadPartSnapshot,
  CadPrimitiveFeatureSource,
  CadPrimitiveFeatureSummary,
  CadQueryError,
  CadQueryKind,
  CadQueryRequest,
  CadQueryResponse,
  CadRebuildPlanDiagnosticCode,
  CadReferenceHealthStatus,
  CadSelectionReferenceCandidate,
  CadSelectionReferenceCommandTarget,
  CadSelectionReferenceCandidateSource,
  CadSelectionReferenceInput,
  CadSelectionReferenceIssue,
  CadSelectionReferenceIssueCode,
  CadSelectionReferenceOperation,
  CadSelectionReferenceStatus,
  CadSketchEntityRef,
  CadSketchConstraintRef,
  CadSketchDimensionRef,
  CadSketchRef,
  CadTransactionStatus,
  CadTopologyAnchorCommandProof,
  CadTopologyAnchorEntityKind,
  CadTopologyIdentitySourceSnapshot,
  CadTopologyMatchResult,
  CadTopologyMatchSnapshotInput,
  ConeDimensions,
  CylinderDimensions,
  DocumentSemanticDiff,
  DocumentUnitUpdateMode,
  DocumentUnits,
  ObjectMeasurementsSnapshot,
  ProjectExtentsWarning,
  ProjectSummaryQueryResponse,
  ObjectId,
  PartId,
  SemanticDiff,
  SketchEntityId,
  SketchEntityKind,
  SketchEntitySnapshot,
  SketchId,
  SketchAttachmentSnapshot,
  SketchPlane,
  SketchPointTarget,
  SketchSemanticDiff,
  SketchSnapshot,
  SphereDimensions,
  TorusDimensions,
  BodyId,
  CadTransactionAuditMetadata,
  CadTopologyAnchorRef,
  CadTopologyAnchorRepairRef,
  CadTopologyAnchorSourceRecord,
  CadTopologyCheckpointRef,
  CadTopologyCheckpointSourceRecord,
  CadTopologyRepairSourceRecord,
  ExtrudeFeatureSnapshot,
  FeatureSnapshot,
  HoleFeatureSnapshot,
  FeatureExtrudeOperationMode,
  FeatureHoleDepthMode,
  FeatureHoleDirection,
  FeatureId,
  FeatureExtrudeProfileKind,
  FeatureExtrudeSide,
  FeatureRevolveAxis,
  FeatureRevolveOperationMode,
  FeatureRevolveProfileKind,
  FeatureSemanticDiff,
  NamedGeneratedReferenceEntry,
  NamedGeneratedReferenceSnapshot,
  NamedReferenceName,
  ParameterId,
  ParameterSemanticDiff,
  ReferenceSemanticDiff,
  TransactionId,
  SketchConstraintId,
  SketchConstraintKind,
  SketchConstraintSemanticDiff,
  SketchConstraintSnapshot,
  SketchCurveConstraintTarget,
  SketchDimensionId,
  SketchDimensionSnapshot,
  SketchDimensionTarget,
  SketchDimensionValueSource,
  SketchDimensionSemanticDiff,
  Transform,
  Vec2,
  Vec3
} from "@web-cad/cad-protocol";

import {
  CanonicalCborDecodeError,
  decodeCanonicalCbor,
  encodeCanonicalCbor
} from "./canonicalCbor";
import {
  createTransactionHistoryEntries,
  parseTransactionNumber,
  sortTransactions
} from "./transactionHistory";
import {
  createBodyGeneratedReferences,
  type GeneratedReferenceValidationError,
  resolveGeneratedReference,
  validateGeneratedReference
} from "./generatedReferences";
import { resolveTopologyAnchorGeneratedReferenceFromSourceRole } from "./topologyAnchorGeneratedReferenceResolution";
import { createBodyMeasurements } from "./bodyMeasurements";
import { createBodyTopology } from "./bodyTopology";
import { createBodyTopologyIdentity } from "./bodyTopologyIdentity";
import { createGeneratedReferenceMeasurements } from "./generatedReferenceMeasurements";
import { createTopologyAnchorCreationPlan } from "./topologyAnchorCreationPlan";
import { createTopologyAnchorRepairCandidatesResponse } from "./topologyAnchorRepairCandidates";
import { createTopologyAnchorRepairPlan } from "./topologyAnchorRepairPlan";
import { createFeatureEditabilityResponse } from "./featureEditability";
import {
  createProjectDependencyGraph,
  createReferenceHealth
} from "./projectDependencyGraph";
import {
  createTopologyAnchorCommandOperationsForSelection,
  createTopologyAnchorReferenceStatusForSelection
} from "./topologyReferenceHealth";
import { createProjectRebuildPlan } from "./projectRebuildPlan";
import { createProjectHealth } from "./projectHealth";
import {
  applySketchConstraintValue,
  applySketchDimensionValue,
  createSketchEvaluationQueryResponse,
  evaluateSketchDimension,
  getLineLength,
  getSketchDimensionTargetValue,
  isSupportedSketchDimensionTarget,
  sketchConstraintMatchesLine,
  type SketchSolverApplyIssue,
  type SketchSolverDocument
} from "./sketchSolver";
import { createSketchEditReadinessResponse } from "./sketchEditReadiness";
import { createSketchSolverStatusResponse } from "./sketchSolverStatus";
import {
  createSketchProfileHealthEntries,
  createSketchProfileLifecycleEffects
} from "./sketchProfileHealth";
import {
  createProjectExactExport,
  createProjectExportReadiness
} from "./projectExportReadiness";
import {
  createProjectPackageReadiness,
  createWcadPackageEntryMetadata,
  createWcadSourceIdentity,
  createWcadSourceIdentitySync,
  validateWcadManifest,
  validateWcadManifestSourceIdentity,
  validateWcadPackageCacheEntries,
  validateWcadPackageEntryBytes
} from "./projectPackageReadiness";
import { createProjectTopologyIdentityReadiness } from "./projectTopologyIdentityReadiness";
import { createTopologyMatchSnapshotsResponse } from "./topologyMatching";
import { createTopologyAnchorCommandReadinessResponse } from "./topologyAnchorCommandReadiness";
import { createTopologyCommandTargetReadinessResponse } from "./topologyCommandTargetReadiness";
import {
  collectWcadV2CheckpointSourceEntries,
  createEmptyTopologyIdentitySourceSnapshot,
  createWcadV2CheckpointEntryPaths,
  validateTopologyIdentitySourceSnapshot,
  validateWcadManifestV2Contract
} from "./topologyIdentitySourceContract";
import { SHA256_HEX_PATTERN } from "./sha256";
import { readZipStore, writeZipStore } from "./wcadZip";

export {
  createProjectPackageReadiness,
  createWcadPackageEntryMetadata,
  createWcadSourceIdentity,
  createWcadSourceIdentitySync,
  validateWcadManifest,
  validateWcadManifestSourceIdentity,
  validateWcadPackageCacheEntries,
  validateWcadPackageEntryBytes
} from "./projectPackageReadiness";
export { encodeCanonicalCbor as encodeWcadCanonicalCbor } from "./canonicalCbor";
export {
  WCAD_CHECKPOINT_BREP_EXTENSION,
  WCAD_CHECKPOINT_ENTRY_PREFIX,
  WCAD_CHECKPOINT_SIGNATURE_EXTENSION,
  WCAD_CHECKPOINT_TOPOLOGY_EXTENSION,
  collectWcadV2CheckpointSourceEntries,
  createEmptyTopologyIdentitySourceSnapshot,
  createWcadV2CheckpointEntryPaths,
  validateTopologyIdentitySourceSnapshot,
  validateWcadManifestV2Contract
} from "./topologyIdentitySourceContract";

export * from "./releaseSamples";

export type {
  CadActorMetadata,
  BoxDimensions,
  CadBatch,
  CadBatchResponse,
  CadBatchValidationError,
  CadBatchValidationResult,
  CadAxisAlignedBounds,
  CadAuthoredChamferHealth,
  CadBodyDerivedExactMetadataSnapshot,
  CadBodyDerivedExactMetadataStatus,
  CadBodyExactMetadataDiagnostic,
  CadBodyExactMetadataSnapshot,
  CadBodyExactMetadataStatus,
  CadBodyExactMetadataTopologyCounts,
  CadBodyLifecycleEffectSummary,
  CadBodyLifecycleRole,
  CadBodyLifecycleState,
  CadBodyLifecycleSummary,
  CadBodyRef,
  CadBodySnapshot,
  CadBodyTopologyIssue,
  CadBodyTopologyIssueCode,
  CadBodyTopologyMeasurementConfidence,
  CadBodyTopologyModel,
  CadBodyTopologySnapshot,
  CadBodyTopologySourceIdentity,
  CadBodyTopologySourceKind,
  CadBodyTopologyStatus,
  CadExportBodyReadiness,
  CadExportBodyFormatReadiness,
  CadExportBodySourceKind,
  CadExactExportArtifact,
  CadExactExportFormatId,
  CadExactExportSourceIdentityStatus,
  CadExactExportWriterStatus,
  CadExportKind,
  CadExportDiagnostic,
  CadExportDiagnosticCode,
  CadExportFormatId,
  CadExportFormatReadiness,
  CadExportReadinessStatus,
  CadAttachedSketchHealth,
  CadAuthoredExtrudeHealth,
  CadAuthoredFilletHealth,
  CadAuthoredHoleHealth,
  CadAuthoredRevolveHealth,
  CadDependencyHealthIssue,
  CadDependencyHealthIssueCode,
  CadDependencyHealthStatus,
  CadSketchDimensionHealth,
  CadFeatureEditAffectedSummary,
  CadFeatureEditDiagnostic,
  CadFeatureEditDiagnosticCode,
  CadFeatureEditDiagnosticSeverity,
  CadFeatureEditDryRunStatus,
  CadFeatureEditFieldDescriptor,
  CadFeatureEditFieldValueType,
  CadFeatureEditProposal,
  CadFeatureEditabilityStatus,
  CadFeatureRef,
  CadFeatureReferenceChangeCategory,
  CadFeatureReferenceChangeSummary,
  CadFeatureRebuildReadiness,
  CadFeatureRebuildReadinessStatus,
  CadFeatureSummary,
  CadRebuildAffectedSummary,
  CadRebuildPlanDiagnostic,
  CadRebuildPlanDiagnosticCode,
  CadRebuildPlanDiagnosticSeverity,
  CadRebuildPlanStatus,
  CadDependencyGraphEdge,
  CadDependencyGraphEdgeKind,
  CadDependencyGraphNode,
  CadDependencyGraphNodeId,
  CadDependencyGraphNodeKind,
  CadGeneratedBodyReference,
  CadGeneratedCurveType,
  CadGeneratedEdgeReference,
  CadGeneratedEntityKind,
  CadGeneratedExtrudeEdgeRole,
  CadGeneratedExtrudeFaceRole,
  CadGeneratedExtrudeVertexRole,
  CadGeneratedFaceReference,
  CadGeneratedReference,
  CadGeneratedReferenceEligibleOperation,
  CadGeneratedReferenceProfileSignature,
  CadGeneratedReferenceSignature,
  CadGeneratedVertexReference,
  CadNamedReferenceRepairRef,
  CadNamedReferenceRef,
  CadParameterRef,
  CadParameterSnapshot,
  CadObjectSnapshot,
  CadObjectRef,
  CadOperationSummary,
  CadOp,
  CadObjectModelSource,
  CadPartSnapshot,
  CadPrimitiveFeatureSource,
  CadPrimitiveFeatureSummary,
  CadProjectSummaryExportFormatSummary,
  CadProjectSummaryExportSummary,
  CadProjectSummaryHealthSummary,
  CadProjectSummaryNamedReferenceStatusCounts,
  CadProjectSummaryReferenceKindCounts,
  CadProjectSummaryReferenceOperationCounts,
  CadProjectSummaryReferenceStatusCounts,
  CadProjectSummaryReferenceSummary,
  CadProjectSummaryStructureCounts,
  CadProjectSummaryWorkflowHint,
  CadProjectSummaryWorkflowHintCode,
  CadProjectSummaryWorkflowHintLevel,
  ProjectDependencyGraphQueryResponse,
  ProjectExactExportQueryResponse,
  ProjectPackageReadinessQueryResponse,
  ProjectRebuildPlanQueryResponse,
  ReferenceHealthQueryResponse,
  CadQueryRequest,
  CadQueryError,
  CadQueryResponse,
  CadReferenceHealthDependencies,
  CadReferenceHealthDiagnostic,
  CadReferenceHealthDiagnosticCode,
  CadReferenceHealthDiagnosticSeverity,
  CadReferenceHealthEntry,
  CadReferenceHealthSource,
  CadReferenceHealthStatus,
  CadReferenceHealthTarget,
  CadSelectionReferenceCandidate,
  CadSelectionReferenceCommandTarget,
  CadSelectionReferenceCandidateSource,
  CadSelectionReferenceInput,
  CadSelectionReferenceIssue,
  CadSelectionReferenceIssueCode,
  CadSelectionReferenceOperation,
  CadSelectionReferenceStatus,
  CadSemanticDiffSummary,
  CadSketchDimensionRef,
  CadSketchConstraintRef,
  CadSketchEntityRef,
  CadSketchRef,
  CadTransactionHistoryEntry,
  CadTransactionStatus,
  CadTransactionAuditMetadata,
  WcadManifestV1,
  WcadPackageCacheEntryMetadata,
  WcadPackageValidationIssue,
  WcadSourceIdentity,
  NamedGeneratedReferenceEntry,
  CadNamedReferenceHealth,
  NamedGeneratedReferenceSnapshot,
  NamedReferenceName,
  ParameterId,
  ParameterSemanticDiff,
  ReferenceSemanticDiff,
  SketchDimensionEntry,
  SketchConstraintEntry,
  SketchConstraintId,
  SketchConstraintIssue,
  SketchConstraintKind,
  SketchConstraintSnapshot,
  SketchConstraintSemanticDiff,
  SketchDimensionId,
  SketchDimensionIssue,
  SketchDimensionSnapshot,
  SketchDimensionTarget,
  SketchDimensionValueSource,
  SketchDimensionSemanticDiff,
  ChamferFeatureSnapshot,
  ExtrudeFeatureSnapshot,
  FilletFeatureSnapshot,
  FeatureSnapshot,
  FeatureId,
  FeatureExtrudeOperationMode,
  FeatureExtrudeProfileKind,
  FeatureExtrudeSide,
  FeatureRevolveAxis,
  FeatureRevolveOperationMode,
  FeatureRevolveProfileKind,
  FeatureSemanticDiff,
  ConeDimensions,
  CylinderDimensions,
  DocumentSemanticDiff,
  DocumentUnitUpdateMode,
  DocumentUnits,
  ObjectMeasurementsSnapshot,
  ObjectId,
  PartId,
  SemanticDiff,
  HoleFeatureSnapshot,
  RevolveFeatureSnapshot,
  SketchEntityId,
  SketchEntityKind,
  SketchEntitySnapshot,
  SketchId,
  SketchAttachmentSnapshot,
  SketchGeneratedFaceAttachmentSnapshot,
  SketchPlane,
  SketchPointTarget,
  SketchSemanticDiff,
  SketchSnapshot,
  SphereDimensions,
  TorusDimensions,
  BodyId,
  TransactionId,
  Transform,
  Vec2,
  Vec3
} from "@web-cad/cad-protocol";

export type { BodyMeasurementsSnapshot } from "@web-cad/cad-protocol";

export interface PackageInfo {
  readonly name: string;
  readonly status: "ready";
}

export interface BoxObject {
  readonly id: ObjectId;
  readonly kind: "box";
  readonly name?: string;
  readonly dimensions: BoxDimensions;
  readonly transform: Transform;
}

export interface CylinderObject {
  readonly id: ObjectId;
  readonly kind: "cylinder";
  readonly name?: string;
  readonly dimensions: CylinderDimensions;
  readonly transform: Transform;
}

export interface SphereObject {
  readonly id: ObjectId;
  readonly kind: "sphere";
  readonly name?: string;
  readonly dimensions: SphereDimensions;
  readonly transform: Transform;
}

export interface ConeObject {
  readonly id: ObjectId;
  readonly kind: "cone";
  readonly name?: string;
  readonly dimensions: ConeDimensions;
  readonly transform: Transform;
}

export interface TorusObject {
  readonly id: ObjectId;
  readonly kind: "torus";
  readonly name?: string;
  readonly dimensions: TorusDimensions;
  readonly transform: Transform;
}

export type SceneObject =
  | BoxObject
  | CylinderObject
  | SphereObject
  | ConeObject
  | TorusObject;

export type SketchEntity = SketchEntitySnapshot;

export interface Sketch {
  readonly id: SketchId;
  readonly name: string;
  readonly plane: SketchPlane;
  readonly attachment?: SketchAttachmentSnapshot;
  readonly entities: ReadonlyMap<SketchEntityId, SketchEntity>;
}

export type CadParameter = CadParameterSnapshot;

export type SketchDimension = SketchDimensionSnapshot;

export type SketchConstraint = SketchConstraintSnapshot;

export type Feature =
  | ExtrudeFeature
  | RevolveFeature
  | HoleFeature
  | ChamferFeature
  | FilletFeature;

export interface ExtrudeFeature {
  readonly id: FeatureId;
  readonly kind: "extrude";
  readonly name?: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly profileKind: FeatureExtrudeProfileKind;
  readonly depth: number;
  readonly side: FeatureExtrudeSide;
  readonly operationMode: FeatureExtrudeOperationMode;
  readonly targetBodyId?: BodyId;
  readonly targetTopologyAnchorId?: string;
  readonly bodyId: BodyId;
}

export interface RevolveFeature {
  readonly id: FeatureId;
  readonly kind: "revolve";
  readonly name?: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly profileKind: FeatureRevolveProfileKind;
  readonly axis: FeatureRevolveAxis;
  readonly angleDegrees: number;
  readonly operationMode: FeatureRevolveOperationMode;
  readonly targetBodyId?: BodyId;
  readonly bodyId: BodyId;
}

export interface HoleFeature {
  readonly id: FeatureId;
  readonly kind: "hole";
  readonly name?: string;
  readonly targetBodyId: BodyId;
  readonly targetTopologyAnchorId?: string;
  readonly sketchId: SketchId;
  readonly circleEntityId: SketchEntityId;
  readonly depthMode: FeatureHoleDepthMode;
  readonly depth?: number;
  readonly direction: FeatureHoleDirection;
  readonly bodyId: BodyId;
}

export interface ChamferFeature {
  readonly id: FeatureId;
  readonly kind: "chamfer";
  readonly name?: string;
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
  readonly topologyAnchorId?: string;
  readonly distance: number;
  readonly bodyId: BodyId;
}

export interface FilletFeature {
  readonly id: FeatureId;
  readonly kind: "fillet";
  readonly name?: string;
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
  readonly topologyAnchorId?: string;
  readonly radius: number;
  readonly bodyId: BodyId;
}

export interface CadDocument {
  readonly objects: ReadonlyMap<ObjectId, SceneObject>;
  readonly sketches: ReadonlyMap<SketchId, Sketch>;
  readonly parameters: ReadonlyMap<ParameterId, CadParameter>;
  readonly sketchDimensions: ReadonlyMap<SketchDimensionId, SketchDimension>;
  readonly sketchConstraints: ReadonlyMap<SketchConstraintId, SketchConstraint>;
  readonly features: ReadonlyMap<FeatureId, Feature>;
  readonly namedReferences: ReadonlyMap<
    NamedReferenceName,
    NamedGeneratedReferenceSnapshot
  >;
  readonly topologyIdentity?: CadTopologyIdentitySourceSnapshot;
  readonly units: DocumentUnits;
}

export interface Transaction {
  readonly id: TransactionId;
  readonly ops: readonly CadOp[];
  readonly status: CadTransactionStatus;
  readonly diff: SemanticDiff;
  readonly actor?: CadActorMetadata;
  readonly audit?: CadTransactionAuditMetadata;
}

export interface ApplyResult {
  readonly transaction: Transaction;
  readonly document: CadDocument;
}

export interface CadEngineOptions {
  readonly nextObjectNumber?: number;
  readonly nextSketchNumber?: number;
  readonly nextSketchEntityNumber?: number;
  readonly nextParameterNumber?: number;
  readonly nextSketchDimensionNumber?: number;
  readonly nextSketchConstraintNumber?: number;
  readonly nextFeatureNumber?: number;
  readonly nextBodyNumber?: number;
}

export interface CadExecutionOptions {
  readonly actor?: CadActorMetadata;
  readonly audit?: CadTransactionAuditMetadata;
}

export interface CadDocumentSnapshot {
  readonly units: DocumentUnits;
  readonly objects: readonly SceneObject[];
  readonly sketches: readonly SketchSnapshot[];
  readonly parameters: readonly CadParameterSnapshot[];
  readonly sketchDimensions: readonly SketchDimensionSnapshot[];
  readonly sketchConstraints: readonly SketchConstraintSnapshot[];
  readonly features: readonly FeatureSnapshot[];
  readonly namedReferences: readonly NamedGeneratedReferenceSnapshot[];
  readonly topologyIdentity?: CadTopologyIdentitySourceSnapshot;
  readonly nextObjectNumber: number;
  readonly nextSketchNumber: number;
  readonly nextSketchEntityNumber: number;
  readonly nextParameterNumber: number;
  readonly nextSketchDimensionNumber: number;
  readonly nextSketchConstraintNumber: number;
  readonly nextFeatureNumber: number;
  readonly nextBodyNumber: number;
}

export interface CadWorkerRequest {
  readonly id: string;
  readonly batch: CadBatch;
  readonly document: CadDocumentSnapshot;
}

export interface CadWorkerResponse {
  readonly id: string;
  readonly response: CadBatchResponse;
}

export interface CadCommandWorker {
  execute(request: CadWorkerRequest): Promise<CadWorkerResponse>;
}

export interface SnapshotCadCommandWorkerOptions {
  readonly delayMs?: number;
}

export type MockCadCommandWorkerOptions = SnapshotCadCommandWorkerOptions;

export const CAD_PROJECT_FORMAT_VERSION_V1 = "web-cad.project.v1";
export const CAD_PROJECT_FORMAT_VERSION_V2 = "web-cad.project.v2";
export const CAD_PROJECT_FORMAT_VERSION_V3 = "web-cad.project.v3";
export const CAD_PROJECT_FORMAT_VERSION_V4 = "web-cad.project.v4";
export const CAD_PROJECT_FORMAT_VERSION_V5 = "web-cad.project.v5";
export const CAD_PROJECT_FORMAT_VERSION_V6 = "web-cad.project.v6";
export const CAD_PROJECT_FORMAT_VERSION_V7 = "web-cad.project.v7";
export const CAD_PROJECT_FORMAT_VERSION_V8 = "web-cad.project.v8";
export const CAD_PROJECT_FORMAT_VERSION_V9 = "web-cad.project.v9";
export const CAD_PROJECT_FORMAT_VERSION_V10 = "web-cad.project.v10";
export const CAD_PROJECT_FORMAT_VERSION_V11 = "web-cad.project.v11";
export const CAD_PROJECT_FORMAT_VERSION_V12 = "web-cad.project.v12";
export const CAD_PROJECT_FORMAT_VERSION_V13 = "web-cad.project.v13";
export const CAD_PROJECT_FORMAT_VERSION_V14 = "web-cad.project.v14";
export const CAD_PROJECT_FORMAT_VERSION_V15 = "web-cad.project.v15";
export const CAD_PROJECT_FORMAT_VERSION_V16 = "web-cad.project.v16";
export const CAD_PROJECT_FORMAT_VERSION_V17 = "web-cad.project.v17";
export const CAD_PROJECT_FORMAT_VERSION_V18 = "web-cad.project.v18";
export const CURRENT_CAD_PROJECT_FORMAT_VERSION =
  CAD_PROJECT_FORMAT_VERSION_V16;

export type CadProjectFormatVersion =
  | typeof CAD_PROJECT_FORMAT_VERSION_V1
  | typeof CAD_PROJECT_FORMAT_VERSION_V2
  | typeof CAD_PROJECT_FORMAT_VERSION_V3
  | typeof CAD_PROJECT_FORMAT_VERSION_V4
  | typeof CAD_PROJECT_FORMAT_VERSION_V5
  | typeof CAD_PROJECT_FORMAT_VERSION_V6
  | typeof CAD_PROJECT_FORMAT_VERSION_V7
  | typeof CAD_PROJECT_FORMAT_VERSION_V8
  | typeof CAD_PROJECT_FORMAT_VERSION_V9
  | typeof CAD_PROJECT_FORMAT_VERSION_V10
  | typeof CAD_PROJECT_FORMAT_VERSION_V11
  | typeof CAD_PROJECT_FORMAT_VERSION_V12
  | typeof CAD_PROJECT_FORMAT_VERSION_V13
  | typeof CAD_PROJECT_FORMAT_VERSION_V14
  | typeof CAD_PROJECT_FORMAT_VERSION_V15
  | typeof CAD_PROJECT_FORMAT_VERSION_V16
  | typeof CAD_PROJECT_FORMAT_VERSION_V17
  | typeof CAD_PROJECT_FORMAT_VERSION_V18
  | typeof CURRENT_CAD_PROJECT_FORMAT_VERSION;

const SUPPORTED_CAD_PROJECT_FORMAT_VERSIONS = new Set<string>([
  CAD_PROJECT_FORMAT_VERSION_V1,
  CAD_PROJECT_FORMAT_VERSION_V2,
  CAD_PROJECT_FORMAT_VERSION_V3,
  CAD_PROJECT_FORMAT_VERSION_V4,
  CAD_PROJECT_FORMAT_VERSION_V5,
  CAD_PROJECT_FORMAT_VERSION_V6,
  CAD_PROJECT_FORMAT_VERSION_V7,
  CAD_PROJECT_FORMAT_VERSION_V8,
  CAD_PROJECT_FORMAT_VERSION_V9,
  CAD_PROJECT_FORMAT_VERSION_V10,
  CAD_PROJECT_FORMAT_VERSION_V11,
  CAD_PROJECT_FORMAT_VERSION_V12,
  CAD_PROJECT_FORMAT_VERSION_V13,
  CAD_PROJECT_FORMAT_VERSION_V14,
  CAD_PROJECT_FORMAT_VERSION_V15,
  CAD_PROJECT_FORMAT_VERSION_V16,
  CAD_PROJECT_FORMAT_VERSION_V17,
  CAD_PROJECT_FORMAT_VERSION_V18
]);

function getCadProjectFormatVersionForDocument(
  document: CadDocument | CadDocumentSnapshot
):
  | typeof CAD_PROJECT_FORMAT_VERSION_V16
  | typeof CAD_PROJECT_FORMAT_VERSION_V17
  | typeof CAD_PROJECT_FORMAT_VERSION_V18 {
  if (document.topologyIdentity !== undefined) {
    return CAD_PROJECT_FORMAT_VERSION_V18;
  }

  const sketchConstraints: readonly SketchConstraintSnapshot[] = Array.isArray(
    document.sketchConstraints
  )
    ? document.sketchConstraints
    : [...document.sketchConstraints.values()];

  return sketchConstraints.some((constraint) =>
    isAdvancedSketchConstraintKind(constraint.kind)
  )
    ? CAD_PROJECT_FORMAT_VERSION_V17
    : CAD_PROJECT_FORMAT_VERSION_V16;
}

function isSupportedWcadDocumentSchema(
  schemaVersion: unknown
): schemaVersion is
  | typeof CAD_PROJECT_FORMAT_VERSION_V16
  | typeof CAD_PROJECT_FORMAT_VERSION_V17 {
  return (
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V16 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V17
  );
}

export type CadProjectImportErrorCode =
  | "INVALID_JSON"
  | "INVALID_PROJECT"
  | "UNSUPPORTED_PROJECT_VERSION"
  | "INVALID_DOCUMENT"
  | "INVALID_UNITS"
  | "INVALID_OBJECT"
  | "INVALID_OBJECT_NAME"
  | "INVALID_SKETCH"
  | "INVALID_SKETCH_NAME"
  | "INVALID_SKETCH_ENTITY"
  | "INVALID_PARAMETER"
  | "INVALID_SKETCH_DIMENSION"
  | "INVALID_SKETCH_CONSTRAINT"
  | "INVALID_FEATURE"
  | "INVALID_NAMED_REFERENCE"
  | "INVALID_DIMENSIONS"
  | "INVALID_TRANSFORM"
  | "INVALID_TRANSACTION"
  | "INVALID_TRANSACTION_HISTORY";

export interface CadProjectImportIssue {
  readonly code: CadProjectImportErrorCode;
  readonly path: string;
  readonly message: string;
}

export class CadProjectImportError extends Error {
  readonly issues: readonly CadProjectImportIssue[];

  constructor(issues: readonly CadProjectImportIssue[]) {
    super(formatCadProjectImportIssues(issues));
    this.name = "CadProjectImportError";
    this.issues = issues;
  }
}

export interface CadProject {
  readonly schemaVersion: CadProjectFormatVersion;
  readonly document: CadDocumentSnapshot;
  readonly history: readonly Transaction[];
  readonly redoStack: readonly Transaction[];
}

export interface WcadTopologyCheckpointPayloadInput {
  readonly checkpointId: string;
  readonly bodyId: BodyId;
  readonly sourceFeatureId?: FeatureId;
  readonly units?: DocumentUnits;
  readonly kernel: WcadTopologyCheckpointKernelMetadata;
  readonly tolerance: WcadTopologyCheckpointToleranceMetadata;
  readonly brepBytes: Uint8Array;
  readonly topologyBytes: Uint8Array;
  readonly signatureBytes: Uint8Array;
}

export interface WcadTopologyCheckpointPayload {
  readonly checkpointId: string;
  readonly bodyId: BodyId;
  readonly sourceFeatureId?: FeatureId;
  readonly manifestEntry: WcadTopologyCheckpointManifestEntry;
  readonly brepBytes: Uint8Array;
  readonly topologyBytes: Uint8Array;
  readonly signatureBytes: Uint8Array;
}

export interface ExportCadProjectWcadOptions {
  readonly createdAt?: string;
  readonly modifiedAt?: string;
  readonly appVersion?: string;
  readonly topologyCheckpoints?: readonly WcadTopologyCheckpointPayloadInput[];
  readonly topologyJsonFallback?: WcadManifestV2["topologyIdentity"]["jsonFallback"];
}

export interface WcadPackageExportResult {
  readonly bytes: Uint8Array;
  readonly manifest: WcadManifestV1 | WcadManifestV2;
  readonly sourceIdentity: WcadSourceIdentity;
  readonly documentBytes: Uint8Array;
  readonly commandsBytes: Uint8Array;
  readonly checkpointPayloads?: readonly WcadTopologyCheckpointPayload[];
}

export type WcadPackageReadResult =
  | {
      readonly ok: true;
      readonly project: CadProject;
      readonly manifest: WcadManifestV1 | WcadManifestV2;
      readonly sourceIdentity: WcadSourceIdentity;
      readonly checkpointPayloads?: readonly WcadTopologyCheckpointPayload[];
      readonly diagnostics: readonly WcadPackageValidationIssue[];
    }
  | {
      readonly ok: false;
      readonly issues: readonly WcadPackageValidationIssue[];
    };

export class WcadPackageImportError extends Error {
  readonly issues: readonly WcadPackageValidationIssue[];

  constructor(issues: readonly WcadPackageValidationIssue[]) {
    super(formatWcadPackageImportIssues(issues));
    this.name = "WcadPackageImportError";
    this.issues = issues;
  }
}

interface TransactionEntry {
  transaction: Transaction;
  before: CadDocument;
  after: CadDocument;
}

interface OperationRunResult {
  readonly document: CadDocument;
  readonly diff: SemanticDiff;
  readonly nextObjectNumber: number;
  readonly nextSketchNumber: number;
  readonly nextSketchEntityNumber: number;
  readonly nextParameterNumber: number;
  readonly nextSketchDimensionNumber: number;
  readonly nextSketchConstraintNumber: number;
  readonly nextFeatureNumber: number;
  readonly nextBodyNumber: number;
}

export const corePackage: PackageInfo = {
  name: "@web-cad/cad-core",
  status: "ready"
};

export const DEFAULT_DOCUMENT_UNITS: DocumentUnits = "mm";
export const DEFAULT_PART_ID: PartId = "part:default";
export const DEFAULT_PART_NAME = "Default Part";

export function createDefaultTransform(): Transform {
  return {
    translation: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1]
  };
}

export function createCadDocument(
  objects: Iterable<readonly [ObjectId, SceneObject]> = [],
  units: DocumentUnits = DEFAULT_DOCUMENT_UNITS,
  sketches: Iterable<readonly [SketchId, Sketch]> = [],
  parameters: Iterable<readonly [ParameterId, CadParameter]> = [],
  sketchDimensions: Iterable<
    readonly [SketchDimensionId, SketchDimension]
  > = [],
  sketchConstraints: Iterable<
    readonly [SketchConstraintId, SketchConstraint]
  > = [],
  features: Iterable<readonly [FeatureId, Feature]> = [],
  namedReferences: Iterable<
    readonly [NamedReferenceName, NamedGeneratedReferenceSnapshot]
  > = [],
  topologyIdentity?: CadTopologyIdentitySourceSnapshot
): CadDocument {
  return {
    objects: new Map(objects),
    sketches: new Map(sketches),
    parameters: new Map(parameters),
    sketchDimensions: new Map(sketchDimensions),
    sketchConstraints: new Map(sketchConstraints),
    features: new Map(features),
    namedReferences: new Map(namedReferences),
    ...(topologyIdentity
      ? {
          topologyIdentity:
            cloneTopologyIdentitySourceSnapshot(topologyIdentity)
        }
      : {}),
    units
  };
}

export class CadEngine {
  #document: CadDocument;
  #history: TransactionEntry[] = [];
  #redoStack: TransactionEntry[] = [];
  #nextObjectNumber = 1;
  #nextSketchNumber = 1;
  #nextSketchEntityNumber = 1;
  #nextParameterNumber = 1;
  #nextSketchDimensionNumber = 1;
  #nextSketchConstraintNumber = 1;
  #nextFeatureNumber = 1;
  #nextBodyNumber = 1;
  #nextTransactionNumber = 1;

  constructor(
    document: CadDocument = createCadDocument(),
    options: CadEngineOptions = {}
  ) {
    this.#document = cloneDocument(document);
    this.#nextObjectNumber =
      options.nextObjectNumber ?? inferNextObjectNumber(document);
    this.#nextSketchNumber =
      options.nextSketchNumber ?? inferNextSketchNumber(document);
    this.#nextSketchEntityNumber =
      options.nextSketchEntityNumber ?? inferNextSketchEntityNumber(document);
    this.#nextParameterNumber =
      options.nextParameterNumber ?? inferNextParameterNumber(document);
    this.#nextSketchDimensionNumber =
      options.nextSketchDimensionNumber ??
      inferNextSketchDimensionNumber(document);
    this.#nextSketchConstraintNumber =
      options.nextSketchConstraintNumber ??
      inferNextSketchConstraintNumber(document);
    this.#nextFeatureNumber =
      options.nextFeatureNumber ?? inferNextFeatureNumber(document);
    this.#nextBodyNumber =
      options.nextBodyNumber ?? inferNextBodyNumber(document);
  }

  getDocument(): CadDocument {
    return cloneDocument(this.#document);
  }

  getTransactions(): readonly Transaction[] {
    return this.#history.map((entry) => entry.transaction);
  }

  getRedoStack(): readonly Transaction[] {
    return this.#redoStack.map((entry) => entry.transaction);
  }

  exportProject(): CadProject {
    return exportCadProject(this);
  }

  loadProject(project: CadProject): void {
    const normalizedProject = normalizeCadProject(project);
    const state = createProjectState(project);

    this.#document = state.document;
    this.#history = state.history;
    this.#redoStack = state.redoStack;
    this.#nextObjectNumber = normalizedProject.document.nextObjectNumber;
    this.#nextSketchNumber = normalizedProject.document.nextSketchNumber;
    this.#nextSketchEntityNumber =
      normalizedProject.document.nextSketchEntityNumber;
    this.#nextParameterNumber = normalizedProject.document.nextParameterNumber;
    this.#nextSketchDimensionNumber =
      normalizedProject.document.nextSketchDimensionNumber;
    this.#nextSketchConstraintNumber =
      normalizedProject.document.nextSketchConstraintNumber;
    this.#nextFeatureNumber = normalizedProject.document.nextFeatureNumber;
    this.#nextBodyNumber = normalizedProject.document.nextBodyNumber;
    this.#nextTransactionNumber = inferNextTransactionNumber([
      ...normalizedProject.history,
      ...normalizedProject.redoStack
    ]);
  }

  static fromProject(project: CadProject): CadEngine {
    const engine = new CadEngine();
    engine.loadProject(project);
    return engine;
  }

  createSnapshot(): CadDocumentSnapshot {
    return createCadDocumentSnapshot(
      this.#document,
      this.#nextObjectNumber,
      this.#nextSketchNumber,
      this.#nextSketchEntityNumber,
      this.#nextParameterNumber,
      this.#nextSketchDimensionNumber,
      this.#nextSketchConstraintNumber,
      this.#nextFeatureNumber,
      this.#nextBodyNumber
    );
  }

  apply(op: CadOp, options: CadExecutionOptions = {}): ApplyResult {
    return this.applyBatch([op], options);
  }

  applyBatch(
    ops: readonly CadOp[],
    options: CadExecutionOptions = {}
  ): ApplyResult {
    const actor = normalizeActorMetadata(options.actor);
    const audit = normalizeAuditMetadata(options.audit, "commit", ops.length);
    const before = cloneDocument(this.#document);
    const run = this.#runOperations(ops);

    const transaction: Transaction = {
      id: this.#createTransactionId(),
      ops: [...ops],
      status: "committed",
      diff: run.diff,
      ...(actor ? { actor } : {}),
      ...(audit ? { audit } : {})
    };

    const entry: TransactionEntry = {
      transaction,
      before,
      after: cloneDocument(run.document)
    };

    this.#document = run.document;
    this.#nextObjectNumber = run.nextObjectNumber;
    this.#nextSketchNumber = run.nextSketchNumber;
    this.#nextSketchEntityNumber = run.nextSketchEntityNumber;
    this.#nextParameterNumber = run.nextParameterNumber;
    this.#nextSketchDimensionNumber = run.nextSketchDimensionNumber;
    this.#nextSketchConstraintNumber = run.nextSketchConstraintNumber;
    this.#nextFeatureNumber = run.nextFeatureNumber;
    this.#nextBodyNumber = run.nextBodyNumber;
    this.#history.push(entry);
    this.#redoStack = [];

    return {
      transaction,
      document: cloneDocument(this.#document)
    };
  }

  executeBatch(batch: CadBatch): CadBatchResponse {
    const validation = this.validateBatch(batch);

    if (!validation.ok) {
      return {
        ok: false,
        mode: getBatchResponseMode(batch),
        error: validation.errors[0],
        errors: validation.errors,
        createdIds: [],
        modifiedIds: [],
        deletedIds: [],
        warnings: validation.warnings
      };
    }

    const run = this.#runOperations(batch.ops);
    const diffIds = toDiffIds(run.diff);
    const audit = normalizeAuditMetadata(
      batch.audit,
      batch.mode,
      batch.ops.length
    );

    if (batch.mode === "dryRun") {
      return {
        ok: true,
        mode: batch.mode,
        ...diffIds,
        warnings: validation.warnings,
        ...(audit ? { audit } : {})
      };
    }

    const actor = normalizeActorMetadata(batch.actor);
    const result = this.applyBatch(batch.ops, { actor, audit });

    return {
      ok: true,
      mode: batch.mode,
      ...diffIds,
      warnings: validation.warnings,
      transactionId: result.transaction.id,
      ...(result.transaction.actor ? { actor: result.transaction.actor } : {}),
      ...(result.transaction.audit ? { audit: result.transaction.audit } : {})
    };
  }

  executeQuery(request: CadQueryRequest): CadQueryResponse {
    const requestError = validateQueryRequestEnvelope(request);

    if (requestError) {
      return requestError;
    }

    switch (request.query.query) {
      case "parameter.list": {
        const parameters = [...this.#document.parameters.values()].map(
          cloneParameterSnapshot
        );

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          parameterCount: parameters.length,
          parameters
        };
      }

      case "parameter.get": {
        const parameter = this.#document.parameters.get(request.query.id);

        if (!parameter) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: {
              code: "PARAMETER_NOT_FOUND",
              message: `Parameter does not exist: ${request.query.id}`,
              parameterId: request.query.id
            }
          };
        }

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          parameter: cloneParameterSnapshot(parameter)
        };
      }

      case "feature.editability": {
        const structure = createProjectStructure(
          this.#document,
          this.#history.map((entry) => entry.transaction)
        );
        const sketchProfileHealth = createSketchProfileHealthEntries({
          document: this.#document,
          features: structure.features
        });

        return createFeatureEditabilityResponse({
          cadOpsVersion: request.version,
          featureId: request.query.featureId,
          proposedEdit: request.query.proposedEdit,
          units: this.#document.units,
          document: this.#document,
          features: structure.features,
          bodies: structure.bodies,
          namedReferences: [...this.#document.namedReferences.values()],
          sketchProfileHealth,
          topologyMatchResults: request.query.topologyMatchResults
        });
      }

      case "project.summary": {
        return createProjectSummary(
          this.#document,
          this.#history.map((entry) => entry.transaction),
          request.version
        );
      }

      case "project.features": {
        const structure = createProjectStructure(
          this.#document,
          this.#history.map((entry) => entry.transaction)
        );

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          featureCount: structure.features.length,
          features: structure.features
        };
      }

      case "project.structure": {
        const structure = createProjectStructure(
          this.#document,
          this.#history.map((entry) => entry.transaction)
        );

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          partCount: structure.parts.length,
          featureCount: structure.features.length,
          bodyCount: structure.bodies.length,
          parts: structure.parts,
          features: structure.features,
          bodies: structure.bodies,
          objectSources: structure.objectSources
        };
      }

      case "project.health": {
        const structure = createProjectStructure(
          this.#document,
          this.#history.map((entry) => entry.transaction)
        );

        return createProjectHealth({
          document: this.#document,
          cadOpsVersion: request.version,
          ownerPartId: DEFAULT_PART_ID,
          units: this.#document.units,
          derivedExactMetadata: request.query.derivedExactMetadata ?? [],
          bodyExists: (bodyId) =>
            structure.bodies.some((body) => body.id === bodyId)
        });
      }

      case "project.dependencyGraph": {
        const structure = createProjectStructure(
          this.#document,
          this.#history.map((entry) => entry.transaction)
        );
        const sketchProfileHealth = createSketchProfileHealthEntries({
          document: this.#document,
          features: structure.features
        });

        return createProjectDependencyGraph({
          cadOpsVersion: request.version,
          ownerPartId: DEFAULT_PART_ID,
          document: this.#document,
          features: structure.features,
          bodies: structure.bodies,
          namedReferences: [...this.#document.namedReferences.values()],
          sketchProfileHealth,
          topologyMatchResults: request.query.topologyMatchResults
        });
      }

      case "project.rebuildPlan": {
        const structure = createProjectStructure(
          this.#document,
          this.#history.map((entry) => entry.transaction)
        );
        const sketchProfileHealth = createSketchProfileHealthEntries({
          document: this.#document,
          features: structure.features
        });
        const referenceHealth = createReferenceHealth({
          cadOpsVersion: request.version,
          ownerPartId: DEFAULT_PART_ID,
          document: this.#document,
          features: structure.features,
          bodies: structure.bodies,
          namedReferences: [...this.#document.namedReferences.values()],
          sketchProfileHealth,
          target: { type: "all" },
          topologyMatchResults: request.query.topologyMatchResults
        });
        return createProjectRebuildPlan({
          cadOpsVersion: request.version,
          features: structure.features,
          bodies: structure.bodies,
          referenceHealth: referenceHealth.referenceHealth,
          lifecycleEffects: [
            ...createCurrentLifecycleEffects(
              this.#history.map((entry) => entry.transaction)
            ),
            ...createSketchProfileLifecycleEffects(sketchProfileHealth)
          ]
        });
      }

      case "project.topologyIdentityReadiness": {
        const structure = createProjectStructure(
          this.#document,
          this.#history.map((entry) => entry.transaction)
        );

        return createProjectTopologyIdentityReadiness({
          cadOpsVersion: request.version,
          documentSchemaVersion: getCadProjectFormatVersionForDocument(
            this.#document
          ),
          features: structure.features,
          bodies: structure.bodies,
          namedReferences: [...this.#document.namedReferences.values()],
          topologyIdentity: this.#document.topologyIdentity
        });
      }

      case "topology.matchSnapshots": {
        return createTopologyMatchSnapshotsResponse({
          cadOpsVersion: request.version,
          query: request.query
        });
      }

      case "topology.anchorRepairCandidates": {
        return createTopologyAnchorRepairCandidatesResponse({
          cadOpsVersion: request.version,
          query: request.query,
          topologyIdentity: this.#document.topologyIdentity
        });
      }

      case "topology.anchorCommandReadiness": {
        const structure = createProjectStructure(
          this.#document,
          this.#history.map((entry) => entry.transaction)
        );
        const selectionResult = createSelectionReferenceCandidates(
          this.#document,
          structure,
          this.#history.map((entry) => entry.transaction),
          { type: "topologyAnchor", anchorId: request.query.anchorId },
          request.query.requiredOperation
        );

        return createTopologyAnchorCommandReadinessResponse({
          cadOpsVersion: request.version,
          query: request.query,
          topologyIdentity: this.#document.topologyIdentity,
          resolveProofCommandOperations: (proof, context) =>
            createTopologyAnchorProofCommandOperations(
              this.#document,
              proof,
              context.bodyId
            ),
          selectionResult
        });
      }

      case "topology.commandTargetReadiness": {
        const structure = createProjectStructure(
          this.#document,
          this.#history.map((entry) => entry.transaction)
        );
        const selectionResult = createSelectionReferenceCandidates(
          this.#document,
          structure,
          this.#history.map((entry) => entry.transaction),
          request.query.target,
          request.query.desiredOperation,
          request.query.topologyMatchResults
        );
        const anchorReadiness =
          request.query.target.type === "topologyAnchor" &&
          request.query.snapshot
            ? createTopologyAnchorCommandReadinessResponse({
                cadOpsVersion: request.version,
                query: {
                  query: "topology.anchorCommandReadiness",
                  anchorId: request.query.target.anchorId,
                  snapshot: request.query.snapshot,
                  ...(request.query.desiredOperation
                    ? { requiredOperation: request.query.desiredOperation }
                    : {})
                },
                topologyIdentity: this.#document.topologyIdentity,
                resolveProofCommandOperations: (proof, context) =>
                  createTopologyAnchorProofCommandOperations(
                    this.#document,
                    proof,
                    context.bodyId
                  ),
                selectionResult
              })
            : undefined;

        return createTopologyCommandTargetReadinessResponse({
          cadOpsVersion: request.version,
          query: request.query,
          selectionResult,
          ...(anchorReadiness ? { anchorReadiness } : {})
        });
      }

      case "project.exportReadiness": {
        const structure = createProjectStructure(
          this.#document,
          this.#history.map((entry) => entry.transaction)
        );

        return createProjectExportReadiness({
          document: this.#document,
          cadOpsVersion: request.version,
          bodies: structure.bodies
        });
      }

      case "project.exportExact": {
        const structure = createProjectStructure(
          this.#document,
          this.#history.map((entry) => entry.transaction)
        );
        const documentSchemaVersion = getCadProjectFormatVersionForDocument(
          this.#document
        );

        return createProjectExactExport({
          document: this.#document,
          cadOpsVersion: request.version,
          bodies: structure.bodies,
          query: request.query,
          documentSchemaVersion,
          currentSourceIdentity: createCadProjectSourceIdentity(
            exportCadProject(this)
          )
        });
      }

      case "project.packageReadiness": {
        return createProjectPackageReadiness({
          cadOpsVersion: request.version,
          documentSchemaVersion: getCadProjectFormatVersionForDocument(
            this.#document
          ),
          units: this.#document.units
        });
      }

      case "project.sketches": {
        const sketches = [...this.#document.sketches.values()].map(
          createSketchSnapshot
        );

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          sketchCount: sketches.length,
          sketches
        };
      }

      case "object.get": {
        const object = this.#document.objects.get(request.query.id);

        if (!object) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: {
              code: "OBJECT_NOT_FOUND",
              message: `Object does not exist: ${request.query.id}`,
              objectId: request.query.id
            }
          };
        }

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          object: createCadObjectSnapshot(object)
        };
      }

      case "object.measurements": {
        const object = this.#document.objects.get(request.query.id);

        if (!object) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: {
              code: "OBJECT_NOT_FOUND",
              message: `Object does not exist: ${request.query.id}`,
              objectId: request.query.id
            }
          };
        }

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          measurements: createObjectMeasurements(object, this.#document.units)
        };
      }

      case "project.extents": {
        const measurements = [...this.#document.objects.values()].map(
          (object) => createObjectMeasurements(object, this.#document.units)
        );
        const bodyExtents = createBodyExtents(
          this.#document,
          this.#document.units,
          this.#history.map((entry) => entry.transaction),
          request.query.derivedExactMetadata ?? []
        );
        const allBounds = [
          ...measurements.map((measurement) => measurement.worldBounds),
          ...bodyExtents.bodies.map((body) => body.worldBounds)
        ];

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          units: this.#document.units,
          objectCount: measurements.length,
          bodyCount: bodyExtents.bodies.length,
          ...(allBounds.length > 0
            ? {
                bounds: mergeBounds(allBounds)
              }
            : {}),
          approximateVolume:
            sumApproximateVolumes(measurements) +
            sumBodyExtentVolumes(bodyExtents.bodies),
          objects: measurements.map((measurement) => ({
            id: measurement.id,
            kind: measurement.kind,
            name: measurement.name,
            worldBounds: measurement.worldBounds,
            approximateVolume: measurement.approximateVolume
          })),
          bodies: bodyExtents.bodies,
          warnings: bodyExtents.warnings
        };
      }

      case "sketch.get": {
        const sketch = this.#document.sketches.get(request.query.id);

        if (!sketch) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: {
              code: "SKETCH_NOT_FOUND",
              message: `Sketch does not exist: ${request.query.id}`,
              sketchId: request.query.id
            }
          };
        }

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          sketch: createSketchSnapshot(sketch)
        };
      }

      case "sketch.editReadiness": {
        const structure = createProjectStructure(
          this.#document,
          this.#history.map((entry) => entry.transaction)
        );
        const sketchProfileHealth = createSketchProfileHealthEntries({
          document: this.#document,
          features: structure.features
        });
        const referenceHealth = createReferenceHealth({
          cadOpsVersion: request.version,
          ownerPartId: DEFAULT_PART_ID,
          document: this.#document,
          features: structure.features,
          bodies: structure.bodies,
          namedReferences: [...this.#document.namedReferences.values()],
          sketchProfileHealth,
          target: { type: "all" }
        });
        const rebuildPlan = createProjectRebuildPlan({
          cadOpsVersion: request.version,
          features: structure.features,
          bodies: structure.bodies,
          referenceHealth: referenceHealth.referenceHealth,
          lifecycleEffects: [
            ...createCurrentLifecycleEffects(
              this.#history.map((entry) => entry.transaction)
            ),
            ...createSketchProfileLifecycleEffects(sketchProfileHealth)
          ]
        });

        return createSketchEditReadinessResponse({
          cadOpsVersion: request.version,
          edit: request.query.edit,
          document: this.#document,
          features: structure.features,
          bodies: structure.bodies,
          referenceHealth: referenceHealth.referenceHealth,
          bodyLifecycles: rebuildPlan.bodyLifecycles
        });
      }

      case "sketch.solverStatus": {
        const sketch = this.#document.sketches.get(request.query.sketchId);

        if (!sketch) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: {
              code: "SKETCH_NOT_FOUND",
              message: `Sketch does not exist: ${request.query.sketchId}`,
              sketchId: request.query.sketchId
            }
          };
        }

        return createSketchSolverStatusResponse({
          cadOpsVersion: request.version,
          document: this.#document,
          sketch,
          currentProjectSchemaVersion: getCadProjectFormatVersionForDocument(
            this.#document
          )
        });
      }

      case "sketch.dimensions": {
        const sketch = this.#document.sketches.get(request.query.sketchId);

        if (!sketch) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: {
              code: "SKETCH_NOT_FOUND",
              message: `Sketch does not exist: ${request.query.sketchId}`,
              sketchId: request.query.sketchId
            }
          };
        }

        const dimensions = [...this.#document.sketchDimensions.values()]
          .filter((dimension) => dimension.sketchId === sketch.id)
          .map((dimension) =>
            evaluateSketchDimension(this.#document, dimension)
          );

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          sketchId: sketch.id,
          dimensionCount: dimensions.length,
          dimensions
        };
      }

      case "sketch.evaluation": {
        const sketch = this.#document.sketches.get(request.query.sketchId);

        if (!sketch) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: {
              code: "SKETCH_NOT_FOUND",
              message: `Sketch does not exist: ${request.query.sketchId}`,
              sketchId: request.query.sketchId
            }
          };
        }

        return createSketchEvaluationQueryResponse(
          this.#document,
          sketch,
          request.version
        );
      }

      case "sketch.dimension.get": {
        const dimension = this.#document.sketchDimensions.get(request.query.id);

        if (!dimension) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: {
              code: "SKETCH_DIMENSION_NOT_FOUND",
              message: `Sketch dimension does not exist: ${request.query.id}`,
              sketchDimensionId: request.query.id
            }
          };
        }

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          dimension: evaluateSketchDimension(this.#document, dimension)
        };
      }

      case "body.topology": {
        const { bodyId } = request.query;
        const structure = createProjectStructure(
          this.#document,
          this.#history.map((entry) => entry.transaction)
        );
        const topology = createBodyTopology({
          document: this.#document,
          bodyId,
          units: this.#document.units,
          ownerPartId: DEFAULT_PART_ID,
          derivedExactMetadata: request.query.derivedExactMetadata,
          bodyExists: (candidateBodyId) =>
            structure.bodies.some((body) => body.id === candidateBodyId)
        });

        if (!topology.ok) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: topology.error
          };
        }

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          topology: topology.topology
        };
      }

      case "body.topologyIdentity": {
        const { bodyId } = request.query;
        const structure = createProjectStructure(
          this.#document,
          this.#history.map((entry) => entry.transaction)
        );
        const topologyIdentity = createBodyTopologyIdentity({
          cadOpsVersion: request.version,
          document: this.#document,
          bodyId,
          units: this.#document.units,
          ownerPartId: DEFAULT_PART_ID,
          checkpointId: request.query.checkpointId,
          derivedExactMetadata: request.query.derivedExactMetadata,
          bodyExists: (candidateBodyId) =>
            structure.bodies.some((body) => body.id === candidateBodyId)
        });

        if (!topologyIdentity.ok) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: topologyIdentity.error
          };
        }

        return topologyIdentity.response;
      }

      case "topology.anchorCreationPlan": {
        const { bodyId, stableId } = request.query;
        const structure = createProjectStructure(
          this.#document,
          this.#history.map((entry) => entry.transaction)
        );
        const plan = createTopologyAnchorCreationPlan({
          cadOpsVersion: request.version,
          document: this.#document,
          bodyId,
          stableId,
          units: this.#document.units,
          ownerPartId: DEFAULT_PART_ID,
          checkpointId: request.query.checkpointId,
          anchorId: request.query.anchorId,
          derivedExactMetadata: request.query.derivedExactMetadata,
          bodyExists: (candidateBodyId) =>
            structure.bodies.some((body) => body.id === candidateBodyId)
        });

        if (!plan.ok) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: plan.error
          };
        }

        return plan.response;
      }

      case "topology.anchorRepairPlan": {
        const plan = createTopologyAnchorRepairPlan({
          cadOpsVersion: request.version,
          document: this.#document,
          anchorId: request.query.anchorId,
          replacementCheckpointId: request.query.replacementCheckpointId,
          createReplacementCheckpoint:
            request.query.createReplacementCheckpoint,
          selectedRepairCandidateId: request.query.selectedRepairCandidateId,
          repairId: request.query.repairId,
          derivedExactMetadata: request.query.derivedExactMetadata
        });

        if (!plan.ok) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: plan.error
          };
        }

        return plan.response;
      }

      case "body.measurements": {
        const { bodyId } = request.query;
        const measurements = createBodyMeasurements(
          this.#document,
          bodyId,
          this.#document.units,
          DEFAULT_PART_ID
        );

        if (!measurements) {
          const bodyExists = createProjectStructure(
            this.#document,
            this.#history.map((entry) => entry.transaction)
          ).bodies.some((body) => body.id === bodyId);

          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: bodyExists
              ? {
                  code: "UNSUPPORTED_BODY_MEASUREMENTS",
                  message:
                    "Body measurements are currently available only for authored rectangle/circle sketch-extrude bodies.",
                  bodyId
                }
              : {
                  code: "BODY_NOT_FOUND",
                  message: `Body does not exist: ${bodyId}`,
                  bodyId
                }
          };
        }

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          measurements
        };
      }

      case "body.generatedReferenceMeasurements": {
        const { bodyId, stableId } = request.query;
        const measurements = createGeneratedReferenceMeasurements({
          document: this.#document,
          bodyId,
          stableId,
          units: this.#document.units,
          ownerPartId: DEFAULT_PART_ID,
          bodyExists: (candidateBodyId) =>
            createProjectStructure(
              this.#document,
              this.#history.map((entry) => entry.transaction)
            ).bodies.some((body) => body.id === candidateBodyId)
        });

        if (!measurements.ok) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: measurements.error
          };
        }

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          bodyId,
          stableId,
          kind: measurements.kind,
          reference: measurements.reference,
          measurements: measurements.measurements
        };
      }

      case "body.generatedReferences": {
        const { bodyId } = request.query;
        const references = createBodyGeneratedReferences(
          this.#document,
          bodyId,
          DEFAULT_PART_ID
        );

        if (!references) {
          const bodyExists = createProjectStructure(
            this.#document,
            this.#history.map((entry) => entry.transaction)
          ).bodies.some((body) => body.id === bodyId);

          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: bodyExists
              ? {
                  code: "UNSUPPORTED_BODY_REFERENCES",
                  message:
                    "Generated references are currently available only for authored sketch-extrude bodies, supported authored revolve newBody result bodies, and supported authored hole result bodies.",
                  bodyId
                }
              : {
                  code: "BODY_NOT_FOUND",
                  message: `Body does not exist: ${bodyId}`,
                  bodyId
                }
          };
        }

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          body: references.body,
          faceCount: references.faces.length,
          faces: references.faces,
          edgeCount: references.edges.length,
          edges: references.edges,
          vertexCount: references.vertices.length,
          vertices: references.vertices,
          axisCount: references.axes.length,
          axes: references.axes
        };
      }

      case "body.resolveGeneratedReference": {
        const { bodyId, stableId } = request.query;
        const references = createBodyGeneratedReferences(
          this.#document,
          bodyId,
          DEFAULT_PART_ID
        );

        if (!references) {
          const bodyExists = createProjectStructure(
            this.#document,
            this.#history.map((entry) => entry.transaction)
          ).bodies.some((body) => body.id === bodyId);

          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: bodyExists
              ? {
                  code: "UNSUPPORTED_BODY_REFERENCES",
                  message:
                    "Generated references are currently available only for authored sketch-extrude bodies, supported authored revolve newBody result bodies, and supported authored hole result bodies.",
                  bodyId
                }
              : {
                  code: "BODY_NOT_FOUND",
                  message: `Body does not exist: ${bodyId}`,
                  bodyId
                }
          };
        }

        const resolution = resolveGeneratedReference(references, stableId);

        if (!resolution) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: {
              code: "GENERATED_REFERENCE_NOT_FOUND",
              message: `Generated reference does not exist on body ${bodyId}: ${stableId}`,
              bodyId,
              stableId
            }
          };
        }

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          bodyId,
          stableId,
          kind: resolution.kind,
          reference: resolution.reference
        };
      }

      case "reference.listNamed": {
        const references = [...this.#document.namedReferences.values()].map(
          (reference) =>
            createNamedReferenceEntry(
              this.#document,
              reference,
              this.#history.map((entry) => entry.transaction)
            )
        );

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          referenceCount: references.length,
          references
        };
      }

      case "reference.resolveNamed": {
        const reference = this.#document.namedReferences.get(
          request.query.name
        );

        if (!reference) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: {
              code: "NAMED_REFERENCE_NOT_FOUND",
              message: `Named reference does not exist: ${request.query.name}`,
              referenceName: request.query.name
            }
          };
        }

        const entry = createNamedReferenceEntry(
          this.#document,
          reference,
          this.#history.map((historyEntry) => historyEntry.transaction)
        );

        if (entry.status === "stale" || !entry.reference) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: entry.error ?? {
              code: "GENERATED_REFERENCE_NOT_FOUND",
              message: `Named reference target is stale: ${request.query.name}`,
              bodyId: reference.bodyId,
              stableId: reference.stableId,
              referenceName: request.query.name
            }
          };
        }

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          name: reference.name,
          target: cloneNamedReferenceSnapshot(reference),
          reference: entry.reference
        };
      }

      case "reference.health": {
        const structure = createProjectStructure(
          this.#document,
          this.#history.map((entry) => entry.transaction)
        );
        const sketchProfileHealth = createSketchProfileHealthEntries({
          document: this.#document,
          features: structure.features
        });

        return createReferenceHealth({
          cadOpsVersion: request.version,
          ownerPartId: DEFAULT_PART_ID,
          document: this.#document,
          features: structure.features,
          bodies: structure.bodies,
          namedReferences: [...this.#document.namedReferences.values()],
          sketchProfileHealth,
          target: request.query.target,
          topologyMatchResults: request.query.topologyMatchResults
        });
      }

      case "selection.referenceCandidates": {
        const structure = createProjectStructure(
          this.#document,
          this.#history.map((entry) => entry.transaction)
        );
        const selection = createSelectionReferenceCandidates(
          this.#document,
          structure,
          this.#history.map((entry) => entry.transaction),
          request.query.selection,
          request.query.requiredOperation,
          request.query.topologyMatchResults
        );

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          selection: request.query.selection,
          ...(request.query.requiredOperation
            ? { requiredOperation: request.query.requiredOperation }
            : {}),
          status: selection.status,
          candidateCount: selection.candidates.length,
          candidates: selection.candidates,
          issueCount: selection.issues.length,
          issues: selection.issues
        };
      }

      case "transaction.history": {
        const transactions = createTransactionHistoryEntries([
          ...this.#history.map((entry) => entry.transaction),
          ...this.#redoStack.map((entry) => entry.transaction)
        ]);

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          transactionCount: transactions.length,
          transactions
        };
      }

      default:
        return createQueryErrorResponse(request, {
          code: "UNKNOWN_QUERY",
          message: `Unsupported query: ${String(
            (request.query as { readonly query?: unknown }).query
          )}.`
        });
    }
  }

  validateBatch(batch: CadBatch): CadBatchValidationResult {
    try {
      validateBatchEnvelope(batch);
      normalizeActorMetadata(batch.actor);
      normalizeAuditMetadata(batch.audit, batch.mode, batch.ops.length);
      this.#runOperations(batch.ops);
      return {
        ok: true,
        errors: [],
        warnings: []
      };
    } catch (error) {
      if (error instanceof BatchValidationFailure) {
        return {
          ok: false,
          errors: [error.validationError],
          warnings: []
        };
      }

      throw error;
    }
  }

  undo(): ApplyResult | undefined {
    const entry = this.#history.pop();

    if (!entry) {
      return undefined;
    }

    entry.transaction = {
      ...entry.transaction,
      status: "undone"
    };

    this.#document = cloneDocument(entry.before);
    this.#redoStack.push(entry);

    return {
      transaction: entry.transaction,
      document: cloneDocument(this.#document)
    };
  }

  redo(): ApplyResult | undefined {
    const entry = this.#redoStack.pop();

    if (!entry) {
      return undefined;
    }

    entry.transaction = {
      ...entry.transaction,
      status: "committed"
    };

    this.#document = cloneDocument(entry.after);
    this.#history.push(entry);

    return {
      transaction: entry.transaction,
      document: cloneDocument(this.#document)
    };
  }

  #createTransactionId(): TransactionId {
    const id = `txn_${this.#nextTransactionNumber}`;
    this.#nextTransactionNumber += 1;
    return id;
  }

  #runOperations(ops: readonly CadOp[]): OperationRunResult {
    return runOperations(
      ops,
      this.#document,
      this.#nextObjectNumber,
      this.#nextSketchNumber,
      this.#nextSketchEntityNumber,
      this.#nextParameterNumber,
      this.#nextSketchDimensionNumber,
      this.#nextSketchConstraintNumber,
      this.#nextFeatureNumber,
      this.#nextBodyNumber
    );
  }
}

export class SnapshotCadCommandWorker implements CadCommandWorker {
  readonly #delayMs: number;

  constructor(options: SnapshotCadCommandWorkerOptions = {}) {
    this.#delayMs = options.delayMs ?? 0;
  }

  async execute(request: CadWorkerRequest): Promise<CadWorkerResponse> {
    if (this.#delayMs > 0) {
      await delay(this.#delayMs);
    }

    const engine = new CadEngine(
      createCadDocumentFromSnapshot(request.document),
      {
        nextObjectNumber: request.document.nextObjectNumber,
        nextSketchNumber: request.document.nextSketchNumber,
        nextSketchEntityNumber: request.document.nextSketchEntityNumber,
        nextParameterNumber: request.document.nextParameterNumber,
        nextSketchDimensionNumber: request.document.nextSketchDimensionNumber,
        nextSketchConstraintNumber: request.document.nextSketchConstraintNumber,
        nextFeatureNumber: request.document.nextFeatureNumber,
        nextBodyNumber: request.document.nextBodyNumber
      }
    );

    return {
      id: request.id,
      response: engine.executeBatch(request.batch)
    };
  }
}

export const MockCadCommandWorker = SnapshotCadCommandWorker;

export class AsyncCadCommandExecutor {
  #nextRequestNumber = 1;
  #queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly engine: CadEngine,
    private readonly worker: CadCommandWorker
  ) {}

  async executeBatch(batch: CadBatch): Promise<CadBatchResponse> {
    const response = this.#queue.then(() => this.#executeBatchNow(batch));
    this.#queue = response.then(
      () => undefined,
      () => undefined
    );
    return response;
  }

  async #executeBatchNow(batch: CadBatch): Promise<CadBatchResponse> {
    const workerResponse = await this.worker.execute({
      id: this.#createRequestId(),
      batch,
      document: this.engine.createSnapshot()
    });

    if (!workerResponse.response.ok || batch.mode === "dryRun") {
      return workerResponse.response;
    }

    return this.engine.executeBatch(batch);
  }

  #createRequestId(): string {
    const id = `worker_req_${this.#nextRequestNumber}`;
    this.#nextRequestNumber += 1;
    return id;
  }
}

export function exportCadProject(engine: CadEngine): CadProject {
  const document = engine.createSnapshot();
  return {
    schemaVersion: getCadProjectFormatVersionForDocument(document),
    document,
    history: engine.getTransactions(),
    redoStack: engine.getRedoStack()
  };
}

export function createCadProjectSourceIdentity(
  project: CadProject
): WcadSourceIdentity {
  if (!isSupportedWcadDocumentSchema(project.schemaVersion)) {
    throw new WcadPackageImportError([
      createWcadPackageIssue(
        "WCAD_UNSUPPORTED_DOCUMENT_SCHEMA",
        "error",
        "WCAD source identity only supports V16 or V17 project schemas.",
        "$.schemaVersion",
        `${CAD_PROJECT_FORMAT_VERSION_V16} or ${CAD_PROJECT_FORMAT_VERSION_V17}`,
        project.schemaVersion
      )
    ]);
  }

  return createWcadSourceIdentitySync({
    documentSchemaVersion: project.schemaVersion,
    units: project.document.units,
    documentBytes: encodeCanonicalCbor(project.document),
    commandsBytes: encodeCanonicalCbor({
      history: project.history,
      redoStack: project.redoStack
    })
  });
}

export function exportCadProjectJson(engine: CadEngine): string {
  return JSON.stringify(exportCadProject(engine), null, 2);
}

export function parseCadProjectJson(json: string): CadProject {
  let value: unknown;

  try {
    value = JSON.parse(json);
  } catch {
    throw new CadProjectImportError([
      {
        code: "INVALID_JSON",
        path: "$",
        message: "Project JSON could not be parsed."
      }
    ]);
  }

  return parseCadProject(value);
}

export function importCadProject(project: CadProject): CadEngine {
  return CadEngine.fromProject(project);
}

export function importCadProjectJson(json: string): CadEngine {
  return importCadProject(parseCadProjectJson(json));
}

export async function exportCadProjectWcad(
  engine: CadEngine,
  options: ExportCadProjectWcadOptions = {}
): Promise<WcadPackageExportResult> {
  return exportCadProjectToWcad(exportCadProject(engine), options);
}

export async function exportCadProjectToWcad(
  project: CadProject,
  options: ExportCadProjectWcadOptions = {}
): Promise<WcadPackageExportResult> {
  if (
    project.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V18 ||
    (options.topologyCheckpoints?.length ?? 0) > 0
  ) {
    return exportCadProjectToWcadV2(project, options);
  }

  return exportCadProjectToWcadV1(project, options);
}

async function exportCadProjectToWcadV1(
  project: CadProject,
  options: ExportCadProjectWcadOptions
): Promise<WcadPackageExportResult> {
  if (!isSupportedWcadDocumentSchema(project.schemaVersion)) {
    throw new WcadPackageImportError([
      createWcadPackageIssue(
        "WCAD_UNSUPPORTED_DOCUMENT_SCHEMA",
        "error",
        "WCAD writer only supports V16 or V17 project schemas.",
        "$.schemaVersion",
        `${CAD_PROJECT_FORMAT_VERSION_V16} or ${CAD_PROJECT_FORMAT_VERSION_V17}`,
        project.schemaVersion
      )
    ]);
  }

  const documentBytes = encodeCanonicalCbor(project.document);
  const commandsBytes = encodeCanonicalCbor({
    history: project.history,
    redoStack: project.redoStack
  });
  const [documentEntry, commandsEntry, sourceIdentity] = await Promise.all([
    createWcadPackageEntryMetadata({
      path: WCAD_DOCUMENT_ENTRY_PATH,
      bytes: documentBytes
    }),
    createWcadPackageEntryMetadata({
      path: WCAD_COMMANDS_ENTRY_PATH,
      bytes: commandsBytes
    }),
    createWcadSourceIdentity({
      documentSchemaVersion: project.schemaVersion,
      units: project.document.units,
      documentBytes,
      commandsBytes
    })
  ]);
  const timestamp = options.createdAt ?? "1970-01-01T00:00:00.000Z";
  const manifest: WcadManifestV1 = {
    packageVersion: WCAD_PACKAGE_VERSION,
    product: "Partbench",
    createdBy: {
      app: "partbench",
      ...(options.appVersion ? { version: options.appVersion } : {})
    },
    createdAt: timestamp,
    modifiedAt: options.modifiedAt ?? timestamp,
    units: project.document.units,
    document: {
      ...documentEntry,
      schemaVersion: project.schemaVersion
    },
    commands: commandsEntry,
    sourceIdentity
  };
  const manifestBytes = encodeUtf8(`${JSON.stringify(manifest, null, 2)}\n`);

  return {
    bytes: writeZipStore([
      { path: WCAD_MANIFEST_ENTRY_PATH, bytes: manifestBytes },
      { path: WCAD_DOCUMENT_ENTRY_PATH, bytes: documentBytes },
      { path: WCAD_COMMANDS_ENTRY_PATH, bytes: commandsBytes }
    ]),
    manifest,
    sourceIdentity,
    documentBytes,
    commandsBytes
  };
}

async function exportCadProjectToWcadV2(
  project: CadProject,
  options: ExportCadProjectWcadOptions
): Promise<WcadPackageExportResult> {
  const checkpointInputs = options.topologyCheckpoints ?? [];

  if (project.schemaVersion !== CAD_PROJECT_FORMAT_VERSION_V18) {
    throw new WcadPackageImportError([
      createWcadPackageIssue(
        "WCAD_UNSUPPORTED_DOCUMENT_SCHEMA",
        "error",
        "WCAD v2 checkpoint writer requires web-cad.project.v18 source.",
        "$.schemaVersion",
        CAD_PROJECT_FORMAT_VERSION_V18,
        project.schemaVersion
      )
    ]);
  }

  if (!project.document.topologyIdentity) {
    throw new WcadPackageImportError([
      createWcadPackageIssue(
        "WCAD_UNSUPPORTED_DOCUMENT_SCHEMA",
        "error",
        "WCAD v2 checkpoint writer requires a topologyIdentity source block.",
        "$.document.topologyIdentity",
        "topology identity source block",
        "missing"
      )
    ]);
  }

  const topologyIdentityIssues = validateTopologyIdentitySourceSnapshot(
    project.document.topologyIdentity
  );

  if (topologyIdentityIssues.some((issue) => issue.severity === "error")) {
    throw new WcadPackageImportError(
      topologyIdentityIssues.map((issue) =>
        createWcadPackageIssue(
          "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
          "error",
          `Topology identity source block is invalid: ${issue.message}`,
          "$.document.topologyIdentity",
          issue.expected,
          issue.received
        )
      )
    );
  }

  validateWcadV2CheckpointPayloadInputs(project, checkpointInputs);

  const documentBytes = encodeCanonicalCbor(project.document);
  const commandsBytes = encodeCanonicalCbor({
    history: project.history,
    redoStack: project.redoStack
  });
  const checkpointPayloadsWithoutIdentity =
    await createWcadV2CheckpointPayloadsWithoutIdentity(
      checkpointInputs,
      project.document.units
    );
  const checkpointSourceEntries = checkpointPayloadsWithoutIdentity.flatMap(
    (payload) => [payload.brep, payload.topology, payload.signature]
  );
  const [documentEntry, commandsEntry, sourceIdentity] = await Promise.all([
    createWcadPackageEntryMetadata({
      path: WCAD_DOCUMENT_ENTRY_PATH,
      bytes: documentBytes
    }),
    createWcadPackageEntryMetadata({
      path: WCAD_COMMANDS_ENTRY_PATH,
      bytes: commandsBytes
    }),
    createWcadSourceIdentity({
      packageVersion: CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION,
      documentSchemaVersion: CAD_PROJECT_FORMAT_VERSION_V18,
      units: project.document.units,
      documentBytes,
      commandsBytes,
      checkpointSourceEntries
    })
  ]);
  const checkpointPayloads = checkpointPayloadsWithoutIdentity.map(
    (payload): WcadTopologyCheckpointPayload => {
      const manifestEntry: WcadTopologyCheckpointManifestEntry = {
        checkpointId: payload.checkpointId,
        bodyId: payload.bodyId,
        ...(payload.sourceFeatureId
          ? { sourceFeatureId: payload.sourceFeatureId }
          : {}),
        sourceIdentity,
        units: payload.units,
        kernel: payload.kernel,
        tolerance: payload.tolerance,
        brep: createCheckpointPayloadEntry(payload.brep, sourceIdentity),
        topology: createCheckpointPayloadEntry(
          payload.topology,
          sourceIdentity
        ),
        signature: createCheckpointPayloadEntry(
          payload.signature,
          sourceIdentity
        )
      };

      return {
        checkpointId: payload.checkpointId,
        bodyId: payload.bodyId,
        ...(payload.sourceFeatureId
          ? { sourceFeatureId: payload.sourceFeatureId }
          : {}),
        manifestEntry,
        brepBytes: payload.brepBytes,
        topologyBytes: payload.topologyBytes,
        signatureBytes: payload.signatureBytes
      };
    }
  );
  const timestamp = options.createdAt ?? "1970-01-01T00:00:00.000Z";
  const manifest: WcadManifestV2 = {
    packageVersion: CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION,
    product: "Partbench",
    createdBy: {
      app: "partbench",
      ...(options.appVersion ? { version: options.appVersion } : {})
    },
    createdAt: timestamp,
    modifiedAt: options.modifiedAt ?? timestamp,
    units: project.document.units,
    document: {
      ...documentEntry,
      schemaVersion: CAD_PROJECT_FORMAT_VERSION_V18
    },
    commands: commandsEntry,
    sourceIdentity,
    topologyIdentity: {
      contractVersion: CAD_TOPOLOGY_IDENTITY_CONTRACT_VERSION,
      projectSchemaVersion: CAD_PROJECT_FORMAT_VERSION_V18,
      checkpointCount: checkpointPayloads.length,
      checkpoints: checkpointPayloads.map((payload) => payload.manifestEntry),
      jsonFallback:
        options.topologyJsonFallback ??
        (checkpointPayloads.length > 0
          ? "checkpoint-metadata-only"
          : "lossless")
    }
  };
  const manifestIssues = validateWcadManifestV2Contract(manifest);

  if (hasError(manifestIssues)) {
    throw new WcadPackageImportError(manifestIssues);
  }

  const manifestBytes = encodeUtf8(`${JSON.stringify(manifest, null, 2)}\n`);
  const checkpointZipEntries = checkpointPayloads.flatMap((payload) => [
    { path: payload.manifestEntry.brep.path, bytes: payload.brepBytes },
    { path: payload.manifestEntry.topology.path, bytes: payload.topologyBytes },
    {
      path: payload.manifestEntry.signature.path,
      bytes: payload.signatureBytes
    }
  ]);

  return {
    bytes: writeZipStore([
      { path: WCAD_MANIFEST_ENTRY_PATH, bytes: manifestBytes },
      { path: WCAD_DOCUMENT_ENTRY_PATH, bytes: documentBytes },
      { path: WCAD_COMMANDS_ENTRY_PATH, bytes: commandsBytes },
      ...checkpointZipEntries
    ]),
    manifest,
    sourceIdentity,
    documentBytes,
    commandsBytes,
    checkpointPayloads
  };
}

export async function readCadProjectWcad(
  bytes: Uint8Array
): Promise<WcadPackageReadResult> {
  const zip = readZipStore(bytes);
  const issues: WcadPackageValidationIssue[] = [...zip.issues];
  const manifestBytes = zip.entries.get(WCAD_MANIFEST_ENTRY_PATH);

  if (!manifestBytes) {
    issues.push(
      createWcadPackageIssue(
        "WCAD_MISSING_MANIFEST",
        "error",
        "WCAD package is missing manifest.json.",
        "$",
        undefined,
        undefined,
        WCAD_MANIFEST_ENTRY_PATH,
        "manifest"
      )
    );
    return { ok: false, issues };
  }

  const manifestValue = decodeManifestJson(manifestBytes, issues);

  if (!manifestValue) {
    return { ok: false, issues };
  }

  if (isWcadManifestV2Package(manifestValue)) {
    return readCadProjectWcadV2(zip.entries, issues, manifestValue);
  }

  issues.push(...validateWcadManifest(manifestValue));

  if (hasError(issues) || !isWcadManifestV1(manifestValue)) {
    return { ok: false, issues };
  }

  if (!isSupportedWcadDocumentSchema(manifestValue.document.schemaVersion)) {
    issues.push(
      createWcadPackageIssue(
        "WCAD_UNSUPPORTED_DOCUMENT_SCHEMA",
        "error",
        "WCAD reader only supports V16 or V17 project schemas.",
        "$.document.schemaVersion",
        `${CAD_PROJECT_FORMAT_VERSION_V16} or ${CAD_PROJECT_FORMAT_VERSION_V17}`,
        manifestValue.document.schemaVersion,
        manifestValue.document.path,
        "document"
      )
    );
  }

  const documentBytes = zip.entries.get(manifestValue.document.path);
  const commandsBytes = zip.entries.get(manifestValue.commands.path);

  if (!documentBytes) {
    issues.push(
      createWcadPackageIssue(
        "WCAD_MISSING_DOCUMENT",
        "error",
        "WCAD package is missing document.cbor.",
        "$.document.path",
        manifestValue.document.path,
        "missing",
        manifestValue.document.path,
        "document"
      )
    );
  }

  if (!commandsBytes) {
    issues.push(
      createWcadPackageIssue(
        "WCAD_MISSING_COMMANDS",
        "error",
        "WCAD package is missing commands.cbor.",
        "$.commands.path",
        manifestValue.commands.path,
        "missing",
        manifestValue.commands.path,
        "commands"
      )
    );
  }

  if (documentBytes) {
    issues.push(
      ...(await validateWcadPackageEntryBytes({
        entry: manifestValue.document,
        bytes: documentBytes,
        entryRole: "document"
      }))
    );
  }

  if (commandsBytes) {
    issues.push(
      ...(await validateWcadPackageEntryBytes({
        entry: manifestValue.commands,
        bytes: commandsBytes,
        entryRole: "commands"
      }))
    );
  }

  issues.push(...readOptionalCacheDiagnostics(zip.entries, manifestValue));

  if (hasError(issues) || !documentBytes || !commandsBytes) {
    return { ok: false, issues };
  }

  const documentPayload = decodePackageCborPayload(
    documentBytes,
    "document",
    issues
  );
  const commandsPayload = decodePackageCborPayload(
    commandsBytes,
    "commands",
    issues
  );

  if (hasError(issues)) {
    return { ok: false, issues };
  }

  if (!isRecord(commandsPayload) || !Array.isArray(commandsPayload.history)) {
    issues.push(
      createWcadPackageIssue(
        "WCAD_INVALID_COMMANDS_CBOR",
        "error",
        "commands.cbor must decode to an object with a history array.",
        "$.history",
        "array",
        isRecord(commandsPayload)
          ? typeof commandsPayload.history
          : typeof commandsPayload,
        WCAD_COMMANDS_ENTRY_PATH,
        "commands"
      )
    );
  }

  if (!isRecord(commandsPayload) || !Array.isArray(commandsPayload.redoStack)) {
    issues.push(
      createWcadPackageIssue(
        "WCAD_INVALID_COMMANDS_CBOR",
        "error",
        "commands.cbor must decode to an object with a redoStack array.",
        "$.redoStack",
        "array",
        isRecord(commandsPayload)
          ? typeof commandsPayload.redoStack
          : typeof commandsPayload,
        WCAD_COMMANDS_ENTRY_PATH,
        "commands"
      )
    );
  }

  const sourceIdentity = await createWcadSourceIdentity({
    documentSchemaVersion: manifestValue.document.schemaVersion,
    units: manifestValue.units,
    documentBytes,
    commandsBytes
  });
  issues.push(
    ...validateWcadManifestSourceIdentity(manifestValue, sourceIdentity)
  );

  if (hasError(issues) || !isRecord(commandsPayload)) {
    return { ok: false, issues };
  }

  const candidateProject = {
    schemaVersion: manifestValue.document.schemaVersion,
    document: documentPayload,
    history: commandsPayload.history,
    redoStack: commandsPayload.redoStack
  };

  try {
    const project = parseCadProject(candidateProject);

    return {
      ok: true,
      project,
      manifest: manifestValue,
      sourceIdentity,
      diagnostics: issues
    };
  } catch (error) {
    if (error instanceof CadProjectImportError) {
      issues.push(...mapProjectImportIssuesToWcadIssues(error.issues));
      return { ok: false, issues };
    }

    issues.push(
      createWcadPackageIssue(
        "WCAD_INVALID_DOCUMENT_CBOR",
        "error",
        error instanceof Error
          ? error.message
          : "Decoded WCAD source could not be imported.",
        "$",
        undefined,
        undefined,
        WCAD_DOCUMENT_ENTRY_PATH,
        "document"
      )
    );
    return { ok: false, issues };
  }
}

async function readCadProjectWcadV2(
  entries: ReadonlyMap<string, Uint8Array>,
  issues: WcadPackageValidationIssue[],
  manifestValue: unknown
): Promise<WcadPackageReadResult> {
  issues.push(...validateWcadManifestV2Contract(manifestValue));

  if (hasError(issues) || !isWcadManifestV2(manifestValue)) {
    return { ok: false, issues };
  }

  const documentBytes = entries.get(manifestValue.document.path);
  const commandsBytes = entries.get(manifestValue.commands.path);

  if (!documentBytes) {
    issues.push(
      createWcadPackageIssue(
        "WCAD_MISSING_DOCUMENT",
        "error",
        "WCAD package is missing document.cbor.",
        "$.document.path",
        manifestValue.document.path,
        "missing",
        manifestValue.document.path,
        "document"
      )
    );
  }

  if (!commandsBytes) {
    issues.push(
      createWcadPackageIssue(
        "WCAD_MISSING_COMMANDS",
        "error",
        "WCAD package is missing commands.cbor.",
        "$.commands.path",
        manifestValue.commands.path,
        "missing",
        manifestValue.commands.path,
        "commands"
      )
    );
  }

  if (documentBytes) {
    issues.push(
      ...(await validateWcadPackageEntryBytes({
        entry: manifestValue.document,
        bytes: documentBytes,
        entryRole: "document"
      }))
    );
  }

  if (commandsBytes) {
    issues.push(
      ...(await validateWcadPackageEntryBytes({
        entry: manifestValue.commands,
        bytes: commandsBytes,
        entryRole: "commands"
      }))
    );
  }

  const checkpointPayloadReadSet = await readWcadV2CheckpointPayloads(
    entries,
    manifestValue,
    issues
  );

  issues.push(...readOptionalCacheDiagnostics(entries, manifestValue));

  if (hasError(issues) || !documentBytes || !commandsBytes) {
    return { ok: false, issues };
  }

  const documentPayload = decodePackageCborPayload(
    documentBytes,
    "document",
    issues
  );
  const commandsPayload = decodePackageCborPayload(
    commandsBytes,
    "commands",
    issues
  );

  if (hasError(issues)) {
    return { ok: false, issues };
  }

  if (!isRecord(commandsPayload) || !Array.isArray(commandsPayload.history)) {
    issues.push(
      createWcadPackageIssue(
        "WCAD_INVALID_COMMANDS_CBOR",
        "error",
        "commands.cbor must decode to an object with a history array.",
        "$.history",
        "array",
        isRecord(commandsPayload)
          ? typeof commandsPayload.history
          : typeof commandsPayload,
        WCAD_COMMANDS_ENTRY_PATH,
        "commands"
      )
    );
  }

  if (!isRecord(commandsPayload) || !Array.isArray(commandsPayload.redoStack)) {
    issues.push(
      createWcadPackageIssue(
        "WCAD_INVALID_COMMANDS_CBOR",
        "error",
        "commands.cbor must decode to an object with a redoStack array.",
        "$.redoStack",
        "array",
        isRecord(commandsPayload)
          ? typeof commandsPayload.redoStack
          : typeof commandsPayload,
        WCAD_COMMANDS_ENTRY_PATH,
        "commands"
      )
    );
  }

  const sourceIdentity = await createWcadSourceIdentity({
    packageVersion: CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION,
    documentSchemaVersion: manifestValue.document.schemaVersion,
    units: manifestValue.units,
    documentBytes,
    commandsBytes,
    checkpointSourceEntries: collectWcadV2CheckpointSourceEntries(manifestValue)
  });
  issues.push(
    ...validateWcadManifestSourceIdentity(manifestValue, sourceIdentity)
  );

  if (hasError(issues) || !isRecord(commandsPayload)) {
    return { ok: false, issues };
  }

  const candidateProject = {
    schemaVersion: manifestValue.document.schemaVersion,
    document: documentPayload,
    history: commandsPayload.history,
    redoStack: commandsPayload.redoStack
  };

  try {
    const project = parseCadProject(candidateProject);
    validateWcadV2CheckpointPayloadSourceLinks(
      project,
      checkpointPayloadReadSet.decodedByCheckpointId,
      issues
    );

    if (hasError(issues)) {
      return { ok: false, issues };
    }

    return {
      ok: true,
      project,
      manifest: manifestValue,
      sourceIdentity,
      checkpointPayloads: checkpointPayloadReadSet.payloads,
      diagnostics: issues
    };
  } catch (error) {
    if (error instanceof CadProjectImportError) {
      issues.push(...mapProjectImportIssuesToWcadIssues(error.issues));
      return { ok: false, issues };
    }

    issues.push(
      createWcadPackageIssue(
        "WCAD_INVALID_DOCUMENT_CBOR",
        "error",
        error instanceof Error
          ? error.message
          : "Decoded WCAD source could not be imported.",
        "$",
        undefined,
        undefined,
        WCAD_DOCUMENT_ENTRY_PATH,
        "document"
      )
    );
    return { ok: false, issues };
  }
}

interface WcadV2CheckpointPayloadWithoutIdentity {
  readonly checkpointId: string;
  readonly bodyId: BodyId;
  readonly sourceFeatureId?: FeatureId;
  readonly units: DocumentUnits;
  readonly kernel: WcadTopologyCheckpointKernelMetadata;
  readonly tolerance: WcadTopologyCheckpointToleranceMetadata;
  readonly brep: WcadPackageEntryMetadata;
  readonly topology: WcadPackageEntryMetadata;
  readonly signature: WcadPackageEntryMetadata;
  readonly brepBytes: Uint8Array;
  readonly topologyBytes: Uint8Array;
  readonly signatureBytes: Uint8Array;
}

interface DecodedWcadV2CheckpointPayload {
  readonly topologySnapshot?: CadBodyExactTopologySnapshot;
  readonly signaturePayload?: WcadTopologyCheckpointSignaturePayload;
}

interface WcadV2CheckpointPayloadReadSet {
  readonly payloads: readonly WcadTopologyCheckpointPayload[];
  readonly decodedByCheckpointId: ReadonlyMap<
    string,
    DecodedWcadV2CheckpointPayload
  >;
}

function validateWcadV2CheckpointPayloadInputs(
  project: CadProject,
  checkpointInputs: readonly WcadTopologyCheckpointPayloadInput[]
): void {
  const sourceCheckpointIds = new Set(
    project.document.topologyIdentity?.checkpoints.map(
      (checkpoint) => checkpoint.checkpointId
    ) ?? []
  );
  const sourceCheckpointsById = new Map(
    project.document.topologyIdentity?.checkpoints.map((checkpoint) => [
      checkpoint.checkpointId,
      checkpoint
    ]) ?? []
  );
  const inputCheckpointIds = new Set<string>();
  const issues: WcadPackageValidationIssue[] = [];

  for (const input of checkpointInputs) {
    let paths: ReturnType<typeof createWcadV2CheckpointEntryPaths> | undefined;

    try {
      paths = createWcadV2CheckpointEntryPaths(input.checkpointId);
    } catch {
      issues.push(
        createWcadPackageIssue(
          "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
          "error",
          "WCAD v2 checkpoint payload input has an invalid checkpoint id.",
          "$.topologyCheckpoints.checkpointId",
          "package-safe checkpoint id",
          input.checkpointId
        )
      );
      continue;
    }

    if (inputCheckpointIds.has(input.checkpointId)) {
      issues.push(
        createWcadPackageIssue(
          "WCAD_DUPLICATE_ENTRY",
          "error",
          "WCAD v2 checkpoint payload input duplicates a checkpoint id.",
          "$.topologyCheckpoints",
          undefined,
          input.checkpointId
        )
      );
    }

    inputCheckpointIds.add(input.checkpointId);

    if (!sourceCheckpointIds.has(input.checkpointId)) {
      issues.push(
        createWcadPackageIssue(
          "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
          "error",
          "WCAD v2 checkpoint payload input has no matching topologyIdentity source checkpoint record.",
          "$.topologyCheckpoints",
          "source checkpoint record",
          input.checkpointId
        )
      );
    } else {
      const sourceCheckpoint = sourceCheckpointsById.get(input.checkpointId);

      if (sourceCheckpoint) {
        validateSourceCheckpointPaths(sourceCheckpoint, paths, issues);
      }
    }

    const topologySnapshot = validateCheckpointTopologyPayload(
      input.topologyBytes,
      paths.topology,
      issues
    );
    const signaturePayload = validateCheckpointSignaturePayload(
      input.signatureBytes,
      paths.signature,
      issues
    );

    validateCheckpointPayloadConsistency(
      {
        checkpointId: input.checkpointId,
        topologySnapshot,
        signaturePayload,
        anchors:
          project.document.topologyIdentity?.anchors.filter(
            (anchor) => anchor.checkpointId === input.checkpointId
          ) ?? []
      },
      issues,
      { topology: paths.topology, signature: paths.signature }
    );
  }

  for (const checkpointId of sourceCheckpointIds) {
    if (!inputCheckpointIds.has(checkpointId)) {
      issues.push(
        createWcadPackageIssue(
          "WCAD_MISSING_CHECKPOINT_ENTRY",
          "error",
          "WCAD v2 writer requires payload bytes for every topologyIdentity source checkpoint record.",
          "$.document.topologyIdentity.checkpoints",
          checkpointId,
          "missing"
        )
      );
    }
  }

  if (issues.length > 0) {
    throw new WcadPackageImportError(issues);
  }
}

function validateSourceCheckpointPaths(
  checkpoint: NonNullable<
    CadDocumentSnapshot["topologyIdentity"]
  >["checkpoints"][number],
  paths: ReturnType<typeof createWcadV2CheckpointEntryPaths>,
  issues: WcadPackageValidationIssue[]
): void {
  if (checkpoint.brepEntryPath !== paths.brep) {
    issues.push(
      createWcadPackageIssue(
        "WCAD_INVALID_PACKAGE_PATH",
        "error",
        "Topology checkpoint source record B-rep path must match its checkpoint id.",
        "$.document.topologyIdentity.checkpoints.brepEntryPath",
        paths.brep,
        checkpoint.brepEntryPath,
        checkpoint.brepEntryPath,
        "checkpoint-brep"
      )
    );
  }

  if (checkpoint.topologyEntryPath !== paths.topology) {
    issues.push(
      createWcadPackageIssue(
        "WCAD_INVALID_PACKAGE_PATH",
        "error",
        "Topology checkpoint source record topology path must match its checkpoint id.",
        "$.document.topologyIdentity.checkpoints.topologyEntryPath",
        paths.topology,
        checkpoint.topologyEntryPath,
        checkpoint.topologyEntryPath,
        "checkpoint-topology"
      )
    );
  }

  if (checkpoint.signatureEntryPath !== paths.signature) {
    issues.push(
      createWcadPackageIssue(
        "WCAD_INVALID_PACKAGE_PATH",
        "error",
        "Topology checkpoint source record signature path must match its checkpoint id.",
        "$.document.topologyIdentity.checkpoints.signatureEntryPath",
        paths.signature,
        checkpoint.signatureEntryPath,
        checkpoint.signatureEntryPath,
        "checkpoint-signature"
      )
    );
  }
}

async function createWcadV2CheckpointPayloadsWithoutIdentity(
  checkpointInputs: readonly WcadTopologyCheckpointPayloadInput[],
  defaultUnits: DocumentUnits
): Promise<readonly WcadV2CheckpointPayloadWithoutIdentity[]> {
  return Promise.all(
    checkpointInputs.map(async (input) => {
      const paths = createWcadV2CheckpointEntryPaths(input.checkpointId);
      const [brep, topology, signature] = await Promise.all([
        createWcadPackageEntryMetadata({
          path: paths.brep,
          bytes: input.brepBytes
        }),
        createWcadPackageEntryMetadata({
          path: paths.topology,
          bytes: input.topologyBytes
        }),
        createWcadPackageEntryMetadata({
          path: paths.signature,
          bytes: input.signatureBytes
        })
      ]);

      return {
        checkpointId: input.checkpointId,
        bodyId: input.bodyId,
        ...(input.sourceFeatureId
          ? { sourceFeatureId: input.sourceFeatureId }
          : {}),
        units: input.units ?? defaultUnits,
        kernel: input.kernel,
        tolerance: input.tolerance,
        brep,
        topology,
        signature,
        brepBytes: input.brepBytes,
        topologyBytes: input.topologyBytes,
        signatureBytes: input.signatureBytes
      };
    })
  );
}

function createCheckpointPayloadEntry(
  metadata: WcadPackageEntryMetadata,
  sourceIdentity: WcadSourceIdentity
): WcadTopologyCheckpointPayloadEntry {
  const checkpointId = getCheckpointIdFromPayloadPath(metadata.path);

  return {
    ...metadata,
    checkpointId,
    source: true,
    sourceIdentity
  };
}

async function readWcadV2CheckpointPayloads(
  entries: ReadonlyMap<string, Uint8Array>,
  manifest: WcadManifestV2,
  issues: WcadPackageValidationIssue[]
): Promise<WcadV2CheckpointPayloadReadSet> {
  const payloads: WcadTopologyCheckpointPayload[] = [];
  const decodedByCheckpointId = new Map<
    string,
    DecodedWcadV2CheckpointPayload
  >();

  for (const checkpoint of manifest.topologyIdentity.checkpoints) {
    const brepBytes = await readRequiredWcadV2CheckpointBytes(
      entries,
      checkpoint.brep,
      "checkpoint-brep",
      issues
    );
    const topologyBytes = await readRequiredWcadV2CheckpointBytes(
      entries,
      checkpoint.topology,
      "checkpoint-topology",
      issues
    );
    const signatureBytes = await readRequiredWcadV2CheckpointBytes(
      entries,
      checkpoint.signature,
      "checkpoint-signature",
      issues
    );

    const topologySnapshot = topologyBytes
      ? validateCheckpointTopologyPayload(
          topologyBytes,
          checkpoint.topology.path,
          issues
        )
      : undefined;

    const signaturePayload = signatureBytes
      ? validateCheckpointSignaturePayload(
          signatureBytes,
          checkpoint.signature.path,
          issues
        )
      : undefined;

    validateCheckpointPayloadConsistency(
      {
        checkpointId: checkpoint.checkpointId,
        topologySnapshot,
        signaturePayload,
        anchors: []
      },
      issues,
      {
        topology: checkpoint.topology.path,
        signature: checkpoint.signature.path
      }
    );
    decodedByCheckpointId.set(checkpoint.checkpointId, {
      ...(topologySnapshot ? { topologySnapshot } : {}),
      ...(signaturePayload ? { signaturePayload } : {})
    });

    if (!brepBytes || !topologyBytes || !signatureBytes) {
      continue;
    }

    payloads.push({
      checkpointId: checkpoint.checkpointId,
      bodyId: checkpoint.bodyId,
      ...(checkpoint.sourceFeatureId
        ? { sourceFeatureId: checkpoint.sourceFeatureId }
        : {}),
      manifestEntry: checkpoint,
      brepBytes,
      topologyBytes,
      signatureBytes
    });
  }

  return { payloads, decodedByCheckpointId };
}

async function readRequiredWcadV2CheckpointBytes(
  entries: ReadonlyMap<string, Uint8Array>,
  entry: WcadTopologyCheckpointPayloadEntry,
  entryRole: Extract<
    WcadPackageEntryRole,
    "checkpoint-brep" | "checkpoint-topology" | "checkpoint-signature"
  >,
  issues: WcadPackageValidationIssue[]
): Promise<Uint8Array | undefined> {
  const bytes = entries.get(entry.path);

  if (!bytes) {
    issues.push(
      createWcadPackageIssue(
        "WCAD_MISSING_CHECKPOINT_ENTRY",
        "error",
        "WCAD package is missing a required checkpoint payload entry.",
        undefined,
        entry.path,
        "missing",
        entry.path,
        entryRole
      )
    );
    return undefined;
  }

  issues.push(
    ...(await validateWcadPackageEntryBytes({
      entry,
      bytes,
      entryRole
    }))
  );

  return bytes;
}

function validateCheckpointTopologyPayload(
  bytes: Uint8Array,
  entryPath: string,
  issues: WcadPackageValidationIssue[]
): CadBodyExactTopologySnapshot | undefined {
  const payload = decodeCheckpointCborPayload(
    bytes,
    entryPath,
    "checkpoint-topology",
    issues
  );

  if (payload === undefined) {
    return undefined;
  }

  if (!isCadBodyExactTopologySnapshot(payload)) {
    issues.push(
      createWcadPackageIssue(
        "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
        "error",
        "topology.cbor must contain a compatible exact topology snapshot with valid entity descriptors.",
        "$",
        "compatible exact topology snapshot",
        "invalid",
        entryPath,
        "checkpoint-topology"
      )
    );
    return undefined;
  }

  return payload;
}

function validateCheckpointSignaturePayload(
  bytes: Uint8Array,
  entryPath: string,
  issues: WcadPackageValidationIssue[]
): WcadTopologyCheckpointSignaturePayload | undefined {
  const payload = decodeCheckpointCborPayload(
    bytes,
    entryPath,
    "checkpoint-signature",
    issues
  );

  if (payload === undefined) {
    return undefined;
  }

  if (!isWcadTopologyCheckpointSignaturePayload(payload)) {
    issues.push(
      createWcadPackageIssue(
        "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
        "error",
        "signature.cbor must contain a checkpoint signature payload matching the V13 package contract.",
        "$",
        "checkpoint signature payload",
        "invalid",
        entryPath,
        "checkpoint-signature"
      )
    );
    return undefined;
  }

  return payload;
}

function decodeCheckpointCborPayload(
  bytes: Uint8Array,
  entryPath: string,
  entryRole: Extract<
    WcadPackageEntryRole,
    "checkpoint-topology" | "checkpoint-signature"
  >,
  issues: WcadPackageValidationIssue[]
): unknown | undefined {
  try {
    return decodeCanonicalCbor(bytes);
  } catch (error) {
    issues.push(
      createWcadPackageIssue(
        "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
        "error",
        error instanceof Error
          ? `${entryPath} could not be decoded: ${error.message}`
          : `${entryPath} could not be decoded.`,
        "$",
        "canonical CBOR checkpoint payload",
        error instanceof CanonicalCborDecodeError ? error.message : "invalid",
        entryPath,
        entryRole
      )
    );
    return undefined;
  }
}

function validateCheckpointPayloadConsistency(
  input: {
    readonly checkpointId: string;
    readonly topologySnapshot?: CadBodyExactTopologySnapshot;
    readonly signaturePayload?: WcadTopologyCheckpointSignaturePayload;
    readonly anchors: readonly CadTopologyAnchorSourceRecord[];
  },
  issues: WcadPackageValidationIssue[],
  entryPaths: {
    readonly topology: string;
    readonly signature: string;
  }
): void {
  const { topologySnapshot, signaturePayload } = input;

  if (!topologySnapshot || !signaturePayload) {
    return;
  }

  if (signaturePayload.checkpointId !== input.checkpointId) {
    issues.push(
      createWcadPackageIssue(
        "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
        "error",
        "Checkpoint signature payload checkpointId must match the checkpoint entry.",
        "$.checkpointId",
        input.checkpointId,
        signaturePayload.checkpointId,
        entryPaths.signature,
        "checkpoint-signature"
      )
    );
  }

  if (signaturePayload.signature !== topologySnapshot.signature) {
    issues.push(
      createWcadPackageIssue(
        "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
        "error",
        "Checkpoint signature payload must match topology.cbor snapshot signature.",
        "$.signature",
        topologySnapshot.signature,
        signaturePayload.signature,
        entryPaths.signature,
        "checkpoint-signature"
      )
    );
  }

  if (signaturePayload.entityCount !== topologySnapshot.entityCount) {
    issues.push(
      createWcadPackageIssue(
        "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
        "error",
        "Checkpoint signature payload entityCount must match topology.cbor.",
        "$.entityCount",
        topologySnapshot.entityCount,
        signaturePayload.entityCount,
        entryPaths.signature,
        "checkpoint-signature"
      )
    );
  }

  if (signaturePayload.entities) {
    validateCheckpointSignatureEntities(
      topologySnapshot,
      signaturePayload,
      issues,
      entryPaths.signature
    );
  }

  validateCheckpointAnchorPayloadEntities(
    input.anchors,
    topologySnapshot,
    issues,
    entryPaths.topology
  );
}

function validateWcadV2CheckpointPayloadSourceLinks(
  project: CadProject,
  decodedByCheckpointId: ReadonlyMap<string, DecodedWcadV2CheckpointPayload>,
  issues: WcadPackageValidationIssue[]
): void {
  const topologyIdentity = project.document.topologyIdentity;

  if (!topologyIdentity) {
    return;
  }

  for (const checkpoint of topologyIdentity.checkpoints) {
    const decoded = decodedByCheckpointId.get(checkpoint.checkpointId);

    validateCheckpointPayloadConsistency(
      {
        checkpointId: checkpoint.checkpointId,
        topologySnapshot: decoded?.topologySnapshot,
        signaturePayload: decoded?.signaturePayload,
        anchors: topologyIdentity.anchors.filter(
          (anchor) => anchor.checkpointId === checkpoint.checkpointId
        )
      },
      issues,
      {
        topology: checkpoint.topologyEntryPath,
        signature: checkpoint.signatureEntryPath
      }
    );
  }
}

function validateCheckpointSignatureEntities(
  topologySnapshot: CadBodyExactTopologySnapshot,
  signaturePayload: WcadTopologyCheckpointSignaturePayload,
  issues: WcadPackageValidationIssue[],
  entryPath: string
): void {
  const topologyEntitiesById = new Map(
    topologySnapshot.entities.map((entity) => [entity.localId, entity])
  );

  for (const entity of signaturePayload.entities ?? []) {
    const topologyEntity = topologyEntitiesById.get(entity.localId);

    if (!topologyEntity) {
      issues.push(
        createWcadPackageIssue(
          "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
          "error",
          "Checkpoint signature payload entity must exist in topology.cbor.",
          "$.entities",
          "topology entity localId",
          entity.localId,
          entryPath,
          "checkpoint-signature"
        )
      );
      continue;
    }

    if (
      topologyEntity.kind !== entity.kind ||
      topologyEntity.signature !== entity.signature
    ) {
      issues.push(
        createWcadPackageIssue(
          "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
          "error",
          "Checkpoint signature payload entity kind/signature must match topology.cbor.",
          "$.entities",
          `${topologyEntity.kind}:${topologyEntity.signature}`,
          `${entity.kind}:${entity.signature}`,
          entryPath,
          "checkpoint-signature"
        )
      );
    }
  }
}

function validateCheckpointAnchorPayloadEntities(
  anchors: readonly CadTopologyAnchorSourceRecord[],
  topologySnapshot: CadBodyExactTopologySnapshot,
  issues: WcadPackageValidationIssue[],
  entryPath: string
): void {
  const topologyEntitiesById = new Map(
    topologySnapshot.entities.map((entity) => [entity.localId, entity])
  );

  for (const anchor of anchors) {
    const topologyEntity = topologyEntitiesById.get(anchor.checkpointEntityId);

    if (!topologyEntity) {
      issues.push(
        createWcadPackageIssue(
          "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
          "error",
          "Topology anchor source record points to a checkpoint entity missing from topology.cbor.",
          "$.document.topologyIdentity.anchors.checkpointEntityId",
          "checkpoint topology entity",
          anchor.checkpointEntityId,
          entryPath,
          "checkpoint-topology"
        )
      );
      continue;
    }

    if (topologyEntity.kind !== anchor.entityKind) {
      issues.push(
        createWcadPackageIssue(
          "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
          "error",
          "Topology anchor source record entityKind must match topology.cbor entity kind.",
          "$.document.topologyIdentity.anchors.entityKind",
          topologyEntity.kind,
          anchor.entityKind,
          entryPath,
          "checkpoint-topology"
        )
      );
    }
  }
}

function isWcadTopologyCheckpointSignaturePayload(
  value: unknown
): value is WcadTopologyCheckpointSignaturePayload {
  if (
    !isRecord(value) ||
    typeof value.checkpointId !== "string" ||
    value.checkpointId.trim().length === 0 ||
    value.signatureAlgorithm !== "partbench-derived-topology-snapshot-v1" ||
    typeof value.signature !== "string" ||
    value.signature.trim().length === 0 ||
    !isNonNegativeInteger(value.entityCount)
  ) {
    return false;
  }

  if (value.entities !== undefined) {
    if (
      !Array.isArray(value.entities) ||
      value.entities.length !== value.entityCount ||
      !value.entities.every(isWcadTopologyCheckpointSignatureEntity)
    ) {
      return false;
    }

    const ids = new Set<string>();

    for (const entity of value.entities) {
      if (ids.has(entity.localId)) {
        return false;
      }

      ids.add(entity.localId);
    }
  }

  return true;
}

function isWcadTopologyCheckpointSignatureEntity(
  value: unknown
): value is NonNullable<
  WcadTopologyCheckpointSignaturePayload["entities"]
>[number] {
  return (
    isRecord(value) &&
    typeof value.localId === "string" &&
    value.localId.trim().length > 0 &&
    isCadBodyExactTopologyEntityKind(value.kind) &&
    typeof value.signature === "string" &&
    value.signature.trim().length > 0
  );
}

function getCheckpointIdFromPayloadPath(path: string): string {
  const basename = path.slice(path.lastIndexOf("/") + 1);

  if (basename.endsWith(".topology.cbor")) {
    return basename.slice(0, -".topology.cbor".length);
  }

  if (basename.endsWith(".signature.cbor")) {
    return basename.slice(0, -".signature.cbor".length);
  }

  if (basename.endsWith(".brep")) {
    return basename.slice(0, -".brep".length);
  }

  return basename;
}

export async function parseCadProjectWcad(
  bytes: Uint8Array
): Promise<CadProject> {
  const result = await readCadProjectWcad(bytes);

  if (!result.ok) {
    throw new WcadPackageImportError(result.issues);
  }

  return result.project;
}

export async function importCadProjectWcad(
  bytes: Uint8Array
): Promise<CadEngine> {
  return importCadProject(await parseCadProjectWcad(bytes));
}

export function formatWcadPackageImportError(error: unknown): string {
  if (error instanceof WcadPackageImportError) {
    return error.message;
  }

  return error instanceof Error ? error.message : "Invalid WCAD package.";
}

function formatWcadPackageImportIssues(
  issues: readonly WcadPackageValidationIssue[]
): string {
  if (issues.length === 0) {
    return "Invalid WCAD package.";
  }

  return issues
    .map((issue) => {
      const location = issue.path ?? issue.entryPath ?? "$";
      return `${issue.code} at ${location}: ${issue.message}`;
    })
    .join("\n");
}

function decodeManifestJson(
  bytes: Uint8Array,
  issues: WcadPackageValidationIssue[]
): unknown | undefined {
  try {
    return JSON.parse(decodeUtf8(bytes));
  } catch (error) {
    issues.push(
      createWcadPackageIssue(
        "WCAD_INVALID_MANIFEST",
        "error",
        error instanceof Error
          ? `manifest.json could not be parsed: ${error.message}`
          : "manifest.json could not be parsed.",
        "$",
        "UTF-8 JSON object",
        "invalid",
        WCAD_MANIFEST_ENTRY_PATH,
        "manifest"
      )
    );
    return undefined;
  }
}

function decodePackageCborPayload(
  bytes: Uint8Array,
  entryRole: Extract<WcadPackageEntryRole, "document" | "commands">,
  issues: WcadPackageValidationIssue[]
): unknown | undefined {
  try {
    return decodeCanonicalCbor(bytes);
  } catch (error) {
    const entryPath =
      entryRole === "document"
        ? WCAD_DOCUMENT_ENTRY_PATH
        : WCAD_COMMANDS_ENTRY_PATH;

    issues.push(
      createWcadPackageIssue(
        entryRole === "document"
          ? "WCAD_INVALID_DOCUMENT_CBOR"
          : "WCAD_INVALID_COMMANDS_CBOR",
        "error",
        error instanceof Error
          ? `${entryPath} could not be decoded: ${error.message}`
          : `${entryPath} could not be decoded.`,
        "$",
        "canonical CBOR source payload",
        error instanceof CanonicalCborDecodeError ? error.message : "invalid",
        entryPath,
        entryRole
      )
    );
    return undefined;
  }
}

function readOptionalCacheDiagnostics(
  entries: ReadonlyMap<string, Uint8Array>,
  manifest: WcadManifestV1 | WcadManifestV2
): readonly WcadPackageValidationIssue[] {
  if (!manifest.cache?.entriesPath) {
    return [];
  }

  const cacheBytes = entries.get(manifest.cache.entriesPath);

  if (!cacheBytes) {
    return [
      createWcadPackageIssue(
        "WCAD_STALE_CACHE_ENTRY",
        "warning",
        "WCAD package manifest references a cache index that is not present; cache data is rebuildable and ignored.",
        "$.cache.entriesPath",
        manifest.cache.entriesPath,
        "missing",
        manifest.cache.entriesPath,
        "metadata"
      )
    ];
  }

  let cacheValue: unknown;

  try {
    cacheValue = JSON.parse(decodeUtf8(cacheBytes));
  } catch (error) {
    return [
      createWcadPackageIssue(
        "WCAD_UNSUPPORTED_CACHE_ENTRY",
        "warning",
        error instanceof Error
          ? `WCAD cache index could not be parsed and was ignored: ${error.message}`
          : "WCAD cache index could not be parsed and was ignored.",
        "$.cache.entriesPath",
        "JSON cache index",
        "invalid",
        manifest.cache.entriesPath,
        "metadata"
      )
    ];
  }

  const cacheEntries =
    isRecord(cacheValue) && Array.isArray(cacheValue.entries)
      ? cacheValue.entries
      : undefined;

  if (!cacheEntries) {
    return [
      createWcadPackageIssue(
        "WCAD_UNSUPPORTED_CACHE_ENTRY",
        "warning",
        "WCAD cache index must contain an entries array; cache data was ignored.",
        "$.entries",
        "array",
        typeof cacheValue,
        manifest.cache.entriesPath,
        "metadata"
      )
    ];
  }

  return validateWcadPackageCacheEntries(cacheEntries, manifest.sourceIdentity);
}

function mapProjectImportIssuesToWcadIssues(
  issues: readonly CadProjectImportIssue[]
): readonly WcadPackageValidationIssue[] {
  return issues.map((issue) => {
    const isCommandIssue =
      issue.path.startsWith("$.history") ||
      issue.path.startsWith("$.redoStack");
    return createWcadPackageIssue(
      isCommandIssue
        ? "WCAD_INVALID_COMMANDS_CBOR"
        : "WCAD_INVALID_DOCUMENT_CBOR",
      "error",
      `Decoded WCAD source failed project validation: ${issue.message}`,
      issue.path,
      undefined,
      undefined,
      isCommandIssue ? WCAD_COMMANDS_ENTRY_PATH : WCAD_DOCUMENT_ENTRY_PATH,
      isCommandIssue ? "commands" : "document"
    );
  });
}

function isWcadManifestV1(value: unknown): value is WcadManifestV1 {
  return (
    isRecord(value) &&
    value.packageVersion === WCAD_PACKAGE_VERSION &&
    value.product === "Partbench" &&
    isRecord(value.document) &&
    value.document.path === WCAD_DOCUMENT_ENTRY_PATH &&
    typeof value.document.schemaVersion === "string" &&
    isRecord(value.commands) &&
    value.commands.path === WCAD_COMMANDS_ENTRY_PATH &&
    isRecord(value.sourceIdentity)
  );
}

function isWcadManifestV2Package(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.packageVersion === CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION
  );
}

function isWcadManifestV2(value: unknown): value is WcadManifestV2 {
  return (
    isRecord(value) &&
    value.packageVersion === CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION &&
    value.product === "Partbench" &&
    isRecord(value.document) &&
    value.document.path === WCAD_DOCUMENT_ENTRY_PATH &&
    value.document.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V18 &&
    isRecord(value.commands) &&
    value.commands.path === WCAD_COMMANDS_ENTRY_PATH &&
    isRecord(value.sourceIdentity) &&
    isRecord(value.topologyIdentity) &&
    Array.isArray(value.topologyIdentity.checkpoints)
  );
}

function createWcadPackageIssue(
  code: WcadPackageValidationIssue["code"],
  severity: WcadPackageValidationIssue["severity"],
  message: string,
  path?: string,
  expected?: string | number,
  received?: string | number,
  entryPath?: string,
  entryRole?: WcadPackageEntryRole
): WcadPackageValidationIssue {
  return {
    code,
    severity,
    message,
    ...(path ? { path } : {}),
    ...(entryPath ? { entryPath } : {}),
    ...(entryRole ? { entryRole } : {}),
    ...(expected !== undefined ? { expected } : {}),
    ...(received !== undefined ? { received } : {})
  };
}

function hasError(issues: readonly WcadPackageValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}

function encodeUtf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export function formatCadProjectImportError(error: unknown): string {
  if (error instanceof CadProjectImportError) {
    return error.message;
  }

  return error instanceof Error ? error.message : "Invalid project JSON.";
}

type MutableSemanticDiff = {
  created: CadObjectRef[];
  modified: CadObjectRef[];
  deleted: CadObjectRef[];
  document?: MutableDocumentSemanticDiff;
  sketches?: MutableSketchSemanticDiff;
  features?: MutableFeatureSemanticDiff;
  references?: MutableReferenceSemanticDiff;
  parameters?: MutableParameterSemanticDiff;
  sketchDimensions?: MutableSketchDimensionSemanticDiff;
  sketchConstraints?: MutableSketchConstraintSemanticDiff;
};

type MutableDocumentSemanticDiff = {
  units?: {
    before: DocumentUnits;
    after: DocumentUnits;
    mode: DocumentUnitUpdateMode;
    scaleFactor: number;
  };
};

type MutableSketchSemanticDiff = {
  created: CadSketchRef[];
  modified: CadSketchRef[];
  deleted: CadSketchRef[];
  entitiesCreated: CadSketchEntityRef[];
  entitiesModified: CadSketchEntityRef[];
  entitiesDeleted: CadSketchEntityRef[];
};

type MutableFeatureSemanticDiff = {
  created: CadFeatureRef[];
  modified: CadFeatureRef[];
  deleted: CadFeatureRef[];
  bodiesCreated: CadBodyRef[];
  bodiesModified: CadBodyRef[];
  bodiesDeleted: CadBodyRef[];
  referenceEffects: CadFeatureReferenceChangeSummary[];
  lifecycleEffects: CadBodyLifecycleEffectSummary[];
};

type MutableReferenceSemanticDiff = {
  namedCreated: CadNamedReferenceRef[];
  namedRepaired: CadNamedReferenceRepairRef[];
  namedDeleted: CadNamedReferenceRef[];
  topologyCheckpointsCreated: CadTopologyCheckpointRef[];
  topologyAnchorsCreated: CadTopologyAnchorRef[];
  topologyAnchorsRepaired: CadTopologyAnchorRepairRef[];
};

type MutableParameterSemanticDiff = {
  created: CadParameterRef[];
  modified: CadParameterRef[];
  deleted: CadParameterRef[];
};

type MutableSketchDimensionSemanticDiff = {
  created: CadSketchDimensionRef[];
  modified: CadSketchDimensionRef[];
  deleted: CadSketchDimensionRef[];
};

type MutableSketchConstraintSemanticDiff = {
  created: CadSketchConstraintRef[];
  modified: CadSketchConstraintRef[];
  deleted: CadSketchConstraintRef[];
};

type SketchEntityImportRef = {
  readonly sketchId: SketchId;
  readonly kind: SketchEntityKind;
  readonly entity: unknown;
};

interface MutableDocumentState {
  objects: Map<ObjectId, SceneObject>;
  sketches: Map<SketchId, Sketch>;
  parameters: Map<ParameterId, CadParameter>;
  sketchDimensions: Map<SketchDimensionId, SketchDimension>;
  sketchConstraints: Map<SketchConstraintId, SketchConstraint>;
  features: Map<FeatureId, Feature>;
  namedReferences: Map<NamedReferenceName, NamedGeneratedReferenceSnapshot>;
  topologyIdentity?: CadTopologyIdentitySourceSnapshot;
  units: DocumentUnits;
}

function applyOperation(
  op: CadOp,
  state: MutableDocumentState,
  diff: MutableSemanticDiff,
  createObjectId: () => ObjectId,
  createSketchId: () => SketchId,
  createSketchEntityId: () => SketchEntityId,
  createParameterId: () => ParameterId,
  createSketchDimensionId: () => SketchDimensionId,
  createSketchConstraintId: () => SketchConstraintId,
  createFeatureId: () => FeatureId,
  createBodyId: () => BodyId,
  opIndex: number
): void {
  switch (op.op) {
    case "parameter.create": {
      const parameter: CadParameter = {
        id: op.id ?? createParameterId(),
        name: normalizeParameterName(op.name, opIndex, op.id),
        value: validateFiniteParameterValue(op.value, opIndex, "value"),
        ...(op.description !== undefined
          ? {
              description: normalizeOptionalDescription(op.description, opIndex)
            }
          : {})
      };

      addParameter(state.parameters, parameter, diff, opIndex);
      reevaluateParameterDimensions(state, parameter.id, diff, opIndex);
      return;
    }

    case "parameter.update": {
      assertParameterUpdateHasChanges(op, opIndex);
      const existing = getParameterOrThrow(state.parameters, op.id, opIndex);
      const nextDescription =
        op.description !== undefined
          ? normalizeParameterUpdateDescription(op.description, opIndex)
          : existing.description;
      const updated: CadParameter = {
        id: existing.id,
        name: existing.name,
        ...(op.value !== undefined
          ? { value: validateFiniteParameterValue(op.value, opIndex, "value") }
          : { value: existing.value }),
        ...(nextDescription !== undefined
          ? { description: nextDescription }
          : {})
      };

      state.parameters.set(op.id, updated);
      pushParameterModified(diff, parameterRef(updated));
      reevaluateParameterDimensions(state, op.id, diff, opIndex);
      return;
    }

    case "parameter.rename": {
      const existing = getParameterOrThrow(state.parameters, op.id, opIndex);
      const updated: CadParameter = {
        ...existing,
        name: normalizeParameterName(op.name, opIndex, op.id)
      };

      state.parameters.set(op.id, updated);
      pushParameterModified(diff, parameterRef(updated));
      return;
    }

    case "parameter.delete": {
      const existing = getParameterOrThrow(state.parameters, op.id, opIndex);
      assertParameterNotInUse(state.sketchDimensions, op.id, opIndex);
      state.parameters.delete(op.id);
      pushParameterDeleted(diff, parameterRef(existing));
      return;
    }

    case "document.updateUnits": {
      validateDocumentUnits(op.units, opIndex);
      const unitUpdateMode = validateDocumentUnitUpdateMode(op.mode, opIndex);

      if (state.units !== op.units) {
        const previousUnitDiff = diff.document?.units;
        const before = previousUnitDiff?.before ?? state.units;
        const operationScaleFactor =
          unitUpdateMode === "preservePhysicalSize"
            ? getUnitConversionScaleFactor(state.units, op.units)
            : 1;
        const scaleFactor = cleanMeasurementNumber(
          (previousUnitDiff?.scaleFactor ?? 1) * operationScaleFactor
        );
        const diffMode =
          previousUnitDiff?.mode === "preservePhysicalSize" ||
          unitUpdateMode === "preservePhysicalSize"
            ? "preservePhysicalSize"
            : "metadataOnly";

        if (unitUpdateMode === "preservePhysicalSize") {
          scaleDocumentLengthValues(state, operationScaleFactor, diff);
        }

        diff.document = {
          ...diff.document,
          units: {
            before,
            after: op.units,
            mode: diffMode,
            scaleFactor
          }
        };
        state.units = op.units;
      }

      return;
    }

    case "scene.createBox": {
      validateBoxDimensions(op.dimensions, opIndex);

      const object: BoxObject = {
        id: op.id ?? createObjectId(),
        kind: "box",
        name: normalizeOptionalObjectName(op.name, opIndex, op.id),
        dimensions: op.dimensions,
        transform: mergeTransform(op.transform)
      };

      addObject(state.objects, object, diff, opIndex);
      return;
    }

    case "scene.createCylinder": {
      validateCylinderDimensions(op.dimensions, opIndex);

      const object: CylinderObject = {
        id: op.id ?? createObjectId(),
        kind: "cylinder",
        name: normalizeOptionalObjectName(op.name, opIndex, op.id),
        dimensions: op.dimensions,
        transform: mergeTransform(op.transform)
      };

      addObject(state.objects, object, diff, opIndex);
      return;
    }

    case "scene.createSphere": {
      validateSphereDimensions(op.dimensions, opIndex);

      const object: SphereObject = {
        id: op.id ?? createObjectId(),
        kind: "sphere",
        name: normalizeOptionalObjectName(op.name, opIndex, op.id),
        dimensions: op.dimensions,
        transform: mergeTransform(op.transform)
      };

      addObject(state.objects, object, diff, opIndex);
      return;
    }

    case "scene.createCone": {
      validateConeDimensions(op.dimensions, opIndex);

      const object: ConeObject = {
        id: op.id ?? createObjectId(),
        kind: "cone",
        name: normalizeOptionalObjectName(op.name, opIndex, op.id),
        dimensions: op.dimensions,
        transform: mergeTransform(op.transform)
      };

      addObject(state.objects, object, diff, opIndex);
      return;
    }

    case "scene.createTorus": {
      validateTorusDimensions(op.dimensions, opIndex);

      const object: TorusObject = {
        id: op.id ?? createObjectId(),
        kind: "torus",
        name: normalizeOptionalObjectName(op.name, opIndex, op.id),
        dimensions: op.dimensions,
        transform: mergeTransform(op.transform)
      };

      addObject(state.objects, object, diff, opIndex);
      return;
    }

    case "scene.deleteObject": {
      const existing = getObjectOrThrow(state.objects, op.id, opIndex);
      state.objects.delete(op.id);
      diff.deleted.push(objectRef(existing));
      return;
    }

    case "scene.updateTransform": {
      const existing = getObjectOrThrow(state.objects, op.id, opIndex);
      const updated: SceneObject = {
        ...existing,
        transform: mergeTransform(op.transform, existing.transform)
      };

      state.objects.set(op.id, updated);
      diff.modified.push(objectRef(updated));
      return;
    }

    case "scene.updateBoxDimensions": {
      const existing = getObjectOrThrow(state.objects, op.id, opIndex);
      assertObjectKind(existing, "box", opIndex);
      validateBoxDimensions(op.dimensions, opIndex, op.id);

      const updated: BoxObject = {
        ...existing,
        dimensions: op.dimensions
      };

      state.objects.set(op.id, updated);
      diff.modified.push(objectRef(updated));
      return;
    }

    case "scene.updateCylinderDimensions": {
      const existing = getObjectOrThrow(state.objects, op.id, opIndex);
      assertObjectKind(existing, "cylinder", opIndex);
      validateCylinderDimensions(op.dimensions, opIndex, op.id);

      const updated: CylinderObject = {
        ...existing,
        dimensions: op.dimensions
      };

      state.objects.set(op.id, updated);
      diff.modified.push(objectRef(updated));
      return;
    }

    case "scene.updateSphereDimensions": {
      const existing = getObjectOrThrow(state.objects, op.id, opIndex);
      assertObjectKind(existing, "sphere", opIndex);
      validateSphereDimensions(op.dimensions, opIndex, op.id);

      const updated: SphereObject = {
        ...existing,
        dimensions: op.dimensions
      };

      state.objects.set(op.id, updated);
      diff.modified.push(objectRef(updated));
      return;
    }

    case "scene.updateConeDimensions": {
      const existing = getObjectOrThrow(state.objects, op.id, opIndex);
      assertObjectKind(existing, "cone", opIndex);
      validateConeDimensions(op.dimensions, opIndex, op.id);

      const updated: ConeObject = {
        ...existing,
        dimensions: op.dimensions
      };

      state.objects.set(op.id, updated);
      diff.modified.push(objectRef(updated));
      return;
    }

    case "scene.updateTorusDimensions": {
      const existing = getObjectOrThrow(state.objects, op.id, opIndex);
      assertObjectKind(existing, "torus", opIndex);
      validateTorusDimensions(op.dimensions, opIndex, op.id);

      const updated: TorusObject = {
        ...existing,
        dimensions: op.dimensions
      };

      state.objects.set(op.id, updated);
      diff.modified.push(objectRef(updated));
      return;
    }

    case "scene.renameObject": {
      const existing = getObjectOrThrow(state.objects, op.id, opIndex);
      const name = normalizeObjectName(op.name, opIndex, op.id);
      const updated: SceneObject = {
        ...existing,
        name
      };

      state.objects.set(op.id, updated);
      diff.modified.push(objectRef(updated));
      return;
    }

    case "sketch.create": {
      const sketch: Sketch = {
        id: op.id ?? createSketchId(),
        name: normalizeSketchName(op.name, opIndex, op.id),
        plane: validateSketchPlane(op.plane, opIndex),
        entities: new Map()
      };

      addSketch(state.sketches, sketch, diff, opIndex);
      return;
    }

    case "sketch.createOnFace": {
      const target = resolveSketchAttachmentTarget(state, op, opIndex);
      const sketch: Sketch = {
        id: op.id ?? createSketchId(),
        name: normalizeSketchName(op.name, opIndex, op.id),
        plane: target.plane,
        attachment: target.attachment,
        entities: new Map()
      };

      addSketch(state.sketches, sketch, diff, opIndex);
      return;
    }

    case "sketch.rename": {
      const existing = getSketchOrThrow(state.sketches, op.id, opIndex);
      const updated: Sketch = {
        ...existing,
        name: normalizeSketchName(op.name, opIndex, op.id)
      };

      state.sketches.set(op.id, updated);
      pushSketchModified(diff, sketchRef(updated));
      return;
    }

    case "sketch.delete": {
      const existing = getSketchOrThrow(state.sketches, op.id, opIndex);
      assertSketchNotInUse(state.features, op.id, opIndex);
      state.sketches.delete(op.id);
      pushSketchDeleted(diff, sketchRef(existing));

      for (const entity of existing.entities.values()) {
        pushSketchEntityDeleted(diff, sketchEntityRef(existing.id, entity));
      }

      for (const dimension of state.sketchDimensions.values()) {
        if (dimension.sketchId !== op.id) {
          continue;
        }

        state.sketchDimensions.delete(dimension.id);
        pushSketchDimensionDeleted(diff, sketchDimensionRef(dimension));
      }

      for (const constraint of state.sketchConstraints.values()) {
        if (constraint.sketchId !== op.id) {
          continue;
        }

        state.sketchConstraints.delete(constraint.id);
        pushSketchConstraintDeleted(diff, sketchConstraintRef(constraint));
      }

      return;
    }

    case "sketch.addPoint": {
      const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
      const entity: SketchEntity = {
        id: op.id ?? createSketchEntityId(),
        kind: "point",
        point: validateVec2(op.point, opIndex, "point")
      };

      addSketchEntity(state.sketches, sketch, entity, diff, opIndex);
      return;
    }

    case "sketch.addLine": {
      const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
      const entity: SketchEntity = {
        id: op.id ?? createSketchEntityId(),
        kind: "line",
        start: validateVec2(op.start, opIndex, "start"),
        end: validateVec2(op.end, opIndex, "end")
      };

      addSketchEntity(state.sketches, sketch, entity, diff, opIndex);
      return;
    }

    case "sketch.addRectangle": {
      const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
      const entity: SketchEntity = {
        id: op.id ?? createSketchEntityId(),
        kind: "rectangle",
        center: validateVec2(op.center, opIndex, "center"),
        width: validatePositiveSketchMeasurement(op.width, opIndex, "width"),
        height: validatePositiveSketchMeasurement(op.height, opIndex, "height")
      };

      addSketchEntity(state.sketches, sketch, entity, diff, opIndex);
      return;
    }

    case "sketch.addCircle": {
      const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
      const entity: SketchEntity = {
        id: op.id ?? createSketchEntityId(),
        kind: "circle",
        center: validateVec2(op.center, opIndex, "center"),
        radius: validatePositiveSketchMeasurement(op.radius, opIndex, "radius")
      };

      addSketchEntity(state.sketches, sketch, entity, diff, opIndex);
      return;
    }

    case "sketch.updateEntity": {
      const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
      const existing = sketch.entities.get(op.entity.id);

      if (!existing) {
        throwSketchEntityNotFound(op.sketchId, op.entity.id, opIndex);
      }

      const entity = normalizeSketchEntity(op.entity, opIndex);
      assertSketchDimensionTargetsStillValid(
        state.sketchDimensions,
        op.sketchId,
        entity,
        opIndex
      );
      assertSketchConstraintTargetsStillValid(
        state.sketchConstraints,
        op.sketchId,
        entity,
        opIndex
      );
      const constrainedEntity = applySketchConstraintsToEntity(
        state,
        op.sketchId,
        entity,
        opIndex
      );
      syncDimensionsForSketchEntityUpdate(
        state,
        op.sketchId,
        existing,
        constrainedEntity,
        diff,
        opIndex
      );
      updateSketchEntityAndDependents(
        state,
        sketch,
        constrainedEntity,
        diff,
        opIndex
      );

      return;
    }

    case "sketch.deleteEntity": {
      const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
      const existing = sketch.entities.get(op.entityId);

      if (!existing) {
        throwSketchEntityNotFound(op.sketchId, op.entityId, opIndex);
      }

      assertSketchEntityNotInUse(
        state.features,
        op.sketchId,
        op.entityId,
        opIndex
      );
      const entities = new Map(sketch.entities);
      entities.delete(op.entityId);
      state.sketches.set(sketch.id, { ...sketch, entities });
      pushSketchEntityDeleted(diff, sketchEntityRef(sketch.id, existing));

      for (const dimension of state.sketchDimensions.values()) {
        if (
          dimension.sketchId !== op.sketchId ||
          dimension.entityId !== op.entityId
        ) {
          continue;
        }

        state.sketchDimensions.delete(dimension.id);
        pushSketchDimensionDeleted(diff, sketchDimensionRef(dimension));
      }
      for (const constraint of state.sketchConstraints.values()) {
        if (
          !sketchConstraintReferencesEntity(
            constraint,
            op.sketchId,
            op.entityId
          )
        ) {
          continue;
        }

        state.sketchConstraints.delete(constraint.id);
        pushSketchConstraintDeleted(diff, sketchConstraintRef(constraint));
      }
      return;
    }

    case "sketch.dimension.create": {
      const target = validateSketchDimensionTarget(state, op, opIndex);
      const valueSource = createSketchDimensionValueSource(op, opIndex);
      const dimension: SketchDimension = {
        id: op.id ?? createSketchDimensionId(),
        name: normalizeSketchDimensionName(op.name, opIndex, op.id),
        sketchId: op.sketchId,
        entityId: op.entityId,
        target,
        valueSource
      };

      addSketchDimension(state.sketchDimensions, dimension, diff, opIndex);
      applySketchDimensionToEntity(state, dimension, diff, opIndex);
      return;
    }

    case "sketch.dimension.update": {
      const existing = getSketchDimensionOrThrow(
        state.sketchDimensions,
        op.id,
        opIndex
      );
      const valueSource = createSketchDimensionValueSource(op, opIndex);
      const updated: SketchDimension = {
        ...existing,
        valueSource
      };

      state.sketchDimensions.set(op.id, updated);
      pushSketchDimensionModified(diff, sketchDimensionRef(updated));
      applySketchDimensionToEntity(state, updated, diff, opIndex);
      return;
    }

    case "sketch.dimension.rename": {
      const existing = getSketchDimensionOrThrow(
        state.sketchDimensions,
        op.id,
        opIndex
      );
      const updated: SketchDimension = {
        ...existing,
        name: normalizeSketchDimensionName(op.name, opIndex, op.id)
      };

      state.sketchDimensions.set(op.id, updated);
      pushSketchDimensionModified(diff, sketchDimensionRef(updated));
      return;
    }

    case "sketch.dimension.delete": {
      const existing = getSketchDimensionOrThrow(
        state.sketchDimensions,
        op.id,
        opIndex
      );

      state.sketchDimensions.delete(op.id);
      pushSketchDimensionDeleted(diff, sketchDimensionRef(existing));
      return;
    }

    case "sketch.constraint.create": {
      const constraint = createSketchConstraintFromOp(
        state,
        op,
        op.id ?? createSketchConstraintId(),
        opIndex
      );

      addSketchConstraint(state.sketchConstraints, constraint, diff, opIndex);
      applySketchConstraintToEntity(state, constraint, diff, opIndex);
      return;
    }

    case "sketch.constraint.rename": {
      const existing = getSketchConstraintOrThrow(
        state.sketchConstraints,
        op.id,
        opIndex
      );
      const updated: SketchConstraint = {
        ...existing,
        name: normalizeSketchConstraintName(op.name, opIndex, op.id)
      };

      state.sketchConstraints.set(op.id, updated);
      pushSketchConstraintModified(diff, sketchConstraintRef(updated));
      return;
    }

    case "sketch.constraint.delete": {
      const existing = getSketchConstraintOrThrow(
        state.sketchConstraints,
        op.id,
        opIndex
      );

      state.sketchConstraints.delete(op.id);
      pushSketchConstraintDeleted(diff, sketchConstraintRef(existing));
      return;
    }

    case "feature.extrude": {
      const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
      const entity = sketch.entities.get(op.entityId);

      if (!entity) {
        throwSketchEntityNotFound(op.sketchId, op.entityId, opIndex);
      }

      const profileKind = assertExtrudableProfile(
        entity,
        opIndex,
        op.sketchId,
        op.entityId
      );
      const depth = validateExtrudeDepth(op.depth, opIndex);
      const side = validateExtrudeSide(op.side, opIndex);
      const operationMode = parseExtrudeOperationMode(
        op.operationMode,
        opIndex
      );
      const target = validateExtrudeTarget(
        state,
        operationMode,
        op.targetBodyId,
        op.targetTopologyAnchorId,
        opIndex
      );
      assertSupportedExtrudeOperation(
        state,
        operationMode,
        profileKind,
        target.targetBodyId,
        target.targetTopologyAnchorId,
        opIndex
      );
      const feature: ExtrudeFeature = {
        id: op.id ?? createFeatureId(),
        kind: "extrude",
        name: normalizeOptionalFeatureName(op.name, opIndex, op.id),
        sketchId: op.sketchId,
        entityId: op.entityId,
        profileKind,
        depth,
        side,
        operationMode,
        targetBodyId: target.targetBodyId,
        targetTopologyAnchorId: target.targetTopologyAnchorId,
        bodyId: op.bodyId ?? createBodyId()
      };

      addFeature(state, feature, diff, opIndex);
      return;
    }

    case "feature.revolve": {
      const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
      const entity = sketch.entities.get(op.entityId);

      if (!entity) {
        throwSketchEntityNotFound(op.sketchId, op.entityId, opIndex);
      }

      const profileKind = assertRevolvableProfile(
        entity,
        opIndex,
        op.sketchId,
        op.entityId
      );
      const axis = validateRevolveAxis(state, op.axis, op.sketchId, opIndex);
      const angleDegrees = validateRevolveAngleDegrees(
        op.angleDegrees,
        opIndex
      );
      const operationMode = parseRevolveOperationMode(
        op.operationMode,
        opIndex
      );
      validateRevolveTargetBodyId(operationMode, op.targetBodyId, opIndex);

      const feature: RevolveFeature = {
        id: op.id ?? createFeatureId(),
        kind: "revolve",
        name: normalizeOptionalFeatureName(op.name, opIndex, op.id),
        sketchId: op.sketchId,
        entityId: op.entityId,
        profileKind,
        axis,
        angleDegrees,
        operationMode,
        bodyId: op.bodyId ?? createBodyId()
      };

      addFeature(state, feature, diff, opIndex);
      return;
    }

    case "feature.hole": {
      const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
      const entity = sketch.entities.get(op.circleEntityId);

      if (!entity) {
        throwSketchEntityNotFound(op.sketchId, op.circleEntityId, opIndex);
      }

      assertHoleCircleEntity(entity, opIndex, op.sketchId, op.circleEntityId);
      validateHoleSketchAttachment(state, sketch, opIndex);

      const target = validateHoleTarget(
        state,
        op.targetBodyId,
        op.targetTopologyAnchorId,
        opIndex
      );
      assertSupportedHoleTarget(
        state,
        target.targetBodyId,
        target.targetTopologyAnchorId,
        opIndex
      );
      const depthMode = validateHoleDepthMode(op.depthMode, opIndex);
      const depth = validateHoleDepth(depthMode, op.depth, opIndex);
      const direction = validateHoleDirection(op.direction, opIndex);
      const feature: HoleFeature = {
        id: op.id ?? createFeatureId(),
        kind: "hole",
        name: normalizeOptionalFeatureName(op.name, opIndex, op.id),
        targetBodyId: target.targetBodyId,
        targetTopologyAnchorId: target.targetTopologyAnchorId,
        sketchId: op.sketchId,
        circleEntityId: op.circleEntityId,
        depthMode,
        ...(depth !== undefined ? { depth } : {}),
        direction,
        bodyId: op.bodyId ?? createBodyId()
      };

      addFeature(state, feature, diff, opIndex);
      return;
    }

    case "feature.chamfer": {
      const feature = createEdgeFinishFeature(
        state,
        {
          id: op.id,
          bodyId: op.bodyId,
          name: op.name,
          targetBodyId: op.targetBodyId,
          edgeStableId: op.edgeStableId,
          namedReference: op.namedReference,
          topologyAnchorId: op.topologyAnchorId,
          topologyAnchorProof: op.topologyAnchorProof,
          scalar: op.distance
        },
        "feature.chamfer",
        createFeatureId,
        createBodyId,
        opIndex
      );

      addFeature(state, feature, diff, opIndex);
      return;
    }

    case "feature.fillet": {
      const feature = createEdgeFinishFeature(
        state,
        {
          id: op.id,
          bodyId: op.bodyId,
          name: op.name,
          targetBodyId: op.targetBodyId,
          edgeStableId: op.edgeStableId,
          namedReference: op.namedReference,
          topologyAnchorId: op.topologyAnchorId,
          topologyAnchorProof: op.topologyAnchorProof,
          scalar: op.radius
        },
        "feature.fillet",
        createFeatureId,
        createBodyId,
        opIndex
      );

      addFeature(state, feature, diff, opIndex);
      return;
    }

    case "feature.delete": {
      deleteFeature(state, op.id, diff, opIndex);
      return;
    }

    case "feature.updateExtrude": {
      updateExtrudeFeature(state, op, diff, opIndex);
      return;
    }

    case "feature.updateRevolve": {
      updateRevolveFeature(state, op, diff, opIndex);
      return;
    }

    case "feature.updateHole": {
      updateHoleFeature(state, op, diff, opIndex);
      return;
    }

    case "feature.updateChamfer": {
      updateChamferFeature(state, op, diff, opIndex);
      return;
    }

    case "feature.updateFillet": {
      updateFilletFeature(state, op, diff, opIndex);
      return;
    }

    case "reference.nameGenerated": {
      const name = normalizeNamedReferenceName(op.name, opIndex);

      if (state.namedReferences.has(name)) {
        throwValidationError({
          code: "NAMED_REFERENCE_ALREADY_EXISTS",
          message: `Named reference already exists: ${name}`,
          opIndex,
          referenceName: name,
          path: operationPath(opIndex, "name"),
          expected: "unique named reference",
          received: name
        });
      }

      const validation = validateGeneratedReference({
        document: state,
        ownerPartId: DEFAULT_PART_ID,
        bodyId: op.bodyId,
        stableId: op.stableId,
        bodyExists: (bodyId) => documentBodyExists(state, bodyId),
        requiredOperation: "feature.selectReference"
      });

      if (!validation.ok) {
        throwGeneratedReferenceValidationError(
          validation.error,
          opIndex,
          "stableId"
        );
      }

      const reference: NamedGeneratedReferenceSnapshot = {
        name,
        bodyId: op.bodyId,
        stableId: op.stableId,
        kind: validation.kind
      };
      state.namedReferences.set(name, reference);
      pushNamedReferenceCreated(diff, reference);
      return;
    }

    case "reference.repairName": {
      const name = normalizeNamedReferenceName(op.name, opIndex);
      const before = state.namedReferences.get(name);

      if (!before) {
        throwValidationError({
          code: "NAMED_REFERENCE_NOT_FOUND",
          message: `Named reference does not exist: ${name}`,
          opIndex,
          referenceName: name,
          path: operationPath(opIndex, "name"),
          expected: "existing named reference",
          received: name
        });
      }

      const repairTarget = resolveNamedReferenceRepairTarget(
        state,
        op,
        before,
        name,
        opIndex
      );

      const after: NamedGeneratedReferenceSnapshot = {
        name,
        bodyId: repairTarget.bodyId,
        stableId: repairTarget.stableId,
        kind: repairTarget.kind,
        ...(repairTarget.topologyAnchorId
          ? { topologyAnchorId: repairTarget.topologyAnchorId }
          : {})
      };
      assertNamedReferenceRepairConsumers(state, before, after, opIndex);
      state.namedReferences.set(name, after);
      pushNamedReferenceRepaired(diff, before, after);
      return;
    }

    case "reference.deleteName": {
      const name = normalizeNamedReferenceName(op.name, opIndex);
      const reference = state.namedReferences.get(name);

      if (!reference) {
        throwValidationError({
          code: "NAMED_REFERENCE_NOT_FOUND",
          message: `Named reference does not exist: ${name}`,
          opIndex,
          referenceName: name,
          path: operationPath(opIndex, "name"),
          expected: "existing named reference",
          received: name
        });
      }

      state.namedReferences.delete(name);
      pushNamedReferenceDeleted(diff, reference);
      return;
    }

    case "topology.checkpoint.create": {
      const topologyIdentity = ensureTopologyIdentitySource(state);

      if (
        topologyIdentity.checkpoints.some(
          (checkpoint) => checkpoint.checkpointId === op.checkpointId
        )
      ) {
        throwValidationError({
          code: "TOPOLOGY_CHECKPOINT_ALREADY_EXISTS",
          message: `Topology checkpoint already exists: ${op.checkpointId}`,
          opIndex,
          checkpointId: op.checkpointId,
          path: operationPath(opIndex, "checkpointId"),
          expected: "unique topology checkpoint id",
          received: op.checkpointId
        });
      }

      let checkpointPaths: ReturnType<typeof createWcadV2CheckpointEntryPaths>;
      try {
        checkpointPaths = createWcadV2CheckpointEntryPaths(op.checkpointId);
      } catch {
        throwValidationError({
          code: "INVALID_TOPOLOGY_CHECKPOINT",
          message: `Topology checkpoint id is not package-safe: ${op.checkpointId}`,
          opIndex,
          checkpointId: op.checkpointId,
          path: operationPath(opIndex, "checkpointId"),
          expected: "package-safe topology checkpoint id",
          received: op.checkpointId
        });
      }

      if (!documentBodyExists(state, op.bodyId)) {
        throwValidationError({
          code: "BODY_NOT_FOUND",
          message: `Body does not exist: ${op.bodyId}`,
          opIndex,
          bodyId: op.bodyId,
          path: operationPath(opIndex, "bodyId"),
          expected: "existing body",
          received: op.bodyId
        });
      }

      const sourceFeature = op.sourceFeatureId
        ? state.features.get(op.sourceFeatureId)
        : findFeatureByBodyId(state.features, op.bodyId);

      if (op.sourceFeatureId && !sourceFeature) {
        throwValidationError({
          code: "FEATURE_NOT_FOUND",
          message: `Feature does not exist: ${op.sourceFeatureId}`,
          opIndex,
          featureId: op.sourceFeatureId,
          path: operationPath(opIndex, "sourceFeatureId"),
          expected: "existing feature",
          received: op.sourceFeatureId
        });
      }

      if (sourceFeature && sourceFeature.bodyId !== op.bodyId) {
        throwValidationError({
          code: "INVALID_TOPOLOGY_CHECKPOINT",
          message: `Topology checkpoint body ${op.bodyId} does not match feature body ${sourceFeature.bodyId}.`,
          opIndex,
          bodyId: op.bodyId,
          featureId: sourceFeature.id,
          path: operationPath(opIndex, "bodyId"),
          expected: sourceFeature.bodyId,
          received: op.bodyId
        });
      }

      const checkpoint: CadTopologyCheckpointSourceRecord = {
        checkpointId: op.checkpointId,
        bodyId: op.bodyId,
        ...(sourceFeature ? { sourceFeatureId: sourceFeature.id } : {}),
        sourceIdentity: op.sourceIdentity,
        packageVersion: CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION,
        projectSchemaVersion: CAD_PROJECT_FORMAT_VERSION_V18,
        brepEntryPath: checkpointPaths.brep,
        topologyEntryPath: checkpointPaths.topology,
        signatureEntryPath: checkpointPaths.signature,
        status: op.status,
        diagnostics: op.diagnostics ?? []
      };

      state.topologyIdentity = {
        ...topologyIdentity,
        checkpoints: [...topologyIdentity.checkpoints, checkpoint]
      };
      pushTopologyCheckpointCreated(diff, checkpoint);
      return;
    }

    case "topology.anchor.create": {
      const topologyIdentity = ensureTopologyIdentitySource(state);

      if (
        topologyIdentity.anchors.some(
          (anchor) => anchor.anchorId === op.anchorId
        )
      ) {
        throwValidationError({
          code: "TOPOLOGY_ANCHOR_ALREADY_EXISTS",
          message: `Topology anchor already exists: ${op.anchorId}`,
          opIndex,
          topologyAnchorId: op.anchorId,
          path: operationPath(opIndex, "anchorId"),
          expected: "unique topology anchor id",
          received: op.anchorId
        });
      }

      const checkpoint = topologyIdentity.checkpoints.find(
        (candidate) => candidate.checkpointId === op.checkpointId
      );

      if (!checkpoint) {
        throwValidationError({
          code: "TOPOLOGY_CHECKPOINT_NOT_FOUND",
          message: `Topology checkpoint does not exist: ${op.checkpointId}`,
          opIndex,
          topologyAnchorId: op.anchorId,
          checkpointId: op.checkpointId,
          path: operationPath(opIndex, "checkpointId"),
          expected: "existing topology checkpoint",
          received: op.checkpointId
        });
      }

      if (!documentBodyExists(state, op.bodyId)) {
        throwValidationError({
          code: "BODY_NOT_FOUND",
          message: `Body does not exist: ${op.bodyId}`,
          opIndex,
          bodyId: op.bodyId,
          path: operationPath(opIndex, "bodyId"),
          expected: "existing body",
          received: op.bodyId
        });
      }

      if (checkpoint.bodyId !== op.bodyId) {
        throwValidationError({
          code: "INVALID_TOPOLOGY_ANCHOR",
          message: `Topology anchor body ${op.bodyId} does not match checkpoint body ${checkpoint.bodyId}.`,
          opIndex,
          bodyId: op.bodyId,
          topologyAnchorId: op.anchorId,
          checkpointId: checkpoint.checkpointId,
          path: operationPath(opIndex, "bodyId"),
          expected: checkpoint.bodyId,
          received: op.bodyId
        });
      }

      if (op.sourceFeatureId && !state.features.has(op.sourceFeatureId)) {
        throwValidationError({
          code: "FEATURE_NOT_FOUND",
          message: `Feature does not exist: ${op.sourceFeatureId}`,
          opIndex,
          featureId: op.sourceFeatureId,
          path: operationPath(opIndex, "sourceFeatureId"),
          expected: "existing feature",
          received: op.sourceFeatureId
        });
      }

      const anchor: CadTopologyAnchorSourceRecord = {
        anchorId: op.anchorId,
        entityKind: op.entityKind,
        bodyId: op.bodyId,
        checkpointId: op.checkpointId,
        checkpointEntityId: op.checkpointEntityId,
        ...((op.sourceFeatureId ?? checkpoint.sourceFeatureId)
          ? {
              sourceFeatureId: op.sourceFeatureId ?? checkpoint.sourceFeatureId
            }
          : {}),
        ...(op.stableId ? { stableId: op.stableId } : {}),
        ...(op.sourceSemanticRole
          ? { sourceSemanticRole: op.sourceSemanticRole }
          : {}),
        ...(op.signatureHash ? { signatureHash: op.signatureHash } : {}),
        state: "active",
        diagnostics: []
      };

      state.topologyIdentity = {
        ...topologyIdentity,
        anchors: [...topologyIdentity.anchors, anchor]
      };
      pushTopologyAnchorCreated(diff, anchor);
      return;
    }

    case "topology.anchor.repair": {
      const topologyIdentity = requireTopologyIdentitySource(
        state,
        opIndex,
        op.anchorId
      );
      const anchor = topologyIdentity.anchors.find(
        (candidate) => candidate.anchorId === op.anchorId
      );

      if (!anchor) {
        throwValidationError({
          code: "TOPOLOGY_ANCHOR_NOT_FOUND",
          message: `Topology anchor does not exist: ${op.anchorId}`,
          opIndex,
          topologyAnchorId: op.anchorId,
          path: operationPath(opIndex, "anchorId"),
          expected: "existing topology anchor",
          received: op.anchorId
        });
      }

      if (
        topologyIdentity.repairs.some(
          (repair) => repair.repairId === op.repairId
        )
      ) {
        throwValidationError({
          code: "TOPOLOGY_REPAIR_ALREADY_EXISTS",
          message: `Topology repair already exists: ${op.repairId}`,
          opIndex,
          topologyAnchorId: op.anchorId,
          path: operationPath(opIndex, "repairId"),
          expected: "unique topology repair id",
          received: op.repairId
        });
      }

      const replacementCheckpoint = topologyIdentity.checkpoints.find(
        (candidate) => candidate.checkpointId === op.replacementCheckpointId
      );

      if (!replacementCheckpoint) {
        throwValidationError({
          code: "TOPOLOGY_CHECKPOINT_NOT_FOUND",
          message: `Replacement topology checkpoint does not exist: ${op.replacementCheckpointId}`,
          opIndex,
          topologyAnchorId: op.anchorId,
          checkpointId: op.replacementCheckpointId,
          path: operationPath(opIndex, "replacementCheckpointId"),
          expected: "existing replacement topology checkpoint",
          received: op.replacementCheckpointId
        });
      }

      const repair: CadTopologyRepairSourceRecord = {
        repairId: op.repairId,
        anchorId: anchor.anchorId,
        previousCheckpointId: anchor.checkpointId,
        replacementCheckpointId: op.replacementCheckpointId,
        replacementCheckpointEntityId: op.replacementCheckpointEntityId,
        confidence: op.confidence,
        evidence: op.evidence ?? [],
        diagnostics: op.diagnostics ?? []
      };
      const repairedAnchor: CadTopologyAnchorSourceRecord = {
        ...anchor,
        bodyId: replacementCheckpoint.bodyId,
        checkpointId: op.replacementCheckpointId,
        checkpointEntityId: op.replacementCheckpointEntityId,
        sourceFeatureId: replacementCheckpoint.sourceFeatureId,
        state: "active",
        diagnostics: []
      };

      state.topologyIdentity = {
        ...topologyIdentity,
        anchors: topologyIdentity.anchors.map((candidate) =>
          candidate.anchorId === anchor.anchorId ? repairedAnchor : candidate
        ),
        repairs: [...topologyIdentity.repairs, repair]
      };
      pushTopologyAnchorRepaired(diff, repair, anchor, repairedAnchor);
      return;
    }

    default: {
      const unknownOp = op as unknown;

      throwValidationError({
        code: "INVALID_OPERATION",
        message: `Unsupported operation: ${
          isRecord(unknownOp)
            ? String(unknownOp.op)
            : describeReceived(unknownOp)
        }.`,
        opIndex,
        op:
          isRecord(unknownOp) && typeof unknownOp.op === "string"
            ? (unknownOp.op as CadOp["op"])
            : undefined,
        path: operationPath(opIndex, "op"),
        expected: "supported CADOps operation",
        received: isRecord(unknownOp)
          ? describeReceived(unknownOp.op)
          : describeReceived(unknownOp)
      });
    }
  }
}

function validateBatchEnvelope(batch: CadBatch): void {
  const value = batch as unknown;

  if (!isRecord(value)) {
    throwValidationError({
      code: "INVALID_BATCH",
      message: "CADOps batch must be an object.",
      path: "$",
      expected: "batch object",
      received: describeReceived(value)
    });
  }

  if (value.version !== "cadops.v1") {
    throwValidationError({
      code: "INVALID_CADOPS_VERSION",
      message: "CADOps batch version must be cadops.v1.",
      path: "$.version",
      expected: "cadops.v1",
      received: describeReceived(value.version)
    });
  }

  if (value.mode !== "dryRun" && value.mode !== "commit") {
    throwValidationError({
      code: "INVALID_BATCH_MODE",
      message: "CADOps batch mode must be dryRun or commit.",
      path: "$.mode",
      expected: "dryRun or commit",
      received: describeReceived(value.mode)
    });
  }

  if (!Array.isArray(value.ops)) {
    throwValidationError({
      code: "INVALID_BATCH",
      message: "CADOps batch ops must be an array.",
      path: "$.ops",
      expected: "operation array",
      received: describeReceived(value.ops)
    });
  }

  for (const [index, op] of value.ops.entries()) {
    if (
      isRecord(op) &&
      typeof op.op === "string" &&
      isCadOperationKind(op.op)
    ) {
      continue;
    }

    throwValidationError({
      code: "INVALID_OPERATION",
      message: `Unsupported or malformed operation at index ${index}.`,
      opIndex: index,
      op:
        isRecord(op) && typeof op.op === "string"
          ? (op.op as CadOp["op"])
          : undefined,
      path: operationPath(index),
      expected: "supported CADOps operation",
      received: describeReceived(op)
    });
    return;
  }
}

function getBatchResponseMode(batch: CadBatch): CadBatch["mode"] {
  const value = batch as unknown;

  if (isRecord(value) && value.mode === "commit") {
    return "commit";
  }

  return "dryRun";
}

function isCadOperationKind(value: string): boolean {
  switch (value) {
    case "parameter.create":
    case "parameter.update":
    case "parameter.rename":
    case "parameter.delete":
    case "document.updateUnits":
    case "scene.createBox":
    case "scene.createCylinder":
    case "scene.createSphere":
    case "scene.createCone":
    case "scene.createTorus":
    case "scene.deleteObject":
    case "scene.updateTransform":
    case "scene.updateBoxDimensions":
    case "scene.updateCylinderDimensions":
    case "scene.updateSphereDimensions":
    case "scene.updateConeDimensions":
    case "scene.updateTorusDimensions":
    case "scene.renameObject":
    case "sketch.create":
    case "sketch.createOnFace":
    case "sketch.rename":
    case "sketch.delete":
    case "sketch.addPoint":
    case "sketch.addLine":
    case "sketch.addRectangle":
    case "sketch.addCircle":
    case "sketch.updateEntity":
    case "sketch.deleteEntity":
    case "sketch.dimension.create":
    case "sketch.dimension.update":
    case "sketch.dimension.rename":
    case "sketch.dimension.delete":
    case "sketch.constraint.create":
    case "sketch.constraint.rename":
    case "sketch.constraint.delete":
    case "feature.extrude":
    case "feature.revolve":
    case "feature.hole":
    case "feature.chamfer":
    case "feature.fillet":
    case "feature.delete":
    case "feature.updateExtrude":
    case "feature.updateRevolve":
    case "feature.updateHole":
    case "feature.updateChamfer":
    case "feature.updateFillet":
    case "reference.nameGenerated":
    case "reference.repairName":
    case "reference.deleteName":
    case "topology.checkpoint.create":
    case "topology.anchor.create":
    case "topology.anchor.repair":
      return true;
  }

  return false;
}

function validateQueryRequestEnvelope(
  request: CadQueryRequest
): CadQueryResponse | undefined {
  const value = request as unknown;

  if (!isRecord(value)) {
    return createQueryErrorResponse(value, {
      code: "INVALID_QUERY",
      message: "CADOps query request must be an object."
    });
  }

  if (value.version !== "cadops.v1") {
    return createQueryErrorResponse(value, {
      code: "INVALID_CADOPS_VERSION",
      message: "CADOps query version must be cadops.v1."
    });
  }

  if (!isRecord(value.query)) {
    return createQueryErrorResponse(value, {
      code: "INVALID_QUERY",
      message: "CADOps query must be an object."
    });
  }

  if (typeof value.query.query !== "string") {
    return createQueryErrorResponse(value, {
      code: "INVALID_QUERY",
      message: "CADOps query kind must be a string."
    });
  }

  if (!isCadQueryKind(value.query.query)) {
    return createQueryErrorResponse(value, {
      code: "UNKNOWN_QUERY",
      message: `Unsupported query: ${value.query.query}.`
    });
  }

  if (!isCadQuery(value.query)) {
    return createQueryErrorResponse(value, {
      code: "INVALID_QUERY",
      message: `Malformed query payload for ${value.query.query}.`
    });
  }

  return undefined;
}

function createQueryErrorResponse(
  request: unknown,
  error: CadQueryError
): CadQueryResponse {
  const query =
    isRecord(request) &&
    isRecord(request.query) &&
    typeof request.query.query === "string" &&
    isCadQueryKind(request.query.query)
      ? request.query.query
      : "unknown";
  const cadOpsVersion =
    isRecord(request) && typeof request.version === "string"
      ? request.version
      : "unknown";

  return {
    ok: false,
    query,
    cadOpsVersion,
    error
  } as CadQueryResponse;
}

function isCadQueryKind(value: string): value is CadQueryKind {
  switch (value) {
    case "parameter.list":
    case "parameter.get":
    case "feature.editability":
    case "project.summary":
    case "project.features":
    case "project.structure":
    case "project.health":
    case "project.dependencyGraph":
    case "project.rebuildPlan":
    case "project.topologyIdentityReadiness":
    case "topology.matchSnapshots":
    case "topology.anchorRepairCandidates":
    case "topology.anchorCommandReadiness":
    case "topology.commandTargetReadiness":
    case "topology.anchorCreationPlan":
    case "topology.anchorRepairPlan":
    case "project.exportReadiness":
    case "project.exportExact":
    case "project.packageReadiness":
    case "project.sketches":
    case "object.get":
    case "object.measurements":
    case "project.extents":
    case "sketch.get":
    case "sketch.editReadiness":
    case "sketch.solverStatus":
    case "sketch.evaluation":
    case "sketch.dimensions":
    case "sketch.dimension.get":
    case "body.generatedReferences":
    case "body.resolveGeneratedReference":
    case "body.topology":
    case "body.topologyIdentity":
    case "body.measurements":
    case "body.generatedReferenceMeasurements":
    case "reference.listNamed":
    case "reference.resolveNamed":
    case "reference.health":
    case "selection.referenceCandidates":
    case "transaction.history":
      return true;
  }

  return false;
}

function isCadQuery(value: unknown): boolean {
  if (!isRecord(value) || typeof value.query !== "string") {
    return false;
  }

  switch (value.query) {
    case "parameter.list":
    case "project.summary":
    case "project.features":
    case "project.structure":
    case "project.topologyIdentityReadiness":
    case "project.exportReadiness":
    case "project.packageReadiness":
    case "project.sketches":
    case "reference.listNamed":
    case "transaction.history":
      return Object.keys(value).length === 1;
    case "project.dependencyGraph":
    case "project.rebuildPlan":
      return (
        Object.keys(value).every((key) =>
          ["query", "topologyMatchResults"].includes(key)
        ) && isOptionalTopologyMatchResults(value.topologyMatchResults)
      );
    case "topology.matchSnapshots":
      return (
        isCadTopologyMatchSnapshotInput(value.previous) &&
        Array.isArray(value.candidates) &&
        value.candidates.every(isCadTopologyMatchSnapshotInput)
      );
    case "topology.anchorRepairCandidates":
      return (
        isCadTopologyMatchSnapshotInput(value.previous) &&
        Array.isArray(value.candidates) &&
        value.candidates.every(isCadTopologyMatchSnapshotInput) &&
        (value.anchorIds === undefined ||
          (Array.isArray(value.anchorIds) &&
            value.anchorIds.every((anchorId) => typeof anchorId === "string")))
      );
    case "topology.anchorCommandReadiness":
      return (
        typeof value.anchorId === "string" &&
        isCadTopologyMatchSnapshotInput(value.snapshot) &&
        (value.requiredOperation === undefined ||
          isCadSelectionReferenceOperation(value.requiredOperation))
      );
    case "topology.commandTargetReadiness":
      return (
        isCadSelectionReferenceInput(value.target) &&
        (value.desiredOperation === undefined ||
          isCadSelectionReferenceOperation(value.desiredOperation)) &&
        (value.snapshot === undefined ||
          isCadTopologyMatchSnapshotInput(value.snapshot)) &&
        isOptionalTopologyMatchResults(value.topologyMatchResults)
      );
    case "topology.anchorCreationPlan":
      return (
        typeof value.bodyId === "string" &&
        typeof value.stableId === "string" &&
        (value.checkpointId === undefined ||
          typeof value.checkpointId === "string") &&
        (value.anchorId === undefined || typeof value.anchorId === "string") &&
        (value.derivedExactMetadata === undefined ||
          isCadBodyDerivedExactMetadataSnapshot(value.derivedExactMetadata))
      );
    case "topology.anchorRepairPlan":
      return (
        typeof value.anchorId === "string" &&
        (value.replacementCheckpointId === undefined ||
          typeof value.replacementCheckpointId === "string") &&
        (value.createReplacementCheckpoint === undefined ||
          typeof value.createReplacementCheckpoint === "boolean") &&
        (typeof value.replacementCheckpointId === "string" ||
          value.createReplacementCheckpoint === true) &&
        (value.selectedRepairCandidateId === undefined ||
          typeof value.selectedRepairCandidateId === "string") &&
        (value.repairId === undefined || typeof value.repairId === "string") &&
        isCadBodyDerivedExactMetadataSnapshot(value.derivedExactMetadata)
      );
    case "project.exportExact":
      return isProjectExactExportQuery(value);
    case "project.health":
      return (
        Object.keys(value).length === 1 ||
        (Object.keys(value).length === 2 &&
          Array.isArray(value.derivedExactMetadata) &&
          value.derivedExactMetadata.every((snapshot) =>
            isCadBodyDerivedExactMetadataSnapshot(snapshot)
          ))
      );
    case "project.extents":
      return (
        Object.keys(value).length === 1 ||
        (Object.keys(value).length === 2 &&
          Array.isArray(value.derivedExactMetadata) &&
          value.derivedExactMetadata.every((snapshot) =>
            isCadBodyDerivedExactMetadataSnapshot(snapshot)
          ))
      );
    case "parameter.get":
      return typeof value.id === "string";
    case "feature.editability":
      return (
        typeof value.featureId === "string" &&
        (value.proposedEdit === undefined ||
          isCadFeatureEditProposal(value.proposedEdit)) &&
        isOptionalTopologyMatchResults(value.topologyMatchResults)
      );
    case "object.get":
    case "object.measurements":
    case "sketch.get":
    case "sketch.dimension.get":
      return typeof value.id === "string";
    case "sketch.editReadiness":
      return isCadSketchEditProposal(value.edit);
    case "sketch.solverStatus":
    case "sketch.evaluation":
    case "sketch.dimensions":
      return typeof value.sketchId === "string";
    case "body.generatedReferences":
    case "body.measurements":
      return typeof value.bodyId === "string";
    case "body.topology":
      return (
        typeof value.bodyId === "string" &&
        (value.derivedExactMetadata === undefined ||
          isCadBodyDerivedExactMetadataSnapshot(value.derivedExactMetadata))
      );
    case "body.topologyIdentity":
      return (
        typeof value.bodyId === "string" &&
        (value.checkpointId === undefined ||
          typeof value.checkpointId === "string") &&
        (value.derivedExactMetadata === undefined ||
          isCadBodyDerivedExactMetadataSnapshot(value.derivedExactMetadata))
      );
    case "body.resolveGeneratedReference":
    case "body.generatedReferenceMeasurements":
      return (
        typeof value.bodyId === "string" && typeof value.stableId === "string"
      );
    case "reference.resolveNamed":
      return typeof value.name === "string";
    case "reference.health":
      return (
        Object.keys(value).every((key) =>
          ["query", "target", "topologyMatchResults"].includes(key)
        ) &&
        (value.target === undefined ||
          isCadReferenceHealthTarget(value.target)) &&
        isOptionalTopologyMatchResults(value.topologyMatchResults)
      );
    case "selection.referenceCandidates":
      return (
        isCadSelectionReferenceInput(value.selection) &&
        isOptionalTopologyMatchResults(value.topologyMatchResults) &&
        (value.requiredOperation === undefined ||
          isCadSelectionReferenceOperation(value.requiredOperation))
      );
    default:
      return false;
  }
}

function isCadTopologyMatchSnapshotInput(
  value: unknown
): value is CadTopologyMatchSnapshotInput {
  return (
    isRecord(value) &&
    (value.snapshotId === undefined || typeof value.snapshotId === "string") &&
    (value.checkpointId === undefined ||
      typeof value.checkpointId === "string") &&
    typeof value.bodyId === "string" &&
    (value.sourceFeatureId === undefined ||
      typeof value.sourceFeatureId === "string") &&
    (value.sourceIdentity === undefined ||
      (isRecord(value.sourceIdentity) &&
        value.sourceIdentity.algorithm === WCAD_SOURCE_IDENTITY_ALGORITHM &&
        typeof value.sourceIdentity.sha256 === "string" &&
        SHA256_HEX_PATTERN.test(value.sourceIdentity.sha256))) &&
    isCadBodyExactTopologySnapshot(value.topologySnapshot)
  );
}

function isOptionalTopologyMatchResults(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every(isCadTopologyMatchResult))
  );
}

function isCadTopologyMatchResult(
  value: unknown
): value is CadTopologyMatchResult {
  return (
    isRecord(value) &&
    (value.anchorId === undefined || typeof value.anchorId === "string") &&
    (value.previousStableId === undefined ||
      typeof value.previousStableId === "string") &&
    (value.candidateStableId === undefined ||
      typeof value.candidateStableId === "string") &&
    isTopologyEntityKind(value.entityKind) &&
    isTopologyIdentityState(value.state) &&
    isTopologyMatchConfidence(value.confidence) &&
    typeof value.evidenceCount === "number" &&
    Array.isArray(value.evidence) &&
    typeof value.diagnosticCount === "number" &&
    Array.isArray(value.diagnostics)
  );
}

function isTopologyEntityKind(value: unknown): boolean {
  return (
    value === "body" ||
    value === "face" ||
    value === "edge" ||
    value === "vertex" ||
    value === "axis" ||
    value === "loop" ||
    value === "wire" ||
    value === "coedge"
  );
}

function isTopologyAnchorEntityKind(value: unknown): boolean {
  return (
    value === "body" ||
    value === "face" ||
    value === "edge" ||
    value === "vertex" ||
    value === "axis"
  );
}

function isTopologyIdentityState(value: unknown): boolean {
  return (
    value === "active" ||
    value === "replaced" ||
    value === "split" ||
    value === "merged" ||
    value === "consumed" ||
    value === "deleted" ||
    value === "ambiguous" ||
    value === "stale" ||
    value === "missing" ||
    value === "repair-needed" ||
    value === "unsupported" ||
    value === "failed" ||
    value === "deferred"
  );
}

function isTopologyCheckpointStatus(value: unknown): boolean {
  return (
    value === "active" ||
    value === "stale" ||
    value === "missing" ||
    value === "failed" ||
    value === "unsupported"
  );
}

function isTopologyMatchConfidence(value: unknown): boolean {
  return (
    value === "none" ||
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "exact"
  );
}

function isTopologyMatchEvidenceShape(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.kind === "string" &&
    isTopologyMatchConfidence(value.confidence) &&
    typeof value.message === "string" &&
    (value.weight === undefined || typeof value.weight === "number")
  );
}

function isTopologyIdentityDiagnosticShape(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    (value.status === "supported" ||
      value.status === "deferred" ||
      value.status === "unsupported") &&
    (value.severity === "info" ||
      value.severity === "warning" ||
      value.severity === "error") &&
    typeof value.message === "string"
  );
}

function isCadFeatureEditProposal(value: unknown): boolean {
  if (!isRecord(value) || typeof value.kind !== "string") {
    return false;
  }

  if (value.kind === "extrude") {
    return (
      Object.keys(value).every((key) =>
        ["kind", "depth", "side"].includes(key)
      ) &&
      (value.depth === undefined || typeof value.depth === "number") &&
      (value.side === undefined ||
        value.side === "positive" ||
        value.side === "negative" ||
        value.side === "symmetric")
    );
  }

  if (value.kind === "revolve") {
    return (
      Object.keys(value).every((key) =>
        ["kind", "angleDegrees"].includes(key)
      ) &&
      (value.angleDegrees === undefined ||
        typeof value.angleDegrees === "number")
    );
  }

  if (value.kind === "hole") {
    return (
      Object.keys(value).every((key) =>
        ["kind", "depthMode", "depth", "direction"].includes(key)
      ) &&
      (value.depthMode === undefined || isHoleDepthMode(value.depthMode)) &&
      (value.depth === undefined || typeof value.depth === "number") &&
      (value.direction === undefined || isHoleDirection(value.direction))
    );
  }

  if (value.kind === "chamfer") {
    return (
      Object.keys(value).every((key) => ["kind", "distance"].includes(key)) &&
      (value.distance === undefined || typeof value.distance === "number")
    );
  }

  if (value.kind === "fillet") {
    return (
      Object.keys(value).every((key) => ["kind", "radius"].includes(key)) &&
      (value.radius === undefined || typeof value.radius === "number")
    );
  }

  return false;
}

function isCadSketchEditProposal(value: unknown): boolean {
  if (!isRecord(value) || typeof value.editKind !== "string") {
    return false;
  }

  if (value.editKind === "entity.dimension.update") {
    return (
      typeof value.sketchId === "string" &&
      typeof value.entityId === "string" &&
      isSketchDimensionTarget(value.target) &&
      typeof value.value === "number"
    );
  }

  if (value.editKind === "sketch.dimension.create") {
    return (
      (value.id === undefined || typeof value.id === "string") &&
      typeof value.name === "string" &&
      typeof value.sketchId === "string" &&
      typeof value.entityId === "string" &&
      isSketchDimensionTarget(value.target) &&
      ((typeof value.value === "number" && value.parameterId === undefined) ||
        (value.value === undefined && typeof value.parameterId === "string"))
    );
  }

  if (value.editKind === "sketch.dimension.update") {
    return (
      typeof value.id === "string" &&
      ((typeof value.value === "number" && value.parameterId === undefined) ||
        (value.value === undefined && typeof value.parameterId === "string"))
    );
  }

  if (value.editKind === "sketch.dimension.delete") {
    return typeof value.id === "string";
  }

  if (value.editKind === "sketch.constraint.create") {
    return isSketchConstraintCreateEditProposal(value);
  }

  if (value.editKind === "sketch.constraint.delete") {
    return typeof value.id === "string";
  }

  return false;
}

function isSketchConstraintCreateEditProposal(value: {
  readonly [key: string]: unknown;
}): boolean {
  if (
    typeof value.name !== "string" ||
    typeof value.sketchId !== "string" ||
    typeof value.kind !== "string" ||
    (value.id !== undefined && typeof value.id !== "string")
  ) {
    return false;
  }

  if (value.kind === "horizontal" || value.kind === "vertical") {
    return typeof value.entityId === "string";
  }

  if (value.kind === "fixed") {
    return (
      isSketchPointTarget(value.target) &&
      (value.coordinate === undefined || isVec2(value.coordinate))
    );
  }

  if (value.kind === "coincident") {
    return (
      isSketchPointTarget(value.primaryTarget) &&
      isSketchPointTarget(value.secondaryTarget)
    );
  }

  if (value.kind === "midpoint") {
    return (
      typeof value.lineEntityId === "string" &&
      isSketchPointTarget(value.target)
    );
  }

  if (value.kind === "parallel" || value.kind === "perpendicular") {
    return (
      typeof value.primaryLineEntityId === "string" &&
      typeof value.secondaryLineEntityId === "string"
    );
  }

  return false;
}

function isCadReferenceHealthTarget(value: unknown): boolean {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  switch (value.type) {
    case "all":
      return Object.keys(value).length === 1;
    case "body":
      return typeof value.bodyId === "string";
    case "generatedReference":
      return (
        typeof value.bodyId === "string" &&
        typeof value.stableId === "string" &&
        (value.expectedKind === undefined ||
          isGeneratedEntityKind(value.expectedKind))
      );
    case "namedReference":
      return typeof value.name === "string";
    case "topologyAnchor":
      return typeof value.anchorId === "string";
    default:
      return false;
  }
}

function isProjectExactExportQuery(value: Record<string, unknown>): boolean {
  const allowedKeys = ["query", "format", "bodyIds", "sourceIdentity"];

  return (
    value.query === "project.exportExact" &&
    value.format === "step" &&
    Object.keys(value).every((key) => allowedKeys.includes(key)) &&
    (value.bodyIds === undefined ||
      (Array.isArray(value.bodyIds) &&
        value.bodyIds.every((bodyId) => typeof bodyId === "string"))) &&
    (value.sourceIdentity === undefined ||
      isWcadSourceIdentityInput(value.sourceIdentity))
  );
}

function isWcadSourceIdentityInput(
  value: unknown
): value is WcadSourceIdentity {
  return (
    isRecord(value) &&
    Object.keys(value).length === 2 &&
    value.algorithm === WCAD_SOURCE_IDENTITY_ALGORITHM &&
    typeof value.sha256 === "string" &&
    SHA256_HEX_PATTERN.test(value.sha256)
  );
}

function isCadSelectionReferenceInput(
  value: unknown
): value is CadSelectionReferenceInput {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  switch (value.type) {
    case "body":
      return typeof value.bodyId === "string";
    case "generatedReference":
      return (
        typeof value.bodyId === "string" &&
        typeof value.stableId === "string" &&
        (value.expectedKind === undefined ||
          isGeneratedEntityKind(value.expectedKind))
      );
    case "namedReference":
      return typeof value.name === "string";
    case "topologyAnchor":
      return typeof value.anchorId === "string";
    default:
      return false;
  }
}

function isCadSelectionReferenceOperation(
  value: unknown
): value is CadSelectionReferenceOperation {
  return (
    value === "reference.nameGenerated" ||
    value === "feature.extrudeCutTarget" ||
    value === "feature.extrudeAddTarget" ||
    value === "feature.attachSketchPlane" ||
    value === "feature.chamfer" ||
    value === "feature.fillet" ||
    value === "feature.measureReference" ||
    value === "feature.selectReference"
  );
}

function isCadBodyDerivedExactMetadataSnapshot(
  value: unknown
): value is CadBodyDerivedExactMetadataSnapshot {
  if (
    !isRecord(value) ||
    typeof value.bodyId !== "string" ||
    typeof value.sourceIdentitySignature !== "string" ||
    !isCadBodyDerivedExactMetadataStatus(value.status)
  ) {
    return false;
  }

  return (
    (value.metadata === undefined ||
      isCadBodyExactMetadataSnapshotWithoutStatus(value.metadata)) &&
    (value.error === undefined || isCadBodyExactMetadataDiagnostic(value.error))
  );
}

function isCadBodyDerivedExactMetadataStatus(
  value: unknown
): value is CadBodyDerivedExactMetadataSnapshot["status"] {
  return (
    value === "ready" ||
    value === "unsupported" ||
    value === "stale" ||
    value === "kernel-failed" ||
    value === "unavailable-binding"
  );
}

function isCadBodyExactMetadataSnapshotWithoutStatus(
  value: unknown
): value is Omit<CadBodyExactMetadataSnapshot, "status"> {
  return (
    isRecord(value) &&
    value.source === "kernel-derived" &&
    value.confidence === "kernel-derived" &&
    (value.bounds === undefined || isCadAxisAlignedBounds(value.bounds)) &&
    (value.volume === undefined ||
      (typeof value.volume === "number" && Number.isFinite(value.volume))) &&
    (value.surfaceArea === undefined ||
      (typeof value.surfaceArea === "number" &&
        Number.isFinite(value.surfaceArea))) &&
    (value.centroid === undefined || isVec3(value.centroid)) &&
    (value.topologyCounts === undefined ||
      isCadBodyExactMetadataTopologyCounts(value.topologyCounts)) &&
    (value.topologySnapshot === undefined ||
      isCadBodyExactTopologySnapshot(value.topologySnapshot)) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isCadBodyExactMetadataDiagnostic)
  );
}

function isCadAxisAlignedBounds(value: unknown): boolean {
  return (
    isRecord(value) &&
    isVec3(value.min) &&
    isVec3(value.max) &&
    isVec3(value.size) &&
    isVec3(value.center)
  );
}

function isCadBodyExactMetadataTopologyCounts(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.solidCount === "number" &&
    Number.isInteger(value.solidCount) &&
    value.solidCount >= 0 &&
    typeof value.faceCount === "number" &&
    Number.isInteger(value.faceCount) &&
    value.faceCount >= 0 &&
    (value.wireCount === undefined ||
      (typeof value.wireCount === "number" &&
        Number.isInteger(value.wireCount) &&
        value.wireCount >= 0)) &&
    typeof value.edgeCount === "number" &&
    Number.isInteger(value.edgeCount) &&
    value.edgeCount >= 0 &&
    typeof value.vertexCount === "number" &&
    Number.isInteger(value.vertexCount) &&
    value.vertexCount >= 0
  );
}

function isCadBodyExactTopologySnapshot(
  value: unknown
): value is CadBodyExactTopologySnapshot {
  if (
    !isRecord(value) ||
    value.source !== "kernel-derived" ||
    (value.status !== "ready" && value.status !== "partial") ||
    !isCadBodyExactTopologyEntityCounts(value.entityCounts) ||
    typeof value.entityCount !== "number" ||
    !Number.isInteger(value.entityCount) ||
    value.entityCount < 0 ||
    !Array.isArray(value.entities) ||
    value.entities.length !== value.entityCount ||
    !value.entities.every(isCadBodyExactTopologyEntityDescriptor) ||
    !Array.isArray(value.unsupportedEntityKinds) ||
    !value.unsupportedEntityKinds.every(isCadBodyExactTopologyEntityKind) ||
    typeof value.adjacencyAvailable !== "boolean" ||
    value.signatureAlgorithm !== "partbench-derived-topology-snapshot-v1" ||
    typeof value.signature !== "string" ||
    !Array.isArray(value.diagnostics) ||
    !value.diagnostics.every(isCadBodyExactMetadataDiagnostic)
  ) {
    return false;
  }

  const counts = value.entityCounts;
  const entities =
    value.entities as readonly CadBodyExactTopologyEntityDescriptor[];
  const entityKindCounts = countExactTopologyEntitiesByKind(entities);
  const ids = new Set<string>();

  for (const entity of entities) {
    if (ids.has(entity.localId)) {
      return false;
    }

    ids.add(entity.localId);
  }

  return (
    value.entityCount ===
      counts.bodyCount +
        counts.solidCount +
        counts.faceCount +
        counts.wireCount +
        counts.edgeCount +
        counts.vertexCount +
        counts.loopCount +
        counts.coedgeCount +
        counts.axisCount &&
    entityKindCounts.body === counts.bodyCount &&
    entityKindCounts.solid === counts.solidCount &&
    entityKindCounts.face === counts.faceCount &&
    entityKindCounts.wire === counts.wireCount &&
    entityKindCounts.edge === counts.edgeCount &&
    entityKindCounts.vertex === counts.vertexCount &&
    entityKindCounts.loop === counts.loopCount &&
    entityKindCounts.coedge === counts.coedgeCount &&
    entityKindCounts.axis === counts.axisCount
  );
}

function countExactTopologyEntitiesByKind(
  entities: readonly CadBodyExactTopologyEntityDescriptor[]
): Record<CadBodyExactTopologyEntityDescriptor["kind"], number> {
  const counts = {
    body: 0,
    solid: 0,
    face: 0,
    wire: 0,
    edge: 0,
    vertex: 0,
    loop: 0,
    coedge: 0,
    axis: 0
  } satisfies Record<CadBodyExactTopologyEntityDescriptor["kind"], number>;

  for (const entity of entities) {
    counts[entity.kind] += 1;
  }

  return counts;
}

function isCadBodyExactTopologyEntityCounts(value: unknown): value is {
  readonly bodyCount: number;
  readonly solidCount: number;
  readonly faceCount: number;
  readonly wireCount: number;
  readonly edgeCount: number;
  readonly vertexCount: number;
  readonly loopCount: number;
  readonly coedgeCount: number;
  readonly axisCount: number;
} {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.bodyCount) &&
    isNonNegativeInteger(value.solidCount) &&
    isNonNegativeInteger(value.faceCount) &&
    isNonNegativeInteger(value.wireCount) &&
    isNonNegativeInteger(value.edgeCount) &&
    isNonNegativeInteger(value.vertexCount) &&
    isNonNegativeInteger(value.loopCount) &&
    isNonNegativeInteger(value.coedgeCount) &&
    isNonNegativeInteger(value.axisCount)
  );
}

function isCadBodyExactTopologyEntityDescriptor(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.localId === "string" &&
    value.localId.trim().length > 0 &&
    isCadBodyExactTopologyEntityKind(value.kind) &&
    value.source === "kernel-derived" &&
    typeof value.signature === "string" &&
    value.signature.trim().length > 0 &&
    (value.bounds === undefined || isCadTopologyEntityBounds(value.bounds)) &&
    (value.surfaceClass === undefined ||
      isCadTopologySurfaceClass(value.surfaceClass)) &&
    (value.curveClass === undefined ||
      isCadTopologyCurveClass(value.curveClass)) &&
    (value.point === undefined || isVec3(value.point)) &&
    (value.midpoint === undefined || isVec3(value.midpoint)) &&
    (value.normal === undefined || isVec3(value.normal)) &&
    (value.axis === undefined || isVec3(value.axis)) &&
    (value.radius === undefined || isNonNegativeFinite(value.radius)) &&
    (value.area === undefined || isNonNegativeFinite(value.area)) &&
    (value.length === undefined || isNonNegativeFinite(value.length)) &&
    (value.adjacency === undefined ||
      isCadTopologyEntityAdjacencyEvidence(value.adjacency)) &&
    (value.orientation === undefined ||
      isCadTopologyOrientation(value.orientation)) &&
    (value.loopRole === undefined || isCadTopologyLoopRole(value.loopRole)) &&
    (value.relationships === undefined ||
      isCadTopologyEntityRelationshipEvidence(value.relationships)) &&
    isCadTopologyEntityDescriptorEvidenceForKind(value)
  );
}

function isCadTopologyEntityDescriptorEvidenceForKind(
  value: Record<string, unknown>
): boolean {
  switch (value.kind) {
    case "loop":
      return (
        value.surfaceClass === undefined &&
        value.curveClass === undefined &&
        value.point === undefined &&
        value.midpoint === undefined &&
        value.normal === undefined &&
        value.axis === undefined &&
        value.radius === undefined &&
        value.area === undefined &&
        value.length === undefined
      );
    case "face":
      return (
        value.curveClass === undefined &&
        value.point === undefined &&
        value.midpoint === undefined &&
        value.length === undefined &&
        value.loopRole === undefined
      );
    case "edge":
      return (
        value.surfaceClass === undefined &&
        value.point === undefined &&
        value.normal === undefined &&
        value.area === undefined &&
        value.loopRole === undefined
      );
    case "vertex":
      return (
        value.surfaceClass === undefined &&
        value.curveClass === undefined &&
        value.midpoint === undefined &&
        value.normal === undefined &&
        value.axis === undefined &&
        value.radius === undefined &&
        value.area === undefined &&
        value.length === undefined &&
        value.loopRole === undefined
      );
    case "axis":
      return (
        value.surfaceClass === undefined &&
        value.curveClass === undefined &&
        value.midpoint === undefined &&
        value.normal === undefined &&
        value.radius === undefined &&
        value.area === undefined &&
        value.length === undefined &&
        value.loopRole === undefined
      );
    default:
      return (
        value.surfaceClass === undefined &&
        value.curveClass === undefined &&
        value.point === undefined &&
        value.midpoint === undefined &&
        value.normal === undefined &&
        value.axis === undefined &&
        value.radius === undefined &&
        value.area === undefined &&
        value.length === undefined &&
        value.loopRole === undefined
      );
  }
}

function isCadTopologySurfaceClass(value: unknown): boolean {
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

function isCadTopologyCurveClass(value: unknown): boolean {
  return (
    value === "line" ||
    value === "circle" ||
    value === "ellipse" ||
    value === "bspline" ||
    value === "unknown"
  );
}

function isCadTopologyOrientation(value: unknown): boolean {
  return (
    value === "forward" ||
    value === "reversed" ||
    value === "internal" ||
    value === "external" ||
    value === "unknown"
  );
}

function isCadTopologyLoopRole(value: unknown): boolean {
  return value === "outer" || value === "inner" || value === "unknown";
}

function isCadTopologyEntityAdjacencyEvidence(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.available === "boolean" &&
    Array.isArray(value.neighborSignatureHashes) &&
    value.neighborSignatureHashes.every(
      (hash) => typeof hash === "string" && hash.trim().length > 0
    )
  );
}

function isCadTopologyEntityRelationshipEvidence(value: unknown): boolean {
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

function isCadTopologyEntityBounds(value: unknown): boolean {
  if (!isRecord(value) || !isVec3(value.min) || !isVec3(value.max)) {
    return false;
  }

  const min = value.min;
  const max = value.max;

  return (
    min.every(Number.isFinite) &&
    max.every(Number.isFinite) &&
    min.every((component, index) => component <= max[index])
  );
}

function isCadBodyExactTopologyEntityKind(value: unknown): boolean {
  return (
    value === "body" ||
    value === "solid" ||
    value === "face" ||
    value === "wire" ||
    value === "edge" ||
    value === "vertex" ||
    value === "loop" ||
    value === "coedge" ||
    value === "axis"
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isCadBodyExactMetadataDiagnostic(
  value: unknown
): value is { readonly code: string; readonly message: string } {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    typeof value.message === "string"
  );
}

function addParameter(
  parameters: Map<ParameterId, CadParameter>,
  parameter: CadParameter,
  diff: MutableSemanticDiff,
  opIndex: number
): void {
  if (parameter.id.length === 0) {
    throwValidationError({
      code: "INVALID_PARAMETER",
      message: "Parameter id must be a non-empty string.",
      opIndex,
      parameterId: parameter.id,
      path: operationPath(opIndex, "id"),
      expected: "non-empty parameter id",
      received: parameter.id
    });
  }

  if (parameters.has(parameter.id)) {
    throwValidationError({
      code: "PARAMETER_ALREADY_EXISTS",
      message: `Parameter already exists: ${parameter.id}`,
      opIndex,
      parameterId: parameter.id,
      path: operationPath(opIndex, "id"),
      expected: "unique parameter id",
      received: parameter.id
    });
  }

  parameters.set(parameter.id, parameter);
  pushParameterCreated(diff, parameterRef(parameter));
}

function getParameterOrThrow(
  parameters: ReadonlyMap<ParameterId, CadParameter>,
  id: ParameterId,
  opIndex: number
): CadParameter {
  const parameter = parameters.get(id);

  if (!parameter) {
    throwValidationError({
      code: "PARAMETER_NOT_FOUND",
      message: `Parameter does not exist: ${id}`,
      opIndex,
      parameterId: id,
      path: operationPath(opIndex, "id"),
      expected: "existing parameter id",
      received: id
    });
  }

  return parameter;
}

function normalizeParameterName(
  value: string,
  opIndex: number,
  id?: ParameterId
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throwValidationError({
      code: "INVALID_PARAMETER_NAME",
      message: "Parameter name must be non-empty.",
      opIndex,
      parameterId: id,
      path: operationPath(opIndex, "name"),
      expected: "non-empty parameter name",
      received: describeReceived(value)
    });
  }

  return value.trim();
}

function normalizeOptionalDescription(value: string, opIndex: number): string {
  if (typeof value !== "string" || value.trim() === "") {
    throwValidationError({
      code: "INVALID_PARAMETER",
      message: "Parameter description must be non-empty when provided.",
      opIndex,
      path: operationPath(opIndex, "description"),
      expected: "non-empty description",
      received: describeReceived(value)
    });
  }

  return value.trim();
}

function normalizeParameterUpdateDescription(
  value: string,
  opIndex: number
): string | undefined {
  if (typeof value !== "string") {
    throwValidationError({
      code: "INVALID_PARAMETER",
      message: "Parameter description must be a string when provided.",
      opIndex,
      path: operationPath(opIndex, "description"),
      expected: "string description",
      received: describeReceived(value)
    });
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function validateFiniteParameterValue(
  value: number,
  opIndex: number,
  field: string
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throwValidationError({
      code: "INVALID_PARAMETER",
      message: "Parameter value must be a finite number.",
      opIndex,
      path: operationPath(opIndex, field),
      expected: "finite number",
      received: describeReceived(value)
    });
  }

  return cleanMeasurementNumber(value);
}

function assertParameterUpdateHasChanges(
  op: Extract<CadOp, { readonly op: "parameter.update" }>,
  opIndex: number
): void {
  if (op.value !== undefined || op.description !== undefined) {
    return;
  }

  throwValidationError({
    code: "INVALID_PARAMETER",
    message: "parameter.update must include value or description.",
    opIndex,
    parameterId: op.id,
    path: operationPath(opIndex),
    expected: "value or description",
    received: "no editable fields"
  });
}

function assertParameterNotInUse(
  dimensions: ReadonlyMap<SketchDimensionId, SketchDimension>,
  parameterId: ParameterId,
  opIndex: number
): void {
  const dependent = [...dimensions.values()].find(
    (dimension) =>
      dimension.valueSource.type === "parameter" &&
      dimension.valueSource.parameterId === parameterId
  );

  if (!dependent) {
    return;
  }

  throwValidationError({
    code: "PARAMETER_IN_USE",
    message: `Parameter is used by sketch dimension ${dependent.id}.`,
    opIndex,
    parameterId,
    sketchDimensionId: dependent.id,
    path: operationPath(opIndex, "id"),
    expected: "unused parameter",
    received: parameterId
  });
}

function addSketchDimension(
  dimensions: Map<SketchDimensionId, SketchDimension>,
  dimension: SketchDimension,
  diff: MutableSemanticDiff,
  opIndex: number
): void {
  if (dimension.id.length === 0) {
    throwValidationError({
      code: "INVALID_SKETCH_DIMENSION",
      message: "Sketch dimension id must be a non-empty string.",
      opIndex,
      sketchDimensionId: dimension.id,
      path: operationPath(opIndex, "id"),
      expected: "non-empty sketch dimension id",
      received: dimension.id
    });
  }

  if (dimensions.has(dimension.id)) {
    throwValidationError({
      code: "SKETCH_DIMENSION_ALREADY_EXISTS",
      message: `Sketch dimension already exists: ${dimension.id}`,
      opIndex,
      sketchDimensionId: dimension.id,
      path: operationPath(opIndex, "id"),
      expected: "unique sketch dimension id",
      received: dimension.id
    });
  }

  assertSketchDimensionTargetAvailable(dimensions, dimension, opIndex);
  dimensions.set(dimension.id, dimension);
  pushSketchDimensionCreated(diff, sketchDimensionRef(dimension));
}

function assertSketchDimensionTargetAvailable(
  dimensions: ReadonlyMap<SketchDimensionId, SketchDimension>,
  dimension: SketchDimension,
  opIndex: number
): void {
  const conflicting = [...dimensions.values()].find(
    (existing) =>
      existing.id !== dimension.id &&
      getSketchDimensionTargetKey(existing) ===
        getSketchDimensionTargetKey(dimension)
  );

  if (!conflicting) {
    return;
  }

  throwValidationError({
    code: "INVALID_SKETCH_DIMENSION",
    message: `Sketch dimension target is already driven by ${conflicting.id}.`,
    opIndex,
    sketchId: dimension.sketchId,
    sketchEntityId: dimension.entityId,
    sketchDimensionId: dimension.id,
    path: operationPath(opIndex, "target"),
    expected: "undriven sketch dimension target",
    received: conflicting.id
  });
}

function getSketchDimensionTargetKey(
  dimension: Pick<SketchDimension, "sketchId" | "entityId" | "target">
): string {
  return [
    dimension.sketchId,
    dimension.entityId,
    dimension.target.entityKind,
    dimension.target.role
  ].join("\0");
}

function getSketchDimensionOrThrow(
  dimensions: ReadonlyMap<SketchDimensionId, SketchDimension>,
  id: SketchDimensionId,
  opIndex: number
): SketchDimension {
  const dimension = dimensions.get(id);

  if (!dimension) {
    throwValidationError({
      code: "SKETCH_DIMENSION_NOT_FOUND",
      message: `Sketch dimension does not exist: ${id}`,
      opIndex,
      sketchDimensionId: id,
      path: operationPath(opIndex, "id"),
      expected: "existing sketch dimension id",
      received: id
    });
  }

  return dimension;
}

function normalizeSketchDimensionName(
  value: string,
  opIndex: number,
  id?: SketchDimensionId
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throwValidationError({
      code: "INVALID_SKETCH_DIMENSION_NAME",
      message: "Sketch dimension name must be non-empty.",
      opIndex,
      sketchDimensionId: id,
      path: operationPath(opIndex, "name"),
      expected: "non-empty sketch dimension name",
      received: describeReceived(value)
    });
  }

  return value.trim();
}

function createSketchDimensionValueSource(
  op: Extract<
    CadOp,
    {
      readonly op: "sketch.dimension.create" | "sketch.dimension.update";
    }
  >,
  opIndex: number
): SketchDimensionValueSource {
  const hasLiteral = op.value !== undefined;
  const hasParameter = op.parameterId !== undefined;

  if (hasLiteral === hasParameter) {
    throwValidationError({
      code: "INVALID_SKETCH_DIMENSION",
      message:
        "Sketch dimension value source must include exactly one of value or parameterId.",
      opIndex,
      sketchDimensionId: "id" in op ? op.id : undefined,
      path: operationPath(opIndex),
      expected: "value or parameterId",
      received: hasLiteral && hasParameter ? "both" : "neither"
    });
  }

  if (hasParameter) {
    return {
      type: "parameter",
      parameterId: op.parameterId
    };
  }

  return {
    type: "literal",
    value: validatePositiveDimensionValue(op.value, opIndex, "value")
  };
}

function validatePositiveDimensionValue(
  value: unknown,
  opIndex: number,
  field: string
): number {
  if (typeof value !== "number" || !isPositiveFiniteNumber(value)) {
    throwValidationError({
      code: "INVALID_SKETCH_DIMENSION",
      message: "Sketch dimension value must be a positive finite number.",
      opIndex,
      path: operationPath(opIndex, field),
      expected: "positive finite number",
      received: describeReceived(value)
    });
  }

  return cleanMeasurementNumber(value);
}

function validateSketchDimensionTarget(
  state: MutableDocumentState,
  op: Extract<CadOp, { readonly op: "sketch.dimension.create" }>,
  opIndex: number
): SketchDimensionTarget {
  const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
  const entity = sketch.entities.get(op.entityId);

  if (!entity) {
    throwSketchEntityNotFound(op.sketchId, op.entityId, opIndex);
  }

  if (!isSupportedSketchDimensionTarget(op.target, entity)) {
    throwValidationError({
      code: "INVALID_SKETCH_DIMENSION",
      message: "Sketch dimension target is not supported for this entity.",
      opIndex,
      sketchId: op.sketchId,
      sketchEntityId: op.entityId,
      path: operationPath(opIndex, "target"),
      expected: `supported target for ${entity.kind}`,
      received: describeReceived(op.target)
    });
  }

  return op.target;
}

function applySketchDimensionToEntity(
  state: MutableDocumentState,
  dimension: SketchDimension,
  diff: MutableSemanticDiff,
  opIndex: number
): void {
  const value = resolveSketchDimensionValueOrThrow(state, dimension, opIndex);
  const sketch = getSketchOrThrow(state.sketches, dimension.sketchId, opIndex);
  const existing = sketch.entities.get(dimension.entityId);

  if (!existing) {
    throwSketchEntityNotFound(dimension.sketchId, dimension.entityId, opIndex);
  }

  const result = applySketchDimensionValue(
    existing,
    dimension,
    value,
    createSketchSolverApplyContext(state, sketch)
  );

  if (!result.ok) {
    throwSketchSolverApplyIssue(result.issue, opIndex);
  }

  const entity = result.entity;
  assertFixedConstraintsRemainSatisfied(
    state.sketchConstraints,
    dimension.sketchId,
    existing,
    entity,
    opIndex
  );
  updateSketchEntityAndDependents(state, sketch, entity, diff, opIndex);
}

function reevaluateParameterDimensions(
  state: MutableDocumentState,
  parameterId: ParameterId,
  diff: MutableSemanticDiff,
  opIndex: number
): void {
  for (const dimension of state.sketchDimensions.values()) {
    if (
      dimension.valueSource.type === "parameter" &&
      dimension.valueSource.parameterId === parameterId
    ) {
      applySketchDimensionToEntity(state, dimension, diff, opIndex);
    }
  }
}

function resolveSketchDimensionValueOrThrow(
  state: MutableDocumentState,
  dimension: SketchDimension,
  opIndex: number
): number {
  if (dimension.valueSource.type === "literal") {
    return validatePositiveDimensionValue(
      dimension.valueSource.value,
      opIndex,
      "value"
    );
  }

  const parameter = getParameterOrThrow(
    state.parameters,
    dimension.valueSource.parameterId,
    opIndex
  );
  return validatePositiveDimensionValue(parameter.value, opIndex, "value");
}

function assertSketchDimensionTargetsStillValid(
  dimensions: ReadonlyMap<SketchDimensionId, SketchDimension>,
  sketchId: SketchId,
  entity: SketchEntity,
  opIndex: number
): void {
  for (const dimension of dimensions.values()) {
    if (dimension.sketchId !== sketchId || dimension.entityId !== entity.id) {
      continue;
    }

    if (isSupportedSketchDimensionTarget(dimension.target, entity)) {
      continue;
    }

    throwValidationError({
      code: "INVALID_SKETCH_DIMENSION",
      message:
        "Sketch entity update would leave an existing dimension with an unsupported target.",
      opIndex,
      sketchId,
      sketchEntityId: entity.id,
      sketchDimensionId: dimension.id,
      path: operationPath(opIndex, "entity.kind"),
      expected: `entity compatible with dimension ${dimension.id}`,
      received: entity.kind
    });
  }
}

function syncDimensionsForSketchEntityUpdate(
  state: MutableDocumentState,
  sketchId: SketchId,
  before: SketchEntity,
  after: SketchEntity,
  diff: MutableSemanticDiff,
  opIndex: number
): void {
  for (const dimension of state.sketchDimensions.values()) {
    if (dimension.sketchId !== sketchId || dimension.entityId !== after.id) {
      continue;
    }

    const nextValueResult = getSketchDimensionTargetValue(after, dimension);
    const previousValueResult = getSketchDimensionTargetValue(
      before,
      dimension
    );

    if (!nextValueResult.ok) {
      throwSketchSolverApplyIssue(nextValueResult.issue, opIndex);
    }

    if (!previousValueResult.ok) {
      throwSketchSolverApplyIssue(previousValueResult.issue, opIndex);
    }

    const nextValue = nextValueResult.value;
    const previousValue = previousValueResult.value;

    if (nextValue === previousValue) {
      continue;
    }

    if (dimension.valueSource.type === "parameter") {
      const parameter = getParameterOrThrow(
        state.parameters,
        dimension.valueSource.parameterId,
        opIndex
      );

      if (cleanMeasurementNumber(parameter.value) === nextValue) {
        continue;
      }

      throwValidationError({
        code: "INVALID_SKETCH_DIMENSION",
        message:
          "Sketch entity update conflicts with a parameter-driven dimension.",
        opIndex,
        parameterId: parameter.id,
        sketchId,
        sketchEntityId: after.id,
        sketchDimensionId: dimension.id,
        path: operationPath(opIndex, "entity"),
        expected: `dimension value ${parameter.value}`,
        received: String(nextValue)
      });
    }

    const updated: SketchDimension = {
      ...dimension,
      valueSource: {
        type: "literal",
        value: nextValue
      }
    };
    state.sketchDimensions.set(updated.id, updated);
    pushSketchDimensionModified(diff, sketchDimensionRef(updated));
  }
}

function throwSketchSolverApplyIssue(
  issue: SketchSolverApplyIssue,
  opIndex: number
): never {
  throwValidationError({
    code: issue.code,
    message: issue.message,
    opIndex,
    sketchId: issue.sketchId,
    sketchEntityId: issue.sketchEntityId,
    sketchDimensionId: issue.sketchDimensionId,
    sketchConstraintId: issue.sketchConstraintId,
    path: operationPath(opIndex, issue.pathField),
    expected: issue.expected,
    received: issue.received
  });
}

function addSketchConstraint(
  constraints: Map<SketchConstraintId, SketchConstraint>,
  constraint: SketchConstraint,
  diff: MutableSemanticDiff,
  opIndex: number
): void {
  if (constraint.id.length === 0) {
    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT",
      message: "Sketch constraint id must be a non-empty string.",
      opIndex,
      sketchConstraintId: constraint.id,
      path: operationPath(opIndex, "id"),
      expected: "non-empty sketch constraint id",
      received: constraint.id
    });
  }

  if (constraints.has(constraint.id)) {
    throwValidationError({
      code: "SKETCH_CONSTRAINT_ALREADY_EXISTS",
      message: `Sketch constraint already exists: ${constraint.id}`,
      opIndex,
      sketchConstraintId: constraint.id,
      path: operationPath(opIndex, "id"),
      expected: "unique sketch constraint id",
      received: constraint.id
    });
  }

  assertSketchConstraintAvailable(constraints, constraint, opIndex);
  constraints.set(constraint.id, constraint);
  pushSketchConstraintCreated(diff, sketchConstraintRef(constraint));
}

function assertSketchConstraintAvailable(
  constraints: ReadonlyMap<SketchConstraintId, SketchConstraint>,
  constraint: SketchConstraint,
  opIndex: number
): void {
  const existing = [...constraints.values()].find((candidate) => {
    if (
      candidate.id === constraint.id ||
      candidate.sketchId !== constraint.sketchId
    ) {
      return false;
    }

    if (
      isOrientationConstraint(candidate) &&
      isOrientationConstraint(constraint)
    ) {
      return candidate.entityId === constraint.entityId;
    }

    if (candidate.kind === "fixed" && constraint.kind === "fixed") {
      return sketchPointTargetsEqual(candidate.target, constraint.target);
    }

    if (candidate.kind === "coincident" && constraint.kind === "coincident") {
      return (
        sketchPointTargetPairKey(
          candidate.primaryTarget,
          candidate.secondaryTarget
        ) ===
        sketchPointTargetPairKey(
          constraint.primaryTarget,
          constraint.secondaryTarget
        )
      );
    }

    if (candidate.kind === "midpoint" && constraint.kind === "midpoint") {
      return (
        candidate.lineEntityId === constraint.lineEntityId &&
        sketchPointTargetsEqual(candidate.target, constraint.target)
      );
    }

    if (
      isLinePairSketchConstraint(candidate) &&
      isLinePairSketchConstraint(constraint)
    ) {
      return (
        candidate.primaryLineEntityId === constraint.primaryLineEntityId &&
        candidate.secondaryLineEntityId === constraint.secondaryLineEntityId
      );
    }

    return false;
  });

  if (!existing) {
    return;
  }

  const isDuplicate =
    existing.kind === constraint.kind &&
    (constraint.kind === "coincident"
      ? existing.kind === "coincident" &&
        sketchPointTargetPairKey(
          existing.primaryTarget,
          existing.secondaryTarget
        ) ===
          sketchPointTargetPairKey(
            constraint.primaryTarget,
            constraint.secondaryTarget
          )
      : constraint.kind === "fixed"
        ? existing.kind === "fixed" &&
          sketchPointTargetsEqual(existing.target, constraint.target)
        : constraint.kind === "midpoint"
          ? existing.kind === "midpoint" &&
            existing.lineEntityId === constraint.lineEntityId &&
            sketchPointTargetsEqual(existing.target, constraint.target)
          : isLinePairSketchConstraint(constraint)
            ? isLinePairSketchConstraint(existing) &&
              existing.primaryLineEntityId === constraint.primaryLineEntityId &&
              existing.secondaryLineEntityId ===
                constraint.secondaryLineEntityId
            : true);

  throwValidationError({
    code: isDuplicate
      ? "INVALID_SKETCH_CONSTRAINT"
      : "CONFLICTING_SKETCH_CONSTRAINT",
    message: isDuplicate
      ? constraint.kind === "fixed"
        ? `Sketch point target already has a fixed constraint: ${existing.id}.`
        : constraint.kind === "coincident"
          ? `Sketch point targets already have a coincident constraint: ${existing.id}.`
          : constraint.kind === "midpoint"
            ? `Line and point target already have a midpoint constraint: ${existing.id}.`
            : isLinePairSketchConstraint(constraint)
              ? `Line pair already has a ${existing.kind} constraint: ${existing.id}.`
              : `Line already has a ${constraint.kind} constraint: ${existing.id}.`
      : `Line already has a conflicting ${existing.kind} constraint: ${existing.id}.`,
    opIndex,
    sketchId: constraint.sketchId,
    sketchEntityId: constraint.entityId,
    sketchConstraintId: constraint.id,
    path: operationPath(
      opIndex,
      constraint.kind === "fixed"
        ? "target"
        : constraint.kind === "coincident"
          ? "secondaryTarget"
          : constraint.kind === "midpoint"
            ? "target"
            : isLinePairSketchConstraint(constraint)
              ? "secondaryLineEntityId"
              : "kind"
    ),
    expected:
      constraint.kind === "fixed"
        ? "unfixed sketch point target"
        : constraint.kind === "coincident"
          ? "unique coincident point pair"
          : constraint.kind === "midpoint"
            ? "unique midpoint line/target pair"
            : isLinePairSketchConstraint(constraint)
              ? "unique line pair constraint"
              : "undriven line orientation",
    received: existing.kind
  });
}

function getSketchConstraintOrThrow(
  constraints: ReadonlyMap<SketchConstraintId, SketchConstraint>,
  id: SketchConstraintId,
  opIndex: number
): SketchConstraint {
  const constraint = constraints.get(id);

  if (!constraint) {
    throwValidationError({
      code: "SKETCH_CONSTRAINT_NOT_FOUND",
      message: `Sketch constraint does not exist: ${id}`,
      opIndex,
      sketchConstraintId: id,
      path: operationPath(opIndex, "id"),
      expected: "existing sketch constraint id",
      received: id
    });
  }

  return constraint;
}

function normalizeSketchConstraintName(
  value: string,
  opIndex: number,
  id?: SketchConstraintId
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT_NAME",
      message: "Sketch constraint name must be non-empty.",
      opIndex,
      sketchConstraintId: id,
      path: operationPath(opIndex, "name"),
      expected: "non-empty sketch constraint name",
      received: describeReceived(value)
    });
  }

  return value.trim();
}

function createSketchConstraintFromOp(
  state: MutableDocumentState,
  op: Extract<CadOp, { readonly op: "sketch.constraint.create" }>,
  id: SketchConstraintId,
  opIndex: number
): SketchConstraint {
  if (op.kind === "fixed") {
    return createFixedSketchConstraintFromOp(state, op, id, opIndex);
  }

  if (op.kind === "coincident") {
    return createCoincidentSketchConstraintFromOp(state, op, id, opIndex);
  }

  if (op.kind === "midpoint") {
    return createMidpointSketchConstraintFromOp(state, op, id, opIndex);
  }

  if (op.kind === "parallel" || op.kind === "perpendicular") {
    return createLinePairSketchConstraintFromOp(state, op, id, opIndex);
  }

  return createOrientationSketchConstraintFromOp(state, op, id, opIndex);
}

function createOrientationSketchConstraintFromOp(
  state: MutableDocumentState,
  op: Extract<
    CadOp,
    {
      readonly op: "sketch.constraint.create";
      readonly kind: "horizontal" | "vertical";
    }
  >,
  id: SketchConstraintId,
  opIndex: number
): SketchConstraint {
  const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
  const entity = sketch.entities.get(op.entityId);

  if (!entity) {
    throwSketchEntityNotFound(op.sketchId, op.entityId, opIndex);
  }

  if (entity.kind !== "line") {
    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT",
      message: "Sketch orientation constraints can only target line entities.",
      opIndex,
      sketchId: op.sketchId,
      sketchEntityId: op.entityId,
      path: operationPath(opIndex, "entityId"),
      expected: "line entity",
      received: entity.kind
    });
  }

  if (getLineLength(entity) <= 0) {
    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT",
      message:
        "Line orientation constraint cannot update a zero-length line because the orientation is ambiguous.",
      opIndex,
      sketchId: op.sketchId,
      sketchEntityId: op.entityId,
      path: operationPath(opIndex, "entityId"),
      expected: "line with a non-zero direction",
      received: "zero-length line"
    });
  }

  return {
    id,
    name: normalizeSketchConstraintName(op.name, opIndex, op.id),
    sketchId: op.sketchId,
    entityId: op.entityId,
    kind: op.kind
  };
}

function createFixedSketchConstraintFromOp(
  state: MutableDocumentState,
  op: Extract<
    CadOp,
    { readonly op: "sketch.constraint.create"; readonly kind: "fixed" }
  >,
  id: SketchConstraintId,
  opIndex: number
): SketchConstraint {
  const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
  const target = validateSketchPointTarget(op.target, opIndex);
  const entity = sketch.entities.get(target.entityId);

  if (!entity) {
    throwSketchEntityNotFound(op.sketchId, target.entityId, opIndex);
  }

  assertSketchPointTargetSupported(entity, target, opIndex, op.sketchId);

  return {
    id,
    name: normalizeSketchConstraintName(op.name, opIndex, op.id),
    sketchId: op.sketchId,
    entityId: target.entityId,
    kind: "fixed",
    target,
    coordinate:
      op.coordinate !== undefined
        ? validateVec2(op.coordinate, opIndex, "coordinate")
        : getSketchPointTargetCoordinate(entity, target)
  };
}

function createCoincidentSketchConstraintFromOp(
  state: MutableDocumentState,
  op: Extract<
    CadOp,
    { readonly op: "sketch.constraint.create"; readonly kind: "coincident" }
  >,
  id: SketchConstraintId,
  opIndex: number
): SketchConstraint {
  const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
  const primaryTarget = validateSketchPointTarget(
    op.primaryTarget,
    opIndex,
    "primaryTarget"
  );
  const secondaryTarget = validateSketchPointTarget(
    op.secondaryTarget,
    opIndex,
    "secondaryTarget"
  );

  if (sketchPointTargetsEqual(primaryTarget, secondaryTarget)) {
    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT",
      message: "Coincident sketch constraint targets must be distinct.",
      opIndex,
      sketchId: op.sketchId,
      sketchEntityId: primaryTarget.entityId,
      path: operationPath(opIndex, "secondaryTarget"),
      expected: "distinct sketch point targets",
      received: "same target"
    });
  }

  const primaryEntity = sketch.entities.get(primaryTarget.entityId);
  const secondaryEntity = sketch.entities.get(secondaryTarget.entityId);

  if (!primaryEntity) {
    throwSketchEntityNotFound(op.sketchId, primaryTarget.entityId, opIndex);
  }

  if (!secondaryEntity) {
    throwSketchEntityNotFound(op.sketchId, secondaryTarget.entityId, opIndex);
  }

  assertSketchPointTargetSupported(
    primaryEntity,
    primaryTarget,
    opIndex,
    op.sketchId,
    "primaryTarget"
  );
  assertSketchPointTargetSupported(
    secondaryEntity,
    secondaryTarget,
    opIndex,
    op.sketchId,
    "secondaryTarget"
  );

  assertCoincidentFixedTargetsCompatible(
    state.sketchConstraints,
    op.sketchId,
    primaryTarget,
    secondaryTarget,
    opIndex
  );

  return {
    id,
    name: normalizeSketchConstraintName(op.name, opIndex, op.id),
    sketchId: op.sketchId,
    entityId: primaryTarget.entityId,
    kind: "coincident",
    primaryTarget,
    secondaryTarget
  };
}

function createMidpointSketchConstraintFromOp(
  state: MutableDocumentState,
  op: Extract<
    CadOp,
    { readonly op: "sketch.constraint.create"; readonly kind: "midpoint" }
  >,
  id: SketchConstraintId,
  opIndex: number
): SketchConstraint {
  const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
  const lineEntity = sketch.entities.get(op.lineEntityId);
  const target = validateSketchPointTarget(op.target, opIndex);

  if (!lineEntity) {
    throwSketchEntityNotFound(op.sketchId, op.lineEntityId, opIndex);
  }

  if (lineEntity.kind !== "line") {
    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT",
      message: "Midpoint sketch constraint line target must be a line entity.",
      opIndex,
      sketchId: op.sketchId,
      sketchEntityId: op.lineEntityId,
      path: operationPath(opIndex, "lineEntityId"),
      expected: "line entity",
      received: lineEntity.kind
    });
  }

  const targetEntity = sketch.entities.get(target.entityId);

  if (!targetEntity) {
    throwSketchEntityNotFound(op.sketchId, target.entityId, opIndex);
  }

  assertMidpointSketchPointTargetSupported(
    targetEntity,
    target,
    opIndex,
    op.sketchId
  );

  assertMidpointFixedTargetCompatible(
    state.sketchConstraints,
    op.sketchId,
    lineEntity,
    target,
    opIndex
  );

  return {
    id,
    name: normalizeSketchConstraintName(op.name, opIndex, op.id),
    sketchId: op.sketchId,
    entityId: op.lineEntityId,
    kind: "midpoint",
    lineEntityId: op.lineEntityId,
    target
  };
}

function createLinePairSketchConstraintFromOp(
  state: MutableDocumentState,
  op: Extract<
    CadOp,
    {
      readonly op: "sketch.constraint.create";
      readonly kind: "parallel" | "perpendicular";
    }
  >,
  id: SketchConstraintId,
  opIndex: number
): SketchConstraint {
  const label = op.kind === "parallel" ? "Parallel" : "Perpendicular";
  const relation = op.kind === "parallel" ? "parallel" : "perpendicular";
  const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
  const primaryLine = sketch.entities.get(op.primaryLineEntityId);
  const secondaryLine = sketch.entities.get(op.secondaryLineEntityId);

  if (!primaryLine) {
    throwSketchEntityNotFound(op.sketchId, op.primaryLineEntityId, opIndex);
  }

  if (!secondaryLine) {
    throwSketchEntityNotFound(op.sketchId, op.secondaryLineEntityId, opIndex);
  }

  assertSketchEntityIsLine(
    primaryLine,
    op.sketchId,
    opIndex,
    "primaryLineEntityId",
    `${label} sketch constraint primary line target must be a line entity.`
  );
  assertSketchEntityIsLine(
    secondaryLine,
    op.sketchId,
    opIndex,
    "secondaryLineEntityId",
    `${label} sketch constraint secondary line target must be a line entity.`
  );

  if (op.primaryLineEntityId === op.secondaryLineEntityId) {
    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT",
      message: `${label} sketch constraint line targets must be distinct.`,
      opIndex,
      sketchId: op.sketchId,
      sketchEntityId: op.secondaryLineEntityId,
      path: operationPath(opIndex, "secondaryLineEntityId"),
      expected: "distinct secondary line entity id",
      received: op.primaryLineEntityId
    });
  }

  if (getLineLength(primaryLine) <= 0) {
    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT",
      message: `${label} sketch constraint primary line cannot be zero-length because the direction is ambiguous.`,
      opIndex,
      sketchId: op.sketchId,
      sketchEntityId: op.primaryLineEntityId,
      path: operationPath(opIndex, "primaryLineEntityId"),
      expected: "line with a non-zero direction",
      received: "zero-length line"
    });
  }

  if (getLineLength(secondaryLine) <= 0) {
    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT",
      message: `${label} sketch constraint secondary line cannot be zero-length because the direction is ambiguous.`,
      opIndex,
      sketchId: op.sketchId,
      sketchEntityId: op.secondaryLineEntityId,
      path: operationPath(opIndex, "secondaryLineEntityId"),
      expected: "line with a non-zero direction",
      received: "zero-length line"
    });
  }

  return {
    id,
    name: normalizeSketchConstraintName(op.name, opIndex, op.id),
    sketchId: op.sketchId,
    entityId: op.secondaryLineEntityId,
    kind: relation,
    primaryLineEntityId: op.primaryLineEntityId,
    secondaryLineEntityId: op.secondaryLineEntityId
  };
}

function assertSketchEntityIsLine(
  entity: SketchEntity,
  sketchId: SketchId,
  opIndex: number,
  pathField: string,
  message: string
): asserts entity is Extract<SketchEntity, { readonly kind: "line" }> {
  if (entity.kind === "line") {
    return;
  }

  throwValidationError({
    code: "INVALID_SKETCH_CONSTRAINT",
    message,
    opIndex,
    sketchId,
    sketchEntityId: entity.id,
    path: operationPath(opIndex, pathField),
    expected: "line entity",
    received: entity.kind
  });
}

function assertSketchConstraintTargetsStillValid(
  constraints: ReadonlyMap<SketchConstraintId, SketchConstraint>,
  sketchId: SketchId,
  entity: SketchEntity,
  opIndex: number
): void {
  for (const constraint of constraints.values()) {
    if (!sketchConstraintReferencesEntity(constraint, sketchId, entity.id)) {
      continue;
    }

    if (isOrientationConstraint(constraint) && entity.kind === "line") {
      continue;
    }

    if (
      constraint.kind === "fixed" &&
      isSketchPointTargetSupported(entity, constraint.target)
    ) {
      continue;
    }

    if (
      constraint.kind === "coincident" &&
      ((constraint.primaryTarget.entityId === entity.id &&
        isSketchPointTargetSupported(entity, constraint.primaryTarget)) ||
        (constraint.secondaryTarget.entityId === entity.id &&
          isSketchPointTargetSupported(entity, constraint.secondaryTarget)))
    ) {
      continue;
    }

    if (
      constraint.kind === "midpoint" &&
      ((constraint.lineEntityId === entity.id && entity.kind === "line") ||
        (constraint.target.entityId === entity.id &&
          isMidpointSketchPointTargetSupported(entity, constraint.target)))
    ) {
      continue;
    }

    if (isLinePairSketchConstraint(constraint) && entity.kind === "line") {
      continue;
    }

    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT",
      message:
        "Sketch entity update would leave an existing constraint with an unsupported target.",
      opIndex,
      sketchId,
      sketchEntityId: entity.id,
      sketchConstraintId: constraint.id,
      path: operationPath(opIndex, "entity.kind"),
      expected: `entity compatible with constraint ${constraint.id}`,
      received: entity.kind
    });
  }
}

function sketchConstraintReferencesEntity(
  constraint: SketchConstraint,
  sketchId: SketchId,
  entityId: SketchEntityId
): boolean {
  if (constraint.sketchId !== sketchId) {
    return false;
  }

  if (constraint.entityId === entityId) {
    return true;
  }

  if (constraint.kind === "coincident") {
    return (
      constraint.primaryTarget.entityId === entityId ||
      constraint.secondaryTarget.entityId === entityId
    );
  }

  if (constraint.kind === "midpoint") {
    return (
      constraint.lineEntityId === entityId ||
      constraint.target.entityId === entityId
    );
  }

  if (isLinePairSketchConstraint(constraint)) {
    return (
      constraint.primaryLineEntityId === entityId ||
      constraint.secondaryLineEntityId === entityId
    );
  }

  return false;
}

function assertFixedConstraintsRemainSatisfied(
  constraints: ReadonlyMap<SketchConstraintId, SketchConstraint>,
  sketchId: SketchId,
  before: SketchEntity,
  after: SketchEntity,
  opIndex: number
): void {
  for (const constraint of constraints.values()) {
    if (
      constraint.kind !== "fixed" ||
      constraint.sketchId !== sketchId ||
      constraint.entityId !== after.id
    ) {
      continue;
    }

    const beforeCoordinate = getSketchPointTargetCoordinate(
      before,
      constraint.target
    );
    const afterCoordinate = getSketchPointTargetCoordinate(
      after,
      constraint.target
    );

    if (
      vec2Equal(beforeCoordinate, constraint.coordinate) &&
      !vec2Equal(afterCoordinate, constraint.coordinate)
    ) {
      throwValidationError({
        code: "INVALID_SKETCH_CONSTRAINT",
        message:
          "Sketch dimension update would violate an existing fixed point constraint.",
        opIndex,
        sketchId,
        sketchEntityId: after.id,
        sketchConstraintId: constraint.id,
        path: operationPath(opIndex, "value"),
        expected: `fixed coordinate ${formatVec2(constraint.coordinate)}`,
        received: formatVec2(afterCoordinate)
      });
    }
  }
}

function validateSketchPointTarget(
  value: unknown,
  opIndex: number,
  field = "target"
): SketchPointTarget {
  if (!isRecord(value)) {
    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT",
      message: "Sketch point constraint target must be an object.",
      opIndex,
      path: operationPath(opIndex, field),
      expected: "sketch point target",
      received: describeReceived(value)
    });
  }

  if (typeof value.entityId !== "string" || value.entityId.length === 0) {
    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT",
      message: "Sketch point constraint target entityId must be non-empty.",
      opIndex,
      path: operationPath(opIndex, `${field}.entityId`),
      expected: "non-empty sketch entity id",
      received: describeReceived(value.entityId)
    });
  }

  if (!isSketchPointTargetRole(value.role)) {
    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT",
      message: "Sketch point constraint target role is unsupported.",
      opIndex,
      sketchEntityId: value.entityId,
      path: operationPath(opIndex, `${field}.role`),
      expected: "position, start, end, or center",
      received: describeReceived(value.role)
    });
  }

  return {
    entityId: value.entityId,
    role: value.role
  };
}

function assertSketchPointTargetSupported(
  entity: SketchEntity,
  target: SketchPointTarget,
  opIndex: number,
  sketchId: SketchId,
  field = "target"
): void {
  if (isSketchPointTargetSupported(entity, target)) {
    return;
  }

  throwValidationError({
    code: "INVALID_SKETCH_CONSTRAINT",
    message:
      "Fixed sketch constraint target role is not supported for this entity.",
    opIndex,
    sketchId,
    sketchEntityId: entity.id,
    path: operationPath(opIndex, `${field}.role`),
    expected: `point target for ${entity.kind}`,
    received: target.role
  });
}

function assertMidpointSketchPointTargetSupported(
  entity: SketchEntity,
  target: SketchPointTarget,
  opIndex: number,
  sketchId: SketchId
): void {
  if (isMidpointSketchPointTargetSupported(entity, target)) {
    return;
  }

  throwValidationError({
    code: "INVALID_SKETCH_CONSTRAINT",
    message:
      "Midpoint sketch constraint target role is not supported for this entity.",
    opIndex,
    sketchId,
    sketchEntityId: entity.id,
    path: operationPath(opIndex, "target.role"),
    expected: `point, rectangle center, or circle center target for ${entity.kind}`,
    received: target.role
  });
}

function isSketchPointTargetSupported(
  entity: SketchEntity,
  target: SketchPointTarget
): boolean {
  if (target.entityId !== entity.id) {
    return false;
  }

  return (
    (entity.kind === "point" && target.role === "position") ||
    (entity.kind === "line" &&
      (target.role === "start" || target.role === "end")) ||
    ((entity.kind === "rectangle" || entity.kind === "circle") &&
      target.role === "center")
  );
}

function isMidpointSketchPointTargetSupported(
  entity: SketchEntity,
  target: SketchPointTarget
): boolean {
  return (
    target.entityId === entity.id &&
    ((entity.kind === "point" && target.role === "position") ||
      ((entity.kind === "rectangle" || entity.kind === "circle") &&
        target.role === "center"))
  );
}

function getSketchPointTargetCoordinate(
  entity: SketchEntity,
  target: SketchPointTarget
): Vec2 {
  if (entity.kind === "point" && target.role === "position") {
    return [
      cleanMeasurementNumber(entity.point[0]),
      cleanMeasurementNumber(entity.point[1])
    ];
  }

  if (entity.kind === "line" && target.role === "start") {
    return [
      cleanMeasurementNumber(entity.start[0]),
      cleanMeasurementNumber(entity.start[1])
    ];
  }

  if (entity.kind === "line" && target.role === "end") {
    return [
      cleanMeasurementNumber(entity.end[0]),
      cleanMeasurementNumber(entity.end[1])
    ];
  }

  if (
    (entity.kind === "rectangle" || entity.kind === "circle") &&
    target.role === "center"
  ) {
    return [
      cleanMeasurementNumber(entity.center[0]),
      cleanMeasurementNumber(entity.center[1])
    ];
  }

  return [NaN, NaN];
}

function setSketchPointTargetCoordinate(
  entity: SketchEntity,
  target: SketchPointTarget,
  coordinate: Vec2
): SketchEntity {
  const cleanCoordinate: Vec2 = [
    cleanMeasurementNumber(coordinate[0]),
    cleanMeasurementNumber(coordinate[1])
  ];

  if (entity.kind === "point" && target.role === "position") {
    return { ...entity, point: cleanCoordinate };
  }

  if (entity.kind === "line" && target.role === "start") {
    return { ...entity, start: cleanCoordinate };
  }

  if (entity.kind === "line" && target.role === "end") {
    return { ...entity, end: cleanCoordinate };
  }

  if (entity.kind === "rectangle" && target.role === "center") {
    return { ...entity, center: cleanCoordinate };
  }

  if (entity.kind === "circle" && target.role === "center") {
    return { ...entity, center: cleanCoordinate };
  }

  return entity;
}

function getLineMidpoint(
  entity: Extract<SketchEntity, { readonly kind: "line" }>
): Vec2 {
  return [
    cleanMeasurementNumber((entity.start[0] + entity.end[0]) / 2),
    cleanMeasurementNumber((entity.start[1] + entity.end[1]) / 2)
  ];
}

function resolveCoincidentConstraintApplication(
  constraints: ReadonlyMap<SketchConstraintId, SketchConstraint>,
  sketch: Sketch,
  constraint: Extract<SketchConstraint, { readonly kind: "coincident" }>,
  opIndex: number
):
  | { readonly target: SketchPointTarget; readonly coordinate: Vec2 }
  | undefined {
  const primaryEntity = sketch.entities.get(constraint.primaryTarget.entityId);
  const secondaryEntity = sketch.entities.get(
    constraint.secondaryTarget.entityId
  );

  if (!primaryEntity) {
    throwSketchEntityNotFound(
      constraint.sketchId,
      constraint.primaryTarget.entityId,
      opIndex
    );
  }

  if (!secondaryEntity) {
    throwSketchEntityNotFound(
      constraint.sketchId,
      constraint.secondaryTarget.entityId,
      opIndex
    );
  }

  assertSketchPointTargetSupported(
    primaryEntity,
    constraint.primaryTarget,
    opIndex,
    constraint.sketchId,
    "primaryTarget"
  );
  assertSketchPointTargetSupported(
    secondaryEntity,
    constraint.secondaryTarget,
    opIndex,
    constraint.sketchId,
    "secondaryTarget"
  );

  const primaryFixed = findFixedConstraintCoordinate(
    constraints,
    constraint.sketchId,
    constraint.primaryTarget
  );
  const secondaryFixed = findFixedConstraintCoordinate(
    constraints,
    constraint.sketchId,
    constraint.secondaryTarget
  );

  if (primaryFixed && secondaryFixed) {
    if (!vec2Equal(primaryFixed.coordinate, secondaryFixed.coordinate)) {
      throwValidationError({
        code: "INVALID_SKETCH_CONSTRAINT",
        message:
          "Coincident sketch constraint cannot satisfy two different fixed coordinates.",
        opIndex,
        sketchId: constraint.sketchId,
        sketchEntityId: constraint.entityId,
        sketchConstraintId: constraint.id,
        path: operationPath(opIndex, "secondaryTarget"),
        expected: formatVec2(primaryFixed.coordinate),
        received: formatVec2(secondaryFixed.coordinate)
      });
    }

    return undefined;
  }

  if (primaryFixed) {
    return {
      target: constraint.secondaryTarget,
      coordinate: primaryFixed.coordinate
    };
  }

  if (secondaryFixed) {
    return {
      target: constraint.primaryTarget,
      coordinate: secondaryFixed.coordinate
    };
  }

  return {
    target: constraint.secondaryTarget,
    coordinate: getSketchPointTargetCoordinate(
      primaryEntity,
      constraint.primaryTarget
    )
  };
}

function assertCoincidentFixedTargetsCompatible(
  constraints: ReadonlyMap<SketchConstraintId, SketchConstraint>,
  sketchId: SketchId,
  primaryTarget: SketchPointTarget,
  secondaryTarget: SketchPointTarget,
  opIndex: number
): void {
  const primaryFixed = findFixedConstraintCoordinate(
    constraints,
    sketchId,
    primaryTarget
  );
  const secondaryFixed = findFixedConstraintCoordinate(
    constraints,
    sketchId,
    secondaryTarget
  );

  if (!primaryFixed || !secondaryFixed) {
    return;
  }

  if (vec2Equal(primaryFixed.coordinate, secondaryFixed.coordinate)) {
    return;
  }

  throwValidationError({
    code: "INVALID_SKETCH_CONSTRAINT",
    message:
      "Coincident sketch constraint cannot target points fixed to different coordinates.",
    opIndex,
    sketchId,
    sketchEntityId: primaryTarget.entityId,
    path: operationPath(opIndex, "secondaryTarget"),
    expected: formatVec2(primaryFixed.coordinate),
    received: formatVec2(secondaryFixed.coordinate)
  });
}

function assertMidpointFixedTargetCompatible(
  constraints: ReadonlyMap<SketchConstraintId, SketchConstraint>,
  sketchId: SketchId,
  lineEntity: Extract<SketchEntity, { readonly kind: "line" }>,
  target: SketchPointTarget,
  opIndex: number
): void {
  const fixedTargets = findFixedConstraintCoordinatesForTarget(
    constraints,
    sketchId,
    target
  );

  const midpoint = getLineMidpoint(lineEntity);
  const fixedTarget = fixedTargets.find(
    (candidate) => !vec2Equal(candidate.coordinate, midpoint)
  );

  if (!fixedTarget) {
    return;
  }

  throwValidationError({
    code: "INVALID_SKETCH_CONSTRAINT",
    message:
      "Midpoint sketch constraint cannot target a point fixed away from the line midpoint.",
    opIndex,
    sketchId,
    sketchEntityId: target.entityId,
    sketchConstraintId: fixedTarget.id,
    path: operationPath(opIndex, "target"),
    expected: formatVec2(midpoint),
    received: formatVec2(fixedTarget.coordinate)
  });
}

function findFixedConstraintCoordinatesForTarget(
  constraints: ReadonlyMap<SketchConstraintId, SketchConstraint>,
  sketchId: SketchId,
  target: SketchPointTarget
): readonly { readonly id: SketchConstraintId; readonly coordinate: Vec2 }[] {
  const coordinates: {
    readonly id: SketchConstraintId;
    readonly coordinate: Vec2;
  }[] = [];
  const directFixed = findFixedConstraintCoordinate(
    constraints,
    sketchId,
    target
  );

  if (directFixed) {
    coordinates.push(directFixed);
  }

  for (const constraint of constraints.values()) {
    if (constraint.kind !== "coincident" || constraint.sketchId !== sketchId) {
      continue;
    }

    const otherTarget = sketchPointTargetsEqual(
      constraint.primaryTarget,
      target
    )
      ? constraint.secondaryTarget
      : sketchPointTargetsEqual(constraint.secondaryTarget, target)
        ? constraint.primaryTarget
        : undefined;

    if (!otherTarget) {
      continue;
    }

    const fixedOtherTarget = findFixedConstraintCoordinate(
      constraints,
      sketchId,
      otherTarget
    );

    if (fixedOtherTarget) {
      coordinates.push(fixedOtherTarget);
    }
  }

  return coordinates;
}

function findFixedConstraintCoordinate(
  constraints: ReadonlyMap<SketchConstraintId, SketchConstraint>,
  sketchId: SketchId,
  target: SketchPointTarget
): { readonly id: SketchConstraintId; readonly coordinate: Vec2 } | undefined {
  for (const constraint of constraints.values()) {
    if (
      constraint.kind === "fixed" &&
      constraint.sketchId === sketchId &&
      sketchPointTargetsEqual(constraint.target, target)
    ) {
      return {
        id: constraint.id,
        coordinate: [constraint.coordinate[0], constraint.coordinate[1]]
      };
    }
  }

  return undefined;
}

function sketchPointTargetsEqual(
  left: SketchPointTarget,
  right: SketchPointTarget
): boolean {
  return left.entityId === right.entityId && left.role === right.role;
}

function sketchPointTargetPairKey(
  left: SketchPointTarget,
  right: SketchPointTarget
): string {
  return [sketchPointTargetKey(left), sketchPointTargetKey(right)]
    .sort()
    .join("\0");
}

function sketchPointTargetKey(target: SketchPointTarget): string {
  return `${target.entityId}\0${target.role}`;
}

function isOrientationConstraint(
  constraint: SketchConstraint
): constraint is Extract<
  SketchConstraint,
  { readonly kind: "horizontal" | "vertical" }
> {
  return constraint.kind === "horizontal" || constraint.kind === "vertical";
}

function isLinePairSketchConstraint(
  constraint: SketchConstraint
): constraint is Extract<
  SketchConstraint,
  { readonly kind: "parallel" | "perpendicular" }
> {
  return constraint.kind === "parallel" || constraint.kind === "perpendicular";
}

function isSketchPointTargetRole(
  value: unknown
): value is SketchPointTarget["role"] {
  return (
    value === "position" ||
    value === "start" ||
    value === "end" ||
    value === "center"
  );
}

function formatVec2(value: Vec2): string {
  return `[${value[0]}, ${value[1]}]`;
}

function applySketchConstraintToEntity(
  state: MutableDocumentState,
  constraint: SketchConstraint,
  diff: MutableSemanticDiff,
  opIndex: number
): void {
  const propagation = createSketchConstraintPropagationContext(constraint.id);

  if (constraint.kind === "coincident") {
    applyCoincidentSketchConstraintToEntities(
      state,
      constraint,
      diff,
      opIndex,
      propagation
    );
    return;
  }

  if (constraint.kind === "midpoint") {
    applyMidpointSketchConstraintToEntity(
      state,
      constraint,
      diff,
      opIndex,
      propagation
    );
    return;
  }

  if (isLinePairSketchConstraint(constraint)) {
    applyLinePairSketchConstraintToEntity(
      state,
      constraint,
      diff,
      opIndex,
      propagation
    );
    return;
  }

  const sketch = getSketchOrThrow(state.sketches, constraint.sketchId, opIndex);
  const existing = sketch.entities.get(constraint.entityId);

  if (!existing) {
    throwSketchEntityNotFound(
      constraint.sketchId,
      constraint.entityId,
      opIndex
    );
  }

  const result = applySketchConstraintValue(
    existing,
    constraint,
    createSketchSolverApplyContext(state, sketch)
  );

  if (!result.ok) {
    throwSketchSolverApplyIssue(result.issue, opIndex);
  }

  updateSketchEntityAndDependents(
    state,
    sketch,
    result.entity,
    diff,
    opIndex,
    propagation
  );
}

function applySketchConstraintsToEntity(
  state: MutableDocumentState,
  sketchId: SketchId,
  entity: SketchEntity,
  opIndex: number
): SketchEntity {
  let constrained = entity;
  const sketch = getSketchOrThrow(state.sketches, sketchId, opIndex);

  for (const constraint of state.sketchConstraints.values()) {
    if (constraint.sketchId !== sketchId || constraint.entityId !== entity.id) {
      continue;
    }

    if (constraint.kind === "coincident") {
      continue;
    }

    const result = applySketchConstraintValue(
      constrained,
      constraint,
      createSketchSolverApplyContext(state, {
        ...sketch,
        entities: new Map(sketch.entities).set(entity.id, constrained)
      })
    );

    if (!result.ok) {
      throwSketchSolverApplyIssue(result.issue, opIndex);
    }

    constrained = result.entity;
  }

  return constrained;
}

function applyCoincidentSketchConstraintToEntities(
  state: MutableDocumentState,
  constraint: Extract<SketchConstraint, { readonly kind: "coincident" }>,
  diff: MutableSemanticDiff,
  opIndex: number,
  propagation: SketchConstraintPropagationContext
): void {
  const sketch = getSketchOrThrow(state.sketches, constraint.sketchId, opIndex);
  const resolution = resolveCoincidentConstraintApplication(
    state.sketchConstraints,
    sketch,
    constraint,
    opIndex
  );

  if (!resolution) {
    return;
  }

  const existing = sketch.entities.get(resolution.target.entityId);

  if (!existing) {
    throwSketchEntityNotFound(
      constraint.sketchId,
      resolution.target.entityId,
      opIndex
    );
  }

  const constrained =
    existing.kind === "line"
      ? applySketchLineEntityEvaluation(state, sketch, existing, opIndex)
      : setSketchPointTargetCoordinate(
          existing,
          resolution.target,
          resolution.coordinate
        );

  updateSketchEntityAndDependents(
    state,
    sketch,
    constrained,
    diff,
    opIndex,
    propagation
  );
}

function applyMidpointSketchConstraintToEntity(
  state: MutableDocumentState,
  constraint: Extract<SketchConstraint, { readonly kind: "midpoint" }>,
  diff: MutableSemanticDiff,
  opIndex: number,
  propagation: SketchConstraintPropagationContext
): void {
  const sketch = getSketchOrThrow(state.sketches, constraint.sketchId, opIndex);
  const lineEntity = sketch.entities.get(constraint.lineEntityId);
  const targetEntity = sketch.entities.get(constraint.target.entityId);

  if (!lineEntity) {
    throwSketchEntityNotFound(
      constraint.sketchId,
      constraint.lineEntityId,
      opIndex
    );
  }

  if (!targetEntity) {
    throwSketchEntityNotFound(
      constraint.sketchId,
      constraint.target.entityId,
      opIndex
    );
  }

  if (lineEntity.kind !== "line") {
    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT",
      message: "Midpoint sketch constraint line target must be a line entity.",
      opIndex,
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.lineEntityId,
      sketchConstraintId: constraint.id,
      path: operationPath(opIndex, "lineEntityId"),
      expected: "line entity",
      received: lineEntity.kind
    });
  }

  assertMidpointSketchPointTargetSupported(
    targetEntity,
    constraint.target,
    opIndex,
    constraint.sketchId
  );
  assertMidpointFixedTargetCompatible(
    state.sketchConstraints,
    constraint.sketchId,
    lineEntity,
    constraint.target,
    opIndex
  );

  const constrained = setSketchPointTargetCoordinate(
    targetEntity,
    constraint.target,
    getLineMidpoint(lineEntity)
  );

  updateSketchEntityAndDependents(
    state,
    sketch,
    constrained,
    diff,
    opIndex,
    propagation
  );
}

function applyLinePairSketchConstraintToEntity(
  state: MutableDocumentState,
  constraint: Extract<
    SketchConstraint,
    { readonly kind: "parallel" | "perpendicular" }
  >,
  diff: MutableSemanticDiff,
  opIndex: number,
  propagation: SketchConstraintPropagationContext
): void {
  const label = constraint.kind === "parallel" ? "Parallel" : "Perpendicular";
  const sketch = getSketchOrThrow(state.sketches, constraint.sketchId, opIndex);
  const primaryLine = sketch.entities.get(constraint.primaryLineEntityId);
  const secondaryLine = sketch.entities.get(constraint.secondaryLineEntityId);

  if (!primaryLine) {
    throwSketchEntityNotFound(
      constraint.sketchId,
      constraint.primaryLineEntityId,
      opIndex
    );
  }

  if (!secondaryLine) {
    throwSketchEntityNotFound(
      constraint.sketchId,
      constraint.secondaryLineEntityId,
      opIndex
    );
  }

  assertSketchEntityIsLine(
    primaryLine,
    constraint.sketchId,
    opIndex,
    "primaryLineEntityId",
    `${label} sketch constraint primary line target must be a line entity.`
  );
  assertSketchEntityIsLine(
    secondaryLine,
    constraint.sketchId,
    opIndex,
    "secondaryLineEntityId",
    `${label} sketch constraint secondary line target must be a line entity.`
  );

  const result = applySketchConstraintValue(
    secondaryLine,
    constraint,
    createSketchSolverApplyContext(state, sketch)
  );

  if (!result.ok) {
    throwSketchSolverApplyIssue(result.issue, opIndex);
  }

  updateSketchEntityAndDependents(
    state,
    sketch,
    result.entity,
    diff,
    opIndex,
    propagation
  );
}

function applySketchLineEntityEvaluation(
  state: MutableDocumentState,
  sketch: Sketch,
  entity: Extract<SketchEntity, { readonly kind: "line" }>,
  opIndex: number
): SketchEntity {
  const localSketch: Sketch = {
    ...sketch,
    entities: new Map(sketch.entities).set(entity.id, entity)
  };
  const dimension = [...state.sketchDimensions.values()].find(
    (candidate) =>
      candidate.sketchId === sketch.id &&
      candidate.entityId === entity.id &&
      candidate.target.entityKind === "line" &&
      candidate.target.role === "length"
  );

  if (dimension) {
    const value = resolveSketchDimensionValueOrThrow(state, dimension, opIndex);
    const result = applySketchDimensionValue(
      entity,
      dimension,
      value,
      createSketchSolverApplyContext(state, localSketch)
    );

    if (!result.ok) {
      throwSketchSolverApplyIssue(result.issue, opIndex);
    }

    return result.entity;
  }

  const context = createSketchSolverApplyContext(state, localSketch);
  const constraint = [...state.sketchConstraints.values()].find(
    (candidate) =>
      candidate.sketchId === sketch.id &&
      (candidate.entityId === entity.id ||
        (candidate.kind === "coincident" &&
          (candidate.primaryTarget.entityId === entity.id ||
            candidate.secondaryTarget.entityId === entity.id)))
  );

  if (!constraint) {
    return applySketchConstraintsToEntity(state, sketch.id, entity, opIndex);
  }

  const result = applySketchConstraintValue(entity, constraint, context);

  if (!result.ok) {
    throwSketchSolverApplyIssue(result.issue, opIndex);
  }

  return result.entity;
}

function createSketchSolverDocumentFromState(
  state: MutableDocumentState
): SketchSolverDocument {
  return {
    sketches: state.sketches,
    parameters: state.parameters,
    sketchDimensions: state.sketchDimensions,
    sketchConstraints: state.sketchConstraints
  };
}

function createSketchSolverApplyContext(
  state: MutableDocumentState,
  sketch: Sketch
): {
  readonly document: SketchSolverDocument;
  readonly sketchId: SketchId;
  readonly entities: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>;
} {
  return {
    document: createSketchSolverDocumentFromState(state),
    sketchId: sketch.id,
    entities: sketch.entities
  };
}

function updateSketchEntityAndDependents(
  state: MutableDocumentState,
  sketch: Sketch,
  entity: SketchEntity,
  diff: MutableSemanticDiff,
  opIndex: number,
  propagation: SketchConstraintPropagationContext = createSketchConstraintPropagationContext()
): void {
  const dependentFeatures = findFeaturesBySketchEntity(
    state.features,
    sketch.id,
    entity.id
  );
  const updatedFeatures = dependentFeatures.map((feature) =>
    updateDependentFeatureForSketchEntity(feature, entity, opIndex, sketch.id)
  );
  const nextFeatures = new Map(state.features);
  const updatedBodyIds = new Set<BodyId>();
  const updatedFeatureIds = new Set<FeatureId>();

  for (const feature of updatedFeatures) {
    nextFeatures.set(feature.id, feature);
    updatedBodyIds.add(feature.bodyId);
    updatedFeatureIds.add(feature.id);
  }

  for (const feature of updatedFeatures) {
    if (feature.kind !== "extrude") {
      continue;
    }

    assertSupportedExtrudeOperation(
      { ...state, features: nextFeatures },
      feature.operationMode,
      feature.profileKind,
      feature.targetBodyId,
      feature.targetTopologyAnchorId,
      opIndex,
      feature.id
    );
  }

  const downstreamFeatures: Feature[] = [];

  for (const feature of nextFeatures.values()) {
    const targetBodyId = isTargetConsumingFeature(feature)
      ? feature.targetBodyId
      : undefined;

    if (
      !targetBodyId ||
      !updatedBodyIds.has(targetBodyId) ||
      updatedFeatureIds.has(feature.id)
    ) {
      continue;
    }

    if (feature.kind === "extrude") {
      assertSupportedExtrudeOperation(
        { ...state, features: nextFeatures },
        feature.operationMode,
        feature.profileKind,
        feature.targetBodyId,
        feature.targetTopologyAnchorId,
        opIndex,
        feature.id
      );
    }

    if (feature.kind === "chamfer" || feature.kind === "fillet") {
      validateEdgeFinishTargetBodyId(
        { ...state, features: nextFeatures },
        feature.kind === "chamfer" ? "feature.chamfer" : "feature.fillet",
        feature.targetBodyId,
        opIndex
      );
      validateEdgeFinishReference(
        { ...state, features: nextFeatures },
        feature.kind === "chamfer" ? "feature.chamfer" : "feature.fillet",
        feature.targetBodyId,
        feature,
        opIndex
      );
    }

    downstreamFeatures.push(feature);
  }

  const entities = new Map(sketch.entities);
  entities.set(entity.id, entity);
  state.sketches.set(sketch.id, { ...sketch, entities });
  pushSketchEntityModified(diff, sketchEntityRef(sketch.id, entity));

  for (const updated of [...updatedFeatures, ...downstreamFeatures]) {
    state.features.set(updated.id, updated);
    pushFeatureModified(diff, featureRef(updated));
    pushBodyModified(diff, bodyRef(updated));
  }

  pushSketchSourceRebuildEffectsForDependentFeatures(
    state,
    updatedFeatures,
    downstreamFeatures,
    diff
  );

  applyDependentSketchConstraints(
    state,
    sketch.id,
    entity.id,
    diff,
    opIndex,
    propagation
  );
}

function pushSketchSourceRebuildEffectsForDependentFeatures(
  state: MutableDocumentState,
  updatedFeatures: readonly Feature[],
  downstreamFeatures: readonly Feature[],
  diff: MutableSemanticDiff
): void {
  for (const sourceFeature of updatedFeatures) {
    if (sourceFeature.kind !== "extrude") {
      continue;
    }

    for (const downstreamFeature of downstreamFeatures) {
      if (!isTargetConsumingFeature(downstreamFeature)) {
        continue;
      }

      if (downstreamFeature.targetBodyId !== sourceFeature.bodyId) {
        continue;
      }

      pushFeatureReferenceEffects(
        diff,
        createScopedSourceExtrudeRebuildReferenceEffects(
          state,
          sourceFeature,
          downstreamFeature
        )
      );
      pushFeatureLifecycleEffects(
        diff,
        createScopedSourceExtrudeRebuildLifecycleEffects(
          sourceFeature,
          downstreamFeature
        )
      );
    }
  }
}

function updateDependentFeatureForSketchEntity(
  feature: Feature,
  entity: SketchEntity,
  opIndex: number,
  sketchId: SketchId
): Feature {
  if (
    feature.kind === "revolve" &&
    feature.axis.sketchId === sketchId &&
    feature.axis.entityId === entity.id
  ) {
    assertRevolveAxisLineEntity(entity, opIndex, sketchId, entity.id);

    return feature;
  }

  if (feature.kind === "hole") {
    assertHoleCircleEntity(entity, opIndex, sketchId, entity.id);
    return feature;
  }

  if (feature.kind === "revolve") {
    return {
      ...feature,
      profileKind: assertRevolvableProfile(entity, opIndex, sketchId, entity.id)
    };
  }

  if (feature.kind === "extrude") {
    return {
      ...feature,
      profileKind: assertExtrudableProfile(entity, opIndex, sketchId, entity.id)
    };
  }

  return feature;
}

interface SketchConstraintPropagationContext {
  readonly visitedConstraintIds: Set<SketchConstraintId>;
}

function createSketchConstraintPropagationContext(
  initialConstraintId?: SketchConstraintId
): SketchConstraintPropagationContext {
  const visitedConstraintIds = new Set<SketchConstraintId>();

  if (initialConstraintId) {
    visitedConstraintIds.add(initialConstraintId);
  }

  return { visitedConstraintIds };
}

function applyDependentSketchConstraints(
  state: MutableDocumentState,
  sketchId: SketchId,
  entityId: SketchEntityId,
  diff: MutableSemanticDiff,
  opIndex: number,
  propagation: SketchConstraintPropagationContext
): void {
  for (const constraint of state.sketchConstraints.values()) {
    if (
      constraint.sketchId !== sketchId ||
      propagation.visitedConstraintIds.has(constraint.id)
    ) {
      continue;
    }

    if (
      constraint.kind === "midpoint" &&
      constraint.lineEntityId === entityId
    ) {
      propagation.visitedConstraintIds.add(constraint.id);
      applyMidpointSketchConstraintToEntity(
        state,
        constraint,
        diff,
        opIndex,
        propagation
      );
      continue;
    }

    if (
      constraint.kind === "coincident" &&
      (constraint.primaryTarget.entityId === entityId ||
        constraint.secondaryTarget.entityId === entityId)
    ) {
      propagation.visitedConstraintIds.add(constraint.id);
      applyCoincidentSketchConstraintToEntities(
        state,
        constraint,
        diff,
        opIndex,
        propagation
      );
    }

    if (
      isLinePairSketchConstraint(constraint) &&
      (constraint.primaryLineEntityId === entityId ||
        constraint.secondaryLineEntityId === entityId)
    ) {
      propagation.visitedConstraintIds.add(constraint.id);
      applyLinePairSketchConstraintToEntity(
        state,
        constraint,
        diff,
        opIndex,
        propagation
      );
    }
  }
}

function addObject(
  objects: Map<ObjectId, SceneObject>,
  object: SceneObject,
  diff: MutableSemanticDiff,
  opIndex?: number
): void {
  if (objects.has(object.id)) {
    throwValidationError({
      code: "OBJECT_ALREADY_EXISTS",
      message: `Object already exists: ${object.id}`,
      opIndex,
      objectId: object.id,
      path: operationPath(opIndex, "id"),
      expected: "unique object id",
      received: object.id
    });
  }

  objects.set(object.id, object);
  diff.created.push(objectRef(object));
}

function getObjectOrThrow(
  objects: ReadonlyMap<ObjectId, SceneObject>,
  id: ObjectId,
  opIndex?: number
): SceneObject {
  const object = objects.get(id);

  if (!object) {
    throwValidationError({
      code: "OBJECT_NOT_FOUND",
      message: `Object does not exist: ${id}`,
      opIndex,
      objectId: id,
      path: operationPath(opIndex, "id"),
      expected: "existing object id",
      received: id
    });
  }

  return object;
}

function assertObjectKind<TKind extends SceneObject["kind"]>(
  object: SceneObject,
  expectedKind: TKind,
  opIndex?: number
): asserts object is Extract<SceneObject, { readonly kind: TKind }> {
  if (object.kind === expectedKind) {
    return;
  }

  throwValidationError({
    code: "OBJECT_KIND_MISMATCH",
    message: `Object ${object.id} is a ${object.kind}, not a ${expectedKind}.`,
    opIndex,
    objectId: object.id,
    path: operationPath(opIndex, "id"),
    expected: expectedKind,
    received: object.kind
  });
}

function addSketch(
  sketches: Map<SketchId, Sketch>,
  sketch: Sketch,
  diff: MutableSemanticDiff,
  opIndex?: number
): void {
  if (sketches.has(sketch.id)) {
    throwValidationError({
      code: "SKETCH_ALREADY_EXISTS",
      message: `Sketch already exists: ${sketch.id}`,
      opIndex,
      sketchId: sketch.id,
      path: operationPath(opIndex, "id"),
      expected: "unique sketch id",
      received: sketch.id
    });
  }

  sketches.set(sketch.id, sketch);
  pushSketchCreated(diff, sketchRef(sketch));
}

function getSketchOrThrow(
  sketches: ReadonlyMap<SketchId, Sketch>,
  id: SketchId,
  opIndex?: number
): Sketch {
  const sketch = sketches.get(id);

  if (!sketch) {
    throwValidationError({
      code: "SKETCH_NOT_FOUND",
      message: `Sketch does not exist: ${id}`,
      opIndex,
      sketchId: id,
      path: operationPath(opIndex, "sketchId"),
      expected: "existing sketch id",
      received: id
    });
  }

  return sketch;
}

function addSketchEntity(
  sketches: Map<SketchId, Sketch>,
  sketch: Sketch,
  entity: SketchEntity,
  diff: MutableSemanticDiff,
  opIndex?: number
): void {
  if (sketch.entities.has(entity.id)) {
    throwValidationError({
      code: "SKETCH_ENTITY_ALREADY_EXISTS",
      message: `Sketch entity already exists: ${entity.id}`,
      opIndex,
      sketchId: sketch.id,
      sketchEntityId: entity.id,
      path: operationPath(opIndex, "id"),
      expected: "unique sketch entity id",
      received: entity.id
    });
  }

  const entities = new Map(sketch.entities);
  entities.set(entity.id, entity);
  sketches.set(sketch.id, { ...sketch, entities });
  pushSketchEntityCreated(diff, sketchEntityRef(sketch.id, entity));
}

function throwSketchEntityNotFound(
  sketchId: SketchId,
  entityId: SketchEntityId,
  opIndex?: number
): never {
  throwValidationError({
    code: "SKETCH_ENTITY_NOT_FOUND",
    message: `Sketch entity does not exist: ${entityId}`,
    opIndex,
    sketchId,
    sketchEntityId: entityId,
    path: operationPath(opIndex, "entityId"),
    expected: "existing sketch entity id",
    received: entityId
  });
}

function addFeature(
  state: MutableDocumentState,
  feature: Feature,
  diff: MutableSemanticDiff,
  opIndex?: number
): void {
  if (hasFeatureId(state, feature.id)) {
    throwValidationError({
      code: "FEATURE_ALREADY_EXISTS",
      message: `Feature already exists: ${feature.id}`,
      opIndex,
      featureId: feature.id,
      path: operationPath(opIndex, "id"),
      expected: "unique feature id",
      received: feature.id
    });
  }

  if (hasBodyId(state, feature.bodyId)) {
    throwValidationError({
      code: "BODY_ALREADY_EXISTS",
      message: `Body already exists: ${feature.bodyId}`,
      opIndex,
      featureId: feature.id,
      bodyId: feature.bodyId,
      path: operationPath(opIndex, "bodyId"),
      expected: "unique body id",
      received: feature.bodyId
    });
  }

  state.features.set(feature.id, feature);
  pushFeatureCreated(diff, featureRef(feature));
  pushBodyCreated(diff, bodyRef(feature));
}

function deleteFeature(
  state: MutableDocumentState,
  id: FeatureId,
  diff: MutableSemanticDiff,
  opIndex?: number
): void {
  const featureId = validateFeatureId(id, opIndex);
  const feature = state.features.get(featureId);

  if (!feature) {
    if (isPrimitiveFeatureId(state, featureId)) {
      throwValidationError({
        code: "FEATURE_NOT_DELETABLE",
        message: `Primitive-derived feature cannot be deleted through feature.delete: ${featureId}`,
        opIndex,
        featureId,
        path: operationPath(opIndex, "id"),
        expected: "authored feature id",
        received: featureId
      });
    }

    throwValidationError({
      code: "FEATURE_NOT_FOUND",
      message: `Feature does not exist: ${featureId}`,
      opIndex,
      featureId,
      path: operationPath(opIndex, "id"),
      expected: "existing authored feature id",
      received: featureId
    });
  }

  const consumingFeature = findConsumingFeatureByTargetBodyId(
    state.features,
    feature.bodyId
  );

  if (consumingFeature) {
    throwValidationError({
      code: "FEATURE_NOT_DELETABLE",
      message: `Feature ${featureId} cannot be deleted because its body is targeted by consuming feature ${consumingFeature.id}.`,
      opIndex,
      featureId,
      bodyId: feature.bodyId,
      path: operationPath(opIndex, "id"),
      expected: "feature body not targeted by a consuming feature",
      received: consumingFeature.id
    });
  }

  state.features.delete(featureId);
  pushFeatureDeleted(diff, featureRef(feature));
  pushBodyDeleted(diff, bodyRef(feature));
}

function updateExtrudeFeature(
  state: MutableDocumentState,
  op: Extract<CadOp, { readonly op: "feature.updateExtrude" }>,
  diff: MutableSemanticDiff,
  opIndex?: number
): void {
  const featureId = validateFeatureId(op.id, opIndex);
  const feature = state.features.get(featureId);

  if (!feature) {
    if (isPrimitiveFeatureId(state, featureId)) {
      throwValidationError({
        code: "FEATURE_NOT_EDITABLE",
        message: `Primitive-derived feature cannot be edited through feature.updateExtrude: ${featureId}`,
        opIndex,
        featureId,
        path: operationPath(opIndex, "id"),
        expected: "authored extrude feature id",
        received: featureId
      });
    }

    throwValidationError({
      code: "FEATURE_NOT_FOUND",
      message: `Feature does not exist: ${featureId}`,
      opIndex,
      featureId,
      path: operationPath(opIndex, "id"),
      expected: "existing authored extrude feature id",
      received: featureId
    });
  }

  if (feature.kind !== "extrude") {
    throwValidationError({
      code: "FEATURE_NOT_EDITABLE",
      message: `Feature cannot be edited through feature.updateExtrude because it is ${feature.kind}: ${featureId}`,
      opIndex,
      featureId,
      path: operationPath(opIndex, "id"),
      expected: "authored extrude feature id",
      received: feature.kind
    });
  }

  if (feature.operationMode !== "newBody") {
    throwValidationError({
      code: "FEATURE_NOT_EDITABLE",
      message: `Feature ${featureId} cannot be edited through feature.updateExtrude because ${feature.operationMode} result topology is not editable as a body-level feature result yet.`,
      opIndex,
      featureId,
      bodyId: feature.bodyId,
      path: operationPath(opIndex, "id"),
      expected: "authored newBody extrude feature id",
      received: feature.operationMode
    });
  }

  const scopedRebuildChain = validateScopedSourceExtrudeRebuildChain(
    state,
    feature,
    "feature.updateExtrude",
    opIndex
  );

  if (op.depth === undefined && op.side === undefined) {
    throwValidationError({
      code: "INVALID_FEATURE",
      message: "feature.updateExtrude requires depth or side.",
      opIndex,
      featureId,
      path: operationPath(opIndex),
      expected: "depth or side",
      received: "no editable fields"
    });
  }

  const updated: ExtrudeFeature = {
    ...feature,
    depth:
      op.depth === undefined
        ? feature.depth
        : validateExtrudeDepth(op.depth, opIndex),
    side:
      op.side === undefined
        ? feature.side
        : validateExtrudeSide(op.side, opIndex)
  };

  state.features.set(featureId, updated);
  pushFeatureModified(diff, featureRef(updated));
  pushBodyModified(diff, bodyRef(updated));
  if (scopedRebuildChain) {
    pushFeatureModified(diff, featureRef(scopedRebuildChain.consumingFeature));
    pushBodyModified(diff, bodyRef(scopedRebuildChain.consumingFeature));
  }
  pushFeatureReferenceEffects(
    diff,
    scopedRebuildChain
      ? createScopedSourceExtrudeRebuildReferenceEffects(
          state,
          updated,
          scopedRebuildChain.consumingFeature
        )
      : createActiveExtrudeEditReferenceEffects(state, updated)
  );
  pushFeatureLifecycleEffects(
    diff,
    scopedRebuildChain
      ? createScopedSourceExtrudeRebuildLifecycleEffects(
          updated,
          scopedRebuildChain.consumingFeature
        )
      : createActiveSourceFeatureEditLifecycleEffects(updated)
  );
}

type TargetConsumingFeature =
  | (ExtrudeFeature & {
      readonly operationMode: "add" | "cut";
      readonly targetBodyId: BodyId;
    })
  | HoleFeature
  | ChamferFeature
  | FilletFeature;

interface ScopedSourceExtrudeRebuildChain {
  readonly consumingFeature: TargetConsumingFeature;
}

function validateScopedSourceExtrudeRebuildChain(
  state: MutableDocumentState,
  feature: ExtrudeFeature,
  operation: CadOp["op"],
  opIndex?: number
): ScopedSourceExtrudeRebuildChain | undefined {
  const consumingFeatures = findConsumingFeaturesByTargetBodyId(
    state.features,
    feature.bodyId
  );

  if (consumingFeatures.length === 0) {
    return undefined;
  }

  if (consumingFeatures.length > 1) {
    throwValidationError({
      code: "FEATURE_NOT_EDITABLE",
      message: `Feature ${feature.id} cannot be edited through ${operation} because body ${feature.bodyId} has multiple downstream consumers.`,
      opIndex,
      featureId: feature.id,
      bodyId: feature.bodyId,
      path: operationPath(opIndex, "id"),
      expected: "one direct supported consuming feature",
      received: consumingFeatures.map((candidate) => candidate.id).join(", ")
    });
  }

  const consumingFeature = consumingFeatures[0];
  const nextConsumer = findConsumingFeatureByTargetBodyId(
    state.features,
    consumingFeature.bodyId
  );

  if (nextConsumer) {
    throwValidationError({
      code: "FEATURE_NOT_EDITABLE",
      message: `Feature ${feature.id} cannot be edited through ${operation} because downstream result body ${consumingFeature.bodyId} is consumed by feature ${nextConsumer.id}.`,
      opIndex,
      featureId: feature.id,
      bodyId: feature.bodyId,
      path: operationPath(opIndex, "id"),
      expected: "one direct supported consuming feature",
      received: nextConsumer.id
    });
  }

  validateDirectConsumingFeatureForSourceExtrudeRebuild(
    state,
    consumingFeature,
    opIndex
  );

  return { consumingFeature };
}

function validateDirectConsumingFeatureForSourceExtrudeRebuild(
  state: MutableDocumentState,
  feature: TargetConsumingFeature,
  opIndex?: number
): void {
  if (feature.kind === "extrude") {
    assertSupportedExtrudeOperation(
      state,
      feature.operationMode,
      feature.profileKind,
      feature.targetBodyId,
      feature.targetTopologyAnchorId,
      opIndex,
      feature.id
    );
    return;
  }

  if (feature.kind === "hole") {
    const sketch = getSketchOrThrow(state.sketches, feature.sketchId, opIndex);
    const entity = sketch.entities.get(feature.circleEntityId);

    if (!entity) {
      throwSketchEntityNotFound(
        feature.sketchId,
        feature.circleEntityId,
        opIndex
      );
    }

    assertHoleCircleEntity(
      entity,
      opIndex,
      feature.sketchId,
      feature.circleEntityId
    );
    validateHoleSketchAttachment(state, sketch, opIndex);
    assertSupportedHoleTarget(
      state,
      feature.targetBodyId,
      feature.targetTopologyAnchorId,
      opIndex
    );
    return;
  }

  assertSupportedEdgeFinishTarget(
    state,
    feature.kind === "chamfer" ? "feature.chamfer" : "feature.fillet",
    feature.targetBodyId,
    opIndex
  );
  validateEdgeFinishReference(
    state,
    feature.kind === "chamfer" ? "feature.chamfer" : "feature.fillet",
    feature.targetBodyId,
    feature,
    opIndex
  );
}

function updateRevolveFeature(
  state: MutableDocumentState,
  op: Extract<CadOp, { readonly op: "feature.updateRevolve" }>,
  diff: MutableSemanticDiff,
  opIndex?: number
): void {
  const feature = getEditableFeatureForUpdate(
    state,
    op.id,
    "revolve",
    "feature.updateRevolve",
    opIndex
  );

  if (feature.operationMode !== "newBody") {
    throwValidationError({
      code: "FEATURE_NOT_EDITABLE",
      message: `Feature ${feature.id} cannot be edited through feature.updateRevolve because ${feature.operationMode} result topology is not editable as a body-level feature result yet.`,
      opIndex,
      featureId: feature.id,
      bodyId: feature.bodyId,
      path: operationPath(opIndex, "id"),
      expected: "authored newBody revolve feature id",
      received: feature.operationMode
    });
  }

  assertFeatureResultBodyActiveForEdit(
    state,
    feature,
    "feature.updateRevolve",
    opIndex
  );

  const updated: RevolveFeature = {
    ...feature,
    angleDegrees: validateRevolveAngleDegrees(op.angleDegrees, opIndex)
  };

  state.features.set(feature.id, updated);
  pushFeatureModified(diff, featureRef(updated));
  pushBodyModified(diff, bodyRef(updated));
  pushFeatureReferenceEffects(
    diff,
    createAmbiguousResultFeatureEditReferenceEffects(
      updated,
      "Revolve result topology remains repair-needed after supported source parameter edit."
    )
  );
  pushFeatureLifecycleEffects(
    diff,
    createAmbiguousResultFeatureEditLifecycleEffects(
      updated,
      "Revolve result body requires derived rebuild and topology repair after supported source parameter edit."
    )
  );
}

function updateHoleFeature(
  state: MutableDocumentState,
  op: Extract<CadOp, { readonly op: "feature.updateHole" }>,
  diff: MutableSemanticDiff,
  opIndex?: number
): void {
  const feature = getEditableFeatureForUpdate(
    state,
    op.id,
    "hole",
    "feature.updateHole",
    opIndex
  );
  const sketch = getSketchOrThrow(state.sketches, feature.sketchId, opIndex);
  const entity = sketch.entities.get(feature.circleEntityId);

  if (!entity) {
    throwSketchEntityNotFound(
      feature.sketchId,
      feature.circleEntityId,
      opIndex
    );
  }

  assertHoleCircleEntity(
    entity,
    opIndex,
    feature.sketchId,
    feature.circleEntityId
  );
  validateHoleSketchAttachment(state, sketch, opIndex);
  assertFeatureResultBodyActiveForEdit(
    state,
    feature,
    "feature.updateHole",
    opIndex
  );
  assertConsumingFeatureTargetOwnedByEditedFeature(
    state,
    feature,
    "feature.updateHole",
    opIndex
  );
  assertSupportedHoleTarget(
    state,
    feature.targetBodyId,
    feature.targetTopologyAnchorId,
    opIndex
  );

  if (
    op.depthMode === undefined &&
    op.depth === undefined &&
    op.direction === undefined
  ) {
    throwValidationError({
      code: "INVALID_FEATURE",
      message: "feature.updateHole requires depthMode, depth, or direction.",
      opIndex,
      featureId: feature.id,
      path: operationPath(opIndex),
      expected: "depthMode, depth, or direction",
      received: "no editable fields"
    });
  }

  const depthMode =
    op.depthMode === undefined
      ? feature.depthMode
      : validateHoleDepthMode(op.depthMode, opIndex);
  const depth = validateHoleDepth(
    depthMode,
    op.depth === undefined && depthMode === feature.depthMode
      ? feature.depth
      : op.depth,
    opIndex
  );
  const direction =
    op.direction === undefined
      ? feature.direction
      : validateHoleDirection(op.direction, opIndex);
  const updated = createUpdatedHoleFeature(
    feature,
    depthMode,
    depth,
    direction
  );

  state.features.set(feature.id, updated);
  pushFeatureModified(diff, featureRef(updated));
  pushBodyModified(diff, bodyRef(updated));
  pushFeatureReferenceEffects(
    diff,
    createConsumingFeatureEditReferenceEffects(state, updated)
  );
  pushFeatureLifecycleEffects(
    diff,
    createConsumingFeatureEditLifecycleEffects(
      updated,
      "Hole result body was modified and derived geometry rebuild is pending after supported source parameter edit."
    )
  );
}

function updateChamferFeature(
  state: MutableDocumentState,
  op: Extract<CadOp, { readonly op: "feature.updateChamfer" }>,
  diff: MutableSemanticDiff,
  opIndex?: number
): void {
  const feature = getEditableFeatureForUpdate(
    state,
    op.id,
    "chamfer",
    "feature.updateChamfer",
    opIndex
  );
  const updated: ChamferFeature = {
    ...feature,
    distance: validateEdgeFinishScalar(op.distance, "feature.chamfer", opIndex)
  };

  assertEdgeFinishFeatureEditable(state, updated, "feature.chamfer", opIndex);
  state.features.set(feature.id, updated);
  pushFeatureModified(diff, featureRef(updated));
  pushBodyModified(diff, bodyRef(updated));
  pushFeatureReferenceEffects(
    diff,
    createConsumingFeatureEditReferenceEffects(state, updated)
  );
  pushFeatureLifecycleEffects(
    diff,
    createConsumingFeatureEditLifecycleEffects(
      updated,
      "Chamfer result body requires derived rebuild and topology repair after supported source parameter edit."
    )
  );
}

function updateFilletFeature(
  state: MutableDocumentState,
  op: Extract<CadOp, { readonly op: "feature.updateFillet" }>,
  diff: MutableSemanticDiff,
  opIndex?: number
): void {
  const feature = getEditableFeatureForUpdate(
    state,
    op.id,
    "fillet",
    "feature.updateFillet",
    opIndex
  );
  const updated: FilletFeature = {
    ...feature,
    radius: validateEdgeFinishScalar(op.radius, "feature.fillet", opIndex)
  };

  assertEdgeFinishFeatureEditable(state, updated, "feature.fillet", opIndex);
  state.features.set(feature.id, updated);
  pushFeatureModified(diff, featureRef(updated));
  pushBodyModified(diff, bodyRef(updated));
  pushFeatureReferenceEffects(
    diff,
    createConsumingFeatureEditReferenceEffects(state, updated)
  );
  pushFeatureLifecycleEffects(
    diff,
    createConsumingFeatureEditLifecycleEffects(
      updated,
      "Fillet result body requires derived rebuild and topology repair after supported source parameter edit."
    )
  );
}

function getEditableFeatureForUpdate<K extends Feature["kind"]>(
  state: MutableDocumentState,
  featureIdInput: FeatureId,
  expectedKind: K,
  operation: CadOp["op"],
  opIndex?: number
): Extract<Feature, { readonly kind: K }> {
  const featureId = validateFeatureId(featureIdInput, opIndex);
  const feature = state.features.get(featureId);

  if (!feature) {
    if (isPrimitiveFeatureId(state, featureId)) {
      throwValidationError({
        code: "FEATURE_NOT_EDITABLE",
        message: `Primitive-derived feature cannot be edited through ${operation}: ${featureId}`,
        opIndex,
        featureId,
        path: operationPath(opIndex, "id"),
        expected: `authored ${expectedKind} feature id`,
        received: featureId
      });
    }

    throwValidationError({
      code: "FEATURE_NOT_FOUND",
      message: `Feature does not exist: ${featureId}`,
      opIndex,
      featureId,
      path: operationPath(opIndex, "id"),
      expected: `existing authored ${expectedKind} feature id`,
      received: featureId
    });
  }

  if (feature.kind !== expectedKind) {
    throwValidationError({
      code: "FEATURE_NOT_EDITABLE",
      message: `Feature cannot be edited through ${operation} because it is ${feature.kind}: ${featureId}`,
      opIndex,
      featureId,
      path: operationPath(opIndex, "id"),
      expected: `authored ${expectedKind} feature id`,
      received: feature.kind
    });
  }

  return feature as Extract<Feature, { readonly kind: K }>;
}

function assertFeatureResultBodyActiveForEdit(
  state: MutableDocumentState,
  feature: Feature,
  operation: CadOp["op"],
  opIndex?: number
): void {
  const consumingFeature = findConsumingFeatureByTargetBodyId(
    state.features,
    feature.bodyId
  );

  if (!consumingFeature) {
    return;
  }

  throwValidationError({
    code: "FEATURE_NOT_EDITABLE",
    message: `Feature ${feature.id} cannot be edited through ${operation} because its result body ${feature.bodyId} is consumed by feature ${consumingFeature.id}.`,
    opIndex,
    featureId: feature.id,
    bodyId: feature.bodyId,
    path: operationPath(opIndex, "id"),
    expected: "active feature result body",
    received: consumingFeature.id
  });
}

function assertConsumingFeatureTargetOwnedByEditedFeature(
  state: MutableDocumentState,
  feature: Extract<Feature, { readonly targetBodyId: BodyId }>,
  operation: CadOp["op"],
  opIndex?: number
): void {
  const consumingFeature = findConsumingFeatureByTargetBodyId(
    state.features,
    feature.targetBodyId
  );

  if (consumingFeature?.id === feature.id) {
    return;
  }

  throwValidationError({
    code: "FEATURE_NOT_EDITABLE",
    message: `Feature ${feature.id} cannot be edited through ${operation} because target body ${feature.targetBodyId} is not consumed by that feature.`,
    opIndex,
    featureId: feature.id,
    bodyId: feature.bodyId,
    path: operationPath(opIndex, "id"),
    expected: "target body consumed only by the edited feature",
    received: consumingFeature?.id ?? "active target body"
  });
}

function assertEdgeFinishFeatureEditable(
  state: MutableDocumentState,
  feature: ChamferFeature | FilletFeature,
  operation: EdgeFinishOperation,
  opIndex?: number
): void {
  assertFeatureResultBodyActiveForEdit(state, feature, operation, opIndex);
  assertConsumingFeatureTargetOwnedByEditedFeature(
    state,
    feature,
    operation,
    opIndex
  );
  assertSupportedEdgeFinishTarget(
    state,
    operation,
    feature.targetBodyId,
    opIndex
  );
  validateEdgeFinishReference(
    state,
    operation,
    feature.targetBodyId,
    feature,
    opIndex
  );
}

function assertSupportedEdgeFinishTarget(
  state: MutableDocumentState,
  operation: EdgeFinishOperation,
  targetBodyId: BodyId,
  opIndex?: number
): void {
  const targetFeature = findFeatureByBodyId(state.features, targetBodyId);

  if (!targetFeature) {
    if (isPrimitiveBodyId(state, targetBodyId)) {
      throwValidationError({
        code: "TARGET_BODY_NOT_SUPPORTED",
        message: `Primitive-derived body cannot be targeted by ${operation}: ${targetBodyId}`,
        opIndex,
        bodyId: targetBodyId,
        path: operationPath(opIndex, "targetBodyId"),
        expected: "active rectangle/circle newBody extrude target body",
        received: targetBodyId
      });
    }

    throwValidationError({
      code: "BODY_NOT_FOUND",
      message: `Target body does not exist: ${targetBodyId}`,
      opIndex,
      bodyId: targetBodyId,
      path: operationPath(opIndex, "targetBodyId"),
      expected: "existing authored target body id",
      received: targetBodyId
    });
  }

  if (
    targetFeature.kind === "extrude" &&
    targetFeature.operationMode === "newBody" &&
    isSupportedCutTargetProfileKind(targetFeature.profileKind)
  ) {
    return;
  }

  throwValidationError({
    code: "UNSUPPORTED_FEATURE_OPERATION",
    message: `${operation} edits require the original target to remain a stable generated edge on a rectangle or circle newBody extrude target body.`,
    opIndex,
    bodyId: targetBodyId,
    path: operationPath(opIndex, "targetBodyId"),
    expected: "rectangle/circle newBody extrude target body",
    received: describeReceived({
      targetBodyId,
      targetFeatureKind: targetFeature.kind,
      targetProfileKind:
        targetFeature.kind === "extrude"
          ? targetFeature.profileKind
          : undefined,
      targetOperationMode:
        targetFeature.kind === "extrude"
          ? targetFeature.operationMode
          : undefined
    })
  });
}

function createUpdatedHoleFeature(
  feature: HoleFeature,
  depthMode: FeatureHoleDepthMode,
  depth: number | undefined,
  direction: FeatureHoleDirection
): HoleFeature {
  const common = {
    id: feature.id,
    kind: "hole" as const,
    name: feature.name,
    targetBodyId: feature.targetBodyId,
    sketchId: feature.sketchId,
    circleEntityId: feature.circleEntityId,
    depthMode,
    direction,
    bodyId: feature.bodyId
  };

  return depth === undefined ? common : { ...common, depth };
}

function createActiveExtrudeEditReferenceEffects(
  state: MutableDocumentState,
  feature: ExtrudeFeature
): readonly CadFeatureReferenceChangeSummary[] {
  const generatedReferences = listGeneratedReferences(
    createBodyGeneratedReferences(state, feature.bodyId, DEFAULT_PART_ID)
  ).map((reference) => ({
    category: "active" as const,
    bodyId: feature.bodyId,
    stableId: reference.stableId,
    kind: reference.kind,
    sourceFeatureId: feature.id,
    message:
      "Generated reference remains active after supported authored extrude source edit."
  }));
  const namedReferences = [...state.namedReferences.values()]
    .filter((reference) => reference.bodyId === feature.bodyId)
    .map((reference) => ({
      category: "active" as const,
      bodyId: reference.bodyId,
      stableId: reference.stableId,
      kind: reference.kind,
      referenceName: reference.name,
      sourceFeatureId: feature.id,
      message:
        "Named reference remains active after supported authored extrude source edit."
    }));

  return [...generatedReferences, ...namedReferences];
}

function createAmbiguousResultFeatureEditReferenceEffects(
  feature: Feature,
  message: string
): readonly CadFeatureReferenceChangeSummary[] {
  return [
    {
      category: "repair-needed",
      bodyId: feature.bodyId,
      sourceFeatureId: feature.id,
      diagnosticCode: "AMBIGUOUS_RESULT_TOPOLOGY",
      message
    }
  ];
}

function createConsumingFeatureEditReferenceEffects(
  state: MutableDocumentState,
  feature: HoleFeature | ChamferFeature | FilletFeature
): readonly CadFeatureReferenceChangeSummary[] {
  if (feature.kind === "hole") {
    const targetGeneratedReferences = listGeneratedReferences(
      createBodyGeneratedReferences(
        state,
        feature.targetBodyId,
        DEFAULT_PART_ID
      )
    ).map((reference) => ({
      category: "consumed" as const,
      bodyId: feature.targetBodyId,
      stableId: reference.stableId,
      kind: reference.kind,
      sourceFeatureId: feature.id,
      targetFeatureId: feature.id,
      diagnosticCode: "CONSUMED_REFERENCE_NOT_COMMAND_READY" as const,
      message:
        "Target-body generated reference remains consumed by the edited hole feature."
    }));
    const targetNamedReferences = [...state.namedReferences.values()]
      .filter((reference) => reference.bodyId === feature.targetBodyId)
      .map((reference) => ({
        category: "consumed" as const,
        bodyId: reference.bodyId,
        stableId: reference.stableId,
        kind: reference.kind,
        referenceName: reference.name,
        sourceFeatureId: feature.id,
        targetFeatureId: feature.id,
        diagnosticCode: "CONSUMED_REFERENCE_NOT_COMMAND_READY" as const,
        message:
          "Target-body named reference remains consumed by the edited hole feature."
      }));
    const resultGeneratedReferences = listGeneratedReferences(
      createBodyGeneratedReferences(state, feature.bodyId, DEFAULT_PART_ID)
    ).map((reference) => ({
      category: "active" as const,
      bodyId: feature.bodyId,
      stableId: reference.stableId,
      kind: reference.kind,
      sourceFeatureId: feature.id,
      message:
        "Hole result generated reference remains active after supported source parameter edit."
    }));
    const resultNamedReferences = [...state.namedReferences.values()]
      .filter((reference) => reference.bodyId === feature.bodyId)
      .map((reference) => ({
        category: "active" as const,
        bodyId: reference.bodyId,
        stableId: reference.stableId,
        kind: reference.kind,
        referenceName: reference.name,
        sourceFeatureId: feature.id,
        message:
          "Hole result named reference remains active after supported source parameter edit."
      }));

    return [
      ...targetGeneratedReferences,
      ...targetNamedReferences,
      ...resultGeneratedReferences,
      ...resultNamedReferences
    ];
  }

  const resultEffects = createAmbiguousResultFeatureEditReferenceEffects(
    feature,
    `${formatFeatureKindForMessage(feature.kind)} result topology remains repair-needed after supported source parameter edit.`
  );

  const sourceReferenceEffect = createEdgeFinishSourceReferenceEffect(
    state,
    feature
  );

  return sourceReferenceEffect
    ? [sourceReferenceEffect, ...resultEffects]
    : resultEffects;
}

function createEdgeFinishSourceReferenceEffect(
  state: MutableDocumentState,
  feature: ChamferFeature | FilletFeature
): CadFeatureReferenceChangeSummary | undefined {
  const references = createBodyGeneratedReferences(
    state,
    feature.targetBodyId,
    DEFAULT_PART_ID
  );
  const stableId =
    feature.edgeStableId ??
    (feature.namedReference
      ? state.namedReferences.get(feature.namedReference)?.stableId
      : undefined);

  if (!references || !stableId) {
    return undefined;
  }

  const resolution = resolveGeneratedReference(references, stableId);

  if (!resolution) {
    return undefined;
  }

  return {
    category: "active",
    bodyId: feature.targetBodyId,
    stableId,
    kind: resolution.kind,
    ...(feature.namedReference
      ? { referenceName: feature.namedReference }
      : {}),
    ...(feature.topologyAnchorId
      ? { topologyAnchorId: feature.topologyAnchorId }
      : {}),
    sourceFeatureId: feature.id,
    targetFeatureId: feature.id,
    message:
      "Source edge reference remains active for this feature's own parameter edit."
  };
}

function createActiveSourceFeatureEditLifecycleEffects(
  feature: ExtrudeFeature
): readonly CadBodyLifecycleEffectSummary[] {
  return [
    {
      bodyId: feature.bodyId,
      featureId: feature.id,
      primaryState: "derived-rebuild-pending",
      states: ["active", "source", "modified", "derived-rebuild-pending"],
      diagnosticCode: "REBUILD_DERIVED_PENDING",
      message:
        "Authored extrude source body was modified and derived geometry rebuild is pending."
    }
  ];
}

function createAmbiguousResultFeatureEditLifecycleEffects(
  feature: Feature,
  message: string
): readonly CadBodyLifecycleEffectSummary[] {
  return [
    {
      bodyId: feature.bodyId,
      featureId: feature.id,
      primaryState: "repair-needed",
      states: [
        "active",
        "result",
        "modified",
        "derived-rebuild-pending",
        "repair-needed",
        "ambiguous"
      ],
      diagnosticCode: "REBUILD_RESULT_TOPOLOGY_AMBIGUOUS",
      message
    }
  ];
}

function createConsumingFeatureEditLifecycleEffects(
  feature: HoleFeature | ChamferFeature | FilletFeature,
  resultMessage: string
): readonly CadBodyLifecycleEffectSummary[] {
  const resultEffects =
    feature.kind === "hole"
      ? [
          {
            bodyId: feature.bodyId,
            featureId: feature.id,
            primaryState: "derived-rebuild-pending" as const,
            states: [
              "active",
              "result",
              "modified",
              "derived-rebuild-pending"
            ] as const,
            diagnosticCode: "REBUILD_DERIVED_PENDING" as const,
            message: resultMessage
          }
        ]
      : createAmbiguousResultFeatureEditLifecycleEffects(
          feature,
          resultMessage
        );

  return [
    {
      bodyId: feature.targetBodyId,
      featureId: feature.id,
      primaryState: "consumed",
      states: ["consumed"],
      diagnosticCode: "REBUILD_TARGET_CONSUMED",
      message: `Target body ${feature.targetBodyId} remains consumed by edited ${feature.kind} feature ${feature.id}.`
    },
    ...resultEffects
  ];
}

function createScopedSourceExtrudeRebuildReferenceEffects(
  state: MutableDocumentState,
  sourceFeature: ExtrudeFeature,
  consumingFeature: TargetConsumingFeature
): readonly CadFeatureReferenceChangeSummary[] {
  const targetGeneratedReferences = listGeneratedReferences(
    createBodyGeneratedReferences(state, sourceFeature.bodyId, DEFAULT_PART_ID)
  ).map((reference) => ({
    category: "consumed" as const,
    bodyId: sourceFeature.bodyId,
    stableId: reference.stableId,
    kind: reference.kind,
    sourceFeatureId: sourceFeature.id,
    targetFeatureId: consumingFeature.id,
    diagnosticCode: "CONSUMED_REFERENCE_NOT_COMMAND_READY" as const,
    message:
      "Source generated reference remains consumed by the downstream revalidated feature."
  }));
  const targetNamedReferences = [...state.namedReferences.values()]
    .filter((reference) => reference.bodyId === sourceFeature.bodyId)
    .map((reference) => ({
      category: "consumed" as const,
      bodyId: reference.bodyId,
      stableId: reference.stableId,
      kind: reference.kind,
      referenceName: reference.name,
      sourceFeatureId: sourceFeature.id,
      targetFeatureId: consumingFeature.id,
      diagnosticCode: "CONSUMED_REFERENCE_NOT_COMMAND_READY" as const,
      message:
        "Source named reference remains consumed by the downstream revalidated feature."
    }));
  const resultReplacement: CadFeatureReferenceChangeSummary = {
    category: consumingFeature.kind === "hole" ? "active" : "replaced",
    bodyId: consumingFeature.bodyId,
    sourceFeatureId: sourceFeature.id,
    targetFeatureId: consumingFeature.id,
    ...(consumingFeature.kind === "hole"
      ? {}
      : { diagnosticCode: "AMBIGUOUS_RESULT_TOPOLOGY" as const }),
    message:
      consumingFeature.kind === "hole"
        ? "Downstream hole result references remain active after source-model revalidation."
        : "Downstream result body was revalidated from existing source records after the source edit; result topology remains repair-needed."
  };

  return [
    ...targetGeneratedReferences,
    ...targetNamedReferences,
    ...createScopedResultActiveReferenceEffects(
      state,
      sourceFeature,
      consumingFeature
    ),
    resultReplacement
  ];
}

function createScopedResultActiveReferenceEffects(
  state: MutableDocumentState,
  sourceFeature: ExtrudeFeature,
  consumingFeature: TargetConsumingFeature
): readonly CadFeatureReferenceChangeSummary[] {
  if (
    consumingFeature.kind !== "extrude" ||
    (consumingFeature.operationMode !== "cut" &&
      consumingFeature.operationMode !== "add")
  ) {
    return [];
  }

  const references = createBodyGeneratedReferences(
    state,
    consumingFeature.bodyId,
    DEFAULT_PART_ID
  );

  if (!references) {
    return [];
  }

  const commandReadyReferences = listGeneratedReferences(references).filter(
    (reference) => reference.eligibleOperations.length > 0
  );
  const commandReadyStableIds = new Set(
    commandReadyReferences.map((reference) => reference.stableId)
  );
  const generatedEffects = commandReadyReferences.map((reference) => ({
    category: "active" as const,
    bodyId: consumingFeature.bodyId,
    stableId: reference.stableId,
    kind: reference.kind,
    sourceFeatureId: sourceFeature.id,
    targetFeatureId: consumingFeature.id,
    message:
      "Source-semantic result generated reference remains active after downstream source-model revalidation."
  }));
  const namedEffects = [...state.namedReferences.values()]
    .filter(
      (reference) =>
        reference.bodyId === consumingFeature.bodyId &&
        commandReadyStableIds.has(reference.stableId)
    )
    .map((reference) => ({
      category: "active" as const,
      bodyId: reference.bodyId,
      stableId: reference.stableId,
      kind: reference.kind,
      referenceName: reference.name,
      sourceFeatureId: sourceFeature.id,
      targetFeatureId: consumingFeature.id,
      message:
        "Source-semantic result named reference remains active after downstream source-model revalidation."
    }));

  return [...generatedEffects, ...namedEffects];
}

function createScopedSourceExtrudeRebuildLifecycleEffects(
  sourceFeature: ExtrudeFeature,
  consumingFeature: TargetConsumingFeature
): readonly CadBodyLifecycleEffectSummary[] {
  const resultEffect: CadBodyLifecycleEffectSummary =
    consumingFeature.kind === "hole"
      ? {
          bodyId: consumingFeature.bodyId,
          featureId: consumingFeature.id,
          primaryState: "replacement",
          states: ["active", "result", "modified", "replacement"],
          message:
            "Downstream hole result body was revalidated from existing source records; generated result references remain source-semantic."
        }
      : {
          bodyId: consumingFeature.bodyId,
          featureId: consumingFeature.id,
          primaryState: "replacement",
          states: ["active", "result", "modified", "replacement"],
          diagnosticCode: "REBUILD_RESULT_REPAIR_NEEDED",
          message:
            "Downstream result body was revalidated from existing source records; generated result topology remains repair-needed."
        };

  return [
    {
      bodyId: sourceFeature.bodyId,
      featureId: sourceFeature.id,
      targetFeatureId: consumingFeature.id,
      primaryState: "consumed",
      states: ["consumed", "source", "modified"],
      diagnosticCode: "REBUILD_TARGET_CONSUMED",
      message: `Source body ${sourceFeature.bodyId} was edited and remains consumed by revalidated feature ${consumingFeature.id}.`
    },
    resultEffect
  ];
}

function formatFeatureKindForMessage(kind: Feature["kind"]): string {
  return kind[0].toUpperCase() + kind.slice(1);
}

function validateFeatureId(id: FeatureId, opIndex?: number): FeatureId {
  if (typeof id === "string" && id.trim().length > 0) {
    return id;
  }

  throwValidationError({
    code: "INVALID_FEATURE",
    message: "Feature id must be a non-empty string.",
    opIndex,
    featureId: id,
    path: operationPath(opIndex, "id"),
    expected: "non-empty feature id",
    received: describeReceived(id)
  });
}

function hasFeatureId(state: MutableDocumentState, id: FeatureId): boolean {
  if (state.features.has(id)) {
    return true;
  }

  return isPrimitiveFeatureId(state, id);
}

function isPrimitiveFeatureId(
  state: MutableDocumentState,
  id: FeatureId
): boolean {
  for (const objectId of state.objects.keys()) {
    if (createPrimitiveFeatureId(objectId) === id) {
      return true;
    }
  }

  return false;
}

function hasBodyId(state: MutableDocumentState, id: BodyId): boolean {
  for (const feature of state.features.values()) {
    if (feature.bodyId === id) {
      return true;
    }
  }

  for (const objectId of state.objects.keys()) {
    if (createPrimitiveBodyId(objectId) === id) {
      return true;
    }
  }

  return false;
}

function findFeatureByBodyId(
  features: ReadonlyMap<FeatureId, Feature>,
  bodyId: BodyId
): Feature | undefined {
  return [...features.values()].find((feature) => feature.bodyId === bodyId);
}

function findConsumingFeatureByTargetBodyId(
  features: ReadonlyMap<FeatureId, Feature>,
  targetBodyId: BodyId
): Feature | undefined {
  return findConsumingFeaturesByTargetBodyId(features, targetBodyId)[0];
}

function findConsumingFeaturesByTargetBodyId(
  features: ReadonlyMap<FeatureId, Feature>,
  targetBodyId: BodyId
): readonly TargetConsumingFeature[] {
  const consumingFeatures: TargetConsumingFeature[] = [];

  for (const feature of features.values()) {
    if (
      isTargetConsumingFeature(feature) &&
      feature.targetBodyId === targetBodyId
    ) {
      consumingFeatures.push(feature);
    }
  }

  return consumingFeatures;
}

function isTargetConsumingFeature(
  feature: Feature
): feature is TargetConsumingFeature {
  return (
    (feature.kind === "extrude" &&
      isConsumingExtrudeOperationMode(feature.operationMode) &&
      feature.targetBodyId !== undefined) ||
    feature.kind === "hole" ||
    feature.kind === "chamfer" ||
    feature.kind === "fillet"
  );
}

function isConsumingExtrudeOperationMode(
  operationMode: FeatureExtrudeOperationMode
): operationMode is "add" | "cut" {
  return operationMode === "add" || operationMode === "cut";
}

function isSupportedCutTargetProfileKind(
  profileKind: FeatureExtrudeProfileKind
): boolean {
  return profileKind === "rectangle" || profileKind === "circle";
}

function isSupportedAddTargetProfileKind(
  profileKind: FeatureExtrudeProfileKind
): boolean {
  return profileKind === "rectangle";
}

function isSupportedBooleanToolProfileKind(
  profileKind: FeatureExtrudeProfileKind
): boolean {
  return profileKind === "rectangle" || profileKind === "circle";
}

function isPrimitiveBodyId(state: MutableDocumentState, id: BodyId): boolean {
  for (const objectId of state.objects.keys()) {
    if (createPrimitiveBodyId(objectId) === id) {
      return true;
    }
  }

  return false;
}

function assertSketchNotInUse(
  features: ReadonlyMap<FeatureId, Feature>,
  sketchId: SketchId,
  opIndex?: number
): void {
  const feature = [...features.values()].find((candidate) =>
    featureUsesSketch(candidate, sketchId)
  );

  if (!feature) {
    return;
  }

  throwValidationError({
    code: "SKETCH_IN_USE",
    message: `Sketch ${sketchId} is used by feature ${feature.id}.`,
    opIndex,
    sketchId,
    featureId: feature.id,
    path: operationPath(opIndex, "id"),
    expected: "sketch with no dependent features",
    received: sketchId
  });
}

function featureUsesSketch(feature: Feature, sketchId: SketchId): boolean {
  if (feature.kind === "chamfer" || feature.kind === "fillet") {
    return false;
  }

  return feature.sketchId === sketchId;
}

function assertSketchEntityNotInUse(
  features: ReadonlyMap<FeatureId, Feature>,
  sketchId: SketchId,
  entityId: SketchEntityId,
  opIndex?: number
): void {
  const feature = findFeaturesBySketchEntity(features, sketchId, entityId)[0];

  if (!feature) {
    return;
  }

  throwValidationError({
    code: "SKETCH_ENTITY_IN_USE",
    message: `Sketch entity ${entityId} is used by feature ${feature.id}.`,
    opIndex,
    sketchId,
    sketchEntityId: entityId,
    featureId: feature.id,
    path: operationPath(opIndex, "entityId"),
    expected: "sketch entity with no dependent features",
    received: entityId
  });
}

function findFeaturesBySketchEntity(
  features: ReadonlyMap<FeatureId, Feature>,
  sketchId: SketchId,
  entityId: SketchEntityId
): readonly Feature[] {
  return [...features.values()].filter((feature) => {
    if (
      feature.kind === "hole" &&
      feature.sketchId === sketchId &&
      feature.circleEntityId === entityId
    ) {
      return true;
    }

    if (
      (feature.kind === "extrude" || feature.kind === "revolve") &&
      feature.sketchId === sketchId &&
      feature.entityId === entityId
    ) {
      return true;
    }

    return (
      feature.kind === "revolve" &&
      feature.axis.sketchId === sketchId &&
      feature.axis.entityId === entityId
    );
  });
}

function assertExtrudableProfile(
  entity: SketchEntity,
  opIndex: number | undefined,
  sketchId: SketchId,
  entityId: SketchEntityId
): FeatureExtrudeProfileKind {
  return assertSupportedFeatureProfile(
    entity,
    opIndex,
    sketchId,
    entityId,
    "feature.extrude"
  );
}

function assertRevolvableProfile(
  entity: SketchEntity,
  opIndex: number | undefined,
  sketchId: SketchId,
  entityId: SketchEntityId
): FeatureRevolveProfileKind {
  return assertSupportedFeatureProfile(
    entity,
    opIndex,
    sketchId,
    entityId,
    "feature.revolve"
  );
}

function assertSupportedFeatureProfile(
  entity: SketchEntity,
  opIndex: number | undefined,
  sketchId: SketchId,
  entityId: SketchEntityId,
  commandName: "feature.extrude" | "feature.revolve"
): FeatureExtrudeProfileKind {
  if (entity.kind === "rectangle" || entity.kind === "circle") {
    return entity.kind;
  }

  throwValidationError({
    code: "UNSUPPORTED_SKETCH_PROFILE",
    message: `${commandName} currently supports rectangle and circle entities only.`,
    opIndex,
    sketchId,
    sketchEntityId: entityId,
    path: operationPath(opIndex, "entityId"),
    expected: "rectangle or circle sketch entity",
    received: entity.kind
  });
}

function validateRevolveAxis(
  state: MutableDocumentState,
  value: FeatureRevolveAxis,
  sketchId: SketchId,
  opIndex?: number
): FeatureRevolveAxis {
  if (!isRecord(value) || value.type !== "sketchLine") {
    throwValidationError({
      code: "INVALID_FEATURE",
      message: "Revolve axis must be a sketchLine axis.",
      opIndex,
      path: operationPath(opIndex, "axis"),
      expected: "sketchLine axis",
      received: describeReceived(value)
    });
  }

  if (value.sketchId !== sketchId) {
    throwValidationError({
      code: "INVALID_FEATURE",
      message: "Revolve axis line must belong to the same sketch.",
      opIndex,
      sketchId,
      sketchEntityId: value.entityId,
      path: operationPath(opIndex, "axis.sketchId"),
      expected: sketchId,
      received: describeReceived(value.sketchId)
    });
  }

  const sketch = getSketchOrThrow(state.sketches, value.sketchId, opIndex);
  const axisEntity = sketch.entities.get(value.entityId);

  if (!axisEntity) {
    throwSketchEntityNotFound(value.sketchId, value.entityId, opIndex);
  }

  if (axisEntity.kind !== "line") {
    throwValidationError({
      code: "INVALID_FEATURE",
      message: "Revolve axis must reference a line sketch entity.",
      opIndex,
      sketchId: value.sketchId,
      sketchEntityId: value.entityId,
      path: operationPath(opIndex, "axis.entityId"),
      expected: "line sketch entity",
      received: axisEntity.kind
    });
  }

  if (getLineLength(axisEntity) <= 0) {
    throwValidationError({
      code: "INVALID_FEATURE",
      message: "Revolve axis line must have non-zero length.",
      opIndex,
      sketchId: value.sketchId,
      sketchEntityId: value.entityId,
      path: operationPath(opIndex, "axis.entityId"),
      expected: "non-zero line entity",
      received: "zero-length line"
    });
  }

  return {
    type: "sketchLine",
    sketchId: value.sketchId,
    entityId: value.entityId
  };
}

function assertRevolveAxisLineEntity(
  entity: SketchEntity,
  opIndex: number | undefined,
  sketchId: SketchId,
  entityId: SketchEntityId
): asserts entity is Extract<SketchEntity, { readonly kind: "line" }> {
  if (entity.kind !== "line") {
    throwValidationError({
      code: "INVALID_FEATURE",
      message: "Revolve axis must reference a line sketch entity.",
      opIndex,
      sketchId,
      sketchEntityId: entityId,
      path: operationPath(opIndex, "entity.kind"),
      expected: "line sketch entity",
      received: entity.kind
    });
  }

  if (getLineLength(entity) <= 0) {
    throwValidationError({
      code: "INVALID_FEATURE",
      message: "Revolve axis line must have non-zero length.",
      opIndex,
      sketchId,
      sketchEntityId: entityId,
      path: operationPath(opIndex, "entity"),
      expected: "non-zero line entity",
      received: "zero-length line"
    });
  }
}

function validateRevolveAngleDegrees(value: number, opIndex?: number): number {
  if (isPositiveFiniteNumber(value) && value <= 360) {
    return value;
  }

  throwValidationError({
    code: "INVALID_FEATURE",
    message: "Revolve angleDegrees must be a positive finite number <= 360.",
    opIndex,
    path: operationPath(opIndex, "angleDegrees"),
    expected: "positive finite number <= 360",
    received: describeReceived(value)
  });
}

function parseRevolveOperationMode(
  value: FeatureRevolveOperationMode | undefined,
  opIndex?: number
): FeatureRevolveOperationMode {
  if (value === undefined || value === "newBody") {
    return "newBody";
  }

  if (value === "add" || value === "cut") {
    throwValidationError({
      code: "UNSUPPORTED_FEATURE_OPERATION",
      message: "feature.revolve currently supports operationMode newBody only.",
      opIndex,
      path: operationPath(opIndex, "operationMode"),
      expected: "newBody",
      received: value
    });
  }

  throwValidationError({
    code: "INVALID_FEATURE",
    message: `Unsupported revolve operation mode: ${String(value)}.`,
    opIndex,
    path: operationPath(opIndex, "operationMode"),
    expected: "newBody, add, or cut",
    received: describeReceived(value)
  });
}

function validateRevolveTargetBodyId(
  operationMode: FeatureRevolveOperationMode,
  targetBodyId: BodyId | undefined,
  opIndex?: number
): void {
  if (operationMode !== "newBody" || targetBodyId === undefined) {
    return;
  }

  throwValidationError({
    code: "INVALID_FEATURE",
    message: "newBody revolve features must not include targetBodyId.",
    opIndex,
    bodyId: targetBodyId,
    path: operationPath(opIndex, "targetBodyId"),
    expected: "omitted targetBodyId for newBody",
    received: describeReceived(targetBodyId)
  });
}

function assertHoleCircleEntity(
  entity: SketchEntity,
  opIndex: number | undefined,
  sketchId: SketchId,
  entityId: SketchEntityId
): asserts entity is Extract<SketchEntity, { readonly kind: "circle" }> {
  if (entity.kind !== "circle") {
    throwValidationError({
      code: "UNSUPPORTED_SKETCH_PROFILE",
      message: "feature.hole currently supports circle sketch entities only.",
      opIndex,
      sketchId,
      sketchEntityId: entityId,
      path: operationPath(opIndex, "circleEntityId"),
      expected: "circle sketch entity",
      received: entity.kind
    });
  }

  if (!isPositiveFiniteNumber(entity.radius)) {
    throwValidationError({
      code: "INVALID_FEATURE",
      message: "Hole circle radius must be a positive finite number.",
      opIndex,
      sketchId,
      sketchEntityId: entityId,
      path: operationPath(opIndex, "circleEntityId"),
      expected: "circle entity with positive finite radius",
      received: describeReceived(entity.radius)
    });
  }
}

function validateHoleSketchAttachment(
  state: MutableDocumentState,
  sketch: Sketch,
  opIndex?: number
): void {
  if (!sketch.attachment) {
    return;
  }

  if (sketch.attachment.kind === "topologyAnchorFace") {
    validateTopologyAnchorFaceAttachment(state, sketch.attachment, opIndex);
    return;
  }

  const result = validateGeneratedReference({
    document: state,
    ownerPartId: DEFAULT_PART_ID,
    bodyId: sketch.attachment.bodyId,
    stableId: sketch.attachment.faceStableId,
    bodyExists: (bodyId) => documentBodyExists(state, bodyId),
    expectedKind: "face",
    requiredOperation: "feature.attachSketchPlane"
  });

  if (!result.ok) {
    throwGeneratedReferenceValidationError(
      result.error,
      opIndex,
      "faceStableId"
    );
  }
}

function validateTopologyAnchorFaceAttachment(
  state: MutableDocumentState,
  attachment: Extract<
    SketchAttachmentSnapshot,
    { readonly kind: "topologyAnchorFace" }
  >,
  opIndex?: number
): void {
  const topologyIdentity = state.topologyIdentity;
  const anchor = topologyIdentity?.anchors.find(
    (candidate) => candidate.anchorId === attachment.topologyAnchorId
  );
  const checkpoint = topologyIdentity?.checkpoints.find(
    (candidate) => candidate.checkpointId === attachment.checkpointId
  );

  if (
    !topologyIdentity ||
    !anchor ||
    !checkpoint ||
    anchor.state !== "active" ||
    checkpoint.status !== "active" ||
    anchor.entityKind !== "face" ||
    anchor.bodyId !== attachment.bodyId ||
    anchor.checkpointId !== attachment.checkpointId
  ) {
    throwValidationError({
      code: "INVALID_TOPOLOGY_ANCHOR",
      message:
        "Sketch topology-anchor face attachment must resolve to an active face anchor and checkpoint.",
      opIndex,
      bodyId: attachment.bodyId,
      topologyAnchorId: attachment.topologyAnchorId,
      checkpointId: attachment.checkpointId,
      path: operationPath(opIndex, "topologyAnchorId"),
      expected: "active face topology anchor and checkpoint",
      received: describeReceived({
        anchorState: anchor?.state,
        checkpointStatus: checkpoint?.status,
        entityKind: anchor?.entityKind,
        bodyId: anchor?.bodyId,
        checkpointId: anchor?.checkpointId
      })
    });
  }
}

function validateHoleTarget(
  state: MutableDocumentState,
  targetBodyId: BodyId | undefined,
  targetTopologyAnchorId: string | undefined,
  opIndex?: number
): {
  readonly targetBodyId: BodyId;
  readonly targetTopologyAnchorId?: string;
} {
  if (targetBodyId !== undefined && targetTopologyAnchorId !== undefined) {
    throwValidationError({
      code: "INVALID_TOPOLOGY_ANCHOR",
      message:
        "feature.hole must use targetTopologyAnchorId without targetBodyId.",
      opIndex,
      bodyId: targetBodyId,
      topologyAnchorId: targetTopologyAnchorId,
      path: operationPath(opIndex, "targetTopologyAnchorId"),
      expected: "targetTopologyAnchorId without targetBodyId",
      received: "mixed target inputs"
    });
  }

  if (targetTopologyAnchorId === undefined) {
    return {
      targetBodyId: validateHoleTargetBodyId(state, targetBodyId, opIndex)
    };
  }

  const target = resolveActiveTopologyAnchorTarget(
    state,
    targetTopologyAnchorId,
    "body",
    opIndex,
    "targetTopologyAnchorId"
  );
  const activeBodyId = resolveActiveTopologyAnchorBodyTargetId(state, target);

  return {
    targetBodyId: validateHoleTargetBodyId(state, activeBodyId, opIndex),
    targetTopologyAnchorId: target.topologyAnchorId
  };
}

function validateHoleTargetBodyId(
  state: MutableDocumentState,
  targetBodyId: BodyId | undefined,
  opIndex?: number
): BodyId {
  if (typeof targetBodyId !== "string" || targetBodyId.trim().length === 0) {
    throwValidationError({
      code: "TARGET_BODY_REQUIRED",
      message: "feature.hole requires targetBodyId or targetTopologyAnchorId.",
      opIndex,
      path: operationPath(opIndex, "targetBodyId"),
      expected:
        "existing active authored target body id or topology body anchor id",
      received: describeReceived(targetBodyId)
    });
  }

  const targetFeature = findFeatureByBodyId(state.features, targetBodyId);

  if (!targetFeature) {
    if (isPrimitiveBodyId(state, targetBodyId)) {
      throwValidationError({
        code: "TARGET_BODY_NOT_SUPPORTED",
        message: `Primitive-derived body cannot be targeted by feature.hole: ${targetBodyId}`,
        opIndex,
        bodyId: targetBodyId,
        path: operationPath(opIndex, "targetBodyId"),
        expected: "authored target body id",
        received: targetBodyId
      });
    }

    throwValidationError({
      code: "BODY_NOT_FOUND",
      message: `Target body does not exist: ${targetBodyId}`,
      opIndex,
      bodyId: targetBodyId,
      path: operationPath(opIndex, "targetBodyId"),
      expected: "existing active authored target body id",
      received: targetBodyId
    });
  }

  const consumingFeature = findConsumingFeatureByTargetBodyId(
    state.features,
    targetBodyId
  );

  if (consumingFeature) {
    throwValidationError({
      code: "UNSUPPORTED_FEATURE_OPERATION",
      message: `feature.hole target body is already consumed by feature ${consumingFeature.id}: ${targetBodyId}`,
      opIndex,
      bodyId: targetBodyId,
      featureId: consumingFeature.id,
      path: operationPath(opIndex, "targetBodyId"),
      expected: "active authored target body",
      received: targetBodyId
    });
  }

  return targetFeature.bodyId;
}

function assertSupportedHoleTarget(
  state: MutableDocumentState,
  targetBodyId: BodyId,
  targetTopologyAnchorId?: string,
  opIndex?: number
): void {
  const targetFeature = findFeatureByBodyId(state.features, targetBodyId);
  const targetProfileKind = resolveSupportedBooleanTargetProfileKind(
    state.features,
    targetFeature,
    targetTopologyAnchorId
  );

  if (targetProfileKind && isSupportedCutTargetProfileKind(targetProfileKind)) {
    return;
  }

  throwValidationError({
    code: "UNSUPPORTED_FEATURE_OPERATION",
    message:
      "Hole features currently support circular tools cutting one active rectangle, circle, or topology-backed result target body.",
    opIndex,
    bodyId: targetBodyId,
    path: operationPath(opIndex, "targetBodyId"),
    expected:
      "active rectangle/circle source or topology-backed result target body",
    received: describeReceived({
      targetBodyId,
      targetTopologyAnchorId,
      targetProfileKind:
        targetProfileKind ??
        (targetFeature?.kind === "extrude"
          ? targetFeature.profileKind
          : undefined),
      targetFeatureKind: targetFeature?.kind,
      targetOperationMode:
        targetFeature?.kind === "extrude"
          ? targetFeature.operationMode
          : undefined
    })
  });
}

type EdgeFinishOperation = "feature.chamfer" | "feature.fillet";

interface EdgeFinishReferenceSource {
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
  readonly topologyAnchorId?: string;
  readonly topologyAnchorProof?: CadTopologyAnchorCommandProof;
}

function createEdgeFinishFeature(
  state: MutableDocumentState,
  input: EdgeFinishReferenceSource & {
    readonly id?: FeatureId;
    readonly bodyId?: BodyId;
    readonly name?: string;
    readonly targetBodyId: BodyId;
    readonly scalar: number;
  },
  operation: EdgeFinishOperation,
  createFeatureId: () => FeatureId,
  createBodyId: () => BodyId,
  opIndex?: number
): ChamferFeature | FilletFeature {
  const targetBodyId = validateEdgeFinishTargetBodyId(
    state,
    operation,
    input.targetBodyId,
    opIndex
  );
  const reference = validateEdgeFinishReference(
    state,
    operation,
    targetBodyId,
    input,
    opIndex
  );
  const scalar = validateEdgeFinishScalar(input.scalar, operation, opIndex);
  const common = {
    id: input.id ?? createFeatureId(),
    name: normalizeOptionalFeatureName(input.name, opIndex, input.id),
    targetBodyId,
    ...reference,
    bodyId: input.bodyId ?? createBodyId()
  };

  return operation === "feature.chamfer"
    ? {
        ...common,
        kind: "chamfer",
        distance: scalar
      }
    : {
        ...common,
        kind: "fillet",
        radius: scalar
      };
}

function validateEdgeFinishTargetBodyId(
  state: MutableDocumentState,
  operation: EdgeFinishOperation,
  targetBodyId: BodyId,
  opIndex?: number
): BodyId {
  if (typeof targetBodyId !== "string" || targetBodyId.trim().length === 0) {
    throwValidationError({
      code: "TARGET_BODY_REQUIRED",
      message: `${operation} requires targetBodyId.`,
      opIndex,
      path: operationPath(opIndex, "targetBodyId"),
      expected: "existing active authored target body id",
      received: describeReceived(targetBodyId)
    });
  }

  const targetFeature = findFeatureByBodyId(state.features, targetBodyId);

  if (!targetFeature) {
    if (isPrimitiveBodyId(state, targetBodyId)) {
      throwValidationError({
        code: "TARGET_BODY_NOT_SUPPORTED",
        message: `Primitive-derived body cannot be targeted by ${operation}: ${targetBodyId}`,
        opIndex,
        bodyId: targetBodyId,
        path: operationPath(opIndex, "targetBodyId"),
        expected: "active rectangle/circle newBody extrude target body",
        received: targetBodyId
      });
    }

    throwValidationError({
      code: "BODY_NOT_FOUND",
      message: `Target body does not exist: ${targetBodyId}`,
      opIndex,
      bodyId: targetBodyId,
      path: operationPath(opIndex, "targetBodyId"),
      expected: "existing active authored target body id",
      received: targetBodyId
    });
  }

  const consumingFeature = findConsumingFeatureByTargetBodyId(
    state.features,
    targetBodyId
  );

  if (consumingFeature) {
    throwValidationError({
      code: "UNSUPPORTED_FEATURE_OPERATION",
      message: `${operation} target body is already consumed by feature ${consumingFeature.id}: ${targetBodyId}`,
      opIndex,
      bodyId: targetBodyId,
      featureId: consumingFeature.id,
      path: operationPath(opIndex, "targetBodyId"),
      expected: "active authored target body",
      received: targetBodyId
    });
  }

  if (
    targetFeature.kind === "extrude" &&
    targetFeature.operationMode === "newBody" &&
    isSupportedCutTargetProfileKind(targetFeature.profileKind)
  ) {
    return targetFeature.bodyId;
  }

  throwValidationError({
    code: "UNSUPPORTED_FEATURE_OPERATION",
    message: `${operation} currently supports one stable generated edge on an active rectangle or circle newBody extrude target body.`,
    opIndex,
    bodyId: targetBodyId,
    path: operationPath(opIndex, "targetBodyId"),
    expected: "active rectangle/circle newBody extrude target body",
    received: describeReceived({
      targetBodyId,
      targetFeatureKind: targetFeature.kind,
      targetProfileKind:
        targetFeature.kind === "extrude"
          ? targetFeature.profileKind
          : undefined,
      targetOperationMode:
        targetFeature.kind === "extrude"
          ? targetFeature.operationMode
          : undefined
    })
  });
}

function validateEdgeFinishReference(
  state: MutableDocumentState,
  operation: EdgeFinishOperation,
  targetBodyId: BodyId,
  source: EdgeFinishReferenceSource,
  opIndex?: number
): EdgeFinishReferenceSource {
  if (source.topologyAnchorId !== undefined) {
    const mixedInputs =
      source.edgeStableId !== undefined || source.namedReference !== undefined;

    if (mixedInputs) {
      throwValidationError({
        code: "INVALID_TOPOLOGY_ANCHOR",
        message: `${operation} must use topologyAnchorId without edgeStableId or namedReference.`,
        opIndex,
        bodyId: targetBodyId,
        topologyAnchorId: source.topologyAnchorId,
        path: operationPath(opIndex, "topologyAnchorId"),
        expected: "topologyAnchorId without generated edge inputs",
        received: "mixed topology anchor inputs"
      });
    }

    const target =
      source.topologyAnchorProof === undefined
        ? resolveActiveTopologyAnchorStableTarget(
            state,
            source.topologyAnchorId,
            "edge",
            opIndex
          )
        : resolveActiveTopologyAnchorTarget(
            state,
            source.topologyAnchorId,
            "edge",
            opIndex
          );

    if (target.bodyId !== targetBodyId) {
      throwValidationError({
        code: "GENERATED_REFERENCE_NOT_FOUND",
        message: `Topology anchor ${target.topologyAnchorId} resolves to body ${target.bodyId}, not target body ${targetBodyId}.`,
        opIndex,
        bodyId: targetBodyId,
        ...(target.stableId ? { stableId: target.stableId } : {}),
        topologyAnchorId: target.topologyAnchorId,
        checkpointId: target.checkpointId,
        path: operationPath(opIndex, "topologyAnchorId"),
        expected: "topology edge anchor resolving to targetBodyId",
        received: target.bodyId
      });
    }

    const edgeStableId =
      source.topologyAnchorProof === undefined
        ? target.stableId
        : resolveTopologyAnchorEdgeProofStableId(
            state,
            operation,
            targetBodyId,
            target.topologyAnchorId,
            target.checkpointId,
            source.topologyAnchorProof,
            opIndex
          );

    if (edgeStableId === undefined) {
      throwValidationError({
        code: "INVALID_TOPOLOGY_ANCHOR",
        message: `${operation} topology anchor did not resolve to a generated edge.`,
        opIndex,
        bodyId: targetBodyId,
        topologyAnchorId: target.topologyAnchorId,
        checkpointId: target.checkpointId,
        path: operationPath(opIndex, "topologyAnchorId"),
        expected: "resolved generated edge",
        received: "missing stable edge reference"
      });
    }

    validateEdgeGeneratedReference(
      state,
      operation,
      targetBodyId,
      edgeStableId,
      opIndex,
      "topologyAnchorId",
      undefined,
      target.topologyAnchorId,
      target.checkpointId
    );

    return {
      edgeStableId,
      topologyAnchorId: target.topologyAnchorId
    };
  }

  if (source.topologyAnchorProof !== undefined) {
    throwValidationError({
      code: "INVALID_TOPOLOGY_ANCHOR",
      message: `${operation} topologyAnchorProof requires topologyAnchorId.`,
      opIndex,
      bodyId: targetBodyId,
      path: operationPath(opIndex, "topologyAnchorProof"),
      expected: "topologyAnchorId with topologyAnchorProof",
      received: "missing topologyAnchorId"
    });
  }

  const hasStableId =
    typeof source.edgeStableId === "string" &&
    source.edgeStableId.trim().length > 0;
  const hasNamedReference =
    typeof source.namedReference === "string" &&
    source.namedReference.trim().length > 0;

  if (hasStableId === hasNamedReference) {
    throwValidationError({
      code: "INVALID_FEATURE",
      message: `${operation} requires exactly one edgeStableId or namedReference.`,
      opIndex,
      bodyId: targetBodyId,
      path: operationPath(
        opIndex,
        hasStableId ? "namedReference" : "edgeStableId"
      ),
      expected: "exactly one edgeStableId, namedReference, or topologyAnchorId",
      received: describeReceived({
        edgeStableId: source.edgeStableId,
        namedReference: source.namedReference,
        topologyAnchorId: source.topologyAnchorId
      })
    });
  }

  if (hasNamedReference) {
    const name = normalizeNamedReferenceName(
      source.namedReference as string,
      opIndex,
      "namedReference"
    );
    const reference = state.namedReferences.get(name);

    if (!reference) {
      throwValidationError({
        code: "NAMED_REFERENCE_NOT_FOUND",
        message: `Named reference does not exist: ${name}`,
        opIndex,
        bodyId: targetBodyId,
        referenceName: name,
        path: operationPath(opIndex, "namedReference"),
        expected: "existing named generated edge reference",
        received: name
      });
    }

    if (reference.bodyId !== targetBodyId) {
      throwValidationError({
        code: "GENERATED_REFERENCE_NOT_FOUND",
        message: `Named reference ${name} resolves to body ${reference.bodyId}, not target body ${targetBodyId}.`,
        opIndex,
        bodyId: targetBodyId,
        stableId: reference.stableId,
        referenceName: name,
        path: operationPath(opIndex, "namedReference"),
        expected: "named edge reference resolving to targetBodyId",
        received: reference.bodyId
      });
    }

    validateEdgeGeneratedReference(
      state,
      operation,
      targetBodyId,
      reference.stableId,
      opIndex,
      "referenceName",
      name
    );

    return { namedReference: name };
  }

  const edgeStableId = source.edgeStableId as string;
  validateEdgeGeneratedReference(
    state,
    operation,
    targetBodyId,
    edgeStableId,
    opIndex,
    "edgeStableId"
  );

  return { edgeStableId };
}

function validateEdgeGeneratedReference(
  state: MutableDocumentState,
  operation: EdgeFinishOperation,
  targetBodyId: BodyId,
  stableId: string,
  opIndex: number | undefined,
  stableIdPath: "edgeStableId" | "referenceName" | "topologyAnchorId",
  referenceName?: NamedReferenceName,
  topologyAnchorId?: string,
  checkpointId?: string
): void {
  const result = validateGeneratedReference({
    document: state,
    ownerPartId: DEFAULT_PART_ID,
    bodyId: targetBodyId,
    stableId,
    bodyExists: (bodyId) => documentBodyExists(state, bodyId),
    expectedKind: "edge",
    requiredOperation: operation
  });

  if (!result.ok) {
    throwGeneratedReferenceValidationError(
      result.error,
      opIndex,
      stableIdPath,
      referenceName,
      topologyAnchorId,
      checkpointId
    );
  }
}

function createTopologyAnchorProofCommandOperations(
  state: CadDocument,
  proof: CadTopologyAnchorCommandProof,
  bodyId: BodyId
): readonly CadSelectionReferenceOperation[] {
  if (proof.kind !== "axisAlignedLinearEdge") {
    return [];
  }

  const operations: CadSelectionReferenceOperation[] = [];

  if (
    findTopologyAnchorEdgeProofStableId(state, bodyId, proof, "feature.chamfer")
  ) {
    operations.push("feature.chamfer");
  }

  if (
    findTopologyAnchorEdgeProofStableId(state, bodyId, proof, "feature.fillet")
  ) {
    operations.push("feature.fillet");
  }

  return operations;
}

function resolveTopologyAnchorEdgeProofStableId(
  state: MutableDocumentState,
  operation: EdgeFinishOperation,
  targetBodyId: BodyId,
  topologyAnchorId: string,
  checkpointId: string,
  proof: CadTopologyAnchorCommandProof,
  opIndex?: number
): string {
  const receivedKind = (proof as { readonly kind?: unknown }).kind;
  if (!isTopologyAnchorEdgeProofInput(proof)) {
    throwValidationError({
      code: "INVALID_TOPOLOGY_ANCHOR",
      message: `${operation} topologyAnchorProof requires axis-aligned linear edge proof.`,
      opIndex,
      bodyId: targetBodyId,
      topologyAnchorId,
      checkpointId,
      path: operationPath(opIndex, "topologyAnchorProof"),
      expected: "axisAlignedLinearEdge proof for an edge topology anchor",
      received: describeReceived(receivedKind)
    });
  }

  const stableId = findTopologyAnchorEdgeProofStableId(
    state,
    targetBodyId,
    proof,
    operation
  );

  if (stableId) {
    return stableId;
  }

  throwValidationError({
    code: "INVALID_TOPOLOGY_ANCHOR",
    message: `${operation} topologyAnchorProof does not match exactly one supported generated edge on target body ${targetBodyId}.`,
    opIndex,
    bodyId: targetBodyId,
    topologyAnchorId,
    checkpointId,
    path: operationPath(opIndex, "topologyAnchorProof"),
    expected:
      "axis-aligned linear edge proof matching one operation-eligible generated edge",
    received: JSON.stringify({
      kind: proof.kind,
      linearAxis: proof.linearAxis,
      length: proof.length,
      bounds: proof.bounds
    })
  });
}

function findTopologyAnchorEdgeProofStableId(
  state: CadDocument,
  bodyId: BodyId,
  proof: CadTopologyAnchorCommandProof,
  operation: EdgeFinishOperation
): string | undefined {
  if (!isTopologyAnchorEdgeProofInput(proof)) {
    return undefined;
  }

  const references = createBodyGeneratedReferences(
    state,
    bodyId,
    DEFAULT_PART_ID
  );

  if (!references) {
    return undefined;
  }

  const matches = references.edges.filter((edge) =>
    generatedEdgeMatchesTopologyAnchorProof(
      state,
      bodyId,
      edge,
      proof,
      operation
    )
  );

  return matches.length === 1 ? matches[0]!.stableId : undefined;
}

function generatedEdgeMatchesTopologyAnchorProof(
  state: CadDocument,
  bodyId: BodyId,
  edge: CadGeneratedEdgeReference,
  proof: CadTopologyAnchorCommandProof,
  operation: EdgeFinishOperation
): boolean {
  if (!edge.eligibleOperations.includes(operation)) {
    return false;
  }

  const measurements = createGeneratedReferenceMeasurements({
    document: state,
    bodyId,
    stableId: edge.stableId,
    units: state.units,
    ownerPartId: DEFAULT_PART_ID,
    bodyExists: (candidateBodyId) =>
      cadDocumentBodyExists(state, candidateBodyId)
  });

  if (
    !measurements.ok ||
    measurements.kind !== "edge" ||
    measurements.measurements.kind !== "edge" ||
    !measurements.measurements.startPoint ||
    !measurements.measurements.endPoint ||
    !proof.bounds
  ) {
    return false;
  }

  const edgeBounds = createBoundsFromPoints([
    measurements.measurements.startPoint,
    measurements.measurements.endPoint
  ]);

  return (
    boundsMinMaxEqual(edgeBounds, proof.bounds) &&
    nearlyEqual(measurements.measurements.length, proof.length)
  );
}

function createBoundsFromPoints(points: readonly Vec3[]): CadAxisAlignedBounds {
  const min: Vec3 = [
    Math.min(...points.map((point) => point[0])),
    Math.min(...points.map((point) => point[1])),
    Math.min(...points.map((point) => point[2]))
  ];
  const max: Vec3 = [
    Math.max(...points.map((point) => point[0])),
    Math.max(...points.map((point) => point[1])),
    Math.max(...points.map((point) => point[2]))
  ];
  const size: Vec3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const center: Vec3 = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2
  ];

  return { min, max, size, center };
}

function boundsMinMaxEqual(
  left: Pick<CadAxisAlignedBounds, "min" | "max">,
  right: Pick<CadAxisAlignedBounds, "min" | "max">
): boolean {
  return (
    vec3NearlyEqual(left.min, right.min) && vec3NearlyEqual(left.max, right.max)
  );
}

function vec3NearlyEqual(left: Vec3, right: Vec3): boolean {
  return left.every((value, index) => nearlyEqual(value, right[index]!));
}

function nearlyEqual(left: number | undefined, right: number | undefined) {
  return (
    typeof left === "number" &&
    typeof right === "number" &&
    Math.abs(left - right) <= 1e-9
  );
}

function cadDocumentBodyExists(document: CadDocument, bodyId: BodyId): boolean {
  return createProjectStructure(document, []).bodies.some(
    (body) => body.id === bodyId
  );
}

function validateEdgeFinishScalar(
  value: number,
  operation: EdgeFinishOperation,
  opIndex?: number
): number {
  const field = operation === "feature.chamfer" ? "distance" : "radius";
  const label =
    operation === "feature.chamfer" ? "Chamfer distance" : "Fillet radius";

  if (isPositiveFiniteNumber(value)) {
    return value;
  }

  throwValidationError({
    code: "INVALID_FEATURE",
    message: `${label} must be a positive finite number.`,
    opIndex,
    path: operationPath(opIndex, field),
    expected: "positive finite number",
    received: describeReceived(value)
  });
}

function validateHoleDepthMode(
  value: FeatureHoleDepthMode,
  opIndex?: number
): FeatureHoleDepthMode {
  if (value === "blind" || value === "throughAll") {
    return value;
  }

  throwValidationError({
    code: "INVALID_FEATURE",
    message: `Unsupported hole depthMode: ${String(value)}.`,
    opIndex,
    path: operationPath(opIndex, "depthMode"),
    expected: "blind or throughAll",
    received: describeReceived(value)
  });
}

function validateHoleDepth(
  depthMode: FeatureHoleDepthMode,
  depth: number | undefined,
  opIndex?: number
): number | undefined {
  if (depthMode === "blind") {
    if (depth !== undefined && isPositiveFiniteNumber(depth)) {
      return depth;
    }

    throwValidationError({
      code: "INVALID_FEATURE",
      message: "Blind holes require a positive finite depth.",
      opIndex,
      path: operationPath(opIndex, "depth"),
      expected: "positive finite number",
      received: describeReceived(depth)
    });
  }

  if (depth === undefined) {
    return undefined;
  }

  throwValidationError({
    code: "INVALID_FEATURE",
    message: "throughAll holes must not include depth.",
    opIndex,
    path: operationPath(opIndex, "depth"),
    expected: "omitted depth for throughAll",
    received: describeReceived(depth)
  });
}

function validateHoleDirection(
  value: FeatureHoleDirection | undefined,
  opIndex?: number
): FeatureHoleDirection {
  if (value === undefined || value === "positive") {
    return "positive";
  }

  if (value === "negative") {
    return value;
  }

  throwValidationError({
    code: "INVALID_FEATURE",
    message: `Unsupported hole direction: ${String(value)}.`,
    opIndex,
    path: operationPath(opIndex, "direction"),
    expected: "positive or negative",
    received: describeReceived(value)
  });
}

function validateExtrudeDepth(value: number, opIndex?: number): number {
  if (isPositiveFiniteNumber(value)) {
    return value;
  }

  throwValidationError({
    code: "INVALID_FEATURE",
    message: "Extrude depth must be a positive finite number.",
    opIndex,
    path: operationPath(opIndex, "depth"),
    expected: "positive finite number",
    received: describeReceived(value)
  });
}

function validateExtrudeSide(
  value: FeatureExtrudeSide | undefined,
  opIndex?: number
): FeatureExtrudeSide {
  if (value === undefined || value === "positive") {
    return "positive";
  }

  if (value === "negative" || value === "symmetric") {
    return value;
  }

  throwValidationError({
    code: "INVALID_FEATURE",
    message: `Unsupported extrude side: ${String(value)}.`,
    opIndex,
    path: operationPath(opIndex, "side"),
    expected: "positive, negative, or symmetric",
    received: describeReceived(value)
  });
}

function parseExtrudeOperationMode(
  value: FeatureExtrudeOperationMode | undefined,
  opIndex?: number
): FeatureExtrudeOperationMode {
  if (value === undefined || value === "newBody") {
    return "newBody";
  }

  if (value === "add" || value === "cut") {
    return value;
  }

  throwValidationError({
    code: "INVALID_FEATURE",
    message: `Unsupported extrude operation mode: ${String(value)}.`,
    opIndex,
    path: operationPath(opIndex, "operationMode"),
    expected: "newBody, add, or cut",
    received: describeReceived(value)
  });
}

function validateExtrudeTarget(
  state: MutableDocumentState,
  operationMode: FeatureExtrudeOperationMode,
  targetBodyId: BodyId | undefined,
  targetTopologyAnchorId: string | undefined,
  opIndex?: number
): {
  readonly targetBodyId?: BodyId;
  readonly targetTopologyAnchorId?: string;
} {
  if (targetBodyId !== undefined && targetTopologyAnchorId !== undefined) {
    throwValidationError({
      code: "INVALID_TOPOLOGY_ANCHOR",
      message:
        "feature.extrude must use targetTopologyAnchorId without targetBodyId.",
      opIndex,
      bodyId: targetBodyId,
      topologyAnchorId: targetTopologyAnchorId,
      path: operationPath(opIndex, "targetTopologyAnchorId"),
      expected: "targetTopologyAnchorId without targetBodyId",
      received: "mixed target inputs"
    });
  }

  if (targetTopologyAnchorId === undefined) {
    return {
      targetBodyId: validateExtrudeTargetBodyId(
        state,
        operationMode,
        targetBodyId,
        opIndex
      )
    };
  }

  if (operationMode === "newBody") {
    throwValidationError({
      code: "INVALID_FEATURE",
      message: "newBody extrudes must not include targetTopologyAnchorId.",
      opIndex,
      topologyAnchorId: targetTopologyAnchorId,
      path: operationPath(opIndex, "targetTopologyAnchorId"),
      expected: "omitted targetTopologyAnchorId for newBody",
      received: describeReceived(targetTopologyAnchorId)
    });
  }

  const target = resolveActiveTopologyAnchorTarget(
    state,
    targetTopologyAnchorId,
    "body",
    opIndex,
    "targetTopologyAnchorId"
  );
  const activeBodyId = resolveActiveTopologyAnchorBodyTargetId(state, target);

  return {
    targetBodyId: validateExtrudeTargetBodyId(
      state,
      operationMode,
      activeBodyId,
      opIndex
    ),
    targetTopologyAnchorId: target.topologyAnchorId
  };
}

function resolveActiveTopologyAnchorBodyTargetId(
  state: MutableDocumentState,
  target: { readonly bodyId: BodyId; readonly topologyAnchorId: string }
): BodyId {
  let activeBodyId = target.bodyId;
  const visitedBodyIds = new Set<BodyId>();

  while (!visitedBodyIds.has(activeBodyId)) {
    visitedBodyIds.add(activeBodyId);
    const consumingFeature = findConsumingFeatureByTargetBodyId(
      state.features,
      activeBodyId
    );

    if (
      consumingFeature?.kind !== "extrude" ||
      !isConsumingExtrudeOperationMode(consumingFeature.operationMode) ||
      consumingFeature.targetTopologyAnchorId !== target.topologyAnchorId
    ) {
      return activeBodyId;
    }

    activeBodyId = consumingFeature.bodyId;
  }

  return activeBodyId;
}

function validateExtrudeTargetBodyId(
  state: MutableDocumentState,
  operationMode: FeatureExtrudeOperationMode,
  targetBodyId: BodyId | undefined,
  opIndex?: number
): BodyId | undefined {
  if (operationMode === "newBody") {
    if (targetBodyId === undefined) {
      return undefined;
    }

    throwValidationError({
      code: "INVALID_FEATURE",
      message: "newBody extrudes must not include targetBodyId.",
      opIndex,
      bodyId: targetBodyId,
      path: operationPath(opIndex, "targetBodyId"),
      expected: "omitted targetBodyId for newBody",
      received: describeReceived(targetBodyId)
    });
  }

  if (typeof targetBodyId !== "string" || targetBodyId.trim().length === 0) {
    throwValidationError({
      code: "TARGET_BODY_REQUIRED",
      message: `Extrude operation mode ${operationMode} requires targetBodyId.`,
      opIndex,
      path: operationPath(opIndex, "targetBodyId"),
      expected: "existing authored target body id",
      received: describeReceived(targetBodyId)
    });
  }

  if (findFeatureByBodyId(state.features, targetBodyId)) {
    return targetBodyId;
  }

  if (isPrimitiveBodyId(state, targetBodyId)) {
    throwValidationError({
      code: "TARGET_BODY_NOT_SUPPORTED",
      message: `Primitive-derived body cannot be targeted by feature.extrude ${operationMode}: ${targetBodyId}`,
      opIndex,
      bodyId: targetBodyId,
      path: operationPath(opIndex, "targetBodyId"),
      expected: "authored sketch-extrude target body id",
      received: targetBodyId
    });
  }

  throwValidationError({
    code: "BODY_NOT_FOUND",
    message: `Target body does not exist: ${targetBodyId}`,
    opIndex,
    bodyId: targetBodyId,
    path: operationPath(opIndex, "targetBodyId"),
    expected: "existing authored target body id",
    received: targetBodyId
  });
}

function assertSupportedExtrudeOperation(
  state: MutableDocumentState,
  operationMode: FeatureExtrudeOperationMode,
  profileKind: FeatureExtrudeProfileKind,
  targetBodyId: BodyId | undefined,
  targetTopologyAnchorId?: string,
  opIndex?: number,
  ignoreConsumingFeatureId?: FeatureId
): void {
  if (operationMode === "newBody") {
    return;
  }

  const targetFeature =
    targetBodyId === undefined
      ? undefined
      : findFeatureByBodyId(state.features, targetBodyId);
  const consumingFeature = targetBodyId
    ? findConsumingFeatureByTargetBodyId(state.features, targetBodyId)
    : undefined;
  const hasBlockingConsumingFeature =
    consumingFeature !== undefined &&
    consumingFeature.id !== ignoreConsumingFeatureId;
  const targetProfileKind = resolveSupportedBooleanTargetProfileKind(
    state.features,
    targetFeature,
    targetTopologyAnchorId
  );

  if (
    operationMode === "cut" &&
    targetBodyId &&
    isSupportedBooleanToolProfileKind(profileKind) &&
    targetProfileKind !== undefined &&
    isSupportedCutTargetProfileKind(targetProfileKind) &&
    !hasBlockingConsumingFeature
  ) {
    return;
  }

  if (
    operationMode === "add" &&
    targetBodyId &&
    isSupportedBooleanToolProfileKind(profileKind) &&
    targetProfileKind !== undefined &&
    isSupportedAddTargetProfileKind(targetProfileKind) &&
    !hasBlockingConsumingFeature
  ) {
    return;
  }

  const expected =
    operationMode === "add"
      ? "add with rectangle/circle source and active rectangle source or topology-backed result target"
      : "cut with rectangle/circle source and active rectangle/circle source or topology-backed result target";
  const message =
    operationMode === "add"
      ? "Add extrudes currently support rectangle or circle tools fusing with one active rectangle source or topology-backed result target body."
      : "Cut extrudes currently support rectangle or circle tools cutting one active rectangle, circle, or topology-backed result target body.";

  throwValidationError({
    code: "UNSUPPORTED_FEATURE_OPERATION",
    message,
    opIndex,
    bodyId: targetBodyId,
    path: operationPath(opIndex, "operationMode"),
    expected,
    received: describeReceived({
      operationMode,
      profileKind,
      targetBodyId,
      targetTopologyAnchorId,
      targetProfileKind:
        targetProfileKind ??
        (targetFeature?.kind === "extrude"
          ? targetFeature.profileKind
          : undefined),
      targetOperationMode:
        targetFeature?.kind === "extrude"
          ? targetFeature.operationMode
          : undefined,
      targetFeatureKind: targetFeature?.kind,
      targetConsumedByFeatureId: hasBlockingConsumingFeature
        ? consumingFeature?.id
        : undefined
    })
  });
}

function resolveSupportedBooleanTargetProfileKind(
  features: ReadonlyMap<FeatureId, Feature>,
  targetFeature: Feature | undefined,
  targetTopologyAnchorId?: string
): FeatureExtrudeProfileKind | undefined {
  if (targetFeature?.kind !== "extrude") {
    return undefined;
  }

  if (targetFeature.operationMode === "newBody") {
    return targetFeature.profileKind;
  }

  if (
    targetTopologyAnchorId === undefined ||
    !isConsumingExtrudeOperationMode(targetFeature.operationMode)
  ) {
    return undefined;
  }

  let current: ExtrudeFeature | undefined = targetFeature;
  const visitedFeatureIds = new Set<FeatureId>();

  while (current && !visitedFeatureIds.has(current.id)) {
    visitedFeatureIds.add(current.id);

    if (current.operationMode === "newBody") {
      return current.profileKind;
    }

    if (
      current.targetTopologyAnchorId !== targetTopologyAnchorId ||
      current.targetBodyId === undefined
    ) {
      return undefined;
    }

    const parent = findFeatureByBodyId(features, current.targetBodyId);
    current = parent?.kind === "extrude" ? parent : undefined;
  }

  return undefined;
}

function validateBoxDimensions(
  dimensions: BoxDimensions,
  opIndex?: number,
  objectId?: ObjectId
): void {
  if (
    isPositiveFiniteNumber(dimensions.width) &&
    isPositiveFiniteNumber(dimensions.height) &&
    isPositiveFiniteNumber(dimensions.depth)
  ) {
    return;
  }

  throwValidationError({
    code: "INVALID_DIMENSIONS",
    message: "Box dimensions must be positive finite numbers.",
    opIndex,
    objectId,
    path: operationPath(opIndex, "dimensions"),
    expected: "positive finite width, height, and depth",
    received: describeReceived(dimensions)
  });
}

function validateCylinderDimensions(
  dimensions: CylinderDimensions,
  opIndex?: number,
  objectId?: ObjectId
): void {
  if (
    isPositiveFiniteNumber(dimensions.radius) &&
    isPositiveFiniteNumber(dimensions.height)
  ) {
    return;
  }

  throwValidationError({
    code: "INVALID_DIMENSIONS",
    message: "Cylinder dimensions must be positive finite numbers.",
    opIndex,
    objectId,
    path: operationPath(opIndex, "dimensions"),
    expected: "positive finite radius and height",
    received: describeReceived(dimensions)
  });
}

function validateSphereDimensions(
  dimensions: SphereDimensions,
  opIndex?: number,
  objectId?: ObjectId
): void {
  if (isPositiveFiniteNumber(dimensions.radius)) {
    return;
  }

  throwValidationError({
    code: "INVALID_DIMENSIONS",
    message: "Sphere dimensions must be positive finite numbers.",
    opIndex,
    objectId,
    path: operationPath(opIndex, "dimensions"),
    expected: "positive finite radius",
    received: describeReceived(dimensions)
  });
}

function validateConeDimensions(
  dimensions: ConeDimensions,
  opIndex?: number,
  objectId?: ObjectId
): void {
  if (
    isPositiveFiniteNumber(dimensions.radius) &&
    isPositiveFiniteNumber(dimensions.height)
  ) {
    return;
  }

  throwValidationError({
    code: "INVALID_DIMENSIONS",
    message: "Cone dimensions must be positive finite numbers.",
    opIndex,
    objectId,
    path: operationPath(opIndex, "dimensions"),
    expected: "positive finite radius and height",
    received: describeReceived(dimensions)
  });
}

function validateTorusDimensions(
  dimensions: TorusDimensions,
  opIndex?: number,
  objectId?: ObjectId
): void {
  if (
    isPositiveFiniteNumber(dimensions.majorRadius) &&
    isPositiveFiniteNumber(dimensions.minorRadius) &&
    dimensions.minorRadius < dimensions.majorRadius
  ) {
    return;
  }

  throwValidationError({
    code: "INVALID_DIMENSIONS",
    message:
      "Torus dimensions must be positive finite numbers with minorRadius smaller than majorRadius.",
    opIndex,
    objectId,
    path: operationPath(opIndex, "dimensions"),
    expected: "positive finite majorRadius and smaller positive minorRadius",
    received: describeReceived(dimensions)
  });
}

function validateDocumentUnits(units: DocumentUnits, opIndex?: number): void {
  if (isDocumentUnits(units)) {
    return;
  }

  throwValidationError({
    code: "INVALID_UNITS",
    message: `Unsupported document units: ${String(units)}.`,
    opIndex,
    path: operationPath(opIndex, "units"),
    expected: "mm, cm, m, or in",
    received: describeReceived(units)
  });
}

function validateDocumentUnitUpdateMode(
  mode: DocumentUnitUpdateMode | undefined,
  opIndex?: number
): DocumentUnitUpdateMode {
  if (mode === undefined || mode === "metadataOnly") {
    return "metadataOnly";
  }

  if (mode === "preservePhysicalSize") {
    return mode;
  }

  throwValidationError({
    code: "INVALID_UNIT_UPDATE_MODE",
    message: `Unsupported document unit update mode: ${String(mode)}.`,
    opIndex,
    path: operationPath(opIndex, "mode"),
    expected: "metadataOnly or preservePhysicalSize",
    received: describeReceived(mode)
  });
}

function normalizeOptionalObjectName(
  name: string | undefined,
  opIndex?: number,
  objectId?: ObjectId
): string | undefined {
  return name === undefined
    ? undefined
    : normalizeObjectName(name, opIndex, objectId);
}

function normalizeObjectName(
  name: string,
  opIndex?: number,
  objectId?: ObjectId
): string {
  const normalized = name.trim();

  if (normalized.length > 0) {
    return normalized;
  }

  throwValidationError({
    code: "INVALID_OBJECT_NAME",
    message: "Object name must be non-empty.",
    opIndex,
    objectId,
    path: operationPath(opIndex, "name"),
    expected: "non-empty string",
    received: describeReceived(name)
  });
}

function normalizeSketchName(
  name: string,
  opIndex?: number,
  sketchId?: SketchId
): string {
  const normalized = name.trim();

  if (normalized.length > 0) {
    return normalized;
  }

  throwValidationError({
    code: "INVALID_SKETCH_NAME",
    message: "Sketch name must be non-empty.",
    opIndex,
    sketchId,
    path: operationPath(opIndex, "name"),
    expected: "non-empty string",
    received: describeReceived(name)
  });
}

function normalizeOptionalFeatureName(
  name: string | undefined,
  opIndex?: number,
  featureId?: FeatureId
): string | undefined {
  return name === undefined
    ? undefined
    : normalizeFeatureName(name, opIndex, featureId);
}

function normalizeFeatureName(
  name: string,
  opIndex?: number,
  featureId?: FeatureId
): string {
  const normalized = name.trim();

  if (normalized.length > 0) {
    return normalized;
  }

  throwValidationError({
    code: "INVALID_FEATURE",
    message: "Feature name must be non-empty.",
    opIndex,
    featureId,
    path: operationPath(opIndex, "name"),
    expected: "non-empty string",
    received: describeReceived(name)
  });
}

function normalizeNamedReferenceName(
  name: string,
  opIndex?: number,
  fieldName: "name" | "referenceName" | "namedReference" = "name"
): NamedReferenceName {
  const normalized = name.trim();

  if (normalized.length > 0) {
    return normalized;
  }

  throwValidationError({
    code: "INVALID_REFERENCE_NAME",
    message: "Named reference name must be non-empty.",
    opIndex,
    path: operationPath(opIndex, fieldName),
    expected: "non-empty string",
    received: describeReceived(name)
  });
}

function resolveSketchAttachmentTarget(
  state: MutableDocumentState,
  op: Extract<CadOp, { readonly op: "sketch.createOnFace" }>,
  opIndex?: number
): {
  readonly plane: SketchPlane;
  readonly attachment: SketchAttachmentSnapshot;
} {
  if (op.topologyAnchorProof !== undefined) {
    return resolveTopologyAnchorSketchAttachmentTarget(state, op, opIndex);
  }

  const target = resolveSketchAttachmentFaceTarget(state, op, opIndex);
  const result = validateGeneratedReference({
    document: state,
    ownerPartId: DEFAULT_PART_ID,
    bodyId: target.bodyId,
    stableId: target.stableId,
    bodyExists: (bodyId) => documentBodyExists(state, bodyId),
    expectedKind: "face",
    requiredOperation: "feature.attachSketchPlane"
  });

  if (!result.ok) {
    throwGeneratedReferenceValidationError(
      result.error,
      opIndex,
      target.path,
      target.referenceName,
      target.topologyAnchorId,
      target.checkpointId
    );
  }

  const face = result.reference as CadGeneratedFaceReference;

  return {
    plane: createSketchPlaneFromFaceReference(face, target.path, opIndex),
    attachment: createSketchFaceAttachment(face)
  };
}

function resolveTopologyAnchorSketchAttachmentTarget(
  state: MutableDocumentState,
  op: Extract<CadOp, { readonly op: "sketch.createOnFace" }>,
  opIndex?: number
): {
  readonly plane: SketchPlane;
  readonly attachment: SketchAttachmentSnapshot;
} {
  if (op.topologyAnchorId === undefined) {
    throwValidationError({
      code: "INVALID_TOPOLOGY_ANCHOR",
      message:
        "sketch.createOnFace topologyAnchorProof requires topologyAnchorId.",
      opIndex,
      path: operationPath(opIndex, "topologyAnchorProof"),
      expected: "topologyAnchorId with topologyAnchorProof",
      received: "missing topologyAnchorId"
    });
  }

  if (
    op.bodyId !== undefined ||
    op.faceStableId !== undefined ||
    op.referenceName !== undefined
  ) {
    throwValidationError({
      code: "INVALID_TOPOLOGY_ANCHOR",
      message:
        "sketch.createOnFace must use topologyAnchorProof only with topologyAnchorId.",
      opIndex,
      topologyAnchorId: op.topologyAnchorId,
      path: operationPath(opIndex, "topologyAnchorProof"),
      expected:
        "topologyAnchorId and topologyAnchorProof without generated reference inputs",
      received: "mixed topology anchor proof inputs"
    });
  }

  const target = resolveActiveTopologyAnchorTarget(
    state,
    op.topologyAnchorId,
    "face",
    opIndex
  );
  const proofInput = op.topologyAnchorProof;
  if (proofInput === undefined) {
    throwValidationError({
      code: "INVALID_TOPOLOGY_ANCHOR",
      message:
        "sketch.createOnFace topologyAnchorProof requires proof evidence.",
      opIndex,
      topologyAnchorId: op.topologyAnchorId,
      path: operationPath(opIndex, "topologyAnchorProof"),
      expected: "axisAlignedPlanarFace proof",
      received: "missing topologyAnchorProof"
    });
  }
  const proof = validateTopologyAnchorFaceProof(proofInput, opIndex);

  return {
    plane: sketchPlaneFromPlanarAxis(proof.planarAxis),
    attachment: {
      kind: "topologyAnchorFace",
      bodyId: target.bodyId,
      topologyAnchorId: target.topologyAnchorId,
      checkpointId: target.checkpointId,
      planarAxis: proof.planarAxis,
      planarCoordinate: proof.planarCoordinate
    }
  };
}

function resolveActiveTopologyAnchorTarget(
  state: MutableDocumentState,
  topologyAnchorId: string,
  expectedKind: CadTopologyAnchorEntityKind,
  opIndex?: number,
  pathField: string = "topologyAnchorId"
): {
  readonly bodyId: BodyId;
  readonly stableId?: string;
  readonly sourceSemanticRole?: string;
  readonly topologyAnchorId: string;
  readonly checkpointId: string;
} {
  const anchorId = topologyAnchorId.trim();

  if (anchorId.length === 0) {
    throwValidationError({
      code: "INVALID_TOPOLOGY_ANCHOR",
      message: "Topology anchor ID must be non-empty.",
      opIndex,
      topologyAnchorId,
      path: operationPath(opIndex, pathField),
      expected: "non-empty topology anchor id",
      received: describeReceived(topologyAnchorId)
    });
  }

  const topologyIdentity = state.topologyIdentity;
  const anchor = topologyIdentity?.anchors.find(
    (candidate) => candidate.anchorId === anchorId
  );

  if (!topologyIdentity || !anchor) {
    throwValidationError({
      code: "TOPOLOGY_ANCHOR_NOT_FOUND",
      message: `Topology anchor does not exist: ${anchorId}`,
      opIndex,
      topologyAnchorId: anchorId,
      path: operationPath(opIndex, pathField),
      expected: "existing topology anchor",
      received: anchorId
    });
  }

  const checkpoint = topologyIdentity.checkpoints.find(
    (candidate) => candidate.checkpointId === anchor.checkpointId
  );

  if (!checkpoint) {
    throwValidationError({
      code: "TOPOLOGY_CHECKPOINT_NOT_FOUND",
      message: `Topology checkpoint does not exist: ${anchor.checkpointId}`,
      opIndex,
      topologyAnchorId: anchor.anchorId,
      checkpointId: anchor.checkpointId,
      path: operationPath(opIndex, pathField),
      expected: "existing topology checkpoint",
      received: anchor.checkpointId
    });
  }

  if (checkpoint.status !== "active" || anchor.state !== "active") {
    throwValidationError({
      code: "INVALID_TOPOLOGY_ANCHOR",
      message: `Topology anchor ${anchor.anchorId} is not active.`,
      opIndex,
      bodyId: anchor.bodyId,
      topologyAnchorId: anchor.anchorId,
      checkpointId: anchor.checkpointId,
      path: operationPath(opIndex, pathField),
      expected: "active topology anchor and checkpoint",
      received: `anchor:${anchor.state}, checkpoint:${checkpoint.status}`
    });
  }

  if (anchor.entityKind !== expectedKind) {
    throwValidationError({
      code: "INVALID_TOPOLOGY_ANCHOR",
      message: `Topology anchor ${anchor.anchorId} is ${anchor.entityKind}, not a ${expectedKind}.`,
      opIndex,
      bodyId: anchor.bodyId,
      topologyAnchorId: anchor.anchorId,
      checkpointId: anchor.checkpointId,
      path: operationPath(opIndex, pathField),
      expected: `${expectedKind} topology anchor`,
      received: anchor.entityKind
    });
  }

  return {
    bodyId: anchor.bodyId,
    ...(anchor.stableId ? { stableId: anchor.stableId } : {}),
    ...(anchor.sourceSemanticRole
      ? { sourceSemanticRole: anchor.sourceSemanticRole }
      : {}),
    topologyAnchorId: anchor.anchorId,
    checkpointId: anchor.checkpointId
  };
}

function resolveActiveTopologyAnchorStableTarget(
  state: MutableDocumentState,
  topologyAnchorId: string,
  expectedKind: CadTopologyAnchorEntityKind,
  opIndex?: number,
  pathField: string = "topologyAnchorId"
): {
  readonly bodyId: BodyId;
  readonly stableId: string;
  readonly topologyAnchorId: string;
  readonly checkpointId: string;
} {
  const target = resolveActiveTopologyAnchorTarget(
    state,
    topologyAnchorId,
    expectedKind,
    opIndex,
    pathField
  );

  const stableResolution = target.stableId
    ? { status: "resolved" as const, stableId: target.stableId }
    : resolveTopologyAnchorGeneratedReferenceFromSourceRole({
        document: state,
        ownerPartId: DEFAULT_PART_ID,
        bodyId: target.bodyId,
        entityKind: expectedKind,
        sourceSemanticRole: target.sourceSemanticRole
      });

  if (stableResolution.status === "ambiguous") {
    throwValidationError({
      code: "INVALID_TOPOLOGY_ANCHOR",
      message: `Topology anchor ${target.topologyAnchorId} source-semantic ${expectedKind} role is ambiguous.`,
      opIndex,
      bodyId: target.bodyId,
      topologyAnchorId: target.topologyAnchorId,
      checkpointId: target.checkpointId,
      path: operationPath(opIndex, pathField),
      expected: `one source-semantic generated ${expectedKind} backing`,
      received: stableResolution.stableIds.join(", ")
    });
  }

  if (stableResolution.status !== "resolved") {
    throwValidationError({
      code: "INVALID_TOPOLOGY_ANCHOR",
      message: `Topology anchor ${target.topologyAnchorId} does not have a stable generated ${expectedKind} backing or source-semantic ${expectedKind} role.`,
      opIndex,
      bodyId: target.bodyId,
      topologyAnchorId: target.topologyAnchorId,
      checkpointId: target.checkpointId,
      path: operationPath(opIndex, pathField),
      expected: `stable generated ${expectedKind} backing or source-semantic ${expectedKind} role`,
      received: target.sourceSemanticRole
        ? `unmapped sourceSemanticRole: ${target.sourceSemanticRole}`
        : "missing stableId"
    });
  }

  return {
    bodyId: target.bodyId,
    stableId: stableResolution.stableId,
    topologyAnchorId: target.topologyAnchorId,
    checkpointId: target.checkpointId
  };
}

function resolveSketchAttachmentFaceTarget(
  state: MutableDocumentState,
  op: Extract<CadOp, { readonly op: "sketch.createOnFace" }>,
  opIndex?: number
): {
  readonly bodyId: BodyId;
  readonly stableId: string;
  readonly path: "faceStableId" | "referenceName" | "topologyAnchorId";
  readonly referenceName?: NamedReferenceName;
  readonly topologyAnchorId?: string;
  readonly checkpointId?: string;
} {
  if (op.referenceName !== undefined) {
    const name = normalizeNamedReferenceName(op.referenceName, opIndex);

    if (
      op.bodyId !== undefined ||
      op.faceStableId !== undefined ||
      op.topologyAnchorId !== undefined
    ) {
      throwValidationError({
        code: "INVALID_REFERENCE_NAME",
        message:
          "sketch.createOnFace must use referenceName, topologyAnchorId, or bodyId with faceStableId.",
        opIndex,
        referenceName: name,
        path: operationPath(opIndex, "referenceName"),
        expected:
          "referenceName without bodyId, faceStableId, or topologyAnchorId",
        received: "mixed generated reference inputs"
      });
    }

    const reference = state.namedReferences.get(name);

    if (!reference) {
      throwValidationError({
        code: "NAMED_REFERENCE_NOT_FOUND",
        message: `Named reference does not exist: ${name}`,
        opIndex,
        referenceName: name,
        path: operationPath(opIndex, "referenceName"),
        expected: "existing named reference",
        received: name
      });
    }

    return {
      bodyId: reference.bodyId,
      stableId: reference.stableId,
      path: "referenceName",
      referenceName: name
    };
  }

  if (op.topologyAnchorId !== undefined) {
    if (op.bodyId !== undefined || op.faceStableId !== undefined) {
      throwValidationError({
        code: "INVALID_TOPOLOGY_ANCHOR",
        message:
          "sketch.createOnFace must use topologyAnchorId without bodyId, faceStableId, or referenceName.",
        opIndex,
        topologyAnchorId: op.topologyAnchorId,
        path: operationPath(opIndex, "topologyAnchorId"),
        expected: "topologyAnchorId without generated reference inputs",
        received: "mixed topology anchor inputs"
      });
    }

    const target = resolveActiveTopologyAnchorStableTarget(
      state,
      op.topologyAnchorId,
      "face",
      opIndex
    );

    return {
      bodyId: target.bodyId,
      stableId: target.stableId,
      path: "topologyAnchorId",
      topologyAnchorId: target.topologyAnchorId,
      checkpointId: target.checkpointId
    };
  }

  if (op.bodyId === undefined || op.faceStableId === undefined) {
    throwValidationError({
      code: "GENERATED_REFERENCE_NOT_FOUND",
      message:
        "sketch.createOnFace requires bodyId with faceStableId, referenceName, or topologyAnchorId.",
      opIndex,
      bodyId: op.bodyId,
      stableId: op.faceStableId,
      path: operationPath(
        opIndex,
        op.bodyId === undefined ? "bodyId" : "faceStableId"
      ),
      expected: "bodyId and faceStableId, referenceName, or topologyAnchorId",
      received: describeReceived({
        bodyId: op.bodyId,
        faceStableId: op.faceStableId,
        referenceName: op.referenceName,
        topologyAnchorId: op.topologyAnchorId
      })
    });
  }

  return {
    bodyId: op.bodyId,
    stableId: op.faceStableId,
    path: "faceStableId"
  };
}

function documentBodyExists(
  state: MutableDocumentState,
  bodyId: BodyId
): boolean {
  return createProjectStructure(state, []).bodies.some(
    (body) => body.id === bodyId
  );
}

function resolveNamedReferenceRepairTarget(
  state: MutableDocumentState,
  op: Extract<CadOp, { readonly op: "reference.repairName" }>,
  before: NamedGeneratedReferenceSnapshot,
  referenceName: NamedReferenceName,
  opIndex?: number
): {
  readonly bodyId: BodyId;
  readonly stableId: string;
  readonly kind: CadGeneratedEntityKind;
  readonly topologyAnchorId?: string;
  readonly checkpointId?: string;
} {
  const hasGeneratedTarget =
    op.bodyId !== undefined || op.stableId !== undefined;

  if (op.topologyAnchorId !== undefined) {
    if (hasGeneratedTarget) {
      throwValidationError({
        code: "INVALID_OPERATION",
        message:
          "reference.repairName must use topologyAnchorId without bodyId or stableId.",
        opIndex,
        referenceName,
        topologyAnchorId: op.topologyAnchorId,
        path: operationPath(opIndex, "topologyAnchorId"),
        expected: "topologyAnchorId without generated reference inputs",
        received: describeReceived({
          bodyId: op.bodyId,
          stableId: op.stableId,
          topologyAnchorId: op.topologyAnchorId
        })
      });
    }

    const target = resolveActiveTopologyAnchorStableTarget(
      state,
      op.topologyAnchorId,
      before.kind,
      opIndex
    );
    const validation = validateGeneratedReference({
      document: state,
      ownerPartId: DEFAULT_PART_ID,
      bodyId: target.bodyId,
      stableId: target.stableId,
      expectedKind: before.kind,
      bodyExists: (bodyId) => documentBodyExists(state, bodyId),
      requiredOperation: "feature.selectReference"
    });

    if (!validation.ok) {
      throwRepairGeneratedReferenceValidationError(
        state,
        validation.error,
        opIndex,
        referenceName,
        "topologyAnchorId",
        target.topologyAnchorId,
        target.checkpointId
      );
    }

    assertRepairTargetBodyActive(
      state,
      target.bodyId,
      target.stableId,
      referenceName,
      opIndex,
      "topologyAnchorId",
      target.topologyAnchorId,
      target.checkpointId
    );

    return {
      bodyId: target.bodyId,
      stableId: target.stableId,
      kind: validation.kind,
      topologyAnchorId: target.topologyAnchorId,
      checkpointId: target.checkpointId
    };
  }

  if (op.bodyId === undefined || op.stableId === undefined) {
    throwValidationError({
      code: "INVALID_OPERATION",
      message:
        "reference.repairName requires bodyId and stableId, or topologyAnchorId.",
      opIndex,
      referenceName,
      path: operationPath(opIndex),
      expected: "bodyId and stableId, or topologyAnchorId",
      received: describeReceived({
        bodyId: op.bodyId,
        stableId: op.stableId,
        topologyAnchorId: op.topologyAnchorId
      })
    });
  }

  const validation = validateGeneratedReference({
    document: state,
    ownerPartId: DEFAULT_PART_ID,
    bodyId: op.bodyId,
    stableId: op.stableId,
    expectedKind: before.kind,
    bodyExists: (bodyId) => documentBodyExists(state, bodyId),
    requiredOperation: "feature.selectReference"
  });

  if (!validation.ok) {
    throwRepairGeneratedReferenceValidationError(
      state,
      validation.error,
      opIndex,
      referenceName
    );
  }

  assertRepairTargetBodyActive(
    state,
    op.bodyId,
    op.stableId,
    referenceName,
    opIndex
  );

  return {
    bodyId: op.bodyId,
    stableId: op.stableId,
    kind: validation.kind
  };
}

function assertRepairTargetBodyActive(
  state: MutableDocumentState,
  bodyId: BodyId,
  stableId: string,
  referenceName: NamedReferenceName,
  opIndex?: number,
  path: "bodyId" | "topologyAnchorId" = "bodyId",
  topologyAnchorId?: string,
  checkpointId?: string
): void {
  const body = createProjectStructure(state, []).bodies.find(
    (candidate) => candidate.id === bodyId
  );

  if (!body?.consumedByFeatureId) {
    return;
  }

  throwValidationError({
    code: "TARGET_BODY_NOT_SUPPORTED",
    message: `Cannot repair named reference ${referenceName} to consumed body ${bodyId}.`,
    opIndex,
    bodyId,
    stableId,
    referenceName,
    ...(topologyAnchorId ? { topologyAnchorId } : {}),
    ...(checkpointId ? { checkpointId } : {}),
    path: operationPath(opIndex, path),
    expected: "active command-ready generated reference target",
    received: `consumed by ${body.consumedByFeatureId}`
  });
}

function assertNamedReferenceRepairConsumers(
  state: MutableDocumentState,
  before: NamedGeneratedReferenceSnapshot,
  after: NamedGeneratedReferenceSnapshot,
  opIndex?: number
): void {
  for (const feature of state.features.values()) {
    if (
      (feature.kind !== "chamfer" && feature.kind !== "fillet") ||
      feature.namedReference !== before.name
    ) {
      continue;
    }

    if (after.kind !== "edge") {
      throwValidationError({
        code: "GENERATED_REFERENCE_KIND_MISMATCH",
        message: `Named reference ${before.name} is used by ${feature.kind} feature ${feature.id} and must remain an edge.`,
        opIndex,
        bodyId: after.bodyId,
        stableId: after.stableId,
        featureId: feature.id,
        referenceName: before.name,
        path: operationPath(opIndex, "stableId"),
        expected: "edge",
        received: after.kind
      });
    }

    if (after.bodyId !== feature.targetBodyId) {
      throwValidationError({
        code: "GENERATED_REFERENCE_NOT_FOUND",
        message: `Named reference ${before.name} is used by ${feature.kind} feature ${feature.id} and must still resolve to target body ${feature.targetBodyId}.`,
        opIndex,
        bodyId: after.bodyId,
        stableId: after.stableId,
        featureId: feature.id,
        referenceName: before.name,
        path: operationPath(opIndex, "bodyId"),
        expected: `named edge reference resolving to ${feature.targetBodyId}`,
        received: after.bodyId
      });
    }
  }
}

function throwRepairGeneratedReferenceValidationError(
  state: MutableDocumentState,
  error: GeneratedReferenceValidationError,
  opIndex: number | undefined,
  referenceName: NamedReferenceName,
  stableIdPath: "stableId" | "topologyAnchorId" = "stableId",
  topologyAnchorId?: string,
  checkpointId?: string
): never {
  const body = createProjectStructure(state, []).bodies.find(
    (candidate) => candidate.id === error.bodyId
  );
  const feature = body ? state.features.get(body.featureId) : undefined;

  if (
    error.code === "UNSUPPORTED_BODY_REFERENCES" &&
    body !== undefined &&
    feature?.kind === "extrude" &&
    feature.operationMode !== "newBody"
  ) {
    throwValidationError({
      code: error.code,
      message: `Boolean result body ${error.bodyId} has ambiguous generated topology and cannot be used as a named-reference repair target yet.`,
      opIndex,
      bodyId: error.bodyId,
      stableId: error.stableId,
      referenceName,
      ...(topologyAnchorId ? { topologyAnchorId } : {}),
      ...(checkpointId ? { checkpointId } : {}),
      path: operationPath(
        opIndex,
        stableIdPath === "topologyAnchorId" ? "topologyAnchorId" : "bodyId"
      ),
      expected: "command-ready source-semantic generated reference",
      received: `${feature.operationMode} extrude result`
    });
  }

  throwGeneratedReferenceValidationError(
    error,
    opIndex,
    stableIdPath,
    referenceName,
    topologyAnchorId,
    checkpointId
  );
}

function createNamedReferenceEntry(
  document: CadDocument,
  reference: NamedGeneratedReferenceSnapshot,
  transactions: readonly Transaction[]
): NamedGeneratedReferenceEntry {
  const result = validateGeneratedReference({
    document,
    ownerPartId: DEFAULT_PART_ID,
    bodyId: reference.bodyId,
    stableId: reference.stableId,
    bodyExists: (bodyId) =>
      createProjectStructure(document, transactions).bodies.some(
        (body) => body.id === bodyId
      )
  });

  if (!result.ok) {
    return {
      ...cloneNamedReferenceSnapshot(reference),
      status: "stale",
      error: createQueryErrorFromGeneratedReferenceError(
        result.error,
        reference.name
      )
    };
  }

  return {
    ...cloneNamedReferenceSnapshot(reference),
    status: "resolved",
    reference: result.reference
  };
}

function createSelectionReferenceCandidates(
  document: CadDocument,
  structure: CadProjectStructureSnapshot,
  transactions: readonly Transaction[],
  selection: CadSelectionReferenceInput,
  requiredOperation: CadSelectionReferenceOperation | undefined,
  topologyMatchResults: readonly CadTopologyMatchResult[] = []
): {
  readonly status: CadSelectionReferenceStatus;
  readonly candidates: readonly CadSelectionReferenceCandidate[];
  readonly issues: readonly CadSelectionReferenceIssue[];
} {
  if (selection.type === "body") {
    const body = structure.bodies.find(
      (candidate) => candidate.id === selection.bodyId
    );

    if (!body) {
      const issues = [
        createSelectionIssue(
          "MISSING_SELECTION_TARGET",
          "missing",
          `Selected body does not exist: ${selection.bodyId}`,
          { bodyId: selection.bodyId }
        )
      ];

      return {
        status: "missing",
        candidates: [],
        issues
      };
    }

    const references = createBodyGeneratedReferences(
      document,
      body.id,
      body.partId
    );

    if (!references) {
      const issues = [
        ...createConsumedSelectionIssues(body),
        createBodyReferenceUnavailableIssue(document, body)
      ];

      return {
        status: chooseSelectionReferenceStatus(issues),
        candidates: [],
        issues
      };
    }

    return createSingleSelectionReferenceCandidate({
      source: "bodySelection",
      selection,
      body,
      reference: references.body,
      requiredOperation
    });
  }

  if (selection.type === "generatedReference") {
    const body = structure.bodies.find(
      (candidate) => candidate.id === selection.bodyId
    );

    if (!body) {
      const issues = [
        createSelectionIssue(
          "MISSING_SELECTION_TARGET",
          "missing",
          `Selected generated reference body does not exist: ${selection.bodyId}`,
          { bodyId: selection.bodyId, stableId: selection.stableId }
        )
      ];

      return {
        status: "missing",
        candidates: [],
        issues
      };
    }

    const references = createBodyGeneratedReferences(
      document,
      body.id,
      body.partId
    );

    if (!references) {
      const issues = [
        ...createConsumedSelectionIssues(body),
        createBodyReferenceUnavailableIssue(document, body, selection.stableId)
      ];

      return {
        status: chooseSelectionReferenceStatus(issues),
        candidates: [],
        issues
      };
    }

    const resolution = resolveGeneratedReference(
      references,
      selection.stableId
    );

    if (!resolution) {
      const issues = [
        createSelectionIssue(
          "STALE_SELECTION_REFERENCE",
          "stale",
          `Selected generated reference is no longer available on ${selection.bodyId}: ${selection.stableId}`,
          { bodyId: selection.bodyId, stableId: selection.stableId }
        )
      ];

      return {
        status: "stale",
        candidates: [],
        issues
      };
    }

    const extraIssues =
      selection.expectedKind !== undefined &&
      selection.expectedKind !== resolution.kind
        ? [
            createSelectionIssue(
              "SELECTION_KIND_MISMATCH",
              "non-commandable",
              `Selected generated reference ${selection.stableId} resolved as ${resolution.kind}, not ${selection.expectedKind}.`,
              {
                bodyId: selection.bodyId,
                stableId: selection.stableId,
                expected: selection.expectedKind,
                received: resolution.kind
              }
            )
          ]
        : [];

    return createSingleSelectionReferenceCandidate({
      source: "generatedReferenceSelection",
      selection,
      body,
      reference: resolution.reference,
      requiredOperation,
      extraIssues
    });
  }

  if (selection.type === "topologyAnchor") {
    return createTopologyAnchorSelectionReferenceCandidate({
      document,
      structure,
      selection,
      requiredOperation,
      topologyMatchResults
    });
  }

  const namedReference = document.namedReferences.get(selection.name);

  if (!namedReference) {
    const issues = [
      createSelectionIssue(
        "MISSING_SELECTION_TARGET",
        "missing",
        `Named reference does not exist: ${selection.name}`,
        { referenceName: selection.name }
      )
    ];

    return {
      status: "missing",
      candidates: [],
      issues
    };
  }

  const entry = createNamedReferenceEntry(
    document,
    namedReference,
    transactions
  );

  if (entry.status === "stale" || !entry.reference) {
    const issues = [
      createSelectionIssue(
        "STALE_SELECTION_REFERENCE",
        "stale",
        entry.error?.message ??
          `Named reference target is stale: ${selection.name}`,
        {
          bodyId: namedReference.bodyId,
          stableId: namedReference.stableId,
          referenceName: namedReference.name
        }
      )
    ];

    return {
      status: "stale",
      candidates: [],
      issues
    };
  }

  const body = structure.bodies.find(
    (candidate) => candidate.id === entry.reference?.bodyId
  );

  if (!body) {
    const issues = [
      createSelectionIssue(
        "MISSING_SELECTION_TARGET",
        "missing",
        `Named reference body does not exist: ${entry.bodyId}`,
        {
          bodyId: entry.bodyId,
          stableId: entry.stableId,
          referenceName: entry.name
        }
      )
    ];

    return {
      status: "missing",
      candidates: [],
      issues
    };
  }

  const namedTopologyAnchor = entry.topologyAnchorId
    ? document.topologyIdentity?.anchors.find(
        (candidate) => candidate.anchorId === entry.topologyAnchorId
      )
    : undefined;

  return createSingleSelectionReferenceCandidate({
    source: "namedReferenceSelection",
    selection,
    body,
    reference: entry.reference,
    requiredOperation,
    topologyAnchorId: entry.topologyAnchorId,
    checkpointId: namedTopologyAnchor?.checkpointId
  });
}

function createTopologyAnchorSelectionReferenceCandidate(options: {
  readonly document: CadDocument;
  readonly structure: CadProjectStructureSnapshot;
  readonly selection: Extract<
    CadSelectionReferenceInput,
    { type: "topologyAnchor" }
  >;
  readonly requiredOperation?: CadSelectionReferenceOperation;
  readonly topologyMatchResults: readonly CadTopologyMatchResult[];
}): {
  readonly status: CadSelectionReferenceStatus;
  readonly candidates: readonly CadSelectionReferenceCandidate[];
  readonly issues: readonly CadSelectionReferenceIssue[];
} {
  const topologyIdentity = options.document.topologyIdentity;
  const anchor = topologyIdentity?.anchors.find(
    (candidate) => candidate.anchorId === options.selection.anchorId
  );

  if (!topologyIdentity || !anchor) {
    const issues = [
      createSelectionIssue(
        "MISSING_SELECTION_TARGET",
        "missing",
        `Topology anchor does not exist: ${options.selection.anchorId}`,
        { topologyAnchorId: options.selection.anchorId }
      )
    ];

    return { status: "missing", candidates: [], issues };
  }

  const checkpoint = topologyIdentity.checkpoints.find(
    (candidate) => candidate.checkpointId === anchor.checkpointId
  );
  const match = options.topologyMatchResults.find(
    (candidate) => candidate.anchorId === anchor.anchorId
  );
  const status = createTopologyAnchorReferenceStatusForSelection({
    anchor,
    checkpoint,
    match
  });
  const commandOperations = createTopologyAnchorCommandOperationsForSelection(
    anchor,
    status
  );

  if (status !== "active") {
    const selectionStatus = selectionStatusFromReferenceHealthStatus(status);
    const issues = [
      createSelectionIssue(
        selectionIssueCodeFromReferenceHealthStatus(status),
        selectionStatus,
        `Topology anchor ${anchor.anchorId} is ${status} and is not command-ready.`,
        {
          bodyId: anchor.bodyId,
          stableId: anchor.stableId,
          topologyAnchorId: anchor.anchorId,
          checkpointId: anchor.checkpointId,
          expected: "active topology anchor",
          received: status
        }
      )
    ];

    return { status: selectionStatus, candidates: [], issues };
  }

  const body = options.structure.bodies.find(
    (candidate) => candidate.id === anchor.bodyId
  );

  if (!body) {
    const issues = [
      createSelectionIssue(
        "MISSING_SELECTION_TARGET",
        "missing",
        `Topology anchor body does not exist: ${anchor.bodyId}`,
        {
          bodyId: anchor.bodyId,
          stableId: anchor.stableId,
          topologyAnchorId: anchor.anchorId,
          checkpointId: anchor.checkpointId
        }
      )
    ];

    return { status: "missing", candidates: [], issues };
  }

  const stableResolution = anchor.stableId
    ? { status: "resolved" as const, stableId: anchor.stableId }
    : resolveTopologyAnchorGeneratedReferenceFromSourceRole({
        document: options.document,
        ownerPartId: body.partId,
        bodyId: anchor.bodyId,
        entityKind: anchor.entityKind,
        sourceSemanticRole: anchor.sourceSemanticRole
      });

  if (stableResolution.status !== "resolved") {
    const issues = [
      createSelectionIssue(
        "UNSUPPORTED_SELECTION_TARGET",
        "unsupported",
        stableResolution.status === "ambiguous"
          ? `Topology anchor ${anchor.anchorId} source-semantic role matches multiple generated references.`
          : `Topology anchor ${anchor.anchorId} does not have stable generated-reference backing or a supported source-semantic role.`,
        {
          bodyId: anchor.bodyId,
          topologyAnchorId: anchor.anchorId,
          checkpointId: anchor.checkpointId,
          expected:
            "stable generated reference backing or source-semantic generated reference role",
          received:
            stableResolution.status === "ambiguous"
              ? stableResolution.stableIds.join(", ")
              : (anchor.sourceSemanticRole ?? "missing stableId")
        }
      )
    ];

    return { status: "unsupported", candidates: [], issues };
  }

  const stableId = stableResolution.stableId;

  const references = createBodyGeneratedReferences(
    options.document,
    body.id,
    body.partId
  );

  if (!references) {
    const issues = [
      ...createConsumedSelectionIssues(body),
      createBodyReferenceUnavailableIssue(options.document, body, stableId)
    ];

    return {
      status: chooseSelectionReferenceStatus(issues),
      candidates: [],
      issues
    };
  }

  const resolution = resolveGeneratedReference(references, stableId);

  if (!resolution) {
    const issues = [
      createSelectionIssue(
        "STALE_SELECTION_REFERENCE",
        "stale",
        `Topology anchor ${anchor.anchorId} stable generated reference is no longer available on ${anchor.bodyId}: ${stableId}`,
        {
          bodyId: anchor.bodyId,
          stableId,
          topologyAnchorId: anchor.anchorId,
          checkpointId: anchor.checkpointId
        }
      )
    ];

    return { status: "stale", candidates: [], issues };
  }

  const extraIssues =
    resolution.kind === anchor.entityKind
      ? []
      : [
          createSelectionIssue(
            "SELECTION_KIND_MISMATCH",
            "non-commandable",
            `Topology anchor ${anchor.anchorId} resolved as ${resolution.kind}, not ${anchor.entityKind}.`,
            {
              bodyId: anchor.bodyId,
              stableId,
              topologyAnchorId: anchor.anchorId,
              checkpointId: anchor.checkpointId,
              expected: anchor.entityKind,
              received: resolution.kind
            }
          )
        ];
  const supportedCommandOperations =
    createTopologyAnchorGeneratedReferenceCommandOperations(
      commandOperations,
      resolution.reference
    );

  return createSingleSelectionReferenceCandidate({
    source: "topologyAnchorSelection",
    selection: options.selection,
    body,
    reference: resolution.reference,
    requiredOperation: options.requiredOperation,
    extraIssues,
    commandOperations: supportedCommandOperations,
    topologyAnchorId: anchor.anchorId,
    checkpointId: anchor.checkpointId
  });
}

function createTopologyAnchorGeneratedReferenceCommandOperations(
  anchorOperations: readonly CadSelectionReferenceOperation[],
  reference: CadGeneratedReference
): readonly CadSelectionReferenceOperation[] {
  const operations = [
    ...reference.eligibleOperations.filter(
      (operation): operation is CadGeneratedReferenceEligibleOperation =>
        operation === "feature.attachSketchPlane" ||
        operation === "feature.chamfer" ||
        operation === "feature.fillet" ||
        operation === "feature.measureReference" ||
        operation === "feature.selectReference"
    ),
    ...anchorOperations
  ];

  return [...new Set(operations)];
}

function createSingleSelectionReferenceCandidate(options: {
  readonly source: CadSelectionReferenceCandidateSource;
  readonly selection: CadSelectionReferenceInput;
  readonly body: CadBodySnapshot;
  readonly reference: CadGeneratedReference;
  readonly requiredOperation?: CadSelectionReferenceOperation;
  readonly extraIssues?: readonly CadSelectionReferenceIssue[];
  readonly commandOperations?: readonly CadSelectionReferenceOperation[];
  readonly topologyAnchorId?: string;
  readonly checkpointId?: string;
}): {
  readonly status: CadSelectionReferenceStatus;
  readonly candidates: readonly CadSelectionReferenceCandidate[];
  readonly issues: readonly CadSelectionReferenceIssue[];
} {
  const consumedIssues = createConsumedSelectionIssues(options.body);
  const namingOperations: readonly CadSelectionReferenceOperation[] =
    options.reference.eligibleOperations.includes("feature.selectReference")
      ? ["reference.nameGenerated"]
      : [];
  const baseOperations: readonly CadSelectionReferenceOperation[] =
    consumedIssues.length > 0
      ? []
      : (options.commandOperations ?? [
          ...namingOperations,
          ...options.reference.eligibleOperations
        ]);
  const operationIssues =
    consumedIssues.length === 0
      ? createCommandabilityIssues(
          options.reference,
          baseOperations,
          options.requiredOperation
        )
      : [];
  const issues = [
    ...consumedIssues,
    ...(options.extraIssues ?? []),
    ...operationIssues
  ];
  const commandable = issues.length === 0;
  const target: CadSelectionReferenceCommandTarget = {
    type: "generatedReference",
    bodyId: options.reference.bodyId,
    stableId: options.reference.stableId,
    kind: options.reference.kind,
    ...(options.topologyAnchorId
      ? { topologyAnchorId: options.topologyAnchorId }
      : {}),
    ...(options.checkpointId ? { checkpointId: options.checkpointId } : {}),
    ...(options.selection.type === "namedReference"
      ? { referenceName: options.selection.name }
      : {})
  };
  const candidate: CadSelectionReferenceCandidate = {
    source: options.source,
    target,
    reference: options.reference,
    commandable,
    commandOperations: baseOperations,
    label: options.reference.label,
    ...(options.reference.description
      ? { description: options.reference.description }
      : {}),
    issues
  };

  return {
    status: commandable ? "resolved" : chooseSelectionReferenceStatus(issues),
    candidates: [candidate],
    issues
  };
}

function createCommandabilityIssues(
  reference: CadGeneratedReference,
  operations: readonly CadSelectionReferenceOperation[],
  requiredOperation: CadSelectionReferenceOperation | undefined
): readonly CadSelectionReferenceIssue[] {
  if (operations.length === 0) {
    const message =
      reference.kind === "body"
        ? "This result body is visible, but body-level modeling commands are not available. Select a command-ready face or edge on the result for sketching, naming, measuring, or inspecting."
        : `Selected ${reference.kind} reference has no command-ready operations.`;

    return [
      createSelectionIssue(
        "NON_COMMANDABLE_SELECTION_TARGET",
        "non-commandable",
        message,
        {
          bodyId: reference.bodyId,
          stableId: reference.stableId
        }
      )
    ];
  }

  if (
    requiredOperation !== undefined &&
    !operations.includes(requiredOperation)
  ) {
    return [
      createSelectionIssue(
        "NON_COMMANDABLE_SELECTION_TARGET",
        "non-commandable",
        `Selected ${reference.kind} reference is not eligible for ${requiredOperation}.`,
        {
          bodyId: reference.bodyId,
          stableId: reference.stableId,
          expected: requiredOperation,
          received: operations.join(", ")
        }
      )
    ];
  }

  return [];
}

function selectionStatusFromReferenceHealthStatus(
  status: CadReferenceHealthStatus
): Exclude<CadSelectionReferenceStatus, "resolved"> {
  if (status === "active") {
    return "non-commandable";
  }

  if (status === "missing" || status === "deleted") {
    return "missing";
  }

  if (status === "stale") {
    return "stale";
  }

  if (status === "ambiguous") {
    return "ambiguous";
  }

  if (status === "consumed") {
    return "consumed";
  }

  if (status === "unsupported") {
    return "unsupported";
  }

  return "non-commandable";
}

function selectionIssueCodeFromReferenceHealthStatus(
  status: CadReferenceHealthStatus
): CadSelectionReferenceIssueCode {
  if (status === "missing" || status === "deleted") {
    return "MISSING_SELECTION_TARGET";
  }

  if (status === "stale") {
    return "STALE_SELECTION_REFERENCE";
  }

  if (status === "ambiguous") {
    return "AMBIGUOUS_SELECTION_TOPOLOGY";
  }

  if (status === "unsupported") {
    return "UNSUPPORTED_SELECTION_TARGET";
  }

  return "NON_COMMANDABLE_SELECTION_TARGET";
}

function createConsumedSelectionIssues(
  body: CadBodySnapshot
): readonly CadSelectionReferenceIssue[] {
  if (!body.consumedByFeatureId) {
    return [];
  }

  return [
    createSelectionIssue(
      "CONSUMED_SELECTION_BODY",
      "consumed",
      `Selected body ${body.id} is consumed by feature ${body.consumedByFeatureId}.`,
      {
        bodyId: body.id,
        featureId: body.consumedByFeatureId
      }
    )
  ];
}

function createBodyReferenceUnavailableIssue(
  document: CadDocument,
  body: CadBodySnapshot,
  stableId?: string
): CadSelectionReferenceIssue {
  if (body.source.type === "primitiveFeature") {
    return createSelectionIssue(
      "UNSUPPORTED_SELECTION_TARGET",
      "unsupported",
      `Primitive body ${body.id} does not expose command-ready semantic generated references.`,
      {
        bodyId: body.id,
        stableId,
        featureId: body.featureId,
        expected: "authored rectangle/circle newBody extrude"
      }
    );
  }

  if (body.source.type === "sketchExtrudeFeature") {
    const feature = document.features.get(body.featureId);

    if (feature?.kind === "extrude" && feature.operationMode !== "newBody") {
      return createSelectionIssue(
        "AMBIGUOUS_SELECTION_TOPOLOGY",
        "ambiguous",
        `Boolean result body ${body.id} is visible, but body-level modeling commands are not available. Select a command-ready result face or edge for sketching, naming, measuring, or inspecting.`,
        {
          bodyId: body.id,
          stableId,
          featureId: body.featureId,
          expected: "authored rectangle/circle newBody extrude",
          received: `${feature.operationMode} extrude result`
        }
      );
    }

    return createSelectionIssue(
      "STALE_SELECTION_REFERENCE",
      "stale",
      `Authored extrude body ${body.id} no longer resolves to generated references from its source sketch.`,
      {
        bodyId: body.id,
        stableId,
        featureId: body.featureId,
        expected: "resolvable rectangle/circle newBody extrude source"
      }
    );
  }

  return createSelectionIssue(
    "AMBIGUOUS_SELECTION_TOPOLOGY",
    "ambiguous",
    `Body ${body.id} does not expose stable command-ready generated references yet.`,
    {
      bodyId: body.id,
      stableId,
      featureId: body.featureId,
      expected: "authored rectangle/circle newBody extrude",
      received: body.source.type
    }
  );
}

function createSelectionIssue(
  code: CadSelectionReferenceIssueCode,
  status: Exclude<CadSelectionReferenceStatus, "resolved">,
  message: string,
  details: {
    readonly bodyId?: BodyId;
    readonly stableId?: string;
    readonly topologyAnchorId?: string;
    readonly checkpointId?: string;
    readonly referenceName?: NamedReferenceName;
    readonly featureId?: FeatureId;
    readonly expected?: string;
    readonly received?: string;
  } = {}
): CadSelectionReferenceIssue {
  return {
    code,
    status,
    message,
    ...(details.bodyId ? { bodyId: details.bodyId } : {}),
    ...(details.stableId ? { stableId: details.stableId } : {}),
    ...(details.topologyAnchorId
      ? { topologyAnchorId: details.topologyAnchorId }
      : {}),
    ...(details.checkpointId ? { checkpointId: details.checkpointId } : {}),
    ...(details.referenceName ? { referenceName: details.referenceName } : {}),
    ...(details.featureId ? { featureId: details.featureId } : {}),
    ...(details.expected ? { expected: details.expected } : {}),
    ...(details.received ? { received: details.received } : {})
  };
}

function chooseSelectionReferenceStatus(
  issues: readonly CadSelectionReferenceIssue[]
): CadSelectionReferenceStatus {
  const statuses = new Set(issues.map((issue) => issue.status));

  for (const status of [
    "missing",
    "stale",
    "consumed",
    "ambiguous",
    "unsupported",
    "non-commandable"
  ] satisfies readonly Exclude<CadSelectionReferenceStatus, "resolved">[]) {
    if (statuses.has(status)) {
      return status;
    }
  }

  return "resolved";
}

function createQueryErrorFromGeneratedReferenceError(
  error: GeneratedReferenceValidationError,
  referenceName?: NamedReferenceName
): CadQueryError {
  return {
    code:
      error.code === "GENERATED_REFERENCE_KIND_MISMATCH" ||
      error.code === "GENERATED_REFERENCE_OPERATION_NOT_ELIGIBLE"
        ? "GENERATED_REFERENCE_NOT_FOUND"
        : error.code,
    message: error.message,
    bodyId: error.bodyId,
    stableId: error.stableId,
    ...(referenceName ? { referenceName } : {})
  };
}

function throwGeneratedReferenceValidationError(
  error: GeneratedReferenceValidationError,
  opIndex?: number,
  stableIdPath:
    | "edgeStableId"
    | "faceStableId"
    | "stableId"
    | "referenceName"
    | "targetTopologyAnchorId"
    | "topologyAnchorId" = "faceStableId",
  referenceName?: NamedReferenceName,
  topologyAnchorId?: string,
  checkpointId?: string
): never {
  throwValidationError({
    code: error.code,
    message: error.message,
    opIndex,
    bodyId: error.bodyId,
    stableId: error.stableId,
    ...(referenceName ? { referenceName } : {}),
    ...(topologyAnchorId ? { topologyAnchorId } : {}),
    ...(checkpointId ? { checkpointId } : {}),
    path: operationPath(
      opIndex,
      error.code === "BODY_NOT_FOUND" ||
        error.code === "UNSUPPORTED_BODY_REFERENCES"
        ? stableIdPath === "referenceName"
          ? "referenceName"
          : stableIdPath === "topologyAnchorId"
            ? "topologyAnchorId"
            : "bodyId"
        : stableIdPath
    ),
    expected: describeGeneratedReferenceValidationExpected(error),
    received: describeGeneratedReferenceValidationReceived(error)
  });
}

function describeGeneratedReferenceValidationExpected(
  error: GeneratedReferenceValidationError
): string {
  if (error.code === "BODY_NOT_FOUND") {
    return "existing body id";
  }

  if (error.code === "UNSUPPORTED_BODY_REFERENCES") {
    return "authored sketch-extrude body or supported authored hole result body";
  }

  if (error.code === "GENERATED_REFERENCE_NOT_FOUND") {
    return "existing generated reference stable id";
  }

  if (error.code === "GENERATED_REFERENCE_KIND_MISMATCH") {
    return error.expectedKind ?? "expected generated reference kind";
  }

  return error.requiredOperation ?? "eligible generated reference operation";
}

function describeGeneratedReferenceValidationReceived(
  error: GeneratedReferenceValidationError
): string | undefined {
  if (error.actualKind) {
    return error.actualKind;
  }

  return error.stableId;
}

function createSketchPlaneFromFaceReference(
  face: CadGeneratedFaceReference,
  path: "faceStableId" | "referenceName" | "topologyAnchorId" = "faceStableId",
  opIndex?: number
): SketchPlane {
  const normal = face.geometricSignature.normal;

  if (!normal) {
    throwValidationError({
      code: "INVALID_SKETCH_PLANE",
      message: `Generated face is not planar: ${face.stableId}`,
      opIndex,
      bodyId: face.bodyId,
      stableId: face.stableId,
      path: operationPath(opIndex, path),
      expected: "planar generated face reference",
      received: face.stableId
    });
  }

  const [x, y, z] = normal.map((component) => Math.abs(component));

  if (z === 1 && x === 0 && y === 0) {
    return "XY";
  }

  if (y === 1 && x === 0 && z === 0) {
    return "XZ";
  }

  if (x === 1 && y === 0 && z === 0) {
    return "YZ";
  }

  throwValidationError({
    code: "INVALID_SKETCH_PLANE",
    message: `Generated face normal cannot be mapped to an MVP sketch plane: ${face.stableId}`,
    opIndex,
    bodyId: face.bodyId,
    stableId: face.stableId,
    path: operationPath(opIndex, path),
    expected: "axis-aligned planar generated face reference",
    received: JSON.stringify(normal)
  });
}

function validateTopologyAnchorFaceProof(
  proof: CadTopologyAnchorCommandProof,
  opIndex?: number
): CadTopologyAnchorCommandProof & {
  readonly kind: "axisAlignedPlanarFace";
  readonly entityKind: "face";
  readonly planarAxis: "x" | "y" | "z";
  readonly planarCoordinate: number;
} {
  if (
    proof.kind === "axisAlignedPlanarFace" &&
    proof.entityKind === "face" &&
    proof.evidenceSource === "checkpointSnapshot" &&
    proof.exposesCheckpointLocalIds === false &&
    isPlanarAxis(proof.planarAxis) &&
    typeof proof.planarCoordinate === "number" &&
    Number.isFinite(proof.planarCoordinate)
  ) {
    return proof as CadTopologyAnchorCommandProof & {
      readonly kind: "axisAlignedPlanarFace";
      readonly entityKind: "face";
      readonly planarAxis: "x" | "y" | "z";
      readonly planarCoordinate: number;
    };
  }

  throwValidationError({
    code: "INVALID_TOPOLOGY_ANCHOR",
    message:
      "sketch.createOnFace topologyAnchorProof must be an axis-aligned planar face proof.",
    opIndex,
    path: operationPath(opIndex, "topologyAnchorProof"),
    expected:
      "axisAlignedPlanarFace proof with finite planar axis and coordinate",
    received: describeReceived(proof)
  });
}

function isPlanarAxis(value: unknown): value is "x" | "y" | "z" {
  return value === "x" || value === "y" || value === "z";
}

function sketchPlaneFromPlanarAxis(axis: "x" | "y" | "z"): SketchPlane {
  switch (axis) {
    case "x":
      return "YZ";
    case "y":
      return "XZ";
    case "z":
      return "XY";
  }
}

function createSketchFaceAttachment(
  face: CadGeneratedFaceReference
): SketchAttachmentSnapshot {
  return {
    kind: "generatedFace",
    bodyId: face.bodyId,
    faceStableId: face.stableId,
    sourceFeatureId: face.sourceFeatureId,
    sourceSketchId: face.sourceSketchId,
    sourceSketchEntityId: face.sourceSketchEntityId,
    faceRole: face.role as CadGeneratedExtrudeFaceRole
  };
}

function validateSketchPlane(
  plane: SketchPlane,
  opIndex?: number
): SketchPlane {
  if (isSketchPlane(plane)) {
    return plane;
  }

  throwValidationError({
    code: "INVALID_SKETCH_PLANE",
    message: `Unsupported sketch plane: ${String(plane)}.`,
    opIndex,
    path: operationPath(opIndex, "plane"),
    expected: "XY, XZ, or YZ",
    received: describeReceived(plane)
  });
}

function validateVec2(
  value: Vec2,
  opIndex: number | undefined,
  field: string
): Vec2 {
  if (isVec2(value)) {
    return [value[0], value[1]];
  }

  throwValidationError({
    code: "INVALID_SKETCH_ENTITY",
    message: "Sketch coordinates must contain two finite numbers.",
    opIndex,
    path: operationPath(opIndex, field),
    expected: "two finite numbers",
    received: describeReceived(value)
  });
}

function validatePositiveSketchMeasurement(
  value: number,
  opIndex: number | undefined,
  field: string
): number {
  if (isPositiveFiniteNumber(value)) {
    return value;
  }

  throwValidationError({
    code: "INVALID_SKETCH_ENTITY",
    message: "Sketch measurements must be positive finite numbers.",
    opIndex,
    path: operationPath(opIndex, field),
    expected: "positive finite number",
    received: describeReceived(value)
  });
}

function normalizeSketchEntity(
  entity: SketchEntitySnapshot,
  opIndex?: number
): SketchEntity {
  if (typeof entity.id !== "string" || entity.id.length === 0) {
    throwValidationError({
      code: "INVALID_SKETCH_ENTITY",
      message: "Sketch entity id must be a non-empty string.",
      opIndex,
      path: operationPath(opIndex, "entity.id"),
      expected: "non-empty string",
      received: describeReceived(entity.id)
    });
  }

  switch (entity.kind) {
    case "point":
      return {
        id: entity.id,
        kind: entity.kind,
        point: validateVec2(entity.point, opIndex, "entity.point")
      };
    case "line":
      return {
        id: entity.id,
        kind: entity.kind,
        start: validateVec2(entity.start, opIndex, "entity.start"),
        end: validateVec2(entity.end, opIndex, "entity.end")
      };
    case "rectangle":
      return {
        id: entity.id,
        kind: entity.kind,
        center: validateVec2(entity.center, opIndex, "entity.center"),
        width: validatePositiveSketchMeasurement(
          entity.width,
          opIndex,
          "entity.width"
        ),
        height: validatePositiveSketchMeasurement(
          entity.height,
          opIndex,
          "entity.height"
        )
      };
    case "circle":
      return {
        id: entity.id,
        kind: entity.kind,
        center: validateVec2(entity.center, opIndex, "entity.center"),
        radius: validatePositiveSketchMeasurement(
          entity.radius,
          opIndex,
          "entity.radius"
        )
      };
  }
}

function isPositiveFiniteNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function mergeTransform(
  transform: Partial<Transform> | undefined,
  base: Transform = createDefaultTransform()
): Transform {
  return {
    translation: transform?.translation ?? base.translation,
    rotation: transform?.rotation ?? base.rotation,
    scale: transform?.scale ?? base.scale
  };
}

function cloneTransform(transform: Transform): Transform {
  return {
    translation: [...transform.translation],
    rotation: [...transform.rotation],
    scale: [...transform.scale]
  };
}

function objectRef(object: SceneObject): CadObjectRef {
  return {
    id: object.id,
    kind: object.kind
  };
}

function sketchRef(sketch: Sketch): CadSketchRef {
  return {
    id: sketch.id
  };
}

function sketchEntityRef(
  sketchId: SketchId,
  entity: SketchEntity
): CadSketchEntityRef {
  return {
    sketchId,
    id: entity.id,
    kind: entity.kind
  };
}

function featureRef(feature: Feature): CadFeatureRef {
  if (feature.kind === "chamfer") {
    return {
      id: feature.id,
      kind: "chamfer",
      bodyId: feature.bodyId,
      targetBodyId: feature.targetBodyId,
      ...(feature.edgeStableId ? { edgeStableId: feature.edgeStableId } : {}),
      ...(feature.namedReference
        ? { namedReference: feature.namedReference }
        : {}),
      ...(feature.topologyAnchorId
        ? { topologyAnchorId: feature.topologyAnchorId }
        : {}),
      distance: feature.distance
    };
  }

  if (feature.kind === "fillet") {
    return {
      id: feature.id,
      kind: "fillet",
      bodyId: feature.bodyId,
      targetBodyId: feature.targetBodyId,
      ...(feature.edgeStableId ? { edgeStableId: feature.edgeStableId } : {}),
      ...(feature.namedReference
        ? { namedReference: feature.namedReference }
        : {}),
      ...(feature.topologyAnchorId
        ? { topologyAnchorId: feature.topologyAnchorId }
        : {}),
      radius: feature.radius
    };
  }

  if (feature.kind === "hole") {
    return {
      id: feature.id,
      kind: "hole",
      bodyId: feature.bodyId,
      targetBodyId: feature.targetBodyId,
      ...(feature.targetTopologyAnchorId
        ? { targetTopologyAnchorId: feature.targetTopologyAnchorId }
        : {}),
      sketchId: feature.sketchId,
      circleEntityId: feature.circleEntityId,
      depthMode: feature.depthMode,
      ...(feature.depth !== undefined ? { depth: feature.depth } : {}),
      direction: feature.direction
    };
  }

  if (feature.kind === "revolve") {
    return {
      id: feature.id,
      kind: "revolve",
      bodyId: feature.bodyId,
      sketchId: feature.sketchId,
      entityId: feature.entityId,
      profileKind: feature.profileKind,
      axis: feature.axis,
      angleDegrees: feature.angleDegrees,
      operationMode: feature.operationMode,
      ...(feature.targetBodyId ? { targetBodyId: feature.targetBodyId } : {})
    };
  }

  return {
    id: feature.id,
    kind: "extrude",
    bodyId: feature.bodyId,
    sketchId: feature.sketchId,
    entityId: feature.entityId,
    profileKind: feature.profileKind,
    depth: feature.depth,
    side: feature.side,
    operationMode: feature.operationMode,
    ...(feature.targetBodyId ? { targetBodyId: feature.targetBodyId } : {}),
    ...(feature.targetTopologyAnchorId
      ? { targetTopologyAnchorId: feature.targetTopologyAnchorId }
      : {})
  };
}

function bodyRef(feature: Feature): CadBodyRef {
  return {
    id: feature.bodyId,
    kind: "solid",
    featureId: feature.id
  };
}

function namedReferenceRef(
  reference: NamedGeneratedReferenceSnapshot
): CadNamedReferenceRef {
  return {
    name: reference.name,
    bodyId: reference.bodyId,
    stableId: reference.stableId,
    kind: reference.kind,
    ...(reference.topologyAnchorId
      ? { topologyAnchorId: reference.topologyAnchorId }
      : {})
  };
}

function topologyCheckpointRef(
  checkpoint: CadTopologyCheckpointSourceRecord
): CadTopologyCheckpointRef {
  return {
    checkpointId: checkpoint.checkpointId,
    bodyId: checkpoint.bodyId,
    ...(checkpoint.sourceFeatureId
      ? { sourceFeatureId: checkpoint.sourceFeatureId }
      : {}),
    sourceIdentity: checkpoint.sourceIdentity,
    status: checkpoint.status
  };
}

function topologyAnchorRef(
  anchor: CadTopologyAnchorSourceRecord
): CadTopologyAnchorRef {
  return {
    anchorId: anchor.anchorId,
    entityKind: anchor.entityKind,
    bodyId: anchor.bodyId,
    checkpointId: anchor.checkpointId,
    checkpointEntityId: anchor.checkpointEntityId,
    ...(anchor.sourceFeatureId
      ? { sourceFeatureId: anchor.sourceFeatureId }
      : {}),
    ...(anchor.stableId ? { stableId: anchor.stableId } : {})
  };
}

function parameterRef(parameter: CadParameter): CadParameterRef {
  return {
    id: parameter.id,
    name: parameter.name
  };
}

function sketchDimensionRef(dimension: SketchDimension): CadSketchDimensionRef {
  return {
    id: dimension.id,
    name: dimension.name,
    sketchId: dimension.sketchId,
    entityId: dimension.entityId,
    target: dimension.target,
    ...(dimension.valueSource.type === "parameter"
      ? { parameterId: dimension.valueSource.parameterId }
      : {})
  };
}

function sketchConstraintRef(
  constraint: SketchConstraint
): CadSketchConstraintRef {
  return {
    id: constraint.id,
    name: constraint.name,
    sketchId: constraint.sketchId,
    entityId: constraint.entityId,
    kind: constraint.kind,
    ...(constraint.kind === "fixed"
      ? { target: { ...constraint.target } }
      : {}),
    ...(constraint.kind === "coincident"
      ? {
          primaryTarget: { ...constraint.primaryTarget },
          secondaryTarget: { ...constraint.secondaryTarget }
        }
      : {}),
    ...(constraint.kind === "midpoint"
      ? {
          lineEntityId: constraint.lineEntityId,
          target: { ...constraint.target }
        }
      : {}),
    ...(isLinePairSketchConstraint(constraint)
      ? {
          primaryLineEntityId: constraint.primaryLineEntityId,
          secondaryLineEntityId: constraint.secondaryLineEntityId
        }
      : {}),
    ...(constraint.kind === "tangent"
      ? {
          primaryCurveTarget: { ...constraint.primaryTarget },
          secondaryCurveTarget: { ...constraint.secondaryTarget }
        }
      : {}),
    ...(constraint.kind === "concentric"
      ? {
          primaryCircleEntityId: constraint.primaryCircleEntityId,
          secondaryCircleEntityId: constraint.secondaryCircleEntityId
        }
      : {}),
    ...(constraint.kind === "equalLength"
      ? {
          primaryLineEntityId: constraint.primaryLineEntityId,
          secondaryLineEntityId: constraint.secondaryLineEntityId
        }
      : {}),
    ...(constraint.kind === "equalRadius"
      ? {
          primaryCircleEntityId: constraint.primaryCircleEntityId,
          secondaryCircleEntityId: constraint.secondaryCircleEntityId
        }
      : {}),
    ...(constraint.kind === "angle"
      ? {
          primaryLineEntityId: constraint.primaryLineEntityId,
          secondaryLineEntityId: constraint.secondaryLineEntityId,
          angleDegrees: constraint.angleDegrees
        }
      : {}),
    ...(constraint.kind === "symmetry"
      ? {
          primaryTarget: { ...constraint.primaryTarget },
          secondaryTarget: { ...constraint.secondaryTarget },
          symmetryLineEntityId: constraint.symmetryLineEntityId
        }
      : {})
  };
}

function pushSketchCreated(diff: MutableSemanticDiff, ref: CadSketchRef): void {
  ensureSketchDiff(diff).created.push(ref);
}

function pushSketchModified(
  diff: MutableSemanticDiff,
  ref: CadSketchRef
): void {
  ensureSketchDiff(diff).modified.push(ref);
}

function pushSketchDeleted(diff: MutableSemanticDiff, ref: CadSketchRef): void {
  ensureSketchDiff(diff).deleted.push(ref);
}

function pushSketchEntityCreated(
  diff: MutableSemanticDiff,
  ref: CadSketchEntityRef
): void {
  ensureSketchDiff(diff).entitiesCreated.push(ref);
}

function pushSketchEntityModified(
  diff: MutableSemanticDiff,
  ref: CadSketchEntityRef
): void {
  ensureSketchDiff(diff).entitiesModified.push(ref);
}

function pushSketchEntityDeleted(
  diff: MutableSemanticDiff,
  ref: CadSketchEntityRef
): void {
  ensureSketchDiff(diff).entitiesDeleted.push(ref);
}

function ensureSketchDiff(
  diff: MutableSemanticDiff
): MutableSketchSemanticDiff {
  diff.sketches ??= {
    created: [],
    modified: [],
    deleted: [],
    entitiesCreated: [],
    entitiesModified: [],
    entitiesDeleted: []
  };

  return diff.sketches;
}

function pushFeatureCreated(
  diff: MutableSemanticDiff,
  ref: CadFeatureRef
): void {
  ensureFeatureDiff(diff).created.push(ref);
}

function pushFeatureModified(
  diff: MutableSemanticDiff,
  ref: CadFeatureRef
): void {
  ensureFeatureDiff(diff).modified.push(ref);
}

function pushFeatureDeleted(
  diff: MutableSemanticDiff,
  ref: CadFeatureRef
): void {
  ensureFeatureDiff(diff).deleted.push(ref);
}

function pushBodyCreated(diff: MutableSemanticDiff, ref: CadBodyRef): void {
  ensureFeatureDiff(diff).bodiesCreated.push(ref);
}

function pushBodyModified(diff: MutableSemanticDiff, ref: CadBodyRef): void {
  ensureFeatureDiff(diff).bodiesModified.push(ref);
}

function pushBodyDeleted(diff: MutableSemanticDiff, ref: CadBodyRef): void {
  ensureFeatureDiff(diff).bodiesDeleted.push(ref);
}

function pushFeatureReferenceEffects(
  diff: MutableSemanticDiff,
  effects: readonly CadFeatureReferenceChangeSummary[]
): void {
  if (effects.length === 0) {
    return;
  }

  ensureFeatureDiff(diff).referenceEffects.push(...effects);
}

function pushFeatureLifecycleEffects(
  diff: MutableSemanticDiff,
  effects: readonly CadBodyLifecycleEffectSummary[]
): void {
  if (effects.length === 0) {
    return;
  }

  ensureFeatureDiff(diff).lifecycleEffects.push(...effects);
}

function ensureFeatureDiff(
  diff: MutableSemanticDiff
): MutableFeatureSemanticDiff {
  diff.features ??= {
    created: [],
    modified: [],
    deleted: [],
    bodiesCreated: [],
    bodiesModified: [],
    bodiesDeleted: [],
    referenceEffects: [],
    lifecycleEffects: []
  };

  return diff.features;
}

function pushNamedReferenceCreated(
  diff: MutableSemanticDiff,
  reference: NamedGeneratedReferenceSnapshot
): void {
  ensureReferenceDiff(diff).namedCreated.push(namedReferenceRef(reference));
}

function pushNamedReferenceRepaired(
  diff: MutableSemanticDiff,
  before: NamedGeneratedReferenceSnapshot,
  after: NamedGeneratedReferenceSnapshot
): void {
  ensureReferenceDiff(diff).namedRepaired.push({
    before: namedReferenceRef(before),
    after: namedReferenceRef(after)
  });
}

function pushNamedReferenceDeleted(
  diff: MutableSemanticDiff,
  reference: NamedGeneratedReferenceSnapshot
): void {
  ensureReferenceDiff(diff).namedDeleted.push(namedReferenceRef(reference));
}

function pushTopologyCheckpointCreated(
  diff: MutableSemanticDiff,
  checkpoint: CadTopologyCheckpointSourceRecord
): void {
  ensureReferenceDiff(diff).topologyCheckpointsCreated.push(
    topologyCheckpointRef(checkpoint)
  );
}

function pushTopologyAnchorCreated(
  diff: MutableSemanticDiff,
  anchor: CadTopologyAnchorSourceRecord
): void {
  ensureReferenceDiff(diff).topologyAnchorsCreated.push(
    topologyAnchorRef(anchor)
  );
}

function pushTopologyAnchorRepaired(
  diff: MutableSemanticDiff,
  repair: CadTopologyRepairSourceRecord,
  before: CadTopologyAnchorSourceRecord,
  after: CadTopologyAnchorSourceRecord
): void {
  ensureReferenceDiff(diff).topologyAnchorsRepaired.push({
    repairId: repair.repairId,
    before: topologyAnchorRef(before),
    after: topologyAnchorRef(after),
    confidence: repair.confidence
  });
}

function ensureReferenceDiff(
  diff: MutableSemanticDiff
): MutableReferenceSemanticDiff {
  diff.references ??= {
    namedCreated: [],
    namedRepaired: [],
    namedDeleted: [],
    topologyCheckpointsCreated: [],
    topologyAnchorsCreated: [],
    topologyAnchorsRepaired: []
  };

  return diff.references;
}

function ensureTopologyIdentitySource(
  state: MutableDocumentState
): CadTopologyIdentitySourceSnapshot {
  if (!state.topologyIdentity) {
    state.topologyIdentity = createEmptyTopologyIdentitySourceSnapshot();
  }

  return state.topologyIdentity;
}

function requireTopologyIdentitySource(
  state: MutableDocumentState,
  opIndex: number,
  anchorId: string
): CadTopologyIdentitySourceSnapshot {
  if (!state.topologyIdentity) {
    throwValidationError({
      code: "TOPOLOGY_ANCHOR_NOT_FOUND",
      message: `Topology anchor does not exist: ${anchorId}`,
      opIndex,
      topologyAnchorId: anchorId,
      path: operationPath(opIndex, "anchorId"),
      expected: "existing topology identity source block",
      received: anchorId
    });
  }

  return state.topologyIdentity;
}

function pushParameterCreated(
  diff: MutableSemanticDiff,
  ref: CadParameterRef
): void {
  ensureParameterDiff(diff).created.push(ref);
}

function pushParameterModified(
  diff: MutableSemanticDiff,
  ref: CadParameterRef
): void {
  ensureParameterDiff(diff).modified.push(ref);
}

function pushParameterDeleted(
  diff: MutableSemanticDiff,
  ref: CadParameterRef
): void {
  ensureParameterDiff(diff).deleted.push(ref);
}

function ensureParameterDiff(
  diff: MutableSemanticDiff
): MutableParameterSemanticDiff {
  diff.parameters ??= {
    created: [],
    modified: [],
    deleted: []
  };

  return diff.parameters;
}

function pushSketchDimensionCreated(
  diff: MutableSemanticDiff,
  ref: CadSketchDimensionRef
): void {
  ensureSketchDimensionDiff(diff).created.push(ref);
}

function pushSketchDimensionModified(
  diff: MutableSemanticDiff,
  ref: CadSketchDimensionRef
): void {
  ensureSketchDimensionDiff(diff).modified.push(ref);
}

function pushSketchDimensionDeleted(
  diff: MutableSemanticDiff,
  ref: CadSketchDimensionRef
): void {
  ensureSketchDimensionDiff(diff).deleted.push(ref);
}

function ensureSketchDimensionDiff(
  diff: MutableSemanticDiff
): MutableSketchDimensionSemanticDiff {
  diff.sketchDimensions ??= {
    created: [],
    modified: [],
    deleted: []
  };

  return diff.sketchDimensions;
}

function pushSketchConstraintCreated(
  diff: MutableSemanticDiff,
  ref: CadSketchConstraintRef
): void {
  ensureSketchConstraintDiff(diff).created.push(ref);
}

function pushSketchConstraintModified(
  diff: MutableSemanticDiff,
  ref: CadSketchConstraintRef
): void {
  ensureSketchConstraintDiff(diff).modified.push(ref);
}

function pushSketchConstraintDeleted(
  diff: MutableSemanticDiff,
  ref: CadSketchConstraintRef
): void {
  ensureSketchConstraintDiff(diff).deleted.push(ref);
}

function ensureSketchConstraintDiff(
  diff: MutableSemanticDiff
): MutableSketchConstraintSemanticDiff {
  diff.sketchConstraints ??= {
    created: [],
    modified: [],
    deleted: []
  };

  return diff.sketchConstraints;
}

function getUnitConversionScaleFactor(
  from: DocumentUnits,
  to: DocumentUnits
): number {
  return cleanMeasurementNumber(
    getMillimetersPerUnit(from) / getMillimetersPerUnit(to)
  );
}

function getMillimetersPerUnit(units: DocumentUnits): number {
  switch (units) {
    case "mm":
      return 1;
    case "cm":
      return 10;
    case "m":
      return 1000;
    case "in":
      return 25.4;
  }
}

function scaleDocumentLengthValues(
  state: MutableDocumentState,
  scaleFactor: number,
  diff: MutableSemanticDiff
): void {
  for (const object of state.objects.values()) {
    const scaled = scaleSceneObjectLengthValues(object, scaleFactor);
    state.objects.set(object.id, scaled);
    diff.modified.push(objectRef(scaled));
  }

  for (const sketch of state.sketches.values()) {
    const scaled = scaleSketchLengthValues(sketch, scaleFactor);
    state.sketches.set(sketch.id, scaled);
    pushSketchModified(diff, sketchRef(scaled));

    for (const entity of scaled.entities.values()) {
      pushSketchEntityModified(diff, sketchEntityRef(scaled.id, entity));
    }
  }

  for (const parameter of state.parameters.values()) {
    const scaled: CadParameter = {
      ...parameter,
      value: scaleLength(parameter.value, scaleFactor)
    };
    state.parameters.set(parameter.id, scaled);
    pushParameterModified(diff, parameterRef(scaled));
  }

  for (const dimension of state.sketchDimensions.values()) {
    if (dimension.valueSource.type !== "literal") {
      continue;
    }

    const scaled: SketchDimension = {
      ...dimension,
      valueSource: {
        type: "literal",
        value: scaleLength(dimension.valueSource.value, scaleFactor)
      }
    };
    state.sketchDimensions.set(dimension.id, scaled);
    pushSketchDimensionModified(diff, sketchDimensionRef(scaled));
  }

  for (const feature of state.features.values()) {
    if (feature.kind === "extrude") {
      const scaled: ExtrudeFeature = {
        ...feature,
        depth: scaleLength(feature.depth, scaleFactor)
      };
      state.features.set(feature.id, scaled);
      pushFeatureModified(diff, featureRef(scaled));
      pushBodyModified(diff, bodyRef(scaled));
    }

    if (feature.kind === "hole" && feature.depth !== undefined) {
      const scaled: HoleFeature = {
        ...feature,
        depth: scaleLength(feature.depth, scaleFactor)
      };
      state.features.set(feature.id, scaled);
      pushFeatureModified(diff, featureRef(scaled));
      pushBodyModified(diff, bodyRef(scaled));
    }
  }
}

function scaleSceneObjectLengthValues(
  object: SceneObject,
  scaleFactor: number
): SceneObject {
  const transform = scaleTransformTranslation(object.transform, scaleFactor);

  if (object.kind === "box") {
    return {
      ...object,
      dimensions: {
        width: scaleLength(object.dimensions.width, scaleFactor),
        height: scaleLength(object.dimensions.height, scaleFactor),
        depth: scaleLength(object.dimensions.depth, scaleFactor)
      },
      transform
    };
  }

  if (object.kind === "cylinder" || object.kind === "cone") {
    return {
      ...object,
      dimensions: {
        radius: scaleLength(object.dimensions.radius, scaleFactor),
        height: scaleLength(object.dimensions.height, scaleFactor)
      },
      transform
    };
  }

  if (object.kind === "sphere") {
    return {
      ...object,
      dimensions: {
        radius: scaleLength(object.dimensions.radius, scaleFactor)
      },
      transform
    };
  }

  return {
    ...object,
    dimensions: {
      majorRadius: scaleLength(object.dimensions.majorRadius, scaleFactor),
      minorRadius: scaleLength(object.dimensions.minorRadius, scaleFactor)
    },
    transform
  };
}

function scaleTransformTranslation(
  transform: Transform,
  scaleFactor: number
): Transform {
  return {
    ...transform,
    translation: scaleVec3(transform.translation, scaleFactor)
  };
}

function scaleVec3(vector: Vec3, scaleFactor: number): Vec3 {
  return [
    scaleLength(vector[0], scaleFactor),
    scaleLength(vector[1], scaleFactor),
    scaleLength(vector[2], scaleFactor)
  ];
}

function scaleSketchLengthValues(sketch: Sketch, scaleFactor: number): Sketch {
  return {
    ...sketch,
    entities: new Map(
      [...sketch.entities.entries()].map(([id, entity]) => [
        id,
        scaleSketchEntityLengthValues(entity, scaleFactor)
      ])
    )
  };
}

function scaleSketchEntityLengthValues(
  entity: SketchEntity,
  scaleFactor: number
): SketchEntity {
  switch (entity.kind) {
    case "point":
      return {
        ...entity,
        point: scaleVec2(entity.point, scaleFactor)
      };
    case "line":
      return {
        ...entity,
        start: scaleVec2(entity.start, scaleFactor),
        end: scaleVec2(entity.end, scaleFactor)
      };
    case "rectangle":
      return {
        ...entity,
        center: scaleVec2(entity.center, scaleFactor),
        width: scaleLength(entity.width, scaleFactor),
        height: scaleLength(entity.height, scaleFactor)
      };
    case "circle":
      return {
        ...entity,
        center: scaleVec2(entity.center, scaleFactor),
        radius: scaleLength(entity.radius, scaleFactor)
      };
  }
}

function scaleVec2(vector: Vec2, scaleFactor: number): Vec2 {
  return [
    scaleLength(vector[0], scaleFactor),
    scaleLength(vector[1], scaleFactor)
  ];
}

function scaleLength(value: number, scaleFactor: number): number {
  return cleanMeasurementNumber(value * scaleFactor);
}

function cloneDocument(document: CadDocument): CadDocument {
  return createCadDocumentFromSnapshot(createCadDocumentSnapshot(document));
}

export function createCadDocumentSnapshot(
  document: CadDocument,
  nextObjectNumber = inferNextObjectNumber(document),
  nextSketchNumber = inferNextSketchNumber(document),
  nextSketchEntityNumber = inferNextSketchEntityNumber(document),
  nextParameterNumber = inferNextParameterNumber(document),
  nextSketchDimensionNumber = inferNextSketchDimensionNumber(document),
  nextSketchConstraintNumber = inferNextSketchConstraintNumber(document),
  nextFeatureNumber = inferNextFeatureNumber(document),
  nextBodyNumber = inferNextBodyNumber(document)
): CadDocumentSnapshot {
  return {
    units: document.units,
    objects: [...document.objects.values()].map(createCadObjectSnapshot),
    sketches: [...document.sketches.values()].map(createSketchSnapshot),
    parameters: [...document.parameters.values()].map(cloneParameterSnapshot),
    sketchDimensions: [...document.sketchDimensions.values()].map(
      cloneSketchDimensionSnapshot
    ),
    sketchConstraints: [...document.sketchConstraints.values()].map(
      cloneSketchConstraintSnapshot
    ),
    features: [...document.features.values()].map(createFeatureSnapshot),
    namedReferences: [...document.namedReferences.values()].map(
      cloneNamedReferenceSnapshot
    ),
    ...(document.topologyIdentity
      ? {
          topologyIdentity: cloneTopologyIdentitySourceSnapshot(
            document.topologyIdentity
          )
        }
      : {}),
    nextObjectNumber,
    nextSketchNumber,
    nextSketchEntityNumber,
    nextParameterNumber,
    nextSketchDimensionNumber,
    nextSketchConstraintNumber,
    nextFeatureNumber,
    nextBodyNumber
  };
}

export function createCadDocumentFromSnapshot(
  snapshot: CadDocumentSnapshot
): CadDocument {
  return createCadDocument(
    snapshot.objects.map(
      (object) => [object.id, createCadObjectSnapshot(object)] as const
    ),
    snapshot.units,
    snapshot.sketches.map(
      (sketch) => [sketch.id, createSketchFromSnapshot(sketch)] as const
    ),
    snapshot.parameters.map(
      (parameter) => [parameter.id, cloneParameterSnapshot(parameter)] as const
    ),
    snapshot.sketchDimensions.map(
      (dimension) =>
        [dimension.id, cloneSketchDimensionSnapshot(dimension)] as const
    ),
    snapshot.sketchConstraints.map(
      (constraint) =>
        [constraint.id, cloneSketchConstraintSnapshot(constraint)] as const
    ),
    snapshot.features.map(
      (feature) => [feature.id, createFeatureFromSnapshot(feature)] as const
    ),
    snapshot.namedReferences.map(
      (reference) =>
        [reference.name, cloneNamedReferenceSnapshot(reference)] as const
    ),
    snapshot.topologyIdentity
      ? cloneTopologyIdentitySourceSnapshot(snapshot.topologyIdentity)
      : undefined
  );
}

function cloneTopologyIdentitySourceSnapshot(
  snapshot: CadTopologyIdentitySourceSnapshot
): CadTopologyIdentitySourceSnapshot {
  return JSON.parse(
    JSON.stringify(snapshot)
  ) as CadTopologyIdentitySourceSnapshot;
}

function createCadObjectSnapshot(object: SceneObject): CadObjectSnapshot {
  switch (object.kind) {
    case "box":
      return {
        id: object.id,
        kind: object.kind,
        name: object.name,
        dimensions: { ...object.dimensions },
        transform: cloneTransform(object.transform)
      };
    case "cylinder":
      return {
        id: object.id,
        kind: object.kind,
        name: object.name,
        dimensions: { ...object.dimensions },
        transform: cloneTransform(object.transform)
      };
    case "sphere":
      return {
        id: object.id,
        kind: object.kind,
        name: object.name,
        dimensions: { ...object.dimensions },
        transform: cloneTransform(object.transform)
      };
    case "cone":
      return {
        id: object.id,
        kind: object.kind,
        name: object.name,
        dimensions: { ...object.dimensions },
        transform: cloneTransform(object.transform)
      };
    case "torus":
      return {
        id: object.id,
        kind: object.kind,
        name: object.name,
        dimensions: { ...object.dimensions },
        transform: cloneTransform(object.transform)
      };
  }
}

function createSketchSnapshot(sketch: Sketch): SketchSnapshot {
  return {
    id: sketch.id,
    name: sketch.name,
    plane: sketch.plane,
    attachment: sketch.attachment
      ? cloneSketchAttachment(sketch.attachment)
      : undefined,
    entities: [...sketch.entities.values()].map(cloneSketchEntity)
  };
}

function createSketchFromSnapshot(snapshot: SketchSnapshot): Sketch {
  return {
    id: snapshot.id,
    name: snapshot.name,
    plane: snapshot.plane,
    attachment: snapshot.attachment
      ? cloneSketchAttachment(snapshot.attachment)
      : undefined,
    entities: new Map(
      snapshot.entities.map((entity) => [entity.id, cloneSketchEntity(entity)])
    )
  };
}

function cloneParameterSnapshot(parameter: CadParameterSnapshot): CadParameter {
  return {
    id: parameter.id,
    name: parameter.name,
    value: parameter.value,
    ...(parameter.description !== undefined
      ? { description: parameter.description }
      : {})
  };
}

function cloneSketchDimensionSnapshot(
  dimension: SketchDimensionSnapshot
): SketchDimension {
  return {
    id: dimension.id,
    name: dimension.name,
    sketchId: dimension.sketchId,
    entityId: dimension.entityId,
    target: { ...dimension.target },
    valueSource: cloneSketchDimensionValueSource(dimension.valueSource)
  };
}

function cloneSketchConstraintSnapshot(
  constraint: SketchConstraintSnapshot
): SketchConstraint {
  if (constraint.kind === "fixed") {
    return {
      id: constraint.id,
      name: constraint.name,
      sketchId: constraint.sketchId,
      entityId: constraint.entityId,
      kind: "fixed",
      target: { ...constraint.target },
      coordinate: [constraint.coordinate[0], constraint.coordinate[1]]
    };
  }

  if (constraint.kind === "coincident") {
    return {
      id: constraint.id,
      name: constraint.name,
      sketchId: constraint.sketchId,
      entityId: constraint.entityId,
      kind: "coincident",
      primaryTarget: { ...constraint.primaryTarget },
      secondaryTarget: { ...constraint.secondaryTarget }
    };
  }

  if (constraint.kind === "midpoint") {
    return {
      id: constraint.id,
      name: constraint.name,
      sketchId: constraint.sketchId,
      entityId: constraint.entityId,
      kind: "midpoint",
      lineEntityId: constraint.lineEntityId,
      target: { ...constraint.target }
    };
  }

  if (isLinePairSketchConstraint(constraint)) {
    return {
      id: constraint.id,
      name: constraint.name,
      sketchId: constraint.sketchId,
      entityId: constraint.entityId,
      kind: constraint.kind,
      primaryLineEntityId: constraint.primaryLineEntityId,
      secondaryLineEntityId: constraint.secondaryLineEntityId
    };
  }

  if (constraint.kind === "tangent") {
    return {
      id: constraint.id,
      name: constraint.name,
      sketchId: constraint.sketchId,
      entityId: constraint.entityId,
      kind: "tangent",
      primaryTarget: { ...constraint.primaryTarget },
      secondaryTarget: { ...constraint.secondaryTarget }
    };
  }

  if (constraint.kind === "concentric") {
    return {
      id: constraint.id,
      name: constraint.name,
      sketchId: constraint.sketchId,
      entityId: constraint.entityId,
      kind: "concentric",
      primaryCircleEntityId: constraint.primaryCircleEntityId,
      secondaryCircleEntityId: constraint.secondaryCircleEntityId
    };
  }

  if (constraint.kind === "equalLength") {
    return {
      id: constraint.id,
      name: constraint.name,
      sketchId: constraint.sketchId,
      entityId: constraint.entityId,
      kind: "equalLength",
      primaryLineEntityId: constraint.primaryLineEntityId,
      secondaryLineEntityId: constraint.secondaryLineEntityId
    };
  }

  if (constraint.kind === "equalRadius") {
    return {
      id: constraint.id,
      name: constraint.name,
      sketchId: constraint.sketchId,
      entityId: constraint.entityId,
      kind: "equalRadius",
      primaryCircleEntityId: constraint.primaryCircleEntityId,
      secondaryCircleEntityId: constraint.secondaryCircleEntityId
    };
  }

  if (constraint.kind === "angle") {
    return {
      id: constraint.id,
      name: constraint.name,
      sketchId: constraint.sketchId,
      entityId: constraint.entityId,
      kind: "angle",
      primaryLineEntityId: constraint.primaryLineEntityId,
      secondaryLineEntityId: constraint.secondaryLineEntityId,
      angleDegrees: constraint.angleDegrees
    };
  }

  if (constraint.kind === "symmetry") {
    return {
      id: constraint.id,
      name: constraint.name,
      sketchId: constraint.sketchId,
      entityId: constraint.entityId,
      kind: "symmetry",
      primaryTarget: { ...constraint.primaryTarget },
      secondaryTarget: { ...constraint.secondaryTarget },
      symmetryLineEntityId: constraint.symmetryLineEntityId
    };
  }

  return {
    id: constraint.id,
    name: constraint.name,
    sketchId: constraint.sketchId,
    entityId: constraint.entityId,
    kind: constraint.kind
  };
}

function cloneSketchDimensionValueSource(
  valueSource: SketchDimensionValueSource
): SketchDimensionValueSource {
  return valueSource.type === "literal"
    ? { type: "literal", value: valueSource.value }
    : { type: "parameter", parameterId: valueSource.parameterId };
}

function cloneSketchAttachment(
  attachment: SketchAttachmentSnapshot
): SketchAttachmentSnapshot {
  return {
    ...attachment
  };
}

function createFeatureSnapshot(feature: Feature): FeatureSnapshot {
  if (feature.kind === "chamfer") {
    return {
      id: feature.id,
      kind: "chamfer",
      name: feature.name,
      targetBodyId: feature.targetBodyId,
      ...(feature.edgeStableId ? { edgeStableId: feature.edgeStableId } : {}),
      ...(feature.namedReference
        ? { namedReference: feature.namedReference }
        : {}),
      ...(feature.topologyAnchorId
        ? { topologyAnchorId: feature.topologyAnchorId }
        : {}),
      distance: feature.distance,
      bodyId: feature.bodyId
    };
  }

  if (feature.kind === "fillet") {
    return {
      id: feature.id,
      kind: "fillet",
      name: feature.name,
      targetBodyId: feature.targetBodyId,
      ...(feature.edgeStableId ? { edgeStableId: feature.edgeStableId } : {}),
      ...(feature.namedReference
        ? { namedReference: feature.namedReference }
        : {}),
      ...(feature.topologyAnchorId
        ? { topologyAnchorId: feature.topologyAnchorId }
        : {}),
      radius: feature.radius,
      bodyId: feature.bodyId
    };
  }

  if (feature.kind === "hole") {
    return {
      id: feature.id,
      kind: "hole",
      name: feature.name,
      targetBodyId: feature.targetBodyId,
      ...(feature.targetTopologyAnchorId
        ? { targetTopologyAnchorId: feature.targetTopologyAnchorId }
        : {}),
      sketchId: feature.sketchId,
      circleEntityId: feature.circleEntityId,
      depthMode: feature.depthMode,
      ...(feature.depth !== undefined ? { depth: feature.depth } : {}),
      direction: feature.direction,
      bodyId: feature.bodyId
    };
  }

  if (feature.kind === "revolve") {
    return {
      id: feature.id,
      kind: "revolve",
      name: feature.name,
      sketchId: feature.sketchId,
      entityId: feature.entityId,
      profileKind: feature.profileKind,
      axis: feature.axis,
      angleDegrees: feature.angleDegrees,
      operationMode: feature.operationMode,
      ...(feature.targetBodyId ? { targetBodyId: feature.targetBodyId } : {}),
      bodyId: feature.bodyId
    };
  }

  return {
    id: feature.id,
    kind: "extrude",
    name: feature.name,
    sketchId: feature.sketchId,
    entityId: feature.entityId,
    profileKind: feature.profileKind,
    depth: feature.depth,
    side: feature.side,
    operationMode: feature.operationMode,
    ...(feature.targetBodyId ? { targetBodyId: feature.targetBodyId } : {}),
    ...(feature.targetTopologyAnchorId
      ? { targetTopologyAnchorId: feature.targetTopologyAnchorId }
      : {}),
    bodyId: feature.bodyId
  };
}

function createFeatureFromSnapshot(snapshot: FeatureSnapshot): Feature {
  if (snapshot.kind === "chamfer") {
    return {
      id: snapshot.id,
      kind: "chamfer",
      name: snapshot.name,
      targetBodyId: snapshot.targetBodyId,
      edgeStableId: snapshot.edgeStableId,
      namedReference: snapshot.namedReference,
      topologyAnchorId: snapshot.topologyAnchorId,
      distance: snapshot.distance,
      bodyId: snapshot.bodyId
    };
  }

  if (snapshot.kind === "fillet") {
    return {
      id: snapshot.id,
      kind: "fillet",
      name: snapshot.name,
      targetBodyId: snapshot.targetBodyId,
      edgeStableId: snapshot.edgeStableId,
      namedReference: snapshot.namedReference,
      topologyAnchorId: snapshot.topologyAnchorId,
      radius: snapshot.radius,
      bodyId: snapshot.bodyId
    };
  }

  if (snapshot.kind === "hole") {
    return {
      id: snapshot.id,
      kind: "hole",
      name: snapshot.name,
      targetBodyId: snapshot.targetBodyId,
      targetTopologyAnchorId: snapshot.targetTopologyAnchorId,
      sketchId: snapshot.sketchId,
      circleEntityId: snapshot.circleEntityId,
      depthMode: snapshot.depthMode,
      depth: snapshot.depth,
      direction: snapshot.direction ?? "positive",
      bodyId: snapshot.bodyId
    };
  }

  if (snapshot.kind === "revolve") {
    return {
      id: snapshot.id,
      kind: "revolve",
      name: snapshot.name,
      sketchId: snapshot.sketchId,
      entityId: snapshot.entityId,
      profileKind: snapshot.profileKind,
      axis: snapshot.axis,
      angleDegrees: snapshot.angleDegrees,
      operationMode: snapshot.operationMode ?? "newBody",
      targetBodyId: snapshot.targetBodyId,
      bodyId: snapshot.bodyId
    };
  }

  return {
    id: snapshot.id,
    kind: "extrude",
    name: snapshot.name,
    sketchId: snapshot.sketchId,
    entityId: snapshot.entityId,
    profileKind: snapshot.profileKind,
    depth: snapshot.depth,
    side: snapshot.side ?? "positive",
    operationMode: snapshot.operationMode ?? "newBody",
    targetBodyId: snapshot.targetBodyId,
    targetTopologyAnchorId: snapshot.targetTopologyAnchorId,
    bodyId: snapshot.bodyId
  };
}

function cloneNamedReferenceSnapshot(
  reference: NamedGeneratedReferenceSnapshot
): NamedGeneratedReferenceSnapshot {
  return {
    name: reference.name,
    bodyId: reference.bodyId,
    stableId: reference.stableId,
    kind: reference.kind,
    ...(reference.topologyAnchorId
      ? { topologyAnchorId: reference.topologyAnchorId }
      : {})
  };
}

function cloneSketchEntity(entity: SketchEntitySnapshot): SketchEntity {
  switch (entity.kind) {
    case "point":
      return {
        id: entity.id,
        kind: entity.kind,
        point: [...entity.point]
      };
    case "line":
      return {
        id: entity.id,
        kind: entity.kind,
        start: [...entity.start],
        end: [...entity.end]
      };
    case "rectangle":
      return {
        id: entity.id,
        kind: entity.kind,
        center: [...entity.center],
        width: entity.width,
        height: entity.height
      };
    case "circle":
      return {
        id: entity.id,
        kind: entity.kind,
        center: [...entity.center],
        radius: entity.radius
      };
  }
}

interface CadProjectStructureSnapshot {
  readonly parts: readonly CadPartSnapshot[];
  readonly features: readonly CadFeatureSummary[];
  readonly bodies: readonly CadBodySnapshot[];
  readonly objectSources: readonly CadObjectModelSource[];
}

const SUMMARY_REFERENCE_OPERATIONS = [
  "reference.nameGenerated",
  "feature.extrudeCutTarget",
  "feature.extrudeAddTarget",
  "feature.attachSketchPlane",
  "feature.chamfer",
  "feature.fillet",
  "feature.measureReference",
  "feature.selectReference"
] satisfies readonly CadSelectionReferenceOperation[];

const SUMMARY_REFERENCE_STATUSES = [
  "resolved",
  "missing",
  "stale",
  "unsupported",
  "ambiguous",
  "consumed",
  "non-commandable"
] satisfies readonly CadSelectionReferenceStatus[];

const SUMMARY_REFERENCE_KINDS = [
  "body",
  "face",
  "edge",
  "vertex",
  "axis"
] satisfies readonly CadGeneratedEntityKind[];

function createProjectSummary(
  document: CadDocument,
  transactions: readonly Transaction[],
  cadOpsVersion: ProjectSummaryQueryResponse["cadOpsVersion"]
): ProjectSummaryQueryResponse {
  const objects = [...document.objects.values()].map(createCadObjectSnapshot);
  const structure = createProjectStructure(document, transactions);
  const bodyExists = (bodyId: BodyId) =>
    structure.bodies.some((body) => body.id === bodyId);
  const health = createProjectHealth({
    document,
    cadOpsVersion,
    ownerPartId: DEFAULT_PART_ID,
    units: document.units,
    derivedExactMetadata: [],
    bodyExists
  });
  const exportReadiness = createProjectExportReadiness({
    document,
    cadOpsVersion,
    bodies: structure.bodies
  });
  const structureSummary: ProjectSummaryQueryResponse["structure"] = {
    partCount: structure.parts.length,
    sketchCount: document.sketches.size,
    sketchEntityCount: [...document.sketches.values()].reduce(
      (count, sketch) => count + sketch.entities.size,
      0
    ),
    featureCount: structure.features.length,
    bodyCount: structure.bodies.length,
    activeBodyCount: structure.bodies.filter(
      (body) => !body.consumedByFeatureId
    ).length,
    consumedBodyCount: structure.bodies.filter(
      (body) => body.consumedByFeatureId
    ).length,
    primitiveCompatibilityBodyCount: structure.bodies.filter(
      (body) => body.source.type === "primitiveFeature"
    ).length,
    authoredBodyFeatureCount: document.features.size
  };
  const referenceSummary = createProjectSummaryReferenceSummary(
    document,
    structure,
    transactions
  );
  const exportSummary: ProjectSummaryQueryResponse["exportReadiness"] = {
    status: exportReadiness.status,
    canExportFiles: exportReadiness.canExportFiles,
    sourceBoundaryNote: exportReadiness.sourceBoundaryNote,
    derivedBoundaryNote: exportReadiness.derivedBoundaryNote,
    formatCount: exportReadiness.formatCount,
    formats: exportReadiness.formats.map((format) => ({
      format: format.format,
      status: format.status,
      available: format.available,
      candidateBodyCount: format.candidateBodyCount,
      sourceSupportedBodyCount: format.sourceSupportedBodyCount,
      deferredBodyCount: format.deferredBodyCount,
      unavailableBodyCount: format.unavailableBodyCount
    })),
    bodyCount: exportReadiness.bodyCount,
    sourceSupportedBodyCount: exportReadiness.sourceSupportedBodyCount,
    deferredBodyCount: exportReadiness.deferredBodyCount,
    unavailableBodyCount: exportReadiness.unavailableBodyCount,
    diagnosticCount: exportReadiness.diagnosticCount
  };

  return {
    ok: true,
    query: "project.summary",
    cadOpsVersion,
    units: document.units,
    objectCount: objects.length,
    objects,
    structure: structureSummary,
    health: {
      status: health.status,
      issueCount: health.issueCount
    },
    references: referenceSummary,
    exportReadiness: exportSummary,
    workflowHints: createProjectSummaryWorkflowHints(
      structureSummary,
      { status: health.status, issueCount: health.issueCount },
      referenceSummary,
      exportSummary
    )
  };
}

function createProjectSummaryReferenceSummary(
  document: CadDocument,
  structure: CadProjectStructureSnapshot,
  transactions: readonly Transaction[]
): ProjectSummaryQueryResponse["references"] {
  const namedReferenceStatusCounts = {
    resolved: 0,
    stale: 0
  };
  const semanticBodySelectionStatusCounts = createZeroReferenceStatusCounts();
  const referenceKindCounts = createZeroReferenceKindCounts();
  const operationCounts = createZeroReferenceOperationCounts();
  let generatedReferenceBodyCount = 0;
  let generatedReferenceCount = 0;
  let commandableReferenceCount = 0;

  for (const reference of document.namedReferences.values()) {
    const entry = createNamedReferenceEntry(document, reference, transactions);
    namedReferenceStatusCounts[entry.status] += 1;
  }

  for (const body of structure.bodies) {
    const bodySelection = createSelectionReferenceCandidates(
      document,
      structure,
      transactions,
      { type: "body", bodyId: body.id },
      undefined
    );
    semanticBodySelectionStatusCounts[bodySelection.status] += 1;

    if (body.consumedByFeatureId) {
      continue;
    }

    const references = createBodyGeneratedReferences(
      document,
      body.id,
      body.partId
    );

    if (!references) {
      continue;
    }

    generatedReferenceBodyCount += 1;

    for (const reference of listGeneratedReferences(references)) {
      const operations = createGeneratedReferenceCommandOperations(reference);

      generatedReferenceCount += 1;
      referenceKindCounts[reference.kind] += 1;

      for (const operation of operations) {
        operationCounts[operation] += 1;
      }

      if (operations.length > 0) {
        commandableReferenceCount += 1;
      }
    }
  }

  return {
    namedReferenceCount: document.namedReferences.size,
    namedReferenceStatusCounts,
    semanticBodySelectionCount: structure.bodies.length,
    semanticBodySelectionStatusCounts,
    generatedReferenceBodyCount,
    generatedReferenceCount,
    commandableReferenceCount,
    referenceKindCounts,
    operationCounts
  };
}

function listGeneratedReferences(
  references: ReturnType<typeof createBodyGeneratedReferences>
): readonly CadGeneratedReference[] {
  if (!references) {
    return [];
  }

  return [
    references.body,
    ...references.faces,
    ...references.edges,
    ...references.vertices,
    ...references.axes
  ];
}

function createGeneratedReferenceCommandOperations(
  reference: CadGeneratedReference
): readonly CadSelectionReferenceOperation[] {
  return reference.eligibleOperations.includes("feature.selectReference")
    ? ["reference.nameGenerated", ...reference.eligibleOperations]
    : [...reference.eligibleOperations];
}

function createZeroReferenceKindCounts(): Record<
  CadGeneratedEntityKind,
  number
> {
  return Object.fromEntries(
    SUMMARY_REFERENCE_KINDS.map((kind) => [kind, 0])
  ) as Record<CadGeneratedEntityKind, number>;
}

function createZeroReferenceOperationCounts(): Record<
  CadSelectionReferenceOperation,
  number
> {
  return Object.fromEntries(
    SUMMARY_REFERENCE_OPERATIONS.map((operation) => [operation, 0])
  ) as Record<CadSelectionReferenceOperation, number>;
}

function createZeroReferenceStatusCounts(): Record<
  CadSelectionReferenceStatus,
  number
> {
  return Object.fromEntries(
    SUMMARY_REFERENCE_STATUSES.map((status) => [status, 0])
  ) as Record<CadSelectionReferenceStatus, number>;
}

function createProjectSummaryWorkflowHints(
  structure: ProjectSummaryQueryResponse["structure"],
  health: ProjectSummaryQueryResponse["health"],
  references: ProjectSummaryQueryResponse["references"],
  exportReadiness: ProjectSummaryQueryResponse["exportReadiness"]
): ProjectSummaryQueryResponse["workflowHints"] {
  const hints: ProjectSummaryQueryResponse["workflowHints"][number][] = [];

  if (structure.bodyCount === 0) {
    hints.push({
      code: "PROJECT_EMPTY",
      level: "blocker",
      message:
        "Create an authored body before checking semantic references or file export readiness."
    });
  }

  if (health.issueCount > 0) {
    hints.push({
      code: "PROJECT_HEALTH_ISSUES",
      level: "warning",
      message: `Project health is ${health.status} with ${health.issueCount} issue(s) to review.`
    });
  }

  if (
    structure.bodyCount > 0 &&
    structure.authoredBodyFeatureCount === 0 &&
    structure.primitiveCompatibilityBodyCount > 0
  ) {
    hints.push({
      code: "NO_AUTHORED_BODY_FEATURES",
      level: "warning",
      message:
        "Primitive compatibility bodies are present; authored sketch feature bodies are needed for V7 references and CAD export readiness."
    });
  }

  if (structure.bodyCount > 0 && references.commandableReferenceCount === 0) {
    hints.push({
      code: "NO_COMMANDABLE_REFERENCES",
      level: "warning",
      message:
        "No active source body exposes command-ready semantic references yet."
    });
  }

  if (exportReadiness.canExportFiles) {
    hints.push({
      code: "EXPORT_READY",
      level: "info",
      message:
        "At least one file export path is available for the current source model."
    });
  } else if (exportReadiness.status === "deferred") {
    hints.push({
      code: "EXPORT_DEFERRED",
      level: "warning",
      message:
        "Source bodies are present, but file writers are still deferred by the shared export-readiness contract."
    });
  } else if (exportReadiness.status === "unavailable") {
    hints.push({
      code: "EXPORT_UNAVAILABLE",
      level: "warning",
      message:
        "File export is unavailable for the current source model; review authored body support and export diagnostics."
    });
  }

  return hints;
}

function createProjectStructure(
  document: CadDocument,
  transactions: readonly Transaction[]
): CadProjectStructureSnapshot {
  const sourceByObjectId = createPrimitiveFeatureSourceMap(transactions);
  const objects = [...document.objects.values()];
  const sketches = [...document.sketches.values()];
  const primitiveFeatures = objects.map((object) =>
    createPrimitiveFeatureSummary(
      object,
      sourceByObjectId.get(object.id) ?? {
        type: "sceneObject"
      }
    )
  );
  const authoredFeatures = [...document.features.values()].map(
    createFeatureSummary
  );
  const consumedBodyIds = createConsumedBodyMap(document.features);
  const features: readonly CadFeatureSummary[] = [
    ...primitiveFeatures,
    ...authoredFeatures
  ];
  const bodies = [
    ...objects.map(createPrimitiveBodySnapshot),
    ...[...document.features.values()].map((feature) =>
      createFeatureBodySnapshot(feature, consumedBodyIds.get(feature.bodyId))
    )
  ];
  const objectSources = objects.map(createObjectModelSource);
  const part: CadPartSnapshot = {
    id: DEFAULT_PART_ID,
    kind: "part",
    name: DEFAULT_PART_NAME,
    source: {
      type: "defaultScenePart"
    },
    objectIds: objects.map((object) => object.id),
    featureIds: features.map((feature) => feature.id),
    bodyIds: bodies.map((body) => body.id),
    sketchIds: sketches.map((sketch) => sketch.id)
  };

  return {
    parts: [part],
    features,
    bodies,
    objectSources
  };
}

function createCurrentLifecycleEffects(
  transactions: readonly Transaction[]
): readonly CadBodyLifecycleEffectSummary[] {
  const currentByBodyId = new Map<BodyId, CadBodyLifecycleEffectSummary>();

  for (const transaction of sortTransactions(transactions)) {
    for (const effect of transaction.diff.features?.lifecycleEffects ?? []) {
      currentByBodyId.set(effect.bodyId, effect);
    }
  }

  return [...currentByBodyId.values()];
}

function createPrimitiveFeatureSummary(
  object: SceneObject,
  source: CadPrimitiveFeatureSource
): CadPrimitiveFeatureSummary {
  return {
    id: createPrimitiveFeatureId(object.id),
    kind: "primitive",
    partId: DEFAULT_PART_ID,
    primitive: object.kind,
    objectId: object.id,
    bodyId: createPrimitiveBodyId(object.id),
    name: object.name,
    dimensions: { ...object.dimensions },
    transform: cloneTransform(object.transform),
    source
  };
}

function createPrimitiveFeatureId(objectId: ObjectId): string {
  return `feature:${objectId}`;
}

function createPrimitiveBodyId(objectId: ObjectId): BodyId {
  return `body:${objectId}`;
}

function createPrimitiveBodySnapshot(object: SceneObject): CadBodySnapshot {
  const featureId = createPrimitiveFeatureId(object.id);

  return {
    id: createPrimitiveBodyId(object.id),
    kind: "solid",
    partId: DEFAULT_PART_ID,
    featureId,
    objectId: object.id,
    primitive: object.kind,
    name: object.name,
    source: {
      type: "primitiveFeature",
      featureId,
      objectId: object.id
    }
  };
}

function createFeatureSummary(feature: Feature): CadFeatureSummary {
  if (feature.kind === "chamfer") {
    return {
      id: feature.id,
      kind: "chamfer",
      partId: DEFAULT_PART_ID,
      bodyId: feature.bodyId,
      targetBodyId: feature.targetBodyId,
      ...(feature.edgeStableId ? { edgeStableId: feature.edgeStableId } : {}),
      ...(feature.namedReference
        ? { namedReference: feature.namedReference }
        : {}),
      ...(feature.topologyAnchorId
        ? { topologyAnchorId: feature.topologyAnchorId }
        : {}),
      distance: feature.distance,
      name: feature.name,
      source: {
        type: "generatedEdgeChamfer",
        targetBodyId: feature.targetBodyId,
        ...(feature.edgeStableId ? { edgeStableId: feature.edgeStableId } : {}),
        ...(feature.namedReference
          ? { namedReference: feature.namedReference }
          : {}),
        ...(feature.topologyAnchorId
          ? { topologyAnchorId: feature.topologyAnchorId }
          : {})
      }
    };
  }

  if (feature.kind === "fillet") {
    return {
      id: feature.id,
      kind: "fillet",
      partId: DEFAULT_PART_ID,
      bodyId: feature.bodyId,
      targetBodyId: feature.targetBodyId,
      ...(feature.edgeStableId ? { edgeStableId: feature.edgeStableId } : {}),
      ...(feature.namedReference
        ? { namedReference: feature.namedReference }
        : {}),
      ...(feature.topologyAnchorId
        ? { topologyAnchorId: feature.topologyAnchorId }
        : {}),
      radius: feature.radius,
      name: feature.name,
      source: {
        type: "generatedEdgeFillet",
        targetBodyId: feature.targetBodyId,
        ...(feature.edgeStableId ? { edgeStableId: feature.edgeStableId } : {}),
        ...(feature.namedReference
          ? { namedReference: feature.namedReference }
          : {}),
        ...(feature.topologyAnchorId
          ? { topologyAnchorId: feature.topologyAnchorId }
          : {})
      }
    };
  }

  if (feature.kind === "hole") {
    return {
      id: feature.id,
      kind: "hole",
      partId: DEFAULT_PART_ID,
      bodyId: feature.bodyId,
      targetBodyId: feature.targetBodyId,
      ...(feature.targetTopologyAnchorId
        ? { targetTopologyAnchorId: feature.targetTopologyAnchorId }
        : {}),
      name: feature.name,
      sketchId: feature.sketchId,
      circleEntityId: feature.circleEntityId,
      depthMode: feature.depthMode,
      ...(feature.depth !== undefined ? { depth: feature.depth } : {}),
      direction: feature.direction,
      source: {
        type: "sketchCircleHole",
        sketchId: feature.sketchId,
        circleEntityId: feature.circleEntityId,
        targetBodyId: feature.targetBodyId,
        ...(feature.targetTopologyAnchorId
          ? { targetTopologyAnchorId: feature.targetTopologyAnchorId }
          : {})
      }
    };
  }

  if (feature.kind === "revolve") {
    return {
      id: feature.id,
      kind: "revolve",
      partId: DEFAULT_PART_ID,
      bodyId: feature.bodyId,
      name: feature.name,
      sketchId: feature.sketchId,
      entityId: feature.entityId,
      profileKind: feature.profileKind,
      axis: feature.axis,
      angleDegrees: feature.angleDegrees,
      operationMode: feature.operationMode,
      ...(feature.targetBodyId ? { targetBodyId: feature.targetBodyId } : {}),
      source: {
        type: "sketchEntityWithAxis",
        sketchId: feature.sketchId,
        entityId: feature.entityId,
        axis: feature.axis
      }
    };
  }

  return {
    id: feature.id,
    kind: "extrude",
    partId: DEFAULT_PART_ID,
    bodyId: feature.bodyId,
    name: feature.name,
    sketchId: feature.sketchId,
    entityId: feature.entityId,
    profileKind: feature.profileKind,
    depth: feature.depth,
    side: feature.side,
    operationMode: feature.operationMode,
    ...(feature.targetBodyId ? { targetBodyId: feature.targetBodyId } : {}),
    ...(feature.targetTopologyAnchorId
      ? { targetTopologyAnchorId: feature.targetTopologyAnchorId }
      : {}),
    source: {
      type: "sketchEntity",
      sketchId: feature.sketchId,
      entityId: feature.entityId,
      ...(feature.targetTopologyAnchorId
        ? { targetTopologyAnchorId: feature.targetTopologyAnchorId }
        : {})
    }
  };
}

function createFeatureBodySnapshot(
  feature: Feature,
  consumedByFeatureId?: FeatureId
): CadBodySnapshot {
  if (feature.kind === "chamfer") {
    return {
      id: feature.bodyId,
      kind: "solid",
      partId: DEFAULT_PART_ID,
      featureId: feature.id,
      ...(consumedByFeatureId ? { consumedByFeatureId } : {}),
      name: feature.name,
      source: {
        type: "edgeChamferFeature",
        featureId: feature.id,
        targetBodyId: feature.targetBodyId,
        ...(feature.edgeStableId ? { edgeStableId: feature.edgeStableId } : {}),
        ...(feature.namedReference
          ? { namedReference: feature.namedReference }
          : {}),
        ...(feature.topologyAnchorId
          ? { topologyAnchorId: feature.topologyAnchorId }
          : {})
      }
    };
  }

  if (feature.kind === "fillet") {
    return {
      id: feature.bodyId,
      kind: "solid",
      partId: DEFAULT_PART_ID,
      featureId: feature.id,
      ...(consumedByFeatureId ? { consumedByFeatureId } : {}),
      name: feature.name,
      source: {
        type: "edgeFilletFeature",
        featureId: feature.id,
        targetBodyId: feature.targetBodyId,
        ...(feature.edgeStableId ? { edgeStableId: feature.edgeStableId } : {}),
        ...(feature.namedReference
          ? { namedReference: feature.namedReference }
          : {}),
        ...(feature.topologyAnchorId
          ? { topologyAnchorId: feature.topologyAnchorId }
          : {})
      }
    };
  }

  if (feature.kind === "hole") {
    return {
      id: feature.bodyId,
      kind: "solid",
      partId: DEFAULT_PART_ID,
      featureId: feature.id,
      ...(consumedByFeatureId ? { consumedByFeatureId } : {}),
      name: feature.name,
      source: {
        type: "sketchHoleFeature",
        featureId: feature.id,
        targetBodyId: feature.targetBodyId,
        ...(feature.targetTopologyAnchorId
          ? { targetTopologyAnchorId: feature.targetTopologyAnchorId }
          : {}),
        sketchId: feature.sketchId,
        circleEntityId: feature.circleEntityId
      }
    };
  }

  if (feature.kind === "revolve") {
    return {
      id: feature.bodyId,
      kind: "solid",
      partId: DEFAULT_PART_ID,
      featureId: feature.id,
      ...(consumedByFeatureId ? { consumedByFeatureId } : {}),
      name: feature.name,
      source: {
        type: "sketchRevolveFeature",
        featureId: feature.id,
        sketchId: feature.sketchId,
        entityId: feature.entityId,
        profileKind: feature.profileKind,
        axis: feature.axis
      }
    };
  }

  return {
    id: feature.bodyId,
    kind: "solid",
    partId: DEFAULT_PART_ID,
    featureId: feature.id,
    ...(consumedByFeatureId ? { consumedByFeatureId } : {}),
    name: feature.name,
    source: {
      type: "sketchExtrudeFeature",
      featureId: feature.id,
      sketchId: feature.sketchId,
      entityId: feature.entityId,
      profileKind: feature.profileKind
    }
  };
}

function createConsumedBodyMap(
  features: ReadonlyMap<FeatureId, Feature>
): ReadonlyMap<BodyId, FeatureId> {
  const consumed = new Map<BodyId, FeatureId>();

  for (const feature of features.values()) {
    if (isTargetConsumingFeature(feature)) {
      consumed.set(feature.targetBodyId, feature.id);
    }
  }

  return consumed;
}

function createObjectModelSource(object: SceneObject): CadObjectModelSource {
  return {
    objectId: object.id,
    partId: DEFAULT_PART_ID,
    featureId: createPrimitiveFeatureId(object.id),
    bodyId: createPrimitiveBodyId(object.id)
  };
}

function createPrimitiveFeatureSourceMap(
  transactions: readonly Transaction[]
): ReadonlyMap<ObjectId, CadPrimitiveFeatureSource> {
  const sourceByObjectId = new Map<ObjectId, CadPrimitiveFeatureSource>();

  for (const transaction of sortTransactions(transactions)) {
    for (const op of materializeGeneratedObjectIds(transaction)) {
      if (
        op.op === "scene.createBox" ||
        op.op === "scene.createCylinder" ||
        op.op === "scene.createSphere" ||
        op.op === "scene.createCone" ||
        op.op === "scene.createTorus"
      ) {
        if (op.id) {
          sourceByObjectId.set(op.id, {
            type: "sceneObject",
            createdByTransactionId: transaction.id,
            createOp: op.op
          });
        }
        continue;
      }

      if (op.op === "scene.deleteObject") {
        sourceByObjectId.delete(op.id);
      }
    }
  }

  return sourceByObjectId;
}

function createObjectMeasurements(
  object: SceneObject,
  units: DocumentUnits
): ObjectMeasurementsSnapshot {
  const localBounds = createLocalBounds(object);
  const worldBounds = createBounds(
    createMeasurementPoints(object).map((point) =>
      transformPoint(point, object.transform)
    )
  );

  return {
    id: object.id,
    kind: object.kind,
    name: object.name,
    units,
    dimensions: { ...object.dimensions },
    transform: cloneTransform(object.transform),
    localBounds,
    worldBounds,
    approximateVolume: calculateApproximateVolume(object)
  };
}

function createLocalBounds(object: SceneObject): CadAxisAlignedBounds {
  return createBounds(createMeasurementPoints(object));
}

function createMeasurementPoints(object: SceneObject): readonly Vec3[] {
  if (object.kind === "box") {
    const { depth, height, width } = object.dimensions;
    return createBoxBoundsPoints(width / 2, height / 2, depth / 2);
  }

  if (object.kind === "sphere") {
    return createSphereBoundsPoints(object.dimensions.radius);
  }

  if (object.kind === "torus") {
    const outerRadius =
      object.dimensions.majorRadius + object.dimensions.minorRadius;
    return createBoxBoundsPoints(
      outerRadius,
      outerRadius,
      object.dimensions.minorRadius
    );
  }

  const { height, radius } = object.dimensions;
  const halfHeight = height / 2;

  return [
    [-radius, -radius, -halfHeight],
    [radius, -radius, -halfHeight],
    [radius, radius, -halfHeight],
    [-radius, radius, -halfHeight],
    [-radius, -radius, halfHeight],
    [radius, -radius, halfHeight],
    [radius, radius, halfHeight],
    [-radius, radius, halfHeight]
  ];
}

function createSphereBoundsPoints(radius: number): readonly Vec3[] {
  return [
    [-radius, -radius, -radius],
    [radius, -radius, -radius],
    [radius, radius, -radius],
    [-radius, radius, -radius],
    [-radius, -radius, radius],
    [radius, -radius, radius],
    [radius, radius, radius],
    [-radius, radius, radius]
  ];
}

function createBoxBoundsPoints(
  halfX: number,
  halfY: number,
  halfZ: number
): readonly Vec3[] {
  return [
    [-halfX, -halfY, -halfZ],
    [halfX, -halfY, -halfZ],
    [halfX, halfY, -halfZ],
    [-halfX, halfY, -halfZ],
    [-halfX, -halfY, halfZ],
    [halfX, -halfY, halfZ],
    [halfX, halfY, halfZ],
    [-halfX, halfY, halfZ]
  ];
}

function calculateApproximateVolume(object: SceneObject): number {
  const scaleFactor = Math.abs(
    object.transform.scale[0] *
      object.transform.scale[1] *
      object.transform.scale[2]
  );

  if (object.kind === "box") {
    const { depth, height, width } = object.dimensions;
    return width * height * depth * scaleFactor;
  }

  if (object.kind === "sphere") {
    const { radius } = object.dimensions;
    return (4 / 3) * Math.PI * radius * radius * radius * scaleFactor;
  }

  if (object.kind === "cone") {
    const { height, radius } = object.dimensions;
    return (Math.PI * radius * radius * height * scaleFactor) / 3;
  }

  if (object.kind === "torus") {
    const { majorRadius, minorRadius } = object.dimensions;
    return (
      2 *
      Math.PI *
      Math.PI *
      majorRadius *
      minorRadius *
      minorRadius *
      scaleFactor
    );
  }

  const { height, radius } = object.dimensions;
  return Math.PI * radius * radius * height * scaleFactor;
}

function mergeBounds(
  boundsList: readonly CadAxisAlignedBounds[]
): CadAxisAlignedBounds {
  return createBounds(boundsList.flatMap((bounds) => [bounds.min, bounds.max]));
}

function createBodyExtents(
  document: CadDocument,
  units: DocumentUnits,
  transactions: readonly Transaction[],
  derivedExactMetadata: readonly CadBodyDerivedExactMetadataSnapshot[] = []
): {
  readonly bodies: readonly BodyExtentSnapshot[];
  readonly warnings: readonly ProjectExtentsWarning[];
} {
  const structure = createProjectStructure(document, transactions);
  const bodies: BodyExtentSnapshot[] = [];
  const warnings: ProjectExtentsWarning[] = [];
  const derivedExactMetadataByBodyId = new Map(
    derivedExactMetadata.map((snapshot) => [snapshot.bodyId, snapshot] as const)
  );
  const bodyExists = (candidateBodyId: BodyId) =>
    structure.bodies.some((body) => body.id === candidateBodyId);

  for (const body of structure.bodies) {
    if (body.consumedByFeatureId) {
      continue;
    }

    if (body.source.type === "primitiveFeature") {
      continue;
    }

    if (body.source.type === "sketchExtrudeFeature") {
      const measurements = createBodyMeasurements(
        document,
        body.id,
        units,
        body.partId
      );

      if (measurements) {
        bodies.push({
          bodyId: measurements.bodyId,
          sourceFeatureId: measurements.sourceFeatureId,
          sourceKind: "authoredExtrude",
          extentSource: "source-analytic",
          measurementConfidence: "source-analytic",
          sourceSketchId: measurements.sourceSketchId,
          sourceSketchEntityId: measurements.sourceSketchEntityId,
          profileKind: measurements.profileKind,
          worldBounds: measurements.localBounds,
          volume: measurements.volume,
          surfaceArea: measurements.surfaceArea,
          centroid: measurements.centroid
        });
        continue;
      }
    }

    const topology = createBodyTopology({
      document,
      bodyId: body.id,
      units,
      ownerPartId: body.partId,
      bodyExists
    });

    if (!topology.ok) {
      warnings.push(
        createBodyExtentsUnavailableWarning(body.id, body.featureId)
      );
      continue;
    }

    if (!shouldUseDerivedExactMetadataForProjectExtents(topology.topology)) {
      warnings.push(
        createBodyExtentsUnavailableWarning(body.id, body.featureId)
      );
      continue;
    }

    const bodyExtent = createKernelDerivedBodyExtent(
      topology.topology,
      derivedExactMetadataByBodyId.get(body.id)
    );

    if (bodyExtent.ok) {
      bodies.push(bodyExtent.body);
      continue;
    }

    warnings.push(bodyExtent.warning);
  }

  return { bodies, warnings };
}

function createBodyExtentsUnavailableWarning(
  bodyId: BodyId,
  featureId: FeatureId
): ProjectExtentsWarning {
  return {
    code: "BODY_EXTENTS_UNAVAILABLE",
    message: `Body extents are unavailable because the authored body source or attached sketch reference could not be resolved: ${bodyId}`,
    bodyId,
    featureId
  };
}

function shouldUseDerivedExactMetadataForProjectExtents(
  topology: CadBodyTopologySnapshot
): boolean {
  if (
    topology.sourceKind === "authoredRevolve" ||
    topology.sourceKind === "authoredHole" ||
    topology.sourceKind === "authoredChamfer" ||
    topology.sourceKind === "authoredFillet"
  ) {
    return true;
  }

  return (
    topology.sourceKind === "authoredExtrude" &&
    topology.sourceIdentity.operationMode !== undefined &&
    topology.sourceIdentity.operationMode !== "newBody"
  );
}

function createKernelDerivedBodyExtent(
  topology: CadBodyTopologySnapshot,
  metadata: CadBodyDerivedExactMetadataSnapshot | undefined
):
  | {
      readonly ok: true;
      readonly body: BodyExtentSnapshot;
    }
  | {
      readonly ok: false;
      readonly warning: ProjectExtentsWarning;
    } {
  const featureId = topology.sourceIdentity.featureId;

  if (!featureId) {
    return {
      ok: false,
      warning: {
        code: "BODY_EXTENTS_UNAVAILABLE",
        message: `Body extents are unavailable because the authored body feature source could not be resolved: ${topology.bodyId}`,
        bodyId: topology.bodyId
      }
    };
  }

  if (!metadata) {
    return {
      ok: false,
      warning: {
        code: "DERIVED_EXACT_METADATA_MISSING",
        message: `Kernel-derived exact metadata is unavailable for body extents: ${topology.bodyId}`,
        bodyId: topology.bodyId,
        featureId,
        expected: topology.sourceIdentity.signature
      }
    };
  }

  if (
    metadata.bodyId !== topology.bodyId ||
    metadata.sourceIdentitySignature !== topology.sourceIdentity.signature
  ) {
    return {
      ok: false,
      warning: {
        code: "DERIVED_EXACT_METADATA_STALE",
        message:
          "Kernel-derived exact metadata is stale for the current body source identity.",
        bodyId: topology.bodyId,
        featureId,
        status: "stale",
        expected: topology.sourceIdentity.signature,
        received:
          metadata.bodyId === topology.bodyId
            ? metadata.sourceIdentitySignature
            : metadata.bodyId
      }
    };
  }

  if (metadata.status !== "ready") {
    return {
      ok: false,
      warning: createDerivedExactMetadataStatusWarning(topology, metadata)
    };
  }

  const exactMetadata = metadata.metadata;

  if (
    !exactMetadata?.bounds ||
    exactMetadata.volume === undefined ||
    !isFiniteBounds(exactMetadata.bounds) ||
    !Number.isFinite(exactMetadata.volume) ||
    exactMetadata.volume < 0
  ) {
    return {
      ok: false,
      warning: {
        code: "DERIVED_EXACT_METADATA_INVALID",
        message:
          "Kernel-derived exact metadata did not include valid body bounds and volume.",
        bodyId: topology.bodyId,
        featureId,
        status: "ready",
        errorCode: "INVALID_READY_METADATA"
      }
    };
  }

  return {
    ok: true,
    body: {
      bodyId: topology.bodyId,
      sourceFeatureId: featureId,
      sourceKind: topology.sourceKind,
      extentSource: "kernel-derived",
      measurementConfidence: "kernel-derived",
      sourceIdentitySignature: topology.sourceIdentity.signature,
      worldBounds: exactMetadata.bounds,
      volume: exactMetadata.volume,
      ...(topology.sourceIdentity.sourceSketchId
        ? { sourceSketchId: topology.sourceIdentity.sourceSketchId }
        : {}),
      ...(topology.sourceIdentity.sourceSketchEntityId
        ? {
            sourceSketchEntityId: topology.sourceIdentity.sourceSketchEntityId
          }
        : {}),
      ...(topology.sourceIdentity.profileKind
        ? { profileKind: topology.sourceIdentity.profileKind }
        : {}),
      ...(exactMetadata.surfaceArea !== undefined
        ? { surfaceArea: exactMetadata.surfaceArea }
        : {}),
      ...(exactMetadata.centroid ? { centroid: exactMetadata.centroid } : {}),
      ...(exactMetadata.topologyCounts
        ? { topologyCounts: exactMetadata.topologyCounts }
        : {})
    }
  };
}

function createDerivedExactMetadataStatusWarning(
  topology: CadBodyTopologySnapshot,
  metadata: CadBodyDerivedExactMetadataSnapshot
): ProjectExtentsWarning {
  const errorCode = metadata.error?.code;
  const featureId = topology.sourceIdentity.featureId;
  const base = {
    bodyId: topology.bodyId,
    featureId,
    status: metadata.status,
    errorCode,
    received: errorCode
  };

  if (metadata.status === "unsupported") {
    return {
      ...base,
      code: "DERIVED_EXACT_METADATA_UNSUPPORTED",
      message:
        metadata.error?.message ??
        `Kernel-derived exact metadata is unsupported for body extents: ${topology.bodyId}`
    };
  }

  if (metadata.status === "stale") {
    return {
      ...base,
      code: "DERIVED_EXACT_METADATA_STALE",
      message:
        metadata.error?.message ??
        `Kernel-derived exact metadata is stale for body extents: ${topology.bodyId}`,
      expected: topology.sourceIdentity.signature,
      received: errorCode ?? metadata.sourceIdentitySignature
    };
  }

  if (metadata.status === "unavailable-binding") {
    return {
      ...base,
      code: "DERIVED_EXACT_METADATA_BINDING_UNAVAILABLE",
      message:
        metadata.error?.message ??
        `Kernel exact metadata bindings are unavailable for body extents: ${topology.bodyId}`
    };
  }

  if (errorCode === "EMPTY_RESULT") {
    return {
      ...base,
      code: "DERIVED_EXACT_METADATA_EMPTY",
      message:
        metadata.error?.message ??
        `Kernel-derived exact metadata returned an empty result for body extents: ${topology.bodyId}`
    };
  }

  if (errorCode === "INVALID_RESULT") {
    return {
      ...base,
      code: "DERIVED_EXACT_METADATA_INVALID",
      message:
        metadata.error?.message ??
        `Kernel-derived exact metadata returned an invalid result for body extents: ${topology.bodyId}`
    };
  }

  return {
    ...base,
    code: "DERIVED_EXACT_METADATA_KERNEL_FAILED",
    message:
      metadata.error?.message ??
      `Kernel-derived exact metadata failed for body extents: ${topology.bodyId}`
  };
}

function isFiniteBounds(bounds: CadAxisAlignedBounds): boolean {
  return (
    bounds.min.every(Number.isFinite) &&
    bounds.max.every(Number.isFinite) &&
    bounds.size.every(Number.isFinite) &&
    bounds.center.every(Number.isFinite)
  );
}

function sumApproximateVolumes(
  measurements: readonly ObjectMeasurementsSnapshot[]
): number {
  return measurements.reduce(
    (total, measurement) => total + measurement.approximateVolume,
    0
  );
}

function sumBodyExtentVolumes(extents: readonly BodyExtentSnapshot[]): number {
  return extents.reduce((total, extent) => total + extent.volume, 0);
}

function createBounds(points: readonly Vec3[]): CadAxisAlignedBounds {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const zs = points.map((point) => point[2]);
  const min: Vec3 = [
    cleanMeasurementNumber(Math.min(...xs)),
    cleanMeasurementNumber(Math.min(...ys)),
    cleanMeasurementNumber(Math.min(...zs))
  ];
  const max: Vec3 = [
    cleanMeasurementNumber(Math.max(...xs)),
    cleanMeasurementNumber(Math.max(...ys)),
    cleanMeasurementNumber(Math.max(...zs))
  ];
  const size: Vec3 = [
    cleanMeasurementNumber(max[0] - min[0]),
    cleanMeasurementNumber(max[1] - min[1]),
    cleanMeasurementNumber(max[2] - min[2])
  ];
  const center: Vec3 = [
    cleanMeasurementNumber((min[0] + max[0]) / 2),
    cleanMeasurementNumber((min[1] + max[1]) / 2),
    cleanMeasurementNumber((min[2] + max[2]) / 2)
  ];

  return { min, max, size, center };
}

function cleanMeasurementNumber(value: number): number {
  const rounded = Math.round(value * 1e12) / 1e12;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function transformPoint(point: Vec3, transform: Transform): Vec3 {
  const scaled: Vec3 = [
    point[0] * transform.scale[0],
    point[1] * transform.scale[1],
    point[2] * transform.scale[2]
  ];

  return addVec3(
    rotateEuler(scaled, transform.rotation),
    transform.translation
  );
}

function rotateEuler(point: Vec3, rotation: Vec3): Vec3 {
  const [rx, ry, rz] = rotation;
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const cosZ = Math.cos(rz);
  const sinZ = Math.sin(rz);

  const y1 = point[1] * cosX - point[2] * sinX;
  const z1 = point[1] * sinX + point[2] * cosX;
  const x2 = point[0] * cosY + z1 * sinY;
  const z2 = -point[0] * sinY + z1 * cosY;
  const x3 = x2 * cosZ - y1 * sinZ;
  const y3 = x2 * sinZ + y1 * cosZ;

  return [x3, y3, z2];
}

function addVec3(left: Vec3, right: Vec3): Vec3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function runOperations(
  ops: readonly CadOp[],
  document: CadDocument,
  initialObjectNumber: number,
  initialSketchNumber: number,
  initialSketchEntityNumber: number,
  initialParameterNumber: number,
  initialSketchDimensionNumber: number,
  initialSketchConstraintNumber: number,
  initialFeatureNumber: number,
  initialBodyNumber: number
): OperationRunResult {
  if (ops.length === 0) {
    throwValidationError({
      code: "EMPTY_BATCH",
      message: "Cannot execute an empty batch.",
      path: "$.ops",
      expected: "at least one operation",
      received: "[]"
    });
  }

  const state: MutableDocumentState = {
    objects: new Map(document.objects),
    sketches: new Map(document.sketches),
    parameters: new Map(document.parameters),
    sketchDimensions: new Map(document.sketchDimensions),
    sketchConstraints: new Map(document.sketchConstraints),
    features: new Map(document.features),
    namedReferences: new Map(document.namedReferences),
    ...(document.topologyIdentity
      ? {
          topologyIdentity: cloneTopologyIdentitySourceSnapshot(
            document.topologyIdentity
          )
        }
      : {}),
    units: document.units
  };
  let nextObjectNumber = initialObjectNumber;
  let nextSketchNumber = initialSketchNumber;
  let nextSketchEntityNumber = initialSketchEntityNumber;
  let nextParameterNumber = initialParameterNumber;
  let nextSketchDimensionNumber = initialSketchDimensionNumber;
  let nextSketchConstraintNumber = initialSketchConstraintNumber;
  let nextFeatureNumber = initialFeatureNumber;
  let nextBodyNumber = initialBodyNumber;
  const diff: MutableSemanticDiff = {
    created: [],
    modified: [],
    deleted: []
  };

  for (const [opIndex, op] of ops.entries()) {
    try {
      applyOperation(
        op,
        state,
        diff,
        () => {
          const result = createObjectId(state.objects, nextObjectNumber);
          nextObjectNumber = result.nextObjectNumber;
          return result.id;
        },
        () => {
          const result = createSketchId(state.sketches, nextSketchNumber);
          nextSketchNumber = result.nextSketchNumber;
          return result.id;
        },
        () => {
          const result = createSketchEntityId(
            state.sketches,
            nextSketchEntityNumber
          );
          nextSketchEntityNumber = result.nextSketchEntityNumber;
          return result.id;
        },
        () => {
          const result = createParameterId(
            state.parameters,
            nextParameterNumber
          );
          nextParameterNumber = result.nextParameterNumber;
          return result.id;
        },
        () => {
          const result = createSketchDimensionId(
            state.sketchDimensions,
            nextSketchDimensionNumber
          );
          nextSketchDimensionNumber = result.nextSketchDimensionNumber;
          return result.id;
        },
        () => {
          const result = createSketchConstraintId(
            state.sketchConstraints,
            nextSketchConstraintNumber
          );
          nextSketchConstraintNumber = result.nextSketchConstraintNumber;
          return result.id;
        },
        () => {
          const result = createFeatureId(state, nextFeatureNumber);
          nextFeatureNumber = result.nextFeatureNumber;
          return result.id;
        },
        () => {
          const result = createBodyId(state, nextBodyNumber);
          nextBodyNumber = result.nextBodyNumber;
          return result.id;
        },
        opIndex
      );
    } catch (error) {
      if (error instanceof BatchValidationFailure) {
        throwValidationError({
          ...error.validationError,
          opIndex: error.validationError.opIndex ?? opIndex,
          op: error.validationError.op ?? op.op,
          path: error.validationError.path ?? operationPath(opIndex)
        });
      }

      throw error;
    }
  }

  const resultDocument = createCadDocument(
    state.objects,
    state.units,
    state.sketches,
    state.parameters,
    state.sketchDimensions,
    state.sketchConstraints,
    state.features,
    state.namedReferences,
    state.topologyIdentity
  );

  return {
    document: resultDocument,
    diff,
    nextObjectNumber: Math.max(
      nextObjectNumber,
      inferNextObjectNumber(resultDocument)
    ),
    nextSketchNumber: Math.max(
      nextSketchNumber,
      inferNextSketchNumber(resultDocument)
    ),
    nextSketchEntityNumber: Math.max(
      nextSketchEntityNumber,
      inferNextSketchEntityNumber(resultDocument)
    ),
    nextParameterNumber: Math.max(
      nextParameterNumber,
      inferNextParameterNumber(resultDocument)
    ),
    nextSketchDimensionNumber: Math.max(
      nextSketchDimensionNumber,
      inferNextSketchDimensionNumber(resultDocument)
    ),
    nextSketchConstraintNumber: Math.max(
      nextSketchConstraintNumber,
      inferNextSketchConstraintNumber(resultDocument)
    ),
    nextFeatureNumber: Math.max(
      nextFeatureNumber,
      inferNextFeatureNumber(resultDocument)
    ),
    nextBodyNumber: Math.max(
      nextBodyNumber,
      inferNextBodyNumber(resultDocument)
    )
  };
}

function createObjectId(
  objects: ReadonlyMap<ObjectId, SceneObject>,
  initialObjectNumber: number
): { id: ObjectId; nextObjectNumber: number } {
  let nextObjectNumber = initialObjectNumber;
  let id = `obj_${nextObjectNumber}`;

  while (objects.has(id)) {
    nextObjectNumber += 1;
    id = `obj_${nextObjectNumber}`;
  }

  return {
    id,
    nextObjectNumber: nextObjectNumber + 1
  };
}

function createSketchId(
  sketches: ReadonlyMap<SketchId, Sketch>,
  initialSketchNumber: number
): { id: SketchId; nextSketchNumber: number } {
  let nextSketchNumber = initialSketchNumber;
  let id = `sketch_${nextSketchNumber}`;

  while (sketches.has(id)) {
    nextSketchNumber += 1;
    id = `sketch_${nextSketchNumber}`;
  }

  return {
    id,
    nextSketchNumber: nextSketchNumber + 1
  };
}

function createSketchEntityId(
  sketches: ReadonlyMap<SketchId, Sketch>,
  initialSketchEntityNumber: number
): { id: SketchEntityId; nextSketchEntityNumber: number } {
  let nextSketchEntityNumber = initialSketchEntityNumber;
  let id = `skent_${nextSketchEntityNumber}`;

  while (hasSketchEntityId(sketches, id)) {
    nextSketchEntityNumber += 1;
    id = `skent_${nextSketchEntityNumber}`;
  }

  return {
    id,
    nextSketchEntityNumber: nextSketchEntityNumber + 1
  };
}

function hasSketchEntityId(
  sketches: ReadonlyMap<SketchId, Sketch>,
  id: SketchEntityId
): boolean {
  for (const sketch of sketches.values()) {
    if (sketch.entities.has(id)) {
      return true;
    }
  }

  return false;
}

function createParameterId(
  parameters: ReadonlyMap<ParameterId, CadParameter>,
  initialParameterNumber: number
): { id: ParameterId; nextParameterNumber: number } {
  let nextParameterNumber = initialParameterNumber;
  let id = `param_${nextParameterNumber}`;

  while (parameters.has(id)) {
    nextParameterNumber += 1;
    id = `param_${nextParameterNumber}`;
  }

  return {
    id,
    nextParameterNumber: nextParameterNumber + 1
  };
}

function createSketchDimensionId(
  dimensions: ReadonlyMap<SketchDimensionId, SketchDimension>,
  initialSketchDimensionNumber: number
): { id: SketchDimensionId; nextSketchDimensionNumber: number } {
  let nextSketchDimensionNumber = initialSketchDimensionNumber;
  let id = `skdim_${nextSketchDimensionNumber}`;

  while (dimensions.has(id)) {
    nextSketchDimensionNumber += 1;
    id = `skdim_${nextSketchDimensionNumber}`;
  }

  return {
    id,
    nextSketchDimensionNumber: nextSketchDimensionNumber + 1
  };
}

function createSketchConstraintId(
  constraints: ReadonlyMap<SketchConstraintId, SketchConstraint>,
  initialSketchConstraintNumber: number
): { id: SketchConstraintId; nextSketchConstraintNumber: number } {
  let nextSketchConstraintNumber = initialSketchConstraintNumber;
  let id = `skcon_${nextSketchConstraintNumber}`;

  while (constraints.has(id)) {
    nextSketchConstraintNumber += 1;
    id = `skcon_${nextSketchConstraintNumber}`;
  }

  return {
    id,
    nextSketchConstraintNumber: nextSketchConstraintNumber + 1
  };
}

function createFeatureId(
  state: MutableDocumentState,
  initialFeatureNumber: number
): { id: FeatureId; nextFeatureNumber: number } {
  let nextFeatureNumber = initialFeatureNumber;
  let id = `feat_${nextFeatureNumber}`;

  while (hasFeatureId(state, id)) {
    nextFeatureNumber += 1;
    id = `feat_${nextFeatureNumber}`;
  }

  return {
    id,
    nextFeatureNumber: nextFeatureNumber + 1
  };
}

function createBodyId(
  state: MutableDocumentState,
  initialBodyNumber: number
): { id: BodyId; nextBodyNumber: number } {
  let nextBodyNumber = initialBodyNumber;
  let id = `body_${nextBodyNumber}`;

  while (hasBodyId(state, id)) {
    nextBodyNumber += 1;
    id = `body_${nextBodyNumber}`;
  }

  return {
    id,
    nextBodyNumber: nextBodyNumber + 1
  };
}

function toDiffIds(diff: SemanticDiff): {
  createdIds: readonly ObjectId[];
  modifiedIds: readonly ObjectId[];
  deletedIds: readonly ObjectId[];
  createdSketchIds?: readonly SketchId[];
  modifiedSketchIds?: readonly SketchId[];
  deletedSketchIds?: readonly SketchId[];
  createdSketchEntityIds?: readonly SketchEntityId[];
  modifiedSketchEntityIds?: readonly SketchEntityId[];
  deletedSketchEntityIds?: readonly SketchEntityId[];
  createdParameterIds?: readonly ParameterId[];
  modifiedParameterIds?: readonly ParameterId[];
  deletedParameterIds?: readonly ParameterId[];
  createdSketchDimensionIds?: readonly SketchDimensionId[];
  modifiedSketchDimensionIds?: readonly SketchDimensionId[];
  deletedSketchDimensionIds?: readonly SketchDimensionId[];
  createdSketchConstraintIds?: readonly SketchConstraintId[];
  modifiedSketchConstraintIds?: readonly SketchConstraintId[];
  deletedSketchConstraintIds?: readonly SketchConstraintId[];
  createdFeatureIds?: readonly FeatureId[];
  modifiedFeatureIds?: readonly FeatureId[];
  deletedFeatureIds?: readonly FeatureId[];
  createdBodyIds?: readonly BodyId[];
  modifiedBodyIds?: readonly BodyId[];
  deletedBodyIds?: readonly BodyId[];
} {
  return {
    createdIds: uniqueObjectIds(diff.created),
    modifiedIds: uniqueObjectIds(diff.modified),
    deletedIds: uniqueObjectIds(diff.deleted),
    ...toSketchDiffIds(diff.sketches),
    ...toParameterDiffIds(diff.parameters),
    ...toSketchDimensionDiffIds(diff.sketchDimensions),
    ...toSketchConstraintDiffIds(diff.sketchConstraints),
    ...toFeatureDiffIds(diff.features)
  };
}

function uniqueObjectIds(
  objects: readonly CadObjectRef[]
): readonly ObjectId[] {
  return [...new Set(objects.map((object) => object.id))];
}

function toSketchDiffIds(sketches: SketchSemanticDiff | undefined): {
  createdSketchIds?: readonly SketchId[];
  modifiedSketchIds?: readonly SketchId[];
  deletedSketchIds?: readonly SketchId[];
  createdSketchEntityIds?: readonly SketchEntityId[];
  modifiedSketchEntityIds?: readonly SketchEntityId[];
  deletedSketchEntityIds?: readonly SketchEntityId[];
} {
  if (!sketches) {
    return {};
  }

  return {
    ...nonEmptyIdList(
      "createdSketchIds",
      uniqueSketchIds(sketches.created ?? [])
    ),
    ...nonEmptyIdList(
      "modifiedSketchIds",
      uniqueSketchIds(sketches.modified ?? [])
    ),
    ...nonEmptyIdList(
      "deletedSketchIds",
      uniqueSketchIds(sketches.deleted ?? [])
    ),
    ...nonEmptyIdList(
      "createdSketchEntityIds",
      uniqueSketchEntityIds(sketches.entitiesCreated ?? [])
    ),
    ...nonEmptyIdList(
      "modifiedSketchEntityIds",
      uniqueSketchEntityIds(sketches.entitiesModified ?? [])
    ),
    ...nonEmptyIdList(
      "deletedSketchEntityIds",
      uniqueSketchEntityIds(sketches.entitiesDeleted ?? [])
    )
  };
}

function toFeatureDiffIds(features: FeatureSemanticDiff | undefined): {
  createdFeatureIds?: readonly FeatureId[];
  modifiedFeatureIds?: readonly FeatureId[];
  deletedFeatureIds?: readonly FeatureId[];
  createdBodyIds?: readonly BodyId[];
  modifiedBodyIds?: readonly BodyId[];
  deletedBodyIds?: readonly BodyId[];
} {
  if (!features) {
    return {};
  }

  return {
    ...nonEmptyIdList(
      "createdFeatureIds",
      uniqueFeatureIds(features.created ?? [])
    ),
    ...nonEmptyIdList(
      "modifiedFeatureIds",
      uniqueFeatureIds(features.modified ?? [])
    ),
    ...nonEmptyIdList(
      "deletedFeatureIds",
      uniqueFeatureIds(features.deleted ?? [])
    ),
    ...nonEmptyIdList(
      "createdBodyIds",
      uniqueBodyIds(features.bodiesCreated ?? [])
    ),
    ...nonEmptyIdList(
      "modifiedBodyIds",
      uniqueBodyIds(features.bodiesModified ?? [])
    ),
    ...nonEmptyIdList(
      "deletedBodyIds",
      uniqueBodyIds(features.bodiesDeleted ?? [])
    )
  };
}

function toParameterDiffIds(parameters: ParameterSemanticDiff | undefined): {
  createdParameterIds?: readonly ParameterId[];
  modifiedParameterIds?: readonly ParameterId[];
  deletedParameterIds?: readonly ParameterId[];
} {
  if (!parameters) {
    return {};
  }

  return {
    ...nonEmptyIdList(
      "createdParameterIds",
      uniqueParameterIds(parameters.created ?? [])
    ),
    ...nonEmptyIdList(
      "modifiedParameterIds",
      uniqueParameterIds(parameters.modified ?? [])
    ),
    ...nonEmptyIdList(
      "deletedParameterIds",
      uniqueParameterIds(parameters.deleted ?? [])
    )
  };
}

function toSketchDimensionDiffIds(
  dimensions: SketchDimensionSemanticDiff | undefined
): {
  createdSketchDimensionIds?: readonly SketchDimensionId[];
  modifiedSketchDimensionIds?: readonly SketchDimensionId[];
  deletedSketchDimensionIds?: readonly SketchDimensionId[];
} {
  if (!dimensions) {
    return {};
  }

  return {
    ...nonEmptyIdList(
      "createdSketchDimensionIds",
      uniqueSketchDimensionIds(dimensions.created ?? [])
    ),
    ...nonEmptyIdList(
      "modifiedSketchDimensionIds",
      uniqueSketchDimensionIds(dimensions.modified ?? [])
    ),
    ...nonEmptyIdList(
      "deletedSketchDimensionIds",
      uniqueSketchDimensionIds(dimensions.deleted ?? [])
    )
  };
}

function uniqueSketchIds(
  sketches: readonly CadSketchRef[]
): readonly SketchId[] {
  return [...new Set(sketches.map((sketch) => sketch.id))];
}

function uniqueSketchEntityIds(
  entities: readonly CadSketchEntityRef[]
): readonly SketchEntityId[] {
  return [...new Set(entities.map((entity) => entity.id))];
}

function uniqueFeatureIds(
  features: readonly CadFeatureRef[]
): readonly FeatureId[] {
  return [...new Set(features.map((feature) => feature.id))];
}

function uniqueBodyIds(bodies: readonly CadBodyRef[]): readonly BodyId[] {
  return [...new Set(bodies.map((body) => body.id))];
}

function uniqueParameterIds(
  parameters: readonly CadParameterRef[]
): readonly ParameterId[] {
  return [...new Set(parameters.map((parameter) => parameter.id))];
}

function uniqueSketchDimensionIds(
  dimensions: readonly CadSketchDimensionRef[]
): readonly SketchDimensionId[] {
  return [...new Set(dimensions.map((dimension) => dimension.id))];
}

function toSketchConstraintDiffIds(
  constraints: SketchConstraintSemanticDiff | undefined
): {
  createdSketchConstraintIds?: readonly SketchConstraintId[];
  modifiedSketchConstraintIds?: readonly SketchConstraintId[];
  deletedSketchConstraintIds?: readonly SketchConstraintId[];
} {
  if (!constraints) {
    return {};
  }

  return {
    ...nonEmptyIdList(
      "createdSketchConstraintIds",
      uniqueSketchConstraintIds(constraints.created ?? [])
    ),
    ...nonEmptyIdList(
      "modifiedSketchConstraintIds",
      uniqueSketchConstraintIds(constraints.modified ?? [])
    ),
    ...nonEmptyIdList(
      "deletedSketchConstraintIds",
      uniqueSketchConstraintIds(constraints.deleted ?? [])
    )
  };
}

function uniqueSketchConstraintIds(
  constraints: readonly CadSketchConstraintRef[]
): readonly SketchConstraintId[] {
  return [...new Set(constraints.map((constraint) => constraint.id))];
}

function nonEmptyIdList<TKey extends string, TValue extends string>(
  key: TKey,
  values: readonly TValue[]
): { readonly [K in TKey]?: readonly TValue[] } {
  if (values.length === 0) {
    return {};
  }

  return { [key]: values } as { readonly [K in TKey]: readonly TValue[] };
}

function normalizeActorMetadata(actor: unknown): CadActorMetadata | undefined {
  if (actor === undefined) {
    return undefined;
  }

  if (!isRecord(actor)) {
    throwValidationError({
      code: "INVALID_ACTOR",
      message: "Transaction actor metadata must be an object.",
      path: "$.actor",
      expected: "actor metadata object",
      received: describeReceived(actor)
    });
  }

  if (!isCadActorType(actor.type)) {
    throwValidationError({
      code: "INVALID_ACTOR",
      message:
        "Transaction actor type must be human, agent, script, or system.",
      path: "$.actor.type",
      expected: "human, agent, script, or system",
      received: describeReceived(actor.type)
    });
  }

  const normalized: CadActorMetadata = { type: actor.type };

  if (actor.id !== undefined) {
    if (typeof actor.id !== "string" || actor.id.trim().length === 0) {
      throwValidationError({
        code: "INVALID_ACTOR",
        message:
          "Transaction actor id must be a non-empty string when provided.",
        path: "$.actor.id",
        expected: "non-empty string",
        received: describeReceived(actor.id)
      });
    }

    Object.assign(normalized, { id: actor.id.trim() });
  }

  if (actor.name !== undefined) {
    if (typeof actor.name !== "string" || actor.name.trim().length === 0) {
      throwValidationError({
        code: "INVALID_ACTOR",
        message:
          "Transaction actor name must be a non-empty string when provided.",
        path: "$.actor.name",
        expected: "non-empty string",
        received: describeReceived(actor.name)
      });
    }

    Object.assign(normalized, { name: actor.name.trim() });
  }

  return normalized;
}

function normalizeAuditMetadata(
  audit: unknown,
  expectedIntent: CadBatch["mode"],
  expectedOperationCount: number
): CadTransactionAuditMetadata | undefined {
  if (audit === undefined) {
    return undefined;
  }

  if (!isRecord(audit)) {
    throwValidationError({
      code: "INVALID_AUDIT",
      message: "Transaction audit metadata must be an object.",
      path: "$.audit",
      expected: "audit metadata object",
      received: describeReceived(audit)
    });
  }

  if (audit.intent !== expectedIntent) {
    throwValidationError({
      code: "INVALID_AUDIT",
      message: `Transaction audit intent must match batch mode: ${expectedIntent}.`,
      path: "$.audit.intent",
      expected: expectedIntent,
      received: describeReceived(audit.intent)
    });
  }

  if (audit.operationCount !== expectedOperationCount) {
    throwValidationError({
      code: "INVALID_AUDIT",
      message: `Transaction audit operationCount must match batch operation count: ${expectedOperationCount}.`,
      path: "$.audit.operationCount",
      expected: String(expectedOperationCount),
      received: describeReceived(audit.operationCount)
    });
  }

  const normalized: CadTransactionAuditMetadata = {
    intent: expectedIntent,
    operationCount: expectedOperationCount,
    ...normalizeOptionalAuditString(audit.source, "source"),
    ...normalizeOptionalAuditString(audit.requestId, "requestId"),
    ...normalizeOptionalAuditString(audit.toolName, "toolName")
  };

  return normalized;
}

function normalizeOptionalAuditString(
  value: unknown,
  field: "source" | "requestId" | "toolName"
): Partial<CadTransactionAuditMetadata> {
  if (value === undefined) {
    return {};
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throwValidationError({
      code: "INVALID_AUDIT",
      message: `Transaction audit ${field} must be a non-empty string when present.`,
      path: `$.audit.${field}`,
      expected: "non-empty string",
      received: describeReceived(value)
    });
  }

  return { [field]: value.trim() };
}

function operationPath(opIndex?: number, field?: string): string | undefined {
  if (opIndex === undefined) {
    return field ? `$.${field}` : undefined;
  }

  return field ? `$.ops[${opIndex}].${field}` : `$.ops[${opIndex}]`;
}

function describeReceived(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (
    value === undefined ||
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function throwValidationError(error: CadBatchValidationError): never {
  throw new BatchValidationFailure(error);
}

class BatchValidationFailure extends Error {
  constructor(readonly validationError: CadBatchValidationError) {
    super(validationError.message);
  }
}

function inferNextObjectNumber(document: CadDocument): number {
  let maxObjectNumber = 0;

  for (const id of document.objects.keys()) {
    maxObjectNumber = Math.max(maxObjectNumber, parseObjectNumber(id));
  }

  return maxObjectNumber + 1;
}

function inferNextSketchNumber(document: CadDocument): number {
  let maxSketchNumber = 0;

  for (const id of document.sketches.keys()) {
    maxSketchNumber = Math.max(maxSketchNumber, parseSketchNumber(id));
  }

  return maxSketchNumber + 1;
}

function inferNextSketchEntityNumber(document: CadDocument): number {
  let maxSketchEntityNumber = 0;

  for (const sketch of document.sketches.values()) {
    for (const id of sketch.entities.keys()) {
      maxSketchEntityNumber = Math.max(
        maxSketchEntityNumber,
        parseSketchEntityNumber(id)
      );
    }
  }

  return maxSketchEntityNumber + 1;
}

function inferNextParameterNumber(document: CadDocument): number {
  let maxParameterNumber = 0;

  for (const id of document.parameters.keys()) {
    maxParameterNumber = Math.max(maxParameterNumber, parseParameterNumber(id));
  }

  return maxParameterNumber + 1;
}

function inferNextSketchDimensionNumber(document: CadDocument): number {
  let maxSketchDimensionNumber = 0;

  for (const id of document.sketchDimensions.keys()) {
    maxSketchDimensionNumber = Math.max(
      maxSketchDimensionNumber,
      parseSketchDimensionNumber(id)
    );
  }

  return maxSketchDimensionNumber + 1;
}

function inferNextSketchConstraintNumber(document: CadDocument): number {
  let maxSketchConstraintNumber = 0;

  for (const id of document.sketchConstraints.keys()) {
    maxSketchConstraintNumber = Math.max(
      maxSketchConstraintNumber,
      parseSketchConstraintNumber(id)
    );
  }

  return maxSketchConstraintNumber + 1;
}

function inferNextFeatureNumber(document: CadDocument): number {
  let maxFeatureNumber = 0;

  for (const id of document.features.keys()) {
    maxFeatureNumber = Math.max(maxFeatureNumber, parseFeatureNumber(id));
  }

  return maxFeatureNumber + 1;
}

function inferNextBodyNumber(document: CadDocument): number {
  let maxBodyNumber = 0;

  for (const feature of document.features.values()) {
    maxBodyNumber = Math.max(maxBodyNumber, parseBodyNumber(feature.bodyId));
  }

  return maxBodyNumber + 1;
}

function parseObjectNumber(id: ObjectId): number {
  const match = /^obj_(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

function parseSketchNumber(id: SketchId): number {
  const match = /^sketch_(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

function parseSketchEntityNumber(id: SketchEntityId): number {
  const match = /^skent_(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

function parseParameterNumber(id: ParameterId): number {
  const match = /^param_(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

function parseSketchDimensionNumber(id: SketchDimensionId): number {
  const match = /^skdim_(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

function parseSketchConstraintNumber(id: SketchConstraintId): number {
  const match = /^skcon_(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

function parseFeatureNumber(id: FeatureId): number {
  const match = /^feat_(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

function parseBodyNumber(id: BodyId): number {
  const match = /^body_(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function createProjectState(project: CadProject): {
  readonly document: CadDocument;
  readonly history: TransactionEntry[];
  readonly redoStack: TransactionEntry[];
} {
  assertValidCadProject(project);
  const normalizedProject = normalizeCadProject(project);

  let historyState: {
    readonly document: CadDocument;
    readonly entries: TransactionEntry[];
  };
  let redoEntriesInApplyOrder: {
    readonly document: CadDocument;
    readonly entries: TransactionEntry[];
  };

  try {
    historyState = createTransactionEntries(
      normalizedProject.history,
      createHistoryReplayInitialDocument(normalizedProject)
    );
  } catch (error) {
    throwProjectTransactionHistoryError("$.history", error);
  }

  if (
    normalizedProject.history.length > 0 ||
    normalizedProject.redoStack.length > 0
  ) {
    assertProjectDocumentMatchesReplay(
      normalizedProject,
      historyState.document
    );
  }

  try {
    redoEntriesInApplyOrder = createTransactionEntries(
      [...normalizedProject.redoStack].reverse(),
      historyState.document,
      normalizedProject.document.nextObjectNumber,
      normalizedProject.document.nextSketchNumber,
      normalizedProject.document.nextSketchEntityNumber,
      normalizedProject.document.nextParameterNumber,
      normalizedProject.document.nextSketchDimensionNumber,
      normalizedProject.document.nextSketchConstraintNumber,
      normalizedProject.document.nextFeatureNumber,
      normalizedProject.document.nextBodyNumber
    );
  } catch (error) {
    throwProjectTransactionHistoryError("$.redoStack", error);
  }

  return {
    document: createCadDocumentFromSnapshot(normalizedProject.document),
    history: historyState.entries,
    redoStack: [...redoEntriesInApplyOrder.entries].reverse()
  };
}

function createHistoryReplayInitialDocument(project: CadProject): CadDocument {
  if (
    project.document.topologyIdentity === undefined ||
    project.history.some(transactionHasTopologyIdentityMutation)
  ) {
    return createCadDocument();
  }

  return createCadDocument(
    [],
    DEFAULT_DOCUMENT_UNITS,
    [],
    [],
    [],
    [],
    [],
    [],
    project.document.topologyIdentity
  );
}

function transactionHasTopologyIdentityMutation(
  transaction: Transaction
): boolean {
  return transaction.ops.some(
    (op) =>
      op.op === "topology.checkpoint.create" ||
      op.op === "topology.anchor.create" ||
      op.op === "topology.anchor.repair"
  );
}

function createTransactionEntries(
  transactions: readonly Transaction[],
  initialDocument: CadDocument = createCadDocument(),
  initialObjectNumber = inferNextObjectNumber(initialDocument),
  initialSketchNumber = inferNextSketchNumber(initialDocument),
  initialSketchEntityNumber = inferNextSketchEntityNumber(initialDocument),
  initialParameterNumber = inferNextParameterNumber(initialDocument),
  initialSketchDimensionNumber = inferNextSketchDimensionNumber(
    initialDocument
  ),
  initialSketchConstraintNumber = inferNextSketchConstraintNumber(
    initialDocument
  ),
  initialFeatureNumber = inferNextFeatureNumber(initialDocument),
  initialBodyNumber = inferNextBodyNumber(initialDocument)
): {
  readonly document: CadDocument;
  readonly entries: TransactionEntry[];
} {
  let document = cloneDocument(initialDocument);
  let nextObjectNumber = initialObjectNumber;
  let nextSketchNumber = initialSketchNumber;
  let nextSketchEntityNumber = initialSketchEntityNumber;
  let nextParameterNumber = initialParameterNumber;
  let nextSketchDimensionNumber = initialSketchDimensionNumber;
  let nextSketchConstraintNumber = initialSketchConstraintNumber;
  let nextFeatureNumber = initialFeatureNumber;
  let nextBodyNumber = initialBodyNumber;
  const entries: TransactionEntry[] = [];

  for (const transaction of transactions) {
    const before = cloneDocument(document);
    const run = runOperations(
      materializeGeneratedObjectIds(transaction),
      document,
      nextObjectNumber,
      nextSketchNumber,
      nextSketchEntityNumber,
      nextParameterNumber,
      nextSketchDimensionNumber,
      nextSketchConstraintNumber,
      nextFeatureNumber,
      nextBodyNumber
    );
    document = run.document;
    nextObjectNumber = run.nextObjectNumber;
    nextSketchNumber = run.nextSketchNumber;
    nextSketchEntityNumber = run.nextSketchEntityNumber;
    nextParameterNumber = run.nextParameterNumber;
    nextSketchDimensionNumber = run.nextSketchDimensionNumber;
    nextSketchConstraintNumber = run.nextSketchConstraintNumber;
    nextFeatureNumber = run.nextFeatureNumber;
    nextBodyNumber = run.nextBodyNumber;

    if (!stableJsonEqual(transaction.diff, run.diff)) {
      throw new Error(
        `Saved transaction diff does not match replayed operations for ${transaction.id}.`
      );
    }

    entries.push({
      transaction: { ...transaction },
      before,
      after: cloneDocument(document)
    });
  }

  return {
    document,
    entries
  };
}

function assertProjectDocumentMatchesReplay(
  project: CadProject,
  replayedDocument: CadDocument
): void {
  const projectDocument = createCadDocumentFromSnapshot(project.document);

  if (cadDocumentsEqual(projectDocument, replayedDocument)) {
    return;
  }

  throw new CadProjectImportError([
    {
      code: "INVALID_TRANSACTION_HISTORY",
      path: "$.history",
      message:
        "Project document does not match replayed committed transaction history."
    }
  ]);
}

function cadDocumentsEqual(left: CadDocument, right: CadDocument): boolean {
  if (
    left.units !== right.units ||
    left.objects.size !== right.objects.size ||
    left.sketches.size !== right.sketches.size ||
    left.parameters.size !== right.parameters.size ||
    left.sketchDimensions.size !== right.sketchDimensions.size ||
    left.sketchConstraints.size !== right.sketchConstraints.size ||
    left.features.size !== right.features.size ||
    left.namedReferences.size !== right.namedReferences.size ||
    !stableJsonEqual(
      left.topologyIdentity ?? null,
      right.topologyIdentity ?? null
    )
  ) {
    return false;
  }

  for (const [id, leftObject] of left.objects) {
    const rightObject = right.objects.get(id);

    if (!rightObject || !sceneObjectsEqual(leftObject, rightObject)) {
      return false;
    }
  }

  for (const [id, leftSketch] of left.sketches) {
    const rightSketch = right.sketches.get(id);

    if (!rightSketch || !sketchesEqual(leftSketch, rightSketch)) {
      return false;
    }
  }

  for (const [id, leftParameter] of left.parameters) {
    const rightParameter = right.parameters.get(id);

    if (!rightParameter || !parametersEqual(leftParameter, rightParameter)) {
      return false;
    }
  }

  for (const [id, leftDimension] of left.sketchDimensions) {
    const rightDimension = right.sketchDimensions.get(id);

    if (
      !rightDimension ||
      !sketchDimensionsEqual(leftDimension, rightDimension)
    ) {
      return false;
    }
  }

  for (const [id, leftConstraint] of left.sketchConstraints) {
    const rightConstraint = right.sketchConstraints.get(id);

    if (
      !rightConstraint ||
      !sketchConstraintsEqual(leftConstraint, rightConstraint)
    ) {
      return false;
    }
  }

  for (const [id, leftFeature] of left.features) {
    const rightFeature = right.features.get(id);

    if (!rightFeature || !featuresEqual(leftFeature, rightFeature)) {
      return false;
    }
  }

  for (const [name, leftReference] of left.namedReferences) {
    const rightReference = right.namedReferences.get(name);

    if (
      !rightReference ||
      !namedReferencesEqual(leftReference, rightReference)
    ) {
      return false;
    }
  }

  return true;
}

function namedReferencesEqual(
  left: NamedGeneratedReferenceSnapshot,
  right: NamedGeneratedReferenceSnapshot
): boolean {
  return (
    left.name === right.name &&
    left.bodyId === right.bodyId &&
    left.stableId === right.stableId &&
    left.kind === right.kind &&
    left.topologyAnchorId === right.topologyAnchorId
  );
}

function sceneObjectsEqual(left: SceneObject, right: SceneObject): boolean {
  if (
    left.id !== right.id ||
    left.kind !== right.kind ||
    left.name !== right.name ||
    !transformsEqual(left.transform, right.transform)
  ) {
    return false;
  }

  if (left.kind === "box" && right.kind === "box") {
    return (
      left.dimensions.width === right.dimensions.width &&
      left.dimensions.height === right.dimensions.height &&
      left.dimensions.depth === right.dimensions.depth
    );
  }

  if (left.kind === "cylinder" && right.kind === "cylinder") {
    return (
      left.dimensions.radius === right.dimensions.radius &&
      left.dimensions.height === right.dimensions.height
    );
  }

  if (left.kind === "sphere" && right.kind === "sphere") {
    return left.dimensions.radius === right.dimensions.radius;
  }

  if (left.kind === "cone" && right.kind === "cone") {
    return (
      left.dimensions.radius === right.dimensions.radius &&
      left.dimensions.height === right.dimensions.height
    );
  }

  if (left.kind === "torus" && right.kind === "torus") {
    return (
      left.dimensions.majorRadius === right.dimensions.majorRadius &&
      left.dimensions.minorRadius === right.dimensions.minorRadius
    );
  }

  return false;
}

function transformsEqual(left: Transform, right: Transform): boolean {
  return (
    vec3Equal(left.translation, right.translation) &&
    vec3Equal(left.rotation, right.rotation) &&
    vec3Equal(left.scale, right.scale)
  );
}

function vec3Equal(left: Vec3, right: Vec3): boolean {
  return left[0] === right[0] && left[1] === right[1] && left[2] === right[2];
}

function sketchesEqual(left: Sketch, right: Sketch): boolean {
  if (
    left.id !== right.id ||
    left.name !== right.name ||
    left.plane !== right.plane ||
    !sketchAttachmentsEqual(left.attachment, right.attachment) ||
    left.entities.size !== right.entities.size
  ) {
    return false;
  }

  for (const [id, leftEntity] of left.entities) {
    const rightEntity = right.entities.get(id);

    if (!rightEntity || !sketchEntitiesEqual(leftEntity, rightEntity)) {
      return false;
    }
  }

  return true;
}

function sketchAttachmentsEqual(
  left: SketchAttachmentSnapshot | undefined,
  right: SketchAttachmentSnapshot | undefined
): boolean {
  return stableJsonEqual(left, right);
}

function sketchEntitiesEqual(left: SketchEntity, right: SketchEntity): boolean {
  if (left.id !== right.id || left.kind !== right.kind) {
    return false;
  }

  if (left.kind === "point" && right.kind === "point") {
    return vec2Equal(left.point, right.point);
  }

  if (left.kind === "line" && right.kind === "line") {
    return vec2Equal(left.start, right.start) && vec2Equal(left.end, right.end);
  }

  if (left.kind === "rectangle" && right.kind === "rectangle") {
    return (
      vec2Equal(left.center, right.center) &&
      left.width === right.width &&
      left.height === right.height
    );
  }

  if (left.kind === "circle" && right.kind === "circle") {
    return vec2Equal(left.center, right.center) && left.radius === right.radius;
  }

  return false;
}

function parametersEqual(left: CadParameter, right: CadParameter): boolean {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.value === right.value &&
    left.description === right.description
  );
}

function sketchDimensionsEqual(
  left: SketchDimension,
  right: SketchDimension
): boolean {
  return stableJsonEqual(left, right);
}

function sketchConstraintsEqual(
  left: SketchConstraint,
  right: SketchConstraint
): boolean {
  return stableJsonEqual(left, right);
}

function vec2Equal(left: Vec2, right: Vec2): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

function featuresEqual(left: Feature, right: Feature): boolean {
  if (left.kind !== right.kind) {
    return false;
  }

  if (left.kind === "revolve" && right.kind === "revolve") {
    return (
      left.id === right.id &&
      left.name === right.name &&
      left.sketchId === right.sketchId &&
      left.entityId === right.entityId &&
      left.profileKind === right.profileKind &&
      left.axis.type === right.axis.type &&
      left.axis.sketchId === right.axis.sketchId &&
      left.axis.entityId === right.axis.entityId &&
      left.angleDegrees === right.angleDegrees &&
      left.operationMode === right.operationMode &&
      left.targetBodyId === right.targetBodyId &&
      left.bodyId === right.bodyId
    );
  }

  if (left.kind === "hole" && right.kind === "hole") {
    return (
      left.id === right.id &&
      left.name === right.name &&
      left.targetBodyId === right.targetBodyId &&
      left.targetTopologyAnchorId === right.targetTopologyAnchorId &&
      left.sketchId === right.sketchId &&
      left.circleEntityId === right.circleEntityId &&
      left.depthMode === right.depthMode &&
      left.depth === right.depth &&
      left.direction === right.direction &&
      left.bodyId === right.bodyId
    );
  }

  if (left.kind === "chamfer" && right.kind === "chamfer") {
    return (
      left.id === right.id &&
      left.name === right.name &&
      left.targetBodyId === right.targetBodyId &&
      left.edgeStableId === right.edgeStableId &&
      left.namedReference === right.namedReference &&
      left.topologyAnchorId === right.topologyAnchorId &&
      left.distance === right.distance &&
      left.bodyId === right.bodyId
    );
  }

  if (left.kind === "fillet" && right.kind === "fillet") {
    return (
      left.id === right.id &&
      left.name === right.name &&
      left.targetBodyId === right.targetBodyId &&
      left.edgeStableId === right.edgeStableId &&
      left.namedReference === right.namedReference &&
      left.topologyAnchorId === right.topologyAnchorId &&
      left.radius === right.radius &&
      left.bodyId === right.bodyId
    );
  }

  if (left.kind === "extrude" && right.kind === "extrude") {
    return (
      left.id === right.id &&
      left.name === right.name &&
      left.sketchId === right.sketchId &&
      left.entityId === right.entityId &&
      left.profileKind === right.profileKind &&
      left.depth === right.depth &&
      left.side === right.side &&
      left.operationMode === right.operationMode &&
      left.targetBodyId === right.targetBodyId &&
      left.targetTopologyAnchorId === right.targetTopologyAnchorId &&
      left.bodyId === right.bodyId
    );
  }

  return false;
}

function parseCadProject(value: unknown): CadProject {
  assertValidCadProject(value);
  return normalizeCadProject(value);
}

function assertValidCadProject(value: unknown): asserts value is CadProject {
  const issues = validateCadProject(value);

  if (issues.length > 0) {
    throw new CadProjectImportError(issues);
  }
}

function normalizeCadProject(value: CadProject): CadProject {
  if (value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V18) {
    return {
      ...value,
      schemaVersion: CAD_PROJECT_FORMAT_VERSION_V18,
      document: {
        ...value.document,
        parameters: value.document.parameters.map(cloneParameterSnapshot),
        sketchDimensions: value.document.sketchDimensions.map(
          cloneSketchDimensionSnapshot
        ),
        sketchConstraints: value.document.sketchConstraints.map(
          cloneSketchConstraintSnapshot
        ),
        features: value.document.features.map(normalizeFeatureSnapshot),
        namedReferences: value.document.namedReferences.map(
          cloneNamedReferenceSnapshot
        ),
        ...(value.document.topologyIdentity
          ? {
              topologyIdentity: cloneTopologyIdentitySourceSnapshot(
                value.document.topologyIdentity
              )
            }
          : {})
      },
      history: value.history.map(normalizeTransactionSnapshot),
      redoStack: value.redoStack.map(normalizeTransactionSnapshot)
    };
  }

  if (value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V17) {
    return {
      ...value,
      schemaVersion: CAD_PROJECT_FORMAT_VERSION_V17,
      document: {
        ...value.document,
        parameters: value.document.parameters.map(cloneParameterSnapshot),
        sketchDimensions: value.document.sketchDimensions.map(
          cloneSketchDimensionSnapshot
        ),
        sketchConstraints: value.document.sketchConstraints.map(
          cloneSketchConstraintSnapshot
        ),
        features: value.document.features.map(normalizeFeatureSnapshot),
        namedReferences: value.document.namedReferences.map(
          cloneNamedReferenceSnapshot
        )
      },
      history: value.history.map(normalizeTransactionSnapshot),
      redoStack: value.redoStack.map(normalizeTransactionSnapshot)
    };
  }

  if (
    value.schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION ||
    value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V15 ||
    value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V14 ||
    value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V13 ||
    value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V12 ||
    value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V11
  ) {
    return {
      ...value,
      schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
      document: {
        ...value.document,
        parameters: value.document.parameters.map(cloneParameterSnapshot),
        sketchDimensions: value.document.sketchDimensions.map(
          cloneSketchDimensionSnapshot
        ),
        sketchConstraints: value.document.sketchConstraints.map(
          cloneSketchConstraintSnapshot
        ),
        features: value.document.features.map(normalizeFeatureSnapshot),
        namedReferences: value.document.namedReferences.map(
          cloneNamedReferenceSnapshot
        )
      },
      history: value.history.map(normalizeTransactionSnapshot),
      redoStack: value.redoStack.map(normalizeTransactionSnapshot)
    };
  }

  if (value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V10) {
    return {
      ...value,
      schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
      document: {
        ...value.document,
        parameters: value.document.parameters.map(cloneParameterSnapshot),
        sketchDimensions: value.document.sketchDimensions.map(
          cloneSketchDimensionSnapshot
        ),
        sketchConstraints: value.document.sketchConstraints.map(
          cloneSketchConstraintSnapshot
        ),
        features: value.document.features.map(normalizeFeatureSnapshot),
        namedReferences: value.document.namedReferences.map(
          cloneNamedReferenceSnapshot
        )
      },
      history: value.history.map(normalizeTransactionSnapshot),
      redoStack: value.redoStack.map(normalizeTransactionSnapshot)
    };
  }

  if (value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V9) {
    return {
      ...value,
      schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
      document: {
        ...value.document,
        parameters: value.document.parameters.map(cloneParameterSnapshot),
        sketchDimensions: value.document.sketchDimensions.map(
          cloneSketchDimensionSnapshot
        ),
        sketchConstraints: value.document.sketchConstraints.map(
          cloneSketchConstraintSnapshot
        ),
        features: value.document.features.map(normalizeFeatureSnapshot),
        namedReferences: value.document.namedReferences.map(
          cloneNamedReferenceSnapshot
        )
      },
      history: value.history.map(normalizeTransactionSnapshot),
      redoStack: value.redoStack.map(normalizeTransactionSnapshot)
    };
  }

  if (value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V8) {
    return {
      ...value,
      schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
      document: {
        ...value.document,
        parameters: value.document.parameters.map(cloneParameterSnapshot),
        sketchDimensions: value.document.sketchDimensions.map(
          cloneSketchDimensionSnapshot
        ),
        sketchConstraints: value.document.sketchConstraints.map(
          cloneSketchConstraintSnapshot
        ),
        features: value.document.features.map(normalizeFeatureSnapshot),
        namedReferences: value.document.namedReferences.map(
          cloneNamedReferenceSnapshot
        )
      },
      history: value.history.map(normalizeTransactionSnapshot),
      redoStack: value.redoStack.map(normalizeTransactionSnapshot)
    };
  }

  if (value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V7) {
    return {
      ...value,
      schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
      document: {
        ...value.document,
        parameters: value.document.parameters.map(cloneParameterSnapshot),
        sketchDimensions: value.document.sketchDimensions.map(
          cloneSketchDimensionSnapshot
        ),
        sketchConstraints: [],
        features: value.document.features.map(normalizeFeatureSnapshot),
        namedReferences: value.document.namedReferences.map(
          cloneNamedReferenceSnapshot
        ),
        nextSketchConstraintNumber: 1
      },
      history: value.history.map(normalizeTransactionSnapshot),
      redoStack: value.redoStack.map(normalizeTransactionSnapshot)
    };
  }

  if (value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V5) {
    return {
      ...value,
      schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
      document: {
        ...value.document,
        parameters: [],
        sketchDimensions: [],
        sketchConstraints: [],
        features: value.document.features.map(normalizeFeatureSnapshot),
        namedReferences: value.document.namedReferences.map(
          cloneNamedReferenceSnapshot
        ),
        nextParameterNumber: 1,
        nextSketchDimensionNumber: 1,
        nextSketchConstraintNumber: 1
      },
      history: value.history.map(normalizeTransactionSnapshot),
      redoStack: value.redoStack.map(normalizeTransactionSnapshot)
    };
  }

  if (value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V6) {
    return {
      ...value,
      schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
      document: {
        ...value.document,
        parameters: [],
        sketchDimensions: [],
        sketchConstraints: [],
        features: value.document.features.map(normalizeFeatureSnapshot),
        namedReferences: value.document.namedReferences.map(
          cloneNamedReferenceSnapshot
        ),
        nextParameterNumber: 1,
        nextSketchDimensionNumber: 1,
        nextSketchConstraintNumber: 1
      },
      history: value.history.map(normalizeTransactionSnapshot),
      redoStack: value.redoStack.map(normalizeTransactionSnapshot)
    };
  }

  if (value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V4) {
    return {
      ...value,
      schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
      document: {
        ...value.document,
        parameters: [],
        sketchDimensions: [],
        sketchConstraints: [],
        features: value.document.features.map(normalizeFeatureSnapshot),
        namedReferences: [],
        nextParameterNumber: 1,
        nextSketchDimensionNumber: 1,
        nextSketchConstraintNumber: 1
      },
      history: value.history.map(normalizeTransactionSnapshot),
      redoStack: value.redoStack.map(normalizeTransactionSnapshot)
    };
  }

  if (value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V3) {
    return {
      ...value,
      schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
      document: {
        ...value.document,
        parameters: [],
        sketchDimensions: [],
        sketchConstraints: [],
        features: value.document.features.map(normalizeFeatureSnapshot),
        namedReferences: [],
        nextParameterNumber: 1,
        nextSketchDimensionNumber: 1,
        nextSketchConstraintNumber: 1
      },
      history: value.history.map(normalizeTransactionSnapshot),
      redoStack: value.redoStack.map(normalizeTransactionSnapshot)
    };
  }

  if (value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V2) {
    return {
      ...value,
      schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
      document: {
        ...value.document,
        parameters: [],
        sketchDimensions: [],
        sketchConstraints: [],
        features: [],
        namedReferences: [],
        nextParameterNumber: 1,
        nextSketchDimensionNumber: 1,
        nextSketchConstraintNumber: 1,
        nextFeatureNumber: 1,
        nextBodyNumber: 1
      },
      history: value.history.map(normalizeTransactionSnapshot),
      redoStack: value.redoStack.map(normalizeTransactionSnapshot)
    };
  }

  return {
    ...value,
    schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
    document: {
      ...value.document,
      sketches: [],
      parameters: [],
      sketchDimensions: [],
      sketchConstraints: [],
      features: [],
      namedReferences: [],
      nextSketchNumber: 1,
      nextSketchEntityNumber: 1,
      nextParameterNumber: 1,
      nextSketchDimensionNumber: 1,
      nextSketchConstraintNumber: 1,
      nextFeatureNumber: 1,
      nextBodyNumber: 1
    },
    history: value.history.map(normalizeTransactionSnapshot),
    redoStack: value.redoStack.map(normalizeTransactionSnapshot)
  };
}

function normalizeFeatureSnapshot(feature: FeatureSnapshot): FeatureSnapshot {
  if (feature.kind === "revolve") {
    return {
      ...feature,
      operationMode: feature.operationMode ?? "newBody"
    };
  }

  if (feature.kind === "hole") {
    return {
      ...feature,
      direction: feature.direction ?? "positive"
    };
  }

  if (feature.kind === "chamfer" || feature.kind === "fillet") {
    return { ...feature };
  }

  return {
    ...feature,
    side: feature.side ?? "positive",
    operationMode: feature.operationMode ?? "newBody"
  };
}

function normalizeTransactionSnapshot(transaction: Transaction): Transaction {
  return {
    ...transaction,
    ops: transaction.ops.map(normalizeCadOpSnapshot),
    diff: normalizeSemanticDiffSnapshot(transaction.diff)
  };
}

function normalizeCadOpSnapshot(op: CadOp): CadOp {
  if (op.op === "feature.extrude") {
    return {
      ...op,
      side: op.side ?? "positive",
      operationMode: op.operationMode ?? "newBody"
    };
  }

  if (op.op === "feature.revolve") {
    return {
      ...op,
      operationMode: op.operationMode ?? "newBody"
    };
  }

  if (op.op === "feature.hole") {
    return {
      ...op,
      direction: op.direction ?? "positive"
    };
  }

  return op;
}

function normalizeSemanticDiffSnapshot(diff: SemanticDiff): SemanticDiff {
  if (!diff.features) {
    return diff;
  }

  return {
    ...diff,
    features: {
      ...diff.features,
      ...(diff.features.created
        ? {
            created: diff.features.created.map(normalizeFeatureRefSnapshot)
          }
        : {}),
      ...(diff.features.modified
        ? {
            modified: diff.features.modified.map(normalizeFeatureRefSnapshot)
          }
        : {}),
      ...(diff.features.deleted
        ? {
            deleted: diff.features.deleted.map(normalizeFeatureRefSnapshot)
          }
        : {})
    }
  };
}

function normalizeFeatureRefSnapshot(ref: CadFeatureRef): CadFeatureRef {
  if (ref.kind === "revolve") {
    return {
      ...ref,
      operationMode: ref.operationMode ?? "newBody"
    };
  }

  if (ref.kind === "hole") {
    return {
      ...ref,
      direction: ref.direction ?? "positive"
    };
  }

  if (ref.kind === "chamfer" || ref.kind === "fillet") {
    return { ...ref };
  }

  return {
    ...ref,
    side: ref.side ?? "positive",
    operationMode: ref.operationMode ?? "newBody"
  };
}

function stableJsonEqual(left: unknown, right: unknown): boolean {
  return stableJsonStringify(left) === stableJsonStringify(right);
}

function stableJsonStringify(value: unknown): string {
  return JSON.stringify(sortPlainJson(value));
}

function sortPlainJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortPlainJson);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortPlainJson(value[key])])
  );
}

function validateCadProject(value: unknown): readonly CadProjectImportIssue[] {
  const issues: CadProjectImportIssue[] = [];

  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_PROJECT",
      "$",
      "Project root must be an object."
    );
    return issues;
  }

  if (typeof value.schemaVersion !== "string") {
    addProjectIssue(
      issues,
      "INVALID_PROJECT",
      "$.schemaVersion",
      "Project schemaVersion must be a string."
    );
  } else if (!SUPPORTED_CAD_PROJECT_FORMAT_VERSIONS.has(value.schemaVersion)) {
    addProjectIssue(
      issues,
      "UNSUPPORTED_PROJECT_VERSION",
      "$.schemaVersion",
      `Unsupported project schemaVersion: ${value.schemaVersion}.`
    );
  }

  validateCadDocumentSnapshot(
    value.document,
    "$.document",
    issues,
    value.schemaVersion
  );

  const seenTransactionIds = new Set<TransactionId>();
  validateTransactionArray(
    value.history,
    "$.history",
    issues,
    "committed",
    seenTransactionIds
  );
  validateTransactionArray(
    value.redoStack,
    "$.redoStack",
    issues,
    "undone",
    seenTransactionIds
  );

  return issues;
}

function validateCadDocumentSnapshot(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[],
  schemaVersion: unknown
): void {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_DOCUMENT",
      path,
      "Project document must be an object."
    );
    return;
  }

  if (!isDocumentUnits(value.units)) {
    addProjectIssue(
      issues,
      "INVALID_UNITS",
      `${path}.units`,
      "Document units must be one of: mm, cm, m, in."
    );
  }

  let maxGeneratedObjectNumber = 0;
  let maxGeneratedSketchNumber = 0;
  let maxGeneratedSketchEntityNumber = 0;
  let maxGeneratedParameterNumber = 0;
  let maxGeneratedSketchDimensionNumber = 0;
  let maxGeneratedSketchConstraintNumber = 0;
  let maxGeneratedFeatureNumber = 0;
  let maxGeneratedBodyNumber = 0;
  const primitiveFeatureIds = new Set<string>();
  const primitiveBodyIds = new Set<string>();

  if (!Array.isArray(value.objects)) {
    addProjectIssue(
      issues,
      "INVALID_DOCUMENT",
      `${path}.objects`,
      "Document objects must be an array."
    );
  } else {
    const seenObjectIds = new Set<string>();

    for (const [index, object] of value.objects.entries()) {
      validateSceneObject(
        object,
        `${path}.objects[${index}]`,
        issues,
        seenObjectIds
      );

      if (isRecord(object) && typeof object.id === "string") {
        maxGeneratedObjectNumber = Math.max(
          maxGeneratedObjectNumber,
          parseObjectNumber(object.id)
        );
        primitiveFeatureIds.add(createPrimitiveFeatureId(object.id));
        primitiveBodyIds.add(createPrimitiveBodyId(object.id));
      }
    }
  }

  const nextObjectNumber = value.nextObjectNumber;
  const hasValidNextObjectNumber =
    typeof nextObjectNumber === "number" &&
    Number.isInteger(nextObjectNumber) &&
    nextObjectNumber > 0;

  if (!hasValidNextObjectNumber) {
    addProjectIssue(
      issues,
      "INVALID_DOCUMENT",
      `${path}.nextObjectNumber`,
      "Document nextObjectNumber must be a positive integer."
    );
  } else if (nextObjectNumber <= maxGeneratedObjectNumber) {
    addProjectIssue(
      issues,
      "INVALID_DOCUMENT",
      `${path}.nextObjectNumber`,
      "Document nextObjectNumber must be greater than existing generated object ids."
    );
  }

  const isV17Schema = schemaVersion === CAD_PROJECT_FORMAT_VERSION_V17;
  const isV18Schema = schemaVersion === CAD_PROJECT_FORMAT_VERSION_V18;
  const requiresSketches =
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V2 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V3 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V4 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V5 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V6 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V7 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V8 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V9 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V10 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V11 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V12 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V13 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V14 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V15 ||
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION ||
    isV17Schema ||
    isV18Schema;
  const requiresFeatures =
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V3 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V4 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V5 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V6 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V7 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V8 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V9 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V10 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V11 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V12 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V13 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V14 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V15 ||
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION ||
    isV17Schema ||
    isV18Schema;
  const allowsSketchAttachments =
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V4 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V5 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V6 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V7 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V8 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V9 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V10 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V11 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V12 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V13 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V14 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V15 ||
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION ||
    isV17Schema ||
    isV18Schema;
  const requiresNamedReferences =
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V5 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V6 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V7 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V8 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V9 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V10 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V11 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V12 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V13 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V14 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V15 ||
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION ||
    isV17Schema ||
    isV18Schema;
  const requiresParameters =
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V7 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V8 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V9 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V10 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V11 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V12 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V13 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V14 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V15 ||
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION ||
    isV17Schema ||
    isV18Schema;
  const requiresSketchConstraints =
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V8 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V9 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V10 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V11 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V12 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V13 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V14 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V15 ||
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION ||
    isV17Schema ||
    isV18Schema;
  const allowsFixedSketchConstraints =
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V9 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V10 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V11 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V12 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V13 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V14 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V15 ||
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION ||
    isV17Schema ||
    isV18Schema;
  const allowsCoincidentSketchConstraints =
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V10 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V11 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V12 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V13 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V14 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V15 ||
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION ||
    isV17Schema ||
    isV18Schema;
  const allowsMidpointSketchConstraints =
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V11 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V12 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V13 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V14 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V15 ||
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION ||
    isV17Schema ||
    isV18Schema;
  const allowsParallelSketchConstraints =
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V12 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V13 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V14 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V15 ||
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION ||
    isV17Schema ||
    isV18Schema;
  const allowsPerpendicularSketchConstraints =
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V13 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V14 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V15 ||
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION ||
    isV17Schema ||
    isV18Schema;
  const allowsRevolveFeatures =
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V14 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V15 ||
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION ||
    isV17Schema ||
    isV18Schema;
  const allowsHoleFeatures =
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V15 ||
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION ||
    isV17Schema ||
    isV18Schema;
  const allowsEdgeFinishFeatures =
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION ||
    isV17Schema ||
    isV18Schema;
  const allowsAdvancedSketchConstraints = isV17Schema || isV18Schema;
  const isKnownProjectVersion =
    typeof schemaVersion === "string" &&
    SUPPORTED_CAD_PROJECT_FORMAT_VERSIONS.has(schemaVersion);
  const seenSketchIds = new Set<string>();
  const extrudeFeatureByBodyId = new Map<BodyId, ExtrudeFeatureSnapshot>();
  const authoredFeatureByBodyId = new Map<
    BodyId,
    FeatureSnapshot & { readonly path: string }
  >();
  let namedReferencesByName = new Map<
    NamedReferenceName,
    NamedGeneratedReferenceSnapshot
  >();
  const sketchEntityRefs = new Map<SketchEntityId, SketchEntityImportRef>();
  const sketchAttachments: {
    readonly path: string;
    readonly attachment: SketchAttachmentSnapshot;
  }[] = [];

  if (schemaVersion === CAD_PROJECT_FORMAT_VERSION_V1) {
    if ("sketches" in value) {
      addProjectIssue(
        issues,
        "INVALID_DOCUMENT",
        `${path}.sketches`,
        "V1 project documents must not include sketch source data."
      );
    }

    if ("features" in value) {
      addProjectIssue(
        issues,
        "INVALID_DOCUMENT",
        `${path}.features`,
        "V1 project documents must not include authored feature source data."
      );
    }
  }

  if (schemaVersion === CAD_PROJECT_FORMAT_VERSION_V2 && "features" in value) {
    addProjectIssue(
      issues,
      "INVALID_DOCUMENT",
      `${path}.features`,
      "V2 project documents must not include authored feature source data."
    );
  }

  if (
    isKnownProjectVersion &&
    !requiresNamedReferences &&
    "namedReferences" in value
  ) {
    addProjectIssue(
      issues,
      "INVALID_DOCUMENT",
      `${path}.namedReferences`,
      "Project documents before V5 must not include named generated references."
    );
  }

  if (isKnownProjectVersion && !requiresParameters) {
    if ("parameters" in value) {
      addProjectIssue(
        issues,
        "INVALID_DOCUMENT",
        `${path}.parameters`,
        "Project documents before V7 must not include parameter source data."
      );
    }

    if ("sketchDimensions" in value) {
      addProjectIssue(
        issues,
        "INVALID_DOCUMENT",
        `${path}.sketchDimensions`,
        "Project documents before V7 must not include sketch dimension source data."
      );
    }
  }

  if (isKnownProjectVersion && !requiresSketchConstraints) {
    if ("sketchConstraints" in value) {
      addProjectIssue(
        issues,
        "INVALID_DOCUMENT",
        `${path}.sketchConstraints`,
        "Project documents before V8 must not include sketch constraint source data."
      );
    }
  }

  if (isV18Schema) {
    const topologyIdentityIssues = validateTopologyIdentitySourceSnapshot(
      value.topologyIdentity
    );

    for (const issue of topologyIdentityIssues) {
      addProjectIssue(
        issues,
        "INVALID_DOCUMENT",
        `${path}.topologyIdentity`,
        issue.message
      );
    }
  } else if (isKnownProjectVersion && "topologyIdentity" in value) {
    addProjectIssue(
      issues,
      "INVALID_DOCUMENT",
      `${path}.topologyIdentity`,
      "Topology identity source records require web-cad.project.v18."
    );
  }

  if (requiresSketches) {
    if (!Array.isArray(value.sketches)) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH",
        `${path}.sketches`,
        "Document sketches must be an array."
      );
    } else {
      const seenSketchEntityIds = new Set<string>();

      for (const [index, sketch] of value.sketches.entries()) {
        const generatedNumbers = validateSketchSnapshot(
          sketch,
          `${path}.sketches[${index}]`,
          issues,
          seenSketchIds,
          seenSketchEntityIds,
          allowsSketchAttachments,
          sketchAttachments
        );
        maxGeneratedSketchNumber = Math.max(
          maxGeneratedSketchNumber,
          generatedNumbers.maxGeneratedSketchNumber
        );
        maxGeneratedSketchEntityNumber = Math.max(
          maxGeneratedSketchEntityNumber,
          generatedNumbers.maxGeneratedSketchEntityNumber
        );
        collectSketchEntityRefs(sketch, sketchEntityRefs);
      }
    }

    validateNextGeneratedNumber(
      value.nextSketchNumber,
      `${path}.nextSketchNumber`,
      "Document nextSketchNumber",
      "generated sketch ids",
      maxGeneratedSketchNumber,
      issues
    );
    validateNextGeneratedNumber(
      value.nextSketchEntityNumber,
      `${path}.nextSketchEntityNumber`,
      "Document nextSketchEntityNumber",
      "generated sketch entity ids",
      maxGeneratedSketchEntityNumber,
      issues
    );
  }

  const seenParameterIds = new Set<string>();
  const parameterValues = new Map<ParameterId, number>();

  if (requiresParameters) {
    if (!Array.isArray(value.parameters)) {
      addProjectIssue(
        issues,
        "INVALID_PARAMETER",
        `${path}.parameters`,
        "Document parameters must be an array."
      );
    } else {
      for (const [index, parameter] of value.parameters.entries()) {
        maxGeneratedParameterNumber = Math.max(
          maxGeneratedParameterNumber,
          validateParameterSnapshot(
            parameter,
            `${path}.parameters[${index}]`,
            issues,
            seenParameterIds
          )
        );

        if (
          isRecord(parameter) &&
          typeof parameter.id === "string" &&
          typeof parameter.value === "number" &&
          Number.isFinite(parameter.value)
        ) {
          parameterValues.set(parameter.id, parameter.value);
        }
      }
    }

    if (!Array.isArray(value.sketchDimensions)) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_DIMENSION",
        `${path}.sketchDimensions`,
        "Document sketchDimensions must be an array."
      );
    } else {
      const seenSketchDimensionIds = new Set<string>();
      const seenSketchDimensionTargets = new Set<string>();
      for (const [index, dimension] of value.sketchDimensions.entries()) {
        maxGeneratedSketchDimensionNumber = Math.max(
          maxGeneratedSketchDimensionNumber,
          validateSketchDimensionSnapshot(
            dimension,
            `${path}.sketchDimensions[${index}]`,
            issues,
            seenSketchDimensionIds,
            seenSketchDimensionTargets,
            seenSketchIds,
            sketchEntityRefs,
            seenParameterIds,
            parameterValues
          )
        );
      }
    }

    validateNextGeneratedNumber(
      value.nextParameterNumber,
      `${path}.nextParameterNumber`,
      "Document nextParameterNumber",
      "generated parameter ids",
      maxGeneratedParameterNumber,
      issues
    );
    validateNextGeneratedNumber(
      value.nextSketchDimensionNumber,
      `${path}.nextSketchDimensionNumber`,
      "Document nextSketchDimensionNumber",
      "generated sketch dimension ids",
      maxGeneratedSketchDimensionNumber,
      issues
    );
  }

  if (requiresSketchConstraints) {
    if (!Array.isArray(value.sketchConstraints)) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.sketchConstraints`,
        "Document sketchConstraints must be an array."
      );
    } else {
      const seenSketchConstraintIds = new Set<string>();
      const seenSketchConstraintTargets = new Map<
        string,
        SketchConstraintKind
      >();
      const seenFixedSketchConstraintCoordinates = new Map<string, Vec2>();
      const seenCoincidentConstraintTargets: {
        readonly path: string;
        readonly sketchId: SketchId;
        readonly primaryTarget: SketchPointTarget;
        readonly secondaryTarget: SketchPointTarget;
      }[] = [];
      for (const [index, constraint] of value.sketchConstraints.entries()) {
        maxGeneratedSketchConstraintNumber = Math.max(
          maxGeneratedSketchConstraintNumber,
          validateSketchConstraintSnapshot(
            constraint,
            `${path}.sketchConstraints[${index}]`,
            issues,
            seenSketchConstraintIds,
            seenSketchConstraintTargets,
            seenFixedSketchConstraintCoordinates,
            seenCoincidentConstraintTargets,
            seenSketchIds,
            sketchEntityRefs,
            allowsFixedSketchConstraints,
            allowsCoincidentSketchConstraints,
            allowsMidpointSketchConstraints,
            allowsParallelSketchConstraints,
            allowsPerpendicularSketchConstraints,
            allowsAdvancedSketchConstraints
          )
        );
      }
    }

    validateNextGeneratedNumber(
      value.nextSketchConstraintNumber,
      `${path}.nextSketchConstraintNumber`,
      "Document nextSketchConstraintNumber",
      "generated sketch constraint ids",
      maxGeneratedSketchConstraintNumber,
      issues
    );
  }

  if (requiresFeatures) {
    if (!Array.isArray(value.features)) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.features`,
        "Document features must be an array."
      );
    } else {
      const seenFeatureIds = new Set<string>(primitiveFeatureIds);
      const seenBodyIds = new Set<string>(primitiveBodyIds);
      for (const [index, feature] of value.features.entries()) {
        const generatedNumbers = validateFeatureSnapshot(
          feature,
          `${path}.features[${index}]`,
          issues,
          seenFeatureIds,
          seenBodyIds,
          seenSketchIds,
          sketchEntityRefs,
          allowsRevolveFeatures,
          allowsHoleFeatures,
          allowsEdgeFinishFeatures
        );
        maxGeneratedFeatureNumber = Math.max(
          maxGeneratedFeatureNumber,
          generatedNumbers.maxGeneratedFeatureNumber
        );
        maxGeneratedBodyNumber = Math.max(
          maxGeneratedBodyNumber,
          generatedNumbers.maxGeneratedBodyNumber
        );
        collectValidExtrudeFeatureByBodyId(feature, extrudeFeatureByBodyId);
        collectValidAuthoredFeatureByBodyId(
          feature,
          `${path}.features[${index}]`,
          authoredFeatureByBodyId
        );
      }

      validateFeatureTargetBodyReferences(authoredFeatureByBodyId, issues);
      validateSketchAttachments(
        sketchAttachments,
        extrudeFeatureByBodyId,
        issues
      );
    }

    validateNextGeneratedNumber(
      value.nextFeatureNumber,
      `${path}.nextFeatureNumber`,
      "Document nextFeatureNumber",
      "generated feature ids",
      maxGeneratedFeatureNumber,
      issues
    );
    validateNextGeneratedNumber(
      value.nextBodyNumber,
      `${path}.nextBodyNumber`,
      "Document nextBodyNumber",
      "generated body ids",
      maxGeneratedBodyNumber,
      issues
    );
  }

  if (requiresNamedReferences) {
    if (!Array.isArray(value.namedReferences)) {
      addProjectIssue(
        issues,
        "INVALID_NAMED_REFERENCE",
        `${path}.namedReferences`,
        "Document namedReferences must be an array."
      );
    } else {
      namedReferencesByName = validateNamedReferenceSnapshots(
        value.namedReferences,
        `${path}.namedReferences`,
        issues
      );
    }
  }

  validateEdgeFinishNamedReferenceSnapshots(
    authoredFeatureByBodyId,
    namedReferencesByName,
    issues
  );
}

function validateSceneObject(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[],
  seenObjectIds: Set<string>
): void {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_OBJECT",
      path,
      "Scene object must be an object."
    );
    return;
  }

  if (typeof value.id !== "string" || value.id.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_OBJECT",
      `${path}.id`,
      "Scene object id must be a non-empty string."
    );
  } else if (seenObjectIds.has(value.id)) {
    addProjectIssue(
      issues,
      "INVALID_OBJECT",
      `${path}.id`,
      `Duplicate scene object id: ${value.id}.`
    );
  } else {
    seenObjectIds.add(value.id);
  }

  validateOptionalObjectName(value.name, `${path}.name`, issues);

  if (value.kind === "box") {
    validateBoxDimensionsShape(value.dimensions, `${path}.dimensions`, issues);
  } else if (value.kind === "cylinder") {
    validateCylinderDimensionsShape(
      value.dimensions,
      `${path}.dimensions`,
      issues
    );
  } else if (value.kind === "sphere") {
    validateSphereDimensionsShape(
      value.dimensions,
      `${path}.dimensions`,
      issues
    );
  } else if (value.kind === "cone") {
    validateConeDimensionsShape(value.dimensions, `${path}.dimensions`, issues);
  } else if (value.kind === "torus") {
    validateTorusDimensionsShape(
      value.dimensions,
      `${path}.dimensions`,
      issues
    );
  } else {
    addProjectIssue(
      issues,
      "INVALID_OBJECT",
      `${path}.kind`,
      "Scene object kind must be box, cylinder, sphere, cone, or torus."
    );
  }

  validateTransformShape(value.transform, `${path}.transform`, issues);
}

function validateSketchSnapshot(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[],
  seenSketchIds: Set<string>,
  seenSketchEntityIds: Set<string>,
  allowsAttachment: boolean,
  attachments: {
    readonly path: string;
    readonly attachment: SketchAttachmentSnapshot;
  }[]
): {
  readonly maxGeneratedSketchNumber: number;
  readonly maxGeneratedSketchEntityNumber: number;
} {
  let maxGeneratedSketchNumber = 0;
  let maxGeneratedSketchEntityNumber = 0;

  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH",
      path,
      "Sketch must be an object."
    );
    return { maxGeneratedSketchNumber, maxGeneratedSketchEntityNumber };
  }

  if (typeof value.id !== "string" || value.id.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH",
      `${path}.id`,
      "Sketch id must be a non-empty string."
    );
  } else if (seenSketchIds.has(value.id)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH",
      `${path}.id`,
      `Duplicate sketch id: ${value.id}.`
    );
  } else {
    seenSketchIds.add(value.id);
    maxGeneratedSketchNumber = Math.max(
      maxGeneratedSketchNumber,
      parseSketchNumber(value.id)
    );
  }

  if (typeof value.name !== "string" || value.name.trim() === "") {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_NAME",
      `${path}.name`,
      "Sketch name must be a non-empty string."
    );
  }

  if (!isSketchPlane(value.plane)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH",
      `${path}.plane`,
      "Sketch plane must be XY, XZ, or YZ."
    );
  }

  if (value.attachment !== undefined) {
    if (!allowsAttachment) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH",
        `${path}.attachment`,
        "Sketch attachments require web-cad.project.v4."
      );
    } else if (
      validateSketchAttachmentSnapshot(
        value.attachment,
        `${path}.attachment`,
        issues
      )
    ) {
      attachments.push({
        path: `${path}.attachment`,
        attachment: value.attachment
      });
    }
  }

  if (!Array.isArray(value.entities)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_ENTITY",
      `${path}.entities`,
      "Sketch entities must be an array."
    );
  } else {
    for (const [index, entity] of value.entities.entries()) {
      maxGeneratedSketchEntityNumber = Math.max(
        maxGeneratedSketchEntityNumber,
        validateSketchEntitySnapshot(
          entity,
          `${path}.entities[${index}]`,
          issues,
          seenSketchEntityIds
        )
      );
    }
  }

  return { maxGeneratedSketchNumber, maxGeneratedSketchEntityNumber };
}

function validateSketchAttachmentSnapshot(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): value is SketchAttachmentSnapshot {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH",
      path,
      "Sketch attachment must be an object."
    );
    return false;
  }

  let valid = true;

  if (value.kind !== "generatedFace" && value.kind !== "topologyAnchorFace") {
    addProjectIssue(
      issues,
      "INVALID_SKETCH",
      `${path}.kind`,
      "Sketch attachment kind must be generatedFace or topologyAnchorFace."
    );
    valid = false;
  }

  if (value.kind === "topologyAnchorFace") {
    for (const field of [
      "bodyId",
      "topologyAnchorId",
      "checkpointId"
    ] as const) {
      if (typeof value[field] !== "string" || value[field].length === 0) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH",
          `${path}.${field}`,
          `Sketch attachment ${field} must be a non-empty string.`
        );
        valid = false;
      }
    }

    if (!isPlanarAxis(value.planarAxis)) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH",
        `${path}.planarAxis`,
        "Sketch topology anchor attachment planarAxis must be x, y, or z."
      );
      valid = false;
    }

    if (
      typeof value.planarCoordinate !== "number" ||
      !Number.isFinite(value.planarCoordinate)
    ) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH",
        `${path}.planarCoordinate`,
        "Sketch topology anchor attachment planarCoordinate must be finite."
      );
      valid = false;
    }

    return valid;
  }

  for (const field of [
    "bodyId",
    "faceStableId",
    "sourceFeatureId",
    "sourceSketchId",
    "sourceSketchEntityId"
  ] as const) {
    if (typeof value[field] !== "string" || value[field].length === 0) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH",
        `${path}.${field}`,
        `Sketch attachment ${field} must be a non-empty string.`
      );
      valid = false;
    }
  }

  if (
    !isGeneratedExtrudeFaceRole(value.faceRole) ||
    value.faceRole === "side:circular"
  ) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH",
      `${path}.faceRole`,
      "Sketch attachment faceRole must be a generated planar face role."
    );
    valid = false;
  }

  return valid;
}

function validateParameterSnapshot(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[],
  seenParameterIds: Set<string>
): number {
  let maxGeneratedParameterNumber = 0;

  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_PARAMETER",
      path,
      "Parameter must be an object."
    );
    return maxGeneratedParameterNumber;
  }

  if (typeof value.id !== "string" || value.id.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_PARAMETER",
      `${path}.id`,
      "Parameter id must be a non-empty string."
    );
  } else if (seenParameterIds.has(value.id)) {
    addProjectIssue(
      issues,
      "INVALID_PARAMETER",
      `${path}.id`,
      `Duplicate parameter id: ${value.id}.`
    );
  } else {
    seenParameterIds.add(value.id);
    maxGeneratedParameterNumber = parseParameterNumber(value.id);
  }

  if (typeof value.name !== "string" || value.name.trim() === "") {
    addProjectIssue(
      issues,
      "INVALID_PARAMETER",
      `${path}.name`,
      "Parameter name must be a non-empty string."
    );
  }

  if (typeof value.value !== "number" || !Number.isFinite(value.value)) {
    addProjectIssue(
      issues,
      "INVALID_PARAMETER",
      `${path}.value`,
      "Parameter value must be a finite number."
    );
  }

  if (
    value.description !== undefined &&
    (typeof value.description !== "string" || value.description.trim() === "")
  ) {
    addProjectIssue(
      issues,
      "INVALID_PARAMETER",
      `${path}.description`,
      "Parameter description must be a non-empty string when present."
    );
  }

  return maxGeneratedParameterNumber;
}

function validateSketchDimensionSnapshot(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[],
  seenSketchDimensionIds: Set<string>,
  seenSketchDimensionTargets: Set<string>,
  seenSketchIds: ReadonlySet<string>,
  sketchEntityRefs: ReadonlyMap<SketchEntityId, SketchEntityImportRef>,
  seenParameterIds: ReadonlySet<string>,
  parameterValues: ReadonlyMap<ParameterId, number>
): number {
  let maxGeneratedSketchDimensionNumber = 0;
  let entityRef: SketchEntityImportRef | undefined;
  let targetIsValid = false;

  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_DIMENSION",
      path,
      "Sketch dimension must be an object."
    );
    return maxGeneratedSketchDimensionNumber;
  }

  if (typeof value.id !== "string" || value.id.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_DIMENSION",
      `${path}.id`,
      "Sketch dimension id must be a non-empty string."
    );
  } else if (seenSketchDimensionIds.has(value.id)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_DIMENSION",
      `${path}.id`,
      `Duplicate sketch dimension id: ${value.id}.`
    );
  } else {
    seenSketchDimensionIds.add(value.id);
    maxGeneratedSketchDimensionNumber = parseSketchDimensionNumber(value.id);
  }

  if (typeof value.name !== "string" || value.name.trim() === "") {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_DIMENSION",
      `${path}.name`,
      "Sketch dimension name must be a non-empty string."
    );
  }

  if (typeof value.sketchId !== "string" || value.sketchId.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_DIMENSION",
      `${path}.sketchId`,
      "Sketch dimension sketchId must be a non-empty string."
    );
  } else if (!seenSketchIds.has(value.sketchId)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_DIMENSION",
      `${path}.sketchId`,
      "Sketch dimension sketchId must reference an existing sketch."
    );
  }

  if (typeof value.entityId !== "string" || value.entityId.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_DIMENSION",
      `${path}.entityId`,
      "Sketch dimension entityId must be a non-empty string."
    );
  } else {
    entityRef = sketchEntityRefs.get(value.entityId);

    if (!entityRef) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_DIMENSION",
        `${path}.entityId`,
        "Sketch dimension entityId must reference an existing sketch entity."
      );
    } else {
      if (entityRef.sketchId !== value.sketchId) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_DIMENSION",
          `${path}.entityId`,
          "Sketch dimension entityId must belong to the referenced sketch."
        );
      }

      targetIsValid = validateSketchDimensionTargetShape(
        value.target,
        `${path}.target`,
        entityRef.kind,
        issues
      );
    }
  }

  const effectiveValue = validateSketchDimensionValueSourceSnapshot(
    value.valueSource,
    `${path}.valueSource`,
    seenParameterIds,
    parameterValues,
    issues
  );

  if (
    typeof value.sketchId === "string" &&
    typeof value.entityId === "string" &&
    targetIsValid &&
    entityRef &&
    isSketchDimensionTarget(value.target)
  ) {
    const targetKey = getSketchDimensionTargetKey({
      sketchId: value.sketchId,
      entityId: value.entityId,
      target: value.target
    });

    if (seenSketchDimensionTargets.has(targetKey)) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_DIMENSION",
        `${path}.target`,
        "Sketch dimension target is already driven by another dimension."
      );
    } else {
      seenSketchDimensionTargets.add(targetKey);
    }

    if (effectiveValue !== undefined) {
      const entityValue = getImportedSketchDimensionTargetValue(
        entityRef.entity,
        value.target
      );

      if (
        entityValue !== undefined &&
        cleanMeasurementNumber(entityValue) !==
          cleanMeasurementNumber(effectiveValue)
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_DIMENSION",
          `${path}.valueSource`,
          "Sketch dimension effective value must match the saved target entity value."
        );
      }
    }
  }

  return maxGeneratedSketchDimensionNumber;
}

function validateSketchDimensionTargetShape(
  value: unknown,
  path: string,
  entityKind: SketchEntityKind,
  issues: CadProjectImportIssue[]
): boolean {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_DIMENSION",
      path,
      "Sketch dimension target must be an object."
    );
    return false;
  }

  const valid =
    (entityKind === "rectangle" &&
      value.entityKind === "rectangle" &&
      (value.role === "width" || value.role === "height")) ||
    (entityKind === "circle" &&
      value.entityKind === "circle" &&
      value.role === "radius") ||
    (entityKind === "line" &&
      value.entityKind === "line" &&
      value.role === "length");

  if (!valid) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_DIMENSION",
      path,
      "Sketch dimension target must match a supported rectangle width/height, circle radius, or line length role."
    );
  }

  return valid;
}

function validateSketchPointTargetSnapshot(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): SketchPointTarget | undefined {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      path,
      "Fixed sketch constraint target must be an object."
    );
    return undefined;
  }

  if (typeof value.entityId !== "string" || value.entityId.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      `${path}.entityId`,
      "Fixed sketch constraint target entityId must be a non-empty string."
    );
  }

  if (!isSketchPointTargetRole(value.role)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      `${path}.role`,
      "Fixed sketch constraint target role must be position, start, end, or center."
    );
  }

  return typeof value.entityId === "string" &&
    isSketchPointTargetRole(value.role)
    ? {
        entityId: value.entityId,
        role: value.role
      }
    : undefined;
}

function validateSketchCurveConstraintTargetSnapshot(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[],
  label: string
): SketchCurveConstraintTarget | undefined {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      path,
      `${label} sketch constraint target must be an object.`
    );
    return undefined;
  }

  if (typeof value.entityId !== "string" || value.entityId.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      `${path}.entityId`,
      `${label} sketch constraint target entityId must be a non-empty string.`
    );
  }

  if (value.entityKind !== "line" && value.entityKind !== "circle") {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      `${path}.entityKind`,
      `${label} sketch constraint target entityKind must be line or circle.`
    );
  }

  return typeof value.entityId === "string" &&
    (value.entityKind === "line" || value.entityKind === "circle")
    ? {
        entityId: value.entityId,
        entityKind: value.entityKind
      }
    : undefined;
}

function validateStringIdField(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[],
  label: string
): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      path,
      `${label} must be a non-empty string.`
    );
    return undefined;
  }

  return value;
}

function validateSketchEntityReferenceForImport(args: {
  readonly entityId: string | undefined;
  readonly path: string;
  readonly label: string;
  readonly sketchId: unknown;
  readonly expectedKind: SketchEntityKind;
  readonly sketchEntityRefs: ReadonlyMap<SketchEntityId, SketchEntityImportRef>;
  readonly issues: CadProjectImportIssue[];
}): void {
  const {
    entityId,
    path,
    label,
    sketchId,
    expectedKind,
    sketchEntityRefs,
    issues
  } = args;

  if (!entityId) {
    return;
  }

  const entityRef = sketchEntityRefs.get(entityId);

  if (!entityRef) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      path,
      `${label} must reference an existing sketch entity.`
    );
    return;
  }

  if (entityRef.sketchId !== sketchId) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      path,
      `${label} must belong to the referenced sketch.`
    );
  }

  if (entityRef.kind !== expectedKind) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      path,
      `${label} must reference a ${expectedKind} sketch entity.`
    );
  }
}

function validateSketchCurveTargetEntityForImport(args: {
  readonly target: SketchCurveConstraintTarget | undefined;
  readonly path: string;
  readonly label: string;
  readonly sketchId: unknown;
  readonly sketchEntityRefs: ReadonlyMap<SketchEntityId, SketchEntityImportRef>;
  readonly issues: CadProjectImportIssue[];
}): void {
  const { target, path, label, sketchId, sketchEntityRefs, issues } = args;

  if (!target) {
    return;
  }

  validateSketchEntityReferenceForImport({
    entityId: target.entityId,
    path: `${path}.entityId`,
    label,
    sketchId,
    expectedKind: target.entityKind,
    sketchEntityRefs,
    issues
  });
}

function isSketchPointTargetSupportedForImport(
  entityKind: SketchEntityKind,
  target: SketchPointTarget
): boolean {
  return (
    (entityKind === "point" && target.role === "position") ||
    (entityKind === "line" &&
      (target.role === "start" || target.role === "end")) ||
    ((entityKind === "rectangle" || entityKind === "circle") &&
      target.role === "center")
  );
}

function isMidpointSketchPointTargetSupportedForImport(
  entityKind: SketchEntityKind,
  target: SketchPointTarget
): boolean {
  return (
    (entityKind === "point" && target.role === "position") ||
    ((entityKind === "rectangle" || entityKind === "circle") &&
      target.role === "center")
  );
}

function getImportSketchPointTargetCoordinate(
  entity: Record<string, unknown>,
  target: SketchPointTarget
): Vec2 | undefined {
  if (target.role === "position" && isVec2(entity.point)) {
    return entity.point;
  }

  if (target.role === "start" && isVec2(entity.start)) {
    return entity.start;
  }

  if (target.role === "end" && isVec2(entity.end)) {
    return entity.end;
  }

  if (target.role === "center" && isVec2(entity.center)) {
    return entity.center;
  }

  return undefined;
}

function validateSketchConstraintSnapshot(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[],
  seenSketchConstraintIds: Set<string>,
  seenSketchConstraintTargets: Map<string, SketchConstraintKind>,
  seenFixedSketchConstraintCoordinates: Map<string, Vec2>,
  seenCoincidentConstraintTargets: {
    readonly path: string;
    readonly sketchId: SketchId;
    readonly primaryTarget: SketchPointTarget;
    readonly secondaryTarget: SketchPointTarget;
  }[],
  seenSketchIds: ReadonlySet<string>,
  sketchEntityRefs: ReadonlyMap<SketchEntityId, SketchEntityImportRef>,
  allowsFixedConstraints: boolean,
  allowsCoincidentConstraints: boolean,
  allowsMidpointConstraints: boolean,
  allowsParallelConstraints: boolean,
  allowsPerpendicularConstraints: boolean,
  allowsAdvancedConstraints: boolean
): number {
  let maxGeneratedSketchConstraintNumber = 0;
  let entityRef: SketchEntityImportRef | undefined;
  let entityId: string | undefined;
  let target: SketchPointTarget | undefined;
  let primaryTarget: SketchPointTarget | undefined;
  let secondaryTarget: SketchPointTarget | undefined;
  let lineEntityRef: SketchEntityImportRef | undefined;
  let lineEntityId: string | undefined;
  let primaryLineEntityId: string | undefined;
  let secondaryLineEntityId: string | undefined;
  let primaryLineEntityRef: SketchEntityImportRef | undefined;
  let secondaryLineEntityRef: SketchEntityImportRef | undefined;
  let primaryCurveTarget: SketchCurveConstraintTarget | undefined;
  let secondaryCurveTarget: SketchCurveConstraintTarget | undefined;
  let primaryCircleEntityId: string | undefined;
  let secondaryCircleEntityId: string | undefined;
  let symmetryLineEntityId: string | undefined;

  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      path,
      "Sketch constraint must be an object."
    );
    return maxGeneratedSketchConstraintNumber;
  }

  if (typeof value.id !== "string" || value.id.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      `${path}.id`,
      "Sketch constraint id must be a non-empty string."
    );
  } else if (seenSketchConstraintIds.has(value.id)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      `${path}.id`,
      `Duplicate sketch constraint id: ${value.id}.`
    );
  } else {
    seenSketchConstraintIds.add(value.id);
    maxGeneratedSketchConstraintNumber = parseSketchConstraintNumber(value.id);
  }

  if (typeof value.name !== "string" || value.name.trim() === "") {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      `${path}.name`,
      "Sketch constraint name must be a non-empty string."
    );
  }

  if (typeof value.sketchId !== "string" || value.sketchId.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      `${path}.sketchId`,
      "Sketch constraint sketchId must be a non-empty string."
    );
  } else if (!seenSketchIds.has(value.sketchId)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      `${path}.sketchId`,
      "Sketch constraint sketchId must reference an existing sketch."
    );
  }

  if (!isSketchConstraintKind(value.kind)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      `${path}.kind`,
      "Sketch constraint kind must be horizontal, vertical, fixed, coincident, midpoint, parallel, perpendicular, tangent, concentric, equalLength, equalRadius, angle, or symmetry."
    );
  }

  if (value.kind === "fixed") {
    if (!allowsFixedConstraints) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.kind`,
        "Project documents before V9 must not include fixed sketch constraints."
      );
    }

    target = validateSketchPointTargetSnapshot(
      value.target,
      `${path}.target`,
      issues
    );
    entityId = target?.entityId;

    if (
      typeof value.entityId === "string" &&
      target &&
      value.entityId !== target.entityId
    ) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.entityId`,
        "Fixed sketch constraint entityId must match target.entityId."
      );
    }

    if (!isVec2(value.coordinate)) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.coordinate`,
        "Fixed sketch constraint coordinate must be a finite Vec2."
      );
    }
  } else if (value.kind === "coincident") {
    if (!allowsCoincidentConstraints) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.kind`,
        "Project documents before V10 must not include coincident sketch constraints."
      );
    }

    primaryTarget = validateSketchPointTargetSnapshot(
      value.primaryTarget,
      `${path}.primaryTarget`,
      issues
    );
    secondaryTarget = validateSketchPointTargetSnapshot(
      value.secondaryTarget,
      `${path}.secondaryTarget`,
      issues
    );
    entityId = primaryTarget?.entityId;

    if (
      typeof value.entityId === "string" &&
      primaryTarget &&
      value.entityId !== primaryTarget.entityId
    ) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.entityId`,
        "Coincident sketch constraint entityId must match primaryTarget.entityId."
      );
    }

    if (
      primaryTarget &&
      secondaryTarget &&
      sketchPointTargetsEqual(primaryTarget, secondaryTarget)
    ) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.secondaryTarget`,
        "Coincident sketch constraint targets must be distinct."
      );
    }
  } else if (value.kind === "midpoint") {
    if (!allowsMidpointConstraints) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.kind`,
        "Project documents before V11 must not include midpoint sketch constraints."
      );
    }

    if (
      typeof value.lineEntityId !== "string" ||
      value.lineEntityId.length === 0
    ) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.lineEntityId`,
        "Midpoint sketch constraint lineEntityId must be a non-empty string."
      );
    } else {
      lineEntityId = value.lineEntityId;
    }

    target = validateSketchPointTargetSnapshot(
      value.target,
      `${path}.target`,
      issues
    );
    entityId = lineEntityId;

    if (
      typeof value.entityId === "string" &&
      lineEntityId &&
      value.entityId !== lineEntityId
    ) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.entityId`,
        "Midpoint sketch constraint entityId must match lineEntityId."
      );
    }
  } else if (value.kind === "parallel" || value.kind === "perpendicular") {
    const label = value.kind === "parallel" ? "Parallel" : "Perpendicular";
    const requiredVersion = value.kind === "parallel" ? "V12" : "V13";
    const isAllowed =
      value.kind === "parallel"
        ? allowsParallelConstraints
        : allowsPerpendicularConstraints;

    if (!isAllowed) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.kind`,
        `Project documents before ${requiredVersion} must not include ${value.kind} sketch constraints.`
      );
    }

    if (
      typeof value.primaryLineEntityId !== "string" ||
      value.primaryLineEntityId.length === 0
    ) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.primaryLineEntityId`,
        `${label} sketch constraint primaryLineEntityId must be a non-empty string.`
      );
    } else {
      primaryLineEntityId = value.primaryLineEntityId;
    }

    if (
      typeof value.secondaryLineEntityId !== "string" ||
      value.secondaryLineEntityId.length === 0
    ) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.secondaryLineEntityId`,
        `${label} sketch constraint secondaryLineEntityId must be a non-empty string.`
      );
    } else {
      secondaryLineEntityId = value.secondaryLineEntityId;
    }

    entityId = secondaryLineEntityId;

    if (
      typeof value.entityId === "string" &&
      secondaryLineEntityId &&
      value.entityId !== secondaryLineEntityId
    ) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.entityId`,
        `${label} sketch constraint entityId must match secondaryLineEntityId.`
      );
    }

    if (
      primaryLineEntityId &&
      secondaryLineEntityId &&
      primaryLineEntityId === secondaryLineEntityId
    ) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.secondaryLineEntityId`,
        `${label} sketch constraint line targets must be distinct.`
      );
    }
  } else if (isAdvancedSketchConstraintKind(value.kind)) {
    const label = getAdvancedSketchConstraintLabel(value.kind);

    if (!allowsAdvancedConstraints) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.kind`,
        "Advanced sketch solver constraints require web-cad.project.v17."
      );
    }

    if (value.kind === "tangent") {
      primaryCurveTarget = validateSketchCurveConstraintTargetSnapshot(
        value.primaryTarget,
        `${path}.primaryTarget`,
        issues,
        label
      );
      secondaryCurveTarget = validateSketchCurveConstraintTargetSnapshot(
        value.secondaryTarget,
        `${path}.secondaryTarget`,
        issues,
        label
      );
      entityId = secondaryCurveTarget?.entityId;

      if (
        typeof value.entityId === "string" &&
        secondaryCurveTarget &&
        value.entityId !== secondaryCurveTarget.entityId
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.entityId`,
          "Tangent sketch constraint entityId must match secondaryTarget.entityId."
        );
      }

      if (
        primaryCurveTarget &&
        secondaryCurveTarget &&
        primaryCurveTarget.entityId === secondaryCurveTarget.entityId
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.secondaryTarget`,
          "Tangent sketch constraint curve targets must be distinct."
        );
      }
    } else if (value.kind === "concentric" || value.kind === "equalRadius") {
      primaryCircleEntityId = validateStringIdField(
        value.primaryCircleEntityId,
        `${path}.primaryCircleEntityId`,
        issues,
        `${label} sketch constraint primaryCircleEntityId`
      );
      secondaryCircleEntityId = validateStringIdField(
        value.secondaryCircleEntityId,
        `${path}.secondaryCircleEntityId`,
        issues,
        `${label} sketch constraint secondaryCircleEntityId`
      );
      entityId = secondaryCircleEntityId;

      if (
        typeof value.entityId === "string" &&
        secondaryCircleEntityId &&
        value.entityId !== secondaryCircleEntityId
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.entityId`,
          `${label} sketch constraint entityId must match secondaryCircleEntityId.`
        );
      }

      if (
        primaryCircleEntityId &&
        secondaryCircleEntityId &&
        primaryCircleEntityId === secondaryCircleEntityId
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.secondaryCircleEntityId`,
          `${label} sketch constraint circle targets must be distinct.`
        );
      }
    } else if (value.kind === "equalLength" || value.kind === "angle") {
      primaryLineEntityId = validateStringIdField(
        value.primaryLineEntityId,
        `${path}.primaryLineEntityId`,
        issues,
        `${label} sketch constraint primaryLineEntityId`
      );
      secondaryLineEntityId = validateStringIdField(
        value.secondaryLineEntityId,
        `${path}.secondaryLineEntityId`,
        issues,
        `${label} sketch constraint secondaryLineEntityId`
      );
      entityId = secondaryLineEntityId;

      if (
        typeof value.entityId === "string" &&
        secondaryLineEntityId &&
        value.entityId !== secondaryLineEntityId
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.entityId`,
          `${label} sketch constraint entityId must match secondaryLineEntityId.`
        );
      }

      if (
        primaryLineEntityId &&
        secondaryLineEntityId &&
        primaryLineEntityId === secondaryLineEntityId
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.secondaryLineEntityId`,
          `${label} sketch constraint line targets must be distinct.`
        );
      }

      if (
        value.kind === "angle" &&
        (typeof value.angleDegrees !== "number" ||
          !Number.isFinite(value.angleDegrees) ||
          value.angleDegrees <= 0 ||
          value.angleDegrees >= 180)
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.angleDegrees`,
          "Angle sketch constraint angleDegrees must be a finite number greater than 0 and less than 180."
        );
      }
    } else {
      primaryTarget = validateSketchPointTargetSnapshot(
        value.primaryTarget,
        `${path}.primaryTarget`,
        issues
      );
      secondaryTarget = validateSketchPointTargetSnapshot(
        value.secondaryTarget,
        `${path}.secondaryTarget`,
        issues
      );
      symmetryLineEntityId = validateStringIdField(
        value.symmetryLineEntityId,
        `${path}.symmetryLineEntityId`,
        issues,
        "Symmetry sketch constraint symmetryLineEntityId"
      );
      entityId = secondaryTarget?.entityId;

      if (
        typeof value.entityId === "string" &&
        secondaryTarget &&
        value.entityId !== secondaryTarget.entityId
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.entityId`,
          "Symmetry sketch constraint entityId must match secondaryTarget.entityId."
        );
      }

      if (
        primaryTarget &&
        secondaryTarget &&
        sketchPointTargetsEqual(primaryTarget, secondaryTarget)
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.secondaryTarget`,
          "Symmetry sketch constraint point targets must be distinct."
        );
      }
    }
  } else if (typeof value.entityId === "string" && value.entityId.length > 0) {
    entityId = value.entityId;
  } else {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      `${path}.entityId`,
      "Sketch constraint entityId must be a non-empty string."
    );
  }

  if (typeof entityId === "string") {
    entityRef = sketchEntityRefs.get(entityId);

    if (!entityRef) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        value.kind === "fixed"
          ? `${path}.target.entityId`
          : value.kind === "coincident"
            ? `${path}.primaryTarget.entityId`
            : value.kind === "midpoint"
              ? `${path}.lineEntityId`
              : value.kind === "parallel" || value.kind === "perpendicular"
                ? `${path}.secondaryLineEntityId`
                : `${path}.entityId`,
        "Sketch constraint entityId must reference an existing sketch entity."
      );
    } else {
      if (entityRef.sketchId !== value.sketchId) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          value.kind === "fixed"
            ? `${path}.target.entityId`
            : value.kind === "coincident"
              ? `${path}.primaryTarget.entityId`
              : value.kind === "midpoint"
                ? `${path}.lineEntityId`
                : value.kind === "parallel" || value.kind === "perpendicular"
                  ? `${path}.secondaryLineEntityId`
                  : `${path}.entityId`,
          "Sketch constraint entityId must belong to the referenced sketch."
        );
      }

      if (
        (value.kind === "horizontal" || value.kind === "vertical") &&
        entityRef.kind !== "line"
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.entityId`,
          "Sketch orientation constraint entityId must reference a line sketch entity."
        );
      }

      if (value.kind === "midpoint" && entityRef.kind !== "line") {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.lineEntityId`,
          "Midpoint sketch constraint lineEntityId must reference a line sketch entity."
        );
      }

      if (
        (value.kind === "parallel" || value.kind === "perpendicular") &&
        entityRef.kind !== "line"
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.secondaryLineEntityId`,
          `${value.kind === "parallel" ? "Parallel" : "Perpendicular"} sketch constraint secondaryLineEntityId must reference a line sketch entity.`
        );
      }

      if (
        value.kind === "fixed" &&
        target &&
        !isSketchPointTargetSupportedForImport(entityRef.kind, target)
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.target.role`,
          "Fixed sketch constraint target role is not supported for this entity."
        );
      }

      if (
        value.kind === "coincident" &&
        primaryTarget &&
        !isSketchPointTargetSupportedForImport(entityRef.kind, primaryTarget)
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.primaryTarget.role`,
          "Coincident sketch constraint primary target role is not supported for this entity."
        );
      }
    }
  }

  if (value.kind === "midpoint" && target) {
    const targetEntityRef = sketchEntityRefs.get(target.entityId);
    lineEntityRef = lineEntityId
      ? sketchEntityRefs.get(lineEntityId)
      : undefined;

    if (!targetEntityRef) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.target.entityId`,
        "Midpoint sketch constraint target entityId must reference an existing sketch entity."
      );
    } else {
      if (targetEntityRef.sketchId !== value.sketchId) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.target.entityId`,
          "Midpoint sketch constraint target must belong to the referenced sketch."
        );
      }

      if (
        !isMidpointSketchPointTargetSupportedForImport(
          targetEntityRef.kind,
          target
        )
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.target.role`,
          "Midpoint sketch constraint target role is not supported for this entity."
        );
      }

      if (
        lineEntityId &&
        target.entityId === lineEntityId &&
        (target.role === "start" || target.role === "end")
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.target`,
          "Midpoint sketch constraint target cannot be one of the same line endpoints."
        );
      }
    }
  }

  if (value.kind === "coincident" && secondaryTarget) {
    const secondaryEntityRef = sketchEntityRefs.get(secondaryTarget.entityId);

    if (!secondaryEntityRef) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.secondaryTarget.entityId`,
        "Coincident sketch constraint secondary target entityId must reference an existing sketch entity."
      );
    } else {
      if (secondaryEntityRef.sketchId !== value.sketchId) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.secondaryTarget.entityId`,
          "Coincident sketch constraint secondary target must belong to the referenced sketch."
        );
      }

      if (
        !isSketchPointTargetSupportedForImport(
          secondaryEntityRef.kind,
          secondaryTarget
        )
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.secondaryTarget.role`,
          "Coincident sketch constraint secondary target role is not supported for this entity."
        );
      }
    }
  }

  if (value.kind === "parallel" || value.kind === "perpendicular") {
    const label = value.kind === "parallel" ? "Parallel" : "Perpendicular";
    primaryLineEntityRef = primaryLineEntityId
      ? sketchEntityRefs.get(primaryLineEntityId)
      : undefined;
    secondaryLineEntityRef = secondaryLineEntityId
      ? sketchEntityRefs.get(secondaryLineEntityId)
      : undefined;

    if (primaryLineEntityId && !primaryLineEntityRef) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.primaryLineEntityId`,
        `${label} sketch constraint primaryLineEntityId must reference an existing sketch entity.`
      );
    } else if (primaryLineEntityRef) {
      if (primaryLineEntityRef.sketchId !== value.sketchId) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.primaryLineEntityId`,
          `${label} sketch constraint primaryLineEntityId must belong to the referenced sketch.`
        );
      }

      if (primaryLineEntityRef.kind !== "line") {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.primaryLineEntityId`,
          `${label} sketch constraint primaryLineEntityId must reference a line sketch entity.`
        );
      }
    }

    if (secondaryLineEntityRef) {
      if (secondaryLineEntityRef.sketchId !== value.sketchId) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.secondaryLineEntityId`,
          `${label} sketch constraint secondaryLineEntityId must belong to the referenced sketch.`
        );
      }

      if (secondaryLineEntityRef.kind !== "line") {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.secondaryLineEntityId`,
          `${label} sketch constraint secondaryLineEntityId must reference a line sketch entity.`
        );
      }
    }
  }

  if (value.kind === "tangent") {
    validateSketchCurveTargetEntityForImport({
      target: primaryCurveTarget,
      path: `${path}.primaryTarget`,
      label: "Tangent sketch constraint primaryTarget",
      sketchId: value.sketchId,
      sketchEntityRefs,
      issues
    });
    validateSketchCurveTargetEntityForImport({
      target: secondaryCurveTarget,
      path: `${path}.secondaryTarget`,
      label: "Tangent sketch constraint secondaryTarget",
      sketchId: value.sketchId,
      sketchEntityRefs,
      issues
    });
  }

  if (value.kind === "concentric" || value.kind === "equalRadius") {
    const label = value.kind === "concentric" ? "Concentric" : "Equal radius";
    validateSketchEntityReferenceForImport({
      entityId: primaryCircleEntityId,
      path: `${path}.primaryCircleEntityId`,
      label: `${label} sketch constraint primaryCircleEntityId`,
      sketchId: value.sketchId,
      expectedKind: "circle",
      sketchEntityRefs,
      issues
    });
    validateSketchEntityReferenceForImport({
      entityId: secondaryCircleEntityId,
      path: `${path}.secondaryCircleEntityId`,
      label: `${label} sketch constraint secondaryCircleEntityId`,
      sketchId: value.sketchId,
      expectedKind: "circle",
      sketchEntityRefs,
      issues
    });
  }

  if (value.kind === "equalLength" || value.kind === "angle") {
    const label = value.kind === "equalLength" ? "Equal length" : "Angle";
    validateSketchEntityReferenceForImport({
      entityId: primaryLineEntityId,
      path: `${path}.primaryLineEntityId`,
      label: `${label} sketch constraint primaryLineEntityId`,
      sketchId: value.sketchId,
      expectedKind: "line",
      sketchEntityRefs,
      issues
    });
    validateSketchEntityReferenceForImport({
      entityId: secondaryLineEntityId,
      path: `${path}.secondaryLineEntityId`,
      label: `${label} sketch constraint secondaryLineEntityId`,
      sketchId: value.sketchId,
      expectedKind: "line",
      sketchEntityRefs,
      issues
    });
  }

  if (value.kind === "symmetry") {
    if (primaryTarget) {
      const primaryEntityRef = sketchEntityRefs.get(primaryTarget.entityId);

      if (!primaryEntityRef) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.primaryTarget.entityId`,
          "Symmetry sketch constraint primaryTarget must reference an existing sketch entity."
        );
      } else {
        if (primaryEntityRef.sketchId !== value.sketchId) {
          addProjectIssue(
            issues,
            "INVALID_SKETCH_CONSTRAINT",
            `${path}.primaryTarget.entityId`,
            "Symmetry sketch constraint primaryTarget must belong to the referenced sketch."
          );
        }

        if (
          !isSketchPointTargetSupportedForImport(
            primaryEntityRef.kind,
            primaryTarget
          )
        ) {
          addProjectIssue(
            issues,
            "INVALID_SKETCH_CONSTRAINT",
            `${path}.primaryTarget.role`,
            "Symmetry sketch constraint primaryTarget role is not supported for this entity."
          );
        }
      }
    }

    if (secondaryTarget) {
      const secondaryEntityRef = sketchEntityRefs.get(secondaryTarget.entityId);

      if (!secondaryEntityRef) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.secondaryTarget.entityId`,
          "Symmetry sketch constraint secondaryTarget must reference an existing sketch entity."
        );
      } else {
        if (secondaryEntityRef.sketchId !== value.sketchId) {
          addProjectIssue(
            issues,
            "INVALID_SKETCH_CONSTRAINT",
            `${path}.secondaryTarget.entityId`,
            "Symmetry sketch constraint secondaryTarget must belong to the referenced sketch."
          );
        }

        if (
          !isSketchPointTargetSupportedForImport(
            secondaryEntityRef.kind,
            secondaryTarget
          )
        ) {
          addProjectIssue(
            issues,
            "INVALID_SKETCH_CONSTRAINT",
            `${path}.secondaryTarget.role`,
            "Symmetry sketch constraint secondaryTarget role is not supported for this entity."
          );
        }
      }
    }

    validateSketchEntityReferenceForImport({
      entityId: symmetryLineEntityId,
      path: `${path}.symmetryLineEntityId`,
      label: "Symmetry sketch constraint symmetryLineEntityId",
      sketchId: value.sketchId,
      expectedKind: "line",
      sketchEntityRefs,
      issues
    });
  }

  if (
    typeof value.sketchId === "string" &&
    typeof entityId === "string" &&
    isSketchConstraintKind(value.kind) &&
    (value.kind === "horizontal" || value.kind === "vertical") &&
    entityRef?.kind === "line"
  ) {
    const targetKey = `${value.sketchId}\0orientation\0${entityId}`;
    const existing = seenSketchConstraintTargets.get(targetKey);

    if (existing) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.kind`,
        existing === value.kind
          ? "Line already has a duplicate orientation constraint."
          : "Line already has a conflicting orientation constraint."
      );
    } else {
      seenSketchConstraintTargets.set(targetKey, value.kind);
    }

    if (
      isRecord(entityRef.entity) &&
      isVec2(entityRef.entity.start) &&
      isVec2(entityRef.entity.end) &&
      getLineLength({
        id: entityId,
        kind: "line",
        start: entityRef.entity.start,
        end: entityRef.entity.end
      }) <= 0
    ) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.entityId`,
        "Line orientation constraint cannot target a zero-length line."
      );
    }

    if (
      isRecord(entityRef.entity) &&
      isVec2(entityRef.entity.start) &&
      isVec2(entityRef.entity.end)
    ) {
      const entity: Extract<SketchEntity, { readonly kind: "line" }> = {
        id: entityId,
        kind: "line",
        start: entityRef.entity.start,
        end: entityRef.entity.end
      };

      if (
        getLineLength(entity) > 0 &&
        !sketchConstraintMatchesLine(value.kind, entity)
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.kind`,
          `Saved line entity does not satisfy its ${value.kind} orientation constraint.`
        );
      }
    }
  }

  if (
    typeof value.sketchId === "string" &&
    value.kind === "fixed" &&
    target &&
    entityRef
  ) {
    const targetKey = `${value.sketchId}\0fixed\0${target.entityId}\0${target.role}`;
    const existing = seenSketchConstraintTargets.get(targetKey);

    if (existing) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.target`,
        "Sketch point target already has a duplicate fixed constraint."
      );
    } else {
      seenSketchConstraintTargets.set(targetKey, value.kind);
    }

    if (isVec2(value.coordinate)) {
      seenFixedSketchConstraintCoordinates.set(targetKey, [
        value.coordinate[0],
        value.coordinate[1]
      ]);

      for (const coincident of seenCoincidentConstraintTargets) {
        if (coincident.sketchId !== value.sketchId) {
          continue;
        }

        const targetKeyForCoincident = `${value.sketchId}\0fixed\0${target.entityId}\0${target.role}`;

        if (
          targetKeyForCoincident !==
            targetKeyForImportPointTarget(
              coincident.primaryTarget,
              value.sketchId
            ) &&
          targetKeyForCoincident !==
            targetKeyForImportPointTarget(
              coincident.secondaryTarget,
              value.sketchId
            )
        ) {
          continue;
        }

        const otherTarget = sketchPointTargetsEqual(
          target,
          coincident.primaryTarget
        )
          ? coincident.secondaryTarget
          : coincident.primaryTarget;
        const otherFixedCoordinate = seenFixedSketchConstraintCoordinates.get(
          targetKeyForImportPointTarget(otherTarget, value.sketchId)
        );

        if (
          otherFixedCoordinate &&
          !vec2Equal(otherFixedCoordinate, value.coordinate)
        ) {
          addProjectIssue(
            issues,
            "INVALID_SKETCH_CONSTRAINT",
            `${coincident.path}.secondaryTarget`,
            "Coincident sketch constraint cannot target points fixed to different coordinates."
          );
        }
      }
    }

    if (
      isRecord(entityRef.entity) &&
      isVec2(value.coordinate) &&
      isSketchPointTargetSupportedForImport(entityRef.kind, target)
    ) {
      const currentCoordinate = getImportSketchPointTargetCoordinate(
        entityRef.entity,
        target
      );

      if (
        currentCoordinate &&
        !vec2Equal(currentCoordinate, value.coordinate)
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.coordinate`,
          "Saved sketch entity does not satisfy its fixed point constraint."
        );
      }
    }
  }

  if (
    typeof value.sketchId === "string" &&
    value.kind === "coincident" &&
    primaryTarget &&
    secondaryTarget
  ) {
    const pairKey = `${value.sketchId}\0coincident\0${sketchPointTargetPairKey(
      primaryTarget,
      secondaryTarget
    )}`;
    const existing = seenSketchConstraintTargets.get(pairKey);

    if (existing) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.secondaryTarget`,
        "Sketch point targets already have a duplicate coincident constraint."
      );
    } else {
      seenSketchConstraintTargets.set(pairKey, value.kind);
    }

    seenCoincidentConstraintTargets.push({
      path,
      sketchId: value.sketchId,
      primaryTarget,
      secondaryTarget
    });

    const primaryFixedCoordinate = seenFixedSketchConstraintCoordinates.get(
      targetKeyForImportPointTarget(primaryTarget, value.sketchId)
    );
    const secondaryFixedCoordinate = seenFixedSketchConstraintCoordinates.get(
      targetKeyForImportPointTarget(secondaryTarget, value.sketchId)
    );

    if (
      primaryFixedCoordinate &&
      secondaryFixedCoordinate &&
      !vec2Equal(primaryFixedCoordinate, secondaryFixedCoordinate)
    ) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.secondaryTarget`,
        "Coincident sketch constraint cannot target points fixed to different coordinates."
      );
    }
  }

  if (
    typeof value.sketchId === "string" &&
    value.kind === "midpoint" &&
    lineEntityId &&
    target
  ) {
    const targetKey = `${value.sketchId}\0midpoint\0${lineEntityId}\0${target.entityId}\0${target.role}`;
    const existing = seenSketchConstraintTargets.get(targetKey);

    if (existing) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.target`,
        "Line and point target already have a duplicate midpoint constraint."
      );
    } else {
      seenSketchConstraintTargets.set(targetKey, value.kind);
    }

    if (
      lineEntityRef &&
      isRecord(lineEntityRef.entity) &&
      isVec2(lineEntityRef.entity.start) &&
      isVec2(lineEntityRef.entity.end)
    ) {
      const midpoint: Vec2 = [
        cleanMeasurementNumber(
          (lineEntityRef.entity.start[0] + lineEntityRef.entity.end[0]) / 2
        ),
        cleanMeasurementNumber(
          (lineEntityRef.entity.start[1] + lineEntityRef.entity.end[1]) / 2
        )
      ];
      const targetFixedCoordinate = seenFixedSketchConstraintCoordinates.get(
        targetKeyForImportPointTarget(target, value.sketchId)
      );

      if (
        targetFixedCoordinate &&
        !vec2Equal(targetFixedCoordinate, midpoint)
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.target`,
          "Midpoint sketch constraint cannot target a point fixed away from the line midpoint."
        );
      }
    }
  }

  if (
    typeof value.sketchId === "string" &&
    (value.kind === "parallel" || value.kind === "perpendicular") &&
    primaryLineEntityId &&
    secondaryLineEntityId
  ) {
    const label = value.kind === "parallel" ? "Parallel" : "Perpendicular";
    const targetKey = `${value.sketchId}\0linePair\0${primaryLineEntityId}\0${secondaryLineEntityId}`;
    const existing = seenSketchConstraintTargets.get(targetKey);

    if (existing) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.secondaryLineEntityId`,
        existing === value.kind
          ? `Line pair already has a duplicate ${value.kind} constraint.`
          : `Line pair already has a conflicting ${existing} constraint.`
      );
    } else {
      seenSketchConstraintTargets.set(targetKey, value.kind);
    }

    for (const [field, ref] of [
      ["primaryLineEntityId", primaryLineEntityRef],
      ["secondaryLineEntityId", secondaryLineEntityRef]
    ] as const) {
      if (
        ref &&
        ref.kind === "line" &&
        isRecord(ref.entity) &&
        isVec2(ref.entity.start) &&
        isVec2(ref.entity.end) &&
        getLineLength({
          id:
            field === "primaryLineEntityId"
              ? primaryLineEntityId
              : secondaryLineEntityId,
          kind: "line",
          start: ref.entity.start,
          end: ref.entity.end
        }) <= 0
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.${field}`,
          `${label} sketch constraint ${field === "primaryLineEntityId" ? "primary" : "secondary"} line cannot be zero-length.`
        );
      }
    }
  }

  return maxGeneratedSketchConstraintNumber;
}

function targetKeyForImportPointTarget(
  target: SketchPointTarget,
  sketchId: SketchId
): string {
  return `${sketchId}\0fixed\0${target.entityId}\0${target.role}`;
}

function validateSketchDimensionValueSourceSnapshot(
  value: unknown,
  path: string,
  seenParameterIds: ReadonlySet<string>,
  parameterValues: ReadonlyMap<ParameterId, number>,
  issues: CadProjectImportIssue[]
): number | undefined {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_DIMENSION",
      path,
      "Sketch dimension valueSource must be an object."
    );
    return undefined;
  }

  if (value.type === "literal") {
    if (
      typeof value.value !== "number" ||
      !isPositiveFiniteNumber(value.value)
    ) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_DIMENSION",
        `${path}.value`,
        "Sketch dimension value must be a positive finite number."
      );
      return undefined;
    }
    return cleanMeasurementNumber(value.value);
  }

  if (value.type === "parameter") {
    if (
      typeof value.parameterId !== "string" ||
      value.parameterId.length === 0
    ) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_DIMENSION",
        `${path}.parameterId`,
        "Sketch dimension parameterId must be a non-empty string."
      );
      return undefined;
    } else if (!seenParameterIds.has(value.parameterId)) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_DIMENSION",
        `${path}.parameterId`,
        "Sketch dimension parameterId must reference an existing parameter."
      );
      return undefined;
    } else {
      const parameterValue = parameterValues.get(value.parameterId);

      if (
        typeof parameterValue !== "number" ||
        !isPositiveFiniteNumber(parameterValue)
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_DIMENSION",
          `${path}.parameterId`,
          "Sketch dimension parameter value must be positive and finite."
        );
        return undefined;
      }
      return cleanMeasurementNumber(parameterValue);
    }
  }

  addProjectIssue(
    issues,
    "INVALID_SKETCH_DIMENSION",
    `${path}.type`,
    "Sketch dimension valueSource type must be literal or parameter."
  );
  return undefined;
}

function getImportedSketchDimensionTargetValue(
  entity: unknown,
  target: SketchDimensionTarget
): number | undefined {
  if (!isRecord(entity)) {
    return undefined;
  }

  if (target.entityKind === "rectangle") {
    const value = entity[target.role];
    return typeof value === "number" ? value : undefined;
  }

  if (target.entityKind === "circle") {
    return typeof entity.radius === "number" ? entity.radius : undefined;
  }

  if (isRecord(entity) && isVec2(entity.start) && isVec2(entity.end)) {
    return cleanMeasurementNumber(
      Math.hypot(
        entity.end[0] - entity.start[0],
        entity.end[1] - entity.start[1]
      )
    );
  }

  return undefined;
}

function collectValidExtrudeFeatureByBodyId(
  value: unknown,
  featuresByBodyId: Map<BodyId, ExtrudeFeatureSnapshot>
): void {
  if (
    isRecord(value) &&
    value.kind === "extrude" &&
    typeof value.id === "string" &&
    typeof value.sketchId === "string" &&
    typeof value.entityId === "string" &&
    (value.profileKind === "rectangle" || value.profileKind === "circle") &&
    typeof value.depth === "number" &&
    isPositiveFiniteNumber(value.depth) &&
    (value.side === undefined || isExtrudeSide(value.side)) &&
    (value.operationMode === undefined || value.operationMode === "newBody") &&
    value.targetBodyId === undefined &&
    value.targetTopologyAnchorId === undefined &&
    typeof value.bodyId === "string"
  ) {
    featuresByBodyId.set(value.bodyId, {
      id: value.id,
      kind: "extrude",
      name: typeof value.name === "string" ? value.name : undefined,
      sketchId: value.sketchId,
      entityId: value.entityId,
      profileKind: value.profileKind,
      depth: value.depth,
      side: value.side ?? "positive",
      operationMode: value.operationMode ?? "newBody",
      bodyId: value.bodyId
    });
  }
}

function collectValidAuthoredFeatureByBodyId(
  value: unknown,
  path: string,
  featuresByBodyId: Map<BodyId, FeatureSnapshot & { readonly path: string }>
): void {
  if (
    isRecord(value) &&
    value.kind === "extrude" &&
    typeof value.id === "string" &&
    typeof value.sketchId === "string" &&
    typeof value.entityId === "string" &&
    (value.profileKind === "rectangle" || value.profileKind === "circle") &&
    typeof value.depth === "number" &&
    isPositiveFiniteNumber(value.depth) &&
    (value.side === undefined || isExtrudeSide(value.side)) &&
    (value.operationMode === undefined ||
      isExtrudeOperationMode(value.operationMode)) &&
    (value.targetBodyId === undefined ||
      typeof value.targetBodyId === "string") &&
    (value.targetTopologyAnchorId === undefined ||
      typeof value.targetTopologyAnchorId === "string") &&
    typeof value.bodyId === "string"
  ) {
    featuresByBodyId.set(value.bodyId, {
      id: value.id,
      kind: "extrude",
      name: typeof value.name === "string" ? value.name : undefined,
      sketchId: value.sketchId,
      entityId: value.entityId,
      profileKind: value.profileKind,
      depth: value.depth,
      side: value.side ?? "positive",
      operationMode: value.operationMode ?? "newBody",
      targetBodyId: value.targetBodyId,
      targetTopologyAnchorId: value.targetTopologyAnchorId,
      bodyId: value.bodyId,
      path
    });
    return;
  }

  if (
    isRecord(value) &&
    value.kind === "revolve" &&
    typeof value.id === "string" &&
    typeof value.sketchId === "string" &&
    typeof value.entityId === "string" &&
    (value.profileKind === "rectangle" || value.profileKind === "circle") &&
    isFeatureRevolveAxis(value.axis) &&
    typeof value.angleDegrees === "number" &&
    isPositiveFiniteNumber(value.angleDegrees) &&
    value.angleDegrees <= 360 &&
    (value.operationMode === undefined || value.operationMode === "newBody") &&
    value.targetBodyId === undefined &&
    typeof value.bodyId === "string"
  ) {
    featuresByBodyId.set(value.bodyId, {
      id: value.id,
      kind: "revolve",
      name: typeof value.name === "string" ? value.name : undefined,
      sketchId: value.sketchId,
      entityId: value.entityId,
      profileKind: value.profileKind,
      axis: value.axis,
      angleDegrees: value.angleDegrees,
      operationMode: "newBody",
      bodyId: value.bodyId,
      path
    });
    return;
  }

  if (
    isRecord(value) &&
    value.kind === "hole" &&
    typeof value.id === "string" &&
    typeof value.targetBodyId === "string" &&
    (value.targetTopologyAnchorId === undefined ||
      typeof value.targetTopologyAnchorId === "string") &&
    typeof value.sketchId === "string" &&
    typeof value.circleEntityId === "string" &&
    (value.depthMode === "blind" || value.depthMode === "throughAll") &&
    (value.depthMode === "throughAll" ||
      (typeof value.depth === "number" &&
        isPositiveFiniteNumber(value.depth))) &&
    (value.depthMode !== "throughAll" || value.depth === undefined) &&
    (value.direction === "positive" || value.direction === "negative") &&
    typeof value.bodyId === "string"
  ) {
    featuresByBodyId.set(value.bodyId, {
      id: value.id,
      kind: "hole",
      name: typeof value.name === "string" ? value.name : undefined,
      targetBodyId: value.targetBodyId,
      targetTopologyAnchorId: value.targetTopologyAnchorId,
      sketchId: value.sketchId,
      circleEntityId: value.circleEntityId,
      depthMode: value.depthMode,
      ...(typeof value.depth === "number" ? { depth: value.depth } : {}),
      direction: value.direction,
      bodyId: value.bodyId,
      path
    });
    return;
  }

  if (
    isRecord(value) &&
    value.kind === "chamfer" &&
    typeof value.id === "string" &&
    typeof value.targetBodyId === "string" &&
    ((typeof value.edgeStableId === "string" &&
      value.namedReference === undefined) ||
      (typeof value.namedReference === "string" &&
        value.edgeStableId === undefined)) &&
    (value.topologyAnchorId === undefined ||
      typeof value.topologyAnchorId === "string") &&
    typeof value.distance === "number" &&
    isPositiveFiniteNumber(value.distance) &&
    typeof value.bodyId === "string"
  ) {
    featuresByBodyId.set(value.bodyId, {
      id: value.id,
      kind: "chamfer",
      name: typeof value.name === "string" ? value.name : undefined,
      targetBodyId: value.targetBodyId,
      ...(typeof value.edgeStableId === "string"
        ? { edgeStableId: value.edgeStableId }
        : {}),
      ...(typeof value.namedReference === "string"
        ? { namedReference: value.namedReference }
        : {}),
      ...(typeof value.topologyAnchorId === "string"
        ? { topologyAnchorId: value.topologyAnchorId }
        : {}),
      distance: value.distance,
      bodyId: value.bodyId,
      path
    });
    return;
  }

  if (
    isRecord(value) &&
    value.kind === "fillet" &&
    typeof value.id === "string" &&
    typeof value.targetBodyId === "string" &&
    ((typeof value.edgeStableId === "string" &&
      value.namedReference === undefined) ||
      (typeof value.namedReference === "string" &&
        value.edgeStableId === undefined)) &&
    (value.topologyAnchorId === undefined ||
      typeof value.topologyAnchorId === "string") &&
    typeof value.radius === "number" &&
    isPositiveFiniteNumber(value.radius) &&
    typeof value.bodyId === "string"
  ) {
    featuresByBodyId.set(value.bodyId, {
      id: value.id,
      kind: "fillet",
      name: typeof value.name === "string" ? value.name : undefined,
      targetBodyId: value.targetBodyId,
      ...(typeof value.edgeStableId === "string"
        ? { edgeStableId: value.edgeStableId }
        : {}),
      ...(typeof value.namedReference === "string"
        ? { namedReference: value.namedReference }
        : {}),
      ...(typeof value.topologyAnchorId === "string"
        ? { topologyAnchorId: value.topologyAnchorId }
        : {}),
      radius: value.radius,
      bodyId: value.bodyId,
      path
    });
  }
}

function validateFeatureTargetBodyReferences(
  featuresByBodyId: ReadonlyMap<
    BodyId,
    FeatureSnapshot & { readonly path: string }
  >,
  issues: CadProjectImportIssue[]
): void {
  for (const feature of featuresByBodyId.values()) {
    const targetBodyId = getImportFeatureTargetBodyId(feature);

    if (!targetBodyId) {
      continue;
    }

    const target = featuresByBodyId.get(targetBodyId);

    if (!target) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${feature.path}.targetBodyId`,
        `${formatTargetConsumingFeatureForIssue(feature)} targetBodyId must reference an existing authored body.`
      );
      continue;
    }

    if (target.id === feature.id) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${feature.path}.targetBodyId`,
        `${formatTargetConsumingFeatureForIssue(feature)} targetBodyId must not reference its own result body.`
      );
      continue;
    }

    const consumedBy = [...featuresByBodyId.values()].find(
      (candidate) =>
        candidate.id !== feature.id &&
        isImportTargetConsumingFeature(candidate) &&
        getImportFeatureTargetBodyId(candidate) === targetBodyId
    );

    if (consumedBy) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${feature.path}.targetBodyId`,
        `${formatTargetConsumingFeatureForIssue(feature)} targetBodyId must reference an active authored body that is not already consumed by another feature.`
      );
      continue;
    }

    if (
      feature.kind === "extrude" &&
      (!isExtrudeFeatureSnapshot(target) ||
        !isSupportedBooleanExtrudeCombination(
          featuresByBodyId,
          feature,
          target
        ))
    ) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${feature.path}.operationMode`,
        getUnsupportedBooleanExtrudeMessage(feature.operationMode ?? "newBody")
      );
    }

    if (
      feature.kind === "hole" &&
      (!isExtrudeFeatureSnapshot(target) ||
        !isSupportedImportHoleTargetCombination(
          featuresByBodyId,
          feature,
          target
        ))
    ) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${feature.path}.targetBodyId`,
        "Hole features currently support circular tools cutting one active rectangle, circle, or topology-backed result target body."
      );
    }

    if (
      (feature.kind === "chamfer" || feature.kind === "fillet") &&
      (!isExtrudeFeatureSnapshot(target) ||
        target.operationMode !== "newBody" ||
        !isSupportedCutTargetProfileKind(target.profileKind))
    ) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${feature.path}.targetBodyId`,
        `${formatTargetConsumingFeatureForIssue(feature)} currently supports one stable generated edge on an active rectangle or circle newBody extrude target body.`
      );
    }
  }
}

function isSupportedImportHoleTargetCombination(
  featuresByBodyId: ReadonlyMap<
    BodyId,
    FeatureSnapshot & { readonly path: string }
  >,
  feature: HoleFeatureSnapshot,
  target: ExtrudeFeatureSnapshot
): boolean {
  const targetProfileKind = resolveImportBooleanTargetProfileKind(
    featuresByBodyId,
    target,
    feature.targetTopologyAnchorId
  );

  return (
    targetProfileKind !== undefined &&
    isSupportedCutTargetProfileKind(targetProfileKind)
  );
}

function isImportTargetConsumingFeature(feature: FeatureSnapshot): boolean {
  return (
    (feature.kind === "extrude" &&
      isConsumingExtrudeOperationMode(feature.operationMode ?? "newBody") &&
      typeof feature.targetBodyId === "string" &&
      feature.targetBodyId.length > 0) ||
    feature.kind === "hole" ||
    feature.kind === "chamfer" ||
    feature.kind === "fillet"
  );
}

function getImportFeatureTargetBodyId(
  feature: FeatureSnapshot
): BodyId | undefined {
  return isImportTargetConsumingFeature(feature)
    ? feature.kind === "hole"
      ? feature.targetBodyId
      : feature.targetBodyId
    : undefined;
}

function isExtrudeFeatureSnapshot(
  feature: FeatureSnapshot
): feature is ExtrudeFeatureSnapshot {
  return feature.kind === "extrude";
}

function isSupportedBooleanExtrudeCombination(
  featuresByBodyId: ReadonlyMap<
    BodyId,
    FeatureSnapshot & { readonly path: string }
  >,
  feature: ExtrudeFeatureSnapshot,
  target: ExtrudeFeatureSnapshot
): boolean {
  if (!isSupportedBooleanToolProfileKind(feature.profileKind)) {
    return false;
  }

  const operationMode = feature.operationMode ?? "newBody";
  const targetProfileKind = resolveImportBooleanTargetProfileKind(
    featuresByBodyId,
    target,
    feature.targetTopologyAnchorId
  );

  if (targetProfileKind === undefined) {
    return false;
  }

  if (operationMode === "add") {
    return isSupportedAddTargetProfileKind(targetProfileKind);
  }

  if (operationMode === "cut") {
    return isSupportedCutTargetProfileKind(targetProfileKind);
  }

  return false;
}

function resolveImportBooleanTargetProfileKind(
  featuresByBodyId: ReadonlyMap<
    BodyId,
    FeatureSnapshot & { readonly path: string }
  >,
  target: ExtrudeFeatureSnapshot,
  targetTopologyAnchorId?: string
): FeatureExtrudeProfileKind | undefined {
  if ((target.operationMode ?? "newBody") === "newBody") {
    return target.profileKind;
  }

  if (targetTopologyAnchorId === undefined) {
    return undefined;
  }

  let current: ExtrudeFeatureSnapshot | undefined = target;
  const visitedFeatureIds = new Set<FeatureId>();

  while (current && !visitedFeatureIds.has(current.id)) {
    visitedFeatureIds.add(current.id);

    if ((current.operationMode ?? "newBody") === "newBody") {
      return current.profileKind;
    }

    if (
      current.targetTopologyAnchorId !== targetTopologyAnchorId ||
      current.targetBodyId === undefined
    ) {
      return undefined;
    }

    const parent = featuresByBodyId.get(current.targetBodyId);
    current = parent && isExtrudeFeatureSnapshot(parent) ? parent : undefined;
  }

  return undefined;
}

function getUnsupportedBooleanExtrudeMessage(
  operationMode: FeatureExtrudeOperationMode
): string {
  if (operationMode === "add") {
    return "Add extrudes currently support rectangle tools fusing with one active rectangle source or topology-backed result target body.";
  }

  return "Cut extrudes currently support rectangle tools cutting one active rectangle, circle, or topology-backed result target body.";
}

function formatTargetConsumingFeatureForIssue(
  feature: FeatureSnapshot
): string {
  if (feature.kind === "hole") {
    return "Hole feature";
  }

  if (feature.kind === "chamfer") {
    return "Chamfer feature";
  }

  if (feature.kind === "fillet") {
    return "Fillet feature";
  }

  if (
    feature.kind === "extrude" &&
    isConsumingExtrudeOperationMode(feature.operationMode ?? "newBody")
  ) {
    return `${formatExtrudeOperationModeForIssue(
      feature.operationMode ?? "newBody"
    )} extrude`;
  }

  return "Consuming feature";
}

function formatExtrudeOperationModeForIssue(
  operationMode: FeatureExtrudeOperationMode
): string {
  return operationMode === "add" ? "Add" : "Cut";
}

function validateSketchAttachments(
  attachments: readonly {
    readonly path: string;
    readonly attachment: SketchAttachmentSnapshot;
  }[],
  featuresByBodyId: ReadonlyMap<BodyId, ExtrudeFeatureSnapshot>,
  issues: CadProjectImportIssue[]
): void {
  for (const { path, attachment } of attachments) {
    if (attachment.kind === "topologyAnchorFace") {
      continue;
    }

    const feature = featuresByBodyId.get(attachment.bodyId);
    const expectedStableId = `generated:face:${attachment.bodyId}:${attachment.faceRole}`;

    if (attachment.faceStableId !== expectedStableId) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH",
        `${path}.faceStableId`,
        "Sketch attachment faceStableId must match the referenced generated face role."
      );
    }

    if (!feature) {
      continue;
    }

    if (attachment.sourceFeatureId !== feature.id) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH",
        `${path}.sourceFeatureId`,
        "Sketch attachment sourceFeatureId must match the referenced body feature."
      );
    }

    if (attachment.sourceSketchId !== feature.sketchId) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH",
        `${path}.sourceSketchId`,
        "Sketch attachment sourceSketchId must match the referenced body feature."
      );
    }

    if (attachment.sourceSketchEntityId !== feature.entityId) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH",
        `${path}.sourceSketchEntityId`,
        "Sketch attachment sourceSketchEntityId must match the referenced body feature."
      );
    }
  }
}

function validateSketchEntitySnapshot(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[],
  seenSketchEntityIds: Set<string>
): number {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_ENTITY",
      path,
      "Sketch entity must be an object."
    );
    return 0;
  }

  let maxGeneratedSketchEntityNumber = 0;

  if (typeof value.id !== "string" || value.id.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_ENTITY",
      `${path}.id`,
      "Sketch entity id must be a non-empty string."
    );
  } else if (seenSketchEntityIds.has(value.id)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_ENTITY",
      `${path}.id`,
      `Duplicate sketch entity id: ${value.id}.`
    );
  } else {
    seenSketchEntityIds.add(value.id);
    maxGeneratedSketchEntityNumber = parseSketchEntityNumber(value.id);
  }

  if (value.kind === "point") {
    validateVec2Field(value.point, `${path}.point`, issues);
  } else if (value.kind === "line") {
    validateVec2Field(value.start, `${path}.start`, issues);
    validateVec2Field(value.end, `${path}.end`, issues);
  } else if (value.kind === "rectangle") {
    validateVec2Field(value.center, `${path}.center`, issues);
    validatePositiveFiniteField(
      value.width,
      `${path}.width`,
      "Rectangle width",
      issues
    );
    validatePositiveFiniteField(
      value.height,
      `${path}.height`,
      "Rectangle height",
      issues
    );
  } else if (value.kind === "circle") {
    validateVec2Field(value.center, `${path}.center`, issues);
    validatePositiveFiniteField(
      value.radius,
      `${path}.radius`,
      "Circle radius",
      issues
    );
  } else {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_ENTITY",
      `${path}.kind`,
      "Sketch entity kind must be point, line, rectangle, or circle."
    );
  }

  return maxGeneratedSketchEntityNumber;
}

function collectSketchEntityRefs(
  value: unknown,
  output: Map<SketchEntityId, SketchEntityImportRef>
): void {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !Array.isArray(value.entities)
  ) {
    return;
  }

  for (const entity of value.entities) {
    if (
      isRecord(entity) &&
      typeof entity.id === "string" &&
      isSketchEntityKind(entity.kind)
    ) {
      output.set(entity.id, {
        sketchId: value.id,
        kind: entity.kind,
        entity
      });
    }
  }
}

function validateNamedReferenceSnapshots(
  values: readonly unknown[],
  path: string,
  issues: CadProjectImportIssue[]
): Map<NamedReferenceName, NamedGeneratedReferenceSnapshot> {
  const seenNames = new Set<NamedReferenceName>();
  const references = new Map<
    NamedReferenceName,
    NamedGeneratedReferenceSnapshot
  >();

  for (const [index, value] of values.entries()) {
    const referencePath = `${path}[${index}]`;

    if (!isRecord(value)) {
      addProjectIssue(
        issues,
        "INVALID_NAMED_REFERENCE",
        referencePath,
        "Named reference must be an object."
      );
      continue;
    }

    const rawName = typeof value.name === "string" ? value.name : undefined;
    const name = rawName?.trim();
    const bodyId = typeof value.bodyId === "string" ? value.bodyId : undefined;
    const stableId =
      typeof value.stableId === "string" ? value.stableId : undefined;
    const kind = isGeneratedEntityKind(value.kind) ? value.kind : undefined;
    const topologyAnchorId =
      typeof value.topologyAnchorId === "string"
        ? value.topologyAnchorId
        : undefined;

    if (!name) {
      addProjectIssue(
        issues,
        "INVALID_NAMED_REFERENCE",
        `${referencePath}.name`,
        "Named reference name must be a non-empty string."
      );
    } else if (rawName !== name) {
      addProjectIssue(
        issues,
        "INVALID_NAMED_REFERENCE",
        `${referencePath}.name`,
        "Named reference name must not include leading or trailing whitespace."
      );
    } else if (seenNames.has(name)) {
      addProjectIssue(
        issues,
        "INVALID_NAMED_REFERENCE",
        `${referencePath}.name`,
        `Duplicate named reference: ${name}.`
      );
    } else {
      seenNames.add(name);
    }

    if (!bodyId) {
      addProjectIssue(
        issues,
        "INVALID_NAMED_REFERENCE",
        `${referencePath}.bodyId`,
        "Named reference bodyId must be a non-empty string."
      );
    }

    if (!stableId) {
      addProjectIssue(
        issues,
        "INVALID_NAMED_REFERENCE",
        `${referencePath}.stableId`,
        "Named reference stableId must be a non-empty string."
      );
    }

    if (!kind) {
      addProjectIssue(
        issues,
        "INVALID_NAMED_REFERENCE",
        `${referencePath}.kind`,
        "Named reference kind must be body, face, edge, or vertex."
      );
    }

    if (value.topologyAnchorId !== undefined) {
      if (typeof value.topologyAnchorId !== "string") {
        addProjectIssue(
          issues,
          "INVALID_NAMED_REFERENCE",
          `${referencePath}.topologyAnchorId`,
          "Named reference topologyAnchorId must be a string."
        );
      } else if (value.topologyAnchorId.trim() === "") {
        addProjectIssue(
          issues,
          "INVALID_NAMED_REFERENCE",
          `${referencePath}.topologyAnchorId`,
          "Named reference topologyAnchorId must be a non-empty string."
        );
      }
    }

    if (!name || !bodyId || !stableId || !kind) {
      continue;
    }

    if (!isGeneratedStableIdShapeForKind(bodyId, stableId, kind)) {
      addProjectIssue(
        issues,
        "INVALID_NAMED_REFERENCE",
        `${referencePath}.stableId`,
        "Named reference stableId must match the stored generated reference kind and bodyId."
      );
      continue;
    }

    references.set(name, {
      name,
      bodyId,
      stableId,
      kind,
      ...(topologyAnchorId ? { topologyAnchorId } : {})
    });
  }

  return references;
}

function validateEdgeFinishNamedReferenceSnapshots(
  featuresByBodyId: ReadonlyMap<
    BodyId,
    FeatureSnapshot & { readonly path: string }
  >,
  namedReferencesByName: ReadonlyMap<
    NamedReferenceName,
    NamedGeneratedReferenceSnapshot
  >,
  issues: CadProjectImportIssue[]
): void {
  for (const feature of featuresByBodyId.values()) {
    if (feature.kind !== "chamfer" && feature.kind !== "fillet") {
      continue;
    }

    if (!feature.namedReference) {
      continue;
    }

    const reference = namedReferencesByName.get(feature.namedReference);

    if (!reference) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${feature.path}.namedReference`,
        `${formatTargetConsumingFeatureForIssue(feature)} namedReference must reference an existing named generated edge.`
      );
      continue;
    }

    if (reference.kind !== "edge") {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${feature.path}.namedReference`,
        `${formatTargetConsumingFeatureForIssue(feature)} namedReference must resolve to an edge.`
      );
    }

    if (reference.bodyId !== feature.targetBodyId) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${feature.path}.namedReference`,
        `${formatTargetConsumingFeatureForIssue(feature)} namedReference must resolve to the target body.`
      );
    }
  }
}

function validateFeatureSnapshot(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[],
  seenFeatureIds: Set<string>,
  seenBodyIds: Set<string>,
  seenSketchIds: ReadonlySet<string>,
  sketchEntityRefs: ReadonlyMap<SketchEntityId, SketchEntityImportRef>,
  allowsRevolveFeatures: boolean,
  allowsHoleFeatures: boolean,
  allowsEdgeFinishFeatures: boolean
): {
  readonly maxGeneratedFeatureNumber: number;
  readonly maxGeneratedBodyNumber: number;
} {
  let maxGeneratedFeatureNumber = 0;
  let maxGeneratedBodyNumber = 0;

  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      path,
      "Feature must be an object."
    );
    return { maxGeneratedFeatureNumber, maxGeneratedBodyNumber };
  }

  if (typeof value.id !== "string" || value.id.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.id`,
      "Feature id must be a non-empty string."
    );
  } else if (seenFeatureIds.has(value.id)) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.id`,
      `Duplicate feature id: ${value.id}.`
    );
  } else {
    seenFeatureIds.add(value.id);
    maxGeneratedFeatureNumber = parseFeatureNumber(value.id);
  }

  if (
    value.kind !== "extrude" &&
    (value.kind !== "revolve" || !allowsRevolveFeatures) &&
    (value.kind !== "hole" || !allowsHoleFeatures) &&
    ((value.kind !== "chamfer" && value.kind !== "fillet") ||
      !allowsEdgeFinishFeatures)
  ) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.kind`,
      allowsEdgeFinishFeatures
        ? "Feature kind must be extrude, revolve, hole, chamfer, or fillet."
        : allowsHoleFeatures
          ? "Feature kind must be extrude, revolve, or hole."
          : allowsRevolveFeatures
            ? "Feature kind must be extrude or revolve."
            : "Feature kind must be extrude."
    );
  }

  validateOptionalFeatureName(value.name, `${path}.name`, issues);

  if (value.kind === "revolve") {
    if (!allowsRevolveFeatures) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.kind`,
        "Revolve features require web-cad.project.v14."
      );
    }

    validateRevolveFeatureSnapshotFields(
      value,
      path,
      issues,
      seenBodyIds,
      seenSketchIds,
      sketchEntityRefs
    );

    if (typeof value.bodyId === "string") {
      maxGeneratedBodyNumber = parseBodyNumber(value.bodyId);
    }

    return { maxGeneratedFeatureNumber, maxGeneratedBodyNumber };
  }

  if (value.kind === "hole") {
    if (!allowsHoleFeatures) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.kind`,
        "Hole features require web-cad.project.v15."
      );
    }

    validateHoleFeatureSnapshotFields(
      value,
      path,
      issues,
      seenBodyIds,
      seenSketchIds,
      sketchEntityRefs
    );

    if (typeof value.bodyId === "string") {
      maxGeneratedBodyNumber = parseBodyNumber(value.bodyId);
    }

    return { maxGeneratedFeatureNumber, maxGeneratedBodyNumber };
  }

  if (value.kind === "chamfer" || value.kind === "fillet") {
    if (!allowsEdgeFinishFeatures) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.kind`,
        "Chamfer and fillet features require web-cad.project.v16."
      );
    }

    validateEdgeFinishFeatureSnapshotFields(value, path, issues, seenBodyIds);

    if (typeof value.bodyId === "string") {
      maxGeneratedBodyNumber = parseBodyNumber(value.bodyId);
    }

    return { maxGeneratedFeatureNumber, maxGeneratedBodyNumber };
  }

  if (typeof value.sketchId !== "string" || value.sketchId.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.sketchId`,
      "Extrude feature sketchId must be a non-empty string."
    );
  } else if (!seenSketchIds.has(value.sketchId)) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.sketchId`,
      "Extrude feature sketchId must reference an existing sketch."
    );
  }

  if (typeof value.entityId !== "string" || value.entityId.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.entityId`,
      "Extrude feature entityId must be a non-empty string."
    );
  } else if (!sketchEntityRefs.has(value.entityId)) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.entityId`,
      "Extrude feature entityId must reference an existing sketch entity."
    );
  } else {
    const referencedEntity = sketchEntityRefs.get(value.entityId);

    if (referencedEntity && referencedEntity.sketchId !== value.sketchId) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.entityId`,
        "Extrude feature entityId must belong to the referenced sketch."
      );
    }

    if (
      referencedEntity &&
      referencedEntity.kind !== "rectangle" &&
      referencedEntity.kind !== "circle"
    ) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.entityId`,
        "Extrude feature entityId must reference a rectangle or circle sketch entity."
      );
    }
  }

  if (value.profileKind !== "rectangle" && value.profileKind !== "circle") {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.profileKind`,
      "Extrude feature profileKind must be rectangle or circle."
    );
  } else if (
    typeof value.entityId === "string" &&
    sketchEntityRefs.has(value.entityId) &&
    sketchEntityRefs.get(value.entityId)?.kind !== value.profileKind
  ) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.profileKind`,
      "Extrude feature profileKind must match the referenced sketch entity kind."
    );
  }

  validatePositiveFiniteField(
    value.depth,
    `${path}.depth`,
    "Extrude depth",
    issues
  );

  if (value.side !== undefined && !isExtrudeSide(value.side)) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.side`,
      "Extrude feature side must be positive, negative, or symmetric."
    );
  }

  if (
    value.operationMode !== undefined &&
    !isExtrudeOperationMode(value.operationMode)
  ) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.operationMode`,
      "Extrude feature operationMode must be newBody, add, or cut."
    );
  }

  if (value.targetBodyId !== undefined) {
    if (typeof value.targetBodyId !== "string" || value.targetBodyId === "") {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.targetBodyId`,
        "Extrude feature targetBodyId must be a non-empty string when present."
      );
    }

    if (
      value.operationMode === undefined ||
      value.operationMode === "newBody"
    ) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.targetBodyId`,
        "newBody extrude features must not include targetBodyId."
      );
    }
  } else if (value.operationMode === "add" || value.operationMode === "cut") {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.targetBodyId`,
      `Extrude operationMode ${value.operationMode} requires targetBodyId.`
    );
  }

  if (value.targetTopologyAnchorId !== undefined) {
    if (
      typeof value.targetTopologyAnchorId !== "string" ||
      value.targetTopologyAnchorId === ""
    ) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.targetTopologyAnchorId`,
        "Extrude feature targetTopologyAnchorId must be a non-empty string when present."
      );
    }

    if (
      value.operationMode === undefined ||
      value.operationMode === "newBody"
    ) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.targetTopologyAnchorId`,
        "newBody extrude features must not include targetTopologyAnchorId."
      );
    }

    if (value.targetBodyId === undefined) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.targetTopologyAnchorId`,
        "Persisted topology-anchor extrude targets must include the resolved targetBodyId."
      );
    }
  }

  if (typeof value.bodyId !== "string" || value.bodyId.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.bodyId`,
      "Extrude feature bodyId must be a non-empty string."
    );
  } else if (seenBodyIds.has(value.bodyId)) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.bodyId`,
      `Duplicate body id: ${value.bodyId}.`
    );
  } else {
    seenBodyIds.add(value.bodyId);
    maxGeneratedBodyNumber = parseBodyNumber(value.bodyId);
  }

  return { maxGeneratedFeatureNumber, maxGeneratedBodyNumber };
}

function validateRevolveFeatureSnapshotFields(
  value: Record<string, unknown>,
  path: string,
  issues: CadProjectImportIssue[],
  seenBodyIds: Set<string>,
  seenSketchIds: ReadonlySet<string>,
  sketchEntityRefs: ReadonlyMap<SketchEntityId, SketchEntityImportRef>
): void {
  if (typeof value.sketchId !== "string" || value.sketchId.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.sketchId`,
      "Revolve feature sketchId must be a non-empty string."
    );
  } else if (!seenSketchIds.has(value.sketchId)) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.sketchId`,
      "Revolve feature sketchId must reference an existing sketch."
    );
  }

  if (typeof value.entityId !== "string" || value.entityId.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.entityId`,
      "Revolve feature entityId must be a non-empty string."
    );
  } else if (!sketchEntityRefs.has(value.entityId)) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.entityId`,
      "Revolve feature entityId must reference an existing sketch entity."
    );
  } else {
    const referencedEntity = sketchEntityRefs.get(value.entityId);

    if (referencedEntity && referencedEntity.sketchId !== value.sketchId) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.entityId`,
        "Revolve feature entityId must belong to the referenced sketch."
      );
    }

    if (
      referencedEntity &&
      referencedEntity.kind !== "rectangle" &&
      referencedEntity.kind !== "circle"
    ) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.entityId`,
        "Revolve feature entityId must reference a rectangle or circle sketch entity."
      );
    }
  }

  if (value.profileKind !== "rectangle" && value.profileKind !== "circle") {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.profileKind`,
      "Revolve feature profileKind must be rectangle or circle."
    );
  } else if (
    typeof value.entityId === "string" &&
    sketchEntityRefs.has(value.entityId) &&
    sketchEntityRefs.get(value.entityId)?.kind !== value.profileKind
  ) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.profileKind`,
      "Revolve feature profileKind must match the referenced sketch entity kind."
    );
  }

  validateRevolveAxisSnapshot(
    value.axis,
    `${path}.axis`,
    value.sketchId,
    issues,
    sketchEntityRefs
  );

  if (
    typeof value.angleDegrees !== "number" ||
    !isPositiveFiniteNumber(value.angleDegrees) ||
    value.angleDegrees > 360
  ) {
    addProjectIssue(
      issues,
      "INVALID_DIMENSIONS",
      `${path}.angleDegrees`,
      "Revolve angleDegrees must be a positive finite number <= 360."
    );
  }

  if (
    value.operationMode !== undefined &&
    !isRevolveOperationMode(value.operationMode)
  ) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.operationMode`,
      "Revolve feature operationMode must be newBody, add, or cut."
    );
  } else if (value.operationMode === "add" || value.operationMode === "cut") {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.operationMode`,
      "Revolve feature operationMode currently supports newBody only."
    );
  }

  if (value.targetBodyId !== undefined) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.targetBodyId`,
      "newBody revolve features must not include targetBodyId."
    );
  }

  if (typeof value.bodyId !== "string" || value.bodyId.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.bodyId`,
      "Revolve feature bodyId must be a non-empty string."
    );
  } else if (seenBodyIds.has(value.bodyId)) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.bodyId`,
      `Duplicate body id: ${value.bodyId}.`
    );
  } else {
    seenBodyIds.add(value.bodyId);
  }
}

function validateHoleFeatureSnapshotFields(
  value: Record<string, unknown>,
  path: string,
  issues: CadProjectImportIssue[],
  seenBodyIds: Set<string>,
  seenSketchIds: ReadonlySet<string>,
  sketchEntityRefs: ReadonlyMap<SketchEntityId, SketchEntityImportRef>
): void {
  if (
    typeof value.targetBodyId !== "string" ||
    value.targetBodyId.length === 0
  ) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.targetBodyId`,
      "Hole feature targetBodyId must be a non-empty string."
    );
  }

  if (value.targetTopologyAnchorId !== undefined) {
    if (
      typeof value.targetTopologyAnchorId !== "string" ||
      value.targetTopologyAnchorId === ""
    ) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.targetTopologyAnchorId`,
        "Hole feature targetTopologyAnchorId must be a non-empty string when present."
      );
    }
  }

  if (typeof value.sketchId !== "string" || value.sketchId.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.sketchId`,
      "Hole feature sketchId must be a non-empty string."
    );
  } else if (!seenSketchIds.has(value.sketchId)) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.sketchId`,
      "Hole feature sketchId must reference an existing sketch."
    );
  }

  if (
    typeof value.circleEntityId !== "string" ||
    value.circleEntityId.length === 0
  ) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.circleEntityId`,
      "Hole feature circleEntityId must be a non-empty string."
    );
  } else if (!sketchEntityRefs.has(value.circleEntityId)) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.circleEntityId`,
      "Hole feature circleEntityId must reference an existing sketch entity."
    );
  } else {
    const referencedEntity = sketchEntityRefs.get(value.circleEntityId);

    if (referencedEntity && referencedEntity.sketchId !== value.sketchId) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.circleEntityId`,
        "Hole feature circleEntityId must belong to the referenced sketch."
      );
    }

    if (referencedEntity && referencedEntity.kind !== "circle") {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.circleEntityId`,
        "Hole feature circleEntityId must reference a circle sketch entity."
      );
    }
  }

  if (value.depthMode !== "blind" && value.depthMode !== "throughAll") {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.depthMode`,
      "Hole feature depthMode must be blind or throughAll."
    );
  }

  if (value.depthMode === "blind") {
    validatePositiveFiniteField(
      value.depth,
      `${path}.depth`,
      "Blind hole depth",
      issues
    );
  } else if (value.depth !== undefined) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.depth`,
      "throughAll hole features must not include depth."
    );
  }

  if (value.direction !== "positive" && value.direction !== "negative") {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.direction`,
      "Hole feature direction must be positive or negative."
    );
  }

  if (typeof value.bodyId !== "string" || value.bodyId.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.bodyId`,
      "Hole feature bodyId must be a non-empty string."
    );
  } else if (seenBodyIds.has(value.bodyId)) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.bodyId`,
      `Duplicate body id: ${value.bodyId}.`
    );
  } else {
    seenBodyIds.add(value.bodyId);
  }
}

function validateEdgeFinishFeatureSnapshotFields(
  value: Record<string, unknown>,
  path: string,
  issues: CadProjectImportIssue[],
  seenBodyIds: Set<string>
): void {
  const label = value.kind === "chamfer" ? "Chamfer" : "Fillet";
  const scalarField = value.kind === "chamfer" ? "distance" : "radius";
  const scalarLabel =
    value.kind === "chamfer" ? "Chamfer distance" : "Fillet radius";

  if (
    typeof value.targetBodyId !== "string" ||
    value.targetBodyId.length === 0
  ) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.targetBodyId`,
      `${label} feature targetBodyId must be a non-empty string.`
    );
  }

  const edgeStableId =
    typeof value.edgeStableId === "string" ? value.edgeStableId : undefined;
  const namedReference =
    typeof value.namedReference === "string" ? value.namedReference : undefined;
  const topologyAnchorId =
    typeof value.topologyAnchorId === "string"
      ? value.topologyAnchorId
      : undefined;
  const hasEdgeStableId = edgeStableId !== undefined;
  const hasNamedReference = namedReference !== undefined;

  if (hasEdgeStableId === hasNamedReference) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.edgeStableId`,
      `${label} feature requires exactly one edgeStableId or namedReference.`
    );
  }

  if (hasEdgeStableId) {
    if (edgeStableId === "") {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.edgeStableId`,
        `${label} feature edgeStableId must be a non-empty string.`
      );
    } else if (
      typeof value.targetBodyId === "string" &&
      value.targetBodyId.length > 0 &&
      !isGeneratedStableIdShapeForKind(value.targetBodyId, edgeStableId, "edge")
    ) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.edgeStableId`,
        `${label} feature edgeStableId must be an edge generated by targetBodyId.`
      );
    }
  }

  if (hasNamedReference) {
    if (namedReference.trim() === "") {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.namedReference`,
        `${label} feature namedReference must be a non-empty string.`
      );
    }
  }

  if (value.topologyAnchorId !== undefined) {
    if (typeof value.topologyAnchorId !== "string") {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.topologyAnchorId`,
        `${label} feature topologyAnchorId must be a string.`
      );
    } else if (!topologyAnchorId || topologyAnchorId.trim() === "") {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.topologyAnchorId`,
        `${label} feature topologyAnchorId must be a non-empty string.`
      );
    }
  }

  validatePositiveFiniteField(
    value[scalarField],
    `${path}.${scalarField}`,
    scalarLabel,
    issues
  );

  if (typeof value.bodyId !== "string" || value.bodyId.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.bodyId`,
      `${label} feature bodyId must be a non-empty string.`
    );
  } else if (seenBodyIds.has(value.bodyId)) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.bodyId`,
      `Duplicate body id: ${value.bodyId}.`
    );
  } else {
    seenBodyIds.add(value.bodyId);
  }
}

function validateRevolveAxisSnapshot(
  value: unknown,
  path: string,
  sketchId: unknown,
  issues: CadProjectImportIssue[],
  sketchEntityRefs: ReadonlyMap<SketchEntityId, SketchEntityImportRef>
): void {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      path,
      "Revolve axis must be an object."
    );
    return;
  }

  if (value.type !== "sketchLine") {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.type`,
      "Revolve axis type must be sketchLine."
    );
  }

  if (typeof value.sketchId !== "string" || value.sketchId.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.sketchId`,
      "Revolve axis sketchId must be a non-empty string."
    );
  } else if (value.sketchId !== sketchId) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.sketchId`,
      "Revolve axis sketchId must match the feature sketchId."
    );
  }

  if (typeof value.entityId !== "string" || value.entityId.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.entityId`,
      "Revolve axis entityId must be a non-empty string."
    );
    return;
  }

  const axisRef = sketchEntityRefs.get(value.entityId);

  if (!axisRef) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.entityId`,
      "Revolve axis entityId must reference an existing sketch entity."
    );
    return;
  }

  if (axisRef.sketchId !== sketchId) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.entityId`,
      "Revolve axis entityId must belong to the feature sketch."
    );
  }

  if (axisRef.kind !== "line") {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.entityId`,
      "Revolve axis entityId must reference a line sketch entity."
    );
    return;
  }

  if (
    isRecord(axisRef.entity) &&
    isVec2(axisRef.entity.start) &&
    isVec2(axisRef.entity.end) &&
    getLineLength({
      id: value.entityId,
      kind: "line",
      start: axisRef.entity.start,
      end: axisRef.entity.end
    }) <= 0
  ) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.entityId`,
      "Revolve axis line must have non-zero length."
    );
  }
}

function validateOptionalFeatureName(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "string" || value.trim() === "") {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      path,
      "Feature name must be a non-empty string when present."
    );
  }
}

function validateOptionalObjectName(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "string" || value.trim() === "") {
    addProjectIssue(
      issues,
      "INVALID_OBJECT_NAME",
      path,
      "Object name must be a non-empty string when present."
    );
  }
}

function validateBoxDimensionsShape(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): void {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_DIMENSIONS",
      path,
      "Box dimensions must be an object."
    );
    return;
  }

  validatePositiveFiniteField(
    value.width,
    `${path}.width`,
    "Box width",
    issues
  );
  validatePositiveFiniteField(
    value.height,
    `${path}.height`,
    "Box height",
    issues
  );
  validatePositiveFiniteField(
    value.depth,
    `${path}.depth`,
    "Box depth",
    issues
  );
}

function validateCylinderDimensionsShape(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): void {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_DIMENSIONS",
      path,
      "Cylinder dimensions must be an object."
    );
    return;
  }

  validatePositiveFiniteField(
    value.radius,
    `${path}.radius`,
    "Cylinder radius",
    issues
  );
  validatePositiveFiniteField(
    value.height,
    `${path}.height`,
    "Cylinder height",
    issues
  );
}

function validateSphereDimensionsShape(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): void {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_DIMENSIONS",
      path,
      "Sphere dimensions must be an object."
    );
    return;
  }

  validatePositiveFiniteField(
    value.radius,
    `${path}.radius`,
    "Sphere radius",
    issues
  );
}

function validateConeDimensionsShape(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): void {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_DIMENSIONS",
      path,
      "Cone dimensions must be an object."
    );
    return;
  }

  validatePositiveFiniteField(
    value.radius,
    `${path}.radius`,
    "Cone radius",
    issues
  );
  validatePositiveFiniteField(
    value.height,
    `${path}.height`,
    "Cone height",
    issues
  );
}

function validateTorusDimensionsShape(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): void {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_DIMENSIONS",
      path,
      "Torus dimensions must be an object."
    );
    return;
  }

  validatePositiveFiniteField(
    value.majorRadius,
    `${path}.majorRadius`,
    "Torus majorRadius",
    issues
  );
  validatePositiveFiniteField(
    value.minorRadius,
    `${path}.minorRadius`,
    "Torus minorRadius",
    issues
  );

  if (
    typeof value.majorRadius === "number" &&
    typeof value.minorRadius === "number" &&
    isPositiveFiniteNumber(value.majorRadius) &&
    isPositiveFiniteNumber(value.minorRadius) &&
    value.minorRadius >= value.majorRadius
  ) {
    addProjectIssue(
      issues,
      "INVALID_DIMENSIONS",
      `${path}.minorRadius`,
      "Torus minorRadius must be smaller than majorRadius."
    );
  }
}

function validateTransformShape(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): void {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_TRANSFORM",
      path,
      "Transform must be an object."
    );
    return;
  }

  validateVec3Field(value.translation, `${path}.translation`, issues);
  validateVec3Field(value.rotation, `${path}.rotation`, issues);
  validateVec3Field(value.scale, `${path}.scale`, issues);
}

function validateVec3Field(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): void {
  if (!isVec3(value)) {
    addProjectIssue(
      issues,
      "INVALID_TRANSFORM",
      path,
      "Transform vector must contain three finite numbers."
    );
  }
}

function validateVec2Field(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): void {
  if (!isVec2(value)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_ENTITY",
      path,
      "Sketch coordinate vector must contain two finite numbers."
    );
  }
}

function validateNextGeneratedNumber(
  value: unknown,
  path: string,
  label: string,
  generatedIdLabel: string,
  maxGeneratedNumber: number,
  issues: CadProjectImportIssue[]
): void {
  const isValid =
    typeof value === "number" && Number.isInteger(value) && value > 0;

  if (!isValid) {
    addProjectIssue(
      issues,
      "INVALID_DOCUMENT",
      path,
      `${label} must be a positive integer.`
    );
  } else if (value <= maxGeneratedNumber) {
    addProjectIssue(
      issues,
      "INVALID_DOCUMENT",
      path,
      `${label} must be greater than existing ${generatedIdLabel}.`
    );
  }
}

function validatePositiveFiniteField(
  value: unknown,
  path: string,
  label: string,
  issues: CadProjectImportIssue[]
): void {
  if (typeof value !== "number" || !isPositiveFiniteNumber(value)) {
    addProjectIssue(
      issues,
      "INVALID_DIMENSIONS",
      path,
      `${label} must be a positive finite number.`
    );
  }
}

function validateTransactionArray(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[],
  expectedStatus?: CadTransactionStatus,
  seenTransactionIds?: Set<TransactionId>
): void {
  if (!Array.isArray(value)) {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      path,
      "Transaction history must be an array."
    );
    return;
  }

  for (const [index, transaction] of value.entries()) {
    validateTransactionShape(
      transaction,
      `${path}[${index}]`,
      issues,
      expectedStatus,
      seenTransactionIds
    );
  }
}

function validateTransactionShape(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[],
  expectedStatus?: CadTransactionStatus,
  seenTransactionIds?: Set<TransactionId>
): void {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      path,
      "Transaction must be an object."
    );
    return;
  }

  if (typeof value.id !== "string" || value.id.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      `${path}.id`,
      "Transaction id must be a non-empty string."
    );
  } else if (seenTransactionIds?.has(value.id)) {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      `${path}.id`,
      `Duplicate transaction id: ${value.id}.`
    );
  } else {
    seenTransactionIds?.add(value.id);
  }

  if (!Array.isArray(value.ops)) {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      `${path}.ops`,
      "Transaction ops must be an array."
    );
  } else {
    for (const [index, op] of value.ops.entries()) {
      if (!isCadOp(op)) {
        addProjectIssue(
          issues,
          "INVALID_TRANSACTION",
          `${path}.ops[${index}]`,
          "Transaction operation must be a valid CADOps command."
        );
      }
    }
  }

  if (value.status !== "committed" && value.status !== "undone") {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      `${path}.status`,
      "Transaction status must be committed or undone."
    );
  } else if (expectedStatus !== undefined && value.status !== expectedStatus) {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      `${path}.status`,
      `Transactions in ${path.startsWith("$.redoStack") ? "redoStack" : "history"} must have ${expectedStatus} status.`
    );
  }

  validateOptionalTransactionActor(value.actor, `${path}.actor`, issues);
  validateOptionalTransactionAudit(
    value.audit,
    `${path}.audit`,
    Array.isArray(value.ops) ? value.ops.length : undefined,
    issues
  );

  if (!isSemanticDiff(value.diff)) {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      `${path}.diff`,
      "Transaction diff must be a valid semantic diff."
    );
  }
}

function validateOptionalTransactionAudit(
  value: unknown,
  path: string,
  expectedOperationCount: number | undefined,
  issues: CadProjectImportIssue[]
): void {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      path,
      "Transaction audit metadata must be an object when present."
    );
    return;
  }

  if (value.intent !== "commit") {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      `${path}.intent`,
      "Saved transaction audit intent must be commit."
    );
  }

  if (
    typeof value.operationCount !== "number" ||
    !Number.isInteger(value.operationCount) ||
    value.operationCount < 0
  ) {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      `${path}.operationCount`,
      "Transaction audit operationCount must be a non-negative integer."
    );
  } else if (
    expectedOperationCount !== undefined &&
    value.operationCount !== expectedOperationCount
  ) {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      `${path}.operationCount`,
      "Transaction audit operationCount must match transaction ops length."
    );
  }

  validateOptionalAuditStringField(value.source, `${path}.source`, issues);
  validateOptionalAuditStringField(
    value.requestId,
    `${path}.requestId`,
    issues
  );
  validateOptionalAuditStringField(value.toolName, `${path}.toolName`, issues);
}

function validateOptionalAuditStringField(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "string" || value.trim() === "") {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      path,
      "Transaction audit metadata fields must be non-empty strings when present."
    );
  }
}

function validateOptionalTransactionActor(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): void {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      path,
      "Transaction actor must be an object when present."
    );
    return;
  }

  if (!isCadActorType(value.type)) {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      `${path}.type`,
      "Transaction actor type must be human, agent, script, or system."
    );
  }

  if (value.id !== undefined) {
    validateNonEmptyStringField(value.id, `${path}.id`, "actor id", issues);
  }

  if (value.name !== undefined) {
    validateNonEmptyStringField(
      value.name,
      `${path}.name`,
      "actor name",
      issues
    );
  }
}

function validateNonEmptyStringField(
  value: unknown,
  path: string,
  label: string,
  issues: CadProjectImportIssue[]
): void {
  if (typeof value !== "string" || value.trim() === "") {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      path,
      `Transaction ${label} must be a non-empty string when present.`
    );
  }
}

function throwProjectTransactionHistoryError(
  path: string,
  error: unknown
): never {
  const message =
    error instanceof Error
      ? error.message
      : "Project transaction history could not be replayed.";

  throw new CadProjectImportError([
    {
      code: "INVALID_TRANSACTION_HISTORY",
      path,
      message: `Project transaction history could not be replayed: ${message}`
    }
  ]);
}

function addProjectIssue(
  issues: CadProjectImportIssue[],
  code: CadProjectImportErrorCode,
  path: string,
  message: string
): void {
  issues.push({ code, path, message });
}

function formatCadProjectImportIssues(
  issues: readonly CadProjectImportIssue[]
): string {
  const firstIssue = issues[0];

  if (!firstIssue) {
    return "Invalid Partbench project JSON.";
  }

  const suffix =
    issues.length > 1 ? `; ${issues.length - 1} more issue(s).` : ".";

  return `Invalid Partbench project JSON: ${firstIssue.message} (${firstIssue.path})${suffix}`;
}

function materializeGeneratedObjectIds(
  transaction: Transaction
): readonly CadOp[] {
  let createdObjectIndex = 0;
  let createdSketchIndex = 0;
  let createdSketchEntityIndex = 0;
  let createdParameterIndex = 0;
  let createdSketchDimensionIndex = 0;
  let createdSketchConstraintIndex = 0;
  let createdFeatureIndex = 0;

  return transaction.ops.map((op) => {
    if (isSceneCreateOp(op)) {
      if (op.id) {
        return op;
      }

      const createdRef = transaction.diff.created[createdObjectIndex];
      createdObjectIndex += 1;

      return createdRef ? { ...op, id: createdRef.id } : op;
    }

    if (op.op === "sketch.create" || op.op === "sketch.createOnFace") {
      if (op.id) {
        return op;
      }

      const createdRef =
        transaction.diff.sketches?.created?.[createdSketchIndex];
      createdSketchIndex += 1;

      return createdRef ? { ...op, id: createdRef.id } : op;
    }

    if (isSketchAddEntityOp(op)) {
      if (op.id) {
        return op;
      }

      const createdRef =
        transaction.diff.sketches?.entitiesCreated?.[createdSketchEntityIndex];
      createdSketchEntityIndex += 1;

      return createdRef ? { ...op, id: createdRef.id } : op;
    }

    if (op.op === "parameter.create") {
      if (op.id) {
        return op;
      }

      const createdRef =
        transaction.diff.parameters?.created?.[createdParameterIndex];
      createdParameterIndex += 1;

      return createdRef ? { ...op, id: createdRef.id } : op;
    }

    if (op.op === "sketch.dimension.create") {
      if (op.id) {
        return op;
      }

      const createdRef =
        transaction.diff.sketchDimensions?.created?.[
          createdSketchDimensionIndex
        ];
      createdSketchDimensionIndex += 1;

      return createdRef ? { ...op, id: createdRef.id } : op;
    }

    if (op.op === "sketch.constraint.create") {
      if (op.id) {
        return op;
      }

      const createdRef =
        transaction.diff.sketchConstraints?.created?.[
          createdSketchConstraintIndex
        ];
      createdSketchConstraintIndex += 1;

      return createdRef ? { ...op, id: createdRef.id } : op;
    }

    if (
      op.op === "feature.extrude" ||
      op.op === "feature.revolve" ||
      op.op === "feature.hole" ||
      op.op === "feature.chamfer" ||
      op.op === "feature.fillet"
    ) {
      const createdRef =
        transaction.diff.features?.created?.[createdFeatureIndex];
      createdFeatureIndex += 1;

      return {
        ...op,
        id: op.id ?? createdRef?.id,
        bodyId: op.bodyId ?? createdRef?.bodyId
      };
    }

    return op;
  });
}

function isSceneCreateOp(op: CadOp): op is Extract<
  CadOp,
  {
    readonly op:
      | "scene.createBox"
      | "scene.createCylinder"
      | "scene.createSphere"
      | "scene.createCone"
      | "scene.createTorus";
  }
> {
  return (
    op.op === "scene.createBox" ||
    op.op === "scene.createCylinder" ||
    op.op === "scene.createSphere" ||
    op.op === "scene.createCone" ||
    op.op === "scene.createTorus"
  );
}

function isSketchAddEntityOp(op: CadOp): op is Extract<
  CadOp,
  {
    readonly op:
      | "sketch.addPoint"
      | "sketch.addLine"
      | "sketch.addRectangle"
      | "sketch.addCircle";
  }
> {
  return (
    op.op === "sketch.addPoint" ||
    op.op === "sketch.addLine" ||
    op.op === "sketch.addRectangle" ||
    op.op === "sketch.addCircle"
  );
}

function isCadOp(value: unknown): value is CadOp {
  if (!isRecord(value)) {
    return false;
  }

  if (value.op === "parameter.create") {
    return (
      isOptionalString(value.id) &&
      typeof value.name === "string" &&
      typeof value.value === "number" &&
      Number.isFinite(value.value) &&
      (value.description === undefined || typeof value.description === "string")
    );
  }

  if (value.op === "parameter.update") {
    return (
      typeof value.id === "string" &&
      (value.value === undefined ||
        (typeof value.value === "number" && Number.isFinite(value.value))) &&
      (value.description === undefined ||
        typeof value.description === "string") &&
      (value.value !== undefined || value.description !== undefined)
    );
  }

  if (value.op === "parameter.rename") {
    return typeof value.id === "string" && typeof value.name === "string";
  }

  if (value.op === "parameter.delete") {
    return typeof value.id === "string";
  }

  if (value.op === "scene.createBox") {
    return (
      isOptionalString(value.id) &&
      isOptionalString(value.name) &&
      isBoxDimensions(value.dimensions) &&
      isOptionalTransform(value.transform)
    );
  }

  if (value.op === "scene.createCylinder") {
    return (
      isOptionalString(value.id) &&
      isOptionalString(value.name) &&
      isCylinderDimensions(value.dimensions) &&
      isOptionalTransform(value.transform)
    );
  }

  if (value.op === "scene.createSphere") {
    return (
      isOptionalString(value.id) &&
      isOptionalString(value.name) &&
      isSphereDimensions(value.dimensions) &&
      isOptionalTransform(value.transform)
    );
  }

  if (value.op === "scene.createCone") {
    return (
      isOptionalString(value.id) &&
      isOptionalString(value.name) &&
      isConeDimensions(value.dimensions) &&
      isOptionalTransform(value.transform)
    );
  }

  if (value.op === "scene.createTorus") {
    return (
      isOptionalString(value.id) &&
      isOptionalString(value.name) &&
      isTorusDimensions(value.dimensions) &&
      isOptionalTransform(value.transform)
    );
  }

  if (value.op === "scene.deleteObject") {
    return typeof value.id === "string";
  }

  if (value.op === "scene.updateTransform") {
    return (
      typeof value.id === "string" &&
      value.transform !== undefined &&
      isOptionalTransform(value.transform)
    );
  }

  if (value.op === "scene.updateBoxDimensions") {
    return typeof value.id === "string" && isBoxDimensions(value.dimensions);
  }

  if (value.op === "scene.updateCylinderDimensions") {
    return (
      typeof value.id === "string" && isCylinderDimensions(value.dimensions)
    );
  }

  if (value.op === "scene.updateSphereDimensions") {
    return typeof value.id === "string" && isSphereDimensions(value.dimensions);
  }

  if (value.op === "scene.updateConeDimensions") {
    return typeof value.id === "string" && isConeDimensions(value.dimensions);
  }

  if (value.op === "scene.updateTorusDimensions") {
    return typeof value.id === "string" && isTorusDimensions(value.dimensions);
  }

  if (value.op === "scene.renameObject") {
    return typeof value.id === "string" && typeof value.name === "string";
  }

  if (value.op === "document.updateUnits") {
    return (
      isDocumentUnits(value.units) &&
      (value.mode === undefined || isDocumentUnitUpdateMode(value.mode))
    );
  }

  if (value.op === "sketch.create") {
    return (
      isOptionalString(value.id) &&
      typeof value.name === "string" &&
      isSketchPlane(value.plane)
    );
  }

  if (value.op === "sketch.createOnFace") {
    const hasGeneratedReference =
      typeof value.bodyId === "string" &&
      typeof value.faceStableId === "string" &&
      value.referenceName === undefined &&
      value.topologyAnchorId === undefined &&
      value.topologyAnchorProof === undefined;
    const hasNamedReference =
      typeof value.referenceName === "string" &&
      value.bodyId === undefined &&
      value.faceStableId === undefined &&
      value.topologyAnchorId === undefined &&
      value.topologyAnchorProof === undefined;
    const hasTopologyAnchor =
      typeof value.topologyAnchorId === "string" &&
      value.bodyId === undefined &&
      value.faceStableId === undefined &&
      value.referenceName === undefined &&
      (value.topologyAnchorProof === undefined ||
        isTopologyAnchorFaceProofInput(value.topologyAnchorProof));

    return (
      isOptionalString(value.id) &&
      typeof value.name === "string" &&
      (hasGeneratedReference || hasNamedReference || hasTopologyAnchor)
    );
  }

  if (value.op === "sketch.rename") {
    return typeof value.id === "string" && typeof value.name === "string";
  }

  if (value.op === "sketch.delete") {
    return typeof value.id === "string";
  }

  if (value.op === "sketch.addPoint") {
    return (
      typeof value.sketchId === "string" &&
      isOptionalString(value.id) &&
      isVec2(value.point)
    );
  }

  if (value.op === "sketch.addLine") {
    return (
      typeof value.sketchId === "string" &&
      isOptionalString(value.id) &&
      isVec2(value.start) &&
      isVec2(value.end)
    );
  }

  if (value.op === "sketch.addRectangle") {
    return (
      typeof value.sketchId === "string" &&
      isOptionalString(value.id) &&
      isVec2(value.center) &&
      typeof value.width === "number" &&
      isPositiveFiniteNumber(value.width) &&
      typeof value.height === "number" &&
      isPositiveFiniteNumber(value.height)
    );
  }

  if (value.op === "sketch.addCircle") {
    return (
      typeof value.sketchId === "string" &&
      isOptionalString(value.id) &&
      isVec2(value.center) &&
      typeof value.radius === "number" &&
      isPositiveFiniteNumber(value.radius)
    );
  }

  if (value.op === "sketch.updateEntity") {
    return typeof value.sketchId === "string" && isSketchEntity(value.entity);
  }

  if (value.op === "sketch.deleteEntity") {
    return (
      typeof value.sketchId === "string" && typeof value.entityId === "string"
    );
  }

  if (value.op === "sketch.dimension.create") {
    return (
      isOptionalString(value.id) &&
      typeof value.name === "string" &&
      typeof value.sketchId === "string" &&
      typeof value.entityId === "string" &&
      isSketchDimensionTarget(value.target) &&
      isSketchDimensionValueInput(value)
    );
  }

  if (value.op === "sketch.dimension.update") {
    return typeof value.id === "string" && isSketchDimensionValueInput(value);
  }

  if (value.op === "sketch.dimension.rename") {
    return typeof value.id === "string" && typeof value.name === "string";
  }

  if (value.op === "sketch.dimension.delete") {
    return typeof value.id === "string";
  }

  if (value.op === "sketch.constraint.create") {
    if (
      !isOptionalString(value.id) ||
      typeof value.name !== "string" ||
      typeof value.sketchId !== "string" ||
      !isSketchConstraintKind(value.kind)
    ) {
      return false;
    }

    if (value.kind === "fixed") {
      return (
        isSketchPointTarget(value.target) &&
        (value.coordinate === undefined || isVec2(value.coordinate))
      );
    }

    if (value.kind === "coincident") {
      return (
        isSketchPointTarget(value.primaryTarget) &&
        isSketchPointTarget(value.secondaryTarget)
      );
    }

    if (value.kind === "midpoint") {
      return (
        typeof value.lineEntityId === "string" &&
        isSketchPointTarget(value.target)
      );
    }

    if (value.kind === "parallel" || value.kind === "perpendicular") {
      return (
        typeof value.primaryLineEntityId === "string" &&
        typeof value.secondaryLineEntityId === "string"
      );
    }

    return typeof value.entityId === "string";
  }

  if (value.op === "sketch.constraint.rename") {
    return typeof value.id === "string" && typeof value.name === "string";
  }

  if (value.op === "sketch.constraint.delete") {
    return typeof value.id === "string";
  }

  if (value.op === "feature.extrude") {
    return (
      isOptionalString(value.id) &&
      isOptionalString(value.bodyId) &&
      isOptionalString(value.targetBodyId) &&
      isOptionalString(value.targetTopologyAnchorId) &&
      isOptionalString(value.name) &&
      typeof value.sketchId === "string" &&
      typeof value.entityId === "string" &&
      typeof value.depth === "number" &&
      isPositiveFiniteNumber(value.depth) &&
      (value.side === undefined || isExtrudeSide(value.side)) &&
      (value.operationMode === undefined ||
        isExtrudeOperationMode(value.operationMode))
    );
  }

  if (value.op === "feature.revolve") {
    return (
      isOptionalString(value.id) &&
      isOptionalString(value.bodyId) &&
      isOptionalString(value.targetBodyId) &&
      isOptionalString(value.name) &&
      typeof value.sketchId === "string" &&
      typeof value.entityId === "string" &&
      isFeatureRevolveAxis(value.axis) &&
      typeof value.angleDegrees === "number" &&
      isPositiveFiniteNumber(value.angleDegrees) &&
      value.angleDegrees <= 360 &&
      (value.operationMode === undefined ||
        isRevolveOperationMode(value.operationMode))
    );
  }

  if (value.op === "feature.hole") {
    return (
      isOptionalString(value.id) &&
      isOptionalString(value.bodyId) &&
      isOptionalString(value.name) &&
      isOptionalString(value.targetBodyId) &&
      isOptionalString(value.targetTopologyAnchorId) &&
      typeof value.sketchId === "string" &&
      typeof value.circleEntityId === "string" &&
      isHoleDepthMode(value.depthMode) &&
      (value.depth === undefined ||
        (typeof value.depth === "number" &&
          isPositiveFiniteNumber(value.depth))) &&
      (value.direction === undefined || isHoleDirection(value.direction))
    );
  }

  if (value.op === "feature.chamfer") {
    return (
      isOptionalString(value.id) &&
      isOptionalString(value.bodyId) &&
      isOptionalString(value.name) &&
      typeof value.targetBodyId === "string" &&
      hasExactlyOneEdgeReferenceInput(value) &&
      typeof value.distance === "number" &&
      isPositiveFiniteNumber(value.distance)
    );
  }

  if (value.op === "feature.fillet") {
    return (
      isOptionalString(value.id) &&
      isOptionalString(value.bodyId) &&
      isOptionalString(value.name) &&
      typeof value.targetBodyId === "string" &&
      hasExactlyOneEdgeReferenceInput(value) &&
      typeof value.radius === "number" &&
      isPositiveFiniteNumber(value.radius)
    );
  }

  if (value.op === "feature.delete") {
    return typeof value.id === "string";
  }

  if (value.op === "feature.updateExtrude") {
    return (
      typeof value.id === "string" &&
      (value.depth === undefined ||
        (typeof value.depth === "number" &&
          isPositiveFiniteNumber(value.depth))) &&
      (value.side === undefined || isExtrudeSide(value.side)) &&
      (value.depth !== undefined || value.side !== undefined)
    );
  }

  if (value.op === "feature.updateRevolve") {
    return (
      typeof value.id === "string" &&
      typeof value.angleDegrees === "number" &&
      isPositiveFiniteNumber(value.angleDegrees) &&
      value.angleDegrees <= 360
    );
  }

  if (value.op === "feature.updateHole") {
    return (
      typeof value.id === "string" &&
      (value.depthMode === undefined || isHoleDepthMode(value.depthMode)) &&
      (value.depth === undefined ||
        (typeof value.depth === "number" &&
          isPositiveFiniteNumber(value.depth))) &&
      (value.direction === undefined || isHoleDirection(value.direction)) &&
      (value.depthMode !== undefined ||
        value.depth !== undefined ||
        value.direction !== undefined)
    );
  }

  if (value.op === "feature.updateChamfer") {
    return (
      typeof value.id === "string" &&
      typeof value.distance === "number" &&
      isPositiveFiniteNumber(value.distance)
    );
  }

  if (value.op === "feature.updateFillet") {
    return (
      typeof value.id === "string" &&
      typeof value.radius === "number" &&
      isPositiveFiniteNumber(value.radius)
    );
  }

  if (value.op === "reference.nameGenerated") {
    return (
      typeof value.name === "string" &&
      typeof value.bodyId === "string" &&
      typeof value.stableId === "string"
    );
  }

  if (value.op === "reference.repairName") {
    return (
      typeof value.name === "string" &&
      hasValidReferenceRepairTargetInput(value)
    );
  }

  if (value.op === "reference.deleteName") {
    return typeof value.name === "string";
  }

  if (value.op === "topology.checkpoint.create") {
    return (
      isNonEmptyString(value.checkpointId) &&
      isNonEmptyString(value.bodyId) &&
      (value.sourceFeatureId === undefined ||
        isNonEmptyString(value.sourceFeatureId)) &&
      isWcadSourceIdentityInput(value.sourceIdentity) &&
      isTopologyCheckpointStatus(value.status) &&
      (value.diagnostics === undefined ||
        (Array.isArray(value.diagnostics) &&
          value.diagnostics.every(isTopologyIdentityDiagnosticShape)))
    );
  }

  if (value.op === "topology.anchor.create") {
    return (
      isNonEmptyString(value.anchorId) &&
      isTopologyAnchorEntityKind(value.entityKind) &&
      isNonEmptyString(value.bodyId) &&
      isNonEmptyString(value.checkpointId) &&
      isNonEmptyString(value.checkpointEntityId) &&
      (value.sourceFeatureId === undefined ||
        isNonEmptyString(value.sourceFeatureId)) &&
      (value.stableId === undefined || isNonEmptyString(value.stableId)) &&
      (value.sourceSemanticRole === undefined ||
        isNonEmptyString(value.sourceSemanticRole)) &&
      (value.signatureHash === undefined ||
        isNonEmptyString(value.signatureHash))
    );
  }

  if (value.op === "topology.anchor.repair") {
    return (
      isNonEmptyString(value.repairId) &&
      isNonEmptyString(value.anchorId) &&
      isNonEmptyString(value.replacementCheckpointId) &&
      isNonEmptyString(value.replacementCheckpointEntityId) &&
      isTopologyMatchConfidence(value.confidence) &&
      (value.evidence === undefined ||
        (Array.isArray(value.evidence) &&
          value.evidence.every(isTopologyMatchEvidenceShape))) &&
      (value.diagnostics === undefined ||
        (Array.isArray(value.diagnostics) &&
          value.diagnostics.every(isTopologyIdentityDiagnosticShape)))
    );
  }

  return false;
}

function isSemanticDiff(value: unknown): value is SemanticDiff {
  return (
    isRecord(value) &&
    Array.isArray(value.created) &&
    value.created.every(isCadObjectRef) &&
    Array.isArray(value.modified) &&
    value.modified.every(isCadObjectRef) &&
    Array.isArray(value.deleted) &&
    value.deleted.every(isCadObjectRef) &&
    (value.document === undefined || isDocumentSemanticDiff(value.document)) &&
    (value.sketches === undefined || isSketchSemanticDiff(value.sketches)) &&
    (value.features === undefined || isFeatureSemanticDiff(value.features)) &&
    (value.references === undefined ||
      isReferenceSemanticDiff(value.references)) &&
    (value.parameters === undefined ||
      isParameterSemanticDiff(value.parameters)) &&
    (value.sketchDimensions === undefined ||
      isSketchDimensionSemanticDiff(value.sketchDimensions)) &&
    (value.sketchConstraints === undefined ||
      isSketchConstraintSemanticDiff(value.sketchConstraints))
  );
}

function isDocumentSemanticDiff(value: unknown): value is DocumentSemanticDiff {
  return (
    isRecord(value) &&
    (value.units === undefined ||
      (isRecord(value.units) &&
        isDocumentUnits(value.units.before) &&
        isDocumentUnits(value.units.after) &&
        (value.units.mode === undefined ||
          isDocumentUnitUpdateMode(value.units.mode)) &&
        (value.units.scaleFactor === undefined ||
          (typeof value.units.scaleFactor === "number" &&
            Number.isFinite(value.units.scaleFactor) &&
            value.units.scaleFactor > 0))))
  );
}

function isSketchSemanticDiff(value: unknown): value is SketchSemanticDiff {
  return (
    isRecord(value) &&
    (value.created === undefined ||
      (Array.isArray(value.created) && value.created.every(isCadSketchRef))) &&
    (value.modified === undefined ||
      (Array.isArray(value.modified) &&
        value.modified.every(isCadSketchRef))) &&
    (value.deleted === undefined ||
      (Array.isArray(value.deleted) && value.deleted.every(isCadSketchRef))) &&
    (value.entitiesCreated === undefined ||
      (Array.isArray(value.entitiesCreated) &&
        value.entitiesCreated.every(isCadSketchEntityRef))) &&
    (value.entitiesModified === undefined ||
      (Array.isArray(value.entitiesModified) &&
        value.entitiesModified.every(isCadSketchEntityRef))) &&
    (value.entitiesDeleted === undefined ||
      (Array.isArray(value.entitiesDeleted) &&
        value.entitiesDeleted.every(isCadSketchEntityRef)))
  );
}

function isFeatureSemanticDiff(value: unknown): value is FeatureSemanticDiff {
  return (
    isRecord(value) &&
    (value.created === undefined ||
      (Array.isArray(value.created) && value.created.every(isCadFeatureRef))) &&
    (value.modified === undefined ||
      (Array.isArray(value.modified) &&
        value.modified.every(isCadFeatureRef))) &&
    (value.deleted === undefined ||
      (Array.isArray(value.deleted) && value.deleted.every(isCadFeatureRef))) &&
    (value.bodiesCreated === undefined ||
      (Array.isArray(value.bodiesCreated) &&
        value.bodiesCreated.every(isCadBodyRef))) &&
    (value.bodiesModified === undefined ||
      (Array.isArray(value.bodiesModified) &&
        value.bodiesModified.every(isCadBodyRef))) &&
    (value.bodiesDeleted === undefined ||
      (Array.isArray(value.bodiesDeleted) &&
        value.bodiesDeleted.every(isCadBodyRef))) &&
    (value.referenceEffects === undefined ||
      (Array.isArray(value.referenceEffects) &&
        value.referenceEffects.every(isCadFeatureReferenceChangeSummary))) &&
    (value.lifecycleEffects === undefined ||
      (Array.isArray(value.lifecycleEffects) &&
        value.lifecycleEffects.every(isCadBodyLifecycleEffectSummary)))
  );
}

function isCadFeatureReferenceChangeSummary(
  value: unknown
): value is CadFeatureReferenceChangeSummary {
  return (
    isRecord(value) &&
    isCadFeatureReferenceChangeCategory(value.category) &&
    typeof value.message === "string" &&
    (value.bodyId === undefined || typeof value.bodyId === "string") &&
    (value.stableId === undefined || typeof value.stableId === "string") &&
    (value.kind === undefined || isGeneratedEntityKind(value.kind)) &&
    (value.topologyAnchorId === undefined ||
      typeof value.topologyAnchorId === "string") &&
    (value.checkpointId === undefined ||
      typeof value.checkpointId === "string") &&
    (value.matchConfidence === undefined ||
      isTopologyMatchConfidence(value.matchConfidence)) &&
    (value.referenceName === undefined ||
      typeof value.referenceName === "string") &&
    (value.sourceFeatureId === undefined ||
      typeof value.sourceFeatureId === "string") &&
    (value.targetFeatureId === undefined ||
      typeof value.targetFeatureId === "string") &&
    (value.diagnosticCode === undefined ||
      isCadFeatureEditDiagnosticCode(value.diagnosticCode))
  );
}

function isCadFeatureReferenceChangeCategory(
  value: unknown
): value is CadFeatureReferenceChangeSummary["category"] {
  return (
    value === "active" ||
    value === "replaced" ||
    value === "stale" ||
    value === "consumed" ||
    value === "ambiguous" ||
    value === "missing" ||
    value === "unsupported" ||
    value === "repair-needed" ||
    value === "deleted"
  );
}

function isCadFeatureEditDiagnosticCode(
  value: unknown
): value is CadFeatureEditDiagnosticCode {
  return (
    value === "FEATURE_NOT_FOUND" ||
    value === "FEATURE_EDIT_SUPPORTED" ||
    value === "FEATURE_EDIT_UNSUPPORTED" ||
    value === "FEATURE_EDIT_CONSUMED_BODY" ||
    value === "FEATURE_EDIT_INVALID_PROPOSAL" ||
    value === "FEATURE_EDIT_COMMIT_DEFERRED" ||
    value === "FEATURE_REBUILD_DEFERRED" ||
    value === "REFERENCE_HEALTH_DEFERRED" ||
    value === "AMBIGUOUS_RESULT_TOPOLOGY" ||
    value === "CONSUMED_REFERENCE_NOT_COMMAND_READY"
  );
}

function isCadBodyLifecycleEffectSummary(
  value: unknown
): value is CadBodyLifecycleEffectSummary {
  return (
    isRecord(value) &&
    typeof value.bodyId === "string" &&
    isCadBodyLifecycleState(value.primaryState) &&
    Array.isArray(value.states) &&
    value.states.every(isCadBodyLifecycleState) &&
    typeof value.message === "string" &&
    (value.featureId === undefined || typeof value.featureId === "string") &&
    (value.targetFeatureId === undefined ||
      typeof value.targetFeatureId === "string") &&
    (value.diagnosticCode === undefined ||
      isCadRebuildPlanDiagnosticCode(value.diagnosticCode))
  );
}

function isCadBodyLifecycleState(
  value: unknown
): value is CadBodyLifecycleState {
  return (
    isCadFeatureReferenceChangeCategory(value) ||
    value === "source" ||
    value === "result" ||
    value === "modified" ||
    value === "replacement" ||
    value === "failed" ||
    value === "derived-rebuild-pending" ||
    value === "suppressed" ||
    value === "deferred"
  );
}

function isCadRebuildPlanDiagnosticCode(
  value: unknown
): value is CadRebuildPlanDiagnosticCode {
  return (
    value === "REBUILD_PLAN_READY" ||
    value === "REBUILD_DERIVED_PENDING" ||
    value === "REBUILD_TARGET_CONSUMED" ||
    value === "REBUILD_RESULT_REPAIR_NEEDED" ||
    value === "REBUILD_RESULT_TOPOLOGY_AMBIGUOUS" ||
    value === "REBUILD_BODY_UNSUPPORTED" ||
    value === "REBUILD_SOURCE_STALE" ||
    value === "REBUILD_FAILED" ||
    value === "REBUILD_REFERENCE_REPAIR_NEEDED" ||
    value === "REBUILD_EXECUTION_DEFERRED"
  );
}

function isReferenceSemanticDiff(
  value: unknown
): value is ReferenceSemanticDiff {
  return (
    isRecord(value) &&
    (value.namedCreated === undefined ||
      (Array.isArray(value.namedCreated) &&
        value.namedCreated.every(isCadNamedReferenceRef))) &&
    (value.namedRepaired === undefined ||
      (Array.isArray(value.namedRepaired) &&
        value.namedRepaired.every(isCadNamedReferenceRepairRef))) &&
    (value.namedDeleted === undefined ||
      (Array.isArray(value.namedDeleted) &&
        value.namedDeleted.every(isCadNamedReferenceRef))) &&
    (value.topologyCheckpointsCreated === undefined ||
      (Array.isArray(value.topologyCheckpointsCreated) &&
        value.topologyCheckpointsCreated.every(isCadTopologyCheckpointRef))) &&
    (value.topologyAnchorsCreated === undefined ||
      (Array.isArray(value.topologyAnchorsCreated) &&
        value.topologyAnchorsCreated.every(isCadTopologyAnchorRef))) &&
    (value.topologyAnchorsRepaired === undefined ||
      (Array.isArray(value.topologyAnchorsRepaired) &&
        value.topologyAnchorsRepaired.every(isCadTopologyAnchorRepairRef)))
  );
}

function isParameterSemanticDiff(
  value: unknown
): value is ParameterSemanticDiff {
  return (
    isRecord(value) &&
    (value.created === undefined ||
      (Array.isArray(value.created) &&
        value.created.every(isCadParameterRef))) &&
    (value.modified === undefined ||
      (Array.isArray(value.modified) &&
        value.modified.every(isCadParameterRef))) &&
    (value.deleted === undefined ||
      (Array.isArray(value.deleted) && value.deleted.every(isCadParameterRef)))
  );
}

function isSketchDimensionSemanticDiff(
  value: unknown
): value is SketchDimensionSemanticDiff {
  return (
    isRecord(value) &&
    (value.created === undefined ||
      (Array.isArray(value.created) &&
        value.created.every(isCadSketchDimensionRef))) &&
    (value.modified === undefined ||
      (Array.isArray(value.modified) &&
        value.modified.every(isCadSketchDimensionRef))) &&
    (value.deleted === undefined ||
      (Array.isArray(value.deleted) &&
        value.deleted.every(isCadSketchDimensionRef)))
  );
}

function isSketchConstraintSemanticDiff(
  value: unknown
): value is SketchConstraintSemanticDiff {
  return (
    isRecord(value) &&
    (value.created === undefined ||
      (Array.isArray(value.created) &&
        value.created.every(isCadSketchConstraintRef))) &&
    (value.modified === undefined ||
      (Array.isArray(value.modified) &&
        value.modified.every(isCadSketchConstraintRef))) &&
    (value.deleted === undefined ||
      (Array.isArray(value.deleted) &&
        value.deleted.every(isCadSketchConstraintRef)))
  );
}

function isCadObjectRef(value: unknown): value is CadObjectRef {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.kind === "box" ||
      value.kind === "cylinder" ||
      value.kind === "sphere" ||
      value.kind === "cone" ||
      value.kind === "torus")
  );
}

function isCadSketchRef(value: unknown): value is CadSketchRef {
  return isRecord(value) && typeof value.id === "string";
}

function isCadSketchEntityRef(value: unknown): value is CadSketchEntityRef {
  return (
    isRecord(value) &&
    typeof value.sketchId === "string" &&
    typeof value.id === "string" &&
    isSketchEntityKind(value.kind)
  );
}

function isCadFeatureRef(value: unknown): value is CadFeatureRef {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.bodyId !== "string"
  ) {
    return false;
  }

  if (value.kind === "hole") {
    return (
      typeof value.targetBodyId === "string" &&
      (value.targetTopologyAnchorId === undefined ||
        typeof value.targetTopologyAnchorId === "string") &&
      typeof value.sketchId === "string" &&
      typeof value.circleEntityId === "string" &&
      isHoleDepthMode(value.depthMode) &&
      (value.depth === undefined ||
        (typeof value.depth === "number" &&
          isPositiveFiniteNumber(value.depth))) &&
      isHoleDirection(value.direction)
    );
  }

  if (value.kind === "chamfer") {
    return (
      typeof value.targetBodyId === "string" &&
      hasValidEdgeFinishFeatureReference(value) &&
      typeof value.distance === "number" &&
      isPositiveFiniteNumber(value.distance)
    );
  }

  if (value.kind === "fillet") {
    return (
      typeof value.targetBodyId === "string" &&
      hasValidEdgeFinishFeatureReference(value) &&
      typeof value.radius === "number" &&
      isPositiveFiniteNumber(value.radius)
    );
  }

  if (
    typeof value.sketchId !== "string" ||
    typeof value.entityId !== "string" ||
    (value.profileKind !== "rectangle" && value.profileKind !== "circle") ||
    (value.targetBodyId !== undefined &&
      typeof value.targetBodyId !== "string") ||
    (value.targetTopologyAnchorId !== undefined &&
      typeof value.targetTopologyAnchorId !== "string")
  ) {
    return false;
  }

  if (value.kind === "extrude") {
    return (
      value.operationMode === undefined ||
      isExtrudeOperationMode(value.operationMode)
    );
  }

  if (value.kind === "revolve") {
    return (
      isFeatureRevolveAxis(value.axis) &&
      typeof value.angleDegrees === "number" &&
      isPositiveFiniteNumber(value.angleDegrees) &&
      value.angleDegrees <= 360 &&
      (value.operationMode === undefined ||
        isRevolveOperationMode(value.operationMode))
    );
  }

  return false;
}

function isCadBodyRef(value: unknown): value is CadBodyRef {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.kind === "solid" &&
    typeof value.featureId === "string"
  );
}

function isCadNamedReferenceRef(value: unknown): value is CadNamedReferenceRef {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.bodyId === "string" &&
    typeof value.stableId === "string" &&
    isGeneratedEntityKind(value.kind) &&
    (value.topologyAnchorId === undefined ||
      typeof value.topologyAnchorId === "string")
  );
}

function isCadNamedReferenceRepairRef(
  value: unknown
): value is CadNamedReferenceRepairRef {
  return (
    isRecord(value) &&
    isCadNamedReferenceRef(value.before) &&
    isCadNamedReferenceRef(value.after)
  );
}

function isCadTopologyCheckpointRef(
  value: unknown
): value is CadTopologyCheckpointRef {
  return (
    isRecord(value) &&
    typeof value.checkpointId === "string" &&
    typeof value.bodyId === "string" &&
    (value.sourceFeatureId === undefined ||
      typeof value.sourceFeatureId === "string") &&
    isWcadSourceIdentityInput(value.sourceIdentity) &&
    isTopologyCheckpointStatus(value.status)
  );
}

function isCadTopologyAnchorRef(value: unknown): value is CadTopologyAnchorRef {
  return (
    isRecord(value) &&
    typeof value.anchorId === "string" &&
    isTopologyAnchorEntityKind(value.entityKind) &&
    typeof value.bodyId === "string" &&
    typeof value.checkpointId === "string" &&
    typeof value.checkpointEntityId === "string" &&
    (value.sourceFeatureId === undefined ||
      typeof value.sourceFeatureId === "string") &&
    (value.stableId === undefined || typeof value.stableId === "string")
  );
}

function isCadTopologyAnchorRepairRef(
  value: unknown
): value is CadTopologyAnchorRepairRef {
  return (
    isRecord(value) &&
    typeof value.repairId === "string" &&
    isCadTopologyAnchorRef(value.before) &&
    isCadTopologyAnchorRef(value.after) &&
    isTopologyMatchConfidence(value.confidence)
  );
}

function isCadParameterRef(value: unknown): value is CadParameterRef {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string"
  );
}

function isCadSketchDimensionRef(
  value: unknown
): value is CadSketchDimensionRef {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.sketchId === "string" &&
    typeof value.entityId === "string" &&
    isSketchDimensionTarget(value.target) &&
    (value.parameterId === undefined || typeof value.parameterId === "string")
  );
}

function isCadSketchConstraintRef(
  value: unknown
): value is CadSketchConstraintRef {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.sketchId === "string" &&
    typeof value.entityId === "string" &&
    isSketchConstraintKind(value.kind)
  );
}

function isBoxDimensions(value: unknown): value is BoxDimensions {
  return (
    isRecord(value) &&
    typeof value.width === "number" &&
    isPositiveFiniteNumber(value.width) &&
    typeof value.height === "number" &&
    isPositiveFiniteNumber(value.height) &&
    typeof value.depth === "number" &&
    isPositiveFiniteNumber(value.depth)
  );
}

function isCylinderDimensions(value: unknown): value is CylinderDimensions {
  return (
    isRecord(value) &&
    typeof value.radius === "number" &&
    isPositiveFiniteNumber(value.radius) &&
    typeof value.height === "number" &&
    isPositiveFiniteNumber(value.height)
  );
}

function isSphereDimensions(value: unknown): value is SphereDimensions {
  return (
    isRecord(value) &&
    typeof value.radius === "number" &&
    isPositiveFiniteNumber(value.radius)
  );
}

function isConeDimensions(value: unknown): value is ConeDimensions {
  return (
    isRecord(value) &&
    typeof value.radius === "number" &&
    isPositiveFiniteNumber(value.radius) &&
    typeof value.height === "number" &&
    isPositiveFiniteNumber(value.height)
  );
}

function isTorusDimensions(value: unknown): value is TorusDimensions {
  return (
    isRecord(value) &&
    typeof value.majorRadius === "number" &&
    isPositiveFiniteNumber(value.majorRadius) &&
    typeof value.minorRadius === "number" &&
    isPositiveFiniteNumber(value.minorRadius) &&
    value.minorRadius < value.majorRadius
  );
}

function isOptionalTransform(value: unknown): value is Partial<Transform> {
  if (value === undefined) {
    return true;
  }

  return (
    isRecord(value) &&
    (value.translation === undefined || isVec3(value.translation)) &&
    (value.rotation === undefined || isVec3(value.rotation)) &&
    (value.scale === undefined || isVec3(value.scale))
  );
}

function isVec3(value: unknown): value is readonly [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

function isTopologyEntityBounds(
  value: unknown
): value is Pick<CadAxisAlignedBounds, "min" | "max"> {
  return isRecord(value) && isVec3(value.min) && isVec3(value.max);
}

function isVec2(value: unknown): value is Vec2 {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

function isSketchEntity(value: unknown): value is SketchEntitySnapshot {
  if (!isRecord(value) || typeof value.id !== "string") {
    return false;
  }

  if (value.kind === "point") {
    return isVec2(value.point);
  }

  if (value.kind === "line") {
    return isVec2(value.start) && isVec2(value.end);
  }

  if (value.kind === "rectangle") {
    return (
      isVec2(value.center) &&
      typeof value.width === "number" &&
      isPositiveFiniteNumber(value.width) &&
      typeof value.height === "number" &&
      isPositiveFiniteNumber(value.height)
    );
  }

  if (value.kind === "circle") {
    return (
      isVec2(value.center) &&
      typeof value.radius === "number" &&
      isPositiveFiniteNumber(value.radius)
    );
  }

  return false;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isDocumentUnits(value: unknown): value is DocumentUnits {
  return value === "mm" || value === "cm" || value === "m" || value === "in";
}

function isDocumentUnitUpdateMode(
  value: unknown
): value is DocumentUnitUpdateMode {
  return value === "metadataOnly" || value === "preservePhysicalSize";
}

function isSketchPlane(value: unknown): value is SketchPlane {
  return value === "XY" || value === "XZ" || value === "YZ";
}

function isSketchEntityKind(value: unknown): value is SketchEntityKind {
  return (
    value === "point" ||
    value === "line" ||
    value === "rectangle" ||
    value === "circle"
  );
}

function isSketchDimensionTarget(
  value: unknown
): value is SketchDimensionTarget {
  return (
    isRecord(value) &&
    ((value.entityKind === "rectangle" &&
      (value.role === "width" || value.role === "height")) ||
      (value.entityKind === "circle" && value.role === "radius") ||
      (value.entityKind === "line" && value.role === "length"))
  );
}

function isSketchConstraintKind(value: unknown): value is SketchConstraintKind {
  return (
    value === "horizontal" ||
    value === "vertical" ||
    value === "fixed" ||
    value === "coincident" ||
    value === "midpoint" ||
    value === "parallel" ||
    value === "perpendicular" ||
    isAdvancedSketchConstraintKind(value)
  );
}

function isAdvancedSketchConstraintKind(
  value: unknown
): value is
  | "tangent"
  | "concentric"
  | "equalLength"
  | "equalRadius"
  | "angle"
  | "symmetry" {
  return (
    value === "tangent" ||
    value === "concentric" ||
    value === "equalLength" ||
    value === "equalRadius" ||
    value === "angle" ||
    value === "symmetry"
  );
}

function getAdvancedSketchConstraintLabel(
  kind: Extract<
    SketchConstraintKind,
    | "tangent"
    | "concentric"
    | "equalLength"
    | "equalRadius"
    | "angle"
    | "symmetry"
  >
): string {
  switch (kind) {
    case "tangent":
      return "Tangent";
    case "concentric":
      return "Concentric";
    case "equalLength":
      return "Equal length";
    case "equalRadius":
      return "Equal radius";
    case "angle":
      return "Angle";
    case "symmetry":
      return "Symmetry";
  }
}

function isSketchPointTarget(value: unknown): value is SketchPointTarget {
  return (
    isRecord(value) &&
    typeof value.entityId === "string" &&
    isSketchPointTargetRole(value.role)
  );
}

function isSketchDimensionValueInput(value: Record<string, unknown>): boolean {
  const hasLiteral = value.value !== undefined;
  const hasParameter = value.parameterId !== undefined;

  if (hasLiteral === hasParameter) {
    return false;
  }

  return hasLiteral
    ? typeof value.value === "number" && isPositiveFiniteNumber(value.value)
    : typeof value.parameterId === "string";
}

function isTopologyAnchorFaceProofInput(
  value: unknown
): value is CadTopologyAnchorCommandProof {
  return (
    isRecord(value) &&
    value.kind === "axisAlignedPlanarFace" &&
    value.entityKind === "face" &&
    value.evidenceSource === "checkpointSnapshot" &&
    value.exposesCheckpointLocalIds === false &&
    isPlanarAxis(value.planarAxis) &&
    typeof value.planarCoordinate === "number" &&
    Number.isFinite(value.planarCoordinate)
  );
}

function isTopologyAnchorEdgeProofInput(
  value: unknown
): value is CadTopologyAnchorCommandProof {
  return (
    isRecord(value) &&
    value.kind === "axisAlignedLinearEdge" &&
    value.entityKind === "edge" &&
    value.evidenceSource === "checkpointSnapshot" &&
    value.exposesCheckpointLocalIds === false &&
    isPlanarAxis(value.linearAxis) &&
    typeof value.length === "number" &&
    Number.isFinite(value.length) &&
    isTopologyEntityBounds(value.bounds)
  );
}

function isExtrudeSide(value: unknown): value is FeatureExtrudeSide {
  return value === "positive" || value === "negative" || value === "symmetric";
}

function isExtrudeOperationMode(
  value: unknown
): value is FeatureExtrudeOperationMode {
  return value === "newBody" || value === "add" || value === "cut";
}

function isRevolveOperationMode(
  value: unknown
): value is FeatureRevolveOperationMode {
  return value === "newBody" || value === "add" || value === "cut";
}

function isHoleDepthMode(value: unknown): value is FeatureHoleDepthMode {
  return value === "blind" || value === "throughAll";
}

function isHoleDirection(value: unknown): value is FeatureHoleDirection {
  return value === "positive" || value === "negative";
}

function hasExactlyOneEdgeReferenceInput(
  value: Record<string, unknown>
): boolean {
  const hasStableId =
    typeof value.edgeStableId === "string" &&
    value.namedReference === undefined &&
    value.topologyAnchorId === undefined &&
    value.topologyAnchorProof === undefined;
  const hasNamedReference =
    typeof value.namedReference === "string" &&
    value.edgeStableId === undefined &&
    value.topologyAnchorId === undefined &&
    value.topologyAnchorProof === undefined;
  const hasTopologyAnchor =
    typeof value.topologyAnchorId === "string" &&
    value.edgeStableId === undefined &&
    value.namedReference === undefined &&
    (value.topologyAnchorProof === undefined ||
      isTopologyAnchorEdgeProofInput(value.topologyAnchorProof));

  return (
    [hasStableId, hasNamedReference, hasTopologyAnchor].filter(Boolean)
      .length === 1
  );
}

function hasValidReferenceRepairTargetInput(
  value: Record<string, unknown>
): boolean {
  const hasGeneratedTarget =
    typeof value.bodyId === "string" &&
    typeof value.stableId === "string" &&
    value.topologyAnchorId === undefined;
  const hasTopologyAnchorTarget =
    typeof value.topologyAnchorId === "string" &&
    value.bodyId === undefined &&
    value.stableId === undefined;

  return hasGeneratedTarget || hasTopologyAnchorTarget;
}

function hasValidEdgeFinishFeatureReference(
  value: Record<string, unknown>
): boolean {
  const hasStableId = typeof value.edgeStableId === "string";
  const hasNamedReference = typeof value.namedReference === "string";
  const hasTopologyAnchor = typeof value.topologyAnchorId === "string";

  if (hasNamedReference) {
    return !hasStableId && !hasTopologyAnchor;
  }

  return hasStableId || hasTopologyAnchor;
}

function isFeatureRevolveAxis(value: unknown): value is FeatureRevolveAxis {
  return (
    isRecord(value) &&
    value.type === "sketchLine" &&
    typeof value.sketchId === "string" &&
    typeof value.entityId === "string"
  );
}

function isGeneratedExtrudeFaceRole(
  value: unknown
): value is CadGeneratedExtrudeFaceRole {
  return (
    value === "startCap" ||
    value === "endCap" ||
    value === "side:uMin" ||
    value === "side:uMax" ||
    value === "side:vMin" ||
    value === "side:vMax" ||
    value === "side:circular"
  );
}

function isGeneratedEntityKind(
  value: unknown
): value is CadGeneratedEntityKind {
  return (
    value === "body" ||
    value === "face" ||
    value === "edge" ||
    value === "vertex" ||
    value === "axis"
  );
}

function isGeneratedStableIdShapeForKind(
  bodyId: BodyId,
  stableId: string,
  kind: CadGeneratedEntityKind
): boolean {
  if (kind === "body") {
    return stableId === `generated:body:${bodyId}`;
  }

  const prefix = `generated:${kind}:${bodyId}:`;
  return stableId.startsWith(prefix) && stableId.length > prefix.length;
}

function isCadActorType(value: unknown): value is CadActorMetadata["type"] {
  return (
    value === "human" ||
    value === "agent" ||
    value === "script" ||
    value === "system"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function inferNextTransactionNumber(
  transactions: readonly Transaction[]
): number {
  let maxTransactionNumber = 0;

  for (const transaction of transactions) {
    maxTransactionNumber = Math.max(
      maxTransactionNumber,
      parseTransactionNumber(transaction.id)
    );
  }

  return maxTransactionNumber + 1;
}
