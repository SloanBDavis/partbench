import { describe, expect, it } from "vitest";
import type { CadBatch, CadOp, CadQueryRequest } from "./index";
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
        op: "scene.deleteObject",
        id: "cylinder_1"
      }
    ];

    expect(ops.map((op) => op.op)).toEqual([
      "scene.createBox",
      "scene.createCylinder",
      "scene.updateTransform",
      "scene.deleteObject"
    ]);
  });

  it("types CADOps batches", () => {
    const batch: CadBatch = {
      version: "cadops.v1",
      mode: "dryRun",
      ops: [
        {
          op: "scene.createBox",
          dimensions: { width: 4, height: 5, depth: 6 }
        }
      ]
    };

    expect(batch.version).toBe("cadops.v1");
    expect(batch.mode).toBe("dryRun");
    expect(batch.ops).toHaveLength(1);
  });

  it("types CADOps read queries", () => {
    const queries: CadQueryRequest[] = [
      {
        version: "cadops.v1",
        query: { query: "project.summary" }
      },
      {
        version: "cadops.v1",
        query: { query: "object.get", id: "box_1" }
      }
    ];

    expect(queries.map((request) => request.query.query)).toEqual([
      "project.summary",
      "object.get"
    ]);
  });
});
