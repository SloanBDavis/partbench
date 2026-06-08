import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ViewportCanvas } from "./ViewportCanvas";
import type { ViewportSelectionDisplay } from "../viewportSelectionDisplay";

describe("ViewportCanvas", () => {
  it("renders semantic selection and command-ready status beside the viewport", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportCanvas, {
        primitives: [],
        meshes: [],
        selectedId: "body_rect",
        selectionDisplay: createSelectionDisplay({
          selectionKind: "generatedReference",
          title: "Face: Start cap",
          detail: "Command-ready reference",
          tone: "ready",
          geometryStatus: "ready",
          geometryDetail: "OCCT mesh ready",
          referenceSummary: "Face: Start cap",
          commandOperationLabels: ["Create sketch on face", "Name reference"]
        }),
        onSelect: () => undefined
      })
    );

    expect(markup).toContain('data-selection-kind="generatedReference"');
    expect(markup).toContain('data-geometry-status="ready"');
    expect(markup).toContain("Command-ready reference");
    expect(markup).toContain("Create sketch on face, Name reference");
    expect(markup).toContain("OCCT mesh ready");
  });

  it("renders structured diagnostics for blocked viewport selections", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportCanvas, {
        primitives: [],
        meshes: [],
        selectedId: "body_rect",
        selectionDisplay: createSelectionDisplay({
          detail: "Selection target unsupported",
          tone: "blocked",
          diagnostics: [
            {
              code: "UNSUPPORTED_SELECTION_TARGET",
              status: "unsupported",
              message: "Primitive body references are not command-ready."
            }
          ]
        }),
        onSelect: () => undefined
      })
    );

    expect(markup).toContain("viewport-status-blocked");
    expect(markup).toContain("Selection target unsupported");
    expect(markup).toContain(
      "Primitive body references are not command-ready."
    );
  });
});

function createSelectionDisplay(
  overrides: Partial<ViewportSelectionDisplay> = {}
): ViewportSelectionDisplay {
  return {
    selectionKind: "body",
    title: "Base (Body)",
    detail: "Command-ready reference",
    tone: "ready",
    renderTargetId: "body_rect",
    geometryStatus: "ready",
    geometryDetail: "OCCT mesh ready",
    referenceStatus: "resolved",
    referenceSummary: "Face: Start cap",
    commandOperations: [],
    commandOperationLabels: [],
    diagnostics: [],
    ...overrides
  };
}
