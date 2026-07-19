import type {
  CadBodySnapshot,
  CadFeatureSummary,
  CadObjectSnapshot,
  CadPartSnapshot,
  NamedGeneratedReferenceEntry,
  ProjectHealthQueryResponse,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import {
  createDocumentTreeProjection,
  documentTreeSelectionKey
} from "./documentTreeProjection";

describe("document tree projection", () => {
  it("groups ownership and interleaves source sketches with their features", () => {
    const projection = createProjection();

    expect(projection.groups.map((group) => group.label)).toEqual([
      "Origin",
      "Parameters",
      "Model",
      "Named references"
    ]);
    expect(projection.groups[0].rows.map((row) => row.label)).toEqual([
      "Top plane",
      "Front plane",
      "Right plane"
    ]);
    expect(projection.groups[1].rows.map((row) => row.label)).toEqual(["wall"]);
    expect(projection.groups[2].rows.map((row) => row.label)).toEqual([
      "Profile",
      "Pad",
      "Base block",
      "Later sketch"
    ]);
    expect(projection.groups[3].rows.map((row) => row.label)).toEqual([
      "top face"
    ]);
  });

  it("nests entities, source objects, and result bodies under one owner", () => {
    const projection = createProjection();
    const profile = projection.rowsById.get("sketch:sketch_profile");
    const primitive = projection.rowsById.get("feature:feature_box");
    const allIds = [...projection.rowsById.keys()];

    expect(profile?.children.map((row) => row.id)).toEqual([
      "sketch-entity:sketch_profile:rect_1"
    ]);
    expect(primitive?.children.map((row) => row.id)).toEqual([
      "object:box_1",
      "body:body_box"
    ]);
    expect(allIds.filter((id) => id === "body:body_box")).toHaveLength(1);
    expect(allIds).toContain("named-reference:top face");
  });

  it("adds row operations only from the precomputed capability map", () => {
    const projection = createProjection();
    const body = projection.rowsById.get("body:body_box");
    const sketch = projection.rowsById.get("sketch:sketch_profile");

    expect(body?.capabilities).toEqual({ visible: false, canDelete: true });
    expect(sketch?.capabilities).toEqual({});
    expect(
      documentTreeSelectionKey({ kind: "origin-plane", plane: "XY" })
    ).toBe("origin-plane:XY");
  });

  it("projects query-backed health into a compact human badge", () => {
    const projection = createDocumentTreeProjection({
      ...createProjectionInput(),
      health: createHealth({
        status: "stale",
        issueCount: 1,
        namedReferences: [
          {
            name: "top face",
            bodyId: "body_pad",
            stableId: "generated:face:body_pad:endCap",
            kind: "face",
            status: "stale",
            issues: [
              {
                code: "GENERATED_REFERENCE_NOT_FOUND",
                message: "Named reference target is stale.",
                bodyId: "body_pad",
                stableId: "generated:face:body_pad:endCap",
                referenceName: "top face"
              }
            ]
          }
        ]
      })
    });

    expect(projection.rowsById.get("named-reference:top face")?.health).toEqual(
      {
        label: "Needs attention",
        tone: "error",
        description: "Named reference target is stale."
      }
    );
  });
});

function createProjection() {
  return createDocumentTreeProjection(createProjectionInput());
}

function createProjectionInput() {
  return {
    parts: [createPart()],
    parameters: [
      { id: "parameter_wall", name: "wall", value: 2, expression: "base / 2" }
    ],
    sketches: [
      createSketch("sketch_profile", "Profile"),
      createSketch("sketch_later", "Later sketch")
    ],
    features: [createPrimitiveFeature(), createExtrudeFeature()],
    bodies: [createPrimitiveBody(), createExtrudeBody()],
    objects: [createBox()],
    namedReferences: [createNamedReference()],
    capabilitiesBySelectionKey: new Map([
      ["body:body_box", { visible: false, canDelete: true }]
    ])
  } as const;
}

function createPart(): CadPartSnapshot {
  return {
    id: "part:default",
    kind: "part",
    name: "Default part",
    source: { type: "defaultScenePart" },
    objectIds: ["box_1"],
    featureIds: ["feature_pad", "feature_box"],
    bodyIds: ["body_pad", "body_box"],
    sketchIds: ["sketch_later", "sketch_profile"]
  };
}

function createSketch(id: string, name: string): SketchSnapshot {
  return {
    id,
    name,
    plane: "XY",
    entities:
      id === "sketch_profile"
        ? [
            {
              id: "rect_1",
              kind: "rectangle",
              construction: false,
              center: [0, 0],
              width: 4,
              height: 2
            }
          ]
        : []
  };
}

function createPrimitiveFeature(): CadFeatureSummary {
  return {
    id: "feature_box",
    kind: "primitive",
    name: "Base block",
    partId: "part:default",
    primitive: "box",
    objectId: "box_1",
    bodyId: "body_box",
    dimensions: { width: 4, height: 2, depth: 1 },
    transform: createTransform(),
    source: { type: "sceneObject" }
  };
}

function createExtrudeFeature(): CadFeatureSummary {
  return {
    id: "feature_pad",
    kind: "extrude",
    name: "Pad",
    partId: "part:default",
    bodyId: "body_pad",
    sketchId: "sketch_profile",
    entityId: "rect_1",
    profileKind: "rectangle",
    depth: 5,
    side: "positive",
    operationMode: "newBody",
    source: {
      type: "sketchEntity",
      sketchId: "sketch_profile",
      entityId: "rect_1"
    }
  };
}

function createPrimitiveBody(): CadBodySnapshot {
  return {
    id: "body_box",
    kind: "solid",
    partId: "part:default",
    featureId: "feature_box",
    objectId: "box_1",
    primitive: "box",
    source: {
      type: "primitiveFeature",
      featureId: "feature_box",
      objectId: "box_1"
    }
  };
}

function createExtrudeBody(): CadBodySnapshot {
  return {
    id: "body_pad",
    kind: "solid",
    partId: "part:default",
    featureId: "feature_pad",
    source: {
      type: "sketchExtrudeFeature",
      featureId: "feature_pad",
      sketchId: "sketch_profile",
      entityId: "rect_1",
      profileKind: "rectangle"
    }
  };
}

function createBox(): CadObjectSnapshot {
  return {
    id: "box_1",
    kind: "box",
    name: "Base object",
    dimensions: { width: 4, height: 2, depth: 1 },
    transform: createTransform()
  };
}

function createNamedReference(): NamedGeneratedReferenceEntry {
  return {
    name: "top face",
    bodyId: "body_pad",
    stableId: "generated:face:body_pad:endCap",
    kind: "face",
    status: "resolved"
  };
}

function createHealth(
  overrides: Partial<ProjectHealthQueryResponse> = {}
): ProjectHealthQueryResponse {
  return {
    ok: true,
    query: "project.health",
    cadOpsVersion: "cadops.v1",
    status: "healthy",
    issueCount: 0,
    authoredExtrudeCount: 0,
    authoredRevolveCount: 0,
    authoredHoleCount: 0,
    authoredChamferCount: 0,
    authoredFilletCount: 0,
    authoredShellCount: 0,
    attachedSketchCount: 0,
    sketchEvaluationCount: 0,
    sketchDimensionCount: 0,
    sketchConstraintCount: 0,
    namedReferenceCount: overrides.namedReferences?.length ?? 0,
    authoredExtrudes: [],
    authoredRevolves: [],
    authoredHoles: [],
    authoredChamfers: [],
    authoredFillets: [],
    authoredShells: [],
    attachedSketches: [],
    sketchEvaluations: [],
    sketchDimensions: [],
    sketchConstraints: [],
    namedReferences: [],
    ...overrides
  };
}

function createTransform() {
  return {
    translation: [0, 0, 0] as const,
    rotation: [0, 0, 0] as const,
    scale: [1, 1, 1] as const
  };
}
