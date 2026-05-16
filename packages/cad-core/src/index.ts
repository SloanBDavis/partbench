import type {
  CadActorMetadata,
  BoxDimensions,
  CadBatch,
  CadBatchResponse,
  CadBatchValidationError,
  CadBatchValidationResult,
  CadAxisAlignedBounds,
  CadObjectSnapshot,
  CadObjectRef,
  CadOperationSummary,
  CadOp,
  CadPrimitiveFeatureSource,
  CadPrimitiveFeatureSummary,
  CadQueryRequest,
  CadQueryResponse,
  CadSemanticDiffSummary,
  CadTransactionHistoryEntry,
  CadTransactionStatus,
  ConeDimensions,
  CylinderDimensions,
  DocumentSemanticDiff,
  DocumentUnitUpdateMode,
  DocumentUnits,
  ObjectMeasurementsSnapshot,
  ObjectId,
  SemanticDiff,
  SphereDimensions,
  TorusDimensions,
  CadTransactionAuditMetadata,
  TransactionId,
  Transform,
  Vec3
} from "@web-cad/cad-protocol";

export type {
  CadActorMetadata,
  BoxDimensions,
  CadBatch,
  CadBatchResponse,
  CadBatchValidationError,
  CadBatchValidationResult,
  CadAxisAlignedBounds,
  CadObjectSnapshot,
  CadObjectRef,
  CadOperationSummary,
  CadOp,
  CadPrimitiveFeatureSource,
  CadPrimitiveFeatureSummary,
  CadQueryRequest,
  CadQueryResponse,
  CadSemanticDiffSummary,
  CadTransactionHistoryEntry,
  CadTransactionStatus,
  CadTransactionAuditMetadata,
  ConeDimensions,
  CylinderDimensions,
  DocumentSemanticDiff,
  DocumentUnitUpdateMode,
  DocumentUnits,
  ObjectMeasurementsSnapshot,
  ObjectId,
  SemanticDiff,
  SphereDimensions,
  TorusDimensions,
  TransactionId,
  Transform,
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

export interface CadDocument {
  readonly objects: ReadonlyMap<ObjectId, SceneObject>;
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
}

export interface CadExecutionOptions {
  readonly actor?: CadActorMetadata;
  readonly audit?: CadTransactionAuditMetadata;
}

export interface CadDocumentSnapshot {
  readonly units: DocumentUnits;
  readonly objects: readonly SceneObject[];
  readonly nextObjectNumber: number;
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

export interface MockCadCommandWorkerOptions {
  readonly delayMs?: number;
}

export const CURRENT_CAD_PROJECT_FORMAT_VERSION = "web-cad.project.v1";

export type CadProjectFormatVersion = typeof CURRENT_CAD_PROJECT_FORMAT_VERSION;

export type CadProjectImportErrorCode =
  | "INVALID_JSON"
  | "INVALID_PROJECT"
  | "UNSUPPORTED_PROJECT_VERSION"
  | "INVALID_DOCUMENT"
  | "INVALID_UNITS"
  | "INVALID_OBJECT"
  | "INVALID_OBJECT_NAME"
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
}

export const corePackage: PackageInfo = {
  name: "@web-cad/cad-core",
  status: "ready"
};

export const DEFAULT_DOCUMENT_UNITS: DocumentUnits = "mm";

export function createDefaultTransform(): Transform {
  return {
    translation: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1]
  };
}

export function createCadDocument(
  objects: Iterable<readonly [ObjectId, SceneObject]> = [],
  units: DocumentUnits = DEFAULT_DOCUMENT_UNITS
): CadDocument {
  return {
    objects: new Map(objects),
    units
  };
}

export class CadEngine {
  #document: CadDocument;
  #history: TransactionEntry[] = [];
  #redoStack: TransactionEntry[] = [];
  #nextObjectNumber = 1;
  #nextTransactionNumber = 1;

  constructor(
    document: CadDocument = createCadDocument(),
    options: CadEngineOptions = {}
  ) {
    this.#document = cloneDocument(document);
    this.#nextObjectNumber =
      options.nextObjectNumber ?? inferNextObjectNumber(document);
  }

  getDocument(): CadDocument {
    return this.#document;
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
    const state = createProjectState(project);

    this.#document = state.document;
    this.#history = state.history;
    this.#redoStack = state.redoStack;
    this.#nextObjectNumber = project.document.nextObjectNumber;
    this.#nextTransactionNumber = inferNextTransactionNumber([
      ...project.history,
      ...project.redoStack
    ]);
  }

  static fromProject(project: CadProject): CadEngine {
    const engine = new CadEngine();
    engine.loadProject(project);
    return engine;
  }

  createSnapshot(): CadDocumentSnapshot {
    return createCadDocumentSnapshot(this.#document, this.#nextObjectNumber);
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
    this.#history.push(entry);
    this.#redoStack = [];

    return {
      transaction,
      document: this.#document
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
        const features = createPrimitiveFeatureSummaries(
          this.#document,
          this.#history.map((entry) => entry.transaction)
        );

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          featureCount: features.length,
          features
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
      document: this.#document
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
      document: this.#document
    };
  }

  #createTransactionId(): TransactionId {
    const id = `txn_${this.#nextTransactionNumber}`;
    this.#nextTransactionNumber += 1;
    return id;
  }

  #runOperations(ops: readonly CadOp[]): OperationRunResult {
    return runOperations(ops, this.#document, this.#nextObjectNumber);
  }
}

export class MockCadCommandWorker implements CadCommandWorker {
  readonly #delayMs: number;

  constructor(options: MockCadCommandWorkerOptions = {}) {
    this.#delayMs = options.delayMs ?? 0;
  }

  async execute(request: CadWorkerRequest): Promise<CadWorkerResponse> {
    if (this.#delayMs > 0) {
      await delay(this.#delayMs);
    }

    const engine = new CadEngine(
      createCadDocumentFromSnapshot(request.document),
      {
        nextObjectNumber: request.document.nextObjectNumber
      }
    );

    return {
      id: request.id,
      response: engine.executeBatch(request.batch)
    };
  }
}

export class AsyncCadCommandExecutor {
  #nextRequestNumber = 1;

  constructor(
    private readonly engine: CadEngine,
    private readonly worker: CadCommandWorker
  ) {}

  async executeBatch(batch: CadBatch): Promise<CadBatchResponse> {
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
};

type MutableDocumentSemanticDiff = {
  units?: {
    before: DocumentUnits;
    after: DocumentUnits;
    mode: DocumentUnitUpdateMode;
    scaleFactor: number;
  };
};

interface MutableDocumentState {
  objects: Map<ObjectId, SceneObject>;
  units: DocumentUnits;
}

function applyOperation(
  op: CadOp,
  state: MutableDocumentState,
  diff: MutableSemanticDiff,
  createObjectId: () => ObjectId,
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

function scaleLength(value: number, scaleFactor: number): number {
  return cleanMeasurementNumber(value * scaleFactor);
}

function cloneDocument(document: CadDocument): CadDocument {
  return createCadDocument(document.objects, document.units);
}

export function createCadDocumentSnapshot(
  document: CadDocument,
  nextObjectNumber = inferNextObjectNumber(document)
): CadDocumentSnapshot {
  return {
    units: document.units,
    objects: [...document.objects.values()].map(createCadObjectSnapshot),
    nextObjectNumber
  };
}

export function createCadDocumentFromSnapshot(
  snapshot: CadDocumentSnapshot
): CadDocument {
  return createCadDocument(
    snapshot.objects.map(
      (object) => [object.id, createCadObjectSnapshot(object)] as const
    ),
    snapshot.units
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

function createPrimitiveFeatureSummaries(
  document: CadDocument,
  transactions: readonly Transaction[]
): readonly CadPrimitiveFeatureSummary[] {
  const sourceByObjectId = createPrimitiveFeatureSourceMap(transactions);

  return [...document.objects.values()].map((object) => ({
    id: createPrimitiveFeatureId(object.id),
    kind: "primitive",
    primitive: object.kind,
    objectId: object.id,
    name: object.name,
    dimensions: { ...object.dimensions },
    transform: cloneTransform(object.transform),
    source: sourceByObjectId.get(object.id) ?? {
      type: "sceneObject"
    }
  }));
}

function createPrimitiveFeatureId(objectId: ObjectId): string {
  return `feature:${objectId}`;
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

function createTransactionHistoryEntries(
  transactions: readonly Transaction[]
): readonly CadTransactionHistoryEntry[] {
  return sortTransactions(transactions).map(createTransactionHistoryEntry);
}

function sortTransactions(
  transactions: readonly Transaction[]
): readonly Transaction[] {
  return [...transactions].sort((left, right) => {
    const leftNumber = parseTransactionNumber(left.id);
    const rightNumber = parseTransactionNumber(right.id);
    return leftNumber === rightNumber
      ? left.id.localeCompare(right.id)
      : leftNumber - rightNumber;
  });
}

function createTransactionHistoryEntry(
  transaction: Transaction
): CadTransactionHistoryEntry {
  const ops = createOperationSummaries(transaction);

  return {
    id: transaction.id,
    status: transaction.status,
    ...(transaction.actor ? { actor: transaction.actor } : {}),
    ...(transaction.audit ? { audit: transaction.audit } : {}),
    opCount: transaction.ops.length,
    ops,
    diff: createSemanticDiffSummary(transaction.diff)
  };
}

function createOperationSummaries(
  transaction: Transaction
): readonly CadOperationSummary[] {
  let createdIndex = 0;

  return transaction.ops.map((op) => {
    const createdRef =
      op.op === "scene.createBox" ||
      op.op === "scene.createCylinder" ||
      op.op === "scene.createSphere" ||
      op.op === "scene.createCone" ||
      op.op === "scene.createTorus"
        ? transaction.diff.created[createdIndex++]
        : undefined;

    switch (op.op) {
      case "document.updateUnits":
        return {
          op: op.op,
          label: `Set document units to ${op.units} (${formatUnitUpdateModeLabel(op.mode)})`
        };

      case "scene.createBox": {
        const objectId = op.id ?? createdRef?.id;

        return createObjectOperationSummary({
          op: op.op,
          label: `Create box ${objectId ?? "with generated ID"}`,
          objectId,
          objectKind: "box"
        });
      }

      case "scene.createCylinder": {
        const objectId = op.id ?? createdRef?.id;

        return createObjectOperationSummary({
          op: op.op,
          label: `Create cylinder ${objectId ?? "with generated ID"}`,
          objectId,
          objectKind: "cylinder"
        });
      }

      case "scene.createSphere": {
        const objectId = op.id ?? createdRef?.id;

        return createObjectOperationSummary({
          op: op.op,
          label: `Create sphere ${objectId ?? "with generated ID"}`,
          objectId,
          objectKind: "sphere"
        });
      }

      case "scene.createCone": {
        const objectId = op.id ?? createdRef?.id;

        return createObjectOperationSummary({
          op: op.op,
          label: `Create cone ${objectId ?? "with generated ID"}`,
          objectId,
          objectKind: "cone"
        });
      }

      case "scene.createTorus": {
        const objectId = op.id ?? createdRef?.id;

        return createObjectOperationSummary({
          op: op.op,
          label: `Create torus ${objectId ?? "with generated ID"}`,
          objectId,
          objectKind: "torus"
        });
      }

      case "scene.deleteObject":
        return createObjectOperationSummary({
          op: op.op,
          label: `Delete object ${op.id}`,
          objectId: op.id,
          objectKind: findObjectKind(transaction.diff.deleted, op.id)
        });

      case "scene.updateTransform":
        return createObjectOperationSummary({
          op: op.op,
          label: `Update transform for ${op.id}`,
          objectId: op.id,
          objectKind: findObjectKind(transaction.diff.modified, op.id)
        });

      case "scene.updateBoxDimensions":
        return createObjectOperationSummary({
          op: op.op,
          label: `Update box dimensions for ${op.id}`,
          objectId: op.id,
          objectKind: "box"
        });

      case "scene.updateCylinderDimensions":
        return createObjectOperationSummary({
          op: op.op,
          label: `Update cylinder dimensions for ${op.id}`,
          objectId: op.id,
          objectKind: "cylinder"
        });

      case "scene.updateSphereDimensions":
        return createObjectOperationSummary({
          op: op.op,
          label: `Update sphere dimensions for ${op.id}`,
          objectId: op.id,
          objectKind: "sphere"
        });

      case "scene.updateConeDimensions":
        return createObjectOperationSummary({
          op: op.op,
          label: `Update cone dimensions for ${op.id}`,
          objectId: op.id,
          objectKind: "cone"
        });

      case "scene.updateTorusDimensions":
        return createObjectOperationSummary({
          op: op.op,
          label: `Update torus dimensions for ${op.id}`,
          objectId: op.id,
          objectKind: "torus"
        });

      case "scene.renameObject":
        return createObjectOperationSummary({
          op: op.op,
          label: `Rename object ${op.id}`,
          objectId: op.id,
          objectKind: findObjectKind(transaction.diff.modified, op.id)
        });
    }
  });
}

function formatUnitUpdateModeLabel(
  mode: DocumentUnitUpdateMode | undefined
): string {
  return mode === "preservePhysicalSize" ? "convert size" : "relabel values";
}

function createObjectOperationSummary(
  summary: CadOperationSummary
): CadOperationSummary {
  return {
    op: summary.op,
    label: summary.label,
    ...(summary.objectId ? { objectId: summary.objectId } : {}),
    ...(summary.objectKind ? { objectKind: summary.objectKind } : {})
  };
}

function findObjectKind(
  refs: readonly CadObjectRef[],
  id: ObjectId
): CadObjectRef["kind"] | undefined {
  return refs.find((ref) => ref.id === id)?.kind;
}

function createSemanticDiffSummary(diff: SemanticDiff): CadSemanticDiffSummary {
  return {
    created: [...diff.created],
    modified: [...diff.modified],
    deleted: [...diff.deleted],
    createdCount: diff.created.length,
    modifiedCount: diff.modified.length,
    deletedCount: diff.deleted.length,
    ...(diff.document
      ? {
          document: {
            ...(diff.document.units
              ? {
                  units: {
                    before: diff.document.units.before,
                    after: diff.document.units.after,
                    ...(diff.document.units.mode
                      ? { mode: diff.document.units.mode }
                      : {}),
                    ...(diff.document.units.scaleFactor !== undefined
                      ? { scaleFactor: diff.document.units.scaleFactor }
                      : {})
                  }
                }
              : {})
          }
        }
      : {})
  };
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
  initialObjectNumber: number
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
    units: document.units
  };
  let nextObjectNumber = initialObjectNumber;
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

  return {
    document: createCadDocument(state.objects, state.units),
    diff,
    nextObjectNumber
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

function toDiffIds(diff: SemanticDiff): {
  createdIds: readonly ObjectId[];
  modifiedIds: readonly ObjectId[];
  deletedIds: readonly ObjectId[];
} {
  return {
    createdIds: uniqueObjectIds(diff.created),
    modifiedIds: uniqueObjectIds(diff.modified),
    deletedIds: uniqueObjectIds(diff.deleted)
  };
}

function uniqueObjectIds(
  objects: readonly CadObjectRef[]
): readonly ObjectId[] {
  return [...new Set(objects.map((object) => object.id))];
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

function parseObjectNumber(id: ObjectId): number {
  const match = /^obj_(\d+)$/.exec(id);
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

  let historyState: {
    readonly document: CadDocument;
    readonly entries: TransactionEntry[];
  };
  let redoEntriesInApplyOrder: {
    readonly document: CadDocument;
    readonly entries: TransactionEntry[];
  };

  try {
    historyState = createTransactionEntries(project.history);
  } catch (error) {
    throwProjectTransactionHistoryError("$.history", error);
  }

  if (project.history.length > 0 || project.redoStack.length > 0) {
    assertProjectDocumentMatchesReplay(project, historyState.document);
  }

  try {
    redoEntriesInApplyOrder = createTransactionEntries(
      [...project.redoStack].reverse(),
      historyState.document,
      project.document.nextObjectNumber
    );
  } catch (error) {
    throwProjectTransactionHistoryError("$.redoStack", error);
  }

  return {
    document: createCadDocumentFromSnapshot(project.document),
    history: historyState.entries,
    redoStack: [...redoEntriesInApplyOrder.entries].reverse()
  };
}

function createTransactionEntries(
  transactions: readonly Transaction[],
  initialDocument: CadDocument = createCadDocument(),
  initialObjectNumber = inferNextObjectNumber(initialDocument)
): {
  readonly document: CadDocument;
  readonly entries: TransactionEntry[];
} {
  let document = cloneDocument(initialDocument);
  let nextObjectNumber = initialObjectNumber;
  const entries: TransactionEntry[] = [];

  for (const transaction of transactions) {
    const before = cloneDocument(document);
    const run = runOperations(
      materializeGeneratedObjectIds(transaction),
      document,
      nextObjectNumber
    );
    document = run.document;
    nextObjectNumber = run.nextObjectNumber;
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
  if (left.units !== right.units || left.objects.size !== right.objects.size) {
    return false;
  }

  for (const [id, leftObject] of left.objects) {
    const rightObject = right.objects.get(id);

    if (!rightObject || !sceneObjectsEqual(leftObject, rightObject)) {
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

function parseCadProject(value: unknown): CadProject {
  assertValidCadProject(value);
  return value as CadProject;
}

function assertValidCadProject(value: unknown): asserts value is CadProject {
  const issues = validateCadProject(value);

  if (issues.length > 0) {
    throw new CadProjectImportError(issues);
  }
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
  } else if (value.schemaVersion !== CURRENT_CAD_PROJECT_FORMAT_VERSION) {
    addProjectIssue(
      issues,
      "UNSUPPORTED_PROJECT_VERSION",
      "$.schemaVersion",
      `Unsupported project schemaVersion: ${value.schemaVersion}.`
    );
  }

  validateCadDocumentSnapshot(value.document, "$.document", issues);

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
  issues: CadProjectImportIssue[]
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
  let createdIndex = 0;

  return transaction.ops.map((op) => {
    if (
      op.op !== "scene.createBox" &&
      op.op !== "scene.createCylinder" &&
      op.op !== "scene.createSphere" &&
      op.op !== "scene.createCone" &&
      op.op !== "scene.createTorus"
    ) {
      return op;
    }

    if (op.id) {
      return op;
    }

    const createdRef = transaction.diff.created[createdIndex];
    createdIndex += 1;

    return createdRef ? { ...op, id: createdRef.id } : op;
  });
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
    (value.document === undefined || isDocumentSemanticDiff(value.document))
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

function parseTransactionNumber(id: TransactionId): number {
  const match = /^txn_(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}
