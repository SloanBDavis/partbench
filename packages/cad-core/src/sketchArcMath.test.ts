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
