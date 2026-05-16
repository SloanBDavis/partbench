import { createDefaultCamera, type RenderPrimitive } from "@web-cad/renderer";
import { describe, expect, it } from "vitest";
import {
  fitCameraToRenderObject,
  fitCameraToRenderScene,
  getRenderObjectBounds,
  getRenderSceneBounds
} from "./viewportCamera";

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

  it("bounds sphere primitive objects", () => {
    const bounds = getRenderSceneBounds([
      {
        id: "sphere_1",
        kind: "sphere",
        dimensions: { radius: 2 },
        transform: {
          translation: [1, 2, 3],
          rotation: [0, 0, 0],
          scale: [1, 2, 3]
        }
      }
    ]);

    expect(bounds).toEqual({
      min: [-1, -2, -3],
      max: [3, 6, 9]
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

  it("bounds and fits a selected primitive object", () => {
    const camera = createDefaultCamera();
    const fitted = fitCameraToRenderObject(camera, "box_1", [
      createBoxPrimitive()
    ]);

    expect(getRenderObjectBounds("box_1", [createBoxPrimitive()])).toEqual({
      min: [1, 0, 2],
      max: [5, 6, 4]
    });
    expect(fitted.target).toEqual([3, 3, 3]);
    expect(fitted.distance).toBeCloseTo(11.97, 2);
  });

  it("bounds and fits a selected mesh object", () => {
    const camera = createDefaultCamera();
    const mesh = {
      id: "mesh_1",
      kind: "mesh" as const,
      vertices: [
        [-1, -1, 0] as const,
        [1, -1, 0] as const,
        [1, 1, 0] as const,
        [-1, 1, 0] as const
      ],
      indices: [0, 1, 2, 0, 2, 3],
      transform: {
        translation: [4, 5, 6] as const,
        rotation: [0, 0, 0] as const,
        scale: [2, 3, 1] as const
      }
    };
    const fitted = fitCameraToRenderObject(camera, "mesh_1", [], [mesh]);

    expect(getRenderObjectBounds("mesh_1", [], [mesh])).toEqual({
      min: [2, 2, 6],
      max: [6, 8, 6]
    });
    expect(fitted.target).toEqual([4, 5, 6]);
    expect(fitted.distance).toBeCloseTo(11.54, 2);
  });

  it("keeps the current camera when no selected renderable exists", () => {
    const camera = createDefaultCamera();

    expect(fitCameraToRenderObject(camera, undefined, [])).toBe(camera);
    expect(fitCameraToRenderObject(camera, "missing", [])).toBe(camera);
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
