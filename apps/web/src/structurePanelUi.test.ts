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
  createStructureTreeSummary,
  formatBodyRole,
  formatBodyStatusLine,
  formatExtrudeOperationMode,
  formatFeatureLine,
  formatHealthStatus,
  formatPartLine,
  getBodyHealthStatus,
  getFeatureHealthStatus,
  getHealthIssues,
  getNamedReferenceHealthStatus,
  getSketchHealthStatus
} from "./structurePanelUi";

describe("structure panel UI helpers", () => {
  it("groups the current V2 structure counts for the model browser", () => {
    const summary = createStructureTreeSummary({
      parts: [createPart()],
      sketches: [createSketch("sketch_1"), createSketch("sketch_face")],
      features: [createPrimitiveFeature(), createExtrudeFeature()],
      bodies: [createPrimitiveBody(), createExtrudeBody()],
      namedReferences: [createNamedReference()],
      health: createHealth({ issueCount: 2, status: "stale" })
    });

    expect(summary).toEqual({
      partCount: 1,
      sketchCount: 2,
      authoredFeatureCount: 1,
      generatedBodyCount: 1,
      namedReferenceCount: 1,
      issueCount: 2,
      status: "stale"
    });
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
      ]
    });

    expect(getFeatureHealthStatus(health, "feature_1")).toBe("missing-source");
    expect(getBodyHealthStatus(health, "body_1")).toBe("missing-source");
    expect(getSketchHealthStatus(health, "sketch_1")).toBe("missing-source");
    expect(getSketchHealthStatus(health, "sketch_face")).toBe("healthy");
    expect(getNamedReferenceHealthStatus(health, "top")).toBe("stale");
    expect(
      getHealthIssues(health, { kind: "feature", id: "feature_1" })
    ).toEqual(["Source rectangle is missing."]);
    expect(
      getHealthIssues(health, { kind: "namedReference", name: "top" })
    ).toEqual(["Named reference target is stale."]);
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

  it("formats part and authored extrude lines compactly", () => {
    expect(formatPartLine(createPart())).toBe(
      "1 sketches / 2 features / 2 bodies"
    );
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
  });

  it("formats generated body roles for standalone, boolean result, and consumed targets", () => {
    const standalone = createExtrudeBody("body_1", "feature_1");
    const consumed = createExtrudeBody("body_target", "feature_target", {
      consumedByFeatureId: "feature_cut"
    });
    const cutResult = createExtrudeBody("body_cut", "feature_cut");
    const addResult = createExtrudeBody("body_add", "feature_add");

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
    attachedSketchCount: overrides.attachedSketches?.length ?? 0,
    sketchEvaluationCount: overrides.sketchEvaluations?.length ?? 0,
    sketchDimensionCount: overrides.sketchDimensions?.length ?? 0,
    sketchConstraintCount: overrides.sketchConstraints?.length ?? 0,
    namedReferenceCount: overrides.namedReferences?.length ?? 0,
    authoredExtrudes: [],
    authoredRevolves: [],
    attachedSketches: [],
    sketchEvaluations: [],
    sketchDimensions: [],
    sketchConstraints: [],
    namedReferences: [],
    ...overrides
  };
}

function createPart(): CadPartSnapshot {
  return {
    id: "part:default",
    kind: "part",
    name: "Default part",
    source: { type: "defaultScenePart" },
    objectIds: ["box_1"],
    featureIds: ["feature:box_1", "feature_1"],
    bodyIds: ["body:box_1", "body_1"],
    sketchIds: ["sketch_1"]
  };
}

function createSketch(id: string): SketchSnapshot {
  return {
    id,
    name: id,
    plane: "XY",
    entities: []
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

function createNamedReference(): NamedGeneratedReferenceEntry {
  return {
    name: "top",
    bodyId: "body_1",
    stableId: "generated:face:body_1:endCap",
    kind: "face",
    status: "stale"
  };
}
