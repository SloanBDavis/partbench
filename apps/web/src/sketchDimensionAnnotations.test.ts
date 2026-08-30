import { describe, expect, it } from "vitest";
import { createDefaultCamera } from "@web-cad/renderer";
import type { SketchDimensionEntryCurrent, SketchEntitySnapshot } from "@web-cad/cad-protocol";
import {
  createSketchDimensionAnnotations,
  moveSketchDimensionAnnotation
} from "./sketchDimensionAnnotations";

const entities: readonly SketchEntitySnapshot[] = [
  {
    id: "rect_1",
    kind: "rectangle",
    center: [0, 0],
    width: 40,
    height: 20,
    construction: false
  },
  {
    id: "line_1",
    kind: "line",
    start: [0, 0],
    end: [10, 0],
    construction: false
  }
];

const dimensions: readonly SketchDimensionEntryCurrent[] = [
  {
    sourceShape: "v22",
    id: "dim_width",
    name: "Width",
    sketchId: "sketch_1",
    target: {
      kind: "entityScalar",
      entityId: "rect_1",
      entityKind: "rectangle",
      role: "width"
    },
    valueSource: { type: "literal", value: 40 },
    status: "healthy",
    issues: [],
    effectiveValue: 40
  },
  {
    sourceShape: "v22",
    id: "dim_len",
    name: "Length",
    sketchId: "sketch_1",
    target: {
      kind: "entityScalar",
      entityId: "line_1",
      entityKind: "line",
      role: "length"
    },
    valueSource: { type: "parameter", parameterId: "p_len" },
    status: "healthy",
    issues: [],
    effectiveValue: 10
  }
];

describe("sketch dimension annotations", () => {
  it("places existing V19 dimensions on canvas without saving layout", () => {
    const annotations = createSketchDimensionAnnotations({
      sketchId: "sketch_1",
      entities,
      dimensions,
      displayFrame: {
        origin: [0, 0, 0],
        uAxis: [1, 0, 0],
        vAxis: [0, 1, 0]
      },
      camera: createDefaultCamera(),
      size: { width: 800, height: 600 },
      units: "mm"
    });
    const moved = moveSketchDimensionAnnotation({}, "dim_width", { x: 12, y: -8 });

    expect(annotations).toHaveLength(2);
    expect(annotations[0]).toMatchObject({
      dimensionId: "dim_width",
      valueLabel: "40 mm",
      boundToParameter: false
    });
    expect(annotations[1]).toMatchObject({
      dimensionId: "dim_len",
      boundToParameter: true,
      parameterId: "p_len"
    });
    expect(moved.dim_width).toEqual({ x: 12, y: -8 });
  });
});
