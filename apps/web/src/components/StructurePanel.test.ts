import type {
  CadBodySnapshot,
  CadFeatureSummary,
  CadPartSnapshot,
  ProjectHealthQueryResponse,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StructurePanel } from "./StructurePanel";

describe("StructurePanel", () => {
  it("renders lineage before legacy category groups with target and result bodies", () => {
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

    expect(markup.indexOf("Lineage")).toBeLessThan(markup.indexOf("Objects"));
    expect(markup).toContain("Default part");
    expect(markup).toContain("rect_1");
    expect(markup).toContain("feature_cut");
    expect(markup).toContain("Consumed target");
    expect(markup).toContain("Cut result");
    expect(markup).toContain("Selected");
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
