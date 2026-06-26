import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ViewportContextualCommandSurface } from "./ViewportContextualCommandSurface";
import type { ViewportContextualCommandSurfaceModel } from "../viewportContextualCommands";
import type { ViewportInteractionSurface } from "../viewportInteractionSurface";
import type { ViewportTwoTargetMeasurementView } from "../viewportTwoTargetMeasurement";

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

  it("renders active two-target measure session state compactly", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportContextualCommandSurface, {
        surface: createSurface(),
        interactionSurface: createInteractionSurface(),
        twoTargetMeasurement: createTwoTargetMeasurementView()
      })
    );

    expect(markup).toContain("Two-target:");
    expect(markup).toContain("Face: Start cap");
    expect(markup).toContain("Select a second supported target");
    expect(markup).toContain("viewport-contextual-session-status");
    expect(markup).not.toContain("selection-buffer");
    expect(markup).not.toContain("mesh-triangle");
    expect(markup).not.toContain("occt-shape");
  });
});

function createSurface(
  overrides: Partial<ViewportContextualCommandSurfaceModel> = {}
): ViewportContextualCommandSurfaceModel {
  return {
    visible: true,
    selectionKey: "generated:body_rect:face:generated:face:body_rect:startCap",
    title: "Face: Start cap",
    detail: "Ready reference",
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
      detail: "Ready reference",
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
        detail: "Ready target",
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

function createTwoTargetMeasurementView(): ViewportTwoTargetMeasurementView {
  return {
    status: "waitingForSecond",
    firstTarget: {
      key: "body_rect:generated:face:body_rect:startCap:generatedPlanarFace",
      targetKind: "generatedPlanarFace",
      title: "Face: Start cap",
      detail: "Generated reference target",
      label: "Start cap",
      bodyId: "body_rect",
      stableId: "generated:face:body_rect:startCap",
      selection: {
        type: "generatedReference",
        bodyId: "body_rect",
        stableId: "generated:face:body_rect:startCap",
        expectedKind: "face"
      },
      authority: "sourceAnalytic",
      authorityLabel: "Authority: source-analytic exact",
      status: "resolved",
      diagnostics: [],
      source: "body.generatedReferenceMeasurements",
      point: [0, 0, 0],
      pointLabel: "Face center",
      pointRole: "generatedFaceCenter",
      vector: [0, 0, 1],
      vectorLabel: "Face normal",
      vectorRole: "generatedFaceNormal",
      summaryRows: []
    },
    results: [],
    diagnostics: [
      {
        code: "VIEWPORT_TWO_TARGET_MISSING_SECOND_TARGET",
        status: "missing",
        message: "Select a second supported target, then open Measure."
      }
    ],
    prompt: "Select a second supported target, then open Measure."
  };
}
