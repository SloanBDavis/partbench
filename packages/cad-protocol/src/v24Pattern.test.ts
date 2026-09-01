import { describe, expect, it } from "vitest";
import {
  CAD_V19_PROJECT_SCHEMA_VERSION,
  patternSeedSourceFields,
  readExclusivePatternSeed,
  type CadOp,
  type CircularPatternFeatureSnapshot,
  type FeatureCircularPatternOp,
  type FeatureLinearPatternOp,
  type LinearPatternFeatureSnapshot
} from "./index";

describe("feature pattern seed protocol", () => {
  it("grows linear/circular pattern seed as seedBodyId XOR seedFeatureId without a schema bump", () => {
    const bodySeed: FeatureLinearPatternOp = {
      op: "feature.linearPattern",
      id: "feat_linear",
      bodyId: "body_linear",
      seedBodyId: "body_seed",
      direction: { kind: "globalAxis", axis: "x" },
      spacing: 20,
      instanceCount: 3
    };
    const holeSeed: FeatureCircularPatternOp = {
      op: "feature.circularPattern",
      id: "feat_bolts",
      bodyId: "body_flange",
      seedFeatureId: "feat_bolt",
      rotationAxis: { kind: "globalAxis", axis: "z" },
      totalAngleDegrees: 360,
      instanceCount: 6
    };
    const bodySnapshot: LinearPatternFeatureSnapshot = {
      id: "feat_linear",
      kind: "linearPattern",
      seedBodyId: "body_seed",
      direction: { kind: "globalAxis", axis: "x" },
      spacing: 20,
      instanceCount: 3,
      bodyId: "body_linear"
    };
    const holeSnapshot: CircularPatternFeatureSnapshot = {
      id: "feat_bolts",
      kind: "circularPattern",
      seedFeatureId: "feat_bolt",
      rotationAxis: { kind: "globalAxis", axis: "z" },
      totalAngleDegrees: 360,
      instanceCount: 6,
      bodyId: "body_flange"
    };
    const ops: readonly CadOp[] = [bodySeed, holeSeed];

    expect(ops.map((op) => op.op)).toEqual([
      "feature.linearPattern",
      "feature.circularPattern"
    ]);
    expect(bodySeed.seedBodyId).toBe("body_seed");
    expect(bodySeed.seedFeatureId).toBeUndefined();
    expect(holeSeed.seedFeatureId).toBe("feat_bolt");
    expect(holeSeed.seedBodyId).toBeUndefined();
    expect(readExclusivePatternSeed(bodySeed)).toEqual({
      ok: true,
      seed: { seedBodyId: "body_seed" }
    });
    expect(readExclusivePatternSeed(holeSeed)).toEqual({
      ok: true,
      seed: { seedFeatureId: "feat_bolt" }
    });
    expect(readExclusivePatternSeed({})).toEqual({ ok: false });
    expect(
      readExclusivePatternSeed({
        seedBodyId: "body_seed",
        seedFeatureId: "feat_bolt"
      })
    ).toEqual({ ok: false });
    expect(patternSeedSourceFields(holeSnapshot)).toEqual({
      seedFeatureId: "feat_bolt"
    });
    expect(patternSeedSourceFields(bodySnapshot)).toEqual({
      seedBodyId: "body_seed"
    });
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).toBe("web-cad.project.v22");
  });
});
