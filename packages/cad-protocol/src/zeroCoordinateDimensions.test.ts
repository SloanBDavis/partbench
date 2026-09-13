import { describe, expect, it } from "vitest";
import { validateV19CadOp } from "./index";

const points = {
  primary: { entityId: "origin", entityKind: "point", role: "position" },
  secondary: { entityId: "center", entityKind: "circle", role: "center" }
};
const command = (target: unknown, value: number) => ({
  op: "sketch.dimension.create",
  sketchId: "profile",
  name: "Coordinate",
  target,
  value
});

describe("directed coordinate domains", () => {
  it("accepts zero and small nonnegative horizontal/vertical magnitudes in either direction", () => {
    for (const measurement of ["horizontal", "vertical"])
      for (const direction of ["positive", "negative"]) {
        const target = { kind: "pointPair", ...points, measurement, direction };
        expect(validateV19CadOp(command(target, 0)).ok).toBe(true);
        expect(validateV19CadOp(command(target, 1e-8)).ok).toBe(true);
        expect(validateV19CadOp(command(target, -1)).ok).toBe(false);
      }
  });
  it("retains the nonzero Euclidean and point-line distance domains", () => {
    expect(
      validateV19CadOp(
        command({ kind: "pointPair", ...points, measurement: "distance" }, 0)
      ).ok
    ).toBe(false);
    expect(
      validateV19CadOp(
        command(
          {
            kind: "pointLineDistance",
            point: points.secondary,
            lineEntityId: "axis",
            side: "left"
          },
          0
        )
      ).ok
    ).toBe(false);
  });
});
