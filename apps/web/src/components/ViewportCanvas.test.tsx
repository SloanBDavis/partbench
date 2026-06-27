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
    expect(markup).toContain('aria-label="Viewport fit and zoom"');
    expect(markup).toContain('aria-label="Viewport standard views"');
    expect(markup).toContain('aria-label="3D scene viewport"');
    expect(markup).toContain("Fit all");
    expect(markup).toContain("Fit selected");
    expect(markup).toContain("Reset");
    expect(markup).toContain("Top");
    expect(markup).toContain("Front");
    expect(markup).toContain("Right");
    expect(markup).toContain("Iso");
    expect(markup).not.toContain("Viewport interaction summary");
    expect(markup).not.toContain("Viewport reference candidates");
    expect(markup).not.toContain("Viewport selection diagnostics");
    expect(markup).not.toContain("Ready reference");
    expect(markup).not.toContain("viewport-navigation-panel");
    expect(markup).not.toContain("viewport-camera-overlay");
    expect(markup).not.toContain("viewport-interaction-surface");
    expect(markup).not.toContain("viewport-reference-action");
    expect(markup).not.toContain("viewport-measurement");
  });

  it("renders compact viewport status without obstructive detail panels", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportCanvas, {
        primitives: [],
        meshes: [],
        selectedId: "body_rect",
        status: {
          label: "Face selected",
          detail:
            "Owning body highlighted; use the Inspector for exact face or edge details.",
          tone: "ready"
        },
        visualStates: [
          { targetId: "body_rect", targetKind: "face", state: "selected" },
          {
            targetId: "body_rect",
            targetKind: "face",
            state: "commandTarget"
          }
        ],
        onSelect: () => undefined
      })
    );

    expect(markup).toContain('aria-label="Viewport status"');
    expect(markup).toContain("Face selected");
    expect(markup).toContain("Owning body highlighted");
    expect(markup).not.toContain("Viewport interaction summary");
    expect(markup).not.toContain("Viewport reference candidates");
    expect(markup).not.toContain("Viewport selection diagnostics");
    expect(markup).not.toContain("viewport-interaction-surface");
  });

  it("hosts compact contextual controls in a viewport-adjacent slot", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportCanvas, {
        primitives: [],
        meshes: [],
        selectedId: "body_rect",
        contextualSurface: createElement(
          "section",
          { "aria-label": "Viewport contextual commands" },
          "Create sketch"
        ),
        onSelect: () => undefined
      })
    );

    expect(markup).toContain("viewport-contextual-slot");
    expect(markup).toContain('aria-label="Viewport contextual commands"');
    expect(markup).toContain("Create sketch");
    expect(markup).not.toContain("Viewport reference candidates");
    expect(markup).not.toContain("Viewport selection diagnostics");
  });

  it("hosts sketch overlays inside the viewport frame without adding panels", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportCanvas, {
        primitives: [],
        meshes: [],
        selectedId: "sketch_line",
        sketchOverlay: () =>
          createElement(
            "svg",
            {
              "aria-label": "Sketch drag handles",
              className: "sketch-drag-overlay"
            },
            createElement("circle", { "aria-label": "Drag Start point" })
          ),
        onSelect: () => undefined
      })
    );

    expect(markup).toContain('aria-label="Sketch drag handles"');
    expect(markup).toContain("sketch-drag-overlay");
    expect(markup).not.toContain("Viewport reference candidates");
    expect(markup).not.toContain("Viewport selection diagnostics");
  });

  it("marks the viewport frame when status and contextual controls share the model area", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportCanvas, {
        primitives: [],
        meshes: [],
        selectedId: "body_rect",
        status: {
          label: "Body selected",
          detail: "Selected body body_rect is consumed by feature feat_cut.",
          tone: "warning"
        },
        contextualSurface: createElement(
          "section",
          { "aria-label": "Viewport contextual commands" },
          "Measure"
        ),
        onSelect: () => undefined
      })
    );

    expect(markup).toContain(
      'class="viewport-frame viewport-frame-with-contextual viewport-frame-with-status"'
    );
    expect(markup).toContain("Selected body already has a downstream result.");
    expect(markup).not.toContain("feature feat_cut");
    expect(markup).toContain('aria-label="Viewport contextual commands"');
  });

  it("disables fit selected until selected render bounds exist", () => {
    const emptyMarkup = renderToStaticMarkup(
      createElement(ViewportCanvas, {
        primitives: [],
        meshes: [],
        onSelect: () => undefined
      })
    );
    const selectedMarkup = renderToStaticMarkup(
      createElement(ViewportCanvas, {
        primitives: [
          {
            id: "body_rect",
            kind: "box",
            dimensions: { width: 1, height: 1, depth: 1 },
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1]
            }
          }
        ],
        meshes: [],
        selectedId: "body_rect",
        onSelect: () => undefined
      })
    );

    expect(emptyMarkup).toMatch(
      /<button[^>]*disabled=""[^>]*title="Fit selected unavailable"[^>]*>Fit selected/
    );
    expect(selectedMarkup).not.toMatch(
      /<button[^>]*disabled=""[^>]*title="Fit selected object"[^>]*>Fit selected/
    );
    expect(selectedMarkup).toMatch(
      /<button[^>]*title="Fit selected object"[^>]*>Fit selected/
    );
  });

  it("keeps navigation compact while hosting contextual controls separately", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportCanvas, {
        primitives: [],
        meshes: [],
        selectedId: "body_rect",
        contextualSurface: createElement(
          "section",
          { "aria-label": "Viewport contextual commands" },
          "Measure"
        ),
        onSelect: () => undefined
      })
    );
    const buttonCount = markup.match(/<button/g)?.length ?? 0;

    expect(buttonCount).toBe(9);
    expect(markup).toContain("viewport-actions");
    expect(markup).toContain("viewport-contextual-slot");
    expect(markup).not.toContain("viewport-navigation-panel");
    expect(markup).not.toContain("viewport-camera-overlay");
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
        status: {
          label: "Face selected",
          detail:
            "Owning body highlighted; use the Inspector for exact face or edge details.",
          tone: "ready"
        },
        visualStates: [
          { targetId: "box_1", targetKind: "face", state: "selected" }
        ],
        onSelect: () => undefined
      })
    );

    expect(markup).not.toContain("selection-buffer");
    expect(markup).not.toContain("occt-shape");
    expect(markup).not.toContain("mesh-triangle");
  });
});
