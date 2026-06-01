import { describe, expect, it } from "vitest";
import type {
  CadFeatureSummary,
  CadPartSnapshot,
  NamedGeneratedReferenceEntry,
  ProjectHealthQueryResponse,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import type { CadBodySnapshot } from "@web-cad/cad-core";
import {
  createStructureLineage,
  createStructureTreeSummary,
  formatBodyRole,
  formatBodyStatusLine,
  formatExtrudeOperationMode,
  formatFeatureKindLabel,
  formatFeatureLine,
  formatHealthStatus,
  formatLineageTargetLine,
  formatLineageTargetRole,
  formatPartLine,
  formatRevolveOperationMode,
  getBodyHealthStatus,
  getFeatureHealthStatus,
  getHealthIssues,
  getNamedReferenceHealthStatus,
  getSketchHealthStatus,
  isAuthoredStructureBody,
  isAuthoredStructureFeature
} from "./structurePanelUi";

describe("structure panel UI helpers", () => {
  it("groups the current structure counts for the model browser", () => {
    const summary = createStructureTreeSummary({
      parts: [createPart()],
      sketches: [createSketch("sketch_1"), createSketch("sketch_face")],
      features: [
        createPrimitiveFeature(),
        createExtrudeFeature(),
        createRevolveFeature(),
        createHoleFeature(),
        createChamferFeature(),
        createFilletFeature()
      ],
      bodies: [
        createPrimitiveBody(),
        createExtrudeBody(),
        createRevolveBody(),
        createHoleBody(),
        createChamferBody(),
        createFilletBody()
      ],
      namedReferences: [createNamedReference()],
      health: createHealth({ issueCount: 2, status: "stale" })
    });

    expect(summary).toEqual({
      partCount: 1,
      sketchCount: 2,
      authoredFeatureCount: 5,
      generatedBodyCount: 5,
      namedReferenceCount: 1,
      issueCount: 2,
      status: "stale"
    });
    expect(isAuthoredStructureFeature(createPrimitiveFeature())).toBe(false);
    expect(isAuthoredStructureFeature(createExtrudeFeature())).toBe(true);
    expect(isAuthoredStructureFeature(createRevolveFeature())).toBe(true);
    expect(isAuthoredStructureFeature(createHoleFeature())).toBe(true);
    expect(isAuthoredStructureFeature(createChamferFeature())).toBe(true);
    expect(isAuthoredStructureFeature(createFilletFeature())).toBe(true);
    expect(isAuthoredStructureBody(createPrimitiveBody())).toBe(false);
    expect(isAuthoredStructureBody(createExtrudeBody())).toBe(true);
    expect(isAuthoredStructureBody(createRevolveBody())).toBe(true);
    expect(isAuthoredStructureBody(createHoleBody())).toBe(true);
    expect(isAuthoredStructureBody(createChamferBody())).toBe(true);
    expect(isAuthoredStructureBody(createFilletBody())).toBe(true);
  });

  it("groups lineage under sketch entities with consumed targets and result bodies", () => {
    const sketch = createSketch("sketch_1", [
      {
        id: "rect_1",
        kind: "rectangle",
        center: [0, 0],
        width: 4,
        height: 2
      },
      {
        id: "circle_1",
        kind: "circle",
        center: [1, 1],
        radius: 0.5
      }
    ]);
    const cutFeature = createCutFeature();
    const holeFeature = createHoleFeature({ targetBodyId: "body_hole_target" });
    const chamferFeature = createChamferFeature({
      targetBodyId: "body_chamfer_target"
    });
    const lineage = createStructureLineage({
      parts: [
        createPart({
          featureIds: [
            "feature_1",
            cutFeature.id,
            holeFeature.id,
            chamferFeature.id
          ],
          bodyIds: [
            "body_1",
            "body_cut",
            "body_target",
            "body_hole",
            "body_hole_target",
            "body_chamfer",
            "body_chamfer_target"
          ],
          sketchIds: ["sketch_1"]
        })
      ],
      sketches: [sketch],
      features: [
        createExtrudeFeature(),
        cutFeature,
        holeFeature,
        chamferFeature
      ],
      bodies: [
        createExtrudeBody(),
        createExtrudeBody("body_cut", cutFeature.id),
        createExtrudeBody("body_target", "feature_seed", {
          consumedByFeatureId: cutFeature.id
        }),
        createHoleBody({ targetBodyId: "body_hole_target" }),
        createExtrudeBody("body_hole_target", "feature_hole_seed", {
          consumedByFeatureId: holeFeature.id
        }),
        createChamferBody({ targetBodyId: "body_chamfer_target" }),
        createExtrudeBody("body_chamfer_target", "feature_chamfer_seed", {
          consumedByFeatureId: chamferFeature.id
        })
      ]
    });

    expect(lineage.featureNodeCount).toBe(4);
    expect(lineage.targetNodeCount).toBe(3);

    const partNode = lineage.parts[0];
    const sketchNode = partNode?.sketchNodes[0];
    const rectNode = sketchNode?.entityNodes.find(
      (entity) => entity.entityId === "rect_1"
    );
    const circleNode = sketchNode?.entityNodes.find(
      (entity) => entity.entityId === "circle_1"
    );

    expect(rectNode?.featureNodes.map((node) => node.feature.id)).toEqual([
      "feature_1",
      "feature_cut"
    ]);
    expect(circleNode?.featureNodes.map((node) => node.feature.id)).toEqual([
      "feature_hole"
    ]);

    const cutNode = rectNode?.featureNodes.find(
      (node) => node.feature.id === "feature_cut"
    );
    const cutTarget = cutNode?.target;
    expect(cutNode?.resultBody?.id).toBe("body_cut");
    expect(cutTarget?.bodyId).toBe("body_target");
    expect(cutTarget?.consumedByThisFeature).toBe(true);
    expect(cutTarget).toBeDefined();
    if (!cutTarget) {
      throw new Error("Expected cut target lineage");
    }
    expect(formatLineageTargetRole(cutTarget)).toBe("Consumed target");
    expect(formatLineageTargetLine(cutTarget)).toBe("Consumed by this feature");

    const holeNode = circleNode?.featureNodes[0];
    const holeTarget = holeNode?.target;
    expect(holeNode?.target?.bodyId).toBe("body_hole_target");
    expect(holeTarget).toBeDefined();
    if (!holeTarget) {
      throw new Error("Expected hole target lineage");
    }
    expect(formatLineageTargetRole(holeTarget)).toBe("Consumed target");

    expect(partNode?.directFeatureNodes.map((node) => node.feature.id)).toEqual(
      ["feature_chamfer"]
    );
    expect(partNode?.directFeatureNodes[0]?.target?.bodyId).toBe(
      "body_chamfer_target"
    );
  });

  it("formats missing and externally consumed lineage targets", () => {
    const missingLineage = createStructureLineage({
      parts: [
        createPart({
          featureIds: ["feature_cut"],
          bodyIds: ["body_cut"],
          sketchIds: ["sketch_1"]
        })
      ],
      sketches: [createSketch("sketch_1")],
      features: [createCutFeature()],
      bodies: [createExtrudeBody("body_cut", "feature_cut")]
    });
    const missingTarget =
      missingLineage.parts[0]?.directFeatureNodes[0]?.target ??
      missingLineage.parts[0]?.sketchNodes[0]?.entityNodes[0]?.featureNodes[0]
        ?.target;

    expect(formatLineageTargetRole(missingTarget!)).toBe("Missing target");
    expect(formatLineageTargetLine(missingTarget!)).toBe("Missing body_target");

    const consumedByOther = createStructureLineage({
      parts: [
        createPart({
          featureIds: ["feature_cut"],
          bodyIds: ["body_cut", "body_target"],
          sketchIds: ["sketch_1"]
        })
      ],
      sketches: [createSketch("sketch_1")],
      features: [createCutFeature()],
      bodies: [
        createExtrudeBody("body_cut", "feature_cut"),
        createExtrudeBody("body_target", "feature_seed", {
          consumedByFeatureId: "feature_later"
        })
      ]
    });
    const externalTarget =
      consumedByOther.parts[0]?.directFeatureNodes[0]?.target ??
      consumedByOther.parts[0]?.sketchNodes[0]?.entityNodes[0]?.featureNodes[0]
        ?.target;

    expect(formatLineageTargetRole(externalTarget!)).toBe("Target body");
    expect(formatLineageTargetLine(externalTarget!)).toBe(
      "Consumed by feature_later"
    );
  });

  it("formats dependency health without leaking raw status strings", () => {
    expect(formatHealthStatus("healthy")).toEqual({
      label: "Healthy",
      className: "health-healthy"
    });
    expect(formatHealthStatus("missing-source")).toEqual({
      label: "Missing source",
      className: "health-missing-source"
    });
    expect(formatHealthStatus("under-defined")).toEqual({
      label: "Under-defined",
      className: "health-under-defined"
    });
    expect(formatHealthStatus("over-defined")).toEqual({
      label: "Over-defined",
      className: "health-over-defined"
    });
  });

  it("finds health by sketch, feature, body, and named reference", () => {
    const health = createHealth({
      authoredExtrudes: [
        {
          featureId: "feature_1",
          bodyId: "body_1",
          sketchId: "sketch_1",
          entityId: "rect_1",
          profileKind: "rectangle",
          operationMode: "newBody",
          status: "missing-source",
          issues: [
            {
              code: "SKETCH_ENTITY_NOT_FOUND",
              message: "Source rectangle is missing.",
              featureId: "feature_1",
              bodyId: "body_1",
              sketchId: "sketch_1",
              sketchEntityId: "rect_1"
            }
          ]
        }
      ],
      attachedSketches: [
        {
          sketchId: "sketch_face",
          sketchName: "Face sketch",
          plane: "XY",
          bodyId: "body_1",
          faceStableId: "generated:face:body_1:endCap",
          sourceFeatureId: "feature_1",
          sourceSketchId: "sketch_1",
          sourceSketchEntityId: "rect_1",
          faceRole: "endCap",
          status: "healthy",
          resolves: true,
          eligibleForSketchPlane: true,
          resolvedKind: "face",
          resolvedFaceRole: "endCap",
          issues: []
        }
      ],
      namedReferences: [
        {
          name: "top",
          bodyId: "body_1",
          stableId: "generated:face:body_1:endCap",
          kind: "face",
          status: "stale",
          issues: [
            {
              code: "GENERATED_REFERENCE_NOT_FOUND",
              message: "Named reference target is stale.",
              bodyId: "body_1",
              stableId: "generated:face:body_1:endCap",
              referenceName: "top"
            }
          ]
        }
      ],
      authoredRevolves: [
        {
          featureId: "feature_revolve",
          bodyId: "body_revolve",
          sketchId: "sketch_1",
          entityId: "circle_1",
          profileKind: "circle",
          axis: {
            type: "sketchLine",
            sketchId: "sketch_1",
            entityId: "axis_1"
          },
          angleDegrees: 360,
          operationMode: "newBody",
          status: "unsupported",
          issues: [
            {
              code: "UNSUPPORTED_BODY_REFERENCES",
              message: "Revolve topology is not available yet.",
              featureId: "feature_revolve",
              bodyId: "body_revolve"
            }
          ]
        }
      ],
      authoredHoles: [
        {
          featureId: "feature_hole",
          bodyId: "body_hole",
          targetBodyId: "body_1",
          sketchId: "sketch_1",
          circleEntityId: "circle_1",
          depthMode: "blind",
          depth: 1,
          direction: "positive",
          status: "unsupported",
          issues: [
            {
              code: "UNSUPPORTED_BODY_REFERENCES",
              message: "Hole target is unsupported.",
              featureId: "feature_hole",
              bodyId: "body_hole"
            }
          ]
        }
      ]
    });

    expect(getFeatureHealthStatus(health, "feature_1")).toBe("missing-source");
    expect(getBodyHealthStatus(health, "body_1")).toBe("missing-source");
    expect(getSketchHealthStatus(health, "sketch_1")).toBe("missing-source");
    expect(getFeatureHealthStatus(health, "feature_revolve")).toBe(
      "unsupported"
    );
    expect(getBodyHealthStatus(health, "body_revolve")).toBe("unsupported");
    expect(getFeatureHealthStatus(health, "feature_hole")).toBe("unsupported");
    expect(getBodyHealthStatus(health, "body_hole")).toBe("unsupported");
    expect(getSketchHealthStatus(health, "sketch_face")).toBe("healthy");
    expect(getNamedReferenceHealthStatus(health, "top")).toBe("stale");
    expect(
      getHealthIssues(health, { kind: "feature", id: "feature_1" })
    ).toEqual(["Source rectangle is missing."]);
    expect(
      getHealthIssues(health, { kind: "namedReference", name: "top" })
    ).toEqual(["Named reference target is stale."]);
    expect(
      getHealthIssues(health, { kind: "feature", id: "feature_revolve" })
    ).toEqual(["Revolve topology is not available yet."]);
    expect(
      getHealthIssues(health, { kind: "body", id: "body_revolve" })
    ).toEqual(["Revolve topology is not available yet."]);
    expect(
      getHealthIssues(health, { kind: "feature", id: "feature_hole" })
    ).toEqual(["Hole target is unsupported."]);
    expect(getHealthIssues(health, { kind: "body", id: "body_hole" })).toEqual([
      "Hole target is unsupported."
    ]);
  });

  it("includes sketch dimension health in affected sketches, features, and bodies", () => {
    const health = createHealth({
      authoredExtrudes: [
        {
          featureId: "feature_1",
          bodyId: "body_1",
          sketchId: "sketch_1",
          entityId: "rect_1",
          profileKind: "rectangle",
          operationMode: "newBody",
          status: "healthy",
          issues: []
        }
      ],
      sketchDimensions: [
        {
          dimensionId: "dim_width",
          dimensionName: "Width",
          sketchId: "sketch_1",
          entityId: "rect_1",
          target: { entityKind: "rectangle", role: "width" },
          valueSource: { type: "parameter", parameterId: "param_missing" },
          status: "missing-source",
          affectedFeatureIds: ["feature_1"],
          affectedBodyIds: ["body_1"],
          parameterId: "param_missing",
          issues: [
            {
              code: "PARAMETER_NOT_FOUND",
              message: "Parameter does not exist: param_missing.",
              parameterId: "param_missing",
              sketchDimensionId: "dim_width",
              sketchId: "sketch_1",
              sketchEntityId: "rect_1"
            }
          ]
        }
      ]
    });

    expect(getSketchHealthStatus(health, "sketch_1")).toBe("missing-source");
    expect(getFeatureHealthStatus(health, "feature_1")).toBe("missing-source");
    expect(getBodyHealthStatus(health, "body_1")).toBe("missing-source");
    expect(getHealthIssues(health, { kind: "sketch", id: "sketch_1" })).toEqual(
      ["Parameter does not exist: param_missing."]
    );
    expect(
      getHealthIssues(health, { kind: "feature", id: "feature_1" })
    ).toEqual(["Parameter does not exist: param_missing."]);
    expect(getHealthIssues(health, { kind: "body", id: "body_1" })).toEqual([
      "Parameter does not exist: param_missing."
    ]);
  });

  it("includes sketch evaluation completeness health in affected sketches, features, and bodies", () => {
    const health = createHealth({
      authoredExtrudes: [
        {
          featureId: "feature_1",
          bodyId: "body_1",
          sketchId: "sketch_1",
          entityId: "rect_1",
          profileKind: "rectangle",
          operationMode: "newBody",
          status: "healthy",
          issues: []
        }
      ],
      sketchEvaluations: [
        {
          sketchId: "sketch_1",
          sketchName: "Profile",
          plane: "XY",
          status: "under-defined",
          drivenEntityIds: ["rect_1"],
          affectedFeatureIds: ["feature_1"],
          affectedBodyIds: ["body_1"],
          issues: [
            {
              code: "UNDER_DEFINED_SKETCH",
              message: "Sketch sketch_1 is under-defined.",
              sketchId: "sketch_1"
            }
          ]
        }
      ]
    });

    expect(getSketchHealthStatus(health, "sketch_1")).toBe("under-defined");
    expect(getFeatureHealthStatus(health, "feature_1")).toBe("under-defined");
    expect(getBodyHealthStatus(health, "body_1")).toBe("under-defined");
    expect(getHealthIssues(health, { kind: "sketch", id: "sketch_1" })).toEqual(
      ["Sketch sketch_1 is under-defined."]
    );
    expect(
      getHealthIssues(health, { kind: "feature", id: "feature_1" })
    ).toEqual(["Sketch sketch_1 is under-defined."]);
    expect(getHealthIssues(health, { kind: "body", id: "body_1" })).toEqual([
      "Sketch sketch_1 is under-defined."
    ]);
  });

  it("combines attached sketch status with local dimension and constraint health", () => {
    const health = createHealth({
      attachedSketches: [
        {
          sketchId: "sketch_face",
          sketchName: "Face sketch",
          plane: "XY",
          bodyId: "body_1",
          faceStableId: "generated:face:body_1:endCap",
          sourceFeatureId: "feature_1",
          sourceSketchId: "sketch_1",
          sourceSketchEntityId: "rect_1",
          faceRole: "endCap",
          status: "healthy",
          resolves: true,
          eligibleForSketchPlane: true,
          resolvedKind: "face",
          resolvedFaceRole: "endCap",
          issues: []
        }
      ],
      sketchDimensions: [
        {
          dimensionId: "dim_attached_width",
          dimensionName: "Attached width",
          sketchId: "sketch_face",
          entityId: "rect_attached",
          target: { entityKind: "rectangle", role: "width" },
          valueSource: { type: "parameter", parameterId: "missing_width" },
          parameterId: "missing_width",
          status: "missing-source",
          affectedFeatureIds: [],
          affectedBodyIds: [],
          issues: [
            {
              code: "PARAMETER_NOT_FOUND",
              message: "Parameter does not exist: missing_width.",
              parameterId: "missing_width",
              sketchDimensionId: "dim_attached_width",
              sketchId: "sketch_face",
              sketchEntityId: "rect_attached"
            }
          ]
        }
      ]
    });

    expect(getSketchHealthStatus(health, "sketch_face")).toBe("missing-source");
    expect(
      getHealthIssues(health, { kind: "sketch", id: "sketch_face" })
    ).toEqual(["Parameter does not exist: missing_width."]);
  });

  it("includes sketch constraint health in affected sketches, features, and bodies", () => {
    const health = createHealth({
      authoredExtrudes: [
        {
          featureId: "feature_1",
          bodyId: "body_1",
          sketchId: "sketch_1",
          entityId: "line_1",
          profileKind: "rectangle",
          operationMode: "newBody",
          status: "healthy",
          issues: []
        }
      ],
      sketchConstraints: [
        {
          constraintId: "co_conflict",
          constraintName: "Point conflict",
          sketchId: "sketch_1",
          entityId: "line_1",
          kind: "coincident",
          status: "unsupported",
          affectedFeatureIds: ["feature_1"],
          affectedBodyIds: ["body_1"],
          primaryTarget: { entityId: "line_1", role: "start" },
          secondaryTarget: { entityId: "point_1", role: "position" },
          primaryCurrentCoordinate: [0, 0],
          secondaryCurrentCoordinate: [1, 1],
          issues: [
            {
              code: "INCONSISTENT_SKETCH_CONSTRAINT",
              message:
                "Coincident sketch constraint cannot satisfy two different fixed coordinates.",
              sketchConstraintId: "co_conflict",
              sketchId: "sketch_1",
              sketchEntityId: "line_1",
              primaryTarget: { entityId: "line_1", role: "start" },
              secondaryTarget: { entityId: "point_1", role: "position" }
            }
          ]
        }
      ]
    });

    expect(getSketchHealthStatus(health, "sketch_1")).toBe("unsupported");
    expect(getFeatureHealthStatus(health, "feature_1")).toBe("unsupported");
    expect(getBodyHealthStatus(health, "body_1")).toBe("unsupported");
    expect(getHealthIssues(health, { kind: "sketch", id: "sketch_1" })).toEqual(
      [
        "Coincident sketch constraint cannot satisfy two different fixed coordinates."
      ]
    );
    expect(
      getHealthIssues(health, { kind: "feature", id: "feature_1" })
    ).toEqual([
      "Coincident sketch constraint cannot satisfy two different fixed coordinates."
    ]);
    expect(getHealthIssues(health, { kind: "body", id: "body_1" })).toEqual([
      "Coincident sketch constraint cannot satisfy two different fixed coordinates."
    ]);
  });

  it("formats part and authored feature lines compactly", () => {
    expect(formatPartLine(createPart())).toBe(
      "1 sketches / 2 features / 2 bodies"
    );
    expect(formatFeatureKindLabel(createExtrudeFeature())).toBe("Extrude");
    expect(formatFeatureKindLabel(createRevolveFeature())).toBe("Revolve");
    expect(formatFeatureLine(createExtrudeFeature(), "mm")).toBe(
      "new body / rectangle / 4 mm / positive"
    );
    expect(formatExtrudeOperationMode("cut")).toBe("cut body");
    expect(formatFeatureLine(createCutFeature(), "mm")).toBe(
      "cut body / rectangle / 2 mm / positive / target body_target"
    );
    expect(formatExtrudeOperationMode("add")).toBe("add to body");
    expect(formatFeatureLine(createAddFeature(), "mm")).toBe(
      "add to body / rectangle / 2 mm / positive / target body_target"
    );
    expect(formatRevolveOperationMode("newBody")).toBe("new body");
    expect(formatFeatureLine(createRevolveFeature(), "mm")).toBe(
      "new body / circle / 270 deg / axis axis_1"
    );
    expect(formatFeatureKindLabel(createChamferFeature())).toBe("Chamfer");
    expect(formatFeatureLine(createChamferFeature(), "mm")).toBe(
      "chamfer / 0.25 mm / target body_target / edge generated:edge:body_target:side:uMin"
    );
    expect(formatFeatureKindLabel(createFilletFeature())).toBe("Fillet");
    expect(formatFeatureLine(createFilletFeature(), "mm")).toBe(
      "fillet / 0.5 mm / target body_target / ref target_edge"
    );
  });

  it("formats generated body roles for standalone, boolean result, and consumed targets", () => {
    const standalone = createExtrudeBody("body_1", "feature_1");
    const consumed = createExtrudeBody("body_target", "feature_target", {
      consumedByFeatureId: "feature_cut"
    });
    const cutResult = createExtrudeBody("body_cut", "feature_cut");
    const addResult = createExtrudeBody("body_add", "feature_add");
    const revolveResult = createRevolveBody();
    const holeResult = createHoleBody();
    const chamferResult = createChamferBody();
    const filletResult = createFilletBody();

    expect(formatBodyRole(standalone, createExtrudeFeature())).toBe(
      "Generated body"
    );
    expect(formatBodyStatusLine(standalone, createExtrudeFeature())).toBe(
      "Feature feature_1"
    );
    expect(formatBodyRole(consumed, createExtrudeFeature())).toBe(
      "Consumed target"
    );
    expect(formatBodyStatusLine(consumed, createExtrudeFeature())).toBe(
      "Consumed by feature_cut"
    );
    expect(formatBodyRole(cutResult, createCutFeature())).toBe("Cut result");
    expect(formatBodyStatusLine(cutResult, createCutFeature())).toBe(
      "Cuts body_target"
    );
    expect(formatBodyRole(addResult, createAddFeature())).toBe("Add result");
    expect(formatBodyStatusLine(addResult, createAddFeature())).toBe(
      "Adds to body_target"
    );
    expect(formatBodyRole(revolveResult, createRevolveFeature())).toBe(
      "Generated body"
    );
    expect(formatBodyStatusLine(revolveResult, createRevolveFeature())).toBe(
      "Feature feature_revolve"
    );
    expect(formatBodyRole(holeResult, createHoleFeature())).toBe("Hole result");
    expect(formatBodyStatusLine(holeResult, createHoleFeature())).toBe(
      "Holes body_target"
    );
    expect(formatBodyRole(chamferResult, createChamferFeature())).toBe(
      "Chamfer result"
    );
    expect(formatBodyStatusLine(chamferResult, createChamferFeature())).toBe(
      "Chamfers body_target"
    );
    expect(formatBodyRole(filletResult, createFilletFeature())).toBe(
      "Fillet result"
    );
    expect(formatBodyStatusLine(filletResult, createFilletFeature())).toBe(
      "Fillets body_target"
    );
  });
});

function createHealth(
  overrides: Partial<ProjectHealthQueryResponse> = {}
): ProjectHealthQueryResponse {
  return {
    ok: true,
    query: "project.health",
    cadOpsVersion: "cadops.v1",
    status: "healthy",
    issueCount: 0,
    authoredExtrudeCount: overrides.authoredExtrudes?.length ?? 0,
    authoredRevolveCount: overrides.authoredRevolves?.length ?? 0,
    authoredHoleCount: overrides.authoredHoles?.length ?? 0,
    authoredChamferCount: overrides.authoredChamfers?.length ?? 0,
    authoredFilletCount: overrides.authoredFillets?.length ?? 0,
    attachedSketchCount: overrides.attachedSketches?.length ?? 0,
    sketchEvaluationCount: overrides.sketchEvaluations?.length ?? 0,
    sketchDimensionCount: overrides.sketchDimensions?.length ?? 0,
    sketchConstraintCount: overrides.sketchConstraints?.length ?? 0,
    namedReferenceCount: overrides.namedReferences?.length ?? 0,
    authoredExtrudes: [],
    authoredRevolves: [],
    authoredHoles: [],
    authoredChamfers: [],
    authoredFillets: [],
    attachedSketches: [],
    sketchEvaluations: [],
    sketchDimensions: [],
    sketchConstraints: [],
    namedReferences: [],
    ...overrides
  };
}

function createPart(
  overrides: Partial<
    Pick<CadPartSnapshot, "featureIds" | "bodyIds" | "sketchIds">
  > = {}
): CadPartSnapshot {
  return {
    id: "part:default",
    kind: "part",
    name: "Default part",
    source: { type: "defaultScenePart" },
    objectIds: ["box_1"],
    featureIds: ["feature:box_1", "feature_1"],
    bodyIds: ["body:box_1", "body_1"],
    sketchIds: ["sketch_1"],
    ...overrides
  };
}

function createSketch(
  id: string,
  entities: SketchSnapshot["entities"] = []
): SketchSnapshot {
  return {
    id,
    name: id,
    plane: "XY",
    entities
  };
}

function createPrimitiveFeature(): CadFeatureSummary {
  return {
    id: "feature:box_1",
    kind: "primitive",
    partId: "part:default",
    primitive: "box",
    objectId: "box_1",
    bodyId: "body:box_1",
    dimensions: { width: 1, height: 1, depth: 1 },
    transform: {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    },
    source: { type: "sceneObject" }
  };
}

function createExtrudeFeature(): Extract<
  CadFeatureSummary,
  { kind: "extrude" }
> {
  return {
    id: "feature_1",
    kind: "extrude",
    partId: "part:default",
    bodyId: "body_1",
    sketchId: "sketch_1",
    entityId: "rect_1",
    profileKind: "rectangle",
    depth: 4,
    side: "positive",
    operationMode: "newBody",
    source: {
      type: "sketchEntity",
      sketchId: "sketch_1",
      entityId: "rect_1"
    }
  };
}

function createCutFeature(): Extract<CadFeatureSummary, { kind: "extrude" }> {
  return {
    ...createExtrudeFeature(),
    id: "feature_cut",
    bodyId: "body_cut",
    depth: 2,
    operationMode: "cut",
    targetBodyId: "body_target"
  };
}

function createAddFeature(): Extract<CadFeatureSummary, { kind: "extrude" }> {
  return {
    ...createExtrudeFeature(),
    id: "feature_add",
    bodyId: "body_add",
    depth: 2,
    operationMode: "add",
    targetBodyId: "body_target"
  };
}

function createRevolveFeature(): Extract<
  CadFeatureSummary,
  { kind: "revolve" }
> {
  return {
    id: "feature_revolve",
    kind: "revolve",
    partId: "part:default",
    bodyId: "body_revolve",
    sketchId: "sketch_1",
    entityId: "circle_1",
    profileKind: "circle",
    axis: { type: "sketchLine", sketchId: "sketch_1", entityId: "axis_1" },
    angleDegrees: 270,
    operationMode: "newBody",
    source: {
      type: "sketchEntityWithAxis",
      sketchId: "sketch_1",
      entityId: "circle_1",
      axis: { type: "sketchLine", sketchId: "sketch_1", entityId: "axis_1" }
    }
  };
}

function createHoleFeature(
  overrides: Partial<Extract<CadFeatureSummary, { kind: "hole" }>> = {}
): Extract<CadFeatureSummary, { kind: "hole" }> {
  const targetBodyId = overrides.targetBodyId ?? "body_target";

  return {
    id: "feature_hole",
    kind: "hole",
    partId: "part:default",
    bodyId: "body_hole",
    targetBodyId,
    sketchId: "sketch_1",
    circleEntityId: "circle_1",
    depthMode: "blind",
    depth: 1,
    direction: "positive",
    source: {
      type: "sketchCircleHole",
      sketchId: "sketch_1",
      circleEntityId: "circle_1",
      targetBodyId
    },
    ...overrides
  };
}

function createChamferFeature(
  overrides: Partial<Extract<CadFeatureSummary, { kind: "chamfer" }>> = {}
): Extract<CadFeatureSummary, { kind: "chamfer" }> {
  const targetBodyId = overrides.targetBodyId ?? "body_target";

  return {
    id: "feature_chamfer",
    kind: "chamfer",
    partId: "part:default",
    bodyId: "body_chamfer",
    targetBodyId,
    edgeStableId: "generated:edge:body_target:side:uMin",
    distance: 0.25,
    source: {
      type: "generatedEdgeChamfer",
      targetBodyId,
      edgeStableId: "generated:edge:body_target:side:uMin"
    },
    ...overrides
  };
}

function createFilletFeature(
  overrides: Partial<Extract<CadFeatureSummary, { kind: "fillet" }>> = {}
): Extract<CadFeatureSummary, { kind: "fillet" }> {
  const targetBodyId = overrides.targetBodyId ?? "body_target";

  return {
    id: "feature_fillet",
    kind: "fillet",
    partId: "part:default",
    bodyId: "body_fillet",
    targetBodyId,
    namedReference: "target_edge",
    radius: 0.5,
    source: {
      type: "generatedEdgeFillet",
      targetBodyId,
      namedReference: "target_edge"
    },
    ...overrides
  };
}

function createPrimitiveBody(): CadBodySnapshot {
  return {
    id: "body:box_1",
    kind: "solid",
    partId: "part:default",
    featureId: "feature:box_1",
    objectId: "box_1",
    primitive: "box",
    source: {
      type: "primitiveFeature",
      featureId: "feature:box_1",
      objectId: "box_1"
    }
  };
}

function createExtrudeBody(
  id = "body_1",
  featureId = "feature_1",
  overrides: Partial<CadBodySnapshot> = {}
): CadBodySnapshot {
  return {
    id,
    kind: "solid",
    partId: "part:default",
    featureId,
    source: {
      type: "sketchExtrudeFeature",
      featureId,
      sketchId: "sketch_1",
      entityId: "rect_1",
      profileKind: "rectangle"
    },
    ...overrides
  };
}

function createRevolveBody(): CadBodySnapshot {
  return {
    id: "body_revolve",
    kind: "solid",
    partId: "part:default",
    featureId: "feature_revolve",
    source: {
      type: "sketchRevolveFeature",
      featureId: "feature_revolve",
      sketchId: "sketch_1",
      entityId: "circle_1",
      profileKind: "circle",
      axis: { type: "sketchLine", sketchId: "sketch_1", entityId: "axis_1" }
    }
  };
}

function createHoleBody(
  options: Partial<CadBodySnapshot> & { readonly targetBodyId?: string } = {}
): CadBodySnapshot {
  const { targetBodyId: targetBodyOverride, ...overrides } = options;
  const targetBodyId =
    targetBodyOverride ??
    (overrides.source?.type === "sketchHoleFeature"
      ? overrides.source.targetBodyId
      : "body_target");

  return {
    id: "body_hole",
    kind: "solid",
    partId: "part:default",
    featureId: "feature_hole",
    source: {
      type: "sketchHoleFeature",
      featureId: "feature_hole",
      targetBodyId,
      sketchId: "sketch_1",
      circleEntityId: "circle_1"
    },
    ...overrides
  };
}

function createChamferBody(
  options: Partial<CadBodySnapshot> & { readonly targetBodyId?: string } = {}
): CadBodySnapshot {
  const { targetBodyId: targetBodyOverride, ...overrides } = options;
  const targetBodyId =
    targetBodyOverride ??
    (overrides.source?.type === "edgeChamferFeature"
      ? overrides.source.targetBodyId
      : "body_target");

  return {
    id: "body_chamfer",
    kind: "solid",
    partId: "part:default",
    featureId: "feature_chamfer",
    source: {
      type: "edgeChamferFeature",
      featureId: "feature_chamfer",
      targetBodyId,
      edgeStableId: "generated:edge:body_target:side:uMin"
    },
    ...overrides
  };
}

function createFilletBody(
  options: Partial<CadBodySnapshot> & { readonly targetBodyId?: string } = {}
): CadBodySnapshot {
  const { targetBodyId: targetBodyOverride, ...overrides } = options;
  const targetBodyId =
    targetBodyOverride ??
    (overrides.source?.type === "edgeFilletFeature"
      ? overrides.source.targetBodyId
      : "body_target");

  return {
    id: "body_fillet",
    kind: "solid",
    partId: "part:default",
    featureId: "feature_fillet",
    source: {
      type: "edgeFilletFeature",
      featureId: "feature_fillet",
      targetBodyId,
      namedReference: "target_edge"
    },
    ...overrides
  };
}

function createNamedReference(): NamedGeneratedReferenceEntry {
  return {
    name: "top",
    bodyId: "body_1",
    stableId: "generated:face:body_1:endCap",
    kind: "face",
    status: "stale"
  };
}
