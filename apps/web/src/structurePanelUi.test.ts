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

  it("formats part and authored extrude lines compactly", () => {
    expect(formatPartLine(createPart())).toBe(
      "1 sketches / 2 features / 2 bodies"
    );
    expect(formatFeatureLine(createExtrudeFeature(), "mm")).toBe(
      "new body / rectangle / 4 mm / positive"
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
    attachedSketchCount: overrides.attachedSketches?.length ?? 0,
    namedReferenceCount: overrides.namedReferences?.length ?? 0,
    authoredExtrudes: [],
    attachedSketches: [],
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

function createExtrudeBody(): CadBodySnapshot {
  return {
    id: "body_1",
    kind: "solid",
    partId: "part:default",
    featureId: "feature_1",
    source: {
      type: "sketchExtrudeFeature",
      featureId: "feature_1",
      sketchId: "sketch_1",
      entityId: "rect_1",
      profileKind: "rectangle"
    }
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
