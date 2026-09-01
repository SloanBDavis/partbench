import { describe, expect, it } from "vitest";
import {
  CAD_V19_PROJECT_SCHEMA_VERSION,
  CAD_EXPORT_SOURCE_KIND_BY_BODY_SOURCE_TYPE,
  type CadOp,
  type CombineFeatureSnapshot,
  type FeatureCombineOp
} from "./index";

describe("feature.combine protocol", () => {
  it("names union and subtract of two completed solids without a schema bump", () => {
    const union: FeatureCombineOp = {
      op: "feature.combine",
      id: "feat_union",
      bodyId: "body_union",
      mode: "union",
      targetBodyId: "body_hub",
      toolBodyId: "body_step"
    };
    const subtract: FeatureCombineOp = {
      op: "feature.combine",
      mode: "subtract",
      targetBodyId: "body_stock",
      toolBodyId: "body_cutter"
    };
    const snapshot: CombineFeatureSnapshot = {
      id: "feat_union",
      kind: "combine",
      mode: "union",
      targetBodyId: "body_hub",
      toolBodyId: "body_step",
      bodyId: "body_union"
    };
    const ops: readonly CadOp[] = [union, subtract];

    expect(ops.map((op) => op.op)).toEqual(["feature.combine", "feature.combine"]);
    expect(union.mode).toBe("union");
    expect(subtract.mode).toBe("subtract");
    expect(snapshot.kind).toBe("combine");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).toBe("web-cad.project.v22");
    expect(CAD_EXPORT_SOURCE_KIND_BY_BODY_SOURCE_TYPE.combineFeature).toBe(
      "authoredCombine"
    );
  });
});
