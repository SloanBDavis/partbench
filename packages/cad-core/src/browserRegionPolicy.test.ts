import { describe, expect, it } from "vitest";

import { CadEngine } from "./browser";
import "./regionSourceValidationPolicy";

describe("browser-main V19 region policy boundary", () => {
  it("keeps complete candidate discovery and legacy correlation unavailable", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      {
        op: "sketch.create",
        id: "sketch_1",
        name: "Browser boundary",
        plane: "XY"
      },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_1",
        id: "circle_1",
        center: [0, 0],
        radius: 2
      }
    ]);

    const legacy = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "sketch.profileCandidates",
        sketchId: "sketch_1"
      }
    });
    expect(legacy.ok).toBe(true);
    expect(legacy.query).toBe("sketch.profileCandidates");
    if (legacy.ok && legacy.query === "sketch.profileCandidates") {
      expect(
        legacy.candidates.every(
          (candidate) => candidate.regionCandidateKey === undefined
        )
      ).toBe(true);
    }

    const regions = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "sketch.profileRegionCandidates",
        sketchId: "sketch_1"
      }
    });
    expect(regions).toMatchObject({
      ok: false,
      query: "sketch.profileRegionCandidates",
      error: { code: "INVALID_QUERY" }
    });
  });
});
