import type {
  SketchArcEntity,
  SketchCircleEntitySnapshot,
  SketchLineEntitySnapshot
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";

import {
  collapseSketchCurveParameters,
  getSketchCurveSupportParameter,
  intersectFiniteSketchCurves,
  intersectSketchCurveInfiniteSupports,
  intersectSketchCurveSupportWithFiniteCurve,
  projectPointToFiniteSketchCurve,
  resolveSketchCurveEditEntity,
  unwrapSketchCurveParameterNear,
  type ResolvedSketchCurve,
  type SketchCurveEditEntity
} from "./sketchCurveEditGeometry";
import { SKETCH_GEOMETRY_POLICY } from "./sketchGeometryPolicy";

const tolerance = SKETCH_GEOMETRY_POLICY.linearTolerance;

function line(
  id: string,
  start: readonly [number, number],
  end: readonly [number, number]
): SketchLineEntitySnapshot {
  return { id, kind: "line", start, end, construction: false };
}

function circle(
  id: string,
  center: readonly [number, number],
  radius: number
): SketchCircleEntitySnapshot {
  return { id, kind: "circle", center, radius, construction: false };
}

function arc(
  id: string,
  center: readonly [number, number],
  radius: number,
  startAngleDegrees: number,
  sweepAngleDegrees: number
): SketchArcEntity {
  return {
    id,
    kind: "arc",
    center,
    radius,
    startAngleDegrees,
    sweepAngleDegrees,
    construction: false
  };
}

function resolve(entity: SketchCurveEditEntity): ResolvedSketchCurve {
  const result = resolveSketchCurveEditEntity(entity);
  expect(result.status).toBe("ready");
  if (result.status !== "ready") throw new Error(result.diagnostics[0]?.code);
  return result.curve;
}

describe("V19 analytic curve-edit geometry", () => {
  it("resolves canonical finite lines, circles, and signed arcs", () => {
    expect(resolve(line("line", [0, 0], [3, 4]))).toMatchObject({
      kind: "line",
      length: 5,
      direction: [0.6, 0.8]
    });
    expect(resolve(circle("circle", [1, -1], 2))).toMatchObject({
      kind: "circle",
      center: [1, -1],
      radius: 2
    });
    expect(resolve(arc("arc", [0, 0], 2, -90, -270))).toMatchObject({
      kind: "arc",
      startAngleDegrees: 270,
      sweepAngleDegrees: -270
    });
  });

  it("rejects non-finite and degenerate source before analytic work", () => {
    expect(
      resolveSketchCurveEditEntity(line("nan", [0, 0], [Number.NaN, 1]))
    ).toMatchObject({
      status: "blocked",
      diagnostics: [{ code: "SKETCH_CURVE_GEOMETRY_NON_FINITE" }]
    });
    expect(
      resolveSketchCurveEditEntity(line("short", [0, 0], [tolerance, 0]))
    ).toMatchObject({
      status: "blocked",
      diagnostics: [{ code: "SKETCH_CURVE_GEOMETRY_DEGENERATE" }]
    });
    expect(
      resolveSketchCurveEditEntity(circle("radius", [0, 0], tolerance))
    ).toMatchObject({
      status: "blocked",
      diagnostics: [{ code: "SKETCH_CURVE_GEOMETRY_DEGENERATE" }]
    });
    expect(
      resolveSketchCurveEditEntity(arc("full", [0, 0], 1, 0, 360))
    ).toMatchObject({
      status: "blocked",
      diagnostics: [{ code: "SKETCH_CURVE_GEOMETRY_DEGENERATE" }]
    });
  });

  it("intersects finite lines exactly and refuses coincident overlap", () => {
    expect(
      intersectFiniteSketchCurves(
        resolve(line("horizontal", [-2, 0], [2, 0])),
        resolve(line("vertical", [0, -1], [0, 1]))
      )
    ).toEqual({
      status: "ready",
      diagnostics: [],
      points: [
        {
          point: [0, 0],
          leftParameter: 2,
          rightParameter: 1,
          kind: "crossing",
          leftLocation: "interior",
          rightLocation: "interior"
        }
      ]
    });
    expect(
      intersectFiniteSketchCurves(
        resolve(line("first", [0, 0], [2, 0])),
        resolve(line("second", [1, 0], [3, 0]))
      )
    ).toMatchObject({
      status: "blocked",
      points: [],
      diagnostics: [{ code: "SKETCH_CURVE_SUPPORT_OVERLAP" }]
    });
    expect(
      intersectFiniteSketchCurves(
        resolve(line("first", [0, 0], [1, 0])),
        resolve(line("touch", [1, 0], [2, 0]))
      )
    ).toMatchObject({
      status: "ready",
      points: [
        {
          point: [1, 0],
          kind: "tangent",
          leftLocation: "end",
          rightLocation: "start"
        }
      ]
    });
  });

  it("classifies line-circle crossings, exact tangency, and tolerance misses", () => {
    const unit = resolve(circle("unit", [0, 0], 1));
    const crossings = intersectFiniteSketchCurves(
      resolve(line("diameter", [-2, 0], [2, 0])),
      unit
    );
    expect(crossings).toMatchObject({
      status: "ready",
      points: [
        { point: [-1, 0], leftParameter: 1, rightParameter: 180 },
        { point: [1, 0], leftParameter: 3, rightParameter: 0 }
      ]
    });
    expect(
      intersectFiniteSketchCurves(
        resolve(line("tangent", [-2, 1], [2, 1])),
        unit
      )
    ).toMatchObject({
      status: "ready",
      points: [{ point: [0, 1], kind: "tangent", rightParameter: 90 }]
    });
    expect(
      intersectFiniteSketchCurves(
        resolve(line("near", [-2, 1 + tolerance / 2], [2, 1 + tolerance / 2])),
        unit
      )
    ).toMatchObject({
      status: "ready",
      points: [{ kind: "tangent" }]
    });
    const nearInterior = intersectFiniteSketchCurves(
      resolve(
        line("near-interior", [-2, 1 - tolerance / 2], [2, 1 - tolerance / 2])
      ),
      unit
    );
    expect(nearInterior.status).toBe("ready");
    if (nearInterior.status === "ready") {
      expect(nearInterior.points).toHaveLength(2);
      expect(
        nearInterior.points.every((value) => value.kind === "crossing")
      ).toBe(true);
    }
    expect(
      intersectFiniteSketchCurves(
        resolve(
          line("miss", [-2, 1 + tolerance * 1.01], [2, 1 + tolerance * 1.01])
        ),
        unit
      )
    ).toEqual({ status: "ready", diagnostics: [], points: [] });
  });

  it("intersects circles deterministically and refuses coincident supports", () => {
    const first = resolve(circle("first", [0, 0], 2));
    const second = resolve(circle("second", [2, 0], 2));
    const expected = intersectFiniteSketchCurves(first, second);
    expect(expected.status).toBe("ready");
    if (expected.status !== "ready") return;
    expect(expected.points).toHaveLength(2);
    expect(expected.points.map((value) => value.leftParameter)).toEqual([
      60, 300
    ]);
    expect(expected.points.every((value) => value.kind === "crossing")).toBe(
      true
    );
    for (let iteration = 0; iteration < 10; iteration += 1) {
      expect(intersectFiniteSketchCurves(first, second)).toEqual(expected);
    }
    expect(
      intersectFiniteSketchCurves(
        first,
        resolve(circle("coincident", [tolerance / 2, 0], 2))
      )
    ).toMatchObject({
      status: "blocked",
      diagnostics: [{ code: "SKETCH_CURVE_SUPPORT_OVERLAP" }]
    });
  });

  it("classifies external and internal circle tangencies at the shared tolerance", () => {
    const outer = resolve(circle("outer", [0, 0], 2));
    for (const [label, candidate] of [
      ["external-exact", circle("external-exact", [3, 0], 1)],
      ["external-near", circle("external-near", [3 + tolerance / 2, 0], 1)],
      ["internal-exact", circle("internal-exact", [1, 0], 1)],
      ["internal-near", circle("internal-near", [1 - tolerance / 2, 0], 1)]
    ] as const) {
      expect(
        intersectFiniteSketchCurves(outer, resolve(candidate)),
        label
      ).toMatchObject({
        status: "ready",
        points: [{ kind: "tangent" }]
      });
    }
    expect(
      intersectFiniteSketchCurves(
        outer,
        resolve(circle("external-miss", [3 + tolerance * 1.01, 0], 1))
      )
    ).toEqual({ status: "ready", diagnostics: [], points: [] });
    expect(
      intersectFiniteSketchCurves(
        outer,
        resolve(circle("internal-miss", [1 - tolerance * 1.01, 0], 1))
      )
    ).toEqual({ status: "ready", diagnostics: [], points: [] });
  });

  it("preserves operand-specific parameters when curve operands are swapped", () => {
    const diameter = resolve(line("diameter", [-2, 0], [2, 0]));
    const unit = resolve(circle("unit", [0, 0], 1));
    const forward = intersectFiniteSketchCurves(diameter, unit);
    const swapped = intersectFiniteSketchCurves(unit, diameter);
    expect(forward.status).toBe("ready");
    expect(swapped.status).toBe("ready");
    if (forward.status !== "ready" || swapped.status !== "ready") return;
    const byX = (
      values: typeof forward.points | typeof swapped.points
    ): typeof forward.points =>
      [...values].sort((left, right) => left.point[0] - right.point[0]);
    const orderedForward = byX(forward.points);
    const orderedSwapped = byX(swapped.points);
    expect(orderedSwapped.map((value) => value.point)).toEqual(
      orderedForward.map((value) => value.point)
    );
    expect(orderedSwapped.map((value) => value.leftParameter)).toEqual(
      orderedForward.map((value) => value.rightParameter)
    );
    expect(orderedSwapped.map((value) => value.rightParameter)).toEqual(
      orderedForward.map((value) => value.leftParameter)
    );
  });

  it("filters intersections to minor, major, and clockwise finite arcs", () => {
    const vertical = resolve(line("vertical", [0, -2], [0, 2]));
    const minor = intersectFiniteSketchCurves(
      vertical,
      resolve(arc("minor", [0, 0], 1, 0, 90))
    );
    expect(minor).toMatchObject({
      status: "ready",
      points: [{ point: [0, 1], rightParameter: 90, rightLocation: "end" }]
    });

    const major = intersectFiniteSketchCurves(
      vertical,
      resolve(arc("major", [0, 0], 1, 0, 270))
    );
    expect(major.status).toBe("ready");
    if (major.status === "ready") {
      expect(major.points.map((value) => value.rightParameter)).toEqual([
        270, 90
      ]);
    }

    const clockwise = intersectFiniteSketchCurves(
      vertical,
      resolve(arc("clockwise", [0, 0], 1, 0, -270))
    );
    expect(clockwise.status).toBe("ready");
    if (clockwise.status === "ready") {
      expect(clockwise.points.map((value) => value.rightParameter)).toEqual([
        90, 270
      ]);
      expect(clockwise.points.map((value) => value.point[1])).toEqual([-1, 1]);
    }
  });

  it("clips arc intersections at both sides of the cyclic seam", () => {
    const seamArc = resolve(arc("seam", [0, 0], 1, 350, 20));
    const horizontal = resolve(line("horizontal", [-2, 0], [2, 0]));
    const result = intersectFiniteSketchCurves(seamArc, horizontal);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.points).toHaveLength(1);
    expect(result.points[0]).toMatchObject({
      point: [1, 0],
      leftParameter: 10,
      leftLocation: "interior"
    });
  });

  it("refuses coincident arc intervals but preserves distinct endpoint contacts", () => {
    const upper = resolve(arc("upper", [0, 0], 1, 0, 180));
    expect(
      intersectFiniteSketchCurves(
        upper,
        resolve(arc("overlap", [0, 0], 1, 90, 180))
      )
    ).toMatchObject({
      status: "blocked",
      diagnostics: [{ code: "SKETCH_CURVE_SUPPORT_OVERLAP" }]
    });
    const complementary = intersectFiniteSketchCurves(
      upper,
      resolve(arc("lower", [0, 0], 1, 180, 180))
    );
    expect(complementary.status).toBe("ready");
    if (complementary.status === "ready") {
      expect(complementary.points).toHaveLength(2);
      expect(
        complementary.points.map((value) => value.leftLocation).sort()
      ).toEqual(["end", "start"]);
    }
  });

  it("projects onto finite line, circle, signed arc interior, and arc endpoints", () => {
    expect(
      projectPointToFiniteSketchCurve(
        resolve(line("line", [0, 0], [2, 0])),
        [3, 1]
      )
    ).toMatchObject({
      status: "ready",
      projection: {
        point: [2, 0],
        parameter: 2,
        distance: Math.SQRT2,
        location: "end",
        tangent: [1, 0]
      }
    });
    const circleProjection = projectPointToFiniteSketchCurve(
      resolve(circle("circle", [0, 0], 2)),
      [0, 3]
    );
    expect(circleProjection).toMatchObject({
      status: "ready",
      projection: {
        parameter: 90,
        distance: 1,
        location: "interior"
      }
    });
    if (circleProjection.status === "ready") {
      expect(circleProjection.projection.point[0]).toBeCloseTo(0, 12);
      expect(circleProjection.projection.point[1]).toBeCloseTo(2, 12);
      expect(circleProjection.projection.tangent[0]).toBeCloseTo(-1, 12);
      expect(circleProjection.projection.tangent[1]).toBeCloseTo(0, 12);
    }
    expect(
      projectPointToFiniteSketchCurve(
        resolve(arc("clockwise", [0, 0], 2, 90, -180)),
        [3, 0]
      )
    ).toMatchObject({
      status: "ready",
      projection: {
        point: [2, 0],
        parameter: 90,
        distance: 1,
        location: "interior",
        tangent: [0, -1]
      }
    });
    const endpointProjection = projectPointToFiniteSketchCurve(
      resolve(arc("minor", [0, 0], 1, 0, 90)),
      [-2, 0]
    );
    expect(endpointProjection).toMatchObject({
      status: "ready",
      projection: { parameter: 90, location: "end" }
    });
    if (endpointProjection.status === "ready") {
      expect(endpointProjection.projection.point[0]).toBeCloseTo(0, 12);
      expect(endpointProjection.projection.point[1]).toBeCloseTo(1, 12);
    }
  });

  it("reports non-unique circular and equal-endpoint projections", () => {
    expect(
      projectPointToFiniteSketchCurve(
        resolve(circle("circle", [0, 0], 2)),
        [0, 0]
      )
    ).toMatchObject({
      status: "blocked",
      diagnostics: [{ code: "SKETCH_CURVE_PROJECTION_AMBIGUOUS" }]
    });
    expect(
      projectPointToFiniteSketchCurve(
        resolve(arc("upper", [0, 0], 1, 0, 180)),
        [0, -2]
      )
    ).toMatchObject({
      status: "blocked",
      diagnostics: [{ code: "SKETCH_CURVE_PROJECTION_AMBIGUOUS" }]
    });
  });

  it("sorts and collapses linear, angular, and cyclic seam parameters", () => {
    expect(
      collapseSketchCurveParameters(resolve(line("line", [0, 0], [10, 0])), [
        5,
        1,
        1 + tolerance / 2,
        10 + tolerance / 2,
        0
      ])
    ).toEqual({
      status: "ready",
      diagnostics: [],
      parameters: [0, 1, 5, 10]
    });

    const unit = resolve(circle("circle", [0, 0], 1));
    const angularTolerance = tolerance * (180 / Math.PI);
    expect(
      collapseSketchCurveParameters(unit, [
        90,
        360 - angularTolerance / 3,
        angularTolerance / 3,
        90 + angularTolerance / 2
      ])
    ).toEqual({
      status: "ready",
      diagnostics: [],
      parameters: [0, 90]
    });
    expect(collapseSketchCurveParameters(unit, [0, Number.NaN])).toMatchObject({
      status: "blocked",
      diagnostics: [{ code: "SKETCH_CURVE_PARAMETER_INVALID" }]
    });
  });

  it("provides infinite-support hits for finite-boundary extend planning", () => {
    const authoredTarget = resolve(line("target", [0, 0], [1, 0]));
    const beyondEnd = resolve(line("boundary", [3, -1], [3, 1]));
    expect(intersectFiniteSketchCurves(authoredTarget, beyondEnd)).toEqual({
      status: "ready",
      diagnostics: [],
      points: []
    });
    expect(
      intersectSketchCurveSupportWithFiniteCurve(authoredTarget, beyondEnd)
    ).toMatchObject({
      status: "ready",
      points: [{ point: [3, 0], leftParameter: 3 }]
    });
    expect(
      intersectSketchCurveSupportWithFiniteCurve(
        authoredTarget,
        resolve(line("finite-miss", [3, 1], [3, 2]))
      )
    ).toEqual({ status: "ready", diagnostics: [], points: [] });

    const circleSupport = resolve(arc("arc", [0, 0], 2, 0, 90));
    const finiteBoundary = resolve(line("vertical", [-2, -3], [-2, 3]));
    const supportHits = intersectSketchCurveSupportWithFiniteCurve(
      circleSupport,
      finiteBoundary
    );
    expect(supportHits).toMatchObject({
      status: "ready",
      points: [{ point: [-2, 0], leftParameter: 180 }]
    });
    expect(
      unwrapSketchCurveParameterNear(
        circleSupport as Extract<ResolvedSketchCurve, { kind: "arc" }>,
        180,
        90
      )
    ).toBe(180);
  });

  it("keeps full support relations distinct from finite authored relations", () => {
    const short = resolve(line("short", [0, 0], [1, 0]));
    const far = resolve(line("far", [2, -1], [2, 1]));
    expect(intersectFiniteSketchCurves(short, far)).toMatchObject({
      status: "ready",
      points: []
    });
    expect(intersectSketchCurveInfiniteSupports(short, far)).toMatchObject({
      status: "ready",
      points: [{ point: [2, 0], leftParameter: 2 }]
    });
    expect(
      getSketchCurveSupportParameter(
        resolve(arc("signed", [0, 0], 1, 30, -270)),
        [0, 1]
      )
    ).toBe(300);
  });
});
