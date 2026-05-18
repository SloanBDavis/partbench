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

function createRectangleExtrudeEngine(): CadEngine {
  const engine = new CadEngine();

  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "rect_1",
      center: [0, 0],
      width: 4,
      height: 2
    },
    {
      op: "feature.extrude",
      id: "feat_rect_1",
      bodyId: "body_rect_1",
      sketchId: "sketch_1",
      entityId: "rect_1",
      depth: 3
    }
  ]);

  return engine;
}

function createCircleExtrudeEngine(): CadEngine {
  const engine = new CadEngine();

  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "circle_1",
      center: [0, 0],
      radius: 2
    },
    {
      op: "feature.extrude",
      id: "feat_circle_1",
      bodyId: "body_circle_1",
      sketchId: "sketch_1",
      entityId: "circle_1",
      depth: 4
    }
  ]);

  return engine;
}

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

  it("returns document snapshots instead of live mutable engine state", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 1, height: 1, depth: 1 }
    });

    const documentSnapshot = engine.getDocument();
    (documentSnapshot.objects as Map<string, unknown>).delete("box_1");

    expect(engine.getDocument().objects.has("box_1")).toBe(true);
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

  it("creates sketches and sketch entities with semantic diffs", () => {
    const engine = new CadEngine();

    const result = engine.applyBatch([
      {
        op: "sketch.create",
        id: "sketch_1",
        name: "  Base sketch  ",
        plane: "XY"
      },
      {
        op: "sketch.addPoint",
        sketchId: "sketch_1",
        id: "point_1",
        point: [0, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "line_1",
        start: [0, 0],
        end: [2, 2]
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        id: "rect_1",
        center: [1, 1],
        width: 4,
        height: 2
      },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_1",
        id: "circle_1",
        center: [3, 3],
        radius: 1
      }
    ]);

    const sketch = result.document.sketches.get("sketch_1");

    expect(sketch).toBeDefined();
    expect(sketch?.name).toBe("Base sketch");
    expect(sketch?.plane).toBe("XY");
    expect([...(sketch?.entities.keys() ?? [])]).toEqual([
      "point_1",
      "line_1",
      "rect_1",
      "circle_1"
    ]);
    expect(result.transaction.diff.sketches).toEqual({
      created: [{ id: "sketch_1" }],
      modified: [],
      deleted: [],
      entitiesCreated: [
        { sketchId: "sketch_1", id: "point_1", kind: "point" },
        { sketchId: "sketch_1", id: "line_1", kind: "line" },
        { sketchId: "sketch_1", id: "rect_1", kind: "rectangle" },
        { sketchId: "sketch_1", id: "circle_1", kind: "circle" }
      ],
      entitiesModified: [],
      entitiesDeleted: []
    });
  });

  it("updates, renames, and deletes sketch source data with undo and redo", () => {
    const engine = new CadEngine();

    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XZ" },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_1",
        id: "circle_1",
        center: [0, 0],
        radius: 1
      }
    ]);

    const result = engine.applyBatch([
      {
        op: "sketch.updateEntity",
        sketchId: "sketch_1",
        entity: {
          id: "circle_1",
          kind: "circle",
          center: [2, 3],
          radius: 4
        }
      },
      { op: "sketch.rename", id: "sketch_1", name: "Updated profile" },
      {
        op: "sketch.deleteEntity",
        sketchId: "sketch_1",
        entityId: "circle_1"
      }
    ]);

    expect(result.document.sketches.get("sketch_1")?.name).toBe(
      "Updated profile"
    );
    expect(
      result.document.sketches.get("sketch_1")?.entities.has("circle_1")
    ).toBe(false);
    expect(result.transaction.diff.sketches).toMatchObject({
      modified: [{ id: "sketch_1" }],
      entitiesModified: [
        { sketchId: "sketch_1", id: "circle_1", kind: "circle" }
      ],
      entitiesDeleted: [
        { sketchId: "sketch_1", id: "circle_1", kind: "circle" }
      ]
    });

    engine.undo();
    expect(engine.getDocument().sketches.get("sketch_1")?.name).toBe("Profile");
    expect(
      engine.getDocument().sketches.get("sketch_1")?.entities.has("circle_1")
    ).toBe(true);

    engine.redo();
    expect(
      engine.getDocument().sketches.get("sketch_1")?.entities.has("circle_1")
    ).toBe(false);
  });

  it("validates sketch commands without mutating the document", () => {
    const engine = new CadEngine();

    const response = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "sketch.addRectangle",
          sketchId: "missing_sketch",
          center: [0, 0],
          width: 0,
          height: 1
        }
      ]
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error).toMatchObject({
        code: "SKETCH_NOT_FOUND",
        op: "sketch.addRectangle",
        sketchId: "missing_sketch"
      });
    }
    expect(engine.getDocument().sketches.size).toBe(0);
  });

  it("supports sketch commands in batch dry-run and commit responses", () => {
    const engine = new CadEngine();
    const batch = {
      version: "cadops.v1" as const,
      mode: "dryRun" as const,
      ops: [
        {
          op: "sketch.create" as const,
          name: "Generated sketch",
          plane: "XY" as const
        },
        {
          op: "sketch.addPoint" as const,
          sketchId: "sketch_1",
          point: [1, 2] as const
        }
      ]
    };

    const dryRun = engine.executeBatch(batch);

    expect(dryRun).toMatchObject({
      ok: true,
      mode: "dryRun",
      createdSketchIds: ["sketch_1"],
      createdSketchEntityIds: ["skent_1"]
    });
    expect(engine.getDocument().sketches.size).toBe(0);

    const commit = engine.executeBatch({ ...batch, mode: "commit" });

    expect(commit).toMatchObject({
      ok: true,
      mode: "commit",
      createdSketchIds: ["sketch_1"],
      createdSketchEntityIds: ["skent_1"],
      transactionId: "txn_1"
    });
    expect(engine.getDocument().sketches.get("sketch_1")?.entities.size).toBe(
      1
    );
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
          bodyIds: ["body:structure_box", "body:structure_sphere"],
          sketchIds: []
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
          name: undefined,
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
          name: undefined,
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

  it("returns sketch lists and one sketch through read queries", () => {
    const engine = new CadEngine();

    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Plan", plane: "YZ" },
      {
        op: "sketch.addPoint",
        sketchId: "sketch_1",
        id: "point_1",
        point: [4, 5]
      }
    ]);

    const sketchesResponse = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.sketches" }
    });
    const sketchResponse = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "sketch.get", id: "sketch_1" }
    });
    const missingResponse = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "sketch.get", id: "missing_sketch" }
    });
    const structureResponse = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });

    expect(sketchesResponse).toEqual({
      ok: true,
      query: "project.sketches",
      cadOpsVersion: "cadops.v1",
      sketchCount: 1,
      sketches: [
        {
          id: "sketch_1",
          name: "Plan",
          plane: "YZ",
          entities: [{ id: "point_1", kind: "point", point: [4, 5] }]
        }
      ]
    });
    expect(sketchResponse).toEqual({
      ok: true,
      query: "sketch.get",
      cadOpsVersion: "cadops.v1",
      sketch: {
        id: "sketch_1",
        name: "Plan",
        plane: "YZ",
        entities: [{ id: "point_1", kind: "point", point: [4, 5] }]
      }
    });
    expect(missingResponse).toEqual({
      ok: false,
      query: "sketch.get",
      cadOpsVersion: "cadops.v1",
      error: {
        code: "SKETCH_NOT_FOUND",
        message: "Sketch does not exist: missing_sketch",
        sketchId: "missing_sketch"
      }
    });
    expect(structureResponse.ok).toBe(true);
    if (
      structureResponse.ok &&
      structureResponse.query === "project.structure"
    ) {
      expect(structureResponse.parts[0]?.sketchIds).toEqual(["sketch_1"]);
    }
  });

  it("creates sketch extrude features and bodies through CADOps", () => {
    const engine = new CadEngine();

    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        id: "rect_1",
        center: [1, 2],
        width: 4,
        height: 3
      }
    ]);

    const result = engine.apply({
      op: "feature.extrude",
      id: "feat_rect_1",
      bodyId: "body_rect_1",
      name: "Base pad",
      sketchId: "sketch_1",
      entityId: "rect_1",
      depth: 5
    });
    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });

    expect(result.transaction.diff.features).toMatchObject({
      created: [
        {
          id: "feat_rect_1",
          kind: "extrude",
          bodyId: "body_rect_1",
          sketchId: "sketch_1",
          entityId: "rect_1",
          profileKind: "rectangle",
          depth: 5,
          side: "positive"
        }
      ],
      bodiesCreated: [
        { id: "body_rect_1", kind: "solid", featureId: "feat_rect_1" }
      ]
    });
    expect(structure).toMatchObject({
      ok: true,
      query: "project.structure",
      featureCount: 1,
      bodyCount: 1,
      features: [
        {
          id: "feat_rect_1",
          kind: "extrude",
          bodyId: "body_rect_1",
          sketchId: "sketch_1",
          entityId: "rect_1",
          profileKind: "rectangle",
          depth: 5,
          side: "positive"
        }
      ],
      bodies: [
        {
          id: "body_rect_1",
          kind: "solid",
          featureId: "feat_rect_1",
          source: {
            type: "sketchExtrudeFeature",
            featureId: "feat_rect_1",
            sketchId: "sketch_1",
            entityId: "rect_1",
            profileKind: "rectangle"
          }
        }
      ]
    });

    engine.undo();
    expect(engine.getDocument().features.size).toBe(0);

    engine.redo();
    expect(engine.getDocument().features.get("feat_rect_1")?.bodyId).toBe(
      "body_rect_1"
    );
  });

  it("creates explicit negative and symmetric extrude sides", () => {
    const engine = new CadEngine();

    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        id: "rect_1",
        center: [0, 0],
        width: 4,
        height: 2
      },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_1",
        id: "circle_1",
        center: [0, 0],
        radius: 2
      },
      {
        op: "feature.extrude",
        id: "feat_negative",
        bodyId: "body_negative",
        sketchId: "sketch_1",
        entityId: "rect_1",
        depth: 3,
        side: "negative"
      },
      {
        op: "feature.extrude",
        id: "feat_symmetric",
        bodyId: "body_symmetric",
        sketchId: "sketch_1",
        entityId: "circle_1",
        depth: 5,
        side: "symmetric"
      }
    ]);

    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });

    expect(structure).toMatchObject({
      ok: true,
      features: [
        { id: "feat_negative", side: "negative" },
        { id: "feat_symmetric", side: "symmetric" }
      ]
    });
  });

  it("returns semantic generated references for rectangle extrude bodies", () => {
    const engine = createRectangleExtrudeEngine();

    const references = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.generatedReferences", bodyId: "body_rect_1" }
    });

    expect(references).toMatchObject({
      ok: true,
      query: "body.generatedReferences",
      body: {
        kind: "body",
        stableId: "generated:body:body_rect_1",
        label: "Rectangle extrude body",
        description:
          "Solid body generated by rectangle extrude feature feat_rect_1.",
        eligibleOperations: [
          "feature.measureReference",
          "feature.selectReference"
        ],
        bodyId: "body_rect_1",
        sourceFeatureId: "feat_rect_1",
        sourceSketchId: "sketch_1",
        sourceSketchEntityId: "rect_1",
        profileKind: "rectangle",
        geometricSignature: {
          profileKind: "rectangle",
          sketchPlane: "XY",
          extrudeSide: "positive",
          depth: 3,
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 2
          },
          axis: [0, 0, 1],
          axisRole: "sketchPlaneNormal"
        }
      },
      faceCount: 6,
      edgeCount: 12,
      vertexCount: 8
    });

    if (!references.ok || references.query !== "body.generatedReferences") {
      throw new Error("Expected generated references response.");
    }

    expect(references.faces.map((face) => face.role)).toEqual([
      "startCap",
      "endCap",
      "side:uMin",
      "side:uMax",
      "side:vMin",
      "side:vMax"
    ]);
    expect(references.faces[0]).toMatchObject({
      stableId: "generated:face:body_rect_1:startCap",
      label: "Start cap",
      description: "Cap face at the start of the extrude.",
      eligibleOperations: [
        "feature.attachSketchPlane",
        "feature.measureReference",
        "feature.selectReference"
      ],
      geometricSignature: {
        surfaceType: "plane",
        normal: [0, 0, -1],
        normalRole: "startCapOutward"
      }
    });
    expect(references.faces[2]).toMatchObject({
      stableId: "generated:face:body_rect_1:side:uMin",
      label: "uMin side face",
      description: "Side face generated from the rectangle uMin profile edge.",
      eligibleOperations: [
        "feature.attachSketchPlane",
        "feature.measureReference",
        "feature.selectReference"
      ],
      geometricSignature: {
        normal: [-1, 0, 0],
        normalRole: "side:uMin"
      }
    });
    expect(references.edges.map((edge) => edge.role)).toEqual([
      "start:uMin",
      "start:uMax",
      "start:vMin",
      "start:vMax",
      "end:uMin",
      "end:uMax",
      "end:vMin",
      "end:vMax",
      "longitudinal:uMin:vMin",
      "longitudinal:uMin:vMax",
      "longitudinal:uMax:vMin",
      "longitudinal:uMax:vMax"
    ]);
    expect(references.edges[0]).toMatchObject({
      stableId: "generated:edge:body_rect_1:start:uMin",
      label: "Start uMin edge",
      description:
        "Start cap edge generated from the rectangle uMin profile edge.",
      eligibleOperations: [
        "feature.measureReference",
        "feature.selectReference"
      ],
      adjacentFaceRoles: ["startCap", "side:uMin"],
      geometricSignature: {
        curveType: "line",
        axis: [0, 1, 0],
        axisRole: "profileVAxis"
      }
    });
    expect(references.edges[8]).toMatchObject({
      stableId: "generated:edge:body_rect_1:longitudinal:uMin:vMin",
      label: "uMin/vMin longitudinal edge",
      description: "Longitudinal edge joining the uMin/vMin rectangle corners.",
      eligibleOperations: [
        "feature.measureReference",
        "feature.selectReference"
      ],
      adjacentFaceRoles: ["side:uMin", "side:vMin"],
      geometricSignature: {
        curveType: "line",
        axis: [0, 0, 1],
        axisRole: "sketchPlaneNormal"
      }
    });
    expect(references.vertices.map((vertex) => vertex.role)).toEqual([
      "start:uMin:vMin",
      "start:uMin:vMax",
      "start:uMax:vMin",
      "start:uMax:vMax",
      "end:uMin:vMin",
      "end:uMin:vMax",
      "end:uMax:vMin",
      "end:uMax:vMax"
    ]);
    expect(references.vertices[0]).toMatchObject({
      stableId: "generated:vertex:body_rect_1:start:uMin:vMin",
      label: "Start uMin/vMin corner",
      description:
        "Corner vertex where the start cap, uMin side face, and vMin side face meet.",
      eligibleOperations: [
        "feature.measureReference",
        "feature.selectReference"
      ],
      adjacentFaceRoles: ["startCap", "side:uMin", "side:vMin"],
      adjacentEdgeRoles: ["start:uMin", "start:vMin", "longitudinal:uMin:vMin"],
      geometricSignature: {
        axis: [0, 0, 1],
        axisRole: "sketchPlaneNormal",
        profilePoint: [-2, -1],
        positionRole: "start"
      }
    });
    expect(references.vertices[7]).toMatchObject({
      stableId: "generated:vertex:body_rect_1:end:uMax:vMax",
      label: "End uMax/vMax corner",
      description:
        "Corner vertex where the end cap, uMax side face, and vMax side face meet.",
      eligibleOperations: [
        "feature.measureReference",
        "feature.selectReference"
      ],
      adjacentFaceRoles: ["endCap", "side:uMax", "side:vMax"],
      adjacentEdgeRoles: ["end:uMax", "end:vMax", "longitudinal:uMax:vMax"],
      geometricSignature: {
        profilePoint: [2, 1],
        positionRole: "end"
      }
    });
  });

  it("resolves generated body face edge and vertex references", () => {
    const engine = createRectangleExtrudeEngine();

    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.resolveGeneratedReference",
          bodyId: "body_rect_1",
          stableId: "generated:body:body_rect_1"
        }
      })
    ).toMatchObject({
      ok: true,
      query: "body.resolveGeneratedReference",
      bodyId: "body_rect_1",
      stableId: "generated:body:body_rect_1",
      kind: "body",
      reference: {
        kind: "body",
        stableId: "generated:body:body_rect_1",
        label: "Rectangle extrude body",
        eligibleOperations: [
          "feature.measureReference",
          "feature.selectReference"
        ],
        sourceFeatureId: "feat_rect_1"
      }
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.resolveGeneratedReference",
          bodyId: "body_rect_1",
          stableId: "generated:face:body_rect_1:side:uMin"
        }
      })
    ).toMatchObject({
      ok: true,
      kind: "face",
      reference: {
        kind: "face",
        label: "uMin side face",
        eligibleOperations: [
          "feature.attachSketchPlane",
          "feature.measureReference",
          "feature.selectReference"
        ],
        role: "side:uMin",
        geometricSignature: {
          normalRole: "side:uMin"
        }
      }
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.resolveGeneratedReference",
          bodyId: "body_rect_1",
          stableId: "generated:edge:body_rect_1:longitudinal:uMin:vMin"
        }
      })
    ).toMatchObject({
      ok: true,
      kind: "edge",
      reference: {
        kind: "edge",
        label: "uMin/vMin longitudinal edge",
        eligibleOperations: [
          "feature.measureReference",
          "feature.selectReference"
        ],
        role: "longitudinal:uMin:vMin",
        adjacentFaceRoles: ["side:uMin", "side:vMin"]
      }
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.resolveGeneratedReference",
          bodyId: "body_rect_1",
          stableId: "generated:vertex:body_rect_1:start:uMin:vMin"
        }
      })
    ).toMatchObject({
      ok: true,
      kind: "vertex",
      reference: {
        kind: "vertex",
        label: "Start uMin/vMin corner",
        eligibleOperations: [
          "feature.measureReference",
          "feature.selectReference"
        ],
        role: "start:uMin:vMin",
        adjacentFaceRoles: ["startCap", "side:uMin", "side:vMin"],
        adjacentEdgeRoles: [
          "start:uMin",
          "start:vMin",
          "longitudinal:uMin:vMin"
        ]
      }
    });
  });

  it("returns semantic generated references for circle extrude bodies", () => {
    const engine = createCircleExtrudeEngine();

    const references = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.generatedReferences", bodyId: "body_circle_1" }
    });

    expect(references).toMatchObject({
      ok: true,
      query: "body.generatedReferences",
      body: {
        stableId: "generated:body:body_circle_1",
        label: "Circle extrude body",
        bodyId: "body_circle_1",
        sourceFeatureId: "feat_circle_1",
        profileKind: "circle",
        geometricSignature: {
          profileKind: "circle",
          depth: 4,
          profile: {
            kind: "circle",
            center: [0, 0],
            radius: 2
          }
        }
      },
      faceCount: 3,
      edgeCount: 2,
      vertexCount: 0,
      faces: [
        { role: "startCap", label: "Start cap" },
        { role: "endCap", label: "End cap" },
        {
          role: "side:circular",
          label: "Circular side face",
          description:
            "Cylindrical side face generated from the circle profile.",
          eligibleOperations: [
            "feature.measureReference",
            "feature.selectReference"
          ],
          eligibilityNotes: [
            "Circular side faces are not planar and are not eligible for sketch-plane attachment.",
            "Generated references are semantic first-slice references, not exact B-rep topology."
          ],
          geometricSignature: {
            surfaceType: "cylinder",
            axis: [0, 0, 1],
            axisRole: "sketchPlaneNormal"
          }
        }
      ],
      edges: [
        {
          role: "start:circular",
          label: "Start circular edge",
          description: "Circular profile edge on the start cap.",
          eligibleOperations: [
            "feature.measureReference",
            "feature.selectReference"
          ],
          adjacentFaceRoles: ["startCap", "side:circular"],
          geometricSignature: {
            curveType: "circle",
            axis: [0, 0, 1],
            axisRole: "sketchPlaneNormal"
          }
        },
        {
          role: "end:circular",
          label: "End circular edge",
          eligibleOperations: [
            "feature.measureReference",
            "feature.selectReference"
          ],
          adjacentFaceRoles: ["endCap", "side:circular"]
        }
      ],
      vertices: []
    });
  });

  it("reports stale or unsupported generated reference resolution", () => {
    const rectangleEngine = createRectangleExtrudeEngine();

    expect(
      rectangleEngine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.resolveGeneratedReference",
          bodyId: "body_rect_1",
          stableId: "generated:face:body_rect_1:oldRole"
        }
      })
    ).toMatchObject({
      ok: false,
      query: "body.resolveGeneratedReference",
      error: {
        code: "GENERATED_REFERENCE_NOT_FOUND",
        bodyId: "body_rect_1",
        stableId: "generated:face:body_rect_1:oldRole"
      }
    });

    const circleEngine = createCircleExtrudeEngine();

    expect(
      circleEngine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.resolveGeneratedReference",
          bodyId: "body_circle_1",
          stableId: "generated:vertex:body_circle_1:start:uMin:vMin"
        }
      })
    ).toMatchObject({
      ok: false,
      query: "body.resolveGeneratedReference",
      error: {
        code: "GENERATED_REFERENCE_NOT_FOUND",
        bodyId: "body_circle_1",
        stableId: "generated:vertex:body_circle_1:start:uMin:vMin"
      }
    });

    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 1, height: 1, depth: 1 }
    });

    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.resolveGeneratedReference",
          bodyId: "missing_body",
          stableId: "generated:body:missing_body"
        }
      })
    ).toMatchObject({
      ok: false,
      query: "body.resolveGeneratedReference",
      error: {
        code: "BODY_NOT_FOUND",
        bodyId: "missing_body"
      }
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.resolveGeneratedReference",
          bodyId: "body:box_1",
          stableId: "generated:body:body:box_1"
        }
      })
    ).toMatchObject({
      ok: false,
      query: "body.resolveGeneratedReference",
      error: {
        code: "UNSUPPORTED_BODY_REFERENCES",
        bodyId: "body:box_1"
      }
    });
  });

  it("updates generated reference signatures after extrude and source profile edits", () => {
    const engine = createRectangleExtrudeEngine();

    engine.apply({
      op: "feature.updateExtrude",
      id: "feat_rect_1",
      depth: 8,
      side: "negative"
    });
    engine.apply({
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: {
        id: "rect_1",
        kind: "rectangle",
        center: [1, 1],
        width: 6,
        height: 4
      }
    });

    const updated = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.generatedReferences", bodyId: "body_rect_1" }
    });

    expect(updated).toMatchObject({
      ok: true,
      body: {
        geometricSignature: {
          depth: 8,
          extrudeSide: "negative",
          profile: {
            kind: "rectangle",
            center: [1, 1],
            width: 6,
            height: 4
          }
        }
      }
    });

    if (!updated.ok || updated.query !== "body.generatedReferences") {
      throw new Error("Expected generated references response.");
    }

    expect(
      updated.faces.find((face) => face.role === "startCap")?.geometricSignature
        .normal
    ).toEqual([0, 0, 1]);
    expect(
      updated.faces.find((face) => face.role === "endCap")?.geometricSignature
        .normal
    ).toEqual([0, 0, -1]);
    expect(
      updated.edges.find((edge) => edge.role === "start:uMin")
        ?.geometricSignature.profile
    ).toEqual({
      kind: "rectangle",
      center: [1, 1],
      width: 6,
      height: 4
    });
    expect(
      updated.edges.find((edge) => edge.role === "longitudinal:uMin:vMin")
        ?.geometricSignature.depth
    ).toBe(8);
    expect(
      updated.vertices.find((vertex) => vertex.role === "start:uMin:vMin")
        ?.geometricSignature.profilePoint
    ).toEqual([-2, -1]);
    expect(
      updated.vertices.find((vertex) => vertex.role === "end:uMax:vMax")
        ?.geometricSignature.profilePoint
    ).toEqual([4, 3]);
    expect(
      updated.vertices.find((vertex) => vertex.role === "end:uMax:vMax")
        ?.geometricSignature.depth
    ).toBe(8);
    expect(
      updated.vertices.find((vertex) => vertex.role === "end:uMax:vMax")
        ?.geometricSignature.extrudeSide
    ).toBe("negative");
    expect(
      updated.vertices.find((vertex) => vertex.role === "end:uMax:vMax")
        ?.geometricSignature.positionRole
    ).toBe("end");
    expect(
      updated.faces.find((face) => face.role === "side:uMin")
        ?.eligibleOperations
    ).toEqual([
      "feature.attachSketchPlane",
      "feature.measureReference",
      "feature.selectReference"
    ]);
    expect(
      updated.vertices.find((vertex) => vertex.role === "end:uMax:vMax")
        ?.eligibleOperations
    ).toEqual(["feature.measureReference", "feature.selectReference"]);

    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.resolveGeneratedReference",
          bodyId: "body_rect_1",
          stableId: "generated:vertex:body_rect_1:end:uMax:vMax"
        }
      })
    ).toMatchObject({
      ok: true,
      kind: "vertex",
      reference: {
        stableId: "generated:vertex:body_rect_1:end:uMax:vMax",
        label: "End uMax/vMax corner",
        eligibleOperations: [
          "feature.measureReference",
          "feature.selectReference"
        ],
        geometricSignature: {
          depth: 8,
          extrudeSide: "negative",
          profilePoint: [4, 3]
        }
      }
    });

    engine.undo();
    const afterUndoProfile = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.generatedReferences", bodyId: "body_rect_1" }
    });
    expect(afterUndoProfile).toMatchObject({
      ok: true,
      body: {
        geometricSignature: {
          depth: 8,
          profile: { kind: "rectangle", width: 4, height: 2 }
        }
      }
    });

    engine.undo();
    const afterUndoExtrude = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.generatedReferences", bodyId: "body_rect_1" }
    });
    expect(afterUndoExtrude).toMatchObject({
      ok: true,
      body: {
        geometricSignature: {
          depth: 3,
          extrudeSide: "positive"
        }
      }
    });
  });

  it("reports missing and unsupported generated body references", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 1, height: 1, depth: 1 }
    });

    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "body.generatedReferences", bodyId: "missing_body" }
      })
    ).toMatchObject({
      ok: false,
      query: "body.generatedReferences",
      error: {
        code: "BODY_NOT_FOUND",
        bodyId: "missing_body"
      }
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "body.generatedReferences", bodyId: "body:box_1" }
      })
    ).toMatchObject({
      ok: false,
      query: "body.generatedReferences",
      error: {
        code: "UNSUPPORTED_BODY_REFERENCES",
        bodyId: "body:box_1"
      }
    });
  });

  it("round-trips generated references and updates them across feature delete undo redo", () => {
    const engine = createRectangleExtrudeEngine();
    const restored = importCadProjectJson(exportCadProjectJson(engine));

    const restoredReferences = restored.executeQuery({
      version: "cadops.v1",
      query: { query: "body.generatedReferences", bodyId: "body_rect_1" }
    });

    expect(restoredReferences).toMatchObject({
      ok: true,
      faceCount: 6,
      edgeCount: 12,
      vertexCount: 8
    });
    if (
      !restoredReferences.ok ||
      restoredReferences.query !== "body.generatedReferences"
    ) {
      throw new Error("Expected generated references response.");
    }
    expect(restoredReferences.vertices[0]).toMatchObject({
      role: "start:uMin:vMin",
      label: "Start uMin/vMin corner",
      eligibleOperations: [
        "feature.measureReference",
        "feature.selectReference"
      ],
      adjacentFaceRoles: ["startCap", "side:uMin", "side:vMin"],
      adjacentEdgeRoles: ["start:uMin", "start:vMin", "longitudinal:uMin:vMin"]
    });

    expect(
      restored.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.resolveGeneratedReference",
          bodyId: "body_rect_1",
          stableId: "generated:edge:body_rect_1:start:uMin"
        }
      })
    ).toMatchObject({
      ok: true,
      kind: "edge",
      reference: {
        role: "start:uMin",
        label: "Start uMin edge",
        eligibleOperations: [
          "feature.measureReference",
          "feature.selectReference"
        ]
      }
    });

    restored.apply({ op: "feature.delete", id: "feat_rect_1" });
    expect(
      restored.executeQuery({
        version: "cadops.v1",
        query: { query: "body.generatedReferences", bodyId: "body_rect_1" }
      })
    ).toMatchObject({
      ok: false,
      error: { code: "BODY_NOT_FOUND" }
    });

    restored.undo();
    expect(
      restored.executeQuery({
        version: "cadops.v1",
        query: { query: "body.generatedReferences", bodyId: "body_rect_1" }
      })
    ).toMatchObject({
      ok: true,
      body: { sourceFeatureId: "feat_rect_1" },
      vertexCount: 8
    });
    expect(
      restored.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.resolveGeneratedReference",
          bodyId: "body_rect_1",
          stableId: "generated:edge:body_rect_1:start:uMin"
        }
      })
    ).toMatchObject({
      ok: true,
      kind: "edge",
      reference: {
        role: "start:uMin",
        label: "Start uMin edge",
        eligibleOperations: [
          "feature.measureReference",
          "feature.selectReference"
        ]
      }
    });

    restored.redo();
    expect(
      restored.executeQuery({
        version: "cadops.v1",
        query: { query: "body.generatedReferences", bodyId: "body_rect_1" }
      })
    ).toMatchObject({
      ok: false,
      error: { code: "BODY_NOT_FOUND" }
    });
  });

  it("validates sketch extrude source entities and batch responses", () => {
    const engine = new CadEngine();

    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_1",
        id: "circle_1",
        center: [0, 0],
        radius: 2
      },
      {
        op: "sketch.addPoint",
        sketchId: "sketch_1",
        id: "point_1",
        point: [0, 0]
      }
    ]);

    const invalid = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [
        {
          op: "feature.extrude",
          sketchId: "sketch_1",
          entityId: "point_1",
          depth: 1
        }
      ]
    });
    const dryRun = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [
        {
          op: "feature.extrude",
          id: "feat_circle_1",
          bodyId: "body_circle_1",
          sketchId: "sketch_1",
          entityId: "circle_1",
          depth: 3
        }
      ]
    });

    expect(invalid).toMatchObject({
      ok: false,
      error: {
        code: "UNSUPPORTED_SKETCH_PROFILE",
        sketchId: "sketch_1",
        sketchEntityId: "point_1"
      }
    });
    expect(dryRun).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_circle_1"],
      createdBodyIds: ["body_circle_1"]
    });
    expect(engine.getDocument().features.size).toBe(0);
  });

  it("deletes authored extrude features and removes their bodies from structure", () => {
    const engine = new CadEngine();

    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        id: "rect_1",
        center: [0, 0],
        width: 4,
        height: 2
      },
      {
        op: "feature.extrude",
        id: "feat_rect_1",
        bodyId: "body_rect_1",
        sketchId: "sketch_1",
        entityId: "rect_1",
        depth: 3
      }
    ]);

    const result = engine.apply({
      op: "feature.delete",
      id: "feat_rect_1"
    });
    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });

    expect(engine.getDocument().features.size).toBe(0);
    expect(result.transaction.diff.features).toMatchObject({
      deleted: [
        {
          id: "feat_rect_1",
          kind: "extrude",
          bodyId: "body_rect_1",
          sketchId: "sketch_1",
          entityId: "rect_1",
          profileKind: "rectangle"
        }
      ],
      bodiesDeleted: [
        {
          id: "body_rect_1",
          kind: "solid",
          featureId: "feat_rect_1"
        }
      ]
    });
    expect(structure).toMatchObject({
      ok: true,
      query: "project.structure",
      featureCount: 0,
      bodyCount: 0,
      features: [],
      bodies: []
    });
  });

  it("validates missing and primitive-derived feature deletes", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 1, height: 1, depth: 1 }
    });

    const missing = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [{ op: "feature.delete", id: "missing_feature" }]
    });
    const primitive = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [{ op: "feature.delete", id: "feature:box_1" }]
    });
    const empty = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [{ op: "feature.delete", id: "" }]
    });

    expect(missing).toMatchObject({
      ok: false,
      error: {
        code: "FEATURE_NOT_FOUND",
        featureId: "missing_feature"
      }
    });
    expect(primitive).toMatchObject({
      ok: false,
      error: {
        code: "FEATURE_NOT_DELETABLE",
        featureId: "feature:box_1"
      }
    });
    expect(empty).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_FEATURE",
        path: "$.ops[0].id"
      }
    });
  });

  it("undoes and redoes feature deletes", () => {
    const engine = new CadEngine();

    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_1",
        id: "circle_1",
        center: [0, 0],
        radius: 2
      },
      {
        op: "feature.extrude",
        id: "feat_circle_1",
        bodyId: "body_circle_1",
        sketchId: "sketch_1",
        entityId: "circle_1",
        depth: 4
      }
    ]);

    engine.apply({ op: "feature.delete", id: "feat_circle_1" });
    expect(engine.getDocument().features.has("feat_circle_1")).toBe(false);

    engine.undo();
    expect(engine.getDocument().features.get("feat_circle_1")).toMatchObject({
      id: "feat_circle_1",
      bodyId: "body_circle_1"
    });

    engine.redo();
    expect(engine.getDocument().features.has("feat_circle_1")).toBe(false);
  });

  it("supports feature delete through batch dry-run and commit", () => {
    const engine = new CadEngine();

    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        id: "rect_1",
        center: [0, 0],
        width: 4,
        height: 2
      },
      {
        op: "feature.extrude",
        id: "feat_rect_1",
        bodyId: "body_rect_1",
        sketchId: "sketch_1",
        entityId: "rect_1",
        depth: 3
      }
    ]);

    const dryRun = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [{ op: "feature.delete", id: "feat_rect_1" }]
    });

    expect(dryRun).toMatchObject({
      ok: true,
      deletedFeatureIds: ["feat_rect_1"],
      deletedBodyIds: ["body_rect_1"]
    });
    expect(engine.getDocument().features.has("feat_rect_1")).toBe(true);

    const commit = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [{ op: "feature.delete", id: "feat_rect_1" }]
    });

    expect(commit).toMatchObject({
      ok: true,
      deletedFeatureIds: ["feat_rect_1"],
      deletedBodyIds: ["body_rect_1"],
      transactionId: "txn_2"
    });
    expect(engine.getDocument().features.has("feat_rect_1")).toBe(false);
  });

  it("updates authored extrude depth and side and marks feature bodies modified", () => {
    const engine = createRectangleExtrudeEngine();

    const result = engine.apply({
      op: "feature.updateExtrude",
      id: "feat_rect_1",
      depth: 8,
      side: "negative"
    });
    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });

    expect(engine.getDocument().features.get("feat_rect_1")?.depth).toBe(8);
    expect(engine.getDocument().features.get("feat_rect_1")?.side).toBe(
      "negative"
    );
    expect(result.transaction.diff.features).toMatchObject({
      modified: [
        {
          id: "feat_rect_1",
          kind: "extrude",
          bodyId: "body_rect_1",
          sketchId: "sketch_1",
          entityId: "rect_1",
          profileKind: "rectangle",
          depth: 8,
          side: "negative"
        }
      ],
      bodiesModified: [
        { id: "body_rect_1", kind: "solid", featureId: "feat_rect_1" }
      ]
    });
    expect(structure).toMatchObject({
      ok: true,
      query: "project.structure",
      features: [{ id: "feat_rect_1", depth: 8, side: "negative" }],
      bodies: [{ id: "body_rect_1", featureId: "feat_rect_1" }]
    });
  });

  it("validates missing, primitive-derived, and invalid extrude updates", () => {
    const engine = createRectangleExtrudeEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 1, height: 1, depth: 1 }
    });

    const missing = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [{ op: "feature.updateExtrude", id: "missing_feature", depth: 4 }]
    });
    const primitive = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [{ op: "feature.updateExtrude", id: "feature:box_1", depth: 4 }]
    });
    const invalidDepth = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [{ op: "feature.updateExtrude", id: "feat_rect_1", depth: 0 }]
    });
    const invalidSide = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [
        {
          op: "feature.updateExtrude",
          id: "feat_rect_1",
          side: "both" as never
        }
      ]
    });
    const noEditableFields = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [{ op: "feature.updateExtrude", id: "feat_rect_1" }]
    });

    expect(missing).toMatchObject({
      ok: false,
      error: {
        code: "FEATURE_NOT_FOUND",
        featureId: "missing_feature"
      }
    });
    expect(primitive).toMatchObject({
      ok: false,
      error: {
        code: "FEATURE_NOT_EDITABLE",
        featureId: "feature:box_1"
      }
    });
    expect(invalidDepth).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_FEATURE",
        path: "$.ops[0].depth"
      }
    });
    expect(invalidSide).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_FEATURE",
        path: "$.ops[0].side"
      }
    });
    expect(noEditableFields).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_FEATURE",
        path: "$.ops[0]"
      }
    });
  });

  it("undoes and redoes extrude depth and side updates", () => {
    const engine = createRectangleExtrudeEngine();

    engine.apply({
      op: "feature.updateExtrude",
      id: "feat_rect_1",
      depth: 8,
      side: "symmetric"
    });
    expect(engine.getDocument().features.get("feat_rect_1")?.depth).toBe(8);
    expect(engine.getDocument().features.get("feat_rect_1")?.side).toBe(
      "symmetric"
    );

    engine.undo();
    expect(engine.getDocument().features.get("feat_rect_1")?.depth).toBe(3);
    expect(engine.getDocument().features.get("feat_rect_1")?.side).toBe(
      "positive"
    );

    engine.redo();
    expect(engine.getDocument().features.get("feat_rect_1")?.depth).toBe(8);
    expect(engine.getDocument().features.get("feat_rect_1")?.side).toBe(
      "symmetric"
    );
  });

  it("supports extrude depth and side updates through batch dry-run and commit", () => {
    const engine = createRectangleExtrudeEngine();

    const dryRun = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [
        {
          op: "feature.updateExtrude",
          id: "feat_rect_1",
          depth: 8,
          side: "negative"
        }
      ]
    });

    expect(dryRun).toMatchObject({
      ok: true,
      modifiedFeatureIds: ["feat_rect_1"],
      modifiedBodyIds: ["body_rect_1"]
    });
    expect(engine.getDocument().features.get("feat_rect_1")?.depth).toBe(3);
    expect(engine.getDocument().features.get("feat_rect_1")?.side).toBe(
      "positive"
    );

    const commit = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.updateExtrude",
          id: "feat_rect_1",
          depth: 8,
          side: "symmetric"
        }
      ]
    });

    expect(commit).toMatchObject({
      ok: true,
      modifiedFeatureIds: ["feat_rect_1"],
      modifiedBodyIds: ["body_rect_1"],
      transactionId: "txn_2"
    });
    expect(engine.getDocument().features.get("feat_rect_1")?.depth).toBe(8);
    expect(engine.getDocument().features.get("feat_rect_1")?.side).toBe(
      "symmetric"
    );
  });

  it("round-trips extrude depth and side updates through project JSON and history summaries", () => {
    const engine = createRectangleExtrudeEngine();

    engine.apply({
      op: "feature.updateExtrude",
      id: "feat_rect_1",
      depth: 8,
      side: "negative"
    });

    const restored = importCadProjectJson(exportCadProjectJson(engine));
    const history = restored.executeQuery({
      version: "cadops.v1",
      query: { query: "transaction.history" }
    });

    expect(restored.getDocument().features.get("feat_rect_1")?.depth).toBe(8);
    expect(restored.getDocument().features.get("feat_rect_1")?.side).toBe(
      "negative"
    );
    expect(history).toMatchObject({
      ok: true,
      query: "transaction.history",
      transactionCount: 2
    });

    if (!history.ok || history.query !== "transaction.history") {
      throw new Error("Expected transaction history response.");
    }

    expect(history.transactions[1]?.ops).toContainEqual(
      expect.objectContaining({
        op: "feature.updateExtrude",
        label:
          "Update extrude feature feat_rect_1 depth to 8 and side to negative",
        featureId: "feat_rect_1",
        bodyId: "body_rect_1",
        sketchId: "sketch_1",
        sketchEntityId: "rect_1"
      })
    );

    restored.undo();
    expect(restored.getDocument().features.get("feat_rect_1")?.depth).toBe(3);
    expect(restored.getDocument().features.get("feat_rect_1")?.side).toBe(
      "positive"
    );

    restored.redo();
    expect(restored.getDocument().features.get("feat_rect_1")?.depth).toBe(8);
    expect(restored.getDocument().features.get("feat_rect_1")?.side).toBe(
      "negative"
    );
  });

  it("updates rectangle extrude source profiles and marks dependent bodies modified", () => {
    const engine = createRectangleExtrudeEngine();

    const result = engine.apply({
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: {
        id: "rect_1",
        kind: "rectangle",
        center: [1, 2],
        width: 6,
        height: 5
      }
    });
    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    const history = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "transaction.history" }
    });

    expect(
      engine.getDocument().sketches.get("sketch_1")?.entities.get("rect_1")
    ).toEqual({
      id: "rect_1",
      kind: "rectangle",
      center: [1, 2],
      width: 6,
      height: 5
    });
    expect(result.transaction.diff.sketches).toMatchObject({
      entitiesModified: [
        { sketchId: "sketch_1", id: "rect_1", kind: "rectangle" }
      ]
    });
    expect(result.transaction.diff.features).toMatchObject({
      modified: [
        {
          id: "feat_rect_1",
          kind: "extrude",
          bodyId: "body_rect_1",
          sketchId: "sketch_1",
          entityId: "rect_1",
          profileKind: "rectangle"
        }
      ],
      bodiesModified: [
        { id: "body_rect_1", kind: "solid", featureId: "feat_rect_1" }
      ]
    });
    expect(structure).toMatchObject({
      ok: true,
      query: "project.structure",
      features: [
        {
          id: "feat_rect_1",
          bodyId: "body_rect_1",
          sketchId: "sketch_1",
          entityId: "rect_1",
          profileKind: "rectangle",
          depth: 3
        }
      ],
      bodies: [{ id: "body_rect_1", featureId: "feat_rect_1" }]
    });

    if (!history.ok || history.query !== "transaction.history") {
      throw new Error("Expected transaction history response.");
    }

    expect(history.transactions[1]?.ops).toContainEqual(
      expect.objectContaining({
        op: "sketch.updateEntity",
        label:
          "Update rectangle rect_1 in sketch_1 and rebuild body body_rect_1",
        sketchId: "sketch_1",
        sketchEntityId: "rect_1",
        sketchEntityKind: "rectangle",
        featureId: "feat_rect_1",
        bodyId: "body_rect_1"
      })
    );

    engine.undo();
    expect(
      engine.getDocument().sketches.get("sketch_1")?.entities.get("rect_1")
    ).toMatchObject({
      center: [0, 0],
      width: 4,
      height: 2
    });

    engine.redo();
    expect(
      engine.getDocument().sketches.get("sketch_1")?.entities.get("rect_1")
    ).toMatchObject({
      center: [1, 2],
      width: 6,
      height: 5
    });
  });

  it("round-trips circle extrude source profile edits through project JSON", () => {
    const engine = createCircleExtrudeEngine();

    engine.apply({
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: {
        id: "circle_1",
        kind: "circle",
        center: [2, 3],
        radius: 5
      }
    });

    const restored = importCadProjectJson(exportCadProjectJson(engine));
    const restoredEntity = restored
      .getDocument()
      .sketches.get("sketch_1")
      ?.entities.get("circle_1");
    const restoredFeature = restored
      .getDocument()
      .features.get("feat_circle_1");
    const history = restored.executeQuery({
      version: "cadops.v1",
      query: { query: "transaction.history" }
    });

    expect(restoredEntity).toEqual({
      id: "circle_1",
      kind: "circle",
      center: [2, 3],
      radius: 5
    });
    expect(restoredFeature).toMatchObject({
      id: "feat_circle_1",
      bodyId: "body_circle_1",
      sketchId: "sketch_1",
      entityId: "circle_1",
      profileKind: "circle"
    });

    if (!history.ok || history.query !== "transaction.history") {
      throw new Error("Expected transaction history response.");
    }

    expect(history.transactions[1]?.ops).toContainEqual(
      expect.objectContaining({
        op: "sketch.updateEntity",
        label:
          "Update circle circle_1 in sketch_1 and rebuild body body_circle_1",
        sketchEntityId: "circle_1",
        featureId: "feat_circle_1",
        bodyId: "body_circle_1"
      })
    );

    restored.undo();
    expect(
      restored.getDocument().sketches.get("sketch_1")?.entities.get("circle_1")
    ).toMatchObject({
      center: [0, 0],
      radius: 2
    });

    restored.redo();
    expect(
      restored.getDocument().sketches.get("sketch_1")?.entities.get("circle_1")
    ).toMatchObject({
      center: [2, 3],
      radius: 5
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

  it("returns clear feature delete history with actor, audit, body, and status", () => {
    const engine = new CadEngine();

    engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
        {
          op: "sketch.addRectangle",
          sketchId: "sketch_1",
          id: "rect_1",
          center: [0, 0],
          width: 4,
          height: 2
        },
        {
          op: "feature.extrude",
          id: "feat_rect_1",
          bodyId: "body_rect_1",
          sketchId: "sketch_1",
          entityId: "rect_1",
          depth: 3
        }
      ]
    });
    engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      actor: {
        type: "agent",
        id: "history-agent",
        name: "History Agent"
      },
      audit: {
        source: "mcp",
        requestId: "delete-request",
        toolName: "cad.batch",
        intent: "commit",
        operationCount: 1
      },
      ops: [{ op: "feature.delete", id: "feat_rect_1" }]
    });

    const committed = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "transaction.history" }
    });

    expect(committed).toMatchObject({
      ok: true,
      query: "transaction.history",
      transactionCount: 2
    });

    if (!committed.ok || committed.query !== "transaction.history") {
      throw new Error("Expected transaction history response.");
    }

    const createTransaction = committed.transactions[0];
    const deleteTransaction = committed.transactions[1];

    expect(
      createTransaction?.ops.find((op) => op.op === "feature.extrude")
    ).toMatchObject({
      op: "feature.extrude",
      label:
        "Create extrude feature feat_rect_1 from sketch_1/rect_1 -> body body_rect_1",
      featureId: "feat_rect_1",
      bodyId: "body_rect_1"
    });
    expect(createTransaction?.diff.features).toMatchObject({
      created: [
        expect.objectContaining({
          id: "feat_rect_1",
          bodyId: "body_rect_1"
        })
      ],
      bodiesCreated: [
        { id: "body_rect_1", kind: "solid", featureId: "feat_rect_1" }
      ]
    });
    expect(deleteTransaction).toMatchObject({
      id: "txn_2",
      status: "committed",
      actor: {
        type: "agent",
        id: "history-agent",
        name: "History Agent"
      },
      audit: {
        source: "mcp",
        requestId: "delete-request",
        toolName: "cad.batch",
        intent: "commit",
        operationCount: 1
      },
      ops: [
        {
          op: "feature.delete",
          label: "Delete feature feat_rect_1 and body body_rect_1",
          featureId: "feat_rect_1",
          bodyId: "body_rect_1",
          sketchId: "sketch_1",
          sketchEntityId: "rect_1"
        }
      ],
      diff: {
        features: {
          deleted: [
            expect.objectContaining({
              id: "feat_rect_1",
              bodyId: "body_rect_1",
              sketchId: "sketch_1",
              entityId: "rect_1"
            })
          ],
          bodiesDeleted: [
            { id: "body_rect_1", kind: "solid", featureId: "feat_rect_1" }
          ]
        }
      }
    });

    engine.undo();

    const undone = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "transaction.history" }
    });

    expect(undone).toMatchObject({
      ok: true,
      transactions: [
        { id: "txn_1", status: "committed" },
        { id: "txn_2", status: "undone" }
      ]
    });

    engine.redo();

    const redone = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "transaction.history" }
    });

    expect(redone).toMatchObject({
      ok: true,
      transactions: [
        { id: "txn_1", status: "committed" },
        { id: "txn_2", status: "committed" }
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

  it("serializes async command validation against the latest authoritative snapshot", async () => {
    const engine = new CadEngine();
    const executor = new AsyncCadCommandExecutor(
      engine,
      new MockCadCommandWorker({ delayMs: 5 })
    );

    const createResponsePromise = executor.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.createBox",
          dimensions: { width: 2, height: 2, depth: 2 }
        }
      ]
    });
    const updateResponsePromise = executor.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.updateTransform",
          id: "obj_1",
          transform: { translation: [4, 0, 0] }
        }
      ]
    });

    await expect(createResponsePromise).resolves.toMatchObject({
      ok: true,
      createdIds: ["obj_1"]
    });
    await expect(updateResponsePromise).resolves.toMatchObject({
      ok: true,
      modifiedIds: ["obj_1"]
    });
    expect(
      engine.getDocument().objects.get("obj_1")?.transform.translation
    ).toEqual([4, 0, 0]);
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
    expect(restored.getDocument().sketches.size).toBe(0);
    expect(restored.getTransactions()).toEqual([]);
    expect(restored.getRedoStack()).toEqual([]);
  });

  it("round-trips sketch source data through project v3 JSON", () => {
    const engine = new CadEngine();

    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        id: "rect_1",
        center: [0, 0],
        width: 3,
        height: 2
      }
    ]);

    const project = parseCadProjectJson(exportCadProjectJson(engine));
    const restored = importCadProjectJson(JSON.stringify(project));
    const sketch = restored.getDocument().sketches.get("sketch_1");

    expect(project.schemaVersion).toBe("web-cad.project.v3");
    expect(project.document.sketches).toEqual([
      {
        id: "sketch_1",
        name: "Profile",
        plane: "XY",
        entities: [
          {
            id: "rect_1",
            kind: "rectangle",
            center: [0, 0],
            width: 3,
            height: 2
          }
        ]
      }
    ]);
    expect(project.document.features).toEqual([]);
    expect(sketch?.entities.get("rect_1")).toEqual({
      id: "rect_1",
      kind: "rectangle",
      center: [0, 0],
      width: 3,
      height: 2
    });
  });

  it("imports v1 project JSON through v3 migration compatibility", () => {
    const project = parseCadProjectJson(exportCadProjectJson(new CadEngine()));
    const v1Project = {
      ...project,
      schemaVersion: "web-cad.project.v1",
      document: {
        units: project.document.units,
        objects: project.document.objects,
        nextObjectNumber: project.document.nextObjectNumber
      }
    };

    const restoredProject = parseCadProjectJson(JSON.stringify(v1Project));
    const restored = importCadProjectJson(JSON.stringify(v1Project));

    expect(restoredProject.schemaVersion).toBe("web-cad.project.v3");
    expect(restoredProject.document.sketches).toEqual([]);
    expect(restoredProject.document.features).toEqual([]);
    expect(restored.getDocument().sketches.size).toBe(0);
  });

  it("round-trips sketch extrude source data through project v3 JSON", () => {
    const engine = new CadEngine();

    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_1",
        id: "circle_1",
        center: [0, 0],
        radius: 2
      },
      {
        op: "feature.extrude",
        id: "feat_circle_1",
        bodyId: "body_circle_1",
        sketchId: "sketch_1",
        entityId: "circle_1",
        depth: 6,
        side: "symmetric"
      }
    ]);

    const project = parseCadProjectJson(exportCadProjectJson(engine));
    const restored = importCadProjectJson(JSON.stringify(project));
    const feature = restored.getDocument().features.get("feat_circle_1");

    expect(project.schemaVersion).toBe("web-cad.project.v3");
    expect(project.document.features).toEqual([
      {
        id: "feat_circle_1",
        kind: "extrude",
        sketchId: "sketch_1",
        entityId: "circle_1",
        profileKind: "circle",
        depth: 6,
        side: "symmetric",
        bodyId: "body_circle_1"
      }
    ]);
    expect(feature).toEqual({
      id: "feat_circle_1",
      kind: "extrude",
      sketchId: "sketch_1",
      entityId: "circle_1",
      profileKind: "circle",
      depth: 6,
      side: "symmetric",
      bodyId: "body_circle_1"
    });
  });

  it("defaults missing saved extrude side to positive during project import", () => {
    const engine = createRectangleExtrudeEngine();
    const project = parseCadProjectJson(exportCadProjectJson(engine));
    const legacyProject = {
      ...project,
      document: {
        ...project.document,
        features: project.document.features.map((feature) => {
          const legacyFeature: Record<string, unknown> = { ...feature };
          delete legacyFeature.side;

          return legacyFeature;
        })
      }
    };

    const restored = importCadProjectJson(JSON.stringify(legacyProject));
    const restoredProject = parseCadProjectJson(exportCadProjectJson(restored));

    expect(restored.getDocument().features.get("feat_rect_1")?.side).toBe(
      "positive"
    );
    expect(restoredProject.document.features[0]).toMatchObject({
      id: "feat_rect_1",
      side: "positive"
    });
  });

  it("round-trips deleted sketch extrude features through project v3 history", () => {
    const engine = new CadEngine();

    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        id: "rect_1",
        center: [0, 0],
        width: 4,
        height: 2
      }
    ]);
    engine.apply({
      op: "feature.extrude",
      id: "feat_rect_1",
      bodyId: "body_rect_1",
      sketchId: "sketch_1",
      entityId: "rect_1",
      depth: 3
    });
    engine.apply({
      op: "feature.delete",
      id: "feat_rect_1"
    });

    const projectJson = exportCadProjectJson(engine);
    const project = parseCadProjectJson(projectJson);
    const restored = importCadProjectJson(projectJson);
    const restoredStructure = restored.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });

    expect(project.schemaVersion).toBe("web-cad.project.v3");
    expect(project.document.features).toEqual([]);
    expect(project.history.flatMap((transaction) => transaction.ops)).toEqual([
      { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        id: "rect_1",
        center: [0, 0],
        width: 4,
        height: 2
      },
      {
        op: "feature.extrude",
        id: "feat_rect_1",
        bodyId: "body_rect_1",
        sketchId: "sketch_1",
        entityId: "rect_1",
        depth: 3
      },
      {
        op: "feature.delete",
        id: "feat_rect_1"
      }
    ]);
    expect(restored.getDocument().features.size).toBe(0);
    expect(restoredStructure).toMatchObject({
      ok: true,
      query: "project.structure",
      featureCount: 0,
      bodyCount: 0,
      features: [],
      bodies: []
    });

    restored.undo();

    const restoredAfterUndoStructure = restored.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });

    expect(restored.getDocument().features.get("feat_rect_1")).toMatchObject({
      id: "feat_rect_1",
      bodyId: "body_rect_1"
    });
    expect(restoredAfterUndoStructure).toMatchObject({
      ok: true,
      query: "project.structure",
      featureCount: 1,
      bodyCount: 1,
      features: [{ id: "feat_rect_1", bodyId: "body_rect_1" }],
      bodies: [{ id: "body_rect_1", featureId: "feat_rect_1" }]
    });

    restored.redo();

    const restoredAfterRedoStructure = restored.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });

    expect(restored.getDocument().features.size).toBe(0);
    expect(restoredAfterRedoStructure).toMatchObject({
      ok: true,
      query: "project.structure",
      featureCount: 0,
      bodyCount: 0,
      features: [],
      bodies: []
    });
  });

  it("rejects v3 extrude features with dangling sketch or entity references", () => {
    const engine = new CadEngine();

    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        id: "rect_1",
        center: [0, 0],
        width: 2,
        height: 3
      },
      {
        op: "feature.extrude",
        id: "feat_1",
        bodyId: "body_1",
        sketchId: "sketch_1",
        entityId: "rect_1",
        depth: 4
      }
    ]);

    const project = parseCadProjectJson(exportCadProjectJson(engine));

    expectProjectImportError(
      () =>
        parseCadProjectJson(
          JSON.stringify({
            ...project,
            history: [],
            document: {
              ...project.document,
              sketches: [],
              features: project.document.features
            }
          })
        ),
      {
        code: "INVALID_FEATURE",
        path: "$.document.features[0].sketchId"
      }
    );
    expectProjectImportError(
      () =>
        parseCadProjectJson(
          JSON.stringify({
            ...project,
            history: [],
            document: {
              ...project.document,
              sketches: [
                {
                  id: "sketch_1",
                  name: "Profile",
                  plane: "XY",
                  entities: []
                }
              ],
              features: project.document.features
            }
          })
        ),
      {
        code: "INVALID_FEATURE",
        path: "$.document.features[0].entityId"
      }
    );
  });

  it("rejects mis-stamped older project versions with newer source fields", () => {
    const project = parseCadProjectJson(exportCadProjectJson(new CadEngine()));

    expectProjectImportError(
      () =>
        parseCadProjectJson(
          JSON.stringify({
            ...project,
            schemaVersion: "web-cad.project.v1",
            document: {
              units: project.document.units,
              objects: project.document.objects,
              sketches: [],
              nextObjectNumber: project.document.nextObjectNumber
            }
          })
        ),
      {
        code: "INVALID_DOCUMENT",
        path: "$.document.sketches"
      }
    );
    expectProjectImportError(
      () =>
        parseCadProjectJson(
          JSON.stringify({
            ...project,
            schemaVersion: "web-cad.project.v2",
            document: {
              ...project.document,
              features: []
            }
          })
        ),
      {
        code: "INVALID_DOCUMENT",
        path: "$.document.features"
      }
    );
  });

  it("rejects imported transaction history when saved diffs do not match replay", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 1, height: 1, depth: 1 }
    });

    const project = parseCadProjectJson(exportCadProjectJson(engine));
    const firstTransaction = project.history[0];

    if (!firstTransaction) {
      throw new Error("Expected exported history transaction.");
    }

    const badProject = {
      ...project,
      history: [
        {
          ...firstTransaction,
          diff: {
            ...firstTransaction.diff,
            created: []
          }
        }
      ]
    };

    expectProjectImportError(
      () => importCadProjectJson(JSON.stringify(badProject)),
      {
        code: "INVALID_TRANSACTION_HISTORY",
        path: "$.history"
      }
    );
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

  it("converts sketch and extrude source values when preserving physical size", () => {
    const engine = new CadEngine();

    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        id: "rect_1",
        center: [10, 20],
        width: 30,
        height: 40
      },
      {
        op: "feature.extrude",
        id: "feat_1",
        bodyId: "body_1",
        sketchId: "sketch_1",
        entityId: "rect_1",
        depth: 50
      }
    ]);
    engine.apply({
      op: "document.updateUnits",
      units: "cm",
      mode: "preservePhysicalSize"
    });

    const restored = importCadProjectJson(exportCadProjectJson(engine));
    const convertedEntity = restored
      .getDocument()
      .sketches.get("sketch_1")
      ?.entities.get("rect_1");
    const convertedFeature = restored.getDocument().features.get("feat_1");

    expect(convertedEntity).toEqual({
      id: "rect_1",
      kind: "rectangle",
      center: [1, 2],
      width: 3,
      height: 4
    });
    expect(convertedFeature?.depth).toBe(5);
    expect(restored.getTransactions()[1]?.diff.features).toMatchObject({
      modified: [{ id: "feat_1" }],
      bodiesModified: [{ id: "body_1" }]
    });

    restored.undo();

    const undoneEntity = restored
      .getDocument()
      .sketches.get("sketch_1")
      ?.entities.get("rect_1");
    const undoneFeature = restored.getDocument().features.get("feat_1");

    expect(undoneEntity).toEqual({
      id: "rect_1",
      kind: "rectangle",
      center: [10, 20],
      width: 30,
      height: 40
    });
    expect(undoneFeature?.depth).toBe(50);
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

  it("rejects malformed sketches with a structured import error", () => {
    const project = parseCadProjectJson(exportCadProjectJson(new CadEngine()));

    expectProjectImportError(
      () =>
        parseCadProjectJson(
          JSON.stringify({
            ...project,
            document: {
              ...project.document,
              sketches: [
                {
                  id: "sketch_1",
                  name: "Bad sketch",
                  plane: "XY",
                  entities: [
                    {
                      id: "circle_1",
                      kind: "circle",
                      center: [0, 0],
                      radius: 0
                    }
                  ]
                }
              ],
              nextSketchNumber: 2,
              nextSketchEntityNumber: 2
            }
          })
        ),
      {
        code: "INVALID_DIMENSIONS",
        path: "$.document.sketches[0].entities[0].radius"
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

  it("rejects transaction history that deletes a missing authored feature", () => {
    const project = parseCadProjectJson(exportCadProjectJson(new CadEngine()));

    expectProjectImportError(
      () =>
        importCadProjectJson(
          JSON.stringify({
            ...project,
            history: [
              {
                id: "txn_bad_feature_delete",
                status: "committed",
                ops: [{ op: "feature.delete", id: "missing_feature" }],
                diff: {
                  created: [],
                  modified: [],
                  deleted: [],
                  features: {
                    deleted: [
                      {
                        id: "missing_feature",
                        kind: "extrude",
                        bodyId: "missing_body",
                        sketchId: "sketch_1",
                        entityId: "rect_1",
                        profileKind: "rectangle"
                      }
                    ],
                    bodiesDeleted: [
                      {
                        id: "missing_body",
                        kind: "solid",
                        featureId: "missing_feature"
                      }
                    ]
                  }
                }
              }
            ]
          })
        ),
      {
        code: "INVALID_TRANSACTION_HISTORY",
        path: "$.history",
        message: "Feature does not exist: missing_feature"
      }
    );
  });

  it("rejects transaction history that deletes a primitive-derived feature", () => {
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
            history: [
              ...project.history,
              {
                id: "txn_bad_primitive_feature_delete",
                status: "committed",
                ops: [{ op: "feature.delete", id: "feature:box_1" }],
                diff: {
                  created: [],
                  modified: [],
                  deleted: [],
                  features: {
                    deleted: [
                      {
                        id: "feature:box_1",
                        kind: "extrude",
                        bodyId: "body:box_1",
                        sketchId: "sketch_1",
                        entityId: "rect_1",
                        profileKind: "rectangle"
                      }
                    ],
                    bodiesDeleted: [
                      {
                        id: "body:box_1",
                        kind: "solid",
                        featureId: "feature:box_1"
                      }
                    ]
                  }
                }
              }
            ]
          })
        ),
      {
        code: "INVALID_TRANSACTION_HISTORY",
        path: "$.history",
        message:
          "Primitive-derived feature cannot be deleted through feature.delete: feature:box_1"
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
  expectedIssue: {
    readonly code: string;
    readonly path: string;
    readonly message?: string;
  }
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
          path: expectedIssue.path,
          ...(expectedIssue.message
            ? { message: expect.stringContaining(expectedIssue.message) }
            : {})
        })
      ])
    );
    return;
  }

  throw new Error("Expected project import error.");
}
