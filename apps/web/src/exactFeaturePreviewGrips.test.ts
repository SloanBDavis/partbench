import { describe, expect, it } from "vitest";
import type { CadFeatureSummary } from "@web-cad/cad-protocol";
import { CAD_PATTERN_COMMAND_INSTANCE_LIMIT } from "@web-cad/cad-core";
import {
  EXACT_FEATURE_PREVIEW_GRIP_NON_FEATURE_POLICY,
  EXACT_FEATURE_PREVIEW_GRIP_POLICY,
  EXACT_FEATURE_PREVIEW_GRIP_SOURCE_FAMILY,
  applyExactFeaturePreviewGripValue,
  classifyExactFeaturePreviewGripDraftField,
  createExactFeaturePreviewGripDescriptors,
  getExactFeaturePreviewGripPolicy,
  getExactFeaturePreviewGripPolicyForSource,
  isExactFeaturePreviewGripDraftFieldBound,
  type ExactFeaturePreviewGripFeatureFamily,
  type ExactFeaturePreviewGripNonFeatureFamily,
  type ExactFeaturePreviewGripSourceType
} from "./exactFeaturePreviewGrips";
import type { SolidEditorSubmission } from "./modes/solid/solidEditorTypes";

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

function submission<K extends SolidEditorSubmission["kind"]>(
  kind: K,
  draft: Extract<SolidEditorSubmission, { kind: K }>["draft"]
): Extract<SolidEditorSubmission, { kind: K }> {
  return { kind, draft } as Extract<SolidEditorSubmission, { kind: K }>;
}

const EXTRUDE = submission("extrude", {
  id: "extrude",
  bodyId: "body",
  name: "Extrude",
  depth: 12,
  side: "positive",
  operationMode: "newBody"
});

const REVOLVE = submission("revolve", {
  id: "revolve",
  bodyId: "body",
  name: "Revolve",
  axisEntityId: "axis",
  angleDegrees: 90
});

const BLIND_HOLE = submission("hole", {
  id: "hole",
  bodyId: "body",
  targetBodyId: "target",
  name: "Hole",
  depthMode: "blind",
  depth: 4,
  direction: "positive"
});

const LINEAR_PATTERN = submission("linearPattern", {
  id: "linear",
  bodyId: "body",
  seedBodyId: "seed",
  name: "Linear",
  direction: { kind: "globalAxis", axis: "x" },
  spacing: 6,
  instanceCount: 3
});

const CIRCULAR_PATTERN = submission("circularPattern", {
  id: "circular",
  bodyId: "body",
  seedBodyId: "seed",
  name: "Circular",
  rotationAxis: { kind: "globalAxis", axis: "z" },
  totalAngleDegrees: 180,
  instanceCount: 4
});

const MIRROR = submission("mirror", {
  id: "mirror",
  bodyId: "body",
  seedBodyId: "seed",
  name: "Mirror",
  plane: { kind: "standardPlane", plane: "XY" },
  includeOriginal: true
});

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

  it("maps every frozen direct-grip field with the document length unit", () => {
    expect(
      createExactFeaturePreviewGripDescriptors(EXTRUDE, {
        lengthUnitLabel: "mm"
      })
    ).toEqual([
      expect.objectContaining({
        id: "depth",
        value: 12,
        unit: "mm",
        min: expect.any(Number)
      })
    ]);
    expect(
      createExactFeaturePreviewGripDescriptors(REVOLVE, {
        lengthUnitLabel: "mm"
      })
    ).toEqual([
      expect.objectContaining({
        id: "angle",
        value: 90,
        unit: "°",
        min: 0,
        max: 360
      })
    ]);
    expect(
      createExactFeaturePreviewGripDescriptors(BLIND_HOLE, {
        lengthUnitLabel: "in"
      })
    ).toEqual([
      expect.objectContaining({
        id: "blindDepth",
        value: 4,
        unit: "in"
      })
    ]);
    expect(
      createExactFeaturePreviewGripDescriptors(
        submission("chamfer", {
          id: "chamfer",
          bodyId: "body",
          targetBodyId: "target",
          name: "Chamfer",
          edgeStableId: "edge",
          distance: 1,
          radius: 2
        }),
        { lengthUnitLabel: "mm" }
      )[0]
    ).toMatchObject({ id: "distance", value: 1, unit: "mm" });
    expect(
      createExactFeaturePreviewGripDescriptors(
        submission("fillet", {
          id: "fillet",
          bodyId: "body",
          targetBodyId: "target",
          name: "Fillet",
          edgeStableId: "edge",
          distance: 1,
          radius: 2
        }),
        { lengthUnitLabel: "mm" }
      )[0]
    ).toMatchObject({ id: "radius", value: 2, unit: "mm" });
    expect(
      createExactFeaturePreviewGripDescriptors(LINEAR_PATTERN, {
        lengthUnitLabel: "mm"
      }).map(
        (grip) => [grip.id, grip.value, grip.unit]
      )
    ).toEqual([
      ["spacing", 6, "mm"],
      ["count", 3, "instances"]
    ]);
    expect(
      createExactFeaturePreviewGripDescriptors(CIRCULAR_PATTERN, {
        lengthUnitLabel: "mm"
      }).map(
        (grip) => [grip.id, grip.value, grip.unit]
      )
    ).toEqual([
      ["totalAngle", 180, "°"],
      ["count", 4, "instances"]
    ]);
    expect(
      createExactFeaturePreviewGripDescriptors(MIRROR, {
        lengthUnitLabel: "mm"
      })[0]
    ).toMatchObject({ id: "planeOffset", value: 0, unit: "mm" });
    expect(
      createExactFeaturePreviewGripDescriptors(
        submission("shell", {
          id: "shell",
          bodyId: "body",
          targetBodyId: "target",
          name: "Shell",
          wallThickness: 0.5,
          openFaceRefs: []
        }),
        { lengthUnitLabel: "mm" }
      )[0]
    ).toMatchObject({ id: "wallThickness", value: 0.5, unit: "mm" });
    expect(
      createExactFeaturePreviewGripDescriptors(
        submission("sweep", {
          id: "sweep",
          bodyId: "body",
          name: "Sweep",
          pathSketchId: "path",
          pathEntityIds: ["edge"]
        }),
        { lengthUnitLabel: "mm" }
      )
    ).toEqual([]);
    expect(
      createExactFeaturePreviewGripDescriptors(
        submission("loft", {
          id: "loft",
          bodyId: "body",
          name: "Loft",
          sections: []
        }),
        { lengthUnitLabel: "mm" }
      )
    ).toEqual([]);
  });

  it("omits the blind-depth descriptor for through-all holes", () => {
    const throughAll = submission("hole", {
      ...BLIND_HOLE.draft,
      depthMode: "throughAll"
    });
    expect(
      createExactFeaturePreviewGripDescriptors(throughAll, {
        lengthUnitLabel: "mm"
      })
    ).toEqual([]);
  });

  it("marks pattern counts typed-only while retaining editable value input", () => {
    const linearCount = createExactFeaturePreviewGripDescriptors(
      LINEAR_PATTERN,
      { lengthUnitLabel: "mm" }
    )[1]!;
    const circularCount = createExactFeaturePreviewGripDescriptors(
      CIRCULAR_PATTERN,
      { lengthUnitLabel: "mm" }
    )[1]!;
    for (const count of [linearCount, circularCount]) {
      expect(count.dragDisabled).toBe(true);
      expect(count.integerOnly).toBe(true);
      expect(count.readOnly).not.toBe(true);
      expect(count.routeToOwnerLabel).toBeUndefined();
      expect(count.min).toBe(2);
      expect(count.max).toBe(CAD_PATTERN_COMMAND_INSTANCE_LIMIT);
    }
  });

  it("applies valid values immutably and preserves the submission discriminant", () => {
    const changed = applyExactFeaturePreviewGripValue(
      LINEAR_PATTERN,
      "spacing",
      9
    );
    expect(changed).toMatchObject({
      kind: "linearPattern",
      draft: { spacing: 9, instanceCount: 3, seedBodyId: "seed" }
    });
    expect(changed).not.toBe(LINEAR_PATTERN);
    expect(LINEAR_PATTERN.draft.spacing).toBe(6);

    const mirrorWithOffset = applyExactFeaturePreviewGripValue(
      MIRROR,
      "planeOffset",
      -3
    );
    expect(mirrorWithOffset).toMatchObject({
      kind: "mirror",
      draft: { plane: { plane: "XY", offset: -3 } }
    });
    expect(MIRROR.draft.plane.offset).toBeUndefined();
  });

  it("rejects invalid, nonfinite, out-of-range, and non-integer grip values", () => {
    expect(applyExactFeaturePreviewGripValue(EXTRUDE, "depth", 0)).toBeUndefined();
    expect(
      applyExactFeaturePreviewGripValue(EXTRUDE, "depth", Number.NaN)
    ).toBeUndefined();
    expect(
      applyExactFeaturePreviewGripValue(REVOLVE, "angle", Number.POSITIVE_INFINITY)
    ).toBeUndefined();
    expect(applyExactFeaturePreviewGripValue(REVOLVE, "angle", 361)).toBeUndefined();
    expect(
      applyExactFeaturePreviewGripValue(CIRCULAR_PATTERN, "totalAngle", 0)
    ).toBeUndefined();
    expect(
      applyExactFeaturePreviewGripValue(
        LINEAR_PATTERN,
        "count",
        2.5
      )
    ).toBeUndefined();
    expect(
      applyExactFeaturePreviewGripValue(
        LINEAR_PATTERN,
        "count",
        CAD_PATTERN_COMMAND_INSTANCE_LIMIT + 1
      )
    ).toBeUndefined();
    expect(
      applyExactFeaturePreviewGripValue(MIRROR, "planeOffset", Number.NaN)
    ).toBeUndefined();
  });

  it("protects caller-supplied parameter and expression bindings", () => {
    const bindings = {
      depth: {
        kind: "parameter" as const,
        parameterId: "depthParameter"
      },
      angle: {
        kind: "expression" as const,
        expression: "sweep * 2",
        parameterId: "doubleSweep"
      }
    };
    const boundDepth = createExactFeaturePreviewGripDescriptors(
      EXTRUDE,
      { lengthUnitLabel: "mm", bindings }
    )[0]!;
    expect(boundDepth).toMatchObject({
      readOnly: true,
      routeToOwnerLabel: "Edit parameter depthParameter in Parameters"
    });
    expect(
      applyExactFeaturePreviewGripValue(EXTRUDE, boundDepth.id, 8, bindings)
    ).toBeUndefined();
    expect(
      applyExactFeaturePreviewGripValue(EXTRUDE, "depth", 8, bindings)
    ).toBeUndefined();

    const boundAngle = createExactFeaturePreviewGripDescriptors(
      REVOLVE,
      { lengthUnitLabel: "mm", bindings }
    )[0]!;
    expect(boundAngle).toMatchObject({
      readOnly: true,
      routeToOwnerLabel: "Edit parameter doubleSweep in Parameters"
    });
    expect(
      applyExactFeaturePreviewGripValue(REVOLVE, boundAngle.id, 120, bindings)
    ).toBeUndefined();
  });
});
