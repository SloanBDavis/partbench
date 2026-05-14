import type {
  BoxDimensions,
  CadBatch,
  CadBatchResponse,
  CadBatchValidationError,
  CadBatchValidationResult,
  CadObjectRef,
  CadOp,
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
  CadObjectRef,
  CadOp,
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
    createdIds: diff.created.map((object) => object.id),
    modifiedIds: diff.modified.map((object) => object.id),
    deletedIds: diff.deleted.map((object) => object.id)
  };
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
