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

  it("solves line dimensions from fixed and coincident endpoint anchors", () => {
    const sketch = createSketch([
      { id: "fixed_line", kind: "line", start: [0, 0], end: [3, 4] },
      { id: "coincident_line", kind: "line", start: [0, 0], end: [0, 2] },
      { id: "horizontal_line", kind: "line", start: [0, 0], end: [1, 1] },
      { id: "anchor", kind: "point", point: [5, 5] },
      { id: "left", kind: "point", point: [2, 3] },
      { id: "right", kind: "point", point: [8, 3] }
    ]);
    const dimensions: SketchDimensionSnapshot[] = [
      {
        id: "dim_fixed_length",
        name: "Fixed line length",
        sketchId: sketch.id,
        entityId: "fixed_line",
        target: { entityKind: "line", role: "length" },
        valueSource: { type: "literal", value: 5 }
      },
      {
        id: "dim_coincident_length",
        name: "Coincident line length",
        sketchId: sketch.id,
        entityId: "coincident_line",
        target: { entityKind: "line", role: "length" },
        valueSource: { type: "literal", value: 4 }
      }
    ];
    const constraints: SketchConstraintSnapshot[] = [
      {
        id: "fix_start",
        name: "Fixed start",
        sketchId: sketch.id,
        entityId: "fixed_line",
        kind: "fixed",
        target: { entityId: "fixed_line", role: "start" },
        coordinate: [10, 10]
      },
      {
        id: "co_anchor_start",
        name: "Anchor start",
        sketchId: sketch.id,
        entityId: "anchor",
        kind: "coincident",
        primaryTarget: { entityId: "anchor", role: "position" },
        secondaryTarget: { entityId: "coincident_line", role: "start" }
      },
      {
        id: "co_left",
        name: "Left endpoint",
        sketchId: sketch.id,
        entityId: "left",
        kind: "coincident",
        primaryTarget: { entityId: "left", role: "position" },
        secondaryTarget: { entityId: "horizontal_line", role: "start" }
      },
      {
        id: "co_right",
        name: "Right endpoint",
        sketchId: sketch.id,
        entityId: "right",
        kind: "coincident",
        primaryTarget: { entityId: "right", role: "position" },
        secondaryTarget: { entityId: "horizontal_line", role: "end" }
      },
      {
        id: "con_horizontal",
        name: "Horizontal",
        sketchId: sketch.id,
        entityId: "horizontal_line",
        kind: "horizontal"
      }
    ];

    const evaluation = evaluateSketch(
      createDocument(sketch, dimensions, constraints),
      sketch
    );

    expect(evaluation.status).toBe("healthy");
    expect(evaluation.evaluatedGeometry.entities.get("fixed_line")).toEqual({
      id: "fixed_line",
      kind: "line",
      start: [10, 10],
      end: [13, 14]
    });
    expect(
      evaluation.evaluatedGeometry.entities.get("coincident_line")
    ).toEqual({
      id: "coincident_line",
      kind: "line",
      start: [5, 5],
      end: [5, 9]
    });
    expect(
      evaluation.evaluatedGeometry.entities.get("horizontal_line")
    ).toEqual({
      id: "horizontal_line",
      kind: "line",
      start: [2, 3],
      end: [8, 3]
    });
    expect(evaluation.dimensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "dim_fixed_length",
          status: "healthy",
          effectiveValue: 5
        }),
        expect.objectContaining({
          id: "dim_coincident_length",
          status: "healthy",
          effectiveValue: 4
        })
      ])
    );
  });

  it("reports anchored line length conflicts as structured inconsistencies", () => {
    const sketch = createSketch([
      { id: "line_1", kind: "line", start: [0, 0], end: [4, 0] }
    ]);
    const dimensions: SketchDimensionSnapshot[] = [
      {
        id: "dim_length",
        name: "Length",
        sketchId: sketch.id,
        entityId: "line_1",
        target: { entityKind: "line", role: "length" },
        valueSource: { type: "literal", value: 5 }
      }
    ];
    const constraints: SketchConstraintSnapshot[] = [
      {
        id: "fix_start",
        name: "Fixed start",
        sketchId: sketch.id,
        entityId: "line_1",
        kind: "fixed",
        target: { entityId: "line_1", role: "start" },
        coordinate: [0, 0]
      },
      {
        id: "fix_end",
        name: "Fixed end",
        sketchId: sketch.id,
        entityId: "line_1",
        kind: "fixed",
        target: { entityId: "line_1", role: "end" },
        coordinate: [3, 0]
      }
    ];

    const evaluation = evaluateSketch(
      createDocument(sketch, dimensions, constraints),
      sketch
    );

    expect(evaluation.status).toBe("inconsistent");
    expect(evaluation.dimensions).toEqual([
      expect.objectContaining({
        id: "dim_length",
        status: "inconsistent",
        issues: [
          expect.objectContaining({
            code: "INCONSISTENT_CONSTRAINT",
            expected: "5",
            received: "3"
          })
        ]
      })
    ]);
    expect(evaluation.constraints).toEqual([
      expect.objectContaining({ id: "fix_start", status: "healthy" }),
      expect.objectContaining({ id: "fix_end", status: "healthy" })
    ]);
  });

  it("keeps rectangle and circle center constraints compatible with dimensions", () => {
    const sketch = createSketch([
      {
        id: "rect_1",
        kind: "rectangle",
        center: [0, 0],
        width: 1,
        height: 1
      },
      { id: "circle_1", kind: "circle", center: [0, 0], radius: 1 },
      { id: "anchor", kind: "point", point: [4, 5] }
    ]);
    const dimensions: SketchDimensionSnapshot[] = [
      {
        id: "dim_width",
        name: "Width",
        sketchId: sketch.id,
        entityId: "rect_1",
        target: { entityKind: "rectangle", role: "width" },
        valueSource: { type: "literal", value: 7 }
      },
      {
        id: "dim_height",
        name: "Height",
        sketchId: sketch.id,
        entityId: "rect_1",
        target: { entityKind: "rectangle", role: "height" },
        valueSource: { type: "literal", value: 8 }
      },
      {
        id: "dim_radius",
        name: "Radius",
        sketchId: sketch.id,
        entityId: "circle_1",
        target: { entityKind: "circle", role: "radius" },
        valueSource: { type: "literal", value: 3 }
      }
    ];
    const constraints: SketchConstraintSnapshot[] = [
      {
        id: "fix_rect",
        name: "Fixed rectangle",
        sketchId: sketch.id,
        entityId: "rect_1",
        kind: "fixed",
        target: { entityId: "rect_1", role: "center" },
        coordinate: [2, 3]
      },
      {
        id: "co_circle_anchor",
        name: "Circle center",
        sketchId: sketch.id,
        entityId: "anchor",
        kind: "coincident",
        primaryTarget: { entityId: "anchor", role: "position" },
        secondaryTarget: { entityId: "circle_1", role: "center" }
      }
    ];

    const evaluation = evaluateSketch(
      createDocument(sketch, dimensions, constraints),
      sketch
    );

    expect(evaluation.status).toBe("healthy");
    expect(evaluation.evaluatedGeometry.entities.get("rect_1")).toMatchObject({
      kind: "rectangle",
      center: [2, 3],
      width: 7,
      height: 8
    });
    expect(evaluation.evaluatedGeometry.entities.get("circle_1")).toMatchObject(
      {
        kind: "circle",
        center: [4, 5],
        radius: 3
      }
    );
  });

  it("evaluates and applies fixed point constraints for explicit point targets", () => {
    const sketch = createSketch([
      { id: "point_1", kind: "point", point: [1, 2] },
      { id: "line_1", kind: "line", start: [0, 0], end: [4, 0] },
      {
        id: "rect_1",
        kind: "rectangle",
        center: [0, 0],
        width: 2,
        height: 3
      },
      { id: "circle_1", kind: "circle", center: [0, 0], radius: 2 }
    ]);
    const constraints: SketchConstraintSnapshot[] = [
      {
        id: "fix_point",
        name: "Fixed point",
        sketchId: sketch.id,
        entityId: "point_1",
        kind: "fixed",
        target: { entityId: "point_1", role: "position" },
        coordinate: [1, 2]
      },
      {
        id: "fix_start",
        name: "Fixed start",
        sketchId: sketch.id,
        entityId: "line_1",
        kind: "fixed",
        target: { entityId: "line_1", role: "start" },
        coordinate: [3, 4]
      },
      {
        id: "fix_rect",
        name: "Fixed rectangle center",
        sketchId: sketch.id,
        entityId: "rect_1",
        kind: "fixed",
        target: { entityId: "rect_1", role: "center" },
        coordinate: [5, 6]
      },
      {
        id: "fix_circle",
        name: "Fixed circle center",
        sketchId: sketch.id,
        entityId: "circle_1",
        kind: "fixed",
        target: { entityId: "circle_1", role: "center" },
        coordinate: [7, 8]
      }
    ];

    const evaluation = evaluateSketch(
      createDocument(sketch, [], constraints),
      sketch
    );

    expect(evaluation.status).toBe("healthy");
    expect(evaluation.constraints).toEqual([
      expect.objectContaining({
        id: "fix_point",
        status: "healthy",
        currentCoordinate: [1, 2]
      }),
      expect.objectContaining({
        id: "fix_start",
        status: "healthy",
        currentCoordinate: [3, 4]
      }),
      expect.objectContaining({
        id: "fix_rect",
        status: "healthy",
        currentCoordinate: [5, 6]
      }),
      expect.objectContaining({
        id: "fix_circle",
        status: "healthy",
        currentCoordinate: [7, 8]
      })
    ]);
    expect(evaluation.evaluatedGeometry.entities.get("line_1")).toMatchObject({
      kind: "line",
      start: [3, 4]
    });
    expect(evaluation.evaluatedGeometry.entities.get("rect_1")).toMatchObject({
      kind: "rectangle",
      center: [5, 6]
    });
    expect(evaluation.evaluatedGeometry.entities.get("circle_1")).toMatchObject(
      {
        kind: "circle",
        center: [7, 8]
      }
    );
  });

  it("reports fixed target missing, unsupported, and duplicate issues", () => {
    const sketch = createSketch([
      { id: "point_1", kind: "point", point: [1, 2] }
    ]);
    const constraints: SketchConstraintSnapshot[] = [
      {
        id: "fix_missing",
        name: "Missing",
        sketchId: sketch.id,
        entityId: "missing",
        kind: "fixed",
        target: { entityId: "missing", role: "position" },
        coordinate: [1, 2]
      },
      {
        id: "fix_bad_role",
        name: "Bad role",
        sketchId: sketch.id,
        entityId: "point_1",
        kind: "fixed",
        target: { entityId: "point_1", role: "start" },
        coordinate: [1, 2]
      },
      {
        id: "fix_point",
        name: "Fixed point",
        sketchId: sketch.id,
        entityId: "point_1",
        kind: "fixed",
        target: { entityId: "point_1", role: "position" },
        coordinate: [1, 2]
      },
      {
        id: "fix_duplicate",
        name: "Duplicate",
        sketchId: sketch.id,
        entityId: "point_1",
        kind: "fixed",
        target: { entityId: "point_1", role: "position" },
        coordinate: [1, 2]
      }
    ];

    const evaluation = evaluateSketch(
      createDocument(sketch, [], constraints),
      sketch
    );

    expect(evaluation.status).toBe("missing-target");
    expect(evaluation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SKETCH_ENTITY_NOT_FOUND" }),
        expect.objectContaining({ code: "UNSUPPORTED_TARGET" }),
        expect.objectContaining({ code: "CONFLICTING_CONSTRAINT" })
      ])
    );
  });

  it("evaluates coincident point constraints and moves the secondary target deterministically", () => {
    const sketch = createSketch([
      { id: "point_1", kind: "point", point: [1, 2] },
      { id: "line_1", kind: "line", start: [0, 0], end: [4, 0] },
      {
        id: "rect_1",
        kind: "rectangle",
        center: [5, 6],
        width: 2,
        height: 3
      },
      { id: "circle_1", kind: "circle", center: [0, 0], radius: 2 }
    ]);
    const constraints: SketchConstraintSnapshot[] = [
      {
        id: "co_point_end",
        name: "Point to line end",
        sketchId: sketch.id,
        entityId: "point_1",
        kind: "coincident",
        primaryTarget: { entityId: "point_1", role: "position" },
        secondaryTarget: { entityId: "line_1", role: "end" }
      },
      {
        id: "co_rect_circle",
        name: "Centers",
        sketchId: sketch.id,
        entityId: "rect_1",
        kind: "coincident",
        primaryTarget: { entityId: "rect_1", role: "center" },
        secondaryTarget: { entityId: "circle_1", role: "center" }
      }
    ];

    const evaluation = evaluateSketch(
      createDocument(sketch, [], constraints),
      sketch
    );

    expect(evaluation.status).toBe("healthy");
    expect(evaluation.drivenEntityIds).toEqual([
      "point_1",
      "line_1",
      "rect_1",
      "circle_1"
    ]);
    expect(evaluation.constraints).toEqual([
      expect.objectContaining({
        id: "co_point_end",
        kind: "coincident",
        primaryCurrentCoordinate: [1, 2],
        secondaryCurrentCoordinate: [1, 2],
        resolvedCoordinate: [1, 2],
        status: "healthy"
      }),
      expect.objectContaining({
        id: "co_rect_circle",
        kind: "coincident",
        primaryCurrentCoordinate: [5, 6],
        secondaryCurrentCoordinate: [5, 6],
        resolvedCoordinate: [5, 6],
        status: "healthy"
      })
    ]);
    expect(evaluation.evaluatedGeometry.entities.get("line_1")).toMatchObject({
      kind: "line",
      end: [1, 2]
    });
    expect(evaluation.evaluatedGeometry.entities.get("circle_1")).toMatchObject(
      {
        kind: "circle",
        center: [5, 6]
      }
    );
  });

  it("uses fixed coincident targets as the resolved coordinate and reports conflicting fixed targets", () => {
    const sketch = createSketch([
      { id: "point_1", kind: "point", point: [1, 2] },
      { id: "point_2", kind: "point", point: [0, 0] },
      { id: "point_3", kind: "point", point: [3, 3] }
    ]);
    const constraints: SketchConstraintSnapshot[] = [
      {
        id: "fix_point_1",
        name: "Fixed point 1",
        sketchId: sketch.id,
        entityId: "point_1",
        kind: "fixed",
        target: { entityId: "point_1", role: "position" },
        coordinate: [1, 2]
      },
      {
        id: "fix_point_3",
        name: "Fixed point 3",
        sketchId: sketch.id,
        entityId: "point_3",
        kind: "fixed",
        target: { entityId: "point_3", role: "position" },
        coordinate: [3, 3]
      },
      {
        id: "co_fixed",
        name: "Fixed wins",
        sketchId: sketch.id,
        entityId: "point_1",
        kind: "coincident",
        primaryTarget: { entityId: "point_1", role: "position" },
        secondaryTarget: { entityId: "point_2", role: "position" }
      },
      {
        id: "co_conflict",
        name: "Fixed conflict",
        sketchId: sketch.id,
        entityId: "point_1",
        kind: "coincident",
        primaryTarget: { entityId: "point_1", role: "position" },
        secondaryTarget: { entityId: "point_3", role: "position" }
      }
    ];

    const evaluation = evaluateSketch(
      createDocument(sketch, [], constraints),
      sketch
    );

    expect(evaluation.status).toBe("inconsistent");
    expect(evaluation.constraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "co_fixed",
          resolvedCoordinate: [1, 2]
        }),
        expect.objectContaining({
          id: "co_conflict",
          status: "inconsistent",
          issues: expect.arrayContaining([
            expect.objectContaining({ code: "INCONSISTENT_CONSTRAINT" })
          ])
        })
      ])
    );
    expect(evaluation.evaluatedGeometry.entities.get("point_2")).toMatchObject({
      kind: "point",
      point: [1, 2]
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

  it("evaluates midpoint constraints for point, rectangle, and circle center targets", () => {
    const sketch = createSketch([
      { id: "line_1", kind: "line", start: [0, 0], end: [4, 2] },
      { id: "point_1", kind: "point", point: [9, 9] },
      {
        id: "rect_1",
        kind: "rectangle",
        center: [5, 5],
        width: 2,
        height: 3
      },
      { id: "circle_1", kind: "circle", center: [-5, -5], radius: 1 }
    ]);
    const constraints: SketchConstraintSnapshot[] = [
      {
        id: "mid_point",
        name: "Point midpoint",
        sketchId: sketch.id,
        entityId: "line_1",
        kind: "midpoint",
        lineEntityId: "line_1",
        target: { entityId: "point_1", role: "position" }
      },
      {
        id: "mid_rect",
        name: "Rectangle midpoint",
        sketchId: sketch.id,
        entityId: "line_1",
        kind: "midpoint",
        lineEntityId: "line_1",
        target: { entityId: "rect_1", role: "center" }
      },
      {
        id: "mid_circle",
        name: "Circle midpoint",
        sketchId: sketch.id,
        entityId: "line_1",
        kind: "midpoint",
        lineEntityId: "line_1",
        target: { entityId: "circle_1", role: "center" }
      }
    ];

    const evaluation = evaluateSketch(
      createDocument(sketch, [], constraints),
      sketch
    );

    expect(evaluation.status).toBe("healthy");
    expect(evaluation.drivenEntityIds).toEqual([
      "line_1",
      "point_1",
      "rect_1",
      "circle_1"
    ]);
    expect(evaluation.evaluatedGeometry.entities.get("point_1")).toMatchObject({
      point: [2, 1]
    });
    expect(evaluation.evaluatedGeometry.entities.get("rect_1")).toMatchObject({
      center: [2, 1]
    });
    expect(evaluation.evaluatedGeometry.entities.get("circle_1")).toMatchObject(
      {
        center: [2, 1]
      }
    );
    expect(evaluation.constraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "mid_point",
          kind: "midpoint",
          lineEntityId: "line_1",
          currentCoordinate: [2, 1],
          resolvedCoordinate: [2, 1],
          status: "healthy"
        })
      ])
    );
  });

  it("reports midpoint conflicts with fixed target coordinates", () => {
    const sketch = createSketch([
      { id: "line_1", kind: "line", start: [0, 0], end: [4, 2] },
      { id: "point_1", kind: "point", point: [9, 9] }
    ]);
    const constraints: SketchConstraintSnapshot[] = [
      {
        id: "fix_point",
        name: "Fixed point",
        sketchId: sketch.id,
        entityId: "point_1",
        kind: "fixed",
        target: { entityId: "point_1", role: "position" },
        coordinate: [9, 9]
      },
      {
        id: "mid_point",
        name: "Point midpoint",
        sketchId: sketch.id,
        entityId: "line_1",
        kind: "midpoint",
        lineEntityId: "line_1",
        target: { entityId: "point_1", role: "position" }
      }
    ];

    const evaluation = evaluateSketch(
      createDocument(sketch, [], constraints),
      sketch
    );

    expect(evaluation.status).toBe("inconsistent");
    expect(evaluation.constraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "mid_point",
          status: "inconsistent",
          issues: expect.arrayContaining([
            expect.objectContaining({
              code: "INCONSISTENT_CONSTRAINT",
              lineEntityId: "line_1"
            })
          ])
        })
      ])
    );
  });
});
