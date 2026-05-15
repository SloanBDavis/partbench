import { describe, expect, it } from "vitest";
import type {
  CadAxisAlignedBounds,
  CadBatch,
  CadBatchValidationError,
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
        op: "scene.renameObject",
        id: "box_1",
        name: "Base plate"
      },
      {
        op: "scene.deleteObject",
        id: "cylinder_1"
      }
    ];

    expect(ops.map((op) => op.op)).toEqual([
      "document.updateUnits",
      "scene.createBox",
      "scene.createCylinder",
      "scene.updateTransform",
      "scene.updateBoxDimensions",
      "scene.updateCylinderDimensions",
      "scene.renameObject",
      "scene.deleteObject"
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
        query: { query: "transaction.history" }
      }
    ];

    expect(queries.map((request) => request.query.query)).toEqual([
      "project.summary",
      "project.features",
      "object.get",
      "object.measurements",
      "project.extents",
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
      id: "feature:box_1",
      kind: "primitive",
      primitive: "box",
      objectId: "box_1",
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
    };

    expect(feature).toMatchObject({
      id: "feature:box_1",
      kind: "primitive",
      objectId: "box_1"
    });
  });
});
