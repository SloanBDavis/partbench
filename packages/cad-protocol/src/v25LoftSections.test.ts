import { describe, expect, it } from "vitest";
import {
  CAD_V19_PROJECT_SCHEMA_VERSION,
  type CadOp,
  type FeatureLoftOp,
  type LoftSection
} from "./index";

describe("feature.loft non-parallel sections protocol", () => {
  it("grows the existing sections collector for non-parallel planes without a schema bump", () => {
    const sections: readonly LoftSection[] = [
      { sketchId: "sketch_xy", entityId: "xy_circle" },
      { sketchId: "sketch_xz", entityId: "xz_circle" }
    ];
    const loft: FeatureLoftOp = {
      op: "feature.loft",
      id: "feat_loft_nonparallel",
      bodyId: "body_loft_nonparallel",
      sections
    };
    const ops: readonly CadOp[] = [loft];

    expect(ops.map((op) => op.op)).toEqual(["feature.loft"]);
    expect(loft.sections).toHaveLength(2);
    expect(loft.sections[0]?.sketchId).toBe("sketch_xy");
    expect(loft.sections[1]?.sketchId).toBe("sketch_xz");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).toBe("web-cad.project.v22");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).not.toBe("web-cad.project.v23");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).not.toBe("web-cad.project.v25");
  });
});
