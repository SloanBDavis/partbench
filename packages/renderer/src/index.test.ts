import { describe, expect, it } from "vitest";
import {
  createRenderVisualStateMap,
  createDefaultCamera,
  orbitCamera,
  panCamera,
  pickPrimitive,
  pickRenderScene,
  projectPoint,
  renderCanvasScene,
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

  it("does not double-apply scale when picking box primitives", () => {
    const camera = createDefaultCamera();
    const size = { width: 800, height: 600 };
    const outsideCorrectBox = projectPoint([3.5, 0, 0], camera, size);

    expect(outsideCorrectBox).toBeDefined();

    const selectedId = pickPrimitive(
      [
        {
          id: "box_1",
          kind: "box",
          dimensions: { width: 2, height: 2, depth: 2 },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [2, 1, 1]
          }
        }
      ],
      camera,
      size,
      {
        x: outsideCorrectBox?.x ?? 0,
        y: outsideCorrectBox?.y ?? 0
      }
    );

    expect(selectedId).toBeUndefined();
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

  it("renders selected meshes without semantic edges as one projected outline", () => {
    const recorder = createRecordingCanvasContext();

    renderCanvasScene(recorder.context, {
      camera: createDefaultCamera(),
      size: { width: 800, height: 600 },
      primitives: [],
      meshes: [
        {
          id: "mesh_without_edges",
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
      selectedId: "mesh_without_edges"
    });

    const selectedMeshStrokes = recorder.strokes.filter(
      (stroke) => stroke.lineWidth === 3
    );
    expect(selectedMeshStrokes).toHaveLength(1);
    expect(selectedMeshStrokes[0].closed).toBe(true);
    expect(selectedMeshStrokes[0].points).toHaveLength(4);
  });

  it("normalizes semantic display visual states without storing generated refs", () => {
    const states = createRenderVisualStateMap({
      selectedId: "body_rect",
      hoveredId: "body_hover",
      visualStates: [
        {
          targetId: "body_rect",
          targetKind: "face",
          state: "commandTarget"
        },
        {
          targetId: "body_rect",
          targetKind: "face",
          state: "pending"
        },
        {
          targetId: "body_warning",
          targetKind: "body",
          state: "warning"
        }
      ]
    });

    expect(states.get("body_rect")).toEqual({
      hover: false,
      selected: true,
      commandTarget: true,
      warning: false,
      pending: true,
      failed: false
    });
    expect(states.get("body_hover")?.hover).toBe(true);
    expect(states.get("body_warning")?.warning).toBe(true);
    expect(JSON.stringify([...states])).not.toContain("generated:face");
    expect(JSON.stringify([...states])).not.toContain("selection-buffer");
  });
});

interface StrokeRecord {
  readonly closed: boolean;
  readonly lineWidth: number;
  readonly points: readonly { readonly x: number; readonly y: number }[];
}

function createRecordingCanvasContext(): {
  readonly context: CanvasRenderingContext2D;
  readonly strokes: StrokeRecord[];
} {
  const strokes: StrokeRecord[] = [];
  let closed = false;
  let lineWidth = 1;
  let points: { x: number; y: number }[] = [];

  const context = {
    clearRect: () => {},
    save: () => {},
    restore: () => {},
    beginPath: () => {
      closed = false;
      points = [];
    },
    moveTo: (x: number, y: number) => {
      points.push({ x, y });
    },
    lineTo: (x: number, y: number) => {
      points.push({ x, y });
    },
    closePath: () => {
      closed = true;
    },
    fill: () => {},
    stroke: () => {
      strokes.push({
        closed,
        lineWidth,
        points: [...points]
      });
    },
    set fillStyle(_value: string) {},
    set lineCap(_value: CanvasLineCap) {},
    set lineJoin(_value: CanvasLineJoin) {},
    set lineWidth(value: number) {
      lineWidth = value;
    },
    get lineWidth() {
      return lineWidth;
    },
    set strokeStyle(_value: string) {}
  } as unknown as CanvasRenderingContext2D;

  return { context, strokes };
}
