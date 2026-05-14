import type {
  BoxDimensions,
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

interface TransactionEntry {
  transaction: Transaction;
  before: CadDocument;
  after: CadDocument;
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

  constructor(document: CadDocument = createCadDocument()) {
    this.#document = cloneDocument(document);
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

  apply(op: CadOp): ApplyResult {
    return this.applyBatch([op]);
  }

  applyBatch(ops: readonly CadOp[]): ApplyResult {
    if (ops.length === 0) {
      throw new Error("Cannot apply an empty transaction.");
    }

    const before = cloneDocument(this.#document);
    const nextObjects = new Map(this.#document.objects);
    const diff: MutableSemanticDiff = {
      created: [],
      modified: [],
      deleted: []
    };

    for (const op of ops) {
      applyOperation(op, nextObjects, diff, () =>
        this.#createObjectId(nextObjects)
      );
    }

    const transaction: Transaction = {
      id: this.#createTransactionId(),
      ops: [...ops],
      status: "committed",
      diff
    };

    const after = createCadDocument(nextObjects);
    const entry: TransactionEntry = {
      transaction,
      before,
      after: cloneDocument(after)
    };

    this.#document = after;
    this.#history.push(entry);
    this.#redoStack = [];

    return {
      transaction,
      document: this.#document
    };
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

  #createObjectId(objects: ReadonlyMap<ObjectId, SceneObject>): ObjectId {
    let id = `obj_${this.#nextObjectNumber}`;

    while (objects.has(id)) {
      this.#nextObjectNumber += 1;
      id = `obj_${this.#nextObjectNumber}`;
    }

    this.#nextObjectNumber += 1;
    return id;
  }

  #createTransactionId(): TransactionId {
    const id = `txn_${this.#nextTransactionNumber}`;
    this.#nextTransactionNumber += 1;
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
  createObjectId: () => ObjectId
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

      addObject(objects, object, diff);
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

      addObject(objects, object, diff);
      return;
    }

    case "scene.deleteObject": {
      const existing = getObjectOrThrow(objects, op.id);
      objects.delete(op.id);
      diff.deleted.push(objectRef(existing));
      return;
    }

    case "scene.updateTransform": {
      const existing = getObjectOrThrow(objects, op.id);
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
  diff: MutableSemanticDiff
): void {
  if (objects.has(object.id)) {
    throw new Error(`Object already exists: ${object.id}`);
  }

  objects.set(object.id, object);
  diff.created.push(objectRef(object));
}

function getObjectOrThrow(
  objects: ReadonlyMap<ObjectId, SceneObject>,
  id: ObjectId
): SceneObject {
  const object = objects.get(id);

  if (!object) {
    throw new Error(`Object does not exist: ${id}`);
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
