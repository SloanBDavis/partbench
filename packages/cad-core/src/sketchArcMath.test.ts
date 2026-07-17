import { describe, expect, it } from "vitest";

import {
  SKETCH_GEOMETRY_POLICY,
  canonicalizeSketchArcDefinition,
  normalizeSketchArcStartAngleDegrees
} from "./index";

describe("V17 sketch arc math", () => {
  it("owns one frozen geometry policy in cad-core", () => {
    expect(SKETCH_GEOMETRY_POLICY).toEqual({
      linearTolerance: 1e-7,
      angularToleranceDegrees: 0.1,
      minimumProfileArea: 1e-12
    });
    expect(Object.isFrozen(SKETCH_GEOMETRY_POLICY)).toBe(true);
  });

  it("canonicalizes start angles and negative zero", () => {
    expect(normalizeSketchArcStartAngleDegrees(-90)).toBe(270);
    expect(normalizeSketchArcStartAngleDegrees(720)).toBe(0);
    expect(Object.is(normalizeSketchArcStartAngleDegrees(-0), -0)).toBe(false);
  });

  it("deterministically chooses the signed sweep through the middle point", () => {
    const counterClockwise = canonicalizeSketchArcDefinition({
      kind: "threePoint",
      start: [1, 0],
      pointOnArc: [0, 1],
      end: [-1, 0]
    });
    const clockwise = canonicalizeSketchArcDefinition({
      kind: "threePoint",
      start: [1, 0],
      pointOnArc: [0, -1],
      end: [-1, 0]
    });

    expect(counterClockwise).toMatchObject({
      ok: true,
      value: { startAngleDegrees: 0, sweepAngleDegrees: 180 }
    });
    expect(clockwise).toMatchObject({
      ok: true,
      value: { startAngleDegrees: 0, sweepAngleDegrees: -180 }
    });
  });

  it("preserves both directions across the zero-degree wraparound", () => {
    const pointAt = (degrees: number): readonly [number, number] => {
      const radians = (degrees * Math.PI) / 180;
      return [Math.cos(radians), Math.sin(radians)];
    };
    const counterClockwise = canonicalizeSketchArcDefinition({
      kind: "threePoint",
      start: pointAt(350),
      pointOnArc: pointAt(0),
      end: pointAt(10)
    });
    const clockwise = canonicalizeSketchArcDefinition({
      kind: "threePoint",
      start: pointAt(10),
      pointOnArc: pointAt(0),
      end: pointAt(350)
    });

    expect(counterClockwise.ok).toBe(true);
    expect(clockwise.ok).toBe(true);
    if (!counterClockwise.ok || !clockwise.ok) return;
    expect(counterClockwise.value.startAngleDegrees).toBeCloseTo(350, 10);
    expect(counterClockwise.value.sweepAngleDegrees).toBeCloseTo(20, 10);
    expect(clockwise.value.startAngleDegrees).toBeCloseTo(10, 10);
    expect(clockwise.value.sweepAngleDegrees).toBeCloseTo(-20, 10);
  });

  it("rejects coincident and collinear three-point definitions", () => {
    expect(
      canonicalizeSketchArcDefinition({
        kind: "threePoint",
        start: [0, 0],
        pointOnArc: [0, 0],
        end: [1, 0]
      })
    ).toMatchObject({
      ok: false,
      issues: [{ code: "SKETCH_ARC_POINTS_COINCIDENT", path: "definition" }]
    });
    expect(
      canonicalizeSketchArcDefinition({
        kind: "threePoint",
        start: [0, 0],
        pointOnArc: [1, 0],
        end: [2, 0]
      })
    ).toMatchObject({
      ok: false,
      issues: [{ code: "SKETCH_ARC_THREE_POINT_COLLINEAR", path: "definition" }]
    });
  });

  it("accepts exact angular bounds and rejects values immediately outside them", () => {
    const canonicalizeSweep = (sweepAngleDegrees: number) =>
      canonicalizeSketchArcDefinition({
        kind: "centerAngles",
        center: [0, 0],
        radius: 1,
        startAngleDegrees: -10,
        sweepAngleDegrees
      });

    for (const sweep of [0.1, -0.1, 359.9, -359.9]) {
      expect(canonicalizeSweep(sweep)).toMatchObject({
        ok: true,
        value: { startAngleDegrees: 350, sweepAngleDegrees: sweep }
      });
    }
    for (const sweep of [0.099999, -0.099999, 359.900001, -359.900001]) {
      expect(canonicalizeSweep(sweep)).toMatchObject({
        ok: false,
        issues: [{ code: "SKETCH_ARC_SWEEP_INVALID" }]
      });
    }
    for (const sweep of [359.99, -359.99]) {
      expect(canonicalizeSweep(sweep)).toMatchObject({
        ok: false,
        issues: [{ code: "SKETCH_ARC_SWEEP_INVALID" }]
      });
    }
    for (const sweep of [360, -360]) {
      expect(canonicalizeSweep(sweep)).toMatchObject({
        ok: false,
        issues: [{ code: "SKETCH_ARC_FULL_CIRCLE_USE_CIRCLE" }]
      });
    }
    expect(canonicalizeSweep(Number.POSITIVE_INFINITY)).toMatchObject({
      ok: false,
      issues: [
        {
          code: "SKETCH_ARC_SWEEP_INVALID",
          path: "definition.sweepAngleDegrees"
        }
      ]
    });
    expect(
      canonicalizeSketchArcDefinition({
        kind: "centerAngles",
        center: [0, 0],
        radius: Number.NaN,
        startAngleDegrees: 0,
        sweepAngleDegrees: 90
      })
    ).toMatchObject({
      ok: false,
      issues: [{ code: "SKETCH_ARC_RADIUS_INVALID", path: "definition.radius" }]
    });
  });

  it("reports exact authored field paths for invalid radius and sweep", () => {
    expect(
      canonicalizeSketchArcDefinition({
        kind: "centerAngles",
        center: [0, 0],
        radius: 0,
        startAngleDegrees: 0,
        sweepAngleDegrees: 90
      })
    ).toMatchObject({
      ok: false,
      issues: [{ code: "SKETCH_ARC_RADIUS_INVALID", path: "definition.radius" }]
    });
    expect(
      canonicalizeSketchArcDefinition({
        kind: "centerAngles",
        center: [0, 0],
        radius: 1,
        startAngleDegrees: 0,
        sweepAngleDegrees: 360
      })
    ).toMatchObject({
      ok: false,
      issues: [
        {
          code: "SKETCH_ARC_FULL_CIRCLE_USE_CIRCLE",
          path: "definition.sweepAngleDegrees"
        }
      ]
    });
  });
});
