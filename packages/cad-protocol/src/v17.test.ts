import { describe, expect, it } from "vitest";
import type {
  FeatureExtrudeCommandInput,
  FeatureInputReferenceSemanticDiff,
  FeatureSweepCommandInput,
  SketchArcEntity,
  SketchEntitySemanticDiff,
  SketchEntityV21,
  SketchPathRef,
  SketchProfileRef,
  SketchRadiusConstraintV21
} from "./index";
import {
  CAD_V17_PROJECT_SCHEMA_VERSION,
  SKETCH_GEOMETRY_POLICY,
  canonicalizeSketchArcDefinition,
  createCanonicalSketchArcEntity,
  normalizeSketchArcStartAngleDegrees,
  validateSketchArcEntity,
  validateSketchEntityV21,
  validateSketchPathRef,
  validateSketchPointTargetV21,
  validateSketchProfileRef,
  validateSketchRadiusConstraintV21,
  validateV21FeatureCommandSource
} from "./index";

function code(result: {
  readonly ok: boolean;
  readonly issues?: readonly { readonly code: string }[];
}) {
  return result.ok ? undefined : result.issues?.[0]?.code;
}

describe("V17 protocol foundations", () => {
  it("exports the V21 schema and normative geometry policy", () => {
    expect(CAD_V17_PROJECT_SCHEMA_VERSION).toBe("web-cad.project.v21");
    expect(SKETCH_GEOMETRY_POLICY).toEqual({
      linearTolerance: 1e-7,
      angularToleranceDegrees: 0.1,
      minimumProfileArea: 1e-12
    });
    expect(Object.isFrozen(SKETCH_GEOMETRY_POLICY)).toBe(true);
  });

  it("normalizes finite center-angle input and canonicalizes negative zero", () => {
    expect(normalizeSketchArcStartAngleDegrees(721)).toBe(1);
    expect(normalizeSketchArcStartAngleDegrees(-10)).toBe(350);
    expect(normalizeSketchArcStartAngleDegrees(-360)).toBe(0);
    expect(Object.is(normalizeSketchArcStartAngleDegrees(-360), -0)).toBe(
      false
    );

    const result = createCanonicalSketchArcEntity(
      "arc_1",
      {
        kind: "centerAngles",
        center: [-0, -0],
        radius: 2,
        startAngleDegrees: -450,
        sweepAngleDegrees: -90
      },
      true
    );
    expect(result).toEqual({
      ok: true,
      value: {
        id: "arc_1",
        kind: "arc",
        center: [0, 0],
        radius: 2,
        startAngleDegrees: 270,
        sweepAngleDegrees: -90,
        construction: true
      }
    });
    if (result.ok) {
      expect(Object.is(result.value.center[0], -0)).toBe(false);
      expect(Object.is(result.value.center[1], -0)).toBe(false);
    }
  });

  it("converts three-point arcs deterministically in both directions and across wraparound", () => {
    const ccw = canonicalizeSketchArcDefinition({
      kind: "threePoint",
      start: [1, 0],
      pointOnArc: [0, 1],
      end: [-1, 0]
    });
    const cw = canonicalizeSketchArcDefinition({
      kind: "threePoint",
      start: [1, 0],
      pointOnArc: [0, -1],
      end: [-1, 0]
    });
    const pointAt = (degrees: number) =>
      [
        Math.cos((degrees * Math.PI) / 180),
        Math.sin((degrees * Math.PI) / 180)
      ] as const;
    const wrapped = canonicalizeSketchArcDefinition({
      kind: "threePoint",
      start: pointAt(350),
      pointOnArc: pointAt(0),
      end: pointAt(10)
    });

    expect(ccw.ok && ccw.value.sweepAngleDegrees).toBeCloseTo(180, 10);
    expect(cw.ok && cw.value.sweepAngleDegrees).toBeCloseTo(-180, 10);
    expect(wrapped.ok && wrapped.value.startAngleDegrees).toBeCloseTo(350, 10);
    expect(wrapped.ok && wrapped.value.sweepAngleDegrees).toBeCloseTo(20, 10);
  });

  it("rejects coincident, collinear, and non-finite three-point definitions", () => {
    expect(
      code(
        canonicalizeSketchArcDefinition({
          kind: "threePoint",
          start: [0, 0],
          pointOnArc: [0, 0],
          end: [1, 1]
        })
      )
    ).toBe("SKETCH_ARC_POINTS_COINCIDENT");
    expect(
      code(
        canonicalizeSketchArcDefinition({
          kind: "threePoint",
          start: [0, 0],
          pointOnArc: [1, 1],
          end: [2, 2]
        })
      )
    ).toBe("SKETCH_ARC_THREE_POINT_COLLINEAR");
    expect(
      code(
        canonicalizeSketchArcDefinition({
          kind: "threePoint",
          start: [0, 0],
          pointOnArc: [1, Number.NaN],
          end: [2, 0]
        })
      )
    ).toBe("SKETCH_ARC_DEFINITION_INVALID");
  });

  it("enforces exact radius and signed sweep boundaries", () => {
    const make = (radius: number, sweepAngleDegrees: number) =>
      canonicalizeSketchArcDefinition({
        kind: "centerAngles",
        center: [0, 0],
        radius,
        startAngleDegrees: 0,
        sweepAngleDegrees
      });

    expect(make(1e-7, 90).ok).toBe(false);
    expect(make(1e-7 + Number.EPSILON, 90).ok).toBe(true);
    expect(make(1, 0.1).ok).toBe(true);
    expect(make(1, -0.1).ok).toBe(true);
    expect(make(1, 359.9).ok).toBe(true);
    expect(make(1, -359.9).ok).toBe(true);
    expect(code(make(1, 0.099))).toBe("SKETCH_ARC_SWEEP_INVALID");
    expect(code(make(1, 359.901))).toBe("SKETCH_ARC_SWEEP_INVALID");
    expect(code(make(1, 360))).toBe("SKETCH_ARC_FULL_CIRCLE_USE_CIRCLE");
    expect(code(make(1, -360))).toBe("SKETCH_ARC_FULL_CIRCLE_USE_CIRCLE");
  });

  it.each([
    {
      field: "center",
      center: [Number.POSITIVE_INFINITY, 0] as const,
      radius: 1,
      start: 0,
      sweep: 90
    },
    {
      field: "radius",
      center: [0, 0] as const,
      radius: Number.NaN,
      start: 0,
      sweep: 90
    },
    {
      field: "start",
      center: [0, 0] as const,
      radius: 1,
      start: Number.NEGATIVE_INFINITY,
      sweep: 90
    },
    {
      field: "sweep",
      center: [0, 0] as const,
      radius: 1,
      start: 0,
      sweep: Number.NaN
    }
  ])("rejects non-finite $field values", ({ center, radius, start, sweep }) => {
    expect(
      canonicalizeSketchArcDefinition({
        kind: "centerAngles",
        center,
        radius,
        startAngleDegrees: start,
        sweepAngleDegrees: sweep
      }).ok
    ).toBe(false);
  });

  it("requires stored V21 arcs to already use the canonical source shape", () => {
    const valid: SketchArcEntity = {
      id: "arc_1",
      kind: "arc",
      center: [0, 0],
      radius: 1,
      startAngleDegrees: 0,
      sweepAngleDegrees: -90,
      construction: false
    };
    expect(validateSketchArcEntity(valid)).toEqual({ ok: true, value: valid });

    for (const startAngleDegrees of [-1, 360, Number.NaN, -0]) {
      expect(
        code(validateSketchArcEntity({ ...valid, startAngleDegrees }))
      ).toBe("SCHEMA_V21_SOURCE_INVALID");
    }
    expect(
      code(validateSketchArcEntity({ ...valid, construction: "false" }))
    ).toBe("SKETCH_ENTITY_CONSTRUCTION_INVALID");
    expect(code(validateSketchArcEntity({ ...valid, end: [0, 1] }))).toBe(
      "SCHEMA_V21_SOURCE_INVALID"
    );
  });

  it("types construction explicitly on every normalized V21 sketch entity", () => {
    const entities: readonly SketchEntityV21[] = [
      { id: "p", kind: "point", point: [0, 0], construction: false },
      { id: "l", kind: "line", start: [0, 0], end: [1, 0], construction: true },
      {
        id: "r",
        kind: "rectangle",
        center: [0, 0],
        width: 1,
        height: 2,
        construction: false
      },
      {
        id: "c",
        kind: "circle",
        center: [0, 0],
        radius: 1,
        construction: false
      },
      {
        id: "a",
        kind: "arc",
        center: [0, 0],
        radius: 1,
        startAngleDegrees: 0,
        sweepAngleDegrees: 90,
        construction: true
      }
    ];
    expect(entities.map((entity) => entity.construction)).toEqual([
      false,
      true,
      false,
      false,
      true
    ]);
    expect(
      code(
        validateSketchEntityV21({
          id: "line_without_construction",
          kind: "line",
          start: [0, 0],
          end: [1, 0]
        })
      )
    ).toBe("SKETCH_ENTITY_CONSTRUCTION_INVALID");
  });

  it("validates exact profile and path reference shapes", () => {
    const profile: SketchProfileRef = {
      kind: "wire",
      sketchId: "sketch_1",
      segments: [
        { entityId: "line_1", orientation: "forward" },
        { entityId: "arc_1", orientation: "reverse" }
      ]
    };
    const path: SketchPathRef = {
      kind: "chain",
      sketchId: "sketch_1",
      segments: [
        { entityId: "line_1", orientation: "reverse" },
        { entityId: "arc_1", orientation: "forward" }
      ]
    };
    expect(validateSketchProfileRef(profile)).toEqual({
      ok: true,
      value: profile
    });
    expect(validateSketchPathRef(path)).toEqual({ ok: true, value: path });
    expect(code(validateSketchProfileRef({ ...profile, segments: [] }))).toBe(
      "SKETCH_PROFILE_EMPTY"
    );
    expect(
      code(
        validateSketchProfileRef({
          ...profile,
          segments: [
            { entityId: "line_1", orientation: "forward" },
            { entityId: "line_1", orientation: "reverse" }
          ]
        })
      )
    ).toBe("SKETCH_PROFILE_ENTITY_REPEATED");
    expect(
      code(
        validateSketchPathRef({
          kind: "entity",
          sketchId: "sketch_1",
          entityId: "arc_1",
          orientation: "sideways"
        })
      )
    ).toBe("SCHEMA_V21_SOURCE_INVALID");
    expect(
      code(
        validateSketchProfileRef({
          kind: "entity",
          sketchId: "sketch_1",
          entityId: "circle_1",
          segments: []
        })
      )
    ).toBe("SCHEMA_V21_SOURCE_INVALID");
  });

  it("rejects mixed and partial normalized/legacy feature source fields", () => {
    const entityProfile = {
      kind: "entity",
      sketchId: "sketch_1",
      entityId: "circle_1"
    } as const;
    const entityPath = {
      kind: "entity",
      sketchId: "path_sketch",
      entityId: "line_1",
      orientation: "forward"
    } as const;

    expect(
      validateV21FeatureCommandSource({
        op: "feature.extrude",
        profile: entityProfile,
        depth: 2
      }).ok
    ).toBe(true);
    expect(
      code(
        validateV21FeatureCommandSource({
          op: "feature.extrude",
          profile: entityProfile,
          sketchId: "sketch_1",
          entityId: "circle_1",
          depth: 2
        })
      )
    ).toBe("COMMAND_INPUT_AMBIGUOUS");
    expect(
      code(
        validateV21FeatureCommandSource({
          op: "feature.updateExtrude",
          id: "feature_1",
          profile: entityProfile,
          sketchId: "sketch_1",
          entityId: "circle_1"
        })
      )
    ).toBe("COMMAND_INPUT_AMBIGUOUS");
    expect(
      code(
        validateV21FeatureCommandSource({
          op: "feature.updateRevolve",
          id: "feature_1",
          sketchId: "sketch_1"
        })
      )
    ).toBe("SCHEMA_V21_SOURCE_INVALID");
    expect(
      code(
        validateV21FeatureCommandSource({
          op: "feature.updateSweep",
          id: "feature_1",
          path: entityPath,
          pathSketchId: "path_sketch",
          pathEntityIds: ["line_1"]
        })
      )
    ).toBe("COMMAND_INPUT_AMBIGUOUS");
    expect(
      code(
        validateV21FeatureCommandSource({
          op: "feature.revolve",
          sketchId: "sketch_1"
        })
      )
    ).toBe("SCHEMA_V21_SOURCE_INVALID");
    expect(
      code(
        validateV21FeatureCommandSource({
          op: "feature.sweep",
          profile: entityProfile,
          path: entityPath,
          pathSketchId: "path_sketch"
        })
      )
    ).toBe("COMMAND_INPUT_AMBIGUOUS");
    expect(
      validateV21FeatureCommandSource({
        op: "feature.sweep",
        profile: entityProfile,
        path: entityPath
      }).ok
    ).toBe(true);
    expect(
      code(
        validateV21FeatureCommandSource({
          op: "feature.loft",
          sections: [
            { profile: entityProfile },
            { sketchId: "sketch_2", entityId: "circle_2" }
          ]
        })
      )
    ).toBe("COMMAND_INPUT_AMBIGUOUS");
  });

  it("types strict normalized feature command inputs without widening live CadOp", () => {
    const extrude: FeatureExtrudeCommandInput = {
      op: "feature.extrude",
      profile: {
        kind: "wire",
        sketchId: "sketch_1",
        segments: [
          { entityId: "line_1", orientation: "forward" },
          { entityId: "arc_1", orientation: "forward" }
        ]
      },
      depth: 4,
      operationMode: "newBody"
    };
    const sweep: FeatureSweepCommandInput = {
      op: "feature.sweep",
      profile: {
        kind: "entity",
        sketchId: "profile_sketch",
        entityId: "circle_1"
      },
      path: {
        kind: "entity",
        sketchId: "path_sketch",
        entityId: "arc_1",
        orientation: "reverse"
      }
    };
    expect("profile" in extrude).toBe(true);
    expect("path" in sweep).toBe(true);
  });

  it("validates explicit arc point targets and normalized radius constraints", () => {
    expect(
      validateSketchPointTargetV21({
        entityId: "arc_1",
        entityKind: "arc",
        role: "start"
      }).ok
    ).toBe(true);
    expect(
      code(
        validateSketchPointTargetV21({
          entityId: "arc_1",
          entityKind: "arc",
          role: "position"
        })
      )
    ).toBe("SCHEMA_V21_SOURCE_INVALID");

    const constraint: SketchRadiusConstraintV21 = {
      id: "constraint_1",
      name: "Concentric",
      sketchId: "sketch_1",
      entityId: "arc_1",
      kind: "concentric",
      primaryTarget: { entityId: "arc_1", entityKind: "arc" },
      secondaryTarget: { entityId: "circle_1", entityKind: "circle" }
    };
    expect(validateSketchRadiusConstraintV21(constraint)).toEqual({
      ok: true,
      value: constraint
    });
    expect(
      code(
        validateSketchRadiusConstraintV21({
          ...constraint,
          primaryCircleEntityId: "circle_legacy"
        })
      )
    ).toBe("COMMAND_INPUT_AMBIGUOUS");
    expect(
      code(
        validateSketchRadiusConstraintV21({
          id: "constraint_1",
          name: "Equal",
          sketchId: "sketch_1",
          entityId: "circle_1",
          kind: "equalRadius",
          primaryCircleEntityId: "circle_1",
          secondaryCircleEntityId: "circle_2"
        })
      )
    ).toBe("SCHEMA_V21_SOURCE_INVALID");
  });

  it("types the required V17 semantic diff payloads", () => {
    const entityDiff: SketchEntitySemanticDiff = {
      sketchId: "sketch_1",
      entityId: "arc_1",
      action: "updated",
      entityKind: "arc",
      changedFields: ["radius", "construction"],
      constructionBefore: false,
      constructionAfter: true
    };
    const referenceDiff: FeatureInputReferenceSemanticDiff = {
      featureId: "feature_1",
      inputKind: "profile",
      after: {
        kind: "entity",
        sketchId: "sketch_1",
        entityId: "circle_1"
      },
      affectedSketchIds: ["sketch_1"],
      affectedEntityIds: ["circle_1"]
    };
    expect(entityDiff.entityKind).toBe("arc");
    expect(referenceDiff.inputKind).toBe("profile");
  });
});
