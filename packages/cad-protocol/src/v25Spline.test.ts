import { describe, expect, it } from "vitest";
import {
  CAD_V19_PROJECT_SCHEMA_VERSION,
  type CadOp,
  type SketchAddSplineOp,
  type SketchSplineEntity
} from "./index";

describe("sketch.addSpline protocol", () => {
  it("names interpolation and control-point spline source records without a schema bump", () => {
    const interpolation: SketchAddSplineOp = {
      op: "sketch.addSpline",
      id: "spline_blob",
      sketchId: "sketch_extrude",
      definition: {
        kind: "interpolation",
        points: [
          [8, 0],
          [4, 6],
          [-4, 6],
          [-8, 0],
          [-4, -6],
          [4, -6]
        ],
        closed: true
      }
    };
    const controlPoints: SketchAddSplineOp = {
      op: "sketch.addSpline",
      sketchId: "sketch_profile",
      construction: false,
      definition: {
        kind: "controlPoints",
        points: [
          [2, 0],
          [2, 2],
          [0, 2],
          [0, 0]
        ],
        degree: 3,
        closed: true
      }
    };
    const snapshot: SketchSplineEntity = {
      id: "spline_blob",
      kind: "spline",
      form: "interpolation",
      points: [
        [8, 0],
        [4, 6],
        [-4, 6],
        [-8, 0],
        [-4, -6],
        [4, -6]
      ],
      degree: 3,
      closed: true,
      construction: false
    };
    const ops: readonly CadOp[] = [interpolation, controlPoints];

    expect(ops.map((op) => op.op)).toEqual([
      "sketch.addSpline",
      "sketch.addSpline"
    ]);
    expect(interpolation.definition.kind).toBe("interpolation");
    expect(controlPoints.definition.kind).toBe("controlPoints");
    expect(snapshot.kind).toBe("spline");
    expect(snapshot.form).toBe("interpolation");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).toBe("web-cad.project.v22");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).not.toBe("web-cad.project.v23");
  });
});
