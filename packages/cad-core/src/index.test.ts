import { describe, expect, it } from "vitest";
import { CadEngine, corePackage } from "./index";

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
});
