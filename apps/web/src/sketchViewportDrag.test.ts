import type {
  SketchEntitySnapshot,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { createDefaultCamera } from "@web-cad/renderer";
import { describe, expect, it } from "vitest";
import {
  applySketchViewportDrag,
  createSketchViewportDragHandles,
  mapViewportDeltaToSketchDelta
} from "./sketchViewportDrag";

describe("sketchViewportDrag", () => {
  const camera = createDefaultCamera();
  const size = { width: 900, height: 600 };
  const sketch: SketchSnapshot = {
    id: "sketch_drag",
    name: "Drag sketch",
    plane: "XY",
    entities: [
      { id: "point_a", kind: "point", point: [0, 0] },
      { id: "line_a", kind: "line", start: [0, 0], end: [1, 0] },
      { id: "circle_a", kind: "circle", center: [2, 0], radius: 0.5 },
      {
        id: "rect_a",
        kind: "rectangle",
        center: [0, 0],
        width: 1,
        height: 1
      }
    ]
  };

  it("creates session-only handles for supported selected entities", () => {
    const lineHandles = createSketchViewportDragHandles({
      camera,
      selectedEntityId: "line_a",
      size,
      sketch
    });
    const circleHandles = createSketchViewportDragHandles({
      camera,
      selectedEntityId: "circle_a",
      size,
      sketch
    });
    const rectangleHandles = createSketchViewportDragHandles({
      camera,
      selectedEntityId: "rect_a",
      size,
      sketch
    });

    expect(lineHandles.map((handle) => handle.kind)).toEqual([
      "lineStart",
      "lineEnd",
      "line"
    ]);
    expect(circleHandles.map((handle) => handle.kind)).toEqual([
      "circleCenter",
      "circleRadius"
    ]);
    expect(rectangleHandles).toEqual([]);
    expect(
      [...lineHandles, ...circleHandles].map((handle) => handle.id)
    ).not.toContain("renderer");
    expect(
      [...lineHandles, ...circleHandles].map((handle) => handle.id)
    ).not.toContain("occt");
  });

  it("maps viewport deltas through a local sketch projection basis", () => {
    expect(
      mapViewportDeltaToSketchDelta(
        {
          origin: { x: 400, y: 300 },
          uVector: { x: 20, y: 0 },
          vVector: { x: 0, y: -10 }
        },
        { x: 40, y: -30 }
      )
    ).toEqual([2, 3]);
  });

  it("returns no sketch delta when the projection basis is singular", () => {
    expect(
      mapViewportDeltaToSketchDelta(
        {
          origin: { x: 0, y: 0 },
          uVector: { x: 1, y: 1 },
          vVector: { x: 2, y: 2 }
        },
        { x: 4, y: 2 }
      )
    ).toBeUndefined();
  });

  it("applies point, line endpoint, line translate, and circle drags without mutating input", () => {
    const point: SketchEntitySnapshot = {
      id: "point_a",
      kind: "point",
      point: [0, 0]
    };
    const line: SketchEntitySnapshot = {
      id: "line_a",
      kind: "line",
      start: [0, 0],
      end: [1, 0]
    };
    const circle: SketchEntitySnapshot = {
      id: "circle_a",
      kind: "circle",
      center: [2, 0],
      radius: 0.5
    };

    expect(
      applySketchViewportDrag(
        point,
        { kind: "point", sketchPoint: [0, 0] },
        [1.25, -0.5]
      )
    ).toEqual({ ...point, point: [1.25, -0.5] });
    expect(
      applySketchViewportDrag(
        line,
        { kind: "lineStart", sketchPoint: [0, 0] },
        [-0.25, 0.5]
      )
    ).toEqual({ ...line, start: [-0.25, 0.5] });
    expect(
      applySketchViewportDrag(
        line,
        { kind: "line", sketchPoint: [0.5, 0] },
        [1, 0.5]
      )
    ).toEqual({ ...line, start: [0.5, 0.5], end: [1.5, 0.5] });
    expect(
      applySketchViewportDrag(
        circle,
        { kind: "circleCenter", sketchPoint: [2, 0] },
        [3, 1]
      )
    ).toEqual({ ...circle, center: [3, 1] });
    expect(
      applySketchViewportDrag(
        circle,
        { kind: "circleRadius", sketchPoint: [2.5, 0] },
        [2, 2]
      )
    ).toEqual({ ...circle, radius: 2 });
    expect(point).toEqual({ id: "point_a", kind: "point", point: [0, 0] });
    expect(line).toEqual({
      id: "line_a",
      kind: "line",
      start: [0, 0],
      end: [1, 0]
    });
    expect(circle).toEqual({
      id: "circle_a",
      kind: "circle",
      center: [2, 0],
      radius: 0.5
    });
  });

  it("keeps unsupported rectangle drag previews non-mutating", () => {
    const rectangle: SketchEntitySnapshot = {
      id: "rect_a",
      kind: "rectangle",
      center: [0, 0],
      width: 1,
      height: 1
    };

    expect(
      applySketchViewportDrag(
        rectangle,
        { kind: "point", sketchPoint: [0, 0] },
        [2, 2]
      )
    ).toBe(rectangle);
  });

  it("clamps circle radius previews to a positive value", () => {
    const circle: SketchEntitySnapshot = {
      id: "circle_a",
      kind: "circle",
      center: [2, 0],
      radius: 0.5
    };

    expect(
      applySketchViewportDrag(
        circle,
        { kind: "circleRadius", sketchPoint: [2.5, 0] },
        [2, 0]
      )
    ).toEqual({ ...circle, radius: 0.001 });
  });
});
