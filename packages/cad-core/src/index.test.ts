import { describe, expect, it } from "vitest";
import {
  AsyncCadCommandExecutor,
  CadEngine,
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

    const restored = importCadProjectJson(exportCadProjectJson(engine));
    const restoredObjects = restored.getDocument().objects;

    expect([...restoredObjects.keys()]).toEqual(["obj_1", "fixture"]);
    expect(restoredObjects.get("obj_1")).toEqual(
      engine.getDocument().objects.get("obj_1")
    );
    expect(restoredObjects.get("fixture")).toEqual(
      engine.getDocument().objects.get("fixture")
    );
    expect(restored.getTransactions()).toEqual(engine.getTransactions());

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
});
