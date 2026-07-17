import { describe, expect, it } from "vitest";
import type {
  CadOp,
  CadProjectSchemaDiagnostic,
  CadQueryRequest,
  CadSketchEditProposal,
  CadSketchSolverEntitySummary,
  FeatureExtrudeCommandInput,
  FeatureInputReferenceSemanticDiff,
  FeatureRevolveCommandInput,
  FeatureSweepCommandInput,
  FeatureUpdateRevolveCommandInput,
  FeatureUpdateSweepCommandInput,
  SketchArcDimensionTarget,
  SketchArcEntity,
  SketchArcPointTarget,
  SketchConstraintV21,
  SketchEntityKind,
  SketchEntityKindV20,
  SketchEntityKindV21,
  SketchEntitySemanticDiff,
  SketchEntityV21,
  SketchEntitySnapshot,
  SketchGetQueryResponse,
  SketchPathRef,
  SketchProfileRef,
  SketchRadiusConstraintV21,
  SketchUpdateEntityOp
} from "./index";
import { CAD_V17_PROJECT_SCHEMA_VERSION } from "./index";

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

describe("V17 protocol declarations", () => {
  it("activates arc in the live entity kind while preserving a V20 kind alias", () => {
    const legacyKind: SketchEntityKindV20 = "circle";
    const liveKind: SketchEntityKind = "arc";
    const v21Kind: SketchEntityKindV21 = "arc";
    // @ts-expect-error V20 source did not have arc entities.
    const invalidLegacyKind: SketchEntityKindV20 = "arc";

    expect(CAD_V17_PROJECT_SCHEMA_VERSION).toBe("web-cad.project.v21");
    expect([legacyKind, liveKind, v21Kind, invalidLegacyKind]).toEqual([
      "circle",
      "arc",
      "arc",
      "arc"
    ]);
  });

  it("types explicit construction on every normalized V21 entity", () => {
    const entities: readonly SketchEntityV21[] = [
      { id: "p", kind: "point", point: [0, 0], construction: false },
      {
        id: "l",
        kind: "line",
        start: [0, 0],
        end: [1, 0],
        construction: true
      },
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
    const arc: SketchArcEntity = entities[4] as SketchArcEntity;

    expect(entities.map((entity) => entity.construction)).toEqual([
      false,
      true,
      false,
      false,
      true
    ]);
    expect(arc.sweepAngleDegrees).toBe(90);
  });

  it("activates arc and construction mutations in the live CadOp union", () => {
    const legacyAddWithoutConstruction: CadOp = {
      op: "sketch.addPoint",
      sketchId: "sketch_1",
      point: [0, 0]
    };
    const constructedLine: CadOp = {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      start: [0, 0],
      end: [1, 0],
      construction: true
    };
    const canonicalArc: CadOp = {
      op: "sketch.addArc",
      sketchId: "sketch_1",
      id: "arc_1",
      construction: false,
      definition: {
        kind: "centerAngles",
        center: [0, 0],
        radius: 2,
        startAngleDegrees: 350,
        sweepAngleDegrees: 20
      }
    };
    const threePointArc: CadOp = {
      op: "sketch.addArc",
      sketchId: "sketch_1",
      definition: {
        kind: "threePoint",
        start: [1, 0],
        pointOnArc: [0, 1],
        end: [-1, 0]
      }
    };
    const constructionToggle: CadOp = {
      op: "sketch.setEntityConstruction",
      sketchId: "sketch_1",
      entityId: "arc_1",
      construction: true
    };

    expect(legacyAddWithoutConstruction).not.toHaveProperty("construction");
    expect(constructedLine.construction).toBe(true);
    expect(canonicalArc.definition.kind).toBe("centerAngles");
    expect(threePointArc.definition.kind).toBe("threePoint");
    expect(constructionToggle.construction).toBe(true);

    const invalidToggle: CadOp = {
      op: "sketch.setEntityConstruction",
      sketchId: "sketch_1",
      entityId: "arc_1",
      // @ts-expect-error Construction state is strictly boolean.
      construction: "true"
    };
    const invalidMixedArc: CadOp = {
      op: "sketch.addArc",
      sketchId: "sketch_1",
      definition: {
        kind: "centerAngles",
        center: [0, 0],
        radius: 2,
        startAngleDegrees: 0,
        sweepAngleDegrees: 90,
        // @ts-expect-error Arc definitions cannot mix canonical and three-point fields.
        start: [1, 0],
        pointOnArc: [0, 1],
        end: [-1, 0]
      }
    };
    expect([invalidToggle, invalidMixedArc]).toHaveLength(2);
  });

  it("uses canonical whole-entity arc updates and exposes arcs through sketch queries", () => {
    const arc: SketchEntitySnapshot = {
      id: "arc_1",
      kind: "arc",
      center: [0, 0],
      radius: 2,
      startAngleDegrees: 350,
      sweepAngleDegrees: 20,
      construction: false
    };
    const update: SketchUpdateEntityOp = {
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: arc
    };
    const response: SketchGetQueryResponse = {
      ok: true,
      query: "sketch.get",
      cadOpsVersion: "cadops.v1",
      sketch: {
        id: "sketch_1",
        name: "Arc sketch",
        plane: "XY",
        entities: [arc]
      }
    };
    const entityEdit: CadSketchEditProposal = {
      editKind: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: { ...arc, radius: 3 }
    };
    const constructionEdit: CadSketchEditProposal = {
      editKind: "sketch.setEntityConstruction",
      sketchId: "sketch_1",
      entityId: "arc_1",
      construction: true
    };
    const readinessRequests: readonly CadQueryRequest[] = [
      {
        version: "cadops.v1",
        query: { query: "sketch.editReadiness", edit: entityEdit }
      },
      {
        version: "cadops.v1",
        query: { query: "sketch.editReadiness", edit: constructionEdit }
      }
    ];
    const deferredSolverEntity: CadSketchSolverEntitySummary = {
      sketchId: "sketch_1",
      entityId: "arc_1",
      entityKind: "arc",
      construction: false,
      supported: false,
      variableCount: 0,
      degreesOfFreedom: 0,
      targetCount: 0,
      targets: [],
      diagnosticCount: 1,
      diagnostics: [
        {
          code: "SKETCH_SOLVER_UNSUPPORTED_ENTITY",
          severity: "warning",
          message: "Arc solving is not active in this slice.",
          sketchId: "sketch_1",
          sketchEntityId: "arc_1"
        }
      ]
    };

    expect(update.entity).toEqual(arc);
    expect(response.sketch.entities).toEqual([arc]);
    expect(readinessRequests).toHaveLength(2);
    expect(deferredSolverEntity.supported).toBe(false);

    // @ts-expect-error Stored/query snapshots require explicit construction state.
    const missingConstruction: SketchEntitySnapshot = {
      id: "arc_2",
      kind: "arc",
      center: [0, 0],
      radius: 1,
      startAngleDegrees: 0,
      sweepAngleDegrees: 90
    };
    const invalidThreePointUpdate: SketchUpdateEntityOp = {
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: {
        id: "arc_1",
        kind: "arc",
        construction: false,
        // @ts-expect-error Three-point input is create sugar, not a stored entity update.
        definition: {
          kind: "threePoint",
          start: [1, 0],
          pointOnArc: [0, 1],
          end: [-1, 0]
        }
      }
    };
    expect([missingConstruction, invalidThreePointUpdate]).toHaveLength(2);
  });

  it("types oriented profile and path source refs", () => {
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

    expect(profile.kind).toBe("wire");
    expect(path.kind).toBe("chain");
  });

  it("keeps normalized feature-create inputs strict and V21 revolve newBody-only", () => {
    const extrude: FeatureExtrudeCommandInput = {
      op: "feature.extrude",
      profile: entityProfile,
      depth: 4,
      operationMode: "newBody"
    };
    const revolve: FeatureRevolveCommandInput = {
      op: "feature.revolve",
      profile: entityProfile,
      axis: { type: "sketchLine", sketchId: "sketch_1", entityId: "axis" },
      angleDegrees: 180,
      operationMode: "newBody"
    };
    const sweep: FeatureSweepCommandInput = {
      op: "feature.sweep",
      profile: entityProfile,
      path: entityPath
    };

    expect(extrude.op).toBe("feature.extrude");
    expect(revolve.operationMode).toBe("newBody");
    expect(sweep.path).toEqual(entityPath);

    // @ts-expect-error Normalized V21 revolve does not support add/cut.
    const invalidMode: FeatureRevolveCommandInput = {
      op: "feature.revolve",
      profile: entityProfile,
      axis: { type: "sketchLine", sketchId: "sketch_1", entityId: "axis" },
      angleDegrees: 180,
      operationMode: "cut"
    };
    // @ts-expect-error Normalized V21 revolve has no target body.
    const invalidTarget: FeatureRevolveCommandInput = {
      op: "feature.revolve",
      profile: entityProfile,
      axis: { type: "sketchLine", sketchId: "sketch_1", entityId: "axis" },
      angleDegrees: 180,
      operationMode: "newBody",
      targetBodyId: "body_1"
    };
    // @ts-expect-error Normalized and legacy profile fields are mutually exclusive.
    const invalidMixed: FeatureExtrudeCommandInput = {
      op: "feature.extrude",
      profile: entityProfile,
      sketchId: "sketch_1",
      entityId: "circle_1",
      depth: 4
    };

    expect([invalidMode, invalidTarget, invalidMixed]).toHaveLength(3);
  });

  it("preserves complete V20 updateSweep profile-only and path-only patches", () => {
    const legacyProfileOnly: FeatureUpdateSweepCommandInput = {
      op: "feature.updateSweep",
      id: "sweep_1",
      profileSketchId: "profile_sketch",
      profileEntityId: "circle_1"
    };
    const legacyPathOnly: FeatureUpdateSweepCommandInput = {
      op: "feature.updateSweep",
      id: "sweep_1",
      pathSketchId: "path_sketch",
      pathEntityIds: ["line_1"]
    };
    const normalizedProfileOnly: FeatureUpdateSweepCommandInput = {
      op: "feature.updateSweep",
      id: "sweep_1",
      profile: entityProfile
    };
    const normalizedPathOnly: FeatureUpdateSweepCommandInput = {
      op: "feature.updateSweep",
      id: "sweep_1",
      path: entityPath
    };

    expect(legacyProfileOnly.profileEntityId).toBe("circle_1");
    expect(legacyPathOnly.pathEntityIds).toEqual(["line_1"]);
    expect(normalizedProfileOnly.profile.kind).toBe("entity");
    expect(normalizedPathOnly.path.kind).toBe("entity");

    // @ts-expect-error Legacy profile patches require both profile IDs.
    const invalidProfileHalf: FeatureUpdateSweepCommandInput = {
      op: "feature.updateSweep",
      id: "sweep_1",
      profileSketchId: "profile_sketch"
    };
    // @ts-expect-error Legacy path patches require sketch and entity IDs.
    const invalidPathHalf: FeatureUpdateSweepCommandInput = {
      op: "feature.updateSweep",
      id: "sweep_1",
      pathEntityIds: ["line_1"]
    };
    // @ts-expect-error Normalized and legacy sweep patches cannot be mixed.
    const invalidMixed: FeatureUpdateSweepCommandInput = {
      op: "feature.updateSweep",
      id: "sweep_1",
      path: entityPath,
      profileSketchId: "profile_sketch",
      profileEntityId: "circle_1"
    };

    expect([invalidProfileHalf, invalidPathHalf, invalidMixed]).toHaveLength(3);
  });

  it("requires an angle for updateRevolve unless the command retargets", () => {
    const angleOnly: FeatureUpdateRevolveCommandInput = {
      op: "feature.updateRevolve",
      id: "revolve_1",
      angleDegrees: 90
    };
    const normalizedRetarget: FeatureUpdateRevolveCommandInput = {
      op: "feature.updateRevolve",
      id: "revolve_1",
      profile: entityProfile
    };
    const legacyRetarget: FeatureUpdateRevolveCommandInput = {
      op: "feature.updateRevolve",
      id: "revolve_1",
      sketchId: "sketch_1",
      entityId: "circle_1"
    };

    expect(angleOnly.angleDegrees).toBe(90);
    expect(normalizedRetarget.profile.kind).toBe("entity");
    expect(legacyRetarget.entityId).toBe("circle_1");

    // @ts-expect-error A no-retarget update still requires angleDegrees.
    const invalidNoop: FeatureUpdateRevolveCommandInput = {
      op: "feature.updateRevolve",
      id: "revolve_1"
    };
    expect(invalidNoop.id).toBe("revolve_1");
  });

  it("types normalized V21 arc targets, constraints, diffs, and schema diagnostics", () => {
    const pointTarget: SketchArcPointTarget = {
      entityId: "arc_1",
      entityKind: "arc",
      role: "start"
    };
    const dimensionTarget: SketchArcDimensionTarget = {
      entityKind: "arc",
      role: "sweep"
    };
    const constraint: SketchRadiusConstraintV21 = {
      id: "constraint_1",
      name: "Concentric",
      sketchId: "sketch_1",
      entityId: "arc_1",
      kind: "concentric",
      primaryTarget: { entityId: "arc_1", entityKind: "arc" },
      secondaryTarget: { entityId: "circle_1", entityKind: "circle" }
    };
    const constraintUnion: SketchConstraintV21 = constraint;
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
      after: entityProfile,
      affectedSketchIds: ["sketch_1"],
      affectedEntityIds: ["circle_1"]
    };
    const schemaDiagnostic: CadProjectSchemaDiagnostic = {
      code: "SCHEMA_UPGRADED_TO_V21",
      severity: "info",
      message: "The exported source requires V21."
    };

    expect(pointTarget.role).toBe("start");
    expect(dimensionTarget.role).toBe("sweep");
    expect(constraintUnion.kind).toBe("concentric");
    expect(entityDiff.entityKind).toBe("arc");
    expect(referenceDiff.inputKind).toBe("profile");
    expect(schemaDiagnostic.severity).toBe("info");
  });
});
