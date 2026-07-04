import type { CadBodySnapshot, CadFeatureSummary } from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import {
  createCircularPatternDefaultName,
  createLinearPatternDefaultName,
  formatPatternAxisLabel,
  getPatternPanelState
} from "./patternPanelUi";

function createBody(
  id: string,
  featureId: string,
  options: {
    readonly consumedByFeatureId?: string;
    readonly sourceType?:
      | "sketchExtrudeFeature"
      | "importedStepBody"
      | "primitiveFeature";
  } = {}
): CadBodySnapshot {
  return {
    id,
    kind: "solid",
    partId: "part:default",
    featureId,
    ...(options.consumedByFeatureId
      ? { consumedByFeatureId: options.consumedByFeatureId }
      : {}),
    source:
      options.sourceType === "importedStepBody"
        ? {
            type: "importedStepBody",
            featureId,
            sourceFileName: "fixture.step",
            checkpointId: "checkpoint_1"
          }
        : options.sourceType === "primitiveFeature"
          ? {
              type: "primitiveFeature",
              featureId,
              objectId: "box_1"
            }
          : {
              type: options.sourceType ?? "sketchExtrudeFeature",
              featureId,
              sketchId: "sketch_1",
              entityId: "rect_1",
              profileKind: "rectangle"
            }
  };
}

function createImportedBodyFeature(): Extract<
  CadFeatureSummary,
  { kind: "importedBody" }
> {
  return {
    id: "feat_import",
    kind: "importedBody",
    partId: "part:default",
    bodyId: "body_import",
    sourceFileName: "fixture.step",
    sourceFormat: "step",
    checkpointId: "checkpoint_1",
    healingApplied: true,
    source: {
      type: "importedStepBody",
      sourceFileName: "fixture.step",
      checkpointId: "checkpoint_1"
    }
  };
}

function createExtrudeFeature(
  id: string,
  bodyId: string
): Extract<CadFeatureSummary, { kind: "extrude" }> {
  return {
    id,
    kind: "extrude",
    partId: "part:default",
    bodyId,
    sketchId: "sketch_1",
    entityId: "rect_1",
    profileKind: "rectangle",
    depth: 1,
    side: "positive",
    operationMode: "newBody",
    source: {
      type: "sketchEntity",
      sketchId: "sketch_1",
      entityId: "rect_1"
    }
  };
}

function createLinearPatternFeature(): Extract<
  CadFeatureSummary,
  { kind: "linearPattern" }
> {
  return {
    id: "feat_linear",
    kind: "linearPattern",
    partId: "part:default",
    bodyId: "body_linear",
    seedBodyId: "body_seed",
    axis: "y",
    spacing: 12,
    instanceCount: 5,
    source: {
      type: "linearPatternFeature",
      seedBodyId: "body_seed",
      axis: "y"
    }
  };
}

function createCircularPatternFeature(): Extract<
  CadFeatureSummary,
  { kind: "circularPattern" }
> {
  return {
    id: "feat_circular",
    kind: "circularPattern",
    partId: "part:default",
    bodyId: "body_circular",
    seedBodyId: "body_seed",
    rotationAxis: "z",
    totalAngleDegrees: 270,
    instanceCount: 8,
    source: {
      type: "circularPatternFeature",
      seedBodyId: "body_seed",
      rotationAxis: "z"
    }
  };
}

describe("pattern panel UI state", () => {
  it("allows supported active bodies to seed patterns", () => {
    expect(
      getPatternPanelState(
        createBody("body_import", "feat_import", {
          sourceType: "importedStepBody"
        }),
        createImportedBodyFeature()
      )
    ).toEqual({
      mode: "create",
      seedBodyId: "body_import",
      seedLabel: "body_import"
    });
  });

  it("exposes linear and circular pattern edit state from selected features", () => {
    expect(
      getPatternPanelState(
        createBody("body_linear", "feat_linear"),
        createLinearPatternFeature()
      )
    ).toEqual({
      mode: "editLinear",
      featureId: "feat_linear",
      seedBodyId: "body_seed",
      seedLabel: "body_seed",
      axis: "y",
      spacing: 12,
      instanceCount: 5
    });

    expect(
      getPatternPanelState(
        createBody("body_circular", "feat_circular"),
        createCircularPatternFeature()
      )
    ).toEqual({
      mode: "editCircular",
      featureId: "feat_circular",
      seedBodyId: "body_seed",
      seedLabel: "body_seed",
      rotationAxis: "z",
      totalAngleDegrees: 270,
      instanceCount: 8
    });
  });

  it("blocks consumed and primitive-derived seed bodies", () => {
    expect(
      getPatternPanelState(
        createBody("body_seed", "feat_seed", {
          consumedByFeatureId: "feat_cut"
        }),
        createExtrudeFeature("feat_seed", "body_seed")
      )
    ).toEqual({
      mode: "unavailable",
      reason:
        "Body body_seed is consumed by feature feat_cut and cannot seed a pattern."
    });

    expect(
      getPatternPanelState(
        createBody("body_box", "feat_box", { sourceType: "primitiveFeature" }),
        undefined
      )
    ).toEqual({
      mode: "unavailable",
      reason: "Primitive-derived bodies cannot seed a pattern."
    });
  });

  it("formats axis labels and default names", () => {
    expect(formatPatternAxisLabel("x")).toBe("X");
    expect(createLinearPatternDefaultName("Body 1", "y")).toBe(
      "Linear pattern Body 1 along Y"
    );
    expect(createCircularPatternDefaultName("Body 1", "z")).toBe(
      "Circular pattern Body 1 around Z"
    );
  });
});
