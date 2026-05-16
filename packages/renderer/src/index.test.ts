import { describe, expect, it } from "vitest";
import {
  createDefaultCamera,
  orbitCamera,
  panCamera,
  pickPrimitive,
  pickRenderScene,
  projectPoint,
  rendererPackage,
  zoomCamera
} from "./index";

describe("renderer", () => {
  it("exports package status", () => {
    expect(rendererPackage).toEqual({
      name: "@web-cad/renderer",
      status: "ready"
    });
  });

  it("projects a world point into viewport space", () => {
    const projected = projectPoint([0, 0, 0], createDefaultCamera(), {
      width: 800,
      height: 600
    });

    expect(projected?.x).toBeGreaterThan(0);
    expect(projected?.x).toBeLessThan(800);
    expect(projected?.y).toBeGreaterThan(0);
    expect(projected?.y).toBeLessThan(600);
    expect(projected?.depth).toBeGreaterThan(0);
  });

  it("updates orbit, pan, and zoom camera state", () => {
    const camera = createDefaultCamera();
    const orbited = orbitCamera(camera, { x: 20, y: -10 });
    const panned = panCamera(
      orbited,
      { x: 12, y: -8 },
      { width: 800, height: 600 }
    );
    const zoomed = zoomCamera(panned, -120);

    expect(orbited.yaw).not.toBe(camera.yaw);
    expect(orbited.pitch).not.toBe(camera.pitch);
    expect(panned.target).not.toEqual(orbited.target);
    expect(zoomed.distance).toBeLessThan(panned.distance);
  });

  it("picks a primitive by projected bounds", () => {
    const selectedId = pickPrimitive(
      [
        {
          id: "box_1",
          kind: "box",
          dimensions: { width: 4, height: 4, depth: 4 },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      ],
      createDefaultCamera(),
      { width: 800, height: 600 },
      { x: 400, y: 300 }
    );

    expect(selectedId).toBe("box_1");
  });

  it("picks a sphere primitive by projected bounds", () => {
    const selectedId = pickPrimitive(
      [
        {
          id: "sphere_1",
          kind: "sphere",
          dimensions: { radius: 2 },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      ],
      createDefaultCamera(),
      { width: 800, height: 600 },
      { x: 400, y: 300 }
    );

    expect(selectedId).toBe("sphere_1");
  });

  it("picks cone and torus primitives by projected bounds", () => {
    const camera = createDefaultCamera();
    const size = { width: 800, height: 600 };

    expect(
      pickPrimitive(
        [
          {
            id: "cone_1",
            kind: "cone",
            dimensions: { radius: 2, height: 4 },
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1]
            }
          }
        ],
        camera,
        size,
        { x: 400, y: 300 }
      )
    ).toBe("cone_1");

    expect(
      pickPrimitive(
        [
          {
            id: "torus_1",
            kind: "torus",
            dimensions: { majorRadius: 2, minorRadius: 0.4 },
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1]
            }
          }
        ],
        camera,
        size,
        { x: 400, y: 300 }
      )
    ).toBe("torus_1");
  });

  it("picks a mesh by projected bounds", () => {
    const selectedId = pickRenderScene(
      [],
      [
        {
          id: "mesh_1",
          kind: "mesh",
          vertices: [
            [-2, -2, 0],
            [2, -2, 0],
            [2, 2, 0],
            [-2, 2, 0]
          ],
          indices: [0, 1, 2, 0, 2, 3],
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      ],
      createDefaultCamera(),
      { width: 800, height: 600 },
      { x: 400, y: 300 }
    );

    expect(selectedId).toBe("mesh_1");
  });
});
