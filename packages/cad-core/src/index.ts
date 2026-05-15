import type {
  BoxDimensions,
  CadBatch,
  CadBatchResponse,
  CadBatchValidationError,
  CadBatchValidationResult,
  CadObjectSnapshot,
  CadObjectRef,
  CadOp,
  CadQueryRequest,
  CadQueryResponse,
  CylinderDimensions,
  ObjectId,
  SemanticDiff,
  TransactionId,
  Transform
} from "@web-cad/cad-protocol";

export type {
  BoxDimensions,
  CadBatch,
  CadBatchResponse,
  CadBatchValidationError,
  CadBatchValidationResult,
  CadObjectSnapshot,
  CadObjectRef,
  CadOp,
  CadQueryRequest,
  CadQueryResponse,
  CylinderDimensions,
  ObjectId,
  SemanticDiff,
  TransactionId,
  Transform
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

export type SceneObject = BoxObject | CylinderObject;

export interface CadDocument {
  readonly objects: ReadonlyMap<ObjectId, SceneObject>;
}

export interface Transaction {
  readonly id: TransactionId;
  readonly ops: readonly CadOp[];
  readonly status: "committed" | "undone";
  readonly diff: SemanticDiff;
}

export interface ApplyResult {
  readonly transaction: Transaction;
  readonly document: CadDocument;
}

export interface CadEngineOptions {
  readonly nextObjectNumber?: number;
}

export interface CadDocumentSnapshot {
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

export type CadProjectFormatVersion = "web-cad.project.v1";

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

export function createDefaultTransform(): Transform {
  return {
    translation: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1]
  };
}

export function createCadDocument(
  objects: Iterable<readonly [ObjectId, SceneObject]> = []
): CadDocument {
  return {
    objects: new Map(objects)
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

  apply(op: CadOp): ApplyResult {
    return this.applyBatch([op]);
  }

  applyBatch(ops: readonly CadOp[]): ApplyResult {
    const before = cloneDocument(this.#document);
    const run = this.#runOperations(ops);

    const transaction: Transaction = {
      id: this.#createTransactionId(),
      ops: [...ops],
      status: "committed",
      diff: run.diff
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

    if (batch.mode === "dryRun") {
      return {
        ok: true,
        mode: batch.mode,
        ...diffIds,
        warnings: validation.warnings
      };
    }

    const result = this.applyBatch(batch.ops);

    return {
      ok: true,
      mode: batch.mode,
      ...diffIds,
      warnings: validation.warnings,
      transactionId: result.transaction.id
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
          objectCount: objects.length,
          objects
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
    }
  }

  validateBatch(batch: CadBatch): CadBatchValidationResult {
    try {
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
    schemaVersion: "web-cad.project.v1",
    document: engine.createSnapshot(),
    history: engine.getTransactions(),
    redoStack: engine.getRedoStack()
  };
}

export function exportCadProjectJson(engine: CadEngine): string {
  return JSON.stringify(exportCadProject(engine), null, 2);
}

export function parseCadProjectJson(json: string): CadProject {
  return parseCadProject(JSON.parse(json));
}

export function importCadProject(project: CadProject): CadEngine {
  return CadEngine.fromProject(project);
}

export function importCadProjectJson(json: string): CadEngine {
  return importCadProject(parseCadProjectJson(json));
}

type MutableSemanticDiff = {
  created: CadObjectRef[];
  modified: CadObjectRef[];
  deleted: CadObjectRef[];
};

function applyOperation(
  op: CadOp,
  objects: Map<ObjectId, SceneObject>,
  diff: MutableSemanticDiff,
  createObjectId: () => ObjectId,
  opIndex: number
): void {
  switch (op.op) {
    case "scene.createBox": {
      validateBoxDimensions(op.dimensions, opIndex);

      const object: BoxObject = {
        id: op.id ?? createObjectId(),
        kind: "box",
        name: op.name,
        dimensions: op.dimensions,
        transform: mergeTransform(op.transform)
      };

      addObject(objects, object, diff, opIndex);
      return;
    }

    case "scene.createCylinder": {
      validateCylinderDimensions(op.dimensions, opIndex);

      const object: CylinderObject = {
        id: op.id ?? createObjectId(),
        kind: "cylinder",
        name: op.name,
        dimensions: op.dimensions,
        transform: mergeTransform(op.transform)
      };

      addObject(objects, object, diff, opIndex);
      return;
    }

    case "scene.deleteObject": {
      const existing = getObjectOrThrow(objects, op.id, opIndex);
      objects.delete(op.id);
      diff.deleted.push(objectRef(existing));
      return;
    }

    case "scene.updateTransform": {
      const existing = getObjectOrThrow(objects, op.id, opIndex);
      const updated: SceneObject = {
        ...existing,
        transform: mergeTransform(op.transform, existing.transform)
      };

      objects.set(op.id, updated);
      diff.modified.push(objectRef(updated));
      return;
    }

    case "scene.updateBoxDimensions": {
      const existing = getObjectOrThrow(objects, op.id, opIndex);
      assertObjectKind(existing, "box", opIndex);
      validateBoxDimensions(op.dimensions, opIndex, op.id);

      const updated: BoxObject = {
        ...existing,
        dimensions: op.dimensions
      };

      objects.set(op.id, updated);
      diff.modified.push(objectRef(updated));
      return;
    }

    case "scene.updateCylinderDimensions": {
      const existing = getObjectOrThrow(objects, op.id, opIndex);
      assertObjectKind(existing, "cylinder", opIndex);
      validateCylinderDimensions(op.dimensions, opIndex, op.id);

      const updated: CylinderObject = {
        ...existing,
        dimensions: op.dimensions
      };

      objects.set(op.id, updated);
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
      objectId: object.id
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
      objectId: id
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
    objectId: object.id
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
    objectId
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
    objectId
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

function cloneDocument(document: CadDocument): CadDocument {
  return createCadDocument(document.objects);
}

export function createCadDocumentSnapshot(
  document: CadDocument,
  nextObjectNumber = inferNextObjectNumber(document)
): CadDocumentSnapshot {
  return {
    objects: [...document.objects.values()],
    nextObjectNumber
  };
}

export function createCadDocumentFromSnapshot(
  snapshot: CadDocumentSnapshot
): CadDocument {
  return createCadDocument(
    snapshot.objects.map((object) => [object.id, object] as const)
  );
}

function createCadObjectSnapshot(object: SceneObject): CadObjectSnapshot {
  if (object.kind === "box") {
    return {
      id: object.id,
      kind: object.kind,
      name: object.name,
      dimensions: { ...object.dimensions },
      transform: cloneTransform(object.transform)
    };
  }

  return {
    id: object.id,
    kind: object.kind,
    name: object.name,
    dimensions: { ...object.dimensions },
    transform: cloneTransform(object.transform)
  };
}

function runOperations(
  ops: readonly CadOp[],
  document: CadDocument,
  initialObjectNumber: number
): OperationRunResult {
  if (ops.length === 0) {
    throwValidationError({
      code: "EMPTY_BATCH",
      message: "Cannot execute an empty batch."
    });
  }

  const nextObjects = new Map(document.objects);
  let nextObjectNumber = initialObjectNumber;
  const diff: MutableSemanticDiff = {
    created: [],
    modified: [],
    deleted: []
  };

  for (const [opIndex, op] of ops.entries()) {
    applyOperation(
      op,
      nextObjects,
      diff,
      () => {
        const result = createObjectId(nextObjects, nextObjectNumber);
        nextObjectNumber = result.nextObjectNumber;
        return result.id;
      },
      opIndex
    );
  }

  return {
    document: createCadDocument(nextObjects),
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
  assertSupportedProject(project);

  const historyState = createTransactionEntries(project.history);
  const redoEntriesInApplyOrder = createTransactionEntries(
    [...project.redoStack].reverse(),
    historyState.document,
    project.document.nextObjectNumber
  );

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

function parseCadProject(value: unknown): CadProject {
  if (!isCadProject(value)) {
    throw new Error("Invalid Web CAD project JSON.");
  }

  return value;
}

function assertSupportedProject(project: CadProject): void {
  if (project.schemaVersion !== "web-cad.project.v1") {
    throw new Error(`Unsupported project schema: ${project.schemaVersion}`);
  }
}

function materializeGeneratedObjectIds(
  transaction: Transaction
): readonly CadOp[] {
  let createdIndex = 0;

  return transaction.ops.map((op) => {
    if (op.op !== "scene.createBox" && op.op !== "scene.createCylinder") {
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

function isCadProject(value: unknown): value is CadProject {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.schemaVersion === "web-cad.project.v1" &&
    isCadDocumentSnapshot(value.document) &&
    Array.isArray(value.history) &&
    value.history.every(isTransaction) &&
    Array.isArray(value.redoStack) &&
    value.redoStack.every(isTransaction)
  );
}

function isCadDocumentSnapshot(value: unknown): value is CadDocumentSnapshot {
  return (
    isRecord(value) &&
    Array.isArray(value.objects) &&
    value.objects.every(isSceneObject) &&
    typeof value.nextObjectNumber === "number" &&
    Number.isInteger(value.nextObjectNumber) &&
    value.nextObjectNumber > 0
  );
}

function isTransaction(value: unknown): value is Transaction {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    Array.isArray(value.ops) &&
    value.ops.every(isCadOp) &&
    (value.status === "committed" || value.status === "undone") &&
    isSemanticDiff(value.diff)
  );
}

function isSceneObject(value: unknown): value is SceneObject {
  if (!isRecord(value) || typeof value.id !== "string") {
    return false;
  }

  if (value.kind === "box") {
    return (
      isBoxDimensions(value.dimensions) &&
      isTransform(value.transform) &&
      isOptionalString(value.name)
    );
  }

  if (value.kind === "cylinder") {
    return (
      isCylinderDimensions(value.dimensions) &&
      isTransform(value.transform) &&
      isOptionalString(value.name)
    );
  }

  return false;
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

function isSemanticDiff(value: unknown): value is SemanticDiff {
  return (
    isRecord(value) &&
    Array.isArray(value.created) &&
    value.created.every(isCadObjectRef) &&
    Array.isArray(value.modified) &&
    value.modified.every(isCadObjectRef) &&
    Array.isArray(value.deleted) &&
    value.deleted.every(isCadObjectRef)
  );
}

function isCadObjectRef(value: unknown): value is CadObjectRef {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.kind === "box" || value.kind === "cylinder")
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

function isTransform(value: unknown): value is Transform {
  return (
    isRecord(value) &&
    isVec3(value.translation) &&
    isVec3(value.rotation) &&
    isVec3(value.scale)
  );
}

function isVec3(value: unknown): value is readonly [number, number, number] {
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
