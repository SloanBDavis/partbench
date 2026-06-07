import type { CadBodySnapshot, CadFeatureSummary } from "@web-cad/cad-core";
import type {
  BodyGeneratedReferencesQueryResponse,
  CadGeneratedEdgeReference,
  CadGeneratedFaceReference
} from "@web-cad/cad-protocol";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Inspector } from "./Inspector";

describe("Inspector", () => {
  it("renders generated references as grouped actionable cards", () => {
    const face = createFace();
    const edge = createEdge();
    const markup = renderToStaticMarkup(
      createElement(Inspector, {
        body: createBody(),
        disabled: false,
        feature: createFeature(),
        generatedReferences: createGeneratedReferences(face, edge),
        namedReferences: [],
        selectedGeneratedReference: {
          bodyId: "body_rect",
          stableId: face.stableId,
          kind: "face"
        },
        units: "mm",
        onApplyDimensions: () => undefined,
        onApplyName: () => undefined,
        onApplyTransform: () => undefined,
        onCreateSketchOnFace: () => undefined,
        onCreateEdgeFinish: () => undefined,
        onDeleteNamedReference: () => undefined,
        onNameGeneratedReference: () => undefined,
        onInspectNamedReference: () => undefined,
        onSelectGeneratedReference: () => undefined,
        onDelete: () => undefined,
        onDeleteFeature: () => undefined,
        onUpdateExtrude: () => undefined
      })
    );

    expect(markup).toContain("Generated references");
    expect(markup).toContain("Faces");
    expect(markup).toContain("Edges");
    expect(markup).toContain("Sketch");
    expect(markup).toContain("Chamfer");
    expect(markup).toContain("Fillet");
    expect(markup).toContain("Name");
    expect(markup).toContain("Stable ID and source");
    expect(markup).toContain("Selected reference");
    expect(markup).toContain('<optgroup label="Faces">');
  });

  it("offers feature delete for non-extrude authored bodies", () => {
    const markup = renderToStaticMarkup(
      createElement(Inspector, {
        body: createHoleBody(),
        disabled: false,
        feature: createHoleFeature(),
        namedReferences: [],
        units: "mm",
        onApplyDimensions: () => undefined,
        onApplyName: () => undefined,
        onApplyTransform: () => undefined,
        onCreateSketchOnFace: () => undefined,
        onCreateEdgeFinish: () => undefined,
        onDeleteNamedReference: () => undefined,
        onNameGeneratedReference: () => undefined,
        onInspectNamedReference: () => undefined,
        onSelectGeneratedReference: () => undefined,
        onDelete: () => undefined,
        onDeleteFeature: () => undefined,
        onUpdateExtrude: () => undefined
      })
    );

    expect(markup).toContain("Delete feature");
  });
});

function createBody(): CadBodySnapshot {
  return {
    id: "body_rect",
    kind: "solid",
    partId: "part:default",
    featureId: "feat_rect",
    source: {
      type: "sketchExtrudeFeature",
      featureId: "feat_rect",
      sketchId: "sketch_1",
      entityId: "rect_1",
      profileKind: "rectangle"
    }
  };
}

function createFeature(): Extract<
  CadFeatureSummary,
  { readonly kind: "extrude" }
> {
  return {
    id: "feat_rect",
    kind: "extrude",
    partId: "part:default",
    bodyId: "body_rect",
    sketchId: "sketch_1",
    entityId: "rect_1",
    profileKind: "rectangle",
    depth: 2,
    side: "positive",
    operationMode: "newBody",
    source: {
      type: "sketchEntity",
      sketchId: "sketch_1",
      entityId: "rect_1"
    }
  };
}

function createHoleBody(): CadBodySnapshot {
  return {
    id: "body_hole",
    kind: "solid",
    partId: "part:default",
    featureId: "feat_hole",
    source: {
      type: "sketchHoleFeature",
      featureId: "feat_hole",
      sketchId: "sketch_1",
      circleEntityId: "circle_1",
      targetBodyId: "body_rect"
    }
  };
}

function createHoleFeature(): Extract<
  CadFeatureSummary,
  { readonly kind: "hole" }
> {
  return {
    id: "feat_hole",
    kind: "hole",
    partId: "part:default",
    bodyId: "body_hole",
    targetBodyId: "body_rect",
    sketchId: "sketch_1",
    circleEntityId: "circle_1",
    depthMode: "throughAll",
    direction: "positive",
    source: {
      type: "sketchCircleHole",
      sketchId: "sketch_1",
      circleEntityId: "circle_1",
      targetBodyId: "body_rect"
    }
  };
}

function createGeneratedReferences(
  face: CadGeneratedFaceReference,
  edge: CadGeneratedEdgeReference
): BodyGeneratedReferencesQueryResponse {
  return {
    ok: true,
    query: "body.generatedReferences",
    cadOpsVersion: "cadops.v1",
    body: {
      kind: "body",
      stableId: "generated:body:body_rect",
      label: "Generated body",
      eligibleOperations: [
        "feature.measureReference",
        "feature.selectReference"
      ],
      bodyId: "body_rect",
      ownerPartId: "part:default",
      sourceFeatureId: "feat_rect",
      sourceSketchId: "sketch_1",
      sourceSketchEntityId: "rect_1",
      profileKind: "rectangle",
      geometricSignature: createSignature()
    },
    faceCount: 1,
    faces: [face],
    edgeCount: 1,
    edges: [edge],
    vertexCount: 0,
    vertices: []
  };
}

function createFace(): CadGeneratedFaceReference {
  return {
    kind: "face",
    stableId: "generated:face:body_rect:startCap",
    label: "Start cap",
    description: "Start cap face",
    eligibleOperations: [
      "feature.attachSketchPlane",
      "feature.measureReference",
      "feature.selectReference"
    ],
    bodyId: "body_rect",
    ownerPartId: "part:default",
    sourceFeatureId: "feat_rect",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "rect_1",
    role: "startCap",
    geometricSignature: {
      ...createSignature(),
      surfaceType: "plane"
    }
  };
}

function createEdge(): CadGeneratedEdgeReference {
  return {
    kind: "edge",
    stableId: "generated:edge:body_rect:start:uMin",
    label: "Start uMin edge",
    description: "Start cap uMin edge",
    eligibleOperations: [
      "feature.chamfer",
      "feature.fillet",
      "feature.measureReference",
      "feature.selectReference"
    ],
    bodyId: "body_rect",
    ownerPartId: "part:default",
    sourceFeatureId: "feat_rect",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "rect_1",
    role: "start:uMin",
    adjacentFaceRoles: ["startCap", "side:uMin"],
    geometricSignature: {
      ...createSignature(),
      curveType: "line"
    }
  };
}

function createSignature() {
  return {
    profileKind: "rectangle" as const,
    sketchPlane: "XY" as const,
    extrudeSide: "positive" as const,
    depth: 2
  };
}
