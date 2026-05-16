import { CadEngine } from "@web-cad/cad-core";
import type {
  CadActorMetadata,
  CadBatch,
  CadBatchMode,
  CadBatchResponse,
  CadBatchValidationError,
  CadAxisAlignedBounds,
  CadObjectSnapshot,
  CadOp,
  CadOpsVersion,
  CadPrimitiveFeatureSummary,
  CadQueryError,
  CadQueryRequest,
  CadQueryResponse,
  CadTransactionAuditMetadata,
  CadTransactionHistoryEntry,
  DocumentUnits,
  ObjectExtentSnapshot,
  ObjectMeasurementsSnapshot,
  ObjectId,
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
  | CadOpsAgentObjectGetQueryResponse
  | CadOpsAgentObjectMeasurementsQueryResponse
  | CadOpsAgentProjectExtentsQueryResponse
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
  readonly features: readonly CadPrimitiveFeatureSummary[];
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

export interface CadOpsAgentProjectExtentsQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "project.extents";
  readonly units: DocumentUnits;
  readonly objectCount: number;
  readonly bounds?: CadAxisAlignedBounds;
  readonly approximateVolume: number;
  readonly objects: readonly ObjectExtentSnapshot[];
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
    | "object.get"
    | "object.measurements"
    | "project.extents"
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
    warnings: response.warnings,
    transactionId: response.transactionId,
    ...(response.actor ? { actor: response.actor } : {}),
    ...(response.audit ? { audit: response.audit } : {})
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

  if (response.query === "project.extents") {
    return {
      ok: true,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: response.cadOpsVersion,
      query: response.query,
      units: response.units,
      objectCount: response.objectCount,
      ...(response.bounds ? { bounds: response.bounds } : {}),
      approximateVolume: response.approximateVolume,
      objects: response.objects
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
      (value.query.query === "object.get" &&
        typeof value.query.id === "string") ||
      (value.query.query === "object.measurements" &&
        typeof value.query.id === "string") ||
      (value.query.query === "project.extents" &&
        Object.keys(value.query).length === 1) ||
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

  if (value.op === "scene.renameObject") {
    return typeof value.id === "string" && typeof value.name === "string";
  }

  if (value.op === "document.updateUnits") {
    return (
      typeof value.units === "string" &&
      (value.mode === undefined || typeof value.mode === "string")
    );
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

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
