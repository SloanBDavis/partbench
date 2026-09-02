import { describe, expect, it } from "vitest";
import {
  CAD_V19_PROJECT_SCHEMA_VERSION,
  isPatternedSeedFeatureKind,
  PATTERNED_SEED_FEATURE_KINDS,
  patternSeedSourceFields,
  readExclusivePatternSeed,
  type CadOp,
  type FeatureLinearPatternOp
} from "./index";

describe("feature pattern seed protocol", () => {
  it("reuses linear/circular pattern seedFeatureId for every frozen solid kind without a schema bump", () => {
    const addSeed: FeatureLinearPatternOp = {
      op: "feature.linearPattern",
      id: "feat_pattern",
      bodyId: "body_patterned",
      seedFeatureId: "feat_boss",
      direction: { kind: "globalAxis", axis: "x" },
      spacing: 16,
      instanceCount: 3
    };
    const ops: readonly CadOp[] = [addSeed];

    expect(ops.map((op) => op.op)).toEqual(["feature.linearPattern"]);
    expect(PATTERNED_SEED_FEATURE_KINDS).toEqual([
      "extrude",
      "revolve",
      "hole",
      "chamfer",
      "fillet",
      "combine",
      "shell",
      "sweep",
      "loft",
      "mirror"
    ]);
    expect(isPatternedSeedFeatureKind("chamfer")).toBe(true);
    expect(isPatternedSeedFeatureKind("fillet")).toBe(true);
    expect(isPatternedSeedFeatureKind("extrude")).toBe(true);
    expect(isPatternedSeedFeatureKind("hole")).toBe(true);
    expect(isPatternedSeedFeatureKind("linearPattern")).toBe(false);
    expect(isPatternedSeedFeatureKind("circularPattern")).toBe(false);
    expect(isPatternedSeedFeatureKind("offset")).toBe(false);
    expect(readExclusivePatternSeed(addSeed)).toEqual({
      ok: true,
      seed: { seedFeatureId: "feat_boss" }
    });
    expect(patternSeedSourceFields({ seedFeatureId: "feat_boss" })).toEqual({
      seedFeatureId: "feat_boss"
    });
    expect(addSeed.seedBodyId).toBeUndefined();
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).toBe("web-cad.project.v22");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).not.toBe("web-cad.project.v23");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).not.toBe("web-cad.project.v25");
  });
});
