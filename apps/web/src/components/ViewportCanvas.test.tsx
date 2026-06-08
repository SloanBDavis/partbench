import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ViewportCanvas } from "./ViewportCanvas";

describe("ViewportCanvas", () => {
  it("renders only viewport controls and the canvas surface", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportCanvas, {
        primitives: [],
        meshes: [],
        selectedId: "body_rect",
        onSelect: () => undefined
      })
    );

    expect(markup).toContain('aria-label="3D viewport"');
    expect(markup).toContain('aria-label="Viewport controls"');
    expect(markup).toContain('aria-label="3D scene viewport"');
    expect(markup).toContain("Fit all");
    expect(markup).toContain("Fit selected");
    expect(markup).toContain("Reset");
    expect(markup).not.toContain("Viewport interaction summary");
    expect(markup).not.toContain("Viewport reference candidates");
    expect(markup).not.toContain("Viewport selection diagnostics");
    expect(markup).not.toContain("Command-ready reference");
    expect(markup).not.toContain("viewport-interaction-surface");
    expect(markup).not.toContain("viewport-reference-action");
    expect(markup).not.toContain("viewport-measurement");
  });

  it("disables fit selected until a render target is selected", () => {
    const emptyMarkup = renderToStaticMarkup(
      createElement(ViewportCanvas, {
        primitives: [],
        meshes: [],
        onSelect: () => undefined
      })
    );
    const selectedMarkup = renderToStaticMarkup(
      createElement(ViewportCanvas, {
        primitives: [],
        meshes: [],
        selectedId: "body_rect",
        onSelect: () => undefined
      })
    );

    expect(emptyMarkup).toMatch(
      /<button[^>]*disabled=""[^>]*title="Fit selected object"[^>]*>Fit selected/
    );
    expect(selectedMarkup).not.toMatch(
      /<button[^>]*disabled=""[^>]*title="Fit selected object"[^>]*>Fit selected/
    );
  });

  it("keeps renderer and selection-buffer identifiers out of visible markup", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportCanvas, {
        primitives: [
          {
            id: "selection-buffer:face:17",
            kind: "box",
            dimensions: { width: 1, height: 1, depth: 1 },
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1]
            }
          }
        ],
        meshes: [
          {
            id: "occt-shape:body:1",
            kind: "mesh",
            vertices: [],
            indices: [],
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1]
            },
            source: "occt"
          }
        ],
        selectedId: "selection-buffer:face:17",
        onSelect: () => undefined
      })
    );

    expect(markup).not.toContain("selection-buffer");
    expect(markup).not.toContain("occt-shape");
    expect(markup).not.toContain("mesh-triangle");
  });
});
