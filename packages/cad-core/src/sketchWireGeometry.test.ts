import type {
  SketchArcEntity,
  SketchLineEntitySnapshot
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";

import { SKETCH_GEOMETRY_POLICY } from "./sketchGeometryPolicy";
import {
  areSketchPointsCoincident,
  areSketchTangentsG1,
  classifySketchSegmentAgainstInfiniteLine,
  classifySketchWireAgainstInfiniteLine,
  getSketchSegmentBounds,
  getSketchSegmentEndpointTangent,
  getSketchWireSignedArea,
  intersectSketchSegments,
  mergeSketchSegmentBounds,
  normalizeSketchWireCounterClockwise,
  resolveOrientedSketchSegment,
  reverseSketchSegmentTraversal,
  type ResolvedSketchSegment,
  type SketchSegmentOrientation,
  type SketchWireEntity
} from "./sketchWireGeometry";

const tolerance = SKETCH_GEOMETRY_POLICY.linearTolerance;

function line(
  id: string,
  start: readonly [number, number],
  end: readonly [number, number]
): SketchLineEntitySnapshot {
  return { id, kind: "line", start, end, construction: false };
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

function resolve(
  entity: SketchWireEntity,
  orientation: SketchSegmentOrientation = "forward"
): ResolvedSketchSegment {
  const result = resolveOrientedSketchSegment(entity, orientation);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.issue.code);
  return result.segment;
}

describe("V17 analytic sketch wire geometry", () => {
  it("classifies line crossings, vertex touches, and tolerance-bound overlaps against an infinite axis", () => {
    const axisStart = [0, 100] as const;
    const axisEnd = [0, 101] as const;
    expect(
      classifySketchSegmentAgainstInfiniteLine(
        resolve(line("cross-beyond-axis", [-1, 0], [1, 0])),
        axisStart,
        axisEnd
      )
    ).toBe("crossing");
    expect(
      classifySketchSegmentAgainstInfiniteLine(
        resolve(line("vertex", [0, 0], [1, 0])),
        axisStart,
        axisEnd
      )
    ).toBe("vertex-touch");
    expect(
      classifySketchSegmentAgainstInfiniteLine(
        resolve(line("within", [tolerance, -1], [tolerance, 1])),
        axisStart,
        axisEnd
      )
    ).toBe("overlap");
    expect(
      classifySketchSegmentAgainstInfiniteLine(
        resolve(line("outside", [tolerance * 1.01, -1], [tolerance * 1.01, 1])),
        axisStart,
        axisEnd
      )
    ).toBe("clear");
  });

  it("classifies whole-wire straddling through opposite vertices without rejecting one-sided touches", () => {
    const axisStart = [0, -2] as const;
    const axisEnd = [0, 2] as const;
    const wire = (points: readonly (readonly [number, number])[]) =>
      points.map((point, index) =>
        resolve(
          line(`side-${index}`, point, points[(index + 1) % points.length]!)
        )
      );
    expect(
      classifySketchWireAgainstInfiniteLine(
        wire([
          [0, 1],
          [1, 0],
          [0, -1],
          [-1, 0]
        ]),
        axisStart,
        axisEnd
      )
    ).toBe("straddling");
    expect(
      classifySketchWireAgainstInfiniteLine(
        wire([
          [0, -1],
          [1, 0],
          [0, 1]
        ]),
        axisStart,
        axisEnd
      )
    ).toBe("negative");
  });

  it("classifies endpoint, tangent, reversed-major, and scale-stable arc contacts", () => {
    const axisStart = [0, -0.1] as const;
    const axisEnd = [0, 0.1] as const;
    const classify = (entity: SketchArcEntity) =>
      classifySketchSegmentAgainstInfiniteLine(
        resolve(entity),
        axisStart,
        axisEnd
      );

    expect(classify(arc("endpoint", [0, 0], 1, -90, 180))).toBe("vertex-touch");
    expect(classify(arc("endpoint-reversed", [0, 0], 1, 90, -180))).toBe(
      "vertex-touch"
    );
    expect(classify(arc("interior-tangent", [1, 0], 1, 90, 180))).toBe(
      "interior-touch"
    );
    expect(
      classify(arc("near-tangent", [1 + tolerance / 2, 0], 1, 90, 180))
    ).toBe("interior-touch");
    expect(
      classify(arc("outside-tangent", [1 + tolerance * 1.01, 0], 1, 90, 180))
    ).toBe("clear");
    expect(classify(arc("major-cross", [1, 0], 2, 90, 270))).toBe("crossing");
    expect(
      classify(
        arc("large-near-tangent", [1e6 + tolerance / 2, 0], 1e6, 90, 180)
      )
    ).toBe("interior-touch");
  });

  it("rejects non-finite and degenerate source at exact policy boundaries", () => {
    expect(
      resolveOrientedSketchSegment(
        line("nonfinite", [0, 0], [Infinity, 0]),
        "forward"
      )
    ).toMatchObject({
      ok: false,
      issue: { code: "SKETCH_SEGMENT_GEOMETRY_NON_FINITE" }
    });
    for (const length of [tolerance * (1 - 1e-8), tolerance]) {
      expect(
        resolveOrientedSketchSegment(
          line("short", [0, 0], [length, 0]),
          "forward"
        )
      ).toMatchObject({
        ok: false,
        issue: { code: "SKETCH_LINE_ZERO_LENGTH" }
      });
    }
    expect(
      resolveOrientedSketchSegment(
        line("long-enough", [0, 0], [tolerance * (1 + 1e-8), 0]),
        "forward"
      )
    ).toMatchObject({ ok: true });
    expect(
      resolveOrientedSketchSegment(
        arc("small", [0, 0], tolerance, 0, 90),
        "forward"
      )
    ).toMatchObject({
      ok: false,
      issue: { code: "SKETCH_ARC_RADIUS_INVALID" }
    });
    for (const sweep of [0, 0.099, 359.901, 360, -360]) {
      expect(
        resolveOrientedSketchSegment(
          arc("bad-sweep", [0, 0], 1, 0, sweep),
          "forward"
        )
      ).toMatchObject({
        ok: false,
        issue: { code: "SKETCH_ARC_SWEEP_INVALID" }
      });
    }
    expect(
      resolveOrientedSketchSegment(
        arc("short-arc", [0, 0], tolerance * 1.01, 0, 0.1),
        "forward"
      )
    ).toMatchObject({
      ok: false,
      issue: { code: "SKETCH_ARC_ZERO_LENGTH" }
    });
  });

  it("resolves authored arc traversal in both signs and reverses it without mutating support", () => {
    const positive = resolve(arc("positive", [0, 0], 2, 350, 20));
    const negative = resolve(arc("negative", [0, 0], 2, 10, -20));
    const reversed = reverseSketchSegmentTraversal(positive);

    expect(positive.kind).toBe("arc");
    expect(negative.kind).toBe("arc");
    if (
      positive.kind !== "arc" ||
      negative.kind !== "arc" ||
      reversed.kind !== "arc"
    )
      return;
    expect(positive.sweepAngleRadians).toBeGreaterThan(0);
    expect(negative.sweepAngleRadians).toBeLessThan(0);
    expect(positive.start[0]).toBeCloseTo(negative.end[0], 12);
    expect(positive.end[0]).toBeCloseTo(negative.start[0], 12);
    expect(reversed.orientation).toBe("reverse");
    expect(reversed.start).toEqual(positive.end);
    expect(reversed.end).toEqual(positive.start);
    expect(reversed.center).toEqual(positive.center);
    expect(reversed.radius).toBe(positive.radius);
    expect(reversed.sweepAngleRadians).toBe(-positive.sweepAngleRadians);
  });

  it("applies inclusive endpoint coincidence only through the shared linear policy", () => {
    expect(areSketchPointsCoincident([0, 0], [tolerance, 0])).toBe(true);
    expect(areSketchPointsCoincident([0, 0], [tolerance * (1 - 1e-8), 0])).toBe(
      true
    );
    expect(areSketchPointsCoincident([0, 0], [tolerance * (1 + 1e-8), 0])).toBe(
      false
    );
  });

  it("classifies line-line crossings, endpoint adjacency, overlap, and separation", () => {
    const horizontal = resolve(line("horizontal", [-2, 0], [2, 0]));
    const vertical = resolve(line("vertical", [0, -2], [0, 2]));
    expect(intersectSketchSegments(horizontal, vertical)).toMatchObject({
      overlap: false,
      points: [
        {
          point: [0, 0],
          kind: "crossing",
          leftLocation: "interior",
          rightLocation: "interior"
        }
      ]
    });

    const adjacent = resolve(line("adjacent", [2, 0], [3, 0]));
    expect(intersectSketchSegments(horizontal, adjacent)).toMatchObject({
      overlap: false,
      points: [
        {
          kind: "tangent",
          leftLocation: "end",
          rightLocation: "start"
        }
      ]
    });
    expect(
      intersectSketchSegments(
        horizontal,
        resolve(line("overlap", [1, 0], [3, 0]))
      )
    ).toEqual({ overlap: true, points: [] });
    expect(
      intersectSketchSegments(
        horizontal,
        resolve(
          line(
            "separate",
            [-2, tolerance * (1 + 1e-8)],
            [2, tolerance * (1 + 1e-8)]
          )
        )
      )
    ).toEqual({ overlap: false, points: [] });
    expect(
      intersectSketchSegments(
        resolve(line("huge-left", [0, 0], [2e12, 0])),
        resolve(line("huge-offset", [1e12, 0.0004], [3e12, 0.0004]))
      )
    ).toEqual({ overlap: false, points: [] });
  });

  it("clips analytic line-circle crossings and tangencies to finite arc support", () => {
    const upperHalf = resolve(arc("upper", [0, 0], 1, 0, 180));
    const crossing = intersectSketchSegments(
      resolve(line("diameter", [-2, 0], [2, 0])),
      upperHalf
    );
    expect(crossing.overlap).toBe(false);
    expect(crossing.points).toHaveLength(2);
    expect(crossing.points.map((point) => point.leftLocation)).toEqual([
      "interior",
      "interior"
    ]);
    expect(crossing.points.map((point) => point.rightLocation).sort()).toEqual([
      "end",
      "start"
    ]);

    expect(
      intersectSketchSegments(
        resolve(line("top-tangent", [-2, 1], [2, 1])),
        upperHalf
      )
    ).toMatchObject({
      overlap: false,
      points: [{ point: [0, 1], kind: "tangent", rightLocation: "interior" }]
    });
    expect(
      intersectSketchSegments(
        resolve(line("bottom-tangent", [-2, -1], [2, -1])),
        upperHalf
      )
    ).toEqual({ overlap: false, points: [] });
    expect(
      intersectSketchSegments(
        resolve(
          line("near-miss", [-2, 1 + tolerance / 2], [2, 1 + tolerance / 2])
        ),
        upperHalf
      )
    ).toMatchObject({ overlap: false, points: [{ kind: "tangent" }] });
    expect(
      intersectSketchSegments(
        resolve(
          line(
            "outside-tolerance",
            [-2, 1 + tolerance * 1.01],
            [2, 1 + tolerance * 1.01]
          )
        ),
        upperHalf
      )
    ).toEqual({ overlap: false, points: [] });
    expect(
      intersectSketchSegments(
        resolve(line("large-no-hit", [-1e9, 2], [1e9, 2])),
        upperHalf
      )
    ).toEqual({ overlap: false, points: [] });
  });

  it("classifies finite arc-arc tangency, crossings, endpoint adjacency, and overlap", () => {
    const rightHalf = resolve(arc("right", [0, 0], 1, -90, 180));
    const leftCircleHalf = resolve(arc("other", [2, 0], 1, 90, 180));
    expect(intersectSketchSegments(rightHalf, leftCircleHalf)).toMatchObject({
      overlap: false,
      points: [{ point: [1, 0], kind: "tangent" }]
    });

    const crossing = intersectSketchSegments(
      resolve(arc("circle-a", [0, 0], 2, -90, 180)),
      resolve(arc("circle-b", [2, 0], 2, 90, 180))
    );
    expect(crossing.overlap).toBe(false);
    expect(crossing.points).toHaveLength(2);
    expect(crossing.points.every((point) => point.kind === "crossing")).toBe(
      true
    );

    const upper = resolve(arc("upper", [0, 0], 1, 0, 180));
    const lower = resolve(arc("lower", [0, 0], 1, 180, 180));
    expect(intersectSketchSegments(upper, lower)).toMatchObject({
      overlap: false,
      points: [
        { kind: "tangent", leftLocation: "start" },
        { kind: "tangent", leftLocation: "end" }
      ]
    });
    expect(
      intersectSketchSegments(upper, resolve(arc("shared", [0, 0], 1, 90, 180)))
    ).toEqual({ overlap: true, points: [] });
    expect(
      intersectSketchSegments(
        upper,
        resolve(arc("offset-support", [0, tolerance / 2], 1, 0, 180))
      ).overlap
    ).toBe(true);
  });

  it("computes exact circular signed area and normalizes clockwise traversal", () => {
    const upperClockwise = resolve(arc("upper", [0, 0], 2, 180, -180));
    const lowerClockwise = resolve(arc("lower", [0, 0], 2, 0, -180));
    const clockwise = [upperClockwise, lowerClockwise];
    expect(getSketchWireSignedArea(clockwise)).toBeCloseTo(-4 * Math.PI, 12);

    const normalized = normalizeSketchWireCounterClockwise(clockwise);
    expect(normalized.normalized).toBe(true);
    expect(normalized.signedArea).toBeCloseTo(4 * Math.PI, 12);
    expect(normalized.segments.map((segment) => segment.entityId)).toEqual([
      "lower",
      "upper"
    ]);
    expect(getSketchWireSignedArea(normalized.segments)).toBeCloseTo(
      4 * Math.PI,
      12
    );
  });

  it("keeps line and circular area stable under large translations", () => {
    const offset = 1e12;
    const square = [
      resolve(line("bottom", [offset, offset], [offset + 1, offset])),
      resolve(line("right", [offset + 1, offset], [offset + 1, offset + 1])),
      resolve(line("top", [offset + 1, offset + 1], [offset, offset + 1])),
      resolve(line("left", [offset, offset + 1], [offset, offset]))
    ];
    expect(getSketchWireSignedArea(square)).toBe(1);

    const translatedCircle = [
      resolve(arc("upper", [offset, -offset], 2, 0, 180)),
      resolve(arc("lower", [offset, -offset], 2, 180, 180))
    ];
    expect(getSketchWireSignedArea(translatedCircle)).toBeCloseTo(
      4 * Math.PI,
      12
    );
    expect(normalizeSketchWireCounterClockwise(translatedCircle)).toMatchObject(
      { normalized: false }
    );
    const translatedClockwise = [...translatedCircle]
      .reverse()
      .map(reverseSketchSegmentTraversal);
    expect(getSketchWireSignedArea(translatedClockwise)).toBeCloseTo(
      -4 * Math.PI,
      12
    );
    expect(
      normalizeSketchWireCounterClockwise(translatedClockwise)
    ).toMatchObject({ normalized: true, signedArea: 4 * Math.PI });
  });

  it("uses absolute support tolerance independent of translated coordinates", () => {
    const offset = 1e12;
    const base = resolve(arc("base", [offset, offset], 10, 0, 180));
    const displaced = resolve(
      arc("displaced", [offset, offset + 0.001], 10, 0, 180)
    );
    expect(intersectSketchSegments(base, displaced).overlap).toBe(false);

    for (const delta of [tolerance * 0.99, tolerance]) {
      const localBase = resolve(arc("local-base", [0, 0], 10, 0, 180));
      const within = resolve(arc("within", [0, delta], 10, 0, 180));
      expect(intersectSketchSegments(localBase, within).overlap).toBe(true);
    }
    const outside = resolve(arc("outside", [0, tolerance * 1.01], 10, 0, 180));
    expect(
      intersectSketchSegments(
        resolve(arc("local-base", [0, 0], 10, 0, 180)),
        outside
      ).overlap
    ).toBe(false);
  });

  it("handles wrapped positive and negative cocircular overlap deterministically", () => {
    const wrapped = resolve(arc("wrapped", [0, 0], 5, 350, 30));
    const reverseAuthored = resolve(arc("negative", [0, 0], 5, 20, -30));
    const endpointOnly = resolve(arc("endpoint", [0, 0], 5, 20, 30));
    const disjoint = resolve(arc("disjoint", [0, 0], 5, 60, 30));

    expect(intersectSketchSegments(wrapped, reverseAuthored)).toEqual({
      overlap: true,
      points: []
    });
    expect(intersectSketchSegments(wrapped, endpointOnly)).toMatchObject({
      overlap: false,
      points: [{ leftLocation: "end", rightLocation: "start" }]
    });
    expect(intersectSketchSegments(wrapped, disjoint)).toEqual({
      overlap: false,
      points: []
    });
  });

  it("uses absolute tolerance for large-radius arc tangency", () => {
    const radius = 1e8;
    const left = resolve(arc("large-left", [0, 0], radius, -90, 180));
    const against = (gap: number) =>
      resolve(arc("large-right", [2 * radius + gap, 0], radius, 90, 180));

    expect(
      intersectSketchSegments(left, against(tolerance / 2)).points
    ).toHaveLength(1);
    expect(
      intersectSketchSegments(left, against(tolerance)).points
    ).toHaveLength(1);
    expect(intersectSketchSegments(left, against(5e-7))).toEqual({
      overlap: false,
      points: []
    });
  });

  it("does not widen the absolute policy at large representable gaps", () => {
    const radius = 1e8;
    const outsideCoordinate = 100000000.00000012;
    const insideCoordinate = 100000000.00000009;
    const outsideGap = outsideCoordinate - radius;
    const insideGap = insideCoordinate - radius;
    expect(outsideGap).toBe(1.1920928955078125e-7);
    expect(outsideGap).toBeGreaterThan(tolerance);
    expect(insideGap).toBeLessThanOrEqual(tolerance);

    const upper = resolve(arc("upper-large", [0, 0], radius, 0, 180));
    expect(
      intersectSketchSegments(
        resolve(
          line(
            "outside-line",
            [-radius, outsideCoordinate],
            [radius, outsideCoordinate]
          )
        ),
        upper
      )
    ).toEqual({ overlap: false, points: [] });
    expect(
      intersectSketchSegments(
        resolve(
          line(
            "inside-line",
            [-radius, insideCoordinate],
            [radius, insideCoordinate]
          )
        ),
        upper
      ).points
    ).toHaveLength(1);

    const left = resolve(arc("left", [0, 0], radius, -90, 180));
    expect(
      intersectSketchSegments(
        left,
        resolve(arc("outside-right", [200000000.00000012, 0], radius, 90, 180))
      )
    ).toEqual({ overlap: false, points: [] });
    expect(
      intersectSketchSegments(
        left,
        resolve(arc("inside-right", [200000000.00000009, 0], radius, 90, 180))
      ).points
    ).toHaveLength(1);

    const translated = resolve(
      arc("translated", [radius, radius], radius, 0, 180)
    );
    expect(
      intersectSketchSegments(
        translated,
        resolve(
          arc("outside-support", [radius, outsideCoordinate], radius, 0, 180)
        )
      ).overlap
    ).toBe(false);
    expect(
      intersectSketchSegments(
        translated,
        resolve(
          arc("inside-support", [radius, insideCoordinate], radius, 0, 180)
        )
      ).overlap
    ).toBe(true);
  });

  it("rejects overflowed derived geometry while retaining valid large scales", () => {
    expect(
      resolveOrientedSketchSegment(
        line("overflow-line", [-Number.MAX_VALUE, 0], [Number.MAX_VALUE, 0]),
        "forward"
      )
    ).toMatchObject({
      ok: false,
      issue: { code: "SKETCH_SEGMENT_DERIVED_GEOMETRY_NON_FINITE" }
    });
    expect(
      resolveOrientedSketchSegment(
        arc("overflow-arc", [0, 0], 1e200, 0, 180),
        "forward"
      )
    ).toMatchObject({
      ok: false,
      issue: { code: "SKETCH_SEGMENT_DERIVED_GEOMETRY_NON_FINITE" }
    });
    expect(
      resolveOrientedSketchSegment(
        line("large-line", [1e150, 1e150], [1e150 + 1e140, 1e150]),
        "forward"
      )
    ).toMatchObject({ ok: true });
    expect(
      resolveOrientedSketchSegment(
        arc("large-arc", [0, 0], 1e150, 0, 180),
        "forward"
      )
    ).toMatchObject({ ok: true });
  });

  it("derives traversal-aware endpoint tangents and exact angular G1 boundaries", () => {
    const incoming = resolve(line("incoming", [-1, 0], [0, 0]));
    const outgoingArc = resolve(arc("outgoing", [0, 1], 1, 270, 90));
    expect(getSketchSegmentEndpointTangent(incoming, "end")).toEqual([1, 0]);
    const tangent = getSketchSegmentEndpointTangent(outgoingArc, "start");
    expect(tangent[0]).toBeCloseTo(1, 12);
    expect(tangent[1]).toBeCloseTo(0, 12);
    expect(
      areSketchTangentsG1(
        getSketchSegmentEndpointTangent(incoming, "end"),
        tangent
      )
    ).toBe(true);

    const vectorAt = (degrees: number): readonly [number, number] => {
      const radians = (degrees * Math.PI) / 180;
      return [Math.cos(radians), Math.sin(radians)];
    };
    expect(areSketchTangentsG1([1, 0], vectorAt(0.1))).toBe(true);
    expect(areSketchTangentsG1([1, 0], vectorAt(0.1 - 1e-8))).toBe(true);
    expect(areSketchTangentsG1([1, 0], vectorAt(0.1 + 1e-8))).toBe(false);
    expect(areSketchTangentsG1([1, 0], [-1, 0])).toBe(false);
  });

  it("includes finite-arc cardinal extrema in segment and merged bounds", () => {
    const wrapped = resolve(arc("wrapped", [1, 2], 3, 315, 90));
    expect(getSketchSegmentBounds(wrapped)).toMatchObject({
      max: [4, expect.any(Number)]
    });
    const merged = mergeSketchSegmentBounds([
      wrapped,
      resolve(line("line", [-5, -4], [-3, 10]))
    ]);
    expect(merged).toEqual({ min: [-5, -4], max: [4, 10] });
    expect(mergeSketchSegmentBounds([])).toBeUndefined();

    const offset = 1e12;
    expect(
      getSketchSegmentBounds(
        resolve(arc("translated", [offset, offset], 2, 0, 180))
      )
    ).toEqual({ min: [offset - 2, offset], max: [offset + 2, offset + 2] });
  });
});
