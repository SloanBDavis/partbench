import type { SketchSnapshot } from "@web-cad/cad-protocol";
import { createDefaultCamera } from "@web-cad/renderer";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SketchViewportDragOverlay } from "./SketchViewportDragOverlay";

describe("SketchViewportDragOverlay", () => {
  const baseSketch: SketchSnapshot = {
    id: "sketch_overlay",
    name: "Overlay sketch",
    plane: "XY",
    entities: [
      {
        id: "line_a",
        kind: "line",
        construction: false,
        start: [0, 0],
        end: [1, 0]
      },
      {
        id: "rect_a",
        kind: "rectangle",
        construction: false,
        center: [0, 0],
        width: 1,
        height: 1
      },
      {
        id: "arc_a",
        kind: "arc",
        construction: false,
        center: [2, 0],
        radius: 1,
        startAngleDegrees: 0,
        sweepAngleDegrees: 90
      }
    ]
  };

  it("renders selected line handles without renderer-private identifiers", () => {
    const markup = renderToStaticMarkup(
      createElement(SketchViewportDragOverlay, {
        camera: createDefaultCamera(),
        selectedEntityId: "line_a",
        size: { width: 900, height: 600 },
        sketch: baseSketch,
        onCommitEntity: () => undefined
      })
    );

    expect(markup).toContain('aria-label="Sketch drag handles"');
    expect(markup).toContain('aria-label="Drag Start point"');
    expect(markup).toContain('aria-label="Drag End point"');
    expect(markup).toContain('aria-label="Drag Line"');
    expect(markup).not.toContain("selection-buffer");
    expect(markup).not.toContain("occt");
    expect(markup).not.toContain("mesh");
  });

  it("does not render handles for unsupported rectangle drags", () => {
    const markup = renderToStaticMarkup(
      createElement(SketchViewportDragOverlay, {
        camera: createDefaultCamera(),
        selectedEntityId: "rect_a",
        size: { width: 900, height: 600 },
        sketch: baseSketch,
        onCommitEntity: () => undefined
      })
    );

    expect(markup).toBe("");
  });

  it("does not render handles for Slice B arc drags", () => {
    const markup = renderToStaticMarkup(
      createElement(SketchViewportDragOverlay, {
        camera: createDefaultCamera(),
        selectedEntityId: "arc_a",
        size: { width: 900, height: 600 },
        sketch: baseSketch,
        onCommitEntity: () => undefined
      })
    );

    expect(markup).toBe("");
  });

  it("does not render handles while commands are pending", () => {
    const markup = renderToStaticMarkup(
      createElement(SketchViewportDragOverlay, {
        camera: createDefaultCamera(),
        disabled: true,
        selectedEntityId: "line_a",
        size: { width: 900, height: 600 },
        sketch: baseSketch,
        onCommitEntity: () => undefined
      })
    );

    expect(markup).toBe("");
  });
});
