import { createDefaultCamera, type RenderPrimitive } from "@web-cad/renderer";
import { describe, expect, it } from "vitest";
import { fitCameraToRenderScene, getRenderSceneBounds } from "./viewportCamera";

describe("viewport camera helpers", () => {
  it("returns no bounds for an empty scene", () => {
    expect(getRenderSceneBounds([])).toBeUndefined();
  });

  it("bounds current primitive objects", () => {
    const bounds = getRenderSceneBounds([createBoxPrimitive()]);

    expect(bounds).toEqual({
      min: [1, 0, 2],
      max: [5, 6, 4]
    });
  });

  it("fits the camera target and distance to visible content", () => {
    const camera = createDefaultCamera();
    const fitted = fitCameraToRenderScene(camera, [createBoxPrimitive()]);

    expect(fitted.target).toEqual([3, 3, 3]);
    expect(fitted.distance).toBeCloseTo(11.97, 2);
    expect(fitted.yaw).toBe(camera.yaw);
    expect(fitted.pitch).toBe(camera.pitch);
  });
});

function createBoxPrimitive(): RenderPrimitive {
  return {
    id: "box_1",
    kind: "box",
    dimensions: {
      width: 4,
      height: 2,
      depth: 6
    },
    transform: {
      translation: [3, 3, 3],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}
