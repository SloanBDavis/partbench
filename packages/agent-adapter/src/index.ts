import { CadEngine } from "@web-cad/cad-core";
import type {
  CadActorMetadata,
  CadBatch,
  CadBatchMode,
  CadBatchResponse,
  CadBatchValidationError,
  CadAxisAlignedBounds,
  BodyMeasurementsSnapshot,
  BodyExtentSnapshot,
  CadBodySnapshot,
  CadFeatureSummary,
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
  CadPartSnapshot,
  CadQueryError,
  CadQueryRequest,
  CadQueryResponse,
  GeneratedReferenceMeasurement,
  NamedGeneratedReferenceEntry,
  NamedGeneratedReferenceSnapshot,
  SketchSnapshot,
  CadTransactionAuditMetadata,
  CadTransactionHistoryEntry,
  DocumentUnits,
  FeatureExtrudeSide,
  ObjectExtentSnapshot,
  ObjectMeasurementsSnapshot,
  ObjectId,
  ProjectExtentsWarning,
  Transform,
  Vec3
} from "@web-cad/cad-protocol";

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
  readonly createdFeatureIds?: readonly string[];
  readonly modifiedFeatureIds?: readonly string[];
  readonly deletedFeatureIds?: readonly string[];
  readonly createdBodyIds?: readonly string[];
  readonly modifiedBodyIds?: readonly string[];
  readonly deletedBodyIds?: readonly string[];
  readonly warnings: readonly string[];
  readonly audit?: CadTransactionAuditMetadata;
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

export type CadOpsAgentQueryResponse =
  | CadOpsAgentProjectSummaryQueryResponse
  | CadOpsAgentProjectFeaturesQueryResponse
  | CadOpsAgentProjectStructureQueryResponse
  | CadOpsAgentProjectSketchesQueryResponse
  | CadOpsAgentObjectGetQueryResponse
  | CadOpsAgentObjectMeasurementsQueryResponse
  | CadOpsAgentBodyMeasurementsQueryResponse
  | CadOpsAgentProjectExtentsQueryResponse
  | CadOpsAgentSketchGetQueryResponse
  | CadOpsAgentBodyGeneratedReferencesQueryResponse
  | CadOpsAgentBodyResolveGeneratedReferenceQueryResponse
  | CadOpsAgentBodyGeneratedReferenceMeasurementsQueryResponse
  | CadOpsAgentReferenceListNamedQueryResponse
  | CadOpsAgentReferenceResolveNamedQueryResponse
  | CadOpsAgentTransactionHistoryQueryResponse
  | CadOpsAgentQueryErrorResponse;

export interface CadOpsAgentProjectSummaryQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "project.summary";
  readonly units: DocumentUnits;
  readonly objectCount: number;
  readonly objects: readonly CadObjectSnapshot[];
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
    | "project.summary"
    | "project.features"
    | "project.structure"
    | "project.sketches"
    | "object.get"
    | "object.measurements"
    | "body.measurements"
    | "project.extents"
    | "sketch.get"
    | "body.generatedReferences"
    | "body.resolveGeneratedReference"
    | "body.generatedReferenceMeasurements"
    | "reference.listNamed"
    | "reference.resolveNamed"
    | "transaction.history";
  readonly error: CadQueryError;
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

export function parseCadOpsAgentRequestJson(json: string): CadOpsAgentRequest {
  return parseCadOpsAgentRequest(JSON.parse(json));
}

export function parseCadOpsAgentQueryRequestJson(
  json: string
): CadOpsAgentQueryRequest {
  return parseCadOpsAgentQueryRequest(JSON.parse(json));
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

function toAgentResponse(
  request: CadOpsAgentRequest,
  response: CadBatchResponse
): CadOpsAgentResponse {
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
      ...(request.batch.audit ? { audit: request.batch.audit } : {})
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
    ...(response.audit ? { audit: response.audit } : {})
  };
}

function toAgentDiffIds(response: CadBatchResponse): {
  readonly createdSketchIds?: readonly string[];
  readonly modifiedSketchIds?: readonly string[];
  readonly deletedSketchIds?: readonly string[];
  readonly createdSketchEntityIds?: readonly string[];
  readonly modifiedSketchEntityIds?: readonly string[];
  readonly deletedSketchEntityIds?: readonly string[];
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
    ...(request.batch.audit ? { audit: request.batch.audit } : {})
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

  if (response.query === "project.summary") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      units: response.units,
      objectCount: response.objectCount,
      objects: response.objects
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
      vertices: response.vertices
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

  return {
    ok: true,
    requestId: request.requestId,
    adapterVersion: request.adapterVersion,
    cadOpsVersion: response.cadOpsVersion,
    query: response.query,
    object: response.object
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
    ((value.query.query === "project.summary" &&
      Object.keys(value.query).length === 1) ||
      (value.query.query === "project.features" &&
        Object.keys(value.query).length === 1) ||
      (value.query.query === "project.structure" &&
        Object.keys(value.query).length === 1) ||
      (value.query.query === "project.sketches" &&
        Object.keys(value.query).length === 1) ||
      (value.query.query === "object.get" &&
        typeof value.query.id === "string") ||
      (value.query.query === "object.measurements" &&
        typeof value.query.id === "string") ||
      (value.query.query === "body.measurements" &&
        typeof value.query.bodyId === "string") ||
      (value.query.query === "project.extents" &&
        Object.keys(value.query).length === 1) ||
      (value.query.query === "sketch.get" &&
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
      (value.query.query === "transaction.history" &&
        Object.keys(value.query).length === 1))
  );
}

function isCadOp(value: unknown): value is CadOp {
  if (!isRecord(value)) {
    return false;
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

  if (value.op === "feature.extrude") {
    return (
      isOptionalString(value.id) &&
      isOptionalString(value.bodyId) &&
      isOptionalString(value.name) &&
      typeof value.sketchId === "string" &&
      typeof value.entityId === "string" &&
      typeof value.depth === "number" &&
      (value.side === undefined || isExtrudeSide(value.side))
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

function isExtrudeSide(value: unknown): value is FeatureExtrudeSide {
  return value === "positive" || value === "negative" || value === "symmetric";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
