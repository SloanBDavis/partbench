import { describe, it, expect, vi } from "vitest";
import {
  gpuViewProjection,
  gpuModelMatrix,
  createGpuMeshRenderer,
  projectPoint,
  createDefaultCamera,
  type Vec3,
  type RenderTriangleMesh
} from "./index";
const multiply = (matrix: Float32Array, point: readonly number[]) =>
  Array.from({ length: 4 }, (_, row) =>
    point.reduce(
      (sum, value, column) => sum + value * matrix[column * 4 + row]!,
      0
    )
  );
describe("shared GPU projection", () => {
  it("matches the existing perspective and CPU picking under camera rotation and translated mirrored instances", () => {
    const size = { width: 913, height: 617 };
    for (const camera of [
      createDefaultCamera(),
      { target: [14, -3, 8] as Vec3, yaw: 1.1, pitch: 0.6, distance: 100 }
    ]) {
      const matrix = gpuViewProjection({ camera, size });
      for (const point of [
        [0, 0, 0],
        [11, -8, 5],
        [-12, 14, 9]
      ] as const) {
        const screen = projectPoint(point, camera, size)!;
        const clip = multiply(matrix, [...point, 1]);
        expect(((clip[0]! / clip[3]! + 1) * size.width) / 2).toBeCloseTo(
          screen.x,
          3
        );
        expect(((1 - clip[1]! / clip[3]!) * size.height) / 2).toBeCloseTo(
          screen.y,
          3
        );
        expect(clip[3]).toBeCloseTo(screen.depth, 4);
      }
    }
    const model = gpuModelMatrix({
      translation: [3, 4, 5],
      rotation: [0, 0, Math.PI / 2],
      scale: [-2, 3, 1]
    });
    const transformed = multiply(model, [1, 2, 3, 1]);
    transformed.forEach((value, index) =>
      expect(value).toBeCloseTo([-3, 2, 8, 1][index]!, 5)
    );
  });

  it("reports unavailable contexts and actual shader errors without leaking shader/program resources", () => {
    const absent = {
      dataset: {},
      getContext: () => null
    } as unknown as HTMLCanvasElement;
    expect(createGpuMeshRenderer(absent)).toBeUndefined();
    expect(absent.dataset.gpuStatus).toBe("context-unavailable");
    const { canvas, calls } = fakeGpu();
    calls.getShaderParameter.mockReturnValue(false);
    expect(createGpuMeshRenderer(canvas)).toBeUndefined();
    expect(canvas.dataset.gpuError).toBe("fixture shader diagnostic");
    expect(calls.deleteShader).toHaveBeenCalledTimes(1);
    expect(calls.deleteProgram).toHaveBeenCalledTimes(1);
  });

  it("retains shared geometry across pose/camera changes, updates changed edges, and releases resources", () => {
    const { canvas, calls } = fakeGpu();
    const renderer = createGpuMeshRenderer(canvas)!;
    const mesh: RenderTriangleMesh = {
      id: "first",
      kind: "mesh",
      vertices: [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0]
      ],
      indices: [0, 1, 2],
      transform: {
        translation: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      }
    };
    const scene = {
      camera: createDefaultCamera(),
      size: { width: 800, height: 600 },
      primitives: [],
      meshes: [mesh, { ...mesh, id: "second" }]
    };
    expect(renderer.draw(scene, 2)).toBe(true);
    expect(JSON.parse(canvas.dataset.gpuMetrics!)).toMatchObject({
      definitions: 1,
      instances: 2,
      uploads: 1
    });
    expect(calls.createBuffer).toHaveBeenCalledTimes(3);
    expect(
      renderer.draw(
        {
          ...scene,
          camera: { ...scene.camera, yaw: 1.2 },
          meshes: [
            mesh,
            {
              ...mesh,
              id: "second",
              transform: { ...mesh.transform, translation: [10, 0, 0] }
            }
          ]
        },
        2
      )
    ).toBe(true);
    expect(calls.createBuffer).toHaveBeenCalledTimes(3);
    const edged = {
      ...mesh,
      edgeSegments: [{ start: [0, 0, 0] as Vec3, end: [1, 0, 0] as Vec3 }]
    };
    expect(renderer.draw({ ...scene, meshes: [edged] }, 2)).toBe(true);
    expect(JSON.parse(canvas.dataset.gpuMetrics!)).toMatchObject({
      definitions: 1,
      instances: 1,
      uploads: 2
    });
    expect(calls.drawArraysInstanced).toHaveBeenCalledTimes(1);
    expect(calls.deleteBuffer).toHaveBeenCalledTimes(3);
    renderer.dispose();
    renderer.dispose();
    expect(calls.deleteBuffer).toHaveBeenCalledTimes(7);
    expect(calls.deleteProgram).toHaveBeenCalledTimes(1);
    expect(renderer.draw(scene, 2)).toBe(false);
  });

  it("falls back cleanly if geometry allocation fails midway", () => {
    const { canvas, calls } = fakeGpu();
    calls.createBuffer.mockReturnValueOnce({}).mockReturnValueOnce(null);
    const renderer = createGpuMeshRenderer(canvas)!;
    expect(
      renderer.draw(
        {
          camera: createDefaultCamera(),
          size: { width: 800, height: 600 },
          primitives: [],
          meshes: [
            {
              id: "part",
              kind: "mesh",
              vertices: [[0, 0, 0]],
              indices: [0, 0, 0],
              transform: {
                translation: [0, 0, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1]
              }
            }
          ]
        },
        1
      )
    ).toBe(false);
    expect(canvas.dataset.gpuStatus).toBe("draw-failed");
    expect(calls.deleteBuffer).toHaveBeenCalledTimes(1);
    renderer.dispose();
    expect(calls.deleteBuffer).toHaveBeenCalledTimes(1);
  });
});

function fakeGpu() {
  const calls = {
    createShader: vi.fn(() => ({})),
    getShaderParameter: vi.fn(() => true),
    createProgram: vi.fn(() => ({})),
    getProgramParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => "fixture shader diagnostic"),
    getProgramInfoLog: vi.fn(() => "fixture linker diagnostic"),
    getUniformLocation: vi.fn(() => ({})),
    createBuffer: vi.fn((): object | null => ({})),
    deleteBuffer: vi.fn(),
    deleteShader: vi.fn(),
    deleteProgram: vi.fn(),
    drawArraysInstanced: vi.fn(),
    isContextLost: vi.fn(() => false)
  };
  const constants = new Map<string, number>();
  const gl = new Proxy(calls, {
    get(target, property) {
      if (property in target) return target[property as keyof typeof target];
      if (typeof property === "string" && property.toUpperCase() === property) {
        if (!constants.has(property))
          constants.set(property, constants.size + 1);
        return constants.get(property);
      }
      return () => undefined;
    }
  });
  return {
    calls,
    canvas: {
      width: 0,
      height: 0,
      dataset: {},
      getContext: () => gl
    } as unknown as HTMLCanvasElement
  };
}
