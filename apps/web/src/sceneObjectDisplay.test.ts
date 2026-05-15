import type { BoxObject, CylinderObject } from "@web-cad/cad-core";
import { describe, expect, it } from "vitest";
import {
  formatBounds,
  formatDimensions,
  getObjectDisplayName,
  formatObjectKind,
  formatObjectPosition,
  formatObjectScale,
  formatVector,
  formatVolume
} from "./sceneObjectDisplay";

describe("scene object display helpers", () => {
  it("formats object kinds and dimensions for object lists and inspector", () => {
    expect(formatObjectKind("box")).toBe("Box");
    expect(formatObjectKind("cylinder")).toBe("Cylinder");
    expect(formatDimensions(createBoxObject())).toBe("2 x 3.25 x 4");
    expect(formatDimensions(createBoxObject(), "mm")).toBe("2 x 3.25 x 4 mm");
    expect(formatDimensions(createCylinderObject())).toBe("r 1.50, h 4");
    expect(formatDimensions(createCylinderObject(), "in")).toBe(
      "r 1.50 in, h 4 in"
    );
    expect(getObjectDisplayName(createBoxObject())).toBe("box_1");
    expect(getObjectDisplayName({ ...createBoxObject(), name: "Base" })).toBe(
      "Base"
    );
  });

  it("formats transform values compactly", () => {
    const object = createBoxObject();

    expect(formatVector([1, 2.345, 3])).toBe("1, 2.35, 3");
    expect(formatObjectPosition(object)).toBe("pos 1, 2.35, 3");
    expect(formatObjectScale(object)).toBe("scale 1, 1, 2");
  });

  it("formats measurement values", () => {
    expect(
      formatBounds(
        {
          min: [-1, -2.345, -3],
          max: [1, 2.345, 3],
          size: [2, 4.69, 6],
          center: [0, 0, 0]
        },
        "mm"
      )
    ).toBe(
      "min -1 mm, -2.35 mm, -3 mm; max 1 mm, 2.35 mm, 3 mm; size 2 mm, 4.69 mm, 6 mm"
    );
    expect(formatVolume(12.345, "mm")).toBe("12.35 mm^3");
  });
});

function createBoxObject(): BoxObject {
  return {
    id: "box_1",
    kind: "box",
    dimensions: {
      width: 2,
      height: 3.25,
      depth: 4
    },
    transform: {
      translation: [1, 2.345, 3],
      rotation: [0, 0, 0],
      scale: [1, 1, 2]
    }
  };
}

function createCylinderObject(): CylinderObject {
  return {
    id: "cylinder_1",
    kind: "cylinder",
    dimensions: {
      radius: 1.5,
      height: 4
    },
    transform: {
      translation: [0, 0, 2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}
