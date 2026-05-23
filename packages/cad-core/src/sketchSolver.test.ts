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

    expect(evaluation.status).toBe("inconsistent");
    expect(evaluation.constraints).toEqual([
      expect.objectContaining({
        id: "fix_point",
        status: "healthy",
        currentCoordinate: [1, 2]
      }),
      expect.objectContaining({
        id: "fix_start",
        status: "inconsistent",
        currentCoordinate: [0, 0]
      }),
      expect.objectContaining({
        id: "fix_rect",
        status: "inconsistent",
        currentCoordinate: [0, 0]
      }),
      expect.objectContaining({
        id: "fix_circle",
        status: "inconsistent",
        currentCoordinate: [0, 0]
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

    expect(evaluation.status).toBe("inconsistent");
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
        secondaryCurrentCoordinate: [4, 0],
        resolvedCoordinate: [1, 2],
        status: "inconsistent"
      }),
      expect.objectContaining({
        id: "co_rect_circle",
        kind: "coincident",
        primaryCurrentCoordinate: [5, 6],
        secondaryCurrentCoordinate: [0, 0],
        resolvedCoordinate: [5, 6],
        status: "inconsistent"
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
});
