import { afterEach, describe, expect, it, vi } from "vitest";

const renderCanvasScene = vi.hoisted(() => vi.fn());
vi.mock("@web-cad/renderer", () => ({ renderCanvasScene }));

import { paintProgressiveSketchCanvas } from "./progressiveSketchCanvas";

describe("progressive sketch canvas", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps partial staging offscreen until the complete replacement is ready", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("window", {
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      },
      cancelAnimationFrame: vi.fn()
    });
    const bufferContext = { setTransform: vi.fn() };
    const buffer = {
      width: 0,
      height: 0,
      getContext: () => bufferContext
    };
    const context = {
      canvas: {
        width: 200,
        height: 100,
        ownerDocument: { createElement: () => buffer }
      },
      save: vi.fn(),
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      restore: vi.fn()
    };
    const mesh = (id: string) => ({
      id,
      kind: "mesh" as const,
      vertices: [],
      indices: [],
      transform: {
        translation: [0, 0, 0] as const,
        rotation: [0, 0, 0] as const,
        scale: [1, 1, 1] as const
      },
      source: "sketch"
    });

    paintProgressiveSketchCanvas(
      context as unknown as CanvasRenderingContext2D,
      {
        primitives: [],
        meshes: [mesh("a"), mesh("b")],
        camera: { target: [0, 0, 0], yaw: 0, pitch: 0, distance: 10 },
        size: { width: 100, height: 50 }
      }
    );

    expect(context.clearRect).not.toHaveBeenCalled();
    while (frames.length) frames.shift()?.(0);
    expect(renderCanvasScene).toHaveBeenCalledTimes(4);
    expect(renderCanvasScene.mock.calls[0]?.[0]).toBe(context);
    expect(
      renderCanvasScene.mock.calls
        .slice(1)
        .every(([target]) => target === bufferContext)
    ).toBe(true);
    expect(context.clearRect).toHaveBeenCalledOnce();
    expect(context.drawImage).toHaveBeenCalledWith(buffer, 0, 0);
  });

  it("renders several dense chunks per frame", () => {
    renderCanvasScene.mockClear();
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("window", {
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      },
      cancelAnimationFrame: vi.fn()
    });
    const buffer = {
      width: 0,
      height: 0,
      getContext: () => ({ setTransform: vi.fn() })
    };
    const context = {
      canvas: {
        width: 200,
        height: 100,
        ownerDocument: { createElement: () => buffer }
      },
      save: vi.fn(),
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      restore: vi.fn()
    };

    const scene = {
      primitives: [],
      meshes: [
        {
          id: "dense",
          kind: "mesh" as const,
          vertices: [],
          indices: [],
          transform: {
            translation: [0, 0, 0] as const,
            rotation: [0, 0, 0] as const,
            scale: [1, 1, 1] as const
          },
          source: "sketch" as const,
          edgeSegments: Array.from({ length: 288 }, (_, index) => ({
            start: [index, 0, 0] as const,
            end: [index + 1, 0, 0] as const
          }))
        }
      ],
      camera: {
        target: [0, 0, 0] as const,
        yaw: 0,
        pitch: 0,
        distance: 10
      },
      size: { width: 100, height: 50 }
    };

    paintProgressiveSketchCanvas(
      context as unknown as CanvasRenderingContext2D,
      scene
    );

    expect(renderCanvasScene).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        camera: scene.camera,
        meshes: [
          expect.objectContaining({
            edgeSegments: expect.arrayContaining([
              expect.objectContaining({
                start: expect.any(Array),
                end: expect.any(Array)
              })
            ])
          })
        ]
      })
    );
    expect(
      renderCanvasScene.mock.calls[0]?.[1].meshes?.[0]?.edgeSegments
    ).toHaveLength(8);
    frames.shift()?.(0);
    expect(renderCanvasScene).toHaveBeenCalledTimes(10);
    expect(context.drawImage).not.toHaveBeenCalled();
    frames.shift()?.(16);
    expect(context.drawImage).toHaveBeenCalledOnce();

    frames.length = 0;
    context.drawImage.mockClear();
    renderCanvasScene.mockClear();
    paintProgressiveSketchCanvas(
      context as unknown as CanvasRenderingContext2D,
      {
        ...scene,
        visualStates: [
          {
            targetId: "dense",
            targetKind: "sketchEntity",
            state: "preselection"
          }
        ]
      }
    );
    expect(frames).toHaveLength(0);
    expect(context.drawImage).toHaveBeenCalledOnce();
    expect(renderCanvasScene).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        meshes: [scene.meshes[0]],
        preserveDrawingBuffer: true
      })
    );
  });
});
