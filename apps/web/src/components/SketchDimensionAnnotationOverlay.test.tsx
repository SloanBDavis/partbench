import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SketchDimensionAnnotationOverlay } from "./SketchDimensionAnnotationOverlay";

describe("SketchDimensionAnnotationOverlay", () => {
  it("renders focusable session annotations with values", () => {
    const markup = renderToStaticMarkup(
      createElement(SketchDimensionAnnotationOverlay, {
        annotations: [
          {
            dimensionId: "dim_width",
            sketchId: "sketch_1",
            name: "Width",
            familyLabel: "Width",
            valueLabel: "40 mm",
            boundToParameter: false,
            x: 120,
            y: 80,
            anchorX: 100,
            anchorY: 90,
            target: {
              kind: "entityScalar",
              entityId: "rect_1",
              entityKind: "rectangle",
              role: "width"
            }
          }
        ],
        onSelect: () => undefined,
        onEdit: () => undefined,
        onMove: () => undefined
      })
    );

    expect(markup).toContain("40 mm");
    expect(markup).toContain('aria-label="Width 40 mm"');
    expect(markup).toContain("sketch-dimension-annotation");
  });
});
