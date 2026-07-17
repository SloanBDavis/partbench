import { describe, expect, it } from "vitest";
import {
  SKETCH_SOLVER_MODEL_VERSION,
  solveSketch,
  type SketchSolveArcResult,
  type SketchSolveModel
} from "./index";

function arc(
  result: { readonly arcs: readonly SketchSolveArcResult[] },
  id: string
) {
  const found = result.arcs.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Missing arc result: ${id}`);
  return found;
}

function baseArc(
  sweepAngleDegrees = 90,
  startAngleDegrees = 0
): SketchSolveModel {
  return {
    version: SKETCH_SOLVER_MODEL_VERSION,
    points: [],
    arcs: [
      {
        id: "arc",
        initial: {
          center: [0, 0],
          radius: 2,
          startAngleDegrees,
          sweepAngleDegrees
        }
      }
    ]
  };
}

describe("V17 numerical arc solver", () => {
  it("evaluates center, start, and end targets and normalizes only the start angle", () => {
    const result = solveSketch({
      ...baseArc(-90, 450),
      constraints: [
        {
          id: "fix_center",
          kind: "fixedPoint",
          target: { kind: "arc", arcId: "arc", role: "center" },
          value: [1, 2]
        },
        {
          id: "fix_start",
          kind: "fixedPoint",
          target: { kind: "arc", arcId: "arc", role: "start" },
          value: [1, 4]
        },
        {
          id: "fix_end",
          kind: "fixedPoint",
          target: { kind: "arc", arcId: "arc", role: "end" },
          value: [3, 2]
        }
      ],
      dimensions: [
        { id: "radius", kind: "arcRadius", arcId: "arc", value: 2 },
        { id: "sweep", kind: "arcSweep", arcId: "arc", value: 90 }
      ]
    });

    expect(result.converged).toBe(true);
    const solved = arc(result, "arc");
    expect(solved.center[0]).toBeCloseTo(1, 7);
    expect(solved.center[1]).toBeCloseTo(2, 7);
    expect(solved.startAngleDegrees).toBeCloseTo(90, 7);
    expect(solved.sweepAngleDegrees).toBeCloseTo(-90, 7);
    expect(solved.start[0]).toBeCloseTo(1, 7);
    expect(solved.start[1]).toBeCloseTo(4, 7);
    expect(solved.end[0]).toBeCloseTo(3, 7);
    expect(solved.end[1]).toBeCloseTo(2, 7);
  });

  it("keeps an unconstrained arc under-defined with authored geometry intact", () => {
    const result = solveSketch(baseArc());
    expect(result.status).toBe("under-defined");
    expect(result.variableCount).toBe(5);
    expect(arc(result, "arc")).toMatchObject({
      center: [0, 0],
      radius: 2,
      startAngleDegrees: 0,
      sweepAngleDegrees: 90,
      start: [2, 0],
      end: [0, 2]
    });
  });

  it("applies positive-magnitude sweep dimensions without flipping either authored sign", () => {
    for (const sign of [1, -1] as const) {
      const result = solveSketch({
        ...baseArc(sign * 40, sign > 0 ? 350 : 10),
        dimensions: [{ id: "sweep", kind: "arcSweep", arcId: "arc", value: 20 }]
      });
      expect(result.status).toBe("under-defined");
      expect(arc(result, "arc").sweepAngleDegrees).toBeCloseTo(sign * 20, 7);
      expect(Math.sign(arc(result, "arc").sweepAngleDegrees)).toBe(sign);
    }
  });

  it("supports coincident and symmetry through derived arc point targets", () => {
    const result = solveSketch({
      ...baseArc(180, 0),
      points: [
        { id: "point", initial: [2, 0] },
        { id: "axis_start", initial: [0, -5] },
        { id: "axis_end", initial: [0, 5] }
      ],
      constraints: [
        {
          id: "coincident",
          kind: "coincident",
          primaryTarget: { kind: "point", pointId: "point" },
          secondaryTarget: { kind: "arc", arcId: "arc", role: "start" }
        },
        {
          id: "symmetry",
          kind: "symmetry",
          primaryTarget: { kind: "arc", arcId: "arc", role: "start" },
          secondaryTarget: { kind: "arc", arcId: "arc", role: "end" },
          axisTarget: {
            kind: "line",
            startPointId: "axis_start",
            endPointId: "axis_end"
          }
        }
      ]
    });
    expect(result.converged).toBe(true);
    expect(result.maxResidual).toBeLessThanOrEqual(result.settings.tolerance);
  });

  it("supports arc-circle and arc-arc concentric and equal-radius targets", () => {
    const result = solveSketch({
      ...baseArc(),
      points: [{ id: "circle_center", initial: [4, 3] }],
      scalars: [{ id: "circle_radius", initial: 5 }],
      arcs: [
        ...baseArc().arcs!,
        {
          id: "other_arc",
          initial: {
            center: [-2, 1],
            radius: 4,
            startAngleDegrees: 180,
            sweepAngleDegrees: -120
          }
        }
      ],
      constraints: [
        {
          id: "concentric_arc_circle",
          kind: "concentric",
          primaryTarget: { kind: "arc", arcId: "arc" },
          secondaryTarget: {
            kind: "circle",
            centerPointId: "circle_center",
            radiusId: "circle_radius"
          }
        },
        {
          id: "equal_arc_circle",
          kind: "equalRadius",
          primaryTarget: { kind: "arc", arcId: "arc" },
          secondaryTarget: {
            kind: "circle",
            centerPointId: "circle_center",
            radiusId: "circle_radius"
          }
        },
        {
          id: "concentric_arcs",
          kind: "concentric",
          primaryTarget: { kind: "arc", arcId: "arc" },
          secondaryTarget: { kind: "arc", arcId: "other_arc" }
        },
        {
          id: "equal_arcs",
          kind: "equalRadius",
          primaryTarget: { kind: "arc", arcId: "arc" },
          secondaryTarget: { kind: "arc", arcId: "other_arc" }
        }
      ]
    });
    expect(result.converged).toBe(true);
    expect(result.maxResidual).toBeLessThanOrEqual(result.settings.tolerance);
  });

  it("accepts line-arc tangency only when contact lies on the finite arc", () => {
    const tangentModel = (start: number, sweep: number): SketchSolveModel => ({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [
        { id: "line_start", initial: [-4, 0] },
        { id: "line_end", initial: [4, 0] }
      ],
      arcs: [
        {
          id: "arc",
          initial: {
            center: [0, 2],
            radius: 2,
            startAngleDegrees: start,
            sweepAngleDegrees: sweep
          }
        }
      ],
      constraints: [
        {
          id: "fix_line_start",
          kind: "fixedPoint",
          pointId: "line_start",
          value: [-4, 0]
        },
        {
          id: "fix_line_end",
          kind: "fixedPoint",
          pointId: "line_end",
          value: [4, 0]
        },
        {
          id: "fix_center",
          kind: "fixedPoint",
          target: { kind: "arc", arcId: "arc", role: "center" },
          value: [0, 2]
        },
        {
          id: "tangent",
          kind: "tangent",
          primaryTarget: {
            kind: "line",
            startPointId: "line_start",
            endPointId: "line_end"
          },
          secondaryTarget: { kind: "arc", arcId: "arc" }
        }
      ],
      dimensions: [
        { id: "radius", kind: "arcRadius", arcId: "arc", value: 2 },
        { id: "sweep", kind: "arcSweep", arcId: "arc", value: Math.abs(sweep) }
      ]
    });

    expect(solveSketch(tangentModel(180, 180)).converged).toBe(true);
    const outside = solveSketch(tangentModel(0, 180));
    expect(outside.status).toBe("failed");
    expect(outside.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SKETCH_TANGENCY_OUTSIDE_ARC",
          sourceId: "tangent"
        })
      ])
    );
  });

  it("supports finite arc-circle and arc-arc tangent contacts", () => {
    const circle = {
      kind: "circle" as const,
      centerPointId: "circle_center",
      radiusId: "circle_radius"
    };
    const result = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [{ id: "circle_center", initial: [4, 0] }],
      scalars: [{ id: "circle_radius", initial: 2 }],
      arcs: [
        {
          id: "a",
          initial: {
            center: [0, 0],
            radius: 2,
            startAngleDegrees: 270,
            sweepAngleDegrees: 180
          }
        },
        {
          id: "b",
          initial: {
            center: [4, 0],
            radius: 2,
            startAngleDegrees: 90,
            sweepAngleDegrees: 180
          }
        }
      ],
      constraints: [
        {
          id: "arc_circle",
          kind: "tangent",
          primaryTarget: { kind: "arc", arcId: "a" },
          secondaryTarget: circle
        },
        {
          id: "arc_arc",
          kind: "tangent",
          primaryTarget: { kind: "arc", arcId: "a" },
          secondaryTarget: { kind: "arc", arcId: "b" }
        }
      ]
    });
    expect(result.converged).toBe(true);
    expect(result.diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SKETCH_TANGENCY_OUTSIDE_ARC" })
      ])
    );
  });

  it("fails instead of changing the seeded internal-tangency containment branch", () => {
    const result = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [{ id: "circle_center", initial: [3, 0] }],
      scalars: [{ id: "circle_radius", initial: 2 }],
      arcs: [
        {
          id: "arc",
          initial: {
            center: [0, 0],
            radius: 5,
            startAngleDegrees: 270,
            sweepAngleDegrees: 180
          }
        }
      ],
      constraints: [
        {
          id: "fix_circle",
          kind: "fixedPoint",
          pointId: "circle_center",
          value: [3, 0]
        },
        {
          id: "fix_arc",
          kind: "fixedPoint",
          target: { kind: "arc", arcId: "arc", role: "center" },
          value: [0, 0]
        },
        {
          id: "internal_tangent",
          kind: "tangent",
          primaryTarget: { kind: "arc", arcId: "arc" },
          secondaryTarget: {
            kind: "circle",
            centerPointId: "circle_center",
            radiusId: "circle_radius"
          }
        }
      ],
      dimensions: [
        { id: "arc_radius", kind: "arcRadius", arcId: "arc", value: 2 },
        {
          id: "circle_radius",
          kind: "circleRadius",
          radiusId: "circle_radius",
          value: 5
        }
      ]
    });

    expect(result.status).toBe("failed");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SKETCH_ARC_SOLVE_BRANCH_INVALID",
          sourceId: "internal_tangent"
        })
      ])
    );
    expect(arc(result, "arc").radius).toBe(5);
  });

  it("rejects radius/sweep bounds, conflicting arc dimensions, and whole-arc unsupported rows", () => {
    const invalidRadius = solveSketch({
      ...baseArc(),
      dimensions: [
        { id: "radius", kind: "arcRadius", arcId: "arc", value: 1e-8 }
      ]
    });
    const invalidSweep = solveSketch({
      ...baseArc(),
      dimensions: [
        { id: "sweep", kind: "arcSweep", arcId: "arc", value: 359.95 }
      ]
    });
    const conflicting = solveSketch({
      ...baseArc(),
      dimensions: [
        { id: "radius_a", kind: "arcRadius", arcId: "arc", value: 2 },
        { id: "radius_b", kind: "arcRadius", arcId: "arc", value: 3 },
        { id: "sweep", kind: "arcSweep", arcId: "arc", value: 90 },
        { id: "sweep_redundant", kind: "arcSweep", arcId: "arc", value: 90 },
        { id: "sweep_redundant_2", kind: "arcSweep", arcId: "arc", value: 90 },
        { id: "sweep_redundant_3", kind: "arcSweep", arcId: "arc", value: 90 }
      ]
    });
    const unsupported = solveSketch({
      ...baseArc(),
      constraints: [
        {
          id: "midpoint_arc",
          kind: "midpoint",
          target: { kind: "arc", arcId: "arc" }
        } as never
      ]
    });

    expect(invalidRadius.status).toBe("failed");
    expect(invalidSweep.status).toBe("failed");
    expect(conflicting.status).toBe("conflicting");
    expect(conflicting.maxResidual).toBeGreaterThan(
      conflicting.settings.tolerance
    );
    expect(unsupported.status).toBe("unsupported");
  });
});
