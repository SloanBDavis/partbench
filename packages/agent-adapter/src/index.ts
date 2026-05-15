import { CadEngine } from "@web-cad/cad-core";
import type {
  CadBatch,
  CadBatchMode,
  CadBatchResponse,
  CadBatchValidationError,
  CadObjectSnapshot,
  CadOp,
  CadOpsVersion,
  CadQueryError,
  CadQueryRequest,
  CadQueryResponse,
  ObjectId,
  Transform,
  Vec3
} from "@web-cad/cad-protocol";

export type AgentAdapterVersion = "web-cad.agent-adapter.v1";

export interface CadOpsAgentRequest {
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly batch: CadBatch;
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
}

export interface CadOpsAgentErrorResponse {
  readonly ok: false;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly mode: CadBatchMode;
  readonly error: CadBatchValidationError;
  readonly errors: readonly CadBatchValidationError[];
  readonly createdIds: readonly ObjectId[];
  readonly modifiedIds: readonly ObjectId[];
  readonly deletedIds: readonly ObjectId[];
  readonly warnings: readonly string[];
}

export type CadOpsAgentQueryResponse =
  | CadOpsAgentProjectSummaryQueryResponse
  | CadOpsAgentObjectGetQueryResponse
  | CadOpsAgentQueryErrorResponse;

export interface CadOpsAgentProjectSummaryQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "project.summary";
  readonly objectCount: number;
  readonly objects: readonly CadObjectSnapshot[];
}

export interface CadOpsAgentObjectGetQueryResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "object.get";
  readonly object: CadObjectSnapshot;
}

export interface CadOpsAgentQueryErrorResponse {
  readonly ok: false;
  readonly requestId: string;
  readonly adapterVersion: AgentAdapterVersion;
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: "project.summary" | "object.get";
  readonly error: CadQueryError;
}

export class CadOpsAgentAdapter {
  constructor(private readonly engine: CadEngine = new CadEngine()) {}

  execute(request: CadOpsAgentRequest): CadOpsAgentResponse {
    return toAgentResponse(request, this.engine.executeBatch(request.batch));
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
      warnings: response.warnings
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
    transactionId: response.transactionId
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
      objectCount: response.objectCount,
      objects: response.objects
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
    isCadBatch(value.batch)
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
    value.ops.every(isCadOp)
  );
}

function isCadQueryRequest(value: unknown): value is CadQueryRequest {
  return (
    isRecord(value) &&
    value.version === "cadops.v1" &&
    isRecord(value.query) &&
    ((value.query.query === "project.summary" &&
      Object.keys(value.query).length === 1) ||
      (value.query.query === "object.get" &&
        typeof value.query.id === "string"))
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
