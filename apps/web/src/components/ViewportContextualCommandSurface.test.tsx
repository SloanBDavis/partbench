import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ViewportContextualCommandSurface } from "./ViewportContextualCommandSurface";
import type { ViewportContextualCommandSurfaceModel } from "../viewportContextualCommands";
import type { ViewportInteractionSurface } from "../viewportInteractionSurface";

describe("ViewportContextualCommandSurface", () => {
  it("renders a compact command surface without debug panels", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportContextualCommandSurface, {
        surface: createSurface(),
        interactionSurface: createInteractionSurface()
      })
    );

    expect(markup).toContain('aria-label="Viewport contextual commands"');
    expect(markup).toContain("Face: Start cap");
    expect(markup).toContain("Create sketch");
    expect(markup).toContain("Name");
    expect(markup).toContain("Measure");
    expect(markup).toContain("Inspect");
    expect(markup).toContain("viewport-contextual-command-surface");
    expect(markup).not.toContain("Viewport interaction summary");
    expect(markup).not.toContain("Viewport selection diagnostics");
    expect(markup).not.toContain("selection-buffer");
    expect(markup).not.toContain("mesh-triangle");
    expect(markup).not.toContain("occt-shape");
  });

  it("keeps disabled commandability reasons on action buttons", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportContextualCommandSurface, {
        surface: createSurface({
          tone: "warning",
          actions: [
            {
              id: "feature.chamfer",
              label: "Chamfer",
              route: "command",
              disabled: true,
              reason: "Selected body is consumed by feature feat_cut."
            }
          ],
          diagnostic: "Selected body is consumed by feature feat_cut."
        })
      })
    );

    expect(markup).toContain("Chamfer");
    expect(markup).toContain('disabled=""');
    expect(markup).toContain("Selected body is consumed by feature feat_cut.");
    expect(markup).not.toContain("viewport-reference-action");
  });
});

function createSurface(
  overrides: Partial<ViewportContextualCommandSurfaceModel> = {}
): ViewportContextualCommandSurfaceModel {
  return {
    visible: true,
    selectionKey: "generated:body_rect:face:generated:face:body_rect:startCap",
    title: "Face: Start cap",
    detail: "Command-ready reference",
    tone: "ready",
    actions: [
      {
        id: "sketch.createOnFace",
        label: "Create sketch",
        route: "command",
        disabled: false
      },
      {
        id: "reference.name",
        label: "Name",
        route: "name",
        disabled: false,
        target: {
          bodyId: "body_rect",
          stableId: "generated:face:body_rect:startCap",
          kind: "face"
        }
      },
      {
        id: "feature.measureReference",
        label: "Measure",
        route: "measure",
        disabled: false
      },
      {
        id: "feature.selectReference",
        label: "Inspect",
        route: "inspect",
        disabled: false
      }
    ],
    ...overrides
  };
}

function createInteractionSurface(): ViewportInteractionSurface {
  return {
    selection: {
      selectionKind: "generatedReference",
      title: "Face: Start cap",
      detail: "Command-ready reference",
      tone: "ready",
      geometryStatus: "ready",
      commandOperationLabels: [
        "Name reference",
        "Create sketch on face",
        "Measure reference",
        "Inspect reference"
      ],
      diagnostics: [],
      measurement: {
        title: "Face measurement",
        detail: "Start cap",
        source: "body.generatedReferenceMeasurements",
        authority: "sourceAnalytic",
        authorityLabel: "Authority: source-analytic exact",
        tone: "ready",
        rows: [{ label: "Area", value: "8 mm^2" }],
        overflowCount: 0
      },
      inspect: {
        title: "Inspect target",
        detail: "Command-ready target",
        authority: "sourceAnalytic",
        authorityLabel: "Authority: source-analytic exact",
        rows: [
          { label: "Target", value: "Face: Start cap" },
          {
            label: "Authority",
            value: "Authority: source-analytic exact"
          },
          { label: "Commands", value: "Inspect reference" }
        ],
        commandOperationLabels: ["Inspect reference"],
        diagnostics: []
      }
    }
  };
}
