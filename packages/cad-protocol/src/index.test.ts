import { describe, expect, it } from "vitest";
import type { CadOp } from "./index";
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
});
