import { describe, expect, it } from "vitest";
import { projectSketchCurveEditViewportPoint } from "./sketchCurveEditViewportProjection";

describe("V19 curve-edit viewport projection", () => {
  it("snaps a pixel-quantized point onto the explicitly picked finite curve", () => {
    expect(
      projectSketchCurveEditViewportPoint(
        {
          id: "line_1",
          kind: "line",
          construction: false,
          start: [0, 4],
          end: [2, 4]
        },
        [0.499999, 4.000002]
      )
    ).toEqual([0.499999, 4]);
  });

  it("leaves unsupported non-curve geometry unchanged", () => {
    expect(
      projectSketchCurveEditViewportPoint(
        {
          id: "point_1",
          kind: "point",
          construction: false,
          point: [1, 2]
        },
        [1.1, 2.2]
      )
    ).toEqual([1.1, 2.2]);
  });
});
