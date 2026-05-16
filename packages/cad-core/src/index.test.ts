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

  it("creates a sphere", () => {
    const engine = new CadEngine();

    const result = engine.apply({
      op: "scene.createSphere",
      id: "sphere_1",
      dimensions: { radius: 5 },
      transform: { translation: [4, 5, 6] }
    });

    expect(result.document.objects.get("sphere_1")).toEqual({
      id: "sphere_1",
      kind: "sphere",
      dimensions: { radius: 5 },
      transform: {
        translation: [4, 5, 6],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      }
    });
    expect(result.transaction.diff.created).toEqual([
      { id: "sphere_1", kind: "sphere" }
    ]);
  });

  it("creates a cone and torus", () => {
    const engine = new CadEngine();

    const result = engine.applyBatch([
      {
        op: "scene.createCone",
        id: "cone_1",
        dimensions: { radius: 2, height: 5 },
        transform: { translation: [1, 2, 2.5] }
      },
      {
        op: "scene.createTorus",
        id: "torus_1",
        dimensions: { majorRadius: 3, minorRadius: 0.75 },
        transform: { translation: [4, 5, 0] }
      }
    ]);

    expect(result.document.objects.get("cone_1")).toMatchObject({
      id: "cone_1",
      kind: "cone",
      dimensions: { radius: 2, height: 5 },
      transform: { translation: [1, 2, 2.5] }
    });
    expect(result.document.objects.get("torus_1")).toMatchObject({
      id: "torus_1",
      kind: "torus",
      dimensions: { majorRadius: 3, minorRadius: 0.75 },
      transform: { translation: [4, 5, 0] }
    });
    expect(result.transaction.diff.created).toEqual([
      { id: "cone_1", kind: "cone" },
      { id: "torus_1", kind: "torus" }
    ]);
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
      },
      {
        op: "scene.createSphere",
        dimensions: { radius: 4 }
      },
      {
        op: "scene.createCone",
        dimensions: { radius: 2, height: 5 }
      },
      {
        op: "scene.createTorus",
        dimensions: { majorRadius: 3, minorRadius: 0.5 }
      }
    ]);

    expect([...result.document.objects.keys()]).toEqual([
      "obj_1",
      "obj_2",
      "obj_3",
      "obj_4",
      "obj_5"
    ]);
    expect(result.transaction.diff.created).toEqual([
      { id: "obj_1", kind: "box" },
      { id: "obj_2", kind: "cylinder" },
      { id: "obj_3", kind: "sphere" },
      { id: "obj_4", kind: "cone" },
      { id: "obj_5", kind: "torus" }
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

  it("updates sphere dimensions with a semantic diff", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createSphere",
      id: "sphere_1",
      dimensions: { radius: 1 }
    });

    const result = engine.apply({
      op: "scene.updateSphereDimensions",
      id: "sphere_1",
      dimensions: { radius: 3 }
    });

    expect(result.document.objects.get("sphere_1")).toMatchObject({
      kind: "sphere",
      dimensions: { radius: 3 }
    });
    expect(result.transaction.diff).toEqual({
      created: [],
      modified: [{ id: "sphere_1", kind: "sphere" }],
      deleted: []
    });
  });

  it("updates cone and torus dimensions with semantic diffs", () => {
    const engine = new CadEngine();

    engine.applyBatch([
      {
        op: "scene.createCone",
        id: "cone_1",
        dimensions: { radius: 1, height: 2 }
      },
      {
        op: "scene.createTorus",
        id: "torus_1",
        dimensions: { majorRadius: 2, minorRadius: 0.4 }
      }
    ]);

    const result = engine.applyBatch([
      {
        op: "scene.updateConeDimensions",
        id: "cone_1",
        dimensions: { radius: 3, height: 8 }
      },
      {
        op: "scene.updateTorusDimensions",
        id: "torus_1",
        dimensions: { majorRadius: 4, minorRadius: 0.75 }
      }
    ]);

    expect(result.document.objects.get("cone_1")).toMatchObject({
      kind: "cone",
      dimensions: { radius: 3, height: 8 }
    });
    expect(result.document.objects.get("torus_1")).toMatchObject({
      kind: "torus",
      dimensions: { majorRadius: 4, minorRadius: 0.75 }
    });
    expect(result.transaction.diff).toEqual({
      created: [],
      modified: [
        { id: "cone_1", kind: "cone" },
        { id: "torus_1", kind: "torus" }
      ],
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
          after: "in",
          mode: "metadataOnly",
          scaleFactor: 1
        }
      }
    });
  });

  it("converts document length values when unit updates preserve physical size", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 10, height: 20, depth: 30 },
      transform: { translation: [10, 20, 30] }
    });
    engine.apply({
      op: "scene.createCylinder",
      id: "cylinder_1",
      dimensions: { radius: 5, height: 10 },
      transform: { translation: [25.4, 0, 10] }
    });
    engine.apply({
      op: "scene.createSphere",
      id: "sphere_1",
      dimensions: { radius: 12.7 },
      transform: { translation: [0, 25.4, 12.7] }
    });
    engine.apply({
      op: "scene.createCone",
      id: "cone_1",
      dimensions: { radius: 25.4, height: 50.8 },
      transform: { translation: [25.4, 25.4, 25.4] }
    });
    engine.apply({
      op: "scene.createTorus",
      id: "torus_1",
      dimensions: { majorRadius: 50.8, minorRadius: 12.7 },
      transform: { translation: [50.8, 0, 0] }
    });

    const result = engine.apply({
      op: "document.updateUnits",
      units: "in",
      mode: "preservePhysicalSize"
    });

    const box = result.document.objects.get("box_1");
    const cylinder = result.document.objects.get("cylinder_1");
    const sphere = result.document.objects.get("sphere_1");
    const cone = result.document.objects.get("cone_1");
    const torus = result.document.objects.get("torus_1");

    expect(result.document.units).toBe("in");
    expect(box?.kind).toBe("box");
    expect(cylinder?.kind).toBe("cylinder");
    expect(sphere?.kind).toBe("sphere");
    expect(cone?.kind).toBe("cone");
    expect(torus?.kind).toBe("torus");

    if (
      box?.kind !== "box" ||
      cylinder?.kind !== "cylinder" ||
      sphere?.kind !== "sphere" ||
      cone?.kind !== "cone" ||
      torus?.kind !== "torus"
    ) {
      throw new Error("Expected converted supported primitive objects.");
    }

    expect(box.dimensions.width).toBeCloseTo(10 / 25.4, 10);
    expect(box.dimensions.height).toBeCloseTo(20 / 25.4, 10);
    expect(box.dimensions.depth).toBeCloseTo(30 / 25.4, 10);
    expect(box.transform.translation[0]).toBeCloseTo(10 / 25.4, 10);
    expect(box.transform.translation[1]).toBeCloseTo(20 / 25.4, 10);
    expect(box.transform.translation[2]).toBeCloseTo(30 / 25.4, 10);

    expect(cylinder.dimensions.radius).toBeCloseTo(5 / 25.4, 10);
    expect(cylinder.dimensions.height).toBeCloseTo(10 / 25.4, 10);
    expect(cylinder.transform.translation[0]).toBeCloseTo(1, 10);
    expect(cylinder.transform.translation[1]).toBeCloseTo(0, 10);
    expect(cylinder.transform.translation[2]).toBeCloseTo(10 / 25.4, 10);

    expect(sphere.dimensions.radius).toBeCloseTo(0.5, 10);
    expect(sphere.transform.translation[0]).toBeCloseTo(0, 10);
    expect(sphere.transform.translation[1]).toBeCloseTo(1, 10);
    expect(sphere.transform.translation[2]).toBeCloseTo(0.5, 10);

    expect(cone.dimensions.radius).toBeCloseTo(1, 10);
    expect(cone.dimensions.height).toBeCloseTo(2, 10);
    expect(cone.transform.translation[0]).toBeCloseTo(1, 10);
    expect(cone.transform.translation[1]).toBeCloseTo(1, 10);
    expect(cone.transform.translation[2]).toBeCloseTo(1, 10);

    expect(torus.dimensions.majorRadius).toBeCloseTo(2, 10);
    expect(torus.dimensions.minorRadius).toBeCloseTo(0.5, 10);
    expect(torus.transform.translation[0]).toBeCloseTo(2, 10);
    expect(torus.transform.translation[1]).toBeCloseTo(0, 10);
    expect(torus.transform.translation[2]).toBeCloseTo(0, 10);

    expect(result.transaction.diff).toEqual({
      created: [],
      modified: [
        { id: "box_1", kind: "box" },
        { id: "cylinder_1", kind: "cylinder" },
        { id: "sphere_1", kind: "sphere" },
        { id: "cone_1", kind: "cone" },
        { id: "torus_1", kind: "torus" }
      ],
      deleted: [],
      document: {
        units: {
          before: "mm",
          after: "in",
          mode: "preservePhysicalSize",
          scaleFactor: 0.03937007874
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

    expect(response).toMatchObject({
      ok: false,
      mode: "commit",
      error: {
        code: "INVALID_UNITS",
        message: "Unsupported document units: ft.",
        opIndex: 0,
        op: "document.updateUnits",
        path: "$.ops[0].units",
        expected: "mm, cm, m, or in",
        received: "ft"
      },
      errors: [
        expect.objectContaining({
          code: "INVALID_UNITS",
          message: "Unsupported document units: ft.",
          opIndex: 0,
          op: "document.updateUnits",
          path: "$.ops[0].units"
        })
      ],
      createdIds: [],
      modifiedIds: [],
      deletedIds: [],
      warnings: []
    });
    expect(engine.getDocument().units).toBe("mm");
  });

  it("validates document unit update mode", () => {
    const engine = new CadEngine();

    const response = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "document.updateUnits",
          units: "in",
          mode: "reinterpret" as never
        }
      ]
    });

    expect(response).toMatchObject({
      ok: false,
      mode: "commit",
      error: {
        code: "INVALID_UNIT_UPDATE_MODE",
        message: "Unsupported document unit update mode: reinterpret.",
        opIndex: 0,
        op: "document.updateUnits",
        path: "$.ops[0].mode",
        expected: "metadataOnly or preservePhysicalSize",
        received: "reinterpret"
      },
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
      expect(response.error).toMatchObject({
        code: "INVALID_OBJECT_NAME",
        message: "Object name must be non-empty.",
        opIndex: 0,
        op: "scene.renameObject",
        objectId: "cylinder_1",
        path: "$.ops[0].name",
        expected: "non-empty string",
        received: "   "
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

    expect(response).toMatchObject({
      ok: false,
      mode: "commit",
      error: {
        code: "INVALID_DIMENSIONS",
        message: "Box dimensions must be positive finite numbers.",
        opIndex: 0,
        op: "scene.updateBoxDimensions",
        objectId: "box_1",
        path: "$.ops[0].dimensions",
        expected: "positive finite width, height, and depth",
        received: '{"width":0,"height":2,"depth":3}'
      },
      errors: [
        expect.objectContaining({
          code: "INVALID_DIMENSIONS",
          message: "Box dimensions must be positive finite numbers.",
          opIndex: 0,
          op: "scene.updateBoxDimensions",
          objectId: "box_1",
          path: "$.ops[0].dimensions"
        })
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

  it("validates positive sphere dimensions", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createSphere",
      id: "sphere_1",
      dimensions: { radius: 1 }
    });

    const response = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.updateSphereDimensions",
          id: "sphere_1",
          dimensions: { radius: 0 }
        }
      ]
    });

    expect(response).toMatchObject({
      ok: false,
      mode: "commit",
      error: {
        code: "INVALID_DIMENSIONS",
        message: "Sphere dimensions must be positive finite numbers.",
        opIndex: 0,
        op: "scene.updateSphereDimensions",
        objectId: "sphere_1",
        path: "$.ops[0].dimensions",
        expected: "positive finite radius",
        received: '{"radius":0}'
      },
      createdIds: [],
      modifiedIds: [],
      deletedIds: [],
      warnings: []
    });
    expect(engine.getDocument().objects.get("sphere_1")?.dimensions).toEqual({
      radius: 1
    });
  });

  it("validates cone and torus dimensions", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createCone",
      id: "cone_1",
      dimensions: { radius: 1, height: 2 }
    });
    engine.apply({
      op: "scene.createTorus",
      id: "torus_1",
      dimensions: { majorRadius: 2, minorRadius: 0.4 }
    });

    const coneResponse = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.updateConeDimensions",
          id: "cone_1",
          dimensions: { radius: 0, height: 2 }
        }
      ]
    });

    expect(coneResponse).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_DIMENSIONS",
        message: "Cone dimensions must be positive finite numbers.",
        op: "scene.updateConeDimensions",
        objectId: "cone_1"
      }
    });

    const torusResponse = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.updateTorusDimensions",
          id: "torus_1",
          dimensions: { majorRadius: 2, minorRadius: 2 }
        }
      ]
    });

    expect(torusResponse).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_DIMENSIONS",
        message:
          "Torus dimensions must be positive finite numbers with minorRadius smaller than majorRadius.",
        op: "scene.updateTorusDimensions",
        objectId: "torus_1"
      }
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
      expect(response.error).toMatchObject({
        code: "OBJECT_KIND_MISMATCH",
        message: "Object cylinder_1 is a cylinder, not a box.",
        opIndex: 0,
        op: "scene.updateBoxDimensions",
        objectId: "cylinder_1",
        path: "$.ops[0].id",
        expected: "box",
        received: "cylinder"
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

  it("undoes and redoes document unit conversion", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 10, height: 20, depth: 30 },
      transform: { translation: [40, 50, 60] }
    });
    engine.apply({
      op: "document.updateUnits",
      units: "cm",
      mode: "preservePhysicalSize"
    });

    expect(engine.getDocument().units).toBe("cm");
    expect(engine.getDocument().objects.get("box_1")).toMatchObject({
      dimensions: { width: 1, height: 2, depth: 3 },
      transform: { translation: [4, 5, 6] }
    });

    engine.undo();

    expect(engine.getDocument().units).toBe("mm");
    expect(engine.getDocument().objects.get("box_1")).toMatchObject({
      dimensions: { width: 10, height: 20, depth: 30 },
      transform: { translation: [40, 50, 60] }
    });

    engine.redo();

    expect(engine.getDocument().units).toBe("cm");
    expect(engine.getDocument().objects.get("box_1")).toMatchObject({
      dimensions: { width: 1, height: 2, depth: 3 },
      transform: { translation: [4, 5, 6] }
    });
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

  it("supports sphere create and dimension updates in batch dry-run and commit", () => {
    const engine = new CadEngine();

    const dryRun = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [
        {
          op: "scene.createSphere",
          id: "sphere_1",
          dimensions: { radius: 2 }
        }
      ]
    });

    expect(dryRun).toMatchObject({
      ok: true,
      createdIds: ["sphere_1"],
      modifiedIds: []
    });
    expect(engine.getDocument().objects.has("sphere_1")).toBe(false);

    const commit = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.createSphere",
          id: "sphere_1",
          dimensions: { radius: 2 }
        },
        {
          op: "scene.updateSphereDimensions",
          id: "sphere_1",
          dimensions: { radius: 3 }
        }
      ]
    });

    expect(commit).toMatchObject({
      ok: true,
      createdIds: ["sphere_1"],
      modifiedIds: ["sphere_1"],
      transactionId: "txn_1"
    });
    expect(engine.getDocument().objects.get("sphere_1")).toMatchObject({
      kind: "sphere",
      dimensions: { radius: 3 }
    });

    engine.undo();
    expect(engine.getDocument().objects.has("sphere_1")).toBe(false);

    engine.redo();
    expect(engine.getDocument().objects.get("sphere_1")).toMatchObject({
      kind: "sphere",
      dimensions: { radius: 3 }
    });
  });

  it("supports cone and torus create and dimension updates in batch dry-run and commit", () => {
    const engine = new CadEngine();

    const dryRun = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [
        {
          op: "scene.createCone",
          id: "cone_1",
          dimensions: { radius: 1, height: 2 }
        },
        {
          op: "scene.createTorus",
          id: "torus_1",
          dimensions: { majorRadius: 2, minorRadius: 0.4 }
        }
      ]
    });

    expect(dryRun).toMatchObject({
      ok: true,
      createdIds: ["cone_1", "torus_1"],
      modifiedIds: []
    });
    expect(engine.getDocument().objects.size).toBe(0);

    const commit = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.createCone",
          id: "cone_1",
          dimensions: { radius: 1, height: 2 }
        },
        {
          op: "scene.createTorus",
          id: "torus_1",
          dimensions: { majorRadius: 2, minorRadius: 0.4 }
        },
        {
          op: "scene.updateConeDimensions",
          id: "cone_1",
          dimensions: { radius: 3, height: 8 }
        },
        {
          op: "scene.updateTorusDimensions",
          id: "torus_1",
          dimensions: { majorRadius: 4, minorRadius: 0.75 }
        }
      ]
    });

    expect(commit).toMatchObject({
      ok: true,
      createdIds: ["cone_1", "torus_1"],
      modifiedIds: ["cone_1", "torus_1"],
      transactionId: "txn_1"
    });
    expect(engine.getDocument().objects.get("cone_1")).toMatchObject({
      kind: "cone",
      dimensions: { radius: 3, height: 8 }
    });
    expect(engine.getDocument().objects.get("torus_1")).toMatchObject({
      kind: "torus",
      dimensions: { majorRadius: 4, minorRadius: 0.75 }
    });

    engine.undo();
    expect(engine.getDocument().objects.size).toBe(0);

    engine.redo();
    expect(engine.getDocument().objects.get("cone_1")).toMatchObject({
      kind: "cone",
      dimensions: { radius: 3, height: 8 }
    });
  });

  it("records actor metadata for direct command execution", () => {
    const engine = new CadEngine();

    const result = engine.apply(
      {
        op: "scene.createBox",
        id: "human_box",
        dimensions: { width: 1, height: 1, depth: 1 }
      },
      {
        actor: {
          type: "human",
          id: "user-1",
          name: "Test User"
        }
      }
    );

    expect(result.transaction.actor).toEqual({
      type: "human",
      id: "user-1",
      name: "Test User"
    });
    expect(engine.getTransactions()[0]?.actor).toEqual(
      result.transaction.actor
    );
  });

  it("records actor metadata for committed batches", () => {
    const engine = new CadEngine();

    const response = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      actor: {
        type: "script",
        id: "seed-script",
        name: "Seed Script"
      },
      ops: [
        {
          op: "scene.createCylinder",
          id: "script_cylinder",
          dimensions: { radius: 1, height: 2 }
        }
      ]
    });

    expect(response).toEqual({
      ok: true,
      mode: "commit",
      createdIds: ["script_cylinder"],
      modifiedIds: [],
      deletedIds: [],
      warnings: [],
      transactionId: "txn_1",
      actor: {
        type: "script",
        id: "seed-script",
        name: "Seed Script"
      }
    });
    expect(engine.getTransactions()[0]?.actor).toEqual({
      type: "script",
      id: "seed-script",
      name: "Seed Script"
    });
  });

  it("preserves transaction actor metadata through undo and redo", () => {
    const engine = new CadEngine();

    engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      actor: {
        type: "agent",
        id: "agent-1",
        name: "Fixture Agent"
      },
      ops: [
        {
          op: "scene.createBox",
          id: "agent_box",
          dimensions: { width: 2, height: 2, depth: 2 }
        }
      ]
    });

    const undo = engine.undo();
    const redo = engine.redo();

    expect(undo?.transaction.actor).toEqual({
      type: "agent",
      id: "agent-1",
      name: "Fixture Agent"
    });
    expect(redo?.transaction.actor).toEqual(undo?.transaction.actor);
    expect(engine.getTransactions()[0]?.actor).toEqual(undo?.transaction.actor);
  });

  it("returns structured validation errors for invalid actor metadata", () => {
    const engine = new CadEngine();

    const response = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      actor: {
        type: "robot" as never
      },
      ops: [
        {
          op: "scene.createBox",
          id: "box_1",
          dimensions: { width: 1, height: 1, depth: 1 }
        }
      ]
    });

    expect(response).toMatchObject({
      ok: false,
      mode: "commit",
      error: {
        code: "INVALID_ACTOR",
        message:
          "Transaction actor type must be human, agent, script, or system.",
        path: "$.actor.type",
        expected: "human, agent, script, or system",
        received: "robot"
      },
      createdIds: [],
      modifiedIds: [],
      deletedIds: [],
      warnings: []
    });
    expect(engine.getTransactions()).toEqual([]);
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

    expect(response).toMatchObject({
      ok: false,
      mode: "commit",
      error: {
        code: "OBJECT_NOT_FOUND",
        message: "Object does not exist: missing_object",
        opIndex: 0,
        op: "scene.deleteObject",
        objectId: "missing_object",
        path: "$.ops[0].id",
        expected: "existing object id",
        received: "missing_object"
      },
      errors: [
        expect.objectContaining({
          code: "OBJECT_NOT_FOUND",
          message: "Object does not exist: missing_object",
          opIndex: 0,
          op: "scene.deleteObject",
          objectId: "missing_object",
          path: "$.ops[0].id"
        })
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

  it("dry-runs and commits unit conversion through batches", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 10, height: 20, depth: 30 },
      transform: { translation: [40, 50, 60] }
    });

    const batch = {
      version: "cadops.v1" as const,
      mode: "dryRun" as const,
      ops: [
        {
          op: "document.updateUnits" as const,
          units: "cm" as const,
          mode: "preservePhysicalSize" as const
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
    expect(engine.getDocument().units).toBe("mm");
    expect(engine.getDocument().objects.get("box_1")).toMatchObject({
      dimensions: { width: 10, height: 20, depth: 30 },
      transform: { translation: [40, 50, 60] }
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
    expect(engine.getDocument().units).toBe("cm");
    expect(engine.getDocument().objects.get("box_1")).toMatchObject({
      dimensions: { width: 1, height: 2, depth: 3 },
      transform: { translation: [4, 5, 6] }
    });
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

  it("returns read-only primitive feature summaries from current scene objects", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      name: "Generated box",
      dimensions: { width: 1, height: 2, depth: 3 }
    });
    engine.apply({
      op: "scene.updateBoxDimensions",
      id: "obj_1",
      dimensions: { width: 4, height: 5, depth: 6 }
    });
    engine.apply({
      op: "scene.createCylinder",
      id: "cylinder_1",
      name: "Source cylinder",
      dimensions: { radius: 2, height: 8 },
      transform: { translation: [1, 2, 3] }
    });

    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.features" }
    });

    expect(response).toEqual({
      ok: true,
      query: "project.features",
      cadOpsVersion: "cadops.v1",
      featureCount: 2,
      features: [
        {
          id: "feature:obj_1",
          kind: "primitive",
          partId: "part:default",
          primitive: "box",
          objectId: "obj_1",
          bodyId: "body:obj_1",
          name: "Generated box",
          dimensions: { width: 4, height: 5, depth: 6 },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          },
          source: {
            type: "sceneObject",
            createdByTransactionId: "txn_1",
            createOp: "scene.createBox"
          }
        },
        {
          id: "feature:cylinder_1",
          kind: "primitive",
          partId: "part:default",
          primitive: "cylinder",
          objectId: "cylinder_1",
          bodyId: "body:cylinder_1",
          name: "Source cylinder",
          dimensions: { radius: 2, height: 8 },
          transform: {
            translation: [1, 2, 3],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          },
          source: {
            type: "sceneObject",
            createdByTransactionId: "txn_3",
            createOp: "scene.createCylinder"
          }
        }
      ]
    });
  });

  it("returns a derived default part, primitive features, bodies, and object mappings", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "structure_box",
      name: "Structure box",
      dimensions: { width: 1, height: 2, depth: 3 }
    });
    engine.apply({
      op: "scene.createSphere",
      id: "structure_sphere",
      dimensions: { radius: 4 }
    });

    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });

    expect(response).toEqual({
      ok: true,
      query: "project.structure",
      cadOpsVersion: "cadops.v1",
      partCount: 1,
      featureCount: 2,
      bodyCount: 2,
      parts: [
        {
          id: "part:default",
          kind: "part",
          name: "Default Part",
          source: { type: "defaultScenePart" },
          objectIds: ["structure_box", "structure_sphere"],
          featureIds: ["feature:structure_box", "feature:structure_sphere"],
          bodyIds: ["body:structure_box", "body:structure_sphere"]
        }
      ],
      features: [
        {
          id: "feature:structure_box",
          kind: "primitive",
          partId: "part:default",
          primitive: "box",
          objectId: "structure_box",
          bodyId: "body:structure_box",
          name: "Structure box",
          dimensions: { width: 1, height: 2, depth: 3 },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          },
          source: {
            type: "sceneObject",
            createdByTransactionId: "txn_1",
            createOp: "scene.createBox"
          }
        },
        {
          id: "feature:structure_sphere",
          kind: "primitive",
          partId: "part:default",
          primitive: "sphere",
          objectId: "structure_sphere",
          bodyId: "body:structure_sphere",
          dimensions: { radius: 4 },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          },
          source: {
            type: "sceneObject",
            createdByTransactionId: "txn_2",
            createOp: "scene.createSphere"
          }
        }
      ],
      bodies: [
        {
          id: "body:structure_box",
          kind: "solid",
          partId: "part:default",
          featureId: "feature:structure_box",
          objectId: "structure_box",
          primitive: "box",
          name: "Structure box",
          source: {
            type: "primitiveFeature",
            featureId: "feature:structure_box",
            objectId: "structure_box"
          }
        },
        {
          id: "body:structure_sphere",
          kind: "solid",
          partId: "part:default",
          featureId: "feature:structure_sphere",
          objectId: "structure_sphere",
          primitive: "sphere",
          source: {
            type: "primitiveFeature",
            featureId: "feature:structure_sphere",
            objectId: "structure_sphere"
          }
        }
      ],
      objectSources: [
        {
          objectId: "structure_box",
          partId: "part:default",
          featureId: "feature:structure_box",
          bodyId: "body:structure_box"
        },
        {
          objectId: "structure_sphere",
          partId: "part:default",
          featureId: "feature:structure_sphere",
          bodyId: "body:structure_sphere"
        }
      ]
    });
  });

  it("keeps primitive feature summaries aligned with undo and redo", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "undo_feature_box",
      dimensions: { width: 1, height: 1, depth: 1 }
    });

    engine.undo();

    const undone = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.features" }
    });

    expect(undone).toEqual({
      ok: true,
      query: "project.features",
      cadOpsVersion: "cadops.v1",
      featureCount: 0,
      features: []
    });

    engine.redo();

    const redone = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.features" }
    });

    expect(redone).toMatchObject({
      ok: true,
      query: "project.features",
      featureCount: 1,
      features: [
        {
          id: "feature:undo_feature_box",
          partId: "part:default",
          objectId: "undo_feature_box",
          bodyId: "body:undo_feature_box",
          source: {
            createdByTransactionId: "txn_1",
            createOp: "scene.createBox"
          }
        }
      ]
    });
  });

  it("preserves primitive feature summaries through project export and import", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createCylinder",
      id: "exported_feature_cylinder",
      dimensions: { radius: 1, height: 3 }
    });

    const restored = importCadProjectJson(exportCadProjectJson(engine));
    const featuresResponse = restored.executeQuery({
      version: "cadops.v1",
      query: { query: "project.features" }
    });
    const structureResponse = restored.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });

    expect(featuresResponse).toMatchObject({
      ok: true,
      query: "project.features",
      featureCount: 1,
      features: [
        {
          id: "feature:exported_feature_cylinder",
          partId: "part:default",
          primitive: "cylinder",
          objectId: "exported_feature_cylinder",
          bodyId: "body:exported_feature_cylinder",
          source: {
            createdByTransactionId: "txn_1",
            createOp: "scene.createCylinder"
          }
        }
      ]
    });
    expect(structureResponse).toMatchObject({
      ok: true,
      query: "project.structure",
      parts: [
        {
          id: "part:default",
          featureIds: ["feature:exported_feature_cylinder"],
          bodyIds: ["body:exported_feature_cylinder"],
          objectIds: ["exported_feature_cylinder"]
        }
      ],
      bodies: [
        {
          id: "body:exported_feature_cylinder",
          featureId: "feature:exported_feature_cylinder",
          objectId: "exported_feature_cylinder"
        }
      ],
      objectSources: [
        {
          objectId: "exported_feature_cylinder",
          partId: "part:default",
          featureId: "feature:exported_feature_cylinder",
          bodyId: "body:exported_feature_cylinder"
        }
      ]
    });
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

  it("returns object measurements for boxes from the authoritative document", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      name: "Measured box",
      dimensions: { width: 2, height: 4, depth: 6 },
      transform: {
        translation: [10, 0, 3],
        rotation: [0, 0, Math.PI / 2],
        scale: [1, 2, 1]
      }
    });

    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "object.measurements", id: "box_1" }
    });

    expect(response).toMatchObject({
      ok: true,
      query: "object.measurements",
      cadOpsVersion: "cadops.v1",
      measurements: {
        id: "box_1",
        kind: "box",
        name: "Measured box",
        units: "mm",
        dimensions: { width: 2, height: 4, depth: 6 },
        localBounds: {
          min: [-1, -2, -3],
          max: [1, 2, 3],
          size: [2, 4, 6],
          center: [0, 0, 0]
        },
        worldBounds: {
          min: [6, -1, 0],
          max: [14, 1, 6],
          size: [8, 2, 6],
          center: [10, 0, 3]
        },
        approximateVolume: 96
      }
    });
  });

  it("returns approximate cylinder measurements", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createCylinder",
      id: "cylinder_1",
      dimensions: { radius: 2, height: 5 },
      transform: { translation: [1, 2, 3] }
    });

    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "object.measurements", id: "cylinder_1" }
    });

    expect(response).toMatchObject({
      ok: true,
      query: "object.measurements",
      measurements: {
        id: "cylinder_1",
        kind: "cylinder",
        localBounds: {
          min: [-2, -2, -2.5],
          max: [2, 2, 2.5],
          size: [4, 4, 5],
          center: [0, 0, 0]
        },
        worldBounds: {
          min: [-1, 0, 0.5],
          max: [3, 4, 5.5],
          size: [4, 4, 5],
          center: [1, 2, 3]
        }
      }
    });

    if (response.ok && response.query === "object.measurements") {
      expect(response.measurements.approximateVolume).toBeCloseTo(20 * Math.PI);
    } else {
      throw new Error("Expected object measurements response.");
    }
  });

  it("returns approximate sphere measurements", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createSphere",
      id: "sphere_1",
      dimensions: { radius: 2 },
      transform: { translation: [1, 2, 3] }
    });

    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "object.measurements", id: "sphere_1" }
    });

    expect(response).toMatchObject({
      ok: true,
      query: "object.measurements",
      measurements: {
        id: "sphere_1",
        kind: "sphere",
        dimensions: { radius: 2 },
        localBounds: {
          min: [-2, -2, -2],
          max: [2, 2, 2],
          size: [4, 4, 4],
          center: [0, 0, 0]
        },
        worldBounds: {
          min: [-1, 0, 1],
          max: [3, 4, 5],
          size: [4, 4, 4],
          center: [1, 2, 3]
        }
      }
    });

    if (response.ok && response.query === "object.measurements") {
      expect(response.measurements.approximateVolume).toBeCloseTo(
        (32 / 3) * Math.PI
      );
    } else {
      throw new Error("Expected object measurements response.");
    }
  });

  it("returns approximate cone and torus measurements", () => {
    const engine = new CadEngine();

    engine.applyBatch([
      {
        op: "scene.createCone",
        id: "cone_1",
        dimensions: { radius: 2, height: 6 },
        transform: { translation: [1, 2, 3] }
      },
      {
        op: "scene.createTorus",
        id: "torus_1",
        dimensions: { majorRadius: 3, minorRadius: 0.75 },
        transform: { translation: [0, 0, 1] }
      }
    ]);

    const cone = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "object.measurements", id: "cone_1" }
    });
    const torus = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "object.measurements", id: "torus_1" }
    });

    expect(cone).toMatchObject({
      ok: true,
      query: "object.measurements",
      measurements: {
        id: "cone_1",
        kind: "cone",
        dimensions: { radius: 2, height: 6 },
        localBounds: {
          min: [-2, -2, -3],
          max: [2, 2, 3],
          size: [4, 4, 6]
        },
        worldBounds: {
          min: [-1, 0, 0],
          max: [3, 4, 6]
        }
      }
    });
    expect(torus).toMatchObject({
      ok: true,
      query: "object.measurements",
      measurements: {
        id: "torus_1",
        kind: "torus",
        dimensions: { majorRadius: 3, minorRadius: 0.75 },
        localBounds: {
          min: [-3.75, -3.75, -0.75],
          max: [3.75, 3.75, 0.75],
          size: [7.5, 7.5, 1.5]
        },
        worldBounds: {
          min: [-3.75, -3.75, 0.25],
          max: [3.75, 3.75, 1.75]
        }
      }
    });

    if (cone.ok && cone.query === "object.measurements") {
      expect(cone.measurements.approximateVolume).toBeCloseTo(8 * Math.PI);
    }
    if (torus.ok && torus.query === "object.measurements") {
      expect(torus.measurements.approximateVolume).toBeCloseTo(
        3.375 * Math.PI * Math.PI
      );
    }
  });

  it("returns project extents from object world bounds", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "left_box",
      dimensions: { width: 2, height: 2, depth: 2 },
      transform: { translation: [-2, 0, 0] }
    });
    engine.apply({
      op: "scene.createCylinder",
      id: "right_cylinder",
      dimensions: { radius: 1, height: 4 },
      transform: { translation: [3, 0, 0] }
    });

    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.extents" }
    });

    expect(response).toMatchObject({
      ok: true,
      query: "project.extents",
      cadOpsVersion: "cadops.v1",
      units: "mm",
      objectCount: 2,
      bounds: {
        min: [-3, -1, -2],
        max: [4, 1, 2],
        size: [7, 2, 4],
        center: [0.5, 0, 0]
      },
      objects: [
        {
          id: "left_box",
          kind: "box",
          worldBounds: {
            min: [-3, -1, -1],
            max: [-1, 1, 1]
          },
          approximateVolume: 8
        },
        {
          id: "right_cylinder",
          kind: "cylinder",
          worldBounds: {
            min: [2, -1, -2],
            max: [4, 1, 2]
          }
        }
      ]
    });

    if (response.ok && response.query === "project.extents") {
      expect(response.approximateVolume).toBeCloseTo(8 + 4 * Math.PI);
      expect(response.objects[1]?.approximateVolume).toBeCloseTo(4 * Math.PI);
    } else {
      throw new Error("Expected project extents response.");
    }
  });

  it("returns empty project extents for an empty document", () => {
    const engine = new CadEngine();

    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.extents" }
    });

    expect(response).toEqual({
      ok: true,
      query: "project.extents",
      cadOpsVersion: "cadops.v1",
      units: "mm",
      objectCount: 0,
      approximateVolume: 0,
      objects: []
    });
  });

  it("returns transaction history with actor, op, and diff summaries", () => {
    const engine = new CadEngine();

    engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      actor: {
        type: "script",
        id: "audit-script",
        name: "Audit Script"
      },
      ops: [
        {
          op: "scene.createBox",
          id: "audit_box",
          dimensions: { width: 1, height: 2, depth: 3 }
        },
        {
          op: "scene.updateTransform",
          id: "audit_box",
          transform: { translation: [1, 0, 0] }
        },
        {
          op: "document.updateUnits",
          units: "in"
        }
      ]
    });

    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "transaction.history" }
    });

    expect(response).toEqual({
      ok: true,
      query: "transaction.history",
      cadOpsVersion: "cadops.v1",
      transactionCount: 1,
      transactions: [
        {
          id: "txn_1",
          status: "committed",
          actor: {
            type: "script",
            id: "audit-script",
            name: "Audit Script"
          },
          opCount: 3,
          ops: [
            {
              op: "scene.createBox",
              label: "Create box audit_box",
              objectId: "audit_box",
              objectKind: "box"
            },
            {
              op: "scene.updateTransform",
              label: "Update transform for audit_box",
              objectId: "audit_box",
              objectKind: "box"
            },
            {
              op: "document.updateUnits",
              label: "Set document units to in (relabel values)"
            }
          ],
          diff: {
            created: [{ id: "audit_box", kind: "box" }],
            modified: [{ id: "audit_box", kind: "box" }],
            deleted: [],
            createdCount: 1,
            modifiedCount: 1,
            deletedCount: 0,
            document: {
              units: {
                before: "mm",
                after: "in",
                mode: "metadataOnly",
                scaleFactor: 1
              }
            }
          }
        }
      ]
    });
  });

  it("reports undo and redo status through transaction history", () => {
    const engine = new CadEngine();

    engine.apply(
      {
        op: "scene.createCylinder",
        id: "undo_audit_cylinder",
        dimensions: { radius: 1, height: 2 }
      },
      {
        actor: {
          type: "human",
          id: "user-1"
        }
      }
    );

    engine.undo();

    const undone = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "transaction.history" }
    });

    expect(undone).toMatchObject({
      ok: true,
      query: "transaction.history",
      transactions: [
        {
          id: "txn_1",
          status: "undone",
          actor: {
            type: "human",
            id: "user-1"
          },
          ops: [
            {
              op: "scene.createCylinder",
              objectId: "undo_audit_cylinder",
              objectKind: "cylinder"
            }
          ]
        }
      ]
    });

    engine.redo();

    const redone = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "transaction.history" }
    });

    expect(redone).toMatchObject({
      ok: true,
      query: "transaction.history",
      transactions: [
        {
          id: "txn_1",
          status: "committed"
        }
      ]
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

  it("returns a structured measurement query error for a missing object", () => {
    const engine = new CadEngine();

    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "object.measurements", id: "missing_object" }
    });

    expect(response).toEqual({
      ok: false,
      query: "object.measurements",
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
      op: "scene.createSphere",
      id: "sphere_1",
      dimensions: { radius: 2 },
      transform: { translation: [0, 4, 2] }
    });
    engine.apply({
      op: "scene.createCone",
      id: "cone_1",
      dimensions: { radius: 1, height: 3 },
      transform: { translation: [5, 0, 1.5] }
    });
    engine.apply({
      op: "scene.createTorus",
      id: "torus_1",
      dimensions: { majorRadius: 2, minorRadius: 0.4 },
      transform: { translation: [7, 0, 0] }
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
      op: "scene.updateSphereDimensions",
      id: "sphere_1",
      dimensions: { radius: 3 }
    });
    engine.apply({
      op: "scene.updateConeDimensions",
      id: "cone_1",
      dimensions: { radius: 2, height: 5 }
    });
    engine.apply({
      op: "scene.updateTorusDimensions",
      id: "torus_1",
      dimensions: { majorRadius: 3, minorRadius: 0.5 }
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
    expect([...restoredObjects.keys()]).toEqual([
      "obj_1",
      "fixture",
      "sphere_1",
      "cone_1",
      "torus_1"
    ]);
    expect(restoredObjects.get("obj_1")).toEqual(
      engine.getDocument().objects.get("obj_1")
    );
    expect(restoredObjects.get("fixture")).toEqual(
      engine.getDocument().objects.get("fixture")
    );
    expect(restoredObjects.get("sphere_1")).toEqual(
      engine.getDocument().objects.get("sphere_1")
    );
    expect(restoredObjects.get("cone_1")).toEqual(
      engine.getDocument().objects.get("cone_1")
    );
    expect(restoredObjects.get("torus_1")).toEqual(
      engine.getDocument().objects.get("torus_1")
    );
    expect(restored.getTransactions()).toEqual(engine.getTransactions());

    restored.undo();

    expect(restored.getDocument().objects.get("fixture")?.name).toBeUndefined();

    restored.undo();

    expect(restored.getDocument().units).toBe("mm");

    restored.undo();

    expect(restored.getDocument().objects.get("torus_1")?.dimensions).toEqual({
      majorRadius: 2,
      minorRadius: 0.4
    });

    restored.undo();

    expect(restored.getDocument().objects.get("cone_1")?.dimensions).toEqual({
      radius: 1,
      height: 3
    });

    restored.undo();

    expect(restored.getDocument().objects.get("sphere_1")?.dimensions).toEqual({
      radius: 2
    });

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

  it("round-trips an empty project", () => {
    const restored = importCadProjectJson(
      exportCadProjectJson(new CadEngine())
    );

    expect(restored.getDocument().units).toBe("mm");
    expect(restored.getDocument().objects.size).toBe(0);
    expect(restored.getTransactions()).toEqual([]);
    expect(restored.getRedoStack()).toEqual([]);
  });

  it("round-trips converted unit values and undo history", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 10, height: 20, depth: 30 },
      transform: { translation: [40, 50, 60] }
    });
    engine.apply({
      op: "document.updateUnits",
      units: "cm",
      mode: "preservePhysicalSize"
    });

    const restored = importCadProjectJson(exportCadProjectJson(engine));
    const restoredBox = restored.getDocument().objects.get("box_1");

    expect(restored.getDocument().units).toBe("cm");
    expect(restoredBox?.kind).toBe("box");

    if (restoredBox?.kind !== "box") {
      throw new Error("Expected restored box object.");
    }

    expect(restoredBox.dimensions).toEqual({
      width: 1,
      height: 2,
      depth: 3
    });
    expect(restoredBox.transform.translation).toEqual([4, 5, 6]);
    expect(restored.getTransactions()[1]?.diff.document?.units).toEqual({
      before: "mm",
      after: "cm",
      mode: "preservePhysicalSize",
      scaleFactor: 0.1
    });

    restored.undo();

    const undoneBox = restored.getDocument().objects.get("box_1");
    expect(restored.getDocument().units).toBe("mm");
    expect(undoneBox?.kind).toBe("box");

    if (undoneBox?.kind !== "box") {
      throw new Error("Expected restored box after undo.");
    }

    expect(undoneBox.dimensions).toEqual({
      width: 10,
      height: 20,
      depth: 30
    });
    expect(undoneBox.transform.translation).toEqual([40, 50, 60]);
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

  it("round-trips redo history with transaction actor metadata", () => {
    const engine = new CadEngine();

    engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      actor: {
        type: "agent",
        id: "redo-agent",
        name: "Redo Agent"
      },
      ops: [
        {
          op: "scene.createBox",
          dimensions: { width: 2, height: 2, depth: 2 }
        }
      ]
    });
    engine.undo();

    const restored = importCadProjectJson(exportCadProjectJson(engine));

    expect(restored.getDocument().objects.size).toBe(0);
    expect(restored.getRedoStack()[0]?.actor).toEqual({
      type: "agent",
      id: "redo-agent",
      name: "Redo Agent"
    });

    restored.redo();

    expect(restored.getTransactions()[0]?.actor).toEqual({
      type: "agent",
      id: "redo-agent",
      name: "Redo Agent"
    });
  });

  it("round-trips transaction actor metadata through project JSON", () => {
    const engine = new CadEngine();

    engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      actor: {
        type: "agent",
        id: "round-trip-agent",
        name: "Round Trip Agent"
      },
      ops: [
        {
          op: "scene.createBox",
          dimensions: { width: 2, height: 3, depth: 4 }
        }
      ]
    });

    const restored = importCadProjectJson(exportCadProjectJson(engine));

    expect(restored.getTransactions()[0]?.actor).toEqual({
      type: "agent",
      id: "round-trip-agent",
      name: "Round Trip Agent"
    });
    expect(restored.undo()?.transaction.actor).toEqual(
      engine.getTransactions()[0]?.actor
    );
  });

  it("stores transaction audit metadata and exposes it through history", () => {
    const engine = new CadEngine();

    const response = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      audit: {
        source: "script",
        requestId: "script_req_1",
        toolName: "fixture-script",
        intent: "commit",
        operationCount: 1
      },
      ops: [
        {
          op: "scene.createBox",
          id: "audited_box",
          dimensions: { width: 1, height: 1, depth: 1 }
        }
      ]
    });

    expect(response).toMatchObject({
      ok: true,
      audit: {
        source: "script",
        requestId: "script_req_1",
        toolName: "fixture-script",
        intent: "commit",
        operationCount: 1
      }
    });

    if (!response.ok) {
      throw new Error("Expected audited commit to succeed.");
    }

    expect(engine.getTransactions()[0]?.audit).toEqual(response.audit);

    const history = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "transaction.history" }
    });

    expect(history).toMatchObject({
      ok: true,
      transactions: [
        {
          id: "txn_1",
          audit: response.audit
        }
      ]
    });
  });

  it("rejects invalid transaction audit metadata from CADOps", () => {
    const engine = new CadEngine();

    const response = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      audit: {
        source: "script",
        requestId: "script_req_1",
        intent: "dryRun",
        operationCount: 1
      },
      ops: [
        {
          op: "scene.createBox",
          id: "audit_error_box",
          dimensions: { width: 1, height: 1, depth: 1 }
        }
      ]
    });

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_AUDIT",
        path: "$.audit.intent",
        expected: "commit",
        received: "dryRun"
      }
    });
    expect(engine.getTransactions()).toEqual([]);
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
                  kind: "spline",
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

  it("rejects invalid sphere dimensions with a structured import error", () => {
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
                  id: "bad_sphere",
                  kind: "sphere",
                  dimensions: { radius: 0 },
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
        path: "$.document.objects[0].dimensions.radius"
      }
    );
  });

  it("rejects invalid torus dimensions with a structured import error", () => {
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
                  id: "bad_torus",
                  kind: "torus",
                  dimensions: { majorRadius: 1, minorRadius: 1 },
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
        path: "$.document.objects[0].dimensions.minorRadius"
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

  it("rejects malformed transaction actor metadata in project JSON", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      dimensions: { width: 1, height: 1, depth: 1 }
    });
    const project = parseCadProjectJson(exportCadProjectJson(engine));

    expectProjectImportError(
      () =>
        parseCadProjectJson(
          JSON.stringify({
            ...project,
            history: [
              {
                ...project.history[0],
                actor: {
                  type: "robot"
                }
              }
            ]
          })
        ),
      {
        code: "INVALID_TRANSACTION",
        path: "$.history[0].actor.type"
      }
    );
  });

  it("rejects transaction stack status mismatches in project JSON", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      dimensions: { width: 1, height: 1, depth: 1 }
    });
    const project = parseCadProjectJson(exportCadProjectJson(engine));

    expectProjectImportError(
      () =>
        parseCadProjectJson(
          JSON.stringify({
            ...project,
            history: [
              {
                ...project.history[0],
                status: "undone"
              }
            ]
          })
        ),
      {
        code: "INVALID_TRANSACTION",
        path: "$.history[0].status"
      }
    );
  });

  it("rejects duplicate transaction IDs across history and redo stacks", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 1, height: 1, depth: 1 }
    });
    engine.apply({
      op: "scene.renameObject",
      id: "box_1",
      name: "Named box"
    });
    engine.undo();

    const project = parseCadProjectJson(exportCadProjectJson(engine));

    expectProjectImportError(
      () =>
        parseCadProjectJson(
          JSON.stringify({
            ...project,
            redoStack: [
              {
                ...project.redoStack[0],
                id: project.history[0]?.id
              }
            ]
          })
        ),
      {
        code: "INVALID_TRANSACTION",
        path: "$.redoStack[0].id"
      }
    );
  });

  it("rejects project documents that do not match committed transaction replay", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 1, height: 1, depth: 1 }
    });

    const project = parseCadProjectJson(exportCadProjectJson(engine));

    expectProjectImportError(
      () =>
        importCadProjectJson(
          JSON.stringify({
            ...project,
            document: {
              ...project.document,
              objects: [
                {
                  ...project.document.objects[0],
                  dimensions: { width: 2, height: 1, depth: 1 }
                }
              ]
            }
          })
        ),
      {
        code: "INVALID_TRANSACTION_HISTORY",
        path: "$.history"
      }
    );
  });

  it("rejects project nextObjectNumber values that would collide", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      dimensions: { width: 1, height: 1, depth: 1 }
    });

    const project = parseCadProjectJson(exportCadProjectJson(engine));

    expectProjectImportError(
      () =>
        parseCadProjectJson(
          JSON.stringify({
            ...project,
            document: {
              ...project.document,
              nextObjectNumber: 1
            }
          })
        ),
      {
        code: "INVALID_DOCUMENT",
        path: "$.document.nextObjectNumber"
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
