import { describe, expect, it } from "vitest";
import type {
  CadOp,
  CadProjectSchemaDiagnostic,
  CadQueryRequest,
  CadSketchEditProposal,
  CadSketchSolverDiagnostic,
  CadSketchSolverDimensionSummary,
  CadSketchSolverEntitySummary,
  CadSketchSolverPointTargetReference,
  FeatureExtrudeCommandInput,
  FeatureInputReferenceSemanticDiff,
  FeatureLoftCommandInput,
  FeatureRevolveCommandInput,
  FeatureSweepCommandInput,
  FeatureUpdateLoftCommandInput,
  FeatureUpdateRevolveCommandInput,
  FeatureUpdateSweepCommandInput,
  SketchArcDimensionTarget,
  SketchArcEntity,
  SketchArcPointTarget,
  SketchConstraintSnapshot,
  SketchConstraintSnapshotV20,
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
  SketchTangentConstraintCreateOp,
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

  it("preserves legacy non-arc whole-entity update payloads without weakening stored snapshots", () => {
    const omittedConstruction: SketchUpdateEntityOp = {
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: {
        id: "line_1",
        kind: "line",
        start: [0, 0],
        end: [2, 0]
      }
    };
    const explicitConstruction: SketchUpdateEntityOp = {
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: {
        id: "line_1",
        kind: "line",
        start: [0, 0],
        end: [2, 0],
        construction: true
      }
    };

    expect(omittedConstruction.entity).not.toHaveProperty("construction");
    expect(explicitConstruction.entity.construction).toBe(true);

    const invalidNonArcConstruction: SketchUpdateEntityOp = {
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: {
        id: "line_1",
        kind: "line",
        start: [0, 0],
        end: [2, 0],
        // @ts-expect-error A provided legacy construction value remains boolean-only.
        construction: "true"
      }
    };
    const invalidArcWithoutConstruction: SketchUpdateEntityOp = {
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      // @ts-expect-error Arc updates require explicit canonical construction state.
      entity: {
        id: "arc_1",
        kind: "arc",
        center: [0, 0],
        radius: 2,
        startAngleDegrees: 0,
        sweepAngleDegrees: 90
      }
    };
    expect([
      invalidNonArcConstruction,
      invalidArcWithoutConstruction
    ]).toHaveLength(2);
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
      path: entityPath,
      operationMode: "newBody"
    };
    const loft: FeatureLoftCommandInput = {
      op: "feature.loft",
      sections: [{ profile: entityProfile }, { profile: entityProfile }]
    };
    const updateLoft: FeatureUpdateLoftCommandInput = {
      op: "feature.updateLoft",
      id: "loft_1",
      sections: [{ profile: entityProfile }, { profile: entityProfile }]
    };

    expect(extrude.op).toBe("feature.extrude");
    expect(revolve.operationMode).toBe("newBody");
    expect(sweep.operationMode).toBe("newBody");
    expect(sweep.path).toEqual(entityPath);
    expect(loft.sections).toHaveLength(2);
    expect(updateLoft.sections).toHaveLength(2);

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
    const invalidSweepMode: FeatureSweepCommandInput = {
      op: "feature.sweep",
      profile: entityProfile,
      path: entityPath,
      // @ts-expect-error Sweep add/cut modes are outside the V17 support matrix.
      operationMode: "add"
    };
    const invalidSweepTarget: FeatureSweepCommandInput = {
      op: "feature.sweep",
      profile: entityProfile,
      path: entityPath,
      // @ts-expect-error New-body sweeps cannot target an existing body.
      targetBodyId: "body_1"
    };
    const invalidSweepUpdateTarget: FeatureUpdateSweepCommandInput = {
      op: "feature.updateSweep",
      id: "sweep_1",
      path: entityPath,
      // @ts-expect-error Sweep updates cannot target topology anchors.
      targetTopologyAnchorId: "anchor_1"
    };
    const invalidHoleProfile: CadOp = {
      op: "feature.hole",
      // @ts-expect-error Holes do not accept general profile references.
      profile: entityProfile,
      sketchId: "sketch_1",
      circleEntityId: "circle_1",
      targetBodyId: "body_1",
      depthMode: "throughAll"
    };
    const invalidMixedLoft: FeatureLoftCommandInput = {
      op: "feature.loft",
      sections: [
        // @ts-expect-error Normalized and legacy loft section fields are exclusive.
        { profile: entityProfile, sketchId: "sketch_1", entityId: "circle_1" },
        { profile: entityProfile }
      ]
    };
    const invalidMixedLoftArray: FeatureLoftCommandInput = {
      op: "feature.loft",
      // @ts-expect-error A loft command cannot mix legacy and normalized sections.
      sections: [
        { sketchId: "sketch_1", entityId: "circle_1" },
        { profile: entityProfile }
      ]
    };

    expect([
      invalidMode,
      invalidTarget,
      invalidMixed,
      invalidSweepMode,
      invalidSweepTarget,
      invalidSweepUpdateTarget,
      invalidHoleProfile,
      invalidMixedLoft,
      invalidMixedLoftArray
    ]).toHaveLength(9);
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

  it("activates the required arc constraint command forms", () => {
    const fixed: CadOp = {
      op: "sketch.constraint.create",
      name: "Fix arc start",
      sketchId: "sketch_1",
      kind: "fixed",
      target: { entityId: "arc_1", entityKind: "arc", role: "start" }
    };
    const coincident: CadOp = {
      op: "sketch.constraint.create",
      name: "Join arc and line",
      sketchId: "sketch_1",
      kind: "coincident",
      primaryTarget: { entityId: "arc_1", entityKind: "arc", role: "end" },
      secondaryTarget: { entityId: "line_1", role: "start" }
    };
    const symmetry: CadOp = {
      op: "sketch.constraint.create",
      name: "Symmetric arc endpoints",
      sketchId: "sketch_1",
      kind: "symmetry",
      primaryTarget: { entityId: "arc_1", entityKind: "arc", role: "start" },
      secondaryTarget: { entityId: "arc_1", entityKind: "arc", role: "end" },
      symmetryLineEntityId: "axis_1"
    };
    const tangencies: readonly SketchTangentConstraintCreateOp[] = [
      {
        op: "sketch.constraint.create",
        name: "Line circle tangent",
        sketchId: "sketch_1",
        kind: "tangent",
        primaryTarget: { entityId: "line_1", entityKind: "line" },
        secondaryTarget: { entityId: "circle_1", entityKind: "circle" }
      },
      {
        op: "sketch.constraint.create",
        name: "Line arc tangent",
        sketchId: "sketch_1",
        kind: "tangent",
        primaryTarget: { entityId: "line_1", entityKind: "line" },
        secondaryTarget: { entityId: "arc_1", entityKind: "arc" }
      },
      {
        op: "sketch.constraint.create",
        name: "Arc circle tangent",
        sketchId: "sketch_1",
        kind: "tangent",
        primaryTarget: { entityId: "arc_1", entityKind: "arc" },
        secondaryTarget: { entityId: "circle_1", entityKind: "circle" }
      },
      {
        op: "sketch.constraint.create",
        name: "Arc arc tangent",
        sketchId: "sketch_1",
        kind: "tangent",
        primaryTarget: { entityId: "arc_1", entityKind: "arc" },
        secondaryTarget: { entityId: "arc_2", entityKind: "arc" }
      }
    ];

    expect([fixed, coincident, symmetry]).toHaveLength(3);
    expect(
      tangencies.map((constraint) => constraint.secondaryTarget.entityKind)
    ).toEqual(["circle", "arc", "circle", "arc"]);
  });

  it("keeps legacy radius commands but makes normalized radius targets exclusive", () => {
    const legacyConcentric: CadOp = {
      op: "sketch.constraint.create",
      name: "Legacy concentric circles",
      sketchId: "sketch_1",
      kind: "concentric",
      primaryCircleEntityId: "circle_1",
      secondaryCircleEntityId: "circle_2"
    };
    const normalizedEqualRadius: CadOp = {
      op: "sketch.constraint.create",
      name: "Arc circle equal radius",
      sketchId: "sketch_1",
      kind: "equalRadius",
      primaryTarget: { entityId: "arc_1", entityKind: "arc" },
      secondaryTarget: { entityId: "circle_1", entityKind: "circle" }
    };

    const invalidMixed: CadOp = {
      op: "sketch.constraint.create",
      name: "Mixed",
      sketchId: "sketch_1",
      kind: "concentric",
      primaryCircleEntityId: "circle_1",
      secondaryCircleEntityId: "circle_2",
      // @ts-expect-error Normalized and legacy radius target fields cannot be mixed.
      primaryTarget: { entityId: "arc_1", entityKind: "arc" },
      // @ts-expect-error Normalized and legacy radius target fields cannot be mixed.
      secondaryTarget: { entityId: "circle_1", entityKind: "circle" }
    };
    // @ts-expect-error A normalized radius target pair must be complete.
    const invalidPartial: CadOp = {
      op: "sketch.constraint.create",
      name: "Partial",
      sketchId: "sketch_1",
      kind: "equalRadius",
      primaryTarget: { entityId: "arc_1", entityKind: "arc" }
    };

    expect(legacyConcentric.kind).toBe("concentric");
    expect(normalizedEqualRadius.kind).toBe("equalRadius");
    expect([invalidMixed, invalidPartial]).toHaveLength(2);
  });

  it("keeps live stored radius constraints canonical and V20 history explicit", () => {
    const stored: SketchConstraintSnapshot = {
      id: "constraint_1",
      name: "Concentric",
      sketchId: "sketch_1",
      entityId: "arc_1",
      kind: "concentric",
      primaryTarget: { entityId: "arc_1", entityKind: "arc" },
      secondaryTarget: { entityId: "circle_1", entityKind: "circle" }
    };
    const history: SketchConstraintSnapshotV20 = {
      id: "constraint_legacy",
      name: "Legacy equal radius",
      sketchId: "sketch_1",
      entityId: "circle_1",
      kind: "equalRadius",
      primaryCircleEntityId: "circle_1",
      secondaryCircleEntityId: "circle_2"
    };
    const diagnosticOnlyTangent: SketchConstraintSnapshot = {
      id: "constraint_invalid_tangent",
      name: "Stored unsupported tangent",
      sketchId: "sketch_1",
      entityId: "circle_1",
      kind: "tangent",
      primaryTarget: { entityId: "circle_1", entityKind: "circle" },
      secondaryTarget: { entityId: "circle_2", entityKind: "circle" }
    };

    // @ts-expect-error Live V21 storage cannot use legacy circle-ID fields.
    const invalidLiveLegacy: SketchConstraintSnapshot = history;
    const invalidStoredMixed: SketchConstraintSnapshot = {
      ...stored,
      // @ts-expect-error Canonical V21 storage rejects mixed target representations.
      primaryCircleEntityId: "circle_1",
      // @ts-expect-error Canonical V21 storage rejects mixed target representations.
      secondaryCircleEntityId: "circle_2"
    };

    expect(stored.kind).toBe("concentric");
    expect(history.kind).toBe("equalRadius");
    expect(diagnosticOnlyTangent.kind).toBe("tangent");
    expect([invalidLiveLegacy, invalidStoredMixed]).toHaveLength(2);
  });

  it("exposes arc dimension and solver diagnostic query contracts", () => {
    const createDimension: CadOp = {
      op: "sketch.dimension.create",
      name: "Arc sweep",
      sketchId: "sketch_1",
      entityId: "arc_1",
      target: { entityKind: "arc", role: "sweep" },
      value: 90
    };
    const pointRef: CadSketchSolverPointTargetReference = {
      type: "point",
      sketchId: "sketch_1",
      entityId: "arc_1",
      entityKind: "arc",
      role: "center"
    };
    const diagnostic: CadSketchSolverDiagnostic = {
      code: "SKETCH_TANGENCY_OUTSIDE_ARC",
      severity: "blocker",
      message: "The solved circle contact is outside the finite arc.",
      target: pointRef
    };
    const dimension: CadSketchSolverDimensionSummary = {
      dimensionId: "dimension_1",
      sketchId: "sketch_1",
      entityId: "arc_1",
      target: { entityKind: "arc", role: "radius" },
      valueSource: { type: "literal", value: 4 },
      effectiveValue: 4,
      status: "healthy",
      supported: true,
      targetRef: {
        type: "dimension",
        sketchId: "sketch_1",
        dimensionId: "dimension_1",
        entityId: "arc_1",
        dimensionTarget: { entityKind: "arc", role: "radius" }
      },
      diagnosticCount: 2,
      diagnostics: [
        diagnostic,
        {
          code: "SKETCH_ARC_SOLVE_BRANCH_INVALID",
          severity: "blocker",
          message: "The current tangent branch became invalid."
        }
      ]
    };

    // @ts-expect-error Arc point targets require an arc-compatible role.
    const invalidArcPoint: CadSketchSolverPointTargetReference = {
      type: "point",
      sketchId: "sketch_1",
      entityId: "arc_1",
      entityKind: "arc",
      role: "position"
    };
    const invalidArcMidpoint: CadOp = {
      op: "sketch.constraint.create",
      name: "Invalid midpoint",
      sketchId: "sketch_1",
      kind: "midpoint",
      lineEntityId: "line_1",
      // @ts-expect-error Midpoint does not accept arc point targets.
      target: { entityId: "arc_1", entityKind: "arc", role: "center" }
    };
    const invalidCircleCircleTangent: CadOp = {
      op: "sketch.constraint.create",
      name: "Invalid circle tangent",
      sketchId: "sketch_1",
      kind: "tangent",
      primaryTarget: { entityId: "circle_1", entityKind: "circle" },
      // @ts-expect-error Circle-circle tangency is outside the V17 Must matrix.
      secondaryTarget: { entityId: "circle_2", entityKind: "circle" }
    };
    const invalidLineLineTangent: CadOp = {
      op: "sketch.constraint.create",
      name: "Invalid line tangent",
      sketchId: "sketch_1",
      kind: "tangent",
      primaryTarget: { entityId: "line_1", entityKind: "line" },
      // @ts-expect-error Line-line tangency is outside the V17 Must matrix.
      secondaryTarget: { entityId: "line_2", entityKind: "line" }
    };

    expect(createDimension.op).toBe("sketch.dimension.create");
    expect(dimension.target.role).toBe("radius");
    expect([
      invalidArcPoint,
      invalidArcMidpoint,
      invalidCircleCircleTangent,
      invalidLineLineTangent
    ]).toHaveLength(4);
  });
});
