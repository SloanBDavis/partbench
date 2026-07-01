import { describe, expect, it } from "vitest";
import { createDefaultFeatureHoleForm } from "./featureFormDefaults";

describe("feature form defaults", () => {
  it("uses one through-all default for hole creation forms", () => {
    expect(createDefaultFeatureHoleForm()).toEqual({
      id: "",
      bodyId: "",
      targetBodyId: "",
      name: "",
      depthMode: "throughAll",
      depth: 1,
      direction: "positive"
    });
  });

  it("returns a fresh hole form for each caller", () => {
    expect(createDefaultFeatureHoleForm()).not.toBe(
      createDefaultFeatureHoleForm()
    );
  });
});
