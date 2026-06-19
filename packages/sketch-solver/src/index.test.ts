import { describe, expect, it } from "vitest";
import {
  SKETCH_SOLVER_MODEL_VERSION,
  getSketchSolverCapabilities,
  sketchSolverPackage,
  solveSketch,
  type SketchSolveModel,
  type SketchSolvePointResult
} from "./index";

function point(
  points: readonly SketchSolvePointResult[],
  id: string
): readonly [number, number] {
  const found = points.find((candidate) => candidate.id === id);

  if (!found) {
    throw new Error(`Missing point result: ${id}`);
  }

  return found.value;
}

function expectPointCloseTo(
  points: readonly SketchSolvePointResult[],
  id: string,
  expected: readonly [number, number],
  precision = 6
): void {
  const actual = point(points, id);
  expect(actual[0]).toBeCloseTo(expected[0], precision);
  expect(actual[1]).toBeCloseTo(expected[1], precision);
}

function scalarValue(
  scalars: readonly { readonly id: string; readonly value: number }[],
  id: string
): number {
  const found = scalars.find((candidate) => candidate.id === id);

  if (!found) {
    throw new Error(`Missing scalar result: ${id}`);
  }

  return found.value;
}

describe("sketch-solver", () => {
  it("exports package status and capabilities without external authority", () => {
    expect(sketchSolverPackage).toEqual({
      name: "@web-cad/sketch-solver",
      status: "foundation",
      modelVersion: SKETCH_SOLVER_MODEL_VERSION
    });
    expect(getSketchSolverCapabilities()).toMatchObject({
      modelVersion: SKETCH_SOLVER_MODEL_VERSION,
      supportedConstraintKinds: [
        "fixedPoint",
        "coincident",
        "horizontal",
        "vertical",
        "midpoint",
        "parallel",
        "perpendicular",
        "concentric",
        "equalRadius"
      ],
      supportedDimensionKinds: ["pointDistance", "lineLength", "circleRadius"],
      deferredConstraintKinds: expect.arrayContaining([
        "tangent",
        "equalLength",
        "angle",
        "symmetry"
      ])
    });
    expect(getSketchSolverCapabilities().deferredConstraintKinds).not.toEqual(
      expect.arrayContaining([
        "parallel",
        "perpendicular",
        "concentric",
        "equalRadius"
      ])
    );
  });

  it("solves a fixed point and does not mutate input", () => {
    const model: SketchSolveModel = {
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [{ id: "p1", initial: [4, -2] }],
      constraints: [
        { id: "fixed_p1", kind: "fixedPoint", pointId: "p1", value: [1, 2] }
      ]
    };
    const before = JSON.parse(JSON.stringify(model));

    const result = solveSketch(model);

    expect(result.status).toBe("converged");
    expect(result.converged).toBe(true);
    expect(result.variableCount).toBe(2);
    expect(result.residualCount).toBe(2);
    expect(result.maxResidual).toBeLessThanOrEqual(result.settings.tolerance);
    expectPointCloseTo(result.points, "p1", [1, 2]);
    expect(model).toEqual(before);
  });

  it("solves coincident points as an under-defined but converged model", () => {
    const result = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [
        { id: "a", initial: [0, 0] },
        { id: "b", initial: [4, 2] }
      ],
      constraints: [
        {
          id: "coincident_ab",
          kind: "coincident",
          pointAId: "a",
          pointBId: "b"
        }
      ]
    });

    const a = point(result.points, "a");
    const b = point(result.points, "b");
    expect(result.status).toBe("under-defined");
    expect(result.converged).toBe(true);
    expect(a[0]).toBeCloseTo(b[0], 6);
    expect(a[1]).toBeCloseTo(b[1], 6);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SKETCH_SOLVER_UNDER_DEFINED" })
      ])
    );
  });

  it("solves horizontal and vertical line orientation constraints", () => {
    const horizontal = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [
        { id: "h0", initial: [0, 0] },
        { id: "h1", initial: [3, 5] }
      ],
      constraints: [
        { id: "fix_h0", kind: "fixedPoint", pointId: "h0", value: [0, 0] },
        {
          id: "horizontal_h",
          kind: "horizontal",
          startPointId: "h0",
          endPointId: "h1"
        }
      ]
    });
    const vertical = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [
        { id: "v0", initial: [0, 0] },
        { id: "v1", initial: [4, 2] }
      ],
      constraints: [
        { id: "fix_v0", kind: "fixedPoint", pointId: "v0", value: [0, 0] },
        {
          id: "vertical_v",
          kind: "vertical",
          startPointId: "v0",
          endPointId: "v1"
        }
      ]
    });

    expect(horizontal.status).toBe("under-defined");
    expect(vertical.status).toBe("under-defined");
    expect(point(horizontal.points, "h1")[1]).toBeCloseTo(0, 6);
    expect(point(vertical.points, "v1")[0]).toBeCloseTo(0, 6);
  });

  it("solves parallel line-pair constraints with fixed anchors and a line length", () => {
    const result = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [
        { id: "primary_start", initial: [0, 0] },
        { id: "primary_end", initial: [4, 0] },
        { id: "secondary_start", initial: [0, 1] },
        { id: "secondary_end", initial: [2, 3] }
      ],
      constraints: [
        {
          id: "fix_primary_start",
          kind: "fixedPoint",
          pointId: "primary_start",
          value: [0, 0]
        },
        {
          id: "fix_primary_end",
          kind: "fixedPoint",
          pointId: "primary_end",
          value: [4, 0]
        },
        {
          id: "fix_secondary_start",
          kind: "fixedPoint",
          pointId: "secondary_start",
          value: [0, 1]
        },
        {
          id: "parallel_lines",
          kind: "parallel",
          primaryStartPointId: "primary_start",
          primaryEndPointId: "primary_end",
          secondaryStartPointId: "secondary_start",
          secondaryEndPointId: "secondary_end"
        }
      ],
      dimensions: [
        {
          id: "secondary_length",
          kind: "lineLength",
          startPointId: "secondary_start",
          endPointId: "secondary_end",
          value: 3
        }
      ]
    });

    const start = point(result.points, "secondary_start");
    const end = point(result.points, "secondary_end");
    expect(result.status).toBe("converged");
    expect(result.maxResidual).toBeLessThanOrEqual(result.settings.tolerance);
    expect(end[1]).toBeCloseTo(start[1], 6);
    expect(Math.hypot(end[0] - start[0], end[1] - start[1])).toBeCloseTo(3, 6);
  });

  it("solves perpendicular line-pair constraints with fixed anchors and a line length", () => {
    const result = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [
        { id: "primary_start", initial: [0, 0] },
        { id: "primary_end", initial: [4, 0] },
        { id: "secondary_start", initial: [1, 1] },
        { id: "secondary_end", initial: [3, 3] }
      ],
      constraints: [
        {
          id: "fix_primary_start",
          kind: "fixedPoint",
          pointId: "primary_start",
          value: [0, 0]
        },
        {
          id: "fix_primary_end",
          kind: "fixedPoint",
          pointId: "primary_end",
          value: [4, 0]
        },
        {
          id: "fix_secondary_start",
          kind: "fixedPoint",
          pointId: "secondary_start",
          value: [1, 1]
        },
        {
          id: "perpendicular_lines",
          kind: "perpendicular",
          primaryStartPointId: "primary_start",
          primaryEndPointId: "primary_end",
          secondaryStartPointId: "secondary_start",
          secondaryEndPointId: "secondary_end"
        }
      ],
      dimensions: [
        {
          id: "secondary_length",
          kind: "lineLength",
          startPointId: "secondary_start",
          endPointId: "secondary_end",
          value: 2
        }
      ]
    });

    const start = point(result.points, "secondary_start");
    const end = point(result.points, "secondary_end");
    expect(result.status).toBe("converged");
    expect(result.maxResidual).toBeLessThanOrEqual(result.settings.tolerance);
    expect(end[0]).toBeCloseTo(start[0], 6);
    expect(Math.hypot(end[0] - start[0], end[1] - start[1])).toBeCloseTo(2, 6);
  });

  it("solves line length and point distance dimensions", () => {
    const line = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [
        { id: "start", initial: [0, 0] },
        { id: "end", initial: [2, 2] }
      ],
      constraints: [
        {
          id: "fix_start",
          kind: "fixedPoint",
          pointId: "start",
          value: [0, 0]
        },
        {
          id: "horizontal_line",
          kind: "horizontal",
          startPointId: "start",
          endPointId: "end"
        }
      ],
      dimensions: [
        {
          id: "line_length",
          kind: "lineLength",
          startPointId: "start",
          endPointId: "end",
          value: 5
        }
      ]
    });
    const distance = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [
        { id: "a", initial: [0, 0] },
        { id: "b", initial: [1, 0] }
      ],
      dimensions: [
        {
          id: "distance_ab",
          kind: "pointDistance",
          pointAId: "a",
          pointBId: "b",
          value: 4
        }
      ]
    });

    expect(line.status).toBe("converged");
    expectPointCloseTo(line.points, "start", [0, 0]);
    expectPointCloseTo(line.points, "end", [5, 0]);

    const a = point(distance.points, "a");
    const b = point(distance.points, "b");
    expect(distance.status).toBe("under-defined");
    expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeCloseTo(4, 6);
  });

  it("solves circle radius scalar dimensions", () => {
    const result = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [],
      scalars: [{ id: "circle_1_radius", initial: 1 }],
      dimensions: [
        {
          id: "radius_dim",
          kind: "circleRadius",
          radiusId: "circle_1_radius",
          value: 3
        }
      ]
    });

    expect(result.status).toBe("converged");
    expect(result.scalars).toHaveLength(1);
    expect(result.scalars[0]?.id).toBe("circle_1_radius");
    expect(result.scalars[0]?.value).toBeCloseTo(3, 6);
  });

  it("solves concentric circle center constraints", () => {
    const result = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [
        { id: "circle_a_center", initial: [0, 0] },
        { id: "circle_b_center", initial: [3, 2] }
      ],
      constraints: [
        {
          id: "fix_circle_a",
          kind: "fixedPoint",
          pointId: "circle_a_center",
          value: [0, 0]
        },
        {
          id: "concentric_ab",
          kind: "concentric",
          primaryCenterPointId: "circle_a_center",
          secondaryCenterPointId: "circle_b_center"
        }
      ]
    });

    expect(result.status).toBe("converged");
    expectPointCloseTo(result.points, "circle_a_center", [0, 0]);
    expectPointCloseTo(result.points, "circle_b_center", [0, 0]);
    expect(result.maxResidual).toBeLessThanOrEqual(result.settings.tolerance);
  });

  it("solves equal-radius circle scalar constraints", () => {
    const result = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [],
      scalars: [
        { id: "circle_a_radius", initial: 2 },
        { id: "circle_b_radius", initial: 5 }
      ],
      constraints: [
        {
          id: "equal_radius_ab",
          kind: "equalRadius",
          primaryRadiusId: "circle_a_radius",
          secondaryRadiusId: "circle_b_radius"
        }
      ],
      dimensions: [
        {
          id: "circle_a_radius_dim",
          kind: "circleRadius",
          radiusId: "circle_a_radius",
          value: 4
        }
      ]
    });

    expect(result.status).toBe("converged");
    expect(result.scalars).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "circle_a_radius", value: 4 }),
        expect.objectContaining({ id: "circle_b_radius", value: 4 })
      ])
    );
  });

  it("solves combined concentric and equal-radius circle constraints deterministically", () => {
    const model: SketchSolveModel = {
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [
        { id: "circle_a_center", initial: [0, 0] },
        { id: "circle_b_center", initial: [5, 1] }
      ],
      scalars: [
        { id: "circle_a_radius", initial: 1 },
        { id: "circle_b_radius", initial: 3 }
      ],
      constraints: [
        {
          id: "fix_circle_a",
          kind: "fixedPoint",
          pointId: "circle_a_center",
          value: [2, 2]
        },
        {
          id: "concentric_ab",
          kind: "concentric",
          primaryCenterPointId: "circle_a_center",
          secondaryCenterPointId: "circle_b_center"
        },
        {
          id: "equal_radius_ab",
          kind: "equalRadius",
          primaryRadiusId: "circle_a_radius",
          secondaryRadiusId: "circle_b_radius"
        }
      ],
      dimensions: [
        {
          id: "circle_a_radius_dim",
          kind: "circleRadius",
          radiusId: "circle_a_radius",
          value: 6
        }
      ]
    };

    const first = solveSketch(model);
    const second = solveSketch(model);

    expect(first.status).toBe("converged");
    expect(second.status).toBe("converged");
    expect(first.points).toEqual(second.points);
    expect(first.scalars).toEqual(second.scalars);
    expectPointCloseTo(first.points, "circle_a_center", [2, 2]);
    expectPointCloseTo(first.points, "circle_b_center", [2, 2]);
    expect(scalarValue(first.scalars, "circle_a_radius")).toBeCloseTo(6, 6);
    expect(scalarValue(first.scalars, "circle_b_radius")).toBeCloseTo(6, 6);
  });

  it("solves midpoint constraints", () => {
    const result = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [
        { id: "start", initial: [0, 0] },
        { id: "end", initial: [4, 0] },
        { id: "mid", initial: [7, 5] }
      ],
      constraints: [
        {
          id: "fix_start",
          kind: "fixedPoint",
          pointId: "start",
          value: [0, 0]
        },
        { id: "fix_end", kind: "fixedPoint", pointId: "end", value: [4, 0] },
        {
          id: "midpoint",
          kind: "midpoint",
          midpointId: "mid",
          startPointId: "start",
          endPointId: "end"
        }
      ]
    });

    expect(result.status).toBe("converged");
    expectPointCloseTo(result.points, "mid", [2, 0]);
  });

  it("is deterministic across repeated combined solves", () => {
    const model: SketchSolveModel = {
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [
        { id: "start", initial: [1, 2] },
        { id: "end", initial: [4, 4] }
      ],
      constraints: [
        {
          id: "fix_start",
          kind: "fixedPoint",
          pointId: "start",
          value: [0, 0]
        },
        {
          id: "horizontal",
          kind: "horizontal",
          startPointId: "start",
          endPointId: "end"
        }
      ],
      dimensions: [
        {
          id: "length",
          kind: "lineLength",
          startPointId: "start",
          endPointId: "end",
          value: 6
        }
      ]
    };

    const first = solveSketch(model);
    const second = solveSketch(model);

    expect(first.status).toBe("converged");
    expect(second.status).toBe("converged");
    expect(first.points).toEqual(second.points);
    expect(first.maxResidual).toBe(second.maxResidual);
    expect(first.iterations).toBe(second.iterations);
    expectPointCloseTo(first.points, "start", [0, 0]);
    expectPointCloseTo(first.points, "end", [6, 0]);
  });

  it("reports missing targets and invalid values as structured failures", () => {
    const missing = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [{ id: "p1", initial: [0, 0] }],
      constraints: [
        {
          id: "coincident_missing",
          kind: "coincident",
          pointAId: "p1",
          pointBId: "missing"
        }
      ]
    });
    const invalid = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [
        { id: "a", initial: [0, 0] },
        { id: "b", initial: [1, 0] }
      ],
      dimensions: [
        {
          id: "invalid_length",
          kind: "pointDistance",
          pointAId: "a",
          pointBId: "b",
          value: -2
        }
      ]
    });

    expect(missing.status).toBe("failed");
    expect(missing.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SKETCH_SOLVER_MISSING_TARGET",
          sourceType: "constraint",
          sourceId: "coincident_missing",
          targetId: "missing"
        })
      ])
    );
    expect(invalid.status).toBe("failed");
    expect(invalid.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SKETCH_SOLVER_INVALID_VALUE",
          sourceType: "dimension",
          sourceId: "invalid_length"
        })
      ])
    );
  });

  it("reports conflicting constraints without silently accepting them", () => {
    const result = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [{ id: "p1", initial: [0.25, 0] }],
      constraints: [
        { id: "fix_origin", kind: "fixedPoint", pointId: "p1", value: [0, 0] },
        { id: "fix_unit", kind: "fixedPoint", pointId: "p1", value: [1, 0] }
      ],
      settings: { maxIterations: 20 }
    });

    expect(result.status).toBe("conflicting");
    expect(result.converged).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SKETCH_SOLVER_CONFLICTING" })
      ])
    );
  });

  it("reports conflicting fixed line-pair constraints structurally", () => {
    const result = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [
        { id: "primary_start", initial: [0, 0] },
        { id: "primary_end", initial: [4, 0] },
        { id: "secondary_start", initial: [0, 1] },
        { id: "secondary_end", initial: [0, 4] }
      ],
      constraints: [
        {
          id: "fix_primary_start",
          kind: "fixedPoint",
          pointId: "primary_start",
          value: [0, 0]
        },
        {
          id: "fix_primary_end",
          kind: "fixedPoint",
          pointId: "primary_end",
          value: [4, 0]
        },
        {
          id: "fix_secondary_start",
          kind: "fixedPoint",
          pointId: "secondary_start",
          value: [0, 1]
        },
        {
          id: "fix_secondary_end",
          kind: "fixedPoint",
          pointId: "secondary_end",
          value: [0, 4]
        },
        {
          id: "parallel_conflict",
          kind: "parallel",
          primaryStartPointId: "primary_start",
          primaryEndPointId: "primary_end",
          secondaryStartPointId: "secondary_start",
          secondaryEndPointId: "secondary_end"
        }
      ],
      settings: { maxIterations: 20 }
    });

    expect(result.status).toBe("conflicting");
    expect(result.converged).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SKETCH_SOLVER_CONFLICTING" })
      ])
    );
  });

  it("reports conflicting fixed concentric and equal-radius constraints structurally", () => {
    const concentricConflict = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [
        { id: "circle_a_center", initial: [0, 0] },
        { id: "circle_b_center", initial: [2, 0] }
      ],
      constraints: [
        {
          id: "fix_circle_a",
          kind: "fixedPoint",
          pointId: "circle_a_center",
          value: [0, 0]
        },
        {
          id: "fix_circle_b",
          kind: "fixedPoint",
          pointId: "circle_b_center",
          value: [2, 0]
        },
        {
          id: "concentric_conflict",
          kind: "concentric",
          primaryCenterPointId: "circle_a_center",
          secondaryCenterPointId: "circle_b_center"
        }
      ],
      settings: { maxIterations: 20 }
    });
    const equalRadiusConflict = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [],
      scalars: [
        { id: "circle_a_radius", initial: 1 },
        { id: "circle_b_radius", initial: 2 }
      ],
      constraints: [
        {
          id: "equal_radius_conflict",
          kind: "equalRadius",
          primaryRadiusId: "circle_a_radius",
          secondaryRadiusId: "circle_b_radius"
        }
      ],
      dimensions: [
        {
          id: "circle_a_radius_dim",
          kind: "circleRadius",
          radiusId: "circle_a_radius",
          value: 1
        },
        {
          id: "circle_b_radius_dim",
          kind: "circleRadius",
          radiusId: "circle_b_radius",
          value: 2
        }
      ],
      settings: { maxIterations: 20 }
    });

    expect(concentricConflict.status).toBe("conflicting");
    expect(equalRadiusConflict.status).toBe("conflicting");
    expect(concentricConflict.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SKETCH_SOLVER_CONFLICTING" })
      ])
    );
    expect(equalRadiusConflict.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SKETCH_SOLVER_CONFLICTING" })
      ])
    );
  });

  it("reports missing and zero-length line-pair targets as structured failures", () => {
    const missing = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [
        { id: "primary_start", initial: [0, 0] },
        { id: "primary_end", initial: [4, 0] },
        { id: "secondary_start", initial: [0, 1] }
      ],
      constraints: [
        {
          id: "parallel_missing",
          kind: "parallel",
          primaryStartPointId: "primary_start",
          primaryEndPointId: "primary_end",
          secondaryStartPointId: "secondary_start",
          secondaryEndPointId: "missing"
        }
      ]
    });
    const zeroLength = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [
        { id: "primary_start", initial: [0, 0] },
        { id: "primary_end", initial: [0, 0] },
        { id: "secondary_start", initial: [0, 1] },
        { id: "secondary_end", initial: [2, 1] }
      ],
      constraints: [
        {
          id: "perpendicular_zero_length",
          kind: "perpendicular",
          primaryStartPointId: "primary_start",
          primaryEndPointId: "primary_end",
          secondaryStartPointId: "secondary_start",
          secondaryEndPointId: "secondary_end"
        }
      ]
    });

    expect(missing.status).toBe("failed");
    expect(missing.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SKETCH_SOLVER_MISSING_TARGET",
          sourceType: "constraint",
          sourceId: "parallel_missing",
          targetId: "missing"
        })
      ])
    );
    expect(zeroLength.status).toBe("failed");
    expect(zeroLength.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SKETCH_SOLVER_INVALID_VALUE",
          sourceType: "constraint",
          sourceId: "perpendicular_zero_length",
          constraintKind: "perpendicular"
        })
      ])
    );
  });

  it("reports missing and invalid circle-pair targets as structured failures", () => {
    const missing = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [{ id: "circle_a_center", initial: [0, 0] }],
      constraints: [
        {
          id: "concentric_missing",
          kind: "concentric",
          primaryCenterPointId: "circle_a_center",
          secondaryCenterPointId: "missing"
        }
      ]
    });
    const invalidRadius = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [],
      scalars: [
        { id: "circle_a_radius", initial: 1 },
        { id: "circle_b_radius", initial: 0 }
      ],
      constraints: [
        {
          id: "equal_radius_invalid",
          kind: "equalRadius",
          primaryRadiusId: "circle_a_radius",
          secondaryRadiusId: "circle_b_radius"
        }
      ]
    });
    const missingRadius = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [],
      scalars: [{ id: "circle_a_radius", initial: 1 }],
      constraints: [
        {
          id: "equal_radius_missing",
          kind: "equalRadius",
          primaryRadiusId: "circle_a_radius",
          secondaryRadiusId: "missing"
        }
      ]
    });

    expect(missing.status).toBe("failed");
    expect(missing.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SKETCH_SOLVER_MISSING_TARGET",
          sourceType: "constraint",
          sourceId: "concentric_missing",
          targetId: "missing"
        })
      ])
    );
    expect(invalidRadius.status).toBe("failed");
    expect(invalidRadius.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SKETCH_SOLVER_INVALID_VALUE",
          sourceType: "constraint",
          sourceId: "equal_radius_invalid",
          constraintKind: "equalRadius",
          targetId: "circle_b_radius"
        })
      ])
    );
    expect(missingRadius.status).toBe("failed");
    expect(missingRadius.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SKETCH_SOLVER_MISSING_TARGET",
          sourceType: "constraint",
          sourceId: "equal_radius_missing",
          targetId: "missing"
        })
      ])
    );
  });

  it("reports over-defined but consistent constraints separately from conflicts", () => {
    const result = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [
        { id: "a", initial: [0, 0] },
        { id: "b", initial: [2, 0] }
      ],
      constraints: [
        { id: "fix_a", kind: "fixedPoint", pointId: "a", value: [0, 0] },
        { id: "fix_b", kind: "fixedPoint", pointId: "b", value: [2, 0] },
        {
          id: "horizontal_ab",
          kind: "horizontal",
          startPointId: "a",
          endPointId: "b"
        }
      ]
    });

    expect(result.status).toBe("over-defined");
    expect(result.converged).toBe(true);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SKETCH_SOLVER_OVER_DEFINED" })
      ])
    );
  });

  it("reports deferred unsupported constraints instead of ignoring them", () => {
    const result = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [
        { id: "a", initial: [0, 0] },
        { id: "b", initial: [1, 1] }
      ],
      constraints: [{ id: "tangent_1", kind: "tangent", targetIds: ["a", "b"] }]
    });

    expect(result.status).toBe("unsupported");
    expect(result.iterations).toBe(0);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SKETCH_SOLVER_UNSUPPORTED_CONSTRAINT",
          sourceType: "constraint",
          sourceId: "tangent_1",
          constraintKind: "tangent"
        })
      ])
    );
  });

  it("keeps renderer, storage, and browser identifiers out of solver outputs", () => {
    const result = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [{ id: "p1", initial: [0, 0] }],
      constraints: [
        { id: "fixed_p1", kind: "fixedPoint", pointId: "p1", value: [0, 0] }
      ]
    });

    expect(JSON.stringify(result)).not.toMatch(
      /renderer|mesh|occt|gpu|selectionBuffer|viewport|opfs|fileHandle|pixel/i
    );
  });
});
