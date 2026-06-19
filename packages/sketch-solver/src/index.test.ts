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
        "midpoint"
      ],
      supportedDimensionKinds: ["pointDistance", "lineLength", "circleRadius"],
      deferredConstraintKinds: expect.arrayContaining([
        "tangent",
        "concentric",
        "equalLength",
        "equalRadius",
        "angle",
        "symmetry"
      ])
    });
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
