import { describe, expect, it } from "vitest";

import type {
  SketchConstraintSnapshot,
  SketchDimensionSnapshot,
  SketchEntitySnapshot
} from "@web-cad/cad-protocol";

import {
  applySketchConstraintValue,
  applySketchDimensionValue,
  evaluateSketch,
  getLineLength,
  type SketchSolverDocument,
  type SketchSolverSketch
} from "./sketchSolver";

function createSketch(
  entities: readonly SketchEntitySnapshot[]
): SketchSolverSketch {
  return {
    id: "sketch_1",
    name: "Profile",
    plane: "XY",
    entities: new Map(entities.map((entity) => [entity.id, entity]))
  };
}

function createDocument(
  sketch: SketchSolverSketch,
  dimensions: readonly SketchDimensionSnapshot[] = [],
  constraints: readonly SketchConstraintSnapshot[] = []
): SketchSolverDocument {
  return {
    sketches: new Map([[sketch.id, sketch]]),
    parameters: new Map([["param_width", { id: "param_width", value: 6 }]]),
    sketchDimensions: new Map(
      dimensions.map((dimension) => [dimension.id, dimension])
    ),
    sketchConstraints: new Map(
      constraints.map((constraint) => [constraint.id, constraint])
    )
  };
}

describe("sketch solver boundary", () => {
  it("evaluates current rectangle, circle, and line dimensions into derived geometry", () => {
    const sketch = createSketch([
      {
        id: "rect_1",
        kind: "rectangle",
        center: [0, 0],
        width: 1,
        height: 2
      },
      { id: "circle_1", kind: "circle", center: [0, 0], radius: 1 },
      { id: "line_1", kind: "line", start: [0, 0], end: [3, 4] }
    ]);
    const dimensions: SketchDimensionSnapshot[] = [
      {
        id: "dim_width",
        name: "Width",
        sketchId: sketch.id,
        entityId: "rect_1",
        target: { entityKind: "rectangle", role: "width" },
        valueSource: { type: "parameter", parameterId: "param_width" }
      },
      {
        id: "dim_radius",
        name: "Radius",
        sketchId: sketch.id,
        entityId: "circle_1",
        target: { entityKind: "circle", role: "radius" },
        valueSource: { type: "literal", value: 2 }
      },
      {
        id: "dim_length",
        name: "Length",
        sketchId: sketch.id,
        entityId: "line_1",
        target: { entityKind: "line", role: "length" },
        valueSource: { type: "literal", value: 10 }
      }
    ];

    const evaluation = evaluateSketch(
      createDocument(sketch, dimensions),
      sketch
    );
    const rectangle = evaluation.evaluatedGeometry.entities.get("rect_1");
    const circle = evaluation.evaluatedGeometry.entities.get("circle_1");
    const line = evaluation.evaluatedGeometry.entities.get("line_1");

    expect(evaluation.status).toBe("healthy");
    expect(evaluation.dimensions).toHaveLength(3);
    expect(evaluation.drivenEntityIds).toEqual([
      "rect_1",
      "circle_1",
      "line_1"
    ]);
    expect(rectangle).toMatchObject({ kind: "rectangle", width: 6, height: 2 });
    expect(circle).toMatchObject({ kind: "circle", radius: 2 });
    expect(line).toEqual({
      id: "line_1",
      kind: "line",
      start: [-1.5, -2],
      end: [4.5, 6]
    });

    if (line?.kind !== "line") {
      throw new Error("Expected evaluated line.");
    }

    expect(getLineLength(line)).toBe(10);
  });

  it("applies current horizontal and vertical line constraints deterministically", () => {
    const diagonal: SketchEntitySnapshot = {
      id: "line_1",
      kind: "line",
      start: [0, 0],
      end: [1, 1]
    };

    const horizontal = applySketchConstraintValue(diagonal, {
      id: "con_horizontal",
      name: "Horizontal",
      sketchId: "sketch_1",
      entityId: diagonal.id,
      kind: "horizontal"
    });
    const vertical = applySketchConstraintValue(diagonal, {
      id: "con_vertical",
      name: "Vertical",
      sketchId: "sketch_1",
      entityId: diagonal.id,
      kind: "vertical"
    });

    expect(horizontal).toEqual({
      ok: true,
      entity: {
        id: "line_1",
        kind: "line",
        start: [-0.207106781187, 0.5],
        end: [1.207106781187, 0.5]
      }
    });
    expect(vertical).toEqual({
      ok: true,
      entity: {
        id: "line_1",
        kind: "line",
        start: [0.5, -0.207106781187],
        end: [0.5, 1.207106781187]
      }
    });
  });

  it("reports missing parameters and zero-length line dimensions as evaluation issues", () => {
    const sketch = createSketch([
      { id: "line_1", kind: "line", start: [0, 0], end: [0, 0] },
      {
        id: "rect_1",
        kind: "rectangle",
        center: [0, 0],
        width: 1,
        height: 1
      }
    ]);
    const dimensions: SketchDimensionSnapshot[] = [
      {
        id: "dim_length",
        name: "Length",
        sketchId: sketch.id,
        entityId: "line_1",
        target: { entityKind: "line", role: "length" },
        valueSource: { type: "literal", value: 1 }
      },
      {
        id: "dim_width",
        name: "Width",
        sketchId: sketch.id,
        entityId: "rect_1",
        target: { entityKind: "rectangle", role: "width" },
        valueSource: { type: "parameter", parameterId: "missing_param" }
      }
    ];

    const evaluation = evaluateSketch(
      createDocument(sketch, dimensions),
      sketch
    );

    expect(evaluation.status).toBe("missing-target");
    expect(evaluation.issues).toMatchObject([
      { code: "INVALID_VALUE", sketchDimensionId: "dim_length" },
      { code: "PARAMETER_NOT_FOUND", sketchDimensionId: "dim_width" }
    ]);
  });

  it("returns structured apply issues for invalid current targets", () => {
    const point: SketchEntitySnapshot = {
      id: "point_1",
      kind: "point",
      point: [0, 0]
    };

    expect(
      applySketchDimensionValue(
        point,
        {
          id: "dim_length",
          name: "Length",
          sketchId: "sketch_1",
          entityId: point.id,
          target: { entityKind: "line", role: "length" },
          valueSource: { type: "literal", value: 1 }
        },
        1
      )
    ).toMatchObject({
      ok: false,
      issue: {
        code: "INVALID_SKETCH_DIMENSION",
        pathField: "target",
        received: "line.length"
      }
    });

    expect(
      applySketchConstraintValue(point, {
        id: "con_horizontal",
        name: "Horizontal",
        sketchId: "sketch_1",
        entityId: point.id,
        kind: "horizontal"
      })
    ).toMatchObject({
      ok: false,
      issue: {
        code: "INVALID_SKETCH_CONSTRAINT",
        pathField: "entityId",
        received: "point"
      }
    });
  });
});
