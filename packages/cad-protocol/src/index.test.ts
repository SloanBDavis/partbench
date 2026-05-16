import { describe, expect, it } from "vitest";
import type {
  CadAxisAlignedBounds,
  CadBatch,
  CadBatchValidationError,
  CadBodySnapshot,
  CadObjectModelSource,
  CadPartSnapshot,
  CadPrimitiveFeatureSummary,
  CadOp,
  CadQueryRequest
} from "./index";
import { protocolPackage } from "./index";

describe("cad-protocol", () => {
  it("exports package status", () => {
    expect(protocolPackage).toEqual({
      name: "@web-cad/cad-protocol",
      status: "ready"
    });
  });

  it("types supported scene commands", () => {
    const ops: CadOp[] = [
      {
        op: "document.updateUnits",
        units: "in",
        mode: "preservePhysicalSize"
      },
      {
        op: "scene.createBox",
        id: "box_1",
        dimensions: { width: 1, height: 2, depth: 3 }
      },
      {
        op: "scene.createCylinder",
        id: "cylinder_1",
        dimensions: { radius: 1, height: 4 }
      },
      {
        op: "scene.createSphere",
        id: "sphere_1",
        dimensions: { radius: 2 }
      },
      {
        op: "scene.createCone",
        id: "cone_1",
        dimensions: { radius: 2, height: 5 }
      },
      {
        op: "scene.createTorus",
        id: "torus_1",
        dimensions: { majorRadius: 3, minorRadius: 0.5 }
      },
      {
        op: "scene.updateTransform",
        id: "box_1",
        transform: { translation: [1, 2, 3] }
      },
      {
        op: "scene.updateBoxDimensions",
        id: "box_1",
        dimensions: { width: 4, height: 5, depth: 6 }
      },
      {
        op: "scene.updateCylinderDimensions",
        id: "cylinder_1",
        dimensions: { radius: 2, height: 8 }
      },
      {
        op: "scene.updateSphereDimensions",
        id: "sphere_1",
        dimensions: { radius: 3 }
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
      },
      {
        op: "scene.renameObject",
        id: "box_1",
        name: "Base plate"
      },
      {
        op: "scene.deleteObject",
        id: "cylinder_1"
      },
      {
        op: "sketch.create",
        id: "sketch_1",
        name: "Base sketch",
        plane: "XY"
      },
      {
        op: "sketch.addPoint",
        sketchId: "sketch_1",
        id: "skent_1",
        point: [0, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        start: [0, 0],
        end: [1, 1]
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        center: [0, 0],
        width: 2,
        height: 3
      },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_1",
        center: [1, 1],
        radius: 2
      },
      {
        op: "sketch.updateEntity",
        sketchId: "sketch_1",
        entity: {
          id: "skent_1",
          kind: "point",
          point: [2, 3]
        }
      },
      {
        op: "sketch.deleteEntity",
        sketchId: "sketch_1",
        entityId: "skent_1"
      },
      {
        op: "sketch.rename",
        id: "sketch_1",
        name: "Renamed sketch"
      },
      {
        op: "sketch.delete",
        id: "sketch_1"
      }
    ];

    expect(ops.map((op) => op.op)).toEqual([
      "document.updateUnits",
      "scene.createBox",
      "scene.createCylinder",
      "scene.createSphere",
      "scene.createCone",
      "scene.createTorus",
      "scene.updateTransform",
      "scene.updateBoxDimensions",
      "scene.updateCylinderDimensions",
      "scene.updateSphereDimensions",
      "scene.updateConeDimensions",
      "scene.updateTorusDimensions",
      "scene.renameObject",
      "scene.deleteObject",
      "sketch.create",
      "sketch.addPoint",
      "sketch.addLine",
      "sketch.addRectangle",
      "sketch.addCircle",
      "sketch.updateEntity",
      "sketch.deleteEntity",
      "sketch.rename",
      "sketch.delete"
    ]);
    expect(ops[0]).toMatchObject({
      op: "document.updateUnits",
      mode: "preservePhysicalSize"
    });
  });

  it("types CADOps batches", () => {
    const batch: CadBatch = {
      version: "cadops.v1",
      mode: "dryRun",
      actor: {
        type: "script",
        id: "test-script",
        name: "Test Script"
      },
      audit: {
        source: "script",
        requestId: "script_req_1",
        toolName: "local-script",
        intent: "dryRun",
        operationCount: 1
      },
      ops: [
        {
          op: "scene.createBox",
          dimensions: { width: 4, height: 5, depth: 6 }
        }
      ]
    };

    expect(batch.version).toBe("cadops.v1");
    expect(batch.mode).toBe("dryRun");
    expect(batch.actor?.type).toBe("script");
    expect(batch.audit?.operationCount).toBe(1);
    expect(batch.ops).toHaveLength(1);
  });

  it("types structured validation errors", () => {
    const error: CadBatchValidationError = {
      code: "INVALID_DIMENSIONS",
      message: "Box dimensions must be positive finite numbers.",
      opIndex: 0,
      op: "scene.createBox",
      path: "$.ops[0].dimensions",
      expected: "positive finite width, height, and depth",
      received: '{"width":0,"height":1,"depth":1}'
    };

    expect(error).toMatchObject({
      code: "INVALID_DIMENSIONS",
      op: "scene.createBox",
      path: "$.ops[0].dimensions"
    });
  });

  it("types CADOps read queries", () => {
    const queries: CadQueryRequest[] = [
      {
        version: "cadops.v1",
        query: { query: "project.summary" }
      },
      {
        version: "cadops.v1",
        query: { query: "project.features" }
      },
      {
        version: "cadops.v1",
        query: { query: "project.structure" }
      },
      {
        version: "cadops.v1",
        query: { query: "project.sketches" }
      },
      {
        version: "cadops.v1",
        query: { query: "object.get", id: "box_1" }
      },
      {
        version: "cadops.v1",
        query: { query: "object.measurements", id: "box_1" }
      },
      {
        version: "cadops.v1",
        query: { query: "project.extents" }
      },
      {
        version: "cadops.v1",
        query: { query: "sketch.get", id: "sketch_1" }
      },
      {
        version: "cadops.v1",
        query: { query: "transaction.history" }
      }
    ];

    expect(queries.map((request) => request.query.query)).toEqual([
      "project.summary",
      "project.features",
      "project.structure",
      "project.sketches",
      "object.get",
      "object.measurements",
      "project.extents",
      "sketch.get",
      "transaction.history"
    ]);
  });

  it("types measurement bounds", () => {
    const bounds: CadAxisAlignedBounds = {
      min: [-1, -2, -3],
      max: [1, 2, 3],
      size: [2, 4, 6],
      center: [0, 0, 0]
    };

    expect(bounds.size).toEqual([2, 4, 6]);
  });

  it("types primitive feature summaries", () => {
    const feature: CadPrimitiveFeatureSummary = {
      id: "feature:torus_1",
      kind: "primitive",
      partId: "part:default",
      primitive: "torus",
      objectId: "torus_1",
      bodyId: "body:torus_1",
      dimensions: { majorRadius: 3, minorRadius: 0.5 },
      transform: {
        translation: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      },
      source: {
        type: "sceneObject",
        createdByTransactionId: "txn_1",
        createOp: "scene.createTorus"
      }
    };

    expect(feature).toMatchObject({
      id: "feature:torus_1",
      kind: "primitive",
      objectId: "torus_1"
    });
  });

  it("types the V2 structural model bridge", () => {
    const part: CadPartSnapshot = {
      id: "part:default",
      kind: "part",
      name: "Default Part",
      source: { type: "defaultScenePart" },
      objectIds: ["box_1"],
      featureIds: ["feature:box_1"],
      bodyIds: ["body:box_1"],
      sketchIds: ["sketch_1"]
    };
    const body: CadBodySnapshot = {
      id: "body:box_1",
      kind: "solid",
      partId: "part:default",
      featureId: "feature:box_1",
      objectId: "box_1",
      primitive: "box",
      source: {
        type: "primitiveFeature",
        featureId: "feature:box_1",
        objectId: "box_1"
      }
    };
    const objectSource: CadObjectModelSource = {
      objectId: "box_1",
      partId: part.id,
      featureId: body.featureId,
      bodyId: body.id
    };

    expect(part.featureIds).toEqual(["feature:box_1"]);
    expect(body.partId).toBe(part.id);
    expect(objectSource).toEqual({
      objectId: "box_1",
      partId: "part:default",
      featureId: "feature:box_1",
      bodyId: "body:box_1"
    });
  });
});
