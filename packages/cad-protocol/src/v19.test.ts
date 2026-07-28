import { describe, expect, it } from "vitest";

import {
  CAD_V19_PROJECT_SCHEMA_VERSION,
  CAD_V19_RESOURCE_LIMITS,
  CAD_V19_SKETCH_GEOMETRY_POLICY,
  type CadFeatureRef,
  type CadOp,
  type CadDependencyHealthIssueCode,
  type CadSketchDimensionHealth,
  type CadV19Op,
  type FeatureInputReferenceSemanticDiffCurrent,
  type SketchConstraintUpdateOpV19,
  type SketchDimensionSnapshotV22,
  type SketchMidpointTargetV22,
  type SketchProfileCandidate,
  type SketchRegionDiagnosticCode,
  type SketchRegionsProfileRef,
  isSketchDimensionTargetV22,
  isSketchPointTargetV22,
  isSketchRegionsProfileRef,
  validateV19CadOp,
  validateV19SketchQueryRequest
} from "./index";

const sourceRevision = `partbench-source-v1:${"a".repeat(64)}`;
const solverEvaluationIdentity = `partbench-sketch-solver-evaluation-v1:${"b".repeat(64)}`;

function regionsProfile(): SketchRegionsProfileRef {
  return {
    kind: "regions",
    sketchId: "sketch_1",
    regions: [
      {
        outer: { kind: "entity", entityId: "circle_outer" },
        holes: [
          {
            kind: "wire",
            segments: [
              { entityId: "line_1", orientation: "forward" },
              { entityId: "arc_1", orientation: "reverse" }
            ]
          }
        ]
      }
    ]
  };
}

describe("V19 protocol contract", () => {
  it("freezes the V22 schema, shared policy, and public work limits", () => {
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).toBe("web-cad.project.v22");
    expect(CAD_V19_SKETCH_GEOMETRY_POLICY).toEqual({
      linearTolerance: 1e-7,
      angularToleranceDegrees: 0.1,
      minimumProfileArea: 1e-12
    });
    expect(CAD_V19_RESOURCE_LIMITS).toEqual({
      maxSketchEntitiesPerEditedSketch: 4_096,
      maxBoundaryEntityIdsPerCurveEdit: 256,
      maxSplitPointsPerCommand: 1_024,
      maxOffsetSourceSegments: 1_024,
      maxRegionsPerProfile: 256,
      maxLoopsPerProfile: 512,
      maxSegmentReferencesPerProfile: 4_096,
      maxDiscoveredCandidateRegions: 512,
      maxCandidatePairEdgeVisits: 250_000,
      maxSubmittedProfilePredicateVisits: 100_000,
      maxRegionCandidatesPerPage: 100
    });
  });

  it("freezes Slice E correlation and diagnostic vocabulary", () => {
    const candidate = {
      status: "ready",
      regionCandidateKey: JSON.stringify([
        "region",
        0,
        JSON.stringify(["entity", "circle_outer"]),
        []
      ])
    } as Pick<SketchProfileCandidate, "status" | "regionCandidateKey">;
    const regionCodes = [
      "SKETCH_REGION_PROFILE_EMPTY",
      "SKETCH_REGION_SKETCH_MISMATCH",
      "SKETCH_REGION_ENTITY_MISSING",
      "SKETCH_REGION_ENTITY_UNSUPPORTED",
      "SKETCH_REGION_CONSTRUCTION_ENTITY",
      "SKETCH_REGION_ENTITY_REPEATED",
      "SKETCH_REGION_LOOP_AREA_TOO_SMALL",
      "SKETCH_REGION_SOURCE_REVISION_STALE",
      "SKETCH_REGION_CURSOR_INVALID"
    ] satisfies readonly SketchRegionDiagnosticCode[];
    const dependencyCodes = [
      "SKETCH_REGION_LOOP_OPEN",
      "SKETCH_REGION_LOOP_INTERSECTION",
      "SKETCH_REGION_BOUNDARY_TOUCHING",
      "SKETCH_REGION_CONTAINMENT_INVALID",
      "SKETCH_REGION_MATERIAL_OVERLAP",
      "SKETCH_REGION_COMPLEXITY_LIMIT"
    ] satisfies readonly CadDependencyHealthIssueCode[];

    expect(candidate.regionCandidateKey).toContain('"region"');
    expect(regionCodes).toHaveLength(9);
    expect(dependencyCodes).toHaveLength(6);
  });

  it("does not count entity loops against the wire-reference limit", () => {
    const holes = Array.from(
      { length: CAD_V19_RESOURCE_LIMITS.maxLoopsPerProfile - 1 },
      (_, index) => ({
        kind: "entity" as const,
        entityId: `hole_${index}`
      })
    );
    expect(
      validateV19SketchQueryRequest({
        version: "cadops.v1",
        query: {
          query: "sketch.profileRegionValidate",
          profile: {
            kind: "regions",
            sketchId: "sketch_1",
            regions: [
              {
                outer: { kind: "entity", entityId: "outer" },
                holes
              }
            ]
          }
        }
      }).ok
    ).toBe(true);
  });

  it("accepts explicit region source and rejects duplicate loop membership", () => {
    const profile = regionsProfile();
    expect(isSketchRegionsProfileRef(profile)).toBe(true);
    expect(
      validateV19SketchQueryRequest({
        version: "cadops.v1",
        query: {
          query: "sketch.profileRegionValidate",
          profile
        }
      })
    ).toEqual({ ok: true, value: expect.any(Object) });

    const duplicate = {
      ...profile,
      regions: [
        {
          outer: { kind: "entity", entityId: "circle_outer" },
          holes: [{ kind: "entity", entityId: "circle_outer" }]
        }
      ]
    };
    expect(isSketchRegionsProfileRef(duplicate)).toBe(false);
  });

  it("enforces revision-bound candidate paging and page limits", () => {
    const missingRevision = validateV19SketchQueryRequest({
      version: "cadops.v1",
      query: {
        query: "sketch.profileRegionCandidates",
        sketchId: "sketch_1",
        afterCandidateKey: "candidate_1"
      }
    });
    expect(missingRevision.ok).toBe(false);

    const overLimit = validateV19SketchQueryRequest({
      version: "cadops.v1",
      query: {
        query: "sketch.profileRegionCandidates",
        sketchId: "sketch_1",
        limit: 101
      }
    });
    expect(overLimit.ok).toBe(false);

    expect(
      validateV19SketchQueryRequest({
        version: "cadops.v1",
        query: {
          query: "sketch.profileRegionCandidates",
          sketchId: "sketch_1",
          limit: 100,
          afterCandidateKey: "candidate_1",
          sourceRevision
        }
      }).ok
    ).toBe(true);
  });

  it("validates exact curve-edit identities, finite points, and list policy", () => {
    const valid: CadOp = {
      op: "sketch.trim",
      sketchId: "sketch_1",
      precondition: {
        expectedSourceRevision: sourceRevision,
        expectedSolverEvaluationIdentity: solverEvaluationIdentity
      },
      entityId: "line_target",
      boundaryEntityIds: ["line_boundary"],
      pickPoint: [1, 2],
      createdEntityIds: [],
      deleteConstraintIds: [],
      deleteDimensionIds: []
    };
    expect(validateV19CadOp(valid).ok).toBe(true);
    expect(
      validateV19CadOp({
        ...valid,
        deleteConstraintIds: ["constraint_1", "constraint_1"],
        deleteDimensionIds: ["dimension_1", "dimension_1"]
      }).ok
    ).toBe(true);

    expect(
      validateV19CadOp({
        ...valid,
        boundaryEntityIds: ["line_boundary", "line_boundary"],
        pickPoint: [Number.NaN, 2]
      }).ok
    ).toBe(false);
    const mixed = validateV19CadOp({
      op: "sketch.dimension.create",
      name: "Mixed",
      sketchId: "sketch_1",
      entityId: "line_1",
      target: {
        kind: "entityScalar",
        entityId: "line_1",
        entityKind: "line",
        role: "length"
      },
      value: 1
    });
    expect(mixed.ok).toBe(false);
    if (!mixed.ok) {
      expect(mixed.issues[0]).toMatchObject({
        code: "COMMAND_INPUT_AMBIGUOUS",
        path: "$"
      });
    }
    expect(
      validateV19CadOp({
        op: "sketch.dimension.create",
        name: "Negative sweep magnitude",
        sketchId: "sketch_1",
        target: {
          kind: "entityScalar",
          entityId: "arc_1",
          entityKind: "arc",
          role: "sweep"
        },
        value: -90
      }).ok
    ).toBe(false);
    expect(
      validateV19CadOp({
        ...valid,
        precondition: {
          ...valid.precondition,
          expectedSourceRevision: "stale"
        }
      }).ok
    ).toBe(false);
    expect(
      validateV19CadOp({
        ...valid,
        boundaryEntityIds: []
      }).ok
    ).toBe(false);
    expect(
      validateV19CadOp({
        ...valid,
        boundaryEntityIds: ["line_target"]
      }).ok
    ).toBe(false);
  });

  it("rejects empty, duplicate, sparse, and cardinality-invalid edit inputs", () => {
    const precondition = {
      expectedSourceRevision: sourceRevision,
      expectedSolverEvaluationIdentity: solverEvaluationIdentity
    };
    expect(
      validateV19CadOp({
        op: "sketch.split",
        sketchId: "sketch_1",
        precondition,
        entityId: "line_1",
        splitPoints: []
      }).ok
    ).toBe(false);
    expect(
      validateV19CadOp({
        op: "sketch.offset",
        sketchId: "sketch_1",
        precondition,
        source: {
          kind: "chain",
          segments: [
            { entityId: "line_1", orientation: "forward" },
            { entityId: "line_1", orientation: "reverse" }
          ],
          closed: false
        },
        distance: 1,
        side: "left",
        createdEntityIds: ["created_1"]
      }).ok
    ).toBe(false);
    expect(
      validateV19CadOp({
        op: "sketch.offset",
        sketchId: "sketch_1",
        precondition,
        source: { kind: "entity", entityId: "line_1" },
        distance: CAD_V19_SKETCH_GEOMETRY_POLICY.linearTolerance / 1_000,
        side: "left"
      }).ok
    ).toBe(true);

    const sparseBoundaries = new Array<string>(1);
    expect(
      validateV19CadOp({
        op: "sketch.trim",
        sketchId: "sketch_1",
        precondition,
        entityId: "line_1",
        boundaryEntityIds: sparseBoundaries,
        pickPoint: [0, 0]
      }).ok
    ).toBe(false);
  });

  it("enforces atomic convenience-operation cardinalities", () => {
    expect(
      validateV19CadOp({
        op: "sketch.addSlot",
        sketchId: "sketch_1",
        centerlineStart: [0, 0],
        centerlineEnd: [10, 0],
        radius: 2,
        entityIds: ["a", "b", "c"],
        constraintIds: Array.from({ length: 9 }, (_, index) => `c_${index}`)
      }).ok
    ).toBe(false);

    expect(
      validateV19CadOp({
        op: "sketch.addRoundedRectangle",
        sketchId: "sketch_1",
        center: [0, 0],
        width: 20,
        height: 10,
        cornerRadius: 2,
        entityIds: Array.from({ length: 8 }, (_, index) => `e_${index}`),
        constraintIds: Array.from({ length: 23 }, (_, index) => `c_${index}`)
      }).ok
    ).toBe(true);
  });

  it("rejects convenience geometry at or below the shared tolerance", () => {
    const tolerance = CAD_V19_SKETCH_GEOMETRY_POLICY.linearTolerance;
    expect(
      validateV19CadOp({
        op: "sketch.addSlot",
        sketchId: "sketch_1",
        centerlineStart: [0, 0],
        centerlineEnd: [tolerance, 0],
        radius: 2
      }).ok
    ).toBe(false);
    expect(
      validateV19CadOp({
        op: "sketch.addSlot",
        sketchId: "sketch_1",
        centerlineStart: [0, 0],
        centerlineEnd: [10, 0],
        radius: tolerance
      }).ok
    ).toBe(false);
    expect(
      validateV19CadOp({
        op: "sketch.addRoundedRectangle",
        sketchId: "sketch_1",
        center: [0, 0],
        width: 10,
        height: 6,
        cornerRadius: tolerance
      }).ok
    ).toBe(false);
    expect(
      validateV19CadOp({
        op: "sketch.addRoundedRectangle",
        sketchId: "sketch_1",
        center: [0, 0],
        width: 10,
        height: 6,
        cornerRadius: (6 - tolerance / 2) / 2
      }).ok
    ).toBe(false);
  });

  it("keeps normalized storage snapshots distinct from public V22 entries", () => {
    const target = {
      kind: "pointLineDistance",
      point: {
        entityId: "point_1",
        entityKind: "point",
        role: "position"
      },
      lineEntityId: "line_1",
      side: "left"
    } as const;
    const snapshot: SketchDimensionSnapshotV22 = {
      id: "dimension_1",
      name: "Offset",
      sketchId: "sketch_1",
      target,
      valueSource: { type: "literal", value: 5 }
    };

    expect("sourceShape" in snapshot).toBe(false);
    expect(isSketchDimensionTargetV22(snapshot.target)).toBe(true);
    expect(isSketchPointTargetV22(target.point)).toBe(true);
    expect(
      validateV19CadOp({
        op: "sketch.dimension.create",
        name: "Angle",
        sketchId: "sketch_1",
        target: {
          kind: "lineAngle",
          primaryLineEntityId: "line_1",
          secondaryLineEntityId: "line_2",
          sense: "counterclockwise"
        },
        parameterId: "parameter_1"
      }).ok
    ).toBe(false);
    expect(
      validateV19CadOp({
        op: "sketch.dimension.create",
        name: "No source",
        sketchId: "sketch_1",
        target: {
          kind: "entityScalar",
          entityId: "line_1",
          entityKind: "line",
          role: "length"
        }
      }).ok
    ).toBe(false);
    expect(
      validateV19CadOp({
        op: "sketch.dimension.create",
        name: "Coincident points",
        sketchId: "sketch_1",
        target: {
          kind: "pointPair",
          primary: {
            entityId: "point_1",
            entityKind: "point",
            role: "position"
          },
          secondary: {
            entityId: "point_1",
            entityKind: "point",
            role: "position"
          },
          measurement: "distance"
        },
        value: 1
      }).ok
    ).toBe(false);
    expect(
      validateV19CadOp({
        op: "sketch.dimension.create",
        name: "Owning support",
        sketchId: "sketch_1",
        target: {
          kind: "pointLineDistance",
          point: {
            entityId: "line_1",
            entityKind: "line",
            role: "start"
          },
          lineEntityId: "line_1",
          side: "left"
        },
        value: 1
      }).ok
    ).toBe(false);
  });

  it("keeps midpoint targets narrower than the general point-target union", () => {
    const midpointTarget: SketchMidpointTargetV22 = {
      entityId: "circle_1",
      entityKind: "circle",
      role: "center"
    };
    const update: SketchConstraintUpdateOpV19 = {
      op: "sketch.constraint.update",
      id: "constraint_1",
      definition: {
        kind: "midpoint",
        lineEntityId: "line_1",
        target: midpointTarget
      }
    };

    expect(update.definition.kind).toBe("midpoint");
  });

  it("validates complete structural constraint definitions and target pairs", () => {
    expect(
      validateV19CadOp({
        op: "sketch.constraint.create",
        id: "constraint_1",
        name: "Fixed point",
        sketchId: "sketch_1",
        kind: "fixed",
        target: {
          entityId: "point_1",
          entityKind: "point",
          role: "position"
        },
        coordinate: [1, 2]
      }).ok
    ).toBe(true);
    expect(
      validateV19CadOp({
        op: "sketch.constraint.create",
        name: "Invalid midpoint",
        sketchId: "sketch_1",
        kind: "midpoint",
        lineEntityId: "line_1",
        target: {
          entityId: "arc_1",
          entityKind: "arc",
          role: "center"
        }
      }).ok
    ).toBe(false);
    expect(
      validateV19CadOp({
        op: "sketch.constraint.update",
        id: "constraint_1",
        definition: { kind: "fixed" }
      }).ok
    ).toBe(false);
    expect(
      validateV19CadOp({
        op: "sketch.constraint.update",
        id: "constraint_1",
        definition: {
          kind: "tangent",
          primaryTarget: { entityId: "line_1", entityKind: "line" },
          secondaryTarget: { entityId: "line_2", entityKind: "line" }
        }
      }).ok
    ).toBe(false);
    expect(
      validateV19CadOp({
        op: "sketch.constraint.update",
        id: "constraint_1",
        definition: {
          kind: "tangent",
          primaryTarget: { entityId: "arc_1", entityKind: "arc" },
          secondaryTarget: { entityId: "arc_2", entityKind: "arc" }
        }
      }).ok
    ).toBe(true);
  });

  it("accepts only complete region-backed V19 feature operations", () => {
    expect(
      validateV19CadOp({
        op: "feature.extrude",
        profile: regionsProfile()
      }).ok
    ).toBe(false);
    expect(
      validateV19CadOp({
        op: "feature.extrude",
        profile: regionsProfile(),
        depth: 10,
        operationMode: "newBody"
      }).ok
    ).toBe(true);
    expect(
      validateV19CadOp({
        op: "feature.revolve",
        profile: regionsProfile(),
        axis: {
          type: "sketchLine",
          sketchId: "sketch_1",
          entityId: "axis_1"
        },
        angleDegrees: 180,
        operationMode: "add"
      }).ok
    ).toBe(false);
    expect(
      validateV19CadOp({
        op: "feature.sweep",
        profile: regionsProfile()
      }).ok
    ).toBe(false);

    const regionExtrude: CadV19Op = {
      op: "feature.extrude",
      profile: regionsProfile(),
      depth: 10
    };
    expect(regionExtrude.op).toBe("feature.extrude");

    const regionFeatureRef: CadFeatureRef = {
      id: "feature_1",
      kind: "extrude",
      bodyId: "body_1",
      sketchId: "sketch_1",
      profile: regionsProfile(),
      depth: 10,
      side: "positive",
      operationMode: "newBody"
    };
    expect(regionFeatureRef.kind).toBe("extrude");
  });

  it("keeps current input-reference diffs discriminated", () => {
    const profileDiff: FeatureInputReferenceSemanticDiffCurrent = {
      featureId: "feature_1",
      inputKind: "profile",
      after: regionsProfile(),
      affectedSketchIds: ["sketch_1"],
      affectedEntityIds: ["circle_outer", "line_1", "arc_1"]
    };
    expect(profileDiff.inputKind).toBe("profile");

    const invalidPair = {
      featureId: "feature_1",
      inputKind: "path",
      after: regionsProfile(),
      affectedSketchIds: ["sketch_1"],
      affectedEntityIds: ["circle_outer"]
    };
    // @ts-expect-error A path diff cannot carry a profile.
    const rejected: FeatureInputReferenceSemanticDiffCurrent = invalidPair;
    expect(rejected.inputKind).toBe("path");
  });

  it("keeps project-health dimension projections ownerless for V22 targets", () => {
    const health: CadSketchDimensionHealth = {
      sourceShape: "v22",
      dimensionId: "dimension_1",
      dimensionName: "Separation",
      sketchId: "sketch_1",
      target: {
        kind: "pointPair",
        primary: {
          entityId: "line_1",
          entityKind: "line",
          role: "start"
        },
        secondary: {
          entityId: "line_2",
          entityKind: "line",
          role: "start"
        },
        measurement: "distance"
      },
      valueSource: { type: "literal", value: 5 },
      status: "healthy",
      affectedFeatureIds: [],
      affectedBodyIds: [],
      effectiveValue: 5,
      issues: []
    };
    expect(health.sourceShape).toBe("v22");
    expect("entityId" in health).toBe(false);
  });
});
