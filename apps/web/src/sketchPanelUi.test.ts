import { describe, expect, it } from "vitest";
import type { SketchSnapshot } from "@web-cad/cad-protocol";
import {
  chooseSketchEntitySelection,
  chooseSketchPanelSelection,
  getDefaultSketchEntityKind,
  getSketchEntityOptionLabel,
  isExtrudableSketchEntity
} from "./sketchPanelUi";

describe("sketch panel UI helpers", () => {
  it("focuses a newly created sketch when there is no current selection", () => {
    const sketches = [createSketch("sketch_1"), createSketch("sketch_face_1")];

    expect(
      chooseSketchPanelSelection(sketches, undefined, "sketch_face_1")
    ).toBe("sketch_face_1");
  });

  it("keeps current selection before focus and falls back when focus is stale", () => {
    const sketches = [createSketch("sketch_1"), createSketch("sketch_2")];

    expect(chooseSketchPanelSelection(sketches, "sketch_2", "sketch_1")).toBe(
      "sketch_2"
    );
    expect(
      chooseSketchPanelSelection(sketches, "sketch_2", "missing_sketch")
    ).toBe("sketch_2");
    expect(
      chooseSketchPanelSelection(sketches, "missing_sketch", undefined)
    ).toBe("sketch_1");
    expect(chooseSketchPanelSelection([], "sketch_1", "sketch_2")).toBe(
      undefined
    );
  });

  it("defaults empty attached sketches to rectangle entity creation", () => {
    expect(getDefaultSketchEntityKind(createSketch("sketch_1"))).toBe("point");
    expect(
      getDefaultSketchEntityKind(
        createSketch("sketch_face_1", {
          attachment: {
            kind: "generatedFace",
            bodyId: "body_1",
            faceStableId: "generated:face:body_1:endCap",
            sourceFeatureId: "feat_1",
            sourceSketchId: "sketch_1",
            sourceSketchEntityId: "rect_1",
            faceRole: "endCap"
          }
        })
      )
    ).toBe("rectangle");
    expect(
      getDefaultSketchEntityKind(
        createSketch("sketch_face_1", {
          attachment: {
            kind: "generatedFace",
            bodyId: "body_1",
            faceStableId: "generated:face:body_1:endCap",
            sourceFeatureId: "feat_1",
            sourceSketchId: "sketch_1",
            sourceSketchEntityId: "rect_1",
            faceRole: "endCap"
          },
          entities: [
            {
              id: "circle_1",
              kind: "circle",
              center: [0, 0],
              radius: 1
            }
          ]
        })
      )
    ).toBe("point");
  });

  it("keeps selected entities compact and falls back when stale", () => {
    const entities: SketchSnapshot["entities"] = [
      {
        id: "rect_1",
        kind: "rectangle",
        center: [0, 0],
        width: 4,
        height: 2
      },
      { id: "circle_1", kind: "circle", center: [1, 1], radius: 2 }
    ];

    expect(chooseSketchEntitySelection(entities, "circle_1")).toBe("circle_1");
    expect(chooseSketchEntitySelection(entities, "missing")).toBe("rect_1");
    expect(chooseSketchEntitySelection([], "missing")).toBeUndefined();
    expect(getSketchEntityOptionLabel(entities[0])).toBe(
      "rect_1 / rectangle 4 x 2"
    );
    expect(getSketchEntityOptionLabel(entities[1])).toBe(
      "circle_1 / circle r 2"
    );
    expect(isExtrudableSketchEntity(entities[0])).toBe(true);
    expect(isExtrudableSketchEntity(entities[1])).toBe(true);
    expect(
      isExtrudableSketchEntity({
        id: "point_1",
        kind: "point",
        point: [0, 0]
      })
    ).toBe(false);
  });
});

function createSketch(
  id: string,
  overrides: Partial<SketchSnapshot> = {}
): SketchSnapshot {
  return {
    id,
    name: id,
    plane: "XY",
    entities: [],
    ...overrides
  };
}
