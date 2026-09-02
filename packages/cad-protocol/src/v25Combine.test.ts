import { describe, expect, it } from "vitest";
import {
  CAD_V19_PROJECT_SCHEMA_VERSION,
  FEATURE_COMBINE_MODES,
  isFeatureCombineMode,
  type CadOp,
  type CombineFeatureSnapshot,
  type FeatureCombineOp
} from "./index";

describe("feature.combine intersect protocol", () => {
  it("grows FeatureCombineMode with intersect on the same op without a schema bump", () => {
    const intersect: FeatureCombineOp = {
      op: "feature.combine",
      id: "feat_intersect",
      bodyId: "body_overlap",
      mode: "intersect",
      targetBodyId: "body_block_a",
      toolBodyId: "body_block_b"
    };
    const snapshot: CombineFeatureSnapshot = {
      id: "feat_intersect",
      kind: "combine",
      mode: "intersect",
      targetBodyId: "body_block_a",
      toolBodyId: "body_block_b",
      bodyId: "body_overlap"
    };
    const ops: readonly CadOp[] = [intersect];

    expect(ops.map((op) => op.op)).toEqual(["feature.combine"]);
    expect(FEATURE_COMBINE_MODES).toEqual(["union", "subtract", "intersect"]);
    expect(isFeatureCombineMode("union")).toBe(true);
    expect(isFeatureCombineMode("subtract")).toBe(true);
    expect(isFeatureCombineMode("intersect")).toBe(true);
    expect(isFeatureCombineMode("common")).toBe(false);
    expect(intersect.mode).toBe("intersect");
    expect(snapshot.kind).toBe("combine");
    expect(snapshot.mode).toBe("intersect");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).toBe("web-cad.project.v22");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).not.toBe("web-cad.project.v23");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).not.toBe("web-cad.project.v25");
  });
});
