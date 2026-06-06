import type {
  CadBodySnapshot,
  CadFeatureSummary,
  CadGeneratedEdgeReference,
  CadGeneratedFaceReference,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { deriveModelingActions } from "../modelingActions";
import { getExtrudeSideForOperationMode } from "../sketchPanelUi";
import { ModelingActionsPanel } from "./ModelingActionsPanel";

describe("ModelingActionsPanel", () => {
  it("renders sketch entity controls without sketch-opening shortcuts", () => {
    const rectangle: SketchSnapshot["entities"][number] = {
      id: "rect_1",
      kind: "rectangle",
      center: [0, 0],
      width: 4,
      height: 2
    };
    const sketch = createSketch("sketch_1", "Sketch 1", [rectangle]);
    const context = {
      selectionKind: "sketchEntity" as const,
      sketch,
      entity: rectangle
    };
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context
      })
    );

    expect(markup).toContain("Rectangle in Sketch 1");
    expect(markup).toContain("Edit Rectangle");
    expect(markup).toContain("Driving dimension");
    expect(markup).toContain("Create feature");
    expect(markup).toContain("Create extrude");
    expect(markup).not.toContain("Open Sketch");
  });

  it("keeps sketch creation visible while editing a selected entity", () => {
    const rectangle: SketchSnapshot["entities"][number] = {
      id: "rect_1",
      kind: "rectangle",
      center: [0, 0],
      width: 4,
      height: 2
    };
    const sketch = createSketch("sketch_1", "Sketch 1", [rectangle]);
    const context = {
      selectionKind: "sketchEntity" as const,
      sketch,
      entity: rectangle
    };
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context,
        onCreateSketch: () => undefined,
        onDeleteSketch: () => undefined,
        onRenameSketch: () => undefined
      })
    );

    expect(markup).toContain("+ Sketch");
    expect(markup).toContain("XY");
    expect(markup).toContain("Active sketch");
    expect(markup).toContain("Rename");
    expect(markup).toContain("Delete");
    expect(markup).toContain("Rectangle in Sketch 1");
  });

  it("uses the next available sketch name for quick sketch creation", () => {
    const context = { selectionKind: "none" as const };
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context,
        sketches: [
          createSketch("sketch_1", "Sketch 1"),
          createSketch("sketch_2", "Sketch 2")
        ],
        onCreateSketch: () => undefined
      })
    );

    expect(markup).toContain("+ Sketch");
    expect(markup).toContain("Create Sketch 3");
    expect(markup).toContain("Open sketch");
  });

  it("renders no-selection controls as direct sketch creation", () => {
    const context = { selectionKind: "none" as const };
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context,
        onCreateSketch: () => undefined
      })
    );

    expect(markup).toContain("Create a source sketch");
    expect(markup).toContain("+ Sketch");
    expect(markup).not.toContain("Open Sketch");
  });

  it("renders selected sketch controls as direct entity creation", () => {
    const sketch = createSketch("sketch_1", "Sketch 1");
    const context = {
      selectionKind: "sketch" as const,
      sketch
    };
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context
      })
    );

    expect(markup).toContain("Sketch 1");
    expect(markup).toContain("Sketch tools");
    expect(markup).toContain("Rectangle");
    expect(markup).not.toContain("Open Sketch");
  });

  it("renders selected body lifecycle actions directly", () => {
    const body: CadBodySnapshot = {
      id: "body_rect",
      kind: "solid",
      partId: "part_default",
      featureId: "feat_rect",
      name: "Rectangle body",
      source: {
        type: "sketchExtrudeFeature",
        featureId: "feat_rect",
        sketchId: "sketch_1",
        entityId: "rect_1",
        profileKind: "rectangle"
      }
    };
    const feature: CadFeatureSummary = {
      id: "feat_rect",
      kind: "extrude",
      partId: "part_default",
      bodyId: "body_rect",
      sketchId: "sketch_1",
      entityId: "rect_1",
      profileKind: "rectangle",
      depth: 1,
      side: "positive",
      operationMode: "newBody",
      source: {
        type: "sketchEntity",
        sketchId: "sketch_1",
        entityId: "rect_1"
      }
    };
    const context = {
      selectionKind: "body" as const,
      body,
      feature
    };
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context,
        onCreateSketchOnFace: () => undefined,
        onDeleteFeature: () => undefined,
        onSelectSketch: () => undefined
      })
    );

    expect(markup).toContain("Body actions");
    expect(markup).toContain("Source sketch");
    expect(markup).toContain("Delete feature");
    expect(markup).toContain("Sketch on face");
    expect(markup).not.toContain("feat_rect");
  });

  it("renders generated reference summaries without using raw IDs as labels", () => {
    const reference = createFace({
      label: "Start cap"
    });
    const context = {
      selectionKind: "generatedReference",
      reference
    } as const;
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context
      })
    );

    expect(markup).toContain("Face");
    expect(markup).toContain("Start cap");
    expect(markup).toContain("Name reference");
    expect(markup).toContain("Create sketch on face");
    expect(markup).not.toContain("generated:face:body_rect:startCap");
  });

  it("renders edge reference naming and edge-finish controls directly", () => {
    const reference = createEdge({
      label: "Start uMin edge"
    });
    const context = {
      selectionKind: "generatedReference",
      reference
    } as const;
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context
      })
    );

    expect(markup).toContain("Name reference");
    expect(markup).toContain("Edge finish");
    expect(markup).toContain("Chamfer");
    expect(markup).toContain("Fillet");
    expect(markup).toContain("Create chamfer");
    expect(markup).not.toContain("generated:edge:body_rect:start:uMin");
  });

  it("defaults attached sketch cuts inward from the selected face", () => {
    const attachedSketch = createSketch("sketch_face_1", "Face sketch", [], {
      kind: "generatedFace",
      bodyId: "body_rect",
      faceStableId: "generated:face:body_rect:endCap",
      faceRole: "endCap",
      sourceFeatureId: "feat_rect",
      sourceSketchId: "sketch_1",
      sourceSketchEntityId: "rect_1"
    });
    const baseSketch = createSketch("sketch_1", "Base sketch");

    expect(
      getExtrudeSideForOperationMode(attachedSketch, "cut", "positive")
    ).toBe("negative");
    expect(
      getExtrudeSideForOperationMode(attachedSketch, "newBody", "negative")
    ).toBe("positive");
    expect(getExtrudeSideForOperationMode(baseSketch, "cut", "positive")).toBe(
      "positive"
    );
  });
});

function createSketch(
  id: string,
  name: string,
  entities: SketchSnapshot["entities"] = [],
  attachment?: SketchSnapshot["attachment"]
): SketchSnapshot {
  return {
    id,
    name,
    plane: "XY",
    entities,
    ...(attachment ? { attachment } : {})
  };
}

function createFace(
  overrides: Partial<CadGeneratedFaceReference> = {}
): CadGeneratedFaceReference {
  return {
    kind: "face",
    stableId: "generated:face:body_rect:startCap",
    label: "Start cap",
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
      profileKind: "rectangle",
      sketchPlane: "XY",
      extrudeSide: "positive",
      depth: 2,
      surfaceType: "plane"
    },
    ...overrides
  };
}

function createEdge(
  overrides: Partial<CadGeneratedEdgeReference> = {}
): CadGeneratedEdgeReference {
  return {
    kind: "edge",
    stableId: "generated:edge:body_rect:start:uMin",
    label: "Start uMin edge",
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
      profileKind: "rectangle",
      profile: {
        kind: "rectangle",
        center: [0, 0],
        width: 4,
        height: 2
      },
      sketchPlane: "XY",
      extrudeSide: "positive",
      depth: 2,
      curveType: "line"
    },
    ...overrides
  };
}
