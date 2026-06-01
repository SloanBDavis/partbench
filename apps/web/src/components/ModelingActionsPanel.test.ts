import type {
  CadGeneratedFaceReference,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { deriveModelingActions } from "../modelingActions";
import { ModelingActionsPanel } from "./ModelingActionsPanel";

describe("ModelingActionsPanel", () => {
  it("renders a sketch entity summary with available and unavailable actions", () => {
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
    expect(markup).toContain("Extrude");
    expect(markup).toContain("Open Sketch");
    expect(markup).toContain(
      "Add a non-zero line entity in this sketch to use as the revolve axis."
    );
    expect(markup).toContain("Unavailable");
  });

  it("renders no-selection actions as a sketch-panel next step", () => {
    const context = { selectionKind: "none" as const };
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context
      })
    );

    expect(markup).toContain("No modeling context selected");
    expect(markup).toContain("Create sketch");
    expect(markup).toContain("Open Sketch");
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
    expect(markup).not.toContain("generated:face:body_rect:startCap");
  });
});

function createSketch(
  id: string,
  name: string,
  entities: SketchSnapshot["entities"] = []
): SketchSnapshot {
  return {
    id,
    name,
    plane: "XY",
    entities
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
