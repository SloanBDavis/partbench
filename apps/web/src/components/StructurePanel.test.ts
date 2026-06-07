import type {
  BodyGeneratedReferencesQueryResponse,
  CadBodySnapshot,
  CadFeatureSummary,
  CadPartSnapshot,
  CadGeneratedFaceReference,
  ProjectHealthQueryResponse,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StructurePanel } from "./StructurePanel";

describe("StructurePanel", () => {
  it("renders a primary model tree without legacy category groups", () => {
    const markup = renderToStaticMarkup(
      createElement(StructurePanel, {
        bodies: [
          createExtrudeBody("body_base", "feature_base", {
            consumedByFeatureId: "feature_cut"
          }),
          createExtrudeBody("body_cut", "feature_cut")
        ],
        features: [createBaseFeature(), createCutFeature()],
        health: createHealth(),
        namedReferences: [],
        objects: [],
        parts: [createPart()],
        selectedId: "body_cut",
        sketches: [createSketch()],
        units: "mm",
        onFocusSketch: () => undefined,
        onInspectNamedReference: () => undefined,
        onSelect: () => undefined
      })
    );

    expect(markup).toContain("Default part");
    expect(markup).toContain("Profile");
    expect(markup).toContain("Rectangle");
    expect(markup).toContain("Extrude");
    expect(markup).toContain("Cut");
    expect(markup).toContain("Hidden input / replaced by result");
    expect(markup).toContain("Cut result");
    expect(markup).not.toContain("feature_cut");
    expect(markup).not.toContain("body_base");
    expect(markup).not.toContain("Lineage");
    expect(markup).not.toContain("Advanced browser");
    expect(markup).not.toContain("Objects");
  });

  it("renders selected generated references inside the primary body lineage", () => {
    const references = createGeneratedReferences();
    const markup = renderToStaticMarkup(
      createElement(StructurePanel, {
        bodies: [createExtrudeBody("body_base", "feature_base")],
        features: [createBaseFeature()],
        generatedReferences: references,
        health: createHealth(),
        namedReferences: [],
        objects: [],
        parts: [createPart()],
        selectedGeneratedReference: {
          bodyId: "body_base",
          stableId: "generated:face:body_base:startCap"
        },
        selectedId: "body_base",
        sketches: [createSketch()],
        units: "mm",
        onFocusSketch: () => undefined,
        onInspectNamedReference: () => undefined,
        onSelect: () => undefined,
        onSelectGeneratedReference: () => undefined
      })
    );

    expect(markup.indexOf("References")).toBeGreaterThan(
      markup.indexOf("Result body")
    );
    expect(markup).toContain("Body");
    expect(markup).toContain("Faces");
    expect(markup).toContain("Edges");
    expect(markup).toContain("Start cap");
    expect(markup).toContain("Sketch plane");
    expect(markup).toContain("Start uMin edge");
    expect(markup).toContain("Chamfer");
    expect(markup).not.toContain("generated:face:body_base:startCap");
  });

  it("keeps only the active sketch lineage open by default", () => {
    const markup = renderToStaticMarkup(
      createElement(StructurePanel, {
        bodies: [createExtrudeBody("body_base", "feature_base")],
        features: [createBaseFeature()],
        focusedSketchId: "sketch_2",
        health: createHealth(),
        namedReferences: [],
        objects: [],
        parts: [
          {
            ...createPart(),
            featureIds: ["feature_base"],
            bodyIds: ["body_base"],
            sketchIds: ["sketch_1", "sketch_2"]
          }
        ],
        selectedId: undefined,
        sketches: [
          createSketch(),
          {
            id: "sketch_2",
            name: "Second sketch",
            plane: "XZ",
            entities: []
          }
        ],
        units: "mm",
        onFocusSketch: () => undefined,
        onInspectNamedReference: () => undefined,
        onSelect: () => undefined
      })
    );

    expect(
      markup.match(/<details class="model-story-sketch-block" open="">/g)
        ?.length
    ).toBe(1);
    expect(markup).toContain("Second sketch");
    expect(markup).toContain("Open");
  });
});

function createHealth(): ProjectHealthQueryResponse {
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
    attachedSketchCount: 0,
    sketchEvaluationCount: 0,
    sketchDimensionCount: 0,
    sketchConstraintCount: 0,
    namedReferenceCount: 0,
    authoredExtrudes: [],
    authoredRevolves: [],
    authoredHoles: [],
    authoredChamfers: [],
    authoredFillets: [],
    attachedSketches: [],
    sketchEvaluations: [],
    sketchDimensions: [],
    sketchConstraints: [],
    namedReferences: []
  };
}

function createPart(): CadPartSnapshot {
  return {
    id: "part:default",
    kind: "part",
    name: "Default part",
    source: { type: "defaultScenePart" },
    objectIds: [],
    featureIds: ["feature_base", "feature_cut"],
    bodyIds: ["body_base", "body_cut"],
    sketchIds: ["sketch_1"]
  };
}

function createSketch(): SketchSnapshot {
  return {
    id: "sketch_1",
    name: "Profile",
    plane: "XY",
    entities: [
      {
        id: "rect_1",
        kind: "rectangle",
        center: [0, 0],
        width: 4,
        height: 2
      }
    ]
  };
}

function createBaseFeature(): Extract<CadFeatureSummary, { kind: "extrude" }> {
  return {
    id: "feature_base",
    kind: "extrude",
    partId: "part:default",
    bodyId: "body_base",
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
    ...createBaseFeature(),
    id: "feature_cut",
    bodyId: "body_cut",
    depth: 1,
    operationMode: "cut",
    targetBodyId: "body_base"
  };
}

function createExtrudeBody(
  id: string,
  featureId: string,
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

function createGeneratedReferences(): BodyGeneratedReferencesQueryResponse {
  const face = createFaceReference();

  return {
    ok: true,
    query: "body.generatedReferences",
    cadOpsVersion: "cadops.v1",
    body: {
      kind: "body",
      stableId: "generated:body:body_base",
      label: "Rectangle extrude body",
      eligibleOperations: [
        "feature.measureReference",
        "feature.selectReference"
      ],
      bodyId: "body_base",
      ownerPartId: "part:default",
      sourceFeatureId: "feature_base",
      sourceSketchId: "sketch_1",
      sourceSketchEntityId: "rect_1",
      profileKind: "rectangle",
      geometricSignature: {
        profileKind: "rectangle",
        profile: {
          kind: "rectangle",
          center: [0, 0],
          width: 4,
          height: 2
        },
        extrudeSide: "positive",
        depth: 4,
        sketchPlane: "XY",
        surfaceType: "plane"
      }
    },
    faceCount: 1,
    faces: [face],
    edgeCount: 1,
    edges: [
      {
        kind: "edge",
        stableId: "generated:edge:body_base:start:uMin",
        label: "Start uMin edge",
        eligibleOperations: [
          "feature.chamfer",
          "feature.fillet",
          "feature.measureReference",
          "feature.selectReference"
        ],
        bodyId: "body_base",
        ownerPartId: "part:default",
        sourceFeatureId: "feature_base",
        sourceSketchId: "sketch_1",
        sourceSketchEntityId: "rect_1",
        role: "start:uMin",
        adjacentFaceRoles: ["startCap", "side:uMin"],
        geometricSignature: {
          profileKind: "rectangle",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 2
          },
          extrudeSide: "positive",
          depth: 4,
          sketchPlane: "XY",
          curveType: "line"
        }
      }
    ],
    vertexCount: 0,
    vertices: []
  };
}

function createFaceReference(): CadGeneratedFaceReference {
  return {
    kind: "face",
    stableId: "generated:face:body_base:startCap",
    label: "Start cap",
    eligibleOperations: [
      "feature.attachSketchPlane",
      "feature.measureReference",
      "feature.selectReference"
    ],
    bodyId: "body_base",
    ownerPartId: "part:default",
    sourceFeatureId: "feature_base",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "rect_1",
    role: "startCap",
    geometricSignature: {
      profileKind: "rectangle",
      profile: {
        kind: "rectangle",
        center: [0, 0],
        width: 4,
        height: 2
      },
      extrudeSide: "positive",
      depth: 4,
      sketchPlane: "XY",
      surfaceType: "plane"
    }
  };
}
