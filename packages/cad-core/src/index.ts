import type {
  CadActorMetadata,
  BoxDimensions,
  CadBatch,
  CadBatchResponse,
  CadBatchValidationError,
  CadBatchValidationResult,
  CadAxisAlignedBounds,
  CadBodyRef,
  CadBodySnapshot,
  CadFeatureRef,
  CadFeatureSummary,
  CadGeneratedFaceReference,
  CadObjectSnapshot,
  CadObjectRef,
  CadOp,
  CadObjectModelSource,
  CadPartSnapshot,
  CadPrimitiveFeatureSource,
  CadPrimitiveFeatureSummary,
  CadQueryRequest,
  CadQueryResponse,
  CadSketchEntityRef,
  CadSketchRef,
  CadTransactionStatus,
  ConeDimensions,
  CylinderDimensions,
  DocumentSemanticDiff,
  DocumentUnitUpdateMode,
  DocumentUnits,
  ObjectMeasurementsSnapshot,
  ObjectId,
  PartId,
  SemanticDiff,
  SketchEntityId,
  SketchEntityKind,
  SketchEntitySnapshot,
  SketchId,
  SketchAttachmentSnapshot,
  SketchPlane,
  SketchSemanticDiff,
  SketchSnapshot,
  SphereDimensions,
  TorusDimensions,
  BodyId,
  CadTransactionAuditMetadata,
  ExtrudeFeatureSnapshot,
  FeatureId,
  FeatureExtrudeProfileKind,
  FeatureExtrudeSide,
  FeatureSemanticDiff,
  TransactionId,
  Transform,
  Vec2,
  Vec3
} from "@web-cad/cad-protocol";

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

export type {
  CadActorMetadata,
  BoxDimensions,
  CadBatch,
  CadBatchResponse,
  CadBatchValidationError,
  CadBatchValidationResult,
  CadAxisAlignedBounds,
  CadBodyRef,
  CadBodySnapshot,
  CadFeatureRef,
  CadFeatureSummary,
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
  CadObjectSnapshot,
  CadObjectRef,
  CadOperationSummary,
  CadOp,
  CadObjectModelSource,
  CadPartSnapshot,
  CadPrimitiveFeatureSource,
  CadPrimitiveFeatureSummary,
  CadQueryRequest,
  CadQueryResponse,
  CadSemanticDiffSummary,
  CadSketchEntityRef,
  CadSketchRef,
  CadTransactionHistoryEntry,
  CadTransactionStatus,
  CadTransactionAuditMetadata,
  ExtrudeFeatureSnapshot,
  FeatureId,
  FeatureExtrudeProfileKind,
  FeatureExtrudeSide,
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
  SketchEntityId,
  SketchEntityKind,
  SketchEntitySnapshot,
  SketchId,
  SketchAttachmentSnapshot,
  SketchGeneratedFaceAttachmentSnapshot,
  SketchPlane,
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

export type Feature = ExtrudeFeature;

export interface ExtrudeFeature {
  readonly id: FeatureId;
  readonly kind: "extrude";
  readonly name?: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly profileKind: FeatureExtrudeProfileKind;
  readonly depth: number;
  readonly side: FeatureExtrudeSide;
  readonly bodyId: BodyId;
}

export interface CadDocument {
  readonly objects: ReadonlyMap<ObjectId, SceneObject>;
  readonly sketches: ReadonlyMap<SketchId, Sketch>;
  readonly features: ReadonlyMap<FeatureId, Feature>;
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
  readonly features: readonly ExtrudeFeatureSnapshot[];
  readonly nextObjectNumber: number;
  readonly nextSketchNumber: number;
  readonly nextSketchEntityNumber: number;
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
export const CURRENT_CAD_PROJECT_FORMAT_VERSION = "web-cad.project.v4";

export type CadProjectFormatVersion =
  | typeof CAD_PROJECT_FORMAT_VERSION_V1
  | typeof CAD_PROJECT_FORMAT_VERSION_V2
  | typeof CAD_PROJECT_FORMAT_VERSION_V3
  | typeof CURRENT_CAD_PROJECT_FORMAT_VERSION;

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
  | "INVALID_FEATURE"
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
  features: Iterable<readonly [FeatureId, Feature]> = []
): CadDocument {
  return {
    objects: new Map(objects),
    sketches: new Map(sketches),
    features: new Map(features),
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
        mode: batch.mode,
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
    switch (request.query.query) {
      case "project.summary": {
        const objects = [...this.#document.objects.values()].map(
          createCadObjectSnapshot
        );

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          units: this.#document.units,
          objectCount: objects.length,
          objects
        };
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

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          units: this.#document.units,
          objectCount: measurements.length,
          ...(measurements.length > 0
            ? {
                bounds: mergeBounds(
                  measurements.map((measurement) => measurement.worldBounds)
                )
              }
            : {}),
          approximateVolume: sumApproximateVolumes(measurements),
          objects: measurements.map((measurement) => ({
            id: measurement.id,
            kind: measurement.kind,
            name: measurement.name,
            worldBounds: measurement.worldBounds,
            approximateVolume: measurement.approximateVolume
          }))
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
                    "Generated references are currently available only for authored sketch-extrude bodies.",
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
          vertices: references.vertices
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
                    "Generated references are currently available only for authored sketch-extrude bodies.",
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
    }
  }

  validateBatch(batch: CadBatch): CadBatchValidationResult {
    try {
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
  return {
    schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
    document: engine.createSnapshot(),
    history: engine.getTransactions(),
    redoStack: engine.getRedoStack()
  };
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
};

interface MutableDocumentState {
  objects: Map<ObjectId, SceneObject>;
  sketches: Map<SketchId, Sketch>;
  features: Map<FeatureId, Feature>;
  units: DocumentUnits;
}

function applyOperation(
  op: CadOp,
  state: MutableDocumentState,
  diff: MutableSemanticDiff,
  createObjectId: () => ObjectId,
  createSketchId: () => SketchId,
  createSketchEntityId: () => SketchEntityId,
  createFeatureId: () => FeatureId,
  createBodyId: () => BodyId,
  opIndex: number
): void {
  switch (op.op) {
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
      const face = validateSketchAttachmentFace(state, op, opIndex);
      const sketch: Sketch = {
        id: op.id ?? createSketchId(),
        name: normalizeSketchName(op.name, opIndex, op.id),
        plane: createSketchPlaneFromFaceReference(face, opIndex),
        attachment: createSketchFaceAttachment(face),
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
      const dependentFeatures = findFeaturesBySketchEntity(
        state.features,
        sketch.id,
        entity.id
      );
      const profileKind =
        dependentFeatures.length > 0
          ? assertExtrudableProfile(entity, opIndex, sketch.id, entity.id)
          : undefined;
      const entities = new Map(sketch.entities);
      entities.set(entity.id, entity);
      state.sketches.set(sketch.id, { ...sketch, entities });
      pushSketchEntityModified(diff, sketchEntityRef(sketch.id, entity));

      if (dependentFeatures.length > 0 && profileKind) {
        for (const feature of dependentFeatures) {
          const updated: ExtrudeFeature = {
            ...feature,
            profileKind
          };
          state.features.set(feature.id, updated);
          pushFeatureModified(diff, featureRef(updated));
          pushBodyModified(diff, bodyRef(updated));
        }
      }

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
      const feature: ExtrudeFeature = {
        id: op.id ?? createFeatureId(),
        kind: "extrude",
        name: normalizeOptionalFeatureName(op.name, opIndex, op.id),
        sketchId: op.sketchId,
        entityId: op.entityId,
        profileKind,
        depth,
        side,
        bodyId: op.bodyId ?? createBodyId()
      };

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

function assertSketchNotInUse(
  features: ReadonlyMap<FeatureId, Feature>,
  sketchId: SketchId,
  opIndex?: number
): void {
  const feature = [...features.values()].find(
    (candidate) => candidate.sketchId === sketchId
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
): readonly ExtrudeFeature[] {
  return [...features.values()].filter(
    (feature): feature is ExtrudeFeature =>
      feature.kind === "extrude" &&
      feature.sketchId === sketchId &&
      feature.entityId === entityId
  );
}

function assertExtrudableProfile(
  entity: SketchEntity,
  opIndex: number | undefined,
  sketchId: SketchId,
  entityId: SketchEntityId
): FeatureExtrudeProfileKind {
  if (entity.kind === "rectangle" || entity.kind === "circle") {
    return entity.kind;
  }

  throwValidationError({
    code: "UNSUPPORTED_SKETCH_PROFILE",
    message:
      "feature.extrude currently supports rectangle and circle entities only.",
    opIndex,
    sketchId,
    sketchEntityId: entityId,
    path: operationPath(opIndex, "entityId"),
    expected: "rectangle or circle sketch entity",
    received: entity.kind
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

function validateSketchAttachmentFace(
  state: MutableDocumentState,
  op: Extract<CadOp, { readonly op: "sketch.createOnFace" }>,
  opIndex?: number
): CadGeneratedFaceReference {
  const result = validateGeneratedReference({
    document: state,
    ownerPartId: DEFAULT_PART_ID,
    bodyId: op.bodyId,
    stableId: op.faceStableId,
    bodyExists: (bodyId) => documentBodyExists(state, bodyId),
    expectedKind: "face",
    requiredOperation: "feature.attachSketchPlane"
  });

  if (!result.ok) {
    throwGeneratedReferenceValidationError(result.error, opIndex);
  }

  return result.reference as CadGeneratedFaceReference;
}

function documentBodyExists(
  state: MutableDocumentState,
  bodyId: BodyId
): boolean {
  return createProjectStructure(state, []).bodies.some(
    (body) => body.id === bodyId
  );
}

function throwGeneratedReferenceValidationError(
  error: GeneratedReferenceValidationError,
  opIndex?: number
): never {
  throwValidationError({
    code: error.code,
    message: error.message,
    opIndex,
    bodyId: error.bodyId,
    stableId: error.stableId,
    path: operationPath(
      opIndex,
      error.code === "BODY_NOT_FOUND" ||
        error.code === "UNSUPPORTED_BODY_REFERENCES"
        ? "bodyId"
        : "faceStableId"
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
    return "authored sketch-extrude body";
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
      path: operationPath(opIndex, "faceStableId"),
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
    path: operationPath(opIndex, "faceStableId"),
    expected: "axis-aligned planar generated face reference",
    received: JSON.stringify(normal)
  });
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
    faceRole: face.role
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
  return {
    id: feature.id,
    kind: "extrude",
    bodyId: feature.bodyId,
    sketchId: feature.sketchId,
    entityId: feature.entityId,
    profileKind: feature.profileKind,
    depth: feature.depth,
    side: feature.side
  };
}

function bodyRef(feature: Feature): CadBodyRef {
  return {
    id: feature.bodyId,
    kind: "solid",
    featureId: feature.id
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

function ensureFeatureDiff(
  diff: MutableSemanticDiff
): MutableFeatureSemanticDiff {
  diff.features ??= {
    created: [],
    modified: [],
    deleted: [],
    bodiesCreated: [],
    bodiesModified: [],
    bodiesDeleted: []
  };

  return diff.features;
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

  for (const feature of state.features.values()) {
    const scaled: ExtrudeFeature = {
      ...feature,
      depth: scaleLength(feature.depth, scaleFactor)
    };
    state.features.set(feature.id, scaled);
    pushFeatureModified(diff, featureRef(scaled));
    pushBodyModified(diff, bodyRef(scaled));
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
  nextFeatureNumber = inferNextFeatureNumber(document),
  nextBodyNumber = inferNextBodyNumber(document)
): CadDocumentSnapshot {
  return {
    units: document.units,
    objects: [...document.objects.values()].map(createCadObjectSnapshot),
    sketches: [...document.sketches.values()].map(createSketchSnapshot),
    features: [...document.features.values()].map(createFeatureSnapshot),
    nextObjectNumber,
    nextSketchNumber,
    nextSketchEntityNumber,
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
    snapshot.features.map(
      (feature) => [feature.id, createFeatureFromSnapshot(feature)] as const
    )
  );
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

function cloneSketchAttachment(
  attachment: SketchAttachmentSnapshot
): SketchAttachmentSnapshot {
  return {
    ...attachment
  };
}

function createFeatureSnapshot(feature: Feature): ExtrudeFeatureSnapshot {
  return {
    id: feature.id,
    kind: "extrude",
    name: feature.name,
    sketchId: feature.sketchId,
    entityId: feature.entityId,
    profileKind: feature.profileKind,
    depth: feature.depth,
    side: feature.side,
    bodyId: feature.bodyId
  };
}

function createFeatureFromSnapshot(
  snapshot: ExtrudeFeatureSnapshot
): ExtrudeFeature {
  return {
    id: snapshot.id,
    kind: "extrude",
    name: snapshot.name,
    sketchId: snapshot.sketchId,
    entityId: snapshot.entityId,
    profileKind: snapshot.profileKind,
    depth: snapshot.depth,
    side: snapshot.side ?? "positive",
    bodyId: snapshot.bodyId
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
  const extrudeFeatures = [...document.features.values()].map(
    createExtrudeFeatureSummary
  );
  const features: readonly CadFeatureSummary[] = [
    ...primitiveFeatures,
    ...extrudeFeatures
  ];
  const bodies = [
    ...objects.map(createPrimitiveBodySnapshot),
    ...[...document.features.values()].map(createExtrudeBodySnapshot)
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

function createExtrudeFeatureSummary(feature: Feature): CadFeatureSummary {
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
    source: {
      type: "sketchEntity",
      sketchId: feature.sketchId,
      entityId: feature.entityId
    }
  };
}

function createExtrudeBodySnapshot(feature: Feature): CadBodySnapshot {
  return {
    id: feature.bodyId,
    kind: "solid",
    partId: DEFAULT_PART_ID,
    featureId: feature.id,
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

function sumApproximateVolumes(
  measurements: readonly ObjectMeasurementsSnapshot[]
): number {
  return measurements.reduce(
    (total, measurement) => total + measurement.approximateVolume,
    0
  );
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
    features: new Map(document.features),
    units: document.units
  };
  let nextObjectNumber = initialObjectNumber;
  let nextSketchNumber = initialSketchNumber;
  let nextSketchEntityNumber = initialSketchEntityNumber;
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
    state.features
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
    historyState = createTransactionEntries(normalizedProject.history);
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

function createTransactionEntries(
  transactions: readonly Transaction[],
  initialDocument: CadDocument = createCadDocument(),
  initialObjectNumber = inferNextObjectNumber(initialDocument),
  initialSketchNumber = inferNextSketchNumber(initialDocument),
  initialSketchEntityNumber = inferNextSketchEntityNumber(initialDocument),
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
      nextFeatureNumber,
      nextBodyNumber
    );
    document = run.document;
    nextObjectNumber = run.nextObjectNumber;
    nextSketchNumber = run.nextSketchNumber;
    nextSketchEntityNumber = run.nextSketchEntityNumber;
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
    left.features.size !== right.features.size
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

  for (const [id, leftFeature] of left.features) {
    const rightFeature = right.features.get(id);

    if (!rightFeature || !featuresEqual(leftFeature, rightFeature)) {
      return false;
    }
  }

  return true;
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

function vec2Equal(left: Vec2, right: Vec2): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

function featuresEqual(left: Feature, right: Feature): boolean {
  return (
    left.id === right.id &&
    left.kind === right.kind &&
    left.name === right.name &&
    left.sketchId === right.sketchId &&
    left.entityId === right.entityId &&
    left.profileKind === right.profileKind &&
    left.depth === right.depth &&
    left.side === right.side &&
    left.bodyId === right.bodyId
  );
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
  if (value.schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION) {
    return {
      ...value,
      document: {
        ...value.document,
        features: value.document.features.map(normalizeFeatureSnapshot)
      }
    };
  }

  if (value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V3) {
    return {
      ...value,
      schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
      document: {
        ...value.document,
        features: value.document.features.map(normalizeFeatureSnapshot)
      }
    };
  }

  if (value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V2) {
    return {
      ...value,
      schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
      document: {
        ...value.document,
        features: [],
        nextFeatureNumber: 1,
        nextBodyNumber: 1
      }
    };
  }

  return {
    ...value,
    schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
    document: {
      ...value.document,
      sketches: [],
      features: [],
      nextSketchNumber: 1,
      nextSketchEntityNumber: 1,
      nextFeatureNumber: 1,
      nextBodyNumber: 1
    }
  };
}

function normalizeFeatureSnapshot(
  feature: ExtrudeFeatureSnapshot
): ExtrudeFeatureSnapshot {
  return {
    ...feature,
    side: feature.side ?? "positive"
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
  } else if (
    value.schemaVersion !== CURRENT_CAD_PROJECT_FORMAT_VERSION &&
    value.schemaVersion !== CAD_PROJECT_FORMAT_VERSION_V3 &&
    value.schemaVersion !== CAD_PROJECT_FORMAT_VERSION_V2 &&
    value.schemaVersion !== CAD_PROJECT_FORMAT_VERSION_V1
  ) {
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

  const requiresSketches =
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V2 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V3 ||
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION;
  const requiresFeatures =
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V3 ||
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION;
  const allowsSketchAttachments =
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION;
  const seenSketchIds = new Set<string>();
  const sketchEntityRefs = new Map<
    SketchEntityId,
    { readonly sketchId: SketchId; readonly kind: SketchEntityKind }
  >();
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
      const extrudeFeatureByBodyId = new Map<BodyId, ExtrudeFeatureSnapshot>();

      for (const [index, feature] of value.features.entries()) {
        const generatedNumbers = validateFeatureSnapshot(
          feature,
          `${path}.features[${index}]`,
          issues,
          seenFeatureIds,
          seenBodyIds,
          seenSketchIds,
          sketchEntityRefs
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
      }

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

  if (value.kind !== "generatedFace") {
    addProjectIssue(
      issues,
      "INVALID_SKETCH",
      `${path}.kind`,
      "Sketch attachment kind must be generatedFace."
    );
    valid = false;
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
      bodyId: value.bodyId
    });
  }
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
    const feature = featuresByBodyId.get(attachment.bodyId);

    if (!feature) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH",
        `${path}.bodyId`,
        "Sketch attachment bodyId must reference an authored extrude body."
      );
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

    const expectedStableId = `generated:face:${attachment.bodyId}:${attachment.faceRole}`;

    if (attachment.faceStableId !== expectedStableId) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH",
        `${path}.faceStableId`,
        "Sketch attachment faceStableId must match the referenced generated face role."
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
  output: Map<
    SketchEntityId,
    { readonly sketchId: SketchId; readonly kind: SketchEntityKind }
  >
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
      output.set(entity.id, { sketchId: value.id, kind: entity.kind });
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
  sketchEntityRefs: ReadonlyMap<
    SketchEntityId,
    { readonly sketchId: SketchId; readonly kind: SketchEntityKind }
  >
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

  if (value.kind !== "extrude") {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.kind`,
      "Feature kind must be extrude."
    );
  }

  validateOptionalFeatureName(value.name, `${path}.name`, issues);

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
    return "Invalid Web CAD project JSON.";
  }

  const suffix =
    issues.length > 1 ? `; ${issues.length - 1} more issue(s).` : ".";

  return `Invalid Web CAD project JSON: ${firstIssue.message} (${firstIssue.path})${suffix}`;
}

function materializeGeneratedObjectIds(
  transaction: Transaction
): readonly CadOp[] {
  let createdObjectIndex = 0;
  let createdSketchIndex = 0;
  let createdSketchEntityIndex = 0;
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

    if (op.op === "feature.extrude") {
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
    return (
      isOptionalString(value.id) &&
      typeof value.name === "string" &&
      typeof value.bodyId === "string" &&
      typeof value.faceStableId === "string"
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

  if (value.op === "feature.extrude") {
    return (
      isOptionalString(value.id) &&
      isOptionalString(value.bodyId) &&
      isOptionalString(value.name) &&
      typeof value.sketchId === "string" &&
      typeof value.entityId === "string" &&
      typeof value.depth === "number" &&
      isPositiveFiniteNumber(value.depth) &&
      (value.side === undefined || isExtrudeSide(value.side))
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
    (value.features === undefined || isFeatureSemanticDiff(value.features))
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
        value.bodiesDeleted.every(isCadBodyRef)))
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
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.kind === "extrude" &&
    typeof value.bodyId === "string" &&
    typeof value.sketchId === "string" &&
    typeof value.entityId === "string" &&
    (value.profileKind === "rectangle" || value.profileKind === "circle")
  );
}

function isCadBodyRef(value: unknown): value is CadBodyRef {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.kind === "solid" &&
    typeof value.featureId === "string"
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

function isExtrudeSide(value: unknown): value is FeatureExtrudeSide {
  return value === "positive" || value === "negative" || value === "symmetric";
}

function isGeneratedExtrudeFaceRole(
  value: unknown
): value is SketchAttachmentSnapshot["faceRole"] {
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
