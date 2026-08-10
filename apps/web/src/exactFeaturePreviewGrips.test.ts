import { describe, expect, it } from "vitest";
import type { CadFeatureSummary } from "@web-cad/cad-protocol";
import {
  EXACT_FEATURE_PREVIEW_GRIP_NON_FEATURE_POLICY,
  EXACT_FEATURE_PREVIEW_GRIP_POLICY,
  EXACT_FEATURE_PREVIEW_GRIP_SOURCE_FAMILY,
  classifyExactFeaturePreviewGripDraftField,
  getExactFeaturePreviewGripPolicy,
  getExactFeaturePreviewGripPolicyForSource,
  isExactFeaturePreviewGripDraftFieldBound,
  type ExactFeaturePreviewGripFeatureFamily,
  type ExactFeaturePreviewGripNonFeatureFamily,
  type ExactFeaturePreviewGripSourceType
} from "./exactFeaturePreviewGrips";

const FEATURE_FAMILIES = [
  "primitive",
  "extrude",
  "revolve",
  "hole",
  "chamfer",
  "fillet",
  "importedBody",
  "linearPattern",
  "circularPattern",
  "mirror",
  "shell",
  "sweep",
  "loft"
] as const satisfies readonly ExactFeaturePreviewGripFeatureFamily[];

const SOURCE_TYPES = [
  "primitiveFeature",
  "sketchExtrudeFeature",
  "sketchRevolveFeature",
  "sketchHoleFeature",
  "edgeChamferFeature",
  "edgeFilletFeature",
  "linearPatternFeature",
  "circularPatternFeature",
  "mirrorFeature",
  "shellFeature",
  "sweepFeature",
  "loftFeature",
  "importedStepBody"
] as const satisfies readonly ExactFeaturePreviewGripSourceType[];

const NON_FEATURE_FAMILIES = [
  "delete",
  "suppress",
  "reorder",
  "unsupported"
] as const satisfies readonly ExactFeaturePreviewGripNonFeatureFamily[];

function createHoleFeature(
  depthMode: "blind" | "throughAll"
): Extract<CadFeatureSummary, { kind: "hole" }> {
  return {
    id: "hole-feature",
    kind: "hole",
    partId: "part",
    bodyId: "body",
    targetBodyId: "body",
    name: "Hole",
    sketchId: "sketch",
    circleEntityId: "circle",
    depthMode,
    depth: depthMode === "blind" ? 4 : undefined,
    direction: "positive",
    source: {
      type: "sketchCircleHole",
      sketchId: "sketch",
      circleEntityId: "circle",
      targetBodyId: "body"
    }
  };
}

describe("exact feature preview/grip policy", () => {
  it("is exhaustive over the existing feature families and source types", () => {
    expect(Object.keys(EXACT_FEATURE_PREVIEW_GRIP_POLICY)).toEqual(
      FEATURE_FAMILIES
    );
    expect(Object.keys(EXACT_FEATURE_PREVIEW_GRIP_SOURCE_FAMILY)).toEqual(
      SOURCE_TYPES
    );

    for (const family of FEATURE_FAMILIES) {
      expect(EXACT_FEATURE_PREVIEW_GRIP_POLICY[family]).toBeDefined();
    }
    for (const sourceType of SOURCE_TYPES) {
      expect(
        getExactFeaturePreviewGripPolicyForSource(sourceType)
      ).toBeDefined();
    }
  });

  it("keeps only the blind-depth grip for blind holes", () => {
    expect(getExactFeaturePreviewGripPolicy(createHoleFeature("blind"))).toEqual(
      EXACT_FEATURE_PREVIEW_GRIP_POLICY.hole
    );
    expect(
      getExactFeaturePreviewGripPolicy(createHoleFeature("throughAll"))
    ).toMatchObject({
      create: "must",
      update: "must",
      grips: [],
      valueEditors: []
    });
  });

  it("keeps lifecycle and unsupported rows without a new promise", () => {
    expect(Object.keys(EXACT_FEATURE_PREVIEW_GRIP_NON_FEATURE_POLICY)).toEqual(
      NON_FEATURE_FAMILIES
    );
    for (const family of NON_FEATURE_FAMILIES) {
      expect(EXACT_FEATURE_PREVIEW_GRIP_NON_FEATURE_POLICY[family]).toEqual({
        create: "none",
        update: "none",
        grips: [],
        valueEditors: []
      });
    }
  });

  it("routes parameter-bound and expression-bound drafts to their owner", () => {
    const parameterBound = {
      value: 12,
      binding: { kind: "parameter" as const, parameterId: "wall" }
    };
    const expressionBound = {
      value: 24,
      binding: {
        kind: "expression" as const,
        expression: "wall * 2",
        parameterId: "doubleWall"
      }
    };

    expect(classifyExactFeaturePreviewGripDraftField(parameterBound)).toEqual({
      status: "readOnly",
      route: "route-to-owner",
      value: 12,
      binding: parameterBound.binding
    });
    expect(classifyExactFeaturePreviewGripDraftField(expressionBound)).toEqual(
      {
        status: "readOnly",
        route: "route-to-owner",
        value: 24,
        binding: expressionBound.binding
      }
    );
    expect(isExactFeaturePreviewGripDraftFieldBound(parameterBound)).toBe(true);
    expect(isExactFeaturePreviewGripDraftFieldBound(expressionBound)).toBe(true);
    expect(classifyExactFeaturePreviewGripDraftField({ value: 8 })).toEqual({
      status: "editable",
      value: 8
    });
  });
});
