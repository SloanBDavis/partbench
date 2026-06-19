import { CadEngine } from "@web-cad/cad-core";
import { WCAD_SOURCE_IDENTITY_ALGORITHM } from "@web-cad/cad-protocol";
import type {
  CadActorMetadata,
  CadBatch,
  CadBatchMode,
  CadBatchResponse,
  CadBatchValidationError,
  CadAxisAlignedBounds,
  BodyMeasurementsSnapshot,
  BodyExtentSnapshot,
  CadAttachedSketchHealth,
  CadAuthoredChamferHealth,
  CadAuthoredExtrudeHealth,
  CadAuthoredFilletHealth,
  CadAuthoredHoleHealth,
  CadAuthoredRevolveHealth,
  CadBodyDerivedExactMetadataSnapshot,
  CadBodyExactMetadataSnapshot,
  CadBodySnapshot,
  CadBodyTopologySnapshot,
  CadDependencyHealthStatus,
  CadExportBodyReadiness,
  CadExportDiagnostic,
  CadExportFormatReadiness,
  CadExportReadinessStatus,
  CadFeatureSummary,
  CadReferenceHealthTarget,
  CadNamedReferenceHealth,
  CadSketchConstraintHealth,
  CadSketchDimensionHealth,
  CadSketchEvaluationHealth,
  CadGeneratedAxisReference,
  CadGeneratedBodyReference,
  CadGeneratedEdgeReference,
  CadGeneratedEntityKind,
  CadGeneratedFaceReference,
  CadGeneratedReference,
  CadGeneratedVertexReference,
  CadObjectSnapshot,
  CadObjectModelSource,
  CadOp,
  CadOpsVersion,
  CadParameterSnapshot,
  CadPartSnapshot,
  ProjectExactExportQueryResponse,
  ProjectExportReadinessQueryResponse,
  ProjectDependencyGraphQueryResponse,
  ProjectPackageReadinessQueryResponse,
  ProjectRebuildPlanQueryResponse,
  SketchEditReadinessQueryResponse,
  SketchSolverStatusQueryResponse,
  CadProjectSummaryExportSummary,
  CadProjectSummaryHealthSummary,
  CadProjectSummaryReferenceSummary,
  CadProjectSummaryStructureCounts,
  CadProjectSummaryWorkflowHint,
  CadQueryError,
  CadQueryRequest,
  CadQueryResponse,
  FeatureEditabilityQueryResponse,
  ReferenceHealthQueryResponse,
  CadSketchEditProposal,
  CadSelectionReferenceCandidate,
  CadSelectionReferenceInput,
  CadSelectionReferenceIssue,
  CadSelectionReferenceOperation,
  CadSelectionReferenceStatus,
  GeneratedReferenceMeasurement,
  NamedGeneratedReferenceEntry,
  NamedGeneratedReferenceSnapshot,
  ParameterId,
  SketchSnapshot,
  SketchDimensionEntry,
  SketchConstraintEntry,
  SketchEvaluationIssue,
  SketchDimensionStatus,
  SketchConstraintId,
  SketchConstraintKind,
  SketchDimensionId,
  SketchEntityId,
  SketchPointTarget,
  SketchPlane,
  CadTransactionAuditMetadata,
  CadTransactionHistoryEntry,
  DocumentUnits,
  FeatureExtrudeOperationMode,
  FeatureExtrudeSide,
  FeatureHoleDepthMode,
  FeatureHoleDirection,
  FeatureRevolveAxis,
  FeatureRevolveOperationMode,
  ObjectExtentSnapshot,
  ObjectMeasurementsSnapshot,
  ObjectId,
  ProjectExtentsWarning,
  Transform,
  Vec3,
  WcadSourceIdentity
} from "@web-cad/cad-protocol";

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

export type AgentAdapterVersion = "web-cad.agent-adapter.v1";

export interface CadOpsAgentRequest {
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly batch: CadBatch;
  readonly actor?: CadActorMetadata;
  readonly permissions?: CadOpsAgentPermissionPolicy;
  readonly source?: CadOpsAgentRequestSource;
}

export interface CadOpsAgentPermissionPolicy {
  readonly allowCommit?: boolean;
}

export interface CadOpsAgentRequestSource {
  readonly source: string;
  readonly toolName?: string;
}

export interface CadOpsAgentQueryRequest {
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly query: CadQueryRequest;
}

export interface CadOpsAgentV8ProjectSurfaceRequest {
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly exactExport?: CadOpsAgentV8ExactExportRequest;
}

export interface CadOpsAgentV8ExactExportRequest {
  readonly format: "step";
  readonly bodyIds?: readonly string[];
  readonly sourceIdentity?: WcadSourceIdentity;
}

export type CadOpsAgentResponse =
  | CadOpsAgentSuccessResponse
  | CadOpsAgentErrorResponse;

export interface CadOpsAgentSuccessResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly mode: CadBatchMode;
  readonly createdIds: readonly ObjectId[];
  readonly modifiedIds: readonly ObjectId[];
  readonly deletedIds: readonly ObjectId[];
  readonly createdSketchIds?: readonly string[];
  readonly modifiedSketchIds?: readonly string[];
  readonly deletedSketchIds?: readonly string[];
  readonly createdSketchEntityIds?: readonly string[];
  readonly modifiedSketchEntityIds?: readonly string[];
  readonly deletedSketchEntityIds?: readonly string[];
  readonly createdParameterIds?: readonly ParameterId[];
  readonly modifiedParameterIds?: readonly ParameterId[];
  readonly deletedParameterIds?: readonly ParameterId[];
  readonly createdSketchDimensionIds?: readonly SketchDimensionId[];
  readonly modifiedSketchDimensionIds?: readonly SketchDimensionId[];
  readonly deletedSketchDimensionIds?: readonly SketchDimensionId[];
  readonly createdSketchConstraintIds?: readonly SketchConstraintId[];
  readonly modifiedSketchConstraintIds?: readonly SketchConstraintId[];
  readonly deletedSketchConstraintIds?: readonly SketchConstraintId[];
  readonly createdFeatureIds?: readonly string[];
  readonly modifiedFeatureIds?: readonly string[];
  readonly deletedFeatureIds?: readonly string[];
  readonly createdBodyIds?: readonly string[];
  readonly modifiedBodyIds?: readonly string[];
  readonly deletedBodyIds?: readonly string[];
  readonly warnings: readonly string[];
  readonly transactionId?: string;
  readonly actor?: CadActorMetadata;
  readonly audit?: CadTransactionAuditMetadata;
  readonly review: CadOpsAgentWorkflowReview;
}

export interface CadOpsAgentErrorResponse {
  readonly ok: false;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly mode: CadBatchMode;
  readonly error: CadOpsAgentExecutionError;
  readonly errors: readonly CadOpsAgentExecutionError[];
  readonly createdIds: readonly ObjectId[];
  readonly modifiedIds: readonly ObjectId[];
  readonly deletedIds: readonly ObjectId[];
  readonly createdSketchIds?: readonly string[];
  readonly modifiedSketchIds?: readonly string[];
  readonly deletedSketchIds?: readonly string[];
  readonly createdSketchEntityIds?: readonly string[];
  readonly modifiedSketchEntityIds?: readonly string[];
  readonly deletedSketchEntityIds?: readonly string[];
  readonly createdParameterIds?: readonly ParameterId[];
  readonly modifiedParameterIds?: readonly ParameterId[];
  readonly deletedParameterIds?: readonly ParameterId[];
  readonly createdSketchDimensionIds?: readonly SketchDimensionId[];
  readonly modifiedSketchDimensionIds?: readonly SketchDimensionId[];
  readonly deletedSketchDimensionIds?: readonly SketchDimensionId[];
  readonly createdSketchConstraintIds?: readonly SketchConstraintId[];
  readonly modifiedSketchConstraintIds?: readonly SketchConstraintId[];
  readonly deletedSketchConstraintIds?: readonly SketchConstraintId[];
  readonly createdFeatureIds?: readonly string[];
  readonly modifiedFeatureIds?: readonly string[];
  readonly deletedFeatureIds?: readonly string[];
  readonly createdBodyIds?: readonly string[];
  readonly modifiedBodyIds?: readonly string[];
  readonly deletedBodyIds?: readonly string[];
  readonly warnings: readonly string[];
  readonly audit?: CadTransactionAuditMetadata;
  readonly review: CadOpsAgentWorkflowReview;
}

export type CadOpsAgentExecutionError =
  | CadBatchValidationError
  | CadOpsAgentPermissionError;

export interface CadOpsAgentPermissionError {
  readonly code: "COMMIT_NOT_ALLOWED";
  readonly message: string;
  readonly path?: string;
  readonly expected?: string;
  readonly received?: string;
}

export interface CadOpsAgentWorkflowReview {
  readonly requestedMode: CadBatchMode;
  readonly effectiveIntent: CadBatchMode;
  readonly operationCount: number;
  readonly entityChanges: CadOpsAgentEntityChangeSummary;
  readonly operations: readonly CadOpsAgentOperationReview[];
  readonly audit: CadOpsAgentReviewAuditSummary;
  readonly commitGate: CadOpsAgentCommitGateSummary;
  readonly hints: readonly CadOpsAgentReviewNotice[];
  readonly blockers: readonly CadOpsAgentReviewNotice[];
}

export interface CadOpsAgentEntityChangeSummary {
  readonly objects: CadOpsAgentEntityChangeCount;
  readonly sketches: CadOpsAgentEntityChangeCount;
  readonly sketchEntities: CadOpsAgentEntityChangeCount;
  readonly parameters: CadOpsAgentEntityChangeCount;
  readonly sketchDimensions: CadOpsAgentEntityChangeCount;
  readonly sketchConstraints: CadOpsAgentEntityChangeCount;
  readonly features: CadOpsAgentEntityChangeCount;
  readonly bodies: CadOpsAgentEntityChangeCount;
  readonly namedReferences: CadOpsAgentEntityChangeCount;
}

export interface CadOpsAgentEntityChangeCount {
  readonly created: number;
  readonly modified: number;
  readonly deleted: number;
}

export type CadOpsAgentOperationIntent =
  | "create"
  | "modify"
  | "delete"
  | "other";

export interface CadOpsAgentOperationReview {
  readonly index: number;
  readonly op: CadOp["op"];
  readonly intent: CadOpsAgentOperationIntent;
  readonly label: string;
  readonly destructive?: true;
  readonly objectId?: string;
  readonly parameterId?: string;
  readonly sketchId?: string;
  readonly sketchEntityId?: string;
  readonly sketchDimensionId?: string;
  readonly sketchConstraintId?: string;
  readonly featureId?: string;
  readonly bodyId?: string;
  readonly targetBodyId?: string;
  readonly referenceName?: string;
  readonly stableId?: string;
}

export interface CadOpsAgentReviewAuditSummary {
  readonly source: string;
  readonly requestId: string;
  readonly toolName?: string;
  readonly intent: CadBatchMode;
  readonly operationCount: number;
  readonly actor?: CadOpsAgentReviewActorSummary;
}

export interface CadOpsAgentReviewActorSummary {
  readonly type: CadActorMetadata["type"];
  readonly id?: string;
  readonly name?: string;
}

export interface CadOpsAgentCommitGateSummary {
  readonly commitsRequireExplicitPermission: true;
  readonly dryRunsRequirePermission: false;
  readonly permissionProvided: boolean;
  readonly blocked: boolean;
  readonly message: string;
}

export type CadOpsAgentReviewNoticeSeverity = "hint" | "warning" | "blocker";

export type CadOpsAgentReviewNoticeCode =
  | "VALIDATION_ERROR"
  | "EMPTY_BATCH"
  | "COMMIT_NOT_ALLOWED"
  | "DESTRUCTIVE_DELETE"
  | "WARNINGS_PRESENT";

export interface CadOpsAgentReviewNotice {
  readonly code: CadOpsAgentReviewNoticeCode;
  readonly severity: CadOpsAgentReviewNoticeSeverity;
  readonly message: string;
  readonly opIndex?: number;
  readonly op?: CadOp["op"];
  readonly errorCode?: CadBatchValidationError["code"];
  readonly path?: string;
}

export type CadOpsAgentQueryResponse =
  | CadOpsAgentParameterListQueryResponse
  | CadOpsAgentParameterGetQueryResponse
  | CadOpsAgentFeatureEditabilityQueryResponse
  | CadOpsAgentProjectSummaryQueryResponse
  | CadOpsAgentProjectFeaturesQueryResponse
  | CadOpsAgentProjectStructureQueryResponse
  | CadOpsAgentProjectHealthQueryResponse
  | CadOpsAgentProjectDependencyGraphQueryResponse
  | CadOpsAgentProjectRebuildPlanQueryResponse
  | CadOpsAgentProjectExportReadinessQueryResponse
  | CadOpsAgentProjectExactExportQueryResponse
  | CadOpsAgentProjectPackageReadinessQueryResponse
  | CadOpsAgentProjectSketchesQueryResponse
  | CadOpsAgentObjectGetQueryResponse
  | CadOpsAgentObjectMeasurementsQueryResponse
  | CadOpsAgentBodyTopologyQueryResponse
  | CadOpsAgentBodyMeasurementsQueryResponse
  | CadOpsAgentProjectExtentsQueryResponse
  | CadOpsAgentSketchGetQueryResponse
  | CadOpsAgentSketchEditReadinessQueryResponse
  | CadOpsAgentSketchSolverStatusQueryResponse
  | CadOpsAgentSketchEvaluationQueryResponse
  | CadOpsAgentSketchDimensionsQueryResponse
  | CadOpsAgentSketchDimensionGetQueryResponse
  | CadOpsAgentBodyGeneratedReferencesQueryResponse
  | CadOpsAgentBodyResolveGeneratedReferenceQueryResponse
  | CadOpsAgentBodyGeneratedReferenceMeasurementsQueryResponse
  | CadOpsAgentReferenceListNamedQueryResponse
  | CadOpsAgentReferenceResolveNamedQueryResponse
  | CadOpsAgentReferenceHealthQueryResponse
  | CadOpsAgentSelectionReferenceCandidatesQueryResponse
  | CadOpsAgentTransactionHistoryQueryResponse
  | CadOpsAgentQueryErrorResponse;

export interface CadOpsAgentParameterListQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "parameter.list";
  readonly parameterCount: number;
  readonly parameters: readonly CadParameterSnapshot[];
}

export interface CadOpsAgentParameterGetQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "parameter.get";
  readonly parameter: CadParameterSnapshot;
}

export interface CadOpsAgentFeatureEditabilityQueryResponse extends Omit<
  FeatureEditabilityQueryResponse,
  "ok"
> {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
}

export interface CadOpsAgentProjectSummaryQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "project.summary";
  readonly units: DocumentUnits;
  readonly objectCount: number;
  readonly objects: readonly CadObjectSnapshot[];
  readonly structure: CadProjectSummaryStructureCounts;
  readonly health: CadProjectSummaryHealthSummary;
  readonly references: CadProjectSummaryReferenceSummary;
  readonly exportReadiness: CadProjectSummaryExportSummary;
  readonly workflowHints: readonly CadProjectSummaryWorkflowHint[];
}

export interface CadOpsAgentProjectFeaturesQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "project.features";
  readonly featureCount: number;
  readonly features: readonly CadFeatureSummary[];
}

export interface CadOpsAgentProjectStructureQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "project.structure";
  readonly partCount: number;
  readonly featureCount: number;
  readonly bodyCount: number;
  readonly parts: readonly CadPartSnapshot[];
  readonly features: readonly CadFeatureSummary[];
  readonly bodies: readonly CadBodySnapshot[];
  readonly objectSources: readonly CadObjectModelSource[];
}

export interface CadOpsAgentProjectHealthQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "project.health";
  readonly status: CadDependencyHealthStatus;
  readonly issueCount: number;
  readonly authoredExtrudeCount: number;
  readonly authoredRevolveCount: number;
  readonly authoredHoleCount: number;
  readonly authoredChamferCount: number;
  readonly authoredFilletCount: number;
  readonly attachedSketchCount: number;
  readonly sketchEvaluationCount: number;
  readonly sketchDimensionCount: number;
  readonly sketchConstraintCount: number;
  readonly namedReferenceCount: number;
  readonly authoredExtrudes: readonly CadAuthoredExtrudeHealth[];
  readonly authoredRevolves: readonly CadAuthoredRevolveHealth[];
  readonly authoredHoles: readonly CadAuthoredHoleHealth[];
  readonly authoredChamfers: readonly CadAuthoredChamferHealth[];
  readonly authoredFillets: readonly CadAuthoredFilletHealth[];
  readonly attachedSketches: readonly CadAttachedSketchHealth[];
  readonly sketchEvaluations: readonly CadSketchEvaluationHealth[];
  readonly sketchDimensions: readonly CadSketchDimensionHealth[];
  readonly sketchConstraints: readonly CadSketchConstraintHealth[];
  readonly namedReferences: readonly CadNamedReferenceHealth[];
}

export interface CadOpsAgentProjectDependencyGraphQueryResponse extends Omit<
  ProjectDependencyGraphQueryResponse,
  "ok"
> {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
}

export interface CadOpsAgentProjectRebuildPlanQueryResponse extends Omit<
  ProjectRebuildPlanQueryResponse,
  "ok"
> {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
}

export interface CadOpsAgentProjectExportReadinessQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "project.exportReadiness";
  readonly status: CadExportReadinessStatus;
  readonly canExportFiles: boolean;
  readonly units: DocumentUnits;
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
  readonly formatCount: number;
  readonly formats: readonly CadExportFormatReadiness[];
  readonly bodyCount: number;
  readonly sourceSupportedBodyCount: number;
  readonly deferredBodyCount: number;
  readonly unavailableBodyCount: number;
  readonly bodies: readonly CadExportBodyReadiness[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadExportDiagnostic[];
}

export interface CadOpsAgentProjectExactExportQueryResponse extends Omit<
  ProjectExactExportQueryResponse,
  "ok" | "artifact"
> {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly artifactPolicy: CadOpsAgentExportArtifactPolicy;
}

export interface CadOpsAgentProjectPackageReadinessQueryResponse extends Omit<
  ProjectPackageReadinessQueryResponse,
  "ok"
> {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
}

export interface CadOpsAgentProjectSketchesQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "project.sketches";
  readonly sketchCount: number;
  readonly sketches: readonly SketchSnapshot[];
}

export interface CadOpsAgentObjectGetQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "object.get";
  readonly object: CadObjectSnapshot;
}

export interface CadOpsAgentObjectMeasurementsQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "object.measurements";
  readonly measurements: ObjectMeasurementsSnapshot;
}

export interface CadOpsAgentBodyMeasurementsQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "body.measurements";
  readonly measurements: BodyMeasurementsSnapshot;
}

export interface CadOpsAgentBodyTopologyQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "body.topology";
  readonly topology: CadBodyTopologySnapshot;
}

export interface CadOpsAgentProjectExtentsQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "project.extents";
  readonly units: DocumentUnits;
  readonly objectCount: number;
  readonly bodyCount: number;
  readonly bounds?: CadAxisAlignedBounds;
  readonly approximateVolume: number;
  readonly objects: readonly ObjectExtentSnapshot[];
  readonly bodies: readonly BodyExtentSnapshot[];
  readonly warnings: readonly ProjectExtentsWarning[];
}

export interface CadOpsAgentSketchGetQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "sketch.get";
  readonly sketch: SketchSnapshot;
}

export interface CadOpsAgentSketchEditReadinessQueryResponse extends Omit<
  SketchEditReadinessQueryResponse,
  "ok"
> {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
}

export interface CadOpsAgentSketchSolverStatusQueryResponse extends Omit<
  SketchSolverStatusQueryResponse,
  "ok"
> {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
}

export interface CadOpsAgentSketchEvaluationQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "sketch.evaluation";
  readonly sketchId: string;
  readonly sketchName: string;
  readonly plane: SketchPlane;
  readonly status: SketchDimensionStatus;
  readonly drivenEntityCount: number;
  readonly drivenEntityIds: readonly SketchEntityId[];
  readonly dimensionCount: number;
  readonly dimensions: readonly SketchDimensionEntry[];
  readonly constraintCount: number;
  readonly constraints: readonly SketchConstraintEntry[];
  readonly issueCount: number;
  readonly issues: readonly SketchEvaluationIssue[];
}

export interface CadOpsAgentSketchDimensionsQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "sketch.dimensions";
  readonly sketchId: string;
  readonly dimensionCount: number;
  readonly dimensions: readonly SketchDimensionEntry[];
}

export interface CadOpsAgentSketchDimensionGetQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "sketch.dimension.get";
  readonly dimension: SketchDimensionEntry;
}

export interface CadOpsAgentBodyGeneratedReferencesQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "body.generatedReferences";
  readonly body: CadGeneratedBodyReference;
  readonly faceCount: number;
  readonly faces: readonly CadGeneratedFaceReference[];
  readonly edgeCount: number;
  readonly edges: readonly CadGeneratedEdgeReference[];
  readonly vertexCount: number;
  readonly vertices: readonly CadGeneratedVertexReference[];
  readonly axisCount: number;
  readonly axes: readonly CadGeneratedAxisReference[];
}

export interface CadOpsAgentBodyResolveGeneratedReferenceQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "body.resolveGeneratedReference";
  readonly bodyId: string;
  readonly stableId: string;
  readonly kind: CadGeneratedEntityKind;
  readonly reference: CadGeneratedReference;
}

export interface CadOpsAgentBodyGeneratedReferenceMeasurementsQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "body.generatedReferenceMeasurements";
  readonly bodyId: string;
  readonly stableId: string;
  readonly kind: CadGeneratedEntityKind;
  readonly reference: CadGeneratedReference;
  readonly measurements: GeneratedReferenceMeasurement;
}

export interface CadOpsAgentReferenceListNamedQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "reference.listNamed";
  readonly referenceCount: number;
  readonly references: readonly NamedGeneratedReferenceEntry[];
}

export interface CadOpsAgentReferenceResolveNamedQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "reference.resolveNamed";
  readonly name: string;
  readonly target: NamedGeneratedReferenceSnapshot;
  readonly reference: CadGeneratedReference;
}

export interface CadOpsAgentReferenceHealthQueryResponse extends Omit<
  ReferenceHealthQueryResponse,
  "ok"
> {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
}

export interface CadOpsAgentSelectionReferenceCandidatesQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "selection.referenceCandidates";
  readonly selection: CadSelectionReferenceInput;
  readonly requiredOperation?: CadSelectionReferenceOperation;
  readonly status: CadSelectionReferenceStatus;
  readonly candidateCount: number;
  readonly candidates: readonly CadSelectionReferenceCandidate[];
  readonly issueCount: number;
  readonly issues: readonly CadSelectionReferenceIssue[];
}

export interface CadOpsAgentTransactionHistoryQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "transaction.history";
  readonly transactionCount: number;
  readonly transactions: readonly CadTransactionHistoryEntry[];
}

export interface CadOpsAgentQueryErrorResponse {
  readonly ok: false;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query:
    | "parameter.list"
    | "parameter.get"
    | "feature.editability"
    | "project.summary"
    | "project.features"
    | "project.structure"
    | "project.health"
    | "project.dependencyGraph"
    | "project.rebuildPlan"
    | "project.exportReadiness"
    | "project.exportExact"
    | "project.packageReadiness"
    | "project.sketches"
    | "object.get"
    | "object.measurements"
    | "body.topology"
    | "body.measurements"
    | "project.extents"
    | "sketch.get"
    | "sketch.editReadiness"
    | "sketch.solverStatus"
    | "sketch.evaluation"
    | "sketch.dimensions"
    | "sketch.dimension.get"
    | "body.generatedReferences"
    | "body.resolveGeneratedReference"
    | "body.generatedReferenceMeasurements"
    | "reference.listNamed"
    | "reference.resolveNamed"
    | "reference.health"
    | "selection.referenceCandidates"
    | "transaction.history";
  readonly error: CadQueryError;
}

export interface CadOpsAgentExportArtifactPolicy {
  readonly artifactBytesReturned: false;
  readonly fileWritesPerformed: false;
  readonly localLocationsAccepted: false;
  readonly browserHandlesAccepted: false;
  readonly requiresExplicitArtifactCapability: true;
  readonly delivery: "caller-or-browser-ui";
  readonly message: string;
}

export interface CadOpsAgentV8ProjectSurfaceResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly surface: "v8.agent_mcp_package_export";
  readonly project: CadOpsAgentV8ProjectSurfaceProjectSummary;
  readonly package: CadOpsAgentV8ProjectSurfacePackageSummary;
  readonly cache: CadOpsAgentV8ProjectSurfaceCacheSummary;
  readonly exportReadiness: CadOpsAgentV8ProjectSurfaceExportSummary;
  readonly exactExport?: CadOpsAgentV8ProjectSurfaceExactExportSummary;
  readonly fileWriting: CadOpsAgentV8ProjectSurfaceFileWritingBoundary;
  readonly boundaries: CadOpsAgentV8ProjectSurfaceBoundarySummary;
}

export interface CadOpsAgentV8ProjectSurfaceProjectSummary {
  readonly units: DocumentUnits;
  readonly objectCount: number;
  readonly bodyCount: number;
  readonly authoredBodyFeatureCount: number;
  readonly primitiveCompatibilityBodyCount: number;
}

export interface CadOpsAgentV8ProjectSurfacePackageSummary {
  readonly status: ProjectPackageReadinessQueryResponse["status"];
  readonly packageVersion: ProjectPackageReadinessQueryResponse["packageVersion"];
  readonly fileExtension: ProjectPackageReadinessQueryResponse["fileExtension"];
  readonly documentSchemaVersion: ProjectPackageReadinessQueryResponse["documentSchemaVersion"];
  readonly sourceIdentityAlgorithm: ProjectPackageReadinessQueryResponse["sourceIdentityAlgorithm"];
  readonly canRepresentCurrentSource: boolean;
  readonly requiresProjectSchemaMigration: boolean;
  readonly requiredEntryCount: number;
  readonly requiredEntries: ProjectPackageReadinessQueryResponse["requiredEntries"];
  readonly optionalCacheEntryCount: number;
  readonly optionalCacheEntries: ProjectPackageReadinessQueryResponse["optionalCacheEntries"];
  readonly capabilityCount: number;
  readonly capabilities: readonly CadOpsAgentV8ProjectSurfaceCapabilitySummary[];
  readonly diagnosticCount: number;
  readonly diagnostics: ProjectPackageReadinessQueryResponse["diagnostics"];
}

export interface CadOpsAgentV8ProjectSurfaceCapabilitySummary {
  readonly capability: ProjectPackageReadinessQueryResponse["capabilities"][number]["capability"];
  readonly label: string;
  readonly status: ProjectPackageReadinessQueryResponse["capabilities"][number]["status"];
  readonly available: boolean;
  readonly diagnosticCount: number;
  readonly diagnosticCodes: readonly string[];
}

export interface CadOpsAgentV8ProjectSurfaceCacheSummary {
  readonly cachePolicy: "optional-rebuildable";
  readonly opfsCapabilityStatus?: ProjectPackageReadinessQueryResponse["capabilities"][number]["status"];
  readonly opfsCapabilityAvailable?: boolean;
  readonly opfsLocationsExposed: false;
  readonly clearMutatesSource: false;
  readonly sourceIdentityIncludesCache: false;
  readonly diagnosticCount: number;
  readonly diagnostics: ProjectPackageReadinessQueryResponse["diagnostics"];
}

export interface CadOpsAgentV8ProjectSurfaceExportSummary {
  readonly status: CadExportReadinessStatus;
  readonly canExportFiles: boolean;
  readonly units: DocumentUnits;
  readonly formatCount: number;
  readonly formats: readonly CadOpsAgentV8ProjectSurfaceFormatSummary[];
  readonly bodyCount: number;
  readonly sourceSupportedBodyCount: number;
  readonly deferredBodyCount: number;
  readonly unavailableBodyCount: number;
  readonly unsupportedBodyCount: number;
  readonly unsupportedBodies: readonly CadOpsAgentV8ProjectSurfaceUnsupportedBodySummary[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadExportDiagnostic[];
}

export interface CadOpsAgentV8ProjectSurfaceFormatSummary {
  readonly format: CadExportFormatReadiness["format"];
  readonly label: string;
  readonly exportKind: CadExportFormatReadiness["exportKind"];
  readonly status: CadExportReadinessStatus;
  readonly available: boolean;
  readonly writerStatus: CadExportFormatReadiness["writerStatus"];
  readonly fileExtensions: readonly string[];
  readonly sourceSupportedBodyCount: number;
  readonly deferredBodyCount: number;
  readonly unavailableBodyCount: number;
  readonly diagnosticCount: number;
  readonly diagnosticCodes: readonly string[];
}

export interface CadOpsAgentV8ProjectSurfaceUnsupportedBodySummary {
  readonly bodyId: string;
  readonly bodyName?: string;
  readonly bodyKind: CadExportBodyReadiness["bodyKind"];
  readonly featureId: string;
  readonly sourceKind: CadExportBodyReadiness["sourceKind"];
  readonly status: CadExportReadinessStatus;
  readonly consumedByFeatureId?: string;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadExportDiagnostic[];
}

export interface CadOpsAgentV8ProjectSurfaceExactExportSummary {
  readonly format: "step";
  readonly status: CadExportReadinessStatus;
  readonly available: boolean;
  readonly canExportFile: boolean;
  readonly writerStatus: ProjectExactExportQueryResponse["writerStatus"];
  readonly requestedBodyIds: readonly string[];
  readonly bodyCount: number;
  readonly sourceSupportedBodyCount: number;
  readonly deferredBodyCount: number;
  readonly unavailableBodyCount: number;
  readonly exportableBodyCount: number;
  readonly exportSourceCount: number;
  readonly exportSources: ProjectExactExportQueryResponse["exportSources"];
  readonly unsupportedBodyCount: number;
  readonly unsupportedBodies: readonly CadOpsAgentV8ProjectSurfaceUnsupportedBodySummary[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadExportDiagnostic[];
  readonly artifactPolicy: CadOpsAgentExportArtifactPolicy;
}

export interface CadOpsAgentV8ProjectSurfaceFileWritingBoundary {
  readonly defaultBehavior: "readiness-only";
  readonly adapterWritesUserVisibleFiles: false;
  readonly mcpWritesUserVisibleFiles: false;
  readonly artifactBytesReturned: false;
  readonly localLocationsAccepted: false;
  readonly browserHandlesAccepted: false;
  readonly opfsLocationsAccepted: false;
  readonly futureFileWritesRequireExplicitCapability: true;
  readonly message: string;
}

export interface CadOpsAgentV8ProjectSurfaceBoundarySummary {
  readonly browserHandlesExposed: false;
  readonly localLocationsExposed: false;
  readonly opfsLocationsExposed: false;
  readonly rendererInternalsExposed: false;
  readonly meshInternalsExposed: false;
  readonly occtInternalsExposed: false;
  readonly viewportStateExposed: false;
  readonly selectionBufferInternalsExposed: false;
  readonly packageBinaryReturned: false;
  readonly stepBytesReturned: false;
  readonly jsonImportExportPreserved: true;
}

export class CadOpsAgentAdapter {
  constructor(private readonly engine: CadEngine = new CadEngine()) {}

  execute(request: CadOpsAgentRequest): CadOpsAgentResponse {
    const effectiveRequest = applyAgentRequestContext(request);
    const permissionError = validateAgentPermissions(effectiveRequest);

    if (permissionError) {
      return createAgentPermissionErrorResponse(
        effectiveRequest,
        permissionError
      );
    }

    return toAgentResponse(
      effectiveRequest,
      this.engine.executeBatch(effectiveRequest.batch)
    );
  }

  query(request: CadOpsAgentQueryRequest): CadOpsAgentQueryResponse {
    return toAgentQueryResponse(
      request,
      this.engine.executeQuery(request.query)
    );
  }

  inspectV8ProjectSurface(
    request: CadOpsAgentV8ProjectSurfaceRequest
  ): CadOpsAgentV8ProjectSurfaceResponse {
    return createV8ProjectSurfaceResponse(request, this.engine);
  }

  executeJson(json: string): string {
    return JSON.stringify(
      this.execute(parseCadOpsAgentRequestJson(json)),
      null,
      2
    );
  }

  queryJson(json: string): string {
    return JSON.stringify(
      this.query(parseCadOpsAgentQueryRequestJson(json)),
      null,
      2
    );
  }

  inspectV8ProjectSurfaceJson(json: string): string {
    return JSON.stringify(
      this.inspectV8ProjectSurface(
        parseCadOpsAgentV8ProjectSurfaceRequestJson(json)
      ),
      null,
      2
    );
  }

  getEngine(): CadEngine {
    return this.engine;
  }
}

export function createCadOpsAgentAdapter(
  engine = new CadEngine()
): CadOpsAgentAdapter {
  return new CadOpsAgentAdapter(engine);
}

export function executeCadOpsAgentRequest(
  engine: CadEngine,
  request: CadOpsAgentRequest
): CadOpsAgentResponse {
  return new CadOpsAgentAdapter(engine).execute(request);
}

export function executeCadOpsAgentQueryRequest(
  engine: CadEngine,
  request: CadOpsAgentQueryRequest
): CadOpsAgentQueryResponse {
  return new CadOpsAgentAdapter(engine).query(request);
}

export function inspectCadOpsAgentV8ProjectSurface(
  engine: CadEngine,
  request: CadOpsAgentV8ProjectSurfaceRequest
): CadOpsAgentV8ProjectSurfaceResponse {
  return new CadOpsAgentAdapter(engine).inspectV8ProjectSurface(request);
}

export function parseCadOpsAgentRequestJson(json: string): CadOpsAgentRequest {
  return parseCadOpsAgentRequest(JSON.parse(json));
}

export function parseCadOpsAgentQueryRequestJson(
  json: string
): CadOpsAgentQueryRequest {
  return parseCadOpsAgentQueryRequest(JSON.parse(json));
}

export function parseCadOpsAgentV8ProjectSurfaceRequestJson(
  json: string
): CadOpsAgentV8ProjectSurfaceRequest {
  return parseCadOpsAgentV8ProjectSurfaceRequest(JSON.parse(json));
}

export function parseCadOpsAgentRequest(value: unknown): CadOpsAgentRequest {
  if (!isCadOpsAgentRequest(value)) {
    throw new Error("Invalid CADOps agent adapter request.");
  }

  return value;
}

export function parseCadOpsAgentQueryRequest(
  value: unknown
): CadOpsAgentQueryRequest {
  if (!isCadOpsAgentQueryRequest(value)) {
    throw new Error("Invalid CADOps agent adapter query request.");
  }

  return value;
}

export function parseCadOpsAgentV8ProjectSurfaceRequest(
  value: unknown
): CadOpsAgentV8ProjectSurfaceRequest {
  if (!isCadOpsAgentV8ProjectSurfaceRequest(value)) {
    throw new Error("Invalid CADOps agent V8 project surface request.");
  }

  return value;
}

function toAgentResponse(
  request: CadOpsAgentRequest,
  response: CadBatchResponse
): CadOpsAgentResponse {
  const review = createAgentWorkflowReview(request, { response });

  if (!response.ok) {
    return {
      ok: false,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: request.batch.version,
      mode: response.mode,
      error: response.error,
      errors: response.errors,
      createdIds: response.createdIds,
      modifiedIds: response.modifiedIds,
      deletedIds: response.deletedIds,
      ...toAgentDiffIds(response),
      warnings: response.warnings,
      ...(request.batch.audit ? { audit: request.batch.audit } : {}),
      review
    };
  }

  return {
    ok: true,
    requestId: request.requestId,
    adapterVersion: request.adapterVersion,
    cadOpsVersion: request.batch.version,
    mode: response.mode,
    createdIds: response.createdIds,
    modifiedIds: response.modifiedIds,
    deletedIds: response.deletedIds,
    ...toAgentDiffIds(response),
    warnings: response.warnings,
    transactionId: response.transactionId,
    ...(response.actor ? { actor: response.actor } : {}),
    ...(response.audit ? { audit: response.audit } : {}),
    review
  };
}

function toAgentDiffIds(response: CadBatchResponse): {
  readonly createdSketchIds?: readonly string[];
  readonly modifiedSketchIds?: readonly string[];
  readonly deletedSketchIds?: readonly string[];
  readonly createdSketchEntityIds?: readonly string[];
  readonly modifiedSketchEntityIds?: readonly string[];
  readonly deletedSketchEntityIds?: readonly string[];
  readonly createdParameterIds?: readonly ParameterId[];
  readonly modifiedParameterIds?: readonly ParameterId[];
  readonly deletedParameterIds?: readonly ParameterId[];
  readonly createdSketchDimensionIds?: readonly SketchDimensionId[];
  readonly modifiedSketchDimensionIds?: readonly SketchDimensionId[];
  readonly deletedSketchDimensionIds?: readonly SketchDimensionId[];
  readonly createdFeatureIds?: readonly string[];
  readonly modifiedFeatureIds?: readonly string[];
  readonly deletedFeatureIds?: readonly string[];
  readonly createdBodyIds?: readonly string[];
  readonly modifiedBodyIds?: readonly string[];
  readonly deletedBodyIds?: readonly string[];
} {
  return {
    ...(response.createdSketchIds
      ? { createdSketchIds: response.createdSketchIds }
      : {}),
    ...(response.modifiedSketchIds
      ? { modifiedSketchIds: response.modifiedSketchIds }
      : {}),
    ...(response.deletedSketchIds
      ? { deletedSketchIds: response.deletedSketchIds }
      : {}),
    ...(response.createdSketchEntityIds
      ? { createdSketchEntityIds: response.createdSketchEntityIds }
      : {}),
    ...(response.modifiedSketchEntityIds
      ? { modifiedSketchEntityIds: response.modifiedSketchEntityIds }
      : {}),
    ...(response.deletedSketchEntityIds
      ? { deletedSketchEntityIds: response.deletedSketchEntityIds }
      : {}),
    ...(response.createdParameterIds
      ? { createdParameterIds: response.createdParameterIds }
      : {}),
    ...(response.modifiedParameterIds
      ? { modifiedParameterIds: response.modifiedParameterIds }
      : {}),
    ...(response.deletedParameterIds
      ? { deletedParameterIds: response.deletedParameterIds }
      : {}),
    ...(response.createdSketchDimensionIds
      ? { createdSketchDimensionIds: response.createdSketchDimensionIds }
      : {}),
    ...(response.modifiedSketchDimensionIds
      ? { modifiedSketchDimensionIds: response.modifiedSketchDimensionIds }
      : {}),
    ...(response.deletedSketchDimensionIds
      ? { deletedSketchDimensionIds: response.deletedSketchDimensionIds }
      : {}),
    ...(response.createdSketchConstraintIds
      ? { createdSketchConstraintIds: response.createdSketchConstraintIds }
      : {}),
    ...(response.modifiedSketchConstraintIds
      ? { modifiedSketchConstraintIds: response.modifiedSketchConstraintIds }
      : {}),
    ...(response.deletedSketchConstraintIds
      ? { deletedSketchConstraintIds: response.deletedSketchConstraintIds }
      : {}),
    ...(response.createdFeatureIds
      ? { createdFeatureIds: response.createdFeatureIds }
      : {}),
    ...(response.modifiedFeatureIds
      ? { modifiedFeatureIds: response.modifiedFeatureIds }
      : {}),
    ...(response.deletedFeatureIds
      ? { deletedFeatureIds: response.deletedFeatureIds }
      : {}),
    ...(response.createdBodyIds
      ? { createdBodyIds: response.createdBodyIds }
      : {}),
    ...(response.modifiedBodyIds
      ? { modifiedBodyIds: response.modifiedBodyIds }
      : {}),
    ...(response.deletedBodyIds
      ? { deletedBodyIds: response.deletedBodyIds }
      : {})
  };
}

const DEFAULT_AGENT_ACTOR: CadActorMetadata = {
  type: "agent",
  id: "agent-adapter",
  name: "Agent Adapter"
};

function applyAgentRequestContext(
  request: CadOpsAgentRequest
): CadOpsAgentRequest {
  const actor = request.actor ?? request.batch.actor ?? DEFAULT_AGENT_ACTOR;
  const audit = createAgentAuditMetadata(request);

  return {
    ...request,
    batch: {
      ...request.batch,
      actor,
      audit
    }
  };
}

function validateAgentPermissions(
  request: CadOpsAgentRequest
): CadOpsAgentPermissionError | undefined {
  if (request.batch.mode !== "commit" || request.permissions?.allowCommit) {
    return undefined;
  }

  return {
    code: "COMMIT_NOT_ALLOWED",
    message:
      "CADOps commit was blocked by adapter policy. Set permissions.allowCommit to true to explicitly allow this commit.",
    path: "$.permissions.allowCommit",
    expected: "true",
    received: String(request.permissions?.allowCommit ?? false)
  };
}

function createAgentPermissionErrorResponse(
  request: CadOpsAgentRequest,
  error: CadOpsAgentPermissionError
): CadOpsAgentErrorResponse {
  const review = createAgentWorkflowReview(request, { permissionError: error });

  return {
    ok: false,
    requestId: request.requestId,
    adapterVersion: request.adapterVersion,
    cadOpsVersion: request.batch.version,
    mode: request.batch.mode,
    error,
    errors: [error],
    createdIds: [],
    modifiedIds: [],
    deletedIds: [],
    warnings: [],
    ...(request.batch.audit ? { audit: request.batch.audit } : {}),
    review
  };
}

function createAgentAuditMetadata(
  request: CadOpsAgentRequest
): CadTransactionAuditMetadata {
  return {
    source: request.source?.source ?? "agent-adapter",
    requestId: request.requestId,
    ...(request.source?.toolName ? { toolName: request.source.toolName } : {}),
    intent: request.batch.mode,
    operationCount: request.batch.ops.length
  };
}

function createAgentWorkflowReview(
  request: CadOpsAgentRequest,
  options: {
    readonly response?: CadBatchResponse;
    readonly permissionError?: CadOpsAgentPermissionError;
  }
): CadOpsAgentWorkflowReview {
  const warnings = options.response?.warnings ?? [];
  const blockers = createReviewBlockers(request, options);
  const hints = createReviewHints(request, warnings);

  return {
    requestedMode: request.batch.mode,
    effectiveIntent: options.response?.mode ?? request.batch.mode,
    operationCount: request.batch.ops.length,
    entityChanges: createEntityChangeSummary(
      options.response,
      request.batch.ops
    ),
    operations: request.batch.ops.map((op, index) =>
      createOperationReview(index, op)
    ),
    audit: createReviewAuditSummary(request),
    commitGate: createCommitGateSummary(request),
    hints,
    blockers
  };
}

function createEntityChangeSummary(
  response: CadBatchResponse | undefined,
  ops: readonly CadOp[]
): CadOpsAgentEntityChangeSummary {
  const namedReferenceCounts =
    response?.ok === true
      ? {
          created: ops.filter((op) => op.op === "reference.nameGenerated")
            .length,
          modified: ops.filter((op) => op.op === "reference.repairName").length,
          deleted: ops.filter((op) => op.op === "reference.deleteName").length
        }
      : emptyChangeCount();

  return {
    objects: createChangeCount(
      response?.createdIds,
      response?.modifiedIds,
      response?.deletedIds
    ),
    sketches: createChangeCount(
      response?.createdSketchIds,
      response?.modifiedSketchIds,
      response?.deletedSketchIds
    ),
    sketchEntities: createChangeCount(
      response?.createdSketchEntityIds,
      response?.modifiedSketchEntityIds,
      response?.deletedSketchEntityIds
    ),
    parameters: createChangeCount(
      response?.createdParameterIds,
      response?.modifiedParameterIds,
      response?.deletedParameterIds
    ),
    sketchDimensions: createChangeCount(
      response?.createdSketchDimensionIds,
      response?.modifiedSketchDimensionIds,
      response?.deletedSketchDimensionIds
    ),
    sketchConstraints: createChangeCount(
      response?.createdSketchConstraintIds,
      response?.modifiedSketchConstraintIds,
      response?.deletedSketchConstraintIds
    ),
    features: createChangeCount(
      response?.createdFeatureIds,
      response?.modifiedFeatureIds,
      response?.deletedFeatureIds
    ),
    bodies: createChangeCount(
      response?.createdBodyIds,
      response?.modifiedBodyIds,
      response?.deletedBodyIds
    ),
    namedReferences: namedReferenceCounts
  };
}

function createChangeCount(
  created: readonly unknown[] | undefined,
  modified: readonly unknown[] | undefined,
  deleted: readonly unknown[] | undefined
): CadOpsAgentEntityChangeCount {
  return {
    created: created?.length ?? 0,
    modified: modified?.length ?? 0,
    deleted: deleted?.length ?? 0
  };
}

function emptyChangeCount(): CadOpsAgentEntityChangeCount {
  return {
    created: 0,
    modified: 0,
    deleted: 0
  };
}

function createReviewAuditSummary(
  request: CadOpsAgentRequest
): CadOpsAgentReviewAuditSummary {
  const audit = request.batch.audit ?? createAgentAuditMetadata(request);

  return {
    source: audit.source ?? request.source?.source ?? "agent-adapter",
    requestId: audit.requestId ?? request.requestId,
    ...(audit.toolName ? { toolName: audit.toolName } : {}),
    intent: audit.intent,
    operationCount: audit.operationCount,
    ...(request.batch.actor
      ? {
          actor: {
            type: request.batch.actor.type,
            ...(request.batch.actor.id ? { id: request.batch.actor.id } : {}),
            ...(request.batch.actor.name
              ? { name: request.batch.actor.name }
              : {})
          }
        }
      : {})
  };
}

function createCommitGateSummary(
  request: CadOpsAgentRequest
): CadOpsAgentCommitGateSummary {
  const permissionProvided = request.permissions?.allowCommit === true;
  const blocked = request.batch.mode === "commit" && !permissionProvided;

  return {
    commitsRequireExplicitPermission: true,
    dryRunsRequirePermission: false,
    permissionProvided,
    blocked,
    message:
      request.batch.mode === "dryRun"
        ? "Dry-run requested; commit permission is not required."
        : permissionProvided
          ? "Commit requested and explicitly allowed by adapter permissions."
          : "Commit requested but blocked because permissions.allowCommit is not true."
  };
}

function createReviewBlockers(
  request: CadOpsAgentRequest,
  options: {
    readonly response?: CadBatchResponse;
    readonly permissionError?: CadOpsAgentPermissionError;
  }
): readonly CadOpsAgentReviewNotice[] {
  const blockers: CadOpsAgentReviewNotice[] = [];

  if (request.batch.ops.length === 0) {
    blockers.push({
      code: "EMPTY_BATCH",
      severity: "blocker",
      message: "Batch has no operations to review or execute."
    });
  }

  if (options.permissionError) {
    blockers.push({
      code: "COMMIT_NOT_ALLOWED",
      severity: "blocker",
      message: options.permissionError.message,
      path: options.permissionError.path
    });
  }

  if (options.response && !options.response.ok) {
    for (const error of options.response.errors) {
      const code =
        error.code === "EMPTY_BATCH" ? "EMPTY_BATCH" : "VALIDATION_ERROR";

      if (
        code === "EMPTY_BATCH" &&
        blockers.some((blocker) => blocker.code === "EMPTY_BATCH")
      ) {
        continue;
      }

      blockers.push({
        code,
        severity: "blocker",
        message: `${error.code}: ${error.message}`,
        ...(error.opIndex !== undefined ? { opIndex: error.opIndex } : {}),
        ...(error.op ? { op: error.op } : {}),
        errorCode: error.code,
        ...(error.path ? { path: error.path } : {})
      });
    }
  }

  return blockers;
}

function createReviewHints(
  request: CadOpsAgentRequest,
  warnings: readonly string[]
): readonly CadOpsAgentReviewNotice[] {
  const hints: CadOpsAgentReviewNotice[] = [];
  const destructiveOps = request.batch.ops
    .map((op, index) => ({ op, index }))
    .filter(({ op }) => isDestructiveOperation(op));

  if (destructiveOps.length > 0) {
    const first = destructiveOps[0];

    hints.push({
      code: "DESTRUCTIVE_DELETE",
      severity: "warning",
      message: `Batch includes ${destructiveOps.length} destructive delete operation(s); review targets before commit.`,
      opIndex: first.index,
      op: first.op.op
    });
  }

  if (warnings.length > 0) {
    hints.push({
      code: "WARNINGS_PRESENT",
      severity: "warning",
      message: `CADOps returned ${warnings.length} warning(s); review warnings before commit.`
    });
  }

  return hints;
}

function createOperationReview(
  index: number,
  op: CadOp
): CadOpsAgentOperationReview {
  switch (op.op) {
    case "document.updateUnits":
      return operationReviewBase(
        index,
        op,
        "modify",
        `Set document units to ${op.units}`
      );

    case "parameter.create":
      return {
        ...operationReviewBase(
          index,
          op,
          "create",
          `Create parameter ${op.id ?? op.name}`
        ),
        ...(op.id ? { parameterId: op.id } : {})
      };

    case "parameter.update":
      return {
        ...operationReviewBase(
          index,
          op,
          "modify",
          `Update parameter ${op.id}`
        ),
        parameterId: op.id
      };

    case "parameter.rename":
      return {
        ...operationReviewBase(
          index,
          op,
          "modify",
          `Rename parameter ${op.id}`
        ),
        parameterId: op.id
      };

    case "parameter.delete":
      return {
        ...operationReviewBase(
          index,
          op,
          "delete",
          `Delete parameter ${op.id}`
        ),
        parameterId: op.id
      };

    case "scene.createBox":
      return createObjectCreateOperationReview(index, op, "box");

    case "scene.createCylinder":
      return createObjectCreateOperationReview(index, op, "cylinder");

    case "scene.createSphere":
      return createObjectCreateOperationReview(index, op, "sphere");

    case "scene.createCone":
      return createObjectCreateOperationReview(index, op, "cone");

    case "scene.createTorus":
      return createObjectCreateOperationReview(index, op, "torus");

    case "scene.deleteObject":
      return {
        ...operationReviewBase(index, op, "delete", `Delete object ${op.id}`),
        objectId: op.id
      };

    case "scene.updateTransform":
      return {
        ...operationReviewBase(
          index,
          op,
          "modify",
          `Update transform for ${op.id}`
        ),
        objectId: op.id
      };

    case "scene.updateBoxDimensions":
      return createObjectUpdateOperationReview(index, op, "box");

    case "scene.updateCylinderDimensions":
      return createObjectUpdateOperationReview(index, op, "cylinder");

    case "scene.updateSphereDimensions":
      return createObjectUpdateOperationReview(index, op, "sphere");

    case "scene.updateConeDimensions":
      return createObjectUpdateOperationReview(index, op, "cone");

    case "scene.updateTorusDimensions":
      return createObjectUpdateOperationReview(index, op, "torus");

    case "scene.renameObject":
      return {
        ...operationReviewBase(index, op, "modify", `Rename object ${op.id}`),
        objectId: op.id
      };

    case "sketch.create":
      return {
        ...operationReviewBase(
          index,
          op,
          "create",
          `Create sketch ${op.id ?? op.name} on ${op.plane}`
        ),
        ...(op.id ? { sketchId: op.id } : {})
      };

    case "sketch.createOnFace": {
      const target = op.referenceName
        ? `named reference ${op.referenceName}`
        : op.faceStableId
          ? `face ${op.faceStableId}`
          : op.bodyId
            ? `face on ${op.bodyId}`
            : "selected face";

      return {
        ...operationReviewBase(
          index,
          op,
          "create",
          `Create sketch ${op.id ?? op.name} on ${target}`
        ),
        ...(op.id ? { sketchId: op.id } : {}),
        ...(op.bodyId ? { bodyId: op.bodyId } : {}),
        ...(op.referenceName ? { referenceName: op.referenceName } : {}),
        ...(op.faceStableId ? { stableId: op.faceStableId } : {})
      };
    }

    case "sketch.rename":
      return {
        ...operationReviewBase(index, op, "modify", `Rename sketch ${op.id}`),
        sketchId: op.id
      };

    case "sketch.delete":
      return {
        ...operationReviewBase(index, op, "delete", `Delete sketch ${op.id}`),
        sketchId: op.id
      };

    case "sketch.addPoint":
      return createSketchEntityAddOperationReview(index, op, "point");

    case "sketch.addLine":
      return createSketchEntityAddOperationReview(index, op, "line");

    case "sketch.addRectangle":
      return createSketchEntityAddOperationReview(index, op, "rectangle");

    case "sketch.addCircle":
      return createSketchEntityAddOperationReview(index, op, "circle");

    case "sketch.updateEntity":
      return {
        ...operationReviewBase(
          index,
          op,
          "modify",
          `Update ${op.entity.kind} ${op.entity.id} in ${op.sketchId}`
        ),
        sketchId: op.sketchId,
        sketchEntityId: op.entity.id
      };

    case "sketch.deleteEntity":
      return {
        ...operationReviewBase(
          index,
          op,
          "delete",
          `Delete entity ${op.entityId} from ${op.sketchId}`
        ),
        sketchId: op.sketchId,
        sketchEntityId: op.entityId
      };

    case "sketch.dimension.create":
      return {
        ...operationReviewBase(
          index,
          op,
          "create",
          `Create sketch dimension ${op.id ?? op.name} on ${op.sketchId}/${op.entityId}`
        ),
        ...(op.id ? { sketchDimensionId: op.id } : {}),
        sketchId: op.sketchId,
        sketchEntityId: op.entityId
      };

    case "sketch.dimension.update":
      return {
        ...operationReviewBase(
          index,
          op,
          "modify",
          `Update sketch dimension ${op.id}`
        ),
        sketchDimensionId: op.id
      };

    case "sketch.dimension.rename":
      return {
        ...operationReviewBase(
          index,
          op,
          "modify",
          `Rename sketch dimension ${op.id}`
        ),
        sketchDimensionId: op.id
      };

    case "sketch.dimension.delete":
      return {
        ...operationReviewBase(
          index,
          op,
          "delete",
          `Delete sketch dimension ${op.id}`
        ),
        sketchDimensionId: op.id
      };

    case "sketch.constraint.create":
      return {
        ...operationReviewBase(
          index,
          op,
          "create",
          `Create ${op.kind} sketch constraint ${op.id ?? op.name} on ${op.sketchId}`
        ),
        ...(op.id ? { sketchConstraintId: op.id } : {}),
        sketchId: op.sketchId
      };

    case "sketch.constraint.rename":
      return {
        ...operationReviewBase(
          index,
          op,
          "modify",
          `Rename sketch constraint ${op.id}`
        ),
        sketchConstraintId: op.id
      };

    case "sketch.constraint.delete":
      return {
        ...operationReviewBase(
          index,
          op,
          "delete",
          `Delete sketch constraint ${op.id}`
        ),
        sketchConstraintId: op.id
      };

    case "feature.extrude": {
      const operationMode = op.operationMode ?? "newBody";
      const operationLabel =
        operationMode === "newBody" ? "new body" : operationMode;

      return {
        ...operationReviewBase(
          index,
          op,
          "create",
          `Create ${operationLabel} extrude feature ${op.id ?? "with generated ID"} from ${op.sketchId}/${op.entityId}`
        ),
        ...(op.id ? { featureId: op.id } : {}),
        ...(op.bodyId ? { bodyId: op.bodyId } : {}),
        ...(op.targetBodyId ? { targetBodyId: op.targetBodyId } : {}),
        sketchId: op.sketchId,
        sketchEntityId: op.entityId
      };
    }

    case "feature.revolve":
      return {
        ...operationReviewBase(
          index,
          op,
          "create",
          `Create revolve feature ${op.id ?? "with generated ID"} from ${op.sketchId}/${op.entityId}`
        ),
        ...(op.id ? { featureId: op.id } : {}),
        ...(op.bodyId ? { bodyId: op.bodyId } : {}),
        ...(op.targetBodyId ? { targetBodyId: op.targetBodyId } : {}),
        sketchId: op.sketchId,
        sketchEntityId: op.entityId
      };

    case "feature.hole":
      return {
        ...operationReviewBase(
          index,
          op,
          "create",
          `Create hole feature ${op.id ?? "with generated ID"} from ${op.sketchId}/${op.circleEntityId} into ${op.targetBodyId}`
        ),
        ...(op.id ? { featureId: op.id } : {}),
        ...(op.bodyId ? { bodyId: op.bodyId } : {}),
        targetBodyId: op.targetBodyId,
        sketchId: op.sketchId,
        sketchEntityId: op.circleEntityId
      };

    case "feature.chamfer": {
      const target = op.namedReference
        ? `named reference ${op.namedReference}`
        : op.edgeStableId;

      return {
        ...operationReviewBase(
          index,
          op,
          "create",
          `Create chamfer feature ${op.id ?? "with generated ID"} on ${target} of ${op.targetBodyId}`
        ),
        ...(op.id ? { featureId: op.id } : {}),
        ...(op.bodyId ? { bodyId: op.bodyId } : {}),
        targetBodyId: op.targetBodyId,
        ...(op.namedReference ? { referenceName: op.namedReference } : {}),
        ...(op.edgeStableId ? { stableId: op.edgeStableId } : {})
      };
    }

    case "feature.fillet": {
      const target = op.namedReference
        ? `named reference ${op.namedReference}`
        : op.edgeStableId;

      return {
        ...operationReviewBase(
          index,
          op,
          "create",
          `Create fillet feature ${op.id ?? "with generated ID"} on ${target} of ${op.targetBodyId}`
        ),
        ...(op.id ? { featureId: op.id } : {}),
        ...(op.bodyId ? { bodyId: op.bodyId } : {}),
        targetBodyId: op.targetBodyId,
        ...(op.namedReference ? { referenceName: op.namedReference } : {}),
        ...(op.edgeStableId ? { stableId: op.edgeStableId } : {})
      };
    }

    case "feature.delete":
      return {
        ...operationReviewBase(index, op, "delete", `Delete feature ${op.id}`),
        featureId: op.id
      };

    case "feature.updateExtrude": {
      const edits = [
        ...(op.depth !== undefined ? [`depth ${op.depth}`] : []),
        ...(op.side !== undefined ? [`side ${op.side}`] : [])
      ];

      return {
        ...operationReviewBase(
          index,
          op,
          "modify",
          `Update extrude feature ${op.id}${
            edits.length > 0 ? ` (${edits.join(", ")})` : ""
          }`
        ),
        featureId: op.id
      };
    }

    case "feature.updateRevolve":
      return {
        ...operationReviewBase(
          index,
          op,
          "modify",
          `Update revolve feature ${op.id} (angle ${op.angleDegrees})`
        ),
        featureId: op.id
      };

    case "feature.updateHole": {
      const edits = [
        ...(op.depthMode !== undefined ? [`depthMode ${op.depthMode}`] : []),
        ...(op.depth !== undefined ? [`depth ${op.depth}`] : []),
        ...(op.direction !== undefined ? [`direction ${op.direction}`] : [])
      ];

      return {
        ...operationReviewBase(
          index,
          op,
          "modify",
          `Update hole feature ${op.id}${
            edits.length > 0 ? ` (${edits.join(", ")})` : ""
          }`
        ),
        featureId: op.id
      };
    }

    case "feature.updateChamfer":
      return {
        ...operationReviewBase(
          index,
          op,
          "modify",
          `Update chamfer feature ${op.id} (distance ${op.distance})`
        ),
        featureId: op.id
      };

    case "feature.updateFillet":
      return {
        ...operationReviewBase(
          index,
          op,
          "modify",
          `Update fillet feature ${op.id} (radius ${op.radius})`
        ),
        featureId: op.id
      };

    case "reference.nameGenerated":
      return {
        ...operationReviewBase(
          index,
          op,
          "create",
          `Name generated reference ${op.name} on ${op.bodyId}`
        ),
        referenceName: op.name,
        bodyId: op.bodyId,
        stableId: op.stableId
      };

    case "reference.repairName":
      return {
        ...operationReviewBase(
          index,
          op,
          "modify",
          `Repair named reference ${op.name} to ${op.stableId} on ${op.bodyId}`
        ),
        referenceName: op.name,
        bodyId: op.bodyId,
        stableId: op.stableId
      };

    case "reference.deleteName":
      return {
        ...operationReviewBase(
          index,
          op,
          "delete",
          `Delete named reference ${op.name}`
        ),
        referenceName: op.name
      };
  }
}

function createObjectCreateOperationReview(
  index: number,
  op: Extract<
    CadOp,
    {
      readonly op:
        | "scene.createBox"
        | "scene.createCylinder"
        | "scene.createSphere"
        | "scene.createCone"
        | "scene.createTorus";
    }
  >,
  kind: "box" | "cylinder" | "sphere" | "cone" | "torus"
): CadOpsAgentOperationReview {
  return {
    ...operationReviewBase(
      index,
      op,
      "create",
      `Create ${kind} ${op.id ?? "with generated ID"}`
    ),
    ...(op.id ? { objectId: op.id } : {})
  };
}

function createObjectUpdateOperationReview(
  index: number,
  op: Extract<
    CadOp,
    {
      readonly op:
        | "scene.updateBoxDimensions"
        | "scene.updateCylinderDimensions"
        | "scene.updateSphereDimensions"
        | "scene.updateConeDimensions"
        | "scene.updateTorusDimensions";
    }
  >,
  kind: "box" | "cylinder" | "sphere" | "cone" | "torus"
): CadOpsAgentOperationReview {
  return {
    ...operationReviewBase(
      index,
      op,
      "modify",
      `Update ${kind} dimensions for ${op.id}`
    ),
    objectId: op.id
  };
}

function createSketchEntityAddOperationReview(
  index: number,
  op: Extract<
    CadOp,
    {
      readonly op:
        | "sketch.addPoint"
        | "sketch.addLine"
        | "sketch.addRectangle"
        | "sketch.addCircle";
    }
  >,
  kind: "point" | "line" | "rectangle" | "circle"
): CadOpsAgentOperationReview {
  return {
    ...operationReviewBase(
      index,
      op,
      "create",
      `Add ${kind} ${op.id ?? "with generated ID"} to ${op.sketchId}`
    ),
    sketchId: op.sketchId,
    ...(op.id ? { sketchEntityId: op.id } : {})
  };
}

function operationReviewBase(
  index: number,
  op: CadOp,
  intent: CadOpsAgentOperationIntent,
  label: string
): CadOpsAgentOperationReview {
  return {
    index,
    op: op.op,
    intent,
    label,
    ...(isDestructiveOperation(op) ? { destructive: true as const } : {})
  };
}

function isDestructiveOperation(op: CadOp): boolean {
  return (
    op.op === "parameter.delete" ||
    op.op === "scene.deleteObject" ||
    op.op === "sketch.delete" ||
    op.op === "sketch.deleteEntity" ||
    op.op === "sketch.dimension.delete" ||
    op.op === "sketch.constraint.delete" ||
    op.op === "feature.delete" ||
    op.op === "reference.deleteName"
  );
}

function toAgentQueryResponse(
  request: CadOpsAgentQueryRequest,
  response: CadQueryResponse
): CadOpsAgentQueryResponse {
  if (!response.ok) {
    return {
      ok: false,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      error: response.error
    };
  }

  if (response.query === "parameter.list") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      parameterCount: response.parameterCount,
      parameters: response.parameters
    };
  }

  if (response.query === "parameter.get") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      parameter: response.parameter
    };
  }

  if (response.query === "feature.editability") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      featureId: response.featureId,
      status: response.status,
      ...(response.feature ? { feature: response.feature } : {}),
      fieldCount: response.fieldCount,
      fields: response.fields,
      rebuildReadiness: response.rebuildReadiness,
      dryRun: response.dryRun,
      affected: response.affected,
      referenceChangeCount: response.referenceChangeCount,
      referenceChanges: response.referenceChanges,
      diagnosticCount: response.diagnosticCount,
      diagnostics: response.diagnostics,
      sourceBoundaryNote: response.sourceBoundaryNote,
      derivedBoundaryNote: response.derivedBoundaryNote,
      requiresProjectSchemaMigration: response.requiresProjectSchemaMigration
    };
  }

  if (response.query === "project.summary") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      units: response.units,
      objectCount: response.objectCount,
      objects: response.objects,
      structure: response.structure,
      health: response.health,
      references: response.references,
      exportReadiness: response.exportReadiness,
      workflowHints: response.workflowHints
    };
  }

  if (response.query === "project.features") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      featureCount: response.featureCount,
      features: response.features
    };
  }

  if (response.query === "project.structure") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      partCount: response.partCount,
      featureCount: response.featureCount,
      bodyCount: response.bodyCount,
      parts: response.parts,
      features: response.features,
      bodies: response.bodies,
      objectSources: response.objectSources
    };
  }

  if (response.query === "project.health") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      status: response.status,
      issueCount: response.issueCount,
      authoredExtrudeCount: response.authoredExtrudeCount,
      authoredRevolveCount: response.authoredRevolveCount,
      authoredHoleCount: response.authoredHoleCount,
      authoredChamferCount: response.authoredChamferCount,
      authoredFilletCount: response.authoredFilletCount,
      attachedSketchCount: response.attachedSketchCount,
      sketchEvaluationCount: response.sketchEvaluationCount,
      sketchDimensionCount: response.sketchDimensionCount,
      sketchConstraintCount: response.sketchConstraintCount,
      namedReferenceCount: response.namedReferenceCount,
      authoredExtrudes: response.authoredExtrudes,
      authoredRevolves: response.authoredRevolves,
      authoredHoles: response.authoredHoles,
      authoredChamfers: response.authoredChamfers,
      authoredFillets: response.authoredFillets,
      attachedSketches: response.attachedSketches,
      sketchEvaluations: response.sketchEvaluations,
      sketchDimensions: response.sketchDimensions,
      sketchConstraints: response.sketchConstraints,
      namedReferences: response.namedReferences
    };
  }

  if (response.query === "project.dependencyGraph") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      nodeCount: response.nodeCount,
      edgeCount: response.edgeCount,
      nodes: response.nodes,
      edges: response.edges,
      referenceHealthCount: response.referenceHealthCount,
      referenceHealth: response.referenceHealth,
      diagnosticCount: response.diagnosticCount,
      diagnostics: response.diagnostics,
      sourceBoundaryNote: response.sourceBoundaryNote,
      derivedBoundaryNote: response.derivedBoundaryNote,
      requiresProjectSchemaMigration: response.requiresProjectSchemaMigration
    };
  }

  if (response.query === "project.rebuildPlan") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      status: response.status,
      bodyLifecycleCount: response.bodyLifecycleCount,
      bodyLifecycles: response.bodyLifecycles,
      lifecycleEffectCount: response.lifecycleEffectCount,
      lifecycleEffects: response.lifecycleEffects,
      affected: response.affected,
      diagnosticCount: response.diagnosticCount,
      diagnostics: response.diagnostics,
      sourceBoundaryNote: response.sourceBoundaryNote,
      derivedBoundaryNote: response.derivedBoundaryNote,
      requiresProjectSchemaMigration: response.requiresProjectSchemaMigration
    };
  }

  if (response.query === "project.exportReadiness") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      status: response.status,
      canExportFiles: response.canExportFiles,
      units: response.units,
      sourceBoundaryNote: response.sourceBoundaryNote,
      derivedBoundaryNote: response.derivedBoundaryNote,
      formatCount: response.formatCount,
      formats: response.formats,
      bodyCount: response.bodyCount,
      sourceSupportedBodyCount: response.sourceSupportedBodyCount,
      deferredBodyCount: response.deferredBodyCount,
      unavailableBodyCount: response.unavailableBodyCount,
      bodies: response.bodies,
      diagnosticCount: response.diagnosticCount,
      diagnostics: response.diagnostics
    };
  }

  if (response.query === "project.exportExact") {
    return toAgentExactExportResponse(request, response);
  }

  if (response.query === "project.packageReadiness") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      status: response.status,
      packageVersion: response.packageVersion,
      fileExtension: response.fileExtension,
      sourceIdentityAlgorithm: response.sourceIdentityAlgorithm,
      documentSchemaVersion: response.documentSchemaVersion,
      canRepresentCurrentSource: response.canRepresentCurrentSource,
      requiresProjectSchemaMigration: response.requiresProjectSchemaMigration,
      ...(response.nextProjectSchemaVersion
        ? { nextProjectSchemaVersion: response.nextProjectSchemaVersion }
        : {}),
      sourceBoundaryNote: response.sourceBoundaryNote,
      derivedBoundaryNote: response.derivedBoundaryNote,
      requiredEntryCount: response.requiredEntryCount,
      requiredEntries: response.requiredEntries,
      optionalCacheEntryCount: response.optionalCacheEntryCount,
      optionalCacheEntries: response.optionalCacheEntries,
      capabilityCount: response.capabilityCount,
      capabilities: response.capabilities,
      diagnosticCount: response.diagnosticCount,
      diagnostics: response.diagnostics
    };
  }

  if (response.query === "project.sketches") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      sketchCount: response.sketchCount,
      sketches: response.sketches
    };
  }

  if (response.query === "object.measurements") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      measurements: response.measurements
    };
  }

  if (response.query === "body.topology") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      topology: response.topology
    };
  }

  if (response.query === "body.measurements") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      measurements: response.measurements
    };
  }

  if (response.query === "project.extents") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      units: response.units,
      objectCount: response.objectCount,
      bodyCount: response.bodyCount,
      ...(response.bounds ? { bounds: response.bounds } : {}),
      approximateVolume: response.approximateVolume,
      objects: response.objects,
      bodies: response.bodies,
      warnings: response.warnings
    };
  }

  if (response.query === "transaction.history") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      transactionCount: response.transactionCount,
      transactions: response.transactions
    };
  }

  if (response.query === "sketch.get") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      sketch: response.sketch
    };
  }

  if (response.query === "sketch.editReadiness") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      status: response.status,
      edit: response.edit,
      dryRun: response.dryRun,
      ...(response.sketchHealth ? { sketchHealth: response.sketchHealth } : {}),
      affected: response.affected,
      featureImpactCount: response.featureImpactCount,
      featureImpacts: response.featureImpacts,
      bodyLifecycleCount: response.bodyLifecycleCount,
      bodyLifecycles: response.bodyLifecycles,
      referenceEffectCount: response.referenceEffectCount,
      referenceEffects: response.referenceEffects,
      referenceHealthCount: response.referenceHealthCount,
      referenceHealth: response.referenceHealth,
      diagnosticCount: response.diagnosticCount,
      diagnostics: response.diagnostics,
      sourceBoundaryNote: response.sourceBoundaryNote,
      derivedBoundaryNote: response.derivedBoundaryNote,
      requiresProjectSchemaMigration: response.requiresProjectSchemaMigration
    };
  }

  if (response.query === "sketch.solverStatus") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      sketchId: response.sketchId,
      sketchName: response.sketchName,
      plane: response.plane,
      status: response.status,
      readiness: response.readiness,
      solver: response.solver,
      entityCount: response.entityCount,
      entities: response.entities,
      dimensionCount: response.dimensionCount,
      dimensions: response.dimensions,
      constraintCount: response.constraintCount,
      constraints: response.constraints,
      deferredConstraintCount: response.deferredConstraintCount,
      deferredConstraints: response.deferredConstraints,
      profileValidity: response.profileValidity,
      preview: response.preview,
      sourceContract: response.sourceContract,
      diagnosticCount: response.diagnosticCount,
      diagnostics: response.diagnostics,
      sourceBoundaryNote: response.sourceBoundaryNote,
      derivedBoundaryNote: response.derivedBoundaryNote,
      requiresProjectSchemaMigration: response.requiresProjectSchemaMigration
    };
  }

  if (response.query === "sketch.dimensions") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      sketchId: response.sketchId,
      dimensionCount: response.dimensionCount,
      dimensions: response.dimensions
    };
  }

  if (response.query === "sketch.evaluation") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      sketchId: response.sketchId,
      sketchName: response.sketchName,
      plane: response.plane,
      status: response.status,
      drivenEntityCount: response.drivenEntityCount,
      drivenEntityIds: response.drivenEntityIds,
      dimensionCount: response.dimensionCount,
      dimensions: response.dimensions,
      constraintCount: response.constraintCount,
      constraints: response.constraints,
      issueCount: response.issueCount,
      issues: response.issues
    };
  }

  if (response.query === "sketch.dimension.get") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      dimension: response.dimension
    };
  }

  if (response.query === "body.generatedReferences") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      body: response.body,
      faceCount: response.faceCount,
      faces: response.faces,
      edgeCount: response.edgeCount,
      edges: response.edges,
      vertexCount: response.vertexCount,
      vertices: response.vertices,
      axisCount: response.axisCount,
      axes: response.axes
    };
  }

  if (response.query === "body.resolveGeneratedReference") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      bodyId: response.bodyId,
      stableId: response.stableId,
      kind: response.kind,
      reference: response.reference
    };
  }

  if (response.query === "body.generatedReferenceMeasurements") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      bodyId: response.bodyId,
      stableId: response.stableId,
      kind: response.kind,
      reference: response.reference,
      measurements: response.measurements
    };
  }

  if (response.query === "reference.listNamed") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      referenceCount: response.referenceCount,
      references: response.references
    };
  }

  if (response.query === "reference.resolveNamed") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      name: response.name,
      target: response.target,
      reference: response.reference
    };
  }

  if (response.query === "reference.health") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      target: response.target,
      status: response.status,
      referenceHealthCount: response.referenceHealthCount,
      referenceHealth: response.referenceHealth,
      diagnosticCount: response.diagnosticCount,
      diagnostics: response.diagnostics,
      sourceBoundaryNote: response.sourceBoundaryNote,
      derivedBoundaryNote: response.derivedBoundaryNote,
      requiresProjectSchemaMigration: response.requiresProjectSchemaMigration
    };
  }

  if (response.query === "selection.referenceCandidates") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      selection: response.selection,
      ...(response.requiredOperation
        ? { requiredOperation: response.requiredOperation }
        : {}),
      status: response.status,
      candidateCount: response.candidateCount,
      candidates: response.candidates,
      issueCount: response.issueCount,
      issues: response.issues
    };
  }

  return {
    ok: true,
    requestId: request.requestId,
    adapterVersion: request.adapterVersion,
    cadOpsVersion: response.cadOpsVersion,
    query: response.query,
    object: response.object
  };
}

function createV8ProjectSurfaceResponse(
  request: CadOpsAgentV8ProjectSurfaceRequest,
  engine: CadEngine
): CadOpsAgentV8ProjectSurfaceResponse {
  const summary = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.summary" }
  });
  const packageReadiness = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.packageReadiness" }
  });
  const exportReadiness = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.exportReadiness" }
  });
  const exactExport = request.exactExport
    ? engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "project.exportExact",
          format: "step",
          ...(request.exactExport.bodyIds
            ? { bodyIds: request.exactExport.bodyIds }
            : {}),
          ...(request.exactExport.sourceIdentity
            ? { sourceIdentity: request.exactExport.sourceIdentity }
            : {})
        }
      })
    : undefined;

  if (
    !summary.ok ||
    summary.query !== "project.summary" ||
    !packageReadiness.ok ||
    packageReadiness.query !== "project.packageReadiness" ||
    !exportReadiness.ok ||
    exportReadiness.query !== "project.exportReadiness" ||
    (exactExport !== undefined &&
      (!exactExport.ok || exactExport.query !== "project.exportExact"))
  ) {
    throw new Error("Unable to build V8 project surface from CADOps queries.");
  }

  return {
    ok: true,
    requestId: request.requestId,
    adapterVersion: request.adapterVersion,
    cadOpsVersion: summary.cadOpsVersion,
    surface: "v8.agent_mcp_package_export",
    project: {
      units: summary.units,
      objectCount: summary.objectCount,
      bodyCount: summary.structure.bodyCount,
      authoredBodyFeatureCount: summary.structure.authoredBodyFeatureCount,
      primitiveCompatibilityBodyCount:
        summary.structure.primitiveCompatibilityBodyCount
    },
    package: createV8PackageSurfaceSummary(packageReadiness),
    cache: createV8CacheSurfaceSummary(packageReadiness),
    exportReadiness: createV8ExportSurfaceSummary(exportReadiness),
    ...(exactExport
      ? { exactExport: createV8ExactExportSurfaceSummary(exactExport) }
      : {}),
    fileWriting: createV8FileWritingBoundary(),
    boundaries: createV8BoundarySummary()
  };
}

function toAgentExactExportResponse(
  request: CadOpsAgentQueryRequest,
  response: ProjectExactExportQueryResponse
): CadOpsAgentProjectExactExportQueryResponse {
  const { artifact, ...safeResponse } = response;
  void artifact;

  return {
    ...safeResponse,
    ok: true,
    requestId: request.requestId,
    adapterVersion: request.adapterVersion,
    artifactPolicy: createExportArtifactPolicy()
  };
}

function createV8PackageSurfaceSummary(
  response: ProjectPackageReadinessQueryResponse
): CadOpsAgentV8ProjectSurfacePackageSummary {
  return {
    status: response.status,
    packageVersion: response.packageVersion,
    fileExtension: response.fileExtension,
    documentSchemaVersion: response.documentSchemaVersion,
    sourceIdentityAlgorithm: response.sourceIdentityAlgorithm,
    canRepresentCurrentSource: response.canRepresentCurrentSource,
    requiresProjectSchemaMigration: response.requiresProjectSchemaMigration,
    requiredEntryCount: response.requiredEntryCount,
    requiredEntries: response.requiredEntries,
    optionalCacheEntryCount: response.optionalCacheEntryCount,
    optionalCacheEntries: response.optionalCacheEntries,
    capabilityCount: response.capabilityCount,
    capabilities: response.capabilities.map((capability) => ({
      capability: capability.capability,
      label: capability.label,
      status: capability.status,
      available: capability.available,
      diagnosticCount: capability.diagnostics.length,
      diagnosticCodes: capability.diagnostics.map(
        (diagnostic) => diagnostic.code
      )
    })),
    diagnosticCount: response.diagnosticCount,
    diagnostics: response.diagnostics
  };
}

function createV8CacheSurfaceSummary(
  response: ProjectPackageReadinessQueryResponse
): CadOpsAgentV8ProjectSurfaceCacheSummary {
  const opfsCapability = response.capabilities.find(
    (capability) => capability.capability === "opfsCache"
  );
  const diagnostics = opfsCapability?.diagnostics ?? [];

  return {
    cachePolicy: "optional-rebuildable",
    ...(opfsCapability
      ? {
          opfsCapabilityStatus: opfsCapability.status,
          opfsCapabilityAvailable: opfsCapability.available
        }
      : {}),
    opfsLocationsExposed: false,
    clearMutatesSource: false,
    sourceIdentityIncludesCache: false,
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function createV8ExportSurfaceSummary(
  response: ProjectExportReadinessQueryResponse
): CadOpsAgentV8ProjectSurfaceExportSummary {
  const unsupportedBodies = createUnsupportedBodySummaries(response.bodies);

  return {
    status: response.status,
    canExportFiles: response.canExportFiles,
    units: response.units,
    formatCount: response.formatCount,
    formats: response.formats.map((format) => ({
      format: format.format,
      label: format.label,
      exportKind: format.exportKind,
      status: format.status,
      available: format.available,
      writerStatus: format.writerStatus,
      fileExtensions: format.fileExtensions,
      sourceSupportedBodyCount: format.sourceSupportedBodyCount,
      deferredBodyCount: format.deferredBodyCount,
      unavailableBodyCount: format.unavailableBodyCount,
      diagnosticCount: format.diagnostics.length,
      diagnosticCodes: format.diagnostics.map((diagnostic) => diagnostic.code)
    })),
    bodyCount: response.bodyCount,
    sourceSupportedBodyCount: response.sourceSupportedBodyCount,
    deferredBodyCount: response.deferredBodyCount,
    unavailableBodyCount: response.unavailableBodyCount,
    unsupportedBodyCount: unsupportedBodies.length,
    unsupportedBodies,
    diagnosticCount: response.diagnosticCount,
    diagnostics: response.diagnostics
  };
}

function createV8ExactExportSurfaceSummary(
  response: ProjectExactExportQueryResponse
): CadOpsAgentV8ProjectSurfaceExactExportSummary {
  const unsupportedBodies = createUnsupportedBodySummaries(response.bodies);

  return {
    format: response.format,
    status: response.status,
    available: response.available,
    canExportFile: response.canExportFile,
    writerStatus: response.writerStatus,
    requestedBodyIds: response.requestedBodyIds,
    bodyCount: response.bodyCount,
    sourceSupportedBodyCount: response.sourceSupportedBodyCount,
    deferredBodyCount: response.deferredBodyCount,
    unavailableBodyCount: response.unavailableBodyCount,
    exportableBodyCount: response.exportableBodyCount,
    exportSourceCount: response.exportSources.length,
    exportSources: response.exportSources,
    unsupportedBodyCount: unsupportedBodies.length,
    unsupportedBodies,
    diagnosticCount: response.diagnosticCount,
    diagnostics: response.diagnostics,
    artifactPolicy: createExportArtifactPolicy()
  };
}

function createUnsupportedBodySummaries(
  bodies: readonly CadExportBodyReadiness[]
): readonly CadOpsAgentV8ProjectSurfaceUnsupportedBodySummary[] {
  return bodies
    .filter((body) => body.sourceStatus !== "supported")
    .map((body) => ({
      bodyId: body.bodyId,
      ...(body.bodyName ? { bodyName: body.bodyName } : {}),
      bodyKind: body.bodyKind,
      featureId: body.featureId,
      sourceKind: body.sourceKind,
      status: body.status,
      ...(body.consumedByFeatureId
        ? { consumedByFeatureId: body.consumedByFeatureId }
        : {}),
      diagnosticCount: body.diagnostics.length,
      diagnostics: body.diagnostics
    }));
}

function createExportArtifactPolicy(): CadOpsAgentExportArtifactPolicy {
  return {
    artifactBytesReturned: false,
    fileWritesPerformed: false,
    localLocationsAccepted: false,
    browserHandlesAccepted: false,
    requiresExplicitArtifactCapability: true,
    delivery: "caller-or-browser-ui",
    message:
      "Agent/MCP export calls return readiness and exact source contracts only; caller-owned transport or the browser UI must perform artifact delivery."
  };
}

function createV8FileWritingBoundary(): CadOpsAgentV8ProjectSurfaceFileWritingBoundary {
  return {
    defaultBehavior: "readiness-only",
    adapterWritesUserVisibleFiles: false,
    mcpWritesUserVisibleFiles: false,
    artifactBytesReturned: false,
    localLocationsAccepted: false,
    browserHandlesAccepted: false,
    opfsLocationsAccepted: false,
    futureFileWritesRequireExplicitCapability: true,
    message:
      "This adapter does not accept local paths, browser handles, OPFS paths, or write files. User-visible file writes stay in the browser UI or a future explicitly-permissioned artifact transport."
  };
}

function createV8BoundarySummary(): CadOpsAgentV8ProjectSurfaceBoundarySummary {
  return {
    browserHandlesExposed: false,
    localLocationsExposed: false,
    opfsLocationsExposed: false,
    rendererInternalsExposed: false,
    meshInternalsExposed: false,
    occtInternalsExposed: false,
    viewportStateExposed: false,
    selectionBufferInternalsExposed: false,
    packageBinaryReturned: false,
    stepBytesReturned: false,
    jsonImportExportPreserved: true
  };
}

function isCadOpsAgentRequest(value: unknown): value is CadOpsAgentRequest {
  return (
    isRecord(value) &&
    value.requestId !== "" &&
    typeof value.requestId === "string" &&
    value.adapterVersion === "web-cad.agent-adapter.v1" &&
    isCadBatch(value.batch) &&
    (value.actor === undefined || isCadActorMetadataShape(value.actor)) &&
    (value.permissions === undefined ||
      isCadOpsAgentPermissionPolicy(value.permissions)) &&
    (value.source === undefined || isCadOpsAgentRequestSource(value.source))
  );
}

function isCadOpsAgentQueryRequest(
  value: unknown
): value is CadOpsAgentQueryRequest {
  return (
    isRecord(value) &&
    value.requestId !== "" &&
    typeof value.requestId === "string" &&
    value.adapterVersion === "web-cad.agent-adapter.v1" &&
    isCadQueryRequest(value.query)
  );
}

function isCadOpsAgentV8ProjectSurfaceRequest(
  value: unknown
): value is CadOpsAgentV8ProjectSurfaceRequest {
  return (
    isRecord(value) &&
    value.requestId !== "" &&
    typeof value.requestId === "string" &&
    value.adapterVersion === "web-cad.agent-adapter.v1" &&
    (value.exactExport === undefined ||
      isCadOpsAgentV8ExactExportRequest(value.exactExport))
  );
}

function isCadOpsAgentV8ExactExportRequest(
  value: unknown
): value is CadOpsAgentV8ExactExportRequest {
  return (
    isRecord(value) &&
    value.format === "step" &&
    Object.keys(value).every((key) =>
      ["format", "bodyIds", "sourceIdentity"].includes(key)
    ) &&
    (value.bodyIds === undefined ||
      (Array.isArray(value.bodyIds) &&
        value.bodyIds.every((bodyId) => typeof bodyId === "string"))) &&
    (value.sourceIdentity === undefined ||
      isWcadSourceIdentityInput(value.sourceIdentity))
  );
}

function isCadBatch(value: unknown): value is CadBatch {
  return (
    isRecord(value) &&
    value.version === "cadops.v1" &&
    (value.mode === "dryRun" || value.mode === "commit") &&
    Array.isArray(value.ops) &&
    value.ops.every(isCadOp) &&
    (value.actor === undefined || isCadActorMetadataShape(value.actor)) &&
    (value.audit === undefined ||
      isCadTransactionAuditMetadataShape(value.audit))
  );
}

function isCadOpsAgentPermissionPolicy(
  value: unknown
): value is CadOpsAgentPermissionPolicy {
  return (
    isRecord(value) &&
    (value.allowCommit === undefined || typeof value.allowCommit === "boolean")
  );
}

function isCadOpsAgentRequestSource(
  value: unknown
): value is CadOpsAgentRequestSource {
  return (
    isRecord(value) &&
    typeof value.source === "string" &&
    value.source !== "" &&
    (value.toolName === undefined || typeof value.toolName === "string")
  );
}

function isCadTransactionAuditMetadataShape(
  value: unknown
): value is CadTransactionAuditMetadata {
  return (
    isRecord(value) &&
    (value.source === undefined || typeof value.source === "string") &&
    (value.requestId === undefined || typeof value.requestId === "string") &&
    (value.toolName === undefined || typeof value.toolName === "string") &&
    (value.intent === "dryRun" || value.intent === "commit") &&
    typeof value.operationCount === "number"
  );
}

function isCadActorMetadataShape(value: unknown): value is CadActorMetadata {
  return (
    isRecord(value) &&
    typeof value.type === "string" &&
    (value.id === undefined || typeof value.id === "string") &&
    (value.name === undefined || typeof value.name === "string")
  );
}

function isCadQueryRequest(value: unknown): value is CadQueryRequest {
  return (
    isRecord(value) &&
    value.version === "cadops.v1" &&
    isRecord(value.query) &&
    ((value.query.query === "parameter.list" &&
      Object.keys(value.query).length === 1) ||
      (value.query.query === "parameter.get" &&
        typeof value.query.id === "string") ||
      (value.query.query === "feature.editability" &&
        typeof value.query.featureId === "string" &&
        (value.query.proposedEdit === undefined ||
          isCadFeatureEditProposal(value.query.proposedEdit))) ||
      (value.query.query === "project.summary" &&
        Object.keys(value.query).length === 1) ||
      (value.query.query === "project.features" &&
        Object.keys(value.query).length === 1) ||
      (value.query.query === "project.structure" &&
        Object.keys(value.query).length === 1) ||
      (value.query.query === "project.dependencyGraph" &&
        Object.keys(value.query).length === 1) ||
      (value.query.query === "project.rebuildPlan" &&
        Object.keys(value.query).length === 1) ||
      (value.query.query === "project.exportReadiness" &&
        Object.keys(value.query).length === 1) ||
      (value.query.query === "project.exportExact" &&
        isProjectExactExportQuery(value.query)) ||
      (value.query.query === "project.packageReadiness" &&
        Object.keys(value.query).length === 1) ||
      (value.query.query === "project.health" &&
        (Object.keys(value.query).length === 1 ||
          (Object.keys(value.query).length === 2 &&
            Array.isArray(value.query.derivedExactMetadata) &&
            value.query.derivedExactMetadata.every((snapshot) =>
              isCadBodyDerivedExactMetadataSnapshot(snapshot)
            )))) ||
      (value.query.query === "project.sketches" &&
        Object.keys(value.query).length === 1) ||
      (value.query.query === "object.get" &&
        typeof value.query.id === "string") ||
      (value.query.query === "object.measurements" &&
        typeof value.query.id === "string") ||
      (value.query.query === "body.topology" &&
        typeof value.query.bodyId === "string" &&
        (value.query.derivedExactMetadata === undefined ||
          isCadBodyDerivedExactMetadataSnapshot(
            value.query.derivedExactMetadata
          ))) ||
      (value.query.query === "body.measurements" &&
        typeof value.query.bodyId === "string") ||
      (value.query.query === "project.extents" &&
        (Object.keys(value.query).length === 1 ||
          (Object.keys(value.query).length === 2 &&
            Array.isArray(value.query.derivedExactMetadata) &&
            value.query.derivedExactMetadata.every((snapshot) =>
              isCadBodyDerivedExactMetadataSnapshot(snapshot)
            )))) ||
      (value.query.query === "sketch.get" &&
        typeof value.query.id === "string") ||
      (value.query.query === "sketch.editReadiness" &&
        isCadSketchEditProposal(value.query.edit)) ||
      (value.query.query === "sketch.solverStatus" &&
        typeof value.query.sketchId === "string") ||
      (value.query.query === "sketch.evaluation" &&
        typeof value.query.sketchId === "string") ||
      (value.query.query === "sketch.dimensions" &&
        typeof value.query.sketchId === "string") ||
      (value.query.query === "sketch.dimension.get" &&
        typeof value.query.id === "string") ||
      (value.query.query === "body.generatedReferences" &&
        typeof value.query.bodyId === "string") ||
      (value.query.query === "body.resolveGeneratedReference" &&
        typeof value.query.bodyId === "string" &&
        typeof value.query.stableId === "string") ||
      (value.query.query === "body.generatedReferenceMeasurements" &&
        typeof value.query.bodyId === "string" &&
        typeof value.query.stableId === "string") ||
      (value.query.query === "reference.listNamed" &&
        Object.keys(value.query).length === 1) ||
      (value.query.query === "reference.resolveNamed" &&
        typeof value.query.name === "string") ||
      (value.query.query === "reference.health" &&
        (Object.keys(value.query).length === 1 ||
          (Object.keys(value.query).length === 2 &&
            isCadReferenceHealthTarget(value.query.target)))) ||
      (value.query.query === "selection.referenceCandidates" &&
        isCadSelectionReferenceInput(value.query.selection) &&
        (value.query.requiredOperation === undefined ||
          isCadSelectionReferenceOperation(value.query.requiredOperation))) ||
      (value.query.query === "transaction.history" &&
        Object.keys(value.query).length === 1))
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

function isCadSketchEditProposal(
  value: unknown
): value is CadSketchEditProposal {
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

function isSketchConstraintCreateEditProposal(
  value: Record<string, unknown>
): boolean {
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

function isWcadSourceIdentityInput(value: unknown): boolean {
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
    default:
      return false;
  }
}

function isCadReferenceHealthTarget(
  value: unknown
): value is CadReferenceHealthTarget {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  switch (value.type) {
    case "all":
      return Object.keys(value).length === 1;
    case "body":
      return typeof value.bodyId === "string" && value.bodyId !== "";
    case "generatedReference":
      return (
        typeof value.bodyId === "string" &&
        value.bodyId !== "" &&
        typeof value.stableId === "string" &&
        value.stableId !== "" &&
        (value.expectedKind === undefined ||
          isGeneratedEntityKind(value.expectedKind))
      );
    case "namedReference":
      return typeof value.name === "string" && value.name !== "";
    default:
      return false;
  }
}

function isCadSelectionReferenceOperation(
  value: unknown
): value is CadSelectionReferenceOperation {
  return (
    value === "reference.nameGenerated" ||
    value === "feature.attachSketchPlane" ||
    value === "feature.chamfer" ||
    value === "feature.fillet" ||
    value === "feature.measureReference" ||
    value === "feature.selectReference"
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
    typeof value.edgeCount === "number" &&
    Number.isInteger(value.edgeCount) &&
    value.edgeCount >= 0 &&
    typeof value.vertexCount === "number" &&
    Number.isInteger(value.vertexCount) &&
    value.vertexCount >= 0
  );
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
      typeof value.units === "string" &&
      (value.mode === undefined || typeof value.mode === "string")
    );
  }

  if (value.op === "sketch.create") {
    return (
      isOptionalString(value.id) &&
      typeof value.name === "string" &&
      (value.plane === "XY" || value.plane === "XZ" || value.plane === "YZ")
    );
  }

  if (value.op === "sketch.createOnFace") {
    const hasGeneratedReference =
      typeof value.bodyId === "string" &&
      typeof value.faceStableId === "string" &&
      value.referenceName === undefined;
    const hasNamedReference =
      typeof value.referenceName === "string" &&
      value.bodyId === undefined &&
      value.faceStableId === undefined;

    return (
      isOptionalString(value.id) &&
      typeof value.name === "string" &&
      (hasGeneratedReference || hasNamedReference)
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
      typeof value.height === "number"
    );
  }

  if (value.op === "sketch.addCircle") {
    return (
      typeof value.sketchId === "string" &&
      isOptionalString(value.id) &&
      isVec2(value.center) &&
      typeof value.radius === "number"
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
      isOptionalString(value.name) &&
      typeof value.sketchId === "string" &&
      typeof value.entityId === "string" &&
      typeof value.depth === "number" &&
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
      (value.operationMode === undefined ||
        isRevolveOperationMode(value.operationMode))
    );
  }

  if (value.op === "feature.hole") {
    return (
      isOptionalString(value.id) &&
      isOptionalString(value.bodyId) &&
      isOptionalString(value.name) &&
      typeof value.targetBodyId === "string" &&
      typeof value.sketchId === "string" &&
      typeof value.circleEntityId === "string" &&
      isHoleDepthMode(value.depthMode) &&
      (value.depth === undefined || typeof value.depth === "number") &&
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
      typeof value.distance === "number"
    );
  }

  if (value.op === "feature.fillet") {
    return (
      isOptionalString(value.id) &&
      isOptionalString(value.bodyId) &&
      isOptionalString(value.name) &&
      typeof value.targetBodyId === "string" &&
      hasExactlyOneEdgeReferenceInput(value) &&
      typeof value.radius === "number"
    );
  }

  if (value.op === "feature.updateExtrude") {
    return (
      typeof value.id === "string" &&
      (value.depth === undefined || typeof value.depth === "number") &&
      (value.side === undefined || isExtrudeSide(value.side)) &&
      (value.depth !== undefined || value.side !== undefined)
    );
  }

  if (value.op === "feature.updateRevolve") {
    return (
      typeof value.id === "string" && typeof value.angleDegrees === "number"
    );
  }

  if (value.op === "feature.updateHole") {
    return (
      typeof value.id === "string" &&
      (value.depthMode === undefined || isHoleDepthMode(value.depthMode)) &&
      (value.depth === undefined || typeof value.depth === "number") &&
      (value.direction === undefined || isHoleDirection(value.direction)) &&
      (value.depthMode !== undefined ||
        value.depth !== undefined ||
        value.direction !== undefined)
    );
  }

  if (value.op === "feature.updateChamfer") {
    return typeof value.id === "string" && typeof value.distance === "number";
  }

  if (value.op === "feature.updateFillet") {
    return typeof value.id === "string" && typeof value.radius === "number";
  }

  if (value.op === "feature.delete") {
    return typeof value.id === "string";
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
      typeof value.bodyId === "string" &&
      typeof value.stableId === "string"
    );
  }

  if (value.op === "reference.deleteName") {
    return typeof value.name === "string";
  }

  return false;
}

function isBoxDimensions(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.width === "number" &&
    typeof value.height === "number" &&
    typeof value.depth === "number"
  );
}

function isCylinderDimensions(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.radius === "number" &&
    typeof value.height === "number"
  );
}

function isSphereDimensions(value: unknown): boolean {
  return isRecord(value) && typeof value.radius === "number";
}

function isConeDimensions(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.radius === "number" &&
    typeof value.height === "number"
  );
}

function isTorusDimensions(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.majorRadius === "number" &&
    typeof value.minorRadius === "number"
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

function isVec3(value: unknown): value is Vec3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => typeof item === "number")
  );
}

function isVec2(value: unknown): value is readonly [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((item) => typeof item === "number")
  );
}

function isSketchEntity(value: unknown): boolean {
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
      typeof value.height === "number"
    );
  }

  if (value.kind === "circle") {
    return isVec2(value.center) && typeof value.radius === "number";
  }

  return false;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isSketchDimensionTarget(value: unknown): boolean {
  return (
    isRecord(value) &&
    ((value.entityKind === "rectangle" &&
      (value.role === "width" || value.role === "height")) ||
      (value.entityKind === "circle" && value.role === "radius") ||
      (value.entityKind === "line" && value.role === "length"))
  );
}

function isSketchDimensionValueInput(value: Record<string, unknown>): boolean {
  const hasLiteral = value.value !== undefined;
  const hasParameter = value.parameterId !== undefined;

  if (hasLiteral === hasParameter) {
    return false;
  }

  return hasLiteral
    ? typeof value.value === "number" &&
        Number.isFinite(value.value) &&
        value.value > 0
    : typeof value.parameterId === "string";
}

function isSketchConstraintKind(value: unknown): value is SketchConstraintKind {
  return (
    value === "horizontal" ||
    value === "vertical" ||
    value === "fixed" ||
    value === "coincident" ||
    value === "midpoint" ||
    value === "parallel" ||
    value === "perpendicular"
  );
}

function isSketchPointTarget(value: unknown): value is SketchPointTarget {
  return (
    isRecord(value) &&
    typeof value.entityId === "string" &&
    (value.role === "position" ||
      value.role === "start" ||
      value.role === "end" ||
      value.role === "center")
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
    value.namedReference === undefined;
  const hasNamedReference =
    typeof value.namedReference === "string" &&
    value.edgeStableId === undefined;

  return hasStableId !== hasNamedReference;
}

function isFeatureRevolveAxis(value: unknown): value is FeatureRevolveAxis {
  return (
    isRecord(value) &&
    value.type === "sketchLine" &&
    typeof value.sketchId === "string" &&
    typeof value.entityId === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
