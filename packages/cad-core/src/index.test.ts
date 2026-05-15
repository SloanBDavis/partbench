import { describe, expect, it } from "vitest";
import {
  AsyncCadCommandExecutor,
  CURRENT_CAD_PROJECT_FORMAT_VERSION,
  CadEngine,
  CadProjectImportError,
  createCadDocument,
  MockCadCommandWorker,
  corePackage,
  exportCadProjectJson,
  importCadProjectJson,
  parseCadProjectJson
} from "./index";

describe("cad-core", () => {
  it("exports package status", () => {
    expect(corePackage).toEqual({
      name: "@web-cad/cad-core",
      status: "ready"
    });
  });

  it("creates a box", () => {
    const engine = new CadEngine();

    const result = engine.apply({
      op: "scene.createBox",
      id: "box_1",
      name: "Base box",
      dimensions: { width: 10, height: 20, depth: 30 }
    });

    expect(result.document.objects.get("box_1")).toEqual({
      id: "box_1",
      kind: "box",
      name: "Base box",
      dimensions: { width: 10, height: 20, depth: 30 },
      transform: {
        translation: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      }
    });
    expect(result.transaction.diff.created).toEqual([
      { id: "box_1", kind: "box" }
    ]);
  });

  it("creates a cylinder", () => {
    const engine = new CadEngine();

    const result = engine.apply({
      op: "scene.createCylinder",
      id: "cylinder_1",
      dimensions: { radius: 5, height: 12 },
      transform: { translation: [4, 5, 6] }
    });

    expect(result.document.objects.get("cylinder_1")).toEqual({
      id: "cylinder_1",
      kind: "cylinder",
      dimensions: { radius: 5, height: 12 },
      transform: {
        translation: [4, 5, 6],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      }
    });
  });

  it("generates object IDs when a command does not provide one", () => {
    const engine = new CadEngine();

    const result = engine.applyBatch([
      {
        op: "scene.createBox",
        id: "obj_1",
        dimensions: { width: 1, height: 1, depth: 1 }
      },
      {
        op: "scene.createCylinder",
        dimensions: { radius: 2, height: 8 }
      }
    ]);

    expect([...result.document.objects.keys()]).toEqual(["obj_1", "obj_2"]);
    expect(result.transaction.diff.created).toEqual([
      { id: "obj_1", kind: "box" },
      { id: "obj_2", kind: "cylinder" }
    ]);
  });

  it("updates an object transform", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 1, height: 1, depth: 1 }
    });

    const result = engine.apply({
      op: "scene.updateTransform",
      id: "box_1",
      transform: {
        translation: [1, 2, 3],
        rotation: [0, 0, Math.PI / 2]
      }
    });

    expect(result.document.objects.get("box_1")?.transform).toEqual({
      translation: [1, 2, 3],
      rotation: [0, 0, Math.PI / 2],
      scale: [1, 1, 1]
    });
    expect(result.transaction.diff.modified).toEqual([
      { id: "box_1", kind: "box" }
    ]);
  });

  it("updates box dimensions with a semantic diff", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 1, height: 1, depth: 1 }
    });

    const result = engine.apply({
      op: "scene.updateBoxDimensions",
      id: "box_1",
      dimensions: { width: 4, height: 5, depth: 6 }
    });

    expect(result.document.objects.get("box_1")).toMatchObject({
      kind: "box",
      dimensions: { width: 4, height: 5, depth: 6 }
    });
    expect(result.transaction.diff).toEqual({
      created: [],
      modified: [{ id: "box_1", kind: "box" }],
      deleted: []
    });
  });

  it("updates cylinder dimensions with a semantic diff", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createCylinder",
      id: "cylinder_1",
      dimensions: { radius: 1, height: 2 }
    });

    const result = engine.apply({
      op: "scene.updateCylinderDimensions",
      id: "cylinder_1",
      dimensions: { radius: 3, height: 8 }
    });

    expect(result.document.objects.get("cylinder_1")).toMatchObject({
      kind: "cylinder",
      dimensions: { radius: 3, height: 8 }
    });
    expect(result.transaction.diff).toEqual({
      created: [],
      modified: [{ id: "cylinder_1", kind: "cylinder" }],
      deleted: []
    });
  });

  it("updates document units with a semantic diff", () => {
    const engine = new CadEngine();

    const result = engine.apply({
      op: "document.updateUnits",
      units: "in"
    });

    expect(result.document.units).toBe("in");
    expect(result.transaction.diff).toEqual({
      created: [],
      modified: [],
      deleted: [],
      document: {
        units: {
          before: "mm",
          after: "in"
        }
      }
    });
  });

  it("renames an object with a semantic diff", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 1, height: 1, depth: 1 }
    });

    const result = engine.apply({
      op: "scene.renameObject",
      id: "box_1",
      name: "  Base plate  "
    });

    expect(result.document.objects.get("box_1")?.name).toBe("Base plate");
    expect(result.transaction.diff).toEqual({
      created: [],
      modified: [{ id: "box_1", kind: "box" }],
      deleted: []
    });
  });

  it("validates document units", () => {
    const engine = new CadEngine();

    const response = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "document.updateUnits",
          units: "ft" as never
        }
      ]
    });

    expect(response).toEqual({
      ok: false,
      mode: "commit",
      error: {
        code: "INVALID_UNITS",
        message: "Unsupported document units: ft.",
        opIndex: 0
      },
      errors: [
        {
          code: "INVALID_UNITS",
          message: "Unsupported document units: ft.",
          opIndex: 0
        }
      ],
      createdIds: [],
      modifiedIds: [],
      deletedIds: [],
      warnings: []
    });
    expect(engine.getDocument().units).toBe("mm");
  });

  it("validates non-empty object names", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createCylinder",
      id: "cylinder_1",
      dimensions: { radius: 1, height: 2 }
    });

    const response = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.renameObject",
          id: "cylinder_1",
          name: "   "
        }
      ]
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error).toEqual({
        code: "INVALID_OBJECT_NAME",
        message: "Object name must be non-empty.",
        opIndex: 0,
        objectId: "cylinder_1"
      });
    }
    expect(
      engine.getDocument().objects.get("cylinder_1")?.name
    ).toBeUndefined();
  });

  it("validates positive dimensions for dimension updates", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 1, height: 1, depth: 1 }
    });

    const response = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.updateBoxDimensions",
          id: "box_1",
          dimensions: { width: 0, height: 2, depth: 3 }
        }
      ]
    });

    expect(response).toEqual({
      ok: false,
      mode: "commit",
      error: {
        code: "INVALID_DIMENSIONS",
        message: "Box dimensions must be positive finite numbers.",
        opIndex: 0,
        objectId: "box_1"
      },
      errors: [
        {
          code: "INVALID_DIMENSIONS",
          message: "Box dimensions must be positive finite numbers.",
          opIndex: 0,
          objectId: "box_1"
        }
      ],
      createdIds: [],
      modifiedIds: [],
      deletedIds: [],
      warnings: []
    });
    expect(engine.getDocument().objects.get("box_1")?.dimensions).toEqual({
      width: 1,
      height: 1,
      depth: 1
    });
  });

  it("rejects dimension updates for the wrong object kind", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createCylinder",
      id: "cylinder_1",
      dimensions: { radius: 1, height: 2 }
    });

    const response = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.updateBoxDimensions",
          id: "cylinder_1",
          dimensions: { width: 2, height: 3, depth: 4 }
        }
      ]
    });

    expect(response.ok).toBe(false);
    expect(response.createdIds).toEqual([]);
    expect(response.modifiedIds).toEqual([]);
    expect(response.deletedIds).toEqual([]);
    if (!response.ok) {
      expect(response.error).toEqual({
        code: "OBJECT_KIND_MISMATCH",
        message: "Object cylinder_1 is a cylinder, not a box.",
        opIndex: 0,
        objectId: "cylinder_1"
      });
    }
  });

  it("deletes an object", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createCylinder",
      id: "cylinder_1",
      dimensions: { radius: 2, height: 8 }
    });

    const result = engine.apply({
      op: "scene.deleteObject",
      id: "cylinder_1"
    });

    expect(result.document.objects.has("cylinder_1")).toBe(false);
    expect(result.transaction.diff.deleted).toEqual([
      { id: "cylinder_1", kind: "cylinder" }
    ]);
  });

  it("undoes a transaction", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 1, height: 1, depth: 1 }
    });

    const undo = engine.undo();

    expect(undo?.document.objects.size).toBe(0);
    expect(undo?.transaction.status).toBe("undone");
    expect(engine.getTransactions()).toEqual([]);
    expect(engine.getRedoStack()).toHaveLength(1);
  });

  it("redoes an undone transaction", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createCylinder",
      id: "cylinder_1",
      dimensions: { radius: 2, height: 8 }
    });
    engine.undo();

    const redo = engine.redo();

    expect(redo?.document.objects.get("cylinder_1")?.kind).toBe("cylinder");
    expect(redo?.transaction.status).toBe("committed");
    expect(engine.getTransactions()).toHaveLength(1);
    expect(engine.getRedoStack()).toEqual([]);
  });

  it("undoes and redoes a dimension update", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createCylinder",
      id: "cylinder_1",
      dimensions: { radius: 1, height: 2 }
    });
    engine.apply({
      op: "scene.updateCylinderDimensions",
      id: "cylinder_1",
      dimensions: { radius: 2.5, height: 7 }
    });

    expect(engine.getDocument().objects.get("cylinder_1")?.dimensions).toEqual({
      radius: 2.5,
      height: 7
    });

    engine.undo();

    expect(engine.getDocument().objects.get("cylinder_1")?.dimensions).toEqual({
      radius: 1,
      height: 2
    });

    engine.redo();

    expect(engine.getDocument().objects.get("cylinder_1")?.dimensions).toEqual({
      radius: 2.5,
      height: 7
    });
  });

  it("undoes and redoes document units and object names", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 1, height: 2, depth: 3 }
    });
    engine.apply({
      op: "document.updateUnits",
      units: "cm"
    });
    engine.apply({
      op: "scene.renameObject",
      id: "box_1",
      name: "Box renamed"
    });

    expect(engine.getDocument().units).toBe("cm");
    expect(engine.getDocument().objects.get("box_1")?.name).toBe("Box renamed");

    engine.undo();

    expect(engine.getDocument().objects.get("box_1")?.name).toBeUndefined();

    engine.undo();

    expect(engine.getDocument().units).toBe("mm");

    engine.redo();
    engine.redo();

    expect(engine.getDocument().units).toBe("cm");
    expect(engine.getDocument().objects.get("box_1")?.name).toBe("Box renamed");
  });

  it("returns combined transaction diff contents for a batch", () => {
    const engine = new CadEngine();

    const result = engine.applyBatch([
      {
        op: "scene.createBox",
        id: "box_1",
        dimensions: { width: 1, height: 2, depth: 3 }
      },
      {
        op: "scene.createCylinder",
        id: "cylinder_1",
        dimensions: { radius: 1, height: 2 }
      },
      {
        op: "scene.updateTransform",
        id: "box_1",
        transform: { scale: [2, 2, 2] }
      },
      {
        op: "scene.deleteObject",
        id: "cylinder_1"
      }
    ]);

    expect(result.transaction.diff).toEqual({
      created: [
        { id: "box_1", kind: "box" },
        { id: "cylinder_1", kind: "cylinder" }
      ],
      modified: [{ id: "box_1", kind: "box" }],
      deleted: [{ id: "cylinder_1", kind: "cylinder" }]
    });
    expect(result.document.objects.get("box_1")?.transform.scale).toEqual([
      2, 2, 2
    ]);
    expect(result.document.objects.has("cylinder_1")).toBe(false);
  });

  it("executes a successful dry-run batch without committing", () => {
    const engine = new CadEngine();

    const response = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [
        {
          op: "scene.createBox",
          id: "box_1",
          dimensions: { width: 1, height: 2, depth: 3 }
        }
      ]
    });

    expect(response).toEqual({
      ok: true,
      mode: "dryRun",
      createdIds: ["box_1"],
      modifiedIds: [],
      deletedIds: [],
      warnings: []
    });
    expect(engine.getDocument().objects.size).toBe(0);
    expect(engine.getTransactions()).toEqual([]);
  });

  it("executes a successful commit batch", () => {
    const engine = new CadEngine();

    const response = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.createCylinder",
          id: "cylinder_1",
          dimensions: { radius: 2, height: 8 }
        }
      ]
    });

    expect(response).toEqual({
      ok: true,
      mode: "commit",
      createdIds: ["cylinder_1"],
      modifiedIds: [],
      deletedIds: [],
      warnings: [],
      transactionId: "txn_1"
    });
    expect(engine.getDocument().objects.get("cylinder_1")?.kind).toBe(
      "cylinder"
    );
    expect(engine.getTransactions()).toHaveLength(1);
  });

  it("returns validation errors for a failed batch", () => {
    const engine = new CadEngine();

    const response = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.deleteObject",
          id: "missing_object"
        }
      ]
    });

    expect(response).toEqual({
      ok: false,
      mode: "commit",
      error: {
        code: "OBJECT_NOT_FOUND",
        message: "Object does not exist: missing_object",
        opIndex: 0,
        objectId: "missing_object"
      },
      errors: [
        {
          code: "OBJECT_NOT_FOUND",
          message: "Object does not exist: missing_object",
          opIndex: 0,
          objectId: "missing_object"
        }
      ],
      createdIds: [],
      modifiedIds: [],
      deletedIds: [],
      warnings: []
    });
    expect(engine.getDocument().objects.size).toBe(0);
    expect(engine.getTransactions()).toEqual([]);
  });

  it("returns structured IDs for a mixed operation batch", () => {
    const engine = new CadEngine();

    const response = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.createBox",
          id: "box_1",
          dimensions: { width: 1, height: 2, depth: 3 }
        },
        {
          op: "scene.createCylinder",
          id: "cylinder_1",
          dimensions: { radius: 1, height: 2 }
        },
        {
          op: "scene.updateTransform",
          id: "box_1",
          transform: { translation: [2, 0, 0] }
        },
        {
          op: "scene.deleteObject",
          id: "cylinder_1"
        }
      ]
    });

    expect(response).toEqual({
      ok: true,
      mode: "commit",
      createdIds: ["box_1", "cylinder_1"],
      modifiedIds: ["box_1"],
      deletedIds: ["cylinder_1"],
      warnings: [],
      transactionId: "txn_1"
    });
    expect(
      engine.getDocument().objects.get("box_1")?.transform.translation
    ).toEqual([2, 0, 0]);
    expect(engine.getDocument().objects.has("cylinder_1")).toBe(false);
  });

  it("dry-runs and commits dimension updates through batches", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 1, height: 2, depth: 3 }
    });

    const batch = {
      version: "cadops.v1" as const,
      mode: "dryRun" as const,
      ops: [
        {
          op: "scene.updateBoxDimensions" as const,
          id: "box_1",
          dimensions: { width: 4, height: 5, depth: 6 }
        }
      ]
    };

    expect(engine.executeBatch(batch)).toEqual({
      ok: true,
      mode: "dryRun",
      createdIds: [],
      modifiedIds: ["box_1"],
      deletedIds: [],
      warnings: []
    });
    expect(engine.getDocument().objects.get("box_1")?.dimensions).toEqual({
      width: 1,
      height: 2,
      depth: 3
    });

    expect(engine.executeBatch({ ...batch, mode: "commit" })).toEqual({
      ok: true,
      mode: "commit",
      createdIds: [],
      modifiedIds: ["box_1"],
      deletedIds: [],
      warnings: [],
      transactionId: "txn_2"
    });
    expect(engine.getDocument().objects.get("box_1")?.dimensions).toEqual({
      width: 4,
      height: 5,
      depth: 6
    });
  });

  it("dry-runs and commits units and rename changes through batches", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 1, height: 2, depth: 3 }
    });

    const ops = [
      {
        op: "document.updateUnits" as const,
        units: "in" as const
      },
      {
        op: "scene.renameObject" as const,
        id: "box_1",
        name: "Named box"
      }
    ];

    expect(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "dryRun",
        ops
      })
    ).toEqual({
      ok: true,
      mode: "dryRun",
      createdIds: [],
      modifiedIds: ["box_1"],
      deletedIds: [],
      warnings: []
    });
    expect(engine.getDocument().units).toBe("mm");
    expect(engine.getDocument().objects.get("box_1")?.name).toBeUndefined();

    expect(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops
      })
    ).toEqual({
      ok: true,
      mode: "commit",
      createdIds: [],
      modifiedIds: ["box_1"],
      deletedIds: [],
      warnings: [],
      transactionId: "txn_2"
    });
    expect(engine.getDocument().units).toBe("in");
    expect(engine.getDocument().objects.get("box_1")?.name).toBe("Named box");
  });

  it("undoes a committed CADOps batch", () => {
    const engine = new CadEngine();

    engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.createBox",
          id: "box_1",
          dimensions: { width: 1, height: 2, depth: 3 }
        },
        {
          op: "scene.createCylinder",
          id: "cylinder_1",
          dimensions: { radius: 1, height: 2 }
        }
      ]
    });

    const undo = engine.undo();

    expect(undo?.transaction.diff.created).toEqual([
      { id: "box_1", kind: "box" },
      { id: "cylinder_1", kind: "cylinder" }
    ]);
    expect(engine.getDocument().objects.size).toBe(0);
    expect(engine.getRedoStack()).toHaveLength(1);
  });

  it("returns a read-only project summary query", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      name: "Base box",
      dimensions: { width: 1, height: 2, depth: 3 },
      transform: { translation: [4, 5, 6] }
    });
    engine.apply({
      op: "scene.createCylinder",
      id: "cylinder_1",
      dimensions: { radius: 2, height: 8 }
    });

    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.summary" }
    });

    expect(response).toEqual({
      ok: true,
      query: "project.summary",
      cadOpsVersion: "cadops.v1",
      units: "mm",
      objectCount: 2,
      objects: [
        {
          id: "box_1",
          kind: "box",
          name: "Base box",
          dimensions: { width: 1, height: 2, depth: 3 },
          transform: {
            translation: [4, 5, 6],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        },
        {
          id: "cylinder_1",
          kind: "cylinder",
          dimensions: { radius: 2, height: 8 },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      ]
    });
    expect(engine.getTransactions()).toHaveLength(2);
  });

  it("returns one object by ID through a read query", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createCylinder",
      id: "fixture",
      name: "Fixture",
      dimensions: { radius: 1.5, height: 6 },
      transform: { rotation: [0, 0, 1.25] }
    });

    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "object.get", id: "fixture" }
    });

    expect(response).toEqual({
      ok: true,
      query: "object.get",
      cadOpsVersion: "cadops.v1",
      object: {
        id: "fixture",
        kind: "cylinder",
        name: "Fixture",
        dimensions: { radius: 1.5, height: 6 },
        transform: {
          translation: [0, 0, 0],
          rotation: [0, 0, 1.25],
          scale: [1, 1, 1]
        }
      }
    });
  });

  it("returns a structured query error for a missing object", () => {
    const engine = new CadEngine();

    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "object.get", id: "missing_object" }
    });

    expect(response).toEqual({
      ok: false,
      query: "object.get",
      cadOpsVersion: "cadops.v1",
      error: {
        code: "OBJECT_NOT_FOUND",
        message: "Object does not exist: missing_object",
        objectId: "missing_object"
      }
    });
  });

  it("executes a batch through the mock worker interface", async () => {
    const engine = new CadEngine();
    const worker = new MockCadCommandWorker();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 1, height: 2, depth: 3 }
    });

    const response = await worker.execute({
      id: "request_1",
      document: engine.createSnapshot(),
      batch: {
        version: "cadops.v1",
        mode: "dryRun",
        ops: [
          {
            op: "scene.updateTransform",
            id: "box_1",
            transform: { translation: [9, 0, 0] }
          }
        ]
      }
    });

    expect(response).toEqual({
      id: "request_1",
      response: {
        ok: true,
        mode: "dryRun",
        createdIds: [],
        modifiedIds: ["box_1"],
        deletedIds: [],
        warnings: []
      }
    });
    expect(
      engine.getDocument().objects.get("box_1")?.transform.translation
    ).toEqual([0, 0, 0]);
  });

  it("runs dry-run batches asynchronously without mutating the authoritative engine", async () => {
    const engine = new CadEngine();
    const executor = new AsyncCadCommandExecutor(
      engine,
      new MockCadCommandWorker()
    );

    const response = await executor.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [
        {
          op: "scene.createCylinder",
          dimensions: { radius: 1, height: 4 }
        }
      ]
    });

    expect(response).toEqual({
      ok: true,
      mode: "dryRun",
      createdIds: ["obj_1"],
      modifiedIds: [],
      deletedIds: [],
      warnings: []
    });
    expect(engine.getDocument().objects.size).toBe(0);
    expect(engine.getTransactions()).toEqual([]);
  });

  it("commits async batches through the authoritative engine after worker validation", async () => {
    const engine = new CadEngine();
    const executor = new AsyncCadCommandExecutor(
      engine,
      new MockCadCommandWorker({ delayMs: 5 })
    );

    const pendingResponse = executor.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.createBox",
          dimensions: { width: 2, height: 2, depth: 2 }
        }
      ]
    });

    expect(engine.getDocument().objects.size).toBe(0);

    const response = await pendingResponse;

    expect(response).toEqual({
      ok: true,
      mode: "commit",
      createdIds: ["obj_1"],
      modifiedIds: [],
      deletedIds: [],
      warnings: [],
      transactionId: "txn_1"
    });
    expect(engine.getDocument().objects.get("obj_1")?.kind).toBe("box");
    expect(engine.getTransactions()).toHaveLength(1);
  });

  it("does not mutate the authoritative engine when async validation fails", async () => {
    const engine = new CadEngine();
    const executor = new AsyncCadCommandExecutor(
      engine,
      new MockCadCommandWorker()
    );

    const response = await executor.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.deleteObject",
          id: "missing_object"
        }
      ]
    });

    expect(response.ok).toBe(false);
    expect(engine.getDocument().objects.size).toBe(0);
    expect(engine.getTransactions()).toEqual([]);
  });

  it("round-trips a project with objects, transforms, dimensions, and history", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      name: "Generated box",
      dimensions: { width: 2, height: 3, depth: 4 },
      transform: { translation: [1, 2, 3] }
    });
    engine.apply({
      op: "scene.createCylinder",
      id: "fixture",
      dimensions: { radius: 1.5, height: 6 },
      transform: { translation: [4, 0, 3] }
    });
    engine.apply({
      op: "scene.updateTransform",
      id: "fixture",
      transform: { rotation: [0, 0, 1.25], scale: [2, 2, 1] }
    });
    engine.apply({
      op: "scene.updateBoxDimensions",
      id: "obj_1",
      dimensions: { width: 8, height: 9, depth: 10 }
    });
    engine.apply({
      op: "scene.updateCylinderDimensions",
      id: "fixture",
      dimensions: { radius: 2.5, height: 7 }
    });
    engine.apply({
      op: "document.updateUnits",
      units: "in"
    });
    engine.apply({
      op: "scene.renameObject",
      id: "fixture",
      name: "Fixture renamed"
    });

    const restored = importCadProjectJson(exportCadProjectJson(engine));
    const restoredObjects = restored.getDocument().objects;

    expect(restored.getDocument().units).toBe("in");
    expect([...restoredObjects.keys()]).toEqual(["obj_1", "fixture"]);
    expect(restoredObjects.get("obj_1")).toEqual(
      engine.getDocument().objects.get("obj_1")
    );
    expect(restoredObjects.get("fixture")).toEqual(
      engine.getDocument().objects.get("fixture")
    );
    expect(restored.getTransactions()).toEqual(engine.getTransactions());

    restored.undo();

    expect(restored.getDocument().objects.get("fixture")?.name).toBeUndefined();

    restored.undo();

    expect(restored.getDocument().units).toBe("mm");

    restored.undo();

    expect(restored.getDocument().objects.get("fixture")?.dimensions).toEqual({
      radius: 1.5,
      height: 6
    });

    restored.undo();

    expect(restored.getDocument().objects.get("obj_1")?.dimensions).toEqual({
      width: 2,
      height: 3,
      depth: 4
    });

    restored.undo();

    expect(restored.getDocument().objects.get("fixture")?.transform).toEqual({
      translation: [4, 0, 3],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    });
  });

  it("round-trips redo history for an undone generated-ID transaction", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      dimensions: { width: 2, height: 2, depth: 2 }
    });
    engine.undo();

    const project = parseCadProjectJson(exportCadProjectJson(engine));
    const restored = importCadProjectJson(JSON.stringify(project));

    expect(restored.getDocument().objects.size).toBe(0);
    expect(restored.getRedoStack()).toHaveLength(1);

    restored.redo();

    expect(restored.getDocument().objects.get("obj_1")?.kind).toBe("box");
    expect(restored.getTransactions()[0]?.id).toBe("txn_1");
  });

  it("exports the current deliberate project format version", () => {
    const project = parseCadProjectJson(exportCadProjectJson(new CadEngine()));

    expect(project.schemaVersion).toBe(CURRENT_CAD_PROJECT_FORMAT_VERSION);
  });

  it("rejects an unsupported project format version with a structured error", () => {
    const project = parseCadProjectJson(exportCadProjectJson(new CadEngine()));

    expectProjectImportError(
      () =>
        parseCadProjectJson(
          JSON.stringify({
            ...project,
            schemaVersion: "web-cad.project.v0"
          })
        ),
      {
        code: "UNSUPPORTED_PROJECT_VERSION",
        path: "$.schemaVersion"
      }
    );
  });

  it("rejects a malformed object with a structured import error", () => {
    const project = parseCadProjectJson(exportCadProjectJson(new CadEngine()));

    expectProjectImportError(
      () =>
        parseCadProjectJson(
          JSON.stringify({
            ...project,
            document: {
              ...project.document,
              objects: [
                {
                  id: "bad_object",
                  kind: "sphere",
                  dimensions: { radius: 1 },
                  transform: {
                    translation: [0, 0, 0],
                    rotation: [0, 0, 0],
                    scale: [1, 1, 1]
                  }
                }
              ]
            }
          })
        ),
      {
        code: "INVALID_OBJECT",
        path: "$.document.objects[0].kind"
      }
    );
  });

  it("rejects invalid object dimensions with a structured import error", () => {
    const project = parseCadProjectJson(exportCadProjectJson(new CadEngine()));

    expectProjectImportError(
      () =>
        parseCadProjectJson(
          JSON.stringify({
            ...project,
            document: {
              ...project.document,
              objects: [
                {
                  id: "bad_box",
                  kind: "box",
                  dimensions: { width: 1, height: 0, depth: 1 },
                  transform: {
                    translation: [0, 0, 0],
                    rotation: [0, 0, 0],
                    scale: [1, 1, 1]
                  }
                }
              ]
            }
          })
        ),
      {
        code: "INVALID_DIMENSIONS",
        path: "$.document.objects[0].dimensions.height"
      }
    );
  });

  it("rejects invalid document units and object names", () => {
    const project = parseCadProjectJson(exportCadProjectJson(new CadEngine()));

    try {
      parseCadProjectJson(
        JSON.stringify({
          ...project,
          document: {
            ...project.document,
            units: "ft",
            objects: [
              {
                id: "bad_box",
                kind: "box",
                name: " ",
                dimensions: { width: 1, height: 1, depth: 1 },
                transform: {
                  translation: [0, 0, 0],
                  rotation: [0, 0, 0],
                  scale: [1, 1, 1]
                }
              }
            ]
          }
        })
      );
    } catch (error) {
      expect(error).toBeInstanceOf(CadProjectImportError);

      const projectError = error as CadProjectImportError;
      expect(projectError.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "INVALID_UNITS",
            path: "$.document.units"
          }),
          expect.objectContaining({
            code: "INVALID_OBJECT_NAME",
            path: "$.document.objects[0].name"
          })
        ])
      );
      return;
    }

    throw new Error("Expected project import error.");
  });

  it("rejects malformed transforms with a structured import error", () => {
    const project = parseCadProjectJson(exportCadProjectJson(new CadEngine()));

    expectProjectImportError(
      () =>
        parseCadProjectJson(
          JSON.stringify({
            ...project,
            document: {
              ...project.document,
              objects: [
                {
                  id: "bad_box",
                  kind: "box",
                  dimensions: { width: 1, height: 1, depth: 1 },
                  transform: {
                    translation: [0, 0],
                    rotation: [0, 0, 0],
                    scale: [1, 1, 1]
                  }
                }
              ]
            }
          })
        ),
      {
        code: "INVALID_TRANSFORM",
        path: "$.document.objects[0].transform.translation"
      }
    );
  });

  it("reports invalid JSON with a structured import error", () => {
    expectProjectImportError(() => parseCadProjectJson("{"), {
      code: "INVALID_JSON",
      path: "$"
    });
  });

  it("rejects transaction history that cannot be replayed", () => {
    const project = parseCadProjectJson(exportCadProjectJson(new CadEngine()));

    expectProjectImportError(
      () =>
        importCadProjectJson(
          JSON.stringify({
            ...project,
            history: [
              {
                id: "txn_1",
                status: "committed",
                ops: [
                  {
                    op: "scene.updateTransform",
                    id: "missing",
                    transform: { translation: [1, 2, 3] }
                  }
                ],
                diff: {
                  created: [],
                  modified: [{ id: "missing", kind: "box" }],
                  deleted: []
                }
              }
            ]
          })
        ),
      {
        code: "INVALID_TRANSACTION_HISTORY",
        path: "$.history"
      }
    );
  });

  it("does not persist derived mesh-like cache fields in project JSON", () => {
    const engine = new CadEngine(
      createCadDocument([
        [
          "box_1",
          {
            id: "box_1",
            kind: "box",
            dimensions: { width: 1, height: 1, depth: 1 },
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1]
            },
            mesh: {
              vertices: [[0, 0, 0]],
              indices: [0]
            },
            geometryStatus: "ready"
          } as never
        ]
      ])
    );

    const projectJson = exportCadProjectJson(engine);
    const project = parseCadProjectJson(projectJson);

    expect(projectJson).not.toContain("mesh");
    expect(projectJson).not.toContain("geometryStatus");
    expect(project.document.objects[0]).toEqual({
      id: "box_1",
      kind: "box",
      dimensions: { width: 1, height: 1, depth: 1 },
      transform: {
        translation: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      }
    });
  });
});

function expectProjectImportError(
  action: () => unknown,
  expectedIssue: { readonly code: string; readonly path: string }
): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(CadProjectImportError);

    const projectError = error as CadProjectImportError;
    expect(projectError.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: expectedIssue.code,
          path: expectedIssue.path
        })
      ])
    );
    return;
  }

  throw new Error("Expected project import error.");
}
