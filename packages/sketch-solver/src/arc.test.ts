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

function pointAt(
  center: readonly [number, number],
  radius: number,
  angleDegrees: number
): readonly [number, number] {
  const angle = (angleDegrees * Math.PI) / 180;
  return [
    center[0] + radius * Math.cos(angle),
    center[1] + radius * Math.sin(angle)
  ];
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
    expect(result.scalars.find(({ id }) => id === "circle_radius")?.value).toBe(
      2
    );
    expect(result.maxResidual).toBeCloseTo(3, 12);
  });

  it("uses independent rank so duplicate dimensions do not consume arc degrees of freedom", () => {
    const result = solveSketch({
      ...baseArc(),
      dimensions: Array.from({ length: 5 }, (_, index) => ({
        id: `sweep_${index}`,
        kind: "arcSweep" as const,
        arcId: "arc",
        value: 90
      }))
    });

    expect(result.status).toBe("under-defined");
    expect(result.converged).toBe(true);
    expect(result.residualCount).toBe(5);
    expect(result.degreesOfFreedomEstimate).toBe(4);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SKETCH_SOLVER_UNDER_DEFINED" })
      ])
    );
  });

  it.each([
    ["arc-arc", 0],
    ["near arc-arc", 5e-8],
    ["arc-circle", 0],
    ["near arc-circle", 5e-8]
  ] as const)("rejects indeterminate %s round tangency", (kind, offset) => {
    const secondIsArc = kind.includes("arc-arc");
    const result = solveSketch({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: secondIsArc
        ? []
        : [{ id: "circle_center", initial: [offset, 0] }],
      scalars: secondIsArc ? [] : [{ id: "circle_radius", initial: 2 }],
      arcs: [
        {
          id: "a",
          initial: {
            center: [0, 0],
            radius: 2,
            startAngleDegrees: 0,
            sweepAngleDegrees: 180
          }
        },
        ...(secondIsArc
          ? [
              {
                id: "b",
                initial: {
                  center: [offset, 0] as const,
                  radius: 2,
                  startAngleDegrees: 180,
                  sweepAngleDegrees: 180
                }
              }
            ]
          : [])
      ],
      constraints: [
        {
          id: "tangent",
          kind: "tangent",
          primaryTarget: { kind: "arc", arcId: "a" },
          secondaryTarget: secondIsArc
            ? ({ kind: "arc", arcId: "b" } as const)
            : ({
                kind: "circle",
                centerPointId: "circle_center",
                radiusId: "circle_radius"
              } as const)
        }
      ]
    });

    expect(result.status).toBe("failed");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SKETCH_ARC_SOLVE_BRANCH_INVALID",
          sourceId: "tangent"
        })
      ])
    );
  });

  it.each([0, 5e-8, -5e-8])(
    "rejects indeterminate line-arc tangency side at center offset %s",
    (centerOffset) => {
      const initialArc = {
        center: [0, centerOffset] as const,
        radius: 2,
        startAngleDegrees: 180,
        sweepAngleDegrees: 180
      };
      const result = solveSketch({
        version: SKETCH_SOLVER_MODEL_VERSION,
        points: [
          { id: "line_start", initial: [-4, 0] },
          { id: "line_end", initial: [4, 0] }
        ],
        arcs: [{ id: "arc", initial: initialArc }],
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
            id: "tangent",
            kind: "tangent",
            primaryTarget: {
              kind: "line",
              startPointId: "line_start",
              endPointId: "line_end"
            },
            secondaryTarget: { kind: "arc", arcId: "arc" }
          }
        ]
      });

      expect(result.status).toBe("failed");
      expect(arc(result, "arc")).toMatchObject(initialArc);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "SKETCH_ARC_SOLVE_BRANCH_INVALID",
            sourceId: "tangent"
          })
        ])
      );
    }
  );

  it.each([
    ["arc-circle exact", "circle", 0],
    ["arc-circle within tolerance", "circle", 2.5e-8],
    ["arc-arc exact", "arc", 0],
    ["arc-arc within tolerance", "arc", 2.5e-8]
  ] as const)(
    "rejects an indeterminate internal/external branch for %s",
    (_label, secondKind, centerOffset) => {
      const centerX = 5 + centerOffset;
      const initialPrimary = {
        center: [0, 0] as const,
        radius: 5,
        startAngleDegrees: 270,
        sweepAngleDegrees: 180
      };
      const initialSecondary = {
        center: [centerX, 0] as const,
        radius: 2,
        startAngleDegrees: 90,
        sweepAngleDegrees: 180
      };
      const result = solveSketch({
        version: SKETCH_SOLVER_MODEL_VERSION,
        points:
          secondKind === "circle"
            ? [{ id: "circle_center", initial: initialSecondary.center }]
            : [],
        scalars:
          secondKind === "circle"
            ? [{ id: "circle_radius", initial: initialSecondary.radius }]
            : [],
        arcs: [
          { id: "primary", initial: initialPrimary },
          ...(secondKind === "arc"
            ? [{ id: "secondary", initial: initialSecondary }]
            : [])
        ],
        constraints: [
          {
            id: "tangent",
            kind: "tangent",
            primaryTarget: { kind: "arc", arcId: "primary" },
            secondaryTarget:
              secondKind === "arc"
                ? { kind: "arc", arcId: "secondary" }
                : {
                    kind: "circle",
                    centerPointId: "circle_center",
                    radiusId: "circle_radius"
                  }
          }
        ]
      });

      expect(result.status).toBe("failed");
      expect(arc(result, "primary")).toMatchObject(initialPrimary);
      if (secondKind === "arc") {
        expect(arc(result, "secondary")).toMatchObject(initialSecondary);
      } else {
        expect(result.points[0]?.value).toEqual(initialSecondary.center);
        expect(result.scalars[0]?.value).toBe(initialSecondary.radius);
      }
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "SKETCH_ARC_SOLVE_BRANCH_INVALID",
            sourceId: "tangent"
          })
        ])
      );
    }
  );

  it.each(["circle", "arc"] as const)(
    "retains the externally seeded branch just beyond ambiguity tolerance for arc-%s",
    (secondKind) => {
      const centerX = 5 + 1e-6;
      const result = solveSketch({
        version: SKETCH_SOLVER_MODEL_VERSION,
        points:
          secondKind === "circle"
            ? [{ id: "circle_center", initial: [centerX, 0] }]
            : [],
        scalars:
          secondKind === "circle" ? [{ id: "circle_radius", initial: 2 }] : [],
        arcs: [
          {
            id: "primary",
            initial: {
              center: [0, 0],
              radius: 5,
              startAngleDegrees: 270,
              sweepAngleDegrees: 180
            }
          },
          ...(secondKind === "arc"
            ? [
                {
                  id: "secondary",
                  initial: {
                    center: [centerX, 0] as const,
                    radius: 2,
                    startAngleDegrees: 90,
                    sweepAngleDegrees: 180
                  }
                }
              ]
            : [])
        ],
        constraints: [
          {
            id: "tangent",
            kind: "tangent",
            primaryTarget: { kind: "arc", arcId: "primary" },
            secondaryTarget:
              secondKind === "arc"
                ? { kind: "arc", arcId: "secondary" }
                : {
                    kind: "circle",
                    centerPointId: "circle_center",
                    radiusId: "circle_radius"
                  }
          }
        ]
      });

      expect(result.converged).toBe(true);
      expect(result.diagnostics).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "SKETCH_ARC_SOLVE_BRANCH_INVALID" })
        ])
      );
    }
  );

  it("enforces exact and epsilon radius/sweep policy boundaries for both authored signs", () => {
    const linearTolerance = 1e-7;
    const angularTolerance = 0.1;
    for (const sign of [1, -1] as const) {
      for (const value of [linearTolerance, linearTolerance - 1e-9]) {
        const result = solveSketch({
          ...baseArc(sign * 90),
          dimensions: [{ id: "radius", kind: "arcRadius", arcId: "arc", value }]
        });
        expect(result.status).toBe("failed");
        expect(result.diagnostics).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: "SKETCH_ARC_DIMENSION_INVALID",
              sourceId: "radius"
            })
          ])
        );
      }

      const radiusInside = solveSketch({
        ...baseArc(sign * 90),
        dimensions: [
          {
            id: "radius",
            kind: "arcRadius",
            arcId: "arc",
            value: linearTolerance + 1e-9
          }
        ]
      });
      expect(radiusInside.converged).toBe(true);
      expect(arc(radiusInside, "arc").radius).toBeGreaterThan(linearTolerance);

      for (const value of [angularTolerance, 360 - angularTolerance]) {
        const result = solveSketch({
          ...baseArc(sign * 90),
          dimensions: [{ id: "sweep", kind: "arcSweep", arcId: "arc", value }]
        });
        expect(result.converged).toBe(true);
        expect(arc(result, "arc").sweepAngleDegrees).toBeCloseTo(
          sign * value,
          7
        );
      }

      for (const value of [
        angularTolerance - 1e-6,
        360 - angularTolerance + 1e-6
      ]) {
        const result = solveSketch({
          ...baseArc(sign * 90),
          dimensions: [{ id: "sweep", kind: "arcSweep", arcId: "arc", value }]
        });
        expect(result.status).toBe("failed");
        expect(result.diagnostics).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: "SKETCH_ARC_DIMENSION_INVALID",
              sourceId: "sweep"
            })
          ])
        );
      }
    }
  });

  it("fails and restores authored geometry when the local solve step would cross sweep sign", () => {
    const desiredEnd = pointAt([0, 0], 2, -20);
    const result = solveSketch({
      ...baseArc(20, 0),
      constraints: [
        {
          id: "fix_center",
          kind: "fixedPoint",
          target: { kind: "arc", arcId: "arc", role: "center" },
          value: [0, 0]
        },
        {
          id: "fix_start",
          kind: "fixedPoint",
          target: { kind: "arc", arcId: "arc", role: "start" },
          value: [2, 0]
        },
        {
          id: "force_negative_end",
          kind: "fixedPoint",
          target: { kind: "arc", arcId: "arc", role: "end" },
          value: desiredEnd
        }
      ],
      dimensions: [{ id: "radius", kind: "arcRadius", arcId: "arc", value: 2 }]
    });

    expect(result.status).toBe("failed");
    expect(arc(result, "arc").sweepAngleDegrees).toBe(20);
    expect(result.maxResidual).toBeGreaterThan(result.settings.tolerance);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SKETCH_ARC_SOLVE_BRANCH_INVALID" })
      ])
    );
  });

  it.each([
    ["positive wrap end", 350, 280],
    ["negative wrap end", 10, -100],
    ["positive contact start", 270, 20],
    ["negative contact start", 270, -20]
  ] as const)(
    "accepts finite line-arc tangency at the %s boundary",
    (_label, startAngleDegrees, sweepAngleDegrees) => {
      const result = solveSketch({
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
              startAngleDegrees,
              sweepAngleDegrees
            }
          }
        ],
        constraints: [
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
        ]
      });

      expect(result.converged).toBe(true);
      expect(result.diagnostics).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "SKETCH_TANGENCY_OUTSIDE_ARC" })
        ])
      );
    }
  );

  it.each([false, true])(
    "solves perturbed line-arc tangency with reversed operands=%s",
    (reversed) => {
      const line = {
        kind: "line" as const,
        startPointId: "line_start",
        endPointId: "line_end"
      };
      const arcTarget = { kind: "arc" as const, arcId: "arc" };
      const result = solveSketch({
        version: SKETCH_SOLVER_MODEL_VERSION,
        points: [
          { id: "line_start", initial: [-4.2, 0.2] },
          { id: "line_end", initial: [3.8, -0.1] }
        ],
        arcs: [
          {
            id: "arc",
            initial: {
              center: [0.3, 3],
              radius: 1.8,
              startAngleDegrees: 180,
              sweepAngleDegrees: 180
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
            id: "fix_arc_center",
            kind: "fixedPoint",
            target: { kind: "arc", arcId: "arc", role: "center" },
            value: [0, 2]
          },
          {
            id: "tangent",
            kind: "tangent",
            primaryTarget: reversed ? arcTarget : line,
            secondaryTarget: reversed ? line : arcTarget
          }
        ],
        dimensions: [
          { id: "radius", kind: "arcRadius", arcId: "arc", value: 2 },
          { id: "sweep", kind: "arcSweep", arcId: "arc", value: 180 }
        ]
      });

      expect(result.converged).toBe(true);
      expect(result.maxResidual).toBeLessThanOrEqual(result.settings.tolerance);
      expect(arc(result, "arc").center[1]).toBeCloseTo(2, 6);
    }
  );

  it.each([
    ["arc-circle external", "circle", "external", false],
    ["circle-arc external", "circle", "external", true],
    ["arc-circle internal", "circle", "internal", false],
    ["circle-arc internal", "circle", "internal", true],
    ["arc-arc external", "arc", "external", false],
    ["reversed arc-arc external", "arc", "external", true],
    ["arc-arc internal", "arc", "internal", false],
    ["reversed arc-arc internal", "arc", "internal", true]
  ] as const)(
    "solves perturbed %s tangency",
    (_label, secondKind, branch, reversed) => {
      const internal = branch === "internal";
      const desiredRadiusA = internal ? 5 : 2;
      const initialRadiusA = internal ? 5.2 : 1.8;
      const desiredCenterB = internal ? 3 : 4;
      const initialCenterB = internal ? 3.4 : 4.4;
      const targetA = { kind: "arc" as const, arcId: "a" };
      const targetB =
        secondKind === "arc"
          ? ({ kind: "arc" as const, arcId: "b" } as const)
          : ({
              kind: "circle" as const,
              centerPointId: "center_b",
              radiusId: "radius_b"
            } as const);
      const result = solveSketch({
        version: SKETCH_SOLVER_MODEL_VERSION,
        points:
          secondKind === "circle"
            ? [{ id: "center_b", initial: [initialCenterB, 0.2] }]
            : [],
        scalars:
          secondKind === "circle" ? [{ id: "radius_b", initial: 1.8 }] : [],
        arcs: [
          {
            id: "a",
            initial: {
              center: [-0.2, 0.1],
              radius: initialRadiusA,
              startAngleDegrees: 270,
              sweepAngleDegrees: 180
            }
          },
          ...(secondKind === "arc"
            ? [
                {
                  id: "b",
                  initial: {
                    center: [initialCenterB, 0.2] as const,
                    radius: 1.8,
                    startAngleDegrees: internal ? 270 : 90,
                    sweepAngleDegrees: 180
                  }
                }
              ]
            : [])
        ],
        constraints: [
          {
            id: "fix_a",
            kind: "fixedPoint",
            target: { kind: "arc", arcId: "a", role: "center" },
            value: [0, 0]
          },
          secondKind === "arc"
            ? ({
                id: "fix_b",
                kind: "fixedPoint",
                target: { kind: "arc", arcId: "b", role: "center" },
                value: [desiredCenterB, 0]
              } as const)
            : ({
                id: "fix_b",
                kind: "fixedPoint",
                pointId: "center_b",
                value: [desiredCenterB, 0]
              } as const),
          {
            id: "tangent",
            kind: "tangent",
            primaryTarget: reversed ? targetB : targetA,
            secondaryTarget: reversed ? targetA : targetB
          }
        ],
        dimensions: [
          {
            id: "radius_a",
            kind: "arcRadius",
            arcId: "a",
            value: desiredRadiusA
          },
          secondKind === "arc"
            ? ({
                id: "radius_b",
                kind: "arcRadius",
                arcId: "b",
                value: 2
              } as const)
            : ({
                id: "radius_b_dimension",
                kind: "circleRadius",
                radiusId: "radius_b",
                value: 2
              } as const)
        ]
      });

      expect(result.converged).toBe(true);
      expect(result.maxResidual).toBeLessThanOrEqual(result.settings.tolerance);
      expect(result.diagnostics).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "SKETCH_TANGENCY_OUTSIDE_ARC" }),
          expect.objectContaining({ code: "SKETCH_ARC_SOLVE_BRANCH_INVALID" })
        ])
      );
    }
  );

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
        { id: "radius_b", kind: "arcRadius", arcId: "arc", value: 3 }
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
    expect(conflicting.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SKETCH_SOLVER_CONFLICTING",
          sourceId: "radius_a"
        }),
        expect.objectContaining({
          code: "SKETCH_SOLVER_CONFLICTING",
          sourceId: "radius_b"
        })
      ])
    );
    expect(unsupported.status).toBe("unsupported");
  });
});
