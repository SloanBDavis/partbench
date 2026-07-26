import { describe, expect, it } from "vitest";
import type {
  SketchDimensionSnapshotV22,
  SketchEntitySnapshot
} from "@web-cad/cad-protocol";
import {
  createSketchSolveModelFromCadSource,
  type SketchSolverPackageDocument,
  type SketchSolverPackageSketch
} from "./sketchSolverPackageMapping";

function line(
  id: string,
  start: readonly [number, number],
  end: readonly [number, number]
): SketchEntitySnapshot {
  return { id, kind: "line", start, end, construction: false };
}

function dimension(
  id: string,
  target: SketchDimensionSnapshotV22["target"],
  value = 1
): SketchDimensionSnapshotV22 {
  return {
    id,
    name: id,
    sketchId: "sketch_1",
    target,
    valueSource: { type: "literal", value }
  };
}

function build(
  dimensions: readonly SketchDimensionSnapshotV22[],
  entities: readonly SketchEntitySnapshot[] = sourceEntities
) {
  const document: SketchSolverPackageDocument = {
    parameters: new Map(),
    sketchDimensions: new Map(
      dimensions.map((entry) => [entry.id, entry] as const)
    ),
    sketchConstraints: new Map()
  };
  const sketch: SketchSolverPackageSketch = {
    id: "sketch_1",
    name: "V19 dimensions",
    plane: "XY",
    entities: new Map(entities.map((entity) => [entity.id, entity] as const))
  };
  return createSketchSolveModelFromCadSource(document, sketch);
}

const sourceEntities: readonly SketchEntitySnapshot[] = [
  { id: "point_1", kind: "point", point: [3, 4], construction: false },
  line("line_x", [0, 0], [10, 0]),
  line("line_y", [0, 0], [0, 10]),
  {
    id: "rectangle_1",
    kind: "rectangle",
    center: [5, 5],
    width: 8,
    height: 6,
    construction: false
  },
  {
    id: "circle_1",
    kind: "circle",
    center: [8, 4],
    radius: 2,
    construction: false
  },
  {
    id: "arc_1",
    kind: "arc",
    center: [12, 4],
    radius: 3,
    startAngleDegrees: 0,
    sweepAngleDegrees: 90,
    construction: false
  }
];

describe("V19 normalized CAD-to-solver dimension mapping", () => {
  it("maps scalar radius, diameter, length, and sweep targets with exact diameter conversion", () => {
    const result = build([
      dimension(
        "dim_line",
        {
          kind: "entityScalar",
          entityId: "line_x",
          entityKind: "line",
          role: "length"
        },
        10
      ),
      dimension(
        "dim_circle_radius",
        {
          kind: "entityScalar",
          entityId: "circle_1",
          entityKind: "circle",
          role: "radius"
        },
        2
      ),
      dimension(
        "dim_circle_diameter",
        {
          kind: "entityScalar",
          entityId: "circle_1",
          entityKind: "circle",
          role: "diameter"
        },
        4
      ),
      dimension(
        "dim_arc_radius",
        {
          kind: "entityScalar",
          entityId: "arc_1",
          entityKind: "arc",
          role: "radius"
        },
        3
      ),
      dimension(
        "dim_arc_diameter",
        {
          kind: "entityScalar",
          entityId: "arc_1",
          entityKind: "arc",
          role: "diameter"
        },
        6
      ),
      dimension(
        "dim_arc_sweep",
        {
          kind: "entityScalar",
          entityId: "arc_1",
          entityKind: "arc",
          role: "sweep"
        },
        90
      )
    ]);

    expect(result.model.dimensions).toEqual([
      {
        id: "dim_line",
        kind: "lineLength",
        startPointId: "line_x:start",
        endPointId: "line_x:end",
        value: 10
      },
      {
        id: "dim_circle_radius",
        kind: "circleRadius",
        radiusId: "circle_1:radius",
        value: 2
      },
      {
        id: "dim_circle_diameter",
        kind: "circleRadius",
        radiusId: "circle_1:radius",
        value: 2
      },
      {
        id: "dim_arc_radius",
        kind: "arcRadius",
        arcId: "arc_1",
        value: 3
      },
      {
        id: "dim_arc_diameter",
        kind: "arcRadius",
        arcId: "arc_1",
        value: 3
      },
      {
        id: "dim_arc_sweep",
        kind: "arcSweep",
        arcId: "arc_1",
        value: 90
      }
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it("maps every normalized point target kind, including derived arc points", () => {
    const result = build([
      dimension("dim_point_line", {
        kind: "pointPair",
        primary: {
          entityId: "point_1",
          entityKind: "point",
          role: "position"
        },
        secondary: {
          entityId: "line_x",
          entityKind: "line",
          role: "end"
        },
        measurement: "distance"
      }),
      dimension("dim_rectangle_circle", {
        kind: "pointPair",
        primary: {
          entityId: "rectangle_1",
          entityKind: "rectangle",
          role: "center"
        },
        secondary: {
          entityId: "circle_1",
          entityKind: "circle",
          role: "center"
        },
        measurement: "distance"
      }),
      dimension("dim_arc_center_start", {
        kind: "pointPair",
        primary: {
          entityId: "arc_1",
          entityKind: "arc",
          role: "center"
        },
        secondary: {
          entityId: "arc_1",
          entityKind: "arc",
          role: "start"
        },
        measurement: "distance"
      }),
      dimension("dim_arc_end_line_start", {
        kind: "pointPair",
        primary: {
          entityId: "arc_1",
          entityKind: "arc",
          role: "end"
        },
        secondary: {
          entityId: "line_y",
          entityKind: "line",
          role: "start"
        },
        measurement: "distance"
      })
    ]);

    expect(result.model.dimensions).toMatchObject([
      {
        kind: "pointDistance",
        primaryTarget: { kind: "point", pointId: "point_1:position" },
        secondaryTarget: { kind: "point", pointId: "line_x:end" }
      },
      {
        kind: "pointDistance",
        primaryTarget: { kind: "point", pointId: "rectangle_1:center" },
        secondaryTarget: { kind: "point", pointId: "circle_1:center" }
      },
      {
        kind: "pointDistance",
        primaryTarget: { kind: "arc", arcId: "arc_1", role: "center" },
        secondaryTarget: { kind: "arc", arcId: "arc_1", role: "start" }
      },
      {
        kind: "pointDistance",
        primaryTarget: { kind: "arc", arcId: "arc_1", role: "end" },
        secondaryTarget: { kind: "point", pointId: "line_y:start" }
      }
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it("maps directed components, point-line side, and line-angle sense without losing authored branches", () => {
    const result = build([
      dimension(
        "dim_horizontal_negative",
        {
          kind: "pointPair",
          primary: {
            entityId: "line_x",
            entityKind: "line",
            role: "start"
          },
          secondary: {
            entityId: "point_1",
            entityKind: "point",
            role: "position"
          },
          measurement: "horizontal",
          direction: "negative"
        },
        3
      ),
      dimension(
        "dim_vertical_positive",
        {
          kind: "pointPair",
          primary: {
            entityId: "line_x",
            entityKind: "line",
            role: "start"
          },
          secondary: {
            entityId: "point_1",
            entityKind: "point",
            role: "position"
          },
          measurement: "vertical",
          direction: "positive"
        },
        4
      ),
      dimension(
        "dim_point_line",
        {
          kind: "pointLineDistance",
          point: {
            entityId: "point_1",
            entityKind: "point",
            role: "position"
          },
          lineEntityId: "line_x",
          side: "left"
        },
        4
      ),
      dimension(
        "dim_angle",
        {
          kind: "lineAngle",
          primaryLineEntityId: "line_x",
          secondaryLineEntityId: "line_y",
          sense: "counterclockwise"
        },
        90
      )
    ]);

    expect(result.model.dimensions).toEqual([
      {
        id: "dim_horizontal_negative",
        kind: "pointComponent",
        primaryTarget: { kind: "point", pointId: "line_x:start" },
        secondaryTarget: { kind: "point", pointId: "point_1:position" },
        axis: "horizontal",
        value: -3
      },
      {
        id: "dim_vertical_positive",
        kind: "pointComponent",
        primaryTarget: { kind: "point", pointId: "line_x:start" },
        secondaryTarget: { kind: "point", pointId: "point_1:position" },
        axis: "vertical",
        value: 4
      },
      {
        id: "dim_point_line",
        kind: "pointLineDistance",
        pointTarget: { kind: "point", pointId: "point_1:position" },
        lineTarget: {
          kind: "line",
          startPointId: "line_x:start",
          endPointId: "line_x:end"
        },
        side: "left",
        value: 4
      },
      {
        id: "dim_angle",
        kind: "lineAngle",
        primaryLineTarget: {
          kind: "line",
          startPointId: "line_x:start",
          endPointId: "line_x:end"
        },
        secondaryLineTarget: {
          kind: "line",
          startPointId: "line_y:start",
          endPointId: "line_y:end"
        },
        sense: "counterclockwise",
        value: 90
      }
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it("keeps rectangle width and height honest as direct source-backed updates", () => {
    const result = build([
      dimension("dim_width", {
        kind: "entityScalar",
        entityId: "rectangle_1",
        entityKind: "rectangle",
        role: "width"
      })
    ]);

    expect(result.model.dimensions).toEqual([]);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "SKETCH_SOLVER_UNSUPPORTED_ENTITY",
        severity: "info",
        sketchDimensionId: "dim_width",
        sketchEntityId: "rectangle_1",
        received: "rectangle.width"
      })
    ]);
  });

  it("emits blocker diagnostics for missing, mismatched, and zero-length targets", () => {
    const result = build(
      [
        dimension("dim_missing", {
          kind: "pointPair",
          primary: {
            entityId: "missing",
            entityKind: "point",
            role: "position"
          },
          secondary: {
            entityId: "point_1",
            entityKind: "point",
            role: "position"
          },
          measurement: "distance"
        }),
        dimension("dim_mismatch", {
          kind: "entityScalar",
          entityId: "circle_1",
          entityKind: "line",
          role: "length"
        }),
        dimension("dim_zero_line", {
          kind: "lineAngle",
          primaryLineEntityId: "line_zero",
          secondaryLineEntityId: "line_y",
          sense: "counterclockwise"
        })
      ],
      [...sourceEntities, line("line_zero", [2, 2], [2, 2])]
    );

    expect(result.model.dimensions).toEqual([]);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SKETCH_SOLVER_MISSING_TARGET",
          severity: "blocker",
          sketchDimensionId: "dim_missing",
          sketchEntityId: "missing",
          received: "missing"
        }),
        expect.objectContaining({
          code: "SKETCH_SOLVER_MISSING_TARGET",
          severity: "blocker",
          sketchDimensionId: "dim_mismatch",
          sketchEntityId: "circle_1",
          expected: "line.length",
          received: "circle"
        }),
        expect.objectContaining({
          code: "SKETCH_SOLVER_MISSING_TARGET",
          severity: "blocker",
          sketchDimensionId: "dim_zero_line",
          sketchEntityId: "line_zero"
        })
      ])
    );
  });
});
