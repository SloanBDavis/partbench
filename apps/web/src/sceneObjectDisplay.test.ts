import type { BoxObject, CylinderObject } from "@web-cad/cad-core";
import { describe, expect, it } from "vitest";
import {
  formatDimensions,
  formatObjectKind,
  formatObjectPosition,
  formatObjectScale,
  formatVector
} from "./sceneObjectDisplay";

describe("scene object display helpers", () => {
  it("formats object kinds and dimensions for object lists and inspector", () => {
    expect(formatObjectKind("box")).toBe("Box");
    expect(formatObjectKind("cylinder")).toBe("Cylinder");
    expect(formatDimensions(createBoxObject())).toBe("2 x 3.25 x 4");
    expect(formatDimensions(createCylinderObject())).toBe("r 1.50, h 4");
  });

  it("formats transform values compactly", () => {
    const object = createBoxObject();

    expect(formatVector([1, 2.345, 3])).toBe("1, 2.35, 3");
    expect(formatObjectPosition(object)).toBe("pos 1, 2.35, 3");
    expect(formatObjectScale(object)).toBe("scale 1, 1, 2");
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
