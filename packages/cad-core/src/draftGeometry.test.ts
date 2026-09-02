import { describe, expect, it } from "vitest";
import { computeDraftGeometry } from "./draftGeometry";

describe("computeDraftGeometry", () => {
  it("tilts a cube side face at a non-zero angle instead of leaving the prism", () => {
    const result = computeDraftGeometry(
      [
        {
          plane: { point: [5, 0, 4], normal: [1, 0, 0] },
          spanAlongPull: 8,
          materialExtent: 10
        }
      ],
      { point: [0, 0, 0], normal: [0, 0, -1] },
      10
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pullDirection).toEqual([0, 0, 1]);
    expect(result.draftedFaces[0]?.plane.point).toEqual([5, 0, 0]);
    expect(result.draftedFaces[0]?.plane.normal[0]).toBeCloseTo(
      Math.cos((10 * Math.PI) / 180),
      9
    );
    expect(result.draftedFaces[0]?.plane.normal[2]).toBeCloseTo(
      Math.sin((10 * Math.PI) / 180),
      9
    );
    expect(result.draftedFaces[0]?.plane.normal[0]).not.toBe(1);
    expect(result.draftedFaces[0]?.plane.normal[2]).not.toBe(0);
  });

  it("fails when the taper would invert the solid", () => {
    const result = computeDraftGeometry(
      [
        {
          plane: { point: [5, 0, 4], normal: [1, 0, 0] },
          spanAlongPull: 8,
          materialExtent: 10
        }
      ],
      { point: [0, 0, 0], normal: [0, 0, 1] },
      60
    );
    expect(result).toMatchObject({ ok: false, code: "WOULD_INVERT" });
  });
});
