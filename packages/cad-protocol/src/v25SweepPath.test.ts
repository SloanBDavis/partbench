import { describe, expect, it } from "vitest";
import {
  CAD_V19_PROJECT_SCHEMA_VERSION,
  type CadOp,
  type FeatureSweepCommandInput,
  type SketchPathRef
} from "./index";

describe("feature.sweep composite path protocol", () => {
  it("grows the existing path collector for line/arc plus spline without a schema bump", () => {
    const path: SketchPathRef = {
      kind: "chain",
      sketchId: "sketch_path",
      segments: [
        { entityId: "path_line", orientation: "forward" },
        { entityId: "path_spline", orientation: "forward" }
      ]
    };
    const sweep: FeatureSweepCommandInput = {
      op: "feature.sweep",
      id: "feat_sweep_composite",
      bodyId: "body_sweep_composite",
      profile: {
        kind: "entity",
        sketchId: "sketch_profile",
        entityId: "profile_circle"
      },
      path
    };
    const ops: readonly CadOp[] = [sweep];

    expect(ops.map((op) => op.op)).toEqual(["feature.sweep"]);
    expect(sweep.path.kind).toBe("chain");
    expect(sweep.path.kind === "chain" && sweep.path.segments).toHaveLength(2);
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).toBe("web-cad.project.v22");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).not.toBe("web-cad.project.v23");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).not.toBe("web-cad.project.v25");
  });
});
