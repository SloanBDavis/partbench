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
      min: [1, 2, 0],
      max: [5, 4, 6]
    });
  });

  it("bounds rotated primitive objects without ignoring rotation", () => {
    const bounds = getRenderSceneBounds([
      {
        ...createBoxPrimitive(),
        transform: {
          translation: [0, 0, 0],
          rotation: [0, 0, Math.PI / 2],
          scale: [1, 1, 1]
        }
      }
    ]);

    expect(bounds?.min[0]).toBeCloseTo(-1);
    expect(bounds?.max[0]).toBeCloseTo(1);
    expect(bounds?.min[1]).toBeCloseTo(-2);
    expect(bounds?.max[1]).toBeCloseTo(2);
    expect(bounds?.min[2]).toBeCloseTo(-3);
    expect(bounds?.max[2]).toBeCloseTo(3);
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

  it("bounds cone and torus primitive objects", () => {
    expect(
      getRenderSceneBounds([
        {
          id: "cone_1",
          kind: "cone",
          dimensions: { radius: 2, height: 6 },
          transform: {
            translation: [1, 2, 3],
            rotation: [0, 0, 0],
            scale: [1, 2, 1]
          }
        }
      ])
    ).toEqual({
      min: [-1, -2, 0],
      max: [3, 6, 6]
    });
    expect(
      getRenderSceneBounds([
        {
          id: "torus_1",
          kind: "torus",
          dimensions: { majorRadius: 3, minorRadius: 0.5 },
          transform: {
            translation: [1, 2, 3],
            rotation: [0, 0, 0],
            scale: [1, 2, 3]
          }
        }
      ])
    ).toEqual({
      min: [-2.5, -5, 1.5],
      max: [4.5, 9, 4.5]
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
      min: [1, 2, 0],
      max: [5, 4, 6]
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

  it("bounds edge-only sketch display meshes for fit-all behavior", () => {
    const bounds = getRenderSceneBounds(
      [],
      [
        {
          id: "sketch:sketch_1",
          kind: "mesh",
          vertices: [],
          indices: [],
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          },
          edgeSegments: [
            {
              start: [-2, -1, 0],
              end: [2, 3, 0]
            }
          ]
        }
      ]
    );

    expect(bounds).toEqual({
      min: [-2, -1, 0],
      max: [2, 3, 0]
    });
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
